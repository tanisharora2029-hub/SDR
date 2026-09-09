import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import {
  MessageSquare,
  Bot,
  User,
  Send,
  Sparkles,
  PhoneCall,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  FlaskConical,
  Play,
  CheckCircle2,
  ExternalLink
} from "lucide-react";

export const ConversationsPage: React.FC = () => {
  const { user, organization } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const [activeConv, setActiveConv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [humanMsgText, setHumanMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [resuming, setResuming] = useState(false);

  const loadConversationsQuietly = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.conversations || []);
    } catch (err) {}
  };

  const loadSelectedQuietly = async (convId: string) => {
    try {
      const res = await api.getConversation(convId);
      setActiveConv(res.conversation);
    } catch (err) {}
  };

  const loadConversations = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.conversations || []);
      if (typeof window !== "undefined" && window.innerWidth >= 768 && res.conversations?.length > 0 && !selectedId) {
        setSelectedId(res.conversations[0].id);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    async function loadSelected() {
      if (!selectedId) return;
      try {
        const res = await api.getConversation(selectedId);
        setActiveConv(res.conversation);
      } catch (err) {
        console.error("Failed to load conversation:", err);
      }
    }
    loadSelected();
  }, [selectedId]);

  // Real-time WebSocket connection + 4-second fallback polling
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
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        if (organization?.id) {
          ws?.send(JSON.stringify({ type: "SUBSCRIBE_ORG", organizationId: organization.id }));
        }
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "MESSAGE_CREATED" || data.type === "CONVERSATION_UPDATED") {
            loadConversationsQuietly();
            if (selectedIdRef.current) {
              loadSelectedQuietly(selectedIdRef.current);
            }
          }
        } catch (e) {}
      };
    } catch (err) {}

    const interval = setInterval(() => {
      loadConversationsQuietly();
      if (selectedIdRef.current) {
        loadSelectedQuietly(selectedIdRef.current);
      }
    }, 4000);

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [organization?.id]);

  const handleSelectConversation = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setActiveConv(null);
    setHumanMsgText("");
  };

  const handleSendHumanMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConv?.id || !humanMsgText.trim()) return;

    const targetConvId = activeConv.id;
    const textToSend = humanMsgText.trim();
    setSending(true);
    try {
      await api.sendHumanMessage(targetConvId, textToSend);
      setHumanMsgText("");
      const res = await api.getConversation(targetConvId);
      setActiveConv(res.conversation);
      const listRes = await api.getConversations();
      setConversations(listRes.conversations);
    } catch (err: any) {
      alert(err.message || "Failed to send human message");
    } finally {
      setSending(false);
    }
  };

  const handleResumeAi = async () => {
    if (!activeConv?.id) return;
    setResuming(true);
    try {
      await api.resumeAi(activeConv.id);
      const res = await api.getConversation(activeConv.id);
      setActiveConv(res.conversation);
      const listRes = await api.getConversations();
      setConversations(listRes.conversations);
    } catch (err: any) {
      alert(err.message || "Failed to resume AI SDR");
    } finally {
      setResuming(false);
    }
  };

  return (
    <div className="h-[calc(100vh-5.5rem)] sm:h-[calc(100vh-6rem)] flex flex-col space-y-4 max-w-7xl mx-auto min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Omnichannel Inbox</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor autonomous AI SDR conversations with external leads. Take over as a human anytime.
          </p>
        </div>
        <Link
          to="/lead-simulator"
          className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto shrink-0"
        >
          <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
          <span>Open Test Lead Simulator</span>
        </Link>
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex min-w-0">
        {/* Left: Threads list */}
        <div className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-80 md:border-r border-slate-800 flex-col h-full bg-slate-950/40 shrink-0`}>
          <div className="p-3.5 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Conversations ({conversations.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 scrollbar-thin">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectConversation(c.id)}
                className={`w-full text-left p-3.5 transition flex flex-col gap-1 ${
                  selectedId === c.id ? "bg-slate-800/60 border-l-2 border-indigo-500" : "hover:bg-slate-800/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-200">
                    {c.lead?.firstName} {c.lead?.lastName}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    {c.channel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">{c.lead?.companyName}</p>
                <div className="flex items-center gap-2 mt-1">
                  {c.lead?.isOptedOut || c.lead?.status === "OPTED_OUT" ? (
                    <span className="text-[10px] text-rose-400 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3 h-3" /> Opted Out (DNC)
                    </span>
                  ) : !c.isAiActive ? (
                    <span className="text-[10px] text-amber-400 flex items-center gap-1 font-medium">
                      <User className="w-3 h-3" /> Human Takeover
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                      <Bot className="w-3 h-3" /> AI SDR Active
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Active Message Thread */}
        <div className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 flex-col h-full bg-slate-900/60 min-w-0`}>
          {activeConv ? (
            <>
              {/* Thread Header with Explicit Roles */}
              <div className="p-3.5 sm:p-4 border-b border-slate-800 flex flex-wrap items-center justify-between bg-slate-950/40 gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1.5 -ml-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg md:hidden shrink-0 transition"
                    aria-label="Back to conversations list"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-sm text-slate-100 truncate">
                        {activeConv.lead?.firstName} {activeConv.lead?.lastName}
                      </h2>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                        External Lead
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {activeConv.lead?.jobTitle ? `${activeConv.lead.jobTitle} at ` : ""}{activeConv.lead?.companyName} • {activeConv.lead?.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Lead Simulator Quick Link */}
                  <Link
                    to={`/lead-simulator?leadId=${activeConv.leadId}`}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 flex items-center gap-1 transition"
                    title="Simulate this lead in the external simulator"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">Test in Simulator</span>
                  </Link>

                  {/* Status Badge & Resume AI Toggle */}
                  {activeConv.lead?.isOptedOut || activeConv.lead?.status === "OPTED_OUT" ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      OPTED OUT / DNC
                    </span>
                  ) : activeConv.isAiActive ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <Bot className="w-3 h-3" />
                      <span>AI SDR Active</span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Human Takeover
                      </span>
                      <button
                        onClick={handleResumeAi}
                        disabled={resuming}
                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 transition shadow-sm"
                        title="Resume autonomous AI SDR handling"
                      >
                        <Play className="w-3 h-3" />
                        <span>Resume AI</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages Flow with Distinct Semantic Roles */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin">
                {activeConv.messages?.map((m: any) => {
                  const isLead = m.senderRole === "LEAD" || m.direction === "INBOUND";
                  const isHuman = m.senderRole === "HUMAN";
                  const isAi = m.senderRole === "AI" || (!m.senderRole && m.direction === "OUTBOUND");

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isLead ? "items-start" : "items-end"}`}
                    >
                      {/* Sender Attribution Header */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                        {isLead ? (
                          <>
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                              <span>👤</span>
                              <span>LEAD — {m.senderName || `${activeConv.lead?.firstName} ${activeConv.lead?.lastName}`.trim() || "Lead"}</span>
                            </span>
                            {m.status === "REAL_INBOUND" || m.toolCallArgs?.includes("REAL_INBOUND") ? (
                              <>
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  REAL INBOUND
                                </span>
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  EMAIL
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({activeConv.lead?.email || "Prospect"})
                              </span>
                            )}
                          </>
                        ) : isHuman ? (
                          <>
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                              <span>👨</span>
                              <span>HUMAN — {m.senderName || user?.name || "Operator"} (Workspace Owner)</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 font-semibold text-indigo-300">
                              <span>🤖</span>
                              <span>AI SDR — {m.senderName || "Alex Rivers"}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">(&lt;alex@nexsdr.in&gt;)</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="font-mono text-[10px]">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`max-w-xl p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isLead
                            ? "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700 shadow"
                            : isHuman
                            ? "bg-amber-950/60 border border-amber-500/40 text-amber-100 rounded-tr-none shadow"
                            : "bg-indigo-600 text-white rounded-tr-none shadow"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>

                        {/* Tool execution badge if present */}
                        {m.toolCallName && (
                          <div className="mt-2 pt-2 border-t border-indigo-400/30 flex items-center gap-1.5 text-[10px] text-indigo-200">
                            <Sparkles className="w-3 h-3 text-amber-300" />
                            <span>Executed Tool: <code className="font-mono font-semibold">{m.toolCallName}</code></span>
                          </div>
                        )}
                      </div>

                      {/* AI Reasoning Trace */}
                      {isAi && m.aiReasoning && (
                        <span className="text-[10px] text-slate-500 font-mono mt-1 max-w-xl truncate">
                          {m.aiReasoning}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Composer: Strictly Human Takeover */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-2">
                {!activeConv.isAiActive && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span>Human Takeover Active. AI SDR will not auto-respond on this thread.</span>
                    </span>
                    <button
                      onClick={handleResumeAi}
                      disabled={resuming}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      <span>Resume AI SDR</span>
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendHumanMessage} className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-medium text-slate-300">
                      Reply as Human Sales Rep ({user?.name || "You"}):
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Sending will attribute you as HUMAN and pause AI SDR
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={humanMsgText}
                      onChange={(e) => setHumanMsgText(e.target.value)}
                      placeholder={`Type your reply to ${activeConv.lead?.firstName || "the lead"} as ${user?.name || "the sales rep"}...`}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={sending || !humanMsgText.trim()}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send as Human</span>
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-500">
              Select a conversation to inspect message thread.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
