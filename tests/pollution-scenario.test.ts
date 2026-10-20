import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Reference arithmetic for the manuscript only; this is not a second game engine.
const manuscript = readFileSync(
  new URL('../docs/scenarios/smokestacks-and-river.md', import.meta.url),
  'utf8',
);
const seasons = [
  { a: 100, m: 20 },
  { a: 100, m: 20 },
  { a: 100, m: 40 },
  { a: 120, m: 20 },
] as const;
const policies = {
  none: { tax: 0, cap: Infinity, administration: 0 },
  tax20: { tax: 20, cap: Infinity, administration: 20 },
  tax40: { tax: 40, cap: Infinity, administration: 20 },
  cap20: { tax: 0, cap: 20, administration: 30 },
  cap30: { tax: 0, cap: 30, administration: 30 },
  cap40: { tax: 0, cap: 40, administration: 30 },
} as const;
type Policy = keyof typeof policies;
const policyIds = Object.keys(policies) as Policy[];

function settle(season: number, policy: Policy, cash = 100) {
  assert.ok(season >= 1 && season <= 4 && Number.isInteger(season));
  assert.ok(policyIds.includes(policy));
  assert.ok(Number.isFinite(cash) && cash >= 0);
  assert.ok(season !== 1 || policy === 'none', 'baseline permits no intervention');
  const { a, m } = seasons[season - 1]!;
  const { tax, cap, administration: F } = policies[policy];
  assert.ok(cash >= F, 'administration must be funded before tax receipts');
  const Q = Math.min((a - 20 - tax) / 2, cap);
  const p = a - Q;
  const pn = p - tax;
  const PC = 20 * Q + Q ** 2 / 2;
  const TB = a * Q - Q ** 2 / 2;
  const CS = TB - p * Q;
  const PS = pn * Q - PC;
  const T = tax * Q;
  const ED = m * Q;
  const W = CS + PS + T - ED - F;
  const Qsocial = (a - 20 - m) / 2;
  const L = (Q - Qsocial) ** 2;
  const B = cash + T - F;
  return { Q, p, pn, CS, PS, T, ED, F, W, L, B, PC, TB, Qsocial };
}

