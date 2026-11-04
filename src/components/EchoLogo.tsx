import React from "react";

interface EchoLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  badgeText?: string;
}

export function EchoLogo({
  className = "",
  size = 32,
  showWordmark = false,
  wordmarkClassName = "text-lg font-extrabold text-slate-900 tracking-tight",
  badgeText,
}: EchoLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Acoustic Archway Vector Mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 hover:scale-105"
        aria-label="Echo.ai Logo"
      >
        <defs>
          <linearGradient id="echoArchGrad" x1="16" y1="12" x2="64" y2="68" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="0.5" stopColor="#818CF8" />
            <stop offset="1" stopColor="#38BDF8" />
          </linearGradient>
          <radialGradient id="echoCorePulse" cx="40" cy="38" r="8" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#6366F1" stopOpacity="0" />
          </radialGradient>
        </defs>
        
        {/* Outer Acoustic Archway */}
        <path
          d="M16 66V36C16 22.7452 26.7452 12 40 12C53.2548 12 64 22.7452 64 36V66"
          stroke="url(#echoArchGrad)"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        
        {/* Inner Resonant Column Arch */}
        <path
          d="M28 66V38C28 31.3726 33.3726 26 40 26C46.6274 26 52 31.3726 52 38V66"
          stroke="url(#echoArchGrad)"
          strokeWidth="5.5"
          strokeLinecap="round"
          opacity="0.8"
        />
        
        {/* Core Gateway Light Beam */}
        <path
          d="M40 66V46"
          stroke="#38BDF8"
          strokeWidth="5"
          strokeLinecap="round"
        />
        
        {/* Central Ambient Focal Pulse */}
        <circle cx="40" cy="38" r="8" fill="url(#echoCorePulse)" />
        <circle cx="40" cy="38" r="3.5" fill="#38BDF8" />
      </svg>

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
