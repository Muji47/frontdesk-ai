import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/SiteShell";
import { RoiCalculator } from "@/components/RoiCalculator";

export const metadata: Metadata = {
  title: "ROI Calculator — FrontDesk AI",
  description: "Calculate how much missed revenue and reception administrative hours FrontDesk AI can recover for your business.",
};

export default function RoiPage() {
  return (
    <div className="bg-slate-50">
      <PageHero
        eyebrow="Financial Impact"
        title="Stop losing after-hours bookings to competitors."
        sub="Over 35% of high-intent website visitors browse outside standard 9-5 clinic and business hours. See how much value an autonomous receptionist recovers."
      />

      <section className="mx-auto max-w-6xl px-5 py-10">
        <RoiCalculator />
      </section>

      <CtaBand />
    </div>
  );
}
