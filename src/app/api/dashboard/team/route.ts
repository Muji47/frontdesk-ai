import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, hashPassword, withTransaction } from "@/lib/db";
import { sendStaffInviteEmail } from "@/lib/email";
import { handleApiError, UnauthorizedError, ValidationError, ForbiddenError } from "@/server/errors";
import { randomBytes } from "node:crypto";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to view team members.");
    }

    const orgRow = db
      .prepare("SELECT plan FROM organizations WHERE id = ?")
      .get(user.orgId) as { plan: string } | undefined;
    const plan = orgRow?.plan || "growth";

    const seatLimits: Record<string, number> = {
      starter: 1,
      growth: 3,
      scale: 10,
      pro: 10,
    };
    const seatLimit = seatLimits[plan] || 3;

    const teamRows = db
      .prepare(`
        SELECT id, organization_id, email, name, role, can_edit_company_templates, created_at
        FROM users
        WHERE organization_id = ?
        ORDER BY created_at ASC
      `)
      .all(user.orgId) as Array<{
        id: string;
        organization_id: string;
        email: string;
        name: string;
        role: string;
        can_edit_company_templates?: number;
        created_at: string;
      }>;

    return NextResponse.json({
      success: true,
      data: {
        team: teamRows,
        plan,
        seatLimit,
        seatsUsed: teamRows.length,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to invite team members.");
    }

    // Only owner or admin can invite team members
    const callerRow = db
      .prepare("SELECT role FROM users WHERE id = ?")
      .get(user.userId) as { role: string } | undefined;
    if (callerRow?.role !== "owner" && callerRow?.role !== "admin") {
      throw new ForbiddenError("Only organization owners or administrators can invite team members.");
    }

    const orgRow = db
      .prepare("SELECT plan FROM organizations WHERE id = ?")
      .get(user.orgId) as { plan: string } | undefined;
    const plan = orgRow?.plan || "growth";

    const seatLimits: Record<string, number> = {
      starter: 1,
      growth: 3,
      scale: 10,
      pro: 10,
    };
    const seatLimit = seatLimits[plan] || 3;

    const countUser = db
      .prepare("SELECT COUNT(*) as cnt FROM users WHERE organization_id = ?")
      .get(user.orgId) as { cnt: number };

    if (countUser.cnt >= seatLimit) {
      throw new ValidationError(
        `Seat limit reached for your ${plan.toUpperCase()} plan (${countUser.cnt}/${seatLimit} seats). Please upgrade to add more staff.`
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const role = ["admin", "receptionist", "viewer"].includes(body.role) ? body.role : "receptionist";
    const canEditCompanyTemplates = body.canEditCompanyTemplates ? 1 : (role === "admin" ? 1 : 0);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError("A valid email address is required.");
    }
    if (!name || name.length < 2) {
      throw new ValidationError("Staff member name must be at least 2 characters.");
    }

    // Check if user email is already registered
    const existing = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email);
    if (existing) {
      throw new ValidationError("A user with this email address is already registered.");
    }

    const newUserId = "usr_" + randomBytes(6).toString("hex");
    const tempPassword = "Staff" + randomBytes(4).toString("hex") + "!";
    const { hash, salt } = hashPassword(tempPassword);
    const nowIso = new Date().toISOString();

    // Generate secure 48-hour activation token
    const tokenId = "tok_" + randomBytes(8).toString("hex");
    const token = "inv_" + randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3001";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const inviteUrl = `${proto}://${host}/set-password?token=${token}`;

    withTransaction(() => {
      db.prepare(`
        INSERT INTO users (id, organization_id, email, name, password_hash, salt, role, can_edit_company_templates, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newUserId, user.orgId, email, name, hash, salt, role, canEditCompanyTemplates, nowIso);

      db.prepare(`
        INSERT INTO auth_tokens (id, user_id, email, token, type, expires_at)
        VALUES (?, ?, ?, ?, 'invite', ?)
      `).run(tokenId, newUserId, email, token, expiresAt);
    });

    // Dispatch formal invitation email
    await sendStaffInviteEmail({
      toEmail: email,
      toName: name,
      orgName: user.orgName || "Echo.ai Workspace",
      inviterName: user.name || "Clinic Director",
      role,
      inviteUrl,
    });

    return NextResponse.json(
      {
        success: true,
        member: {
          id: newUserId,
          organizationId: user.orgId,
          email,
          name,
          role,
          can_edit_company_templates: Boolean(canEditCompanyTemplates),
          createdAt: nowIso,
          tempPassword,
        },
        inviteUrl,
        emailSent: true,
        message: `Invitation email with password setup link sent to ${email}`,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to remove team members.");
    }

    const callerRow = db
      .prepare("SELECT role FROM users WHERE id = ?")
      .get(user.userId) as { role: string } | undefined;
    if (callerRow?.role !== "owner" && callerRow?.role !== "admin") {
      throw new ForbiddenError("Only organization owners or administrators can remove team members.");
    }

    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get("id");

    if (!targetId) {
      throw new ValidationError("Team member ID is required.");
    }

    if (targetId === user.userId) {
      throw new ValidationError("You cannot remove yourself from the organization.");
    }

    const targetUser = db
      .prepare("SELECT id, role, organization_id FROM users WHERE id = ? AND organization_id = ?")
      .get(targetId, user.orgId) as { id: string; role: string; organization_id: string } | undefined;

    if (!targetUser) {
      throw new ValidationError("Team member not found in your organization.");
    }

    if (targetUser.role === "owner") {
      throw new ForbiddenError("The primary organization owner cannot be removed.");
    }

    withTransaction(() => {
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(targetId);
      db.prepare("DELETE FROM users WHERE id = ?").run(targetId);
    });

    return NextResponse.json({ success: true, message: "Team member removed successfully." });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to edit team members.");
    }

    const body = await req.json().catch(() => ({}));
    const targetId = typeof body.id === "string" ? body.id.trim() : "";
    const newName = typeof body.name === "string" ? body.name.trim() : undefined;
    const newRole = typeof body.role === "string" ? body.role.trim() : undefined;

    if (!targetId) {
      throw new ValidationError("Team member ID is required.");
    }

    const callerRow = db
      .prepare("SELECT role FROM users WHERE id = ?")
      .get(user.userId) as { role: string } | undefined;

    const isCallerOwner = callerRow?.role === "owner";
    const isCallerAdmin = callerRow?.role === "admin";
    const isSelf = targetId === user.userId;

    // Permissions check:
    // Only organization owners or administrators can edit other team members.
    // Regular subusers can only update their own profile name.
    if (!isCallerOwner && !isCallerAdmin && !isSelf) {
      throw new ForbiddenError("Only organization owners or administrators can edit team members.");
    }

    const targetUser = db
      .prepare("SELECT id, name, email, role, can_edit_company_templates, organization_id, created_at FROM users WHERE id = ? AND organization_id = ?")
      .get(targetId, user.orgId) as {
        id: string;
        name: string;
        email: string;
        role: string;
        can_edit_company_templates?: number;
        organization_id: string;
        created_at: string;
      } | undefined;

    if (!targetUser) {
      throw new ValidationError("Team member not found in your organization.");
    }

    // Role modification enforcement:
    // 1. Subusers cannot update their role by themselves under any circumstances.
    // 2. Only the organization owner can change member roles.
    if (newRole !== undefined && newRole !== targetUser.role) {
      if (isSelf) {
        throw new ForbiddenError("You cannot update your own role. Subusers cannot change their own role; only the organization owner can change roles.");
      }
      if (!isCallerOwner) {
        throw new ForbiddenError("Only the organization owner can change member roles. Subusers cannot update roles.");
      }
      if (targetUser.role === "owner") {
        throw new ForbiddenError("The primary organization owner's role cannot be changed.");
      }
      const allowedRoles = ["admin", "receptionist", "viewer"];
      if (!allowedRoles.includes(newRole)) {
        throw new ValidationError("Invalid role. Allowed roles: Administrator, Receptionist, Viewer.");
      }
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(newRole, targetId);
      targetUser.role = newRole;
    }

    // Name update
    if (newName !== undefined) {
      if (newName.length < 2) {
        throw new ValidationError("Staff member name must be at least 2 characters.");
      }
      db.prepare("UPDATE users SET name = ? WHERE id = ?").run(newName, targetId);
      targetUser.name = newName;
    }

    // Template editing permissions
    if (body.canEditCompanyTemplates !== undefined) {
      if (isSelf && !isCallerOwner && !isCallerAdmin) {
        throw new ForbiddenError("You cannot modify your own template editing permissions.");
      }
      if (!isCallerOwner && !isCallerAdmin) {
        throw new ForbiddenError("Only organization owners or administrators can manage template permissions.");
      }
      const allowed = body.canEditCompanyTemplates ? 1 : 0;
      db.prepare("UPDATE users SET can_edit_company_templates = ? WHERE id = ?").run(allowed, targetId);
      targetUser.can_edit_company_templates = allowed;
    }

    return NextResponse.json({
      success: true,
      member: {
        id: targetUser.id,
        organizationId: targetUser.organization_id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        can_edit_company_templates: Boolean(targetUser.can_edit_company_templates || targetUser.role === "owner" || targetUser.role === "admin"),
        createdAt: targetUser.created_at,
      },
      message: "Team member updated successfully.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
