import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardService } from "@/server/services/dashboard.service";
import { handleApiError, UnauthorizedError, ValidationError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to approve questions.");
    }

    const body = await req.json().catch(() => ({}));
    if (!body.questionId || typeof body.questionId !== "string") {
      throw new ValidationError("Valid questionId is required.");
    }
    if (!body.approvedAnswer || typeof body.approvedAnswer !== "string") {
      throw new ValidationError("Valid approvedAnswer text is required.");
    }

    DashboardService.approveQuestion(body.questionId, user.orgId, body.approvedAnswer, user.userId);

    return NextResponse.json({ success: true, message: "Question approved and indexed." }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
