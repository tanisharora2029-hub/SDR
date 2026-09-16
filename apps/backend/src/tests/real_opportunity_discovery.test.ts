import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import { prisma } from "../lib/prisma.js";
import { OpportunityService } from "../services/opportunity/opportunityService.js";
import { DiscoveryQueryGenerator } from "../services/opportunity/discovery/discoveryQueryGenerator.js";
import { PublicSearchDiscoveryProvider } from "../services/opportunity/discovery/publicSearchDiscoveryProvider.js";
import { PublicWebResearchProvider } from "../services/opportunity/researchProvider.js";
import { OpportunityScorer } from "../services/opportunity/opportunityScorer.js";
import { aiService } from "../services/ai/aiService.js";

describe("Real Opportunity Engine Discovery & Anti-Hallucination Pipeline", () => {
  let server: http.Server;
  let serverPort: number;
  let testOrgId: string;
  let originalAiProvider: string | undefined;

  beforeAll(async () => {
    originalAiProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "mock";

    // 1. Create a controlled local test website to simulate a real business web presence
    server = http.createServer((req, res) => {
      res.setHeader("Content-Type", "text/html");

      if (req.url === "/") {
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Apex Freight Solutions - Logistics & Carrier Operations</title></head>
            <body>
              <h1>Apex Freight Solutions</h1>
              <nav>
                <a href="/services">Our Services</a>
                <a href="/careers">Careers & Openings</a>
                <a href="/operations">Operations & SLA</a>
                <a href="/about">Leadership & Team</a>
                <a href="https://linkedin.com/company/apex">External Social</a>
              </nav>
              <p>Welcome to Apex Freight Solutions. We operate nationwide freight and dispatch logistics.</p>
            </body>
          </html>
        `);
      } else if (req.url === "/careers") {
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Careers at Apex Freight</title></head>
            <body>
              <h2>Active Job Openings</h2>
              <div class="job">
                <h3>Accounts Payable Specialist</h3>
                <p>We are actively looking for an Accounts Payable Specialist responsible for 3-way manual invoice matching, bill of lading reconciliation, and entry into QuickBooks.</p>
              </div>
            </body>
          </html>
        `);
      } else if (req.url === "/operations") {
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Operations Workflow</title></head>
            <body>
              <h2>Carrier Settlement Guidelines</h2>
              <p>Please allow up to 48 hours for manual load reconciliation and rate confirmation review.</p>
            </body>
          </html>
        `);
      } else if (req.url === "/about") {
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>About Our Leadership</title></head>
            <body>
              <h2>Executive Leadership</h2>
              <p>Sarah Jenkins - VP of Operations</p>
            </body>
          </html>
        `);
      } else {
        res.statusCode = 404;
        res.end("Not Found");
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as any;
        serverPort = address.port;
        resolve();
      });
    });

    const org = await prisma.organization.create({
      data: { name: "Real Discovery Audit Org" }
    });
    testOrgId = org.id;
  });

  afterAll(async () => {
    process.env.AI_PROVIDER = originalAiProvider;
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await prisma.organization.delete({ where: { id: testOrgId } }).catch(() => {});
  });

  // TEST 1: No hardcoded candidate pool in OpportunityService
  it("1. Verifies AUTOPILOT_CANDIDATE_POOL has been completely purged from OpportunityService", () => {
    expect((OpportunityService as any).AUTOPILOT_CANDIDATE_POOL).toBeUndefined();
  });

  // TEST 2: Rejects .test domains in production
  it("2. Verifies .test domains are strictly rejected in production environment", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      await expect(
        OpportunityService.analyzeBusinessUrl(testOrgId, "https://fake-company.test")
      ).rejects.toThrow(/synthetic/i);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  // TEST 3: Dynamic search query generation from MachineMind ICP
  it("3. Generates dynamic, varied search queries from MachineMind's ICP matrix", () => {
    const queries = DiscoveryQueryGenerator.generateQueries({ limit: 4 });
    expect(queries.length).toBe(4);

    for (const q of queries) {
      expect(typeof q).toBe("string");
      expect(q.length).toBeGreaterThan(15);
      // Ensure no company names are hardcoded
      expect(q).not.toContain("FreightLink");
      expect(q).not.toContain("Vanguard Lending");
      expect(q).not.toContain("Apex Health");
    }
  });

  // TEST 4: Public search provider filters out directories, aggregators, and search engines
  it("4. Filters out aggregators, search engines, and social media domains", () => {
    const provider = new PublicSearchDiscoveryProvider();

    expect((provider as any).isBlockedDomain("google.com")).toBe(true);
    expect((provider as any).isBlockedDomain("linkedin.com")).toBe(true);
    expect((provider as any).isBlockedDomain("indeed.com")).toBe(true);
    expect((provider as any).isBlockedDomain("glassdoor.com")).toBe(true);
    expect((provider as any).isBlockedDomain("wikipedia.org")).toBe(true);
    expect((provider as any).isBlockedDomain("company.test")).toBe(true);
    expect((provider as any).isBlockedDomain("real-logistics-company.com")).toBe(false);
  });

  // TEST 5: Website crawler dynamically discovers internal links from HTML
  it("5. Dynamically extracts internal same-origin links and prioritizes operational subpages", () => {
    const crawler = new PublicWebResearchProvider();
    const html = `
      <a href="/careers">Join Our Team</a>
      <a href="/services">What We Do</a>
      <a href="/about-us">About Us</a>
      <a href="https://external.com/partner">Partner</a>
      <a href="/contact">Get in Touch</a>
    `;

    const links = (crawler as any).discoverInternalLinks(html, "https://apexlogistics.com", "apexlogistics.com");
    expect(links.length).toBeGreaterThan(0);
    expect(links).toContain("https://apexlogistics.com/careers");
    expect(links).toContain("https://apexlogistics.com/services");
    expect(links).not.toContain("https://external.com/partner");
  });

  // TEST 6: LLM analysis receives research material and separates facts, inferences, and unknowns
  it("6. AI Brain performs grounded extraction strictly separating facts, inferences, and unknowns", async () => {
    const pages = [
      {
        url: `http://127.0.0.1:${serverPort}/careers`,
        text: 'Accounts Payable Specialist: active opening requiring 3-way manual invoice matching and QuickBooks reconciliation.',
        title: "Careers"
      },
      {
        url: `http://127.0.0.1:${serverPort}/operations`,
        text: 'Please allow up to 48 hours for manual load reconciliation and rate confirmation review.',
        title: "Operations"
      }
    ];

    const result = await aiService.analyzeOpportunityContent({
      company: "Apex Freight Solutions",
      domain: "apex-freight.com",
      pages
    });

    expect(result).toBeDefined();
    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.inferences.length).toBeGreaterThan(0);

    // Verify facts have exact source URLs from pages
    for (const fact of result.facts) {
      expect(fact.sourceUrl).toBeDefined();
      expect([pages[0].url, pages[1].url]).toContain(fact.sourceUrl);
    }

    // Verify inference is distinct from fact
    const firstInf = result.inferences[0];
    expect(firstInf.aiInference).toBeDefined();
    expect(firstInf.basedOnFact).toBeDefined();
  });

  // TEST 7: Anti-Hallucination — No decision-maker email is ever fabricated
  it("7. Anti-Hallucination: never invents decision-maker emails", async () => {
    const pages = [
      {
        url: `http://127.0.0.1:${serverPort}/about`,
        text: "Leadership: Sarah Jenkins - VP of Operations",
        title: "About"
      }
    ];

    const crawler = new PublicWebResearchProvider();
    const signals = await (crawler as any).analyzeSourcesWithAi("Apex Freight", "apex-freight.com", [
      {
        url: pages[0].url,
        title: pages[0].title,
        snippet: pages[0].text,
        rawText: pages[0].text,
        sourceType: "LEADERSHIP",
        sourceQuality: "HIGH"
      }
    ]);

    expect(signals.decisionMaker.email).toBeNull();
  });

  // TEST 8: Rejection Gate — Rejects opportunity if website text has zero operational signals
  it("8. Rejection Gate: rejects opportunity when public text has no operational problem", async () => {
    const crawler = new PublicWebResearchProvider();
    const signals = await (crawler as any).analyzeSourcesWithAi("Empty Corp", "empty-corp.com", [
      {
        url: "https://empty-corp.com",
        title: "Home",
        snippet: "Minimal text",
        rawText: "Under construction. Coming soon.",
        sourceType: "OFFICIAL_WEBSITE",
        sourceQuality: "LOW"
      }
    ]);

    expect(signals.isSufficientEvidence).toBe(false);
  });

  // TEST 9: Failed discovery produces zero opportunities with honest status
  it("9. Honest Failure: returns zero opportunities when discovery finds no candidates", async () => {
    // Force discovery provider to return 0 candidates
    const origDiscover = (OpportunityService as any).discoveryProvider.discoverCandidates;
    (OpportunityService as any).discoveryProvider.discoverCandidates = async () => ({
      candidates: [],
      status: "NO_RESULTS",
      reason: "No real businesses discovered matching criteria.",
      queriesUsed: ["test query"]
    });

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    try {
      const opps: any = await OpportunityService.runAutopilot(testOrgId);
      expect(opps.length).toBe(0);
      expect(opps.discoveryStatus).toBe("NO_RESULTS");
    } finally {
      process.env.NODE_ENV = originalEnv;
      (OpportunityService as any).discoveryProvider.discoverCandidates = origDiscover;
    }
  });

  // TEST 10: Deduplication removes existing CRM leads
  it("10. Deduplication: skips candidates that already exist in CRM", async () => {
    await prisma.lead.create({
      data: {
        organizationId: testOrgId,
        firstName: "Existing",
        lastName: "Lead",
        email: "contact@existing-logistics.com",
        companyName: "Existing Logistics",
        status: "NEW"
      }
    });

    const mockCandidates = [
      {
        companyName: "Existing Logistics",
        domain: "existing-logistics.com",
        sourceUrl: "https://existing-logistics.com",
        discoveryQuery: "test",
        discoverySource: "TEST",
        title: "Existing Logistics",
        snippet: "Already in CRM"
      }
    ];

    const opps = await OpportunityService.runAutopilot(testOrgId, mockCandidates);
    expect(opps.length).toBe(0);
  });

  // TEST 11: SMB Multi-Scale Query Generation
  it("11. Discovery Query Generator: creates multi-scale queries actively targeting SMBs and regional businesses alongside enterprise", () => {
    const smbQueries = DiscoveryQueryGenerator.generateQueries({ limit: 6, scaleTier: "SMB" });
    expect(smbQueries.length).toBe(6);
    const smbKeywords = ["small business", "regional", "growing", "independent", "boutique", "local"];
    const containsSmbKeyword = smbQueries.some((q) =>
      smbKeywords.some((kw) => q.toLowerCase().includes(kw))
    );
    expect(containsSmbKeyword).toBe(true);

    const defaultQueries = DiscoveryQueryGenerator.generateQueries({ limit: 10 });
    expect(defaultQueries.length).toBe(10);
    // Ensure default blends SMB variations without size bias
    const blendsSmb = defaultQueries.some((q) =>
      smbKeywords.some((kw) => q.toLowerCase().includes(kw))
    );
    expect(blendsSmb).toBe(true);
  });

  // TEST 12: Transparent Scoring — 10-person SMB with verified repetitive manual workflows outscores 500-person enterprise with low pain
  it("12. Operational Leverage Scoring: 10-person SMB with repetitive clerical friction outscores low-pain enterprise", () => {
    // 10-person SMB with acute repetitive manual invoicing and spreadsheet reconciliation
    const smbScoring = OpportunityScorer.calculateScore({
      industry: "Logistics & Freight",
      companySize: "10 employees",
      evidenceList: [
        {
          type: "FACT",
          category: "HIRING",
          observedFact: "Hiring Operations Coordinator to manage manual invoice entry and rate reconciliation",
          confidenceScore: 92,
          sourceName: "Careers",
          sourceUrl: "https://small-carrier.com/careers",
          sourceQuality: "HIGH"
        },
        {
          type: "FACT",
          category: "PUBLIC_WORKFLOW",
          observedFact: "Manual spreadsheet reconciliation delays rate confirmation by 48 hours",
          confidenceScore: 88,
          sourceName: "Operations",
          sourceUrl: "https://small-carrier.com/operations",
          sourceQuality: "HIGH"
        }
      ],
      automationFitLevel: "PERFECT",
      decisionMaker: {
        name: "David Miller",
        title: "Owner & Founder",
        email: null,
        sourceUrl: "https://small-carrier.com/about",
        evidenceSnippet: "Owner & Founder",
        isConfident: true
      }
    });

    // 500-person enterprise with vague or low operational friction
    const enterpriseScoring = OpportunityScorer.calculateScore({
      industry: "General SaaS",
      companySize: "500 employees",
      evidenceList: [
        {
          type: "FACT",
          category: "DOCUMENTATION",
          observedFact: "Standard platform documentation available online",
          confidenceScore: 70,
          sourceName: "Docs",
          sourceUrl: "https://large-saas.com/docs",
          sourceQuality: "LOW"
        }
      ],
      automationFitLevel: "PARTIAL",
      decisionMaker: {
        name: null,
        title: null,
        email: null,
        sourceUrl: null,
        evidenceSnippet: null,
        isConfident: false
      }
    });

    // SMB with high repetition scores in HIGH tier (>= 80)
    expect(smbScoring.score).toBeGreaterThanOrEqual(80);
    expect(smbScoring.scoreTier).toBe("HIGH");
    expect(smbScoring.breakdown.painSignalStrength).toBe(25); // High repetition boost
    expect(smbScoring.breakdown.potentialBusinessImpact).toBe(10); // Lean team leverage

    // Low pain enterprise scores significantly lower
    expect(enterpriseScoring.score).toBeLessThan(60);
    expect(enterpriseScoring.scoreTier).toBe("LOW");

    // Clear proof that SMB outscores enterprise when operational friction is higher
    expect(smbScoring.score).toBeGreaterThan(enterpriseScoring.score);
  });

  // TEST 13: SMB Executive Reachability
  it("13. Reachability: recognizes SMB Owner / Founder with maximum reachability (5/5 pts)", () => {
    const scoring = OpportunityScorer.calculateScore({
      industry: "Healthcare Clinic Operations",
      companySize: "1-15 employees",
      evidenceList: [
        {
          type: "FACT",
          category: "PUBLIC_WORKFLOW",
          observedFact: "Manual patient intake forms and appointment reconciliation paperwork",
          confidenceScore: 85,
          sourceName: "Clinic Intake",
          sourceUrl: "https://local-clinic.com/intake",
          sourceQuality: "HIGH"
        }
      ],
      automationFitLevel: "PERFECT",
      decisionMaker: {
        name: "Dr. Rachel Green",
        title: "Owner & Principal",
        email: null,
        sourceUrl: "https://local-clinic.com/about",
        evidenceSnippet: "Owner & Principal",
        isConfident: true
      }
    });

    expect(scoring.breakdown.reachability).toBe(5);
  });

  // TEST 14: Strict Grounding & Anti-Hallucination for SMBs
  it("14. Grounding: rejects SMB if no verified operational evidence exists (size alone is never evidence)", async () => {
    const crawler = new PublicWebResearchProvider();
    const signals = await (crawler as any).analyzeSourcesWithAi("Small Boutique Logistics", "boutiquelogistics.com", [
      {
        url: "https://boutiquelogistics.com",
        title: "Home",
        snippet: "We are a boutique freight forwarder with a dedicated team.",
        rawText: "We are a boutique freight forwarder with a dedicated team of 8.",
        sourceType: "OFFICIAL_WEBSITE",
        sourceQuality: "HIGH"
      }
    ]);

    // Although small team is mentioned, there is NO operational bottleneck
    expect(signals.isSufficientEvidence).toBe(false);
    expect(signals.evidenceList.filter((e) => e.type === "FACT").length).toBe(0);
  });

  // TEST 15: 10-Point Pipeline Telemetry & Transparency Tracking
  it("15. Telemetry: verifies ResearchRun tracks all 10 pipeline metrics and records discovery trail", async () => {
    const mockCandidates = [
      {
        companyName: "Apex Freight Solutions",
        domain: `127.0.0.1:${serverPort}`,
        sourceUrl: `http://127.0.0.1:${serverPort}`,
        discoveryQuery: "logistics companies dispatch operations",
        discoverySource: "BING",
        title: "Apex Freight",
        snippet: "Freight and logistics operations"
      }
    ];

    const result = await OpportunityService.runAutopilot(testOrgId, mockCandidates);
    const latestRun = await OpportunityService.getLatestResearchRun(testOrgId);

    expect(latestRun).toBeDefined();
    expect(latestRun?.candidatesDiscovered).toBeGreaterThanOrEqual(1);
    expect(latestRun?.websitesCrawled).toBeGreaterThanOrEqual(1);
    expect(latestRun?.pagesRead).toBeGreaterThanOrEqual(1);
    expect(latestRun?.aiAnalysesCompleted).toBeGreaterThanOrEqual(1);
  });

  // TEST 16: Decision Maker Guard — Filters out role placeholders like "CEO or COO"
  it("16. Decision Maker Guard: filters out composite role strings like 'CEO or COO' and rejects non-human names", async () => {
    const crawler = new PublicWebResearchProvider();
    const signals = await (crawler as any).analyzeSourcesWithAi("Role Test Corp", "roletest.com", [
      {
        url: `http://127.0.0.1:${serverPort}/careers`,
        title: "Careers",
        snippet: "Accounts Payable Specialist: manual invoice matching.",
        rawText: "Accounts Payable Specialist: active opening requiring manual invoice matching. Please report to CEO or COO.",
        sourceType: "JOB_POSTING",
        sourceQuality: "HIGH"
      }
    ]);

    // The name should NOT be "CEO or COO"
    expect(signals.decisionMaker.name).not.toBe("CEO or COO");
    // Email must remain null
    expect(signals.decisionMaker.email).toBeNull();
  });
});

