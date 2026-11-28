import { waitingMorning } from './morning-model.ts';
import type { MorningLoad, MorningState, MorningTrip } from './morning-model.ts';

export type MorningScene = { state: MorningState; bridgeLamps?: number; departing?: MorningTrip };
type Hit =
  | { kind: 'queue'; index: number; load: MorningLoad }
  | { kind: 'seat'; index: number }
  | { kind: 'board' | 'boat' };
type Brush = CanvasRenderingContext2D;
type Point = readonly [number, number];

const width = 960;
const height = 420;
const seatX = [531, 620, 709] as const;
const queueStart = 267;
const queueGap = 69;
const queueFloor = 278;

/** Keep the waiting line and the hit boxes in the same order, including two parcels of one kind. */
export function morningQueue(state: MorningState): MorningLoad[] {
  const waiting = waitingMorning(state);
  const types: MorningLoad[] = ['passenger', 'crate', 'eggs'];
  const queue: MorningLoad[] = [];
  const rows = Math.max(...types.map((kind) => waiting[kind]));
  for (let row = 0; row < rows; row++) {
    for (const kind of types) if (waiting[kind] > row) queue.push(kind);
  }
  return queue;
}

/** A settled landing area for unloading even when the last person has boarded. */
export function morningLanding(nx: number, ny: number): boolean {
  const x = nx * width,
    y = ny * height;
  if (x < 222 || x > 788) return false;
  return y >= 231 && y <= 348 - x * 0.106;
}

export function morningHit(nx: number, ny: number, scene: MorningScene): Hit | null {
  const x = nx * width,
    y = ny * height;
  if (x < 0 || x > width || y < 0 || y > height || scene.departing) return null;
  if (x >= 32 && x <= 217 && y >= 130 && y <= 294) return { kind: 'board' };
  if (scene.state.phase !== 'boarding') return null;
  const index = Math.round((x - queueStart) / queueGap);
  const queue = morningQueue(scene.state);
  const load = queue[index];
  const firstCrate = queue.indexOf('crate');
  if (firstCrate >= 0 && x >= 672 && x <= 758 && y >= 197 && y <= 266) {
    return { kind: 'queue', index: firstCrate, load: 'crate' };
  }
  if (
    load &&
    Math.abs(x - queueStart - index * queueGap) <= 32 &&
    y >= queueFloor - (load === 'crate' ? 46 : 76) &&
    y <= queueFloor + 9
  ) {
    return { kind: 'queue', index, load };
  }
  const seat = seatX.findIndex((sx) => Math.abs(x - sx) <= 43 && y >= 272 && y <= 365);
  if (seat >= 0) return { kind: 'seat', index: seat };
  if (x >= 431 && x <= 902 && y >= 296 && y <= 388) return { kind: 'boat' };
  return null;
}

function shape(g: Brush, ink: string, ...points: Point[]) {
  g.fillStyle = ink;
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
}
function stroke(g: Brush, ink: string, weight: number, ...points: Point[]) {
  g.strokeStyle = ink;
  g.lineWidth = weight;
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
}
function oval(g: Brush, x: number, y: number, rx: number, ry: number, ink: string) {
  g.fillStyle = ink;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}
