"""Record the bilingual performances defined alongside each playable chapter.

Use the existing edge-tts environment. Pass one or more chapter IDs: mill, convoy, quay, morning.
Set HTTPS_PROXY if the recording machine needs a proxy.
"""
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("harbor_voices", ROOT / "scripts/generate-harbor-voices.py")
harbor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harbor)


async def main(ids):
    output = ROOT / "src/chapters/voices"
    output.mkdir(exist_ok=True)
    limit = asyncio.Semaphore(3)
    proxy = os.environ.get("HTTPS_PROXY")

    async def record(name, text, voice):
        async with limit:
            for attempt in range(3):
                try:
                    chunks = bytearray()
                    async with asyncio.timeout(35):
                        async for packet in edge_tts.Communicate(text, voice, proxy=proxy).stream():
                            if packet["type"] == "audio":
                                chunks.extend(packet["data"])
                    if len(chunks) < 1000:
                        raise ValueError("Empty recording")
                    (output / name).write_bytes(chunks)
                    return
                except Exception:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(1 + attempt)

    jobs = []
    for chapter in ids:
        if chapter not in ("mill", "convoy", "quay", "morning"):
            raise ValueError("Unknown chapter: " + chapter)
        script = f"import {{ {chapter}Lines as lines }} from './src/chapters/{chapter}.ts'; console.log(JSON.stringify(Object.entries(lines)));"
        lines = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", script], cwd=ROOT))
        for key, (speaker, zh, en) in lines:
            for lang, text, voice in zip(("zh", "en"), (zh, en), harbor.VOICES[speaker]):
                jobs.append(record(f"{chapter}-{key}-{lang}.mp3", text, voice))
    await asyncio.gather(*jobs)
    print(f"Recorded {len(jobs)} local clips.")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or ["mill", "convoy", "quay", "morning"]))
