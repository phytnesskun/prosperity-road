"""Generate the game's fixed, bilingual character performances (no runtime TTS).

Run with PYTHONPATH=.qa/demo/tools python3 scripts/generate-character-voices.py.
Requires the existing demo's edge-tts 7.3.1 tools. CHARACTER_TTS_PROXY is optional.
Only public, authored game dialogue is sent to the synthesis service.
"""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import subprocess

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/audio/characters'
MANIFEST = OUTPUT / 'manifest.json'
PROFILES = {
    'zh': {
        'advisor': {'voice': 'zh-CN-XiaoxiaoNeural', 'rate': '-4%', 'pitch': '+0Hz'},
        'farm': {'voice': 'zh-CN-YunyangNeural', 'rate': '-8%', 'pitch': '-5Hz'},
        'mill': {'voice': 'zh-CN-YunxiNeural', 'rate': '+0%', 'pitch': '+0Hz'},
        'market': {'voice': 'zh-CN-XiaoyiNeural', 'rate': '+2%', 'pitch': '+0Hz'},
        'homes': {'voice': 'zh-TW-HsiaoChenNeural', 'rate': '-5%', 'pitch': '-3Hz'},
    },
    'en': {
        'advisor': {'voice': 'en-GB-SoniaNeural', 'rate': '-4%', 'pitch': '+0Hz'},
        'farm': {'voice': 'en-GB-RyanNeural', 'rate': '-8%', 'pitch': '-5Hz'},
        'mill': {'voice': 'en-GB-ThomasNeural', 'rate': '+0%', 'pitch': '+0Hz'},
        'market': {'voice': 'en-GB-LibbyNeural', 'rate': '+2%', 'pitch': '+0Hz'},
        'homes': {'voice': 'en-US-JennyNeural', 'rate': '-5%', 'pitch': '-3Hz'},
    },
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


async def main():
    catalogue = json.loads(subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import { VOICE_LINES } from './src/voice-lines.ts'; console.log(JSON.stringify(Object.values(VOICE_LINES)))",
    ], cwd=ROOT, text=True))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    previous = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    manifest = {'engine': 'edge-tts 7.3.1', 'profiles': PROFILES, 'clips': {}}
    semaphore = asyncio.Semaphore(3)

    def save_manifest():
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

    async def generate(line, language):
        profile = PROFILES[language][line['character']]
        text = line[language]
        key = f"{language}/{line['id']}"
        path = OUTPUT / f'{key}.mp3'
        path.parent.mkdir(parents=True, exist_ok=True)
        signature = digest(json.dumps([text, profile, manifest['engine']], sort_keys=True).encode())
        prior = previous.get('clips', {}).get(key, {})
        if path.exists() and prior.get('signature') == signature and digest(path.read_bytes()) == prior.get('sha256'):
            manifest['clips'][key] = prior
            save_manifest()
            print(f'Reused {key}', flush=True)
            return
        async with semaphore:
            for attempt in range(3):
                try:
                    temporary = path.with_suffix('.mp3.part')
                    await edge_tts.Communicate(
                        text, **profile, proxy=os.environ.get('CHARACTER_TTS_PROXY'),
                    ).save(str(temporary))
                    data = temporary.read_bytes()
                    if len(data) < 1000:
                        raise ValueError(f'Incomplete audio for {key}')
                    temporary.replace(path)
                    manifest['clips'][key] = {
                        'character': line['character'], 'text': text, **profile,
                        'signature': signature, 'sha256': digest(data), 'bytes': len(data),
                    }
                    save_manifest()
                    print(f'Generated {key}: {len(data)} bytes', flush=True)
                    return
                except Exception as error:
                    if attempt == 2:
                        raise
                    print(f'Retrying {key}: {type(error).__name__}', flush=True)
                    await asyncio.sleep(2 * (attempt + 1))

    await asyncio.gather(*(generate(line, language) for line in catalogue for language in PROFILES))
    save_manifest()
    print(f"Completed {len(manifest['clips'])} clips.", flush=True)


if __name__ == '__main__':
    asyncio.run(main())
