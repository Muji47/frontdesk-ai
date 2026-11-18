"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EchoLogo } from "@/components/EchoLogo";

interface TokenVerificationData {
  email: string;
  name: string;
  role: string;
  orgName: string;
  type: string; // 'invite' | 'reset'
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [verifying, setVerifying] = useState(true);
  const [tokenData, setTokenData] = useState<TokenVerificationData | null>(null);
  const [verifyError, setVerifyError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setVerifyError("No token provided. Please use the link sent in your email.");
      return;
    }

    async function checkToken() {
      try {
        const res = await fetch(`/api/auth/verify-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setVerifyError(data.error || "This link is invalid or has expired.");
          return;
        }
        setTokenData(data.data);
      } catch {
        setVerifyError("Unable to verify link. Please check your internet connection.");
      } finally {
        setVerifying(false);
      }
    }

    checkToken();
  }, [token]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setFieldErrors({});

    const errors: { password?: string; confirm?: string } = {};
    if (!password) {
      errors.password = "New password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    }

    if (!confirmPassword) {
      errors.confirm = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      errors.confirm = "Passwords do not match. Please verify both inputs.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error?.message || data.error || "Failed to set password.");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1200);
    } catch {
      setSubmitError("Failed to connect to authentication server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const isInvite = tokenData?.type === "invite";

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
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            {isInvite ? "Activate Your Account" : "Set New Password"}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {isInvite
              ? `Welcome to ${tokenData?.orgName || "your workspace"}! Choose a password to get started.`
              : "Choose a secure password for your Echo.ai account."}
          </p>
        </div>

        {verifying ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <div className="animate-spin text-2xl">⏳</div>
            <div>Verifying secure token...</div>
          </div>
        ) : verifyError ? (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <span>⚠️ Link Expired or Invalid</span>
              </div>
              <p>{verifyError}</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/forgot-password"
                className="flex-1 text-center rounded-xl bg-indigo-600 py-2.5 font-bold text-white text-xs hover:bg-indigo-700 transition"
              >
                Request New Link
              </Link>
              <Link
                href="/login"
                className="flex-1 text-center rounded-xl border border-slate-200 bg-white py-2.5 font-bold text-slate-700 text-xs hover:bg-slate-50 transition"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        ) : success ? (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs text-center space-y-2 animate-in zoom-in-95">
            <div className="text-2xl">✅</div>
            <b className="text-sm font-bold block">Password Set Successfully!</b>
            <p>Your session has been activated. Redirecting you to your dashboard now...</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {/* User Account Context Banner */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Staff Account:</span>
                <span className="font-bold text-slate-900">{tokenData?.name || tokenData?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Work Email:</span>
                <span className="font-mono text-slate-700 text-[11px]">{tokenData?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Organization:</span>
                <span className="font-semibold text-indigo-700">{tokenData?.orgName}</span>
              </div>
              {tokenData?.role && (
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500">Role:</span>
                  <span className="font-bold text-slate-800 text-[11px]">{tokenData.role}</span>
                </div>
              )}
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <span className="text-sm font-bold">⚠️</span>
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSetPassword} noValidate className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">New Password</label>
                  {fieldErrors.password && (
                    <span className="text-[10px] font-bold text-rose-500">Required</span>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="Min 8 characters"
                  className={`w-full rounded-xl border p-2.5 outline-none transition text-slate-900 ${
                    fieldErrors.password
                      ? "border-rose-400 bg-rose-50/20 ring-1 ring-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                      : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  }`}
                />
                {fieldErrors.password && (
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium animate-in fade-in">
                    <span>⚠️</span> {fieldErrors.password}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Confirm Password</label>
                  {fieldErrors.confirm && (
                    <span className="text-[10px] font-bold text-rose-500">Required</span>
                  )}
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirm) setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
                  }}
                  placeholder="Repeat new password"
                  className={`w-full rounded-xl border p-2.5 outline-none transition text-slate-900 ${
                    fieldErrors.confirm
                      ? "border-rose-400 bg-rose-50/20 ring-1 ring-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                      : "border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  }`}
                />
                {fieldErrors.confirm && (
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 font-medium animate-in fade-in">
                    <span>⚠️</span> {fieldErrors.confirm}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-md hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Saving Password..." : isInvite ? "Activate Account & Sign In →" : "Save Password & Sign In →"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[85vh] items-center justify-center text-xs text-slate-400">
          Loading authentication gateway...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
