import { dryGoods, lampWork, riceClosing, riceLedger } from './market-board.ts';
import type { Beat, Choice, Prop, StoryChapter, StoryLine } from './types.ts';

const bridgeLines = {
  bell: ['阿芸', '铃响了！你听，声音从桥上来。', 'There’s the bell! Listen, it’s up on the bridge.'],
  walk: [
    '周婶',
    '我先走一趟。谁要带饼，桥头见！',
    'I’ll walk across first. Meet me by the bridge if you want bread!',
  ],
  dock: [
    '阿芸',
    '人走桥，重货还得走水。把缆桩边让给我。',
    'People can walk. Heavy freight still goes by water. Keep me a spot by the post.',
  ],
  order: [
    '陈禾',
    '把这张条子夹好。下个集日我拿着另一半来。',
    'Keep this slip safe. I’ll bring the other half on market day.',
  ],
} satisfies Record<string, StoryLine>;
const sailLines = {
  rival: [
    '小满',
    '我也会看价牌。猜到我船里装什么了？',
    'I can read a price board too. Guess what I’ve got aboard.',
  ],
  sell: [
    '阿芸',
    '第一袋落秤，这块价牌就得翻面。',
    'Once that first sack hits the scales, I turn the price board.',
  ],
  wait: [
    '陈禾',
    '听听卸船的响动。等会儿再来秤边看看。',
    'Listen to them unloading. Come back to the scales in a moment.',
  ],
  deal: [
    '小满',
    '我捎你一程。下回看见红帆，给我留个位置。',
    'I’ll carry that for you. Save me a berth next time you see the red sail.',
  ],
} satisfies Record<string, StoryLine>;
const storeLines = {
  rain: [
    '阿芸',
    '雨脚过桥了。仓门里面，只有抬高的地板是干的。',
    'Rain is crossing the bridge. Only the raised floor inside will stay dry.',
  ],
  dry: [
    '阿诚',
    '这道线算数。我把货摞在里头，压块木头就稳。',
    'I’ll keep to that line. A wooden wedge will steady the stack.',
  ],
  sell: [
    '陈禾',
    '趁还没淋湿，推到廊下，我就能收。',
    'Wheel it under the arcade while it’s dry. I’ll take it there.',
  ],
  claim: [
    '阿芸',
    '看清半张存单，谁的货就交回谁手里。',
    'Match the two halves of the receipt before you let the goods go.',
  ],
} satisfies Record<string, StoryLine>;
const lampLines = {
  wind: [
    '船长',
    '岸上好好一盏灯，船头一转就叫风吹灭了。',
    'It burns perfectly ashore. Turn the bow into the wind and it goes out.',
  ],
  make: [
    '阿诚',
    '把纸套稳稳扣在架上。别让下边那道缝也堵住。',
    'Fit the shade snugly around the frame. Leave that lower vent clear.',
  ],
  light: ['周婶', '灯亮没亮，照照这张小票就知道。', 'Hold this little ticket up and see if you can read it.'],
  trade: [
    '阿芸',
    '夜摊等着亮灯。开个价，我替你吆喝。',
    'The evening stalls need a light. Give me a price and I’ll call it out.',
  ],
} satisfies Record<string, StoryLine>;
const helmLines = {
  tide: [
    '小满',
    '你只有一双手。我替你跑一趟，敢把舵给我吗？',
    'You only have two hands. Will you let me take the helm for one run?',
  ],
  sail: [
    '小满',
    '船单放在桅杆下。人和货，我都认得。',
    'Leave the manifest by the mast. I know the people and the freight.',
  ],
  stall: [
    '阿芸',
    '柜台给我留柄秤。等你回来，一起点钱。',
    'Leave me the scales. We’ll count the takings when you get back.',
  ],
  land: [
    '船长',
    '听见跳板响了吗？把回来的那一份接住。',
    'Hear the gangplank drop? Go and collect what’s come back.',
  ],
} satisfies Record<string, StoryLine>;
const fairLines = {
  open: [
    '周婶',
    '锣一响，半个雾港都来了。你的招牌往哪儿挂？',
    'Half of Fog Harbor came running at the gong. Where will you hang your sign?',
  ],
  bake: ['阿芸', '趁热！闻着香味的人已经排到桥上了。', 'Still warm! People can smell it from the bridge.'],
  freight: ['小满', '潮头到桩边了。这班货现在就走！', 'The tide has reached the post. This load sails now!'],
  dusk: ['周婶', '明早的牌子挂好了。我记得路。', 'Tomorrow’s board is up. I know where to come.'],
} satisfies Record<string, StoryLine>;

