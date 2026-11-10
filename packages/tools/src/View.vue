<!--
  @author Codex
  @date 2026-11-10
  工具模板：表单负责新增与编辑，列表提供分类筛选、网页跳转和删除入口。
-->
<template>
  <header class="page-heading"><div><h1>工具</h1><p>收藏常用网址，点击名字打开网页。</p></div></header>
  <form id="tool-form" @submit.prevent="saveTool" @reset.prevent="resetEditor">
    <fieldset :disabled="busy">
      <legend id="tool-editor-title">{{ editing ? '编辑工具' : '新增工具' }}</legend>
      <label>名字 <input ref="nameInput" v-model="name" name="name" required></label>
      <label>网址 <input v-model="url" name="url" type="url" placeholder="https://example.com" required></label>
      <label>分类 <input v-model="category" name="category" list="tool-categories" placeholder="未分类"></label>
      <datalist id="tool-categories"><option v-for="value in categories" :key="value" :value="value"></option></datalist>
      <div class="tool-form-actions"><button class="button-primary" type="submit">保存</button> <button type="reset">取消编辑</button></div>
    </fieldset>
  </form>
  <div class="tool-list-toolbar"><label>分类筛选 <select id="tool-filter" v-model="filter">
    <option value="">全部分类</option><option v-for="value in categories" :key="value" :value="value">{{ value }}</option>
  </select></label> <button id="tool-refresh" type="button" :disabled="busy" @click="refreshTools">刷新列表</button></div>
  <p id="tool-message" role="status" aria-live="polite">{{ message }}</p>
  <ul id="tool-list">
    <li v-for="tool in filtered" :key="tool.id" :data-id="tool.id">
      <a :href="tool.url" @click.prevent="openTool(tool)">{{ tool.name }}</a>
      <span>{{ tool.category }}</span>
      <button class="button-compact" type="button" data-action="编辑" :aria-label="'编辑 ' + tool.name" @click="editTool(tool)">编辑</button>
      <button class="button-compact button-danger" type="button" data-action="删除" :aria-label="'删除 ' + tool.name" @click="removeTool(tool)">删除</button>
    </li>
    <template v-if="filtered.length === 0">暂无工具，在上方填写并保存。</template>
  </ul>
</template>

<script lang="ts" src="./view.ts"></script>
