/**
 * @author Codex
 * @date 2026-11-09
 * 通用 UI 桥接：只接收唯一窗口请求并转给插件注册表，不导入业务插件或解释业务参数。
 */
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { Context } from '@workplatform/app-boot';
import type {} from '@workplatform/ui-slots';

/** @param window 可信应用窗口。@param ctx 应用上下文。@returns 无返回值，窗口关闭时撤销桥接。 */
export function registerDesktopUiIpc(window: BrowserWindow, ctx: Context): void {
  /** @param event 外部事件。@returns 无返回值，拒绝其他 frame。 */
  function validateSender(event: IpcMainInvokeEvent): void {
    if (event.senderFrame !== window.webContents.mainFrame) throw new Error('不允许的桌面 UI 请求来源');
  }
  ipcMain.handle('desktop-ui:snapshot', (event: IpcMainInvokeEvent) => {
    // @param event 主页面事件。@returns 当前完整快照。
    validateSender(event);
    return ctx.slots.snapshot();
  });
  ipcMain.handle('desktop-ui:invoke', (event: IpcMainInvokeEvent, method: unknown, args: unknown) => {
    // @param event 主页面事件。@param method 注册方法。@param args 序列化参数。@returns 插件处理结果。
    validateSender(event);
    if (typeof method !== 'string' || !Array.isArray(args)) throw new TypeError('桌面请求参数无效');
    return ctx.slots.invoke(method, args);
  });
  const stopWatching = ctx.slots.subscribe((snapshot) => {
    // @param snapshot 注册表快照。@returns 无返回值，向窗口推送 UI 变化。
    if (!window.webContents.isDestroyed()) window.webContents.send('desktop-ui:changed', snapshot);
  });
  window.once('closed', () => {
    // 释放窗口的监听与请求处理器；无入参、无返回值。
    stopWatching();
    ipcMain.removeHandler('desktop-ui:snapshot');
    ipcMain.removeHandler('desktop-ui:invoke');
  });
}
