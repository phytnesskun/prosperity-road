import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  RIVER_POLICIES, RIVER_SEASONS, chooseRiverPolicy, executeRiver, newRiverGame,
  nextRiver, restoreRiver, settleRiver, totalsRiver,
} from '../src/river-model.ts';
import type { RiverPolicyId, RiverResult, RiverState } from '../src/river-model.ts';

const manuscript = readFileSync(new URL('../docs/scenarios/smokestacks-and-river.md', import.meta.url), 'utf8');
const policyIds = RIVER_POLICIES.map(policy => policy.id);
function table(marker: string) {
  return manuscript.split(`<!-- ${marker} -->`)[1].split(`<!-- /${marker} -->`)[0]
    .trim().split('\n').slice(2)
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
}
function campaign(path: RiverPolicyId[]) {
  let state = newRiverGame();
  for (const policy of path) state = nextRiver(executeRiver(chooseRiverPolicy(state, policy)));
  return state;
}

test('river engine matches all 18 published single-season rows', () => {
  const rows = table('single-round-cases');
  assert.equal(rows.length, 18);
  const keys: (keyof RiverResult)[] = [
    'quantity', 'price', 'producerPrice', 'consumerSurplus', 'producerSurplus',
    'taxRevenue', 'damage', 'administration', 'welfare', 'allocationLoss', 'cashAfter',
  ];
  for (const row of rows) {
    const result = settleRiver(Number(row[0]), row[1] as RiverPolicyId, 100);
    assert.deepEqual(keys.map(key => result[key]), row.slice(2).map(Number), `${row[0]}:${row[1]}`);
  }
  const baseline = settleRiver(1, 'none', 100);
  assert.deepEqual(
    [baseline.quantity, baseline.price, baseline.socialQuantity, baseline.damage, baseline.welfare],
    [40, 60, 30, 800, 800],
  );
});

test('published complete paths carry cash forward and preserve the three town goals', () => {
  const paths: Record<string, RiverPolicyId[]> = {
    A: ['none', 'tax20', 'tax40', 'tax20'],
    B: ['none', 'cap30', 'cap20', 'cap40'],
    全程不干预: ['none', 'none', 'none', 'none'],
  };
  const states = Object.fromEntries(Object.entries(paths).map(([id, path]) => [id, campaign(path)]));
  for (const row of table('policy-paths')) {
    const result = states[row[0]].records[Number(row[1]) - 1];
    assert.equal(result.policy, row[2]);
    assert.deepEqual(
      [result.quantity, result.price, result.damage, result.welfare, result.cashAfter],
      row.slice(3).map(Number),
    );
  }
  for (const row of table('path-totals')) {
    const state = states[row[0]];
    const totals = totalsRiver(state);
    const sum = (key: 'consumerSurplus' | 'producerSurplus' | 'taxRevenue' | 'administration') =>
      state.records.reduce((total, result) => total + result[key], 0);
    assert.equal(state.phase, 'complete');
    assert.deepEqual(
      [totals.supply, totals.damage, sum('consumerSurplus'), sum('producerSurplus'),
        sum('taxRevenue'), sum('administration'), totals.welfare, totals.cash],
      row.slice(1).map(Number),
    );
  }
  for (const id of ['A', 'B']) {
    const totals = totalsRiver(states[id]);
    assert.ok(totals.supply >= 130 && totals.damage <= 3000 && totals.cash >= 0);
  }
  assert.ok(totalsRiver(states.全程不干预).damage > 3000);
});

test('all 216 allowed campaigns preserve accounting, reload, and complete in four seasons', () => {
  let count = 0;
  for (const second of policyIds) for (const third of policyIds) for (const fourth of policyIds) {
    const state = campaign(['none', second, third, fourth]);
    assert.equal(state.phase, 'complete');
    assert.equal(state.season, 4);
    assert.equal(state.records.length, 4);
    let cash = 100;
    for (const result of state.records) {
      const { a, m } = RIVER_SEASONS[result.season - 1];
      assert.ok(result.quantity >= 0 && result.quantity <= (a - 20) / 2);
      assert.equal(result.cashBefore, cash);
      assert.ok(result.cashBefore >= result.administration);
      assert.equal(result.cashAfter, cash + result.taxRevenue - result.administration);
      assert.ok(result.cashAfter >= 0);
      assert.equal(result.emissions, result.quantity);
      assert.equal(result.damage, m * result.emissions);
      assert.equal(result.price * result.quantity, result.producerPrice * result.quantity + result.taxRevenue);
      assert.equal(result.welfare, result.consumerSurplus + result.producerSurplus +
        result.taxRevenue - result.damage - result.administration);
      assert.equal(result.welfare + result.administration + result.allocationLoss, result.socialQuantity ** 2);
      cash = result.cashAfter;
    }
    assert.deepEqual(restoreRiver(JSON.stringify(state)), state);
    count += 1;
  }
  assert.equal(count, 216);
});

