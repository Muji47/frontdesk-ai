"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { UserSession } from "@/lib/auth";

export function DashboardClient({ user }: { user: UserSession }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedConv, setSelectedConv] = useState(0);

  // Agent customization state
  const isEcom = user.industry === "ecommerce";
  const [agentName, setAgentName] = useState(user.agentName || (isEcom ? "Aria" : "Maya"));
  const [brandColor, setBrandColor] = useState(isEcom ? "#4f46e5" : "#0d9488");
  const [tone, setTone] = useState("Friendly");
  const [greeting, setGreeting] = useState(
    isEcom
      ? `Hi! Welcome to ${user.orgName}. Looking for a product or tracking an order?`
      : `Hi! Welcome to ${user.orgName}. How can I assist you with appointment booking today?`
  );

  // Unanswered questions state
  const [unanswered, setUnanswered] = useState([
    { id: 1, q: isEcom ? "Do you offer student discounts?" : "Do you accept private health insurance?", count: 14, approved: false },
    { id: 2, q: isEcom ? "Can I change shipping address after order?" : "Do you treat children under 12?", count: 6, approved: false },
    { id: 3, q: isEcom ? "Do you ship to New Zealand?" : "Is parking available onsite?", count: 4, approved: false },
  ]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const clinicConvs = [
    {
      n: "Anna Brooks",
      contact: "anna@mail.com",
      time: "2m ago",
      status: "WAITING_FOR_HUMAN",
      badge: "Human needed",
      last: "I want to discuss my treatment with someone.",
      appt: "Initial Consult Request",
      msgs: [
        { from: "client", text: "Hi, I had knee surgery last month." },
        { from: "ai", text: "Sorry to hear that! I can help with bookings and clinic info. Would you like to book a rehabilitation appointment?" },
        { from: "client", text: "I want to discuss my treatment with someone." },
        { from: "ai", text: "Of course. I'll connect you with our reception team right away." },
      ],
    },
    {
      n: "John Smith",
      contact: "john@example.com",
      time: "14m ago",
      status: "RESOLVED",
      badge: "AI Resolved",
      last: "Your appointment has been confirmed for tomorrow at 10:30 AM.",
      appt: "Tomorrow 10:30 AM · Dr. Sarah Lee · Cliniko #CL-48213",
      msgs: [
        { from: "client", text: "Can I book a physiotherapy appointment tomorrow?" },
        { from: "ai", text: "Sure! Tomorrow we have availability at 9:00 AM and 10:30 AM with Dr. Sarah Lee. Which would you prefer?" },
        { from: "client", text: "10:30 AM please." },
        { from: "ai", text: "✓ Your appointment has been confirmed in Cliniko for tomorrow at 10:30 AM." },
      ],
    },
  ];

  const ecomConvs = [
    {
      n: "Daniel Ortiz",
      contact: "daniel@mail.com",
      time: "3m ago",
      status: "WAITING_FOR_HUMAN",
      badge: "Human needed",
      last: "My jacket arrived damaged, I want a refund.",
      appt: "Order #10790 · $120.00",
      msgs: [
        { from: "client", text: "My jacket arrived damaged, I want a refund." },
        { from: "ai", text: "I'm so sorry about that. Refund requests require our support team, so I am transferring you now." },
      ],
    },
    {
      n: "Priya Nair",
      contact: "priya@mail.com",
      time: "12m ago",
      status: "RESOLVED",
      badge: "AI Resolved",
      last: "Arrives tomorrow by 4:00 PM.",
      appt: "Order #10842 · FedEx In Transit",
      msgs: [
        { from: "client", text: "Where is my order #10842?" },
        { from: "ai", text: "Order #10842 is in transit via FedEx Express and arrives tomorrow by 4:00 PM." },
      ],
    },
  ];

  const convs = isEcom ? ecomConvs : clinicConvs;
  const currentConv = convs[selectedConv] || convs[0];

  const navItems = [
    { id: "overview", icon: "▦", label: "Overview" },
    { id: "agent", icon: "🤖", label: "AI Receptionist" },
    { id: "knowledge", icon: "📚", label: "Knowledge Base" },
    { id: "conversations", icon: "💬", label: "Conversations", badge: "2" },
    { id: "appointments", icon: isEcom ? "📦" : "📅", label: isEcom ? "Orders & Returns" : "Appointments" },
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
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs">F</span>
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
                <div className="text-2xl font-extrabold text-slate-900 mt-1">450</div>
                <span className="text-[11px] font-semibold text-emerald-600">+18% this month</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">AI Autonomous Resolution</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">71.4%</div>
                <span className="text-[11px] font-semibold text-emerald-600">320 handled solo</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">Human Handover</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">18%</div>
                <span className="text-[11px] font-semibold text-amber-600">80 escalated to staff</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">
                  {isEcom ? "Revenue Influenced" : "Appointments Generated"}
                </span>
                <div className="text-2xl font-extrabold text-indigo-600 mt-1">
                  {isEcom ? "$18,420" : "75 Bookings"}
                </div>
                <span className="text-[11px] font-semibold text-emerald-600">Estimated high ROI</span>
              </div>
            </div>

            {/* Quick Actions & Unanswered Banner */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <b className="text-xs text-amber-950 font-bold block">
                    3 Unanswered Customer Questions Waiting For Review
                  </b>
                  <p className="text-[11px] text-amber-800">
                    Approve answers to teach your AI receptionist how to reply next time.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("knowledge")}
                className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
              >
                Review Questions →
              </button>
            </div>

            {/* Recent Conversations Snapshot */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-slate-900">Latest Conversations</h3>
                <button
                  onClick={() => setActiveTab("conversations")}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  View All in Inbox →
                </button>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {convs.map((c, i) => (
                  <div
                    key={c.n}
                    onClick={() => {
                      setSelectedConv(i);
                      setActiveTab("conversations");
                    }}
                    className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 rounded-lg px-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                        {c.n[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{c.n}</div>
                        <div className="text-slate-500 truncate max-w-sm">{c.last}</div>
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
                      <div className="text-[10px] text-slate-400 mt-0.5">{c.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: AGENT CONFIGURATION ===================== */}
        {activeTab === "agent" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
                <h3 className="font-bold text-sm text-slate-900">Persona & Basic Profile</h3>

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
                  <label className="block font-semibold text-slate-700 mb-1">Welcome Greeting Message</label>
                  <textarea
                    rows={2}
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Brand Accent Color</label>
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
                  &nbsp;&nbsp;data-agent-id=&quot;{user.agentId || 'agt_live_992'}&quot;<br />
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
                      {agentName[0]}
                    </div>
                    <div>
                      <div className="font-bold leading-tight">{user.orgName}</div>
                      <div className="text-[10px] opacity-80">{agentName} · AI Receptionist</div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 bg-slate-50 h-64 overflow-y-auto">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white p-3 text-slate-800 shadow-sm">
                      {greeting}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold bg-white" style={{ borderColor: brandColor, color: brandColor }}>
                        {isEcom ? "Track my order" : "Book appointment"}
                      </span>
                      <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold bg-white" style={{ borderColor: brandColor, color: brandColor }}>
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
                    <button className="px-3 rounded-lg text-white font-bold" style={{ backgroundColor: brandColor }}>
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
            {/* Unanswered Questions Queue */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-sm text-slate-900 mb-1">
                Unanswered Questions Queue ({unanswered.filter((u) => !u.approved).length} Pending)
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                When the AI is asked something it doesn&apos;t know, it records the question here. Type an approved answer and click Approve to permanently update your knowledge base.
              </p>

              <div className="space-y-3">
                {unanswered.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4 space-y-3 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 text-sm">“{item.q}”</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        Asked {item.count} times
                      </span>
                    </div>

                    {item.approved ? (
                      <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700 font-semibold flex items-center gap-1.5">
                        <span>✓</span> Answer approved and indexed into vector knowledge base!
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          placeholder="Type clinic/store approved answer here..."
                          className="flex-1 rounded-xl border border-slate-200 p-2 outline-none focus:border-indigo-600 text-xs"
                        />
                        <button
                          onClick={() => {
                            setUnanswered(
                              unanswered.map((u) => (u.id === item.id ? { ...u, approved: true } : u))
                            );
                          }}
                          className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 shadow-sm"
                        >
                          Approve Answer
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Document Sources */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-slate-900">Indexed Knowledge Sources</h3>
                <button className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700">
                  + Add Source (URL / PDF)
                </button>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="pb-2 font-semibold">Source</th>
                      <th className="pb-2 font-semibold">Type</th>
                      <th className="pb-2 font-semibold">Status</th>
                      <th className="pb-2 font-semibold">Last Synced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-2.5 font-bold">https://healinghands.com.au</td>
                      <td>Website Crawl</td>
                      <td><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Indexed (18 pages)</span></td>
                      <td className="text-slate-400">Today, 2:10 AM</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold">Pricing_And_Services_2026.pdf</td>
                      <td>PDF Document</td>
                      <td><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Indexed (4 pages)</span></td>
                      <td className="text-slate-400">Yesterday</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB: CONVERSATIONS (INBOX) ===================== */}
        {activeTab === "conversations" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden grid lg:grid-cols-12 min-h-[500px]">
            {/* List */}
            <div className="lg:col-span-4 border-r border-slate-200 divide-y divide-slate-100">
              <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 flex justify-between">
                <span>Active Conversations</span>
                <span>{convs.length} total</span>
              </div>
              {convs.map((c, i) => (
                <div
                  key={c.n}
                  onClick={() => setSelectedConv(i)}
                  className={`p-3.5 cursor-pointer transition text-xs ${
                    selectedConv === i ? "bg-indigo-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <b className="text-slate-900">{c.n}</b>
                    <span className="text-[10px] text-slate-400">{c.time}</span>
                  </div>
                  <p className="text-slate-500 truncate mt-1">{c.last}</p>
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
            <div className="lg:col-span-8 flex flex-col justify-between">
              <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                <div>
                  <b className="text-slate-900">{currentConv.n}</b>
                  <span className="text-slate-500 ml-2">({currentConv.contact})</span>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-lg bg-indigo-600 px-3 py-1 font-bold text-white text-[11px]">
                    Take Over Chat
                  </button>
                  <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50">
                    Mark Resolved
                  </button>
                </div>
              </div>

              {/* Message history */}
              <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
                {currentConv.msgs.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.from === "client" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl p-3 leading-relaxed ${
                        m.from === "client"
                          ? "bg-slate-100 text-slate-800 rounded-bl-sm"
                          : "bg-indigo-600 text-white rounded-br-sm"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Bar */}
              <div className="p-3 border-t border-slate-200 bg-white flex gap-2">
                <input
                  placeholder="Type a staff reply to customer..."
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-600"
                />
                <button className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white text-xs shadow-sm">
                  Send Reply
                </button>
              </div>
            </div>
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
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="pb-2 font-semibold">{isEcom ? "Order #" : "Patient"}</th>
                    <th className="pb-2 font-semibold">{isEcom ? "Customer" : "Service"}</th>
                    <th className="pb-2 font-semibold">{isEcom ? "Total" : "Date & Time"}</th>
                    <th className="pb-2 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-2.5 font-bold">{isEcom ? "#10842" : "John Smith"}</td>
                    <td>{isEcom ? "Priya Nair" : "Initial Consultation (60 min)"}</td>
                    <td>{isEcom ? "$158.00" : "Tomorrow, 10:30 AM (Dr. Sarah Lee)"}</td>
                    <td><span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">🤖 AI Booked</span></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold">{isEcom ? "#10790" : "Emma Wilson"}</td>
                    <td>{isEcom ? "Daniel Ortiz" : "Sports Injury Follow-up"}</td>
                    <td>{isEcom ? "$120.00" : "Thursday, 2:00 PM"}</td>
                    <td><span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Receptionist</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== TAB: LEADS / ANALYTICS / INTEGRATIONS ===================== */}
        {activeTab === "integrations" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-center">
                <b className="text-sm font-bold text-slate-900">{isEcom ? "Shopify Store" : "Cliniko Practice Management"}</b>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Connected</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">Live availability and appointment sync enabled.</p>
              <div className="mt-3 text-[11px] text-slate-400">Last heartbeat: 1 min ago</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-center">
                <b className="text-sm font-bold text-slate-900">Website Chat Widget</b>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Active</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">Embed script running on client website.</p>
              <div className="mt-3 text-[11px] text-slate-400">Detected on domain</div>
            </div>
          </div>
        )}

        {["leads", "analytics", "billing"].includes(activeTab) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm space-y-3">
            <span className="text-3xl block">📊</span>
            <h3 className="font-bold text-sm text-slate-900 capitalize">{activeTab} Module Active</h3>
            <p className="max-w-md mx-auto">
              This module is linked to your organization ID <b>{user.orgId}</b> on the <b>{user.plan}</b> plan.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
