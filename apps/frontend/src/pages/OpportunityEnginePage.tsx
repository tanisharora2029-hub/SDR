import { TerritorySearch } from "../components/TerritorySearch.js";
import React, { useState, useEffect } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  RefreshCw,
  X,
  Eye,
  Send,
  Cpu,
  Building2,
  Users,
  ArrowRight,
  TrendingUp,
  Workflow,
  Check,
  Briefcase,
  FileText,
  ChevronDown,
  ChevronUp,
  Globe,
  HelpCircle,
  Activity,
  FileCheck
} from "lucide-react";

interface EvidenceItem {
  id?: string;
  type: "FACT" | "INFERENCE" | "UNKNOWN";
  category: string;
  observedFact: string;
  aiInference?: string | null;
  confidenceScore: number;
  sourceName: string;
  sourceUrl: string;
  sourceQuality: "HIGH" | "MEDIUM" | "LOW";
}

interface Opportunity {
  id: string;
  companyName: string;
  companyWebsite: string;
  companyIndustry?: string;
  companySize?: string;
  location?: string;
  potentialProblem: string;
  whyItMatters: string;
  score: number;
  scoreTier: "HIGH" | "MEDIUM" | "LOW";
  scoreBreakdown?: string;
  confidence: number;
  recommendedSolution: string;
  solutionExplanation: string;
  automationWorkflow?: string;
  potentialBusinessImpact: string;
  decisionMakerName?: string;
  decisionMakerTitle?: string;
  decisionMakerEmail?: string;
  decisionMakerEvidence?: string;
  discoveryQuery?: string;
  discoverySource?: string;
  pagesRead?: number;
  sourceUrls?: string;
  unknowns?: string;
  decisionMakerSource?: string;
  status: string;
  generatedSubject?: string;
  generatedEmail?: string;
  leadId?: string;
  researchStatus: string;
  createdAt: string;
  evidence?: EvidenceItem[];
}

interface DiscoveryTrailItem {
  query: string;
  source: string;
  url: string;
  domain: string;
  title: string;
  snippet: string;
  isAccepted: boolean;
  rejectReason?: string;
}

interface ResearchRunMetrics {
  id?: string;
  queriesGenerated: number;
  searchResultsCount: number;
  candidatesDiscovered: number;
  candidatesVerified: number;
  websitesCrawled: number;
  pagesRead: number;
  evidenceExtracted: number;
  aiAnalysesCompleted: number;
  candidatesRejected: number;
  opportunitiesQualified: number;
  status?: string;
  createdAt?: string;
  discoveryTrail?: DiscoveryTrailItem[];
}

