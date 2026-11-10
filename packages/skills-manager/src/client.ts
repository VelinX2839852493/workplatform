/**
 * @author Codex
 * @date 2026-11-10
 * Skills 面板适配器：挂载 Vue 模板和样式，向宿主提供草稿快照及卸载入口。
 */
import { createApp } from 'vue';
import type { PanelContext, PanelInstance, PanelModule } from '@workplatform/ui-slots/client';
import View from './View.vue';
import styles from './view.css?inline';

/** @param container 宿主分配的容器。@param context 请求接口和草稿。@returns 页面生命周期。 */
function mount(container: HTMLElement, context: PanelContext): PanelInstance {
  const stylesheet = new CSSStyleSheet();
  stylesheet.replaceSync(styles);
  document.adoptedStyleSheets.push(stylesheet);
  const app = createApp(View, { context });
  const panel = app.mount(container) as InstanceType<typeof View>;
  return {
    /** @returns 当前编辑草稿，供宿主保存和关闭保护使用。 */
    snapshot() { return panel.snapshot(); },
    /** @returns 无返回值，释放 Vue 实例及页面样式。 */
    dispose() {
      app.unmount();
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(sheet => sheet !== stylesheet);
    }
  };
}

export default { mount } satisfies PanelModule;
