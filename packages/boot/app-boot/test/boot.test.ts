/**
 * @author Codex
 * @date 2026-11-07
 * 启动流程测试：验证 YAML 顺序展开、读取错误、空启动及以 bundle 为起点的插件解析与注册。
 * 插件模块只写入测试临时目录，测试结束后清除，不向项目 bundle 创建任何插件。
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Context } from '@deepseek-ai/cordis';
import boot, { readDesktopPlugins } from '../src/index.js';

/**
 * 创建隔离工作目录，并在测试结束时恢复工作目录和清理临时文件。
 * @param t 当前测试上下文。
 * @returns 临时 bundle 目录的绝对路径。
 */
function createWorkspace(t: TestContext): string {
  const previousDirectory = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), 'workplatform-boot-'));
  const bundle = join(directory, 'packages/bundle');
  mkdirSync(bundle, { recursive: true });
  process.chdir(directory);
  t.after(function cleanupWorkspace(): void {
    // 恢复进程工作目录并清除本测试创建的临时文件；无入参、无返回值。
    process.chdir(previousDirectory);
    rmSync(directory, { recursive: true, force: true });
  });
  return bundle;
}

/**
 * 验证多个 insert 列表按原始顺序展开，条目元数据完整保留。
 * @param t 当前测试上下文。
 * @returns 无返回值。
 */
function verifiesPatchOrder(t: TestContext): void {
  const bundle = createWorkspace(t);
  const path = join(bundle, 'cordis.patch.yml');
  writeFileSync(path, '- insert:\n    - id: log\n      name: log\n      required: true\n- insert:\n    - id: sandbox\n      name: sandbox\n      required: false\n');
  assert.deepEqual(readDesktopPlugins(path), [
    { id: 'log', name: 'log', required: true },
    { id: 'sandbox', name: 'sandbox', required: false }
  ]);
}

/**
 * 验证读取器保留文件缺失和 YAML 语法错误，不吞掉异常。
 * @param t 当前测试上下文。
 * @returns 无返回值。
 */
function verifiesConfigurationErrors(t: TestContext): void {
  const bundle = createWorkspace(t);
  const path = join(bundle, 'cordis.patch.yml');
  assert.throws(function readsMissingFile(): void {
    // 读取不存在的配置文件；无入参，预期抛出读取错误。
    readDesktopPlugins(path);
  }, /ENOENT/);
  writeFileSync(path, '[unterminated');
  assert.throws(function readsInvalidYaml(): void {
    // 读取语法不完整的 YAML；无入参，预期抛出解析错误。
    readDesktopPlugins(path);
  });
}

/**
 * 验证应用在没有配置文件及空补丁列表时均可创建可释放的上下文。
 * @param t 当前测试上下文。
 * @returns 所有空启动断言完成时兑现的 Promise。
 */
async function verifiesEmptyBoot(t: TestContext): Promise<void> {
  const bundle = createWorkspace(t);
  const missingConfigContext = await boot('Test');
  assert.ok(Context.is(missingConfigContext));
  assert.equal(missingConfigContext.get('pluginMarket'), undefined);
  await missingConfigContext.fiber.dispose();
  writeFileSync(join(bundle, 'cordis.patch.yml'), '[]');
  const emptyConfigContext = await boot('Test');
  assert.ok(Context.is(emptyConfigContext));
  assert.equal(emptyConfigContext.get('pluginMarket'), undefined);
  await emptyConfigContext.fiber.dispose();
}

/**
 * 在隔离 bundle 中生成用于注册顺序断言的临时模块。
 * @param bundle 临时 bundle 路径。
 * @param name 临时模块名称。
 * @param body 临时插件函数体。
 * @returns 无返回值。
 */
function writeTemporaryPlugin(bundle: string, name: string, body: string): void {
  const entry = join(bundle, 'node_modules', name, 'index.mjs');
  mkdirSync(dirname(entry), { recursive: true });
  writeFileSync(join(dirname(entry), 'package.json'), JSON.stringify({ name: name, type: 'module', exports: './index.mjs' }));
  writeFileSync(entry, '/** @author Codex @date 2026-11-07 临时测试模块，仅记录注册顺序。 */\n/** @param ctx Cordis 上下文。@returns 注册完成时兑现的 Promise。 */\nexport default async function register(ctx) { ' + body + ' }');
}

