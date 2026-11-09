/**
 * @author Codex
 * @date 2026-11-09
 * Skills 页面：搜索与源码编辑、草稿保护和服务启停联动；内容始终按纯文本展示。
 */
import type { SkillDocument, SkillSummary } from './skills-manager.js';
import type { PanelContext, PanelInstance, PanelModule } from '@workplatform/ui-slots/client';
import type {} from './requests.js';
import { markup, styles } from './view.js';

/** 页面自己的暂存结构，宿主只按不透明数据保管。 */
interface SkillsDraft { current: SkillDocument | undefined; content: string; search: string; }

/** @param content 原始文件内容。@returns 与 textarea 一致的换行形式，BOM 由文件服务保留。 */
function editorText(content: string): string {
  return content.replace(/^\uFEFF/, '').replace(/\r\n|\r/g, '\n');
}

/** @param container 宿主分配的容器。@param context 注入的请求接口和草稿。@returns 页面生命周期。 */
function mount(container: HTMLElement, context: PanelContext): PanelInstance {
  // 模板和样式都是插件内静态常量；所有文件内容仍以 textContent/value 写入。
  container.innerHTML = markup;
  const stylesheet = new CSSStyleSheet();
  stylesheet.replaceSync(styles);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
  const list = container.querySelector<HTMLUListElement>('#skill-list')!;
  const search = container.querySelector<HTMLInputElement>('#skill-search')!;
  const count = container.querySelector<HTMLElement>('#skills-count')!;
  const message = container.querySelector<HTMLElement>('#skills-message')!;
  const refresh = container.querySelector<HTMLButtonElement>('#refresh-skills')!;
  const form = container.querySelector<HTMLElement>('#skill-editor-form')!;
  const empty = container.querySelector<HTMLElement>('#skill-empty')!;
  const name = container.querySelector<HTMLElement>('#skill-name')!;
  const path = container.querySelector<HTMLElement>('#skill-path')!;
  const editor = container.querySelector<HTMLTextAreaElement>('#skill-content')!;
  const save = container.querySelector<HTMLButtonElement>('#save-skill')!;
  const reload = container.querySelector<HTMLButtonElement>('#reload-skill')!;
  const dirtyLabel = container.querySelector<HTMLElement>('#skill-dirty')!;
  const api = context.client;
  let available = true;
  let skills: SkillSummary[] = [];
  let current: SkillDocument | undefined;
  let selectedId: string | undefined;
  let reading = false;
  let saving = false;
  let refreshing = false;
  let request = 0;
  let scanRequest = 0;

  /** @returns 编辑区是否有尚未保存的修改。 */
  function isDirty(): boolean { return current !== undefined && editor.value !== editorText(current.content); }

  /** @returns 无返回值，刷新控件可用性和草稿标记。 */
  function updateControls(): void {
    form.hidden = current === undefined;
    empty.hidden = current !== undefined;
    editor.disabled = !available || reading || saving;
    save.disabled = !available || !isDirty() || reading || saving;
    reload.disabled = !available || !current || reading || saving;
    refresh.disabled = !available || refreshing || saving;
    dirtyLabel.textContent = saving ? '正在保存…' : isDirty() ? '有未保存修改' : '已与文件同步';
    for (const button of list.querySelectorAll<HTMLButtonElement>('button')) button.disabled = !available || saving;
  }

  /** @param error 操作错误。@returns 无返回值，显示失败原因并保留草稿。 */
  function showError(error: unknown): void {
    message.textContent = error instanceof Error ? error.message : String(error);
  }

  /** @returns 是否可放弃当前修改；用户取消时不会改变编辑内容。 */
  function canDiscard(): boolean {
    return !isDirty() || window.confirm('当前技能有未保存修改，是否放弃修改并继续？');
  }

  /** @param document 已读取或保存的文件。@returns 无返回值，将文件同步到编辑区。 */
  function displayDocument(document: SkillDocument): void {
    current = document;
    selectedId = document.id;
    editor.value = editorText(document.content);
    name.textContent = skills.find(skill => skill.id === document.id)?.name || 'SKILL.md';
    path.textContent = document.path;
  }

  /** @param id 技能标识。@param force 是否强制重读当前技能。@returns 读取及页面更新完成后的 Promise。 */
  async function selectSkill(id: string, force = false): Promise<void> {
    if (!available || saving || (!force && current?.id === id && !reading)) return;
    if (!canDiscard()) return;
    const token = ++request;
    selectedId = id;
    reading = true;
    message.textContent = '正在读取技能…';
    renderList();
    updateControls();
    try {
      const document = await api.invoke('skills-manager:read', id);
      if (token !== request || !available) return;
      displayDocument(document);
      message.textContent = '';
    } catch (error) {
      if (token !== request || !available) return;
      selectedId = current?.id;
      showError(error);
    } finally {
      if (token === request) {
        reading = false;
        renderList();
        updateControls();
      }
    }
  }

  /** @returns 无返回值，按名称、描述、来源路径筛选并绘制纯文本列表。 */
  function renderList(): void {
    const query = search.value.trim().toLocaleLowerCase();
    const filtered = skills.filter(skill => (skill.name + '\n' + skill.description + '\n' + skill.path).toLocaleLowerCase().includes(query));
    count.textContent = skills.length === 0 ? '暂无用户技能。' : filtered.length + ' / ' + skills.length + ' 个技能';
    if (skills.length > 0 && filtered.length === 0) count.textContent = '没有匹配的技能。';
    list.replaceChildren();
    for (const skill of filtered) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'skill-choice';
      button.setAttribute('aria-pressed', String(skill.id === selectedId));
      const title = document.createElement('strong');
      title.textContent = skill.name;
      const description = document.createElement('span');
      description.textContent = skill.description || '暂无描述';
      const source = document.createElement('span');
      source.textContent = (skill.source === 'codex' ? 'Codex' : 'Agents') + ' · ' + skill.path;
      button.append(title, description, source);
      if (skill.status !== 'ready') {
        const error = document.createElement('span');
        error.textContent = (skill.status === 'invalid' ? '元数据需修复：' : '读取失败：') + skill.error;
        button.append(error);
      }
      button.disabled = !available || saving;
      button.addEventListener('click', () => { void selectSkill(skill.id); });
      item.append(button);
      list.append(item);
    }
  }

  /** @returns 列表刷新完成的 Promise；保留当前原文版本和编辑草稿。 */
  async function refreshSkills(): Promise<void> {
    if (!available) return;
    const token = ++scanRequest;
    refreshing = true;
    updateControls();
    message.textContent = '正在扫描用户技能…';
    try {
      const result = await api.invoke('skills-manager:list');
      if (token !== scanRequest || !available) return;
      skills = result.skills;
      renderList();
      message.textContent = result.errors.join('\n');
      if (current && !skills.some(skill => skill.id === current!.id)) {
        message.textContent += '\n当前技能已不在列表中，编辑内容已保留。';
      }
      if (current) name.textContent = skills.find(skill => skill.id === current!.id)?.name || 'SKILL.md';
    } catch (error) {
      if (token === scanRequest && available) showError(error);
    } finally {
      if (token === scanRequest) {
        refreshing = false;
        updateControls();
      }
    }
  }

  /** @returns 保存完成后的 Promise；失败不会替换当前源码或版本。 */
  async function saveSkill(): Promise<void> {
    if (!available || !current || saving || reading || !isDirty()) return;
    saving = true;
    updateControls();
    message.textContent = '正在保存…';
    try {
      const saved = await api.invoke('skills-manager:save', current.id, editor.value, current.revision);
      if (!available) return;
      displayDocument(saved);
      if (available) {
        await refreshSkills();
        message.textContent = '已保存；若 Codex 未显示更新，可重启 Codex。';
      }
    } catch (error) {
      showError(error);
    } finally {
      saving = false;
      updateControls();
    }
  }

  const listeners = new AbortController();
  editor.addEventListener('input', updateControls, { signal: listeners.signal });
  search.addEventListener('input', renderList, { signal: listeners.signal });
  refresh.addEventListener('click', () => { void refreshSkills(); }, { signal: listeners.signal });
  reload.addEventListener('click', () => { if (current) void selectSkill(current.id, true); }, { signal: listeners.signal });
  save.addEventListener('click', () => { void saveSkill(); }, { signal: listeners.signal });
  const draft = context.draft?.value as SkillsDraft | undefined;
  if (draft) {
    search.value = draft.search;
    if (draft.current) {
      displayDocument(draft.current);
      editor.value = draft.content;
    }
  }
  updateControls();
  void refreshSkills();
  return {
    /** @returns 文件版本、编辑内容和搜索条件，卸载后由宿主保管。 */
    snapshot() { return { dirty: isDirty() || saving, value: { current, content: editor.value, search: search.value } satisfies SkillsDraft }; },
    /** @returns 无返回值，使页面异步任务失效并移除事件。 */
    dispose() {
      available = false;
      ++request;
      ++scanRequest;
      listeners.abort();
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(sheet => sheet !== stylesheet);
    }
  };
}

export default { mount } satisfies PanelModule;
