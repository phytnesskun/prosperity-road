import type { Choice, Prop, StoryChapter, StoryContext } from './types.ts';

function move(id: string, label: string, prop: Prop, result: string, cue: string, hint?: string): Choice {
  return { id, label, prop, result, cue, hint };
}

const bayGoods = {
  bread: { name: '干饼', prop: 'bread' },
  freight: { name: '米', prop: 'rice' },
  night: { name: '船灯', prop: 'lamp' },
} as const;

function outwardGoods({ past }: StoryContext) {
  return bayGoods[past.fair as keyof typeof bayGoods] ?? bayGoods.freight;
}

const halfLoad: StoryChapter = {
  num: 13,
  title: '芦湾只收半船货',
  opening: 'offer',
  lines: {
    offer: [
      '阿芸',
      '雾港卖得快，在这儿可说不准。先问问他们收几箱。',
      'These sell quickly back home. Ask how many crates they want here.',
    ],
    tally: [
      '小满',
      '秤砣回钩了。卖出几件，咱们就在船单上划掉几件。',
      'The scales are clear. Cross what we sold off the manifest.',
    ],
    space: [
      '船长',
      '舱口就这么宽。搁回船上的，回头还占这个位。',
      'The hatch is only so wide. Anything we keep aboard still takes a berth on the way home.',
    ],
    knot: [
      '陈禾',
      '认准这个芦花结，下趟来，顺着绳找我。',
      'Look for this reed knot. Next trip, follow the rope to my landing.',
    ],
  },
  steps: [
    (ctx) => {
      const goods = outwardGoods(ctx);
      return {
        title: '开舱验货',
        detail: '从雾港带来四箱' + goods.name + '。秤只摆了两只空筐，买主出了两个价。',
        item: goods.prop,
        itemLabel: '头两箱' + goods.name,
        choices: [
          move(
            'cash',
            '交给收货栈',
            'coins',
            '两箱落秤，实收 6 枚。舱里还压着两箱。',
            'tally',
            '两箱一起收，付 6 枚'
          ),
          move(
            'sample',
            '送到芦棚试卖',
            'reed',
            '芦棚付 4 枚留下一箱，另一箱抵样货，换来一个灯芯芦预留位。船里还剩两箱。',
            'tally',
            '一箱换钱，一箱换下趟留货'
          ),
        ],
      };
    },
    (ctx) => ({
      title: '栈门要关了',
      detail: '买主今儿不再收。两箱' + outwardGoods(ctx).name + '是寄在芦湾等下一集，还是带回去？',
      item: 'crate',
      itemLabel: '剩下的两箱',
      choices: [
        move(
          'store',
          '搬进干仓',
          'key',
          '付 1 枚仓钱，仓里记下两箱代存货。回程四个舱位都空出来了。',
          'space',
          '付 1 枚 · 腾四位'
        ),
        move(
          'aboard',
          '绑回船尾',
          'boat',
          '两箱货系回船尾，省了仓钱，回程只空出两个位置。',
          'space',
          '省仓钱 · 腾两位'
        ),
      ],
    }),
    ({ picks }) => ({
      title: '回船前再走一趟',
      detail:
        picks[0] === 'sample'
          ? '芦棚已经给你系好预留结。太阳落山前还能去一个地方。'
          : '钱已经到手。对岸有人扎芦料，身后的货栈正在发船单。',
      item: 'ticket',
      itemLabel: '回程取货条',
      choices: [
        move(
          'reeds',
          '压在芦棚的绳结下',
          'reed',
          '陈禾在取货条上扎了一绺白芦花。下趟取芦料，照熟客价算。',
          'knot'
        ),
        move(
          'parcels',
          '挂在沿河货栈',
          'crate',
          '阿芸把一件回雾港的包裹放在了你的船单旁。下趟能接一笔顺路货。',
          'tally'
        ),
      ],
    }),
  ],
  end: ({ picks }) => {
    const cash = (picks[0] === 'cash' ? 6 : 4) - (picks[1] === 'store' ? 1 : 0);
    const slots = picks[1] === 'store' ? 4 : 2;
    return {
      title: slots === 4 ? '两箱货留在芦湾' : '两箱货还在船尾',
      detail: '这趟芦湾现收 ' + cash + ' 枚。回雾港的船上腾出了 ' + slots + ' 个空位。',
      facts: {
        bayStock: picks[1],
        bayReedRate: picks[0] === 'sample' || picks[2] === 'reeds' ? 'held' : 'spot',
        bayOrder: picks[2],
      },
    };
  },
};

