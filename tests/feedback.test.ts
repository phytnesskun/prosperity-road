import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_POLICY, INITIAL_RESOURCES, SEASONS, evaluate } from '../src/economy.ts';
import type { Policy, Resources, Result } from '../src/economy.ts';
import { outcomeFeedback } from '../src/feedback.ts';

function simulate(
  seasonIndex: number,
  overrides: Partial<Policy> = {},
  resources: Resources = INITIAL_RESOURCES,
): Result {
  const evaluation = evaluate(SEASONS[seasonIndex]!, { ...DEFAULT_POLICY, ...overrides }, resources);
  if (!evaluation.valid) assert.fail(evaluation.message);
  return evaluation.result;
}

test('a binding cap reports lower purchases despite the cheaper price', () => {
  const feedback = outcomeFeedback(simulate(1, { cap: 5 }));
  assert.equal(feedback.baseline.purchasesLow, 25);
  assert.match(feedback.headline, /未达标.*少买 1 篮/);
  assert.match(feedback.explanation, /无干预时低收入组买到 25 篮.*方案买到 24 篮/);
  assert.match(feedback.explanation, /超过供给 40 篮.*按比例分粮/);
  assert.match(feedback.lesson, /maximum price.*excess demand/);
});

test('public grain reaches the target and distinguishes sales from welfare', () => {
  const feedback = outcomeFeedback(simulate(1, { release: 20 }));
  assert.match(feedback.headline, /本季保障达标.*多买 10 篮/);
  assert.match(feedback.resident, /买到 35 篮.*97.2%.*达到 95%/);
  assert.match(feedback.explanation, /市场已出清/);
  assert.match(feedback.tradeoff, /现金 160 → 262.5/);
  assert.match(feedback.tradeoff, /储备 60 → 40 篮/);
  assert.match(feedback.tradeoff, /售粮收入 112.5 是库存换现金，不能直接当作净福利增加/);
});

test('capacity-constrained subsidy pays producers without claiming extra output', () => {
  const feedback = outcomeFeedback(simulate(1, { subsidy: 1 }));
  assert.match(feedback.headline, /未达标.*与无干预相同/);
  assert.match(feedback.explanation, /补贴前后私人产量均为 70 篮.*补贴没有增产/);
  assert.match(feedback.tradeoff, /补贴支出 70/);
  assert.match(feedback.lesson, /subsidy.*PES/);
});

test('recovery subsidy explains the actual output increase', () => {
  const feedback = outcomeFeedback(simulate(3, { subsidy: 1 }));
  assert.match(feedback.headline, /达标.*多买 4.4 篮/);
  assert.match(feedback.explanation, /私人产量从 91.1 增至 100 篮/);
  assert.doesNotMatch(feedback.explanation, /没有增产/);
});

test('a mixed policy isolates subsidy effects instead of inferring from the final capacity', () => {
  const result = simulate(1, { cap: 5, subsidy: 1, release: 20 });
  assert.equal(result.privateOutput, 70);
  const feedback = outcomeFeedback(result);
  assert.match(feedback.explanation, /其余政策相同时，补贴让私人产量从 60 增至 70 篮/);
  assert.doesNotMatch(feedback.explanation, /补贴没有增产/);
  assert.match(feedback.explanation, /按比例分粮/);

  const ineffective = outcomeFeedback(simulate(1, { subsidy: 1, release: 20 }));
  assert.match(ineffective.explanation, /补贴前后私人产量均为 70 篮/);
});

test('baseline feedback preserves resources and separates clearing from basic needs', () => {
  const original = simulate(0, {}, { cash: 42, reserves: 20 });
  const snapshot = structuredClone(original);
  const feedback = outcomeFeedback(original);
  assert.deepEqual(feedback.baseline.before, { cash: 42, reserves: 20 });
  assert.deepEqual(feedback.baseline.after, { cash: 42, reserves: 20 });
  assert.deepEqual(original, snapshot);
  assert.match(feedback.headline, /达标.*与无干预相同/);
  assert.match(feedback.explanation, /市场已出清.*出清不等于/);
  const shortage = outcomeFeedback(simulate(1));
  assert.match(shortage.headline, /未达标/);
  assert.match(shortage.explanation, /市场已出清/);
});
