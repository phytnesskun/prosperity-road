import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const saveKey = 'prosperity-road.bread-crisis.v1';
const people = {
  farm: ['陈禾', 'farmer.png'], mill: ['阿诚', 'worker.png'],
  market: ['阿芸', 'seller.png'], homes: ['周婶', 'resident.png'],
};
const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || (existsSync(macChrome) ? macChrome : undefined),
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
});
let completed = 0;

async function rawSave(page) {
  return page.evaluate(key => localStorage.getItem(key), saveKey);
}

async function savedState(page) {
  return JSON.parse(await rawSave(page));
}

async function customize(page, key, value) {
  const custom = page.locator('#policy-custom');
  if (await custom.getAttribute('open') === null) await custom.locator('summary').click();
  await page.locator(`#draft-${key}-${value}`).click();
}

async function secondSeason(page) {
  await page.getByRole('button', { name: '查看正常市场', exact: true }).click();
  await page.locator('#outcome-title').waitFor();
  await page.locator('.action-dock [data-action="next"]').click();
  assert.equal((await savedState(page)).seasonIndex, 1);
}

async function noQuestions(page) {
  assert.equal(await page.locator('#prediction-next, #prediction-section, [data-action="predict"], [data-action="reason"], textarea[data-report], input[required]').count(), 0,
    'Visiting residents must not introduce a quiz or writing requirement.');
}

async function assertPerson(page, place) {
  await page.locator(`#game-dialog.visit-dialog[open][data-place="${place}"]`).waitFor();
  assert.match(await page.locator('#dialog-title').innerText(), new RegExp(people[place][0]));
  assert.equal(await page.locator('#advisor-reply').count(), 0, 'Each resident speaks directly instead of replacing the adviser text.');
  const line = await page.locator('#visit-line').innerText();
  assert.ok(line.length > 8 && line.length <= 120, 'The first reply should be a short, readable line.');
  assert.equal(await page.locator('#visit-evidence').count(), 0, 'The first view keeps the detailed evidence behind the object.');
  assert.equal(await page.locator('#visit-inspect').getAttribute('aria-expanded'), 'false');
  const portrait = page.locator('.visit-portrait img');
  assert.ok((await portrait.getAttribute('src')).endsWith(people[place][1]));
  await portrait.evaluate(image => image.decode());
  assert.ok(await portrait.evaluate(image => image.naturalWidth > 0 && image.naturalHeight > 0), 'Each character portrait must load.');
  await noQuestions(page);
}

async function openVisit(page, place, trigger = `scene-${place}`) {
  await page.locator(`#${trigger}`).click();
  await assertPerson(page, place);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'visit-line');
}

async function inspect(page, metric, evidence) {
  await page.locator('#visit-inspect').click();
  assert.equal(await page.locator('#visit-inspect').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#visit-evidence .visit-metric strong').innerText(), metric);
  assert.match(await page.locator('#visit-evidence').innerText(), evidence);
}

async function closeVisit(page, trigger, escape = false) {
  if (escape) await page.keyboard.press('Escape');
  else await page.locator('#game-dialog [data-action="close-dialog"]').click();
  assert.equal(await page.locator('#game-dialog').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.id), trigger);
}

async function assertFits(page, label) {
  const sizes = await page.evaluate(() => {
    const dialog = document.querySelector('#game-dialog');
    return {
      width: innerWidth, page: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
      dialog: dialog?.getBoundingClientRect().width ?? 0, scroll: dialog?.scrollWidth ?? 0, client: dialog?.clientWidth ?? 0,
    };
  });
  assert.ok(sizes.page <= sizes.width + 1 && sizes.dialog <= sizes.width && sizes.scroll <= sizes.client + 1,
    `${label} must not overflow: ${JSON.stringify(sizes)}`);
}

async function reachable(page, selector) {
  const button = page.locator(selector);
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box && box.width >= 44 && box.height >= 44, `${selector} needs a 44px touch target.`);
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
    `${selector} must fit the viewport: ${JSON.stringify(box)}`);
  assert.equal(await button.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return element === hit || element.contains(hit);
  }), true, `${selector} must be unobstructed.`);
}

