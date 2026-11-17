import { SdrToolDecision, SdrToolName, AiAction } from "@ai-sdr/shared";

export interface SdrContext {
  organizationId?: string | null;
  organizationName: string;
  industry?: string | null;
  valueProposition?: string | null;
  targetCustomerIcp?: string | null;
  companyDescription?: string | null;
  products?: string | null;
  pricingInfo?: string | null;
  complianceInfo?: string | null;
  competitors?: string | null;
  knowledgeBase?: string | null;
  objectionRules?: string | null;
  personaName: string;
  personaTitle: string;
  tone: string;
  qualificationFramework: string;
  customInstructions?: string | null;
}

export interface LeadContext {
  leadId: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  jobTitle?: string | null;
  industry?: string | null;
  status: string;
  intentScore: number;
}

export interface ConversationTurn {
  speaker: "lead" | "sdr";
  channel: string;
  content: string;
  timestamp: string;
}

export interface AiCompletionResponse {
  content: string; // Guaranteed clean natural language reply - never raw JSON
  action: AiAction;
  toolDecision?: SdrToolDecision | null;
  latencyMs: number;
  tokensUsed?: number;
  provider: string;
}

export interface AiOpportunityFact {
  observedFact: string;
  sourceUrl: string;
  category: string;
  confidenceScore: number;
  sourceQuality?: "HIGH" | "MEDIUM" | "LOW";
}

export interface AiOpportunityInference {
  aiInference: string;
  basedOnFact: string;
  confidenceScore: number;
}

export interface AiOpportunityAnalysisResult {
  industry: string;
  companySize?: string;
  facts: AiOpportunityFact[];
  signals: string[];
  inferences: AiOpportunityInference[];
  unknowns: string[];
  potentialProblem: string;
  whyItMatters: string;
  automationFit: "PERFECT" | "GOOD" | "PARTIAL" | "NONE";
  recommendedSolution: string;
  workflow: string[];
  decisionMaker?: {
    name: string | null;
    title: string | null;
    sourceUrl: string | null;
  } | null;
  confidence: number;
}

// ──────────────────────────────────────────────────
// Multi-Pass AI Sales Research Brain — 4-Stage Types
// ──────────────────────────────────────────────────

export type AiResearchStage =
  | "BUSINESS_ANALYST"
  | "OPERATIONS_ANALYST"
  | "OPPORTUNITY_ANALYST"
  | "EVIDENCE_CRITIC";

export interface BusinessAnalysis {
  companyName: string;
  whatTheyDo: string;
  industry: string;
  companySize: string;
  location: string;
  customerType: string;
  servicesOffered: string[];
}

export interface OperationsAnalysis {
  observedWorkflows: Array<{
    workflow: string;
    sourceUrl: string;
    evidenceSnippet: string;
  }>;
  operationalSignals: Array<{
    signal: string;
    type: "HIRING" | "PUBLIC_WORKFLOW" | "TECH_SIGNAL" | "DOCUMENTATION" | "REVIEWS" | "LEADERSHIP";
    sourceUrl: string;
    snippet: string;
  }>;
  technologyMentions: string[];
  hiringSignals: string[];
}

export interface OpportunityAnalysis {
  potentialProblem: string;
  whyItMatters: string;
  automationFit: "PERFECT" | "GOOD" | "PARTIAL" | "NONE";
  recommendedSolution: string;
  workflow: string[];
  facts: AiOpportunityFact[];
  inferences: AiOpportunityInference[];
  unknowns: string[];
  decisionMaker: { name: string | null; title: string | null; sourceUrl: string | null } | null;
  confidence: number;
}

export interface EvidenceCriticResult {
  verifiedFacts: AiOpportunityFact[];
  rejectedFacts: Array<{ fact: string; reason: string }>;
  strengthenedInferences: AiOpportunityInference[];
  overallVerdict: "SUPPORTED" | "WEAK" | "UNSUPPORTED";
  critiqueNotes: string;
  adjustedConfidence: number;
}

export interface AiStageResult {
  stage: AiResearchStage;
  raw: any;
  success: boolean;
  error?: string;
}

export interface AiProvider {
  generateOutreach(sdr: SdrContext, lead: LeadContext): Promise<AiCompletionResponse>;
  respondToMessage(sdr: SdrContext, lead: LeadContext, history: ConversationTurn[], latestMessage: string): Promise<AiCompletionResponse>;
  qualifyLead(sdr: SdrContext, lead: LeadContext, history: ConversationTurn[]): Promise<{
    status: "QUALIFIED" | "UNQUALIFIED" | "IN_CONVERSATION";
    budget?: string;
    authority?: string;
    need?: string;
    timeline?: string;
    notes: string;
  }>;
  summarizeCall(transcript: Array<{ speaker: string; text: string }>, lead: LeadContext): Promise<{
    summary: string;
    qualificationScore: number;
    recommendedAction: string;
  }>;
  analyzeOpportunityContent(params: {
    company: string;
    domain: string;
    pages: Array<{ url: string; text: string; title?: string }>;
  }): Promise<AiOpportunityAnalysisResult>;
  analyzeOpportunityStage?(
    stage: AiResearchStage,
    systemPrompt: string,
    userPrompt: string
  ): Promise<any>;
}