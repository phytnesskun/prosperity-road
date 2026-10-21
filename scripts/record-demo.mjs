// Real browser actions, recorded in an isolated profile. No saved progress is injected.
// Start Vite, prepare narration, then run this script. See docs/demo/README.md.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const qa = new URL('../.qa/demo/', import.meta.url);
await mkdir(qa, { recursive: true });
const segments = JSON.parse(await readFile(new URL('prepared.json', qa), 'utf8'));
const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(macChrome) ? macChrome : undefined) });
const context = await browser.newContext({
  viewport: { width: 1440, height: 800 },
  recordVideo: { dir: new URL('raw/', qa).pathname, size: { width: 1440, height: 800 } },
  reducedMotion: 'no-preference',
});
const videoEpoch = Date.now();
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(10_000);
const wait = ms => page.waitForTimeout(ms);
let pointer = { x: 1150, y: 650 };

async function showPointer(x, y, click = false) {
  await page.evaluate(({ x, y, click }) => {
    let point = document.getElementById('demo-pointer');
    if (!point) {
      point = document.createElement('div');
      point.id = 'demo-pointer';
      point.setAttribute('aria-hidden', 'true');
      point.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;width:36px;height:42px;transform:translate(-4px,-3px);filter:drop-shadow(0 2px 3px #0009);transition:left .45s ease,top .45s ease';
      point.innerHTML = '<svg viewBox="0 0 36 42" width="36" height="42"><path d="M5 3 L5 31 L13 25 L20 39 L26 36 L19 23 L31 22 Z" fill="#f5bd42" stroke="#173d33" stroke-width="2"/></svg>';
    }
    (document.querySelector('dialog[open]') || document.body).append(point);
    point.style.left = `${x}px`;
    point.style.top = `${y}px`;
    if (click) {
      const ring = document.createElement('div');
      ring.style.cssText = `position:fixed;z-index:2147483646;pointer-events:none;left:${x-24}px;top:${y-24}px;width:48px;height:48px;border:4px solid #edb739;border-radius:50%;box-sizing:border-box`;
      (document.querySelector('dialog[open]') || document.body).append(ring);
      ring.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 0 }], { duration: 650 }).finished.then(() => ring.remove());
    }
  }, { x, y, click });
  pointer = { x, y };
}
async function pointAt(selector) {
  const loc = typeof selector === 'string' ? page.locator(selector) : selector;
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  assert.ok(box, `Target must be visible: ${selector}`);
  await showPointer(box.x + box.width / 2, box.y + box.height / 2);
  await wait(600);
  return loc;
}
async function click(selector) {
  const loc = await pointAt(selector);
  await showPointer(pointer.x, pointer.y, true);
  await loc.click();
  await wait(350);
}
async function scrollTo(selector, block = 'center') {
  await page.locator(selector).evaluate((element, block) => element.scrollIntoView({ behavior: 'smooth', block }), block);
  await wait(750);
}
async function top() {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(750);
}
const actions = {
  welcome: async () => { await showPointer(1030, 690); },
  baseline: async () => {
    await click(page.getByRole('button', { name: '查看正常市场', exact: true }));
    await scrollTo('.effect-grid');
    assert.match(await page.locator('.effect-grid').innerText(), /40\.00/);
  },
  crisis: async () => {
    await click('[data-action="next"]');
    await scrollTo('.situation');
    await wait(1800);
    await click('#strategy-1');
    await pointAt('.selected-plan');
  },
  policy: async () => {
    await click('#policy-custom > summary');
    await pointAt('#policy-controls');
    await wait(1200);
    await click('#policy-custom > summary');
    assert.equal(await page.locator('#settle-button').isDisabled(), false);
    assert.equal(await page.locator('[id^="prediction-"]').count(), 0);
    await pointAt('#settle-button');
  },
  outcome: async () => {
    await click('#settle-button');
    await scrollTo('.street-reaction', 'start');
    await wait(1800);
    await scrollTo('.effect-grid');
    const state = JSON.parse(await page.evaluate(() => localStorage.getItem('prosperity-road.bread-crisis.v1')));
    assert.equal(state.records[1].result.price, 5);
    assert.equal(state.records[1].result.purchasesLow, 24);
    await pointAt(page.locator('.effect-card').filter({ hasText: '低收入组实际购粮' }));
  },
  advisor: async () => {
    await click('#advisor-open');
    await wait(1600);
    await click('[data-action="advisor-topic"][data-topic="why"]');
    await wait(1800);
    await click('[data-action="advisor-topic"][data-topic="access"]');
  },
  replay: async () => {
    await click(page.locator('[data-action="close-dialog"]').first());
    await click('[data-action="replay-season"]');
    await click('#replay-cap-none');
    await scrollTo('.comparison-table');
    const row = page.locator('.comparison-table tr').filter({ hasText: '低收入组实际购粮' });
    assert.match(await row.innerText(), /24\.00\s+25\.00/);
    await pointAt(row);
  },
  scene: async () => {
    await click('#tab-town');
    await scrollTo('.town-map');
    await click('[data-action="district"][data-district="granary"]');
    await scrollTo('.economy-scene');
    await click('#scene-replay-button');
    await wait(1800);
    await click('#scene-granary');
  },
  pilot: async () => {
    await click(page.locator('[data-action="close-dialog"]').first());
    await top();
    await click('#menu-button');
    await click('#pilot-button');
    await page.locator('#game-dialog').getByRole('heading', { name: '学生试玩', exact: true }).waitFor();
    await showPointer(1260, 635);
  },
  closing: async () => {
    await click(page.locator('[data-action="close-dialog"]').first());
    await click('#tab-command');
    await top();
    await showPointer(1260, 645);
  },
};
try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('.briefing-advisor img').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await showPointer(pointer.x, pointer.y);
  await wait(800);
  const start = Date.now();
  const videoOffset = (start - videoEpoch) / 1000;
  for (const seg of segments) {
    seg.start = (Date.now() - start) / 1000;
    console.log(`Recording ${seg.id} @ ${seg.start.toFixed(2)}s`);
    await actions[seg.id]();
    const remaining = seg.duration * 1000 - (Date.now() - start - seg.start * 1000);
    assert.ok(remaining > -2000, `Actions overrun ${seg.id}: ${-remaining}ms`);
    if (remaining > 0) await wait(remaining);
    seg.end = (Date.now() - start) / 1000;
    await page.screenshot({ path: new URL(`checkpoint-${seg.id}.png`, qa).pathname });
  }
  assert.deepEqual(errors, [], 'Recording must not contain JavaScript failures');
  const duration = (Date.now() - start) / 1000;
  const video = page.video();
  await context.close();
  const videoPath = await video.path();
  await writeFile(new URL('recording.json', qa), JSON.stringify({ video: videoPath, videoOffset, duration, segments }, null, 2));
  console.log(`Recorded ${duration.toFixed(2)}s: ${videoPath}`);
} finally {
  await browser.close();
}
