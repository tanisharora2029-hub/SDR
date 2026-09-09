import { AiProvider, SdrContext, LeadContext, ConversationTurn, AiCompletionResponse } from "./types.js";
import { MockAiProvider } from "./mockProvider.js";
import { OllamaProvider } from "./ollamaProvider.js";
import { OnlineGeminiProvider } from "./onlineGeminiProvider.js";
import { GroqProvider } from "./groqProvider.js";
import { ToneMirroringService } from "./toneMirroringService.js";
import { CompetitorRagService } from "./competitorRagService.js";
import { CostRouter, RoutingDecision } from "./costRouter.js";
import { logger } from "../../lib/logger.js";

class AiService {
  private primaryProvider: AiProvider;
  private fallbackProvider: AiProvider;
  private voiceProvider: AiProvider;
  private groqProvider: AiProvider;

  constructor() {
    this.fallbackProvider = new MockAiProvider();
    this.groqProvider = new GroqProvider();

    // Auto-detect Groq if explicitly requested OR if GROQ_API_KEY is configured
    const hasGroqKey = !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0;
    const hasGeminiKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0;
    const providerType = process.env.AI_PROVIDER || (hasGroqKey ? "groq" : "ollama");

    if (providerType === "groq" || (hasGroqKey && providerType !== "mock")) {
      this.primaryProvider = this.groqProvider;
    } else if (providerType === "online") {
      this.primaryProvider = new OnlineGeminiProvider();
    } else if (providerType === "ollama") {
      this.primaryProvider = new OllamaProvider();
    } else {
      this.primaryProvider = new MockAiProvider();
    }

    // Voice pipeline defaults to Groq when Gemini key is not configured
    const voiceProviderType = process.env.VOICE_AI_PROVIDER || (hasGeminiKey ? "online" : (hasGroqKey ? "groq" : "online"));
    if (voiceProviderType === "groq" || (!hasGeminiKey && hasGroqKey)) {
      this.voiceProvider = this.groqProvider;
    } else if (voiceProviderType === "ollama") {
      this.voiceProvider = new OllamaProvider();
    } else {
      this.voiceProvider = new OnlineGeminiProvider();
    }

    logger.info(`AI Brain Service initialized: primary=${providerType}, voice=${voiceProviderType}`);
  }

  private getProviderForDecision(decision: RoutingDecision): AiProvider {
    if (decision.selectedProvider === "groq-online") {
      return this.groqProvider;
    }
    if (decision.selectedProvider === "gemini-online") {
      return this.voiceProvider;
    }
    return this.primaryProvider;
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
      logger.warn(`[AI_VOICE_FALLBACK] Voice online provider failed: ${err.message}`);
      const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
      if (hasGroqKey && this.voiceProvider !== this.groqProvider) {
        try {
          logger.info("[AI_VOICE_FALLBACK] Attempting Groq provider for voice...");
          return await this.groqProvider.respondToMessage(sdr, lead, history, latestMessage);
        } catch (groqErr: any) {
          logger.warn(`[AI_VOICE_FALLBACK] Groq voice fallback also failed: ${groqErr.message}`);
        }
      }
      const mockRes = await this.fallbackProvider.respondToMessage(sdr, lead, history, latestMessage);
      return {
        ...mockRes,
        provider: `mock (fallback: ${err.message})`
      };
    }
  }

  async generateOutreach(sdr: SdrContext, lead: LeadContext): Promise<AiCompletionResponse> {
    const decision = CostRouter.routeTask("EMAIL_DRAFTING");
    logger.info(`[CostRouter] generateOutreach routed to ${decision.selectedProvider} (${decision.reason})`);

    const provider = this.getProviderForDecision(decision);

    try {
      return await provider.generateOutreach(sdr, lead);
    } catch (err: any) {
      logger.warn(`[AI_OUTREACH_FALLBACK] Primary AI provider failed: ${err.message}`);
      const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
      if (hasGroqKey && provider !== this.groqProvider) {
        try {
          logger.info("[AI_OUTREACH_FALLBACK] Attempting Groq provider for outreach...");
          return await this.groqProvider.generateOutreach(sdr, lead);
        } catch (groqErr: any) {
          logger.warn(`[AI_OUTREACH_FALLBACK] Groq outreach fallback also failed: ${groqErr.message}`);
        }
      }
      const mockRes = await this.fallbackProvider.generateOutreach(sdr, lead);
      return {
        ...mockRes,
        provider: `mock (fallback: ${err.message})`
      };
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
      const provider = this.getProviderForDecision(decision);

      logger.info("[AI_DIAGNOSTICS] Inbound reply processing", {
        organizationId: sdr.organizationId,
        leadId: lead.leadId,
        leadName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "[Unknown]",
        companyName: lead.companyName || "[Unknown]",
        selectedProvider: decision.selectedProvider,
        historyTurns: history.length,
        latestMessageSnippet: latestMessage.substring(0, 100)
      });

      const response = await provider.respondToMessage(enhancedSdr, lead, history, latestMessage);

      logger.info("[AI_DIAGNOSTICS] Response generated", {
        organizationId: sdr.organizationId,
        leadId: lead.leadId,
        intent: response.action?.intent,
        action: response.action?.action,
        latencyMs: response.latencyMs,
        responseSnippet: response.content.substring(0, 100)
      });

      return response;
    } catch (err: any) {
      logger.warn(`[AI_CHAT_FALLBACK] Primary AI provider failed: ${err.message}`);
      const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
      if (hasGroqKey) {
        try {
          logger.info("[AI_CHAT_FALLBACK] Attempting Groq provider for chat...");
          return await this.groqProvider.respondToMessage(sdr, lead, history, latestMessage);
        } catch (groqErr: any) {
          logger.warn(`[AI_CHAT_FALLBACK] Groq chat fallback also failed: ${groqErr.message}`);
        }
      }
      const mockRes = await this.fallbackProvider.respondToMessage(sdr, lead, history, latestMessage);
      return {
        ...mockRes,
        provider: `mock (fallback: ${err.message})`
      };
    }
  }

  async qualifyLead(sdr: SdrContext, lead: LeadContext, history: ConversationTurn[]) {
    const decision = CostRouter.routeTask("LEAD_SCORING");
    const provider = this.getProviderForDecision(decision);

    try {
      return await provider.qualifyLead(sdr, lead, history);
    } catch (err: any) {
      return await this.fallbackProvider.qualifyLead(sdr, lead, history);
    }
  }

  async summarizeCall(transcript: Array<{ speaker: string; text: string }>, lead: LeadContext) {
    const decision = CostRouter.routeTask("SUMMARIZATION");
    const provider = this.getProviderForDecision(decision);

    try {
      return await provider.summarizeCall(transcript, lead);
    } catch (err: any) {
      return await this.fallbackProvider.summarizeCall(transcript, lead);
    }
  }
}

export const aiService = new AiService();