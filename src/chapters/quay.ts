import type { ChapterContext } from './shared.ts';

export const quayLines = {
  opening: ['周婶', '天一黑，六个街坊都得过桥下的渡口。你听，纸坊也在催水了。', 'Six neighbors need the ferry before dark. Hear the paper mill calling for water?'],
  mill: ['阿诚', '水轮咬上了！我这一班能赶两盏灯的纸。留神渡口的纸絮。', 'The wheel is turning! I can make paper for two lanterns this shift. Watch the pulp by the jetty.'],
  reeds: ['阿诚', '水进了沉淀池，纸絮会落下来。这班得先搁下纸模。', 'The settling pond will catch some pulp. We will set the paper molds aside this shift.'],
  skim: ['周婶', '网兜沉了！把这些湿纸絮搭到岸上，下一船就好撑了。', 'That net is heavy! Lift the wet pulp ashore and the next boat will have an easier passage.'],
  empty: ['周婶', '网底干干净净。你听，渡口还有人在招呼船家。', 'The net came up clean. Listen, people are calling for the ferry.'],
  ferry: ['船长', '扶好篷杆。船离岸喽，家里给你们留着饭呢！', 'Hold the rail. We are off! There is supper waiting for you at home.'],
  slow: ['船长', '纸絮缠住了橹。这趟只能先捎一个人。', 'Pulp has tangled the oar. I can only take one passenger this trip.'],
  balance: ['周婶', '桥灯映得见水纹了。快看，那条渡船也穿过去了！', 'Look at the bridge lights on the ripples. The ferry made it through!'],
  people: ['船长', '最后一个也到家了。看，对岸有人举着灯来接。', 'Everyone is home. Look, someone brought a light to meet us.'],
  paper: ['阿诚', '新糊的灯亮起来了。散工以后，我留下去清渡口。', 'The new lanterns are lit. I will stay after my shift to clear the landing.'],
  quiet: ['周婶', '收班吧。我把这盏旧灯挂在渡口，明早第一船再来。', 'Time to close. I will hang the old lantern at the landing until the first boat tomorrow.'],
} as const;

type Gate = 'wheel' | 'pond';
type Job = 'skim' | 'ferry';
type Bell = { gate: Gate; job: Job };
export type QuaySave = { version: 1; gate: Gate; shifts: Bell[] };
type QuayStats = { lamps: number; crossed: number; pulp: number };
const shiftsTotal = 3;
const passengers = 6;
const isGate = (value: unknown): value is Gate => value === 'wheel' || value === 'pond';
const isJob = (value: unknown): value is Job => value === 'skim' || value === 'ferry';

export function restoreQuay(value: unknown): QuaySave {
  const start: QuaySave = { version: 1, gate: 'wheel', shifts: [] };
  if (!value || typeof value !== 'object') return start;
  const save = value as Partial<QuaySave>;
  if (save.version !== 1 || !isGate(save.gate) || !Array.isArray(save.shifts) ||
      save.shifts.length > shiftsTotal || !save.shifts.every(s => s && isGate(s.gate) && isJob(s.job))) return start;
  return { version: 1, gate: save.gate, shifts: save.shifts.map(({ gate, job }) => ({ gate, job })) };
}

export function quayStats(save: QuaySave): QuayStats {
  let lamps = 0, crossed = 0, pulp = 1;
  for (const { gate, job } of save.shifts) {
    if (gate === 'wheel') {
      lamps += 2;
      pulp += 2;
    } else {
      pulp = Math.max(0, pulp - 1);
    }
    if (job === 'skim') pulp = Math.max(0, pulp - 2);
    else crossed = Math.min(passengers, crossed + (pulp >= 4 ? 1 : 2));
  }
  return { lamps, crossed, pulp };
}

export function workQuay(save: QuaySave, action: Job | 'gate'): QuaySave {
  if (save.shifts.length >= shiftsTotal) return save;
  if (action === 'gate') return { ...save, gate: save.gate === 'wheel' ? 'pond' : 'wheel' };
  return { ...save, shifts: [...save.shifts, { gate: save.gate, job: action }] };
}

export function quayEnding(save: QuaySave): 'balance' | 'people' | 'paper' | 'quiet' | undefined {
  if (save.shifts.length < shiftsTotal) return;
  const { lamps, crossed, pulp } = quayStats(save);
  if (lamps >= 4 && crossed >= 4 && pulp <= 2) return 'balance';
  if (crossed === passengers) return 'people';
  if (lamps >= 4) return 'paper';
  return 'quiet';
}

