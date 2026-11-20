import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AuthService, type AuthSessionUser } from "@/server/services/auth.service";

export const SESSION_COOKIE_NAME = "echo_session";
export const LEGACY_SESSION_COOKIE_NAME = "frontdesk_session";
export const SHADOW_ADMIN_COOKIE_NAME = "echo_shadow_admin";

export type UserSession = AuthSessionUser;

/**
 * Server-side helper to get the currently authenticated user from incoming cookies.
 * Safe to call in Server Components, Route Handlers, and Server Actions.
 */
export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value || cookieStore.get(LEGACY_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  return AuthService.getSessionUser(token);
}

export async function getShadowAdminToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SHADOW_ADMIN_COOKIE_NAME)?.value || null;
}

export function setSessionCookie(resCookies: NextResponse["cookies"], token: string, expiresAt: Date) {
  resCookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export function setShadowAdminCookie(resCookies: NextResponse["cookies"], token: string) {
  resCookies.set({
    name: SHADOW_ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h
    path: "/",
  });
}

export function clearShadowAdminCookie(resCookies: NextResponse["cookies"]) {
  resCookies.set({
    name: SHADOW_ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
}

export function clearSessionCookie(resCookies: NextResponse["cookies"]) {
  resCookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
  resCookies.set({
    name: LEGACY_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
}
