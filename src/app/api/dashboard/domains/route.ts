import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardService } from "@/server/services/dashboard.service";
import { parseAllowedDomains } from "@/lib/domain-security";
import { handleApiError, UnauthorizedError, ForbiddenError } from "@/server/errors";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to view domain security settings.");
    }

    const row = db
      .prepare("SELECT allowed_domains FROM organizations WHERE id = ?")
      .get(user.orgId) as { allowed_domains?: string } | undefined;

    const domains = parseAllowedDomains(row?.allowed_domains ?? "*");

    return NextResponse.json(
      {
        success: true,
        allowedDomains: domains,
        isPermissive: domains.includes("*"),
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to update domain settings.");
    }
    if (user.role !== "owner" && user.role !== "admin") {
      throw new ForbiddenError("Only Practice Owners and Administrators have permission to modify domain security.");
    }

    const body = await req.json().catch(() => ({}));
    const rawDomains = Array.isArray(body.domains)
      ? body.domains
      : typeof body.domains === "string"
      ? [body.domains]
      : [];

    const updated = DashboardService.updateAllowedDomains(user.orgId, rawDomains);

    return NextResponse.json(
      {
        success: true,
        allowedDomains: updated,
        isPermissive: updated.includes("*"),
        message: updated.includes("*")
          ? "Domain whitelisting is in permissive mode (allows all origins)."
          : `Whitelisted ${updated.length} domain(s) for widget embeds.`,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
