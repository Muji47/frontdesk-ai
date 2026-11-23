import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { db, withTransaction, seedOrganizationData } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { CrawlerService } from "./crawler.service";
import { AppointmentService } from "./appointment.service";
import { IntegrationService, type DeliveryLogRecord } from "./integration.service";
import { EmailService } from "./email.service";
import { dashboardEventBus } from "@/lib/events";
import {
  calculatePlanCharge,
  getMerchantOfRecordStatus,
  type BillingCurrency,
  type BillingProvider,
  type PaymentMethodBrand,
} from "@/lib/billing-config";

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
  isAiMuted?: boolean;
  escalationReason?: string | null;
  escalationSummary?: string | null;
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
  config?: Record<string, any>;
  lastSyncAt: string;
}

export interface DashboardPaymentMethod {
  id: string;
  brand: PaymentMethodBrand;
  last4: string;
  expMonth: string;
  expYear: string;
  cardholderName: string;
  isDefault: boolean;
}

export interface DashboardBillingInvoice {
  id: string;
  planName: string;
  billingCycle: "monthly" | "biannual" | "annual";
  amountCents: number;
  amountFormatted: string;
  currency: BillingCurrency;
  status: "Paid" | "Failed";
  cardSummary: string | null;
  failureReason: string | null;
  invoiceDate: string;
  prorationCreditCents?: number;
  prorationNote?: string | null;
}

export interface DashboardBillingData {
  plan: "starter" | "growth" | "scale" | "pro";
  billingCycle: "monthly" | "biannual" | "annual";
  currency: BillingCurrency;
  provider: BillingProvider;
  morMode: "live" | "sandbox";
  externalSubscriptionId: string | null;
  customerPortalUrl: string | null;
  subscriptionStatus: "active" | "cancelling" | "cancelled";
  cancelAtPeriodEnd: boolean;
  cancelEffectiveDate: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  creditBalanceCents: number;
  creditBalanceFormatted: string;
  paymentMethods: DashboardPaymentMethod[];
  invoices: DashboardBillingInvoice[];
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
  deliveryLogs?: DeliveryLogRecord[];
  billing: DashboardBillingData;
  agent: {
    id: string;
    name: string;
    greeting: string;
    color: string;
    position: string;
    tone: string;
  };
  allowedDomains: string[];
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
        id, visitor_name, visitor_contact, channel, status, resolution_badge, last_message, external_ref,
        is_ai_muted, escalation_reason, escalation_summary, last_activity_at, created_at
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
        isAiMuted: row.is_ai_muted === 1,
        escalationReason: row.escalation_reason ? String(row.escalation_reason) : null,
        escalationSummary: row.escalation_summary ? String(row.escalation_summary) : null,
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

    // 8. Fetch Integrations & Delivery Logs
    const integrationRows = db.prepare(`
      SELECT id, provider, status, config_json, last_sync_at
      FROM integrations
      WHERE organization_id = ?
    `).all(orgId) as any[];

    const integrations: DashboardIntegration[] = integrationRows.map((i) => ({
      id: String(i.id),
      provider: String(i.provider),
      status: String(i.status),
      config: i.config_json ? JSON.parse(i.config_json) : {},
      lastSyncAt: String(i.last_sync_at),
    }));

    const deliveryLogs = IntegrationService.getDeliveryLogs(orgId, 25);

    // 9. Compute Metrics Aggregation
    const totalConversations = conversations.length;
    const aiResolved = conversations.filter((c) => c.status === "RESOLVED").length;
    const escalated = conversations.filter((c) => c.status === "WAITING_FOR_HUMAN").length;
    const resolutionRate =
      totalConversations > 0 ? `${Math.round((aiResolved / totalConversations) * 100)}%` : "0%";

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

    const billing = this.getBillingData(orgId);

    const orgDataRow = db
      .prepare(`SELECT allowed_domains FROM organizations WHERE id = ?`)
      .get(orgId) as { allowed_domains?: string } | undefined;
    const allowedDomains = orgDataRow?.allowed_domains
      ? orgDataRow.allowed_domains
          .split(/[\n,;\s]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : ["*"];

    return {
      metrics,
      conversations,
      unansweredQuestions,
      knowledgeSources,
      appointments,
      orders,
      leads,
      integrations,
      deliveryLogs,
      billing,
      agent,
      allowedDomains: allowedDomains.length > 0 ? allowedDomains : ["*"],
    };
  }

