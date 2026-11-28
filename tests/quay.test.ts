import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreQuay, quayEnding, quayStats, workQuay } from '../src/chapters/quay.ts';

const fresh = () => restoreQuay(null);
const play = (...actions: Array<'gate' | 'skim' | 'ferry'>) =>
  actions.reduce((save, action) => workQuay(save, action), fresh());

test('opening the settling channel is reversible and consumes no shift', () => {
  const first = fresh();
  const pond = workQuay(first, 'gate');
  assert.deepEqual(quayStats(pond), quayStats(first));
  assert.equal(pond.shifts.length, 0);
  assert.deepEqual(workQuay(pond, 'gate'), first);
  assert.equal(quayEnding(first), undefined);
});

test('running the mill clogs the ferry; settling and netting can protect a crossing', () => {
  assert.deepEqual(quayStats(play('ferry', 'ferry')), { lamps: 4, crossed: 3, pulp: 5 });
  const balanced = play('skim', 'ferry', 'gate', 'ferry');
  assert.deepEqual(quayStats(balanced), { lamps: 4, crossed: 4, pulp: 2 });
  assert.equal(quayEnding(balanced), 'balance');
  assert.equal(quayEnding(play('gate', 'ferry', 'ferry', 'ferry')), 'people');
  assert.equal(quayEnding(play('ferry', 'ferry', 'ferry')), 'paper');
  assert.equal(quayEnding(play('gate', 'skim', 'skim', 'skim')), 'quiet');
});

test('all three-shift paths round-trip through storage, conserve passengers, and close once', () => {
  function verify(state: ReturnType<typeof fresh>) {
    assert.deepEqual(restoreQuay(JSON.parse(JSON.stringify(state))), state);
    const { lamps, crossed, pulp } = quayStats(state);
    assert.ok(lamps >= 0 && lamps <= 6 && crossed >= 0 && crossed <= 6 && pulp >= 0 && pulp <= 7);
    if (state.shifts.length === 3) {
      assert.ok(quayEnding(state));
      assert.equal(workQuay(state, 'gate'), state);
      assert.equal(workQuay(state, 'ferry'), state);
      return;
    }
    for (const gate of [state, workQuay(state, 'gate')])
      for (const job of ['ferry', 'skim'] as const) verify(workQuay(gate, job));
  }
  verify(fresh());
  assert.deepEqual(restoreQuay({ version: 1, gate: 'pond', shifts: [{ job: 'sink' }] }), fresh());
  assert.deepEqual(restoreQuay({ ...fresh(), shifts: Array(4).fill({ job: 'ferry', gate: 'wheel' }) }), fresh());
});
