/**
 * @author Codex
 * @date 2026-11-10
 * Skills Vue 状态：维护搜索、源码编辑和版本，保护草稿并在插件卸载后使异步请求失效。
 */
import { computed, defineComponent, onBeforeUnmount, ref, shallowRef, type PropType } from 'vue';
import type { SkillDocument, SkillSummary } from './skills-manager.js';
import type { PanelContext, PanelDraft } from '@workplatform/ui-slots/client';
import type {} from './requests.js';

/** 页面自己的暂存结构，宿主只按不透明数据保管。 */
interface SkillsDraft { current: SkillDocument | undefined; content: string; search: string; }

/** @param content 原始文件内容。@returns 与 textarea 一致的换行形式，BOM 由文件服务保留。 */
function editorText(content: string): string {
  return content.replace(/^\uFEFF/, '').replace(/\r\n|\r/g, '\n');
}

export default defineComponent({
  props: { context: { type: Object as PropType<PanelContext>, required: true } },
  /** @param props 宿主注入的请求接口和草稿。@returns 编辑状态、操作及草稿快照。 */
  setup(props) {
    const draft = props.context.draft?.value as SkillsDraft | undefined;
    const skills = shallowRef<SkillSummary[]>([]);
    const current = shallowRef<SkillDocument | undefined>(draft?.current);
    const selectedId = ref(draft?.current?.id);
    const content = ref(draft?.current ? draft.content : '');
    const search = ref(draft?.search || '');
    const message = ref('');
    const reading = ref(false);
    const saving = ref(false);
    const refreshing = ref(false);
    let available = true;
    let request = 0;
    let scanRequest = 0;
    const dirty = computed(() => current.value !== undefined && content.value !== editorText(current.value.content));
    const name = computed(() => skills.value.find(skill => skill.id === current.value?.id)?.name || 'SKILL.md');
    const filtered = computed(() => {
      const query = search.value.trim().toLocaleLowerCase();
      return skills.value.filter(skill => (skill.name + '\n' + skill.description + '\n' + skill.path).toLocaleLowerCase().includes(query));
    });
    const count = computed(() => {
      if (skills.value.length === 0) return '暂无用户技能。';
      if (filtered.value.length === 0) return '没有匹配的技能。';
      return filtered.value.length + ' / ' + skills.value.length + ' 个技能';
    });

    /** @param error 操作错误。@returns 无返回值，显示失败原因并保留草稿。 */
    function showError(error: unknown): void {
      if (available) message.value = error instanceof Error ? error.message : String(error);
    }

    /** @returns 是否可放弃当前修改；用户取消时不会改变编辑内容。 */
    function canDiscard(): boolean {
      return !dirty.value || window.confirm('当前技能有未保存修改，是否放弃修改并继续？');
    }

    /** @param document 已读取或保存的文件。@returns 无返回值，将文件同步到编辑区。 */
    function displayDocument(document: SkillDocument): void {
      current.value = document;
      selectedId.value = document.id;
      content.value = editorText(document.content);
    }

    /** @param id 技能标识。@param force 是否强制重读当前技能。@returns 读取及状态更新完成后的 Promise。 */
    async function selectSkill(id: string, force = false): Promise<void> {
      if (!available || saving.value || (!force && current.value?.id === id && !reading.value)) return;
      if (!canDiscard()) return;
      const token = ++request;
      selectedId.value = id;
      reading.value = true;
      message.value = '正在读取技能…';
      try {
        const document = await props.context.client.invoke('skills-manager:read', id);
        if (token !== request || !available) return;
        displayDocument(document);
        message.value = '';
      } catch (error) {
        if (token !== request || !available) return;
        selectedId.value = current.value?.id;
        showError(error);
      } finally {
        if (token === request) reading.value = false;
      }
    }

    /** @returns 列表刷新完成的 Promise；保留当前原文版本和编辑草稿。 */
    async function refreshSkills(): Promise<void> {
      if (!available) return;
      const token = ++scanRequest;
      refreshing.value = true;
      message.value = '正在扫描用户技能…';
      try {
        const result = await props.context.client.invoke('skills-manager:list');
        if (token !== scanRequest || !available) return;
        skills.value = result.skills;
        message.value = result.errors.join('\n');
        if (current.value && !skills.value.some(skill => skill.id === current.value?.id)) {
          message.value += '\n当前技能已不在列表中，编辑内容已保留。';
        }
      } catch (error) {
        if (token === scanRequest) showError(error);
      } finally {
        if (token === scanRequest) refreshing.value = false;
      }
    }

    /** @returns 保存完成后的 Promise；失败不会替换当前源码或版本。 */
    async function saveSkill(): Promise<void> {
      if (!available || !current.value || saving.value || reading.value || !dirty.value) return;
      saving.value = true;
      message.value = '正在保存…';
      try {
        const saved = await props.context.client.invoke('skills-manager:save', current.value.id, content.value, current.value.revision);
        if (!available) return;
        displayDocument(saved);
        await refreshSkills();
        if (available) message.value = '已保存；若 Codex 未显示更新，可重启 Codex。';
      } catch (error) { showError(error); }
      finally { saving.value = false; }
    }

    /** @returns 无返回值，确认草稿后重新读取当前文件。 */
    function reloadSkill(): void {
      if (current.value) void selectSkill(current.value.id, true);
    }

    /** @returns 文件版本、编辑内容和搜索条件，卸载后由宿主保管。 */
    function snapshot(): PanelDraft {
      return { dirty: dirty.value || saving.value,
        value: { current: current.value, content: content.value, search: search.value } satisfies SkillsDraft };
    }

    onBeforeUnmount(() => {
      // 无入参、无返回值，失效晚到的读取和扫描响应。
      available = false;
      ++request;
      ++scanRequest;
    });
    void refreshSkills();
    return { current, selectedId, content, search, message, reading, saving, refreshing, dirty, name,
      filtered, count, selectSkill, refreshSkills, saveSkill, reloadSkill, snapshot };
  }
});
