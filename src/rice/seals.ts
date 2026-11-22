/** A counter-top bargain. Inventory is settled by the caller after a deal is accepted. */
type Mark = 0 | 1 | 2;
interface Terms {
  price: number;
  quantity: number;
  canHold: boolean;
  reducedMotion?: boolean;
  initialStamps?: readonly Mark[];
  onStamp?: (stamps: readonly Mark[]) => void;
}
const labels = ['稻穗', '船帆', '铜钱'];
const codes = ['grain', 'sail', 'coin'];
const inks = ['#965238', '#2b615e', '#8a692c'];
const css = `
.rice-seals{position:absolute;inset:0;z-index:8;overflow:auto;display:grid;place-items:center;container-type:inline-size;background:repeating-linear-gradient(3deg,transparent 0 18px,#e3ba7130 19px,transparent 20px 55px),repeating-linear-gradient(0deg,#6a4b35 0 64px,#372f26 64px 68px,#71513b 69px 136px);color:#362f26;font-family:Georgia,"Songti SC","Noto Serif CJK SC",serif;touch-action:manipulation}
.rice-seals *{box-sizing:border-box}.seal-desk{width:min(88%,650px);padding:clamp(6px,2cqw,18px) clamp(9px,3cqw,32px);border:3px double #795f3c;box-shadow:0 5px 0 #33251f88,0 7px 23px #2a211995;background:radial-gradient(ellipse at 30% 0%,#fff0c8,#e7cda0 90%);border-radius:5px}
.seal-desk header{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid #836d48;padding-bottom:5px}.seal-desk h2{margin:0;font:700 clamp(15px,3cqw,28px)/1.2 Georgia,"Songti SC",serif;color:#453628}.seal-terms{font:600 clamp(11px,1.9cqw,16px) system-ui,sans-serif;color:#654b36}.seal-rack{display:flex;padding:8px;gap:9px;justify-content:center;margin:1.1cqw 0;background:linear-gradient(#614e3a,#3f382d);border:1px solid #3d3024;border-radius:7px;box-shadow:inset 0 3px #292a22}
.seal-dial{min-width:0;flex:1;max-width:130px;padding:3px;border-radius:5px;background:linear-gradient(0deg,#a89672,#f8eaca 32%,#f8ebc8 74%,#ab9873);border:2px solid #7b6748;display:grid;justify-items:center;box-shadow:0 2px 1px #241d17;position:relative;color:#352f25}.seal-dial[data-active=true]{outline:2px solid #efbd61;outline-offset:1px}.seal-dial[data-stopped=true]{border-color:#495944;background:linear-gradient(0deg,#aaab87,#e2e4b8 32%,#e8e4ba 74%,#abb38d)}.seal-dial canvas{width:clamp(30px,10cqw,85px);height:clamp(30px,10cqw,85px)}.seal-dial span{font-size:clamp(10px,1.6cqw,14px);line-height:1.1}.seal-dial:enabled{cursor:pointer}.rice-seals .seal-dial:disabled{opacity:1}.seal-desk button:focus-visible{outline:3px solid #ad6834;outline-offset:2px}
.seal-desk p{margin:3px 0;color:#403727;font-size:clamp(12px,2cqw,17px);line-height:1.3}.seal-holds,.seal-tools{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:5px}.seal-holds{font:600 clamp(10px,1.6cqw,14px) system-ui,sans-serif;color:#3f5545}.seal-desk [hidden]{display:none!important}.seal-tools button,.seal-holds button{background:#f6e3b9;border:1px solid #7b694b;color:#493c29;padding:5px 9px;border-radius:4px;font:600 clamp(11px,1.75cqw,15px) system-ui,sans-serif;cursor:pointer}.seal-tools .seal-main{background:#34554a;color:#fff2d2;border-color:#253e35}.seal-tools button:disabled{opacity:.62}.seal-tools{justify-content:flex-end}.seal-tools .seal-main{margin-right:auto}
@container(max-width:550px){.seal-desk{width:96%;padding:4px 8px}.seal-desk header{padding-bottom:2px}.seal-rack{padding:4px;margin:3px 0}.seal-desk p{margin:0}.seal-holds,.seal-tools{margin-top:2px}.seal-tools button,.seal-holds button{padding:3px 6px}.seal-dial{padding:1px}.seal-dial canvas{width:min(8cqw,34px);height:min(8cqw,34px)}}`;

