/**
 * @author Codex
 * @date 2026-11-10
 * 渲染端入口：挂载预编译 Vue 宿主，模板与逻辑由 Shell.vue、shell.ts 分别持有。
 */
import { createApp } from 'vue';
import Shell from './Shell.vue';

createApp(Shell).mount('#app');
