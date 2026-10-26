import './style.css';
import './companion.css';
import './pilot.css';
import { DEFAULT_POLICY, SEASONS, evaluate } from './economy.ts';
import type { Policy, Result } from './economy.ts';
import { choosePolicy, currentResources, goals, newGame, nextSeason, restoreGame, settleTurn } from './campaign.ts';
import type { Direction, GameState } from './campaign.ts';
import { drawMarketChart } from './charts.ts';
import { outcomeFeedback } from './feedback.ts';
import { advisorReply } from './advisor.ts';
import type { AdvisorTopic } from './advisor.ts';
import { renderEconomyScene } from './scene.ts';
import { TOWNSPEOPLE, townReactions } from './townspeople.ts';
import type { TownPlace } from './townspeople.ts';
import { visitMarkup } from './visits.ts';
import './focus.css';
import { PILOT_VERSION, emptyPilotFeedback, restorePilotFeedback, pilotFeedbackReport } from './pilot.ts';
import type { PilotFeedback } from './pilot.ts';
import { SOUNDTRACKS, findSoundtrack } from './soundtracks.ts';
import { advisorVoiceLine, visitVoiceLine } from './voice-lines.ts';
import { createCharacterVoice } from './character-voice.ts';
import './character-voice.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const SAVE_KEY = 'prosperity-road.bread-crisis.v1';
const FEEDBACK_KEY = 'prosperity-road.pilot-feedback.v1';
const fmt = (value: number): string => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (value: number): string => `${fmt(value * 100)}%`;
const escape = (value: string): string => value.replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
let storageMessage = '';
let state = loadGame();
type View = 'command' | 'town' | 'market' | 'people' | 'accounts' | 'history' | 'replay' | 'report';
let view: View = 'command';
let district = 'farm';
let customPolicyOpen = false;
let utilityReturnFocus = 'menu-button';
let notice = '';
let dialog: 'help' | 'reset' | 'advisor' | 'visit' | 'pilot' | 'menu' | 'music-library' | null = null;
let visitPlace: TownPlace = 'farm';
let visitInspected = false;
let visitReturnFocus = 'tab-town';
let pilotReturnFocus = 'pilot-button';
let pilotFeedback = loadPilotFeedback();
let feedbackMessage = '';
let replaySeason = state.records.find(r => r.result.season > 1)?.result.season ?? 2;
let replayPolicy: Policy = { ...DEFAULT_POLICY };
let replayResult: Result | null = null;
let replayError = '';
let chartObserver: ResizeObserver | null = null;
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionRequested = loadMotion();
let sceneTimer: ReturnType<typeof setTimeout> | undefined;
let settlementTimer: ReturnType<typeof setTimeout> | undefined;
let advisorTopic: AdvisorTopic = 'briefing';
let advisorReturnFocus = 'advisor-open';
let conversationContext = '';
let conversation: { speaker: 'player' | 'advisor'; text: string }[] = [];
const originalMusic = { id: 'original', title: '小镇清晨（原创）', url: '/audio/town-theme.mp3' };
type LocalTrack = { id: string; title: string; url: string; file: File; catalogId?: string };
let localTracks: LocalTrack[] = [];
let selectedMusic = 'original';
let localTrackSequence = 0;
let musicImportTarget: string | undefined;
let musicImportMessage = '';
let musicGeneration = 0;
const music = new Audio(originalMusic.url);
music.id = 'town-music';
music.loop = true;
music.preload = 'none';
music.volume = 0.24;
document.body.append(music);
let musicRequested = true;
try { musicRequested = localStorage.getItem('prosperity-road.music.v1') !== 'off'; } catch { /* Use the default for this visit. */ }
let musicStarted = false;
let musicPending = false;
let musicUnavailable = false;
const characterVoice = createCharacterVoice(active => { music.volume = active ? 0.07 : 0.24; });

function currentVoiceLine() {
  return dialog === 'advisor' ? advisorVoiceLine(state, advisorTopic)
    : dialog === 'visit' ? visitVoiceLine(state, visitPlace, visitInspected) : null;
}

function updateMusicButton(): void {
  const button = document.getElementById('music-button');
  if (!button) return;
  button.textContent = musicUnavailable ? '♫ 重试' : !musicRequested ? '♫ 静音' : musicStarted ? '♫ 配乐开' : '♫ 配乐';
  button.setAttribute('aria-pressed', String(musicRequested && musicStarted && !musicUnavailable));
  const label = musicUnavailable ? '配乐暂时无法播放，点击重试' : !musicRequested ? '打开背景配乐' : musicStarted ? '关闭背景配乐' : '播放背景配乐；开始游戏后也会自动播放';
  button.setAttribute('aria-label', label);
  button.title = label;
  const status = document.getElementById('music-library-status');
  const track = localTracks.find(track => track.id === selectedMusic) ?? originalMusic;
  if (status) status.textContent = `${musicUnavailable ? '无法播放，请换一首或重新选择文件' : !musicRequested ? '已静音' : musicStarted ? '当前曲目' : '准备播放'} · ${track.title}`;
  document.querySelectorAll<HTMLButtonElement>('[data-action="music-select"]').forEach(control => {
    const selected = control.dataset.trackId === selectedMusic;
    control.setAttribute('aria-pressed', String(selected));
    control.textContent = selected ? '重播' : '播放';
  });
}
function syncMusic(): void {
  // Keep one audio element across renders; the demo already has its own soundtrack.
  const shouldPlay = musicRequested && musicStarted && !document.hidden && dialog !== 'pilot';
  if (!shouldPlay) music.pause();
  else if (music.paused && !musicPending && !musicUnavailable) {
    musicPending = true;
    const generation = musicGeneration;
    void music.play().then(() => {
      if (generation !== musicGeneration) return;
      musicPending = false;
      syncMusic();
    }).catch(error => {
      if (generation !== musicGeneration) return;
      musicPending = false;
      if (error instanceof DOMException && error.name === 'AbortError') { syncMusic(); return; }
      musicUnavailable = true;
      updateMusicButton();
    });
  }
  updateMusicButton();
}
music.addEventListener('error', () => {
  if (!music.error) return;
  musicUnavailable = true;
  updateMusicButton();
});
music.addEventListener('ended', () => {
  if (music.ended && selectedMusic !== 'original') nextMusic(false);
});
document.addEventListener('visibilitychange', syncMusic);

function selectMusic(id: string, start = true): void {
  const track = id === 'original' ? originalMusic : localTracks.find(track => track.id === id);
  if (!track) return;
  musicGeneration += 1;
  music.pause();
  musicPending = false;
  musicUnavailable = false;
  selectedMusic = track.id;
  music.src = track.url;
  music.loop = id === 'original' || localTracks.length <= 1;
  music.load();
  if (start) {
    musicRequested = true;
    musicStarted = true;
    try { localStorage.setItem('prosperity-road.music.v1', 'on'); } catch { /* Keep the setting for this visit. */ }
  }
  syncMusic();
}
function nextMusic(start = true): void {
  if (!localTracks.length) return;
  const index = localTracks.findIndex(track => track.id === selectedMusic);
  selectMusic(localTracks[(index + 1) % localTracks.length].id, start);
}
function importMusic(files: FileList): void {
  let imported = 0;
  let skipped = 0;
  const target = SOUNDTRACKS.find(track => track.id === musicImportTarget);
  for (const file of Array.from(files)) {
    if (!file.size || !(/\.(mp3|ogg|oga|wav|flac|m4a|aac|opus|webm)$/i.test(file.name) || file.type.startsWith('audio/'))) { skipped += 1; continue; }
    const catalog = target ?? findSoundtrack(file.name);
    const prior = localTracks.find(track => catalog ? track.catalogId === catalog.id : track.file.name === file.name && track.file.size === file.size && track.file.lastModified === file.lastModified);
    const track: LocalTrack = {
      id: prior?.id ?? `local-${++localTrackSequence}`,
      title: catalog?.title ?? file.name,
      url: URL.createObjectURL(file), file, catalogId: catalog?.id,
    };
    if (prior) localTracks.splice(localTracks.indexOf(prior), 1, track);
    else localTracks.push(track);
    if (selectedMusic === track.id) selectMusic(track.id, false);
    if (prior) URL.revokeObjectURL(prior.url);
    imported += 1;
    if (target) break;
  }
  musicImportTarget = undefined;
  music.loop = selectedMusic === 'original' || localTracks.length <= 1;
  musicImportMessage = `已加入 ${imported} 个本地文件${skipped ? `；跳过 ${skipped} 个空文件或非音频文件` : ''}。点击曲目旁的“播放”开始。`;
  render('music-import');
}

