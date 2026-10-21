import assert from 'node:assert/strict';
import test from 'node:test';
import { advisorReply } from '../src/advisor.ts';
import type { AdvisorTopic } from '../src/advisor.ts';
import { choosePolicy, newGame, nextSeason, settleTurn } from '../src/campaign.ts';
import type { GameState } from '../src/campaign.ts';
import type { Policy } from '../src/economy.ts';

function settle(state: GameState): GameState {
  const outcome = settleTurn({ ...state, prediction: { price: 'down', purchases: 'up', reason: '供给发生变化。' } });
  if (!outcome.ok) assert.fail(outcome.message);
  return outcome.state;
}

function decision(policy: Partial<Policy> = {}): GameState {
  const state = nextSeason(settle(newGame()));
  return choosePolicy(state, { ...state.draft, ...policy });
}

const topics: AdvisorTopic[] = ['briefing', 'policy', 'why', 'reserves', 'lesson', 'access', 'farm', 'production', 'market', 'opportunity'];

test('a new player meets Lin Lan without an unearned result or unavailable chart action', () => {
  const state = newGame();
  assert.match(advisorReply(state, 'briefing').text, /我是林岚.*先观察/);
  for (const topic of topics) {
    const reply = advisorReply(state, topic);
    assert.equal(reply.action, undefined);
    assert.doesNotMatch(reply.text, /实际买到 40|价格.*5|100 篮/);
  }
});

test('decision dialogue explains conditional mechanisms without leaking this season or reusing last season results', () => {
  const state = decision({ cap: 5, subsidy: 1, release: 20 });
  assert.match(advisorReply(state, 'briefing').text, /第 2 季.*歉收/);
  const policy = advisorReply(state, 'policy');
  assert.match(policy.text, /售价上限设为 5.*补贴.*投放 20/);
  assert.match(policy.text, /若低于均衡价格.*配给.*未必能增产/);
  assert.equal(policy.action?.kind, 'policy');
  assert.match(advisorReply(state, 'why').text, /本季还没结算.*同样收成/);
  for (const topic of topics) {
    assert.doesNotMatch(advisorReply(state, topic).text, /买到 (24|25|40)|产量.*70|6\.875|66\.7%|保障率/);
  }
});

test('settled cap advice uses 24 versus 25 from the same season and explains rationing', () => {
  const state = settle(decision({ cap: 5 }));
  const reply = advisorReply(state, 'why');
  assert.match(reply.text, /同样的收成下.*无干预.*25 篮.*方案买到 24 篮/);
  assert.match(reply.text, /超过供给 40 篮.*按比例分粮/);
  assert.equal(reply.action?.kind, 'replay');
  assert.equal(reply.mood, 'concerned');
  assert.match(advisorReply(state, 'briefing').text, /24 篮.*25 篮/);
});

test('subsidy advice distinguishes a capacity constraint from additional production', () => {
  const constrained = settle(decision({ subsidy: 1 }));
  assert.match(advisorReply(constrained, 'why').text, /补贴前后私人产量均为 70 篮.*补贴没有增产/);
  const mixed = settle(decision({ cap: 5, subsidy: 1, release: 20 }));
  assert.match(advisorReply(mixed, 'why').text, /私人产量从 60 增至 70 篮/);
  assert.doesNotMatch(advisorReply(mixed, 'why').text, /补贴没有增产/);
});

test('resource advice uses current holdings and rejects unfunded or oversized plans', () => {
  const state = decision({ release: 20 });
  const last = state.records[0]!;
  const short: GameState = {
    ...state,
    records: [{ ...last, result: { ...last.result, after: { cash: 0, reserves: 10 } } }],
  };
  assert.match(advisorReply(short, 'reserves').text, /只有 10 篮.*20 篮.*粮仓不够/);
  assert.equal(advisorReply(short, 'policy').mood, 'concerned');
  const unfunded = choosePolicy(short, { cap: null, subsidy: 2, release: 0 });
  assert.match(advisorReply(unfunded, 'policy').text, /现金不足.*降低补贴/);
  const settled = settle(state);
  assert.match(advisorReply(settled, 'reserves').text, /国库有 262\.5.*粮仓有 40 篮.*结算后的资源/);
  const next = choosePolicy(nextSeason(settled), { cap: null, subsidy: 0, release: 10 });
  assert.match(advisorReply(next, 'reserves').text, /粮仓有 40 篮.*计划投放 10 篮.*以后不能再用/);
  assert.doesNotMatch(advisorReply(next, 'reserves').text, /粮仓有 60 篮/);
});

test('access dialogue explains outcomes directly and offers follow-up conversations without a quiz', () => {
  const state = decision({ cap: 5 });
  const pending = advisorReply(state, 'access');
  assert.match(pending.text, /希望买得更多.*不保证.*按比例分粮.*可能减少/);
  assert.deepEqual(pending.choices.map(choice => choice.topic), ['production', 'reserves', 'policy']);
  assert.doesNotMatch(pending.text, /实际买到 24|只要 5|超过供给 40/);
  const capped = advisorReply(settle(state), 'access');
  assert.equal(capped.mood, 'concerned');
  assert.match(capped.text, /每篮只要 5.*超过供给 40 篮.*实际买到 24 篮/);
  assert.deepEqual(capped.choices.map(choice => choice.topic), ['production', 'reserves', 'why']);
  const normal = advisorReply(settle(newGame()), 'access');
  assert.match(normal.text, /每篮 5.*买到 40 篮.*够基本口粮/);
  const noIntervention = advisorReply(settle(decision()), 'access');
  assert.match(noIntervention.text, /每篮 6.9.*买到 25 篮.*不代表每家都买得起/);
});

