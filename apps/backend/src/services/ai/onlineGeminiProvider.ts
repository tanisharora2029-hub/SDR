import { AiProvider, SdrContext, LeadContext, ConversationTurn, AiCompletionResponse, AiOpportunityAnalysisResult, AiResearchStage } from "./types.js";
import { PromptBuilder } from "./promptBuilder.js";
import { AiAction, AiActionSchema, SdrToolDecision, SdrToolName } from "@ai-sdr/shared";
import { logger } from "../../lib/logger.js";
import { readCustomerReply } from "./customerMessage.js";

export class OnlineGeminiProvider implements AiProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.model = process.env.ONLINE_GEMINI_MODEL || "gemini-3.1-flash-lite";
  }

  private async callGemini(systemPrompt: string, userPrompt: string): Promise<{ text: string; latencyMs: number }> {
    if (!this.apiKey.trim()) throw new Error("Gemini API key is not configured");
    const startTime = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    };

    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(9_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`Gemini API error [${res.status}]`);
    }

    const data: any = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text.trim()) throw new Error("Gemini returned no text");
    return { text, latencyMs };
  }

  public sanitizeReply(raw: string): string {
    let cleaned = readCustomerReply(raw);
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
    }

    if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.reply && typeof parsed.reply === "string") {
          return this.sanitizeReply(parsed.reply);
        }
        if (parsed.arguments?.body) {
          return this.sanitizeReply(parsed.arguments.body);
        }
      } catch {}
    }

    cleaned = cleaned.replace(/\{[\s\S]*?"tool"[\s\S]*?\}/gi, "").trim();
    cleaned = cleaned.replace(/\{[\s\S]*?"action"[\s\S]*?\}/gi, "").trim();
    cleaned = cleaned.replace(/send_email|create_calendar_event|create_followup|check_calendar_availability|human_handoff/gi, "").trim();

    if (!cleaned) {
      return "Thank you for your message. Could you share a bit more about your current sales process?";
    }
    return cleaned;
  }

  public parseAiAction(rawText: string, fallbackLeadId?: string): { action: AiAction; toolDecision: SdrToolDecision | null } {
    let parsedJson: any = null;
    const cleaned = rawText.trim().replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        parsedJson = JSON.parse(jsonMatch[0]);
      } catch {}
    }

    if (parsedJson) {
      if (parsedJson.tool && !parsedJson.action) {
        const isEmail = parsedJson.tool === "send_email";
        parsedJson = {
          intent: parsedJson.tool === "create_calendar_event" ? "meeting" :
                  parsedJson.tool === "human_handoff" ? "handoff" :
                  parsedJson.tool === "create_followup" ? "followup" :
                  isEmail ? "outreach" : "conversation",
          action: parsedJson.tool,
          reply: parsedJson.arguments?.body || parsedJson.arguments?.summary || "Thank you for your message.",
          reason: "Recovered from legacy tool decision format",
          tool_arguments: parsedJson.arguments || {},
          confidence: 0.9
        };
      }

      const validation = AiActionSchema.safeParse(parsedJson);
      if (validation.success) {
        const validatedAction = validation.data;
        validatedAction.reply = this.sanitizeReply(validatedAction.reply);

        let toolDecision: SdrToolDecision | null = null;
        if (
          validatedAction.action !== "reply" &&
          validatedAction.action !== "none" &&
          validatedAction.action !== "check_calendar"
        ) {
          toolDecision = {
            tool: validatedAction.action as SdrToolName,
            arguments: {
              lead_id: fallbackLeadId,
              ...validatedAction.tool_arguments
            }
          };
        }

        return { action: validatedAction, toolDecision };
      }
    }

    const fallbackReply = this.sanitizeReply(rawText);
    const fallbackAction: AiAction = {
      intent: "conversation",
      action: "reply",
      reply: fallbackReply,
      reason: "Safe conversational recovery from online model output",
      tool_arguments: {},
      confidence: 0.5
    };

    return { action: fallbackAction, toolDecision: null };
  }

  async generateOutreach(sdr: SdrContext, lead: LeadContext): Promise<AiCompletionResponse> {
    const systemPrompt = PromptBuilder.buildSystemPrompt(sdr, lead);
    const userPrompt = `TASK: Compose the initial cold outreach email for ${lead.firstName} ${lead.lastName}, ${lead.jobTitle || "Executive"} at ${lead.companyName}.
Requirements:
1. Set intent: "outreach".
2. Set action: "send_email".
3. Provide the full professional email text in "reply".
4. Set tool_arguments: { "lead_id": "${lead.leadId}", "subject": "<compelling subject>", "body": "<email body>" }.`;

    const { text, latencyMs } = await this.callGemini(systemPrompt, userPrompt);
    let { action, toolDecision } = this.parseAiAction(text, lead.leadId);

    if (action.intent !== "outreach") action.intent = "outreach";
    if (action.action !== "send_email") action.action = "send_email";

    if (!toolDecision) {
      toolDecision = {
        tool: "send_email",
        arguments: {
          lead_id: lead.leadId,
          subject: (action.tool_arguments?.subject as string) || `Introduction: ${sdr.organizationName} x ${lead.companyName}`,
          body: action.reply
        }
      };
    }

    return {
      content: action.reply,
      action,
      toolDecision,
      latencyMs,
      provider: `gemini-online (${this.model})`
    };
  }

  async respondToMessage(
    sdr: SdrContext,
    lead: LeadContext,
    history: ConversationTurn[],
    latestMessage: string
  ): Promise<AiCompletionResponse> {
    const systemPrompt = PromptBuilder.buildSystemPrompt(sdr, lead);
    const userPrompt = PromptBuilder.buildConversationPrompt(history, latestMessage);

    const { text, latencyMs } = await this.callGemini(systemPrompt, userPrompt);
    const { action, toolDecision } = this.parseAiAction(text, lead.leadId);

    return {
      content: action.reply,
      action,
      toolDecision,
      latencyMs,
      provider: `gemini-online (${this.model})`
    };
  }

  async qualifyLead(sdr: SdrContext, lead: LeadContext, history: ConversationTurn[]) {
    const systemPrompt = `You are an AI SDR qualification engine. Analyze the conversation history and output a JSON scorecard strictly matching:
{
  "status": "QUALIFIED" | "UNQUALIFIED" | "IN_CONVERSATION",
  "budget": "string description",
  "authority": "string description",
  "need": "string description",
  "timeline": "string description",
  "notes": "string summary"
}`;
    const userPrompt = `Prospect: ${lead.firstName} at ${lead.companyName}.
History:
${history.map(h => `${h.speaker}: ${h.content}`).join("\n")}`;

    const { text } = await this.callGemini(systemPrompt, userPrompt);
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}

    return {
      status: "IN_CONVERSATION" as const,
      budget: "Under evaluation",
      authority: "Evaluating decision role",
      need: "Evaluating business requirements",
      timeline: "To be determined",
      notes: text.slice(0, 300)
    };
  }

  async summarizeCall(transcript: Array<{ speaker: string; text: string }>, lead: LeadContext) {
    const systemPrompt = `You are an AI sales supervisor. Summarize this call transcript for ${lead.firstName} at ${lead.companyName}.
Output JSON:
{
  "summary": "1-2 sentence executive briefing",
  "qualificationScore": 0-100,
  "recommendedAction": "Actionable next step for sales rep"
}`;
    const userPrompt = transcript.map(t => `${t.speaker}: ${t.text}`).join("\n");
    const { text } = await this.callGemini(systemPrompt, userPrompt);
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}

    return {
      summary: `Call completed with ${lead.firstName}. Prospect engaged in discovery conversation.`,
      qualificationScore: 70,
      recommendedAction: "Follow up via email with product documentation and calendar invitation."
    };
  }

  async analyzeOpportunityContent(params: {
    company: string;
    domain: string;
    pages: Array<{ url: string; text: string; title?: string }>;
  }): Promise<AiOpportunityAnalysisResult> {
    const { company, domain, pages } = params;

    const systemPrompt = `You are an elite evidence-first operational auditor for MachineMind automation systems.
Analyze the provided real crawled website content for a company and identify evidence-backed operational bottlenecks.
Output valid JSON only.

EVALUATE BUSINESSES OF ALL SIZES EQUALLY:
- Actively evaluate Small Businesses (SMBs), startups, regional companies, and lean operations teams alongside mid-market and enterprise organizations.
- DO NOT penalize or reject companies because of small employee count.
- In small businesses, repetitive tasks (manual invoices/quotes/orders, spreadsheets, document processing, appointment/intake, CRM updates, or operations coordinator hiring) represent acute operational friction and prime automation opportunity.
- Evaluate by: OPERATIONAL PAIN × REPETITION × AUTOMATION FIT × BUSINESS IMPACT.
- Small business leaders: Owner, Founder, Co-Founder, CEO, President, Principal, Managing Director, Operations Manager, COO. Email must be null.

CRITICAL ANTI-HALLUCINATION RULES:
1. FACT: Must be verbatim or directly observed from the provided text with exact sourceUrl. Size alone is never evidence of a problem.
2. INFERENCE: Reasonable deduction strictly grounded in an observed fact.
3. UNKNOWN: Explicitly state unverified items.
4. DECISION MAKER: Only if explicitly listed on the pages with an operational/executive title. Email must be null.
5. If no clear operational bottleneck or insufficient text, set automationFit to "NONE", potentialProblem to "Insufficient evidence of operational bottleneck.", and facts to empty array.

JSON Schema:
{
  "industry": "string",
  "companySize": "string detected size (e.g. '1-15 employees', '10-50 employees', '50-250 employees', or 'Small to Mid-Sized Business')",
  "facts": [{ "observedFact": "...", "sourceUrl": "...", "category": "HIRING"|"PUBLIC_WORKFLOW"|"TECH_SIGNAL"|"DOCUMENTATION", "confidenceScore": 80-100 }],
  "signals": ["..."],
  "inferences": [{ "aiInference": "...", "basedOnFact": "...", "confidenceScore": 70-95 }],
  "unknowns": ["..."],
  "potentialProblem": "string",
  "whyItMatters": "string",
  "automationFit": "PERFECT"|"GOOD"|"PARTIAL"|"NONE",
  "recommendedSolution": "M-EXTRACT"|"M-FLOW"|"M-COPILOT"|"M-AGENTS"|"System Integration"|"Compliance",
  "workflow": ["1. Ingestion: ...", "2. Processing: ...", "3. Verification: ...", "4. Execution: ...", "5. Human escalation on exception"],
  "decisionMaker": { "name": "...", "title": "...", "sourceUrl": "..." } | null,
  "confidence": 0-100
}`;

    const contentDigest = pages.map((p, idx) => `PAGE ${idx + 1} [${p.url}] (${p.title || "Page"}):\n${p.text.slice(0, 1500)}`).join("\n\n---\n\n");
    const userPrompt = `Company: ${company} (${domain})\n\nResearched Website Content:\n${contentDigest}`;

    try {
      const { text } = await this.callGemini(systemPrompt, userPrompt);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          industry: parsed.industry || "B2B Operations",
          companySize: parsed.companySize || undefined,
          facts: Array.isArray(parsed.facts) ? parsed.facts : [],
          signals: Array.isArray(parsed.signals) ? parsed.signals : [],
          inferences: Array.isArray(parsed.inferences) ? parsed.inferences : [],
          unknowns: Array.isArray(parsed.unknowns) ? parsed.unknowns : [],
          potentialProblem: parsed.potentialProblem || "Insufficient evidence of operational bottleneck.",
          whyItMatters: parsed.whyItMatters || "No verified public bottleneck.",
          automationFit: parsed.automationFit || "PARTIAL",
          recommendedSolution: parsed.recommendedSolution || "M-FLOW",
          workflow: Array.isArray(parsed.workflow) ? parsed.workflow : [],
          decisionMaker: parsed.decisionMaker && parsed.decisionMaker.name ? {
            name: parsed.decisionMaker.name,
            title: parsed.decisionMaker.title || null,
            sourceUrl: parsed.decisionMaker.sourceUrl || null
          } : null,
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 75
        };
      }
    } catch (err: any) {
      logger.warn(`[OnlineGeminiProvider] Failed to analyze opportunity JSON: ${err.message}`);
    }

    return {
      industry: "B2B Operations",
      facts: [],
      signals: [],
      inferences: [],
      unknowns: ["Unable to parse structured analysis"],
      potentialProblem: "Insufficient evidence of operational bottleneck.",
      whyItMatters: "Public text analysis was inconclusive.",
      automationFit: "NONE",
      recommendedSolution: "N/A",
      workflow: [],
      decisionMaker: null,
      confidence: 0
    };
  }

  async analyzeOpportunityStage(
    stage: AiResearchStage,
    systemPrompt: string,
    userPrompt: string
  ): Promise<any> {
    const { text } = await this.callGemini(systemPrompt, userPrompt);
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (err: any) {
      logger.warn(`[GeminiProvider] Failed to parse ${stage} stage JSON: ${err.message}`);
    }
    return null;
  }
}
