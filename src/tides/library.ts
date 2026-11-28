import { marketChapters } from './market.ts';
import { bayChapters } from './bay.ts';
import { restoreMorning } from '../chapters/morning-model.ts';
import { restoreVoyage } from './model.ts';
import type { Past } from './types.ts';

export const stories = [...marketChapters, ...bayChapters];

export function inheritVoyage(num: number, read: (chapter: string) => unknown): Past {
  // A direct start can still pick up the nearest completed voyage.
  for (let prev = num - 1; prev >= 7; prev--) {
    const chapter = stories.find(candidate => candidate.num === prev)!;
    const saved = restoreVoyage(chapter, read('ch' + prev));
    if (saved?.picks.length === chapter.steps.length)
      return { ...saved.past, ...chapter.end(saved).facts };
  }
  const ferry = restoreMorning(read('morning'));
  if (ferry.phase !== 'done') return {};
  const cargo = ferry.trips.at(-1)!.cargo;
  if (ferry.board === 'early') return { morning: cargo.includes('eggs') ? 'early-eggs' : 'early-missed' };
  return { morning: cargo.includes('crate') ? 'flex-cargo' : 'flex-passenger' };
}
