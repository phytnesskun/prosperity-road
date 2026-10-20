export type Policy = {
  cap: null | 4 | 5 | 6;
  subsidy: 0 | 1 | 2;
  release: 0 | 10 | 20;
};

export type Resources = {
  cash: number;
  reserves: number;
};

export type Season = {
  id: number;
  title: string;
  event: string;
  K: number;
  c: number;
};

export type Result = {
  season: number;
  policy: Policy;
  before: Resources;
  after: Resources;
  equilibriumPrice: number;
  price: number;
  capBinding: boolean;
  demandLow: number;
  demandHigh: number;
  privateOutput: number;
  totalOutput: number;
  purchasesLow: number;
  purchasesHigh: number;
  excessDemand: number;
  basicShortfall: number;
  coverageLow: number;
  coverageHigh: number;
  publicSales: number;
  deliveryCost: number;
  subsidyCost: number;
  producerProfit: number;
  producerSurplus: number;
  consumerSurplusLow: number;
  consumerSurplusHigh: number;
};

export type Evaluation =
  | { valid: true; result: Result }
  | { valid: false; reason: 'budget' | 'reserves' | 'input'; message: string };

export const DEFAULT_POLICY: Readonly<Policy> = Object.freeze({
  cap: null,
  subsidy: 0,
  release: 0,
});

export const INITIAL_RESOURCES: Readonly<Resources> = Object.freeze({
  cash: 160,
  reserves: 60,
});

export const SEASONS: readonly Readonly<Season>[] = Object.freeze([
  Object.freeze({
    id: 1,
    title: '正常市场',
    event: '收成正常。先观察没有政策干预的市场，了解居民购粮、国库和公共粮仓。',
    K: 110,
    c: 0,
  }),
  Object.freeze({
    id: 2,
    title: '歉收抵达',
    event: '歉收使私营原料上限降至70，额外单位成本升至2。价格与实际购粮可能朝不同方向变化。',
    K: 70,
    c: 2,
  }),
  Object.freeze({
    id: 3,
    title: '原料仍紧张',
    event: '原料上限回升至80，额外单位成本降至1.5。检查上季措施是否仍适合当前约束。',
    K: 80,
    c: 1.5,
  }),
  Object.freeze({
    id: 4,
    title: '恢复初期',
    event: '原料上限回升至100，额外单位成本降至1。重新判断补贴能否带来更多私人产量。',
    K: 100,
    c: 1,
  }),
  Object.freeze({
    id: 5,
    title: '恢复后期',
    event: '原料上限恢复至110，额外单位成本降至0.5。考虑继续干预与退出各会影响谁。',
    K: 110,
    c: 0.5,
  }),
  Object.freeze({
    id: 6,
    title: '恢复正常',
    event: '原料上限为110，额外单位成本回到0。提交最后一季政策，并为未来保留公共储备。',
    K: 110,
    c: 0,
  }),
]);

const EPSILON = 1e-9;
const BASIC_BASKET = 36;

export function demand(price: number): number {
  return Math.max(80 - 8 * price, 0) + Math.max(100 - 8 * price, 0);
}

export function privateSupply(price: number, season: Season, policy: Policy): number {
  return Math.min(season.K, 20 * Math.max(price + policy.subsidy - season.c, 0));
}

/**
 * Pure single-season calculation. The campaign enforces the fixed, policy-free
 * first season; this function also permits independent baseline comparisons.
 * Quantities are basket units, money is credits, and coverage is a 0–1 ratio.
 * No intermediate values are rounded.
 */
export function evaluate(
  season: Season,
  policy: Policy,
  resources: Resources,
): Evaluation {
  if (
    !season ||
    !policy ||
    !resources ||
    !Number.isInteger(season.id) ||
    season.id < 1 ||
    season.id > 6 ||
    !Number.isFinite(season.K) ||
    season.K < 0 ||
    season.K > 110 ||
    !Number.isFinite(season.c) ||
    season.c < 0 ||
    ![null, 4, 5, 6].includes(policy.cap) ||
    ![0, 1, 2].includes(policy.subsidy) ||
    ![0, 10, 20].includes(policy.release) ||
    !Number.isFinite(resources.cash) ||
    resources.cash < 0 ||
    !Number.isFinite(resources.reserves) ||
    resources.reserves < 0
  ) {
    return {
      valid: false,
      reason: 'input',
      message: '参数无效：请使用有效的季节、政策档位和非负资源。',
    };
  }

  if (policy.release > resources.reserves) {
    return {
      valid: false,
      reason: 'reserves',
      message: '公共储备不足，请减少本季投放量。当前政策组合尚未执行。',
    };
  }

  // Find the equilibrium with this subsidy and release before testing the cap.
  let low = 0;
  let high = 12.5;
  for (let step = 0; step < 100; step += 1) {
    const midpoint = (low + high) / 2;
    if (demand(midpoint) > privateSupply(midpoint, season, policy) + policy.release) {
      low = midpoint;
    } else {
      high = midpoint;
    }
  }

  const equilibriumPrice = (low + high) / 2;
  const price = policy.cap === null ? equilibriumPrice : Math.min(equilibriumPrice, policy.cap);
  const capBinding = policy.cap !== null && policy.cap < equilibriumPrice - EPSILON;
  const demandLow = Math.max(80 - 8 * price, 0);
  const demandHigh = Math.max(100 - 8 * price, 0);
  const totalDemand = demandLow + demandHigh;
  const privateOutput = privateSupply(price, season, policy);
  const totalOutput = privateOutput + policy.release;
  // The scenario assumes proportional rationing between representative groups.
  const allocation = totalDemand > 0 ? Math.min(1, totalOutput / totalDemand) : 0;
  const purchasesLow = allocation * demandLow;
  const purchasesHigh = allocation * demandHigh;

  const publicSales = price * policy.release;
  const deliveryCost = 0.5 * policy.release;
  const subsidyCost = policy.subsidy * privateOutput;
  const cash = resources.cash + publicSales - deliveryCost - subsidyCost;
  if (cash < -EPSILON) {
    return {
      valid: false,
      reason: 'budget',
      message: '本季预计期末现金不足，请降低补贴或调整政策组合。当前政策组合尚未执行。',
    };
  }

  const variableCost = season.c * privateOutput + privateOutput ** 2 / 40;
  const producerSurplus = (price + policy.subsidy) * privateOutput - variableCost;

  return {
    valid: true,
    result: {
      season: season.id,
      policy: { ...policy },
      before: { ...resources },
      // A tiny negative floating-point residual is zero, not a permitted debt.
      after: { cash: Math.max(0, cash), reserves: resources.reserves - policy.release },
      equilibriumPrice,
      price,
      capBinding,
      demandLow,
      demandHigh,
      privateOutput,
      totalOutput,
      purchasesLow,
      purchasesHigh,
      excessDemand: Math.max(0, totalDemand - totalOutput),
      basicShortfall:
        Math.max(0, BASIC_BASKET - purchasesLow) + Math.max(0, BASIC_BASKET - purchasesHigh),
      coverageLow: Math.min(1, purchasesLow / BASIC_BASKET),
      coverageHigh: Math.min(1, purchasesHigh / BASIC_BASKET),
      publicSales,
      deliveryCost,
      subsidyCost,
      producerProfit: producerSurplus - 30,
      producerSurplus,
      consumerSurplusLow: 10 * purchasesLow - purchasesLow ** 2 / 16 - price * purchasesLow,
      consumerSurplusHigh: 12.5 * purchasesHigh - purchasesHigh ** 2 / 16 - price * purchasesHigh,
    },
  };
}
