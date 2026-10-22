import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Every playable test file uses this project's original soundtrack bytes, never OST audio.
const musicBytes = await readFile(new URL('../public/audio/town-theme.mp3', import.meta.url));
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const saveKey = 'prosperity-road.bread-crisis.v1';
const musicKey = 'prosperity-road.music.v1';
const unsafeName = 'local_<img data-music-xss src=x onerror="window.__musicXss=true">.mp3';
const file = (name, buffer = musicBytes) => ({ name, mimeType: 'audio/mpeg', buffer });
const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(macChrome) ? macChrome : undefined),
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
});
let completed = 0;

async function openLibrary(page) {
  await page.locator('#menu-button').click();
  await page.locator('#music-library-button').click();
  await page.locator('#game-dialog[open]').waitFor();
  assert.equal(await page.locator('#dialog-title').innerText(), '音乐库');
}

async function importFiles(page, files, selector = '#music-import') {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator(selector).click()]);
  assert.equal(chooser.isMultiple(), selector === '#music-import');
  await chooser.setFiles(files);
}

function catalog(page, id) {
  return page.locator(`li[data-catalog-id="${id}"]`);
}

async function audioState(page) {
  return page.locator('#town-music').evaluate(audio => ({
    src: audio.src, paused: audio.paused, time: audio.currentTime, duration: audio.duration,
    loop: audio.loop, error: audio.error?.message ?? null,
  }));
}

async function waitPlaying(page, after = .05) {
  await page.waitForFunction(time => {
    const audio = document.querySelector('#town-music');
    return !audio.paused && audio.currentTime > time && !audio.error;
  }, after, { timeout: 30000 });
}

async function snapshots(page) {
  return page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
}

async function assertNoStoredFiles(page, original) {
  const actual = await snapshots(page);
  delete actual.local[musicKey];
  const expected = structuredClone(original);
  delete expected.local[musicKey];
  assert.deepEqual(actual, expected, 'Importing and playing audio must not persist files, metadata or game changes.');
}

async function assertFits(page, width, button) {
  if (button) {
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, 'The music library needs usable touch targets.');
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= 813,
      `The control must fit the viewport: ${JSON.stringify(box)}`);
    assert.equal(await button.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return element === hit || element.contains(hit);
    }), true);
  }
  const size = await page.evaluate(() => {
    const dialog = document.querySelector('#game-dialog');
    return { page: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth), dialog: dialog.getBoundingClientRect().width, scroll: dialog.scrollWidth, client: dialog.clientWidth };
  });
  assert.ok(size.page <= width + 1 && size.dialog <= width && size.scroll <= size.client + 1,
    `The library overflows at ${width}px: ${JSON.stringify(size)}`);
}

async function isolated(name, check, beforeNavigate) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  try {
    if (beforeNavigate) await beforeNavigate(page);
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '繁荣之路', exact: true }).waitFor();
    await check(page);
    assert.deepEqual(errors, [], 'The library must not raise uncaught JavaScript errors.');
    completed += 1;
    console.log(`PASS ${name}`);
  } finally {
    await context.close();
  }
}

