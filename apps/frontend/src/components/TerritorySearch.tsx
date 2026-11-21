import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api/client.js";

const cities: Record<string,[number,number]> = {Pune:[18.52,73.86], Mumbai:[19.076,72.878], Delhi:[28.614,77.209], Bengaluru:[12.972,77.595], Jaipur:[26.912,75.787]};
type Listing = { name:string; source:string; evidence:string };
export function TerritorySearch() {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [point,setPoint] = useState(cities.Pune);
  const [radius,setRadius] = useState(5000);
  const [industry,setIndustry] = useState("salon");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [items,setItems] = useState<Listing[]>([]);
  const version = useRef(0);
  useEffect(() => {
    const view = L.map(node.current!).setView(cities.Pune,12);
    map.current = view;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(view);
    view.on("click", e => setPoint([e.latlng.lat,e.latlng.lng]));
    return () => { view.remove(); map.current=null; };
  },[]);
  useEffect(() => {
    version.current++; setItems([]); setMessage(""); setBusy(false);
    const view = map.current!;
    const circle = L.circle(point,{radius}).addTo(view);
    view.fitBounds(circle.getBounds());
    return () => { circle.remove(); };
  },[point,radius,industry]);
  async function search() {
    const request = ++version.current;
    setBusy(true); setItems([]); setMessage("");
    try {
      const result = await api.post<{listings:Listing[]}>("/opportunities/territory",{lat:point[0],lng:point[1],radius,industry});
      if(request===version.current){setItems(result.listings); setMessage(`${result.listings.length} public business listings`);}
    } catch(e) { if(request===version.current)setMessage(e instanceof Error ? e.message : "Search failed"); }
    finally { if(request===version.current)setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border p-4"><h2>Find local business partners</h2>
    <p>Select a city or click the map to set your search centre.</p>
    <div className="flex flex-wrap gap-3"><select aria-label="Jump to city" value={Object.keys(cities).find(k=>cities[k]===point) || ""} onChange={e=>setPoint(cities[e.target.value])}><option disabled value="">Map pin</option>{Object.keys(cities).map(k=><option key={k}>{k}</option>)}</select>
    <select aria-label="Search radius" value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[2000,5000,10000].map(r=><option key={r} value={r}>{r/1000} km</option>)}</select>
    <select aria-label="Partner industry" value={industry} onChange={e=>setIndustry(e.target.value)}><option value="salon">Salon & beauty</option><option value="property">Real estate agencies</option></select></div>
    <div ref={node} style={{height:240,zIndex:0}}/>
    <button disabled={busy} onClick={search}>{busy ? "Searching…" : "Search this area"}</button>
    <p role="status">{message}</p>{items.map(item=><p key={item.source}><a href={item.source} target="_blank" rel="noreferrer">{item.name} ↗</a> · {item.evidence}</p>)}
  </section>;
}
