import { isChapter } from '../chapters/shared.ts';
import type { Chapter } from '../chapters/shared.ts';

function selectedChapter(): Chapter {
  const hash = location.hash.slice(1);
  const initial = document.body.dataset.chapter;
  if (isChapter(hash)) return hash;
  return isChapter(initial) ? initial : 'harbor';
}

const initial = selectedChapter();
window.addEventListener('hashchange', () => {
  if (selectedChapter() !== initial) location.reload();
});
if (initial === 'rice') void import('../rice/game.ts');
else if (initial === 'harbor') void import('./game.ts');
else void import('../chapters/game.ts').then(({ openChapter }) => openChapter(initial));
