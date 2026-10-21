#!/usr/bin/env python3
"""Prepare narration or render the real-browser capture. See docs/demo/README.md."""
import argparse
import asyncio
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / '.qa/demo'
PUBLIC = ROOT / 'public'
tools = QA / 'tools'
if tools.exists():
    sys.path.insert(0, str(tools))
FFMPEG = os.environ.get('FFMPEG')
if not FFMPEG:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

def run(*args):
    subprocess.run([str(x) for x in args], check=True)

def duration(path):
    result = subprocess.run([FFMPEG, '-hide_banner', '-i', str(path)], capture_output=True, text=True)
    match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', result.stderr)
    if not match:
        raise ValueError(f'Cannot inspect duration: {path}')
    h, m, s = map(float, match.groups())
    return h * 3600 + m * 60 + s

def stamp(seconds, ass=False):
    h = int(seconds // 3600)
    m = int(seconds // 60) % 60
    s = seconds % 60
    return f'{h}:{m:02}:{s:05.2f}' if ass else f'{h:02}:{m:02}:{s:06.3f}'.replace('.', ',')

def prepare():
    import edge_tts

    QA.mkdir(parents=True, exist_ok=True)
    segments = json.loads((ROOT / 'docs/demo/narration.json').read_text())
    voice = os.environ.get('DEMO_VOICE', 'zh-CN-XiaoxiaoNeural')
    for index, seg in enumerate(segments):
        text = QA / f'voice-{index:02}.txt'
        text.write_text(seg['voice'])
        speech = QA / f'voice-{index:02}.mp3'
        wav = QA / f'voice-{index:02}.wav'
        # Punctuation and short spoken sentences carry the pauses; never speed up
        # the finished recording to make it fit the previous screen capture.
        asyncio.run(edge_tts.Communicate(seg['voice'], voice=voice, rate='-4%',
            proxy=os.environ.get('DEMO_TTS_PROXY')).save(str(speech)))
        seg['voiceEngine'] = 'edge-tts 7.3.1'
        seg['voiceName'] = voice
        seg['voiceRate'] = '-4%'
        seg['voiceDuration'] = duration(speech)
        seg['duration'] = max(10, round(seg['voiceDuration'] + 1.5, 2))
        run(FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', speech,
            '-af', 'adelay=400|400,apad', '-t', seg['duration'], '-ar', '48000', '-ac', '1', wav)
        print(f'Prepared {seg["id"]}: {seg["voiceDuration"]:.2f}s speech', flush=True)
    (QA / 'prepared.json').write_text(json.dumps(segments, ensure_ascii=False, indent=2))
    print(f'Prepared {sum(s["duration"] for s in segments):.2f}s narration')

def render():
    recording = json.loads((QA / 'recording.json').read_text())
    segments = recording['segments']
    total = recording['duration']
    subtitle_events = []
    ass_events = []
    voice_inputs = []
    for index, seg in enumerate(segments):
        start, end = seg['start'], seg['end']
        ass_events.append(f'Dialogue: 0,{stamp(start, True)},{stamp(end, True)},Header,,0,0,0,,{seg["title"]}')
        part = (end - start) / len(seg['captions'])
        for j, caption in enumerate(seg['captions']):
            a, b = start + j * part, start + (j + 1) * part
            subtitle_events.append(f'{len(subtitle_events) + 1}\n{stamp(a)} --> {stamp(b)}\n{caption}\n')
            ass_events.append(f'Dialogue: 0,{stamp(a, True)},{stamp(b, True)},Caption,,0,0,0,,{caption}')
        voice_inputs.extend(['-i', str(QA / f'voice-{index:02}.wav')])
    srt = PUBLIC / 'prosperity-road-demo.zh.srt'
    srt.write_text('\n'.join(subtitle_events))
    (ROOT / 'docs/demo/prosperity-road-demo.zh.srt').write_text(srt.read_text())
    ass = QA / 'captions.ass'
    ass.write_text('''[Script Info]
ScriptType: v4.00+
PlayResX: 1440
PlayResY: 900
WrapStyle: 2
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Header,Heiti SC,25,&H00EBEFDA,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,25,25,12,1
Style: Caption,Heiti SC,27,&H00FFFFFF,&H00FFFFFF,&H00102018,&H00102018,0,0,0,0,100,100,0,0,1,0,0,2,20,20,15,1
Style: Label,Heiti SC,18,&H00B8C8C2,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,9,20,25,16,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
''' + f'Dialogue: 0,0:00:00.00,{stamp(total,True)},Label,,0,0,0,,繁荣之路 · 操作示例\n' + '\n'.join(ass_events))
    audio_filters = []
    for index, seg in enumerate(segments):
        delay = round(seg['start'] * 1000)
        audio_filters.append(f'[{index+1}:a]adelay={delay}:all=1[a{index}]')
    audio_filters.append(''.join(f'[a{i}]' for i in range(len(segments))) +
        f'amix=inputs={len(segments)}:duration=longest:normalize=0,highpass=f=70,loudnorm=I=-16:TP=-2:LRA=7,asplit=2[narration][duckkey]')
    music = PUBLIC / 'audio/town-theme.mp3'
    if not music.exists():
        raise FileNotFoundError(f'Generate the town music before rendering: {music}')
    music_index = len(segments) + 1
    audio_filters.append(f'[{music_index}:a]atrim=duration={total},asetpts=PTS-STARTPTS,volume=0.32,'
        f'afade=t=in:st=0:d=2,afade=t=out:st={max(0, total-3)}:d=3[music]')
    audio_filters.append('[music]asplit=2[musicinput][musicreference]')
    audio_filters.append('[musicinput][duckkey]sidechaincompress=threshold=0.04:ratio=3:attack=30:release=550:mix=0.65[ducked]')
    audio_filters.append('[narration]asplit=2[voice][voiceqa]')
    audio_filters.append('[ducked]asplit=2[bed][musicqa]')
    audio_filters.append('[voice][bed]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.89:level=false[a]')
    filters = f'[0:v]trim=start={recording["videoOffset"]}:duration={total},setpts=PTS-STARTPTS,pad=1440:900:0:48:color=0x173e33,ass={ass}[v];' + ';'.join(audio_filters)
    output = PUBLIC / 'prosperity-road-demo.mp4'
    run(FFMPEG, '-hide_banner', '-loglevel', 'warning', '-y', '-i', recording['video'], *voice_inputs, '-stream_loop', '-1', '-i', music,
        '-filter_complex', filters, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium',
        '-crf', '25', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
        '-t', total, '-movflags', '+faststart', output,
        '-map', '[voiceqa]', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '1', '-t', total, QA / 'narration-mix.wav',
        '-map', '[musicqa]', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', '-t', total, QA / 'music-ducked.wav',
        '-map', '[musicreference]', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', '-t', total, QA / 'music-reference.wav')
    run(FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-ss', '1.5', '-i', output,
        '-frames:v', '1', '-update', '1', '-q:v', '2', PUBLIC / 'prosperity-road-demo-poster.jpg')
    print(f'Rendered {output}: {duration(output):.2f}s, {output.stat().st_size / 1024**2:.2f} MiB')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['prepare', 'render'])
    args = parser.parse_args()
    prepare() if args.command == 'prepare' else render()
