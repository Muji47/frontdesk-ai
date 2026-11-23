import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkOrganizationDomain } from "@/lib/domain-security";
import { handleApiError } from "@/server/errors";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let orgId = searchParams.get("orgId") || searchParams.get("org");
    const agentId = searchParams.get("agentId") || searchParams.get("agent");

    if (!orgId && agentId) {
      const foundAgent = db.prepare("SELECT organization_id FROM agents WHERE id = ?").get(agentId) as { organization_id: string } | undefined;
      if (foundAgent?.organization_id) {
        orgId = foundAgent.organization_id;
      }
    }
    if (!orgId) {
      orgId = "org_demo_101";
    }

    // Enforce Origin & Referer Domain Whitelisting
    const origin = req.headers.get("origin") || req.headers.get("referer");
    const domainCheck = checkOrganizationDomain(orgId, origin);
    if (!domainCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DOMAIN_NOT_ALLOWED",
            message: domainCheck.reason,
          },
        },
        {
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
          },
        }
      );
    }

    const orgRow = db.prepare(`
      SELECT id, name, industry, plan
      FROM organizations
      WHERE id = ?
      LIMIT 1
    `).get(orgId) as { id: string; name: string; industry: string; plan: string } | undefined;

    const agentRow = db.prepare(`
      SELECT id, name, greeting, color, position, tone
      FROM agents
      WHERE organization_id = ?
      LIMIT 1
    `).get(orgId) as { id: string; name: string; greeting: string; color: string; position: string; tone: string } | undefined;

    const isEcom = orgRow?.industry === "ecommerce";

    const defaultChips = isEcom
      ? ["Track My Order", "Shipping Rates", "Return Policy", "Wholesale Bulk Sacks"]
      : ["Book Appointment", "Consultation Fees", "HICAPS Health Funds", "Opening Hours"];

    const config = {
      success: true,
      orgId,
      orgName: orgRow?.name || (isEcom ? "Burewala Rice Mills" : "Healing Hands Physio"),
      industry: orgRow?.industry || "clinic",
      name: agentRow?.name || (isEcom ? "Aria" : "Maya"),
      greeting:
        agentRow?.greeting ||
        (isEcom
          ? "Welcome! I'm Aria, your virtual sales and order assistant. How can I assist you with your order today?"
          : "Hello! I'm Maya, your AI receptionist at Healing Hands Physio. How can I help you with your health and bookings today?"),
      color: agentRow?.color || (isEcom ? "#4f46e5" : "#0d9488"),
      position: agentRow?.position || "right",
      tone: agentRow?.tone || "Friendly",
      chips: defaultChips,
    };

    return NextResponse.json(config, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
