/**
 * @author Codex
 * @date 2026-11-09
 * 隔离 preload：暴露通用注册表快照和插件有限请求，不暴露任意 IPC 或文件操作。
 */
import electron = require('electron');
import type { SlotSnapshot } from '@workplatform/ui-slots';
import type { DesktopUiClient } from './desktop-ui-api.js';

const { contextBridge, ipcRenderer } = electron;
// 等价于分别读取 electron.contextBridge 和 electron.ipcRenderer。
const client: DesktopUiClient = {
  /** @returns 主进程的当前注册表快照。 */
  getSnapshot() { return ipcRenderer.invoke('desktop-ui:snapshot'); },
  /** @param method 已注册的方法。@param args 有限请求参数。@returns 插件返回值。 */
  invoke(method, ...args) { return ipcRenderer.invoke('desktop-ui:invoke', method, args); },
  /** @param listener UI 快照变化回调。@returns 取消订阅函数。 */
  onChanged(listener) {
    /** @param event 隔离层事件。@param snapshot 新快照。@returns 无返回值。 */
    function handle(event: Electron.IpcRendererEvent, snapshot: SlotSnapshot): void { listener(snapshot); }
    ipcRenderer.on('desktop-ui:changed', handle);
    return () => ipcRenderer.removeListener('desktop-ui:changed', handle);
  }
};
contextBridge.exposeInMainWorld('desktopUi', client);
