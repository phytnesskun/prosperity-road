import test from 'node:test';
import assert from 'node:assert/strict';
import { choosePolicy, currentResources, goals, newGame, nextSeason, restoreGame, settleTurn } from '../src/campaign.ts';
import type { GameState } from '../src/campaign.ts';

function settle(state: GameState): GameState {
  const outcome = settleTurn(state);
  if (!outcome.ok) assert.fail(outcome.message);
  return outcome.state;
}
function predict(state: GameState): GameState {
  return { ...state, prediction: { price: 'down', purchases: 'up', reason: '投放储备增加可售量。' } };
}
test('baseline is fixed; double settlement is rejected and a new season expires policies', () => {
  const baseline = settle({ ...newGame(), draft: { cap: 4, subsidy: 2, release: 20 } });
  assert.equal(baseline.records[0].result.price, 5);
  assert.equal(settleTurn(baseline).ok, false);
  assert.equal(baseline.records.length, 1);
  const decision = nextSeason(baseline);
  assert.deepEqual(decision.draft, { cap: null, subsidy: 0, release: 0 });
  assert.equal(settleTurn(decision).ok, false);
  assert.equal(settleTurn({ ...decision, prediction: { price: 'up', purchases: 'down', reason: '   ' } }).ok, false);
});
test('changing policy clears predictions; invalid policies preserve resources and history', () => {
  const decision = predict(nextSeason(settle(newGame())));
  assert.equal(choosePolicy(decision, { ...decision.draft }), decision, 'Reselecting the same policy preserves predictions.');
  const changed = choosePolicy(decision, { cap: null, subsidy: 0, release: 20 });
  assert.equal(changed.prediction.price, '');
  const poor = { ...decision, records: [{ ...decision.records[0], result: {
    ...decision.records[0].result, after: { cash: 0, reserves: 0 },
  } }], draft: { cap: null, subsidy: 2, release: 0 } } as GameState;
  const before = JSON.stringify(poor);
  assert.equal(settleTurn(poor).ok, false);
  assert.equal(JSON.stringify(poor), before);
});
test('six seasons, save reload, final goals, and reports survive a complete campaign', () => {
  let state = settle(newGame());
  const releases = [20, 20, 0, 0, 0] as const;
  for (let i = 0; i < releases.length; i++) {
    state = nextSeason(state);
    state = predict(choosePolicy(state, { cap: null, subsidy: i === 2 ? 1 : 0, release: releases[i] }));
    state = settle(state);
    const restored = restoreGame(JSON.stringify(state));
    assert.deepEqual(restored, state);
  }
  state = nextSeason(state);
  state.report.evidence = '第2季实际购粮35，保障率97.22%。';
  assert.equal(state.phase, 'complete');
  assert.equal(goals(state.records).passed, true);
  assert.equal(currentResources(state).reserves, 20);
  assert.deepEqual(restoreGame(JSON.stringify(state)), state);
});
test('saved numeric results are recomputed, malformed state is rejected', () => {
  const state = settle(newGame());
  const changed = structuredClone(state);
  changed.records[0].result.price = 999;
  assert.equal(restoreGame(JSON.stringify(changed))?.records[0].result.price, 5);
  assert.equal(restoreGame('not json'), null);
  assert.equal(restoreGame(JSON.stringify({ ...state, seasonIndex: 9 })), null);
  assert.equal(restoreGame(JSON.stringify({ ...state, phase: 'complete' })), null);
  assert.equal(restoreGame(JSON.stringify({ ...state, draft: { cap: 1, subsidy: 0, release: 0 } })), null);
});
