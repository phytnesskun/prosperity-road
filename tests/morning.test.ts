import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actMorning,
  morningEnding,
  morningReceipts,
  morningTotals,
  restoreMorning,
  waitingMorning,
} from '../src/chapters/morning-model.ts';
import type { MorningAction, MorningState } from '../src/chapters/morning-model.ts';

const start = () => restoreMorning(null);
const play = (...actions: MorningAction[]) => actions.reduce(actMorning, start());

test('passengers and cargo compete for the same three slots; removing one preserves boarding order', () => {
  const full = play('uncover', 'passenger', 'crate', 'passenger');
  assert.deepEqual(waitingMorning(full), { passenger: 1, crate: 2, eggs: 0 });
  assert.strictEqual(actMorning(full, 'crate'), full);
  const repacked = actMorning(full, 'unload-1');
  assert.deepEqual(repacked.cargo, ['passenger', 'passenger']);
  assert.deepEqual(waitingMorning(repacked), { passenger: 1, crate: 3, eggs: 0 });
  assert.deepEqual(morningTotals(repacked), { people: 0, crates: 0, eggs: 0, cash: 0 });
  assert.strictEqual(actMorning(repacked, 'unload-2'), repacked);
  assert.strictEqual(actMorning(repacked, 'eggs'), repacked);
});

test('a short first crossing buys time to sail again; long crossings pay more and end the working day', () => {
  const full = play('uncover', 'passenger', 'crate', 'passenger');
  const first = actMorning(full, 'near');
  assert.deepEqual(first.cargo, []);
  assert.equal(first.phase, 'boarding');
  assert.deepEqual(waitingMorning(first), { passenger: 1, crate: 2, eggs: 0 });
  assert.strictEqual(actMorning(first, 'near'), first);
  const second = (['crate', 'crate', 'passenger', 'east'] as MorningAction[]).reduce(actMorning, first);
  assert.equal(second.phase, 'posting');
  assert.deepEqual(morningTotals(second), { people: 3, crates: 3, eggs: 0, cash: 13 });
  assert.strictEqual(actMorning(second, 'east'), second);
  const direct = actMorning(full, 'east');
  assert.equal(direct.phase, 'posting');
  assert.deepEqual(morningTotals(direct), { people: 2, crates: 1, eggs: 0, cash: 7 });
});

test('the posted board and actual customers served change the next dock; a missed egg customer remains ashore', () => {
  const metBoth = play('uncover', 'passenger', 'crate', 'east');
  assert.deepEqual(waitingMorning(actMorning(metBoth, 'early')), { passenger: 2, crate: 1, eggs: 1 });
  assert.deepEqual(waitingMorning(actMorning(metBoth, 'flex')), { passenger: 1, crate: 3, eggs: 0 });
  const knewOnlyCrates = play('uncover', 'crate', 'east', 'early');
  assert.deepEqual(waitingMorning(knewOnlyCrates), { passenger: 1, crate: 1, eggs: 1 });
  const knewOnlyPeople = play('uncover', 'passenger', 'east', 'flex');
  assert.deepEqual(waitingMorning(knewOnlyPeople), { passenger: 1, crate: 2, eggs: 0 });

  const fixed = actMorning(metBoth, 'early');
  const withEggs = actMorning(actMorning(fixed, 'eggs'), 'east');
  const missedEggs = actMorning(actMorning(fixed, 'passenger'), 'east');
  const loose = (['flex', 'crate', 'crate', 'crate', 'east'] as MorningAction[]).reduce(actMorning, metBoth);
  assert.equal(waitingMorning(missedEggs).eggs, 1);
  assert.equal(morningTotals(withEggs).eggs, 1);
  assert.equal(morningTotals(missedEggs).eggs, 0);
  assert.equal(new Set([withEggs, missedEggs, loose].map(morningEnding)).size, 3);
  assert.equal(morningReceipts('east', ['crate', 'crate', 'crate']), 13);
  assert.equal(morningTotals(loose).cash, 18);
});

test('corrupt and impossible manifests restart safely', () => {
  const valid = play('uncover', 'crate', 'east', 'flex', 'crate', 'east');
  const dayOne = valid.trips[0];
  const bad = [
    null,
    {},
    { ...valid, day: 1 },
    { ...valid, phase: 'covered' },
    { ...valid, board: 'weekend' },
    { ...valid, cargo: ['crate'] },
    { ...valid, version: 2 },
    { ...valid, trips: [{ ...dayOne, cargo: ['eggs'] }, valid.trips[1]] },
    { ...valid, trips: [{ ...dayOne, cargo: ['crate', 'crate', 'crate', 'crate'] }, valid.trips[1]] },
    { ...valid, trips: [dayOne, { ...valid.trips[1], cargo: ['passenger'] }] },
    { ...valid, trips: [dayOne, { ...valid.trips[1], route: 'near' }] },
    { ...valid, trips: [dayOne, dayOne, valid.trips[1]] },
    { ...valid, trips: [null] },
  ];
  for (const raw of bad) assert.deepEqual(restoreMorning(raw), start());
});

test('all reachable load orders, sailings and endings restore exactly; final crossings settle only once', () => {
  const actions: MorningAction[] = [
    'uncover',
    'passenger',
    'crate',
    'eggs',
    'undo',
    'unload-0',
    'unload-1',
    'unload-2',
    'near',
    'east',
    'early',
    'flex',
  ];
  const states: MorningState[] = [start()];
  const seen = new Set<string>([JSON.stringify(states[0])]);
  const endings = new Set<string>();
  for (const s of states) {
    assert.deepEqual(restoreMorning(JSON.parse(JSON.stringify(s))), s);
    assert.ok(Object.values(waitingMorning(s)).every((n) => n >= 0));
    assert.ok(s.trips.length <= 3);
    if (s.phase === 'done') endings.add(morningEnding(s));
    for (const action of actions) {
      const next = actMorning(s, action);
      if (s.phase === 'done') assert.strictEqual(next, s);
      if (next === s) continue;
      const key = JSON.stringify(next);
      if (!seen.has(key)) {
        seen.add(key);
        states.push(next);
      }
    }
  }
  assert.equal(endings.size, 6);
});
