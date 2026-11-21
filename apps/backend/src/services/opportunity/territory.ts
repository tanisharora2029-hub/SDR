export interface Territory { lat: number; lng: number; radius: number; industry: "salon" | "property" }
export interface BusinessListing { name: string; source: string; latitude: number; longitude: number; evidence: string }
export interface TerritoryProvider { search(area: Territory): Promise<BusinessListing[]> }

export const territoryProvider: TerritoryProvider = {
  async search({ lat, lng, radius, industry }) {
    const tag = industry === "salon" ? '["shop"~"^(hairdresser|beauty)$"]' : '["office"="estate_agent"]';
    const query = `[out:json][timeout:15];node${tag}["name"](around:${radius},${lat},${lng});out 50;`;
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST", body: new URLSearchParams({data: query}), signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw Error("Map directory unavailable");
    const result = await response.json() as { remark?: string; elements: { id: number; lat: number; lon: number; tags: Record<string,string> }[] };
    if (result.remark || !Array.isArray(result.elements)) throw Error("Incomplete map response");
    return result.elements.filter(e => e.tags?.name).map(e => ({ name: e.tags.name, latitude: e.lat, longitude: e.lon,
      evidence: e.tags.shop || e.tags.office, source: `https://www.openstreetmap.org/node/${e.id}` }));
  }
};
