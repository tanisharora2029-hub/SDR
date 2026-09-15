import { ScoreBreakdown, OpportunityScoreTier, OpportunityEvidenceItem, DecisionMakerContact } from "./types.js";

export class OpportunityScorer {
  /**
   * Calculates a transparent, 6-factor opportunity score out of 100.
   */
  public static calculateScore(params: {
    industry?: string;
    companySize?: string;
    evidenceList: OpportunityEvidenceItem[];
    automationFitLevel?: "PERFECT" | "GOOD" | "PARTIAL";
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
      normalizedInd.includes("operations")
    ) {
      icpFit = 25;
    } else if (
      normalizedInd.includes("saas") ||
      normalizedInd.includes("software") ||
      normalizedInd.includes("consulting") ||
      normalizedInd.includes("agency")
    ) {
      icpFit = 18;
    }

    // 2. Pain Signal Strength (Max 25 pts)
    const distinctCategories = new Set(evidenceList.map((e) => e.category));
    let painSignalStrength = 0;
    if (distinctCategories.size >= 3) {
      painSignalStrength = 25;
    } else if (distinctCategories.size === 2) {
      painSignalStrength = 18;
    } else if (distinctCategories.size === 1) {
      painSignalStrength = 12;
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
    } else {
      automationFit = 7;
    }

    // 5. Potential Business Impact (Max 10 pts)
    // Document processing and customer support backlogs have high impact
    let potentialBusinessImpact = 6;
    const hasHiring = evidenceList.some((e) => e.category === "HIRING");
    const hasReviews = evidenceList.some((e) => e.category === "REVIEWS");
    if (hasHiring && hasReviews) {
      potentialBusinessImpact = 10;
    } else if (hasHiring || hasReviews) {
      potentialBusinessImpact = 8;
    }

    // 6. Reachability (Max 5 pts)
    let reachability = 2;
    if (decisionMaker?.name && decisionMaker?.title) {
      reachability = 5;
    } else if (decisionMaker?.title) {
      reachability = 4;
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
    // Grounded in evidence count and high-quality verification
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

    const explanation = `Score ${totalScore}/100 (${scoreTier} OPPORTUNITY) determined by: ICP Alignment (${icpFit}/25), Signal Strength (${painSignalStrength}/25 across ${distinctCategories.size} source types), Evidence Quality (${evidenceQuality}/20), MachineMind Automation Fit (${automationFit}/15), Business Impact (${potentialBusinessImpact}/10), and Executive Reachability (${reachability}/5).`;

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
