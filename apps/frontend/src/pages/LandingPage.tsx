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
  const examples = {
    Salon: ["Bridal makeup chahiye, Baner mein. Trial mil sakta hai?", "Baner, got it. Aapki wedding kis date ko hai? Phir team se trial options confirm karwa sakte hain."],
    "Real estate": ["Wakad mein 2 BHK rent pe chahiye, office ke paas.", "Wakad mein kis landmark ke paas dekh rahe hain? Uske hisaab se team relevant listings check kar sakti hai."]
  };
  const [industry, setIndustry] = useState<keyof typeof examples>("Salon");

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
            <a href="#features" className="hover:text-white transition">Product</a>
            <a href="#demo" className="hover:text-white transition">Examples</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
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
            <a className="atlas-secondary" href="#demo">See a conversation</a>
          </div>
        </div>

        {/* Interactive AI SDR Decision Simulator Sandbox directly below */}
        <div id="demo" className="mt-20 max-w-4xl mx-auto rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] p-6 sm:p-8 shadow-2xl shadow-black/50 text-left">
          <h2 className="text-2xl mb-4">Example conversations</h2>
          <div className="flex gap-2 mb-5">{(Object.keys(examples) as Array<keyof typeof examples>).map(key =>
            <button key={key} type="button" aria-pressed={industry === key} onClick={() => setIndustry(key)}
              className={industry === key ? "atlas-primary !bg-blue-700 !text-white" : "atlas-primary border"}>{key}</button>)}</div>
          <div aria-live="polite" className="space-y-3">
            <p><strong>Customer</strong><br />{examples[industry][0]}</p>
            <p><strong>AI assistant</strong><br />{examples[industry][1]}</p>
          </div>
        </div>
      </section>

      {/* Feature Grid matching futuristic aesthetic */}
      <section id="features" className="py-20 border-t border-white/[0.06] bg-[#080812]/50 px-4 sm:px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              Inside your workspace
            </h2>
            <p className="mt-3 text-slate-400 text-xs sm:text-sm">
              Import your contacts, practise a call, and review the next step for each enquiry.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-[#0e0e1a]/60 backdrop-blur-xl border border-white/[0.08] shadow-xl hover:border-violet-500/30 transition">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center mb-5 shadow-inner">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Email outreach</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Draft outreach using your business profile and review replies in the shared inbox.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-[#0e0e1a]/60 backdrop-blur-xl border border-white/[0.08] shadow-xl hover:border-cyan-500/30 transition">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center mb-5 shadow-inner">
                <PhoneCall className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Phone Studio</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Use your microphone to practise a customer conversation in the browser, then review the transcript.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-[#0e0e1a]/60 backdrop-blur-xl border border-white/[0.08] shadow-xl hover:border-emerald-500/30 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-5 shadow-inner">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Human handoff</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Review conversations that need a person and take over the follow-up.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section in glassmorphic cards */}
      <section id="pricing" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto w-full relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            Workspace plans
          </h2>
          <p className="mt-3 text-slate-400 text-xs sm:text-sm">
            Compare monthly pricing and included features.
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
                  Growth
                </span>
              )}

              <div>
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-white">
                    ₹{plan.priceMonthlyInr.toLocaleString("en-IN")}
                  </span>
                  <span className="text-slate-400 text-xs">/ month</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">US ${plan.priceMonthlyUsd} / month</p>

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
                  Create workspace
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
              NexSDR
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
              Phone Studio runs in your browser. WhatsApp messaging is coming soon.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
