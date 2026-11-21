import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VoiceSessionController } from "../../../frontend/src/lib/voiceSessionController.js";
import { SUPPORTED_VOICES, spokenText } from "../services/ttsService.js";

let audio: any;
let recognition: any;
let controller: VoiceSessionController;
let send: ReturnType<typeof vi.fn>;
let error: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", {
    SpeechRecognition: class {
      constructor() { recognition = this; }
      start() {} stop() {} abort() {}
    }
  });
  vi.stubGlobal("Audio", class {
    constructor() { audio = this; }
    play() { return Promise.resolve(); }
    pause() {}
  });
  send = vi.fn(async () => ({sdrSpeech:"Yes.", audioBlob:new Blob(["reply"])}));
  error = vi.fn();
  controller = new VoiceSessionController({onStateChange:vi.fn(), onTranscriptUpdate:vi.fn(), onError:error, sendTurnBackend:send});
});
afterEach(() => {controller.endSession(); vi.unstubAllGlobals(); vi.useRealTimers();});

it("preserves English and romanises Hindi for the same speaker", () => {
  expect(spokenText("नमस्ते, आप Pune में हैं?")).toBe("namaste, aap Pune men hain?");
});

it("offers one expressive voice and recovers to listening when its audio is missing", async () => {
  expect(SUPPORTED_VOICES.map(v => v.id)).toEqual(["en-IN-NeerjaExpressiveNeural"]);
  await controller.startSession("test", "Hello");
  expect(error).toHaveBeenCalledOnce();
  expect(controller.state).toBe("LISTENING");
});
it("keeps playing a progressing long reply and releases it on barge-in", async () => {
  await controller.startSession("test", "Hello", new Blob(["greeting"]));
  await vi.advanceTimersByTimeAsync(8000);
  audio.ontimeupdate();
  await vi.advanceTimersByTimeAsync(4000);
  expect(controller.state).toBe("AI_SPEAKING");
  recognition.onresult({resultIndex:0,results:[[{transcript:"Actually"}]]});
  expect(controller.state).toBe("SPEAKING_DETECTED");
  recognition.onresult({resultIndex:1,results:[[{transcript:"Actually"}],[{transcript:"Pune please"}]]});
  await vi.advanceTimersByTimeAsync(1200);
  expect(send).toHaveBeenCalledWith(1,"Actually Pune please");
  audio.onended();
  expect(controller.state).toBe("LISTENING");
});
it("ignores recognition results while muted", async () => {
  await controller.startSession("test");
  controller.setMuted(true);
  recognition.onresult({resultIndex:0,results:[[{transcript:"Private conversation"}]]});
  await vi.advanceTimersByTimeAsync(1600);
  expect(send).not.toHaveBeenCalled();
});
