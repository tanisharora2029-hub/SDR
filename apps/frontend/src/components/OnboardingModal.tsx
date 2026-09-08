import React, { useState } from "react";
import { Link } from "react-router-dom";
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
  FlaskConical,
  ShieldCheck
} from "lucide-react";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);

  if (!isOpen) return null;

  const totalSteps = 6;

  const steps = [
    {
      step: 1,
      title: "Your Company Setup",
      subtitle: "Define who your SDR represents",
      icon: Building2,
      content: (
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            Nexus SDR acts on behalf of your company. In this demo workspace, your organization is preconfigured as:
          </p>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Company Name:</span>
              <span className="text-slate-100 font-semibold">CloudFlow AI</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Website:</span>
              <span className="text-indigo-400 font-mono">https://cloudflow.ai</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Industry / Offering:</span>
              <span className="text-slate-200">Autonomous B2B Sales SDR & Lead Qualification</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Workspace Owner:</span>
              <span className="text-amber-400 font-semibold">Tanish Arora (Customer / Operator)</span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            ✓ Workspace credentials, timezone, and domain authentication are active.
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
            Your SDR is an autonomous AI agent that conducts multi-turn sales outreach across all channels:
          </p>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Agent Persona:</span>
              <span className="text-indigo-300 font-semibold">Alex Rivers</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Communication Tone:</span>
              <span className="text-slate-200">Consultative, empathetic, concise, professional</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Primary Conversion Goal:</span>
              <span className="text-emerald-400 font-semibold">Book qualified 15-min discovery demos</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Guardrails:</span>
              <span className="text-slate-300">Anti-hallucination, strict knowledge grounding, DNC respect</span>
            </div>
          </div>
        </div>
      )
    },
    {
      step: 3,
      title: "Knowledge Base & Battlecards",
      subtitle: "Verified facts the SDR uses to answer questions",
      icon: BookOpen,
      content: (
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            The AI SDR only quotes verified facts from your uploaded documents and FAQ battlecards:
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-semibold text-slate-200 block mb-1">Pricing Tiers</span>
              <p className="text-[11px] text-slate-400">Starter ($499/mo), Pro ($1,299/mo), Enterprise (custom quote with annual discount).</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-semibold text-slate-200 block mb-1">Security & Compliance</span>
              <p className="text-[11px] text-slate-400">SOC2 Type II certified, GDPR compliant, 256-bit AES encryption at rest.</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-semibold text-slate-200 block mb-1">Competitor Handling</span>
              <p className="text-[11px] text-slate-400">Outreach / Salesloft / Apollo comparisons emphasizing autonomous voice + multi-channel execution.</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="font-semibold text-slate-200 block mb-1">Integrations</span>
              <p className="text-[11px] text-slate-400">Native two-way sync with Salesforce, HubSpot, Gmail, Twilio, and webhooks.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      step: 4,
      title: "Connect Channels (Zero-Cost Sandbox)",
      subtitle: "₹0 spent during development and testing",
      icon: Radio,
      content: (
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            All channels operate in zero-cost sandbox mode so you can test complete real-world flows for free:
          </p>
          <div className="space-y-2">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-blue-400 block">Email Channel</span>
                <span className="text-[11px] text-slate-400">Ethereal test SMTP — real MIME delivery with test preview URLs</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">SANDBOX ACTIVE</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-emerald-400 block">SMS & WhatsApp</span>
                <span className="text-[11px] text-slate-400">Mock carrier engine simulating carrier delivery & opt-out keywords</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">MOCK ACTIVE</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-amber-400 block">Phone Voice Studio</span>
                <span className="text-[11px] text-slate-400">In-browser real-time audio (VAD + Web Speech + Neural TTS, 0 carrier cost)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">BROWSER ACTIVE</span>
            </div>
          </div>
        </div>
      )
    },
    {
      step: 5,
      title: "Add Test Leads",
      subtitle: "Target prospects to contact",
      icon: UserPlus,
      content: (
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            Leads are external prospects who receive communications from the SDR. A default test lead is pre-created:
          </p>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Lead Name:</span>
              <span className="text-slate-100 font-semibold">Rahul Sharma</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Job Title:</span>
              <span className="text-slate-200">VP of Engineering</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Company:</span>
              <span className="text-slate-200">TechCorp Enterprises</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Email:</span>
              <span className="text-indigo-400 font-mono">rahul@test.example</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Status:</span>
              <span className="text-violet-400 font-semibold">NEW / IN_CONVERSATION</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            You can create more leads at any time from the <strong>Leads</strong> tab or import them via CSV.
          </p>
        </div>
      )
    },
    {
      step: 6,
      title: "Launch First Outreach & Test",
      subtitle: "Observe autonomous qualification & test lead replies",
      icon: Rocket,
      content: (
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            You're ready to test! Here is how the end-to-end verification loop works:
          </p>
          <div className="space-y-2.5">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
              <div>
                <strong className="text-slate-200">Alex reaches out:</strong>
                <p className="text-slate-400 mt-0.5">Click "Trigger AI Outreach" on Rahul Sharma's dossier to generate cold email.</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
              <div>
                <strong className="text-slate-200">Reply in Test Lead Simulator:</strong>
                <p className="text-slate-400 mt-0.5">Open the <strong>Test Lead Simulator</strong> to view Rahul's external inbox and send replies as the lead.</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
              <div>
                <strong className="text-slate-200">Monitor or Take Over in CRM:</strong>
                <p className="text-slate-400 mt-0.5">Watch Alex reply autonomously, or jump in as Workspace Owner Tanish to send a human takeover reply.</p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const currentStepData = steps[currentStep - 1];
  const StepIcon = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <StepIcon className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  Step {currentStep} of {totalSteps}
                </span>
                <span className="text-xs font-semibold text-slate-200">Product Onboarding Tour</span>
              </div>
              <h2 className="text-base font-bold text-slate-100 mt-0.5">{currentStepData.title}</h2>
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
        <div className="w-full bg-slate-950 h-1.5 flex">
          {steps.map((s) => (
            <div
              key={s.step}
              className={`h-full flex-1 transition-all ${
                s.step <= currentStep ? "bg-indigo-500" : "bg-slate-800"
              }`}
            />
          ))}
        </div>

        {/* Step Body */}
        <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
          <p className="text-xs text-slate-400 font-medium mb-3">{currentStepData.subtitle}</p>
          {currentStepData.content}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2">
            {currentStep < totalSteps ? (
              <button
                onClick={() => setCurrentStep((prev) => Math.min(totalSteps, prev + 1))}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/lead-simulator"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Open Lead Simulator ↗</span>
                </Link>
                <button
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                >
                  Finish Tour
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
