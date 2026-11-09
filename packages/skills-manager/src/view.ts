/**
 * @author Codex
 * @date 2026-11-09
 * Skills 插件拥有的静态页面与布局，不向宿主 HTML 或样式表写入业务代码。
 */
export const markup = `
  <h1>Skills 管理</h1>
  <p>编辑本机用户技能的 SKILL.md。</p>
  <div class="skills-toolbar">
    <label for="skill-search">搜索技能</label>
    <input id="skill-search" type="search" placeholder="名称、描述或路径">
    <button id="refresh-skills" type="button">刷新列表</button>
  </div>
  <p id="skills-message" role="status" aria-live="polite"></p>
  <div class="skills-layout">
    <div><p id="skills-count"></p><ul id="skill-list" aria-label="用户技能"></ul></div>
    <div class="skill-editor-panel">
      <p id="skill-empty">选择一个技能以编辑 SKILL.md。</p>
      <div id="skill-editor-form" hidden>
        <h2 id="skill-name"></h2><p id="skill-path" class="skill-path"></p>
        <label for="skill-content">SKILL.md 源码</label>
        <textarea id="skill-content" spellcheck="false" wrap="off" aria-describedby="skill-path"></textarea>
        <div class="skills-toolbar">
          <button id="save-skill" type="button" disabled>保存</button>
          <button id="reload-skill" type="button">重新读取</button>
          <span id="skill-dirty" role="status"></span>
        </div>
      </div>
    </div>
  </div>`;

export const styles = `
[data-panel="skills-manager"] .skills-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
[data-panel="skills-manager"] .skills-layout { display: grid; grid-template-columns: minmax(180px, 30%) minmax(0, 1fr); gap: 16px; }
#skill-list { list-style: none; margin: 0; padding: 0; max-height: 65vh; overflow: auto; }
#skill-list li { margin-bottom: 8px; }
#skill-list .skill-choice { display: block; width: 100%; text-align: left; overflow-wrap: anywhere; }
#skill-list .skill-choice[aria-pressed="true"] { outline: 2px solid Highlight; outline-offset: -2px; }
#skill-list .skill-choice strong, #skill-list .skill-choice span { display: block; margin: 4px 0; }
[data-panel="skills-manager"] .skill-path { overflow-wrap: anywhere; }
#skill-name { margin-top: 0; }
#skills-message { white-space: pre-line; }
#skill-content { display: block; box-sizing: border-box; width: 100%; min-height: 340px; height: 52vh; margin: 8px 0; font: 13px/1.5 Consolas, monospace; tab-size: 2; resize: vertical; }
#skill-content:focus-visible, #skill-list .skill-choice:focus-visible { outline: 2px solid Highlight; }
@media (max-width: 760px) {
  [data-panel="skills-manager"] .skills-layout { grid-template-columns: minmax(0, 1fr); }
  #skill-list { max-height: 200px; }
}`;
