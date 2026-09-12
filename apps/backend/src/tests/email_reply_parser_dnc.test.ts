import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../lib/prisma.js";
import { ConversationService } from "../services/conversationService.js";
import { WebhookService } from "../services/webhookService.js";
import { EmailReplyParser } from "../services/emailReplyParser.js";

describe("EmailReplyParser & False DNC Prevention Test Suite", () => {
  let org: any;
  let lead: any;

  beforeEach(async () => {
    // Generate isolated organization for tests
    const timestamp = Date.now();
    org = await prisma.organization.create({
      data: {
        name: "False DNC Test Org " + timestamp,
        industry: "SaaS",
        valueProposition: "Autonomous AI SDR Platform"
      }
    });

    await prisma.sdrProfile.create({
      data: {
        organizationId: org.id,
        personaName: "Alex Rivers",
        title: "AI SDR",
        tone: "Professional"
      }
    });

    lead = await prisma.lead.create({
      data: {
        organizationId: org.id,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe." + timestamp + "@example.com",
        companyName: "Acme Corp",
        status: "CONTACTED",
        isOptedOut: false
      }
    });
  });

  // =========================================================================
  // UNIT TESTS: EmailReplyParser Isolated Logic
  // =========================================================================

  it("Test A: New inbound body exactly 'STOP' triggers opt-out", () => {
    const raw = "STOP";
    const isOpt = EmailReplyParser.isOptOutIntent(raw);
    const clean = EmailReplyParser.extractNewlyAuthoredReply(raw);
    expect(isOpt).toBe(true);
    expect(clean).toBe("STOP");
  });

  it("Test B: 'Please stop contacting me' triggers opt-out", () => {
    const raw = "Please stop contacting me";
    const isOpt = EmailReplyParser.isOptOutIntent(raw);
    const clean = EmailReplyParser.extractNewlyAuthoredReply(raw);
    expect(isOpt).toBe(true);
    expect(clean).toBe("Please stop contacting me");
  });

  it("Test C: Normal Gmail reply with quoted Alex email containing 'STOP' does NOT trigger opt-out", () => {
    const raw = `Thanks. I saw your previous email.

On Fri, Sep 12, 2026 at 4:30 PM Alex Rivers <alex@nexsdr.in> wrote:
> Hi Jane,
> 
> Thanks for connecting. Here is our pricing overview.
> 
> ---
> To unsubscribe from these communications, reply STOP.`;

    const isOpt = EmailReplyParser.isOptOutIntent(raw);
    const clean = EmailReplyParser.extractNewlyAuthoredReply(raw);
    expect(isOpt).toBe(false);
    expect(clean).toBe("Thanks. I saw your previous email.");
  });

  it("Test D: Normal reply containing business discussion + quoted footer does NOT trigger opt-out", () => {
    const raw = `Could you send over the pricing tiers for your enterprise plan?

---
To unsubscribe from these communications, reply STOP.`;

    const isOpt = EmailReplyParser.isOptOutIntent(raw);
    const clean = EmailReplyParser.extractNewlyAuthoredReply(raw);
    expect(isOpt).toBe(false);
    expect(clean).toBe("Could you send over the pricing tiers for your enterprise plan?");
  });

  it("Test E: Case-insensitive legitimate opt-outs ('stop', 'Unsubscribe', 'remove me from your list') trigger opt-out", () => {
    expect(EmailReplyParser.isOptOutIntent("stop")).toBe(true);
    expect(EmailReplyParser.isOptOutIntent("Unsubscribe")).toBe(true);
    expect(EmailReplyParser.isOptOutIntent("Please remove me from your list")).toBe(true);
    expect(EmailReplyParser.isOptOutIntent("opt out")).toBe(true);
    expect(EmailReplyParser.isOptOutIntent("Don't contact me")).toBe(true);
  });

  it("Test F: Gmail HTML quoted reply does NOT trigger opt-out", () => {
    const rawText = "Sounds great, let's talk tomorrow!";
    const rawHtml = `<div dir="ltr">Sounds great, let&#39;s talk tomorrow!</div><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">On Fri, Sep 12, 2026 at 4:30 PM Alex Rivers &lt;alex@nexsdr.in&gt; wrote:<br></div><blockquote class="gmail_quote">To unsubscribe from these communications, reply <strong>STOP</strong>.</blockquote></div>`;

    const isOpt = EmailReplyParser.isOptOutIntent(rawText, rawHtml);
    const clean = EmailReplyParser.extractNewlyAuthoredReply(rawText, rawHtml);
    expect(isOpt).toBe(false);
    expect(clean).toBe("Sounds great, let's talk tomorrow!");
  });

  it("Test G: Outlook '-----Original Message-----' does NOT trigger opt-out on normal reply", () => {
    const raw = `I am interested in the Growth plan. What is the pricing?

-----Original Message-----
From: Alex Rivers <alex@nexsdr.in>
Sent: Friday, September 12, 2026 4:30 PM
To: Jane Doe <jane@example.com>
Subject: Re: NexSDR

Hi Jane,
...
To unsubscribe from these communications, reply STOP.`;

    const isOpt = EmailReplyParser.isOptOutIntent(raw);
    const clean = EmailReplyParser.extractNewlyAuthoredReply(raw);
    expect(isOpt).toBe(false);
    expect(clean).toBe("I am interested in the Growth plan. What is the pricing?");
  });

  it("Test H: Legitimate STOP reply with quoted email thread below it triggers opt-out", () => {
    const raw = `STOP - remove me immediately.

On Fri, Sep 12, 2026 at 4:30 PM Alex Rivers <alex@nexsdr.in> wrote:
> Hi Jane,
> To unsubscribe from these communications, reply STOP.`;

    const isOpt = EmailReplyParser.isOptOutIntent(raw);
    const clean = EmailReplyParser.extractNewlyAuthoredReply(raw);
    expect(isOpt).toBe(true);
    expect(clean).toBe("STOP - remove me immediately.");
  });

  // =========================================================================
  // INTEGRATION TESTS: ConversationService & WebhookService
  // =========================================================================

  it("Integration 1: Gmail reply with quoted STOP does NOT mark lead as OPTED_OUT", async () => {
    const gmailReply = `Thanks. I saw your previous email.

On Fri, Sep 12, 2026 at 4:30 PM Alex Rivers <alex@nexsdr.in> wrote:
> Hi Jane,
> 
> Thanks for connecting. Here is our pricing overview.
> 
> ---
> To unsubscribe from these communications, reply STOP.`;

    const result: any = await ConversationService.ingestLeadReply(
      org.id,
      lead.id,
      "EMAIL",
      gmailReply,
      { isSimulator: true }
    );

    // Verify lead is NOT opted out
    expect(result.optedOut).toBeFalsy();
    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.isOptedOut).toBe(false);
    expect(updatedLead?.status).toBe("IN_CONVERSATION");

    // Verify stored inbound message contains clean authored text
    const storedMsg = await prisma.message.findFirst({
      where: {
        conversationId: result.conv?.id || result.inboundMsg?.conversationId,
        direction: "INBOUND"
      }
    });
    expect(storedMsg?.content).toContain("Thanks. I saw your previous email.");
    // Verify AI outbound response was generated and dispatched
    expect(result.outboundMsg).toBeDefined();
  });

  it("Integration 2: Inbound webhook with quoted STOP keeps lead ACTIVE and does NOT opt out", async () => {
    const gmailReply = `I would love to learn more. When are you free for a call?

On Fri, Sep 12, 2026 at 4:30 PM Alex Rivers <alex@nexsdr.in> wrote:
> Hi Jane,
> ---
> To unsubscribe from these communications, reply STOP.`;

    const payload = {
      senderEmail: lead.email,
      recipientEmail: "alex@nexsdr.in",
      subject: "Re: Quick question",
      bodyText: gmailReply,
      externalMessageId: `msg_gmail_quote_${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    const result = await WebhookService.processInboundEmail(payload, org.id);

    expect(result.success).toBe(true);
    expect(result.action).not.toBe("LEAD_OPTED_OUT");

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.isOptedOut).toBe(false);
    expect(updatedLead?.status).not.toBe("OPTED_OUT");
  });

  it("Integration 3: Legitimate STOP via webhook successfully triggers LEAD_OPTED_OUT", async () => {
    const stopPayload = {
      senderEmail: lead.email,
      recipientEmail: "alex@nexsdr.in",
      subject: "Re: Quick question",
      bodyText: "STOP - Please unsubscribe me from all emails.",
      externalMessageId: `msg_real_stop_${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    const result = await WebhookService.processInboundEmail(stopPayload, org.id);

    expect(result.success).toBe(true);
    expect(result.action).toBe("LEAD_OPTED_OUT");

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.isOptedOut).toBe(true);
    expect(updatedLead?.status).toBe("OPTED_OUT");
  });
});