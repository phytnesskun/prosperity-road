import { currentResources, goals } from './campaign.ts';
import type { GameState } from './campaign.ts';
import { SEASONS, evaluate } from './economy.ts';
import type { AdvisorTopic } from './advisor.ts';
import type { TownPlace } from './townspeople.ts';

export type VoiceLanguage = 'zh' | 'en';
export type VoiceCharacter = 'advisor' | TownPlace;
export type VoiceLine = { id: string; character: VoiceCharacter; zh: string; en: string };

// Spoken reactions are deliberately brief. The existing ledger retains exact live numbers.
const lines: Array<[string, VoiceCharacter, string, string]> = [
  ['advisor-welcome', 'advisor', '我是林岚。别着急，我们一起照看这座小镇。先去看看市场吧。', "I'm Lin Lan. Take your time. We'll look after this town together. Let's start at the market."],
  ['advisor-complete-pass', 'advisor', '六季走完了，你守住了目标。辛苦啦。要不要回头看看，另一种选择会怎样？', "Six seasons, and you've met your goals. Well done. Shall we look back and try a different choice?"],
  ['advisor-complete-retry', 'advisor', '六季走完了。有些地方还可以再试试。我们回到最吃紧的那一季，好吗？', "We've reached the end of six seasons. There's still room to try another approach. Let's revisit the toughest season."],
  ['advisor-season-1', 'advisor', '先看看正常收成时，镇上的市场怎么运转。之后做决定，心里就有底了。', "Let's see how the market works in a normal harvest. That will give us something to compare our choices with."],
  ['advisor-season-2', 'advisor', '歉收来了，原料紧，成本也高了。选好方案，我们就看看小镇怎么回应。', "The poor harvest is here. Materials are scarce, and costs are higher. Choose a plan, and let's see how the town responds."],
  ['advisor-season-3', 'advisor', '原料开始恢复了，不过供应还紧。慢慢来，看看这季最需要帮哪一头。', "Materials are starting to recover, but supplies are still tight. Take a moment to see where help is needed most."],
  ['advisor-season-4', 'advisor', '原料又宽裕了一些。现在给补贴，效果可能和歉收时不同了。', "We've got a little more material now. A subsidy may work differently than it did during the poor harvest."],
  ['advisor-season-5', 'advisor', '生产条件接近恢复了。有些措施，也许已经可以慢慢收回来了。', "Production is almost back to normal. It may be time to ease off some of the support."],
  ['advisor-season-6', 'advisor', '最后一季，生产条件恢复正常了。照顾眼前，也给下一年留点余地吧。', "It's the final season, and production conditions are back to normal. Let's look after today, and leave something for next year."],
  ['advisor-result-met', 'advisor', '这季的保障目标达到了。我们再看看，为此花了多少现金和储备。', "We've met this season's food coverage target. Now let's see what it cost in cash and reserves."],
  ['advisor-result-unmet', 'advisor', '这季的保障还没达标。别急，我们一起看看，是买不起，还是货不够。', "We haven't met this season's food coverage target. Let's work out whether people couldn't afford enough, or there wasn't enough to buy."],
  ['advisor-first-market', 'advisor', '先观察一次没有干预的市场。下一季，限价、补贴和粮仓投放，就由你来定。', "Let's first watch the market without intervention. Next season, you'll choose price limits, subsidies, and releases from the granary."],
  ['advisor-baseline-done', 'advisor', '正常市场已经看过了。进入下一季，就可以选自己的方案了。', "We've seen the normal market. Move into the next season, and you can choose your own plan."],
  ['advisor-policy-settled', 'advisor', '这季已经执行完了。想换一种办法，可以免费试算，原来的结果会留着。', "This season's plan has already been carried out. You can try another approach for free, and keep the original result."],
  ['advisor-reserves-invalid', 'advisor', '这份草案要用的粮，比粮仓现有的还多。先减少投放，我们再看下一步。', "This draft calls for more grain than we have in reserve. Reduce the release first, and then we'll take another look."],
  ['advisor-cash-invalid', 'advisor', '这份草案会让国库现金不够。先调整补贴或政策组合，留住周转的余地。', "This draft would leave the treasury short of cash. Let's adjust the subsidy or the policy mix, so we can keep going."],
  ['advisor-policy-market', 'advisor', '你让价格随市场调整。这样能协调供求，但居民能不能买够，还得看看。', "You're letting prices adjust with the market. That can balance supply and demand, but we'll still need to check whether residents can afford enough."],
  ['advisor-policy-cap', 'advisor', '你准备限制售价。价格压得太低，货可能不够卖，得留意居民实际拿到多少。', "You're planning a price limit. If it's too low, there may not be enough bread to go round. Watch what residents actually take home."],
  ['advisor-policy-subsidy', 'advisor', '你准备给工坊补贴。能不能多做面包，还要看原料；国库的支出也别忘了。', "You're planning a subsidy for the workshops. Whether they can bake more depends on materials. Keep an eye on the treasury cost, too."],
  ['advisor-policy-release', 'advisor', '你准备开仓，增加市场供应。今天用掉的储备，后面就不能再用了。', "You're planning to open the granary and add to market supply. Reserves used today won't be there for a later season."],
  ['advisor-policy-cap-subsidy', 'advisor', '限价加补贴，可以一起考虑。不过原料仍有上限，货架和国库都得照看。', "You're combining a price limit with a subsidy. Materials still put a ceiling on production, so watch both the shelves and the treasury."],
  ['advisor-policy-cap-release', 'advisor', '限价配上开仓，能同时影响价格和供应。也要看看，粮仓还给后面留了多少。', "A price limit and a granary release affect both price and supply. Check how much grain you're leaving for the seasons ahead."],
  ['advisor-policy-subsidy-release', 'advisor', '补贴和开仓一起用，会动到现金和储备。先看看这两份代价，你愿不愿意承担。', "Using a subsidy and a granary release draws on both cash and reserves. Take a look at those costs before you decide."],
  ['advisor-policy-all', 'advisor', '三种措施一起用，影响也会交织在一起。价格、原料、现金和储备，都值得留意。', "With all three measures together, their effects interact. Keep an eye on prices, materials, cash, and reserves."],
  ['advisor-pending', 'advisor', '这季还没结算呢。方案执行后，我们再看居民带回了多少面包。', "This season hasn't been settled yet. Once the plan is carried out, we'll see how much bread residents took home."],
  ['advisor-shortage', 'advisor', '价签降了，可想买的比货架上的还多，只能按比例分粮。便宜，不一定就能多买。', "The price is lower, but people want more than the shelves can supply. Bread has to be rationed proportionally. Cheaper doesn't always mean more to take home."],
  ['advisor-cleared', 'advisor', '这季供需对上了，没有超额需求。不过市场出清，不代表每组居民都买够了口粮。', "Supply and demand balance this season, with no excess demand. But a cleared market doesn't mean every group has enough basic food."],
  ['advisor-reserves-planned', 'advisor', '你打算动用一部分粮仓。先留意眼前的需要，也记得任期结束要留足储备。', "You're planning to use part of the granary. Consider today's needs, and remember to leave enough reserves at the end of your term."],
  ['advisor-reserves-used', 'advisor', '这季已经用掉一部分储备。账本上留下的粮，才是之后还能动用的。', "We've used some reserves this season. The grain left in the ledger is what we can still use later."],
  ['advisor-reserves-saved', 'advisor', '这季没有动用粮仓。留下的储备，是后面遇到困难时的一份余地。', "We didn't use the granary this season. Those reserves give us some room to respond if things get difficult later."],
  ['advisor-reserves-general', 'advisor', '粮仓能缓一缓眼前的压力，不过用一篮就少一篮。任期结束，还要留下二十篮。', "The granary can ease today's pressure, but every basket used is one less for later. We need to finish with twenty baskets in reserve."],
  ['advisor-farm', 'advisor', '农田给的是原料上限，不是已经做好的面包。补贴再多，也不能让原料凭空增加。', "The farm sets the material limit. That isn't bread already produced. A larger subsidy can't create extra materials out of thin air."],
  ['advisor-production-plan', 'advisor', '工坊会看售价和成本来安排生产。能不能多做，还得看原料有没有余地。', "The workshops plan production around prices and costs. Whether they can make more also depends on the materials available."],
  ['advisor-production-subsidy', 'advisor', '草案里的补贴会提高工坊每篮的收入。可是原料用尽了，就做不出更多面包。', "The draft subsidy would raise what workshops receive per basket. But once materials run out, they can't bake any more."],
  ['advisor-production-limit', 'advisor', '这季私人产量已经碰到原料上限了。想再增加供应，就得看看别的办法。', "Private production has reached the material limit this season. To add more supply, we'll need to consider another approach."],
  ['advisor-production-room', 'advisor', '这季原料还没用到上限。工坊实际做多少，仍然取决于售价和成本。', "Production stayed below the material limit this season. What workshops actually make still depends on prices and costs."],
  ['advisor-market-plan', 'advisor', '现在没有售价上限。成交价和居民买到的数量，要等开市后再看。', "There's no price limit at the moment. We'll see the trading price and residents' purchases once the market opens."],
  ['advisor-market-cap-plan', 'advisor', '限价还在草案里。只有低于原本的均衡价格，它才会起作用；先别把草案当结果。', "The price limit is still a draft. It only binds below the market's equilibrium price. Let's not mistake a plan for a result."],
  ['advisor-opportunity', 'advisor', '开仓能救急，也会减少未来的余地。而且粮仓是按市场价卖粮，不是免费发放。', "Opening the granary can help now, but leaves less for later. And the grain is sold at the market price. It isn't given away."],
  ['advisor-lesson-cap', 'advisor', '限价压得低，大家想多买，工坊却可能少做。最后要看带回家的面包，别只盯着价签。', "A low price limit makes people want more, while workshops may produce less. Watch the bread people take home, not just the price tag."],
  ['advisor-lesson-subsidy', 'advisor', '补贴能鼓励生产，但增产要有原料。原料用尽了，钱照样花，面包却不会凭空多出来。', "A subsidy can encourage production, but extra output needs materials. Once those run out, the money still gets spent without creating more bread."],
  ['advisor-lesson-release', 'advisor', '开仓把储备送进市场，能缓解眼前的供应压力。不过这些粮，下一季就不能再用了。', "Opening the granary adds reserves to the market and eases supply pressure now. But that grain won't be available next season."],
  ['advisor-access-pending', 'advisor', '降价会让人想多买，可货架不一定跟着变满。等执行以后，再看看大家实际带回多少。', "Lower prices make people want more, but don't automatically fill the shelves. After the plan runs, let's see what people actually take home."],
  ['advisor-access-enough', 'advisor', '这季低收入组已经买够基本口粮了。价格和供应，两头都在影响他们的篮子。', "The low-income group bought enough basic food this season. Both prices and supply shape what ends up in their baskets."],
  ['advisor-access-low', 'advisor', '这季市场虽然出清了，低收入组仍没买够口粮。买得到，也可能买不起足够的量。', "The market cleared, but the low-income group still didn't buy enough basic food. Bread can be available without enough of it being affordable."],
  ['farm-normal', 'farm', '原料都备着呢。来，看看这些袋子，工坊能做多少，先得看它们。', "The materials are ready. Come, have a look at these sacks. What the workshops can make starts here."],
  ['farm-tight', 'farm', '唉，这季原料紧。再怎么赶工，也得先有粮啊。', "Ah, materials are tight this season. However hard we work, we need the grain first."],
  ['farm-recovery', 'farm', '比上季宽裕些了。去工坊问问阿诚，看看他怎么安排。', "We've got a little more than last season. Go and ask Cheng at the workshop what he's planning."],
  ['farm-inspect', 'farm', '袋子上的数，记的是原料最多能支持做多少。可不是已经出炉的面包。', "The figure on the sacks tells you the most our materials can support. It isn't bread that's already come out of the oven."],
  ['mill-pending', 'mill', '做多少，得看售价和成本。先别数筐，开工的安排还没定呢。', "How much we make depends on the price and our costs. Don't count the baskets yet. The production plan isn't settled."],
  ['mill-subsidy-pending', 'mill', '听说草案里有补贴？我先记着。等方案敲定，再安排开工。', "There's a subsidy in the draft? I'll keep that in mind. Once the plan is final, we can arrange production."],
  ['mill-at-limit', 'mill', '这季原料已经用到上限了。再添一筐，也得先等原料。', "We've hit the material limit this season. Even one more basket needs more supplies first."],
  ['mill-below-limit', 'mill', '这季做完了，原料还有余地。到底做多少，还得看卖价和成本合不合适。', "This season's production is done, with some material capacity left. How much we make depends on whether the price covers the cost."],
  ['mill-inspect', 'mill', '这是我们的生产单。上限归上限，实际做了多少，要看结算后的记录。', "Here's our production sheet. Capacity is one thing. The amount we actually made is in the settled record."],
  ['market-pending', 'market', '价签先空着，等开市再换。工坊和粮仓能送多少货，还得等等。', "I'll leave the price tag blank until the market opens. We're still waiting to see what the workshops and granary send."],
  ['market-cap-pending', 'market', '草案里的最高价，我记下了。不过还没执行呢，价签先不换。', "I've noted the draft price limit. It hasn't taken effect yet, so I'll leave the price tag as it is."],
  ['market-shortage', 'market', '想买的比送来的还多，只能分着卖了。价签低，可不等于货就够啊。', "People want more than we've received, so we have to share it out. A low price tag doesn't mean there's enough on the shelves."],
  ['market-cleared', 'market', '这季供需对上了。居民到底带回多少，你去问问周婶吧。', "Supply and demand matched this season. To hear what residents took home, go and ask Auntie Zhou."],
  ['market-inspect', 'market', '翻开账本看看吧。成交价、送来的货、还想买的量，得分开看。', "Have a look through the ledger. The trading price, the supply, and any excess demand are different things."],
  ['market-inspect-pending', 'market', '价签还没定呢。草案归草案，成交价和货量，都得等开市再看。', "The price tag isn't final yet. A draft is just a draft. We'll know the trading price and supply once the market opens."],
  ['homes-pending', 'homes', '我们低收入组的口粮需求没变。等开市了，再看看能带回多少吧。', "Our low-income group's basic food needs haven't changed. Once the market opens, we'll see how much we can bring home."],
  ['homes-enough', 'homes', '我们这组买够基本口粮了。总算能松一口气。', "Our group bought enough basic food. We can finally breathe a little easier."],
  ['homes-low', 'homes', '我们这组带回来的，还是不够基本口粮。得再想想办法呀。', "What our group brought home still isn't enough for our basic needs. We'll have to find another way."],
  ['homes-inspect', 'homes', '这本账记的是我们整组人的粮，不是我一家。买回多少、够不够，都在这里。', "This ledger is for our whole group, not just my family. It shows how much we bought, and whether it's enough."],
  ['homes-inspect-pending', 'homes', '这是我们整组人的口粮账，不是我一家。买得到多少，还得等开市呢。', "This food ledger is for our whole group, not just my family. We'll have to wait for the market to open to see how much we can buy."],
];

