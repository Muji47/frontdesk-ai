import React from "react";

interface EchoLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  badgeText?: string;
  tile?: boolean;
  tileSize?: string;
}

export function EchoLogo({
  className = "",
  size = 28,
  showWordmark = false,
  wordmarkClassName = "text-lg font-extrabold text-slate-900 tracking-tight",
  badgeText,
  tile = false,
  tileSize = "h-8 w-8",
}: EchoLogoProps) {
  const svgMark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-200 hover:scale-105"
      aria-label="Echo.ai Acoustic Archway"
    >
      <defs>
        <linearGradient id="echoArchGrad" x1="16" y1="12" x2="64" y2="68" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="0.5" stopColor="#818CF8" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
        <radialGradient id="echoCorePulse" cx="40" cy="38" r="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#6366F1" stopOpacity="0" />
        </radialGradient>
      </defs>
      
      {/* Outer Acoustic Archway */}
      <path
        d="M18 64V36C18 23.8497 27.8497 14 40 14C52.1503 14 62 23.8497 62 36V64"
        stroke="url(#echoArchGrad)"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      
      {/* Inner Resonant Column Arch */}
      <path
        d="M29 64V38C29 31.9249 33.9249 27 40 27C46.0751 27 51 31.9249 51 38V64"
        stroke="url(#echoArchGrad)"
        strokeWidth="5.5"
        strokeLinecap="round"
        opacity="0.85"
      />
      
      {/* Core Gateway Light Beam */}
      <path
        d="M40 64V46"
        stroke="#38BDF8"
        strokeWidth="5"
        strokeLinecap="round"
      />
      
      {/* Central Ambient Focal Pulse */}
      <circle cx="40" cy="38" r="8" fill="url(#echoCorePulse)" />
      <circle cx="40" cy="38" r="3.5" fill="#38BDF8" />
    </svg>
  );

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {tile ? (
        <div
          className={`${tileSize} rounded-xl bg-slate-950 border border-slate-800 shadow-sm flex items-center justify-center shrink-0 overflow-hidden group-hover:border-indigo-500/50 transition-colors`}
        >
          {svgMark}
        </div>
      ) : (
        svgMark
      )}

      {showWordmark && (
        <span className={wordmarkClassName}>
          Echo<span className="text-indigo-600">.ai</span>
        </span>
      )}

      {badgeText && (
        <span className="rounded-full bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 tracking-wide uppercase">
          {badgeText}
        </span>
      )}
    </div>
  );
}
