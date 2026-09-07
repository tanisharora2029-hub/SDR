import asyncio
import os
import time
import json
import edge_tts

SENTENCES = [
    "Hi Rahul, thanks for taking the call.",
    "I wanted to understand how you're currently handling outbound sales.",
    "That makes sense. A lot of teams we speak with have the same challenge.",
    "Would it be useful if I showed you how this works?",
    "Our pricing depends on the number of users and the level of automation you need.",
    "We already use Salesforce.",
    "Can you send me the information by tomorrow?",
    "I'm not ready to buy yet.",
    "Can you schedule a demo for next Tuesday at three PM?",
    "Actually, I have one more question."
]

VOICES = [
    ("en-IN-NeerjaNeural", "Neerja Neural (Demo Winner)"),
    ("en-IN-NeerjaExpressiveNeural", "Neerja Expressive (Conversational)"),
    ("en-IN-PrabhatNeural", "Prabhat Neural (Male)")
]

out_dir = os.path.join(os.path.dirname(__file__), "tts_samples", "polish")
os.makedirs(out_dir, exist_ok=True)

results = {}

async def run_benchmark():
    for vid, vlabel in VOICES:
        results[vid] = {
            "label": vlabel,
            "samples": [],
            "averageLatencyMs": 0
        }
        total_lat = 0
        print(f"\n=======================================================")
        print(f"BENCHMARKING VOICE: {vid} ({vlabel})")
        print(f"=======================================================")
        for i, s in enumerate(SENTENCES):
            t0 = time.time()
            comm = edge_tts.Communicate(s, vid)
            audio = b""
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    audio += chunk["data"]
            lat = round((time.time() - t0) * 1000)
            total_lat += lat
            out_file = os.path.join(out_dir, f"{vid}_s{i+1}.mp3")
            with open(out_file, "wb") as f:
                f.write(audio)
            print(f"  [S{i+1:02d}] ({lat}ms, {len(audio)} bytes): \"{s}\"")
            results[vid]["samples"].append({
                "index": i + 1,
                "sentence": s,
                "latencyMs": lat,
                "bytes": len(audio),
                "file": f"{vid}_s{i+1}.mp3"
            })
        avg_lat = round(total_lat / len(SENTENCES))
        results[vid]["averageLatencyMs"] = avg_lat
        print(f"--> Average Latency for {vid}: {avg_lat}ms")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
    summary_path = os.path.join(out_dir, "benchmark_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved summary to: {summary_path}")
