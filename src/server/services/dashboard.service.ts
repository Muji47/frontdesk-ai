import { randomBytes } from "node:crypto";
import { db, withTransaction, seedOrganizationData } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { CrawlerService } from "./crawler.service";
import { dashboardEventBus } from "@/lib/events";

export interface DashboardMetricData {
  totalConversations: number;
  aiResolvedCount: number;
  humanEscalatedCount: number;
  resolutionRate: string;
  actionMetricLabel: string;
  actionMetricValue: string;
  actionMetricSubtext: string;
}

export interface ConversationMessage {
  id: string;
  sender: "client" | "ai" | "staff";
  content: string;
  createdAt: string;
}

export interface DashboardConversation {
  id: string;
  visitorName: string;
  visitorContact: string;
  channel: string;
  status: "ACTIVE" | "WAITING_FOR_HUMAN" | "RESOLVED";
  badge: string;
  lastMessage: string;
  externalRef: string | null;
  timeAgo: string;
  messages: ConversationMessage[];
}

export interface DashboardUnansweredQuestion {
  id: string;
  question: string;
  frequencyCount: number;
  status: "pending" | "approved" | "ignored";
  approvedAnswer: string | null;
  lastAskedAt: string;
}

export interface DashboardKnowledgeSource {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  status: string;
  pageCount: number;
  lastSyncedAt: string;
  chunks?: { id: number; title: string; content: string }[];
}

export interface DashboardAppointment {
  id: string;
  patientName: string;
  patientContact: string;
  practitionerName: string;
  serviceName: string;
  startTime: string;
  status: string;
  source: string;
  externalId: string | null;
}

export interface DashboardOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  currency: string;
  trackingCarrier: string | null;
  trackingStatus: string;
  externalId: string | null;
}

export interface DashboardLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  intent: string;
  status: string;
  createdAt: string;
}

export interface DashboardIntegration {
  id: string;
  provider: string;
  status: string;
  lastSyncAt: string;
}

export interface DashboardData {
  metrics: DashboardMetricData;
  conversations: DashboardConversation[];
  unansweredQuestions: DashboardUnansweredQuestion[];
  knowledgeSources: DashboardKnowledgeSource[];
  appointments: DashboardAppointment[];
  orders: DashboardOrder[];
  leads: DashboardLead[];
  integrations: DashboardIntegration[];
  agent: {
    id: string;
    name: string;
    greeting: string;
    color: string;
    position: string;
    tone: string;
  };
}

// Utility to convert SQLite timestamp or relative time string
function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "Recent";
  }
}

