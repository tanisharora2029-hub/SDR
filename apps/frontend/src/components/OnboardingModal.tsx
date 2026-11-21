import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import {
  X,
  CheckCircle2,
  Building2,
  Bot,
  BookOpen,
  Radio,
  UserPlus,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Check,
  RefreshCw
} from "lucide-react";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form states initialized with dynamic org / SDR defaults
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [valueProp, setValueProp] = useState("");
  const [targetIcp, setTargetIcp] = useState("");
  const [products, setProducts] = useState("");
  const [pricingInfo, setPricingInfo] = useState("");
  const [complianceInfo, setComplianceInfo] = useState("");
  const [sdrName, setSdrName] = useState("Alex Rivers");
  const [sdrTone, setSdrTone] = useState("Professional, consultative, and concise");

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        api.getOrg().catch(() => null),
        api.getSdr().catch(() => null)
      ]).then(([orgRes, sdrRes]) => {
        if (orgRes?.organization) {
          const o = orgRes.organization;
          setCompanyName(o.name || "");
          setWebsite(o.website || "");
          setIndustry(o.industry || "");
          setValueProp(o.valueProposition || "");
          setTargetIcp(o.targetCustomerIcp || "");
          setProducts(o.products || "");
          setPricingInfo(o.pricingInfo || "");
          setComplianceInfo(o.complianceInfo || "");
        }
        if (sdrRes?.sdrProfile) {
          setSdrName(sdrRes.sdrProfile.personaName || "Alex Rivers");
          setSdrTone(sdrRes.sdrProfile.tone || "Professional, consultative, and concise");
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalSteps = 6;

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await api.updateOrg({
        name: companyName,
        website,
        industry,
        valueProposition: valueProp,
        targetCustomerIcp: targetIcp,
        products,
        pricingInfo,
        complianceInfo
      });
      await api.updateSdr({
        personaName: sdrName,
        tone: sdrTone
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      alert(err.message || "Failed to save company settings");
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    {
      step: 1,
      title: "Your business",
      subtitle: "Define who your SDR represents",
      icon: Building2,
      content: (
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            NexSDR acts on behalf of your company. Verify and customize your company identity below:
          </p>
          <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Business name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your business name"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Website</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://company.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Industry / Offering</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  list="business-industries" placeholder="Choose or enter industry"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Target customers</label>
                <datalist id="business-industries"><option value="Salon"/><option value="Real Estate"/></datalist>
                <input
                  type="text"
                  value={targetIcp}
                  onChange={(e) => setTargetIcp(e.target.value)}
                  placeholder="Who usually enquires about your services?"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">What do you help customers do?</label>
              <textarea
                rows={2}
                value={valueProp}
                onChange={(e) => setValueProp(e.target.value)}
                placeholder="Describe what customers can book, buy, or enquire about."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Your agent uses these details when answering customers.</span>
          </div>
        </div>
      )
    },
    {
      step: 2,
      title: "Your AI SDR Agent",
      subtitle: "Persona, tone, and conversion objectives",
      icon: Bot,
      content: (
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            Choose how your assistant introduces itself and speaks with customers.
          </p>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Agent Persona Name</label>
                <input
                  type="text"
                  value={sdrName}
                  onChange={(e) => setSdrName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-indigo-300 font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Communication Tone</label>
                <input
                  type="text"
                  value={sdrTone}
                  onChange={(e) => setSdrTone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-between border-t border-slate-800/80 pt-2">
              <span className="text-slate-400">Primary Conversion Goal:</span>
              <span className="text-emerald-400 font-semibold">Agree on a next step with the customer</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Safety Guardrails:</span>
              <span className="text-slate-300">Strict negative constraints, anti-hallucination, explicit consent required</span>
            </div>
          </div>
        </div>
      )
    },
    {
      step: 3,
      title: "Services, prices and policies",
      subtitle: "Verified facts the SDR uses to answer questions",
      icon: BookOpen,
      content: (
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            Enter the details your team has confirmed the agent can share.
          </p>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <label className="font-semibold text-slate-200 block mb-1">Products and services</label>
              <textarea
                rows={2}
                value={products}
                onChange={(e) => setProducts(e.target.value)}
                placeholder="List your services and what is included."
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <label className="font-semibold text-slate-200 block mb-1">Confirmed pricing</label>
                <input
                  type="text"
                  value={pricingInfo}
                  onChange={(e) => setPricingInfo(e.target.value)}
                  placeholder="Enter your prices in ₹"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <label className="font-semibold text-slate-200 block mb-1">Security & Compliance</label>
                <input
                  type="text"
                  value={complianceInfo}
                  onChange={(e) => setComplianceInfo(e.target.value)}
                  placeholder="Policies your team has confirmed"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      step: 4,
      title: "Communication channels",
      subtitle: "Where you can talk to leads",
      icon: Radio,
      content: (
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            Manage your email provider in Settings. Practise voice conversations in Phone Studio.
          </p>
          <div className="space-y-2">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-blue-400 block">Email Channel</span>
                <span className="text-[11px] text-slate-400">Resend LIVE & Ethereal Sandbox with full inbound webhook support</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">See Settings</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-emerald-400 block">WhatsApp</span>
                <span className="text-[11px] text-slate-400">Official business messaging integration</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Coming soon</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-amber-400 block">Phone Voice Studio</span>
                <span className="text-[11px] text-slate-400">In-browser real-time audio with AI tone mirroring and low latency</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Simulation</span>
            </div>
          </div>
        </div>
      )
    },
    {
      step: 5,
      title: "Add Leads & Prospects",
      subtitle: "Target prospects to contact",
      icon: UserPlus,
      content: (
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            In Leads, add a contact or import an Excel or CSV file. Review the preview before saving.
          </p>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <p className="text-slate-300">
              When creating a lead, NexSDR strictly separates roles:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1 text-[11px]">
              <li><strong>You:</strong> Workspace owner / operator managing the campaigns.</li>
              <li><strong>{sdrName || "AI assistant"}:</strong> Autonomous AI SDR representing {companyName || "your company"}.</li>
              <li><strong>Lead:</strong> External customer prospect who replies via email or phone.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      step: 6,
      title: "Save & Launch",
      subtitle: "Review your details before saving",
      icon: Rocket,
      content: (
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            Check these details before saving your workspace setup.
          </p>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Company:</span>
              <span className="text-slate-100 font-semibold">{companyName || "Missing business name"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">SDR Persona:</span>
              <span className="text-indigo-300 font-semibold">{sdrName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pricing:</span>
              <span className="text-slate-200">{pricingInfo || "Not provided"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Compliance:</span>
              <span className="text-slate-200">{complianceInfo || "Not provided"}</span>
            </div>
          </div>
          {savedSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Business settings saved.</span>
            </div>
          )}
        </div>
      )
    }
  ];

  const currentStepData = steps[currentStep - 1];
  const StepIcon = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <StepIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">{currentStepData.title}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  Step {currentStep} of {totalSteps}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{currentStepData.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 h-1">
          <div
            className="bg-indigo-600 h-1 transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">{currentStepData.content}</div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:hover:text-slate-400 flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          <div className="flex items-center gap-1.5">
            {steps.map((s) => (
              <span
                key={s.step}
                className={`w-2 h-2 rounded-full transition-all ${
                  s.step === currentStep
                    ? "bg-indigo-500 w-5"
                    : s.step < currentStep
                    ? "bg-indigo-800"
                    : "bg-slate-800"
                }`}
              />
            ))}
          </div>

          {currentStep < totalSteps ? (
            <button
              onClick={() => setCurrentStep((prev) => Math.min(totalSteps, prev + 1))}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
            >
              Next <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSaveAll}
              disabled={saving || !companyName.trim()}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save & Complete</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
