import type { ChapterContext } from './shared.ts';

export const convoyLines = {
  dock: [
    '船长',
    '面粉急着进炉，灯油要送到灯塔。先挑一船货吧。',
    'The bakers need flour, and the lighthouse needs oil. Which cargo shall we take?',
  ],
  flour: [
    '船长',
    '面袋扎紧了。这条轻船，涨潮就能走沙洲。',
    'The flour is tied down. Our light boat can cross the shoal on a rising tide.',
  ],
  oil: [
    '船长',
    '四桶油压低了船舷。看好水尺再过沙洲。',
    'Four barrels ride low in the water. Check the tide gauge before the shoal.',
  ],
  fork: [
    '船长',
    '前面分水了。认准潮标，你来掌舵。',
    'The channel splits ahead. Read the tide gauge and take the helm.',
  ],
  wait: [
    '船长',
    '听见钟了吗？再看看浮标下那圈水痕。',
    'Hear that bell? Look at the waterline on the buoy now.',
  ],
  swift: [
    '船长',
    '过了！水从龙骨底下刚好托了我们一把。',
    'We made it! The tide lifted us clean over the shoal.',
  ],
  outer: [
    '船长',
    '外海风稳。绕过浮标，货全在。',
    'Steady wind offshore. We rounded the buoy with the whole load safe.',
  ],
  ground: [
    '船长',
    '触底了！先卸一件减重，等拖船拉我们出去。',
    'We ran aground! Lighten the load and wait for a tow.',
  ],
  end: [
    '船长',
    '缆绳系好了。这条航路，下回就熟了。',
    'Lines secured. Next time, this route will feel like home.',
  ],
} as const;

type Cargo = 'flour' | 'oil';
type Route = 'outer' | 'shoal';
type Phase = 'dock' | 'fork' | 'arrival' | 'done';
type Action = Cargo | Route | 'cast-off' | 'wait' | 'unload';
export interface ConvoyState {
  version: 1;
  phase: Phase;
  cargo: Cargo | null;
  waits: number;
  route: Route | null;
}

export function startConvoy(): ConvoyState {
  return { version: 1, phase: 'dock', cargo: null, waits: 0, route: null };
}

export function restoreConvoy(data: unknown): ConvoyState {
  if (!data || typeof data !== 'object') return startConvoy();
  const s = data as Partial<ConvoyState>;
  if (
    s.version !== 1 ||
    !(['dock', 'fork', 'arrival', 'done'] as unknown[]).includes(s.phase) ||
    !Number.isInteger(s.waits) ||
    s.waits! < 0 ||
    s.waits! > 3 ||
    !(s.cargo === 'flour' || s.cargo === 'oil' || (s.cargo === null && s.phase === 'dock')) ||
    (s.phase === 'dock' && s.waits !== 0)
  )
    return startConvoy();
  if (s.phase === 'arrival' || s.phase === 'done') {
    if (s.route !== 'outer' && s.route !== 'shoal') return startConvoy();
  } else if (s.route !== null) return startConvoy();
  return { version: 1, phase: s.phase!, cargo: s.cargo, route: s.route, waits: s.waits! };
}

const tides = ['涨潮', '满潮', '落潮', '低潮'] as const;
const cargoLabel = { flour: '面粉', oil: '灯油' } as const;
const quantity = (c: Cargo) => (c === 'flour' ? 3 : 4);
const units = (c: Cargo) => (c === 'flour' ? '袋' : '桶');
export function shoalOpen(s: ConvoyState): boolean {
  return s.waits === 1 || (s.waits === 0 && s.cargo === 'flour');
}

export function actConvoy(s: ConvoyState, action: Action): ConvoyState {
  if (s.phase === 'dock') {
    if (action === 'flour' || action === 'oil') return s.cargo === action ? s : { ...s, cargo: action };
    if (action === 'cast-off' && s.cargo) return { ...s, phase: 'fork' };
  }
  if (s.phase === 'fork') {
    if (action === 'wait' && s.waits < 3) return { ...s, waits: s.waits + 1 };
    if (action === 'shoal' || action === 'outer') return { ...s, phase: 'arrival', route: action };
  }
  if (s.phase === 'arrival' && action === 'unload') return { ...s, phase: 'done' };
  return s;
}