try {
  await mkdir('.qa', { recursive: true });

  await isolated('16曲目录、批量匹配、安全文件名、仅本地播放与清除刷新', async page => {
    const originalStorage = await snapshots(page);
    const transfers = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (['http:', 'https:'].includes(url.protocol) && !url.pathname.startsWith('/cdn-cgi/') &&
          (['fetch', 'xhr', 'ping'].includes(request.resourceType()) || !['GET', 'HEAD'].includes(request.method()))) {
        transfers.push({ url: request.url(), method: request.method(), type: request.resourceType() });
      }
    });
    await openLibrary(page);
    assert.equal(await page.locator('li[data-catalog-id]').count(), 16);
    assert.equal(await page.locator('[data-action="music-select"]').count(), 0);
    assert.equal(await page.locator('#music-next').isDisabled(), true);
    assert.equal(await page.locator('#music-clear').isDisabled(), true);
    assert.match(await page.locator('#music-library-note').innerText(), /不会上传.*刷新/s);
    await importFiles(page, [file('Town_Rhodok.mp3'), file('Town_Swadian.mp3'), file(unsafeName)]);
    assert.equal(await page.locator('[data-action="music-select"]').count(), 3);
    assert.equal(await catalog(page, 'warband-town-rhodok').locator('[data-action="music-select"]').count(), 1);
    assert.equal(await catalog(page, 'warband-town-swadian').locator('[data-action="music-select"]').count(), 1);
    assert.equal((await audioState(page)).paused, true, 'Importing files alone must not start playback.');
    assert.equal(await page.locator('[data-music-xss]').count(), 0);
    assert.equal(await page.evaluate(() => window.__musicXss), undefined);
    assert.ok((await page.locator('#game-dialog').innerText()).includes(unsafeName));
    await catalog(page, 'warband-town-rhodok').locator('[data-action="music-select"]').click();
    await waitPlaying(page);
    const first = await audioState(page);
    assert.match(first.src, /^blob:/);
    assert.equal(first.loop, false, 'Multiple imported tracks play as a queue.');
    assert.match(await page.locator('#music-library-status').innerText(), /Town Rhodok/);
    await page.locator('#music-next').click();
    await waitPlaying(page);
    const second = await audioState(page);
    assert.match(second.src, /^blob:/);
    assert.notEqual(second.src, first.src);
    assert.match(await page.locator('#music-library-status').innerText(), /Town Swadian/);
    await page.locator('#music-next').click();
    await waitPlaying(page);
    assert.ok((await page.locator('#music-library-status').innerText()).includes(unsafeName));
    assert.equal(await page.locator('[data-music-xss]').count(), 0);
    await page.locator('#music-original').click();
    await waitPlaying(page);
    assert.match((await audioState(page)).src, /\/audio\/town-theme\.mp3$/);
    assert.equal((await audioState(page)).loop, true);
    await page.locator('#music-clear').click();
    assert.equal(await page.locator('[data-action="music-select"]').count(), 0);
    assert.equal(await page.locator('#music-next').isDisabled(), true);
    assert.equal(await page.evaluate(async url => { try { await fetch(url); return true; } catch { return false; } }, first.src), false,
      'Clearing imports must release their Blob URLs.');
    await assertNoStoredFiles(page, originalStorage);
    await importFiles(page, [file('Town_Rhodok.mp3')]);
    await catalog(page, 'warband-town-rhodok').locator('[data-action="music-select"]').click();
    await waitPlaying(page);
    assert.equal((await audioState(page)).loop, true, 'A single imported file loops on its own.');
    await assertNoStoredFiles(page, originalStorage);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#music-button').waitFor();
    await openLibrary(page);
    assert.equal(await page.locator('[data-action="music-select"]').count(), 0, 'Refresh requires selecting local files again.');
    assert.match((await audioState(page)).src, /\/audio\/town-theme\.mp3$/);
    assert.equal((await audioState(page)).paused, true);
    assert.deepEqual(transfers, [], 'Local audio operations must not upload files or make data API requests.');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'menu-button');
  });

  await isolated('目录手动绑定及更换文件不会复制条目', async page => {
    await openLibrary(page);
    await importFiles(page, file('my-own-recording.mp3'), '#choose-eu4-eire');
    const entry = catalog(page, 'eu4-eire');
    assert.equal(await page.locator('[data-action="music-select"]').count(), 1);
    await entry.locator('[data-action="music-select"]').click();
    await waitPlaying(page);
    const previous = await audioState(page);
    assert.match(await page.locator('#music-library-status').innerText(), /Éire/);
    const trackId = await entry.locator('[data-action="music-select"]').getAttribute('data-track-id');
    await importFiles(page, file('replacement.mp3'), '#choose-eu4-eire');
    assert.equal(await page.locator('[data-action="music-select"]').count(), 1);
    assert.equal(await entry.locator('[data-action="music-select"]').getAttribute('data-track-id'), trackId);
    await waitPlaying(page);
    assert.notEqual((await audioState(page)).src, previous.src);
    assert.equal(await page.evaluate(async url => { try { await fetch(url); return true; } catch { return false; } }, previous.src), false);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), saveKey), null);
  });

  await isolated('无效本地音频有提示且不阻断游戏', async page => {
    await openLibrary(page);
    await importFiles(page, file('broken.mp3', Buffer.from('This is deliberately not audio.')));
    await page.locator('[data-action="music-select"]').click();
    await page.waitForFunction(() => document.querySelector('#town-music').error !== null);
    assert.match(await page.locator('#music-library-status').innerText(), /无法播放/);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '查看正常市场', exact: true }).click();
    assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), saveKey)).records.length, 1);
    await openLibrary(page);
    await page.locator('#music-original').click();
    await waitPlaying(page);
    assert.equal((await audioState(page)).error, null);
  });

  for (const outcome of ['resolve', 'reject']) {
    await isolated(`快速切歌后旧播放Promise的${outcome}不污染新曲`, async page => {
      await openLibrary(page);
      await importFiles(page, [file('Town_Rhodok.mp3'), file('Town_Swadian.mp3')]);
      await catalog(page, 'warband-town-rhodok').locator('[data-action="music-select"]').click();
      await waitPlaying(page);
      await page.waitForFunction(() => typeof window.__finishOldMusic === 'function');
      const old = await audioState(page);
      await catalog(page, 'warband-town-swadian').locator('[data-action="music-select"]').click();
      await waitPlaying(page);
      const current = await audioState(page);
      assert.notEqual(current.src, old.src);
      await page.evaluate(value => window.__finishOldMusic(value), outcome);
      await waitPlaying(page, current.time);
      assert.equal((await audioState(page)).src, current.src);
      assert.equal((await audioState(page)).error, null);
      assert.match(await page.locator('#music-library-status').innerText(), /Town Swadian/);
      assert.doesNotMatch(await page.locator('#music-library-status').innerText(), /无法播放/);
      assert.equal(await catalog(page, 'warband-town-swadian').locator('[data-action="music-select"]').getAttribute('aria-pressed'), 'true');
    }, async page => {
      await page.addInitScript(() => {
        const originalPlay = HTMLMediaElement.prototype.play;
        let delayed = false;
        HTMLMediaElement.prototype.play = function (...args) {
          const played = originalPlay.apply(this, args);
          if (this.id !== 'town-music' || !this.src.startsWith('blob:') || delayed) return played;
          delayed = true;
          return played.then(() => new Promise((resolve, reject) => {
            window.__finishOldMusic = outcome => outcome === 'resolve' ? resolve() : reject(new DOMException('Delayed error for the previous track', 'NotSupportedError'));
          }));
        };
      });
    });
  }

  for (const width of [375, 320]) {
    await isolated(`${width}px音乐库与长文件名可操作无溢出`, async page => {
      await page.setViewportSize({ width, height: 812 });
      await openLibrary(page);
      await assertFits(page, width, page.locator('#music-import'));
      await importFiles(page, [file('Town_Rhodok.mp3'), file(`Long_local_music_${'very-long-title-'.repeat(12)}.mp3`)]);
      await assertFits(page, width, catalog(page, 'warband-town-rhodok').locator('[data-action="music-select"]'));
      await catalog(page, 'warband-town-rhodok').locator('[data-action="music-select"]').click();
      await waitPlaying(page);
      await assertFits(page, width, page.locator('#music-next'));
      await page.locator('#music-next').click();
      await waitPlaying(page);
      await assertFits(page, width, page.locator('#music-original'));
      await page.screenshot({ path: `.qa/music-library-${width}.png` });
      await assertFits(page, width, page.locator('#music-clear'));
      await page.locator('#music-clear').click();
      assert.equal(await page.locator('[data-action="music-select"]').count(), 0);
    });
  }

  console.log(`Music library smoke: ${completed} isolated scenarios passed. Every valid fixture uses the project's original MP3 bytes.`);
} finally {
  await browser.close();
}
