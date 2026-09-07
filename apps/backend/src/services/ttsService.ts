import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { Readable, PassThrough } from "stream";
import { logger } from "../lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  gender: string;
  provider: "edge" | "goonj" | "chatterbox" | "browser";
}

export const SUPPORTED_VOICES: VoiceOption[] = [
  // Restored Demo Voice Winner: Natural Indian-English Female Cadence
  { id: "en-IN-NeerjaNeural", name: "Neerja (Indian English - Female, Demo Default)", lang: "en-IN", gender: "Female", provider: "edge" },
  { id: "en-IN-NeerjaExpressiveNeural", name: "Neerja Expressive (Indian English - Female, Conversational)", lang: "en-IN", gender: "Female", provider: "edge" },
  { id: "en-IN-PrabhatNeural", name: "Prabhat (Indian English - Male, Neural)", lang: "en-IN", gender: "Male", provider: "edge" },
  // Goonj Kokoro 82M Online Cloud (Indian English Conversational Accent)
  { id: "goonj-arjun", name: "Arjun (Goonj Indian English - Male)", lang: "en-IN", gender: "Male", provider: "goonj" },
  { id: "goonj-priya", name: "Priya (Goonj Indian English - Female)", lang: "en-IN", gender: "Female", provider: "goonj" },
  // Browser Native SAPI / SpeechSynthesis Fallback
  { id: "browser-native", name: "Browser Speech Synthesis (Local OS Native Voice)", lang: "en-IN", gender: "Dynamic", provider: "browser" },
  // International Voices
  { id: "en-US-JennyNeural", name: "Jenny (US English - Female)", lang: "en-US", gender: "Female", provider: "edge" },
  { id: "en-US-GuyNeural", name: "Guy (US English - Male)", lang: "en-US", gender: "Male", provider: "edge" },
  { id: "hi-IN-SwaraNeural", name: "Swara (Hindi - Female)", lang: "hi-IN", gender: "Female", provider: "edge" },
];

export interface TtsAdapter {
  name: string;
  synthesizeStream(text: string, voice?: string, rate?: string): Readable;
}

export class EdgeTtsAdapter implements TtsAdapter {
  name = "edge-neural-online";
  private scriptPath = path.resolve(__dirname, "../scripts/stream_tts.py");

  synthesizeStream(text: string, voice = "en-IN-NeerjaNeural", rate = "+0%"): Readable {
    const pythonProcess = spawn("python", [this.scriptPath, voice, rate], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    pythonProcess.stdin.write(text, "utf-8");
    pythonProcess.stdin.end();

    pythonProcess.stderr.on("data", (errData) => {
      const errStr = errData.toString();
      if (errStr.trim()) logger.warn(`[EdgeTTS stderr] ${errStr}`);
    });

    pythonProcess.on("error", (err) => {
      logger.error("Failed to spawn EdgeTTS python process", err);
    });

    return pythonProcess.stdout;
  }
}

export class GoonjTtsAdapter implements TtsAdapter {
  name = "goonj-kokoro-online";
  private scriptPath = path.resolve(__dirname, "../scripts/stream_goonj.py");

  synthesizeStream(text: string, voice = "goonj-arjun", _rate = "+0%"): Readable {
    const pythonProcess = spawn("python", [this.scriptPath, voice], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    pythonProcess.stdin.write(text, "utf-8");
    pythonProcess.stdin.end();

    pythonProcess.stderr.on("data", (errData) => {
      const errStr = errData.toString();
      if (errStr.trim()) logger.warn(`[GoonjTTS stderr] ${errStr}`);
    });

    pythonProcess.on("error", (err) => {
      logger.error("Failed to spawn GoonjTTS python process", err);
    });

    return pythonProcess.stdout;
  }
}

export class TtsService {
  private static edgeAdapter = new EdgeTtsAdapter();
  private static goonjAdapter = new GoonjTtsAdapter();

  /**
   * Resolves the appropriate adapter based on selected voice and provider configuration
   */
  private static getAdapterForVoice(voice: string): TtsAdapter {
    if (voice.startsWith("goonj-")) {
      return this.goonjAdapter;
    }
    return this.edgeAdapter;
  }

  /**
   * Synthesizes text to an audio stream (MP3 or WAV) using the configured online provider
   */
  static synthesizeStream(text: string, voice = "en-IN-NeerjaNeural", rate = "+0%"): Readable {
    const cleanText = text.replace(/[*_#`~]/g, "").trim();
    if (!cleanText) {
      throw new Error("Text is empty");
    }

    const adapter = this.getAdapterForVoice(voice);
    logger.info(`[TTS] Synthesizing via adapter "${adapter.name}" with voice "${voice}"`);
    return adapter.synthesizeStream(cleanText, voice, rate);
  }

  /**
   * Synthesizes text to a complete audio buffer
   */
  static async synthesizeBuffer(text: string, voice = "en-IN-NeerjaNeural", rate = "+0%"): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const stream = this.synthesizeStream(text, voice, rate);
      const chunks: Buffer[] = [];

      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      stream.on("error", (err) => {
        reject(err);
      });
    });
  }
}