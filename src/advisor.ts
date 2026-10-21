import { currentResources, goals } from './campaign.ts';
import type { GameState } from './campaign.ts';
import { SEASONS, evaluate } from './economy.ts';
import { outcomeFeedback } from './feedback.ts';

export type AdvisorTopic = 'briefing' | 'policy' | 'why' | 'reserves' | 'lesson' | 'access' | 'farm' | 'production' | 'market' | 'opportunity';
export type AdvisorReply = {
  text: string;
  mood: 'welcoming' | 'thinking' | 'concerned' | 'pleased';
  choices: { topic: AdvisorTopic; label: string }[];
  action?: { kind: 'policy' | 'market' | 'replay'; label: string };
};

const number = (value: number): string => Number(value.toFixed(1)).toString();

/** Local, state-based dialogue: never settles a turn or reveals an unsettled outcome. */
export function advisorReply(state: GameState, topic: AdvisorTopic): AdvisorReply {
  const result = ['result', 'complete'].includes(state.phase) ? state.records.at(-1)?.result : undefined;
  const resources = currentResources(state);
  const season = SEASONS[state.seasonIndex]!;
  const choices: AdvisorReply['choices'] = [
    result ? { topic: 'why', label: '为什么会这样？' } : { topic: 'policy', label: '帮我看看方案' },
    { topic: 'reserves', label: '粮仓还撑得住吗？' },
    { topic: 'access', label: '为什么便宜了也可能买不到？' },
  ];
  const action: AdvisorReply['action'] = state.phase === 'decision'
    ? { kind: 'policy', label: '去调整政策' }
    : state.records.length >= 2
      ? { kind: 'replay', label: '试试另一种选择' }
      : state.records.length > 0
        ? { kind: 'market', label: '看看供需图' }
        : undefined;

  switch (topic) {
    case 'briefing': {
      if (state.phase === 'briefing') {
        return {
          text: '我是林岚，镇上的经济顾问，陪你一起把这六季过好。先观察正常收成下的市场，再来决定怎样让居民买够面包。',
          mood: 'welcoming', choices,
        };
      }
      if (state.phase === 'complete') {
        const progress = goals(state.records);
        return {
          text: `六季结束了，有 ${progress.metSeasons} 季达到居民购粮保障目标，粮仓还留着 ${number(resources.reserves)} 篮。${progress.passed ? '这次你守住了任务目标，我们可以回放一季，看看换个选择会怎样。' : '我们可以回放最吃紧的一季，找找哪个取舍值得调整。'}`,
          mood: progress.passed ? 'pleased' : 'thinking', choices, action,
        };
      }
      if (result) {
        const feedback = outcomeFeedback(result);
        return {
          text: `这季低收入居民买到 ${number(result.purchasesLow)} 篮，同样收成下不干预会买到 ${number(feedback.baseline.purchasesLow)} 篮。${result.coverageLow >= 0.95 ? '本季保障达标了，再看看为此花了多少现金和储备。' : '本季保障还没达标，我们一起查查是买不起，还是供给不够。'}`,
          mood: result.coverageLow >= 0.95 ? 'pleased' : 'concerned', choices, action,
        };
      }
      const context = [
        '先观察正常收成下的市场',
        '歉收让原料更紧张，生产成本也上升了',
        '原料开始恢复，但供应仍然紧张',
        '原料进一步恢复，补贴的作用可能和歉收时不同',
        '收成接近恢复，可以考虑哪些干预已经不必继续',
        '生产条件恢复正常，也该给下一年留一些储备',
      ][state.seasonIndex];
      return {
        text: `第 ${state.seasonIndex + 1} 季到了，${context}。选好方案就可以执行，看看镇上的变化。`,
        mood: state.seasonIndex <= 2 ? 'concerned' : 'thinking', choices, action,
      };
    }
    case 'policy': {
      if (state.phase !== 'decision') {
        return {
          text: result
            ? state.records.length >= 2
              ? '这季方案已经执行了，先用实际购粮和财政变化判断效果。想换一种政策，我们可以在回放里比较，不会改动原来的结果。'
              : '正常市场已经观察过了，这是之后比较政策效果的起点。进入下一季，就可以选择自己的方案。'
            : '第一季先观察没有干预的市场，建立一个比较起点。进入下一季后，你就可以调整限价、补贴和粮仓投放。',
          mood: 'thinking', choices: [{ topic: 'production', label: '工坊能多做一些吗？' }, ...choices.slice(1)], action,
        };
      }
      const feasibility = evaluate(SEASONS[state.seasonIndex]!, state.draft, resources);
      if (!feasibility.valid) {
        return {
          text: feasibility.reason === 'reserves'
            ? `粮仓现有 ${number(resources.reserves)} 篮，草案却要投放 ${state.draft.release} 篮，还不能执行。先减少投放，再判断是否需要其他措施。`
            : '这份草案的预计期末现金不足，还不能执行。先降低补贴，或调整政策组合，保住国库再谈效果。',
          mood: 'concerned', choices: [{ topic: 'reserves', label: '看看手上的资源' }, { topic: 'access', label: '居民能买够面包吗？' }], action,
        };
      }
      const mechanisms = [state.draft.cap === null ? '你让售价随市场调整' : `你把售价上限设为 ${state.draft.cap}`];
      const risks: string[] = [];
      if (state.draft.cap !== null) risks.push('限价若低于均衡价格，会出现配给');
      if (state.draft.subsidy > 0) {
        mechanisms.push(`每篮补贴生产者 ${state.draft.subsidy}`);
        risks.push('补贴会花钱，原料卡住时也未必能增产');
      }
      if (state.draft.release > 0) {
        mechanisms.push(`投放 ${state.draft.release} 篮公共储备`);
        risks.push('今天动用的储备以后不能再用');
      }
      return {
        text: `${mechanisms.join('，')}。${risks.length ? `${risks.join('；')}，先想想哪种代价值得承担。` : '市场会通过价格协调供求，但不保证每组居民都买得起基本口粮。'}`,
        mood: 'thinking', choices: [{ topic: 'access', label: '为什么便宜了也可能买不到？' }, { topic: 'reserves', label: '看看储备的取舍' }, { topic: 'lesson', label: '这套方案怎么起作用？' }], action,
      };
    }
    case 'why': {
      if (!result) {
        return {
          text: '本季还没结算，居民还没有买到这一季的面包。执行后就能看到他们的收获，再和同样收成下的无干预情况比较。',
          mood: 'thinking', choices: [{ topic: 'policy', label: '先讨论我的方案' }, { topic: 'access', label: '为什么便宜了也可能买不到？' }], action,
        };
      }
      return {
        text: outcomeFeedback(result).explanation,
        mood: result.coverageLow >= 0.95 ? 'pleased' : 'concerned',
        choices: [{ topic: 'lesson', label: '这套方案怎么起作用？' }, { topic: 'reserves', label: '付出了什么代价？' }, { topic: 'access', label: '买不起和买不到有何区别？' }], action,
      };
    }
    case 'reserves': {
      const release = state.phase === 'decision' ? state.draft.release : 0;
      if (release > resources.reserves) {
        return {
          text: `手上只有 ${number(resources.reserves)} 篮储备，草案要投放 ${release} 篮，粮仓不够。先减少投放量；最后一季结束时还需要留足 20 篮。`,
          mood: 'concerned', choices: [{ topic: 'policy', label: '帮我重新看看方案' }, { topic: 'opportunity', label: '开仓会留下什么代价？' }], action,
        };
      }
      return {
        text: `现在国库有 ${number(resources.cash)}，粮仓有 ${number(resources.reserves)} 篮。${release > 0 ? `草案计划投放 ${release} 篮，这部分以后不能再用，最终还要留足 20 篮。` : result ? `这是结算后的资源；${result.policy.release > 0 ? '已用掉的粮食不能再投一次，留下的储备才是未来的余地。' : '这季没有动用粮仓，留下的储备可以应对未来的风险。'}` : '粮仓可以缓解眼前的供给压力，但今天用掉的粮食以后不能再用，最终还要留足 20 篮。'}`,
        mood: resources.reserves - release < 20 ? 'concerned' : 'thinking',
        choices: [{ topic: 'opportunity', label: '开仓会留下什么代价？' }, { topic: 'policy', label: '回到政策方案' }], action,
      };
    }
    case 'farm':
      return {
        text: `第 ${season.id} 季的原料供应上限是 ${season.K} 篮，额外单位成本是 ${number(season.c)}。这是农田给加工坊的约束，不是已经生产出来的数量；增加补贴也不能让本季的原料凭空变多。`,
        mood: season.K < 100 ? 'concerned' : 'thinking',
        choices: [{ topic: 'production', label: '加工坊能多做一些吗？' }, { topic: 'reserves', label: '粮仓能帮上忙吗？' }], action,
      };
    case 'production': {
      if (result) {
        return {
          text: `加工坊这季的实际记录是：${outcomeFeedback(result).producer}`,
          mood: result.privateOutput >= season.K ? 'thinking' : 'welcoming',
          choices: [{ topic: 'farm', label: '原料限制在哪里？' }, { topic: 'why', label: '居民因此多买了吗？' }, { topic: 'opportunity', label: '动用粮仓有什么代价？' }], action,
        };
      }
      return {
        text: `${state.phase === 'decision' ? state.draft.subsidy > 0 ? `草案给生产者每篮补贴 ${state.draft.subsidy}，提高他们每篮的收入` : '草案还没有生产补贴，加工坊根据售价和成本决定生产' : '加工坊会根据售价和成本决定生产'}。私人生产不能突破本季原料上限；补贴是否能增产，要看现有原料和其他政策，不能只看补贴金额。`,
        mood: 'thinking',
        choices: [{ topic: 'farm', label: '查看当季原料条件' }, { topic: 'policy', label: '看看整套政策' }], action,
      };
    }
    case 'market': {
      if (result) {
        return {
          text: `这季实际成交价是 ${number(result.price)}，超额需求是 ${number(result.excessDemand)} 篮。${result.capBinding ? '限价导致想买的数量超过供给，模型按两组的需求比例配给；超额需求不是已经买到的数量。' : '市场已经出清，但这不代表每组居民都买够基本口粮，还要看他们实际买到了多少。'}`,
          mood: result.capBinding ? 'concerned' : 'thinking',
          choices: [{ topic: 'why', label: '居民实际买到了多少？' }, { topic: 'access', label: '买不起和买不到有何区别？' }],
          action: { kind: 'market', label: '打开这季供需图' },
        };
      }
      const cap = state.phase === 'decision' ? state.draft.cap : null;
      return {
        text: cap === null
          ? '当前没有售价上限，价格会随供需调整。市场能出清，也不保证每组居民都买得起基本口粮；本季成交情况还要等结算。'
          : `草案把售价上限设为 ${cap}，只有低于本季均衡价格时才会起作用。届时想买的数量可能超过供给，需要配给；本季是否如此，还要等结算。`,
        mood: 'thinking',
        choices: [{ topic: 'access', label: '为什么便宜了也可能买不到？' }, { topic: 'production', label: '市场上能供应多少？' }], action,
      };
    }
    case 'opportunity':
      return {
        text: `现在粮仓有 ${number(resources.reserves)} 篮，用来救急就会减少未来可用的储备。${state.phase === 'decision' && state.draft.release > 0 ? `草案计划投放 ${state.draft.release} 篮，值得比较眼前购粮需求和未来应急需求。` : '保留储备也有取舍，因为这些粮食本可以缓解眼前的供应压力。'}公共粮仓按市场价格售粮，不是免费赠送；售粮是库存换现金，也不能当作净福利增加。`,
        mood: 'thinking',
        choices: [{ topic: 'reserves', label: '看看当前还能用多少' }, { topic: 'policy', label: '重新考虑政策取舍' }], action,
      };
    case 'lesson': {
      const policy = result?.policy ?? state.draft;
      const text = policy.cap !== null
        ? '限价只有压在市场原本的成交价之下才会起作用。便宜后大家想买更多，工坊却可能不愿多做，货架不够时只能分着买。最终要看居民带回家多少面包。'
        : policy.subsidy > 0
          ? '补贴让工坊每做一篮赚得更多，但增产还需要原料。原料用尽后，再给补贴也做不出更多面包，钱却照样花出去。'
          : '开仓能把储备送进市场，缓解眼前的供应压力。今天用掉的粮食不能再用一次，后面的季度就少了一份余地。';
      return {
        text, mood: 'thinking',
        choices: [{ topic: 'production', label: '工坊现在能多做一些吗？' }, result ? { topic: 'why', label: '用这季结果解释' } : { topic: 'policy', label: '用我的草案解释' }],
        action: state.records.length > 0 ? { kind: 'market', label: '结合供需图看看' } : undefined,
      };
    }
    case 'access':
      return {
        text: result
          ? result.capBinding
            ? `这季虽然每篮只要 ${number(result.price)}，但想买的数量超过供给 ${number(result.excessDemand)} 篮，只能按比例分粮。低收入居民实际买到 ${number(result.purchasesLow)} 篮；压低标价没有让货架自动变满。`
            : `这季每篮 ${number(result.price)}，低收入居民实际买到 ${number(result.purchasesLow)} 篮。${result.purchasesLow >= 36 ? '他们带回家的面包够基本口粮了。' : '市场有成交，不代表每家都买得起足够的面包。'}价格和货架上的数量，都影响他们能带多少回家。`
          : '降价会让人希望买得更多，但不保证货架上有足够的面包。限价若造成短缺，就要按比例分粮，实际购粮反而可能减少。执行方案后，我们就能看到居民到底带回家多少。',
        mood: result && result.coverageLow < 0.95 ? 'concerned' : 'thinking',
        choices: [{ topic: 'production', label: '工坊能多做一些吗？' }, { topic: 'reserves', label: '粮仓能帮上忙吗？' }, result ? { topic: 'why', label: '看看这一季的变化' } : { topic: 'policy', label: '回头看看我的方案' }], action,
      };
  }
}
