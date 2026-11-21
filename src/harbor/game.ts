import css from './harbor.css?inline';
import ayun from './assets/ayun.webp?inline';
import acheng from './assets/acheng.webp?inline';
import chenhe from './assets/chenhe.webp?inline';
import zhou from './assets/zhou.webp?inline';
import { act, actionsAt, morningComplete, objective, restoreHarbor, startHarbor } from './model.ts';
import type { ActionId, Effect, Place } from './model.ts';
import { createStreetAudio } from './audio.ts';
import type { Language, Remark } from './audio.ts';
import { drawHarbor } from './scene.ts';
import { startCrossing } from './crossing.ts';
import { startBakery } from './bakery.ts';

const style = document.createElement('style');
style.textContent = css;
document.head.append(style);
document.title = '雾港的最后一炉 · 繁荣之路';
const app = document.getElementById('app')!;
const places: Record<Place, { label: string; x: number; y: number; tagY: number }> = {
  dock: { label: '渡口', x: 142, y: 366, tagY: 334 },
  oven: { label: '工坊炉边', x: 469, y: 372, tagY: 332 },
  mill: { label: '面粉铺', x: 641, y: 375, tagY: 337 },
  street: { label: '街口', x: 807, y: 405, tagY: 360 },
};
const destinations = Object.keys(places) as Place[];
const storageKey = 'prosperity-road.fog-harbor.v1';
const start = { x: 760, y: 428 };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
let state = startHarbor();
let x = start.x, y = start.y, facing = -1;
let saveWarning = '';
try {
  const raw = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
  const saved = restoreHarbor(raw?.state);
  if (saved) {
    state = saved;
    if (Number.isFinite(raw.x) && Number.isFinite(raw.y)) {
      x = clamp(raw.x, 70, 885); y = clamp(raw.y, 345, 462);
    }
  }
} catch { /* A new cart is available if the save is inaccessible. */ }

app.innerHTML = `<main class="harbor">
<header class="harbor-header"><div class="mast"><span class="mast-mark" aria-hidden="true">⚓︎</span>
  <div><span class="series">繁荣之路</span><h1>雾港的最后一炉</h1></div></div>
  <div class="harbor-tools"><button class="quiet" id="sound">声音</button><button class="quiet" id="menu">手记与设置</button></div></header>
<div class="game-frame"><section class="street" aria-label="雾港街道，点击地点推车">
  <canvas id="street-canvas" width="960" height="540" tabindex="0" aria-label="用方向键推车，E 与附近的人或货物互动。也可点地名移动。"></canvas>
  <div class="mapstamp"><i class="time-light"></i><span id="time"></span></div>
  <div class="inventory" aria-label="面包车库存"><button id="stock-token" aria-label="把面包拖给附近的客人" title="拖到客人所在的地名，推车过去递货">面包 <b id="stock-count"></b></button><span>铜币 <b id="coins"></b></span><span id="flour-wrap" hidden>面粉 <b id="flour"></b></span></div>
  ${destinations.map(p => `<button class="spot" data-place="${p}" aria-label="推车去${places[p].label}" style="left:${places[p].x/9.6}%;top:${places[p].tagY/5.4}%">${places[p].label}</button>`).join('')}
  <i class="waypoint" id="waypoint" hidden></i><span id="held-bread" hidden>🥖</span><p id="speech-sub"></p>
  <div id="close-up" hidden></div>
</section>
<section class="story" aria-label="街坊与行动"><div class="actor">
  <img id="portrait" class="avatar" alt=""><span id="portrait-other" class="avatar avatar-glyph" aria-hidden="true" hidden></span>
  <div aria-live="polite"><div class="speaker-row"><strong class="speaker" id="speaker"></strong></div><p id="talkline" class="talkline"></p></div></div>
  <div class="command-row" id="commands"></div></section></div>
<footer class="stage-foot"><strong id="objective"></strong><span class="guide" id="keys-hint"><kbd>WASD</kbd> 推车 <kbd>E</kbd> 动手</span></footer>
<dialog class="settings" id="journal"><h2>摊主手记</h2><p class="record" id="record"></p>
<label>人物配音<select id="language"><option value="zh">中文</option><option value="en">English</option><option value="off">关闭</option></select></label>
<p>点击街面或地名推车。轻点面包车会响铃，把车上的面包拖到客人所在的地名，就会推过去交货。右上角的面包也可以拖。</p>
<details id="lesson"><summary>回看这一单</summary><p id="review"></p><p>想试着改变价格和成本，可在爱德思经济平台的「需求、供给与均衡」里打开咖啡市场。</p></details>
<nav><button class="primary" id="resume">回到街上</button><button class="secondary" id="replay-line">再听一句</button>
<button class="secondary" id="new-run">重玩昨晚</button>${location.protocol === 'file:' ? '' : '<a href="?">回面包危机</a>'}</nav>
<div id="reset-ask" hidden><p>从阿芸借车时重新开始？会替换这辆面包车的进度。</p><button class="primary" id="confirm-new">重新开张</button> <button class="secondary" id="cancel-new">保留进度</button></div>
<p id="save-note"></p></dialog></main>`;

