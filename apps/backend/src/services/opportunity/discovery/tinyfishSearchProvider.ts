export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

/** TinySearch only: no browser automation, form submissions or contact uploads. */
export class TinyfishSearchProvider {
  async search(query: string): Promise<SearchHit[]> {
    const key = process.env.TINYFISH_API_KEY?.trim();
    if (!key) return [];
    const url = new URL("https://api.search.tinyfish.ai");
    url.searchParams.set("query", query.slice(0, 500));
    const response = await fetch(url, {
      headers: { "X-API-Key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
      redirect: "error"
    });
    // Never include response bodies/headers in errors: they can contain credentials.
    if (!response.ok) throw new Error(`TinyFish Search HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !Array.isArray((body as any).results)) {
      throw new Error("TinyFish Search returned an invalid result format");
    }
    return (body as { results: unknown[] }).results.slice(0, 30).flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const hit = item as Record<string, unknown>;
      if (typeof hit.url !== "string" || typeof hit.title !== "string") return [];
      try {
        const parsed = new URL(hit.url);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return [];
        return [{ url: parsed.href, title: hit.title.slice(0, 500),
          snippet: typeof hit.snippet === "string" ? hit.snippet.slice(0, 2000) : "",
          source: "TINYFISH_SEARCH" }];
      } catch { return []; }
    });
  }
}
