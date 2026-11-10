/**
 * @author Codex
 * @date 2026-11-10
 * 预编译宿主和插件的 Vue 模板，分别输出到各包 dist，保留 Node.js 构建产物。
 */
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';

const entries = [
  ['apps/elect', 'renderer'],
  ['packages/plugin-market', 'client'],
  ['packages/skills-manager', 'client'],
  ['packages/tools', 'client']
];

for (const [directory, name] of entries) {
  const root = fileURLToPath(new URL('../' + directory + '/', import.meta.url));
  await build({
    configFile: false,
    root,
    plugins: [vue()],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      target: 'es2023',
      emptyOutDir: false,
      sourcemap: true,
      lib: { entry: root + 'src/' + name + '.ts', formats: ['es'], fileName: name }
    }
  });
}