const by = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const root = app.querySelector<HTMLElement>('.harbor')!;
const street = app.querySelector<HTMLElement>('.street')!;
const canvas = by<HTMLCanvasElement>('street-canvas');
const ctx = canvas.getContext('2d')!;
const dialog = by<HTMLDialogElement>('journal');
const commands = by('commands');
const audio = createStreetAudio(line => { by('speech-sub').textContent = line; });
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const keys = new Set<string>();
type Target = { x: number; y: number; delivery?: Place };
let target: Target | null = null;
let active: Place | null = nearby();
let message = state.phase === 'opening' && !state.rang
  ? { speaker: '阿芸', text: '帮我看一下摊。那个铃轻点拉，上次半条街的人都来了。' }
  : { speaker: '阿芸', text: objective(state) };
let soundCue: Remark = state.phase === 'morning' ? 'dawn' : state.phase === 'orders' ? 'arrival' : 'welcome';
let event: Effect = null, eventAt = 0, simTime = 0;
let activity: 'bakery' | 'crossing' | null = null;
let leaveActivity: (() => void) | null = null;
let moving = false, lastFrame = 0, lastPaint = -1;
let track: number | null = null;
let draggingBread = false;
let dragFrom: { x: number; y: number } | null = null;

function nearby(): Place | null {
  let best: Place | null = null;
  let distance = 76;
  for (const p of destinations) {
    const d = Math.hypot(x - places[p].x, (y - places[p].y) * 1.25);
    if (d < distance) { best = p; distance = d; }
  }
  return best;
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({ state, x: Math.round(x), y: Math.round(y) })); saveWarning = ''; }
  catch { saveWarning = '这台设备的存储不可用，本次进度仅保留到关窗。'; }
}
function syncButtons() {
  commands.hidden = !!activity;
  const actions = active ? actionsAt(state, active) : [];
  commands.innerHTML = actions.map((action, i) =>
    `<button class="${i ? 'secondary' : 'primary'}" data-action="${action.id}">${i === 0 ? '<kbd>E</kbd>' : ''}${action.label}</button>`).join('')
    + (!actions.some(a => a.id === 'bell') ? '<button class="secondary" data-action="bell">拉车铃</button>' : '')
    + (morningComplete(state) ? '<button class="secondary" id="again">再过一次昨晚</button>' : '');
}
function syncPeople() {
  by('speaker').textContent = message.speaker;
  by('talkline').textContent = message.text;
  const photo = ({ 阿芸: ayun, 阿诚: acheng, 陈禾: chenhe, 周婶: zhou } as Record<string, string>)[message.speaker];
  const portrait = by<HTMLImageElement>('portrait');
  portrait.hidden = !photo;
  if (photo) portrait.src = photo;
  const glyph = by('portrait-other');
  glyph.hidden = Boolean(photo);
  glyph.textContent = ({ 船长: '⚓︎', 周婶: '☂', 陈禾: '麦', 你: '铃' } as Record<string,string>)[message.speaker] || '港';
}
function sync() {
  root.dataset.phase = state.phase;
  by('time').textContent = state.phase === 'morning' ? '次日 · 早市' : state.phase === 'orders' ? '入夜 · 末班渡船' : '傍晚 · 开摊';
  by('stock-count').textContent = String(state.stock);
  by('coins').textContent = String(state.coins); by('flour').textContent = String(state.flour);
  by('flour-wrap').hidden = !state.flour;
  by('objective').textContent = activity === 'crossing' ? '去对岸磨坊，取一袋系蓝线的面粉。' :
    activity === 'bakery' ? '在炉台上给面包划纹，开炉接住烤盘。' : objective(state);
  by('keys-hint').hidden = !!activity;
  by('keys-hint').innerHTML = state.phase === 'orders' ? '从车上拖面包到地名可直接送货' : '<kbd>WASD</kbd> 推车 <kbd>E</kbd> 动手';
  by<HTMLButtonElement>('menu').disabled = !!activity;
  by('sound').textContent = audio.sound ? '♪ 声音开' : '♪ 声音关';
  by('sound').setAttribute('aria-pressed', String(audio.sound));
  by<HTMLSelectElement>('language').value = audio.language;
  for (const button of street.querySelectorAll<HTMLButtonElement>('[data-place]')) {
    const here = button.dataset.place === active;
    button.classList.toggle('arrived', here);
    if (here) button.setAttribute('aria-current', 'location'); else button.removeAttribute('aria-current');
  }
  syncPeople(); syncButtons();
}
function setCue(id: ActionId, changed: boolean, speaker: string) {
  const cue: Partial<Record<ActionId, Remark>> = { sell: 'arrival', deliverDock: 'dock', deliverWorkers: 'workers',
    buyFlour: 'flour', bake: 'bake', investigate: 'clue', close: 'dawn', sail: 'sail', fire: 'fire', bell: 'customer' };
  const chat: Record<string, Remark> = { '船长':'quayChat', '陈禾':'millChat', '阿诚':'ovenChat', '阿芸':'streetChat' };
  const next = id === 'talk' ? chat[speaker] : changed ? cue[id] : undefined;
  if (next) { soundCue = next; audio.say(next); }
  else audio.stopVoice();
}
function commitAction(id: ActionId, place: Place) {
  const previous = state;
  const r = act(state, place, id);
  state = r.state; message = r;
  if (id === 'close' && state.phase !== previous.phase) {
    x = start.x; y = start.y; active = nearby(); target = null; keys.clear();
  }
  event = r.effect; eventAt = simTime;
  audio.playEffect(event); setCue(id, state !== previous, r.speaker);
  if (state !== previous) save();
  sync();
}
function clearActivity() {
  leaveActivity?.(); leaveActivity = null;
  by('close-up').hidden = true;
  activity = null; keys.clear();
}
function closeUp(id: 'sail' | 'bake' | 'fire', place: Place) {
  const host = by('close-up');
  activity = id === 'sail' ? 'crossing' : 'bakery';
  message = id === 'sail' ? { speaker:'船长', text:'轮舵交给你。看见水上的两盏引航灯了吗？蓝线面粉在对岸等着。' }
    : { speaker:'阿诚', text:'我管炉火，你来给面包划个自己的记号。觉得香了，就接盘！' };
  host.hidden = false; audio.stopVoice(); sync();
  const cancel = () => {
    clearActivity();
    message = act(state, place, 'talk'); sync(); canvas.focus({preventScroll:true});
  };
  const finish = (crisp?: boolean) => {
    if (!activity) return;
    clearActivity(); commitAction(id, place);
    if (id !== 'sail') {
      message = { speaker: message.speaker, text: message.text + (crisp ? ' 这盘边儿烤得正脆。' : ' 这盘松软，拿布盖好。') };
      syncPeople();
    }
    canvas.focus({preventScroll:true});
  };
  leaveActivity = id === 'sail' ? startCrossing(host, finish, cancel) : startBakery(host, id === 'fire', finish, cancel);
}
function interact(id: ActionId) {
  audio.start();
  if (activity) return;
  if (!active && id !== 'bell') return;
  if (!active && id === 'bell') {
    event = 'bell'; eventAt = simTime; audio.playEffect('bell');
    message = { speaker: '你', text: '铃声顺着石板路传了出去。推近一点，街坊就能接到你的面包。' }; syncPeople(); return;
  }
  target = null; keys.clear(); showTarget();
  if ((id === 'sail' || id === 'bake' || id === 'fire') && active && actionsAt(state, active).some(a => a.id === id)) {
    closeUp(id, active); return;
  }
  commitAction(id, active!);
}
function showTarget() {
  const point = by('waypoint');
  point.hidden = !target;
  if (target) { point.style.left = `${target.x/9.6}%`; point.style.top = `${target.y/5.4}%`; }
}
function go(tx: number, ty: number, delivery?: Place) {
  if (activity) return;
  target = { x: clamp(tx, 70, 885), y: clamp(ty, 345, 462), delivery };
  showTarget();
}
function screenPoint(e: PointerEvent) {
  const rect = street.getBoundingClientRect();
  return { x: (e.clientX - rect.left) * 960 / rect.width, y: (e.clientY - rect.top) * 540 / rect.height };
}
function move(dt: number) {
  if (activity) return false;
  let dx = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
  let dy = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
  const manual = dx !== 0 || dy !== 0;
  if (manual) { target = null; showTarget(); }
  else if (target) { dx = target.x - x; dy = target.y - y; }
  else return false;
  const distance = Math.hypot(dx, dy);
  const step = 272 * dt;
  const reached = !manual && distance <= Math.max(step, 1);
  if (reached && target) { x = target.x; y = target.y; }
  else if (distance > 0) { x = clamp(x + dx / distance * step, 70, 885); y = clamp(y + dy / distance * step, 345, 462); }
  if (Math.abs(dx) > .01) facing = Math.sign(dx);
  const here = nearby();
  if (here !== active) { active = here; sync(); }
  if (reached) {
    const delivery = target?.delivery; target = null; showTarget();
    if (delivery && delivery === active) {
      const id = ({ street: 'sell', dock: 'deliverDock', oven: 'deliverWorkers' } as Partial<Record<Place, ActionId>>)[delivery];
      if (id && actionsAt(state, delivery).some(a => a.id === id)) interact(id);
      else { message = { speaker:'你', text:'这儿眼下没人接这篮货。可以拉铃、看看附近的人，或推去另一处。' }; syncPeople(); }
    }
    save();
  }
  return !reached;
}
function renderFrame(stamp: number) {
  const dt = Math.min(Math.max(0, (stamp - (lastFrame || stamp)) / 1000), .05);
  lastFrame = stamp;
  if (!dialog.open && !activity && !document.hidden) {
    simTime += dt;
    moving = move(dt);
    if (stamp - lastPaint >= 32 || moving) {
      lastPaint = stamp; paintStreet();
    }
  }
  requestAnimationFrame(renderFrame);
}
function paintStreet() {
  drawHarbor(ctx, { x, y, facing, moving, time: simTime, morning: state.phase === 'morning',
    boat: state.phase === 'morning' && state.dock === 12, oven: state.phase === 'morning' && state.workers === 12,
    shipArrived: state.phase !== 'opening', crowd: state.phase === 'opening' ? Number(state.rang) : Math.max(1, 4 - state.workers / 6),
    stock: state.stock, event, eventAge: simTime - eventAt, reducedMotion: reduced.matches });
}
function openJournal(confirmReset = false) {
  audio.stopVoice(); keys.clear(); target = null; showTarget();
  by('record').textContent = state.phase === 'opening' ? '阿芸把面包车交给了你。' :
    `船上的修桥队收到 ${state.dock}/12 个，夜班工友收到 ${state.workers}/12 个。${state.clue ? '木牌上写着「西桥复工」。' : ''}`;
  by('lesson').hidden = !morningComplete(state);
  by('review').textContent = `汽笛带来了另一份十二人的订单，你卖完第一份时车上只有十二个。${state.baked ? '你用六枚铜币换来一袋面粉，借炉补出十二个，把可送出的货加了一倍。' : '你把有限的面包送给了一边，第二天他们兑现了承诺。'}`;
  by('save-note').textContent = saveWarning || '这辆车的进度保存在本机。';
  by('reset-ask').hidden = !confirmReset;
  dialog.showModal();
}
function reset() {
  state = startHarbor(); x = start.x; y = start.y; active = nearby(); facing = -1;
  target = null; event = null; soundCue = 'welcome';
  message = { speaker:'阿芸', text:'帮我看一下摊。那个铃轻点拉，上次半条街的人都来了。' };
  save(); showTarget(); sync(); dialog.close(); audio.say('welcome');
}
document.addEventListener('pointerdown', () => audio.start(), { once:true });
by('sound').onclick = () => { audio.setSound(!audio.sound); audio.start(); sync(); };
by('menu').onclick = () => openJournal();
by('resume').onclick = () => dialog.close();
by('replay-line').onclick = () => { dialog.close(); audio.start(); audio.say(soundCue); };
by<HTMLSelectElement>('language').onchange = e => audio.setLanguage((e.target as HTMLSelectElement).value as Language);
by('new-run').onclick = () => { by('reset-ask').hidden = false; };
by('cancel-new').onclick = () => { by('reset-ask').hidden = true; };
by('confirm-new').onclick = reset;
commands.onclick = e => {
  const button = (e.target as HTMLElement).closest('button');
  if (button?.dataset.action) interact(button.dataset.action as ActionId);
  else if (button?.id === 'again') openJournal(true);
};
street.querySelectorAll<HTMLButtonElement>('[data-place]').forEach(button => {
  button.onclick = () => { audio.start(); const p = button.dataset.place as Place; go(places[p].x, places[p].y); };
});
function beginDrag(e: PointerEvent) {
  draggingBread = true; dragFrom = screenPoint(e);
  (e.currentTarget as Element).setPointerCapture(e.pointerId);
}
function dragLoaf(e: PointerEvent) {
  if (!draggingBread || !dragFrom) return;
  const p = screenPoint(e);
  if (Math.hypot(p.x-dragFrom.x,p.y-dragFrom.y) < 5) return;
  const loaf = by('held-bread');
  loaf.hidden = false; loaf.style.left = `${p.x/9.6}%`; loaf.style.top = `${p.y/5.4}%`;
  street.classList.add('unloading');
}
function releaseLoaf(e: PointerEvent, fromCart: boolean) {
  if (!draggingBread) return;
  const point = screenPoint(e);
  const dragged = !!dragFrom && Math.hypot(point.x-dragFrom.x,point.y-dragFrom.y) > 8;
  stopDrag();
  if (!dragged) { if (fromCart) interact('bell'); return; }
  if (point.x < 0 || point.x > 960 || point.y < 0 || point.y > 540) return;
  const destination = destinations.find(p => Math.abs(point.x-places[p].x)<82 && point.y>places[p].tagY-65 && point.y<places[p].y+70);
  if (destination) go(places[destination].x,places[destination].y,destination);
}
function stopDrag() {
  draggingBread = false; dragFrom = null; by('held-bread').hidden = true;
  street.classList.remove('unloading');
}
canvas.onpointerdown = e => {
  if (e.button !== 0) return;
  canvas.focus({preventScroll:true});
  const at = screenPoint(e);
  if (Math.abs(at.x-x)<32 && at.y>=y-61 && at.y<=y-5) { beginDrag(e); return; }
  track = e.pointerId; canvas.setPointerCapture(e.pointerId); go(at.x, at.y);
};
canvas.onpointermove = e => {
  if (draggingBread) dragLoaf(e);
  else if (track === e.pointerId) { const at = screenPoint(e); go(at.x, at.y); }
};
canvas.onpointerup = e => { releaseLoaf(e,true); track = null; };
canvas.onpointercancel = () => { stopDrag(); track = null; };
const stockToken = by<HTMLButtonElement>('stock-token');
stockToken.onpointerdown = e => {
  if (e.button === 0 && state.stock && !activity) beginDrag(e);
};
stockToken.onpointermove = dragLoaf;
stockToken.onpointerup = e => releaseLoaf(e,false);
stockToken.onpointercancel = stopDrag;
const movementKeys = new Set(['a','d','w','s','arrowleft','arrowright','arrowup','arrowdown']);
document.addEventListener('keydown', e => {
  if (dialog.open || activity || e.altKey || e.ctrlKey || e.metaKey || e.target instanceof HTMLSelectElement) return;
  const k = e.key.toLowerCase();
  if (movementKeys.has(k)) { e.preventDefault(); audio.start(); keys.add(k); return; }
  if (e.repeat) return;
  if (k === 'e') { e.preventDefault(); if (active) interact(actionsAt(state,active)[0].id); }
  else if (k === ' ' && (e.target === document.body || e.target === canvas || !(e.target instanceof HTMLButtonElement))) { e.preventDefault(); interact('bell'); }
  else if (k === 'escape') { e.preventDefault(); openJournal(); }
});
document.addEventListener('keyup', e => { if (keys.delete(e.key.toLowerCase()) && keys.size === 0) save(); });
window.addEventListener('blur', () => { keys.clear(); stopDrag(); track = null; });
sync(); paintStreet(); requestAnimationFrame(renderFrame);