/**
 * 验证插件仅安装在 bundle 时也能解析，并等待前一个插件注册后再启动下一个。
 * @param t 当前测试上下文。
 * @returns 注册顺序断言和上下文释放完成时兑现的 Promise。
 */
async function verifiesBundleResolution(t: TestContext): Promise<void> {
  const bundle = createWorkspace(t);
  writeTemporaryPlugin(bundle, 'test-first', 'await new Promise(resolve => setTimeout(resolve, 10)); ctx.root.provide("bootOrder", ["first"]);');
  writeTemporaryPlugin(bundle, 'test-second', 'ctx.root.get("bootOrder").push("second");');
  writeFileSync(join(bundle, 'cordis.patch.yml'), '- insert:\n    - id: first\n      name: test-first\n      required: true\n    - id: second\n      name: test-second\n      required: false\n');
  const ctx = await boot('Test');
  t.after(function disposeContext(): Promise<void> {
    // 释放测试上下文；无入参，返回释放完成时兑现的 Promise。
    return ctx.fiber.dispose();
  });
  assert.deepEqual(ctx.get('bootOrder'), ['first', 'second']);
  assert.deepEqual(ctx.pluginRuntime.list(), [
    { id: 'first', name: 'test-first', state: 'loaded' },
    { id: 'second', name: 'test-second', state: 'loaded' }
  ]);
  await ctx.pluginRuntime.close('second');
  assert.equal(ctx.pluginRuntime.list()[1]?.state, 'closed');
}

/**
 * 验证配置中不存在的插件包会导致启动失败。
 * @param t 当前测试上下文。
 * @returns 缺失模块断言完成时兑现的 Promise。
 */
async function verifiesMissingPlugin(t: TestContext): Promise<void> {
  const bundle = createWorkspace(t);
  writeFileSync(join(bundle, 'cordis.patch.yml'), '- insert:\n    - id: missing\n      name: workplatform-test-not-installed\n');
  await assert.rejects(boot('Test'), /Cannot find module/);
}

/**
 * 验证显式配置脱离工作目录后仍能解析插件，且缺失的显式配置不会静默空启动。
 * @param t 当前测试上下文。
 * @returns 配置路径和插件加载断言完成时兑现的 Promise。
 */
async function verifiesExplicitConfiguration(t: TestContext): Promise<void> {
  const bundle = createWorkspace(t);
  writeTemporaryPlugin(bundle, 'test-packaged', 'ctx.root.provide("packagedPlugin", true);');
  const patchPath = join(bundle, 'cordis.patch.yml');
  writeFileSync(patchPath, '- insert:\n    - id: packaged\n      name: test-packaged\n');
  process.chdir(tmpdir());
  const ctx = await boot('PackagedTest', patchPath);
  t.after(function disposeContext(): Promise<void> {
    // 释放临时插件上下文；无入参，返回释放完成时兑现的 Promise。
    return ctx.fiber.dispose();
  });
  assert.equal(ctx.get('packagedPlugin'), true);
  assert.equal(ctx.pluginRuntime.list()[0]?.state, 'loaded');
  await assert.rejects(boot('PackagedTest', join(bundle, 'missing.yml')), /ENOENT/);
  writeFileSync(patchPath, '[unterminated');
  await assert.rejects(boot('PackagedTest', patchPath));
}

test('preserves insert and plugin order', verifiesPatchOrder);
test('propagates file and YAML errors', verifiesConfigurationErrors);
test('boots without plugins or configuration', verifiesEmptyBoot);
test('resolves bundle-local plugins and registers them sequentially', verifiesBundleResolution);
test('rejects an unresolved plugin', verifiesMissingPlugin);
test('loads an explicit configuration independently of cwd and propagates configuration errors', verifiesExplicitConfiguration);
