/**
 * @author Codex
 * @date 2026-11-10
 * 使用 TypeScript 6 的编译器 API 运行 vue-tsc，Node.js 构建继续使用项目现有 TypeScript 7。
 */
const { run } = require('vue-tsc');

run(require.resolve('typescript-vue/lib/tsc'));
