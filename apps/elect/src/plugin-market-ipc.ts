/**
 * @author Codex
 * @date 2026-11-07
 * 插件市场 IPC 边界：校验调用窗口和参数后，将有限操作交给同一市场实例。
 */
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { Context } from '@workplatform/app-boot';
import type {} from '@workplatform/plugin-market';
import type { PluginMarketState } from './plugin-market-api.js';

/**
 * 为应用唯一窗口注册市场请求处理器。
 * @param window 调用被允许的应用窗口。
 * @param ctx 应用上下文，按请求检查可选市场服务。
 * @returns 无返回值。
 */
export function registerPluginMarketIpc(window: BrowserWindow, ctx: Context): void {
  /** @param event 请求事件。@returns 无返回值；非主页面请求抛出错误。 */
  function validateSender(event: IpcMainInvokeEvent): void {
    if (event.senderFrame !== window.webContents.mainFrame) throw new Error('不允许的插件市场请求来源');
  }

  /** @returns 可选市场插件是否已提供服务及其插件列表。 */
  function currentState(): PluginMarketState {
    const market = ctx.get('pluginMarket');
    return { available: market !== undefined, plugins: market ? market.list() : [] };
  }

  /** @param event 请求事件。@returns 当前市场插件状态。 */
  function getState(event: IpcMainInvokeEvent): PluginMarketState {
    validateSender(event);
    return currentState();
  }

  /**
   * 在 IPC 边界完成参数校验并执行插件开关。
   * @param event 请求事件。
   * @param id 外部插件标识。
   * @param enabled 外部开关值。
   * @returns 操作后的插件状态列表。
   */
  async function setEnabled(event: IpcMainInvokeEvent, id: unknown, enabled: unknown): Promise<PluginMarketState> {
    validateSender(event);
    if (typeof id !== 'string' || typeof enabled !== 'boolean') throw new TypeError('插件标识或开关参数无效');
    const market = ctx.get('pluginMarket');
    if (!market) throw new Error('插件市场未加载');
    if (enabled) await market.load(id);
    else await market.close(id);
    return currentState();
  }

  /** @param name 发生变化的服务名称。@returns 无返回值，向页面通知市场服务的实际可用性。 */
  function notifyServiceChanged(name: string): void {
    if (name === 'pluginMarket') window.webContents.send('plugin-market:state', currentState());
  }

  const stopWatching = ctx.on('internal/service', notifyServiceChanged);
  window.once('closed', stopWatching);
  ipcMain.handle('plugin-market:state', getState);
  ipcMain.handle('plugin-market:set-enabled', setEnabled);
}
