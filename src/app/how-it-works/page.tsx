import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/SiteShell";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How It Works — Echo.ai",
  description: "Learn how Echo.ai connects to your website, indexes your business knowledge, hooks into your calendar/PMS, and goes live in 3 steps.",
};

const steps = [
  {
    step: "01",
    title: "Ingest Your Business Knowledge",
    desc: "Enter your clinic or business website URL. Our crawler indexes public service pages, clinic hours, practitioner bios, and FAQs. You can also upload PDF price lists, service agreements, and custom business rules.",
    code: "POST /api/knowledge/sync { url: 'https://healinghands.com.au' }",
    details: ["Automatic text extraction and chunking", "Semantic embedding vectorization", "Real-time indexing status & error alerts"],
  },
  {
    step: "02",
    title: "Connect Your Practice Software & Calendar",
    desc: "Hook into your existing systems (like Cliniko or Shopify). The AI receptionist fetches live slot availability, practitioner schedules, and order data directly via encrypted APIs.",
    code: "GET /api/integrations/cliniko/availability?practitioner_id=9812",
    details: ["Two-way availability synchronization", "Zero double-booking guarantee", "Patient record lookup & creation"],
  },
  {
    step: "03",
    title: "Configure Persona & Guardrails",
    desc: "Customize the assistant's name, brand colors, welcome greeting, and tone. Define strict safety guardrails: what to answer, when to transfer to a human, and emergency medical disclaimers.",
    code: "agent_settings: { tone: 'Friendly', emergency_handover: true }",
    details: ["Strict clinical safety rules (no medical diagnosis)", "Automated handover triggers", "Working hours & after-hours rules"],
  },
  {
    step: "04",
    title: "Paste One Script Tag on Your Website",
    desc: "Drop our lightweight, asynchronous embed script right before the closing </body> tag. It runs inside an isolated Shadow DOM container to prevent any CSS clashes with your website.",
    code: '<script src="https://cdn.echo.ai/widget.js" data-agent-id="agt_8f2k1" async></script>',
    details: ["< 25 KB bundle size", "Mobile responsive & fast loading", "Compatible with WordPress, Shopify, Webflow, Wix"],
  },
];

export default function HowItWorksPage() {
  return (
    <div className="bg-slate-50">
      <PageHero
        eyebrow="Implementation & Architecture"
        title="From signup to live website assistant in 30 minutes."
        sub="No complex coding or developer needed. Hook into your existing tools and let AI take care of after-hours administrative inquiries."
      />

      <section className="mx-auto max-w-5xl px-5 py-12 space-y-12">
        {steps.map((s) => (
          <div key={s.step} className="grid items-center gap-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-12 md:p-8">
            <div className="md:col-span-7">
              <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-600">
                STEP {s.step}
              </span>
              <h2 className="mt-3 text-2xl font-bold text-slate-900">{s.title}</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.desc}</p>

              <ul className="mt-4 space-y-2 text-xs text-slate-700">
                {s.details.map((d) => (
                  <li key={d} className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-slate-900 p-4 font-mono text-xs text-indigo-300 md:col-span-5 shadow-inner overflow-x-auto">
              <div className="text-[10px] text-slate-500 pb-2 border-b border-slate-800">system_execution.log</div>
              <div className="mt-2 text-slate-100">{s.code}</div>
            </div>
          </div>
        ))}

        <div className="rounded-3xl border border-indigo-200 bg-indigo-50/50 p-8 text-center">
          <h3 className="text-xl font-bold text-indigo-950">Want us to handle the setup for you?</h3>
          <p className="mt-2 text-sm text-indigo-700">
            We offer white-glove assisted onboarding: we scrape your website, sync your calendar, and test the agent before you launch.
          </p>
          <div className="mt-5">
            <Link href="/contact" className="inline-block rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700">
              Request Assisted Setup ($99)
            </Link>
          </div>
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