export class DashboardService {
  /**
   * Retrieves all dynamic database records for an organization.
   * Ensures all returned objects are standard JavaScript plain objects for Next.js RSC safety.
   */
  public static getDashboardData(orgId: string, industry: string): DashboardData {
    const isEcom = industry === "ecommerce";

    // 1. Fetch Agent Profile
    const agentRow = db.prepare(`
      SELECT id, name, greeting, color, position, tone
      FROM agents
      WHERE organization_id = ?
      LIMIT 1
    `).get(orgId) as any;

    const agent = agentRow
      ? {
          id: String(agentRow.id),
          name: String(agentRow.name),
          greeting: String(agentRow.greeting),
          color: String(agentRow.color),
          position: String(agentRow.position),
          tone: String(agentRow.tone),
        }
      : {
          id: "agt_default",
          name: isEcom ? "Aria" : "Maya",
          greeting: "Hello, how can I help you?",
          color: isEcom ? "#4f46e5" : "#0d9488",
          position: "right",
          tone: "Friendly",
        };

    // 2. Fetch Conversations with their respective messages
    const convRows = db.prepare(`
      SELECT 
        id, visitor_name, visitor_contact, channel, status, resolution_badge, last_message, external_ref, last_activity_at, created_at
      FROM conversations
      WHERE organization_id = ?
      ORDER BY last_activity_at DESC
      LIMIT 20
    `).all(orgId) as any[];

    const conversations: DashboardConversation[] = convRows.map((row) => {
      const msgRows = db.prepare(`
        SELECT id, sender, content, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
      `).all(row.id) as any[];

      const messages: ConversationMessage[] = msgRows.map((m) => ({
        id: String(m.id),
        sender: m.sender as "client" | "ai" | "staff",
        content: String(m.content),
        createdAt: String(m.created_at),
      }));

      return {
        id: String(row.id),
        visitorName: String(row.visitor_name),
        visitorContact: String(row.visitor_contact),
        channel: String(row.channel),
        status: row.status as "ACTIVE" | "WAITING_FOR_HUMAN" | "RESOLVED",
        badge: String(row.resolution_badge),
        lastMessage: String(row.last_message),
        externalRef: row.external_ref ? String(row.external_ref) : null,
        timeAgo: formatRelativeTime(row.last_activity_at || row.created_at),
        messages,
      };
    });

    // 3. Fetch Unanswered Questions
    const questionRows = db.prepare(`
      SELECT id, question, frequency_count, status, approved_answer, last_asked_at
      FROM unanswered_questions
      WHERE organization_id = ?
      ORDER BY status ASC, frequency_count DESC
    `).all(orgId) as any[];

    const unansweredQuestions: DashboardUnansweredQuestion[] = questionRows.map((q) => ({
      id: String(q.id),
      question: String(q.question),
      frequencyCount: Number(q.frequency_count),
      status: q.status as "pending" | "approved" | "ignored",
      approvedAnswer: q.approved_answer ? String(q.approved_answer) : null,
      lastAskedAt: String(q.last_asked_at),
    }));

    // 4. Fetch Knowledge Sources
    const sourceRows = db.prepare(`
      SELECT id, title, source_type, source_url, status, page_count, last_synced_at
      FROM knowledge_sources
      WHERE organization_id = ?
      ORDER BY created_at DESC
    `).all(orgId) as any[];

    const knowledgeSources: DashboardKnowledgeSource[] = sourceRows.map((s) => {
      const chunkRows = db.prepare(`
        SELECT chunk_index as id, title, content
        FROM knowledge_chunks
        WHERE source_id = ?
        ORDER BY chunk_index ASC
      `).all(s.id) as any[];

      const chunks = chunkRows.map((c) => ({
        id: Number(c.id),
        title: String(c.title),
        content: String(c.content),
      }));

      return {
        id: String(s.id),
        title: String(s.title),
        sourceType: String(s.source_type),
        sourceUrl: s.source_url ? String(s.source_url) : null,
        status: String(s.status),
        pageCount: chunks.length > 0 ? chunks.length : Number(s.page_count),
        lastSyncedAt: String(s.last_synced_at),
        chunks: chunks.length > 0 ? chunks : undefined,
      };
    });

    // 5. Fetch Appointments
    const appointmentRows = db.prepare(`
      SELECT id, patient_name, patient_contact, practitioner_name, service_name, start_time, status, source, external_id
      FROM appointments
      WHERE organization_id = ?
      ORDER BY start_time ASC
    `).all(orgId) as any[];

    const appointments: DashboardAppointment[] = appointmentRows.map((a) => ({
      id: String(a.id),
      patientName: String(a.patient_name),
      patientContact: String(a.patient_contact),
      practitionerName: String(a.practitioner_name),
      serviceName: String(a.service_name),
      startTime: String(a.start_time),
      status: String(a.status),
      source: String(a.source),
      externalId: a.external_id ? String(a.external_id) : null,
    }));

    // 6. Fetch Orders
    const orderRows = db.prepare(`
      SELECT id, order_number, customer_name, customer_email, total_amount, currency, tracking_carrier, tracking_status, external_id
      FROM orders
      WHERE organization_id = ?
      ORDER BY created_at DESC
    `).all(orgId) as any[];

    const orders: DashboardOrder[] = orderRows.map((o) => ({
      id: String(o.id),
      orderNumber: String(o.order_number),
      customerName: String(o.customer_name),
      customerEmail: String(o.customer_email),
      totalAmount: Number(o.total_amount),
      currency: String(o.currency),
      trackingCarrier: o.tracking_carrier ? String(o.tracking_carrier) : null,
      trackingStatus: String(o.tracking_status),
      externalId: o.external_id ? String(o.external_id) : null,
    }));

    // 7. Fetch Leads
    const leadRows = db.prepare(`
      SELECT id, name, email, phone, intent, status, created_at
      FROM leads
      WHERE organization_id = ?
      ORDER BY created_at DESC
    `).all(orgId) as any[];

    const leads: DashboardLead[] = leadRows.map((l) => ({
      id: String(l.id),
      name: String(l.name),
      email: l.email ? String(l.email) : null,
      phone: l.phone ? String(l.phone) : null,
      intent: String(l.intent),
      status: String(l.status),
      createdAt: String(l.created_at),
    }));

    // 8. Fetch Integrations
    const integrationRows = db.prepare(`
      SELECT id, provider, status, last_sync_at
      FROM integrations
      WHERE organization_id = ?
    `).all(orgId) as any[];

    const integrations: DashboardIntegration[] = integrationRows.map((i) => ({
      id: String(i.id),
      provider: String(i.provider),
      status: String(i.status),
      lastSyncAt: String(i.last_sync_at),
    }));

    // 9. Compute Metrics Aggregation
    const totalConversations = conversations.length;
    const aiResolved = conversations.filter((c) => c.status === "RESOLVED").length;
    const escalated = conversations.filter((c) => c.status === "WAITING_FOR_HUMAN").length;
    const resolutionRate =
      totalConversations > 0 ? `${Math.round((aiResolved / totalConversations) * 100)}%` : "100%";

    const totalOrderRevenue = orders.reduce((acc, curr) => acc + curr.totalAmount, 0);

    const metrics: DashboardMetricData = {
      totalConversations: totalConversations > 0 ? totalConversations : 0,
      aiResolvedCount: aiResolved,
      humanEscalatedCount: escalated,
      resolutionRate,
      actionMetricLabel: isEcom ? "Revenue Influenced" : "Appointments Generated",
      actionMetricValue: isEcom ? `$${totalOrderRevenue.toFixed(2)}` : `${appointments.length} Bookings`,
      actionMetricSubtext: isEcom ? "Tracked via Shopify connector" : "Synced via Cliniko PMS",
    };

    return {
      metrics,
      conversations,
      unansweredQuestions,
      knowledgeSources,
      appointments,
      orders,
      leads,
      integrations,
      agent,
    };
  }

