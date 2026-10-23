import './style.css';
import './river.css';
import { RIVER_SEASONS, RIVER_POLICIES, newRiverGame, chooseRiverPolicy, executeRiver, nextRiver, totalsRiver, restoreRiver, settleRiver } from './river-model.ts';
import type { RiverPolicyId, RiverResult } from './river-model.ts';
import { renderRiverScene } from './river-scene.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
const SAVE_KEY = 'prosperity-road.smokestacks-river.v1';
const MUSIC_KEY = 'prosperity-road.music.v1';
const MOTION_KEY = 'prosperity-road.river-motion.v1';
const number = (value: number): string => value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
const signed = (value: number): string => `${value > 0 ? '+' : ''}${number(value)}`;
const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
let state = restoreRiver(read(SAVE_KEY));
let place: 'advisor' | 'factory' | 'river' | 'harbor' = 'advisor';
let sandbox = false;
let sandboxPolicy: RiverPolicyId = 'none';
let message = '';
let motion = read(MOTION_KEY) !== 'off';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let musicOn = read(MUSIC_KEY) !== 'off';
let musicStarted = false;
let musicFailed = false;
let musicPending = false;
const music = new Audio('/audio/town-theme.mp3');
music.id = 'river-music';
music.preload = 'none';
music.loop = true;
music.volume = .24;
document.body.append(music);
document.title = '烟囱与河流 · 繁荣之路';

function save(): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); message = ''; }
  catch { message = '本次进度暂时无法保存；当前页面仍可继续游玩。'; }
}
function syncMusic(): void {
  const play = musicOn && musicStarted && !document.hidden;
  if (!play) music.pause();
  else if (music.paused && !musicPending && !musicFailed) {
    musicPending = true;
    void music.play().then(() => { musicPending = false; syncMusic(); }).catch(error => {
      musicPending = false;
      if (error instanceof DOMException && error.name === 'AbortError') { syncMusic(); return; }
      musicFailed = true; updateMusic();
    });
  }
  updateMusic();
}
function updateMusic(): void {
  const button = document.getElementById('river-music-toggle');
  if (!button) return;
  button.textContent = musicFailed ? '♫ 重试' : musicOn ? '♫ 配乐' : '♫ 静音';
  button.setAttribute('aria-pressed', String(musicOn && musicStarted && !musicFailed));
  button.setAttribute('aria-label', musicFailed ? '重试背景配乐' : musicOn ? '关闭背景配乐' : '播放背景配乐');
}
music.addEventListener('error', () => { musicFailed = true; updateMusic(); });
document.addEventListener('visibilitychange', syncMusic);
reducedMotion.addEventListener('change', () => render());

const policy = (id: RiverPolicyId) => RIVER_POLICIES.find(item => item.id === id)!;
const lastResult = (): RiverResult | undefined => state.records.at(-1);
const resultNow = (): RiverResult | undefined => state.phase === 'decision' ? undefined : lastResult();

