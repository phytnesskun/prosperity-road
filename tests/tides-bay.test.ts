import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { bayBoard } from '../src/tides/bay-board.ts';
import { bayChapters } from '../src/tides/bay.ts';
import type { Past, StoryChapter } from '../src/tides/types.ts';

function chapter(n: number): StoryChapter {
  const found = bayChapters.find((ch) => ch.num === n);
  assert.ok(found);
  return found;
}

// Follow only visible actions, the same order a player's persisted picks use.
function run(num: number, past: Past, ...actions: string[]) {
  const ch = chapter(num);
  const picks: string[] = [];
  assert.equal(actions.length, ch.steps.length);
  for (const id of actions) {
    const step = ch.steps[picks.length]({ past, picks });
    assert.ok(
      step.choices.some((c) => c.id === id),
      num + ': cannot select ' + id
    );
    picks.push(id);
  }
  return ch.end({ past, picks });
}

test('reed reservations, goods left on board and the purchased backhaul change the return manifest', () => {
  const held = run(13, { fair: 'bread' }, 'sample', 'aboard', 'reeds');
  assert.deepEqual(held.facts, { bayStock: 'aboard', bayReedRate: 'held', bayOrder: 'reeds' });
  const full = chapter(14).steps[1]({ past: held.facts, picks: ['bundle'] });
  assert.deepEqual(
    full.choices.map((c) => c.id),
    ['keep', 'swap']
  );
  // Buy one reed at 1 after the exchange, sell for 4, carry one package for 3.
  assert.match(run(14, held.facts, 'bundle', 'swap', 'sell').detail, /载回 1 捆芦、1 件包裹。.*净收 6 枚/);
  const open = run(13, { fair: 'night' }, 'cash', 'store', 'parcels');
  assert.match(run(14, open.facts, 'parcel', 'post', 'counter').detail, /载回 0 捆芦、2 件包裹。.*净收 6 枚/);
  assert.match(run(14, open.facts, 'bundle', 'extra', 'wick').detail, /载回 3 捆芦、0 件包裹。.*净收 2 枚/);
});

test('actual warehouse tenants set market supply; the key pays for same-day verification', () => {
  const cheap = run(15, {}, 'wide', 'rice', 'fog');
  const scarce = run(15, {}, 'share', 'reeds', 'bay');
  assert.match(run(16, cheap.facts, 'check', 'spot', 'public').detail, /共收 7 枚/);
  assert.match(run(16, scarce.facts, 'check', 'spot', 'public').detail, /共收 14 枚/);
  assert.match(run(16, cheap.facts, 'slip', 'bakery', 'private').detail, /共收 11 枚/);
  assert.ok(
    !chapter(16)
      .steps[0]({ past: scarce.facts, picks: [] })
      .choices.some((c) => c.id === 'slip')
  );
});

test('contracted berths cannot be resold and both investigations can explain the lost passenger service', () => {
  const full = run(17, {}, 'full', 'shuttle', 'crew');
  assert.match(full.detail, /实收 10 枚/);
  assert.match(run(17, {}, 'split', 'people', 'window').detail, /实收 11 枚/);
  assert.match(run(17, {}, 'open', 'timber', 'window').detail, /实收 6 枚/);
  assert.deepEqual(
    chapter(17)
      .steps[1]({ past: {}, picks: ['full'] })
      .choices.map((c) => c.id),
    ['shuttle', 'queue']
  );
  assert.equal(run(18, full.facts, 'log', 'stub', 'transfer').facts.ticketRule, 'transfer');
  assert.equal(run(18, {}, 'rail', 'bill', 'reserve').facts.ticketRule, 'reserve');
});

test('the home shift, ticket recipient, shop and choice to sail or ride are reflected in chapter twenty', () => {
  const shift = run(19, { partner: 'xiaoman' }, 'xiaoman', 'arrears', 'relay');
  const end = run(20, { ...shift.facts, morning: 'early-eggs' }, 'street', 'child', 'ride');
  assert.match(end.detail, /小满挂起船班牌/);
  assert.match(end.detail, /孩子/);
  assert.equal(end.facts.finalRole, 'ride');
  assert.match(chapter(20).steps[0]({ past: { morning: 'early-missed' }, picks: [] }).detail, /没上船的蛋担/);
  assert.match(chapter(20).steps[0]({ past: { morning: 'early-eggs' }, picks: [] }).detail, /送进早市/);
  assert.match(run(20, {}, 'landing', 'crew', 'sail').detail, /船长挂起船班牌/);
});

test('every offered branch of chapters 13 to 20 reaches a written ending and a bilingual response', () => {
  assert.deepEqual(
    bayChapters.map((ch) => ch.num),
    [13, 14, 15, 16, 17, 18, 19, 20]
  );
  for (const ch of bayChapters) {
    for (const past of [
      {},
      {
        bayStock: 'aboard',
        bayOrder: 'parcels',
        bayKey: 'bay',
        bayTenant: 'rice',
        winterDeal: 'full',
        homeKeeper: 'ayun',
      },
    ]) {
      function explore(picks: string[]) {
        const ctx = { past: past as Past, picks };
        if (picks.length === ch.steps.length) {
          const ending = ch.end(ctx);
          assert.ok(ending.title && ending.detail && Object.keys(ending.facts).length);
          return;
        }
        const step = ch.steps[picks.length](ctx);
        assert.ok(step.choices.length >= 2);
        assert.equal(new Set(step.choices.map((c) => c.id)).size, step.choices.length);
        for (const c of step.choices) {
          assert.ok(c.label && c.result && ch.lines[c.cue]?.length === 3);
          explore([...picks, c.id]);
        }
      }
      assert.ok(ch.lines[ch.opening]);
      explore([]);
    }
  }
});

test('cargo board follows stow, exchange and unloading, counting inherited stock', () => {
  const past = { bayStock: 'aboard', fair: 'bread' };
  const board = (...picks: string[]) =>
    Object.fromEntries(bayBoard(14, past, picks).map(({ name, value }) => [name, value]));
  assert.deepEqual(board(), { 在船舱位: '2 / 4', 空余舱位: '2 位', 当前舱货: '干饼 2 箱' });
  assert.equal(board('bundle')['空余舱位'], '0 位');
  assert.equal(board('bundle', 'swap')['当前舱货'], '干饼 2 箱 · 灯芯芦 1 捆 · 包裹 1 件');
  assert.deepEqual(board('bundle', 'swap', 'wick'), board());
  assert.deepEqual(bayBoard(13, past, []), []);
});

test('winter board distinguishes contracted slots, people waiting, transferred fares and actual cash', () => {
  const board = (...picks: string[]) =>
    Object.fromEntries(bayBoard(17, {}, picks).map(({ name, value }) => [name, value]));
  assert.equal(board()['每班保底'], '待议');
  assert.equal(board('full')['每班保底'], '12 枚');
  assert.deepEqual(board('full', 'shuttle'), {
    冬班契纸: '整船包运',
    每班保底: '12 枚',
    头班船单: '棉货 4 位 · 另船代渡 2 人',
    头班实收: '10 枚',
  });
  assert.equal(board('split', 'timber')['头班船单'], '棉货 2 位 · 木料 2 箱 · 岸上候船 2 人');
  assert.equal(board('split', 'timber')['头班实收'], '13 枚');
  assert.equal(board('open', 'people')['头班船单'], '街坊 2 人 · 空 2 位');
  assert.equal(board('open', 'people')['头班实收'], '4 枚');
});
