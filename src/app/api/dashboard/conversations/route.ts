import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardService } from "@/server/services/dashboard.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = DashboardService.getDashboardData(user.orgId, user.industry);
  return NextResponse.json({
    conversations: data.conversations,
    metrics: data.metrics,
    unansweredQuestions: data.unansweredQuestions,
    knowledgeSources: data.knowledgeSources,
  });
}