function loadPilotFeedback(): PilotFeedback {
  try { return restorePilotFeedback(localStorage.getItem(FEEDBACK_KEY)); }
  catch { return emptyPilotFeedback(); }
}
function savePilotFeedback(): void {
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(pilotFeedback));
    feedbackMessage = '反馈草稿已保存在此浏览器；下载后请交给老师。';
  } catch {
    feedbackMessage = '此浏览器无法保存反馈草稿，请在关闭页面前下载。';
  }
  const status = document.getElementById('feedback-status');
  if (status && status.textContent !== feedbackMessage) status.textContent = feedbackMessage;
}
function clearPilotFeedback(): boolean {
  pilotFeedback = emptyPilotFeedback();
  try {
    localStorage.removeItem(FEEDBACK_KEY);
    feedbackMessage = '反馈草稿已清空，游戏进度保持不变。';
    return true;
  } catch {
    feedbackMessage = '当前页面的反馈已清空，但浏览器未能删除旧草稿，刷新可能恢复。共享设备换人前，请清除本站浏览器数据或使用独立浏览器。';
    return false;
  }
}

function loadMotion(): boolean {
  try { return localStorage.getItem('prosperity-road.motion.v1') !== 'off'; }
  catch { return true; }
}
const motionEnabled = (): boolean => motionRequested && !motionQuery.matches;
function syncAdvisor(topic: AdvisorTopic = 'briefing'): void {
  const context = `${state.phase}:${state.seasonIndex}:${JSON.stringify(state.draft)}`;
  if (context !== conversationContext || !conversation.length) {
    conversationContext = context;
    advisorTopic = topic;
    conversation = [{ speaker: 'advisor', text: advisorReply(state, topic).text }];
  }
}
function playScene(): void {
  if (!motionEnabled()) return;
  const scene = document.querySelector<HTMLElement>('.economy-scene');
  if (!scene) return;
  clearTimeout(sceneTimer);
  scene.classList.remove('is-playing');
  void scene.offsetWidth;
  scene.classList.add('is-playing');
  sceneTimer = setTimeout(() => scene.classList.remove('is-playing'), 4200);
}
function playSettlement(): void {
  if (!motionEnabled()) return;
  const shell = document.querySelector('.app-shell');
  shell?.classList.add('just-settled');
  settlementTimer = setTimeout(() => shell?.classList.remove('just-settled'), 1100);
  playScene();
}
const strategies: { name: string; intent: string; policy: Policy }[] = [
  { name: '让市场调节', intent: '不设限价，不使用公共资源', policy: { cap: null, subsidy: 0, release: 0 } },
  { name: '压低面包标价', intent: '将最高价格设为 5', policy: { cap: 5, subsidy: 0, release: 0 } },
  { name: '鼓励私人生产', intent: '每单位补贴 1 credit', policy: { cap: null, subsidy: 1, release: 0 } },
  { name: '打开公共粮仓', intent: '向市场出售 20 单位储备', policy: { cap: null, subsidy: 0, release: 20 } },
];
const samePolicy = (a: Policy, b: Policy): boolean => a.cap === b.cap && a.subsidy === b.subsidy && a.release === b.release;
const signed = (value: number): string => `${value > 1e-7 ? '+' : value < -1e-7 ? '−' : ''}${fmt(Math.abs(value))}`;

function loadGame(): GameState {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return newGame();
    const restored = restoreGame(text);
    if (restored) return restored;
    storageMessage = '旧进度无法恢复，当前从新一局开始。';
  } catch {
    storageMessage = '浏览器无法读取存档。本次仍可游玩，但刷新后可能无法保留进度。';
  }
  return newGame();
}
function save(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    storageMessage = '';
  } catch {
    storageMessage = '自动保存未成功，请保持此页面打开；结束后可保存任期记录。';
  }
  const status = document.querySelector<HTMLElement>('#save-status');
  if (status) status.textContent = storageMessage || '进度自动保存在此浏览器';
}
const latestResult = (): Result | undefined => state.records.at(-1)?.result;
const settled = (): boolean => ['result', 'complete'].includes(state.phase);
function policyLabel(p: Policy): string {
  const items = [p.cap !== null ? `限价 ${p.cap}` : '', p.subsidy ? `单位补贴 ${p.subsidy}` : '', p.release ? `投放储备 ${p.release}` : ''].filter(Boolean);
  return items.join(' · ') || '无干预';
}
function tabs(): string {
  const dataView = !['command', 'town'].includes(view);
  const primary: [string, View, string][] = [['command', 'command', '本季'], ['town', 'town', '城镇'], ['data', 'market', '账本']];
  const items: [View, string][] = [['market', '供需'], ['people', '居民'], ['accounts', '账目'], ['history', '历史']];
  if (state.records.length > 1) items.push(['replay', '政策回放']);
  if (state.phase === 'complete') items.push(['report', '任期记录']);
  return `<nav class="view-tabs primary-tabs" aria-label="游戏导航">${primary.map(([key, target, label]) =>
    `<button class="tab-button" id="tab-${key}" type="button" data-action="view" data-view="${target}" aria-current="${key === 'data' ? dataView ? 'page' : 'false' : view === target ? 'page' : 'false'}">${label}</button>`).join('')}</nav>
    ${dataView ? `<nav class="view-tabs secondary-tabs" aria-label="分析数据">${items.map(([key, label]) => `<button class="tab-button" id="tab-${key}" type="button" data-action="view" data-view="${key}" aria-current="${view === key ? 'page' : 'false'}">${label}</button>`).join('')}</nav>` : ''}`;
}