const endings = { balance: '灯影随船过', people: '一船都没落下', paper: '纸灯照长桥', quiet: '芦岸留灯' };

function quayBoatX(save: QuaySave, motion = 1) {
  return save.shifts.at(-1)?.job === 'ferry' ? 752 - 268 * motion : 752;
}

function paintQuay(canvas: HTMLCanvasElement, save: QuaySave, motion = 1) {
  const pen = canvas.getContext('2d');
  if (!pen) return;
  const c = pen;
  const { lamps, crossed, pulp } = quayStats(save);
  const shift = save.shifts.length;
  const w = 1000, h = 355;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const pixels = Math.max(620, Math.round(canvas.clientWidth * ratio));
  if (canvas.width !== pixels) {
    canvas.width = pixels;
    canvas.height = Math.round(pixels * h / w);
  }
  c.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
  const box = (x: number, y: number, width: number, height: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(x, y, width, height);
  };
  const disc = (x: number, y: number, r: number, color: string) => {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill();
  };
  const line = (x: number, y: number, xx: number, yy: number, color: string, weight = 2) => {
    c.beginPath(); c.moveTo(x, y); c.lineTo(xx, yy); c.strokeStyle = color; c.lineWidth = weight; c.stroke();
  };
  const poly = (color: string, coords: number[]) => {
    c.beginPath(); c.moveTo(coords[0], coords[1]);
    for (let i = 2; i < coords.length; i += 2) c.lineTo(coords[i], coords[i + 1]);
    c.closePath(); c.fillStyle = color; c.fill();
  };
  function band(top: number, bottom: number, a: string, b: string) {
    const g = c.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, top, w, bottom - top);
  }
  function glow(x: number, y: number, radius: number) {
    const g = c.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, '#ffe19a80'); g.addColorStop(1, '#ffe19a00');
    c.fillStyle = g; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  function roof(x: number, y: number, width: number, pitch: number, color: string) {
    poly(color, [x - 8, y, x + 4, y - 3, x + width * .23, y - pitch, x + width * .78, y - pitch + 1,
      x + width - 2, y - 4, x + width + 9, y - 2, x + width + 5, y + 3, x - 4, y + 4]);
  }
  const duskTop = ['#667b83', '#566a77', '#465a6c', '#314353'][shift];
  const duskHorizon = ['#f5c187', '#e4a77d', '#cd8976', '#ac7e79'][shift];
  band(0, 202, duskTop, duskHorizon);
  const sunX = 688, sunY = 93 + shift * 16;
  glow(sunX, sunY, 68); disc(sunX, sunY, 19, '#f4d4a0');
  for (let i = 0; i < 48; i++) {
    const x = (i * 179 + 47) % w, y = (i * 61) % 132;
    box(x, y, 8 + (i * 29) % 64, 1, '#ffe4b729');
    if (shift >= 2 && y < 68) disc(x, y, .85, '#ffefc5');
  }
  for (let k = 0; k < 3; k++) {
    const ridge = [0, 211];
    for (let x = 0; x <= w; x += 20)
      ridge.push(x, 114 + 17 * k + 13 * Math.sin(x / 54 + k * 2) + 13 * Math.cos(x / 88 - k));
    ridge.push(w, 202);
    poly(['#a8998b', '#868d89', '#71837e'][k], ridge);
  }
  for (let i = 0; i < 29; i++) {
    const x = i * 43 - 20, y = 166 + Math.sin(i * 2) * 6, width = 24 + (i * 7) % 17;
    box(x, y, width, 26, '#9c9783'); roof(x, y, width, 8, '#566a68');
    for (let j = 0; j < 3; j++) box(x + 3 + j * 8, y + 6, 3, 5, '#c4ac84');
  }
  band(190, h, ['#748c85', '#75837d', '#677674', '#536969'][shift], '#304f52');
  for (let i = 1; i < 235; i++) {
    const x = (i * 177.3) % w, y = 191 + ((i * 47.1) % 164);
    box(x, y, 3 + (i * 13) % 36, y > 300 ? 1.4 : .9, i % 4 === 0 ? '#b5c3a94f' : '#b0c5ac21');
  }
  // The six lanterns and their broken reflections follow actual paper production.
  for (let i = 0; i < 4; i++) {
    const x = 414 + 105 * i;
    poly('#465953', [x, 191, x + 12, 181, x + 17, 143, x + 6, 143, x + 2, 178]);
    c.beginPath(); c.moveTo(x - 98, 174); c.quadraticCurveTo(x - 50, 116, x + 7, 162);
    c.lineWidth = 8; c.strokeStyle = '#5d6456'; c.stroke();
  }
  line(300, 138, 812, 138, '#624e41', 4); line(300, 149, 812, 149, '#403f37', 6);
  for (let x = 302; x < 814; x += 19) box(x, 135, 3, 13, '#5c5142');
  for (let i = 0; i < 6; i++) {
    const x = 358 + i * 77;
    line(x - 3, 142, x - 3, 117, '#4d493b');
    line(x - 3, 117, x + 4, 117, '#4d493b');
    if (i < lamps) {
      glow(x + 4, 126, 20);
      line(x + 4, 117, x + 4, 121, '#56422e', 1);
      disc(x + 4, 126, 5, '#ffc877'); box(x, 121, 8, 2, '#ac6443');
      for (let wave = 0; wave < 5; wave++)
        box(x + Math.sin(wave * 2) * 2, 197 + wave * 5, 7 - wave, 1, '#edc18065');
    }
  }
  // The paper mill and its timber wheel sit on the near wharf.
  poly('#514c3d', [0, 221, 90, 207, 252, 212, 280, 229, 235, 251, 0, 273]);
  box(0, 135, 204, 81, '#c0a478'); box(15, 125, 123, 91, '#cfb181');
  roof(-18, 136, 241, 37, '#494f4a'); roof(3, 126, 145, 30, '#61635a');
  for (let x = 3; x < 118; x += 11) line(x, 124, x + 24, 97, '#7d7966', 1);
  for (const x of [10, 68, 123, 194]) box(x, 136, 5, 80, '#735a3f');
  box(23, 152, 29, 38, '#635a48');
  for (let i = 0; i < 4; i++) line(24 + i * 7, 153, 24 + i * 7, 190, '#a59065');
  box(84, 148, 29, 67, '#675a46');
  box(80, 137, 39, 12, '#575243'); c.fillStyle = '#f4d79d'; c.font = '9px serif'; c.fillText('竹 纸 坊', 83, 146);
  for (let i = 0; i < 3; i++) {
    line(19 + i * 31, 199, 16 + i * 31, 225, '#69543c');
    poly('#d7c292', [15 + i * 31, 195, 43 + i * 31, 194, 40 + i * 31, 209, 13 + i * 31, 212]);
  }
  c.save(); c.translate(205, 207);
  const rotation = save.gate === 'wheel' ? (shift + motion) * .32 : shift * .32;
  c.rotate(rotation);
  for (const r of [34, 29, 10]) {
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.lineWidth = r > 10 ? 5 : 3; c.strokeStyle = '#62523e'; c.stroke();
  }
  for (let i = 0; i < 10; i++) {
    c.rotate(Math.PI / 5); line(0, 0, 34, 0, '#594c39', 3);
    poly('#887652', [29, -4, 40, -1, 40, 4, 29, 2]);
  }
  disc(0, 0, 6, '#b49a62'); c.restore();
  // Two wooden sluice slots show which channel currently carries the water.
  for (let i = 0; i < 2; i++) {
    const x = 263 + i * 27, raised = save.gate === (i === 0 ? 'wheel' : 'pond');
    box(x, 200, 4, 42, '#564b3a'); box(x + 24, 198, 4, 42, '#564b3a');
    box(x, 196, 28, 4, '#ad9165');
    box(x + 4, raised ? 202 : 218, 20, 17, '#80694c');
    if (raised) for (let j = 0; j < 7; j++)
      line(x + 4 + j * 3, 227, x + 3 + j * 3, 232 + Math.sin(j) * 3, '#c0cbaf', 2);
  }
  for (let i = 0; i < pulp * 11; i++) {
    const x = 326 + (i * 43.7) % 440, y = 240 + (i * 17.4) % 44;
    poly('#d4c7a190', [x, y, x + 6, y - 1, x + 11, y + 1, x + 2, y + 2]);
  }
  // The net hangs from the little reed-bed landing beside the settling pool.
  poly('#6a6750', [337,260,387,254,418,259,366,267]); box(349,263,4,13,'#5b5644');
  box(401,260,4,13,'#5b5644'); line(377,256,397,220,'#a6946b',3);
  const netY = save.shifts.at(-1)?.job === 'skim' ? 231 - 7 * Math.sin(motion * Math.PI) : 235;
  line(397,220,407,netY,'#d1b788',1); poly('#8e9378',[397,netY,417,netY,410,netY+12,404,netY+10]);
  for (let i=0;i<5;i++) line(399+i*3,netY+1,405+i,netY+8,'#4e6559',1);
  // The landing is backed by a small ticket shed and a pathway to the village.
  poly('#48564a', [722, 233, 829, 202, 1000, 191, 1000, 267, 850, 257]);
  box(875, 158, 69, 47, '#ab946c'); roof(866, 159, 92, 21, '#4f5650');
  box(898, 169, 18, 35, '#635e49'); box(924, 169, 11, 15, '#ddba79');
  const person = (x: number, y: number, coat: string, scale = 1) => {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    line(-2, -1, -3, 3, '#443d37', 2.3); line(2, -1, 3, 3, '#443d37', 2.3);
    poly(coat, [-2,-16, 3,-16, 6,-3, -5,-3]); disc(.2,-20,3.5,'#c49b73');
    poly('#4f493b',[-4,-20,-2,-24,2,-24,4,-21]); c.restore();
  };
  for (let i = 0; i < passengers - crossed; i++) {
    person(811 + i * 10, 224 - Math.sin(i) * 3, ['#a8614b','#69827a','#b6996f'][i % 3], .87);
  }
  for (let i = 0; i < crossed; i++) person(22 + i * 11, 234, ['#a8614b','#69827a','#b6996f'][i % 3], .8);
  for (let i = 0; i < 5; i++) {
    const x = 735 + i * 38; box(x, 238 + i * 1.7, 5, 22, '#4e443a');
  }
  poly('#aa8a63',[724,233,896,242,890,248,717,239]);
  line(728, 237, 892, 246, '#5d5143', 3);
  const boatX = quayBoatX(save, motion);
  c.save(); c.translate(boatX, 261 + Math.sin(motion * Math.PI) * 2);
  poly('#473f34', [-49,-8,-33,0,37,0,56,-10,43,4,22,8,-27,7,-43,1]);
  line(-43,-5,45,-2,'#c89964',2.5); poly('#716349',[-12,-2,-9,-17,12,-17,17,-2]);
  for (const x of [-8,0,8]) line(x, -17, x - 1, -3, '#b39460', 1);
  person(27,-3,'#805f48',.76); line(29,-17,11,9,'#b8a076',2);
  c.restore();
  // Reeds give the foreground a frame and identify the settling bank.
  for (let i = 0; i < 68; i++) {
    const x = i < 38 ? (i * 15.4) % 192 - 18 : w - ((i * 13) % 114);
    const y = 332 + (i * 17) % 39, height = 17 + (i * 11) % 38;
    const lean = 6 * Math.sin(i);
    line(x, y, x + lean, y - height, '#3c5046', 1.6);
    poly('#4d6452', [x,y-4,x+10,y-height*.7,x+3,y-height*.35]);
    line(x + lean, y - height + 5, x + lean + 1, y - height - 2, '#836f4d', 2.2);
  }
}

