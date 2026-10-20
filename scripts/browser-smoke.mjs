import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Start Vite before running this script: npm run dev -- --host 127.0.0.1
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const saveKey = 'prosperity-road.bread-crisis.v1';
const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.BROWSER_EXECUTABLE ||
  (existsSync(macChrome) ? macChrome : undefined);
const browser = await chromium.launch({ headless: true, executablePath });
let completed = 0;

function near(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${label}: expected ${expected}, received ${actual}`);
}

async function savedState(page) {
  const text = await page.evaluate(key => localStorage.getItem(key), saveKey);
  assert.ok(text, 'The campaign should be saved after each decision.');
  return JSON.parse(text);
}

async function writeReason(page, reason) {
  const details = page.locator('details').filter({ has: page.locator('#prediction-reason') });
  if (await details.getAttribute('open') === null) {
    await details.locator('summary').click();
  }
  await page.locator('#prediction-reason').fill(reason);
}

async function predict(page, reason) {
  if (await page.locator('#prediction-price-down').count()) {
    await page.locator('#prediction-price-down').click();
    await page.locator('#prediction-purchases-up').click();
    if (reason === undefined) await page.locator('#reason-0').click();
    else await writeReason(page, reason);
  }
}

async function assertDockReachable(page, action = 'settle') {
  const button = page.locator(`.action-dock button[data-action="${action}"]`);
  const box = await button.boundingBox();
  assert.ok(box, 'The main action button must have a visible box.');
  const viewport = page.viewportSize();
  assert.ok(
    box.x >= 0 && box.y >= 0 &&
    box.x + box.width <= viewport.width + 1 &&
    box.y + box.height <= viewport.height + 1,
    `The main action must fit inside the viewport: ${JSON.stringify({ box, viewport })}`,
  );
  assert.ok(box.width >= 44 && box.height >= 44, 'The main action needs a usable touch target.');
  const unobstructed = await button.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return element === hit || element.contains(hit);
  });
  assert.equal(unobstructed, true, 'No other element may cover the main action.');
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: window.innerWidth,
  }));
  assert.ok(
    Math.max(dimensions.document, dimensions.body) <= dimensions.viewport + 1,
    `${label} overflows the viewport: ${JSON.stringify(dimensions)}`,
  );
}

async function baseline(page) {
  assert.equal(await page.locator('.season-title').innerText(), '正常市场');
  assert.equal(await page.locator('[data-context="draft"]').count(), 0, 'Baseline policies are fixed.');
  await page.getByRole('button', { name: '查看正常市场', exact: true }).click();
  const state = await savedState(page);
  assert.equal(state.records.length, 1);
  near(state.records[0].result.price, 5, 'Baseline price');
  near(state.records[0].result.purchasesLow, 40, 'Baseline low-income purchases');
  near(state.records[0].result.after.cash, 160, 'Baseline cash');
  assert.match(await page.locator('.stats-grid').innerText(), /5\.00/);
}

async function advance(page) {
  await page.locator('[data-action="next"]').click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'season-title', 'Advancing keeps keyboard focus on the new season.');
}

async function settlePolicy(page, policy = {}) {
  for (const [key, value] of Object.entries(policy)) {
    await page.locator(`#draft-${key}-${value ?? 'none'}`).click();
  }
  await predict(page);
  assert.equal(await page.locator('#settle-button').isDisabled(), false);
  await page.locator('#settle-button').click();
}