function backhaulRoom({ past }: StoryContext) {
  return past.bayStock === 'aboard' ? 2 : 4;
}
function reedCost(ctx: StoryContext) {
  return ctx.past.bayReedRate === 'held' ? 1 : 2;
}
export function returnManifest(ctx: StoryContext) {
  const { picks } = ctx;
  const firstReeds = picks[0] === 'bundle' ? 2 : Number(picks[0] === 'single');
  const reeds = firstReeds + Number(picks[1] === 'extra') - Number(picks[1] === 'swap');
  const parcels = Number(picks[0] === 'parcel') + Number(picks[1] === 'post' || picks[1] === 'swap');
  const oldCargo = 4 - backhaulRoom(ctx);
  const landed = picks.length >= 3;
  const occupied = oldCargo + (landed ? 0 : reeds + parcels);
  return { reeds, parcels, oldCargo, oldGoods: outwardGoods(ctx).name, occupied, free: 4 - occupied, landed };
}

const returnBoat: StoryChapter = {
  num: 14,
  title: '别让回程空着',
  opening: 'reed',
  lines: {
    reed: [
      '陈禾',
      '这芦花可别只拿去铺床。捻一捻，这根芯点灯最稳。',
      'These reeds are good for more than bedding. Twist this pith. It makes a steady wick.',
    ],
    lash: [
      '船长',
      '头上打个活扣，卸货时一抽就开。',
      'Put a slipknot at the top. One pull will free it at the other end.',
    ],
    mail: [
      '阿芸',
      '包裹扎着蓝线。你递到手，我付水脚。',
      'My parcel is tied with blue thread. Hand it over and I will pay the freight.',
    ],
    ashore: [
      '周婶',
      '你这船从芦湾来？让我看看舱里捎了什么。',
      'Have you come from Reed Bay? Let me see what you brought home.',
    ],
  },
  steps: [
    (ctx) => ({
      title: '把回程的第一件货装上船',
      detail:
        (backhaulRoom(ctx) === 2 ? '两箱雾港旧货还在船尾，只剩两个空位。' : '回程四个舱位都空着。') +
        '一捆灯芯芦占一位，今价每捆 ' +
        reedCost(ctx) +
        ' 枚，雾港灯铺收 4 枚。',
      item: 'rope',
      itemLabel: '装船绳圈',
      choices: [
        move('bundle', '系两捆灯芯芦', 'reed', '两捆芦料下舱，花 ' + 2 * reedCost(ctx) + ' 枚。', 'lash'),
        move(
          'single',
          '只系一捆试销',
          'reed',
          '一捆芦料下舱，花 ' + reedCost(ctx) + ' 枚。留一个位置等码头最后的招呼。',
          'lash'
        ),
        ...(ctx.past.bayOrder === 'parcels'
          ? [move('parcel', '接上预约的包裹', 'crate', '蓝线包裹先上船，交付时可收 3 枚水脚。', 'mail')]
          : []),
      ],
    }),
    (ctx) => {
      const { free } = returnManifest(ctx);
      return {
        title: '解缆前的一声招呼',
        detail: free
          ? '隔壁码头有一捆芦、一件散货，都只等一声船笛。现在还空 ' + free + ' 位。'
          : '两个空位都用完了。船边还压着一件散货，收它就得退一捆芦。',
        item: 'bell',
        itemLabel: '开船前的铃',
        choices: free
          ? [
              move('extra', '再收一捆芦', 'reed', '又花 ' + reedCost(ctx) + ' 枚收芦。', 'lash'),
              move('post', '搭载一件散货', 'crate', '散货占一位。送到雾港时可收 3 枚水脚。', 'mail'),
              move('leave', '解缆先走', 'boat', '船先离岸；剩位留空，手头还留着货款。', 'lash'),
            ]
          : [
              move('keep', '照原船单出发', 'boat', '两捆芦都留在舱里。散货主去问下一班船。', 'lash'),
              move('swap', '换一件散货', 'crate', '退回一捆芦，收回原价。散货顶上它的船位。', 'mail'),
            ],
      };
    },
    (ctx) => {
      const { reeds, parcels } = returnManifest(ctx);
      return {
        title: '雾港两处等着接船',
        detail:
          '舱单写着 ' +
          reeds +
          ' 捆芦、' +
          parcels +
          ' 件包裹。包裹在栈桥交付，每件付 3 枚。' +
          (reeds ? '芦料可当天结账，也可留一捆点夜灯。' : '柜台和码头都愿意替你接下一趟单。'),
        item: 'boat',
        itemLabel: '回港的船',
        choices: reeds
          ? [
              move('sell', '到灯铺交芦', 'coins', '掌柜按每捆 4 枚收齐灯芯。', 'ashore'),
              move('wick', '给渡口留一捆', 'lamp', '一捆灯芯上了值夜船，其余送灯铺照价收款。', 'ashore'),
            ]
          : [
              move('counter', '在柜台接回单', 'paper', '柜台收下后程的货单，包裹一件不少。', 'mail'),
              move('jetty', '在栈桥接回单', 'ticket', '收件人亲手签单；岸上的熟客得知你还跑芦湾。', 'ashore'),
            ],
      };
    },
  ],
  end: (ctx) => {
    const { reeds, parcels } = returnManifest(ctx);
    const gift = Number(ctx.picks[2] === 'wick');
    const cash = (reeds - gift) * 4 + parcels * 3 - reeds * reedCost(ctx);
    return {
      title: gift ? '芦湾的芯，雾港的灯' : parcels ? '两头都有货' : '芦料开出一条回程路',
      detail:
        '载回 ' +
        reeds +
        ' 捆芦、' +
        parcels +
        ' 件包裹。扣掉购芦款，本次回程净收 ' +
        cash +
        ' 枚。' +
        (gift ? '一捆留给了夜船。' : ''),
      facts: { bayReturn: gift ? 'wick' : parcels ? 'parcel' : 'reed' },
    };
  },
};

