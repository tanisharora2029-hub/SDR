import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { PhoneService } from "../services/phoneService.js";
import { WhisperService } from "../services/whisperService.js";
import { TtsService, SUPPORTED_VOICES } from "../services/ttsService.js";
import { SttService } from "../services/sttService.js";
import { authMiddleware } from "../middleware/auth.js";
import { voiceLimiter } from "../middleware/rateLimiter.js";
import { logger } from "../lib/logger.js";

export const callRouter = Router();
callRouter.use(authMiddleware);

// Get supported high-quality neural voices and online provider statuses
callRouter.get("/voices", (_req, res) => {
  res.json({
    success: true,
    voices: SUPPORTED_VOICES,
    ttsProvider: process.env.TTS_PROVIDER || "online",
    sttProvider: process.env.STT_PROVIDER || "gemini-audio-online",
    llmProvider: process.env.VOICE_AI_PROVIDER || "gemini-online"
  });
});

// Online Cloud STT Audio Transcription (zero local GPU)
callRouter.post("/transcribe", voiceLimiter, async (req, res, next) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ success: false, error: "audioBase64 is required" });
    }

    const audioBuffer = Buffer.from(audioBase64, "base64");
    const result = await SttService.transcribeAudio(audioBuffer, mimeType || "audio/wav");
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// Stream neural TTS audio directly
callRouter.post("/tts", voiceLimiter, async (req, res, next) => {
  try {
    const { text, voice, rate } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ success: false, error: "Valid text is required for TTS" });
    }

    const selectedVoice = voice || "en-IN-NeerjaNeural";
    const selectedRate = rate || "+0%";

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Transfer-Encoding", "chunked");

    const audioStream = TtsService.synthesizeStream(text, selectedVoice, selectedRate);

    audioStream.pipe(res);

    audioStream.on("error", (err) => {
      logger.error("TTS streaming error:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Speech synthesis failed" });
      }
    });
  } catch (err) {
    next(err);
  }
});

// Start a browser simulation.
callRouter.post("/initiate", async (req, res, next) => {
  try {
    const { leadId, direction } = req.body;
    if (!leadId) return res.status(400).json({ success: false, error: "leadId is required" });

    if (typeof leadId !== "string" || (direction !== undefined && direction !== "OUTBOUND" && direction !== "INBOUND")) {
      return res.status(400).json({ success: false, error: "Invalid leadId or call direction" });
    }
    const result = await PhoneService.initiateCall(req.organizationId!, leadId, direction || "OUTBOUND", true);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// Process voice dialogue turn (supports either text utterance or audioBase64 for online STT)
callRouter.post("/turn", async (req, res, next) => {
  try {
    const { callSid, utterance, audioBase64, mimeType } = req.body;
    if (!callSid) {
      return res.status(400).json({ success: false, error: "callSid is required" });
    }

    let finalUtterance = utterance;
    let sttLatencyMs = 0;

    // If audio is provided, run through online cloud STT
    if (!finalUtterance && audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, "base64");
      const sttResult = await SttService.transcribeAudio(audioBuffer, mimeType || "audio/wav");
      finalUtterance = sttResult.text;
      sttLatencyMs = sttResult.latencyMs;
    }

    if (!finalUtterance || !finalUtterance.trim()) {
      return res.status(400).json({ success: false, error: "Spoken utterance or audio is required" });
    }

    const result = await PhoneService.processCallTurn(req.organizationId!, callSid, finalUtterance.trim());
    res.json({
      success: true,
      transcription: finalUtterance,
      sttLatencyMs,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

// End call session and produce analysis
callRouter.post("/complete", async (req, res, next) => {
  try {
    const { callSid, durationSeconds } = req.body;
    if (typeof callSid !== "string" || !callSid || !Number.isSafeInteger(durationSeconds) || durationSeconds < 0) {
      return res.status(400).json({ success: false, error: "Valid callSid and durationSeconds are required" });
    }

    const result = await PhoneService.completeCall(req.organizationId!, callSid, durationSeconds);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// Get live Whisper Mode assist dossier for human representative
callRouter.get("/whisper/:callSid", async (req, res, next) => {
  try {
    const { callSid } = req.params;
    const session = await prisma.callSession.findUnique({
      where: { callSid },
      select: { organizationId: true }
    });
    if (!session || session.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, error: "Call session not found or unauthorized" });
    }
    const dossier = WhisperService.getDossier(callSid);
    res.json({ success: true, dossier });
  } catch (err) {
    next(err);
  }
});

// Human representative takeover toggle (mutes AI from speaking)
callRouter.post("/takeover", async (req, res, next) => {
  try {
    const { callSid, takeover } = req.body;
    if (!callSid) return res.status(400).json({ success: false, error: "callSid is required" });
    const session = await prisma.callSession.findUnique({
      where: { callSid },
      select: { organizationId: true }
    });
    if (!session || session.organizationId !== req.organizationId) {
      return res.status(404).json({ success: false, error: "Call session not found or unauthorized" });
    }
    const isTakenOver = WhisperService.setTakeover(callSid, Boolean(takeover));
    res.json({ success: true, callSid, isTakenOver });
  } catch (err) {
    next(err);
  }
});