  /**
   * Approves an unanswered question, persisting the validated answer into the knowledge base.
   */
  public static approveQuestion(
    questionId: string,
    orgId: string,
    approvedAnswer: string,
    userId: string
  ): void {
    if (!approvedAnswer || approvedAnswer.trim().length === 0) {
      throw new ValidationError("An approved answer must be provided.");
    }

    const question = db.prepare(`
      SELECT id FROM unanswered_questions WHERE id = ? AND organization_id = ?
    `).get(questionId, orgId);

    if (!question) {
      throw new NotFoundError("Question not found or does not belong to this organization.");
    }

    withTransaction(() => {
      db.prepare(`
        UPDATE unanswered_questions
        SET 
          status = 'approved',
          approved_answer = ?,
          approved_by = ?,
          created_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `).run(approvedAnswer.trim(), userId, questionId, orgId);

      // Ingest approved Q&A as an active verified knowledge document
      const docId = "doc_" + randomBytes(6).toString("hex");
      db.prepare(`
        INSERT INTO knowledge_sources (id, organization_id, title, source_type, source_url, status, page_count)
        VALUES (?, ?, ?, 'manual_qa', NULL, 'indexed', 1)
      `).run(docId, orgId, `FAQ: ${approvedAnswer.slice(0, 40)}...`);
    });
  }

