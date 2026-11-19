import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ForbiddenError, UnauthorizedError, handleApiError } from "@/server/errors";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in.");
    }
    if (!user.isSuperadmin && user.role !== "superadmin") {
      throw new ForbiddenError("Platform superadmin privileges required.");
    }

    const organizations = db.prepare(`
      SELECT 
        o.id,
        o.name,
        o.industry,
        o.plan,
        o.allow_subuser_template_editing,
        o.created_at,
        u.id as owner_id,
        u.name as owner_name,
        u.email as owner_email,
        a.id as agent_id,
        a.name as agent_name,
        a.greeting as agent_greeting,
        a.color as agent_color,
        (SELECT COUNT(*) FROM users u2 WHERE u2.organization_id = o.id) as member_count,
        (SELECT COUNT(*) FROM conversations c WHERE c.organization_id = o.id) as conversation_count,
        (SELECT COUNT(*) FROM appointments ap WHERE ap.organization_id = o.id) as appointment_count
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'owner'
      LEFT JOIN agents a ON a.organization_id = o.id
      ORDER BY o.created_at DESC
    `).all();

    return NextResponse.json({
      success: true,
      data: {
        organizations,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