export const VOICE_LINES: Record<string, VoiceLine> = Object.fromEntries(lines.map(([id, character, zh, en]) => [id, { id, character, zh, en }]));
const line = (id: string): VoiceLine => VOICE_LINES[id]!;
const settled = (state: GameState) => {
  const result = state.records.at(-1)?.result;
  return ['result', 'complete'].includes(state.phase) && result?.season === state.seasonIndex + 1 ? result : undefined;
};

export function advisorVoiceLine(state: GameState, topic: AdvisorTopic): VoiceLine {
  const result = settled(state);
  const season = SEASONS[state.seasonIndex]!;
  const resources = currentResources(state);
  const draft = state.draft;
  switch (topic) {
    case 'briefing':
      if (state.phase === 'briefing') return line('advisor-welcome');
      if (state.phase === 'complete') return line(goals(state.records).passed ? 'advisor-complete-pass' : 'advisor-complete-retry');
      if (result) return line(result.coverageLow >= 0.95 - 1e-7 ? 'advisor-result-met' : 'advisor-result-unmet');
      return line(`advisor-season-${state.seasonIndex + 1}`);
    case 'policy': {
      if (state.phase !== 'decision') return line(result ? state.records.length >= 2 ? 'advisor-policy-settled' : 'advisor-baseline-done' : 'advisor-first-market');
      const check = evaluate(season, draft, resources);
      if (!check.valid) return line(check.reason === 'reserves' ? 'advisor-reserves-invalid' : 'advisor-cash-invalid');
      const combination = [draft.cap !== null ? 'cap' : '', draft.subsidy > 0 ? 'subsidy' : '', draft.release > 0 ? 'release' : ''].filter(Boolean);
      return line(`advisor-policy-${combination.length === 3 ? 'all' : combination.join('-') || 'market'}`);
    }
    case 'why': return line(!result ? 'advisor-pending' : result.capBinding ? 'advisor-shortage' : 'advisor-cleared');
    case 'reserves':
      if (state.phase === 'decision' && draft.release > resources.reserves) return line('advisor-reserves-invalid');
      return line(state.phase === 'decision' && draft.release > 0 ? 'advisor-reserves-planned' : result ? result.policy.release > 0 ? 'advisor-reserves-used' : 'advisor-reserves-saved' : 'advisor-reserves-general');
    case 'farm': return line('advisor-farm');
    case 'production': return line(result ? result.privateOutput >= season.K - 1e-7 ? 'advisor-production-limit' : 'advisor-production-room' : state.phase === 'decision' && draft.subsidy > 0 ? 'advisor-production-subsidy' : 'advisor-production-plan');
    case 'market': return line(result ? result.capBinding ? 'advisor-shortage' : 'advisor-cleared' : state.phase === 'decision' && draft.cap !== null ? 'advisor-market-cap-plan' : 'advisor-market-plan');
    case 'opportunity': return line('advisor-opportunity');
    case 'lesson': {
      const policy = result?.policy ?? draft;
      return line(policy.cap !== null ? 'advisor-lesson-cap' : policy.subsidy > 0 ? 'advisor-lesson-subsidy' : policy.release > 0 ? 'advisor-lesson-release' : 'advisor-policy-market');
    }
    case 'access': return line(!result ? 'advisor-access-pending' : result.capBinding ? 'advisor-shortage' : result.purchasesLow >= 36 - 1e-7 ? 'advisor-access-enough' : 'advisor-access-low');
  }
}

