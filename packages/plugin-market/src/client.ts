/**
 * @author Codex
 * @date 2026-11-10
 * Vue 面板适配器：接收通用宿主接口，挂载插件模板，并在卸载时释放 Vue 实例及页面资源。
 */
import { createApp } from 'vue';
import type { PanelContext, PanelInstance, PanelModule } from '@workplatform/ui-slots/client';
import View from './View.vue';

/** @param container 宿主面板。@param context 请求接口。@returns 插件页面生命周期。 */
function mount(container: HTMLElement, context: PanelContext): PanelInstance {
  const app = createApp(View, { context });
  app.mount(container);
  return {
    /** @returns 无返回值，停止页面逻辑并释放界面资源。 */
    dispose() {
      app.unmount();
    }
  };
}

export default { mount } satisfies PanelModule;
