import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_POLICY,
  INITIAL_RESOURCES,
  SEASONS,
  demand,
  evaluate,
  privateSupply,
} from '../src/economy.ts';
import type { Policy, Resources, Result, Season } from '../src/economy.ts';

function near(actual: number, expected: number, label = 'value'): void {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${label}: expected ${expected}, received ${actual}`);
}

function simulate(
  seasonIndex: number,
  overrides: Partial<Policy> = {},
  resources: Resources = INITIAL_RESOURCES,
): Result {
  const evaluation = evaluate(SEASONS[seasonIndex]!, { ...DEFAULT_POLICY, ...overrides }, resources);
  if (!evaluation.valid) assert.fail(evaluation.message);
  return evaluation.result;
}

test('reproduces every independent numeric comparison in the scenario', () => {
  const comparisons: Array<{
    name: string;
    season: number;
    policy: Partial<Policy>;
    price: number;
    total: number;
    low: number;
    gap: number;
    cash: number;
  }> = [
    { name: 'baseline', season: 0, policy: {}, price: 5, total: 100, low: 40, gap: 0, cash: 160 },
    { name: 'harvest shock', season: 1, policy: {}, price: 6.875, total: 70, low: 25, gap: 0, cash: 160 },
    { name: 'cap 5', season: 1, policy: { cap: 5 }, price: 5, total: 60, low: 24, gap: 40, cash: 160 },
    { name: 'subsidy 1', season: 1, policy: { subsidy: 1 }, price: 6.875, total: 70, low: 25, gap: 0, cash: 90 },
    { name: 'release 20', season: 1, policy: { release: 20 }, price: 5.625, total: 90, low: 35, gap: 0, cash: 262.5 },
    { name: 'cap and release', season: 1, policy: { cap: 5, release: 20 }, price: 5, total: 80, low: 32, gap: 20, cash: 250 },
    { name: 'early recovery', season: 3, policy: {}, price: 50 / 9, total: 820 / 9, low: 320 / 9, gap: 0, cash: 160 },
    { name: 'recovery subsidy', season: 3, policy: { subsidy: 1 }, price: 5, total: 100, low: 40, gap: 0, cash: 60 },
  ];
  for (const row of comparisons) {
    const result = simulate(row.season, row.policy);
    near(result.price, row.price, `${row.name} price`);
    near(result.totalOutput, row.total, `${row.name} total`);
    near(result.purchasesLow, row.low, `${row.name} purchases`);
    near(result.excessDemand, row.gap, `${row.name} excess demand`);
    near(result.after.cash, row.cash, `${row.name} cash`);
  }

  const baseline = simulate(0);
  near(baseline.consumerSurplusLow, 100);
  near(baseline.consumerSurplusHigh, 225);
  near(baseline.producerSurplus, 250);
  near(baseline.producerProfit, 220);
  const release = simulate(0, { release: 20 });
  near(release.privateOutput, 800 / 9);
  near(release.totalOutput, 980 / 9);
  assert.ok(release.totalOutput - baseline.totalOutput < 20);
});

test('a cap is compared with the equilibrium for the same subsidy and release', () => {
  const result = simulate(1, { cap: 6, release: 20 });
  assert.equal(result.capBinding, false);
  near(result.price, 5.625);
  near(result.excessDemand, 0);
  const equality = simulate(0, { cap: 5 });
  assert.equal(equality.capBinding, false);
  near(equality.price, 5);
});

test('market clearing and the basic basket are separate outcomes', () => {
  const shock = simulate(1);
  near(shock.excessDemand, 0);
  near(shock.basicShortfall, 11);
  near(shock.coverageLow, 25 / 36);
  near(shock.coverageHigh, 1);
  const ceiling = simulate(1, { cap: 5 });
  assert.ok(ceiling.price < shock.price);
  assert.ok(ceiling.purchasesLow < shock.purchasesLow);
});

test('public sales may fund the same-season subsidy without double-counting stock cost', () => {
  const result = simulate(1, { subsidy: 1, release: 20 }, { cash: 0, reserves: 20 });
  near(result.publicSales, 112.5);
  near(result.deliveryCost, 10);
  near(result.subsidyCost, 70);
  near(result.after.cash, 32.5);
  near(result.after.reserves, 0);
});

test('rejects unaffordable or impossible policies without changing state', () => {
  const resources = Object.freeze({ cash: 0, reserves: 10 });
  const policy = Object.freeze({ cap: null, subsidy: 2, release: 0 } satisfies Policy);
  const budget = evaluate(SEASONS[1]!, policy, resources);
  assert.equal(budget.valid, false);
  if (!budget.valid) assert.equal(budget.reason, 'budget');
  const reserves = evaluate(SEASONS[1]!, { ...DEFAULT_POLICY, release: 20 }, resources);
  assert.equal(reserves.valid, false);
  if (!reserves.valid) assert.equal(reserves.reason, 'reserves');
  assert.deepEqual(resources, { cash: 0, reserves: 10 });
  assert.deepEqual(policy, { cap: null, subsidy: 2, release: 0 });
});

test('rejects invalid numeric inputs and unsupported policy settings', () => {
  const inputs: Array<[Season, Policy, Resources]> = [
    [{ ...SEASONS[0]!, K: NaN }, DEFAULT_POLICY, INITIAL_RESOURCES],
    [{ ...SEASONS[0]!, K: 111 }, DEFAULT_POLICY, INITIAL_RESOURCES],
    [{ ...SEASONS[0]!, K: -1 }, DEFAULT_POLICY, INITIAL_RESOURCES],
    [{ ...SEASONS[0]!, c: Infinity }, DEFAULT_POLICY, INITIAL_RESOURCES],
    [{ ...SEASONS[0]!, c: -1 }, DEFAULT_POLICY, INITIAL_RESOURCES],
    [{ ...SEASONS[0]!, id: 0 }, DEFAULT_POLICY, INITIAL_RESOURCES],
    [{ ...SEASONS[0]!, id: 1.5 }, DEFAULT_POLICY, INITIAL_RESOURCES],
    [SEASONS[0]!, { ...DEFAULT_POLICY, subsidy: 3 } as unknown as Policy, INITIAL_RESOURCES],
    [SEASONS[0]!, { ...DEFAULT_POLICY, release: 5 } as unknown as Policy, INITIAL_RESOURCES],
    [SEASONS[0]!, { ...DEFAULT_POLICY, cap: 0 } as unknown as Policy, INITIAL_RESOURCES],
    [SEASONS[0]!, DEFAULT_POLICY, { cash: NaN, reserves: 60 }],
    [SEASONS[0]!, DEFAULT_POLICY, { cash: Infinity, reserves: 60 }],
    [SEASONS[0]!, DEFAULT_POLICY, { cash: -1, reserves: 60 }],
    [SEASONS[0]!, DEFAULT_POLICY, { cash: 160, reserves: -1 }],
    [SEASONS[0]!, DEFAULT_POLICY, { cash: 160, reserves: Infinity }],
  ];
  for (const [season, policy, resources] of inputs) {
    const result = evaluate(season, policy, resources);
    assert.equal(result.valid, false);
    if (!result.valid) assert.equal(result.reason, 'input');
  }
  for (const input of [null, undefined]) {
    assert.equal(evaluate(input as unknown as Season, DEFAULT_POLICY, INITIAL_RESOURCES).valid, false);
    assert.equal(evaluate(SEASONS[0]!, input as unknown as Policy, INITIAL_RESOURCES).valid, false);
    assert.equal(evaluate(SEASONS[0]!, DEFAULT_POLICY, input as unknown as Resources).valid, false);
  }
});

test('returns detached snapshots and deterministic unrounded results', () => {
  const resources = { ...INITIAL_RESOURCES };
  const policy: Policy = { cap: null, subsidy: 0, release: 20 };
  const first = evaluate(SEASONS[2]!, policy, resources);
  assert.deepEqual(first, evaluate(SEASONS[2]!, policy, resources));
  assert.equal(first.valid, true);
  if (!first.valid) return;
  policy.release = 0;
  resources.cash = 0;
  assert.equal(first.result.policy.release, 20);
  assert.equal(first.result.before.cash, 160);
  first.result.before.cash = 5;
  assert.equal(resources.cash, 0);
  assert.notEqual(first.result.price, Number(first.result.price.toFixed(2)));
  assert.ok(Object.isFrozen(DEFAULT_POLICY));
  assert.ok(Object.isFrozen(INITIAL_RESOURCES));
});

test('chart functions use the same demand and capacity constraints as settlement', () => {
  const policy: Policy = { cap: 5, subsidy: 1, release: 20 };
  const result = simulate(1, policy);
  near(demand(result.price), result.demandLow + result.demandHigh);
  near(privateSupply(result.price, SEASONS[1]!, policy), result.privateOutput);
  near(privateSupply(12, SEASONS[1]!, policy), 70);
  near(privateSupply(0, SEASONS[1]!, DEFAULT_POLICY), 0);
  near(demand(11), 12);
  near(demand(12.5), 0);
});

test('all 2592 combinations preserve allocation, accounts and quantity bounds', () => {
  let checked = 0;
  let accepted = 0;
  const subsidies: Policy['subsidy'][] = [0, 1, 2];
  const releases: Policy['release'][] = [0, 10, 20];
  const caps: Policy['cap'][] = [null, 4, 5, 6];
  for (const season of SEASONS) {
    for (const subsidy of subsidies) {
      for (const release of releases) {
        for (const cap of caps) {
          for (const cash of [0, 40, 160, 400]) {
            for (const reserves of [0, 10, 60]) {
              checked += 1;
              const result = evaluate(season, { subsidy, release, cap }, { cash, reserves });
              if (!result.valid) continue;
              accepted += 1;
              const r = result.result;
              near(r.purchasesLow + r.purchasesHigh, r.totalOutput, 'allocation');
              near(r.after.cash, cash + r.publicSales - r.deliveryCost - r.subsidyCost, 'cash');
              near(r.after.reserves, reserves - release, 'stock');
              near(r.price * (r.purchasesLow + r.purchasesHigh), r.price * r.privateOutput + r.publicSales, 'payments');
              near(r.purchasesLow / r.demandLow, r.purchasesHigh / r.demandHigh, 'proportional rationing');
              near(r.producerProfit, (r.price + subsidy) * r.privateOutput - season.c * r.privateOutput - r.privateOutput ** 2 / 40 - 30, 'profit');
              near(r.producerSurplus, r.producerProfit + 30);
              if (!r.capBinding) near(r.demandLow + r.demandHigh, r.totalOutput);
              assert.ok(r.privateOutput >= 0 && r.privateOutput <= season.K + 1e-7);
              assert.ok(r.totalOutput <= 130 + 1e-7);
              assert.ok(r.after.reserves >= 0 && r.after.cash >= 0);
              assert.ok(r.purchasesLow <= r.demandLow + 1e-7);
              assert.ok(r.purchasesHigh <= r.demandHigh + 1e-7);
              assert.ok(r.consumerSurplusLow >= -1e-7 && r.consumerSurplusHigh >= -1e-7);
              assert.ok(r.coverageLow >= 0 && r.coverageLow <= 1);
              assert.ok(r.coverageHigh >= 0 && r.coverageHigh <= 1);
            }
          }
        }
      }
    }
  }
  assert.equal(checked, 2592);
  assert.equal(accepted, 1122);
});

test('reproduces all four six-season policy paths and the achievable campaign goal', () => {
  const paths: Array<{
    policies: Partial<Policy>[];
    targetSeasons: number;
    cash: number;
    reserves: number;
    gap: number;
  }> = [
    { policies: [{}, {}, {}, {}, {}, {}], targetSeasons: 4, cash: 160, reserves: 60, gap: 157 / 9 },
    { policies: [{}, { cap: 5 }, { cap: 5 }, { cap: 5 }, { cap: 5 }, {}], targetSeasons: 3, cash: 160, reserves: 60, gap: 24 },
    { policies: [{}, { release: 20 }, { release: 20 }, {}, {}, {}], targetSeasons: 6, cash: 6445 / 18, reserves: 20, gap: 13 / 9 },
    { policies: [{}, { release: 20 }, { release: 20 }, { subsidy: 1 }, {}, {}], targetSeasons: 6, cash: 4645 / 18, reserves: 20, gap: 1 },
  ];
  for (const path of paths) {
    let resources: Resources = { ...INITIAL_RESOURCES };
    const history: Result[] = [];
    for (let index = 0; index < SEASONS.length; index += 1) {
      const result = simulate(index, path.policies[index], resources);
      history.push(result);
      resources = result.after;
    }
    near(resources.cash, path.cash);
    near(resources.reserves, path.reserves);
    near(history.reduce((sum, row) => sum + row.basicShortfall, 0), path.gap);
    assert.equal(history.filter((row) => row.coverageLow >= 0.95).length, path.targetSeasons);
    assert.ok(history.every((row) => row.after.cash >= 0));
  }
});
