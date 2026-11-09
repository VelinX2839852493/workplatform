/**
 * @author Codex
 * @date 2026-11-07
 * 应用启动入口：读取桌面插件补丁，以 bundle 为解析起点，按配置顺序注册插件并返回 Context。
 */
import { Context } from '@deepseek-ai/cordis';
import { LocalPluginRuntime } from './plugin-runtime.js';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { readDesktopPlugins } from './read-desktop-plugins.js';
import { LocalSlotRegistry } from '@workplatform/ui-slots';

export { readDesktopPlugins, type DesktopPlugin } from './read-desktop-plugins.js';
export type { Context } from '@deepseek-ai/cordis';
export { LocalPluginRuntime, type PluginRuntime, type PluginDefinition, type PluginSummary } from './plugin-runtime.js';

/**
 * 为指定应用创建 Cordis 上下文，并顺序注册 bundle 配置中的插件。
 * @param appName 应用名称，用于标识启动日志。
 * @returns 已完成插件注册的 Cordis 上下文，由调用方负责释放。
 * @throws 配置读取、解析、模块加载或插件注册失败时抛出错误。
 */
export default async function boot(appName: string): Promise<Context> {
  const patchPath = resolve('./packages/bundle/cordis.patch.yml');
  const desktopPlugins = existsSync(patchPath) ? readDesktopPlugins(patchPath) : [];
  // 以 bundle/package.json 为起点查找插件。
  const ctx = new Context();
  ctx.provide('slots', new LocalSlotRegistry());
  const runtime = new LocalPluginRuntime(ctx, desktopPlugins, join(dirname(patchPath), 'package.json'));
  ctx.provide('pluginRuntime', runtime);
  ctx.logger(appName).debug('启动应用，注册 %d 个桌面插件', desktopPlugins.length);

  for (const plugin of desktopPlugins) {
    // 注册插件。
    await runtime.load(plugin.id);
    // const module = await import(plugin.name)
    // await ctx.plugin(module.default)
  }

  return ctx;
}
