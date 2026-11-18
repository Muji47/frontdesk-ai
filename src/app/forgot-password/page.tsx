"use client";

import { useState } from "react";
import Link from "next/link";
import { EchoLogo } from "@/components/EchoLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEmailError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Account email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid email address (e.g. name@company.com).");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || data.error || "Unable to send password reset email.");
        return;
      }

      setSubmitted(true);
      if (data.devUrl) {
        setDevUrl(data.devUrl);
      }
    } catch {
      setError("Unable to contact the server. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[85vh] items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 font-bold group">
            <EchoLogo size={24} tile={true} tileSize="h-10 w-10" />
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Echo<span className="text-indigo-600">.ai</span>
            </span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Reset Your Password</h1>
          <p className="mt-1 text-xs text-slate-500">
            Enter your business email and we&apos;ll send you a secure link to reset your credentials.
          </p>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <span className="text-sm font-bold">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>✉️ Check Your Inbox</span>
              </div>
              <p className="leading-relaxed">
                If an account exists for <b>{email}</b>, we have dispatched a password reset link. Please check your inbox and click the link within 1 hour.
              </p>
            </div>

            {devUrl && (
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 space-y-2">
                <span className="font-bold text-[11px] uppercase tracking-wider text-indigo-700 block">
                  ⚡ Local Environment Direct Link:
                </span>
                <a
                  href={devUrl}
                  className="block p-2 rounded-lg bg-white border border-indigo-200 font-mono text-[11px] text-indigo-600 hover:text-indigo-800 break-all"
                >
                  {devUrl}
                </a>
                <a
                  href={devUrl}
                  className="inline-flex items-center gap-1 font-bold text-xs text-indigo-700 hover:underline"
                >
                  <span>Open Reset Password Page</span>
                  <span>→</span>
                </a>
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/login"
                className="w-full inline-flex justify-center rounded-xl border border-slate-200 bg-white py-2.5 font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition text-xs"
              >
                ← Return to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleForgot} noValidate className="mt-6 space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">Account Email</label>
                {emailError && (
                  <span className="text-[10px] font-bold text-rose-500">Required</span>
                )}
              </div>
              <input
                type="text"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="reception@yourclinic.com.au"
                className={`w-full rounded-xl border p-2.5 outline-none transition text-slate-900 ${
                  emailError
                    ? "border-rose-400 bg-rose-50/20 ring-1 ring-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                }`}
              />
              {emailError && (
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium animate-in fade-in">
                  <span>⚠️</span> {emailError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-md hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Sending Reset Link..." : "Send Reset Link →"}
            </button>

            <div className="text-center pt-2">
              <Link href="/login" className="text-slate-500 hover:text-indigo-600 font-semibold text-xs">
                ← Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
