import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/SiteShell";
import { featureGroups } from "@/content/site";
import { TourTabs } from "@/components/TourTabs";

export const metadata: Metadata = {
  title: "Features — Echo.ai",
  description: "Explore the complete feature set of Echo.ai: knowledge ingestion, live booking, order management, human handover, and analytics.",
};

export default function FeaturesPage() {
  return (
    <div className="bg-slate-50">
      <PageHero
        eyebrow="Capabilities & Architecture"
        title="Everything your front desk handles. Automated."
        sub="Echo.ai turns website inquiries into confirmed appointments and satisfied customers without expanding administrative headcount."
      />

      {/* Interactive Tour Section */}
      <section className="mx-auto max-w-6xl px-5 py-8">
        <TourTabs />
      </section>

      {/* Feature Grids */}
      <section className="mx-auto max-w-6xl px-5 py-12 space-y-12">
        {featureGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-3">{group.title}</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {group.items.map(([icon, title, desc]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-xl">
                    {icon}
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">{title}</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <CtaBand />
    </div>
  );
}
