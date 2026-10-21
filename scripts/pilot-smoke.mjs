import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Start Vite before running: npm run dev -- --host 127.0.0.1 --port 5173
// SKIP_DEMO_VIDEO=1 is only for development before the final video asset exists.
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const saveKey = 'prosperity-road.bread-crisis.v1';
const feedbackKey = 'prosperity-road.pilot-feedback.v1';
const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.BROWSER_EXECUTABLE ||
  (existsSync(macChrome) ? macChrome : undefined);
const browser = await chromium.launch({
  headless: true, executablePath,
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
});
let completed = 0;

const feedback = {
  code: 'P01', ease: '3', fun: '4',
  stuck: '</textarea><img data-pilot-xss src=x onerror="window.__pilotXss=true">第2季找预测按钮时停了一下。',
  learned: '第2季限价5后，低收入组购粮24；同季不干预是25。便宜不一定买得更多。',
  suggestion: '<script>window.__pilotXss=true</script>希望更快找到政策比较。',
};

async function storage(page, key) {
  return page.evaluate(storageKey => localStorage.getItem(storageKey), key);
}

async function openPilot(page, id = 'pilot-button') {
  await page.locator(`#${id}`).click();
  await page.locator('#game-dialog[open]').waitFor();
  assert.equal(await page.locator('#dialog-title').innerText(), '学生试玩');
}

async function fillFeedback(page) {
  for (const [key, value] of Object.entries(feedback)) {
    const field = page.locator(`#feedback-${key}`);
    if (key === 'ease' || key === 'fun') await field.selectOption(value);
    else await field.fill(value);
  }
}

async function assertFeedback(page, expected = feedback) {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(await page.locator(`#feedback-${key}`).inputValue(), value, `The ${key} draft should survive reopening.`);
  }
  assert.equal(await page.locator('[data-pilot-xss]').count(), 0, 'Feedback must render as text, never injected HTML.');
  assert.equal(await page.evaluate(() => window.__pilotXss), undefined, 'Student writing must never execute.');
}

async function twoSeasons(page) {
  await page.getByRole('button', { name: '查看正常市场', exact: true }).click();
  await page.locator('[data-action="next"]').click();
  await page.locator('#draft-cap-5').click();
  await page.locator('#prediction-price-down').click();
  await page.locator('#prediction-purchases-up').click();
  await page.locator('#reason-1').click();
  await page.locator('#settle-button').click();
  const state = JSON.parse(await storage(page, saveKey));
  assert.equal(state.records.length, 2);
  assert.equal(state.records[0].result.price, 5);
  assert.equal(state.records[0].result.purchasesLow, 40);
  assert.equal(state.records[1].result.price, 5);
  assert.equal(state.records[1].result.purchasesLow, 24);
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => {
    const dialog = document.querySelector('#game-dialog');
    return {
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      viewport: window.innerWidth,
      dialog: dialog ? { width: dialog.getBoundingClientRect().width, scroll: dialog.scrollWidth, client: dialog.clientWidth } : null,
    };
  });
  assert.ok(Math.max(dimensions.document, dimensions.body) <= dimensions.viewport + 1,
    `${label} page overflows: ${JSON.stringify(dimensions)}`);
  if (dimensions.dialog) {
    assert.ok(dimensions.dialog.width <= dimensions.viewport && dimensions.dialog.scroll <= dimensions.dialog.client + 1,
      `${label} dialog overflows: ${JSON.stringify(dimensions)}`);
  }
}

async function assertReachable(page, locator, label) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
    `${label} must fit the viewport: ${JSON.stringify({ box, viewport })}`);
  assert.ok(box.width >= 44 && box.height >= 44, `${label} needs a touch target of at least 44px.`);
  assert.equal(await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return element === hit || element.contains(hit);
  }), true, `${label} must not be covered by another element.`);
}

async function isolated(name, check) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10_000);
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: '繁荣之路', exact: true }).waitFor();
    await check(page);
    assert.deepEqual(errors, [], 'The page must not raise uncaught JavaScript errors.');
    completed += 1;
    console.log(`PASS ${name}`);
  } finally {
    await context.close();
  }
}