const twoKeys: StoryChapter = {
  num: 15,
  title: '两把仓房钥匙',
  opening: 'lock',
  lines: {
    lock: [
      '阿芸',
      '两把钥匙，一把开门，一把留给先到的船。你想交给谁？',
      'Two keys. One opens the door; the other is for the first boat in. Who should keep it?',
    ],
    line: [
      '阿诚',
      '横线画到哪儿，我就把隔板插到哪儿。',
      'Mark the line and I will fit the divider right there.',
    ],
    receipt: [
      '陈禾',
      '慢点关门。我得把存条上这道芦花印摁清楚。',
      'Hold the door. I need a clear reed stamp on this storage slip.',
    ],
    turn: [
      '小满',
      '把钥匙给岸上的人，两条船就不必一块儿等锁了。',
      'Leave the key with someone ashore, and the boats needn’t queue for the lock.',
    ],
  },
  steps: [
    ({ past }) => ({
      title: '给四个仓格划界',
      detail:
        (past.bayStock === 'store' ? '取回上回寄存的两箱货后，' : '腾空旧仓后，') +
        '阿诚在地上钉出四个干格。两港合用，要给自己的货留多少？',
      item: 'chalk',
      itemLabel: '阿诚的粉笔',
      choices: [
        move('wide', '画三格自用', 'crate', '三格归自家，一格给代存货。下一批自货全有地方。', 'line'),
        move('share', '各画两格', 'reed', '一边两个格子，陈禾可以存两捆芦料。', 'line'),
      ],
    }),
    ({ picks }) => {
      const shared = picks[0] === 'wide' ? 1 : 2;
      return {
        title: '货先到，船还没到',
        detail: '门外有两捆灯芯芦，寄一捆付 2 枚。预留代存格有 ' + shared + ' 个。眼下也有米商在借格等潮。',
        item: 'ticket',
        itemLabel: '带仓号的存条',
        choices: [
          move(
            'reeds',
            '发给芦棚',
            'reed',
            '收入 ' + 2 * shared + ' 枚。仓墙挂了 ' + shared + ' 张芦花存条，陈禾的料有了着落。',
            'receipt'
          ),
          move(
            'rice',
            '借给米行一格',
            'rice',
            '收 2 枚，米行把到港价写在存单上。下个集日能凭这张单留住一口米价。',
            'receipt'
          ),
        ],
      };
    },
    () => ({
      title: '把备用钥匙系上绳',
      detail: '你的钥匙随船走。备用的这把挂在谁腰上，下一船货就能先在哪一头核对。',
      item: 'key',
      itemLabel: '备用黄铜钥匙',
      choices: [
        move('bay', '交给芦湾陈禾', 'reed', '陈禾在钥匙上绑了白芦结。查芦湾仓时可以直接开门。', 'turn'),
        move('fog', '交给雾港阿芸', 'cart', '阿芸用蓝线系住钥匙。查雾港柜台来单时可以直接开仓。', 'turn'),
      ],
    }),
  ],
  end: ({ picks }) => ({
    title: picks[2] === 'bay' ? '芦花结挂在锁眼边' : '蓝线牵着另一扇仓门',
    detail:
      '四格干仓，自用 ' +
      (picks[0] === 'wide' ? 3 : 2) +
      ' 格。备用钥匙交给了' +
      (picks[2] === 'bay' ? '陈禾。' : '阿芸。'),
    facts: { bayKey: picks[2], bayTenant: picks[1], baySpace: picks[0] },
  }),
};

function quayQuote(past: StoryContext['past']) {
  // A rice tenant could unload on arrival, adding supply before our boat reaches the market.
  return past.bayTenant === 'rice' ? 4 : 7;
}

