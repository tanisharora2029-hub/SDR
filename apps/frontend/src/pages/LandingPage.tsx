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
  Bot,
  MessageSquare,
} from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@ai-sdr/shared";

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
    <div className="atlas-theme min-h-screen bg-[#06060c] text-slate-100 flex flex-col selection:bg-violet-600 selection:text-white relative overflow-hidden">
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
        <div className="ghats-hero">
          <h1>Find your next<br />customer.</h1>
          <p>Discover local opportunities, qualify enquiries, and keep every conversation in one workspace.</p>
          <div className="flex flex-wrap gap-3">
            <Link className="atlas-primary" to="/login?mode=signup">Create workspace <ArrowRight size={16} /></Link>
            <a className="atlas-secondary" href="#demo">Try the simulator</a>
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
      <footer className="mt-auto border-t border-white/[0.06] bg-[#070710]/80 py-10 px-6 text-xs text-slate-500 relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] uppercase font-bold tracking-widest text-violet-400/70">
              HUMAN-LIKE CONVERSATIONS. REAL BUSINESS IMPACT.
            </p>
            <div className="flex items-center gap-6 text-xs">
              <Link to="/privacy" className="text-slate-400 hover:text-white transition">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-slate-400 hover:text-white transition">
                Terms of Service
              </Link>
              <Link to="/login" className="text-slate-400 hover:text-white transition">
                Sign In
              </Link>
            </div>
          </div>

          <div className="pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
            <p className="text-slate-400">
              NexSDR — Autonomous AI Sales Command Center.
            </p>
            <p className="max-w-xl text-center sm:text-right text-slate-500">
              AI SDR Notice: NexSDR deploys autonomous AI agents for B2B pipeline execution. All automated outreach complies with anti-spam standards and honors DNC / opt-out requests immediately.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
