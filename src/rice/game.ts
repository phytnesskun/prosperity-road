import css from './game.css?inline';
import { restoreHarbor } from '../harbor/model.ts';
import { createStreetAudio } from '../harbor/audio.ts';
import type { Language, Remark } from '../harbor/audio.ts';
import { startCrossing } from '../harbor/crossing.ts';
import {
  canHold,
  canRent,
  cargoTotal,
  fare,
  maxBuy,
  maxSell,
  restoreRice,
  startRice,
  STALL_RENT,
  trade,
} from './model.ts';
import type { Bank, RiceAction, Stamp } from './model.ts';
import { drawRiceMarket } from './scene.ts';
import { startSeals } from './seals.ts';

const style = document.createElement('style');
style.textContent = css;
document.head.append(style);
document.title = '谁把西岸的粮买空了？ · 繁荣之路';
const storageKey = 'prosperity-road.rice-market.v1';
const names = { west: '西岸', east: '东岸' };
const clerks = { west: '陈禾', east: '阿芸' };
function captainFavor(): boolean {
  try {
    const old = JSON.parse(localStorage.getItem('prosperity-road.fog-harbor.v1') ?? 'null');
    const harbor = restoreHarbor(old?.state);
    return !!harbor && harbor.phase === 'morning' && harbor.dock === 12;
  } catch {
    return false;
  }
}
type OfferBook = Partial<Record<Bank, Stamp[]>>;
function decodeSave(raw: string | null) {
  if (!raw) return null;
  const data = JSON.parse(raw);
  const state = restoreRice(data);
  if (!state) return null;
  const ink: OfferBook = {};
  for (const bank of ['west', 'east'] as const) {
    const marks = data.ink?.[bank];
    if (Array.isArray(marks) && marks.length <= 3 && marks.every((m) => [0, 1, 2].includes(m)))
      ink[bank] = marks.slice();
  }
  return { state, ink };
}
function readSave() {
  try {
    return decodeSave(localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}
const initialSave = readSave();
let state = initialSave?.state ?? startRice(captainFavor());
let ink: OfferBook = initialSave?.ink ?? {};
let stored: string | null = null;
let storageWorking = true;
function save() {
  const raw = JSON.stringify({ ...state, ink });
  try {
    localStorage.setItem(storageKey, raw);
    stored = raw;
    storageWorking = true;
  } catch {
    storageWorking = false;
  }
}

const goPrologue = location.protocol === 'file:' ? '#harbor' : '?scenario=harbor';
const app = document.getElementById('app')!;
app.innerHTML = `<main class="rice-game">
<header class="brandbar"><div class="sign"><span class="crest" aria-hidden="true">米</span><div><p class="series">繁荣之路 · 雾港第二章</p><h1>谁把西岸的粮买空了？</h1></div></div>
<div class="head-buttons"><button class="light-button" data-rice="sound"></button><button class="light-button" data-rice="journal">船主手记</button></div></header>
<div class="gamebox"><section class="rice-stage" aria-label="米行与货船"><canvas class="rice-art" width="960" height="480" aria-label="两岸米行、仓内实物和货船"></canvas>
<div class="daytag"><b id="chapter-month"></b> · <span id="bank-name"></span></div><div class="holdings"><span>钱袋 <b id="cash"></b> 枚</span><span>船舱 <b id="cargo"></b>/4</span></div>
<button type="button" class="spot-button" data-spot="warehouse" style="left:71.8%;top:75%">米仓</button>
<button type="button" class="spot-button" data-spot="boat" style="left:23%;top:82%">货船</button>
<button type="button" class="spot-button" data-spot="clerk" style="left:88%;top:72%">柜台</button>
<span id="drag-sack" class="held-sack" hidden></span><strong class="end-sign" id="end-sign" hidden></strong>
<p id="spoken" class="caption" aria-live="off"></p><div class="stage-layer" id="stage-layer" hidden></div></section>
<section class="counter" aria-label="米行交易"><div class="ticker" aria-live="polite"><strong id="speaker"></strong><p id="line"></p></div>
<div class="action-panel"><div class="trade-tools"><label class="qty">袋数 <select id="quantity"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
<button class="action-button" data-rice="buy">买米装船</button><button class="sale-button" data-rice="sell">照牌价卖</button><button class="sale-button" data-rice="haggle">商印议价</button></div>
<div class="action-row"><button class="dark-button" data-rice="sail"></button><button class="sale-button" data-rice="month">收市换月</button><button class="sale-button" data-rice="end" hidden>本季收账</button><button class="action-button" data-rice="rent" hidden>租摊挂匾</button>
<button class="sale-button" data-rice="again" hidden>再跑一趟</button></div></div></section></div>
<footer class="prices"><div aria-label="两岸消息"><span class="board">西岸 <b id="west-price"></b> 枚 · 仓内 <span id="west-stock"></span> 袋</span>
<span class="board">东岸 <b id="east-price"></b> 枚 · 仓内 <span id="east-stock"></span> 袋</span></div><span id="foot-tip" class="tip"></span></footer>
<dialog class="sheet" id="rice-sheet" aria-labelledby="sheet-title"><h2 id="sheet-title"></h2><div id="sheet-content"></div></dialog></main>`;

const by = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const root = app.querySelector<HTMLElement>('.rice-game')!;
const stage = app.querySelector<HTMLElement>('.rice-stage')!;
const canvas = app.querySelector<HTMLCanvasElement>('.rice-art')!;
const ctx = canvas.getContext('2d')!;
const sheet = by<HTMLDialogElement>('rice-sheet');
const layer = by('stage-layer');
const select = by<HTMLSelectElement>('quantity');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const audio = createStreetAudio((text) => {
  by('spoken').textContent = text;
});
const btn = (s: string) => root.querySelector<HTMLButtonElement>(`[data-rice="${s}"]`)!;
const other = (): Bank => (state.bank === 'west' ? 'east' : 'west');
let speaker: string = clerks[state.bank];
let words = '';
let cue: Remark = state.bank === 'west' ? 'riceCounterWest' : 'riceCounterEast';
let disposal: (() => void) | null = null;
let sheetMode: 'journal' | 'end' | 'again' = 'journal';
let effect: 'buy' | 'sell' | 'month' | 'arrive' | undefined;
let effectAt = 0;
let t = 0;
let lastTick = 0;
const quantity = () => Number(select.value);

function greeting() {
  if (state.ended)
    return state.stallName
      ? `“${state.stallName}”的招牌挂起来了，第一位熟客已经到了。`
      : '账本合上了。下次开船，你想带几袋？';
  if (state.month === 2)
    return `新价牌挂好了。${names[state.bank]}今天每袋 ${state.prices[state.bank]} 枚，船舱里还有 ${cargoTotal(state)} 袋米。`;
  if (state.bank === 'east') return '系好船了？我收对岸来的米。照牌价过秤，或到柜台来谈。';
  if (state.warehouses.west === 4 && state.cash === 28 && cargoTotal(state) === 0)
    return state.freePass
      ? '船长把第一趟船票给你留好了。四袋新米在这儿，搬几袋由你定。'
      : '月底了，河两边都是六枚一袋。你有二十八枚本钱，船上能装四袋。装多少，你来定。';
  return `你回到西岸柜台。仓里余 ${state.warehouses.west} 袋，船舱有 ${cargoTotal(state)} 袋，钱袋里是 ${state.cash} 枚。`;
}
function paint() {
  drawRiceMarket(ctx, {
    bank: state.bank,
    month: state.month,
    stock: state.warehouses[state.bank],
    cargo: cargoTotal(state),
    price: state.prices[state.bank],
    time: t,
    event: effect,
    eventAge: t - effectAt,
    reducedMotion: reduced.matches,
    stallName: state.stallName ?? undefined,
  });
}
function sync() {
  const n = quantity(),
    busy = !layer.hidden;
  root.dataset.bank = state.bank;
  root.dataset.month = String(state.month);
  by('cash').textContent = String(state.cash);
  by('cargo').textContent = String(cargoTotal(state));
  by('chapter-month').textContent = state.month === 1 ? '第1月 · 月底' : '第2月 · 新市';
  by('bank-name').textContent = names[state.bank] + '米行';
  for (const bank of ['west', 'east'] as const) {
    by(bank + '-price').textContent = String(state.prices[bank]);
    by(bank + '-stock').textContent = String(state.warehouses[bank]);
  }
  by('speaker').textContent = speaker;
  by('line').textContent = words;
  const price = state.prices[state.bank],
    ticket = fare(state);
  btn('buy').textContent = `装船 · ${n * price} 枚`;
  btn('sell').textContent = `照价卖 · ${n * price} 枚`;
  btn('sail').textContent =
    `开往${names[other()]} · ${ticket ? '船票 ' + ticket + ' 枚' : state.freePass ? '船长请客' : '帮工抵票'}`;
  btn('buy').disabled = busy || n > maxBuy(state);
  btn('sell').disabled = btn('haggle').disabled = busy || n > maxSell(state);
  for (const id of ['sail', 'end', 'rent', 'month', 'again', 'journal']) btn(id).disabled = busy;
  btn('sound').textContent = audio.sound ? '♪ 声音开' : '♪ 声音关';
  btn('sound').setAttribute('aria-pressed', String(audio.sound));
  root.querySelector<HTMLElement>('.trade-tools')!.hidden = state.ended;
  btn('sail').hidden = state.ended;
  btn('month').hidden = state.month === 2 || state.ended;
  btn('end').hidden = state.month === 1 || state.ended;
  btn('rent').hidden = !canRent(state);
  btn('again').hidden = !state.ended;
  select.disabled = busy;
  root.querySelectorAll<HTMLButtonElement>('[data-spot]').forEach((b) => {
    b.hidden = state.ended || busy;
  });
  by('foot-tip').textContent = state.ended
    ? '本季已收账'
    : `本岸还收 ${state.demand[state.bank]} 袋对岸米 · ${canHold(state) ? '口才可留一印' : '可把米仓拖向货船装货'}`;
  by('end-sign').hidden = !state.stallName;
  by('end-sign').textContent = state.stallName ?? '';
  paint();
}
function cleanupLayer() {
  disposal?.();
  disposal = null;
  layer.replaceChildren();
  layer.hidden = true;
}
function notice(who: string, text: string) {
  speaker = who;
  words = text;
  sync();
}
function useSaved(saved: ReturnType<typeof readSave>) {
  if (!saved) return;
  cleanupLayer();
  if (sheet.open) sheet.close();
  state = saved.state;
  ink = saved.ink;
  speaker = clerks[state.bank];
  words = greeting();
  effect = undefined;
  sync();
}
function current(): boolean {
  if (!storageWorking) return true;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw || raw === stored) return true;
    const saved = decodeSave(raw);
    if (saved) {
      useSaved(saved);
      stored = raw;
      return false;
    }
  } catch {
    /* Storage may be unavailable when playing a loose HTML file. */
  }
  return true;
}
window.addEventListener('storage', (e) => {
  if (e.key === storageKey) current();
});
function transact(action: RiceAction) {
  if (!current()) return;
  const s = state,
    result = trade(s, action);
  if (!result.ok) {
    notice(clerks[s.bank], result.text);
    return;
  }
  if (action.type === 'sell') delete ink[s.bank];
  if (action.type === 'close' || action.type === 'rent') ink = {};
  state = result.state;
  save();
  let detail = result.text;
  speaker = clerks[state.bank];
  switch (action.type) {
    case 'buy':
      effect = 'buy';
      cue =
        state.bank === 'west'
          ? state.warehouses.west === 0
            ? 'riceEmpty'
            : 'riceLoaded'
          : 'riceCounterEast';
      if (!state.warehouses[state.bank]) detail += ' 掌柜把最后一只空箩倒扣在仓门边。';
      break;
    case 'sell':
      effect = 'sell';
      cue =
        state.bank === 'east' ? (state.warehouses.east === 8 ? 'ricePlenty' : 'riceCounterEast') : 'riceDeal';
      if (state.warehouses[state.bank] === 8) detail += ' 米袋堆到了门口。';
      if (!canHold(s) && canHold(state)) detail += ' 下次议价，你可以先留一枚中意的商印。';
      break;
    case 'sail':
      effect = 'arrive';
      speaker = '船长';
      cue = state.bank === 'east' ? 'riceEast' : 'riceCounterWest';
      break;
    case 'close':
      if (!state.ended) {
        effect = 'month';
        cue = 'riceMonth';
        speaker = '船长';
        detail = `掌柜翻过木牌：西岸每袋 ${s.prices.west} → ${state.prices.west} 枚，东岸 ${s.prices.east} → ${state.prices.east} 枚。缆绳还在你手里。`;
      } else {
        cue = 'riceDeal';
        detail = ending();
      }
      break;
    case 'rent':
      effect = 'arrive';
      cue = 'riceSign';
      detail += ' ' + ending();
      break;
  }
  effectAt = t;
  audio.start();
  audio.playEffect(action.type === 'sail' ? 'horn' : action.type === 'close' ? 'bell' : 'cash');
  audio.say(cue);
  notice(speaker, detail);
}
function ending() {
  const delta = state.cash - 28;
  return `钱袋剩 ${state.cash} 枚（开张时 28 枚），${delta >= 0 ? '净增' : '净少'} ${Math.abs(delta)} 枚。${cargoTotal(state) ? '船上还有 ' + cargoTotal(state) + ' 袋未售米。' : ''}`;
}
function interact(id: string) {
  if (id === 'sound') {
    audio.start();
    audio.setSound(!audio.sound);
    sync();
    return;
  }
  if (!layer.hidden || sheet.open || !current()) return;
  audio.start();
  if (id === 'journal' || id === 'end' || id === 'rent' || id === 'again') {
    openSheet(id === 'journal' ? 'journal' : id === 'again' ? 'again' : 'end');
    return;
  }
  if (state.ended) return;
  const n = quantity();
  if (id === 'buy' || id === 'sell') {
    transact({ type: id, qty: n });
    return;
  }
  if (id === 'month' && state.month === 1) {
    transact({ type: 'close' });
    return;
  }
  if (id === 'haggle') {
    if (maxSell(state) < n) {
      notice(clerks[state.bank], '带上从对岸运来的米，掌柜才能跟你议价。');
      return;
    }
    audio.say(state.bank === 'east' ? 'riceSeals' : 'riceWestSeals');
    layer.hidden = false;
    sync();
    disposal = startSeals(
      layer,
      {
        price: state.prices[state.bank],
        quantity: n,
        canHold: canHold(state),
        reducedMotion: reduced.matches,
        initialStamps: ink[state.bank],
        onStamp: (marks) => {
          if (current()) {
            ink[state.bank] = [...marks];
            save();
          }
        },
      },
      (stamps) => {
        cleanupLayer();
        transact({ type: 'sell', qty: n, stamps });
      },
      () => {
        cleanupLayer();
        sync();
        btn('haggle').focus({ preventScroll: true });
      }
    );
    return;
  }
  if (id === 'sail') {
    audio.stopVoice();
    audio.playEffect('horn');
    layer.hidden = false;
    sync();
    disposal = startCrossing(
      layer,
      () => {
        cleanupLayer();
        transact({ type: 'sail' });
      },
      () => {
        cleanupLayer();
        sync();
        btn('sail').focus({ preventScroll: true });
      },
      other()
    );
  }
}
function openSheet(mode: typeof sheetMode) {
  sheetMode = mode;
  audio.stopVoice();
  const title = by('sheet-title'),
    content = by('sheet-content');
  if (mode === 'again') {
    title.textContent = '重新开张？';
    content.innerHTML =
      '<p>用二十八枚本钱从西岸再开一局。会替换本章的本机进度。</p><div class="pane-actions"><button class="action-button" data-rice="confirm-again">重新开张</button><button class="light-button" data-rice="back">留在本局</button></div>';
  } else if (mode === 'end') {
    title.textContent = '本季收账';
    content.innerHTML = `<p>${ending()}</p><p>已付船费 ${state.paidFares} 枚，凭议价多得 ${state.talkBonus} 枚。</p>${canRent(state) ? `<label>摊位招牌 <input id="stall-name" maxlength="8" value="雾港米铺"></label><button class="action-button" data-rice="confirm-rent">付 ${STALL_RENT} 枚挂匾开摊</button>` : ''}
    <div class="pane-actions"><button class="light-button" data-rice="confirm-end">带钱收工</button><button class="light-button" data-rice="back">再逛一会儿</button></div>`;
  } else {
    title.textContent = '船主手记';
    content.innerHTML = `<p>本月牌价开市时挂出，收市换月后按仓里的余粮调整。每程船票两枚，船上可装四袋，每家米行每月最多收四袋对岸米。</p>
    <p>已付船费 ${state.paidFares} 枚，议价多收 ${state.talkBonus} 枚。谈成 ${state.speech} 笔议价生意。${canHold(state) ? '落印前可以先留一枚。' : '谈成第一笔议价，就能学会留一枚商印。'}${state.freePass ? ' 船长给你留了一张赠票。' : ''}</p>
    <label>人物配音 <select id="rice-language"><option value="zh">中文</option><option value="en">English</option><option value="off">关闭</option></select></label>
    <div class="pane-actions"><button class="action-button" data-rice="back">回米行</button><button class="light-button" data-rice="hear">听掌柜说</button><button class="light-button" data-rice="again">重开本章</button><a href="${goPrologue}">回到雾港序章</a></div>
    <p class="fine">${storageWorking ? '进度随每笔成交保存在本机。' : '此设备无法保存，关窗前可继续游玩。'}</p>`;
    const lang = by<HTMLSelectElement>('rice-language');
    lang.value = audio.language;
    lang.onchange = () => audio.setLanguage(lang.value as Language);
  }
  if (!sheet.open) sheet.showModal();
}
function sheetAction(id: string) {
  if (id === 'again') {
    openSheet('again');
    return;
  }
  if (id === 'back' || id === 'hear') {
    sheet.close();
    if (id === 'hear') {
      audio.start();
      audio.say(cue);
    }
    return;
  }
  if (id === 'confirm-rent') {
    const name = by<HTMLInputElement>('stall-name').value.trim();
    if (!name || /[<>&"]/.test(name)) {
      by<HTMLInputElement>('stall-name').setCustomValidity('请给摊位起一个简单的名字。');
      by<HTMLInputElement>('stall-name').reportValidity();
      return;
    }
    sheet.close();
    transact({ type: 'rent', name });
    return;
  }
  if (id === 'confirm-end') {
    sheet.close();
    transact({ type: 'close' });
    return;
  }
  if (id === 'confirm-again') {
    sheet.close();
    state = startRice(captainFavor());
    ink = {};
    save();
    select.value = '1';
    effect = undefined;
    cue = 'riceWest';
    audio.stopVoice();
    notice(clerks.west, greeting());
  }
}
root.addEventListener('click', (e) => {
  const el = (e.target as Element).closest<HTMLButtonElement>('[data-rice]');
  if (!el || el.disabled) return;
  if (sheet.open) {
    if (sheet.contains(el)) sheetAction(el.dataset.rice!);
  } else interact(el.dataset.rice!);
});
sheet.addEventListener('input', (e) => {
  if (e.target instanceof HTMLInputElement) e.target.setCustomValidity('');
});
select.onchange = sync;
const spots = root.querySelectorAll<HTMLButtonElement>('[data-spot]');
type Spot = 'boat' | 'warehouse' | 'clerk';
const spotClick = (spot: Spot) => {
  if (spot === 'boat') {
    interact('sail');
    return;
  }
  const n = quantity();
  if (spot === 'warehouse') interact('buy');
  else if (maxSell(state) >= n) interact('haggle');
  else {
    audio.start();
    cue = state.bank === 'west' ? 'riceCounterWest' : 'riceCounterEast';
    audio.say(cue);
    notice(
      clerks[state.bank],
      `这埠收对岸来的米，还收 ${state.demand[state.bank]} 袋，每袋 ${state.prices[state.bank]} 枚。`
    );
  }
};
let drag: { spot: Spot; x: number; y: number; pointerId: number } | null = null;
function clearDrag() {
  drag = null;
  stage.classList.remove('hauling');
  by('drag-sack').hidden = true;
}
function paintedSpot(e: PointerEvent): Spot | null {
  const r = canvas.getBoundingClientRect(),
    x = ((e.clientX - r.left) * 960) / r.width,
    y = ((e.clientY - r.top) * 480) / r.height;
  if (x >= 75 && x <= 321 && y >= 235 && y <= 361) return 'boat';
  if (x >= 542 && x <= 773 && y >= 217 && y <= 335) return 'warehouse';
  if (x >= 795 && x <= 940 && y >= 170 && y <= 330) return 'clerk';
  return null;
}
function handleCargo(b: HTMLElement, label?: Spot) {
  if (label)
    b.addEventListener('click', (e) => {
      if (e.detail === 0 && !drag) spotClick(label);
    });
  b.onpointerdown = (e) => {
    const spot = label ?? paintedSpot(e);
    if (e.button !== 0 || drag || !spot || state.ended || !layer.hidden) return;
    audio.start();
    drag = { spot, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    b.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  b.onpointermove = (e) => {
    if (!label && !drag) canvas.style.cursor = paintedSpot(e) ? 'grab' : 'default';
    if (!drag || drag.pointerId !== e.pointerId || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5)
      return;
    const box = stage.getBoundingClientRect(),
      icon = by('drag-sack');
    icon.hidden = false;
    icon.style.left = e.clientX - box.left + 'px';
    icon.style.top = e.clientY - box.top + 'px';
    stage.classList.add('hauling');
  };
  b.onpointerup = (e) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const spot = drag.spot;
    const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 7;
    clearDrag();
    if (!moved) {
      spotClick(spot);
      return;
    }
    const element = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-spot]');
    const box = stage.getBoundingClientRect(),
      px = (e.clientX - box.left) / box.width,
      py = (e.clientY - box.top) / box.height;
    const drop =
      element?.dataset.spot ||
      paintedSpot(e) ||
      (py > 0.52 && py < 0.93
        ? px < 0.38
          ? 'boat'
          : px > 0.78
            ? 'clerk'
            : px > 0.62
              ? 'warehouse'
              : null
        : null);
    if (spot === 'warehouse' && drop === 'boat') interact('buy');
    if (spot === 'boat' && (drop === 'clerk' || drop === 'warehouse')) interact('sell');
  };
  b.onpointercancel = clearDrag;
}
spots.forEach((b) => handleCargo(b, b.dataset.spot as Spot));
handleCargo(canvas);
function frame(now: number) {
  if (!document.hidden && layer.hidden && !sheet.open && now - lastTick > 50) {
    t += Math.min(0.1, (now - lastTick) / 1000);
    lastTick = now;
    paint();
  }
  requestAnimationFrame(frame);
}
words = greeting();
save();
sync();
requestAnimationFrame(frame);
