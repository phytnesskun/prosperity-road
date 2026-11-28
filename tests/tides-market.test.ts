import assert from 'node:assert/strict';
import test from 'node:test';
import { marketBoard } from '../src/tides/market-board.ts';
import { marketChapters } from '../src/tides/market.ts';
import type { Past, StoryChapter } from '../src/tides/types.ts';

const chapter = (num: number) => marketChapters.find((item) => item.num === num)!;
const board = (num: number, past: Past, picks: string[]) =>
  Object.fromEntries(marketBoard(num, past, picks).map((entry) => [entry.name, entry.value]));

function play(num: number, past: Past, picks: string[]) {
  const story = chapter(num);
  assert.equal(picks.length, story.steps.length);
  for (const [i, id] of picks.entries()) {
    const beat = story.steps[i]({ past, picks: picks.slice(0, i) });
    assert.ok(
      beat.choices.some((choice) => choice.id === id),
      'chapter ' + num + ', missing choice ' + id
    );
  }
  return story.end({ past, picks });
}

function allEndings(story: StoryChapter, past: Past, picks: string[] = []): number {
  if (picks.length === story.steps.length) {
    const end = story.end({ past, picks });
    assert.doesNotMatch(end.detail, /undefined|NaN/);
    assert.ok(Object.values(end.facts).every(Boolean));
    return 1;
  }
  const beat = story.steps[picks.length]({ past, picks });
  assert.ok(beat.item && beat.title && beat.detail && beat.itemLabel);
  assert.ok(beat.choices.length >= 2 && beat.choices.length <= 3);
  assert.equal(new Set(beat.choices.map((choice) => choice.id)).size, beat.choices.length);
  return beat.choices.reduce((count, choice) => {
    const [who, zh, en] = story.lines[choice.cue];
    assert.ok(who && zh && en);
    assert.ok(choice.result && choice.label && choice.prop);
    return count + allEndings(story, past, [...picks, choice.id]);
  }, 0);
}

test('every market chapter can start from the map and finish by any displayed route', () => {
  assert.deepEqual(
    marketChapters.map((story) => story.num),
    [7, 8, 9, 10, 11, 12]
  );
  for (const story of marketChapters) {
    assert.ok(story.lines[story.opening]);
    for (const past of [
      {},
      {
        morning: 'early-eggs',
        order: 'grain',
        sail: 'partner',
        store: 'paper',
        lamp: 'boat',
        partner: 'xiaoman',
        fairOrder: 'pledge',
      },
      { order: 'freight', store: 'grain', lamp: 'sold', partner: 'ayun', storeCart: 'return' },
    ] as Past[]) {
      assert.ok(allEndings(story, past) >= 8);
    }
  }
});

test('morning ferry passengers and deliveries change the bridge opening and egg income', () => {
  for (const [morning, expected] of [
    ['early-eggs', '寄卖'],
    ['early-missed', '走过来'],
    ['flex-cargo', '重货车'],
    ['flex-passenger', '街坊'],
  ]) {
    assert.ok(chapter(7).steps[0]({ past: { morning }, picks: [] }).detail.includes(expected));
  }
  const sell = ['bridge', 'retail', 'grain'];
  assert.match(play(7, { morning: 'early-eggs' }, sell).detail, /净收 7 枚/);
  assert.match(play(7, {}, sell).detail, /净收 5 枚/);
});

test('the visible rice board tracks sales, the red sail, freight and the final settlement', () => {
  assert.deepEqual(board(8, {}, []), {
    西岸米价: '7 枚/袋',
    东岸米价: '8 枚/袋',
    船上现米: '2 袋',
    周转钱: '10 枚',
  });
  assert.deepEqual(board(8, {}, ['all']), {
    西岸米价: '7 枚/袋',
    东岸米价: '8 枚/袋',
    船上现米: '0 袋',
    周转钱: '24 枚',
  });
  assert.equal(board(8, {}, ['half', 'west']).西岸米价, '5 枚/袋');
  assert.equal(board(8, {}, ['all', 'west']).西岸米价, '4 枚/袋');
  assert.deepEqual(board(8, {}, ['hold', 'share']), {
    西岸米价: '7 枚/袋',
    东岸米价: '6 枚/袋',
    船上现米: '2 袋',
    周转钱: '9 枚',
  });
  assert.ok(
    !chapter(8)
      .steps[2]({ past: {}, picks: ['all', 'west'] })
      .choices.some((choice) => choice.id === 'west')
  );
  const contract = { order: 'grain' };
  assert.equal(board(8, contract, ['all', 'west', 'order']).周转钱, '30 枚');
  assert.equal(board(8, contract, ['hold', 'share', 'order']).船上现米, '1 袋');
  assert.equal(board(8, {}, ['all', 'west', 'east']).周转钱, '25 枚');
  assert.match(play(8, {}, ['all', 'west', 'east']).detail, /25 枚，另有 0 袋/);
});

