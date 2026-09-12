import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "../lib/prisma.js";
import { ConversationService } from "../services/conversationService.js";
import { GroqProvider } from "../services/ai/groqProvider.js";
import { CostRouter } from "../services/ai/costRouter.js";

describe("Groq Inbound & AI Recovery Test Suite", () => {
  let originalFetch: typeof globalThis.fetch;
  let originalGroqKey: string | undefined;
  let originalGroqModel: string | undefined;
  let originalAiProvider: string | undefined;
  let originalNodeEnv: string | undefined;
  let originalResendKey: string | undefined;

  let testOrg: any;
  let testSdr: any;
  let testLead: any;

  let interceptedResendEmails: any[] = [];
  let interceptedGroqCalls: any[] = [];

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    originalGroqKey = process.env.GROQ_API_KEY;
    originalGroqModel = process.env.GROQ_MODEL;
    originalAiProvider = process.env.AI_PROVIDER;
    originalNodeEnv = process.env.NODE_ENV;
    originalResendKey = process.env.RESEND_API_KEY;

    interceptedResendEmails = [];
    interceptedGroqCalls = [];

    const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;

    testOrg = await prisma.organization.create({
      data: {
        name: `Production Recovery Org ${suffix}`,
        valueProposition: "Autonomous SDR email pipeline and meeting qualification",
        targetCustomerIcp: "B2B SaaS companies",
        knowledgeBase: "Standard pricing: Starter ($199/mo), Growth ($499/mo). No unverified discounts."
      }
    });

    testSdr = await prisma.sdrProfile.create({
      data: {
        organizationId: testOrg.id,
        personaName: "Alex Rivers",
        title: "Senior AI SDR",
        tone: "Professional, consultative, and concise"
      }
    });

    testLead = await prisma.lead.create({
      data: {
        organizationId: testOrg.id,
        firstName: "Sarah",
        lastName: "Connor",
        email: `sarah.connor.${suffix}@cyberdyne-defense.com`,
        companyName: "Cyberdyne Systems",
        jobTitle: "VP of Engineering",
        status: "NEW"
      }
    });
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    process.env.GROQ_API_KEY = originalGroqKey;
    process.env.GROQ_MODEL = originalGroqModel;
    process.env.AI_PROVIDER = originalAiProvider;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.RESEND_API_KEY = originalResendKey;

    if (testOrg?.id) {
      await prisma.message.deleteMany({ where: { conversation: { organizationId: testOrg.id } } }).catch(() => {});
      await prisma.conversation.deleteMany({ where: { organizationId: testOrg.id } }).catch(() => {});
      await prisma.followUpTask.deleteMany({ where: { organizationId: testOrg.id } }).catch(() => {});
      await prisma.activityLog.deleteMany({ where: { organizationId: testOrg.id } }).catch(() => {});
      await prisma.lead.deleteMany({ where: { organizationId: testOrg.id } }).catch(() => {});
      await prisma.sdrProfile.deleteMany({ where: { organizationId: testOrg.id } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: testOrg.id } }).catch(() => {});
    }
  });

  it("Test A: Real inbound lead reply with AI active -> AI response generated", async () => {
    process.env.GROQ_API_KEY = "gsk_valid_mock_test_key";
    process.env.AI_PROVIDER = "groq";

    globalThis.fetch = async (url: any, init?: any) => {
      const urlStr = url?.toString() || "";
      if (urlStr.includes("api.groq.com")) {
        const body = JSON.parse(init?.body || "{}");
        interceptedGroqCalls.push({ url: urlStr, body });
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: "conversation",
                    action: "reply",
                    reply: "Thank you for reaching out, Sarah! We would love to show you how our platform automates qualification. What is your team's top priority this quarter?",
                    confidence: 0.95
                  })
                }
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    };

    const replyResult = await ConversationService.ingestLeadReply(
      testOrg.id,
      testLead.id,
      "EMAIL",
      "Hi Alex, can you share more details about your automated qualification workflow?",
      {
        subject: "Re: Introduction",
        isRealInbound: true,
        forceLiveEmail: true
      }
    );

    expect(replyResult.outboundMsg).toBeDefined();
    expect(replyResult.outboundMsg.senderRole).toBe("AI");
    expect(replyResult.outboundMsg.status).toBe("SENT");
    expect(replyResult.outboundMsg.content).toContain("Thank you for reaching out, Sarah!");
    expect(interceptedGroqCalls.length).toBeGreaterThanOrEqual(1);

    // Verify model used was llama-3.3-70b-versatile
    expect(interceptedGroqCalls[0].body.model).toBe("llama-3.3-70b-versatile");
  });

  it("Test B: Groq failure -> clear error, no fake/mock response silently presented as real AI", async () => {
    process.env.GROQ_API_KEY = "gsk_failing_key";
    process.env.AI_PROVIDER = "groq";

    globalThis.fetch = async (url: any, init?: any) => {
      const urlStr = url?.toString() || "";
      if (urlStr.includes("api.groq.com")) {
        return new Response(
          JSON.stringify({
            error: {
              message: "The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.",
              type: "invalid_request_error",
              code: "model_not_found"
            }
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    };

    const result = await ConversationService.ingestLeadReply(
      testOrg.id,
      testLead.id,
      "EMAIL",
      "Tell me more about pricing.",
      {
        subject: "Re: Pricing",
        isRealInbound: true
      }
    );

    // When Groq fails, AI must NOT silently respond with a fake mock message
    expect(result.aiResponded).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("404");

    // Verify no fake outbound AI message was stored in the conversation
    const messages = await prisma.message.findMany({
      where: { conversation: { leadId: testLead.id } }
    });
    const outboundMessages = messages.filter(m => m.direction === "OUTBOUND");
    expect(outboundMessages).toHaveLength(0);

    // Verify failure activity log was recorded
    const logs = await prisma.activityLog.findMany({
      where: { organizationId: testOrg.id, action: "AI_GENERATION_FAILED" }
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it("Test C: AI response -> Resend LIVE outbound", async () => {
    process.env.GROQ_API_KEY = "gsk_valid_key";
    process.env.RESEND_API_KEY = "re_live_valid_test_key";
    process.env.AI_PROVIDER = "groq";

    globalThis.fetch = async (url: any, init?: any) => {
      const urlStr = url?.toString() || "";
      if (urlStr.includes("api.groq.com")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: "conversation",
                    action: "reply",
                    reply: "We integrate directly with your existing CRM to qualify leads in real-time.",
                    confidence: 0.9
                  })
                }
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("api.resend.com")) {
        const body = JSON.parse(init?.body || "{}");
        interceptedResendEmails.push(body);
        return new Response(
          JSON.stringify({ id: "msg_resend_live_12345" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    };

    const replyResult = await ConversationService.ingestLeadReply(
      testOrg.id,
      testLead.id,
      "EMAIL",
      "How does your integration work?",
      {
        subject: "Re: Integration",
        isRealInbound: true,
        forceLiveEmail: true,
        externalMessageId: "<msg-inbound-123@cyberdyne.com>"
      }
    );

    expect(replyResult.outboundMsg).toBeDefined();
    expect(interceptedResendEmails.length).toBe(1);
    expect(interceptedResendEmails[0].to).toContain(testLead.email);
    expect(interceptedResendEmails[0].text).toContain("We integrate directly with your existing CRM");
  });

  it("Test D: DNC -> no AI response", async () => {
    process.env.GROQ_API_KEY = "gsk_valid_key";
    process.env.AI_PROVIDER = "groq";

    // Lead sends STOP keyword
    const optOutResult = await ConversationService.ingestLeadReply(
      testOrg.id,
      testLead.id,
      "EMAIL",
      "STOP - Please remove me from your list immediately."
    );

    expect(optOutResult.optedOut).toBe(true);

    // Verify lead is marked as opted out
    const updatedLead = await prisma.lead.findUnique({ where: { id: testLead.id } });
    expect(updatedLead?.isOptedOut).toBe(true);
    expect(updatedLead?.status).toBe("OPTED_OUT");

    // Subsequent inbound message from opted-out lead must NOT generate AI response
    const subsequentResult = await ConversationService.ingestLeadReply(
      testOrg.id,
      testLead.id,
      "EMAIL",
      "Actually wait, tell me more."
    );

    expect(subsequentResult.optedOut).toBe(true);
    expect((subsequentResult as any).outboundMsg).toBeUndefined();
  });

  it("Test E: Resume AI SDR -> AI can respond again", async () => {
    process.env.GROQ_API_KEY = "gsk_valid_key";
    process.env.RESEND_API_KEY = "re_live_key";
    process.env.AI_PROVIDER = "groq";

    globalThis.fetch = async (url: any, init?: any) => {
      const urlStr = url?.toString() || "";
      if (urlStr.includes("api.groq.com")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: "conversation",
                    action: "reply",
                    reply: "Happy to help! Our pricing starts at $199/month for Starter.",
                    confidence: 0.95
                  })
                }
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("api.resend.com")) {
        const body = JSON.parse(init?.body || "{}");
        interceptedResendEmails.push(body);
        return new Response(
          JSON.stringify({ id: "msg_resend_resume_123" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    };

    // 1. Create conversation with human takeover / AI paused
    const conv = await prisma.conversation.create({
      data: {
        organizationId: testOrg.id,
        leadId: testLead.id,
        channel: "EMAIL",
        isAiActive: false,
        subject: "Discussion"
      }
    });

    // 2. Inbound message arrives while AI is paused
    const inboundRes = await ConversationService.ingestLeadReply(
      testOrg.id,
      testLead.id,
      "EMAIL",
      "Can you send over your pricing tiers?",
      {
        conversationId: conv.id,
        isRealInbound: true
      }
    );

    expect(inboundRes.aiResponded).toBe(false);
    expect(inboundRes.reason).toBe("Human takeover active");

    // 3. User clicks "Resume AI SDR"
    const resumeRes: any = await ConversationService.resumeAiHandling(testOrg.id, conv.id);

    expect(resumeRes.conversation.isAiActive).toBe(true);
    expect(resumeRes.aiTriggered).toBe(true);
    expect(resumeRes.responseResult).toBeDefined();
    expect(resumeRes.responseResult.outboundMsg).toBeDefined();
    expect(resumeRes.responseResult.outboundMsg.content).toContain("Our pricing starts at $199/month for Starter");
    expect(interceptedResendEmails.length).toBe(1);
    expect(interceptedResendEmails[0].to).toContain(testLead.email);
  });

  it("Test F: Decommissioned models automatically migrate to llama-3.3-70b-versatile", () => {
    process.env.GROQ_MODEL = "llama-3.1-70b-versatile";
    const groq = new GroqProvider();
    const resolvedModel = groq.resolveModel();
    expect(resolvedModel).toBe("llama-3.3-70b-versatile");

    process.env.GROQ_MODEL = "llama3-70b-8192";
    expect(groq.resolveModel()).toBe("llama-3.3-70b-versatile");

    const costRouterDecision = CostRouter.routeTask("EMAIL_DRAFTING");
    expect(costRouterDecision.modelName).toBe("llama-3.3-70b-versatile");
  });

  it("Test G: Security check: API keys are never exposed in errors or logs", async () => {
    const SECRET_KEY = "gsk_super_secret_test_key_xyz987";
    process.env.GROQ_API_KEY = SECRET_KEY;
    process.env.AI_PROVIDER = "groq";

    globalThis.fetch = async (url: any, init?: any) => {
      const urlStr = url?.toString() || "";
      if (urlStr.includes("api.groq.com")) {
        return new Response(
          JSON.stringify({ error: { message: "Internal server error", code: 500 } }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    };

    const groq = new GroqProvider();
    let caughtError: Error | null = null;
    try {
      await groq.respondToMessage(
        { organizationId: testOrg.id, organizationName: "Test" } as any,
        { leadId: testLead.id, firstName: "Sarah", companyName: "Cyberdyne" } as any,
        [],
        "Hello"
      );
    } catch (e: any) {
      caughtError = e;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).not.toContain(SECRET_KEY);
  });
});
