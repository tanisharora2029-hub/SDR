import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { UserCheck, AlertCircle, ArrowRight, CheckCircle2, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";

export const HandoffInboxPage: React.FC = () => {
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEscalations = async () => {
    try {
      const res = await api.getEscalations();
      setEscalations(res.escalations);
    } catch (err) {
      console.error("Failed to load escalations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEscalations();
  }, []);

  const handleResolve = async (leadId: string, resolution: string) => {
    try {
      await api.resolveEscalation(leadId, resolution);
      await loadEscalations();
    } catch (err: any) {
      alert(err.message || "Failed to resolve escalation");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-rose-400" />
          <span>Human Escalation & Handoff Inbox</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          High-intent enterprise accounts requiring human Account Executive engagement, custom compliance, or legal reviews.
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading escalations...</div>
      ) : escalations.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="font-semibold text-slate-200 text-sm">Inbox Zero!</p>
          <p className="text-xs mt-1">No leads currently require human intervention. Your AI SDR is handling all active conversations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {escalations.map((lead) => {
            const conv = lead.conversations?.find((c: any) => c.isEscalated);
            const bant = lead.bantScorecard ? JSON.parse(lead.bantScorecard) : null;

            return (
              <div
                key={lead.id}
                className="p-6 rounded-2xl bg-slate-900 border border-amber-500/40 shadow-xl space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold text-[10px] uppercase border border-rose-500/30">
                        Priority Escalation
                      </span>
                      <h3 className="text-base font-bold text-slate-100">
                        {lead.firstName} {lead.lastName}
                      </h3>
                      <span className="text-xs text-slate-400 font-medium">({lead.companyName})</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {lead.jobTitle || "Executive"} • {lead.email} • Intent Score: <span className="text-indigo-400 font-bold">{lead.intentScore}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResolve(lead.id, "CONVERTED")}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                    >
                      Convert / Opportunity Won
                    </button>
                    <button
                      onClick={() => handleResolve(lead.id, "RETURN_TO_AI")}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Return to AI</span>
                    </button>
                    <Link
                      to={`/leads/${lead.id}`}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                    >
                      View Dossier →
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <p className="font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      <span>Escalation Rationale:</span>
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      {conv?.escalationReason || "Custom contract, security compliance, or high deal volume."}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <p className="font-semibold text-indigo-400 mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Recommended Human Action:</span>
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      Review custom Master Service Agreement requirements and schedule an Account Executive discovery call.
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};