// A beat puts one physical object between the destinations the player can choose.
function beat(title: string, detail: string, item: Prop, itemLabel: string, choices: Choice[]): Beat {
  return { title, detail, item, itemLabel, choices };
}

function place(id: string, label: string, prop: Prop, result: string, cue: string, hint?: string): Choice {
  return { id, label, prop, result, cue, hint };
}

const bridgeArrivals: Record<string, string> = {
  'early-eggs': '陈禾上次赶上了早市，这回在车把上挂了一篮蛋，托你寄卖。',
  'early-missed': '陈禾挑着上次留在岸上的那副蛋担，已经从桥上走过来了。',
  'flex-cargo': '阿芸认出替她跑过午货的船，把一辆重货车推到你的缆桩旁。',
  'flex-passenger': '昨天搭过机动班的街坊从桥上探头，招呼你过来摆摊。',
};

const bridge: StoryChapter = {
  num: 7,
  title: '桥开那天',
  lines: bridgeLines,
  opening: 'bell',
  steps: [
    ({ past }) =>
      beat(
        '第一声铃从哪里来？',
        (bridgeArrivals[past.morning] ?? '周婶走上刚通车的桥，回头冲你摇了摇车铃。') +
          ' 修好的桥第一次准手推车通行。面包车还拴在旧渡口。',
        'cart',
        '解开面包车的车绳',
        [
          place(
            'bridge',
            '推到桥头',
            'bell',
            '铃声挤进第一波人流。桥头有吃早饭的街坊，也有人等着拿整篮货。',
            'walk'
          ),
          place('dock', '靠回渡口', 'boat', '船位空了出来。一排过不了窄桥的大木箱贴着栈桥排开。', 'dock'),
        ]
      ),
    ({ past, picks }) => {
      if (picks[0] === 'bridge') {
        const eggs = past.morning === 'early-eggs';
        return beat(
          '桥头第一单',
          eggs
            ? '一篮寄卖鸡蛋就在手边。第一波步行客过桥，只来得及摆好一摊。'
            : '周婶带来的修桥工人已经收了围栏，赶着吃一口热的。',
          eggs ? 'egg' : 'bread',
          eggs ? '摆出陈禾的寄卖篮' : '搬下第一篮热饼',
          [
            place(
              'retail',
              '摆小摊零卖',
              'cart',
              eggs ? '陈禾的蛋搭着饼卖掉了，分过蛋钱，钱匣里净添 7 枚。' : '热饼拆开卖，手心多了 5 枚铜币。',
              'walk'
            ),
            place(
              'bulk',
              '整篮送工棚',
              'crate',
              '工棚收整篮，付了 4 枚。买手把明天需要的口粮写在纸上。',
              'order'
            ),
          ]
        );
      }
      return beat(
        '渡口的两种活',
        '阿芸的木箱上有新漆，近埠那头也有人冲你挥手。潮退前够跑一趟。',
        'rope',
        '解开船头绳',
        [
          place(
            'freight',
            '捎阿芸的重箱',
            'crate',
            '木箱全到了，阿芸付了 7 枚。她问往后还有没有空舱。',
            'dock'
          ),
          place(
            'shuttle',
            '去近埠接人',
            'ticket',
            '小埠的街坊终于过了河，给你 4 枚，又替米行带来了订货条。',
            'walk'
          ),
        ]
      );
    },
    ({ picks }) => {
      const freight = picks[1] === 'freight';
      return beat(
        '把明日留给谁',
        freight
          ? '阿芸递过货运订条。红帆明天靠岸，你也可以把舱空出来，临时看价。'
          : '磨坊要收一袋米，交货付 10 枚。你可以接这张条，也可以明天再找生意。',
        'paper',
        '把订条夹在船牌上',
        [
          freight
            ? place('freight', '接木箱订条', 'crate', '阿芸在订条上画了只木箱，明天的水脚另付。', 'dock')
            : place(
                'grain',
                '接磨坊米单',
                'rice',
                '陈禾撕下另一半米单。明天到秤边，一手交米，一手付钱。',
                'order'
              ),
          place('open', '把条子还给柜台', 'boat', '船牌空着。明天那条红帆带来什么，你就能装什么。', 'walk'),
        ]
      );
    },
  ],
  end: ({ past, picks }) => {
    const cash =
      picks[1] === 'retail' ? (past.morning === 'early-eggs' ? 7 : 5) : picks[1] === 'freight' ? 7 : 4;
    const order = picks[2];
    return {
      title: picks[0] === 'bridge' ? '桥头有了你的铃声' : '重货还认老渡口',
      detail:
        '这半天净收 ' +
        cash +
        ' 枚。' +
        ({
          grain: '船牌上夹着磨坊的一袋米单。',
          freight: '阿芸在船牌上订了一个货位。',
          open: '明天的船舱还能临时接货。',
        }[order] ?? ''),
      facts: { order, bridgeSite: picks[0] },
    };
  },
};