const oldPrice: StoryChapter = {
  num: 16,
  title: '迟到一班的价牌',
  opening: 'scrape',
  lines: {
    scrape: [
      '小满',
      '看这墨，还卷着昨天的毛边。这牌子比咱们慢一班船。',
      'See the curled ink at the edge? That price board is a sailing behind us.',
    ],
    sound: [
      '陈禾',
      '想知道米多不多？听那边卸袋的声音。',
      'Wondering how much rice is in? Listen to the sacks landing over there.',
    ],
    sealed: [
      '阿芸',
      '盖了章，我就照这个价收。剩下一袋，你自己拿主意。',
      'Here’s my seal. I’ll pay that price. The other sack is up to you.',
    ],
    chalk: [
      '船长',
      '把新价标上哪一班送来的。后头的船一眼就知道。',
      'Mark which sailing brought the price. The next crew will know how fresh it is.',
    ],
  },
  steps: [
    ({ past }) => {
      const nearby = past.bayKey === 'bay';
      return {
        title: '昨天是每袋八枚',
        detail:
          (nearby
            ? '陈禾带着备用钥匙站在芦湾仓门口，开门查货免费。'
            : '芦湾仓门锁着，请伙计验仓要付 1 枚。') +
          '船里两袋米。阿芸愿先按每袋 5 枚签一袋，另一袋留你自己卖。',
        item: 'ticket',
        itemLabel: '两袋米的船单',
        choices: [
          move(
            'check',
            '去仓房验货',
            'key',
            '仓里' +
              (quayQuote(past) === 4 ? '新米堆到天窗，现价每袋 4 枚。' : '只剩三张空草席，现价每袋 7 枚。') +
              (nearby ? '陈禾替你开的门。' : '付了 1 枚验仓钱。'),
            'sound'
          ),
          move('lock', '先签一袋', 'paper', '第一袋记入合约，锁住 5 枚。另一袋随行就市。', 'sealed'),
          ...(past.bayTenant === 'rice'
            ? [
                move(
                  'slip',
                  '兑米行的存单',
                  'rice',
                  '米行兑现旧存条，第一袋保价 6 枚。另一袋仍可自己卖。',
                  'sealed'
                ),
              ]
            : []),
        ],
      };
    },
    ({ past, picks }) => {
      const free = picks[0] === 'check' ? 2 : 1;
      const actual = quayQuote(past);
      return {
        title: '卸货索还在手里',
        detail:
          '还有 ' +
          free +
          ' 袋能自由处置。' +
          (picks[0] === 'check'
            ? '你刚验过仓，现价每袋 ' + actual + ' 枚。'
            : '旧牌上的八枚尚未擦掉。' +
              (actual === 4 ? '一艘米船正在前头卸袋。' : '风把空仓里的草席卷了起来。')) +
          '桥头饼铺上门取货，每袋付 5 枚。',
        item: 'rice',
        itemLabel: '松开的卸米索',
        choices: [
          move(
            'spot',
            '下到芦湾现货秤',
            'coins',
            '新牌换上，每袋 ' + actual + ' 枚。现货这笔收了 ' + actual * free + ' 枚。',
            'sound'
          ),
          move(
            'bakery',
            '交给桥头饼铺',
            'bread',
            '饼铺按说好的价收走 ' + free + ' 袋，付了 ' + free * 5 + ' 枚。芦湾新牌每袋 ' + actual + ' 枚。',
            'sealed'
          ),
        ],
      };
    },
    ({ past }) => ({
      title: '给下一班船留个准信',
      detail:
        '今天的真价是每袋 ' + quayQuote(past) + ' 枚。把带船次的副牌送出去，还是先给自己的柜台收下早单？',
      item: 'chalk',
      itemLabel: '写明船次的新价',
      choices: [
        move(
          'public',
          '挂在公共渡口',
          'bell',
          '下一班开门前，小满也会看到这口新价。散客愿意在这里留订条。',
          'chalk'
        ),
        move(
          'private',
          '抄进自家柜台',
          'key',
          '阿芸在副牌上给你订了一批冬运货，公共渡口仍挂着上一班的旧价。',
          'sealed'
        ),
      ],
    }),
  ],
  end: ({ picks, past }) => {
    const checked = picks[0] === 'check';
    const cash =
      (checked ? 0 : picks[0] === 'slip' ? 6 : 5) +
      (checked ? 2 : 1) * (picks[1] === 'spot' ? quayQuote(past) : 5) -
      Number(checked && past.bayKey !== 'bay');
    return {
      title: picks[2] === 'public' ? '每口价都有船次' : '带着新价回柜台',
      detail:
        '两袋米扣去验仓费共收 ' +
        cash +
        ' 枚。新价的副牌留在' +
        (picks[2] === 'public' ? '公共渡口。' : '自家柜台。'),
      facts: { bayNews: picks[2] },
    };
  },
};

const winterContracts = {
  full: { name: '整船包运', cotton: 4, guarantee: 12 },
  split: { name: '半舱包运', cotton: 2, guarantee: 7 },
  open: { name: '散船随市', cotton: 0, guarantee: 0 },
};
function winterName(code: string | undefined) {
  return winterContracts[code as keyof typeof winterContracts]?.name ?? '暂定散班';
}

