import remarks from './assets/remarks.json';
import type { Effect } from './model.ts';

export type Remark = keyof typeof remarks;
export type Language = 'zh' | 'en' | 'off';
// The website streams each selected performance. Vite's single-file library build embeds it offline.
const clips = import.meta.glob<string>('./assets/voices/*.mp3', { eager: true, query: '?url', import: 'default' });

export function createStreetAudio(onCaption: (line: string) => void) {
  const voice = new Audio();
  const music = new Audio();
  const theme = document.getElementById('harbor-theme')?.textContent;
  music.src = theme ? 'data:audio/mpeg;base64,' + theme : '/audio/town-theme.mp3';
  music.loop = true;
  music.preload = 'none';
  music.volume = 0.14;
  let context: AudioContext | undefined;
  let started = false;
  let sound = true;
  let language: Language = 'zh';
  try {
    sound = localStorage.getItem('harbor.sound') !== 'off';
    const saved = localStorage.getItem('prosperity-road.voice.v1');
    if (saved === 'en' || saved === 'off') language = saved;
  } catch { /* Preferences are optional in file viewers. */ }

  function stopVoice() { voice.pause(); onCaption(''); music.volume = 0.14; }
  voice.onended = stopVoice;
  voice.onerror = stopVoice;
  function updateMusic() {
    if (sound && started && !document.hidden) void music.play().catch(() => {});
    else music.pause();
  }
  function start() {
    if (!started) { started = true; updateMusic(); }
    if (sound && !context && window.AudioContext) {
      try { context = new AudioContext(); } catch { /* Play without sound effects. */ }
    }
    if (context?.state === 'suspended') void context.resume().catch(() => {});
  }
  function say(key: Remark) {
    if (language === 'off') return;
    const source = clips[`./assets/voices/${key}-${language}.mp3`];
    if (!source) return;
    const line = remarks[key];
    speakClip(source, `${line[0]} · ${line[language === 'zh' ? 1 : 2]}`);
  }
  function speakClip(source: string, caption: string) {
    stopVoice();
    if (!sound || language === 'off' || document.hidden) return;
    onCaption(caption);
    music.volume = 0.045;
    voice.src = source;
    void voice.play().catch(() => { if (voice.getAttribute('src') === source && voice.paused) stopVoice(); });
  }
  function playEffect(effect: Effect) {
    if (!effect || !sound || !context || document.hidden) return;
    const notes: Record<NonNullable<Effect>, number[]> = {
      bell: [882, 1321], cash: [1047, 1397], horn: [139, 208],
      oven: [174, 233, 294], bread: [349, 440],
    };
    const now = context.currentTime;
    notes[effect].forEach((hz, i) => {
      const osc = context!.createOscillator();
      const gain = context!.createGain();
      const t = now + i * (effect === 'horn' ? 0.035 : 0.075);
      const duration = effect === 'horn' ? 0.8 : 0.28;
      osc.type = effect === 'horn' ? 'triangle' : 'sine';
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.065, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain).connect(context!.destination);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      osc.start(t); osc.stop(t + duration + 0.02);
    });
  }
  function setSound(value: boolean) {
    sound = value;
    try { localStorage.setItem('harbor.sound', sound ? 'on' : 'off'); } catch { /* Session only. */ }
    if (!sound) stopVoice();
    updateMusic();
  }
  function setLanguage(next: Language) {
    language = next;
    stopVoice();
    try { localStorage.setItem('prosperity-road.voice.v1', next); } catch { /* Session only. */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopVoice(); updateMusic(); });
  return { start, say, speakClip, stopVoice, playEffect, setSound, setLanguage, get sound() { return sound; }, get language() { return language; } };
}
