export type RiverPolicyId = 'none' | 'tax20' | 'tax40' | 'cap20' | 'cap30' | 'cap40';

export const RIVER_SEASONS = [
  { title: '烟囱升起', brief: '纸厂开工，第一批纸卷运往码头。先让小镇运转一季，看看河流会付出什么代价。', a: 100, m: 20 },
  { title: '河岸请愿', brief: '河岸居民递来请愿书。订单没有变化，现在由你决定纸厂如何继续生产。', a: 100, m: 20 },
  { title: '枯水期', brief: '河水变浅，同样的排放会造成两倍损害。纸厂的订单与生产成本仍和上季一样。', a: 100, m: 40 },
  { title: '新订单抵达', brief: '水量恢复，外地商船带来更多订单。最后一季，兼顾交货与河流的机会到了。', a: 120, m: 20 },
] as const;

export const RIVER_POLICIES: readonly {
  id: RiverPolicyId; name: string; detail: string; tax: number; cap: number | null; fee: number;
}[] = [
  { id: 'none', name: '自由开工', detail: '不征污染税，也不设排放上限。', tax: 0, cap: null, fee: 0 },
  { id: 'tax20', name: '污染税 · 20', detail: '每单位排放征税 20，先支付 20 行政费。', tax: 20, cap: null, fee: 20 },
  { id: 'tax40', name: '污染税 · 40', detail: '每单位排放征税 40，先支付 20 行政费。', tax: 40, cap: null, fee: 20 },
  { id: 'cap20', name: '排放上限 · 20', detail: '全镇最多排放 20 单位，先支付 30 行政费。', tax: 0, cap: 20, fee: 30 },
  { id: 'cap30', name: '排放上限 · 30', detail: '全镇最多排放 30 单位，先支付 30 行政费。', tax: 0, cap: 30, fee: 30 },
  { id: 'cap40', name: '排放上限 · 40', detail: '全镇最多排放 40 单位，先支付 30 行政费。', tax: 0, cap: 40, fee: 30 },
];

export type RiverResult = {
  season: number;
  policy: RiverPolicyId;
  cashBefore: number;
  cashAfter: number;
  quantity: number;
  price: number;
  producerPrice: number;
  emissions: number;
  damage: number;
  taxRevenue: number;
  administration: number;
  consumerSurplus: number;
  producerSurplus: number;
  welfare: number;
  socialQuantity: number;
  allocationLoss: number;
};

export type RiverState = {
  version: 1;
  season: number;
  phase: 'decision' | 'result' | 'complete';
  policy: RiverPolicyId;
  records: RiverResult[];
};

export function newRiverGame(): RiverState {
  return { version: 1, season: 1, phase: 'decision', policy: 'none', records: [] };
}

export function settleRiver(season: number, policy: RiverPolicyId, cash: number): RiverResult {
  if (!Number.isInteger(season) || season < 1 || season > RIVER_SEASONS.length) {
    throw new Error('季度必须在 1 至 4 之间。');
  }
  const option = RIVER_POLICIES.find(p => p.id === policy);
  if (!option || (season === 1 && policy !== 'none')) throw new Error('本季不能执行这项政策。');
  if (!Number.isFinite(cash) || cash < 0) throw new Error('国库余额必须为非负有限数值。');
  if (cash < option.fee) throw new Error('国库不足，必须先支付行政费，不能预支本季税款。');
  const { a, m } = RIVER_SEASONS[season - 1];
  const quantity = Math.min((a - 20 - option.tax) / 2, option.cap ?? Infinity);
  const price = a - quantity;
  const producerPrice = price - option.tax;
  const consumerSurplus = quantity ** 2 / 2;
  const producerSurplus = producerPrice * quantity - (20 * quantity + quantity ** 2 / 2);
  const taxRevenue = option.tax * quantity;
  const damage = m * quantity;
  const socialQuantity = (a - 20 - m) / 2;
  return {
    season, policy, cashBefore: cash, cashAfter: cash + taxRevenue - option.fee,
    quantity, price, producerPrice, emissions: quantity, damage, taxRevenue,
    administration: option.fee, consumerSurplus, producerSurplus,
    welfare: consumerSurplus + producerSurplus + taxRevenue - damage - option.fee,
    socialQuantity, allocationLoss: (quantity - socialQuantity) ** 2,
  };
}

export function totalsRiver(state: RiverState) {
  return {
    supply: state.records.reduce((total, result) => total + result.quantity, 0),
    damage: state.records.reduce((total, result) => total + result.damage, 0),
    cash: state.records.at(-1)?.cashAfter ?? 100,
    welfare: state.records.reduce((total, result) => total + result.welfare, 0),
  };
}

export function chooseRiverPolicy(state: RiverState, id: RiverPolicyId): RiverState {
  const option = RIVER_POLICIES.find(p => p.id === id);
  if (state.phase !== 'decision' || !option || (state.season === 1 && id !== 'none') ||
      totalsRiver(state).cash < option.fee || state.policy === id) return state;
  return { ...state, policy: id };
}

export function executeRiver(state: RiverState): RiverState {
  if (state.phase !== 'decision' || state.records.length !== state.season - 1) return state;
  try {
    const result = settleRiver(state.season, state.policy, totalsRiver(state).cash);
    return { ...state, phase: 'result', records: [...state.records, result] };
  } catch {
    return state;
  }
}

export function nextRiver(state: RiverState): RiverState {
  if (state.phase !== 'result' || state.records.length !== state.season) return state;
  if (state.season === RIVER_SEASONS.length) return { ...state, phase: 'complete' };
  return { ...state, season: state.season + 1, phase: 'decision', policy: 'none' };
}

// Rebuild the campaign from its choices; saved balances and outcomes are never trusted.
export function restoreRiver(raw: string | null): RiverState {
  if (!raw) return newRiverGame();
  try {
    const saved = JSON.parse(raw) as RiverState;
    if (!saved || saved.version !== 1 || !Array.isArray(saved.records) || saved.records.length > 4) {
      return newRiverGame();
    }
    let state = newRiverGame();
    for (const [index, row] of saved.records.entries()) {
      if (!row || typeof row !== 'object') return newRiverGame();
      state = chooseRiverPolicy(state, row.policy);
      if (state.policy !== row.policy) return newRiverGame();
      state = executeRiver(state);
      const result = state.records[index];
      if (!result || (Object.keys(result) as (keyof RiverResult)[]).some(key => result[key] !== row[key])) {
        return newRiverGame();
      }
      if (index < saved.records.length - 1) state = nextRiver(state);
    }
    if (saved.records.length && saved.phase !== 'result') state = nextRiver(state);
    if (state.phase === 'decision') state = chooseRiverPolicy(state, saved.policy);
    if (state.season !== saved.season || state.phase !== saved.phase || state.policy !== saved.policy) {
      return newRiverGame();
    }
    return state;
  } catch {
    return newRiverGame();
  }
}
