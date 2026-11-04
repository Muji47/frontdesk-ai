import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/SiteShell";
import { securityPoints, securityDocs } from "@/content/site";

export const metadata: Metadata = {
  title: "Security & Privacy — Echo.ai",
  description: "How Echo.ai protects customer and patient data: tenant isolation, Australian Privacy Act guidance, data minimization, and encryption.",
};

export default function SecurityPage() {
  return (
    <div className="bg-slate-50">
      <PageHero
        eyebrow="Trust, Privacy & Governance"
        title="Engineered for healthcare and privacy-conscious businesses."
        sub="We treat privacy and security as non-negotiable core architecture. Here is how your clinic and customer data is protected."
      />

      {/* Main Pillars Grid */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {securityPoints.map(([icon, title, desc]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-xl">
                {icon}
              </span>
              <h3 className="mt-4 text-sm font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Australia Privacy Act & OAIC Alignment Box */}
        <div className="mt-12 rounded-3xl border border-indigo-200 bg-indigo-900 p-8 text-white shadow-xl">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-indigo-500/30 px-3 py-1 text-xs font-bold text-indigo-200">
              Regulatory Context · Australia
            </span>
            <h2 className="mt-3 text-2xl font-bold">Privacy Act & Health Information Standards</h2>
            <p className="mt-3 text-xs leading-relaxed text-indigo-100">
              The Australian Privacy Act covers health service providers, and health information receives strict privacy protection. Echo.ai is architected following OAIC guidance on AI transparency, vendor due diligence, and human oversight. The AI operates as an administrative receptionist—it explicitly refuses clinical diagnoses and gathers only the minimum contact details required to confirm bookings.
            </p>
          </div>
        </div>

        {/* Required Compliance & Legal Documents */}
        <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Legal & Governance Documentation</h2>
          <p className="mt-1 text-xs text-slate-500">Every business customer has access to our compliance documentation upon onboarding.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {securityDocs.map(([doc, status]) => (
              <div key={doc} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs">
                <span className="font-semibold text-slate-800">{doc}</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">{status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
