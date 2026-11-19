import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { IntegrationService } from "@/server/services/integration.service";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const integrations = IntegrationService.getIntegrations(user.orgId);
  const deliveryLogs = IntegrationService.getDeliveryLogs(user.orgId, 25);

  return NextResponse.json({
    success: true,
    integrations,
    deliveryLogs,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Access denied. Only Practice Owners and Administrators can modify integration configurations." },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider, config, status } = body;
  if (!provider) {
    return NextResponse.json({ success: false, error: "Provider is required" }, { status: 400 });
  }

  try {
    const updated = IntegrationService.saveIntegration(
      user.orgId,
      provider,
      config || {},
      status || "connected"
    );

    return NextResponse.json({
      success: true,
      integration: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to save integration" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");

  if (!provider) {
    return NextResponse.json({ success: false, error: "Provider parameter is required" }, { status: 400 });
  }

  const deleted = IntegrationService.deleteIntegration(user.orgId, provider);

  return NextResponse.json({
    success: true,
    deleted,
  });
}
