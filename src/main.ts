import './style.css';
import './companion.css';
import './pilot.css';
import { DEFAULT_POLICY, SEASONS, evaluate } from './economy.ts';
import type { Policy, Result } from './economy.ts';
import { choosePolicy, currentResources, goals, needsPrediction, newGame, nextSeason, predictionComplete, restoreGame, settleTurn } from './campaign.ts';
import type { Direction, GameState, Report } from './campaign.ts';
import { drawMarketChart } from './charts.ts';
import { outcomeFeedback } from './feedback.ts';
import { advisorReply } from './advisor.ts';
import type { AdvisorTopic } from './advisor.ts';
import { renderEconomyScene } from './scene.ts';
import './focus.css';
import { PILOT_VERSION, emptyPilotFeedback, restorePilotFeedback, pilotFeedbackReport } from './pilot.ts';
import type { PilotFeedback } from './pilot.ts';

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
let view: View = state.phase === 'complete' ? 'report' : 'command';
let district = 'farm';
let decisionStep: 'policy' | 'prediction' = state.phase === 'decision' &&
  (state.prediction.price || state.prediction.purchases || state.prediction.reason) ? 'prediction' : 'policy';
let customPolicyOpen = false;
let utilityReturnFocus = 'menu-button';
let notice = '';
let dialog: 'help' | 'reset' | 'advisor' | 'pilot' | 'menu' | null = null;
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
const predictionReasons = ['原料不足限制生产', '价格改变购买与生产意愿', '补贴可能增加私人生产', '公共投放增加可售量'];
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
    storageMessage = '自动保存未成功，请保持此页面打开；结束后可下载复盘报告。';
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
  const primary: [string, View, string][] = [['command', 'command', '本季'], ['town', 'town', '城镇'], ['data', 'market', '数据与复盘']];
  const items: [View, string][] = [['market', '供需'], ['people', '居民'], ['accounts', '账目'], ['history', '历史']];
  if (state.records.length > 1) items.push(['replay', '政策回放']);
  if (state.phase === 'complete') items.push(['report', '学习复盘']);
  return `<nav class="view-tabs primary-tabs" aria-label="游戏导航">${primary.map(([key, target, label]) =>
    `<button class="tab-button" id="tab-${key}" type="button" data-action="view" data-view="${target}" aria-current="${key === 'data' ? dataView ? 'page' : 'false' : view === target ? 'page' : 'false'}">${label}</button>`).join('')}</nav>
    ${dataView ? `<nav class="view-tabs secondary-tabs" aria-label="分析数据">${items.map(([key, label]) => `<button class="tab-button" id="tab-${key}" type="button" data-action="view" data-view="${key}" aria-current="${view === key ? 'page' : 'false'}">${label}</button>`).join('')}</nav>` : ''}`;
}
function stageTrack(): string {
  if (view !== 'command' || state.phase === 'briefing' || state.phase === 'complete') return '';
  const step = settled() ? 'result' : decisionStep;
  const predictionRequired = settled() ? Boolean(state.records.at(-1)?.prediction.price) : needsPrediction(state);
  return `<div class="stage-track" aria-label="本季步骤"><span ${step === 'policy' ? 'aria-current="step"' : ''}>1 选方案</span><span ${step === 'prediction' ? 'aria-current="step"' : ''}>2 ${predictionRequired ? '作预测' : '确认资源'}</span><span ${step === 'result' ? 'aria-current="step"' : ''}>3 看结果</span></div>`;
}
function resourceCheck(): string {
  const resources = currentResources(state);
  const preview = evaluate(SEASONS[state.seasonIndex], state.draft, resources);
  return `<div class="resource-check ${preview.valid ? '' : 'error'}" ${preview.valid ? '' : 'role="alert"'}>${preview.valid ? `资源允许执行 · 投放后储备 ${fmt(resources.reserves - state.draft.release)}${resources.reserves - state.draft.release < 20 ? '，将低于任期末20单位目标' : ''}` : `${escape(preview.message)} 请减少补贴或投放。`}</div>`;
}
function commandView(): string {
  if (settled()) return outcomeView();
  if (state.phase === 'briefing') return `<section class="command-view briefing">
    <button class="briefing-advisor" id="intro-advisor" type="button" data-action="advisor-open" aria-label="认识你的经济顾问林岚"><img src="/advisor-lin-lan.png" alt="林岚，身穿绿衣、手持账本的经济顾问" width="1145" height="1374" /><span>林岚 · 你的经济顾问<br><small>点击和我聊聊 →</small></span></button>
    <span class="eyebrow">你是新任经济部长</span><h3>面包便宜了，居民就能吃饱吗？</h3>
    <p>一场歉收即将到来。你有五次决策机会，让居民获得足够的面包，同时保住国库和应急储备。</p>
    <ol class="play-loop"><li><strong>选方案</strong><span>限价、补贴、开仓，也可以自由组合。</span></li>
      <li><strong>看后果</strong><span>实际买到多少，比标价更重要。</span></li>
      <li><strong>试另一招</strong><span>结算后对比政策，再决定下一季。</span></li></ol>
    <p class="inline-help">六季至少五季保障达标，期末留20单位储备，国库不透支。</p>
    <button class="button secondary" id="intro-pilot" type="button" data-action="pilot">首次试玩？查看任务与演示 →</button></section>`;
  if (decisionStep === 'prediction' && needsPrediction(state)) return `<section class="command-view focused-prediction">
    <div class="selected-plan"><strong>本季方案：${policyLabel(state.draft)}</strong><p>先留下判断，再执行。预测错误也可以继续。</p></div>
    ${predictionFields()}${resourceCheck()}</section>`;
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
    ${resourceCheck()}${!needsPrediction(state) ? '<p class="inline-help">本季无需预测，选好后即可执行。</p>' : ''}</section>`;
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
    <div class="outcome-heading ${met ? 'success' : 'warning'}"><span class="eyebrow">第 ${r.season} 季结算 · ${policyLabel(r.policy)}</span>
      <h3 id="outcome-title" tabindex="-1">${feedback.headline}</h3>
      <div class="basket-meter"><div style="width:${Math.min(100, r.coverageLow * 100)}%"></div><i></i></div>
      <p>低收入组保障 <strong>${pct(r.coverageLow)}</strong> · 目标 ≥95%${met ? '，已达标' : `，还差 ${fmt(Math.max(0, 34.2 - r.purchasesLow))} 单位面包`}</p></div>
    <p class="comparison-label">${r.season === 1 ? '正常市场 · 参考基准' : '政策影响：与同一季度、不干预相比'}</p>
    <div class="effect-grid">${effect('低收入组实际购粮', r.purchasesLow, baseline.purchasesLow, '单位')}${effect('面包价格', r.price, baseline.price, 'credits')}</div>
    <div class="resource-impact"><span>本季国库 ${fmt(r.before.cash)} → ${fmt(r.after.cash)}</span><span>储备 ${fmt(r.before.reserves)} → ${fmt(r.after.reserves)}</span><small>期初 → 期末</small></div>
    <div class="causal-feedback"><strong>林岚 · 为什么会这样？</strong><p>${feedback.explanation}</p></div>
    <p class="tradeoff"><strong>代价与取舍</strong> ${feedback.tradeoff}</p>
    ${renderEconomyScene(state)}
    <details class="result-details"><summary>居民、生产者与经济概念</summary><div class="resident-feedback"><div><span>居民的账本</span><p>${feedback.resident}</p></div><div><span>生产者的账本</span><p>${feedback.producer}</p></div></div><p>${feedback.lesson}</p></details>
    ${forecastReview(r)}
    ${r.season > 1 ? '<button class="button secondary" type="button" data-action="compare-baseline">对照本季无干预</button>' : '<p class="inline-help">下一季将发生歉收，你将开始选择政策。</p>'}
    </section>`;
}
function forecastReview(r: Result): string {
  const prediction = state.records.at(-1)!.prediction;
  const prior = state.records.at(-2)?.result;
  if (!prediction.price || !prior) return '';
  const direction = (delta: number): Direction => Math.abs(delta) < 1e-7 ? 'same' : delta > 0 ? 'up' : 'down';
  const check = (key: 'price' | 'purchases', label: string, delta: number) => `<div class="forecast-feedback"><strong>${prediction[key] === direction(delta) ? '✓ 判断一致' : '↗ 修正直觉'}</strong><span>${directionName(prediction[key], label)} → 实际${directionName(direction(delta), label)}</span></div>`;
  return `<details class="result-details" id="forecast-review"><summary>核对我的预测 · 与上季相比</summary><p class="inline-help">预测核对上季；上方政策影响对照同季无干预。两种比较的参照不同。</p>${check('price', '价格', r.price - prior.price)}${check('purchases', '购粮', r.purchasesLow - prior.purchasesLow)}<p>你的理由：${escape(prediction.reason)}</p></details>`;
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
    ${places.map(place => `<button type="button" class="map-hotspot ${district === place.id ? 'selected' : ''}" data-action="district" data-district="${place.id}" aria-pressed="${district === place.id}" style="left:${place.x}%;top:${place.y}%">
      <span class="hotspot-name">${place.name}</span><span class="hotspot-english">${place.english}</span><span class="hotspot-value">${place.value}</span></button>`).join('')}
  </div><div class="map-caption">同一面包市场 · 地区位置不产生额外价格差异 · 数量为面包篮单位</div>
  <div class="district-detail" aria-live="polite"><strong>${detail[district][0]}</strong><p>${detail[district][1]}</p><button class="button secondary" id="district-advisor-${district}" type="button" data-action="scene-place" data-place="${district}">请林岚解释这个地区</button>${state.phase === 'decision' ? '<button class="button secondary" type="button" data-action="guide-policy">前往政策桌作出选择 →</button>' : ''}</div>
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
  const progress = goals(state.records);
  const labels: [keyof Report, string, string][] = [
    ['action', '我的措施 · Decision', '我在哪些季度采取了什么措施？'],
    ['evidence', '变化与证据 · Evidence', '引用具体季度、数值或图表，说明谁受益、谁承担成本。'],
    ['explanation', '为什么 · Analysis', '解释从政策到价格、产量和实际购粮的因果链。'],
    ['conditions', '何时改变决定 · Evaluation', '结合原料、时间、财政和不同群体，说明政策的适用条件。'],
  ];
  return `<div class="notice ${progress.passed ? 'success' : ''}"><strong>${progress.passed ? '任期目标已达成' : '任期结束，仍有值得追问的取舍'}</strong><p>任务结果与学习评价分别记录。达成目标不代表某种政策在所有环境下最优。</p></div>
    ${missionMarkup()}<p class="evaluation-question">Evaluate whether a maximum price was the most effective response to the food shortage in your country.</p>
    <div class="report-form">${labels.map(([key, label, prompt]) => `<label>${label}<textarea data-report="${key}" maxlength="3000" rows="3" placeholder="${prompt}">${escape(state.report[key])}</textarea></label>`).join('')}</div>
    <div class="report-actions"><button class="button primary" type="button" data-action="download-report">下载本局报告</button><button class="button secondary" type="button" data-action="view" data-view="replay">先回放一项政策</button><button class="button secondary" id="report-pilot" type="button" data-action="pilot">完成试玩反馈</button></div>
    <details><summary>数量练习 · Price elasticity of demand</summary><div class="detail-body"><p>使用两组固定的无干预参考数据：基期价格5、成交100；歉收价格6.875、成交70。以基期为百分比基准，计算PED，并解释结果。</p>
    <details><summary>完成后查看参考解释</summary><p>PED = [(70−100)/100] ÷ [(6.875−5)/5] = −0.80。按这个区间与基准计算，需求缺乏价格弹性。需求曲线不变，供给变化产生两个均衡点；不能据此估算同一条供给曲线的PES，也不能用限价后被配给的成交量冒充需求量。</p></details></div></details>
    <details><summary>教师评价与迁移任务</summary><div class="detail-body"><p>AO1：概念准确；AO2：引用本局证据；AO3：解释完整因果链；AO4：结合条件比较方案。教师可按每项0、1、2级记录；这是课堂量表，不是Pearson官方分数或考试等级。</p>
    <p>迁移：人口流入使某城市租房需求上升，短期住房供给缺乏弹性。评价低于新均衡租金的最高租金与新建住房补贴能否改善低收入家庭获得住房的情况。</p></div></details>`;
}
function predictionHint(): string {
  const missing = [!state.prediction.price && '价格方向', !state.prediction.purchases && '购粮方向', !state.prediction.reason.trim() && '一个理由'].filter(Boolean);
  return missing.length ? `还差：${missing.join('、')}` : '预测已记录，答错也可以继续。';
}
function predictionFields(): string {
  if (!needsPrediction(state)) return '<p class="inline-help">本季无需预测，选好组合即可执行。</p>';
  const row = (key: 'price' | 'purchases', label: string) => `<div class="prediction-options" id="prediction-${key}" role="group" aria-label="${label}"><span>${label}</span><div>${(['up', 'same', 'down'] as const).map(value => `<button type="button" class="choice-button" id="prediction-${key}-${value}" data-action="predict" data-key="${key}" data-value="${value}" aria-pressed="${state.prediction[key] === value}">${value === 'up' ? '↑ 上升' : value === 'down' ? '↓ 下降' : '→ 不变'}</button>`).join('')}</div></div>`;
  return `<section class="prediction-form" id="prediction-section" tabindex="-1"><h3>02 · 点选你的预测</h3><p class="inline-help">与上季已结算结果相比。无需预测准确才能继续。</p>
    ${row('price', '面包价格')}${row('purchases', '低收入组实际购粮')}
    <p class="policy-help">你主要依据什么？选一项，或自己写。</p>
    <div class="reason-chips" role="group" aria-label="预测理由">${predictionReasons.map((reason, index) => `<button type="button" id="reason-${index}" class="reason-chip" data-action="reason" data-reason="${index}" aria-pressed="${state.prediction.reason === reason}">${reason}</button>`).join('')}</div>
    <details ${state.prediction.reason && !predictionReasons.includes(state.prediction.reason) ? 'open' : ''}><summary>自己写一个理由</summary><label class="detail-body">我的理由<textarea id="prediction-reason" data-prediction="reason" rows="2" maxlength="3000" placeholder="哪些约束或机制会起作用？">${escape(state.prediction.reason)}</textarea></label></details></section>`;
}
function actionDock(): string {
  const evaluation = evaluate(SEASONS[state.seasonIndex], state.draft, currentResources(state));
  const missing = needsPrediction(state) && !predictionComplete(state.prediction);
  const choosing = needsPrediction(state) && decisionStep === 'policy';
  let label = '', hint = '', actions = '';
  if (state.phase === 'briefing') {
    label = '第一步 · 观察正常市场'; hint = '先建立基准，再迎接歉收。';
    actions = '<button class="button primary" type="button" data-action="settle">查看正常市场</button>';
  } else if (state.phase === 'decision') {
    label = choosing ? '选好方案，再留下你的判断' : `第${state.seasonIndex + 1}季 · ${policyLabel(state.draft)}`;
    hint = !evaluation.valid ? evaluation.message : choosing ? '政策仅在本季生效，可展开微调组合。' : missing ? predictionHint() : '执行后可免费试算其他选择。';
    actions = choosing
      ? `<button id="prediction-next" class="button primary" type="button" data-action="guide-prediction" ${evaluation.valid ? '' : 'disabled'}>下一步：预测 →</button>`
      : `${needsPrediction(state) ? '<button class="button secondary" type="button" data-action="guide-policy">← 返回选方案</button>' : ''}<button id="settle-button" class="button primary" type="button" data-action="settle" ${!evaluation.valid || missing ? 'disabled' : ''}>执行本季政策 →</button>`;
  } else if (state.phase === 'result') {
    label = `第${state.seasonIndex + 1}季已结算`; hint = '先看后果，再作下一次选择。';
    actions = `${runnableReplay()}<button class="button primary" type="button" data-action="next">${state.seasonIndex === 5 ? '结束任期，进入复盘' : '进入下一季 →'}</button>`;
  } else {
    label = goals(state.records).passed ? '任期任务完成' : '任期结束 · 继续研究你的选择'; hint = '进度已保存，可以下载自己的学习报告。';
    actions = '<button class="button secondary" type="button" data-action="view" data-view="replay">政策试验室</button><button class="button primary" type="button" data-action="view" data-view="report">查看学习复盘</button>';
  }
  return `<div class="action-dock" aria-label="本季主操作"><div class="dock-context"><button class="advisor-trigger" id="advisor-open" type="button" data-action="advisor-open" aria-label="与经济顾问林岚对话" aria-haspopup="dialog"><img src="/advisor-lin-lan.png" alt="" width="44" height="44" /><span>问林岚</span></button><div><strong>${label}</strong><span id="prediction-status" role="status">${hint}</span></div></div><div class="dock-buttons">${actions}</div></div>`;
}
function runnableReplay(): string {
  return state.seasonIndex > 0 ? `<button class="button secondary" type="button" data-action="replay-season" data-season="${state.seasonIndex + 1}">免费试算</button>` : '';
}
function dialogFocus(): string {
  return dialog === 'advisor' ? advisorReturnFocus : dialog === 'pilot' ? pilotReturnFocus : utilityReturnFocus;
}
function dialogMarkup(): string {
  if (!dialog) return '';
  if (dialog === 'menu') return `<dialog class="dialog menu-dialog" id="game-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title">游戏菜单</h2><div class="menu-options">
    <button class="button secondary" id="pilot-button" type="button" data-action="pilot">试玩与反馈</button>
    <button class="button secondary" id="help-button" type="button" data-action="help">玩法与规则</button>
    <button class="button secondary" id="motion-button" type="button" data-action="motion" aria-pressed="${motionEnabled()}" ${motionQuery.matches ? 'disabled title="已遵循系统减少动态效果设置"' : ''}>动画：${motionEnabled() ? '开' : '关'}</button>
    <button class="button danger" id="reset-button" type="button" data-action="reset">新任期</button></div><div class="dialog-actions"><button class="button primary" type="button" data-action="close-dialog">返回游戏</button></div></dialog>`;
  if (dialog === 'pilot') return pilotMarkup();
  if (dialog === 'advisor') return advisorMarkup();
  if (dialog === 'reset') return `<dialog class="dialog" id="game-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title">开始新任期？</h2><p>这会替换此浏览器中的当前进度，并清空试玩反馈草稿。请先下载需要保留的报告与反馈；共享设备换人时，再开始新一局。</p><div class="dialog-actions"><button class="button secondary" type="button" data-action="close-dialog">继续当前游戏</button><button class="button danger" type="button" data-action="confirm-reset">开始新一局</button></div></dialog>`;
  return `<dialog class="dialog" id="game-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title">你的任期与模型规则</h2>
    <p>第1季认识正常市场，第2–6季管理政策。第2、4季先预测，再执行。三个任务分别检查：</p>${missionMarkup()}
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
    <div class="pilot-intro"><div><span class="eyebrow">CLASSROOM PLAYTEST · ${PILOT_VERSION}</span><h2 id="dialog-title">学生试玩</h2></div><button class="button secondary" type="button" data-action="close-dialog">返回游戏 ×</button></div>
    <p>给自己15–20分钟，试着做出选择、解释后果。第一次不必通关，发现哪里不清楚也很有价值。</p>
    <ol class="pilot-steps"><li><strong>观察 → 决策</strong><span>查看正常市场，再应对歉收。第2、4季先选方案，点「下一步：预测」，再选两项方向和一个理由。</span></li><li><strong>比较 → 解释</strong><span>结算后点击「免费试算」，只改一项政策，比较实际购粮。找林岚讨论原因。</span></li><li><strong>复盘 → 反馈</strong><span>尽量完成六季，用一组数字解释一次取舍。即使中途卡住，也能在这里下载反馈。</span></li></ol>
    <p class="pilot-meta">本局已结算 ${state.records.length}/6 季 · 进度保存在当前浏览器。共享设备换人前，请先下载报告，再点「新任期」。</p>
    <details class="pilot-video"><summary>观看操作演示 · 中文旁白与字幕</summary><video id="pilot-demo" controls playsinline preload="none" poster="/prosperity-road-demo-poster.jpg" aria-label="繁荣之路学生试玩操作演示"><source src="/prosperity-road-demo.mp4" type="video/mp4" /></video><p class="pilot-note" id="demo-status">演示展示一种决策与比较方法，不是通关答案。<a href="/prosperity-road-demo.mp4" download>下载视频</a></p></details>
    <section class="pilot-feedback" aria-labelledby="feedback-title"><h3 id="feedback-title">把试玩体验交给老师</h3><p class="pilot-note">无需填写姓名、邮箱或联系方式。下方内容和本局记录只保存在此浏览器；点击下载后，请自行把文件交给老师，不会自动上传。</p>
      <label for="feedback-code">试玩代号（选填，使用老师给的编号）<input id="feedback-code" data-feedback="code" maxlength="40" autocomplete="off" placeholder="例如 P01" value="${escape(pilotFeedback.code)}" /></label>
      <div class="pilot-ratings">${rating('ease', '操作是否清楚？', '1 很难上手 → 5 很容易')}${rating('fun', '是否愿意继续玩？', '1 不太愿意 → 5 很愿意')}</div>
      <label for="feedback-stuck">哪里卡住或不符合预期？<textarea id="feedback-stuck" data-feedback="stuck" rows="3" maxlength="1000" placeholder="我在第几季点了什么？期待发生什么，实际发生了什么？">${escape(pilotFeedback.stuck)}</textarea></label>
      <label for="feedback-learned">你发现了什么经济规律？<textarea id="feedback-learned" data-feedback="learned" rows="3" maxlength="1000" placeholder="引用一组数字，解释政策如何影响生产或实际购粮。也可以写仍没理解的问题。">${escape(pilotFeedback.learned)}</textarea></label>
      <label for="feedback-suggestion">最希望改进的一件事（选填）<textarea id="feedback-suggestion" data-feedback="suggestion" rows="2" maxlength="1000">${escape(pilotFeedback.suggestion)}</textarea></label>
      <p class="pilot-note" id="feedback-status" role="status">${escape(feedbackMessage || '可随时下载，包括还没完成一局的时候。反馈文件会包含已填写的学习复盘。')}</p>
      <div class="pilot-actions"><button class="button primary" id="download-feedback" type="button" data-action="download-feedback">下载试玩反馈与记录</button><button class="button secondary" type="button" data-action="clear-feedback">清空反馈草稿</button><button class="button secondary" type="button" data-action="close-dialog">返回游戏</button></div>
    </section></dialog>`;
}
function advisorMarkup(): string {
  const reply = advisorReply(state, advisorTopic);
  const mood = { welcoming: '一起看清局势', thinking: '让我和你推敲一下', concerned: '这里有个取舍', pleased: '抓到关键了' }[reply.mood];
  return `<dialog class="dialog advisor-dialog" id="game-dialog" aria-labelledby="dialog-title">
    <header class="advisor-header"><div><span class="eyebrow">YOUR ECONOMIC ADVISER</span><h2 id="dialog-title">林岚 <small>经济顾问</small></h2></div><button class="button ghost" type="button" data-action="close-dialog" aria-label="关闭顾问对话">返回游戏 ×</button></header>
    <div class="advisor-conversation"><div class="advisor-portrait" data-mood="${reply.mood}"><div class="portrait-halo" aria-hidden="true"></div><img src="/advisor-lin-lan.png" alt="手持账本、向你解释的经济顾问林岚" width="1145" height="1374" /><span class="advisor-mood">${mood}</span><small>第${state.seasonIndex + 1}季 · ${state.phase === 'decision' ? '政策尚未执行' : settled() ? '依据已结算记录' : '任期开始前'}</small></div>
      <div class="advisor-chat">${view === 'replay' ? `<p class="advisor-context-note">林岚正在讨论第${state.seasonIndex + 1}季的正式任期。替代方案的结果请看回放对照表。</p>` : ''}<div class="conversation-log" role="log" aria-label="与林岚的对话">${conversation.map((turn, index) => `<div class="speech-bubble ${turn.speaker}" ${index === conversation.length - 1 ? 'id="advisor-reply" tabindex="-1"' : ''}><span>${turn.speaker === 'advisor' ? '林岚' : '你'}</span><p>${escape(turn.text)}</p></div>`).join('')}</div>
      <div class="dialogue-choices" aria-label="选择你的回应">${reply.choices.map(choice => `<button class="button secondary" type="button" data-action="advisor-topic" data-topic="${choice.topic}">${escape(choice.label)} <span aria-hidden="true">↗</span></button>`).join('')}</div>
      ${reply.action ? `<button class="button primary advisor-link" type="button" data-action="advisor-go" data-destination="${reply.action.kind}">${escape(reply.action.label)} →</button>` : ''}
      <div class="advisor-topics">${reply.choices.some(choice => choice.topic === 'challenge') || advisorTopic === 'challenge' ? '' : '<button type="button" data-action="advisor-topic" data-topic="challenge">考考我的直觉</button>'}<button type="button" data-action="advisor-topic" data-topic="briefing">回到本季局势</button></div>
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
  app.innerHTML = `<div class="app-shell focus-layout" data-phase="${state.phase}" data-step="${decisionStep}" data-motion="${motionEnabled() ? 'on' : 'off'}">
    <header class="topbar"><div class="brand"><span class="brand-mark" aria-hidden="true">P</span><div><span class="brand-kicker">PROSPERITY ROAD</span><h1>繁荣之路</h1></div></div>
    <div class="resource-status" aria-label="当前资源与任期进度"><span>国库 <strong>${fmt(resources.cash)}</strong></span><span>储备 <strong>${fmt(resources.reserves)}</strong></span><button class="goal-status" id="goals-button" type="button" data-action="help" aria-label="查看任期目标：当前${progress.metSeasons}季达标，共需5季">达标 ${progress.metSeasons}/5季</button></div>
    <div class="top-actions"><button class="button ghost" id="menu-button" type="button" data-action="menu" aria-haspopup="dialog">菜单</button></div></header>
    ${storageMessage ? `<p class="notice warning" role="status">${escape(storageMessage)}</p>` : ''}
    ${tabs()}<div class="workspace"><main class="main-panel">
      <div class="season-heading"><div><span class="eyebrow">面包危机 · 第 ${season.id} / 6 季</span><h2 class="season-title" id="season-title" tabindex="-1">${state.phase === 'complete' ? '任期结束 · 留下你的判断' : state.phase === 'decision' && decisionStep === 'prediction' && view === 'command' ? '执行前，你的判断是什么？' : season.title}</h2></div><span class="season-badge">${{ briefing: '开始你的任期', decision: '政策尚未执行', result: '本季已结算', complete: '学习复盘' }[state.phase]}</span></div>
      ${stageTrack()}${notice ? `<p class="notice" role="status">${escape(notice)}</p>` : ''}
      <div id="active-view" aria-label="当前经济视图">${views[view]()}</div>
    </main></div>
    <div class="footer-note"><span>课堂教学模型 · 非现实预测</span><span id="save-status">${escape(storageMessage || '进度自动保存在此浏览器')}</span></div>
    ${actionDock()}${dialogMarkup()}</div>`;
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
    const target = document.getElementById(focusId) ?? (focusId === advisorReturnFocus ? document.getElementById('advisor-open') : document.getElementById('menu-button'));
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
  const text = `# 面包危机 · 本局学习报告\n\nEdexcel IAL Economics Unit 1 · 课堂模型\n\n达标季度：${progress.metSeasons}/6；期末储备：${fmt(progress.reserves)}；经营目标：${progress.passed ? '达成' : '未全部达成'}。\n\n## 六季记录\n\n| 季度 | 政策 | 价格 | 低收入购粮 | 保障率 | 期末现金 | 期末储备 |\n|---|---|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\n## 我的预测\n\n${predictions.join('\n')}\n\n## 我的措施\n\n${state.report.action}\n\n## 变化与证据\n\n${state.report.evidence}\n\n## 因果解释\n\n${state.report.explanation}\n\n## 适用条件与评价\n\n${state.report.conditions}\n\nEvaluate whether a maximum price was the most effective response to the food shortage in your country.\n\n课堂学习记录不等于Pearson考试分数。数值为教学假设，不是现实预测。\n`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = '面包危机-本局学习报告.md'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
app.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  let focusId = button.id || undefined;
  let animateSettlement = false;
  notice = '';
  if (action === 'menu') {
    utilityReturnFocus = 'menu-button'; dialog = 'menu';
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
      view = 'command'; decisionStep = 'policy'; customPolicyOpen = true; render('policy-controls');
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
    advisorReturnFocus = button.id || 'advisor-open';
    const topics: Record<string, [AdvisorTopic, string]> = {
      farm: ['farm', '农田现在遇到了什么问题？'],
      mill: ['production', '加工坊的生产会受什么影响？'],
      market: ['market', '现在的市场价格与供求怎样？'],
      granary: ['reserves', '我该怎样使用公共粮仓？'],
      homes: ['why', '居民能不能买到足够的面包？'],
    };
    const entry = topics[button.dataset.place!];
    if (!entry) return;
    talkToAdvisor(...entry); focusId = 'advisor-reply';
  } else if (action === 'scene-replay') {
    playScene(); return;
  } else if (action === 'view') {
    const requested = button.dataset.view as View;
    if (requested === 'command' && decisionStep === 'prediction' && !needsPrediction(state)) decisionStep = 'policy';
    if (requested === 'report' && state.phase !== 'complete') return;
    if (requested === 'replay' && state.records.length < 2) return;
    view = requested;
    focusId = `tab-${requested}`;
    if (view === 'replay' && !state.records.some(row => row.result.season === replaySeason)) beginReplay(2);
  } else if (action === 'guide-prediction' || action === 'guide-policy') {
    view = 'command';
    decisionStep = action === 'guide-prediction' && needsPrediction(state) ? 'prediction' : 'policy';
    const id = decisionStep === 'prediction' ? 'prediction-section' : 'season-title';
    render(id);
    document.querySelector('.workspace')?.scrollIntoView({ block: 'start' });
    return;
  } else if (action === 'strategy') {
    const strategy = strategies[Number(button.dataset.strategy)];
    if (!strategy) return;
    const changed = !samePolicy(state.draft, strategy.policy);
    state = choosePolicy(state, strategy.policy);
    customPolicyOpen = false;
    if (changed && needsPrediction(state)) notice = '方案已更新，下一步将记录新预测。';
    save();
  } else if (action === 'predict' && needsPrediction(state)) {
    state.prediction[button.dataset.key as 'price' | 'purchases'] = button.dataset.value as Direction;
    save();
  } else if (action === 'reason' && needsPrediction(state)) {
    state.prediction.reason = predictionReasons[Number(button.dataset.reason)];
    save();
  } else if (action === 'district') district = button.dataset.district!;
  else if (action === 'policy') {
    const key = button.dataset.key as keyof Policy;
    const value = button.dataset.value === 'none' ? null : Number(button.dataset.value);
    if (button.dataset.context === 'replay') {
      replayPolicy = { ...replayPolicy, [key]: value } as Policy;
      runReplay();
    } else {
      const changed = state.draft[key] !== value;
      state = choosePolicy(state, { ...state.draft, [key]: value } as Policy);
      if (changed && needsPrediction(state)) notice = '政策已更新，请按当前组合重新预测。';
      save();
    }
  } else if (action === 'reuse') {
    const prior = latestResult();
    if (prior) state = choosePolicy(state, prior.policy);
    notice = '已重新选择上季组合，请按本季条件检查与预测。';
    save();
  } else if (action === 'settle') {
    const outcome = settleTurn(state);
    if (!outcome.ok) notice = outcome.message;
    else { state = outcome.state; view = 'command'; focusId = 'outcome-title'; animateSettlement = true; save(); }
  } else if (action === 'next') {
    state = nextSeason(state);
    decisionStep = 'policy'; customPolicyOpen = false;
    view = state.phase === 'complete' ? 'report' : 'command';
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
    decisionStep = 'policy'; customPolicyOpen = false;
    conversation = []; conversationContext = ''; advisorTopic = 'briefing';
    if (clearPilotFeedback()) feedbackMessage = '';
    else notice = feedbackMessage;
    focusId = 'season-title';
    replaySeason = 2; replayPolicy = { ...DEFAULT_POLICY }; replayResult = null; replayError = '';
    save();
  } else if (action === 'download-report') { downloadReport(); return; }
  render(focusId);
  if (animateSettlement) playSettlement();
  if (['settle', 'next', 'confirm-reset', 'replay-season', 'compare-baseline'].includes(action ?? '')) {
    document.querySelector('.workspace')?.scrollIntoView({ block: 'start' });
  }
});
function refreshPredictionStatus(): void {
  document.querySelector('.action-dock')!.outerHTML = actionDock();
  document.querySelectorAll<HTMLButtonElement>('[data-action="reason"]').forEach(button => {
    button.setAttribute('aria-pressed', String(state.prediction.reason === predictionReasons[Number(button.dataset.reason)]));
  });
}
app.addEventListener('change', event => {
  const target = event.target as HTMLSelectElement;
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
  if (target.dataset.prediction === 'reason') {
    state.prediction.reason = target.value.slice(0, 3000);
    refreshPredictionStatus();
  }
  else if (target.dataset.report) state.report[target.dataset.report as keyof Report] = target.value.slice(0, 3000);
  else return;
  save();
});
motionQuery.addEventListener('change', () => render());
render();
