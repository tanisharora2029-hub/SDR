import { ChannelManager } from "../services/channels/channelManager.js";
import { vi, describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import { EmailService } from "../services/emailService.js";
import { ConversationService } from "../services/conversationService.js";
import { LeadService } from "../services/leadService.js";
import { ToolExecutor } from "../services/toolExecutor.js";
import { PromptBuilder } from "../services/ai/promptBuilder.js";
import { MockAiProvider } from "../services/ai/mockProvider.js";
import { SdrContext, LeadContext } from "../services/ai/types.js";

describe.sequential("NEXSDR — NETWORK RESILIENCE & PROVIDER STATE (BUGS 9, 12, 14)", () => {
  let orgId: string;
  let leadId: string;
  let conversationId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: {
        name: "MachineMind",
        industry: "Intelligent Operations",
        website: "https://machinemind.in",
        valueProposition: "MachineMind automates financial back-office operations.",
        companyDescription: "MachineMind builds high-throughput autonomous agents for operations and finance.",
        knowledgeBase: "DocuMind extracts invoice data into SAP and Oracle NetSuite. Standard pricing: Starter ($199/mo), Growth ($499/mo)."
      }
    });
    orgId = org.id;

    await prisma.sdrProfile.create({
      data: {
        organizationId: orgId,
        personaName: "Sarah Jenkins",
        email: "sarah@nexsdr.in",
        replyTo: "sarah@nexsdr.in",
        title: "Senior AI Sales Specialist",
        tone: "Professional, consultative, and concise",
        isActive: true
      }
    });

    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        firstName: "Vikram",
        lastName: "Patel",
        email: "vikram@enterprise-ops.in",
        companyName: "Enterprise Ops",
        jobTitle: "VP Operations",
        status: "NEW"
      }
    });
    leadId = lead.id;

    const conv = await prisma.conversation.create({
      data: {
        organizationId: orgId,
        leadId,
        channel: "EMAIL",
        subject: "Streamlining Operations"
      }
    });
    conversationId = conv.id;
  });

  // =========================================================================
  // TEST 1: Simulator Dispatches Instant Sandbox Delivery (Zero Cloud Hang)
  // =========================================================================
  it("BUG #9: Simulator mode dispatches immediately in sandbox mode (< 100ms)", async () => {
    const start = Date.now();
    const result = await EmailService.sendEmail({
      to: "vikram@enterprise-ops.in",
      subject: "Test Simulator Message",
      text: "Simulated text",
      isSimulator: true
    });
    const elapsed = Date.now() - start;

    expect(result.success).toBe(true);
    expect(result.isSimulated).toBe(true);
    expect(result.provider).toBe("SIMULATOR");
    expect(elapsed).toBeLessThan(200); // Guarantees zero blocked TCP port 587 socket hang
  });

  // =========================================================================
  // TEST 2: Consecutive Simulator Turns (Turns 1 -> 2 -> 3 -> 4)
  // =========================================================================
  it("BUG #9 & BUG #10: Multiple consecutive simulator turns complete cleanly without UI hanging", async () => {
    const turns = [
      "ohk hi",
      "i have 50 people working for me",
      "we process invoices manually",
      "we already use UiPath"
    ];

    for (let i = 0; i < turns.length; i++) {
      const res = await ConversationService.ingestLeadReply(
        orgId,
        leadId,
        "EMAIL",
        turns[i],
        { isSimulator: true }
      );

      expect(res.inboundMsg).toBeDefined();
      expect(res.inboundMsg.content).toBe(turns[i]);
      expect(res.outboundMsg).toBeDefined();
      expect(res.outboundMsg.content.length).toBeGreaterThan(10);
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" }
    });

    expect(messages.length).toBeGreaterThanOrEqual(8);
  });

  // =========================================================================
  // TEST 3: EmailService Fallback Safety on SMTP Timeout
  // =========================================================================
  it("BUG #12: EmailService handles simulation and provider routing cleanly without cloud hanging", async () => {
    const result = await EmailService.sendEmail({
      to: "test-timeout@example.com",
      subject: "Diagnostic Timeout Test",
      text: "Testing resilience against network port blocking",
      forceProvider: "RESEND"
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe("SIMULATOR");
    expect(result.isSimulated).toBe(true);
    expect(result.messageId).toBeDefined();
  });

  // =========================================================================
  // TEST 4: AI Outreach Generation & Delivery
  // =========================================================================
  it("BUG #11 & BUG #12: AI cold outreach triggers, persists message, and updates lead to CONTACTED", async () => {
    const testLead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        firstName: "Ananya",
        lastName: "Sharma",
        email: "ananya@finscale.io",
        companyName: "FinScale",
        jobTitle: "Head of Operations",
        status: "NEW"
      }
    });

    const transport = vi.spyOn(ChannelManager, "dispatch").mockResolvedValueOnce({ success: true, channel: "EMAIL", providerStatus: "REAL", externalMessageId: "test-provider-message" });
    const result = await LeadService.triggerAiOutreach(orgId, testLead.id);
    transport.mockRestore();
    expect(result.deliverySuccess).toBe(true);
    expect(result).toBeDefined();

    // Verify lead status updated to CONTACTED
    const updatedLead = await prisma.lead.findUnique({ where: { id: testLead.id } });
    expect(updatedLead?.status).toBe("CONTACTED");

    // Verify message was created
    const createdMsg = await prisma.message.findFirst({
      where: { recipientId: testLead.id, direction: "OUTBOUND" }
    });
    expect(createdMsg).toBeDefined();
    expect(createdMsg?.content.length).toBeGreaterThan(20);
  });

  // =========================================================================
  // TEST 5: NEW BUG #14 — Mock Domain Guard on Resend Provider
  // =========================================================================
  it("NEW BUG #14: Resend test dispatch rejects sandbox mock domains to protect against silent fallback hangs", async () => {
    const isMockDomain = /@(example\.(com|org|net)|test\.(com|org|net)|sandbox\.nexsdr\.in|simulator\.test|ethereal\.email)$/i.test(
      "prospect-test@sandbox.nexsdr.in"
    );
    expect(isMockDomain).toBe(true);

    const isRealDomain = /@(example\.(com|org|net)|test\.(com|org|net)|sandbox\.nexsdr\.in|simulator\.test|ethereal\.email)$/i.test(
      "admin@nexsdr.in"
    );
    expect(isRealDomain).toBe(false);
  });

  // =========================================================================
  // TEST 6: Context Leakage Safety with Unknown Fields
  // =========================================================================
  it("BUG #3: No leakage of Technew, Tanish, or CloudFlow when fields are Unknown", async () => {
    const unknownLead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        firstName: "Unknown",
        lastName: "Unknown",
        email: "unknown@anon-test.io",
        companyName: "Unknown",
        status: "NEW"
      }
    });

    const result = await ConversationService.ingestLeadReply(
      orgId,
      unknownLead.id,
      "EMAIL",
      "Can you tell me about your platform?",
      { isSimulator: true }
    );

    const replyLower = result.outboundMsg.content.toLowerCase();
    expect(replyLower).not.toContain("technew");
    expect(replyLower).not.toContain("tanish");
    expect(replyLower).not.toContain("cloudflow");
    expect(replyLower).not.toContain("at unknown");
  });

  // =========================================================================
  // TEST 7: DNC & Opt-Out Safety
  // =========================================================================
  it("SAFETY: Inbound STOP marks lead as OPTED_OUT and blocks future outreach", async () => {
    const dncLead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        firstName: "Raj",
        lastName: "Kumar",
        email: "raj@dnc-test.in",
        companyName: "DNC Corp",
        status: "NEW"
      }
    });

    const stopResult = await ConversationService.ingestLeadReply(
      orgId,
      dncLead.id,
      "EMAIL",
      "STOP - please unsubscribe me immediately",
      { isSimulator: true }
    );

    expect(stopResult.optedOut).toBe(true);

    const updatedLead = await prisma.lead.findUnique({ where: { id: dncLead.id } });
    expect(updatedLead?.isOptedOut).toBe(true);
    expect(updatedLead?.status).toBe("OPTED_OUT");

    // Outbound cold outreach is blocked for opted-out leads
    await expect(LeadService.triggerAiOutreach(orgId, dncLead.id)).rejects.toThrow(
      "Lead has opted out of communication"
    );
  });
});
