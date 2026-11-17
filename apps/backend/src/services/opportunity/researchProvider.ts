import { SsrfGuard } from "./ssrfGuard.js";
import { OpportunityEvidenceItem, SourceQuality, DecisionMakerContact, ResearchFailureState } from "./types.js";
import { aiService } from "../ai/aiService.js";
import {
  BusinessAnalysis,
  OperationsAnalysis,
  OpportunityAnalysis,
  EvidenceCriticResult,
  AiOpportunityFact,
  AiOpportunityInference
} from "../ai/types.js";
import { logger } from "../../lib/logger.js";

export interface ResearchSourceItem {
  url: string;
  title: string;
  snippet: string;
  rawText: string;
  rawHtml?: string;
  sourceType: "OFFICIAL_WEBSITE" | "JOB_POSTING" | "CUSTOMER_REVIEW" | "PUBLIC_WORKFLOW" | "LEADERSHIP";
  sourceQuality: SourceQuality;
}

export interface WebResearchPackage {
  companyName: string;
  domain: string;
  homepage: string;
  pagesRead: string[];
  sourceUrls: string[];
  extractedText: string[];
  discoveryQuery?: string;
  discoverySource?: string;
  researchTimestamp: string;
}

export interface ExtractedSignals {
  companyName: string;
  domain: string;
  industry: string;
  companySize?: string;
  location?: string;
  potentialProblem: string;
  whyItMatters: string;
  evidenceList: OpportunityEvidenceItem[];
  decisionMaker: DecisionMakerContact;
  isSufficientEvidence: boolean;
  insufficiencyReason?: string;
  failureState?: ResearchFailureState;
  recommendedSolution?: string;
  automationWorkflow?: string[];
  automationFit?: "PERFECT" | "GOOD" | "PARTIAL" | "NONE";
  pagesRead: string[];
  sourceUrls: string[];
  unknowns: string[];
  operationalSignals?: string[];
  aiInferences?: string[];
  businessAnalysis?: BusinessAnalysis;
  operationsAnalysis?: OperationsAnalysis;
  criticVerdict?: "SUPPORTED" | "WEAK" | "UNSUPPORTED";
  criticNotes?: string;
  researchPackage?: WebResearchPackage;
}

export interface ResearchProvider {
  fetchPage(url: string): Promise<ResearchSourceItem | null>;
  researchCompany(
    companyName: string,
    domain: string,
    context?: { discoveryQuery?: string; discoverySource?: string; onProgress?: (stage: string, details?: any) => void }
  ): Promise<ExtractedSignals>;
}

export class PublicWebResearchProvider implements ResearchProvider {
  private static readonly REQUEST_TIMEOUT_MS = 8000;
  private static readonly MAX_PAGES_PER_COMPANY = 8;
  private static readonly USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NexSDR-ResearchBot/2.0";

  private static readonly PRIORITY_KEYWORDS = [
    "career",
    "jobs",
    "services",
    "operations",
    "support",
    "contact",
    "about",
    "solutions",
    "resources",
    "blog",
    "news",
    "compliance",
    "workflow"
  ];

