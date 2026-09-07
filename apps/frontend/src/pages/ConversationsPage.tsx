import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import {
  MessageSquare,
  Bot,
  User,
  Send,
  Sparkles,
  PhoneCall,
  Clock,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";

export const ConversationsPage: React.FC = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [humanMsgText, setHumanMsgText] = useState("");
  const [sending, setSending] = useState(false);

  const loadConversations = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.conversations);
      if (res.conversations.length > 0 && !selectedId) {
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

  const handleSelectConversation = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setActiveConv(null);
    setReplyText("");
    setHumanMsgText("");
  };

  const handleSimulateReply = async () => {
    if (!activeConv?.leadId || !activeConv?.id || !replyText) return;
    const targetLeadId = activeConv.leadId;
    const targetConvId = activeConv.id;
    const targetChannel = activeConv.channel;
    const textToSend = replyText;
    setSending(true);
    try {
      await api.simulateReply(targetLeadId, textToSend, targetChannel);
      setReplyText("");
      const res = await api.getConversation(targetConvId);
      setActiveConv(res.conversation);
      const listRes = await api.getConversations();
      setConversations(listRes.conversations);
    } catch (err: any) {
      alert(err.message || "Failed to process reply");
    } finally {
      setSending(false);
    }
  };

  const handleSendHumanMessage = async () => {
    if (!activeConv?.id || !humanMsgText) return;
    const targetConvId = activeConv.id;
    const textToSend = humanMsgText;
    setSending(true);
    try {
      await api.sendHumanMessage(targetConvId, textToSend);
      setHumanMsgText("");
      const res = await api.getConversation(targetConvId);
      setActiveConv(res.conversation);
      const listRes = await api.getConversations();
      setConversations(listRes.conversations);
    } catch (err: any) {
      alert(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Omnichannel Inbox</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Live unified stream of autonomous SDR email, WhatsApp, and phone dialogues.
        </p>
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex">
        {/* Left: Threads list */}
        <div className="w-80 border-r border-slate-800 flex flex-col h-full bg-slate-950/40">
          <div className="p-3.5 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            All Conversations ({conversations.length})
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
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {c.channel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">{c.lead?.companyName}</p>
                {c.lead?.isOptedOut || c.lead?.status === "OPTED_OUT" ? (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1 font-medium mt-1">
                    <AlertTriangle className="w-3 h-3" /> Opted Out (DNC)
                  </span>
                ) : c.isEscalated ? (
                  <span className="text-[10px] text-amber-400 flex items-center gap-1 font-medium mt-1">
                    <AlertTriangle className="w-3 h-3" /> Escalation Active
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Active Message Thread */}
        <div className="flex-1 flex flex-col h-full bg-slate-900/60">
          {activeConv ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                <div>
                  <h2 className="font-semibold text-sm text-slate-100">
                    {activeConv.lead?.firstName} {activeConv.lead?.lastName} ({activeConv.lead?.companyName})
                  </h2>
                  <p className="text-xs text-slate-400">{activeConv.lead?.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {activeConv.lead?.isOptedOut || activeConv.lead?.status === "OPTED_OUT" ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      OPTED OUT / DNC
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        activeConv.isAiActive
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {activeConv.isAiActive ? "AI SDR Handling" : "Human Takeover"}
                    </span>
                  )}
                </div>
              </div>

              {/* Messages Flow */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
                {activeConv.messages?.map((m: any) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.direction === "OUTBOUND" ? "items-end" : "items-start"
                    }`}
                  >
                    <span className="text-[11px] text-slate-400 mb-1">
                      {m.senderName} � {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div
                      className={`max-w-xl p-3.5 rounded-2xl text-xs leading-relaxed ${
                        m.direction === "OUTBOUND"
                          ? "bg-indigo-600 text-white rounded-tr-none shadow"
                          : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Controls */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
                {/* Simulate Inbound Lead Reply */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Simulate prospect reply (e.g. What about pricing? / STOP)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleSimulateReply}
                    disabled={sending || !replyText}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shrink-0"
                  >
                    Simulate Reply
                  </button>
                </div>

                {/* Human Takeover Send */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={humanMsgText}
                    onChange={(e) => setHumanMsgText(e.target.value)}
                    placeholder="Manual sales rep reply (takes over AI thread)..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleSendHumanMessage}
                    disabled={sending || !humanMsgText}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition shrink-0"
                  >
                    Send as Human
                  </button>
                </div>
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