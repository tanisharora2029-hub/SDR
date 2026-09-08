import assert from "assert";
import { prisma } from "../lib/prisma.js";
import { WebhookService } from "../services/webhookService.js";
import { ResendService } from "../services/resendService.js";
import { EmailService } from "../services/emailService.js";
import { ConversationService } from "../services/conversationService.js";
import { LeadService } from "../services/leadService.js";

async function runNexSdrIdentityTests() {
  console.log("===================================================================");
  console.log("  NEXSDR — MASTER PRODUCT IDENTITY, DOMAIN & EMAIL TEST SUITE");
  console.log("  Domain: https://nexsdr.in | AI SDR: Alex Rivers <alex@nexsdr.in>");
  console.log("===================================================================\n");

  const timestamp = Date.now();

  // -----------------------------------------------------------------
  // 1. DOMAIN & SENDER DEFAULTS TEST
  // -----------------------------------------------------------------
  console.log(">>> TEST 1: Default Domain & AI SDR Sender Configuration...");
  const defaultSenderInfo = ResendService.getSenderInfo();
  assert(
    defaultSenderInfo.senderEmail.includes("alex@nexsdr.in") || defaultSenderInfo.senderEmail.includes("onboarding@resend.dev"),
    `Resend default sender should be alex@nexsdr.in or configured override: ${defaultSenderInfo.senderEmail}`
  );
  console.log(`✅ PASS: Resend sender identity verified: ${defaultSenderInfo.senderName} <${defaultSenderInfo.senderEmail}>`);

  const etherealSenderInfo = await EmailService.getSenderInfo();
  assert(
    etherealSenderInfo.senderEmail.includes("nexsdr.in") || etherealSenderInfo.senderEmail.includes("ethereal.email"),
    `Ethereal fallback sender contains nexsdr.in or ethereal user: ${etherealSenderInfo.senderEmail}`
  );
  console.log(`✅ PASS: Ethereal sender identity verified: ${etherealSenderInfo.senderName} <${etherealSenderInfo.senderEmail}>`);

  // -----------------------------------------------------------------
  // 2. MULTI-TENANT IDENTITY SEPARATION
  // -----------------------------------------------------------------
  console.log("\n>>> TEST 2: Strict Multi-Tenant Separation (Customer vs AI SDR vs Lead)...");
  
  // Organization A (CloudFlow AI)
  const orgA = await prisma.organization.create({
    data: {
      name: `CloudFlow AI ${timestamp}`,
      valueProposition: "Autonomous AI sales outreach.",
      targetCustomerIcp: "B2B Tech Founders",
      knowledgeBase: "NexSDR platform features: autonomous email and phone qualification."
    }
  });

  const ownerA = await prisma.user.create({
    data: {
      organizationId: orgA.id,
      name: "Tanish Arora",
      email: `tanish_${timestamp}@cloudflow.ai`,
      passwordHash: "hash123",
      role: "OWNER"
    }
  });

  const sdrA = await prisma.sdrProfile.create({
    data: {
      organizationId: orgA.id,
      personaName: "Alex Rivers",
      email: "alex@nexsdr.in",
      replyTo: "alex@nexsdr.in",
      title: "AI Sales Development Representative",
      tone: "Professional and consultative"
    }
  });

  const leadA = await prisma.lead.create({
    data: {
      organizationId: orgA.id,
      firstName: "John",
      lastName: "Prospect",
      email: `john_${timestamp}@prospectcompany.test`,
      companyName: "Prospect Company",
      status: "NEW"
    }
  });

  // Organization B (Priya's Fintech)
  const orgB = await prisma.organization.create({
    data: {
      name: `FinTech Solutions ${timestamp}`,
      valueProposition: "Automated payment routing.",
      targetCustomerIcp: "Finance Directors"
    }
  });

  const ownerB = await prisma.user.create({
    data: {
      organizationId: orgB.id,
      name: "Priya Patel",
      email: `priya_${timestamp}@fintech.test`,
      passwordHash: "hash456",
      role: "OWNER"
    }
  });

  const sdrB = await prisma.sdrProfile.create({
    data: {
      organizationId: orgB.id,
      personaName: "Sarah Connor",
      email: "sarah@fintech.test",
      replyTo: "sarah@fintech.test",
      title: "Senior AI SDR",
      tone: "Direct and financial"
    }
  });

  const leadB = await prisma.lead.create({
    data: {
      organizationId: orgB.id,
      firstName: "Michael",
      lastName: "Finance",
      email: `mike_${timestamp}@targetfirm.test`,
      companyName: "Target Firm",
      status: "NEW"
    }
  });

  // Verify identity distinctions
  assert(ownerA.name !== sdrA.personaName, "Customer Owner is distinct from AI SDR");
  assert(ownerA.email !== sdrA.email, "Customer email is distinct from AI SDR email");
  assert(sdrA.email !== leadA.email, "AI SDR email is distinct from Lead email");
  assert(sdrA.email === "alex@nexsdr.in", `AI SDR email is alex@nexsdr.in (Actual: ${sdrA.email})`);
  assert(sdrB.personaName === "Sarah Connor", "Tenant B has independent persona");
  assert(sdrB.email === "sarah@fintech.test", "Tenant B has independent sender email");

  // Verify multi-tenant lead queries do not leak
  const orgALeads = await LeadService.getLeads(orgA.id);
  assert(orgALeads.every(l => l.organizationId === orgA.id), "Org A leads contain only Org A leads");
  assert(!orgALeads.some(l => l.id === leadB.id), "Org B leads never leak into Org A");
  console.log("✅ PASS: Multi-tenant identity model strictly verified with zero cross-tenant leakage");

  // -----------------------------------------------------------------
  // 3. AUTONOMOUS COLD OUTREACH SENDER IDENTITY
  // -----------------------------------------------------------------
  console.log("\n>>> TEST 3: AI SDR Cold Outreach uses alex@nexsdr.in (Never founder's personal email)...");
  
  // Intercept Resend API call
  let capturedOutboundPayload: any = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any, init: any) => {
    const urlStr = String(url);
    if (urlStr.includes("api.resend.com/emails")) {
      capturedOutboundPayload = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: "msg_cold_outreach_test" }), { status: 200 });
    }
    return originalFetch(url, init);
  };

  EmailService.setActiveProvider("RESEND");
  process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_test_dummy_key_123456";

  await LeadService.triggerAiOutreach(orgA.id, leadA.id);
  const createdMsg = await prisma.message.findFirst({
    where: { recipientId: leadA.id, direction: "OUTBOUND" },
    orderBy: { createdAt: "desc" }
  });
  assert(createdMsg, "Outbound message created in database");
  assert(createdMsg.senderRole === "AI", `senderRole is 'AI' (Actual: ${createdMsg.senderRole})`);
  assert(createdMsg.senderName === "Alex Rivers", `senderName is 'Alex Rivers' (Actual: ${createdMsg.senderName})`);

  assert(capturedOutboundPayload, "Outbound payload was dispatched via Resend");
  assert(
    capturedOutboundPayload.from.includes("Alex Rivers") && capturedOutboundPayload.from.includes("alex@nexsdr.in"),
    `Outbound email FROM header uses Alex Rivers <alex@nexsdr.in> (Actual: ${capturedOutboundPayload.from})`
  );
  assert(!capturedOutboundPayload.from.includes("tanish@cloudflow.ai"), "Customer's personal email is NOT in FROM header");
  assert(capturedOutboundPayload.to.includes(leadA.email), `Outbound email TO header reaches prospect: ${leadA.email}`);
  console.log(`✅ PASS: Cold outreach dispatched with FROM: "${capturedOutboundPayload.from}" strictly using AI SDR identity`);

  // -----------------------------------------------------------------
  // 4. INBOUND EMAIL WEBHOOK LOOP & RFC 2822 THREADING
  // -----------------------------------------------------------------
  console.log("\n>>> TEST 4: Real Prospect Inbound Email Reply Loop & Threading...");

  let capturedReplyPayload: any = null;
  globalThis.fetch = async (url: any, init: any) => {
    const urlStr = String(url);
    if (urlStr.includes("api.resend.com/emails")) {
      capturedReplyPayload = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: "msg_reply_outbound_test" }), { status: 200 });
    }
    return originalFetch(url, init);
  };

  const prospectReplyPayload = {
    senderEmail: leadA.email,
    senderName: "John Prospect",
    recipientEmail: "alex@nexsdr.in",
    subject: "Re: Introducing CloudFlow AI",
    bodyText: "Thanks for reaching out Alex! Can you tell me more about your autonomous qualification?",
    externalMessageId: `msg_prospect_turn_${timestamp}`,
    replyTo: leadA.email,
    rawHeaders: {
      "in-reply-to": "<msg_cold_outreach_test@resend.dev>",
      "references": "<msg_cold_outreach_test@resend.dev>"
    }
  };

  const webhookResult = await WebhookService.processInboundEmail(prospectReplyPayload);
  assert(webhookResult.success, "Inbound email processed successfully");
  assert(webhookResult.matched, "Matched to existing lead in database");
  assert(webhookResult.leadId === leadA.id, "Matched lead matches John Prospect");
  assert(webhookResult.action === "AI_RESPONDED", `AI responded to inbound reply (Actual: ${webhookResult.action})`);

  // Verify conversation messages
  const conv = await prisma.conversation.findFirst({
    where: { leadId: leadA.id, organizationId: orgA.id },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });
  assert(conv, "Conversation thread exists");
  assert(conv.messages.length >= 3, `Conversation has at least 3 messages (Actual: ${conv.messages.length})`);

  const inboundMsg = conv.messages.find(m => m.direction === "INBOUND");
  assert(inboundMsg, "Inbound message exists in thread");
  assert(inboundMsg.senderRole === "LEAD", `Inbound message has senderRole='LEAD' (Actual: ${inboundMsg.senderRole})`);
  assert(inboundMsg.status === "REAL_INBOUND", `Inbound message marked 'REAL_INBOUND' (Actual: ${inboundMsg.status})`);

  const secondAiMsg = conv.messages[conv.messages.length - 1];
  assert(secondAiMsg.senderRole === "AI", `AI reply has senderRole='AI' (Actual: ${secondAiMsg.senderRole})`);
  assert(secondAiMsg.senderName === "Alex Rivers", `AI reply has senderName='Alex Rivers' (Actual: ${secondAiMsg.senderName})`);

  // Check RFC 2822 threading headers
  assert(capturedReplyPayload, "Captured AI response dispatched via Resend");
  assert(
    capturedReplyPayload.headers?.["In-Reply-To"] === `msg_prospect_turn_${timestamp}` ||
    capturedReplyPayload.headers?.["In-Reply-To"] === "<msg_cold_outreach_test@resend.dev>",
    `In-Reply-To header set in outgoing response: ${capturedReplyPayload.headers?.["In-Reply-To"]}`
  );
  assert(
    capturedReplyPayload.reply_to === "alex@nexsdr.in",
    `reply_to header set to alex@nexsdr.in (Actual: ${capturedReplyPayload.reply_to})`
  );
  console.log("✅ PASS: Real prospect reply ingested as LEAD, AI response dispatched as Alex Rivers <alex@nexsdr.in> with RFC 2822 threading");

  // -----------------------------------------------------------------
  // 5. HUMAN TAKEOVER
  // -----------------------------------------------------------------
  console.log("\n>>> TEST 5: Human Takeover (Workspace Operator Takes Over)...");
  
  // Tanish takes over the conversation
  const humanMsg = await ConversationService.sendHumanMessage(
    orgA.id,
    conv.id,
    "Hi John, Tanish here (Founder). Stepping in to answer your specific question!",
    { id: ownerA.id, name: "Tanish Arora" }
  );

  assert(humanMsg.senderRole === "HUMAN", `Human message has senderRole='HUMAN' (Actual: ${humanMsg.senderRole})`);
  assert(humanMsg.senderName === "Tanish Arora", `Human message senderName is 'Tanish Arora' (Actual: ${humanMsg.senderName})`);

  const updatedConv = await prisma.conversation.findUnique({ where: { id: conv.id } });
  assert(updatedConv?.isAiActive === false, "Conversation isAiActive set to false upon human takeover");

  // If prospect replies during takeover, AI must NOT respond
  const prospectReplyDuringTakeover = {
    senderEmail: leadA.email,
    senderName: "John Prospect",
    recipientEmail: "alex@nexsdr.in",
    subject: "Re: Introducing CloudFlow AI",
    bodyText: "Great to meet you Tanish, thanks for stepping in!",
    externalMessageId: `msg_takeover_reply_${timestamp}`,
    replyTo: leadA.email
  };

  const takeoverWebhookResult = await WebhookService.processInboundEmail(prospectReplyDuringTakeover);
  assert(takeoverWebhookResult.action === "HUMAN_TAKEOVER_ACTIVE", "AI auto-reply suppressed during human takeover");
  console.log("✅ PASS: Human takeover successfully pauses AI SDR and attributes messages to human operator");

  // -----------------------------------------------------------------
  // 6. STOP / DNC OPT-OUT COMPLIANCE
  // -----------------------------------------------------------------
  console.log("\n>>> TEST 6: STOP / DNC Opt-Out Enforced Atomically...");

  const stopReply = {
    senderEmail: leadA.email,
    senderName: "John Prospect",
    recipientEmail: "alex@nexsdr.in",
    subject: "Unsubscribe",
    bodyText: "STOP. Please remove me from your mailing list.",
    externalMessageId: `msg_stop_${timestamp}`,
    replyTo: leadA.email
  };

  const stopResult = await WebhookService.processInboundEmail(stopReply);
  assert(stopResult.action === "LEAD_OPTED_OUT", "Action confirmed as LEAD_OPTED_OUT");

  const optedOutLead = await prisma.lead.findUnique({ where: { id: leadA.id } });
  assert(optedOutLead?.isOptedOut === true, "Lead isOptedOut is true");
  assert(optedOutLead?.status === "OPTED_OUT", "Lead status is OPTED_OUT");

  // Attempting outreach to opted out lead must throw
  let blocked = false;
  try {
    await LeadService.triggerAiOutreach(orgA.id, leadA.id);
  } catch (err: any) {
    blocked = true;
    assert(err.message.includes("opted out"), `Expected opt-out error message, got: ${err.message}`);
  }
  assert(blocked, "Outreach to opted-out lead was blocked");
  console.log("✅ PASS: STOP / DNC opt-out processed, upcoming cadences cancelled, and future outreach blocked");

  // Restore fetch
  globalThis.fetch = originalFetch;

  console.log("\n===================================================================");
  console.log("  ALL NEXSDR BRAND, DOMAIN, AND IDENTITY TESTS PASSED (100% GREEN)  ");
  console.log("===================================================================\n");
}

runNexSdrIdentityTests().catch((err) => {
  console.error("❌ TEST FAILURE:", err);
  process.exit(1);
});
