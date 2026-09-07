import sys
import asyncio
import edge_tts

async def main():
    voice = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else "en-IN-NeerjaNeural"
    rate = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else "+0%"
    
    text = sys.stdin.buffer.read().decode("utf-8", errors="replace").strip()
    if not text:
        return

    communicate = edge_tts.Communicate(text, voice, rate=rate)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            sys.stdout.buffer.write(chunk["data"])
            sys.stdout.buffer.flush()

if __name__ == "__main__":
    asyncio.run(main())