import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, setSessionCookie, setShadowAdminCookie, SESSION_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";
import { AuthService } from "@/server/services/auth.service";
import { ForbiddenError, UnauthorizedError, ValidationError, handleApiError } from "@/server/errors";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser();
    if (!caller) {
      throw new UnauthorizedError("You must be logged in to initiate shadow login.");
    }
    if (!caller.isSuperadmin && caller.role !== "superadmin" && !caller.impersonatedBy) {
      throw new ForbiddenError("Only platform superadmins can initiate shadow login.");
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
    const targetOrgId = typeof body.targetOrgId === "string" ? body.targetOrgId.trim() : "";

    if (!targetUserId && !targetOrgId) {
      throw new ValidationError("Target user ID or target organization ID is required for shadow login.");
    }

    // Find the target user to impersonate
    let targetUser: { id: string; email: string; name: string; role: string; organization_id: string } | undefined;

    if (targetUserId) {
      targetUser = db
        .prepare("SELECT id, email, name, role, organization_id FROM users WHERE id = ?")
        .get(targetUserId) as typeof targetUser;
    } else if (targetOrgId) {
      // Prioritize the owner of the organization
      targetUser = db
        .prepare("SELECT id, email, name, role, organization_id FROM users WHERE organization_id = ? AND role = 'owner' LIMIT 1")
        .get(targetOrgId) as typeof targetUser;

      // Fallback to any user in the organization if no owner exists
      if (!targetUser) {
        targetUser = db
          .prepare("SELECT id, email, name, role, organization_id FROM users WHERE organization_id = ? LIMIT 1")
          .get(targetOrgId) as typeof targetUser;
      }
    }

    if (!targetUser) {
      throw new ValidationError("Target account for shadow login was not found.");
    }

    // Fetch the target organization details
    const org = db
      .prepare("SELECT id, name, industry, plan FROM organizations WHERE id = ?")
      .get(targetUser.organization_id) as { id: string; name: string; industry: string; plan: string } | undefined;

    const realSuperadminId = caller.impersonatedBy?.userId || caller.userId;

    // Get current superadmin session token to preserve for return
    const cookieStore = await cookies();
    const currentAdminToken = cookieStore.get(SESSION_COOKIE_NAME)?.value || cookieStore.get(LEGACY_SESSION_COOKIE_NAME)?.value || "";

    // Create the shadow session
    const { token: shadowToken, expiresAt: shadowExpiresAt } = AuthService.createShadowSession(
      targetUser.id,
      realSuperadminId
    );

    const res = NextResponse.json({
      success: true,
      message: `Shadow login active: now viewing as ${targetUser.name} (${targetUser.email}).`,
      impersonating: {
        userId: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        organizationId: targetUser.organization_id,
        organizationName: org?.name || "Practice",
      },
      redirectUrl: "/dashboard",
    });

    // Set shadow session cookie as the active session
    setSessionCookie(res.cookies, shadowToken, shadowExpiresAt);

    // Save superadmin session token in shadow cookie for quick restoration
    if (currentAdminToken && !caller.impersonatedBy) {
      setShadowAdminCookie(res.cookies, currentAdminToken);
    }

    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
