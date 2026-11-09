/**
 * @author Codex
 * @date 2026-11-07
 * Cordis 插件市场入口：插件启用时提供市场服务，服务随插件 Fiber 卸载而自动移除。
 */
import type { Context, Plugin } from '@deepseek-ai/cordis';
import type { PluginRuntime } from '@workplatform/app-boot';
import { registerMarketRequests } from './requests.js';

/** 市场插件对外提供的管理接口，复用启动内核的通用生命周期契约。 */
export type PluginMarket = PluginRuntime;
export type { PluginSummary } from '@workplatform/app-boot';

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 仅在插件市场启用期间存在的市场服务；可通过 ctx.get 检查可用性。 */
    pluginMarket: PluginMarket;
  }
}

const pluginMarket: Plugin.Object = {
  name: 'plugin-market',
  inject: ['pluginRuntime', 'slots'],
  /**
   * 将市场服务注册到当前插件 Fiber，而非根 Context。
   * @param ctx 由 Cordis 注入通用运行时后的插件上下文。
   * @returns 无返回值；Cordis 自动管理 provide 的释放。
   */
  apply(ctx: Context): void {
    ctx.provide('pluginMarket', ctx.pluginRuntime);
    registerMarketRequests(ctx, ctx.pluginRuntime);
    ctx.effect(() => ctx.slots.register({
      name: 'main', key: 'plugin-market', entry: new URL('./client.js', import.meta.url).href
    }));
    ctx.effect(() => ctx.slots.register({
      name: 'sidebar.panellist', id: 'plugin-market', label: '插件市场', order: 10
    }));
  }
};

export default pluginMarket;
