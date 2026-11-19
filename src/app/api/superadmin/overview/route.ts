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

    // 1. Total Organizations
    const orgsCountRow = db.prepare("SELECT COUNT(*) as count FROM organizations").get() as { count: number };
    const totalOrganizations = orgsCountRow?.count || 0;

    // 2. Total Users
    const usersCountRow = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    const totalUsers = usersCountRow?.count || 0;

    // 3. Total Conversations
    const convCountRow = db.prepare("SELECT COUNT(*) as count FROM conversations").get() as { count: number };
    const totalConversations = convCountRow?.count || 0;

    // 4. Total Messages
    const msgCountRow = db.prepare("SELECT COUNT(*) as count FROM messages").get() as { count: number };
    const totalMessages = msgCountRow?.count || 0;

    // 5. Total Appointments
    const apptCountRow = db.prepare("SELECT COUNT(*) as count FROM appointments").get() as { count: number };
    const totalAppointments = apptCountRow?.count || 0;

    // 6. Total Leads
    const leadsCountRow = db.prepare("SELECT COUNT(*) as count FROM leads").get() as { count: number };
    const totalLeads = leadsCountRow?.count || 0;

    // 7. Calculate MRR based on plans
    const planRows = db.prepare("SELECT plan, COUNT(*) as count FROM organizations GROUP BY plan").all() as Array<{ plan: string; count: number }>;
    let estimatedMRR = 0;
    planRows.forEach((p) => {
      const planName = (p.plan || "").toLowerCase();
      if (planName === "pro" || planName === "enterprise") estimatedMRR += p.count * 199;
      else if (planName === "growth") estimatedMRR += p.count * 99;
      else estimatedMRR += p.count * 39; // Starter
    });

    // 8. Recent Organizations (with owner details)
    const recentOrgs = db.prepare(`
      SELECT 
        o.id,
        o.name,
        o.industry,
        o.plan,
        o.created_at,
        u.name as owner_name,
        u.email as owner_email,
        (SELECT COUNT(*) FROM conversations c WHERE c.organization_id = o.id) as conversation_count,
        (SELECT COUNT(*) FROM users u2 WHERE u2.organization_id = o.id) as member_count
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'owner'
      ORDER BY o.created_at DESC
      LIMIT 8
    `).all();

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalOrganizations,
          totalUsers,
          totalConversations,
          totalMessages,
          totalAppointments,
          totalLeads,
          estimatedMRR,
        },
        recentOrgs,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
