"use client";

import { useState } from "react";
import { tourTabs } from "@/content/site";

export function TourTabs() {
  const [activeTab, setActiveTab] = useState(tourTabs[0].id);
  const current = tourTabs.find((t) => t.id === activeTab) || tourTabs[0];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl md:p-10">
      {/* Tab Selectors */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-100 pb-4">
        {tourTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-8 grid items-center gap-8 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-600">
            {current.label} Architecture
          </span>
          <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            {current.title}
          </h3>
          <p className="mt-3 text-base text-slate-600 leading-relaxed">
            {current.body}
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
            {current.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-600">
                  ✓
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mock Graphic Box */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-inner lg:col-span-6">
          <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono">simulated_flow.ai</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600">Live test</span>
          </div>

          <div className="space-y-3">
            {current.mock.map((m, idx) => (
              <div key={idx}>
                {m.who === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 p-3 text-xs font-medium text-white shadow-sm">
                      {m.text}
                    </div>
                  </div>
                ) : m.who === "bot" ? (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-sm">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-indigo-100 bg-white p-3 text-xs shadow-sm">
                    <div className="font-semibold text-indigo-900">⚡ Automated System Action</div>
                    <div className="mt-1 text-slate-600">{m.text}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
