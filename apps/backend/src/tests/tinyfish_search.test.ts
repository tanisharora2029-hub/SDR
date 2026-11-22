import { afterEach, describe, expect, it, vi } from "vitest";
import { TinyfishSearchProvider } from "../services/opportunity/discovery/tinyfishSearchProvider.js";
import { PublicSearchDiscoveryProvider } from "../services/opportunity/discovery/publicSearchDiscoveryProvider.js";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("TinyFish Search integration", () => {
 it("does not call the API without a key", async () => {
  vi.stubEnv("TINYFISH_API_KEY", ""); const fetcher=vi.fn(); vi.stubGlobal("fetch",fetcher);
  expect(await new TinyfishSearchProvider().search("salon Pune")).toEqual([]); expect(fetcher).not.toHaveBeenCalled();
 });
 it("authenticates on the fixed endpoint and removes unsafe/malformed results", async () => {
  vi.stubEnv("TINYFISH_API_KEY", "test-secret");
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({results:[
   {url:"https://salon.example/services",title:"Pune salon",snippet:"Hair services"},
   {url:"javascript:alert(1)",title:"bad"},{url:"https://user:pass@example.com",title:"bad"},{title:"missing"}
  ]}),{status:200}));vi.stubGlobal("fetch",fetcher);
  const hits=await new TinyfishSearchProvider().search("salon Pune"); expect(hits).toHaveLength(1);expect(hits[0].source).toBe("TINYFISH_SEARCH");
  const [url,options]=fetcher.mock.calls[0];expect(url.origin).toBe("https://api.search.tinyfish.ai");expect(url.searchParams.get("query")).toBe("salon Pune");expect(options.headers["X-API-Key"]).toBe("test-secret");expect(options.redirect).toBe("error");
 });
 it("keeps provider error bodies out of errors", async () => {
  vi.stubEnv("TINYFISH_API_KEY","test-secret");vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("secret response",{status:429})));
  await expect(new TinyfishSearchProvider().search("salon")).rejects.toThrow("TinyFish Search HTTP 429");
 });
 it("falls back to public search when TinyFish rejects a key", async () => {
  vi.stubEnv("TINYFISH_API_KEY","test-secret");vi.spyOn(TinyfishSearchProvider.prototype,"search").mockRejectedValue(new Error("unavailable"));
  const p=new PublicSearchDiscoveryProvider();vi.spyOn(p as any,"searchDuckDuckGo").mockResolvedValue([{url:"https://salon.example",title:"Pune salon",snippet:"Beauty salon Pune"}]);
  expect(await p.searchWeb("salon Pune")).toHaveLength(1);
 });
 it("rejects invalid response envelopes", async () => {
  vi.stubEnv("TINYFISH_API_KEY","test-secret");vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response('{}')));
  await expect(new TinyfishSearchProvider().search("salon")).rejects.toThrow("invalid result format");
 });
});
