import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardService } from "@/server/services/dashboard.service";
import { handleApiError, UnauthorizedError, ValidationError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to delete knowledge sources.");
    }

    const body = await req.json().catch(() => ({}));
    if (!body.id || typeof body.id !== "string") {
      throw new ValidationError("Valid source id is required.");
    }

    DashboardService.deleteKnowledgeSource(user.orgId, body.id);

    return NextResponse.json({ success: true, message: "Source deleted." }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
