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
const browser = await chromium.launch({
  headless: true, executablePath,
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
});
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
  if (await page.locator('#prediction-next').count()) await page.locator('#prediction-next').click();
  if (await page.locator('#prediction-price-down').count()) {
    await page.locator('#prediction-price-down').click();
    await page.locator('#prediction-purchases-up').click();
    if (reason === undefined) await page.locator('#reason-0').click();
    else await writeReason(page, reason);
  }
}

async function openMenuAction(page, id) {
  await page.locator('#menu-button').click();
  await page.locator(`#${id}`).click();
}

async function selectView(page, view) {
  if (!['command', 'town'].includes(view) && !await page.locator(`#tab-${view}`).isVisible()) {
    await page.locator('#tab-data').click();
  }
  await page.locator(`#tab-${view}`).click();
}

async function customize(page, key, value) {
  const custom = page.locator('#policy-custom');
  if (await custom.getAttribute('open') === null) await custom.locator('summary').click();
  await page.locator(`#draft-${key}-${value ?? 'none'}`).click();
  assert.notEqual(await custom.getAttribute('open'), null, 'Custom controls remain open while adjusting a combination.');
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
  assert.match(await page.locator('.effect-grid').innerText(), /5\.00/);
  assert.equal(await page.locator('.effect-card').count(), 2, 'The outcome leads with only price and actual purchases.');
}

async function advance(page) {
  await page.locator('[data-action="next"]').click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'season-title', 'Advancing keeps keyboard focus on the new season.');
}

