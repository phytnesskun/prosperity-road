export type Bank = 'west' | 'east';
export type Stamp = 0 | 1 | 2;
type ByBank = Record<Bank, number>;

export interface RiceState {
  version: 1;
  month: 1 | 2;
  bank: Bank;
  cash: number;
  warehouses: ByBank;
  monthStart: ByBank;
  prices: ByBank;
  demand: ByBank;
  /** Tickets of origin travel with the sacks. Each shop buys rice from the other bank. */
  cargo: ByBank;
  speech: number;
  freePass: boolean;
  paidFares: number;
  talkBonus: number;
  ended: boolean;
  stallName: string | null;
}

export type RiceAction = { type: 'buy'; qty: number }
  | { type: 'sell'; qty: number; stamps?: readonly Stamp[] }
  | { type: 'sail' | 'close' }
  | { type: 'rent'; name: string };

export const RICE_CAPACITY = 4;
export const STALL_RENT = 8;
const startingCash = 28;
const regularFare = 2;
const normalStock = 4;
const monthlyOrder = 4;
const ordinaryPrice = 6;
const ports = { west: '西岸', east: '东岸' };
const both = (n: number): ByBank => ({ west: n, east: n });
const opposite = (b: Bank): Bank => b === 'west' ? 'east' : 'west';
const total = (p: ByBank) => p.west + p.east;
const natural = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

export function startRice(freePass = false): RiceState {
  return { version: 1, month: 1, bank: 'west', cash: startingCash,
    warehouses: both(normalStock), monthStart: both(normalStock), prices: both(ordinaryPrice),
    demand: both(monthlyOrder), cargo: both(0), freePass, speech: 0, paidFares: 0, talkBonus: 0,
    ended: false, stallName: null };
}

// Month-opening quotes are fixed for the market session. Index equals sacks at that port.
const stockPrices = [9, 8, 8, 7, 6, 5, 5, 4, 4];
const pricesFor = (stock: ByBank): ByBank => ({ west: stockPrices[stock.west], east: stockPrices[stock.east] });
export const cargoTotal = (s: RiceState): number => total(s.cargo);
export const canHold = (s: RiceState): boolean => s.speech >= 1;
export const fare = (s: RiceState): number => s.freePass || s.cash < regularFare ? 0 : regularFare;
export const canRent = (s: RiceState): boolean =>
  !s.ended && s.month === 2 && cargoTotal(s) === 0 && s.cash >= startingCash + STALL_RENT;

export function maxBuy(s: RiceState): number {
  return s.ended ? 0 : Math.min(s.warehouses[s.bank], RICE_CAPACITY - cargoTotal(s), Math.floor(s.cash / s.prices[s.bank]));
}
export function maxSell(s: RiceState): number {
  return s.ended ? 0 : Math.min(s.cargo[opposite(s.bank)], s.demand[s.bank]);
}

function goodName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0
    && Array.from(value).length <= 12 && !/[<>&"\x00-\x1f\x7f]/u.test(value);
}

