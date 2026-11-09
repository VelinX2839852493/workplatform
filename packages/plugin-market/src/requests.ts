/**
 * @author Codex
 * @date 2026-11-09
 * 市场自己的桌面请求注册，校验开关参数后复用通用插件运行时。
 */
import type { Context } from '@deepseek-ai/cordis';
import type { PluginRuntime, PluginSummary } from '@workplatform/app-boot';
import type {} from '@workplatform/ui-slots';

declare module '@workplatform/ui-slots' {
  interface DesktopRequestMap {
    'plugin-market:list': { args: []; result: PluginSummary[] };
    'plugin-market:set-enabled': { args: [id: string, enabled: boolean]; result: PluginSummary[] };
  }
}

/** @param ctx 当前插件上下文。@param runtime 通用插件运行时。@returns 无返回值。 */
export function registerMarketRequests(ctx: Context, runtime: PluginRuntime): void {
  ctx.effect(() => ctx.slots.handle('plugin-market:list', () => runtime.list()));
  ctx.effect(() => ctx.slots.handle('plugin-market:set-enabled', async (id, enabled) => {
    // @param id 外部插件标识。@param enabled 开关参数。@returns 操作后的状态列表。
    if (typeof id !== 'string' || typeof enabled !== 'boolean') throw new TypeError('插件标识或开关参数无效');
    if (enabled) await runtime.load(id);
    else await runtime.close(id);
    return runtime.list();
  }));
}