const sail: StoryChapter = {
  num: 8,
  title: '红帆也会看价牌',
  lines: sailLines,
  opening: 'rival',
  steps: [
    ({ past }) =>
      beat(
        '红帆还隔着一座桥',
        '你带两袋米、10 枚周转钱。西仓只剩一袋，眼下每袋收 7 枚。红帆舷边露出两只米袋。' +
          (past.order === 'grain'
            ? '磨坊昨天订的那一袋还有人等。'
            : past.order === 'freight'
              ? '阿芸昨天订了一个货位。'
              : '换牌前还够过一次秤。'),
        'rice',
        '搬动两袋西岸米',
        [
          place('all', '两袋都过秤', 'coins', '抢在靠岸前卖了两袋，进账 14 枚。红帆此刻收了缆绳。', 'sell'),
          place('half', '只卖一袋', 'rice', '7 枚落袋，还有一袋自留米。红帆已靠上栈桥。', 'sell'),
          place('hold', '原封留在船上', 'boat', '仓门前的人转头去看红帆。你的两袋米仍能改走别处。', 'wait'),
        ]
      ),
    ({ picks }) => {
      const first = riceLedger(picks).first;
      return beat(
        '给小满哪个泊位',
        '她有两袋米。大埠两袋全卸在西岸；若你贴 1 枚搭伙，她只卸一袋，另一袋捎去东岸，回头也给你留便宜船位。',
        'rope',
        '接过红帆的系缆绳',
        [
          place(
            'west',
            '绳系西岸大埠',
            'rice',
            '小满卸完两袋。西仓现有 ' +
              (3 + first) +
              ' 袋，换牌收 ' +
              riceLedger([picks[0], 'west']).west +
              ' 枚。东岸仍收 8 枚。',
            'sell'
          ),
          place(
            'share',
            '合用一趟船 · 付1枚',
            'boat',
            '小满西岸卸一袋，另一袋去了东岸。西牌换到 ' +
              riceLedger([picks[0], 'share']).west +
              ' 枚，东岸收 6 枚，合船水脚只要 1 枚。',
            'deal'
          ),
        ]
      );
    },
    ({ past, picks }) => {
      const l = riceLedger(picks);
      const choices = [
        place(
          'east',
          '添一袋运往东岸',
          'boat',
          '用 ' +
            l.west +
            ' 枚添一袋，船上 ' +
            (l.left + 1) +
            ' 袋以每袋 ' +
            l.east +
            ' 枚全部卖出，再付 ' +
            l.fare +
            ' 枚水脚。',
          l.shared ? 'deal' : 'sell'
        ),
      ];
      if (l.left)
        choices.push(
          place(
            'west',
            '自留米在西岸卖',
            'coins',
            '余下 ' + l.left + ' 袋照每袋 ' + l.west + ' 枚过秤，省下一趟水脚。',
            'sell'
          )
        );
      choices.push(
        past.order === 'grain'
          ? place(
              'order',
              '兑现磨坊米单',
              'paper',
              (l.left ? '拿出自留的一袋' : '照新牌买回一袋') + '，兑了昨天的米单，磨坊付足 10 枚。',
              'sell'
            )
          : past.order === 'freight'
            ? place(
                'order',
                '装昨天的木箱',
                'crate',
                '阿芸认出船牌上的记号，扣掉水脚，付你 5 枚。米先留着。',
                'deal'
              )
            : place('order', '给米行代捎秤砣', 'crate', '米行另付 2 枚托你捎一只秤砣，仓单照旧。', 'wait')
      );
      return beat(
        '木牌翻面了',
        '钱袋 ' +
          l.purse +
          ' 枚，自留 ' +
          l.left +
          ' 袋。西岸每袋 ' +
          l.west +
          ' 枚，东岸收 ' +
          l.east +
          ' 枚，水脚 ' +
          l.fare +
          ' 枚。',
        'ticket',
        '交出最后一张运单',
        choices
      );
    },
  ],
  end: ({ past, picks }) => {
    const { cash, stock } = riceClosing(past, picks);
    return {
      title: picks[1] === 'share' ? '红帆给你留了半个埠' : '两条船，两本账',
      detail:
        '收秤时钱袋共 ' +
        cash +
        ' 枚，另有 ' +
        stock +
        ' 袋未卖的米。' +
        (picks[1] === 'share' ? '小满记得这趟合船。' : '小满把两岸的价格都记在自己帆脚上。'),
      facts: { sail: picks[1] === 'share' ? 'partner' : 'rival' },
    };
  },
};
const store: StoryChapter = {
  num: 9,
  title: '仓门上的两道粉笔线',
  lines: storeLines,
  opening: 'rain',
  steps: [
    ({ past }) =>
      beat(
        '雨点先打在仓门上',
        (past.sail === 'partner'
          ? '小满替你压住卷帘，两个人腾出两格高架。'
          : '阿芸踢开仓门，里面只有两格高架干燥。') + ' 门外有两袋米、两捆灯纸。先把第一格划给谁？',
        'chalk',
        '给第一格画一道粉笔线',
        [
          place('grain', '画一只米斗', 'rice', '第一袋米被架起来，袋角离地一掌。另一格还空着。', 'dry'),
          place('paper', '画一只纸灯', 'paper', '阿诚把头一捆灯纸举过水线，在架脚留了半张存单。', 'claim'),
        ]
      ),
    ({ picks }) =>
      beat(
        '还剩一块干地板',
        picks[0] === 'grain'
          ? '架上已有一袋米。再救一袋能凑批卖；替纸坊留一格，来取货的人会记住这个仓。'
          : '第一捆灯纸已存好。整批入仓能赶做新灯；另一边的米袋也快湿到底了。',
        'key',
        '打开第二格高架',
        [
          place('grain', '把米袋抬上架', 'rice', '陈禾提着袋耳，两人把米抬起来。雨水已经漫过旧脚印。', 'dry'),
          place('paper', '把灯纸放上架', 'paper', '纸角压上平木条，雨点再打不到纸面了。', 'dry'),
        ]
      ),
    ({ picks }) => {
      const { grain, paper } = dryGoods(picks);
      const exposed = [grain < 2 ? 2 - grain + ' 袋米' : '', paper < 2 ? 2 - paper + ' 捆灯纸' : '']
        .filter(Boolean)
        .join('和');
      return beat(
        '最后一辆干车',
        '高架上有 ' +
          grain +
          ' 袋米和 ' +
          paper +
          ' 捆纸。门外的 ' +
          exposed +
          ' 赶得及装上有篷手车。廊下收临雨货，纸坊和磨坊也愿意自己领走。',
        'cart',
        '推动廊下的篷车',
        [
          place(
            'sale',
            '推去廊市清货',
            'coins',
            '一车门外余货在廊下换了 ' + (2 * (2 - grain) + (2 - paper)) + ' 枚。仓票只写架上的货。',
            'sell'
          ),
          place(
            'return',
            '沿街送回货主',
            'ticket',
            '两件余货按存单送还。阿芸在仓票上补了“下趟抵一枚车脚”。',
            'claim'
          ),
        ]
      );
    },
  ],
  end: ({ picks }) => {
    const { grain, paper } = dryGoods(picks);
    const stored = grain === 2 ? 'grain' : paper === 2 ? 'paper' : 'both';
    return {
      title: stored === 'both' ? '一格米，一格纸' : grain === 2 ? '米袋全在水线上' : '两捆平整的灯纸',
      detail:
        '雨停时，' +
        grain +
        ' 袋米与 ' +
        paper +
        ' 捆纸留在了干仓。' +
        (picks[2] === 'return'
          ? '退货的篷车带回来一张可抵 1 枚车脚的仓票。'
          : '门外余货换了 ' + (2 * (2 - grain) + (2 - paper)) + ' 枚。'),
      facts: { store: stored, storeCart: picks[2] },
    };
  },
};

