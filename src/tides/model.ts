import type { Choice, Past, StoryChapter } from './types.ts';

export type Voyage = {
  version: 1;
  num: number;
  past: Past;
  picks: string[];
};

export function beginVoyage(num: number, past: Past = {}): Voyage {
  return { version: 1, num, past: { ...past }, picks: [] };
}

export function currentBeat(story: StoryChapter, state: Voyage) {
  return story.steps[state.picks.length]?.(state);
}

export function playChoice(story: StoryChapter, state: Voyage, id: string) {
  const beat = currentBeat(story, state);
  if (!beat?.choices.some(choice => choice.id === id)) return state;
  return { ...state, picks: [...state.picks, id] };
}

export function lastAction(story: StoryChapter, state: Voyage): Choice | undefined {
  if (!state.picks.length) return;
  const before = { ...state, picks: state.picks.slice(0, -1) };
  return currentBeat(story, before)?.choices.find(choice => choice.id === state.picks.at(-1));
}

export function restoreVoyage(story: StoryChapter, raw: unknown): Voyage | undefined {
  if (!raw || typeof raw !== 'object') return;
  const s = raw as Partial<Voyage>;
  if (s.version !== 1 || s.num !== story.num || !Array.isArray(s.picks) ||
      s.picks.length > story.steps.length || !s.past || typeof s.past !== 'object' || Array.isArray(s.past)) return;
  if (!Object.entries(s.past).every(([k,v]) => /^[a-z][\w-]{0,40}$/i.test(k) && typeof v === 'string' && v.length <= 100)) return;
  let state = beginVoyage(story.num, s.past);
  for (const id of s.picks) {
    const next = playChoice(story, state, id);
    if (state === next) return;
    state = next;
  }
  return state;
}

export function samePast(a: Past, b: Past) {
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]);
}