export function delivery(s: ConvoyState) {
  if (!s.cargo || !s.route) return null;
  const grounded = s.route === 'shoal' && !shoalOpen(s);
  const bells = 1 + s.waits + (grounded || s.route === 'outer' ? 3 : 1);
  const count = quantity(s.cargo) - Number(grounded);
  const reward = s.cargo === 'flour' && bells <= 2 ? 6 : 0;
  const cost = grounded ? 5 : s.route === 'outer' ? 3 : 1;
  const earned = count * 5 + reward - cost;
  return { grounded, bells, count, reward, cost, earned };
}

interface Point {
  x: number;
  y: number;
}
type Brush = CanvasRenderingContext2D;
// Positions on the pilot's chart, in its original 800 × 360 coordinates.
const origin: Point = { x: 122, y: 224 },
  junction: Point = { x: 287, y: 213 },
  quay: Point = { x: 664, y: 124 };
const outerPoints = [junction, { x: 382, y: 287 }, { x: 554, y: 268 }, { x: 650, y: 207 }, quay];
const innerPoints = [junction, { x: 381, y: 174 }, { x: 489, y: 173 }, { x: 558, y: 134 }, quay];
function line(g: Brush, points: Point[], ink: string, width: number, dash: number[] = []) {
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((p) => g.lineTo(p.x, p.y));
  g.strokeStyle = ink;
  g.lineWidth = width;
  g.setLineDash(dash);
  g.stroke();
  g.setLineDash([]);
}
function shape(g: Brush, points: number[][], ink: string) {
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => g.lineTo(x, y));
  g.closePath();
  g.fill();
}
function ellipse(g: Brush, x: number, y: number, rx: number, ry: number, ink: string) {
  g.fillStyle = ink;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}
