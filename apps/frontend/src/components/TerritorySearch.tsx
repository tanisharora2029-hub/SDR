import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api/client.js";

import states from "../data/india-cities.json";

const defaultState = states.find(state => state.name === "Maharashtra")!;
const defaultCity = defaultState.cities.find(city => city.name === "Pune")!;
const defaultPoint: [number, number] = [defaultCity.lat, defaultCity.lng];
type Listing = { name:string; source:string; evidence:string };
export function TerritorySearch() {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [point,setPoint] = useState<[number, number] | null>(defaultPoint);
  const [stateName, setStateName] = useState(defaultState.name);
  const [cityId, setCityId] = useState(String(defaultCity.id));
  const selectedState = states.find(state => state.name === stateName);
  const [radius,setRadius] = useState(5000);
  const [industry,setIndustry] = useState("salon");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [items,setItems] = useState<Listing[]>([]);
  const version = useRef(0);
  useEffect(() => {
    const view = L.map(node.current!).setView(defaultPoint,12);
    map.current = view;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(view);
    view.on("click", e => {
      setStateName("");
      setCityId("");
      setPoint([e.latlng.lat,e.latlng.lng]);
    });
    return () => { view.remove(); map.current=null; };
  },[]);
  useEffect(() => {
    version.current++; setItems([]); setMessage(""); setBusy(false);
    if (!point) return;
    const view = map.current!;
    const circle = L.circle(point,{radius}).addTo(view);
    view.fitBounds(circle.getBounds());
    return () => { circle.remove(); };
  },[point,radius,industry]);
  async function search() {
    if (!point) return;
    const request = ++version.current;
    setBusy(true); setItems([]); setMessage("");
    try {
      const result = await api.post<{listings:Listing[]}>("/opportunities/territory",{lat:point[0],lng:point[1],radius,industry});
      if(request===version.current){setItems(result.listings); setMessage(`${result.listings.length} public business listings`);}
    } catch(e) { if(request===version.current)setMessage(e instanceof Error ? e.message : "Search failed"); }
    finally { if(request===version.current)setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border p-4"><h2>Find local business partners</h2>
    <p>Choose a state and city to centre your search. You can also click the map to set a precise location.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid min-w-0 gap-1 text-sm font-medium">State or union territory
        <select className="w-full rounded-lg border p-2" value={stateName} onChange={e => {
          setStateName(e.target.value);
          setCityId("");
          setPoint(null);
        }}>
          <option value="" disabled>Select a state</option>
          {states.map(state => <option key={state.name}>{state.name}</option>)}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-sm font-medium">City or town
        <select className="w-full rounded-lg border p-2" value={cityId} disabled={!selectedState} onChange={e => {
          const city = selectedState?.cities.find(entry => String(entry.id) === e.target.value);
          if (!city) return;
          setCityId(String(city.id));
          setPoint([city.lat, city.lng]);
        }}>
          <option value="" disabled>{stateName ? "Select a city" : "Select a state first"}</option>
          {selectedState?.cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>
      </label>
    </div>
    <div className="flex flex-wrap gap-3">
    <select aria-label="Search radius" value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[2000,5000,10000].map(r=><option key={r} value={r}>{r/1000} km</option>)}</select>
    <select aria-label="Partner industry" value={industry} onChange={e=>setIndustry(e.target.value)}><option value="salon">Salon & beauty</option><option value="property">Real estate agencies</option></select></div>
    <div ref={node} style={{height:240,zIndex:0}}/>
    <p className="text-xs text-slate-500">Cities from <a className="underline" href="https://github.com/dr5hn/countries-states-cities-database">Countries States Cities Database</a> · <a className="underline" href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a> · <a className="underline" href="https://www.geonames.org/">GeoNames</a>{point && !stateName && " · Using map pin"}</p>
    <button disabled={busy || !point} onClick={search}>{busy ? "Searching…" : "Search this area"}</button>
    <p role="status">{message}</p>{items.map(item=><p key={item.source}><a href={item.source} target="_blank" rel="noreferrer">{item.name} ↗</a> · {item.evidence}</p>)}
  </section>;
}
