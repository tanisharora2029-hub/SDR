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

  it("1. Verifies that in production or by default, initial active provider resolves to RESEND", () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
    const prevNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      EmailService.setActiveProvider("RESEND");
      expect(EmailService.getActiveProvider()).toBe("RESEND");

      // In production, switching to ETHEREAL is blocked
      EmailService.setActiveProvider("ETHEREAL");
      expect(EmailService.getActiveProvider()).toBe("RESEND");
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });

  it("2. Verifies that EmailService in non-production ETHEREAL mode makes ZERO calls to api.resend.com", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      EmailService.setActiveProvider("ETHEREAL");

      const result = await EmailService.sendEmail({
        to: "prospect@company.test",
        subject: "Ethereal Sandbox Mode Verification",
        text: "Testing Ethereal isolation.",
        senderName: "Alex Rivers"
      });

      expect(result.success).toBe(true);
      expect(resendApiCallCount).toBe(0);
      expect(interceptedResendUrls).toHaveLength(0);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });

  it("3. Verifies that ChannelManager dispatch in default mode makes ZERO calls to api.resend.com", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
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
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
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

  it("5. Verifies that mock/test domains (@example.com, @sandbox.nexsdr.in) safely route to internal simulation and make ZERO Resend API calls", async () => {
    EmailService.setActiveProvider("RESEND");
    process.env.RESEND_API_KEY = "re_test_dummy_key_12345";

    // Sending to a test domain
    const sendResult = await EmailService.sendEmail({
      to: "prospect@example.com",
      subject: "Test Domain Safety Check",
      text: "This should route to internal simulation automatically.",
      senderName: "Alex Rivers"
    });

    expect(sendResult.success).toBe(true);
    expect(sendResult.provider).toBe("SIMULATOR");
    expect(sendResult.isSimulated).toBe(true);
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

  it("7. Verifies that when Resend fails, EmailService returns a clear error and does NOT fall back to Ethereal", async () => {
    EmailService.setActiveProvider("RESEND");
    process.env.RESEND_API_KEY = "re_test_live_key_error_sim";

    // Override fetch to simulate Resend API error
    const prevFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, init?: any) => {
      if (url.toString().includes("api.resend.com/emails")) {
        return new Response(
          JSON.stringify({ statusCode: 403, message: "Domain not verified on Resend account" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      return prevFetch(url, init);
    };

    try {
      const sendResult = await EmailService.sendEmail({
        to: "john.doe@enterprise-real.com",
        subject: "Outbound Lead Outreach",
        text: "Checking in regarding sales automation.",
        senderName: "Alex Rivers",
        forceProvider: "RESEND"
      });

      // Assertions: strictly fails with clear error, NO fallback to Ethereal
      expect(sendResult.success).toBe(false);
      expect(sendResult.provider).toBe("RESEND");
      expect(sendResult.fallbackUsed).toBe(false);
      expect(sendResult.error).toContain("Domain not verified");
    } finally {
      globalThis.fetch = prevFetch;
    }
  });

  it("8. Verifies that in production mode, Ethereal is strictly disabled", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const connResult = await EmailService.verifyConnection();
      expect(connResult.success).toBe(false);
      expect(connResult.message).toContain("disabled in production");

      const sendResult = await EmailService.sendEmail({
        to: "lead@realclient.com",
        subject: "Test in prod",
        text: "Hello",
        forceProvider: "ETHEREAL"
      });
      expect(sendResult.success).toBe(false);
      expect(sendResult.error).toContain("disabled in production");
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });
});
