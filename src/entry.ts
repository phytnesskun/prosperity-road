const scenario = new URLSearchParams(location.search).get('scenario');
if (scenario === 'mill' || scenario === 'convoy' || scenario === 'quay' || scenario === 'morning') {
  void import('./chapters/game.ts').then(({ openChapter }) => openChapter(scenario));
} else if (scenario === 'rice') {
  void import('./rice/game.ts');
} else if (scenario === 'harbor') {
  void import('./harbor/game.ts');
} else if (scenario === 'river') {
  void import('./river.ts');
} else {
  void import('./main.ts');
}

export {};
