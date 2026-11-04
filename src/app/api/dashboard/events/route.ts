import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dashboardEventBus, type RealtimeDashboardEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const orgId = user.orgId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connection greeting
      const initPayload = JSON.stringify({
        type: "connected",
        orgId,
        message: "Real-time socket channel established for " + user.orgName,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`data: ${initPayload}\n\n`));

      // 2. Heartbeat interval to keep connection alive through load balancers/proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // 3. Subscribe to real-time events scoped strictly to this organization
      const unsubscribe = dashboardEventBus.subscribeOrg(orgId, (event: RealtimeDashboardEvent) => {
        try {
          const payload = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          unsubscribe();
          clearInterval(heartbeat);
        }
      });

      // 4. Clean up listener and timer on client abort/disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disables response buffering in NGINX
    },
  });
}
