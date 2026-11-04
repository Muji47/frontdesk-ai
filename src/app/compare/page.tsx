import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/SiteShell";
import { compareRows } from "@/content/site";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Compare Solutions — Echo.ai",
  description: "See how Echo.ai compares to basic FAQ chatbots and traditional human receptionists for booking and lead conversion.",
};

export default function ComparePage() {
  return (
    <div className="bg-slate-50">
      <PageHero
        eyebrow="Market Comparison"
        title="We aren't another generic chat widget."
        sub="Basic chatbots only regurgitate text. Human receptionists don't work at midnight. Echo.ai unites autonomous execution with reliable human control."
      />

      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="p-4 font-semibold">Capability</th>
                  <th className="p-4 font-semibold">Basic FAQ Chatbot</th>
                  <th className="p-4 font-semibold">Human Receptionist</th>
                  <th className="p-4 font-bold text-indigo-600 bg-indigo-50/50">Echo.ai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {compareRows.map((row) => (
                  <tr key={row.row} className="hover:bg-slate-50/50">
                    <td className="p-4 font-bold text-slate-900">{row.row}</td>
                    <td className="p-4 text-slate-500">{row.generic}</td>
                    <td className="p-4 text-slate-600">{row.human}</td>
                    <td className="p-4 font-bold text-indigo-700 bg-indigo-50/30">{row.us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900">Why Not a Basic Chatbot?</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Standard AI widgets hallucinate, can&apos;t check live calendar slots, and frustrate visitors. Echo.ai is integrated into your backend practice management software so it takes verified actions.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900">Why Not Staff Only?</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Receptionists handle phone calls, in-person check-ins, and paperwork. Answering repetitive website questions at 11 PM isn&apos;t viable. Echo.ai protects staff from burnout.
            </p>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-6 shadow-sm">
            <h3 className="font-bold text-sm text-indigo-950">The Hybrid Advantage</h3>
            <p className="mt-2 text-xs text-indigo-900 leading-relaxed">
              AI resolves 70%+ of routine inquiries automatically, and seamlessly escalates complex or sensitive questions to your staff dashboard with full context.
            </p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link href="/pricing" className="inline-block rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700">
            View Transparent Pricing Plans →
          </Link>
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
