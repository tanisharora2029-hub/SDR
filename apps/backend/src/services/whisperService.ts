import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { ToneMirroringService } from "./ai/toneMirroringService.js";
import { CompetitorRagService } from "./ai/competitorRagService.js";

export interface WhisperAssistDossier {
  callSid: string;
  leadId: string;
  leadName: string;
  companyName: string;
  jobTitle: string;
  detectedObjection: string;
  prospectSentiment: "urgent" | "skeptical" | "positive" | "neutral";
  intentScore: number;
  summary: string;
  recommendedTalkingPoints: string[];
  suggestedResponse: string;
  competitorMentioned: string | null;
  pricingConcernDetected: boolean;
  nextBestAction: string;
  isHumanTakeoverActive: boolean;
  updatedAt: string;
}

export class WhisperService {
  // In-memory telemetry cache for real-time live calls, backed by DB
  private static activeDossiers: Map<string, WhisperAssistDossier> = new Map();
  private static humanTakeovers: Set<string> = new Set();

  /**
   * Generates or updates live telemetry for human whisper assist
   */
  static async updateLiveWhisperAssist(
    organizationId: string,
    callSid: string,
    lastLeadUtterance: string,
    transcript: Array<{ speaker: string; text: string }>
  ): Promise<WhisperAssistDossier> {
    const session = await prisma.callSession.findUnique({
      where: { callSid },
      include: { lead: true }
    });

    const lead = session?.lead;
    const leadName = lead ? `${lead.firstName} ${lead.lastName}` : "Prospect";
    const company = lead?.companyName || "Unknown Company";
    const jobTitle = lead?.jobTitle || "Executive";

    // 1. Analyze Tone & Sentiment
    const tone = ToneMirroringService.analyzeTone(lastLeadUtterance, "voice");

    // 2. Detect Competitor mentions
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    const compEvidence = await CompetitorRagService.detectAndRetrieve(
      lastLeadUtterance,
      org?.knowledgeBase || "",
      org?.objectionRules || ""
    );

    // 3. Detect Pricing Concerns
    const isPricing = /\b(price|pricing|cost|expensive|budget|discount|tier|rate|quote)\b/i.test(lastLeadUtterance);

    // 4. Extract Objections
    let objection = "General inquiry";
    if (compEvidence) {
      objection = `Competitor mention (${compEvidence.competitorName})`;
    } else if (isPricing) {
      objection = "Pricing & Budget evaluation";
    } else if (/\b(not ready|timing|next quarter|later|busy)\b/i.test(lastLeadUtterance)) {
      objection = "Timing / Bandwidth constraint";
    }

    // 5. Talking Points & Suggested Rep Response
    const talkingPoints: string[] = [];
    let suggestedResponse = "";

    if (compEvidence) {
      talkingPoints.push(`Highlight ${compEvidence.differentiationAngle}`);
      talkingPoints.push("Clarify that we complement rather than abruptly displace their current stack");
      suggestedResponse = `I completely understand you're using ${compEvidence.competitorName}. A lot of teams we work with do as well, but use NexSDR to automate the manual follow-up layer. Would it make sense to review a 10-minute workflow map?`;
    } else if (isPricing) {
      talkingPoints.push("Reiterate transparent tiers: Starter $79/mo, Growth $199/mo");
      talkingPoints.push("Emphasize ROI and immediate pipeline efficiency within 14 days");
      suggestedResponse = "Our plans start at $79/mo for standard outbound and $199 for high-volume cadences. Are you looking to empower a specific team or test with a pilot group?";
    } else {
      talkingPoints.push(`Acknowledge ${leadName}'s priority at ${company}`);
      talkingPoints.push("Offer brief discovery demo or technical executive walkthrough");
      suggestedResponse = `That makes total sense, ${leadName}. We've helped similar teams solve that exact friction. Would next Tuesday or Wednesday suit you for a quick 15-minute walkthrough?`;
    }

    const turnsCount = transcript.length;
    const summary = turnsCount > 0
      ? `Active live dialogue with ${leadName} (${company}). Latest prospect focus: "${lastLeadUtterance.slice(0, 80)}..."`
      : `Live call initiated with ${leadName}.`;

    const dossier: WhisperAssistDossier = {
      callSid,
      leadId: lead?.id || "",
      leadName,
      companyName: company,
      jobTitle,
      detectedObjection: objection,
      prospectSentiment: tone.profile.urgencyOrSentiment,
      intentScore: lead?.intentScore || 50,
      summary,
      recommendedTalkingPoints: talkingPoints,
      suggestedResponse,
      competitorMentioned: compEvidence ? compEvidence.competitorName : null,
      pricingConcernDetected: isPricing,
      nextBestAction: isPricing ? "Offer transparent tier overview" : "Secure 15-min discovery demo",
      isHumanTakeoverActive: this.humanTakeovers.has(callSid),
      updatedAt: new Date().toISOString()
    };

    this.activeDossiers.set(callSid, dossier);
    logger.info(`[Whisper Mode] Updated live telemetry dossier for call ${callSid}`);
    return dossier;
  }

  /**
   * Toggles human representative takeover.
   * When true, AI is strictly silenced from speaking to the prospect.
   */
  static setTakeover(callSid: string, isTakenOver: boolean): boolean {
    if (isTakenOver) {
      this.humanTakeovers.add(callSid);
      logger.info(`[Whisper Mode] Human rep TAKEOVER activated for call ${callSid}. AI muted.`);
    } else {
      this.humanTakeovers.delete(callSid);
      logger.info(`[Whisper Mode] Human rep relinquished control for call ${callSid}. AI active.`);
    }

    const dossier = this.activeDossiers.get(callSid);
    if (dossier) {
      dossier.isHumanTakeoverActive = isTakenOver;
      dossier.updatedAt = new Date().toISOString();
    }
    return isTakenOver;
  }

  static isTakeoverActive(callSid: string): boolean {
    return this.humanTakeovers.has(callSid);
  }

  static getDossier(callSid: string): WhisperAssistDossier | null {
    return this.activeDossiers.get(callSid) || null;
  }
}
