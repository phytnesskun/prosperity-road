import type { ChapterContext } from './shared.ts';

export const millLines = {
  open: [
    '阿诚',
    '风到了！我扶着磨盘，你来抬闸。',
    'Here comes the wind! I’ll steady the stones. You lift the gate.',
  ],
  grind: ['阿诚', '听，磨盘转匀了。新粉就在木槽里。', 'Hear that steady hum? Fresh flour is in the trough.'],
  slip: [
    '阿诚',
    '这阵风和帆面没合上劲，磨盘只吃进去一袋。',
    'The sails didn’t catch that gust quite right. Only one sack went through.',
  ],
  sail: [
    '阿诚',
    '绳扣好啦。看风袋，再放下一批米。',
    'The rope is fast. Watch the windsock before you feed in more grain.',
  ],
  sift: [
    '阿芸',
    '筛下来的细粉，我给你另扎一个白口袋。',
    'I’ll tie the sifted flour up separately in a white sack.',
  ],
  street: [
    '周婶',
    '正好赶上揉面。给街坊的这一袋，我收下了！',
    'Just in time to knead the dough. I’ll take this sack for the street!',
  ],
  ship: ['船长', '这粉磨得细，收好了。把铜币接住！', 'Good fine flour. It’s aboard. Catch your coins!'],
  streetEnd: [
    '周婶',
    '今夜整条街都能闻到饼香。明天，还来找我们呀。',
    'The whole street will smell of warm bread tonight. Come see us tomorrow.',
  ],
  shipEnd: [
    '船长',
    '船上的饼干够吃一路。以后进港，我认你这块磨坊招牌。',
    'We have flour for the whole voyage. I’ll look for your mill next time we dock.',
  ],
  sharedEnd: [
    '阿诚',
    '暮风停了。哪家拿到了粉，哪家还等着，咱们都记下了。',
    'The evening wind has dropped. We’ve noted who got flour and who is still waiting.',
  ],
} as const;

type Line = keyof typeof millLines;
export type MillAction = 'grind' | 'sail' | 'sift' | 'street' | 'ship' | 'close';
interface MillState {
  day: number;
  reefed: boolean;
  grain: number;
  coarse: number;
  fine: number;
  street: number;
  ship: number;
  closed: boolean;
  line: Line;
}
const gusts = ['晨间轻风', '正午强风', '午后轻风'];
const streetOrder = 6;
const shipOrder = 4;
export const newMill = (): MillState => ({
  day: 0,
  reefed: false,
  grain: 6,
  coarse: 0,
  fine: 0,
  street: 0,
  ship: 0,
  closed: false,
  line: 'open',
});
const ripeWind = (s: MillState) => (s.day === 1) === s.reefed;
const receipts = (s: MillState) => s.street * 2 + s.ship * 5;

export function restoreMill(raw: unknown): MillState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as MillState;
  const counts = [s.day, s.grain, s.coarse, s.fine, s.street, s.ship];
  if (
    !counts.every((n) => Number.isInteger(n) && n >= 0) ||
    s.day > 3 ||
    s.grain > 6 ||
    s.street > streetOrder ||
    s.ship > shipOrder
  )
    return null;
  if (typeof s.reefed !== 'boolean' || typeof s.closed !== 'boolean' || (s.closed && s.day !== 3)) return null;
  if (
    s.grain < 6 - 2 * s.day ||
    s.grain > 6 - s.day ||
    (6 - s.grain) * 2 !== s.coarse + 2 * s.fine + s.street + 2 * s.ship
  )
    return null;
  return typeof s.line === 'string' && Object.hasOwn(millLines, s.line) ? { ...s } : null;
}

export function workMill(s: MillState, action: MillAction): MillState {
  if (s.closed) return s;
  switch (action) {
    case 'sail':
      return s.day < 3 ? { ...s, reefed: !s.reefed, line: 'sail' } : s;
    case 'grind': {
      if (s.day >= 3 || s.grain === 0) return s;
      const sacks = Math.min(s.grain, ripeWind(s) ? 2 : 1);
      return {
        ...s,
        day: s.day + 1,
        grain: s.grain - sacks,
        coarse: s.coarse + sacks * 2,
        line: sacks === 2 ? 'grind' : 'slip',
      };
    }
    case 'sift':
      return s.coarse >= 2 && s.fine + s.ship < shipOrder
        ? { ...s, coarse: s.coarse - 2, fine: s.fine + 1, line: 'sift' }
        : s;
    case 'street':
      return s.street < streetOrder && s.coarse > 0
        ? { ...s, coarse: s.coarse - 1, street: s.street + 1, line: 'street' }
        : s;
    case 'ship':
      return s.ship < shipOrder && s.fine > 0 ? { ...s, fine: s.fine - 1, ship: s.ship + 1, line: 'ship' } : s;
    case 'close':
      return s.day === 3
        ? {
            ...s,
            closed: true,
            line: s.street === streetOrder ? 'streetEnd' : s.ship === shipOrder ? 'shipEnd' : 'sharedEnd',
          }
        : s;
  }
}

