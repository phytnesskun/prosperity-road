import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { millLines } from '../src/chapters/mill.ts';
import { convoyLines } from '../src/chapters/convoy.ts';
import { quayLines } from '../src/chapters/quay.ts';

test('each spoken harbor line ships with both offline recordings', () => {
  for (const [chapter, lines] of Object.entries({ mill: millLines, convoy: convoyLines, quay: quayLines })) {
    for (const key of Object.keys(lines)) {
      for (const language of ['zh', 'en']) {
        const file = new URL(`../src/chapters/voices/${chapter}-${key}-${language}.mp3`, import.meta.url);
        assert.ok(readFileSync(file).length > 1000, file.pathname);
      }
    }
  }
});