test('building conversations describe current conditions before settlement and actual production afterward', () => {
  const state = decision({ subsidy: 1 });
  assert.match(advisorReply(state, 'farm').text, /第 2 季.*原料供应上限是 70 篮.*额外单位成本是 2.*不是已经生产/);
  const pending = advisorReply(state, 'production');
  assert.match(pending.text, /草案.*每篮补贴 1.*不能突破本季原料上限.*是否能增产/);
  assert.doesNotMatch(pending.text, /实际记录|私人产量|利润/);
  const settled = settle(state);
  assert.match(advisorReply(settled, 'production').text, /实际记录.*私人产量 70.*补贴前后私人产量均为 70 篮.*没有增产/);
  const mixed = settle(decision({ cap: 5, subsidy: 1, release: 20 }));
  assert.match(advisorReply(mixed, 'production').text, /其余政策相同时.*私人产量从 60 增至 70 篮/);
  const next = nextSeason(settled);
  assert.match(advisorReply(next, 'farm').text, /第 3 季.*80 篮.*成本是 1\.5/);
  assert.doesNotMatch(advisorReply(next, 'production').text, /实际记录|私人产量 70/);
});

test('market conversations distinguish draft conditions, settled price, shortages, and basic needs', () => {
  const state = decision({ cap: 5 });
  assert.match(advisorReply(state, 'market').text, /草案.*上限设为 5.*低于本季均衡价格.*还要等结算/);
  assert.doesNotMatch(advisorReply(state, 'market').text, /实际成交价|超额需求是 40/);
  const capped = advisorReply(settle(state), 'market');
  assert.match(capped.text, /实际成交价是 5.*超额需求是 40 篮.*按两组的需求比例配给/);
  assert.equal(capped.action?.kind, 'market');
  assert.match(advisorReply(settle(decision()), 'market').text, /超额需求是 0 篮.*出清.*不代表.*买够基本口粮/);
});

test('reserve trade-off follow-ups stay on resources even when the draft includes a cap', () => {
  const state = decision({ cap: 5, release: 20 });
  const followup = advisorReply(state, 'reserves').choices.find(choice => choice.label.includes('开仓'));
  assert.equal(followup?.topic, 'opportunity');
  const reply = advisorReply(state, followup!.topic);
  assert.match(reply.text, /粮仓有 60 篮.*减少未来可用的储备.*计划投放 20 篮/);
  assert.match(reply.text, /按市场价格售粮.*不是免费赠送.*库存换现金.*不能当作净福利/);
  assert.doesNotMatch(reply.text, /这对应.*最高限价/);
  const after = advisorReply(settle(state), 'opportunity');
  assert.match(after.text, /粮仓有 40 篮/);
  assert.doesNotMatch(after.text, /草案计划投放/);
  const short = { ...state, records: [{ ...state.records[0]!, result: { ...state.records[0]!.result, after: { cash: 160, reserves: 10 } } }] };
  assert.equal(advisorReply(short, 'reserves').choices.find(choice => choice.label.includes('开仓'))?.topic, 'opportunity');
});

test('a finished campaign discusses achieved goals and offers replay', () => {
  let state = settle(newGame());
  for (let season = 1; season < 6; season++) {
    state = nextSeason(state);
    state = choosePolicy(state, { cap: null, subsidy: season === 3 ? 1 : 0, release: season <= 2 ? 20 : 0 });
    state = settle(state);
  }
  state = nextSeason(state);
  const reply = advisorReply(state, 'briefing');
  assert.match(reply.text, /六季结束.*有 6 季.*20 篮.*守住了任务目标/);
  assert.equal(reply.mood, 'pleased');
  assert.equal(reply.action?.kind, 'replay');
  assert.match(advisorReply(state, 'why').text, /同样的收成下/);
});

test('all dialogue topics preserve the campaign, bound choices, and guard replay availability', () => {
  const states = [newGame(), settle(newGame()), decision(), settle(decision({ cap: 5 }))];
  for (const state of states) {
    const before = structuredClone(state);
    for (const topic of topics) {
      const reply = advisorReply(state, topic);
      assert.ok(reply.choices.length > 0 && reply.choices.length <= 3);
      assert.ok(reply.choices.every(choice => topics.includes(choice.topic)));
      assert.equal(new Set(reply.choices.map(choice => choice.topic)).size, reply.choices.length);
      assert.doesNotMatch([reply.text, ...reply.choices.map(choice => choice.label)].join(' '), /考考|直觉|选一个答案|答对|答错|IAL|第一单元/);
      assert.doesNotMatch(reply.text, /<[^>]*>/);
      if (state.records.length < 2) assert.notEqual(reply.action?.kind, 'replay');
      assert.deepEqual(state, before);
    }
  }
});
