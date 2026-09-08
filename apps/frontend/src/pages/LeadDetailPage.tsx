import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client.js";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  XCircle,
  FlaskConical,
  Send,
  Play,
  Tag,
  FileText,
  Radio
} from "lucide-react";

export const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [operatorReply, setOperatorReply] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadLead = async () => {
    if (!id) return;
    try {
      const res = await api.getLead(id);
      setLead(res.lead);
    } catch (err) {
      console.error("Failed to load lead:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLead(null);
    setLoading(true);
    loadLead();
  }, [id]);

  const handleSendOperatorReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !operatorReply.trim()) return;
    const conversation = lead.conversations?.[0];
    if (!conversation) return;

    setActionLoading(true);
    try {
      await api.sendHumanMessage(conversation.id, operatorReply.trim());
      setOperatorReply("");
      await loadLead();
    } catch (err: any) {
      alert(err.message || "Failed to send operator message");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeAi = async () => {
    const conversation = lead?.conversations?.[0];
    if (!conversation) return;
    setActionLoading(true);
    try {
      await api.resumeAi(conversation.id);
      await loadLead();
    } catch (err: any) {
      alert(err.message || "Failed to resume AI SDR");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTriggerOutreach = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.triggerOutreach(id);
      await loadLead();
    } catch (err: any) {
      alert(err.message || "Failed to trigger outreach");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading lead dossier...</div>;
  if (!lead) return <div className="p-8 text-center text-xs text-rose-400">Lead not found.</div>;

  const bant = lead.bantScorecard ? JSON.parse(lead.bantScorecard) : null;
  const conversation = lead.conversations?.[0];
  const messages = conversation?.messages || [];
  const isAiActive = conversation ? conversation.isAiActive !== false : true;

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0">
      {/* Back button & Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/leads"
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Leads</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {/* Simulator link */}
          <Link
            to={`/lead-simulator?leadId=${lead.id}`}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition"
          >
            <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
            <span>Test as Lead in Simulator ↗</span>
          </Link>

          <button
            onClick={handleTriggerOutreach}
            disabled={actionLoading || lead.isOptedOut || lead.status === "OPTED_OUT"}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition ${
              lead.isOptedOut || lead.status === "OPTED_OUT"
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lead.isOptedOut || lead.status === "OPTED_OUT" ? "Outreach Blocked (DNC)" : "Trigger AI Cold Outreach"}</span>
          </button>
        </div>
      </div>

      {/* DNC Opt-out Alert Banner */}
      {(lead.isOptedOut || lead.status === "OPTED_OUT") && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <p className="font-semibold text-rose-200">Do Not Contact (DNC) / Opted Out</p>
            <p className="text-rose-300/80 mt-0.5">
              This lead sent an opt-out keyword (STOP) or requested to not be contacted. All automated outbound communication is hard-blocked.
            </p>
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
              {lead.firstName} {lead.lastName}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                lead.status === "QUALIFIED"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : lead.status === "HANDOFF_REQUIRED"
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  : lead.status === "IN_CONVERSATION"
                  ? "bg-violet-500/10 text-violet-400 border border-violet-500/30"
                  : lead.status === "OPTED_OUT" || lead.isOptedOut
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {lead.isOptedOut || lead.status === "OPTED_OUT" ? "OPTED OUT / DNC" : lead.status.replace("_", " ")}
            </span>

            {lead.source && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                Source: {lead.source}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {lead.jobTitle || "Executive"} at <span className="text-slate-200 font-semibold">{lead.companyName}</span> • {lead.email} • {lead.phone || "No phone"}
          </p>

          {lead.tags && (
            <div className="flex items-center gap-1.5 mt-2.5">
              <Tag className="w-3 h-3 text-slate-500" />
              <div className="flex flex-wrap gap-1">
                {lead.tags.split(",").map((tag: string, i: number) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 self-start md:self-auto">
          <div className="text-left md:text-right">
            <p className="text-xs text-slate-400">Intent Score</p>
            <p className="text-xl sm:text-2xl font-bold text-indigo-400">{lead.intentScore} / 100</p>
          </div>
        </div>
      </div>

      {/* Grid: Left Dossier / Right Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: BANT & Meta */}
        <div className="space-y-6">
          {/* Notes */}
          {lead.notes && (
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
              <h2 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Account Notes</span>
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                {lead.notes}
              </p>
            </div>
          )}

          {/* BANT Scorecard */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>BANT Qualification Scorecard</span>
            </h2>

            {bant ? (
              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block font-medium">Budget:</span>
                  <p className="text-slate-200 mt-0.5">{String(bant.budget || "Pending verification")}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block font-medium">Authority:</span>
                  <p className="text-slate-200 mt-0.5">{String(bant.authority || "Pending verification")}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block font-medium">Need:</span>
                  <p className="text-slate-200 mt-0.5">{String(bant.need || "Pending verification")}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block font-medium">Timeline:</span>
                  <p className="text-slate-200 mt-0.5">{String(bant.timeline || "Pending verification")}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                No BANT scorecard generated yet. Engage lead in conversation to extract qualification criteria.
              </p>
            )}
          </div>

          {/* Booked Appointments */}
          {lead.appointments && lead.appointments.length > 0 && (
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
              <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Confirmed Meeting</span>
              </h2>
              {lead.appointments.map((appt: any) => (
                <div key={appt.id} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                  <p className="font-semibold text-amber-300">{appt.title}</p>
                  <p className="text-slate-300 mt-1">
                    {new Date(appt.scheduledAt).toLocaleString()} ({appt.durationMinutes} mins)
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Communication History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col h-[600px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Mail className="w-4 h-4 text-indigo-400" />
                <span>Omnichannel Conversation Thread</span>
              </span>
              <div className="flex items-center gap-2">
                {!isAiActive ? (
                  <button
                    onClick={handleResumeAi}
                    disabled={actionLoading}
                    className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1 hover:bg-amber-500/30 transition"
                  >
                    <Play className="w-3 h-3 text-amber-400" />
                    <span>AI Paused — Resume AI SDR</span>
                  </button>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    AI SDR Active
                  </span>
                )}
                <span className="text-xs text-slate-500 font-normal">
                  {messages.length} message{messages.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 scrollbar-thin">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                  <Bot className="w-8 h-8 mb-2 opacity-50" />
                  <p>No messages exchanged with this lead yet.</p>
                  <button
                    onClick={handleTriggerOutreach}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition"
                  >
                    Trigger AI Cold Outreach
                  </button>
                </div>
              ) : (
                messages.map((m: any) => {
                  const role = m.senderRole || (m.direction === "INBOUND" ? "LEAD" : "AI");
                  const isLead = role === "LEAD";
                  const isHuman = role === "HUMAN";
                  const isAi = role === "AI";

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        isLead ? "items-start" : "items-end"
                      }`}
                    >
                      {/* Sender Meta Badges */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                        {isHuman && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            HUMAN TAKEOVER
                          </span>
                        )}
                        {isAi && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30 flex items-center gap-1">
                            <Bot className="w-2.5 h-2.5" />
                            AI SDR (Alex)
                          </span>
                        )}
                        {isLead && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            PROSPECT ({lead.firstName})
                          </span>
                        )}
                        <span className="text-slate-300 font-medium">{m.senderName}</span>
                        <span>•</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {m.channel && (
                          <span className="text-slate-500 uppercase text-[9px] font-mono">[{m.channel}]</span>
                        )}
                      </div>

                      {/* Bubble */}
                      <div
                        className={`max-w-lg p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isHuman
                            ? "bg-amber-600/90 text-white rounded-tr-none shadow-md border border-amber-500/40"
                            : isAi
                            ? "bg-indigo-600 text-white rounded-tr-none shadow-md"
                            : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Operator Human Takeover Reply Box */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reply as Workspace Operator (Human Takeover)</span>
                </span>
                <Link
                  to={`/lead-simulator?leadId=${lead.id}`}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 underline"
                >
                  <FlaskConical className="w-3 h-3" />
                  <span>Want to test prospect replies? Open Lead Simulator ↗</span>
                </Link>
              </div>

              <form onSubmit={handleSendOperatorReply} className="flex gap-2">
                <input
                  type="text"
                  value={operatorReply}
                  onChange={(e) => setOperatorReply(e.target.value)}
                  placeholder={`Send an official human reply to ${lead.firstName}... (Pauses AI automated replies)`}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={actionLoading || !operatorReply.trim() || !conversation}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition shrink-0 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send as You</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
