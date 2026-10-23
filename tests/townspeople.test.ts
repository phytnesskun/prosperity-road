import assert from 'node:assert/strict';
import test from 'node:test';
import { choosePolicy, newGame, nextSeason, settleTurn } from '../src/campaign.ts';
import type { GameState } from '../src/campaign.ts';
import type { Policy } from '../src/economy.ts';
import { TOWNSPEOPLE, townReactions, visitStory } from '../src/townspeople.ts';
import type { TownPlace } from '../src/townspeople.ts';

const places: TownPlace[] = ['farm', 'mill', 'market', 'homes'];

function settle(state: GameState): GameState {
  const outcome = settleTurn(state);
  if (!outcome.ok) assert.fail(outcome.message);
  return outcome.state;
}

function decision(policy: Partial<Policy> = {}): GameState {
  const state = nextSeason(settle(newGame()));
  return choosePolicy(state, { ...state.draft, ...policy });
}

test('four distinct townspeople connect the farm-to-home walk', () => {
  assert.deepEqual(places.map(place => TOWNSPEOPLE[place].name), ['陈禾', '阿诚', '阿芸', '周婶']);
  assert.deepEqual(places.map(place => TOWNSPEOPLE[place].role), ['农民', '工人', '售货员', '居民']);
  assert.deepEqual(places.map(place => TOWNSPEOPLE[place].next), ['mill', 'market', 'homes', 'farm']);
  assert.equal(new Set(places.map(place => TOWNSPEOPLE[place].image)).size, 4);
});

test('pending visits show current inputs and plans without reusing the previous season outcome', () => {
  const state = decision({ cap: 5, subsidy: 1, release: 20 });
  assert.equal(visitStory(state, 'farm').metricValue, '70 篮');
  assert.match(visitStory(state, 'farm').inspectLine, /最大私人产量 70.*单位成本 2.*不是实际收成或产量/);
  assert.match(visitStory(state, 'mill').line, /补贴还在草案/);
  assert.match(visitStory(state, 'market').line, /草案.*5.*等执行/);
  for (const place of ['mill', 'homes'] as const) assert.equal(visitStory(state, place).metricValue, '待结算');
  for (const place of places) {
    const story = visitStory(state, place);
    assert.doesNotMatch(`${story.line} ${story.inspectLine}`, /实际.*100|买到 40|做了 100|超额需求 40/);
  }
  assert.deepEqual(townReactions(state), []);
  assert.deepEqual(townReactions(newGame()), []);
});

test('a binding cap changes the seller and resident from plans to actual shortages', () => {
  const state = settle(decision({ cap: 5 }));
  const seller = visitStory(state, 'market');
  assert.match(seller.line, /每篮 5.*供应多 40 篮.*分着卖/);
  assert.match(seller.inspectLine, /总供给 60 篮.*超额需求 40 篮/);
  assert.equal(seller.mood, 'worried');
  const resident = visitStory(state, 'homes');
  assert.match(resident.line, /低收入组.*24 篮.*36 篮/);
  assert.match(resident.inspectLine, /66\.7%.*整组数据/);
  assert.equal(resident.mood, 'worried');
  assert.deepEqual(townReactions(state).map(reaction => reaction.place), ['market', 'homes']);
});

test('subsidy at the raw-material ceiling does not claim additional output or worker wages', () => {
  const unchanged = visitStory(settle(decision()), 'mill');
  const subsidised = visitStory(settle(decision({ subsidy: 1 })), 'mill');
  assert.equal(subsidised.metricValue, '70 / 70 篮上限');
  assert.equal(subsidised.line, unchanged.line);
  assert.match(subsidised.line, /原料已经用到上限/);
  assert.match(subsidised.inspectLine, /生产补贴 1/);
  assert.doesNotMatch(`${subsidised.line} ${subsidised.inspectLine}`, /工资|就业|多做|增产/);
  assert.equal(subsidised.fill, 1);
});

test('groups stay explicit and a balanced market need not mean enough basic food', () => {
  const normal = settle(newGame());
  assert.match(visitStory(normal, 'homes').line, /低收入组.*40 篮.*基本口粮够/);
  assert.equal(visitStory(normal, 'homes').mood, 'relieved');
  const harvest = settle(decision());
  assert.equal(visitStory(harvest, 'market').mood, 'calm');
  assert.equal(visitStory(harvest, 'homes').mood, 'worried');
  assert.match(visitStory(harvest, 'homes').line, /低收入组.*25 篮/);
  assert.doesNotMatch(visitStory(harvest, 'homes').line, /我家|一家|每家|所有居民/);
});

test('partial recovery describes new input conditions without reusing the settled harvest shortage', () => {
  const state = nextSeason(settle(decision({ cap: 5 })));
  const farmer = visitStory(state, 'farm');
  assert.match(farmer.line, /比上季松了些.*80 篮/);
  assert.match(farmer.inspectLine, /80 篮.*1\.5/);
  assert.equal(farmer.status, '原料正在恢复');
  assert.equal(visitStory(state, 'mill').metricValue, '待结算');
  assert.equal(visitStory(state, 'market').status, '等待开市');
  assert.deepEqual(townReactions(state), []);
});

test('the final season remains available when a campaign is complete', () => {
  let state = settle(newGame());
  for (let season = 1; season < 6; season++) state = settle(nextSeason(state));
  state = nextSeason(state);
  assert.equal(state.phase, 'complete');
  assert.equal(visitStory(state, 'mill').metricValue, '100 / 110 篮上限');
  assert.match(visitStory(state, 'homes').line, /40 篮/);
  assert.equal(townReactions(state).length, 2);
});

test('visits are brief, visual values are bounded, and neither visits nor reactions mutate the game', () => {
  const states = [newGame(), settle(newGame()), decision({ cap: 5 }), settle(decision({ cap: 5 })), settle(decision({ subsidy: 1, release: 20 }))];
  for (const state of states) {
    const before = structuredClone(state);
    for (const place of places) {
      const story = visitStory(state, place);
      assert.ok(story.line.length <= 65, story.line);
      assert.ok(story.inspectLine.length <= 100, story.inspectLine);
      assert.ok(Number.isFinite(story.fill) && story.fill >= 0 && story.fill <= 1);
      assert.doesNotMatch(story.line, /预测|答题|选择答案|答对|答错|IAL|<[^>]*>/);
    }
    const reactions = townReactions(state);
    assert.ok(reactions.length <= 2);
    assert.equal(new Set(reactions.map(reaction => reaction.place)).size, reactions.length);
    assert.deepEqual(state, before);
  }
});
