import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import { LeadService } from "../services/leadService.js";
import { ConversationService } from "../services/conversationService.js";
import { PhoneService } from "../services/phoneService.js";
import { aiService } from "../services/ai/aiService.js";
import { registerWsClient } from "../lib/wsBroadcaster.js";
import { SdrContext, LeadContext, ConversationTurn } from "../services/ai/types.js";

describe.sequential("LEAD DELETION & SHARED AI BRAIN REGRESSION SUITE", () => {
  let orgAId: string;
  let orgBId: string;
  let sdrProfileId: string;
  let leadAId: string;
  let leadBId: string;

  beforeAll(async () => {
    // Org A
    const orgA = await prisma.organization.create({
      data: {
        name: "ApexFlow Solutions",
        industry: "Finance Automation",
        website: "https://apexflow.test",
        valueProposition: "ApexFlow automates invoice processing and ERP synchronization.",
        companyDescription: "ApexFlow builds autonomous finance agents for mid-market enterprises.",
        products: "FlowExtract, FlowSync",
        pricingInfo: "Starts at $299/mo.",
        competitors: "UiPath: ApexFlow requires zero brittle RPA script maintenance.",
        knowledgeBase: "FlowExtract extracts invoice data with 99.4% accuracy into SAP and NetSuite."
      }
    });
    orgAId = orgA.id;

    // Org B (for tenant isolation tests)
    const orgB = await prisma.organization.create({
      data: {
        name: "Competitor B",
        industry: "Logistics"
      }
    });
    orgBId = orgB.id;

    const sdr = await prisma.sdrProfile.create({
      data: {
        organizationId: orgAId,
        personaName: "Alex Rivera",
        title: "Growth Lead",
        tone: "Crisp, consultative, and direct"
      }
    });
    sdrProfileId = sdr.id;

    const leadA = await prisma.lead.create({
      data: {
        organizationId: orgAId,
        firstName: "Jordan",
        lastName: "Lee",
        email: "jordan.lee@acmecorp.test",
        companyName: "Acme Corp",
        jobTitle: "Operations Director",
        status: "NEW"
      }
    });
    leadAId = leadA.id;

    const leadB = await prisma.lead.create({
      data: {
        organizationId: orgBId,
        firstName: "Morgan",
        lastName: "Smith",
        email: "morgan@tenantb.test",
        companyName: "Tenant B Corp",
        jobTitle: "CTO",
        status: "NEW"
      }
    });
    leadBId = leadB.id;
  });

  afterAll(async () => {
    // Cleanup any lingering records
    try {
      await LeadService.deleteLead(orgAId, leadAId).catch(() => {});
      await LeadService.deleteLead(orgBId, leadBId).catch(() => {});
      await prisma.sdrProfile.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    } catch {}
  });

  // ==========================================
  // PART 1: TENANT-SAFE DELETE LEAD & CASCADE
  // ==========================================
  describe("Tenant-Safe Delete Lead & Cascade Cleanup", () => {
    let testLeadId: string;
    let wsEventsReceived: any[] = [];

    beforeAll(async () => {
      // Register WS mock listener for Org A
      registerWsClient({
        readyState: 1,
        send: (data: string) => {
          try {
            wsEventsReceived.push(JSON.parse(data));
          } catch {}
        }
      } as any, orgAId);

      // Create a lead with associated conversation, messages, tasks, and calls
      const testLead = await prisma.lead.create({
        data: {
          organizationId: orgAId,
          firstName: "Cascade",
          lastName: "TestLead",
          email: "cascade@test.com",
          companyName: "Cascade Inc",
          status: "ENGAGED"
        }
      });
      testLeadId = testLead.id;

      const conv = await prisma.conversation.create({
        data: {
          organizationId: orgAId,
          leadId: testLeadId,
          channel: "EMAIL"
        }
      });

      await prisma.message.create({
        data: {
          conversationId: conv.id,
          channel: "EMAIL",
          direction: "OUTBOUND",
          senderRole: "AI",
          senderName: "Alex Rivera",
          content: "Hello from ApexFlow"
        }
      });

      await prisma.followUpTask.create({
        data: {
          organizationId: orgAId,
          leadId: testLeadId,
          stepNumber: 1,
          scheduledFor: new Date(),
          channel: "EMAIL"
        }
      });

      await prisma.callSession.create({
        data: {
          organizationId: orgAId,
          leadId: testLeadId,
          callSid: "test_call_sid_123",
          direction: "OUTBOUND",
          status: "COMPLETED",
          transcriptJson: JSON.stringify([{ speaker: "SDR", text: "Hello" }])
        }
      });

      await prisma.appointment.create({
        data: {
          organizationId: orgAId,
          leadId: testLeadId,
          title: "Demo Call",
          attendeeEmail: "cascade@test.com",
          scheduledAt: new Date(),
          status: "CONFIRMED"
        }
      });
    });

    it("should prevent deleting a lead belonging to another organization (tenant isolation)", async () => {
      // Org B attempts to delete Org A's lead
      await expect(LeadService.deleteLead(orgBId, testLeadId)).rejects.toThrow("Lead not found or unauthorized");

      // Lead must still exist in DB
      const leadStillExists = await prisma.lead.findUnique({ where: { id: testLeadId } });
      expect(leadStillExists).not.toBeNull();
    });

    it("should atomically cascade-delete the lead and all child records", async () => {
      const result = await LeadService.deleteLead(orgAId, testLeadId);
      expect(result.success).toBe(true);

      // Verify lead is gone
      const lead = await prisma.lead.findUnique({ where: { id: testLeadId } });
      expect(lead).toBeNull();

      // Verify child records are gone
      const conversations = await prisma.conversation.findMany({ where: { leadId: testLeadId } });
      expect(conversations.length).toBe(0);

      const tasks = await prisma.followUpTask.findMany({ where: { leadId: testLeadId } });
      expect(tasks.length).toBe(0);

      const calls = await prisma.callSession.findMany({ where: { leadId: testLeadId } });
      expect(calls.length).toBe(0);

      const appointments = await prisma.appointment.findMany({ where: { leadId: testLeadId } });
      expect(appointments.length).toBe(0);
    });

    it("should broadcast LEAD_DELETED websocket event to the organization", () => {
      const deleteEvent = wsEventsReceived.find(e => e.type === "LEAD_DELETED" && e.payload?.leadId === testLeadId);
      expect(deleteEvent).toBeDefined();
      expect(deleteEvent.payload.leadId).toBe(testLeadId);
    });
  });

  // ==========================================
  // PART 2: COLD OUTREACH DISAGGREGATION
  // ==========================================
  describe("Cold Outreach Disaggregation (Generation vs Delivery)", () => {
    it("should generate AI outreach content and persist message even if email delivery fails", async () => {
      // Trigger AI outreach for leadAId
      // In test environment, without Resend or SMTP keys, delivery should fail gracefully
      const result = await LeadService.triggerAiOutreach(orgAId, leadAId);

      expect(result.outreachGenerated).toBe(true);
      expect(result.subject).toBeDefined();
      expect(result.body).toBeDefined();
      expect(result.body.length).toBeGreaterThan(10);
      expect(result.provider).toBeDefined();

      // Verify that conversation and message were created in the database
      const conv = await prisma.conversation.findFirst({
        where: { leadId: leadAId, organizationId: orgAId },
        include: { messages: true }
      });
      expect(conv).not.toBeNull();
      expect(conv!.messages.length).toBeGreaterThanOrEqual(1);

      const latestMsg = conv!.messages[conv!.messages.length - 1];
      expect(latestMsg.content).toContain(result.body.slice(0, 20));

      // Delivery status should reflect real state (DELIVERY_FAILED or SENT) without throwing 500
      if (!result.deliverySuccess) {
        expect(latestMsg.status).toBe("DELIVERY_FAILED");
        expect(result.deliveryError).toBeDefined();
      } else {
        expect(latestMsg.status).toBe("SENT");
      }
    });
  });

  // ==========================================
  // PART 3: MULTI-TURN AI CONVERSATION BRAIN
  // ==========================================
  describe("Multi-Turn Shared AI Context & Prompt Progression", () => {
    let simulatorLeadId: string;
    let convId: string;

    beforeAll(async () => {
      const simLead = await prisma.lead.create({
        data: {
          organizationId: orgAId,
          firstName: "Marcus",
          lastName: "Vance",
          email: "marcus@financeops.test",
          companyName: "FinanceOps Inc",
          jobTitle: "VP of Operations",
          status: "NEW"
        }
      });
      simulatorLeadId = simLead.id;

      const conv = await prisma.conversation.create({
        data: {
          organizationId: orgAId,
          leadId: simulatorLeadId,
          channel: "EMAIL"
        }
      });
      convId = conv.id;
    });

    afterAll(async () => {
      await LeadService.deleteLead(orgAId, simulatorLeadId).catch(() => {});
    });

    it("Turn 1 ('ohk hi'): returns consultative discovery without repetitive company boilerplate", async () => {
      const res1 = await ConversationService.ingestLeadReply(
        orgAId,
        simulatorLeadId,
        "EMAIL",
        "ohk hi",
        { isSimulator: true, conversationId: convId }
      );

      const reply1 = res1.outboundMsg?.content || "";
      expect(reply1.length).toBeGreaterThan(0);
      // Must not hallucinate old hardcoded identities
      expect(reply1).not.toContain("CloudFlow AI");
      expect(reply1).not.toContain("technew");
      expect(reply1).not.toMatch(/\btanish\b/i);
      // Must not dump company description repeatedly
      expect(reply1).not.toContain("ApexFlow builds autonomous finance agents for mid-market enterprises. FlowExtract extracts invoice data");
    });

    it("Turn 2 ('i have 50 people working for me'): directly acknowledges team size/headcount", async () => {
      const res2 = await ConversationService.ingestLeadReply(
        orgAId,
        simulatorLeadId,
        "EMAIL",
        "i have 50 people working for me",
        { isSimulator: true, conversationId: convId }
      );

      const reply2 = res2.outboundMsg?.content || "";
      // Must acknowledge the 50 people / team size
      const mentionsHeadcount = /50|team|headcount|people/i.test(reply2);
      expect(mentionsHeadcount).toBe(true);
      // Must NOT repeat opening greeting or company intro
      expect(reply2).not.toMatch(/^At ApexFlow/i);
    });

    it("Turn 3 ('we process invoices manually'): addresses manual invoice extraction directly", async () => {
      const res3 = await ConversationService.ingestLeadReply(
        orgAId,
        simulatorLeadId,
        "EMAIL",
        "we process invoices manually",
        { isSimulator: true, conversationId: convId }
      );

      const reply3 = res3.outboundMsg?.content || "";
      const mentionsInvoices = /invoice|manual|extract|process|sap|netsuite/i.test(reply3);
      expect(mentionsInvoices).toBe(true);
      // Must NOT dump full product catalog or repeat opening company boilerplate
      expect(reply3).not.toMatch(/^At ApexFlow/i);
    });

    it("Turn 4 ('we already use UiPath'): addresses competitor differentiation respectfully", async () => {
      const res4 = await ConversationService.ingestLeadReply(
        orgAId,
        simulatorLeadId,
        "EMAIL",
        "we already use UiPath",
        { isSimulator: true, conversationId: convId }
      );

      const reply4 = res4.outboundMsg?.content || "";
      const mentionsUiPath = /uipath|rpa|script|automate|complement|integrate|choice/i.test(reply4);
      expect(mentionsUiPath).toBe(true);
      // Should not disparage competitor or dump company description
      expect(reply4).not.toMatch(/^At ApexFlow/i);
    });

    it("Turn 5 ('how would you actually help us?'): explains transition clearly and conversationally", async () => {
      const res5 = await ConversationService.ingestLeadReply(
        orgAId,
        simulatorLeadId,
        "EMAIL",
        "how would you actually help us?",
        { isSimulator: true, conversationId: convId }
      );

      const reply5 = res5.outboundMsg?.content || "";
      const explainsSolution = /agent|flow|workflow|extract|erp|system|help|solution|process/i.test(reply5);
      expect(explainsSolution).toBe(true);
      // Should not repeat opening greetings or company boilerplate
      expect(reply5).not.toMatch(/^At ApexFlow/i);
    });
  });

  // ==========================================
  // PART 4: MULTI-TURN PHONE VOICE AGENT
  // ==========================================
  describe("Multi-Turn Phone Voice Agent Conciseness & Progression", () => {
    let callSid: string;

    it("should initiate call and deliver introductory greeting", async () => {
      const call = await PhoneService.initiateCall(orgAId, leadAId, "OUTBOUND");
      callSid = call.session.callSid;
      expect(call.greeting).toBeDefined();
      expect(call.greeting).toContain("Alex Rivera");
      expect(call.greeting).toContain("ApexFlow");
    });

    it("should process ongoing phone turns without repeating 'At ApexFlow' intro", async () => {
      // Turn 1
      const turn1 = await PhoneService.processCallTurn(
        orgAId,
        callSid,
        "What do you guys do?"
      );
      expect(turn1.sdrSpeech).toBeDefined();

      // Turn 2
      const turn2 = await PhoneService.processCallTurn(
        orgAId,
        callSid,
        "We have 50 people doing invoices manually."
      );
      expect(turn2.sdrSpeech).toBeDefined();
      // On turn 2, transcript length > 2, must NOT start with "At ApexFlow"
      expect(turn2.sdrSpeech).not.toMatch(/^At ApexFlow/i);

      // Verify speech is clean for telephone audio (no markdown, concise)
      expect(turn2.sdrSpeech).not.toMatch(/[*_#`~]/);
      const wordCount = turn2.sdrSpeech.split(/\s+/).filter(Boolean).length;
      expect(wordCount).toBeLessThanOrEqual(35);
    });
  });
});
