export type Place = 'street' | 'dock' | 'mill' | 'oven';
export type Effect = 'bell' | 'bread' | 'oven' | 'cash' | 'horn' | null;
export type ActionId = 'bell' | 'sell' | 'deliverDock' | 'deliverWorkers' | 'buyFlour' | 'bake'
  | 'investigate' | 'talk' | 'close' | 'sail' | 'fire';
export interface HarborAction { id: ActionId; label: string }

export interface HarborState {
  version: 1;
  phase: 'opening' | 'orders' | 'morning';
  stock: number;
  coins: number;
  flour: number;
  dock: number;
  workers: number;
  rang: boolean;
  baked: boolean;
  sailed: boolean;
  fired: boolean;
  clue: boolean;
}

export interface HarborResult {
  state: HarborState;
  speaker: string;
  text: string;
  effect: Effect;
}

const basket = 6;
const order = 12;
const flourPrice = 6;
const host: Record<Place, string> = { street: '阿芸', dock: '船长', mill: '陈禾', oven: '阿诚' };

export function startHarbor(): HarborState {
  return {
    version: 1, phase: 'opening', stock: 13, coins: 0, flour: 0, dock: 0, workers: 0,
    rang: false, baked: false, sailed: false, fired: false, clue: false,
  };
}

export function morningComplete(s: HarborState): boolean {
  return s.phase === 'morning' && (s.dock < order || s.sailed) && (s.workers < order || s.fired);
}

export function objective(s: HarborState): string {
  if (s.phase === 'opening') return s.rang ? '周婶来买面包了。在街口把第一个递给她。' : '推车到街口，拉一下铃，听谁先应声。';
  if (s.phase === 'morning') {
    if (morningComplete(s)) return '今天的约都赴过了。可以再逛逛，也可以重玩昨晚。';
    if (s.dock === order && !s.sailed && s.workers === order && !s.fired) return '你的船位和旧炉都备好了，先去码头或炉边赴约。';
    return s.dock === order && !s.sailed ? '船长给你留了位。去码头搭早船进货。' : '阿诚推来了那座小炉。去炉边烤第一盘。';
  }
  if (s.dock === order && s.workers === order) return '两处的灯都亮了。回街口收摊，看看明早谁来。';
  if (s.dock === order || s.workers === order) {
    if (s.baked && s.stock > 0) return '一边已送齐。剩下的面包可以送完另一份订单，也可以收摊。';
    return '一份订单送齐了。可以收摊，想再接一单就去' + (s.flour ? '炉边补烤。' : '面粉铺看看。');
  }
  if (s.flour) return '面粉装上车了。推去炉边，请阿诚一起生火。';
  if (!s.stock) return '两份订单都还差半篮。带定金去面粉铺买一袋粉。';
  if (s.dock || s.workers) return '手里有定金了。继续送半篮，或先去面粉铺补货。';
  return '船长和夜班工人各等十二个面包。你想先把半篮推到哪儿？';
}

export function actionsAt(s: HarborState, place: Place): HarborAction[] {
  const actions: HarborAction[] = [];
  if (s.phase === 'opening' && place === 'street') {
    actions.push(s.rang ? { id: 'sell', label: '递给周婶 · 1 个' } : { id: 'bell', label: '拉铃招客' });
  }
  if (s.phase === 'orders') {
    if (place === 'dock' && s.stock >= basket && s.dock < order) actions.push({ id: 'deliverDock', label: '递到船上 · 6 个' });
    if (place === 'oven' && s.stock >= basket && s.workers < order) actions.push({ id: 'deliverWorkers', label: '递给工友 · 6 个' });
    if (place === 'oven' && s.flour > 0 && !s.baked) actions.push({ id: 'bake', label: '合力补烤 · 12 个' });
    if (place === 'mill' && s.coins >= flourPrice && !s.flour && !s.baked) actions.push({ id: 'buyFlour', label: '买一袋粉 · 6 枚' });
    const canClose = s.dock === order && (place === 'street' || place === 'dock')
      || s.workers === order && (place === 'street' || place === 'oven');
    if (canClose) actions.push({ id: 'close', label: '收摊过夜' });
  }
  if (s.phase === 'morning') {
    if (place === 'dock' && s.dock === order && !s.sailed) actions.push({ id: 'sail', label: '搭早船进货' });
    if (place === 'oven' && s.workers === order && !s.fired) actions.push({ id: 'fire', label: '点旧炉烤第一盘' });
  }
  if (place === 'dock' && s.phase !== 'opening' && !s.clue) actions.push({ id: 'investigate', label: '瞧瞧舷边的木牌' });
  actions.push({ id: 'talk', label: place === 'dock' && s.phase === 'opening' ? '听街坊说渡口' : '聊两句' });
  return actions;
}

