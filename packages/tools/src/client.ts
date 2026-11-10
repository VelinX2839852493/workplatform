/**
 * @author Codex
 * @date 2026-11-09
 * 工具页面：原生表单完成增改，分类筛选列表，通过插件请求删除或打开网页。
 */
import type { PanelContext, PanelInstance, PanelModule } from '@workplatform/ui-slots/client';
import type { Tool } from './store.js';
import type {} from './index.js';

/** @param container 宿主面板。@param context 有限请求接口。@returns 页面生命周期。 */
function mount(container: HTMLElement, context: PanelContext): PanelInstance {
  container.innerHTML = `<h1>工具</h1><p>收藏常用网址，点击名字打开网页。</p>
    <form id="tool-form"><fieldset><legend id="tool-editor-title">新增工具</legend>
      <label>名字 <input name="name" required></label>
      <label>网址 <input name="url" type="url" placeholder="https://example.com" required></label>
      <label>分类 <input name="category" list="tool-categories" placeholder="未分类"></label>
      <datalist id="tool-categories"></datalist>
      <div><button type="submit">保存</button> <button type="reset">取消编辑</button></div>
    </fieldset></form>
    <p><label>分类筛选 <select id="tool-filter"><option value="">全部分类</option></select></label>
      <button id="tool-refresh" type="button">刷新列表</button></p>
    <p id="tool-message" role="status" aria-live="polite"></p>
    <ul id="tool-list"></ul>`;
  const form = container.querySelector<HTMLFormElement>('#tool-form')!;
  const fields = form.querySelector<HTMLFieldSetElement>('fieldset')!;
  const title = container.querySelector<HTMLElement>('#tool-editor-title')!;
  const name = form.elements.namedItem('name') as HTMLInputElement;
  const url = form.elements.namedItem('url') as HTMLInputElement;
  const category = form.elements.namedItem('category') as HTMLInputElement;
  const filter = container.querySelector<HTMLSelectElement>('#tool-filter')!;
  const categories = container.querySelector<HTMLDataListElement>('#tool-categories')!;
  const refresh = container.querySelector<HTMLButtonElement>('#tool-refresh')!;
  const list = container.querySelector<HTMLUListElement>('#tool-list')!;
  const message = container.querySelector<HTMLElement>('#tool-message')!;
  // 非空断言表示上述元素由静态模板提供。
  const stylesheet = new CSSStyleSheet();
  stylesheet.replaceSync(`
    #tool-form fieldset { display:flex; flex-wrap:wrap; align-items:end; gap:12px; margin:0; }
    #tool-form label { display:grid; gap:4px; flex:1 1 140px; min-width:0; }
    #tool-form input { box-sizing:border-box; width:100%; }
    #tool-list { padding:0; list-style:none; }
    #tool-list li { display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #ddd; }
    #tool-list a { flex:1 1 120px; overflow-wrap:anywhere; }
    #tool-list span { color:#555; }
  `);
  document.adoptedStyleSheets.push(stylesheet);
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let tools: Tool[] = [];
  let editing = '';
  let active = true;
  let busy = false;

  /** @param error 请求失败原因。@returns 无返回值，保留输入并展示错误。 */
  function showError(error: unknown): void {
    if (active) message.textContent = error instanceof Error ? error.message : String(error);
  }

  /** @returns 无返回值，更新分类选项与当前分类下的工具，动态内容仅用纯文本。 */
  function render(): void {
    const selected = filter.value;
    filter.replaceChildren(new Option('全部分类', ''));
    categories.replaceChildren();
    const names = new Set(tools.map(tool => tool.category));
    // 等价于遍历工具，把每个 category 加入 Set，重复分类只保留一次。
    for (const value of names) {
      filter.add(new Option(value, value));
      categories.append(new Option(value, value));
    }
    filter.value = names.has(selected) ? selected : '';
    list.replaceChildren();
    for (const tool of tools) {
      if (filter.value && tool.category !== filter.value) continue;
      const row = document.createElement('li');
      row.dataset.id = tool.id;
      const link = document.createElement('a');
      link.href = tool.url;
      link.textContent = tool.name;
      const label = document.createElement('span');
      label.textContent = tool.category;
      row.append(link, label);
      for (const action of ['编辑', '删除']) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action;
        button.dataset.action = action;
        button.setAttribute('aria-label', action + ' ' + tool.name);
        row.append(button);
      }
      list.append(row);
    }
    if (!list.children.length) list.textContent = '暂无工具，在上方填写并保存。';
  }

  /** @param action 列表或写入请求。@param success 成功提示。@returns 请求和渲染完成后的 Promise。 */
  async function execute(action: () => Promise<Tool[]>, success: string): Promise<void> {
    if (busy) return;
    busy = true;
    fields.disabled = refresh.disabled = true;
    message.textContent = '处理中…';
    try {
      const result = await action();
      if (!active) return;
      tools = result;
      render();
      message.textContent = success;
    } catch (error) { showError(error); }
    finally { busy = false; fields.disabled = refresh.disabled = false; }
  }

  form.addEventListener('reset', () => {
    // 无入参、无返回值，恢复新增状态；浏览器随后重置输入。
    editing = '';
    title.textContent = '新增工具';
  }, options);
  form.addEventListener('submit', event => {
    // @param event 表单提交。@returns 无返回值，写入成功才清空表单。
    event.preventDefault();
    void execute(async () => {
      const result = await context.client.invoke('tools:save', { id: editing, name: name.value, url: url.value, category: category.value });
      if (active) form.reset();
      return result;
    }, '已保存');
  }, options);
  filter.addEventListener('change', render, options);
  refresh.addEventListener('click', () => { void execute(() => context.client.invoke('tools:list'), ''); }, options);
  list.addEventListener('click', event => {
    // @param event 列表点击。@returns 无返回值，事件委托避免每次渲染重新绑定监听。
    const target = (event.target as Element).closest<HTMLElement>('a, button');
    if (!target) return;
    event.preventDefault();
    if (busy) return;
    const tool = tools.find(item => item.id === target.closest('li')?.dataset.id);
    if (!tool) return;
    if (target.tagName === 'A') void context.client.invoke('tools:open', tool.id).catch(showError);
    else if (target.dataset.action === '编辑') {
      editing = tool.id;
      name.value = tool.name;
      url.value = tool.url;
      category.value = tool.category;
      title.textContent = '编辑工具';
      name.focus();
    } else if (window.confirm('删除“' + tool.name + '”？')) {
      void execute(async () => {
        const result = await context.client.invoke('tools:remove', tool.id);
        if (active && editing === tool.id) form.reset();
        return result;
      }, '已删除');
    }
  }, options);
  void execute(() => context.client.invoke('tools:list'), '');
  return {
    /** @returns 无返回值，移除页面监听及插件样式。 */
    dispose() {
      active = false;
      listeners.abort();
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(sheet => sheet !== stylesheet);
    }
  };
}

export default { mount } satisfies PanelModule;
