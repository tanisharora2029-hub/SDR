import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, CheckCircle, ShieldAlert, Cpu, AlertCircle, Mail } from "lucide-react";

export const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#05050d] text-slate-100 relative overflow-hidden font-sans selection:bg-violet-500/30">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-violet-600/15 via-indigo-600/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header / Navigation */}
      <header className="border-b border-white/[0.06] bg-[#070710]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition group py-1 px-2.5 rounded-lg hover:bg-white/[0.04]"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition group-hover:-translate-x-0.5" />
              Back to NexSDR
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-violet-600/30">
              N
            </div>
            <span className="text-sm font-bold tracking-tight text-white">NexSDR</span>
          </div>
        </div>
      </header>

      {/* Content Container */}
      <main className="max-w-4xl mx-auto px-6 py-12 relative z-10">
        {/* Title Header */}
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <FileText className="w-3.5 h-3.5" />
            Terms of Service
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Last Updated: September 12, 2026 • Version 2.4
          </p>
        </div>

        {/* Highlights Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#0d0e1f]/60 backdrop-blur-xl">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
              <CheckCircle className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-white">Legitimate B2B Outreach</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              NexSDR is built for targeted, professional B2B prospect engagement with strictly verified sender domains.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#0d0e1f]/60 backdrop-blur-xl">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-white">Zero Spam Tolerance</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Unsolicited bulk spam, deceptive content, and bypassing opt-out/DNC safeguards are grounds for instant account suspension.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#0d0e1f]/60 backdrop-blur-xl">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3">
              <Cpu className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-white">AI Agent Governance</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Customers configure prompts, guardrails, and human takeover thresholds for all autonomous agent interactions.
            </p>
          </div>
        </div>

        {/* Terms Body */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0b0c1a]/70 backdrop-blur-2xl p-6 sm:p-10 space-y-8 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing, creating an account, or deploying AI SDR agents through the NexSDR platform ("Service", "NexSDR"), you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a company or legal entity, you represent that you possess the authority to bind such entity.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">
              2. Permitted Use & B2B Outreach Standards
            </h2>
            <p>
              NexSDR is designed specifically for targeted, professional B2B relationship building and sales pipeline development. You agree that:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 text-slate-300">
              <li>All contact records uploaded to your workspace have been obtained legally and in compliance with applicable data protection laws.</li>
              <li>You will not use the Service to broadcast unsolicited bulk messages ("spam"), fraudulent offers, phishing campaigns, or harassing communications.</li>
              <li>You will maintain authenticated DNS records (SPF, DKIM, DMARC) for any custom sending domains connected to the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">
              3. AI SDR Autonomy & Customer Responsibilities
            </h2>
            <p>
              NexSDR provides autonomous AI agents that draft and transmit messages, analyze responses, and book discovery meetings based on your organizational instructions, offer descriptions, and tone parameters.
            </p>
            <div className="mt-3 p-4 rounded-xl bg-black/40 border border-white/[0.06] text-xs space-y-2">
              <div className="flex items-center gap-2 text-violet-400 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Prompt Oversight & Monitoring
              </div>
              <p className="text-slate-400">
                You acknowledge that generative AI models are non-deterministic. While NexSDR implements multi-stage guardrails, DNC detection, and sentiment evaluation, you remain responsible for monitoring agent activity, configuring human takeover triggers, and ensuring that communication reflects your business practices.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">
              4. Anti-Spam & Do-Not-Call (DNC) Compliance
            </h2>
            <p>
              NexSDR automatically honors opt-out requests. You agree not to attempt to circumvent, disable, or tamper with the platform's automated DNC detection or unsubscribe handling mechanisms. Attempting to force outbound communication to contacts who have opted out violates this agreement and may lead to immediate termination.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">
              5. Subscription Billing, Credits & Fair Use
            </h2>
            <p>
              Access to NexSDR plans (Starter, Growth, Enterprise) is billed on a recurring monthly or annual basis. Each plan includes allocated quotas for lead prospecting, automated message generation, and real-time AI inference. Quotas reset at the start of each billing period and do not roll over unless specified.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">
              6. Intellectual Property & Customer Data
            </h2>
            <p>
              You retain all ownership rights in and to your company data, prospect contact lists, and customer communications. NexSDR retains all intellectual property rights in the software platform, AI orchestration algorithms, UI designs, and underlying code.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">
              7. Disclaimer of Warranties & Limitation of Liability
            </h2>
            <p>
              The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, whether express or implied. NexSDR does not guarantee specific response rates, conversion rates, or sales outcomes. In no event shall NexSDR be liable for indirect, incidental, punitive, or consequential damages arising out of your use of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">
              8. Termination
            </h2>
            <p>
              We reserve the right to suspend or terminate accounts that repeatedly violate outreach compliance standards, trigger excessive spam complaints, or abuse API rate limits, with or without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-violet-400" />
              9. Contact Us
            </h2>
            <p>
              For legal inquiries, terms clarification, or compliance notifications, please contact:
            </p>
            <div className="mt-3 p-4 rounded-xl bg-violet-950/20 border border-violet-500/20 text-xs space-y-1">
              <p className="font-semibold text-white">NexSDR Legal & Governance</p>
              <p className="text-slate-400">Email: <a href="mailto:legal@nexsdr.in" className="text-violet-400 hover:underline">legal@nexsdr.in</a></p>
              <p className="text-slate-400">Website: <a href="https://nexsdr.in" className="text-violet-400 hover:underline">https://nexsdr.in</a></p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#070710]/80 py-6 px-6 text-center text-xs text-slate-500 relative z-10 mt-12">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} NexSDR Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/privacy" className="text-slate-400 hover:text-white transition">Privacy Policy</Link>
            <Link to="/terms" className="text-violet-400 hover:underline">Terms of Service</Link>
            <Link to="/" className="text-slate-400 hover:text-white transition">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsPage;
