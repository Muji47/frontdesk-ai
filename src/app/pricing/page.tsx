import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/SiteShell";
import { PricingTable } from "@/components/PricingTable";
import { RoiCalculator } from "@/components/RoiCalculator";

export const metadata: Metadata = {
  title: "Pricing & Plans — Echo.ai",
  description: "Transparent, predictable monthly pricing for businesses. Unlimited FAQ answers, live appointment booking, and human handover.",
};

export default function PricingPage() {
  return (
    <div className="bg-slate-50">
      <PageHero
        eyebrow="Predictable SaaS Pricing"
        title="Simple plans that pay for themselves in 2 appointments."
        sub="No hidden setup surprises. Start with a 14-day free trial on your website."
      />

      <section className="mx-auto max-w-6xl px-5 py-8">
        <PricingTable />
      </section>

      {/* Embedded ROI Calculator */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">Estimate Your Return on Investment</h2>
        <RoiCalculator />
      </section>

      <CtaBand />
    </div>
  );
}
