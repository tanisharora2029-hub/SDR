/**
 * NexusSDR Competitor RAG Service
 * Detects competitor mentions, retrieves verified battlecard evidence,
 * and enforces strict zero-hallucination guardrails.
 */

export interface CompetitorEvidence {
  competitorName: string;
  isVerified: boolean;
  verifiedSummary: string;
  differentiationAngle: string;
  safeFallbackStatement: string;
}

export interface CompetitorRagProvider {
  name: string;
  lookupCompetitor(
    competitorName: string,
    organizationKnowledgeBase: string,
    objectionRules: string
  ): Promise<CompetitorEvidence | null>;
}

/**
 * Built-in zero-cost provider: parses verified knowledge base and local battlecards
 */
export class LocalVerifiedCompetitorProvider implements CompetitorRagProvider {
  name = "local-verified-knowledge-base";

  // Common B2B sales tech competitors
  private knownCompetitors: Record<string, { summary: string; differentiation: string }> = {
    salesforce: {
      summary: "Salesforce is an enterprise CRM system of record.",
      differentiation: "NexusSDR integrates natively with Salesforce as an autonomous execution layer, enriching CRM leads rather than replacing the CRM."
    },
    hubspot: {
      summary: "HubSpot provides inbound marketing, sales CRM, and basic email sequences.",
      differentiation: "NexusSDR provides fully autonomous two-way multi-turn conversational qualification (Email & Voice) with native bi-directional HubSpot sync."
    },
    outreach: {
      summary: "Outreach.io is a sales execution platform built for human reps to execute manual tasks.",
      differentiation: "NexusSDR is fully autonomous: it handles the initial qualification, objection handling, and appointment booking autonomously without requiring human SDR labor."
    },
    salesloft: {
      summary: "Salesloft coordinates human rep outreach cadence.",
      differentiation: "NexusSDR acts as an autonomous virtual team member that qualifies leads around the clock across email and live phone voice."
    },
    apollo: {
      summary: "Apollo.io is a B2B database and basic sequencing tool.",
      differentiation: "NexusSDR focuses on deep autonomous multi-turn voice & email qualification rather than purely bulk email blasts."
    }
  };

  async lookupCompetitor(
    competitorName: string,
    organizationKnowledgeBase: string,
    objectionRules: string
  ): Promise<CompetitorEvidence | null> {
    const norm = competitorName.toLowerCase().trim();
    const displayCompetitor = competitorName.charAt(0).toUpperCase() + competitorName.slice(1);
    const allOrgText = `${organizationKnowledgeBase} ${objectionRules}`.toLowerCase();

    // Check if organization explicitly defines rules for this competitor
    const orgMentions = allOrgText.includes(norm);

    if (orgMentions) {
      // Extract relevant sentences from knowledgeBase/objectionRules
      const sentences = `${organizationKnowledgeBase}\n${objectionRules}`.split(/[.\n]/).filter(s => s.toLowerCase().includes(norm));
      const extractedTruth = sentences.map(s => s.trim()).filter(Boolean).join(". ");

      return {
        competitorName: displayCompetitor,
        isVerified: true,
        verifiedSummary: extractedTruth || `Verified organization rules regarding ${displayCompetitor}.`,
        differentiationAngle: `Consultative comparison for ${displayCompetitor} based strictly on approved product truth.`,
        safeFallbackStatement: "I don't have verified information on that specific feature yet, so I don't want to guess."
      };
    }

    // Check verified built-in industry battlecards
    if (this.knownCompetitors[norm]) {
      const info = this.knownCompetitors[norm];
      return {
        competitorName: displayCompetitor,
        isVerified: true,
        verifiedSummary: info.summary,
        differentiationAngle: info.differentiation,
        safeFallbackStatement: "I don't have verified information on that specific feature yet, so I don't want to guess."
      };
    }

    // Unverified Competitor: Enforce strict zero-hallucination fallback
    return {
      competitorName: displayCompetitor,
      isVerified: false,
      verifiedSummary: "Unverified competitor. Zero internal documentation exists.",
      differentiationAngle: "Do not guess or fabricate claims.",
      safeFallbackStatement: "I don't have verified information on that specific feature yet, so I don't want to guess. I can connect you with our solutions team to review that comparison."
    };
  }
}

export class CompetitorRagService {
  private static provider: CompetitorRagProvider = new LocalVerifiedCompetitorProvider();

  static setProvider(newProvider: CompetitorRagProvider) {
    this.provider = newProvider;
  }

  /**
   * Scans text for competitor mentions and returns verified evidence
   */
  static async detectAndRetrieve(
    text: string,
    knowledgeBase: string,
    objectionRules: string
  ): Promise<CompetitorEvidence | null> {
    const candidateCompetitors = [
      "salesforce",
      "hubspot",
      "outreach",
      "salesloft",
      "apollo",
      "zoominfo",
      "cognism",
      "gong",
      "clari",
      "pipedrive",
      "zoho"
    ];

    const lower = text.toLowerCase();
    const found = candidateCompetitors.find(c => new RegExp(`\\b${c}\\b`, "i").test(lower));

    if (!found) {
      // Check if user says generic "competitor" or "another tool"
      if (/\b(competitor|another vendor|another tool|current provider|different platform)\b/i.test(lower)) {
        return {
          competitorName: "unspecified competitor",
          isVerified: true,
          verifiedSummary: "Prospect mentioned an existing vendor.",
          differentiationAngle: "Politely acknowledge their current workflow and ask what gaps or manual friction they experience.",
          safeFallbackStatement: "I don't have verified information on that specific feature yet, so I don't want to guess."
        };
      }
      return null;
    }

    return await this.provider.lookupCompetitor(found, knowledgeBase, objectionRules);
  }

  /**
   * Generates prompt injection directives enforcing zero hallucination
   */
  static formatPromptDirectives(evidence: CompetitorEvidence | null): string {
    if (!evidence) return "";

    if (!evidence.isVerified) {
      return `\nCOMPETITOR RAG ALERT: Prospect mentioned an UNVERIFIED competitor (${evidence.competitorName}).
CRITICAL ZERO-HALLUCINATION RULE:
You do NOT have verified data on this competitor. You must strictly respond:
"${evidence.safeFallbackStatement}"
Never invent competitor pricing, weaknesses, or integration capabilities.`;
    }

    return `\nVERIFIED COMPETITOR EVIDENCE (${evidence.competitorName}):
- Verified Fact: ${evidence.verifiedSummary}
- Approved Angle: ${evidence.differentiationAngle}
- Fallback Rule: If asked about unverified features, state: "${evidence.safeFallbackStatement}".
Never fabricate competitor flaws, pricing, or proprietary claims.`;
  }
}
