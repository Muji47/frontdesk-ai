"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EchoLogo } from "@/components/EchoLogo";
import type { AuthSessionUser } from "@/server/services/auth.service";

interface SuperadminClientProps {
  currentUser: AuthSessionUser;
}

interface PlatformStats {
  totalOrganizations: number;
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalAppointments: number;
  totalLeads: number;
  estimatedMRR: number;
}

interface OrganizationItem {
  id: string;
  name: string;
  industry: string;
  plan: string;
  allow_subuser_template_editing: number;
  created_at: string;
  owner_id?: string;
  owner_name?: string;
  owner_email?: string;
  agent_id?: string;
  agent_name?: string;
  agent_greeting?: string;
  agent_color?: string;
  member_count: number;
  conversation_count: number;
  appointment_count: number;
}

interface UserItem {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  role: string;
  is_superadmin: number;
  can_edit_company_templates: number;
  created_at: string;
  organization_name: string;
  organization_industry: string;
  organization_plan: string;
}

export interface MarketingInquiry {
  id: string;
  name: string;
  email: string;
  business?: string;
  industry: string;
  website?: string;
  message: string;
  source: string;
  status: "new" | "contacted" | "qualified" | "closed";
  created_at: string;
}

export interface MarketingChat {
  id: string;
  organization_id: string;
  visitor_name: string;
  visitor_contact?: string;
  status: string;
  resolution_badge?: string;
  created_at: string;
  updated_at: string;
  organization_name: string;
  organization_industry: string;
  message_count: number;
  last_message?: string;
  last_message_at?: string;
}

export interface MarketingStats {
  totalInquiries: number;
  newInquiries: number;
  totalMarketingChats: number;
  totalMarketingMessages: number;
}

export interface ChatMessage {
  id: string;
  sender: "client" | "ai" | "staff";
  content: string;
  created_at: string;
}

