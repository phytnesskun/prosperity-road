import './style.css';
import { DEFAULT_POLICY, SEASONS, evaluate } from './economy.ts';
import type { Policy, Result } from './economy.ts';
import { choosePolicy, currentResources, goals, needsPrediction, newGame, nextSeason, predictionComplete, restoreGame, settleTurn } from './campaign.ts';
import type { Direction, GameState, Report } from './campaign.ts';
import { drawMarketChart } from './charts.ts';
import { outcomeFeedback } from './feedback.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
const SAVE_KEY = 'prosperity-road.bread-crisis.v1';
const fmt = (value: number): string => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (value: number): string => `${fmt(value * 100)}%`;
const escape = (value: string): string => value.replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
let storageMessage = '';
let state = loadGame();
type View = 'command' | 'town' | 'market' | 'people' | 'accounts' | 'history' | 'replay' | 'report';
let view: View = state.phase === 'complete' ? 'report' : 'command';
let district = 'farm';
let notice = '';
let dialog: 'help' | 'reset' | null = null;
let replaySeason = state.records.find(r => r.result.season > 1)?.result.season ?? 2;
let replayPolicy: Policy = { ...DEFAULT_POLICY };
let replayResult: Result | null = null;
let replayError = '';
let chartObserver: ResizeObserver | null = null;
const strategies: { name: string; intent: string; caution: string; policy: Policy }[] = [
  { name: '让市场调节', intent: '不设限价，不使用公共资源', caution: '价格可能上涨，低收入居民未必买得够。', policy: { cap: null, subsidy: 0, release: 0 } },
  { name: '压低面包标价', intent: '将最高价格设为 5', caution: '便宜了，但私人生产和分配会怎样？', policy: { cap: 5, subsidy: 0, release: 0 } },
  { name: '鼓励私人生产', intent: '每单位补贴 1 credit', caution: '要花国库现金，也受原料上限限制。', policy: { cap: null, subsidy: 1, release: 0 } },
  { name: '打开公共粮仓', intent: '向市场出售 20 单位储备', caution: '增加当季可售量，留下的储备更少。', policy: { cap: null, subsidy: 0, release: 20 } },
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
function stat(label: string, value: string, note: string): string {
  return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>`;
}
function tabs(): string {
  const items: [View, string][] = [['command', settled() ? '本季结果' : '决策台'], ['town', '城镇'], ['market', '供需'], ['people', '居民'], ['accounts', '账目'], ['history', '历史']];
  if (state.records.length > 1) items.push(['replay', '政策回放']);
  if (state.phase === 'complete') items.push(['report', '学习复盘']);
  return `<nav class="view-tabs" aria-label="经济视图">${items.map(([key, label]) =>
    `<button class="tab-button" id="tab-${key}" type="button" data-action="view" data-view="${key}" aria-selected="${view === key}">${label}</button>`).join('')}</nav>`;
}
function missionStrip(): string {
  const progress = goals(state.records);
  const remaining = 6 - state.records.length;
  const possible = progress.metSeasons + remaining >= 5 && progress.reserves >= 20;
  return `<section class="mission-strip" aria-label="任期任务"><strong>任期任务</strong>
    <span>保障达标 <b>${progress.metSeasons} / 5 季</b></span><span>最终储备 <b>≥20</b></span><span>现金 <b>始终≥0</b></span>
    <span class="mission-status">${progress.passed ? '任期目标已达成' : possible ? `还有 ${remaining} 季可争取` : '本局已无法全部达标，仍可继续实验与复盘'}</span></section>`;
}
function commandView(): string {
  if (settled()) return outcomeView();
  if (state.phase === 'briefing') return `<section class="command-view briefing">
    <div class="briefing-art"><img src="/town.svg" alt="你将管理的面包产区与公共粮仓" width="900" height="590" /></div>
    <span class="eyebrow">你是新任经济部长</span><h3>面包便宜了，居民就能吃饱吗？</h3>
    <p>一场歉收即将到来。你有五次决策机会，让居民获得足够的面包，同时保住国库和应急储备。</p>
    <ol class="play-loop"><li><strong>选方案</strong><span>限价、补贴、开仓，也可以自由组合。</span></li>
      <li><strong>看后果</strong><span>实际买到多少，比标价更重要。</span></li>
      <li><strong>试另一招</strong><span>结算后对比政策，再决定下一季。</span></li></ol>
    <p class="inline-help">先观察一次正常市场。无需填写答案即可开始。</p></section>`;
  const season = SEASONS[state.seasonIndex];
  const prior = SEASONS[state.seasonIndex - 1];
  const hints = [
    '',
    '原料上限骤降。你的政策能增加面包，还是只改变标价？',
    '原料仍然紧张。继续开仓能缓解眼前问题，但粮仓不会自动补满。',
    '加工能力恢复。此时补贴的效果，会与歉收最严重时相同吗？',
    '供给条件继续改善。现在还需要消耗国库或储备吗？',
    '最后一季：兼顾居民购粮与至少20单位的期末储备。',
  ];
  return `<section class="command-view">
    <div class="situation"><div><span>私人原料上限</span><strong>${prior.K} → ${season.K}</strong></div>
      <div><span>额外单位成本</span><strong>${prior.c} → ${season.c}</strong></div><p>${hints[state.seasonIndex]}</p></div>
    <div class="section-heading"><h3>01 · 选择你的应对方式</h3><span>点选即应用，还可以微调</span></div>
    <div class="strategy-grid">${strategies.map((strategy, index) => {
      const selected = samePolicy(state.draft, strategy.policy);
      const valid = evaluate(season, strategy.policy, currentResources(state)).valid;
      return `<button type="button" id="strategy-${index}" class="strategy-card ${selected ? 'selected' : ''}" data-action="strategy" data-strategy="${index}" aria-pressed="${selected}" ${valid ? '' : 'disabled'}>
        <span class="strategy-number">0${index + 1} <span>${selected ? '已选' : valid ? '选择' : '资源不足'}</span></span>
        <strong>${strategy.name}</strong><span>${strategy.intent}</span><small>${strategy.caution}</small></button>`;
    }).join('')}</div>
    <div class="decision-note" aria-live="polite"><strong>当前组合：${policyLabel(state.draft)}</strong><p>${draftAdvice()}</p></div>
    <p class="inline-help">先凭判断选择，执行后揭示真实结果。第2、4季额外记录一次简短预测。</p></section>`;
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
      <div class="basket-meter"><div style="width:${r.coverageLow * 100}%"></div><i></i></div>
      <p>低收入组基本篮子完成 <strong>${pct(r.coverageLow)}</strong> · 本季目标 ≥95%${met ? '，已达标' : `，还差 ${fmt(Math.max(0, 34.2 - r.purchasesLow))} 单位面包`}</p></div>
    <div class="section-heading"><h3>你的选择改变了什么？</h3><span>${r.season === 1 ? '固定无干预基期' : '与同一季、不干预相比'}</span></div>
    <div class="effect-grid">${effect('低收入组实际购粮', r.purchasesLow, baseline.purchasesLow, '单位')}
      ${effect('面包价格', r.price, baseline.price, 'credits')}
      ${effect('期末国库', r.after.cash, baseline.after.cash, 'credits')}
      ${effect('剩余储备', r.after.reserves, baseline.after.reserves, '单位')}</div>
    <div class="causal-feedback"><strong>为什么？</strong><p>${feedback.explanation}</p><span>${feedback.lesson}</span></div>
    <div class="resident-feedback"><div><span>居民的账本</span><p>${feedback.resident}</p></div><div><span>生产者的账本</span><p>${feedback.producer}</p></div></div>
    <p class="tradeoff"><strong>代价与取舍</strong> ${feedback.tradeoff}</p>
    ${r.season > 1 ? '<button class="button secondary" type="button" data-action="compare-baseline">试试看：本季不干预会怎样？</button><p class="inline-help">对照保持天气、成本与期初资源相同。角色反馈来自本模型；试算不消耗资源。</p>' : '<p class="inline-help">下一季将发生歉收。这次正常市场会成为你的第一个比较基准。</p>'}
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
    ${places.map(place => `<button type="button" class="map-hotspot ${district === place.id ? 'selected' : ''}" data-action="district" data-district="${place.id}" aria-pressed="${district === place.id}" style="left:${place.x}%;top:${place.y}%">
      <span class="hotspot-name">${place.name}</span><span class="hotspot-english">${place.english}</span><span class="hotspot-value">${place.value}</span></button>`).join('')}
  </div><div class="map-caption">同一面包市场 · 地区位置不产生额外价格差异 · 数量为面包篮单位</div>
  <div class="district-detail" aria-live="polite"><strong>${detail[district][0]}</strong><p>${detail[district][1]}</p>${state.phase === 'decision' ? '<button class="button secondary" type="button" data-action="guide-policy">前往政策桌作出选择 →</button>' : ''}</div>
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
    <div class="report-actions"><button class="button primary" type="button" data-action="download-report">下载本局报告</button><button class="button secondary" type="button" data-action="view" data-view="replay">先回放一项政策</button></div>
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
function policyPanel(): string {
  const r = latestResult();
  if (state.phase === 'complete') return `<div class="policy-header"><span class="eyebrow">END OF TERM</span><h2>任期档案</h2></div>${missionMarkup()}<p class="policy-help">用自己的数据解释一次成功或失败，比只追求通关更重要。</p><button class="button secondary advance-button" type="button" data-action="view" data-view="report">完成学习复盘</button>`;
  if (state.phase === 'briefing') return `<div class="policy-header"><span class="eyebrow">YOUR FIRST BRIEFING</span><h2>上任前的三件事</h2></div>
    <div class="briefing-rules"><p><strong>① 居民要买到面包</strong><br>六季中至少五季，低收入组保障率达到95%。</p><p><strong>② 粮仓要留后手</strong><br>初始60单位，任期末至少留下20。</p><p><strong>③ 国库不能透支</strong><br>初始160 credits，补贴支出不能超过可用现金。</p></div><p class="policy-help">第1季固定无干预，点击下方按钮观察市场。所有数量是面包篮单位，不是人数。</p>`;
  if (state.phase === 'result' && r) {
    const prediction = state.records.at(-1)!.prediction;
    const prior = state.records.at(-2)?.result;
    const direction = (delta: number): Direction => Math.abs(delta) < 1e-7 ? 'same' : delta > 0 ? 'up' : 'down';
    const check = (key: 'price' | 'purchases', label: string, delta: number) => `<div class="forecast-feedback"><strong>${prediction[key] === direction(delta) ? '✓ 判断一致' : '↗ 修正直觉'}</strong><span>${directionName(prediction[key], label)} → 实际${directionName(direction(delta), label)}</span></div>`;
    return `<div class="policy-header"><span class="eyebrow">YOUR DECISION, YOUR IMPACT</span><h2>${r.season === 1 ? '正常市场已建立' : '回看你的判断'}</h2></div>
      ${prediction.price && prior ? `<p class="policy-help">以下预测对照上季；左侧政策效果对照同季无干预。</p>${check('price', '价格', r.price - prior.price)}${check('purchases', '购粮', r.purchasesLow - prior.purchasesLow)}<p class="policy-help">你的理由：${escape(prediction.reason)}</p>` : '<p>比较实际购粮和价格，观察二者是否一起改善。</p>'}
      <div class="results-summary">${mini('本季现金变化', signed(r.after.cash - r.before.cash))}${mini('本季储备变化', `${signed(r.after.reserves - r.before.reserves)} 单位`)}</div>
      ${r.season > 1 ? `<button class="button secondary advance-button" type="button" data-action="replay-season" data-season="${r.season}">换个方案，免费试算</button>` : ''}
      <p class="policy-help">${state.seasonIndex < 5 ? `下一季：${SEASONS[state.seasonIndex + 1].title}。政策每季到期，请重新选择。` : '六季已完成，进入复盘查看任期成绩。'}</p>`;
  }
  const resources = currentResources(state);
  const preview = evaluate(SEASONS[state.seasonIndex], state.draft, resources);
  return `<div class="policy-header" id="policy-controls" tabindex="-1"><span class="eyebrow">FINE-TUNE YOUR PLAN</span><h2>调整政策组合</h2></div>
    ${state.records.length > 1 ? '<button class="button ghost reuse-button" type="button" data-action="reuse">沿用上季组合</button>' : ''}
    ${policyControls(state.draft, 'draft')}
    <div class="resource-check ${preview.valid ? '' : 'error'}" ${preview.valid ? '' : 'role="alert"'}>${preview.valid ? `✓ 资源允许执行 · 投放后储备 ${fmt(resources.reserves - state.draft.release)}` : `${escape(preview.message)} 请减少补贴或投放，再执行。`}</div>
    ${predictionFields()}`;
}
function actionDock(): string {
  const evaluation = evaluate(SEASONS[state.seasonIndex], state.draft, currentResources(state));
  const missing = needsPrediction(state) && !predictionComplete(state.prediction);
  let label = '', hint = '', actions = '';
  if (state.phase === 'briefing') {
    label = '第一步 · 观察正常市场'; hint = '先建立基准，再迎接歉收。';
    actions = '<button class="button primary" type="button" data-action="settle">查看正常市场</button>';
  } else if (state.phase === 'decision') {
    label = `第${state.seasonIndex + 1}季 · ${policyLabel(state.draft)}`;
    hint = !evaluation.valid ? evaluation.message : missing ? predictionHint() : '准备好了。执行后可免费试算其他选择。';
    actions = `${missing ? '<button class="button secondary" type="button" data-action="guide-prediction">完成预测 ↓</button>' : '<button class="button secondary" type="button" data-action="guide-policy">调整政策</button>'}<button id="settle-button" class="button primary" type="button" data-action="settle" ${!evaluation.valid || missing ? 'disabled' : ''}>执行本季政策 →</button>`;
  } else if (state.phase === 'result') {
    label = `第${state.seasonIndex + 1}季已结算`; hint = '先看后果，再作下一次选择。';
    actions = `<button class="button primary" type="button" data-action="next">${state.seasonIndex === 5 ? '结束任期，进入复盘' : '进入下一季 →'}</button>`;
  } else {
    label = goals(state.records).passed ? '任期任务完成' : '任期结束 · 继续研究你的选择'; hint = '进度已保存，可以下载自己的学习报告。';
    actions = '<button class="button secondary" type="button" data-action="view" data-view="replay">政策试验室</button><button class="button primary" type="button" data-action="view" data-view="report">查看学习复盘</button>';
  }
  return `<div class="action-dock" aria-label="本季主操作"><div class="dock-context"><strong>${label}</strong><span id="prediction-status" role="status">${hint}</span></div><div class="dock-buttons">${actions}</div></div>`;
}
function news(): string {
  const r = settled() ? latestResult() : undefined;
  if (!r) return `本季已知条件：私人原料上限${SEASONS[state.seasonIndex].K}，额外单位成本${SEASONS[state.seasonIndex].c}。`;
  return `居民简报：低收入组实际购粮${fmt(r.purchasesLow)}，完成基本篮子${pct(r.coverageLow)}。财政简报：补贴支出${fmt(r.subsidyCost)}，储备余量${fmt(r.after.reserves)}。`;
}
function dialogMarkup(): string {
  if (!dialog) return '';
  if (dialog === 'reset') return `<dialog class="dialog" id="game-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title">开始新任期？</h2><p>这会替换此浏览器中的当前进度。已完成的复盘可以先下载保存。</p><div class="dialog-actions"><button class="button secondary" type="button" data-action="close-dialog">继续当前游戏</button><button class="button danger" type="button" data-action="confirm-reset">开始新一局</button></div></dialog>`;
  return `<dialog class="dialog" id="game-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title">你的任期与模型规则</h2>
    <p>第1季认识正常市场，第2–6季管理政策。第2、4季先预测，再执行。三个任务分别检查：</p>${missionMarkup()}
    <p>最高价格可选不设、4、5、6；单位补贴可选0、1、2；公共投放可选0、10、20。政策每季到期。</p>
    <p>需求：低收入组 max(80−8p,0)，高收入组 max(100−8p,0)。私人供给：min(K,20×max(p+s−c,0))。公共投放加到可售数量；短缺时按两组需求比例配给。</p>
    <p>天气路径预设；本版不模拟投资、工资循环、黑市和私人库存。数量是面包篮单位，不是人数。单一面包价格不等于通胀率。</p>
    <p>国库现金 = 期初现金 + 售粮收入 − 配送费 − 补贴。库存是跨季资源，不足时整组政策不执行。</p>
    <p>所有数值为课堂模型假设。<a href="https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Economics/2018/Specification-and-Sample-Assessment/International-A-Level-Economics-spec.pdf" target="_blank" rel="noopener noreferrer">Pearson IAL Economics 考纲</a></p>
    <div class="dialog-actions"><button class="button primary" type="button" data-action="close-dialog">返回游戏</button></div></dialog>`;
}
function render(focusId?: string): void {
  chartObserver?.disconnect();
  const r = latestResult();
  const resources = currentResources(state);
  const season = SEASONS[state.seasonIndex];
  const stamp = r ? `第${r.season}季已结算` : '正常市场待观察';
  const views: Record<View, () => string> = {
    command: commandView, town, market: marketView, people: peopleView, accounts: accountsView, history: historyView, replay: replayView, report: reportView,
  };
  app.innerHTML = `<div class="app-shell" data-phase="${state.phase}">
    <header class="topbar"><div class="brand"><span class="brand-mark" aria-hidden="true">P</span><div><span class="brand-kicker">PROSPERITY ROAD</span><h1>繁荣之路</h1></div></div>
    <div class="chapter-title">面包危机 <span>THE BREAD CRISIS · IAL UNIT 1</span></div>
    <div class="top-actions"><button class="button ghost" id="help-button" type="button" data-action="help">玩法与规则</button><button class="button ghost" id="reset-button" type="button" data-action="reset">新任期</button></div></header>
    <section class="stats-grid" aria-label="关键指标">
      ${stat('BREAD PRICE · 面包价格', r ? `${fmt(r.price)} <small>credits</small>` : '—', stamp)}
      ${stat('BASIC BASKET · 低收入保障', r ? pct(r.coverageLow) : '—', `${stamp} · 目标 ≥95%`)}
      ${stat('PUBLIC RESERVES · 公共储备', `${fmt(resources.reserves)} <small>单位</small>`, `${settled() ? '期末存量' : '本季期初'} · 任期末 ≥20`)}
      ${stat('TREASURY · 国库', `${fmt(resources.cash)} <small>credits</small>`, `${settled() ? '期末现金' : '本季期初'} · 始终非负`)}
    </section>
    ${storageMessage ? `<p class="notice warning" role="status">${escape(storageMessage)}</p>` : ''}
    ${missionStrip()}<div class="workspace"><main class="main-panel">
      <div class="season-heading"><div><span class="eyebrow">SEASON ${season.id} / 6</span><h2 class="season-title" id="season-title" tabindex="-1">${state.phase === 'complete' ? '任期结束 · 留下你的判断' : season.title}</h2></div><span class="season-badge">${{ briefing: '基期引导', decision: '等待你的决策', result: '本季已结算', complete: '学习复盘' }[state.phase]}</span></div>
      <div class="event-banner">${state.phase === 'complete' ? '六季均已结算，原始记录已保存。现在比较一项替代政策，并用本局证据写下你的判断。' : season.event}</div>
      ${notice ? `<p class="notice" role="status">${escape(notice)}</p>` : ''}
      ${tabs()}<div id="active-view" aria-label="当前经济视图">${views[view]()}</div>
    </main><aside class="policy-panel" aria-label="政策与季度操作">${policyPanel()}</aside></div>
    <footer class="news-footer"><div><span class="eyebrow">MINISTER'S DISPATCH · 本季简报</span><p id="news-text" aria-live="polite">${news()}</p></div>
    <div class="season-track" aria-label="季度进度">${SEASONS.map((s, i) => `<span class="season-chip ${state.seasonIndex === i ? 'active' : ''} ${state.records.length > i ? 'complete' : ''}" aria-label="第${i + 1}季${state.records.length > i ? '已完成' : ''}">${s.id}</span>`).join('')}</div></footer>
    <div class="footer-note"><span>课堂教学模型 · 非现实预测</span><span id="save-status">${escape(storageMessage || '进度自动保存在此浏览器')}</span></div>
    ${actionDock()}${dialogMarkup()}</div>`;
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
  if (dialog) {
    const element = document.querySelector<HTMLDialogElement>('#game-dialog')!;
    element.showModal();
    element.addEventListener('cancel', event => {
      event.preventDefault();
      const trigger = dialog === 'help' ? 'help-button' : 'reset-button';
      dialog = null; render(trigger);
    });
  } else if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
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
  notice = '';
  if (action === 'view') {
    const requested = button.dataset.view as View;
    if (requested === 'report' && state.phase !== 'complete') return;
    if (requested === 'replay' && state.records.length < 2) return;
    view = requested;
    focusId = `tab-${requested}`;
    if (view === 'replay' && !state.records.some(row => row.result.season === replaySeason)) beginReplay(2);
  } else if (action === 'guide-prediction' || action === 'guide-policy') {
    view = 'command';
    const id = action === 'guide-prediction' ? 'prediction-section' : 'policy-controls';
    render(id);
    document.getElementById(id)?.scrollIntoView({ block: 'center' });
    return;
  } else if (action === 'strategy') {
    const strategy = strategies[Number(button.dataset.strategy)];
    if (!strategy) return;
    const changed = !samePolicy(state.draft, strategy.policy);
    state = choosePolicy(state, strategy.policy);
    if (changed && needsPrediction(state)) notice = '方案已应用。请按新组合点选预测。';
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
    else { state = outcome.state; view = 'command'; focusId = 'outcome-title'; save(); }
  } else if (action === 'next') {
    state = nextSeason(state);
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
  else if (action === 'help') dialog = 'help';
  else if (action === 'reset') dialog = 'reset';
  else if (action === 'close-dialog') {
    focusId = dialog === 'help' ? 'help-button' : 'reset-button';
    dialog = null;
  }
  else if (action === 'confirm-reset') {
    state = newGame(); view = 'command'; dialog = null;
    focusId = 'season-title';
    replaySeason = 2; replayPolicy = { ...DEFAULT_POLICY }; replayResult = null; replayError = '';
    save();
  } else if (action === 'download-report') { downloadReport(); return; }
  render(focusId);
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
  const target = event.target as HTMLTextAreaElement;
  if (target.dataset.prediction === 'reason') {
    state.prediction.reason = target.value.slice(0, 3000);
    refreshPredictionStatus();
  }
  else if (target.dataset.report) state.report[target.dataset.report as keyof Report] = target.value.slice(0, 3000);
  else return;
  save();
});
render();