function building(g: Brush, x: number, y: number, k: number, roof: string) {
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  shape(
    g,
    [
      [-13, -12],
      [-1, -18],
      [14, -11],
      [14, 1],
      [1, 8],
      [-13, 1],
    ],
    '#cfb98a'
  );
  shape(
    g,
    [
      [1, -7],
      [14, -13],
      [14, 1],
      [1, 8],
    ],
    '#96865e'
  );
  shape(
    g,
    [
      [-17, -12],
      [-8, -24],
      [7, -29],
      [18, -15],
      [2, -6],
    ],
    roof
  );
  g.fillStyle = '#435449';
  g.fillRect(-8, -6, 3, 5);
  g.fillRect(-2, -3, 3, 6);
  g.restore();
}
function label(g: Brush, x: number, y: number, caption: string) {
  g.font = '600 13px "Songti SC",serif';
  g.textAlign = 'center';
  const w = g.measureText(caption).width;
  g.fillStyle = '#193d3be6';
  g.fillRect(x - w / 2 - 7, y - 13, w + 14, 20);
  g.fillStyle = '#fff0c9';
  g.fillText(caption, x, y + 1);
}
function ship(g: Brush, p: Point, cargo: Cargo | null, load: number) {
  g.save();
  g.translate(p.x, p.y);
  ellipse(g, 0, 3, 33, 6, '#18494785');
  shape(
    g,
    [
      [-30, -5],
      [20, -2],
      [32, -8],
      [23, 5],
      [-17, 7],
      [-26, 3],
    ],
    '#422f27'
  );
  shape(
    g,
    [
      [-27, -7],
      [22, -5],
      [32, -11],
      [25, -2],
      [-17, 3],
    ],
    '#b48551'
  );
  g.fillStyle = '#5c4433';
  g.fillRect(-1, -42, 2, 38);
  shape(
    g,
    [
      [1, -39],
      [22, -13],
      [3, -12],
    ],
    '#ecd5a3'
  );
  shape(
    g,
    [
      [-2, -35],
      [-15, -13],
      [-2, -15],
    ],
    '#bb784d'
  );
  shape(
    g,
    [
      [1, -44],
      [13, -41],
      [1, -38],
    ],
    '#b95443'
  );
  if (cargo)
    for (let i = 0; i < load; i++) {
      const x = -21 + i * 6;
      if (cargo === 'flour') ellipse(g, x, -5, 4, 4, '#e6c78a');
      else {
        g.fillStyle = '#74533c';
        g.fillRect(x, -11, 5, 7);
        g.fillStyle = '#e3b986';
        g.fillRect(x, -9, 5, 1);
      }
    }
  g.restore();
}
function paintChart(canvas: HTMLCanvasElement, s: ConvoyState, vessel: Point) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const w = 800,
    h = 360;
  g.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
  const water = g.createLinearGradient(0, 0, w, h);
  water.addColorStop(0, '#3b7371');
  water.addColorStop(0.52, '#568d89');
  water.addColorStop(1, '#32686c');
  g.fillStyle = water;
  g.fillRect(0, 0, w, h);
  // Soundings and the silvery ridges across this tidal inlet.
  for (let i = 0; i < 195; i++) {
    const x = (i * 119 + Math.sin(i) * 57) % w,
      y = (i * 73 + 42) % h;
    g.strokeStyle = i % 3 === 0 ? '#cee0b24a' : '#174f571f';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 5, y - 2, x + 13 + (i % 9), y);
    g.stroke();
  }
  const coast = [
    [0, 0],
    [317, 0],
    [292, 23],
    [261, 38],
    [238, 62],
    [201, 65],
    [187, 91],
    [156, 107],
    [152, 132],
    [120, 147],
    [111, 184],
    [79, 191],
    [61, 235],
    [0, 248],
  ];
  const island = [
    [387, 86],
    [415, 62],
    [468, 59],
    [515, 74],
    [534, 91],
    [520, 106],
    [492, 113],
    [475, 132],
    [441, 138],
    [411, 129],
    [383, 117],
    [370, 103],
  ];
  const headland = [
    [602, 0],
    [800, 0],
    [800, 170],
    [769, 147],
    [746, 143],
    [715, 120],
    [682, 112],
    [652, 115],
    [618, 101],
    [607, 77],
    [580, 65],
    [563, 48],
    [574, 27],
  ];
  for (const land of [coast, island, headland]) {
    shape(
      g,
      land.map(([x, y]) => [x, y + 10]),
      '#97b4a0'
    );
    shape(
      g,
      land.map(([x, y]) => [x, y + 6]),
      '#b2a783'
    );
    shape(
      g,
      land.map(([x, y]) => [x, y + 3]),
      '#786e53'
    );
    shape(g, land, '#b8b987');
  }
  for (const [x, y] of [
    [62, 48],
    [115, 52],
    [164, 40],
    [77, 133],
    [121, 122],
    [440, 86],
    [471, 89],
    [690, 43],
    [744, 62],
    [778, 93],
  ]) {
    for (let i = 0; i < 5; i++) {
      const xx = x + i * 6,
        yy = y + ((i * 7) % 14);
      g.fillStyle = '#646c4f';
      g.fillRect(xx - 1, yy, 2, 9);
      shape(
        g,
        [
          [xx - 5, yy + 1],
          [xx, yy - 12 - (i % 3)],
          [xx + 6, yy + 2],
        ],
        i % 2 ? '#557959' : '#76845d'
      );
    }
  }
  for (const [x, y, rs] of [
    [52, 147, 1],
    [75, 154, 1],
    [105, 118, 0.8],
    [49, 116, 0.8],
    [643, 71, 0.75],
    [722, 85, 0.9],
    [746, 98, 1],
  ]) {
    building(g, x, y, rs, '#a46a4b');
  }
  // Pier at either end; on the eastern bluff a white-banded lighthouse.
  for (const [x, y] of [
    [98, 183],
    [646, 110],
  ]) {
    g.fillStyle = '#75583e';
    g.fillRect(x, y, 8, 32);
    g.fillRect(x - 5, y + 24, 35, 7);
    g.fillStyle = '#c09d68';
    for (let j = 0; j < 6; j++) g.fillRect(x, y + 2 + j * 4, 8, 2);
  }
  g.fillStyle = '#725443';
  g.fillRect(671, 33, 3, 7);
  shape(
    g,
    [
      [665, 45],
      [675, 45],
      [681, 86],
      [659, 86],
    ],
    '#e7d4a8'
  );
  shape(
    g,
    [
      [664, 55],
      [677, 55],
      [678, 62],
      [663, 62],
    ],
    '#ac6049'
  );
  const lit = s.cargo === 'oil' && s.phase === 'done';
  if (lit) {
    const halo = g.createRadialGradient(670, 43, 0, 670, 43, 30);
    halo.addColorStop(0, '#ffe5aeca');
    halo.addColorStop(1, '#ffdfa000');
    ellipse(g, 670, 43, 29, 29, '#ffebaa22');
    g.fillStyle = halo;
    g.fillRect(640, 13, 60, 60);
  }
  g.fillStyle = '#374e48';
  g.fillRect(665, 40, 10, 8);
  g.fillStyle = lit ? '#fff0a7' : '#96aaa2';
  g.fillRect(667, 42, 6, 4);
  if (s.cargo === 'flour' && s.phase === 'done' && delivery(s)?.reward) {
    for (let i = 0; i < 5; i++) ellipse(g, 718 + i * 2, 58 - i * 4, 3 + i, 2 + i, '#efe3be85');
  }
  shape(
    g,
    [
      [663, 40],
      [670, 33],
      [677, 40],
    ],
    '#8a5944'
  );
  const sandVisible = s.phase !== 'dock' && s.waits !== 1;
  for (let i = 0; i < 22; i++) {
    const xx = 368 + ((i * 41) % 148),
      yy = 152 + ((i * 19) % 44);
    ellipse(g, xx, yy, 6 + (i % 5), 2.6, sandVisible ? '#b3b18a' : '#87aaa0');
    if (i % 4 === 0 && sandVisible)
      shape(
        g,
        [
          [xx - 2, yy],
          [xx, yy - 5],
          [xx + 4, yy],
        ],
        '#736d53'
      );
  }
  line(g, [origin, junction], '#e5d6aa97', 2, [4, 6]);
  line(g, innerPoints, s.route === 'shoal' ? '#ffdfa0' : '#e7d4a0a8', s.route === 'shoal' ? 3 : 2, [5, 6]);
  line(g, outerPoints, s.route === 'outer' ? '#ffdfa0' : '#c4ded5aa', s.route === 'outer' ? 3 : 2, [5, 6]);
  for (const [bx, by] of [
    [321, 199],
    [569, 253],
    [546, 137],
  ]) {
    ellipse(g, bx, by + 2, 7, 2, '#c6d8b8aa');
    shape(
      g,
      [
        [bx - 4, by],
        [bx, by - 9],
        [bx + 4, by],
      ],
      '#9e553f'
    );
    g.fillStyle = '#f3e0b9';
    g.fillRect(bx - 1, by - 10, 2, 5);
  }
  label(g, 72, 91, '磨坊埠');
  label(g, 711, 40, '灯塔港');
  label(g, 438, 213, '沙洲捷径');
  label(g, 456, 309, '外航道');
  const lost = Boolean(delivery(s)?.grounded && vessel.x >= 435);
  if (lost) {
    ellipse(g, 442, 179, 12, 3, '#ddd8b49e');
    if (s.cargo === 'oil') {
      g.save();
      g.translate(442, 176);
      g.rotate(0.35);
      g.fillStyle = '#7c5136';
      g.fillRect(-4, -5, 8, 8);
      g.fillStyle = '#d8b77d';
      g.fillRect(-4, -2, 8, 1);
      g.restore();
    } else ellipse(g, 442, 176, 6, 3.5, '#d9bb86');
  }
  ship(g, vessel, s.cargo, s.cargo && s.phase !== 'done' ? quantity(s.cargo) - Number(lost) : 0);
  // Compass rose in the open corner.
  g.save();
  g.translate(755, 289);
  g.strokeStyle = '#c0caa198';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(0, 0, 19, 0, Math.PI * 2);
  g.stroke();
  shape(
    g,
    [
      [0, -22],
      [4, 0],
      [0, 18],
      [-4, 0],
    ],
    '#e6d5a7'
  );
  shape(
    g,
    [
      [0, -22],
      [4, 0],
      [0, 0],
    ],
    '#ac7856'
  );
  g.font = '11px Georgia';
  g.textAlign = 'center';
  g.fillStyle = '#ded9b1';
  g.fillText('N', 0, -28);
  g.restore();
}

