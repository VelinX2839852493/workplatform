/**
 * @author Codex
 * @date 2026-11-09
 * 市场插件的客户端面板，接收宿主容器和有限请求接口，不操作侧栏或外部页面。
 */
import type { PluginSummary } from '@workplatform/app-boot';
import type { PanelContext, PanelInstance, PanelModule } from '@workplatform/ui-slots/client';
import type {} from './requests.js';

const labels: Record<PluginSummary['state'], string> = {
  loaded: '已加载', waiting: '等待依赖', loading: '处理中', failed: '加载失败', closed: '已关闭'
};

/** @param container 主面板容器。@param context 宿主注入的请求接口。@returns 页面生命周期。 */
function mount(container: HTMLElement, context: PanelContext): PanelInstance {
  // 仅包含插件内静态标记，动态文本全部用 textContent 填入。
  container.innerHTML = `<h1>插件市场</h1><p>管理本地配置的插件，无需重启应用。</p>
    <button id="refresh-plugins" type="button">刷新列表</button>
    <p id="market-message" role="status" aria-live="polite"></p>
    <table id="plugin-table" hidden><thead><tr><th scope="col">插件</th><th scope="col">标识</th><th scope="col">状态</th><th scope="col">操作</th></tr></thead><tbody id="plugin-list"></tbody></table>`;
  const list = container.querySelector<HTMLTableSectionElement>('#plugin-list')!;
  const table = container.querySelector<HTMLTableElement>('#plugin-table')!;
  const message = container.querySelector<HTMLElement>('#market-message')!;
  const refresh = container.querySelector<HTMLButtonElement>('#refresh-plugins')!;
  const listeners = new AbortController();
  let active = true;
  let generation = 0;

  /** @param plugins 当前插件状态。@returns 无返回值，绘制纯文本表格。 */
  function render(plugins: PluginSummary[]): void {
    list.replaceChildren();
    table.hidden = plugins.length === 0;
    message.textContent = plugins.length === 0 ? '暂无已配置插件。' : '';
    for (const plugin of plugins) {
      const row = document.createElement('tr');
      for (const value of [plugin.name, plugin.id, labels[plugin.state]]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      const cell = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = plugin.state === 'closed' ? '加载' : '关闭';
      button.setAttribute('aria-label', button.textContent + ' ' + plugin.name);
      button.disabled = plugin.state === 'loading';
      button.addEventListener('click', async () => {
        // 无入参，切换当前插件后读取实际状态；卸载自己的面板时不再更新 DOM。
        button.disabled = true;
        ++generation;
        try {
          const result = await context.client.invoke('plugin-market:set-enabled', plugin.id, plugin.state === 'closed');
          if (active) render(result);
        } catch (error) {
          if (!active) return;
          await refreshPlugins();
          if (active) message.textContent = error instanceof Error ? error.message : String(error);
        } finally {
          if (active) button.disabled = plugin.state === 'loading';
        }
      }, { signal: listeners.signal });
      cell.append(button);
      row.append(cell);
      list.append(row);
    }
  }

  /** @returns 刷新完成后的 Promise，丢弃较旧查询响应。 */
  async function refreshPlugins(): Promise<void> {
    const token = ++generation;
    refresh.disabled = true;
    message.textContent = '正在读取插件列表…';
    try {
      const result = await context.client.invoke('plugin-market:list');
      if (active && token === generation) render(result);
    } catch (error) {
      if (active && token === generation) message.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      if (active && token === generation) refresh.disabled = false;
    }
  }
  refresh.addEventListener('click', refreshPlugins, { signal: listeners.signal });
  void refreshPlugins();
  return {
    /** @returns 无返回值，停止监听并忽略晚到的响应。 */
    dispose() { active = false; ++generation; listeners.abort(); }
  };
}

export default { mount } satisfies PanelModule;
