import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardService } from "@/server/services/dashboard.service";
import { handleApiError, UnauthorizedError, ValidationError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in.");
    }

    const body = await req.json().catch(() => ({}));
    if (!body.conversationId || typeof body.conversationId !== "string") {
      throw new ValidationError("Valid conversationId is required.");
    }

    const message = DashboardService.simulateCustomerReply(body.conversationId, user.orgId);

    return NextResponse.json({ success: true, message }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