function sailAcross(canvas: HTMLCanvasElement, s: ConvoyState, waypoints: Point[]) {
  if (waypoints.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    paintChart(canvas, s, waypoints[waypoints.length - 1]);
    return;
  }
  const lengths = waypoints.slice(1).map((p, i) => Math.hypot(p.x - waypoints[i].x, p.y - waypoints[i].y));
  const total = lengths.reduce((a, b) => a + b, 0),
    start = performance.now();
  function frame(now: number) {
    if (!canvas.isConnected) return;
    const progress = Math.max(0, Math.min((now - start) / 1050, 1));
    let left = progress * total,
      i = 0;
    while (i < lengths.length - 1 && left > lengths[i]) left -= lengths[i++];
    const from = waypoints[i],
      to = waypoints[i + 1],
      mix = left / lengths[i];
    paintChart(canvas, s, { x: from.x + (to.x - from.x) * mix, y: from.y + (to.y - from.y) * mix });
    if (progress < 1) requestAnimationFrame(frame);
  }
  frame(start);
}

export function mountConvoy(host: HTMLElement, ctx: ChapterContext) {
  let s = restoreConvoy(ctx.load());
  const say = (key: keyof typeof convoyLines) => {
    const [name, zh, en] = convoyLines[key];
    ctx.say(name, zh, en);
  };
  const stageName = { dock: '磨坊埠', fork: '分水浮标', arrival: '灯塔港', done: '灯塔港' };
  function render(previous?: ConvoyState) {
    const outcome = delivery(s);
    const cargo = s.cargo,
      isFork = s.phase === 'fork';
    let summary = '',
      title = '',
      description = '',
      controls = '';
    const button = (action: Action, name: string, sub = '', selected = false, disabled = false) =>
      '<button type="button" data-convoy="' +
      action +
      '"' +
      (action === 'oil' || action === 'flour' ? ' aria-pressed="' + selected + '"' : '') +
      (disabled ? ' disabled' : '') +
      '><strong>' +
      name +
      '</strong>' +
      (sub ? '<small>' + sub + '</small>' : '') +
      '</button>';
    if (s.phase === 'dock') {
      title = '码头上有两张货单';
      description = '潮钟刚响。选好货物，解开系在埠头的缆绳。';
      controls =
        button('flour', '装三袋面粉', '每袋 5 枚 · 第二钟前送到另加 6 枚', cargo === 'flour') +
        button('oil', '装四桶灯油', '每桶 5 枚 · 重载，灯塔整日收货', cargo === 'oil') +
        button('cast-off', '解缆出港', cargo ? '开到分水浮标' : '先选一张货单', false, !cargo);
    } else if (isFork) {
      title = '前方分水，你来掌舵';
      description = shoalOpen(s)
        ? '浮标水痕盖过了船身吃水线。这船货现在可以穿过沙洲。'
        : '水痕低于这船货的吃水线。硬过沙洲要丢一件货减重，再付拖船费。';
      controls =
        button(
          'shoal',
          '驶入沙洲',
          shoalOpen(s) ? '航行 1 钟 · 水脚 1 枚' : '水浅 · 救援 3 钟，水脚合计 5 枚'
        ) +
        button('outer', '绕走外航道', '航行 3 钟 · 水脚 3 枚') +
        button(
          'wait',
          '抛锚候潮',
          s.waits < 3 ? '等 1 钟 · 随后' + tides[s.waits + 1] : '今天的最后一班潮',
          false,
          s.waits >= 3
        );
    } else if (cargo && outcome) {
      const amount = outcome.count + units(cargo) + cargoLabel[cargo];
      title = outcome.grounded
        ? '拖船把你带回了港'
        : outcome.reward
          ? '赶上了第一炉'
          : cargo === 'oil'
            ? s.phase === 'done'
              ? '塔顶亮起了灯'
              : '灯塔等着这船油'
            : '早炉已收火';
      description = outcome.grounded
        ? '船在沙洲触了底。丢下一件货后，拖船把剩余货物带到了灯塔港。'
        : outcome.reward
          ? '烘焙师掀开炉门，趁热又加了一盘面团。准点送到的这单有赏钱。'
          : cargo === 'oil'
            ? '守塔人把油桶滚进小屋，傍晚的第一盏灯有了着落。'
            : '早炉已经收火。烘焙师把面粉留下，准备明早再烤。';
      summary = amount + '送抵灯塔港，扣掉水脚实收 ' + outcome.earned + ' 枚。';
      controls = s.phase === 'arrival' ? button('unload', '靠岸卸货', '交付' + amount) : '';
    }
    const clock = s.phase === 'dock' ? 0 : (outcome?.bells ?? 1 + s.waits);
    host.innerHTML =
      '<section class="convoy-stage" data-phase="' +
      s.phase +
      '">' +
      '<div class="convoy-map"><canvas width="1200" height="540" role="img" aria-label="从磨坊埠出发，沙洲捷径和外航道通往灯塔港"></canvas>' +
      '<div class="convoy-location"><i></i>' +
      stageName[s.phase] +
      '<span>第 ' +
      clock +
      ' 钟</span></div>' +
      (isFork ? '<div class="convoy-tide"><small>潮标</small><b>' + tides[s.waits] + '</b></div>' : '') +
      '</div>' +
      '<div class="convoy-details"><div class="convoy-log"><h2>' +
      title +
      '</h2><p>' +
      description +
      '</p></div>' +
      (cargo
        ? '<p class="convoy-manifest"><span>' +
          (s.phase === 'done' ? '已签收' : '船货') +
          '</span> <b>' +
          (outcome?.count ?? quantity(cargo)) +
          units(cargo) +
          cargoLabel[cargo] +
          '</b></p>'
        : '') +
      '</div>' +
      (outcome
        ? '<div class="convoy-receipt"><span>货款 <b>' +
          outcome.count * 5 +
          '</b></span><span>赶潮赏 <b>+' +
          outcome.reward +
          '</b></span><span>水脚 <b>−' +
          outcome.cost +
          '</b></span><strong>' +
          (s.phase === 'done' ? '实收' : '卸货可得') +
          ' ' +
          outcome.earned +
          ' 枚</strong></div>'
        : '') +
      (controls ? '<div class="convoy-actions">' + controls + '</div>' : '') +
      '</section>';
    const canvas = host.querySelector('canvas')!;
    if (previous?.phase === 'dock' && isFork) sailAcross(canvas, s, [origin, junction]);
    else if (previous?.phase === 'fork' && s.phase === 'arrival')
      sailAcross(canvas, s, s.route === 'outer' ? outerPoints : innerPoints);
    else paintChart(canvas, s, s.phase === 'dock' ? origin : isFork ? junction : quay);
    if (isFork) {
      const targetRoute = (event: MouseEvent): Route | null => {
        const bounds = canvas.getBoundingClientRect(),
          x = ((event.clientX - bounds.left) / bounds.width) * 800,
          y = ((event.clientY - bounds.top) / bounds.height) * 360;
        if (x < 322 || x > 583) return null;
        if (y >= 144 && y < 228) return 'shoal';
        if (y >= 248 && y <= 319) return 'outer';
        return null;
      };
      canvas.onmousemove = (e) => {
        canvas.style.cursor = targetRoute(e) ? 'pointer' : '';
      };
      canvas.onclick = (e) => {
        const route = targetRoute(e);
        if (route) choose(route);
      };
    }
    for (const el of host.querySelectorAll<HTMLButtonElement>('[data-convoy]')) {
      el.onclick = () => choose(el.dataset.convoy as Action);
    }
    if (s.phase === 'done' && summary) ctx.finish(summary);
  }
  function choose(action: Action) {
    const before = s,
      next = actConvoy(s, action);
    if (next === s) return;
    const keyboard =
      host.contains(document.activeElement) && document.activeElement?.matches(':focus-visible');
    s = next;
    ctx.save(s);
    render(before);
    const cue =
      action === 'cast-off'
        ? 'fork'
        : action === 'shoal'
          ? shoalOpen(s)
            ? 'swift'
            : 'ground'
          : action === 'unload'
            ? 'end'
            : action;
    say(cue);
    if (keyboard) {
      const focus = action === 'oil' || action === 'flour' ? 'cast-off' : action === 'wait' ? 'wait' : null;
      (focus
        ? host.querySelector<HTMLButtonElement>('[data-convoy="' + focus + '"]:enabled')
        : null
      )?.focus();
      if (!host.contains(document.activeElement))
        host.querySelector<HTMLButtonElement>('[data-convoy]:enabled')?.focus();
    }
  }
  render();
  if (s.phase === 'dock') say(s.cargo ?? 'dock');
  else if (s.phase === 'fork') say('fork');
  else if (s.phase === 'arrival')
    say(delivery(s)?.grounded ? 'ground' : s.route === 'outer' ? 'outer' : 'swift');
}