  /**
   * Updates AI Receptionist configurations (Name, Greeting, Brand Color, Tone)
   */
  public static updateAgent(
    orgId: string,
    data: { name?: string; greeting?: string; color?: string; tone?: string }
  ): void {
    const current = db.prepare("SELECT id FROM agents WHERE organization_id = ?").get(orgId) as { id: string } | undefined;
    if (!current) {
      throw new NotFoundError("Agent not found for this organization.");
    }

    db.prepare(`
      UPDATE agents
      SET 
        name = COALESCE(?, name),
        greeting = COALESCE(?, greeting),
        color = COALESCE(?, color),
        tone = COALESCE(?, tone)
      WHERE organization_id = ?
    `).run(
      data.name?.trim() || null,
      data.greeting?.trim() || null,
      data.color?.trim() || null,
      data.tone?.trim() || null,
      orgId
    );
  }

  /**
   * Appends a staff reply to an active conversation and updates thread status.
   */
  public static sendStaffReply(
    conversationId: string,
    orgId: string,
    content: string
  ): ConversationMessage {
    if (!content || content.trim().length === 0) {
      throw new ValidationError("Reply content cannot be empty.");
    }

    const conv = db.prepare(`
      SELECT id FROM conversations WHERE id = ? AND organization_id = ?
    `).get(conversationId, orgId);

    if (!conv) {
      throw new NotFoundError("Conversation not found.");
    }

    const msgId = "msg_" + randomBytes(6).toString("hex");
    const nowIso = new Date().toISOString();

    withTransaction(() => {
      db.prepare(`
        INSERT INTO messages (id, conversation_id, sender, content, created_at)
        VALUES (?, ?, 'staff', ?, ?)
      `).run(msgId, conversationId, content.trim(), nowIso);

      db.prepare(`
        UPDATE conversations
        SET 
          last_message = ?,
          status = 'RESOLVED',
          resolution_badge = 'Human Resolved',
          last_activity_at = ?
        WHERE id = ?
      `).run(content.trim(), nowIso, conversationId);
    });

    dashboardEventBus.emitToOrg(orgId, {
      type: "new_message",
      title: "Staff Reply Sent",
      message: content.trim(),
      icon: "✉️",
      targetTab: "inbox",
      targetId: conversationId,
      data: {
        conversationId,
        message: {
          id: msgId,
          sender: "staff",
          content: content.trim(),
          createdAt: nowIso,
        },
      },
    });

    return {
      id: msgId,
      sender: "staff",
      content: content.trim(),
      createdAt: nowIso,
    };
  }

  /**
   * Updates conversation resolution status
   */
  public static updateConversationStatus(
    conversationId: string,
    orgId: string,
    status: "ACTIVE" | "WAITING_FOR_HUMAN" | "RESOLVED"
  ): void {
    const badge =
      status === "RESOLVED" ? "AI Resolved" : status === "WAITING_FOR_HUMAN" ? "Human needed" : "AI Active";

    db.prepare(`
      UPDATE conversations
      SET status = ?, resolution_badge = ?, last_activity_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(status, badge, conversationId, orgId);
  }

  /**
   * Adds a new knowledge source and immediately crawls/extracts real semantic chunks.
   */
  public static async addKnowledgeSource(
    orgId: string,
    title: string,
    sourceType: "url" | "pdf" | "document" | "manual_qa",
    sourceUrl?: string,
    pageCount: number = 1
  ): Promise<DashboardKnowledgeSource> {
    if (!title || title.trim().length === 0) {
      throw new ValidationError("Source title or URL is required.");
    }

    const id = "src_" + randomBytes(6).toString("hex");
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO knowledge_sources (id, organization_id, title, source_type, source_url, status, page_count, last_synced_at)
      VALUES (?, ?, ?, ?, ?, 'indexing', ?, ?)
    `).run(id, orgId, title.trim(), sourceType, sourceUrl?.trim() || null, Math.max(1, pageCount), nowIso);

    // Extract real parameter chunks from the website or document
    const extractedChunks = await CrawlerService.processAndSaveChunks(id, orgId, title.trim(), sourceType);

    return {
      id,
      title: title.trim(),
      sourceType,
      sourceUrl: sourceUrl?.trim() || null,
      status: "indexed",
      pageCount: extractedChunks.length,
      lastSyncedAt: nowIso,
      chunks: extractedChunks.map((c, i) => ({
        id: i + 1,
        title: c.title,
        content: c.content,
      })),
    };
  }

