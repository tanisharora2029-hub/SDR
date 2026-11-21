import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

export function StudioVoicePreview() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  async function preview() {
    const request = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const blob = await api.fetchTtsAudio("Hi, I'm Neerja. Pune mein kis area mein dekh rahe hain? Take your time.");
      if (request === generation.current) setUrl(URL.createObjectURL(blob));
    } catch {
      if (request === generation.current) setError("Voice preview unavailable. Try again.");
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  return <div className="mt-2 text-xs">
    {url ? <audio controls autoPlay src={url} aria-label="Neerja voice preview" className="w-full" />
      : <button type="button" disabled={busy} onClick={preview} className="text-indigo-300 underline">{busy ? "Preparing voice…" : "Listen to Neerja"}</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
