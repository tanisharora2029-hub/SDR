import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const Sanscript: { t(text: string, from: string, to: string): string } =
  createRequire(import.meta.url)("@indic-transliteration/sanscript");

export const STUDIO_VOICE = "en-IN-NeerjaExpressiveNeural";
export const SUPPORTED_VOICES = [{ id: STUDIO_VOICE, name: "Neerja Expressive", lang: "en-IN", gender: "Female", provider: "edge" }];

const runtime = process.platform === "win32" ? "Scripts/python.exe" : "bin/python";
const python = fileURLToPath(new URL("../../.voice-runtime/" + runtime, import.meta.url));
const script = fileURLToPath(new URL("../../.voice-runtime/stream_tts.py", import.meta.url));
let activeRequests = 0;

// This Indian English voice accepts Latin text. Only convert the synthesis
// input, preserving the customer's original script in the CRM and transcript.
export function spokenText(text: string): string {
  return text.replace(/[\u0900-\u097f]+/gu, word => {
    const roman = Sanscript.t(word, "devanagari", "iast");
    const ending = word.length > 1 && /[क-ह]$/u.test(word) ? roman.replace(/a$/, "") : roman;
    return ending.replace(/ā/g, "aa").replace(/ī/g, "ee").replace(/ū/g, "oo")
      .replace(/[ṃṁ]/g, "n").replace(/[śṣ]/g, "sh").normalize("NFD").replace(/\p{M}/gu, "");
  }).replace(/[*_#`~]/g, "").trim();
}

export class TtsService {
  static async synthesizeBuffer(text: string, _legacyVoice?: string, _legacyRate?: string, signal?: AbortSignal): Promise<Buffer> {
    if (text.length > 2000) throw Error("Expected a short spoken response.");
    const speech = spokenText(text);
    if (!speech) throw Error("Expected a short spoken response.");
    if (activeRequests >= 4) throw Error("Voice service busy.");
    activeRequests++;
    try {
      return await new Promise<Buffer>((resolve, reject) => {
        const child = execFile(python, [script, STUDIO_VOICE, "+0%"], {
          encoding: "buffer", windowsHide: true, timeout: 18000, maxBuffer: 2_000_000, signal
        }, (error, audio) => {
          if (error || !audio.length) reject(Error("Neerja audio is temporarily unavailable."));
          else resolve(audio);
        });
        child.stdin?.on("error", () => child.kill());
        child.stdin?.end(speech, "utf8");
      });
    } finally {
      activeRequests--;
    }
  }
}