const lamp: StoryChapter = {
  num: 10,
  title: '给夜船做一盏灯',
  lines: lampLines,
  opening: 'wind',
  steps: [
    ({ past }) => {
      const paper = past.store === 'paper' || past.store === 'both';
      return beat(
        '船一动，火苗就斜了',
        (paper
          ? '阿诚拿着存单，来取昨天替纸坊保住的干纸。'
          : past.store === 'grain'
            ? '昨天架上放满了米，阿诚只好从纸坊送来新纸。'
            : '阿诚拎来了纸坊刚压平的新灯纸。') + ' 双折罩挡风，敞口罩让人从老远看得见。',
        'paper',
        '把灯纸扣上木圈',
        [
          place(
            'hood',
            '折一道挡风檐',
            'lamp',
            paper ? '干纸一折就立住，免了买新纸的 2 枚。' : '纸坊收了 2 枚新纸钱，双层挡风檐折好了。',
            'make'
          ),
          place(
            'open',
            '绷成敞口灯罩',
            'bell',
            '旧灯纸的中央还完整。单层罩透亮，船头迎风时得另外护火。',
            'make'
          ),
        ]
      );
    },
    ({ picks }) =>
      beat(
        '船长把船头转向风里',
        picks[0] === 'hood'
          ? '挡风檐吃住了风。细捻芯省油，宽芯亮得早，油盏也会干得快。'
          : '风从敞口灌进来。短芯藏在盏沿下，宽芯在岸边能照亮整排货摊。',
        'oil',
        '拨动油盏里的棉芯',
        [
          place('low', '收短灯芯', 'reed', '一条细火藏进盏沿。船转过弯，票根上的字仍看得清。', 'light'),
          place(
            'wide',
            '拉出宽芯',
            'oil',
            picks[0] === 'hood'
              ? '灯芯铺开，暖光穿过挡风罩，船尾系缆的人也能看清。'
              : '码头被照得通亮。船头迎风，灯闪了一下，船长只肯在背风近埠用它。',
            'light'
          ),
        ]
      ),
    ({ picks }) => {
      const l = lampWork(picks);
      return beat(
        '第一盏灯给哪头',
        (l.windproof ? '它在试航中保住了火苗。' : '这盏灯适合背风处。') +
          '夜市愿出 ' +
          (l.bright ? 8 : 5) +
          ' 枚；挂到船头，一盏油够跑 ' +
          l.nightRuns +
          ' 班。',
        'lamp',
        '提起试过风的纸灯',
        [
          place(
            'sold',
            '把灯送去夜市',
            'coins',
            '阿芸付了 ' + (l.bright ? 8 : 5) + ' 枚，把纸灯挂在货摊的秤杆上。',
            'trade'
          ),
          place(
            'boat',
            l.windproof ? '点亮夜渡船头' : '挂到近埠船尾',
            'boat',
            '灯影随船出港，靠着这盏油跑完了 ' + l.nightRuns + ' 班。以后大集夜里也能用这盏灯。',
            'light'
          ),
        ]
      );
    },
  ],
  end: ({ past, picks }) => {
    const l = lampWork(picks);
    const paperCost = l.hood && past.store !== 'paper' && past.store !== 'both' ? 2 : 0;
    return {
      title: picks[2] === 'sold' ? '夜市亮起头一盏灯' : '船头多了一点火光',
      detail:
        (paperCost ? '本次新纸花了 2 枚。' : '旧料做出了第一盏灯。') +
        (picks[2] === 'sold'
          ? '卖灯收了 ' + (l.bright ? 8 : 5) + ' 枚。'
          : '一盏油支撑 ' + l.nightRuns + ' 班夜渡。'),
      facts: { lamp: picks[2], lampGlass: l.windproof ? 'wind' : 'shelter' },
    };
  },
};

