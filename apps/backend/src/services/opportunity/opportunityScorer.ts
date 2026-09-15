import { ScoreBreakdown, OpportunityScoreTier, OpportunityEvidenceItem, DecisionMakerContact } from "./types.js";

export class OpportunityScorer {
  private static readonly REPETITIVE_WORKFLOW_PATTERNS = [
    "spreadsheet",
    "excel",
    "manual data entry",
    "manual invoice",
    "invoice matching",
    "quote",
    "order entry",
    "reconciliation",
    "paperwork",
    "intake",
    "backlog",
    "appointment",
    "administrative assistant",
    "operations coordinator",
    "document processing",
    "crm update",
    "repetitive",
    "manual review",
    "billing",
    "claims",
    "adjudication"
  ];

  /**
   * Calculates a transparent, 6-factor opportunity score out of 100 based on:
   * OPERATIONAL PAIN × REPETITION × AUTOMATION FIT × BUSINESS IMPACT.
   * 
   * A 10-person SMB with verified repetitive manual workflows can score higher
   * than a 500-person enterprise with low operational friction.
   * Company size alone is never penalized nor accepted as evidence.
   */
  public static calculateScore(params: {
    industry?: string;
    companySize?: string;
    evidenceList: OpportunityEvidenceItem[];
    automationFitLevel?: "PERFECT" | "GOOD" | "PARTIAL" | "NONE";
    decisionMaker?: DecisionMakerContact;
  }): {
    score: number;
    scoreTier: OpportunityScoreTier;
    confidence: number;
    breakdown: ScoreBreakdown;
  } {
    const { industry = "", evidenceList = [], automationFitLevel = "GOOD", decisionMaker } = params;

    // 1. ICP Fit (Max 25 pts)
    const normalizedInd = industry.toLowerCase();
    let icpFit = 12;
    if (
      normalizedInd.includes("logistics") ||
      normalizedInd.includes("freight") ||
      normalizedInd.includes("healthcare") ||
      normalizedInd.includes("fintech") ||
      normalizedInd.includes("financial") ||
      normalizedInd.includes("insurance") ||
      normalizedInd.includes("legal") ||
      normalizedInd.includes("bpo") ||
      normalizedInd.includes("shared services") ||
      normalizedInd.includes("supply chain") ||
      normalizedInd.includes("e-commerce") ||
      normalizedInd.includes("operations") ||
      normalizedInd.includes("trade services") ||
      normalizedInd.includes("contractor")
    ) {
      icpFit = 25;
    } else if (
      normalizedInd.includes("saas") ||
      normalizedInd.includes("software") ||
      normalizedInd.includes("consulting") ||
      normalizedInd.includes("agency") ||
      normalizedInd.includes("property management")
    ) {
      icpFit = 18;
    }

    // Check for repetitive clerical/operational friction in verified evidence
    const combinedEvidenceText = evidenceList
      .map((e) => `${e.observedFact} ${e.aiInference || ""}`)
      .join(" ")
      .toLowerCase();

    const repetitiveMatches = this.REPETITIVE_WORKFLOW_PATTERNS.filter((pattern) =>
      combinedEvidenceText.includes(pattern)
    );
    const hasRepetitiveFriction = repetitiveMatches.length > 0;

    // 2. Pain Signal Strength (Max 25 pts)
    // Evaluates operational friction and workflow repetition
    const distinctCategories = new Set(evidenceList.map((e) => e.category));
    let painSignalStrength = 0;
    if (distinctCategories.size >= 3) {
      painSignalStrength = 25;
    } else if (distinctCategories.size === 2) {
      painSignalStrength = hasRepetitiveFriction ? 25 : 18;
    } else if (distinctCategories.size === 1) {
      painSignalStrength = hasRepetitiveFriction ? 22 : 12;
    } else if (evidenceList.length > 0) {
      painSignalStrength = 8;
    }

    // 3. Evidence Quality (Max 20 pts)
    const highQualityCount = evidenceList.filter((e) => e.sourceQuality === "HIGH").length;
    const medQualityCount = evidenceList.filter((e) => e.sourceQuality === "MEDIUM").length;
    let evidenceQuality = 0;
    if (highQualityCount >= 2) {
      evidenceQuality = 20;
    } else if (highQualityCount === 1) {
      evidenceQuality = 15;
    } else if (medQualityCount >= 2) {
      evidenceQuality = 12;
    } else if (evidenceList.length > 0) {
      evidenceQuality = 8;
    }

    // 4. Automation Fit (Max 15 pts)
    let automationFit = 10;
    if (automationFitLevel === "PERFECT") {
      automationFit = 15;
    } else if (automationFitLevel === "GOOD") {
      automationFit = 12;
    } else if (automationFitLevel === "PARTIAL") {
      automationFit = 7;
    } else if (automationFitLevel === "NONE") {
      automationFit = 0;
    }

    // 5. Potential Business Impact (Max 10 pts)
    // Repetitive operational tasks chokepoints in SMBs and lean teams yield maximum leverage
    let potentialBusinessImpact = 6;
    const hasHiring = evidenceList.some((e) => e.category === "HIRING");
    const hasReviews = evidenceList.some((e) => e.category === "REVIEWS");
    const hasWorkflow = evidenceList.some((e) => e.category === "PUBLIC_WORKFLOW");

    if (evidenceList.length === 0) {
      potentialBusinessImpact = 0;
    } else if (hasRepetitiveFriction && (hasHiring || hasWorkflow || hasReviews)) {
      potentialBusinessImpact = 10;
    } else if (hasRepetitiveFriction) {
      potentialBusinessImpact = 9;
    } else if (hasHiring && hasReviews) {
      potentialBusinessImpact = 10;
    } else if (hasHiring || hasReviews) {
      potentialBusinessImpact = 8;
    }

    // 6. Reachability (Max 5 pts)
    // Small business owners/founders & operations leaders have direct purchasing power
    let reachability = 2;
    const dmTitleLower = (decisionMaker?.title || "").toLowerCase();
    const isDirectLeader =
      dmTitleLower.includes("owner") ||
      dmTitleLower.includes("founder") ||
      dmTitleLower.includes("ceo") ||
      dmTitleLower.includes("president") ||
      dmTitleLower.includes("coo") ||
      dmTitleLower.includes("principal") ||
      dmTitleLower.includes("managing director") ||
      dmTitleLower.includes("head of operations") ||
      dmTitleLower.includes("vp") ||
      dmTitleLower.includes("director") ||
      dmTitleLower.includes("operations manager");

    if (decisionMaker?.name && isDirectLeader) {
      reachability = 5;
    } else if (decisionMaker?.name && decisionMaker?.title) {
      reachability = 5;
    } else if (decisionMaker?.title) {
      reachability = 4;
    } else if (decisionMaker?.name) {
      reachability = 3;
    }

    const totalScore = Math.min(
      100,
      Math.max(0, icpFit + painSignalStrength + evidenceQuality + automationFit + potentialBusinessImpact + reachability)
    );

    // Score Tier
    let scoreTier: OpportunityScoreTier = "LOW";
    if (totalScore >= 80) {
      scoreTier = "HIGH";
    } else if (totalScore >= 60) {
      scoreTier = "MEDIUM";
    }

    // Confidence Calculation (0 - 100%)
    let confidence = 50;
    if (evidenceList.length >= 3 && highQualityCount >= 2) {
      confidence = Math.min(94, 80 + evidenceList.length * 3);
    } else if (evidenceList.length >= 2) {
      confidence = Math.min(84, 70 + evidenceList.length * 4);
    } else if (evidenceList.length === 1) {
      confidence = 60;
    } else {
      confidence = 35;
    }

    const repetitionNote = hasRepetitiveFriction ? " (High Repetition Leverage)" : "";
    const explanation = `Score ${totalScore}/100 (${scoreTier} OPPORTUNITY) evaluated by OPERATIONAL PAIN × REPETITION × AUTOMATION FIT × BUSINESS IMPACT: ICP Alignment (${icpFit}/25), Signal Strength (${painSignalStrength}/25${repetitionNote}), Evidence Quality (${evidenceQuality}/20), MachineMind Automation Fit (${automationFit}/15), Business Impact (${potentialBusinessImpact}/10), and Executive Reachability (${reachability}/5).`;

    const breakdown: ScoreBreakdown = {
      icpFit,
      painSignalStrength,
      evidenceQuality,
      automationFit,
      potentialBusinessImpact,
      reachability,
      totalScore,
      explanation
    };

    return {
      score: totalScore,
      scoreTier,
      confidence,
      breakdown
    };
  }
}
