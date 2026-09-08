import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import { ConversationService } from "../services/conversationService.js";
import { LeadService } from "../services/leadService.js";
import { CalendarService } from "../services/calendarService.js";
import { PromptBuilder } from "../services/ai/promptBuilder.js";
import { SdrContext, LeadContext, ConversationTurn } from "../services/ai/types.js";
import { MockAiProvider } from "../services/ai/mockProvider.js";

describe.sequential("NEXSDR — FULL PRODUCTION AUDIT & AI HARDENING SUITE", () => {
  let orgMachineMindId: string;
  let orgFinTechId: string;

  beforeAll(async () => {
    // 1. Setup Company A (MachineMind)
    const orgA = await prisma.organization.create({
      data: {
        name: "MachineMind",
        industry: "AI Financial Back-Office Automation",
        website: "https://machinemind.in",
        valueProposition: "Cut manual KYC verification delays from 48 hours to 90 seconds.",
        targetCustomerIcp: "Heads of Compliance and Operations Directors at fintechs and NBFCs.",
        companyDescription: "MachineMind builds autonomous vision-LLM agents for high-volume document and KYC processing.",
        products: "DocuMind Agent (Multilingual KYC OCR) and FlowMind (Human-in-the-loop exception handling).",
        pricingInfo: "Starter ($199/mo up to 5,000 documents) and Growth ($499/mo up to 25,000 documents).",
        complianceInfo: "SOC2 Type II Certified, ISO 27001, GDPR & RBI data residency compliant. Zero model training on customer data.",
        competitors: "UiPath / Automation Anywhere: Legacy RPA breaks on layout changes; MachineMind uses vision-LLMs with zero template maintenance.",
        knowledgeBase: "Standard pricing: Starter ($199/mo) and Growth ($499/mo). Native CRM integrations with Salesforce and HubSpot.",
        objectionRules: "Internal Team Objection: Validate their technical talent, highlight 6-12 month maintenance overhead and regulatory compliance audits."
      }
    });
    orgMachineMindId = orgA.id;

    await prisma.sdrProfile.create({
      data: {
        organizationId: orgMachineMindId,
        personaName: "Alex Rivers",
        title: "AI Sales Development Representative",
        tone: "Professional, consultative, and concise"
      }
    });

    // 2. Setup Company B (FinTech Ledger Corp) for Multi-Tenant Isolation
    const orgB = await prisma.organization.create({
      data: {
        name: "FinTech Ledger Corp",
        industry: "Core Banking Ledger",
        website: "https://fintechledger.example",
        valueProposition: "Real-time double-entry blockchain ledger for neo-banks.",
        targetCustomerIcp: "Chief Technology Officers at digital banks.",
        companyDescription: "High-throughput transactional ledger infrastructure.",
        products: "LedgerCore Engine ($2,500/mo).",
        pricingInfo: "LedgerCore Engine ($2,500/mo base).",
        complianceInfo: "PCI-DSS Level 1 compliant.",
        competitors: "Thought Machine / Mambu.",
        knowledgeBase: "Base pricing: $2,500/mo."
      }
    });
    orgFinTechId = orgB.id;

    await prisma.sdrProfile.create({
      data: {
        organizationId: orgFinTechId,
        personaName: "Sarah Connor",
        title: "Senior Enterprise SDR",
        tone: "Direct and technical"
      }
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { id: { in: [orgMachineMindId, orgFinTechId] } }
    });
  });

  // =========================================================================
  // AUDIT TEST 1: CONTEXT SCOPING & PROMPT ASSEMBLY
  // =========================================================================
  it("Audit 1: Assembles complete context without leaking extraneous history", () => {
    const sdrContext: SdrContext = {
      organizationName: "MachineMind",
      companyDescription: "MachineMind builds autonomous vision-LLM agents.",
      products: "DocuMind Agent",
      pricingInfo: "Starter ($199/mo)",
      complianceInfo: "SOC2 Type II Certified",
      competitors: "UiPath",
      knowledgeBase: "DocuMind processes documents in 90 seconds.",
      personaName: "Alex Rivers",
      personaTitle: "AI SDR",
      tone: "Consultative",
      qualificationFramework: "BANT"
    };

    const leadContext: LeadContext = {
      leadId: "lead-audit-1",
      firstName: "Priya",
      lastName: "Nair",
      email: "priya@bank.test",
      companyName: "Apex Retail Bank",
      status: "IN_CONVERSATION",
      intentScore: 50
    };

    const turns: ConversationTurn[] = [
      { speaker: "sdr", channel: "EMAIL", content: "Hi Priya, quick question on your KYC workflow.", timestamp: new Date().toISOString() },
      { speaker: "lead", channel: "EMAIL", content: "We are struggling with manual document review.", timestamp: new Date().toISOString() }
    ];

    const prompt = PromptBuilder.buildConversationPrompt(turns, "We are struggling with manual document review.");

    expect(prompt).toContain("We are struggling with manual document review.");
    // Deduplication check: prompt builder should not duplicate the latest lead turn in history
    const matchCount = (prompt.match(/We are struggling with manual document review/g) || []).length;
    expect(matchCount).toBe(1);
  });

  // =========================================================================
  // AUDIT TEST 2: PERSONALIZATION SAFETY (ZERO INVENTED NAMES / COMPANIES)
  // =========================================================================
  it("Audit 2: Strict Personalization Safety when lead name/company is Unknown", async () => {
    const mockProvider = new MockAiProvider();
    const sdrContext: SdrContext = {
      organizationName: "MachineMind",
      valueProposition: "Cut KYC delays from 48 hours to 90 seconds",
      personaName: "Alex Rivers",
      personaTitle: "AI SDR",
      tone: "Consultative",
      qualificationFramework: "BANT"
    };

    // Anonymous lead: missing first name, last name, and company
    const anonLead: LeadContext = {
      leadId: "anon-lead",
      firstName: "",
      lastName: "",
      email: "unknown@stealth.io",
      companyName: "",
      status: "NEW",
      intentScore: 10
    };

    const outreach = await mockProvider.generateOutreach(sdrContext, anonLead);

    // Negative constraints check: MUST NOT invent "Tanish", "Rahul", "technew", or "CloudFlow"
    expect(outreach.content).not.toContain("Tanish");
    expect(outreach.content).not.toContain("Rahul");
    expect(outreach.content).not.toContain("technew");
    expect(outreach.content).not.toContain("CloudFlow");
    // Greeting should use clean generic opening
    expect(outreach.content.toLowerCase()).toMatch(/^(hi there|hello|hi)/i);
  });

  // =========================================================================
  // AUDIT TEST 3: SCENARIO A — PROBLEM DESCRIPTION & DISCOVERY
  // =========================================================================
  it("Audit 3: Scenario A — Problem Description triggers consultative discovery without booking", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: orgMachineMindId,
        firstName: "Vikram",
        lastName: "Mehta",
        email: `vikram_${Date.now()}@fintech.test`,
        companyName: "Fintech Trust",
        status: "IN_CONVERSATION"
      }
    });

    const reply = await ConversationService.ingestLeadReply(
      orgMachineMindId,
      lead.id,
      "EMAIL",
      "We process over 15,000 KYC document verifications each week and the manual exception review creates massive operational bottlenecks."
    );

    expect(reply.outboundMsg).toBeDefined();
    // Must NOT book calendar
    expect(reply.action.action).not.toBe("create_calendar_event");

    const appointments = await prisma.appointment.findMany({
      where: { leadId: lead.id, organizationId: orgMachineMindId }
    });
    expect(appointments.length).toBe(0);

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.status).not.toBe("QUALIFIED");
  });

  // =========================================================================
  // AUDIT TEST 4: SCENARIO B — UIPATH COMPETITOR OBJECTION
  // =========================================================================
  it("Audit 4: Scenario B — UiPath Competitor Objection differentiated accurately without booking", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: orgMachineMindId,
        firstName: "Ananya",
        lastName: "Sen",
        email: `ananya_${Date.now()}@fintech.test`,
        companyName: "National Pay",
        status: "IN_CONVERSATION"
      }
    });

    const reply = await ConversationService.ingestLeadReply(
      orgMachineMindId,
      lead.id,
      "EMAIL",
      "We already deployed UiPath RPA bots for document extraction across our operations."
    );

    expect(reply.outboundMsg).toBeDefined();
    const content = reply.outboundMsg!.content.toLowerCase();

    // Must address legacy RPA vs vision-LLM differentiation
    expect(content.includes("uipath") || content.includes("rpa") || content.includes("template") || content.includes("layout")).toBe(true);

    // Must NOT book calendar
    expect(reply.action.action).not.toBe("create_calendar_event");
  });

  // =========================================================================
  // AUDIT TEST 5: SCENARIO C — INTERNAL TEAM OBJECTION
  // =========================================================================
  it("Audit 5: Scenario C — Internal Automation Team Objection handled with build vs buy logic", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: orgMachineMindId,
        firstName: "Rohan",
        lastName: "Gupta",
        email: `rohan_${Date.now()}@fintech.test`,
        companyName: "FastBank Digital",
        status: "IN_CONVERSATION"
      }
    });

    const reply = await ConversationService.ingestLeadReply(
      orgMachineMindId,
      lead.id,
      "EMAIL",
      "Our internal in-house engineering team is already developing our own custom document processing solution."
    );

    expect(reply.outboundMsg).toBeDefined();
    const content = reply.outboundMsg!.content.toLowerCase();

    // Must address internal build vs buy, compliance maintenance, or model fine-tuning
    expect(content.includes("internal") || content.includes("in-house") || content.includes("engineering") || content.includes("maintenance") || content.includes("compliance")).toBe(true);

    // Must NOT book calendar
    expect(reply.action.action).not.toBe("create_calendar_event");
  });

  // =========================================================================
  // AUDIT TEST 6: SCENARIO D — TIMING OBJECTION ("REACH OUT NEXT QUARTER")
  // =========================================================================
  it("Audit 6: Scenario D — Timing Objection triggers polite follow-up without meeting claim", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: orgMachineMindId,
        firstName: "Deepak",
        lastName: "Verma",
        email: `deepak_${Date.now()}@fintech.test`,
        companyName: "Lending Hub",
        status: "IN_CONVERSATION"
      }
    });

    const reply = await ConversationService.ingestLeadReply(
      orgMachineMindId,
      lead.id,
      "EMAIL",
      "We are currently in a freeze before annual audits. Please reach out to me next quarter."
    );

    expect(reply.outboundMsg).toBeDefined();
    const content = reply.outboundMsg!.content.toLowerCase();

    // Must acknowledge timing politely
    expect(content.includes("next quarter") || content.includes("audit") || content.includes("follow up") || content.includes("understood")).toBe(true);

    // Must NOT claim invite sent
    expect(content).not.toContain("calendar invitation (.ics) has been sent");
    expect(content).not.toContain("i've confirmed our demo");

    const appointments = await prisma.appointment.findMany({
      where: { leadId: lead.id, organizationId: orgMachineMindId }
    });
    expect(appointments.length).toBe(0);
  });

  // =========================================================================
  // AUDIT TEST 7: SCENARIO E — VERIFIED PRICING (ZERO HALLUCINATION)
  // =========================================================================
  it("Audit 7: Scenario E — Quotes exact verified pricing without hallucinating custom discounts", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: orgMachineMindId,
        firstName: "Kavita",
        lastName: "Rao",
        email: `kavita_${Date.now()}@fintech.test`,
        companyName: "Apex Lending",
        status: "IN_CONVERSATION"
      }
    });

    const reply = await ConversationService.ingestLeadReply(
      orgMachineMindId,
      lead.id,
      "EMAIL",
      "What are your commercial pricing tiers and do you offer any custom discount packages?"
    );

    expect(reply.outboundMsg).toBeDefined();
    const content = reply.outboundMsg!.content;

    // Must quote verified pricing from MachineMind DB
    expect(content).toContain("199");
    expect(content).toContain("499");

    // Anti-hallucination: must not invent arbitrary discount numbers like 40% or $50
    expect(content).not.toContain("40% discount");
    expect(content).not.toContain("50% off");
  });

  // =========================================================================
  // AUDIT TEST 8: SCENARIO F — EXPLICIT SCHEDULING REQUEST
  // =========================================================================
  it("Audit 8: Scenario F — Explicit Meeting Request schedules calendar appointment & qualifies lead", async () => {
    const lead = await prisma.lead.create({
      data: {
        organizationId: orgMachineMindId,
        firstName: "Siddharth",
        lastName: "Malhotra",
        email: `sid_${Date.now()}@fintech.test`,
        companyName: "Unified Capital",
        status: "IN_CONVERSATION"
      }
    });

    const reply = await ConversationService.ingestLeadReply(
      orgMachineMindId,
      lead.id,
      "EMAIL",
      "Yes, let's schedule a 20-minute demo this Thursday at 3 PM. My compliance director will join."
    );

    expect(reply.toolExecution?.success).toBe(true);
    expect(reply.toolExecution?.tool).toBe("create_calendar_event");

    const appointments = await prisma.appointment.findMany({
      where: { leadId: lead.id, organizationId: orgMachineMindId }
    });
    expect(appointments.length).toBe(1);

    const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.status).toBe("QUALIFIED");
  });

  // =========================================================================
  // AUDIT TEST 9: CALENDAR FALSE-POSITIVE SAFETY CHECK
  // =========================================================================
  it("Audit 9: Calendar Safety — 'Does it meet compliance?' and past demos NEVER trigger calendar bookings", () => {
    const falsePositive1 = CalendarService.parseMeetingDateTime("Does your OCR system meet our internal RBI compliance requirements?");
    expect(falsePositive1.hasMeetingIntent).toBe(false);

    const falsePositive2 = CalendarService.parseMeetingDateTime("I saw a demo of your product last month at the fintech summit.");
    expect(falsePositive2.hasMeetingIntent).toBe(false);

    const falsePositive3 = CalendarService.parseMeetingDateTime("I am in a meeting all afternoon today, will reply next week.");
    expect(falsePositive3.hasMeetingIntent).toBe(false);

    const falsePositive4 = CalendarService.parseMeetingDateTime("We are too busy with quarter-end closing right now.");
    expect(falsePositive4.hasMeetingIntent).toBe(false);

    // True positive check
    const truePositive = CalendarService.parseMeetingDateTime("Let's schedule a call tomorrow at 3 PM.");
    expect(truePositive.hasMeetingIntent).toBe(true);
    expect(truePositive.missing).toBe("none");
  });

  // =========================================================================
  // AUDIT TEST 10: MULTI-TENANT ISOLATION
  // =========================================================================
  it("Audit 10: Multi-Tenant Isolation — MachineMind vs FinTech Ledger Corp produce strictly isolated facts", async () => {
    const leadA = await prisma.lead.create({
      data: {
        organizationId: orgMachineMindId,
        firstName: "ClientA",
        lastName: "User",
        email: `clienta_${Date.now()}@test.com`,
        companyName: "Bank Alpha",
        status: "NEW"
      }
    });

    const leadB = await prisma.lead.create({
      data: {
        organizationId: orgFinTechId,
        firstName: "ClientB",
        lastName: "User",
        email: `clientb_${Date.now()}@test.com`,
        companyName: "Bank Beta",
        status: "NEW"
      }
    });

    const outreachA = await LeadService.triggerAiOutreach(orgMachineMindId, leadA.id);
    const outreachB = await LeadService.triggerAiOutreach(orgFinTechId, leadB.id);

    const contentA = outreachA.aiResult.content;
    const contentB = outreachB.aiResult.content;

    // Company A mentions MachineMind and KYC, NOT FinTech Ledger Corp or Blockchain
    expect(contentA).toContain("MachineMind");
    expect(contentA).not.toContain("FinTech Ledger Corp");
    expect(contentA).not.toContain("2,500");

    // Company B mentions FinTech Ledger Corp and $2,500, NOT MachineMind or DocuMind
    expect(contentB).toContain("FinTech Ledger Corp");
    expect(contentB).not.toContain("MachineMind");
    expect(contentB).not.toContain("DocuMind");
  });
});
