"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { footerCols, nav } from "@/content/site";
import { EchoLogo } from "@/components/EchoLogo";

export function SiteHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; orgName: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const u = d.data?.user || (d.authenticated && d.user);
        if (u) {
          setUser(u);
        }
      })
      .catch(() => {});
  }, [pathname]);

  if (pathname?.startsWith("/dashboard")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold group">
          <EchoLogo size={30} showWordmark={true} />
        </Link>
        <nav className="hidden gap-5 text-sm text-slate-600 lg:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-slate-900">{n.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          {user ? (
            <Link href="/dashboard" className="accent-bg rounded-lg px-3.5 py-1.5 font-semibold text-white shadow-sm flex items-center gap-2">
              <span>Open Dashboard</span>
              <span className="text-xs opacity-80 font-normal">({user.orgName})</span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-lg border border-slate-300 px-3 py-1.5 font-semibold sm:block hover:border-slate-400">
                Log in
              </Link>
              <Link href="/signup" className="accent-bg rounded-lg px-3 py-1.5 font-semibold text-white shadow-sm hover:opacity-95">
                Start free trial
              </Link>
            </>
          )}
        </div>
      </div>
      <nav className="flex gap-4 overflow-x-auto border-t border-slate-100 px-5 py-2 text-sm text-slate-600 lg:hidden">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap">{n.label}</Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/dashboard")) {
    return null;
  }

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-2 md:grid-cols-5">
        <div className="md:col-span-1">
          <Link href="/" className="inline-block">
            <EchoLogo size={28} showWordmark={true} />
          </Link>
          <p className="mt-3 text-sm text-slate-500">Autonomous AI reception and front-office intelligence for clinics, commerce, and enterprise.</p>
        </div>
        {footerCols.map((c) => (
          <div key={c.title}>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{c.title}</div>
            <ul className="space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.href + l.label}><Link href={l.href} className="text-slate-600 hover:text-slate-900">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © Echo.ai · Autonomous Front-Office Intelligence · All rights reserved.
      </div>
    </footer>
  );
}

export function PageHero({ eyebrow, title, sub, children }: { eyebrow?: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-4xl px-5 pb-6 pt-14 text-center">
      {eyebrow && <span className="accent-soft accent-text inline-block rounded-full px-3 py-1 text-xs font-semibold">{eyebrow}</span>}
      <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
      {sub && <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{sub}</p>}
      {children}
    </section>
  );
}

export function CtaBand({ title = "Ready to put your front desk on autopilot?", sub = "Start your free trial. Set up in under 30 minutes." }: { title?: string; sub?: string }) {
  return (
    <section className="accent-bg mt-14 py-14 text-center text-white">
      <h2 className="text-3xl font-bold">{title}</h2>
      <p className="mt-2 opacity-90">{sub}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href="/signup" className="rounded-xl bg-white px-6 py-3 font-bold" style={{ color: "var(--accent)" }}>Start free trial</Link>
        <Link href="/demo" className="rounded-xl border border-white/60 px-6 py-3 font-semibold">Try the live demo</Link>
      </div>
    </section>
  );
}
