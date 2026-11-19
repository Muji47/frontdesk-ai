"use client";

import { useState } from "react";
import { PageHero } from "@/components/SiteShell";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactErrors, setContactErrors] = useState<{ name?: string; email?: string; notes?: string; general?: string }>({});
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    business: "",
    industry: "clinic",
    website: "",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: { name?: string; email?: string; notes?: string; general?: string } = {};
    if (!formData.name.trim()) {
      errors.name = "Your full name is required.";
    }
    if (!formData.email.trim()) {
      errors.email = "Work email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address (e.g. name@company.com).";
    }
    if (!formData.notes.trim()) {
      errors.notes = "Please describe what your practice or business is looking for.";
    }

    if (Object.keys(errors).length > 0) {
      setContactErrors(errors);
      return;
    }

    setContactErrors({});
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to submit inquiry. Please try again.");
      }

      setSubmitted(true);
    } catch (err: any) {
      setContactErrors({ general: err.message || "Failed to submit your inquiry. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-slate-50">
      <PageHero
        eyebrow="Get In Touch"
        title="Let's talk about your front desk."
        sub="Have a question about integrations, custom practice software, or our founding clinic program? Our team typically responds within a few hours."
      />

      <section className="mx-auto max-w-4xl px-5 py-12">
        <div className="grid gap-8 md:grid-cols-12">
          {/* Form Column */}
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:col-span-7">
            {submitted ? (
              <div className="py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600 mx-auto">
                  ✓
                </span>
                <h3 className="mt-4 text-xl font-bold text-slate-900">Inquiry Received</h3>
                <p className="mt-2 text-xs text-slate-600 max-w-sm mx-auto">
                  Thank you! We&apos;ve logged your details. A member of our product team will review your clinic or store and email you with a personalized walkthrough.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-6 rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-600"
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Your Full Name <span className="text-rose-500">*</span></label>
                    {contactErrors.name && (
                      <span className="text-[10px] font-bold text-rose-500">Required</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (contactErrors.name) setContactErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder="e.g. Dr. Sarah Jenkins"
                    className={`w-full rounded-xl border p-2.5 outline-none transition text-slate-900 ${
                      contactErrors.name
                        ? "border-rose-400 bg-rose-50/20 ring-1 ring-rose-400 focus:border-rose-500"
                        : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    }`}
                  />
                  {contactErrors.name && (
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium animate-in fade-in">
                      <span>⚠️</span> {contactErrors.name}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-700">Work Email <span className="text-rose-500">*</span></label>
                      {contactErrors.email && (
                        <span className="text-[10px] font-bold text-rose-500">Required</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (contactErrors.email) setContactErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      placeholder="sarah@healinghands.com.au"
                      className={`w-full rounded-xl border p-2.5 outline-none transition text-slate-900 ${
                        contactErrors.email
                          ? "border-rose-400 bg-rose-50/20 ring-1 ring-rose-400 focus:border-rose-500"
                          : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                      }`}
                    />
                    {contactErrors.email && (
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium animate-in fade-in">
                        <span>⚠️</span> {contactErrors.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Clinic / Business Name</label>
                    <input
                      type="text"
                      value={formData.business}
                      onChange={(e) => setFormData({ ...formData, business: e.target.value })}
                      placeholder="Healing Hands Physio"
                      className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Industry</label>
                    <select
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900 bg-white"
                    >
                      <option value="clinic">Physiotherapy / Medical Clinic</option>
                      <option value="ecommerce">E-Commerce & Retail</option>
                      <option value="realestate">Real Estate Agency</option>
                      <option value="beauty">Salon & Wellness Studio</option>
                      <option value="other">Other Service Business</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Website URL</label>
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://yourclinic.com.au"
                      className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900"
                    />
                  </div>
                </div>

                {contactErrors.general && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{contactErrors.general}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      How can we help? <span className="text-rose-500">*</span>
                    </label>
                    {contactErrors.notes && (
                      <span className="text-[10px] font-bold text-rose-500">Required</span>
                    )}
                  </div>
                  <textarea
                    rows={4}
                    value={formData.notes}
                    onChange={(e) => {
                      setFormData({ ...formData, notes: e.target.value });
                      if (contactErrors.notes) setContactErrors((prev) => ({ ...prev, notes: undefined }));
                    }}
                    placeholder="Tell us about your current booking software, practice challenges, or questions..."
                    className={`w-full rounded-xl border p-2.5 outline-none transition text-slate-900 ${
                      contactErrors.notes
                        ? "border-rose-400 bg-rose-50/20 ring-1 ring-rose-400 focus:border-rose-500"
                        : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    }`}
                  />
                  {contactErrors.notes && (
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium animate-in fade-in">
                      <span>⚠️</span> {contactErrors.notes}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-indigo-600 py-3 text-center text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Sending Inquiry..." : "Send Inquiry / Book Consultation →"}
                </button>
              </form>
            )}
          </div>

          {/* Details Sidebar */}
          <div className="space-y-6 md:col-span-5 text-xs text-slate-600">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Direct Inquiries</h3>
              <p>For custom partnerships, API access, or enterprise practice networks:</p>
              <div className="space-y-1 font-mono text-[11px] text-indigo-600">
                <div>hello@echo.ai</div>
                <div>support@echo.ai</div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-2">
              <h3 className="font-bold text-sm text-slate-900">Office Hours & Coverage</h3>
              <p>Sales & support teams operate across Australian Eastern Standard Time (AEST) and PKT business hours.</p>
              <p className="text-slate-400">Website chat assistants run autonomously 24/7/365.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
