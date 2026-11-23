"use client";

import { useState } from "react";
import { PageHero, CtaBand } from "@/components/SiteShell";
import { industries, industryList, type Industry } from "@/content/industries";
import { DemoWidget } from "@/components/DemoWidget";

export default function DemoPage() {
  const [selectedIndustry, setSelectedIndustry] = useState<string>("clinic");
  const cfg: Industry = industries[selectedIndustry] || industries.clinic;

  return (
    <div className="bg-slate-50">
      <PageHero
        eyebrow="Interactive Experience"
        title="Experience Echo.ai before you install it."
        sub="Try real customer scenarios: book appointment slots, look up order tracking, ask about pricing, or ask an unknown question to see our safe human handover in action."
      />

      <section className="mx-auto max-w-6xl px-5 py-8">
        {/* Industry Switcher Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {industryList.map((ind) => (
            <button
              key={ind.slug}
              onClick={() => setSelectedIndustry(ind.slug)}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition shadow-sm ${
                selectedIndustry === ind.slug
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-slate-300 text-slate-700 hover:border-indigo-500"
              }`}
            >
              {ind.emoji} {ind.label}
            </button>
          ))}
        </div>

        <div className="grid items-start gap-10 lg:grid-cols-12">
          {/* Explanation & Scenarios Column */}
          <div className="space-y-6 lg:col-span-7">
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Simulating: {cfg.label}</span>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">{cfg.headline}</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{cfg.sub}</p>

              <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Test Scenarios To Try:</div>
                <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
                  {cfg.slug === "ecommerce" ? (
                    <>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">1. Product Recommendations</b>
                        <span className="text-slate-500">Type &quot;Find sneakers under $90&quot; or ask for sizing help.</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">2. Live Order Tracking</b>
                        <span className="text-slate-500">Type &quot;Where is my order #78219?&quot; or check tracking status.</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">3. Shipping & Return Rules</b>
                        <span className="text-slate-500">Type &quot;What is your return policy?&quot; or ask about shipping times.</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">4. Support Team Handover</b>
                        <span className="text-slate-500">Type &quot;Can I speak to someone in customer support?&quot;</span>
                      </div>
                    </>
                  ) : cfg.slug === "realestate" ? (
                    <>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">1. Property Inspection</b>
                        <span className="text-slate-500">Type &quot;Book inspection for 42 Wallaby Way this Saturday&quot;.</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">2. Pet & Lease Policies</b>
                        <span className="text-slate-500">Type &quot;Are pets allowed in the apartment?&quot;</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">3. Pricing & Bond Rules</b>
                        <span className="text-slate-500">Type &quot;How much is the weekly rent and bond?&quot;</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">4. Agent Handover</b>
                        <span className="text-slate-500">Type &quot;Transfer me to the property manager&quot;.</span>
                      </div>
                    </>
                  ) : cfg.slug === "beauty" ? (
                    <>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">1. Chair & Stylist Booking</b>
                        <span className="text-slate-500">Type &quot;Can I book a balayage appointment this Saturday?&quot;</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">2. Service Menu & Pricing</b>
                        <span className="text-slate-500">Type &quot;How much for a cut and style?&quot;</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">3. Consultation Details</b>
                        <span className="text-slate-500">Type &quot;Do you have openings this Friday afternoon?&quot;</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">4. Reception Handover</b>
                        <span className="text-slate-500">Type &quot;Can I speak to my stylist directly?&quot;</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">1. Instant Slot Booking</b>
                        <span className="text-slate-500">Click &quot;Book appointment&quot; or type &quot;Can I book tomorrow at 10 AM?&quot;</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">2. Pricing & Health Rebates</b>
                        <span className="text-slate-500">Type &quot;How much does a session cost and do you do HICAPS?&quot;</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">3. Opening Hours & Location</b>
                        <span className="text-slate-500">Type &quot;Where are you located and what are your opening hours?&quot;</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <b className="block text-slate-800">4. Triage & Staff Handover</b>
                        <span className="text-slate-500">Type &quot;Can I talk to a receptionist?&quot;</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Behind the scenes callout */}
            <div className="rounded-3xl border border-indigo-200 bg-indigo-50/50 p-6 text-xs text-indigo-950">
              <h3 className="font-bold text-sm text-indigo-900 flex items-center gap-1.5">
                <span>🛡️</span> Zero Hallucination Guarantee
              </h3>
              <p className="mt-2 text-indigo-800 leading-relaxed">
                When Echo.ai doesn&apos;t find verified information in your uploaded documents or booking system, it never invents an answer. It informs the customer, logs the query in your dashboard&apos;s <b>Unanswered Questions</b> queue, and escalates to your team.
              </p>
            </div>
          </div>

          {/* Live Widget Preview Column */}
          <div className="flex justify-center lg:col-span-5" style={{ ["--accent" as string]: cfg.accent }}>
            <DemoWidget key={cfg.slug} cfg={cfg} />
          </div>
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
