import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import {
  FlaskConical,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
  User,
  Bot,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Phone,
  ShieldAlert,
  Info
} from "lucide-react";

export const LeadSimulatorPage: React.FC = () => {
  const { organization } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>(searchParams.get("leadId") || "");
  const [channel, setChannel] = useState<"EMAIL" | "SMS" | "WHATSAPP">("EMAIL");
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const selectedLeadIdRef = React.useRef(selectedLeadId);
  useEffect(() => {
    selectedLeadIdRef.current = selectedLeadId;
  }, [selectedLeadId]);

  const loadData = async () => {
    try {
      const res = await api.getSimulatorLeads();
      const fetchedLeads = res.leads || [];
      setLeads(fetchedLeads);
      if (!selectedLeadIdRef.current && fetchedLeads.length > 0) {
        setSelectedLeadId(fetchedLeads[0].id);
      }
    } catch (err) {
      console.error("Failed to load simulator leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedLead = leads.find((l) => l.id === selectedLeadId);
  const activeConversation = selectedLead?.conversations?.find((c: any) => c.channel === channel) || selectedLead?.conversations?.[0];
  const messages = activeConversation?.messages || [];

  const handleSelectLead = (id: string) => {
    setSelectedLeadId(id);
    setSearchParams({ leadId: id });
    setLastResult(null);
  };

  const handleSendAsLead = async (text?: string) => {
    const contentToSend = text || replyText;
    if (!selectedLeadId || !contentToSend.trim() || sending) return;

    setSending(true);
    setLastResult(null);
    try {
      const res = await api.simulateReply(selectedLeadId, contentToSend.trim(), channel);
      setLastResult(res.result);
      setReplyText("");

      // Optimistically update local conversation messages immediately
      if (res.result?.inboundMsg || res.result?.outboundMsg) {
        setLeads((prevLeads) =>
          prevLeads.map((l) => {
            if (l.id !== selectedLeadId) return l;
            const convs = l.conversations || [];
            const targetConvId = res.result?.inboundMsg?.conversationId;
            let convFound = false;
            const updatedConvs = convs.map((c: any) => {
              if (c.id === targetConvId || c.channel === channel) {
                convFound = true;
                const newMsgs = [...(c.messages || [])];
                if (res.result?.inboundMsg && !newMsgs.some((m: any) => m.id === res.result.inboundMsg.id)) {
                  newMsgs.push(res.result.inboundMsg);
                }
                if (res.result?.outboundMsg && !newMsgs.some((m: any) => m.id === res.result.outboundMsg.id)) {
                  newMsgs.push(res.result.outboundMsg);
                }
                return { ...c, messages: newMsgs };
              }
              return c;
            });
            if (!convFound && (res.result?.inboundMsg || res.result?.outboundMsg)) {
              const initialMsgs = [];
              if (res.result.inboundMsg) initialMsgs.push(res.result.inboundMsg);
              if (res.result.outboundMsg) initialMsgs.push(res.result.outboundMsg);
              updatedConvs.push({
                id: targetConvId || `conv_${Date.now()}`,
                channel,
                organizationId: l.organizationId,
                leadId: l.id,
                messages: initialMsgs
              });
            }
            return { ...l, conversations: updatedConvs };
          })
        );
      }

      // Non-blocking refresh so send state is released immediately
      loadData().catch(() => {});
    } catch (err: any) {
      alert(err.message || "Failed to deliver lead reply");
    } finally {
      setSending(false);
    }
  };

  // Real-time synchronization via WebSocket & 4s polling
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
          if (data.type === "MESSAGE_CREATED" || data.type === "CONVERSATION_UPDATED") {
            loadData();
          }
        } catch (e) {}
      };
    } catch (err) {}

    const interval = setInterval(() => {
      loadData();
    }, 4000);

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [organization?.id]);

  const presets = [
    {
      label: "Ask about Pricing",
      text: "Sounds interesting. Can you tell me about pricing?"
    },
    {
      label: "Request Demo Tuesday 3 PM",
      text: "I would like to schedule a demo next Tuesday at 3 PM. Can you book it for me?"
    },
    {
      label: "Competitor Objection",
      text: "We currently use Outreach. Why should we consider switching to NexSDR?"
    },
    {
      label: "Follow-up in 3 days",
      text: "Not ready to buy yet. Please follow up with me in 3 days."
    },
    {
      label: "Unsubscribe (STOP)",
      text: "STOP"
    }
  ];

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Loading test lead simulator sandbox...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0">
      {/* Dev-Only Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <FlaskConical className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                [DEV]
              </span>
              <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Lead Simulator (Testing Tool)
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                EXTERNAL PROSPECT PERSPECTIVE
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              This sandbox isolates the external prospect experience for testing. You are viewing and interacting with the system as a real lead (e.g. Rahul Sharma). Messages sent from here enter NexSDR as genuine <span className="font-semibold text-emerald-400">INBOUND LEAD</span> replies. Production inbound uses real email mailboxes via Resend.
            </p>
          </div>
        </div>

        {activeConversation && (
          <Link
            to="/conversations"
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 self-start md:self-auto shrink-0 border border-slate-700"
          >
            <span>Open in CRM Inbox</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Lead & Channel Selector */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              1. Choose Test Prospect Identity
            </h2>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Select External Lead</label>
              <select
                value={selectedLeadId}
                onChange={(e) => handleSelectLead(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.firstName} {l.lastName} — {l.companyName} ({l.email})
                  </option>
                ))}
              </select>
            </div>

            {selectedLead && (
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    {selectedLead.firstName} {selectedLead.lastName}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      selectedLead.isOptedOut || selectedLead.status === "OPTED_OUT"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {selectedLead.isOptedOut || selectedLead.status === "OPTED_OUT" ? "DNC / OPTED OUT" : selectedLead.status}
                  </span>
                </div>
                <p className="text-slate-400">{selectedLead.jobTitle || "Executive"} • {selectedLead.companyName}</p>
                <div className="font-mono text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-800/60">
                  <p>Email: {selectedLead.email}</p>
                  <p>Phone: {selectedLead.phone || "Not registered"}</p>
                  <p>Source: {selectedLead.source || "MANUAL"}</p>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Simulated Channel</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setChannel("EMAIL")}
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    channel === "EMAIL"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("SMS")}
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    channel === "SMS"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>SMS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("WHATSAPP")}
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    channel === "WHATSAPP"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Preset Replies */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              1-Click Test Scenarios
            </h2>
            <p className="text-[11px] text-slate-400">
              Click any realistic prospect utterance to simulate an external inbound reply immediately:
            </p>
            <div className="space-y-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendAsLead(p.text)}
                  disabled={sending}
                  className="w-full text-left p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 transition text-xs text-slate-300 flex items-center justify-between group"
                >
                  <span className="font-medium group-hover:text-indigo-300">{p.label}</span>
                  <span className="text-[10px] text-slate-500 font-mono">Send ↵</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Middle & Right Column: Prospect's Received Screen & Reply Composer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col h-[580px]">
            {/* Prospect Device Header */}
            <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="text-xs font-bold text-slate-200">
                  {selectedLead ? `${selectedLead.firstName}'s ${channel} Client` : "Prospect Client"}
                </span>
              </div>
              <button
                onClick={loadData}
                className="p-1.5 text-slate-400 hover:text-slate-200 transition"
                title="Refresh thread"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Conversation Stream from Prospect's View */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs space-y-2">
                  <Info className="w-6 h-6 text-slate-600" />
                  <p>No messages exchanged with this lead yet.</p>
                  <p className="text-[11px] text-slate-600">
                    Use the composer below or trigger cold outreach from the CRM.
                  </p>
                </div>
              ) : (
                messages.map((m: any) => {
                  const isLead = m.senderRole === "LEAD" || m.direction === "INBOUND";
                  const isHuman = m.senderRole === "HUMAN";
                  const isAi = m.senderRole === "AI";

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isLead ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                        {isLead ? (
                          <>
                            <span className="font-semibold text-emerald-400">You ({selectedLead?.firstName})</span>
                            <User className="w-3 h-3 text-emerald-400" />
                          </>
                        ) : isHuman ? (
                          <>
                            <User className="w-3 h-3 text-amber-400" />
                            <span className="font-semibold text-amber-300">{m.senderName} (Human Rep)</span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-3 h-3 text-indigo-400" />
                            <span className="font-semibold text-indigo-300">{m.senderName} (AI SDR)</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="font-mono text-[10px]">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div
                        className={`max-w-lg p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isLead
                            ? "bg-emerald-600/90 text-white rounded-tr-none shadow"
                            : isHuman
                            ? "bg-amber-950/60 border border-amber-500/40 text-amber-100 rounded-tl-none shadow"
                            : "bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none shadow"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Inbound Reply Composer */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!sending && replyText.trim() && selectedLeadId) {
                        handleSendAsLead();
                      }
                    }
                  }}
                  placeholder={`Reply as ${selectedLead?.firstName || "Lead"} (Press Enter to send, Shift+Enter for new line)...`}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
                />
                <button
                  onClick={() => handleSendAsLead()}
                  disabled={sending || !replyText.trim() || !selectedLeadId}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition flex flex-col items-center justify-center gap-1 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>Send as Lead</span>
                </button>
              </div>

              {lastResult && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Inbound reply ingested into NexSDR as LEAD</span>
                  </div>
                  {lastResult.outboundMsg && (
                    <p className="text-slate-300 text-[11px] pt-1 border-t border-slate-800">
                      <span className="font-semibold text-indigo-400">AI SDR Auto-Replied: </span>
                      "{lastResult.outboundMsg.content}"
                    </p>
                  )}
                  {lastResult.optedOut && (
                    <p className="text-rose-400 text-[11px]">
                      Lead has been marked as OPTED OUT. All upcoming cadences cancelled.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
