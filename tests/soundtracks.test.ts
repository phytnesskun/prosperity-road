import assert from 'node:assert/strict';
import test from 'node:test';
import { SOUNDTRACKS, findSoundtrack } from '../src/soundtracks.ts';

test('the catalogue contains sixteen distinct tracks, including both tavern pieces', () => {
  assert.equal(SOUNDTRACKS.length, 16);
  assert.equal(new Set(SOUNDTRACKS.map(track => track.id)).size, 16);
  assert.notEqual(findSoundtrack('tavern_1.ogg')?.id, findSoundtrack('tavern_2.ogg')?.id);
  assert.equal(findSoundtrack('tavern_1.ogg')?.title, 'Tavern 1');
  assert.equal(findSoundtrack('tavern_2.ogg')?.title, 'Tavern 2');
});

test('provided titles and snake case audio filenames match the exact catalogue entry', () => {
  for (const track of SOUNDTRACKS) {
    assert.equal(findSoundtrack(track.title), track);
    assert.equal(findSoundtrack(`${track.title.replaceAll(' ', '_')}.ogg`), track);
  }
  assert.equal(findSoundtrack('TOWN_RHODOK.MP3')?.title, 'Town Rhodok');
  assert.equal(findSoundtrack('lords_hall_swadian.flac')?.title, "Lord's Hall Swadian");
  assert.equal(findSoundtrack('Commerce-in-the-Peninsula.m4a')?.title, 'Commerce in the Peninsula');
});

test('accented titles accept composed and decomposed accents without changing the match', () => {
  for (const filename of ['Éire.wav', 'E\u0301ire.opus', 'Eire.aac', 'éire.oga']) {
    assert.equal(findSoundtrack(filename)?.id, 'eu4-eire');
  }
});

test('unknown tracks, track number prefixes, and alternate versions are not guessed', () => {
  for (const filename of ['', 'town.ogg', '01 Town Rhodok.mp3', 'Town Rhodok remix.mp3', 'Town Rhodok.mp3.exe', 'Tavern 12.ogg', 'Lord Hall Swadian.mp3']) {
    assert.equal(findSoundtrack(filename), undefined, filename);
  }
});
