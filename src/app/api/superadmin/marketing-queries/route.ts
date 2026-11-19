import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ForbiddenError, UnauthorizedError, ValidationError, handleApiError } from "@/server/errors";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in.");
    }
    if (!user.isSuperadmin && user.role !== "superadmin" && !user.impersonatedBy) {
      throw new ForbiddenError("Platform superadmin privileges required.");
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    // If requesting details/transcript for a single conversation:
    if (conversationId) {
      const conv = db
        .prepare(`
          SELECT c.id, c.organization_id, c.visitor_name, c.visitor_contact, c.status, c.resolution_badge, c.created_at, c.last_activity_at as updated_at,
                 o.name as organization_name, o.industry as organization_industry
          FROM conversations c
          JOIN organizations o ON c.organization_id = o.id
          WHERE c.id = ?
        `)
        .get(conversationId) as any;

      if (!conv) {
        return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
      }

      const messages = db
        .prepare(`
          SELECT id, sender, content, created_at
          FROM messages
          WHERE conversation_id = ?
          ORDER BY created_at ASC
        `)
        .all(conversationId) as any[];

      return NextResponse.json({
        success: true,
        conversation: conv,
        messages,
      });
    }

    // 1. Fetch Contact Inquiries
    const inquiries = db
      .prepare(`
        SELECT id, name, email, business, industry, website, message, source, status, created_at
        FROM marketing_inquiries
        ORDER BY created_at DESC
        LIMIT 100
      `)
      .all() as any[];

    // 2. Fetch Marketing & Demo Live Chats
    const marketingChats = db
      .prepare(`
        SELECT 
          c.id,
          c.organization_id,
          c.visitor_name,
          c.visitor_contact,
          c.status,
          c.resolution_badge,
          c.created_at,
          c.last_activity_at as updated_at,
          o.name as organization_name,
          o.industry as organization_industry,
          (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
          (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
        FROM conversations c
        JOIN organizations o ON c.organization_id = o.id
        WHERE c.organization_id IN ('org_echo_sales', 'org_demo_101', 'org_demo_ecom', 'org_demo_realestate', 'org_demo_beauty')
        ORDER BY c.last_activity_at DESC
        LIMIT 50
      `)
      .all() as any[];

    // 3. Compute KPI stats
    const totalInquiries = inquiries.length;
    const newInquiries = inquiries.filter((inq) => inq.status === "new").length;
    const totalMarketingChats = marketingChats.length;
    const totalMarketingMessages = marketingChats.reduce((acc, c) => acc + (c.message_count || 0), 0);

    return NextResponse.json({
      success: true,
      inquiries,
      marketingChats,
      stats: {
        totalInquiries,
        newInquiries,
        totalMarketingChats,
        totalMarketingMessages,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in.");
    }
    if (!user.isSuperadmin && user.role !== "superadmin" && !user.impersonatedBy) {
      throw new ForbiddenError("Platform superadmin privileges required.");
    }

    const body = await req.json().catch(() => ({}));
    const inquiryId = typeof body.inquiryId === "string" ? body.inquiryId.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";

    if (!inquiryId || !status) {
      throw new ValidationError("Inquiry ID and new status are required.");
    }

    const validStatuses = ["new", "contacted", "qualified", "closed"];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Status must be one of: ${validStatuses.join(", ")}`);
    }

    const result = db
      .prepare(`
        UPDATE marketing_inquiries
        SET status = ?
        WHERE id = ?
      `)
      .run(status, inquiryId);

    if (result.changes === 0) {
      return NextResponse.json({ success: false, error: "Inquiry not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Inquiry status updated to ${status}.`,
      updated: { id: inquiryId, status },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
