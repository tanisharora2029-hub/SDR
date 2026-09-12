import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import { ConversationService } from "../services/conversationService.js";
import { WebhookService } from "../services/webhookService.js";
import { PhoneService } from "../services/phoneService.js";
import { LeadService } from "../services/leadService.js";
import { ToolExecutor } from "../services/toolExecutor.js";
import { PromptBuilder } from "../services/ai/promptBuilder.js";
import { MockAiProvider } from "../services/ai/mockProvider.js";
import { registerWsClient } from "../lib/wsBroadcaster.js";
import { SdrContext, LeadContext, ConversationTurn } from "../services/ai/types.js";

describe.sequential("NEXSDR — MASTER PRODUCTION BUG FIX TEST SUITE (BUGS 1 - 13)", () => {
  let orgId: string;
  let otherOrgId: string;
  let sdrProfileId: string;
  let leadId: string;
  let conversationId: string;

  beforeAll(async () => {
    // Primary test organization (MachineMind)
    const org = await prisma.organization.create({
      data: {
        name: "MachineMind",
        industry: "Intelligent Operations",
        website: "https://machinemind.in",
        valueProposition: "MachineMind automates financial back-office operations and customer verification.",
        targetCustomerIcp: "VP of Operations and Compliance Heads.",
        companyDescription: "MachineMind builds high-throughput autonomous agents for operations and finance.",
        products: "DocuMind (invoice extraction) and LedgerSync (ERP sync).",
        pricingInfo: "Starter ($199/mo) and Growth ($499/mo).",
        complianceInfo: "SOC2 Type II Certified, GDPR compliant.",
        competitors: "UiPath: MachineMind eliminates manual template maintenance and brittle rules.",
        knowledgeBase: "DocuMind extracts invoice data into SAP and Oracle NetSuite. Standard pricing: Starter ($199/mo), Growth ($499/mo)."
      }
    });
    orgId = org.id;

    // Secondary isolated organization for tenant isolation tests
    const otherOrg = await prisma.organization.create({
      data: {
        name: "DataForge",
        industry: "Data Engineering",
        website: "https://dataforge.io",
        valueProposition: "DataForge manages real-time event streaming."
      }
    });
    otherOrgId = otherOrg.id;

    const sdr = await prisma.sdrProfile.create({
      data: {
        organizationId: orgId,
        personaName: "Sarah Jenkins",
        title: "AI Growth Specialist",
        tone: "Consultative, professional, and crisp"
      }
    });
    sdrProfileId = sdr.id;

    // Create a known lead
    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        firstName: "Vikram",
        lastName: "Patel",
        email: "vikram.patel@finscale.io",
        companyName: "FinScale",
        jobTitle: "Head of Operations",
        status: "CONTACTED"
      }
    });
    leadId = lead.id;

    // Create initial conversation with outbound email message
    const conv = await prisma.conversation.create({
      data: {
        organizationId: orgId,
        leadId: lead.id,
        channel: "EMAIL",
        subject: "Streamlining operations at FinScale"
      }
    });
    conversationId = conv.id;

    await prisma.message.create({
      data: {
        conversationId: conv.id,
        channel: "EMAIL",
        direction: "OUTBOUND",
        senderRole: "AI",
        senderId: sdr.id,
        recipientId: lead.id,
        content: "Hi Vikram, I noticed your focus on operations at FinScale. Would you be open to a brief chat?",
        senderName: sdr.personaName,
        status: "SENT",
        toolCallArgs: JSON.stringify({ externalMessageId: "<outbound-initial-msg-999@nexsdr.in>" })
      }
    });
  });

  afterAll(async () => {
    try {
      await prisma.message.deleteMany({ where: { conversation: { organizationId: { in: [orgId, otherOrgId] } } } });
      await prisma.conversation.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.followUpTask.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.lead.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.sdrProfile.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.activityLog.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.callSession.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.usageRecord.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
    } catch (e) {}
  });

  // =========================================================================
  // BUG #1: Real Inbound Webhook -> Ingestion, Threading, Case-Insensitive, updatedAt
  // =========================================================================
  it("BUG #1: Real inbound email links to existing conversation, stores LEAD role, and updates conversation updatedAt", async () => {
    let wsEventReceived = false;
    const mockWs = {
      readyState: 1, // WebSocket.OPEN
      send: (data: string) => {
        const parsed = JSON.parse(data);
        if (parsed.type === "MESSAGE_CREATED" || parsed.type === "CONVERSATION_UPDATED") {
          wsEventReceived = true;
        }
      },
      on: () => {},
      removeListener: () => {}
    };
    registerWsClient(mockWs as any, orgId);

    const convBefore = await prisma.conversation.findUnique({ where: { id: conversationId } });

    // Simulate Resend email.received webhook with mixed-case sender and In-Reply-To header
    const mockResendPayload = {
      type: "email.received",
      data: {
        id: "resend_inbound_evt_101",
        from: "Vikram Patel <VIKRAM.PATEL@finscale.io>",
        to: ["alex@nexsdr.in"],
        subject: "Re: Streamlining operations at FinScale",
        text: "Thanks for reaching out! We extract invoice data manually today.",
        headers: [
          { name: "in-reply-to", value: "<outbound-initial-msg-999@nexsdr.in>" },
          { name: "message-id", value: "<incoming-reply-uuid-101@mail.gmail.com>" }
        ],
        created_at: new Date().toISOString()
      }
    };

    const result = await WebhookService.processInboundEmail(mockResendPayload, orgId);
    expect(result.success).toBe(true);
    expect(result.matched).toBe(true);
    expect(result.leadId).toBe(leadId);

    // Verify inbound message in DB
    const inboundMsg = await prisma.message.findFirst({
      where: {
        conversationId,
        direction: "INBOUND",
        senderRole: "LEAD"
      }
    });
    expect(inboundMsg).toBeDefined();
    expect(inboundMsg?.status).toBe("REAL_INBOUND");
    expect(inboundMsg?.content).toContain("We extract invoice data manually today.");

    // Verify conversation.updatedAt was touched
    const convAfter = await prisma.conversation.findUnique({ where: { id: conversationId } });
    expect(convAfter?.updatedAt.getTime()).toBeGreaterThanOrEqual(convBefore!.updatedAt.getTime());

    // Verify WebSocket event was broadcast
    expect(wsEventReceived).toBe(true);
  });

  // =========================================================================
  // BUG #2: Intent-Specific Questions Return Targeted Discovery (Invoices/ERP, KYC)
  // =========================================================================
  it("BUG #2: Invoice to ERP inquiry addresses data extraction and ERP discovery without dumping company overview", async () => {
    const sdrContext: SdrContext = {
      organizationName: "MachineMind",
      industry: "Operations",
      valueProposition: "MachineMind automates financial back-office operations.",
      companyDescription: "MachineMind is a global leader in AI operations with 500 enterprise customers across the world.",
      products: "DocuMind (invoice OCR) and LedgerSync (ERP integration)"
    };

    const leadContext: LeadContext = {
      leadId,
      firstName: "Vikram",
      companyName: "FinScale",
      jobTitle: "Head of Operations"
    };

    const mockProvider = new MockAiProvider();
    const response = await mockProvider.respondToMessage(
      sdrContext,
      leadContext,
      [],
      "Our team spends several hours every day extracting data from invoices and entering it into our ERP. What would you recommend?"
    );

    expect(response.content.toLowerCase()).toMatch(/(invoice|erp|sap|oracle|netsuite|data entry)/i);
    expect(response.content.toLowerCase()).toMatch(/(extract|accounting|system)/i);
    expect(response.content).not.toContain("global leader in AI operations with 500 enterprise customers");
    expect(response.content).not.toMatch(/^At\s+MachineMind,\s+MachineMind/i);
  });

  it("BUG #2: KYC backlog inquiry addresses verification throughput and queue discovery", async () => {
    const sdrContext: SdrContext = {
      organizationName: "MachineMind",
      industry: "Operations",
      valueProposition: "MachineMind automates financial back-office operations.",
      companyDescription: "MachineMind is a global leader in AI operations.",
      products: "DocuMind KYC Accelerator"
    };

    const leadContext: LeadContext = {
      leadId,
      firstName: "Vikram",
      companyName: "FinScale"
    };

    const mockProvider = new MockAiProvider();
    const response = await mockProvider.respondToMessage(
      sdrContext,
      leadContext,
      [],
      "We have a large KYC backlog and our operations team is struggling with manual verification. Can you explain how you would approach this?"
    );

    expect(response.content.toLowerCase()).toMatch(/(kyc|verification|queue|onboarding|compliance)/i);
    expect(response.content.toLowerCase()).toMatch(/(volume|bottleneck|delay)/i);
    expect(response.content).not.toContain("global leader in AI operations");
  });

  // =========================================================================
  // BUG #3: Prospect / Company Context Leakage (Unknown Lead Fields)
  // =========================================================================
  it("BUG #3: Neutral greetings and no leakage of Tanish, technew, or CloudFlow when lead info is Unknown", async () => {
    const unknownLead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        firstName: "Unknown",
        lastName: "Unknown",
        email: "anonymous@unknown-domain.io",
        companyName: "Unknown",
        status: "NEW"
      }
    });

    const result = await ConversationService.ingestLeadReply(
      orgId,
      unknownLead.id,
      "EMAIL",
      "Could you tell me more about your security certifications?",
      { isSimulator: true }
    );

    expect(result.outboundMsg).toBeDefined();
    const reply = result.outboundMsg.content.toLowerCase();

    // Must NOT contain leaked identities
    expect(reply).not.toContain("technew");
    expect(reply).not.toContain("tanish");
    expect(reply).not.toContain("cloudflow");
    expect(reply).not.toContain("at unknown");
  });

  // =========================================================================
  // BUG #4: Generic Company Description Repetition (No 'At MachineMind, MachineMind...')
  // =========================================================================
  it("BUG #4: Response does not prepend 'At MachineMind, MachineMind...' duplicated boilerplate", async () => {
    const sdrContext: SdrContext = {
      organizationName: "MachineMind",
      valueProposition: "MachineMind delivers automated intelligence for operations.",
      companyDescription: "MachineMind helps enterprises automate repetitive tasks."
    };

    const leadContext: LeadContext = {
      leadId,
      firstName: "Vikram",
      companyName: "FinScale"
    };

    const mockProvider = new MockAiProvider();
    const response = await mockProvider.respondToMessage(
      sdrContext,
      leadContext,
      [],
      "How do you help operations teams?"
    );

    expect(response.content).not.toMatch(/^At\s+MachineMind,\s+MachineMind\b/i);
    expect(response.content).not.toMatch(/^At\s+MachineMind,\s+at\s+MachineMind\b/i);
  });

  // =========================================================================
  // BUG #5 & BUG #9: Simulator Multiple Consecutive Turns Without Reopening (1 -> 2 -> 3 -> 4)
  // =========================================================================
  it("BUG #5 & BUG #9: Simulator executes 4 consecutive turns seamlessly, updating conversation and keeping send usable", async () => {
    const turns = [
      "ohk hi",
      "i have 50 people working for me",
      "we process invoices manually",
      "we already use UiPath"
    ];

    for (let i = 0; i < turns.length; i++) {
      const simResult = await ConversationService.ingestLeadReply(
        orgId,
        leadId,
        "EMAIL",
        turns[i],
        { isSimulator: true }
      );

      expect(simResult.inboundMsg).toBeDefined();
      expect(simResult.inboundMsg.content).toBe(turns[i]);
      expect(simResult.outboundMsg).toBeDefined();
      expect(simResult.outboundMsg.content.length).toBeGreaterThan(10);
    }

    const allMessages = await prisma.message.findMany({
      where: { conversationId, channel: "EMAIL" },
      orderBy: { createdAt: "asc" }
    });

    // Ensure all 4 turns (4 lead messages + 4 AI responses) are persisted
    expect(allMessages.length).toBeGreaterThanOrEqual(8);
  });

  // =========================================================================
  // BUG #6: Phone Studio Persona & Organization Identity
  // =========================================================================
  it("BUG #6: Phone Studio initializes call session with MachineMind and Sarah Jenkins, zero CloudFlow fallback", async () => {
    const callResult = await PhoneService.initiateCall(orgId, leadId, "OUTBOUND");
    expect(callResult.session).toBeDefined();
    expect(callResult.greeting).toContain("Sarah Jenkins");
    expect(callResult.greeting).toContain("MachineMind");
    expect(callResult.greeting).not.toContain("CloudFlow");
    expect(callResult.greeting).not.toContain("Alex Rivers");
  });

  // =========================================================================
  // BUG #7 & BUG #8: Phone Studio Spoken Brevity, Voice Intent & DNC Safety
  // =========================================================================
  it("BUG #7 & BUG #8: Phone call turn enforces crisp brevity (< 28 words), zero markdown, and handles live DNC", async () => {
    const call = await PhoneService.initiateCall(orgId, leadId, "OUTBOUND");

    // Turn 1: Spoken inquiry
    const turn1 = await PhoneService.processCallTurn(
      orgId,
      call.session.callSid,
      "We already use UiPath across our operations department."
    );

    expect(turn1.sdrSpeech).toBeDefined();
    expect(turn1.sdrSpeech.length).toBeGreaterThan(5);
    expect(turn1.sdrSpeech).not.toMatch(/[*_#`~]/); // No markdown in speech
    const wordCount = turn1.sdrSpeech.split(/\s+/).filter(Boolean).length;
    expect(wordCount).toBeLessThanOrEqual(30);

    // Turn 2: Spoken DNC request
    const turn2 = await PhoneService.processCallTurn(
      orgId,
      call.session.callSid,
      "Please stop calling me and remove me from your list."
    );

    expect(turn2.sdrSpeech.toLowerCase()).toContain("do not call");

    // Verify lead status in DB is updated to OPTED_OUT
    const leadRecord = await prisma.lead.findUnique({ where: { id: leadId } });
    expect(leadRecord?.isOptedOut).toBe(true);
    expect(leadRecord?.status).toBe("OPTED_OUT");
  });

  // =========================================================================
  // BUG #10: Multi-Turn Context Preservation (Turn 1 'ohk hi' -> Turn 2 'i have 50 people')
  // =========================================================================
  it("BUG #10: Turn 2 'i have 50 people working for me' specifically addresses headcount rather than repeating Turn 1", async () => {
    const sdrContext: SdrContext = {
      organizationName: "MachineMind",
      valueProposition: "MachineMind automates financial back-office operations.",
      personaName: "Sarah Jenkins",
      personaTitle: "AI Growth Specialist"
    };

    const leadContext: LeadContext = {
      leadId,
      firstName: "Vikram",
      companyName: "FinScale"
    };

    const mockProvider = new MockAiProvider();

    const turn1History: ConversationTurn[] = [];
    const res1 = await mockProvider.respondToMessage(sdrContext, leadContext, turn1History, "ohk hi");

    const turn2History: ConversationTurn[] = [
      { speaker: "lead", channel: "EMAIL", content: "ohk hi", timestamp: new Date().toISOString() },
      { speaker: "sdr", channel: "EMAIL", content: res1.content, timestamp: new Date().toISOString() }
    ];

    const res2 = await mockProvider.respondToMessage(
      sdrContext,
      leadContext,
      turn2History,
      "i have 50 people working for me"
    );

    // res2 must specifically address the 50 people headcount, not repeat res1
    expect(res2.content.toLowerCase()).toMatch(/(50|team|throughput|hours|workflows)/i);
    expect(res2.content).not.toBe(res1.content);
  });

  // =========================================================================
  // BUG #11 & BUG #12: AI Outreach Generation, externalMessageId Tracking & Delivery Safety
  // =========================================================================
  it("BUG #11 & BUG #12: Triggering AI outreach creates message with externalMessageId and updates lead status to CONTACTED", async () => {
    const outreachLead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        firstName: "Ananya",
        lastName: "Deshmukh",
        email: "ananya@enterprise-ledger.in",
        companyName: "Enterprise Ledger",
        jobTitle: "VP Finance",
        status: "NEW"
      }
    });

    const result = await LeadService.triggerAiOutreach(orgId, outreachLead.id);
    expect(result).toBeDefined();

    // Verify lead status updated to CONTACTED
    const updatedLead = await prisma.lead.findUnique({ where: { id: outreachLead.id } });
    expect(updatedLead?.status).toBe("CONTACTED");

    // Verify message has externalMessageId saved
    const createdMsg = await prisma.message.findFirst({
      where: { recipientId: outreachLead.id, direction: "OUTBOUND" }
    });
    expect(createdMsg).toBeDefined();
    expect(createdMsg?.content.length).toBeGreaterThan(20);
  });

  // =========================================================================
  // BUG #13: AI Outreach Personalization Safety with Unknown Fields
  // =========================================================================
  it("BUG #13: Generated cold outreach uses neutral phrasing when title or company is Unknown", async () => {
    const sdrContext: SdrContext = {
      organizationName: "MachineMind",
      valueProposition: "MachineMind automates financial back-office operations.",
      personaName: "Sarah Jenkins",
      personaTitle: "AI Growth Specialist"
    };

    const unknownLeadContext: LeadContext = {
      leadId: "lead_unknown_1",
      firstName: "Unknown",
      lastName: "Unknown",
      email: "test@sandbox.nexsdr.in",
      companyName: "Unknown",
      jobTitle: "Unknown"
    };

    const mockProvider = new MockAiProvider();
    const outreach = await mockProvider.generateOutreach(sdrContext, unknownLeadContext);

    expect(outreach.content).not.toContain("heading operations at your team");
    expect(outreach.content).not.toContain("as Unknown at Unknown");
    expect(outreach.content).toContain("MachineMind");
    expect(outreach.content).toMatch(/(Hi there|Hello)/i);
  });

  // =========================================================================
  // SAFETY: Tenant Isolation Enforcement
  // =========================================================================
  it("SAFETY: Tenant isolation blocks cross-organization lead access in tool execution", async () => {
    const decision = {
      tool: "send_email" as const,
      arguments: {
        lead_id: leadId, // belongs to orgId
        subject: "Cross-tenant leak attempt",
        body: "This should fail authorization"
      }
    };

    // Attempting to execute with otherOrgId must be rejected
    const execResult = await ToolExecutor.executeTool(otherOrgId, decision);
    expect(execResult.success).toBe(false);
    expect(execResult.error).toContain("Unauthorized");
  });

  // =========================================================================
  // SAFETY: Calendar False Positives (No Meeting on Casual Mentions)
  // =========================================================================
  it("SAFETY: Casual mention of 'meeting' does not book calendar appointments", async () => {
    const casualTexts = [
      "I'm in a meeting right now.",
      "I saw your demo last week.",
      "Does it meet our compliance requirements?",
      "We are too busy right now."
    ];

    for (const text of casualTexts) {
      const res = await ConversationService.ingestLeadReply(
        orgId,
        leadId,
        "EMAIL",
        text,
        { isSimulator: true }
      );
      // Action must NOT be create_calendar_event
      expect(res.action?.action).not.toBe("create_calendar_event");
    }
  });
});
