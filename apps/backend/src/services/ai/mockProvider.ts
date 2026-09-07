import { AiProvider, SdrContext, LeadContext, ConversationTurn, AiCompletionResponse } from "./types.js";
import { SdrToolDecision, AiAction } from "@ai-sdr/shared";

export class MockAiProvider implements AiProvider {
  async generateOutreach(sdr: SdrContext, lead: LeadContext): Promise<AiCompletionResponse> {
    const startTime = Date.now();
    const subject = `Accelerating workflow efficiency at ${lead.companyName}`;
    const body = `Hi ${lead.firstName},

I noticed your work heading operations at ${lead.companyName}. Given your focus on scaling efficiency, I wanted to introduce ${sdr.organizationName}.

We help leaders streamline manual compliance and routing processes, cutting cycle times by over 60%.

Would you be open to a brief 10-minute introductory conversation next Tuesday at 2 PM to explore if this aligns with your current priorities?

Best regards,
${sdr.personaName}
${sdr.personaTitle} | ${sdr.organizationName}`;

    const toolDecision: SdrToolDecision = {
      tool: "send_email",
      arguments: {
        lead_id: lead.leadId,
        subject,
        body
      }
    };

    const action: AiAction = {
      intent: "outreach",
      action: "send_email",
      reply: body,
      reason: "Initial personalized cold outreach",
      tool_arguments: toolDecision.arguments,
      confidence: 1.0
    };

    return {
      content: body,
      action,
      toolDecision,
      latencyMs: Date.now() - startTime,
      tokensUsed: 120,
      provider: "mock"
    };
  }

  async respondToMessage(
    sdr: SdrContext,
    lead: LeadContext,
    history: ConversationTurn[],
    latestMessage: string
  ): Promise<AiCompletionResponse> {
    const startTime = Date.now();
    const lower = latestMessage.toLowerCase();

    // 1. Human handoff trigger (enterprise, custom terms, compliance legal)
    if (
      lower.includes("enterprise") ||
      lower.includes("director") ||
      lower.includes("human") ||
      lower.includes("legal") ||
      lower.includes("custom msa") ||
      lower.includes("soc2 review")
    ) {
      const toolDecision: SdrToolDecision = {
        tool: "human_handoff",
        arguments: {
          lead_id: lead.leadId,
          reason: `Lead requested enterprise consultation or custom terms: "${latestMessage}"`,
          priority: "URGENT",
          recommended_action: "Schedule priority executive call with Account Executive"
        }
      };

      const reply = `I completely understand. I'm connecting you directly with our Senior Sales Director who can review your custom requirements and walk through the details with you right away.`;
      const action: AiAction = {
        intent: "handoff",
        action: "human_handoff",
        reply,
        reason: "Enterprise requirements require human escalation",
        tool_arguments: toolDecision.arguments,
        confidence: 0.95
      };

      return {
        content: reply,
        action,
        toolDecision,
        latencyMs: Date.now() - startTime,
        tokensUsed: 80,
        provider: "mock"
      };
    }

    // 2. Meeting / Calendar booking trigger
    if (
      lower.includes("call") ||
      lower.includes("demo") ||
      lower.includes("meet") ||
      lower.includes("thursday") ||
      lower.includes("tuesday") ||
      lower.includes("time") ||
      lower.includes("schedule") ||
      lower.includes("calendar")
    ) {
      const toolDecision: SdrToolDecision = {
        tool: "create_calendar_event",
        arguments: {
          lead_id: lead.leadId,
          title: `Intro Discovery Demo: ${sdr.organizationName} <> ${lead.companyName}`,
          start_time: new Date(Date.now() + 86400000 * 2).toISOString(),
          duration_minutes: 20
        }
      };

      const reply = `That sounds fantastic, ${lead.firstName}! I've booked our discovery session on the calendar and sent an invite. Looking forward to showing you how ${sdr.organizationName} can support ${lead.companyName}.`;
      const action: AiAction = {
        intent: "meeting",
        action: "create_calendar_event",
        reply,
        reason: "Lead requested a meeting",
        tool_arguments: toolDecision.arguments,
        confidence: 0.95
      };

      return {
        content: reply,
        action,
        toolDecision,
        latencyMs: Date.now() - startTime,
        tokensUsed: 75,
        provider: "mock"
      };
    }

    // 3. Price / Competitor objection handling (Pure conversational reply - NO send_email)
    if (lower.includes("price") || lower.includes("cost") || lower.includes("expensive") || lower.includes("zapier") || lower.includes("competitor") || lower.includes("budget") || lower.includes("switch")) {
      const objectionReply = `I appreciate you sharing that, ${lead.firstName}. We respect existing tools and believe choice is important. Many teams come to ${sdr.organizationName} when they hit limitations around advanced compliance and automated governance. What are the aspects of your current setup you like best, and are there any areas you wish worked better?`;
      const action: AiAction = {
        intent: "conversation",
        action: "reply",
        reply: objectionReply,
        reason: "Handled competitor objection conversationally without auto-dispatching email",
        tool_arguments: {},
        confidence: 0.92
      };

      return {
        content: objectionReply,
        action,
        toolDecision: null,
        latencyMs: Date.now() - startTime,
        tokensUsed: 95,
        provider: "mock"
      };
    }

    // 4. Default consultative discovery response
    const defaultResponse = `Thanks for getting back to me, ${lead.firstName}! Could you tell me a little more about how your team currently manages workflow handoffs and where you see the biggest bottleneck today?`;
    const action: AiAction = {
      intent: "conversation",
      action: "reply",
      reply: defaultResponse,
      reason: "Consultative discovery reply",
      tool_arguments: {},
      confidence: 0.9
    };

    return {
      content: defaultResponse,
      action,
      toolDecision: null,
      latencyMs: Date.now() - startTime,
      tokensUsed: 60,
      provider: "mock"
    };
  }

  async qualifyLead(sdr: SdrContext, lead: LeadContext, history: ConversationTurn[]) {
    const text = history.map(h => h.content).join(" ").toLowerCase();
    const hasBudget = text.includes("$") || text.includes("budget") || text.includes("k");
    const hasAuthority = text.includes("vp") || text.includes("director") || text.includes("head") || text.includes("sign");
    const hasNeed = text.includes("need") || text.includes("problem") || text.includes("fail") || text.includes("slow");
    const hasTimeline = text.includes("q4") || text.includes("month") || text.includes("week") || text.includes("soon");

    const qualified = (hasBudget && hasAuthority) || (hasNeed && hasTimeline);

    return {
      status: qualified ? ("QUALIFIED" as const) : ("IN_CONVERSATION" as const),
      budget: hasBudget ? "Confirmed within standard SaaS budget range" : "Exploring budget tier",
      authority: hasAuthority ? "Key decision-maker involved" : "Evaluating stakeholder buy-in",
      need: hasNeed ? "High-priority compliance & audit reduction" : "Exploring operational efficiencies",
      timeline: hasTimeline ? "Target deployment in current quarter" : "Assessing deployment schedule",
      notes: "Lead shows clear engagement with strong ROI potential."
    };
  }

  async summarizeCall(transcript: Array<{ speaker: string; text: string }>, lead: LeadContext) {
    const turns = transcript.length;
    return {
      summary: `Call conducted with ${lead.firstName} (${lead.companyName}). Discussed current workflow bottlenecks and compliance requirements across ${turns} conversational turns. Prospect expressed interest in product overview.`,
      qualificationScore: Math.min(85, 50 + turns * 5),
      recommendedAction: "Follow up via email with product architecture overview and calendar confirmation."
    };
  }
}