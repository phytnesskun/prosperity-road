export type MorningLoad = 'passenger' | 'crate' | 'eggs';
export type MorningRoute = 'near' | 'east';
export type MorningBoard = 'early' | 'flex';
export type MorningAction =
  | 'uncover'
  | MorningLoad
  | 'undo'
  | 'unload-0'
  | 'unload-1'
  | 'unload-2'
  | MorningRoute
  | MorningBoard;
export type MorningTrip = { day: 1 | 2; route: MorningRoute; cargo: MorningLoad[] };
export type MorningState = {
  version: 1;
  phase: 'covered' | 'boarding' | 'posting' | 'done';
  day: 1 | 2;
  board: MorningBoard | null;
  cargo: MorningLoad[];
  trips: MorningTrip[];
};

export const MORNING_CAPACITY = 3;
const fares = { near: { passenger: 1, crate: 2, eggs: 0 }, east: { passenger: 2, crate: 5, eggs: 4 } };
const crossingCost = { near: 1, east: 2 };

function newMorning(): MorningState {
  return { version: 1, phase: 'covered', day: 1, board: null, cargo: [], trips: [] };
}

function isLoad(value: unknown): value is MorningLoad {
  return value === 'passenger' || value === 'crate' || value === 'eggs';
}

export function waitingMorning(s: MorningState): Record<MorningLoad, number> {
  const dayOneLoads = s.trips.filter((trip) => trip.day === 1).flatMap((trip) => trip.cargo);
  const knewPassengers = dayOneLoads.includes('passenger');
  const knewMerchant = dayOneLoads.includes('crate');
  let waiting: Record<MorningLoad, number>;
  if (s.day === 1) waiting = { passenger: 3, crate: 3, eggs: 0 };
  else if (s.board === 'early')
    waiting = { passenger: knewPassengers ? 2 : 1, crate: knewMerchant ? 1 : 0, eggs: 1 };
  else waiting = { passenger: knewPassengers ? 1 : 0, crate: knewMerchant ? 3 : 2, eggs: 0 };

  for (const trip of s.trips) {
    if (trip.day === s.day) for (const item of trip.cargo) waiting[item]--;
  }
  for (const item of s.cargo) waiting[item]--;
  return waiting;
}

export function morningReceipts(route: MorningRoute, cargo: MorningLoad[]) {
  return cargo.reduce((sum, item) => sum + fares[route][item], -crossingCost[route]);
}

export function morningTotals(s: MorningState) {
  const totals = { people: 0, crates: 0, eggs: 0, cash: 0 };
  for (const trip of s.trips) {
    for (const item of trip.cargo) {
      if (item === 'passenger') totals.people++;
      if (item === 'crate') totals.crates++;
      if (item === 'eggs') totals.eggs++;
    }
    totals.cash += morningReceipts(trip.route, trip.cargo);
  }
  return totals;
}

export function actMorning(s: MorningState, action: MorningAction): MorningState {
  if (s.phase === 'covered') return action === 'uncover' ? { ...s, phase: 'boarding' } : s;
  if (s.phase === 'posting') {
    if (action !== 'early' && action !== 'flex') return s;
    return { ...s, phase: 'boarding', day: 2, board: action };
  }
  if (s.phase !== 'boarding') return s;

  if (isLoad(action)) {
    if (s.cargo.length >= MORNING_CAPACITY || waitingMorning(s)[action] <= 0) return s;
    return { ...s, cargo: [...s.cargo, action] };
  }
  if (action === 'undo' || action === 'unload-0' || action === 'unload-1' || action === 'unload-2') {
    const index = action === 'undo' ? s.cargo.length - 1 : Number(action.slice(-1));
    if (index < 0 || index >= s.cargo.length) return s;
    return { ...s, cargo: s.cargo.filter((_, slot) => slot !== index) };
  }
  if (action !== 'near' && action !== 'east') return s;
  if (!s.cargo.length || (s.day === 2 && action === 'near')) return s;
  const trip = { day: s.day, route: action, cargo: [...s.cargo] };
  const returnsBeforeDusk = s.day === 1 && !s.trips.length && action === 'near';
  return {
    ...s,
    trips: [...s.trips, trip],
    cargo: [],
    phase: s.day === 2 ? 'done' : returnsBeforeDusk ? 'boarding' : 'posting',
  };
}

export function morningEnding(s: MorningState): string {
  if (s.phase !== 'done') return '';
  const last = s.trips.at(-1)!.cargo;
  if (last.includes('eggs')) return '两筐鸡蛋赶上早市';
  if (s.board === 'early') return '班船准点，蛋担留岸';
  if (last.every((item) => item === 'crate') && last.length >= 2) return '阿芸的午货赶上了船';
  if (last.includes('passenger') && last.includes('crate')) return '熟客和木箱同船';
  return last.includes('passenger') ? '老街坊的摆渡人' : '午潮的一箱货';
}

// Rebuild only journeys permitted by the trading rules. Wallets, queues and fares
// are derived from the manifest; a damaged save cannot create an extra sailing.
export function restoreMorning(raw: unknown): MorningState {
  const start = newMorning();
  if (!raw || typeof raw !== 'object') return start;
  const data = raw as Partial<MorningState>;
  if (
    data.version !== 1 ||
    !Array.isArray(data.trips) ||
    data.trips.length > 3 ||
    !Array.isArray(data.cargo) ||
    data.cargo.length > MORNING_CAPACITY
  )
    return start;

  let s = data.phase === 'covered' ? start : actMorning(start, 'uncover');
  function boardAtDusk() {
    if (s.phase === 'posting' && (data.board === 'early' || data.board === 'flex'))
      s = actMorning(s, data.board);
  }
  function load(items: unknown[]) {
    for (const item of items) {
      if (!isLoad(item)) return false;
      const next = actMorning(s, item);
      if (next === s) return false;
      s = next;
    }
    return true;
  }
  for (const trip of data.trips) {
    if (
      !trip ||
      (trip.route !== 'east' && trip.route !== 'near') ||
      !Array.isArray(trip.cargo) ||
      !trip.cargo.length ||
      trip.cargo.length > MORNING_CAPACITY
    )
      return start;
    boardAtDusk();
    if (trip.day !== s.day || !load(trip.cargo)) return start;
    const next = actMorning(s, trip.route);
    if (next === s) return start;
    s = next;
  }
  boardAtDusk();
  if (data.phase !== s.phase || data.day !== s.day || data.board !== s.board || !load(data.cargo))
    return start;
  return s;
}
