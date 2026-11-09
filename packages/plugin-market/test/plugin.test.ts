/**
 * @author Codex
 * @date 2026-11-07
 * 真实市场插件测试：验证 Cordis 注册与卸载、YAML 装配、市场自关闭和重新加载。
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { Context } from '@deepseek-ai/cordis';
import boot, { LocalPluginRuntime } from '@workplatform/app-boot';
import pluginMarket from '../src/index.js';
import { LocalSlotRegistry } from '@workplatform/ui-slots';

/**
 * 验证市场默认导出是真实插件，服务归插件 Fiber 所有并随卸载移除。
 * @param t 当前测试上下文。
 * @returns 注册、卸载及重新注册断言完成后的 Promise。
 */
async function verifiesPluginLifecycle(t: TestContext): Promise<void> {
  const ctx = new Context();
  ctx.provide('slots', new LocalSlotRegistry());
  t.after(ctx.fiber.dispose);
  const runtime = new LocalPluginRuntime(ctx, [], resolve('package.json'));
  ctx.provide('pluginRuntime', runtime);
  assert.equal(ctx.get('pluginMarket'), undefined);
  const fiber = await ctx.plugin(pluginMarket);
  assert.equal(ctx.get('pluginMarket'), runtime);
  await fiber.dispose();
  assert.equal(ctx.get('pluginMarket'), undefined);
  assert.equal(ctx.get('pluginRuntime'), runtime);
  await ctx.plugin(pluginMarket);
  assert.equal(ctx.get('pluginMarket'), runtime);
}

/**
 * 验证 boot 根据 bundle YAML 加载实际市场插件，且无需 boot 对市场作特殊处理。
 * @param t 当前测试上下文。
 * @returns 配置驱动的市场加载、关闭及恢复断言完成后的 Promise。
 */
async function verifiesBundleBoot(t: TestContext): Promise<void> {
  const previousDirectory = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), 'workplatform-market-plugin-'));
  const bundle = join(directory, 'packages/bundle');
  const pluginDirectory = join(bundle, 'node_modules/@workplatform/plugin-market');
  const marketEntry = pathToFileURL(fileURLToPath(new URL('../dist/index.js', import.meta.url))).href;
  mkdirSync(pluginDirectory, { recursive: true });
  writeFileSync(join(pluginDirectory, 'package.json'), JSON.stringify({ name: '@workplatform/plugin-market', type: 'module', exports: './index.mjs' }));
  writeFileSync(join(pluginDirectory, 'index.mjs'), '/** @author Codex @date 2026-11-07 测试转发实际市场插件入口。 */\nexport { default } from ' + JSON.stringify(marketEntry) + ';');
  writeFileSync(join(bundle, 'cordis.patch.yml'), '- insert:\n    - id: plugin-market\n      name: "@workplatform/plugin-market"\n      required: true\n');
  process.chdir(directory);
  /** @returns 无返回值，恢复工作目录并删除隔离配置。 */
  function cleanupWorkspace(): void {
    process.chdir(previousDirectory);
    rmSync(directory, { recursive: true, force: true });
  }
  t.after(cleanupWorkspace);
  const ctx = await boot('Test');
  t.after(ctx.fiber.dispose);
  assert.deepEqual(ctx.pluginMarket.list(), [{ id: 'plugin-market', name: '@workplatform/plugin-market', state: 'loaded' }]);
  const runtime = ctx.pluginRuntime;
  await ctx.pluginMarket.close('plugin-market');
  assert.equal(ctx.get('pluginMarket'), undefined);
  assert.equal(runtime.list()[0]?.state, 'closed');
  await runtime.load('plugin-market');
  assert.equal(ctx.pluginMarket.list()[0]?.state, 'loaded');
}

test('market service follows its own Cordis plugin lifecycle', verifiesPluginLifecycle);
test('bundle YAML loads the real market plugin and supports reloading it', verifiesBundleBoot);