function conversation(s: HarborState, place: Place): [string, string] {
  if (s.phase === 'opening') {
    switch (place) {
      case 'street': return ['阿芸', s.rang ? '那位收伞的就是周婶。她等着你递面包呢。' : '先试试铃绳？周婶隔着半条街都认得我的铃。'];
      case 'dock': return ['阿芸', '这船桩空了三年。奇怪，谁把新缆绳放这儿了？'];
      case 'mill': return ['陈禾', '最后一袋白面粉，六枚铜币。我答应阿芸留到收市。'];
      case 'oven': return ['阿诚', '你摸摸炉边，还有温度。夜班的人等着我带饭回去呢。'];
    }
  }
  if (s.phase === 'morning') {
    switch (place) {
      case 'street': return ['阿芸', s.dock === order && s.workers === order ? '没人敲我的门催货。倒有人问，那辆铃特别响的车今天在哪儿。' : '你的车铃昨天一响，今天已经有人记得。'];
      case 'dock': return ['船长', s.sailed ? '对岸磨坊的袋口都系蓝线。带回去给陈禾看看，他认得。' : s.dock === order ? '船头给你空了一个位子。涨潮了，跟我去对岸磨坊？' : '昨晚我们拿着干粮开了工。今天船上全是桥板，下回再捎你。'];
      case 'mill': return ['陈禾', s.sailed ? '这蓝线！我师兄的磨坊还开着。替我捎句话，下回换袋黑麦来。' : '昨儿听了半条街的车铃。今天第一袋面粉也给老客留着。'];
      case 'oven': return ['阿诚', s.fired ? '这烟囱朝东装果然有用。你闻，第一盘连边儿都没焦。' : s.workers === order ? '昨晚大家凑手把旧炉推来了。面团醒好了，第一炉你来。' : '帮你把炉灰留着了。晚点儿还想烤的话，再来招呼我。'];
    }
  }
  switch (place) {
    case 'street': return ['阿芸', s.dock === order || s.workers === order ? '要收车了吗？把遮雨棚一卷，明早见。' : '车上就这么些。你听，靠水那头催得急，炉边也有人喊阿诚。'];
    case 'dock': return ['船长', s.dock === order ? '这下齐了！明早涨潮时来，我带你去一趟对岸。' : s.clue ? '牌上的红线是一段还没修好的桥。他们先过河修东头，我再来接西头的人。' : '汽笛哑了三年，这回总算又响了。底舱的人还没吃呢。'];
    case 'mill': return ['陈禾', s.baked ? '我这铺子的最后一袋已经进了你的炉。闻得到麦香了。' : s.flour ? '扎紧袋口！风大，别叫白面给吹到海里去了。' : '一袋面六枚，整袋能出十二个。先送半篮，拿着定金来就够。'];
    case 'oven': return ['阿诚', s.workers === order ? '最后那份给了守绞盘的师傅，他到现在才顾上吃。明天有样东西给你。' : s.flour ? '面粉都有了，我来揉，你顾炉。十二个，一起出。' : '夜班十二个人，半篮也先送，我照样付定金。炉膛还有火，缺的是面粉。'];
  }
}

