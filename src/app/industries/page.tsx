import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, CtaBand } from "@/components/SiteShell";
import { industryList } from "@/content/industries";

export const metadata: Metadata = {
  title: "Supported Industries — FrontDesk AI",
  description: "Explore tailored AI receptionist solutions for healthcare clinics, direct-to-consumer e-commerce, real estate agencies, and beauty salons.",
};

export default function IndustriesHubPage() {
  return (
    <div className="bg-slate-50">
      <PageHero
        eyebrow="Specialized Verticals"
        title="Designed for businesses where missed inquiries mean lost revenue."
        sub="Each industry has unique workflows: clinics need live practitioner bookings, online stores need order tracking, and realtors need lead qualification."
      />

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {industryList
            .filter((i) => i.slug !== "general")
            .map((ind) => (
              <div
                key={ind.slug}
                className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">
                      {ind.emoji}
                    </span>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">{ind.badge}</span>
                      <h2 className="text-xl font-bold text-slate-900">{ind.label}</h2>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-slate-600 leading-relaxed font-medium">{ind.sub}</p>

                  <div className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
                    <div className="font-bold text-slate-800">Primary Features:</div>
                    {ind.features.slice(0, 3).map(([icon, name]) => (
                      <div key={name} className="flex items-center gap-2">
                        <span>{icon}</span>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5 pt-2">
                    {ind.integrations.map((tool) => (
                      <span key={tool} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <Link
                    href={`/for/${ind.slug}`}
                    className="block w-full rounded-xl border border-indigo-600 py-3 text-center text-xs font-bold text-indigo-600 transition hover:bg-indigo-600 hover:text-white"
                  >
                    View {ind.label} Solutions & Demo →
                  </Link>
                </div>
              </div>
            ))}
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
