"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ApiErrorResponse {
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [form, setForm] = useState({
    businessName: "",
    industry: "clinic",
    fullName: "",
    email: "",
    password: "",
  });

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError("");
    setFieldErrors({});
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

      const data: ApiErrorResponse = await res.json();
      if (!res.ok || !data.success) {
        if (data.error?.details) {
          setFieldErrors(data.error.details);
          // If the error is on businessName, step back to step 1
          if (data.error.details.businessName || data.error.details.industry) {
            setStep(1);
          }
        }
        setGeneralError(data.error?.message || "Registration failed. Please review your details.");
        return;
      }

      setStep(3);
    } catch {
      setGeneralError("Network error. Unable to reach the registration server.");
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
            No credit card required. Set up your autonomous receptionist in minutes.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full transition ${step >= 1 ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>1</span>
          <span className="h-0.5 w-8 bg-slate-200"></span>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full transition ${step >= 2 ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>2</span>
          <span className="h-0.5 w-8 bg-slate-200"></span>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full transition ${step >= 3 ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>3</span>
        </div>

        {generalError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <span className="text-sm font-bold">⚠️</span>
            <span>{generalError}</span>
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
                onChange={(e) => {
                  setForm({ ...form, businessName: e.target.value });
                  if (fieldErrors.businessName) setFieldErrors({ ...fieldErrors, businessName: [] });
                }}
                placeholder="e.g. Healing Hands Physiotherapy"
                className={`w-full rounded-xl border p-2.5 outline-none transition text-slate-900 ${
                  fieldErrors.businessName?.length ? "border-red-500 bg-red-50/20" : "border-slate-200 focus:border-indigo-600"
                }`}
              />
              {fieldErrors.businessName?.map((err, i) => (
                <span key={i} className="mt-1 block text-[11px] text-red-600 font-medium">
                  {err}
                </span>
              ))}
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
              type="button"
              onClick={() => {
                if (form.businessName.trim().length < 2) {
                  setFieldErrors({ businessName: ["Business name must be at least 2 characters"] });
                  return;
                }
                setGeneralError("");
                setFieldErrors({});
                setStep(2);
              }}
              className="mt-4 w-full rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-md hover:bg-indigo-700 transition"
            >
              Continue to Account Setup →
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
                onChange={(e) => {
                  setForm({ ...form, fullName: e.target.value });
                  if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: [] });
                }}
                placeholder="Dr. Sarah Jenkins"
                className={`w-full rounded-xl border p-2.5 outline-none transition text-slate-900 ${
                  fieldErrors.name?.length ? "border-red-500 bg-red-50/20" : "border-slate-200 focus:border-indigo-600"
                }`}
              />
              {fieldErrors.name?.map((err, i) => (
                <span key={i} className="mt-1 block text-[11px] text-red-600 font-medium">
                  {err}
                </span>
              ))}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Business Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: [] });
                }}
                placeholder="sarah@healinghands.com.au"
                className={`w-full rounded-xl border p-2.5 outline-none transition text-slate-900 ${
                  fieldErrors.email?.length ? "border-red-500 bg-red-50/20" : "border-slate-200 focus:border-indigo-600"
                }`}
              />
              {fieldErrors.email?.map((err, i) => (
                <span key={i} className="mt-1 block text-[11px] text-red-600 font-medium">
                  {err}
                </span>
              ))}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Create Password (min. 8 characters) *</label>
              <input
                required
                type="password"
                value={form.password}
                onChange={(e) => {
                  setForm({ ...form, password: e.target.value });
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: [] });
                }}
                placeholder="••••••••••••"
                className={`w-full rounded-xl border p-2.5 outline-none transition text-slate-900 ${
                  fieldErrors.password?.length ? "border-red-500 bg-red-50/20" : "border-slate-200 focus:border-indigo-600"
                }`}
              />
              {fieldErrors.password?.map((err, i) => (
                <span key={i} className="mt-1 block text-[11px] text-red-600 font-medium">
                  {err}
                </span>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50 transition"
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
                Welcome, <b>{form.fullName}</b>! Your workspace for <b>{form.businessName}</b> has been provisioned.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left space-y-2">
              <span className="font-bold text-slate-800 block">Workspace Configured:</span>
              <p className="text-slate-600">
                Organization: <b>{form.businessName}</b><br/>
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