export function act(s: HarborState, place: Place, id: ActionId): HarborResult {
  const reply = (state: HarborState, speaker: string, text: string, effect: Effect = null): HarborResult =>
    ({ state, speaker, text, effect });
  if (id === 'bell') {
    if (place === 'street' && s.phase === 'opening' && !s.rang) {
      return reply({ ...s, rang: true }, '周婶', '来了来了！给我一个边儿烤脆的，钱放你手心里。', 'bell');
    }
    const words: Record<Place, string> = {
      street: s.phase === 'opening' ? '哎，我在这儿。铃绳歇一歇，面包递过来呀！' : '好响！街对面的阿芸也朝你挥了挥手。',
      dock: '铛——雾里的浮标回了一声，水面起了一圈涟漪。',
      mill: '门帘一掀，陈禾擦着手探出头来。',
      oven: '面粉扑簌簌落下来。炉门后伸出一只手，也朝你挥了挥。',
    };
    return reply(s, place === 'street' && s.phase === 'opening' ? '周婶' : '你', words[place], 'bell');
  }
  if (!actionsAt(s, place).some(action => action.id === id)) return reply(s, '你', objective(s));
  switch (id) {
    case 'sell': return reply({ ...s, phase: 'orders', stock: s.stock - 1, coins: s.coins + 1 }, '阿芸', '周婶刚接住面包，三年没响的汽笛就响了。船长举起十二根短绳记订单，阿诚也跑来喊：夜班十二个人！', 'horn');
    case 'deliverDock':
    case 'deliverWorkers': {
      const toDock = id === 'deliverDock';
      const key = toDock ? 'dock' : 'workers';
      const delivered = s[key] + basket;
      const next = { ...s, [key]: delivered, stock: s.stock - basket, coins: s.coins + basket };
      const text = toDock
        ? delivered === order ? '十二份齐了。听，底舱的修桥队在敲饭盒！明早跟我走一趟，我带你去对岸磨坊。' : '六个刚好一排。先给你六枚，另外六个我等得起。'
        : delivered === order ? '十二个人，谁也没落下。我记着了，明早给你推个好东西来。' : '我先分给下水最久的六个人。这六枚你拿走，拿来垫面粉钱也成。';
      return reply(next, host[place], text, 'bread');
    }
    case 'buyFlour': return reply({ ...s, flour: 1, coins: s.coins - flourPrice }, '陈禾', '六枚收好。最后一袋放车上了，推去阿诚那儿，炉火还旺着。', 'cash');
    case 'bake': return reply({ ...s, flour: 0, stock: s.stock + order, baked: true }, '阿诚', '接盘子！你那一袋粉烤了整整十二个。把篮子推到缺面包的地方去。', 'oven');
    case 'investigate': return reply({ ...s, clue: true }, '船长', '你翻过木牌：西桥复工。背面十二个名字旁都有一个饭盒印，原来乘客全是修桥人。');
    case 'close': {
      const morning = { ...s, phase: 'morning' as const };
      const text = s.dock === order && s.workers === order ? '晨雾里有两种响声：码头的汽笛，门口旧炉的铁轮。昨天的两拨客人都来了。'
        : s.dock === order ? '天刚亮，船长把船板架到你脚边。船上正空着一个位子。' : '咣当！门一开，阿诚正扶着一座旧炉，烟囱上还系着昨夜的面包绳。';
      return reply(morning, '阿芸', text);
    }
    case 'sail': return reply({ ...s, flour: s.flour + 1, sailed: true }, '船长', '跳板一响，你的车上了船。对岸磨坊送了一袋带蓝线的样粉，这条进货路你认得了。', 'horn');
    case 'fire': return reply({ ...s, fired: true, stock: s.stock + basket }, '阿诚', '拉开炉门！我带来的面团成了六个热面包。这座旧炉从今天起归你了。', 'oven');
    case 'talk': {
      const [speaker, text] = conversation(s, place);
      return reply(s, speaker, text);
    }
  }
}

// Keep only saves reachable with the evening's fixed stock, order sizes and single bag of flour.
export function restoreHarbor(raw: unknown): HarborState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as HarborState;
  if (s.version !== 1 || !['opening', 'orders', 'morning'].includes(s.phase)) return null;
  if (![s.rang, s.baked, s.sailed, s.fired, s.clue].every(value => typeof value === 'boolean')) return null;
  if (![s.dock, s.workers].every(value => [0, basket, order].includes(value))) return null;
  if (![s.stock, s.coins, s.flour].every(value => Number.isSafeInteger(value) && value >= 0)) return null;
  if (s.phase === 'opening') {
    const initial = startHarbor();
    return s.stock === initial.stock && !s.dock && !s.workers && !s.coins && !s.flour
      && !s.sailed && !s.fired && !s.clue && !s.baked ? { ...initial, rang: s.rang } : null;
  }
  if (!s.rang || (s.phase === 'orders' && (s.sailed || s.fired))) return null;
  if (s.phase === 'morning' && s.dock < order && s.workers < order) return null;
  if ((s.sailed && s.dock < order) || (s.fired && s.workers < order)) return null;
  const carriedBag = s.flour - Number(s.sailed);
  if (carriedBag < 0 || carriedBag > 1 || (s.baked && carriedBag)) return null;
  const delivered = s.dock + s.workers;
  const bought = s.baked || carriedBag > 0;
  if (bought && delivered < basket) return null;
  const remainingAtClose = order - delivered + Number(s.baked) * order;
  if (remainingAtClose < 0 || s.stock !== remainingAtClose + Number(s.fired) * basket || s.coins !== 1 + delivered - Number(bought) * flourPrice) return null;
  return { version: 1, phase: s.phase, rang: s.rang, clue: s.clue, fired: s.fired, sailed: s.sailed, baked: s.baked,
    coins: s.coins, flour: s.flour, stock: s.stock, dock: s.dock, workers: s.workers };
}
