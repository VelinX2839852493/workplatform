/**
 * @author Codex
 * @date 2026-11-09
 * 启动隐藏的真实 Electron 窗口执行插槽和 Skills 集成验收；用户目录全部替换为临时目录。
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('Electron injects registered panels, protects drafts and saves Skills through the plugin bridge', { timeout: 45000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'workplatform-electron-test-'));
  t.after(async () => {
    // 仅清除本次在系统临时目录创建的测试目录；无入参、无返回值。
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.ok(directory.startsWith(join(tmpdir(), 'workplatform-electron-test-')));
    await rm(directory, { recursive: true, force: true });
  });
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const harness = fileURLToPath(new URL('./desktop-ui.electron.mjs', import.meta.url));
  const executable: string = createRequire(import.meta.url)('electron');
  const environment: NodeJS.ProcessEnv = { ...process.env, USERPROFILE: directory, HOME: directory, CODEX_HOME: join(directory, '.codex') };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(executable, [harness, directory], { cwd: root, windowsHide: true, env: environment, timeout: 35000 });
  let diagnostics = '';
  child.stdout.on('data', chunk => { diagnostics += String(chunk); });
  child.stderr.on('data', chunk => { diagnostics += String(chunk); });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  const code = await new Promise<number | null>((fulfill, reject) => {
    child.once('error', reject);
    child.once('exit', fulfill);
  });
  let report: { ok: boolean; checks: string[]; error?: string };
  try { report = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8')); }
  catch { throw new Error('Electron 未生成验收报告，退出码 ' + code + '\n' + diagnostics); }
  assert.equal(code, 0, report.checks.join('；') + '\n' + (report.error || diagnostics));
  assert.equal(report.ok, true, report.error || diagnostics);
  assert.ok(report.checks.length >= 10);
  t.diagnostic(report.checks.join('；'));
});
