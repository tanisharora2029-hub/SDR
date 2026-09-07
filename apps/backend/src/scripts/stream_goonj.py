import sys
from gradio_client import Client

def main():
    voice = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else "goonj-arjun"
    
    text = sys.stdin.buffer.read().decode("utf-8", errors="replace").strip()
    if not text:
        return

    try:
        c = Client("BH-Builds/goonj-tts")
        choices = [comp['props']['choices'] for comp in c.config['components'] if 'choices' in comp.get('props', {})][0]
        # Map voice
        if "priya" in voice.lower():
            voice_label = choices[1][0] # Priya
        else:
            voice_label = choices[3][0] # Arjun

        audio_path = c.predict(text=text, voice_label=voice_label, api_name="/tts")
        if audio_path:
            with open(audio_path, "rb") as f:
                sys.stdout.buffer.write(f.read())
                sys.stdout.buffer.flush()
    except Exception as e:
        sys.stderr.write(f"Goonj synthesis error: {e}\n")

if __name__ == "__main__":
    main()
