import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../lib/prisma.js";
import { SsrfGuard } from "../services/opportunity/ssrfGuard.js";
import { MachineMindMapper } from "../services/opportunity/machineMindMapper.js";
import { OpportunityScorer } from "../services/opportunity/opportunityScorer.js";
import { OutreachGenerator } from "../services/opportunity/outreachGenerator.js";
import { OpportunityService } from "../services/opportunity/opportunityService.js";
import { PublicWebResearchProvider } from "../services/opportunity/researchProvider.js";

describe("Opportunity Engine — Complete Test Suite", () => {
  let orgAId: string;
  let orgBId: string;

  beforeEach(async () => {
    // Setup two isolated test organizations
    const orgA = await prisma.organization.create({
      data: {
        name: `Org Alpha ${Date.now()}`,
        industry: "Logistics",
        targetCustomerIcp: "Supply Chain Leaders"
      }
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        name: `Org Beta ${Date.now()}`,
        industry: "Healthcare"
      }
    });
    orgBId = orgB.id;

    // Create SDR profile for Org A
    await prisma.sdrProfile.create({
      data: {
        organizationId: orgAId,
        personaName: "Alex Rivers",
        email: "alex@nexsdr.in",
        replyTo: "alex@nexsdr.in"
      }
    });
  });

  // TEST 1: URL Validation & SSRF Rejection
  it("1. SSRF Protection: strictly rejects localhost, loopback, private IPs, and cloud metadata", async () => {
    // Localhost
    expect(() => SsrfGuard.validateAndNormalizeUrl("http://localhost:5000")).toThrow(/forbidden|internal/i);
    expect(() => SsrfGuard.validateAndNormalizeUrl("http://127.0.0.1")).toThrow(/forbidden|prohibited/i);
    expect(() => SsrfGuard.validateAndNormalizeUrl("http://0.0.0.0:3000")).toThrow(/forbidden|prohibited/i);

    // Private RFC 1918
    expect(() => SsrfGuard.validateAndNormalizeUrl("http://10.0.1.5")).toThrow(/prohibited/i);
    expect(() => SsrfGuard.validateAndNormalizeUrl("http://172.16.0.1")).toThrow(/prohibited/i);
    expect(() => SsrfGuard.validateAndNormalizeUrl("http://192.168.1.100")).toThrow(/prohibited/i);

    // Cloud Metadata endpoint
    expect(() => SsrfGuard.validateAndNormalizeUrl("http://169.254.169.254/latest/meta-data/")).toThrow(/prohibited/i);

    // Non-HTTP(S) protocols
    expect(() => SsrfGuard.validateAndNormalizeUrl("file:///etc/passwd")).toThrow(/forbidden protocol/i);
    expect(() => SsrfGuard.validateAndNormalizeUrl("ftp://ftp.server.com")).toThrow(/forbidden protocol/i);

    // Legitimate public domain normalizes cleanly
    const safeUrl = SsrfGuard.validateAndNormalizeUrl("example.com/careers");
    expect(safeUrl.protocol).toBe("https:");
    expect(safeUrl.hostname).toBe("example.com");
  });

  // TEST 2: Evidence-First Intelligence: Fact vs Inference Separation
  it("2. Evidence Classification: accurately distinguishes VERIFIED FACT from AI INFERENCE", () => {
    const provider = new PublicWebResearchProvider();
    const signals = provider.analyzeSources("Apex Cargo", "apexcargo.test", [
      {
        url: "https://apexcargo.test/careers",
        title: "Careers at Apex Cargo",
        snippet: "We are hiring an Accounts Payable Clerk responsible for 3-way invoice matching.",
        rawText: "We are actively hiring an Accounts Payable Clerk to handle 3-way invoice matching and PDF intake.",
        sourceType: "JOB_POSTING",
        sourceQuality: "HIGH"
      },
      {
        url: "https://apexcargo.test/contact",
        title: "Contact Apex Cargo",
        snippet: "Please allow up to 48 hours for manual load reconciliation.",
        rawText: "Please allow up to 48 hours for manual load reconciliation and rate settlement.",
        sourceType: "PUBLIC_WORKFLOW",
        sourceQuality: "HIGH"
      }
    ]);

    expect(signals.isSufficientEvidence).toBe(true);
    expect(signals.evidenceList.length).toBeGreaterThanOrEqual(2);

    const factEvidence = signals.evidenceList.find((e) => e.type === "FACT");
    expect(factEvidence).toBeDefined();
    expect(factEvidence?.observedFact).toContain("Accounts Payable Clerk");
    expect(factEvidence?.aiInference).toBeDefined();
    expect(factEvidence?.aiInference).toContain("indicates that");
    expect(factEvidence?.sourceQuality).toBe("HIGH");
  });

  // TEST 3: Anti-Hallucination: Insufficient Evidence Handling
  it("3. Anti-Hallucination: handles empty or insufficient signals without inventing problems", () => {
    const provider = new PublicWebResearchProvider();
    const signals = provider.analyzeSources("Blank Corp", "blankcorp.test", [
      {
        url: "https://blankcorp.test",
        title: "Blank Corp",
        snippet: "Welcome to our company website.",
        rawText: "Welcome to our home page. We do business globally.",
        sourceType: "OFFICIAL_WEBSITE",
        sourceQuality: "HIGH"
      }
    ]);

    expect(signals.isSufficientEvidence).toBe(false);
    expect(signals.potentialProblem).toContain("Insufficient evidence");
    expect(signals.evidenceList.length).toBe(0);
  });

  // TEST 4: Transparent 6-Factor Opportunity Scoring
  it("4. Transparent 6-Factor Scoring: accurately calculates score out of 100 and assigns score tier", () => {
    const scoringHigh = OpportunityScorer.calculateScore({
      industry: "Logistics & Supply Chain",
      evidenceList: [
        {
          type: "FACT",
          category: "HIRING",
          observedFact: "Hiring Accounts Payable Clerk",
          confidenceScore: 90,
          sourceName: "Careers",
          sourceUrl: "https://example.com/careers",
          sourceQuality: "HIGH"
        },
        {
          type: "FACT",
          category: "PUBLIC_WORKFLOW",
          observedFact: "48 hour manual delay",
          confidenceScore: 85,
          sourceName: "Contact",
          sourceUrl: "https://example.com/contact",
          sourceQuality: "HIGH"
        },
        {
          type: "FACT",
          category: "TECH_SIGNAL",
          observedFact: "Manual spreadsheet reconciliation",
          confidenceScore: 80,
          sourceName: "Services",
          sourceUrl: "https://example.com/services",
          sourceQuality: "HIGH"
        }
      ],
      automationFitLevel: "PERFECT",
      decisionMaker: {
        name: "Marcus Vance",
        title: "VP Operations",
        email: null,
        sourceUrl: "https://example.com/about",
        evidenceSnippet: "VP Operations",
        isConfident: true
      }
    });

    expect(scoringHigh.score).toBeGreaterThanOrEqual(80);
    expect(scoringHigh.scoreTier).toBe("HIGH");
    expect(scoringHigh.confidence).toBeGreaterThanOrEqual(80);
    expect(scoringHigh.breakdown.icpFit).toBe(25);
    expect(scoringHigh.breakdown.painSignalStrength).toBe(25);
    expect(scoringHigh.breakdown.evidenceQuality).toBe(20);
    expect(scoringHigh.breakdown.reachability).toBe(5);
  });

  // TEST 5: MachineMind Verified Solution Mapping
  it("5. Solution Mapping: maps verified operational signals strictly to MachineMind products", () => {
    // Invoices / Documents -> M-EXTRACT + M-FLOW
    const invoiceMapping = MachineMindMapper.mapSignalsToSolution(
      "Manual invoice ingestion and accounts payable reconciliation create operational backlogs."
    );
    expect(invoiceMapping.productCodes).toContain("M-EXTRACT");
    expect(invoiceMapping.productCodes).toContain("M-FLOW");
    expect(invoiceMapping.workflowSteps.length).toBeGreaterThanOrEqual(4);

    // Customer inquiries / Support -> M-COPILOT
    const supportMapping = MachineMindMapper.mapSignalsToSolution(
      "High volume of customer support tickets leads to delayed responses."
    );
    expect(supportMapping.productCodes).toContain("M-COPILOT");

    // Disconnected tools -> System Integration
    const integrationMapping = MachineMindMapper.mapSignalsToSolution(
      "Siloed software platforms require manual spreadsheets to maintain reporting."
    );
    expect(integrationMapping.productCodes).toContain("System Integration");
  });

  // TEST 6: Problem-First Personalized Outreach Generation
  it("6. Outreach Generation: produces problem-first messaging adhering to Observation -> Problem -> Evidence -> Solution -> CTA", () => {
    const solution = MachineMindMapper.mapSignalsToSolution("Manual invoice ingestion creates delays.");
    const outreach = OutreachGenerator.generateProblemFirstOutreach({
      companyName: "LogiTrans Inc",
      decisionMaker: {
        name: "David Miller",
        title: "COO",
        email: null,
        sourceUrl: "https://logitrans.test/about",
        evidenceSnippet: "David Miller, COO",
        isConfident: true
      },
      potentialProblem: "Manual invoice matching and load reconciliation create dispatch bottlenecks.",
      evidenceList: [
        {
          type: "FACT",
          category: "HIRING",
          observedFact: "Careers portal indicates active hiring for Accounts Payable Clerk.",
          confidenceScore: 90,
          sourceName: "Careers",
          sourceUrl: "https://logitrans.test/careers",
          sourceQuality: "HIGH"
        },
        {
          type: "FACT",
          category: "PUBLIC_WORKFLOW",
          observedFact: "Rate confirmation guidelines specify 48-hour manual settlement delay.",
          confidenceScore: 85,
          sourceName: "Contact",
          sourceUrl: "https://logitrans.test/contact",
          sourceQuality: "HIGH"
        }
      ],
      solution
    });

    expect(outreach.subject).toContain("LogiTrans Inc");
    expect(outreach.body).toContain("Hi David,");
    expect(outreach.body).toContain("I was researching LogiTrans Inc and noticed");
    expect(outreach.body).toContain("MachineMind provides");
    expect(outreach.body).toContain("Alex Rivers");
    // Never says "I noticed you're struggling with"
    expect(outreach.body).not.toContain("struggling with");
  });

  // TEST 7: Multi-Tenant Organization Isolation
  it("7. Organization Isolation: Org A cannot access or mutate Org B opportunities", async () => {
    // Create opportunity in Org A
    const oppA = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        companyName: "Alpha Logistics",
        companyWebsite: "https://alphalogistics.test",
        potentialProblem: "Invoice processing backlog",
        whyItMatters: "Slow invoice payment",
        score: 85,
        scoreTier: "HIGH",
        recommendedSolution: "M-EXTRACT",
        solutionExplanation: "Extracts invoice line items",
        automationWorkflow: "[]",
        potentialBusinessImpact: "High"
      }
    });

    // Org B queries opportunities
    const orgBOpps = await OpportunityService.getOpportunities(orgBId);
    expect(orgBOpps.some((o) => o.id === oppA.id)).toBe(false);

    // Org B attempts to retrieve Org A opportunity
    const fetchedByOrgB = await OpportunityService.getOpportunityById(orgBId, oppA.id);
    expect(fetchedByOrgB).toBeNull();
  });

  // TEST 8: Mode 1 Autopilot Discovery Flow
  it("8. Autopilot Mode: discovers, analyzes, scores, and stores opportunities without user input", async () => {
    const opps = await OpportunityService.runAutopilot(orgAId);
    expect(opps.length).toBeGreaterThan(0);

    const firstOpp = opps[0];
    expect(firstOpp.organizationId).toBe(orgAId);
    expect(firstOpp.score).toBeGreaterThan(0);
    expect(firstOpp.recommendedSolution).toBeDefined();
    expect(firstOpp.generatedSubject).toBeDefined();
    expect(firstOpp.generatedEmail).toBeDefined();

    // Verify evidence is linked
    const dbOpp = await prisma.opportunity.findUnique({
      where: { id: firstOpp.id },
      include: { evidence: true }
    });
    expect(dbOpp?.evidence.length).toBeGreaterThan(0);
  });

  // TEST 9: Mode 2 URL Analyzer Flow
  it("9. URL Analyzer Mode: safely researches a target URL and records opportunity with facts and inferences", async () => {
    const opp = await OpportunityService.analyzeBusinessUrl(
      orgAId,
      "https://freightlink-logistics.test"
    );

    expect(opp).toBeDefined();
    expect(opp.organizationId).toBe(orgAId);
    expect(opp.companyWebsite).toContain("freightlink-logistics.test");
    expect(opp.score).toBeGreaterThan(0);
  });

  // TEST 10: Top 10 Lead Generation & Duplicate CRM Prevention
  it("10. Top-10 Lead Generation: selects vetted opportunities, prevents duplicates, and creates CRM leads", async () => {
    // Populate opportunities first
    await OpportunityService.runAutopilot(orgAId);

    const eligible = await prisma.opportunity.findFirstOrThrow({ where: {organizationId: orgAId, scoreTier: {in:["HIGH","MEDIUM"]}, status: "READY_FOR_REVIEW"} });
    await prisma.opportunity.update({where: {id: eligible.id}, data: {decisionMakerEmail:"contact@reviewed.test"}});

    // Generate top leads
    const result = await OpportunityService.generateTop10Leads(orgAId);
    expect(result.count).toBeGreaterThan(0);
    expect(result.leads.length).toBeLessThanOrEqual(10);

    const firstLead = result.leads[0];
    expect(firstLead.organizationId).toBe(orgAId);
    expect(firstLead.source).toBe("OPPORTUNITY_ENGINE");

    // Second call should NOT duplicate the already-created leads
    const secondResult = await OpportunityService.generateTop10Leads(orgAId);
    for (const lead of secondResult.leads) {
      expect(lead.companyName).not.toBe(firstLead.companyName);
    }
  });

  // TEST 11: Human Approval and SDR Execution Flow
  it("11. Human Approval Flow: allows review, approval with custom edits, and dispatch through SDR pipeline", async () => {
    // Populate opportunities first
    await OpportunityService.runAutopilot(orgAId);

    const opp = await prisma.opportunity.findFirst({
      where: { organizationId: orgAId, status: "READY_FOR_REVIEW" }
    });
    expect(opp).toBeDefined();

    await prisma.opportunity.update({where:{id:opp!.id},data:{decisionMakerEmail:null}});
    await expect(OpportunityService.approveOpportunity(orgAId, opp!.id)).rejects.toThrow("published contact email");
    await prisma.opportunity.update({where:{id:opp!.id},data:{decisionMakerEmail:"team@approved.test"}});

    // User edits and approves
    const customSubject = "Custom Problem-First Subject for Review";
    const customBody = "Hi Marcus,\n\nCustom edited outreach text.\n\nBest,\nAlex";

    const approved = await OpportunityService.approveOpportunity(orgAId, opp!.id, {
      subject: customSubject,
      email: customBody
    });

    expect(approved.status).toBe("APPROVED");
    expect(approved.generatedSubject).toBe(customSubject);
    expect(approved.generatedEmail).toBe(customBody);

    // Send approved outreach
    const sendResult = await OpportunityService.sendApprovedOutreach(orgAId, opp!.id);
    expect(sendResult.success).toBe(true);
    expect(sendResult.conversationId).toBeDefined();
    expect(sendResult.messageId).toBeDefined();

    // Verify opportunity is now marked SENT
    const refreshedOpp = await prisma.opportunity.findUnique({ where: { id: opp!.id } });
    expect(refreshedOpp?.status).toBe("SENT");

    // Verify conversation was created in existing CRM
    const conv = await prisma.conversation.findUnique({
      where: { id: sendResult.conversationId },
      include: { messages: true }
    });
    expect(conv).toBeDefined();
    expect(conv?.messages[0]?.content).toBe(customBody);
  });

  // TEST 12: DNC Safety Guardrail Enforcement
  it("12. DNC Safety: hard-blocks outreach to any lead that has opted out", async () => {
    // Create an opted-out lead
    const dncLead = await prisma.lead.create({
      data: {
        organizationId: orgAId,
        firstName: "Opted",
        lastName: "Out",
        email: "optout-lead@test.com",
        companyName: "DNC Freight",
        status: "OPTED_OUT",
        isOptedOut: true
      }
    });

    // Create an opportunity linked to this DNC lead
    const dncOpp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        companyName: "DNC Freight",
        companyWebsite: "https://dncfreight.test",
        potentialProblem: "Invoice backlog",
        whyItMatters: "Delay",
        score: 90,
        scoreTier: "HIGH",
        recommendedSolution: "M-EXTRACT",
        solutionExplanation: "Extracts invoices",
        automationWorkflow: "[]",
        potentialBusinessImpact: "High",
        leadId: dncLead.id,
        status: "APPROVED"
      }
    });

    // Attempting to send outreach MUST throw error and hard-block!
    await expect(OpportunityService.sendApprovedOutreach(orgAId, dncOpp.id)).rejects.toThrow(
      /blocked|opt-out|dnc/i
    );
  });
});
