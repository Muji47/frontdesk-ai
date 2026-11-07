import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dashboardEventBus, type RealtimeDashboardEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

// Cap concurrent HTTP/1.1 SSE streams per org so multiple browser tabs can never exhaust Chrome's 6-socket origin pool
const MAX_SSE_STREAMS_PER_ORG = 2;
const globalForSsePool = globalThis as unknown as {
  __activeSseStreams?: Map<string, Set<() => void>>;
};
const activeSseStreams = globalForSsePool.__activeSseStreams ?? new Map<string, Set<() => void>>();
globalForSsePool.__activeSseStreams = activeSseStreams;

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

  let orgStreams = activeSseStreams.get(orgId);
  if (!orgStreams) {
    orgStreams = new Set();
    activeSseStreams.set(orgId, orgStreams);
  }

  // Evict oldest SSE connection(s) if browser opened multiple tabs over HTTP/1.1
  while (orgStreams.size >= MAX_SSE_STREAMS_PER_ORG) {
    const oldestClose = orgStreams.values().next().value;
    if (oldestClose) {
      orgStreams.delete(oldestClose);
      oldestClose();
    } else {
      break;
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let unsubscribe: (() => void) | null = null;

      const closeStream = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        orgStreams?.delete(closeStream);
        try {
          controller.close();
        } catch {}
      };

      orgStreams!.add(closeStream);

      // 1. Send initial connection greeting
      const initPayload = JSON.stringify({
        type: "connected",
        orgId,
        message: "Real-time socket channel established for " + user.orgName,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`data: ${initPayload}\n\n`));

      // 2. Heartbeat interval to keep connection alive through load balancers/proxies
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closeStream();
        }
      }, 15000);

      // 3. Subscribe to real-time events scoped strictly to this organization
      unsubscribe = dashboardEventBus.subscribeOrg(orgId, (event: RealtimeDashboardEvent) => {
        try {
          const payload = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          closeStream();
        }
      });

      // 4. Clean up listener and timer on client abort/disconnect
      req.signal.addEventListener("abort", closeStream);
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
