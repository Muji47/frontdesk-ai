import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Healing Hands Physiotherapy & Sports Rehabilitation | Melbourne CBD",
  description:
    "Evidence-based physiotherapy, spinal rehabilitation, and sports injury care in Melbourne CBD. Led by Dr. Sarah Lee with 24/7 AI Receptionist Maya.",
};

export default function HealingHandsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      {/* Clinic Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 text-white flex items-center justify-center font-bold text-xl shadow-sm">
              🌿
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-lg leading-tight block">
                Healing Hands Physio
              </span>
              <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider block">
                Sports & Musculoskeletal Rehab
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>📞</span>
              <span>(03) 9123 4567</span>
            </div>
            <Link
              href="#book"
              className="rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 transition"
            >
              Book Consultation
            </Link>
          </div>
        </div>
      </header>

      {/* Main Clinic Container */}
      <main className="max-w-6xl mx-auto px-5 py-10 space-y-10">
        {/* Verification Pill */}
        <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-3.5 py-1.5 text-xs font-bold text-teal-800">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <span>Melbourne CBD Practice — Clinical Principal Dr. Sarah Lee</span>
        </div>

        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-950 via-slate-900 to-teal-900 p-8 sm:p-12 text-white shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="inline-block text-xs font-extrabold uppercase tracking-widest text-teal-400">
              Evidence-Based Musculoskeletal Care
            </span>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight text-white">
              Targeted Physiotherapy & Rapid Recovery in Melbourne
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Helping athletes, corporate professionals, and spinal care patients recover from acute injuries, chronic neck/back pain, and post-operative orthopedic procedures with custom clinical rehabilitation.
            </p>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <span className="rounded-xl bg-white/10 backdrop-blur-md border border-white/15 px-3.5 py-2 text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>👩‍⚕️</span> Dr. Sarah Lee (B.Phty, M.Musc)
              </span>
              <span className="rounded-xl bg-white/10 backdrop-blur-md border border-white/15 px-3.5 py-2 text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>💳</span> Electronic HICAPS & Private Health
              </span>
              <span className="rounded-xl bg-white/10 backdrop-blur-md border border-white/15 px-3.5 py-2 text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>📍</span> Suite 4, 120 Collins St, Melbourne
              </span>
            </div>
          </div>
        </section>

        {/* Clinical Services Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:shadow-md transition">
            <div className="text-3xl mb-3">🩺</div>
            <h2 className="text-base font-bold text-slate-900">Initial Clinical Assessment</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Thorough 60-minute physical exam, spinal biomechanics testing, injury root-cause analysis, and immediate therapeutic treatment plan.
            </p>
            <div className="mt-4 inline-block rounded-lg bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
              $120 AUD (60 Mins)
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:shadow-md transition">
            <div className="text-3xl mb-3">⚡</div>
            <h2 className="text-base font-bold text-slate-900">Standard Follow-up Care</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Focused 30-minute joint mobilisations, soft tissue myofascial release, dry needling, and progressive clinical exercise loading.
            </p>
            <div className="mt-4 inline-block rounded-lg bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
              $90 AUD (30 Mins)
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:shadow-md transition">
            <div className="text-3xl mb-3">💳</div>
            <h2 className="text-base font-bold text-slate-900">HICAPS & Insurance Rebates</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Instant electronic claiming for Bupa, Medibank, HCF, NIB, and all major funds. GP Medicare EPC / CDM care plans supported.
            </p>
            <div className="mt-4 inline-block rounded-lg bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
              On-The-Spot Electronic Rebates
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:shadow-md transition">
            <div className="text-3xl mb-3">📍</div>
            <h2 className="text-base font-bold text-slate-900">Location & Transport</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Suite 4, Level 1, 120 Collins Street, Melbourne VIC 3000. Convenient tram access via Collins Street Stop 7 (Routes 11, 12, 48, 109).
            </p>
            <div className="mt-4 inline-block rounded-lg bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
              CBD Collins St Tram Stop 7
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:shadow-md transition">
            <div className="text-3xl mb-3">⏰</div>
            <h2 className="text-base font-bold text-slate-900">Operating Hours</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              <strong>Monday – Friday:</strong> 8:00 AM – 6:30 PM<br />
              <strong>Saturday:</strong> 9:00 AM – 1:00 PM<br />
              <strong>Sunday:</strong> Closed
            </p>
            <div className="mt-4 inline-block rounded-lg bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
              Open 6 Days a Week
            </div>
          </div>

          <div className="rounded-2xl border border-teal-300 bg-teal-50/50 p-6 shadow-xs hover:shadow-md transition">
            <div className="text-3xl mb-3">🤖</div>
            <h2 className="text-base font-bold text-slate-900">Live AI Receptionist Maya</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Check out the floating teal chat button in the bottom right corner! Maya is our autonomous clinic assistant answering FAQs and booking patients 24/7.
            </p>
            <div className="mt-4 inline-block rounded-lg bg-teal-600 text-white px-3 py-1 text-xs font-bold">
              Active on this Page ↓
            </div>
          </div>
        </section>

        {/* Embed Integration Specification Box */}
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>⚡</span>
                <span>Echo.ai Autonomous Receptionist Embed Code</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                This website integrates Healing Hands Physio (<code>org_demo_101</code>) using the 1-line script tag below:
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950 p-4 font-mono text-xs text-teal-300 overflow-x-auto select-all border border-slate-800">
            <code>
              {`<script src="https://frontdesk-ai-rho-swart.vercel.app/widget.js" data-org="org_demo_101" data-agent-id="agt_demo_101" async></script>`}
            </code>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        <p>© 2026 Healing Hands Physiotherapy & Sports Rehabilitation. Powered by Frontdesk AI (Echo.ai).</p>
      </footer>

      {/* Live Widget Script Tag */}
      <Script
        src="/widget.js"
        data-org="org_demo_101"
        data-agent-id="agt_demo_101"
        strategy="afterInteractive"
      />
    </div>
  );
}
