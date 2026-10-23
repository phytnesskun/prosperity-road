import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const report = { schemaVersion: 1, status: 'running', startedAt: new Date().toISOString(), checks: [] };
let browser;
await mkdir('.qa', { recursive: true });
await writeFile('.qa/live-verification.json', JSON.stringify(report, null, 2) + '\n');
try {
  const { values } = parseArgs({ options: { url: { type: 'string' }, commit: { type: 'string' } } });
  assert.ok(values.url && /^[a-f0-9]{40}$/i.test(values.commit ?? ''), 'Usage: npm run verify:live -- --url https://your-site/ --commit <full 40-character SHA>');
  const base = new URL(values.url);
  assert.ok(!base.username && !base.password && !base.search && !base.hash, 'Use a site URL without credentials, query or fragment');
  assert.ok(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)), 'Use HTTPS, or HTTP on localhost for rehearsal');
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  report.url = base.href;
  report.commit = values.commit.toLowerCase();
  const fetchBytes = async path => {
    const url = new URL(path.split('/').map(encodeURIComponent).join('/'), base);
    url.searchParams.set('verify', String(Date.now()));
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    assert.ok(response.ok, `${path}: HTTP ${response.status}`);
    assert.equal(new URL(response.url).origin, base.origin, `${path}: redirected to another origin`);
    return Buffer.from(await response.arrayBuffer());
  };
  const manifest = JSON.parse((await fetchBytes('release.json')).toString('utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.commit, report.commit, 'Live site is not the requested source version');
  assert.equal(manifest.dirty, false, 'Live build came from uncommitted changes');
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
  assert.ok(manifest.files.some(file => file.path === 'index.html'));
  const seen = new Set();
  for (const file of manifest.files) {
    assert.ok(typeof file.path === 'string' && !file.path.startsWith('/') && !file.path.includes('\\') && file.path.split('/').every(part => part && part !== '.' && part !== '..'), 'Invalid asset path');
    assert.ok(!seen.has(file.path), 'Duplicate asset path');
    seen.add(file.path);
    const bytes = await fetchBytes(file.path);
    assert.equal(bytes.length, file.size, `${file.path}: size differs from release artifact`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `${file.path}: hash differs from release artifact`);
  }
  report.checks.push(`Version and ${manifest.files.length} asset hashes match`);
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined,
    ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === base.origin && !url.pathname.startsWith('/cdn-cgi/') && response.status() >= 400) errors.push(`${response.status()} ${url.pathname}`);
  });
  const saveKey = 'prosperity-road.bread-crisis.v1';
  const navigation = await page.goto(base.href, { waitUntil: 'networkidle', timeout: 30_000 });
  assert.ok(navigation?.ok(), 'The actual site entry must return a successful document');
  assert.equal(new URL(page.url()).origin, base.origin, 'The browser was redirected to another origin');
  const entry = manifest.files.find(file => file.path === 'index.html');
  assert.equal(createHash('sha256').update(await navigation.body()).digest('hex'), entry.sha256,
    'The actual site entry serves different HTML (possibly a stale CDN cache)');
  await page.getByRole('heading', { name: '繁荣之路', exact: true }).waitFor();
  await page.getByRole('button', { name: '查看正常市场', exact: true }).click();
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
  assert.equal((await saved()).records.length, 1);
  assert.equal((await saved()).records[0].result.price, 5);
  await page.locator('[data-action="next"]').click();
  await page.locator('#settle-button').click();
  const beforeReload = await saved();
  assert.equal(beforeReload.records.length, 2);
  await page.reload({ waitUntil: 'networkidle' });
  assert.deepEqual(await saved(), beforeReload, 'Game progress must survive reload');
  assert.deepEqual(errors, [], 'Live page raised errors');
  await page.screenshot({ path: '.qa/live-smoke.png' });
  report.checks.push('Two seasons and reload persistence passed in an isolated browser');
  report.status = 'passed';
  console.log(`PASS live verification: ${base.href} @ ${manifest.commit}`);
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  console.error(`FAIL live verification: ${error.message}`);
  process.exitCode = 1;
} finally {
  try { await browser?.close(); }
  catch (error) { report.status = 'failed'; report.error = error.message; process.exitCode = 1; }
  report.finishedAt = new Date().toISOString();
  await writeFile('.qa/live-verification.json', JSON.stringify(report, null, 2) + '\n');
}
