<!--
  @author Codex
  @date 2026-11-10
  插件市场模板：声明插件表格与操作控件，由 view.ts 提供查询和启停逻辑。
-->
<template>
  <h1>插件市场</h1>
  <p>管理本地配置的插件，无需重启应用。</p>
  <button id="refresh-plugins" type="button" :disabled="refreshing" @click="refreshPlugins">刷新列表</button>
  <p id="market-message" role="status" aria-live="polite">{{ message }}</p>
  <table id="plugin-table" :hidden="plugins.length === 0">
    <thead><tr><th scope="col">插件</th><th scope="col">标识</th><th scope="col">状态</th><th scope="col">操作</th></tr></thead>
    <tbody id="plugin-list">
      <tr v-for="plugin in plugins" :key="plugin.id">
        <td>{{ plugin.name }}</td><td>{{ plugin.id }}</td><td>{{ labels[plugin.state] }}</td>
        <td><button type="button" :aria-label="(plugin.state === 'closed' ? '加载 ' : '关闭 ') + plugin.name"
          :disabled="plugin.state === 'loading' || pending.has(plugin.id)" @click="togglePlugin(plugin)">
          {{ plugin.state === 'closed' ? '加载' : '关闭' }}
        </button></td>
      </tr>
    </tbody>
  </table>
</template>

<script lang="ts" src="./view.ts"></script>
