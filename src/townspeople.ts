import type { GameState } from './campaign.ts';
import { SEASONS } from './economy.ts';

export type TownPlace = 'farm' | 'mill' | 'market' | 'homes';
export const TOWNSPEOPLE: Record<TownPlace, { name: string; role: string; image: string; next: TownPlace; nextLabel: string }> = {
  farm: { name: '陈禾', role: '农民', image: '/townspeople/farmer.png', next: 'mill', nextLabel: '去工坊看看' },
  mill: { name: '阿诚', role: '工人', image: '/townspeople/worker.png', next: 'market', nextLabel: '跟着货去市场' },
  market: { name: '阿芸', role: '售货员', image: '/townspeople/seller.png', next: 'homes', nextLabel: '去居民区听听' },
  homes: { name: '周婶', role: '居民', image: '/townspeople/resident.png', next: 'farm', nextLabel: '去田边走走' },
};

type VisitStory = {
  line: string;
  inspectLine: string;
  mood: 'calm' | 'worried' | 'relieved';
  propLabel: string;
  metricLabel: string;
  metricValue: string;
  fill: number;
  visual: 'grain' | 'production' | 'price' | 'basket';
  status: string;
};

const number = (value: number): string => Number(value.toFixed(1)).toString();
const fill = (value: number): number => Math.max(0, Math.min(1, value));