function lettering(g: Brush, x: number, y: number, text: string, size: number, ink: string) {
  g.font = '600 ' + size + 'px "Songti SC","STSong","SimSun",serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = ink;
  g.fillText(text, x, y);
}
function noise(n: number) {
  const x = Math.sin(n * 127.1 + 68.3) * 43758.5453;
  return x - Math.floor(x);
}
function distantRoof(g: Brush, x: number, y: number, scale: number, ink: string) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.fillStyle = '#c2b994';
  g.fillRect(-13, -14, 27, 14);
  shape(g, ink, [-20, -13], [-11, -22], [8, -24], [20, -15], [14, -12], [-12, -11]);
  g.fillStyle = '#657c70';
  g.fillRect(-6, -9, 4, 9);
  g.fillRect(5, -8, 3, 4);
  g.restore();
}
function horizon(g: Brush, dayTwo: boolean, lamps: number) {
  const sky = g.createLinearGradient(0, 0, 0, 177);
  sky.addColorStop(0, dayTwo ? '#91adb0' : '#86a5a9');
  sky.addColorStop(0.68, dayTwo ? '#f3c489' : '#e0c399');
  sky.addColorStop(1, '#e9d6a8');
  g.fillStyle = sky;
  g.fillRect(0, 0, width, height);
  const sunX = dayTwo ? 753 : 704,
    sunY = dayTwo ? 65 : 89;
  const halo = g.createRadialGradient(sunX, sunY, 1, sunX, sunY, 106);
  halo.addColorStop(0, '#ffdd9a99');
  halo.addColorStop(1, '#ffeaa000');
  g.fillStyle = halo;
  g.fillRect(sunX - 106, sunY - 106, 212, 212);
  oval(g, sunX, sunY, 18, 18, '#ffebaf');
  for (let i = 0; i < 12; i++) {
    const x = noise(i + 1) * width,
      y = 19 + noise(i + 2) * 68;
    oval(g, x, y, 15 + noise(i + 4) * 50, 1.6, '#fff0c83d');
  }
  shape(
    g,
    '#b5b69d',
    [0, 112],
    [55, 80],
    [90, 88],
    [146, 62],
    [202, 78],
    [235, 66],
    [317, 103],
    [361, 94],
    [412, 107],
    [465, 92],
    [507, 99],
    [555, 72],
    [578, 76],
    [609, 63],
    [679, 98],
    [750, 100],
    [800, 83],
    [872, 85],
    [931, 61],
    [960, 75],
    [960, 170],
    [0, 170]
  );
  shape(
    g,
    '#879d8e',
    [0, 127],
    [73, 102],
    [136, 113],
    [217, 85],
    [257, 92],
    [301, 112],
    [347, 105],
    [402, 121],
    [495, 125],
    [580, 107],
    [621, 102],
    [682, 119],
    [777, 110],
    [831, 91],
    [893, 110],
    [960, 92],
    [960, 174],
    [0, 174]
  );
  shape(
    g,
    '#acb599',
    [0, 142],
    [119, 133],
    [214, 146],
    [336, 129],
    [452, 144],
    [546, 131],
    [706, 144],
    [834, 119],
    [960, 129],
    [960, 170],
    [0, 170]
  );
  for (let i = 0; i < 24; i++) {
    const x = 12 + i * 43 + noise(i) * 20,
      y = 147 + noise(i + 30) * 10;
    if (x > 247 && x < 617) continue;
    distantRoof(g, x, y, 0.48 + noise(i + 33) * 0.46, i % 3 === 0 ? '#927360' : '#758475');
  }
  const sea = g.createLinearGradient(0, 159, 0, height);
  sea.addColorStop(0, '#9baea0');
  sea.addColorStop(0.31, dayTwo ? '#749c8d' : '#779b91');
  sea.addColorStop(1, '#315f60');
  g.fillStyle = sea;
  g.fillRect(0, 157, width, height - 157);
  for (let i = 0; i < 200; i++) {
    const x = noise(i + 231) * width,
      y = 158 + noise(i + 67) * (height - 158);
    const w = (1 + (y - 158) / 55) * (1 + noise(i + 31) * 3.4);
    const gleam = Math.abs(x - sunX + Math.sin(y / 19) * 9) < (y - 115) * 0.43;
    stroke(
      g,
      gleam ? '#edd79799' : i % 4 === 0 ? '#c8ccad70' : '#447a754c',
      y > 247 ? 1.4 : 1,
      [x, y],
      [x + w, y - 0.5],
      [x + w * 1.45, y - 0.4]
    );
  }
  // Stone arches reveal the water behind them.
  const start = 273,
    span = 52,
    end = start + 6 * span;
  g.fillStyle = '#76877a';
  g.beginPath();
  g.moveTo(start, 135);
  g.quadraticCurveTo((start + end) / 2, 102, end, 135);
  g.lineTo(end, 160);
  for (let i = 5; i >= 0; i--) {
    const x = start + i * span,
      crown = 137 - Math.sin(((i + 0.5) / 6) * Math.PI) * 12;
    g.lineTo(x + span - 6, 160);
    g.lineTo(x + span - 6, 148);
    g.bezierCurveTo(x + span - 6, crown, x + 6, crown, x + 6, 148);
    g.lineTo(x + 6, 160);
    g.lineTo(x, 160);
  }
  g.closePath();
  g.fill();
  for (let i = 0; i <= 12; i++) {
    const t = i / 12,
      x = start + (end - start) * t,
      y = 135 - 66 * t * (1 - t);
    stroke(g, '#626e5e', 1.5, [x, y], [x, y - 5]);
    if (i < 12) stroke(g, '#758475', 1, [x, y - 3], [x + 26, 132 - 66 * (t + 1 / 12) * (1 - t - 1 / 12)]);
  }
  for (let i = 0; i < lamps; i++) {
    const x = start + 17 + i * 54,
      t = (x - start) / (end - start),
      y = 125 - 66 * t * (1 - t);
    oval(g, x, y, 6, 5, '#ffe6a040');
    oval(g, x, y, 2.3, 3, '#ffe5a4');
    stroke(g, '#857b67', 1, [x, y + 3], [x, y + 8]);
  }
  for (let i = 0; i < 5; i++) {
    const x = 540 + i * 15,
      y = 45 + Math.sin(i) * 5;
    stroke(g, '#626e65', 1.1, [x - 4, y - 2], [x, y], [x + 4, y - 3]);
  }
}
function deck(g: Brush) {
  for (const [x, bottom] of [
    [29, 411],
    [225, 379],
    [445, 347],
    [635, 326],
    [760, 305],
  ] as const) {
    shape(g, '#67513d', [x - 6, 273], [x + 4, 272], [x + 2, bottom], [x - 7, bottom + 1]);
    stroke(g, '#aa936e', 2, [x - 3, 285], [x - 4, bottom - 3]);
    oval(g, x - 2, bottom + 3, 10, 1.5, '#315c58');
  }
  shape(g, '#514d3b', [0, 304], [787, 265], [750, 289], [0, 356]);
  shape(g, '#bea17a', [0, 235], [722, 233], [795, 264], [0, 348]);
  g.save();
  g.clip(); // The boardwalk lines follow the same vanishing point.
  for (let i = 0; i < 32; i++) {
    const x = i * 43 - 140;
    stroke(g, '#86795c', 1.6, [x, 231], [x - 65, 355]);
    stroke(g, '#dec395', 1, [x + 2, 231], [x - 62, 355]);
  }
  for (let i = 0; i < 73; i++) {
    const x = noise(i + 40) * 800,
      y = 237 + noise(i + 53) * 101;
    stroke(g, '#937b588c', 1, [x, y], [x + 11 + noise(i + 3) * 13, y - 0.6]);
  }
  g.restore();
  stroke(g, '#ddbf8c', 2.4, [0, 348], [795, 264]);
  for (const x of [27, 709, 775]) {
    const y = x === 27 ? 333 : x === 709 ? 272 : 266;
    shape(g, '#614d38', [x - 4, y + 2], [x + 4, y + 2], [x + 5, y - 26], [x - 3, y - 26]);
    oval(g, x + 1, y - 26, 4.5, 2, '#b9aa7f');
    stroke(g, '#dcc392', 2, [x - 4, y - 17], [x + 5, y - 18]);
  }
  g.strokeStyle = '#5a5641';
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(711, 254);
  g.quadraticCurveTo(740, 274, 776, 249);
  g.stroke();
}
function timetable(g: Brush, state: MorningState) {
  oval(g, 112, 301, 106, 9, '#343d342d');
  // Shelter with a long upturned tile roof and a lacquered destination board.
  shape(g, '#87654a', [25, 115], [42, 111], [42, 301], [31, 306]);
  shape(g, '#584935', [192, 115], [203, 111], [199, 280], [190, 282]);
  shape(g, '#ba9566', [28, 117], [35, 116], [35, 301], [30, 301]);
  shape(g, '#493e31', [14, 120], [207, 111], [211, 116], [18, 128]);
  shape(g, '#62706a', [4, 115], [27, 111], [55, 85], [154, 76], [192, 98], [224, 102], [210, 113], [25, 125]);
  shape(g, '#434e48', [8, 116], [44, 109], [164, 97], [210, 104], [224, 102], [211, 113], [27, 125]);
  for (let i = 0; i < 14; i++) {
    const x = 55 + i * 7.4;
    stroke(g, '#8e9583', 1.4, [x, 85 - (x - 55) * 0.085], [x + 10, 104 - (x - 55) * 0.075]);
  }
  stroke(g, '#394944', 3, [52, 84], [154, 75], [162, 78]);
  shape(g, '#5f4632', [45, 130], [178, 122], [179, 150], [45, 156]);
  lettering(g, 112, 140, '雾 港 渡 口', 17, '#f0d99e');
  stroke(g, '#715938', 2.5, [59, 150], [61, 167]);
  stroke(g, '#715938', 2.5, [163, 144], [161, 161]);
  shape(g, '#543e2e', [47, 165], [175, 157], [176, 252], [47, 263]);
  shape(g, '#a8895e', [51, 168], [171, 161], [172, 247], [51, 257]);
  shape(g, '#304d44', [56, 173], [166, 166], [166, 242], [56, 250]);
  if (state.phase === 'covered') {
    shape(
      g,
      '#baa582',
      [53, 168],
      [167, 162],
      [174, 227],
      [156, 230],
      [144, 226],
      [123, 236],
      [108, 228],
      [87, 238],
      [76, 231],
      [53, 242]
    );
    stroke(g, '#d6c09a', 2, [70, 169], [76, 231]);
    stroke(g, '#8d7a5a', 1.6, [120, 167], [124, 231]);
    stroke(g, '#e3c99b', 1.3, [147, 165], [156, 228]);
    lettering(g, 108, 199, '揭开旧牌', 16, '#4a4535');
    stroke(g, '#dcb882', 2, [161, 166], [182, 190], [184, 218]);
    oval(g, 184, 221, 3, 5, '#c58b48');
  } else {
    const title =
      state.board === 'early'
        ? '明早头班'
        : state.board === 'flex'
          ? '随到开船'
          : state.phase === 'posting'
            ? '明早船期'
            : '今日有渡';
    lettering(g, 111, 186, '◆  船  班  ◆', 12, '#d1b981');
    stroke(g, '#7c8971', 1, [66, 201], [157, 196]);
    lettering(g, 111, 218, title, 18, '#f2d89b');
    for (const [x, y] of [
      [61, 177],
      [161, 171],
      [61, 244],
      [161, 237],
    ] as const)
      oval(g, x, y, 1.5, 1.5, '#b6965d');
  }
  // An oil lamp hangs from the projecting eave.
  stroke(g, '#685b43', 1.8, [202, 113], [202, 143]);
  stroke(g, '#493d30', 3, [194, 143], [210, 143]);
  shape(g, '#b69663', [195, 145], [208, 145], [211, 154], [205, 165], [197, 165], [192, 154]);
  shape(g, '#f0cb82', [198, 147], [206, 147], [207, 156], [202, 162], [198, 158]);
  stroke(g, '#62513a', 2, [196, 166], [207, 166]);
}
type Figure = 'aunt' | 'customer' | 'trader' | 'skipper' | 'merchant';
function figure(g: Brush, x: number, y: number, size: number, who: Figure, variant = 0) {
  g.save();
  g.translate(x, y);
  g.scale(size, size);
  const aunt = who === 'aunt',
    trader = who === 'trader',
    captain = who === 'skipper';
  const merchant = who === 'merchant';
  const coat = merchant
    ? '#ad7952'
    : aunt
      ? '#995c4c'
      : trader
        ? '#68866d'
        : captain
          ? '#436967'
          : variant % 2
            ? '#9b794f'
            : '#596e81';
  oval(g, 0, 0, 14, 3, '#47473355');
  if (trader) {
    g.strokeStyle = '#72563a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-29, -47);
    g.quadraticCurveTo(0, -57, 31, -46);
    g.stroke();
    for (const sx of [-26, 27]) {
      stroke(g, '#705d40', 1, [sx, -46], [sx - 8, -20]);
      stroke(g, '#705d40', 1, [sx, -46], [sx + 8, -20]);
      basket(g, sx, -14, 0.68, true);
    }
  }
  shape(g, '#47483e', [-9, -25], [-1, -26], [-4, -4], [-9, -3]);
  shape(g, '#555447', [1, -25], [11, -25], [10, -3], [5, -3]);
  oval(g, -9, -2, 6, 2.6, '#373b32');
  oval(g, 9, -2, 5.5, 2.6, '#373b32');
  shape(
    g,
    coat,
    [-7, -55],
    [2, -58],
    [9, -55],
    [13, -40],
    [12, -25],
    [aunt ? 16 : 11, -20],
    [-12, -20],
    [-11, -38],
    [-14, -38]
  );
  shape(g, '#ffffff22', [-7, -54], [-3, -51], [-4, -24], [-9, -25]);
  stroke(g, '#463d32', 1, [2, -54], [-2, -46], [-1, -26]);
  shape(g, '#d8ad83', [-4, -59], [4, -58], [5, -53], [-2, -51]);
  oval(g, 0, -62, 8.4, 10, '#dbad7d');
  oval(g, -7.5, -61, 2, 3, '#cc9e71');
  oval(g, -1, -69, 8.5, 4.9, '#51483e');
  shape(g, '#51483e', [-8, -69], [-5, -70], [-5, -62], [-8, -60]);
  stroke(g, '#654936', 1, [2, -64], [5, -64]);
  stroke(g, '#97674b', 1, [4, -58], [6, -59]);
  if (aunt) {
    oval(g, -8, -69, 5.3, 5.4, '#6e6a58');
    stroke(g, '#d5c2a0', 1.7, [-11, -71], [-4, -73], [3, -70]);
  } else if (merchant) {
    oval(g, -8, -68, 4.9, 5, '#52493b');
    stroke(g, '#ded0a4', 1.8, [-8, -69], [-1, -72], [5, -70]);
    shape(g, '#658376', [-9, -49], [-4, -45], [7, -45], [10, -23], [-10, -23]);
  } else if (captain) {
    shape(g, '#624f3c', [-14, -68], [-10, -70], [-4, -77], [7, -76], [9, -72], [17, -69], [12, -67]);
  } else if (trader || variant % 2) {
    shape(g, '#ae8b58', [-13, -68], [-1, -78], [13, -69], [7, -67], [-5, -66]);
  } else {
    stroke(g, '#597275', 3, [-8, -68], [0, -70], [6, -68]);
  }
  shape(g, coat, [-10, -51], [-14, -44], [-8, -35], [2, -39], [1, -44], [-7, -42]);
  oval(g, 3, -41, 4, 2.6, '#d4a780');
  if (aunt) {
    shape(g, '#f5deb2', [3, -45], [13, -47], [15, -40], [5, -38]);
    stroke(g, '#ae6a48', 1, [6, -42], [12, -43]);
  }
  if (captain) {
    stroke(g, '#aa835c', 2.7, [3, -44], [16, -40], [22, -40]);
  }
  g.restore();
}
function basket(g: Brush, x: number, y: number, scale: number, eggs: boolean) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  shape(g, '#9d754a', [-15, -6], [15, -6], [10, 8], [-10, 8]);
  oval(g, 0, -6, 15, 4, '#775b3f');
  if (eggs)
    for (let i = 0; i < 5; i++)
      oval(
        g,
        -9 + (i % 3) * 8 + (i > 2 ? 3 : 0),
        -8 - Math.floor(i / 3) * 4,
        3.8,
        4.7,
        i % 2 ? '#ead3a4' : '#f8e6be'
      );
  for (const y of [-2, 2, 5]) stroke(g, '#c39d69', 1, [-13 + (y + 2) * 0.3, y], [13 - (y + 2) * 0.3, y]);
  g.restore();
}
function crate(g: Brush, x: number, y: number, scale: number) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  oval(g, 0, 0, 20, 3, '#514f3b55');
  shape(g, '#997146', [-19, -26], [9, -27], [9, -1], [-19, -2]);
  shape(g, '#82613e', [9, -27], [19, -33], [19, -6], [9, -1]);
  shape(g, '#c49a63', [-19, -26], [-9, -33], [19, -33], [9, -26]);
  for (let i = 1; i < 4; i++)
    stroke(g, '#775937', 1, [-18, -26 + i * 6], [9, -26 + i * 6], [18, -32 + i * 6]);
  stroke(g, '#e0ba78', 3, [-11, -29], [-3, -25], [-3, -2]);
  stroke(g, '#d9b478', 2, [12, -29], [12, -5]);
  shape(g, '#b5503f', [-14, -17], [-7, -17], [-7, -10], [-14, -10]);
  g.restore();
}
function boat(
  g: Brush,
  x: number,
  y: number,
  size: number,
  cargo: MorningLoad[],
  passengerOffset: number,
  sailing: boolean
) {
  g.save();
  g.translate(x, y);
  g.scale(size, size);
  oval(g, 0, 9, 214, 13, '#234d4d77');
  if (sailing) {
    stroke(g, '#f0e1b07d', 3.5, [-176, 7], [-243, 12], [-270, 10]);
    stroke(g, '#e6dfb37a', 2, [-202, 14], [-273, 21], [-305, 21]);
  }
  const hull: Point[] = [
    [-231, -30],
    [-205, -23],
    [-168, -21],
    [155, -20],
    [187, -25],
    [231, -54],
    [247, -56],
    [227, -23],
    [196, -2],
    [134, 9],
    [-119, 13],
    [-178, 7],
    [-205, -4],
  ];
  shape(g, '#4e4233', ...hull);
  shape(
    g,
    '#b48a57',
    [-226, -29],
    [-176, -31],
    [145, -35],
    [196, -42],
    [242, -56],
    [214, -32],
    [158, -19],
    [-169, -16],
    [-202, -20]
  );
  shape(g, '#dfbe81', [-208, -26], [-172, -23], [163, -26], [202, -38], [186, -28], [157, -20], [-172, -16]);
  for (let i = 0; i < 3; i++) {
    const sx = seatX[i] - 650;
    shape(g, '#b79a65', [sx - 24, -30], [sx + 22, -31], [sx + 32, -24], [sx - 14, -23]);
    if (!cargo[i]) stroke(g, '#ebd2a1', 1.4, [sx - 11, -26], [sx + 14, -27]);
  }
  let passengerIndex = passengerOffset;
  cargo.forEach((kind, i) => {
    const sx = seatX[i] - 650;
    if (kind === 'crate') crate(g, sx, -24, 0.97);
    else if (kind === 'eggs') figure(g, sx, -24, 0.82, 'trader');
    else {
      figure(g, sx, -24, 0.85, passengerIndex === 0 ? 'aunt' : 'customer', passengerIndex);
      passengerIndex++;
    }
  });
  // A canvas awning shelters the helmsman while the three seats remain visible.
  for (const sx of [114, 170]) stroke(g, '#665337', 3, [sx, -27], [sx - 4, -80]);
  shape(
    g,
    '#a66b46',
    [95, -75],
    [103, -88],
    [154, -94],
    [178, -85],
    [182, -78],
    [166, -79],
    [142, -77],
    [123, -78]
  );
  shape(g, '#c49b64', [103, -88], [155, -94], [177, -86], [125, -80], [96, -76]);
  for (let i = 0; i < 4; i++) stroke(g, '#946c4b', 1, [112 + i * 12, -88 - i], [125 + i * 12, -81 - i]);
  figure(g, 145, -27, 0.87, 'skipper');
  stroke(g, '#654f34', 3.2, [150, -66], [99, -19], [46, 20]);
  shape(g, '#937851', [53, 12], [62, 12], [37, 35], [28, 36], [28, 32]);
  // The near rail overlays feet and ties the cargo visually to the boat.
  stroke(g, '#534b3c', 3, [-218, -23], [-172, -15], [155, -19], [191, -28], [223, -46]);
  stroke(g, '#ad8559', 2, [-197, -8], [-151, 1], [-90, 3], [138, -4], [190, -12]);
  stroke(g, '#9fa475', 2.5, [-184, 0], [-132, 7], [133, 2], [171, -4]);
  oval(g, 207, -24, 4.8, 3.7, '#ede3bc');
  oval(g, 208, -24, 2.2, 2.2, '#39443b');
  g.restore();
}
// The receiving bank stays visible while the boat crosses the river.
function easternLanding(g: Brush) {
  for (const x of [792, 846, 914]) stroke(g, '#77795f', 3, [x, 174], [x, 191]);
  shape(g, '#ac9975', [774, 172], [921, 166], [960, 160], [960, 168], [920, 176], [790, 181]);
  stroke(g, '#8a8063', 2, [790, 180], [922, 175], [960, 167]);
  distantRoof(g, 927, 169, 1.05, '#856f58');
  stroke(g, '#67785e', 1.8, [876, 172], [876, 149]);
  shape(g, '#af724e', [876, 148], [898, 151], [885, 156], [876, 154]);
}

