"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { UserSession } from "@/lib/auth";
import type {
  DashboardData,
  DashboardConversation,
  DashboardUnansweredQuestion,
  DashboardKnowledgeSource,
  ConversationMessage,
} from "@/server/services/dashboard.service";

interface DashboardClientProps {
  user: UserSession;
  initialData: DashboardData;
}

export function DashboardClient({ user, initialData }: DashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedConvIndex, setSelectedConvIndex] = useState<number>(0);

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

  const currentConv = conversations[selectedConvIndex] || conversations[0];
  const pendingQuestionsCount = unanswered.filter((u) => u.status === "pending").length;

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

      // Update state locally
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConv.id
            ? {
                ...c,
                status: "RESOLVED",
                badge: "Human Resolved",
                lastMessage: newMsg.content,
                messages: [...c.messages, newMsg],
              }
            : c
        )
      );
      setReplyText("");
    } catch (err: any) {
      alert(err.message || "Failed to send staff reply");
    } finally {
      setIsSendingReply(false);
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
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Org Header */}
          <div className="p-4 border-b border-slate-100">
            <Link href="/" className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs">
                F
              </span>
              FrontDesk AI
            </Link>
            <div className="mt-3 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
              <div className="text-xs font-bold text-slate-900 truncate">{user.orgName}</div>
              <div className="text-[11px] text-slate-500 capitalize flex items-center justify-between mt-0.5">
                <span>{user.industry}</span>
                <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 uppercase">
                  {user.plan}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-0.5 text-xs">
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
        </div>

        {/* User Footer Profile & Logout */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">{user.name}</div>
              <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 min-w-0 p-6 md:p-8 overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 capitalize">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Workspace ID: <code className="font-mono text-indigo-600">{user.orgId}</code>
            </p>
          </div>

          <div className="flex items-center gap-2">
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
                      key={c.id}
                      onClick={() => {
                        setSelectedConvIndex(i);
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
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">Embed Widget on Your Website</h3>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    Ready to copy
                  </span>
                </div>
                <p className="text-slate-500">
                  Copy and paste this single script tag right before the closing &lt;/body&gt; of your website.
                </p>
                <div className="rounded-xl bg-slate-900 p-4 font-mono text-xs text-indigo-300 overflow-x-auto select-all">
                  &lt;script<br />
                  &nbsp;&nbsp;src=&quot;http://localhost:3000/widget.js&quot;<br />
                  &nbsp;&nbsp;data-agent-id=&quot;{initialData.agent.id}&quot;<br />
                  &nbsp;&nbsp;data-org-id=&quot;{user.orgId}&quot;<br />
                  &nbsp;&nbsp;async&gt;<br />
                  &lt;/script&gt;
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
                    <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
                      {agentName[0] || "A"}
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
                      {knowledgeSources.map((source) => (
                        <tr key={source.id}>
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
                            <button
                              onClick={() => handleDeleteSource(source.id)}
                              disabled={deletingSourceId === source.id}
                              className="text-red-500 hover:text-red-700 font-semibold text-[11px] disabled:opacity-50"
                            >
                              {deletingSourceId === source.id ? "Removing..." : "Remove"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

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
                  {unanswered.map((item) => (
                    <div
                      key={item.id}
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
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden grid lg:grid-cols-12 min-h-[520px]">
            {/* List */}
            <div className="lg:col-span-4 border-r border-slate-200 divide-y divide-slate-100">
              <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 flex justify-between">
                <span>Active Conversations</span>
                <span>{conversations.length} total</span>
              </div>
              {conversations.map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedConvIndex(i)}
                  className={`p-3.5 cursor-pointer transition text-xs ${
                    selectedConvIndex === i ? "bg-indigo-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <b className="text-slate-900">{c.visitorName}</b>
                    <span className="text-[10px] text-slate-400">{c.timeAgo}</span>
                  </div>
                  <p className="text-slate-500 truncate mt-1">{c.lastMessage}</p>
                  <div className="mt-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        c.status === "WAITING_FOR_HUMAN"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {c.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Body */}
            {currentConv ? (
              <div className="lg:col-span-8 flex flex-col justify-between">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                  <div>
                    <b className="text-slate-900">{currentConv.visitorName}</b>
                    <span className="text-slate-500 ml-2">({currentConv.visitorContact})</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                      Ref: {currentConv.externalRef || "General Inquiry"}
                    </span>
                  </div>
                </div>

                {/* Message history */}
                <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs min-h-[300px]">
                  {currentConv.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.sender === "client" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl p-3 leading-relaxed ${
                          m.sender === "client"
                            ? "bg-slate-100 text-slate-800 rounded-bl-sm"
                            : m.sender === "staff"
                            ? "bg-emerald-600 text-white rounded-br-sm"
                            : "bg-indigo-600 text-white rounded-br-sm"
                        }`}
                      >
                        <div className="text-[10px] opacity-75 mb-0.5 font-bold uppercase">
                          {m.sender === "client"
                            ? currentConv.visitorName
                            : m.sender === "staff"
                            ? "Staff Member"
                            : initialData.agent.name}
                        </div>
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reply Bar */}
                <div className="p-3 border-t border-slate-200 bg-white flex gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
                    placeholder="Type a staff reply to customer..."
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-600"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={isSendingReply || !replyText.trim()}
                    className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white text-xs shadow-sm disabled:opacity-50"
                  >
                    {isSendingReply ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-8 p-12 text-center text-xs text-slate-400">
                No conversation selected.
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
                    {initialData.orders.map((o) => (
                      <tr key={o.id}>
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
                    {initialData.appointments.map((a) => (
                      <tr key={a.id}>
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
                  {initialData.leads.map((l) => (
                    <tr key={l.id}>
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
          <div className="grid gap-4 md:grid-cols-2">
            {initialData.integrations.map((int) => (
              <div key={int.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
        )}

        {/* ===================== TAB: ANALYTICS / BILLING ===================== */}
        {["analytics", "billing"].includes(activeTab) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm space-y-3">
            <span className="text-3xl block">📊</span>
            <h3 className="font-bold text-sm text-slate-900 capitalize">{activeTab} Module Active</h3>
            <p className="max-w-md mx-auto">
              This module is linked to your organization ID <b>{user.orgId}</b> on the <b>{user.plan}</b> plan. Real-time telemetry is recording all receptionist events.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
