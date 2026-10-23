import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const riverURL = new URL(baseURL);
riverURL.searchParams.set('scenario', 'river');
const saveKey = 'prosperity-road.smokestacks-river.v1';
const breadKey = 'prosperity-road.bread-crisis.v1';
const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(macChrome) ? macChrome : undefined),
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
});
let completed = 0;

const taxPath = ['none', 'tax20', 'tax40', 'tax20'];
const taxRows = [
  [40, 60, 800, 100, 800],
  [30, 70, 600, 680, 880],
  [20, 80, 800, 1460, 380],
  [40, 80, 800, 2240, 1580],
];

async function rawSave(page, key = saveKey) {
  return page.evaluate(storageKey => localStorage.getItem(storageKey), key);
}

async function savedState(page) {
  return JSON.parse(await rawSave(page));
}

function displayedNumber(text) {
  return Number(text.replaceAll(',', '').match(/-?\d+(?:\.\d+)?/)?.[0]);
}

async function noQuestions(page) {
  assert.equal(await page.locator('textarea, input[required], #prediction-next, #prediction-section, [data-action="predict"], [data-action="reason"]').count(), 0,
    'Playing the four seasons must not require predictions, quizzes or written answers.');
}

async function assertGoals(page, supply, damage, cash) {
  for (const [id, expected] of [['river-supply', supply], ['river-damage', damage], ['river-cash', cash]]) {
    assert.equal(displayedNumber(await page.locator(`#${id}`).innerText()), expected, id);
  }
}

async function selectPolicy(page, id) {
  const family = id.startsWith('tax') ? 'tax' : id.startsWith('cap') ? 'cap' : 'none';
  await page.locator(`#river-family-${family}`).click();
  if (id !== 'none') await page.locator(`#river-policy-${id}`).click();
  assert.equal((await savedState(page)).policy, id);
  assert.equal(await page.locator(`#river-family-${family}`).getAttribute('aria-pressed'), 'true');
  if (id !== 'none') assert.equal(await page.locator(`#river-policy-${id}`).getAttribute('aria-pressed'), 'true');
}

async function execute(page, season, id = 'none', expected) {
  if (season > 1) await selectPolicy(page, id);
  await noQuestions(page);
  assert.equal(await page.locator('#river-execute').isEnabled(), true, 'An affordable policy executes directly.');
  await page.locator('#river-execute').click();
  await page.locator('#river-outcome-title').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'river-outcome-title');
  const state = await savedState(page);
  assert.equal(state.phase, 'result');
  assert.equal(state.season, season);
  assert.equal(state.records.length, season, 'Executing a season adds exactly one official record.');
  const record = state.records.at(-1);
  assert.equal(record.policy, id);
  if (expected) {
    const keys = ['quantity', 'price', 'damage', 'cashAfter', 'welfare'];
    keys.forEach((key, index) => assert.equal(record[key], expected[index], `Season ${season} ${id}: ${key}`));
    const results = await page.locator('.river-results > div > strong').allInnerTexts();
    assert.deepEqual(results.map(displayedNumber), expected.slice(0, 3), 'Immediate feedback must match the recorded outcome.');
  }
  await noQuestions(page);
  return state;
}

async function next(page) {
  await page.locator('#river-next').click();
  const state = await savedState(page);
  const title = state.phase === 'complete' ? 'river-ending-title' : 'river-season-title';
  await page.locator(`#${title}`).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.id), title);
  if (state.phase !== 'complete') {
    assert.equal(state.phase, 'decision');
    assert.equal(state.policy, 'none', 'Every new season starts without the previous policy.');
    assert.equal(await page.locator('#river-family-none').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.river-results').count(), 0, 'The decision view must not present last season as a new settled outcome.');
  }
}

async function assertFits(page, label) {
  const width = page.viewportSize().width;
  const content = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  assert.ok(content <= width + 1, `${label} overflows at ${width}px: ${content}px`);
}

async function assertReachable(page, selector) {
  const control = page.locator(selector);
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && box.width >= 44 && box.height >= 44, `${selector} needs a 44px touch target.`);
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
    `${selector} must fit the viewport: ${JSON.stringify(box)}`);
  assert.equal(await control.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return element === hit || element.contains(hit);
  }), true, `${selector} must not be covered by the dock or another element.`);
}

async function isolated(name, check, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: width < 800 ? 812 : 1000 } });
  // This suite checks the scenario; unrelated network media has its own audio smoke.
  await context.addInitScript(() => localStorage.setItem('prosperity-road.music.v1', 'off'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  try {
    await page.goto(riverURL.href, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '烟囱与河流', exact: true }).waitFor();
    await check(page);
    assert.deepEqual(errors, [], 'The campaign must not raise uncaught JavaScript errors.');
    completed += 1;
    console.log(`PASS ${name}`);
  } finally {
    await context.close();
  }
}

