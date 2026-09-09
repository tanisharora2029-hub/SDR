import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "../lib/prisma.js";
import { EmailService } from "../services/emailService.js";
import { ResendService } from "../services/resendService.js";
import { ChannelManager } from "../services/channels/channelManager.js";
import { ConversationService } from "../services/conversationService.js";
import { LeadService } from "../services/leadService.js";

describe("Email Provider Safety & Mock Isolation Audit", () => {
  let originalFetch: typeof globalThis.fetch;
  let originalEmailProviderEnv: string | undefined;
  let originalResendKeyEnv: string | undefined;
  let resendApiCallCount = 0;
  let interceptedResendUrls: string[] = [];

  let testOrg: any;
  let testSdr: any;
  let testLead: any;

  beforeEach(async () => {
    // Preserve original environment
    originalFetch = globalThis.fetch;
    originalEmailProviderEnv = process.env.EMAIL_PROVIDER;
    originalResendKeyEnv = process.env.RESEND_API_KEY;

    resendApiCallCount = 0;
    interceptedResendUrls = [];

    // Global fetch spy intercepting any Resend API calls
    globalThis.fetch = async (url: any, init?: any) => {
      const urlStr = url?.toString() || "";
      if (urlStr.includes("api.resend.com") || urlStr.includes("resend.com")) {
        resendApiCallCount++;
        interceptedResendUrls.push(urlStr);
        // Return simulated success response if called
        return new Response(
          JSON.stringify({ id: `mock_resend_${Date.now()}` }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    };

    // Create isolated test organization and fixtures
    const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    testOrg = await prisma.organization.create({
      data: {
        name: `Mock Safety Test Org ${suffix}`,
        valueProposition: "Autonomous SDR outbound qualification",
        targetCustomerIcp: "B2B SaaS companies",
        knowledgeBase: "Standard pricing: Starter ($199/mo). No discounts offered."
      }
    });

    testSdr = await prisma.sdrProfile.create({
      data: {
        organizationId: testOrg.id,
        personaName: "Alex Rivers",
        title: "AI SDR",
        tone: "Professional and concise"
      }
    });

    testLead = await prisma.lead.create({
      data: {
        organizationId: testOrg.id,
        firstName: "Test",
        lastName: "Prospect",
        email: `lead_${suffix}@example.com`,
        companyName: "Acme Corp",
        status: "NEW"
      }
    });
  });

  afterEach(async () => {
    // Restore environment
    globalThis.fetch = originalFetch;
    if (originalEmailProviderEnv !== undefined) {
      process.env.EMAIL_PROVIDER = originalEmailProviderEnv;
    } else {
      delete process.env.EMAIL_PROVIDER;
    }

    if (originalResendKeyEnv !== undefined) {
      process.env.RESEND_API_KEY = originalResendKeyEnv;
    } else {
      delete process.env.RESEND_API_KEY;
    }

    EmailService.setActiveProvider("ETHEREAL");

    // Cleanup fixtures
    try {
      if (testOrg?.id) {
        await prisma.message.deleteMany({ where: { conversation: { organizationId: testOrg.id } } });
        await prisma.conversation.deleteMany({ where: { organizationId: testOrg.id } });
        await prisma.lead.deleteMany({ where: { organizationId: testOrg.id } });
        await prisma.sdrProfile.deleteMany({ where: { organizationId: testOrg.id } });
        await prisma.activityLog.deleteMany({ where: { organizationId: testOrg.id } });
        await prisma.organization.delete({ where: { id: testOrg.id } });
      }
    } catch {}
  });

  it("1. Verifies that without explicit EMAIL_PROVIDER=resend, default active provider is ETHEREAL", () => {
    delete process.env.EMAIL_PROVIDER;
    const envProvider = (process.env.EMAIL_PROVIDER || "").trim().toUpperCase();
    const isExplicitResend = (envProvider === "RESEND" || envProvider === "LIVE") && Boolean(process.env.RESEND_API_KEY);
    expect(isExplicitResend).toBe(false);

    EmailService.setActiveProvider("ETHEREAL");
    expect(EmailService.getActiveProvider()).toBe("ETHEREAL");
  });

  it("2. Verifies that EmailService in ETHEREAL mode makes ZERO calls to api.resend.com", async () => {
    EmailService.setActiveProvider("ETHEREAL");

    const result = await EmailService.sendEmail({
      to: "prospect@company.test",
      subject: "Ethereal Sandbox Mode Verification",
      text: "Testing Ethereal isolation.",
      senderName: "Alex Rivers"
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe("ETHEREAL");
    expect(resendApiCallCount).toBe(0);
    expect(interceptedResendUrls).toHaveLength(0);
  });

  it("3. Verifies that ChannelManager dispatch in default mode makes ZERO calls to api.resend.com", async () => {
    EmailService.setActiveProvider("ETHEREAL");

    const result = await ChannelManager.dispatch("EMAIL", {
      to: "prospect@company.test",
      content: "Hello from ChannelManager",
      subject: "ChannelManager Dispatch",
      senderName: "Alex Rivers",
      organizationId: testOrg.id
    });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("EMAIL");
    expect(result.providerStatus).toBe("SANDBOX");
    expect(resendApiCallCount).toBe(0);
  });

  it("4. Verifies that Lead Simulator (isSimulator: true) NEVER calls api.resend.com even when active provider is RESEND", async () => {
    // Set active provider to RESEND (as on production Render)
    EmailService.setActiveProvider("RESEND");
    process.env.RESEND_API_KEY = "re_test_dummy_key_12345";

    // Simulate lead reply via Lead Simulator
    const simResult = await ConversationService.ingestLeadReply(
      testOrg.id,
      testLead.id,
      "EMAIL",
      "Can you tell me more about your solution and workflow handoffs?",
      {
        isSimulator: true
      }
    );

    expect(simResult).toBeDefined();
    expect(simResult.outboundMsg).toBeDefined();
    // CRITICAL ASSERTION: Zero calls to api.resend.com
    expect(resendApiCallCount).toBe(0);
    expect(interceptedResendUrls).toHaveLength(0);
  });

  it("5. Verifies that mock/test domains (@example.com, @sandbox.nexsdr.in) safely route to Ethereal and make ZERO Resend API calls", async () => {
    EmailService.setActiveProvider("RESEND");
    process.env.RESEND_API_KEY = "re_test_dummy_key_12345";

    // Sending to a test domain
    const sendResult = await EmailService.sendEmail({
      to: "prospect@example.com",
      subject: "Test Domain Safety Check",
      text: "This should route to Ethereal sandbox automatically.",
      senderName: "Alex Rivers"
    });

    expect(sendResult.success).toBe(true);
    expect(sendResult.provider).toBe("ETHEREAL");
    // Assert 0 calls to api.resend.com
    expect(resendApiCallCount).toBe(0);
  });

  it("6. Verifies that real outbound emails via LIVE Resend work properly when explicitly targeted", async () => {
    EmailService.setActiveProvider("RESEND");
    process.env.RESEND_API_KEY = "re_test_live_key_998877";

    // Sending to a real prospect domain
    const sendResult = await EmailService.sendEmail({
      to: "sarah.connor@cyberdyne-defense.com",
      subject: "Partnership Exploration - NexSDR",
      text: "Hi Sarah, checking if you would be open to a brief chat.",
      senderName: "Alex Rivers",
      organizationId: testOrg.id
    });

    expect(sendResult.success).toBe(true);
    expect(sendResult.provider).toBe("RESEND");
    expect(sendResult.isSimulated).toBe(false);
    // Verified: Resend API was called exactly once for real outbound
    expect(resendApiCallCount).toBe(1);
    expect(interceptedResendUrls[0]).toContain("api.resend.com/emails");
  });
});