test('actions are immutable, baseline is fixed, and repeated settlement cannot collect tax twice', () => {
  const fresh = newRiverGame();
  Object.freeze(fresh.records);
  Object.freeze(fresh);
  assert.equal(chooseRiverPolicy(fresh, 'tax20'), fresh);
  assert.equal(nextRiver(fresh), fresh);
  assert.deepEqual(totalsRiver(fresh), { supply: 0, damage: 0, cash: 100, welfare: 0 });
  const first = executeRiver(fresh);
  assert.equal(first.phase, 'result');
  assert.equal(fresh.records.length, 0);
  assert.equal(executeRiver(first), first);
  assert.equal(chooseRiverPolicy(first, 'cap20'), first);
  const second = chooseRiverPolicy(nextRiver(first), 'tax20');
  const result = executeRiver(second);
  assert.equal(second.records.length, 1);
  assert.equal(result.records.length, 2);
  assert.equal(executeRiver(result), result);
  assert.equal(totalsRiver(result).cash, 680);
  assert.equal(nextRiver(result).policy, 'none', 'policy expires before the next season');
  const fourth = executeRiver(campaign(['none', 'tax20', 'tax40']));
  assert.equal(fourth.season, 4);
  assert.equal(fourth.phase, 'result', 'final feedback remains visible until next action');
  const complete = nextRiver(fourth);
  assert.equal(complete.phase, 'complete');
  assert.equal(nextRiver(complete), complete);
  assert.equal(executeRiver(complete), complete);
  assert.equal(chooseRiverPolicy(complete, 'tax20'), complete);
});

test('upfront administration cannot use future receipts and invalid inputs never settle', () => {
  assert.throws(() => settleRiver(1, 'tax20', 100), /不能执行/);
  assert.throws(() => settleRiver(2, 'tax20', 19.99), /不能预支/);
  assert.throws(() => settleRiver(2, 'cap30', 29.99), /不能预支/);
  assert.equal(settleRiver(2, 'tax20', 20).cashAfter, 600);
  assert.equal(settleRiver(2, 'cap30', 30).cashAfter, 0);
  assert.equal(settleRiver(2, 'none', 0).cashAfter, 0);
  assert.equal(settleRiver(2, 'tax20', 20.125).cashAfter, 600.125, 'engine does not round cash');
  for (const cash of [NaN, Infinity, -Infinity, -1]) assert.throws(() => settleRiver(2, 'none', cash));
  for (const season of [0, 5, 1.5, NaN]) assert.throws(() => settleRiver(season, 'none', 100));
  assert.throws(() => settleRiver(2, 'unknown' as RiverPolicyId, 100));
  const state = nextRiver(executeRiver(newRiverGame()));
  assert.equal(chooseRiverPolicy(state, 'unknown' as RiverPolicyId), state);
  const unfunded = { ...state, policy: 'tax20' as const, records: [{ ...state.records[0], cashAfter: 19 }] };
  assert.equal(executeRiver(unfunded), unfunded);
  assert.equal(chooseRiverPolicy({ ...unfunded, policy: 'none' }, 'tax20').policy, 'none');
});

test('save restoration preserves every normal decision and result checkpoint', () => {
  let state = newRiverGame();
  for (const policy of ['none', 'tax20', 'tax40', 'tax20'] as const) {
    state = chooseRiverPolicy(state, policy);
    assert.deepEqual(restoreRiver(JSON.stringify(state)), state);
    state = executeRiver(state);
    assert.deepEqual(restoreRiver(JSON.stringify(state)), state);
    state = nextRiver(state);
    assert.deepEqual(restoreRiver(JSON.stringify(state)), state);
  }
});

test('malformed saves, illegal transitions, and forged results all reset consistently', () => {
  const valid = campaign(['none', 'tax20']);
  const invalid: unknown[] = [
    null, false, 3, [], {}, { ...valid, version: 2 }, { ...valid, records: null },
    { ...valid, season: 2 }, { ...valid, season: 3.5 }, { ...valid, phase: 'complete' },
    { ...valid, policy: 'unknown' }, { ...valid, records: [null] },
    { ...valid, records: [...valid.records, ...valid.records, ...valid.records] },
    { ...valid, records: [{ ...valid.records[0], policy: 'tax20' }, valid.records[1]] },
    { ...valid, records: [valid.records[1], valid.records[0]] },
    { ...executeRiver(newRiverGame()), policy: 'tax20' },
  ];
  const result = valid.records[1];
  for (const key of Object.keys(result) as (keyof RiverResult)[]) {
    const forged: RiverState = structuredClone(valid);
    const value = result[key];
    Object.assign(forged.records[1], { [key]: typeof value === 'number' ? value + 1 : 'cap30' });
    invalid.push(forged);
  }
  for (const value of invalid) assert.deepEqual(restoreRiver(JSON.stringify(value)), newRiverGame());
  for (const raw of [null, '', 'not json', '{']) assert.deepEqual(restoreRiver(raw), newRiverGame());
});
