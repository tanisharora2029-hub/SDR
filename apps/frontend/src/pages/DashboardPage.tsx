import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import {
  Users,
  MessageSquare,
  PhoneCall,
  CalendarCheck,
  UserCheck,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  Bot,
  AlertCircle
} from "lucide-react";

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [mRes, lRes, hRes] = await Promise.all([
          api.getAnalytics(),
          api.getLeads(),
          api.getEscalations()
        ]);
        setMetrics(mRes.overview);
        setLeads(lRes.leads);
        setEscalations(hRes.escalations);
      } catch (err) {
        console.error("Error loading dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading pipeline analytics...
      </div>
    );
  }

  const kpis = [
    { label: "Total Leads", value: metrics?.totalLeads || 0, icon: Users, color: "text-blue-400" },
    { label: "Contacted", value: metrics?.contactedCount || 0, icon: MessageSquare, color: "text-indigo-400" },
    { label: "In Conversation", value: metrics?.inConversationCount || 0, icon: Bot, color: "text-violet-400" },
    { label: "Qualified", value: metrics?.qualifiedCount || 0, icon: TrendingUp, color: "text-emerald-400" },
    { label: "Booked Meetings", value: metrics?.appointmentsBooked || 0, icon: CalendarCheck, color: "text-amber-400" },
    { label: "Human Escalations", value: metrics?.humanHandoffsCount || 0, icon: UserCheck, color: "text-rose-400" }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Sales Pipeline Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Autonomous SDR activity across Email, Phone Voice Studio, and WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/leads"
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-sm"
          >
            <span>View All Leads</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Escalation Alert Banner */}
      {escalations.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-300">
                {escalations.length} High-Intent Lead{escalations.length > 1 ? "s" : ""} Requiring Human Handoff
              </p>
              <p className="text-xs text-amber-400/80">
                Enterprise prospects requesting custom contracts, compliance reviews, or executive meetings.
              </p>
            </div>
          </div>
          <Link
            to="/handoff"
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition self-start sm:self-auto shrink-0"
          >
            Review Inbox
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="p-3 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 min-w-0">
              <div className="flex items-center justify-between mb-2 gap-1">
                <span className="text-[11px] sm:text-xs text-slate-400 truncate">{kpi.label}</span>
                <Icon className={`w-4 h-4 shrink-0 ${kpi.color}`} />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-100">{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Pipeline Rates & Channel Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 md:col-span-2">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Pipeline Conversion Velocity</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Response Rate</span>
                <span className="font-semibold text-indigo-400">{metrics?.responseRatePct || 0}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, metrics?.responseRatePct || 0)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Qualification Rate</span>
                <span className="font-semibold text-emerald-400">{metrics?.qualificationRatePct || 0}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, metrics?.qualificationRatePct || 0)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Outreach Activity by Channel</h2>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                Emails Sent
              </span>
              <span className="font-bold text-slate-200">{metrics?.emailsSent || 0}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-2">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                Phone Calls Placed
              </span>
              <span className="font-bold text-slate-200">{metrics?.callsPlaced || 0}</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                Active Cadence Tasks
              </span>
              <span className="font-bold text-slate-200">{metrics?.activeFollowups || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Lead Activity Table */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Active Leads & Opportunities</h2>
          <Link to="/leads" className="text-xs text-indigo-400 hover:underline">
            View All ({leads.length})
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-medium">Contact</th>
                <th className="pb-3 font-medium">Company</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Intent Score</th>
                <th className="pb-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {leads.slice(0, 5).map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3">
                    <p className="font-semibold text-slate-200">
                      {lead.firstName} {lead.lastName}
                    </p>
                    <p className="text-[11px] text-slate-400">{lead.email}</p>
                  </td>
                  <td className="py-3 text-slate-300">{lead.companyName}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        lead.status === "QUALIFIED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : lead.status === "HANDOFF_REQUIRED"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          : lead.status === "IN_CONVERSATION"
                          ? "bg-violet-500/10 text-violet-400 border border-violet-500/30"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {lead.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-800 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full"
                          style={{ width: `${lead.intentScore}%` }}
                        ></div>
                      </div>
                      <span className="text-[11px] text-slate-400">{lead.intentScore}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      to={`/leads/${lead.id}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      Open Dossier →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};