/**
 * @author Codex
 * @date 2026-11-10
 * 工具 Vue 状态：维护表单与分类筛选，通过插件接口持久化工具，失败保留输入。
 */
import { computed, defineComponent, onBeforeUnmount, ref, shallowRef, type PropType } from 'vue';
import type { PanelContext } from '@workplatform/ui-slots/client';
import type { Tool } from './store.js';
import type {} from './index.js';

export default defineComponent({
  props: { context: { type: Object as PropType<PanelContext>, required: true } },
  /** @param props 宿主请求接口。@returns 工具列表、表单状态和用户操作。 */
  setup(props) {
    const tools = shallowRef<Tool[]>([]);
    const editing = ref('');
    const name = ref('');
    const url = ref('');
    const category = ref('');
    const filter = ref('');
    const message = ref('');
    const busy = ref(false);
    const nameInput = ref<HTMLInputElement>();
    let active = true;
    const categories = computed(() => [...new Set(tools.value.map(tool => tool.category))]);
    // 等价于遍历 tools，把 category 加入 Set 去重，再把 Set 转为数组。
    const filtered = computed(() => tools.value.filter(tool => !filter.value || tool.category === filter.value));

    /** @param error 请求失败原因。@returns 无返回值，保留输入并展示错误。 */
    function showError(error: unknown): void {
      if (active) message.value = error instanceof Error ? error.message : String(error);
    }

    /** @returns 无返回值，清空编辑内容并恢复新增状态。 */
    function resetEditor(): void {
      editing.value = name.value = url.value = category.value = '';
    }

    /** @param action 列表或写入请求。@param success 成功提示。@returns 请求和状态更新完成后的 Promise。 */
    async function execute(action: () => Promise<Tool[]>, success: string): Promise<void> {
      if (busy.value) return;
      busy.value = true;
      message.value = '处理中…';
      try {
        const result = await action();
        if (!active) return;
        tools.value = result;
        if (!categories.value.includes(filter.value)) filter.value = '';
        message.value = success;
      } catch (error) { showError(error); }
      finally { busy.value = false; }
    }

    /** @returns 保存完成后的 Promise，成功后清空表单。 */
    async function saveTool(): Promise<void> {
      await execute(async () => {
        const result = await props.context.client.invoke('tools:save', {
          id: editing.value, name: name.value, url: url.value, category: category.value
        });
        if (active) resetEditor();
        return result;
      }, '已保存');
    }

    /** @returns 读取并展示最新工具列表后的 Promise。 */
    function refreshTools(): Promise<void> {
      return execute(() => props.context.client.invoke('tools:list'), '');
    }

    /** @param tool 当前工具。@returns 无返回值，将工具复制到编辑表单。 */
    function editTool(tool: Tool): void {
      if (busy.value) return;
      editing.value = tool.id;
      name.value = tool.name;
      url.value = tool.url;
      category.value = tool.category;
      nameInput.value?.focus();
    }

    /** @param tool 当前工具。@returns 无返回值，在系统浏览器打开工具网址。 */
    function openTool(tool: Tool): void {
      if (!busy.value) void props.context.client.invoke('tools:open', tool.id).catch(showError);
    }

    /** @param tool 待删除工具。@returns 确认并删除完成后的 Promise。 */
    async function removeTool(tool: Tool): Promise<void> {
      if (busy.value || !window.confirm('删除“' + tool.name + '”？')) return;
      await execute(async () => {
        const result = await props.context.client.invoke('tools:remove', tool.id);
        if (active && editing.value === tool.id) resetEditor();
        return result;
      }, '已删除');
    }

    onBeforeUnmount(() => {
      // 无入参、无返回值，卸载后停止写入页面状态。
      active = false;
    });
    void refreshTools();
    return { editing, name, url, category, filter, message, busy, nameInput, categories, filtered,
      resetEditor, saveTool, refreshTools, editTool, openTool, removeTool };
  }
});
