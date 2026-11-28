import assert from 'node:assert/strict';
import test from 'node:test';
import { actConvoy, delivery, restoreConvoy, shoalOpen, startConvoy } from '../src/chapters/convoy.ts';
import type { ConvoyState } from '../src/chapters/convoy.ts';

function atFork(cargo: 'flour' | 'oil'): ConvoyState {
  return actConvoy(actConvoy(startConvoy(), cargo), 'cast-off');
}

test('light freight can catch the rising tide and the early oven', () => {
  const at = atFork('flour');
  const docked = actConvoy(at, 'shoal');
  assert.deepEqual(delivery(docked), { grounded: false, bells: 2, count: 3, reward: 6, cost: 1, earned: 20 });
  const done = actConvoy(docked, 'unload');
  assert.equal(done.phase, 'done');
  assert.equal(actConvoy(done, 'unload'), done);
  assert.deepEqual(restoreConvoy(JSON.parse(JSON.stringify(done))), done);
});

test('draft, tide and route determine the cost of carrying oil', () => {
  const oil = atFork('oil');
  assert.equal(shoalOpen(oil), false);
  assert.deepEqual(delivery(actConvoy(oil, 'shoal')), {
    grounded: true,
    bells: 4,
    count: 3,
    reward: 0,
    cost: 5,
    earned: 10,
  });
  assert.equal(delivery(actConvoy(oil, 'outer'))?.earned, 17);
  const high = actConvoy(oil, 'wait');
  assert.equal(shoalOpen(high), true);
  assert.deepEqual(restoreConvoy(high), high);
  assert.equal(delivery(actConvoy(high, 'shoal'))?.earned, 19);
  assert.equal(delivery(actConvoy(actConvoy(atFork('flour'), 'wait'), 'shoal'))?.reward, 0);
});

test('illegal advances, repeat settlements and corrupt saves do not advance the voyage', () => {
  const start = startConvoy();
  assert.equal(actConvoy(start, 'cast-off'), start);
  assert.deepEqual(restoreConvoy({ ...start, phase: 'fork' }), start);
  assert.deepEqual(restoreConvoy({ ...start, route: 'shoal' }), start);
  const low = actConvoy(actConvoy(actConvoy(atFork('oil'), 'wait'), 'wait'), 'wait');
  assert.equal(actConvoy(low, 'wait'), low);
  assert.equal(actConvoy(low, 'flour'), low);
  assert.deepEqual(restoreConvoy({ ...low, waits: -1 }), start);
  assert.deepEqual(restoreConvoy({ ...low, route: 'shoal' }), start);
  assert.equal(delivery(actConvoy(low, 'outer'))?.count, 4);
});
