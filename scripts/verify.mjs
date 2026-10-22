import { spawn } from 'node:child_process';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const processTimeoutMs = 10 * 60 * 1000;

// Invoke Node directly: npm.cmd and shell wildcard expansion are not portable.
export function runNode(args, {
  cwd = projectRoot,
  env = process.env,
  signal,
  timeoutMs = processTimeoutMs,
  stdio = 'inherit',
} = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd, env, stdio, windowsHide: true,
      detached: process.platform !== 'win32',
    });
    let failure;
    let escalation;
    let stopTask;

    const stop = reason => {
      if (failure) return;
      failure = reason;
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
      if (process.platform === 'win32') {
        // Kill only this runner's child tree, including a browser it launched.
        stopTask = new Promise(done => {
          const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            stdio: 'ignore', windowsHide: true,
          });
          killer.once('error', () => { child.kill(); done(); });
          killer.once('close', code => { if (code) child.kill(); done(); });
        });
      } else {
        try { process.kill(-child.pid, 'SIGTERM'); } catch (error) {
          if (error.code !== 'ESRCH') child.kill();
        }
        escalation = setTimeout(() => {
          try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
            if (error.code !== 'ESRCH') child.kill('SIGKILL');
          }
        }, 2_000);
        escalation.unref();
      }
    };
    const onAbort = () => stop(signal.reason ?? new Error('Verification interrupted.'));
    const timer = setTimeout(() => stop(new Error(`Node command timed out after ${timeoutMs} ms: ${args.join(' ')}`)), timeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();

    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(escalation);
      signal?.removeEventListener('abort', onAbort);
    };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', async (code, childSignal) => {
      cleanup();
      await stopTask;
      if (failure && process.platform !== 'win32' && child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
          if (error.code !== 'ESRCH') { reject(error); return; }
        }
      }
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`Node command failed (${childSignal ?? `exit ${code}`}): ${args.join(' ')}`));
      else resolve();
    });
  });
}

