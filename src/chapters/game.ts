import { createStreetAudio } from '../harbor/audio.ts';
import type { Language } from '../harbor/audio.ts';
import { chapterHref, chapters } from './shared.ts';
import type { Chapter, ChapterContext, LaterChapter } from './shared.ts';
import { millLines, mountMill } from './mill.ts';
import { convoyLines, mountConvoy } from './convoy.ts';
import { quayEnding, quayLines, quayStats, mountQuay, restoreQuay } from './quay.ts';
import { morningLines, mountMorning } from './morning.ts';
import { stories } from '../tides/library.ts';
import { mountTides } from '../tides/game.ts';
import type { StoryLine } from '../tides/types.ts';
import tidesStyle from '../tides/tides.css?inline';
import baseStyle from './journeys.css?inline';
import millStyle from './mill.css?inline';
import convoyStyle from './convoy.css?inline';
import quayStyle from './quay.css?inline';
import morningStyle from './morning.css?inline';

const episodes = {
  mill: { mount: mountMill, lines: millLines, style: millStyle, next: 'convoy' },
  convoy: { mount: mountConvoy, lines: convoyLines, style: convoyStyle, next: 'quay' },
  quay: { mount: mountQuay, lines: quayLines, style: quayStyle, next: 'morning' },
  morning: { mount: mountMorning, lines: morningLines, style: morningStyle, next: 'ch7' },
} as const;

type Episode = {
  mount(host: HTMLElement, ctx: ChapterContext): void;
  lines: Record<string, StoryLine>;
  style: string;
  next: Chapter | null;
};
const chapterOrder = Object.keys(chapters) as Chapter[];
function getEpisode(id: LaterChapter): Episode {
  if (Object.hasOwn(episodes, id)) return episodes[id as keyof typeof episodes];
  const story = stories.find(item => 'ch' + item.num === id);
  if (!story) throw new Error('Unknown story ' + id);
  return { mount: (host, ctx) => mountTides(host, ctx, story), lines: story.lines, style: tidesStyle,
    next: chapterOrder[chapterOrder.indexOf(id) + 1] ?? null };
}

const clips = import.meta.glob<string>('./voices/*.mp3', { eager: true, query: '?url', import: 'default' });
const keyFor = (id: LaterChapter) => 'prosperity-road.harbor-' + id + '.v1';

