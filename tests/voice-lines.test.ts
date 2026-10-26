import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { choosePolicy, newGame, nextSeason, settleTurn } from '../src/campaign.ts';
import type { GameState } from '../src/campaign.ts';
import { INITIAL_RESOURCES, SEASONS, evaluate } from '../src/economy.ts';
import type { AdvisorTopic } from '../src/advisor.ts';
import type { TownPlace } from '../src/townspeople.ts';
import { VOICE_LINES, advisorVoiceLine, visitVoiceLine, voiceSource } from '../src/voice-lines.ts';

const topics: AdvisorTopic[] = ['briefing', 'policy', 'why', 'reserves', 'lesson', 'access', 'farm', 'production', 'market', 'opportunity'];
const places: TownPlace[] = ['farm', 'mill', 'market', 'homes'];
const settle = (state: GameState): GameState => {
  const outcome = settleTurn(state);
  if (!outcome.ok) assert.fail(outcome.message);
  return outcome.state;
};

test('new season voices discuss drafts without reusing the previous season result', () => {
  const state = choosePolicy(nextSeason(settle(newGame())), { cap: 5, subsidy: 1, release: 20 });
  const snapshot = structuredClone(state);
  assert.equal(visitVoiceLine(state, 'mill', false).id, 'mill-subsidy-pending');
  assert.equal(visitVoiceLine(state, 'market', false).id, 'market-cap-pending');
  assert.equal(visitVoiceLine(state, 'homes', false).id, 'homes-pending');
  assert.equal(visitVoiceLine(state, 'market', true).id, 'market-inspect-pending');
  assert.equal(visitVoiceLine(state, 'homes', true).id, 'homes-inspect-pending');
  assert.equal(advisorVoiceLine(state, 'why').id, 'advisor-pending');
  assert.equal(advisorVoiceLine(state, 'access').id, 'advisor-access-pending');
  assert.equal(advisorVoiceLine(state, 'market').id, 'advisor-market-cap-plan');
  assert.equal(advisorVoiceLine(state, 'policy').id, 'advisor-policy-all');
  assert.deepEqual(state, snapshot);
});

test('spoken shortage, capacity and affordability reflect the actual model outcome', () => {
  const draft = nextSeason(settle(newGame()));
  const capped = settle(choosePolicy(draft, { cap: 5, subsidy: 0, release: 0 }));
  assert.equal(visitVoiceLine(capped, 'market', false).id, 'market-shortage');
  assert.equal(visitVoiceLine(capped, 'homes', false).id, 'homes-low');
  assert.equal(advisorVoiceLine(capped, 'why').id, 'advisor-shortage');
  const free = settle(draft);
  assert.equal(visitVoiceLine(free, 'mill', false).id, 'mill-at-limit');
  assert.equal(visitVoiceLine(free, 'market', false).id, 'market-cleared');
  assert.equal(visitVoiceLine(free, 'homes', false).id, 'homes-low');
  assert.equal(advisorVoiceLine(free, 'access').id, 'advisor-access-low');
  const normal = settle(newGame());
  assert.equal(visitVoiceLine(normal, 'homes', false).id, 'homes-enough');
  assert.equal(advisorVoiceLine(normal, 'access').id, 'advisor-access-enough');
});

test('coverage target and a full basic ration remain separate in spoken dialogue', () => {
  const state = settle(newGame());
  const result = state.records[0]!.result;
  // This boundary explicitly checks two different game concepts, not rounded UI numbers.
  result.purchasesLow = 35;
  result.coverageLow = 35 / 36;
  assert.equal(advisorVoiceLine(state, 'briefing').id, 'advisor-result-met');
  assert.equal(visitVoiceLine(state, 'homes', false).id, 'homes-low');
  assert.equal(advisorVoiceLine(state, 'access').id, 'advisor-access-low');
});

test('every policy and season has bilingual voiced replies without changing game state', () => {
  for (const [seasonIndex, season] of SEASONS.entries()) {
    for (const cap of [null, 4, 5, 6] as const) for (const subsidy of [0, 1, 2] as const) for (const release of [0, 10, 20] as const) {
      const draft = { cap, subsidy, release };
      const evaluated = evaluate(season, draft, INITIAL_RESOURCES);
      const state: GameState = { ...newGame(), seasonIndex, phase: 'decision', draft };
      const states = [state];
      if (evaluated.valid) states.push({ ...state, phase: 'result', records: [{ result: evaluated.result, prediction: state.prediction }] });
      for (const current of states) {
        const before = structuredClone(current);
        const selected = [...topics.map(topic => advisorVoiceLine(current, topic)), ...places.flatMap(place => [visitVoiceLine(current, place, false), visitVoiceLine(current, place, true)])];
        for (const reply of selected) {
          assert.ok(reply && reply.zh.trim() && reply.en.trim());
          assert.equal(VOICE_LINES[reply.id], reply);
        }
        assert.deepEqual(current, before);
      }
    }
  }
});

test('both language libraries contain the exact authored clips and five distinct standard voices', () => {
  const root = new URL('../public/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('audio/characters/manifest.json', root), 'utf8'));
  assert.equal(Object.keys(manifest.clips).length, Object.keys(VOICE_LINES).length * 2);
  for (const language of ['zh', 'en'] as const) {
    assert.equal(new Set(Object.values(manifest.profiles[language]).map((profile: any) => profile.voice)).size, 5);
    for (const reply of Object.values(VOICE_LINES)) {
      const clip = manifest.clips[`${language}/${reply.id}`];
      assert.equal(clip.text, reply[language]);
      assert.equal(clip.character, reply.character);
      assert.equal(clip.voice, manifest.profiles[language][reply.character].voice);
      const data = readFileSync(new URL(voiceSource(reply, language).slice(1), root));
      assert.ok(data.length > 1000, reply.id);
      assert.equal(data.length, clip.bytes);
      assert.equal(createHash('sha256').update(data).digest('hex'), clip.sha256);
    }
  }
});