export function millEnding(s: MillState) {
  const title =
    s.street === streetOrder ? '整条街的热饼' : s.ship === shipOrder ? '启航前的最后一袋' : '磨坊的第一张账单';
  return `${title} · 街坊收下 ${s.street} 袋粗粉，船队带走 ${s.ship} 袋细粉，今天进账 ${receipts(s)} 枚。`;
}

type Ink = CanvasRenderingContext2D;
type Point = readonly [number, number];
function polygon(g: Ink, color: string, ...corners: Point[]) {
  g.fillStyle = color;
  g.beginPath();
  corners.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
}
function ellipse(g: Ink, color: string, x: number, y: number, w: number, h: number) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, w, h, 0, 0, 2 * Math.PI);
  g.fill();
}
function stroke(g: Ink, color: string, width: number, ...points: Point[]) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
}
function rect(g: Ink, color: string, x: number, y: number, w: number, h: number) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}
function sack(g: Ink, x: number, y: number, cloth: string, band: string) {
  ellipse(g, '#414c413d', x + 1, y + 1, 11, 3);
  polygon(
    g,
    cloth,
    [x - 8, y - 1],
    [x - 9, y - 6],
    [x - 6, y - 17],
    [x - 3, y - 19],
    [x - 5, y - 22],
    [x + 3, y - 22],
    [x + 2, y - 19],
    [x + 7, y - 16],
    [x + 10, y - 5],
    [x + 7, y]
  );
  stroke(g, band, 2, [x - 4, y - 18], [x + 3, y - 18]);
  stroke(g, '#78624688', 1, [x - 4, y - 13], [x - 6, y - 4], [x - 3, y - 2]);
}
function person(g: Ink, x: number, y: number, jacket: string, hat: string, cap: boolean) {
  ellipse(g, '#353b314a', x, y, 11, 3);
  rect(g, '#373b37', x - 5, y - 11, 3.5, 12);
  rect(g, '#373b37', x + 2, y - 11, 3.5, 12);
  polygon(g, jacket, [x - 6, y - 25], [x + 5, y - 25], [x + 8, y - 10], [x - 8, y - 10]);
  stroke(g, '#b18560', 3, [x - 5, y - 22], [x - 10, y - 14], [x - 14, y - 16]);
  ellipse(g, '#ce936b', x, y - 29, 5, 6);
  if (cap) {
    rect(g, hat, x - 7, y - 34, 13, 4);
    rect(g, hat, x - 4, y - 37, 9, 4);
  } else {
    ellipse(g, hat, x - 1, y - 33, 5, 3);
    ellipse(g, hat, x + 4, y - 32, 3, 3);
  }
}
function paintMill(canvas: HTMLCanvasElement, state: MillState) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const evening = state.day === 3;
  const sky = g.createLinearGradient(0, 0, 0, 218);
  sky.addColorStop(0, evening ? '#8b9a9b' : '#83afbd');
  sky.addColorStop(0.67, evening ? '#f4cf9f' : '#e0d8ba');
  sky.addColorStop(1, '#e9cda6');
  rect(g, '#8fa9a3', 0, 0, 960, 330);
  g.fillStyle = sky;
  g.fillRect(0, 0, 960, 192);
  const sunX = evening ? 800 : state.day === 2 ? 665 : state.day === 1 ? 460 : 229;
  const sunY = evening ? 105 : state.day === 1 ? 36 : 62;
  const glow = g.createRadialGradient(sunX, sunY, 12, sunX, sunY, 66);
  glow.addColorStop(0, '#ffeab888');
  glow.addColorStop(1, '#ffe8b000');
  g.fillStyle = glow;
  g.fillRect(sunX - 66, sunY - 66, 132, 132);
  ellipse(g, '#ffe6ad', sunX, sunY, 17, 17);
  for (let i = 0; i < 12; i++) {
    const x = i * 98 + 12,
      y = 30 + ((i * 31) % 78);
    polygon(
      g,
      '#ffefd14a',
      [x, y],
      [x + 14, y - 3],
      [x + 31, y - 2],
      [x + 39, y - 4],
      [x + 65, y - 2],
      [x + 55, y + 1]
    );
  }
  polygon(
    g,
    '#9baea7',
    [0, 125],
    [52, 104],
    [99, 124],
    [162, 90],
    [189, 109],
    [255, 79],
    [289, 90],
    [336, 127],
    [409, 100],
    [442, 113],
    [492, 84],
    [527, 106],
    [567, 90],
    [625, 115],
    [696, 87],
    [741, 103],
    [787, 83],
    [829, 113],
    [888, 96],
    [960, 111],
    [960, 180],
    [0, 180]
  );
  polygon(
    g,
    '#809992',
    [0, 145],
    [81, 126],
    [122, 137],
    [185, 115],
    [234, 133],
    [285, 111],
    [345, 142],
    [395, 126],
    [443, 136],
    [509, 115],
    [570, 132],
    [602, 120],
    [665, 142],
    [732, 117],
    [786, 130],
    [864, 118],
    [898, 131],
    [960, 106],
    [960, 173],
    [0, 173]
  );
  rect(g, '#779e9e', 0, 157, 960, 117);
  for (let i = 0; i < 83; i++) {
    const x = (i * 137) % 960,
      y = 159 + ((i * 17) % 98);
    rect(g, i % 3 ? '#bad1bc91' : '#5c8b8d', x, y, 4 + ((i * 7) % 46), 1);
  }
  for (let i = 0; i < 20; i++) {
    const x = i * 47,
      y = 149 - ((i * 7) % 6),
      w = 11 + ((i * 3) % 13);
    rect(g, '#9f9e89', x, y, w, 158 - y);
    polygon(g, '#847d71', [x - 2, y], [x + 5, y - 6], [x + w - 3, y - 6], [x + w + 2, y]);
  }
  // A distant lateen boat gives the wind a second visible cue.
  stroke(g, '#675e4a', 1.5, [722, 146], [722, 173]);
  polygon(g, '#e8d6b1', [720, 147], [705, 168], [720, 167]);
  polygon(g, '#b77958', [724, 154], [733, 165], [724, 166]);
  polygon(g, '#665b47', [702, 169], [738, 169], [731, 174], [711, 174]);
  // Grassy headland, terraces and worn footpaths around the mill.
  polygon(
    g,
    '#7b8560',
    [0, 217],
    [106, 202],
    [251, 211],
    [381, 189],
    [494, 178],
    [594, 184],
    [684, 199],
    [754, 224],
    [807, 259],
    [846, 279],
    [960, 313],
    [960, 330],
    [0, 330]
  );
  polygon(
    g,
    '#b0a67c',
    [0, 277],
    [194, 261],
    [297, 234],
    [407, 222],
    [504, 204],
    [523, 209],
    [430, 244],
    [365, 256],
    [551, 269],
    [665, 254],
    [737, 238],
    [760, 244],
    [659, 271],
    [546, 287],
    [386, 276],
    [269, 263],
    [0, 308]
  );
  polygon(
    g,
    '#77745a',
    [0, 301],
    [142, 284],
    [292, 277],
    [364, 291],
    [493, 296],
    [634, 281],
    [750, 256],
    [866, 302],
    [960, 323],
    [960, 330],
    [0, 330]
  );
  for (let i = 0; i < 90; i++) {
    const x = (i * 173) % 780,
      y = 291 + ((i * 29) % 36);
    stroke(g, i % 3 ? '#92966d' : '#b0a77e', 1, [x, y], [x - 2, y - 4], [x + 1, y - 1], [x + 3, y - 6]);
  }
  // Tile-roofed bakery, oven opening and a small row of first customers.
  rect(g, '#715c46', 40, 190, 174, 65);
  rect(g, '#b79165', 48, 193, 156, 57);
  rect(g, '#78765f', 62, 158, 13, 26);
  rect(g, '#6a6757', 59, 157, 18, 5);
  polygon(g, '#694b3f', [26, 197], [59, 161], [183, 157], [224, 188], [214, 197]);
  for (let i = 0; i < 7; i++) stroke(g, '#996751', 2, [41 + i * 3, 191 - i * 4], [203 - i * 4, 187 - i * 4]);
  rect(g, '#594b39', 58, 204, 37, 47);
  ellipse(g, '#554a3a', 76.5, 204, 18.5, 10);
  rect(g, '#423d32', 64, 208, 25, 40);
  ellipse(g, '#e9a355', 76, 235, 9, 8);
  rect(g, '#5e4e3b', 113, 201, 79, 27);
  rect(g, '#d4b586', 117, 204, 71, 20);
  g.fillStyle = '#4c4638';
  g.textAlign = 'center';
  g.font = 'bold 12px serif';
  g.fillText('街 口 饼 铺', 151, 219);
  rect(g, '#634e38', 112, 232, 64, 6);
  rect(g, '#6c533c', 118, 237, 4, 13);
  rect(g, '#6c533c', 167, 237, 4, 13);
  person(g, 209, 262, '#a86f58', '#51483c', false);
  for (let i = 0; i < state.street; i++)
    sack(g, 148 + (i % 3) * 13, 258 - Math.floor(i / 3) * 11, '#cfad77', '#875b3e');
  // Elevated pier and the skipper's freight boat.
  [707, 752, 804, 862, 920].forEach((x) => rect(g, '#735c48', x, 233, 6, 41));
  polygon(g, '#a18b66', [681, 226], [937, 226], [955, 236], [697, 240]);
  stroke(g, '#645c47', 3, [694, 239], [953, 236]);
  for (let i = 0; i < 27; i++) stroke(g, '#776d53', 1, [690 + i * 9, 227], [703 + i * 9, 236]);
  polygon(
    g,
    '#544d3c',
    [741, 203],
    [769, 211],
    [906, 207],
    [944, 189],
    [923, 215],
    [888, 221],
    [783, 224],
    [758, 218]
  );
  stroke(g, '#c99760', 2, [748, 208], [771, 215], [905, 211], [933, 199]);
  stroke(g, '#594f3c', 3, [840, 125], [840, 210]);
  stroke(g, '#746e54', 1, [839, 129], [777, 210]);
  stroke(g, '#746e54', 1, [841, 128], [921, 208]);
  polygon(g, '#c78d68', [835, 138], [798, 194], [836, 188]);
  polygon(g, '#eed9b0', [844, 147], [884, 184], [844, 189]);
  stroke(g, '#916f4f', 1, [814, 170], [835, 166]);
  stroke(g, '#916f4f', 1, [808, 181], [835, 177]);
  person(g, 775, 236, '#405a65', '#363d39', true);
  for (let i = 0; i < state.ship; i++)
    sack(g, 862 + (i % 3) * 12, 210 - Math.floor(i / 3) * 10, '#eee0b7', '#7b928b');
  // Whitewashed stone mill and its low timber annex.
  ellipse(g, '#4a564845', 495, 220, 112, 14);
  polygon(g, '#c9bd99', [451, 101], [521, 101], [540, 215], [432, 215]);
  polygon(g, '#ad9d7b', [505, 102], [520, 101], [541, 215], [510, 215]);
  for (let i = 0; i < 33; i++) {
    const x = 453 + ((i * 19) % 62),
      y = 116 + ((i * 27) % 90);
    stroke(g, '#a69778a8', 1, [x, y], [x + 8, y]);
  }
  polygon(g, '#705d48', [439, 107], [456, 85], [469, 73], [482, 65], [496, 69], [517, 82], [531, 103], [525, 108]);
  stroke(g, '#a58259', 2, [443, 104], [525, 101]);
  rect(g, '#524e40', 473, 181, 23, 34);
  ellipse(g, '#524e40', 484.5, 182, 11.5, 7);
  rect(g, '#ac9168', 474, 186, 9, 28);
  rect(g, '#5c6256', 460, 142, 9, 13);
  rect(g, '#967b57', 538, 179, 70, 37);
  polygon(g, '#745947', [530, 181], [546, 163], [592, 162], [616, 179]);
  person(g, 530, 225, '#50716c', '#544c3d', true);
  for (let i = 0; i < state.grain; i++)
    sack(g, 556 + (i % 3) * 15, 224 - Math.floor(i / 3) * 12, '#d0b180', '#805f41');
  for (let i = 0; i < Math.min(6, state.coarse); i++)
    sack(g, 432 - (i % 3) * 14, 227 - Math.floor(i / 3) * 11, '#d5b583', '#9a6949');
  for (let i = 0; i < state.fine; i++)
    sack(g, 607 + (i % 3) * 12, 229 - Math.floor(i / 3) * 10, '#f1e0bc', '#728b83');
  stroke(g, '#685d49', 2, [636, 168], [636, 224]);
  const droop = state.day === 3 ? 20 : state.day === 1 ? 1 : 8;
  polygon(g, '#b6684e', [636, 167], [664, 165 + droop], [671, 162 + droop], [669, 171 + droop], [636, 174]);
  stroke(g, '#f1d39e', 4, [645, 170 + droop * 0.25], [645, 174 + droop * 0.25]);
}

