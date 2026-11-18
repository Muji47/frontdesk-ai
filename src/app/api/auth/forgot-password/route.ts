import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { handleApiError, ValidationError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError("A valid email address is required.");
    }

    const userRow = db
      .prepare("SELECT id, name, email FROM users WHERE lower(email) = ?")
      .get(email) as { id: string; name: string; email: string } | undefined;

    let devUrl: string | undefined = undefined;

    if (userRow) {
      // Invalidate existing unused reset tokens for this user
      db.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND type = 'reset'").run(userRow.id);

      const tokenId = "tok_" + randomBytes(8).toString("hex");
      const token = "rst_" + randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      db.prepare(`
        INSERT INTO auth_tokens (id, user_id, email, token, type, expires_at)
        VALUES (?, ?, ?, ?, 'reset', ?)
      `).run(tokenId, userRow.id, userRow.email, token, expiresAt);

      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3001";
      const proto = req.headers.get("x-forwarded-proto") || "http";
      const origin = `${proto}://${host}`;
      const resetUrl = `${origin}/reset-password?token=${token}`;
      devUrl = resetUrl;

      await sendPasswordResetEmail({
        toEmail: userRow.email,
        toName: userRow.name,
        resetUrl,
      });
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists with that email address, a password reset link has been dispatched.",
      devUrl, // available for testing/dev environments
    });
  } catch (err) {
    return handleApiError(err);
  }
}