const helm: StoryChapter = {
  num: 11,
  title: '借我半天舵',
  lines: helmLines,
  opening: 'tide',
  steps: [
    ({ past }) =>
      beat(
        '桥头和码头同时催你',
        (past.sail === 'partner'
          ? '小满把上次合船的绳结递过来，愿意照老约替你跑一趟。'
          : '红帆的小满愿代跑一趟，先要 2 枚水脚。') + ' 阿芸也能替你站柜。船和柜台，这半天你亲自守哪头？',
        'key',
        '把另一头交给熟人',
        [
          place('xiaoman', '把舵交给小满', 'boat', '你站上桥头货摊。小满升红帆，隔着河等你的船单。', 'sail'),
          place('ayun', '把秤交给阿芸', 'cart', '阿芸系起围裙接柜，你蹬开跳板，回到自己的舵前。', 'stall'),
        ]
      ),
    ({ picks, past }) => {
      if (picks[0] === 'xiaoman')
        return beat(
          '隔着水，把船单递过去',
          '第一次当掌柜，你能跟小满约定一件优先的事。' +
            (past.lamp === 'boat'
              ? '船头有自己的灯，赶末班也能认清桩号。'
              : '夜里可借码头的灯，要另付 1 枚。'),
          'paper',
          '把这一张船单送上红帆',
          [
            place(
              'people',
              '留一席给赶集人',
              'ticket',
              '一张坐票压在头等货单上面。小满把末班的一席空给街坊。',
              'sail'
            ),
            place(
              'bulk',
              '整舱跑托运',
              'crate',
              '阿芸的三只木箱挨着舷板。小满收紧绳索，准备一趟交齐。',
              'sail'
            ),
          ]
        );
      return beat(
        '给阿芸留下哪张价牌',
        '你要离岸了。柜上有一格可以留货，也可以趁客多先卖个空。',
        'chalk',
        '写好半天的柜台安排',
        [
          place(
            'people',
            '给老客留一篮',
            'bread',
            '阿芸在一篮热饼上夹了纸条。老客晚来，也给他留着。',
            'stall'
          ),
          place('bulk', '一早敞开零卖', 'coins', '价牌翻到零卖那一面，桥头排队的人围住了柜台。', 'stall'),
        ]
      );
    },
    ({ past, picks }) =>
      beat(
        '跳板又搭上岸了',
        picks[1] === 'people'
          ? '留给老客的那一份派上了用场。一个迟到的脚夫还想订明晚的一班。'
          : '这一趟现钱多，熟客那张托单还没送到。脚夫正站在桥头等答复。',
        'ticket',
        '接过伙伴带回的半张托单',
        [
          place(
            'pledge',
            '把托单夹到明日牌上',
            'paper',
            '明晚的一格留出来了。脚夫会带着托单赶大集。',
            'land'
          ),
          place(
            'clear',
            '现在送完再收摊',
            'rope',
            past.storeCart === 'return'
              ? '还货时攒下的仓票抵掉了 1 枚车脚。当天交清，明天的货位全空着。'
              : '花 1 枚车脚，当天交清。明天的货位全空着。',
            'land',
            past.storeCart === 'return' ? '仓票抵车脚' : '车脚 1 枚'
          ),
        ]
      ),
  ],
  end: ({ picks, past }) => {
    const xiaoman = picks[0] === 'xiaoman';
    const cost = xiaoman && past.sail !== 'partner' ? 2 : 0;
    const cartFee = picks[2] === 'clear' && past.storeCart !== 'return' ? 1 : 0;
    const fee =
      (picks[1] === 'bulk' ? 9 : 6) -
      cost -
      cartFee -
      (xiaoman && picks[1] === 'people' && past.lamp !== 'boat' ? 1 : 0);
    return {
      title: xiaoman ? '第一次在岸上收船' : '有人替你守着柜台',
      detail:
        (xiaoman ? '小满交回船单。' : '阿芸把秤交回你手里。') +
        '两头扣掉脚钱，共进 ' +
        fee +
        ' 枚。' +
        (picks[2] === 'pledge' ? '明日还有脚夫的预约。' : '今天的托单全清了。'),
      facts: { partner: picks[0], fairOrder: picks[2] },
    };
  },
};

