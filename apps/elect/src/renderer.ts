/**
 * @author Codex
 * @date 2026-11-07
 * 市场页面：切换侧栏视图，展示本地插件状态，通过 preload 接口加载或关闭插件。
 */
import type { PluginSummary } from '@workplatform/plugin-market';
import type { PluginMarketState } from './plugin-market-api.js';

const workspace = document.querySelector<HTMLElement>('#workspace')!;
const marketPage = document.querySelector<HTMLElement>('#plugin-market')!;
const pluginList = document.querySelector<HTMLTableSectionElement>('#plugin-list')!;
const table = document.querySelector<HTMLTableElement>('#plugin-table')!;
const message = document.querySelector<HTMLParagraphElement>('#market-message')!;
const refreshButton = document.querySelector<HTMLButtonElement>('#refresh-plugins')!;
const marketNavigation = document.querySelector<HTMLParagraphElement>('#market-navigation')!;
let marketAvailable = false;
// 非空断言等价于将这些静态模板中始终存在的元素明确标为对应 DOM 元素类型。

const stateLabels: Record<PluginSummary['state'], string> = {
  loaded: '已加载', waiting: '等待依赖', loading: '处理中', failed: '加载失败', closed: '已关闭'
};

/**
 * 将市场状态渲染为默认样式表格，插件文本仅以纯文本写入。
 * @param plugins 主进程返回的插件状态。
 * @returns 无返回值。
 */
function renderPlugins(plugins: PluginSummary[]): void {
  pluginList.replaceChildren();
  table.hidden = plugins.length === 0;
  message.textContent = plugins.length === 0 ? '暂无已配置插件。' : '';
  for (const plugin of plugins) {
    const row = document.createElement('tr');
    for (const value of [plugin.name, plugin.id, stateLabels[plugin.state]]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    const actionCell = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = plugin.state === 'closed' ? '加载' : '关闭';
    button.setAttribute('aria-label', button.textContent + ' ' + plugin.name);
    button.disabled = plugin.state === 'loading';
    /** @returns 操作和状态刷新完成后的 Promise。 */
    async function togglePlugin(): Promise<void> {
      button.disabled = true;
      try {
        renderState(await window.pluginMarket.setEnabled(plugin.id, plugin.state === 'closed'));
      } catch (error) {
        // IPC 错误在页面入口展示；同时恢复实际 Fiber 状态，允许关闭失败的实例。
        await refreshPlugins();
        message.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        button.disabled = plugin.state === 'loading';
      }
    }
    button.addEventListener('click', togglePlugin);
    actionCell.append(button);
    row.append(actionCell);
    pluginList.append(row);
  }
}

/** @returns 插件状态刷新后兑现的 Promise，失败信息显示在当前页面。 */
async function refreshPlugins(): Promise<void> {
  refreshButton.disabled = true;
  message.textContent = '正在读取插件列表…';
  try {
    renderState(await window.pluginMarket.getState());
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    refreshButton.disabled = false;
  }
}

/** @returns 无返回值，仅在市场插件可用时允许显示该页面。 */
function updateRoute(): void {
  const isMarket = marketAvailable && location.hash === '#plugin-market';
  workspace.hidden = isMarket;
  marketPage.hidden = !isMarket;
  for (const link of document.querySelectorAll<HTMLAnchorElement>('nav a')) {
    if (link.hash === (isMarket ? '#plugin-market' : '#workspace')) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

/** @param state 主进程返回的市场可用性与插件列表。@returns 无返回值。 */
function renderState(state: PluginMarketState): void {
  marketAvailable = state.available;
  marketNavigation.hidden = !marketAvailable;
  renderPlugins(state.plugins);
  if (!marketAvailable && location.hash === '#plugin-market') location.hash = '#workspace';
  updateRoute();
}

/** @returns 侧栏页面切换及必要的状态刷新完成时兑现的 Promise。 */
async function showPage(): Promise<void> {
  updateRoute();
  if (marketAvailable && location.hash === '#plugin-market') await refreshPlugins();
}

refreshButton.addEventListener('click', refreshPlugins);
window.addEventListener('hashchange', showPage);
window.pluginMarket.onStateChanged(renderState);
void refreshPlugins();
