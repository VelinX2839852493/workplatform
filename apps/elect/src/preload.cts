/**
 * @author Codex
 * @date 2026-11-07
 * Electron 预加载入口：通过隔离桥接暴露插件查询和开关两个操作，编译为 sandbox 支持的 CommonJS。
 */
import electron = require('electron');
import type { PluginMarketClient, PluginMarketState } from './plugin-market-api.js';

const { contextBridge, ipcRenderer } = electron;
// 等价展开：const contextBridge = electron.contextBridge; const ipcRenderer = electron.ipcRenderer;

const client: PluginMarketClient = {
  /** @returns 主进程提供的市场插件状态。 */
  getState(): Promise<PluginMarketState> {
    return ipcRenderer.invoke('plugin-market:state');
  },
  /** @param id 插件标识。@param enabled 是否加载。@returns 更新后的插件状态列表。 */
  setEnabled(id: string, enabled: boolean): Promise<PluginMarketState> {
    return ipcRenderer.invoke('plugin-market:set-enabled', id, enabled);
  },
  /** @param listener 市场服务变化回调。@returns 取消当前监听的函数。 */
  onStateChanged(listener: (state: PluginMarketState) => void): () => void {
    /** @param event IPC 事件，仅在隔离层接收。@param state 可序列化的市场状态。@returns 无返回值。 */
    function handleState(event: Electron.IpcRendererEvent, state: PluginMarketState): void {
      listener(state);
    }
    ipcRenderer.on('plugin-market:state', handleState);
    /** @returns 无返回值，取消当前回调。 */
    function unsubscribe(): void {
      ipcRenderer.removeListener('plugin-market:state', handleState);
    }
    return unsubscribe;
  }
};

contextBridge.exposeInMainWorld('pluginMarket', client);
