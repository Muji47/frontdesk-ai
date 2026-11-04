"use client";

import { useState } from "react";
import { PageHero } from "@/components/SiteShell";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    business: "",
    industry: "clinic",
    website: "",
    notes: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
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
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Your Full Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Dr. Sarah Jenkins"
                    className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Work Email *</label>
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="sarah@healinghands.com.au"
                      className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900"
                    />
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

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">How can we help?</label>
                  <textarea
                    rows={4}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Tell us about your current booking software or main challenges..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-indigo-600 py-3 text-center text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
                >
                  Send Inquiry / Book Consultation →
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