function resourceCheck(): string {
  const resources = currentResources(state);
  const preview = evaluate(SEASONS[state.seasonIndex], state.draft, resources);
  return `<div class="resource-check ${preview.valid ? '' : 'error'}" ${preview.valid ? '' : 'role="alert"'}>${preview.valid ? `资源允许执行 · 投放后储备 ${fmt(resources.reserves - state.draft.release)}${resources.reserves - state.draft.release < 20 ? '，将低于任期末20单位目标' : ''}` : `${escape(preview.message)} 请减少补贴或投放。`}</div>`;
}
function commandView(): string {
  if (state.phase === 'complete') return endingView();
  if (settled()) return outcomeView();
  if (state.phase === 'briefing') return `<section class="command-view briefing">
    <button class="briefing-advisor" id="intro-advisor" type="button" data-action="advisor-open" aria-label="认识你的经济顾问林岚"><img src="/advisor-lin-lan.png" alt="林岚，身穿绿衣、手持账本的经济顾问" width="1145" height="1374" /><span>林岚 · 你的经济顾问<br><small>点击和我聊聊 →</small></span></button>
    <span class="eyebrow">你是新任经济部长</span><h3>让小镇熬过这场歉收</h3>
    <p>收成正在变差，居民还要吃饭。压低物价、支持工坊，还是打开粮仓？你来决定，看看小镇会发生什么。</p>
    <ol class="play-loop"><li><strong>选方案</strong><span>限价、补贴、开仓，也可以自由组合。</span></li>
      <li><strong>看变化</strong><span>市场价格、面包流转、居民的饭桌，立刻回应你的决定。</span></li>
      <li><strong>试另一招</strong><span>结算后对比政策，再决定下一季。</span></li></ol>
    <p class="inline-help">六季至少五季保障达标，期末留20单位储备，国库不透支。</p>
    <button class="button secondary" id="intro-pilot" type="button" data-action="pilot">看看怎么玩 · 可选演示 →</button></section>`;
  const season = SEASONS[state.seasonIndex];
  const prior = SEASONS[state.seasonIndex - 1];
  return `<section class="command-view focused-policy">
    <div class="situation"><div><span>原料上限</span><strong>${prior.K} → ${season.K}</strong></div>
      <div><span>额外单位成本</span><strong>${prior.c} → ${season.c}</strong></div><p>${season.event}</p></div>
    <div class="section-heading"><h3>选择你的应对方式</h3></div>
    <div class="strategy-grid">${strategies.map((strategy, index) => {
      const selected = samePolicy(state.draft, strategy.policy);
      const valid = evaluate(season, strategy.policy, currentResources(state)).valid;
      return `<button type="button" id="strategy-${index}" class="strategy-card ${selected ? 'selected' : ''}" data-action="strategy" data-strategy="${index}" aria-pressed="${selected}" ${valid ? '' : 'disabled'}>
        <strong>${strategy.name}</strong><span>${strategy.intent}</span>${valid ? '' : '<small>资源不足</small>'}</button>`;
    }).join('')}</div>
    <div class="selected-plan" aria-live="polite"><strong>当前组合：${policyLabel(state.draft)}</strong><p>${draftAdvice()}</p></div>
    <details class="policy-custom" id="policy-custom" ${customPolicyOpen ? 'open' : ''}><summary>微调政策组合</summary><div id="policy-controls" tabindex="-1">
      ${state.records.length > 1 ? '<button class="button ghost reuse-button" type="button" data-action="reuse">沿用上季组合</button>' : ''}
      <div class="custom-policy-grid">${policyControls(state.draft, 'draft')}</div></div></details>
    ${resourceCheck()}</section>`;
}
function draftAdvice(): string {
  const p = state.draft;
  const messages = [];
  if (p.cap !== null) messages.push(`最高标价 ${p.cap}；若压在均衡价之下，会出现配给，低价不保证多买。`);
  if (p.subsidy) messages.push(`每单位私人产量补贴 ${p.subsidy}；原料上限 ${SEASONS[state.seasonIndex].K} 不变。`);
  if (p.release) messages.push(`出售 ${p.release} 单位公共储备，余量 ${currentResources(state).reserves - p.release}；${currentResources(state).reserves - p.release < 20 ? '将低于任期末20单位目标。' : '售粮收入进入国库。'}`);
  return messages.join(' ') || '本季由市场调节价格。国库与储备不消耗，但居民保障仍要看实际成交。';
}
function outcomeView(): string {
  const r = latestResult();
  if (!r) return emptyView('先观察正常市场。');
  const feedback = outcomeFeedback(r);
  const baseline = feedback.baseline;
  const met = r.coverageLow >= .95 - 1e-9;
  const effect = (label: string, actual: number, reference: number, unit: string) =>
    `<div class="effect-card"><span>${label}</span><strong>${fmt(actual)}<small>${unit}</small></strong>
      <span class="effect-delta">${r.season === 1 ? '正常市场参考值' : `无干预 ${fmt(reference)} → 政策影响 ${signed(actual - reference)}`}</span></div>`;
  return `<section class="command-view outcome" aria-labelledby="outcome-title">
    <div class="outcome-heading ${met ? 'success' : 'warning'}"><span class="eyebrow">第 ${r.season} 季 · ${policyLabel(r.policy)}</span>
      <h3 id="outcome-title" tabindex="-1">${met ? '这一季，口粮守住了' : r.capBinding ? '标价压下来了，货架却更紧张' : '市场还有面包，居民却买不够'}</h3>
      <div class="basket-meter"><div style="width:${Math.min(100, r.coverageLow * 100)}%"></div><i></i></div>
      <p>低收入组保障 <strong>${pct(r.coverageLow)}</strong> · 目标 ≥95%${met ? '，已达标' : `，还差 ${fmt(Math.max(0, 34.2 - r.purchasesLow))} 单位面包`}</p></div>
    <div class="town-reactions" aria-label="街坊的反应">${townReactions(state).map(({ place, line }) => `<button class="town-reaction" id="reaction-${place}" type="button" data-action="scene-place" data-place="${place}"><img src="${TOWNSPEOPLE[place].image}" alt="" width="58" height="72" loading="lazy" decoding="async" /><span><strong>${TOWNSPEOPLE[place].name} · ${TOWNSPEOPLE[place].role} ↗</strong>“${line}”</span></button>`).join('')}</div>
    ${renderEconomyScene(state)}
    <p class="comparison-label">${r.season === 1 ? '正常市场 · 参考基准' : '这项决定改变了什么 · 与同季无干预相比'}</p>
    <div class="effect-grid">${effect('低收入组实际购粮', r.purchasesLow, baseline.purchasesLow, '单位')}${effect('面包价格', r.price, baseline.price, 'credits')}</div>
    <div class="resource-impact"><span>本季国库 ${fmt(r.before.cash)} → ${fmt(r.after.cash)}</span><span>储备 ${fmt(r.before.reserves)} → ${fmt(r.after.reserves)}</span><small>期初 → 期末</small></div>
    <details class="result-details"><summary>发生了什么？查看账本与原因</summary><div class="causal-feedback"><strong>林岚</strong><p>${feedback.explanation}</p></div><div class="resident-feedback"><div><span>居民的账本</span><p>${feedback.resident}</p></div><div><span>工坊的账本</span><p>${feedback.producer}</p></div></div><p class="tradeoff">${feedback.tradeoff}</p></details>
    ${r.season > 1 ? '<button class="button secondary" type="button" data-action="compare-baseline">如果当时没有干预？</button>' : '<p class="inline-help">一场歉收正在逼近。下一季，该你出手了。</p>'}
    </section>`;
}
function endingView(): string {
  const progress = goals(state.records);
  const resources = currentResources(state);
  const hardest = state.records.slice(1).reduce((lowest, row) => row.result.purchasesLow < lowest.result.purchasesLow ? row : lowest);
  return `<section class="command-view ending" aria-labelledby="ending-title">
    <span class="ending-mark" aria-hidden="true">${progress.passed ? '✦' : '◇'}</span>
    <h3 id="ending-title">${progress.passed ? '你守住了小镇的口粮' : progress.metSeasons >= 5 ? '危机过去了，粮仓还需补足' : '这次任期留下了遗憾'}</h3>
    <p>${progress.passed ? '歉收过去，国库和应急粮也留住了。小镇又能迎接新的一年。' : '六季的每个选择，都留在了小镇的账本里。换一种做法，结局会不同吗？'}</p>
    <div class="ending-stats"><div><span>居民保障达标</span><strong>${progress.metSeasons} / 6 季</strong><small>目标至少 5 季</small></div><div><span>粮仓余量</span><strong>${fmt(resources.reserves)}</strong><small>目标至少 20</small></div><div><span>剩余国库</span><strong>${fmt(resources.cash)}</strong><small>守住国库不透支</small></div></div>
    <p class="inline-help">最吃紧的是第${hardest.result.season}季，低收入组买到${fmt(hardest.result.purchasesLow)}篮。</p>
    <button class="button secondary" type="button" data-action="replay-season" data-season="${hardest.result.season}">重看第${hardest.result.season}季的选择</button>
    <button class="button ghost" type="button" data-action="download-report">保存任期记录</button>
    <button class="button ghost" id="report-pilot" type="button" data-action="pilot">留下试玩感受</button>
  </section>`;
}
function missionMarkup(): string {
  const progress = goals(state.records);
  return `<div class="mission-grid">
    <div class="mission ${progress.metSeasons >= 5 ? 'met' : ''}"><span>低收入组保障 ≥95%</span><strong>${progress.metSeasons}季达标</strong><small>六季中至少五季达标</small></div>
    <div class="mission ${progress.reserves >= 20 ? 'met' : ''}"><span>期末保留储备</span><strong>${fmt(progress.reserves)} / 20</strong><small>最终至少20单位</small></div>
    <div class="mission ${progress.solvent ? 'met' : ''}"><span>国库现金</span><strong>${progress.solvent ? '保持非负' : '未达标'}</strong><small>每季都须符合预算约束</small></div>
  </div>`;
}
function town(): string {
  const season = SEASONS[state.seasonIndex];
  const result = settled() ? latestResult() : undefined;
  const resources = currentResources(state);
  const places = [
    { id: 'farm', name: '农业区', english: 'FARMLAND', value: `原料上限 ${season.K}`, x: 24, y: 28 },
    { id: 'mill', name: '加工区', english: 'BAKERY DISTRICT', value: result ? `私人产量 ${fmt(result.privateOutput)}` : '产量待结算', x: 73, y: 30 },
    { id: 'granary', name: '公共粮仓', english: 'PUBLIC GRANARY', value: `储备 ${fmt(resources.reserves)}`, x: 29, y: 72 },
    { id: 'homes', name: '居民区', english: 'RESIDENTIAL DISTRICT', value: result ? `低收入购粮 ${fmt(result.purchasesLow)}` : '购粮待结算', x: 74, y: 75 },
  ];
  const detail: Record<string, [string, string]> = {
    farm: ['农业区 · 原料约束', `本季私人原料上限为${season.K}，额外单位成本为${season.c}。天气恢复由剧本预设；补贴不会改变当季原料上限。`],
    mill: ['加工区 · 私人生产', result
      ? `实际私人产量${fmt(result.privateOutput)}，行业利润${fmt(result.producerProfit)} credits。产量由价格、补贴、成本与原料上限共同决定。`
      : `本季额外单位成本为${season.c} credits，私人产量将在执行政策后揭示。原料上限不等于已经生产的面包。`],
    granary: ['公共粮仓 · 跨季资源', `现有公共储备${fmt(resources.reserves)}单位。投放后按市场价格出售，每单位另付0.5 credits转换配送费；售粮收入进入国库。首版不能重新采购储备。`],
    homes: ['居民区 · 获得多少比标价更重要', result
      ? `低收入组想买${fmt(result.demandLow)}、实际获得${fmt(result.purchasesLow)}；高收入组想买${fmt(result.demandHigh)}、实际获得${fmt(result.purchasesHigh)}。两组基本篮子目标各36单位。`
      : '低收入组和高收入组各有36单位的基本篮子目标。限价发生短缺时，按照两组购买意愿的比例分配现有面包。'],
  };
  return `<div class="town-map">
    <img src="/town.svg" alt="一条河穿过农业区、面包加工区、公共粮仓和居民区的示意城镇。" width="900" height="590" />
    ${places.map(place => `<button type="button" id="map-${place.id}" class="map-hotspot ${district === place.id ? 'selected' : ''}" data-action="${place.id === 'granary' ? 'district' : 'scene-place'}" data-district="${place.id}" data-place="${place.id}" aria-pressed="${district === place.id}" style="left:${place.x}%;top:${place.y}%">
      <span class="hotspot-name">${place.name}</span><span class="hotspot-english">${place.english}</span><span class="hotspot-value">${place.value}</span></button>`).join('')}
  </div><div class="map-caption">同一面包市场 · 地区位置不产生额外价格差异 · 数量为面包篮单位</div>
  <div class="district-detail" aria-live="polite"><strong>${detail[district][0]}</strong><p>${detail[district][1]}</p><button class="button secondary" id="district-advisor-${district}" type="button" data-action="scene-place" data-place="${district}">${district === 'granary' ? '请林岚解释这个地区' : `与${TOWNSPEOPLE[district as TownPlace].name}聊聊`}</button>${state.phase === 'decision' ? '<button class="button secondary" type="button" data-action="view" data-view="command">前往政策桌作出选择 →</button>' : ''}</div>
  ${renderEconomyScene(state)}
  ${state.phase === 'briefing' ? `<div class="notice"><strong>部长，欢迎上任。</strong><p>先点击地图了解四个地区，再查看正常市场。下一季起，你将决定如何应对歉收。</p>${missionMarkup()}</div>` : ''}
  ${state.phase === 'result' ? resultExplanation(latestResult()!) : ''}`;
}
function resultExplanation(result: Result): string {
  const constraint = Math.abs(result.privateOutput - SEASONS[result.season - 1].K) < 1e-7;
  const rationing = result.excessDemand > 1e-7
    ? `当前价格下想买${fmt(result.demandLow + result.demandHigh)}，市场仅提供${fmt(result.totalOutput)}。按比例配给后，低收入组实际获得${fmt(result.purchasesLow)}。`
    : `市场在当前价格出清。低收入组实际获得${fmt(result.purchasesLow)}，基本篮子完成率${pct(result.coverageLow)}；出清并不自动代表保障目标已经达到。`;
  return `<details><summary>为什么出现这个结果？</summary><div class="detail-body">
    <p>${result.policy.cap === null ? '本季未设置最高价格。' : result.capBinding ? `最高价格${result.policy.cap}低于同一政策组合下的无约束均衡价${fmt(result.equilibriumPrice)}，构成有效约束。` : `最高价格${result.policy.cap}没有约束本季均衡。`}${rationing}</p>
    <p>${constraint ? `私人原料上限${SEASONS[result.season - 1].K}已经用满。` : `私人产量${fmt(result.privateOutput)}低于原料上限${SEASONS[result.season - 1].K}。`}补贴与公共投放的作用需要结合这一约束判断。</p>
    <p>天气与成本属于当季外生条件；回放时保持这些条件相同，才能比较政策作用。</p></div></details>`;
}
function priorNote(result: Result): string {
  return `<p class="inline-help">${settled() ? '' : '本季尚未结算。以下为'}第${result.season}季已结算记录 · ${policyLabel(result.policy)}</p>`;
}
function marketView(): string {
  const result = latestResult();
  if (!result) return emptyView('先查看正常市场，即可打开供需图。');
  return `${priorNote(result)}<div class="chart" id="market-chart"></div>
    <div class="result-grid">${mini('无约束均衡价格', fmt(result.equilibriumPrice))}${mini('实际价格', fmt(result.price))}
    ${mini('实际成交', fmt(result.totalOutput))}${mini('超额需求', fmt(result.excessDemand))}</div>
    <p class="inline-help">供给曲线的垂直部分表示原料上限。${result.policy.release ? '总供给包含公共投放。' : '本季没有公共投放，总供给与私人供给重合。'}</p>
    ${resultExplanation(result)}`;
}
function mini(label: string, value: string): string {
  return `<div class="mini-stat"><span>${label}</span><strong>${value}</strong></div>`;
}
function emptyView(message: string): string {
  return `<div class="empty-state">${message}</div>`;
}
function peopleView(): string {
  const r = latestResult();
  if (!r) return emptyView('先查看正常市场，即可查看两组居民的购粮情况。');
  const max = Math.max(60, r.demandHigh, r.demandLow, r.purchasesHigh, r.purchasesLow);
  const row = (label: string, quantity: number) => `<div class="resident-row"><span>${label}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${quantity / max * 100}%"></div><span class="target-marker" style="left:${36 / max * 100}%" aria-label="目标36单位"></span></div><strong>${fmt(quantity)}</strong></div>`;
  return `${priorNote(r)}<h3 class="subheading">实际购粮 / Actual purchases</h3>
    <div class="resident-bars">${row('低收入组', r.purchasesLow)}${row('高收入组', r.purchasesHigh)}</div>
    <p class="inline-help">竖线：基本篮子目标36单位。通关要求的95%完成率相当于34.2单位。</p>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>居民组</th><th>购买意愿</th><th>实际购粮</th><th>完成率</th></tr></thead><tbody>
    <tr><td>低收入组</td><td>${fmt(r.demandLow)}</td><td>${fmt(r.purchasesLow)}</td><td>${pct(r.coverageLow)}</td></tr>
    <tr><td>高收入组</td><td>${fmt(r.demandHigh)}</td><td>${fmt(r.purchasesHigh)}</td><td>${pct(r.coverageHigh)}</td></tr></tbody></table></div>
    <div class="result-grid">${mini('市场超额需求', `${fmt(r.excessDemand)} 单位`)}${mini('基本篮子缺口', `${fmt(r.basicShortfall)} 单位`)}</div>
    <p class="inline-help">前者是当前价格下想买却未能买到的量；后者是两组实际购粮距离基本篮子目标的缺口。数量不代表家庭人数。</p>
    <details><summary>消费者剩余与分配假设</summary><div class="detail-body"><p>低收入组消费者剩余${fmt(r.consumerSurplusLow)}；高收入组${fmt(r.consumerSurplusHigh)} credits。</p>
    <p>短缺时按两组需求比例配给，组内代表性消费者优先满足边际愿付最高的单位。这里不模拟排队成本或黑市，不能把这一局部指标直接当成国家福利。</p></div></details>`;
}
function accountsView(): string {
  const r = latestResult();
  if (!r) return emptyView('先查看正常市场，即可打开国库和行业账目。');
  const rows = [
    ['期初现金', fmt(r.before.cash)], ['售粮收入', `+${fmt(r.publicSales)}`],
    ['转换配送支出', `−${fmt(r.deliveryCost)}`], ['补贴支出', `−${fmt(r.subsidyCost)}`],
    ['期末现金', fmt(r.after.cash)], ['公共储备 / 单位', `${fmt(r.before.reserves)} → ${fmt(r.after.reserves)}`],
    ['公共账面资产', fmt(r.after.cash + 3 * r.after.reserves)],
  ];
  return `${priorNote(r)}<h3 class="subheading">Treasury ledger · 国库账簿</h3>
    <table class="data-table"><thead><tr><th>项目</th><th>credits（另有注明除外）</th></tr></thead><tbody>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('')}</tbody></table>
    <p class="inline-help">公共账面资产 = 现金 + 3 × 储备。售粮把库存转为现金；账面成本不从当期现金再次扣除。</p>
    <div class="result-grid">${mini('私人行业利润', fmt(r.producerProfit))}${mini('生产者剩余', fmt(r.producerSurplus))}</div>
    <details><summary>行业成本与利润</summary><div class="detail-body"><p>私人销售收入${fmt(r.price * r.privateOutput)}，补贴收入${fmt(r.subsidyCost)}，可变成本${fmt(SEASONS[r.season - 1].c * r.privateOutput + r.privateOutput ** 2 / 40)}，固定成本30 credits。</p><p>利润 = 销售收入 + 补贴 − 可变成本 − 固定成本。公共投放不计入私人产量。</p></div></details>`;
}
function historyView(): string {
  if (!state.records.length) return emptyView('结算后，这里会保存每个季度的政策与结果。');
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>季度</th><th>政策</th><th>价格</th><th>低收入购粮</th><th>现金</th><th>储备</th></tr></thead><tbody>
    ${state.records.map(({ result: r }) => `<tr><td>${r.season} · ${SEASONS[r.season - 1].title}</td><td>${policyLabel(r.policy)}</td><td>${fmt(r.price)}</td><td>${fmt(r.purchasesLow)}</td><td>${fmt(r.after.cash)}</td><td>${fmt(r.after.reserves)}</td></tr>`).join('')}</tbody></table></div>
    <div class="history-list">${state.records.map(({ result: r, prediction }) => `<details><summary>第${r.season}季 · ${policyLabel(r.policy)}</summary><div class="detail-body">
    <p>条件：原料上限${SEASONS[r.season - 1].K}，额外单位成本${SEASONS[r.season - 1].c}。低收入组完成率${pct(r.coverageLow)}。</p>
    ${prediction.price ? `<p>当时预测：${directionName(prediction.price, '价格')}；${directionName(prediction.purchases, '购粮')}。理由：${escape(prediction.reason || '未填写')}</p>` : ''}
    ${r.season > 1 ? `<button class="button secondary" type="button" data-action="replay-season" data-season="${r.season}">比较这一季的其他政策</button>` : '<p>基期固定无干预。</p>'}</div></details>`).join('')}</div>`;
}
function directionName(direction: Direction, subject: string): string {
  return `${subject}${{ '': '未预测', up: '增加', same: '不变', down: '减少' }[direction]}`;
}
function policyControls(policy: Policy, context: 'draft' | 'replay'): string {
  const groups: { key: keyof Policy; title: string; english: string; values: (number | null)[]; help: string }[] = [
    { key: 'cap', title: '最高价格', english: 'Maximum price', values: [null, 4, 5, 6], help: '是否产生约束取决于同一政策组合下的均衡价格。' },
    { key: 'subsidy', title: '单位生产补贴', english: 'Subsidy', values: [0, 1, 2], help: '只支付给实际私人产量；不会增加当季原料上限。' },
    { key: 'release', title: '公共储备投放', english: 'Reserve release', values: [0, 10, 20], help: '按市场价格出售，每单位另付0.5配送费。' },
  ];
  return groups.map(group => `<div class="policy-group"><div class="policy-title"><strong>${group.title}</strong><span>${group.english}</span></div>
    <div class="choice-row" role="group" aria-label="${context === 'replay' ? '回放' : ''}${group.title}">${group.values.map(value =>
      `<button class="choice-button" id="${context}-${group.key}-${value ?? 'none'}" type="button" data-action="policy" data-context="${context}" data-key="${group.key}" data-value="${value ?? 'none'}" aria-pressed="${policy[group.key] === value}">${value ?? '不设'}</button>`).join('')}</div>
    <p class="policy-help">${group.help}</p></div>`).join('');
}
function replayView(): string {
  const original = state.records.find(record => record.result.season === replaySeason)?.result;
  if (!original || original.season === 1) return emptyView('第2季结算后，可以在这里比较另一种政策。');
  const result = replayResult;
  const comparison = (label: string, originalValue: number, alternative?: number, percentage = false) =>
    `<tr><td>${label}</td><td>${percentage ? pct(originalValue) : fmt(originalValue)}</td><td>${alternative === undefined ? '待运行' : percentage ? pct(alternative) : fmt(alternative)}</td><td>${alternative === undefined ? '—' : percentage ? `${signed((alternative - originalValue) * 100)} 个百分点` : signed(alternative - originalValue)}</td></tr>`;
  return `<div class="replay-banner"><strong>同一季度，换一种选择</strong><p>本次比较复制第${replaySeason}季的期初资源与天气，不改变原始游戏，也不自动延续到以后季度。</p></div>
    <label class="replay-select-label">选择已完成的季度<select id="replay-season" aria-label="选择回放季度">${state.records.filter(row => row.result.season > 1).map(row => `<option value="${row.result.season}" ${row.result.season === replaySeason ? 'selected' : ''}>第${row.result.season}季 · ${SEASONS[row.result.season - 1].title}</option>`).join('')}</select></label>
    <p class="inline-help">相同期初：现金${fmt(original.before.cash)}，储备${fmt(original.before.reserves)}；原方案：${policyLabel(original.policy)}。</p>
    <div class="replay-controls">${policyControls(replayPolicy, 'replay')}</div>
    <button class="button primary" type="button" data-action="run-replay">运行替代方案</button><p class="inline-help">调整任何一项会立即重新试算；不改写原记录，也不消耗资源。</p>
    ${replayError ? `<p class="notice error" role="alert">${escape(replayError)}</p>` : ''}
    <div class="table-wrap"><table class="data-table comparison-table"><thead><tr><th>指标</th><th>原始记录</th><th>替代方案</th><th>变化</th></tr></thead><tbody>
      ${comparison('价格', original.price, result?.price)}
      ${comparison('私人产量', original.privateOutput, result?.privateOutput)}
      ${comparison('低收入组实际购粮', original.purchasesLow, result?.purchasesLow)}
      ${comparison('低收入保障率', original.coverageLow, result?.coverageLow, true)}
      ${comparison('基本篮子缺口', original.basicShortfall, result?.basicShortfall)}
      ${comparison('私人行业利润', original.producerProfit, result?.producerProfit)}
      ${comparison('期末现金', original.after.cash, result?.after.cash)}
      ${comparison('期末储备', original.after.reserves, result?.after.reserves)}
    </tbody></table></div>${result ? `<h3 class="subheading">替代方案的供需图</h3><div class="chart" id="replay-chart"></div>${resultExplanation(result)}` : ''}`;
}
function reportView(): string {
  return `<div class="notice"><strong>你的任期记录</strong><p>每季的选择和变化已自动记下。</p></div>${missionMarkup()}${historyView()}
    <div class="report-actions"><button class="button primary" type="button" data-action="download-report">保存任期记录</button><button class="button secondary" type="button" data-action="view" data-view="command">回到任期结局</button></div>`;
}

function actionDock(): string {
  const evaluation = evaluate(SEASONS[state.seasonIndex], state.draft, currentResources(state));
  let label = '', hint = '', actions = '';
  if (state.phase === 'briefing') {
    label = '第一步 · 观察正常市场'; hint = '先建立基准，再迎接歉收。';
    actions = '<button class="button primary" type="button" data-action="settle">查看正常市场</button>';
  } else if (state.phase === 'decision') {
    label = `第${state.seasonIndex + 1}季 · ${policyLabel(state.draft)}`;
    hint = !evaluation.valid ? evaluation.message : '选好就执行，看看小镇会发生什么。';
    actions = `<button id="settle-button" class="button primary" type="button" data-action="settle" ${evaluation.valid ? '' : 'disabled'}>执行本季政策 →</button>`;
  } else if (state.phase === 'result') {
    label = `第${state.seasonIndex + 1}季已结算`; hint = '先看后果，再作下一次选择。';
    actions = `${state.seasonIndex > 0 ? `<button class="button secondary" type="button" data-action="replay-season" data-season="${state.seasonIndex + 1}">免费试算</button>` : ''}<button class="button primary" type="button" data-action="next">${state.seasonIndex === 5 ? '查看任期结局' : '进入下一季 →'}</button>`;
  } else {
    label = goals(state.records).passed ? '小镇渡过了危机' : '新的任期，试试不同的选择'; hint = '记录已保存，也可以免费重试某一季。';
    actions = '<button class="button secondary" type="button" data-action="view" data-view="replay">试试其他选择</button><button class="button primary" id="ending-restart" type="button" data-action="reset">再玩一局 →</button>';
  }
  return `<div class="action-dock" aria-label="本季主操作"><div class="dock-context"><button class="advisor-trigger" id="advisor-open" type="button" data-action="advisor-open" aria-label="与经济顾问林岚对话" aria-haspopup="dialog"><img src="/advisor-lin-lan.png" alt="" width="44" height="44" /><span>问林岚</span></button><div><strong>${label}</strong><span id="turn-status" role="status">${hint}</span></div></div><div class="dock-buttons">${actions}</div></div>`;
}

function dialogFocus(): string {
  return dialog === 'visit' ? visitReturnFocus : dialog === 'advisor' ? advisorReturnFocus : dialog === 'pilot' ? pilotReturnFocus : utilityReturnFocus;
}
function musicLibraryMarkup(): string {
  const playButton = (track: LocalTrack): string => `<button class="button secondary" id="play-${track.id}" type="button" data-action="music-select" data-track-id="${track.id}">播放</button>`;
  const groups = [...new Set(SOUNDTRACKS.map(track => track.game))];
  const extras = localTracks.filter(track => !track.catalogId);
  return `<dialog class="dialog music-library-dialog" id="game-dialog" aria-labelledby="dialog-title" aria-describedby="music-library-note">
    <div class="music-library-heading"><h2 id="dialog-title">音乐库</h2><button class="button secondary" type="button" data-action="close-dialog">返回游戏 ×</button></div>
    <p id="music-library-note">选择电脑上的音频，仅在当前页面播放，不会上传。刷新后需要重新选择文件。</p>
    <p id="music-library-status" class="music-now-playing" role="status"></p>
    <div class="music-library-controls"><button class="button primary" id="music-import" type="button" data-action="music-import">选择本地音频</button><button class="button secondary" id="music-next" type="button" data-action="music-next" ${localTracks.length ? '' : 'disabled'}>下一首</button><button class="button secondary" id="music-original" type="button" data-action="music-original">播放原创配乐</button></div>
    <input id="music-files" type="file" accept="audio/*,.mp3,.ogg,.oga,.wav,.flac,.m4a,.aac,.opus,.webm" multiple hidden />
    <p class="music-library-hint">已导入 ${localTracks.length} 首 · 本地曲目依次循环。支持批量选择，文件名相符时自动关联目录。</p>
    ${musicImportMessage ? `<p class="music-library-hint" role="status">${escape(musicImportMessage)}</p>` : ''}
    ${extras.length ? `<section><h3>其他本地曲目</h3><ul class="music-track-list">${extras.map(track => `<li><div><strong>${escape(track.title)}</strong><small>本次导入</small></div>${playButton(track)}</li>`).join('')}</ul></section>` : ''}
    ${groups.map(game => `<details class="music-catalog" open><summary>${escape(game)}</summary><ul class="music-track-list">${SOUNDTRACKS.filter(track => track.game === game).map(item => {
      const loaded = localTracks.find(track => track.catalogId === item.id);
      return `<li data-catalog-id="${item.id}"><div><strong>${escape(item.title)}</strong><small>${escape(item.scene)} · ${loaded ? '已选择文件' : '待选择文件'}</small></div><div class="music-track-actions">${loaded ? playButton(loaded) : ''}<button class="button secondary" id="choose-${item.id}" type="button" data-action="music-choose" data-catalog-id="${item.id}">${loaded ? '更换文件' : '选择文件'}</button></div></li>`;
    }).join('')}</ul></details>`).join('')}
    <div class="dialog-actions"><button class="button secondary" id="music-clear" type="button" data-action="music-clear" ${localTracks.length ? '' : 'disabled'}>清除本次导入</button><button class="button primary" type="button" data-action="close-dialog">返回游戏</button></div>
  </dialog>`;
}
function dialogMarkup(): string {
  if (!dialog) return '';
  if (dialog === 'menu') return `<dialog class="dialog menu-dialog" id="game-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title">游戏菜单</h2><div class="menu-options">
    <a class="button secondary" id="river-scenario-link" href="?scenario=river">第二剧本 · 烟囱与河流</a>
    <button class="button secondary" id="pilot-button" type="button" data-action="pilot">试玩与反馈</button>
    <button class="button secondary" id="help-button" type="button" data-action="help">玩法与规则</button>
    <button class="button secondary" id="music-library-button" type="button" data-action="music-library">音乐库</button>
    <button class="button secondary" id="motion-button" type="button" data-action="motion" aria-pressed="${motionEnabled()}" ${motionQuery.matches ? 'disabled title="已遵循系统减少动态效果设置"' : ''}>动画：${motionEnabled() ? '开' : '关'}</button>
    <button class="button danger" id="reset-button" type="button" data-action="reset">新任期</button></div>${characterVoice.menuMarkup()}<div class="dialog-actions"><button class="button primary" type="button" data-action="close-dialog">返回游戏</button></div></dialog>`;
  if (dialog === 'pilot') return pilotMarkup();
  if (dialog === 'music-library') return musicLibraryMarkup();
  if (dialog === 'advisor') return advisorMarkup();
  if (dialog === 'visit') return visitMarkup(state, visitPlace, visitInspected, characterVoice.controlsMarkup(visitVoiceLine(state, visitPlace, visitInspected)));
  if (dialog === 'reset') return `<dialog class="dialog" id="game-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title">开始新任期？</h2><p>这会替换此浏览器中的当前进度，并清空试玩反馈草稿。请先下载需要保留的记录与反馈；共享设备换人时，再开始新一局。</p><div class="dialog-actions"><button class="button secondary" type="button" data-action="close-dialog">继续当前游戏</button><button class="button danger" type="button" data-action="confirm-reset">开始新一局</button></div></dialog>`;
  return `<dialog class="dialog" id="game-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title">你的任期与模型规则</h2>
    <p>第1季认识正常市场，第2–6季管理政策。每一季选好方案就能执行，城镇和账本会立即显示变化。三个任务分别检查：</p>${missionMarkup()}
    <p>最高价格可选不设、4、5、6；单位补贴可选0、1、2；公共投放可选0、10、20。政策每季到期。</p>
    <p>需求：低收入组 max(80−8p,0)，高收入组 max(100−8p,0)。私人供给：min(K,20×max(p+s−c,0))。公共投放加到可售数量；短缺时按两组需求比例配给。</p>
    <p>天气路径预设；本版不模拟投资、工资循环、黑市和私人库存。数量是面包篮单位，不是人数。单一面包价格不等于通胀率。</p>
    <p>国库现金 = 期初现金 + 售粮收入 − 配送费 − 补贴。库存是跨季资源，不足时整组政策不执行。</p>
    <p>所有数值为课堂模型假设。<a href="https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Economics/2018/Specification-and-Sample-Assessment/International-A-Level-Economics-spec.pdf" target="_blank" rel="noopener noreferrer">Pearson IAL Economics 考纲</a></p>
    <div class="dialog-actions"><button class="button primary" type="button" data-action="close-dialog">返回游戏</button></div></dialog>`;
}
function pilotMarkup(): string {
  const rating = (key: 'ease' | 'fun', label: string, ends: string): string => `<label for="feedback-${key}">${label}<select id="feedback-${key}" data-feedback="${key}"><option value="">尚未评价</option>${[1, 2, 3, 4, 5].map(value => `<option value="${value}" ${pilotFeedback[key] === String(value) ? 'selected' : ''}>${value}</option>`).join('')}</select><small>${ends}</small></label>`;
  return `<dialog class="dialog pilot-dialog" id="game-dialog" aria-labelledby="dialog-title">
    <div class="pilot-intro"><div><span class="eyebrow">PLAYTEST · ${PILOT_VERSION}</span><h2 id="dialog-title">学生试玩</h2></div><button class="button secondary" type="button" data-action="close-dialog">返回游戏 ×</button></div>
    <p>用你自己的办法过完这六季。第一次没过关也没关系，可以随时免费试算，再试一种选择。</p>
    <ol class="pilot-steps"><li><strong>做决定</strong><span>先看看正常市场，再应对歉收。选择方案就能执行；想组合政策，再展开微调。</span></li><li><strong>看变化</strong><span>市场、居民和粮仓会回应你的决定。想知道原因，点问林岚。</span></li><li><strong>换一种试试</strong><span>免费试算不会花资源或改写记录。六季之后，看看你的任期结局。</span></li></ol>
    <p class="pilot-meta">本局已结算 ${state.records.length}/6 季 · 进度保存在当前浏览器。共享设备换人前，请先保存记录，再点「新任期」。</p>
    <details class="pilot-video"><summary>观看操作演示 · 中文旁白与字幕</summary><video id="pilot-demo" controls playsinline preload="none" poster="/prosperity-road-demo-poster.jpg" aria-label="繁荣之路学生试玩操作演示"><source src="/prosperity-road-demo.mp4" type="video/mp4" /></video><p class="pilot-note" id="demo-status">演示展示一种决策与比较方法，不是通关答案。<a href="/prosperity-road-demo.mp4" download>下载视频</a></p></details>
    <section class="pilot-feedback" aria-labelledby="feedback-title"><h3 id="feedback-title">分享试玩感受（可选）</h3><p class="pilot-note">无需填写姓名、邮箱或联系方式。下方内容和本局记录只保存在此浏览器；点击下载后，请自行把文件交给老师，不会自动上传。</p>
      <label for="feedback-code">试玩代号（选填）<input id="feedback-code" data-feedback="code" maxlength="40" autocomplete="off" placeholder="例如 P01" value="${escape(pilotFeedback.code)}" /></label>
      <div class="pilot-ratings">${rating('ease', '操作是否清楚？', '1 很难上手 → 5 很容易')}${rating('fun', '是否愿意继续玩？', '1 不太愿意 → 5 很愿意')}</div>
      <label for="feedback-stuck">哪里卡住或不符合预期？<textarea id="feedback-stuck" data-feedback="stuck" rows="3" maxlength="1000" placeholder="我在第几季点了什么？期待发生什么，实际发生了什么？">${escape(pilotFeedback.stuck)}</textarea></label>
      <label for="feedback-learned">哪次选择或结果最让你意外？<textarea id="feedback-learned" data-feedback="learned" rows="3" maxlength="1000" placeholder="可以只记下一句话，也可以留空。">${escape(pilotFeedback.learned)}</textarea></label>
      <label for="feedback-suggestion">最希望改进的一件事（选填）<textarea id="feedback-suggestion" data-feedback="suggestion" rows="2" maxlength="1000">${escape(pilotFeedback.suggestion)}</textarea></label>
      <p class="pilot-note" id="feedback-status" role="status">${escape(feedbackMessage || '可随时下载，包括还没完成一局的时候。反馈文件会附上本局的选择与结果。')}</p>
      <div class="pilot-actions"><button class="button primary" id="download-feedback" type="button" data-action="download-feedback">下载试玩反馈与记录</button><button class="button secondary" type="button" data-action="clear-feedback">清空反馈草稿</button><button class="button secondary" type="button" data-action="close-dialog">返回游戏</button></div>
    </section></dialog>`;
}
function advisorMarkup(): string {
  const reply = advisorReply(state, advisorTopic);
  const mood = { welcoming: '一起看清局势', thinking: '让我和你推敲一下', concerned: '这里有个取舍', pleased: '总算松了口气' }[reply.mood];
  return `<dialog class="dialog advisor-dialog" id="game-dialog" aria-labelledby="dialog-title">
    <header class="advisor-header"><div><span class="eyebrow">YOUR ECONOMIC ADVISER</span><h2 id="dialog-title">林岚 <small>经济顾问</small></h2></div><button class="button ghost" type="button" data-action="close-dialog" aria-label="关闭顾问对话">返回游戏 ×</button></header>
    <div class="advisor-conversation"><div class="advisor-portrait" data-mood="${reply.mood}"><div class="portrait-halo" aria-hidden="true"></div><img src="/advisor-lin-lan.png" alt="手持账本、向你解释的经济顾问林岚" width="1145" height="1374" /><span class="advisor-mood">${mood}</span><small>第${state.seasonIndex + 1}季 · ${state.phase === 'decision' ? '政策尚未执行' : settled() ? '依据已结算记录' : '任期开始前'}</small></div>
      <div class="advisor-chat">${view === 'replay' ? `<p class="advisor-context-note">林岚正在讨论第${state.seasonIndex + 1}季的正式任期。替代方案的结果请看回放对照表。</p>` : ''}<div class="conversation-log" role="log" aria-label="与林岚的对话">${conversation.map((turn, index) => `<div class="speech-bubble ${turn.speaker}" ${index === conversation.length - 1 ? 'id="advisor-reply" tabindex="-1"' : ''}><span>${turn.speaker === 'advisor' ? '林岚' : '你'}</span><p>${escape(turn.text)}</p></div>`).join('')}</div>
      ${characterVoice.controlsMarkup(advisorVoiceLine(state, advisorTopic))}
      <div class="dialogue-choices" aria-label="选择你的回应">${reply.choices.map(choice => `<button class="button secondary" type="button" data-action="advisor-topic" data-topic="${choice.topic}">${escape(choice.label)} <span aria-hidden="true">↗</span></button>`).join('')}</div>
      ${reply.action ? `<button class="button primary advisor-link" type="button" data-action="advisor-go" data-destination="${reply.action.kind}">${escape(reply.action.label)} →</button>` : ''}
      <div class="advisor-topics"><button type="button" data-action="advisor-topic" data-topic="briefing">回到本季局势</button></div>
      <p class="advisor-note">点选回应来继续对话 · 台词结合本局数据与预设剧情</p></div></div></dialog>`;
}
function talkToAdvisor(topic: AdvisorTopic, question?: string): void {
  syncAdvisor();
  if (question) {
    advisorTopic = topic;
    conversation.push({ speaker: 'player', text: question }, { speaker: 'advisor', text: advisorReply(state, topic).text });
    conversation = conversation.slice(-8);
  }
  dialog = 'advisor';
}
function render(focusId?: string): void {
  if (dialog !== 'advisor' && dialog !== 'visit') characterVoice.stop();
  chartObserver?.disconnect();
  clearTimeout(sceneTimer);
  clearTimeout(settlementTimer);
  const r = latestResult();
  const resources = currentResources(state);
  const season = SEASONS[state.seasonIndex];
  const progress = goals(state.records);
  const views: Record<View, () => string> = {
    command: commandView, town, market: marketView, people: peopleView, accounts: accountsView, history: historyView, replay: replayView, report: reportView,
  };
  app.innerHTML = `<div class="app-shell focus-layout" data-phase="${state.phase}" data-motion="${motionEnabled() ? 'on' : 'off'}">
    <header class="topbar"><div class="brand"><span class="brand-mark" aria-hidden="true">P</span><div><span class="brand-kicker">PROSPERITY ROAD</span><h1>繁荣之路</h1></div></div>
    <div class="resource-status" aria-label="当前资源与任期进度"><span>国库 <strong>${fmt(resources.cash)}</strong></span><span>储备 <strong>${fmt(resources.reserves)}</strong></span><button class="goal-status" id="goals-button" type="button" data-action="help" aria-label="查看任期目标：当前${progress.metSeasons}季达标，共需5季">达标 ${progress.metSeasons}/5季</button></div>
    <div class="top-actions"><button class="button ghost" id="music-button" type="button" data-action="music">♫ 配乐</button><button class="button ghost" id="menu-button" type="button" data-action="menu" aria-haspopup="dialog">菜单</button></div></header>
    ${storageMessage ? `<p class="notice warning" role="status">${escape(storageMessage)}</p>` : ''}
    ${tabs()}<div class="workspace"><main class="main-panel">
      <div class="season-heading"><div><span class="eyebrow">面包危机 · 第 ${season.id} / 6 季</span><h2 class="season-title" id="season-title" tabindex="-1">${state.phase === 'complete' ? '任期结束' : season.title}</h2></div><span class="season-badge">${{ briefing: '开始你的任期', decision: '政策尚未执行', result: '本季已结算', complete: '任期战报' }[state.phase]}</span></div>
      ${notice ? `<p class="notice" role="status">${escape(notice)}</p>` : ''}
      <div id="active-view" aria-label="当前经济视图">${views[view]()}</div>
    </main></div>
    <div class="footer-note"><span>经济模拟 · 游戏数值</span><span id="save-status">${escape(storageMessage || '进度自动保存在此浏览器')}</span></div>
    ${actionDock()}${dialogMarkup()}</div>`;
  syncMusic();
  characterVoice.syncControls();
  document.querySelector<HTMLDetailsElement>('#policy-custom')?.addEventListener('toggle', event => {
    customPolicyOpen = (event.currentTarget as HTMLDetailsElement).open;
  });
  const chart = document.querySelector<HTMLElement>('#market-chart');
  const replayChart = document.querySelector<HTMLElement>('#replay-chart');
  if (chart && r) {
    drawMarketChart(chart, r);
    chartObserver = new ResizeObserver(() => drawMarketChart(chart, r));
    chartObserver.observe(chart);
  } else if (replayChart && replayResult) {
    const comparison = replayResult;
    drawMarketChart(replayChart, comparison);
    chartObserver = new ResizeObserver(() => drawMarketChart(replayChart, comparison));
    chartObserver.observe(replayChart);
  }
  if (!motionEnabled()) {
    const replay = document.querySelector<HTMLButtonElement>('#scene-replay-button');
    if (replay) { replay.disabled = true; replay.textContent = '动画已关闭'; }
  }
  if (dialog) {
    const element = document.querySelector<HTMLDialogElement>('#game-dialog')!;
    element.showModal();
    element.addEventListener('cancel', event => {
      event.preventDefault();
      const trigger = dialogFocus();
      dialog = null; render(trigger);
    });
    element.querySelector('#pilot-demo source')?.addEventListener('error', () => {
      const status = document.getElementById('demo-status');
      if (status) status.textContent = '视频暂时无法加载，可继续按上面的三个步骤试玩，或请老师播放下载的视频。';
    });
    if (dialog === 'advisor') {
      const log = element.querySelector('.conversation-log');
      if (log) log.scrollTop = log.scrollHeight;
    }
    if (focusId) element.querySelector<HTMLElement>(`#${focusId}`)?.focus({ preventScroll: true });
  } else if (focusId) {
    const target = document.getElementById(focusId) ?? (focusId === visitReturnFocus ? document.getElementById('tab-town') : focusId === advisorReturnFocus ? document.getElementById('advisor-open') : document.getElementById('menu-button'));
    target?.focus({ preventScroll: true });
  }
}
function beginReplay(season: number): void {
  const record = state.records.find(row => row.result.season === season);
  if (!record || season === 1) return;
  replaySeason = season;
  replayPolicy = { ...record.result.policy };
  replayResult = record.result;
  replayError = '';
  view = 'replay';
}
function runReplay(): void {
  const original = state.records.find(row => row.result.season === replaySeason)?.result;
  if (!original) return;
  const evaluation = evaluate(SEASONS[replaySeason - 1], replayPolicy, original.before);
  replayResult = evaluation.valid ? evaluation.result : null;
  replayError = evaluation.valid ? '' : evaluation.message;
}
function downloadReport(): void {
  const progress = goals(state.records);
  const rows = state.records.map(({ result: r }) => `| ${r.season} | ${policyLabel(r.policy)} | ${fmt(r.price)} | ${fmt(r.purchasesLow)} | ${pct(r.coverageLow)} | ${fmt(r.after.cash)} | ${fmt(r.after.reserves)} |`);
  const predictions = state.records.filter(row => row.prediction.price).map(({ result: r, prediction: p }) => `- 第${r.season}季：${directionName(p.price, '价格')}；${directionName(p.purchases, '购粮')}。理由：${p.reason || '未填写'}`);
  const legacyNotes = Object.values(state.report).filter(Boolean).join('\n\n');
  const text = `# 面包危机 · 任期记录\n\n达标季度：${progress.metSeasons}/6；期末储备：${fmt(progress.reserves)}；经营目标：${progress.passed ? '达成' : '未全部达成'}。\n\n## 六季记录\n\n| 季度 | 政策 | 价格 | 低收入购粮 | 保障率 | 期末现金 | 期末储备 |\n|---|---|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n${predictions.length ? `\n## 旧版预测记录\n\n${predictions.join('\n')}\n` : ''}${legacyNotes ? `\n## 旧版留存笔记\n\n${legacyNotes}\n` : ''}\n经济模拟游戏记录；数值为游戏规则，不是现实预测。\n`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = '面包危机-任期记录.md'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
app.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'voice-replay') {
    const line = currentVoiceLine();
    if (line) characterVoice.play(line);
    return;
  }
  if (action === 'voice-stop') { characterVoice.stop(); return; }
  if (action === 'music') {
    musicRequested = !musicStarted || musicUnavailable || !musicRequested;
    musicStarted = true;
    if (musicUnavailable) { musicGeneration += 1; musicPending = false; musicUnavailable = false; music.load(); }
    try { localStorage.setItem('prosperity-road.music.v1', musicRequested ? 'on' : 'off'); } catch { /* Keep the setting for this visit. */ }
    syncMusic();
    return;
  }
  if (action === 'music-import' || action === 'music-choose') {
    musicImportTarget = action === 'music-choose' ? button.dataset.catalogId : undefined;
    const input = document.getElementById('music-files') as HTMLInputElement;
    input.multiple = !musicImportTarget;
    input.value = '';
    input.click();
    return;
  }
  if (action === 'music-select') { selectMusic(button.dataset.trackId!); return; }
  if (action === 'music-next') { nextMusic(); return; }
  if (action === 'music-original') { selectMusic('original'); return; }
  if (action === 'music-clear') {
    const removed = localTracks;
    localTracks = [];
    if (selectedMusic !== 'original') selectMusic('original', false);
    for (const track of removed) URL.revokeObjectURL(track.url);
    musicImportMessage = '本次导入已清除，电脑上的原文件保持不变。';
    render('music-import');
    return;
  }
  if (['settle', 'strategy', 'next', 'replay-season', 'scene-place', 'scene-replay'].includes(action ?? '')) {
    musicStarted = true;
    syncMusic();
  }
  let focusId = button.id || undefined;
  let animateSettlement = false;
  notice = '';
  if (action === 'menu') {
    utilityReturnFocus = 'menu-button'; dialog = 'menu';
  } else if (action === 'music-library') {
    utilityReturnFocus = 'menu-button'; dialog = 'music-library'; focusId = 'music-import';
  } else if (action === 'pilot') {
    pilotReturnFocus = dialog === 'menu' ? 'menu-button' : button.id || 'menu-button';
    dialog = 'pilot';
  } else if (action === 'download-feedback') {
    const text = pilotFeedbackReport(state, pilotFeedback);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = '繁荣之路-试玩反馈.md'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    feedbackMessage = '反馈文件已生成。请在下载目录找到文件并交给老师；尚未自动发送。';
    document.getElementById('feedback-status')!.textContent = feedbackMessage;
    return;
  } else if (action === 'clear-feedback') {
    clearPilotFeedback();
    focusId = 'feedback-code';
  } else if (action === 'motion') {
    motionRequested = !motionRequested;
    try { localStorage.setItem('prosperity-road.motion.v1', motionRequested ? 'on' : 'off'); } catch { /* Keep the setting for this visit. */ }
  } else if (action === 'advisor-open') {
    advisorReturnFocus = button.id || 'advisor-open';
    talkToAdvisor('briefing');
    focusId = 'advisor-reply';
  } else if (action === 'advisor-topic') {
    talkToAdvisor(button.dataset.topic as AdvisorTopic, button.textContent!.replace(/↗/g, '').trim());
    focusId = 'advisor-reply';
  } else if (action === 'advisor-go') {
    const destination = advisorReply(state, advisorTopic).action?.kind;
    if (destination !== button.dataset.destination) return;
    dialog = null;
    if (destination === 'policy' && state.phase === 'decision') {
      view = 'command'; customPolicyOpen = true; render('policy-controls');
      document.getElementById('policy-controls')?.scrollIntoView({ block: 'center' });
    } else if (destination === 'market' && latestResult()) {
      view = 'market'; render('tab-market');
      document.querySelector('.view-tabs')?.scrollIntoView({ block: 'start' });
    } else if (destination === 'replay' && state.records.length >= 2) {
      beginReplay(latestResult()!.season); render('replay-season');
      document.querySelector('.view-tabs')?.scrollIntoView({ block: 'start' });
    } else render('advisor-open');
    return;
  } else if (action === 'scene-place') {
    const place = button.dataset.place!;
    if (Object.hasOwn(TOWNSPEOPLE, place)) {
      visitPlace = place as TownPlace;
      visitInspected = false;
      visitReturnFocus = button.id || 'tab-town';
      if (button.dataset.district) district = button.dataset.district;
      dialog = 'visit'; focusId = 'visit-line';
    } else if (place === 'granary') {
      advisorReturnFocus = button.id || 'advisor-open';
      talkToAdvisor('reserves', '我该怎样使用公共粮仓？'); focusId = 'advisor-reply';
    } else return;
  } else if (action === 'visit-inspect' && dialog === 'visit') {
    visitInspected = !visitInspected;
    focusId = 'visit-inspect';
  } else if (action === 'visit-next' && dialog === 'visit') {
    visitPlace = TOWNSPEOPLE[visitPlace].next;
    visitInspected = false;
    focusId = 'visit-line';
  } else if (action === 'visit-advisor' && dialog === 'visit') {
    const topics: Record<TownPlace, AdvisorTopic> = { farm: 'farm', mill: 'production', market: 'market', homes: 'access' };
    advisorReturnFocus = visitReturnFocus;
    talkToAdvisor(topics[visitPlace], `请解释一下${TOWNSPEOPLE[visitPlace].name}说的情况。`); focusId = 'advisor-reply';
  } else if (action === 'visit-plan' && dialog === 'visit') {
    dialog = null;
    if (state.phase === 'decision') {
      view = 'command'; render('season-title');
    } else if (state.records.length >= 2) {
      beginReplay(latestResult()!.season); render('replay-season');
    } else render(visitReturnFocus);
    document.querySelector('.workspace')?.scrollIntoView({ block: 'start' });
    return;
  } else if (action === 'scene-replay') {
    playScene(); return;
  } else if (action === 'view') {
    const requested = button.dataset.view as View;
    if (requested === 'report' && state.phase !== 'complete') return;
    if (requested === 'replay' && state.records.length < 2) return;
    view = requested;
    focusId = `tab-${requested}`;
    if (view === 'replay' && !state.records.some(row => row.result.season === replaySeason)) beginReplay(2);
  } else if (action === 'strategy') {
    const strategy = strategies[Number(button.dataset.strategy)];
    if (!strategy) return;
    state = choosePolicy(state, strategy.policy);
    customPolicyOpen = false;
    save();
  } else if (action === 'district') district = button.dataset.district!;
  else if (action === 'policy') {
    const key = button.dataset.key as keyof Policy;
    const value = button.dataset.value === 'none' ? null : Number(button.dataset.value);
    if (button.dataset.context === 'replay') {
      replayPolicy = { ...replayPolicy, [key]: value } as Policy;
      runReplay();
    } else {
      state = choosePolicy(state, { ...state.draft, [key]: value } as Policy);
      save();
    }
  } else if (action === 'reuse') {
    const prior = latestResult();
    if (prior) state = choosePolicy(state, prior.policy);
    notice = '已沿用上季组合。准备好了就执行。';
    save();
  } else if (action === 'settle') {
    const outcome = settleTurn(state);
    if (!outcome.ok) notice = outcome.message;
    else { state = outcome.state; view = 'command'; focusId = 'outcome-title'; animateSettlement = true; save(); }
  } else if (action === 'next') {
    state = nextSeason(state);
    customPolicyOpen = false;
    view = 'command';
    focusId = 'season-title';
    save();
  } else if (action === 'replay-season') {
    beginReplay(Number(button.dataset.season));
    focusId = 'replay-season';
  }
  else if (action === 'compare-baseline') {
    beginReplay(state.seasonIndex + 1);
    replayPolicy = { ...DEFAULT_POLICY };
    runReplay();
    focusId = 'replay-season';
  } else if (action === 'run-replay') runReplay();
  else if (action === 'help' || action === 'reset') {
    utilityReturnFocus = dialog === 'menu' ? 'menu-button' : button.id || 'menu-button';
    dialog = action;
  }
  else if (action === 'close-dialog') {
    focusId = dialogFocus();
    dialog = null;
  }
  else if (action === 'confirm-reset') {
    state = newGame(); view = 'command'; dialog = null;
    customPolicyOpen = false;
    conversation = []; conversationContext = ''; advisorTopic = 'briefing';
    if (clearPilotFeedback()) feedbackMessage = '';
    else notice = feedbackMessage;
    focusId = 'season-title';
    replaySeason = 2; replayPolicy = { ...DEFAULT_POLICY }; replayResult = null; replayError = '';
    save();
  } else if (action === 'download-report') { downloadReport(); return; }
  render(focusId);
  if (['advisor-open', 'advisor-topic', 'scene-place', 'visit-next', 'visit-inspect', 'visit-advisor'].includes(action ?? '')) {
    const line = currentVoiceLine();
    if (line) characterVoice.play(line);
  }
  if (animateSettlement) playSettlement();
  if (['settle', 'next', 'confirm-reset', 'replay-season', 'compare-baseline'].includes(action ?? '')) {
    document.querySelector('.workspace')?.scrollIntoView({ block: 'start' });
  }
});
app.addEventListener('change', event => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (target.id === 'voice-language') {
    const value = target.value;
    if (value === 'zh' || value === 'en' || value === 'off') characterVoice.setSetting(value);
    render('voice-language');
    return;
  }
  if (target.id === 'music-files') {
    const files = (target as HTMLInputElement).files;
    if (files?.length) importMusic(files);
    return;
  }
  if (target.id === 'replay-season') { beginReplay(Number(target.value)); render('replay-season'); return; }
});
app.addEventListener('input', event => {
  const target = event.target as HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement;
  if (target.dataset.feedback && Object.hasOwn(pilotFeedback, target.dataset.feedback)) {
    const key = target.dataset.feedback as keyof PilotFeedback;
    pilotFeedback[key] = target.value.slice(0, key === 'code' ? 40 : 1000);
    savePilotFeedback();
    return;
  }
});
motionQuery.addEventListener('change', () => render());
render();
