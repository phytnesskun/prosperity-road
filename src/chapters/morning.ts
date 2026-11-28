import type { ChapterContext } from './shared.ts';

export const morningLines = {
  ticket: [
    '周婶',
    '这张票我留了三年。船长，往后每天早上，都有船吗？',
    'I’ve kept this ticket for three years. Captain, will there be a boat every morning now?',
  ],
  crates: [
    '阿芸',
    '新货都捆好了。你给我匀个船位，靠岸我就付钱。',
    'My crates are tied up. Save me some space, and I’ll pay when they reach the landing.',
  ],
  welcome: ['船长', '头一班船，谁先上？你来招呼。', 'First boat out. Who’s boarding? You call them aboard.'],
  aboard: ['周婶', '当心脚底。来，坐我边上。', 'Mind the step. Here, sit beside me.'],
  eggs: [
    '陈禾',
    '我摸黑就出门了。这担鸡蛋，赶得上早市！',
    'I left in the dark. These eggs might just make the morning market!',
  ],
  ashore: [
    '船长',
    '先搬回岸上。缆绳还拴着，你慢慢排。',
    'Back to the landing, then. We’re still tied up. Take your time.',
  ],
  near: [
    '船长',
    '近埠到了！回去还能赶上一趟，绳子留着给我。',
    'Here’s the near landing! Time for another run. Leave that line for me.',
  ],
  evening: [
    '阿芸',
    '明儿几点走？我好给搬货的捎个准信。',
    'When do you sail tomorrow? I’d like to tell my porters what to expect.',
  ],
  early: [
    '船长',
    '早班二字挂好了。天一亮，可就有人来等喽。',
    'The morning sailing is on the board. They’ll be here at first light.',
  ],
  flex: [
    '船长',
    '今儿随到随开。碰上有货的人，就顺便捎一程。',
    'We sail as people turn up today. We can take whatever cargo comes along.',
  ],
  regular: [
    '周婶',
    '明早我还从这儿走。我记得你挂的那块牌。',
    'I’ll come this way tomorrow. I remember the sign you put up.',
  ],
  receipt: [
    '阿芸',
    '货到了。运钱给你收好，下回我还认这条船。',
    'The cargo’s here. Take your freight money. I’ll look for your boat next time.',
  ],
  home: [
    '船长',
    '靠岸了！把跳板搭稳，咱们收船。',
    'We’re alongside! Lay the plank steady. That’s the last run.',
  ],
} as const;

import {
  actMorning,
  morningEnding,
  morningReceipts,
  morningTotals,
  restoreMorning,
  waitingMorning,
} from './morning-model.ts';
import type { MorningAction, MorningLoad, MorningState } from './morning-model.ts';
import { morningHit, morningLanding, paintMorning } from './morning-scene.ts';
import type { MorningScene } from './morning-scene.ts';

const loads = ['passenger', 'crate', 'eggs'] as const;
const labels: Record<MorningLoad, string> = { passenger: '街坊', crate: '货箱', eggs: '挑蛋客' };
const units: Record<MorningLoad, string> = { passenger: '位', crate: '箱', eggs: '位' };
const berthActions = ['unload-0', 'unload-1', 'unload-2'] as const;
const crewLines = {
  passenger: 'aboard',
  crate: 'crates',
  eggs: 'eggs',
  uncover: 'welcome',
  'unload-0': 'ashore',
  'unload-1': 'ashore',
  'unload-2': 'ashore',
  undo: 'ashore',
  early: 'eggs',
  flex: 'flex',
} as const;

function bell(state: MorningState): keyof typeof morningLines {
  if (state.phase === 'covered') return 'ticket';
  if (state.phase === 'posting') return 'evening';
  if (state.phase === 'done') {
    const cargo = state.trips.at(-1)?.cargo ?? [];
    if (state.board === 'early' && cargo.includes('passenger')) return 'regular';
    if (cargo.includes('crate')) return 'receipt';
    return 'home';
  }
  if (state.day === 2) return state.board === 'early' ? 'early' : 'flex';
  return state.trips.length ? 'near' : 'welcome';
}

