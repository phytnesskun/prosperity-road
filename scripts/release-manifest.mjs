import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const exec = promisify(execFile);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function readSource(root) {
  const git = async args => (await exec('git', args, { cwd: root, maxBuffer: 8 * 1024 * 1024 })).stdout;
  const commit = (await git(['rev-parse', 'HEAD'])).trim();
  const dirty = (await git(['status', '--porcelain', '--untracked-files=all'])).length > 0;
  const paths = [...new Set((await git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])).split('\0').filter(Boolean))].sort();
  const hash = createHash('sha256');
  for (const path of paths) {
    hash.update(path).update('\0');
    try { hash.update(await readFile(join(root, path))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; hash.update('<deleted>'); }
    hash.update('\0');
  }
  return { commit, dirty, sourceDigest: hash.digest('hex') };
}

async function inventory(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (path === 'release.json') continue;
    if (entry.isDirectory()) files.push(...await inventory(directory, path));
    else {
      assert.ok(entry.isFile(), `Unsupported release entry: ${path}`);
      const bytes = await readFile(join(directory, path));
      files.push({ path, size: bytes.length, sha256: digest(bytes) });
    }
  }
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

export async function writeManifest(root, dist) {
  const files = await inventory(dist);
  assert.ok(files.some(file => file.path === 'index.html'), 'Build is missing index.html');
  const manifest = { schemaVersion: 1, ...await readSource(root), builtAt: new Date().toISOString(), node: process.version, files };
  await writeFile(join(dist, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

export async function assertManifest(dist, manifest) {
  assert.deepEqual(JSON.parse(await readFile(join(dist, 'release.json'), 'utf8')), manifest, 'Release metadata changed during verification');
  assert.deepEqual(await inventory(dist), manifest.files, 'Build files changed during verification; rebuild and rerun');
}