export function winterManifest(picks: readonly string[]) {
  const contract = winterContracts[picks[0] as keyof typeof winterContracts];
  const cotton = contract?.cotton ?? 0;
  const guarantee = contract?.guarantee ?? 0;
  const people = picks[1] === 'people' ? 2 : 0;
  const timber = picks[1] === 'timber' ? 2 : 0;
  const transferred = picks[1] === 'shuttle' ? 2 : 0;
  const waiting = picks[1] === 'queue' || picks[1] === 'timber' ? 2 : 0;
  return {
    contract,
    cotton,
    guarantee,
    people,
    timber,
    transferred,
    waiting,
    free: 4 - cotton - people - timber,
    cash: guarantee + people * 2 + timber * 3 - transferred,
  };
}

const winter: StoryChapter = {
  num: 17,
  title: '包船一个冬天',
  opening: 'winter',
  lines: {
    winter: [
      '阿芸',
      '我有一冬的棉货要走。价钱好说，船位得写明白。',
      'I have cotton to ship all winter. We can agree a price, but put the berths in writing.',
    ],
    stamp: [
      '船长',
      '印一落，空着的舱也要留给人家。你瞧准了。',
      'Once that seal lands, even an empty berth has to be kept. Take a good look.',
    ],
    bench: [
      '周婶',
      '门板横过来，就是一条长凳。有人来，我帮你腾座。',
      'Lay the plank across and you have a bench. I’ll make room when folk arrive.',
    ],
    copy: [
      '小满',
      '头一趟的船单给我一份。哪天你走不开，我知道该接谁。',
      'Give me a copy of that first manifest. If you can’t sail, I’ll know who to collect.',
    ],
  },
  steps: [
    ({ past }) => ({
      title: '用船印订冬班',
      detail:
        (past.bayNews === 'private'
          ? '阿芸带着在你柜上留下的早单来了。'
          : '第一层霜还没散，棉包已经在栈桥排成行。') +
        '每班四位。全包四位保底 12 枚，包两位保底 7 枚；散客每位 2 枚，没人便空。',
      item: 'paper',
      itemLabel: '冬班契纸',
      choices: [
        move('full', '圈给棉行四位', 'crate', '阿芸签下每班 12 枚，四个舱位一并留给棉包。', 'stamp'),
        move('split', '只圈两位', 'chalk', '每班 7 枚，两位留给棉行，两位可由你卖票。', 'stamp'),
        move('open', '挂回散客票窗', 'ticket', '四位照常售票，没有保底金。码头亮起临时货牌。', 'bench'),
      ],
    }),
    ({ picks }) => {
      const manifest = winterManifest(picks);
      if (manifest.free === 0)
        return {
          title: '第一班，棉包占满甲板',
          detail:
            '有两位赶早的街坊到了。整船已经包出，你可以出 2 枚请小满代渡，也可把他们的号签留到下一班散船。',
          item: 'ticket',
          itemLabel: '两张候船号签',
          choices: [
            move(
              'shuttle',
              '递到红帆船上',
              'boat',
              '小满接过 2 枚和两张票。棉货照装，街坊在隔壁上船。',
              'copy'
            ),
            move(
              'queue',
              '压在下班票夹里',
              'bell',
              '两人拿到下一班散船的头号，今早仍留在岸上。整船运钱照付。',
              'bench'
            ),
          ],
        };
      return {
        title: '头班的空位怎么用？',
        detail:
          '棉行以外有 ' +
          manifest.free +
          ' 位。两位赶早的街坊要上船，另有两箱木料要赶日出，每箱付 3 枚。只能赶上一处装货。',
        item: 'rope',
        itemLabel: '客货跳板',
        choices: [
          move('people', '靠到候船长凳', 'ticket', '两位街坊上船，实收 4 枚票钱。', 'bench'),
          move('timber', '靠到木料栈', 'crate', '两箱木料绑好，实收 6 枚。街坊暂留岸上。', 'stamp'),
        ],
      };
    },
    () => ({
      title: '把头班副单交出去',
      detail: '船长收了正本。副单夹在票窗方便熟客查，或托小满带走，方便临时接班。',
      item: 'paper',
      itemLabel: '副单',
      choices: [
        move('crew', '夹到红帆的舵绳', 'rope', '小满把单子折进油布，记下出船日期。', 'copy'),
        move('window', '钉上等船的票窗', 'ticket', '周婶沿着名单读了一遍，给下一班留了两根粉笔。', 'bench'),
      ],
    }),
  ],
  end: ({ picks }) => {
    const { cash } = winterManifest(picks);
    return {
      title: winterName(picks[0]),
      detail: '冬季头班到岸。计入保底和今天的客货、扣除代渡，实收 ' + cash + ' 枚。',
      facts: { winterDeal: picks[0], winterFirst: picks[1], winterCopy: picks[2] },
    };
  },
};