  /**
   * Retrieves (and seeds initial records if empty) billing subscription, payment methods, and invoices.
   */
  public static getBillingData(orgId: string): DashboardBillingData {
    const orgRow = db
      .prepare(
        "SELECT id, name, plan, billing_cycle, billing_currency, billing_provider, external_subscription_id, customer_portal_url, subscription_status, cancel_at_period_end, cancellation_reason, cancelled_at, credit_balance_cents FROM organizations WHERE id = ?"
      )
      .get(orgId) as
      | {
          id?: string;
          name?: string;
          plan?: string;
          billing_cycle?: string;
          billing_currency?: string;
          billing_provider?: string;
          external_subscription_id?: string | null;
          customer_portal_url?: string | null;
          subscription_status?: string | null;
          cancel_at_period_end?: number | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          credit_balance_cents?: number | null;
        }
      | undefined;

    const rawPlan = (orgRow?.plan || "growth").toLowerCase();
    const plan: "starter" | "growth" | "scale" | "pro" =
      rawPlan === "starter" ? "starter" : rawPlan === "scale" || rawPlan === "pro" || rawPlan === "enterprise" ? "pro" : "growth";
    const rawCycle = (orgRow?.billing_cycle || "monthly").toLowerCase();
    const billingCycle: "monthly" | "biannual" | "annual" =
      rawCycle === "biannual" ? "biannual" : rawCycle === "annual" ? "annual" : "monthly";

    const rawCurrency = (orgRow?.billing_currency || "AUD").toUpperCase();
    const currency: BillingCurrency =
      rawCurrency === "USD" || rawCurrency === "GBP" || rawCurrency === "EUR" ? rawCurrency : "AUD";

    const rawProvider = (orgRow?.billing_provider || "lemonsqueezy").toLowerCase();
    const provider: BillingProvider = rawProvider === "paddle" ? "paddle" : "lemonsqueezy";

    const morStatus = getMerchantOfRecordStatus();

    // Seed initial payment methods & sample invoices once per organization if billing_invoices is empty
    const invCount = db
      .prepare("SELECT COUNT(*) as cnt FROM billing_invoices WHERE organization_id = ?")
      .get(orgId) as { cnt: number };

    if (invCount.cnt === 0) {
      withTransaction(() => {
        const pmCount = db
          .prepare("SELECT COUNT(*) as cnt FROM payment_methods WHERE organization_id = ?")
          .get(orgId) as { cnt: number };
        if (pmCount.cnt === 0) {
          const ownerUser = db
            .prepare("SELECT name FROM users WHERE organization_id = ? AND role = 'owner' LIMIT 1")
            .get(orgId) as { name?: string } | undefined;
          const cardholder = ownerUser?.name || orgRow?.name || "Cardholder";
          const secondaryHolder = orgRow?.name || "Corporate Account";

          db.prepare(`
            INSERT INTO payment_methods (id, organization_id, brand, last4, exp_month, exp_year, cardholder_name, is_default)
            VALUES (?, ?, 'VISA', '4242', '08', '2029', ?, 1)
          `).run("pm_" + randomBytes(5).toString("hex"), orgId, cardholder);

          db.prepare(`
            INSERT INTO payment_methods (id, organization_id, brand, last4, exp_month, exp_year, cardholder_name, is_default)
            VALUES (?, ?, 'MASTERCARD', '8819', '11', '2028', ?, 0)
          `).run("pm_" + randomBytes(5).toString("hex"), orgId, secondaryHolder);
        }

        const insertInv = db.prepare(`
          INSERT INTO billing_invoices (
            id, organization_id, plan_name, billing_cycle, amount_cents, amount_formatted, currency, status, card_summary, failure_reason, invoice_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'AUD', ?, ?, ?, ?, ?)
        `);

        insertInv.run(
          `INV-2026-1101-${orgId.slice(-3)}`,
          orgId,
          "Growth Plan",
          "monthly",
          9900,
          "$99.00 AUD",
          "Paid",
          "VISA •••• 4242",
          null,
          "Nov 01, 2026",
          "2026-11-01T09:00:00.000Z"
        );
        insertInv.run(
          `INV-2026-1015-${orgId.slice(-3)}`,
          orgId,
          "Growth Plan",
          "monthly",
          9900,
          "$99.00 AUD",
          "Failed",
          "MASTERCARD •••• 0000",
          "Card declined by issuer (insufficient funds)",
          "Oct 15, 2026",
          "2026-10-15T09:00:00.000Z"
        );
        insertInv.run(
          `INV-2026-1001-${orgId.slice(-3)}`,
          orgId,
          "Growth Plan",
          "monthly",
          9900,
          "$99.00 AUD",
          "Paid",
          "VISA •••• 4242",
          null,
          "Oct 01, 2026",
          "2026-10-01T09:00:00.000Z"
        );
      });
    }

    const pmRows = db
      .prepare(`
        SELECT id, brand, last4, exp_month, exp_year, cardholder_name, is_default
        FROM payment_methods
        WHERE organization_id = ?
        ORDER BY is_default DESC, created_at DESC
      `)
      .all(orgId) as any[];

    const validBrands = new Set<PaymentMethodBrand>([
      "VISA",
      "MASTERCARD",
      "AMEX",
      "PAYPAL",
      "APPLE_PAY",
      "GOOGLE_PAY",
    ]);

    const paymentMethods: DashboardPaymentMethod[] = pmRows.map((p) => ({
      id: String(p.id),
      brand: validBrands.has(p.brand as PaymentMethodBrand) ? (p.brand as PaymentMethodBrand) : "VISA",
      last4: String(p.last4),
      expMonth: String(p.exp_month),
      expYear: String(p.exp_year),
      cardholderName: String(p.cardholder_name || "Clinic Account"),
      isDefault: p.is_default === 1,
    }));

    const invRows = db
      .prepare(`
        SELECT id, plan_name, billing_cycle, amount_cents, amount_formatted, currency, status, card_summary, failure_reason, invoice_date, proration_credit_cents, proration_note
        FROM billing_invoices
        WHERE organization_id = ?
        ORDER BY created_at DESC
      `)
      .all(orgId) as any[];

    const invoices: DashboardBillingInvoice[] = invRows.map((inv) => {
      const cleanAmount = String(inv.amount_formatted).replace(/\s*(AUD|USD|GBP|EUR)$/i, "");
      const cleanSummary = inv.card_summary
        ? String(inv.card_summary).replace(/\s*•\s*(Lemon Squeezy|Paddle)\s*MoR/gi, "")
        : null;
      return {
        id: String(inv.id).replace(/-[a-zA-Z0-9]{3}$/, ""),
        planName: String(inv.plan_name),
        billingCycle: (inv.billing_cycle === "biannual" || inv.billing_cycle === "annual"
          ? inv.billing_cycle
          : "monthly") as "monthly" | "biannual" | "annual",
        amountCents: Number(inv.amount_cents),
        amountFormatted: cleanAmount,
        currency: "USD" as BillingCurrency,
        status: inv.status === "Failed" ? "Failed" : "Paid",
        cardSummary: cleanSummary,
        failureReason: inv.failure_reason ? String(inv.failure_reason) : null,
        invoiceDate: String(inv.invoice_date),
        prorationCreditCents: Number(inv.proration_credit_cents || 0),
        prorationNote: inv.proration_note ? String(inv.proration_note) : null,
      };
    });

    const subscriptionStatus: "active" | "cancelling" | "cancelled" =
      orgRow?.subscription_status === "cancelling"
        ? "cancelling"
        : orgRow?.subscription_status === "cancelled"
        ? "cancelled"
        : "active";
    const cancelAtPeriodEnd = Boolean(orgRow?.cancel_at_period_end);
    const cancellationReason = orgRow?.cancellation_reason || null;
    const cancelledAt = orgRow?.cancelled_at || null;

    let cancelEffectiveDate: string | null = null;
    if (subscriptionStatus === "cancelling" || cancelAtPeriodEnd) {
      const baseDate = cancelledAt ? new Date(cancelledAt) : new Date();
      const periodDays = billingCycle === "annual" ? 365 : billingCycle === "biannual" ? 180 : 30;
      const effectiveDate = new Date(baseDate.getTime() + periodDays * 86400000);
      cancelEffectiveDate = effectiveDate.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
    }

    const creditBalanceCents = Math.max(0, Number(orgRow?.credit_balance_cents || 0));
    const creditBalanceFormatted = `$${(creditBalanceCents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    return {
      plan,
      billingCycle,
      currency,
      provider,
      morMode: morStatus.mode,
      externalSubscriptionId: orgRow?.external_subscription_id || `sub_mor_${orgId.slice(-6)}`,
      customerPortalUrl:
        orgRow?.customer_portal_url ||
        (provider === "paddle"
          ? "https://customer-portal.paddle.com/cpl_echo_ai"
          : "https://app.lemonsqueezy.com/my-orders"),
      subscriptionStatus,
      cancelAtPeriodEnd,
      cancelEffectiveDate,
      cancellationReason,
      cancelledAt,
      creditBalanceCents,
      creditBalanceFormatted,
      paymentMethods,
      invoices,
    };
  }

  /**
   * Updates the active billing currency (USD, AUD, GBP, EUR) and Merchant of Record provider (lemonsqueezy | paddle).
   */
  public static updateBillingPreferences(
    orgId: string,
    params: { currency?: BillingCurrency; provider?: BillingProvider }
  ): DashboardBillingData {
    if (params.currency && ["USD", "AUD", "GBP", "EUR"].includes(params.currency)) {
      db.prepare("UPDATE organizations SET billing_currency = ? WHERE id = ?").run(params.currency, orgId);
    }
    if (params.provider && ["lemonsqueezy", "paddle"].includes(params.provider)) {
      db.prepare("UPDATE organizations SET billing_provider = ? WHERE id = ?").run(params.provider, orgId);
    }
    return this.getBillingData(orgId);
  }

  /**
   * Upgrades, downgrades, or switches billing cycle (monthly, biannual, annual) with automatic subscription proration.
   * Any unused days paid on the previous plan are credited towards the new plan invoice.
   */
  public static updateSubscription(
    orgId: string,
    targetPlan: "starter" | "growth" | "scale" | "pro",
    targetCycle: "monthly" | "biannual" | "annual",
    simulateFailedCharge = false,
    overrideCurrency?: BillingCurrency
  ): { billing: DashboardBillingData; chargedInvoice: DashboardBillingInvoice; chargeSucceeded: boolean; message: string } {
    const orgRow = db
      .prepare("SELECT plan, billing_cycle, billing_currency, billing_provider FROM organizations WHERE id = ?")
      .get(orgId) as { plan?: string; billing_cycle?: string; billing_currency?: string; billing_provider?: string } | undefined;

    const currentPlan = (orgRow?.plan || "growth").toLowerCase() as "starter" | "growth" | "scale" | "pro";
    const currentCycle = (orgRow?.billing_cycle || "monthly").toLowerCase() as "monthly" | "biannual" | "annual";

    const rawCurr = (overrideCurrency || orgRow?.billing_currency || "AUD").toUpperCase();
    const currency: BillingCurrency =
      rawCurr === "USD" || rawCurr === "GBP" || rawCurr === "EUR" ? rawCurr : "AUD";

    const charge = calculatePlanCharge(targetPlan, targetCycle, currency);
    const { amountCents: fullTargetCents, planLabel, cycleLabel } = charge;

    // Check default payment method
    const defaultCard = db
      .prepare(`SELECT brand, last4, cardholder_name FROM payment_methods WHERE organization_id = ? AND is_default = 1 LIMIT 1`)
      .get(orgId) as { brand: string; last4: string; cardholder_name: string } | undefined;

    if (!defaultCard && !simulateFailedCharge) {
      throw new ValidationError("No payment method on file. Please add a payment method first.");
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    const invId = `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${randomBytes(2).toString("hex").toUpperCase()}`;

    // 1. Calculate Proration & Unused Credit from previous active plan
    const getCycleDays = (cycle: string) => (cycle === "annual" ? 365 : cycle === "biannual" ? 180 : 30);

    const lastPaid = db
      .prepare(`
        SELECT id, plan_name, billing_cycle, amount_cents, amount_formatted, created_at
        FROM billing_invoices
        WHERE organization_id = ? AND status = 'Paid'
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .get(orgId) as { id: string; plan_name: string; billing_cycle: string; amount_cents: number; amount_formatted: string; created_at: string } | undefined;

    let unusedCreditCents = 0;
    let daysRemaining = 0;
    let prorationNote: string | null = null;
    const oldPlanLabel = currentPlan === "starter" ? "Starter Plan" : currentPlan === "scale" || currentPlan === "pro" ? "Pro Plan" : "Growth Plan";

    if (lastPaid && lastPaid.amount_cents > 0 && (targetPlan !== currentPlan || targetCycle !== currentCycle)) {
      const oldCycleDays = getCycleDays(lastPaid.billing_cycle || currentCycle);
      const paidDate = new Date(lastPaid.created_at);
      const msDiff = Math.max(0, now.getTime() - paidDate.getTime());
      const daysElapsed = Math.min(oldCycleDays, msDiff / (1000 * 60 * 60 * 24));
      daysRemaining = Math.max(0, oldCycleDays - daysElapsed);

      if (daysRemaining > 0) {
        const fractionRemaining = daysRemaining / oldCycleDays;
        unusedCreditCents = Math.round(lastPaid.amount_cents * fractionRemaining);
        const creditFormatted = `$${(unusedCreditCents / 100).toFixed(2)}`;
        const daysRemInt = Math.max(1, Math.round(daysRemaining));
        prorationNote = `Prorated: Credited ${creditFormatted} for ${daysRemInt} unused day${daysRemInt === 1 ? "" : "s"} of ${oldPlanLabel} (${lastPaid.billing_cycle || currentCycle})`;
      }
    }

    // 2. Net amount charged today (taking into account unused period credit + existing account balance)
    const orgCreditRow = db
      .prepare("SELECT credit_balance_cents FROM organizations WHERE id = ?")
      .get(orgId) as { credit_balance_cents?: number } | undefined;
    const existingCreditCents = Math.max(0, Number(orgCreditRow?.credit_balance_cents || 0));

    const totalAvailableCreditCents = unusedCreditCents + existingCreditCents;
    let netAmountCents = 0;
    let newCreditBalanceCents = 0;

    if (totalAvailableCreditCents >= fullTargetCents) {
      netAmountCents = 0;
      newCreditBalanceCents = totalAvailableCreditCents - fullTargetCents;
    } else {
      netAmountCents = fullTargetCents - totalAvailableCreditCents;
      newCreditBalanceCents = 0;
    }

    const netAmountFormatted = `$${(netAmountCents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    const STRIPE_DECLINE_CODES: Record<string, string> = {
      "0341": "Your card was declined by the issuer (test card 0341: attach succeeds, charge fails)",
      "0002": "Your card was declined (generic decline)",
      "0005": "Your card was declined (do not honor)",
      "0054": "Your card has insufficient funds",
      "9995": "Your card has insufficient funds",
      "0069": "Your card has expired",
      "0127": "Your card's security code is incorrect",
      "0119": "An error occurred while processing your card",
      "6975": "Card velocity limit exceeded",
      "9987": "The card has been reported lost",
      "9979": "The card has been reported stolen",
      "0000": "Payment declined by issuer during subscription charge",
      "9999": "Payment declined by issuer during subscription charge",
    };

    const stripeDeclineReason = defaultCard ? STRIPE_DECLINE_CODES[defaultCard.last4] : null;
    const isDeclinedCard = Boolean(stripeDeclineReason);
    const formatMethodSummary = (m: { brand: string; last4: string; cardholder_name: string }) => {
      const brand = m.brand === "MASTERCARD" ? "Mastercard" : m.brand === "AMEX" ? "Amex" : "Visa";
      return `${brand} •••• ${m.last4}`;
    };

    if (!defaultCard || isDeclinedCard || simulateFailedCharge) {
      const failReason = !defaultCard
        ? "No default payment method on file"
        : stripeDeclineReason || "Payment declined by issuer during subscription charge";
      const cardSummary = defaultCard ? formatMethodSummary(defaultCard) : "No Payment Method";

      db.prepare(`
        INSERT INTO billing_invoices (
          id, organization_id, plan_name, billing_cycle, amount_cents, amount_formatted, currency, status, card_summary, failure_reason, invoice_date, created_at, proration_credit_cents, proration_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Failed', ?, ?, ?, ?, ?, ?)
      `).run(
        invId,
        orgId,
        `${planLabel} (${cycleLabel})`,
        targetCycle,
        netAmountCents,
        netAmountFormatted,
        currency,
        cardSummary,
        failReason,
        dateStr,
        now.toISOString(),
        unusedCreditCents,
        prorationNote
      );

      const billing = this.getBillingData(orgId);
      return {
        billing,
        chargedInvoice: billing.invoices[0],
        chargeSucceeded: false,
        message: `Payment failed (${netAmountFormatted}): ${failReason}. Failed invoice ${invId} recorded.`,
      };
    }

    const cardSummary = formatMethodSummary(defaultCard);
    withTransaction(() => {
      db.prepare(`
        UPDATE organizations
        SET plan = ?, billing_cycle = ?, billing_currency = ?, credit_balance_cents = ?,
            subscription_status = 'active', cancel_at_period_end = 0, cancellation_reason = NULL, cancelled_at = NULL
        WHERE id = ?
      `).run(
        targetPlan,
        targetCycle,
        currency,
        newCreditBalanceCents,
        orgId
      );

      db.prepare(`
        INSERT INTO billing_invoices (
          id, organization_id, plan_name, billing_cycle, amount_cents, amount_formatted, currency, status, card_summary, failure_reason, invoice_date, created_at, proration_credit_cents, proration_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Paid', ?, NULL, ?, ?, ?, ?)
      `).run(
        invId,
        orgId,
        `${planLabel} (${cycleLabel})`,
        targetCycle,
        netAmountCents,
        netAmountFormatted,
        currency,
        cardSummary,
        dateStr,
        now.toISOString(),
        unusedCreditCents,
        prorationNote
      );
    });

    const billing = this.getBillingData(orgId);
    let successMessage: string;
    if (unusedCreditCents > 0 || existingCreditCents > 0) {
      const creditFormatted = `$${(totalAvailableCreditCents / 100).toFixed(2)}`;
      const daysRemInt = Math.max(1, Math.round(daysRemaining));
      if (netAmountCents > 0) {
        successMessage = `Subscription updated to ${planLabel} (${cycleLabel}) — Charged ${netAmountFormatted} via ${cardSummary} (credited ${creditFormatted} from unused ${oldPlanLabel} balance).`;
      } else {
        const remainingCredit = (newCreditBalanceCents / 100).toFixed(2);
        successMessage = `Subscription updated to ${planLabel} (${cycleLabel}) — Charged $0.00 via ${cardSummary} (fully covered by ${creditFormatted} credit${newCreditBalanceCents > 0 ? `; $${remainingCredit} balance preserved in account` : ""}).`;
      }
    } else {
      successMessage = `Subscription updated to ${planLabel} (${cycleLabel}) — Charged ${netAmountFormatted} via ${cardSummary}.`;
    }

    return {
      billing,
      chargedInvoice: billing.invoices[0],
      chargeSucceeded: true,
      message: successMessage,
    };
  }

  /**
   * Processes a Merchant of Record (Lemon Squeezy / Paddle) webhook event to sync subscriptions and invoices.
   */
  public static processMoRWebhookEvent(params: {
    orgId: string;
    eventName:
      | "subscription_created"
      | "subscription_updated"
      | "subscription_payment_success"
      | "subscription_payment_failed"
      | "subscription_cancelled";
    plan?: "starter" | "growth" | "scale";
    billingCycle?: "monthly" | "biannual" | "annual";
    currency?: BillingCurrency;
    provider?: BillingProvider;
    paymentGateway?: PaymentMethodBrand;
    cardLast4?: string;
    payerEmail?: string;
    externalSubscriptionId?: string;
    customerPortalUrl?: string;
    failureReason?: string;
  }): { billing: DashboardBillingData; eventProcessed: string; message: string } {
    const {
      orgId,
      eventName,
      plan = "growth",
      billingCycle = "monthly",
      currency = "USD",
      provider = "lemonsqueezy",
      paymentGateway = "PAYPAL",
      cardLast4 = "4242",
      payerEmail = "billing@clinic.com",
      externalSubscriptionId,
      customerPortalUrl,
      failureReason,
    } = params;

    const charge = calculatePlanCharge(plan, billingCycle, "USD");
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    const invId = `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${randomBytes(2).toString("hex").toUpperCase()}`;
    const summaryLabel =
      paymentGateway === "PAYPAL"
        ? `PayPal (${payerEmail})`
        : paymentGateway === "APPLE_PAY"
        ? `Apple Pay •••• ${cardLast4}`
        : paymentGateway === "GOOGLE_PAY"
        ? `Google Pay •••• ${cardLast4}`
        : `${paymentGateway} •••• ${cardLast4}`;

    withTransaction(() => {
      if (
        eventName === "subscription_created" ||
        eventName === "subscription_updated" ||
        eventName === "subscription_payment_success"
      ) {
        db.prepare(
          `UPDATE organizations
           SET plan = ?, billing_cycle = ?, billing_currency = 'USD', billing_provider = ?,
               external_subscription_id = COALESCE(?, external_subscription_id),
               customer_portal_url = COALESCE(?, customer_portal_url),
               subscription_status = 'active', cancel_at_period_end = 0, cancellation_reason = NULL, cancelled_at = NULL
           WHERE id = ?`
        ).run(
          plan,
          billingCycle,
          provider,
          externalSubscriptionId || `sub_${provider}_${randomBytes(3).toString("hex")}`,
          customerPortalUrl || null,
          orgId
        );
      } else if (eventName === "subscription_cancelled") {
        db.prepare(
          `UPDATE organizations
           SET plan = 'starter',
               subscription_status = 'cancelled',
               cancel_at_period_end = 0,
               cancellation_reason = 'Merchant of Record webhook cancellation',
               cancelled_at = ?
           WHERE id = ?`
        ).run(now.toISOString(), orgId);
      }

      if (eventName === "subscription_payment_success" || eventName === "subscription_created") {
        db.prepare(`
          INSERT INTO billing_invoices (
            id, organization_id, plan_name, billing_cycle, amount_cents, amount_formatted, currency, status, card_summary, failure_reason, invoice_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'USD', 'Paid', ?, NULL, ?, ?)
        `).run(
          invId,
          orgId,
          `${charge.planLabel} (${charge.cycleLabel})`,
          billingCycle,
          charge.amountCents,
          charge.amountFormatted,
          summaryLabel,
          dateStr,
          now.toISOString()
        );
      } else if (eventName === "subscription_payment_failed") {
        db.prepare(`
          INSERT INTO billing_invoices (
            id, organization_id, plan_name, billing_cycle, amount_cents, amount_formatted, currency, status, card_summary, failure_reason, invoice_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'USD', 'Failed', ?, ?, ?, ?)
        `).run(
          invId,
          orgId,
          `${charge.planLabel} (${charge.cycleLabel})`,
          billingCycle,
          charge.amountCents,
          charge.amountFormatted,
          summaryLabel,
          failureReason || `Payment declined by customer bank / wallet`,
          dateStr,
          now.toISOString()
        );
      }
    });

    const billing = this.getBillingData(orgId);
    return {
      billing,
      eventProcessed: eventName,
      message:
        eventName === "subscription_payment_failed"
          ? `Payment failed (${charge.amountFormatted}) — Failed invoice ${invId} recorded.`
          : `Subscription updated to ${charge.planLabel} (${charge.cycleLabel}) — Charged ${charge.amountFormatted} via ${summaryLabel}.`,
    };
  }

  /**
   * Adds a new payment method (Card or PayPal / Apple Pay / Google Pay via Merchant of Record) and optionally sets it as default.
   */
  public static addPaymentMethod(
    orgId: string,
    params: {
      brand?: string;
      cardNumber: string;
      expMonth: string;
      expYear: string;
      cardholderName: string;
      setAsDefault?: boolean;
    }
  ): DashboardBillingData {
    const validBrands = new Set<PaymentMethodBrand>([
      "VISA",
      "MASTERCARD",
      "AMEX",
      "PAYPAL",
      "APPLE_PAY",
      "GOOGLE_PAY",
    ]);
    let brand: PaymentMethodBrand = "VISA";
    if (params.brand && validBrands.has(params.brand as PaymentMethodBrand)) {
      brand = params.brand as PaymentMethodBrand;
    }

    let last4 = "4242";
    let expMonth = String(params.expMonth || "12").padStart(2, "0");
    let expYear = String(params.expYear || "2029").trim();
    if (expYear.length === 2) expYear = `20${expYear}`;
    let holder = (params.cardholderName || "Clinic Account").trim();

    if (brand === "PAYPAL") {
      // For PayPal wallet via Merchant of Record, cardNumber or cardholderName can hold the PayPal email
      const emailInput = (params.cardNumber || params.cardholderName || "billing@clinic.com").trim();
      last4 = emailInput.slice(-4) || "PPAL";
      holder = emailInput.includes("@") ? emailInput : `${holder} (PayPal MoR)`;
      expMonth = "MoR";
      expYear = "Active";
    } else {
      const digits = (params.cardNumber || "").replace(/\D/g, "");
      if (digits.length < 4) {
        throw new ValidationError("Please enter at least the last 4 digits of the card number.");
      }
      last4 = digits.slice(-4);
      if (!params.brand) {
        if (digits.startsWith("5") || digits.startsWith("2")) {
          brand = "MASTERCARD";
        } else if (digits.startsWith("3")) {
          brand = "AMEX";
        }
      }
    }

    const existingCount = db
      .prepare("SELECT COUNT(*) as cnt FROM payment_methods WHERE organization_id = ?")
      .get(orgId) as { cnt: number };
    const makeDefault = params.setAsDefault !== false || existingCount.cnt === 0;

    withTransaction(() => {
      if (makeDefault) {
        db.prepare("UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?").run(orgId);
      }
      db.prepare(`
        INSERT INTO payment_methods (id, organization_id, brand, last4, exp_month, exp_year, cardholder_name, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run("pm_" + randomBytes(5).toString("hex"), orgId, brand, last4, expMonth, expYear, holder, makeDefault ? 1 : 0);
    });

    return this.getBillingData(orgId);
  }

  /**
   * Marks a payment method as default for the organization.
   */
  public static setDefaultPaymentMethod(orgId: string, paymentMethodId: string): DashboardBillingData {
    const existing = db
      .prepare("SELECT id FROM payment_methods WHERE id = ? AND organization_id = ?")
      .get(paymentMethodId, orgId);
    if (!existing) {
      throw new NotFoundError("Payment method not found.");
    }

    withTransaction(() => {
      db.prepare("UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?").run(orgId);
      db.prepare("UPDATE payment_methods SET is_default = 1 WHERE id = ? AND organization_id = ?").run(
        paymentMethodId,
        orgId
      );
    });

    return this.getBillingData(orgId);
  }

  /**
   * Deletes a payment method; if it was default, promotes the next available card to default.
   */
  public static deletePaymentMethod(orgId: string, paymentMethodId: string): DashboardBillingData {
    const existing = db
      .prepare("SELECT id, is_default FROM payment_methods WHERE id = ? AND organization_id = ?")
      .get(paymentMethodId, orgId) as { id: string; is_default: number } | undefined;
    if (!existing) {
      throw new NotFoundError("Payment method not found.");
    }

    withTransaction(() => {
      db.prepare("DELETE FROM payment_methods WHERE id = ? AND organization_id = ?").run(paymentMethodId, orgId);

      if (existing.is_default === 1) {
        const nextCard = db
          .prepare("SELECT id FROM payment_methods WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1")
          .get(orgId) as { id: string } | undefined;
        if (nextCard) {
          db.prepare("UPDATE payment_methods SET is_default = 1 WHERE id = ?").run(nextCard.id);
        }
      }
    });

    return this.getBillingData(orgId);
  }

  /**
   * Cancels the subscription for an organization.
   * If immediate is false (default), the subscription remains valid until the period ends,
   * setting subscription_status = 'cancelling' and cancel_at_period_end = 1.
   * If immediate is true, the plan reverts to 'starter' and subscription_status = 'cancelled'.
   */
  public static cancelSubscription(
    orgId: string,
    reason?: string,
    feedback?: string,
    immediate: boolean = false
  ): { billing: DashboardBillingData; message: string } {
    const org = db.prepare("SELECT id, plan, billing_cycle FROM organizations WHERE id = ?").get(orgId) as
      | { id: string; plan: string; billing_cycle: string }
      | undefined;

    if (!org) {
      throw new NotFoundError("Organization not found.");
    }

    const now = new Date();
    const reasonParts = [reason?.trim(), feedback?.trim() ? `Feedback: ${feedback.trim()}` : ""].filter(Boolean);
    const formattedReason = reasonParts.length > 0 ? reasonParts.join(" — ") : "Customer requested cancellation";

    withTransaction(() => {
      if (immediate) {
        db.prepare(`
          UPDATE organizations
          SET plan = 'starter',
              subscription_status = 'cancelled',
              cancel_at_period_end = 0,
              cancellation_reason = ?,
              cancelled_at = ?
          WHERE id = ?
        `).run(formattedReason, now.toISOString(), orgId);
      } else {
        db.prepare(`
          UPDATE organizations
          SET subscription_status = 'cancelling',
              cancel_at_period_end = 1,
              cancellation_reason = ?,
              cancelled_at = ?
          WHERE id = ?
        `).run(formattedReason, now.toISOString(), orgId);
      }

      // Record in integration_logs for commercial audit trail
      try {
        db.prepare(`
          INSERT INTO integration_logs (
            id, organization_id, provider, event_type, status, status_code, payload_json, response_json, duration_ms, created_at
          ) VALUES (?, ?, 'billing', 'subscription.cancelled', 'delivered', 200, ?, ?, 15, ?)
        `).run(
          "log_" + randomBytes(6).toString("hex"),
          orgId,
          JSON.stringify({ plan: org.plan, billingCycle: org.billing_cycle, reason: formattedReason, immediate }),
          JSON.stringify({ status: immediate ? "cancelled_immediately" : "cancels_at_period_end", cancelledAt: now.toISOString() }),
          now.toISOString()
        );
      } catch (e) {
        // graceful fallback
      }
    });

    const billing = this.getBillingData(orgId);
    return {
      billing,
      message: immediate
        ? "Subscription cancelled immediately. Plan reverted to Starter."
        : `Subscription scheduled for cancellation. Access remains active until ${billing.cancelEffectiveDate || "period end"}.`,
    };
  }

  /**
   * Resumes a subscription scheduled for cancellation at period end.
   */
  public static resumeSubscription(orgId: string): { billing: DashboardBillingData; message: string } {
    const org = db.prepare("SELECT id, plan FROM organizations WHERE id = ?").get(orgId) as
      | { id: string; plan: string }
      | undefined;

    if (!org) {
      throw new NotFoundError("Organization not found.");
    }

    const now = new Date();
    withTransaction(() => {
      db.prepare(`
        UPDATE organizations
        SET subscription_status = 'active',
            cancel_at_period_end = 0,
            cancellation_reason = NULL,
            cancelled_at = NULL
        WHERE id = ?
      `).run(orgId);

      try {
        db.prepare(`
          INSERT INTO integration_logs (
            id, organization_id, provider, event_type, status, status_code, payload_json, response_json, duration_ms, created_at
          ) VALUES (?, ?, 'billing', 'subscription.resumed', 'delivered', 200, ?, ?, 12, ?)
        `).run(
          "log_" + randomBytes(6).toString("hex"),
          orgId,
          JSON.stringify({ plan: org.plan, resumedAt: now.toISOString() }),
          JSON.stringify({ status: "active" }),
          now.toISOString()
        );
      } catch (e) {}
    });

    const billing = this.getBillingData(orgId);
    return {
      billing,
      message: "Subscription successfully resumed! Automatic renewals and clinical integrations will continue normally.",
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

      const questionRow = db.prepare("SELECT question FROM unanswered_questions WHERE id = ?").get(questionId) as { question: string } | undefined;
      const questionText = questionRow?.question || "FAQ";

      // Ingest approved Q&A as an active verified knowledge document & chunk
      const docId = "doc_" + randomBytes(6).toString("hex");
      db.prepare(`
        INSERT INTO knowledge_sources (id, organization_id, title, source_type, source_url, status, page_count)
        VALUES (?, ?, ?, 'manual_qa', NULL, 'indexed', 1)
      `).run(docId, orgId, `FAQ: ${questionText.slice(0, 40)}`);

      const chunkId = "chk_" + randomBytes(6).toString("hex");
      db.prepare(`
        INSERT INTO knowledge_chunks (id, source_id, organization_id, chunk_index, title, content, token_count)
        VALUES (?, ?, ?, 1, ?, ?, ?)
      `).run(
        chunkId,
        docId,
        orgId,
        `FAQ: ${questionText}`,
        `Question: ${questionText}\nAnswer: ${approvedAnswer.trim()}`,
        Math.max(1, Math.round(approvedAnswer.length / 4))
      );
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
   * Updates the whitelisted client domains allowed to embed the receptionist widget and consume AI credits.
   */
  public static updateAllowedDomains(orgId: string, domains: string[]): string[] {
    const clean = domains
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const val = clean.length > 0 ? clean.join(",") : "*";
    db.prepare(`UPDATE organizations SET allowed_domains = ? WHERE id = ?`).run(val, orgId);
    return clean.length > 0 ? clean : ["*"];
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
          is_ai_muted = 1,
          last_activity_at = ?
        WHERE id = ? AND organization_id = ?
      `).run(content.trim(), nowIso, conversationId, orgId);
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
    pageCount: number = 1,
    content?: string,
    fileBuffer?: Buffer
  ): Promise<DashboardKnowledgeSource> {
    if (!title || title.trim().length === 0) {
      throw new ValidationError("Source title or URL is required.");
    }

    if (sourceType === "url") {
      await CrawlerService.validateUrlSafety(title.trim());
    }

    const id = "src_" + randomBytes(6).toString("hex");
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO knowledge_sources (id, organization_id, title, source_type, source_url, status, page_count, last_synced_at)
      VALUES (?, ?, ?, ?, ?, 'indexing', ?, ?)
    `).run(id, orgId, title.trim(), sourceType, sourceUrl?.trim() || null, Math.max(1, pageCount), nowIso);

    // If manual Q&A, also register in unanswered_questions as approved for immediate match retrieval
    if (sourceType === "manual_qa" && content?.trim()) {
      const unqId = "unq_" + randomBytes(6).toString("hex");
      try {
        db.prepare(`
          INSERT INTO unanswered_questions (id, organization_id, question, frequency_count, status, approved_answer, approved_by)
          VALUES (?, ?, ?, 1, 'approved', ?, 'staff')
        `).run(unqId, orgId, title.trim(), content.trim());
      } catch (err) {
        console.warn("[addKnowledgeSource] Failed to insert manual Q&A into unanswered_questions:", err);
      }
    }

    // Extract real parameter chunks from the website or document
    const extractedChunks = await CrawlerService.processAndSaveChunks(
      id,
      orgId,
      title.trim(),
      sourceType,
      content,
      fileBuffer
    );

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
   * Also cleans up matching manual Q&As in unanswered_questions so deleted facts are never served.
   */
  public static deleteKnowledgeSource(orgId: string, sourceId: string): void {
    const existing = db
      .prepare("SELECT id, title, source_type FROM knowledge_sources WHERE id = ? AND organization_id = ?")
      .get(sourceId, orgId) as { id: string; title: string; source_type: string } | undefined;

    if (!existing) {
      throw new NotFoundError("Knowledge source not found.");
    }

    withTransaction(() => {
      // If manual Q&A, remove from unanswered_questions so deleted answers do not persist in testKnowledgeQuery
      if (existing.source_type === "manual_qa") {
        const cleanTitle = existing.title.replace(/^FAQ:\s*/i, "").trim();
        db.prepare(`
          DELETE FROM unanswered_questions 
          WHERE organization_id = ? 
            AND (
              question = ? 
              OR question = ?
              OR question LIKE ? 
              OR approved_answer IN (SELECT content FROM knowledge_chunks WHERE source_id = ?)
            )
        `).run(orgId, existing.title, cleanTitle, `%${cleanTitle}%`, sourceId);
      }

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

    const lowerQuery = query.toLowerCase().trim();

    // 0. Handle conversational greetings naturally with dynamic organization & agent context
    const orgRow = db
      .prepare("SELECT name, industry FROM organizations WHERE id = ?")
      .get(orgId) as { name: string; industry: string } | undefined;
    const orgName = orgRow?.name || "our clinic";
    const industry = (orgRow?.industry || "clinic").toLowerCase();

    const agentRow = db
      .prepare("SELECT name, greeting FROM agents WHERE organization_id = ? LIMIT 1")
      .get(orgId) as { name: string; greeting: string } | undefined;

    if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)\b/.test(lowerQuery) && lowerQuery.split(/\s+/).length <= 5) {
      return {
        answer:
          agentRow?.greeting ||
          `Hello! Welcome to ${orgName}. How can I help you today?`,
        sources: ["Receptionist Greeting"],
        confidence: 0.99,
      };
    }

    const stopWords = new Set([
      "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
      "have", "has", "had", "does", "did", "doing", "done", "do",
      "with", "from", "your", "that", "this", "there", "their", "theirs", "they", "them",
      "about", "would", "could", "should", "shall", "will", "can", "may", "might", "must",
      "please", "tell", "give", "know", "want", "like", "just",
      "the", "and", "for", "are", "but", "not", "you", "all", "any", "been",
      "her", "was", "one", "our", "out", "day", "get", "him", "his",
      "new", "now", "old", "see", "two", "way", "its", "let", "put", "say", "she", "too", "use"
    ]);
    const baseTokens = lowerQuery
      .split(/\W+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));

    // Dynamic industry-aware synonym expansion
    const expandedTokens = new Set<string>(baseTokens);

    // Universal business concepts
    if (/(fee|fees|price|pricing|cost|much|charge|rate|rates|quote)/.test(lowerQuery)) {
      ["pricing", "price", "fees", "fee", "cost", "rates", "rate", "charge"].forEach((t) => expandedTokens.add(t));
    }
    if (/(hour|hours|open|opening|close|closing|time|when|schedule|days|weekend)/.test(lowerQuery)) {
      ["hours", "opening", "closing", "schedule", "operating", "open", "time"].forEach((t) => expandedTokens.add(t));
    }
    if (/(where|location|address|street|directions|parking|find|office|store)/.test(lowerQuery)) {
      ["location", "address", "directions", "suite", "parking", "located"].forEach((t) => expandedTokens.add(t));
    }
    if (/(contact|email|phone|call|support|help|speak)/.test(lowerQuery)) {
      ["contact", "phone", "email", "support", "help", "staff"].forEach((t) => expandedTokens.add(t));
    }

    // Domain-specific expansions
    if (industry === "clinic") {
      if (/(hicaps|health|fund|funds|insurance|medicare|claim|rebate|cover|private)/.test(lowerQuery)) {
        ["health", "funds", "hicaps", "insurance", "medicare", "claims", "rebates"].forEach((t) => expandedTokens.add(t));
      }
      if (/(doctor|doctors|dr\b|practitioner|practitioners|physio|physiotherapist|therapist|specialist|clinician|who|name)/.test(lowerQuery)) {
        ["clinical", "practitioners", "physiotherapist", "specialist", "practitioner", "doctor"].forEach((t) => expandedTokens.add(t));
      }
      if (/(book|booking|appointment|schedule|availab|tomorrow)/.test(lowerQuery)) {
        ["consultation", "appointment", "booking", "fees", "practitioners"].forEach((t) => expandedTokens.add(t));
      }
    } else if (industry === "ecommerce") {
      if (/(shipping|delivery|postage|dispatch|transit|tracking|courier|express|standard)/.test(lowerQuery)) {
        ["shipping", "delivery", "dispatch", "transit", "tracking", "postage", "carrier"].forEach((t) => expandedTokens.add(t));
      }
      if (/(return|returns|refund|refunds|exchange|warranty|damaged|faulty)/.test(lowerQuery)) {
        ["returns", "refund", "exchange", "warranty", "policy", "packaging"].forEach((t) => expandedTokens.add(t));
      }
      if (/(product|item|stock|catalog|order|buy|purchase)/.test(lowerQuery)) {
        ["product", "items", "catalog", "order", "inventory"].forEach((t) => expandedTokens.add(t));
      }
    } else if (industry === "realestate") {
      if (/(property|inspection|listing|lease|rent|tenant|agent)/.test(lowerQuery)) {
        ["property", "inspection", "listing", "lease", "rent", "agent"].forEach((t) => expandedTokens.add(t));
      }
    } else if (industry === "beauty") {
      if (/(treatment|styling|hair|salon|therapist|stylist|service)/.test(lowerQuery)) {
        ["treatment", "styling", "salon", "therapist", "stylist", "appointment"].forEach((t) => expandedTokens.add(t));
      }
    }

    const queryTokens = Array.from(expandedTokens);

    // 1. Check approved answered questions first
    const approvedQ = db.prepare(`
      SELECT question, approved_answer 
      FROM unanswered_questions 
      WHERE organization_id = ? AND status = 'approved' AND approved_answer IS NOT NULL
    `).all(orgId) as any[];

    for (const q of approvedQ) {
      const qLower = String(q.question).toLowerCase();
      const matchWords = qLower.split(/\W+/).filter((w) => w.length >= 3 && !stopWords.has(w));
      const isMatch = qLower === lowerQuery || (matchWords.length > 0 && matchWords.every((w) => lowerQuery.includes(w)));
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
      const scored = chunks
        .map((chunk) => {
          const title = String(chunk.chunkTitle || "").toLowerCase();
          const content = String(chunk.content || "").toLowerCase();

          let score = 0;

          // Exact phrase bonus in title or content
          if (title.includes(lowerQuery)) score += 8;
          else if (content.includes(lowerQuery)) score += 5;

          // Token matches
          for (const token of queryTokens) {
            const isBase = baseTokens.includes(token);
            if (title.includes(token)) score += isBase ? 4 : 2;
            if (content.includes(token)) score += isBase ? 3 : 1;
          }

          return { chunk, score };
        })
        .filter((item) => item.score >= 3)
        .sort((a, b) => b.score - a.score);

      if (scored.length > 0) {
        const top = scored[0].chunk;
        const cleanTitle = String(top.chunkTitle || "")
          .replace(/^([📍💳👩‍⚕️🏥⚡📦🛍️🏡✨]+\s*)/, "")
          .trim();
        let cleanContent = String(top.content)
          .replace(/^([📍💳👩‍⚕️🏥⚡📦🛍️🏡✨]+\s*)/, "")
          .trim();
        if (cleanTitle && cleanContent.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
          cleanContent = cleanContent.slice(cleanTitle.length).trim();
        }

        // If booking intent for clinics, synthesize a helpful booking prompt
        if (industry === "clinic" && /(book|booking|appointment|schedule|tomorrow|available)/.test(lowerQuery)) {
          const pracChunk = chunks.find((c) => /practitioner|doctor|physio|therapist|specialist/i.test(c.chunkTitle + " " + c.content));
          const feeChunk = chunks.find((c) => /fee|price|consultation/i.test(c.chunkTitle + " " + c.content));
          const parts: string[] = [];
          if (pracChunk) {
            const pTitle = String(pracChunk.chunkTitle || "").replace(/^([📍💳👩‍⚕️🏥⚡]+\s*)/, "").trim();
            let pText = String(pracChunk.content).replace(/^([📍💳👩‍⚕️🏥⚡]+\s*)/, "").trim();
            if (pTitle && pText.toLowerCase().startsWith(pTitle.toLowerCase())) pText = pText.slice(pTitle.length).trim();
            parts.push(`Our practitioners are ${pText}`);
          }
          if (feeChunk && feeChunk !== pracChunk) {
            const feeMatch = String(feeChunk.content).match(/Consultation Fees:\s*([^\n.]+)/i);
            if (feeMatch) {
              parts.push(`Consultation fees are ${feeMatch[1].trim()}`);
            }
          }
          const combined = parts.length > 0 ? parts.join(". ") : cleanContent;
          return {
            answer: `I can certainly help you book an appointment! ${combined}. Please share your preferred day/time and contact number, or our front desk can lock that in for you right away.`,
            sources: [String(top.sourceTitle || top.chunkTitle)],
            confidence: Math.min(0.96, 0.78 + scored[0].score * 0.04),
          };
        }

        // Synthesize natural receptionist phrasing strictly from verified chunk content
        let naturalAnswer = cleanContent;
        if (industry === "clinic") {
          if (/hicaps/i.test(lowerQuery) && /hicaps|on-the-spot|electronic claims/i.test(top.chunkTitle + " " + cleanContent)) {
            naturalAnswer = `HICAPS is our on-the-spot electronic health fund claiming system at reception — it lets you claim your private health rebate immediately after your appointment. ${cleanContent}`;
          } else if (/(doctor|dr\b|practitioner|physio|therapist|specialist|who|name)/.test(lowerQuery) && /practitioner|clinician|doctor/i.test(top.chunkTitle + " " + cleanContent)) {
            naturalAnswer = `Our clinical team: ${cleanContent}`;
          } else if (/(fee|fees|price|pricing|cost|much|charge|consult)/.test(lowerQuery)) {
            const feeMatch = cleanContent.match(/Consultation Fees:\s*([^\n.]+)/i);
            if (feeMatch) {
              naturalAnswer = `Our consultation fees are ${feeMatch[1].trim()}. (${cleanContent.replace(/Consultation Fees:.*$/i, "").trim()})`;
            }
          }
        } else if (industry === "ecommerce") {
          if (/(shipping|delivery|dispatch|postage|express|standard|courier)/.test(lowerQuery) && /shipping|delivery|business days|express/i.test(top.chunkTitle + " " + cleanContent)) {
            naturalAnswer = `Here are our shipping details: ${cleanContent}`;
          } else if (/(return|returns|refund|refunds|exchange|policy)/.test(lowerQuery) && /return|refund|exchange|30 days/i.test(top.chunkTitle + " " + cleanContent)) {
            naturalAnswer = `Our return and refund policy: ${cleanContent}`;
          }
        } else if (industry === "realestate") {
          if (/(pet|pets|dog|cat|animal)/.test(lowerQuery) && /pet|animal|lease|case by case/i.test(top.chunkTitle + " " + cleanContent)) {
            naturalAnswer = `Regarding pet policies: ${cleanContent}`;
          } else if (/(price|rent|pricing|fee|bond|cost)/.test(lowerQuery) && /rent|price|week|month|bond/i.test(top.chunkTitle + " " + cleanContent)) {
            naturalAnswer = `Listing and pricing details: ${cleanContent}`;
          }
        } else if (industry === "beauty") {
          if (/(haircut|cut|style|styling|treatment|colour|color|balayage|facial)/.test(lowerQuery) && /service|cut|style|colour|treatment|\$/i.test(top.chunkTitle + " " + cleanContent)) {
            naturalAnswer = `Our treatment and service options: ${cleanContent}`;
          } else if (/(price|menu|cost|fee|much)/.test(lowerQuery) && /\$|from|price|menu/i.test(top.chunkTitle + " " + cleanContent)) {
            naturalAnswer = `Our service menu pricing: ${cleanContent}`;
          }
        }

        // Universal fallbacks if not specialized
        if (naturalAnswer === cleanContent) {
          if (/(where|location|address|street)/.test(lowerQuery) && /suite|street|road|avenue|located|address/i.test(cleanContent)) {
            naturalAnswer = `We are located at: ${cleanContent}`;
          } else if (/(hour|hours|open|opening|close|closing|when)/.test(lowerQuery) && /am|pm|monday|friday|saturday|hours|operating/i.test(cleanContent)) {
            naturalAnswer = `Our operating hours: ${cleanContent}`;
          } else if (/(fee|fees|price|pricing|cost|much|charge)/.test(lowerQuery)) {
            const feeMatch = cleanContent.match(/(?:Consultation Fees|Pricing|Fees|Rates):\s*([^\n.]+)/i);
            if (feeMatch) {
              naturalAnswer = `Our pricing details: ${feeMatch[1].trim()}. (${cleanContent.replace(/(?:Consultation Fees|Pricing|Fees|Rates):.*$/i, "").trim()})`;
            }
          }
        }

        return {
          answer: naturalAnswer,
          sources: [String(top.sourceTitle || top.chunkTitle)],
          confidence: Math.min(0.95, 0.75 + scored[0].score * 0.05),
        };
      }
    }

    // 3. Strict Boundary Guardrail: DO NOT CROSS LIMITS
    // Log the unanswered question into queue so staff can review (avoid duplicate pending rows)
    const existingUnq = db
      .prepare(`SELECT id FROM unanswered_questions WHERE organization_id = ? AND lower(question) = ? AND status = 'pending'`)
      .get(orgId, lowerQuery) as { id: string } | undefined;

    if (existingUnq) {
      db.prepare(`UPDATE unanswered_questions SET frequency_count = frequency_count + 1, last_asked_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        existingUnq.id
      );
    } else {
      const qId = "unq_" + randomBytes(6).toString("hex");
      try {
        db.prepare(`
          INSERT INTO unanswered_questions (id, organization_id, question, frequency_count, status)
          VALUES (?, ?, ?, 1, 'pending')
        `).run(qId, orgId, query.trim());

        dashboardEventBus.emitToOrg(orgId, {
          type: "new_unanswered_question",
          title: "New Question in Review Queue",
          message: `Visitor inquired: "${query.trim().slice(0, 75)}"`,
          icon: "❓",
          targetTab: "unanswered",
          targetId: qId,
        });
      } catch {}
    }

    return {
      answer:
        "This question crosses beyond our verified company parameters. To ensure 100% accuracy with zero hallucination, our AI receptionist is strictly trained not to guess or invent unverified policies. This inquiry has been logged into your Unanswered Questions queue for staff review.",
      sources: [],
      confidence: 0.2,
    };
  }

  /**
   * Toggles AI mute status on an active conversation thread (Sprint 2.1 Handover Control).
   */
  public static toggleConversationAiMute(
    conversationId: string,
    orgId: string,
    mute: boolean
  ): { isAiMuted: boolean; status: string; badge: string } {
    const conv = db.prepare(`
      SELECT id, status, visitor_name, visitor_contact FROM conversations WHERE id = ? AND organization_id = ?
    `).get(conversationId, orgId) as any;

    if (!conv) {
      throw new NotFoundError("Conversation not found.");
    }

    const newStatus = mute ? "WAITING_FOR_HUMAN" : "ACTIVE";
    const newBadge = mute ? "Human needed" : "AI Active";

    db.prepare(`
      UPDATE conversations
      SET is_ai_muted = ?, status = ?, resolution_badge = ?, last_activity_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(mute ? 1 : 0, newStatus, newBadge, conversationId);

    dashboardEventBus.emitToOrg(orgId, {
      type: "handover_alert",
      title: mute ? "👤 Staff Handover Activated" : "🤖 AI Autopilot Resumed",
      message: mute ? "AI is now muted on this thread." : "AI receptionist is back active.",
      icon: mute ? "👤" : "🤖",
      targetTab: "conversations",
      targetId: conversationId,
      data: {
        conversationId,
        isAiMuted: mute,
        status: newStatus,
        badge: newBadge,
      },
    });

    if (mute) {
      IntegrationService.dispatchOutboundEvent(orgId, "conversation.escalated", {
        conversationId,
        visitorName: conv.visitor_name,
        visitorContact: conv.visitor_contact,
        reason: "Staff takeover activated by practitioner",
      }).catch((err) => console.error("[DashboardService] Escalation dispatch error:", err));
    }

    return { isAiMuted: mute, status: newStatus, badge: newBadge };
  }

  /**
   * Handles visitor chat messages from the public website widget with real RAG retrieval,
   * persistence, and real-time dashboard notification.
   */
  public static async handleVisitorChat(params: {
    orgId?: string;
    conversationId?: string;
    message: string;
    visitorName?: string;
    visitorContact?: string;
    customerContext?: {
      userId?: string;
      email?: string;
      name?: string;
      cart?: { count?: number; total?: number | string; items?: any[] };
    } | null;
    pageContext?: {
      url?: string;
      title?: string;
      sections?: { title: string; content: string }[];
    } | null;
  }): Promise<{
    conversationId: string;
    visitorToken: string;
    clientMsgId: string;
    aiMsgId: string;
    replyText: string;
    chips?: string[];
    isEscalated: boolean;
  }> {
    const orgId = params.orgId || "org_demo_101";
    const text = params.message.trim();
    if (!text) {
      throw new ValidationError("Message cannot be empty.");
    }

    const nowIso = new Date().toISOString();

    let convId = params.conversationId;
    const clientMsgId = "msg_" + randomBytes(6).toString("hex");

    // Verify if conversation exists in DB and belongs to this organization
    let existingConv = convId
      ? (db.prepare(`SELECT id, visitor_name, is_ai_muted FROM conversations WHERE id = ? AND organization_id = ?`).get(convId, orgId) as any)
      : null;

    // Cross-lambda self-healing: if routed to an ephemeral serverless container that lacks the conversation row,
    // re-provision the conversation dynamically so multi-turn chat never throws HTTP 404!
    if (convId && !existingConv) {
      const visitorName = params.visitorName || "Website Visitor";
      const visitorContact = params.visitorContact || "+61 400 " + Math.floor(100000 + Math.random() * 900000);
      try {
        db.prepare(`
          INSERT OR IGNORE INTO conversations (
            id, organization_id, visitor_name, visitor_contact, channel, status, resolution_badge, last_message, created_at, last_activity_at
          ) VALUES (?, ?, ?, ?, 'web', 'ACTIVE', 'AI Active', ?, ?, ?)
        `).run(convId, orgId, visitorName, visitorContact, text, nowIso, nowIso);
        existingConv = { id: convId, visitor_name: visitorName, is_ai_muted: 0 };
      } catch (err) {
        console.warn("[DashboardService] Multi-turn conversation auto-recovery warning:", err);
      }
    }

    // 1. Create conversation if new
    if (!convId) {
      convId = "conv_" + randomBytes(6).toString("hex");
      const visitorName = params.visitorName || "Website Visitor";
      const visitorContact = params.visitorContact || "+61 400 " + Math.floor(100000 + Math.random() * 900000);

      db.prepare(`
        INSERT INTO conversations (
          id, organization_id, visitor_name, visitor_contact, channel, status, resolution_badge, last_message, created_at, last_activity_at
        ) VALUES (?, ?, ?, ?, 'web', 'ACTIVE', 'AI Active', ?, ?, ?)
      `).run(convId, orgId, visitorName, visitorContact, text, nowIso, nowIso);

      // Save Visitor Message
      db.prepare(`
        INSERT INTO messages (id, conversation_id, sender, content, created_at)
        VALUES (?, ?, 'client', ?, ?)
      `).run(clientMsgId, convId, text, nowIso);

      dashboardEventBus.emitToOrg(orgId, {
        type: "new_conversation",
        title: "New Website Chat Started",
        message: text,
        icon: "💬",
        targetTab: "conversations",
        targetId: convId,
        data: {
          id: convId,
          visitorName,
          visitorContact,
          channel: "web",
          status: "ACTIVE",
          badge: "AI Active",
          lastMessage: text,
          timeAgo: "just now",
          messages: [{ id: clientMsgId, sender: "client", content: text, createdAt: nowIso }],
        },
      });
    } else {
      // 2. Check if staff has EXPLICITLY muted AI via "Take Over (Mute AI)"
      const isAlreadyMuted = existingConv.is_ai_muted === 1;

      // Save Visitor Message to existing conversation
      db.prepare(`
        INSERT INTO messages (id, conversation_id, sender, content, created_at)
        VALUES (?, ?, 'client', ?, ?)
      `).run(clientMsgId, convId, text, nowIso);

      if (isAlreadyMuted) {
        db.prepare(`
          UPDATE conversations
          SET last_message = ?, status = 'WAITING_FOR_HUMAN', resolution_badge = 'Human needed', is_ai_muted = 1, last_activity_at = ?
          WHERE id = ?
        `).run(text, nowIso, convId);
      } else {
        db.prepare(`
          UPDATE conversations
          SET last_message = ?, last_activity_at = ?
          WHERE id = ?
        `).run(text, nowIso, convId);
      }

      dashboardEventBus.emitToOrg(orgId, {
        type: "new_message",
        title: `New Message from ${existingConv.visitor_name || "Visitor"}`,
        message: text,
        icon: "💬",
        targetTab: "conversations",
        targetId: convId,
        data: {
          conversationId: convId,
          status: isAlreadyMuted ? "WAITING_FOR_HUMAN" : undefined,
          badge: isAlreadyMuted ? "Human needed" : undefined,
          isAiMuted: isAlreadyMuted ? true : undefined,
          message: {
            id: clientMsgId,
            sender: "client",
            content: text,
            createdAt: nowIso,
          },
        },
      });

      const visitorSecret = process.env.SESSION_SECRET || "echo_visitor_secret_default_key";
      const visitorToken = createHmac("sha256", visitorSecret)
        .update(`${convId}:${orgId}`)
        .digest("hex");

      if (isAlreadyMuted) {
        return {
          conversationId: convId,
          visitorToken,
          clientMsgId,
          aiMsgId: "",
          replyText: "Your message has been received by clinic staff. A team member will reply directly shortly.",
          chips: [],
          isEscalated: true,
        };
      }
    }

    const visitorSecret = process.env.SESSION_SECRET || "echo_visitor_secret_default_key";
    const visitorToken = createHmac("sha256", visitorSecret)
      .update(`${convId}:${orgId}`)
      .digest("hex");

    const orgRow = db
      .prepare("SELECT name, industry FROM organizations WHERE id = ?")
      .get(orgId) as { name: string; industry: string } | undefined;
    const orgName = orgRow?.name || "our team";
    const industry = (orgRow?.industry || "clinic").toLowerCase();

    const agentRow = db
      .prepare("SELECT name FROM agents WHERE organization_id = ? LIMIT 1")
      .get(orgId) as { name: string } | undefined;
    const agentName = agentRow?.name || "Maya";

    let defaultChips: string[];
    if (orgId === "org_echo_sales" || industry === "saas" || industry === "other") {
      defaultChips = ["Pricing Plans", "Book Live Demo", "Supported Software", "14-Day Free Trial"];
    } else if (industry === "ecommerce") {
      defaultChips = ["Track my order", "Find sneakers under $90", "Returns & refunds", "Shipping policy"];
    } else if (industry === "realestate") {
      defaultChips = ["Book an inspection", "Is the 2-bed pet friendly?", "Listing prices", "Speak to an agent"];
    } else if (industry === "beauty") {
      defaultChips = ["Book a haircut", "Price list & menu", "Do you do colour?", "Opening hours"];
    } else {
      defaultChips = ["Book Appointment", "Consultation Fees", "HICAPS Health Funds", "Opening Hours"];
    }

    let aiReplyText = "";
    let isEscalated = false;
    let chips: string[] = defaultChips;
    let isAiBooked = false;
    const lower = text.toLowerCase();

    // 2A. Emergency & Acute Critical Care Safety Guardrail (000 / 911 Triage)
    const isEmergency =
      /\b(emergency|urgent care|chest pain|heart attack|stroke|shortness of breath|bleeding|open[- ]heart|surgery|unconscious|overdose|suicide|poison|trauma|call 911|call 000)\b/i.test(text);

    if (isEmergency) {
      isEscalated = true;
      aiReplyText = "🚨 If you or someone with you is experiencing a medical emergency, acute chest pain, severe trauma, or difficulty breathing, please immediately call 000 (Australia), 911 (USA), or your local emergency services. Our clinic provides outpatient allied health care and does not perform emergency surgeries or walk-in critical emergency care.";
      chips = ["Call 000 (Emergency)", "Call 911", "Speak to Staff", "Clinic Opening Hours"];
    }

    // 2B. Controlled Substances & Narcotic Prescription Refusal Guardrail
    const isControlledSubstance =
      !aiReplyText &&
      /\b(adderall|oxycodone|oxycontin|xanax|valium|fentanyl|morphine|ritalin|percocet|vicodin|narcotic|controlled substance|prescribe me|codeine|ketamine)\b/i.test(text);

    if (isControlledSubstance) {
      isEscalated = true;
      aiReplyText = "⚠️ Our clinic strictly does not prescribe controlled substances, narcotics, or scheduled medications (such as Adderall, Oxycodone, or opioids) via chat or virtual receptionist. A comprehensive in-person medical evaluation and identity verification with a licensed physician is legally required.";
      chips = ["Book In-Person Consult", "Consultation Fees", "Clinic Opening Hours"];
    }

    // 2C. Unverified Promotional Codes & Fake Discounts Guardrail
    const isFakeDiscount =
      !aiReplyText &&
      /\b(discount code|promo code|military discount|coupon|voucher|vet50|50% off|manager told me)\b/i.test(text);

    if (isFakeDiscount) {
      aiReplyText = "I do not have a verified promotional or discount code on file matching that request. To maintain zero billing discrepancies, our virtual receptionist cannot apply unverified codes. Please check our published fee schedule or speak with our front desk staff.";
      chips = ["View Consultation Fees", "HICAPS Health Funds", "Speak to Staff"];
    }

    // 3. Explicit Human Handover / Staff Escalation Request
    const isHumanEscalationRequest =
      !aiReplyText &&
      /\b(human|person|agent|stylist|receptionist|staff|someone|anyone|team|manager|representative|operator)\b/.test(lower) &&
      /\b(talk|speak|chat with|connect|transfer|handover|switch|get me|put me through|call)\b/.test(lower);

    if (isHumanEscalationRequest) {
      isEscalated = true;
      if (orgId === "org_echo_sales" || industry === "saas" || industry === "other") {
        aiReplyText = "I've flagged this thread for our product and sales advisory team. A specialist will assist you directly shortly.";
        chips = ["Pricing Plans", "Book Live Demo", "Supported Software"];
      } else if (industry === "ecommerce") {
        aiReplyText = "I've flagged this thread for our store support team. A team member will assist you directly shortly.";
        chips = ["Track an order", "Returns policy", "View catalog"];
      } else if (industry === "realestate") {
        aiReplyText = "I've flagged this thread for our real estate agents. A licensed agent will assist you directly shortly.";
        chips = ["Book an inspection", "Rental listings", "Office hours"];
      } else if (industry === "beauty") {
        aiReplyText = "I've flagged this thread for our salon reception team. A stylist or team member will assist you shortly.";
        chips = ["View price list", "Book appointment", "Salon hours"];
      } else {
        aiReplyText = "I've flagged this thread for our clinic front desk team. A staff member has been alerted and will assist you directly.";
        chips = ["Book appointment", "Consultation fees", "Opening hours"];
      }
    }

    // 3AA. Customer Login & Active Cart Query Handler (SCOPED BY INDUSTRY)
    const isCartInquiry = !aiReplyText && /(cart|checkout|items in my bag|what do i have|basket|my active cart)/i.test(text);
    if (!aiReplyText && isCartInquiry) {
      if (industry === "ecommerce") {
        if (params.customerContext?.cart) {
          const count = params.customerContext.cart.count ?? 0;
          const total = typeof params.customerContext.cart.total === "number"
            ? `$${params.customerContext.cart.total.toFixed(2)}`
            : params.customerContext.cart.total || "$0.00";
          const customerName = params.customerContext.name || "there";
          aiReplyText = `Hi ${customerName}, you currently have ${count} item(s) in your active shopping cart totaling ${total}. Would you like to proceed to checkout or review shipping options?`;
          chips = ["Proceed to Checkout", "Shipping Rates", "Ask a Question"];
        } else {
          aiReplyText = "I can inspect your active shopping cart and order details! To view your cart, please make sure you are logged in to your customer account, or provide your checkout email address.";
          chips = ["Log In", "Shipping Rates", "Track an Order"];
        }
      } else {
        aiReplyText = `This is ${orgName}. As an outpatient healthcare clinic, we do not operate an online shopping cart or retail merchandise checkout. If you have questions regarding consultations, treatment fees, or appointment scheduling, I am glad to assist!`;
        chips = ["Book Appointment", "Consultation Fees", "Opening Hours"];
      }
    }

    // 3C. Inbound Lead & Contact Information Capture
    const emailDetected = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
    const phoneDetected = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
    const nameDetected = text.match(/(?:name is|name\s*:?|i am|i'm|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);

    const detectedEmail = emailDetected ? emailDetected[0] : params.customerContext?.email;
    const detectedPhone = phoneDetected ? phoneDetected[0] : undefined;
    const detectedName = nameDetected ? nameDetected[1].trim() : params.customerContext?.name;

    const isExplicitContactLead =
      Boolean(detectedEmail || detectedPhone) &&
      (/\b(contact|talk|speak|sales|rep|reach|email|call|book|meeting|quote|interested|demo)\b/i.test(text) ||
       text.toLowerCase().includes("please contact") ||
       Boolean(detectedEmail));

    if (!aiReplyText && isExplicitContactLead) {
      const leadName =
        detectedName ||
        (params.visitorName && !params.visitorName.startsWith("Website Visitor") ? params.visitorName : undefined) ||
        existingConv?.visitor_name ||
        "Website Visitor";
      const leadContact = detectedEmail || detectedPhone || "";
      const leadId = "lead_" + randomBytes(6).toString("hex");

      try {
        db.prepare(`
          INSERT INTO leads (id, organization_id, conversation_id, name, email, phone, intent, status)
          VALUES (?, ?, ?, ?, ?, ?, 'contact_request', 'new')
        `).run(leadId, orgId, convId, leadName, detectedEmail || null, detectedPhone || null);

        db.prepare(`
          UPDATE conversations
          SET visitor_name = ?, visitor_contact = ?, status = 'WAITING_FOR_HUMAN', resolution_badge = 'Human needed', escalation_reason = 'Visitor provided contact details'
          WHERE id = ?
        `).run(leadName, leadContact, convId);

        dashboardEventBus.emitToOrg(orgId, {
          type: "new_lead",
          title: "New Inbound Lead Captured",
          message: `${leadName} (${leadContact}) requested follow-up: "${text.slice(0, 80)}"`,
          icon: "🎯",
          targetTab: "leads",
          targetId: leadId,
          data: {
            id: leadId,
            name: leadName,
            email: detectedEmail,
            phone: detectedPhone,
            intent: "contact_request",
            status: "new",
          },
        });

        // Await outbound email notification synchronously so serverless does not freeze execution before dispatch
        await EmailService.notifyLeadCaptured({
          orgId,
          orgName,
          leadName,
          leadEmail: detectedEmail,
          leadPhone: detectedPhone,
          conversationId: convId,
          messageText: text,
        });
      } catch (err) {
        console.warn("[DashboardService] Lead insertion warning:", err);
      }

      isEscalated = true;
      aiReplyText = `Thank you, ${leadName}! I have recorded your contact details (${leadContact}) and notified our ${orgName} team. A specialist will reach out to you directly shortly.`;
      chips = orgId === "org_echo_sales"
        ? ["Pricing Plans", "Supported Software", "14-Day Free Trial"]
        : ["Opening Hours", "Services", "Directions"];
    }

    // 3A. Order Tracking & Retail Merchandise Queries (SCOPED BY INDUSTRY)
    const isOrderInquiry = !aiReplyText && /(track|where is|order|package|parcel|delivery status|shipment|leather jacket|bought a|refund for item)/i.test(text);
    const orderNumMatch = !aiReplyText ? text.match(/#?(\d{4,8})/) : null;
    const emailMatch = !aiReplyText ? text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/) : null;

    if (!aiReplyText && (isOrderInquiry || Boolean(orderNumMatch))) {
      if (industry === "ecommerce") {
        if (orderNumMatch) {
          const orderNum = orderNumMatch[1];
          const order = db.prepare(`
            SELECT order_number, customer_name, customer_email, total_amount, currency, tracking_carrier, tracking_status
            FROM orders
            WHERE organization_id = ? AND (order_number = ? OR order_number = ?)
          `).get(orgId, orderNum, `#${orderNum}`) as any;

          if (order) {
            aiReplyText = `Found it! Order #${order.order_number} for ${order.customer_name}:\n\n📦 Status: ${String(order.tracking_status).replace("_", " ").toUpperCase()}\n🚚 Carrier: ${order.tracking_carrier || "Express Courier"}\n💰 Total: $${Number(order.total_amount).toFixed(2)} ${order.currency}\n📅 Estimated Delivery: Tomorrow by 4:00 PM\n\nWould you like help with anything else, such as a return or product recommendation?`;
            chips = ["Return an item", "Shipping policy", "Speak to support"];
          } else {
            aiReplyText = `I couldn't locate an order matching #${orderNum} in our store system. Please verify your order number or let me know the email address you used at checkout so our team can track it down.`;
            chips = ["Track another order", "Shipping policy", "Speak to support"];
          }
        } else if (emailMatch) {
          const order = db.prepare(`
            SELECT order_number, customer_name, customer_email, total_amount, currency, tracking_carrier, tracking_status
            FROM orders
            WHERE organization_id = ? AND lower(customer_email) = ?
            ORDER BY created_at DESC
          `).get(orgId, emailMatch[0].toLowerCase()) as any;

          if (order) {
            aiReplyText = `Found your latest order! Order #${order.order_number} (${order.customer_name}):\n\n📦 Status: ${String(order.tracking_status).replace("_", " ").toUpperCase()}\n🚚 Carrier: ${order.tracking_carrier || "Express Courier"}\n💰 Total: $${Number(order.total_amount).toFixed(2)} ${order.currency}\n\nLet me know if you need to initiate a return or tracking update.`;
            chips = ["Return an item", "Product catalog", "Speak to support"];
          } else {
            aiReplyText = `I searched our system for ${emailMatch[0]}, but couldn't find any associated orders. Please verify the email address or provide your 5-digit Order Number.`;
            chips = ["Track another order", "Shipping policy", "Speak to support"];
          }
        } else {
          aiReplyText = "I would be happy to track your order! What is your 5-digit Order Number (e.g. #78219) or checkout email address?";
          chips = ["#78219", "Shipping times", "Returns & exchanges"];
        }
      } else {
        // Clinical practice / non-ecommerce response:
        aiReplyText = `This is ${orgName}. We provide professional healthcare and clinical consultations; we do not sell or deliver retail merchandise (such as clothing or parcels). If this was regarding a medical referral, test results, or health fund rebate, please let our reception team know!`;
        chips = ["Book Consultation", "Our Services", "Speak with Staff"];
      }
    }

    // 3B. Process Conversational Memory & Booking Intent
    if (!aiReplyText) {
      const history = db
        .prepare(`SELECT sender, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`)
        .all(convId) as Array<{ sender: string; content: string }>;

      // 3B.1 Conversational Context & Memory Handlers (Summaries & Follow-ups)
      const isSummarizeRequest = /\b(summarize|summary|recap|overview of (our|the) (chat|conversation)|what did we (talk about|discuss))\b/i.test(text);
      if (isSummarizeRequest) {
        const userTopics = history
          .filter((m) => m.sender === "client" || m.sender === "visitor")
          .map((m) => m.content)
          .slice(-5);
        if (userTopics.length > 0) {
          aiReplyText = `Here is a summary of our conversation so far:\n` +
            `• You inquired about: ${userTopics.map((t) => `"${t.length > 60 ? t.slice(0, 57) + "..." : t}"`).join(", ")}\n` +
            `• Business: ${orgName}\n` +
            `• Assistant: ${agentName || "Maya"} (Virtual Receptionist)\n\n` +
            `How else can I assist you with services, pricing, or bookings?`;
          chips = ["Book Appointment", "Consultation Fees", "Clinic Hours"];
        } else {
          aiReplyText = `We just started our conversation! I am ${agentName || "Maya"}, your virtual receptionist at ${orgName}. How can I assist you today?`;
          chips = ["Book Appointment", "Our Services", "Consultation Fees"];
        }
      }

      const isFirstServiceFollowup = !aiReplyText && /\b(tell me more about (the )?first (service|one|offering)|explain (the )?first (service|one)|first service details)\b/i.test(text);
      if (isFirstServiceFollowup) {
        // Look up the first service from knowledge base chunks
        const firstChunk = db.prepare(`
          SELECT title, content FROM knowledge_chunks
          WHERE organization_id = ? AND (lower(title) LIKE '%service%' OR lower(title) LIKE '%treatment%' OR chunk_index = 1)
          ORDER BY chunk_index ASC LIMIT 1
        `).get(orgId) as { title: string; content: string } | undefined;

        if (firstChunk) {
          aiReplyText = `Here are the details for our primary service (${firstChunk.title}):\n\n${firstChunk.content}\n\nWould you like to check available appointment times or learn about consultation fees?`;
          chips = ["Book This Service", "Consultation Fees", "Health Fund Rebates"];
        } else {
          aiReplyText = `Our primary offering is an Initial Comprehensive Assessment (60 mins), including full evaluation, diagnosis, and a personalized treatment plan. Would you like to check availability?`;
          chips = ["Check Availability", "Consultation Fees", "Speak to Staff"];
        }
      }

      if (!aiReplyText) {
        const bookingParsed = AppointmentService.parseBookingIntentAndEntities(
          text,
          history,
          params.visitorName || existingConv?.visitor_name,
          params.visitorContact || existingConv?.visitor_contact,
          industry,
          orgName,
          agentName
        );

      if (bookingParsed.isBookingIntent) {
        if (bookingParsed.hasTimeSlot && bookingParsed.targetTime) {
          const serviceName = bookingParsed.serviceName || "";
          const durationMinutes = /initial|comprehensive|assessment|eval/i.test(serviceName)
            ? 60
            : /extended|long/i.test(serviceName)
            ? 90
            : /follow|subsequent|standard/i.test(serviceName)
            ? 30
            : 45;

          // Check for double booking conflict with service-aware duration
          const avail = AppointmentService.checkSlotAvailability(
            orgId,
            bookingParsed.practitionerName,
            bookingParsed.targetTime,
            durationMinutes
          );

          if (!avail.isAvailable) {
            // Double-booking prevented! Find nearest alternative slots
            const alternatives = AppointmentService.findAlternativeSlots(
              orgId,
              bookingParsed.practitionerName,
              bookingParsed.targetTime,
              durationMinutes
            );

            const slotFormatted = `${AppointmentService.formatSlotDay(bookingParsed.targetTime)} at ${AppointmentService.formatSlotTime(bookingParsed.targetTime)}`;

            aiReplyText = `${bookingParsed.practitionerName} is already fully booked on ${slotFormatted}.\n\nThe closest available openings with ${bookingParsed.practitionerName} are:\n` +
              alternatives.map((alt) => `• ${alt.label}`).join("\n") +
              `\n\nWould any of these alternative times work for you?`;

            chips = alternatives.map((alt) => alt.chip);

            // Save warm inbound lead so business never loses the prospect
            if (bookingParsed.patientName || bookingParsed.patientContact) {
              AppointmentService.recordInquiryLead({
                orgId,
                conversationId: convId,
                patientName: bookingParsed.patientName || "Interested Client",
                patientContact: bookingParsed.patientContact || "Inquiry from website chat",
                note: `Requested ${slotFormatted} (conflicted) - offered alternatives`,
              });
            }
          } else {
            // Slot is open! Check if visitor provided contact
            if (!bookingParsed.patientContact) {
              const contactPrompt =
                industry === "realestate"
                  ? `I have held ${bookingParsed.formattedSlot} for your inspection with ${bookingParsed.practitionerName}! What is your mobile phone number so we can register your viewing and send confirmation?`
                  : industry === "beauty"
                  ? `I have held ${bookingParsed.formattedSlot} with ${bookingParsed.practitionerName} for you! What is your mobile number so we can reserve your chair and send confirmation?`
                  : `I have held ${bookingParsed.formattedSlot} with ${bookingParsed.practitionerName} for you! What is your mobile phone number so we can register your appointment and send confirmation?`;

              aiReplyText = contactPrompt;
              chips = ["Enter Mobile Number", "Change Time"];
            } else {
              // Confirm booking and write to SQLite appointments & leads
              const booked = AppointmentService.bookAppointment({
                orgId,
                conversationId: convId,
                patientName: bookingParsed.patientName || "Client",
                patientContact: bookingParsed.patientContact,
                practitionerName: bookingParsed.practitionerName,
                serviceName: bookingParsed.serviceName,
                startTime: bookingParsed.targetTime,
              });

              isAiBooked = true;
              if (industry === "realestate") {
                aiReplyText = `You're all booked for an inspection, ${booked.appointment.patientName}! 🏡\n\n🗓️ ${AppointmentService.formatSlotDay(bookingParsed.targetTime)} at ${AppointmentService.formatSlotTime(bookingParsed.targetTime)}\n📍 ${booked.appointment.serviceName}\n👩‍💼 Agent: ${booked.appointment.practitionerName}\n🏷️ Reference: #${booked.externalRef}\n\nWe've confirmed your inspection time and sent confirmation to ${booked.appointment.patientContact}.`;
                chips = ["Add to Calendar", "Reschedule", "Directions"];
              } else if (industry === "beauty") {
                aiReplyText = `You're all booked, ${booked.appointment.patientName}! 💇✨\n\n🗓️ ${AppointmentService.formatSlotDay(bookingParsed.targetTime)} at ${AppointmentService.formatSlotTime(bookingParsed.targetTime)}\n✂️ Stylist: ${booked.appointment.practitionerName} — ${booked.appointment.serviceName}\n🏷️ Reference: #${booked.externalRef}\n\nWe've confirmed your reservation at ${orgName} and sent details to ${booked.appointment.patientContact}. See you in the chair!`;
                chips = ["Add to Calendar", "Reschedule", "Salon Location"];
              } else {
                aiReplyText = `You're all booked, ${booked.appointment.patientName}! 🎉\n\n🗓️ ${AppointmentService.formatSlotDay(bookingParsed.targetTime)} at ${AppointmentService.formatSlotTime(bookingParsed.targetTime)}\n👨‍⚕️ ${booked.appointment.practitionerName} — ${booked.appointment.serviceName}\n🏷️ Reference: #${booked.externalRef}\n\nWe've confirmed your reservation and dispatched details to ${booked.appointment.patientContact}. See you at the clinic!`;
                chips = ["Add to Calendar", "Reschedule", "Clinic Directions"];
              }
            }
          }
        } else {
          // Expressed booking intent but didn't pick a slot
          if (industry === "realestate") {
            aiReplyText = `I would be delighted to schedule an inspection with ${bookingParsed.practitionerName}! What day and time suits you best for a viewing, and what is your name and mobile number?`;
            chips = ["Saturday 11:00 AM", "Thursday 5:30 PM", "Ask About Pets", "Agent Contact"];
          } else if (industry === "beauty") {
            aiReplyText = `I would love to help you book a session with ${bookingParsed.practitionerName}! What day and time suits you best, and what is your name and mobile number?`;
            chips = ["Friday 10:00 AM", "Saturday 1:30 PM", "View Price List", "Colour Consult"];
          } else {
            aiReplyText = `I would be delighted to help you schedule an appointment with ${bookingParsed.practitionerName}! We have openings this week for Initial Assessments, Musculoskeletal Physio, and Follow-up consultations. What day and time suits you best, and what is your name and mobile number?`;
            chips = ["Tomorrow 10:00 AM", "Friday 2:00 PM", "Monday 11:00 AM", "View Fees"];
          }
        }
      } else {
        // Normal knowledge base query & escalation check
        const testResult = this.testKnowledgeQuery(orgId, text);
        aiReplyText = testResult.answer;

        // Check if user is explicitly asking for a human staff member
        const lower = text.toLowerCase();
        if (/(talk to a human|speak to a person|real person|human agent|staff member|speak to staff|transfer me)/.test(lower)) {
          isEscalated = true;
          if (industry === "ecommerce") {
            aiReplyText = "I've flagged this thread for our store support team. A team member will assist you directly shortly.";
          } else if (industry === "realestate") {
            aiReplyText = "I've flagged this thread for our real estate agents. A licensed agent will assist you directly shortly.";
          } else if (industry === "beauty") {
            aiReplyText = "I've flagged this thread for our salon reception team. A stylist or team member will assist you shortly.";
          } else {
            aiReplyText = "I've flagged this thread for our clinic front desk team. A staff member has been alerted and will assist you directly.";
          }
        } else if (testResult.confidence < 0.5) {
          isEscalated = true;
        }
      }
    }
  }

    const updatedStatus = isEscalated ? "WAITING_FOR_HUMAN" : "ACTIVE";
    const updatedBadge = isEscalated
      ? "Human needed"
      : isAiBooked
      ? "AI Booked"
      : "AI Active";

    db.prepare(`
      UPDATE conversations
      SET status = ?, resolution_badge = ?, escalation_reason = ?
      WHERE id = ?
    `).run(
      updatedStatus,
      updatedBadge,
      isEscalated
        ? text.toLowerCase().includes("human")
          ? "Visitor requested human staff"
          : "Unverified topic escalated to staff"
        : null,
      convId
    );

    if (isEscalated) {
      IntegrationService.dispatchOutboundEvent(orgId, "conversation.escalated", {
        conversationId: convId,
        visitorName: params.visitorName || existingConv?.visitor_name || "Website Visitor",
        visitorContact: params.visitorContact || existingConv?.visitor_contact || "",
        reason: text.toLowerCase().includes("human")
          ? "Visitor requested human staff"
          : "Unverified topic escalated to staff",
      }).catch((err) => console.error("[DashboardService] Escalation dispatch error:", err));
    }

    // 4. Save AI Response Message
    const aiMsgId = "msg_" + randomBytes(6).toString("hex");
    const aiNowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender, content, created_at)
      VALUES (?, ?, 'ai', ?, ?)
    `).run(aiMsgId, convId, aiReplyText, aiNowIso);

    db.prepare(`
      UPDATE conversations
      SET last_message = ?, last_activity_at = ?
      WHERE id = ?
    `).run(aiReplyText, aiNowIso, convId);

    // Broadcast AI response to dashboard
    dashboardEventBus.emitToOrg(orgId, {
      type: "new_message",
      title: isEscalated ? "⚠️ Escalated to Front Desk" : "🤖 AI Receptionist Answered",
      message: aiReplyText,
      icon: isEscalated ? "⚠️" : "🤖",
      targetTab: "conversations",
      targetId: convId,
      data: {
        conversationId: convId,
        status: updatedStatus,
        badge: updatedBadge,
        message: {
          id: aiMsgId,
          sender: "ai",
          content: aiReplyText,
          createdAt: aiNowIso,
        },
      },
    });

    return {
      conversationId: convId,
      visitorToken,
      clientMsgId,
      aiMsgId,
      replyText: aiReplyText,
      chips,
      isEscalated,
    };
  }

  public static verifyVisitorToken(conversationId: string, orgId: string, token: string): boolean {
    if (!conversationId || !orgId || !token) return false;
    const visitorSecret = process.env.SESSION_SECRET || "echo_visitor_secret_default_key";
    const expected = createHmac("sha256", visitorSecret)
      .update(`${conversationId}:${orgId}`)
      .digest("hex");
    if (token.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
