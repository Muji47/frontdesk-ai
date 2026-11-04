import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardService } from "@/server/services/dashboard.service";
import { handleApiError, UnauthorizedError, ValidationError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to test knowledge base.");
    }

    const body = await req.json().catch(() => ({}));
    if (!body.query || typeof body.query !== "string") {
      throw new ValidationError("Valid test question query is required.");
    }

    const result = DashboardService.testKnowledgeQuery(user.orgId, body.query);

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
