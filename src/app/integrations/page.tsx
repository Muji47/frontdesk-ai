import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/SiteShell";
import { integrationGroups } from "@/content/site";

export const metadata: Metadata = {
  title: "Integrations — Echo.ai",
  description: "Connect Echo.ai to Cliniko, Shopify, Google Calendar, WooCommerce, and website builders with zero complex coding.",
};

export default function IntegrationsPage() {
  return (
    <div className="bg-slate-50">
      <PageHero
        eyebrow="Ecosystem & Connectivity"
        title="Connects with the software you already use."
        sub="You don't need to replace your booking system or e-commerce store. Echo.ai plugs straight into your tech stack via secure APIs."
      />

      <section className="mx-auto max-w-6xl px-5 py-12 space-y-12">
        {integrationGroups.map((group) => (
          <div key={group.group}>
            <h2 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-3">{group.group}</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {group.items.map((item) => (
                <div key={item.name} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">{item.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.status === "Launch"
                            ? "bg-emerald-50 text-emerald-600"
                            : item.status === "Next"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Encrypted REST API</span>
                    <span>OAuth / Key</span>
                  </div>
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
