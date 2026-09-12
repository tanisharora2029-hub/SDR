import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "../lib/prisma.js";
import { ConversationService } from "../services/conversationService.js";
import { LeadService } from "../services/leadService.js";

describe("DNC Priority & AI SDR Deactivation Test Suite", () => {
  let testOrg: any;
  let testSdr: any;

  beforeEach(async () => {
    const timestamp = Date.now() + "_" + Math.random().toString(36).substring(7);
    testOrg = await prisma.organization.create({
      data: {
        name: `DNC Test Org ${timestamp}`,
        valueProposition: "Autonomous SDR lead engagement.",
        targetCustomerIcp: "VP of Sales"
      }
    });

    testSdr = await prisma.sdrProfile.create({
      data: {
        organizationId: testOrg.id,
        personaName: "Alex Rivers",
        email: "alex@nexsdr.in",
        replyTo: "alex@nexsdr.in",
        title: "Senior AI SDR"
      }
    });
  });

  afterEach(async () => {
    if (testOrg?.id) {
      await prisma.message.deleteMany({ where: { conversation: { organizationId: testOrg.id } } });
      await prisma.conversation.deleteMany({ where: { organizationId: testOrg.id } });
      await prisma.followUpTask.deleteMany({ where: { organizationId: testOrg.id } });
      await prisma.activityLog.deleteMany({ where: { organizationId: testOrg.id } });
      await prisma.lead.deleteMany({ where: { organizationId: testOrg.id } });
      await prisma.sdrProfile.deleteMany({ where: { organizationId: testOrg.id } });
      await prisma.organization.delete({ where: { id: testOrg.id } });
    }
  });

  it("1. Verifies that DNC strictly overrides isAiActive to false in LeadService.getLeadById and ConversationService", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: testOrg.id,
        firstName: "Dana",
        lastName: "Scully",
        email: `dana_${Date.now()}@fbi-xfiles.test`,
        companyName: "Federal Bureau",
        status: "NEW",
        isOptedOut: false
      }
    });

    // Create a conversation initially active
    const conv = await prisma.conversation.create({
      data: {
        organizationId: testOrg.id,
        leadId: lead.id,
        channel: "EMAIL",
        isAiActive: true
      }
    });

    // When NOT opted out: isAiActive is true
    const leadBefore = await LeadService.getLeadById(testOrg.id, lead.id);
    expect(leadBefore?.conversations[0].isAiActive).toBe(true);

    const convsBefore = await ConversationService.getConversations(testOrg.id);
    expect(convsBefore[0].isAiActive).toBe(true);

    // Now mark the lead as OPTED_OUT / isOptedOut: true
    await prisma.lead.update({
      where: { id: lead.id },
      data: { isOptedOut: true, status: "OPTED_OUT" }
    });

    // Highest Priority Guard: getLeadById must return isAiActive: false
    const leadAfter = await LeadService.getLeadById(testOrg.id, lead.id);
    expect(leadAfter?.isOptedOut).toBe(true);
    expect(leadAfter?.status).toBe("OPTED_OUT");
    expect(leadAfter?.conversations[0].isAiActive).toBe(false);

    // getConversations must also return isAiActive: false
    const convsAfter = await ConversationService.getConversations(testOrg.id);
    expect(convsAfter[0].isAiActive).toBe(false);

    // getConversationWithMessages must also return isAiActive: false
    const convWithMsgs = await ConversationService.getConversationWithMessages(testOrg.id, conv.id);
    expect(convWithMsgs?.isAiActive).toBe(false);
  });

  it("2. Verifies that 'Resume AI SDR' strictly rejects DNC leads and forces DB conversation to isAiActive: false", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: testOrg.id,
        firstName: "Fox",
        lastName: "Mulder",
        email: `fox_${Date.now()}@fbi-xfiles.test`,
        companyName: "Federal Bureau",
        status: "OPTED_OUT",
        isOptedOut: true
      }
    });

    const conv = await prisma.conversation.create({
      data: {
        organizationId: testOrg.id,
        leadId: lead.id,
        channel: "EMAIL",
        isAiActive: true // intentionally set to true to test enforcement
      }
    });

    // Calling resumeAiHandling on a DNC lead must reject
    const result = await ConversationService.resumeAiHandling(testOrg.id, conv.id);

    expect(result.optedOut).toBe(true);
    expect(result.aiTriggered).toBe(false);
    expect(result.conversation.isAiActive).toBe(false);
    expect(result.error).toContain("Do Not Contact (DNC)");

    // Verify DB row is updated to isAiActive: false
    const dbConv = await prisma.conversation.findUnique({
      where: { id: conv.id }
    });
    expect(dbConv?.isAiActive).toBe(false);
  });

  it("3. Verifies that outreach is hard-blocked for DNC leads", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: testOrg.id,
        firstName: "Walter",
        lastName: "Skinner",
        email: `walter_${Date.now()}@fbi-xfiles.test`,
        companyName: "Federal Bureau",
        status: "OPTED_OUT",
        isOptedOut: true
      }
    });

    await expect(
      LeadService.triggerAiOutreach(testOrg.id, lead.id)
    ).rejects.toThrow("Lead has opted out of communication");
  });

  it("4. Verifies that inbound STOP keyword atomically opts out lead and sets conversation.isAiActive: false", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: testOrg.id,
        firstName: "Alex",
        lastName: "Krycek",
        email: `alex_${Date.now()}@syndicate.test`,
        companyName: "Syndicate Operations",
        status: "NEW",
        isOptedOut: false
      }
    });

    const conv = await prisma.conversation.create({
      data: {
        organizationId: testOrg.id,
        leadId: lead.id,
        channel: "EMAIL",
        isAiActive: true
      }
    });

    // Ingest STOP reply
    const replyResult = await ConversationService.ingestLeadReply(
      testOrg.id,
      lead.id,
      "EMAIL",
      "STOP. Do not contact me anymore."
    );

    expect(replyResult.optedOut).toBe(true);

    // Verify lead record updated
    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.isOptedOut).toBe(true);
    expect(updatedLead?.status).toBe("OPTED_OUT");

    // Verify conversation record deactivated
    const updatedConv = await prisma.conversation.findUnique({ where: { id: conv.id } });
    expect(updatedConv?.isAiActive).toBe(false);

    // Verify subsequent message from opted-out lead does NOT trigger AI and keeps conversation inactive
    const subResult = await ConversationService.ingestLeadReply(
      testOrg.id,
      lead.id,
      "EMAIL",
      "Wait, what is your pricing?"
    );

    expect(subResult.optedOut).toBe(true);
    expect((subResult as any).aiResponded).toBeUndefined();

    const finalConv = await prisma.conversation.findUnique({ where: { id: conv.id } });
    expect(finalConv?.isAiActive).toBe(false);
  });

  it("5. Verifies that a fresh non-DNC lead can resume AI SDR and respond normally", async () => {
    // Create a FRESH non-DNC lead
    const freshLead = await prisma.lead.create({
      data: {
        organizationId: testOrg.id,
        firstName: "John",
        lastName: "Doggett",
        email: `john_${Date.now()}@fbi-xfiles.test`,
        companyName: "Federal Bureau",
        status: "NEW",
        isOptedOut: false
      }
    });

    const freshConv = await prisma.conversation.create({
      data: {
        organizationId: testOrg.id,
        leadId: freshLead.id,
        channel: "EMAIL",
        isAiActive: false // paused by human operator
      }
    });

    // Non-DNC lead: resumeAiHandling succeeds!
    const resumeResult = await ConversationService.resumeAiHandling(testOrg.id, freshConv.id);

    expect(resumeResult.optedOut).toBeUndefined();
    expect(resumeResult.conversation.isAiActive).toBe(true);

    const dbFreshConv = await prisma.conversation.findUnique({ where: { id: freshConv.id } });
    expect(dbFreshConv?.isAiActive).toBe(true);
  });
});
