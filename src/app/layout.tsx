import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/SiteShell";
import { GlobalWidgetLauncher } from "@/components/GlobalWidgetLauncher";

export const metadata: Metadata = {
  title: "Echo.ai — Autonomous AI Front Desk & High-Touch Reception",
  description: "Echo.ai answers customer inquiries, schedules clinic appointments, tracks e-commerce orders, and smoothly hands over to human staff — 24/7 with zero hallucinations.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/icon.svg",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <GlobalWidgetLauncher />
      </body>
    </html>
  );
}