/** Visits read current conditions; an old season's result is never a forecast. */
export function visitStory(state: GameState, place: TownPlace): VisitStory {
  const season = SEASONS[state.seasonIndex]!;
  const last = state.records.at(-1)?.result;
  const result = (state.phase === 'result' || state.phase === 'complete') && last?.season === season.id ? last : undefined;

  switch (place) {
    case 'farm': {
      const previous = SEASONS[state.seasonIndex - 1];
      const recovering = previous !== undefined && season.K > previous.K;
      return {
        line: recovering
          ? `原料比上季松了些，最多能支持做 ${season.K} 篮。你去工坊问问阿诚的安排吧。`
          : season.K < 100
            ? `这季原料紧，最多只够工坊做 ${season.K} 篮。再赶工，也得先有原料啊。`
            : `原料都备着，最多能支持工坊做 ${season.K} 篮。来，看看这边的原料袋。`,
        inspectLine: `原料允许的最大私人产量 ${season.K} 篮；额外单位成本 ${number(season.c)}。这是本季生产上限，不是实际收成或产量。`,
        mood: season.K < 100 ? 'worried' : recovering ? 'relieved' : 'calm',
        propLabel: '看看原料袋', metricLabel: '原料允许的最大产量', metricValue: `${season.K} 篮`,
        fill: fill(season.K / 110), visual: 'grain', status: recovering ? '原料正在恢复' : season.K < 100 ? '原料紧张' : '原料供应正常',
      };
    }
    case 'mill': {
      if (!result) {
        return {
          line: state.phase === 'decision' && state.draft.subsidy > 0
            ? `原料最多够做 ${season.K} 篮。补贴还在草案里，得等方案敲定。`
            : `原料最多够做 ${season.K} 篮。到底开工多少，得看售价和成本，先别把筐数当产量。`,
          inspectLine: `原料上限 ${season.K} 篮；额外单位成本 ${number(season.c)}；${state.phase === 'decision' ? `草案每篮生产补贴 ${state.draft.subsidy}` : '当前无生产补贴'}。本季尚未结算。`,
          mood: 'calm', propLabel: '看看生产单', metricLabel: '本季私人产量', metricValue: '待结算',
          fill: 0, visual: 'production', status: '等待安排',
        };
      }
      const atLimit = result.privateOutput >= season.K - 1e-7;
      return {
        line: atLimit
          ? `这季做了 ${number(result.privateOutput)} 篮，原料已经用到上限了。再做就得等原料。`
          : `这季做了 ${number(result.privateOutput)} 篮。原料还有余地，开工多少还得看售价和成本。`,
        inspectLine: `实际私人产量 ${number(result.privateOutput)} 篮；原料上限 ${season.K} 篮；每篮生产补贴 ${result.policy.subsidy}。${atLimit ? '已达到原料上限。' : '尚未达到原料上限。'}`,
        mood: result.excessDemand > 1e-7 ? 'worried' : 'calm',
        propLabel: '看看成品筐', metricLabel: '实际私人产量', metricValue: `${number(result.privateOutput)} / ${season.K} 篮上限`,
        fill: fill(result.privateOutput / season.K), visual: 'production', status: atLimit ? '原料已用到上限' : '本季生产完成',
      };
    }
    case 'market': {
      if (!result) {
        const cap = state.phase === 'decision' ? state.draft.cap : null;
        return {
          line: cap === null
            ? '价签先空着，等本季开市再定。货能送来多少，也得等工坊和粮仓的安排。'
            : `草案说每篮最多卖 ${cap}。我先记下，等执行后再换价签。`,
          inspectLine: cap === null
            ? '当前没有售价上限。本季尚未成交，成交价、总供给和超额需求都要等结算。'
            : `草案售价上限 ${cap} /篮，尚未执行；实际成交价、总供给和超额需求都要等结算。`,
          mood: 'calm', propLabel: '看看价签', metricLabel: '草案售价上限', metricValue: cap === null ? '随市场调整' : `${cap} /篮`,
          fill: cap === null ? 0 : fill(cap / 12.5), visual: 'price', status: '等待开市',
        };
      }
      const shortage = result.excessDemand > 1e-7;
      return {
        line: shortage
          ? `每篮 ${number(result.price)}，可想买的还比供应多 ${number(result.excessDemand)} 篮，只能分着卖。`
          : `这季每篮卖 ${number(result.price)}，供需对上了。不过居民带回多少，还得去问问。`,
        inspectLine: `成交价 ${number(result.price)} /篮；总供给 ${number(result.totalOutput)} 篮（工坊 ${number(result.privateOutput)}＋粮仓 ${result.policy.release}）；超额需求 ${number(result.excessDemand)} 篮。`,
        mood: shortage ? 'worried' : 'calm',
        propLabel: '翻看售货账本', metricLabel: '本季成交价', metricValue: `${number(result.price)} /篮`,
        fill: fill(result.price / 12.5), visual: 'price', status: shortage ? '需要按比例分粮' : '供需已平衡',
      };
    }
    case 'homes': {
      if (!result) {
        return {
          line: '我们低收入组这季的基本口粮还是 36 篮。等开市，再看看能带回多少。',
          inspectLine: '低收入组基本口粮 36 篮。尚未结算；这里记的是整组居民，不是某一家。',
          mood: 'calm', propLabel: '看看购粮账本', metricLabel: '低收入组本季购粮', metricValue: '待结算',
          fill: 0, visual: 'basket', status: '等待购粮',
        };
      }
      const enough = result.purchasesLow >= 36 - 1e-7;
      return {
        line: enough
          ? `我们低收入组这季买到 ${number(result.purchasesLow)} 篮，基本口粮够了，总算能松口气。`
          : `我们低收入组带回 ${number(result.purchasesLow)} 篮，还不够 36 篮基本口粮。得再想想办法。`,
        inspectLine: `低收入组实际购粮 ${number(result.purchasesLow)} 篮；基本口粮 36 篮；保障率 ${number(result.coverageLow * 100)}%。这些都是整组数据。`,
        mood: enough ? 'relieved' : 'worried',
        propLabel: '看看购粮账本', metricLabel: '低收入组实际购粮', metricValue: `${number(result.purchasesLow)} / 36 篮口粮`,
        fill: fill(result.coverageLow), visual: 'basket', status: enough ? '基本口粮已买够' : '基本口粮还不足',
      };
    }
  }
}

/** A short response to the completed action, not another lesson or question. */
export function townReactions(state: GameState): Array<{ place: TownPlace; line: string }> {
  const result = state.records.at(-1)?.result;
  if (!['result', 'complete'].includes(state.phase) || result?.season !== state.seasonIndex + 1) return [];
  const place: TownPlace = result.excessDemand > 1e-7 ? 'market' : 'mill';
  return [place, 'homes' as const].map(place => ({ place, line: visitStory(state, place).line }));
}
