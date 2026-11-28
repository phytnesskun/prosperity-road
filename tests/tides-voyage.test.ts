import assert from 'node:assert/strict';
import test from 'node:test';
import { chapters } from '../src/chapters/shared.ts';
import { inheritVoyage, stories } from '../src/tides/library.ts';
import { beginVoyage, currentBeat, lastAction, playChoice, restoreVoyage } from '../src/tides/model.ts';

test('two independent return trips carry their own orders and people through every chapter', () => {
  const endings: string[] = [];
  const keepers: string[] = [];
  assert.equal(stories.length, 14);
  for (const side of ['first', 'last']) {
    const saves = new Map<string,unknown>();
    let prevFacts: Record<string,string> = {};
    for (let n = 7; n <= 20; n++) {
      const story = stories[n - 7];
      assert.equal(story.num, n);
      assert.equal(story.title, chapters[('ch' + n) as keyof typeof chapters][1]);
      const past = inheritVoyage(n, id => saves.get(id));
      assert.deepEqual(past, prevFacts);
      let state = beginVoyage(n, past);
      assert.strictEqual(playChoice(story, state, 'unknown'), state);
      for (const _step of story.steps) {
        const beat = currentBeat(story, state)!;
        assert.ok(beat.choices.length >= 2 && beat.choices.length <= 3);
        const option = side === 'first' ? beat.choices[0] : beat.choices.at(-1)!;
        state = playChoice(story, state, option.id);
        assert.deepEqual(lastAction(story, state), option);
        assert.deepEqual(restoreVoyage(story, JSON.parse(JSON.stringify(state))), state);
      }
      assert.equal(currentBeat(story, state), undefined);
      assert.equal(playChoice(story, state, 'extra'), state);
      saves.set('ch' + n, state);
      const ending = story.end(state);
      prevFacts = { ...past, ...ending.facts };
      if (n === 20) { endings.push(ending.title + ending.detail); keepers.push(past.homeKeeper); }
    }
  }
  assert.notEqual(endings[0], endings[1]);
  assert.notEqual(keepers[0], keepers[1]);
});

test('inheriting skips unfinished or corrupt voyages and rejects impossible choice replays', () => {
  const seventh = stories[0];
  let full = beginVoyage(7);
  for (const _step of seventh.steps) full = playChoice(seventh, full, currentBeat(seventh, full)!.choices[0].id);
  const read = (id: string) => id === 'ch7' ? full : id === 'ch8' ? beginVoyage(8, { order: 'stale' }) : { version: 1, num: 9, past: {}, picks: ['bad'] };
  assert.deepEqual(inheritVoyage(10, read), seventh.end(full).facts);
  assert.equal(restoreVoyage(seventh, { ...full, picks: ['not-an-action'] }), undefined);
  assert.equal(restoreVoyage(seventh, { ...full, past: [] }), undefined);
  assert.deepEqual(inheritVoyage(20, () => null), {});
});
