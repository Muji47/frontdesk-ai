import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { IntegrationService } from "@/server/services/integration.service";
import { handleApiError, UnauthorizedError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to test integrations.");
    }

    const body = await req.json().catch(() => ({}));
    const { provider, config } = body;

    if (!provider) {
      return NextResponse.json({ success: false, message: "Provider is required." }, { status: 400 });
    }

    const result = await IntegrationService.testConnection(user.orgId, provider, config);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
