<!--
  @author Codex
  @date 2026-11-10
  插件市场模板：声明插件表格与操作控件，由 view.ts 提供查询和启停逻辑。
-->
<template>
  <header class="page-heading">
    <div><h1>插件市场</h1><p>管理本地配置的插件，无需重启应用。</p></div>
    <button id="refresh-plugins" type="button" :disabled="refreshing" @click="refreshPlugins">刷新列表</button>
  </header>
  <p id="market-message" role="status" aria-live="polite">{{ message }}</p>
  <table id="plugin-table" :hidden="plugins.length === 0">
    <thead><tr><th scope="col">插件</th><th scope="col">标识</th><th scope="col">状态</th><th scope="col">操作</th></tr></thead>
    <tbody id="plugin-list">
      <tr v-for="plugin in plugins" :key="plugin.id">
        <td>{{ plugin.name }}</td><td>{{ plugin.id }}</td><td><span class="status-badge" :class="{ 'tone-positive': plugin.state === 'loaded', 'tone-warning': plugin.state === 'waiting' || plugin.state === 'loading', 'tone-danger': plugin.state === 'failed' }">{{ labels[plugin.state] }}</span></td>
        <!-- Vue 的对象式 class 绑定：条件为 true 时添加对应样式类，例如已加载的插件添加 tone-positive。 -->
        <td><button class="button-compact" type="button" :aria-label="(plugin.state === 'closed' ? '加载 ' : '关闭 ') + plugin.name"
          :disabled="plugin.state === 'loading' || pending.has(plugin.id)" @click="togglePlugin(plugin)">
          {{ plugin.state === 'closed' ? '加载' : '关闭' }}
        </button></td>
      </tr>
    </tbody>
  </table>
</template>

<script lang="ts" src="./view.ts"></script>
