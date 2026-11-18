import { ChannelManager } from "../services/channels/channelManager.js";
import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import { LeadService } from "../services/leadService.js";
import { ConversationService } from "../services/conversationService.js";
import { PhoneService } from "../services/phoneService.js";
import { FollowUpEngine } from "../services/followUpEngine.js";
import { HandoffService } from "../services/handoffService.js";
import { AnalyticsService } from "../services/analyticsService.js";
import { ToolExecutor } from "../services/toolExecutor.js";
import { MockAiProvider } from "../services/ai/mockProvider.js";

describe.sequential("AI SDR Platform End-to-End Suite", () => {
  let testOrgId: string;

  beforeAll(async () => {
    // Setup test organization
    const org = await prisma.organization.create({
      data: {
        name: "TestCorp SaaS",
        valueProposition: "Automating accounts payable with AI",
        targetCustomerIcp: "CFOs and controllers",
        knowledgeBase: "TestCorp saves 20 hours per week on invoice matching. Bank-grade SOC2 compliance and guaranteed enterprise SLAs.",
        pricingInfo: "Starter ($199/mo) and Growth ($499/mo).",
        complianceInfo: "Bank-grade SOC2 compliance and guaranteed enterprise SLAs.",
        competitors: "Zapier: We provide deep AI reconciliation and SOC2 compliance that consumer tools like Zapier lack."
      }
    });
    testOrgId = org.id;

    await prisma.sdrProfile.create({
      data: {
        organizationId: testOrgId,
        personaName: "Jordan Blake",
        title: "Senior SDR",
        tone: "Professional and consultative"
      }
    });
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: testOrgId } });
  });

  it("1. Generates personalized cold outreach with tool decision", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: testOrgId,
        firstName: "Alice",
        lastName: "Smith",
        email: `alice_${Date.now()}@finco.test`,
        companyName: "FinCo Global",
        status: "NEW"
      }
    });

    const transport = vi.spyOn(ChannelManager, "dispatch").mockResolvedValueOnce({ success: true, channel: "EMAIL", providerStatus: "REAL", externalMessageId: "test-provider-message" });
    const result = await LeadService.triggerAiOutreach(testOrgId, lead.id);
    transport.mockRestore();
    expect(result.deliverySuccess).toBe(true);
    expect(result).toBeDefined();

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.status).toBe("CONTACTED");

    const conv = await prisma.conversation.findFirst({
      where: { leadId: lead.id, organizationId: testOrgId }
    });
    expect(conv).toBeDefined();

    const messages = await prisma.message.findMany({ where: { conversationId: conv!.id } });
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].direction).toBe("OUTBOUND");
  });

  it("2. Ingests lead reply and handles price objection professionally", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: testOrgId,
        firstName: "Bob",
        lastName: "Davis",
        email: `bob_${Date.now()}@finco.test`,
        companyName: "FinCo Global",
        status: "CONTACTED"
      }
    });

    const replyResult = await ConversationService.ingestLeadReply(
      testOrgId,
      lead.id,
      "EMAIL",
      "Your pricing seems 3x more expensive than Zapier. Why should we pay this?"
    );

    expect(replyResult.inboundMsg).toBeDefined();
    expect(replyResult.outboundMsg).toBeDefined();
    expect(replyResult.outboundMsg?.content.toLowerCase()).toContain("compliance");

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.status).toBe("IN_CONVERSATION");
  });

  it("3. Automatically schedules calendar meeting on prospect intent", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: testOrgId,
        firstName: "Carol",
        lastName: "Taylor",
        email: `carol_${Date.now()}@finco.test`,
        companyName: "FinCo Global",
        status: "IN_CONVERSATION"
      }
    });

    const bookingResult = await ConversationService.ingestLeadReply(
      testOrgId,
      lead.id,
      "EMAIL",
      "Can we schedule a 20-minute demo this Thursday afternoon? My VP will join."
    );

    expect(bookingResult.toolExecution?.success).toBe(true);
    expect(bookingResult.toolExecution?.tool).toBe("create_calendar_event");

    const appointments = await prisma.appointment.findMany({
      where: { leadId: lead.id, organizationId: testOrgId }
    });
    expect(appointments.length).toBe(1);

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.status).toBe("QUALIFIED");
  });

  it("4. Triggers human handoff escalation when enterprise scale is requested", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: testOrgId,
        firstName: "David",
        lastName: "Miller",
        email: `david_${Date.now()}@finco.test`,
        companyName: "FinCo Global",
        status: "IN_CONVERSATION"
      }
    });

    const escalationResult = await ConversationService.ingestLeadReply(
      testOrgId,
      lead.id,
      "EMAIL",
      "We need dedicated on-prem SOC2 deployment for 10,000 corporate seats. Connect me to your enterprise sales director immediately."
    );

    expect(escalationResult.toolExecution?.success).toBe(true);
    expect(escalationResult.toolExecution?.tool).toBe("human_handoff");

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.status).toBe("HANDOFF_REQUIRED");

    const escalations = await HandoffService.getEscalations(testOrgId);
    expect(escalations.length).toBeGreaterThanOrEqual(1);
  });

  it("5. Respects lead opt-out and blocks further automated outreach", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: testOrgId,
        firstName: "Emma",
        lastName: "Watson",
        email: `emma_${Date.now()}@finco.test`,
        companyName: "FinCo Global",
        status: "CONTACTED"
      }
    });

    // Schedule a pending followup
    await prisma.followUpTask.create({
      data: {
        organizationId: testOrgId,
        leadId: lead.id,
        stepNumber: 2,
        channel: "EMAIL",
        scheduledFor: new Date(Date.now() + 86400000),
        status: "SCHEDULED"
      }
    });

    // Lead replies STOP
    const optOutResult = await ConversationService.ingestLeadReply(
      testOrgId,
      lead.id,
      "EMAIL",
      "STOP - Please unsubscribe me from your emails."
    );

    expect(optOutResult.optedOut).toBe(true);

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.isOptedOut).toBe(true);
    expect(updatedLead?.status).toBe("OPTED_OUT");

    // Verify pending followups are cancelled
    const pendingTasks = await prisma.followUpTask.findMany({
      where: { leadId: lead.id, status: "SCHEDULED" }
    });
    expect(pendingTasks.length).toBe(0);

    // Attempting further outreach should be rejected
    await expect(LeadService.triggerAiOutreach(testOrgId, lead.id)).rejects.toThrow();
  });

  it("6. Runs complete interactive voice phone call lifecycle", async () => {
    // Create new lead for call test
    const callLead = await prisma.lead.create({
      data: {
        organizationId: testOrgId,
        firstName: "Brian",
        lastName: "Fox",
        email: "brian@logistics.test",
        companyName: "Logistics Hub",
        status: "NEW"
      }
    });

    // Initiate call
    const init = await PhoneService.initiateCall(testOrgId, callLead.id, "OUTBOUND");
    expect(init.session.status).toBe("IN_PROGRESS");
    expect(init.greeting).toContain("Jordan Blake");

    // Turn 1: Lead responds
    const turn1 = await PhoneService.processCallTurn(
      testOrgId,
      init.session.callSid,
      "Hey Jordan, yes we're dealing with slow invoice processing every day."
    );
    expect(turn1.sdrSpeech).toBeDefined();
    expect(turn1.transcript.length).toBe(3); // greeting, lead, sdr

    // Complete call
    const completed = await PhoneService.completeCall(testOrgId, init.session.callSid, 75);
    expect(completed.session.status).toBe("COMPLETED");
    expect(completed.analysis.qualificationScore).toBeGreaterThanOrEqual(60);
    expect(completed.analysis.summary).toContain("Brian");
  });

  it("7. Aggregates live analytics accurately across funnel", async () => {
    const analytics = await AnalyticsService.getOverview(testOrgId);
    expect(analytics.totalLeads).toBeGreaterThanOrEqual(2);
    expect(analytics.emailsSent).toBeGreaterThanOrEqual(1);
    expect(analytics.callsPlaced).toBeGreaterThanOrEqual(1);
  });
});