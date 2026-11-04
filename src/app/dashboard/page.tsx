import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { DashboardService } from "@/server/services/dashboard.service";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard — Echo.ai",
  description: "Echo.ai virtual receptionist management dashboard.",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const initialData = DashboardService.getDashboardData(user.orgId, user.industry);

  return <DashboardClient user={user} initialData={initialData} />;
}
