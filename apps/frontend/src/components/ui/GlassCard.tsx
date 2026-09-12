import React from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  glow?: "none" | "violet" | "blue";
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = "",
  hoverEffect = false,
  glow = "none",
  onClick
}) => {
  const glowStyles = {
    none: "",
    violet: "hover:shadow-[0_0_30px_rgba(124,58,237,0.25)] hover:border-violet-500/30",
    blue: "hover:shadow-[0_0_30px_rgba(56,189,248,0.25)] hover:border-cyan-500/30"
  }[glow];

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/40 overflow-hidden ${
        hoverEffect ? "transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.15] cursor-pointer" : ""
      } ${glowStyles} ${className}`}
    >
      {/* Subtle top bevel shine */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
      {children}
    </div>
  );
};
