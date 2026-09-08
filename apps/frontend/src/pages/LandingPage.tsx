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
  TrendingUp,
  Brain,
  MessageSquare,
  Bot
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
        "{\"tool\": \"create_calendar_event\", \"arguments\": {\"title\": \"15-Min Product Demo\", \"start_time\": \"2026-09-10T14:00:00Z\", \"duration\": 15}}"
      );
    } else if (demoInput.toLowerCase().includes("enterprise")) {
      setDemoOutput(
        "{\"tool\": \"human_handoff\", \"arguments\": {\"priority\": \"URGENT\", \"reason\": \"Custom Enterprise SLA & SOC2 review requested\"}}"
      );
    } else {
      setDemoOutput(
        `Thanks for bringing that up. In high-growth organizations, automating lead qualification and immediate voice follow-up doubles connection rates. Could you tell me more about your target customer volume today?`
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Nex<span className="text-indigo-400">SDR</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              to="/login?mode=signup"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-sm"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6 max-w-7xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-8">
          <Zap className="w-3.5 h-3.5" />
          <span>Powered by Low-Latency Local & Cloud AI SDR Engine</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight">
          Turn Cold Prospects into <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-500">
            Qualified Meetings
          </span>{" "}
          Autonomously
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Teach NexSDR your product, ICP, and objection playbooks. It personalizes cold emails, conducts conversational phone calls, qualifies BANT criteria, and hands off enterprise deals to humans.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/login?mode=signup"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 text-base"
          >
            <span>Start Free Trial</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold hover:bg-slate-800 transition flex items-center justify-center gap-2 text-base"
          >
            <span>Try Live Interactive Demo</span>
          </Link>
        </div>

        {/* Interactive Sandbox Simulator */}
        <div className="mt-16 max-w-3xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl text-left">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-400" />
              <span className="text-sm font-semibold text-slate-200">Live AI SDR Decision Engine</span>
            </div>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
              Model: Qwen 2.5 3B (~50 tok/s)
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">
                Simulate Prospect Response or Objection:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={demoInput}
                  onChange={(e) => setDemoInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Can we meet Thursday at 2pm?"
                />
                <button
                  onClick={handleSimulateDemo}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shrink-0"
                >
                  Evaluate
                </button>
              </div>
            </div>

            {demoOutput && (
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">
                  AI SDR Action / Tool Execution:
                </p>
                <pre className="text-xs font-mono text-indigo-300 whitespace-pre-wrap leading-relaxed">
                  {demoOutput}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 border-t border-slate-850 bg-slate-950/60 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight">The Complete Autonomous Sales Pipeline</h2>
            <p className="mt-3 text-slate-400 text-sm">
              Everything required to automate discovery, objection handling, and booking without human fatigue.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">Personalized Cold Outreach</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Generates hyper-personalized opening messages grounded strictly in your verified product knowledge base with zero hallucinations.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                <PhoneCall className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">Interactive Phone Voice Studio</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Real-time speech-to-text and conversational voice AI handles outbound calls, objection handling, and live qualification scoring.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">Human Escalation Dossier</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                When enterprise whales ask for custom terms, the AI generates a full 360-degree briefing for your Account Executives to close.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight">Transparent, High-ROI Pricing</h2>
          <p className="mt-3 text-slate-400 text-sm">
            Zero setup fees. Start with local/sandbox inference and scale as your pipeline expands.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={`p-8 rounded-2xl border flex flex-col justify-between ${
                plan.tier === "GROWTH"
                  ? "bg-slate-900 border-indigo-500/60 shadow-xl shadow-indigo-500/10 relative"
                  : "bg-slate-900/40 border-slate-800"
              }`}
            >
              {plan.tier === "GROWTH" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold tracking-wider uppercase">
                  Most Popular
                </span>
              )}

              <div>
                <h3 className="text-xl font-bold text-slate-100">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-100">
                    ${plan.priceMonthlyUsd}
                  </span>
                  <span className="text-slate-400 text-sm">/ month</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">₹{plan.priceMonthlyInr} / month</p>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  to="/login?mode=signup"
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm transition flex items-center justify-center ${
                    plan.tier === "GROWTH"
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  }`}
                >
                  Choose {plan.name}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-850 py-8 px-6 text-center text-xs text-slate-400">
        <p>© 2026 NexSDR Inc. Production-ready autonomous sales infrastructure • <a href="https://nexsdr.in" className="hover:text-slate-300 transition">nexsdr.in</a></p>
      </footer>
    </div>
  );
};