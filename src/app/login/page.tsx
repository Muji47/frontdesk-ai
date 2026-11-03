"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setEmail("demo@frontdesk.ai");
    setPassword("password123");
    setError("");
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">F</span>
            FrontDesk AI
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
              className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-indigo-700"
            >
              Fill Credentials
            </button>
          </div>
          <div className="mt-1 text-[11px] text-indigo-700">
            <code>demo@frontdesk.ai</code> · <code>password123</code>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Business Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reception@yourclinic.com.au"
              className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900"
            />
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-600 text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In to Dashboard →"}
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
