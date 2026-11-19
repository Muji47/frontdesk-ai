import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardService } from "@/server/services/dashboard.service";
import { handleApiError, UnauthorizedError, ForbiddenError } from "@/server/errors";

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to update agent settings.");
    }
    if (user.role !== "owner" && user.role !== "admin") {
      throw new ForbiddenError("Only Practice Owners and Administrators have permission to modify AI Receptionist instructions.");
    }

    const body = await req.json().catch(() => ({}));
    DashboardService.updateAgent(user.orgId, {
      name: body.name,
      greeting: body.greeting,
      color: body.color,
      tone: body.tone,
    });

    return NextResponse.json({ success: true, message: "Agent settings updated." }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
