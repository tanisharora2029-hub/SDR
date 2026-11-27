import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { OnboardingModal } from "../components/OnboardingModal.js";
import { useAuth } from "../context/AuthContext.js";
import { AlertCircle, Compass, FlaskConical, Calendar, ChevronRight, Settings, ShieldCheck, Brain } from "lucide-react";

const TOOL_ART: Record<string, React.ReactNode> = {
  terracotta: (
    <svg className="art-3d" viewBox="0 0 120 110" fill="none" aria-hidden="true">
      <g transform="translate(8,14)">
        <path d="M52 20L100 44L52 68L4 44Z" fill="#FFFDF9" stroke="#E7D8CD" strokeWidth="2" />
        <path d="M4 44L52 68V76L4 52Z" fill="#E6D5C8" />
        <path d="M100 44L52 68V76L100 52Z" fill="#D5C0B0" />
        <path d="M26 33L74 57M28 55L76 31" stroke="#E7D7CB" strokeWidth="3" strokeLinecap="round" />
        <g transform="translate(42,4)">
          <ellipse cx="10" cy="36" rx="8" ry="3.5" fill="rgba(154,52,18,0.22)" />
          <path d="M10 34C10 34 20 22 20 14C20 8.5 15.5 4 10 4C4.5 4 0 8.5 0 14C0 22 10 34 10 34Z" fill="url(#nexPinGrad)" />
          <circle cx="10" cy="14" r="3.8" fill="#FFF7ED" />
        </g>
        <g transform="translate(68,18) scale(0.78)">
          <ellipse cx="10" cy="36" rx="8" ry="3.5" fill="rgba(154,52,18,0.22)" />
          <path d="M10 34C10 34 20 22 20 14C20 8.5 15.5 4 10 4C4.5 4 0 8.5 0 14C0 22 10 34 10 34Z" fill="url(#nexPinGrad)" />
          <circle cx="10" cy="14" r="3.8" fill="#FFF7ED" />
        </g>
        <g transform="translate(20,18) scale(0.72)">
          <ellipse cx="10" cy="36" rx="8" ry="3.5" fill="rgba(154,52,18,0.22)" />
          <path d="M10 34C10 34 20 22 20 14C20 8.5 15.5 4 10 4C4.5 4 0 8.5 0 14C0 22 10 34 10 34Z" fill="url(#nexPinGrad)" />
          <circle cx="10" cy="14" r="3.8" fill="#FFF7ED" />
        </g>
      </g>
      <defs>
        <linearGradient id="nexPinGrad" x1="0" y1="0" x2="20" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F97316" />
          <stop offset="1" stopColor="#C2410C" />
        </linearGradient>
      </defs>
    </svg>
  ),
  obsidian: (
    <svg className="art-3d" viewBox="0 0 120 110" fill="none" aria-hidden="true">
      <g transform="translate(10,12)">
        <rect x="14" y="28" width="76" height="48" rx="11" transform="rotate(9 52 52)" fill="rgba(255,255,255,0.22)" />
        <rect x="10" y="20" width="76" height="48" rx="11" transform="rotate(4 48 44)" fill="rgba(255,255,255,0.45)" />
        <rect x="6" y="12" width="78" height="50" rx="11" transform="rotate(-4 45 37)" fill="#FFFDF9" />
        <circle cx="24" cy="34" r="10" fill="#E7D5B8" />
        <circle cx="24" cy="31" r="4" fill="#52525B" />
        <path d="M17 41c1.8-3.5 12.2-3.5 14 0" fill="#52525B" />
        <rect x="40" y="27" width="32" height="5" rx="2.5" fill="#27272A" />
        <rect x="40" y="36" width="22" height="4" rx="2" fill="#A1A1AA" />
        <rect x="40" y="44" width="28" height="3.5" rx="1.75" fill="#D4D4D8" />
      </g>
    </svg>
  ),
  marigold: (
    <svg className="art-3d" viewBox="0 0 120 110" fill="none" aria-hidden="true">
      <g transform="translate(8,8)">
        <rect x="34" y="42" width="60" height="38" rx="14" fill="url(#nexBub2)" />
        <path d="M78 76L90 88L84 72Z" fill="#C2410C" />
        <rect x="10" y="12" width="64" height="40" rx="14" fill="url(#nexBub1)" />
        <path d="M24 48L14 60L32 50Z" fill="#EA580C" />
        <rect x="24" y="25" width="34" height="5" rx="2.5" fill="rgba(255,255,255,0.72)" />
        <rect x="24" y="34" width="22" height="4.5" rx="2.25" fill="rgba(255,255,255,0.48)" />
      </g>
      <defs>
        <linearGradient id="nexBub1" x1="10" y1="12" x2="74" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDBA74" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id="nexBub2" x1="34" y1="42" x2="94" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FB7185" />
          <stop offset="1" stopColor="#BE123C" />
        </linearGradient>
      </defs>
    </svg>
  ),
  cobalt: (
    <svg className="art-3d" viewBox="0 0 120 110" fill="none" aria-hidden="true">
      <g transform="translate(10,6)">
        <circle cx="50" cy="48" r="40" stroke="rgba(255,255,255,0.22)" strokeWidth="4" />
        <circle cx="50" cy="48" r="28" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
        <rect x="42" y="28" width="16" height="28" rx="8" fill="#FFFFFF" />
        <path d="M35 48c0 8.3 6.7 15 15 15s15-6.7 15-15" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="50" y1="63" x2="50" y2="71" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="42" y1="71" x2="58" y2="71" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  )
};

