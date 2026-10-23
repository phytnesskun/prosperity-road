import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeManifest, assertManifest } from '../scripts/release-manifest.mjs';

test('release verification rejects changed, missing and extra build files', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const scratch = join(root, '.qa');
  await mkdir(scratch, { recursive: true });
  const dist = await mkdtemp(join(scratch, 'test-release-'));
  try {
    await mkdir(join(dist, 'assets'));
    await writeFile(join(dist, 'index.html'), '<h1>sample</h1>');
    await writeFile(join(dist, 'assets', 'app.js'), 'original');
    const manifest = await writeManifest(root, dist);
    await assertManifest(dist, manifest);
    await writeFile(join(dist, 'assets', 'app.js'), 'modified');
    await assert.rejects(assertManifest(dist, manifest), /Build files changed/);
    await rm(join(dist, 'assets', 'app.js'));
    await assert.rejects(assertManifest(dist, manifest), /Build files changed/);
    await writeFile(join(dist, 'assets', 'app.js'), 'original');
    await writeFile(join(dist, 'unexpected.txt'), 'extra');
    await assert.rejects(assertManifest(dist, manifest), /Build files changed/);
    await rm(join(dist, 'unexpected.txt'));
    const text = await readFile(join(dist, 'release.json'), 'utf8');
    await writeFile(join(dist, 'release.json'), text.replace(manifest.commit, '0'.repeat(40)));
    await assert.rejects(assertManifest(dist, manifest), /metadata changed/);
  } finally {
    assert.ok(resolve(dist).startsWith(resolve(scratch) + sep));
    await rm(dist, { recursive: true, force: true });
  }
});