export function trade(s: RiceState, a: RiceAction): {state: RiceState; ok: boolean; text: string} {
  const refuse = (text: string) => ({state: s, ok: false, text});
  const finish = (next: Partial<RiceState>, text: string) => ({state: { ...s, ...next }, ok: true, text});
  if (s.ended) return refuse('这趟生意已经收账。');
  const bank = s.bank;
  const other = opposite(bank);
  const price = s.prices[bank];
  switch (a.type) {
    case 'buy': {
      if (!natural(a.qty) || a.qty < 1 || a.qty > maxBuy(s)) return refuse('请按货架、船舱和钱袋里实际容得下的袋数装货。');
      const amount = price * a.qty;
      return finish({cash: s.cash - amount,
        warehouses: {...s.warehouses, [bank]: s.warehouses[bank] - a.qty},
        cargo: {...s.cargo, [bank]: s.cargo[bank] + a.qty}},
        `装船 ${a.qty} 袋，每袋 ${price} 枚，共付 ${amount} 枚。`);
    }
    case 'sell': {
      if (!natural(a.qty) || a.qty < 1 || a.qty > maxSell(s)) return refuse('掌柜只收从对岸运来的米，本月的订单也得有空余。');
      const stamps = a.stamps;
      if (stamps !== undefined && (!Array.isArray(stamps) || stamps.length !== 3
        || ![0, 1, 2].every(i => [0, 1, 2].includes(stamps[i])))) return refuse('三枚商印还没落齐。');
      const matched = stamps !== undefined && stamps[0] === stamps[1] && stamps[1] === stamps[2];
      const bonus = matched ? a.qty : 0;
      const payment = price * a.qty + bonus;
      return finish({cash: s.cash + payment, speech: s.speech + Number(stamps !== undefined), talkBonus: s.talkBonus + bonus,
        demand: {...s.demand, [bank]: s.demand[bank] - a.qty},
        warehouses: {...s.warehouses, [bank]: s.warehouses[bank] + a.qty},
        cargo: {...s.cargo, [other]: s.cargo[other] - a.qty}},
        `${ports[bank]}收下 ${a.qty} 袋，付你 ${payment} 枚。${matched ? `三印同纹，这笔多谈了 ${bonus} 枚。` : ''}`);
    }
    case 'sail': {
      const cost = fare(s);
      const ticket = s.freePass ? '船长兑现了昨晚的承诺，这一程免票。'
        : cost === 0 ? '你帮船工摇桨，抵了这一程的船票。' : `付船票 ${cost} 枚。`;
      return finish({bank: other, cash: s.cash-cost, paidFares: s.paidFares+cost, freePass: false},
        `到了${ports[other]}。${ticket}`);
    }
    case 'close': {
      if (s.month === 2) return finish({ended: true}, `账合上了。钱袋余 ${s.cash} 枚，船上还有 ${cargoTotal(s)} 袋米。`);
      return finish({month: 2, monthStart: {...s.warehouses}, prices: pricesFor(s.warehouses), demand: both(monthlyOrder)},
        '月初开市。两岸掌柜数过仓里的米，把新价牌挂了出来。');
    }
    case 'rent': {
      if (!canRent(s)) return refuse('卸完船，留下二十八枚本钱，再拿八枚赚来的铜币租摊。');
      const name = a.name.trim();
      if (!goodName(name)) return refuse('给摊位写一个一到十二个字的名字。');
      return finish({stallName: name, cash: s.cash-STALL_RENT, ended: true}, `付了八枚租金，「${name}」的招牌挂起来了。`);
    }
  }
}

function validPair(value: unknown, limit: number): value is ByBank {
  if (!value || typeof value !== 'object') return false;
  const p = value as ByBank;
  return natural(p.west) && p.west <= limit && natural(p.east) && p.east <= limit;
}

/** Check both the goods balance and the cash ledger before accepting a stored game. */
export function restoreRice(raw: unknown): RiceState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as RiceState;
  if (s.version !== 1 || (s.month !== 1 && s.month !== 2) || !['west', 'east'].includes(s.bank)) return null;
  if (typeof s.freePass !== 'boolean' || typeof s.ended !== 'boolean' || (s.ended && s.month !== 2)) return null;
  if (!natural(s.cash) || !natural(s.speech) || !natural(s.paidFares) || s.paidFares % regularFare !== 0 || !natural(s.talkBonus)) return null;
  if (!validPair(s.warehouses, 8) || !validPair(s.cargo, RICE_CAPACITY) || !validPair(s.prices, 9)
    || !validPair(s.monthStart, 8) || !validPair(s.demand, monthlyOrder)) return null;
  if (cargoTotal(s) > RICE_CAPACITY || total(s.warehouses) + cargoTotal(s) !== 8) return null;
  if (total(s.monthStart) < 4 || total(s.monthStart) > 8) return null;
  if (s.month === 1 && (s.monthStart.west !== normalStock || s.monthStart.east !== normalStock)) return null;
  const prices = pricesFor(s.monthStart);
  if (s.prices.west !== prices.west || s.prices.east !== prices.east) return null;
  const soldLimit = s.month * 2 * monthlyOrder - total(s.demand);
  if (s.speech > soldLimit || s.talkBonus > Math.min(soldLimit, s.speech * RICE_CAPACITY)) return null;
  if (s.stallName !== null && (!s.ended || !goodName(s.stallName) || cargoTotal(s) > 0 || s.cash < startingCash)) return null;
  const rawSales = (total(s.monthStart) - 8) * ordinaryPrice
    + (s.warehouses.west - s.monthStart.west) * prices.west + (s.warehouses.east - s.monthStart.east) * prices.east;
  if (s.cash !== startingCash + rawSales + s.talkBonus - s.paidFares - (s.stallName === null ? 0 : STALL_RENT)) return null;
  return { version: 1, month: s.month, bank: s.bank, cash: s.cash, warehouses: {...s.warehouses}, monthStart: {...s.monthStart}, prices,
    demand: {...s.demand}, cargo: {...s.cargo}, speech: s.speech, freePass: s.freePass, paidFares: s.paidFares, talkBonus: s.talkBonus,
    ended: s.ended, stallName: s.stallName };
}
