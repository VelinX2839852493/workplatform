<!--
  @author Codex
  @date 2026-11-10
  宿主模板：声明插件导航、面板容器和设置对话框，由 shell.ts 提供状态与生命周期。
-->
<template>
  <aside aria-label="主侧栏">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2" fill="currentColor"/><rect x="14" y="3" width="7" height="7" rx="2" fill="currentColor" opacity=".5"/><rect x="3" y="14" width="7" height="7" rx="2" fill="currentColor" opacity=".5"/><rect x="14" y="14" width="7" height="7" rx="2" fill="currentColor"/></svg>
      <span>Workplatform</span>
    </div>
    <nav aria-label="主导航">
      <div id="plugin-navigation">
        <p v-for="entry in navigation" :key="entry.id">
          <a :href="'#' + encodeURIComponent(entry.id)" :aria-current="selected === entry.id ? 'page' : undefined"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M10 10v10"/></svg>{{ entry.label }}</a>
          <!-- encodeURIComponent 来自 JavaScript：将页面标识编码为 URL 片段，例如“我的工具”转换为百分号编码，返回编码后的字符串。 -->
        </p>
      </div>
    </nav>
    <div class="sidebar-footer">
      <button type="button" aria-haspopup="dialog" @click="openSettings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5" fill="var(--wp-sidebar)"/><circle cx="15" cy="17" r="2.5" fill="var(--wp-sidebar)"/></svg>设置</button>
      <!-- command="show-modal" 等价于通过点击事件调用 settingsDialog.showModal()。 -->
    </div>
  </aside>
  <main>
    <p v-if="!selected" class="empty-state" role="status">暂无已启用的页面。</p>
    <p id="shell-message" role="status" aria-live="polite">{{ message }}</p>
    <div id="plugin-panels" ref="panels"></div>
  </main>
  <dialog id="settings-dialog" ref="settingsDialog" aria-labelledby="settings-title" aria-describedby="settings-description" closedby="any">
    <h2 id="settings-title">设置</h2>
    <p id="settings-description">暂无可配置项。</p>
    <form method="dialog"><button class="button-primary" type="submit" autofocus>关闭</button></form>
  </dialog>
</template>

<script lang="ts" src="./shell.ts"></script>
