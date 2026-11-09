/**
 * @author Codex
 * @date 2026-11-07
 * Electron 主进程入口：启动 Cordis 插件上下文，创建桌面窗口，关闭窗口时释放插件并退出。
 */
import boot, { type Context } from '@workplatform/app-boot';
import { app, BrowserWindow, dialog } from 'electron';
import { fileURLToPath } from 'node:url';
import { registerPluginMarketIpc } from './plugin-market-ipc.js';

let appContext: Context;

/**
 * 在所有窗口关闭后退出应用。
 * @returns 上下文释放并发出退出请求后兑现的 Promise。
 */
async function quitApplication(): Promise<void> {
  await appContext.fiber.dispose();
  app.quit();
}

/**
 * 应用就绪后启动插件上下文，创建唯一窗口并加载本地工作台。
 * @returns 页面加载完成时兑现的 Promise。
 */
async function createMainWindow(): Promise<void> {
  appContext = await boot(app.getName());
  const mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 600,
    minHeight: 440,
    title: 'Workplatform',
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url))
    }
  });

  registerPluginMarketIpc(mainWindow, appContext);
  mainWindow.removeMenu();
  await mainWindow.loadFile(fileURLToPath(new URL('../index.html', import.meta.url)));
}

/**
 * 将启动边界的配置或插件错误展示给用户，并以失败状态退出。
 * @param error 启动过程中抛出的错误。
 * @returns 无返回值。
 */
function reportStartupError(error: unknown): void {
  dialog.showErrorBox('应用启动失败', error instanceof Error ? error.message : String(error));
  app.exit(1);
}

app.setName('Workplatform');
app.on('window-all-closed', quitApplication);
app.whenReady().then(createMainWindow).catch(reportStartupError);
