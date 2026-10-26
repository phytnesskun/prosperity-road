import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacterVoice } from '../src/character-voice.ts';
import type { VoiceLine } from '../src/voice-lines.ts';

const STORAGE_KEY = 'prosperity-road.voice.v1';
const first: VoiceLine = { id: 'advisor-welcome', character: 'advisor', zh: '我们一起看看。', en: 'Let us take a look together.' };
const second: VoiceLine = { id: 'farm-ready', character: 'farm', zh: '原料都备好了。', en: 'The grain is ready.' };

class FakeElement {
  textContent: string | null = '';
  disabled = false;
  hidden = false;
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  removeAttribute(name: string): void { this.attributes.delete(name); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
}

class FakeAudio extends EventTarget {
  id = '';
  preload = '';
  src = '';
  currentTime = 0;
  paused = true;
  ended = false;
  volume = 1;
  error: { message: string } | null = null;
  dataset: Record<string, string> = {};
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  override dispatchEvent(event: Event): boolean {
    if (event.type === 'ended') this.onended?.();
    if (event.type === 'error') this.onerror?.();
    return super.dispatchEvent(event);
  }
  plays: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  loadCount = 0;
  pause(): void { this.paused = true; }
  load(): void { this.loadCount += 1; this.currentTime = 0; }
  removeAttribute(name: string): void { if (name === 'src') this.src = ''; }
  play(): Promise<void> {
    this.paused = false;
    return new Promise((resolve, reject) => this.plays.push({ resolve, reject }));
  }
}

function environment(setting: string | null = null, denyStorage = false) {
  const audio: FakeAudio[] = [];
  const nodes = new Map<string, FakeElement>();
  for (const id of ['character-voice-panel', 'character-voice-status', 'character-voice-replay', 'character-voice-stop']) nodes.set(id, new FakeElement());
  nodes.get('character-voice-panel')!.dataset.line = first.id;
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    body: { append: (element: FakeAudio) => audio.push(element) },
    getElementById: (id: string) => nodes.get(id) ?? null,
    querySelector: () => null,
    querySelectorAll: () => [],
  });
  const window = new EventTarget();
  const storage = new Map<string, string>();
  if (setting !== null) storage.set(STORAGE_KEY, setting);
  const replacements = {
    Audio: FakeAudio,
    document,
    window,
    localStorage: {
      getItem: (key: string) => { if (denyStorage) throw new Error('Storage blocked'); return storage.get(key) ?? null; },
      setItem: (key: string, value: string) => { if (denyStorage) throw new Error('Storage blocked'); storage.set(key, value); },
    },
  };
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(replacements)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  return {
    audio, document, window, storage, nodes,
    restore: () => {
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

const tick = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); };

test('voice language defaults to Chinese, persists separately, and off never starts audio', async () => {
  const env = environment();
  try {
    const activity: boolean[] = [];
    const voice = createCharacterVoice(active => activity.push(active));
    assert.equal(voice.setting, 'zh');
    assert.equal(env.audio.length, 1);
    assert.equal(env.audio[0]!.preload, 'none');
    assert.equal(env.audio[0]!.plays.length, 0, 'Constructing the game must not start speech.');
    voice.setSetting('en');
    assert.equal(env.storage.get(STORAGE_KEY), 'en');
    voice.play(first);
    assert.match(env.audio[0]!.src, /\/en\/advisor-welcome\.mp3$/);
    voice.setSetting('off');
    const plays = env.audio[0]!.plays.length;
    voice.play(second);
    assert.equal(env.audio[0]!.plays.length, plays);
    assert.equal(env.audio[0]!.paused, true);
    assert.equal(activity.at(-1), false);
    assert.equal(env.storage.get(STORAGE_KEY), 'off');
    assert.deepEqual([...env.storage.keys()], [STORAGE_KEY], 'Voice preferences must not overwrite music or game settings.');
  } finally { env.restore(); }
});