export function mountQuay(host: HTMLElement, ctx: ChapterContext): void {
  let save = restoreQuay(ctx.load());
  host.innerHTML = `<section class="quay-yard" aria-label="桥湾晚班">
    <div class="quay-view">
      <canvas class="quay-paint" width="1000" height="355" aria-label="左岸纸坊、中间长桥、右岸渡口"></canvas>
      <div class="quay-watch"><span class="quay-dial" aria-hidden="true">◴</span><span data-watch></span></div>
      <div class="quay-sign" aria-live="polite" data-quay-ending hidden></div>
    </div>
    <div class="quay-controls">
      <div class="quay-heading"><div><small>桥湾 · 临水工棚</small><h2 data-quay-prompt></h2></div>
        <div class="quay-ledger" aria-label="码头现况"><span>桥灯 <b data-lamps></b></span><span>已渡 <b data-crossed></b></span><span>浮絮 <b data-pulp></b></span></div>
      </div>
      <p class="quay-log" role="status" data-log></p>
      <div class="quay-tools">
        <button type="button" data-quay="gate"><strong></strong><span>扳闸不耗班次</span></button>
        <button type="button" data-quay="skim"><strong>下网捞絮</strong><span>用一班 · 最多收两网</span></button>
        <button type="button" data-quay="ferry"><strong>撑船接人</strong><span>用一班 · 每船坐两人</span></button>
      </div>
    </div>
  </section>`;
  const get = <T extends Element>(selector: string) => host.querySelector<T>(selector)!;
  const canvas = get<HTMLCanvasElement>('canvas');
  const log = get<HTMLElement>('[data-log]');
  const sign = get<HTMLElement>('[data-quay-ending]');
  const title = get<HTMLElement>('[data-quay-prompt]');
  const gateButton = get<HTMLButtonElement>('[data-quay="gate"]');
  const speak = (key: keyof typeof quayLines) => {
    const [speaker, zh, en] = quayLines[key];
    ctx.say(speaker, zh, en);
  };
  let frame = 0;
  function draw(move: boolean) {
    cancelAnimationFrame(frame);
    if (!move || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paintQuay(canvas, save);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      if (!host.contains(canvas) || !canvas.isConnected) return;
      const portion = Math.min(1, (now - start) / 650);
      paintQuay(canvas, save, portion);
      if (portion < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }
  function update(move = false) {
    const { lamps, crossed, pulp } = quayStats(save);
    const ending = quayEnding(save);
    const wheel = save.gate === 'wheel';
    get('[data-watch]').textContent = ['薄暮 · 还剩三班', '日落 · 还剩两班', '掌灯 · 最后一班', '夜泊 · 已收班'][save.shifts.length];
    get('[data-lamps]').textContent = lamps + '/6';
    get('[data-crossed]').textContent = crossed + '/6';
    get('[data-pulp]').textContent = pulp + ' 网';
    gateButton.querySelector('strong')!.textContent = wheel ? '扳闸到沉淀池' : '扳闸到纸坊';
    title.textContent = wheel ? '水正流向纸坊' : '水正流向沉淀池';
    log.textContent = wheel
      ? '这班开工能点两盏灯，也会添两网浮絮。浮絮积到四网，船就只能载一人。'
      : '沉淀池这班会截下一网浮絮，纸坊歇工。你还可以派人下网，或撑船接街坊。';
    get<HTMLElement>('.quay-tools').hidden = Boolean(ending);
    sign.hidden = !ending;
    if (ending) {
      sign.textContent = endings[ending];
      title.textContent = '桥湾交班';
      log.textContent = '点亮桥灯 ' + lamps + ' 盏，送了 ' + crossed + ' 人到家，河面留下 ' + pulp + ' 网浮絮。';
      ctx.finish(endings[ending] + ' · ' + log.textContent);
    }
    draw(move);
  }
  function act(action: string | undefined) {
    if ((action !== 'gate' && !isJob(action)) || quayEnding(save)) return;
    const before = quayStats(save);
    save = workQuay(save, action);
    const after = quayStats(save);
    ctx.save(save);
    update(action !== 'gate');
    const ending = quayEnding(save);
    if (ending) speak(ending);
    else if (action === 'gate') speak(save.gate === 'wheel' ? 'mill' : 'reeds');
    else if (action === 'skim') speak((save.gate === 'wheel' ? before.pulp + 2 : before.pulp - 1) > 0 ? 'skim' : 'empty');
    else speak(after.crossed - before.crossed === 1 ? 'slow' : 'ferry');
  }
  function paintedAction(e: MouseEvent): Job | 'gate' | undefined {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * 1000;
    const y = (e.clientY - rect.top) / rect.height * 355;
    if (x >= 161 && x <= 319 && y >= 164 && y <= 248) return 'gate';
    if (x >= 329 && x <= 430 && y >= 212 && y <= 276) return 'skim';
    if (Math.abs(x - quayBoatX(save)) <= 62 && y >= 233 && y <= 284) return 'ferry';
    if (x >= 725 && x <= 900 && y >= 201 && y <= 255) return 'ferry';
  }
  canvas.onpointermove = e => {
    canvas.style.cursor = !quayEnding(save) && paintedAction(e) ? 'pointer' : 'default';
  };
  host.onclick = e => {
    if (e.target === canvas) act(paintedAction(e));
    else act((e.target as Element).closest<HTMLButtonElement>('[data-quay]')?.dataset.quay);
  };
  update();
  const ending = quayEnding(save);
  if (ending) speak(ending);
  else if (!save.shifts.length && save.gate === 'wheel') speak('opening');
  else speak(save.gate === 'wheel' ? 'mill' : 'reeds');
}
