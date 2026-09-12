import React from "react";
import { Sparkles, Mail, Phone, MessageSquare } from "lucide-react";

interface AIStatusRingProps {
  size?: number;
  className?: string;
  isAlwaysOn?: boolean;
}

export const AIStatusRing: React.FC<AIStatusRingProps> = ({
  size = 240,
  className = "",
  isAlwaysOn = true
}) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Radar Ring Container */}
      <div
        className="relative flex items-center justify-center select-none"
        style={{ width: size, height: size }}
      >
        {/* Outer subtle glow field */}
        <div className="absolute inset-0 rounded-full bg-violet-600/15 blur-2xl animate-pulse-subtle" />

        {/* Outermost Ring */}
        <div className="absolute inset-2 rounded-full border border-violet-500/20 shadow-[0_0_15px_rgba(124,58,237,0.15)]" />

        {/* Rotating Radar Sweep Line */}
        <div className="absolute inset-4 rounded-full overflow-hidden pointer-events-none">
          <div
            className="w-full h-full rounded-full origin-center animate-radar-sweep"
            style={{
              background:
                "conic-gradient(from 0deg at 50% 50%, rgba(168, 85, 247, 0.4) 0deg, rgba(124, 58, 237, 0.1) 45deg, transparent 90deg, transparent 360deg)"
            }}
          />
        </div>

        {/* Middle Dashed Ring */}
        <div className="absolute inset-6 rounded-full border border-dashed border-indigo-400/25 animate-[spin_40s_linear_infinite]" />

        {/* Inner Glowing Ring */}
        <div className="absolute inset-10 rounded-full border border-violet-500/40 shadow-[inset_0_0_15px_rgba(147,51,234,0.25)]" />

        {/* Center Core Glass Disc */}
        <div className="relative z-10 w-28 h-28 rounded-full bg-[#0d0d1a]/90 backdrop-blur-md border border-violet-400/40 flex flex-col items-center justify-center text-center p-2 shadow-2xl shadow-indigo-950/60">
          <span className="relative flex h-2.5 w-2.5 mb-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
          </span>
          <p className="text-xs font-bold text-white tracking-tight leading-tight">
            AI SDR
          </p>
          <p className="text-[11px] font-semibold text-violet-300 tracking-wider">
            Active
          </p>
        </div>

        {/* Orbiting Satellite Dots */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
        <div className="absolute bottom-8 right-6 w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_#a855f7]" />
        <div className="absolute top-12 left-6 w-1.5 h-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_6px_#e879f9]" />
      </div>

      {/* Channel Status Legend matching reference */}
      <div className="mt-3 flex items-center justify-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_6px_rgba(168,85,247,0.7)]" />
          <span className="text-slate-300 font-medium">Email</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(56,189,248,0.7)]" />
          <span className="text-slate-300 font-medium">Phone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.7)]" />
          <span className="text-slate-300 font-medium">SMS</span>
        </div>
      </div>
    </div>
  );
};
