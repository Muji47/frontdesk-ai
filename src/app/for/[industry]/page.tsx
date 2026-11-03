import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Landing } from "@/components/Landing";
import { industries, industryList } from "@/content/industries";

export function generateStaticParams() {
  return industryList.filter((i) => i.slug !== "general").map((i) => ({ industry: i.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ industry: string }> }): Promise<Metadata> {
  const { industry } = await params;
  const cfg = industries[industry];
  if (!cfg) return {};
  return { title: `FrontDesk AI for ${cfg.label}`, description: cfg.sub };
}

export default async function IndustryPage({ params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params;
  if (!industries[industry] || industry === "general") notFound();
  return <Landing initial={industry} switchable={false} />;
}
