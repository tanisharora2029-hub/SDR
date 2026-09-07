import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client.js";
import {
  ArrowLeft,
  Mail,
  PhoneCall,
  Calendar,
  CheckCircle2,
  Sparkles,
  UserCheck,
  Send,
  Clock,
  ShieldCheck,
  Bot,
  XCircle
} from "lucide-react";

export const LeadDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replyInput, setReplyInput] = useState("");
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

  const handleSimulateReply = async () => {
    if (!id || !replyInput) return;
    setActionLoading(true);
    try {
      await api.simulateReply(id, replyInput, "EMAIL");
      setReplyInput("");
      await loadLead();
    } catch (err: any) {
      alert(err.message || "Failed to process reply");
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back button & Title */}
      <div className="flex items-center justify-between">
        <Link
          to="/leads"
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Leads</span>
        </Link>
        <div className="flex items-center gap-2">
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
            <span>{lead.isOptedOut || lead.status === "OPTED_OUT" ? "Outreach Blocked (DNC)" : "Generate Next AI Step"}</span>
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
              This lead sent an opt-out keyword (STOP) or requested to not be contacted. All pending cadence tasks are cancelled, and automated outbound communication is hard-blocked.
            </p>
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">
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
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {lead.jobTitle || "Executive"} at <span className="text-slate-200 font-semibold">{lead.companyName}</span> � {lead.email}
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-slate-400">Intent Score</p>
            <p className="text-2xl font-bold text-indigo-400">{lead.intentScore} / 100</p>
          </div>
        </div>
      </div>

      {/* Grid: Left Dossier / Right Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: BANT & Meta */}
        <div className="space-y-6">
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
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col h-[520px]">
            <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-400" />
                <span>Omnichannel Message Thread</span>
              </span>
              <span className="text-xs text-slate-400 font-normal">
                {messages.length} message{messages.length !== 1 ? "s" : ""}
              </span>
            </h2>

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
                    Send Cold Outreach Email
                  </button>
                </div>
              ) : (
                messages.map((m: any) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.direction === "OUTBOUND" ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1">
                      <span>{m.senderName}</span>
                      <span>�</span>
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div
                      className={`max-w-lg p-3.5 rounded-2xl text-xs leading-relaxed ${
                        m.direction === "OUTBOUND"
                          ? "bg-indigo-600 text-white rounded-tr-none shadow-md"
                          : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Simulate Lead Reply Box */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-400 font-medium mb-1.5">
                Simulate Prospect Incoming Reply:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  placeholder="e.g. Can we meet this Thursday at 2pm? Or: STOP"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSimulateReply}
                  disabled={actionLoading || !replyInput}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition shrink-0"
                >
                  Send Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};