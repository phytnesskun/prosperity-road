import type { ChapterContext } from '../chapters/shared.ts';
import { marketBoard } from './market-board.ts';
import { bayBoard } from './bay-board.ts';
import { inheritVoyage } from './library.ts';
import { beginVoyage, currentBeat, lastAction, playChoice, restoreVoyage, samePast } from './model.ts';
import { drawTides } from './scene.ts';
import type { StoryChapter } from './types.ts';

function readChapter(id: string) {
  try { return JSON.parse(localStorage.getItem('prosperity-road.harbor-' + id + '.v1') ?? 'null')?.state; }
  catch { return null; }
}

export function mountTides(host: HTMLElement, ctx: ChapterContext, story: StoryChapter) {
  const inherited = inheritVoyage(story.num, readChapter);
  const restored = restoreVoyage(story, ctx.load());
  let state = restored ?? beginVoyage(story.num, inherited);
  let animation = 0;
  let followFocus = false;
  let pointer: number | undefined;
  host.innerHTML = `<article class="tide-yard">
    <div class="tide-heading"><div><h2 data-tide-title></h2><p data-tide-detail></p></div><span data-tide-stage></span></div>
    <div class="tide-scene"><canvas width="1000" height="420" aria-hidden="true"></canvas><div class="tide-spots"></div></div>
    <dl class="tide-board" hidden></dl>
    <div class="tide-controls"><p data-tide-help></p><div data-tide-actions></div></div>
    <p class="tide-result" data-tide-result role="status" hidden></p>
    <button type="button" class="tide-rebase" hidden>从上一章的新经历开始</button>
  </article>`;
  function find<T extends HTMLElement = HTMLElement>(selector: string) { return host.querySelector<T>(selector)!; }
  const canvas = find<HTMLCanvasElement>('canvas');
  const spots = find('.tide-spots');
  const actions = find('[data-tide-actions]');
  const help = find('[data-tide-help]');
  const result = find('[data-tide-result]');
  const rebase = find<HTMLButtonElement>('.tide-rebase');
  rebase.hidden = !restored || samePast(restored.past, inherited);
  host.addEventListener('voyagehistory', () => {
    rebase.hidden = samePast(state.past, inheritVoyage(story.num, readChapter));
  });
  rebase.onclick = () => { document.getElementById('journey-book')?.click(); document.getElementById('journey-reset')?.click(); };

  const board = find('.tide-board');
  let lastBoard = new Map<string,string>();
  function updateBoard() {
    const entries = story.num <= 12 ? marketBoard(story.num, state.past, state.picks) : bayBoard(story.num, state.past, state.picks);
    board.hidden = !entries.length;
    board.replaceChildren();
    for (const { name, value } of entries) {
      const cell = document.createElement('div');
      const label = document.createElement('dt');
      const amount = document.createElement('dd');
      label.textContent = name;
      amount.textContent = value;
      if (lastBoard.has(name) && lastBoard.get(name) !== value) cell.className = 'changed';
      cell.append(label, amount);
      board.append(cell);
    }
    lastBoard = new Map(entries.map(entry => [entry.name, entry.value]));
  }

  function say(cue: string) { ctx.say(...story.lines[cue]); }
  function render() {
    cancelAnimationFrame(animation);
    pointer = undefined;
    const next = currentBeat(story, state);
    const ended = !next;
    const stage = ended ? story.steps.length - 1 : state.picks.length;
    const beat = next ?? story.steps[stage]({ ...state, picks: state.picks.slice(0, -1) });
    const out = ended ? story.end(state) : undefined;
    const last = lastAction(story, state);
    const frame = { chapter: story.num, beat, stage, past: state.past, picks: state.picks, ended, target: null, progress: 0 };
    drawTides(canvas, frame);
    updateBoard();
    host.dataset.tideTurn = String(state.picks.length);
    find('[data-tide-title]').textContent = out?.title ?? beat.title;
    find('[data-tide-detail]').textContent = out?.detail ?? beat.detail;
    find('[data-tide-stage]').textContent = ended ? '已靠岸' : (stage + 1) + ' / ' + story.steps.length;
    result.hidden = !last;
    result.textContent = last?.result ?? '';
    spots.replaceChildren();
    actions.replaceChildren();
    find('.tide-controls').hidden = ended;
    if (ended) {
      ctx.finish(out!.title + ' · ' + out!.detail);
      if (followFocus) document.getElementById('journey-next')?.focus({ preventScroll: true });
      return;
    }

    help.textContent = '把「' + beat.itemLabel + '」拖到去处，或直接点选。';
    function commit(index: number, dropped = false) {
      const choice = beat.choices[index];
      if (!choice || state.picks.length !== stage) return;
      const nextState = playChoice(story, state, choice.id);
      if (nextState === state) return;
      followFocus = host.querySelector(':focus-visible') !== null;
      state = nextState;
      ctx.save(state);
      say(choice.cue);
      result.hidden = false;
      result.textContent = choice.result;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) { render(); return; }
      for (const button of host.querySelectorAll<HTMLButtonElement>('.tide-controls button,.tide-spots button')) button.disabled = true;
      const start = performance.now();
      function paint(now: number) {
        if (!host.isConnected) return;
        const elapsed = Math.min(1, (now - start) / (dropped ? 110 : 340));
        const progress = dropped ? .93 + .07 * elapsed : elapsed;
        drawTides(canvas, { ...frame, target: index, progress });
        if (elapsed < 1) animation = requestAnimationFrame(paint);
        else render();
      }
      animation = requestAnimationFrame(paint);
    }
    const source = document.createElement('button');
    source.type = 'button';
    source.className = 'tide-source';
    source.setAttribute('aria-label', '拿起' + beat.itemLabel);
    source.onclick = () => {
      if (state.picks.length !== stage) return;
      source.classList.add('carrying');
      help.textContent = '拿好了「' + beat.itemLabel + '」。点一下要送去的地方。';
      actions.querySelector('button')?.focus({ preventScroll: true });
    };
    spots.append(source);
    beat.choices.forEach((choice, i) => {
      const target = document.createElement('button');
      target.type = 'button';
      target.className = 'tide-target';
      target.dataset.tideTarget = String(i);
      target.style.left = (48 + 20 * i) + '%';
      target.setAttribute('aria-label', choice.label);
      target.onclick = () => commit(i);
      spots.append(target);
      const option = document.createElement('button');
      option.type = 'button';
      option.dataset.tideChoice = choice.id;
      option.dataset.tideTarget = String(i);
      option.textContent = choice.label;
      if (choice.hint) {
        const hint = document.createElement('small');
        hint.textContent = choice.hint;
        option.append(hint);
      }
      option.onclick = () => commit(i);
      actions.append(option);
    });
    if (followFocus) actions.querySelector('button')?.focus({ preventScroll: true });
    function hit(x: number, y: number) {
      const node = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-tide-target]');
      return node && host.contains(node) ? Number(node.dataset.tideTarget) : null;
    }
    source.onpointerdown = event => {
      if (event.button !== 0 || !event.isPrimary) return;
      pointer = event.pointerId;
      source.setPointerCapture(event.pointerId);
    };
    source.onpointermove = event => {
      if (pointer !== event.pointerId) return;
      const index = hit(event.clientX, event.clientY);
      for (const node of host.querySelectorAll<HTMLElement>('[data-tide-target]'))
        node.classList.toggle('over', index !== null && Number(node.dataset.tideTarget) === index);
      const box = canvas.getBoundingClientRect();
      drawTides(canvas, { ...frame, drag: { x: (event.clientX - box.left) * 1000 / box.width, y: (event.clientY - box.top) * 420 / box.height } });
    };
    function release() {
      pointer = undefined;
      for (const node of host.querySelectorAll('.over')) node.classList.remove('over');
      drawTides(canvas, frame);
    }
    source.onpointercancel = release;
    source.onpointerup = event => {
      if (pointer !== event.pointerId) return;
      const target = hit(event.clientX, event.clientY);
      if (target === null) { release(); return; }
      pointer = undefined;
      commit(target, true);
    };
  }
  if (!restored) ctx.save(state);
  render();
  say(lastAction(story, state)?.cue ?? story.opening);
}
