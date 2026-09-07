export const DEFAULT_SDR_PERSONA = {
  personaName: "Alex Rivers",
  title: "Strategic Sales Development Representative",
  tone: "Professional, consultative, concise, helpful, and high-energy",
  qualificationFramework: "BANT" as const,
  customInstructions: "Prioritize understanding the prospect's current workflow pains. Do not push aggressively. Frame solutions around quantifiable ROI and compliance. Never invent features not listed in company knowledge.",
  maxFollowUps: 4,
  autoHandoffBudget: true,
  autoHandoffMeeting: true
};

export const DEFAULT_CADENCE_STEPS = [
  { stepNumber: 1, channel: "EMAIL" as const, delayDays: 0, condition: "INITIAL_OUTREACH" },
  { stepNumber: 2, channel: "EMAIL" as const, delayDays: 3, condition: "NO_REPLY" },
  { stepNumber: 3, channel: "PHONE" as const, delayDays: 3, condition: "NO_REPLY" },
  { stepNumber: 4, channel: "EMAIL" as const, delayDays: 5, condition: "BREAKUP" }
];

export const SUBSCRIPTION_PLANS = [
  {
    tier: "FREE" as const,
    name: "Starter",
    priceMonthlyUsd: 0,
    priceMonthlyInr: 0,
    leadLimit: 50,
    monthlyAiCredits: 500,
    features: ["1 Active SDR", "Email Outreach", "Mock Phone Studio", "Basic Analytics"]
  },
  {
    tier: "GROWTH" as const,
    name: "Growth",
    priceMonthlyUsd: 49,
    priceMonthlyInr: 3999,
    leadLimit: 1000,
    monthlyAiCredits: 10000,
    features: ["3 Active SDRs", "Email + WhatsApp + Phone", "Automated Follow-up Cadences", "CRM Sync & Export"]
  },
  {
    tier: "SCALE" as const,
    name: "Scale",
    priceMonthlyUsd: 149,
    priceMonthlyInr: 11999,
    leadLimit: 5000,
    monthlyAiCredits: 50000,
    features: ["Unlimited SDRs", "Dedicated Local/Cloud Inference", "Advanced Voice Engine", "Custom Objection Playbooks", "Priority 24/7 Support"]
  }
];
