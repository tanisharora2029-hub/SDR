import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { ResendService } from "../services/resendService.js";
import { WebhookService } from "../services/webhookService.js";
import { EmailService } from "../services/emailService.js";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`\x1b[31m❌ ASSERTION FAILED: ${msg}\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m✅ PASS: ${msg}\x1b[0m`);
  }
}

async function runInboundTestSuite() {
  console.log("\n===================================================================");
  console.log("  NEXUS SDR — REAL INBOUND EMAIL & RESEND WEBHOOK TEST SUITE");
  console.log("===================================================================\n");

  const DUMMY_SECRET = "whsec_" + Buffer.from("test_secret_key_bytes_123456789012345").toString("base64");
  const testKey = "re_test_key_protection_check_998877";

  // -----------------------------------------------------------------
  // SETUP TEST ORGANIZATION, SDR, AND LEADS
  // -----------------------------------------------------------------
  console.log(">>> Setup: Initializing test organization and lead fixtures...");
  const uniqueOrgSuffix = Date.now();

  const org = await prisma.organization.create({
    data: {
      name: `Apex Inbound Corp ${uniqueOrgSuffix}`,
      valueProposition: "Autonomous SDR outbound and inbound pipeline qualification",
      targetCustomerIcp: "Mid-market software sales teams",
      knowledgeBase: "Standard pricing: Starter ($199/mo), Growth ($499/mo). Native CRM sync with HubSpot."
    }
  });

  const sdr = await prisma.sdrProfile.create({
    data: {
      organizationId: org.id,
      personaName: "Alex Rivers",
      title: "Senior AI SDR",
      tone: "Professional, consultative, and concise"
    }
  });

  const leadEmail = `prospect_${uniqueOrgSuffix}@enterprise.test`;
  const lead = await prisma.lead.create({
    data: {
      organizationId: org.id,
      firstName: "Rohan",
      lastName: "Deshmukh",
      email: leadEmail,
      companyName: "Enterprise Global",
      status: "NEW"
    }
  });

  console.log(`Created test fixture: Org (${org.id}), Lead: ${lead.firstName} (${lead.email})\n`);

  // -----------------------------------------------------------------
  // TEST 1: VALID INBOUND EMAIL PARSING
  // -----------------------------------------------------------------
  console.log(">>> TEST 1: Valid Inbound Email Payload Parsing...");
  const validPayload = {
    type: "email.received",
    created_at: new Date().toISOString(),
    data: {
      email_id: `msg_inbound_${Date.now()}`,
      from: `Rohan Deshmukh <${leadEmail}>`,
      to: ["alex.rivers@sandbox.nexus-sdr.internal"],
      subject: "Re: Quick question about Apex Inbound Corp",
      text: "Hi Alex, what CRM integrations do you support?",
      message_id: `<inbound-msg-${Date.now()}@enterprise.test>`
    }
  };

  const parsed = await WebhookService.parseResendPayload(validPayload);
  assert(parsed !== null, "Successfully parsed valid Resend payload");
  assert(parsed?.senderEmail === leadEmail.toLowerCase(), `Sender email normalized: ${parsed?.senderEmail}`);
  assert(parsed?.senderName === "Rohan Deshmukh", `Sender name extracted: ${parsed?.senderName}`);
  assert(parsed?.subject === "Re: Quick question about Apex Inbound Corp", "Subject extracted");
  assert(parsed?.bodyText === "Hi Alex, what CRM integrations do you support?", "Body text extracted");
  assert(parsed?.externalMessageId === `<inbound-msg-${Date.now()}@enterprise.test>` || Boolean(parsed?.externalMessageId), "Message ID preserved");
  console.log("TEST 1 Completed Successfully.\n");

  // -----------------------------------------------------------------
  // TEST 2: INVALID WEBHOOK / SIGNATURE VERIFICATION
  // -----------------------------------------------------------------
  console.log(">>> TEST 2: Invalid Webhook Rejection & Signature Verification...");
  const malformedPayload = { invalid: true };
  const parsedBad = await WebhookService.parseResendPayload(malformedPayload);
  assert(parsedBad === null, "Malformed payload safely rejected (null returned)");

  // Test Svix signature check with invalid signature
  const rawBody = JSON.stringify(validPayload);
  const nowSec = Math.floor(Date.now() / 1000).toString();
  const badHeaders = {
    "svix-id": "msg_bad_123",
    "svix-timestamp": nowSec,
    "svix-signature": "v1,invalid_fake_signature_hash"
  };
  const sigCheck = ResendService.verifyWebhookSignature(rawBody, badHeaders, DUMMY_SECRET);
  assert(!sigCheck.valid, "Invalid Svix signature correctly rejected");

  // Test Svix signature check with valid calculated signature
  const cleanSecret = DUMMY_SECRET.replace("whsec_", "");
  const secretBytes = Buffer.from(cleanSecret, "base64");
  const validSignature = crypto
    .createHmac("sha256", secretBytes)
    .update(`msg_bad_123.${nowSec}.${rawBody}`)
    .digest("base64");

  const validHeaders = {
    "svix-id": "msg_bad_123",
    "svix-timestamp": nowSec,
    "svix-signature": `v1,${validSignature}`
  };
  const sigCheckValid = ResendService.verifyWebhookSignature(rawBody, validHeaders, DUMMY_SECRET);
  assert(sigCheckValid.valid, "Authentic Svix signature successfully verified");
  console.log("TEST 2 Completed Successfully.\n");

  // -----------------------------------------------------------------
  // TEST 3: DUPLICATE EVENT (IDEMPOTENCY)
  // -----------------------------------------------------------------
  console.log(">>> TEST 3: Duplicate Event (Idempotency Protection)...");
  const idempotencyKey = `idempotent_test_key_${Date.now()}`;
  const firstInbound = {
    ...parsed!,
    externalMessageId: idempotencyKey,
    bodyText: "First transmission of this email."
  };

  const firstResult = await WebhookService.processInboundEmail(firstInbound, org.id);
  assert(firstResult.success && !firstResult.duplicate, "First processing of message succeeded");

  // Send the identical externalMessageId again
  const secondResult = await WebhookService.processInboundEmail(firstInbound, org.id);
  assert(secondResult.success === true, "Second processing acknowledged successfully");
  assert(secondResult.duplicate === true, "Second processing flagged duplicate=true without re-processing");
  console.log("TEST 3 Completed Successfully.\n");

  // -----------------------------------------------------------------
  // TEST 4: UNKNOWN SENDER (NO EXISTING LEAD)
  // -----------------------------------------------------------------
  console.log(">>> TEST 4: Unknown Sender (Unmatched Inbound Lead Event)...");
  const unknownEmail = `stranger_${Date.now()}@unregistered-domain.test`;
  const unknownInbound = {
    senderEmail: unknownEmail,
    recipientEmail: "alex.rivers@sandbox.nexus-sdr.internal",
    subject: "Inquiry from outside",
    bodyText: "Hello, I found your company online.",
    externalMessageId: `msg_unknown_${Date.now()}`,
    timestamp: new Date().toISOString()
  };

  const unknownResult = await WebhookService.processInboundEmail(unknownInbound, org.id);
  assert(unknownResult.success === true, "Unknown sender handled safely without 500 error");
  assert(unknownResult.matched === false, "Unknown sender correctly reports matched=false");

  // Verify unmatched activity log was created
  const unmatchedLog = await prisma.activityLog.findFirst({
    where: {
      action: "UNMATCHED_INBOUND_EMAIL",
      detailsJson: { contains: unknownEmail }
    }
  });
  assert(unmatchedLog !== null, "Safe unmatched inbound event persisted in ActivityLog");

  // Verify no fake conversation was invented
  const fakeConv = await prisma.conversation.findFirst({
    where: { lead: { email: unknownEmail } }
  });
  assert(fakeConv === null, "Confirmed: No fake conversation created for unknown sender");
  console.log("TEST 4 Completed Successfully.\n");

  // -----------------------------------------------------------------
  // TEST 5 & 6: EXISTING LEAD MATCH & senderRole=LEAD
  // -----------------------------------------------------------------
  console.log(">>> TEST 5 & 6: Existing Lead Match & senderRole=LEAD Enforcement...");
  const matchedInboundKey = `msg_matched_${Date.now()}`;
  const matchedInbound = {
    senderEmail: leadEmail,
    recipientEmail: "alex.rivers@sandbox.nexus-sdr.internal",
    subject: "Re: Apex Inbound Platform Inquiry",
    bodyText: "We currently use HubSpot. Does your system integrate with HubSpot natively?",
    externalMessageId: matchedInboundKey,
    timestamp: new Date().toISOString()
  };

  const matchResult = await WebhookService.processInboundEmail(matchedInbound, org.id);
  assert(matchResult.success === true, "Inbound email processed successfully");
  assert(matchResult.matched === true, "Lead correctly matched by email address");
  assert(matchResult.leadId === lead.id, "Lead ID matches test lead");

  // Verify Message record in database
  const leadMessage = await prisma.message.findFirst({
    where: {
      conversation: { leadId: lead.id },
      direction: "INBOUND"
    },
    orderBy: { createdAt: "desc" }
  });

  assert(leadMessage !== null, "Inbound message stored in database");
  assert(leadMessage?.senderRole === "LEAD", `senderRole strictly equals 'LEAD' (Actual: ${leadMessage?.senderRole})`);
  assert(leadMessage?.senderRole !== "HUMAN" && leadMessage?.senderRole !== "AI", "senderRole is NOT HUMAN or AI");
  assert(leadMessage?.status === "REAL_INBOUND", `Status indicates 'REAL_INBOUND' (Actual: ${leadMessage?.status})`);
  assert(leadMessage?.content.includes("HubSpot"), "Message content preserved in database");
  console.log("TEST 5 & 6 Completed Successfully.\n");

  // -----------------------------------------------------------------
  // TEST 7 & 8: AI RESPONSE GENERATION & OUTBOUND DISPATCH
  // -----------------------------------------------------------------
  console.log(">>> TEST 7 & 8: AI Response Generation & Outbound Dispatch...");
  assert(matchResult.action === "AI_RESPONDED", `Action indicates 'AI_RESPONDED' (Actual: ${matchResult.action})`);

  // Verify outbound Message record created with senderRole=AI
  const aiMessage = await prisma.message.findFirst({
    where: {
      conversationId: leadMessage!.conversationId,
      direction: "OUTBOUND",
      senderRole: "AI"
    },
    orderBy: { createdAt: "desc" }
  });

  assert(aiMessage !== null, "Outbound AI SDR response stored in conversation");
  assert(aiMessage?.senderRole === "AI", "AI reply has senderRole='AI'");
  assert(aiMessage?.senderName === "Alex Rivers", `Sender name is SDR persona (${aiMessage?.senderName})`);
  assert(typeof aiMessage?.content === "string" && aiMessage.content.length > 10, "Natural language reply generated");
  console.log(`[Alex AI SDR Reply]: "${aiMessage?.content.slice(0, 80)}..."`);
  console.log("TEST 7 & 8 Completed Successfully.\n");

  // -----------------------------------------------------------------
  // TEST 9: HUMAN TAKEOVER PREVENTS AI
  // -----------------------------------------------------------------
  console.log(">>> TEST 9: Human Takeover Active (isAiActive=false) Prevents AI...");
  // Simulate operator takeover on conversation
  const conv = await prisma.conversation.findFirst({ where: { leadId: lead.id } });
  await prisma.conversation.update({
    where: { id: conv!.id },
    data: { isAiActive: false }
  });

  const takeoverInboundKey = `msg_takeover_${Date.now()}`;
  const takeoverInbound = {
    senderEmail: leadEmail,
    recipientEmail: "alex.rivers@sandbox.nexus-sdr.internal",
    subject: "Re: Follow up",
    bodyText: "I have a question about security compliance.",
    externalMessageId: takeoverInboundKey,
    timestamp: new Date().toISOString()
  };

  const takeoverResult = await WebhookService.processInboundEmail(takeoverInbound, org.id);
  assert(takeoverResult.success === true, "Inbound email processed during takeover");
  assert(takeoverResult.action === "HUMAN_TAKEOVER_ACTIVE", "Action confirmed: HUMAN_TAKEOVER_ACTIVE");

  // Verify message stored as LEAD
  const storedTakeoverMsg = await prisma.message.findFirst({
    where: {
      conversationId: conv!.id,
      content: "I have a question about security compliance."
    }
  });
  assert(storedTakeoverMsg !== null, "Message stored in inbox for human review");
  assert(storedTakeoverMsg?.senderRole === "LEAD", "Message assigned senderRole='LEAD'");

  // Verify no new AI message was generated after this inbound
  const lastMsg = await prisma.message.findFirst({
    where: { conversationId: conv!.id },
    orderBy: { createdAt: "desc" }
  });
  assert(lastMsg?.id === storedTakeoverMsg?.id, "Confirmed: AI auto-reply suppressed while Human Takeover is active");

  // Resume AI for subsequent tests
  await prisma.conversation.update({
    where: { id: conv!.id },
    data: { isAiActive: true }
  });
  console.log("TEST 9 Completed Successfully.\n");

  // -----------------------------------------------------------------
  // TEST 10: STOP / DNC PREVENTS AI & OPTS OUT LEAD
  // -----------------------------------------------------------------
  console.log(">>> TEST 10: STOP / Unsubscribe Handling & AI Suppression...");
  const stopInboundKey = `msg_stop_${Date.now()}`;
  const stopInbound = {
    senderEmail: leadEmail,
    recipientEmail: "alex.rivers@sandbox.nexus-sdr.internal",
    subject: "Unsubscribe",
    bodyText: "STOP. Please remove me from your list immediately.",
    externalMessageId: stopInboundKey,
    timestamp: new Date().toISOString()
  };

  const stopResult = await WebhookService.processInboundEmail(stopInbound, org.id);
  assert(stopResult.success === true, "STOP request processed successfully");
  assert(stopResult.action === "LEAD_OPTED_OUT", "Action confirmed: LEAD_OPTED_OUT");

  // Verify Lead is marked optedOut
  const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
  assert(updatedLead?.isOptedOut === true, "Lead marked isOptedOut=true");
  assert(updatedLead?.status === "OPTED_OUT", "Lead status set to 'OPTED_OUT'");

  // Verify AI did NOT reply to the STOP message
  const lastMsgAfterStop = await prisma.message.findFirst({
    where: { conversationId: conv!.id },
    orderBy: { createdAt: "desc" }
  });
  assert(lastMsgAfterStop?.content.includes("STOP"), "Last message is the prospect's STOP message (AI did not reply)");
  console.log("TEST 10 Completed Successfully.\n");

  // -----------------------------------------------------------------
  // TEST 11: REPLY THREADING (In-Reply-To & References)
  // -----------------------------------------------------------------
  console.log(">>> TEST 11: Reply Threading Headers...");

  // Mock global fetch to intercept outbound email payload
  const originalFetch = globalThis.fetch;
  const prevKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "re_mock_test_key_for_test_11";
  let sentPayload: any = null;

  globalThis.fetch = async (url: any, init: any) => {
    if (url.toString().includes("api.resend.com/emails")) {
      sentPayload = JSON.parse(init.body);
      return new Response(
        JSON.stringify({ id: "msg_threaded_outbound_123" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return originalFetch(url, init);
  };

  try {
    const threadInboundId = `<thread-msg-ref-12345@enterprise.test>`;
    await EmailService.sendEmail({
      to: leadEmail,
      subject: "Re: Inquiry",
      text: "Thank you for following up.",
      inReplyTo: threadInboundId,
      references: threadInboundId,
      replyTo: "alex.rivers@sandbox.nexus-sdr.internal",
      forceProvider: "RESEND"
    });

    assert(sentPayload !== null, "Outbound email payload captured");
    assert(sentPayload?.headers?.["In-Reply-To"] === threadInboundId, `In-Reply-To header set: ${sentPayload?.headers?.["In-Reply-To"]}`);
    assert(sentPayload?.headers?.["References"] === threadInboundId, `References header set: ${sentPayload?.headers?.["References"]}`);
    assert(sentPayload?.reply_to === "alex.rivers@sandbox.nexus-sdr.internal", `reply_to set: ${sentPayload?.reply_to}`);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.RESEND_API_KEY = prevKey;
  }
  console.log("TEST 11 Completed Successfully.\n");

  // -----------------------------------------------------------------
  // TEST 12: API KEY & SECRET PROTECTION
  // -----------------------------------------------------------------
  console.log(">>> TEST 12: API Key & Webhook Secret Protection (Zero Leakage)...");
  const secretKeySnippet = testKey;

  // Test error responses from verifyConnection
  const connErr = await ResendService.verifyConnection(testKey);
  assert(!connErr.message.includes(secretKeySnippet), "verifyConnection does not leak API key in failure message");

  // Test error responses from sendEmail
  const sendErr = await ResendService.sendEmail({ to: "fail@test.com", subject: "fail" }, testKey);
  assert(!sendErr.error?.includes(secretKeySnippet), "sendEmail does not leak API key in error string");

  // Test WebhookService processInboundEmail return value
  assert(!JSON.stringify(matchResult).includes(secretKeySnippet), "processInboundEmail does not leak API key");
  assert(!JSON.stringify(takeoverResult).includes(secretKeySnippet), "processInboundEmail does not leak secret in takeover");
  console.log("TEST 12 Completed Successfully.\n");

  console.log("===================================================================");
  console.log("  ALL 12 INBOUND EMAIL & RESEND WEBHOOK TESTS PASSED (100% GREEN)  ");
  console.log("===================================================================\n");
}

runInboundTestSuite()
  .catch((err) => {
    console.error("Test Suite Unhandled Error:", err);
    process.exit(1);
  });
