import assert from 'node:assert/strict';
import test from 'node:test';
import { choosePolicy, newGame, nextSeason, settleTurn } from '../src/campaign.ts';
import type { GameState } from '../src/campaign.ts';
import { PILOT_VERSION, emptyPilotFeedback, pilotFeedbackReport, restorePilotFeedback } from '../src/pilot.ts';

function settle(state: GameState): GameState {
  const result = settleTurn(state);
  if (!result.ok) assert.fail(result.message);
  return result.state;
}

test('feedback restoration rejects corrupt storage and invalid ratings', () => {
  for (const saved of [null, '', '{broken', 'null', '[]', 'true', '"value"', '{"ease":6}', '{"fun":"0"}', '{"ease":"5/5"}', '{"stuck":{}}']) {
    assert.deepEqual(restorePilotFeedback(saved), emptyPilotFeedback());
  }
  assert.notEqual(emptyPilotFeedback(), emptyPilotFeedback(), 'Each draft is independent.');
});

test('feedback restoration whitelists fields and bounds persisted text', () => {
  const restored = restorePilotFeedback(JSON.stringify({
    code: 'x'.repeat(60), ease: '1', fun: '5', stuck: '困'.repeat(1200),
    learned: '学'.repeat(1100), suggestion: '好'.repeat(1001), unknown: 'ignore',
    __proto__: { injected: true },
  }));
  assert.deepEqual(Object.keys(restored), ['code', 'ease', 'fun', 'stuck', 'learned', 'suggestion']);
  assert.equal(restored.code.length, 40);
  assert.equal(restored.stuck.length, 1000);
  assert.equal(restored.learned.length, 1000);
  assert.equal(restored.suggestion.length, 1000);
  assert.equal(restored.ease, '1');
  assert.equal(restored.fun, '5');
  assert.deepEqual(restorePilotFeedback('{"code":"P01"}'), { ...emptyPilotFeedback(), code: 'P01' });
});

test('an unfinished session exports progress without inventing results or final grades', () => {
  const state = newGame();
  state.draft = { cap: 4, subsidy: 2, release: 20 };
  const report = pilotFeedbackReport(state, emptyPilotFeedback());
  assert.match(report, new RegExp(`试玩版本：${PILOT_VERSION.replaceAll('.', '\\.')}`));
  assert.match(report, /阶段：开场观察；当前第 1\/6 季；已结算 0\/6 季/);
  assert.match(report, /基期固定政策（尚未执行）[\s\S]*最高限价：不设限价；单位补贴：0；储备投放：0 篮/);
  assert.match(report, /尚无已结算季度/);
  assert.match(report, /试玩尚未结束/);
  assert.doesNotMatch(report, /期末|最终成绩|\| 1 \|/);
});

test('the export contains actual settled policies and results without mutating inputs', () => {
  let state = nextSeason(settle(newGame()));
  state = choosePolicy(state, { cap: 5, subsidy: 0, release: 0 });
  state.prediction = { price: 'down', purchases: 'up', reason: '我认为便宜可以买更多。' };
  state = settle(state);
  state.report.evidence = '第2季实际购粮为24篮。';
  const feedback = { ...emptyPilotFeedback(), code: 'P01', ease: '2', fun: '4', learned: '低价也可能缺货。' };
  const before = structuredClone({ state, feedback });
  const report = pilotFeedbackReport(state, feedback);
  assert.match(report, /已结算 2\/6 季/);
  assert.match(report, /\| 1 \| 无 \| 0 \| 0 \| 5\.00 \| 40\.00 \|/);
  assert.match(report, /\| 2 \| 5 \| 0 \| 0 \| 5\.00 \| 24\.00 \|/);
  assert.doesNotMatch(report, /\| 3 \|/);
  assert.match(report, /操作是否清楚：2\/5/);
  assert.match(report, /是否愿意继续玩：4\/5/);
  assert.match(report, /第2季实际购粮为24篮/);
  assert.match(report, /价格：下降；低收入组实际购粮：上升/);
  assert.deepEqual({ state, feedback }, before);

  const decision = choosePolicy(nextSeason(state), { cap: null, subsidy: 1, release: 10 });
  const draftReport = pilotFeedbackReport(decision, feedback);
  assert.match(draftReport, /当前政策草案（尚未执行）[\s\S]*最高限价：不设限价；单位补贴：1；储备投放：10 篮/);
  assert.doesNotMatch(draftReport, /\| 3 \|/);
});

test('student Markdown, HTML and fence attempts stay literal in every export field', () => {
  const malicious = '```\n# 伪造结果\n<script>alert(1)</script>\n~~~~\n````\n[点我](javascript:alert(1))';
  const state = settle(newGame());
  state.prediction.reason = malicious;
  state.records[0].prediction.reason = malicious;
  state.report = { action: malicious, evidence: malicious, explanation: malicious, conditions: malicious };
  const feedback = { code: malicious, ease: malicious, fun: '0', stuck: malicious, learned: malicious, suggestion: malicious };
  const report = pilotFeedbackReport(state, feedback);
  assert.match(report, /操作是否清楚：未评分/);
  assert.match(report, /是否愿意继续玩：未评分/);
  let fence = '';
  let maliciousBlocks = 0;
  for (const line of report.split('\n')) {
    if (!fence && /^`{3,}text$/.test(line)) {
      fence = line.slice(0, -4);
    } else if (fence && line === fence) {
      fence = '';
    } else if (line === '# 伪造结果' || line.startsWith('<script>') || line.startsWith('[点我]')) {
      assert.ok(fence.length >= 5, 'Untrusted Markdown must remain within a longer code fence.');
      if (line === '# 伪造结果') maliciousBlocks++;
    }
  }
  assert.equal(fence, '');
  assert.equal(maliciousBlocks, 10);
});

test('complete sessions retain all six real results and identify the completed term', () => {
  let state = settle(newGame());
  for (let season = 1; season < 6; season++) {
    state = nextSeason(state);
    state.prediction = { price: 'same', purchases: 'same', reason: '观察市场自行调整。' };
    state = settle(state);
  }
  state = nextSeason(state);
  const report = pilotFeedbackReport(state, emptyPilotFeedback());
  assert.match(report, /阶段：任期已完成；当前第 6\/6 季；已结算 6\/6 季/);
  assert.match(report, /以下为完整任期记录/);
  assert.doesNotMatch(report, /试玩尚未结束/);
  assert.equal(report.split('\n').filter(line => /^\| [1-6] \|/.test(line)).length, 6);
});
