import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { BarChart3, TrendingUp, Users, MessageSquare, PhoneCall, CalendarCheck, Sparkles } from "lucide-react";

export const AnalyticsPage: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getAnalytics();
        setMetrics(res.overview);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading metrics...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-400" />
          <span>Pipeline Analytics & Conversion Funnel</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Detailed metrics tracking autonomous sales velocity, channel performance, and ROI.
        </p>
      </div>

      {/* Top Conversion Funnel Bar */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
          Sales Conversion Funnel
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 block mb-1">1. Total Ingested</span>
            <p className="text-2xl font-bold text-slate-100">{metrics?.totalLeads || 0}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 block mb-1">2. Contacted</span>
            <p className="text-2xl font-bold text-indigo-400">{metrics?.contactedCount || 0}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 block mb-1">3. In Conversation</span>
            <p className="text-2xl font-bold text-violet-400">{metrics?.inConversationCount || 0}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 block mb-1">4. Qualified Leads</span>
            <p className="text-2xl font-bold text-emerald-400">{metrics?.qualifiedCount || 0}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 block mb-1">5. Booked Demos</span>
            <p className="text-2xl font-bold text-amber-400">{metrics?.appointmentsBooked || 0}</p>
          </div>
        </div>
      </div>

      {/* Channel Performance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-200">Email Channel</h3>
          </div>
          <p className="text-3xl font-extrabold text-slate-100">{metrics?.emailsSent || 0}</p>
          <p className="text-xs text-slate-400 mt-1">Outbound personalized emails delivered</p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <PhoneCall className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">Phone Voice Channel</h3>
          </div>
          <p className="text-3xl font-extrabold text-slate-100">{metrics?.callsPlaced || 0}</p>
          <p className="text-xs text-slate-400 mt-1">Interactive voice calls placed & transcribed</p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-semibold text-slate-200">Cadence Touches</h3>
          </div>
          <p className="text-3xl font-extrabold text-slate-100">{metrics?.activeFollowups || 0}</p>
          <p className="text-xs text-slate-400 mt-1">Active scheduled automated steps</p>
        </div>
      </div>
    </div>
  );
};