test('two dry bays fill in order, a cart voucher can pay for the last trip, and paper affects lamp cost', () => {
  assert.deepEqual(board(9, {}, []), { 高架空格: '2 格', 干仓米袋: '0 袋', 干仓灯纸: '0 捆' });
  assert.deepEqual(board(9, {}, ['paper']), { 高架空格: '1 格', 干仓米袋: '0 袋', 干仓灯纸: '1 捆' });
  assert.deepEqual(board(9, {}, ['paper', 'grain', 'return']), {
    高架空格: '0 格',
    干仓米袋: '1 袋',
    干仓灯纸: '1 捆',
  });
  const dry = play(9, {}, ['paper', 'grain', 'return']).facts;
  const empty = play(9, {}, ['grain', 'grain', 'sale']).facts;
  assert.match(play(10, dry, ['hood', 'low', 'boat']).detail, /旧料/);
  assert.match(play(10, empty, ['hood', 'low', 'boat']).detail, /花了 2 枚/);
  assert.equal(board(10, {}, ['hood', 'low']).一盏油, '可跑 3 班');
  assert.equal(board(10, {}, ['hood', 'wide']).一盏油, '可跑 2 班');
  assert.equal(board(10, {}, ['open', 'wide']).一盏油, '可跑 1 班');
  assert.match(play(11, dry, ['ayun', 'bulk', 'clear']).detail, /共进 9 枚/);
  assert.match(play(11, empty, ['ayun', 'bulk', 'clear']).detail, /共进 8 枚/);
});

test('two complete seasons pass distinct traders, partners, cash and bookings to the next bay', () => {
  function season(routes: string[][]) {
    let past: Past = { morning: 'early-eggs' };
    const receipts = [];
    for (const [index, route] of routes.entries()) {
      const end = play(index + 7, past, route);
      receipts.push(end.detail);
      past = { ...past, ...end.facts };
    }
    return { past, receipts };
  }
  const night = season([
    ['bridge', 'bulk', 'grain'],
    ['hold', 'share', 'order'],
    ['paper', 'grain', 'return'],
    ['hood', 'low', 'boat'],
    ['xiaoman', 'people', 'pledge'],
    ['night', 'reserve', 'tomorrow'],
  ]);
  const bread = season([
    ['dock', 'freight', 'freight'],
    ['all', 'west', 'east'],
    ['grain', 'grain', 'sale'],
    ['open', 'wide', 'sold'],
    ['ayun', 'bulk', 'clear'],
    ['bread', 'bulk', 'tonight'],
  ]);
  assert.match(night.receipts[1], /19 枚，另有 1 袋/);
  assert.match(bread.receipts[1], /25 枚，另有 0 袋/);
  assert.match(night.receipts[5], /14 枚/);
  assert.match(bread.receipts[5], /17 枚/);
  assert.deepEqual(night.past, {
    morning: 'early-eggs',
    order: 'grain',
    bridgeSite: 'bridge',
    sail: 'partner',
    store: 'both',
    storeCart: 'return',
    lamp: 'boat',
    lampGlass: 'wind',
    partner: 'xiaoman',
    fairOrder: 'pledge',
    fair: 'night',
    nextBooking: 'tomorrow',
  });
  assert.deepEqual(bread.past, {
    morning: 'early-eggs',
    order: 'freight',
    bridgeSite: 'dock',
    sail: 'rival',
    store: 'grain',
    storeCart: 'sale',
    lamp: 'sold',
    lampGlass: 'shelter',
    partner: 'ayun',
    fairOrder: 'clear',
    fair: 'bread',
    nextBooking: 'tonight',
  });
});