test('a saved English choice is restored; blocked storage still permits changing voice for the visit', () => {
  let env = environment('en');
  try { assert.equal(createCharacterVoice(() => {}).setting, 'en'); }
  finally { env.restore(); }
  env = environment('unknown');
  try { assert.equal(createCharacterVoice(() => {}).setting, 'zh'); }
  finally { env.restore(); }
  env = environment(null, true);
  try {
    const voice = createCharacterVoice(() => {});
    voice.setSetting('en');
    assert.equal(voice.setting, 'en');
    voice.play(first);
    assert.match(env.audio[0]!.src, /\/en\//);
    voice.stop();
  } finally { env.restore(); }
});

test('rapid replacement ignores the old play rejection and stopping prevents late completion from reviving speech', async () => {
  const env = environment();
  try {
    const activity: boolean[] = [];
    const voice = createCharacterVoice(active => activity.push(active));
    voice.play(first);
    const audio = env.audio[0]!;
    const old = audio.plays[0]!;
    voice.play(second);
    assert.match(audio.src, /farm-ready\.mp3$/);
    old.reject(new Error('The first request was cancelled'));
    await tick();
    assert.equal(activity.at(-1), true, 'An old failure must not unduck or fail the replacement clip.');
    assert.equal(audio.paused, false);
    voice.stop();
    audio.plays[1]!.resolve();
    await tick();
    assert.equal(activity.at(-1), false);
    assert.equal(audio.paused, true);
    assert.equal(audio.src, '');
    assert.equal(env.audio.length, 1, 'Switching characters must not accumulate audio players.');
  } finally { env.restore(); }
});

test('playback rejection restores music and the same line can be retried successfully', async () => {
  const env = environment();
  try {
    const activity: boolean[] = [];
    const voice = createCharacterVoice(active => activity.push(active));
    voice.play(first);
    const audio = env.audio[0]!;
    audio.plays[0]!.reject(new DOMException('User activation needed', 'NotAllowedError'));
    await tick();
    assert.equal(activity.at(-1), false);
    assert.match(env.nodes.get('character-voice-status')!.textContent ?? '', /无法|点击|重试/);
    voice.play(first);
    audio.plays[1]!.resolve();
    await tick();
    assert.equal(activity.at(-1), true);
    audio.ended = true;
    audio.dispatchEvent(new Event('ended'));
    assert.equal(activity.at(-1), false, 'Music must return to its normal volume when the clip finishes.');
  } finally { env.restore(); }
});

test('hiding or leaving the page stops dialogue without speaking again on return', async () => {
  const env = environment();
  try {
    const activity: boolean[] = [];
    const voice = createCharacterVoice(active => activity.push(active));
    voice.play(first);
    const audio = env.audio[0]!;
    env.document.hidden = true;
    env.document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(audio.paused, true);
    assert.equal(activity.at(-1), false);
    env.document.hidden = false;
    env.document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(audio.plays.length, 1, 'Returning to the tab must not resurrect an interrupted dialogue.');
    voice.play(second);
    env.window.dispatchEvent(new Event('pagehide'));
    assert.equal(audio.paused, true);
    assert.equal(activity.at(-1), false);
  } finally { env.restore(); }
});

test('the selected-language spoken caption is escaped independently of the Chinese interface', () => {
  const env = environment('en');
  try {
    const voice = createCharacterVoice(() => {});
    const markup = voice.controlsMarkup({ ...first, en: 'Bread < flour & "water".' });
    assert.match(markup, /Bread &lt; flour &amp; (?:&quot;|&#34;)water/);
    assert.doesNotMatch(markup, /我们一起看看|Bread < flour/);
    assert.match(voice.menuMarkup(), /中文/);
    assert.match(voice.menuMarkup(), /English/);
  } finally { env.restore(); }
});

test('media errors restore music, and retired event handlers cannot terminate the next character', async () => {
  const env = environment();
  try {
    const activity: boolean[] = [];
    const voice = createCharacterVoice(active => activity.push(active));
    voice.play(first);
    const audio = env.audio[0]!;
    const oldEnd = audio.onended;
    const oldError = audio.onerror;
    voice.play(second);
    audio.plays[1]!.resolve();
    await tick();
    audio.ended = true;
    audio.error = { message: 'Old resource failed' };
    oldEnd?.();
    oldError?.();
    assert.equal(activity.at(-1), true, 'Retired media handlers must not stop a newer character.');
    audio.onerror?.();
    assert.equal(activity.at(-1), false, 'A current decode/network failure must restore music.');
    assert.equal(audio.paused, true);
    audio.error = null;
    audio.ended = false;
    voice.play(second);
    audio.plays[2]!.resolve();
    await tick();
    assert.equal(activity.at(-1), true);
    voice.stop();
  } finally { env.restore(); }
});
