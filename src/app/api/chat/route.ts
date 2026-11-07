import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardService } from "@/server/services/dashboard.service";
import { handleApiError, ValidationError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.message || typeof body.message !== "string") {
      throw new ValidationError("Valid message text is required.");
    }

    // Default to the active organization from session if available, or demo organization
    const user = await getCurrentUser();
    const orgId = body.orgId || user?.orgId || "org_demo_101";

    const result = DashboardService.handleVisitorChat({
      orgId,
      conversationId: body.conversationId,
      message: body.message,
      visitorName: body.visitorName,
      visitorContact: body.visitorContact,
      pageContext: body.pageContext,
    });

    return NextResponse.json(
      { success: true, ...result },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
