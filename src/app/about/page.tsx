import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/SiteShell";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us — Echo.ai",
  description: "Our mission: empower independent service practices and growing businesses with enterprise-grade autonomous front-desk technology.",
};

export default function AboutPage() {
  return (
    <div className="bg-slate-50">
      <PageHero
        eyebrow="Our Mission & Philosophy"
        title="We build technology that helps human teams thrive."
        sub="Echo.ai was created to solve a universal headache: busy front-desk staff overwhelmed by repetitive inquiries, while high-intent prospective customers leave without getting answers."
      />

      <section className="mx-auto max-w-4xl px-5 py-12 space-y-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-4 text-sm text-slate-700 leading-relaxed">
          <h2 className="text-xl font-bold text-slate-900">The Problem We Saw</h2>
          <p>
            Consider a busy physiotherapy clinic, veterinary practice, or independent retail store. The reception team is juggling ringing phones, patient arrivals, insurance questions, cancellations, and paperwork.
          </p>
          <p>
            At 10:45 PM, a customer visits the website wanting to book an appointment or check if a specific rehabilitation treatment is offered. No one is available to reply. The visitor leaves and books with a competitor down the street.
          </p>
          <p className="font-semibold text-indigo-900">
            We aren&apos;t building a bot to replace your staff. We&apos;re building a digital receptionist that shields your team from repetitive administrative burden and ensures you never lose a patient or customer after hours.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3 text-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-3xl font-extrabold text-indigo-600">24/7</div>
            <div className="mt-1 text-xs text-slate-500 font-medium">Autonomous availability</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-3xl font-extrabold text-indigo-600">0</div>
            <div className="mt-1 text-xs text-slate-500 font-medium">Extra administrative load</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-3xl font-extrabold text-indigo-600">100%</div>
            <div className="mt-1 text-xs text-slate-500 font-medium">Verified backend actions</div>
          </div>
        </div>

        <div className="rounded-3xl border border-indigo-200 bg-indigo-50/50 p-8 text-center">
          <h3 className="text-lg font-bold text-indigo-950">Join Our Founding Clinic Program</h3>
          <p className="mt-2 text-xs text-indigo-800 max-w-xl mx-auto leading-relaxed">
            We are actively partnering with select allied health practices and businesses in Australia. Founding partners receive complimentary white-glove setup and locked-in preferential pricing.
          </p>
          <div className="mt-5">
            <Link href="/contact" className="inline-block rounded-xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700">
              Apply For Founding Partner Program →
            </Link>
          </div>
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
