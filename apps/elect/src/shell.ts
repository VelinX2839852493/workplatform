/**
 * @author Codex
 * @date 2026-11-10
 * Vue 宿主逻辑：订阅通用插槽生成导航，管理插件挂载、路由和卸载草稿，不持有业务模板。
 */
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { MainEntry, SidebarEntry, SlotSnapshot } from '@workplatform/ui-slots';
import type { PanelDraft, PanelInstance, PanelModule } from '@workplatform/ui-slots/client';
import type {} from './desktop-ui-api.js';

/** 单次挂载记录的对象身份用于取消迟到的动态模块响应。 */
interface MountedPanel {
  entry: MainEntry;
  container: HTMLElement;
  instance: PanelInstance | undefined;
}

export default defineComponent({
  /** @returns 导航、路由、提示和插件挂载容器，供宿主模板绑定。 */
  setup() {
    const panels = ref<HTMLElement>();
    const settingsDialog = ref<HTMLDialogElement>();
    const message = ref('');
    const selected = ref('');
    const entries = shallowRef<SlotSnapshot['entries']>([]);
    const mounted = new Map<string, MountedPanel>();
    const drafts = new Map<string, PanelDraft>();
    let revision = -1;
    let unsubscribe: (() => void) | undefined;
    const navigation = computed(() => entries.value
      .filter((entry): entry is SidebarEntry => entry.name === 'sidebar.panellist' && mounted.has(entry.id))
      .sort((left, right) => left.order - right.order));

    /** @param error 插件加载或生命周期错误。@returns 无返回值，更新宿主提示。 */
    function showError(error: unknown): void {
      message.value = error instanceof Error ? error.message : String(error);
    }

    /** @returns 无返回值，打开原生设置对话框。 */
    function openSettings(): void {
      settingsDialog.value?.showModal();
    }

    /** @returns 无返回值，初始、未知或已卸载路由切换到侧栏首个页面，无页面时清空路由。 */
    function updateRoute(): void {
      let key: string;
      try { key = decodeURIComponent(location.hash.slice(1)); }
      catch { key = ''; }
      const firstPage = navigation.value[0];
      let fallback = firstPage ? firstPage.id : '';
      // 条件表达式等价于：firstPage 存在时取它的 id，否则先使用空字符串。
      if (!fallback) {
        for (const [id] of mounted) {
          // 解构等价于从每一组 [页面标识, 挂载记录] 中只读取第一个值。
          fallback = id;
          break;
        }
      }
      selected.value = mounted.has(key) ? key : fallback;
      // Map.has 来自 JavaScript，传入页面标识并返回是否已挂载，例如 has('tools') 为 true 时保留工具页。
      const hash = selected.value ? '#' + encodeURIComponent(selected.value) : '';
      // encodeURIComponent 来自 JavaScript，接收页面标识并返回 URL 编码；例如“工具”返回“%E5%B7%A5%E5%85%B7”。
      if (location.hash !== hash) location.hash = hash;
      for (const [id, panel] of mounted) panel.container.hidden = id !== selected.value;
    }

    /** @param entry 新注册的页面模块。@returns 模块加载和挂载完成后的 Promise。 */
    async function mountPanel(entry: MainEntry): Promise<void> {
      const container = document.createElement('section');
      container.dataset.panel = entry.key;
      container.hidden = true;
      container.textContent = '正在加载面板…';
      const record: MountedPanel = { entry, container, instance: undefined };
      mounted.set(entry.key, record);
      panels.value!.append(container);
      // 非空断言表示注册表订阅在宿主 onMounted 之后启动，容器已经存在。
      try {
        const module: { default: PanelModule } = await import(/* @vite-ignore */ entry.entry);
        if (mounted.get(entry.key) !== record) return;
        record.instance = module.default.mount(container, { client: window.desktopUi, draft: drafts.get(entry.key) });
        drafts.delete(entry.key);
      } catch (error) {
        if (mounted.get(entry.key) === record) container.textContent = '面板加载失败：' + (error instanceof Error ? error.message : String(error));
      }
    }

    /** @param snapshot 主进程最新完整注册表。@returns 无返回值，协调插件生命周期并更新导航状态。 */
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
      entries.value = snapshot.entries;
      updateRoute();
    }

    /** @param event 页面卸载事件。@returns 无返回值，由主进程统一确认未保存的插件修改。 */
    function protectDrafts(event: BeforeUnloadEvent): void {
      const dirty = Array.from(drafts.values()).some(draft => draft.dirty)
        || Array.from(mounted.values()).some(panel => panel.instance?.snapshot?.().dirty);
      if (dirty) event.preventDefault();
    }

    onMounted(() => {
      // 无入参、无返回值，模板就绪后启动桥接订阅及路由监听。
      window.addEventListener('hashchange', updateRoute);
      window.addEventListener('beforeunload', protectDrafts);
      unsubscribe = window.desktopUi.onChanged(renderSnapshot);
      void window.desktopUi.getSnapshot().then(renderSnapshot).catch(showError);
    });
    onBeforeUnmount(() => {
      // 无入参、无返回值，取消订阅并释放所有插件实例，失效迟到的加载任务。
      unsubscribe?.();
      window.removeEventListener('hashchange', updateRoute);
      window.removeEventListener('beforeunload', protectDrafts);
      for (const panel of mounted.values()) panel.instance?.dispose();
      mounted.clear();
    });
    return { panels, message, selected, navigation, settingsDialog, openSettings };
  }
});
