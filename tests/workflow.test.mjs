import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runNode } from '../scripts/verify.mjs';

const qa = fileURLToPath(new URL('../.qa/', import.meta.url));
async function temporaryDirectory() {
  await mkdir(qa, { recursive: true });
  return mkdtemp(path.join(qa, 'workflow test-'));
}
async function removeTemporaryDirectory(directory) {
  const target = path.resolve(directory);
  assert.ok(target.startsWith(`${path.resolve(qa)}${path.sep}`), 'Test cleanup must stay inside .qa.');
  await rm(target, { recursive: true, force: true });
}

test('workflow commands preserve literal arguments and paths containing spaces', async () => {
  const directory = await temporaryDirectory();
  try {
    await runNode(['-e', `
      const assert = require('node:assert/strict');
      assert.equal(process.argv[1], 'two words; $(must-stay-literal)');
      assert.equal(process.cwd(), process.env.EXPECTED_WORKFLOW_CWD);
    `, 'two words; $(must-stay-literal)'], {
      cwd: directory,
      env: { ...process.env, EXPECTED_WORKFLOW_CWD: directory },
      stdio: 'ignore',
    });
  } finally {
    await removeTemporaryDirectory(directory);
  }
});

test('workflow commands reject a nonzero exit status', async () => {
  await assert.rejects(runNode(['-e', 'process.exit(7)'], { stdio: 'ignore' }), /exit 7/);
});

test('a timed-out workflow command also terminates its child processes', async () => {
  const directory = await temporaryDirectory();
  let pids = [];
  try {
    await assert.rejects(runNode(['-e', `
      const { spawn } = require('node:child_process');
      const { writeFileSync } = require('node:fs');
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        stdio: 'ignore', windowsHide: true,
      });
      writeFileSync('pids.json', JSON.stringify([process.pid, child.pid]));
      setInterval(() => {}, 1000);
    `], { cwd: directory, timeoutMs: 1_500, stdio: 'ignore' }), /timed out/);
    pids = JSON.parse(await readFile(path.join(directory, 'pids.json'), 'utf8'));
    for (const pid of pids) {
      let alive = true;
      for (let attempt = 0; attempt < 100 && alive; attempt++) {
        try { process.kill(pid, 0); await delay(20); }
        catch (error) { if (error.code !== 'ESRCH') throw error; alive = false; }
      }
      assert.equal(alive, false, `Workflow process ${pid} must not survive a timeout.`);
    }
  } finally {
    for (const pid of pids) {
      try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    await removeTemporaryDirectory(directory);
  }
});

test('workflow commands honor cancellation', async () => {
  const controller = new AbortController();
  const running = runNode(['-e', 'setInterval(() => {}, 1000)'], {
    signal: controller.signal, stdio: 'ignore',
  });
  controller.abort(new Error('Cancelled by workflow test.'));
  await assert.rejects(running, /Cancelled by workflow test/);
});
