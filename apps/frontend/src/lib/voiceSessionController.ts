/**
 * NexusSDR Voice Session Controller
 * Autonomous multi-turn state machine with keepalive recognition, VAD, barge-in,
 * and deterministic transitions back to LISTENING.
 */

export type VoiceState =
  | "IDLE"
  | "LISTENING"
  | "SPEAKING_DETECTED"
  | "PROCESSING"
  | "AI_SPEAKING"
  | "INTERRUPTED";

export interface VoiceEventLog {
  sessionId: string;
  turnId: number;
  timestamp: string;
  fromState: VoiceState;
  toState: VoiceState;
  reason: string;
  sttDurationMs?: number;
  llmDurationMs?: number;
  ttsDurationMs?: number;
  playbackDurationMs?: number;
  totalLatencyMs?: number;
}

export interface VoiceSessionConfig {
  getAudio?: (text: string) => Promise<Blob>;
  silenceTimeoutMs?: number;
  watchdogTimeoutMs?: number;
  lang?: string;
  onStateChange: (state: VoiceState, log: VoiceEventLog) => void;
  onTranscriptUpdate: (speaker: "lead" | "sdr", text: string, turnId: number) => void;
  onError: (error: string) => void;
  sendTurnBackend: (turnId: number, utterance: string, audioBase64?: string) => Promise<{
    sdrSpeech: string;
    audioBlob?: Blob;
    sttLatencyMs?: number;
    latencyMs?: number;
  }>;
}

export class VoiceSessionController {
  public state: VoiceState = "IDLE";
  public sessionId: string = "";
  public turnId: number = 0;
  public isActive: boolean = false;

  private config: VoiceSessionConfig;
  private recognition: any = null;
  private silenceTimer: any = null;
  private watchdogTimer: any = null;
  private currentAudio: HTMLAudioElement | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private accumulatedText: string = "";
  private turnStartTime: number = 0;

  private muted = false;
  private humanTakeover = false;
  private playbackVersion = 0;
  private resultStart = 0;
  private nextResult = 0;
  private audioUrl: string | null = null;

  constructor(config: VoiceSessionConfig) {
    this.config = {
      silenceTimeoutMs: 1100,
      watchdogTimeoutMs: 10000,
      lang: "en-IN",
      ...config
    };
  }

  public transition(toState: VoiceState, reason: string, extraMetrics: Partial<VoiceEventLog> = {}) {
    const fromState = this.state;
    this.state = toState;

    const log: VoiceEventLog = {
      sessionId: this.sessionId,
      turnId: this.turnId,
      timestamp: new Date().toISOString(),
      fromState,
      toState,
      reason,
      ...extraMetrics
    };

    console.log(`[VOICE_STATE] ${fromState} -> ${toState} | Turn ${this.turnId} | Reason: ${reason}`);
    this.config.onStateChange(toState, log);

    // Watchdog reset: if in PROCESSING or AI_SPEAKING, recover to LISTENING if stuck
    this.resetWatchdog(toState);
  }

  private resetWatchdog(currentState: VoiceState) {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    // The turn request owns its timeout. Reopening the mic state before it
    // settles can allow two turns to write to the same call simultaneously.
    if (currentState === "AI_SPEAKING") {
      this.watchdogTimer = setTimeout(() => {
        if (this.isActive && (this.state === "PROCESSING" || this.state === "AI_SPEAKING")) {
          console.warn(`[WATCHDOG] State ${this.state} timed out. Recovering to LISTENING.`);
          this.stopAudioPlayback();
          this.transition("LISTENING", "watchdog_timeout_recovery");
          this.ensureRecognitionRunning();
        }
      }, this.config.watchdogTimeoutMs);
    }
  }

