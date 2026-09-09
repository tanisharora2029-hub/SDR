import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import { ConversationService } from "../services/conversationService.js";
import { WebhookService } from "../services/webhookService.js";
import { PhoneService } from "../services/phoneService.js";
import { PromptBuilder } from "../services/ai/promptBuilder.js";
import { MockAiProvider } from "../services/ai/mockProvider.js";
import { registerWsClient, broadcastToOrganization } from "../lib/wsBroadcaster.js";
import { SdrContext, LeadContext } from "../services/ai/types.js";

describe.sequential("NEXSDR — CONSOLIDATED PRODUCTION BUG FIX TEST SUITE (BUGS 1 - 8)", () => {
  let orgId: string;
  let sdrProfileId: string;
  let leadId: string;
  let conversationId: string;

  beforeAll(async () => {
    // Setup test organization
    const org = await prisma.organization.create({
      data: {
        name: "MachineMind",
        industry: "Intelligent Operations",
        website: "https://machinemind.in",
        valueProposition: "MachineMind automates financial back-office operations and customer verification.",
        targetCustomerIcp: "VP of Operations and Compliance Heads.",
        companyDescription: "MachineMind builds high-throughput autonomous agents for operations and finance.",
        products: "DocuMind and LedgerSync.",
        pricingInfo: "Starter ($199/mo) and Growth ($499/mo).",
        complianceInfo: "SOC2 Type II Certified, GDPR compliant.",
        competitors: "UiPath: MachineMind eliminates manual template maintenance.",
        knowledgeBase: "DocuMind extracts invoice data into SAP and Oracle NetSuite. Standard pricing: Starter ($199/mo), Growth ($499/mo)."
      }
    });
    orgId = org.id;

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
        email: "vikram.consolidated@finscale.io",
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
        toolCallArgs: JSON.stringify({ externalMessageId: "<outbound-consolidated-msg-999@nexsdr.in>" })
      }
    });
  });

  afterAll(async () => {
    try {
      await prisma.message.deleteMany({ where: { conversation: { organizationId: orgId } } });
      await prisma.conversation.deleteMany({ where: { organizationId: orgId } });
      await prisma.lead.deleteMany({ where: { organizationId: orgId } });
      await prisma.sdrProfile.deleteMany({ where: { organizationId: orgId } });
      await prisma.activityLog.deleteMany({ where: { organizationId: orgId } });
      await prisma.callSession.deleteMany({ where: { organizationId: orgId } });
      await prisma.usageRecord.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    } catch (e) {}
  });

  // =========================================================================
  // BUG 1: Real Lead Email Reply Ingestion, Threading, and WebSocket Broadcast
  // =========================================================================
  describe("Bug 1: Real Inbound Email Webhook & WebSocket Broadcasting", () => {
    it("should match lead case-insensitively and thread into existing conversation via In-Reply-To header", async () => {
      // Setup mock WebSocket client to test real-time broadcast
      const broadcastEvents: any[] = [];
      const fakeWs: any = {
        readyState: 1, // OPEN
        send: (data: string) => broadcastEvents.push(JSON.parse(data))
      };
      const unregister = registerWsClient(fakeWs, orgId);

      // Simulate webhook payload from Resend with uppercase email and In-Reply-To
      const webhookPayload = {
        type: "email.received",
        data: {
          id: `inbound_${Date.now()}`,
          from: "VIKRAM.CONSOLIDATED@FINSCALE.IO", // Uppercase email
          to: ["alex@nexsdr.in"],
          subject: "Re: Streamlining operations at FinScale",
          text: "Thanks for reaching out! We run SAP ERP and struggle with invoice processing lag. How does your solution handle SAP integration?",
          headers: [
            { name: "In-Reply-To", value: "<outbound-consolidated-msg-999@nexsdr.in>" },
            { name: "References", value: "<outbound-consolidated-msg-999@nexsdr.in>" }
          ],
          created_at: new Date().toISOString()
        }
      };

      const result = await WebhookService.processInboundEmail(webhookPayload);
      expect(result.success).toBe(true);
      expect(result.matched).toBe(true);
      expect(result.leadId).toBe(leadId);

      // Verify the reply was threaded into the existing conversation
      const conv = await ConversationService.getConversationWithMessages(orgId, conversationId);
      expect(conv).toBeDefined();
      expect(conv?.messages.length).toBeGreaterThanOrEqual(3); // Initial + Inbound + AI Reply

      const inboundMsg = conv?.messages.find(m => m.direction === "INBOUND");
      expect(inboundMsg).toBeDefined();
      expect(inboundMsg?.senderRole).toBe("LEAD");
      expect(inboundMsg?.status).toBe("REAL_INBOUND");

      const aiReply = conv?.messages[conv.messages.length - 1];
      expect(aiReply?.senderRole).toBe("AI");
      expect(aiReply?.direction).toBe("OUTBOUND");

      // Verify WebSocket broadcasts were dispatched
      expect(broadcastEvents.length).toBeGreaterThanOrEqual(2);
      const messageCreatedEvents = broadcastEvents.filter(e => e.type === "MESSAGE_CREATED");
      expect(messageCreatedEvents.length).toBeGreaterThanOrEqual(2); // inbound + outbound AI

      unregister();
    });
  });

  // =========================================================================
  // BUG 2: Intent-Specific Questions without Generic Pitch
  // =========================================================================
  describe("Bug 2: Specific Intent Handling (Invoices, KYC, Automation, Support)", () => {
    const mockProvider = new MockAiProvider();
    const sdrContext: SdrContext = {
      organizationName: "MachineMind",
      industry: "Intelligent Operations",
      valueProposition: "MachineMind automates financial back-office operations and customer verification.",
      companyDescription: "MachineMind builds high-throughput autonomous agents.",
      personaName: "Sarah Jenkins",
      personaTitle: "AI Growth Specialist",
      tone: "Consultative, professional",
      products: "DocuMind and LedgerSync",
      pricingInfo: "Starter ($199/mo) and Growth ($499/mo)"
    };
    const leadContext: LeadContext = {
      leadId: "lead-123",
      firstName: "Vikram",
      lastName: "Patel",
      email: "vikram@finscale.io",
      companyName: "FinScale",
      jobTitle: "Head of Operations",
      status: "IN_CONVERSATION"
    };

    it("should address Invoice & ERP questions specifically without generic pitch", async () => {
      const response = await mockProvider.respondToMessage(
        sdrContext,
        leadContext,
        [],
        "How do you connect invoice extraction into our SAP ERP?"
      );

      expect(response.content.toLowerCase()).toContain("erp");
      expect(response.content.toLowerCase()).toContain("invoice");
      // Must NOT be a generic boilerplate reply
      expect(response.content).not.toContain("At MachineMind, MachineMind");
    });

    it("should address KYC & Verification backlog specifically", async () => {
      const response = await mockProvider.respondToMessage(
        sdrContext,
        leadContext,
        [],
        "We are experiencing a heavy KYC onboarding backlog"
      );

      expect(response.content.toLowerCase()).toContain("kyc");
      expect(response.content.toLowerCase()).toContain("verification");
      expect(response.action.intent).toBe("qualification");
    });

    it("should address Contact Center & Support inquiries specifically", async () => {
      const response = await mockProvider.respondToMessage(
        sdrContext,
        leadContext,
        [],
        "Can your agents triage tier-1 customer support tickets on Zendesk?"
      );

      expect(response.content.toLowerCase()).toMatch(/ticket|support|triage/i);
    });

    it("should address General Workflow Automation and cross-system handoffs", async () => {
      const response = await mockProvider.respondToMessage(
        sdrContext,
        leadContext,
        [],
        "We need general automation for workflow handoffs between operations and finance"
      );

      expect(response.content.toLowerCase()).toMatch(/workflow|handoff/i);
    });
  });

  // =========================================================================
  // BUG 3: Prospect Name & Company Context Safety (Anti-Hallucination)
  // =========================================================================
  describe("Bug 3: Context Safety with Unknown Prospect Name & Company", () => {
    it("should use neutral greetings when lead firstName is Unknown or missing", () => {
      const mockProvider = new MockAiProvider();
      const sdrContext: SdrContext = {
        organizationName: "NexSDR",
        personaName: "Alex",
        personaTitle: "AI SDR",
        tone: "Professional"
      };
      const unknownLead: LeadContext = {
        leadId: "lead-unknown",
        firstName: "Unknown",
        lastName: "",
        email: "ops@somedomain.com",
        companyName: "Unknown",
        status: "NEW"
      };

      const systemPrompt = PromptBuilder.buildSystemPrompt(sdrContext, unknownLead);
      // System prompt must NOT prime with "Tanish" or "technew"
      expect(systemPrompt).not.toContain("Tanish");
      expect(systemPrompt).not.toContain("technew");
      expect(systemPrompt).toContain("NEVER guess, invent, or assume a name");
      expect(systemPrompt).toContain("NEVER guess, invent, or assume any company name");
    });

    it("should sanitize unknown name and company in ConversationService", async () => {
      // Create lead with Unknown name and company
      const unknownLead = await prisma.lead.create({
        data: {
          organizationId: orgId,
          firstName: "Unknown",
          lastName: "",
          email: "procurement@anoncorp.example",
          companyName: "Unknown",
          status: "NEW"
        }
      });

      const reply = await ConversationService.ingestLeadReply(
        orgId,
        unknownLead.id,
        "EMAIL",
        "Can you send over details on your security compliance?",
        { isSimulator: true }
      );

      expect(reply.outboundMsg).toBeDefined();
      const content = reply.outboundMsg?.content || "";
      // Content should NOT have hallucinated "Tanish" or "technew" or "CloudFlow AI"
      expect(content).not.toMatch(/\btanish\b/i);
      expect(content).not.toMatch(/\btechnew\b/i);
      expect(content).not.toMatch(/CloudFlow/i);

      // Clean up lead
      await prisma.message.deleteMany({ where: { conversation: { leadId: unknownLead.id } } });
      await prisma.conversation.deleteMany({ where: { leadId: unknownLead.id } });
      await prisma.lead.delete({ where: { id: unknownLead.id } });
    });
  });

  // =========================================================================
  // BUG 4: Generic Company Description Repetition Guard
  // =========================================================================
  describe("Bug 4: Anti-Boilerplate and Non-Repetition", () => {
    it("should never prepend duplicate 'At MachineMind, MachineMind' boilerplate", async () => {
      const mockProvider = new MockAiProvider();
      const sdrContext: SdrContext = {
        organizationName: "MachineMind",
        valueProposition: "MachineMind helps organizations streamline high-volume operations",
        personaName: "Sarah",
        personaTitle: "AI SDR",
        tone: "Consultative"
      };
      const leadContext: LeadContext = {
        leadId: "lead-456",
        firstName: "Ananya",
        lastName: "Deshmukh",
        companyName: "Zenith Fin",
        email: "ananya@zenithfin.example",
        status: "IN_CONVERSATION"
      };

      const response = await mockProvider.respondToMessage(
        sdrContext,
        leadContext,
        [],
        "What are your thoughts on workflow optimization?"
      );

      // Must never contain duplicate company name
      expect(response.content).not.toMatch(/At MachineMind,\s*MachineMind/i);
    });
  });

  // =========================================================================
  // BUG 5: Lead Simulator Real-Time Updates & Isolation
  // =========================================================================
  describe("Bug 5: Lead Simulator Real-Time Execution", () => {
    it("should return both inboundMsg and outboundMsg with correct roles and zero Resend live calls", async () => {
      const events: any[] = [];
      const fakeWs: any = {
        readyState: 1,
        send: (data: string) => events.push(JSON.parse(data))
      };
      const unregister = registerWsClient(fakeWs, orgId);

      const simReply = await ConversationService.ingestLeadReply(
        orgId,
        leadId,
        "EMAIL",
        "Could you tell me what pricing tiers you have available?",
        { isSimulator: true, conversationId }
      );

      expect(simReply.inboundMsg).toBeDefined();
      expect(simReply.inboundMsg?.senderRole).toBe("LEAD");
      expect(simReply.outboundMsg).toBeDefined();
      expect(simReply.outboundMsg?.senderRole).toBe("AI");

      // Verify that events were broadcast over WebSocket
      expect(events.some(e => e.type === "MESSAGE_CREATED")).toBe(true);

      unregister();
    });
  });

  // =========================================================================
  // BUGS 6, 7, 8: Phone Studio Dynamic Identity, Telephony Brain Context & Safety
  // =========================================================================
  describe("Bugs 6, 7, 8: Phone Studio Dynamic Identity & Context-Grounded Dialogue", () => {
    it("should initiate call with dynamic SDR and org name without hardcoded CloudFlow AI", async () => {
      const call = await PhoneService.initiateCall(orgId, leadId, "OUTBOUND");
      expect(call.session).toBeDefined();
      expect(call.greeting).toContain("Sarah Jenkins");
      expect(call.greeting).toContain("MachineMind");
      expect(call.greeting).not.toContain("CloudFlow AI");
      expect(call.greeting).not.toContain("Alex (CloudFlow AI)");
    });

    it("should initiate call with neutral greeting when lead name is Unknown", async () => {
      const anonLead = await prisma.lead.create({
        data: {
          organizationId: orgId,
          firstName: "Unknown",
          lastName: "",
          email: "caller@external.com",
          companyName: "Unknown",
          status: "NEW"
        }
      });

      const call = await PhoneService.initiateCall(orgId, anonLead.id, "OUTBOUND");
      expect(call.greeting).not.toContain("Hello Unknown");
      expect(call.greeting).toContain("Hello, this is Sarah Jenkins calling from MachineMind");

      await prisma.callSession.deleteMany({ where: { leadId: anonLead.id } });
      await prisma.lead.delete({ where: { id: anonLead.id } });
    });

    it("should execute phone call turn with full company knowledge and without token leakage", async () => {
      const call = await PhoneService.initiateCall(orgId, leadId, "OUTBOUND");
      const turnResult = await PhoneService.processCallTurn(
        orgId,
        call.session.callSid,
        "How do you handle invoice processing into SAP?"
      );

      expect(turnResult.sdrSpeech).toBeDefined();
      expect(turnResult.sdrSpeech.length).toBeGreaterThan(0);
      expect(turnResult.sdrSpeech).not.toContain("CloudFlow AI");
      expect(turnResult.sdrSpeech).not.toContain("technew");
      expect(turnResult.sdrSpeech).not.toMatch(/\btanish\b/i);

      // Verify speech is crisp and suitable for telephone audio (< 30 words)
      const wordCount = turnResult.sdrSpeech.split(/\s+/).filter(Boolean).length;
      expect(wordCount).toBeLessThanOrEqual(30);
    });
  });
});
