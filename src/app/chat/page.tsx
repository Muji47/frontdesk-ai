import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

interface ChatPageSearchParams {
  searchParams: Promise<{ orgId?: string; org?: string }>;
}

export default async function ChatFallbackPage({ searchParams }: ChatPageSearchParams) {
  const params = await searchParams;
  const orgId = params.orgId || params.org;

  if (orgId) {
    redirect(`/chat/${encodeURIComponent(orgId)}`);
  }

  const user = await getCurrentUser();
  if (user?.orgId) {
    redirect(`/chat/${encodeURIComponent(user.orgId)}`);
  }

  // Fallback to demo receptionist
  redirect("/chat/org_demo_101");
}
