import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { Repeat, Clock, CheckCircle2, Play, Plus, ArrowRight, ShieldCheck } from "lucide-react";

export const FollowUpsPage: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  const loadData = async () => {
    try {
      const [rRes, tRes] = await Promise.all([api.getFollowUpRules(), api.getPendingTasks()]);
      setRules(rRes.rules);
      setTasks(tRes.tasks);
    } catch (err) {
      console.error("Failed to load followups:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunPending = async () => {
    setExecuting(true);
    try {
      const res = await api.runPendingTasks();
      alert(`Cadence executed: ${res.executedCount} follow-up task(s) processed!`);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to run tasks");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Repeat className="w-6 h-6 text-indigo-400 shrink-0" />
            <span>Follow-up Cadence Engine</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated multi-touch outreach cadences. Respects lead replies and stops instantly upon opt-out.
          </p>
        </div>

        <button
          onClick={handleRunPending}
          disabled={executing}
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm self-start sm:self-auto shrink-0"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{executing ? "Processing Cadences..." : "Run Due Tasks Now"}</span>
        </button>
      </div>

      {/* Cadence Steps Visualization */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Configured Outbound Sequence</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {rules.map((rule, idx) => (
            <div
              key={rule.id}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    Step {rule.stepNumber}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {rule.channel}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  {rule.condition === "INITIAL_OUTREACH" ? "Cold Introduction" : `Follow-up ${rule.stepNumber - 1}`}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Delay: <span className="text-slate-200 font-medium">{rule.delayDays} day(s)</span> after prior touch
                </p>
              </div>

              {idx < rules.length - 1 && (
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-600">
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pending Follow-up Queue */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Pending Scheduled Touches ({tasks.length})</h2>
          <span className="text-xs text-slate-400">Idempotent background execution</span>
        </div>

        {tasks.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No pending follow-up tasks currently queued.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-medium">Lead Name</th>
                  <th className="pb-3 font-medium">Company</th>
                  <th className="pb-3 font-medium">Step</th>
                  <th className="pb-3 font-medium">Channel</th>
                  <th className="pb-3 font-medium">Scheduled For</th>
                  <th className="pb-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 font-semibold text-slate-200">
                      {task.lead?.firstName} {task.lead?.lastName}
                    </td>
                    <td className="py-3 text-slate-300">{task.lead?.companyName}</td>
                    <td className="py-3 text-indigo-400 font-medium">Step {task.stepNumber}</td>
                    <td className="py-3 text-slate-300">{task.channel}</td>
                    <td className="py-3 text-slate-400">
                      {new Date(task.scheduledFor).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {task.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};