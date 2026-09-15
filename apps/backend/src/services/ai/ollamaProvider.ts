import { AiProvider, SdrContext, LeadContext, ConversationTurn, AiCompletionResponse, AiOpportunityAnalysisResult } from "./types.js";
import { PromptBuilder } from "./promptBuilder.js";
import { SdrToolDecision, SdrToolName, AiAction, AiActionSchema } from "@ai-sdr/shared";
import { logger } from "../../lib/logger.js";

export class OllamaProvider implements AiProvider {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    this.model = process.env.OLLAMA_MODEL || "qwen2.5:3b";
  }

  private async callOllama(
    system: string,
    prompt: string,
    opts?: { num_predict?: number; temperature?: number }
  ): Promise<{ text: string; latencyMs: number; tokens: number }> {
    const startTime = Date.now();
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        system,
        prompt,
        stream: false,
        format: "json", // Structured JSON mode
        options: {
          temperature: opts?.temperature ?? 0.1, // Deterministic low temperature for structured action decisions
          num_predict: opts?.num_predict ?? 400
        }
      })
    });


    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
    }

    const data: any = await response.json();
    const latencyMs = Date.now() - startTime;
    return {
      text: data.response || "",
      latencyMs,
      tokens: data.eval_count || 0
    };
  }

  /**
   * Sanitizes reply text to guarantee that raw JSON, tool names, schemas,
   * markdown code blocks, or thinking blocks can NEVER leak to the prospect.
   */
  private sanitizeReply(rawReply: string): string {
    if (!rawReply || typeof rawReply !== "string") {
      return "Thank you for reaching out. How can I best assist your team today?";
    }

    let cleaned = rawReply.trim();

    // 1. Strip markdown fences (e.g. ```json ... ```)
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();

    // 2. Check if the text itself is raw JSON or contains a tool call
    if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
      try {
        const parsed = JSON.parse(cleaned);
        // If it has a reply field, extract it
        if (parsed.reply && typeof parsed.reply === "string") {
          return this.sanitizeReply(parsed.reply);
        }
        // If it was a legacy tool call like {"tool": "send_email", "arguments": {"body": "..."}}
        if (parsed.arguments?.body) {
          return this.sanitizeReply(parsed.arguments.body);
        }
        if (parsed.body) {
          return this.sanitizeReply(parsed.body);
        }
        // If no clean text is found inside JSON
        return "Thank you for sharing that context. Could you elaborate on your current process so we can review the best approach?";
      } catch {
        // Not valid JSON, continue with regex cleanup
      }
    }

    // 3. Strip any embedded {"tool": ...} substrings
    cleaned = cleaned.replace(/\{[\s\S]*?"tool"[\s\S]*?\}/gi, "").trim();
    cleaned = cleaned.replace(/\{[\s\S]*?"action"[\s\S]*?\}/gi, "").trim();

    // 4. Strip internal tool syntax leaks
    cleaned = cleaned.replace(/send_email|create_calendar_event|create_followup|check_calendar_availability|human_handoff/gi, "").trim();

    // 5. Final fallback if empty
    if (!cleaned) {
      return "Thank you for your message. How can I best help you evaluate our capabilities?";
    }

    return cleaned;
  }

  /**
   * Parses and validates raw LLM output against the canonical AiActionSchema.
   * Employs safe repair and never throws unhandled errors.
   */
  public parseAiAction(rawText: string, fallbackLeadId?: string): { action: AiAction; toolDecision: SdrToolDecision | null } {
    let parsedJson: any = null;

    // 1. Try to find JSON block
    const cleaned = rawText.trim().replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        parsedJson = JSON.parse(jsonMatch[0]);
      } catch {
        try {
          // Attempt repair of unescaped control characters/newlines inside JSON strings
          const repaired = jsonMatch[0].replace(/[\u0000-\u001F]+/g, (c) => {
            if (c === "\n") return "\\n";
            if (c === "\r") return "\\r";
            if (c === "\t") return "\\t";
            return "";
          });
          parsedJson = JSON.parse(repaired);
        } catch {
          // Try extracting reply/body fields directly via regex
          const replyMatch = jsonMatch[0].match(/"(?:reply|body)"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|"\s*})/);
          if (replyMatch) {
            parsedJson = {
              intent: "outreach",
              action: "send_email",
              reply: replyMatch[1].replace(/\\n/g, "\n"),
              confidence: 0.9
            };
          }
        }
      }
    }

    // 2. If valid JSON found, validate against canonical schema
    if (parsedJson) {
      // If legacy format {"tool": "...", "arguments": { ... }}
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

        // Map actionable tools
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

    // 3. Safe fallback if model output completely unparseable
    logger.warn("Ollama output failed strict JSON validation. Using safe conversational fallback.");
    const fallbackReply = this.sanitizeReply(rawText);

    // Check if raw output or request was an enterprise / human escalation
    const isHumanRequestFallback =
      /\b(?:connect me to|speak with|talk to)\s+(?:a\s+)?(?:human|person|sales director|director|executive|representative)\b/i.test(rawText) ||
      /\b(?:human handoff|talk to a human|speak with a person|enterprise sales director|on-prem soc2 deployment)\b/i.test(rawText);

    if (isHumanRequestFallback) {
      const handoffAction: AiAction = {
        intent: "handoff",
        action: "human_handoff",
        reply: fallbackReply || "I understand. I am connecting you directly with our solutions team to review your specific requirements.",
        reason: "Prospect requested enterprise / human consultation",
        tool_arguments: { reason: "Prospect requested enterprise / human consultation" },
        confidence: 0.95
      };
      return {
        action: handoffAction,
        toolDecision: {
          tool: "human_handoff",
          arguments: {
            lead_id: fallbackLeadId,
            reason: "Prospect requested enterprise / human consultation"
          }
        }
      };
    }

    const fallbackAction: AiAction = {
      intent: "conversation",
      action: "reply",
      reply: fallbackReply,
      reason: "Safe fallback from unparseable raw model output",
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

    const { text, latencyMs, tokens } = await this.callOllama(systemPrompt, userPrompt);
    let { action, toolDecision } = this.parseAiAction(text, lead.leadId);

    // Guarantee outreach semantics for the initial cold email action
    if (action.intent !== "outreach") {
      action.intent = "outreach";
    }
    if (action.action !== "send_email") {
      action.action = "send_email";
    }
    if (!toolDecision) {
      toolDecision = {
        tool: "send_email",
        arguments: {
          lead_id: lead.leadId,
          subject: (action.tool_arguments?.subject as string) || `Introduction: ${sdr.organizationName} x ${lead.companyName}`,
          body: action.reply
        }
      };
    } else if (!toolDecision.arguments.body) {
      toolDecision.arguments.body = action.reply;
    }

    // Ensure the outreach mentions the SDR's organization
    if (sdr.organizationName && !action.reply.includes(sdr.organizationName)) {
      action.reply = `Hi ${lead.firstName || "there"},\n\nI wanted to introduce ${sdr.organizationName}. ${sdr.valueProposition || ""}\n\n${action.reply}\n\nBest regards,\n${sdr.personaName}\n${sdr.personaTitle || "Specialist"} | ${sdr.organizationName}`;
      if (toolDecision?.arguments) {
        toolDecision.arguments.body = action.reply;
      }
    }

    return {
      content: action.reply,
      action,
      toolDecision,
      latencyMs,
      tokensUsed: tokens,
      provider: `ollama (${this.model})`
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

    const { text, latencyMs, tokens } = await this.callOllama(systemPrompt, userPrompt);
    const { action, toolDecision } = this.parseAiAction(text, lead.leadId);

    return {
      content: action.reply,
      action,
      toolDecision,
      latencyMs,
      tokensUsed: tokens,
      provider: `ollama (${this.model})`
    };
  }

  async qualifyLead(sdr: SdrContext, lead: LeadContext, history: ConversationTurn[]) {
    const systemPrompt = `You are an AI SDR qualification engine. Analyze the conversation history using BANT criteria.
CRITICAL QUALIFICATION RULES:
- If the prospect has only described an operational problem, bottleneck, or volume, their status MUST be "IN_CONVERSATION". Merely describing pain without timeline or budget is NOT qualification.
- Only set status to "QUALIFIED" if the prospect has confirmed budget, authority, clear deployment timeline (e.g. Q3/Q4, next month), or agreed to schedule a demo.
- If timeline or budget are under assessment, status MUST be "IN_CONVERSATION".
Output JSON:
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

    const { text } = await this.callOllama(systemPrompt, userPrompt);
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      logger.warn("Failed to parse qualification JSON from Ollama, returning default scorecard");
    }

    return {
      status: "IN_CONVERSATION" as const,
      budget: "Under assessment",
      authority: "Reviewing decision authority",
      need: "Evaluating operational requirements",
      timeline: "Exploring timeline",
      notes: "Ongoing consultative qualification"
    };
  }

  async summarizeCall(transcript: Array<{ speaker: string; text: string }>, lead: LeadContext) {
    const systemPrompt = `You are an AI SDR call analyst. Given a call transcript, summarize the conversation, score qualification (0-100), and state the recommended next action.
Output JSON: { "summary": "...", "qualificationScore": 75, "recommendedAction": "..." }`;
    const userPrompt = `Transcript with ${lead.firstName} (${lead.companyName}):
${transcript.map(t => `${t.speaker}: ${t.text}`).join("\n")}`;

    const { text } = await this.callOllama(systemPrompt, userPrompt);
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.summary && lead.firstName && !parsed.summary.toLowerCase().includes(lead.firstName.toLowerCase())) {
          parsed.summary = `Call conducted with ${lead.firstName} (${lead.companyName || "Lead"}): ${parsed.summary}`;
        }
        return parsed;
      }
    } catch {
      // Fallback
    }

    return {
      summary: `Call completed with ${lead.firstName}`,
      qualificationScore: 70,
      recommendedAction: "Send recap email with calendar booking link."
    };
  }

  async analyzeOpportunityContent(params: {
    company: string;
    domain: string;
    pages: Array<{ url: string; text: string; title?: string }>;
  }): Promise<AiOpportunityAnalysisResult> {
    const { company, domain, pages } = params;

    const systemPrompt = `You are an evidence-first operational auditor. Analyze website text for a company and identify evidence-backed operational bottlenecks.
Output JSON only with schema:
{
  "industry": "string",
  "facts": [{ "observedFact": "...", "sourceUrl": "...", "category": "HIRING"|"PUBLIC_WORKFLOW"|"TECH_SIGNAL", "confidenceScore": 85 }],
  "signals": ["..."],
  "inferences": [{ "aiInference": "...", "basedOnFact": "...", "confidenceScore": 80 }],
  "unknowns": ["..."],
  "potentialProblem": "...",
  "whyItMatters": "...",
  "automationFit": "PERFECT"|"GOOD"|"PARTIAL"|"NONE",
  "recommendedSolution": "M-EXTRACT"|"M-FLOW"|"M-COPILOT"|"M-AGENTS",
  "workflow": ["1. ...", "2. ...", "3. ...", "4. ...", "5. Human escalation on exception"],
  "decisionMaker": { "name": "...", "title": "...", "sourceUrl": "..." } | null,
  "confidence": 75
}`;

    const contentDigest = pages.map((p, idx) => `PAGE ${idx + 1} [${p.url}]:\n${p.text.slice(0, 1000)}`).join("\n\n");
    const userPrompt = `Company: ${company} (${domain})\n${contentDigest}`;

    try {
      const { text } = await this.callOllama(systemPrompt, userPrompt, { num_predict: 1200, temperature: 0.1 });
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let parsed: any;
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // Attempt safe repair of trailing commas or truncated arrays/objects
          let repaired = jsonMatch[0].replace(/,\s*([\]}])/g, "$1");
          try {
            parsed = JSON.parse(repaired);
          } catch {
            let openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
            let openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
            while (openBrackets > 0) { repaired += "]"; openBrackets--; }
            while (openBraces > 0) { repaired += "}"; openBraces--; }
            parsed = JSON.parse(repaired);
          }
        }
        return {
          industry: parsed.industry || "B2B Operations",
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
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 70
        };
      }
    } catch (err: any) {
      logger.warn(`[OllamaProvider] Failed to analyze opportunity: ${err.message}`);
    }


    return {
      industry: "B2B Operations",
      facts: [],
      signals: [],
      inferences: [],
      unknowns: ["Analysis inconclusive"],
      potentialProblem: "Insufficient evidence of operational bottleneck.",
      whyItMatters: "Public text analysis was inconclusive.",
      automationFit: "NONE",
      recommendedSolution: "N/A",
      workflow: [],
      decisionMaker: null,
      confidence: 0
    };
  }
}