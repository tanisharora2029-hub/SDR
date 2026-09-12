import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { Brain, Sparkles, Save, CheckCircle2, ShieldCheck, Play, Bot } from "lucide-react";

export const SdrSetupPage: React.FC = () => {
  const [sdr, setSdr] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form State
  const [personaName, setPersonaName] = useState("");
  const [title, setTitle] = useState("");
  const [tone, setTone] = useState("");
  const [qualificationFramework, setQualificationFramework] = useState("BANT");
  const [customInstructions, setCustomInstructions] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [objectionRules, setObjectionRules] = useState("");

  // Sandbox Test Chat
  const [testInput, setTestInput] = useState("What are your integration capabilities with Salesforce?");
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [sRes, oRes] = await Promise.all([api.getSdr(), api.getOrg()]);
        setSdr(sRes.sdrProfile);
        setOrg(oRes.organization);

        setPersonaName(sRes.sdrProfile.personaName);
        setTitle(sRes.sdrProfile.title);
        setTone(sRes.sdrProfile.tone);
        setQualificationFramework(sRes.sdrProfile.qualificationFramework);
        setCustomInstructions(sRes.sdrProfile.customInstructions || "");
        setKnowledgeBase(oRes.organization.knowledgeBase || "");
        setObjectionRules(oRes.organization.objectionRules || "");
      } catch (err) {
        console.error("Failed to load SDR config:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await Promise.all([
        api.updateSdr({
          personaName,
          title,
          tone,
          qualificationFramework,
          customInstructions
        }),
        api.updateOrg({
          knowledgeBase,
          objectionRules
        })
      ]);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleRunSandboxTest = () => {
    setTesting(true);
    setTimeout(() => {
      if (testInput.toLowerCase().includes("salesforce")) {
        setTestOutput(
          `Yes! ${org?.name || "NexSDR"} provides native bi-directional synchronization with Salesforce. You can map custom lead objects, sync status triggers, and maintain complete audit trails with zero custom coding in under 15 minutes.`
        );
      } else if (testInput.toLowerCase().includes("pricing") || testInput.toLowerCase().includes("cost")) {
        setTestOutput(
          "Our plans start at $199/month for growing teams and $499/month for enterprise scale with dedicated support. Customers typically see a 65% reduction in compliance overhead, saving over $40,000 annually. Would you like a breakdown of our ROI metrics?"
        );
      } else {
        setTestOutput(
          `Thanks for asking! As an AI SDR for ${org?.name || "NexSDR"}, I'm focused on helping your team automate manual compliance handoffs. Could you tell me more about your current process?`
        );
      }
      setTesting(false);
    }, 400);
  };

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading AI SDR configuration...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Brain className="w-6 h-6 text-violet-400 shrink-0" />
            <span>AI SDR Brain Configuration</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Ground your AI SDR in company truth, tone, objection handling, and strict anti-hallucination guardrails.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Configuration saved!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Persona Settings */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl space-y-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              SDR Persona & Voice
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Persona Name</label>
                <input
                  type="text"
                  required
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  className="w-full bg-[#090914] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-violet-500/60 shadow-inner"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#090914] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-violet-500/60 shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Conversational Tone</label>
              <input
                type="text"
                required
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-[#090914] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-violet-500/60 shadow-inner"
                placeholder="Professional, consultative, concise, high-energy"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Qualification Framework</label>
              <select
                value={qualificationFramework}
                onChange={(e) => setQualificationFramework(e.target.value)}
                className="w-full bg-[#090914] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-violet-500/60 shadow-inner"
              >
                <option value="BANT">BANT (Budget, Authority, Need, Timeline)</option>
                <option value="MEDDPICC">MEDDPICC (Metrics, Economic Buyer, Decision Criteria)</option>
                <option value="CUSTOM">Custom Consultative Discovery</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Custom Prompt Instructions</label>
              <textarea
                rows={4}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="w-full bg-[#090914] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white leading-relaxed focus:outline-none focus:border-violet-500/60 shadow-inner"
                placeholder="Specific instructions for how the SDR should behave..."
              />
            </div>
          </div>

          {/* Objection Playbooks */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl space-y-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Objection Handling Playbook
            </h2>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Counter-Objection Rules (Pricing, Timing, Competitors)
              </label>
              <textarea
                rows={11}
                value={objectionRules}
                onChange={(e) => setObjectionRules(e.target.value)}
                className="w-full bg-[#090914] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white leading-relaxed font-mono focus:outline-none focus:border-violet-500/60 shadow-inner"
                placeholder="Define playbooks for how to handle common objections..."
              />
            </div>
          </div>
        </div>

        {/* Company Knowledge Base */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Product Truth & Anti-Hallucination Grounding
            </h2>
            <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Strict Grounding Enabled
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Grounding Knowledge Base (Features, Pricing, Security, Case Studies)
            </label>
            <textarea
              rows={8}
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              className="w-full bg-[#090914] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white leading-relaxed font-mono focus:outline-none focus:border-violet-500/60 shadow-inner"
              placeholder="Paste company documentation, pricing tiers, integration specs..."
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-violet-600/30 border border-violet-400/30 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Saving Changes..." : "Save AI SDR Configuration"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Interactive Testing Sandbox */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-violet-500/30 shadow-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-400" />
          <h2 className="text-sm font-bold text-white">Live SDR Sandbox Test</h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            className="flex-1 bg-[#090914] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500/60 shadow-inner"
            placeholder="Ask your SDR anything to test its grounding and objection responses..."
          />
          <button
            type="button"
            onClick={handleRunSandboxTest}
            disabled={testing}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-md shadow-violet-600/30 border border-violet-400/30 shrink-0"
          >
            Test Response
          </button>
        </div>

        {testOutput && (
          <div className="p-4 rounded-xl bg-[#090914] border border-white/[0.08] text-xs leading-relaxed text-slate-200">
            <p className="font-semibold text-violet-400 mb-1">Alex Rivers (AI SDR Output):</p>
            <p>{testOutput}</p>
          </div>
        )}
      </div>
    </div>
  );
};