export async function verify({ root = projectRoot, release = false } = {}) {
  const started = Date.now();
  const qa = path.join(root, '.qa');
  const dist = path.join(root, 'dist');
  const reportPath = path.join(qa, 'verification.json');
  const report = {
    schemaVersion: 1,
    mode: release ? 'release' : 'verify',
    status: 'running',
    startedAt: new Date(started).toISOString(),
    source: null,
    sourceAfter: null,
    artifact: { directory: 'dist', manifestFile: 'release.json' },
    steps: [],
  };
  await mkdir(qa, { recursive: true });
  // A failed or interrupted new attempt must never leave an older success report.
  await rm(reportPath, { force: true });
  await rm(path.join(dist, 'release.json'), { force: true });
  const saveReport = async () => {
    const temporary = `${reportPath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`);
    await rename(temporary, reportPath);
  };
  await saveReport();

  const controller = new AbortController();
  let receivedSignal;
  const onSignal = signal => {
    receivedSignal ??= signal;
    controller.abort(new Error(`Verification interrupted by ${signal}.`));
  };
  const onInterrupt = () => onSignal('SIGINT');
  const onTerminate = () => onSignal('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);

  async function step(name, action, { cleanup = false } = {}) {
    if (!cleanup) controller.signal.throwIfAborted();
    const stepStarted = Date.now();
    const item = { name, status: 'running', startedAt: new Date(stepStarted).toISOString() };
    report.steps.push(item);
    await saveReport();
    console.log(`\n[verify] ${name}`);
    try {
      const result = await action();
      if (!cleanup) controller.signal.throwIfAborted();
      item.status = 'passed';
      return result;
    } catch (error) {
      item.status = 'failed';
      item.error = error.message;
      throw error;
    } finally {
      item.finishedAt = new Date().toISOString();
      item.durationMs = Date.now() - stepStarted;
      await saveReport();
    }
  }

  let server;
  let checksPassed = false;
  try {
    const { writeManifest, assertManifest, readSource } = await import('./release-manifest.mjs');
    const { createRequire } = await import('node:module');
    const require = createRequire(path.join(root, 'package.json'));
    const nodeOptions = { cwd: root, signal: controller.signal };
    await step('source', async () => {
      report.source = await readSource(root);
      if (release && report.source.dirty) throw new Error('Release verification requires a clean working tree. Commit your changes first.');
    });
    await step('unit-tests', async () => {
      const files = (await readdir(path.join(root, 'tests')))
        .filter(name => /\.test\.(?:ts|mjs)$/.test(name)).sort()
        .map(name => path.join('tests', name));
      if (!files.length) throw new Error('No unit test files were found.');
      await runNode(['--test', ...files], nodeOptions);
    });
    await step('typecheck', () => runNode([
      path.join(path.dirname(require.resolve('typescript/package.json')), 'bin', 'tsc'), '--noEmit',
    ], nodeOptions));
    await step('build', () => runNode([
      path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js'), 'build',
    ], nodeOptions));
    const manifest = await step('manifest', async () => {
      const result = await writeManifest(root, dist);
      if (result.commit !== report.source.commit || result.sourceDigest !== report.source.sourceDigest) {
        throw new Error('Source files changed during verification. Run verification again.');
      }
      return result;
    });
    await step('preview', async () => {
      const { preview } = await import('vite');
      server = await preview({
        root,
        preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
      });
      const address = server.httpServer.address();
      if (!address || typeof address === 'string') throw new Error('Preview did not open a TCP port.');
      const base = server.config.base;
      report.previewUrl = new URL(base === './' ? '/' : base, `http://127.0.0.1:${address.port}`).href;
      const response = await fetch(report.previewUrl, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      if (!response.ok) throw new Error(`Preview returned HTTP ${response.status}.`);
      await response.arrayBuffer();
      console.log(`[verify] Production preview: ${report.previewUrl}`);
    });
    const browserEnv = { ...process.env, BASE_URL: report.previewUrl };
    delete browserEnv.SKIP_DEMO_VIDEO;
    for (const name of ['browser', 'pilot', 'audio', 'music-library']) {
      await step(`${name}-smoke`, () => runNode([
        path.join('scripts', `${name}-smoke.mjs`),
      ], { ...nodeOptions, env: browserEnv }));
    }
    await step('artifact-integrity', () => assertManifest(dist, manifest));
    await step('source-after', async () => {
      report.sourceAfter = await readSource(root);
      if (report.sourceAfter.commit !== report.source.commit || report.sourceAfter.sourceDigest !== report.source.sourceDigest) {
        throw new Error('Source files changed during verification. Run verification again.');
      }
      if (release && report.sourceAfter.dirty) throw new Error('The working tree changed during release verification. Commit the changes and run it again.');
    });
    checksPassed = true;
  } catch (error) {
    report.status = receivedSignal ? 'interrupted' : 'failed';
    report.error = error.message;
    console.error(`[verify] ${error.message}`);
  } finally {
    if (server) {
      try {
        await step('preview-cleanup', async () => {
          await new Promise((resolve, reject) => {
            server.httpServer.close(error => error ? reject(error) : resolve());
            server.httpServer.closeAllConnections();
          });
        }, { cleanup: true });
      } catch (error) {
        report.status = receivedSignal ? 'interrupted' : 'failed';
        report.error = [report.error, `Preview cleanup failed: ${error.message}`].filter(Boolean).join('\n');
      }
    }
    if (receivedSignal) report.status = 'interrupted';
    else if (checksPassed && report.status === 'running') report.status = 'passed';
    if (report.status !== 'passed') await rm(path.join(dist, 'release.json'), { force: true });
    report.finishedAt = new Date().toISOString();
    report.durationMs = Date.now() - started;
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onTerminate);
    await saveReport();
  }
  console.log(`\n[verify] ${report.status.toUpperCase()} — report: ${reportPath}`);
  return { report, exitCode: receivedSignal === 'SIGINT' ? 130 : receivedSignal === 'SIGTERM' ? 143 : report.status === 'passed' ? 0 : 1 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(argument => argument !== '--release')) {
    console.error('Usage: node scripts/verify.mjs [--release]');
    process.exitCode = 1;
  } else {
    try {
      const { exitCode } = await verify({ release: args.includes('--release') });
      process.exitCode = exitCode;
    } catch (error) {
      console.error(`[verify] ${error.stack ?? error.message}`);
      process.exitCode = 1;
    }
  }
}
