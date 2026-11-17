import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.js";
import { VoiceSessionController, VoiceState } from "../lib/voiceSessionController.js";
import { VoiceOrb, VoiceOrbState } from "../components/ui/VoiceOrb.js";
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
  Zap,
  Radio,
  Sliders,
  AlertCircle,
  Headphones,
  UserCheck,
  Target
} from "lucide-react";

interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  gender: string;
}

export const PhoneStudioPage: React.FC = () => {
  const { organization } = useAuth();
  const [sdrProfile, setSdrProfile] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [callStatus, setCallStatus] = useState<"IDLE" | "IN_PROGRESS" | "COMPLETED">("IDLE");
  const [callSid, setCallSid] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string; timestamp?: number }>>([]);
  const [userInput, setUserInput] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [callAnalysis, setCallAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  // Robust Voice Session Controller instance
  const controllerRef = useRef<VoiceSessionController | null>(null);

  // Real-Time Voice State Machine (IDLE -> LISTENING -> SPEAKING_DETECTED -> PROCESSING -> AI_SPEAKING -> INTERRUPTED)
  const [voiceState, setVoiceState] = useState<VoiceState>("IDLE");
  const voiceStateRef = useRef<VoiceState>("IDLE");
  voiceStateRef.current = voiceState;

  // Audio & Microphone States
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState(0); // 0 to 100
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [bargeInOccurred, setBargeInOccurred] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Whisper Mode Assist & Takeover Telemetry
  const [whisperDossier, setWhisperDossier] = useState<any | null>(null);
  const [isHumanTakeover, setIsHumanTakeover] = useState<boolean>(false);

  // Neural Voice Selection
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("en-IN-NeerjaNeural");

  // Refs for audio hardware, streams, and timers
  const timerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const accumulatedTranscriptRef = useRef<string>("");
  const isAiSpeakingRef = useRef<boolean>(false);

  isAiSpeakingRef.current = isAiSpeaking;

  // Load leads and available neural voices
  useEffect(() => {
    async function initData() {
      try {
        const [leadsRes, voicesRes, sdrRes] = await Promise.all([
          api.getLeads(),
          api.getVoices().catch(() => ({ voices: [] })),
          api.getSdr().catch(() => null)
        ]);

        if (sdrRes?.sdr) {
          setSdrProfile(sdrRes.sdr);
        }

        setLeads(leadsRes.leads || []);
        if (leadsRes.leads?.length > 0) {
          setSelectedLeadId(leadsRes.leads[0].id);
        }

        if (voicesRes.voices?.length > 0) {
          setVoices(voicesRes.voices);
          setSelectedVoice(voicesRes.voices[0].id);
        }
      } catch (err) {
        console.error("Failed to load leads or voices:", err);
      }
    }
    initData();

    // Enumerate audio input devices
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const audioInputs = devices.filter((d) => d.kind === "audioinput");
        setAudioDevices(audioInputs);
        if (audioInputs.length > 0) {
          setSelectedDeviceId(audioInputs[0].deviceId);
        }
      }).catch(console.warn);
    }

    return () => {
      stopAudioCapture();
      stopAiSpeech();
    };
  }, []);

  // Call duration counter
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

  // Stop active AI speech playback
  const stopAiSpeech = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsAiSpeaking(false);
  }, []);

  // Stop microphone capture & analyser
  const stopAudioCapture = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setMicVolumeLevel(0);
    setIsUserSpeaking(false);
  }, []);

  // Start real microphone capture with real-time VU meter and VAD
  const startAudioCapture = async (deviceId?: string) => {
    try {
      stopAudioCapture();

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolumeLevel(normalized);

        // VAD: Speech detection thresholds
        const speechThreshold = 16;
        const bargeInThreshold = 30; // Higher threshold during AI speech to prevent speaker acoustic feedback

        if (normalized > speechThreshold) {
          setIsUserSpeaking(true);
        } else {
          setIsUserSpeaking(false);
        }

        // Real-time Barge-In: If AI is speaking and user begins talking, interrupt AI audio
        if (normalized > bargeInThreshold) {
          if (controllerRef.current && controllerRef.current.state === "AI_SPEAKING") {
            console.log("⚡ Barge-in detected: Spoken audio exceeded threshold during AI playback.");
            controllerRef.current.stopAudioPlayback();
            setBargeInOccurred(true);
            setTimeout(() => setBargeInOccurred(false), 2500);
          }
        }

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      animFrameRef.current = requestAnimationFrame(updateMeter);
      setMicError(null);
    } catch (err: any) {
      console.warn("Microphone access not granted or not available:", err);
      setMicError("Microphone unavailable or permission denied. You can still type prospect responses below.");
    }
  };

  // Toggle Microphone Mute
  const toggleMicMute = () => {
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      const newMuted = !isMicMuted;
      audioTracks.forEach((t) => (t.enabled = !newMuted));
      setIsMicMuted(newMuted);
    }
  };

  // Start Call with autonomous VoiceSessionController
  const handleStartCall = async () => {
    if (!selectedLeadId) return;
    setLoading(true);
    setVoiceError(null);
    setTranscript([]);
    setCallAnalysis(null);
    setCallDuration(0);
    setLastLatencyMs(null);
    setWhisperDossier(null);
    setIsHumanTakeover(false);

    try {
      const res = await api.initiateCall(selectedLeadId, "OUTBOUND");
      setCallSid(res.session.callSid);
      setCallStatus("IN_PROGRESS");

      // Start hardware audio capture & meter
      await startAudioCapture(selectedDeviceId);

      // Fetch neural greeting audio blob
      let greetingBlob: Blob | undefined;
      try {
        greetingBlob = await api.fetchTtsAudio(res.greeting, selectedVoice);
      } catch (e) {
        console.warn("Greeting TTS fetch failed, using fallback:", e);
      }

      // Initialize robust VoiceSessionController (fixes Turn 2 failure)
      const controller = new VoiceSessionController({
        onStateChange: (state, log) => {
          setVoiceState(state);
          setIsAiSpeaking(state === "AI_SPEAKING");
          if (log.llmDurationMs || log.sttDurationMs) {
            setLastLatencyMs((log.llmDurationMs || 0) + (log.sttDurationMs || 0));
          }
        },
        onTranscriptUpdate: (speaker, text) => {
          setTranscript((prev) => [...prev, { speaker, text, timestamp: Date.now() }]);
        },
        onError: (errStr) => {
          setVoiceError(errStr);
        },
        sendTurnBackend: async (_turnId, utterance) => {
          setVoiceError(null);
          const t0 = performance.now();
          const turnRes = await api.sendCallTurn(res.session.callSid, utterance);
          const llmLatency = Math.round(performance.now() - t0);

          // Update live Whisper Mode telemetry
          if (turnRes.whisperDossier) {
            setWhisperDossier(turnRes.whisperDossier);
          }

          // If human has taken over, AI is silenced
          if (turnRes.isHumanTakeover) {
            setIsHumanTakeover(true);
            return {
              sdrSpeech: "",
              audioBlob: undefined,
              sttLatencyMs: turnRes.sttLatencyMs || 0,
              latencyMs: llmLatency
            };
          }

          let audioBlob: Blob | undefined;
          try {
            audioBlob = await api.fetchTtsAudio(turnRes.sdrSpeech, selectedVoice);
          } catch (e) {
            console.warn("Turn TTS fetch failed, will use fallback:", e);
          }

          return {
            sdrSpeech: turnRes.sdrSpeech,
            audioBlob,
            sttLatencyMs: turnRes.sttLatencyMs || 0,
            latencyMs: llmLatency
          };
        }
      });

      controllerRef.current = controller;
      await controller.startSession(res.session.callSid, res.greeting, greetingBlob);
    } catch (err: any) {
      alert(err.message || "Failed to initiate call");
    } finally {
      setLoading(false);
    }
  };

  // Toggle Human Rep Takeover (Whisper Mode)
  const handleToggleTakeover = async () => {
    if (!callSid) return;
    try {
      const nextTakeover = !isHumanTakeover;
      await api.setCallTakeover(callSid, nextTakeover);
      setIsHumanTakeover(nextTakeover);
      if (nextTakeover && controllerRef.current) {
        controllerRef.current.stopAudioPlayback();
      }
    } catch (err: any) {
      console.error("Takeover toggle error:", err);
    }
  };

  // Send turn (Manual Fallback: Spoken or Typed)
  const handleSendUtterance = async (overrideText?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const utterance = (overrideText || userInput).trim();
    if (!callSid || !utterance) return;
    setUserInput("");

    if (controllerRef.current) {
      controllerRef.current.manualSubmitUtterance(utterance);
    }
  };

  // End Call
  const handleEndCall = async () => {
    if (!callSid) return;
    if (controllerRef.current) {
      controllerRef.current.endSession();
      controllerRef.current = null;
    }
    stopAudioCapture();
    setVoiceState("IDLE");
    setIsAiSpeaking(false);

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

  const sdrName = sdrProfile?.personaName || "Alex";
  const orgName = organization?.name || sdrProfile?.organizationName || "NexSDR";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-emerald-400 animate-pulse" />
            <h1 className="text-2xl font-bold text-slate-100">
              Browser Voice Simulation
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              [Test Call — You are acting as the lead]
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Browser audio engine using your local microphone, hardware VU meter, voice activity detection (VAD), instant barge-in, and neural TTS synthesis (Zero carrier cost).
          </p>
          <Link to="/settings#business-profile" className="mt-2 inline-block text-sm text-indigo-300">
            Set up your business profile
          </Link>
        </div>

        {/* Live Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Real-time Voice State Machine Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            voiceState === "LISTENING"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : voiceState === "SPEAKING_DETECTED"
              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 animate-pulse"
              : voiceState === "PROCESSING"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse"
              : voiceState === "AI_SPEAKING"
              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 animate-pulse"
              : voiceState === "INTERRUPTED"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
              : "bg-slate-900 border-slate-800 text-slate-400"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              voiceState === "LISTENING" ? "bg-emerald-400" :
              voiceState === "SPEAKING_DETECTED" ? "bg-cyan-400 animate-ping" :
              voiceState === "PROCESSING" ? "bg-amber-400" :
              voiceState === "AI_SPEAKING" ? "bg-indigo-400" :
              voiceState === "INTERRUPTED" ? "bg-rose-400" : "bg-slate-500"
            }`} />
            <span>State: {voiceState}</span>
          </div>

          {bargeInOccurred && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold animate-bounce">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Barge-in Interrupted SDR</span>
            </div>
          )}
          {lastLatencyMs && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>{lastLatencyMs}ms latency</span>
            </div>
          )}
        </div>
      </div>

      {micError && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{micError}</span>
        </div>
      )}

      {/* Test Call Role Context Banner */}
      <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-semibold text-indigo-200">
              🎙️ Test Call Mode — You are acting as the Lead
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-slate-400">
              AI SDR: <strong className="text-indigo-300">{sdrName} ({orgName})</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              Your Role: <strong className="text-emerald-300">Acting as {selectedLead ? `${selectedLead.firstName} ${selectedLead.lastName} (Prospect)` : "Prospect"}</strong>
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          Speak directly into your microphone as the prospect. The AI SDR listens, processes objections, and responds in real-time with zero carrier expense.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Call Controls, Mic Monitor, & Device Settings */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/40 space-y-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span>Telephony Dispatch</span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30">
                Neural Engine
              </span>
            </h2>

            {/* Target Lead Selector */}
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

            {/* SDR Neural Voice Selection */}
            <div>
              <label className="text-xs text-slate-300 block mb-1.5 font-medium flex items-center justify-between">
                <span>SDR Neural Voice</span>
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
              </label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {voices.length > 0 ? (
                  voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="en-IN-NeerjaNeural">Neerja (Indian English - Female)</option>
                    <option value="en-IN-PrabhatNeural">Prabhat (Indian English - Male)</option>
                    <option value="en-US-JennyNeural">Jenny (US English - Female)</option>
                    <option value="en-US-GuyNeural">Guy (US English - Male)</option>
                    <option value="hi-IN-SwaraNeural">Swara (Hindi - Female)</option>
                  </>
                )}
              </select>
            </div>

            {/* Hardware Microphone Selector */}
            {audioDevices.length > 0 && (
              <div>
                <label className="text-xs text-slate-300 block mb-1.5 font-medium">Input Microphone</label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value);
                    if (callStatus === "IN_PROGRESS") {
                      startAudioCapture(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Call State Display & Real-Time Audio Level Meter */}
            <div className="p-5 rounded-2xl bg-[#0e0e1a]/80 backdrop-blur-xl border border-white/[0.08] text-center space-y-3 shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      callStatus === "IN_PROGRESS"
                        ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"
                        : callStatus === "COMPLETED"
                        ? "bg-blue-400"
                        : "bg-slate-600"
                    }`}
                  ></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    {callStatus === "IN_PROGRESS" ? "Live Voice Stream" : callStatus}
                  </span>
                </div>
                {callStatus === "IN_PROGRESS" && (
                  <button
                    onClick={toggleMicMute}
                    className={`p-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
                      isMicMuted
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
                    }`}
                    title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                  >
                    {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{isMicMuted ? "Muted" : "Live"}</span>
                  </button>
                )}
              </div>

              {/* Central 3D Reactive VoiceOrb */}
              <div className="py-1">
                <VoiceOrb
                  state={
                    voiceState === "AI_SPEAKING"
                      ? "speaking"
                      : voiceState === "PROCESSING"
                      ? "thinking"
                      : voiceState === "LISTENING" || voiceState === "SPEAKING_DETECTED"
                      ? "listening"
                      : "idle"
                  }
                  audioLevel={micVolumeLevel / 100}
                  size={150}
                  className="mx-auto"
                />
              </div>

              <p className="text-3xl font-mono font-bold text-white tracking-tight">
                {formatTimer(callDuration)}
              </p>

              {/* Real-time Hardware VU Meter */}
              {callStatus === "IN_PROGRESS" && (
                <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Mic className="w-3 h-3 text-emerald-400" />
                      <span>Mic VU: {isMicMuted ? "MUTED" : `${micVolumeLevel}%`}</span>
                    </span>
                    <span className={isUserSpeaking ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      {isUserSpeaking ? "Spoken Audio Detected" : "VAD: Listening..."}
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-75 rounded-full ${
                        isMicMuted
                          ? "bg-rose-500 w-0"
                          : micVolumeLevel > 70
                          ? "bg-rose-500"
                          : micVolumeLevel > 35
                          ? "bg-amber-400"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${isMicMuted ? 0 : micVolumeLevel}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* SDR Output Waveform Animation */}
              {callStatus === "IN_PROGRESS" && (
                <div className="flex items-center justify-center gap-1 h-5 pt-1">
                  <span className="text-[10px] text-slate-400 mr-2">SDR Voice:</span>
                  {[40, 75, 90, 60, 100, 45, 80, 50].map((h, i) => (
                    <span
                      key={i}
                      className={`w-1 rounded-full bg-indigo-400 transition-all duration-150 ${
                        isAiSpeaking ? "opacity-100" : "opacity-30"
                      }`}
                      style={{
                        height: isAiSpeaking ? `${h}%` : "25%"
                      }}
                    ></span>
                  ))}
                </div>
              )}
            </div>

            {/* Primary Call Action Button & Whisper Mode Controls */}
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
              <div className="space-y-2">
                <button
                  onClick={handleToggleTakeover}
                  className={`w-full py-2.5 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 border ${
                    isHumanTakeover
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                      : "bg-indigo-600/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/30"
                  }`}
                >
                  <Headphones className="w-4 h-4" />
                  <span>{isHumanTakeover ? "Takeover Active: AI Muted (Release)" : "Whisper Mode: Take Control (Mute AI)"}</span>
                </button>

                <button
                  onClick={handleEndCall}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Call & Generate Analysis</span>
                </button>
              </div>
            )}

            {/* Live Whisper Mode Assist Panel */}
            {callStatus === "IN_PROGRESS" && whisperDossier && (
              <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/30 space-y-2.5 shadow-lg animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                    <Headphones className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Whisper Assist Live</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    isHumanTakeover ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300"
                  }`}>
                    {isHumanTakeover ? "REP SPEAKING (AI MUTED)" : "AI DRIVING"}
                  </span>
                </div>

                <div className="text-[11px] space-y-2">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Detected Objection:</span>
                    <span className="text-slate-200 font-medium">{whisperDossier.detectedObjection}</span>
                  </div>

                  {whisperDossier.competitorMentioned && (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-200">
                      <span className="font-semibold block text-[10px]">Competitor: {whisperDossier.competitorMentioned}</span>
                      <span className="text-[10px] text-amber-300/80">Only verified facts retrieved. Do not guess unverified features.</span>
                    </div>
                  )}

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Talking Points:</span>
                    <ul className="list-disc list-inside text-slate-300 text-[10px] space-y-1">
                      {whisperDossier.recommendedTalkingPoints?.map((tp: string, idx: number) => (
                        <li key={idx}>{tp}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-indigo-400 block text-[10px] uppercase tracking-wider font-semibold mb-1">Suggested Rep Response:</span>
                    <p className="text-slate-200 text-[11px] italic leading-relaxed">"{whisperDossier.suggestedResponse}"</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle & Right Column: Rolling Transcript, Live Utterances, & AI Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-[#0e0e1a]/70 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/40 flex flex-col h-[580px]">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-violet-400" />
                <span>Live Audio Transcript & Intent Extraction</span>
              </span>
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse"></span>
                <span className="text-emerald-300 font-semibold">Neural Audio Stream</span>
              </span>
            </div>

            {voiceError && <p role="alert" className="mb-3 rounded-lg bg-red-950/50 p-3 text-sm text-red-200">{voiceError}</p>}
            {/* Transcript Area */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 scrollbar-thin">
              {transcript.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                  <Bot className="w-8 h-8 mb-2 opacity-30 text-violet-400" />
                  <p>Select a lead and click "Place Outbound Call" to connect real voice stream.</p>
                </div>
              ) : (
                transcript.map((turn, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${turn.speaker === "sdr" ? "items-start" : "items-end"}`}
                  >
                    <span className="text-[10px] text-slate-400 mb-0.5 flex items-center gap-1">
                      {turn.speaker === "sdr" ? (
                        <>
                          <Bot className="w-3 h-3 text-violet-400" />
                          <span className="text-violet-300 font-semibold">{sdrName} (AI SDR @ {orgName})</span>
                        </>
                      ) : (
                        <>
                          <span className="text-emerald-300 font-semibold">You (Acting as {selectedLead?.firstName || "Prospect"})</span>
                          <User className="w-3 h-3 text-emerald-400" />
                        </>
                      )}
                    </span>
                    <div
                      className={`max-w-lg p-3.5 rounded-2xl text-xs leading-relaxed ${
                        turn.speaker === "sdr"
                          ? "bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-600 text-white rounded-tl-sm shadow-xl shadow-violet-950/40 border border-violet-400/30"
                          : "bg-[#101020]/90 text-slate-200 border border-white/[0.08] rounded-tr-sm shadow-md"
                      }`}
                    >
                      <p>{turn.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Test Prompt Shortcuts & Speech Input */}
            {callStatus === "IN_PROGRESS" && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                {/* Quick objection & qualification prompts */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Can we schedule a demo this Thursday at 2 PM?",
                    "We already use Salesforce and Outreach.",
                    "What is your pricing model?",
                    "Is your platform SOC2 Type II compliant?",
                    "Can I speak with a sales director?"
                  ].map((phrase, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendUtterance(phrase)}
                      className="px-2.5 py-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 transition"
                    >
                      "{phrase}"
                    </button>
                  ))}
                </div>

                {/* Spoken / Typed Utterance Form with VAD Auto-Turn */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        voiceState === "SPEAKING_DETECTED"
                          ? "bg-cyan-400 animate-ping"
                          : voiceState === "PROCESSING"
                          ? "bg-amber-400 animate-pulse"
                          : voiceState === "AI_SPEAKING"
                          ? "bg-indigo-400"
                          : "bg-emerald-400"
                      }`} />
                      {voiceState === "SPEAKING_DETECTED"
                        ? "VAD: Speech detected — auto-submitting after ~1.1s silence..."
                        : voiceState === "PROCESSING"
                        ? "AI SDR generating response..."
                        : voiceState === "AI_SPEAKING"
                        ? "AI SDR speaking (speak to barge-in)..."
                        : "VAD: Listening... speak freely (auto-submits without clicking Send)"}
                    </span>
                    <span className="text-[10px] text-slate-500">Auto-turn enabled</span>
                  </div>

                  <form onSubmit={(e) => handleSendUtterance(undefined, e)} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder={
                        isUserSpeaking
                          ? "Speaking detected... (auto-submitting on silence)"
                          : "Speak into your mic or type prospect response..."
                      }
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!userInput.trim() || voiceState === "PROCESSING"}
                      className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 shrink-0"
                      title="Optional: Click only if you prefer not to wait for 1.1s VAD silence auto-submission"
                    >
                      <span>Send (Manual Fallback)</span>
                    </button>
                  </form>
                </div>
              </div>
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
