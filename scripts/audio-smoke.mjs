import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Start Vite before running: npm run dev -- --host 127.0.0.1 --port 5173
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const saveKey = 'prosperity-road.bread-crisis.v1';
const musicKey = 'prosperity-road.music.v1';
const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(macChrome) ? macChrome : undefined),
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
});
let completed = 0;

async function audioState(page) {
  return page.locator('#town-music').evaluate(audio => ({
    paused: audio.paused, time: audio.currentTime, duration: audio.duration,
    ready: audio.readyState, error: audio.error?.message ?? null,
  }));
}

async function waitPlaying(page, after = 0) {
  await page.waitForFunction(time => {
    const audio = document.querySelector('#town-music');
    return audio && !audio.paused && audio.currentTime > time && !audio.error;
  }, after, { timeout: 30000 });
}

async function storage(page, key = saveKey) {
  return page.evaluate(storageKey => localStorage.getItem(storageKey), key);
}

async function assertUsable(page, width) {
  const button = page.locator('#music-button');
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && box.width >= 44 && box.height >= 44, 'Music needs a 44px touch target.');
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
    `Music must fit the viewport: ${JSON.stringify({ box, viewport })}`);
  assert.equal(await button.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return element === hit || element.contains(hit);
  }), true, 'The music control must not be covered.');
  const contentWidth = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  assert.ok(contentWidth <= width + 1, `The music header overflows at ${width}px: ${contentWidth}`);
}

async function isolated(name, check, beforeNavigate) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  const audioRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/audio/town-theme.mp3') audioRequests.push(request.url());
  });
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  try {
    if (beforeNavigate) await beforeNavigate(page);
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '繁荣之路', exact: true }).waitFor();
    await check(page, audioRequests);
    assert.deepEqual(errors, [], 'Music must never cause an uncaught page error.');
    completed += 1;
    console.log(`PASS ${name}`);
  } finally {
    await context.close();
  }
}