function dialogue(): { name: string; role: string; text: string } {
  const r = resultNow();
  const s = RIVER_SEASONS[state.season - 1];
  const base = r ? settleRiver(r.season, 'none', r.cashBefore) : undefined;
  if (place === 'advisor' && state.phase === 'complete') return { name: '林岚', role: '你的城镇顾问', text: '四季已经走完。账本里留着每次选择的代价，纸厂、河岸和码头也都有自己的感受。看看这段任期的结局；想走另一条路，随时可以重新开始。' };
  if (place === 'factory') return { name: '周厂长', role: '河港纸厂', text: r
    ? `这一季卖出了 ${number(r.quantity)} 单位纸卷，税后每单位到手 ${number(r.producerPrice)}。扣除生产成本，行业剩余 ${number(r.producerSurplus)}。${policy(r.policy).cap !== null && r.quantity < base!.quantity ? '限额让纸卷更稀缺，现有厂商也获得了稀缺收益。' : ''}`
    : '码头在等我们的纸卷。污染税会提高生产负担；排放上限会直接卡住产量。你定好规则，我们就开工。' };
  if (place === 'river') return { name: '阿禾', role: '河岸居民', text: r
    ? `本季排放 ${number(r.emissions)} 单位，河流损害估值 ${number(r.damage)}。${r.damage < base!.damage ? `比同样环境下放任生产少了 ${number(base!.damage - r.damage)}。` : '和本季放任生产相比，损害没有减少。'}税款进入镇国库，我们没有自动收到赔偿。`
    : s.m === 40 ? '水位降了，同样的排放现在会造成两倍损害。别只照搬上一季的办法，河流承受不起。' : '我们就在纸厂下游生活。多卖纸卷是好事，可河流承担的代价，也得有人算进去。' };
  if (place === 'harbor') return { name: '许掌柜', role: '码头采购商', text: r
    ? `纸卷成交价是 ${number(r.price)}，本季买到 ${number(r.quantity)} 单位。${r.price > base!.price ? `比不干预贵了 ${number(r.price - base!.price)}。供货收紧，采购也得多花钱。` : '供货没有受限，按市场价格成交。'}`
    : state.season === 4 ? '外地的新订单到了！水量也恢复了。上一季为了枯水采取的紧急措施，还要原样继续吗？' : '我们需要稳定的纸卷供应。你可以保护河流，但也要留意：限得太紧，订单就接不住了。' };
  return { name: '林岚', role: '你的城镇顾问', text: r
    ? r.season === 3 && r.damage > (state.records[1]?.damage ?? Infinity)
      ? `这季损害看起来增加了，但枯水把每单位损害翻倍了。对照同样的枯水环境，你的措施${r.damage < base!.damage ? `仍减少了 ${number(base!.damage - r.damage)} 的损害` : '没有减少损害'}。点河岸和码头，听听双方怎么说。`
      : `纸厂交付 ${number(r.quantity)}，河流损害 ${number(r.damage)}。${r.taxRevenue ? `税款带来 ${number(r.taxRevenue)} 收入，但这不等于河流已经被修复。` : r.administration ? `本季花了 ${number(r.administration)} 执行规则。` : '市场完成了交易，河岸的代价却没有进账单。'}可以免费试另一种办法，再决定下一季怎么走。`
    : state.season === 1 ? '欢迎来到河港镇。你有四季时间：交付至少 130 单位纸卷，把累计河流损害控制在 3,000 以内。先让纸厂按市场规则开工，看看这座镇的起点。'
      : state.policy === 'none' ? '这季可以放任市场，也可以征污染税或设排放上限。点一个方案直接执行，结果出来后，随时免费试算其他选择。'
        : `你选了「${policy(state.policy).name}」。${policy(state.policy).tax ? '每生产一单位就要交税，厂商会减少供货，纸价可能上涨。' : '生产不能超过这个上限；限额较宽时，也可能只花管理费而不减少排放。'}政策只持续本季。` };
}

function goalsMarkup(): string {
  const total = totalsRiver(state);
  return `<div class="river-goals" aria-label="四季任务进度">
    <div><span>可用国库</span><strong id="river-cash">${number(total.cash)} <small>credits</small></strong><small>行政费先付，税款后收</small></div>
    <div><span>累计交付 · 目标 ≥ 130</span><strong id="river-supply">${number(total.supply)} <small>/ 130</small></strong><progress max="130" value="${Math.min(130, total.supply)}" aria-label="累计交付进度"></progress></div>
    <div class="${total.damage > 3000 ? 'over-budget' : ''}"><span>累计河流损害 · 上限 3,000</span><strong id="river-damage">${number(total.damage)} <small>/ 3,000</small></strong><progress max="3000" value="${Math.min(3000, total.damage)}" aria-label="累计损害额度使用"></progress></div>
  </div>`;
}

function decisionMarkup(): string {
  if (state.season === 1) return `<div class="river-opening"><span class="river-seal">01</span><p class="eyebrow">第一批纸卷，即将出厂</p><h2>先让小镇动起来</h2><p>纸厂、码头和河岸已各就各位。第一季按市场规则生产，之后由你掌舵。</p><div class="river-contract"><b>你的四季约定</b><span>供应不能断，河流不能一直替繁荣买单。</span></div><p class="river-hint">点击场景下方的地点，可以听取各方意见。</p></div>`;
  const family = state.policy.startsWith('tax') ? 'tax' : state.policy.startsWith('cap') ? 'cap' : 'none';
  const options = RIVER_POLICIES.filter(item => family === 'tax' ? item.tax > 0 : family === 'cap' ? item.cap !== null : false);
  return `<p class="eyebrow">本季由你拍板</p><h2>纸厂，该怎么开？</h2><div class="river-strategies">
    ${[
      ['none', '让市场运转', '供货不受限制，河岸继续承担排放。', '↗'],
      ['tax', '给排放标个价', '按排放征税，减少生产并带来税款。', '◈'],
      ['cap', '划一道排放红线', '直接限制产量，国库支付管理费。', '≋'],
    ].map(([id, title, detail, icon]) => `<button class="river-strategy" id="river-family-${id}" data-family="${id}" aria-pressed="${family === id}"><span aria-hidden="true">${icon}</span><span><b>${title}</b><small>${detail}</small></span></button>`).join('')}
  </div>${options.length ? `<fieldset class="river-intensity"><legend>${family === 'tax' ? '每单位排放征税' : '本季排放总量上限'}</legend>${options.map(item => `<button id="river-policy-${item.id}" data-policy="${item.id}" aria-pressed="${state.policy === item.id}">${item.tax || item.cap}</button>`).join('')}</fieldset>` : ''}
  <div class="river-policy-note" role="status"><b>${policy(state.policy).name}</b><span>当季行政费 ${policy(state.policy).fee} credits · 本季到期</span></div>
  ${state.records.length > 1 ? '<button class="river-text-button" id="river-repeat" data-action="repeat">沿用上季措施</button>' : ''}`;
}

