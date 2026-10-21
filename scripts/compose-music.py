#!/usr/bin/env python3
"""Render the original town theme. Python + NumPy; ffmpeg is only a build tool."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
BPM = 76
BEAT = 60 / BPM
BARS = 32
FRAMES = round(BARS * 3 * BEAT * RATE)
RNG = np.random.default_rng(20261021)

# F major: a small waltz, with an eight-bar question, answer, bridge and return.
# Each note is (beat within bar, MIDI pitch, sounding length in beats).
MELODY = [
    [(0.3, 69, .65), (1, 72, .7), (2, 74, .4), (2.5, 72, .45)],
    [(0.1, 67, .8), (1.2, 69, .5), (2, 76, .85)],
    [(0.2, 77, .7), (1.2, 76, .5), (2, 74, .8)],
    [(0.15, 72, 1.1), (1.6, 71, .4), (2.2, 72, .5)],
    [(0.2, 74, .65), (1.1, 77, .7), (2.1, 76, .35), (2.6, 74, .3)],
    [(0.1, 72, .9), (1.3, 69, .65), (2.3, 72, .45)],
    [(0.2, 70, .8), (1.4, 69, .4), (2.1, 67, .65)],
    [(0.1, 67, .7), (1.1, 69, .45), (1.8, 67, .45), (2.5, 64, .35)],
    [(0.2, 65, 1.0), (1.6, 69, .45), (2.3, 72, .5)],
    [(0.2, 74, .7), (1.2, 72, .65), (2.2, 67, .65)],
    [(0.15, 69, .65), (1, 74, 1.3)],
    [(0.4, 72, .6), (1.4, 69, 1.15)],
    [(0.2, 70, .6), (1, 74, .6), (2, 77, .7)],
    [(0.2, 76, .6), (1, 72, .6), (2, 69, .75)],
    [(0.3, 67, .65), (1.2, 70, .6), (2.2, 69, .55)],
    [(0.2, 67, 1.4)],
    [(0.25, 74, .55), (1, 77, .9), (2.2, 76, .6)],
    [(0.2, 74, .65), (1.1, 72, 1.35)],
    [(0.25, 70, .7), (1.3, 74, .45), (2, 77, .75)],
    [(0.25, 76, .8), (1.5, 72, .9)],
    [(0.25, 74, .55), (1.1, 70, .65), (2.1, 67, .65)],
    [(0.2, 69, .7), (1.2, 72, .6), (2.2, 76, .5)],
    [(0.25, 74, .8), (1.4, 72, .45), (2.1, 71, .6)],
    [(0.25, 72, 1.3)],
    [(0.3, 69, .65), (1.2, 72, .65), (2.2, 74, .45)],
    [(0.2, 72, .8), (1.4, 67, 1.0)],
    [(0.2, 69, .65), (1.1, 74, .75), (2.3, 77, .5)],
    [(0.3, 76, .7), (1.3, 72, 1.0)],
    [(0.3, 74, .65), (1.2, 70, .6), (2.2, 69, .55)],
    [(0.25, 72, .7), (1.3, 69, .65), (2.3, 65, .45)],
    [(0.2, 67, .8), (1.4, 69, .45), (2.1, 70, .6)],
    [(0.3, 67, .8), (1.5, 64, .65)],
]
CHORDS = [
    (41, [53, 57, 60]), (40, [52, 55, 60]),
    (38, [50, 53, 57]), (45, [52, 57, 60]),
    (34, [50, 53, 58]), (33, [53, 57, 60]),
    (43, [50, 55, 58]), (36, [52, 55, 60]),
] * 2 + [
    (38, [50, 53, 57]), (45, [52, 57, 60]),
    (34, [50, 53, 58]), (41, [53, 57, 60]),
    (43, [50, 55, 58]), (45, [52, 57, 60]),
    (43, [50, 55, 59]), (36, [52, 55, 60]),
] + [
    (41, [53, 57, 60]), (40, [52, 55, 60]),
    (38, [50, 53, 57]), (45, [52, 57, 60]),
    (34, [50, 53, 58]), (33, [53, 57, 60]),
    (43, [50, 55, 58]), (36, [52, 55, 60]),
]


def tone(pitch, length, kind):
    """Felt-like struck strings, a muted pluck, or a slowly bowed string bed."""
    frequency = 440 * 2 ** ((pitch - 69) / 12)
    duration = length * BEAT
    tail = 2.5 if kind == 'keys' else 1.7
    t = np.arange(round((duration + tail) * RATE)) / RATE
    signal = np.zeros_like(t)
    if kind == 'strings':
        envelope = (1 - np.exp(-t / .48)) * np.minimum(1, np.maximum(0, (duration + .9 - t) / .9))
        vibrato = .0015 * np.sin(2 * np.pi * 4.7 * t) / (2 * np.pi * 4.7)
        for partial in range(1, 8):
            for detune in [-.0018, .0012]:
                phase = 2 * np.pi * frequency * partial * (t * (1 + detune) + vibrato)
                signal += np.sin(phase) * np.exp(-partial / 2.7) / partial
        signal *= envelope * (.96 + .04 * np.sin(2 * np.pi * .42 * t))
    else:
        attack = 1 - np.exp(-t / (.012 if kind == 'keys' else .007))
        release = np.exp(-np.maximum(0, t - duration) / .34)
        for partial in range(1, 13):
            # Slight inharmonicity and a quiet second string soften the synthetic purity.
            harmonic = partial * np.sqrt(1 + .00009 * partial ** 2)
            decay = np.exp(-t * (.6 + partial * (.18 if kind == 'keys' else .32)))
            weight = np.exp(-partial / 5.5) / partial ** (1.25 if kind == 'keys' else 1.6)
            phase = 2 * np.pi * frequency * harmonic * t
            signal += weight * decay * (np.sin(phase) + .28 * np.sin(phase * 1.0009))
        signal *= attack * release
        # Very quiet, quickly decaying hammer/finger sound; no external samples.
        noise = RNG.normal(0, 1, len(t))
        noise = np.convolve(noise, np.ones(15) / 15, mode='same')
        signal += noise * np.exp(-t / .022) * attack * .025
    signal *= np.minimum(1, np.maximum(0, (t[-1] - t) / .02))
    return signal.astype(np.float32)


def render():
    mix = np.zeros((FRAMES, 2), dtype=np.float32)

    def add(bar, beat, pitch, length, level, pan, kind):
        note = tone(pitch, length, kind) * level * RNG.uniform(.92, 1.06)
        offset = round(((bar * 3 + beat) * BEAT + RNG.uniform(-.012, .012)) * RATE)
        indices = (offset + np.arange(len(note))) % FRAMES
        angle = (pan + 1) * np.pi / 4
        mix[indices, 0] += note * np.cos(angle)
        mix[indices, 1] += note * np.sin(angle)

    for bar, (bass, chord) in enumerate(CHORDS):
        breathing = .93 + .07 * np.sin(2 * np.pi * bar / 8 - .6)
        add(bar, .03, bass, 2.6, .16 * breathing, -.08, 'keys')
        for step, beat in enumerate([.55, 1.25, 2.1]):
            add(bar, beat, chord[step], 1.5, .105 * breathing, -.35, 'pluck')
        for pitch in chord:
            add(bar, .05, pitch, 3.2, .024 * breathing, .32, 'strings')
        for beat, pitch, length in MELODY[bar]:
            add(bar, beat, pitch, length, .205 * breathing, .09, 'keys')

    # Circular room reflections retain the end's tail at the start of the loop.
    dry = mix.copy()
    for seconds, gain in [(.083, .12), (.157, .09), (.263, .07), (.419, .05), (.631, .035)]:
        mix += np.roll(dry[:, ::-1], round(seconds * RATE), axis=0) * gain
    mix -= np.mean(mix, axis=0)
    mix = np.tanh(mix * 1.4)
    mix *= 10 ** (-8 / 20) / np.max(np.abs(mix))
    return mix


def ffmpeg():
    binary = os.environ.get('FFMPEG') or shutil.which('ffmpeg')
    if binary:
        return binary
    sys.path.insert(0, str(ROOT / '.qa/demo/tools'))
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as error:
        raise SystemExit('Install ffmpeg or set FFMPEG to its absolute path.') from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'public/audio/town-theme.mp3')
    args = parser.parse_args()
    qa = ROOT / '.qa/audio'
    qa.mkdir(parents=True, exist_ok=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    audio = render()
    source = qa / 'town-theme.wav'
    with wave.open(str(source), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes((audio * 32767).astype('<i2').tobytes())
    subprocess.run([
        ffmpeg(), '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
        '-c:a', 'libmp3lame', '-b:a', '80k', '-map_metadata', '-1',
        '-metadata', 'title=Town at Daybreak', '-metadata', 'artist=Prosperity Road',
        str(args.output),
    ], check=True)
    stats = {
        'durationSeconds': round(FRAMES / RATE, 5), 'sampleRate': RATE,
        'tempoBpm': BPM, 'timeSignature': '3/4', 'bars': BARS,
        'pcmPeakDbfs': round(float(20 * np.log10(np.max(np.abs(audio)))), 2),
        'pcmRmsDbfs': round(float(20 * np.log10(np.sqrt(np.mean(audio ** 2)))), 2),
        'seamStep': round(float(np.max(np.abs(audio[0] - audio[-1]))), 7),
        'bytes': args.output.stat().st_size,
    }
    (qa / 'music-stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    print(json.dumps(stats, indent=2))


if __name__ == '__main__':
    main()
