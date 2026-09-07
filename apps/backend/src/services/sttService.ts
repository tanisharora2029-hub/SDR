import { logger } from "../lib/logger.js";

export interface SttProvider {
  name: string;
  transcribe(audioBuffer: Buffer, mimeType?: string): Promise<{ text: string; latencyMs: number }>;
}

/**
 * Online Cloud STT Adapter powered by Google Gemini Multimodal Audio
 * Provides fast, GPU-free transcription with high robustness for Indian English accents and names.
 */
export class GeminiAudioSttProvider implements SttProvider {
  name = "gemini-audio-online";
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.model = process.env.ONLINE_GEMINI_MODEL || "gemini-3.1-flash-lite";
  }

  async transcribe(audioBuffer: Buffer, mimeType = "audio/wav"): Promise<{ text: string; latencyMs: number }> {
    const startTime = Date.now();
    const base64Data = audioBuffer.toString("base64");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const payload = {
      contents: [
        {
          parts: [
            {
              text: "Transcribe the following audio accurately into English. Retain Indian names, company names, technical terminology, and numbers exactly as spoken. Output ONLY the raw transcribed words, with no conversational filler, quotes, or explanations."
            },
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 256,
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini Audio STT error [${res.status}]: ${errText}`);
    }

    const data: any = await res.json();
    const transcribed = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    logger.info(`[ONLINE-STT] Transcribed in ${latencyMs}ms: "${transcribed}"`);

    return { text: transcribed, latencyMs };
  }
}

/**
 * Deepgram Cloud STT Adapter (Nova-2 with en-IN model support)
 */
export class DeepgramSttProvider implements SttProvider {
  name = "deepgram-online";
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY || "";
  }

  async transcribe(audioBuffer: Buffer, mimeType = "audio/wav"): Promise<{ text: string; latencyMs: number }> {
    const startTime = Date.now();
    if (!this.apiKey) {
      throw new Error("DEEPGRAM_API_KEY is not configured");
    }

    const url = "https://api.deepgram.com/v1/listen?model=nova-2&language=en-IN&smart_format=true&punctuate=true";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Token ${this.apiKey}`,
        "Content-Type": mimeType
      },
      body: new Uint8Array(audioBuffer) as any
    });

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Deepgram STT error [${res.status}]: ${err}`);
    }

    const data: any = await res.json();
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    logger.info(`[DEEPGRAM-STT] Transcribed in ${latencyMs}ms: "${transcript}"`);
    return { text: transcript.trim(), latencyMs };
  }
}

export class SttService {
  private static geminiProvider = new GeminiAudioSttProvider();
  private static deepgramProvider = new DeepgramSttProvider();

  static async transcribeAudio(audioBuffer: Buffer, mimeType = "audio/wav"): Promise<{ text: string; latencyMs: number; provider: string }> {
    // If DEEPGRAM_API_KEY is configured and preferred, use Deepgram
    if (process.env.STT_PROVIDER === "deepgram" && process.env.DEEPGRAM_API_KEY) {
      try {
        const result = await this.deepgramProvider.transcribe(audioBuffer, mimeType);
        return { ...result, provider: "deepgram" };
      } catch (err: any) {
        logger.warn(`Deepgram STT failed, falling back to Gemini audio: ${err.message}`);
      }
    }

    // Default: Gemini Online Multimodal Cloud STT (zero local GPU)
    const result = await this.geminiProvider.transcribe(audioBuffer, mimeType);
    return { ...result, provider: "gemini-online" };
  }
}