export function mountMorning(host: HTMLElement, ctx: ChapterContext): void {
  let state = restoreMorning(ctx.load());
  const lampCount = Number(host.dataset.bridgeLamps);
  const bridgeLamps = Number.isInteger(lampCount) && lampCount >= 0 && lampCount <= 6 ? lampCount : undefined;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const bridgeEcho =
    bridgeLamps === undefined
      ? '周婶把一张折旧的船票压在柜台上。'
      : bridgeLamps > 0
        ? `昨晚点亮的 ${bridgeLamps} 盏桥灯还没熄。周婶已经拿着旧船票到了。`
        : '周婶提着旧手灯下了桥，另一只手攥着那张旧船票。';

  host.innerHTML = `<section class="morning-yard" aria-label="雾港西岸渡口">
    <div class="morning-view">
      <canvas width="960" height="420" class="morning-scene" aria-label="西岸码头，等船的街坊和商货、三席渡船与船班牌"></canvas>
      <div class="morning-day" data-morning-clock></div><div class="morning-cash" data-morning-wallet></div>
      <span class="morning-held" aria-hidden="true" hidden></span>
    </div>
    <div class="morning-desk">
      <div class="morning-intro"><div class="morning-copy"><h2 data-morning-title></h2><p data-morning-intro></p></div>
        <button class="morning-primary" data-morning="uncover">翻开船班牌</button>
      </div>
      <div class="morning-boarding" hidden>
        <div class="morning-loading"><div class="morning-row">
          <strong>栈桥候船</strong>
          <div class="morning-tickets">
            <button data-morning="passenger"></button><button data-morning="crate"></button><button data-morning="eggs"></button>
          </div>
        </div><div class="morning-row">
          <strong>船上三位</strong>
          <div class="morning-seats">
            <button data-morning="unload-0"></button><button data-morning="unload-1"></button><button data-morning="unload-2"></button>
          </div>
        </div></div>
        <div class="morning-sail">
          <button data-morning="near"><strong>先跑近埠</strong><small></small></button>
          <button class="morning-primary" data-morning="east"><strong>直达东岸</strong><small></small></button>
        </div>
      </div>
      <div class="morning-post" hidden>
        <button data-morning="early" class="morning-primary"><strong>明早头班</strong><small>赶早市的人能提前出门</small></button>
        <button data-morning="flex"><strong>随到开船</strong><small>留给晚到的商货</small></button>
      </div>
      <p class="morning-feedback" role="status" aria-live="polite" hidden></p>
    </div>
  </section>`;
  const pick = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
  const button = (action: MorningAction) => pick<HTMLButtonElement>(`[data-morning="${action}"]`);
  const yard = pick('.morning-yard');
  const canvas = pick<HTMLCanvasElement>('.morning-scene');
  const view = pick('.morning-view');
  const held = pick('.morning-held');
  const feedback = pick('.morning-feedback');
  const getScene = (): MorningScene => ({ state, bridgeLamps });

  function talk(key: keyof typeof morningLines) {
    const [speaker, zh, en] = morningLines[key];
    ctx.say(speaker, zh, en);
  }
  function notice(line: string) {
    feedback.textContent = line;
    feedback.hidden = !line;
  }
  function render() {
    const waiting = waitingMorning(state);
    const totals = morningTotals(state);
    const aboard = state.cargo.length;
    const loading = state.phase === 'boarding';
    yard.dataset.day = String(state.day);
    yard.dataset.phase = state.phase;
    pick('[data-morning-clock]').textContent =
      state.day === 2
        ? state.phase === 'done'
          ? '次日 · 已靠岸'
          : state.board === 'early'
            ? '次日 · 破晓早班'
            : '次日 · 机动班'
        : state.phase === 'posting'
          ? '头日 · 落日'
          : state.trips.length
            ? '头日 · 回头船'
            : '头日 · 开埠';
    pick('[data-morning-wallet]').textContent = `钱匣  ${totals.cash} 枚`;
    button('uncover').hidden = state.phase !== 'covered';
    pick('.morning-boarding').hidden = !loading;
    pick('.morning-post').hidden = state.phase !== 'posting';

    const title = pick('[data-morning-title]');
    const intro = pick('[data-morning-intro]');
    if (state.phase === 'covered') {
      title.textContent = '一张三年前的船票';
      intro.textContent = bridgeEcho;
    } else if (state.phase === 'posting') {
      title.textContent = '在牌上留个明天的准信';
      intro.textContent = '陈禾得赶早市，阿芸的货却要等人捆好。你决定哪时开船。';
    } else if (state.phase === 'done') {
      title.textContent = '跳板放下，船到了';
      intro.textContent = `两天共走 ${state.trips.length} 趟，净收 ${totals.cash} 枚。`;
    } else {
      title.textContent =
        state.day === 2
          ? state.board === 'early'
            ? '挑蛋客照着牌上的时间来了'
            : '阿芸把货捆好才来'
          : state.trips.length
            ? '回来还赶得上一趟'
            : '排你的第一班船';
      if (state.day === 1 && !state.trips.length) {
        intro.textContent = '把街坊或货箱拖到船上，也可点选。解缆前都能换位。';
      } else if (state.day === 2) {
        const carried = state.trips.some((trip) => trip.day === 1 && trip.cargo.includes('passenger'));
        intro.textContent =
          state.board === 'early'
            ? carried
              ? '陈禾摸黑挑来了鸡蛋。昨日坐过船的街坊，也带了熟人来。'
              : '陈禾看见早班牌，摸黑挑着鸡蛋出门了。'
            : carried
              ? '昨天坐过船的街坊来碰运气。挑蛋客赶早市，已经走了。'
              : '货主推着车赶来装运，挑蛋客已经去了早市。';
      } else {
        intro.textContent = '近埠来回得快，栈桥上还等着上一船没能捎走的人和货。';
      }
    }
    for (const load of loads) {
      const el = button(load);
      el.hidden = waiting[load] === 0;
      el.disabled = !loading || !waiting[load] || aboard >= 3;
      el.textContent = `${labels[load]} · ${waiting[load]}${units[load]}`;
      el.setAttribute('aria-label', `让${labels[load]}上船，岸上还有${waiting[load]}${units[load]}`);
    }
    berthActions.forEach((action, i) => {
      const occupied = state.cargo[i];
      const el = button(action);
      el.disabled = !loading || !occupied;
      el.textContent = occupied ? labels[occupied] + ' ×' : '空位';
      el.setAttribute('aria-label', occupied ? `卸下第${i + 1}位的${labels[occupied]}` : `第${i + 1}位空着`);
    });
    for (const route of ['near', 'east'] as const) {
      const el = button(route);
      el.hidden = route === 'near' && state.day === 2;
      el.disabled = !loading || !aboard || el.hidden;
      const reward = morningReceipts(route, state.cargo);
      const rest =
        route === 'near' && !state.trips.length ? '还可返航' : state.day === 2 ? '本班收船' : '今日收船';
      el.querySelector('small')!.textContent = el.disabled
        ? route === 'near'
          ? '每人 1 枚 · 每箱 2 枚'
          : '每人 2 枚 · 每箱 5 枚'
        : `净收 ${reward} 枚 · ${rest}`;
    }
    paintMorning(canvas, getScene());
  }

  let frame = 0;
  let sailing = false;
  function finishSailing() {
    cancelAnimationFrame(frame);
    sailing = false;
    view.classList.remove('under-way');
  }
  function setSail(previous: MorningState) {
    if (reducedMotion.matches) return;
    const sailingTrip = state.trips.at(-1)!;
    const scene: MorningScene = { state: previous, bridgeLamps, departing: sailingTrip };
    sailing = true;
    view.classList.add('under-way');
    const started = performance.now();
    const tick = (time: number) => {
      if (!canvas.isConnected) return;
      const t = Math.min(1, Math.max(0, (time - started) / 850));
      if (t < 1) {
        paintMorning(canvas, scene, t);
        frame = requestAnimationFrame(tick);
      } else {
        finishSailing();
        paintMorning(canvas, getScene());
      }
    };
    paintMorning(canvas, scene, 0);
    frame = requestAnimationFrame(tick);
  }
  function act(action: MorningAction) {
    const previous = state;
    const next = actMorning(previous, action);
    if (next === previous) {
      if (
        previous.phase === 'boarding' &&
        loads.some((load) => action === load) &&
        previous.cargo.length === 3
      ) {
        notice('三个位置都满了。点船上任意一位，就能让它回到栈桥。');
      }
      return;
    }
    finishSailing();
    state = next;
    ctx.save(state);
    render();
    if (action === 'near' || action === 'east') {
      const gained = morningTotals(next).cash - morningTotals(previous).cash;
      notice(`${action === 'near' ? '近埠' : '东岸'}到船 · 已付水脚，本趟净收 ${gained} 枚。`);
      setSail(previous);
      talk(bell(state));
    } else {
      notice(
        action.startsWith('unload')
          ? '已经回到栈桥。'
          : loads.some((load) => load === action)
            ? `船位 ${state.cargo.length}/3。`
            : ''
      );
      talk(crewLines[action]);
    }
    if (state.phase === 'done') ctx.finish(morningEnding(state));
  }

  function point(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  type Hit = NonNullable<ReturnType<typeof morningHit>>;
  let drag: { hit: Hit; x: number; y: number; id: number } | null = null;
  function clearDrag() {
    drag = null;
    held.hidden = true;
    view.classList.remove('hauling');
  }
  function tap(hit: Hit) {
    if (hit.kind === 'queue') act(hit.load);
    else if (hit.kind === 'seat' && state.cargo[hit.index]) act(berthActions[hit.index]);
    else if (hit.kind === 'board') {
      if (state.phase === 'covered') act('uncover');
      if (state.phase === 'posting') button('early').focus();
    }
  }
  canvas.onpointerdown = (e) => {
    if (drag || sailing || e.button !== 0) return;
    const p = point(e),
      hit = morningHit(p.x, p.y, getScene());
    if (!hit || (hit.kind !== 'board' && state.phase !== 'boarding')) return;
    drag = { hit, x: e.clientX, y: e.clientY, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  canvas.onpointermove = (e) => {
    const p = point(e);
    const hit = morningHit(p.x, p.y, getScene());
    if (!drag) {
      canvas.style.cursor =
        hit && !sailing && ((hit.kind === 'board' && state.phase === 'covered') || state.phase === 'boarding')
          ? 'pointer'
          : 'default';
      return;
    }
    if (drag.id !== e.pointerId || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    const source = drag.hit;
    const cargo =
      source.kind === 'queue' ? source.load : source.kind === 'seat' ? state.cargo[source.index] : null;
    if (!cargo) return;
    held.hidden = false;
    held.textContent = labels[cargo];
    held.style.left = Math.max(3, Math.min(95, p.x * 100)) + '%';
    held.style.top = Math.max(6, Math.min(97, p.y * 100)) + '%';
    view.classList.add('hauling');
  };
  canvas.onpointerup = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const source = drag.hit,
      moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) >= 7;
    const p = point(e),
      destination = morningHit(p.x, p.y, getScene());
    clearDrag();
    if (!moved) tap(source);
    else if (source.kind === 'queue' && (destination?.kind === 'boat' || destination?.kind === 'seat'))
      act(source.load);
    else if (source.kind === 'seat' && (destination?.kind === 'queue' || morningLanding(p.x, p.y)))
      act(berthActions[source.index]);
    else if (source.kind === 'queue' || source.kind === 'seat') notice('松手处没有接到，这次还在原位。');
  };
  canvas.onpointercancel = clearDrag;
  canvas.onlostpointercapture = clearDrag;
  host.onclick = (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('button[data-morning]');
    if (!el || el.disabled || !host.contains(el)) return;
    act(el.dataset.morning as MorningAction);
    if (el.hidden || el.disabled || !el.getClientRects().length) {
      if (e.detail === 0) {
        const next = [...host.querySelectorAll<HTMLButtonElement>('button:enabled')].find(
          (candidate) => candidate.getClientRects().length
        );
        (next ?? document.getElementById('journey-next'))?.focus();
      }
    }
  };
  render();
  talk(bell(state));
  if (state.phase === 'done') ctx.finish(morningEnding(state));
}
