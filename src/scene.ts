import './scene.css';
import type { GameState } from './campaign.ts';
import { SEASONS } from './economy.ts';

const number = (value: number): string => Number.isInteger(value) ? String(value) : value.toFixed(1);

const farm = `<svg viewBox="0 0 92 64" aria-hidden="true"><path d="M8 49 42 33l41 13-34 17Z" fill="#c9ad70"/><path d="m14 49 35 9m-24-15 35 10m-24-15 35 10" fill="none" stroke="#8b7747" stroke-width="2"/><g class="scene-wheat" fill="none" stroke="#728757" stroke-width="2.3" stroke-linecap="round"><path d="M27 43V19m0 12-7-7m7 1 7-7m10 30V14m0 14-7-7m7 1 7-7m10 37V24m0 14-7-7m7 1 7-7"/></g><path d="m73 21 7-6m-2 14 8-1" stroke="#d2b970" stroke-width="2" stroke-linecap="round"/></svg>`;
const mill = `<svg viewBox="0 0 92 64" aria-hidden="true"><ellipse cx="46" cy="58" rx="32" ry="5" fill="#d4d4b7"/><path d="m28 57 6-38h24l6 38Z" fill="#e1c89e" stroke="#8a7755" stroke-width="1.5"/><path d="m30 20 16-13 16 13" fill="#526a54"/><path d="M42 57V42h9v15" fill="#6b624a"/><g class="scene-mill-blades" fill="#e6dcc2" stroke="#877451" stroke-width="1.5"><path d="M46 28V3h6v21Zm0 0h25v6H50Zm0 0v25h-6V32Zm0 0H21v-6h21Z"/><circle cx="46" cy="28" r="4" fill="#596b51"/></g></svg>`;
const market = `<svg viewBox="0 0 92 64" aria-hidden="true"><ellipse cx="46" cy="59" rx="34" ry="4" fill="#d4d4b7"/><path d="M22 27v29m48-29v29" stroke="#786447" stroke-width="3"/><path d="m18 27 9-17h38l9 17Z" fill="#c19358"/><path d="m29 27 5-17h8l-1 17m12 0-1-17h8l5 17" fill="#f4e6c6"/><path d="M18 27h56v5c-5 6-9 0-14 0s-9 6-14 0-9 6-14 0-9 6-14 0Z" fill="#a77d48"/><path d="M23 45h47v12H23Z" fill="#728369"/><g fill="#c99a56" stroke="#87663d"><path d="M30 45c-4-11 10-14 14-5l1 5Zm18 0c-4-11 10-14 14-5l1 5Z"/></g><path d="m33 36 4 4m17-4 4 4" stroke="#f6d99d" stroke-width="2"/></svg>`;
const homes = `<svg viewBox="0 0 92 64" aria-hidden="true"><ellipse cx="46" cy="59" rx="33" ry="4" fill="#d4d4b7"/><path d="M20 31h28v25H20Zm30-10h23v35H50Z" fill="#e5d3b1" stroke="#9d8b66" stroke-width="1.4"/><path d="m15 32 19-19 19 19Zm30-10L61 7l17 15Z" fill="#657b61"/><path d="M30 43h8v13m24-17h7v17" stroke="#7b6f51" fill="#9d9270"/><path d="M23 36h5v6m13-6h4v6m9-16h5v6m5-6h5v6" stroke="#b2a480" stroke-width="2"/><circle cx="82" cy="44" r="3.5" fill="#b38862"/><path d="M78 58V49h7v9" fill="#887452"/></svg>`;
const granary = `<svg viewBox="0 0 48 38" aria-hidden="true"><path d="M7 17h34v18H7Z" fill="#d6bc8a" stroke="#8b7751"/><path d="m3 18 21-15 21 15Z" fill="#69785c"/><path d="M19 35V22h10v13" fill="#756a4c"/><path d="m12 22 2 8m22-8-2 8" stroke="#ad955f" stroke-width="2"/></svg>`;

function node(place: string, title: string, art: string, fact: string, label: string, reaction = ''): string {
  return `<button class="scene-node" id="scene-${place}" type="button" data-action="scene-place" data-place="${place}" aria-label="${label}"><span class="scene-building">${art}</span><strong>${title}</strong><span class="scene-node-fact">${fact}</span>${reaction ? `<small class="scene-reaction-label">${reaction}</small>` : ''}</button>`;
}

