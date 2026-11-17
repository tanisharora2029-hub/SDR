import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client.js";
import { INDUSTRIES, INDUSTRY_IDS } from "@ai-sdr/shared";
import type { WorkspaceConfiguration } from "@ai-sdr/shared";
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
  Zap,
  Bot,
  Globe,
  Check,
  Clock,
  Sparkles,
  HelpCircle,
  FileText
} from "lucide-react";

const emptyConfiguration: WorkspaceConfiguration = {
  location: "",
  serviceAreas: "",
  businessHours: "",
  qualificationQuestions: "",
  aiInstructions: "",
  communicationPreferences: ""
};

const configurationFields: Array<{ key: keyof WorkspaceConfiguration; label: string; maxLength: number }> = [
  { key: "location", label: "Business location", maxLength: 250 },
  { key: "serviceAreas", label: "Service areas", maxLength: 2000 },
  { key: "businessHours", label: "Business hours", maxLength: 2000 },
  { key: "qualificationQuestions", label: "Qualification questions", maxLength: 4000 },
  { key: "aiInstructions", label: "AI instructions", maxLength: 6000 },
  { key: "communicationPreferences", label: "Communication preferences", maxLength: 2000 }
];

export const SettingsPage: React.FC = () => {
  const { hash } = useLocation();
  const [org, setOrg] = useState<any>(null);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [configuration, setConfiguration] = useState(emptyConfiguration);
  const industryId = INDUSTRY_IDS.find((id) => id === industry);
  const industryDefaults = industryId ? INDUSTRIES[industryId] : undefined;
  const [website, setWebsite] = useState("");
  const [targetIcp, setTargetIcp] = useState("");
  const [valueProp, setValueProp] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [products, setProducts] = useState("");
  const [pricingInfo, setPricingInfo] = useState("");
  const [complianceInfo, setComplianceInfo] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [objectionRules, setObjectionRules] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // AI SDR Sender Identity States
  const [sdrProfile, setSdrProfile] = useState<any>(null);
  const [sdrName, setSdrName] = useState("Alex Rivers");
  const [sdrEmail, setSdrEmail] = useState("alex@nexsdr.in");
  const [sdrReplyTo, setSdrReplyTo] = useState("alex@nexsdr.in");
  const [sdrTitle, setSdrTitle] = useState("AI Sales Development Representative");
  const [sdrTone, setSdrTone] = useState("Professional, consultative, and concise");
  const [sdrSignature, setSdrSignature] = useState("Alex Rivers\nAI Sales Development Representative | NexSDR\nalex@nexsdr.in • https://nexsdr.in");
  const [savingSdr, setSavingSdr] = useState(false);
  const [savedSdr, setSavedSdr] = useState(false);

  // Domain & DNS Checklist States
  const [dnsData, setDnsData] = useState<any>(null);
  const [loadingDns, setLoadingDns] = useState(true);

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
  const [testRecipient, setTestRecipient] = useState("prospect-test@sandbox.nexsdr.in");

  // Inbound Email States
  const [inboundStatus, setInboundStatus] = useState<any>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadSettings = async () => {
    try {
      const [orgRes, emailRes, webhookRes, sdrRes, dnsRes] = await Promise.all([
        api.getOrg().catch(() => ({ organization: null })),
        api.getEmailSettings().catch(() => ({ activeProvider: "ETHEREAL", providers: {} })),
        api.getInboundWebhookStatus().catch(() => null),
        api.getSdr().catch(() => null),
        api.getDomainDns().catch(() => null)
      ]);

      if (webhookRes) {
        setInboundStatus(webhookRes);
      }

      if (dnsRes) {
        setDnsData(dnsRes);
      }

      if (sdrRes?.sdrProfile) {
        setSdrProfile(sdrRes.sdrProfile);
        setSdrName(sdrRes.sdrProfile.personaName || "Alex Rivers");
        setSdrEmail(sdrRes.sdrProfile.email || "alex@nexsdr.in");
        setSdrReplyTo(sdrRes.sdrProfile.replyTo || "alex@nexsdr.in");
        setSdrTitle(sdrRes.sdrProfile.title || "AI Sales Development Representative");
        setSdrTone(sdrRes.sdrProfile.tone || "Professional, consultative, and concise");
        if (sdrRes.sdrProfile.signature) {
          setSdrSignature(sdrRes.sdrProfile.signature);
        }
      }

      if (orgRes?.organization) {
        setOrg(orgRes.organization);
        setName(orgRes.organization.name || "");
        setIndustry(orgRes.organization.industry || "");
        setConfiguration(orgRes.configuration ?? emptyConfiguration);
        setWebsite(orgRes.organization.website || "");
        setTargetIcp(orgRes.organization.targetCustomerIcp || "");
        setValueProp(orgRes.organization.valueProposition || "");
        setCompanyDescription(orgRes.organization.companyDescription || "");
        setProducts(orgRes.organization.products || "");
        setPricingInfo(orgRes.organization.pricingInfo || "");
        setComplianceInfo(orgRes.organization.complianceInfo || "");
        setCompetitors(orgRes.organization.competitors || "");
        setKnowledgeBase(orgRes.organization.knowledgeBase || "");
        setObjectionRules(orgRes.organization.objectionRules || "");
      }

      if (emailRes?.providers) {
        setProvidersInfo(emailRes.providers);
        setActiveProvider(emailRes.activeProvider || "ETHEREAL");
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoadingEmail(false);
      setLoadingDns(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (hash === "#business-profile") {
      document.getElementById("business-profile")?.scrollIntoView();
    }
  }, [hash, org]);

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
        valueProposition: valueProp,
        companyDescription,
        products,
        pricingInfo,
        complianceInfo,
        competitors,
        knowledgeBase,
        objectionRules,
        configuration
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSdr = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSdr(true);
    setSavedSdr(false);
    try {
      await api.updateSdr({
        personaName: sdrName,
        email: sdrEmail,
        replyTo: sdrReplyTo,
        title: sdrTitle,
        tone: sdrTone,
        signature: sdrSignature
      });
      setSavedSdr(true);
      setTimeout(() => setSavedSdr(false), 3000);
      await loadSettings();
    } catch (err: any) {
      alert(err.message || "Failed to update AI SDR identity");
    } finally {
      setSavingSdr(false);
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
        from: "Alex Rivers <alex@nexsdr.in>",
        to: ["inbound@nexsdr.in"],
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-400 shrink-0" />
            <span>NexSDR Configuration & Sender Architecture</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure official domain (<a href="https://nexsdr.in" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">https://nexsdr.in</a>), AI SDR sender identity, DNS records, and outbound/inbound email pipeline.
          </p>
          <a href="#business-profile" className="mt-2 inline-block text-sm text-indigo-300">
            Edit business profile and industry
          </a>
        </div>

        {saved && (
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-4 h-4" /> Settings updated!
          </span>
        )}
      </div>

      {/* SECTION 1: AI SDR SENDER IDENTITY MODEL */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                AI SDR Sender Identity (Autonomous Outreach Profile)
              </h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                PRODUCT IDENTITY
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              NexSDR enforces a strict 3-tier separation: <strong>Workspace Owner (Human Operator)</strong> vs <strong>AI SDR (Alex Rivers)</strong> vs <strong>Prospect (External Lead)</strong>.
            </p>
          </div>

          {savedSdr && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-4 h-4" /> AI SDR Identity Saved!
            </span>
          )}
        </div>

        {/* Identity Architecture Callout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
              <span>👨</span> CUSTOMER / OWNER
            </span>
            <p className="text-slate-300 font-medium">{org?.users?.[0]?.name || "Workspace Admin"} ({org?.name || "Workspace"})</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Workspace operator. Configures knowledge base and monitors conversations. Personal email is <strong>never</strong> used as the AI sender.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-1 ring-1 ring-indigo-500/20">
            <span className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
              <span>🤖</span> AI SDR SENDER
            </span>
            <p className="text-indigo-200 font-medium">{sdrName} &lt;{sdrEmail}&gt;</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Autonomous outbound engine. Dispatches cold emails, handles replies, answers objections, and qualifies prospects via Resend LIVE.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
              <span>👤</span> LEAD / PROSPECT
            </span>
            <p className="text-slate-300 font-medium">External B2B Prospect</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Recipient of outreach. Replies from their real external mailbox (e.g. Gmail) loop back into NexSDR automatically.
            </p>
          </div>
        </div>

        {/* AI SDR Identity Form */}
        <form onSubmit={handleSaveSdr} className="space-y-4 pt-2 border-t border-slate-800/80">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-slate-300 font-medium block mb-1">AI SDR Persona Name</label>
              <input
                type="text"
                value={sdrName}
                onChange={(e) => setSdrName(e.target.value)}
                placeholder="Alex Rivers"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">AI SDR Sender Email</label>
              <input
                type="email"
                value={sdrEmail}
                onChange={(e) => setSdrEmail(e.target.value)}
                placeholder="alex@nexsdr.in"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">Reply-To Address</label>
              <input
                type="email"
                value={sdrReplyTo}
                onChange={(e) => setSdrReplyTo(e.target.value)}
                placeholder="alex@nexsdr.in"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-300 font-medium block mb-1">Job Title / Role</label>
              <input
                type="text"
                value={sdrTitle}
                onChange={(e) => setSdrTitle(e.target.value)}
                placeholder="AI Sales Development Representative"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">Communication Tone</label>
              <input
                type="text"
                value={sdrTone}
                onChange={(e) => setSdrTone(e.target.value)}
                placeholder="Professional, consultative, and concise"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="text-slate-300 font-medium block mb-1">Email Signature</label>
            <textarea
              rows={3}
              value={sdrSignature}
              onChange={(e) => setSdrSignature(e.target.value)}
              placeholder="Alex Rivers&#10;AI Sales Development Representative | NexSDR&#10;alex@nexsdr.in • https://nexsdr.in"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSdr}
              className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-sm"
            >
              {savingSdr ? "Saving AI Profile..." : "Update AI SDR Identity"}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: OFFICIAL DOMAIN & DNS CHECKLIST FOR nexsdr.in */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Official Domain & DNS Verification Checklist
              </h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                nexsdr.in
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Production domain DNS configuration. Distinguishes <strong>Outbound Domain Verified</strong> from <strong>Inbound Receiving Configured</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2.5 py-1 rounded font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>REGISTRAR DNS PENDING</span>
            </span>
          </div>
        </div>

        {/* DNS Status Distinction Banner */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">DNS Setup Verification Status</p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Outbound email sending operates via Resend LIVE. In order for real prospects to receive emails from <code className="text-indigo-300">alex@nexsdr.in</code> with 100% deliverability and for their replies to route back into NexSDR, the following 4 DNS records must be added to your domain registrar (e.g. Cloudflare, GoDaddy, Namecheap):
              </p>
            </div>
          </div>
        </div>

        {/* DNS Records Checklist Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
              <tr>
                <th className="p-3">Purpose</th>
                <th className="p-3">Type</th>
                <th className="p-3">Host / Name</th>
                <th className="p-3">Value / Target</th>
                <th className="p-3">Architecture Role</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300 bg-slate-950/40">
              <tr>
                <td className="p-3 font-sans font-semibold text-slate-200">SPF Record</td>
                <td className="p-3 text-indigo-400">TXT</td>
                <td className="p-3">@</td>
                <td className="p-3 text-slate-400">v=spf1 include:resend.com ~all</td>
                <td className="p-3 font-sans text-[11px] text-slate-400">Outbound Authorisation</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Pending Registrar
                  </span>
                </td>
              </tr>
              <tr>
                <td className="p-3 font-sans font-semibold text-slate-200">DKIM Record</td>
                <td className="p-3 text-indigo-400">TXT / CNAME</td>
                <td className="p-3">resend._domainkey</td>
                <td className="p-3 text-slate-400 truncate max-w-[200px]" title="p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...">
                  resend._domainkey.resend.com
                </td>
                <td className="p-3 font-sans text-[11px] text-slate-400">Outbound Cryptographic Signature</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Pending Registrar
                  </span>
                </td>
              </tr>
              <tr>
                <td className="p-3 font-sans font-semibold text-slate-200">MX Inbound Route</td>
                <td className="p-3 text-indigo-400">MX (Priority 10)</td>
                <td className="p-3">@ / inbound</td>
                <td className="p-3 text-slate-400">feedback-smtp.us-east-1.amazonses.com</td>
                <td className="p-3 font-sans text-[11px] text-emerald-300">Inbound Receiving to Resend</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Pending Registrar
                  </span>
                </td>
              </tr>
              <tr>
                <td className="p-3 font-sans font-semibold text-slate-200">Resend Domain Verification</td>
                <td className="p-3 text-indigo-400">REST API</td>
                <td className="p-3">nexsdr.in</td>
                <td className="p-3 text-slate-400">https://api.resend.com/domains</td>
                <td className="p-3 font-sans text-[11px] text-slate-400">Delivery Account Linkage</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Resend Configured
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: EMAIL INTEGRATION (Resend LIVE + Ethereal Sandbox) */}
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
                All AI cold outreach, cadence emails, and replies are dispatched strictly through the Resend REST API and delivered directly to prospect recipient inboxes. Resend is the dedicated live email delivery provider.
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
                <span className="text-slate-200 font-medium">{sdrName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Sender Address:</span>
                <span className="font-mono text-slate-300 truncate max-w-[190px]" title={ethereal?.senderEmail}>
                  {ethereal?.senderEmail || "alex@nexsdr.in"}
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
                <span className="text-slate-200 font-medium">{sdrName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Sender Address:</span>
                <span className="font-mono text-slate-300 truncate max-w-[190px]" title={resend?.senderEmail}>
                  {resend?.senderEmail || "Alex Rivers <alex@nexsdr.in>"}
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

        {/* SECTION 4: EXPLICIT DISTINCTION - TEST EMAIL vs AI SDR COLD OUTREACH */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Understanding Email Execution Modes: Test Email vs. AI SDR Cold Outreach
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-400">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1">
              <span className="font-semibold text-slate-200 block">1. TEST EMAIL (Manual Diagnostic)</span>
              <p className="leading-relaxed">
                Executed directly below from this Settings page to confirm that SMTP or Resend API transport connectivity is healthy. Sends a diagnostic ping message to verify inbox delivery. Does not alter CRM lead stages or schedule multi-turn cadences.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1">
              <span className="font-semibold text-indigo-300 block">2. AI SDR COLD OUTREACH (Production Outreach)</span>
              <p className="leading-relaxed">
                Executed per lead on the <strong>CRM Leads</strong> page. Alex analyzes the company's ICP, value proposition, and prospect attributes to synthesize an individualized, multi-turn sales email with CAN-SPAM compliance and RFC 2822 threading.
              </p>
            </div>
          </div>
        </div>

        {/* Test Email Dispatch Form */}
        <div className="pt-2 border-t border-slate-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <label className="text-slate-400 block text-[11px] font-medium mb-1">
                Recipient for Test Email Dispatch (Manual Diagnostic)
              </label>
              <input
                type="text"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="prospect-test@sandbox.nexsdr.in"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                {activeProvider === "RESEND"
                  ? "For live delivery verification, enter your real external inbox (e.g. your personal/work email). Sandbox domains are blocked from live dispatch."
                  : "Sandbox mode captures emails with an instant preview link at zero cost."}
              </p>
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
              <span>{connResult.message}</span>
            </div>
          )}

          {/* Test Email Result Feedback */}
          {testEmailResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                testEmailResult.success
                  ? "bg-slate-950 border-emerald-500/30 text-slate-200"
                  : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  {testEmailResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>{testEmailResult.message}</span>
                </span>
                {testEmailResult.provider && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    Provider: {testEmailResult.provider}
                  </span>
                )}
              </div>

              {testEmailResult.previewUrl && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">
                    Sandbox Ethereal Message Captured:
                  </span>
                  <a
                    href={testEmailResult.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold underline text-[11px]"
                  >
                    <span>View Test Email in Web Browser</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 5: INBOUND EMAIL (Resend Webhook & Reply Loop) */}
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
              Capture real replies sent from prospect mailboxes (Gmail, Outlook) via Resend Webhooks and process them automatically with Alex (AI SDR).
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
              Production URL: <code className="text-slate-300">https://sdr-backend-6o2x.onrender.com/api/webhooks/resend/inbound</code>
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
            <span>Manual Steps Required in Resend for Live Inbound Email Delivery</span>
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
            <li>
              <strong className="text-slate-300">Domain Verification:</strong> In Resend Dashboard, verify <code className="text-indigo-300">nexsdr.in</code> by adding SPF & DKIM records.
            </li>
            <li>
              <strong className="text-slate-300">Inbound MX DNS Record:</strong> In your domain registrar, add the MX record pointing to Resend inbound mail servers.
            </li>
            <li>
              <strong className="text-slate-300">Add Webhook:</strong> In Resend Dashboard &rarr; <span className="text-indigo-300">Webhooks</span> &rarr; click <span className="text-indigo-300">Add Webhook</span>. Enter: <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">https://sdr-backend-6o2x.onrender.com/api/webhooks/resend/inbound</code>.
            </li>
            <li>
              <strong className="text-slate-300">Event Selection:</strong> Select the <code className="text-slate-200">email.received</code> event.
            </li>
            <li>
              <strong className="text-slate-300">Secret:</strong> Copy the signing secret (<code className="text-slate-300">whsec_...</code>) and save as <code className="text-slate-300">RESEND_WEBHOOK_SECRET</code> in Render backend environment variables.
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

      {/* SECTION 6: COMPANY PROFILE, KNOWLEDGE BASE & PLAYBOOK (PRODUCT TRUTH) */}
      <form id="business-profile" onSubmit={handleSave} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Company Knowledge Base & Objection Playbook (Product Truth)
              </h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                AI GROUNDING
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Every detail entered here is dynamically loaded at runtime and injected into Alex (AI SDR) prompts to ensure zero-hallucination, accurate pricing, and precise competitor objection handling.
            </p>
          </div>

          {saved && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-4 h-4" /> Knowledge Base Saved!
            </span>
          )}
        </div>

        {/* Basic Company Identity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-slate-300 font-medium block mb-1">Company Legal Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MachineMind or TestCorp"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1">Industry / Domain</label>
            <input
              type="text"
              list="workspace-industries"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Select or enter an industry"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <datalist id="workspace-industries">
              {INDUSTRY_IDS.map((id) => <option key={id} value={id}>{INDUSTRIES[id].label}</option>)}
            </datalist>
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1">Company Website</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://machinemind.in"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {configurationFields.map(({ key, label, maxLength }) => (
            <label key={key} className="text-slate-300 font-medium">
              {label}
              <textarea
                rows={key === "location" ? 1 : 3}
                maxLength={maxLength}
                value={configuration[key]}
                onChange={(event) => setConfiguration({ ...configuration, [key]: event.target.value })}
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
              />
              {key === "qualificationQuestions" && industryDefaults && (
                <button
                  type="button"
                  className="text-indigo-300 mt-1"
                  onClick={() => setConfiguration({
                    ...configuration,
                    qualificationQuestions: industryDefaults.qualificationQuestions.join("\n")
                  })}
                >
                  Use {industryDefaults.label} questions
                </button>
              )}
            </label>
          ))}
        </div>

        {/* Company Overview & Value Proposition */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-300 font-medium block mb-1">Company Description & Mission</label>
            <textarea
              rows={3}
              value={companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
              placeholder="e.g. MachineMind builds autonomous AI agents for financial back-office operations and high-volume document verification."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1">Core Value Proposition</label>
            <textarea
              rows={3}
              value={valueProp}
              onChange={(e) => setValueProp(e.target.value)}
              placeholder="e.g. Cut manual KYC verification delays from 48 hours to 90 seconds while maintaining 99.8% precision."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* ICP & Products */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-300 font-medium block mb-1">Target Customer Persona (ICP)</label>
            <textarea
              rows={3}
              value={targetIcp}
              onChange={(e) => setTargetIcp(e.target.value)}
              placeholder="e.g. Heads of Compliance, Operations Directors, and CTOs at mid-to-large fintechs, NBFCs, and retail banks."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1">Products & Core Capabilities</label>
            <textarea
              rows={3}
              value={products}
              onChange={(e) => setProducts(e.target.value)}
              placeholder="e.g. 1) DocuMind Agent: Multilingual KYC OCR. 2) FlowMind Orchestrator: Human-in-the-loop exception review."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Pricing & Compliance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-medium">Verified Commercial Pricing Info</label>
              <span className="text-[10px] text-amber-400 font-mono">Anti-Hallucination Enforced</span>
            </div>
            <textarea
              rows={3}
              value={pricingInfo}
              onChange={(e) => setPricingInfo(e.target.value)}
              placeholder="e.g. Starter ($199/mo up to 5,000 docs), Growth ($499/mo up to 25,000 docs). Enterprise custom contracts starting at $1,500/mo."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              AI will strictly cite these prices and will never invent discounts or imaginary tiers.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-medium">Security, Privacy & Compliance Info</label>
              <span className="text-[10px] text-emerald-400 font-mono">Enterprise Verified</span>
            </div>
            <textarea
              rows={3}
              value={complianceInfo}
              onChange={(e) => setComplianceInfo(e.target.value)}
              placeholder="e.g. SOC2 Type II Certified, ISO 27001, GDPR & RBI compliant. Data encrypted at rest (AES-256) and in transit (TLS 1.3). Zero customer data used for model training."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Injected into prompts when prospects raise data sovereignty, privacy, or security questions.
            </p>
          </div>
        </div>

        {/* Competitor Differentiation & Objection Playbook */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-300 font-medium block mb-1">Competitor Intelligence & Differentiators</label>
            <textarea
              rows={4}
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              placeholder="e.g. UiPath / Automation Anywhere: Heavy legacy RPA that breaks on layout changes; MachineMind uses vision-LLMs with 0 template maintenance.&#10;Zapier / Make: Consumer iPaaS without bank-grade compliance or SLA."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1">Custom Objection Handling Rules</label>
            <textarea
              rows={4}
              value={objectionRules}
              onChange={(e) => setObjectionRules(e.target.value)}
              placeholder="e.g. Internal Team Objection: 'Our internal devs are building this' -> Validate internal talent, highlight 6-12 month maintenance cost & compliance overhead.&#10;Timing Objection: 'Reach back next quarter' -> Acknowledge politely, offer exact follow-up."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Knowledge Base */}
        <div className="text-xs">
          <label className="text-slate-300 font-medium block mb-1">Core Knowledge Base & FAQs</label>
          <textarea
            rows={4}
            value={knowledgeBase}
            onChange={(e) => setKnowledgeBase(e.target.value)}
            placeholder="e.g. Implementation takes 2 business days via REST API or webhook. Native integration with Salesforce, HubSpot, and PostgreSQL. Supported languages: English, Hindi, Spanish, German."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800/80">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-sm flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Knowledge Base...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save Company Knowledge Base</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