export const OpportunityEnginePage: React.FC = () => {
  const { organization } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoveryNotice, setDiscoveryNotice] = useState<string | null>(null);

  // Telemetry & Transparency states
  const [latestRun, setLatestRun] = useState<ResearchRunMetrics | null>(null);
  const [showTrail, setShowTrail] = useState(false);

  // Filter states
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Mode 1: Autopilot states
  const [isAutopilotRunning, setIsAutopilotRunning] = useState(false);
  const [autopilotStep, setAutopilotStep] = useState<string>("");

  // Mode 2: Analyze URL states
  const [urlInput, setUrlInput] = useState("");
  const [isAnalyzingUrl, setIsAnalyzingUrl] = useState(false);
  const [urlAnalyzeError, setUrlAnalyzeError] = useState<string | null>(null);

  // Quick Action states
  const [isGeneratingTop10, setIsGeneratingTop10] = useState(false);
  const [top10SuccessMessage, setTop10SuccessMessage] = useState<string | null>(null);

  // Deep Analysis Modal states
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const [isSendingOutreach, setIsSendingOutreach] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch opportunities
  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; opportunities: Opportunity[] }>("/opportunities");
      if (res?.opportunities) {
        setOpportunities(res.opportunities);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load opportunities.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch latest research run telemetry
  const fetchLatestRun = async () => {
    try {
      const res = await api.get<{ success: boolean; run: any }>("/opportunities/research-runs/latest");
      if (res?.run) {
        let trail: DiscoveryTrailItem[] = [];
        if (res.run.metricsJson) {
          try {
            const m = JSON.parse(res.run.metricsJson);
            if (Array.isArray(m.discoveryTrail)) trail = m.discoveryTrail;
          } catch {}
        }
        setLatestRun({
          ...res.run,
          discoveryTrail: trail
        });
      }
    } catch {}
  };

  useEffect(() => {
    fetchOpportunities();
    fetchLatestRun();
  }, []);

  // Real-time WebSocket connection for live discovery progress
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL;
      let wsUrl = "";
      if (apiBase && apiBase.startsWith("http")) {
        wsUrl = apiBase.replace(/^http/, "ws").replace(/\/api\/?$/, "/ws");
      } else {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host;
        if (host.includes("nexsdr.in") || host.includes("onrender.com")) {
          wsUrl = "wss://sdr-backend-6o2x.onrender.com/ws";
        } else {
          wsUrl = `${protocol}//${host}/ws`;
        }
      }
      const token = localStorage.getItem("token");
      if (token) {
        wsUrl += (wsUrl.includes("?") ? "&" : "?") + `token=${encodeURIComponent(token)}`;
      }
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        if (organization?.id) {
          ws?.send(JSON.stringify({ type: "SUBSCRIBE_ORG", organizationId: organization.id, token }));
        }
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "DISCOVERY_PROGRESS") {
            const p = data.payload;
            if (p?.step === "GENERATING_QUERIES") {
              setAutopilotStep(p.message || `Generating ${p.count || 3} targeted ICP queries...`);
            } else if (p?.step === "SEARCHING_WEB") {
              setAutopilotStep(p.message || "Searching public web with ICP queries...");
            } else if (p?.step === "CANDIDATES_DISCOVERED") {
              setAutopilotStep(`Discovered ${p.count} candidate businesses. Verifying domain safety...`);
            } else if (p?.step === "CRAWLING") {
              setAutopilotStep(`Crawling public website for ${p.companyName} (${p.domain})...`);
            } else if (p?.step === "OPPORTUNITY_QUALIFIED") {
              setAutopilotStep(`✓ Validated opportunity for ${p.companyName} (${p.score}/100)`);
            } else if (p?.step === "CANDIDATE_REJECTED") {
              setAutopilotStep(`Filtered ${p.companyName}: ${p.reason}`);
            }
          } else if (data.type === "OPPORTUNITIES_UPDATED") {
            fetchOpportunities();
            fetchLatestRun();
          }
        } catch {}
      };
    } catch {}
    return () => {
      if (ws) ws.close();
    };
  }, [organization?.id]);

  // Run Autopilot Discovery (Real-time WebSocket progress — ZERO fake setTimeout timers)
  const handleRunAutopilot = async () => {
    try {
      setIsAutopilotRunning(true);
      setDiscoveryNotice(null);
      setError(null);
      setAutopilotStep("Initializing autonomous discovery pipeline...");

      const res = await api.post<{
        success: boolean;
        count: number;
        discoveryStatus: string;
        message: string;
        metrics?: any;
        opportunities: Opportunity[];
      }>("/opportunities/autopilot");

      if (res?.metrics) {
        setLatestRun(res.metrics);
      }

      if (res?.opportunities && res.opportunities.length > 0) {
        await fetchOpportunities();
      } else {
        if (res?.discoveryStatus === "NO_RESULTS") setDiscoveryNotice(res.message || "No new opportunities qualified.");
        else setError(res?.message || "Discovery is unavailable.");
      }
    } catch (err: any) {
      setError(err.message || "Autopilot discovery run failed.");
    } finally {
      setIsAutopilotRunning(false);
      setAutopilotStep("");
      fetchLatestRun();
    }
  };

  // Analyze Business URL
  const handleAnalyzeUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    try {
      setIsAnalyzingUrl(true);
      setUrlAnalyzeError(null);

      const res = await api.post<{ success: boolean; opportunity: Opportunity }>("/opportunities/analyze-url", {
        url: urlInput.trim()
      });

      if (res?.opportunity) {
        setUrlInput("");
        await fetchOpportunities();
        // Open the newly analyzed opportunity in modal
        setSelectedOpp(res.opportunity);
        setEditSubject(res.opportunity.generatedSubject || "");
        setEditEmail(res.opportunity.generatedEmail || "");
      }
    } catch (err: any) {
      setUrlAnalyzeError(err.message || "Failed to analyze business URL.");
    } finally {
      setIsAnalyzingUrl(false);
    }
  };

  // Generate Top 10 Leads into CRM
  const handleGenerateTop10 = async () => {
    try {
      setIsGeneratingTop10(true);
      setTop10SuccessMessage(null);

      const res = await api.post<{ success: boolean; count: number }>("/opportunities/generate-top-10");
      if (res?.success) {
        setTop10SuccessMessage(res.count ? `Added ${res.count} prospects to your CRM.` : "No new eligible prospects to add.");
        await fetchOpportunities();
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate top leads.");
    } finally {
      setIsGeneratingTop10(false);
    }
  };

  // Open Deep Analysis Modal
  const openDeepAnalysis = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setEditSubject(opp.generatedSubject || "");
    setEditEmail(opp.generatedEmail || "");
    setActionSuccess(null);
  };

  // Approve Opportunity
  const handleApprove = async (oppId: string) => {
    try {
      setIsSavingEdits(true);
      await api.post(`/opportunities/${oppId}/approve`, {
        subject: editSubject,
        email: editEmail
      });
      setActionSuccess("Opportunity approved and synced to CRM leads.");
      await fetchOpportunities();
      if (selectedOpp && selectedOpp.id === oppId) {
        setSelectedOpp((prev) => (prev ? { ...prev, status: "APPROVED" } : null));
      }
    } catch (err: any) {
      setError(err.message || "Failed to approve opportunity.");
    } finally {
      setIsSavingEdits(false);
    }
  };

  // Reject Opportunity
  const handleReject = async (oppId: string) => {
    try {
      await api.post(`/opportunities/${oppId}/reject`);
      setSelectedOpp(null);
      await fetchOpportunities();
    } catch (err: any) {
      setError(err.message || "Failed to reject opportunity.");
    }
  };

  // Dispatch Approved Outreach via SDR Pipeline
  const handleSendOutreach = async (oppId: string) => {
    try {
      setIsSendingOutreach(true);
      setError(null);
      const res = await api.post<{ success: boolean; message: string }>(`/opportunities/${oppId}/send`);
      if (res?.success) {
        setActionSuccess("Outreach email successfully dispatched via Resend!");
        await fetchOpportunities();
        if (selectedOpp && selectedOpp.id === oppId) {
          setSelectedOpp((prev) => (prev ? { ...prev, status: "SENT" } : null));
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to send outreach.");
    } finally {
      setIsSendingOutreach(false);
    }
  };

  // Filtered opportunities
  const filteredOpps = opportunities.filter((opp) => {
    if (selectedTier !== "ALL" && opp.scoreTier !== selectedTier) return false;
    if (selectedStatus !== "ALL" && opp.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchComp = opp.companyName.toLowerCase().includes(q);
      const matchInd = opp.companyIndustry?.toLowerCase().includes(q);
      const matchProb = opp.potentialProblem.toLowerCase().includes(q);
      if (!matchComp && !matchInd && !matchProb) return false;
    }
    return true;
  });

  // Calculate Metrics
  const highCount = opportunities.filter((o) => o.scoreTier === "HIGH").length;
  const readyReviewCount = opportunities.filter((o) => o.status === "READY_FOR_REVIEW").length;
  const inCrmCount = opportunities.filter((o) => o.status === "ADDED_TO_CRM" || o.status === "SENT").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      <header className="atlas-cover">
        <div><h1>Opportunity Atlas</h1><p>Find businesses and review the public evidence behind each opportunity.</p></div>
      </header>

      <TerritorySearch />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Mode 1: Autopilot */}
        <div className="lg:col-span-5 p-6 rounded-2xl border border-violet-500/20 bg-[#0e0f24]/60 backdrop-blur-xl shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mt-3">Find Opportunities</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Search public business pages for evidence of operational needs.
            </p>
          </div>

          <div className="mt-6">
            <button
              onClick={handleRunAutopilot}
              disabled={isAutopilotRunning}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold tracking-wide shadow-lg shadow-violet-600/30 border border-violet-400/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAutopilotRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{autopilotStep || "Researching Candidates..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Find opportunities</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mode 2: Analyze Business URL */}
        <div className="lg:col-span-7 p-6 rounded-2xl border border-white/[0.08] bg-[#0c0d1b]/60 backdrop-blur-xl shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mt-3">Targeted Company Research</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Enter a company website or a specific public page to review its evidence.
            </p>
          </div>

          <form onSubmit={handleAnalyzeUrl} className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://company-logistics.com"
                disabled={isAnalyzingUrl}
                className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isAnalyzingUrl || !urlInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-semibold border border-white/[0.1] transition flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
            >
              {isAnalyzingUrl ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning Web Signals...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Analyze Business</span>
                </>
              )}
            </button>
          </form>

          {urlAnalyzeError && (
            <p className="text-xs text-rose-400 mt-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {urlAnalyzeError}
            </p>
          )}
        </div>
      </div>

      {/* Research Run Transparency Card */}
      {latestRun && (
        <details className="atlas-research rounded-2xl border border-violet-500/20 bg-[#0e0f26]/80 p-5 space-y-4">
          <summary className="cursor-pointer font-semibold">Research details</summary>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300">
                <Activity className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Live Autonomous Research Pipeline Telemetry</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    REAL WEB DISCOVERY
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Full end-to-end transparency: Search Queries → Web Hits → Crawled Sites → Evidence Extraction → Qualification
                </p>
              </div>
            </div>

            {latestRun.discoveryTrail && latestRun.discoveryTrail.length > 0 && (
              <button
                onClick={() => setShowTrail((prev) => !prev)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-violet-300 border border-white/[0.08] transition flex items-center gap-1.5"
              >
                <span>{showTrail ? "Hide Discovery Trail" : `View Discovery Trail (${latestRun.discoveryTrail.length})`}</span>
                {showTrail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* 10-Stage Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2.5 text-center">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block">Queries</span>
              <span className="text-base font-black text-white mt-0.5 block">{latestRun.queriesGenerated}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block">Web Hits</span>
              <span className="text-base font-black text-white mt-0.5 block">{latestRun.searchResultsCount}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block">Discovered</span>
              <span className="text-base font-black text-cyan-300 mt-0.5 block">{latestRun.candidatesDiscovered}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block">Verified</span>
              <span className="text-base font-black text-cyan-300 mt-0.5 block">{latestRun.candidatesVerified}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block">Crawled</span>
              <span className="text-base font-black text-indigo-300 mt-0.5 block">{latestRun.websitesCrawled}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block">Pages Read</span>
              <span className="text-base font-black text-indigo-300 mt-0.5 block">{latestRun.pagesRead}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block">Evidence</span>
              <span className="text-base font-black text-violet-300 mt-0.5 block">{latestRun.evidenceExtracted}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block">AI Analyzed</span>
              <span className="text-base font-black text-violet-300 mt-0.5 block">{latestRun.aiAnalysesCompleted}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.04]">
              <span className="text-[9px] uppercase tracking-wider text-amber-500/80 font-semibold block">Filtered</span>
              <span className="text-base font-black text-amber-400 mt-0.5 block">{latestRun.candidatesRejected}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
              <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-semibold block">Qualified</span>
              <span className="text-base font-black text-emerald-300 mt-0.5 block">{latestRun.opportunitiesQualified}</span>
            </div>
          </div>

          {/* Expandable Discovery Trail */}
          {showTrail && latestRun.discoveryTrail && latestRun.discoveryTrail.length > 0 && (
            <div className="pt-3 border-t border-white/[0.06] space-y-2">
              <span className="text-[11px] font-bold text-white block">Discovery Trail & Verification Audit Log:</span>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-2 scrollbar-thin text-[11px]">
                {latestRun.discoveryTrail.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-black/50 border border-white/[0.04] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white truncate">{item.domain}</span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-500 hover:text-slate-300"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        <span className="text-[10px] text-slate-500 font-mono truncate max-w-xs">
                          via &quot;{item.query}&quot;
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.snippet || item.title}</p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                        item.isAccepted
                          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                      }`}
                    >
                      {item.isAccepted ? "Accepted" : item.rejectReason || "Filtered"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </details>
      )}

      {/* Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0c0d1b]/40 backdrop-blur-md">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
            Total Opportunities
          </span>
          <span className="text-2xl font-black text-white mt-1 block">{opportunities.length}</span>
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 backdrop-blur-md">
          <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold block">
            High Impact (80-100)
          </span>
          <span className="text-2xl font-black text-emerald-300 mt-1 block">{highCount}</span>
        </div>

        <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-950/10 backdrop-blur-md">
          <span className="text-[11px] uppercase tracking-wider text-violet-400 font-semibold block">
            Ready for Review
          </span>
          <span className="text-2xl font-black text-violet-300 mt-1 block">{readyReviewCount}</span>
        </div>

        <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10 backdrop-blur-md">
          <span className="text-[11px] uppercase tracking-wider text-cyan-400 font-semibold block">
            In CRM / Contacted
          </span>
          <span className="text-2xl font-black text-cyan-300 mt-1 block">{inCrmCount}</span>
        </div>
      </div>

      {/* Notification Alerts */}
      {top10SuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{top10SuccessMessage}</span>
          </div>
          <button
            onClick={() => setTop10SuccessMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {discoveryNotice && <p role="status" className="p-4 text-sm text-slate-300">{discoveryNotice}</p>}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0c0d1b]/60 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, problem, solution..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/40 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/40"
          />
        </div>

        {/* Tier & Status Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="px-3 py-2 rounded-lg bg-black/40 border border-white/[0.08] text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Tiers</option>
            <option value="HIGH">High (80 - 100)</option>
            <option value="MEDIUM">Medium (60 - 79)</option>
            <option value="LOW">Low (&lt; 60)</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-lg bg-black/40 border border-white/[0.08] text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="READY_FOR_REVIEW">Ready for Review</option>
            <option value="APPROVED">Approved</option>
            <option value="ADDED_TO_CRM">Added to CRM</option>
            <option value="SENT">Outreach Sent</option>
          </select>

          {/* Quick Action: Generate 10 Leads */}
          <button
            onClick={handleGenerateTop10}
            disabled={isGeneratingTop10 || opportunities.length === 0}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-violet-600/20 border border-violet-400/30 transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {isGeneratingTop10 ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            <span>Add top prospects to CRM</span>
          </button>
        </div>
      </div>

      {/* Opportunity Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-xs flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
          <span>Loading opportunity intelligence...</span>
        </div>
      ) : filteredOpps.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-white/[0.06] bg-[#0c0d1b]/40 backdrop-blur-xl p-8">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-slate-500 mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No Opportunities Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Click &quot;Find Opportunities&quot; above to run Autopilot discovery or paste a company URL to analyze public operational signals.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOpps.map((opp) => {
            const isHigh = opp.scoreTier === "HIGH";
            const isMed = opp.scoreTier === "MEDIUM";

            return (
              <div
                key={opp.id}
                className={`rounded-2xl border p-5 flex flex-col justify-between transition group backdrop-blur-xl ${
                  isHigh
                    ? "bg-[#0d0f26]/80 border-violet-500/30 hover:border-violet-500/50 shadow-lg shadow-violet-950/20"
                    : isMed
                    ? "bg-[#0c0d1b]/70 border-white/[0.08] hover:border-white/[0.15]"
                    : "bg-[#0a0a14]/60 border-white/[0.04] opacity-75"
                }`}
              >
                <div>
                  {/* Top row: Company & Score Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-violet-300 transition">
                          {opp.companyName}
                        </h3>
                        <a
                          href={opp.companyWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-500 hover:text-slate-300"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {opp.companyIndustry || "B2B Operations"}
                      </p>
                    </div>

                    {/* Score Badge */}
                    <div
                      className={`px-2.5 py-1 rounded-lg border text-xs font-black tracking-tight shrink-0 flex items-center gap-1 ${
                        isHigh
                          ? "bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-md shadow-violet-950/40"
                          : isMed
                          ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                          : "bg-slate-800/40 border-slate-700/30 text-slate-400"
                      }`}
                    >
                      <span>{opp.score}/100</span>
                      <span className="text-[9px] font-bold uppercase">{opp.scoreTier}</span>
                    </div>
                  </div>

                  {/* Potential Problem */}
                  <div className="mt-4 p-3 rounded-xl bg-black/40 border border-white/[0.04]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Potential Opportunity
                    </span>
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {opp.potentialProblem}
                    </p>
                  </div>

                  {/* Evidence Pills */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {opp.evidence && opp.evidence.length > 0 ? (
                      opp.evidence.slice(0, 2).map((ev, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-slate-400 truncate max-w-[170px]"
                        >
                          ✓ {ev.category.replace("_", " ")}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-500">
                        Operational Signals
                      </span>
                    )}
                    <span className="text-[10px] text-violet-400 font-mono ml-auto">
                      {opp.confidence}% Conf.
                    </span>
                  </div>

                  {/* Recommended Solution Pill */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Solution:</span>
                    <span className="text-[11px] font-bold text-violet-300 truncate">
                      {opp.recommendedSolution}
                    </span>
                  </div>

                  {/* Decision Maker */}
                  <div className="mt-2 text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>
                      {opp.decisionMakerName
                        ? `${opp.decisionMakerName} (${opp.decisionMakerTitle || "Leadership"})`
                        : "Decision maker not publicly identified"}
                    </span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      opp.status === "SENT"
                        ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                        : opp.status === "ADDED_TO_CRM"
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        : opp.status === "APPROVED"
                        ? "bg-violet-500/10 text-violet-300 border border-violet-500/20"
                        : "bg-slate-800/40 text-slate-400 border border-slate-700/30"
                    }`}
                  >
                    {opp.status.replace(/_/g, " ")}
                  </span>

                  <button
                    onClick={() => openDeepAnalysis(opp)}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium border border-white/[0.08] transition flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-violet-400" />
                    <span>View Analysis</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deep Analysis Slide-over / Modal */}
      {selectedOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl border border-white/[0.1] bg-[#0c0d1b] shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto scrollbar-thin">
            {/* Header */}
            <div className="flex items-start justify-between pb-6 border-b border-white/[0.08]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-white">{selectedOpp.companyName}</h2>
                  <a
                    href={selectedOpp.companyWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-white"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      selectedOpp.scoreTier === "HIGH"
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                        : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    }`}
                  >
                    {selectedOpp.score}/100 {selectedOpp.scoreTier} OPPORTUNITY
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedOpp.companyIndustry} • {selectedOpp.location || "United States"} • {selectedOpp.confidence}% Confidence
                  {selectedOpp.pagesRead ? ` • ${selectedOpp.pagesRead} pages crawled` : ""}
                  {selectedOpp.discoveryQuery ? ` • Query: "${selectedOpp.discoveryQuery}"` : ""}
                </p>
              </div>

              <button
                onClick={() => setSelectedOpp(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {/* Deep Sections Container */}
            <div className="mt-6 space-y-6 text-xs text-slate-300">
              {/* 1. Potential Problem & Why It Matters */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                <div className="flex items-center gap-2 text-violet-400 font-bold uppercase tracking-wider text-[11px]">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Potential Operational Problem
                </div>
                <p className="text-sm font-semibold text-white leading-relaxed">
                  {selectedOpp.potentialProblem}
                </p>
                <div className="pt-2 border-t border-white/[0.04]">
                  <span className="text-slate-400 font-semibold block mb-0.5">Why This Matters:</span>
                  <p className="text-slate-300 leading-relaxed">{selectedOpp.whyItMatters}</p>
                </div>
              </div>

              {/* 2. Fact vs Inference Partitioning */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Evidence-First Classification
                  </span>
                  <span className="text-[10px] text-slate-500">Separating observed facts from AI deductions</span>
                </div>

                <div className="space-y-2.5">
                  {selectedOpp.evidence && selectedOpp.evidence.length > 0 ? (
                    selectedOpp.evidence.map((ev, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-white/[0.06] bg-[#111228]/50 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                              VERIFIED FACT
                            </span>
                            <span className="text-slate-400 text-[11px] font-medium">
                              Source: {ev.sourceName}
                            </span>
                          </div>

                          <a
                            href={ev.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                          >
                            Open Source Link <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>

                        {/* Observed Quote */}
                        <p className="text-slate-200 text-xs italic bg-black/30 p-2.5 rounded-lg border border-white/[0.04]">
                          &quot;{ev.observedFact}&quot;
                        </p>

                        {/* AI Inference */}
                        {ev.aiInference && (
                          <div className="flex items-start gap-2 pt-1">
                            <span className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-300 text-[10px] font-bold shrink-0 mt-0.5">
                              AI INFERENCE
                            </span>
                            <p className="text-slate-300 text-xs leading-relaxed">
                              {ev.aiInference}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500">No atomic evidence records attached.</p>
                  )}
                </div>

                {/* 2b. Crawled Pages & Verification Audit */}
                {(() => {
                  try {
                    const urls: string[] = selectedOpp.sourceUrls ? JSON.parse(selectedOpp.sourceUrls) : [];
                    if (!urls || urls.length === 0) return null;
                    return (
                      <div className="p-3.5 rounded-xl border border-white/[0.06] bg-[#0c0d1b]/60 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-white">
                          <span className="flex items-center gap-1.5 text-cyan-400">
                            <Globe className="w-3.5 h-3.5" />
                            Crawled Public Pages ({urls.length})
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">Live Safe HTTP Fetch</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {urls.map((u, i) => (
                            <a
                              key={i}
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.06] truncate max-w-xs flex items-center gap-1"
                            >
                              <span className="truncate">{u}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0 text-slate-500" />
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}

                {/* 2c. Unknowns & Unverified Details */}
                {(() => {
                  try {
                    const unks: string[] = selectedOpp.unknowns ? JSON.parse(selectedOpp.unknowns) : [];
                    if (!unks || unks.length === 0) return null;
                    return (
                      <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-950/10 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Deliberate Unknowns (Anti-Hallucination Guard)</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                          {unks.map((u, i) => (
                            <li key={i}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </div>

              {/* 3. Suggested solution & Automation Workflow */}
              <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-950/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-violet-300 font-bold uppercase tracking-wider text-[11px]">
                    <Workflow className="w-4 h-4 text-violet-400" />
                    Recommended MachineMind Solution
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40 text-[11px] font-bold">
                    {selectedOpp.recommendedSolution}
                  </span>
                </div>

                <p className="text-slate-300 leading-relaxed">{selectedOpp.solutionExplanation}</p>

                {/* Workflow Diagram Steps */}
                <div className="pt-2">
                  <span className="text-[11px] font-bold text-white block mb-2">
                    Proposed Automation Workflow:
                  </span>
                  <div className="space-y-2">
                    {selectedOpp.automationWorkflow && (
                      (() => {
                        try {
                          const steps = JSON.parse(selectedOpp.automationWorkflow);
                          return Array.isArray(steps) ? (
                            steps.map((s: string, idx: number) => (
                              <div key={idx} className="flex items-center gap-3">
                                <span className="w-5 h-5 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center font-bold text-[10px] text-violet-300 shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-slate-300 text-xs">{s}</span>
                              </div>
                            ))
                          ) : null;
                        } catch {
                          return null;
                        }
                      })()
                    )}
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center font-bold text-[10px] text-emerald-300 shrink-0">
                        ✓
                      </span>
                      <span className="text-emerald-300 text-xs font-semibold">
                        Human escalation safeguard on edge cases or anomalies
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-violet-500/20 text-[11px]">
                  <strong className="text-white">Potential Business Impact: </strong>
                  <span className="text-slate-300">{selectedOpp.potentialBusinessImpact}</span>
                </div>
              </div>

              {/* 4. Decision Maker Discovery */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Relevant Decision-Maker
                  </span>
                  <p className="text-sm font-bold text-white">
                    {selectedOpp.decisionMakerName || "Operations Leadership"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedOpp.decisionMakerTitle || "Operations & Strategy Team"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded bg-white/[0.06] text-slate-400 text-[10px]">
                    {selectedOpp.decisionMakerEmail ? selectedOpp.decisionMakerEmail : "No published email found"}
                  </span>
                </div>
              </div>

              {/* 5. Personalized Problem-First Outreach Editor */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-violet-400" />
                    Problem-First Outreach Preview
                  </span>
                  <span className="text-[10px] text-slate-500">Review & customize before sending</span>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 font-semibold">
                    Email Subject Line:
                  </label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-black/50 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-violet-500/40"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 font-semibold">
                    Email Body Content:
                  </label>
                  <textarea
                    rows={8}
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full p-3.5 rounded-lg bg-black/50 border border-white/[0.1] text-xs text-white leading-relaxed focus:outline-none focus:border-violet-500/40 font-sans"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="mt-8 pt-6 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => handleReject(selectedOpp.id)}
                className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/20 transition"
              >
                Reject Opportunity
              </button>

              <div className="flex flex-wrap items-center gap-3">
                {!selectedOpp.leadId && !selectedOpp.decisionMakerEmail && <small>A published contact email is needed for CRM and outreach.</small>}
                <button
                  onClick={() => handleApprove(selectedOpp.id)}
                  disabled={isSavingEdits || (!selectedOpp.leadId && !selectedOpp.decisionMakerEmail)}
                  className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-semibold border border-white/[0.1] transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingEdits ? "Saving..." : "Approve & Add to CRM"}</span>
                </button>

                <button
                  onClick={() => handleSendOutreach(selectedOpp.id)}
                  disabled={isSendingOutreach || (!selectedOpp.leadId && !selectedOpp.decisionMakerEmail)}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 border border-violet-400/30 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isSendingOutreach ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Send Outreach via SDR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpportunityEnginePage;
