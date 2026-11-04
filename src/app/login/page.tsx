"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EchoLogo } from "@/components/EchoLogo";

interface ApiErrorResponse {
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError("");
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data: ApiErrorResponse = await res.json();
      if (!res.ok || !data.success) {
        if (data.error?.details) {
          setFieldErrors(data.error.details);
        }
        setGeneralError(data.error?.message || "Invalid email or password.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setGeneralError("Unable to reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setEmail("demo@echo.ai");
    setPassword("password123");
    setGeneralError("");
    setFieldErrors({});
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 font-bold group">
            <EchoLogo size={24} tile={true} tileSize="h-10 w-10" />
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Echo<span className="text-indigo-600">.ai</span>
            </span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Sign In to Dashboard</h1>
          <p className="mt-1 text-xs text-slate-500">Manage your virtual receptionist, live bookings, and chat inbox.</p>
        </div>

        {/* Demo Account Quick Fill Pill */}
        <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-950">⚡ Demo Clinic Account:</span>
            <button
              type="button"
              onClick={fillDemo}
              className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              Fill Credentials
            </button>
          </div>
          <div className="mt-1 text-[11px] text-indigo-700">
            <code>demo@echo.ai</code> · <code>password123</code>
          </div>
        </div>

        {/* Global Error Banner */}
        {generalError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <span className="text-sm font-bold">⚠️</span>
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Business Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: [] });
              }}
              placeholder="reception@yourclinic.com.au"
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
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-slate-700">Password</label>
              <a href="#" className="text-indigo-600 hover:underline text-[11px]">Forgot password?</a>
            </div>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign In to Dashboard →"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
          Don&apos;t have an account yet?{" "}
          <Link href="/signup" className="font-bold text-indigo-600 hover:underline">
            Start 14-day free trial
          </Link>
        </div>
      </div>
    </div>
  );
}
