import { AiProvider, SdrContext, LeadContext, ConversationTurn, AiCompletionResponse } from "./types.js";
import { MockAiProvider } from "./mockProvider.js";
import { OllamaProvider } from "./ollamaProvider.js";
import { OnlineGeminiProvider } from "./onlineGeminiProvider.js";
import { ToneMirroringService } from "./toneMirroringService.js";
import { CompetitorRagService } from "./competitorRagService.js";
import { CostRouter } from "./costRouter.js";
import { logger } from "../../lib/logger.js";

class AiService {
  private primaryProvider: AiProvider;
  private fallbackProvider: AiProvider;
  private voiceProvider: AiProvider;

  constructor() {
    this.fallbackProvider = new MockAiProvider();

    const providerType = process.env.AI_PROVIDER || "ollama";
    if (providerType === "online") {
      this.primaryProvider = new OnlineGeminiProvider();
    } else if (providerType === "ollama") {
      this.primaryProvider = new OllamaProvider();
    } else {
      this.primaryProvider = new MockAiProvider();
    }

    // Default voice pipeline to ONLINE cloud model (Gemini Flash) to decouple from local GPU during voice testing
    const voiceProviderType = process.env.VOICE_AI_PROVIDER || "online";
    if (voiceProviderType === "ollama") {
      this.voiceProvider = new OllamaProvider();
    } else {
      this.voiceProvider = new OnlineGeminiProvider();
    }

    logger.info(`AI Brain Service initialized: primary=${providerType}, voice=${voiceProviderType}`);
  }

  /**
   * Dedicated method for voice telephony dialogue (defaults to ONLINE cloud model)
   * Integrates Zero-Shot Tone Mirroring and Competitor RAG with zero hallucination.
   */
  async respondToVoiceMessage(
    sdr: SdrContext,
    lead: LeadContext,
    history: ConversationTurn[],
    latestMessage: string
  ): Promise<AiCompletionResponse> {
    try {
      // 1. Zero-Shot Tone Mirroring
      const tone = ToneMirroringService.analyzeTone(latestMessage, "voice");

      // 2. Competitor RAG
      const compEvidence = await CompetitorRagService.detectAndRetrieve(
        latestMessage,
        sdr.knowledgeBase || "",
        sdr.objectionRules || ""
      );
      const compDirective = CompetitorRagService.formatPromptDirectives(compEvidence);

      const enhancedSdr: SdrContext = {
        ...sdr,
        customInstructions: `${sdr.customInstructions || ""}\n\n${tone.promptDirective}${compDirective}`
      };

      return await this.voiceProvider.respondToMessage(enhancedSdr, lead, history, latestMessage);
    } catch (err: any) {
      logger.warn(`Voice online provider failed, falling back to primary/mock: ${err.message}`);
      return await this.fallbackProvider.respondToMessage(sdr, lead, history, latestMessage);
    }
  }

  async generateOutreach(sdr: SdrContext, lead: LeadContext): Promise<AiCompletionResponse> {
    const decision = CostRouter.routeTask("EMAIL_DRAFTING");
    logger.info(`[CostRouter] generateOutreach routed to ${decision.selectedProvider} (${decision.reason})`);

    const provider = decision.selectedProvider === "gemini-online" ? this.voiceProvider : this.primaryProvider;

    try {
      return await provider.generateOutreach(sdr, lead);
    } catch (err: any) {
      logger.warn(`Primary AI provider failed, falling back to mock provider: ${err.message}`);
      return await this.fallbackProvider.generateOutreach(sdr, lead);
    }
  }

  async respondToMessage(
    sdr: SdrContext,
    lead: LeadContext,
    history: ConversationTurn[],
    latestMessage: string
  ): Promise<AiCompletionResponse> {
    try {
      // 1. Zero-Shot Tone Mirroring for Email / Text
      const tone = ToneMirroringService.analyzeTone(latestMessage, "email");

      // 2. Competitor RAG
      const compEvidence = await CompetitorRagService.detectAndRetrieve(
        latestMessage,
        sdr.knowledgeBase || "",
        sdr.objectionRules || ""
      );
      const compDirective = CompetitorRagService.formatPromptDirectives(compEvidence);

      const enhancedSdr: SdrContext = {
        ...sdr,
        customInstructions: `${sdr.customInstructions || ""}\n\n${tone.promptDirective}${compDirective}`
      };

      const decision = CostRouter.routeTask("EMAIL_DRAFTING");
      const provider = decision.selectedProvider === "gemini-online" ? this.voiceProvider : this.primaryProvider;

      return await provider.respondToMessage(enhancedSdr, lead, history, latestMessage);
    } catch (err: any) {
      logger.warn(`Primary AI provider failed, falling back to mock provider: ${err.message}`);
      return await this.fallbackProvider.respondToMessage(sdr, lead, history, latestMessage);
    }
  }

  async qualifyLead(sdr: SdrContext, lead: LeadContext, history: ConversationTurn[]) {
    const decision = CostRouter.routeTask("LEAD_SCORING");
    const provider = decision.selectedProvider === "gemini-online" ? this.voiceProvider : this.primaryProvider;

    try {
      return await provider.qualifyLead(sdr, lead, history);
    } catch (err: any) {
      return await this.fallbackProvider.qualifyLead(sdr, lead, history);
    }
  }

  async summarizeCall(transcript: Array<{ speaker: string; text: string }>, lead: LeadContext) {
    const decision = CostRouter.routeTask("SUMMARIZATION");
    const provider = decision.selectedProvider === "gemini-online" ? this.voiceProvider : this.primaryProvider;

    try {
      return await provider.summarizeCall(transcript, lead);
    } catch (err: any) {
      return await this.fallbackProvider.summarizeCall(transcript, lead);
    }
  }
}

export const aiService = new AiService();