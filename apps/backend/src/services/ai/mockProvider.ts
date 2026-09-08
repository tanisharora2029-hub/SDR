import { AiProvider, SdrContext, LeadContext, ConversationTurn, AiCompletionResponse } from "./types.js";
import { SdrToolDecision, AiAction } from "@ai-sdr/shared";

export class MockAiProvider implements AiProvider {
  private formatGreeting(lead: LeadContext): string {
    const hasName = Boolean(lead.firstName && lead.firstName.trim() && lead.firstName.toLowerCase() !== "unknown");
    return hasName ? `Hi ${lead.firstName},` : "Hello,";
  }

  private formatCompany(lead: LeadContext): string {
    const hasCompany = Boolean(lead.companyName && lead.companyName.trim() && lead.companyName.toLowerCase() !== "unknown");
    return hasCompany ? lead.companyName.trim() : "your team";
  }

  async generateOutreach(sdr: SdrContext, lead: LeadContext): Promise<AiCompletionResponse> {
    const startTime = Date.now();
    const company = this.formatCompany(lead);
    const greeting = this.formatGreeting(lead);
    const subject = `Accelerating operational efficiency at ${company}`;
    
    const body = `${greeting}

I noticed your work heading operations at ${company}. Given your focus on scaling productivity and reducing manual friction, I wanted to introduce ${sdr.organizationName}.

${sdr.valueProposition || "We help leaders streamline manual workflows and eliminate operational bottlenecks."}

Would you be open to a brief introductory conversation next week to explore how our capabilities align with your current priorities?

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
      reason: "Initial personalized cold outreach grounded in organization value proposition",
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
    const lower = latestMessage.toLowerCase().trim();
    const greeting = this.formatGreeting(lead);
    const company = this.formatCompany(lead);

    // 1. Opt-out check (STOP, unsubscribe)
    if (/\b(stop|unsubscribe|remove me|opt out|cancel)\b/i.test(lower)) {
      const reply = "You have been unsubscribed and will not receive further communications from us.";
      const action: AiAction = {
        intent: "optout",
        action: "none",
        reply,
        reason: "Lead requested opt-out",
        tool_arguments: {},
        confidence: 1.0
      };
      return {
        content: reply,
        action,
        toolDecision: null,
        latencyMs: Date.now() - startTime,
        tokensUsed: 25,
        provider: "mock"
      };
    }

    // 2. Explicit Scheduling Request: requires EXPLICIT agreement / command to book with date/time
    // E.g. "Yes, let's schedule tomorrow at 3 PM", "Book me Friday at 2 PM"
    const explicitBookingPattern = /(?:let'?s\s+(?:schedule|book|meet)|book\s+me|schedule\s+me|confirm\s+(?:our\s+)?demo)\s+.*(?:tomorrow|next\s+\w+|\b(?:mon|tues|wednes|thurs|fri|satur|sun)day|\d{1,2}(?::\d{2})?\s*(?:am|pm))/i;
    const isExplicitBooking = explicitBookingPattern.test(lower) || (
      /\b(?:tomorrow|friday|monday|tuesday|wednesday|thursday)\b/i.test(lower) &&
      /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(lower) &&
      /\b(?:schedule|book|meet|call|yes|sounds good|let'?s do)\b/i.test(lower)
    );

    if (isExplicitBooking) {
      const toolDecision: SdrToolDecision = {
        tool: "create_calendar_event",
        arguments: {
          lead_id: lead.leadId,
          title: `Intro Discovery Demo: ${sdr.organizationName} <> ${company}`,
          start_time: new Date(Date.now() + 86400000).toISOString(),
          duration_minutes: 30
        }
      };

      const reply = `I have scheduled our product demo on the calendar and sent a calendar invite. Looking forward to showing you how ${sdr.organizationName} can support ${company}!`;
      const action: AiAction = {
        intent: "meeting",
        action: "create_calendar_event",
        reply,
        reason: "Prospect explicitly agreed to schedule a meeting with confirmed slot",
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

    // 3. Human Handoff (Enterprise, custom legal MSA, SOC2 audit, executive consultation)
    if (
      lower.includes("enterprise") ||
      lower.includes("custom msa") ||
      lower.includes("soc2 audit") ||
      lower.includes("talk to a human") ||
      lower.includes("speak with a person") ||
      lower.includes("legal review")
    ) {
      const toolDecision: SdrToolDecision = {
        tool: "human_handoff",
        arguments: {
          lead_id: lead.leadId,
          reason: `Prospect requested enterprise consultation: "${latestMessage}"`,
          priority: "URGENT",
          recommended_action: "Schedule executive consultation with enterprise sales lead"
        }
      };

      const reply = `I completely understand. I'm connecting you directly with our solutions team to review your specific requirements in detail.`;
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
        tokensUsed: 65,
        provider: "mock"
      };
    }

    // 4. Pricing / Cost Inquiry
    if (/\b(price|pricing|cost|how much|rates|tiers?|fee)\b/i.test(lower)) {
      const allText = `${sdr.pricingInfo || ""} ${sdr.knowledgeBase || ""}`;
      const hasVerifiedPrice = allText.includes("$") || /pricing:/i.test(allText) || /tier/i.test(allText);

      let reply = "";
      if (hasVerifiedPrice && sdr.pricingInfo) {
        reply = `Our standard commercial pricing is: ${sdr.pricingInfo}. How does that align with your operational requirements at ${company}?`;
      } else if (hasVerifiedPrice && sdr.knowledgeBase) {
        const pricingLine = sdr.knowledgeBase.split("\n").find(l => l.includes("$") || /pricing/i.test(l));
        reply = pricingLine
          ? `Our pricing is: ${pricingLine.trim()}. How does that fit with your current setup?`
          : "I don't have verified pricing information available right now. I can connect you with a human specialist to discuss pricing tailored to your scale.";
      } else {
        reply = "I don't have verified pricing information available right now. I can connect you with our solutions team to discuss pricing tailored to your requirements.";
      }

      const action: AiAction = {
        intent: "conversation",
        action: "reply",
        reply,
        reason: "Addressed pricing inquiry grounded strictly in verified knowledge base",
        tool_arguments: {},
        confidence: 0.95
      };

      return {
        content: reply,
        action,
        toolDecision: null,
        latencyMs: Date.now() - startTime,
        tokensUsed: 80,
        provider: "mock"
      };
    }

    // 5. Competitor Objections (UiPath, Automation Anywhere, Salesforce, Zapier, etc.)
    if (/\b(uipath|automation anywhere|blue prism|workato|salesforce|hubspot|outreach|salesloft|zapier|competitor)\b/i.test(lower)) {
      const compMatch = lower.match(/\b(uipath|automation anywhere|blue prism|workato|salesforce|hubspot|outreach|salesloft|zapier)\b/i);
      const compName = compMatch ? compMatch[0].charAt(0).toUpperCase() + compMatch[0].slice(1) : "your existing platform";
      
      const reply = `We completely respect ${compName} and believe choice is essential. Many organizations find that ${sdr.organizationName} complements existing setups by handling specialized autonomous execution and edge cases that traditional tools find cumbersome. What aspects of your current ${compName} deployment work best, and where do you see the biggest operational friction or manual bottlenecks?`;

      const action: AiAction = {
        intent: "conversation",
        action: "reply",
        reply,
        reason: "Handled competitor objection conversationally without disparagement",
        tool_arguments: {},
        confidence: 0.95
      };

      return {
        content: reply,
        action,
        toolDecision: null,
        latencyMs: Date.now() - startTime,
        tokensUsed: 90,
        provider: "mock"
      };
    }

    // 6. Internal Team / In-House Automation / No Vendors
    if (/\b(internal team|in-house team|internal automation|our own team|don'?t want another vendor|no more vendors)\b/i.test(lower)) {
      const reply = `We admire teams with strong internal automation capabilities. Organizations often partner with ${sdr.organizationName} not to replace in-house engineering, but to relieve their backlog—handling repetitive or high-volume workflows so internal developers can focus on core proprietary products. How is your internal team's backlog currently prioritized?`;

      const action: AiAction = {
        intent: "conversation",
        action: "reply",
        reply,
        reason: "Addressed internal team objection respectfully and explored backlog alignment",
        tool_arguments: {},
        confidence: 0.95
      };

      return {
        content: reply,
        action,
        toolDecision: null,
        latencyMs: Date.now() - startTime,
        tokensUsed: 85,
        provider: "mock"
      };
    }

    // 7. Timing Objections (too busy, next quarter, check back later)
    if (/\b(too busy|next quarter|later|not ready|not right now|check back|reach out in|q[1-4])\b/i.test(lower)) {
      const reply = `Understood completely—timing is everything, and we respect your schedule. When would be the best week next quarter for us to reconnect and see if exploring ${sdr.organizationName} makes sense?`;

      const action: AiAction = {
        intent: "conversation",
        action: "reply",
        reply,
        reason: "Respected prospect timing objection without forcing a meeting",
        tool_arguments: {},
        confidence: 0.95
      };

      return {
        content: reply,
        action,
        toolDecision: null,
        latencyMs: Date.now() - startTime,
        tokensUsed: 65,
        provider: "mock"
      };
    }

    // 8. Problem Descriptions & High Buying Intent (e.g. KYC documents, manual reviews, errors, turnaround delays)
    if (/\b(kyc|document|manual|errors?|too long|bottleneck|process(?:ing)?|turnaround|volume)\b/i.test(lower)) {
      const reply = `Manual processing and high error rates create significant operational bottlenecks for growing teams. At ${sdr.organizationName}, ${sdr.valueProposition || "we help streamline these critical workflows to ensure high accuracy and speed"}. Could you share a bit more about your current document volume and how information is entered into your internal systems?`;

      const action: AiAction = {
        intent: "qualification",
        action: "reply",
        reply,
        reason: "Engaged in consultative problem discovery based on operational pain description",
        tool_arguments: {},
        confidence: 0.95
      };

      return {
        content: reply,
        action,
        toolDecision: null,
        latencyMs: Date.now() - startTime,
        tokensUsed: 85,
        provider: "mock"
      };
    }

    // 9. Default Consultative Discovery (Context-Grounded in real organization data)
    const reply = `Thanks for reaching out! At ${sdr.organizationName}, ${sdr.valueProposition || "we help organizations optimize operational workflows and scale efficiently"}. Could you share a bit more about your current process at ${company} and where you see the biggest priority today?`;

    const action: AiAction = {
      intent: "conversation",
      action: "reply",
      reply,
      reason: "Dynamic consultative discovery grounded in organization value proposition",
      tool_arguments: {},
      confidence: 0.9
    };

    return {
      content: reply,
      action,
      toolDecision: null,
      latencyMs: Date.now() - startTime,
      tokensUsed: 70,
      provider: "mock"
    };
  }

  async qualifyLead(sdr: SdrContext, lead: LeadContext, history: ConversationTurn[]) {
    const text = history.map(h => h.content).join(" ").toLowerCase();
    const hasBudget = text.includes("$") || text.includes("budget") || text.includes("k");
    const hasAuthority = text.includes("vp") || text.includes("director") || text.includes("head") || text.includes("sign");
    const hasNeed = text.includes("need") || text.includes("problem") || text.includes("fail") || text.includes("slow") || text.includes("kyc") || text.includes("manual");
    const hasTimeline = text.includes("q4") || text.includes("month") || text.includes("week") || text.includes("soon");

    const qualified = (hasBudget && hasAuthority) || (hasNeed && hasTimeline);

    return {
      status: qualified ? ("QUALIFIED" as const) : ("IN_CONVERSATION" as const),
      budget: hasBudget ? "Confirmed within standard SaaS budget range" : "Exploring budget tier",
      authority: hasAuthority ? "Key decision-maker involved" : "Evaluating stakeholder buy-in",
      need: hasNeed ? "High-priority operational workflow optimization" : "Exploring operational efficiencies",
      timeline: hasTimeline ? "Target deployment in current cycle" : "Assessing deployment schedule",
      notes: "Lead shows clear engagement with strong ROI potential."
    };
  }

  async summarizeCall(transcript: Array<{ speaker: string; text: string }>, lead: LeadContext) {
    const turns = transcript.length;
    const company = this.formatCompany(lead);
    const hasName = Boolean(lead.firstName && lead.firstName.trim() && lead.firstName.toLowerCase() !== "unknown");
    const leadName = hasName ? lead.firstName : "Prospect";

    return {
      summary: `Call conducted with ${leadName} (${company}). Discussed operational bottlenecks and integration requirements across ${turns} conversational turns. Prospect expressed interest in product capabilities.`,
      qualificationScore: Math.min(85, 50 + turns * 5),
      recommendedAction: "Follow up via email with product architecture overview and calendar confirmation."
    };
  }
}