function readTable(marker: string): string[][] {
  const start = `<!-- ${marker} -->`;
  const end = `<!-- /${marker} -->`;
  assert.ok(manuscript.includes(start) && manuscript.includes(end));
  return manuscript.split(start)[1]!.split(end)[0]!
    .trim().split('\n').slice(2)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

function expectNumbers(actual: number[], cells: string[], context: string) {
  const expected = cells.map(Number);
  assert.ok(expected.every(Number.isFinite), `${context}: valid numeric table cells`);
  assert.deepEqual(actual, expected, context);
}

function runPath(path: Policy[]) {
  assert.equal(path.length, 4);
  let cash = 100;
  const totals = { Q: 0, ED: 0, CS: 0, PS: 0, T: 0, F: 0, W: 0, B: 100 };
  const results = path.map((policy, index) => {
    const result = settle(index + 1, policy, cash);
    cash = result.B;
    for (const key of ['Q', 'ED', 'CS', 'PS', 'T', 'F', 'W'] as const) {
      totals[key] += result[key];
    }
    return result;
  });
  totals.B = cash;
  return { results, totals };
}

test('pollution baseline separates market equilibrium from social efficiency', () => {
  const result = settle(1, 'none');
  assert.deepEqual(
    [result.Q, result.p, result.Qsocial, result.ED, result.W, result.L, result.B],
    [40, 60, 30, 800, 800, 100, 100],
  );
});

test('all 18 published single-season rows reproduce the stated model', () => {
  const rows = readTable('single-round-cases');
  assert.equal(rows.length, 18);
  const seen = new Set<string>();
  for (const row of rows) {
    const season = Number(row[0]);
    const policy = row[1] as Policy;
    const result = settle(season, policy);
    expectNumbers(
      ['Q', 'p', 'pn', 'CS', 'PS', 'T', 'ED', 'F', 'W', 'L', 'B']
        .map((key) => result[key as keyof typeof result]),
      row.slice(2),
      `season ${season}, ${policy}`,
    );
    seen.add(`${season}:${policy}`);
  }
  for (const season of [2, 3, 4]) {
    for (const policy of policyIds) assert.ok(seen.has(`${season}:${policy}`));
  }
});

test('published paths carry cash forward and reproduce all cumulative totals', () => {
  const paths: Record<string, Policy[]> = {
    A: ['none', 'tax20', 'tax40', 'tax20'],
    B: ['none', 'cap30', 'cap20', 'cap40'],
    全程不干预: ['none', 'none', 'none', 'none'],
  };
  const rows = readTable('policy-paths');
  assert.equal(rows.length, 8);
  const seen = new Set<string>();
  for (const row of rows) {
    const [pathId, seasonText, policy] = row;
    const season = Number(seasonText);
    const path = paths[pathId!]!;
    assert.ok(path);
    assert.equal(path[season - 1], policy);
    const result = runPath(path).results[season - 1]!;
    expectNumbers(
      [result.Q, result.p, result.ED, result.W, result.B],
      row.slice(3),
      `path ${pathId}, season ${season}`,
    );
    seen.add(`${pathId}:${season}`);
  }
  for (const pathId of ['A', 'B']) {
    for (const season of [1, 2, 3, 4]) assert.ok(seen.has(`${pathId}:${season}`));
  }
  const totalRows = readTable('path-totals');
  assert.equal(totalRows.length, 3);
  for (const row of totalRows) {
    const totals = runPath(paths[row[0]!]!).totals;
    expectNumbers(
      [totals.Q, totals.ED, totals.CS, totals.PS, totals.T, totals.F, totals.W, totals.B],
      row.slice(1),
      `totals ${row[0]}`,
    );
  }
  for (const id of ['A', 'B']) {
    const { totals } = runPath(paths[id]!);
    assert.ok(totals.Q >= 130 && totals.ED <= 3000 && totals.B >= 0);
  }
  assert.ok(runPath(paths.全程不干预!).totals.ED > 3000);
});

test('all 216 allowed campaigns preserve money and welfare accounting', () => {
  let checked = 0;
  for (const second of policyIds) {
    for (const third of policyIds) {
      for (const fourth of policyIds) {
        const { results, totals } = runPath(['none', second, third, fourth]);
        for (const [index, result] of results.entries()) {
          const { a, m } = seasons[index]!;
          assert.ok(result.Q >= 0 && result.Q <= (a - 20) / 2);
          assert.ok(result.p >= 0 && result.pn >= 0 && result.B >= 0);
          assert.equal(result.p, a - result.Q);
          assert.equal(result.ED, m * result.Q);
          assert.equal(
            result.W,
            (a - 20 - m) * result.Q - result.Q ** 2 - result.F,
          );
          assert.equal(result.W, result.TB - result.PC - result.ED - result.F);
          assert.equal(result.W + result.F + result.L, result.Qsocial ** 2);
          assert.equal(result.p * result.Q, result.pn * result.Q + result.T);
        }
        assert.equal(totals.B, 100 + totals.T - totals.F);
        assert.equal(totals.W, totals.CS + totals.PS + totals.T - totals.ED - totals.F);
        checked += 1;
      }
    }
  }
  assert.equal(checked, 216);
});

test('matching taxes and caps have equal physical outcomes but different recipients', () => {
  for (const [season, tax, cap] of [
    [2, 'tax20', 'cap30'],
    [3, 'tax40', 'cap20'],
    [4, 'tax20', 'cap40'],
  ] as const) {
    const taxed = settle(season, tax);
    const limited = settle(season, cap);
    assert.equal(taxed.Q, taxed.Qsocial);
    assert.equal(taxed.Q, limited.Q);
    assert.equal(taxed.p, limited.p);
    assert.equal(taxed.CS, limited.CS);
    assert.equal(taxed.ED, limited.ED);
    assert.equal(limited.PS - taxed.PS, taxed.T);
    assert.equal(taxed.W - limited.W, limited.F - taxed.F);
    // Damage per unit remains the season's parameter under both policies.
    assert.equal(taxed.ED / taxed.Q, seasons[season - 1]!.m);
    assert.equal(limited.ED / limited.Q, seasons[season - 1]!.m);
  }
});

test('dry weather changes external harm without moving private market equilibrium', () => {
  const before = settle(2, 'none');
  const dry = settle(3, 'none');
  assert.equal(dry.Q, before.Q);
  assert.equal(dry.p, before.p);
  assert.equal(dry.ED, 2 * before.ED);
  assert.ok(dry.Qsocial < before.Qsocial);
  assert.equal(settle(3, 'tax40').ED, 800);
  assert.equal(settle(2, 'tax20').ED, 600);
});

test('overrestriction and a nonbinding cap can reduce welfare', () => {
  assert.ok(settle(2, 'tax40').ED < settle(2, 'none').ED);
  assert.ok(settle(2, 'tax40').W < settle(2, 'none').W);
  const none = settle(3, 'none');
  const looseCap = settle(3, 'cap40');
  assert.equal(looseCap.Q, none.Q);
  assert.equal(looseCap.ED, none.ED);
  assert.equal(looseCap.W, none.W - 30);
  assert.ok(settle(4, 'tax20').W > settle(4, 'tax40').W);
  assert.ok(settle(4, 'cap40').W > settle(4, 'cap20').W);
});

test('tax incidence example and the scarcity-rent explanation remain consistent', () => {
  const none = settle(2, 'none');
  const taxed = settle(2, 'tax20');
  assert.equal(taxed.p - none.p, 10);
  assert.equal(none.pn - taxed.pn, 10);
  const limited = settle(2, 'cap30');
  const scarcityRent = (limited.p - (20 + limited.Q)) * limited.Q;
  assert.equal(scarcityRent, 600);
  assert.equal(limited.PS, limited.Q ** 2 / 2 + scarcityRent);
});

test('baseline and upfront-budget constraints reject impossible actions', () => {
  assert.throws(() => settle(1, 'tax20'), /baseline/);
  assert.throws(() => settle(2, 'tax20', 19), /before tax receipts/);
  assert.throws(() => settle(2, 'cap30', 29), /before tax receipts/);
  assert.equal(settle(2, 'tax20', 20).B, 600);
  assert.equal(settle(2, 'cap30', 30).B, 0);
  assert.equal(settle(2, 'none', 0).B, 0);
});
