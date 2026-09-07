import os
import sys
import time
import json
import asyncio
import edge_tts
from gradio_client import Client

SAMPLE_SENTENCES = [
    ("s01_intro", "Hi Rahul, thanks for taking the call. I just wanted to understand how you're currently handling outbound sales."),
    ("s02_empathy", "That makes sense. A lot of teams we speak with have the same problem."),
    ("s03_cta", "Would it be useful if I showed you how this works in a quick demo?"),
    ("s04_discovery", "Absolutely, I understand. What would you say is the biggest challenge with your current process?"),
    ("s05_pricing", "Our standard pricing starts at $199 per month for up to 1,000 active contacts, with a 15% discount on annual commitments."),
    ("s06_compliance", "We are SOC2 Type II certified and support native bi-directional CRM sync with Salesforce and HubSpot."),
    ("s07_dates", "Are you free this Thursday, September 10th at 2:30 PM IST, or would Friday afternoon work better?"),
    ("s08_names", "Can I check if Vikram from Tata Digital or Priya from Infosys is also involved in this evaluation?"),
    ("s09_contact", "You can reach our solutions desk at sales@nexussdr.ai or visit our portal at nexussdr.ai/demo."),
    ("s10_hinglish", "Understood, haan ji bilkul, we can customize the sequence to match your pipeline requirements perfectly.")
]

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tts_samples")
os.makedirs(OUTPUT_DIR, exist_ok=True)

results = {
    "goonj_arjun": [],
    "goonj_priya": [],
    "edge_neerja": [],
    "edge_prabhat": [],
    "chatterbox_v3": [],
    "chatterbox_desi_status": "RUNTIME_ERROR (BosonLab/chatterbox-desi HuggingFace space unavailable)",
    "indic_parler_status": "Gradio schema error on ai4bharat/indic-parler-tts"
}

# 1. Test Edge Neural Cloud TTS
async def test_edge_voice(voice_id, label, filename_prefix):
    print(f"\n--- Testing Edge Neural Cloud ({label} / {voice_id}) ---")
    for key, text in SAMPLE_SENTENCES:
        out_path = os.path.join(OUTPUT_DIR, f"{filename_prefix}_{key}.mp3")
        t0 = time.time()
        try:
            communicate = edge_tts.Communicate(text, voice_id)
            await communicate.save(out_path)
            lat_ms = round((time.time() - t0) * 1000, 1)
            file_size = os.path.getsize(out_path)
            print(f"  [{label}] {key}: {lat_ms}ms ({file_size} bytes)")
            results[filename_prefix].append({
                "key": key,
                "text": text,
                "latency_ms": lat_ms,
                "file_size": file_size,
                "file_path": out_path,
                "status": "SUCCESS"
            })
        except Exception as e:
            print(f"  [{label}] {key} FAILED: {e}")
            results[filename_prefix].append({
                "key": key,
                "text": text,
                "error": str(e),
                "status": "FAILED"
            })

# 2. Test Goonj TTS (Kokoro 82M Indian English)
def test_goonj():
    print("\n--- Connecting to Goonj Online Cloud Space (BH-Builds/goonj-tts) ---")
    try:
        c = Client("BH-Builds/goonj-tts")
        # Extract exact choice strings
        choices = [comp['props']['choices'] for comp in c.config['components'] if 'choices' in comp.get('props', {})][0]
        voice_priya = choices[1][0] # Priya – Female, Indian English
        voice_arjun = choices[3][0] # Arjun – Male, Indian English
        print("  Goonj online client loaded successfully.")
    except Exception as e:
        print(f"  Failed to connect to Goonj space: {e}")
        return

    for voice_name, voice_label, prefix in [
        ("Arjun (Male Indian-English)", voice_arjun, "goonj_arjun"),
        ("Priya (Female Indian-English)", voice_priya, "goonj_priya")
    ]:
        print(f"\nEvaluating Goonj: {voice_name}")
        # Test first 4 representative sentences for benchmark speed & quality
        for key, text in SAMPLE_SENTENCES[:4]:
            t0 = time.time()
            try:
                audio_path = c.predict(text=text, voice_label=voice_label, api_name="/tts")
                lat_ms = round((time.time() - t0) * 1000, 1)
                file_size = os.path.getsize(audio_path) if os.path.exists(audio_path) else 0
                print(f"  [Goonj {voice_name}] {key}: {lat_ms}ms ({file_size} bytes)")
                results[prefix].append({
                    "key": key,
                    "text": text,
                    "latency_ms": lat_ms,
                    "file_size": file_size,
                    "file_path": audio_path,
                    "status": "SUCCESS"
                })
            except Exception as e:
                print(f"  [Goonj {voice_name}] {key} FAILED: {e}")
                results[prefix].append({
                    "key": key,
                    "text": text,
                    "error": str(e),
                    "status": "FAILED"
                })

# 3. Test Chatterbox Multilingual V3
def test_chatterbox():
    print("\n--- Connecting to Chatterbox Multilingual V3 Space (ResembleAI) ---")
    try:
        c = Client("ResembleAI/Chatterbox-Multilingual-TTS-V3")
        print("  Chatterbox online client loaded successfully.")
        for key, text in SAMPLE_SENTENCES[:2]:
            t0 = time.time()
            try:
                # generate_tts_audio endpoint
                res = c.predict(
                    text_input=text,
                    language_id_input="en",
                    exaggeration_input=0.5,
                    temperature_input=0.8,
                    seed_num_input=0,
                    cfgw_input=0.5,
                    api_name="/generate_tts_audio"
                )
                lat_ms = round((time.time() - t0) * 1000, 1)
                audio_path = res if isinstance(res, str) else res.get("name", "")
                file_size = os.path.getsize(audio_path) if os.path.exists(audio_path) else 0
                print(f"  [Chatterbox V3] {key}: {lat_ms}ms ({file_size} bytes)")
                results["chatterbox_v3"].append({
                    "key": key,
                    "text": text,
                    "latency_ms": lat_ms,
                    "file_size": file_size,
                    "file_path": audio_path,
                    "status": "SUCCESS"
                })
            except Exception as e:
                print(f"  [Chatterbox V3] {key} FAILED: {e}")
                results["chatterbox_v3"].append({
                    "key": key,
                    "text": text,
                    "error": str(e),
                    "status": "FAILED"
                })
    except Exception as e:
        print(f"  Chatterbox space connection notice: {e}")
        results["chatterbox_v3"].append({"error": str(e), "status": "FAILED"})

async def run_benchmark():
    await test_edge_voice("en-IN-PrabhatNeural", "Prabhat (Indian English - Male)", "edge_prabhat")
    await test_edge_voice("en-IN-NeerjaNeural", "Neerja (Indian English - Female)", "edge_neerja")
    test_goonj()
    test_chatterbox()

    summary_file = os.path.join(OUTPUT_DIR, "benchmark_summary.json")
    with open(summary_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nBenchmark completed! Summary written to: {summary_file}")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
