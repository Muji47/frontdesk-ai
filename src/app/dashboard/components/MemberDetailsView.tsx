"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { UserMessageTemplate } from "@/lib/templates";

export interface MemberRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  organization_id?: string;
  created_at?: string;
}

export interface CurrentUserData {
  userId: string;
  email: string;
  name: string;
  role: string;
  orgId: string;
  orgName: string;
  industry: string;
}

interface MemberDetailsViewProps {
  member: MemberRecord;
  currentUser: CurrentUserData;
  onBack: () => void;
  onUpdateMember?: (updated: { id: string; name: string; role: string }) => void;
  onTemplatesChanged?: () => void;
}

export default function MemberDetailsView({
  member,
  currentUser,
  onBack,
  onUpdateMember,
  onTemplatesChanged,
}: MemberDetailsViewProps) {
  const isSelf = member.id === currentUser.userId || member.email.toLowerCase() === currentUser.email.toLowerCase();
  const canEditMemberInfo = isSelf || currentUser.role === "owner" || currentUser.role === "admin";
  const canEditTemplates = isSelf || currentUser.role === "owner" || currentUser.role === "admin";

  const [templates, setTemplates] = useState<UserMessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Member Info Edit State
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState(member.name);
  const [editRole, setEditRole] = useState(member.role);
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  // New Custom Template State
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

  // Editing Existing Template State
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCommand, setEditCommand] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Copy feedback & Simulator
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [simulatorInput, setSimulatorInput] = useState("");
  const [simulatorMatched, setSimulatorMatched] = useState<string | null>(null);

  // Fetch templates for this member
  async function fetchTemplates() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/templates?userId=${encodeURIComponent(member.id)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load message templates.");
      }
      setTemplates(data.data.templates || []);
      if (onTemplatesChanged && isSelf) {
        onTemplatesChanged();
      }
    } catch (err: any) {
      setError(err.message || "Failed to load templates.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
    setEditName(member.name);
    setEditRole(member.role);
  }, [member.id]);

  // Flash success message
  function notifySuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  }

  // Handle Member Info Save
  async function handleSaveMemberInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;

    setIsSavingInfo(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: member.id,
          name: editName.trim(),
          role: editRole,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update member information.");
      }
      notifySuccess("Member details updated successfully!");
      setIsEditingInfo(false);
      if (onUpdateMember) {
        onUpdateMember({ id: member.id, name: editName.trim(), role: editRole });
      }
    } catch (err: any) {
      setError(err.message || "Could not save member details.");
    } finally {
      setIsSavingInfo(false);
    }
  }

  // Handle Create Custom Template
  async function handleCreateCustomTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newCommand.trim() || !newContent.trim()) {
      setError("Please fill in Title, Command Shortcut, and Message Content.");
      return;
    }

    setIsSubmittingCustom(true);
    setError(null);
    try {
      let cmd = newCommand.trim();
      if (!cmd.startsWith("/")) cmd = "/" + cmd;

      const res = await fetch("/api/dashboard/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.id,
          title: newTitle.trim(),
          command: cmd,
          content: newContent.trim(),
          category: newCategory.trim() || "General",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create custom template.");
      }

      notifySuccess(`Custom template "${cmd}" added successfully!`);
      setNewTitle("");
      setNewCommand("");
      setNewContent("");
      setNewCategory("General");
      setIsAddingCustom(false);
      await fetchTemplates();
    } catch (err: any) {
      setError(err.message || "Failed to create template.");
    } finally {
      setIsSubmittingCustom(false);
    }
  }

  // Handle Edit Existing Template (Predefined or Custom)
  function startEditingTemplate(t: UserMessageTemplate) {
    setEditingTemplateId(t.id);
    setEditTitle(t.title);
    setEditCommand(t.command);
    setEditContent(t.content);
    setEditCategory(t.category);
  }

  async function handleSaveEditedTemplate(templateId: string) {
    if (!editTitle.trim() || !editCommand.trim() || !editContent.trim()) {
      setError("Title, command shortcut, and content cannot be empty.");
      return;
    }

    setIsSavingEdit(true);
    setError(null);
    try {
      let cmd = editCommand.trim();
      if (!cmd.startsWith("/")) cmd = "/" + cmd;

      const res = await fetch("/api/dashboard/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.id,
          id: templateId,
          title: editTitle.trim(),
          command: cmd,
          content: editContent.trim(),
          category: editCategory.trim() || "General",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save template edits.");
      }

      notifySuccess(`Template "${cmd}" updated successfully!`);
      setEditingTemplateId(null);
      await fetchTemplates();
    } catch (err: any) {
      setError(err.message || "Failed to save template edits.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  // Handle Delete Template
  async function handleDeleteTemplate(t: UserMessageTemplate) {
    if (!confirm(`Are you sure you want to delete template "${t.command}" (${t.title})?`)) {
      return;
    }

    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/templates?id=${encodeURIComponent(t.id)}&userId=${encodeURIComponent(member.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete template.");
      }
      notifySuccess(`Template "${t.command}" removed.`);
      await fetchTemplates();
    } catch (err: any) {
      setError(err.message || "Failed to delete template.");
    }
  }

  // Handle Toggle Active/Inactive
  async function handleToggleActive(t: UserMessageTemplate) {
    setError(null);
    try {
      const newActive = t.is_active ? 0 : 1;
      const res = await fetch("/api/dashboard/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.id,
          id: t.id,
          title: t.title,
          command: t.command,
          content: t.content,
          category: t.category,
          is_active: newActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update template status.");
      }
      setTemplates((prev) =>
        prev.map((item) => (item.id === t.id ? { ...item, is_active: newActive } : item))
      );
      if (onTemplatesChanged && isSelf) {
        onTemplatesChanged();
      }
    } catch (err: any) {
      setError(err.message || "Failed to toggle template status.");
    }
  }

  // Handle Reset to Defaults
  async function handleResetToDefaults() {
    if (
      !confirm(
        "Are you sure you want to reset all predefined messages to standard clinic defaults? Any personal edits to predefined templates will be refreshed."
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reset templates.");
      }
      notifySuccess("Predefined messages have been restored to defaults!");
      setTemplates(data.data.templates || []);
      if (onTemplatesChanged && isSelf) {
        onTemplatesChanged();
      }
    } catch (err: any) {
      setError(err.message || "Could not reset templates.");
    } finally {
      setIsLoading(false);
    }
  }

  // Handle Copy Template
  function handleCopyText(t: UserMessageTemplate) {
    navigator.clipboard.writeText(t.content);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  // Handle Interactive Simulator Typing
  function handleSimulatorTyping(val: string) {
    let text = val;
    let matchedName: string | null = null;

    // Check active templates
    for (const t of templates.filter((item) => item.is_active)) {
      if (text.endsWith(`${t.command} `) || text === t.command) {
        text = t.content;
        matchedName = `${t.title} (${t.command})`;
        break;
      }
    }

    setSimulatorInput(text);
    if (matchedName) {
      setSimulatorMatched(matchedName);
      setTimeout(() => setSimulatorMatched(null), 2500);
    }
  }

  // Filter Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) {
      if (t.category) set.add(t.category);
    }
    return Array.from(set);
  }, [templates]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.content.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === "all" ||
        (selectedCategory === "predefined" && t.is_predefined === 1) ||
        (selectedCategory === "custom" && t.is_predefined === 0) ||
        t.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCat;
    });
  }, [templates, searchQuery, selectedCategory]);

  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const predefinedCount = templates.filter((t) => t.is_predefined === 1).length;
  const customCount = templates.filter((t) => t.is_predefined === 0).length;
  const activeCount = templates.filter((t) => t.is_active === 1).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-fade-in">
      {/* Top Breadcrumb & Back Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl transition shadow-2xs cursor-pointer group"
        >
          <span className="text-base group-hover:-translate-x-0.5 transition-transform">←</span>
          <span>Back to Team Directory</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Viewing details for:</span>
          <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
            {member.name} {isSelf && "(You)"}
          </span>
        </div>
      </div>

      {/* Global Toast / Feedback Alerts */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-base">✅</span>
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-xs font-semibold text-rose-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* SECTION 1: Member Profile & Account Overview Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 h-32 w-32 bg-indigo-50/60 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white font-extrabold text-xl flex items-center justify-center shadow-md shrink-0 ring-4 ring-indigo-50">
              {initials || "U"}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{member.name}</h1>
                {isSelf && (
                  <span className="rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-0.5 text-[11px] font-bold border border-indigo-200/60">
                    Your Profile
                  </span>
                )}
                {member.role === "owner" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    👑 Owner
                  </span>
                ) : member.role === "admin" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    🛡️ Administrator
                  </span>
                ) : member.role === "receptionist" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                    💬 Receptionist
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    Viewer
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active Account
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <span>✉️</span> {member.email}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-sans">
                  <span>🏢</span> {currentUser.orgName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-sans">
                  <span>📅</span> Joined {member.created_at ? new Date(member.created_at).toLocaleDateString() : "Active"}
                </span>
              </div>
            </div>
          </div>

          {canEditMemberInfo && !isEditingInfo && (
            <button
              type="button"
              onClick={() => setIsEditingInfo(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs"
            >
              <span>✏️</span>
              <span>Edit Account Details</span>
            </button>
          )}
        </div>

        {/* Inline Member Info Edit Form */}
        {isEditingInfo && (
          <form
            onSubmit={handleSaveMemberInfo}
            className="mt-6 pt-5 border-t border-slate-100 bg-slate-50/80 -mx-6 -mb-6 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <b className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>✏️</span> Edit Staff Member Details
              </b>
              <button
                type="button"
                onClick={() => setIsEditingInfo(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Full Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Role Permissions
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  disabled={member.role === "owner" && currentUser.role !== "owner"}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-indigo-500"
                >
                  {member.role === "owner" ? (
                    <option value="owner">Owner (Primary Organization Account)</option>
                  ) : (
                    <>
                      <option value="admin">Administrator (Full settings & billing control)</option>
                      <option value="receptionist">Receptionist / Front Desk (Live inbox, takeover, macros)</option>
                      <option value="viewer">Viewer (Read-only access)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingInfo(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingInfo}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition shadow-2xs cursor-pointer"
              >
                {isSavingInfo ? "Saving..." : "Save Details"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* SECTION 2: Predefined Messages & Canned Templates Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Predefined Messages & Canned Templates</span>
            <span className="rounded-full bg-indigo-100 text-indigo-700 px-2.5 py-0.5 text-[11px] font-bold">
              {templates.length} Macros
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {isSelf
              ? "Every staff member gets a set of predefined messages. Edit any predefined response to match your personal style, or create custom slash templates to use during live chat triage."
              : `Manage personal macros and predefined message templates for ${member.name}. These are automatically provisioned and available in live chat takeover.`}
          </p>
        </div>

        {canEditTemplates && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl transition shadow-2xs cursor-pointer"
              title="Restore standard clinic defaults for all predefined templates"
            >
              <span>↺</span>
              <span>Restore Defaults</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddingCustom(!isAddingCustom)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl transition shadow-sm cursor-pointer"
            >
              <span>{isAddingCustom ? "✕ Close Form" : "+ Add Custom Template"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Total Templates</span>
          <span className="text-xl font-extrabold text-slate-900 mt-0.5 block">{templates.length}</span>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-indigo-600 block uppercase tracking-wider">Predefined Messages</span>
          <span className="text-xl font-extrabold text-indigo-900 mt-0.5 block">{predefinedCount}</span>
        </div>
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-purple-600 block uppercase tracking-wider">Custom Templates</span>
          <span className="text-xl font-extrabold text-purple-900 mt-0.5 block">{customCount}</span>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-600 block uppercase tracking-wider">Active In Live Chat</span>
          <span className="text-xl font-extrabold text-emerald-900 mt-0.5 block">{activeCount}</span>
        </div>
      </div>

      {/* SECTION 3: Create Custom Template Drawer / Form */}
      {isAddingCustom && (
        <form
          onSubmit={handleCreateCustomTemplate}
          className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 p-5 shadow-xs space-y-4 animate-fade-in"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">✨</span>
              <b className="text-xs font-bold text-slate-900 uppercase tracking-wider">Create New Custom Template</b>
            </div>
            <span className="text-[11px] text-indigo-700 font-semibold bg-white px-2 py-0.5 rounded-full border border-indigo-200">
              Personal Macro
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Template Title
              </label>
              <input
                type="text"
                placeholder="e.g. Telehealth Video Link"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Command Shortcut (Slash Macro)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="/zoom"
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white text-slate-900 font-mono focus:outline-indigo-500"
                  required
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Typing this in chat will expand the message</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Category
              </label>
              <input
                type="text"
                placeholder="e.g. Consultation, Care, General"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-indigo-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Message Content
              </label>
              <span className="text-[10px] text-slate-400">{newContent.length} characters</span>
            </div>
            <textarea
              rows={3}
              placeholder="Type the full message text to be delivered to the patient or visitor..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-indigo-500 leading-relaxed"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingCustom(false)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingCustom}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition shadow-xs cursor-pointer"
            >
              {isSubmittingCustom ? "Creating..." : "Save Custom Template"}
            </button>
          </div>
        </form>
      )}

      {/* SECTION 4: Search & Category Filter Pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search templates by command (/fees), title, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-2 text-xs bg-slate-50/50 text-slate-900 focus:bg-white focus:outline-indigo-500"
          />
          <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === "all"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            All ({templates.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("predefined")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === "predefined"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            Predefined ({predefinedCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("custom")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === "custom"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            Custom ({customCount})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat.toLowerCase())}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.toLowerCase()
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 5: Template Cards Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          Loading predefined messages and templates...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200 space-y-2">
          <p className="font-semibold text-slate-600">No message templates match your filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
            }}
            className="text-indigo-600 hover:underline font-semibold"
          >
            Clear search filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((t) => {
            const isEditing = editingTemplateId === t.id;

            return (
              <div
                key={t.id}
                className={`rounded-2xl border transition-all duration-200 bg-white p-5 shadow-xs flex flex-col justify-between ${
                  !t.is_active
                    ? "opacity-60 border-slate-200 bg-slate-50/50"
                    : isEditing
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-md"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                {/* Card Top: Badges, Shortcut, Title */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-lg shadow-2xs">
                        ⚡ {t.command}
                      </span>
                      {t.is_predefined === 1 ? (
                        <span className="text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                          Predefined
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                          Custom
                        </span>
                      )}
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {t.category}
                      </span>
                    </div>

                    {canEditTemplates && (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(t)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition cursor-pointer ${
                          t.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                        }`}
                        title={t.is_active ? "Click to mute macro" : "Click to activate macro"}
                      >
                        {t.is_active ? "● Active" : "○ Muted"}
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    /* Inline Editing Mode */
                    <div className="space-y-3 my-3 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                          Title
                        </label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-indigo-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                            Command
                          </label>
                          <input
                            type="text"
                            value={editCommand}
                            onChange={(e) => setEditCommand(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                            Category
                          </label>
                          <input
                            type="text"
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-indigo-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                          Personal Message Content
                        </label>
                        <textarea
                          rows={3}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-indigo-500 leading-relaxed"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingTemplateId(null)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSavingEdit}
                          onClick={() => handleSaveEditedTemplate(t.id)}
                          className="px-3.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition shadow-2xs"
                        >
                          {isSavingEdit ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <>
                      <h3 className="font-bold text-slate-900 text-sm">{t.title}</h3>
                      <div className="mt-2.5 rounded-xl bg-slate-50/80 p-3 border border-slate-100 text-xs text-slate-700 leading-relaxed font-sans select-text">
                        "{t.content}"
                      </div>
                    </>
                  )}
                </div>

                {/* Card Bottom Actions */}
                {!isEditing && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyText(t)}
                        className="text-slate-600 hover:text-indigo-600 font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                        title="Copy message content to clipboard"
                      >
                        <span>{copiedId === t.id ? "✅" : "📋"}</span>
                        <span>{copiedId === t.id ? "Copied!" : "Copy"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSimulatorInput(t.content);
                          setSimulatorMatched(`${t.title} (${t.command})`);
                        }}
                        className="text-slate-600 hover:text-indigo-600 font-semibold inline-flex items-center gap-1 transition cursor-pointer ml-1"
                        title="Test in interactive simulator below"
                      >
                        <span>🧪</span>
                        <span>Test</span>
                      </button>
                    </div>

                    {canEditTemplates && (
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => startEditingTemplate(t)}
                          className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 transition cursor-pointer hover:underline"
                          title="Edit this predefined message for your own personal use"
                        >
                          <span>✏️</span>
                          <span>Edit</span>
                        </button>

                        {t.is_predefined === 0 && (
                          <>
                            <span className="text-slate-200">|</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(t)}
                              className="text-rose-600 hover:text-rose-800 font-semibold transition cursor-pointer hover:underline"
                              title="Delete custom template"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SECTION 6: Interactive Live Macro Tester / Playground */}
      <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/40 via-white to-violet-50/40 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧪</span>
            <div>
              <b className="text-xs font-bold text-slate-900 block">Interactive Macro Playground</b>
              <span className="text-[11px] text-slate-500">
                Test your slash shortcuts below. Type a command (e.g. <code className="font-mono text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded">/greeting </code>) or click any chip to see it auto-expand.
              </span>
            </div>
          </div>
          {simulatorMatched && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full animate-pulse self-start sm:self-auto">
              ✨ Auto-expanded: {simulatorMatched}
            </span>
          )}
        </div>

        {/* Quick command clickable chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Fill:</span>
          {templates
            .filter((t) => t.is_active)
            .slice(0, 7)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSimulatorInput(t.content);
                  setSimulatorMatched(`${t.title} (${t.command})`);
                }}
                className="font-mono text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg shadow-2xs transition cursor-pointer"
                title={t.title}
              >
                {t.command}
              </button>
            ))}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Type /command and press space (e.g. /greeting , /booking , /fees )..."
            value={simulatorInput}
            onChange={(e) => handleSimulatorTyping(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-indigo-500 shadow-2xs leading-relaxed"
          />
          {simulatorInput && (
            <button
              type="button"
              onClick={() => {
                setSimulatorInput("");
                setSimulatorMatched(null);
              }}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
