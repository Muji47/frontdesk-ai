"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    businessName: "",
    industry: "clinic",
    fullName: "",
    email: "",
    password: "",
  });

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          industry: form.industry,
          name: form.fullName,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setStep(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[85vh] items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">F</span>
            FrontDesk AI
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Start Your 14-Day Free Trial</h1>
          <p className="mt-1 text-xs text-slate-500">
            No credit card required. Connect your website in 3 simple steps.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${step >= 1 ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>1</span>
          <span className="h-0.5 w-8 bg-slate-200"></span>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${step >= 2 ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>2</span>
          <span className="h-0.5 w-8 bg-slate-200"></span>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${step >= 3 ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>3</span>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="mt-6 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clinic or Business Name *</label>
              <input
                required
                type="text"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                placeholder="e.g. Healing Hands Physiotherapy"
                className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Industry</label>
              <select
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900 bg-white"
              >
                <option value="clinic">Physiotherapy / Medical Clinic (Cliniko)</option>
                <option value="ecommerce">E-Commerce & Retail (Shopify)</option>
                <option value="realestate">Real Estate & Property Management</option>
                <option value="beauty">Salon & Wellness Studio</option>
                <option value="other">General Service Business</option>
              </select>
            </div>
            <button
              onClick={() => {
                if (!form.businessName.trim()) {
                  setError("Please enter your business or clinic name");
                  return;
                }
                setError("");
                setStep(2);
              }}
              className="mt-4 w-full rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-md hover:bg-indigo-700 transition"
            >
              Continue to Step 2 →
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleRegister} className="mt-6 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Your Full Name *</label>
              <input
                required
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Dr. Sarah Jenkins"
                className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Business Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="sarah@healinghands.com.au"
                className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Create Password *</label>
              <input
                required
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {loading ? "Creating Account..." : "Create Account & Go to Dashboard →"}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="mt-6 text-center text-xs space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
              <span className="text-2xl block mb-1">🎉</span>
              <h3 className="font-bold text-sm">Account Activated!</h3>
              <p className="mt-1 text-emerald-700">
                Welcome, <b>{form.fullName}</b>! Your workspace for <b>{form.businessName}</b> is ready.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left space-y-2">
              <span className="font-bold text-slate-800 block">Workspace Configured:</span>
              <p className="text-slate-600">
                Industry: <b>{form.industry === "ecommerce" ? "E-Commerce" : "Physiotherapy / Clinic"}</b><br/>
                Plan: <b>Growth (14-Day Free Trial)</b>
              </p>
            </div>

            <button
              onClick={() => {
                router.push("/dashboard");
                router.refresh();
              }}
              className="block w-full rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-md hover:bg-indigo-700 transition"
            >
              Enter FrontDesk AI Dashboard →
            </button>
          </div>
        )}

        <div className="mt-6 text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-indigo-600 hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