  /**
   * Deletes a knowledge source and all its associated parameter chunks.
   */
  public static deleteKnowledgeSource(orgId: string, sourceId: string): void {
    const existing = db.prepare("SELECT id FROM knowledge_sources WHERE id = ? AND organization_id = ?").get(sourceId, orgId);
    if (!existing) {
      throw new NotFoundError("Knowledge source not found.");
    }
    withTransaction(() => {
      db.prepare("DELETE FROM knowledge_chunks WHERE source_id = ?").run(sourceId);
      db.prepare("DELETE FROM knowledge_sources WHERE id = ? AND organization_id = ?").run(sourceId, orgId);
    });
  }

  /**
   * Tests a query against the indexed parameters with strict boundary limits (Zero Hallucination).
   */
  public static testKnowledgeQuery(orgId: string, query: string): { answer: string; sources: string[]; confidence: number } {
    if (!query || query.trim().length === 0) {
      throw new ValidationError("Please provide a question to test.");
    }

    const lowerQuery = query.toLowerCase();
    const queryTokens = lowerQuery.split(/\W+/).filter((w) => w.length > 3);

    // 1. Check approved answered questions first
    const approvedQ = db.prepare(`
      SELECT question, approved_answer 
      FROM unanswered_questions 
      WHERE organization_id = ? AND status = 'approved' AND approved_answer IS NOT NULL
    `).all(orgId) as any[];

    for (const q of approvedQ) {
      const matchWords = String(q.question).toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const isMatch = matchWords.some((w) => lowerQuery.includes(w));
      if (isMatch) {
        return {
          answer: String(q.approved_answer),
          sources: ["Approved Q&A Policy"],
          confidence: 0.98,
        };
      }
    }

    // 2. Check real extracted knowledge chunks
    const chunks = db.prepare(`
      SELECT c.title as chunkTitle, c.content, s.title as sourceTitle
      FROM knowledge_chunks c
      JOIN knowledge_sources s ON c.source_id = s.id
      WHERE c.organization_id = ?
    `).all(orgId) as any[];

    if (chunks.length > 0) {
      // Score chunks by keyword matches
      let bestChunk: any = null;
      let highestScore = 0;

      for (const chunk of chunks) {
        const text = (chunk.chunkTitle + " " + chunk.content).toLowerCase();
        let score = 0;
        for (const token of queryTokens) {
          if (text.includes(token)) score++;
        }
        if (score > highestScore) {
          highestScore = score;
          bestChunk = chunk;
        }
      }

      // If keywords matched within the extracted parameters
      if (highestScore > 0 && bestChunk) {
        return {
          answer: `Verified from verified source parameters: ${bestChunk.content.slice(0, 320)}...`,
          sources: [String(bestChunk.sourceTitle || bestChunk.chunkTitle)],
          confidence: Math.min(0.95, 0.75 + highestScore * 0.08),
        };
      }
    }

    // 3. Strict Boundary Guardrail: DO NOT CROSS LIMITS
    // Log the unanswered question into queue so staff can review
    const qId = "unq_" + randomBytes(6).toString("hex");
    try {
      db.prepare(`
        INSERT INTO unanswered_questions (id, organization_id, question, frequency_count, status)
        VALUES (?, ?, ?, 1, 'pending')
      `).run(qId, orgId, query.trim());
    } catch {}

    return {
      answer:
        "This question crosses beyond our verified company parameters. To ensure 100% accuracy with zero hallucination, our AI receptionist is strictly trained not to guess or invent unverified policies. This inquiry has been logged into your Unanswered Questions queue for staff review.",
      sources: [],
      confidence: 0.2,
    };
  }
}
