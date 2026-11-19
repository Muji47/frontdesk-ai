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

export default function SuperadminClient({ currentUser }: SuperadminClientProps) {
  const router = useRouter();

  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<"organizations" | "users" | "system">("organizations");

  // Data States
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filters & Search
  const [orgSearch, setOrgSearch] = useState("");
  const [orgIndustryFilter, setOrgIndustryFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");

  // Shadow Login In-Flight State
  const [shadowLoggingId, setShadowLoggingId] = useState<string | null>(null);

  // Detail Modal State
  const [selectedOrgDetail, setSelectedOrgDetail] = useState<OrganizationItem | null>(null);

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
        const [overviewRes, orgsRes, usersRes] = await Promise.all([
          fetch("/api/superadmin/overview"),
          fetch("/api/superadmin/organizations"),
          fetch("/api/superadmin/users"),
        ]);

        const [overviewData, orgsData, usersData] = await Promise.all([
          overviewRes.json(),
          orgsRes.json(),
          usersRes.json(),
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
      } catch (err: any) {
        setError(err.message || "Failed to load superadmin platform data.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

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
        {/* TAB 3: PLATFORM STATUS & SYSTEM AUDIT                        */}
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
    </div>
  );
}