export default function SuperadminClient({ currentUser }: SuperadminClientProps) {
  const router = useRouter();

  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<"organizations" | "users" | "marketing" | "system">("organizations");

  // Data States
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [marketingInquiries, setMarketingInquiries] = useState<MarketingInquiry[]>([]);
  const [marketingChats, setMarketingChats] = useState<MarketingChat[]>([]);
  const [marketingStats, setMarketingStats] = useState<MarketingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filters & Search
  const [orgSearch, setOrgSearch] = useState("");
  const [orgIndustryFilter, setOrgIndustryFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [marketingFilter, setMarketingFilter] = useState<"all" | "inquiries" | "chats">("all");
  const [marketingSearch, setMarketingSearch] = useState("");

  // Shadow Login In-Flight State
  const [shadowLoggingId, setShadowLoggingId] = useState<string | null>(null);

  // Detail Modal State
  const [selectedOrgDetail, setSelectedOrgDetail] = useState<OrganizationItem | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<MarketingInquiry | null>(null);
  const [selectedChatTranscript, setSelectedChatTranscript] = useState<{
    conv: MarketingChat;
    messages: ChatMessage[];
  } | null>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [isUpdatingInquiryStatus, setIsUpdatingInquiryStatus] = useState(false);

  function showToast(text: string, type: "success" | "error" = "success") {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  }

  // Fetch all initial data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [overviewRes, orgsRes, usersRes, marketingRes] = await Promise.all([
          fetch("/api/superadmin/overview"),
          fetch("/api/superadmin/organizations"),
          fetch("/api/superadmin/users"),
          fetch("/api/superadmin/marketing-queries"),
        ]);

        const [overviewData, orgsData, usersData, marketingData] = await Promise.all([
          overviewRes.json(),
          orgsRes.json(),
          usersRes.json(),
          marketingRes.json(),
        ]);

        if (overviewData.success) {
          setStats(overviewData.data.stats);
        }
        if (orgsData.success) {
          setOrganizations(orgsData.data.organizations || []);
        }
        if (usersData.success) {
          setUsers(usersData.data.users || []);
        }
        if (marketingData.success) {
          setMarketingInquiries(marketingData.inquiries || []);
          setMarketingChats(marketingData.marketingChats || []);
          setMarketingStats(marketingData.stats || null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load superadmin platform data.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  async function fetchMarketingData() {
    try {
      const res = await fetch("/api/superadmin/marketing-queries");
      const data = await res.json();
      if (data.success) {
        setMarketingInquiries(data.inquiries || []);
        setMarketingChats(data.marketingChats || []);
        setMarketingStats(data.stats || null);
      }
    } catch (e: any) {
      console.error("Failed to refresh marketing queries:", e);
    }
  }

  async function handleUpdateInquiryStatus(inquiryId: string, newStatus: string) {
    if (isUpdatingInquiryStatus) return;
    setIsUpdatingInquiryStatus(true);
    try {
      const res = await fetch("/api/superadmin/marketing-queries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || "Failed to update status");
      }

      setMarketingInquiries((prev) =>
        prev.map((inq) => (inq.id === inquiryId ? { ...inq, status: newStatus as any } : inq))
      );
      if (selectedInquiry && selectedInquiry.id === inquiryId) {
        setSelectedInquiry({ ...selectedInquiry, status: newStatus as any });
      }
      showToast(`Inquiry status updated to "${newStatus}".`, "success");
      await fetchMarketingData();
    } catch (err: any) {
      showToast(err.message || "Could not update status.", "error");
    } finally {
      setIsUpdatingInquiryStatus(false);
    }
  }

  async function handleInspectTranscript(chat: MarketingChat) {
    setIsLoadingTranscript(true);
    try {
      const res = await fetch(`/api/superadmin/marketing-queries?conversationId=${encodeURIComponent(chat.id)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load chat transcript");
      }
      setSelectedChatTranscript({
        conv: chat,
        messages: data.messages || [],
      });
    } catch (err: any) {
      showToast(err.message || "Failed to load transcript.", "error");
    } finally {
      setIsLoadingTranscript(false);
    }
  }

  // Handle Shadow Login
  async function handleShadowLogin(target: { targetUserId?: string; targetOrgId?: string; label: string }) {
    const idKey = target.targetUserId || target.targetOrgId || "target";
    if (shadowLoggingId) return;
    setShadowLoggingId(idKey);
    setError(null);

    try {
      const res = await fetch("/api/superadmin/shadow-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: target.targetUserId,
          targetOrgId: target.targetOrgId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || "Shadow login failed.");
      }

      showToast(`Shadow login successful! Switching to ${target.label}...`);
      // Redirect to practice dashboard with shadow session
      setTimeout(() => {
        window.location.href = data.redirectUrl || "/dashboard";
      }, 600);
    } catch (err: any) {
      setError(err.message || "Failed to initiate shadow login.");
      showToast(err.message || "Shadow login failed.", "error");
      setShadowLoggingId(null);
    }
  }

  // Filtered Organizations
  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
      org.id.toLowerCase().includes(orgSearch.toLowerCase()) ||
      (org.owner_name && org.owner_name.toLowerCase().includes(orgSearch.toLowerCase())) ||
      (org.owner_email && org.owner_email.toLowerCase().includes(orgSearch.toLowerCase()));
    const matchesIndustry = orgIndustryFilter === "all" || org.industry === orgIndustryFilter;
    return matchesSearch && matchesIndustry;
  });

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.organization_name.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === "all" || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold ${
              toastMsg.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
                : "bg-rose-950/90 border-rose-500/50 text-rose-200"
            }`}
          >
            <span>{toastMsg.type === "success" ? "✨" : "⚠️"}</span>
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* TOP COMMAND HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/superadmin" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/40">
              <span className="text-lg">👑</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <b className="text-sm font-extrabold text-white tracking-tight">Echo.ai Superadmin</b>
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Platform Owner
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Master Control Center · Shadow Login & Account Overseer
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">Logged in as:</span>
            <b className="text-white font-bold">{currentUser.name}</b>
            <span className="text-slate-500">({currentUser.email})</span>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            title="Open your personal practice workspace"
          >
            <span>🏢</span>
            <span>My Practice</span>
          </Link>

          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold border border-rose-800/60 transition cursor-pointer"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ERROR CALLOUT */}
      {error && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-white font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 space-y-6">
        {/* PLATFORM OVERVIEW KPI METRICS */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Practices
            </span>
            <b className="text-2xl font-black text-white block">
              {stats?.totalOrganizations ?? "..."}
            </b>
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              <span>●</span> Live Multi-Tenant Orgs
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Platform Users
            </span>
            <b className="text-2xl font-black text-indigo-400 block">
              {stats?.totalUsers ?? "..."}
            </b>
            <span className="text-[10px] text-slate-400 font-medium">Owners & Staff Members</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Live Conversations
            </span>
            <b className="text-2xl font-black text-sky-400 block">
              {stats?.totalConversations ?? "..."}
            </b>
            <span className="text-[10px] text-slate-400 font-medium">AI & Staff Triage</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Messages
            </span>
            <b className="text-2xl font-black text-violet-400 block">
              {stats?.totalMessages ?? "..."}
            </b>
            <span className="text-[10px] text-slate-400 font-medium">Dispatched & Inbound</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Appointments Booked
            </span>
            <b className="text-2xl font-black text-emerald-400 block">
              {stats?.totalAppointments ?? "..."}
            </b>
            <span className="text-[10px] text-slate-400 font-medium">Calendar & PMS Sync</span>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 to-slate-950/80 border border-amber-500/30 space-y-1">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
              Platform MRR
            </span>
            <b className="text-2xl font-black text-amber-300 block">
              ${stats?.estimatedMRR ?? "..."}
            </b>
            <span className="text-[10px] text-amber-500 font-semibold">Active Subscriptions</span>
          </div>
        </section>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("organizations")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "organizations"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span>🏢</span>
            <span>All Practices & Organizations ({organizations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "users"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span>👥</span>
            <span>Global User Directory ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("marketing")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "marketing"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span>📣</span>
            <span>Marketing Inquiries & Live Queries ({marketingInquiries.length + marketingChats.length})</span>
            {marketingStats && marketingStats.newInquiries > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {marketingStats.newInquiries} New
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("system")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "system"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span>⚡</span>
            <span>Platform Status & Audit</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: ALL ORGANIZATIONS & PRACTICES                         */}
        {/* ============================================================ */}
        {activeTab === "organizations" && (
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search practices by name, org ID, owner email, or doctor name..."
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                {orgSearch && (
                  <button
                    type="button"
                    onClick={() => setOrgSearch("")}
                    className="absolute right-3 top-2 text-xs text-slate-400 hover:text-white font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {["all", "clinic", "ecommerce", "realestate", "beauty", "other"].map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => setOrgIndustryFilter(ind)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition whitespace-nowrap cursor-pointer ${
                      orgIndustryFilter === ind
                        ? "bg-slate-700 text-amber-300 border border-amber-500/40"
                        : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            {/* Organizations Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Practice & Industry</th>
                      <th className="py-3 px-4">Plan Tier</th>
                      <th className="py-3 px-4">Primary Owner</th>
                      <th className="py-3 px-4">Team</th>
                      <th className="py-3 px-4">Conversations</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Superadmin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredOrgs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          No organizations found matching your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredOrgs.map((org) => {
                        const isShadowLoading = shadowLoggingId === org.id || shadowLoggingId === org.owner_id;
                        return (
                          <tr key={org.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <b className="text-white text-xs block font-bold">{org.name}</b>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-slate-500">{org.id}</span>
                                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full capitalize">
                                    {org.industry}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span
                                className={`font-bold text-[10px] uppercase px-2.5 py-1 rounded-full border ${
                                  org.plan === "pro" || org.plan === "enterprise"
                                    ? "bg-purple-950/60 border-purple-500/40 text-purple-300"
                                    : org.plan === "growth"
                                    ? "bg-indigo-950/60 border-indigo-500/40 text-indigo-300"
                                    : "bg-slate-800 border-slate-700 text-slate-300"
                                }`}
                              >
                                {org.plan}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <span className="text-slate-200 font-semibold block">
                                  {org.owner_name || "Unassigned"}
                                </span>
                                <span className="font-mono text-[11px] text-slate-400 block">
                                  {org.owner_email || "No email"}
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="text-slate-300 font-semibold">
                                {org.member_count} {org.member_count === 1 ? "staff" : "staff"}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="text-slate-300 font-bold">
                                {org.conversation_count}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                              {new Date(org.created_at).toLocaleDateString()}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrgDetail(org)}
                                  className="text-slate-400 hover:text-white font-semibold text-xs transition px-2.5 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                                  title="View practice config details"
                                >
                                  Specs
                                </button>

                                <button
                                  type="button"
                                  disabled={isShadowLoading}
                                  onClick={() =>
                                    handleShadowLogin({
                                      targetOrgId: org.id,
                                      label: `${org.name} (Owner: ${org.owner_name || org.owner_email})`,
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
                                  title="Perform shadow login into this practice owner account"
                                >
                                  <span>🕶️</span>
                                  <span>{isShadowLoading ? "Logging in..." : "Shadow Login"}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: GLOBAL USER DIRECTORY                                 */}
        {/* ============================================================ */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search user by name, email, or company name..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={() => setUserSearch("")}
                    className="absolute right-3 top-2 text-xs text-slate-400 hover:text-white font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {["all", "owner", "admin", "receptionist", "viewer", "superadmin"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setUserRoleFilter(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition whitespace-nowrap cursor-pointer ${
                      userRoleFilter === r
                        ? "bg-slate-700 text-amber-300 border border-amber-500/40"
                        : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">User Name & Email</th>
                      <th className="py-3 px-4">Company / Organization</th>
                      <th className="py-3 px-4">Role Access</th>
                      <th className="py-3 px-4">Permissions</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Shadow Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          No users found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isShadowLoading = shadowLoggingId === u.id;
                        return (
                          <tr key={u.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <b className="text-white text-xs font-bold block">{u.name}</b>
                                <span className="font-mono text-[11px] text-slate-400 block">{u.email}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="text-slate-200 font-semibold block">{u.organization_name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{u.organization_id}</span>
                            </td>

                            <td className="py-3.5 px-4">
                              {u.is_superadmin === 1 || u.role === "superadmin" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 border border-amber-500/50 text-amber-300">
                                  👑 Superadmin
                                </span>
                              ) : u.role === "owner" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/70 border border-amber-600/50 text-amber-400">
                                  👑 Practice Owner
                                </span>
                              ) : u.role === "admin" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 border border-purple-500/40 text-purple-300">
                                  🛡️ Administrator
                                </span>
                              ) : u.role === "receptionist" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-950 border border-sky-500/40 text-sky-300">
                                  💬 Receptionist
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                                  👁️ Viewer
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              {u.can_edit_company_templates === 1 || u.role === "owner" || u.role === "admin" ? (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                                  ✓ Predefined Templates Editor
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-500">
                                  Standard Member
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              {u.id !== currentUser.userId ? (
                                <button
                                  type="button"
                                  disabled={isShadowLoading}
                                  onClick={() =>
                                    handleShadowLogin({
                                      targetUserId: u.id,
                                      label: `${u.name} (${u.email})`,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 text-xs font-bold border border-slate-700 transition cursor-pointer disabled:opacity-50"
                                  title={`Shadow login directly as ${u.name}`}
                                >
                                  <span>🕶️</span>
                                  <span>{isShadowLoading ? "..." : "Shadow Login"}</span>
                                </button>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-500">
                                  (Current Superadmin)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: MARKETING SITE INQUIRIES & LIVE QUERIES               */}
        {/* ============================================================ */}
        {activeTab === "marketing" && (
          <div className="space-y-6">
            {/* Header & Quick Refresh */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-5 rounded-2xl border border-slate-800 shadow-md">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">📣</span>
                  <h3 className="font-bold text-sm text-white">Marketing Website Inquiries & Visitor Queries</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Real-time incoming client requests from the <code className="text-indigo-400">/contact</code> form and live visitor questions from the marketing sales advisor widget.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={fetchMarketingData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                  title="Refresh incoming marketing queries"
                >
                  <span>↺</span>
                  <span>Refresh Feed</span>
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Inquiries
                </span>
                <b className="text-2xl font-black text-white block">
                  {marketingStats?.totalInquiries ?? marketingInquiries.length}
                </b>
                <span className="text-[10px] text-slate-400 font-medium">From /contact page</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  New / Action Needed
                </span>
                <b className="text-2xl font-black text-rose-400 block">
                  {marketingStats?.newInquiries ?? marketingInquiries.filter((i) => i.status === "new").length}
                </b>
                <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                  <span>●</span> Pending Response
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Marketing Live Chats
                </span>
                <b className="text-2xl font-black text-indigo-400 block">
                  {marketingStats?.totalMarketingChats ?? marketingChats.length}
                </b>
                <span className="text-[10px] text-slate-400 font-medium">Echo Sales Advisor Sessions</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Visitor Messages
                </span>
                <b className="text-2xl font-black text-emerald-400 block">
                  {marketingStats?.totalMarketingMessages ??
                    marketingChats.reduce((acc, c) => acc + (c.message_count || 0), 0)}
                </b>
                <span className="text-[10px] text-slate-400 font-medium">Inbound Questions Answered</span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMarketingFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    marketingFilter === "all" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  All Activity ({marketingInquiries.length + marketingChats.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMarketingFilter("inquiries")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    marketingFilter === "inquiries" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Contact Submissions ({marketingInquiries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMarketingFilter("chats")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    marketingFilter === "chats" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Live Advisor Chats ({marketingChats.length})
                </button>
              </div>

              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search inquiries, emails, or visitor queries..."
                  value={marketingSearch}
                  onChange={(e) => setMarketingSearch(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-amber-500 transition placeholder:text-slate-500"
                />
                {marketingSearch && (
                  <button
                    type="button"
                    onClick={() => setMarketingSearch("")}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* SECTION 1: CONTACT FORM SUBMISSIONS */}
            {(marketingFilter === "all" || marketingFilter === "inquiries") && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-xl space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📝</span>
                    <b className="text-xs font-bold text-white uppercase tracking-wider">
                      Contact Page Inquiries (/contact)
                    </b>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {
                      marketingInquiries.filter((inq) => {
                        if (!marketingSearch) return true;
                        const q = marketingSearch.toLowerCase();
                        return (
                          inq.name.toLowerCase().includes(q) ||
                          inq.email.toLowerCase().includes(q) ||
                          (inq.business && inq.business.toLowerCase().includes(q)) ||
                          inq.message.toLowerCase().includes(q)
                        );
                      }).length
                    }{" "}
                    Inquiries
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Prospect</th>
                        <th className="py-3 px-4">Practice / Business</th>
                        <th className="py-3 px-4">Inquiry Snippet</th>
                        <th className="py-3 px-4">Received</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {marketingInquiries
                        .filter((inq) => {
                          if (!marketingSearch) return true;
                          const q = marketingSearch.toLowerCase();
                          return (
                            inq.name.toLowerCase().includes(q) ||
                            inq.email.toLowerCase().includes(q) ||
                            (inq.business && inq.business.toLowerCase().includes(q)) ||
                            inq.message.toLowerCase().includes(q)
                          );
                        })
                        .map((inq) => {
                          const statusColor =
                            inq.status === "new"
                              ? "bg-rose-950/80 border-rose-800 text-rose-300"
                              : inq.status === "contacted"
                              ? "bg-sky-950/80 border-sky-800 text-sky-300"
                              : inq.status === "qualified"
                              ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                              : "bg-slate-900 border-slate-700 text-slate-400";

                          return (
                            <tr key={inq.id} className="hover:bg-slate-900/40 transition">
                              <td className="py-3.5 px-4 font-semibold text-white">
                                <div className="flex flex-col">
                                  <span>{inq.name}</span>
                                  <a
                                    href={`mailto:${inq.email}`}
                                    className="text-[11px] font-mono text-indigo-400 hover:underline"
                                  >
                                    {inq.email}
                                  </a>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-200">
                                    {inq.business || "(Unspecified Business)"}
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                                      {inq.industry}
                                    </span>
                                    {inq.website && (
                                      <a
                                        href={inq.website.startsWith("http") ? inq.website : `https://${inq.website}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-indigo-400 hover:underline font-mono truncate max-w-[120px]"
                                      >
                                        {inq.website.replace(/^https?:\/\//, "")} ↗
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 max-w-xs">
                                <p className="text-[11px] text-slate-300 italic line-clamp-2">
                                  &ldquo;{inq.message}&rdquo;
                                </p>
                              </td>

                              <td className="py-3.5 px-4 text-[11px] text-slate-400 font-mono whitespace-nowrap">
                                {new Date(inq.created_at).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>

                              <td className="py-3.5 px-4">
                                <select
                                  value={inq.status}
                                  disabled={isUpdatingInquiryStatus}
                                  onChange={(e) => handleUpdateInquiryStatus(inq.id, e.target.value)}
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border outline-none cursor-pointer ${statusColor}`}
                                >
                                  <option value="new" className="bg-slate-900 text-rose-300">
                                    ● New
                                  </option>
                                  <option value="contacted" className="bg-slate-900 text-sky-300">
                                    ● Contacted
                                  </option>
                                  <option value="qualified" className="bg-slate-900 text-emerald-300">
                                    ● Qualified
                                  </option>
                                  <option value="closed" className="bg-slate-900 text-slate-400">
                                    ● Closed
                                  </option>
                                </select>
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedInquiry(inq)}
                                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION 2: LIVE MARKETING CHATS & ADVISOR SESSIONS */}
            {(marketingFilter === "all" || marketingFilter === "chats") && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-xl space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💬</span>
                    <b className="text-xs font-bold text-white uppercase tracking-wider">
                      Live Marketing Website Chats (Echo Sales Advisor & Demos)
                    </b>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {marketingChats.length} Active Streams
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Visitor & Contact</th>
                        <th className="py-3 px-4">Assigned Persona / Org</th>
                        <th className="py-3 px-4">Latest Inbound Query</th>
                        <th className="py-3 px-4">Messages</th>
                        <th className="py-3 px-4">Last Activity</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {marketingChats
                        .filter((chat) => {
                          if (!marketingSearch) return true;
                          const q = marketingSearch.toLowerCase();
                          return (
                            chat.visitor_name.toLowerCase().includes(q) ||
                            (chat.visitor_contact && chat.visitor_contact.toLowerCase().includes(q)) ||
                            chat.organization_name.toLowerCase().includes(q) ||
                            (chat.last_message && chat.last_message.toLowerCase().includes(q))
                          );
                        })
                        .map((chat) => (
                          <tr key={chat.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-3.5 px-4 font-semibold text-white">
                              <div className="flex flex-col">
                                <span className="flex items-center gap-1.5">
                                  <span>👤</span>
                                  <span>{chat.visitor_name || "Website Visitor"}</span>
                                </span>
                                {chat.visitor_contact && (
                                  <span className="text-[11px] font-mono text-indigo-400 mt-0.5">
                                    {chat.visitor_contact}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-950 border border-indigo-800 text-indigo-300">
                                {chat.organization_name}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 max-w-sm">
                              <p className="text-[11px] text-slate-300 italic line-clamp-2">
                                &ldquo;{chat.last_message || "No messages yet"}&rdquo;
                              </p>
                            </td>

                            <td className="py-3.5 px-4 text-[11px] font-mono text-slate-400">
                              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                                {chat.message_count} msgs
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-[11px] text-slate-400 font-mono whitespace-nowrap">
                              {chat.last_message_at
                                ? new Date(chat.last_message_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Just now"}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleInspectTranscript(chat)}
                                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                                >
                                  Inspect Transcript
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleShadowLogin({
                                      targetOrgId: chat.organization_id,
                                      label: `${chat.organization_name} (${chat.visitor_name})`,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs shadow-xs transition cursor-pointer"
                                  title="Shadow login to inspect inbox directly"
                                >
                                  <span>🕶️ Shadow</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: PLATFORM STATUS & SYSTEM AUDIT                        */}
        {/* ============================================================ */}
        {activeTab === "system" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
              <b className="text-sm font-bold text-white block">System Architecture & Health</b>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Database Engine:</span>
                  <b className="text-emerald-400 font-mono">SQLite (node:sqlite Native High-Speed Engine)</b>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Next.js Framework:</span>
                  <b className="text-white font-mono">Next.js 16.4.5 Turbopack</b>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Real-Time Synchronization:</span>
                  <b className="text-sky-400 font-mono">Server-Sent Events (SSE) /api/dashboard/events</b>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Shadow Login Architecture:</span>
                  <b className="text-amber-400 font-mono">HttpOnly Secure Cookie + Impersonated Session ID</b>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
              <b className="text-sm font-bold text-white block">Quick Public Widget Previews</b>
              <p className="text-xs text-slate-400 leading-relaxed">
                As platform superadmin, you can test live visitor chat widgets across various tenant practices without needing to embed code:
              </p>
              <div className="space-y-2 text-xs">
                {organizations.slice(0, 4).map((org) => (
                  <div
                    key={org.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <div>
                      <b className="text-slate-200 block">{org.name}</b>
                      <span className="text-[10px] text-slate-500 font-mono">{org.id}</span>
                    </div>
                    <Link
                      href={`/demo?org=${org.id}`}
                      target="_blank"
                      className="px-2.5 py-1 rounded-lg bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-bold text-[11px] hover:bg-indigo-900 transition"
                    >
                      Open Live Widget ↗
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: ORGANIZATION CONFIG SPECS */}
      {selectedOrgDetail && (
        <div
          onClick={() => setSelectedOrgDetail(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4 text-xs animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏢</span>
                <div>
                  <b className="text-sm font-bold text-white">{selectedOrgDetail.name}</b>
                  <p className="text-[11px] text-slate-400 font-mono">{selectedOrgDetail.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrgDetail(null)}
                className="text-slate-400 hover:text-white font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Owner</span>
                <b className="text-slate-200 text-xs block">{selectedOrgDetail.owner_name}</b>
                <span className="text-slate-500 text-[11px] font-mono">{selectedOrgDetail.owner_email}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Plan & Industry</span>
                <b className="text-amber-400 text-xs uppercase block">{selectedOrgDetail.plan}</b>
                <span className="text-slate-400 text-[11px] capitalize">{selectedOrgDetail.industry}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">AI Agent Persona</span>
                <b className="text-indigo-400 text-xs block">{selectedOrgDetail.agent_name || "Maya"}</b>
                <span className="text-slate-400 text-[10px]">Brand Color: {selectedOrgDetail.agent_color}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Activity Overview</span>
                <b className="text-emerald-400 text-xs block">{selectedOrgDetail.conversation_count} Conversations</b>
                <span className="text-slate-400 text-[10px]">{selectedOrgDetail.member_count} Staff Accounts</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Default AI Greeting</span>
              <p className="text-slate-300 text-xs italic leading-relaxed">
                &ldquo;{selectedOrgDetail.agent_greeting || "How can I assist you today?"}&rdquo;
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedOrgDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const org = selectedOrgDetail;
                  setSelectedOrgDetail(null);
                  handleShadowLogin({
                    targetOrgId: org.id,
                    label: `${org.name} (Owner: ${org.owner_name || org.owner_email})`,
                  });
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
              >
                🕶️ Shadow Login into this Practice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MARKETING INQUIRY DETAILS */}
      {selectedInquiry && (
        <div
          onClick={() => setSelectedInquiry(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4 text-xs animate-in zoom-in-95 duration-150 text-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📝</span>
                <div>
                  <b className="text-sm font-bold text-white">{selectedInquiry.name}</b>
                  <p className="text-[11px] text-slate-400">
                    Inquiry via /contact form · {new Date(selectedInquiry.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="text-slate-400 hover:text-white font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Contact Email</span>
                <a
                  href={`mailto:${selectedInquiry.email}`}
                  className="text-indigo-400 hover:underline font-mono text-xs block truncate mt-0.5"
                >
                  {selectedInquiry.email} ↗
                </a>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Practice / Business</span>
                <b className="text-slate-200 text-xs block truncate mt-0.5">
                  {selectedInquiry.business || "(Unspecified)"}
                </b>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Industry Segment</span>
                <span className="text-amber-400 text-xs uppercase font-bold block mt-0.5">
                  {selectedInquiry.industry}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Website</span>
                {selectedInquiry.website ? (
                  <a
                    href={
                      selectedInquiry.website.startsWith("http")
                        ? selectedInquiry.website
                        : `https://${selectedInquiry.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline font-mono text-xs block truncate mt-0.5"
                  >
                    {selectedInquiry.website} ↗
                  </a>
                ) : (
                  <span className="text-slate-500 text-xs block mt-0.5">None provided</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">
                Prospect Query & Questions:
              </span>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                {selectedInquiry.message}
              </div>
            </div>

            {/* Status Switcher */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Triage Status:</span>
              <div className="flex items-center gap-1.5">
                {(["new", "contacted", "qualified", "closed"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={isUpdatingInquiryStatus}
                    onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, st)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                      selectedInquiry.status === st
                        ? "bg-amber-500 text-slate-950 shadow-sm"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                Close
              </button>
              <a
                href={`mailto:${selectedInquiry.email}?subject=${encodeURIComponent(
                  "Echo.ai — Follow-up regarding your practice inquiry"
                )}`}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition"
              >
                ✉️ Email Prospect
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIVE CHAT TRANSCRIPT INSPECTOR */}
      {selectedChatTranscript && (
        <div
          onClick={() => setSelectedChatTranscript(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4 text-xs animate-in zoom-in-95 duration-150 text-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">💬</span>
                <div>
                  <div className="flex items-center gap-2">
                    <b className="text-sm font-bold text-white">
                      {selectedChatTranscript.conv.visitor_name || "Website Visitor"}
                    </b>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 border border-indigo-800 text-indigo-300">
                      {selectedChatTranscript.conv.organization_name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Session ID: <code className="font-mono text-slate-300">{selectedChatTranscript.conv.id}</code> ·{" "}
                    {selectedChatTranscript.messages.length} messages exchanged
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChatTranscript(null)}
                className="text-slate-400 hover:text-white font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Transcript Messages Flow */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 max-h-96 overflow-y-auto space-y-3 custom-scrollbar">
              {selectedChatTranscript.messages.length === 0 ? (
                <div className="py-8 text-center text-slate-500 italic">No messages found in this stream.</div>
              ) : (
                selectedChatTranscript.messages.map((m) => {
                  const isVisitor = m.sender === "client";
                  return (
                    <div key={m.id} className={`flex flex-col ${isVisitor ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-500 font-semibold">
                        <span>{isVisitor ? "👤 Visitor" : "🤖 Echo Advisor (AI)"}</span>
                        <span>·</span>
                        <span>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                          isVisitor
                            ? "bg-indigo-600 text-white rounded-tr-sm"
                            : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">
                Started {new Date(selectedChatTranscript.conv.created_at).toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChatTranscript(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const orgId = selectedChatTranscript.conv.organization_id;
                    const label = `${selectedChatTranscript.conv.organization_name} (${selectedChatTranscript.conv.visitor_name})`;
                    setSelectedChatTranscript(null);
                    handleShadowLogin({ targetOrgId: orgId, label });
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>🕶️ Shadow Login to Workspace</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
