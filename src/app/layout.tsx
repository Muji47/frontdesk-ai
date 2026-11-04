import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Echo.ai — Autonomous AI Front Desk & High-Touch Reception",
  description: "Echo.ai answers customer inquiries, schedules clinic appointments, tracks e-commerce orders, and smoothly hands over to human staff — 24/7 with zero hallucinations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
