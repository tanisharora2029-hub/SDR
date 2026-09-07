import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { Settings, Save, ShieldCheck, Key, Globe, CheckCircle2 } from "lucide-react";

export const SettingsPage: React.FC = () => {
  const [org, setOrg] = useState<any>(null);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [targetIcp, setTargetIcp] = useState("");
  const [valueProp, setValueProp] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getOrg();
        setOrg(res.organization);
        setName(res.organization.name || "");
        setIndustry(res.organization.industry || "");
        setWebsite(res.organization.website || "");
        setTargetIcp(res.organization.targetCustomerIcp || "");
        setValueProp(res.organization.valueProposition || "");
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.updateOrg({
        name,
        industry,
        website,
        targetCustomerIcp: targetIcp,
        valueProposition: valueProp
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-400" />
            <span>Organization & Integration Settings</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure company domain, target ICP definitions, and webhook integrations.
          </p>
        </div>

        {saved && (
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Settings updated!
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
          Company Profile & ICP
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-300 font-medium block mb-1">Company Legal Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1">Industry / Vertical</label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
            />
          </div>
        </div>

        <div className="text-xs">
          <label className="text-slate-300 font-medium block mb-1">Company Website</label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
            placeholder="https://company.com"
          />
        </div>

        <div className="text-xs">
          <label className="text-slate-300 font-medium block mb-1">Core Value Proposition</label>
          <textarea
            rows={3}
            value={valueProp}
            onChange={(e) => setValueProp(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed"
          />
        </div>

        <div className="text-xs">
          <label className="text-slate-300 font-medium block mb-1">Target Customer Persona (ICP)</label>
          <textarea
            rows={3}
            value={targetIcp}
            onChange={(e) => setTargetIcp(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 leading-relaxed"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
};