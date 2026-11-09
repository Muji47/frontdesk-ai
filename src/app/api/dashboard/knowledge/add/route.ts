import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardService } from "@/server/services/dashboard.service";
import { handleApiError, UnauthorizedError, ValidationError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to add knowledge sources.");
    }

    const body = await req.json().catch(() => ({}));
    if (!body.title || typeof body.title !== "string") {
      throw new ValidationError("Valid source title or URL is required.");
    }

    const sourceType = ["url", "pdf", "document", "manual_qa"].includes(body.sourceType)
      ? body.sourceType
      : "url";

    const source = await DashboardService.addKnowledgeSource(
      user.orgId,
      body.title,
      sourceType,
      body.sourceUrl,
      body.pageCount || (sourceType === "url" ? 12 : 1),
      typeof body.content === "string" ? body.content : typeof body.answer === "string" ? body.answer : undefined
    );

    return NextResponse.json({ success: true, source }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
