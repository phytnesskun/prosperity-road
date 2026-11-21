"""Regenerate the harbor's short bilingual character performances using edge-tts 7.3.1."""
import asyncio
import json
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1] / "src/harbor/assets"
VOICES = {
    "阿芸": ("zh-CN-XiaoyiNeural", "en-GB-LibbyNeural"),
    "阿诚": ("zh-CN-YunxiNeural", "en-GB-ThomasNeural"),
    "周婶": ("zh-TW-HsiaoChenNeural", "en-US-JennyNeural"),
    "陈禾": ("zh-CN-YunyangNeural", "en-GB-RyanNeural"),
    "船长": ("zh-CN-YunjianNeural", "en-US-GuyNeural"),
}


async def main():
    remarks = json.loads((ROOT / "remarks.json").read_text())
    output = ROOT / "voices"
    output.mkdir(exist_ok=True)
    limit = asyncio.Semaphore(3)

    async def record(key, name, lang, text):
        path = output / f"{key}-{lang}.mp3"
        index = 0 if lang == "zh" else 1
        async with limit:
            for attempt in range(3):
                try:
                    data = bytearray()
                    async for item in edge_tts.Communicate(text, VOICES[name][index]).stream():
                        if item["type"] == "audio":
                            data.extend(item["data"])
                    if len(data) < 1000:
                        raise RuntimeError("Empty recording")
                    path.write_bytes(data)
                    return
                except Exception:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(1 + attempt)

    await asyncio.gather(*(record(key, name, lang, text)
                         for key, (name, zh, en) in remarks.items()
                         for lang, text in (("zh", zh), ("en", en))))


if __name__ == "__main__":
    asyncio.run(main())
