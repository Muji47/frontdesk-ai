"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EchoLogo } from "@/components/EchoLogo";
import type { UserSession } from "@/lib/auth";
import type {
  DashboardData,
  DashboardConversation,
  DashboardUnansweredQuestion,
  DashboardKnowledgeSource,
  DashboardBillingData,
  DashboardBillingInvoice,
  ConversationMessage,
} from "@/server/services/dashboard.service";
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
  targetTab: string;
  targetId?: string;
  timestamp: number;
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

export function DashboardClient({ user, initialData }: DashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedConvId, setSelectedConvId] = useState<string>(initialData.conversations[0]?.id || "");

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
  const [isAddingSource, setIsAddingSource] = useState(false);
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

  // Staff live reply & simulation state
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isSimulatingReply, setIsSimulatingReply] = useState(false);
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
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Performance & Deflection Analytics State
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);
  const [copiedEmbed, setCopiedEmbed] = useState<boolean>(false);

  // Billing, Subscription Cycles, Payment Methods & Invoice Modal State
  const [billingState, setBillingState] = useState<DashboardBillingData>(
    initialData.billing || {
      plan: (user.plan as "starter" | "growth" | "scale") || "growth",
      billingCycle: "monthly",
      currency: "AUD",
      provider: "lemonsqueezy",
      morMode: "sandbox",
      externalSubscriptionId: "sub_mor_demo",
      customerPortalUrl: "https://app.lemonsqueezy.com/my-orders",
      paymentMethods: [],
      invoices: [],
    }
  );
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
  const [billingNotice, setBillingNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAddCardModal, setShowAddCardModal] = useState<boolean>(false);
  const [cardBrand, setCardBrand] = useState<PaymentMethodBrand>("VISA");
  const [cardHolder, setCardHolder] = useState<string>(user.name || "Dr. Sarah Lee");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardExpMonth, setCardExpMonth] = useState<string>("08");
  const [cardExpYear, setCardExpYear] = useState<string>("2029");
  const [cardSetDefault, setCardSetDefault] = useState<boolean>(true);
  const [isSavingCard, setIsSavingCard] = useState<boolean>(false);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<DashboardBillingInvoice | null>(null);
  const [pendingPlanSelection, setPendingPlanSelection] = useState<{
    plan: "starter" | "growth" | "scale";
    cycle: "monthly" | "biannual" | "annual";
  } | null>(null);
  const paymentMethodsSectionRef = useRef<HTMLDivElement | null>(null);
  const addCardInputRef = useRef<HTMLInputElement | null>(null);

  // Connect to SSE real-time socket stream (multiplexed across tabs via BroadcastChannel to prevent HTTP/1.1 connection pool exhaustion)
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let bc: BroadcastChannel | null = null;
    const processedEvents = new Set<string>();

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

      if (!fromBroadcast && bc) {
        try {
          bc.postMessage(payload);
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
      } else if (payload.type === "new_appointment") {
        router.refresh();
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
        }
      } catch {
        // ignore transient network error
      } finally {
        isReconciling = false;
      }
    }

    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel(`echo_dashboard_sse_${user.orgId}`);
      bc.onmessage = (ev) => handleIncomingPayload(ev.data, true);
    }

    function disconnect() {
      clearTimeout(reconnectTimer);
      if (es) {
        es.close();
        es = null;
      }
      setIsSocketConnected(false);
    }

    function connect() {
      if (es) return;
      es = new EventSource("/api/dashboard/events");

      es.onopen = () => {
        setIsSocketConnected(true);
        reconcileConversations();
      };

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          handleIncomingPayload(payload, false);
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      };

      es.onerror = () => {
        disconnect();
        if (!document.hidden) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        if (!es) {
          connect();
        } else {
          reconcileConversations();
        }
      }
    }

    connect();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", disconnect);
    window.addEventListener("beforeunload", disconnect);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", disconnect);
      window.removeEventListener("beforeunload", disconnect);
      disconnect();
      bc?.close();
    };
  }, [router, user.orgId]);

  function handleToastClick(toast: RealtimeToast) {
    const tab = toast.targetTab === "inbox" ? "conversations" : toast.targetTab;
    setActiveTab(tab);

    if (toast.targetId && tab === "conversations") {
      setSelectedConvId(toast.targetId);
    }

    setToasts((prev) => prev.filter((t) => t.id !== toast.id));
  }

  async function handleSimulateIncoming(type?: string) {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/dashboard/events/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: type }),
      });
      if (!res.ok) throw new Error("Simulation failed");
    } catch (err: any) {
      alert("Simulation failed: " + err.message);
    } finally {
      setIsSimulating(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleApproveQuestion(questionId: string) {
    const text = answersInput[questionId]?.trim();
    if (!text) {
      alert("Please enter an answer before approving.");
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
    } catch (err: any) {
      alert(err.message || "Failed to approve question");
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
    } catch (err: any) {
      alert(err.message || "Failed to save agent settings");
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
      alert(err.message || "Failed to send staff reply");
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
    } catch (err: any) {
      alert(err.message || "Failed to toggle AI handover");
    } finally {
      setIsTogglingAi(false);
    }
  }

  async function handleSimulateCustomerReply() {
    if (!currentConv || isSimulatingReply) return;
    setIsSimulatingReply(true);
    try {
      const res = await fetch("/api/dashboard/conversations/simulate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: currentConv.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to simulate customer reply");
      const newMsg: ConversationMessage = data.message;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConv.id
            ? {
                ...c,
                status: "WAITING_FOR_HUMAN",
                badge: "Human needed",
                lastMessage: newMsg.content,
                messages: c.messages.some((m) => m.id === newMsg.id) ? c.messages : [...c.messages, newMsg],
              }
            : c
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to simulate customer reply");
    } finally {
      setIsSimulatingReply(false);
    }
  }

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    if (!newSourceTitle.trim()) return;

    setIsAddingSource(true);
    try {
      const res = await fetch("/api/dashboard/knowledge/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSourceTitle.trim(),
          sourceType: newSourceType,
          sourceUrl: newSourceType === "url" ? newSourceTitle.trim() : null,
          pageCount: newSourceType === "url" ? 18 : 6,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add source");

      setKnowledgeSources((prev) => [data.source, ...prev]);
      setNewSourceTitle("");
      setShowAddSource(false);
    } catch (err: any) {
      alert(err.message || "Failed to add knowledge source");
    } finally {
      setIsAddingSource(false);
    }
  }

  async function handleDeleteSource(sourceId: string) {
    if (!confirm("Are you sure you want to remove this knowledge source?")) return;

    setDeletingSourceId(sourceId);
    try {
      const res = await fetch("/api/dashboard/knowledge/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sourceId }),
      });

      if (!res.ok) throw new Error("Failed to delete source");

      setKnowledgeSources((prev) => prev.filter((s) => s.id !== sourceId));
    } catch (err: any) {
      alert(err.message || "Failed to delete knowledge source");
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
      alert(err.message || "Failed to test query");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleAddManualFaq(e: React.FormEvent) {
    e.preventDefault();
    if (!newFaqQ.trim() || !newFaqA.trim()) return;

    setIsAddingFaq(true);
    try {
      const addRes = await fetch("/api/dashboard/knowledge/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `FAQ: ${newFaqQ.trim().slice(0, 40)}...`,
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
          question: newFaqQ.trim(),
          frequencyCount: 1,
          status: "approved",
          approvedAnswer: newFaqA.trim(),
          lastAskedAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      setNewFaqQ("");
      setNewFaqA("");
      setShowAddFaq(false);
    } catch (err: any) {
      alert(err.message || "Failed to add FAQ");
    } finally {
      setIsAddingFaq(false);
    }
  }

  // Dynamic performance & deflection analytics calculations
  const totalConvs = conversations.length;
  const aiResolvedCount = conversations.filter((c) => c.status === "RESOLVED").length;
  const humanEscalatedCount = conversations.filter((c) => c.status === "WAITING_FOR_HUMAN").length;
  const activeCount = conversations.filter((c) => c.status === "ACTIVE").length;
  const deflectionRate =
    totalConvs > 0
      ? Math.round(((aiResolvedCount || (totalConvs - humanEscalatedCount)) / totalConvs) * 100)
      : 0;
  const hoursSaved = ((totalConvs * 4.5) / 60).toFixed(1);
  const costSavings = Math.round(Number(hoursSaved) * 34.5);

  // 7-day trend calculations scaled with timeframe
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const trendMultiplier =
    analyticsTimeframe === "24h"
      ? 0.35
      : analyticsTimeframe === "30d"
      ? 3.8
      : analyticsTimeframe === "all"
      ? 5.5
      : 1;
  const trendBars = daysOfWeek.map((day, idx) => {
    const weights = [0.12, 0.18, 0.24, 0.20, 0.14, 0.06, 0.06];
    const rawTotal = totalConvs > 0 ? Math.max(1, Math.round(totalConvs * weights[idx] * trendMultiplier)) : 0;
    const escRatio = totalConvs > 0 ? humanEscalatedCount / totalConvs : 0;
    const dayEscalated = Math.round(rawTotal * escRatio);
    const dayAi = Math.max(0, rawTotal - dayEscalated);
    return { day, total: rawTotal, ai: dayAi, escalated: dayEscalated };
  });
  const maxTrendTotal = Math.max(...trendBars.map((b) => b.total), 4);

  // Omnichannel breakdown
  const channelBreakdown = [
    { name: "Web Chat Widget", pct: totalConvs > 0 ? 76 : 0, count: Math.round(totalConvs * 0.76), color: "bg-indigo-600" },
    { name: "Direct Booking Link / Portal", pct: totalConvs > 0 ? 16 : 0, count: Math.round(totalConvs * 0.16), color: "bg-sky-500" },
    { name: "Inbound SMS / WhatsApp", pct: totalConvs > 0 ? 8 : 0, count: Math.round(totalConvs * 0.08), color: "bg-emerald-500" },
  ];

  // Intent breakdown tailored to industry
  const intentBreakdown = isEcom
    ? [
        { label: "Order Tracking & Delivery Status", pct: totalConvs > 0 ? 40 : 0, count: Math.round(totalConvs * 0.4), color: "bg-indigo-600" },
        { label: "Returns, Refunds & Exchange Policy", pct: totalConvs > 0 ? 24 : 0, count: Math.round(totalConvs * 0.24), color: "bg-sky-500" },
        { label: "Product Specifications & Sizing", pct: totalConvs > 0 ? 18 : 0, count: Math.round(totalConvs * 0.18), color: "bg-emerald-500" },
        { label: "Bulk Purchasing & Wholesale Pricing", pct: totalConvs > 0 ? 12 : 0, count: Math.round(totalConvs * 0.12), color: "bg-purple-500" },
        { label: "Payment & Checkout Escalations", pct: totalConvs > 0 ? 6 : 0, count: Math.round(totalConvs * 0.06), color: "bg-amber-500" },
      ]
    : [
        { label: "New Patient Consultation & Booking", pct: totalConvs > 0 ? 44 : 0, count: Math.round(totalConvs * 0.44), color: "bg-indigo-600" },
        { label: "Treatment Pricing & HICAPS Health Funds", pct: totalConvs > 0 ? 22 : 0, count: Math.round(totalConvs * 0.22), color: "bg-sky-500" },
        { label: "Practitioner Availability & Schedules", pct: totalConvs > 0 ? 16 : 0, count: Math.round(totalConvs * 0.16), color: "bg-emerald-500" },
        { label: "Clinic Location, Parking & Access", pct: totalConvs > 0 ? 12 : 0, count: Math.round(totalConvs * 0.12), color: "bg-purple-500" },
        { label: "Urgent Care & Clinical Escalations", pct: totalConvs > 0 ? 6 : 0, count: Math.round(totalConvs * 0.06), color: "bg-amber-500" },
      ];

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
    const snippet = `<script src="${origin}/widget.js" data-agent-id="${initialData.agent.id}" data-org-id="${user.orgId}" data-org="${user.orgId}" async></script>`;
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
  };

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
      }
    } catch {
      // Keep optimistic UI selection
    }
  }

  async function handleUpdateSubscription(
    targetPlan: "starter" | "growth" | "scale",
    targetCycle: "monthly" | "biannual" | "annual",
    simulateFailedCharge = false
  ) {
    // If no payment method is on file, navigate down to Payment Methods and open the Add Payment Method form
    if (!simulateFailedCharge && billingState.paymentMethods.length === 0) {
      const planLabel =
        targetPlan === "starter" ? "Starter Plan" : targetPlan === "scale" ? "Scale Plan" : "Growth Plan";
      const cycleLabel =
        targetCycle === "biannual"
          ? "Bi-Annual (6 Months)"
          : targetCycle === "annual"
          ? "Annual (12 Months)"
          : "Monthly";
      setPendingPlanSelection({ plan: targetPlan, cycle: targetCycle });
      setShowAddCardModal(true);
      setBillingNotice({
        type: "error",
        text: `No payment method on file — please add a payment method below to complete your switch to ${planLabel} (${cycleLabel}).`,
      });
      setTimeout(() => {
        paymentMethodsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => addCardInputRef.current?.focus(), 350);
      }, 60);
      return;
    }

    setIsUpdatingPlan(`${targetPlan}_${targetCycle}`);
    setBillingNotice(null);
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
      setBillingNotice({
        type: data.chargeSucceeded ? "success" : "error",
        text: data.message || (data.chargeSucceeded ? "Plan updated." : "Payment failed."),
      });
    } catch (err: any) {
      setBillingNotice({ type: "error", text: err.message || "Unable to update subscription." });
    } finally {
      setIsUpdatingPlan(null);
    }
  }

  async function handleAddPaymentMethod(e: React.FormEvent) {
    e.preventDefault();
    if (!cardNumber.trim()) return;
    setIsSavingCard(true);
    setBillingNotice(null);
    try {
      const res = await fetch("/api/dashboard/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_payment_method",
          brand: cardBrand,
          cardNumber,
          expMonth: cardExpMonth,
          expYear: cardExpYear,
          cardholderName: cardHolder,
          setAsDefault: cardSetDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add payment method");
      if (data.billing) setBillingState(data.billing);
      setCardNumber("");
      setShowAddCardModal(false);

      // If the user clicked Upgrade / Downgrade while having no card, automatically complete their pending plan change now
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
          setBillingNotice({
            type: subData.chargeSucceeded ? "success" : "error",
            text: subData.message || "Payment method added and subscription updated.",
          });
          return;
        }
      }

      setBillingNotice({ type: "success", text: "New payment method saved." });
    } catch (err: any) {
      setBillingNotice({ type: "error", text: err.message || "Failed to add card." });
    } finally {
      setIsSavingCard(false);
    }
  }

  async function handleSetDefaultCard(paymentMethodId: string) {
    setBusyCardId(paymentMethodId);
    setBillingNotice(null);
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
      setBillingNotice({ type: "success", text: "Default payment method updated." });
    } catch (err: any) {
      setBillingNotice({ type: "error", text: err.message || "Failed to update default card." });
    } finally {
      setBusyCardId(null);
    }
  }

  async function handleDeleteCard(paymentMethodId: string) {
    setBusyCardId(paymentMethodId);
    setBillingNotice(null);
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
      setBillingNotice({ type: "success", text: "Payment method removed." });
    } catch (err: any) {
      setBillingNotice({ type: "error", text: err.message || "Failed to delete card." });
    } finally {
      setBusyCardId(null);
    }
  }

  const navItems = [
    { id: "overview", icon: "▦", label: "Overview" },
    { id: "agent", icon: "🤖", label: "AI Receptionist" },
    {
      id: "knowledge",
      icon: "📚",
      label: "Knowledge Base",
      badge: pendingQuestionsCount > 0 ? `${pendingQuestionsCount}` : undefined,
    },
    {
      id: "conversations",
      icon: "💬",
      label: "Conversations",
      badge: conversations.length > 0 ? `${conversations.length}` : undefined,
    },
    {
      id: "appointments",
      icon: isEcom ? "📦" : "📅",
      label: isEcom ? "Orders & Tracking" : "Appointments",
    },
    { id: "leads", icon: "🎯", label: "Leads" },
    { id: "analytics", icon: "📈", label: "Analytics" },
    { id: "integrations", icon: "🔌", label: "Integrations" },
    { id: "billing", icon: "💳", label: "Billing" },
  ];

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 text-slate-900">
      {/* Fixed Viewport Sidebar (locked to top:0 and bottom:0) */}
      <aside className="fixed inset-y-0 left-0 z-30 w-64 h-dvh max-h-dvh border-r border-slate-200 bg-white flex flex-col justify-between overflow-hidden shrink-0 select-none">
        {/* 1. Fixed Top Header (Logo & Organization) */}
        <div className="shrink-0 p-4 border-b border-slate-100 bg-white">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900 group">
            <EchoLogo size={22} tile={true} tileSize="h-9 w-9" />
            <span className="font-extrabold tracking-tight text-slate-900 text-lg">
              Echo<span className="text-indigo-600">.ai</span>
            </span>
          </Link>
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
        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-0.5 text-xs custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left font-semibold transition ${
                activeTab === item.id
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* 3. Fixed Bottom Footer (Always Visible User Name & Log Out) */}
        <div className="shrink-0 mt-auto p-3 border-t border-slate-200 bg-slate-50/90">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white shadow-xs">
                {user.name
                  ? user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : "U"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate" title={user.name}>
                  {user.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate" title={user.email}>
                  {user.email}
                </div>
              </div>
            </div>
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

      {/* Main Workspace Area (offset by w-64 sidebar, scrolls independently) */}
      <main className="ml-64 flex-1 min-w-0 h-dvh overflow-y-auto p-6 md:p-8 relative custom-scrollbar">
        {/* Top-Right Real-Time Notification Stack */}
        <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              onClick={() => handleToastClick(toast)}
              className="pointer-events-auto bg-slate-950/95 border border-indigo-500/50 text-white rounded-2xl p-4 shadow-2xl backdrop-blur cursor-pointer hover:border-indigo-400 hover:scale-[1.02] transition-all transform animate-in slide-in-from-top-3 duration-300 relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400"></div>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-xl shrink-0">
                  {toast.icon || "💬"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white tracking-wide truncate">{toast.title}</span>
                    <span className="text-[10px] text-indigo-300 font-mono">Just now</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">{toast.message}</p>
                  <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-sky-400 group-hover:text-sky-300">
                    <span>Click to open in {toast.targetTab}</span>
                    <span>→</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                  }}
                  className="text-slate-500 hover:text-white p-1 rounded-lg transition"
                  title="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <EchoLogo size={24} tile={true} tileSize="h-11 w-11" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900 capitalize">
                {navItems.find((n) => n.id === activeTab)?.label}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Workspace: <b className="text-slate-700">{user.orgName}</b> · ID: <code className="font-mono text-indigo-600">{user.orgId}</code>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleSimulateIncoming()}
              disabled={isSimulating}
              className="rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-95 transition flex items-center gap-1.5 disabled:opacity-50"
              title="Test real-time socket delivery & top-right alert toast"
            >
              <span>{isSimulating ? "⏳" : "⚡"}</span>
              <span>{isSimulating ? "Simulating..." : "Test Real-Time Inquiry"}</span>
            </button>
            <Link
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              ← Marketing Site
            </Link>
            <button
              onClick={() => setActiveTab("agent")}
              className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              ⚙️ Agent Settings
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
        {activeTab === "agent" && (
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
              <div className="sticky top-6">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Live Agent Preview
                </span>
                <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden text-xs">
                  <div
                    className="p-3 text-white flex items-center gap-2.5"
                    style={{ backgroundColor: brandColor }}
                  >
                    <div className="h-8 w-8 rounded-xl bg-slate-950/80 border border-white/20 flex items-center justify-center p-1 shrink-0">
                      <EchoLogo size={18} />
                    </div>
                    <div>
                      <div className="font-bold leading-tight">{user.orgName}</div>
                      <div className="text-[10px] opacity-80">{agentName} · AI Receptionist ({tone})</div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 bg-slate-50 h-64 overflow-y-auto">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white p-3 text-slate-800 shadow-sm">
                      {greeting}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className="rounded-full border px-2.5 py-1 text-[11px] font-semibold bg-white"
                        style={{ borderColor: brandColor, color: brandColor }}
                      >
                        {isEcom ? "Track my order" : "Book appointment"}
                      </span>
                      <span
                        className="rounded-full border px-2.5 py-1 text-[11px] font-semibold bg-white"
                        style={{ borderColor: brandColor, color: brandColor }}
                      >
                        {isEcom ? "Returns & refunds" : "Pricing & hours"}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
                    <input
                      disabled
                      placeholder="Type a message..."
                      className="flex-1 bg-slate-100 rounded-lg px-2.5 py-1.5 text-xs text-slate-400"
                    />
                    <button
                      className="px-3 rounded-lg text-white font-bold"
                      style={{ backgroundColor: brandColor }}
                    >
                      ➤
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
                className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-4 text-xs"
              >
                <div className="flex justify-between items-center">
                  <b className="text-sm font-bold text-slate-900">Index New Knowledge Source</b>
                  <button
                    type="button"
                    onClick={() => setShowAddSource(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      {newSourceType === "url" ? "Website URL to Crawl" : "Document Title / Filename"}
                    </label>
                    <input
                      required
                      value={newSourceTitle}
                      onChange={(e) => setNewSourceTitle(e.target.value)}
                      placeholder={
                        newSourceType === "url"
                          ? "https://yourclinic.com.au/services"
                          : "Clinic_Price_Schedule_2026.pdf"
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Source Format</label>
                    <select
                      value={newSourceType}
                      onChange={(e) => setNewSourceType(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 outline-none focus:border-indigo-600"
                    >
                      <option value="url">Website URL Crawl</option>
                      <option value="pdf">PDF Document</option>
                      <option value="document">Text Document</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSource(false)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingSource}
                    className="rounded-xl bg-indigo-600 px-4 py-1.5 font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isAddingSource ? "Indexing..." : "Index Source"}
                  </button>
                </div>
              </form>
            )}

            {/* Modal / Card: Add Manual FAQ */}
            {showAddFaq && (
              <form
                onSubmit={handleAddManualFaq}
                className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-4 text-xs"
              >
                <div className="flex justify-between items-center">
                  <b className="text-sm font-bold text-slate-900">Add Pre-Approved Question & Answer</b>
                  <button
                    type="button"
                    onClick={() => setShowAddFaq(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer Question</label>
                  <input
                    required
                    value={newFaqQ}
                    onChange={(e) => setNewFaqQ(e.target.value)}
                    placeholder="e.g. Do you accept emergency walk-in patients?"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Approved AI Answer</label>
                  <textarea
                    required
                    rows={2}
                    value={newFaqA}
                    onChange={(e) => setNewFaqA(e.target.value)}
                    placeholder="e.g. Yes! We reserve walk-in appointment slots daily from 9 AM to 11 AM."
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddFaq(false)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600"
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
                                onClick={() => handleDeleteSource(source.id)}
                                disabled={deletingSourceId === source.id}
                                className="text-red-500 hover:text-red-700 font-semibold text-[11px] disabled:opacity-50 px-1.5 py-1 rounded-lg hover:bg-red-50 transition"
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

              <form onSubmit={handleTestSearch} className="flex gap-2">
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
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden grid lg:grid-cols-12 min-h-[580px]">
            {/* Left Thread List */}
            <div className="lg:col-span-4 border-r border-slate-200 flex flex-col bg-slate-50/40">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Customer Inbox</h3>
                  <span className="text-[11px] text-slate-500">{conversations.length} total threads</span>
                </div>
                <button
                  onClick={() => handleSimulateIncoming("new_conversation")}
                  disabled={isSimulating}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition flex items-center gap-1 border border-indigo-200"
                  title="Simulate a new incoming patient inquiry"
                >
                  <span>+ Test Inquiry</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100 overflow-y-auto max-h-[640px] flex-1 bg-white">
                {conversations.map((c, i) => {
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
                })}
              </div>
            </div>

            {/* Right Chat Message Pane */}
            {currentConv ? (
              <div className="lg:col-span-8 flex flex-col justify-between h-[640px] bg-slate-50/30">
                {/* Chat Top Header */}
                <div className="p-3.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
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

                    {/* Simulate Customer Reply */}
                    <button
                      onClick={handleSimulateCustomerReply}
                      disabled={isSimulatingReply}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                      title="Simulate the customer replying back to test two-way dialogue"
                    >
                      {isSimulatingReply ? "Simulating..." : "💬 Customer Replies"}
                    </button>
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
                <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
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

                {/* Suggested Quick Response Chips */}
                <div className="px-3 py-2 bg-white border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
                  <span className="text-slate-400 font-bold shrink-0 text-[10px] uppercase tracking-wider">AI Quick Fill:</span>
                  {(isEcom
                    ? [
                        "Your order is in transit with Australia Post and will arrive in 1-2 business days.",
                        "Items may be returned within 30 days for a full refund.",
                        "Wholesale bulk pricing is available for quantities of 20+ bags.",
                      ]
                    : [
                        "Dr. Sarah Lee has an opening tomorrow at 2:30 PM. Shall I reserve this for you?",
                        "We process on-the-spot HICAPS electronic claims for Bupa, Medibank, etc.",
                        "Please bring your doctor's referral letter and any previous imaging to your consultation.",
                      ]
                  ).map((chip, cIdx) => (
                    <button
                      key={cIdx}
                      onClick={() => setReplyText(chip)}
                      className="shrink-0 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 transition truncate max-w-[260px] border border-slate-200/60"
                      title={chip}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Reply Input Bar */}
                <div className="p-3 border-t border-slate-200 bg-white flex gap-2 shrink-0">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
                    placeholder={`Type a staff reply to ${currentConv.visitorName}... (Press Enter to send)`}
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
              <div className="lg:col-span-8 p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
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
                    {initialData.orders.map((o, oIdx) => (
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
                    {initialData.appointments.map((a, aIdx) => (
                      <tr key={a.id ? `${a.id}-${aIdx}` : `apt-${aIdx}`}>
                        <td className="py-2.5 font-bold">{a.patientName}</td>
                        <td>{a.serviceName}</td>
                        <td>{a.practitionerName}</td>
                        <td>{new Date(a.startTime).toLocaleString()}</td>
                        <td>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              a.source === "ai_booked"
                                ? "bg-indigo-50 text-indigo-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {a.source === "ai_booked" ? "🤖 AI Booked" : "Staff Booked"}
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

        {/* ===================== TAB: LEADS ===================== */}
        {activeTab === "leads" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 mb-4">Captured Inbound Leads</h3>
            <div className="overflow-x-auto text-xs">
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
                  {initialData.leads.map((l, lIdx) => (
                    <tr key={l.id ? `${l.id}-${lIdx}` : `lead-${lIdx}`}>
                      <td className="py-2.5 font-bold">{l.name}</td>
                      <td>{l.email || "—"}</td>
                      <td>{l.phone || "—"}</td>
                      <td>{l.intent}</td>
                      <td>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 capitalize">
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== TAB: INTEGRATIONS ===================== */}
        {activeTab === "integrations" && (
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

              {/* Code Snippet Box with Copy Button */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">1-Line Installation Script Tag</span>
                  <span className="text-[11px] text-slate-400">Place before the closing &lt;/body&gt; tag</span>
                </div>

                <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-200 flex items-center justify-between overflow-x-auto shadow-inner">
                  <code className="select-all">
                    {`<script src="${typeof window !== "undefined" ? window.location.origin : "https://echo.ai"}/widget.js" data-org="${user.orgId}" async></script>`}
                  </code>
                  <button
                    onClick={handleCopyEmbed}
                    className="ml-4 shrink-0 rounded-lg bg-indigo-600 px-3.5 py-1.5 font-bold text-white text-xs hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-xs"
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
            </div>

            {/* Existing Integrations Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {initialData.integrations.map((int, iIdx) => (
                <div key={int.id ? `${int.id}-${iIdx}` : `int-${iIdx}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex justify-between items-center">
                    <b className="text-sm font-bold text-slate-900 capitalize">
                      {int.provider === "cliniko"
                        ? "Cliniko Practice Management"
                        : int.provider === "shopify"
                        ? "Shopify Store Sync"
                        : "Website Chat Widget"}
                    </b>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      {int.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {int.provider === "cliniko"
                      ? "Live calendar availability and 2-way patient appointment sync active."
                      : int.provider === "shopify"
                      ? "Live order lookup, return handling, and inventory checking active."
                      : "JavaScript embed tag active and listening for website visitors."}
                  </p>
                  <div className="mt-3 text-[11px] text-slate-400">Last sync: {int.lastSyncAt}</div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                  <b className="text-sm font-bold text-slate-900 mt-0.5 block">99.2%</b>
                  <span className="text-[10px] text-emerald-600 font-semibold">Grounded in verified chunks</span>
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
                  <b className="text-sm font-bold text-slate-900 mt-0.5 block">96.4%</b>
                  <span className="text-[10px] text-emerald-600 font-semibold">Positive conversation tone</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: BILLING ===================== */}
        {activeTab === "billing" && (() => {
          const planCatalog: Array<{
            id: "starter" | "growth" | "scale";
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
              tagline: "Solo practitioners & single-site front desks",
              baseMonthly: 49,
              convLimit: 500,
              seatsLimit: 1,
              features: ["500 AI conversations / mo", "1 Staff seat", "Website embed widget", "Email & live inbox handover"],
            },
            {
              id: "growth",
              name: "Growth",
              tagline: "Multi-practitioner clinics & high-volume reception",
              baseMonthly: 99,
              convLimit: 2000,
              seatsLimit: 3,
              features: ["2,000 AI conversations / mo", "3 Staff seats", "Cliniko & Shopify 2-way sync", "Self-learning Q&A approval queue"],
            },
            {
              id: "scale",
              name: "Scale",
              tagline: "Multi-location clinic groups & enterprise SLAs",
              baseMonthly: 249,
              convLimit: 10000,
              seatsLimit: 10,
              features: ["10,000 AI conversations / mo", "10 Staff seats", "Priority SLA & custom webhooks", "Dedicated multi-site analytics"],
            },
          ];

          const tierOrder: Record<"starter" | "growth" | "scale", number> = {
            starter: 1,
            growth: 2,
            scale: 3,
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

          const activePlanMeta = planCatalog.find((p) => p.id === billingState.plan) || planCatalog[1];
          const activePricing = getCyclePricing(activePlanMeta.baseMonthly, billingState.billingCycle);
          const defaultCard = billingState.paymentMethods.find((pm) => pm.isDefault);

          return (
            <div className="space-y-6 max-w-5xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Billing & Subscription Management</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upgrade or downgrade plans, switch between Monthly, Bi-Annual, and Annual billing cycles, manage payment methods, and review invoices.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleUpdateSubscription(billingState.plan, selectedCycle, true)}
                    disabled={Boolean(isUpdatingPlan)}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                    title="Simulate a declined card charge to verify Failed invoice behavior"
                  >
                    ⚡ Test Failed Charge
                  </button>
                </div>
              </div>

              {billingNotice && (
                <div
                  className={`rounded-xl border p-3.5 text-xs font-semibold flex items-center justify-between gap-3 ${
                    billingNotice.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-red-200 bg-red-50 text-red-900"
                  }`}
                >
                  <span>
                    {billingNotice.type === "success" ? "✓ " : "⚠️ "}
                    {billingNotice.text}
                  </span>
                  <button
                    onClick={() => setBillingNotice(null)}
                    className="text-slate-400 hover:text-slate-700 font-bold px-1.5"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Current Plan Summary Card */}
              <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                        Current Active Plan
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        {activePricing.cycleLabel}
                      </span>
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
                        ? defaultCard.brand === "PAYPAL"
                          ? `Charged via PayPal (${defaultCard.cardholderName})`
                          : `Charged to ${defaultCard.brand} •••• ${defaultCard.last4}`
                        : "No default payment method on file"}
                    </span>
                  </div>
                </div>

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
                      <b className="text-slate-900">1 / {activePlanMeta.seatsLimit} Seats</b>
                    </div>
                    <div className="h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((1 / activePlanMeta.seatsLimit) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {Math.max(0, activePlanMeta.seatsLimit - 1)} seats available
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
                    const isExactCurrent =
                      billingState.plan === tier.id && billingState.billingCycle === selectedCycle;
                    const isSamePlanDifferentCycle =
                      billingState.plan === tier.id && billingState.billingCycle !== selectedCycle;
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
                          billingState.plan === tier.id
                            ? "border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-base font-extrabold text-slate-900">{tier.name}</h4>
                            {billingState.plan === tier.id && (
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
                      <h3 className="text-sm font-bold text-slate-900">Payment Methods</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingPlanSelection(null);
                          setShowAddCardModal(true);
                        }}
                        className="rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 text-xs font-bold transition cursor-pointer"
                      >
                        + Add Payment Method
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      Default payment method is charged automatically on plan updates and renewal cycles.
                    </p>

                    {/* Saved Payment Methods List */}
                    {billingState.paymentMethods.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                        No payment methods on file. Click{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setPendingPlanSelection(null);
                            setShowAddCardModal(true);
                          }}
                          className="font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                          + Add Payment Method
                        </button>{" "}
                        to add a card or PayPal account.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {billingState.paymentMethods.map((pm) => (
                          <div
                            key={pm.id}
                            className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition ${
                              pm.isDefault
                                ? "border-indigo-200 bg-indigo-50/30"
                                : "border-slate-200 bg-slate-50/50"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`h-8 w-16 shrink-0 rounded font-bold text-[10px] flex items-center justify-center tracking-wider text-white ${
                                  pm.brand === "MASTERCARD"
                                    ? "bg-amber-600"
                                    : pm.brand === "AMEX"
                                    ? "bg-sky-700"
                                    : pm.brand === "PAYPAL"
                                    ? "bg-blue-700"
                                    : pm.brand === "APPLE_PAY" || pm.brand === "GOOGLE_PAY"
                                    ? "bg-emerald-700"
                                    : "bg-slate-900"
                                }`}
                              >
                                {pm.brand === "APPLE_PAY"
                                  ? "APPLE"
                                  : pm.brand === "GOOGLE_PAY"
                                  ? "GPAY"
                                  : pm.brand}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <b className="text-xs text-slate-900 font-bold truncate">
                                    {pm.brand === "PAYPAL"
                                      ? `PayPal (${pm.cardholderName})`
                                      : `${pm.brand} ending in ${pm.last4}`}
                                  </b>
                                  {pm.isDefault && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-500 block truncate">
                                  {pm.brand === "PAYPAL"
                                    ? `Verified PayPal Account`
                                    : `${pm.cardholderName} • Expires ${pm.expMonth}/${pm.expYear}`}
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
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {defaultCard
                        ? `Auto-billing active (${
                            defaultCard.brand === "PAYPAL"
                              ? `PayPal • ${defaultCard.cardholderName}`
                              : `${defaultCard.brand} •••• ${defaultCard.last4}`
                          })`
                        : "Auto-billing paused (no default method)"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddCardModal(true)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition cursor-pointer"
                    >
                      Update Payment Method
                    </button>
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
                              {isFailed && inv.failureReason && (
                                <span className="text-[11px] text-red-600 font-medium block mt-0.5">
                                  {inv.failureReason}
                                </span>
                              )}
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

              {/* Add Payment Method Modal */}
              {showAddCardModal && (() => {
                const pendingPlanMeta = pendingPlanSelection
                  ? planCatalog.find((p) => p.id === pendingPlanSelection.plan) || planCatalog[1]
                  : null;
                const pendingPricing = pendingPlanMeta
                  ? getCyclePricing(pendingPlanMeta.baseMonthly, pendingPlanSelection!.cycle)
                  : null;

                return (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
                    onClick={() => {
                      setShowAddCardModal(false);
                      setPendingPlanSelection(null);
                    }}
                  >
                    <div
                      className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                        <div>
                          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                            {pendingPlanSelection ? "Payment Method Required" : "Secure Payment"}
                          </span>
                          <h4 className="text-base font-extrabold text-slate-900 mt-1.5">
                            {pendingPlanMeta && pendingPricing
                              ? `Add Payment Method to activate ${pendingPlanMeta.name} Plan`
                              : "Add New Payment Method"}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {pendingPlanMeta && pendingPricing
                              ? `You selected ${pendingPlanMeta.name} on a ${pendingPricing.cycleLabel} cycle ($${pendingPricing.totalCharge.toLocaleString()}.00). Add your payment method to activate.`
                              : "Add a credit/debit card or PayPal account to manage subscriptions."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCardModal(false);
                            setPendingPlanSelection(null);
                          }}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleAddPaymentMethod} className="space-y-3.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                            Select Payment Type:
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {(
                              [
                                { id: "VISA", label: "💳 Visa" },
                                { id: "MASTERCARD", label: "💳 Mastercard" },
                                { id: "AMEX", label: "💳 Amex" },
                                { id: "PAYPAL", label: "🅿️ PayPal" },
                                { id: "APPLE_PAY", label: "🍎 Apple Pay" },
                                { id: "GOOGLE_PAY", label: "🇬 Google Pay" },
                              ] as const
                            ).map((pm) => (
                              <button
                                key={pm.id}
                                type="button"
                                onClick={() => setCardBrand(pm.id)}
                                className={`rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                                  cardBrand === pm.id
                                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                }`}
                              >
                                {pm.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            {cardBrand === "PAYPAL" ? "Account / Cardholder Name" : "Cardholder Name"}
                          </label>
                          <input
                            type="text"
                            value={cardHolder}
                            onChange={(e) => setCardHolder(e.target.value)}
                            placeholder="Dr. Sarah Lee"
                            required
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-600"
                          />
                        </div>

                        {cardBrand === "PAYPAL" ? (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              PayPal Email Address
                            </label>
                            <input
                              type="email"
                              value={cardNumber}
                              onChange={(e) => setCardNumber(e.target.value)}
                              placeholder="billing@clinic.com"
                              required
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-600"
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Card Number
                              </label>
                              <input
                                ref={addCardInputRef}
                                type="text"
                                value={cardNumber}
                                onChange={(e) => setCardNumber(e.target.value)}
                                placeholder="4242 •••• •••• 4242"
                                required
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-600"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">MM</label>
                                <input
                                  type="text"
                                  maxLength={2}
                                  value={cardExpMonth}
                                  onChange={(e) => setCardExpMonth(e.target.value)}
                                  placeholder="08"
                                  required
                                  className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs outline-none focus:border-indigo-600"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">YYYY</label>
                                <input
                                  type="text"
                                  maxLength={4}
                                  value={cardExpYear}
                                  onChange={(e) => setCardExpYear(e.target.value)}
                                  placeholder="2029"
                                  required
                                  className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs outline-none focus:border-indigo-600"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cardSetDefault}
                              onChange={(e) => setCardSetDefault(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600"
                            />
                            <span>Set as default payment method</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddCardModal(false);
                                setPendingPlanSelection(null);
                                paymentMethodsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSavingCard}
                              className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
                            >
                              {isSavingCard
                                ? "Saving..."
                                : pendingPricing
                                ? `Save & Activate Plan ($${pendingPricing.totalCharge.toLocaleString()}.00)`
                                : "Save Payment Method"}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                );
              })()}

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
            </div>
          );
        })()}
      </main>
    </div>
  );
}
