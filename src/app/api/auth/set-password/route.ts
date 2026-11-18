import { NextRequest, NextResponse } from "next/server";
import { db, hashPassword, withTransaction } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { AuthService } from "@/server/services/auth.service";
import { handleApiError, ValidationError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const password = String(body.password || "").trim();

    if (!token) {
      throw new ValidationError("Missing authentication token.");
    }

    if (!password || password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters long.");
    }

    const tokenRow = db
      .prepare(`
        SELECT id, user_id, email, type, expires_at, used_at
        FROM auth_tokens
        WHERE token = ?
      `)
      .get(token) as {
        id: string;
        user_id: string;
        email: string;
        type: string;
        expires_at: string;
        used_at: string | null;
      } | undefined;

    if (!tokenRow) {
      throw new ValidationError("Invalid link. Please check your URL or request a new one.");
    }

    if (tokenRow.used_at) {
      throw new ValidationError("This link has already been used. Please sign in or request a new link.");
    }

    if (new Date() > new Date(tokenRow.expires_at)) {
      throw new ValidationError("This link has expired. Please request a fresh invitation or reset link.");
    }

    // Hash the new password securely
    const { hash, salt } = hashPassword(password);
    const nowIso = new Date().toISOString();

    withTransaction(() => {
      // 1. Update user password credentials
      db.prepare(`
        UPDATE users
        SET password_hash = ?, salt = ?
        WHERE id = ?
      `).run(hash, salt, tokenRow.user_id);

      // 2. Mark token as consumed
      db.prepare(`
        UPDATE auth_tokens
        SET used_at = ?
        WHERE id = ?
      `).run(nowIso, tokenRow.id);

      // 3. Clear any other unused tokens for this user
      db.prepare(`
        DELETE FROM auth_tokens
        WHERE user_id = ? AND id != ? AND used_at IS NULL
      `).run(tokenRow.user_id, tokenRow.id);
    });

    // Automatically authenticate the user so they land directly in their workspace
    const { token: sessionToken, expiresAt } = AuthService.createSession(tokenRow.user_id);

    const res = NextResponse.json({
      success: true,
      message: tokenRow.type === "invite"
        ? "Account activated and password set successfully! Redirecting to your dashboard..."
        : "Password reset successfully! Redirecting to your dashboard...",
    });

    setSessionCookie(res.cookies, sessionToken, expiresAt);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
