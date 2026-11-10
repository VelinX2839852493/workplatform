<!--
  @author Codex
  @date 2026-11-10
  Skills 模板：声明搜索、技能列表和源码编辑器，所有文件内容通过文本绑定显示。
-->
<template>
  <header class="page-heading">
    <div><h1>Skills 管理</h1><p>编辑本机用户技能的 SKILL.md。</p></div>
    <button id="refresh-skills" type="button" :disabled="refreshing || saving" @click="refreshSkills">刷新列表</button>
  </header>
  <div class="skills-toolbar skills-search">
    <label for="skill-search">搜索技能</label>
    <input id="skill-search" v-model="search" type="search" placeholder="名称、描述或路径">
  </div>
  <p id="skills-message" role="status" aria-live="polite">{{ message }}</p>
  <div class="skills-layout">
    <div>
      <p id="skills-count">{{ count }}</p>
      <ul id="skill-list" aria-label="用户技能">
        <li v-for="skill in filtered" :key="skill.id">
          <button type="button" class="skill-choice" :aria-pressed="skill.id === selectedId" :disabled="saving" @click="selectSkill(skill.id)">
            <strong>{{ skill.name }}</strong><span class="skill-description">{{ skill.description || '暂无描述' }}</span>
            <span class="skill-source" :title="skill.path">{{ skill.source === 'codex' ? 'Codex' : 'Agents' }} · {{ skill.path }}</span>
            <span v-if="skill.status !== 'ready'">{{ skill.status === 'invalid' ? '元数据需修复：' : '读取失败：' }}{{ skill.error }}</span>
          </button>
        </li>
      </ul>
    </div>
    <div class="skill-editor-panel">
      <p id="skill-empty" :hidden="current !== undefined">选择一个技能以编辑 SKILL.md。</p>
      <div id="skill-editor-form" :hidden="current === undefined">
        <h2 id="skill-name">{{ name }}</h2><p id="skill-path" class="skill-path">{{ current?.path }}</p>
        <!-- current?.path 等价于：current 存在时显示 current.path，否则不显示路径。 -->
        <label for="skill-content">SKILL.md 源码</label>
        <textarea id="skill-content" v-model="content" :disabled="reading || saving" spellcheck="false" wrap="off" aria-describedby="skill-path"></textarea>
        <div class="skills-toolbar">
          <button id="save-skill" class="button-primary" type="button" :disabled="!dirty || reading || saving" @click="saveSkill">保存</button>
          <button id="reload-skill" type="button" :disabled="!current || reading || saving" @click="reloadSkill">重新读取</button>
          <span id="skill-dirty" role="status">{{ saving ? '正在保存…' : dirty ? '有未保存修改' : '已与文件同步' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" src="./view.ts"></script>
