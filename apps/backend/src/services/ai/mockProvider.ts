import { AiProvider, SdrContext, LeadContext, ConversationTurn, AiCompletionResponse, AiOpportunityAnalysisResult } from "./types.js";
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
    const hasName = Boolean(lead.firstName && lead.firstName.trim() && lead.firstName.toLowerCase() !== "unknown");
    const hasCompany = Boolean(lead.companyName && lead.companyName.trim() && lead.companyName.toLowerCase() !== "unknown");
    const hasTitle = Boolean(lead.jobTitle && lead.jobTitle.trim() && lead.jobTitle.toLowerCase() !== "unknown");

    const greeting = hasName ? `Hi ${lead.firstName},` : "Hello,";
    const subject = hasCompany ? `Streamlining operations at ${lead.companyName?.trim()}` : `Streamlining operational workflows`;

    let intro = "";
    if (hasTitle && hasCompany && lead.jobTitle && lead.companyName) {
      intro = `I noticed your work as ${lead.jobTitle.trim()} at ${lead.companyName.trim()}. Given your focus on scaling productivity, I wanted to introduce ${sdr.organizationName}.`;
    } else if (hasCompany && lead.companyName) {
      intro = `Given your team's operational focus at ${lead.companyName.trim()}, I wanted to introduce ${sdr.organizationName}.`;
    } else {
      intro = `Given your team's focus on scaling productivity and eliminating manual friction, I wanted to introduce ${sdr.organizationName}.`;
    }

    const rawValueProp = sdr.valueProposition || "we help leaders streamline complex workflows and eliminate repetitive bottlenecks";
    let cleanClause = rawValueProp.replace(new RegExp(`^${sdr.organizationName}\\s+`, 'i'), "").trim();
    cleanClause = cleanClause.replace(/^At\s+[A-Za-z0-9_-]+,?\s*/i, "").trim();
    if (!cleanClause.toLowerCase().startsWith("we")) {
      cleanClause = `we focus on ${cleanClause}`;
    }

    const body = `${greeting}

${intro}

At ${sdr.organizationName}, ${cleanClause}.

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

    // 4. Pricing / Cost Inquiry (Ensure tier-1 support tickets do not accidentally trigger pricing)
    const isPricingInquiry = (
      /\b(price|pricing|cost|how much|rates|fee)\b/i.test(lower) ||
      (/\btiers?\b/i.test(lower) && !/\btier[\s-]*[123]\b/i.test(lower))
    );
    if (isPricingInquiry) {
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
    if (/\b(internal|in-house)\b.*?\b(team|engineering|development|automation|solution|developers)\b|\b(internal team|in-house team|internal automation|our own team|don'?t want another vendor|no more vendors)\b/i.test(lower)) {
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

    // 8. Intent-Specific Inquiries & Workflows (Bug 2 & Bug 4 fixes)
    // 8a. Invoice & ERP Integration
    if (/\b(invoice|invoices|sap|oracle|netsuite|erp|accounting system|accounts payable|ap automation)\b/i.test(lower)) {
      const reply = `Automating invoice processing and integrating directly into ERP platforms like SAP, Oracle, or NetSuite eliminates error-prone manual data entry and accelerates reconciliation cycles. How is your team currently extracting invoice data and syncing it with your accounting systems?`;

      const action: AiAction = {
        intent: "conversation",
        action: "reply",
        reply,
        reason: "Directly addressed invoice and ERP integration requirements",
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

    // 8b. KYC & Verification Backlog
    if (/\b(kyc|onboarding backlog|aml|customer verification|verification queue|compliance backlog)\b/i.test(lower)) {
      const reply = `Accelerating KYC and customer verification is essential for reducing onboarding drop-off while maintaining strict regulatory compliance. How large is your current daily verification queue, and where do manual review bottlenecks cause the biggest delays today?`;

      const action: AiAction = {
        intent: "qualification",
        action: "reply",
        reply,
        reason: "Engaged in targeted KYC and verification workflow discovery",
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

    // 8c. Contact Center & Customer Support
    if (/\b(contact center|customer support|tickets?|zendesk|agent triage|call volume|support queue)\b/i.test(lower)) {
      const reply = `Autonomous triage and resolution can dramatically reduce tier-1 support ticket volumes and speed up response times. What ticketing stack does your team use today, and what types of inquiries make up the bulk of your queue?`;

      const action: AiAction = {
        intent: "conversation",
        action: "reply",
        reply,
        reason: "Addressed contact center and support ticket automation inquiry",
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

    // 8d. Document Extraction & OCR
    if (/\b(document extraction|ocr|pdf|unstructured data|parsing documents|document processing)\b/i.test(lower)) {
      const reply = `Intelligent document processing extracts structured data from complex PDFs, contracts, and forms with high accuracy. What formats and volumes do you handle most frequently, and how are validation exceptions currently managed?`;

      const action: AiAction = {
        intent: "qualification",
        action: "reply",
        reply,
        reason: "Addressed document extraction and unstructured data processing inquiry",
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

    // 8e. General Automation & System Handoffs
    if (/\b(general automation|workflow handoff|cross-system|handoffs|repetitive tasks|process automation)\b/i.test(lower)) {
      const reply = `Streamlining cross-functional workflows and reducing manual handoffs between systems significantly boosts overall team throughput. Which manual handoffs between departments or tools currently create the largest operational bottlenecks?`;

      const action: AiAction = {
        intent: "conversation",
        action: "reply",
        reply,
        reason: "Addressed general workflow automation and system handoffs inquiry",
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

    // 8f. Team Headcount & Operations Scale (Turn 2: "i have 50 people working for me")
    if (/\b(\d+\s*(?:people|team members|employees|staff|workers)|team of \d+)\b/i.test(lower)) {
      const match = lower.match(/\b(\d+)\s*(?:people|team members|employees|staff|workers)\b/i) || lower.match(/\bteam of (\d+)\b/i);
      const count = match ? match[1] : "that size";
      const reply = `A team of ${count} represents significant operational throughput. Managing workflows across a team of that size often exposes handoff delays and repetitive manual queues. Where do your team members currently spend the most manual hours each week?`;

      const action: AiAction = {
        intent: "qualification",
        action: "reply",
        reply,
        reason: "Acknowledged team scale directly and explored specific workflow distribution",
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

    // 8g. Approach & Solution Explanation (Turn 5: "how would you actually help us?", "how does it work?")
    if (/\b(how (?:would|do|can) you (?:actually )?help|how does it work|what do you (?:actually )?do|what is your approach|how do you help|how can you help)\b/i.test(lower)) {
      const reply = `We deploy autonomous software agents that connect directly to your existing tools—handling document ingestion, validation, and system updates end-to-end. Your team only reviews exceptions rather than keying in data manually. Would you be open to a 15-minute walkthrough of how this transition works in practice?`;

      const action: AiAction = {
        intent: "conversation",
        action: "reply",
        reply,
        reason: "Explained practical implementation approach directly answering prospect question",
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

    // 8h. Other Operational Bottleneck / Generic Problem Description (Without company description dump)
    if (/\b(manual|errors?|too long|bottleneck|process(?:ing)?|turnaround|volume)\b/i.test(lower)) {
      const reply = `Manual processing and high error rates create significant operational bottlenecks for growing teams. Where do your biggest operational delays occur between data extraction and updating your internal systems?`;

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
        tokensUsed: 75,
        provider: "mock"
      };
    }

    // 9. Default Consultative Discovery (Cleaned of company description repetition across turns)
    const hasPriorTurns = history && history.length > 0;
    const hasName = Boolean(lead.firstName && lead.firstName.trim() && lead.firstName.toLowerCase() !== "unknown");
    const reply = hasPriorTurns
      ? `Thanks for sharing that context. Which specific part of that workflow currently creates the biggest operational bottleneck for your team?`
      : hasName
      ? `Hi ${lead.firstName}, thanks for reaching out. We help streamline operational workflows and eliminate manual bottlenecks. Could you share a bit about your current setup at ${company} and where manual processes consume the most time?`
      : `Hello! Thanks for reaching out. We help streamline operational workflows and eliminate manual bottlenecks. Could you share a bit about your current setup and where manual processes consume the most time?`;

    const action: AiAction = {
      intent: "conversation",
      action: "reply",
      reply,
      reason: hasPriorTurns
        ? "Continued consultative multi-turn discovery without repeating introduction"
        : "Initial consultative discovery without boilerplate repetition",
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
    const hasTimeline = /\b(next\s+week|in\s+\d+\s+weeks?|this\s+month|next\s+month|q[1-4]|by\s+end\s+of|launching\s+soon|deploy(?:ing)?\s+soon|within\s+(?:a\s+)?month)\b/i.test(text);

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

  async analyzeOpportunityContent(params: {
    company: string;
    domain: string;
    pages: Array<{ url: string; text: string; title?: string }>;
  }): Promise<AiOpportunityAnalysisResult> {
    const { company, domain, pages } = params;

    if (!pages || pages.length === 0 || pages.every(p => !p.text || p.text.trim().length < 40)) {
      return {
        industry: "B2B Operations",
        facts: [],
        signals: [],
        inferences: [],
        unknowns: ["No verifiable web content found"],
        potentialProblem: "Insufficient evidence of operational bottleneck.",
        whyItMatters: "Public sources do not show distinct operational friction.",
        automationFit: "NONE",
        recommendedSolution: "N/A",
        workflow: [],
        decisionMaker: null,
        confidence: 0
      };
    }

    const facts: any[] = [];
    const inferences: any[] = [];
    const signals: string[] = [];
    const unknowns: string[] = ["Internal software versions not disclosed", "Private headcount unknown"];
    let potentialProblem = "Manual operational intake and verification workflows create scaling bottlenecks.";
    let whyItMatters = "Manual clerical overhead limits transaction throughput.";
    let recommendedSolution = "M-EXTRACT + M-FLOW";
    let industry = "B2B Operations";
    let dm: any = null;

    for (const page of pages) {
      const lower = page.text.toLowerCase();

      // Hiring signal
      const hiringMatch = page.text.match(/(?:hiring|openings?|looking for|job description)\s*[:\w\s,-]{0,60}?(accounts payable|invoice|data entry|claims processor|operations coordinator|billing)/i);
      if (hiringMatch && facts.length < 3) {
        facts.push({
          observedFact: `Careers page indicates active opening for: "${hiringMatch[0].trim()}".`,
          sourceUrl: page.url,
          category: "HIRING",
          confidenceScore: 90
        });
        inferences.push({
          aiInference: `Active hiring for ${hiringMatch[1]} indicates back-office document volume is growing and handled manually.`,
          basedOnFact: `Careers page indicates active opening for: "${hiringMatch[0].trim()}".`,
          confidenceScore: 85
        });
        signals.push("Active operational hiring");
      }

      // Workflow delay signal
      const delayMatch = page.text.match(/(?:please allow|turnaround|processing time)\s*[:\w\s,-]{0,40}?(\d+[\s-]*(?:hours?|days?|business days?))/i);
      if (delayMatch && facts.length < 4) {
        facts.push({
          observedFact: `Public workflow documentation states: "${delayMatch[0].trim()}".`,
          sourceUrl: page.url,
          category: "PUBLIC_WORKFLOW",
          confidenceScore: 88
        });
        inferences.push({
          aiInference: "Stated processing window suggests multi-step manual intake verification before case progression.",
          basedOnFact: `Public workflow documentation states: "${delayMatch[0].trim()}".`,
          confidenceScore: 82
        });
        signals.push("Published processing turnaround window");
      }

      // Tech mention
      const techMatch = page.text.match(/(?:quickbooks|netsuite|sap|salesforce|spreadsheets?|manual reconciliation)/i);
      if (techMatch && facts.length < 5) {
        facts.push({
          observedFact: `Operational documentation references: "${techMatch[0]}".`,
          sourceUrl: page.url,
          category: "TECH_SIGNAL",
          confidenceScore: 80
        });
        signals.push(`Uses ${techMatch[0]}`);
      }

      // Decision Maker (Leadership)
      if (!dm) {
        const dmMatch = page.text.match(/(?:(?:coo|chief operating officer|head of operations|vp of operations|director of operations)\s*[-:,|]?\s*([A-Z][a-z]+ [A-Z][a-z]+)|([A-Z][a-z]+ [A-Z][a-z]+)\s*[-:,|]?\s*(?:coo|chief operating officer|head of operations|vp of operations|director of operations))/i);
        if (dmMatch) {
          const name = (dmMatch[1] || dmMatch[2]).trim();
          dm = {
            name,
            title: "Head of Operations",
            sourceUrl: page.url
          };
        }
      }

      if (lower.includes("logistics") || lower.includes("freight")) {
        industry = "Logistics & Freight";
        recommendedSolution = "M-EXTRACT + M-FLOW";
      } else if (lower.includes("health") || lower.includes("medical") || lower.includes("claims")) {
        industry = "Healthcare Operations";
        recommendedSolution = "M-EXTRACT + M-COPILOT";
      } else if (lower.includes("lending") || lower.includes("loan") || lower.includes("fintech")) {
        industry = "Fintech & Lending";
        recommendedSolution = "M-EXTRACT + M-FLOW";
      }
    }

    if (facts.length === 0) {
      // If no explicit hiring or workflow keywords matched, but page has general text
      facts.push({
        observedFact: `Website documentation for ${company} outlines public service workflows at ${pages[0].url}.`,
        sourceUrl: pages[0].url,
        category: "DOCUMENTATION",
        confidenceScore: 75
      });
      inferences.push({
        aiInference: "Routine client interactions appear to rely on standard email and portal submissions.",
        basedOnFact: `Website documentation for ${company} outlines public service workflows at ${pages[0].url}.`,
        confidenceScore: 70
      });
    }

    return {
      industry,
      facts,
      signals: signals.length > 0 ? signals : ["Standard operational intake"],
      inferences,
      unknowns,
      potentialProblem,
      whyItMatters,
      automationFit: "GOOD",
      recommendedSolution,
      workflow: [
        "1. Ingestion: Automated webhook or email intake",
        "2. Extraction: Document parsing and field normalization",
        "3. Verification: Cross-system ERP/CRM validation",
        "4. Execution: Automated ledger or ticketing update",
        "5. Human escalation on exception"
      ],
      decisionMaker: dm,
      confidence: Math.min(92, 70 + facts.length * 6)
    };
  }
}
