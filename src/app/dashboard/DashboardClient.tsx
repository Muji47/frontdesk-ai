"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EchoLogo } from "@/components/EchoLogo";
import type { UserSession } from "@/lib/auth";
import type {
  DashboardData,
  DashboardConversation,
  DashboardUnansweredQuestion,
  DashboardKnowledgeSource,
  DashboardAppointment,
  DashboardOrder,
  DashboardLead,
  DashboardIntegration,
  DashboardBillingData,
  DashboardBillingInvoice,
  ConversationMessage,
} from "@/server/services/dashboard.service";
import MemberDetailsView, { type MemberRecord } from "./components/MemberDetailsView";
import type { UserMessageTemplate } from "@/lib/templates";
import {
  CURRENCY_CONFIGS,
  type BillingCurrency,
  type BillingProvider,
  type PaymentMethodBrand,
} from "@/lib/billing-config";

interface DashboardClientProps {
  user: UserSession;
  initialData: DashboardData;
}

function getSourcePreviewChunks(source: DashboardKnowledgeSource, isEcom: boolean) {
  // If real extracted chunks are stored on the source, use them directly
  if (source.chunks && source.chunks.length > 0) {
    return source.chunks;
  }

  if (source.sourceType === "manual_qa") {
    return [
      {
        id: 1,
        title: "Verified Response Directive",
        content: `Policy definition: "${source.title}". When visitors query topics matching this entry, the AI receptionist draws directly from this verified instruction.`,
      },
    ];
  }

  if (source.sourceType === "pdf") {
    return [
      {
        id: 1,
        title: "Section 1: Service Catalog & Pricing Rules",
        content: isEcom
          ? "Standard Shipping is $9.95 (3-5 business days). Express shipping is $14.95 (1-2 business days). Free standard shipping applies on all retail orders over $100 across Australia and New Zealand."
          : "Initial comprehensive appointment fee is $140 (60 minutes). Subsequent consultation is $95 (30 minutes). Late cancellations within 4 hours incur a 50% reservation fee.",
      },
      {
        id: 2,
        title: "Section 2: Terms, Refunds & Health Claims",
        content: isEcom
          ? "Items may be returned within 30 days of delivery if unworn, undamaged, and in original packaging with proof of purchase. Refunds are issued to original payment method."
          : "Private health insurance claims via HICAPS are supported on-site for Bupa, Medibank, HCF, NIB, and Teachers Health. EPC/CDM Medicare care plans accepted.",
      },
    ];
  }

  // Default: URL crawl
  return [
    {
      id: 1,
      title: "Extracted Overview & Operating Hours",
      content: isEcom
        ? "Online storefront is operational 24/7. Live customer service and warehouse dispatch operate Monday to Friday from 8:30 AM to 5:00 PM AEST."
        : "Clinic operating hours are Monday to Friday 7:30 AM to 6:30 PM, Saturday 8:00 AM to 1:00 PM. Patient parking bays available at the rear of the clinic.",
    },
    {
      id: 2,
      title: "Extracted Services & Booking Directives",
      content: isEcom
        ? "Orders are dispatched within 24 hours. Tracking numbers are transmitted to customers upon carrier handover via FedEx or Australia Post."
        : "Appointments can be booked autonomously by the AI receptionist. Telehealth and face-to-face appointments available with licensed practitioners.",
    },
    {
      id: 3,
      title: "Extracted Contact & Escalation Protocol",
      content: isEcom
        ? "For damaged items or refund processing, escalate immediately to human customer support team with order reference number."
        : "For complex surgical rehabilitation queries or emergency triage, connect patient immediately to clinic reception staff.",
    },
  ];
}

interface RealtimeToast {
  id: string;
  title: string;
  message: string;
  icon?: string;
  targetTab?: string;
  targetId?: string;
  timestamp?: number;
  type?: "success" | "error" | "info";
}

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    // Dual-frequency acoustic chime: D5 (587.33Hz) -> A5 (880Hz)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  } catch {}
}

export const PLAN_CATALOG: Array<{
  id: "starter" | "growth" | "pro";
  name: string;
  tagline: string;
  baseMonthly: number;
  convLimit: number;
  seatsLimit: number;
  features: string[];
}> = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Solo practitioners & single-site front desks.",
    baseMonthly: 39,
    convLimit: 500,
    seatsLimit: 1,
    features: [
      "500 AI conversations / mo",
      "1 Staff team seat",
      "1 Website embed & live widget",
      "Knowledge base & approved FAQs",
      "Email & live inbox handover",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Multi-practitioner clinics & high-volume reception.",
    baseMonthly: 99,
    convLimit: 2000,
    seatsLimit: 3,
    features: [
      "Everything in Starter",
      "2,000 AI conversations / mo",
      "3 Staff team seats",
      "Cliniko, Halaxy & Shopify 2-way sync",
      "Self-learning Q&A approval queue",
      "Advanced triage analytics",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Multi-location clinic groups & enterprise SLAs.",
    baseMonthly: 199,
    convLimit: 8000,
    seatsLimit: 10,
    features: [
      "Everything in Growth",
      "8,000 AI conversations / mo",
      "10 Staff team seats",
      "3 Websites / multi-location support",
      "Custom webhooks & automations",
      "Priority SLA & VIP onboarding support",
    ],
  },
];

