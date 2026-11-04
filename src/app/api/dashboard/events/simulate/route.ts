import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { db, withTransaction } from "@/lib/db";
import { dashboardEventBus, type RealtimeDashboardEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const orgId = user.orgId;
  const isEcom = user.industry === "ecommerce";

  let body: { eventType?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const scenarios = [
    {
      type: "new_conversation",
      title: "New Incoming Inquirer",
      icon: "💬",
      targetTab: "inbox" as const,
      visitorName: isEcom ? "Jordan Taylor" : "Sophie Bennett",
      visitorContact: isEcom ? "jordan.t@gmail.com" : "+61 412 884 921",
      question: isEcom
        ? "Do you ship international orders to New Zealand, and what are the freight rates?"
        : "Hi, I suffered an ankle strain during football yesterday. Do you have an opening tomorrow afternoon?",
      badge: "AI Active",
      status: "ACTIVE" as const,
    },
    {
      type: "handover_alert",
      title: "🚨 Staff Handover Requested",
      icon: "🙋",
      targetTab: "inbox" as const,
      visitorName: isEcom ? "David Sterling" : "Marcus Fletcher",
      visitorContact: isEcom ? "order-vip@enterprise.com" : "+61 488 230 119",
      question: isEcom
        ? "I need to modify the delivery address on bulk shipment #10944 before customs dispatch. Need a staff member."
        : "I have complex post-surgical rehabilitation guidelines from my orthopedic surgeon. Can clinic staff review?",
      badge: "Human needed",
      status: "WAITING_FOR_HUMAN" as const,
    },
    {
      type: "new_appointment",
      title: isEcom ? "New Wholesale Lead Captured" : "New Confirmed Appointment",
      icon: isEcom ? "📦" : "📅",
      targetTab: isEcom ? "leads" as const : "appointments" as const,
      visitorName: isEcom ? "Apex Retailers Ltd" : "Claire Montgomery",
      visitorContact: isEcom ? "purchasing@apexretail.com" : "+61 403 992 118",
      question: isEcom
        ? "Wholesale bulk inquiry for 500 units submitted via catalog chat widget."
        : "Initial Physio Consultation booked with Dr. Sarah Lee for Tomorrow at 2:30 PM.",
      badge: "AI Resolved",
      status: "RESOLVED" as const,
    },
  ];

  const choice = body.eventType
    ? scenarios.find((s) => s.type === body.eventType) || scenarios[0]
    : scenarios[Math.floor(Math.random() * scenarios.length)];

  const convId = "conv_" + randomBytes(6).toString("hex");
  const msgId = "msg_" + randomBytes(6).toString("hex");
  const nowIso = new Date().toISOString();

  withTransaction(() => {
    // 1. Insert Conversation
    db.prepare(`
      INSERT INTO conversations (
        id, organization_id, visitor_name, visitor_contact, channel, status, resolution_badge, last_message, external_ref, last_activity_at, created_at
      )
      VALUES (?, ?, ?, ?, 'web', ?, ?, ?, NULL, ?, ?)
    `).run(
      convId,
      orgId,
      choice.visitorName,
      choice.visitorContact,
      choice.status,
      choice.badge,
      choice.question,
      nowIso,
      nowIso
    );

    // 2. Insert Visitor Message
    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender, content, created_at)
      VALUES (?, ?, 'client', ?, ?)
    `).run(msgId, convId, choice.question, nowIso);

    // 3. If appointment scenario and not ecom, also insert into appointments
    if (choice.type === "new_appointment" && !isEcom) {
      const apptId = "apt_" + randomBytes(6).toString("hex");
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
      tomorrow.setHours(14, 30, 0, 0);

      db.prepare(`
        INSERT INTO appointments (
          id, organization_id, conversation_id, patient_name, patient_contact, practitioner_name, service_name, start_time, status, source, external_id
        )
        VALUES (?, ?, ?, ?, ?, 'Dr. Sarah Lee', 'Initial Assessment & Treatment', ?, 'confirmed', 'ai_assistant', NULL)
      `).run(
        apptId,
        orgId,
        convId,
        choice.visitorName,
        choice.visitorContact,
        tomorrow.toISOString()
      );
    }
  });

  // 4. Emit to real-time event bus
  const eventPayload = dashboardEventBus.emitToOrg(orgId, {
    type: choice.type as any,
    title: `${choice.title}: ${choice.visitorName}`,
    message: choice.question,
    icon: choice.icon,
    targetTab: choice.targetTab,
    targetId: convId,
    data: {
      id: convId,
      conversationId: convId,
      visitorName: choice.visitorName,
      visitorContact: choice.visitorContact,
      channel: "web",
      status: choice.status,
      badge: choice.badge,
      lastMessage: choice.question,
      timeAgo: "just now",
      messages: [
        {
          id: msgId,
          sender: "client",
          content: choice.question,
          createdAt: nowIso,
        },
      ],
    },
  });

  return NextResponse.json({
    success: true,
    simulatedEvent: eventPayload,
    conversationId: convId,
  });
}