async function isolated(name, check, width = 1280, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport: { width, height: width < 800 ? 812 : 900 }, reducedMotion });
  await context.addInitScript(() => localStorage.setItem('prosperity-road.music.v1', 'off'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  try {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '繁荣之路', exact: true }).waitFor();
    await check(page);
    assert.deepEqual(errors, [], 'Visits must not cause uncaught JavaScript errors.');
    completed += 1;
    console.log(`PASS ${name}`);
  } finally {
    await context.close();
  }
}

try {
  await mkdir('.qa', { recursive: true });

  await isolated('四处独立人物、草案物件有据、不得泄漏上季结果或改变存档', async page => {
    await secondSeason(page);
    await customize(page, 'cap', 5);
    await customize(page, 'subsidy', 1);
    await customize(page, 'release', 20);
    await page.locator('#tab-town').click();
    const draft = await rawSave(page);
    const expectations = {
      farm: ['70 篮', /原料.*70.*额外单位成本 2.*不是实际收成或产量/s],
      mill: ['待结算', /原料上限 70.*成本 2.*补贴 1.*尚未结算/s],
      market: ['5 /篮', /草案售价上限 5.*尚未执行.*等结算/s],
      homes: ['待结算', /基本口粮 36.*尚未结算.*整组居民/s],
    };
    const introductions = new Set();
    for (const [place, [metric, evidence]] of Object.entries(expectations)) {
      await openVisit(page, place);
      introductions.add(await page.locator('#visit-line').innerText());
      await inspect(page, metric, evidence);
      assert.equal(await rawSave(page), draft);
      await page.locator('#visit-inspect').click();
      assert.equal(await page.locator('#visit-evidence').count(), 0);
      assert.equal(await page.locator('#visit-inspect').getAttribute('aria-expanded'), 'false');
      await closeVisit(page, `scene-${place}`, place === 'farm' || place === 'homes');
      assert.equal(await rawSave(page), draft);
    }
    assert.equal(introductions.size, 4, 'The four roles need distinct opening lines.');
    await page.locator('#scene-granary').click();
    assert.match(await page.locator('#dialog-title').innerText(), /林岚/);
    assert.match(await page.locator('#advisor-reply').innerText(), /粮仓.*60.*20/s);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'scene-granary');
    assert.equal(await rawSave(page), draft, 'The existing granary adviser also remains read-only.');
  });

  await isolated('地点串联保留首次入口焦点、地图直访与林岚入口', async page => {
    await secondSeason(page);
    await page.locator('#tab-town').click();
    const original = await rawSave(page);
    await openVisit(page, 'farm');
    for (const place of ['mill', 'market', 'homes', 'farm']) {
      await page.locator('#visit-inspect').click();
      await page.locator('#visit-next').click();
      await assertPerson(page, place);
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'visit-line');
      assert.equal(await rawSave(page), original);
    }
    await closeVisit(page, 'scene-farm', true);
    await openVisit(page, 'homes', 'map-homes');
    await inspect(page, '待结算', /基本口粮 36.*尚未结算/s);
    await closeVisit(page, 'map-homes');
    await openVisit(page, 'farm');
    await page.locator('#visit-advisor').click();
    assert.match(await page.locator('#dialog-title').innerText(), /林岚/);
    assert.match(await page.locator('#advisor-reply').innerText(), /原料.*70.*单位成本.*2/s,
      'Asking the adviser from a visit must discuss that place, not restart the general briefing.');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'scene-farm');
    await page.locator('#advisor-open').click();
    assert.match(await page.locator('#dialog-title').innerText(), /林岚/);
    assert.equal(await page.locator('#advisor-reply').count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'advisor-open');
    assert.equal(await rawSave(page), original);
  });

  await isolated('结算两条人物回应可走访，物件显示真实生产/成交/购粮记录', async page => {
    await secondSeason(page);
    await customize(page, 'cap', 5);
    await noQuestions(page);
    await page.locator('#settle-button').click();
    await page.locator('#outcome-title').waitFor();
    const original = await rawSave(page);
    const result = (await savedState(page)).records[1].result;
    assert.equal(result.price, 5);
    assert.equal(result.privateOutput, 60);
    assert.equal(result.purchasesLow, 24);
    assert.equal(result.excessDemand, 40);
    assert.equal(await page.locator('[id^="reaction-"][data-action="scene-place"]').count(), 2);
    for (const [place, metric, evidence] of [
      ['market', '5 /篮', /成交价 5.*总供给 60.*工坊 60.*粮仓 0.*超额需求 40/s],
      ['homes', '24 / 36 篮口粮', /实际购粮 24.*基本口粮 36.*保障率 66\.7%.*整组数据/s],
    ]) {
      const reaction = await page.locator(`#reaction-${place}`).innerText();
      await openVisit(page, place, `reaction-${place}`);
      assert.ok(reaction.includes(await page.locator('#visit-line').innerText()), 'The reaction should open the person who spoke it.');
      await inspect(page, metric, evidence);
      await closeVisit(page, `reaction-${place}`, place === 'homes');
      assert.equal(await rawSave(page), original);
    }
    await openVisit(page, 'mill');
    await inspect(page, '60 / 70 篮上限', /实际私人产量 60.*上限 70.*补贴 0.*尚未达到/s);
    await page.waitForFunction(() => document.querySelector('#game-dialog').getAnimations({ subtree: true }).every(animation => animation.playState !== 'running'));
    await page.screenshot({ path: '.qa/townspeople-desktop.png' });
    await closeVisit(page, 'scene-mill');
    await page.locator('.action-dock [data-action="next"]').click();
    await page.locator('#settle-button').click();
    await page.locator('#outcome-title').waitFor();
    assert.equal((await savedState(page)).records[2].result.excessDemand, 0);
    assert.equal(await page.locator('#reaction-market').count(), 0);
    assert.equal(await page.locator('#reaction-mill').count(), 1, 'A balanced market uses the worker response.');
    assert.equal(await page.locator('#reaction-homes').count(), 1);
  });

  for (const width of [375, 320]) {
    await isolated(`${width}px人物与物件可点、连访返回无溢出${width === 320 ? '、系统低动态' : ''}`, async page => {
      await secondSeason(page);
      await page.locator('#tab-town').click();
      const original = await rawSave(page);
      for (const place of Object.keys(people)) {
        await reachable(page, `#scene-${place}`);
        await openVisit(page, place);
        await assertFits(page, `${place} opening`);
        await reachable(page, '#visit-inspect');
        await page.locator('#visit-inspect').click();
        await page.locator('#visit-evidence').waitFor();
        await assertFits(page, `${place} evidence`);
        await reachable(page, '#visit-next');
        if (place === 'homes') {
          await page.waitForFunction(() => document.querySelector('#game-dialog').getAnimations({ subtree: true }).every(animation => animation.playState !== 'running'));
          await page.screenshot({ path: `.qa/townspeople-${width}.png` });
        }
        if (width === 320) {
          assert.equal(await page.locator('.app-shell').getAttribute('data-motion'), 'off');
          assert.equal(await page.locator('#game-dialog').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0,
            'Reduced motion must also stop portrait and object animations.');
        }
        await closeVisit(page, `scene-${place}`, place === 'market');
        assert.equal(await rawSave(page), original);
      }
      if (width === 375) {
        await page.locator('#menu-button').click();
        await page.locator('#motion-button').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.app-shell').getAttribute('data-motion'), 'off');
      }
      await reachable(page, '#map-farm');
      await openVisit(page, 'farm', 'map-farm');
      assert.equal(await page.locator('#game-dialog').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length), 0,
        'Both manual and system reduced motion must disable visit animations.');
      await page.locator('#visit-next').click();
      await assertPerson(page, 'mill');
      await closeVisit(page, 'map-farm', true);
      await page.locator('#tab-command').click();
      await page.locator('#settle-button').click();
      await page.locator('#outcome-title').waitFor();
      await reachable(page, '#reaction-homes');
      await openVisit(page, 'homes', 'reaction-homes');
      await page.locator('#visit-inspect').click();
      await assertFits(page, 'Settlement reaction');
      await closeVisit(page, 'reaction-homes');
      await noQuestions(page);
    }, width, width === 320 ? 'reduce' : 'no-preference');
  }

  console.log(`\n${completed} townspeople browser scenarios passed.`);
} finally {
  await browser.close();
}