try {
  await mkdir('.qa', { recursive: true });

  await isolated('初始不下载、首次操作播放、换季与菜单不断音、静音记忆', async (page, audioRequests) => {
    assert.equal(await page.locator('#town-music').count(), 1);
    assert.equal(await page.locator('#town-music').getAttribute('preload'), 'none');
    assert.equal((await audioState(page)).paused, true);
    assert.equal((await audioState(page)).time, 0);
    await page.locator('#menu-button').click();
    await page.keyboard.press('Escape');
    assert.deepEqual(audioRequests, [], 'Opening the page or its menu must not fetch the music.');
    assert.equal((await audioState(page)).paused, true);
    const originalAudio = await page.$('#town-music');
    await page.getByRole('button', { name: '查看正常市场', exact: true }).click();
    await waitPlaying(page, .15);
    assert.ok(audioRequests.length > 0, 'A real MP3 must load after the first game action.');
    const playing = await audioState(page);
    assert.ok(Number.isFinite(playing.duration) && playing.duration > 20, 'The music must decode into a nonempty audio stream.');
    assert.equal(await page.locator('#town-music').evaluate(audio => audio.loop), true);
    assert.equal(await page.locator('#music-button').getAttribute('aria-pressed'), 'true');
    await waitPlaying(page, 1);
    for (const action of ['next', 'menu']) {
      const before = (await audioState(page)).time;
      await page.locator(`[data-action="${action}"]`).click();
      await waitPlaying(page, before);
      assert.equal(await originalAudio.evaluate(audio => audio === document.querySelector('#town-music')), true,
        'Rendering a new season or menu must preserve the same audio element.');
      if (action === 'menu') await page.keyboard.press('Escape');
    }
    const beforeSettle = (await audioState(page)).time;
    await page.locator('#strategy-1').click();
    await page.locator('#settle-button').click();
    await waitPlaying(page, beforeSettle);
    assert.equal(JSON.parse(await storage(page)).records.length, 2);
    const campaign = await storage(page);
    await page.locator('#music-button').click();
    assert.equal((await audioState(page)).paused, true);
    assert.equal(await storage(page, musicKey), 'off');
    assert.equal(await storage(page), campaign, 'Muting must not affect the campaign.');
    audioRequests.length = 0;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#outcome-title').waitFor();
    assert.match(await page.locator('#music-button').getAttribute('aria-label'), /打开背景配乐/);
    await page.locator('[data-action="next"]').click();
    assert.equal((await audioState(page)).paused, true);
    assert.deepEqual(audioRequests, [], 'A saved mute preference also prevents music requests after interaction.');
    const mutedCampaign = await storage(page);
    await page.locator('#music-button').click();
    await waitPlaying(page, .1);
    assert.equal(await storage(page, musicKey), 'on');
    assert.equal(await storage(page), mutedCampaign);
  });

  await isolated('演示面板暂停与关闭恢复、可见性事件暂停恢复', async page => {
    await page.locator('#music-button').click();
    await waitPlaying(page, .2);
    assert.equal(await storage(page), null, 'Playing music alone must not start a campaign.');
    const originalAudio = await page.$('#town-music');
    const beforePilot = (await audioState(page)).time;
    await page.locator('#intro-pilot').click();
    assert.equal((await audioState(page)).paused, true, 'The game soundtrack must pause when entering the demo panel.');
    const stopped = (await audioState(page)).time;
    assert.ok(stopped >= beforePilot);
    await page.locator('.pilot-video summary').click();
    await page.locator('#pilot-demo').evaluate(video => video.play());
    await page.waitForFunction(() => document.querySelector('#pilot-demo').currentTime > .2);
    assert.equal((await audioState(page)).paused, true);
    assert.equal((await audioState(page)).time, stopped, 'Playing the demo cannot advance the game soundtrack.');
    await page.keyboard.press('Escape');
    await waitPlaying(page, stopped);
    assert.equal(await originalAudio.evaluate(audio => audio === document.querySelector('#town-music')), true);

    // Headless Chromium keeps all tabs visible. Simulate only the browser's visibility
    // signal; the application handler and audio playback remain real and unmodified.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal((await audioState(page)).paused, true);
    const backgroundTime = (await audioState(page)).time;
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitPlaying(page, backgroundTime);
    await page.locator('#music-button').click();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal((await audioState(page)).paused, true, 'Returning to the foreground must honor the mute preference.');
    assert.equal(await storage(page), null);
  });

  await isolated('播放成功回调延迟时快速切回前台仍自动恢复', async page => {
    await page.locator('#music-button').click();
    await waitPlaying(page, .1);
    await page.waitForFunction(() => window.__musicPlayPending === true);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal((await audioState(page)).paused, true);
    const stopped = (await audioState(page)).time;
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal((await audioState(page)).paused, true, 'The earlier play callback is intentionally still pending.');
    await page.evaluate(() => window.__releaseMusicPlay());
    await waitPlaying(page, stopped);
    assert.equal(await page.locator('#music-button').getAttribute('aria-pressed'), 'true');
    assert.equal(await storage(page), null, 'Reconciling playback must not start a campaign.');
  }, async page => {
    await page.addInitScript(() => {
      const originalPlay = HTMLMediaElement.prototype.play;
      let delayed = false;
      HTMLMediaElement.prototype.play = function (...args) {
        const playing = originalPlay.apply(this, args);
        if (this.id !== 'town-music' || delayed) return playing;
        delayed = true;
        // Delay just one successful completion; the original media decoding and
        // playback continue so the test can exercise the real pending-play race.
        return playing.then(() => new Promise(resolve => {
          window.__musicPlayPending = true;
          window.__releaseMusicPlay = () => { window.__musicPlayPending = false; resolve(); };
        }));
      };
    });
  });

  await isolated('配乐404不阻断游戏、可重试恢复真实播放', async page => {
    await page.getByRole('button', { name: '查看正常市场', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#town-music').error !== null);
    await page.getByRole('button', { name: '配乐暂时无法播放，点击重试', exact: true }).waitFor();
    assert.equal(JSON.parse(await storage(page)).records.length, 1);
    await page.locator('[data-action="next"]').click();
    await page.locator('#strategy-1').click();
    await page.locator('#settle-button').click();
    const campaign = await storage(page);
    assert.equal(JSON.parse(campaign).records.length, 2, 'A broken audio asset must not block normal settlement.');
    assert.equal(JSON.parse(campaign).records[1].result.purchasesLow, 24);
    await page.screenshot({ path: '.qa/music-unavailable.png' });
    await page.unroute('**/audio/town-theme.mp3');
    await page.locator('#music-button').click();
    await waitPlaying(page, .1);
    assert.equal((await audioState(page)).error, null);
    assert.equal(await page.locator('#music-button').getAttribute('aria-pressed'), 'true');
    assert.equal(await storage(page), campaign);
  }, async page => {
    await page.route('**/audio/town-theme.mp3', route => route.fulfill({ status: 404, contentType: 'audio/mpeg', body: 'Missing soundtrack for this test.' }));
  });

  for (const width of [375, 320]) {
    await isolated(`${width}px配乐按钮可触达且无横向溢出`, async page => {
      await page.setViewportSize({ width, height: 812 });
      await assertUsable(page, width);
      await page.locator('#music-button').click();
      await waitPlaying(page, .1);
      await assertUsable(page, width);
      await page.locator('#music-button').click();
      assert.equal((await audioState(page)).paused, true);
      await assertUsable(page, width);
      await page.screenshot({ path: `.qa/music-mobile-${width}.png` });
    });
  }

  console.log(`Audio smoke: ${completed} isolated scenarios passed. Background visibility was simulated; audio decoding and playback were real.`);
} finally {
  await browser.close();
}
