import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DashboardService } from "@/server/services/dashboard.service";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const initialData = DashboardService.getDashboardData(user.orgId, user.industry);

  return <DashboardClient user={user} initialData={initialData} />;
}