const fairNames: Record<string, string> = { bread: '桥头饼摊', freight: '红帆货船', night: '灯下夜渡' };
const fairTokens: Record<string, Prop> = { bread: 'bread', freight: 'crate', night: 'lamp' };

function fairIncome(past: Readonly<Record<string, string>>, picks: readonly string[]) {
  const business = picks[0];
  const helping = business === 'bread' ? past.partner === 'ayun' : past.partner === 'xiaoman';
  const first = business === 'night' ? (past.lamp === 'boat' ? 6 : 4) : business === 'freight' ? 6 : 5;
  const second = picks[1] === 'reserve' ? (past.fairOrder === 'pledge' ? 6 : 4) : helping ? 8 : 6;
  const last = picks[2] === 'tomorrow' ? 2 : 4;
  return { first, second, last, total: first + second + last };
}

const fair: StoryChapter = {
  num: 12,
  title: '雾港赶大集',
  lines: fairLines,
  opening: 'open',
  steps: [
    ({ past }) =>
      beat(
        '开市前，挑一处挂招牌',
        '桥头点炉，红帆靠岸，夜班的缆桩也留着。' +
          (past.partner === 'xiaoman'
            ? '小满已经到船边，可以替你接货。'
            : past.partner === 'ayun'
              ? '阿芸把你的摊布铺好了。'
              : '周婶替你守住了招牌。'),
        'bell',
        '挂起自己的开市招牌',
        [
          place(
            'bread',
            '去旧车旁卖饼',
            'bread',
            '面包车又回到了人群里。一炉饼净收 5 枚，第二声锣还没响。',
            'bake'
          ),
          place('freight', '上红帆接货', 'crate', '两岸的第一批货按时过江，扣掉水脚赚了 6 枚。', 'freight'),
          place(
            'night',
            '给夜渡预售船位',
            'lamp',
            past.lamp === 'boat'
              ? '自己的船灯挂起来，头一班预售净收 6 枚。'
              : '你向灯铺借了盏挡风灯，付过灯租和水脚，头班预售净收 4 枚。',
            'dusk'
          ),
        ]
      ),
    ({ past, picks }) => {
      const business = picks[0];
      const favoured = business === 'bread' ? past.partner === 'ayun' : past.partner === 'xiaoman';
      const bulkLabel =
        business === 'bread' ? '连出两盘热饼' : business === 'night' ? '先接整班灯客' : '先装一舱木箱';
      const smallLabel =
        business === 'bread' ? '留一篮带走' : business === 'night' ? '留座接晚来的客' : '腾舱接零担';
      return beat(
        '第二声锣快响了',
        (past.fairOrder === 'pledge' ? '昨天预约的脚夫拿着半张单来找你。' : '几位散客问还有没有位子。') +
          (favoured ? '上回的伙伴就在旁边，能帮你赶一笔整单。' : '你自己能赶一笔整单，也能留货给散客。'),
        fairTokens[business],
        '送出' + fairNames[business] + '的第二单',
        [
          place(
            'bulk',
            bulkLabel,
            business === 'bread' ? 'bread' : 'boat',
            '整单交齐，钱匣又添 ' +
              (favoured ? 8 : 6) +
              ' 枚。' +
              (favoured ? '伙伴给你省了一趟来回。' : '你赶在锣响前收了最后一笔。') +
              (past.fairOrder === 'pledge' ? '拿着预约单的脚夫没赶上，转去别摊。' : ''),
            business === 'bread' ? 'bake' : 'freight'
          ),
          place(
            'reserve',
            smallLabel,
            'ticket',
            '压在秤下的那一份找到了主人。收了 ' +
              (past.fairOrder === 'pledge' ? 6 : 4) +
              ' 枚，街坊认得这块牌了。',
            'dusk'
          ),
        ]
      );
    },
    ({ picks }) =>
      beat(
        '散集以后，最后一个客人',
        fairNames[picks[0]] + '的招牌还在晃。周婶拿来两张票：一张是现在出门的尾单，另一张是下个集日的订金。',
        'ticket',
        '把最后一张票挂到招牌下',
        [
          place(
            'tonight',
            '接今晚尾单',
            'coins',
            '再跑一趟，现收 4 枚。回到岸边，伙伴已经挂好了自己明早的班牌。',
            'dusk'
          ),
          place(
            'tomorrow',
            '收下次集日的订金',
            'paper',
            '订金 2 枚装进小匣，周婶在明日牌上留下自己的名字。',
            'dusk'
          ),
        ]
      ),
  ],
  end: ({ picks, past }) => ({
    title: fairNames[picks[0]] + '散集了',
    detail:
      '第一季收工。你靠' +
      fairNames[picks[0]] +
      '经营两个市段，钱匣收入 ' +
      fairIncome(past, picks).total +
      ' 枚。' +
      (picks[2] === 'tomorrow' ? '其中 2 枚是下个集日的订金。' : '今夜的单子全部交清。') +
      '老渡口还有人替你挂明日的牌。',
    facts: { fair: picks[0], nextBooking: picks[2] },
  }),
};

export const marketChapters: StoryChapter[] = [bridge, sail, store, lamp, helm, fair];
