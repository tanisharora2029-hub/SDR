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
  RefreshCw
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
  const [emailSettings, setEmailSettings] = useState<any>(null);
  const [loadingEmail, setLoadingEmail] = useState(true);
  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string; previewUrl?: string } | null>(null);
  const [testRecipient, setTestRecipient] = useState("prospect-test@sandbox.nexus-sdr.internal");

  useEffect(() => {
    async function load() {
      try {
        const [orgRes, emailRes] = await Promise.all([
          api.getOrg().catch(() => ({ organization: null })),
          api.getEmailSettings().catch(() => ({ emailSettings: null }))
        ]);

        if (orgRes?.organization) {
          setOrg(orgRes.organization);
          setName(orgRes.organization.name || "");
          setIndustry(orgRes.organization.industry || "");
          setWebsite(orgRes.organization.website || "");
          setTargetIcp(orgRes.organization.targetCustomerIcp || "");
          setValueProp(orgRes.organization.valueProposition || "");
        }

        if (emailRes?.emailSettings) {
          setEmailSettings(emailRes.emailSettings);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoadingEmail(false);
      }
    }
    load();
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

  const handleTestConnection = async () => {
    setTestingConn(true);
    setConnResult(null);
    try {
      const res = await api.testEmailConnection();
      setConnResult({ success: res.success, message: res.message });
      // Refresh sender info if needed
      const settingsRes = await api.getEmailSettings();
      if (settingsRes?.emailSettings) {
        setEmailSettings(settingsRes.emailSettings);
      }
    } catch (err: any) {
      setConnResult({ success: false, message: err.message || "Connection test failed" });
    } finally {
      setTestingConn(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    setTestEmailResult(null);
    try {
      const res = await api.sendTestEmail(testRecipient.trim());
      setTestEmailResult({
        success: res.success,
        message: res.message,
        previewUrl: res.previewUrl
      });
      // Refresh sender email in UI
      const settingsRes = await api.getEmailSettings();
      if (settingsRes?.emailSettings) {
        setEmailSettings(settingsRes.emailSettings);
      }
    } catch (err: any) {
      setTestEmailResult({ success: false, message: err.message || "Failed to send test email" });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-400 shrink-0" />
            <span>Organization & Integration Settings</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure company profile, target ICP, and zero-cost sandbox email integration.
          </p>
        </div>

        {saved && (
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-4 h-4" /> Settings updated!
          </span>
        )}
      </div>

      {/* Email Integration Section (Phase 1: Ethereal Sandbox) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Email Integration
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                SANDBOX
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Autonomous AI SDR email delivery pipeline powered by the existing zero-cost Ethereal test SMTP engine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Status: {emailSettings?.status || "Connected/Ready"}</span>
            </span>
          </div>
        </div>

        {/* Sandbox Notice Banner */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-200">Sandbox Mode Active — No Real Emails Sent</p>
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              All cold outreach, SDR automated replies, and test messages are captured inside the isolated Ethereal virtual SMTP sandbox (₹0 cost). Real prospect mailboxes are never touched in sandbox mode.
            </p>
          </div>
        </div>

        {/* Email Settings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-medium">Email Provider</span>
            <span className="text-slate-100 font-semibold mt-1 block">
              {emailSettings?.provider || "Ethereal Sandbox"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-medium">Mode</span>
            <span className="text-indigo-400 font-semibold mt-1 block font-mono">
              {emailSettings?.mode || "SANDBOX"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-medium">Sender Name</span>
            <span className="text-slate-100 font-semibold mt-1 block">
              {emailSettings?.senderName || "Alex Rivers"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-medium">Sender Email</span>
            <span
              className="text-slate-300 font-mono text-[11px] mt-1 block truncate"
              title={emailSettings?.senderEmail || "Ethereal Test User"}
            >
              {loadingEmail ? "Resolving SMTP..." : (emailSettings?.senderEmail || "alex.rivers@sandbox.nexus-sdr.internal")}
            </span>
          </div>
        </div>

        {/* Test Email Recipient & Actions */}
        <div className="pt-2 border-t border-slate-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <label className="text-slate-400 block text-[11px] font-medium mb-1">
                Test Target Recipient (Simulated Inbox)
              </label>
              <input
                type="text"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="prospect-test@sandbox.nexus-sdr.internal"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:self-end">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConn || sendingTest}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-semibold text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                {testingConn ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{testingConn ? "Testing..." : "Test Connection"}</span>
              </button>

              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={testingConn || sendingTest}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                {sendingTest ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{sendingTest ? "Sending..." : "Send Test Email"}</span>
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
              <span>{connResult.message}</span>
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
