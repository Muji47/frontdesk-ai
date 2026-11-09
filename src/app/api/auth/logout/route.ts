import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/server/services/auth.service";
import { handleApiError } from "@/server/errors";
import { clearSessionCookie, SESSION_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const legacyToken = cookieStore.get(LEGACY_SESSION_COOKIE_NAME)?.value;

    if (token) {
      AuthService.revokeSession(token);
    }
    if (legacyToken && legacyToken !== token) {
      AuthService.revokeSession(legacyToken);
    }

    const res = NextResponse.json({ success: true });
    clearSessionCookie(res.cookies);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
