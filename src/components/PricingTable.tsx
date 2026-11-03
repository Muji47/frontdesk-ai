"use client";

import { useState } from "react";
import Link from "next/link";
import { plans, compareTable, addons, pricingFaq } from "@/content/site";

export function PricingTable() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="space-y-14">
      {/* Billing Cycle Toggle */}
      <div className="flex justify-center">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              !annual ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Monthly billing
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              annual ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Annual billing</span>
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const finalPrice = annual ? Math.round(p.monthly * 0.8) : p.monthly;
          return (
            <div
              key={p.id}
              className={`flex flex-col justify-between rounded-3xl border bg-white p-7 shadow-sm transition hover:shadow-lg ${
                p.highlight ? "border-indigo-600 ring-2 ring-indigo-600/30" : "border-slate-200"
              }`}
            >
              <div>
                {p.highlight && (
                  <span className="mb-3 inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-600">
                    Most Popular Choice
                  </span>
                )}
                <h3 className="text-xl font-bold text-slate-900">{p.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{p.blurb}</p>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-900">${finalPrice}</span>
                  <span className="text-sm font-medium text-slate-500">/ month</span>
                </div>
                {annual && (
                  <div className="text-[11px] font-medium text-emerald-600">Billed annually (${finalPrice * 12}/yr)</div>
                )}

                <ul className="mt-6 space-y-2.5 text-xs text-slate-600">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  href="/signup"
                  className={`block w-full rounded-xl py-3 text-center text-xs font-bold shadow-sm transition ${
                    p.highlight
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "border border-slate-300 text-slate-700 hover:border-indigo-600 hover:text-indigo-600"
                  }`}
                >
                  Start 14-Day Free Trial
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Feature Comparison Table */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h3 className="text-lg font-bold text-slate-900">Full Plan Feature Comparison</h3>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="pb-3 font-semibold">Features</th>
                <th className="pb-3 font-semibold">Starter</th>
                <th className="pb-3 font-semibold text-indigo-600">Growth</th>
                <th className="pb-3 font-semibold">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {compareTable.map((row) => (
                <tr key={row.feature} className="hover:bg-slate-50/60">
                  <td className="py-3 font-medium text-slate-700">{row.feature}</td>
                  <td className="py-3 text-slate-600">{row.starter}</td>
                  <td className="py-3 font-bold text-indigo-600">{row.growth}</td>
                  <td className="py-3 text-slate-600">{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Addons Grid */}
      <div>
        <h3 className="text-center text-xl font-bold text-slate-900">Optional Add-ons & Scalability</h3>
        <p className="mt-1 text-center text-xs text-slate-500">Only pay for what you actually use as your practice grows.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {addons.map(([name, desc]) => (
            <div key={name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-bold text-sm text-slate-900">{name}</div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-auto max-w-3xl">
        <h3 className="text-center text-xl font-bold text-slate-900">Pricing FAQs</h3>
        <div className="mt-6 space-y-2">
          {pricingFaq.map(([q, a]) => (
            <details key={q} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-xs font-bold text-slate-800">{q}</summary>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