async function isolated(name, check) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
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
  await isolated('基期、必填预测、限价结果、刷新恢复与独立回放', async page => {
    await baseline(page);
    await advance(page);
    assert.equal(await page.locator('#settle-button').isDisabled(), true);
    await page.locator('#prediction-price-down').click();
    await page.locator('#prediction-purchases-up').click();
    assert.equal(await page.locator('#settle-button').isDisabled(), true, 'Two directions alone are insufficient.');
    await writeReason(page, '   ');
    assert.equal(await page.locator('#settle-button').isDisabled(), true, 'Whitespace is not a reason.');
    await writeReason(page, '较低的限价可能使生产者减少供给。');
    assert.equal(await page.locator('#settle-button').isDisabled(), false);

    await page.locator('#draft-cap-5').click();
    assert.equal(await page.locator('[data-action="predict"][aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator('#prediction-reason').inputValue(), '');
    assert.equal(await page.locator('#settle-button').isDisabled(), true);
    await predict(page, '限价降低生产者所得，可能减少实际供给与购粮。');
    const decision = await savedState(page);
    assert.equal(decision.version, 1, 'The previous save format remains supported.');
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await savedState(page), decision);
    assert.equal(await page.locator('#draft-cap-5').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#prediction-price-down').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#prediction-purchases-up').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#prediction-reason').inputValue(), decision.prediction.reason);
    assert.equal(await page.locator('#settle-button').isDisabled(), false);
    await page.locator('#settle-button').click();
    const original = await savedState(page);
    const result = original.records[1].result;
    near(result.price, 5, 'Capped price');
    near(result.purchasesLow, 24, 'Capped low-income purchases');
    near(result.excessDemand, 40, 'Capped excess demand');
    await page.locator('#outcome-title').waitFor({ state: 'visible' });
    const effect = page.locator('.effect-card').filter({ hasText: '低收入组实际购粮' });
    assert.match(await effect.innerText(), /24\.00.*无干预 25\.00 → 政策影响 −1\.00/s);
    await page.locator('#tab-people').click();
    const residentRow = page.locator('tbody tr').filter({ hasText: '低收入组' });
    assert.equal(await residentRow.locator('td').nth(2).innerText(), '24.00');
    await page.locator('#tab-market').click();
    assert.match(await page.locator('#market-chart svg').getAttribute('aria-label'), /实际成交60\.00，超额需求40\.00/);

    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await savedState(page), original);
    await page.locator('[data-action="compare-baseline"]').click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'replay-season', 'Opening a comparison focuses the replay selector.');
    assert.deepEqual(await savedState(page), original, 'One-click comparison must not change the campaign.');
    await page.locator('#replay-cap-5').click();
    const autoComparison = page.locator('.comparison-table tbody tr').filter({ hasText: '低收入组实际购粮' });
    assert.equal(await autoComparison.locator('td').nth(2).innerText(), '24.00');
    await page.locator('#replay-cap-none').click();
    const comparison = page.locator('.comparison-table tbody tr').filter({ hasText: '低收入组实际购粮' });
    assert.equal(await comparison.locator('td').nth(1).innerText(), '24.00');
    assert.equal(await comparison.locator('td').nth(2).innerText(), '25.00');
    assert.equal(await comparison.locator('td').nth(3).innerText(), '+1.00');
    assert.deepEqual(await savedState(page), original, 'Replay must leave the original campaign untouched.');
  });

  await isolated('六季成功路径、报告保存与下载、弹窗焦点、375px布局', async page => {
    await page.locator('#help-button').click();
    await page.locator('#game-dialog[open]').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#game-dialog').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'help-button');
    await page.locator('#help-button').click();
    await page.getByRole('button', { name: '返回游戏', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'help-button');
    await page.locator('#reset-button').click();
    await page.getByRole('button', { name: '继续当前游戏', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'reset-button');

    await baseline(page);
    for (const policy of [{ release: 20 }, { release: 20 }, { subsidy: 1 }, {}, {}]) {
      await advance(page);
      assert.deepEqual((await savedState(page)).draft, { cap: null, subsidy: 0, release: 0 }, 'Policies expire each season.');
      await settlePolicy(page, policy);
    }
    await advance(page);
    const completedState = await savedState(page);
    assert.equal(completedState.phase, 'complete');
    assert.equal(completedState.records.length, 6);
    assert.equal(completedState.records.filter(row => row.result.coverageLow >= 0.95).length, 6);
    near(completedState.records[5].result.after.cash, 4645 / 18, 'Successful path final cash');
    near(completedState.records[5].result.after.reserves, 20, 'Successful path final reserves');
    assert.match(await page.locator('#active-view').innerText(), /任期目标已达成/);

    const reportText = '</textarea><img data-smoke-injection src=x onerror="window.__smokeXss=true">我在第2、3季释放储备。';
    await page.locator('textarea[data-report="action"]').fill(reportText);
    await page.locator('textarea[data-report="evidence"]').fill('第2季低收入组实际购粮35单位，期末保留20单位储备。');
    await page.locator('textarea[data-report="explanation"]').fill('公共投放增加当季可售量，恢复期补贴带来更多私人生产。');
    await page.locator('textarea[data-report="conditions"]').fill('原料约束、财政空间与未来储备需求改变时，应重新比较政策。');
    await page.locator('#tab-history').click();
    await page.locator('#tab-report').click();
    assert.equal(await page.locator('textarea[data-report="action"]').inputValue(), reportText);
    assert.equal(await page.locator('[data-smoke-injection]').count(), 0);
    assert.equal(await page.evaluate(() => window.__smokeXss), undefined);
    const reportState = await savedState(page);
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await savedState(page), reportState);
    assert.equal(await page.locator('textarea[data-report="action"]').inputValue(), reportText);
    assert.equal(await page.locator('[data-smoke-injection]').count(), 0);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-action="download-report"]').click(),
    ]);
    assert.equal(download.suggestedFilename(), '面包危机-本局学习报告.md');
    const downloadPath = await download.path();
    assert.ok(downloadPath);
    const downloaded = await readFile(downloadPath, 'utf8');
    assert.ok(downloaded.includes(reportText), 'The report preserves student writing as editable source.');
    assert.match(downloaded, /达标季度：6\/6/);
    assert.match(downloaded, /期末储备：20\.00/);
    assert.match(downloaded, /\| 6 \| 无干预 \|/);

    await mkdir('.qa', { recursive: true });
    await page.screenshot({ path: '.qa/browser-smoke-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    for (const view of ['command', 'town', 'market', 'people', 'accounts', 'history', 'replay', 'report']) {
      await page.locator(`#tab-${view}`).click();
      if (view === 'replay') await page.locator('[data-action="run-replay"]').click();
      await assertNoHorizontalOverflow(page, view);
    }
    await page.locator('#tab-town').click();
    await page.screenshot({ path: '.qa/browser-smoke-mobile.png', fullPage: true });
  });

  await isolated('预算不足时拒绝整组政策并保留历史', async page => {
    await baseline(page);
    await advance(page);
    await settlePolicy(page, { subsidy: 2 });
    near((await savedState(page)).records[1].result.after.cash, 20, 'Cash available after subsidy');
    await advance(page);
    await page.locator('#draft-subsidy-1').click();
    assert.match(await page.locator('.resource-check').innerText(), /现金不足/);
    assert.equal(await page.locator('#settle-button').isDisabled(), true);
    const before = await savedState(page);
    // Check the settlement guard too, even if a client bypasses the disabled UI.
    await page.locator('#settle-button').evaluate(button => {
      button.disabled = false;
      button.click();
    });
    assert.equal(await page.locator('#settle-button').isDisabled(), true);
    assert.deepEqual(await savedState(page), before);
    assert.equal(before.records.length, 2);
    assert.equal(before.phase, 'decision');
  });

  await isolated('储备不足时拒绝整组政策并保留历史', async page => {
    await baseline(page);
    for (let season = 2; season <= 4; season += 1) {
      await advance(page);
      await settlePolicy(page, { release: 20 });
    }
    near((await savedState(page)).records[3].result.after.reserves, 0, 'Reserves after three releases');
    await advance(page);
    await page.locator('#draft-release-10').click();
    assert.match(await page.locator('.resource-check').innerText(), /公共储备不足/);
    assert.equal(await page.locator('#settle-button').isDisabled(), true);
    const before = await savedState(page);
    await page.locator('#settle-button').evaluate(button => {
      button.disabled = false;
      button.click();
    });
    assert.equal(await page.locator('#settle-button').isDisabled(), true);
    assert.deepEqual(await savedState(page), before);
    assert.equal(before.records.length, 4);
    assert.equal(before.phase, 'decision');
  });

  for (const [device, viewport] of [
    ['desktop', { width: 1280, height: 800 }],
    ['mobile', { width: 375, height: 812 }],
  ]) {
    await isolated(`${device} 操作可达、三次点击预测、即时结算反馈与无损试算`, async page => {
      await page.setViewportSize(viewport);
      await assertDockReachable(page);
      await baseline(page);
      await assertDockReachable(page, 'next');
      await advance(page);
      await assertDockReachable(page);
      await page.locator('#strategy-1').click();
      assert.deepEqual((await savedState(page)).draft, { cap: 5, subsidy: 0, release: 0 });
      await page.locator('#prediction-price-down').click();
      await page.locator('#prediction-purchases-up').click();
      assert.equal(await page.locator('#settle-button').isDisabled(), true);
      await page.locator('#reason-1').click();
      assert.equal(await page.locator('#settle-button').isDisabled(), false, 'Three clicks complete the prediction without typing.');
      const selectedPrediction = (await savedState(page)).prediction;
      assert.ok(selectedPrediction.reason.trim());
      await page.locator('#strategy-1').click();
      assert.deepEqual((await savedState(page)).prediction, selectedPrediction, 'Re-selecting a strategy preserves the prediction.');
      await page.locator('#draft-cap-5').click();
      assert.deepEqual((await savedState(page)).prediction, selectedPrediction, 'Re-selecting the same policy preserves the prediction.');
      await page.locator('#strategy-2').click();
      assert.deepEqual((await savedState(page)).prediction, { price: '', purchases: '', reason: '' });
      assert.equal(await page.locator('#settle-button').isDisabled(), true);
      await page.locator('#strategy-1').click();
      await predict(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await assertDockReachable(page);
      await assertNoHorizontalOverflow(page, `${device} decision`);
      await page.screenshot({ path: `.qa/ux-${device}-decision.png` });
      await page.locator('#settle-button').click();
      const title = page.locator('#outcome-title');
      await title.waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'outcome-title', 'Settlement focuses the new outcome.');
      const titleBox = await title.boundingBox();
      assert.ok(titleBox && titleBox.y >= 0 && titleBox.y + titleBox.height <= viewport.height, 'The outcome headline should be immediately in view.');
      assert.match(await title.innerText(), /未达标.*少买 1 篮/);
      const effect = page.locator('.effect-card').filter({ hasText: '低收入组实际购粮' });
      assert.match(await effect.innerText(), /24\.00.*无干预 25\.00 → 政策影响 −1\.00/s);
      await assertDockReachable(page, 'next');
      await assertNoHorizontalOverflow(page, `${device} result`);
      await page.screenshot({ path: `.qa/ux-${device}-result.png` });
      const original = await savedState(page);
      await page.locator('[data-action="compare-baseline"]').click();
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'replay-season');
      const row = page.locator('.comparison-table tbody tr').filter({ hasText: '低收入组实际购粮' });
      assert.equal(await row.locator('td').nth(1).innerText(), '24.00');
      assert.equal(await row.locator('td').nth(2).innerText(), '25.00');
      assert.equal(await row.locator('td').nth(3).innerText(), '+1.00');
      assert.deepEqual(await savedState(page), original);
      await page.reload({ waitUntil: 'networkidle' });
      assert.deepEqual(await savedState(page), original);
      assert.match(await page.locator('#outcome-title').innerText(), /未达标/);
    });
  }

  console.log(`Browser smoke: ${completed} isolated scenarios passed.`);
} finally {
  await browser.close();
}