function paintMark(c: HTMLCanvasElement, mark: Mark) {
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 100, 100);
  const color = inks[mark];
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.save();
  g.translate(50, 49);
  g.beginPath();
  for (let i = 0; i <= 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(angle) * 42,
      y = Math.sin(angle) * 42;
    if (!i) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.scale(0.89, 0.89);
  g.stroke();
  g.lineCap = 'round';
  if (mark === 0) {
    g.beginPath();
    g.moveTo(-13, 29);
    g.quadraticCurveTo(-7, 4, 12, -27);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      for (const sign of [-1, 1]) {
        const y = 13 - i * 9 + sign * 3,
          x = -5 + i * 4;
        g.beginPath();
        g.ellipse(x + sign * 5, y, 4, 8, sign * 0.77, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (mark === 1) {
    g.beginPath();
    g.moveTo(-22, 16);
    g.lineTo(25, 13);
    g.lineTo(16, 22);
    g.lineTo(-15, 23);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(1, 15);
    g.lineTo(1, -27);
    g.stroke();
    g.beginPath();
    g.moveTo(-2, -24);
    g.quadraticCurveTo(-4, -5, -22, 10);
    g.lineTo(-2, 8);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(6, -20);
    g.lineTo(22, 8);
    g.lineTo(6, 10);
    g.closePath();
    g.fill();
  } else {
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 0, 24, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2;
    g.strokeRect(-7, -7, 14, 14);
    for (let i = 0; i < 4; i++) {
      g.rotate(Math.PI / 2);
      g.beginPath();
      g.moveTo(-4, -14);
      g.lineTo(5, -14);
      g.moveTo(0, -18);
      g.lineTo(0, -11);
      g.stroke();
    }
  }
  g.restore();
}

export function startSeals(
  host: HTMLElement,
  terms: Terms,
  done: (stamps: readonly Mark[] | undefined) => void,
  cancel: () => void
): () => void {
  const panel = document.createElement('section');
  panel.className = 'rice-seals';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '柜台议价');
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  panel.innerHTML = `<style>${css}</style><div class="seal-desk"><header><h2>柜台议价</h2><span class="seal-terms">${terms.quantity} 袋 · 牌价 ${terms.price} 枚／袋</span></header>
    <div class="seal-rack">${[0, 1, 2].map((i) => `<button type="button" data-seal-reel="${i}" class="seal-dial"><canvas width="100" height="100" aria-hidden="true"></canvas><span></span></button>`).join('')}</div>
    <p aria-live="polite" class="seal-message"></p><div class="seal-holds" ${terms.canHold ? '' : 'hidden'}>口才 · 可留首印 ${labels.map((label, i) => `<button type="button" data-seal-hold="${codes[i]}">${label}</button>`).join('')}</div>
    <div class="seal-tools"><button type="button" class="seal-main" data-seal-stop>按停第一印</button><button type="button" class="seal-main" data-seal-deal hidden></button><button type="button" data-seal-plain>照牌价卖</button><button type="button" data-seal-cancel>先不卖</button></div></div>`;
  host.append(panel);
  const reels = [...panel.querySelectorAll<HTMLButtonElement>('[data-seal-reel]')];
  const stop = panel.querySelector<HTMLButtonElement>('[data-seal-stop]')!;
  const deal = panel.querySelector<HTMLButtonElement>('[data-seal-deal]')!;
  const plain = panel.querySelector<HTMLButtonElement>('[data-seal-plain]')!;
  const holds = panel.querySelector<HTMLElement>('.seal-holds')!;
  const info = panel.querySelector<HTMLElement>('.seal-message')!;
  const prior = terms.initialStamps ?? [];
  const marks: Mark[] = [0, 1, 2];
  const restored = prior.length <= 3 && prior.every((m) => m === 0 || m === 1 || m === 2) ? prior : [];
  restored.forEach((mark, i) => {
    marks[i] = mark;
  });
  const order = ['一', '二', '三'];
  let count = restored.length,
    closed = false,
    raf = 0,
    elapsed = 0,
    last = performance.now();
  const reduced = terms.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show(i: number) {
    const reel = reels[i],
      symbol = marks[i],
      stopped = i < count;
    reel.dataset.symbol = codes[symbol];
    reel.dataset.stopped = String(stopped);
    reel.dataset.active = String(i === count);
    reel.disabled = i !== count;
    reel.setAttribute('aria-label', `第${order[i]}印，${labels[symbol]}，${stopped ? '已停' : '转动中'}`);
    reel.querySelector('span')!.textContent = labels[symbol];
    paintMark(reel.querySelector('canvas')!, symbol);
  }
  function cleanup() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    panel.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function finish(stamps: readonly Mark[] | undefined) {
    if (closed) return;
    cleanup();
    done(stamps);
  }
  function leave() {
    if (closed) return;
    cleanup();
    cancel();
  }
  function displayProgress() {
    marks.forEach((_, i) => show(i));
    holds.hidden = count > 0 || !terms.canHold;
    if (count === 3) {
      const match = marks[0] === marks[1] && marks[1] === marks[2];
      const price = terms.price + Number(match);
      info.textContent = match
        ? `三印同纹。掌柜愿意每袋添一枚，出价 ${price} 枚。`
        : `掌柜按牌价收，每袋 ${price} 枚。`;
      deal.textContent = `成交 · 收 ${price * terms.quantity} 枚`;
      deal.hidden = false;
      stop.hidden = true;
      plain.hidden = true;
      deal.focus({ preventScroll: true });
    } else {
      stop.textContent = `按停第${order[count]}印`;
      info.textContent = count
        ? `首印是${labels[marks[0]]}。看准下一枚商印。`
        : '依次按停三枚商印。同纹三枚，掌柜每袋添一枚。';
      stop.focus({ preventScroll: true });
    }
  }
  function press(chosen?: Mark) {
    if (closed || count === 3) return;
    if (chosen !== undefined && count === 0 && terms.canHold) marks[0] = chosen;
    count++;
    terms.onStamp?.(marks.slice(0, count));
    displayProgress();
  }
  stop.onclick = () => press();
  deal.onclick = () => finish([...marks]);
  plain.onclick = () => finish(undefined);
  panel.querySelector<HTMLButtonElement>('[data-seal-cancel]')!.onclick = leave;
  reels.forEach((r, i) => {
    r.onclick = () => {
      if (i === count) press();
    };
  });
  panel.querySelectorAll<HTMLButtonElement>('[data-seal-hold]').forEach((b, i) => {
    b.onclick = () => press(i as Mark);
  });
  panel.onkeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      leave();
    } else if (e.key.toLowerCase() === 'e') {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat && count < 3) press();
    } else if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
  };
  displayProgress();
  function tick(now: number) {
    if (closed || count === 3) return;
    if (!document.hidden) elapsed += Math.min(100, Math.max(0, now - last));
    last = now;
    for (let i = count; i < 3; i++) {
      const step = reduced ? 850 : 440 + 35 * i;
      const symbol = ((Math.floor(elapsed / step) + i) % 3) as Mark;
      if (marks[i] !== symbol) {
        marks[i] = symbol;
        show(i);
      }
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return cleanup;
}