export function visitVoiceLine(state: GameState, place: TownPlace, inspected: boolean): VoiceLine {
  const result = settled(state);
  if (inspected) return line(`${place}-inspect${!result && (place === 'market' || place === 'homes') ? '-pending' : ''}`);
  const season = SEASONS[state.seasonIndex]!;
  switch (place) {
    case 'farm': return line(SEASONS[state.seasonIndex - 1] && season.K > SEASONS[state.seasonIndex - 1]!.K ? 'farm-recovery' : season.K < 100 ? 'farm-tight' : 'farm-normal');
    case 'mill': return line(result ? result.privateOutput >= season.K - 1e-7 ? 'mill-at-limit' : 'mill-below-limit' : state.phase === 'decision' && state.draft.subsidy > 0 ? 'mill-subsidy-pending' : 'mill-pending');
    case 'market': return line(result ? result.excessDemand > 1e-7 ? 'market-shortage' : 'market-cleared' : state.phase === 'decision' && state.draft.cap !== null ? 'market-cap-pending' : 'market-pending');
    case 'homes': return line(result ? result.purchasesLow >= 36 - 1e-7 ? 'homes-enough' : 'homes-low' : 'homes-pending');
  }
}

export const voiceSource = (selected: VoiceLine, language: VoiceLanguage): string => `/audio/characters/${language}/${selected.id}.mp3`;