function merchantCart(g: Brush) {
  figure(g, 687, 261, 0.91, 'merchant');
  for (const x of [709, 742]) {
    oval(g, x, 256, 6, 6, '#554c38');
    oval(g, x, 256, 3.8, 3.8, '#b09467');
    stroke(g, '#6b5840', 1, [x, 252], [x, 260]);
    stroke(g, '#6b5840', 1, [x - 4, 256], [x + 4, 256]);
  }
  stroke(g, '#6b5439', 3, [695, 240], [709, 250], [748, 248]);
  shape(g, '#94744a', [704, 242], [750, 240], [747, 248], [708, 250]);
  stroke(g, '#ccae75', 1.5, [705, 242], [750, 240]);
}
export function paintMorning(canvas: HTMLCanvasElement, scene: MorningScene, progress = 1) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const ratio = Math.min(2, canvas.ownerDocument.defaultView?.devicePixelRatio || 1);
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  g.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  g.clearRect(0, 0, width, height);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const { state, departing } = scene;
  horizon(g, state.day === 2, Math.min(6, Math.max(0, scene.bridgeLamps ?? 0)));
  easternLanding(g);
  const arrived = state.phase === 'done' && !departing;
  const t = arrived ? 1 : departing ? Math.min(1, Math.max(0, progress)) : 0;
  const smooth = t * t * (3 - 2 * t);
  const trip = arrived ? state.trips.at(-1) : departing;
  const cargo = arrived ? [] : (trip?.cargo ?? state.cargo);
  const previousPassengers = state.trips
    .filter((other) => other.day === state.day)
    .reduce((n, other) => n + other.cargo.filter((c) => c === 'passenger').length, 0);
  const shipX = 650 + (trip?.route === 'east' ? 156 : -171) * smooth;
  const shipY = 361 - (trip?.route === 'east' ? 166 : 132) * smooth;
  const shipScale = 1 - (trip?.route === 'east' ? 0.6 : 0.46) * smooth;
  const paintBoat = () => boat(g, shipX, shipY, shipScale, cargo, previousPassengers, t > 0 && t < 1);
  if (t > 0 && shipY < 303) paintBoat();
  if (arrived && trip) {
    let order = 0;
    trip.cargo.forEach((kind, i) => {
      const x = 803 + i * 34,
        y = 176 - i * 1.5;
      if (kind === 'crate') crate(g, x, y, 0.59);
      else if (kind === 'eggs') figure(g, x, y, 0.53, 'trader');
      else figure(g, x, y, 0.54, order++ === 0 ? 'aunt' : 'customer');
    });
  }
  deck(g);
  timetable(g, state);
  const queue = morningQueue(state);
  if (queue.includes('crate')) merchantCart(g);
  let waitingPassengerIndex = previousPassengers + state.cargo.filter((c) => c === 'passenger').length;
  queue.forEach((kind, i) => {
    const x = queueStart + i * queueGap;
    if (kind === 'crate') crate(g, x, queueFloor, 1.05);
    else if (kind === 'eggs') figure(g, x, queueFloor, 1, 'trader');
    else {
      figure(g, x, queueFloor, 1, waitingPassengerIndex === 0 ? 'aunt' : 'customer', waitingPassengerIndex);
      waitingPassengerIndex++;
    }
  });
  if (t === 0 || shipY >= 303) paintBoat();
  // Two foreground wharf posts give the open water a frame and a rope to cast off.
  shape(g, '#584937', [925, 420], [926, 343], [939, 343], [941, 420]);
  oval(g, 932, 343, 7, 3, '#bda783');
  for (let i = 0; i < 3; i++) stroke(g, '#c3ae82', 2, [926, 349 + i * 3], [939, 348 + i * 3]);
  if (!departing && !arrived) {
    g.beginPath();
    g.moveTo(932, 353);
    g.quadraticCurveTo(895, 373, 858, 339);
    g.strokeStyle = '#9c8968';
    g.lineWidth = 1.8;
    g.stroke();
  }
}
