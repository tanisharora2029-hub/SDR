export type EvidenceType = "FACT" | "INFERENCE" | "UNKNOWN";

export type EvidenceCategory =
  | "HIRING"
  | "PUBLIC_WORKFLOW"
  | "REVIEWS"
  | "DOCUMENTATION"
  | "TECH_SIGNAL"
  | "LEADERSHIP";

export type SourceQuality = "HIGH" | "MEDIUM" | "LOW";

export type OpportunityScoreTier = "HIGH" | "MEDIUM" | "LOW";

export interface ScoreBreakdown {
  icpFit: number; // Max 25
  painSignalStrength: number; // Max 25
  evidenceQuality: number; // Max 20
  automationFit: number; // Max 15
  potentialBusinessImpact: number; // Max 10
  reachability: number; // Max 5
  totalScore: number; // 0 - 100
  explanation: string;
}

export interface OpportunityEvidenceItem {
  id?: string;
  type: EvidenceType;
  category: EvidenceCategory;
  observedFact: string;
  aiInference?: string | null;
  confidenceScore: number;
  sourceName: string;
  sourceUrl: string;
  sourceQuality: SourceQuality;
}

export interface MachineMindSolutionMapping {
  productCodes: string[]; // e.g. ["M-EXTRACT", "M-FLOW"]
  displayTitle: string; // e.g. "M-EXTRACT + M-FLOW"
  whyItFits: string;
  workflowSteps: string[];
  potentialBusinessImpact: string;
  isFit?: boolean;
}

export interface DecisionMakerContact {
  name: string | null;
  title: string | null;
  email: string | null; // Null if not verified
  sourceUrl: string | null;
  evidenceSnippet: string | null;
  isConfident: boolean;
}

export interface AnalyzedOpportunityResult {
  companyName: string;
  companyWebsite: string;
  companyIndustry: string;
  companySize?: string;
  location?: string;
  potentialProblem: string;
  whyItMatters: string;
  score: number;
  scoreTier: OpportunityScoreTier;
  confidence: number;
  scoreBreakdown: ScoreBreakdown;
  evidenceList: OpportunityEvidenceItem[];
  machineMindSolution: MachineMindSolutionMapping;
  decisionMaker: DecisionMakerContact;
  generatedSubject: string;
  generatedEmail: string;
  researchStatus: "ANALYZED" | "INSUFFICIENT_EVIDENCE" | "FAILED";
}

export interface AutopilotCandidate {
  companyName: string;
  domain: string;
  industry: string;
  estimatedSize: string;
  location: string;
  operationalContext: string;
  seedUrls: string[];
}