const oldTicket: StoryChapter = {
  num: 18,
  title: '旧船票背面的名字',
  opening: 'crease',
  lines: {
    crease: [
      '周婶',
      '票背上有两行字。我认得前一行，后一行得浸湿了才显。',
      'There are two lines on the back. I know the first. Dampen the paper and the other will show.',
    ],
    log: [
      '船长',
      '那天的船发过。我载的是四箱货，客位一个也没有。',
      'I did sail that day. Four crates aboard, and not a single passenger berth.',
    ],
    witness: [
      '阿诚',
      '木匠记过水位，也记过枯等的客人。你把两页凑近看。',
      'The carpenter marked the waterline and the folk who waited. Put the two pages side by side.',
    ],
    amend: [
      '周婶',
      '你把约定写在哪儿，赶船的人就能去哪儿找。',
      'Tell us where you put the promise. Then the next passenger will know where to look.',
    ],
  },
  steps: [
    ({ past }) => ({
      title: '把旧票摊平',
      detail:
        '你手里是' +
        winterName(past.winterDeal) +
        '的副本。周婶的旧票背面也有一道船印，旁边隐约露出一个名字。',
      item: 'ticket',
      itemLabel: '三年前的折票',
      choices: [
        move(
          'log',
          '贴着船册描船印',
          'paper',
          '船册记着棉行收走四格，船印边写着“照约已发”。三年前那天，船的确离过岸。',
          'log'
        ),
        move(
          'rail',
          '贴着木尺描水痕',
          'chalk',
          '阿诚量过旧水痕。水落以后，旧渡桩够不到船，乘客转到下游的小跳板等候。',
          'witness'
        ),
      ],
    }),
    ({ picks }) => {
      const sawLog = picks[0] === 'log';
      return {
        title: '把两页拼在一起',
        detail: sawLog
          ? '船册有船，没有人。把它带到下游旧桩，或请周婶拿来当日的候船条。'
          : '水尺上有候船记号。去找船长的旧册，或找阿芸的棉货收据，看看当天的船去了哪儿。',
        item: sawLog ? 'paper' : 'chalk',
        itemLabel: sawLog ? '那一页船册' : '刻着日期的木尺',
        choices: sawLog
          ? [
              move(
                'mark',
                '对上下游水尺',
                'chalk',
                '原来河浅以后，客人在下游等，包货船仍从深水桩走；墙上只贴着深水桩的班次。',
                'witness'
              ),
              move(
                'stub',
                '叠上候船号条',
                'ticket',
                '下游候船号条连续三天没人划掉。包货船在深水桩照常走，“停航”的传话从客棚传开了。',
                'witness'
              ),
            ]
          : [
              move(
                'manifest',
                '压上棉行装货册',
                'crate',
                '四箱棉从深水栈按约离开，浅水处的等候名单一直空着回执。',
                'log'
              ),
              move(
                'bill',
                '对上阿芸的收货印',
                'paper',
                '收货印的时辰对上水尺。上头在卸棉，下头在候客；后来双方都以为对方不再来了。',
                'log'
              ),
            ],
      };
    },
    ({ past }) => {
      const active = past.winterDeal && past.winterDeal !== 'open';
      return {
        title: '这一次，冬班要怎么写？',
        detail:
          '旧册留下的最后一行是“客棚拆了”。' +
          (active ? '你还有一份正在走的棉约。' : '你可以先从散客班立一份约。') +
          '改约需要补偿或另找船，照旧也可以把靠岸地点写清。',
        item: 'paper',
        itemLabel: '今天的冬班原本',
        choices: [
          move(
            'honor',
            '双桩张贴原约',
            'bell',
            '照原船单走。两处桩都挂上出发地点，赶船的人能提前改道。',
            'amend'
          ),
          move(
            'reserve',
            '圈出一个客位',
            'ticket',
            active
              ? '退给货主 2 枚换约钱，留一格常客位。两处桩同时挂上新票。'
              : '散班留一格凭旧票先上。两处桩同时挂了票样。',
            'amend'
          ),
          move(
            'transfer',
            '把散客转托红帆',
            'rope',
            past.winterCopy === 'crew'
              ? '小满已有船单，今天就接通两处跳板。'
              : '另抄一张船单交给小满。她的船在下游接人，货船照约离开。',
            'amend'
          ),
        ],
      };
    },
  ],
  end: ({ picks }) => ({
    title:
      picks[2] === 'reserve'
        ? '旧票又有了座位'
        : picks[2] === 'transfer'
          ? '两根渡桩一张班表'
          : '两处都挂上了时辰',
    detail: '周婶把三年前的折票重新收好。这回，去哪里候船一看就知道。',
    facts: { ticketRule: picks[2] },
  }),
};

function keeperName(past: StoryContext['past']) {
  if (past.homeKeeper === 'xiaoman') return '小满';
  if (past.homeKeeper === 'ayun') return '阿芸';
  return '船长';
}