try {
  await mkdir('.qa', { recursive: true });

  await isolated('四季直接执行、污染税成功路径、即时反馈与任期结局', async page => {
    await assertGoals(page, 0, 0, 100);
    assert.equal(await page.locator('[data-family], [data-policy]').count(), 0, 'Season one is the fixed market baseline.');
    await page.screenshot({ path: '.qa/river-desktop-opening.png', fullPage: true });
    for (let i = 0; i < taxPath.length; i += 1) {
      await execute(page, i + 1, taxPath[i], taxRows[i]);
      await assertGoals(page, taxRows.slice(0, i + 1).reduce((sum, row) => sum + row[0], 0),
        taxRows.slice(0, i + 1).reduce((sum, row) => sum + row[2], 0), taxRows[i][3]);
      if (i === 0) assert.equal(await page.locator('#river-try').count(), 0, 'The fixed first season has no alternative trial policy.');
      if (i === 2) {
        assert.match(await page.locator('#river-dialogue-text').innerText(), /翻倍.*减少了 800/s);
        const official = await rawSave(page);
        await page.locator('[data-river-place="river"]').click();
        assert.match(await page.locator('#river-dialogue-text').innerText(), /本季排放 20.*损害估值 800.*少了 800.*没有自动收到赔偿/s);
        await page.locator('[data-river-place="factory"]').click();
        assert.match(await page.locator('#river-dialogue-text').innerText(), /20 单位.*到手 40.*行业剩余 200/s);
        await page.locator('[data-river-place="harbor"]').click();
        assert.match(await page.locator('#river-dialogue-text').innerText(), /成交价是 80.*20 单位.*贵了 20/s);
        await page.locator('#river-advisor').click();
        assert.equal(await rawSave(page), official, 'Talking to residents must not change the campaign.');
        await page.screenshot({ path: '.qa/river-desktop-season3.png', fullPage: true });
      }
      await next(page);
    }
    const state = await savedState(page);
    assert.equal(state.phase, 'complete');
    assert.equal(state.records.length, 4);
    assert.equal(state.records.reduce((sum, row) => sum + row.welfare, 0), 3640);
    await assertGoals(page, 130, 3000, 2240);
    assert.equal(await page.locator('#river-ending-title').innerText(), '纸厂与河流，一起留下');
    await noQuestions(page);
    const complete = await rawSave(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#river-ending-title').waitFor();
    assert.equal(await rawSave(page), complete, 'The completed four-season term restores without a questionnaire.');
    await page.locator('.river-ledger > summary').click();
    assert.equal(await page.locator('.river-ledger tbody tr').count(), 4);
    assert.match(await page.locator('.river-ledger').innerText(), /外部损害估值，不是国库支出/);
    await page.screenshot({ path: '.qa/river-desktop-ending.png', fullPage: true });
  });

  await isolated('排放上限替代路径保留供货与河流，国库结余10', async page => {
    const path = ['none', 'cap30', 'cap20', 'cap40'];
    const rows = [[40, 60, 800, 100, 800], [30, 70, 600, 70, 870], [20, 80, 800, 40, 370], [40, 80, 800, 10, 1570]];
    for (let i = 0; i < path.length; i += 1) {
      const state = await execute(page, i + 1, path[i], rows[i]);
      assert.equal(state.records.at(-1).taxRevenue, 0);
      await next(page);
    }
    await assertGoals(page, 130, 3000, 10);
    assert.equal((await savedState(page)).records.reduce((sum, row) => sum + row.welfare, 0), 3610);
    assert.equal(await page.locator('#river-ending-title').innerText(), '纸厂与河流，一起留下');
  });

  await isolated('四季无干预供货170、损害4200，显示河流目标未达成', async page => {
    const rows = [[40, 60, 800, 100, 800], [40, 60, 800, 100, 800], [40, 60, 1600, 100, 0], [50, 70, 1000, 100, 1500]];
    for (let i = 0; i < rows.length; i += 1) {
      await execute(page, i + 1, 'none', rows[i]);
      await next(page);
    }
    await assertGoals(page, 170, 4200, 100);
    assert.equal(await page.locator('#river-ending-title').innerText(), '繁忙的港口，沉重的河流');
    assert.match(await page.locator('.river-ending-goals').innerText(), /○ 损害 4,200/);
    assert.equal(await page.locator('.river-goals .over-budget').count(), 1);
  });

  await isolated('同季免费试算使用原有期初国库，不改记录或下一季资源', async page => {
    await execute(page, 1);
    await next(page);
    await execute(page, 2, 'tax20', taxRows[1]);
    const original = await rawSave(page);
    await page.locator('#river-try').click();
    assert.equal(await page.locator('#river-try').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#river-trial-policy').inputValue(), 'tax20');
    for (const [id, values] of [['cap30', [30, 600, 70, 70]], ['none', [40, 800, 60, 100]], ['tax40', [20, 400, 80, 880]]]) {
      await page.locator('#river-trial-policy').selectOption(id);
      assert.deepEqual((await page.locator('#river-sandbox p b').allInnerTexts()).map(displayedNumber), values,
        `${id} must be calculated against season two's original opening cash of 100.`);
      assert.equal(await rawSave(page), original, 'A trial must not write any official state.');
      await assertGoals(page, 70, 1400, 680);
    }
    await page.locator('#river-try').click();
    assert.equal(await page.locator('#river-sandbox').count(), 0);
    assert.equal(await rawSave(page), original);
    await next(page);
    assert.equal((await savedState(page)).records.length, 2);
    await assertGoals(page, 70, 1400, 680);
    assert.equal(await page.locator('#river-sandbox').count(), 0);
    await execute(page, 3, 'tax40', taxRows[2]);
    assert.equal((await savedState(page)).records[2].cashBefore, 680);
  });

  await isolated('面包与河流存档隔离、政策与结果刷新延续、重新开始确认', async page => {
    await page.locator('#river-bread-link').click();
    await page.getByRole('heading', { name: '繁荣之路', exact: true }).waitFor();
    await page.getByRole('button', { name: '查看正常市场', exact: true }).click();
    await page.locator('#outcome-title').waitFor();
    await page.locator('[data-action="next"]').click();
    const bread = await rawSave(page, breadKey);
    assert.equal(JSON.parse(bread).records.length, 1);
    await page.locator('#menu-button').click();
    await page.locator('#river-scenario-link').click();
    await page.locator('#river-execute').waitFor();
    assert.equal(await rawSave(page), null, 'Entering the second scenario must not reinterpret the bread save.');
    await execute(page, 1);
    await next(page);
    await selectPolicy(page, 'cap20');
    const decision = await rawSave(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#river-policy-cap20').waitFor();
    assert.equal(await page.locator('#river-policy-cap20').getAttribute('aria-pressed'), 'true');
    assert.equal(await rawSave(page), decision, 'The unexecuted policy restores after a refresh.');
    await execute(page, 2, 'cap20', [20, 80, 400, 70, 770]);
    const result = await rawSave(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#river-outcome-title').waitFor();
    assert.equal(await rawSave(page), result, 'Refreshing a result must neither lose nor duplicate it.');
    assert.equal(await rawSave(page, breadKey), bread);
    await page.locator('#river-reset').click();
    await page.locator('#river-reset-dialog[open]').waitFor();
    await page.locator('[data-action="cancel-reset"]').click();
    assert.equal(await rawSave(page), result, 'Cancelling reset preserves the river save.');
    await page.locator('#river-reset').click();
    await page.locator('#river-confirm-reset').click();
    assert.deepEqual(await savedState(page), { version: 1, season: 1, phase: 'decision', policy: 'none', records: [] });
    assert.equal(await rawSave(page, breadKey), bread, 'Resetting river must leave bread untouched.');
    await page.locator('#river-bread-link').click();
    await page.locator('#season-title').waitFor();
    assert.equal(await rawSave(page, breadKey), bread);
    assert.equal(await page.locator('#settle-button').isEnabled(), true, 'The earlier bread campaign remains playable.');
  });

  for (const width of [375, 320]) {
    await isolated(`${width}px四季按钮可达、即时反馈、试算与重玩，无横向溢出`, async page => {
      await assertFits(page, 'Opening');
      await assertReachable(page, '#river-execute');
      await page.screenshot({ path: `.qa/river-${width}-opening.png`, fullPage: true });
      for (let i = 0; i < taxPath.length; i += 1) {
        if (i > 0) {
          await assertReachable(page, '#river-family-tax');
          await selectPolicy(page, taxPath[i]);
          await assertReachable(page, `#river-policy-${taxPath[i]}`);
          await assertFits(page, 'Policy selection');
        }
        await assertReachable(page, '#river-execute');
        await execute(page, i + 1, taxPath[i], taxRows[i]);
        await assertFits(page, 'Result');
        const title = await page.locator('#river-outcome-title').boundingBox();
        assert.ok(title && title.y >= 0 && title.y + title.height <= 812,
          'Executing a mobile decision must bring its immediate feedback into view.');
        await assertReachable(page, '#river-next');
        if (i === 2) {
          await assertReachable(page, '#river-try');
          await page.locator('#river-try').click();
          await assertReachable(page, '#river-trial-policy');
          await page.locator('#river-trial-policy').selectOption('none');
          await assertFits(page, 'Expanded trial');
          await page.locator('#river-try').click();
          await page.screenshot({ path: `.qa/river-${width}-season3.png`, fullPage: true });
        }
        await next(page);
        await assertFits(page, 'Next season or ending');
      }
      await assertGoals(page, 130, 3000, 2240);
      await assertReachable(page, '#river-restart');
      await page.screenshot({ path: `.qa/river-${width}-ending.png`, fullPage: true });
      const complete = await rawSave(page);
      await page.locator('#river-restart').click();
      await assertFits(page, 'Reset dialog');
      await assertReachable(page, '#river-confirm-reset');
      await page.locator('[data-action="cancel-reset"]').click();
      assert.equal(await rawSave(page), complete);
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'river-restart');
      await page.locator('#river-restart').click();
      await page.locator('#river-confirm-reset').click();
      await assertGoals(page, 0, 0, 100);
      await assertReachable(page, '#river-execute');
      assert.equal((await savedState(page)).records.length, 0);
    }, width);
  }

  console.log(`\n${completed} river browser scenarios passed.`);
} finally {
  await browser.close();
}