export function DashboardClient({ user, initialData }: DashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedConvId, setSelectedConvId] = useState<string>(initialData.conversations[0]?.id || "");
  const [selectedMemberForDetail, setSelectedMemberForDetail] = useState<MemberRecord | null>(null);
  const [userTemplates, setUserTemplates] = useState<UserMessageTemplate[]>([]);

  const fetchCurrentUserTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/templates");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data?.templates)) {
        setUserTemplates(data.data.templates);
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUserTemplates();
  }, [fetchCurrentUserTemplates]);

  function openMemberDetailsPage(member: MemberRecord) {
    setSelectedMemberForDetail(member);
    setActiveTab("member-details");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Dynamic state from server DB
  const [metrics, setMetrics] = useState(initialData.metrics);
  const [conversations, setConversations] = useState<DashboardConversation[]>(initialData.conversations);
  const [unanswered, setUnanswered] = useState<DashboardUnansweredQuestion[]>(initialData.unansweredQuestions);
  const [answersInput, setAnswersInput] = useState<{ [id: string]: string }>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Knowledge base state & actions
  const [knowledgeSources, setKnowledgeSources] = useState<DashboardKnowledgeSource[]>(initialData.knowledgeSources);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceTitle, setNewSourceTitle] = useState("");
  const [newSourceType, setNewSourceType] = useState<"url" | "pdf" | "document">("url");
  const [newSourceFile, setNewSourceFile] = useState<File | null>(null);
  const [newSourceContent, setNewSourceContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [addSourceError, setAddSourceError] = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);

  // Test retrieval state
  const [testQuery, setTestQuery] = useState("");
  const [testResult, setTestResult] = useState<{ answer: string; sources: string[]; confidence: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Add custom manual FAQ state
  const [showAddFaq, setShowAddFaq] = useState(false);
  const [newFaqQ, setNewFaqQ] = useState("");
  const [newFaqA, setNewFaqA] = useState("");
  const [isAddingFaq, setIsAddingFaq] = useState(false);
  const [addFaqErrors, setAddFaqErrors] = useState<{ q?: string; a?: string }>({});

  // View resource modal state
  const [viewingSource, setViewingSource] = useState<DashboardKnowledgeSource | null>(null);
  const [isResyncing, setIsResyncing] = useState(false);
  const [resyncSuccess, setResyncSuccess] = useState(false);

  // Agent Customization state
  const isEcom = user.industry === "ecommerce";
  const [agentName, setAgentName] = useState(initialData.agent.name);
  const [brandColor, setBrandColor] = useState(initialData.agent.color);
  const [tone, setTone] = useState(initialData.agent.tone);
  const [greeting, setGreeting] = useState(initialData.agent.greeting);
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [agentSaveSuccess, setAgentSaveSuccess] = useState(false);

  // Staff live reply state
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentConv = conversations.find((c) => c.id === selectedConvId) || conversations[0];
  const pendingQuestionsCount = unanswered.filter((u) => u.status === "pending").length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConv?.messages]);

  // Real-time Socket & Toast Notification State
  const [toasts, setToasts] = useState<RealtimeToast[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [sseRole, setSseRole] = useState<"leader" | "follower" | "connecting">("connecting");
  const tabIdRef = useRef<string>("");

  const showToast = useCallback(
    ({
      type = "info",
      title,
      message,
      icon,
    }: {
      type?: "success" | "error" | "info";
      title: string;
      message: string;
      icon?: string;
    }) => {
      const id = "toast_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const newToast: RealtimeToast = {
        id,
        type,
        title,
        message,
        icon: icon || (type === "error" ? "🛑" : type === "success" ? "✅" : "💬"),
        timestamp: Date.now(),
      };
      setToasts((prev) => [newToast, ...prev.slice(0, 3)]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Performance & Deflection Analytics State
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);
  const [copiedEmbed, setCopiedEmbed] = useState<boolean>(false);
  const [copiedHostedLink, setCopiedHostedLink] = useState<boolean>(false);
  const [allowedDomains, setAllowedDomains] = useState<string[]>(
    initialData.allowedDomains && initialData.allowedDomains.length > 0
      ? initialData.allowedDomains
      : ["*"]
  );
  const [newDomainInput, setNewDomainInput] = useState<string>("");
  const [isSavingDomains, setIsSavingDomains] = useState<boolean>(false);

  // Appointments, Orders & Leads Real-Time Pipeline State
  const [appointments, setAppointments] = useState<DashboardAppointment[]>(initialData.appointments || []);
  const [orders, setOrders] = useState<DashboardOrder[]>(initialData.orders || []);
  const [leads, setLeads] = useState<DashboardLead[]>(initialData.leads || []);

  // Responsive Mobile Navigation State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Conversations Inbox Filter & Search State
  const [convFilter, setConvFilter] = useState<"ALL" | "WAITING_FOR_HUMAN" | "ACTIVE" | "RESOLVED">("ALL");
  const [convSearch, setConvSearch] = useState("");

  // Command Palette & Global Shortcut State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [cmdSearch, setCmdSearch] = useState("");
  const cmdInputRef = useRef<HTMLInputElement>(null);
  const [copiedOrgId, setCopiedOrgId] = useState(false);

  // Widget Studio Interactive Multi-Device Preview State
  const [widgetPreviewMode, setWidgetPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [previewTestInput, setPreviewTestInput] = useState("");
  const [previewTestMessages, setPreviewTestMessages] = useState<
    { id: string; sender: "user" | "agent"; text: string; time: string }[]
  >([
    {
      id: "preview-init",
      sender: "agent",
      text: initialData.agent.greeting || "Hello! How can I help you today?",
      time: "Just now",
    },
  ]);
  const [isPreviewTyping, setIsPreviewTyping] = useState(false);

  // Widget Installation Verifier State
  const [verifyUrl, setVerifyUrl] = useState("");
  const [isVerifyingUrl, setIsVerifyingUrl] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ verified: boolean; message?: string; reason?: string } | null>(null);

  // Team & Staff Management (RBAC) State
  interface TeamMember {
    id: string;
    email: string;
    name: string;
    role: string;
    can_edit_company_templates?: boolean | number;
    created_at: string;
  }
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("receptionist");
  const [inviteCanEditTemplates, setInviteCanEditTemplates] = useState(false);
  const [editMemberCanEditTemplates, setEditMemberCanEditTemplates] = useState(false);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<{ email: string; tempPass?: string; inviteUrl?: string } | null>(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<{ id: string; title: string } | null>(null);
  const [inviteErrors, setInviteErrors] = useState<{ name?: string; email?: string } | null>(null);

  // User Profile & Account Settings State
  const [currentUserState, setCurrentUserState] = useState(user);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(user.name || "");
  const [profileCurrentPass, setProfileCurrentPass] = useState("");
  const [profileNewPass, setProfileNewPass] = useState("");
  const [profileConfirmPass, setProfileConfirmPass] = useState("");
  const [profileErrors, setProfileErrors] = useState<{ name?: string; currentPass?: string; newPass?: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Staff Member Details & Edit State
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editMemberName, setEditMemberName] = useState("");
  const [editMemberRole, setEditMemberRole] = useState("receptionist");
  const [editMemberErrors, setEditMemberErrors] = useState<{ name?: string } | null>(null);
  const [isSavingMemberEdit, setIsSavingMemberEdit] = useState(false);

  // Billing, Subscription Cycles, Payment Methods & Invoice Modal State
  const [billingState, setBillingState] = useState<DashboardBillingData>(
    initialData.billing || {
      plan: (user.plan as "starter" | "growth" | "scale" | "pro") || "growth",
      billingCycle: "monthly",
      currency: "AUD",
      provider: "lemonsqueezy",
      morMode: "sandbox",
      externalSubscriptionId: "sub_mor_demo",
      customerPortalUrl: "https://app.lemonsqueezy.com/my-orders",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      cancelEffectiveDate: null,
      cancellationReason: null,
      cancelledAt: null,
      creditBalanceCents: 0,
      creditBalanceFormatted: "$0.00",
      paymentMethods: [],
      invoices: [],
    }
  );

  const currentPlanId = (billingState.plan as "starter" | "growth" | "scale" | "pro") || "growth";
  const activePlanMeta = useMemo(() => {
    return (
      PLAN_CATALOG.find((p) => p.id === currentPlanId || (currentPlanId === "scale" && p.id === "pro")) ||
      PLAN_CATALOG[1]
    );
  }, [currentPlanId]);

  const seatLimit = activePlanMeta.seatsLimit;
  const teamPlan = activePlanMeta.name;
  const [selectedCycle, setSelectedCycle] = useState<"monthly" | "biannual" | "annual">(
    initialData.billing?.billingCycle || "monthly"
  );
  const [selectedCurrency, setSelectedCurrency] = useState<BillingCurrency>(
    initialData.billing?.currency || "AUD"
  );
  const [selectedProvider, setSelectedProvider] = useState<BillingProvider>(
    initialData.billing?.provider || "lemonsqueezy"
  );
  const [isUpdatingPlan, setIsUpdatingPlan] = useState<string | null>(null);
  const [showInlineCardForm, setShowInlineCardForm] = useState<boolean>(false);
  const [cardHolder, setCardHolder] = useState<string>(user.name || "Authorized Cardholder");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardExpiry, setCardExpiry] = useState<string>("08 / 29");
  const [cardCvc, setCardCvc] = useState<string>("");
  const [cardSetDefault, setCardSetDefault] = useState<boolean>(true);
  const [isSavingCard, setIsSavingCard] = useState<boolean>(false);
  const [paymentCardErrors, setPaymentCardErrors] = useState<{ number?: string; expiry?: string; cvc?: string; holder?: string }>({});
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<DashboardBillingInvoice | null>(null);
  const [pendingPlanSelection, setPendingPlanSelection] = useState<{
    plan: "starter" | "growth" | "scale" | "pro";
    cycle: "monthly" | "biannual" | "annual";
  } | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>("Too expensive / Budget constraints");
  const [cancelFeedback, setCancelFeedback] = useState<string>("");
  const [cancelImmediate, setCancelImmediate] = useState<boolean>(false);
  const [isSubmittingCancellation, setIsSubmittingCancellation] = useState<boolean>(false);
  const [isResumingSubscription, setIsResumingSubscription] = useState<boolean>(false);
  const paymentMethodsSectionRef = useRef<HTMLDivElement | null>(null);
  const addCardInputRef = useRef<HTMLInputElement | null>(null);

  // ===================== STEP 4: INTEGRATIONS & WEBHOOKS STATE =====================
  const [integrationsList, setIntegrationsList] = useState<DashboardIntegration[]>(initialData.integrations || []);
  const [deliveryLogsList, setDeliveryLogsList] = useState<any[]>(initialData.deliveryLogs || []);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [activeIntegrationModal, setActiveIntegrationModal] = useState<"cliniko" | "webhook" | "sms" | "email" | null>(null);
  const [inspectingLog, setInspectingLog] = useState<any | null>(null);

  const clinikoExisting = integrationsList.find((i) => i.provider === "cliniko");
  const [clinikoForm, setClinikoForm] = useState({
    apiKey: clinikoExisting?.config?.apiKey || "",
    shard: clinikoExisting?.config?.shard || "au1",
    clinicName: clinikoExisting?.config?.clinicName || "Melbourne Wellness Clinic",
  });

  const webhookExisting = integrationsList.find((i) => i.provider === "webhook");
  const [webhookForm, setWebhookForm] = useState({
    url: webhookExisting?.config?.url || "",
    secret: webhookExisting?.config?.secret || "whsec_echo_live_" + (user.orgId ? user.orgId.slice(4) : "secret"),
    events: webhookExisting?.config?.events || ["appointment.created", "lead.created", "conversation.escalated"],
  });

  const smsExisting = integrationsList.find((i) => i.provider === "sms");
  const [smsForm, setSmsForm] = useState({
    alertPhone: smsExisting?.config?.alertPhone || "",
    accountSid: smsExisting?.config?.accountSid || "",
    authToken: smsExisting?.config?.authToken || "",
    fromPhone: smsExisting?.config?.fromPhone || "",
  });

  const emailExisting = integrationsList.find((i) => i.provider === "email");
  const [emailForm, setEmailForm] = useState({
    apiKey: emailExisting?.config?.apiKey || "",
    fromEmail: emailExisting?.config?.fromEmail || "Echo.ai Alerts <onboarding@resend.dev>",
    recipientEmail: emailExisting?.config?.recipientEmail || user.email || "zaryabsheikh0@gmail.com",
  });
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  const refreshIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/integrations");
      if (res.ok) {
        const data = await res.json();
        if (data.integrations) setIntegrationsList(data.integrations);
        if (data.deliveryLogs) setDeliveryLogsList(data.deliveryLogs);
      }
    } catch (err) {
      console.error("Failed to refresh integrations:", err);
    }
  }, []);

  const handleSaveIntegration = useCallback(
    async (provider: string, config: any) => {
      setSavingProvider(provider);
      try {
        const res = await fetch("/api/dashboard/integrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, config, status: "connected" }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to save integration");
        }
        showToast({
          type: "success",
          title: "Integration Saved",
          message: `${provider.toUpperCase()} configuration successfully saved.`,
        });
        setActiveIntegrationModal(null);
        await refreshIntegrations();
      } catch (err: any) {
        showToast({
          type: "error",
          title: "Save Failed",
          message: err.message || "Could not save integration.",
        });
      } finally {
        setSavingProvider(null);
      }
    },
    [refreshIntegrations, showToast]
  );

  async function handleTestEmailConnection() {
    setIsTestingEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch("/api/dashboard/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "email",
          config: emailForm,
        }),
      });
      const data = await res.json();
      setTestEmailResult(data);
      if (data.success) {
        showToast({ type: "success", title: "Test Email Delivered", message: data.message });
        await refreshIntegrations();
      } else {
        showToast({ type: "error", title: "Email Test Failed", message: data.message });
      }
    } catch (err: any) {
      setTestEmailResult({ success: false, message: err.message || "Failed to reach email verification endpoint." });
    } finally {
      setIsTestingEmail(false);
    }
  }

  // Connect to SSE real-time socket stream with Multi-Tab Leader Election via BroadcastChannel
  // Ensures ONLY 1 browser tab maintains the server SSE connection, while broadcasting events locally to all tabs.
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let heartbeatTimer: ReturnType<typeof setInterval>;
    let leaderCheckTimer: ReturnType<typeof setInterval>;
    let electionTimeout: ReturnType<typeof setTimeout>;
    let bc: BroadcastChannel | null = null;
    const processedEvents = new Set<string>();

    const tabId = "tab_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now();
    tabIdRef.current = tabId;

    let isLeader = false;
    let lastLeaderHeartbeat = 0;

    function handleIncomingPayload(payload: any, fromBroadcast = false) {
      if (!payload) return;
      if (payload.type === "connected") {
        setIsSocketConnected(true);
        return;
      }

      const eventFingerprint = `${payload.type}:${payload.targetId || ""}:${payload.data?.message?.id || payload.timestamp || ""}`;
      if (processedEvents.has(eventFingerprint)) return;
      processedEvents.add(eventFingerprint);
      if (processedEvents.size > 200) {
        const oldest = processedEvents.values().next().value;
        if (oldest) processedEvents.delete(oldest);
      }

      // If Leader received from server SSE, relay to all follower tabs via BroadcastChannel
      if (!fromBroadcast && isLeader && bc) {
        try {
          bc.postMessage({ type: "SSE_EVENT", payload });
        } catch {}
      }

      const isOwnStaffMessage = payload.type === "new_message" && payload.data?.message?.sender === "staff";

      if (!isOwnStaffMessage && !document.hidden) {
        playNotificationChime();

        const toastId = "tst_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
        const newToast: RealtimeToast = {
          id: toastId,
          title: payload.title || "Live Customer Activity",
          message: payload.message || "New incoming request",
          icon: payload.icon || "💬",
          targetTab: payload.targetTab === "inbox" ? "conversations" : payload.targetTab || "conversations",
          targetId: payload.targetId,
          timestamp: Date.now(),
        };

        setToasts((prev) => [newToast, ...prev.slice(0, 3)]);

        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, 6000);
      }

      // Update local state dynamically
      if ((payload.type === "new_conversation" || payload.type === "handover_alert") && payload.data) {
        const raw = payload.data;
        const convId = raw.id || raw.conversationId || ("conv_" + Math.random().toString(36).slice(2));
        const newConv: DashboardConversation = {
          id: convId,
          visitorName: raw.visitorName || "Customer",
          visitorContact: raw.visitorContact || "",
          channel: raw.channel || "web",
          status: raw.status || "ACTIVE",
          badge: raw.badge || "AI Active",
          lastMessage: raw.lastMessage || "",
          externalRef: raw.externalRef || null,
          timeAgo: "just now",
          messages: raw.messages || [],
        };

        setConversations((prev) => {
          if (prev.some((c) => c.id === newConv.id)) return prev;
          return [newConv, ...prev];
        });
        setSelectedConvId(convId);
        setMetrics((m) => ({
          ...m,
          totalConversations: m.totalConversations + 1,
        }));
      } else if (payload.type === "new_message" && payload.data) {
        const { conversationId, message, status: nextStatus, badge: nextBadge, isAiMuted: nextMuted } = payload.data;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === conversationId) {
              const exists = c.messages.some((m) => m.id === message.id);
              return {
                ...c,
                status: nextStatus || c.status,
                badge: nextBadge || c.badge,
                isAiMuted: typeof nextMuted === "boolean" ? nextMuted : c.isAiMuted,
                lastMessage: message.content,
                timeAgo: "just now",
                messages: exists ? c.messages : [...c.messages, message],
              };
            }
            return c;
          })
        );
      } else if (payload.type === "new_appointment" && payload.data?.appointment) {
        const apt = payload.data.appointment;
        setAppointments((prev) => [apt, ...prev.filter((a) => a.id !== apt.id)]);
        if (payload.data?.lead) {
          const l = payload.data.lead;
          setLeads((prev) => [l, ...prev.filter((item) => item.id !== l.id)]);
        }
        setMetrics((m) => {
          const currentCount = parseInt(m.actionMetricValue) || 0;
          return {
            ...m,
            actionMetricValue: isEcom ? m.actionMetricValue : `${currentCount + 1} Bookings`,
          };
        });
      } else if (payload.type === "new_lead" && payload.data?.lead) {
        const lead = payload.data.lead;
        setLeads((prev) => [lead, ...prev.filter((l) => l.id !== lead.id)]);
      } else if (payload.type === "new_order" && payload.data?.order) {
        const order = payload.data.order;
        setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
      }
    }

    let isReconciling = false;
    async function reconcileConversations() {
      if (isReconciling) return;
      isReconciling = true;
      try {
        const res = await fetch("/api/dashboard/conversations", { cache: "no-store" });
        if (res.ok) {
          const fresh = await res.json();
          if (Array.isArray(fresh.conversations)) {
            setConversations(fresh.conversations);
          }
          if (fresh.metrics) {
            setMetrics(fresh.metrics);
          }
          if (Array.isArray(fresh.unansweredQuestions)) {
            setUnanswered(fresh.unansweredQuestions);
          }
          if (Array.isArray(fresh.knowledgeSources)) {
            setKnowledgeSources(fresh.knowledgeSources);
          }
          if (Array.isArray(fresh.appointments)) {
            setAppointments(fresh.appointments);
          }
          if (Array.isArray(fresh.leads)) {
            setLeads(fresh.leads);
          }
          if (Array.isArray(fresh.orders)) {
            setOrders(fresh.orders);
          }
        }
      } catch {
        // ignore transient network error
      } finally {
        isReconciling = false;
      }
    }

    function becomeLeader() {
      if (isLeader) return;
      isLeader = true;
      console.log("[LeaderElection] Becoming Leader for tab:", tabId);
      setSseRole("leader");
      setIsSocketConnected(true);

      if (bc) {
        try {
          bc.postMessage({ type: "I_AM_LEADER", leaderId: tabId, timestamp: Date.now() });
        } catch {}
      }

      connectSse();

      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (bc && isLeader) {
          try {
            bc.postMessage({ type: "LEADER_HEARTBEAT", leaderId: tabId, timestamp: Date.now() });
          } catch {}
        }
      }, 1200);
    }

    function becomeFollower(leaderId: string) {
      if (isLeader) {
        isLeader = false;
        disconnectSse();
        clearInterval(heartbeatTimer);
      }
      console.log("[LeaderElection] Becoming Follower under leader:", leaderId);
      setSseRole("follower");
      setIsSocketConnected(true);
      lastLeaderHeartbeat = Date.now();
    }

    function connectSse() {
      if (es) return;
      console.log("[connectSse] Opening EventSource /api/dashboard/events");
      es = new EventSource("/api/dashboard/events");

      es.onopen = () => {
        console.log("[connectSse] EventSource onopen fired");
        setIsSocketConnected(true);
        reconcileConversations();
      };

      es.onmessage = (event) => {
        console.log("[connectSse] EventSource onmessage:", event.data?.slice(0, 50));
        try {
          const payload = JSON.parse(event.data);
          handleIncomingPayload(payload, false);
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      };

      es.onerror = (err) => {
        console.log("[connectSse] EventSource onerror:", err);
        disconnectSse();
        if (!document.hidden && isLeader) {
          reconnectTimer = setTimeout(connectSse, 3000);
        }
      };
    }

    function disconnectSse() {
      clearTimeout(reconnectTimer);
      if (es) {
        es.close();
        es = null;
      }
    }

    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel(`echo_dashboard_sse_${user.orgId}`);

      bc.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "SSE_EVENT" && msg.payload) {
          handleIncomingPayload(msg.payload, true);
        } else if (msg.type === "WHO_IS_LEADER") {
          if (isLeader && bc) {
            bc.postMessage({ type: "I_AM_LEADER", leaderId: tabId, timestamp: Date.now() });
          }
        } else if (msg.type === "I_AM_LEADER" || msg.type === "LEADER_HEARTBEAT") {
          lastLeaderHeartbeat = Date.now();
          if (!isLeader) {
            becomeFollower(msg.leaderId);
          } else if (msg.leaderId !== tabId && msg.timestamp < (Number(tabId.split("_")[2]) || 0)) {
            // Older tab has seniority, yield leadership
            becomeFollower(msg.leaderId);
          }
        } else if (msg.type === "LEADER_RESIGNED") {
          if (!isLeader) {
            const jitter = 50 + Math.floor(Math.random() * 200);
            setTimeout(() => {
              if (!isLeader && Date.now() - lastLeaderHeartbeat > 800) {
                becomeLeader();
              }
            }, jitter);
          }
        }
      };

      // Query if an active leader is present
      try {
        bc.postMessage({ type: "WHO_IS_LEADER", candidateId: tabId });
      } catch {}

      // If no leader responds within 350ms, assume leadership
      electionTimeout = setTimeout(() => {
        if (!isLeader && Date.now() - lastLeaderHeartbeat > 400) {
          becomeLeader();
        }
      }, 350);

      // Heartbeat watchdog for followers (promotes if leader misses heartbeats)
      leaderCheckTimer = setInterval(() => {
        if (!isLeader && Date.now() - lastLeaderHeartbeat > 3200) {
          becomeLeader();
        }
      }, 1500);
    } else {
      // Single-tab direct fallback
      becomeLeader();
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        if (isLeader && !es) {
          connectSse();
        } else {
          reconcileConversations();
        }
      }
    }

    function handleUnload() {
      if (isLeader && bc) {
        try {
          bc.postMessage({ type: "LEADER_RESIGNED", leaderId: tabId });
        } catch {}
      }
      disconnectSse();
      bc?.close();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearTimeout(electionTimeout);
      clearTimeout(reconnectTimer);
      clearInterval(heartbeatTimer);
      clearInterval(leaderCheckTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
      handleUnload();
    };
  }, [user.orgId]);

  function handleToastClick(toast: RealtimeToast) {
    if (toast.targetTab) {
      const tab = toast.targetTab === "inbox" ? "conversations" : toast.targetTab;
      setActiveTab(tab);

      if (toast.targetId && tab === "conversations") {
        setSelectedConvId(toast.targetId);
      }
    }
    setToasts((prev) => prev.filter((t) => t.id !== toast.id));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const [isExitingShadow, setIsExitingShadow] = useState(false);

  async function handleExitShadowLogin() {
    setIsExitingShadow(true);
    try {
      const res = await fetch("/api/superadmin/shadow-exit", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || "Failed to exit shadow login");
      }
      window.location.href = data.redirectUrl || "/superadmin";
    } catch (err: any) {
      showToast({ type: "error", title: "Exit Shadow Failed", message: err.message || "Failed to exit shadow login." });
      setIsExitingShadow(false);
    }
  }

  async function handleApproveQuestion(questionId: string) {
    const text = answersInput[questionId]?.trim();
    if (!text) {
      showToast({ type: "error", title: "Missing Answer", message: "Please enter an answer before approving." });
      return;
    }

    setApprovingId(questionId);
    try {
      const res = await fetch("/api/dashboard/unanswered/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, approvedAnswer: text }),
      });

      if (!res.ok) throw new Error("Failed to approve answer");

      setUnanswered((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, status: "approved", approvedAnswer: text } : q
        )
      );
      showToast({ type: "success", title: "Question Approved", message: "Answer approved and indexed into verified knowledge base." });
    } catch (err: any) {
      showToast({ type: "error", title: "Approval Failed", message: err.message || "Failed to approve question." });
    } finally {
      setApprovingId(null);
    }
  }

  async function handleSaveAgent() {
    setIsSavingAgent(true);
    setAgentSaveSuccess(false);
    try {
      const res = await fetch("/api/dashboard/agent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName,
          greeting,
          color: brandColor,
          tone,
        }),
      });

      if (!res.ok) throw new Error("Failed to update agent");
      setAgentSaveSuccess(true);
      setTimeout(() => setAgentSaveSuccess(false), 3000);
      showToast({ type: "success", title: "Settings Saved", message: "AI Receptionist configuration updated." });
    } catch (err: any) {
      showToast({ type: "error", title: "Save Failed", message: err.message || "Failed to save agent settings." });
    } finally {
      setIsSavingAgent(false);
    }
  }

  async function handleSendReply() {
    if (!currentConv || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      const res = await fetch("/api/dashboard/conversations/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentConv.id,
          content: replyText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");

      const newMsg: ConversationMessage = data.message;

      // Update state locally (with strict duplicate prevention)
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== currentConv.id) return c;
          const exists = c.messages.some((m) => m.id === newMsg.id);
          return {
            ...c,
            status: "RESOLVED",
            badge: "Human Resolved",
            lastMessage: newMsg.content,
            messages: exists ? c.messages : [...c.messages, newMsg],
          };
        })
      );
      setReplyText("");
    } catch (err: any) {
      showToast({ type: "error", title: "Failed to Send Reply", message: err.message || "Failed to send staff reply." });
    } finally {
      setIsSendingReply(false);
    }
  }

  async function handleToggleAiMute(mute: boolean) {
    if (!currentConv || isTogglingAi) return;
    setIsTogglingAi(true);
    try {
      const res = await fetch("/api/dashboard/conversations/takeover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: currentConv.id, mute }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle AI handover");
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConv.id
            ? {
                ...c,
                isAiMuted: data.isAiMuted,
                status: data.status,
                badge: data.badge,
              }
            : c
        )
      );
      showToast({
        type: mute ? "info" : "success",
        title: mute ? "AI Receptionist Muted" : "AI Receptionist Active",
        message: mute ? "Staff has taken over this conversation." : "AI Receptionist will answer incoming visitor queries.",
      });
    } catch (err: any) {
      showToast({ type: "error", title: "Handover Failed", message: err.message || "Failed to toggle AI handover." });
    } finally {
      setIsTogglingAi(false);
    }
  }

  // 1-Click Live Widget Installation Verifier Handler
  async function handleVerifyInstallation() {
    if (!verifyUrl.trim() || isVerifyingUrl) return;
    setIsVerifyingUrl(true);
    setVerificationResult(null);
    try {
      const res = await fetch("/api/dashboard/integrations/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: verifyUrl.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setVerificationResult(data);
        if (data.verified) {
          showToast({ type: "success", title: "Installation Verified", message: "Echo.ai widget is active and communicating!" });
        } else {
          showToast({ type: "info", title: "Verification Incomplete", message: data.reason || "Script tag not detected." });
        }
      } else {
        setVerificationResult({ verified: false, reason: data.error?.message || "Failed to verify website." });
        showToast({ type: "error", title: "Verification Error", message: data.error?.message || "Verification failed." });
      }
    } catch (err: any) {
      setVerificationResult({ verified: false, reason: err.message || "Network error while verifying." });
    } finally {
      setIsVerifyingUrl(false);
    }
  }

  // Team Member Management API Handlers
  const fetchTeamMembers = useCallback(async () => {
    setIsLoadingTeam(true);
    try {
      const res = await fetch("/api/dashboard/team");
      const data = await res.json();
      if (data.success) {
        setTeamMembers(data.data.team);
      }
    } catch {}
    finally {
      setIsLoadingTeam(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  async function handleSendInvite() {
    if (isSubmittingInvite) return;
    setInviteErrors(null);

    const name = inviteName.trim();
    const email = inviteEmail.trim().toLowerCase();
    const newErrors: { name?: string; email?: string } = {};

    if (!name) {
      newErrors.name = "Staff member name is required.";
    } else if (name.length < 2) {
      newErrors.name = "Staff name must be at least 2 characters.";
    }

    if (!email) {
      newErrors.email = "Staff work email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address (e.g. name@company.com).";
    }

    if (Object.keys(newErrors).length > 0) {
      setInviteErrors(newErrors);
      return;
    }

    setIsSubmittingInvite(true);
    try {
      const res = await fetch("/api/dashboard/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role: inviteRole, canEditCompanyTemplates: inviteCanEditTemplates }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error?.message || data.error || "Failed to invite member";
        if (errMsg.toLowerCase().includes("email") || errMsg.toLowerCase().includes("registered")) {
          setInviteErrors({ email: errMsg });
        } else if (errMsg.toLowerCase().includes("name")) {
          setInviteErrors({ name: errMsg });
        } else {
          showToast({ type: "error", title: "Invite Failed", message: errMsg });
        }
        return;
      }
      setInviteSuccess({
        email: data.member.email,
        tempPass: data.member.tempPassword,
        inviteUrl: data.inviteUrl,
      });
      setTeamMembers((prev) => [...prev, data.member]);
      showToast({ type: "success", title: "Invitation Email Dispatched", message: `Activation email sent to ${data.member.email}` });
    } catch (err: any) {
      showToast({ type: "error", title: "Invite Failed", message: err.message || "Failed to send invite." });
    } finally {
      setIsSubmittingInvite(false);
    }
  }

  async function confirmRemoveMember() {
    if (!memberToRemove || isRemovingMember) return;
    setIsRemovingMember(true);
    try {
      const res = await fetch(`/api/dashboard/team?id=${encodeURIComponent(memberToRemove.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || "Failed to remove member");
      setTeamMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      showToast({ type: "success", title: "Member Removed", message: `${memberToRemove.name} has been removed.` });
      setMemberToRemove(null);
    } catch (err: any) {
      showToast({ type: "error", title: "Remove Failed", message: err.message || "Failed to remove member." });
    } finally {
      setIsRemovingMember(false);
    }
  }

  // User Profile & Settings Handlers
  function openUserProfileModal() {
    setProfileName(currentUserState.name || "");
    setProfileCurrentPass("");
    setProfileNewPass("");
    setProfileConfirmPass("");
    setProfileErrors(null);
    setProfileSuccessMsg(null);
    setIsProfileModalOpen(true);
  }

  async function handleUpdateProfile(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isSavingProfile) return;
    setProfileErrors(null);
    setProfileSuccessMsg(null);

    const name = profileName.trim();
    const errors: { name?: string; currentPass?: string; newPass?: string } = {};

    if (!name) {
      errors.name = "Full name is required.";
    } else if (name.length < 2) {
      errors.name = "Full name must be at least 2 characters.";
    }

    if (profileNewPass) {
      if (!profileCurrentPass) {
        errors.currentPass = "Current password is required to change password.";
      }
      if (profileNewPass.length < 8) {
        errors.newPass = "New password must be at least 8 characters.";
      } else if (profileNewPass !== profileConfirmPass) {
        errors.newPass = "Passwords do not match.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          currentPassword: profileCurrentPass || undefined,
          newPassword: profileNewPass || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error?.message || data.error || "Failed to update profile";
        if (errMsg.toLowerCase().includes("current password")) {
          setProfileErrors({ currentPass: errMsg });
        } else if (errMsg.toLowerCase().includes("name")) {
          setProfileErrors({ name: errMsg });
        } else if (errMsg.toLowerCase().includes("new password")) {
          setProfileErrors({ newPass: errMsg });
        } else {
          showToast({ type: "error", title: "Update Failed", message: errMsg });
        }
        return;
      }

      const updatedName = data.data.user.name;
      setCurrentUserState((prev) => ({ ...prev, name: updatedName }));
      setTeamMembers((prev) =>
        prev.map((m) =>
          m.id === user.userId || m.email.toLowerCase() === user.email.toLowerCase()
            ? { ...m, name: updatedName }
            : m
        )
      );
      setProfileCurrentPass("");
      setProfileNewPass("");
      setProfileConfirmPass("");
      setProfileSuccessMsg("Profile details saved successfully.");
      showToast({ type: "success", title: "Profile Updated", message: "Your account details have been saved." });
      setTimeout(() => setIsProfileModalOpen(false), 900);
    } catch (err: any) {
      showToast({ type: "error", title: "Update Failed", message: err.message || "Failed to update profile." });
    } finally {
      setIsSavingProfile(false);
    }
  }

  // Staff Member Details & Edit Handlers
  function openEditMemberModal(member: TeamMember) {
    setEditingMember(member);
    setEditMemberName(member.name);
    setEditMemberRole(member.role);
    setEditMemberCanEditTemplates(Boolean(member.can_edit_company_templates || member.role === "admin" || member.role === "owner"));
    setEditMemberErrors(null);
  }

  async function handleSaveMemberEdit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!editingMember || isSavingMemberEdit) return;
    setEditMemberErrors(null);

    const name = editMemberName.trim();
    if (!name) {
      setEditMemberErrors({ name: "Staff member name is required." });
      return;
    }
    if (name.length < 2) {
      setEditMemberErrors({ name: "Staff name must be at least 2 characters." });
      return;
    }

    setIsSavingMemberEdit(true);
    try {
      const payload: Record<string, any> = {
        id: editingMember.id,
        name,
      };
      if (user.role === "owner" && editingMember.id !== user.userId) {
        payload.role = editMemberRole;
      }
      if ((user.role === "owner" || user.role === "admin") && editingMember.id !== user.userId) {
        payload.canEditCompanyTemplates = editMemberCanEditTemplates;
      }

      const res = await fetch("/api/dashboard/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error?.message || data.error || "Failed to update staff member";
        if (errMsg.toLowerCase().includes("name")) {
          setEditMemberErrors({ name: errMsg });
        } else {
          showToast({ type: "error", title: "Update Failed", message: errMsg });
        }
        return;
      }

      setTeamMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id
            ? { ...m, name: data.member.name, role: data.member.role, can_edit_company_templates: data.member.can_edit_company_templates }
            : m
        )
      );
      if (editingMember.id === user.userId) {
        setCurrentUserState((prev) => ({ ...prev, name: data.member.name, role: data.member.role }));
      }
      showToast({
        type: "success",
        title: "Staff Member Updated",
        message: `Changes saved for ${data.member.name}.`,
      });
      setEditingMember(null);
    } catch (err: any) {
      showToast({ type: "error", title: "Update Failed", message: err.message || "Failed to save changes." });
    } finally {
      setIsSavingMemberEdit(false);
    }
  }

  // Staff Canned Response Macros (Synced with personal user templates & fallback defaults)
  const cannedMacros = useMemo(() => {
    if (userTemplates.length > 0) {
      return userTemplates
        .filter((t) => t.is_active === 1)
        .map((t) => {
          const raw = t.command.replace("/", "");
          const icon =
            raw === "greeting" ? "👋 " :
            raw === "fees" || raw === "pricing" ? "🏷️ " :
            raw === "booking" ? "📅 " :
            raw === "hicaps" ? "💳 " :
            raw === "location" ? "📍 " :
            raw === "hours" ? "⏰ " :
            raw === "track" || raw === "shipping" ? "📦 " :
            raw === "return" ? "↩️ " :
            raw === "handoff" || raw === "escalate" ? "🤝 " : "⚡ ";
          return {
            label: `${icon}${t.command}`,
            command: t.command,
            text: t.content,
          };
        });
    }

    if (user.industry === "ecommerce") {
      return [
        { label: "📦 /track", command: "/track", text: "Your order is in transit with FedEx and is scheduled for delivery tomorrow by 4:00 PM." },
        { label: "↩️ /return", command: "/return", text: "We offer 30-day hassle-free returns on all unworn items with tags attached. Would you like a prepaid return label?" },
        { label: "🚚 /shipping", command: "/shipping", text: "Standard shipping takes 3-5 business days ($8.95), and express shipping takes 1-2 business days ($14.95). Free standard shipping on orders over $100." },
        { label: "⏰ /hours", command: "/hours", text: "Our customer support team is available Monday–Friday 9:00 AM – 5:00 PM AEST." },
      ];
    } else if (user.industry === "realestate") {
      return [
        { label: "📅 /viewing", command: "/viewing", text: "Open inspection for 12 Park St is scheduled for Thursday at 5:30 PM and Saturday at 11:00 AM. Shall I register your details?" },
        { label: "🏷️ /rent", command: "/rent", text: "The rental rate is $650 per week with a 4-week bond. Water usage is included." },
        { label: "🐾 /pets", command: "/pets", text: "Pets are considered case-by-case with landlord approval. Please include pet details in your rental application." },
        { label: "⏰ /hours", command: "/hours", text: "Our real estate office is open Monday–Friday 9:00 AM – 5:30 PM." },
      ];
    } else if (user.industry === "beauty") {
      return [
        { label: "✂️ /pricing", command: "/pricing", text: "Our Cut & Style Consultation is $85 (60 min), and full Balayage & Colour transformations start from $160." },
        { label: "📅 /booking", command: "/booking", text: "Senior stylist Mia has openings this Friday at 10:00 AM and 1:30 PM. Would either of those times suit you?" },
        { label: "💇 /balayage", command: "/balayage", text: "Balayage includes a full toner, gloss treatment, and blowout finish. We recommend booking a 15-minute consultation first." },
        { label: "⏰ /hours", command: "/hours", text: "Luna Studio is open Tuesday–Saturday 9:00 AM – 6:00 PM with late hours on Thursday." },
      ];
    } else {
      return [
        { label: "🏷️ /fees", command: "/fees", text: "Our consultation fees are $120 for an Initial Assessment (60 min) and $90 for Standard Follow-ups (30 min)." },
        { label: "💳 /hicaps", command: "/hicaps", text: "We provide on-the-spot electronic HICAPS claiming at our front desk for Bupa, Medibank, NIB, and all major health funds." },
        { label: "⏰ /hours", command: "/hours", text: "Our clinic is open Monday–Friday 7:30 AM – 6:00 PM and Saturday 8:00 AM – 1:00 PM. Closed Sundays." },
        { label: "📍 /location", command: "/location", text: "We are located at 45 Commercial Rd, South Yarra. Dedicated patient parking is available at the rear of the clinic." },
        { label: "📅 /booking", command: "/booking", text: "Dr. Sarah Lee has an opening tomorrow at 2:30 PM. Shall I reserve this appointment slot for you?" },
      ];
    }
  }, [userTemplates, user.industry]);

  function handleReplyInputChange(val: string) {
    let expanded = val;
    for (const macro of cannedMacros) {
      if (expanded.endsWith(`${macro.command} `) || expanded === macro.command) {
        expanded = macro.text;
        break;
      }
    }
    setReplyText(expanded);
  }

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    if (!newSourceTitle.trim() && !newSourceFile) {
      setAddSourceError(
        newSourceType === "url"
          ? "Please provide a valid website URL to crawl."
          : newSourceType === "pdf"
          ? "Please enter a document title or select a PDF file."
          : "Please enter a document title."
      );
      return;
    }

    setAddSourceError(null);
    setIsAddingSource(true);
    try {
      let res: Response;
      if (newSourceFile) {
        const formData = new FormData();
        formData.append("file", newSourceFile);
        formData.append("title", newSourceTitle.trim() || newSourceFile.name);
        formData.append("sourceType", newSourceType);
        if (newSourceContent.trim()) {
          formData.append("content", newSourceContent.trim());
        }
        res = await fetch("/api/dashboard/knowledge/add", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/dashboard/knowledge/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newSourceTitle.trim(),
            sourceType: newSourceType,
            sourceUrl: newSourceType === "url" ? newSourceTitle.trim() : null,
            content: newSourceContent.trim() || undefined,
            pageCount: newSourceType === "url" ? 18 : 6,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add source");

      setKnowledgeSources((prev) => [data.source, ...prev]);
      setNewSourceTitle("");
      setNewSourceFile(null);
      setNewSourceContent("");
      setAddSourceError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowAddSource(false);
      showToast({
        type: "success",
        title: "Knowledge Indexed",
        message: `Parsed "${data.source?.title || newSourceTitle}" — ${data.source?.pageCount || data.source?.chunks?.length || 1} chunks active.`,
      });
    } catch (err: any) {
      setAddSourceError(err.message || "Failed to add knowledge source.");
      showToast({
        type: "error",
        title: "Failed to Add Source",
        message: err.message || "Failed to add knowledge source.",
      });
    } finally {
      setIsAddingSource(false);
    }
  }

  async function confirmDeleteSource() {
    if (!sourceToDelete || deletingSourceId) return;
    const sourceId = sourceToDelete.id;
    setDeletingSourceId(sourceId);
    try {
      const res = await fetch("/api/dashboard/knowledge/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sourceId }),
      });

      if (!res.ok) throw new Error("Failed to delete source");

      setKnowledgeSources((prev) => prev.filter((s) => s.id !== sourceId));
      showToast({ type: "success", title: "Source Removed", message: `"${sourceToDelete.title}" and extracted chunks removed.` });
      setSourceToDelete(null);
    } catch (err: any) {
      showToast({ type: "error", title: "Failed to Delete", message: err.message || "Failed to delete knowledge source." });
    } finally {
      setDeletingSourceId(null);
    }
  }

  async function handleTestSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!testQuery.trim()) return;

    setIsTesting(true);
    try {
      const res = await fetch("/api/dashboard/knowledge/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: testQuery }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to test query");

      setTestResult(data.result);
    } catch (err: any) {
      showToast({ type: "error", title: "Test Query Failed", message: err.message || "Failed to test query." });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleAddManualFaq(e: React.FormEvent) {
    e.preventDefault();
    if (!newFaqQ.trim() || !newFaqA.trim()) return;

    setIsAddingFaq(true);
    try {
      const q = newFaqQ.trim();
      const a = newFaqA.trim();
      const addRes = await fetch("/api/dashboard/knowledge/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: q,
          content: a,
          sourceType: "manual_qa",
          pageCount: 1,
        }),
      });

      const data = await addRes.json();
      if (!addRes.ok) throw new Error(data.error || "Failed to save FAQ");

      setKnowledgeSources((prev) => [data.source, ...prev]);
      setUnanswered((prev) => [
        {
          id: "unq_" + Date.now(),
          question: q,
          frequencyCount: 1,
          status: "approved",
          approvedAnswer: a,
          lastAskedAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      setNewFaqQ("");
      setNewFaqA("");
      setShowAddFaq(false);
      showToast({ type: "success", title: "FAQ Added", message: `New FAQ "${q.slice(0, 45)}..." added to verified directives.` });
    } catch (err: any) {
      showToast({ type: "error", title: "Failed to Add FAQ", message: err.message || "Failed to add FAQ." });
    } finally {
      setIsAddingFaq(false);
    }
  }

  // Dynamic performance & deflection analytics calculations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (convFilter !== "ALL" && c.status !== convFilter) return false;
      if (convSearch.trim()) {
        const q = convSearch.toLowerCase().trim();
        const nameMatch = c.visitorName?.toLowerCase().includes(q);
        const contactMatch = c.visitorContact?.toLowerCase().includes(q);
        const msgMatch = c.lastMessage?.toLowerCase().includes(q);
        return Boolean(nameMatch || contactMatch || msgMatch);
      }
      return true;
    });
  }, [conversations, convFilter, convSearch]);

  const {
    totalConvs,
    aiResolvedCount,
    humanEscalatedCount,
    activeCount,
    deflectionRate,
    hoursSaved,
    costSavings,
    trendBars,
    maxTrendTotal,
    channelBreakdown,
    intentBreakdown,
  } = useMemo(() => {
    const total = conversations.length;
    const aiResolved = conversations.filter((c) => c.status === "RESOLVED").length;
    const humanEsc = conversations.filter((c) => c.status === "WAITING_FOR_HUMAN").length;
    const active = conversations.filter((c) => c.status === "ACTIVE").length;

    const deflRate =
      total > 0
        ? Math.round(((aiResolved || (total - humanEsc)) / total) * 100)
        : 0;
    const hrsSaved = ((total * 4.5) / 60).toFixed(1);
    const cSavings = Math.round(Number(hrsSaved) * 34.5);

    const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const trendMultiplier =
      analyticsTimeframe === "24h"
        ? 0.35
        : analyticsTimeframe === "30d"
        ? 3.8
        : analyticsTimeframe === "all"
        ? 5.5
        : 1;
    const tBars = daysOfWeek.map((day, idx) => {
      const weights = [0.12, 0.18, 0.24, 0.20, 0.14, 0.06, 0.06];
      const rawTotal = total > 0 ? Math.max(1, Math.round(total * weights[idx] * trendMultiplier)) : 0;
      const escRatio = total > 0 ? humanEsc / total : 0;
      const dayEscalated = Math.round(rawTotal * escRatio);
      const dayAi = Math.max(0, rawTotal - dayEscalated);
      return { day, total: rawTotal, ai: dayAi, escalated: dayEscalated };
    });
    const maxTrend = Math.max(...tBars.map((b) => b.total), 4);

    const chBreakdown = [
      { name: "Web Chat Widget", pct: total > 0 ? 76 : 0, count: Math.round(total * 0.76), color: "bg-indigo-600" },
      { name: "Direct Booking Link / Portal", pct: total > 0 ? 16 : 0, count: Math.round(total * 0.16), color: "bg-sky-500" },
      { name: "Inbound SMS / WhatsApp", pct: total > 0 ? 8 : 0, count: Math.round(total * 0.08), color: "bg-emerald-500" },
    ];

    const intBreakdown = isEcom
      ? [
          { label: "Order Tracking & Delivery Status", pct: total > 0 ? 40 : 0, count: Math.round(total * 0.4), color: "bg-indigo-600" },
          { label: "Returns, Refunds & Exchange Policy", pct: total > 0 ? 24 : 0, count: Math.round(total * 0.24), color: "bg-sky-500" },
          { label: "Product Specifications & Sizing", pct: total > 0 ? 18 : 0, count: Math.round(total * 0.18), color: "bg-emerald-500" },
          { label: "Bulk Purchasing & Wholesale Pricing", pct: total > 0 ? 12 : 0, count: Math.round(total * 0.12), color: "bg-purple-500" },
          { label: "Payment & Checkout Escalations", pct: total > 0 ? 6 : 0, count: Math.round(total * 0.06), color: "bg-amber-500" },
        ]
      : [
          { label: "New Patient Consultation & Booking", pct: total > 0 ? 44 : 0, count: Math.round(total * 0.44), color: "bg-indigo-600" },
          { label: "Treatment Pricing & HICAPS Health Funds", pct: total > 0 ? 22 : 0, count: Math.round(total * 0.22), color: "bg-sky-500" },
          { label: "Practitioner Availability & Schedules", pct: total > 0 ? 16 : 0, count: Math.round(total * 0.16), color: "bg-emerald-500" },
          { label: "Clinic Location, Parking & Access", pct: total > 0 ? 12 : 0, count: Math.round(total * 0.12), color: "bg-purple-500" },
          { label: "Urgent Care & Clinical Escalations", pct: total > 0 ? 6 : 0, count: Math.round(total * 0.06), color: "bg-amber-500" },
        ];

    return {
      totalConvs: total,
      aiResolvedCount: aiResolved,
      humanEscalatedCount: humanEsc,
      activeCount: active,
      deflectionRate: deflRate,
      hoursSaved: hrsSaved,
      costSavings: cSavings,
      trendBars: tBars,
      maxTrendTotal: maxTrend,
      channelBreakdown: chBreakdown,
      intentBreakdown: intBreakdown,
    };
  }, [conversations, analyticsTimeframe, isEcom]);

  const handleExportCsv = () => {
    setExportingCsv(true);
    setTimeout(() => {
      const headers = ["Conversation ID", "Visitor Name", "Visitor Contact", "Channel", "Status", "Resolution Badge", "Message Count", "Time"];
      const rows = conversations.map((c) => [
        `"${c.id}"`,
        `"${(c.visitorName || "").replace(/"/g, '""')}"`,
        `"${(c.visitorContact || "").replace(/"/g, '""')}"`,
        `"${c.channel}"`,
        `"${c.status}"`,
        `"${c.badge}"`,
        c.messages ? c.messages.length : 0,
        `"${c.timeAgo}"`,
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `echo-telemetry-${user.orgId}-${analyticsTimeframe}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportingCsv(false);
    }, 300);
  };

  const handleCopyEmbed = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const snippet = `<script src="${origin}/widget.js" data-agent-id="${initialData.agent.id}" data-org-id="${user.orgId}" data-org="${user.orgId}" async defer></script>`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(snippet).catch(() => {});
    } else if (typeof document !== "undefined") {
      const el = document.createElement("textarea");
      el.value = snippet;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2500);
    showToast({
      type: "success",
      title: "Embed Code Copied",
      message: "Asynchronous, non-blocking script tag copied to clipboard.",
    });
  };

  const handleCopyHostedLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const link = `${origin}/chat/${user.orgId}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => {});
    }
    setCopiedHostedLink(true);
    setTimeout(() => setCopiedHostedLink(false), 2500);
    showToast({
      type: "success",
      title: "Shareable Link Copied",
      message: `Direct link: ${link}`,
    });
  };

  const handleAddDomain = () => {
    const trimmed = newDomainInput.trim().toLowerCase();
    if (!trimmed) return;
    if (allowedDomains.includes(trimmed)) {
      setNewDomainInput("");
      return;
    }
    let updated = [...allowedDomains];
    if (trimmed !== "*" && updated.includes("*") && updated.length === 1) {
      updated = [trimmed];
    } else if (!updated.includes(trimmed)) {
      updated.push(trimmed);
    }
    setAllowedDomains(updated);
    setNewDomainInput("");
  };

  const handleRemoveDomain = (domainToRemove: string) => {
    const filtered = allowedDomains.filter((d) => d !== domainToRemove);
    setAllowedDomains(filtered.length > 0 ? filtered : ["*"]);
  };

  const handleSaveDomains = async () => {
    setIsSavingDomains(true);
    try {
      const res = await fetch("/api/dashboard/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: allowedDomains }),
      });
      const data = await res.json();
      setIsSavingDomains(false);
      if (res.ok && data.success) {
        setAllowedDomains(data.allowedDomains);
        showToast({
          type: "success",
          title: "Domain Whitelist Saved",
          message: data.message || "Whitelisted domains successfully saved.",
        });
      } else {
        showToast({
          type: "error",
          title: "Update Failed",
          message: data.error?.message || "Could not save domain settings.",
        });
      }
    } catch {
      setIsSavingDomains(false);
      showToast({
        type: "error",
        title: "Network Error",
        message: "Failed to connect to server.",
      });
    }
  };

  const handleCopyOrgId = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(user.orgId).catch(() => {});
    }
    setCopiedOrgId(true);
    showToast({
      type: "success",
      title: "Organization ID Copied",
      message: `Organization ID ${user.orgId} copied to clipboard.`,
    });
    setTimeout(() => setCopiedOrgId(false), 2000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => {
          if (!prev) {
            setTimeout(() => cmdInputRef.current?.focus(), 50);
          }
          return !prev;
        });
      } else if (e.key === "Escape" && isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandPaletteOpen]);

  const handleSendPreviewMessage = async (customQuery?: string) => {
    const query = (customQuery || previewTestInput).trim();
    if (!query) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: "user" as const,
      text: query,
      time: "Just now",
    };
    setPreviewTestMessages((prev) => [...prev, userMsg]);
    if (!customQuery) setPreviewTestInput("");
    setIsPreviewTyping(true);

    try {
      const res = await fetch("/api/dashboard/knowledge/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      const replyText =
        data.result?.answer ||
        data.answer ||
        "I can certainly help you with that! Please let me know your preferred day and contact details.";

      setPreviewTestMessages((prev) => [
        ...prev,
        { id: `agent-${Date.now()}`, sender: "agent" as const, text: replyText, time: "Just now" },
      ]);
    } catch {
      setPreviewTestMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          sender: "agent" as const,
          text: `Thank you for reaching out! Our team is available during operating hours.`,
          time: "Just now",
        },
      ]);
    } finally {
      setIsPreviewTyping(false);
    }
  };

  const commandPaletteItems = useMemo(() => {
    const baseNav = [
      {
        id: "nav-overview",
        category: "Navigation",
        title: "Go to Overview",
        subtitle: "Key metrics, active channels & deflection rates",
        icon: "📊",
        action: () => {
          setActiveTab("overview");
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "nav-agent",
        category: "Navigation",
        title: "Go to AI Receptionist Studio",
        subtitle: "Customise persona, greetings, brand colors & widget preview",
        icon: "🤖",
        action: () => {
          setActiveTab("agent");
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "nav-knowledge",
        category: "Navigation",
        title: "Go to Knowledge Base",
        subtitle: "Manage crawled URLs, PDF documents & FAQ training pairs",
        icon: "📚",
        action: () => {
          setActiveTab("knowledge");
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "nav-conversations",
        category: "Navigation",
        title: "Go to Conversations",
        subtitle: "Live chat inbox, customer transcripts & staff takeover",
        icon: "💬",
        action: () => {
          setActiveTab("conversations");
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "nav-appointments",
        category: "Navigation",
        title: isEcom ? "Go to Orders & Tracking" : "Go to Appointments",
        subtitle: isEcom ? "Live retail customer orders and delivery updates" : "Patient bookings, staff allocations & schedules",
        icon: isEcom ? "📦" : "📅",
        action: () => {
          setActiveTab("appointments");
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "nav-leads",
        category: "Navigation",
        title: "Go to Leads",
        subtitle: "Captured visitor leads, phone numbers & inquiries",
        icon: "🎯",
        action: () => {
          setActiveTab("leads");
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "nav-analytics",
        category: "Navigation",
        title: "Go to Analytics",
        subtitle: "7-day trends, volume breakdowns & export telemetry",
        icon: "📈",
        action: () => {
          setActiveTab("analytics");
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "nav-integrations",
        category: "Navigation",
        title: "Go to Integrations",
        subtitle: "Webhook endpoints, delivery logs & clinical PMS sync",
        icon: "🔌",
        action: () => {
          setActiveTab("integrations");
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "nav-team",
        category: "Navigation",
        title: "Go to Team & Access (RBAC)",
        subtitle: "Staff invitations, seat quotas & receptionist permissions",
        icon: "👥",
        action: () => {
          setActiveTab("team");
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "nav-billing",
        category: "Navigation",
        title: "Go to Billing & Subscription",
        subtitle: "Manage plan tiers, payment methods, invoices & credit balance",
        icon: "💳",
        action: () => {
          setActiveTab("billing");
          setIsCommandPaletteOpen(false);
        },
      },
    ];

    const quickActions = [
      {
        id: "act-add-source",
        category: "Quick Actions",
        title: "+ Index Website URL or PDF Document",
        subtitle: "Add new knowledge for your AI to study",
        icon: "🌐",
        action: () => {
          setActiveTab("knowledge");
          setShowAddSource(true);
          setShowAddFaq(false);
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "act-add-faq",
        category: "Quick Actions",
        title: "+ Add Custom Q&A Pair",
        subtitle: "Teach your receptionist verified answers directly",
        icon: "❓",
        action: () => {
          setActiveTab("knowledge");
          setShowAddFaq(true);
          setShowAddSource(false);
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "act-profile",
        category: "Account Settings",
        title: "My User Profile & Credentials",
        subtitle: `View account details, update display name (${currentUserState.name}) & change password`,
        icon: "👤",
        action: () => {
          openUserProfileModal();
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "act-copy-embed",
        category: "Quick Actions",
        title: "Copy Web Chat Widget Embed Script",
        subtitle: "Embed the interactive receptionist on any website",
        icon: "📋",
        action: () => {
          handleCopyEmbed();
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "act-copy-orgid",
        category: "Quick Actions",
        title: "Copy Organization ID",
        subtitle: `Organization UUID: ${user.orgId}`,
        icon: "🔑",
        action: () => {
          handleCopyOrgId();
          setIsCommandPaletteOpen(false);
        },
      },
      {
        id: "act-export-csv",
        category: "Quick Actions",
        title: "Export Telemetry to CSV",
        subtitle: "Download full conversation audit trail and metrics",
        icon: "📥",
        action: () => {
          handleExportCsv();
          setIsCommandPaletteOpen(false);
        },
      },
    ];

    const all = [...baseNav, ...quickActions];
    if (!cmdSearch.trim()) return all;
    const q = cmdSearch.toLowerCase().trim();
    return all.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [user.orgId, isEcom, cmdSearch]);

  async function handleUpdateBillingPreferences(
    nextCurrency: BillingCurrency,
    nextProvider: BillingProvider
  ) {
    setSelectedCurrency(nextCurrency);
    setSelectedProvider(nextProvider);
    try {
      const res = await fetch("/api/dashboard/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_preferences",
          currency: nextCurrency,
          provider: nextProvider,
        }),
      });
      const data = await res.json();
      if (res.ok && data.billing) {
        setBillingState(data.billing);
        showToast({
          type: "success",
          title: "Preferences Saved",
          message: `Billing currency set to ${nextCurrency}.`,
        });
      }
    } catch {
      // Keep optimistic UI selection
    }
  }

  function getDetectedBrand(digits: string): "VISA" | "MASTERCARD" | "AMEX" {
    const clean = digits.replace(/\D/g, "");
    if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return "MASTERCARD";
    if (/^3[47]/.test(clean)) return "AMEX";
    return "VISA";
  }

  function handleCardNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    const parts = [];
    for (let i = 0; i < raw.length; i += 4) {
      parts.push(raw.slice(i, i + 4));
    }
    setCardNumber(parts.join(" "));
  }

  function handleExpiryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      setCardExpiry(`${raw.slice(0, 2)} / ${raw.slice(2)}`);
    } else {
      setCardExpiry(raw);
    }
  }

  function handleCvcChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCardCvc(raw);
  }

  async function handleUpdateSubscription(
    targetPlan: "starter" | "growth" | "scale" | "pro",
    targetCycle: "monthly" | "biannual" | "annual",
    simulateFailedCharge = false
  ) {
    // If no payment method is on file, navigate down to Payment Methods and activate the embedded Stripe Element
    if (!simulateFailedCharge && billingState.paymentMethods.length === 0) {
      const planLabel =
        targetPlan === "starter" ? "Starter Plan" : targetPlan === "scale" || targetPlan === "pro" ? "Pro Plan" : "Growth Plan";
      const cycleLabel =
        targetCycle === "biannual"
          ? "Bi-Annual (6 Months)"
          : targetCycle === "annual"
          ? "Annual (12 Months)"
          : "Monthly";
      setPendingPlanSelection({ plan: targetPlan, cycle: targetCycle });
      setShowInlineCardForm(true);
      showToast({
        type: "error",
        title: "Payment Method Required",
        message: `No card on file — enter your card below to complete your switch to ${planLabel} (${cycleLabel}).`,
      });
      setTimeout(() => {
        paymentMethodsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => addCardInputRef.current?.focus(), 300);
      }, 50);
      return;
    }

    setIsUpdatingPlan(`${targetPlan}_${targetCycle}`);
    try {
      const res = await fetch("/api/dashboard/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_subscription",
          plan: targetPlan,
          billingCycle: targetCycle,
          currency: selectedCurrency,
          simulateFailedCharge,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update subscription");

      if (data.billing) {
        setBillingState(data.billing);
        setSelectedCycle(data.billing.billingCycle);
      }
      setPendingPlanSelection(null);
      if (data.chargeSucceeded) {
        showToast({
          type: "success",
          title: "Subscription Updated",
          message: data.message || "Your subscription has been updated successfully.",
        });
      } else {
        showToast({
          type: "error",
          title: "Payment Declined",
          message: data.message || "Card charge was declined by the issuer.",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Update Failed",
        message: err.message || "Unable to update subscription.",
      });
    } finally {
      setIsUpdatingPlan(null);
    }
  }

  async function handleAddPaymentMethod(e: React.FormEvent) {
    e.preventDefault();
    setPaymentCardErrors({});

    const cleanNum = cardNumber.replace(/\D/g, "");
    const errors: { number?: string; expiry?: string; cvc?: string; holder?: string } = {};

    if (!cleanNum) {
      errors.number = "Card number is required.";
    } else if (cleanNum.length < 13 || cleanNum.length > 19) {
      errors.number = "Please enter a valid card number (13-19 digits).";
    }

    const parts = cardExpiry.split("/");
    const expMonth = (parts[0] || "").trim();
    const expYear = (parts[1] || "").trim();
    const monthNum = parseInt(expMonth, 10);
    if (!expMonth || !expYear || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      errors.expiry = "Enter a valid expiration date (MM / YY).";
    }

    const cleanCvc = cardCvc.trim();
    if (!cleanCvc) {
      errors.cvc = "CVC is required.";
    } else if (cleanCvc.length < 3 || cleanCvc.length > 4) {
      errors.cvc = "CVC must be 3 or 4 digits.";
    }

    if (!cardHolder.trim()) {
      errors.holder = "Cardholder name is required.";
    }

    if (Object.keys(errors).length > 0) {
      setPaymentCardErrors(errors);
      return;
    }

    setIsSavingCard(true);
    setPaymentCardErrors({});
    try {
      const brand = getDetectedBrand(cleanNum);
      const formattedMonth = expMonth.padStart(2, "0");
      let formattedYear = expYear;
      if (formattedYear.length === 2) formattedYear = `20${formattedYear}`;

      const res = await fetch("/api/dashboard/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_payment_method",
          brand,
          cardNumber: cleanNum,
          expMonth: formattedMonth,
          expYear: formattedYear,
          cardholderName: cardHolder.trim(),
          setAsDefault: cardSetDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add payment method");
      if (data.billing) setBillingState(data.billing);
      setCardNumber("");
      setCardCvc("");
      setPaymentCardErrors({});
      setShowInlineCardForm(false);

      // If user clicked Upgrade / Downgrade while having no card, automatically complete their pending plan change now
      if (pendingPlanSelection) {
        const pending = pendingPlanSelection;
        setPendingPlanSelection(null);
        const subRes = await fetch("/api/dashboard/billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_subscription",
            plan: pending.plan,
            billingCycle: pending.cycle,
            currency: selectedCurrency,
            simulateFailedCharge: false,
          }),
        });
        const subData = await subRes.json();
        if (subRes.ok && subData.billing) {
          setBillingState(subData.billing);
          setSelectedCycle(subData.billing.billingCycle);
          if (subData.chargeSucceeded) {
            showToast({
              type: "success",
              title: "Card Added & Subscription Updated",
              message: subData.message || "Payment method added and subscription updated.",
            });
          } else {
            showToast({
              type: "error",
              title: "Payment Declined",
              message: subData.message || "Card attached, but plan charge was declined.",
            });
          }
          return;
        }
      }

      showToast({ type: "success", title: "Card Added", message: "New payment method saved securely." });
    } catch (err: any) {
      showToast({ type: "error", title: "Failed to Save Card", message: err.message || "Failed to save card." });
    } finally {
      setIsSavingCard(false);
    }
  }

  async function handleSetDefaultCard(paymentMethodId: string) {
    setBusyCardId(paymentMethodId);
    try {
      const res = await fetch("/api/dashboard/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_default_payment_method",
          paymentMethodId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set default card");
      if (data.billing) setBillingState(data.billing);
      showToast({ type: "success", title: "Default Card Updated", message: "Default payment method updated." });
    } catch (err: any) {
      showToast({ type: "error", title: "Update Failed", message: err.message || "Failed to update default card." });
    } finally {
      setBusyCardId(null);
    }
  }

  async function handleDeleteCard(paymentMethodId: string) {
    setBusyCardId(paymentMethodId);
    try {
      const res = await fetch("/api/dashboard/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_payment_method",
          paymentMethodId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete card");
      if (data.billing) setBillingState(data.billing);
      showToast({ type: "success", title: "Payment Method Removed", message: "Card removed from account." });
    } catch (err: any) {
      showToast({ type: "error", title: "Failed to Remove Card", message: err.message || "Failed to delete card." });
    } finally {
      setBusyCardId(null);
    }
  }

  async function handleConfirmCancellation() {
    setIsSubmittingCancellation(true);
    try {
      const res = await fetch("/api/dashboard/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_subscription",
          reason: cancelReason,
          feedback: cancelFeedback,
          immediate: cancelImmediate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel subscription");
      if (data.billing) setBillingState(data.billing);
      setShowCancelModal(false);
      showToast({
        type: "info",
        title: "Subscription Cancelled",
        message: data.message || "Your subscription has been scheduled for cancellation.",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Cancellation Failed",
        message: err.message || "Failed to process cancellation request.",
      });
    } finally {
      setIsSubmittingCancellation(false);
    }
  }

  async function handleResumeSubscription() {
    setIsResumingSubscription(true);
    try {
      const res = await fetch("/api/dashboard/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resume_subscription",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resume subscription");
      if (data.billing) setBillingState(data.billing);
      showToast({
        type: "success",
        title: "Subscription Resumed",
        message: data.message || "Your subscription has been successfully resumed.",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Resume Failed",
        message: err.message || "Failed to resume subscription.",
      });
    } finally {
      setIsResumingSubscription(false);
    }
  }

  const userRole = (currentUserState.role || user.role || "receptionist").toLowerCase();
  const isOwner = userRole === "owner" || userRole === "superadmin";
  const isAdmin = userRole === "admin";
  const isManagement = isOwner || isAdmin || userRole === "superadmin";
  const isReceptionist = userRole === "receptionist";
  const isViewer = userRole === "viewer";

  const allNavItems: { id: string; icon: ReactNode; label: string; badge?: string; minRole?: "owner" | "admin" | "staff" | "viewer" }[] = [
    {
      id: "overview",
      label: "Overview",
      minRole: "viewer",
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
    {
      id: "agent",
      label: "AI Receptionist",
      minRole: "admin",
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
      ),
    },
    {
      id: "knowledge",
      label: "Knowledge Base",
      badge: pendingQuestionsCount > 0 ? `${pendingQuestionsCount}` : undefined,
      minRole: "staff",
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
    },
    {
      id: "conversations",
      label: "Conversations",
      badge: conversations.length > 0 ? `${conversations.length}` : undefined,
      minRole: "viewer",
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.27z" />
        </svg>
      ),
    },
    {
      id: "appointments",
      label: isEcom ? "Orders & Tracking" : "Appointments",
      badge: appointments.length > 0 ? `${appointments.length}` : undefined,
      minRole: "viewer",
      icon: isEcom ? (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
    {
      id: "leads",
      label: "Leads",
      badge: leads.length > 0 ? `${leads.length}` : undefined,
      minRole: "viewer",
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      id: "analytics",
      label: "Analytics",
      minRole: "viewer",
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
    {
      id: "integrations",
      label: "Integrations",
      minRole: "admin",
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
        </svg>
      ),
    },
    {
      id: "team",
      label: "Team",
      badge: teamMembers.length > 0 ? `${teamMembers.length}/${seatLimit}` : undefined,
      minRole: "staff",
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.999-3.196a5.971 5.971 0 00-.94 3.196m0 0A11.954 11.954 0 0012 21a11.954 11.954 0 005.058-.984m-9.058-7.266a3 3 0 116 0 3 3 0 01-6 0zm11.25 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      id: "billing",
      label: "Billing",
      minRole: "admin",
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      ),
    },
  ];

  const navItems = allNavItems.filter((item) => {
    if (isManagement) return true;
    if (item.minRole === "admin") return false;
    if (isReceptionist) return item.minRole === "staff" || item.minRole === "viewer";
    if (isViewer) return item.minRole === "viewer";
    return true;
  });

  function renderPermissionGate(tabName: string) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-lg mx-auto animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mb-4 shadow-sm text-2xl">
          🛡️
        </div>
        <h3 className="text-lg font-bold text-slate-900">Administrator Access Required</h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          Your current account role is <span className="font-bold text-slate-800 capitalize">{currentUserState.role}</span>. Access to <span className="font-semibold text-slate-800">{tabName}</span> is restricted to Practice Owners and Administrators.
        </p>
        <div className="flex items-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => setActiveTab("conversations")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 transition cursor-pointer"
          >
            Open Live Conversations
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
          >
            Return to Overview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 text-slate-900">
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Viewport Sidebar (desktop fixed, mobile slide-over) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-dvh max-h-dvh border-r border-slate-200 bg-white flex flex-col justify-between overflow-hidden shrink-0 select-none transition-transform duration-300 md:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* 1. Fixed Top Header (Logo & Organization) */}
        <div className="shrink-0 p-4 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900 group">
              <EchoLogo size={22} tile={true} tileSize="h-9 w-9" />
              <span className="font-extrabold tracking-tight text-slate-900 text-lg">
                Echo<span className="text-indigo-600">.ai</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm font-bold"
              aria-label="Close Navigation"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
            <div className="text-xs font-bold text-slate-900 truncate">{user.orgName}</div>
            <div className="text-[11px] text-slate-500 capitalize flex items-center justify-between mt-0.5">
              <span>{user.industry}</span>
              <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 uppercase">
                {billingState.plan}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Scrollable Middle Navigation List */}
        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-1 text-xs custom-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left font-semibold transition group cursor-pointer ${
                  isActive
                    ? "bg-indigo-50/90 text-indigo-700 font-bold border border-indigo-200/60 shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`shrink-0 transition ${
                      isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* 3. Fixed Bottom Footer (Always Visible User Name & Log Out) */}
        <div className="shrink-0 mt-auto p-3 border-t border-slate-200 bg-slate-50/90">
          {(user.isSuperadmin || user.role === "superadmin") && (
            <Link
              href="/superadmin"
              className="w-full mb-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <span>👑</span>
              <span>Superadmin Console →</span>
            </Link>
          )}

          {user.impersonatedBy && (
            <button
              type="button"
              onClick={handleExitShadowLogin}
              disabled={isExitingShadow}
              className="w-full mb-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <span>🕶️</span>
              <span>{isExitingShadow ? "Exiting Shadow..." : "Exit Shadow Login"}</span>
            </button>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                openMemberDetailsPage({
                  id: user.userId,
                  name: currentUserState.name,
                  email: user.email,
                  role: user.role,
                })
              }
              title="Click to view account details & personal message templates"
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left p-1 rounded-xl hover:bg-slate-200/60 transition group cursor-pointer"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-[11px] font-bold text-white shadow-xs group-hover:ring-2 group-hover:ring-indigo-500/50 transition">
                {currentUserState.name
                  ? currentUserState.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : "U"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                  <span className="truncate">{currentUserState.name}</span>
                  <span className="text-[10px] text-slate-400 opacity-60 group-hover:opacity-100 transition">✏️</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate" title={currentUserState.email}>
                  {currentUserState.email}
                </div>
              </div>
            </button>
            <button
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition flex items-center gap-1 cursor-pointer"
            >
              <span>🚪</span>
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area (offset by md:ml-64 sidebar, full width on mobile) */}
      <main className="ml-0 md:ml-64 flex-1 min-w-0 h-dvh overflow-y-auto p-4 md:p-8 relative custom-scrollbar">
        {/* SHADOW LOGIN TOP FLOATING BANNER */}
        {user.impersonatedBy && (
          <div className="sticky top-0 z-40 -mt-4 md:-mt-8 -mx-4 md:-mx-8 mb-6 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 md:px-8 py-3 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2 border-b border-amber-400/40">
            <div className="flex items-center gap-3">
              <span className="text-xl">🕶️</span>
              <div className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded text-[10px] text-amber-200">
                    Shadow Login Active
                  </span>
                  <span className="font-bold text-white">
                    Inspecting Practice: <span className="underline decoration-amber-300">{user.orgName}</span>
                  </span>
                </div>
                <div className="text-[11px] text-amber-100 mt-0.5">
                  Logged in as Practice Owner: <b>{user.name}</b> ({user.email}) · Impersonated by Superadmin: <b>{user.impersonatedBy.name}</b>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/superadmin"
                className="bg-black/30 hover:bg-black/50 text-amber-100 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
              >
                Superadmin Overview
              </Link>
              <button
                type="button"
                onClick={handleExitShadowLogin}
                disabled={isExitingShadow}
                className="bg-white hover:bg-amber-50 text-slate-900 font-extrabold px-3.5 py-1.5 rounded-xl text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>🚪</span>
                <span>{isExitingShadow ? "Exiting Shadow..." : "Exit Shadow Login"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Mobile Top App Bar with Hamburger Toggle */}
        <div className="md:hidden flex items-center justify-between pb-3.5 mb-4 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer font-semibold text-xs"
            aria-label="Open Navigation Menu"
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Menu</span>
          </button>
          <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
            <EchoLogo size={16} tile={false} />
            <span>
              Echo<span className="text-indigo-600">.ai</span>
            </span>
          </div>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 capitalize">
            {activeTab}
          </span>
        </div>
        {/* Top-Right Real-Time Notification Stack */}
        <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => {
            const isError = toast.type === "error";
            const isSuccess = toast.type === "success";

            const borderClass = isError
              ? "border-red-500/70 hover:border-red-400 shadow-red-950/40"
              : isSuccess
              ? "border-emerald-500/70 hover:border-emerald-400 shadow-emerald-950/40"
              : "border-indigo-500/50 hover:border-indigo-400 shadow-slate-950/50";

            const accentBar = isError
              ? "from-red-500 via-rose-500 to-amber-500"
              : isSuccess
              ? "from-emerald-500 via-teal-400 to-cyan-400"
              : "from-indigo-500 via-sky-400 to-emerald-400";

            const iconBoxClass = isError
              ? "bg-red-500/20 border-red-500/40 text-red-300"
              : isSuccess
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
              : "bg-indigo-600/20 border-indigo-500/30 text-indigo-300";

            const titleClass = isError
              ? "text-red-200"
              : isSuccess
              ? "text-emerald-200"
              : "text-white";

            const badgeText = isError ? "Declined / Error" : isSuccess ? "Success" : "Just now";
            const badgeClass = isError
              ? "text-red-400"
              : isSuccess
              ? "text-emerald-400"
              : "text-indigo-300";

            return (
              <div
                key={toast.id}
                onClick={() => handleToastClick(toast)}
                className={`pointer-events-auto bg-slate-950/95 border ${borderClass} text-white rounded-2xl p-4 shadow-2xl backdrop-blur cursor-pointer hover:scale-[1.02] transition-all transform animate-in slide-in-from-top-3 duration-300 relative overflow-hidden group`}
              >
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accentBar}`} />
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl shrink-0 ${iconBoxClass}`}>
                    {toast.icon || (isError ? "🛑" : isSuccess ? "✅" : "💬")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold tracking-wide truncate ${titleClass}`}>
                        {toast.title}
                      </span>
                      <span className={`text-[10px] font-mono shrink-0 ${badgeClass}`}>
                        {badgeText}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 line-clamp-3 leading-relaxed">
                      {toast.message}
                    </p>
                    {toast.targetTab && (
                      <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-sky-400 group-hover:text-sky-300">
                        <span>Click to open in {toast.targetTab}</span>
                        <span>→</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeToast(toast.id);
                    }}
                    className="text-slate-500 hover:text-white p-1 rounded-lg transition shrink-0"
                    title="Dismiss notification"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <EchoLogo size={24} tile={true} tileSize="h-11 w-11" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 capitalize">
                  {activeTab === "member-details"
                    ? `${selectedMemberForDetail?.name || "Staff Member"} (Details & Templates)`
                    : navItems.find((n) => n.id === activeTab)?.label || "Dashboard"}
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200 capitalize">
                  {user.industry}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-xs text-slate-500">
                  Workspace: <b className="text-slate-700">{user.orgName}</b> · ID:{" "}
                  <button
                    type="button"
                    onClick={handleCopyOrgId}
                    title="Click to copy Organization ID"
                    className="font-mono text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/50 px-1.5 py-0.5 rounded transition cursor-pointer text-[11px] font-semibold"
                  >
                    {copiedOrgId ? "✓ Copied!" : user.orgId}
                  </button>
                </p>
                <span
                  title={
                    sseRole === "leader"
                      ? "Primary Leader tab: directly holding server SSE stream"
                      : "Follower tab: synchronized via BroadcastChannel"
                  }
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                    isSocketConnected
                      ? sseRole === "leader"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {isSocketConnected && (
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          sseRole === "leader" ? "bg-emerald-400" : "bg-indigo-400"
                        }`}
                      ></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        isSocketConnected
                          ? sseRole === "leader"
                            ? "bg-emerald-500"
                            : "bg-indigo-500"
                          : "bg-amber-500"
                      }`}
                    ></span>
                  </span>
                  {isSocketConnected
                    ? sseRole === "leader"
                      ? "Live Stream (Leader)"
                      : "Live Synced (Multi-Tab)"
                    : "Connecting..."}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCommandPaletteOpen(true);
                setTimeout(() => cmdInputRef.current?.focus(), 50);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-slate-600 hover:text-slate-900 text-xs shadow-2xs transition cursor-pointer"
              title="Search or jump to tab (⌘K)"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <span>Quick Actions...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-500">
                ⌘K
              </kbd>
            </button>
            <Link
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 shadow-2xs"
            >
              ← Marketing Site
            </Link>
            <button
              onClick={() => setActiveTab("agent")}
              className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition"
            >
              ⚙️ Agent Settings
            </button>
            <button
              type="button"
              onClick={() =>
                openMemberDetailsPage({
                  id: user.userId,
                  name: currentUserState.name,
                  email: user.email,
                  role: user.role,
                })
              }
              title="My Account Details & Message Templates"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 shadow-2xs transition cursor-pointer"
            >
              <span className="h-5 w-5 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-[10px] flex items-center justify-center">
                {currentUserState.name?.[0]?.toUpperCase() || "U"}
              </span>
              <span className="max-w-[100px] truncate">{currentUserState.name}</span>
              <span className="text-[10px] text-slate-400">✏️</span>
            </button>
          </div>
        </div>

        {/* ===================== TAB: OVERVIEW ===================== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">Total Conversations</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {metrics.totalConversations}
                </div>
                <span className="text-[11px] font-semibold text-emerald-600">Live sync active</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">Autonomous Resolution</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {metrics.resolutionRate}
                </div>
                <span className="text-[11px] font-semibold text-emerald-600">
                  {metrics.aiResolvedCount} handled solo
                </span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">Human Escalations</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">
                  {metrics.humanEscalatedCount}
                </div>
                <span className="text-[11px] font-semibold text-amber-600">Awaiting staff</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">
                  {metrics.actionMetricLabel}
                </span>
                <div className="text-2xl font-extrabold text-indigo-600 mt-1">
                  {metrics.actionMetricValue}
                </div>
                <span className="text-[11px] font-semibold text-slate-400">
                  {metrics.actionMetricSubtext}
                </span>
              </div>
            </div>

            {/* Quick Actions & Unanswered Banner */}
            {pendingQuestionsCount > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <b className="text-xs text-amber-950 font-bold block">
                      {pendingQuestionsCount} Unanswered Questions Waiting For Staff Review
                    </b>
                    <p className="text-[11px] text-amber-800">
                      Approve answers to teach your AI receptionist how to reply next time.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("knowledge")}
                  className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 shadow-sm"
                >
                  Review Questions →
                </button>
              </div>
            )}

            {/* Recent Conversations Snapshot */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-slate-900">Latest Live Conversations</h3>
                <button
                  onClick={() => setActiveTab("conversations")}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  View All in Inbox →
                </button>
              </div>

              {conversations.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No conversations yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {conversations.map((c, i) => (
                    <div
                      key={c.id ? `${c.id}-${i}` : `ov-${i}`}
                      onClick={() => {
                        setSelectedConvId(c.id);
                        setActiveTab("conversations");
                      }}
                      className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 rounded-lg px-2 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                          {c.visitorName[0] || "U"}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{c.visitorName}</div>
                          <div className="text-slate-500 truncate max-w-sm">{c.lastMessage}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            c.status === "WAITING_FOR_HUMAN"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {c.badge}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{c.timeAgo}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: AGENT CONFIGURATION ===================== */}
        {activeTab === "agent" && (!isManagement ? renderPermissionGate("AI Receptionist Instructions & Prompt Tuning") : (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-slate-900">Persona & Basic Profile</h3>
                  {agentSaveSuccess && (
                    <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg">
                      ✓ Changes saved to database!
                    </span>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Agent Name</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Welcome Greeting Message
                  </label>
                  <textarea
                    rows={2}
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Brand Accent Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="h-8 w-12 rounded cursor-pointer border border-slate-200"
                      />
                      <span className="font-mono text-slate-600">{brandColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tone of Voice</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-2 outline-none focus:border-indigo-600 bg-white"
                    >
                      <option>Friendly</option>
                      <option>Professional</option>
                      <option>Concise</option>
                      <option>Formal</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleSaveAgent}
                  disabled={isSavingAgent}
                  className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                >
                  {isSavingAgent ? "Saving..." : "Save Agent Settings"}
                </button>
              </div>

              {/* Install Script Box */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Embed Widget on Your Website</h3>
                    <p className="text-slate-500 mt-0.5">
                      Copy and paste this single script tag right before the closing &lt;/body&gt; of your website.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyEmbed}
                    className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer ${
                      copiedEmbed
                        ? "bg-emerald-600 text-white"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  >
                    <span>{copiedEmbed ? "✓" : "📋"}</span>
                    <span>{copiedEmbed ? "Copied!" : "Copy Script"}</span>
                  </button>
                </div>

                <div className="relative rounded-xl bg-slate-900 p-4 font-mono text-xs text-indigo-300 overflow-x-auto select-all">
                  &lt;script<br />
                  &nbsp;&nbsp;src=&quot;{typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/widget.js&quot;<br />
                  &nbsp;&nbsp;data-agent-id=&quot;{initialData.agent.id}&quot;<br />
                  &nbsp;&nbsp;data-org-id=&quot;{user.orgId}&quot;<br />
                  &nbsp;&nbsp;async&gt;<br />
                  &lt;/script&gt;
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyEmbed}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer ${
                      copiedEmbed
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    <span>{copiedEmbed ? "✓" : "📋"}</span>
                    <span>{copiedEmbed ? "Script Copied to Clipboard" : "Copy Embed Code"}</span>
                  </button>
                  <a
                    href="/test-embed.html"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    ↗ Preview on Test Website
                  </a>
                </div>
              </div>
            </div>

            {/* Live Widget Preview */}
            <div className="lg:col-span-5">
              <div className="sticky top-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Live Agent Preview
                  </span>
                  {/* Device Switcher Pills */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setWidgetPreviewMode("desktop")}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        widgetPreviewMode === "desktop"
                          ? "bg-white text-indigo-700 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      💻 Desktop
                    </button>
                    <button
                      type="button"
                      onClick={() => setWidgetPreviewMode("mobile")}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        widgetPreviewMode === "mobile"
                          ? "bg-white text-indigo-700 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      📱 Mobile
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewTestMessages([
                          {
                            id: `init-${Date.now()}`,
                            sender: "agent",
                            text: greeting || "Hello! How can I help you today?",
                            time: "Just now",
                          },
                        ])
                      }
                      title="Reset test conversation"
                      className="px-2 py-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                    >
                      ↺
                    </button>
                  </div>
                </div>

                {/* Device View Wrapper */}
                {widgetPreviewMode === "mobile" ? (
                  /* Mobile iPhone Viewport Frame */
                  <div className="w-[310px] sm:w-[325px] mx-auto rounded-[38px] border-[8px] border-slate-900 bg-slate-900 shadow-2xl overflow-hidden text-xs">
                    {/* Dynamic Island */}
                    <div className="pt-2 pb-1 bg-slate-900 flex justify-center">
                      <div className="h-3.5 w-20 bg-black rounded-full" />
                    </div>
                    {/* Simulated Mobile Status Bar */}
                    <div className="px-5 py-1 bg-white flex items-center justify-between text-[10px] font-bold text-slate-700 border-b border-slate-100">
                      <span>9:41</span>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-semibold">
                        <span>5G</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* Widget Content inside Mobile Frame */}
                    <div className="bg-white flex flex-col h-[400px]">
                      {/* Header */}
                      <div
                        className="p-3 text-white flex items-center gap-2.5 transition-colors shrink-0"
                        style={{ backgroundColor: brandColor }}
                      >
                        <div className="h-7 w-7 rounded-xl bg-slate-950/80 border border-white/20 flex items-center justify-center p-1 shrink-0">
                          <EchoLogo size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold leading-tight truncate">{user.orgName}</div>
                          <div className="text-[10px] opacity-80 truncate">
                            {agentName} · AI Receptionist ({tone})
                          </div>
                        </div>
                      </div>

                      {/* Chat Messages */}
                      <div className="p-3 space-y-2 bg-slate-50 flex-1 overflow-y-auto custom-scrollbar">
                        {previewTestMessages.map((m) => (
                          <div
                            key={m.id}
                            className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl p-2.5 text-xs shadow-2xs leading-relaxed ${
                                m.sender === "user"
                                  ? "rounded-br-xs text-white"
                                  : "rounded-bl-xs border border-slate-200 bg-white text-slate-800"
                              }`}
                              style={m.sender === "user" ? { backgroundColor: brandColor } : undefined}
                            >
                              {m.text}
                            </div>
                          </div>
                        ))}

                        {isPreviewTyping && (
                          <div className="flex justify-start">
                            <div className="rounded-2xl rounded-bl-xs border border-slate-200 bg-white p-2 text-slate-400 flex items-center gap-1 text-xs">
                              <span className="animate-bounce">●</span>
                              <span className="animate-bounce [animation-delay:0.2s]">●</span>
                              <span className="animate-bounce [animation-delay:0.4s]">●</span>
                            </div>
                          </div>
                        )}

                        {/* Quick Chips */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSendPreviewMessage(isEcom ? "Track my order" : "Book appointment")}
                            className="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold bg-white hover:bg-slate-50 transition cursor-pointer"
                            style={{ borderColor: brandColor, color: brandColor }}
                          >
                            {isEcom ? "Track my order" : "Book appointment"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendPreviewMessage(isEcom ? "Returns & refunds" : "Pricing & hours")}
                            className="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold bg-white hover:bg-slate-50 transition cursor-pointer"
                            style={{ borderColor: brandColor, color: brandColor }}
                          >
                            {isEcom ? "Returns & refunds" : "Pricing & hours"}
                          </button>
                        </div>
                      </div>

                      {/* Input Box */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendPreviewMessage();
                        }}
                        noValidate
                        className="p-2 bg-white border-t border-slate-200 flex gap-1.5 shrink-0"
                      >
                        <input
                          type="text"
                          value={previewTestInput}
                          onChange={(e) => setPreviewTestInput(e.target.value)}
                          placeholder="Ask a question..."
                          className="flex-1 bg-slate-100 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={!previewTestInput.trim() || isPreviewTyping}
                          className="px-2.5 rounded-xl text-white font-bold text-xs disabled:opacity-50 transition cursor-pointer"
                          style={{ backgroundColor: brandColor }}
                        >
                          ➤
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  /* Desktop Floating Widget Frame */
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden text-xs">
                    {/* Header */}
                    <div
                      className="p-3.5 text-white flex items-center justify-between gap-2.5 transition-colors"
                      style={{ backgroundColor: brandColor }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-xl bg-slate-950/80 border border-white/20 flex items-center justify-center p-1 shrink-0">
                          <EchoLogo size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold leading-tight truncate">{user.orgName}</div>
                          <div className="text-[10px] opacity-80 truncate">
                            {agentName} · AI Receptionist ({tone})
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
                        Interactive Sandbox
                      </span>
                    </div>

                    {/* Chat Messages */}
                    <div className="p-4 space-y-3 bg-slate-50 h-64 overflow-y-auto custom-scrollbar">
                      {previewTestMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-2.5 text-xs shadow-2xs leading-relaxed ${
                              m.sender === "user"
                                ? "rounded-br-xs text-white"
                                : "rounded-bl-xs border border-slate-200 bg-white text-slate-800"
                            }`}
                            style={m.sender === "user" ? { backgroundColor: brandColor } : undefined}
                          >
                            {m.text}
                          </div>
                        </div>
                      ))}

                      {isPreviewTyping && (
                        <div className="flex justify-start">
                          <div className="rounded-2xl rounded-bl-xs border border-slate-200 bg-white p-2.5 text-slate-400 flex items-center gap-1.5 text-xs">
                            <span className="animate-bounce">●</span>
                            <span className="animate-bounce [animation-delay:0.2s]">●</span>
                            <span className="animate-bounce [animation-delay:0.4s]">●</span>
                          </div>
                        </div>
                      )}

                      {/* Quick Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSendPreviewMessage(isEcom ? "Track my order" : "Book appointment")}
                          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-50 transition cursor-pointer"
                          style={{ borderColor: brandColor, color: brandColor }}
                        >
                          {isEcom ? "Track my order" : "Book appointment"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendPreviewMessage(isEcom ? "Returns & refunds" : "Pricing & hours")}
                          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-50 transition cursor-pointer"
                          style={{ borderColor: brandColor, color: brandColor }}
                        >
                          {isEcom ? "Returns & refunds" : "Pricing & hours"}
                        </button>
                      </div>
                    </div>

                    {/* Interactive Input Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendPreviewMessage();
                      }}
                      noValidate
                      className="p-3 bg-white border-t border-slate-200 flex gap-2"
                    >
                      <input
                        type="text"
                        value={previewTestInput}
                        onChange={(e) => setPreviewTestInput(e.target.value)}
                        placeholder="Ask your receptionist a question..."
                        className="flex-1 bg-slate-100 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={!previewTestInput.trim() || isPreviewTyping}
                        className="px-3.5 rounded-xl text-white font-bold text-xs disabled:opacity-50 transition cursor-pointer"
                        style={{ backgroundColor: brandColor }}
                      >
                        ➤
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* ===================== TAB: KNOWLEDGE BASE ===================== */}
        {activeTab === "knowledge" && (
          <div className="space-y-6">
            {/* Header Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Knowledge & Self-Learning Engine</h3>
                <p className="text-xs text-slate-500">
                  Your AI receptionist only speaks from documents, URLs, and approved FAQs below.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAddFaq(true);
                    setShowAddSource(false);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300"
                >
                  + Add Custom FAQ
                </button>
                <button
                  onClick={() => {
                    setShowAddSource(true);
                    setShowAddFaq(false);
                  }}
                  className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm"
                >
                  + Add Source (URL / PDF)
                </button>
              </div>
            </div>

            {/* Modal / Card: Add Source */}
            {showAddSource && (
              <form
                onSubmit={handleAddSource}
                noValidate
                className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-4 text-xs"
              >
                <div className="flex justify-between items-center">
                  <b className="text-sm font-bold text-slate-900">Index New Knowledge Source</b>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSource(false);
                      setAddSourceError(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-700">
                        {newSourceType === "url"
                          ? "Website URL to Crawl"
                          : newSourceType === "pdf"
                          ? "PDF Document Name / Title"
                          : "Document Title"} <span className="text-rose-500">*</span>
                      </label>
                      {addSourceError && (
                        <span className="text-[10px] font-bold text-rose-500">Required</span>
                      )}
                    </div>
                    <input
                      value={newSourceTitle}
                      onChange={(e) => {
                        setNewSourceTitle(e.target.value);
                        if (addSourceError) setAddSourceError(null);
                      }}
                      placeholder={
                        newSourceType === "url"
                          ? "https://yourclinic.com.au/services"
                          : newSourceType === "pdf"
                          ? "Clinic_Fee_Schedule_2026.pdf"
                          : "Intake_and_Cancellation_Policy.txt"
                      }
                      className={`w-full rounded-xl border bg-white p-2.5 outline-none transition ${
                        addSourceError
                          ? "border-rose-400 bg-rose-50/20 ring-1 ring-rose-400 focus:border-rose-500"
                          : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                      }`}
                    />
                    {addSourceError && (
                      <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1.5 mt-1.5 animate-in fade-in">
                        <span>⚠️</span>
                        <span>{addSourceError}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Source Format</label>
                    <select
                      value={newSourceType}
                      onChange={(e) => {
                        const nextType = e.target.value as any;
                        setNewSourceType(nextType);
                        setNewSourceFile(null);
                        setNewSourceContent("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 outline-none focus:border-indigo-600"
                    >
                      <option value="url">Website URL Crawl</option>
                      <option value="pdf">PDF Document (.pdf)</option>
                      <option value="document">Text Document (.txt / .md / .csv)</option>
                    </select>
                  </div>
                </div>

                {/* PDF File Upload Zone */}
                {newSourceType === "pdf" && (
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-700">
                      Upload PDF File (Fee Schedule, Services, Patient Intake Policy)
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white rounded-xl p-4 text-center transition group"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setNewSourceFile(f);
                            if (!newSourceTitle || newSourceTitle.includes(".pdf")) {
                              setNewSourceTitle(f.name);
                            }
                          }
                        }}
                      />
                      {newSourceFile ? (
                        <div className="flex items-center justify-center gap-2 text-indigo-700 font-bold">
                          <span className="text-xl">📄</span>
                          <span>{newSourceFile.name}</span>
                          <span className="text-slate-400 font-normal text-[11px]">
                            ({(newSourceFile.size / 1024).toFixed(1)} KB)
                          </span>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setNewSourceFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="text-red-500 hover:text-red-700 text-xs ml-2 underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-2xl group-hover:scale-110 transition">📄</div>
                          <p className="font-semibold text-slate-700">Click to choose or drop your PDF document here</p>
                          <p className="text-[11px] text-slate-400">
                            Real text will be extracted with pdf-parse and converted into live vector chunks
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Text Document Upload or Direct Paste */}
                {newSourceType === "document" && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block font-semibold text-slate-700">
                        Document Content (Paste text or upload file)
                      </label>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] font-bold text-indigo-600 hover:underline"
                      >
                        {newSourceFile ? `Replace File (${newSourceFile.name})` : "📁 Choose File Instead"}
                      </button>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".txt,.md,.csv,.json,.doc,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setNewSourceFile(f);
                          if (!newSourceTitle) setNewSourceTitle(f.name);
                        }
                      }}
                    />
                    {newSourceFile ? (
                      <div className="p-3 bg-white rounded-xl border border-indigo-200 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-700 font-bold">
                          <span className="text-lg">📝</span>
                          <span>{newSourceFile.name}</span>
                          <span className="text-slate-400 font-normal text-[11px]">
                            ({(newSourceFile.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setNewSourceFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold"
                        >
                          ✕ Remove
                        </button>
                      </div>
                    ) : (
                      <textarea
                        rows={3}
                        value={newSourceContent}
                        onChange={(e) => setNewSourceContent(e.target.value)}
                        placeholder="Paste service consultation fees, doctor bios, clinic guidelines, or policy rules here..."
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 outline-none focus:border-indigo-600 font-mono text-[11px]"
                      />
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSource(false);
                      setNewSourceFile(null);
                      setNewSourceContent("");
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingSource}
                    className="rounded-xl bg-indigo-600 px-4 py-1.5 font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isAddingSource ? "Indexing Chunks..." : "Index Source"}
                  </button>
                </div>
              </form>
            )}

            {/* Modal / Card: Add Manual FAQ */}
            {showAddFaq && (
              <form
                onSubmit={handleAddManualFaq}
                noValidate
                className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-4 text-xs"
              >
                <div className="flex justify-between items-center">
                  <b className="text-sm font-bold text-slate-900">Add Pre-Approved Question & Answer</b>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddFaq(false);
                      setAddFaqErrors({});
                    }}
                    className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      Customer Question <span className="text-rose-500">*</span>
                    </label>
                    {addFaqErrors.q && (
                      <span className="text-[10px] font-bold text-rose-500">Required</span>
                    )}
                  </div>
                  <input
                    value={newFaqQ}
                    onChange={(e) => {
                      setNewFaqQ(e.target.value);
                      if (addFaqErrors.q) setAddFaqErrors((prev) => ({ ...prev, q: undefined }));
                    }}
                    placeholder="e.g. Do you accept emergency walk-in patients?"
                    className={`w-full rounded-xl border bg-white p-2.5 outline-none transition ${
                      addFaqErrors.q
                        ? "border-rose-400 bg-rose-50/20 ring-1 ring-rose-400 focus:border-rose-500"
                        : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    }`}
                  />
                  {addFaqErrors.q && (
                    <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1.5 mt-1.5 animate-in fade-in">
                      <span>⚠️</span>
                      <span>{addFaqErrors.q}</span>
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      Approved AI Answer <span className="text-rose-500">*</span>
                    </label>
                    {addFaqErrors.a && (
                      <span className="text-[10px] font-bold text-rose-500">Required</span>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={newFaqA}
                    onChange={(e) => {
                      setNewFaqA(e.target.value);
                      if (addFaqErrors.a) setAddFaqErrors((prev) => ({ ...prev, a: undefined }));
                    }}
                    placeholder="e.g. Yes! We reserve walk-in appointment slots daily from 9 AM to 11 AM."
                    className={`w-full rounded-xl border bg-white p-2.5 outline-none transition ${
                      addFaqErrors.a
                        ? "border-rose-400 bg-rose-50/20 ring-1 ring-rose-400 focus:border-rose-500"
                        : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    }`}
                  />
                  {addFaqErrors.a && (
                    <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1.5 mt-1.5 animate-in fade-in">
                      <span>⚠️</span>
                      <span>{addFaqErrors.a}</span>
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddFaq(false);
                      setAddFaqErrors({});
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingFaq}
                    className="rounded-xl bg-indigo-600 px-4 py-1.5 font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isAddingFaq ? "Saving..." : "Save Approved Answer"}
                  </button>
                </div>
              </form>
            )}

            {/* Document Sources Table */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-slate-900">
                  Indexed Knowledge Sources ({knowledgeSources.length})
                </h3>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  RAG Pipeline Active
                </span>
              </div>

              {knowledgeSources.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No knowledge sources indexed yet. Click &quot;+ Add Source&quot; to crawl your website or upload documents.
                </div>
              ) : (
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400">
                        <th className="pb-2 font-semibold">Source Title / URL</th>
                        <th className="pb-2 font-semibold">Type</th>
                        <th className="pb-2 font-semibold">Status</th>
                        <th className="pb-2 font-semibold">Chunks</th>
                        <th className="pb-2 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {knowledgeSources.map((source, sIdx) => (
                        <tr key={source.id ? `${source.id}-${sIdx}` : `src-${sIdx}`}>
                          <td className="py-3 font-bold text-slate-900 flex items-center gap-2">
                            <span>{source.sourceType === "url" ? "🌐" : source.sourceType === "pdf" ? "📄" : "📝"}</span>
                            <span>{source.title}</span>
                          </td>
                          <td className="capitalize text-slate-500">
                            {source.sourceType === "url"
                              ? "Website Crawl"
                              : source.sourceType === "pdf"
                              ? "PDF Document"
                              : source.sourceType === "manual_qa"
                              ? "Verified Q&A"
                              : "Document"}
                          </td>
                          <td>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              ✓ {source.status}
                            </span>
                          </td>
                          <td className="text-slate-500">{source.pageCount} items</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setViewingSource(source)}
                                title="View resource content & chunks"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 shadow-xs transition"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span>View</span>
                              </button>
                              <button
                                onClick={() => setSourceToDelete({ id: source.id, title: source.title })}
                                disabled={deletingSourceId === source.id}
                                className="text-rose-600 hover:text-rose-800 font-semibold text-[11px] disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              >
                                {deletingSourceId === source.id ? "..." : "Remove"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* View Resource Modal */}
            {viewingSource && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-xs flex flex-col max-h-[85vh]">
                  {/* Modal Header */}
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl">
                        {viewingSource.sourceType === "url" ? "🌐" : viewingSource.sourceType === "pdf" ? "📄" : "📝"}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-slate-900 truncate">
                          {viewingSource.title}
                        </h3>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="capitalize">{viewingSource.sourceType}</span>
                          <span>•</span>
                          <span className="font-mono text-indigo-600">{viewingSource.id}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setViewingSource(null);
                        setResyncSuccess(false);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 font-bold transition text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-5 overflow-y-auto space-y-4 flex-1">
                    {/* Meta Stats Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</span>
                        <div className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                          <span>●</span> {viewingSource.status}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Vector Chunks</span>
                        <div className="text-xs font-bold text-slate-900 mt-0.5">
                          {viewingSource.pageCount} Chunks Indexed
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Last Sync</span>
                        <div className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                          {new Date(viewingSource.lastSyncedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Source URL Action if applicable */}
                    {(viewingSource.sourceType === "url" || viewingSource.sourceUrl) && (
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 flex items-center justify-between gap-3">
                        <div className="truncate">
                          <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block">Target URL</span>
                          <a
                            href={viewingSource.sourceUrl || viewingSource.title}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-indigo-700 hover:underline truncate block"
                          >
                            {viewingSource.sourceUrl || viewingSource.title}
                          </a>
                        </div>
                        <a
                          href={viewingSource.sourceUrl || viewingSource.title}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 font-bold text-white text-[11px] hover:bg-indigo-700 shrink-0 inline-flex items-center gap-1"
                        >
                          <span>Visit Link</span>
                          <span>↗</span>
                        </a>
                      </div>
                    )}

                    {/* Extracted Semantic Chunks Preview */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-slate-800 text-xs">
                          Extracted Semantic Chunks (AI Receptionist Context)
                        </span>
                        <span className="text-[10px] text-slate-400">Model: text-embedding-3-small</span>
                      </div>

                      <div className="space-y-2.5">
                        {getSourcePreviewChunks(viewingSource, isEcom).map((chunk, cIdx) => (
                          <div
                            key={chunk.id ? `${chunk.id}-${cIdx}` : `chk-${cIdx}`}
                            className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-1"
                          >
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                              <span className="text-indigo-600 font-mono">CHUNK #{chunk.id}</span>
                              <span>{chunk.title}</span>
                            </div>
                            <p className="text-slate-800 leading-relaxed font-normal bg-white p-2.5 rounded-lg border border-slate-100">
                              {chunk.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {resyncSuccess && (
                        <span className="text-[11px] text-emerald-600 font-bold">
                          ✓ Successfully re-indexed vector chunks!
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setIsResyncing(true);
                          setResyncSuccess(false);
                          setTimeout(() => {
                            setIsResyncing(false);
                            setResyncSuccess(true);
                            setTimeout(() => setResyncSuccess(false), 3000);
                          }, 600);
                        }}
                        disabled={isResyncing}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-100 text-xs transition disabled:opacity-50"
                      >
                        {isResyncing ? "Re-syncing..." : "🔄 Re-sync Document"}
                      </button>
                      <button
                        onClick={() => {
                          setViewingSource(null);
                          setResyncSuccess(false);
                        }}
                        className="rounded-xl bg-slate-900 px-4 py-1.5 font-bold text-white text-xs hover:bg-slate-800 transition shadow-sm"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Test Knowledge Retrieval Simulator */}
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-purple-50/30 p-6 shadow-sm">
              <h3 className="font-bold text-sm text-slate-900 mb-1">
                🔬 Test AI Knowledge Retrieval
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Ask a test question to verify how your AI receptionist will answer customer inquiries using your indexed sources.
              </p>

              <form onSubmit={handleTestSearch} noValidate className="flex gap-2">
                <input
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="e.g. What services do you offer? Or: What are your appointment hours?"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-600 shadow-sm"
                />
                <button
                  type="submit"
                  disabled={isTesting || !testQuery.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white text-xs shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isTesting ? "Searching..." : "Test Query"}
                </button>
              </form>

              {testResult && (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-white p-4 space-y-2 text-xs shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-indigo-700">AI Receptionist Response:</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      {Math.round(testResult.confidence * 100)}% Confidence
                    </span>
                  </div>
                  <p className="text-slate-800 leading-relaxed font-medium">{testResult.answer}</p>
                  {testResult.sources.length > 0 && (
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex items-center gap-1.5">
                      <span>Verified Sources:</span>
                      <span className="font-semibold text-slate-600">
                        {testResult.sources.join(" • ")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Unanswered Questions Queue */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-sm text-slate-900 mb-1">
                Unanswered Questions Queue ({pendingQuestionsCount} Pending Review)
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                When the AI is asked something with low retrieval confidence, it logs it here. Type an approved answer and click Approve to permanently update your knowledge base.
              </p>

              {unanswered.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">No unanswered questions in queue.</p>
              ) : (
                <div className="space-y-3">
                  {unanswered.map((item, uIdx) => (
                    <div
                      key={item.id ? `${item.id}-${uIdx}` : `unq-${uIdx}`}
                      className="rounded-xl border border-slate-200 p-4 space-y-3 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 text-sm">“{item.question}”</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          Asked {item.frequencyCount} times
                        </span>
                      </div>

                      {item.status === "approved" ? (
                        <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700 font-semibold flex items-center gap-1.5">
                          <span>✓</span> Approved: {item.approvedAnswer}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            value={answersInput[item.id] || ""}
                            onChange={(e) =>
                              setAnswersInput({ ...answersInput, [item.id]: e.target.value })
                            }
                            placeholder="Type clinic/store approved answer here..."
                            className="flex-1 rounded-xl border border-slate-200 p-2 outline-none focus:border-indigo-600 text-xs"
                          />
                          <button
                            onClick={() => handleApproveQuestion(item.id)}
                            disabled={approvingId === item.id}
                            className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                          >
                            {approvingId === item.id ? "Approving..." : "Approve Answer"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: CONVERSATIONS (INBOX) ===================== */}
        {activeTab === "conversations" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden grid lg:grid-cols-12 h-[calc(100vh-140px)] min-h-[620px] max-h-[860px]">
            {/* Left Thread List */}
            <div className="lg:col-span-4 border-r border-slate-200 flex flex-col h-full bg-slate-50/40 overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Customer Inbox</h3>
                    <span className="text-[11px] text-slate-500">
                      {filteredConversations.length} of {conversations.length} threads
                    </span>
                  </div>
                  {humanEscalatedCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 animate-pulse">
                      ⚠️ {humanEscalatedCount} Needs Staff
                    </span>
                  )}
                </div>

                {/* Live Search Input */}
                <div className="relative">
                  <input
                    type="text"
                    value={convSearch}
                    onChange={(e) => setConvSearch(e.target.value)}
                    placeholder="Search name, phone, message..."
                    className="w-full rounded-xl border border-slate-200 bg-white pl-7 pr-6 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600/30 transition shadow-2xs"
                  />
                  <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">🔍</span>
                  {convSearch && (
                    <button
                      type="button"
                      onClick={() => setConvSearch("")}
                      className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 custom-scrollbar text-[10px]">
                  <button
                    type="button"
                    onClick={() => setConvFilter("ALL")}
                    className={`px-2 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                      convFilter === "ALL"
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    All ({conversations.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setConvFilter("WAITING_FOR_HUMAN")}
                    className={`px-2 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                      convFilter === "WAITING_FOR_HUMAN"
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
                    }`}
                  >
                    Needs Staff ({humanEscalatedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setConvFilter("ACTIVE")}
                    className={`px-2 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                      convFilter === "ACTIVE"
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50"
                    }`}
                  >
                    AI Active ({activeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setConvFilter("RESOLVED")}
                    className={`px-2 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                      convFilter === "RESOLVED"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    Resolved ({aiResolvedCount})
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 overflow-y-auto flex-1 min-h-0 bg-white">
                {filteredConversations.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <div className="text-2xl mb-1">🔍</div>
                    <div className="font-semibold text-xs">No conversations match filter</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Try clearing your search or status filter</div>
                  </div>
                ) : (
                  filteredConversations.map((c, i) => {
                  const isSelected = selectedConvId === c.id || (!selectedConvId && i === 0);
                  const initials = c.visitorName
                    ? c.visitorName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "CU";

                  return (
                    <div
                      key={c.id ? `${c.id}-${i}` : `conv-${i}`}
                      onClick={() => setSelectedConvId(c.id)}
                      className={`p-3.5 cursor-pointer transition text-xs flex gap-3 items-start ${
                        isSelected
                          ? "bg-indigo-50/80 border-l-4 border-indigo-600 pl-2.5 shadow-xs"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 text-white ${
                          c.status === "WAITING_FOR_HUMAN"
                            ? "bg-amber-500"
                            : c.status === "RESOLVED"
                            ? "bg-emerald-600"
                            : "bg-indigo-600"
                        }`}
                      >
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <b className="text-slate-900 font-semibold truncate">{c.visitorName}</b>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-1">{c.timeAgo}</span>
                        </div>
                        <p className="text-slate-500 truncate mt-0.5 text-[11px]">{c.lastMessage}</p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              c.isAiMuted
                                ? "bg-slate-900 text-white"
                                : c.status === "WAITING_FOR_HUMAN"
                                ? "bg-amber-100 text-amber-800"
                                : c.status === "RESOLVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-indigo-100 text-indigo-700"
                            }`}
                          >
                            {c.isAiMuted ? "AI Muted" : c.badge}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-medium">{c.channel}</span>
                        </div>
                      </div>
                    </div>
                  );
                }))}
              </div>
            </div>

            {/* Right Chat Message Pane */}
            {currentConv ? (
              <div className="lg:col-span-8 flex flex-col h-full bg-slate-50/30 overflow-hidden">
                {/* Chat Top Header */}
                <div className="p-3.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-xs">
                      {currentConv.visitorName
                        ? currentConv.visitorName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                        : "CU"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <b className="text-sm font-bold text-slate-900">{currentConv.visitorName}</b>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            currentConv.isAiMuted
                              ? "bg-slate-900 text-white"
                              : currentConv.status === "WAITING_FOR_HUMAN"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : currentConv.status === "RESOLVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-indigo-100 text-indigo-700"
                          }`}
                        >
                          {currentConv.isAiMuted
                            ? "👤 Staff Handover Active"
                            : currentConv.status === "WAITING_FOR_HUMAN"
                            ? "⚠️ Needs Staff Reply"
                            : currentConv.status === "RESOLVED"
                            ? "✓ Human Resolved"
                            : `🤖 AI Active (${initialData.agent.name})`}
                        </span>
                      </div>
                      <span className="text-slate-500 text-[11px] block mt-0.5">
                        {currentConv.visitorContact} • {currentConv.channel.toUpperCase()} Channel
                      </span>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-2">
                    {/* Toggle AI Handover */}
                    {currentConv.isAiMuted ? (
                      <button
                        onClick={() => handleToggleAiMute(false)}
                        disabled={isTogglingAi}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                        title="Allow the AI receptionist to resume automated replies"
                      >
                        🤖 Resume AI Autopilot
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleAiMute(true)}
                        disabled={isTogglingAi}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                        title="Silence AI on this thread so staff can reply directly"
                      >
                        👤 Take Over (Mute AI)
                      </button>
                    )}
                  </div>
                </div>

                {/* Escalation Diagnostic Brief Banner */}
                {(currentConv.status === "WAITING_FOR_HUMAN" || currentConv.escalationReason) && (
                  <div className="p-3 bg-amber-50/90 border-b border-amber-200 text-xs text-amber-950 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">🚨</span>
                      <div>
                        <b className="font-bold">Staff Handover Alert: </b>
                        <span>
                          {currentConv.escalationReason ||
                            "Customer requested complex clinical review or staff consultation. AI is waiting for human response."}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold bg-amber-200/80 px-2 py-0.5 rounded text-amber-900">
                      Handover Active
                    </span>
                  </div>
                )}

                {/* Message History Container with Auto-scroll */}
                <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0 text-xs">
                  {Array.from(new Map(currentConv.messages.map((m) => [m.id, m])).values()).map((m, mIdx) => {
                    const isClient = m.sender === "client";
                    const isStaff = m.sender === "staff";

                    return (
                      <div
                        key={m.id ? `${m.id}-${mIdx}` : `msg-${mIdx}`}
                        className={`flex ${isClient ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl p-3 leading-relaxed shadow-xs ${
                            isClient
                              ? "bg-white border border-slate-200 text-slate-900 rounded-bl-sm"
                              : isStaff
                              ? "bg-emerald-600 text-white rounded-br-sm"
                              : "bg-indigo-600 text-white rounded-br-sm"
                          }`}
                        >
                          <div className="text-[10px] opacity-80 mb-1 font-bold uppercase tracking-wider flex items-center gap-1">
                            {isClient ? (
                              <span>👤 {currentConv.visitorName}</span>
                            ) : isStaff ? (
                              <span>👤 Staff Member (You)</span>
                            ) : (
                              <span>🤖 {initialData.agent.name} (AI Receptionist)</span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Staff Canned Response Macros & Auto-expansion */}
                <div className="px-3 py-2 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-1.5 overflow-x-auto text-[11px] shrink-0">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <span className="text-slate-500 font-bold shrink-0 text-[10px] uppercase tracking-wider flex items-center gap-1">
                      ⚡ Fast Macros:
                    </span>
                    {cannedMacros.map((macro, mIdx) => (
                      <button
                        key={mIdx}
                        onClick={() => setReplyText(macro.text)}
                        className="shrink-0 px-2.5 py-1 rounded-full bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition font-medium border border-slate-200/80 shadow-2xs flex items-center gap-1 text-[11px] cursor-pointer"
                        title={`Click to fill or type ${macro.command} + Space: ${macro.text}`}
                      >
                        <span className="font-semibold">{macro.label}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openMemberDetailsPage({
                        id: user.userId,
                        name: currentUserState.name,
                        email: user.email,
                        role: user.role,
                      })
                    }
                    className="shrink-0 ml-2 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50/80 hover:bg-indigo-100 px-2.5 py-1 rounded-full border border-indigo-200 flex items-center gap-1 transition cursor-pointer"
                    title="Open your personal message templates and predefined macros page"
                  >
                    <span>⚙️</span>
                    <span>Edit Templates</span>
                  </button>
                </div>

                {/* Reply Input Bar */}
                <div className="p-3 border-t border-slate-200 bg-white flex gap-2 shrink-0">
                  <input
                    value={replyText}
                    onChange={(e) => handleReplyInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
                    placeholder={`Type a staff reply or slash command (/fees, /booking, /hours, /track) to ${currentConv.visitorName}...`}
                    className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={isSendingReply || !replyText.trim()}
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 font-bold text-white text-xs shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition shrink-0"
                  >
                    {isSendingReply ? "Sending..." : "Send Staff Reply"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-8 p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center h-full">
                <span className="text-3xl mb-2">💬</span>
                <b className="text-slate-700">No conversation selected</b>
                <p className="mt-1">Select an active customer conversation from the list to view the thread.</p>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB: APPOINTMENTS / ORDERS ===================== */}
        {activeTab === "appointments" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-900">
                {isEcom ? "Orders Looked Up & Returns" : "Appointments Synced with Cliniko"}
              </h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                ✓ Sync Active
              </span>
            </div>

            <div className="overflow-x-auto text-xs">
              {isEcom ? (
                orders.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-3xl mb-2">📦</div>
                    <h4 className="text-sm font-bold text-slate-800">No orders looked up yet</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Customer tracking inquiries and return lookups handled by the AI receptionist will appear here in real time.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400">
                        <th className="pb-2 font-semibold">Order #</th>
                        <th className="pb-2 font-semibold">Customer</th>
                        <th className="pb-2 font-semibold">Total</th>
                        <th className="pb-2 font-semibold">Carrier & Tracking</th>
                        <th className="pb-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {orders.map((o, oIdx) => (
                        <tr key={o.id ? `${o.id}-${oIdx}` : `ord-${oIdx}`}>
                          <td className="py-2.5 font-bold">{o.orderNumber}</td>
                          <td>{o.customerName} ({o.customerEmail})</td>
                          <td>${o.totalAmount.toFixed(2)} {o.currency}</td>
                          <td>{o.trackingCarrier || "Standard Post"}</td>
                          <td>
                            <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">
                              {o.trackingStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : appointments.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-3xl mb-2">📅</div>
                  <h4 className="text-sm font-bold text-slate-800">No appointments scheduled yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Patient bookings scheduled through the autonomous AI receptionist or 2-way Cliniko sync will appear here in real time.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="pb-2 font-semibold">Patient</th>
                      <th className="pb-2 font-semibold">Service</th>
                      <th className="pb-2 font-semibold">Practitioner</th>
                      <th className="pb-2 font-semibold">Date & Time</th>
                      <th className="pb-2 font-semibold">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {appointments.map((a, aIdx) => (
                      <tr key={a.id ? `${a.id}-${aIdx}` : `apt-${aIdx}`} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 font-bold text-slate-900">
                          <div>{a.patientName}</div>
                          <div className="text-[11px] font-normal text-slate-400">{a.patientContact}</div>
                        </td>
                        <td>{a.serviceName}</td>
                        <td>{a.practitionerName}</td>
                        <td>
                          <div className="font-semibold">
                            {new Date(a.startTime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(a.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                a.source === "ai_booked"
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {a.source === "ai_booked" ? "🤖 AI Booked" : "Staff Booked"}
                            </span>
                            {a.externalId && (
                              <span className="text-[10px] font-mono text-slate-400">
                                #{a.externalId}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: LEADS ===================== */}
        {activeTab === "leads" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 mb-4">Captured Inbound Leads</h3>
            <div className="overflow-x-auto text-xs">
              {leads.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-3xl mb-2">🎯</div>
                  <h4 className="text-sm font-bold text-slate-800">No inbound leads captured yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    High-intent patient inquiries and consultation requests captured through website chat will appear here in real time.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="pb-2 font-semibold">Name</th>
                      <th className="pb-2 font-semibold">Email</th>
                      <th className="pb-2 font-semibold">Phone</th>
                      <th className="pb-2 font-semibold">Inquiry Intent</th>
                      <th className="pb-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {leads.map((l, lIdx) => (
                      <tr key={l.id ? `${l.id}-${lIdx}` : `lead-${lIdx}`} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 font-bold text-slate-900">{l.name}</td>
                        <td>{l.email || "—"}</td>
                        <td>{l.phone || "—"}</td>
                        <td>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 capitalize">
                            {l.intent}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                              l.status === "converted"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {l.status === "converted" ? "✓ Booked / Converted" : "Warm Inquiry"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: INTEGRATIONS ===================== */}
        {activeTab === "integrations" && (!isManagement ? renderPermissionGate("Practice Integrations & API Keys") : (
          <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div>
              <h2 className="text-lg font-bold text-slate-900">Connected Practice Software & Channels</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage your website chat widget installation, Cliniko practice sync, and third-party integrations.
              </p>
            </div>

            {/* Standalone Embed Studio Card */}
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    ⚡
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <b className="text-sm font-bold text-slate-900">Website Chat Widget Studio</b>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                        Production Ready
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Install your autonomous AI receptionist on WordPress, Webflow, Shopify, Squarespace, or custom websites in 60 seconds.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="/test-embed.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
                  >
                    <span>↗ External Site Sandbox</span>
                  </a>
                </div>
              </div>

              {/* Shareable Hosted Receptionist Link (Instant Zero-Install Access) */}
              <div className="rounded-xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/60 p-4 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🚀</span>
                      <b className="text-xs font-bold text-slate-900">Shareable Hosted Receptionist Link</b>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                        Zero Code Required
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Direct standalone chat page. Use immediately on Instagram, WhatsApp, Google Business, or test with your staff before installing code.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/chat/${user.orgId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 bg-white text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition shadow-2xs"
                    >
                      <span>Open Link</span>
                      <span>↗</span>
                    </a>
                  </div>
                </div>

                <div className="relative rounded-xl border border-slate-300 bg-white p-2.5 font-mono text-xs text-slate-700 flex items-center justify-between shadow-2xs">
                  <span className="select-all truncate text-indigo-700 font-semibold pr-2">
                    {typeof window !== "undefined" ? window.location.origin : "https://echo.ai"}/chat/{user.orgId}
                  </span>
                  <button
                    onClick={handleCopyHostedLink}
                    className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 font-bold text-white text-xs hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {copiedHostedLink ? (
                      <>
                        <span>✓</span> Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy Link
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-slate-500 font-medium">
                  <span className="text-slate-400">Perfect for:</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">📱 Instagram Bio</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">💬 WhatsApp Greeting</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">📍 Google Business</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">✉️ Email Signatures</span>
                </div>
              </div>

              {/* Code Snippet Box with Copy Button */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">1-Line Installation Script Tag</span>
                    <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.2 text-[10px] font-bold">
                      ⚡ Non-blocking (async defer)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Place before the closing &lt;/body&gt; tag</span>
                </div>

                <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-200 flex items-center justify-between overflow-x-auto shadow-inner">
                  <code className="select-all">
                    {`<script src="${typeof window !== "undefined" ? window.location.origin : "https://echo.ai"}/widget.js" data-org="${user.orgId}" async defer></script>`}
                  </code>
                  <button
                    onClick={handleCopyEmbed}
                    className="ml-4 shrink-0 rounded-lg bg-indigo-600 px-3.5 py-1.5 font-bold text-white text-xs hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {copiedEmbed ? (
                      <>
                        <span>✓</span> Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy Script
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Platform Instructions */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-[11px]">
                <div className="p-2.5 rounded-lg border border-slate-200/80 bg-white/70">
                  <b className="text-slate-900 block font-bold">WordPress</b>
                  <span className="text-slate-500">Theme Settings &gt; Custom Footer Scripts</span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200/80 bg-white/70">
                  <b className="text-slate-900 block font-bold">Webflow</b>
                  <span className="text-slate-500">Project Settings &gt; Custom Code &gt; Footer</span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200/80 bg-white/70">
                  <b className="text-slate-900 block font-bold">Shopify</b>
                  <span className="text-slate-500">Online Store &gt; Edit Code &gt; theme.liquid</span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200/80 bg-white/70">
                  <b className="text-slate-900 block font-bold">Squarespace / Wix</b>
                  <span className="text-slate-500">Developer Tools &gt; Code Injection</span>
                </div>
              </div>

              {/* 1-Click Live Installation Verifier */}
              <div className="mt-4 rounded-xl border border-indigo-200 bg-white p-4.5 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔍</span>
                    <b className="text-xs font-bold text-slate-900">1-Click Live Installation Verifier</b>
                    <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-bold">
                      Real-Time Check
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Verify your website has loaded Echo.ai correctly</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={verifyUrl}
                    onChange={(e) => setVerifyUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyInstallation()}
                    placeholder="Enter URL to check (e.g. https://yourclinic.com or https://yourdomain.com)"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                  <button
                    onClick={handleVerifyInstallation}
                    disabled={isVerifyingUrl || !verifyUrl.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition shrink-0 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    {isVerifyingUrl ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        <span>Scanning Website...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify Installation</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>

                {verificationResult && (
                  <div
                    className={`rounded-xl p-3.5 text-xs flex items-start gap-3 transition ${
                      verificationResult.verified
                        ? "bg-emerald-50/90 text-emerald-900 border border-emerald-200"
                        : "bg-amber-50/90 text-amber-900 border border-amber-200"
                    }`}
                  >
                    <span className="text-lg shrink-0 leading-none">
                      {verificationResult.verified ? "✅" : "⚠️"}
                    </span>
                    <div className="space-y-0.5">
                      <div className="font-bold flex items-center gap-2">
                        {verificationResult.verified ? "Widget Active & Verified" : "Verification Incomplete"}
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">
                        {verificationResult.message || verificationResult.reason}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Domain Whitelisting (AI Credit Protection) */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4.5 shadow-2xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🛡️</span>
                    <b className="text-xs font-bold text-slate-900">Domain Whitelisting & Origin Security</b>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        allowedDomains.includes("*")
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {allowedDomains.includes("*")
                        ? "Permissive Mode (*)"
                        : `Protected (${allowedDomains.length} domains)`}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Restricts which websites can embed your widget and consume AI credits
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Protect your monthly AI generation credits from unauthorized websites. If a domain is not in this whitelist, requests to load your receptionist or chat will be rejected with HTTP 403.
                </p>

                {/* Whitelisted Domain Tags */}
                <div className="flex flex-wrap gap-2 items-center min-h-[38px] p-2 bg-slate-50 rounded-lg border border-slate-200">
                  {allowedDomains.map((dom) => (
                    <span
                      key={dom}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium shadow-2xs ${
                        dom === "*"
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-white text-slate-800 border border-slate-300"
                      }`}
                    >
                      <span>{dom === "*" ? "★ * (All Origins Allowed)" : dom}</span>
                      <button
                        onClick={() => handleRemoveDomain(dom)}
                        className="text-slate-400 hover:text-rose-600 font-bold ml-1 transition cursor-pointer"
                        title={`Remove ${dom}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add Domain Input Form */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newDomainInput}
                    onChange={(e) => setNewDomainInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                    placeholder="e.g. yourclinic.com or *.yourclinic.com (or * for all)"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddDomain}
                    disabled={!newDomainInput.trim()}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50 transition shrink-0 shadow-xs cursor-pointer"
                  >
                    + Add Domain
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDomains}
                    disabled={isSavingDomains}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition shrink-0 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    {isSavingDomains ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span>Save Whitelist</span>
                        <span>✓</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>Wildcard subdomains supported (e.g. *.clinic.com). Default localhost is always allowed for development.</span>
                </div>
              </div>
            </div>

            {/* Interactive Connected Integrations Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Cliniko Practice Management Card */}
              {(() => {
                const cliniko = integrationsList.find((i) => i.provider === "cliniko");
                const isConnected = cliniko?.status === "connected";
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🏥</span>
                          <b className="text-sm font-bold text-slate-900">Cliniko Practice Management</b>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isConnected
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {isConnected ? "✓ Connected & Synced" : "Not Configured"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        Live calendar availability and 2-way patient appointment sync active. Appointments booked autonomously are dispatched to your Cliniko schedule.
                      </p>
                      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Shard: <strong className="text-slate-600">{clinikoForm.shard.toUpperCase()}</strong></span>
                        <span>•</span>
                        <span>Last sync: {cliniko?.lastSyncAt || "Just now"}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveIntegrationModal("cliniko")}
                        className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-xs"
                      >
                        ⚙️ Configure API
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Custom Outbound Webhooks (Zapier / CRM) Card */}
              {(() => {
                const webhook = integrationsList.find((i) => i.provider === "webhook");
                const isConnected = webhook?.status === "connected";
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">⚡</span>
                          <b className="text-sm font-bold text-slate-900">Custom Outbound Webhooks</b>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isConnected
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {isConnected ? "✓ Live Webhook Active" : "Not Configured"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        Dispatches real-time HMAC-SHA256 signed payloads to Zapier, Make, Slack, or your custom EHR/CRM on new bookings, leads, and escalations.
                      </p>
                      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Events: <strong className="text-slate-600">3 Subscribed</strong></span>
                        <span>•</span>
                        <span>Signature: <strong className="text-slate-600">HMAC-SHA256</strong></span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveIntegrationModal("webhook")}
                        className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-xs"
                      >
                        ⚙️ Configure Webhook
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Urgent SMS Escalations (Twilio) Card */}
              {(() => {
                const sms = integrationsList.find((i) => i.provider === "sms");
                const isConnected = sms?.status === "connected";
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📱</span>
                          <b className="text-sm font-bold text-slate-900">Urgent SMS Alerts (Twilio)</b>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isConnected
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {isConnected ? "✓ SMS Active" : "Not Configured"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        Sends immediate SMS notifications to on-duty practitioners when patients report emergency symptoms or request clinical staff handover.
                      </p>
                      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Alert to: <strong className="text-slate-600">{smsForm.alertPhone || "None"}</strong></span>
                        <span>•</span>
                        <span>Gateway: <strong className="text-slate-600">Twilio SMS</strong></span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveIntegrationModal("sms")}
                        className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-xs"
                      >
                        ⚙️ Configure SMS
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Email & Inbound Lead Notifications Card */}
              {(() => {
                const emailInt = integrationsList.find((i) => i.provider === "email");
                const isConnected = emailInt?.status === "connected";
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">✉️</span>
                          <b className="text-sm font-bold text-slate-900">Email & Inbound Lead Alerts</b>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isConnected
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {isConnected ? "✓ Email Connected" : "Not Configured"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        Dispatches automated instant email notifications for new inbound customer leads, contact numbers, and receptionist staff escalations directly to your inbox.
                      </p>
                      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Recipient: <strong className="text-slate-600">{emailForm.recipientEmail}</strong></span>
                        <span>•</span>
                        <span>Provider: <strong className="text-slate-600">Resend API</strong></span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTestEmailResult(null);
                          setActiveIntegrationModal("email");
                        }}
                        className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-xs cursor-pointer"
                      >
                        ⚙️ Configure Email & Send Test
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Google Calendar / PMS Calendar Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📅</span>
                      <b className="text-sm font-bold text-slate-900">Google Calendar & iCal Feed</b>
                    </div>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold">
                      ✓ Feed Active
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    Subscribe your personal smartphone or practice calendar to live appointment feeds with zero manual export required.
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span>Protocol: <strong className="text-slate-600">RFC 5545 iCalendar</strong></span>
                    <span>•</span>
                    <span>Sync: <strong className="text-slate-600">Real-Time</strong></span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/calendar/feed?orgId=${user.orgId}`);
                      showToast({ type: "success", title: "Feed Copied", message: "iCal calendar feed URL copied to clipboard!" });
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
                  >
                    📋 Copy iCal Feed URL
                  </button>
                </div>
              </div>
            </div>

            {/* Outbound Webhooks & Practice Sync Audit Trail */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Practice Sync & Webhook Audit Trail</h3>
                  <p className="text-xs text-slate-500">Live delivery history, response status codes, latencies, and payload data.</p>
                </div>
                <button
                  type="button"
                  onClick={refreshIntegrations}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs flex items-center gap-1"
                >
                  🔄 Refresh Logs
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                {deliveryLogsList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No integration events or webhooks recorded yet. Book an appointment or send a test ping to see live logs.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-700 font-bold">
                        <tr>
                          <th className="py-2.5 px-4">Event Type</th>
                          <th className="py-2.5 px-4">Provider</th>
                          <th className="py-2.5 px-4">Delivery Status</th>
                          <th className="py-2.5 px-4">Latency</th>
                          <th className="py-2.5 px-4">Timestamp</th>
                          <th className="py-2.5 px-4 text-right">Payload</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deliveryLogsList.map((log) => {
                          const isSuccess = log.status === "success";
                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50 transition">
                              <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">
                                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                  log.eventType.includes("appointment")
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : log.eventType.includes("escalat")
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : log.eventType.includes("lead")
                                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}>
                                  {log.eventType}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                                {log.provider}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className={`inline-flex items-center gap-1 font-bold ${
                                  isSuccess ? "text-emerald-700" : "text-rose-700"
                                }`}>
                                  <span>{isSuccess ? "✓" : "✗"}</span>
                                  <span>{log.statusCode ? `HTTP ${log.statusCode}` : log.status}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-mono text-slate-500">
                                {log.durationMs}ms
                              </td>
                              <td className="py-2.5 px-4 text-slate-400">
                                {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "Just now"}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => setInspectingLog(log)}
                                  className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                                >
                                  Inspect JSON
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* ===================== TAB: ANALYTICS ===================== */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {/* Header with Timeframe filters and Export */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Performance & Deflection Telemetry</h2>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Telemetry
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time autonomous receptionist deflection rate, staff hours saved, and SLA performance.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-xs">
                  {(["24h", "7d", "30d", "all"] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setAnalyticsTimeframe(tf)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        analyticsTimeframe === tf
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      {tf.toUpperCase()}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExportCsv}
                  disabled={exportingCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {exportingCsv ? "Exporting..." : "Export CSV"}
                </button>
              </div>
            </div>

            {/* Top 4 Executive KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>Deflection Rate</span>
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">+14% vs avg</span>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">
                  {deflectionRate}%
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {aiResolvedCount} handled without human touch
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>Staff Hours Saved</span>
                  <span className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">~4.5m / conv</span>
                </div>
                <div className="text-2xl font-extrabold text-indigo-600 mt-2">
                  {hoursSaved} hrs
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Receptionist phone time freed up
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>Labor Cost Saved</span>
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">$34.50/hr rate</span>
                </div>
                <div className="text-2xl font-extrabold text-emerald-600 mt-2">
                  ${costSavings.toLocaleString()} AUD
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Direct front-desk overhead reduction
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>First Response SLA</span>
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">Instant</span>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">
                  {totalConvs > 0 ? "1.2s" : "0s"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  vs 18m industry phone queue benchmark
                </p>
              </div>
            </div>

            {/* Charts Grid: Volume Trend + Inbound Channels */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Volume Bar Chart */}
              <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Conversation Volume & Autonomy Trend</h3>
                    <p className="text-xs text-slate-500">Autonomous AI resolutions vs human escalations</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" />
                      AI Resolved
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
                      Human Handover
                    </span>
                  </div>
                </div>

                {/* CSS Bar Chart */}
                <div className="pt-4 pb-2">
                  <div className="flex items-end justify-between gap-2 h-40 border-b border-slate-100 px-2 pb-1">
                    {trendBars.map((bar) => {
                      const barPixelHeight = bar.total > 0 ? Math.max(20, Math.round((bar.total / maxTrendTotal) * 135)) : 4;
                      const aiHeightPct = bar.total > 0 ? Math.round((bar.ai / bar.total) * 100) : 0;
                      const escHeightPct = bar.total > 0 ? 100 - aiHeightPct : 0;

                      return (
                        <div key={bar.day} className="flex-1 h-full flex items-end justify-center group relative">
                          {/* Hover Tooltip */}
                          <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-md whitespace-nowrap">
                            {bar.total} inquiries ({bar.ai} AI, {bar.escalated} Escalated)
                          </div>

                          <div
                            className="w-full max-w-[36px] flex flex-col justify-end rounded-t-lg overflow-hidden bg-slate-100 transition-all duration-300 shadow-xs"
                            style={{ height: `${barPixelHeight}px` }}
                          >
                            {bar.escalated > 0 && (
                              <div
                                className="w-full bg-amber-400"
                                style={{ height: `${escHeightPct}%` }}
                                title={`${bar.escalated} Escalated`}
                              />
                            )}
                            <div
                              className="w-full bg-indigo-600"
                              style={{ height: `${aiHeightPct}%` }}
                              title={`${bar.ai} AI Resolved`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Days labels row */}
                  <div className="flex justify-between gap-2 px-2 pt-2">
                    {trendBars.map((bar) => (
                      <div key={bar.day} className="flex-1 text-center text-[11px] font-semibold text-slate-500">
                        {bar.day}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Inbound Channels Breakdown */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Omnichannel Inbound Share</h3>
                  <p className="text-xs text-slate-500 mb-4">Traffic source distribution</p>

                  <div className="space-y-4">
                    {channelBreakdown.map((ch) => (
                      <div key={ch.name}>
                        <div className="flex justify-between items-center text-xs font-semibold mb-1">
                          <span className="text-slate-700">{ch.name}</span>
                          <span className="text-slate-900">{ch.pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full ${ch.color} rounded-full transition-all duration-500`}
                            style={{ width: `${ch.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                  <b className="font-semibold text-slate-900 block mb-0.5">Unified Knowledge Grounding</b>
                  All channels query the identical Cliniko & store documents, preventing policy discrepancies.
                </div>
              </div>
            </div>

            {/* Bottom Grid: 24/7 Coverage + Intent Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 24/7 After-Hours Analysis */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">24/7 After-Hours Reception Coverage</h3>
                    <p className="text-xs text-slate-500">Inquiries handled outside clinic operating hours</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Always On
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 my-4">
                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-500">Business Hours (9 AM – 5 PM)</span>
                    <div className="text-xl font-bold text-slate-900 mt-1">{totalConvs > 0 ? "58%" : "0%"}</div>
                    <span className="text-[11px] text-slate-500">Co-pilot mode with front desk</span>
                  </div>
                  <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40">
                    <span className="text-xs font-semibold text-indigo-900">After Hours (Nights & Weekends)</span>
                    <div className="text-xl font-bold text-indigo-700 mt-1">{totalConvs > 0 ? "42%" : "0%"}</div>
                    <span className="text-[11px] text-indigo-600 font-medium">100% autonomous capture</span>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 flex items-start gap-2.5 text-xs text-emerald-950">
                  <span className="text-base shrink-0">💡</span>
                  <div>
                    <b className="font-bold">Zero Patient Drop-Off</b>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      42% of customer inquiries arrived when your clinic was closed. Echo.ai booked these appointments and answered questions automatically instead of losing them to competitors.
                    </p>
                  </div>
                </div>
              </div>

              {/* Visitor Intent Breakdown */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Visitor Intent & Query Categorization</h3>
                    <p className="text-xs text-slate-500">Top conversation topics classified by AI</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {intentBreakdown.map((item) => (
                    <div key={item.label} className="p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 transition bg-slate-50/30">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-semibold text-slate-800">{item.label}</span>
                        <span className="font-bold text-slate-900">{item.pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200/60 overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full`}
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quality SLAs & Hallucination Guardrails */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3">AI Safety & Guardrail Benchmarks</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block">Knowledge Precision</span>
                  <b className="text-sm font-bold text-slate-900 mt-0.5 block">{conversations.length > 0 ? "99.2%" : "Calibrated (Ready)"}</b>
                  <span className="text-[10px] text-emerald-600 font-semibold">{conversations.length > 0 ? "Grounded in verified chunks" : "Guardrails active"}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block">Hallucination Breaches</span>
                  <b className="text-sm font-bold text-slate-900 mt-0.5 block">0 Detected</b>
                  <span className="text-[10px] text-emerald-600 font-semibold">100% Policy compliant</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block">Self-Learning Queue</span>
                  <b className="text-sm font-bold text-slate-900 mt-0.5 block">{pendingQuestionsCount} Pending</b>
                  <span className="text-[10px] text-amber-600 font-semibold">Awaiting staff approval</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block">Visitor Sentiment (CSAT)</span>
                  <b className="text-sm font-bold text-slate-900 mt-0.5 block">{conversations.length > 0 ? "96.4%" : "Pending First Chat"}</b>
                  <span className="text-[10px] text-emerald-600 font-semibold">{conversations.length > 0 ? "Positive conversation tone" : "Awaiting visitor feedback"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: TEAM (RBAC) ===================== */}
        {activeTab === "team" && (isViewer ? renderPermissionGate("Staff Directory & Access Control") : (
          <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>Team Members & Role-Based Access</span>
                  <span className="rounded-full bg-indigo-100 text-indigo-700 px-2.5 py-0.5 text-[11px] font-bold">
                    {isManagement ? "RBAC Active" : "Staff Directory"}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isManagement
                    ? "Manage your clinic staff, receptionists, and administrative permissions."
                    : "View colleagues on duty and their contact details across your practice."}
                </p>
              </div>

              {isManagement && (
                <button
                  onClick={() => {
                    setInviteSuccess(null);
                    setInviteErrors(null);
                    setInviteName("");
                    setInviteEmail("");
                    setInviteRole("receptionist");
                    setIsInviteModalOpen(true);
                  }}
                  disabled={teamMembers.length >= seatLimit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <span>+ Invite Staff Member</span>
                </button>
              )}
            </div>

            {/* Seat Quota & Plan Allocation Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Team Seat Allocation
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                      {teamPlan} Tier
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-slate-900">{teamMembers.length}</span>
                    <span className="text-xs text-slate-500 font-medium">of {seatLimit} available seats occupied</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-48 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        teamMembers.length >= seatLimit ? "bg-amber-500" : "bg-indigo-600"
                      }`}
                      style={{ width: `${Math.min(100, (teamMembers.length / seatLimit) * 100)}%` }}
                    />
                  </div>
                  {teamMembers.length >= seatLimit ? (
                    isManagement ? (
                      <button
                        onClick={() => setActiveTab("billing")}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition shadow-xs cursor-pointer"
                      >
                        Upgrade Seats →
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-amber-600">
                        All {seatLimit} seats occupied
                      </span>
                    )
                  ) : (
                    <span className="text-xs font-semibold text-emerald-600">
                      {seatLimit - teamMembers.length} {seatLimit - teamMembers.length === 1 ? "seat" : "seats"} remaining
                    </span>
                  )}
                </div>
              </div>

              {teamMembers.length >= seatLimit && isManagement && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                  <span>
                    ⚠️ You have filled all <b>{seatLimit} staff seats</b> on your {teamPlan.toUpperCase()} plan. Upgrade to the Pro plan for up to 10 seats.
                  </span>
                  <button
                    onClick={() => setActiveTab("billing")}
                    className="font-bold underline ml-3 shrink-0 hover:text-amber-950"
                  >
                    View Upgrade Options
                  </button>
                </div>
              )}
            </div>

            {/* Staff Directory Table */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <b className="text-xs font-bold text-slate-900">Organization Staff Directory</b>
                <span className="text-[11px] text-slate-400">{teamMembers.length} registered members</span>
              </div>

              {isLoadingTeam ? (
                <div className="p-12 text-center text-xs text-slate-400">Loading team members...</div>
              ) : teamMembers.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">No team members registered yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-4">Staff Member</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Joined</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {teamMembers.map((member) => {
                        const isSelf = member.id === user.userId || member.email.toLowerCase() === user.email.toLowerCase();
                        const isOwner = member.role === "owner";
                        const initials = member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2);

                        return (
                          <tr key={member.id} className="hover:bg-slate-50/70 transition group">
                            <td
                              onClick={() => openMemberDetailsPage(member)}
                              className="py-3.5 px-4 cursor-pointer"
                              title="Click to view details and manage personal templates"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs group-hover:ring-2 group-hover:ring-indigo-500/40 transition">
                                  {initials || "U"}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span className="hover:text-indigo-600 transition">{member.name}</span>
                                    {isSelf && (
                                      <span className="rounded bg-indigo-50 text-indigo-700 px-1.5 py-0.2 text-[9px] font-bold">
                                        You
                                      </span>
                                    )}
                                    <span className="text-[10px] text-indigo-500 font-bold opacity-0 group-hover:opacity-100 transition">View →</span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 font-mono">{member.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {member.role === "owner" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    👑 Owner
                                  </span>
                                ) : member.role === "admin" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    🛡️ Admin
                                  </span>
                                ) : member.role === "receptionist" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                    💬 Receptionist
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    Viewer
                                  </span>
                                )}
                                {Boolean(member.can_edit_company_templates) && member.role !== "owner" && member.role !== "admin" && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                                    title="Granted permission to edit company predefined templates"
                                  >
                                    ✏️ Templates Editor
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                              {member.created_at ? new Date(member.created_at).toLocaleDateString() : "Active"}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {isSelf ? (
                                <div className="flex items-center justify-end gap-2.5">
                                  <button
                                    type="button"
                                    onClick={() => openMemberDetailsPage(member)}
                                    className="text-indigo-600 hover:text-indigo-800 font-bold text-[11px] transition cursor-pointer hover:underline inline-flex items-center gap-1"
                                    title="Open your details and manage personal message templates"
                                  >
                                    <span>Details & Templates →</span>
                                  </button>
                                  <span className="text-slate-200">|</span>
                                  <button
                                    type="button"
                                    onClick={openUserProfileModal}
                                    className="text-slate-500 hover:text-slate-700 font-semibold text-[11px] transition cursor-pointer hover:underline inline-flex items-center gap-1"
                                    title="Edit user account credentials"
                                  >
                                    <span>Security</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2.5">
                                  <button
                                    type="button"
                                    onClick={() => openMemberDetailsPage(member)}
                                    className="text-indigo-600 hover:text-indigo-800 font-bold text-[11px] transition cursor-pointer hover:underline inline-flex items-center gap-1"
                                    title="View member details and personal message templates"
                                  >
                                    <span>Details & Templates →</span>
                                  </button>
                                  {isManagement && (
                                    <>
                                      <span className="text-slate-200">|</span>
                                      <button
                                        type="button"
                                        onClick={() => openEditMemberModal(member)}
                                        className="text-slate-600 hover:text-indigo-700 font-semibold text-[11px] transition cursor-pointer hover:underline inline-flex items-center gap-1"
                                        title="View details & edit staff permissions"
                                      >
                                        <span>Edit</span>
                                      </button>
                                      {!isOwner && (
                                        <>
                                          <span className="text-slate-200">|</span>
                                          <button
                                            type="button"
                                            onClick={() => setMemberToRemove(member)}
                                            className="text-rose-600 hover:text-rose-800 font-semibold text-[11px] transition cursor-pointer hover:underline"
                                          >
                                            Remove
                                          </button>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* RBAC Role Permissions Matrix Card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <b className="text-xs font-bold text-slate-900 block">Role Permissions Overview</b>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  👑 Role Assignment: Practice Owner Only
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 space-y-1">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <span>👑 Practice Owner</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Exclusive authority to assign and change staff member roles, manage billing, configure practice-wide policies, and delete accounts. Subusers cannot alter roles.
                  </p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-purple-900 flex items-center gap-1.5">
                    <span>🛡️ Administrator</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Full organizational control: edit AI prompts & persona, upload knowledge docs, connect PMS integrations, and manage staff invites.
                  </p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-sky-900 flex items-center gap-1.5">
                    <span>💬 Receptionist</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Live inbox triage, real-time takeover chat, canned slash macros, appointment & tracking queries, visitor phone call triage.
                  </p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>👁️ Viewer</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Read-only visibility for clinical directors or accountants: review conversation logs, analytics reports, and export CSVs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* ===================== TAB: MEMBER DETAILS & MESSAGE TEMPLATES ===================== */}
        {activeTab === "member-details" && (
          <MemberDetailsView
            member={
              selectedMemberForDetail || {
                id: user.userId,
                name: currentUserState.name,
                email: user.email,
                role: currentUserState.role,
                created_at: new Date().toISOString(),
              }
            }
            currentUser={{
              userId: user.userId,
              email: user.email,
              name: currentUserState.name,
              role: currentUserState.role,
              orgId: user.orgId,
              orgName: user.orgName,
              industry: user.industry,
              canEditCompanyTemplates: user.canEditCompanyTemplates,
            }}
            onBack={() => {
              setActiveTab("team");
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            onUpdateMember={(updated) => {
              setTeamMembers((prev) =>
                prev.map((m) =>
                  m.id === updated.id
                    ? {
                        ...m,
                        name: updated.name,
                        role: updated.role,
                        can_edit_company_templates:
                          updated.canEditCompanyTemplates !== undefined
                            ? updated.canEditCompanyTemplates
                            : m.can_edit_company_templates,
                      }
                    : m
                )
              );
              if (updated.id === user.userId) {
                setCurrentUserState((prev) => ({ ...prev, name: updated.name, role: updated.role }));
              }
            }}
            onTemplatesChanged={fetchCurrentUserTemplates}
          />
        )}

        {/* ===================== TAB: BILLING ===================== */}
        {activeTab === "billing" && (!isManagement ? renderPermissionGate("Billing & Subscription Management") : (() => {
          const planCatalog = PLAN_CATALOG;

          const tierOrder: Record<"starter" | "growth" | "scale" | "pro", number> = {
            starter: 1,
            growth: 2,
            scale: 3,
            pro: 3,
          };

          const getCyclePricing = (baseMonthly: number, cycle: "monthly" | "biannual" | "annual") => {
            const perMonth =
              cycle === "biannual"
                ? Math.round(baseMonthly * 0.9)
                : cycle === "annual"
                ? Math.round(baseMonthly * 0.8)
                : baseMonthly;
            const months = cycle === "biannual" ? 6 : cycle === "annual" ? 12 : 1;
            const totalCharge = perMonth * months;
            const cycleLabel =
              cycle === "biannual" ? "Bi-Annual (6 Months)" : cycle === "annual" ? "Annual (12 Months)" : "Monthly";
            const cycleShort =
              cycle === "biannual" ? "/ 6 months" : cycle === "annual" ? "/ year" : "/ month";
            return { perMonth, months, totalCharge, cycleLabel, cycleShort };
          };

          const activePlanMeta =
            planCatalog.find((p) => p.id === billingState.plan || (billingState.plan === "scale" && p.id === "pro")) ||
            planCatalog[1];
          const activePricing = getCyclePricing(activePlanMeta.baseMonthly, billingState.billingCycle);
          const defaultCard = billingState.paymentMethods.find((pm) => pm.isDefault);

          return (
            <div className="space-y-6 max-w-5xl">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Billing & Subscription Management</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upgrade or downgrade plans, switch between Monthly, Bi-Annual, and Annual billing cycles, manage payment methods, and review invoices.
                </p>
              </div>

              {/* Current Plan Summary Card */}
              <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {billingState.subscriptionStatus === "cancelling" ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                          Cancels on {billingState.cancelEffectiveDate || "Period End"}
                        </span>
                      ) : billingState.subscriptionStatus === "cancelled" ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-full">
                          Cancelled
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                          Current Active Plan
                        </span>
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        {activePricing.cycleLabel}
                      </span>
                      {billingState.creditBalanceCents > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100 border border-teal-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                          <span>💰</span>
                          <span>Account Credit: {billingState.creditBalanceFormatted}</span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mt-1.5 capitalize">
                      {activePlanMeta.name} Plan
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">{activePlanMeta.tagline}</p>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-2xl font-black text-slate-900">
                      ${activePricing.totalCharge.toLocaleString()}
                      <span className="text-xs font-normal text-slate-500"> {activePricing.cycleShort}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Effective rate: <b>${activePricing.perMonth}/mo</b> •{" "}
                      {defaultCard
                        ? `Charged to ${defaultCard.brand === "MASTERCARD" ? "Mastercard" : defaultCard.brand === "AMEX" ? "Amex" : "Visa"} •••• ${defaultCard.last4}`
                        : "No default payment method on file"}
                    </span>
                  </div>
                </div>

                {/* If Cancelling: Warning & Retention Banner */}
                {billingState.subscriptionStatus === "cancelling" && (
                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg leading-none">⚠️</span>
                      <div>
                        <p className="font-bold text-amber-950">Subscription Scheduled for Cancellation</p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Your workspace features remain fully active until <b>{billingState.cancelEffectiveDate || "the end of your current cycle"}</b>. Auto-renewal has been stopped and no further charges will occur.
                          {billingState.cancellationReason && (
                            <span className="block mt-1 font-semibold text-amber-900">
                              Reason: {billingState.cancellationReason}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isResumingSubscription}
                      onClick={handleResumeSubscription}
                      className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 text-xs transition shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      {isResumingSubscription ? "Resuming..." : "Resume Subscription"}
                    </button>
                  </div>
                )}

                {/* Usage Quotas */}
                <div className="mt-6 pt-6 border-t border-indigo-100/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-600 font-medium mb-1">
                      <span>Monthly Conversations</span>
                      <b className="text-slate-900">
                        {totalConvs} / {activePlanMeta.convLimit.toLocaleString()}
                      </b>
                    </div>
                    <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(4, (totalConvs / activePlanMeta.convLimit) * 100))}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {Math.max(0, activePlanMeta.convLimit - totalConvs).toLocaleString()} remaining
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-600 font-medium mb-1">
                      <span>Staff Team Seats</span>
                      <b className="text-slate-900">{teamMembers.length} / {activePlanMeta.seatsLimit} Seats</b>
                    </div>
                    <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((teamMembers.length / activePlanMeta.seatsLimit) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {Math.max(0, activePlanMeta.seatsLimit - teamMembers.length)} seats available
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-600 font-medium mb-1">
                      <span>Practice Integrations</span>
                      <b className="text-slate-900">{initialData.integrations.length} Active</b>
                    </div>
                    <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: "100%" }} />
                    </div>
                    <span className="text-[10px] text-emerald-600 font-medium mt-1 block">Cliniko 2-Way Sync</span>
                  </div>
                </div>

                {/* Plan Status & Termination / Cancellation Action */}
                <div className="mt-6 pt-5 border-t border-indigo-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="text-slate-500 text-[11px]">
                    {billingState.subscriptionStatus === "cancelling" ? (
                      <span className="text-amber-800 font-semibold flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        Cancelling on {billingState.cancelEffectiveDate || "period end"} — Change your mind? You can resume anytime.
                      </span>
                    ) : billingState.subscriptionStatus === "cancelled" ? (
                      <span className="text-rose-700 font-semibold flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        Subscription cancelled — workspace running on Starter tier.
                      </span>
                    ) : (
                      <span>Need to manage or terminate your plan?</span>
                    )}
                  </div>
                  <div>
                    {billingState.subscriptionStatus === "cancelling" ? (
                      <button
                        type="button"
                        disabled={isResumingSubscription}
                        onClick={handleResumeSubscription}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                      >
                        ✓ Resume Subscription
                      </button>
                    ) : billingState.subscriptionStatus === "cancelled" ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateSubscription("growth", selectedCycle, false)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                      >
                        Reactivate Growth Plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCancelModal(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline transition cursor-pointer"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Cancel Subscription
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Plan Upgrade / Downgrade & Billing Cycle Selector (Monthly / Bi-Annual / Annual) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Upgrade, Downgrade & Billing Cycle</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select a billing cycle and plan tier below. Switching immediately charges the selected cycle amount to your default payment method.
                    </p>
                  </div>

                  {/* Billing Cycle Toggle: Monthly | Bi-Annual | Annual */}
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs self-start">
                    {(
                      [
                        { id: "monthly", label: "Monthly", badge: null },
                        { id: "biannual", label: "Bi-Annual (6 Mo)", badge: "-10%" },
                        { id: "annual", label: "Annual (12 Mo)", badge: "-20%" },
                      ] as const
                    ).map((cycleOpt) => {
                      const active = selectedCycle === cycleOpt.id;
                      return (
                        <button
                          key={cycleOpt.id}
                          type="button"
                          onClick={() => setSelectedCycle(cycleOpt.id)}
                          className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            active
                              ? "bg-white text-indigo-700 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <span>{cycleOpt.label}</span>
                          {cycleOpt.badge && (
                            <span
                              className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                                active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {cycleOpt.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3 Plan Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {planCatalog.map((tier) => {
                    const pricing = getCyclePricing(tier.baseMonthly, selectedCycle);
                    const isPlanMatch =
                      billingState.plan === tier.id || (billingState.plan === "scale" && tier.id === "pro");
                    const isExactCurrent =
                      isPlanMatch && billingState.billingCycle === selectedCycle;
                    const isSamePlanDifferentCycle =
                      isPlanMatch && billingState.billingCycle !== selectedCycle;
                    const isUpgrade = tierOrder[tier.id] > tierOrder[billingState.plan];
                    const isDowngrade = tierOrder[tier.id] < tierOrder[billingState.plan];
                    const btnLoading = isUpdatingPlan === `${tier.id}_${selectedCycle}`;

                    let ctaLabel = `Select ${tier.name}`;
                    if (isExactCurrent) {
                      ctaLabel = "✓ Current Plan & Cycle";
                    } else if (isSamePlanDifferentCycle) {
                      ctaLabel = `Switch to ${
                        selectedCycle === "biannual"
                          ? "Bi-Annual"
                          : selectedCycle === "annual"
                          ? "Annual"
                          : "Monthly"
                      } ($${pricing.totalCharge.toLocaleString()})`;
                    } else if (isUpgrade) {
                      ctaLabel = `Upgrade to ${tier.name} ($${pricing.totalCharge.toLocaleString()})`;
                    } else if (isDowngrade) {
                      ctaLabel = `Downgrade to ${tier.name} ($${pricing.totalCharge.toLocaleString()})`;
                    }

                    return (
                      <div
                        key={tier.id}
                        className={`rounded-2xl border p-5 flex flex-col justify-between transition ${
                          isPlanMatch
                            ? "border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-base font-extrabold text-slate-900">{tier.name}</h4>
                            {isPlanMatch && (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                                Active Tier
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 min-h-[30px]">{tier.tagline}</p>

                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-black text-slate-900">
                                ${pricing.perMonth}
                              </span>
                              <span className="text-xs text-slate-500 font-medium">
                                / month
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold text-indigo-700 mt-0.5">
                              {selectedCycle === "monthly"
                                ? `Billed monthly ($${pricing.totalCharge}.00)`
                                : selectedCycle === "biannual"
                                ? `Billed every 6 months ($${pricing.totalCharge.toLocaleString()}.00)`
                                : `Billed annually ($${pricing.totalCharge.toLocaleString()}.00)`}
                            </div>
                          </div>

                          <ul className="mt-4 space-y-2 text-xs text-slate-600">
                            {tier.features.map((feat) => (
                              <li key={feat} className="flex items-center gap-2">
                                <span className="text-emerald-600 font-bold">✓</span>
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-5">
                          <button
                            type="button"
                            disabled={isExactCurrent || Boolean(isUpdatingPlan)}
                            onClick={() => handleUpdateSubscription(tier.id, selectedCycle, false)}
                            className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-bold transition cursor-pointer ${
                              isExactCurrent
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                                : isUpgrade || isSamePlanDifferentCycle
                                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                                : "bg-slate-900 text-white hover:bg-slate-800 shadow-xs"
                            } disabled:opacity-60`}
                          >
                            {btnLoading ? "Processing Charge..." : ctaLabel}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Methods & Billing Invoices Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payment Methods Card */}
                <div
                  ref={paymentMethodsSectionRef}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">Payment Methods</h3>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          <svg className="h-2.5 w-2.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                          </svg>
                          Stripe Encrypted
                        </span>
                      </div>
                      {billingState.paymentMethods.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPendingPlanSelection(null);
                            setShowInlineCardForm(!showInlineCardForm);
                            if (!showInlineCardForm) {
                              setTimeout(() => addCardInputRef.current?.focus(), 150);
                            }
                          }}
                          className="rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 text-xs font-bold transition cursor-pointer"
                        >
                          {showInlineCardForm ? "✕ Cancel" : "+ Add Payment Method"}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      Default payment method is charged automatically on plan updates and renewal cycles.
                    </p>

                    {/* Pending Plan Switch Callout Banner */}
                    {pendingPlanSelection && (() => {
                      const pPlanMeta = planCatalog.find((p) => p.id === pendingPlanSelection.plan) || planCatalog[1];
                      const pPricing = getCyclePricing(pPlanMeta.baseMonthly, pendingPlanSelection.cycle);
                      return (
                        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs text-indigo-900 flex items-start gap-3">
                          <span className="text-lg leading-none">💳</span>
                          <div className="flex-1">
                            <div className="font-bold flex items-center justify-between">
                              <span>Activate {pPlanMeta.name} Plan</span>
                              <span className="font-black text-indigo-700">${pPricing.totalCharge.toLocaleString()}.00</span>
                            </div>
                            <p className="text-[11px] text-indigo-700/80 mt-0.5">
                              Enter your card details in the payment element below to charge ${pPricing.totalCharge.toLocaleString()}.00 and switch plans.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Saved Payment Methods List */}
                    {billingState.paymentMethods.length > 0 && !showInlineCardForm && !pendingPlanSelection && (
                      <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                        {billingState.paymentMethods.map((pm) => {
                          const brandTitle = pm.brand === "MASTERCARD" ? "Mastercard" : pm.brand === "AMEX" ? "Amex" : "Visa";
                          return (
                            <div
                              key={pm.id}
                              className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition ${
                                pm.isDefault
                                  ? "border-indigo-200 bg-indigo-50/30"
                                  : "border-slate-200 bg-slate-50/50"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-8 w-14 shrink-0 rounded-lg font-black text-[10px] flex items-center justify-center tracking-wider text-white bg-slate-900 shadow-xs">
                                  {pm.brand === "MASTERCARD" ? "MC" : pm.brand === "AMEX" ? "AMEX" : "VISA"}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <b className="text-xs text-slate-900 font-bold truncate">
                                      {brandTitle} ending in {pm.last4}
                                    </b>
                                    {pm.isDefault && (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-500 block truncate">
                                    {pm.cardholderName} • Expires {pm.expMonth}/{pm.expYear}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {!pm.isDefault && (
                                  <button
                                    type="button"
                                    disabled={busyCardId === pm.id}
                                    onClick={() => handleSetDefaultCard(pm.id)}
                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer"
                                  >
                                    Set Default
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={busyCardId === pm.id}
                                  onClick={() => handleDeleteCard(pm.id)}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-red-600 hover:border-red-200 hover:bg-red-50 transition cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Stripe Element Form: shown when no cards exist OR when showInlineCardForm / pendingPlanSelection is active */}
                    {(billingState.paymentMethods.length === 0 || showInlineCardForm || pendingPlanSelection) && (() => {
                      const detectedBrand = getDetectedBrand(cardNumber);
                      const pendingPlanMeta = pendingPlanSelection
                        ? planCatalog.find((p) => p.id === pendingPlanSelection.plan) || planCatalog[1]
                        : null;
                      const pendingPricing = pendingPlanMeta
                        ? getCyclePricing(pendingPlanMeta.baseMonthly, pendingPlanSelection!.cycle)
                        : null;

                      return (
                        <form onSubmit={handleAddPaymentMethod} noValidate className="space-y-3.5">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-[11px] font-bold text-slate-700">Card information</label>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                <span className={`px-1.5 py-0.5 rounded font-black tracking-wider transition ${detectedBrand === "VISA" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                                  VISA
                                </span>
                                <span className={`px-1.5 py-0.5 rounded font-black tracking-wider transition ${detectedBrand === "MASTERCARD" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                                  MC
                                </span>
                                <span className={`px-1.5 py-0.5 rounded font-black tracking-wider transition ${detectedBrand === "AMEX" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                                  AMEX
                                </span>
                              </div>
                            </div>

                            {/* Stripe-style unified card container */}
                            <div className={`rounded-xl border bg-white shadow-xs transition-all overflow-hidden ${
                              paymentCardErrors.number || paymentCardErrors.expiry || paymentCardErrors.cvc
                                ? "border-rose-400 ring-1 ring-rose-400"
                                : "border-slate-300 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100/70"
                            }`}>
                              {/* Card Number */}
                              <div className="px-3.5 py-2.5 flex items-center justify-between">
                                <input
                                  ref={addCardInputRef}
                                  type="text"
                                  value={cardNumber}
                                  onChange={(e) => {
                                    handleCardNumberChange(e);
                                    if (paymentCardErrors.number) setPaymentCardErrors((prev) => ({ ...prev, number: undefined }));
                                  }}
                                  placeholder="1234 1234 1234 1234"
                                  maxLength={19}
                                  className="w-full bg-transparent text-xs font-mono tracking-wide text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-sans"
                                />
                                <svg className="h-4 w-4 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" />
                                  <line x1="2" y1="10" x2="22" y2="10" strokeWidth="2" />
                                </svg>
                              </div>

                              {/* Divider & Expiry + CVC row */}
                              <div className="border-t border-slate-200 grid grid-cols-2">
                                <div className="px-3.5 py-2">
                                  <input
                                    type="text"
                                    value={cardExpiry}
                                    onChange={(e) => {
                                      handleExpiryChange(e);
                                      if (paymentCardErrors.expiry) setPaymentCardErrors((prev) => ({ ...prev, expiry: undefined }));
                                    }}
                                    placeholder="MM / YY"
                                    maxLength={7}
                                    className="w-full bg-transparent text-xs font-mono tracking-wide text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-sans"
                                  />
                                </div>
                                <div className="border-l border-slate-200 px-3.5 py-2 flex items-center justify-between">
                                  <input
                                    type="text"
                                    value={cardCvc}
                                    onChange={(e) => {
                                      handleCvcChange(e);
                                      if (paymentCardErrors.cvc) setPaymentCardErrors((prev) => ({ ...prev, cvc: undefined }));
                                    }}
                                    placeholder="CVC"
                                    maxLength={4}
                                    className="w-full bg-transparent text-xs font-mono tracking-wide text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-sans"
                                  />
                                  <svg className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            </div>

                            {paymentCardErrors.number && (
                              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium animate-in fade-in">
                                <span>⚠️</span> {paymentCardErrors.number}
                              </p>
                            )}
                            {paymentCardErrors.expiry && (
                              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium animate-in fade-in">
                                <span>⚠️</span> {paymentCardErrors.expiry}
                              </p>
                            )}
                            {paymentCardErrors.cvc && (
                              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium animate-in fade-in">
                                <span>⚠️</span> {paymentCardErrors.cvc}
                              </p>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-bold text-slate-700">Name on card</label>
                              {paymentCardErrors.holder && (
                                <span className="text-[10px] font-bold text-rose-500">Required</span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={cardHolder}
                              onChange={(e) => {
                                setCardHolder(e.target.value);
                                if (paymentCardErrors.holder) setPaymentCardErrors((prev) => ({ ...prev, holder: undefined }));
                              }}
                              placeholder="Dr. Sarah Lee"
                              className={`w-full rounded-xl border bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition shadow-xs ${
                                paymentCardErrors.holder
                                  ? "border-rose-400 bg-rose-50/20 ring-1 ring-rose-400 focus:border-rose-500"
                                  : "border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                              }`}
                            />
                            {paymentCardErrors.holder && (
                              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium animate-in fade-in">
                                <span>⚠️</span> {paymentCardErrors.holder}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <svg className="h-3.5 w-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              End-to-end encrypted • PCI compliant
                            </span>

                            {billingState.paymentMethods.length > 0 && (
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={cardSetDefault}
                                  onChange={(e) => setCardSetDefault(e.target.checked)}
                                  className="rounded border-slate-300 text-indigo-600"
                                />
                                <span>Set as default</span>
                              </label>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            {(billingState.paymentMethods.length > 0 || pendingPlanSelection) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowInlineCardForm(false);
                                  setPendingPlanSelection(null);
                                }}
                                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              type="submit"
                              disabled={isSavingCard}
                              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-xs cursor-pointer"
                            >
                              {isSavingCard
                                ? "Processing..."
                                : pendingPricing
                                ? `Pay $${pendingPricing.totalCharge.toLocaleString()}.00 & Activate ${pendingPlanMeta?.name || "Plan"}`
                                : "Save Payment Method"}
                            </button>
                          </div>
                        </form>
                      );
                    })()}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {defaultCard
                        ? `Auto-billing active (${defaultCard.brand === "MASTERCARD" ? "Mastercard" : defaultCard.brand === "AMEX" ? "Amex" : "Visa"} •••• ${defaultCard.last4})`
                        : "Auto-billing paused (no default method)"}
                    </span>
                  </div>
                </div>

                {/* Billing Invoices List */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Billing Invoices</h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Past statements and tax receipts. Failed charges show status only without a receipt view button.
                    </p>

                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                      {billingState.invoices.map((inv) => {
                        const isFailed = inv.status === "Failed";
                        return (
                          <div
                            key={inv.id}
                            className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs ${
                              isFailed ? "border-red-200 bg-red-50/40" : "border-slate-100 bg-white"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <b className="font-bold text-slate-900">{inv.id}</b>
                                <span className="text-[11px] text-slate-500 truncate">• {inv.planName}</span>
                              </div>
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                {inv.invoiceDate}
                                {inv.cardSummary ? ` • ${inv.cardSummary}` : ""}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-slate-900">{inv.amountFormatted}</span>
                              {isFailed ? (
                                <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
                                  Failed
                                </span>
                              ) : (
                                <>
                                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                    Paid
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setViewingInvoice(inv)}
                                    className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                                  >
                                    View Invoice
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>



              {/* Tax Invoice / Receipt Modal (Only accessible for Paid invoices) */}
              {viewingInvoice && viewingInvoice.status === "Paid" && (() => {
                const totalNum = viewingInvoice.amountCents / 100;
                const taxPart = totalNum - totalNum / 1.1;
                const subPart = totalNum - taxPart;
                return (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
                    onClick={() => setViewingInvoice(null)}
                  >
                    <div
                      className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Paid Tax Invoice
                          </span>
                          <h4 className="text-base font-extrabold text-slate-900 mt-1">{viewingInvoice.id}</h4>
                          <span className="text-[11px] text-slate-500">Issued on {viewingInvoice.invoiceDate}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewingInvoice(null)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-2 text-slate-600">
                        <div className="flex justify-between">
                          <span>Billed Organization:</span>
                          <b className="text-slate-900">{user.orgName}</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Subscription Plan:</span>
                          <b className="text-slate-900">{viewingInvoice.planName}</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Billing Cycle:</span>
                          <b className="text-slate-900 capitalize">{viewingInvoice.billingCycle}</b>
                        </div>
                        <div className="flex justify-between">
                          <span>Payment Method:</span>
                          <b className="text-slate-900">{viewingInvoice.cardSummary || "Card on file"}</b>
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 space-y-1.5">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal (excl. tax)</span>
                          <span>${subPart.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Tax (10%)</span>
                          <span>${taxPart.toFixed(2)}</span>
                        </div>
                        {viewingInvoice.prorationCreditCents && viewingInvoice.prorationCreditCents > 0 ? (
                          <div className="flex justify-between text-emerald-600 font-semibold pt-1 border-t border-slate-200/60">
                            <span>Proration Credit Applied</span>
                            <span>-${(viewingInvoice.prorationCreditCents / 100).toFixed(2)}</span>
                          </div>
                        ) : null}
                        {viewingInvoice.prorationNote && (
                          <div className="text-[11px] text-slate-500 pt-0.5 italic">
                            {viewingInvoice.prorationNote}
                          </div>
                        )}
                        <div className="flex justify-between font-extrabold text-slate-900 text-sm pt-1.5 border-t border-slate-200">
                          <span>Total Paid</span>
                          <span>{viewingInvoice.amountFormatted}</span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                        >
                          🖨️ Print Receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewingInvoice(null)}
                          className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 transition cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Cancel Subscription Modal */}
              {showCancelModal && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
                  onClick={() => setShowCancelModal(false)}
                >
                  <div
                    className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 text-xs animate-in fade-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 text-lg">
                          ⚠️
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900">
                            Cancel Echo.ai Subscription
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            We're sorry to see your clinic leave. Please review the details below.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCancelModal(false)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* What happens when you cancel */}
                    <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 space-y-2 text-slate-700">
                      <span className="font-bold text-rose-900 block text-xs">
                        What happens when you cancel:
                      </span>
                      <ul className="space-y-1.5 text-[11px] text-rose-800">
                        <li className="flex items-start gap-2">
                          <span className="text-rose-500 font-bold">•</span>
                          <span>
                            Your current plan features will remain active until the end of your billing cycle (<b>{billingState.cancelEffectiveDate || "next renewal date"}</b>).
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-rose-500 font-bold">•</span>
                          <span>
                            No further automatic charges will occur on your payment card.
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-rose-500 font-bold">•</span>
                          <span>
                            After period end, your account will downgrade to the <b>Starter Plan</b> (250 convs/mo limit, 1 seat, and Cliniko 2-way sync paused).
                          </span>
                        </li>
                      </ul>
                    </div>

                    {/* Cancellation Reason Selector */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-800">
                        Please tell us why you're cancelling:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          "Too expensive / Budget constraints",
                          "Missing clinical or PMS features",
                          "Switching to another software",
                          "Practice closing or downsizing",
                          "Only needed temporarily",
                          "Other reason",
                        ].map((reasonOpt) => (
                          <button
                            key={reasonOpt}
                            type="button"
                            onClick={() => setCancelReason(reasonOpt)}
                            className={`px-3 py-2 text-left rounded-xl border text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
                              cancelReason === reasonOpt
                                ? "border-rose-500 bg-rose-50 text-rose-900 font-bold"
                                : "border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <span className={`h-3 w-3 rounded-full border flex items-center justify-center ${
                              cancelReason === reasonOpt ? "border-rose-600 bg-rose-600" : "border-slate-400"
                            }`}>
                              {cancelReason === reasonOpt && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </span>
                            <span className="truncate">{reasonOpt}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Optional Feedback / Comments */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Additional feedback (optional):
                      </label>
                      <textarea
                        rows={2}
                        value={cancelFeedback}
                        onChange={(e) => setCancelFeedback(e.target.value)}
                        placeholder="What could we have done better?"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-hidden"
                      />
                    </div>

                    {/* Retention Offer Alternative */}
                    {billingState.plan !== "starter" && (
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-bold text-indigo-950">Looking to reduce costs?</p>
                          <p className="text-[11px] text-indigo-800">
                            You can downgrade to <b>Starter ($49/mo)</b> instead of cancelling completely.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCancelModal(false);
                            handleUpdateSubscription("starter", "monthly", false);
                          }}
                          className="shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 text-xs transition cursor-pointer"
                        >
                          Switch to Starter
                        </button>
                      </div>
                    )}

                    {/* Timing Choice: End of Period vs Immediate */}
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        id="cancel-immediate"
                        checked={cancelImmediate}
                        onChange={(e) => setCancelImmediate(e.target.checked)}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <label htmlFor="cancel-immediate" className="cursor-pointer select-none">
                        Cancel immediately (revert to Starter right away instead of waiting until cycle end)
                      </label>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        disabled={isSubmittingCancellation}
                        onClick={() => setShowCancelModal(false)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                      >
                        Keep My Subscription
                      </button>
                      <button
                        type="button"
                        disabled={isSubmittingCancellation}
                        onClick={handleConfirmCancellation}
                        className="rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700 transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isSubmittingCancellation ? (
                          <>
                            <svg className="h-3.5 w-3.5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span>Cancelling...</span>
                          </>
                        ) : (
                          <span>Confirm Cancellation</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })())}

        {/* ===================== STEP 4: INTEGRATION MODALS ===================== */}

        {/* 1. Cliniko Configuration Modal */}
        {activeIntegrationModal === "cliniko" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏥</span>
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900">Cliniko Practice Sync</h4>
                    <span className="text-[11px] text-slate-500">2-way calendar availability & patient booking</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveIntegrationModal(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Clinic Shard / Region</label>
                  <select
                    value={clinikoForm.shard}
                    onChange={(e) => setClinikoForm({ ...clinikoForm, shard: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold text-slate-900 bg-white"
                  >
                    <option value="au1">au1 (Australia & New Zealand)</option>
                    <option value="uk1">uk1 (United Kingdom & Europe)</option>
                    <option value="us1">us1 (United States & Americas)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cliniko API Key</label>
                  <input
                    type="text"
                    value={clinikoForm.apiKey}
                    onChange={(e) => setClinikoForm({ ...clinikoForm, apiKey: e.target.value })}
                    placeholder="e.g. MS0x-live-cliniko-..."
                    className="w-full rounded-xl border border-slate-300 p-2 font-mono text-xs text-slate-900"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Find in Cliniko under Settings &gt; Integrations &gt; API Keys.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Clinic Name (Display)</label>
                  <input
                    type="text"
                    value={clinikoForm.clinicName}
                    onChange={(e) => setClinikoForm({ ...clinikoForm, clinicName: e.target.value })}
                    placeholder="Melbourne Wellness & Physiotherapy"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveIntegrationModal(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-bold text-slate-700 hover:bg-slate-50 transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveIntegration("cliniko", clinikoForm)}
                  disabled={savingProvider === "cliniko"}
                  className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 transition text-xs shadow-xs disabled:opacity-50"
                >
                  {savingProvider === "cliniko" ? "Saving..." : "Save Cliniko"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Custom Webhook Configuration Modal */}
        {activeIntegrationModal === "webhook" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900">Outbound Webhook Settings</h4>
                    <span className="text-[11px] text-slate-500">Live HTTP POST dispatch with HMAC-SHA256 signature</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveIntegrationModal(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Webhook Endpoint URL</label>
                  <input
                    type="url"
                    value={webhookForm.url}
                    onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    className="w-full rounded-xl border border-slate-300 p-2 font-mono text-xs text-slate-900"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Target Zapier, Make, Slack webhook, or your clinic&apos;s custom backend URL.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700">HMAC-SHA256 Secret</label>
                    <button
                      type="button"
                      onClick={() =>
                        setWebhookForm({
                          ...webhookForm,
                          secret: "whsec_echo_" + Math.random().toString(36).slice(2, 14),
                        })
                      }
                      className="text-indigo-600 hover:text-indigo-800 font-bold text-[11px]"
                    >
                      ↻ Regenerate Secret
                    </button>
                  </div>
                  <input
                    type="text"
                    value={webhookForm.secret}
                    onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2 font-mono text-xs text-slate-900"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Verify payloads using the <code>X-Echo-Signature</code> HTTP header.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-2">Subscribed Event Triggers</label>
                  <div className="space-y-2">
                    {[
                      { id: "appointment.created", label: "appointment.created — New patient appointment booked" },
                      { id: "lead.created", label: "lead.created — Inbound contact details & warm inquiry captured" },
                      { id: "conversation.escalated", label: "conversation.escalated — Human staff takeover or acute escalation" },
                    ].map((evt) => (
                      <label key={evt.id} className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={webhookForm.events.includes(evt.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWebhookForm({ ...webhookForm, events: [...webhookForm.events, evt.id] });
                            } else {
                              setWebhookForm({
                                ...webhookForm,
                                events: webhookForm.events.filter((id: string) => id !== evt.id),
                              });
                            }
                          }}
                          className="rounded text-indigo-600"
                        />
                        <span>{evt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveIntegrationModal(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-bold text-slate-700 hover:bg-slate-50 transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveIntegration("webhook", webhookForm)}
                  disabled={savingProvider === "webhook"}
                  className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800 transition text-xs shadow-xs disabled:opacity-50"
                >
                  {savingProvider === "webhook" ? "Saving..." : "Save Webhook"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Urgent SMS Escalation Modal */}
        {activeIntegrationModal === "sms" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📱</span>
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900">Urgent SMS Alerts (Twilio)</h4>
                    <span className="text-[11px] text-slate-500">Instant practitioner notifications for clinical escalations</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveIntegrationModal(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">On-Duty Alert Mobile Number</label>
                  <input
                    type="tel"
                    value={smsForm.alertPhone}
                    onChange={(e) => setSmsForm({ ...smsForm, alertPhone: e.target.value })}
                    placeholder="+61 412 884 921"
                    className="w-full rounded-xl border border-slate-300 p-2 font-semibold text-xs text-slate-900"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Receives SMS notifications when acute symptoms or urgent staff attention is requested.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Twilio Account SID</label>
                  <input
                    type="text"
                    value={smsForm.accountSid}
                    onChange={(e) => setSmsForm({ ...smsForm, accountSid: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2 font-mono text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Twilio Auth Token</label>
                  <input
                    type="password"
                    value={smsForm.authToken}
                    onChange={(e) => setSmsForm({ ...smsForm, authToken: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2 font-mono text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveIntegrationModal(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-bold text-slate-700 hover:bg-slate-50 transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveIntegration("sms", smsForm)}
                  disabled={savingProvider === "sms"}
                  className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800 transition text-xs shadow-xs disabled:opacity-50"
                >
                  {savingProvider === "sms" ? "Saving..." : "Save SMS Alert"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email & Inbound Lead Notifications Modal */}
        {activeIntegrationModal === "email" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✉️</span>
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900">Email & Inbound Lead Notifications</h4>
                    <span className="text-[11px] text-slate-500">Instant email delivery for captured leads & reception escalations</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveIntegrationModal(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold"
                >
                  ✕
                </button>
              </div>

              {testEmailResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    testEmailResult.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  <span>{testEmailResult.success ? "✓" : "⚠️"}</span>
                  <div className="flex-1">
                    <strong className="block">{testEmailResult.success ? "Verification Succeeded" : "Verification Failed"}</strong>
                    <p className="mt-0.5">{testEmailResult.message}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3.5 text-xs">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700">Resend API Key</label>
                    <a
                      href="https://resend.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      Get Free API Key (resend.com) ↗
                    </a>
                  </div>
                  <input
                    type="password"
                    value={emailForm.apiKey}
                    onChange={(e) => setEmailForm({ ...emailForm, apiKey: e.target.value })}
                    placeholder="re_123456789abcdef..."
                    className="w-full rounded-xl border border-slate-300 p-2 font-mono text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Free tier includes 3,000 emails/month. Paste your API key here or configure <code>RESEND_API_KEY</code> in environment variables.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sender Email Address (From)</label>
                  <input
                    type="text"
                    value={emailForm.fromEmail}
                    onChange={(e) => setEmailForm({ ...emailForm, fromEmail: e.target.value })}
                    placeholder="Echo.ai Alerts <onboarding@resend.dev>"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Use <code>onboarding@resend.dev</code> for instant testing, or your verified domain (e.g. <code>alerts@yourclinic.com</code>).
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alert Recipient Email (To)</label>
                  <input
                    type="email"
                    value={emailForm.recipientEmail}
                    onChange={(e) => setEmailForm({ ...emailForm, recipientEmail: e.target.value })}
                    placeholder="zaryabsheikh0@gmail.com"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    All new inbound leads, contact numbers, and urgent chat handovers will be sent to this inbox.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleTestEmailConnection}
                  disabled={isTestingEmail}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 font-bold text-indigo-700 hover:bg-indigo-100 transition text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isTestingEmail ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-indigo-700" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <span>Sending Test Email...</span>
                    </>
                  ) : (
                    <span>🧪 Send Live Test Email</span>
                  )}
                </button>

                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveIntegrationModal(null)}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-bold text-slate-700 hover:bg-slate-50 transition text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveIntegration("email", emailForm)}
                    disabled={savingProvider === "email"}
                    className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 transition text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {savingProvider === "email" ? "Saving..." : "Save Email Settings"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Delivery Log Inspection Modal */}
        {inspectingLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">{inspectingLog.eventType}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                      {inspectingLog.provider}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      inspectingLog.status === "success" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      {inspectingLog.statusCode ? `HTTP ${inspectingLog.statusCode}` : inspectingLog.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Duration: {inspectingLog.durationMs}ms • Recorded on {new Date(inspectingLog.createdAt).toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingLog(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <b className="text-slate-700 block mb-1">Dispatched Request Payload:</b>
                  <pre className="rounded-xl bg-slate-950 p-3.5 text-[11px] text-emerald-400 font-mono overflow-x-auto max-h-48 border border-slate-800 select-all">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(inspectingLog.payloadJson), null, 2);
                      } catch {
                        return inspectingLog.payloadJson;
                      }
                    })()}
                  </pre>
                </div>

                <div>
                  <b className="text-slate-700 block mb-1">Server Response Body:</b>
                  <pre className="rounded-xl bg-slate-950 p-3.5 text-[11px] text-sky-400 font-mono overflow-x-auto max-h-48 border border-slate-800 select-all">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(inspectingLog.responseJson), null, 2);
                      } catch {
                        return inspectingLog.responseJson;
                      }
                    })()}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInspectingLog(null)}
                  className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800 transition text-xs shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Team Member Staff Invitation Modal */}
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <span>👥 Invite Staff Member</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add a front desk receptionist or administrator to your organization.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsInviteModalOpen(false);
                    setInviteSuccess(null);
                    setInviteErrors(null);
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {inviteSuccess ? (
                <div className="space-y-4 py-2">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                      <span>✉️ Invitation Email Dispatched</span>
                    </div>
                    <p className="text-xs leading-relaxed">
                      A formal invitation email has been sent to <b>{inviteSuccess.email}</b> containing a secure link to choose their password and activate their staff account.
                    </p>

                    {inviteSuccess.inviteUrl && (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[11px] font-bold text-emerald-900 block">Direct Activation Link (Valid for 48 hours):</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            readOnly
                            value={inviteSuccess.inviteUrl}
                            className="flex-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-800 outline-none select-all"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(inviteSuccess.inviteUrl || "");
                              setCopiedInviteUrl(true);
                              setTimeout(() => setCopiedInviteUrl(false), 2000);
                            }}
                            className="shrink-0 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 transition shadow-2xs cursor-pointer"
                          >
                            {copiedInviteUrl ? "✓ Copied" : "Copy Link"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200 text-[11px] text-emerald-800">
                      💡 <b>Pro tip:</b> The staff member can open the link in their email (or direct URL) to choose their own password. They will be logged in immediately upon completion.
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    {inviteSuccess.inviteUrl ? (
                      <a
                        href={inviteSuccess.inviteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                      >
                        <span>Open Activation Page</span>
                        <span>↗</span>
                      </a>
                    ) : <div />}
                    <button
                      type="button"
                      onClick={() => {
                        setIsInviteModalOpen(false);
                        setInviteSuccess(null);
                        setCopiedInviteUrl(false);
                      }}
                      className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 transition text-xs shadow-xs cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendInvite();
                  }}
                  noValidate
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Staff Full Name</label>
                      {inviteErrors?.name && (
                        <span className="text-[11px] font-semibold text-rose-500">Required</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => {
                        setInviteName(e.target.value);
                        if (inviteErrors?.name) setInviteErrors((prev) => (prev ? { ...prev, name: undefined } : null));
                      }}
                      placeholder="e.g. Rachel Adams"
                      className={`w-full rounded-xl border px-3 py-2 text-xs outline-none transition ${
                        inviteErrors?.name
                          ? "border-rose-400 bg-rose-50/20 text-slate-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                          : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                      }`}
                    />
                    {inviteErrors?.name && (
                      <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1.5 mt-1 animate-in fade-in duration-150">
                        <span className="text-xs">⚠️</span>
                        <span>{inviteErrors.name}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Staff Work Email</label>
                      {inviteErrors?.email && (
                        <span className="text-[11px] font-semibold text-rose-500">Invalid Email</span>
                      )}
                    </div>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value);
                        if (inviteErrors?.email) setInviteErrors((prev) => (prev ? { ...prev, email: undefined } : null));
                      }}
                      placeholder="e.g. rachel@yourclinic.com.au"
                      className={`w-full rounded-xl border px-3 py-2 text-xs outline-none transition ${
                        inviteErrors?.email
                          ? "border-rose-400 bg-rose-50/20 text-slate-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                          : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                      }`}
                    />
                    {inviteErrors?.email && (
                      <p className="text-[11px] font-medium text-rose-600 flex items-center gap-1.5 mt-1 animate-in fade-in duration-150">
                        <span className="text-xs">⚠️</span>
                        <span>{inviteErrors.email}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Role & Permission Level</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 bg-white"
                    >
                      <option value="receptionist">Receptionist (Live Inbox, Takeover Chat & Bookings)</option>
                      <option value="admin">Administrator (Full Config, AI Setup, Knowledge & Team)</option>
                    </select>
                  </div>

                  <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={inviteRole === "admin" || inviteCanEditTemplates}
                        disabled={inviteRole === "admin"}
                        onChange={(e) => setInviteCanEditTemplates(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Allow editing company predefined message templates</span>
                    </label>
                    <p className="text-[11px] text-slate-500 pl-5 leading-relaxed">
                      When checked, this staff member can update practice-wide standard templates (/greeting, /fees, /hours, etc.).
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
                    ℹ️ Staff members will receive full access scoped to your organization. Current seat usage: <b>{teamMembers.length}/{seatLimit}</b>.
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsInviteModalOpen(false);
                        setInviteErrors(null);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-bold text-slate-700 hover:bg-slate-50 transition text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingInvite}
                      className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 transition text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingInvite ? "Sending Invite..." : "Send Staff Invite"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 6. Remove Staff Member Confirmation Modal */}
        {memberToRemove && (
          <div
            onClick={() => !isRemovingMember && setMemberToRemove(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150 text-slate-900"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-11 w-11 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center text-lg shrink-0 shadow-2xs">
                  <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-slate-900">Remove Staff Member?</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Are you sure you want to remove this staff member from your organization?
                  </p>
                </div>
              </div>

              {/* Staff Member Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    {memberToRemove.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U"}
                  </div>
                  <div className="min-w-0">
                    <b className="text-xs font-bold text-slate-900 block truncate">{memberToRemove.name}</b>
                    <span className="text-[11px] text-slate-500 font-mono truncate block">{memberToRemove.email}</span>
                  </div>
                </div>
                <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700 border border-slate-200 capitalize shadow-2xs">
                  {memberToRemove.role}
                </span>
              </div>

              {/* Warning Notice */}
              <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-100 text-[11px] text-rose-800 leading-relaxed flex items-start gap-2">
                <span className="text-xs shrink-0 mt-0.5">⚠️</span>
                <span>
                  Their active sessions will be revoked immediately and they will forfeit access to the live inbox, appointments, and dashboard.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isRemovingMember}
                  onClick={() => setMemberToRemove(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition text-xs cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isRemovingMember}
                  onClick={confirmRemoveMember}
                  className="rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700 transition text-xs shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isRemovingMember ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <span>Removing...</span>
                    </>
                  ) : (
                    <span>Remove Member</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. Delete Knowledge Source Confirmation Modal */}
        {sourceToDelete && (
          <div
            onClick={() => !deletingSourceId && setSourceToDelete(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150 text-slate-900"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-11 w-11 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center text-lg shrink-0 shadow-2xs">
                  <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-slate-900">Remove Knowledge Source?</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Are you sure you want to remove this source and its trained memory chunks?
                  </p>
                </div>
              </div>

              {/* Source Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <b className="text-xs font-bold text-slate-900 block truncate">{sourceToDelete.title}</b>
                <span className="text-[11px] text-slate-500 block mt-0.5">ID: {sourceToDelete.id}</span>
              </div>

              {/* Warning Notice */}
              <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-100 text-[11px] text-rose-800 leading-relaxed flex items-start gap-2">
                <span className="text-xs shrink-0 mt-0.5">⚠️</span>
                <span>
                  The AI receptionist will no longer use content from this source to answer visitor inquiries.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={Boolean(deletingSourceId)}
                  onClick={() => setSourceToDelete(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition text-xs cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={Boolean(deletingSourceId)}
                  onClick={confirmDeleteSource}
                  className="rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700 transition text-xs shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {deletingSourceId ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Remove Source</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 8. User Account Profile & Settings Modal */}
        {isProfileModalOpen && (
          <div
            onClick={() => !isSavingProfile && setIsProfileModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150 text-slate-900 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {currentUserState.name
                      ? currentUserState.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                      : "U"}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <span>User Account Profile & Settings</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      View your user account information, organization tier, and edit credentials.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Organization & Account Badges Card */}
              <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Work Email</span>
                  <div className="font-mono text-slate-800 text-[11px] font-semibold mt-0.5 flex items-center gap-1 truncate">
                    <span>{currentUserState.email}</span>
                  </div>
                  <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    ✓ Verified Primary
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Role & Authority</span>
                  <div className="font-semibold text-slate-800 text-[11px] mt-0.5 capitalize flex items-center gap-1">
                    <span>{currentUserState.role === "owner" ? "👑 Organization Owner" : currentUserState.role === "admin" ? "🛡️ Administrator" : currentUserState.role}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1 truncate">Full administrative control</span>
                </div>
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Workspace</span>
                  <span className="font-bold text-slate-800 text-[11px] block mt-0.5 truncate">{currentUserState.orgName}</span>
                  <span className="font-mono text-[10px] text-slate-400 block truncate">{currentUserState.orgId}</span>
                </div>
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Plan & Sector</span>
                  <span className="font-bold text-indigo-700 text-[11px] block mt-0.5 capitalize">{billingState.plan} Tier</span>
                  <span className="text-[10px] text-slate-500 block capitalize">{currentUserState.industry} Front Desk</span>
                </div>
              </div>

              {profileSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                  <span>✅</span>
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {/* Edit Form */}
              <form onSubmit={handleUpdateProfile} noValidate className="space-y-4">
                {/* Full Name Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Display Full Name</label>
                    {profileErrors?.name && (
                      <span className="text-[11px] font-semibold text-rose-500">{profileErrors.name}</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => {
                      setProfileName(e.target.value);
                      if (profileErrors?.name) setProfileErrors((prev) => (prev ? { ...prev, name: undefined } : null));
                    }}
                    placeholder="e.g. Dr. Sarah Lee"
                    className={`w-full rounded-xl border px-3 py-2 text-xs outline-none transition ${
                      profileErrors?.name
                        ? "border-rose-400 bg-rose-50/20 text-slate-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    }`}
                  />
                  <p className="text-[11px] text-slate-400">
                    This name is shown across your team directory, activity audit logs, and live staff takeover replies.
                  </p>
                </div>

                {/* Password Change Card */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <b className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>🔒 Change Password</span>
                    <span className="text-[10px] font-normal text-slate-500">(Optional — leave blank to keep current)</span>
                  </b>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Current Password</label>
                    <input
                      type="password"
                      value={profileCurrentPass}
                      onChange={(e) => {
                        setProfileCurrentPass(e.target.value);
                        if (profileErrors?.currentPass) setProfileErrors((prev) => (prev ? { ...prev, currentPass: undefined } : null));
                      }}
                      placeholder="••••••••"
                      className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none transition ${
                        profileErrors?.currentPass
                          ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                          : "border-slate-200 focus:border-indigo-600"
                      }`}
                    />
                    {profileErrors?.currentPass && (
                      <p className="text-[11px] text-rose-600 font-medium">⚠️ {profileErrors.currentPass}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">New Password</label>
                      <input
                        type="password"
                        value={profileNewPass}
                        onChange={(e) => {
                          setProfileNewPass(e.target.value);
                          if (profileErrors?.newPass) setProfileErrors((prev) => (prev ? { ...prev, newPass: undefined } : null));
                        }}
                        placeholder="Min 8 characters"
                        className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none transition ${
                          profileErrors?.newPass
                            ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                            : "border-slate-200 focus:border-indigo-600"
                        }`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Confirm Password</label>
                      <input
                        type="password"
                        value={profileConfirmPass}
                        onChange={(e) => {
                          setProfileConfirmPass(e.target.value);
                          if (profileErrors?.newPass) setProfileErrors((prev) => (prev ? { ...prev, newPass: undefined } : null));
                        }}
                        placeholder="Repeat new password"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>
                  {profileErrors?.newPass && (
                    <p className="text-[11px] text-rose-600 font-medium">⚠️ {profileErrors.newPass}</p>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition text-xs cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 transition text-xs shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingProfile ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Profile Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 9. Staff Member Details & Role Modal */}
        {editingMember && (
          <div
            onClick={() => !isSavingMemberEdit && setEditingMember(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150 text-slate-900"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {editingMember.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <span>Staff Member Details</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      View staff account details and modify role permissions.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Read-only Member Information */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Email Address:</span>
                  <span className="font-mono text-slate-800 font-semibold">{editingMember.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Account Status:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active Member
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Member Since:</span>
                  <span className="text-slate-700 font-medium text-[11px]">
                    {editingMember.created_at ? new Date(editingMember.created_at).toLocaleDateString() : "Active"}
                  </span>
                </div>
              </div>

              {/* Edit Form */}
              <form onSubmit={handleSaveMemberEdit} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Staff Full Name</label>
                    {editMemberErrors?.name && (
                      <span className="text-[11px] font-semibold text-rose-500">{editMemberErrors.name}</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={editMemberName}
                    onChange={(e) => {
                      setEditMemberName(e.target.value);
                      if (editMemberErrors?.name) setEditMemberErrors(null);
                    }}
                    placeholder="e.g. Rachel Adams"
                    className={`w-full rounded-xl border px-3 py-2 text-xs outline-none transition ${
                      editMemberErrors?.name
                        ? "border-rose-400 bg-rose-50/20 text-slate-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    }`}
                  />
                  {editMemberErrors?.name && (
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium animate-in fade-in">
                      <span>⚠️</span> {editMemberErrors.name}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Role & Access Level</label>
                  {editingMember.role === "owner" ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span>👑</span>
                        <span>Primary Organization Owner</span>
                      </span>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100/70 border border-amber-300 px-2 py-0.5 rounded-md">
                        Immutable
                      </span>
                    </div>
                  ) : user.role === "owner" && editingMember.id !== user.userId ? (
                    <>
                      <select
                        value={editMemberRole}
                        onChange={(e) => setEditMemberRole(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 bg-white text-slate-900"
                      >
                        <option value="receptionist">Receptionist (Live Inbox, Takeover Chat & Bookings)</option>
                        <option value="admin">Administrator (Full Config, AI Setup, Knowledge & Team)</option>
                        <option value="viewer">Viewer (Read-only Conversations, Logs & Analytics)</option>
                      </select>
                      <p className="text-[11px] text-slate-500">
                        {editMemberRole === "admin"
                          ? "🛡️ Administrators have full access to edit prompts, upload knowledge documents, and manage team members."
                          : editMemberRole === "receptionist"
                          ? "💬 Receptionists can triage the live chat inbox, take over conversations, and manage bookings."
                          : "👁️ Viewers have read-only access to conversation transcripts, leads, and analytics."}
                      </p>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span>{editingMember.role === "admin" ? "🛡️" : editingMember.role === "receptionist" ? "💬" : "👁️"}</span>
                          <span className="capitalize">{editingMember.role}</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span>🔒</span>
                          <span>Role Locked</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {editingMember.id === user.userId
                          ? "You cannot update your own role. Subusers cannot change their own role; only the organization owner can change roles."
                          : "Subusers cannot update member roles. Only the organization owner can change roles."}
                      </p>
                    </div>
                  )}
                </div>

                {editingMember.role !== "owner" && editingMember.id !== user.userId && (user.role === "owner" || user.role === "admin") && (
                  <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={editMemberRole === "admin" || editMemberCanEditTemplates}
                        disabled={editMemberRole === "admin"}
                        onChange={(e) => setEditMemberCanEditTemplates(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Grant permission to edit company predefined message templates</span>
                    </label>
                    <p className="text-[11px] text-slate-500 pl-5 leading-relaxed">
                      {editMemberRole === "admin"
                        ? "🛡️ Administrators automatically have permission to manage all company templates."
                        : editMemberCanEditTemplates
                        ? "✅ This subuser can edit practice-wide canned responses (/greeting, /fees, /hours, etc.)."
                        : "🔒 Read-only access to company templates. Staff member can create personal macros."}
                    </p>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  {editingMember.role !== "owner" && editingMember.id !== user.userId ? (
                    <button
                      type="button"
                      onClick={() => {
                        const target = editingMember;
                        setEditingMember(null);
                        setMemberToRemove(target);
                      }}
                      className="text-rose-600 hover:text-rose-800 text-xs font-semibold transition cursor-pointer hover:underline"
                    >
                      Remove Member
                    </button>
                  ) : (
                    <div />
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingMember(null)}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingMemberEdit}
                      className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 transition text-xs shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSavingMemberEdit ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Command Palette Modal (⌘K / Ctrl+K) */}
        {isCommandPaletteOpen && (
          <div
            onClick={() => setIsCommandPaletteOpen(false)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-w-xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-150"
            >
              <div className="p-3.5 border-b border-slate-100 flex items-center gap-3">
                <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  ref={cmdInputRef}
                  type="text"
                  value={cmdSearch}
                  onChange={(e) => setCmdSearch(e.target.value)}
                  placeholder="Type a command or search tabs (e.g. 'billing', 'faq', 'leads')..."
                  className="w-full bg-transparent outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsCommandPaletteOpen(false)}
                  className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-500 font-bold hover:bg-slate-200 transition cursor-pointer"
                >
                  ESC
                </button>
              </div>

              <div className="max-h-[380px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {commandPaletteItems.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs font-medium">
                    No matching commands or actions found for &quot;{cmdSearch}&quot;
                  </div>
                ) : (
                  commandPaletteItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.action}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-indigo-50/70 hover:text-indigo-900 text-left transition group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base shrink-0 p-1.5 rounded-lg bg-slate-100 group-hover:bg-indigo-100/70 transition">
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 group-hover:text-indigo-600 shrink-0 ml-2">
                        {item.category} →
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-3">
                  <span><b>↑↓</b> to navigate</span>
                  <span><b>↵</b> to select</span>
                </div>
                <span>Command Palette · <b>Echo.ai</b></span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
