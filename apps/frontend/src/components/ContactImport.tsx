import { useState } from "react";
import { api } from "../api/client.js";

const fields = ["firstName", "lastName", "email", "phone", "companyName", "location", "jobTitle"] as const;
const labels = ["First name", "Last name", "Email", "Phone", "Company", "Location", "Job title"];
const aliases = [["name","firstname","fullname"],["lastname","surname"],["email","emailaddress"],["mobile","phone","phonenumber"],["company","companyname","business"],["location","city"],["jobtitle","role"]];

export function ContactImport({ done }: { done: (message: string) => void }) {
  const [rows, setRows] = useState<string[][]>([]);
  const [columns, setColumns] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function read(file: File) {
    setRows([]); setError(""); setBusy(true);
    try {
      if (file.size > 2_000_000) throw Error("Choose a file smaller than 2 MB.");
      const data = /\.xlsx$/i.test(file.name)
        ? await (await import("read-excel-file/browser")).readSheet(file)
        : (await import("csv-parse/browser/esm/sync")).parse(await file.text(), { bom: true, skip_empty_lines: true });
      const cells: string[][] = data.map((row: unknown[]) => row.map(v => String(v ?? "").trim()));
      if (cells.length < 2 || cells.length > 501) throw Error("Include a header and 1–500 contacts per upload.");
      setColumns(aliases.map(names => cells[0].findIndex(v => names.includes(v.toLowerCase().replace(/[^a-z]/g,"")))));
      setRows(cells);
    } catch (e) { setError(e instanceof Error ? e.message : "Cannot read file."); }
    finally { setBusy(false); }
  }
  const contacts = rows.slice(1).map(row => Object.fromEntries(fields.map((key,i) => [key,row[columns[i]] || ""])));
  const valid = contacts.filter(c => c.firstName && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email));
  return <div className="space-y-2">
    <p>Choose an Excel workbook (first sheet) or CSV. First name and email are required.</p>
    <input aria-label="Contact file" type="file" accept=".xlsx,.csv" disabled={busy} onChange={e => e.target.files?.[0] && void read(e.target.files[0])}/>
    {rows.length > 0 && <><div className="grid grid-cols-2 gap-2">{fields.map((key,i) => <label key={key}>{labels[i]}<select className="block w-full bg-slate-900" value={columns[i]} disabled={busy} onChange={e => setColumns(columns.map((v,j) => i === j ? Number(e.target.value) : v))}><option value={-1}>Skip column</option>{rows[0].map((h,j) => <option key={j} value={j}>{h || "Unnamed column"}</option>)}</select></label>)}</div>
    <p>{valid.length} valid · {contacts.length-valid.length} incomplete or invalid</p>
    {valid.slice(0,3).map((c,i) => <p key={i}>{c.firstName} · {c.email}</p>)}
    <button disabled={busy || !valid.length} onClick={async () => {
      setBusy(true); setError("");
      try { const result = await api.importLeadsCsv(valid); done(`Added ${result.imported} contacts. Skipped ${result.skipped} duplicates.`); }
      catch (e) { setError(e instanceof Error ? e.message : "Import failed."); }
      finally { setBusy(false); }
    }}>{busy ? "Importing…" : "Import valid contacts"}</button></>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
