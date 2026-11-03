"use client";

import { useState } from "react";
import Link from "next/link";

interface Preset {
  name: string;
  inquiries: number;
  dealValue: number;
  hoursSaved: number;
}

const presets: Record<string, Preset> = {
  clinic: { name: "Physio / Medical Clinic", inquiries: 400, dealValue: 110, hoursSaved: 10 },
  ecommerce: { name: "E-commerce Store", inquiries: 1500, dealValue: 75, hoursSaved: 15 },
  realestate: { name: "Real Estate Agency", inquiries: 250, dealValue: 500, hoursSaved: 12 },
  beauty: { name: "Salon & Wellness", inquiries: 350, dealValue: 85, hoursSaved: 8 },
};

export function RoiCalculator() {
  const [inquiries, setInquiries] = useState(400);
  const [dealValue, setDealValue] = useState(110);
  const [hoursSaved, setHoursSaved] = useState(10);
  const [hourlyRate, setHourlyRate] = useState(30);

  // Recovery hypothesis: conservative 12% of otherwise missed/delayed inquiries converted
  const recoveredDeals = Math.round(inquiries * 0.12);
  const revenueGained = recoveredDeals * dealValue;
  const staffSavings = hoursSaved * 4 * hourlyRate;
  const totalValue = revenueGained + staffSavings;
  const softwareCost = 99; // Growth plan
  const netRoi = totalValue - softwareCost;
  const roiMultiplier = Math.round((totalValue / softwareCost) * 10) / 10;

  function applyPreset(p: Preset) {
    setInquiries(p.inquiries);
    setDealValue(p.dealValue);
    setHoursSaved(p.hoursSaved);
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl md:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Interactive ROI & Value Estimator</h3>
          <p className="text-sm text-slate-500">Calculate how much missed revenue and reception time your business can recover.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(presets).map(([k, p]) => (
            <button
              key={k}
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-600 hover:text-indigo-600"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Controls */}
        <div className="space-y-6 lg:col-span-7">
          <div>
            <div className="flex justify-between text-sm font-semibold text-slate-700">
              <span>Monthly Website / Chat Inquiries</span>
              <span className="text-indigo-600">{inquiries.toLocaleString()} inquiries</span>
            </div>
            <input
              type="range"
              min="50"
              max="5000"
              step="50"
              value={inquiries}
              onChange={(e) => setInquiries(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>50 / mo</span>
              <span>5,000 / mo</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm font-semibold text-slate-700">
              <span>Average Appointment or Order Value</span>
              <span className="text-indigo-600">${dealValue}</span>
            </div>
            <input
              type="range"
              min="20"
              max="1000"
              step="10"
              value={dealValue}
              onChange={(e) => setDealValue(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>$20</span>
              <span>$1,000</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm font-semibold text-slate-700">
              <span>Reception / Staff Hours Saved Per Week</span>
              <span className="text-indigo-600">{hoursSaved} hrs / wk</span>
            </div>
            <input
              type="range"
              min="2"
              max="40"
              step="1"
              value={hoursSaved}
              onChange={(e) => setHoursSaved(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>2 hrs</span>
              <span>40 hrs (full-time role)</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm font-semibold text-slate-700">
              <span>Staff Hourly Wage</span>
              <span className="text-indigo-600">${hourlyRate} / hr</span>
            </div>
            <input
              type="range"
              min="20"
              max="80"
              step="5"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-600"
            />
          </div>
        </div>

        {/* Results Card */}
        <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl lg:col-span-5">
          <div>
            <span className="inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300">
              Estimated Monthly Value
            </span>
            <div className="mt-3 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              ${totalValue.toLocaleString()}
              <span className="text-sm font-normal text-indigo-200"> / month</span>
            </div>
            <p className="mt-1 text-xs text-indigo-300">
              ROI: <b className="text-emerald-400">{roiMultiplier}x</b> based on $99/mo Growth plan.
            </p>

            <div className="mt-6 space-y-3 border-t border-indigo-800/60 pt-4 text-xs">
              <div className="flex justify-between">
                <span className="text-indigo-200">Estimated Bookings / Sales Recovered:</span>
                <b className="text-white">{recoveredDeals} orders / appts</b>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-200">Revenue Generated:</span>
                <b className="text-emerald-400">+${revenueGained.toLocaleString()}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-200">Admin Hours Saved:</span>
                <b className="text-white">{hoursSaved * 4} hours / mo</b>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-200">Admin Labor Value Saved:</span>
                <b className="text-emerald-400">+${staffSavings.toLocaleString()}</b>
              </div>
              <div className="flex justify-between border-t border-indigo-800/40 pt-2 font-semibold">
                <span className="text-indigo-200">Net Estimated Profit:</span>
                <span className="text-white">+${netRoi.toLocaleString()} / mo</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="/signup"
              className="block w-full rounded-xl bg-white py-3 text-center text-sm font-bold text-indigo-950 shadow-md transition hover:bg-indigo-50"
            >
              Start 14-Day Free Trial
            </Link>
            <p className="mt-2 text-center text-[11px] text-indigo-400">
              No credit card required. Installs on your website in minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
