/**
 * @author Codex
 * @date 2026-11-09
 * 通用 UI 宿主：订阅插槽注册表生成侧栏并挂载插件页面，撤销注册时释放页面并暂存草稿。
 */
import type { MainEntry, SlotSnapshot } from '@workplatform/ui-slots';
import type { PanelDraft, PanelInstance, PanelModule } from '@workplatform/ui-slots/client';
import type {} from './desktop-ui-api.js';

/** 单次挂载记录的对象身份用于取消迟到的动态模块响应。 */
interface MountedPanel {
  entry: MainEntry;
  container: HTMLElement;
  instance: PanelInstance | undefined;
}

const workspace = document.querySelector<HTMLElement>('#workspace')!;
const navigation = document.querySelector<HTMLElement>('#plugin-navigation')!;
const panels = document.querySelector<HTMLElement>('#plugin-panels')!;
const message = document.querySelector<HTMLElement>('#shell-message')!;
// 非空断言等价于明确这些由宿主静态模板提供的元素类型。
const mounted = new Map<string, MountedPanel>();
const drafts = new Map<string, PanelDraft>();
let revision = -1;

/** @param error 插件加载或生命周期错误。@returns 无返回值，显示宿主错误。 */
function showError(error: unknown): void {
  message.textContent = error instanceof Error ? error.message : String(error);
}

/** @returns 无返回值，按已注册页面切换路由，未知或已卸载页面回到工作台。 */
function updateRoute(): void {
  let key: string;
  try { key = decodeURIComponent(location.hash.slice(1)); }
  catch { key = ''; }
  const selected = mounted.has(key) ? key : 'workspace';
  if (key && key !== selected) location.hash = '#workspace';
  workspace.hidden = selected !== 'workspace';
  for (const [id, panel] of mounted) panel.container.hidden = id !== selected;
  for (const link of document.querySelectorAll<HTMLAnchorElement>('nav a')) {
    if (link.hash === '#' + encodeURIComponent(selected)) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

/** @param entry 新注册的页面模块。@returns 模块加载和挂载完成后的 Promise。 */
async function mountPanel(entry: MainEntry): Promise<void> {
  const container = document.createElement('section');
  container.dataset.panel = entry.key;
  container.hidden = true;
  container.textContent = '正在加载面板…';
  const record: MountedPanel = { entry, container, instance: undefined };
  mounted.set(entry.key, record);
  panels.append(container);
  try {
    const module: { default: PanelModule } = await import(entry.entry);
    if (mounted.get(entry.key) !== record) return;
    record.instance = module.default.mount(container, { client: window.desktopUi, draft: drafts.get(entry.key) });
    drafts.delete(entry.key);
  } catch (error) {
    if (mounted.get(entry.key) === record) container.textContent = '面板加载失败：' + (error instanceof Error ? error.message : String(error));
  }
}

/** @param snapshot 主进程最新完整注册表。@returns 无返回值，按注册内容注入导航与页面。 */
function renderSnapshot(snapshot: SlotSnapshot): void {
  if (snapshot.revision <= revision) return;
  revision = snapshot.revision;
  const main = new Map(snapshot.entries.filter((entry): entry is MainEntry => entry.name === 'main').map(entry => [entry.key, entry]));
  for (const [key, panel] of mounted) {
    if (main.get(key)?.entry === panel.entry.entry) continue;
    try {
      const draft = panel.instance?.snapshot?.();
      if (draft) drafts.set(key, draft);
    } catch (error) { showError(error); }
    try { panel.instance?.dispose(); }
    catch (error) { showError(error); }
    panel.container.remove();
    mounted.delete(key);
  }
  for (const [key, entry] of main) {
    if (!mounted.has(key)) void mountPanel(entry);
  }
  navigation.replaceChildren();
  const sidebar = snapshot.entries.filter(entry => entry.name === 'sidebar.panellist').sort((left, right) => left.order - right.order);
  for (const entry of sidebar) {
    if (!main.has(entry.id)) continue;
    const row = document.createElement('p');
    const link = document.createElement('a');
    link.href = '#' + encodeURIComponent(entry.id);
    link.textContent = entry.label;
    row.append(link);
    navigation.append(row);
  }
  updateRoute();
}

window.addEventListener('hashchange', updateRoute);
window.addEventListener('beforeunload', (event) => {
  // @param event 页面卸载事件。@returns 无返回值，由主进程统一确认未保存的插件修改。
  const dirty = Array.from(drafts.values()).some(draft => draft.dirty)
    || Array.from(mounted.values()).some(panel => panel.instance?.snapshot?.().dirty);
  if (dirty) event.preventDefault();
});
window.desktopUi.onChanged(renderSnapshot);
void window.desktopUi.getSnapshot().then(renderSnapshot).catch(showError);
