import { voiceSource } from './voice-lines.ts';
import type { VoiceLanguage, VoiceLine } from './voice-lines.ts';

export type VoiceSetting = VoiceLanguage | 'off';
const SETTING_KEY = 'prosperity-road.voice.v1';
const escape = (value: string): string => value.replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** One player survives game renders; only deliberate dialogue actions start speech. */
export function createCharacterVoice(onActivity: (active: boolean) => void) {
  let setting: VoiceSetting = 'zh';
  try {
    const saved = localStorage.getItem(SETTING_KEY);
    if (saved === 'zh' || saved === 'en' || saved === 'off') setting = saved;
  } catch { /* Keep the default for this visit. */ }
  const audio = new Audio();
  audio.id = 'character-voice';
  audio.preload = 'none';
  audio.volume = 0.95;
  document.body.append(audio);
  let generation = 0;
  let activeLine: string | null = null;
  let status: 'idle' | 'loading' | 'playing' | 'error' = 'idle';
  let message = '点击重播';
  let loadTimer: ReturnType<typeof setTimeout> | undefined;

  function syncControls(): void {
    const panel = document.getElementById('character-voice-panel');
    if (!panel) return;
    const matching = panel.dataset.line === activeLine;
    const playing = matching && (status === 'loading' || status === 'playing');
    panel.dataset.voiceState = matching ? status : 'idle';
    const statusElement = document.getElementById('character-voice-status');
    if (statusElement) statusElement.textContent = setting === 'off'
      ? '配音已关闭 · 可在菜单中开启'
      : matching ? message : '点击播放角色配音';
    const replay = document.getElementById('character-voice-replay') as HTMLButtonElement | null;
    if (replay) {
      replay.disabled = setting === 'off';
      replay.textContent = matching && status === 'error' ? '重试配音' : '重播';
    }
    const stopButton = document.getElementById('character-voice-stop') as HTMLButtonElement | null;
    if (stopButton) stopButton.disabled = !playing;
  }

  function releaseAudio(): void {
    clearTimeout(loadTimer);
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    onActivity(false);
  }

  function stop(): void {
    generation += 1;
    releaseAudio();
    status = 'idle';
    message = '已停止 · 可随时重播';
    syncControls();
  }

  function play(line: VoiceLine): void {
    stop();
    activeLine = line.id;
    if (setting === 'off' || document.hidden) { syncControls(); return; }
    const currentGeneration = generation;
    status = 'loading';
    message = '配音加载中…';
    audio.src = voiceSource(line, setting);
    audio.dataset.line = line.id;
    audio.dataset.language = setting;
    onActivity(true);
    syncControls();
    const fail = (text: string): void => {
      if (currentGeneration !== generation) return;
      generation += 1;
      releaseAudio();
      status = 'error';
      message = text;
      syncControls();
    };
    audio.onended = () => {
      if (currentGeneration !== generation || !audio.ended) return;
      clearTimeout(loadTimer);
      status = 'idle';
      message = '听完了 · 可随时重播';
      onActivity(false);
      syncControls();
    };
    audio.onerror = () => {
      if (audio.error) fail('配音暂时无法加载，请点击重试');
    };
    loadTimer = setTimeout(() => fail('配音加载较慢，请点击重试'), 20000);
    audio.load();
    void audio.play().then(() => {
      if (currentGeneration !== generation) return;
      clearTimeout(loadTimer);
      if (document.hidden) { stop(); return; }
      status = 'playing';
      message = `${setting === 'zh' ? '中文' : 'English'} · 正在说话`;
      syncControls();
    }).catch(error => {
      fail(error instanceof DOMException && error.name === 'NotAllowedError'
        ? '请点击重试，允许浏览器播放配音'
        : '配音暂时无法播放，请点击重试');
    });
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);

  return {
    get setting(): VoiceSetting { return setting; },
    setSetting(value: VoiceSetting): void {
      stop();
      setting = value;
      try { localStorage.setItem(SETTING_KEY, value); } catch { /* Keep the setting for this visit. */ }
      syncControls();
    },
    play, stop, syncControls,
    menuMarkup(): string {
      return `<section class="voice-setting"><label for="voice-language">人物配音</label><select id="voice-language" aria-describedby="voice-language-note">${(['zh', 'en', 'off'] as const).map(value => `<option value="${value}" ${setting === value ? 'selected' : ''}>${{ zh: '中文', en: 'English', off: '关闭' }[value]}</option>`).join('')}</select><p id="voice-language-note">独立选择配音语言，不改变游戏界面。角色说话时，配乐会自动调低。</p></section>`;
    },
    controlsMarkup(line: VoiceLine): string {
      return `<section class="character-voice" id="character-voice-panel" data-line="${escape(line.id)}" data-voice-state="idle" aria-label="角色配音"><div class="character-voice-controls"><span class="voice-indicator" aria-hidden="true">♪</span><span id="character-voice-status" role="status">${setting === 'off' ? '配音已关闭 · 可在菜单中开启' : '点击播放角色配音'}</span><button type="button" id="character-voice-replay" data-action="voice-replay" ${setting === 'off' ? 'disabled' : ''}>重播</button><button type="button" id="character-voice-stop" data-action="voice-stop" disabled>停止</button></div>${setting === 'off' ? '' : `<p class="voice-caption" lang="${setting === 'zh' ? 'zh-CN' : 'en'}"><span>配音台词</span>${escape(line[setting])}</p>`}</section>`;
    },
  };
}
