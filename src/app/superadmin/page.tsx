import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import SuperadminClient from "./SuperadminClient";

export const metadata: Metadata = {
  title: "Superadmin Command Center — Echo.ai",
  description: "Platform owner console for managing all organizations, accounts, and shadow login.",
};

export default async function SuperadminPage() {
  const user = await getCurrentUser();

  if (!user || (!user.isSuperadmin && user.role !== "superadmin")) {
    redirect("/login?error=superadmin_required");
  }

  return <SuperadminClient currentUser={user} />;
}
