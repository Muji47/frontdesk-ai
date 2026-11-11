import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { IntegrationService } from "@/server/services/integration.service";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider, config } = body;
  if (!provider) {
    return NextResponse.json({ success: false, error: "Provider is required" }, { status: 400 });
  }

  const result = await IntegrationService.testConnection(user.orgId, provider, config);

  return NextResponse.json({
    success: result.success,
    result,
  });
}