  /**
   * Start a new Voice Session for a call
   */
  public async startSession(sessionId: string, initialGreeting?: string, initialAudioBlob?: Blob) {
    this.sessionId = sessionId;
    this.turnId = 0;
    this.isActive = true;
    this.accumulatedText = "";

    this.initSpeechRecognition();

    if (initialGreeting) {
      this.config.onTranscriptUpdate("sdr", initialGreeting, this.turnId);
      await this.playAudioResponse(initialAudioBlob, initialGreeting);
    } else {
      this.transition("LISTENING", "session_started");
      this.ensureRecognitionRunning();
    }
  }

  /**
   * Initializes Web Speech recognition with active onend keepalive
   */
  private initSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.config.onError("Speech recognition is unavailable in this browser. Type a reply or try Chrome.");
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.config.lang || "en-IN";

      this.recognition.onresult = (event: any) => {
        if (!this.isActive || this.muted) return;
        this.nextResult = event.results.length;
        if (this.state === "PROCESSING") { this.resultStart = this.nextResult; return; }

        let interim = "";
        for (let i = this.resultStart; i < event.results.length; i++) {
          interim += " " + event.results[i][0].transcript;
        }

        const trimmed = interim.trim();
        if (!trimmed) return;

        // Barge-In Detection: speech while SDR is speaking
        if (this.state === "AI_SPEAKING") {
          console.log("⚡ Barge-in: Spoken audio detected while AI speaking. Cutting AI speech.");
          this.stopAudioPlayback();
          this.transition("INTERRUPTED", "barge_in_speech_detected");
          this.transition("SPEAKING_DETECTED", "user_speaking_after_interruption");
        } else if (this.state === "LISTENING") {
          this.turnStartTime = Date.now();
          this.transition("SPEAKING_DETECTED", "vad_speech_start");
        }

        this.accumulatedText = trimmed;

        // Reset silence timer on new speech tokens
        if (this.silenceTimer) clearTimeout(this.silenceTimer);

        // VAD Silence Detection (1100ms pauses automatically dispatch turns)
        this.silenceTimer = setTimeout(() => {
          this.handleVadSilence();
        }, this.config.silenceTimeoutMs);
      };

      // KEEPALIVE FIX FOR BUG 2: Automatically restart recognition on 'end' unless session ended!
      this.recognition.onend = () => {
        this.resultStart = 0;
        this.nextResult = 0;
        if (this.isActive && !this.muted && this.state !== "IDLE") {
          setTimeout(() => {
            if (this.isActive && !this.muted && this.state !== "IDLE") {
              try {
                this.recognition.start();
              } catch (e) {}
            }
          }, 50);
        }
      };

