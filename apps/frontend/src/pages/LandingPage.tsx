import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Zap,
  PhoneCall,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Play,
  Bot,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  Cpu
} from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@ai-sdr/shared";
import { HolographicEnergyMesh } from "../components/ui/HolographicEnergyMesh.js";

export const LandingPage: React.FC = () => {
  const [demoInput, setDemoInput] = useState("Your pricing seems high compared to basic automation tools.");
  const [demoOutput, setDemoOutput] = useState<string | null>(
    "I appreciate you sharing that! While basic tools automate simple webhooks, NexSDR includes enterprise SOC2 governance, automated compliance audit trails, and multi-channel voice synthesis. Clients typically save over $40,000 annually in manual SDR overhead. What does your current compliance workflow look like?"
  );

  const handleSimulateDemo = () => {
    if (demoInput.toLowerCase().includes("demo") || demoInput.toLowerCase().includes("call")) {
      setDemoOutput(
        '{\n  "tool": "create_calendar_event",\n  "arguments": {\n    "title": "15-Min Product Demo",\n    "start_time": "2026-09-15T14:00:00Z",\n    "duration": 15\n  }\n}'
      );
    } else if (demoInput.toLowerCase().includes("enterprise")) {
      setDemoOutput(
        '{\n  "tool": "human_handoff",\n  "arguments": {\n    "priority": "URGENT",\n    "reason": "Custom Enterprise SLA & SOC2 review requested"\n  }\n}'
      );
    } else {
      setDemoOutput(
        "Thanks for bringing that up. In high-growth organizations, automating lead qualification and immediate voice follow-up doubles connection rates. Could you tell me more about your target customer volume today?"
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#06060c] text-slate-100 flex flex-col selection:bg-violet-600 selection:text-white relative overflow-hidden">
      {/* Background ambient lighting fields */}
      <div className="fixed top-[-20%] left-[-15%] w-[800px] h-[800px] rounded-full bg-violet-600/[0.08] blur-[170px] pointer-events-none -z-0" />
      <div className="fixed top-[30%] right-[-15%] w-[700px] h-[700px] rounded-full bg-indigo-600/[0.07] blur-[160px] pointer-events-none -z-0" />

      {/* Top Navigation matching reference image */}
      <header className="border-b border-white/[0.06] bg-[#070712]/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">
              Nex<span className="text-violet-400">SDR</span>
            </span>
          </div>

          {/* Center Navigation Links matching reference */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
            <a href="#product" className="hover:text-white transition">Product</a>
            <a href="#solutions" className="hover:text-white transition">Solutions</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#resources" className="hover:text-white transition">Resources</a>
            <a href="#contact" className="hover:text-white transition">Contact</a>
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/login"
              className="text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 transition"
            >
              Sign in
            </Link>
            <Link
              to="/login?mode=signup"
              className="text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition shadow-lg shadow-violet-600/30 border border-violet-400/30 flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section matching reference */}
      <section className="pt-8 sm:pt-14 pb-20 px-4 sm:px-6 max-w-7xl mx-auto w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Hero Column */}
          <div className="lg:col-span-6 text-left">
            {/* Pill Label */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[11px] font-bold tracking-wider uppercase mb-6 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>AUTONOMOUS AI SALES AGENT</span>
            </div>

            {/* Headline matching reference */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
              Outreach <br />
              Conversations <br />
              Appointments <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-300">
                — On Autopilot.
              </span>
            </h1>

            <p className="mt-6 text-sm sm:text-base text-slate-400 max-w-xl leading-relaxed">
              NexSDR uses advanced AI to find leads, start meaningful conversations, handle objections, and book meetings — across Email, Phone and SMS.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/login?mode=signup"
                className="px-6 sm:px-7 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm transition shadow-xl shadow-violet-600/35 border border-violet-400/30 flex items-center gap-2"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#demo"
                className="px-6 py-3.5 rounded-xl bg-[#0f0f1e]/80 hover:bg-[#16162d] border border-white/[0.08] text-slate-200 font-semibold text-xs sm:text-sm transition flex items-center gap-2 shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-current text-violet-400" />
                <span>Watch Demo</span>
              </a>
            </div>

            {/* Conversion Metrics matching reference */}
            <div className="mt-12 pt-8 border-t border-white/[0.06] grid grid-cols-3 gap-6 max-w-lg">
              <div>
                <p className="text-2xl sm:text-3xl font-black text-white">3x</p>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1 font-medium">More Conversations</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-white">70%</p>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1 font-medium">Lower Cost</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-white">2x</p>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1 font-medium">More Meetings</p>
              </div>
            </div>
          </div>

          {/* Right Hero Column: 3D Holographic Energy Sculpture matching reference */}
          <div className="lg:col-span-6 relative flex items-center justify-center min-h-[460px] sm:min-h-[540px]">
            {/* 3D WebGL Mesh Canvas */}
            <div className="w-full h-full max-w-[540px] max-h-[540px] relative">
              <HolographicEnergyMesh intensity={1.1} />

              {/* Orbiting Glass Node 1: FIND Leads */}
              <div className="absolute top-6 left-4 sm:left-6 px-3 py-1.5 rounded-xl bg-[#0e0e1a]/80 backdrop-blur-md border border-white/[0.1] text-xs font-bold text-white shadow-lg shadow-black/40 flex items-center gap-2 animate-float-slow">
                <span className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_#a855f7]" />
                <span>FIND <span className="text-slate-400 font-normal">Leads</span></span>
              </div>

              {/* Orbiting Glass Node 2: ENGAGE Across Channels */}
              <div className="absolute top-12 right-2 sm:right-6 px-3 py-1.5 rounded-xl bg-[#0e0e1a]/80 backdrop-blur-md border border-white/[0.1] text-xs font-bold text-white shadow-lg shadow-black/40 flex items-center gap-2 animate-float-delayed">
                <span className="text-cyan-400">—</span>
                <span>ENGAGE <span className="text-slate-400 font-normal">Across Channels</span></span>
              </div>

              {/* Orbiting Glass Node 3: CONVERT To Meetings */}
              <div className="absolute bottom-10 left-6 px-3 py-1.5 rounded-xl bg-[#0e0e1a]/80 backdrop-blur-md border border-white/[0.1] text-xs font-bold text-white shadow-lg shadow-black/40 flex items-center gap-2 animate-float-slow">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span>CONVERT <span className="text-slate-400 font-normal">To Meetings</span></span>
              </div>

              {/* Floating Glass Status Card (Top Right) matching reference */}
              <div className="absolute top-28 right-0 sm:-right-4 w-48 p-3.5 rounded-2xl bg-[#0c0c18]/85 backdrop-blur-xl border border-white/[0.1] shadow-2xl shadow-violet-950/60 text-xs hidden sm:block">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] mb-2.5">
                  <span className="font-bold text-white text-[11px]">AI SDR Always On</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
                </div>
                <div className="space-y-2 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-violet-400" />
                      Email
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30">
                      Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <PhoneCall className="w-3 h-3 text-cyan-400" />
                      Phone
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-300 font-semibold">
                      Ready
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3 text-indigo-400" />
                      SMS
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-300 font-semibold">
                      Ready
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Right Typography matching reference */}
              <div className="absolute bottom-4 right-2 text-right hidden sm:block">
                <p className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-indigo-300 leading-tight">
                  More Pipeline. <br />
                  Less Manual Work. <br />
                  <span className="text-white">A Smarter Tomorrow.</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive AI SDR Decision Simulator Sandbox directly below */}
        <div id="demo" className="mt-20 max-w-4xl mx-auto rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] p-6 sm:p-8 shadow-2xl shadow-black/50 text-left">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
            <div className="flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-violet-400" />
              <span className="text-sm font-bold text-white tracking-tight">
                Live AI SDR Decision Engine
              </span>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2.5 py-1 rounded-full font-semibold">
              Engine: Qwen 2.5 3B / Groq OSS (~500 tok/s)
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-2">
                Simulate Inbound Lead Response or Objection:
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={demoInput}
                  onChange={(e) => setDemoInput(e.target.value)}
                  className="flex-1 bg-[#090914] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/60 shadow-inner"
                  placeholder="e.g. Can we meet Thursday at 2pm?"
                />
                <button
                  onClick={handleSimulateDemo}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-violet-600/30 border border-violet-400/30 shrink-0"
                >
                  Evaluate
                </button>
              </div>
            </div>

            {demoOutput && (
              <div className="p-4 rounded-xl bg-[#090914]/90 border border-white/[0.06]">
                <p className="text-[10px] text-violet-400 uppercase font-bold tracking-wider mb-2">
                  AI SDR Action / Structured Decision:
                </p>
                <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {demoOutput}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature Grid matching futuristic aesthetic */}
      <section id="features" className="py-20 border-t border-white/[0.06] bg-[#080812]/50 px-4 sm:px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              Autonomous Sales Command
            </h2>
            <p className="mt-3 text-slate-400 text-xs sm:text-sm">
              From lead ingestion to meeting confirmation, everything runs with enterprise SOC2 precision.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0e0e1a]/60 backdrop-blur-xl border border-white/[0.08] shadow-xl hover:border-violet-500/30 transition">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center mb-5 shadow-inner">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Personalized Cold Outreach</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Generates hyper-personalized opening emails grounded strictly in your ICP and product knowledge base with zero hallucinations.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-[#0e0e1a]/60 backdrop-blur-xl border border-white/[0.08] shadow-xl hover:border-cyan-500/30 transition">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center mb-5 shadow-inner">
                <PhoneCall className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Interactive Phone Voice Studio</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Sub-800ms speech-to-speech conversational voice AI handles outbound calls, objection handling, and real-time qualification.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-[#0e0e1a]/60 backdrop-blur-xl border border-white/[0.08] shadow-xl hover:border-emerald-500/30 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-5 shadow-inner">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Human Escalation Dossier</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                When enterprise whales ask for custom terms, the AI generates a full 360-degree briefing for your Account Executives.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section in glassmorphic cards */}
      <section id="pricing" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto w-full relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            Transparent, High-ROI Plans
          </h2>
          <p className="mt-3 text-slate-400 text-xs sm:text-sm">
            Zero setup fees. Scale as your inbound and outbound pipeline expands.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={`p-6 sm:p-8 rounded-2xl backdrop-blur-xl border flex flex-col justify-between ${
                plan.tier === "GROWTH"
                  ? "bg-[#111122]/90 border-violet-500/50 shadow-2xl shadow-violet-950/40 relative"
                  : "bg-[#0e0e1a]/50 border-white/[0.07]"
              }`}
            >
              {plan.tier === "GROWTH" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] font-bold tracking-wider uppercase shadow-md shadow-violet-600/40 border border-violet-400/40">
                  Most Popular
                </span>
              )}

              <div>
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-white">
                    ${plan.priceMonthlyUsd}
                  </span>
                  <span className="text-slate-400 text-xs">/ month</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">₹{plan.priceMonthlyInr} / month</p>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-xs text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  to="/login?mode=signup"
                  className={`w-full py-2.5 rounded-xl font-semibold text-xs transition flex items-center justify-center ${
                    plan.tier === "GROWTH"
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/30 border border-violet-400/30"
                      : "bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08]"
                  }`}
                >
                  Choose {plan.name}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer matching reference image typography */}
      <footer className="mt-auto border-t border-white/[0.06] bg-[#070710]/80 py-8 px-6 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] uppercase font-bold tracking-widest text-violet-400/70">
            HUMAN-LIKE CONVERSATIONS. REAL BUSINESS IMPACT.
          </p>
          <p className="text-xs text-slate-400">
            NexSDR — Build. Automate. Scale.
          </p>
        </div>
      </footer>
    </div>
  );
};
