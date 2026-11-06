import { EventEmitter } from "node:events";

export interface RealtimeDashboardEvent {
  type: "new_conversation" | "new_message" | "handover_alert" | "new_appointment" | "new_lead";
  orgId: string;
  timestamp: string;
  title: string;
  message: string;
  targetTab: "inbox" | "overview" | "appointments" | "leads" | "knowledge" | "conversations" | "analytics" | "billing";
  targetId?: string; // conversation ID, appointment ID, etc.
  icon?: string;
  data?: any;
}

class DashboardEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(250);
  }

  public emitToOrg(orgId: string, event: Omit<RealtimeDashboardEvent, "orgId" | "timestamp">): RealtimeDashboardEvent {
    const fullEvent: RealtimeDashboardEvent = {
      ...event,
      orgId,
      timestamp: new Date().toISOString(),
    };
    this.emit(`org:${orgId}`, fullEvent);
    this.emit("all", fullEvent);
    return fullEvent;
  }

  public subscribeOrg(orgId: string, listener: (event: RealtimeDashboardEvent) => void): () => void {
    const channel = `org:${orgId}`;
    this.on(channel, listener);
    return () => {
      this.off(channel, listener);
    };
  }
}

// Global singleton across hot reloads in Next.js development
const globalForEvents = globalThis as unknown as { dashboardEventBus?: DashboardEventBus };
export const dashboardEventBus = globalForEvents.dashboardEventBus || new DashboardEventBus();
if (process.env.NODE_ENV !== "production") {
  globalForEvents.dashboardEventBus = dashboardEventBus;
}
