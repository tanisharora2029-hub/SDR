import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import {
  Settings,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Send,
  ExternalLink,
  RefreshCw,
  Radio,
  Zap
} from "lucide-react";

export const SettingsPage: React.FC = () => {
  const [org, setOrg] = useState<any>(null);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [targetIcp, setTargetIcp] = useState("");
  const [valueProp, setValueProp] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Email Integration States
  const [activeProvider, setActiveProvider] = useState<"RESEND" | "ETHEREAL">("ETHEREAL");
  const [providersInfo, setProvidersInfo] = useState<any>({ ethereal: null, resend: null });
  const [loadingEmail, setLoadingEmail] = useState(true);
  const [switchingProvider, setSwitchingProvider] = useState(false);
  const [testingConn, setTestingConn] = useState<"RESEND" | "ETHEREAL" | null>(null);
  const [connResult, setConnResult] = useState<{ success: boolean; message: string; provider: string } | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    success: boolean;
    message: string;
    previewUrl?: string;
    provider?: string;
    fallbackUsed?: boolean;
  } | null>(null);
  const [testRecipient, setTestRecipient] = useState("prospect-test@sandbox.nexus-sdr.internal");

  // Inbound Email States
  const [inboundStatus, setInboundStatus] = useState<any>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadSettings = async () => {
    try {
      const [orgRes, emailRes, webhookRes] = await Promise.all([
        api.getOrg().catch(() => ({ organization: null })),
        api.getEmailSettings().catch(() => ({ activeProvider: "ETHEREAL", providers: {} })),
        api.getInboundWebhookStatus().catch(() => null)
      ]);

      if (webhookRes) {
        setInboundStatus(webhookRes);
      }

      if (orgRes?.organization) {
        setOrg(orgRes.organization);
        setName(orgRes.organization.name || "");
        setIndustry(orgRes.organization.industry || "");
        setWebsite(orgRes.organization.website || "");
        setTargetIcp(orgRes.organization.targetCustomerIcp || "");
        setValueProp(orgRes.organization.valueProposition || "");
      }

      if (emailRes?.providers) {
        setProvidersInfo(emailRes.providers);
        setActiveProvider(emailRes.activeProvider || "ETHEREAL");
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoadingEmail(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.updateOrg({
        name,
        industry,
        website,
        targetCustomerIcp: targetIcp,
        valueProposition: valueProp
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectProvider = async (provider: "RESEND" | "ETHEREAL") => {
    if (provider === activeProvider) return;
    setSwitchingProvider(true);
    try {
      await api.selectEmailProvider(provider);
      setActiveProvider(provider);
      await loadSettings();
    } catch (err: any) {
      alert(err.message || "Failed to switch email provider");
    } finally {
      setSwitchingProvider(false);
    }
  };

  const handleTestConnection = async (provider: "RESEND" | "ETHEREAL") => {
    setTestingConn(provider);
    setConnResult(null);
    try {
      const res = await api.testEmailConnection(provider);
      setConnResult({ success: res.success, message: res.message, provider });
      await loadSettings();
    } catch (err: any) {
      setConnResult({ success: false, message: err.message || "Connection test failed", provider });
    } finally {
      setTestingConn(null);
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      const res = await api.testInboundWebhook({
        from: "Alex Rivers <alex.rivers@sandbox.nexus-sdr.internal>",
        to: ["inbound@yourdomain.com"],
        subject: "Webhook Connectivity Ping",
        text: "Testing inbound reply loop processing and webhook verification.",
        message_id: `test_ping_${Date.now()}`
      });
      setWebhookTestResult({
        success: res.success,
        message: res.message || "Webhook test payload processed successfully!"
      });
      await loadSettings();
    } catch (err: any) {
      setWebhookTestResult({
        success: false,
        message: err.message || "Failed to process test webhook payload"
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleSendTestEmail = async (providerToUse?: "RESEND" | "ETHEREAL") => {
    setSendingTest(true);
    setTestEmailResult(null);
    const chosen = providerToUse || activeProvider;
    try {
      const res = await api.sendTestEmail(testRecipient.trim(), chosen);
      setTestEmailResult({
        success: res.success,
        message: res.message,
        previewUrl: res.previewUrl,
        provider: res.provider,
        fallbackUsed: res.fallbackUsed
      });
      await loadSettings();
    } catch (err: any) {
      setTestEmailResult({ success: false, message: err.message || "Failed to send test email" });
    } finally {
      setSendingTest(false);
    }
  };

  const ethereal = providersInfo?.ethereal;
  const resend = providersInfo?.resend;

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-400 shrink-0" />
            <span>Organization & Integration Settings</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure company profile, target ICP, and outbound email providers (Resend LIVE & Ethereal Sandbox).
          </p>
        </div>

        {saved && (
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-4 h-4" /> Settings updated!
          </span>
        )}
      </div>

      {/* Email Integration Section: Ethereal Sandbox + Resend LIVE */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Outbound Email Integration
              </h2>
              <span className={`text-[10px] px-2.5 py-0.5 rounded font-mono font-bold border ${
                activeProvider === "RESEND"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}>
                ACTIVE: {activeProvider === "RESEND" ? "RESEND (LIVE)" : "ETHEREAL (SANDBOX)"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select between production real-world delivery via Resend or zero-cost isolated testing via Ethereal.
            </p>
          </div>

          {/* Active Provider Selector Pills */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleSelectProvider("RESEND")}
              disabled={switchingProvider}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeProvider === "RESEND"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Resend (LIVE)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectProvider("ETHEREAL")}
              disabled={switchingProvider}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeProvider === "ETHEREAL"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Ethereal (SANDBOX)</span>
            </button>
          </div>
        </div>

        {/* Active Mode Notice Banner */}
        {activeProvider === "RESEND" ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 flex items-start gap-3">
            <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-200">Resend LIVE Mode Active (Real Outbound Delivery)</p>
              <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                All AI cold outreach, cadence emails, and replies are dispatched through the Resend REST API and delivered directly to prospect recipient inboxes. In the unlikely event of an authentication or provider failure, the platform automatically falls back to Ethereal Sandbox so outreach is never dropped.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-200">Ethereal Sandbox Mode Active (Zero-Cost / No Real Emails Sent)</p>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                All emails are safely captured in the isolated Ethereal virtual SMTP sandbox (₹0 cost). Real prospect mailboxes are never touched. Test preview URLs are generated for visual inspection.
              </p>
            </div>
          </div>
        )}

        {/* Two Providers Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Provider 1: Ethereal Sandbox */}
          <div className={`p-4 rounded-xl border transition ${
            activeProvider === "ETHEREAL"
              ? "bg-slate-950 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20"
              : "bg-slate-950/60 border-slate-800"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-sm">Ethereal Sandbox</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  SANDBOX
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{ethereal?.status || "Connected/Ready"}</span>
              </span>
            </div>

            <div className="space-y-2 text-slate-300 mb-4 text-[11px]">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Delivery Target:</span>
                <span className="text-slate-200 font-medium">Virtual Ethereal Inbox (₹0)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Sender Persona:</span>
                <span className="text-slate-200 font-medium">{ethereal?.senderName || "Alex Rivers"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Sender Address:</span>
                <span className="font-mono text-slate-300 truncate max-w-[190px]" title={ethereal?.senderEmail}>
                  {ethereal?.senderEmail || "Resolving..."}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => handleTestConnection("ETHEREAL")}
                disabled={testingConn !== null || sendingTest}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-[11px] font-semibold transition flex items-center gap-1.5"
              >
                {testingConn === "ETHEREAL" ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                ) : (
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                )}
                <span>Test Ethereal Connection</span>
              </button>

              {activeProvider !== "ETHEREAL" && (
                <button
                  type="button"
                  onClick={() => handleSelectProvider("ETHEREAL")}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline"
                >
                  Activate
                </button>
              )}
            </div>
          </div>

          {/* Provider 2: Resend LIVE */}
          <div className={`p-4 rounded-xl border transition ${
            activeProvider === "RESEND"
              ? "bg-slate-950 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20"
              : "bg-slate-950/60 border-slate-800"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-sm">Resend</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  LIVE
                </span>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                resend?.isConfigured
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${resend?.isConfigured ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                <span>{resend?.status || "Checking..."}</span>
              </span>
            </div>

            <div className="space-y-2 text-slate-300 mb-4 text-[11px]">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Delivery Target:</span>
                <span className="text-emerald-300 font-medium">Real Inboxes via Resend API</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Sender Persona:</span>
                <span className="text-slate-200 font-medium">{resend?.senderName || "Alex Rivers"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Sender Address:</span>
                <span className="font-mono text-slate-300 truncate max-w-[190px]" title={resend?.senderEmail}>
                  {resend?.senderEmail || "Alex Rivers <onboarding@resend.dev>"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => handleTestConnection("RESEND")}
                disabled={testingConn !== null || sendingTest}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-[11px] font-semibold transition flex items-center gap-1.5"
              >
                {testingConn === "RESEND" ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                ) : (
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                )}
                <span>Test Resend Connection</span>
              </button>

              {activeProvider !== "RESEND" && (
                <button
                  type="button"
                  onClick={() => handleSelectProvider("RESEND")}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium underline"
                >
                  Activate
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Test Email Form & Actions */}
        <div className="pt-2 border-t border-slate-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <label className="text-slate-400 block text-[11px] font-medium mb-1">
                Recipient for Test Email Dispatch
              </label>
              <input
                type="text"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="prospect@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:self-end">
              <button
                type="button"
                onClick={() => handleSendTestEmail(activeProvider)}
                disabled={sendingTest || testingConn !== null}
                className={`px-4 py-2 rounded-xl text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-sm ${
                  activeProvider === "RESEND"
                    ? "bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                    : "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                }`}
              >
                {sendingTest ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send Test Email via {activeProvider === "RESEND" ? "Resend (LIVE)" : "Ethereal"}</span>
              </button>
            </div>
          </div>

          {/* Connection Test Result Feedback */}
          {connResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                connResult.success
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
              }`}
            >
              {connResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>[{connResult.provider}] {connResult.message}</span>
            </div>
          )}

          {/* Test Email Result Feedback */}
          {testEmailResult && (
            <div
              className={`p-3.5 rounded-lg text-xs space-y-1.5 ${
                testEmailResult.success
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {testEmailResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="font-semibold">{testEmailResult.message}</span>
              </div>

              {testEmailResult.previewUrl && (
                <div className="pt-1">
                  <a
                    href={testEmailResult.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2"
                  >
                    <span>View Sent Email in Ethereal Sandbox</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inbound Email Section (Resend Webhook & Reply Loop) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Inbound Email (Replies from Prospect Mailboxes)
              </h2>
              <span className={`text-[10px] px-2.5 py-0.5 rounded font-mono font-bold border ${
                inboundStatus?.isResendConfigured && (webhookTestResult?.success || inboundStatus?.hasWebhookSecret)
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}>
                STATUS: {inboundStatus?.isResendConfigured && (webhookTestResult?.success || inboundStatus?.hasWebhookSecret) ? "CONFIGURED" : "NOT CONFIGURED"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Automatically capture real replies sent from prospect mailboxes (Gmail, Outlook) via Resend Webhooks and process them with Alex (AI SDR).
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestWebhook}
            disabled={testingWebhook}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-semibold text-xs transition flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
          >
            {testingWebhook ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{testingWebhook ? "Verifying..." : "Test Inbound Webhook Pipeline"}</span>
          </button>
        </div>

        {/* Configuration Details & Path */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-slate-400 block text-[11px] font-medium">Production Webhook Endpoint Path</span>
            <div className="flex items-center gap-2">
              <code className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 font-mono text-emerald-400 text-xs flex-1 break-all select-all">
                /api/webhooks/resend/inbound
              </code>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Set this endpoint URL in your Resend Dashboard under Webhooks to receive email.received events.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-slate-400 block text-[11px] font-medium">Webhook Signing & Security (Svix)</span>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                inboundStatus?.hasWebhookSecret
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${inboundStatus?.hasWebhookSecret ? "bg-emerald-400" : "bg-slate-500"}`}></span>
                <span>{inboundStatus?.hasWebhookSecret ? "RESEND_WEBHOOK_SECRET Configured" : "Optional Secret Not Set (Dev Mode)"}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Svix cryptographic signatures are verified automatically using timingSafeEqual when configured.
            </p>
          </div>
        </div>

        {/* Setup Guide Box */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs text-slate-300">
          <p className="font-semibold text-slate-200 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-indigo-400" />
            <span>Manual Setup Required in Resend for Live Inbound Email Delivery</span>
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
            <li>
              <strong className="text-slate-300">Domain Verification:</strong> In your Resend Dashboard, go to <span className="text-indigo-300">Domains</span> and verify your sender domain (or subdomain like mail.yourdomain.com).
            </li>
            <li>
              <strong className="text-slate-300">Inbound MX DNS Record:</strong> In your DNS provider, add the MX record provided by Resend pointing to their inbound mail processing servers.
            </li>
            <li>
              <strong className="text-slate-300">Add Webhook:</strong> In Resend Dashboard &rarr; <span className="text-indigo-300">Webhooks</span> &rarr; click <span className="text-indigo-300">Add Webhook</span>. Enter your live backend URL: <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">https://&lt;your-render-domain&gt;/api/webhooks/resend/inbound</code>.
            </li>
            <li>
              <strong className="text-slate-300">Event Selection:</strong> Select the <code className="text-slate-200">email.received</code> event.
            </li>
            <li>
              <strong className="text-slate-300">Optional Secret:</strong> Copy the signing secret (<code className="text-slate-300">whsec_...</code>) and save it as <code className="text-slate-300">RESEND_WEBHOOK_SECRET</code> in Render environment variables.
            </li>
          </ol>
        </div>

        {/* Webhook Test Feedback */}
        {webhookTestResult && (
          <div
            className={`p-3.5 rounded-lg text-xs flex items-center gap-2 ${
              webhookTestResult.success
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
            }`}
          >
            {webhookTestResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">{webhookTestResult.message}</span>
          </div>
        )}
      </div>

      {/* Company Profile & ICP Settings Form */}
      <form onSubmit={handleSave} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
          Company Profile & ICP
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-300 font-medium block mb-1">Company Legal Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1">Industry / Vertical</label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="text-xs">
          <label className="text-slate-300 font-medium block mb-1">Company Website</label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            placeholder="https://company.com"
          />
        </div>

        <div className="text-xs">
          <label className="text-slate-300 font-medium block mb-1">Core Value Proposition</label>
          <textarea
            rows={3}
            value={valueProp}
            onChange={(e) => setValueProp(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="text-xs">
          <label className="text-slate-300 font-medium block mb-1">Target Customer Persona (ICP)</label>
          <textarea
            rows={3}
            value={targetIcp}
            onChange={(e) => setTargetIcp(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
};
