/**
 * @author Codex
 * @date 2026-11-09
 * 工具插件：注册侧边栏、页面和有限请求，配置落盘到根目录 config/tool。
 */
import type { Context, Plugin } from '@deepseek-ai/cordis';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonToolStore, type Tool, type ToolStore } from './store.js';
import type {} from '@workplatform/ui-slots';

/** 仅供插件配置和隔离测试指定存储位置。 */
interface Config { directory?: string; }

declare module '@workplatform/ui-slots' {
  interface DesktopRequestMap {
    'tools:list': { args: []; result: Tool[] };
    'tools:save': { args: [tool: Tool]; result: Tool[] };
    'tools:remove': { args: [id: string]; result: Tool[] };
    'tools:open': { args: [id: string]; result: void };
  }
}

const toolsPlugin: Plugin.Object<Config> = {
  name: 'tools',
  inject: ['slots'],
  /** @param ctx 插件上下文。@param config 可选文件夹。@returns 注册完成后的 Promise。 */
  async apply(ctx: Context, config: Config = {}): Promise<void> {
    let directory = config.directory || fileURLToPath(new URL('../../../config/tool', import.meta.url));
    if (!config.directory && process.versions.electron) {
      const { app } = await import('electron');
      // 打包后 ASAR 不可写，根目录取可执行文件所在目录。
      if (app.isPackaged) directory = join(dirname(app.getPath('exe')), 'config/tool');
    }
    const store: ToolStore = new JsonToolStore(directory);
    ctx.effect(() => ctx.slots.handle('tools:list', () => store.list()));
    ctx.effect(() => ctx.slots.handle('tools:save', input => store.save(input)));
    ctx.effect(() => ctx.slots.handle('tools:remove', id => store.remove(id)));
    ctx.effect(() => ctx.slots.handle('tools:open', async id => {
      // @param id 已保存工具标识。@returns 系统浏览器打开完成后的 Promise。
      if (typeof id !== 'string') throw new TypeError('工具标识无效');
      const tool = store.list().find(item => item.id === id);
      if (!tool) throw new Error('工具不存在，请刷新列表');
      // 文件是外部输入；打开边界只允许网页协议，不执行其他本地协议。
      const address = new URL(tool.url);
      if (address.protocol !== 'https:' && address.protocol !== 'http:') throw new TypeError('只支持 HTTP/HTTPS 网址');
      const { shell } = await import('electron');
      await shell.openExternal(address.href);
    }));
    ctx.effect(() => ctx.slots.register({ name: 'main', key: 'tools', entry: new URL('./client.js', import.meta.url).href }));
    ctx.effect(() => ctx.slots.register({ name: 'sidebar.panellist', id: 'tools', label: '工具', order: 30 }));
  }
};

export default toolsPlugin;