export function openChapter(id: LaterChapter) {
  const app = document.getElementById('app')!;
  const episode = getEpisode(id);
  const [number, title] = chapters[id];
  const style = document.createElement('style');
  style.textContent = baseStyle + '\n' + episode.style;
  document.head.append(style);
  document.title = title + ' · 繁荣之路';
  app.innerHTML = `<main class="journey" data-episode="${id}">
    <header class="journey-head"><div><p>繁荣之路 <span>／</span> 雾港 · ${number}</p><h1>${title}</h1></div>
    <button type="button" id="journey-book">航海手记</button></header>
    <div id="journey-play"></div>
    <aside class="journey-dialogue" aria-live="polite" hidden><strong id="journey-speaker"></strong><span id="journey-line"></span><button id="journey-hear" aria-label="重听这句">重听</button></aside>
    <p id="journey-storage" role="status" hidden>此窗口暂时无法保存，关窗后可能需要重新开始。</p>
    <section id="journey-ending" hidden><p id="journey-summary"></p><a id="journey-next"></a><button id="journey-replay">再试另一条路</button></section>
    <dialog id="journey-log" aria-labelledby="journey-log-title"><header><h2 id="journey-log-title">航海手记</h2><button id="journey-close">合上</button></header>
    <nav aria-label="选择章节"></nav><p id="journey-previous" hidden></p><div class="journey-settings"><label>人物配音 <select id="journey-language"><option value="zh">中文</option><option value="en">English</option><option value="off">关闭</option></select></label><button id="journey-sound"></button></div>
    <button id="journey-reset">重新开始本章</button><div id="journey-confirm" hidden><p>要从本章开头再玩一次吗？这会替换本章进度。</p><button id="journey-keep">继续这局</button> <button id="journey-restart">重新开始</button></div></dialog></main>`;
  function el<T extends HTMLElement = HTMLElement>(name: string) {
    return document.getElementById(name) as T;
  }
  const book = el<HTMLDialogElement>('journey-log');
  const language = el<HTMLSelectElement>('journey-language');
  const audio = createStreetAudio(() => {});
  let lastLine: { speaker: string; zh: string; en: string } | undefined;
  let currentState: unknown = null;
  let ending = '';
  let lastSaved: string | null = null;
  const storageKey = keyFor(id);
  try {
    lastSaved = localStorage.getItem(storageKey);
    const saved = JSON.parse(lastSaved ?? 'null');
    if (typeof saved?.ending === 'string') ending = saved.ending;
    currentState = saved?.state ?? null;
  } catch {
    /* Unknown data starts a fresh run. */
  }

  function changedElsewhere() {
    try {
      if (localStorage.getItem(storageKey) === lastSaved) return false;
      location.reload();
      return true;
    } catch {
      return false;
    }
  }
  function refreshEarlierChapters() { el('journey-play').dispatchEvent(new Event('voyagehistory')); }
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) changedElsewhere();
    if (event.key !== storageKey) refreshEarlierChapters();
  });
  window.addEventListener('pageshow', () => { if (!changedElsewhere()) refreshEarlierChapters(); });
  window.addEventListener('focus', refreshEarlierChapters);
  function persist() {
    if (changedElsewhere()) return;
    try {
      const data = JSON.stringify({ state: currentState, ending });
      localStorage.setItem(storageKey, data);
      lastSaved = data;
      el('journey-storage').hidden = true;
    } catch {
      el('journey-storage').hidden = false;
    }
  }
  function showLine(play: boolean) {
    if (!lastLine) return;
    const { speaker, zh, en } = lastLine;
    const lang = audio.language === 'en' ? 'en' : 'zh';
    el('journey-speaker').textContent = speaker;
    el('journey-line').textContent = lang === 'zh' ? zh : en;
    el('journey-line').lang = lang === 'zh' ? 'zh-CN' : 'en';
    el('journey-speaker').parentElement!.hidden = false;
    el<HTMLButtonElement>('journey-hear').disabled = !audio.sound || audio.language === 'off';
    const entry = Object.entries(episode.lines).find(
      ([, line]) => line[0] === speaker && line[1] === zh && line[2] === en
    );
    const src = entry && clips[`./voices/${id}-${entry[0]}-${lang}.mp3`];
    if (play && src) audio.speakClip(src, lang === 'zh' ? zh : en);
  }
  function previousEntry() {
    try {
      if (id === 'mill') {
        const rice = JSON.parse(localStorage.getItem('prosperity-road.rice-market.v1') ?? 'null');
        return rice?.ended && typeof rice.stallName === 'string'
          ? '从西岸带来的招牌 · ' + rice.stallName
          : '';
      }
      const previous = chapterOrder[chapterOrder.indexOf(id) - 1] as LaterChapter;
      const note = JSON.parse(localStorage.getItem(keyFor(previous)) ?? 'null')?.ending;
      return typeof note === 'string' && note ? chapters[previous][1] + ' · ' + note : '';
    } catch {
      return '';
    }
  }
  function options() {
    const previous = el('journey-previous');
    previous.textContent = previousEntry();
    previous.hidden = !previous.textContent;
    language.value = audio.language;
    el('journey-sound').textContent = audio.sound ? '声音：开' : '声音：关';
    const nav = book.querySelector('nav')!;
    nav.replaceChildren();
    for (const [chapter, [ordinal, label]] of Object.entries(chapters)) {
      const link = document.createElement('a');
      link.href = chapterHref(chapter as Chapter);
      link.textContent = ordinal + ' · ' + label;
      if (chapter === id) {
        link.setAttribute('aria-current', 'page');
        link.onclick = (event) => {
          event.preventDefault();
          book.close();
        };
      }
      nav.append(link);
    }
  }
  function mount() {
    const host = el('journey-play');
    if (id === 'morning') {
      try {
        const previous = JSON.parse(localStorage.getItem(keyFor('quay')) ?? 'null');
        const quay = restoreQuay(previous?.state);
        if (quayEnding(quay)) host.dataset.bridgeLamps = String(quayStats(quay).lamps);
      } catch { /* An independent start needs no previous chapter. */ }
    }
    episode.mount(host, {
      load: () => currentState,
      save(state) {
        currentState = state;
        persist();
      },
      say(speaker, zh, en) {
        lastLine = { speaker, zh, en };
        showLine(true);
      },
      finish(summary) {
        if (ending !== summary) {
          ending = summary;
          persist();
        }
        el('journey-ending').hidden = false;
        el('journey-summary').textContent = summary;
        el('journey-summary').hidden = id === 'quay' || id.startsWith('ch');
        const next = el<HTMLAnchorElement>('journey-next');
        next.href = chapterHref(episode.next ?? 'harbor');
        next.textContent = episode.next
          ? '前往' + chapters[episode.next][0] + ' · ' + chapters[episode.next][1] + ' →'
          : '回雾港推一次旧面包车 →';
      },
    });
  }
  app.addEventListener('pointerdown', () => audio.start(), { capture: true });
  app.addEventListener('click', () => audio.start(), { capture: true });
  el('journey-book').onclick = () => {
    audio.stopVoice();
    options();
    book.showModal();
    book.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' });
  };
  el('journey-close').onclick = () => book.close();
  book.onclose = () => {
    el('journey-confirm').hidden = true;
    el('journey-reset').hidden = false;
  };
  language.onchange = () => {
    audio.setLanguage(language.value as Language);
    showLine(true);
  };
  el('journey-sound').onclick = () => {
    audio.setSound(!audio.sound);
    options();
    showLine(false);
  };
  el('journey-hear').onclick = () => showLine(true);
  el('journey-reset').onclick = () => {
    el('journey-reset').hidden = true;
    el('journey-confirm').hidden = false;
    el('journey-keep').focus();
  };
  el('journey-replay').onclick = () => {
    el('journey-book').click();
    el('journey-reset').click();
  };
  el('journey-keep').onclick = () => book.close();
  el('journey-restart').onclick = () => {
    currentState = null;
    ending = '';
    lastLine = undefined;
    persist();
    audio.stopVoice();
    book.close();
    el('journey-ending').hidden = true;
    el('journey-speaker').parentElement!.hidden = true;
    // Unmount the old host, including its event handlers, before starting again.
    const replacement = document.createElement('div');
    replacement.id = 'journey-play';
    el('journey-play').replaceWith(replacement);
    mount();
  };
  mount();
}
