/**
 * @author Codex
 * @date 2026-11-10
 * 插件市场 Vue 状态：通过有限请求读取列表、切换插件，并忽略卸载后的异步响应。
 */
import { defineComponent, onBeforeUnmount, ref, shallowRef, type PropType } from 'vue';
import type { PluginSummary } from '@workplatform/app-boot';
import type { PanelContext } from '@workplatform/ui-slots/client';
import type {} from './requests.js';

const labels: Record<PluginSummary['state'], string> = {
  loaded: '已加载', waiting: '等待依赖', loading: '处理中', failed: '加载失败', closed: '已关闭'
};

export default defineComponent({
  props: { context: { type: Object as PropType<PanelContext>, required: true } },
  /** @param props 宿主注入的请求接口。@returns 模板使用的列表、状态和操作。 */
  setup(props) {
    const plugins = shallowRef<PluginSummary[]>([]);
    const message = ref('');
    const refreshing = ref(false);
    const pending = ref(new Set<string>());
    let active = true;
    let generation = 0;

    /** @param result 最新插件状态。@returns 无返回值，更新列表和空状态。 */
    function display(result: PluginSummary[]): void {
      plugins.value = result;
      message.value = result.length === 0 ? '暂无已配置插件。' : '';
    }

    /** @returns 刷新完成后的 Promise，丢弃较旧查询响应。 */
    async function refreshPlugins(): Promise<void> {
      const token = ++generation;
      refreshing.value = true;
      message.value = '正在读取插件列表…';
      try {
        const result = await props.context.client.invoke('plugin-market:list');
        if (active && token === generation) display(result);
      } catch (error) {
        if (active && token === generation) message.value = error instanceof Error ? error.message : String(error);
      } finally {
        if (active && token === generation) refreshing.value = false;
      }
    }

    /** @param plugin 需要启停的插件。@returns 操作和状态刷新完成后的 Promise。 */
    async function togglePlugin(plugin: PluginSummary): Promise<void> {
      pending.value.add(plugin.id);
      const token = ++generation;
      refreshing.value = false;
      try {
        const result = await props.context.client.invoke('plugin-market:set-enabled', plugin.id, plugin.state === 'closed');
        if (active && token === generation) display(result);
      } catch (error) {
        if (!active) return;
        await refreshPlugins();
        if (active) message.value = error instanceof Error ? error.message : String(error);
      } finally {
        pending.value.delete(plugin.id);
      }
    }

    onBeforeUnmount(() => {
      // 无入参、无返回值，卸载后停止写入页面状态。
      active = false;
      ++generation;
    });
    void refreshPlugins();
    return { plugins, message, refreshing, pending, labels, refreshPlugins, togglePlugin };
  }
});