async function settlePolicy(page, policy = {}) {
  for (const [key, value] of Object.entries(policy)) {
    await customize(page, key, value);
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
    assert.equal(await page.locator('#settle-button').count(), 0, 'Policy selection has only the next-step action.');
    await page.locator('#prediction-next').click();
    assert.equal(await page.locator('#settle-button').isDisabled(), true);
    await page.locator('#prediction-price-down').click();
    await page.locator('#prediction-purchases-up').click();
    assert.equal(await page.locator('#settle-button').isDisabled(), true, 'Two directions alone are insufficient.');
    await writeReason(page, '   ');
    assert.equal(await page.locator('#settle-button').isDisabled(), true, 'Whitespace is not a reason.');
    const partialPrediction = await savedState(page);
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await savedState(page), partialPrediction);
    assert.equal(await page.locator('#prediction-price-down').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#settle-button').isDisabled(), true, 'A partial restored forecast stays in the prediction step and cannot execute.');
    await writeReason(page, '较低的限价可能使生产者减少供给。');
    assert.equal(await page.locator('#settle-button').isDisabled(), false);

    await page.locator('[data-action="guide-policy"]').click();
    await customize(page, 'cap', 5);
    assert.deepEqual((await savedState(page)).prediction, { price: '', purchases: '', reason: '' });
    await page.locator('#prediction-next').click();
    assert.equal(await page.locator('#settle-button').isDisabled(), true);
    await predict(page, '限价降低生产者所得，可能减少实际供给与购粮。');
    const decision = await savedState(page);
    assert.equal(decision.version, 1, 'The previous save format remains supported.');
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await savedState(page), decision);
    assert.equal(await page.locator('[data-context="draft"]').count(), 0, 'Restored predictions open their own focused step.');
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
    await selectView(page, 'people');
    const residentRow = page.locator('tbody tr').filter({ hasText: '低收入组' });
    assert.equal(await residentRow.locator('td').nth(2).innerText(), '24.00');
    await selectView(page, 'market');
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
    await openMenuAction(page, 'help-button');
    await page.locator('#game-dialog[open]').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#game-dialog').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'menu-button');
    await openMenuAction(page, 'help-button');
    await page.getByRole('button', { name: '返回游戏', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'menu-button');
    await openMenuAction(page, 'reset-button');
    await page.getByRole('button', { name: '继续当前游戏', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'menu-button');

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
    await selectView(page, 'history');
    await selectView(page, 'report');
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
      await selectView(page, view);
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
    await customize(page, 'subsidy', 1);
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
    await customize(page, 'release', 10);
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
    ['small-mobile', { width: 320, height: 812 }],
  ]) {
    await isolated(`${device} 操作可达、三次点击预测、即时结算反馈与无损试算`, async page => {
      await page.setViewportSize(viewport);
      await assertDockReachable(page);
      await baseline(page);
      await assertDockReachable(page, 'next');
      await advance(page);
      await assertDockReachable(page, 'guide-prediction');
      assert.equal(await page.locator('.action-dock .primary').count(), 1, 'Each step has one primary action.');
      assert.equal(await page.locator('.stats-grid, .policy-panel').count(), 0, 'Repeated global statistics and the policy sidebar are removed.');
      assert.equal(await page.locator('.top-actions button').count(), 1, 'Utilities are collected in one menu.');
      assert.equal(await page.locator('.resource-status').count(), 1);
      assert.doesNotMatch(await page.locator('.resource-status').innerText(), /售价|价格|购粮|5\.00|40\.00/, 'Global status must not present prior outcomes as current predictions.');
      assert.equal(await page.locator('.economy-scene').count(), 0, 'The decision step focuses on the policy choice.');
      assert.equal(await page.locator('.secondary-tabs').count(), 0, 'Detailed data navigation is tucked away by default.');
      assert.equal(await page.locator('#prediction-price-down').count(), 0, 'Predictions belong to the next step.');
      assert.equal(await page.locator('#policy-custom').getAttribute('open'), null, 'Fine-tuning starts collapsed.');
      await page.locator('#strategy-1').click();
      assert.deepEqual((await savedState(page)).draft, { cap: 5, subsidy: 0, release: 0 });
      await page.screenshot({ path: `.qa/ux-${device}-policy.png` });
      await page.locator('#prediction-next').click();
      assert.equal(await page.locator('[data-context="draft"], [data-action="strategy"]').count(), 0, 'The prediction step does not also show policy inputs.');
      assert.equal(await page.locator('.action-dock .primary').count(), 1);
      await assertDockReachable(page);
      await page.locator('#prediction-price-down').click();
      await page.locator('#prediction-purchases-up').click();
      assert.equal(await page.locator('#settle-button').isDisabled(), true);
      await page.locator('#reason-1').click();
      assert.equal(await page.locator('#settle-button').isDisabled(), false, 'Three clicks complete the prediction without typing.');
      const selectedPrediction = (await savedState(page)).prediction;
      assert.ok(selectedPrediction.reason.trim());
      await page.locator('[data-action="guide-policy"]').click();
      assert.deepEqual((await savedState(page)).prediction, selectedPrediction, 'Going back alone keeps the prediction.');
      await page.locator('#strategy-1').click();
      assert.deepEqual((await savedState(page)).prediction, selectedPrediction, 'Re-selecting a strategy preserves the prediction.');
      await customize(page, 'cap', 5);
      assert.deepEqual((await savedState(page)).prediction, selectedPrediction, 'Re-selecting the same policy preserves the prediction.');
      await page.locator('#strategy-2').click();
      assert.deepEqual((await savedState(page)).prediction, { price: '', purchases: '', reason: '' });
      assert.equal(await page.locator('#settle-button').count(), 0, 'Changing policy returns to the policy step.');
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
      assert.equal(await page.locator('.effect-card').count(), 2);
      assert.equal(await page.locator('#forecast-review').getAttribute('open'), null, 'Prediction checking is available without overwhelming the main outcome.');
      assert.match(await page.locator('.resource-impact').innerText(), /国库|储备/);
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
      await advance(page);
      assert.match(await page.locator('.stage-track').innerText(), /确认资源/);
      assert.doesNotMatch(await page.locator('.stage-track').innerText(), /作预测/, 'The third season must not inherit the prior season’s prediction step.');
      assert.equal(await page.locator('#prediction-next').count(), 0, 'The third season can execute without an unnecessary prediction step.');
      assert.equal(await page.locator('#settle-button').isDisabled(), false);
      await assertDockReachable(page);
      await page.locator('#settle-button').click();
      assert.equal((await savedState(page)).records.length, 3);
    });
  }

  await isolated('林岚多轮对话、政策上下文刷新与375px可操作弹窗', async page => {
    const initialStorage = await page.evaluate(() => ({ ...localStorage }));
    await page.locator('#intro-advisor').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'intro-advisor', 'Closing the introduction returns to its portrait entry.');
    await page.locator('#advisor-open').click();
    await page.locator('#game-dialog[open]').waitFor();
    await page.locator('.advisor-portrait img').evaluate(image => image.decode());
    assert.ok(await page.locator('.advisor-portrait img').evaluate(image => image.naturalWidth > 0), 'The adviser portrait must load.');
    assert.match(await page.locator('#advisor-reply').innerText(), /林岚.*六季/s);
    await page.locator('.dialogue-choices [data-topic="challenge"]').click();
    const challenge = await page.locator('#advisor-reply').innerText();
    assert.match(challenge, /便宜.*买得更多/);
    await page.locator('.dialogue-choices [data-topic="answer-price"]').click();
    const priceAnswer = await page.locator('#advisor-reply').innerText();
    assert.notEqual(priceAnswer, challenge, 'Selecting an answer must advance the conversation.');
    assert.match(priceAnswer, /配给|供给|货架/);
    await page.locator('.dialogue-choices [data-topic="answer-access"]').click();
    const accessAnswer = await page.locator('#advisor-reply').innerText();
    assert.notEqual(accessAnswer, priceAnswer);
    assert.match(accessAnswer, /想买多少.*实际买到多少/s);
    assert.equal(await page.locator('.speech-bubble.player').count(), 3, 'The player can see their three replies.');
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), initialStorage, 'A conversation cannot create or mutate a campaign or settings.');
    await mkdir('.qa', { recursive: true });
    await page.screenshot({ path: '.qa/advisor-desktop.png' });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#game-dialog').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'advisor-open');

    await baseline(page);
    await advance(page);
    await customize(page, 'cap', 5);
    const firstDraft = await savedState(page);
    await page.locator('#advisor-open').click();
    await page.locator('.dialogue-choices [data-topic="policy"]').click();
    assert.match(await page.locator('#advisor-reply').innerText(), /售价上限设为 5/);
    assert.deepEqual(await savedState(page), firstDraft);
    await page.getByRole('button', { name: '关闭顾问对话', exact: true }).click();
    await customize(page, 'cap', 6);
    const revisedDraft = await savedState(page);
    await page.locator('#advisor-open').click();
    assert.equal(await page.locator('.speech-bubble').count(), 1, 'Changing the draft resets stale adviser dialogue.');
    await page.locator('.dialogue-choices [data-topic="policy"]').click();
    const revisedReply = await page.locator('#advisor-reply').innerText();
    assert.match(revisedReply, /售价上限设为 6/);
    assert.doesNotMatch(await page.locator('.conversation-log').innerText(), /售价上限设为 5/);
    assert.deepEqual(await savedState(page), revisedDraft, 'Policy discussion must preserve the revised draft and prediction.');
    await page.getByRole('button', { name: '关闭顾问对话', exact: true }).click();

    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await assertDockReachable(page, 'guide-prediction');
    await page.locator('#advisor-open').click();
    await assertNoHorizontalOverflow(page, 'mobile adviser');
    const dialogSize = await page.locator('#game-dialog').evaluate(element => ({
      width: element.getBoundingClientRect().width,
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
    assert.ok(dialogSize.width <= 375 && dialogSize.scroll <= dialogSize.client + 1, 'The dialogue content must fit the phone width.');
    await page.locator('.dialogue-choices [data-topic="challenge"]').click();
    await page.locator('.dialogue-choices [data-topic="answer-access"]').click();
    assert.match(await page.locator('#advisor-reply').innerText(), /想买多少.*实际买到多少/s);
    await page.screenshot({ path: '.qa/advisor-mobile.png' });
    await page.getByRole('button', { name: '关闭顾问对话', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'advisor-open');
    await assertDockReachable(page, 'guide-prediction');
    assert.deepEqual(await savedState(page), revisedDraft, 'Closing the mobile dialogue returns to the same campaign.');
  });

  await isolated('建筑对话、真实流转动画、无损重播与减少动态效果', async page => {
    await baseline(page);
    assert.equal(await page.locator('.scene-reserve-cargo').count(), 0, 'A season without a reserve release must not show reserve cargo.');
    await advance(page);
    await customize(page, 'release', 20);
    await selectView(page, 'town');
    assert.equal(await page.locator('.scene-reserve-cargo').count(), 0, 'A draft is not an executed reserve release.');
    const draft = await savedState(page);
    for (const [place, expected] of [
      ['granary', /粮仓.*60.*20/s],
      ['farm', /原料.*70|70.*原料/s],
      ['market', /价格|售价|供求|供给/],
    ]) {
      await page.locator(`.economy-scene [data-action="scene-place"][data-place="${place}"]`).click();
      await page.locator('#game-dialog[open]').waitFor();
      assert.match(await page.locator('#advisor-reply').innerText(), expected, `${place} must open a relevant reply based on this season.`);
      if (place === 'farm') await page.keyboard.press('Escape');
      else await page.getByRole('button', { name: '关闭顾问对话', exact: true }).click();
      assert.equal(await page.evaluate(() => document.activeElement?.id), `scene-${place}`, 'Closing the adviser returns to the building that opened the conversation.');
      assert.deepEqual(await savedState(page), draft, 'Visiting buildings must not execute or change policy.');
    }
    await selectView(page, 'command');
    await settlePolicy(page);
    const settled = await savedState(page);
    near(settled.records[1].result.policy.release, 20, 'Reserve release in the executed policy');
    near(settled.records[1].result.after.reserves, 40, 'Remaining reserves');
    assert.equal(await page.locator('.scene-reserve-cargo').count(), 1);
    assert.match(await page.locator('.scene-reserve-label').innerText(), /20/);
    await page.locator('#scene-replay-button').click();
    assert.equal(await page.locator('.economy-scene').evaluate(element => element.classList.contains('is-playing')), true);
    assert.ok(await page.locator('.economy-scene').evaluate(element => element.getAnimations({ subtree: true }).some(animation => animation.playState === 'running')), 'Replay must run actual CSS animation, not merely set a class.');
    assert.deepEqual(await savedState(page), settled, 'Replaying the flow must not settle another turn or spend resources.');
    await page.screenshot({ path: '.qa/animated-flow.png' });

    await openMenuAction(page, 'motion-button');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.app-shell').getAttribute('data-motion'), 'off');
    assert.equal(await page.locator('.economy-scene').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0, 'Turning motion off must stop every scene animation.');
    assert.equal(await page.locator('#scene-replay-button').isDisabled(), true);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.app-shell').getAttribute('data-motion'), 'off', 'The animation preference must survive reload.');
    assert.deepEqual(await savedState(page), settled);
    await openMenuAction(page, 'motion-button');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.app-shell').getAttribute('data-motion'), 'on');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('.app-shell[data-motion="off"]').waitFor();
    await page.locator('#menu-button').click();
    assert.equal(await page.locator('#motion-button').isDisabled(), true, 'The app must respect the system reduced-motion preference.');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#scene-replay-button').isDisabled(), true);
    assert.equal(await page.locator('.economy-scene').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0);
    assert.deepEqual(await savedState(page), settled, 'Animation settings must not alter the campaign.');
  });

  console.log(`Browser smoke: ${completed} isolated scenarios passed.`);
} finally {
  await browser.close();
}
