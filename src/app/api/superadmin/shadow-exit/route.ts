import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, setSessionCookie, clearShadowAdminCookie, getShadowAdminToken, SESSION_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";
import { AuthService } from "@/server/services/auth.service";
import { ForbiddenError, UnauthorizedError, handleApiError } from "@/server/errors";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const shadowAdminToken = await getShadowAdminToken();

    if (!user?.impersonatedBy && !shadowAdminToken) {
      throw new ForbiddenError("No active shadow login session found to exit.");
    }

    const cookieStore = await cookies();
    const currentShadowToken = cookieStore.get(SESSION_COOKIE_NAME)?.value || cookieStore.get(LEGACY_SESSION_COOKIE_NAME)?.value;

    // Revoke the temporary shadow session
    if (currentShadowToken) {
      AuthService.revokeSession(currentShadowToken);
    }

    // Determine the superadmin to restore
    let superadminUserId = user?.impersonatedBy?.userId;

    if (!superadminUserId && shadowAdminToken) {
      const adminSessionUser = AuthService.getSessionUser(shadowAdminToken);
      if (adminSessionUser && (adminSessionUser.isSuperadmin || adminSessionUser.role === "superadmin")) {
        superadminUserId = adminSessionUser.userId;
      }
    }

    if (!superadminUserId) {
      // Find default superadmin
      const defaultAdmin = db.prepare("SELECT id FROM users WHERE is_superadmin = 1 OR role = 'superadmin' LIMIT 1").get() as { id: string } | undefined;
      superadminUserId = defaultAdmin?.id;
    }

    if (!superadminUserId) {
      throw new UnauthorizedError("Could not locate original platform superadmin account.");
    }

    // Create a fresh clean session for the superadmin
    const { token: newAdminToken, expiresAt } = AuthService.createSession(superadminUserId);

    const res = NextResponse.json({
      success: true,
      message: "Shadow login exited successfully. Returned to Superadmin Command Center.",
      redirectUrl: "/superadmin",
    });

    setSessionCookie(res.cookies, newAdminToken, expiresAt);
    clearShadowAdminCookie(res.cookies);

    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