      this.recognition.onerror = (e: any) => {
        // 'no-speech' is normal during silence; do not treat as fatal
        if (e.error === "no-speech" || e.error === "aborted") return;
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          this.recognition.onend = null;
          this.config.onError("Speech recognition permission was denied. You can type replies.");
        }
        console.warn(`[STT notice] Speech recognition event: ${e.error}`);
      };

      this.recognition.start();
    } catch (err: any) {
      console.warn("Failed to initialize speech recognition:", err);
    }
  }

  private ensureRecognitionRunning() {
    if (!this.recognition || this.muted || !this.isActive) return;
    try {
      this.recognition.start();
    } catch (e) {
      // already running
    }
  }

  private async handleVadSilence() {
    const utterance = this.accumulatedText.trim();
    if (!utterance) {
      if (this.state === "SPEAKING_DETECTED") {
        this.transition("LISTENING", "empty_speech_cleared");
      }
      return;
    }
    if (!this.isActive || this.state === "PROCESSING") return;

    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.accumulatedText = "";
    this.resultStart = this.nextResult;
    this.turnId += 1;

    const sttDuration = Date.now() - this.turnStartTime;
    this.transition("PROCESSING", "vad_silence_threshold_reached", { sttDurationMs: sttDuration });
    this.config.onTranscriptUpdate("lead", utterance, this.turnId);

    try {
      const llmStart = Date.now();
      const backendRes = await this.config.sendTurnBackend(this.turnId, utterance);
      if (!this.isActive) return;
      const llmDuration = Date.now() - llmStart;

      if (backendRes.sdrSpeech.trim()) {
        this.config.onTranscriptUpdate("sdr", backendRes.sdrSpeech, this.turnId);
        await this.playAudioResponse(backendRes.audioBlob, backendRes.sdrSpeech, {
          sttDurationMs: backendRes.sttLatencyMs || sttDuration,
          llmDurationMs: backendRes.latencyMs || llmDuration
        });
      } else {
        // Deterministic transition back to LISTENING if no audio stream
        this.transition("LISTENING", "turn_completed_text_only");
        this.ensureRecognitionRunning();
      }
    } catch (err: any) {
      if (!this.isActive) return;
      console.error("[VoiceController] Turn execution failed:", err);
      this.config.onError(err.message || "Failed to process turn");
      // Deterministic recovery back to LISTENING
      this.transition("LISTENING", "turn_error_recovery");
      this.ensureRecognitionRunning();
    }
  }

  public async playAudioResponse(audioBlob: Blob | undefined, text: string, metrics: Partial<VoiceEventLog> = {}) {
    this.stopAudioPlayback();
    if (this.humanTakeover) {
      this.transition("LISTENING", "human_takeover");
      return;
    }
    if (!audioBlob && this.config.getAudio) {
      const version = this.playbackVersion;
      this.transition("PROCESSING", "preparing_voice", metrics);
      try { audioBlob = await this.config.getAudio(text); } catch { /* Keep the transcript available. */ }
      if (!this.isActive) return;
      if (version !== this.playbackVersion) { this.transition("LISTENING", "voice_cancelled"); return; }
    }
    if (!audioBlob?.size) {
      this.config.onError("Neerja audio is unavailable for this reply. Read the transcript and continue.");
      this.transition("LISTENING", "audio_unavailable");
      this.ensureRecognitionRunning();
      return;
    }
    this.audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(this.audioUrl);
    this.currentAudio = audio;
    const start = Date.now();
    const finish = (failed: boolean) => {
      if (audio !== this.currentAudio || !this.isActive) return;
      this.stopAudioPlayback();
      if (failed) this.config.onError("Playback failed. The reply is in the transcript.");
      this.transition("LISTENING", failed ? "playback_error" : "audio_ended", {playbackDurationMs: Date.now() - start});
      this.ensureRecognitionRunning();
    };
    audio.onended = () => finish(false);
    audio.onerror = () => finish(true);
    audio.ontimeupdate = () => {
      if (audio === this.currentAudio && !audio.paused) this.resetWatchdog("AI_SPEAKING");
    };
    this.transition("AI_SPEAKING", "playback_started", metrics);
    try { await audio.play(); }
    catch { finish(true); }
  }

  public setTakeover(enabled: boolean) {
    this.humanTakeover = enabled;
    if (!enabled) return;
    this.stopAudioPlayback();
    if (this.state === "AI_SPEAKING") this.transition("LISTENING", "human_takeover");
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    this.accumulatedText = "";
    clearTimeout(this.silenceTimer);
    if (muted) {
      try { this.recognition?.abort(); } catch {}
      if (this.state === "SPEAKING_DETECTED") this.transition("LISTENING", "mic_muted");
    } else this.ensureRecognitionRunning();
  }

  public stopAudioPlayback() {
    this.playbackVersion++;
    const audio = this.currentAudio;
    this.currentAudio = null;
    if (audio) {
      audio.onended = audio.onerror = audio.ontimeupdate = null;
      audio.pause();
    }
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = null;
  }

  /**
   * Manual send trigger (fallback if user chooses to submit manually)
   */
  public manualSubmitUtterance(text: string) {
    if (!text.trim() || !this.isActive || this.state === "PROCESSING") return;
    this.stopAudioPlayback();
    this.accumulatedText = text;
    this.handleVadSilence();
  }

  /**
   * Terminate Session
   */
  public endSession() {
    this.isActive = false;
    this.stopAudioPlayback();

    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);


    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }

    this.transition("IDLE", "session_ended_by_user");
  }
}