/** The preview describes inputs only; settled quantities always come from the current turn. */
export function renderEconomyScene(state: GameState): string {
  const season = SEASONS[state.seasonIndex];
  const settled = state.phase === 'result' || state.phase === 'complete';
  const result = settled ? state.records.find(record => record.result.season === season.id)?.result : undefined;
  const policy = result?.policy ?? state.draft;
  const isSettled = Boolean(result);
  const release = result?.policy.release ?? 0;
  const shortage = Boolean(result && result.excessDemand > 0.01);
  const policyText = [
    policy.cap === null ? '不设最高价' : `最高价 ${policy.cap}`,
    policy.subsidy === 0 ? '不补贴' : `单位补贴 ${policy.subsidy}`,
  ].join(' · ');
  const mood = season.K < 100 ? 'scarce' : 'normal';
  const status = result
    ? shortage ? `有 ${number(result.excessDemand)} 篮需求未得到满足` : '按本季价格，市场需求均得到满足'
    : state.phase === 'briefing' ? '先观察正常市场，点击建筑与顾问聊一聊。' : '点击建筑了解影响；执行政策后才会出现实际流转。';
  return `<section class="economy-scene" data-scene-state="${isSettled ? 'settled' : 'preview'}" data-weather="${mood}" data-shortage="${shortage}" data-provision="${result ? result.coverageLow >= .95 - 1e-9 ? 'met' : 'short' : 'pending'}" data-release="${release > 0 ? 'active' : 'idle'}" aria-label="本季面包流转场景">
    <div class="scene-heading"><div><h3>小镇正在发生什么</h3><span class="scene-mode">${isSettled ? '你的决定已经生效' : '尚未执行'}</span></div>${isSettled ? '<button class="scene-replay-button" type="button" data-action="scene-replay" id="scene-replay-button" aria-label="重播本季流转动画，不改变结果"><span aria-hidden="true">↻</span> 重播流转</button>' : '<span class="scene-touch-hint">点建筑，去看看</span>'}</div>
    <div class="scene-board">
      <div class="scene-connections" aria-hidden="true"><span class="scene-connection"><i>→</i><span class="scene-cargo"><b>▰</b></span></span><span class="scene-connection"><i>→</i><span class="scene-cargo"><b>▰</b></span></span><span class="scene-connection"><i>→</i><span class="scene-cargo"><b>▰</b></span></span></div>
      ${node('farm', '农田', farm, `原料上限 ${season.K}`, `走访农田：本季原料上限 ${season.K}，了解供给约束`)}
      ${node('mill', '加工坊', mill, result ? `生产 ${number(result.privateOutput)} 篮` : `额外成本 ${number(season.c)}`, result ? `走访加工坊：本季生产 ${number(result.privateOutput)} 篮，了解生产者反应` : `走访加工坊：本季额外单位成本 ${number(season.c)}，了解生产者反应`)}
      ${node('market', '市场', market, result ? `每篮 ${number(result.price)}` : policy.cap === null ? '价格由市场决定' : `拟限价 ${policy.cap}`, '走访市场：与顾问讨论价格、供给和需求', result ? shortage ? '排队分粮' : '照常交易' : '')}
      ${node('homes', '居民', homes, result ? `低收入购粮 ${number(result.purchasesLow)}` : '购粮结果待结算', result ? `走访居民：低收入组实际购粮 ${number(result.purchasesLow)} 篮，了解生活保障` : '走访居民：了解政策如何影响实际购粮', result ? result.coverageLow >= .95 - 1e-9 ? '口粮守住了' : '口粮吃紧' : '')}
    </div>
    <div class="scene-bottom"><div class="scene-reserve-branch"><button class="scene-granary" id="scene-granary" type="button" data-action="scene-place" data-place="granary" aria-label="走访公共粮仓，了解储备投放"><span>${granary}</span><strong>公共粮仓</strong></button><span class="scene-reserve-flow" aria-hidden="true"><i>↗</i>${release > 0 ? '<span class="scene-reserve-cargo">▰</span>' : ''}</span><span class="scene-reserve-label">${result ? release > 0 ? `向市场投放 ${release} 篮` : '本季未开仓' : policy.release > 0 ? `拟投放 ${policy.release} 篮 · 未执行` : '暂不开仓'}</span></div><span class="scene-policy-note">${isSettled ? '已执行' : '拟定'}：${policyText}</span></div>
    <p class="scene-caption${shortage ? ' scene-caption-warning' : ''}">${status}${isSettled ? '<span>动画仅表示流向，数量以标签为准。</span>' : ''}</p>
  </section>`;
}
