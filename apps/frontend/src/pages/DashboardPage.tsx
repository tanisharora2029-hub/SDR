import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { OnboardingModal } from "../components/OnboardingModal.js";
import { AIStatusRing } from "../components/ui/AIStatusRing.js";
import { useAuth } from "../context/AuthContext.js";
import {
  Users,
  MessageSquare,
  PhoneCall,
  CalendarCheck,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  AlertCircle,
  Clock,
  Compass,
  FlaskConical,
  Activity,
  Calendar,
  ChevronRight,
  ArrowUp,
  ArrowRight
} from "lucide-react";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

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
      <div className="flex flex-col items-center justify-center h-80 text-slate-400 text-xs space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
        <p>Connecting to AI Sales Command Center...</p>
      </div>
    );
  }

  const firstName = user?.name ? user.name.split(" ")[0] : "Tanish";
  const currentDateFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  const totalLeads = metrics?.totalLeads ?? 248;
  const contactedCount = metrics?.contactedCount ?? 86;
  const bookedMeetings = metrics?.appointmentsBooked ?? 12;
  const replyRate = metrics?.responseRatePct ?? 34;

  // 7-day activity mock data for visual chart matching reference
  const chartDays = [
    { day: "6 Sep", emails: 80, calls: 40, sms: 25, replies: 18, totalHeight: 45 },
    { day: "7 Sep", emails: 95, calls: 45, sms: 30, replies: 22, totalHeight: 55 },
    { day: "8 Sep", emails: 140, calls: 60, sms: 45, replies: 35, totalHeight: 75 },
    { day: "9 Sep", emails: 185, calls: 80, sms: 55, replies: 48, totalHeight: 95 },
    { day: "10 Sep", emails: 130, calls: 50, sms: 35, replies: 28, totalHeight: 70 },
    { day: "11 Sep", emails: 160, calls: 70, sms: 40, replies: 38, totalHeight: 85 },
    { day: "12 Sep", emails: 200, calls: 90, sms: 60, replies: 52, totalHeight: 100 }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0 pb-12">
      {/* Onboarding Tour Modal */}
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />

      {/* Header matching reference: "Good evening, Tanish 👋" + Live date badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Good evening, {firstName}</span>
            <span className="text-xl">👋</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Here's what your AI SDR accomplished today:
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOnboarding(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 text-xs font-medium transition"
          >
            <Compass className="w-3.5 h-3.5 text-violet-400" />
            <span>Tour</span>
          </button>

          <Link
            to="/lead-simulator"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-xs font-medium transition"
          >
            <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
            <span>Simulator ↗</span>
          </Link>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0e0e1a]/80 border border-white/[0.08] text-xs font-medium text-slate-300 shadow-sm">
            <span>{currentDateFormatted}</span>
            <Calendar className="w-3.5 h-3.5 text-violet-400" />
          </div>
        </div>
      </div>

      {/* Escalation Alert Banner if enterprise handoff pending */}
      {escalations.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/20">
          <div className="flex items-center gap-3 min-w-0">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-300">
                {escalations.length} High-Intent Lead{escalations.length > 1 ? "s" : ""} Requiring Human Handoff
              </p>
              <p className="text-[11px] text-amber-400/80">
                Enterprise prospects requesting custom contracts, compliance reviews, or executive calls.
              </p>
            </div>
          </div>
          <Link
            to="/handoff"
            className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition self-start sm:self-auto shrink-0 shadow-sm"
          >
            Review Inbox
          </Link>
        </div>
      )}

      {/* 4 Top Metric Cards matching reference image */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Leads Contacted */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-xl shadow-black/30 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Leads Contacted</span>
            <div className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-400">
              <ArrowUp className="w-3 h-3" />
              <span>12%</span>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-3 tracking-tight">
            {totalLeads}
          </p>
        </div>

        {/* Metric 2: Conversations */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-xl shadow-black/30 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Conversations</span>
            <div className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-400">
              <ArrowUp className="w-3 h-3" />
              <span>24%</span>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-3 tracking-tight">
            {contactedCount}
          </p>
        </div>

        {/* Metric 3: Meetings Booked */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-xl shadow-black/30 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Meetings Booked</span>
            <div className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-400">
              <ArrowUp className="w-3 h-3" />
              <span>33%</span>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-3 tracking-tight">
            {bookedMeetings}
          </p>
        </div>

        {/* Metric 4: Reply Rate */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-xl shadow-black/30 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Reply Rate</span>
            <div className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-400">
              <ArrowUp className="w-3 h-3" />
              <span>6%</span>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-3 tracking-tight">
            {replyRate}%
          </p>
        </div>
      </div>

      {/* Middle Row: Pipeline Activity Chart (2/3) + AI SDR Active Ring (1/3) matching reference */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Pipeline Activity Glowing Bar Chart (8 cols) */}
        <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/40 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Pipeline Activity</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Autonomous lead touches across active outreach channels</p>
            </div>

            {/* Legend matching reference */}
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_6px_#a855f7]" />
                <span className="text-slate-400">Emails</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]" />
                <span className="text-slate-400">Calls</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
                <span className="text-slate-400">SMS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_6px_#e879f9]" />
                <span className="text-slate-400">Replies</span>
              </div>
            </div>
          </div>

          {/* Bar Chart Canvas / SVG Container */}
          <div className="mt-6 flex items-end justify-between h-48 sm:h-56 px-2 sm:px-4 relative">
            {/* Background Grid Lines with Scale */}
            <div className="absolute inset-x-0 top-0 flex justify-between text-[10px] text-slate-600 border-b border-white/[0.04] pb-1">
              <span>200</span>
            </div>
            <div className="absolute inset-x-0 top-1/4 flex justify-between text-[10px] text-slate-600 border-b border-white/[0.04] pb-1">
              <span>150</span>
            </div>
            <div className="absolute inset-x-0 top-2/4 flex justify-between text-[10px] text-slate-600 border-b border-white/[0.04] pb-1">
              <span>100</span>
            </div>
            <div className="absolute inset-x-0 top-3/4 flex justify-between text-[10px] text-slate-600 border-b border-white/[0.04] pb-1">
              <span>50</span>
            </div>

            {/* Glowing Gradient Bars */}
            {chartDays.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 z-10 w-8 sm:w-10 group cursor-pointer">
                {/* Bar */}
                <div className="w-3 sm:w-4 bg-white/[0.05] rounded-full h-40 flex items-end p-0.5 relative">
                  <div
                    className="w-full rounded-full bg-gradient-to-t from-indigo-700 via-violet-600 to-fuchsia-400 group-hover:brightness-125 transition-all duration-300 shadow-[0_0_12px_rgba(147,51,234,0.4)]"
                    style={{ height: `${item.totalHeight}%` }}
                  >
                    {/* Glowing Cap */}
                    <div className="w-full h-2 rounded-full bg-white/60 blur-[1px]" />
                  </div>
                </div>
                {/* Day Label */}
                <span className="text-[10px] text-slate-400 group-hover:text-white transition">
                  {item.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI SDR Active Widget (4 cols) matching reference */}
        <div className="lg:col-span-4 p-5 sm:p-6 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/40 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="w-full flex items-center justify-between pb-2 border-b border-white/[0.06] mb-2">
            <span className="text-xs font-bold text-white">System Status</span>
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>

          <AIStatusRing size={210} className="my-auto py-2" />
        </div>
      </div>

      {/* Bottom Section: Recent Conversations Table matching reference image */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-4">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Recent Conversations</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Real-time prospect interactions across channels</p>
          </div>
          <Link
            to="/conversations"
            className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition flex items-center gap-1"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {leads.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p>No active conversations yet.</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Launch outreach or use the Lead Simulator to generate live messages.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04] overflow-x-auto">
            {leads.slice(0, 5).map((lead, idx) => {
              const channelNames = ["Email", "LinkedIn", "Phone", "Email", "SMS"];
              const channel = channelNames[idx % channelNames.length];
              const times = ["2 min ago", "12 min ago", "1 hour ago", "3 hours ago", "Yesterday"];
              const time = times[idx % times.length];
              const initials = (lead.firstName?.[0] || "L") + (lead.lastName?.[0] || "D");

              const channelColors: Record<string, string> = {
                Email: "bg-violet-500/15 text-violet-300 border-violet-500/25",
                LinkedIn: "bg-blue-500/15 text-blue-300 border-blue-500/25",
                Phone: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
                SMS: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25"
              };

              return (
                <div
                  key={lead.id}
                  className="py-3.5 px-2 hover:bg-white/[0.02] rounded-xl transition flex items-center justify-between gap-4 text-xs"
                >
                  {/* Avatar & Contact */}
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-700 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-inner">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">
                        {lead.firstName} {lead.lastName}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {lead.jobTitle || "Executive"} · {lead.companyName}
                      </p>
                    </div>
                  </div>

                  {/* Message Snippet */}
                  <div className="hidden md:block flex-1 min-w-0 pr-4">
                    <p className="text-slate-300 text-[11px] truncate">
                      {lead.status === "QUALIFIED"
                        ? "We have budget approved and would like to review the technical architecture."
                        : lead.status === "OPTED_OUT" || lead.isOptedOut
                        ? "Please remove our address from your outreach list."
                        : "Hi Tanish, we currently process around 10,000 invoices every month manually..."}
                    </p>
                  </div>

                  {/* Timestamp & Channel Pill matching reference */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-slate-500 hidden sm:inline">{time}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        channelColors[channel] || channelColors.Email
                      }`}
                    >
                      {channel}
                    </span>
                    <Link
                      to={`/leads/${lead.id}`}
                      className="text-slate-400 hover:text-white transition p-1"
                      title="View Lead Dossier"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
