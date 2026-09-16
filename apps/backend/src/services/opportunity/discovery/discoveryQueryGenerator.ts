export type BusinessScaleTier = "ALL" | "SMB" | "MID_MARKET" | "ENTERPRISE";

export interface QueryGenerationOptions {
  industry?: string;
  limit?: number;
  scaleTier?: BusinessScaleTier;
}

export class DiscoveryQueryGenerator {
  private static readonly SMB_SCALES = [
    "small business",
    "regional",
    "growing",
    "independent",
    "boutique",
    "local"
  ];

  private static readonly MID_MARKET_SCALES = [
    "mid-market",
    "commercial"
  ];

  private static readonly ENTERPRISE_SCALES = [
    "enterprise",
    "national"
  ];

  private static readonly ICP_INDUSTRIES = [
    "logistics freight brokerage",
    "healthcare medical billing",
    "commercial lending fintech",
    "supply chain distribution",
    "insurance claims management",
    "legal compliance auditing",
    "accounts payable shared services",
    "trade services contractor operations",
    "property management real estate operations"
  ];

  private static readonly OPERATIONAL_PAIN_SIGNALS = [
    "invoice processing operations",
    "document intake processing",
    "claims operations adjudication",
    "prior authorization specialist",
    "manual data entry back-office",
    "accounts payable reconciliation",
    "customer support ticket backlog",
    "manual invoice quotes orders",
    "spreadsheet operations data entry",
    "repetitive document processing",
    "appointment intake workflows",
    "manual CRM updates reporting",
    "hiring operations coordinator",
    "hiring administrative assistant billing",
    "compliance paperwork filing"
  ];

  private static readonly QUERY_PATTERNS = [
    "{scale} {industry} companies hiring {pain}",
    "{scale} {industry} company {pain}",
    "{industry} company hiring {pain}",
    "{scale} {industry} services company {pain}",
    "{scale} {industry} business operations {pain}",
    "companies hiring {pain} in {industry}"
  ];

  /**
   * Generates dynamic, varied search queries targeting businesses with operational bottlenecks,
   * including small businesses (SMBs), regional companies, and growing operations teams.
   */
  public static generateQueries(options?: QueryGenerationOptions): string[] {
    const limit = options?.limit || 3;
    const queries: string[] = [];

    const industries = options?.industry
      ? [options.industry]
      : this.shuffle([...this.ICP_INDUSTRIES]);

    const painSignals = this.shuffle([...this.OPERATIONAL_PAIN_SIGNALS]);

    let scalePool: string[];
    if (options?.scaleTier === "SMB") {
      scalePool = [...this.SMB_SCALES];
    } else if (options?.scaleTier === "MID_MARKET") {
      scalePool = [...this.MID_MARKET_SCALES];
    } else if (options?.scaleTier === "ENTERPRISE") {
      scalePool = [...this.ENTERPRISE_SCALES];
    } else {
      // Default "ALL": blend SMB (prominently represented), mid-market, and enterprise
      scalePool = [
        ...this.SMB_SCALES,
        ...this.SMB_SCALES, // weighted to ensure SMBs are well discovered
        ...this.MID_MARKET_SCALES,
        ...this.ENTERPRISE_SCALES
      ];
    }
    const scales = this.shuffle(scalePool);

    for (let i = 0; i < limit; i++) {
      const industry = industries[i % industries.length];
      const pain = painSignals[i % painSignals.length];
      const scale = scales[i % scales.length];
      const pattern = this.QUERY_PATTERNS[i % this.QUERY_PATTERNS.length];

      const query = pattern
        .replace("{scale}", scale)
        .replace("{industry}", industry)
        .replace("{pain}", pain)
        .replace(/\s+/g, " ")
        .trim();

      if (!queries.includes(query)) {
        queries.push(query);
      }
    }

    return queries;
  }

  private static shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
