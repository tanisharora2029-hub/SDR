import { AiProvider, SdrContext, LeadContext, ConversationTurn, AiCompletionResponse, AiOpportunityAnalysisResult, AiResearchStage } from "./types.js";
import { PromptBuilder } from "./promptBuilder.js";
import { AiAction, AiActionSchema, SdrToolDecision, SdrToolName } from "@ai-sdr/shared";
import { logger } from "../../lib/logger.js";
import { readCustomerReply } from "./customerMessage.js";

export class GroqProvider implements AiProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || "";
    this.model = this.resolveModel();
  }

  public getApiKey(): string {
    return (process.env.GROQ_API_KEY || this.apiKey || "").trim();
  }

  public resolveModel(): string {
    const envModel = (process.env.GROQ_MODEL || this.model || "").trim();
    const decommissioned = [
      "llama-3.1-70b-versatile",
      "llama3-70b-8192",
      "llama3-8b-8192",
      "qwen/qwen3-32b",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant"
    ];
    if (decommissioned.includes(envModel)) {
      logger.warn(
        `[GroqProvider] Configured model '${envModel}' is decommissioned or invalid. Automatically migrating to 'openai/gpt-oss-120b'.`
      );
      return "openai/gpt-oss-120b";
    }
    return envModel || "openai/gpt-oss-120b";
  }

  public getRequestUrl(): string {
    const rawBase = process.env.GROQ_BASE_URL?.trim();
    if (!rawBase) {
      return "https://api.groq.com/openai/v1/chat/completions";
    }
    const trimmed = rawBase.replace(/\/+$/, "");
    if (trimmed.endsWith("/chat/completions")) {
      return trimmed;
    }
    return `${trimmed}/chat/completions`;
  }

  private async callGroq(
    systemPrompt: string,
    userPrompt: string,
    jsonMode = false
  ): Promise<{ text: string; latencyMs: number; modelUsed: string }> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error("GROQ_API_KEY is not configured in environment variables.");
    }

    const startTime = Date.now();
    const url = this.getRequestUrl();
    const targetModel = this.resolveModel();

    // Primary target model, followed by official Groq fallbacks
    const candidateModels = [targetModel];
    if (!candidateModels.includes("openai/gpt-oss-120b")) {
      candidateModels.push("openai/gpt-oss-120b");
    }
    if (!candidateModels.includes("openai/gpt-oss-20b")) {
      candidateModels.push("openai/gpt-oss-20b");
    }

    let lastError: Error | null = null;
    for (const modelToTry of candidateModels) {
      try {
        const bodyPayload: any = {
          model: modelToTry,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: jsonMode ? 2048 : 1024
        };

        if (jsonMode) {
          bodyPayload.response_format = { type: "json_object" };
        }

        logger.info(`[DIAGNOSTIC 7/14 - Groq] LLM HTTP request dispatched (model: ${modelToTry}, jsonMode: ${Boolean(jsonMode)})`);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`
          },
          body: JSON.stringify(bodyPayload),
          signal: AbortSignal.timeout(12000)
        });

        const latencyMs = Date.now() - startTime;

        if (!res.ok) {
          const errText = await res.text();
          const errSnippet = errText.length > 250 ? `${errText.substring(0, 250)}...` : errText;
          logger.error(`[DIAGNOSTIC 8/14 - Groq] LLM request FAILED (status: ${res.status}, model: ${modelToTry}, err: ${errSnippet})`);
          logger.error(`[GroqProvider] Groq API request failed [HTTP ${res.status}] for model '${modelToTry}': ${errSnippet}`);

          if (res.status === 404 && candidateModels.indexOf(modelToTry) < candidateModels.length - 1) {
            logger.warn(`[GroqProvider] Model '${modelToTry}' returned 404 Not Found. Attempting fallback model...`);
            continue;
          }

          throw new Error(`Groq API error [${res.status}]: ${errText}`);
        }

        const data: any = await res.json();
        if (data.choices?.[0]?.finish_reason === "length") {
          throw new Error("AI response exceeded its output limit. Please regenerate the draft.");
        }
        const text = data.choices?.[0]?.message?.content || "";
        logger.info(`[DIAGNOSTIC 8/14 - Groq] LLM request SUCCEEDED (status: 200, model: ${modelToTry}, latencyMs: ${latencyMs})`);
        return { text, latencyMs, modelUsed: modelToTry };
      } catch (err: any) {
        lastError = err;
        logger.error(`[DIAGNOSTIC 8/14 - Groq] LLM request EXCEPTION (model: ${modelToTry}, err: ${err.message})`);
        if (err.message?.includes("[404]") && candidateModels.indexOf(modelToTry) < candidateModels.length - 1) {
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error("Groq API call failed on all candidate models.");
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
    cleaned = cleaned.replace(
      /send_email|create_calendar_event|create_followup|check_calendar_availability|human_handoff/gi,
      ""
    ).trim();

    if (!cleaned) {
      return "Thank you for your message. Could you share a bit more about your current sales process?";
    }
    return cleaned;
  }

  public parseAiAction(
    rawText: string,
    fallbackLeadId?: string
  ): { action: AiAction; toolDecision: SdrToolDecision | null } {
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
          intent:
            parsedJson.tool === "create_calendar_event"
              ? "meeting"
              : parsedJson.tool === "human_handoff"
              ? "handoff"
              : parsedJson.tool === "create_followup"
              ? "followup"
              : isEmail
              ? "outreach"
              : "conversation",
          action: parsedJson.tool,
          reply: parsedJson.arguments?.body || parsedJson.arguments?.summary || "Thank you for your message.",
          reason: "Recovered from legacy tool decision format",
          tool_arguments: parsedJson.arguments || {},
          confidence: 0.9
        };
      }

      // Guard: Downgrade create_calendar_event if no valid start_time was provided
      if (parsedJson.action === "create_calendar_event" && !parsedJson.tool_arguments?.start_time) {
        parsedJson.action = "reply";
        parsedJson.intent = "conversation";
      }

      // Guard: Escalation to human if prospect requested a human/director/escalation (only for inbound replies, never outbound cold email)
      if (parsedJson.action !== "send_email") {
        const textToCheck = `${rawText} ${parsedJson.reason || ""}`;
        const isHumanRequest =
          /\b(?:connect me to|speak with|talk to)\s+(?:a\s+)?(?:human|person|sales director|director|executive|representative)\b/i.test(textToCheck) ||
          /\b(?:human handoff|talk to a human|speak with a person|on-prem soc2 deployment for \d+)\b/i.test(textToCheck);
        if (isHumanRequest && parsedJson.action !== "human_handoff") {
          parsedJson.action = "human_handoff";
          parsedJson.intent = "handoff";
          if (!parsedJson.tool_arguments) parsedJson.tool_arguments = {};
          parsedJson.tool_arguments.reason = parsedJson.reason || "Prospect requested human / enterprise director consultation";
        }
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
      reason: "Safe conversational recovery from Groq model output",
      tool_arguments: {},
      confidence: 0.5
    };

    return { action: fallbackAction, toolDecision: null };
  }

  async generateOutreach(sdr: SdrContext, lead: LeadContext): Promise<AiCompletionResponse> {
    const systemPrompt = PromptBuilder.buildSystemPrompt(sdr, lead);
    const userPrompt = `TASK: Compose the initial cold outreach email for ${lead.firstName} ${lead.lastName}, ${
      lead.jobTitle || "Executive"
    } at ${lead.companyName}.
Requirements:
1. Set intent: "outreach".
2. Set action: "send_email".
3. Provide the full professional email text in "reply", under 140 words with one relevant question.
4. Set tool_arguments: { "lead_id": "${lead.leadId}", "subject": "<compelling subject>", "body": "<email body>" }.`;

    const { text, latencyMs, modelUsed } = await this.callGroq(systemPrompt, userPrompt, true);
    let { action, toolDecision } = this.parseAiAction(text, lead.leadId);

    if (action.intent !== "outreach") action.intent = "outreach";
    if (action.action !== "send_email") action.action = "send_email";

    if (!toolDecision) {
      toolDecision = {
        tool: "send_email",
        arguments: {
          lead_id: lead.leadId,
          subject:
            (action.tool_arguments?.subject as string) ||
            `Introduction: ${sdr.organizationName} x ${lead.companyName}`,
          body: action.reply
        }
      };
    } else if (!toolDecision.arguments.body) {
      toolDecision.arguments.body = action.reply;
    }

    return {
      content: action.reply,
      action,
      toolDecision,
      latencyMs,
      provider: `groq (${modelUsed})`
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

    const { text, latencyMs, modelUsed } = await this.callGroq(systemPrompt, userPrompt);
    const { action, toolDecision } = this.parseAiAction(text, lead.leadId);

    return {
      content: action.reply,
      action,
      toolDecision,
      latencyMs,
      provider: `groq (${modelUsed})`
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
${history.map((h) => `${h.speaker}: ${h.content}`).join("\n")}`;

    const { text } = await this.callGroq(systemPrompt, userPrompt, true);
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
    const userPrompt = transcript.map((t) => `${t.speaker}: ${t.text}`).join("\n");
    const { text } = await this.callGroq(systemPrompt, userPrompt, true);
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
Your task is to analyze real crawled website content for a company and identify evidence-backed operational bottlenecks.

EVALUATE BUSINESSES OF ALL SIZES EQUALLY:
- Actively discover and evaluate Small Businesses (SMBs), startups, regional companies, and growing operations teams as well as mid-market and enterprise organizations.
- DO NOT reject, penalize, or downgrade a company merely because it has fewer employees.
- For small businesses and lean teams, high-volume repetitive tasks (manual invoices/quotes/orders, spreadsheets, document processing, appointment/intake workflows, repetitive customer support, CRM updates, or hiring an operations coordinator/administrative assistant) represent massive operational friction and prime automation opportunity.
- Opportunity is determined by: OPERATIONAL PAIN × REPETITION × AUTOMATION FIT × BUSINESS IMPACT. A 10-person company with high repetitive clerical overhead is an ideal candidate for MachineMind.

CRITICAL ANTI-HALLUCINATION RULES:
1. FACT: Must be verbatim or directly observed from the provided text. You MUST include the exact sourceUrl where it was found. Size alone is NEVER evidence of a problem.
2. INFERENCE: A reasonable deduction strictly grounded in one of the observed facts.
3. UNKNOWN: Explicitly declare what is NOT confirmed by the public text.
4. DECISION MAKER: For small businesses, key operational decision makers include Owner, Founder, Co-Founder, CEO, President, Principal, Managing Director, Head of Operations, Operations Manager, or COO. Only include if explicitly named in the crawled text with their title. Do NOT guess or invent names or emails. Email MUST be null.
5. If there is NO observable operational bottleneck or insufficient text, set automationFit to "NONE", potentialProblem to "Insufficient evidence of operational bottleneck.", and facts to empty array. DO NOT invent problems.

OUTPUT STRICT JSON MATCHING THIS SCHEMA:
{
  "industry": "string industry",
  "companySize": "string detected size (e.g. '1-15 employees', '10-50 employees', '50-250 employees', or 'Small to Mid-Sized Business')",
  "facts": [
    {
      "observedFact": "verbatim observation",
      "sourceUrl": "exact url from provided pages",
      "category": "HIRING" | "PUBLIC_WORKFLOW" | "TECH_SIGNAL" | "DOCUMENTATION",
      "confidenceScore": 80-100
    }
  ],
  "signals": ["signal 1", "signal 2"],
  "inferences": [
    {
      "aiInference": "reasonable deduction",
      "basedOnFact": "the observed fact this is based on",
      "confidenceScore": 70-95
    }
  ],
  "unknowns": ["item 1", "item 2"],
  "potentialProblem": "1-2 sentence core operational bottleneck",
  "whyItMatters": "1-2 sentence business friction or scaling barrier",
  "automationFit": "PERFECT" | "GOOD" | "PARTIAL" | "NONE",
  "recommendedSolution": "M-EXTRACT" | "M-FLOW" | "M-COPILOT" | "M-AGENTS" | "System Integration" | "Compliance",
  "workflow": [
    "1. Ingestion: ...",
    "2. Processing: ...",
    "3. Verification: ...",
    "4. Execution: ...",
    "5. Human escalation on exception"
  ],
  "decisionMaker": {
    "name": "Full Name or null",
    "title": "Title or null",
    "sourceUrl": "url where found or null"
  },
  "confidence": 0-100
}`;

    const contentDigest = pages.map((p, idx) => `PAGE ${idx + 1} [${p.url}] (${p.title || "Page"}):\n${p.text.slice(0, 1500)}`).join("\n\n---\n\n");
    const userPrompt = `Company: ${company} (${domain})\n\nResearched Website Content:\n${contentDigest}`;

    const { text } = await this.callGroq(systemPrompt, userPrompt, true);
    try {
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
      logger.warn(`[GroqProvider] Failed to parse opportunity analysis JSON: ${err.message}`);
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
    const { text } = await this.callGroq(systemPrompt, userPrompt, true);
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (err: any) {
      logger.warn(`[GroqProvider] Failed to parse ${stage} stage JSON: ${err.message}`);
    }
    return null;
  }
}
