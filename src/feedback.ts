import { DEFAULT_POLICY, SEASONS, evaluate } from './economy.ts';
import type { Result } from './economy.ts';

const EPSILON = 1e-7;
const number = (value: number): string => Number(value.toFixed(1)).toString();

/**
 * Explain a settled turn against the same harvest and opening resources.
 * A different season is not a valid counterfactual for a policy's effect.
 */
export function outcomeFeedback(result: Result): {
  baseline: Result;
  headline: string;
  explanation: string;
  resident: string;
  producer: string;
  tradeoff: string;
  lesson: string;
} {
  const season = SEASONS[result.season - 1]!;
  const comparison = evaluate(season, DEFAULT_POLICY, result.before);
  if (!comparison.valid) throw new Error('无法计算本季无干预对照。');
  const baseline = comparison.result;
  const purchaseChange = result.purchasesLow - baseline.purchasesLow;
  const changeText = Math.abs(purchaseChange) < EPSILON
    ? '与无干预相同'
    : `比无干预${purchaseChange > 0 ? '多' : '少'}买 ${number(Math.abs(purchaseChange))} 篮`;
  const targetMet = result.coverageLow >= 0.95 - EPSILON;
  const headline = `${targetMet ? '本季保障达标' : '本季保障未达标'} · ${changeText}`;
  const mechanisms: string[] = [];

  if (result.capBinding) {
    mechanisms.push(`限价使想买的数量超过供给 ${number(result.excessDemand)} 篮，居民按比例分粮，价格更低不一定买得更多`);
  } else {
    mechanisms.push('市场已出清，没有超额需求，但出清不等于每组都能买够基本口粮');
  }

  let subsidyEffect = '';
  if (result.policy.subsidy > 0) {
    const withoutSubsidy = evaluate(season, { ...result.policy, subsidy: 0 }, result.before);
    if (!withoutSubsidy.valid) throw new Error('无法计算取消补贴的对照。');
    const extraOutput = result.privateOutput - withoutSubsidy.result.privateOutput;
    subsidyEffect = Math.abs(extraOutput) < EPSILON
      ? `其余政策相同时，补贴前后私人产量均为 ${number(result.privateOutput)} 篮，原料上限已满，补贴没有增产`
      : `其余政策相同时，补贴让私人产量从 ${number(withoutSubsidy.result.privateOutput)} 增至 ${number(result.privateOutput)} 篮`;
    mechanisms.push(subsidyEffect);
  } else if (result.policy.release > 0) {
    mechanisms.push(`公共粮仓提供 ${number(result.policy.release)} 篮，计入本季总供给`);
  }

  const explanation = `同样的收成下，无干预时低收入组买到 ${number(baseline.purchasesLow)} 篮；你的方案买到 ${number(result.purchasesLow)} 篮。${mechanisms.join('；')}。`;
  const resident = `“我们这一组买到 ${number(result.purchasesLow)} 篮，基本口粮是 36 篮；保障率 ${number(result.coverageLow * 100)}%，${targetMet ? '达到' : '未达到'} 95% 的本季目标。”`;
  const producer = `“私人产量 ${number(result.privateOutput)} 篮，利润 ${number(result.producerProfit)}。”${subsidyEffect ? ` ${subsidyEffect}。` : ` 原料允许的最大产量为 ${number(season.K)} 篮。`}`;
  const tradeoff = `现金 ${number(result.before.cash)} → ${number(result.after.cash)}；补贴支出 ${number(result.subsidyCost)}，配送支出 ${number(result.deliveryCost)}；储备 ${number(result.before.reserves)} → ${number(result.after.reserves)} 篮。${result.policy.release > 0 ? `售粮收入 ${number(result.publicSales)} 是库存换现金，不能直接当作净福利增加。` : '本季没有消耗公共储备。'}`;

  let lesson = 'IAL Unit 1 · 价格机制（price mechanism）：均衡满足有支付意愿的需求，并不保证基本生活需求都得到满足。';
  if (result.capBinding) {
    lesson = 'IAL Unit 1 · 最高限价（maximum price）：低于均衡价格会形成超额需求（excess demand），需要非价格配给。';
  } else if (result.policy.subsidy > 0) {
    lesson = 'IAL Unit 1 · 补贴（subsidy）与供给价格弹性（PES）：补贴能否增加产量，取决于生产者能否扩大供给。';
  } else if (result.policy.release > 0) {
    lesson = 'IAL Unit 1 · 政府干预与机会成本（opportunity cost）：今天投放的公共储备，未来便不能再次使用。';
  }

  return { baseline, headline, explanation, resident, producer, tradeoff, lesson };
}