function resultMarkup(r: RiverResult): string {
  const base = settleRiver(r.season, 'none', r.cashBefore);
  const saved = base.damage - r.damage;
  return `<p class="eyebrow">第 ${r.season} 季 · 世界的回应</p><h2 id="river-outcome-title" tabindex="-1">${saved > 0 ? `河流少承受 ${number(saved)}` : r.administration ? '花了管理费，排放没变' : '订单交了，代价留在河里'}</h2>
    <p class="river-result-context">${saved > 0 ? '与本季同样环境下的放任生产相比。' : '市场出清，仍然有人承担账单以外的代价。'}</p>
    <div class="river-results">
      <div><span>本季供货</span><strong>${number(r.quantity)} <small>单位</small></strong><small>比不干预 ${signed(r.quantity - base.quantity)}</small></div>
      <div><span>纸卷单价</span><strong>${number(r.price)}</strong><small>比不干预 ${signed(r.price - base.price)}</small></div>
      <div><span>本季河流损害</span><strong>${number(r.damage)}</strong><small>排放 ${number(r.emissions)} 单位</small></div>
    </div><p class="river-cashline">国库 ${number(r.cashBefore)} → <b>${number(r.cashAfter)}</b><br><small>税款 +${number(r.taxRevenue)} · 行政费 −${number(r.administration)}</small></p>
    ${r.season > 1 ? `<button class="button secondary river-wide" id="river-try" data-action="try" aria-expanded="${sandbox}">${sandbox ? '收起免费试算' : '试试另一种办法'}</button>${sandbox ? sandboxMarkup(r) : ''}` : '<p class="river-hint">从下一季开始，你可以征税、限排，并免费试算其他方案。</p>'}`;
}

