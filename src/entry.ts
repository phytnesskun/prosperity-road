const scenario = new URLSearchParams(location.search).get('scenario');
if (scenario === 'harbor') {
  void import('./harbor/game.ts');
} else if (scenario === 'river') {
  void import('./river.ts');
} else {
  void import('./main.ts');
}

export {};