function handleCardTilt(e: React.MouseEvent<HTMLAnchorElement>) {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.transform = `rotateY(${(x * 8).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg) translateY(-4px)`;
}

function resetCardTilt(e: React.MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.style.transform = "";
}

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

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowOnboarding(true)}
            className="tactile-pill hidden sm:inline-flex"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Tour</span>
          </button>

          <Link
            to="/lead-simulator"
            className="tactile-pill tactile-pill-sky hidden sm:inline-flex"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Simulator ↗</span>
          </Link>

          <div className="tactile-pill cursor-default">
            <span>{currentDateFormatted}</span>
            <Calendar className="w-3.5 h-3.5" />
          </div>

          <Link
            to="/phone-studio"
            className="live-orb"
            title="Launch AI Voice Agent"
            aria-label="Launch live AI voice agent"
          >
            Live
          </Link>
        </div>
      </div>

      <section aria-label="Your tools" className="workspace-tools-stage">
        <div className="pipeline-ribbon" aria-hidden="true" />
        <div className="workspace-tools">
          {[
            { to: "/opportunities", title: "Find new leads", text: "Discover related businesses and websites", color: "terracotta", step: "01 / DISCOVER" },
            { to: "/leads", title: "Your contacts", text: "Import a spreadsheet or manage saved leads", color: "obsidian", step: "02 / ORGANISE" },
            { to: "/conversations", title: "Your inbox", text: "Read replies and continue conversations", color: "marigold", step: "03 / CONNECT" },
            { to: "/phone-studio", title: "Try your voice agent", text: "Practise a browser call with your AI", color: "cobalt", step: "04 / PRACTISE" }
          ].map(tool => (
            <Link
              className={`workspace-tool ${tool.color}`}
              to={tool.to}
              key={tool.to}
              onMouseMove={handleCardTilt}
              onMouseLeave={resetCardTilt}
            >
              <div className="tool-art">
                <span>{tool.step}</span>
                {TOOL_ART[tool.color]}
              </div>
              <div className="tool-caption">
                <h2>{tool.title}</h2>
                <p>{tool.text}</p>
                <ChevronRight size={18} />
              </div>
            </Link>
          ))}
        </div>
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
          ["Appointments", metrics?.appointmentsBooked, "/tasks"]
        ].map(([label, value, path]) => (
          <Link key={label} to={path}>
            <span>{label}</span>
            <strong>{value ?? "—"}</strong>
          </Link>
        ))}
        <Link to="/analytics" className="metric-with-ring">
          <div>
            <span>Response rate</span>
            <strong>{metrics ? `${metrics.responseRatePct}%` : "—"}</strong>
          </div>
          <div
            className="donut-3d"
            aria-hidden="true"
            style={{
              background: `conic-gradient(#1d4ed8 0deg ${Math.round(Math.max(0, Math.min(100, Number(metrics?.responseRatePct ?? 0))) * 3.6)}deg, #e7e1d6 0deg 360deg)`
            }}
          />
        </Link>
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
