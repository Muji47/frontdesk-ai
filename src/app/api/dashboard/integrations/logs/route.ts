import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { IntegrationService } from "@/server/services/integration.service";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

  const logs = IntegrationService.getDeliveryLogs(user.orgId, limit);

  return NextResponse.json({
    success: true,
    logs,
  });
}
