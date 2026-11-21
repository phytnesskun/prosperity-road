import assert from 'node:assert/strict';
import test from 'node:test';
import { act, actionsAt, morningComplete, objective, restoreHarbor, startHarbor } from '../src/harbor/model.ts';
import type { ActionId, HarborState, Place } from '../src/harbor/model.ts';

function use(state: HarborState, place: Place, id: ActionId): HarborState {
  assert.ok(actionsAt(state, place).some(action => action.id === id), id);
  const result = act(state, place, id);
  assert.ok(result.text && result.speaker && objective(result.state));
  assert.deepEqual(restoreHarbor(JSON.parse(JSON.stringify(result.state))), result.state);
  return result.state;
}

function firstSale(): HarborState {
  const before = startHarbor();
  assert.equal(act(before, 'street', 'sell').state, before);
  assert.equal(act(before, 'dock', 'bell').state, before);
  const queue = use(before, 'street', 'bell');
  assert.equal(act(queue, 'dock', 'sell').state, queue);
  const orders = use(queue, 'street', 'sell');
  assert.equal(orders.stock, 12);
  assert.equal(orders.coins, 1);
  assert.equal(act(orders, 'street', 'sell').state, orders);
  return orders;
}

test('a fulfilled order unlocks only its customer’s playable morning reward', () => {
  for (const ship of [true, false]) {
    const destination = ship ? 'dock' : 'oven';
    const delivery = ship ? 'deliverDock' : 'deliverWorkers';
    let state = firstSale();
    state = use(state, destination, delivery);
    assert.equal(act(state, 'street', 'close').state, state);
    state = use(state, destination, delivery);
    assert.equal(state.stock, 0);
    state = use(state, destination, 'close');
    assert.equal(state.phase, 'morning');
    assert.equal(morningComplete(state), false);
    assert.equal(act(state, ship ? 'oven' : 'dock', ship ? 'fire' : 'sail').state, state);
    state = use(state, destination, ship ? 'sail' : 'fire');
    assert.equal(morningComplete(state), true);
    assert.equal(ship ? state.flour : state.stock, ship ? 1 : 6);
    assert.equal(act(state, destination, ship ? 'sail' : 'fire').state, state);
  }
});

test('two half orders finance one extra batch; the next morning has two independent errands', () => {
  let state = firstSale();
  assert.equal(act(state, 'mill', 'buyFlour').state, state);
  state = use(state, 'dock', 'investigate');
  state = use(state, 'dock', 'deliverDock');
  state = use(state, 'oven', 'deliverWorkers');
  assert.equal(act(state, 'dock', 'close').state, state);
  state = use(state, 'mill', 'buyFlour');
  assert.equal(state.coins, 7);
  assert.equal(act(state, 'mill', 'buyFlour').state, state);
  state = use(state, 'oven', 'bake');
  assert.equal(state.stock, 12);
  assert.equal(act(state, 'oven', 'bake').state, state);
  state = use(state, 'oven', 'deliverWorkers');
  state = use(state, 'dock', 'deliverDock');
  state = use(state, 'street', 'close');
  state = use(state, 'oven', 'fire');
  assert.equal(morningComplete(state), false);
  assert.match(objective(state), /码头/);
  state = use(state, 'dock', 'sail');
  assert.equal(morningComplete(state), true);
  assert.equal(state.stock, 6);
  assert.equal(state.flour, 1);
});

test('invalid and impossible saves are rejected', () => {
  const evening = firstSale();
  for (const raw of [null, {}, [], 'orders', { ...evening, version: 2 },
    { ...evening, stock: NaN }, { ...evening, stock: 11 }, { ...evening, phase: 'morning' },
    { ...evening, rang: 1 }, { ...evening, baked: true, stock: 24 }, { ...evening, clue: 'no' },
    { ...evening, phase: 'morning', workers: 12, dock: 6, coins: 19, stock: 0, fired: true }]) {
    assert.equal(restoreHarbor(raw), null);
  }
});

test('every reachable stock and delivery state can reach a morning with all earned rewards used', () => {
  const start = startHarbor();
  const key = (s: HarborState) => JSON.stringify(s);
  const queue = [start];
  const seen = new Set([key(start)]);
  const predecessors = new Map<string, string[]>();
  const finishes: string[] = [];
  const places: Place[] = ['dock', 'oven', 'street', 'mill'];
  for (const state of queue) {
    const currentKey = key(state);
    assert.deepEqual(restoreHarbor(state), state);
    if (morningComplete(state)) finishes.push(currentKey);
    for (const place of places) {
      for (const action of actionsAt(state, place)) {
        const next = act(state, place, action.id).state;
        if (state === next) continue;
        const nextKey = key(next);
        const prev = predecessors.get(nextKey) ?? [];
        prev.push(currentKey);
        predecessors.set(nextKey, prev);
        if (!seen.has(nextKey)) {
          seen.add(nextKey);
          queue.push(next);
        }
      }
    }
  }
  const escapable = new Set(finishes);
  for (const nextKey of finishes) {
    for (const previous of predecessors.get(nextKey) ?? []) {
      if (!escapable.has(previous)) {
        escapable.add(previous);
        finishes.push(previous);
      }
    }
  }
  assert.ok(seen.size > 40);
  assert.equal(escapable.size, seen.size);
});