const shiftChange: StoryChapter = {
  num: 19,
  title: '两岸换班',
  opening: 'apart',
  lines: {
    apart: [
      '船长',
      '一个你，两处埠头。船绳和仓钥匙，总有一样得托给人。',
      'One of you, two landings. Somebody else will have to take the rope or the key.',
    ],
    trusted: [
      '小满',
      '船旗我认得，昨夜的潮也记着。把该留的位告诉我。',
      'I know the flags and last night’s tide. Tell me which berth to keep.',
    ],
    stacks: [
      '阿芸',
      '我收一张条，就划掉一笔。你回来能看清谁领走了什么。',
      'One slip in, one line crossed out. When you get back you’ll see just who took what.',
    ],
    horn: [
      '阿诚',
      '隔着一湾水也听得见。你摇铃，那边就应声。',
      'They can hear us across the inlet. Ring the bell and they’ll answer.',
    ],
  },
  steps: [
    ({ past }) => ({
      title: '雾港今早由谁挂牌？',
      detail:
        (past.partner === 'xiaoman'
          ? '小满还记得雾港大集那半天的舵。'
          : past.partner === 'ayun'
            ? '阿芸还留着上次替你守摊的票夹。'
            : '两岸天一亮，都有人要开门。') + '你得去芦湾点货，留下一个人管雾港的班表。',
      item: 'bell',
      itemLabel: '雾港的开班铃',
      choices: [
        move(
          'xiaoman',
          '挂上小满的红帆',
          'boat',
          '小满接了铃和舵。散客从下游上船，船长在桥头看旗调位。',
          'trusted'
        ),
        move(
          'ayun',
          '交给阿芸的柜台',
          'key',
          '阿芸挂牌验单，船长照她的蓝线次序靠桩。棉包先从货栈下水。',
          'stacks'
        ),
      ],
    }),
    ({ past }) => ({
      title: '芦湾仓门边的两根绳',
      detail:
        (past.bayKey === 'bay' ? '陈禾已拿备用钥匙开了仓。' : '你在芦湾开了仓门。') +
        '一根绳领去接欠交的包裹，另一根绳牵着受潮边缘的芦捆。涨水前能先牵一条。',
      item: 'rope',
      itemLabel: '仓门的第一根牵绳',
      choices: [
        move(
          'arrears',
          '先放欠交包裹',
          'crate',
          '等了两班的收件人拿到包裹。芦捆还等着换上层干架。',
          'stacks'
        ),
        move('dry', '把芦料吊到上层', 'reed', '两捆灯芯上干架，赶晚灯绰绰有余。欠交单还钉在仓门外。', 'horn'),
      ],
    }),
    ({ past, picks }) => {
      const home = picks[0] === 'xiaoman' ? '小满' : '阿芸';
      const rule =
        past.ticketRule === 'reserve'
          ? '原约留着一个客位。'
          : past.ticketRule === 'transfer'
            ? '红帆正在下游接转船的客人。'
            : '两处桩都在等潮讯。';
      return {
        title: '水涨到换班线了',
        detail:
          home +
          '从雾港摇了两声铃。' +
          rule +
          (picks[1] === 'dry' ? '芦湾还有一件迟交的包裹。' : '芦湾还有两捆要移到干处的料。'),
        item: 'bell',
        itemLabel: '换班回铃',
        choices: [
          move(
            'relay',
            '请对岸加接一趟',
            'boat',
            home + '排出一班接驳。芦湾余下的差事有人来接，雾港最后一班要晚一刻。',
            'horn'
          ),
          move(
            'stay',
            '自己留到收仓',
            'key',
            '雾港照时开船。你亲手了结余下的差事，午夜才赶上回家的船。',
            'stacks'
          ),
        ],
      };
    },
  ],
  end: ({ picks }) => ({
    title: picks[0] === 'xiaoman' ? '红帆替你开了班' : '柜台挂起了班牌',
    detail:
      '你回到雾港时，' +
      (picks[0] === 'xiaoman' ? '小满' : '阿芸') +
      '把已走的班次用粉笔划给你看。' +
      (picks[2] === 'relay'
        ? '末班晚了一刻，两港的差事都接上了。'
        : '最后一班照点走，你自己的袖口还沾着仓灰。'),
    facts: { homeKeeper: picks[0], bayShift: picks[2] },
  }),
};

function quayInMemory({ past }: StoryContext) {
  if (past.morning === 'early-eggs') return '陈禾还记得你把两筐蛋送进早市的那天。';
  if (past.morning === 'early-missed') return '当年没上船的蛋担，如今在桥头也有一块摊板。';
  if (past.morning === 'flex-cargo') return '阿芸原先等到午潮才捆齐的货，今天早早码在岸边。';
  if (past.morning === 'flex-passenger') return '老街坊还沿用那天机动班的候船长凳。';
  return '栈桥旁还停着最初那辆面包车。';
}

