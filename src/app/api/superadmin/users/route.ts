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

    const users = db.prepare(`
      SELECT 
        u.id,
        u.organization_id,
        u.email,
        u.name,
        u.role,
        u.is_superadmin,
        u.can_edit_company_templates,
        u.created_at,
        o.name as organization_name,
        o.industry as organization_industry,
        o.plan as organization_plan
      FROM users u
      JOIN organizations o ON u.organization_id = o.id
      ORDER BY u.created_at DESC
    `).all();

    return NextResponse.json({
      success: true,
      data: {
        users,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