  /**
   * Safely fetches a public webpage, strips markup, and extracts clean text metadata.
   */
  public async fetchPage(rawUrl: string): Promise<ResearchSourceItem | null> {
    try {
      const parsedUrl = SsrfGuard.validateAndNormalizeUrl(rawUrl);
      await SsrfGuard.verifyResolvedIp(parsedUrl.hostname);

      const response = await fetch(parsedUrl.toString(), {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(PublicWebResearchProvider.REQUEST_TIMEOUT_MS),
        headers: {
          "User-Agent": PublicWebResearchProvider.USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
      if (!response.ok) {
        await response.body?.cancel();
        logger.warn(`[ResearchProvider] HTTP ${response.status} fetching ${parsedUrl.hostname}`);
        return null;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        await response.body?.cancel();
        return null;
      }

      const reader = response.body?.getReader();
      if (!reader) return null;
      const decoder = new TextDecoder();
      let html = "";
      let bytes = 0;
      try {
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
          bytes += chunk.value.byteLength;
          if (bytes > 1_048_576) {
            await reader.cancel();
            return null;
          }
          html += decoder.decode(chunk.value, { stream: true });
        }
        html += decoder.decode();
      } finally {
        reader.releaseLock();
      }
      const cleanedText = this.cleanHtml(html);
      const title = this.extractTitle(html) || parsedUrl.hostname;
      const snippet = cleanedText.slice(0, 300);

      const isJobs = parsedUrl.pathname.includes("career") || parsedUrl.pathname.includes("job");
      const isTeam = parsedUrl.pathname.includes("about") || parsedUrl.pathname.includes("team") || parsedUrl.pathname.includes("leadership");

      return {
        url: parsedUrl.toString(),
        title,
        snippet,
        rawText: cleanedText,
        rawHtml: html,
        sourceType: isJobs ? "JOB_POSTING" : isTeam ? "LEADERSHIP" : "OFFICIAL_WEBSITE",
        sourceQuality: "HIGH"
      };
    } catch (err: any) {
      logger.info(`[ResearchProvider] Safe fetch skipped or failed for ${rawUrl}: ${err.message}`);
      return null;
    }
  }

  /**
   * Dynamically researches a target business:
   * 1. Starts at the homepage.
   * 2. Extracts internal links dynamically from HTML.
   * 3. Prioritizes relevant operational pages (careers, services, operations, contact, about, solutions).
   * 4. Fetches up to 8 pages per company (8s timeout, 1MB limit, SSRF protection).
   * 5. Sends researched text to existing AI Brain for structured extraction.
   */
  public async researchCompany(
    companyName: string,
    domain: string,
    context?: { discoveryQuery?: string; discoverySource?: string }
  ): Promise<ExtractedSignals> {
    const cleanDomain = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
    const homepageUrl = `https://${cleanDomain}`;

    logger.info(`[ResearchProvider] Starting dynamic crawl for ${companyName} at ${homepageUrl}`);

    const sources: ResearchSourceItem[] = [];

    // 1. Fetch Homepage
    let homeItem = await this.fetchPage(homepageUrl);
    if (!homeItem || !homeItem.rawText || homeItem.rawText.length < 50) {
      // Try http fallback if https failed
      homeItem = await this.fetchPage(`http://${cleanDomain}`);
    }

    if (!homeItem || !homeItem.rawText || homeItem.rawText.length < 50) {
      logger.warn(`[ResearchProvider] Homepage unreachable for ${cleanDomain}`);
      return {
        companyName,
        domain: cleanDomain,
        industry: "Unknown",
        potentialProblem: "Unable to crawl target business website.",
        whyItMatters: "Website was unreachable or returned insufficient public content.",
        evidenceList: [],
        decisionMaker: {
          name: null,
          title: null,
          email: null,
          sourceUrl: null,
          evidenceSnippet: null,
          isConfident: false
        },
        isSufficientEvidence: false,
        insufficiencyReason: "Website could not be reached via safe public HTTP.",
        pagesRead: [],
        sourceUrls: [],
        unknowns: ["Homepage unreachable"]
      };
    }

    sources.push(homeItem);

    // 2. Discover internal links dynamically from homepage HTML
    const discoveredLinks = this.discoverInternalLinks(homeItem.rawHtml || "", homepageUrl, cleanDomain);

    // 3. Fetch prioritized internal pages up to limit
    const visitedUrls = new Set<string>([homepageUrl, homeItem.url]);

    for (const url of discoveredLinks) {
      if (sources.length >= PublicWebResearchProvider.MAX_PAGES_PER_COMPANY) break;
      if (visitedUrls.has(url)) continue;

      visitedUrls.add(url);
      const subpage = await this.fetchPage(url);
      if (subpage && subpage.rawText && subpage.rawText.length > 50) {
        sources.push(subpage);
      }

      // Polite inter-page pause
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info(`[ResearchProvider] Crawled ${sources.length} pages for ${companyName} (${cleanDomain})`);

    const pagesRead = sources.map((s) => s.url);
    const sourceUrls = Array.from(new Set(pagesRead));
    const researchPackage: WebResearchPackage = {
      companyName,
      domain: cleanDomain,
      homepage: homepageUrl,
      pagesRead,
      sourceUrls,
      extractedText: sources.map((s) => s.rawText.slice(0, 500)),
      discoveryQuery: context?.discoveryQuery,
      discoverySource: context?.discoverySource,
      researchTimestamp: new Date().toISOString()
    };

    // 4. Run AI Analysis via existing AI Brain
    return this.analyzeSourcesWithAi(companyName, cleanDomain, sources, researchPackage);
  }

  /**
   * Extracts and prioritizes same-origin internal links from HTML.
   */
  private discoverInternalLinks(html: string, baseUrl: string, cleanDomain: string): string[] {
    const candidates: Array<{ url: string; score: number }> = [];
    const seen = new Set<string>();

    const linkRegex = /<a\s+[^>]*href=["']([^"'#\s>]+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const rawHref = match[1];

      try {
        const resolved = new URL(rawHref, baseUrl);

        // Enforce same clean domain
        const host = resolved.hostname.toLowerCase().replace(/^www\./i, "");
        if (host !== cleanDomain && !host.endsWith(`.${cleanDomain}`)) {
          continue;
        }

        // Only HTTP/HTTPS
        if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
          continue;
        }

        // Strip query params & hash
        resolved.search = "";
        resolved.hash = "";
        const cleanUrl = resolved.toString();

        if (seen.has(cleanUrl) || cleanUrl === baseUrl || cleanUrl === `${baseUrl}/`) {
          continue;
        }

        seen.add(cleanUrl);

        // Score based on priority keywords
        const pathLower = resolved.pathname.toLowerCase();
        let score = 0;
        for (const kw of PublicWebResearchProvider.PRIORITY_KEYWORDS) {
          if (pathLower.includes(kw)) {
            score += 10;
          }
        }

        // Avoid images, downloads, media files
        if (/\.(png|jpe?g|gif|svg|pdf|zip|tar|gz|mp4|webp|ico|css|js)$/i.test(pathLower)) {
          continue;
        }

        candidates.push({ url: cleanUrl, score });
      } catch {
        // Ignore invalid URLs
      }
    }

    // Sort candidates by score descending
    candidates.sort((a, b) => b.score - a.score);

    const resultLinks = candidates.map((c) => c.url);

    // If few or no links were discovered (e.g. JS rendered menu), add standard common routes
    if (resultLinks.length < 3) {
      const standardRoutes = [
        `${baseUrl}/careers`,
        `${baseUrl}/jobs`,
        `${baseUrl}/services`,
        `${baseUrl}/operations`,
        `${baseUrl}/about`,
        `${baseUrl}/contact`
      ];
      for (const route of standardRoutes) {
        if (!seen.has(route)) {
          resultLinks.push(route);
        }
      }
    }

    return resultLinks.slice(0, 15);
  }

  /**
   * Synchronous heuristic source analyzer.
   */
  public analyzeSources(
    companyName: string,
    domain: string,
    sources: ResearchSourceItem[]
  ): ExtractedSignals {
    const combinedContent = sources.map((s) => s.rawText || "").join("\n");
    const evidenceList: OpportunityEvidenceItem[] = [];

    let potentialProblem = "";
    let whyItMatters = "";
    let detectedIndustry = "B2B Operations";

    // 1. Scan for Hiring Signals
    const hiringRegex = /(?:hiring|openings?|looking for|job description|responsibilities)\s*[:\w\s,-]{0,100}?(accounts payable(?: clerk| specialist| coordinator)?|invoice (?:specialist|clerk)?|data entry(?: clerk)?|customer support(?: representative)?|claims processor|operations coordinator|billing clerk|support specialist)/i;
    const hiringMatch = combinedContent.match(hiringRegex);

    if (hiringMatch) {
      const role = hiringMatch[1].trim();
      const hiringSource = sources.find((s) => s.sourceType === "JOB_POSTING") || sources[0] || { url: `https://${domain}/careers`, title: "Careers Page" };

      evidenceList.push({
        type: "FACT",
        category: "HIRING",
        observedFact: `Official careers portal indicates active hiring for repetitive operational role: "${role}".`,
        aiInference: `Active hiring for ${role} indicates that back-office transaction workload is growing and currently scaling linearly with headcount rather than automation.`,
        confidenceScore: 88,
        sourceName: `${companyName} Careers Portal`,
        sourceUrl: hiringSource.url,
        sourceQuality: "HIGH"
      });
    }

    // 2. Scan for Public Manual Workflow or SLA Delay signals
    const workflowRegex = /(?:(?:please allow|takes|turnaround(?: time)? of|processing(?: time)? of|within)\s+)?(?:up to\s+)?(\d+[\s-]*(?:hours?|days?|business days?|weeks?))|(?:submit\s+(?:your\s+)?(?:form|invoice|claim|request|document|details))/i;
    const workflowMatch = combinedContent.match(workflowRegex);

    if (workflowMatch) {
      const delay = workflowMatch[1] || workflowMatch[0] || "manual intake";
      const wfSource = sources.find((s) => s.url.includes("contact") || s.url.includes("support")) || sources[0] || { url: `https://${domain}/contact`, title: "Contact Page" };

      evidenceList.push({
        type: "FACT",
        category: "PUBLIC_WORKFLOW",
        observedFact: `Public workflow documentation explicitly specifies manual intake or SLA processing window: "${delay}".`,
        aiInference: `Document and inquiry handoffs appear to require human routing, creating delay buffers and customer communication friction.`,
        confidenceScore: 85,
        sourceName: `${companyName} Contact & Support Workflow`,
        sourceUrl: wfSource.url,
        sourceQuality: "HIGH"
      });
    }

    // 3. Scan for Disconnected Tools / Disclosures
    const techRegex = /(?:salesforce|hubspot|sap|oracle|excel|quickbooks|netsuite|zendesk|freshdesk|spreadsheets?|manual entry)/i;
    const techMatches = combinedContent.match(techRegex);

    if (techMatches) {
      const tool = techMatches[0];
      evidenceList.push({
        type: "FACT",
        category: "TECH_SIGNAL",
        observedFact: `Public documentation or job requirements reference operational reliance on "${tool}".`,
        aiInference: `Team utilizes ${tool} for operational record-keeping, requiring routine data synchronization across operational boundaries.`,
        confidenceScore: 78,
        sourceName: `${companyName} Website Documentation`,
        sourceUrl: sources[0]?.url || `https://${domain}`,
        sourceQuality: "HIGH"
      });
    }

    // 4. Decision Maker Discovery (Strict: No guessing emails!)
    let decisionMaker: DecisionMakerContact = {
      name: null,
      title: null,
      email: null,
      sourceUrl: null,
      evidenceSnippet: null,
      isConfident: false
    };

    const teamSource = sources.find((s) => s.sourceType === "LEADERSHIP" || s.url.includes("about") || s.url.includes("team"));
    const dmRegex = /(?:(?:coo|chief operating officer|head of operations|vp of operations|head of automation|director of operations|operations manager|founder|co-founder|owner|ceo|president|principal|managing director)\s*[-:,|]?\s*([A-Z][a-z]+ [A-Z][a-z]+)|([A-Z][a-z]+ [A-Z][a-z]+)\s*[-:,|]?\s*(?:coo|chief operating officer|head of operations|vp of operations|head of automation|director of operations|operations manager|founder|co-founder|owner|ceo|president|principal|managing director))/i;
    const dmMatch = (teamSource?.rawText || combinedContent).match(dmRegex);

    if (dmMatch) {
      const identifiedName = dmMatch[1] || dmMatch[2];
      let identifiedTitle = "Operations Leadership";
      const fullMatchLower = dmMatch[0].toLowerCase();
      if (fullMatchLower.includes("owner")) identifiedTitle = "Owner";
      else if (fullMatchLower.includes("founder")) identifiedTitle = "Founder";
      else if (fullMatchLower.includes("ceo")) identifiedTitle = "CEO";
      else if (fullMatchLower.includes("president")) identifiedTitle = "President";
      else if (fullMatchLower.includes("principal")) identifiedTitle = "Principal";
      else if (fullMatchLower.includes("operations manager")) identifiedTitle = "Operations Manager";
      else if (fullMatchLower.includes("coo") || fullMatchLower.includes("chief operating officer")) identifiedTitle = "COO";
      else if (fullMatchLower.includes("vp")) identifiedTitle = "VP of Operations";
      else if (fullMatchLower.includes("head of operations")) identifiedTitle = "Head of Operations";

      decisionMaker = {
        name: identifiedName.trim(),
        title: identifiedTitle,
        email: null,
        sourceUrl: teamSource?.url || `https://${domain}/about`,
        evidenceSnippet: dmMatch[0].trim(),
        isConfident: true
      };
    }

    // Determine Industry from content
    const lower = combinedContent.toLowerCase();
    if (lower.includes("logistics") || lower.includes("freight") || lower.includes("carrier") || lower.includes("shipping")) {
      detectedIndustry = "Logistics & Freight";
    } else if (lower.includes("health") || lower.includes("clinic") || lower.includes("patient") || lower.includes("medical")) {
      detectedIndustry = "Healthcare & Clinic Operations";
    } else if (lower.includes("fintech") || lower.includes("lending") || lower.includes("loan") || lower.includes("credit")) {
      detectedIndustry = "Fintech & Lending Operations";
    } else if (lower.includes("legal") || lower.includes("law firm") || lower.includes("compliance")) {
      detectedIndustry = "Legal & Compliance";
    }

    // Dynamically detect company size clues
    let detectedCompanySize = "Small to Mid-Sized Business";
    const sizeMatch = combinedContent.match(/(?:team of\s*(\d+)|(\d+[\s-]*(?:to|-)\s*\d+|\d+)\s*employees|small team|boutique firm)/i);
    if (sizeMatch) {
      if (sizeMatch[1]) detectedCompanySize = `${sizeMatch[1]} employees`;
      else if (sizeMatch[2]) detectedCompanySize = `${sizeMatch[2]} employees`;
      else detectedCompanySize = "1-20 employees";
    }

    if (evidenceList.length === 0) {
      return {
        companyName,
        domain,
        industry: detectedIndustry,
        companySize: detectedCompanySize,
        potentialProblem: "Insufficient evidence of operational bottleneck.",
        whyItMatters: "Public sources do not exhibit distinct document or inquiry processing friction.",
        evidenceList: [],
        decisionMaker,
        isSufficientEvidence: false,
        insufficiencyReason: "No credible operational problem or repetitive workflow signal was observable in public web data.",
        pagesRead: sources.map((s) => s.url),
        sourceUrls: Array.from(new Set(sources.map((s) => s.url))),
        unknowns: ["No operational bottleneck signals observable in public web pages."]
      };
    }

    const hasHiring = evidenceList.some((e) => e.category === "HIRING");
    const hasWf = evidenceList.some((e) => e.category === "PUBLIC_WORKFLOW");

    if (hasHiring && hasWf) {
      potentialProblem = "Manual intake and operational transaction processing appear to require growing human coordination, creating throughput constraints.";
      whyItMatters = "As operational volume expands, clerical processing delays impact service delivery while driving up operational overhead.";
    } else if (hasHiring) {
      potentialProblem = "Back-office transaction processing appears to rely on repetitive manual data handling, requiring continuous staffing.";
      whyItMatters = "Linear headcount dependency limits operational margins during volume surges.";
    } else {
      potentialProblem = "Document workflows and inquiry handoffs may involve manual verification steps that delay turnaround times.";
      whyItMatters = "Streamlining repetitive intake handoffs frees internal teams to focus on high-touch client advisory.";
    }

    return {
      companyName,
      domain,
      industry: detectedIndustry,
      companySize: detectedCompanySize,
      location: "United States / Global",
      potentialProblem,
      whyItMatters,
      evidenceList,
      decisionMaker,
      isSufficientEvidence: true,
      pagesRead: sources.map((s) => s.url),
      sourceUrls: Array.from(new Set(sources.map((s) => s.url))),
      unknowns: []
    };
  }

  /**
   * 4-Stage Multi-Pass AI Sales Research Brain reasoning pipeline:
   * 1. Business Analyst: Understand business, offerings, scale, and customer base
   * 2. Operations Analyst: Detect workflows, intake channels, tools, and friction points
   * 3. Opportunity Analyst: Map problems to MachineMind products and formulate automation workflow
   * 4. Evidence Critic: Audits evidence grounding, rejects fabricated facts, determines overall verdict
   */
  public async runMultiPassAnalysis(
    companyName: string,
    domain: string,
    sources: ResearchSourceItem[],
    researchPackage?: WebResearchPackage,
    onProgress?: (stage: string, details?: any) => void
  ): Promise<ExtractedSignals | null> {
    const pagePayload = sources
      .map((s, idx) => `PAGE ${idx + 1} [${s.url}] (${s.title || "Page"}):\n${s.rawText.slice(0, 2000)}`)
      .join("\n\n---\n\n");

    try {
      // ──────────────────────────────────────────────
      // STAGE 1: Business Analyst
      // ──────────────────────────────────────────────
      onProgress?.("BUSINESS_ANALYST", { message: `Stage 1: Business Analyst evaluating ${companyName}...` });
      const stage1System = `You are an elite Business Analyst for MachineMind.
Analyze the provided crawled website text for a company and determine what the business actually does.
Prioritize small businesses, startups, regional/growing companies, and lean operations teams as well as mid-market firms.

OUTPUT STRICT JSON:
{
  "companyName": "${companyName}",
  "whatTheyDo": "Concise summary of their core product/service",
  "industry": "Specific industry",
  "companySize": "e.g. 1-15 employees, 10-50 employees, or detected size",
  "location": "Detected city/state/country or 'Global'",
  "customerType": "e.g. B2B, B2C, SMBs, Consumers, Enterprise",
  "servicesOffered": ["service 1", "service 2"]
}`;

      const stage1User = `Company: ${companyName} (${domain})\n\nCrawled Content:\n${pagePayload}`;
      const businessAnalysis: BusinessAnalysis | null = await aiService.analyzeOpportunityStage(
        "BUSINESS_ANALYST",
        stage1System,
        stage1User
      );

      if (!businessAnalysis || !businessAnalysis.whatTheyDo) {
        logger.warn(`[MultiPassAI] Stage 1 (Business Analyst) yielded empty output for ${companyName}`);
        return null;
      }

      // ──────────────────────────────────────────────
      // STAGE 2: Operations Analyst
      // ──────────────────────────────────────────────
      onProgress?.("OPERATIONS_ANALYST", { message: `Stage 2: Operations Analyst inspecting workflows at ${companyName}...` });
      const stage2System = `You are an elite Operations & Workflow Analyst for MachineMind.
Analyze the company context and crawled website text to identify observable operational workflows, intake channels, and repetitive task signals.

LOOK FOR SIGNALS OF:
- Repetitive data entry, manual document processing, spreadsheets
- High-volume customer inquiries, support requests, intake forms
- Order entry, invoicing, quotes, reconciliation, billing
- Hiring for administrative, coordinator, customer support, or operations roles
- Turnaround time SLAs, manual email handoffs, disconnected tools

CRITICAL: Every observed workflow and signal MUST cite the exact sourceUrl where it was found in the text.

OUTPUT STRICT JSON:
{
  "observedWorkflows": [
    {
      "workflow": "Description of manual/observed workflow",
      "sourceUrl": "exact URL from crawled pages",
      "evidenceSnippet": "short verbatim snippet from text"
    }
  ],
  "operationalSignals": [
    {
      "signal": "e.g. Hiring for Operations Coordinator",
      "type": "HIRING",
      "sourceUrl": "exact URL",
      "snippet": "verbatim text"
    }
  ],
  "technologyMentions": ["software/tools mentioned in text"],
  "hiringSignals": ["job roles mentioned"]
}`;

      const stage2User = `Company: ${companyName} (${domain})\nBusiness Summary: ${businessAnalysis.whatTheyDo}\nIndustry: ${businessAnalysis.industry}\n\nCrawled Content:\n${pagePayload}`;
      const operationsAnalysis: OperationsAnalysis | null = await aiService.analyzeOpportunityStage(
        "OPERATIONS_ANALYST",
        stage2System,
        stage2User
      );

      // ──────────────────────────────────────────────
      // STAGE 3: Opportunity Analyst
      // ──────────────────────────────────────────────
      onProgress?.("OPPORTUNITY_ANALYST", { message: `Stage 3: Opportunity Analyst synthesizing automation fit for ${companyName}...` });
      const stage3System = `You are an elite Opportunity Analyst for MachineMind.
Evaluate the business context and operational signals to determine where MachineMind automation can provide high operational leverage.

MachineMind Products:
- M-EXTRACT: Document, invoice, form, and data extraction from PDFs, emails, unstructured files.
- M-FLOW: Workflow automation, cross-system data entry, repetitive clerical task execution.
- M-COPILOT: Intelligent customer support triaging, inquiry drafting, SOP knowledge base retrieval.
- M-AGENTS: Multi-stage operations coordination, tracking, and autonomous execution with human-in-the-loop.
- System Integration: Connecting disconnected software and spreadsheets to eliminate manual data transfers.
- Compliance: Audit trails, regulatory checklists, and verification workflows.

CRITICAL ANTI-HALLUCINATION RULES:
1. Every FACT must be verbatim or directly observed with exact sourceUrl.
2. Every INFERENCE must cite which fact it is based on.
3. Every UNKNOWN must state what is unconfirmed by public text.
4. Decision Maker: Owner, Founder, CEO, COO, Operations Director/Manager only if explicitly named in text. Email MUST be null.
5. If there is NO observable operational bottleneck, set automationFit to "NONE" and facts to [].

OUTPUT STRICT JSON:
{
  "potentialProblem": "1-2 sentence core operational bottleneck",
  "whyItMatters": "1-2 sentence business friction or scaling barrier",
  "automationFit": "PERFECT" | "GOOD" | "PARTIAL" | "NONE",
  "recommendedSolution": "M-EXTRACT" | "M-FLOW" | "M-COPILOT" | "M-AGENTS" | "System Integration" | "Compliance" | "M-EXTRACT + M-FLOW" | "M-COPILOT + M-FLOW",
  "workflow": [
    "1. Ingestion: ...",
    "2. Processing: ...",
    "3. Verification: ...",
    "4. Execution: ...",
    "5. Human escalation on exception"
  ],
  "facts": [
    {
      "observedFact": "verbatim observation",
      "sourceUrl": "exact url",
      "category": "HIRING" | "PUBLIC_WORKFLOW" | "TECH_SIGNAL" | "DOCUMENTATION",
      "confidenceScore": 85
    }
  ],
  "inferences": [
    {
      "aiInference": "logical deduction",
      "basedOnFact": "the observed fact",
      "confidenceScore": 80
    }
  ],
  "unknowns": ["item not publicly verified"],
  "decisionMaker": {
    "name": "Full Name or null",
    "title": "Title or null",
    "sourceUrl": "url or null"
  },
  "confidence": 75
}`;

      const stage3User = `Company: ${companyName} (${domain})\nWhat They Do: ${businessAnalysis.whatTheyDo}\nWorkflows Detected: ${JSON.stringify(operationsAnalysis?.observedWorkflows || [])}\nOperational Signals: ${JSON.stringify(operationsAnalysis?.operationalSignals || [])}\n\nCrawled Content:\n${pagePayload}`;
      const opportunityAnalysis: OpportunityAnalysis | null = await aiService.analyzeOpportunityStage(
        "OPPORTUNITY_ANALYST",
        stage3System,
        stage3User
      );

      if (!opportunityAnalysis) {
        logger.warn(`[MultiPassAI] Stage 3 (Opportunity Analyst) failed for ${companyName}`);
        return null;
      }

      // ──────────────────────────────────────────────
      // STAGE 4: Evidence Critic
      // ──────────────────────────────────────────────
      onProgress?.("EVIDENCE_CRITIC", { message: `Stage 4: Evidence Critic stress-testing evidence for ${companyName}...` });
      const stage4System = `You are a strict, skeptical Evidence Critic for MachineMind.
Your sole job is to audit the proposed opportunity against the actual crawled text and reject any ungrounded claims, fabricated facts, or generic assumptions.

AUDIT RULES:
1. Examine each fact: Is it genuinely supported by the text and sourceUrl? If not, REJECT it.
2. Size alone is NEVER evidence of an operational problem.
3. Industry alone is NEVER evidence of an operational problem.
4. Check inferences: Are they reasonable deductions or wild guesses?
5. Determine overall verdict:
   - "SUPPORTED": At least one verifiable operational fact grounded in text.
   - "WEAK": Generic signals with minimal verifiable friction.
   - "UNSUPPORTED": Zero verified facts or fabricated/hallucinated claims. MUST be rejected.

OUTPUT STRICT JSON:
{
  "verifiedFacts": [
    {
      "observedFact": "grounded fact",
      "sourceUrl": "url",
      "category": "category",
      "confidenceScore": 85
    }
  ],
  "rejectedFacts": [
    {
      "fact": "rejected claim",
      "reason": "why it was rejected"
    }
  ],
  "strengthenedInferences": [
    {
      "aiInference": "sound inference",
      "basedOnFact": "grounded fact",
      "confidenceScore": 80
    }
  ],
  "overallVerdict": "SUPPORTED" | "WEAK" | "UNSUPPORTED",
  "critiqueNotes": "brief audit notes",
  "adjustedConfidence": 75
}`;

      const stage4User = `Proposed Opportunity for ${companyName} (${domain}):
Problem: ${opportunityAnalysis.potentialProblem}
Facts Claimed: ${JSON.stringify(opportunityAnalysis.facts || [])}
Inferences: ${JSON.stringify(opportunityAnalysis.inferences || [])}

Actual Crawled Content to Verify Against:
${pagePayload}`;

      const criticResult: EvidenceCriticResult | null = await aiService.analyzeOpportunityStage(
        "EVIDENCE_CRITIC",
        stage4System,
        stage4User
      );

      // Audit decision:
      const verifiedFacts = (criticResult?.verifiedFacts || []).filter((fact) =>
        this.findFactSource(fact, sources)
      );

      const verifiedInferences = (criticResult?.strengthenedInferences && criticResult.strengthenedInferences.length > 0)
        ? criticResult.strengthenedInferences
        : (opportunityAnalysis.inferences || []);

      const overallVerdict = criticResult?.overallVerdict || "UNSUPPORTED";

      // Evidence Gate:
      const isCriticRejected = overallVerdict === "UNSUPPORTED" || verifiedFacts.length === 0 || opportunityAnalysis.automationFit === "NONE";
      const isSufficient = !isCriticRejected;

      // Construct evidence list
      const evidenceList: OpportunityEvidenceItem[] = [];
      for (const fact of verifiedFacts) {
        if (fact.observedFact && fact.observedFact.trim()) {
          evidenceList.push({
            type: "FACT",
            category: (fact.category as any) || "PUBLIC_WORKFLOW",
            observedFact: fact.observedFact.trim(),
            confidenceScore: fact.confidenceScore || 85,
            sourceName: `${companyName} Website`,
            sourceUrl: fact.sourceUrl || sources[0]?.url || `https://${domain}`,
            sourceQuality: (fact.sourceQuality as any) || "HIGH"
          });
        }
      }

      for (const inf of verifiedInferences) {
        if (inf.aiInference && inf.aiInference.trim()) {
          evidenceList.push({
            type: "INFERENCE",
            category: "PUBLIC_WORKFLOW",
            observedFact: inf.basedOnFact || (evidenceList[0]?.observedFact ?? "Observed operational context"),
            aiInference: inf.aiInference.trim(),
            confidenceScore: inf.confidenceScore || 80,
            sourceName: `${companyName} Analysis`,
            sourceUrl: evidenceList[0]?.sourceUrl || sources[0]?.url || `https://${domain}`,
            sourceQuality: "HIGH"
          });
        }
      }

      const unknowns = Array.isArray(opportunityAnalysis.unknowns) ? opportunityAnalysis.unknowns.filter(Boolean) : [];
      for (const unknownItem of unknowns) {
        evidenceList.push({
          type: "UNKNOWN",
          category: "PUBLIC_WORKFLOW",
          observedFact: `Unverified / Not publicly disclosed: ${unknownItem}`,
          aiInference: "Public pages do not specify or confirm this operational detail.",
          confidenceScore: 50,
          sourceName: `${companyName} Public Assessment`,
          sourceUrl: sources[0]?.url || `https://${domain}`,
          sourceQuality: "MEDIUM"
        });
      }

      // Decision Maker handling
      let dmName = opportunityAnalysis.decisionMaker?.name ? opportunityAnalysis.decisionMaker.name.trim() : null;
      let dmTitle = opportunityAnalysis.decisionMaker?.title ? opportunityAnalysis.decisionMaker.title.trim() : null;
      const invalidNamePatterns = /\b(or|and|&|team|department|staff|operations|support|sales|management|unknown|none|n\/a)\b/i;
      const titleKeywords = /\b(ceo|coo|cfo|cto|president|director|manager|lead|head|founder|officer|partner|vp)\b/i;

      if (dmName) {
        if (invalidNamePatterns.test(dmName)) {
          if (!dmTitle && titleKeywords.test(dmName)) {
            dmTitle = dmName;
          }
          dmName = null;
        } else {
          const words = dmName.split(/\s+/);
          const looksLikePerson =
            words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Z][a-zA-Z'\-.]+$/.test(w));
          if (!looksLikePerson) {
            dmName = null;
          }
        }
      }

      const decisionMaker: DecisionMakerContact = {
        name: dmName,
        title: dmTitle,
        email: null,
        sourceUrl: opportunityAnalysis.decisionMaker?.sourceUrl || (dmName ? sources[0]?.url : null),
        evidenceSnippet: dmName ? "Identified in leadership documentation" : null,
        isConfident: Boolean(dmName && dmTitle)
      };

      const pagesRead = researchPackage?.pagesRead || sources.map((s) => s.url);
      const sourceUrls = researchPackage?.sourceUrls || Array.from(new Set(sources.map((s) => s.url)));

      return {
        companyName,
        domain,
        industry: businessAnalysis.industry || "B2B Operations",
        companySize: businessAnalysis.companySize || "Small to Mid-Sized Business",
        location: businessAnalysis.location || "United States / Global",
        potentialProblem: isSufficient
          ? opportunityAnalysis.potentialProblem
          : "Insufficient evidence of operational bottleneck.",
        whyItMatters: isSufficient
          ? opportunityAnalysis.whyItMatters
          : "Public documentation does not show distinct manual workflow bottlenecks.",
        evidenceList,
        decisionMaker,
        isSufficientEvidence: isSufficient,
        failureState: isSufficient ? "SUCCESS" : (overallVerdict === "UNSUPPORTED" ? "EVIDENCE_CRITIC_REJECTED" : "INSUFFICIENT_EVIDENCE"),
        insufficiencyReason: isSufficient
          ? undefined
          : (criticResult?.critiqueNotes || "Evidence Critic rejected opportunity or insufficient operational evidence."),
        recommendedSolution: opportunityAnalysis.recommendedSolution,
        automationWorkflow: opportunityAnalysis.workflow,
        automationFit: opportunityAnalysis.automationFit,
        pagesRead,
        sourceUrls,
        unknowns,
        operationalSignals: (operationsAnalysis?.operationalSignals || []).map(s => s.signal),
        aiInferences: verifiedInferences.map(i => i.aiInference),
        businessAnalysis,
        operationsAnalysis: operationsAnalysis || undefined,
        criticVerdict: overallVerdict,
        criticNotes: criticResult?.critiqueNotes,
        researchPackage
      };
    } catch (err: any) {
      logger.warn(`[MultiPassAI] 4-stage pipeline encountered error for ${companyName}: ${err.message}. Falling back.`);
      return null;
    }
  }

  /**
   * Analyzes researched sources using the existing AI Brain.
   */
  public async analyzeSourcesWithAi(
    companyName: string,
    domain: string,
    sources: ResearchSourceItem[],
    researchPackage?: WebResearchPackage
  ): Promise<ExtractedSignals> {
    if (sources.length === 0) {
      return {
        companyName,
        domain,
        industry: "Unknown",
        potentialProblem: "Insufficient public content found.",
        whyItMatters: "No public pages could be analyzed.",
        evidenceList: [],
        decisionMaker: {
          name: null,
          title: null,
          email: null,
          sourceUrl: null,
          evidenceSnippet: null,
          isConfident: false
        },
        isSufficientEvidence: false,
        insufficiencyReason: "No crawled pages available for analysis.",
        pagesRead: [],
        sourceUrls: [],
        unknowns: ["No crawled pages available for analysis."],
        researchPackage
      };
    }

    try {
      // 1. Try 4-Stage Multi-Pass AI Sales Research Brain reasoning pipeline
      const multiPassResult = await this.runMultiPassAnalysis(companyName, domain, sources, researchPackage);
      if (multiPassResult) {
        return multiPassResult;
      }

      // 2. Resilient fallback to single-pass extraction if multi-pass returned null
      const pagePayload = sources.map((s) => ({
        url: s.url,
        text: s.rawText.slice(0, 2500),
        title: s.title
      }));

      const aiResult = await aiService.analyzeOpportunityContent({
        company: companyName,
        domain,
        pages: pagePayload
      });

      // Construct verified evidence items
      const evidenceList: OpportunityEvidenceItem[] = [];

      if (Array.isArray(aiResult.facts)) {
        for (const fact of aiResult.facts) {
          if (this.findFactSource(fact, sources)) {
            evidenceList.push({
              type: "FACT",
              category: (fact.category as any) || "PUBLIC_WORKFLOW",
              observedFact: fact.observedFact.trim(),
              confidenceScore: fact.confidenceScore || 85,
              sourceName: `${companyName} Website`,
              sourceUrl: fact.sourceUrl || sources[0]?.url || `https://${domain}`,
              sourceQuality: (fact.sourceQuality as any) || "HIGH"
            });
          }
        }
      }

      if (Array.isArray(aiResult.inferences)) {
        for (const inf of aiResult.inferences) {
          if (inf.aiInference && inf.aiInference.trim()) {
            evidenceList.push({
              type: "INFERENCE",
              category: "PUBLIC_WORKFLOW",
              observedFact: inf.basedOnFact || (evidenceList[0]?.observedFact ?? "Observed operational context"),
              aiInference: inf.aiInference.trim(),
              confidenceScore: inf.confidenceScore || 80,
              sourceName: `${companyName} Analysis`,
              sourceUrl: evidenceList[0]?.sourceUrl || sources[0]?.url || `https://${domain}`,
              sourceQuality: "HIGH"
            });
          }
        }
      }

      const unknowns: string[] = Array.isArray(aiResult.unknowns) ? aiResult.unknowns.filter(Boolean) : [];
      for (const unknownItem of unknowns) {
        evidenceList.push({
          type: "UNKNOWN",
          category: "PUBLIC_WORKFLOW",
          observedFact: `Unverified / Not publicly disclosed: ${unknownItem}`,
          aiInference: "Public pages do not specify or confirm this operational detail.",
          confidenceScore: 50,
          sourceName: `${companyName} Public Assessment`,
          sourceUrl: sources[0]?.url || `https://${domain}`,
          sourceQuality: "MEDIUM"
        });
      }

      // Check evidence sufficiency & anti-hallucination gate: Must have at least one verified FACT
      const hasFacts = evidenceList.some((e) => e.type === "FACT");
      const isSufficient = hasFacts && aiResult.automationFit !== "NONE";

      // Strict Decision-Maker Validation:
      // Filter out role placeholders or non-human names (e.g., "CEO or COO", "Operations Team", "Manager")
      let dmName = aiResult.decisionMaker?.name ? aiResult.decisionMaker.name.trim() : null;
      let dmTitle = aiResult.decisionMaker?.title ? aiResult.decisionMaker.title.trim() : null;

      const invalidNamePatterns = /\b(or|and|&|team|department|staff|operations|support|sales|management|unknown|none|n\/a)\b/i;
      const titleKeywords = /\b(ceo|coo|cfo|cto|president|director|manager|lead|head|founder|officer|partner|vp)\b/i;

      if (dmName) {
        if (invalidNamePatterns.test(dmName)) {
          // If it's a title like "CEO or COO", don't treat it as a human name
          if (!dmTitle && titleKeywords.test(dmName)) {
            dmTitle = dmName;
          }
          dmName = null;
        } else {
          // Verify it looks like an actual person's name (2-4 words, uppercase starts)
          const words = dmName.split(/\s+/);
          const looksLikePerson =
            words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Z][a-zA-Z'\-.]+$/.test(w));
          if (!looksLikePerson) {
            dmName = null;
          }
        }
      }

      const decisionMaker: DecisionMakerContact = {
        name: dmName,
        title: dmTitle,
        email: null, // STRICT: Never guess or invent email
        sourceUrl: aiResult.decisionMaker?.sourceUrl || (dmName ? sources[0]?.url : null),
        evidenceSnippet: dmName ? `Identified in leadership documentation` : null,
        isConfident: Boolean(dmName && dmTitle)
      };

      const pagesRead = researchPackage?.pagesRead || sources.map((s) => s.url);
      const sourceUrls = researchPackage?.sourceUrls || Array.from(new Set(sources.map((s) => s.url)));

      return {
        companyName,
        domain,
        industry: aiResult.industry || "B2B Operations",
        companySize: aiResult.companySize || "Small to Mid-Sized Business",
        potentialProblem: isSufficient
          ? aiResult.potentialProblem
          : "Insufficient evidence of operational bottleneck.",
        whyItMatters: isSufficient
          ? aiResult.whyItMatters
          : "Public documentation does not show distinct manual workflow bottlenecks.",
        evidenceList,
        decisionMaker,
        isSufficientEvidence: isSufficient,
        insufficiencyReason: isSufficient
          ? undefined
          : "No credible operational problem or repetitive workflow signal was observable in public web data.",
        recommendedSolution: aiResult.recommendedSolution,
        automationWorkflow: aiResult.workflow,
        automationFit: aiResult.automationFit,
        pagesRead,
        sourceUrls,
        unknowns,
        researchPackage
      };
    } catch (err: any) {
      logger.error(`[ResearchProvider] AI analysis failed for ${companyName}: ${err.message}`);
      return {
        companyName,
        domain,
        industry: "Unknown",
        potentialProblem: "Analysis failed due to processing error.",
        whyItMatters: "Unable to verify operational signals.",
        evidenceList: [],
        decisionMaker: {
          name: null,
          title: null,
          email: null,
          sourceUrl: null,
          evidenceSnippet: null,
          isConfident: false
        },
        isSufficientEvidence: false,
        insufficiencyReason: `AI extraction error: ${err.message}`,
        pagesRead: researchPackage?.pagesRead || sources.map((s) => s.url),
        sourceUrls: researchPackage?.sourceUrls || Array.from(new Set(sources.map((s) => s.url))),
        unknowns: [`AI extraction error: ${err.message}`],
        researchPackage
      };
    }
  }

  private findFactSource(
    fact: { observedFact?: string; sourceUrl?: string },
    sources: ResearchSourceItem[]
  ) {
    const quote = fact.observedFact?.trim().replace(/\s+/g, " ").toLowerCase();
    if (!quote || quote.length < 12) return undefined;
    return sources.find((source) =>
      source.url === fact.sourceUrl &&
      source.rawText.replace(/\s+/g, " ").toLowerCase().includes(quote)
    );
  }

  private cleanHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  private extractTitle(html: string): string | null {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : null;
  }
}
