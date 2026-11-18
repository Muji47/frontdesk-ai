import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatRoleTitle } from "@/lib/email";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { success: false, valid: false, error: "Missing verification token." },
      { status: 400 }
    );
  }

  const tokenRow = db
    .prepare(`
      SELECT t.id, t.user_id, t.email, t.type, t.expires_at, t.used_at,
             u.name as user_name, u.role as user_role,
             o.name as org_name
      FROM auth_tokens t
      LEFT JOIN users u ON u.id = t.user_id
      LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE t.token = ?
    `)
    .get(token) as {
      id: string;
      user_id: string;
      email: string;
      type: string;
      expires_at: string;
      used_at: string | null;
      user_name: string | null;
      user_role: string | null;
      org_name: string | null;
    } | undefined;

  if (!tokenRow) {
    return NextResponse.json(
      { success: false, valid: false, error: "Invalid link. Please check the URL or request a new one." },
      { status: 404 }
    );
  }

  if (tokenRow.used_at) {
    return NextResponse.json(
      { success: false, valid: false, error: "This link has already been used. Please sign in or request a new link." },
      { status: 410 }
    );
  }

  const now = new Date();
  const expiry = new Date(tokenRow.expires_at);
  if (now > expiry) {
    return NextResponse.json(
      { success: false, valid: false, error: "This link has expired. Please request a fresh invitation or reset link." },
      { status: 410 }
    );
  }

  return NextResponse.json({
    success: true,
    valid: true,
    data: {
      email: tokenRow.email,
      name: tokenRow.user_name || "",
      role: formatRoleTitle(tokenRow.user_role || "receptionist"),
      orgName: tokenRow.org_name || "Echo.ai Workspace",
      type: tokenRow.type,
    },
  });
}
