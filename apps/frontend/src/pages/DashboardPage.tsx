import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { OnboardingModal } from "../components/OnboardingModal.js";
import { useAuth } from "../context/AuthContext.js";
import { AlertCircle, Compass, FlaskConical, Calendar, ChevronRight, Radar, Users, MessageSquare, PhoneCall, Settings, ShieldCheck, Brain } from "lucide-react";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [mRes, lRes, hRes, inbox] = await Promise.all([
          api.getAnalytics(),
          api.getLeads(),
          api.getEscalations(),
          api.getConversations()
        ]);
        setConversations(inbox.conversations || []);
        setMetrics(mRes.overview);
        setLeads(lRes.leads);
        setEscalations(hRes.escalations);
      } catch (err) {
        setLoadError(true);
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
        <p>Loading your workspace...</p>
      </div>
    );
  }

  const firstName = user?.name ? user.name.split(" ")[0] : "there";
  const currentDateFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0 pb-12">
      {/* Onboarding Tour Modal */}
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />

      {/* Header matching reference: "Good evening, Tanish 👋" + Live date badge */}
      <div className="workspace-welcome flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Welcome, {firstName}</span>
            <span className="text-xl">👋</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Find customers. Start conversations. Grow your business.
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

      <section aria-label="Your tools" className="workspace-tools">
        {[
          {to:"/opportunities", title:"Find new leads", text:"Discover related businesses and websites", icon:Radar, color:"lilac", step:"01 / DISCOVER"},
          {to:"/leads", title:"Your contacts", text:"Import a spreadsheet or manage saved leads", icon:Users, color:"indigo", step:"02 / ORGANISE"},
          {to:"/conversations", title:"Your inbox", text:"Read replies and continue conversations", icon:MessageSquare, color:"pink", step:"03 / CONNECT"},
          {to:"/phone-studio", title:"Try your voice agent", text:"Practise a browser call with your AI", icon:PhoneCall, color:"purple", step:"04 / PRACTISE"}
        ].map(tool => <Link className={'workspace-tool '+tool.color} to={tool.to} key={tool.to}><div className="tool-art"><span>{tool.step}</span><tool.icon size={42}/><span className="tool-decoration" aria-hidden="true"/></div><div className="tool-caption"><h2>{tool.title}</h2><p>{tool.text}</p><ChevronRight size={18}/></div></Link>)}
      </section>
      <nav aria-label="More tools" className="workspace-shortcuts">{[["/follow-ups","Follow-ups"],["/tasks","Appointments"],["/handoff","Human handoff"],["/analytics","Analytics"],["/lead-simulator","Lead simulator"],["/billing","Billing"]].map(([to,label]) => <Link key={to} to={to}>{label}<ChevronRight size={14}/></Link>)}</nav>
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

      {loadError && <p role="alert">Workspace data could not be loaded. Refresh to try again.</p>}
      <section aria-label="Workspace overview" className="atlas-metrics">
        {[
          ["Leads contacted", metrics?.contactedCount, "/leads"],
          ["In conversation", metrics?.inConversationCount, "/conversations"],
          ["Appointments", metrics?.appointmentsBooked, "/tasks"],
          ["Response rate", metrics ? metrics.responseRatePct + "%" : null, "/analytics"]
        ].map(([label, value, path]) => <Link key={label} to={path}><span>{label}</span><strong>{value ?? "—"}</strong></Link>)}
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="atlas-sheet">
          <h2>Today's actions</h2>
          <Link to="/opportunities">Discover opportunities <ChevronRight size={16} /></Link>
          <Link to="/follow-ups">Scheduled follow-ups <strong>{metrics?.activeFollowups ?? "—"}</strong></Link>
          <Link to="/handoff">Review handoffs <strong>{metrics?.humanHandoffsCount ?? "—"}</strong></Link>
          <Link to="/conversations">Open inbox <ChevronRight size={16} /></Link>
        </section>
        <section className="atlas-sheet">
          <h2>Recent activity</h2>
          {metrics?.recentActivities?.slice(0,4).map((item: {id:string;action:string;createdAt:string}) => (
            <div key={item.id} className="atlas-row"><span>{item.action.toLowerCase().replace(/_/g, " ")}</span><time>{new Date(item.createdAt).toLocaleDateString()}</time></div>
          ))}
          {metrics && !metrics.recentActivities?.length && <p>Workspace activity will appear here.</p>}
          <Link to="/analytics">View analytics <ChevronRight size={16} /></Link>
        </section>
      </div>
      <section className="atlas-sheet">
        <h2>Recent conversations</h2>
        {conversations.slice(0,3).map(thread => <Link key={thread.id} to={thread.leadId ? `/leads/${thread.leadId}` : "/conversations"}>
          <span>{thread.lead?.firstName} {thread.lead?.lastName}</span>
          <span className="truncate">{thread.messages?.[0]?.content || thread.subject || thread.channel}</span>
        </Link>)}
        {!loadError && !conversations.length && <p>No conversations yet.</p>}
        <Link to="/conversations">View inbox <ChevronRight size={16} /></Link>
      </section>
      <section className="atlas-sheet">
        <h2>Recent leads</h2>
        {leads.slice(0,5).map(lead => <Link key={lead.id} to={`/leads/${lead.id}`}><span>{lead.firstName} {lead.lastName}</span><span>{lead.companyName}</span><ChevronRight size={16} /></Link>)}
        {!loadError && !leads.length && <p>Your saved leads will appear here.</p>}
        <Link to="/leads">View leads <ChevronRight size={16} /></Link>
      </section>
      <section aria-label="Workspace management" className="workspace-management">
        <Link to="/sdr-setup"><Brain/><span><strong>Set up your agent</strong><small>Business details and knowledge</small></span><ChevronRight size={18}/></Link>
        <Link to="/settings"><Settings/><span><strong>Settings</strong><small>Manage your workspace</small></span><ChevronRight size={18}/></Link>
        <Link to="/admin"><ShieldCheck/><span><strong>Admin</strong><small>View system information</small></span><ChevronRight size={18}/></Link>
      </section>
    </div>
  );
};
