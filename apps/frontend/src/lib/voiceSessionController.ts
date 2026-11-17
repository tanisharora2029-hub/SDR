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

  // Feature 4: Adaptive Latency Masking
  private latencyMaskerTimer: any = null;
  private lastFillerIndex: number = -1;
  private turnsSinceLastFiller: number = 2; // starts allowed
  private fillerPhrases = [
    "Right, one moment.",
    "Okay, I see what you mean.",
    "Let me check that for you.",
    "Got it, looking into that."
  ];

  constructor(config: VoiceSessionConfig) {
    this.config = {
      silenceTimeoutMs: 1100,
      watchdogTimeoutMs: 10000,
      lang: "en-US",
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
      console.warn("SpeechRecognition API not available in browser. Typed fallback available.");
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.config.lang || "en-US";

      this.recognition.onresult = (event: any) => {
        if (!this.isActive) return;

        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          interim += event.results[i][0].transcript;
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
        if (this.isActive && this.state !== "IDLE") {
          setTimeout(() => {
            if (this.isActive && this.state !== "IDLE") {
              try {
                this.recognition.start();
              } catch (e) {}
            }
          }, 50);
        }
      };

      this.recognition.onerror = (e: any) => {
        // 'no-speech' is normal during silence; do not treat as fatal
        if (e.error === "no-speech") return;
        console.warn(`[STT notice] Speech recognition event: ${e.error}`);
      };

      this.recognition.start();
    } catch (err: any) {
      console.warn("Failed to initialize speech recognition:", err);
    }
  }

  private ensureRecognitionRunning() {
    if (!this.recognition || !this.isActive) return;
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
    this.turnId += 1;

    const sttDuration = Date.now() - this.turnStartTime;
    this.transition("PROCESSING", "vad_silence_threshold_reached", { sttDurationMs: sttDuration });
    this.config.onTranscriptUpdate("lead", utterance, this.turnId);

    this.turnsSinceLastFiller += 1;
    if (this.latencyMaskerTimer) clearTimeout(this.latencyMaskerTimer);
    this.latencyMaskerTimer = setTimeout(() => {
      this.triggerAdaptiveFiller();
    }, 1200);

    try {
      const llmStart = Date.now();
      const backendRes = await this.config.sendTurnBackend(this.turnId, utterance);
      if (!this.isActive) return;
      if (this.latencyMaskerTimer) {
        clearTimeout(this.latencyMaskerTimer);
        this.latencyMaskerTimer = null;
      }
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
      if (this.latencyMaskerTimer) {
        clearTimeout(this.latencyMaskerTimer);
        this.latencyMaskerTimer = null;
      }
      console.error("[VoiceController] Turn execution failed:", err);
      this.config.onError(err.message || "Failed to process turn");
      // Deterministic recovery back to LISTENING
      this.transition("LISTENING", "turn_error_recovery");
      this.ensureRecognitionRunning();
    }
  }

  private triggerAdaptiveFiller() {
    if (!this.isActive || this.state !== "PROCESSING") return;
    if (this.turnsSinceLastFiller < 2) return;

    let nextIndex = (this.lastFillerIndex + 1) % this.fillerPhrases.length;
    const filler = this.fillerPhrases[nextIndex];
    this.lastFillerIndex = nextIndex;
    this.turnsSinceLastFiller = 0;

    console.log(`[Latency Masker] Speaking natural acknowledgement filler: "${filler}"`);
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(filler);
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    }
  }

  /**
   * Plays SDR speech and guarantees return to LISTENING on end or error
   */
  public async playAudioResponse(audioBlob: Blob | undefined, text: string, metrics: Partial<VoiceEventLog> = {}) {
    this.stopAudioPlayback();
    this.transition("AI_SPEAKING", "playback_started", metrics);

    const playbackStart = Date.now();
    if (!audioBlob?.size) {
      this.fallbackBrowserTts(text, (reason) => {
        if (this.isActive && this.state === "AI_SPEAKING") {
          this.transition("LISTENING", reason);
          this.ensureRecognitionRunning();
        }
      });
      return;
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    this.currentAudio = audio;

    const handlePlaybackFinish = (reason: string) => {
      const playbackDuration = Date.now() - playbackStart;
      this.stopAudioPlayback();
      URL.revokeObjectURL(audioUrl);

      // GUARANTEED DETERMINISTIC RETURN TO LISTENING FOR UNLIMITED TURNS
      if (this.isActive && this.state !== "IDLE") {
        this.transition("LISTENING", reason, { playbackDurationMs: playbackDuration });
        this.ensureRecognitionRunning();
      }
    };

    audio.onended = () => handlePlaybackFinish("audio_ended_normally");
    let fallbackStarted = false;
    const playFallback = () => {
      if (fallbackStarted || this.currentAudio !== audio) return;
      fallbackStarted = true;
      this.fallbackBrowserTts(text, handlePlaybackFinish);
    };
    audio.onerror = playFallback;

    try {
      await audio.play();
    } catch (err) {
      console.warn("Audio play rejected, falling back to speech synthesis:", err);
      playFallback();
    }
  }

  private fallbackBrowserTts(text: string, onDone: (reason: string) => void) {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.onend = () => onDone("browser_tts_ended");
      utterance.onerror = (event) => {
        if (event.error !== "interrupted" && event.error !== "canceled") {
          this.config.onError("Audio playback failed. The reply is available in the transcript.");
          onDone("browser_tts_error_recovery");
        }
      };
      window.speechSynthesis.speak(utterance);
    } else {
      this.config.onError("Audio playback is unavailable. The reply is available in the transcript.");
      onDone("no_tts_available_recovery");
    }
  }

  public stopAudioPlayback() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Manual send trigger (fallback if user chooses to submit manually)
   */
  public manualSubmitUtterance(text: string) {
    if (!text.trim() || !this.isActive) return;
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
    if (this.latencyMaskerTimer) clearTimeout(this.latencyMaskerTimer);

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
