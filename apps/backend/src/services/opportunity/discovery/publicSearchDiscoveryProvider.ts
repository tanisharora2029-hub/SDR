import dns from "dns";
import { SsrfGuard } from "../ssrfGuard.js";
import { logger } from "../../../lib/logger.js";

export interface DiscoveredCompanyCandidate {
  companyName: string;
  domain: string;
  sourceUrl: string;
  discoveryQuery: string;
  discoverySource: string;
  title: string;
  snippet: string;
}

export interface DiscoveryTrailItem {
  query: string;
  source: string;
  url: string;
  domain: string;
  title: string;
  snippet: string;
  isAccepted: boolean;
  rejectReason?: string;
}

export interface DiscoveryResult {
  candidates: DiscoveredCompanyCandidate[];
  status: "SUCCESS" | "NO_RESULTS" | "FAILED" | "DISCOVERY_UNAVAILABLE";
  reason?: string;
  queriesUsed: string[];
  totalSearchResults: number;
  discoveryTrail: DiscoveryTrailItem[];
}

export class PublicSearchDiscoveryProvider {
  private static readonly REQUEST_TIMEOUT_MS = 9000;
  private static readonly USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NexSDR-Discovery/2.0";

  // Blacklist of aggregators, directories, social networks, search engines, and info portals
  private static readonly DOMAIN_BLOCKLIST = new Set([
    "duckduckgo.com",
    "google.com",
    "bing.com",
    "yahoo.com",
    "baidu.com",
    "yandex.com",
    "linkedin.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "youtube.com",
    "reddit.com",
    "tiktok.com",
    "pinterest.com",
    "wikipedia.org",
    "wikimedia.org",
    "medium.com",
    "github.com",
    "gitlab.com",
    "g2.com",
    "capterra.com",
    "clutch.co",
    "trustpilot.com",
    "yelp.com",
    "yellowpages.com",
    "justdial.com",
    "indiamart.com",
    "tradeindia.com",
    "sulekha.com",
    "zaubacorp.com",
    "tofler.in",
    "instafinancials.com",
    "naukri.com",
    "shine.com",
    "monsterindia.com",
    "indeed.com",
    "indeed.co.in",
    "simplyhired.co.in",
    "simplyhired.com",
    "glassdoor.com",
    "glassdoor.co.in",
    "ziprecruiter.com",
    "monster.com",
    "crunchbase.com",
    "pitchbook.com",
    "zoominfo.com",
    "apollo.io",
    "quora.com",
    "stackoverflow.com",
    "substack.com",
    "forbes.com",
    "bloomberg.com",
    "businessinsider.com",
    "wsj.com",
    "nytimes.com",
    "zhihu.com",
    "weibo.com",
    "bilibili.com",
    "douban.com",
    "stackexchange.com",
    "wiktionary.org",
    "wikidata.org",
    "fandom.com",
    "ambitionbox.com",
    "moneycontrol.com",
    "economictimes.indiatimes.com",
    "geeksforgeeks.org",
    "investopedia.com",
    "ascm.org",
    "britannica.com",
    "dictionary.com",
    "merriam-webster.com",
    "cambridge.org",
    "thefreedictionary.com",
    "unitconverters.net",
    "thecalculatorsite.com",
    "calculator.net",
    "rapidtables.com",
    "convertunits.com",
    "worldatlas.com",
    "mapsofindia.com",
    "vajiramandravi.com",
    "drishtiias.com",
    "tripadvisor.com"
  ]);