function sandboxMarkup(r: RiverResult): string {
  let trial: RiverResult;
  try { trial = settleRiver(r.season, sandboxPolicy, r.cashBefore); }
  catch { return '<p role="status">该季度期初国库不足以执行这个方案。</p>'; }
  return `<div class="river-sandbox" id="river-sandbox"><label for="river-trial-policy">同一季度，另一种选择</label><select id="river-trial-policy">${RIVER_POLICIES.filter(item => r.season !== 1 || item.id === 'none').map(item => `<option value="${item.id}" ${sandboxPolicy === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}</select><p>供货 <b>${number(trial.quantity)}</b> · 损害 <b>${number(trial.damage)}</b><br>单价 <b>${number(trial.price)}</b> · 期末国库 <b>${number(trial.cashAfter)}</b></p><small>使用本季原有环境与期初国库。只试算，不改变本局。</small></div>`;
}

function endingMarkup(): string {
  const total = totalsRiver(state);
  const delivery = total.supply >= 130;
  const river = total.damage <= 3000;
  return `<p class="eyebrow">四季落幕 · 你的河港镇</p><h2 id="river-ending-title" tabindex="-1">${delivery && river ? '纸厂与河流，一起留下' : !river ? '繁忙的港口，沉重的河流' : '河岸安静了，订单还在等'}</h2><p>${delivery && river ? '你守住了供货与河流的约定。城镇仍在运转，这份繁荣也留出了余地。' : !river ? '码头的忙碌没有抵消河岸的损害。下一次，试着在枯水期更早收紧排放。' : '污染控制住了，但交付没能跟上。水量恢复、订单增加时，也许可以让纸厂多开一些。'}</p><ul class="river-ending-goals"><li>${delivery ? '✓' : '○'} 交付 ${number(total.supply)} / 130</li><li>${river ? '✓' : '○'} 损害 ${number(total.damage)} / 3,000</li><li>✓ 国库始终非负，结余 ${number(total.cash)}</li></ul><p class="river-hint">这些是镇议会的任务目标。税款增加不等于同额社会收益；每种选择仍有代价。</p>`;
}

function ledgerMarkup(): string {
  if (!state.records.length) return '';
  return `<details class="river-ledger"><summary>打开任期账本 <span>${state.records.length} 季记录</span></summary><div class="river-table-wrap"><table><thead><tr><th>季度 / 措施</th><th>供货</th><th>损害</th><th>国库</th></tr></thead><tbody>${state.records.map(r => `<tr><th>第 ${r.season} 季<small>${policy(r.policy).name}</small></th><td>${number(r.quantity)}</td><td>${number(r.damage)}</td><td>${number(r.cashAfter)}</td></tr>`).join('')}</tbody></table></div><p>河流损害是模型中的外部损害估值，不是国库支出。每生产 1 单位排放 1 单位；损害不跨季累积成污染存量。</p><details><summary>查看模型细账与规则</summary>${state.records.map(r => `<p>第 ${r.season} 季：消费者剩余 ${number(r.consumerSurplus)} + 生产者剩余 ${number(r.producerSurplus)} + 税收 ${number(r.taxRevenue)} − 河流损害 ${number(r.damage)} − 行政成本 ${number(r.administration)} = 净社会福利 ${number(r.welfare)}。</p>`).join('')}<p>需求 p=a−Q，私人成本 MPC=20+Q，单位损害 m。前三季 a=100，末季 a=120；枯水季 m=40，其余 m=20。完全执行、没有减排设备。所有数值为游戏模型假设；本样品不模拟长期生态恢复或就业。</p></details></details>`;
}

function render(focusId?: string): void {
  const season = RIVER_SEASONS[state.season - 1];
  const r = resultNow();
  const voice = dialogue();
  const done = state.phase === 'complete';
  app.innerHTML = `<div class="river-app"><header class="river-header"><a href="/" class="river-brand">繁荣之路 <span>PROSPERITY ROAD</span></a><nav aria-label="游戏导航"><button class="button ghost" id="river-music-toggle" data-action="music">♫ 配乐</button><a class="button ghost" id="river-bread-link" href="/">面包危机 ↗</a></nav></header>
    <main><div class="river-title-row"><div><p class="eyebrow">第二剧本 · 四季可玩样品</p><h1>烟囱与河流</h1><p>让纸厂运转，也给河流留条生路。</p></div><ol class="river-season-steps" aria-label="季度进度">${RIVER_SEASONS.map((_, i) => `<li ${state.season === i + 1 ? 'aria-current="step"' : ''} class="${state.records.length > i ? 'finished' : ''}"><span>${i + 1}</span></li>`).join('')}</ol></div>
    ${goalsMarkup()}<div class="river-layout"><section class="river-world" aria-label="河港镇"><div class="river-event"><span>第 ${state.season} 季 / 4${state.season === 3 ? ' · 枯水期' : ''}</span><h2 id="river-season-title" tabindex="-1">${done ? '一任之后' : season.title}</h2><p>${done ? '到各处走一走，听听这座镇对你的最后一季有何评价。' : season.brief}</p></div>
    ${renderRiverScene({ season: state.season, quantity: r?.quantity ?? null, damage: r?.damage ?? null, settled: !!r, active: place === 'advisor' ? null : place, motion: motion && !reducedMotion.matches })}
    <div class="river-dialogue" aria-live="polite"><div class="river-speaker">${place === 'advisor' ? '<img src="/advisor-lin-lan.png" alt="顾问林岚" />' : `<span aria-hidden="true">${voice.name.slice(0, 1)}</span>`}</div><div><p class="river-voice-name">${voice.name}<span>${voice.role}</span></p><p id="river-dialogue-text">${voice.text}</p>${place !== 'advisor' ? '<button class="river-text-button" data-action="advisor" id="river-advisor">听听林岚的看法 →</button>' : '<small class="river-hint">走访纸厂、河岸和码头，各方会说出自己的得失。</small>'}</div></div></section>
    <aside class="river-command" aria-label="决策与反馈">${done ? endingMarkup() : r ? resultMarkup(r) : decisionMarkup()}</aside></div>
    ${ledgerMarkup()}<footer class="river-settings"><button class="river-text-button" id="river-motion" data-action="motion" aria-pressed="${motion && !reducedMotion.matches}" ${reducedMotion.matches ? 'disabled' : ''}>动画：${motion && !reducedMotion.matches ? '开' : '关'}</button><button class="river-text-button" id="river-reset" data-action="reset">重新开始这段任期</button><span>进度自动保存在本浏览器 · 两个剧本独立存档</span></footer><p id="river-storage-message" class="river-storage-message" role="status">${message}</p></main>
    <div class="river-dock"><div><b>${done ? '另一条路，会是什么结局？' : r ? '这一季已记录，可免费试算' : state.season === 1 ? '第一季 · 按市场规则开工' : policy(state.policy).name}</b><small>${done ? '重玩可以探索其他措施与结局。' : r ? '进入下一季后，重新选择措施。' : '点一下执行，城镇立即回应。'}</small></div>${done ? '<button class="button primary" id="river-restart" data-action="reset">再试一条路 ↻</button>' : r ? `<button class="button primary" id="river-next" data-action="next">${state.season === 4 ? '看看四季后的河港镇' : '进入下一季 →'}</button>` : `<button class="button primary" id="river-execute" data-action="execute" ${totalsRiver(state).cash < policy(state.policy).fee ? 'disabled' : ''}>${state.season === 1 ? '开动纸厂 →' : '执行本季措施 →'}</button>`}</div>
    <dialog class="river-reset-dialog" id="river-reset-dialog" aria-labelledby="river-reset-title"><h2 id="river-reset-title">重新开始四季任期？</h2><p>这会替换《烟囱与河流》的当前进度。《面包危机》的存档不受影响。</p><div><button class="button secondary" data-action="cancel-reset">继续当前任期</button><button class="button primary" id="river-confirm-reset" data-action="confirm-reset">开始新任期</button></div></dialog></div>`;
  updateMusic();
  if (focusId) {
    const target = document.getElementById(focusId);
    target?.focus({ preventScroll: true });
    if (['river-outcome-title', 'river-season-title', 'river-ending-title'].includes(focusId)) target?.scrollIntoView({ block: 'nearest' });
  }
}

app.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button || button.disabled) return;
  const location = button.dataset.riverPlace;
  if (location === 'factory' || location === 'river' || location === 'harbor') { place = location; render(); document.querySelector<HTMLButtonElement>(`[data-river-place="${location}"]`)?.focus({ preventScroll: true }); return; }
  if (button.dataset.family || button.dataset.policy) {
    const id = button.dataset.policy ?? ({ none: 'none', tax: 'tax20', cap: 'cap30' }[button.dataset.family!]);
    state = chooseRiverPolicy(state, id as RiverPolicyId); place = 'advisor'; save(); render(button.id); return;
  }
  const action = button.dataset.action;
  if (action === 'execute') { state = executeRiver(state); sandbox = false; place = 'advisor'; musicStarted = true; syncMusic(); save(); render('river-outcome-title'); }
  else if (action === 'next') { state = nextRiver(state); sandbox = false; place = 'advisor'; save(); render(state.phase === 'complete' ? 'river-ending-title' : 'river-season-title'); }
  else if (action === 'repeat') { state = chooseRiverPolicy(state, lastResult()!.policy); save(); render('river-repeat'); }
  else if (action === 'advisor') { place = 'advisor'; render(); }
  else if (action === 'try') { sandbox = !sandbox; sandboxPolicy = lastResult()!.policy; render(sandbox ? 'river-trial-policy' : 'river-try'); }
  else if (action === 'motion') { motion = !motion; try { localStorage.setItem(MOTION_KEY, motion ? 'on' : 'off'); } catch { /* Keep this page usable. */ } render('river-motion'); }
  else if (action === 'music') {
    if (musicFailed) { musicFailed = false; music.load(); musicOn = true; }
    else musicOn = !musicOn || !musicStarted;
    musicStarted = true;
    try { localStorage.setItem(MUSIC_KEY, musicOn ? 'on' : 'off'); } catch { /* This visit still works. */ }
    syncMusic();
  }
  else if (action === 'reset') document.querySelector<HTMLDialogElement>('#river-reset-dialog')?.showModal();
  else if (action === 'cancel-reset') document.querySelector<HTMLDialogElement>('#river-reset-dialog')?.close();
  else if (action === 'confirm-reset') { state = newRiverGame(); sandbox = false; place = 'advisor'; save(); render('river-season-title'); }
});
app.addEventListener('change', event => {
  const select = event.target as HTMLSelectElement;
  if (select.id !== 'river-trial-policy') return;
  sandboxPolicy = select.value as RiverPolicyId; render('river-trial-policy');
});
render();