const homeBoard: StoryChapter = {
  num: 20,
  title: '今天谁来挂船牌',
  opening: 'wheel',
  lines: {
    wheel: [
      '阿芸',
      '车铃还响。来，从这条街再推一回，看看今天开了哪些门。',
      'The cart bell still rings. Wheel it down our street once more. See whose doors are open.',
    ],
    loaf: [
      '阿诚',
      '早！第一炉刚出。替我把这个带给码头等船的人。',
      'Morning! First batch is out. Take this one to the people waiting at the landing.',
    ],
    stub: [
      '周婶',
      '那张票我折了三年。今天，终于可以撕下这一联给人了。',
      'I kept that ticket folded for three years. Today I can finally tear off the other half for someone.',
    ],
    home: [
      '船长',
      '绳解开了。想掌舵就来，想坐在船头看一回雾港，也有位。',
      'We’re casting off. Take the helm, or take the bow seat and see Fog Harbor from the water.',
    ],
  },
  steps: [
    (ctx) => {
      const light = ctx.past.lamp === 'boat' || ctx.past.bayReturn === 'wick';
      return {
        title: '再推一回面包车',
        detail:
          quayInMemory(ctx) +
          '木轮滚过旧车辙，岔路一头通桥头，一头贴着渡口。' +
          (light ? '你留下的夜船灯刚熄。' : ''),
        item: 'cart',
        itemLabel: '序章的面包车',
        choices: [
          move(
            'street',
            '推过桥头饼摊',
            'bread',
            ctx.past.fair === 'bread'
              ? '熟客听出车铃，把第一盘热饼放在你的老招牌下。'
              : '阿诚把热饼装上车，给你捎去码头。面包香又飘过了这条街。',
            'loaf'
          ),
          move(
            'landing',
            '沿旧渡口推车',
            'boat',
            keeperName(ctx.past) + '已经在绳桩旁候船。孩子循着车铃跑来，认出那辆送过面包的旧车。',
            'wheel'
          ),
        ],
      };
    },
    ({ past, picks }) => {
      const reserved = past.ticketRule === 'reserve';
      const connected = past.ticketRule === 'transfer';
      return {
        title: '旧票交给谁？',
        detail:
          (picks[0] === 'street' ? '面包车从桥头转回票窗。' : '周婶从堤脚向车子招手。') +
          (reserved
            ? '票夹里还留着那格旧票优先位。'
            : connected
              ? '两段转船章已经排在同一块木牌上。'
              : '今天的靠岸地点写得清清楚楚。') +
          '周婶拆开折痕，要你帮忙把另一联送出去。',
        item: 'ticket',
        itemLabel: '周婶的旧票联',
        choices: [
          move('child', '递给第一次来的孩子', 'ticket', '孩子双手捧票，照着周婶教的地方等船。', 'stub'),
          move(
            'crew',
            '递给接班的船工',
            'rope',
            '船工把旧票挂在当班铃上。今天每个问路的人都能看见。',
            'stub'
          ),
        ],
      };
    },
    ({ past, picks }) => ({
      title: '轮到你上船了',
      detail:
        keeperName(past) +
        '把第一班的牌子挂正。' +
        (picks[1] === 'child' ? '拿着旧票的孩子已在船头坐好。' : '旧票在开班铃下飘起来。') +
        '船头有舵，长凳也空着一位。你想怎样离开栈桥？',
      item: 'ticket',
      itemLabel: '今天的第一张新票',
      choices: [
        move(
          'sail',
          '把票夹到舵边，亲自领船',
          'rope',
          '你手里握住熟悉的舵绳。' + keeperName(past) + '在岸上接着报下一班。',
          'home'
        ),
        move(
          'ride',
          '买张客票，坐到船头',
          'boat',
          '你接过自己的客票，坐在船头看着栈桥退远。岸上有人自己挂好了下一班的牌。',
          'home'
        ),
      ],
    }),
  ],
  end: ({ past, picks }) => {
    const receiver =
      picks[1] === 'child' ? '周婶的票到了第一次坐船的孩子手上。' : '周婶的旧票在船工的当班铃下轻轻晃着。';
    return {
      title: picks[2] === 'ride' ? '雾港第一排的乘客' : '载着雾港再出发',
      detail:
        keeperName(past) +
        '挂起船班牌。' +
        receiver +
        (picks[2] === 'ride'
          ? '你坐下了，面包车还停在那个老地方。'
          : '船首出了雾，桥头还能听见那辆面包车的铃。') +
        '　雾港故事完',
      facts: { finalHome: picks[0], finalTicket: picks[1], finalRole: picks[2] },
    };
  },
};

export const bayChapters: StoryChapter[] = [
  halfLoad,
  returnBoat,
  twoKeys,
  oldPrice,
  winter,
  oldTicket,
  shiftChange,
  homeBoard,
];
