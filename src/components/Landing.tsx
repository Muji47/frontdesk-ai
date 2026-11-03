"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { industries, industryList, type Industry } from "@/content/industries";
import { DemoWidget } from "./DemoWidget";

const STORAGE_KEY = "frontdesk.industry";

export function Landing({ initial, switchable }: { initial: string; switchable: boolean }) {
  const [slug, setSlug] = useState(initial);
  const cfg: Industry = industries[slug] ?? industries.general;

  // On the home page, restore the visitor's last pick or honour ?industry=
  useEffect(() => {
    if (!switchable) return;
    const q = new URLSearchParams(window.location.search).get("industry");
    const saved = q ?? localStorage.getItem(STORAGE_KEY);
    if (saved && industries[saved]) setSlug(saved);
  }, [switchable]);

  function pick(s: string) {
    setSlug(s);
    if (switchable) {
      localStorage.setItem(STORAGE_KEY, s);
      const url = s === "general" ? "/" : `/?industry=${s}`;
      window.history.replaceState(null, "", url);
    }
  }

  return (
    <div style={{ ["--accent" as string]: cfg.accent }} className="transition-colors">
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-2">
        <div>
          <span className="accent-soft accent-text inline-block rounded-full px-3 py-1 text-xs font-semibold">{cfg.badge}</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">{cfg.headline}</h1>
          <p className="mt-4 text-lg text-slate-600">{cfg.sub}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#pricing" className="accent-bg rounded-xl px-5 py-3 font-semibold text-white shadow-sm hover:opacity-90">{cfg.cta}</a>
            <a href="#demo" className="rounded-xl border border-slate-300 px-5 py-3 font-semibold hover:border-[var(--accent)]">Try the live demo ↓</a>
          </div>

          {switchable && (
            <div className="mt-8">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">See it for your business</div>
              <div className="flex flex-wrap gap-2">
                {industryList.map((i) => (
                  <button
                    key={i.slug}
                    onClick={() => pick(i.slug)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      slug === i.slug ? "accent-bg border-transparent text-white" : "border-slate-300 hover:border-[var(--accent)]"
                    }`}
                  >
                    {i.emoji} {i.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div id="demo" className="flex scroll-mt-24 justify-center">
          <DemoWidget key={cfg.slug} cfg={cfg} />
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-5 pb-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {cfg.stats.map(([v, l]) => (
            <div key={l} className="rounded-2xl border border-slate-200 p-5 text-center">
              <div className="accent-text text-2xl font-extrabold md:text-3xl">{v}</div>
              <div className="mt-1 text-sm text-slate-500">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <Cards id="problem" title="Sound familiar?" items={cfg.pains} />
      <Cards id="features" title="What your assistant does" items={cfg.features} tint />

      {/* Steps */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-14">
        <h2 className="text-center text-3xl font-bold">Live in three steps</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {cfg.steps.map(([t, d], i) => (
            <div key={t} className="rounded-2xl border border-slate-200 p-6">
              <div className="accent-bg flex h-8 w-8 items-center justify-center rounded-full font-bold text-white">{i + 1}</div>
              <div className="mt-3 font-semibold">{t}</div>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
        <pre className="mt-6 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
{`<script src="https://cdn.frontdesk.ai/widget.js" data-agent-id="AGENT_ID" async></script>`}
        </pre>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">Works with:</span>
          {cfg.integrations.map((x) => (
            <span key={x} className="rounded-full border border-slate-200 px-3 py-1">{x}</span>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 bg-slate-50 py-14">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center text-3xl font-bold">Simple monthly pricing</h2>
          <p className="mt-2 text-center text-sm text-slate-500">Starting prices — subject to change before launch</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {cfg.plans.map((p) => (
              <div key={p.name} className={`rounded-2xl border bg-white p-6 ${p.highlight ? "accent-ring ring-2" : "border-slate-200"}`}>
                {p.highlight && <span className="accent-soft accent-text mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold">Most popular</span>}
                <div className="text-lg font-semibold">{p.name}</div>
                <div className="mt-1 text-4xl font-extrabold">
                  {cfg.currency}{p.price}<span className="text-sm font-normal text-slate-500">/mo</span>
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  {p.features.map((f) => (<li key={f}>✓ {f}</li>))}
                </ul>
                <button className={`mt-5 w-full rounded-xl py-2.5 font-semibold ${p.highlight ? "accent-bg text-white" : "border border-slate-300"}`}>{cfg.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-14">
        <h2 className="mb-6 text-center text-3xl font-bold">Questions</h2>
        {cfg.faq.map(([q, a]) => (
          <details key={q} className="mb-2 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">{q}</summary>
            <p className="mt-2 text-sm text-slate-600">{a}</p>
          </details>
        ))}
      </section>

      {/* CTA */}
      <section className="accent-bg py-14 text-center text-white">
        <h2 className="text-3xl font-bold">Ready to put your front desk on autopilot?</h2>
        <p className="mt-2 opacity-90">Start your free trial. Set up in under 30 minutes.</p>
        <a href="#pricing" className="mt-5 inline-block rounded-xl bg-white px-6 py-3 font-bold" style={{ color: "var(--accent)" }}>{cfg.cta}</a>
      </section>
    </div>
  );
}

function Cards({ id, title, items, tint }: { id: string; title: string; items: Industry["pains"]; tint?: boolean }) {
  return (
    <section id={id} className={`scroll-mt-20 py-14 ${tint ? "bg-slate-50" : ""}`}>
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-center text-3xl font-bold">{title}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map(([icon, t, d]) => (
            <div key={t} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="accent-soft flex h-10 w-10 items-center justify-center rounded-xl text-lg">{icon}</div>
              <div className="mt-3 font-semibold">{t}</div>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