function rigSails(canvas: HTMLCanvasElement, reefed: boolean) {
  const g = canvas.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, 200, 200);
  g.save();
  g.translate(100, 100);
  g.rotate(0.36);
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 2);
    stroke(g, '#6d5743', 4, [0, 1], [0, -91]);
    stroke(g, '#8f7050', 2, [0, -87], [21, -87], [15, -31], [0, -31]);
    polygon(g, '#eee1b7', [2, -86], [20, -86], [reefed ? 17 : 14, reefed ? -59 : -33], [2, reefed ? -59 : -33]);
    for (let j = 0; j < 6; j++) stroke(g, '#9c8765', 1, [1, -82 + j * 9], [20 - j, -82 + j * 9]);
    stroke(g, '#aa8a62', 1, [7, -85], [6, -32]);
  }
  ellipse(g, '#6a533d', 0, 0, 7, 7);
  ellipse(g, '#bb9366', 0, 0, 3, 3);
  g.restore();
}

const actions: MillAction[] = ['grind', 'sail', 'sift', 'street', 'ship', 'close'];
export function mountMill(host: HTMLElement, ctx: ChapterContext): void {
  const restored = restoreMill(ctx.load());
  let state = restored ?? newMill();
  host.innerHTML = `<section class="mill-play" aria-label="风起磨坊">
  <div class="mill-view">
    <canvas class="mill-hills" width="960" height="330" aria-hidden="true"></canvas>
    <canvas class="mill-wings" width="200" height="200" aria-hidden="true"></canvas>
    <span class="mill-wind" data-mill-wind></span>
    <button class="mill-marker mill-at-bakery" data-mill-hit="street" aria-label="向饼铺送一袋粗粉">饼铺</button>
    <button class="mill-marker mill-at-wheel" data-mill-hit="grind" aria-label="放粮抬闸磨米">抬闸</button>
    <button class="mill-marker mill-at-ship" data-mill-hit="ship" aria-label="向渡船送一袋细粉">渡船</button>
    <span class="mill-sack mill-coarse-sack" data-haul="street" title="拖一袋粗粉给饼铺" aria-hidden="true" hidden>粗</span>
    <span class="mill-sack mill-fine-sack" data-haul="ship" title="拖一袋细粉给渡船" aria-hidden="true" hidden>细</span>
  </div>
  <div class="mill-desk">
    <div class="mill-bench">
      <div class="mill-panel-title"><h2>磨台</h2><span data-mill-stock></span></div>
      <p class="mill-hint" data-mill-hint></p>
      <div class="mill-work">
        <button type="button" class="mill-brass" data-mill="grind">抬闸磨米</button>
        <button type="button" data-mill="sail"></button>
        <button type="button" data-mill="sift">筛一袋细粉</button>
      </div>
      <p class="mill-trough" aria-live="polite" aria-atomic="true" data-mill-trough></p>
    </div>
    <div class="mill-orders">
      <div class="mill-panel-title"><h2>上门取货</h2><span data-mill-wallet></span></div>
      <div class="mill-ticket"><div><strong>周婶的饼铺</strong><small>粗粉每袋 2 枚</small></div><span data-mill-street></span><button type="button" data-mill="street">递粗粉</button></div>
      <div class="mill-ticket"><div><strong>船队的干粮</strong><small>细粉每袋 5 枚</small></div><span data-mill-ship></span><button type="button" data-mill="ship">递细粉</button></div>
    </div>
  </div>
  <div class="mill-close" hidden><span data-mill-evening></span><button type="button" data-mill="close">落闸收工</button></div>
  </section>`;
  const ui = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
  const actionButton = (action: MillAction) => ui<HTMLButtonElement>(`[data-mill="${action}"]`);
  const render = () => {
    const { day, reefed, grain, coarse, fine, street, ship, closed } = state;
    paintMill(ui<HTMLCanvasElement>('.mill-hills'), state);
    rigSails(ui<HTMLCanvasElement>('.mill-wings'), reefed);
    const wings = ui('.mill-wings');
    wings.style.animationDuration = day === 1 ? '3.2s' : '7s';
    wings.style.animationPlayState = day >= 3 ? 'paused' : 'running';
    ui('[data-mill-wind]').textContent = day < 3 ? `第 ${day + 1} 阵风 · ${gusts[day]}` : '傍晚 · 风已停';
    ui('[data-mill-stock]').textContent = `仓里还有 ${grain} 袋米`;
    ui('[data-mill-wallet]').textContent = `钱匣 ${receipts(state)} 枚`;
    ui('[data-mill-trough]').textContent = `粉槽　粗粉 ${coarse} 袋 · 细粉 ${fine} 袋`;
    ui('[data-mill-street]').textContent = `${street} / ${streetOrder} 袋`;
    ui('[data-mill-ship]').textContent = `${ship} / ${shipOrder} 袋`;
    ui('[data-mill-hint]').textContent =
      day === 3
        ? '磨盘歇了，槽里的粗粉还可以过筛、交货。'
        : `帆已${reefed ? '收半' : '张满'}，这一阵能磨 ${ripeWind(state) ? 2 : 1} 袋米。张帆接轻风，半帆吃强风。`;
    actionButton('sail').textContent = reefed ? '张满帆' : '收半帆';
    actionButton('sift').textContent = '筛细粉（2 换 1）';
    for (const action of actions) actionButton(action).disabled = workMill(state, action) === state;
    for (const action of ['street', 'ship'] as const)
      ui(`[data-haul="${action}"]`).hidden = actionButton(action).disabled;
    host.querySelectorAll<HTMLButtonElement>('[data-mill-hit]').forEach((b) => {
      b.disabled = actionButton(b.dataset.millHit as MillAction).disabled;
    });
    ui('.mill-close').hidden = day < 3 || closed;
    ui('[data-mill-evening]').textContent =
      coarse + fine > 0 ? `槽里还剩 ${coarse + fine} 袋粉，收工后将留仓。` : '最后的风过去了，可以收工了。';
  };
  const announce = () => {
    const [speaker, zh, en] = millLines[state.line];
    ctx.say(speaker, zh, en);
  };
  host.querySelectorAll<HTMLButtonElement>('[data-mill],[data-mill-hit]').forEach((b) => {
    b.onclick = () => {
      const action = (b.dataset.mill || b.dataset.millHit) as MillAction;
      const next = workMill(state, action);
      if (next === state) return;
      state = next;
      ctx.save(state);
      render();
      announce();
      if (state.closed) ctx.finish(millEnding(state));
    };
  });
  const stage = ui('.mill-view');
  host.querySelectorAll<HTMLElement>('[data-haul]').forEach((sack) => {
    const destination = sack.dataset.haul as 'street' | 'ship';
    let hand: { id: number; x: number; y: number } | null = null;
    const drop = () => {
      hand = null;
      sack.style.translate = '';
      sack.classList.remove('in-hand');
      ui(`[data-mill-hit="${destination}"]`).classList.remove('awaiting-sack');
    };
    sack.onpointerdown = (e) => {
      if (e.button || hand || actionButton(destination).disabled) return;
      hand = { id: e.pointerId, x: e.clientX, y: e.clientY };
      sack.setPointerCapture(e.pointerId);
      sack.classList.add('in-hand');
      ui(`[data-mill-hit="${destination}"]`).classList.add('awaiting-sack');
      e.preventDefault();
    };
    sack.onpointermove = (e) => {
      if (hand?.id === e.pointerId) sack.style.translate = `${e.clientX - hand.x}px ${e.clientY - hand.y}px`;
    };
    sack.onpointerup = (e) => {
      if (hand?.id !== e.pointerId) return;
      const rect = stage.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width,
        y = (e.clientY - rect.top) / rect.height;
      const overBuyer = destination === 'street' ? x >= 0 && x < 0.3 : x > 0.72 && x <= 1;
      drop();
      if (overBuyer && y > 0.4 && y <= 1) actionButton(destination).click();
    };
    sack.onlostpointercapture = drop;
    sack.onpointercancel = drop;
  });
  render();
  announce();
  if (state.closed) ctx.finish(millEnding(state));
}
