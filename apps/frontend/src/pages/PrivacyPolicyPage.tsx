import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Cpu, EyeOff, Ban, Mail } from "lucide-react";

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="atlas-theme min-h-screen bg-[#05050d] text-slate-100 relative overflow-hidden font-sans selection:bg-violet-500/30">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-violet-600/15 via-indigo-600/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

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
            <Shield className="w-3.5 h-3.5" />
            Compliance & Transparency
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Last Updated: September 12, 2026 • Version 2.4
          </p>
        </div>

        {/* Highlights Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#0d0e1f]/60 backdrop-blur-xl">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-3">
              <EyeOff className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-white">Zero Model Training</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              We never use your proprietary enterprise customer data or conversation logs to train base public AI models.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#0d0e1f]/60 backdrop-blur-xl">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
              <Ban className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-white">Automated Opt-Out & DNC</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Hard-blocking guarantees for unsubscribe keywords ("STOP", "unsubscribe") to respect prospect privacy instantly.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#0d0e1f]/60 backdrop-blur-xl">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-white">Tenant-Level Isolation</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Strict multi-tenant security guarantees that data belonging to one organization is never accessible by another.
            </p>
          </div>
        </div>

        {/* Policy Body */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0b0c1a]/70 backdrop-blur-2xl p-6 sm:p-10 space-y-8 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              1. Introduction & Scope
            </h2>
            <p>
              NexSDR ("Platform", "we", "our", or "us") provides an autonomous AI Sales Development Representative (SDR) platform. This Privacy Policy describes how we collect, process, store, and protect information when you register for an account, integrate communication channels, or interact with automated AI agents deployed through NexSDR.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              2. Information We Collect
            </h2>
            <div className="space-y-3">
              <p>
                <strong className="text-white">Account Information:</strong> Full name, corporate email address, encrypted authentication credentials, company name, and subscription details.
              </p>
              <p>
                <strong className="text-white">Customer Lead Data:</strong> Names, job titles, business email addresses, company metadata, and conversation histories uploaded or generated during B2B prospecting.
              </p>
              <p>
                <strong className="text-white">Channel Integration Credentials:</strong> API keys, webhook signatures, and sender domain verifications (e.g., Resend, Twilio) supplied by your organization to enable message dispatch.
              </p>
              <p>
                <strong className="text-white">Technical Metadata:</strong> IP addresses, browser types, session timestamps, and system performance metrics for security audit trails.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-violet-400" />
              3. Artificial Intelligence & Automated Processing
            </h2>
            <p>
              NexSDR employs artificial intelligence inference models (including Groq enterprise inference engines and open-weight models like Llama 3.3) to analyze inbound communications, classify sentiment, evaluate sales intent, and generate contextual outbound email or message responses.
            </p>
            <p className="mt-2">
              All inference queries are stateless API calls governed by strict data privacy agreements. Your prospect communications and organizational prompts are processed in transient memory and are never used to train public models or shared across client environments.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-400" />
              4. Opt-Out, DNC & Regulatory Compliance
            </h2>
            <p>
              NexSDR strictly complies with global B2B outreach regulations including the CAN-SPAM Act, the General Data Protection Regulation (GDPR), and the Telephone Consumer Protection Act (TCPA):
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 text-slate-300">
              <li>
                <strong className="text-white">Immediate Hard-Block:</strong> Any prospect who responds with standard opt-out keywords (e.g., "STOP", "UNSUBSCRIBE", "REMOVE ME", "DO NOT CONTACT") is instantly marked as Opted-Out/DNC.
              </li>
              <li>
                <strong className="text-white">Autonomous Outreach Suppression:</strong> The AI SDR engine immediately halts all scheduled outbound emails, SMS, and voice calls for that contact across your workspace.
              </li>
              <li>
                <strong className="text-white">Human Override Safety:</strong> The system forbids the resumption of automated outbound communications for DNC leads unless explicit compliance criteria are satisfied.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              5. Multi-Tenant Architecture & Data Security
            </h2>
            <p>
              Every tenant organization operates within a cryptographically isolated workspace. All database queries, WebSocket real-time event broadcasts, and lead operations require tenant-scoped JWT authentication. Cross-tenant data access is strictly prohibited by relational constraints and software access-control layers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              6. Sub-Processors & Third-Party Service Providers
            </h2>
            <p>
              To deliver multi-channel outreach and platform functionality, NexSDR utilizes trusted sub-processors:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.05]">
                <span className="font-semibold text-white block text-xs">Resend Inc.</span>
                <span className="text-[11px] text-slate-400">Inbound & outbound transactional email delivery</span>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.05]">
                <span className="font-semibold text-white block text-xs">Twilio Inc.</span>
                <span className="text-[11px] text-slate-400">Telephony, SMS, and voice streaming</span>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.05]">
                <span className="font-semibold text-white block text-xs">Razorpay Software</span>
                <span className="text-[11px] text-slate-400">Payment gateway & subscription billing</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              7. Data Retention & Your Rights
            </h2>
            <p>
              You maintain ownership of all lead records, pipeline metrics, and message transcripts. You have the right at any time to request an export of your organization's data or request permanent deletion of your account and associated records by contacting our data protection team.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-violet-400" />
              8. Contact Information
            </h2>
            <p>
              If you have any questions, compliance requests, or data privacy inquiries regarding this policy, please reach out to:
            </p>
            <div className="mt-3 p-4 rounded-xl bg-violet-950/20 border border-violet-500/20 text-xs space-y-1">
              <p className="font-semibold text-white">NexSDR Data Protection Office</p>
              <p className="text-slate-400">Email: <a href="mailto:privacy@nexsdr.in" className="text-violet-400 hover:underline">privacy@nexsdr.in</a></p>
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
            <Link to="/privacy" className="text-violet-400 hover:underline">Privacy Policy</Link>
            <Link to="/terms" className="text-slate-400 hover:text-white transition">Terms of Service</Link>
            <Link to="/" className="text-slate-400 hover:text-white transition">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicyPage;
