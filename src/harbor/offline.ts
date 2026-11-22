function selectedChapter(): 'rice' | 'harbor' {
  const hash = location.hash.slice(1);
  if (hash === 'rice' || hash === 'harbor') return hash;
  return document.body.dataset.chapter === 'rice' ? 'rice' : 'harbor';
}

const initial = selectedChapter();
window.addEventListener('hashchange', () => {
  if (selectedChapter() !== initial) location.reload();
});
if (initial === 'rice') void import('../rice/game.ts');
else void import('./game.ts');
