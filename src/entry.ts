if (new URLSearchParams(location.search).get('scenario') === 'river') {
  void import('./river.ts');
} else {
  void import('./main.ts');
}

export {};
