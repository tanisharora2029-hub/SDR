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
  ExternalLink,
  XCircle,
  Search,
  SlidersHorizontal,
  Star,
  MoreVertical,
  Paperclip,
  Mic,
  CheckCheck
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
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

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
    if (activeConv.lead?.isOptedOut || activeConv.lead?.status === "OPTED_OUT") {
      alert("Cannot resume AI SDR: This lead is opted out (DNC). All automated outreach is hard-blocked.");
      return;
    }
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

  // Channel filtering
  const filteredConversations = conversations.filter((c) => {
    if (channelFilter !== "ALL" && c.channel?.toUpperCase() !== channelFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = `${c.lead?.firstName} ${c.lead?.lastName}`.toLowerCase();
      const company = (c.lead?.companyName || "").toLowerCase();
      const email = (c.lead?.email || "").toLowerCase();
      return name.includes(q) || company.includes(q) || email.includes(q);
    }
    return true;
  });

  const emailCount = conversations.filter((c) => c.channel === "EMAIL").length;
  const phoneCount = conversations.filter((c) => c.channel === "PHONE" || c.channel === "VOICE").length;
  const smsCount = conversations.filter((c) => c.channel === "SMS" || c.channel === "WHATSAPP").length;

  const leadInitials = (first?: string, last?: string) => {
    return ((first?.[0] || "L") + (last?.[0] || "D")).toUpperCase();
  };

  return (
    <div className="h-[calc(100vh-5.5rem)] sm:h-[calc(100vh-6rem)] flex flex-col space-y-4 max-w-7xl mx-auto min-w-0 pb-2">
      {/* Top Header matching reference */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Omnichannel Inbox</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor and manage all your conversations in one place.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Link
            to="/lead-simulator"
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lead Simulator ↗</span>
          </Link>
        </div>
      </div>

      {/* Main Glass Workspace */}
      <div className="flex-1 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden flex min-w-0">
        {/* Left: Conversation List Panel */}
        <div
          className={`${
            selectedId ? "hidden md:flex" : "flex"
          } w-full md:w-84 lg:w-96 md:border-r border-white/[0.06] flex-col h-full bg-[#0a0a14]/60 shrink-0`}
        >
          {/* Header & Filter Controls matching reference */}
          <div className="p-3.5 sm:p-4 border-b border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white tracking-tight">Conversations</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSearchQuery((prev) => (prev ? "" : " "))}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
                  title="Search conversations"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
                  title="Filter options"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Channel Filter Pills matching reference */}
            <div className="flex items-center gap-1.5 text-[11px] overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setChannelFilter("ALL")}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  channelFilter === "ALL"
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30 border border-violet-400/30"
                    : "bg-white/[0.04] text-slate-400 hover:text-slate-200"
                }`}
              >
                All {conversations.length}
              </button>
              <button
                onClick={() => setChannelFilter("EMAIL")}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  channelFilter === "EMAIL"
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30 border border-violet-400/30"
                    : "bg-white/[0.04] text-slate-400 hover:text-slate-200"
                }`}
              >
                Email {emailCount}
              </button>
              <button
                onClick={() => setChannelFilter("PHONE")}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  channelFilter === "PHONE"
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30 border border-violet-400/30"
                    : "bg-white/[0.04] text-slate-400 hover:text-slate-200"
                }`}
              >
                Phone {phoneCount}
              </button>
              <button
                onClick={() => setChannelFilter("SMS")}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  channelFilter === "SMS"
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30 border border-violet-400/30"
                    : "bg-white/[0.04] text-slate-400 hover:text-slate-200"
                }`}
              >
                SMS {smsCount}
              </button>
            </div>
          </div>

          {/* Thread List Items matching reference avatars & pills */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] scrollbar-thin">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No conversations found.
              </div>
            ) : (
              filteredConversations.map((c, idx) => {
                const initials = leadInitials(c.lead?.firstName, c.lead?.lastName);
                const isSelected = selectedId === c.id;

                const avatarGradients = [
                  "from-violet-600 to-indigo-600",
                  "from-cyan-600 to-blue-600",
                  "from-fuchsia-600 to-pink-600",
                  "from-purple-600 to-violet-700",
                  "from-emerald-600 to-teal-600"
                ];
                const grad = avatarGradients[idx % avatarGradients.length];

                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={`w-full text-left p-3.5 transition flex items-start gap-3 ${
                      isSelected
                        ? "bg-[#141428] border-l-2 border-violet-400 shadow-inner"
                        : "hover:bg-white/[0.02]"
                    }`}
                  >
                    {/* Avatar Circle */}
                    <div
                      className={`w-9 h-9 rounded-full bg-gradient-to-tr ${grad} flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md`}
                    >
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-xs text-white truncate">
                          {c.lead?.firstName} {c.lead?.lastName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {c.updatedAt
                            ? new Date(c.updatedAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                              })
                            : "5:17 PM"}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 truncate">
                        {c.lead?.companyName || "Prospect"}
                      </p>

                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-300 font-medium border border-white/[0.06]">
                          {c.channel || "Email"}
                        </span>

                        {c.lead?.isOptedOut || c.lead?.status === "OPTED_OUT" ? (
                          <span className="text-[9px] text-rose-400 flex items-center gap-1 font-semibold uppercase">
                            <XCircle className="w-2.5 h-2.5" /> DNC
                          </span>
                        ) : !c.isAiActive ? (
                          <span className="text-[9px] text-amber-400 flex items-center gap-1 font-semibold uppercase">
                            <User className="w-2.5 h-2.5" /> Takeover
                          </span>
                        ) : (
                          <span className="text-[9px] text-emerald-400 flex items-center gap-1 font-semibold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            AI Active
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Message Thread */}
        <div
          className={`${
            selectedId ? "flex" : "hidden md:flex"
          } flex-1 flex-col h-full bg-[#080812]/50 min-w-0`}
        >
          {activeConv ? (
            <>
              {/* Thread Header matching reference right view */}
              <div className="p-3.5 sm:p-4 border-b border-white/[0.06] flex items-center justify-between bg-[#0a0a16]/60 backdrop-blur-md gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1.5 -ml-1 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl md:hidden shrink-0 transition"
                    aria-label="Back to conversations list"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md">
                    {leadInitials(activeConv.lead?.firstName, activeConv.lead?.lastName)}
                  </div>

                  <div className="min-w-0">
                    <h2 className="font-bold text-xs sm:text-sm text-white truncate">
                      {activeConv.lead?.firstName} {activeConv.lead?.lastName}
                    </h2>
                    <p className="text-[11px] text-slate-400 truncate">
                      {activeConv.lead?.jobTitle || "Executive"} · {activeConv.lead?.companyName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button className="p-1.5 rounded-xl text-slate-400 hover:text-yellow-400 hover:bg-white/[0.06] transition">
                    <Star className="w-4 h-4" />
                  </button>
                  <Link
                    to={`/leads/${activeConv.leadId}`}
                    className="px-2.5 py-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 text-xs font-semibold transition"
                    title="Open Lead Dossier"
                  >
                    Dossier →
                  </Link>

                  {/* AI / Takeover / DNC Status Pill */}
                  {activeConv.lead?.isOptedOut || activeConv.lead?.status === "OPTED_OUT" ? (
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-rose-400" />
                      <span>DNC BLOCKED</span>
                    </span>
                  ) : activeConv.isAiActive ? (
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase bg-violet-500/20 text-violet-300 border border-violet-500/40 flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>AI SDR Active</span>
                    </span>
                  ) : (
                    <button
                      onClick={handleResumeAi}
                      disabled={resuming}
                      className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition shadow-md shadow-emerald-700/30"
                      title="Resume AI SDR"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Resume AI</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Message Flow with holographic bubbles matching reference */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin">
                {activeConv.messages?.map((m: any) => {
                  const isLead = m.senderRole === "LEAD" || m.direction === "INBOUND";
                  const isHuman = m.senderRole === "HUMAN";
                  const isAi = m.senderRole === "AI" || (!m.senderRole && m.direction === "OUTBOUND");
                  const timeFormatted = new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                  });

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isLead ? "items-start" : "items-end"}`}
                    >
                      {/* Sender label */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1 px-1">
                        {isLead ? (
                          <span className="text-slate-400 font-medium">
                            {activeConv.lead?.firstName} {activeConv.lead?.lastName}
                          </span>
                        ) : isHuman ? (
                          <span className="text-amber-400 font-medium">Human Takeover ({user?.name || "Operator"})</span>
                        ) : (
                          <span className="text-violet-400 font-medium">Alex Rivers (AI SDR)</span>
                        )}
                        <span>•</span>
                        <span>{timeFormatted}</span>
                      </div>

                      {/* Message Bubble: Dark glass for Lead vs Luminous Violet Gradient for AI */}
                      <div
                        className={`max-w-lg sm:max-w-xl p-4 text-xs leading-relaxed transition-all ${
                          isLead
                            ? "bg-[#101020]/90 text-slate-200 rounded-2xl rounded-tl-sm border border-white/[0.08] shadow-md"
                            : isHuman
                            ? "bg-amber-950/70 border border-amber-500/40 text-amber-100 rounded-2xl rounded-tr-sm shadow-md"
                            : "bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-600 text-white rounded-2xl rounded-tr-sm shadow-xl shadow-violet-950/50 border border-violet-400/30"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>

                        {/* Tool execution badge if present */}
                        {m.toolCallName && (
                          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10px] text-violet-200">
                            <Sparkles className="w-3 h-3 text-yellow-300" />
                            <span>Executed Tool: <code className="font-mono font-bold">{m.toolCallName}</code></span>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-white/60">
                          <span>{timeFormatted}</span>
                          {!isLead && <CheckCheck className="w-3 h-3 text-cyan-300" />}
                        </div>
                      </div>

                      {/* AI Reasoning preview */}
                      {isAi && m.aiReasoning && (
                        <span className="text-[10px] text-slate-500 font-mono mt-1 max-w-lg truncate px-1">
                          Strategy: {m.aiReasoning}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Composer Input Bar matching reference image */}
              <div className="p-3.5 sm:p-4 border-t border-white/[0.06] bg-[#0a0a16]/80 backdrop-blur-md space-y-2">
                {/* DNC or Human Takeover Status Warnings */}
                {activeConv.lead?.isOptedOut || activeConv.lead?.status === "OPTED_OUT" ? (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      <strong>Lead Opted Out (DNC):</strong> All automated outreach is hard-blocked.
                    </span>
                  </div>
                ) : !activeConv.isAiActive ? (
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-300 px-3">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span>Human Takeover Active. AI SDR is paused.</span>
                    </span>
                    <button
                      onClick={handleResumeAi}
                      disabled={resuming}
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Resume AI SDR</span>
                    </button>
                  </div>
                ) : null}

                {/* Input Bar with attachments & Send button matching reference */}
                <form onSubmit={handleSendHumanMessage} className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-[#121224] border border-white/[0.08] rounded-2xl px-3.5 py-2 focus-within:border-violet-500/60 transition shadow-inner">
                    <input
                      type="text"
                      value={humanMsgText}
                      onChange={(e) => setHumanMsgText(e.target.value)}
                      placeholder="Type a reply..."
                      className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
                    />
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <button
                        type="button"
                        className="p-1 hover:text-slate-300 transition"
                        title="Attach document"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1 hover:text-slate-300 transition"
                        title="Voice note"
                      >
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={sending || !humanMsgText.trim()}
                    className="w-10 h-10 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white flex items-center justify-center transition shadow-lg shadow-violet-600/30 border border-violet-400/30 shrink-0"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-xs text-slate-500 space-y-2">
              <MessageSquare className="w-8 h-8 opacity-30 text-violet-400" />
              <p>Select a conversation from the list to begin inspecting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
