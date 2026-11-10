<!--
  @author Codex
  @date 2026-11-10
  宿主模板：声明导航、工作台、插件容器和设置对话框，由 shell.ts 提供状态与生命周期。
-->
<template>
  <aside aria-label="主侧栏">
    <p>Workplatform</p>
    <nav aria-label="主导航">
      <a href="#workspace" :aria-current="selected === 'workspace' ? 'page' : undefined">工作台</a>
      <div id="plugin-navigation">
        <p v-for="entry in navigation" :key="entry.id">
          <a :href="'#' + encodeURIComponent(entry.id)" :aria-current="selected === entry.id ? 'page' : undefined">{{ entry.label }}</a>
        </p>
      </div>
    </nav>
    <div class="sidebar-footer">
      <button type="button" aria-haspopup="dialog" @click="openSettings">设置</button>
      <!-- command="show-modal" 等价于通过点击事件调用 settingsDialog.showModal()。 -->
    </div>
  </aside>
  <main>
    <section id="workspace" :hidden="selected !== 'workspace'"><h1>工作台</h1></section>
    <p id="shell-message" role="status" aria-live="polite">{{ message }}</p>
    <div id="plugin-panels" ref="panels"></div>
  </main>
  <dialog id="settings-dialog" ref="settingsDialog" aria-labelledby="settings-title" aria-describedby="settings-description" closedby="any">
    <h2 id="settings-title">设置</h2>
    <p id="settings-description">暂无可配置项。</p>
    <form method="dialog"><button type="submit" autofocus>关闭</button></form>
  </dialog>
</template>

<script lang="ts" src="./shell.ts"></script>