try {
  await mkdir('.qa', { recursive: true });

  await isolated('试玩入口、键盘焦点、草稿持久化与安全显示', async page => {
    const originalGame = await storage(page, saveKey);
    for (const entry of ['intro-pilot', 'pilot-button']) {
      await openPilot(page, entry);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#game-dialog').count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement?.id), entry, 'Escape should return focus to the original entry.');
    }
    await openPilot(page);
    assert.match(await page.locator('.pilot-feedback').innerText(), /不会自动上传/);
    await fillFeedback(page);
    assert.deepEqual(JSON.parse(await storage(page, feedbackKey)), feedback);
    assert.equal(await storage(page, saveKey), originalGame, 'Writing feedback must not create or alter a campaign.');
    await page.keyboard.press('Escape');
    await openPilot(page);
    await assertFeedback(page);
    await page.getByRole('button', { name: '返回游戏 ×', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'pilot-button');
    await page.reload({ waitUntil: 'networkidle' });
    await openPilot(page);
    await assertFeedback(page);
    assert.equal(await storage(page, saveKey), originalGame);
    await page.screenshot({ path: '.qa/pilot-desktop.png' });
  });

  await isolated('中途导出两季真实记录、无自动上传与独立清空反馈', async page => {
    await twoSeasons(page);
    const originalGame = await storage(page, saveKey);
    const dataRequests = [];
    page.on('request', request => {
      const url = new URL(request.url());
      // The public host may inject Cloudflare telemetry independently of the game.
      const gameRequest = url.origin === new URL(baseURL).origin && !url.pathname.startsWith('/cdn-cgi/');
      if (gameRequest && (['fetch', 'xhr', 'ping'].includes(request.resourceType()) || !['GET', 'HEAD'].includes(request.method()))) {
        dataRequests.push({ url: request.url(), method: request.method(), type: request.resourceType() });
      }
    });
    await openPilot(page);
    await fillFeedback(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#download-feedback').click(),
    ]);
    assert.equal(download.suggestedFilename(), '繁荣之路-试玩反馈.md');
    const path = await download.path();
    assert.ok(path);
    const report = await readFile(path, 'utf8');
    for (const key of ['code', 'stuck', 'learned', 'suggestion']) {
      assert.ok(report.includes(feedback[key]), `The report must preserve ${key} as editable text.`);
    }
    assert.match(report, /2\s*\/\s*6/, 'A mid-game report must state that only two seasons are settled.');
    assert.match(report, /^\|\s*1\s*\|[^\n]*5\.00[^\n]*40\.00/m, 'The report must include the real baseline data.');
    assert.match(report, /^\|\s*2\s*\|[^\n]*5\.00[^\n]*24\.00/m, 'The report must include the real second-season data.');
    assert.doesNotMatch(report, /^\|\s*[3-6]\s*\|/m, 'Unplayed seasons must not acquire fabricated outcomes.');
    assert.match(report, /试玩版本：\S+/);
    assert.match(report, /操作是否清楚：3\/5/);
    assert.match(report, /是否愿意继续玩：4\/5/);
    assert.match(await page.locator('#feedback-status').innerText(), /交给老师.*尚未自动发送/);
    assert.equal(await storage(page, saveKey), originalGame, 'Downloading feedback must not change the game.');
    await page.locator('[data-action="clear-feedback"]').click();
    await assertFeedback(page, Object.fromEntries(Object.keys(feedback).map(key => [key, ''])));
    assert.equal(await storage(page, feedbackKey), null, 'Clearing feedback must delete the saved draft key.');
    assert.equal(await storage(page, saveKey), originalGame, 'Clearing only feedback must preserve the game.');
    assert.match(await page.locator('#feedback-status').innerText(), /游戏进度保持不变/);
    await page.reload({ waitUntil: 'networkidle' });
    await openPilot(page);
    await assertFeedback(page, Object.fromEntries(Object.keys(feedback).map(key => [key, ''])));
    assert.equal(await storage(page, feedbackKey), null, 'A deleted feedback draft must stay absent after reload.');
    assert.equal(await storage(page, saveKey), originalGame);
    assert.deepEqual(dataRequests, [], 'Drafting, downloading, clearing and restoring feedback must not upload or fetch data.');
  });

  await isolated('共享设备新任期确认、取消保留与确认清空', async page => {
    await twoSeasons(page);
    await openPilot(page);
    await fillFeedback(page);
    await page.keyboard.press('Escape');
    const originalGame = await storage(page, saveKey);
    const originalFeedback = await storage(page, feedbackKey);
    await page.locator('#reset-button').click();
    assert.match(await page.locator('#game-dialog').innerText(), /清空.*试玩反馈|试玩反馈.*清空/, 'Reset must disclose that it also clears the feedback draft.');
    await page.getByRole('button', { name: '继续当前游戏', exact: true }).click();
    assert.equal(await storage(page, saveKey), originalGame);
    assert.equal(await storage(page, feedbackKey), originalFeedback);
    await page.locator('#reset-button').click();
    await page.locator('[data-action="confirm-reset"]').click();
    const fresh = JSON.parse(await storage(page, saveKey));
    assert.equal(fresh.phase, 'briefing');
    assert.deepEqual(fresh.records, []);
    assert.equal(await storage(page, feedbackKey), null, 'Starting a new term must delete the previous feedback draft.');
    await openPilot(page, 'intro-pilot');
    await assertFeedback(page, Object.fromEntries(Object.keys(feedback).map(key => [key, ''])));
    assert.match(await page.locator('.pilot-meta').innerText(), /0\/6/);
    await page.keyboard.press('Escape');
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(JSON.parse(await storage(page, saveKey)), fresh);
    await openPilot(page);
    await assertFeedback(page, Object.fromEntries(Object.keys(feedback).map(key => [key, ''])));
    assert.equal(await storage(page, feedbackKey), null);
  });

  await isolated('存储配额已满时仍能删除旧反馈', async page => {
    await twoSeasons(page);
    const originalGame = await storage(page, saveKey);
    await openPilot(page);
    await fillFeedback(page);
    assert.ok(await storage(page, feedbackKey));
    await page.evaluate(() => {
      Storage.prototype.setItem = function () { throw new DOMException('Quota exceeded for this test', 'QuotaExceededError'); };
    });
    await page.locator('#feedback-code').fill('UNSAVED');
    assert.match(await page.locator('#feedback-status').innerText(), /无法保存反馈草稿/);
    assert.equal(JSON.parse(await storage(page, feedbackKey)).code, feedback.code, 'The failed write leaves the previous persisted draft.');
    await page.locator('[data-action="clear-feedback"]').click();
    await assertFeedback(page, Object.fromEntries(Object.keys(feedback).map(key => [key, ''])));
    assert.equal(await storage(page, feedbackKey), null, 'Deleting a draft must succeed even when setItem cannot write.');
    assert.equal(await storage(page, saveKey), originalGame);
    assert.match(await page.locator('#feedback-status').innerText(), /反馈草稿已清空/);
    await page.reload({ waitUntil: 'networkidle' });
    await openPilot(page);
    await assertFeedback(page, Object.fromEntries(Object.keys(feedback).map(key => [key, ''])));
    assert.equal(await storage(page, feedbackKey), null);
    assert.equal(await storage(page, saveKey), originalGame);
  });

  await isolated('删除反馈被浏览器拒绝时保留真实警告与游戏状态', async page => {
    await twoSeasons(page);
    const originalGame = await storage(page, saveKey);
    await openPilot(page);
    await fillFeedback(page);
    const originalFeedback = await storage(page, feedbackKey);
    await page.evaluate(() => {
      Storage.prototype.removeItem = function () { throw new DOMException('Deletion blocked for this test', 'SecurityError'); };
    });
    await page.locator('[data-action="clear-feedback"]').click();
    await assertFeedback(page, Object.fromEntries(Object.keys(feedback).map(key => [key, ''])));
    const status = page.locator('#feedback-status');
    await status.scrollIntoViewIfNeeded();
    assert.equal(await status.isVisible(), true);
    assert.match(await status.innerText(), /未能删除旧草稿.*刷新可能恢复/);
    assert.doesNotMatch(await status.innerText(), /反馈草稿已清空，游戏进度保持不变/);
    assert.equal(await storage(page, feedbackKey), originalFeedback, 'The warning must reflect the old draft that still exists.');
    assert.equal(await storage(page, saveKey), originalGame, 'A feedback deletion failure must not alter the game.');
    await page.screenshot({ path: '.qa/pilot-storage-warning.png' });
    await page.keyboard.press('Escape');
    await openPilot(page);
    assert.match(await page.locator('#feedback-status').innerText(), /未能删除旧草稿.*刷新可能恢复/, 'Reopening must not replace the warning with a success claim.');
    await page.reload({ waitUntil: 'networkidle' });
    await openPilot(page);
    await assertFeedback(page);
    assert.equal(await storage(page, saveKey), originalGame);
  });

  await isolated('新任期删除反馈失败时明确提示旧草稿残留', async page => {
    await twoSeasons(page);
    await openPilot(page);
    await fillFeedback(page);
    const originalFeedback = await storage(page, feedbackKey);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      Storage.prototype.removeItem = function () { throw new DOMException('Deletion blocked for this test', 'SecurityError'); };
    });
    await page.locator('#reset-button').click();
    await page.locator('[data-action="confirm-reset"]').click();
    const fresh = JSON.parse(await storage(page, saveKey));
    assert.equal(fresh.phase, 'briefing');
    assert.deepEqual(fresh.records, []);
    assert.equal(await storage(page, feedbackKey), originalFeedback, 'The old feedback actually remains when deletion is blocked.');
    const warning = page.locator('.notice').filter({ hasText: '浏览器未能删除旧草稿' });
    assert.equal(await warning.isVisible(), true, 'The new-game screen must visibly disclose incomplete feedback deletion.');
    assert.match(await warning.innerText(), /刷新可能恢复.*共享设备/s);
    assert.doesNotMatch(await warning.innerText(), /反馈草稿已清空，游戏进度保持不变/);
    await openPilot(page);
    await assertFeedback(page, Object.fromEntries(Object.keys(feedback).map(key => [key, ''])));
    assert.match(await page.locator('#feedback-status').innerText(), /未能删除旧草稿.*刷新可能恢复/);
    assert.equal(await storage(page, saveKey), JSON.stringify(fresh));
  });

  for (const width of [375, 320]) {
    await isolated(`${width}px 手机布局、可触达反馈表与主操作`, async page => {
      await page.setViewportSize({ width, height: 812 });
      await assertNoHorizontalOverflow(page, `${width}px introduction`);
      await assertReachable(page, page.locator('.action-dock [data-action="settle"]'), 'The bottom main action');
      await page.locator('#pilot-button').scrollIntoViewIfNeeded();
      await assertReachable(page, page.locator('#pilot-button'), 'The playtest entry');
      await openPilot(page);
      await assertNoHorizontalOverflow(page, `${width}px feedback`);
      await fillFeedback(page);
      await page.locator('#download-feedback').scrollIntoViewIfNeeded();
      await assertReachable(page, page.locator('#download-feedback'), 'The feedback download');
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download-feedback').click()]);
      assert.ok(await download.path());
      await page.screenshot({ path: `.qa/pilot-mobile-${width}.png` });
      await page.keyboard.press('Escape');
      await assertReachable(page, page.locator('.action-dock [data-action="settle"]'), 'The bottom main action after closing feedback');
      await page.locator('.action-dock [data-action="settle"]').click();
      await assertReachable(page, page.locator('.action-dock [data-action="next"]'), 'The next-season action');
      assert.equal(JSON.parse(await storage(page, saveKey)).records.length, 1);
    });
  }

  if (process.env.SKIP_DEMO_VIDEO === '1') {
    console.log('SKIP demo video: development-only flag. Run again without SKIP_DEMO_VIDEO before release.');
  } else {
    await isolated('演示视频按需加载、有效时长与实际播放', async page => {
      const mediaRequests = [];
      page.on('request', request => {
        if (/prosperity-road-demo\.mp4/.test(request.url())) mediaRequests.push(request.url());
      });
      await openPilot(page);
      const video = page.locator('#pilot-demo');
      assert.equal(await video.getAttribute('autoplay'), null, 'The demo must never autoplay.');
      assert.equal(await video.getAttribute('preload'), 'none', 'The demo should not download before the learner chooses to play it.');
      assert.equal(await video.evaluate(element => element.paused), true);
      assert.deepEqual(mediaRequests, [], 'Opening the playtest form must not fetch the video file.');
      await page.locator('.pilot-video summary').click();
      await video.evaluate(element => element.load());
      await page.waitForFunction(() => {
        const element = document.querySelector('#pilot-demo');
        return element.readyState >= 1 || Boolean(element.error);
      }, undefined, { timeout: 30_000 });
      const metadata = await video.evaluate(element => ({ duration: element.duration, error: element.error?.message, width: element.videoWidth, height: element.videoHeight }));
      assert.equal(metadata.error, undefined, 'The browser must decode the demonstration MP4.');
      assert.ok(Number.isFinite(metadata.duration) && metadata.duration > 60, `The complete demonstration should exceed one minute: ${JSON.stringify(metadata)}`);
      assert.ok(metadata.width > 0 && metadata.height > 0, 'The video must have a real image stream.');
      await video.evaluate(element => element.play());
      await page.waitForFunction(() => {
        const element = document.querySelector('#pilot-demo');
        return !element.paused && element.currentTime > 0.2;
      });
      await video.evaluate(element => element.pause());
      assert.ok(mediaRequests.length > 0);
      await video.scrollIntoViewIfNeeded();
      await page.screenshot({ path: '.qa/pilot-video.png' });
    });
  }

  console.log(`Pilot smoke: ${completed} isolated scenarios passed.${process.env.SKIP_DEMO_VIDEO === '1' ? ' Video validation is still required.' : ''}`);
} finally {
  await browser.close();
}
