import assert from 'node:assert/strict';
import test from 'node:test';
import { millEnding, newMill, restoreMill, workMill } from '../src/chapters/mill.ts';
import type { MillAction } from '../src/chapters/mill.ts';

function play(actions: MillAction[]) {
  let state = newMill();
  for (const action of actions) {
    const old = Object.freeze(state);
    state = workMill(old, action);
    assert.notEqual(state, old, action);
    assert.deepEqual(restoreMill(JSON.parse(JSON.stringify(state))), state);
  }
  return state;
}
const allGusts: MillAction[] = ['grind', 'sail', 'grind', 'sail', 'grind'];
const bags = (action: MillAction, count: number): MillAction[] => Array.from({ length: count }, () => action);

test('setting sails for each gust produces twelve portions; missing the noon reef costs a sack', () => {
  const full = play(allGusts);
  assert.equal(full.coarse, 12);
  assert.equal(full.grain, 0);
  const unattended = play(['grind', 'grind', 'grind']);
  assert.equal(unattended.coarse, 10);
  assert.equal(unattended.grain, 1);
  assert.equal(workMill(unattended, 'grind'), unattended);
  assert.equal(workMill(unattended, 'sail'), unattended);
});

test('flour can be milled, sifted and delivered before sunset; home and boat orders compete for the same grain', () => {
  const street = play([
    'grind',
    'street',
    'sail',
    'grind',
    'sail',
    'grind',
    ...bags('street', 5),
    ...bags('sift', 3),
    ...bags('ship', 3),
    'close',
  ]);
  assert.equal(street.line, 'streetEnd');
  assert.match(millEnding(street), /27 枚/);
  const ship = play([...allGusts, ...bags('sift', 4), ...bags('ship', 4), ...bags('street', 4), 'close']);
  assert.equal(ship.line, 'shipEnd');
  assert.match(millEnding(ship), /28 枚/);
  assert.equal(workMill(ship, 'close'), ship);
  assert.equal(workMill(ship, 'sail'), ship);
  const incomplete = play([...allGusts, 'street', 'close']);
  assert.equal(incomplete.line, 'sharedEnd');
});

test('empty or full deliveries and unavailable wind leave the restored game untouched', () => {
  const initial = newMill();
  for (const action of ['street', 'ship', 'close', 'sift'] as const)
    assert.equal(workMill(initial, action), initial);
  const full = play([...allGusts, ...bags('sift', 4)]);
  assert.equal(workMill(full, 'sift'), full);
  assert.equal(restoreMill({ ...full, coarse: 12 }), null);
  assert.equal(restoreMill({ ...full, day: 1 }), null);
  assert.equal(restoreMill({ ...full, line: 'constructor' }), null);
  assert.equal(restoreMill(null), null);
});