  /**
   * Discovers real businesses matching generated MachineMind ICP search queries.
   */
  public async discoverCandidates(queries: string[], maxCandidates = 8): Promise<DiscoveryResult> {
    const candidates: DiscoveredCompanyCandidate[] = [];
    const seenDomains = new Set<string>();
    const queriesUsed: string[] = [];
    const discoveryTrail: DiscoveryTrailItem[] = [];
    let totalSearchResults = 0;

    for (const query of queries) {
      if (candidates.length >= maxCandidates) break;

      queriesUsed.push(query);
      logger.info(`[DiscoveryProvider] Executing public search query: "${query}"`);

      try {
        const results = await this.searchWeb(query);
        totalSearchResults += results.length;

        for (const item of results) {
          const domain = this.extractCleanDomain(item.url);
          if (!domain) {
            discoveryTrail.push({
              query,
              source: "PUBLIC_WEB_SEARCH",
              url: item.url,
              domain: "unknown",
              title: item.title,
              snippet: item.snippet,
              isAccepted: false,
              rejectReason: "Malformed URL or unresolvable domain"
            });
            continue;
          }

          // Check blocklist
          if (this.isBlockedDomain(domain)) {
            discoveryTrail.push({
              query,
              source: "PUBLIC_WEB_SEARCH",
              url: item.url,
              domain,
              title: item.title,
              snippet: item.snippet,
              isAccepted: false,
              rejectReason: "Blocked aggregator, directory, or non-commercial domain"
            });
            continue;
          }

          // Deduplicate within run
          if (seenDomains.has(domain)) {
            discoveryTrail.push({
              query,
              source: "PUBLIC_WEB_SEARCH",
              url: item.url,
              domain,
              title: item.title,
              snippet: item.snippet,
              isAccepted: false,
              rejectReason: "Duplicate domain in search run"
            });
            continue;
          }

          // Verify DNS and reachability
          const isReachable = await this.verifyDnsAndPublicReachability(domain);
          if (!isReachable) {
            discoveryTrail.push({
              query,
              source: "PUBLIC_WEB_SEARCH",
              url: item.url,
              domain,
              title: item.title,
              snippet: item.snippet,
              isAccepted: false,
              rejectReason: "Failed DNS lookup or private IP verification"
            });
            continue;
          }

          const companyName = this.extractCompanyName(item.title, domain);

          seenDomains.add(domain);
          const candidate: DiscoveredCompanyCandidate = {
            companyName,
            domain,
            sourceUrl: item.url,
            discoveryQuery: query,
            discoverySource: "PUBLIC_WEB_SEARCH",
            title: item.title,
            snippet: item.snippet
          };

          candidates.push(candidate);
          discoveryTrail.push({
            query,
            source: "PUBLIC_WEB_SEARCH",
            url: item.url,
            domain,
            title: item.title,
            snippet: item.snippet,
            isAccepted: true
          });

          if (candidates.length >= maxCandidates) break;
        }

        // Polite pause between search queries
        if (queries.indexOf(query) < queries.length - 1 && candidates.length < maxCandidates) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch (err: any) {
        logger.warn(`[DiscoveryProvider] Search query "${query}" failed: ${err.message}`);
      }
    }

    if (candidates.length === 0) {
      return {
        candidates: [],
        status: "NO_RESULTS",
        reason: "No real businesses discovered from public search queries matching criteria.",
        queriesUsed,
        totalSearchResults,
        discoveryTrail
      };
    }

    return {
      candidates,
      status: "SUCCESS",
      queriesUsed,
      totalSearchResults,
      discoveryTrail
    };
  }

  public async searchWeb(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
    const generic = new Set(["india", "companies", "company", "small", "business", "local", "regional", "careers", "hiring", "services"]);
    const terms = [...new Set(query.toLowerCase().match(/[a-z]{4,}/g) || [])].filter(term => !generic.has(term));
    for (const search of [this.searchDuckDuckGo, this.searchBing]) {
      try {
        const hits = await search.call(this, query);
        const relevant = hits.filter(hit => {
          const description = (hit.title + " " + hit.snippet).toLowerCase();
          try {
            if (this.isBlockedDomain(new URL(hit.url).hostname)) return false;
          } catch { return false; }
          return terms.filter(term => description.includes(term)).length >= Math.min(2, terms.length);
        });
        if (relevant.length) return relevant;
      } catch (error) {
        logger.warn("[DiscoveryProvider] Search provider failed", error);
      }
    }
    return [];
  }

  /**
   * Queries Bing Public Search and extracts candidate URLs, titles, and snippets.
   */
  public async searchBing(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PublicSearchDiscoveryProvider.REQUEST_TIMEOUT_MS);

    const targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": PublicSearchDiscoveryProvider.USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
      clearTimeout(timeout);

      if (!response.ok) {
        logger.warn(`[DiscoveryProvider] Bing returned HTTP ${response.status}`);
        return [];
      }

      const html = await response.text();
      return this.parseBingHtml(html);
    } catch (err: any) {
      clearTimeout(timeout);
      logger.warn(`[DiscoveryProvider] Bing request error: ${err.message}`);
      return [];
    }
  }

  /**
   * Parses Bing HTML result blocks.
   */
  public parseBingHtml(html: string): Array<{ title: string; url: string; snippet: string }> {
    const items: Array<{ title: string; url: string; snippet: string }> = [];
    const blocks = html.split('<li class="b_algo"');

    for (const block of blocks.slice(1)) {
      let url: string | null = null;

      // Extract direct URL from base64-encoded click redirect (u=a1...)
      const uMatch = block.match(/[?&;]u=a1([a-zA-Z0-9_\-]+)/);
      if (uMatch) {
        try {
          let b64 = uMatch[1].replace(/-/g, "+").replace(/_/g, "/");
          while (b64.length % 4 !== 0) b64 += "=";
          const decoded = Buffer.from(b64, "base64").toString("utf-8");
          if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
            url = decoded;
          }
        } catch {}
      }

      // Fallback: extract canonical from <cite> tag
      if (!url) {
        const citeMatch = block.match(/<cite>([\s\S]*?)<\/cite>/i);
        if (citeMatch) {
          let raw = citeMatch[1].replace(/<[^>]+>/g, "").split(/\s*[›>]\s*/)[0].trim();
          if (!raw.startsWith("http")) raw = `https://${raw}`;
          try {
            const parsed = new URL(raw);
            url = parsed.origin;
          } catch {}
        }
      }

      if (!url) continue;

      const titleMatch = block.match(/<h2[^>]*><a[^>]*>([\s\S]*?)<\/a><\/h2>/i);
      const snippetMatch =
        block.match(/<p class="b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
        block.match(/<div class="b_caption"><p[^>]*>([\s\S]*?)<\/p>/i);

      items.push({
        url,
        title: titleMatch ? this.cleanHtml(titleMatch[1]) : "",
        snippet: snippetMatch ? this.cleanHtml(snippetMatch[1]) : ""
      });
    }

    return items;
  }

  /**
   * Queries DuckDuckGo HTML endpoint and extracts candidate URLs, titles, and snippets.
   */
  public async searchDuckDuckGo(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PublicSearchDiscoveryProvider.REQUEST_TIMEOUT_MS);

    const targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": PublicSearchDiscoveryProvider.USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
      clearTimeout(timeout);

      if (!response.ok) {
        logger.warn(`[DiscoveryProvider] DuckDuckGo returned HTTP ${response.status}`);
        return [];
      }

      const html = await response.text();
      return this.parseDuckDuckGoHtml(html);
    } catch (err: any) {
      clearTimeout(timeout);
      logger.warn(`[DiscoveryProvider] DuckDuckGo request error: ${err.message}`);
      return [];
    }
  }

  /**
   * Parses DuckDuckGo HTML result blocks.
   */
  public parseDuckDuckGoHtml(html: string): Array<{ title: string; url: string; snippet: string }> {
    const items: Array<{ title: string; url: string; snippet: string }> = [];
    const blocks = html.split('<div class="result results_links');

    for (const block of blocks.slice(1)) {
      const uddgMatch = block.match(/href="[^"]*uddg=([^&"]+)/i);
      // Handles variations like <a rel="nofollow" class="result__a" ...>
      const titleMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);

      if (uddgMatch) {
        try {
          const rawUrl = decodeURIComponent(uddgMatch[1]);
          const title = titleMatch ? this.cleanHtml(titleMatch[1]) : "";
          const snippet = snippetMatch ? this.cleanHtml(snippetMatch[1]) : "";

          // Ensure valid URL
          const parsed = new URL(rawUrl);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            items.push({
              title,
              url: rawUrl,
              snippet
            });
          }
        } catch (e) {
          // Ignore malformed URL
        }
      }
    }

    return items;
  }

  private isBlockedDomain(domain: string): boolean {
    const lower = domain.toLowerCase();
    if (
      lower.endsWith(".test") ||
      lower.endsWith(".local") ||
      lower.endsWith(".edu") ||
      lower.includes(".edu.") ||
      lower.endsWith(".gov") ||
      lower.includes(".gov.") ||
      lower.endsWith(".nic.in") ||
      lower.endsWith(".mil") ||
      lower.endsWith(".ac.in") ||
      lower.endsWith(".ac.uk") ||
      lower === "localhost"
    ) {
      return true;
    }

    for (const blocked of PublicSearchDiscoveryProvider.DOMAIN_BLOCKLIST) {
      if (lower === blocked || lower.endsWith(`.${blocked}`)) {
        return true;
      }
    }
    return false;
  }

  private extractCleanDomain(rawUrl: string): string | null {
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase().replace(/^www\./i, "");
      if (host.includes(".") && !host.startsWith(".")) {
        return host;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async verifyDnsAndPublicReachability(domain: string): Promise<boolean> {
    try {
      // 1. SSRF check
      const parsedUrl = SsrfGuard.validateAndNormalizeUrl(`https://${domain}`);
      await SsrfGuard.verifyResolvedIp(parsedUrl.hostname);

      // 2. DNS lookup check using OS getaddrinfo (cross-platform compatible)
      const lookup = await dns.promises.lookup(parsedUrl.hostname).catch(() => null);
      if (!lookup || !lookup.address) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }


  private extractCompanyName(title: string, domain: string): string {
    if (title) {
      // Split on common delimiters: " | ", " - ", " : ", " — ", " – "
      const parts = title.split(/\s+[-|—–:•]\s+/);
      if (parts.length > 1) {
        // Usually company name is the first part or the last part if first is page name
        const first = parts[0].trim();
        const last = parts[parts.length - 1].trim();

        if (first.length > 2 && first.length < 40 && !this.isGenericWord(first)) {
          return first;
        }
        if (last.length > 2 && last.length < 40 && !this.isGenericWord(last)) {
          return last;
        }
      }
    }

    // Fallback: derive from domain name (e.g., "freight-hub.com" -> "Freight Hub")
    const baseName = domain.split(".")[0];
    return baseName
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  private isGenericWord(word: string): boolean {
    const generic = [
      "home",
      "about",
      "contact",
      "services",
      "solutions",
      "careers",
      "jobs",
      "overview",
      "welcome",
      "guide",
      "blog"
    ];
    return generic.includes(word.toLowerCase());
  }

  private cleanHtml(text: string): string {
    return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
}
