$utf8NoBom = New-Object System.Text.UTF8Encoding $false

$phoneStudioTsx = @'
import React, { useEffect, useState, useRef } from "react";
import { api } from "../api/client.js";
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Bot,
  User,
  AlertCircle
} from "lucide-react";

export const PhoneStudioPage: React.FC = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [callStatus, setCallStatus] = useState<"IDLE" | "IN_PROGRESS" | "COMPLETED">("IDLE");
  const [callSid, setCallSid] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string }>>([]);
  const [userInput, setUserInput] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [callAnalysis, setCallAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    async function fetchLeads() {
      try {
        const res = await api.getLeads();
        setLeads(res.leads);
        if (res.leads.length > 0) {
          setSelectedLeadId(res.leads[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch leads for phone studio:", err);
      }
    }
    fetchLeads();
  }, []);

  useEffect(() => {
    if (callStatus === "IN_PROGRESS") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // Voice synthesis: speak SDR response
  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsAiSpeaking(true);
      utterance.onend = () => setIsAiSpeaking(false);
      utterance.onerror = () => setIsAiSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleStartCall = async () => {
    if (!selectedLeadId) return;
    setLoading(true);
    setTranscript([]);
    setCallAnalysis(null);
    setCallDuration(0);

    try {
      const res = await api.initiateCall(selectedLeadId, "OUTBOUND");
      setCallSid(res.session.callSid);
      setCallStatus("IN_PROGRESS");
      setTranscript([{ speaker: "sdr", text: res.greeting }]);
      speakText(res.greeting);
    } catch (err: any) {
      alert(err.message || "Failed to initiate call");
    } finally {
      setLoading(false);
    }
  };

  const handleSendUtterance = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!callSid || !userInput.trim()) return;

    const utterance = userInput.trim();
    setUserInput("");

    // Optimistically append lead speech
    setTranscript((prev) => [...prev, { speaker: "lead", text: utterance }]);

    try {
      const res = await api.sendCallTurn(callSid, utterance);
      setTranscript((prev) => [...prev, { speaker: "sdr", text: res.sdrSpeech }]);
      speakText(res.sdrSpeech);
    } catch (err: any) {
      console.error("Call turn failed:", err);
    }
  };

  const handleEndCall = async () => {
    if (!callSid) return;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    setLoading(true);
    try {
      const res = await api.completeCall(callSid, callDuration);
      setCallStatus("COMPLETED");
      setCallAnalysis(res.analysis);
    } catch (err: any) {
      alert(err.message || "Failed to complete call");
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
          <PhoneCall className="w-6 h-6 text-emerald-400" />
          <span>Interactive Phone Voice Studio</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Zero-cost real-time telephony simulator with speech synthesis, live transcription, and automated qualification.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Call Controls & Dialing console */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Telephony Dispatch
            </h2>

            <div>
              <label className="text-xs text-slate-300 block mb-1.5 font-medium">Select Target Lead</label>
              <select
                value={selectedLeadId}
                disabled={callStatus === "IN_PROGRESS"}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.firstName} {l.lastName} — {l.companyName} ({l.status})
                  </option>
                ))}
              </select>
            </div>

            {selectedLead && (
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                <p className="font-semibold text-slate-200">
                  {selectedLead.firstName} {selectedLead.lastName}
                </p>
                <p className="text-slate-400">{selectedLead.jobTitle || "Executive"} • {selectedLead.companyName}</p>
                <p className="text-indigo-400 font-mono text-[11px]">{selectedLead.phone || "+1 (555) 019-2834"}</p>
              </div>
            )}

            {/* Call State Display */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    callStatus === "IN_PROGRESS"
                      ? "bg-emerald-500 animate-pulse"
                      : callStatus === "COMPLETED"
                      ? "bg-blue-500"
                      : "bg-slate-600"
                  }`}
                ></span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {callStatus === "IN_PROGRESS" ? "Live Voice Stream" : callStatus}
                </span>
              </div>
              <p className="text-3xl font-mono font-bold text-slate-100">
                {formatTimer(callDuration)}
              </p>

              {/* Audio Waveform Animation when AI speaks */}
              {callStatus === "IN_PROGRESS" && (
                <div className="flex items-center justify-center gap-1 h-6">
                  {[40, 75, 90, 60, 100, 45, 80, 50].map((h, i) => (
                    <span
                      key={i}
                      className={`w-1 rounded-full bg-emerald-400 transition-all duration-150 ${
                        isAiSpeaking ? "opacity-100" : "opacity-30"
                      }`}
                      style={{
                        height: isAiSpeaking ? `${h}%` : "20%"
                      }}
                    ></span>
                  ))}
                </div>
              )}
            </div>

            {/* Primary Action Button */}
            {callStatus !== "IN_PROGRESS" ? (
              <button
                onClick={handleStartCall}
                disabled={loading || !selectedLeadId}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Place Outbound Call</span>
              </button>
            ) : (
              <button
                onClick={handleEndCall}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Call & Generate Analysis</span>
              </button>
            )}
          </div>
        </div>

        {/* Middle & Right Column: Real-Time Live Rolling Transcript & Analysis */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col h-[560px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-indigo-400" />
                <span>Live Audio Transcript & Intent Extraction</span>
              </span>
              <span className="text-[11px] text-slate-400">
                AI Voice: Natural English (Low-Latency)
              </span>
            </div>

            {/* Transcript Area */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 scrollbar-thin">
              {transcript.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                  <Bot className="w-8 h-8 mb-2 opacity-40" />
                  <p>Click "Place Outbound Call" to connect live audio session.</p>
                </div>
              ) : (
                transcript.map((turn, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${turn.speaker === "sdr" ? "items-start" : "items-end"}`}
                  >
                    <span className="text-[10px] text-slate-400 mb-0.5">
                      {turn.speaker === "sdr" ? "Alex Rivers (AI SDR)" : `${selectedLead?.firstName || "Prospect"}`}
                    </span>
                    <div
                      className={`max-w-lg p-3 rounded-xl text-xs leading-relaxed ${
                        turn.speaker === "sdr"
                          ? "bg-slate-800 text-slate-200 border border-slate-700/80 rounded-tl-none"
                          : "bg-indigo-600 text-white rounded-tr-none shadow"
                      }`}
                    >
                      <p>{turn.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Lead Speech Input Box */}
            {callStatus === "IN_PROGRESS" && (
              <form onSubmit={handleSendUtterance} className="mt-4 pt-4 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Speak or type prospect reply (e.g. Can we meet Thursday? / What about SOC2?)"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!userInput.trim()}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                >
                  Speak
                </button>
              </form>
            )}
          </div>

          {/* Post-Call Summary Card */}
          {callAnalysis && (
            <div className="p-6 rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Autonomous Call Summary & Scoring</span>
                </h3>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-xs border border-emerald-500/20">
                  Qualification Score: {callAnalysis.qualificationScore} / 100
                </span>
              </div>

              <div className="text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <p className="font-semibold text-slate-200 mb-1">Executive Summary:</p>
                <p className="leading-relaxed">{callAnalysis.summary}</p>
              </div>

              <div className="text-xs text-indigo-300 bg-indigo-500/10 p-3.5 rounded-xl border border-indigo-500/20">
                <p className="font-semibold mb-1">Recommended Next Action:</p>
                <p>{callAnalysis.recommendedAction}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
'@
[System.IO.File]::WriteAllText("D:\ai-sdr-platform\apps\frontend\src\pages\PhoneStudioPage.tsx", $phoneStudioTsx, $utf8NoBom)
Write-Host "PhoneStudioPage.tsx created"
