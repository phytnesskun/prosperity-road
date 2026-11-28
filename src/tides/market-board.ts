import type { Past } from './types.ts';

type BoardEntry = { name: string; value: string };

// West posts a new bid only when the red sail has finished unloading.
export function riceLedger(picks: readonly string[]) {
  const first = picks[0] === 'all' ? 2 : picks[0] === 'half' ? 1 : 0;
  const shared = picks[1] === 'share';
  const redWest = shared ? 1 : 2;
  const westStock = 1 + first + (picks[1] ? redWest : 0);
  return {
    first,
    shared,
    left: 2 - first,
    purse: 10 + first * 7 - (shared ? 1 : 0),
    west: picks[1] ? 9 - westStock : 7,
    east: shared ? 6 : 8,
    fare: shared ? 1 : 3,
  };
}

export function riceClosing(past: Past, picks: readonly string[]) {
  const l = riceLedger(picks);
  if (!picks[2]) return { cash: l.purse, stock: l.left };
  if (picks[2] === 'east') return { cash: l.purse - l.west + (l.left + 1) * l.east - l.fare, stock: 0 };
  if (picks[2] === 'west') return { cash: l.purse + l.left * l.west, stock: 0 };
  if (past.order === 'grain')
    return { cash: l.purse + 10 - (l.left ? 0 : l.west), stock: Math.max(0, l.left - 1) };
  if (past.order === 'freight') return { cash: l.purse + 5, stock: l.left };
  return { cash: l.purse + 2, stock: l.left };
}

export function dryGoods(picks: readonly string[]) {
  const onShelf = picks.slice(0, 2);
  return {
    grain: onShelf.filter((item) => item === 'grain').length,
    paper: onShelf.filter((item) => item === 'paper').length,
  };
}

export function lampWork(picks: readonly string[]) {
  const hood = picks[0] === 'hood';
  const low = picks[1] === 'low';
  return {
    hood,
    low,
    windproof: hood || low,
    bright: !low,
    nightRuns: hood && low ? 3 : hood || low ? 2 : 1,
  };
}

export function marketBoard(chapter: number, past: Past, picks: readonly string[]): BoardEntry[] {
  if (chapter === 8) {
    const { west, east } = riceLedger(picks);
    const { cash, stock } = riceClosing(past, picks);
    return [
      { name: '西岸米价', value: west + ' 枚/袋' },
      { name: '东岸米价', value: east + ' 枚/袋' },
      { name: '船上现米', value: stock + ' 袋' },
      { name: '周转钱', value: cash + ' 枚' },
    ];
  }
  if (chapter === 9) {
    const { grain, paper } = dryGoods(picks);
    return [
      { name: '高架空格', value: 2 - grain - paper + ' 格' },
      { name: '干仓米袋', value: grain + ' 袋' },
      { name: '干仓灯纸', value: paper + ' 捆' },
    ];
  }
  if (chapter === 10) {
    const l = lampWork(picks);
    return [
      { name: '灯罩', value: !picks[0] ? '待折纸' : l.hood ? '双层挡风檐' : '单层敞口' },
      { name: '灯芯', value: !picks[1] ? '待试火' : l.low ? '细短芯' : '敞亮宽芯' },
      { name: '一盏油', value: !picks[1] ? '待试航' : '可跑 ' + l.nightRuns + ' 班' },
    ];
  }
  return [];
}
