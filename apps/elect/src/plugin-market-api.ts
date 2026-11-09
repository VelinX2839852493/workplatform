/**
 * @author Codex
 * @date 2026-11-07
 * 预加载桥接契约：渲染进程仅能查询市场和切换已配置插件，不暴露通用 IPC。
 */
import type { PluginSummary } from '@workplatform/plugin-market';

/** preload 实现并暴露给页面的有限接口。 */
export interface PluginMarketClient {
  /** @returns 市场插件的可用性和当前插件列表。 */
  getState(): Promise<PluginMarketState>;
  /** @param id 插件标识。@param enabled 是否加载。@returns 操作完成后的市场状态。 */
  setEnabled(id: string, enabled: boolean): Promise<PluginMarketState>;
  /** @param listener 市场服务变化时的回调。@returns 取消订阅函数。 */
  onStateChanged(listener: (state: PluginMarketState) => void): () => void;
}

/** 市场插件可能尚未配置或已经卸载，因此单独传递服务是否存在。 */
export interface PluginMarketState {
  available: boolean;
  plugins: PluginSummary[];
}

declare global {
  interface Window {
    pluginMarket: PluginMarketClient;
  }
}
