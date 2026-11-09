/**
 * @author Codex
 * @date 2026-11-07
 * 通用插件生命周期测试：使用临时本地模块验证加载、关闭、重新加载、错误恢复和 Context 退出清理。
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Context } from '@deepseek-ai/cordis';
import { LocalPluginRuntime, type PluginRuntime } from '../src/index.js';

/**
 * 创建仅供当前测试使用的插件模块，注册时记录加载，释放 effect 时记录关闭。
 * @param t 测试上下文，负责清理隔离目录。
 * @param failsFirst 是否在首次加载时抛出错误。
 * @returns 临时 bundle/package.json 的绝对路径。
 */
function createBundle(t: TestContext, failsFirst = false): string {
  const directory = mkdtempSync(join(tmpdir(), 'workplatform-market-'));
  const pluginDirectory = join(directory, 'node_modules/test-market-plugin');
  mkdirSync(pluginDirectory, { recursive: true });
  writeFileSync(join(pluginDirectory, 'package.json'), JSON.stringify({ name: 'test-market-plugin', type: 'module', exports: './index.mjs' }));
  writeFileSync(join(pluginDirectory, 'index.mjs'), `
/** @author Codex @date 2026-11-07 临时生命周期测试模块，不属于项目插件。 */
/** @param ctx 当前插件上下文。@returns 无返回值。 */
export default function start(ctx) {
  const events = ctx.root.get('events');
  ${failsFirst ? "if (events.length === 0) { events.push('failed'); throw new Error('test startup failed'); }" : ''}
  events.push('loaded');
  ctx.effect(function registerCleanup() {
    // 注册资源释放回调；无入参，返回清理函数。
    return function cleanup() {
      // 记录资源释放；无入参、无返回值。
      events.push('closed');
    };
  });
}
`);
  /** @returns 无返回值，清除本测试创建的临时目录。 */
  function cleanupBundle(): void {
    rmSync(directory, { recursive: true, force: true });
  }
  t.after(cleanupBundle);
  return join(directory, 'package.json');
}

/**
 * 验证重复加载不会创建副本，关闭等待资源释放，随后可以重新加载。
 * @param t 当前测试上下文。
 * @returns 生命周期及退出清理断言完成后的 Promise。
 */
async function verifiesLifecycle(t: TestContext): Promise<void> {
  const packagePath = createBundle(t);
  const ctx = new Context();
  const events: string[] = [];
  ctx.provide('events', events);
  t.after(ctx.fiber.dispose);
  const market: PluginRuntime = new LocalPluginRuntime(ctx, [{ id: 'test', name: 'test-market-plugin' }], packagePath);
  assert.equal(market.list()[0]?.state, 'closed');
  await market.load('test');
  await market.load('test');
  assert.deepEqual(events, ['loaded']);
  assert.equal(market.list()[0]?.state, 'loaded');
  await market.close('test');
  await market.close('test');
  assert.deepEqual(events, ['loaded', 'closed']);
  assert.equal(market.list()[0]?.state, 'closed');
  await market.load('test');
  assert.deepEqual(events, ['loaded', 'closed', 'loaded']);
  await ctx.fiber.dispose();
  assert.deepEqual(events, ['loaded', 'closed', 'loaded', 'closed']);
  assert.equal(market.list()[0]?.state, 'closed');
}

/**
 * 验证插件启动错误可见，关闭失败实例后能够再次加载。
 * @param t 当前测试上下文。
 * @returns 错误状态及恢复断言完成后的 Promise。
 */
async function verifiesFailureRecovery(t: TestContext): Promise<void> {
  const packagePath = createBundle(t, true);
  const ctx = new Context();
  ctx.provide('events', []);
  t.after(ctx.fiber.dispose);
  const market: PluginRuntime = new LocalPluginRuntime(ctx, [{ id: 'test', name: 'test-market-plugin' }], packagePath);
  await assert.rejects(market.load('test'), /test startup failed/);
  assert.equal(market.list()[0]?.state, 'failed');
  await market.close('test');
  assert.equal(market.list()[0]?.state, 'closed');
  await market.load('test');
  assert.equal(market.list()[0]?.state, 'loaded');
}

/**
 * 验证目录白名单、缺失模块和重复 id 的错误保持明确。
 * @param t 当前测试上下文。
 * @returns 无效插件断言完成后的 Promise。
 */
async function verifiesInvalidPlugins(t: TestContext): Promise<void> {
  const packagePath = createBundle(t);
  const ctx = new Context();
  t.after(ctx.fiber.dispose);
  const market: PluginRuntime = new LocalPluginRuntime(ctx, [{ id: 'missing', name: 'workplatform-test-uninstalled' }], packagePath);
  await assert.rejects(market.load('unknown'), /插件未配置/);
  await assert.rejects(market.close('unknown'), /插件未配置/);
  await assert.rejects(market.load('missing'), /Cannot find module/);
  assert.equal(market.list()[0]?.state, 'closed');
  /** @returns 无返回值，预期重复 id 触发配置错误。 */
  function createDuplicateMarket(): void {
    new LocalPluginRuntime(ctx, [{ id: 'same', name: 'first' }, { id: 'same', name: 'second' }], packagePath);
  }
  assert.throws(createDuplicateMarket, /插件 id 重复/);
}

test('loads, closes and reloads one instance with cleanup', verifiesLifecycle);
test('reports startup failure and allows recovery', verifiesFailureRecovery);
test('rejects unknown, missing and duplicate plugins', verifiesInvalidPlugins);
