import { SEASONS, demand, privateSupply } from './economy.ts';
import type { Result } from './economy.ts';

export function drawMarketChart(element: HTMLElement, result: Result): void {
  const width = Math.max(240, element.clientWidth);
  const height = 310;
  const left = 48, right = width - 16, top = 24, bottom = height - 48;
  const x = (q: number) => left + (q / 180) * (right - left);
  const y = (p: number) => bottom - (p / 12.5) * (bottom - top);
  const line = (x1: number, y1: number, x2: number, y2: number, attributes = '') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attributes}/>`;
  const text = (xx: number, yy: number, value: string | number, attributes = '') =>
    `<text x="${xx}" y="${yy}" ${attributes}>${value}</text>`;
  const season = SEASONS[result.season - 1];
  const curve = (quantity: (p: number) => number): string => {
    // Include the supply kink exactly, so the capacity constraint is genuinely vertical.
    const kink = season.c - result.policy.subsidy + season.K / 20;
    const prices = [...new Set([0, 12.5, 10, Math.max(0, season.c - result.policy.subsidy),
      Math.max(0, Math.min(12.5, kink)), ...Array.from({ length: 101 }, (_, i) => i / 8)])]
      .filter(p => p >= 0 && p <= 12.5).sort((a, b) => a - b);
    return prices.map((p, i) => `${i ? 'L' : 'M'}${x(quantity(p))},${y(p)}`).join(' ');
  };
  let content = '';
  for (const p of [0, 5, 10]) {
    content += line(left, y(p), right, y(p), 'class="chart-grid"');
    content += text(left - 10, y(p) + 4, p, 'text-anchor="end"');
  }
  for (const q of width < 400 ? [0, 90, 180] : [0, 60, 120, 180]) {
    content += text(x(q), bottom + 20, q, 'text-anchor="middle"');
  }
  content += line(left, top, left, bottom, 'class="chart-axis"') +
    line(left, bottom, right, bottom, 'class="chart-axis"');
  content += `<path d="${curve(demand)}" class="demand-curve"/>`;
  content += `<path d="${curve(p => privateSupply(p, season, result.policy))}" class="supply-curve"/>`;
  if (result.policy.release > 0) {
    content += `<path d="${curve(p => privateSupply(p, season, result.policy) + result.policy.release)}" class="total-curve"/>`;
  }
  if (result.policy.cap !== null) {
    content += line(left, y(result.policy.cap), right, y(result.policy.cap), 'class="cap-line"');
  }
  const equilibriumQ = demand(result.equilibriumPrice);
  content += `<circle cx="${x(equilibriumQ)}" cy="${y(result.equilibriumPrice)}" r="5" class="equilibrium-point"><title>无约束均衡：价格${result.equilibriumPrice.toFixed(2)}，数量${equilibriumQ.toFixed(2)}</title></circle>`;
  content += `<rect x="${x(result.totalOutput) - 4}" y="${y(result.price) - 4}" width="8" height="8" class="actual-point"><title>实际交易：价格${result.price.toFixed(2)}，数量${result.totalOutput.toFixed(2)}</title></rect>`;
  if (result.excessDemand > 1e-8) {
    const wanted = result.demandLow + result.demandHigh;
    content += line(x(result.totalOutput), y(result.price), x(wanted), y(result.price), 'class="shortage-line"');
    content += `<circle cx="${x(wanted)}" cy="${y(result.price)}" r="4" class="demand-point"><title>该价格下购买意愿${wanted.toFixed(2)}</title></circle>`;
  }
  content += text(left, 14, 'P · credits / 单位');
  content += text(right, height - 5, 'Q · 面包篮单位', 'text-anchor="end"');
  element.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img"
    aria-label="本季供需图。实际价格${result.price.toFixed(2)}，实际成交${result.totalOutput.toFixed(2)}，超额需求${result.excessDemand.toFixed(2)}。横轴数量，纵轴价格。">
    <title>供需与当季政策</title>${content}</svg>
    <div class="chart-legend"><span class="legend-demand">需求 D</span><span class="legend-supply">私人供给 S</span>
    ${result.policy.release ? '<span class="legend-total">含公共投放的总供给</span>' : ''}
    <span>● 无约束均衡</span><span>■ 实际交易</span>${result.policy.cap !== null ? '<span class="legend-cap">最高价格</span>' : ''}</div>`;
}
