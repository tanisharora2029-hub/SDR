export interface QueryGenerationOptions {
  industry?: string;
  limit?: number;
}

export class DiscoveryQueryGenerator {
  private static readonly ICP_INDUSTRIES = [
    "logistics freight brokerage",
    "healthcare medical billing",
    "commercial lending fintech",
    "supply chain distribution",
    "insurance claims management",
    "legal compliance auditing",
    "accounts payable shared services"
  ];

  private static readonly OPERATIONAL_PAIN_SIGNALS = [
    "invoice processing operations",
    "document intake processing",
    "claims operations adjudication",
    "prior authorization specialist",
    "manual data entry back-office",
    "accounts payable reconciliation",
    "customer support ticket backlog"
  ];

  private static readonly QUERY_PATTERNS = [
    "{industry} companies hiring {pain}",
    "{industry} companies {pain}",
    "companies hiring {pain} in {industry}",
    "US {industry} services {pain}"
  ];

  /**
   * Generates dynamic, varied search queries targeting businesses with operational bottlenecks.
   */
  public static generateQueries(options?: QueryGenerationOptions): string[] {
    const limit = options?.limit || 3;
    const queries: string[] = [];

    const industries = options?.industry
      ? [options.industry]
      : this.shuffle([...this.ICP_INDUSTRIES]);

    const painSignals = this.shuffle([...this.OPERATIONAL_PAIN_SIGNALS]);

    for (let i = 0; i < limit; i++) {
      const industry = industries[i % industries.length];
      const pain = painSignals[i % painSignals.length];
      const pattern = this.QUERY_PATTERNS[i % this.QUERY_PATTERNS.length];

      const query = pattern
        .replace("{industry}", industry)
        .replace("{pain}", pain)
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
