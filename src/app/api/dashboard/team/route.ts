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
        SELECT id, organization_id, email, name, role, created_at
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
        INSERT INTO users (id, organization_id, email, name, password_hash, salt, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newUserId, user.orgId, email, name, hash, salt, role, nowIso);

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

    const callerRow = db
      .prepare("SELECT role FROM users WHERE id = ?")
      .get(user.userId) as { role: string } | undefined;
    if (callerRow?.role !== "owner" && callerRow?.role !== "admin") {
      throw new ForbiddenError("Only organization owners or administrators can edit team members.");
    }

    const body = await req.json().catch(() => ({}));
    const targetId = typeof body.id === "string" ? body.id.trim() : "";
    const newName = typeof body.name === "string" ? body.name.trim() : undefined;
    const newRole = typeof body.role === "string" ? body.role.trim() : undefined;

    if (!targetId) {
      throw new ValidationError("Team member ID is required.");
    }

    const targetUser = db
      .prepare("SELECT id, name, email, role, organization_id, created_at FROM users WHERE id = ? AND organization_id = ?")
      .get(targetId, user.orgId) as {
        id: string;
        name: string;
        email: string;
        role: string;
        organization_id: string;
        created_at: string;
      } | undefined;

    if (!targetUser) {
      throw new ValidationError("Team member not found in your organization.");
    }

    if (newName !== undefined) {
      if (newName.length < 2) {
        throw new ValidationError("Staff member name must be at least 2 characters.");
      }
      db.prepare("UPDATE users SET name = ? WHERE id = ?").run(newName, targetId);
      targetUser.name = newName;
    }

    if (newRole !== undefined) {
      const allowedRoles = ["admin", "receptionist", "viewer"];
      if (!allowedRoles.includes(newRole)) {
        throw new ValidationError("Invalid role. Allowed roles: Administrator, Receptionist, Viewer.");
      }
      if (targetUser.role === "owner") {
        throw new ForbiddenError("The primary organization owner's role cannot be changed.");
      }
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(newRole, targetId);
      targetUser.role = newRole;
    }

    return NextResponse.json({
      success: true,
      member: {
        id: targetUser.id,
        organizationId: targetUser.organization_id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        createdAt: targetUser.created_at,
      },
      message: "Team member updated successfully.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
