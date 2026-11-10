/**
 * @author Codex
 * @date 2026-11-09
 * 工具插件验收：临时目录验证持久化 CRUD、输入校验和 Cordis 请求卸载。
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Context } from '@deepseek-ai/cordis';
import { LocalSlotRegistry } from '@workplatform/ui-slots';
import toolsPlugin from '../src/index.js';
import { JsonToolStore } from '../src/store.js';

/** @param t 测试上下文。@returns 隔离配置文件夹，测试后验证路径并清除。 */
function workspace(t: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), 'workplatform-tools-'));
  t.after(() => {
    // 无入参、无返回值，仅删除本测试在系统临时目录创建的文件夹。
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.ok(directory.startsWith(join(tmpdir(), 'workplatform-tools-')));
    rmSync(directory, { recursive: true, force: true });
  });
  return join(directory, 'config/tool');
}

test('persists create, update, categories and delete across store instances', t => {
  const directory = workspace(t);
  const store = new JsonToolStore(directory);
  assert.deepEqual(store.list(), []);
  const input = { id: '', name: ' 文档 ', url: 'https://example.com/docs', category: ' 开发 ' };
  const created = store.save(input)[0]!;
  assert.ok(created.id);
  assert.equal(created.name, '文档');
  assert.equal(created.category, '开发');
  const restarted = new JsonToolStore(directory);
  assert.deepEqual(restarted.list(), [created]);
  const updated = restarted.save({ id: created.id, name: '新名字', url: 'http://example.org', category: '' })[0]!;
  assert.equal(updated.category, '未分类');
  assert.equal(updated.url, 'http://example.org/');
  assert.deepEqual(JSON.parse(readFileSync(join(directory, 'tools.json'), 'utf8')), [updated]);
  assert.deepEqual(new JsonToolStore(directory).remove(created.id), []);
  assert.deepEqual(store.list(), []);
});

test('rejects invalid inputs without changing saved data', t => {
  const directory = workspace(t);
  const store = new JsonToolStore(directory);
  const input = { id: '', name: '文档', url: 'https://example.com', category: '开发' };
  const saved = store.save(input);
  for (const invalid of [null, {}, { ...input, name: ' ' }, { ...input, url: 'javascript:alert(1)' },
    { ...input, url: 'file:///C:/test' }, { ...input, url: 'https://' }, { ...input, category: 1 },
    { ...input, id: '../outside' }]) {
    assert.throws(() => store.save(invalid));
  }
  assert.throws(() => store.remove(null), /标识无效/);
  assert.deepEqual(store.list(), saved);
});

test('registers tools and releases requests on unload while retaining the file', async t => {
  const directory = workspace(t);
  const ctx = new Context();
  ctx.provide('slots', new LocalSlotRegistry());
  t.after(() => ctx.fiber.dispose());
  const fiber = await ctx.plugin(toolsPlugin, { directory });
  assert.equal(ctx.slots.snapshot().entries.find(entry => entry.name === 'sidebar.panellist')!.label, '工具');
  await ctx.slots.invoke('tools:save', [{ id: '', name: '文档', url: 'https://example.com', category: '开发' }]);
  await assert.rejects(ctx.slots.invoke('tools:save', [{}]), /请填写/);
  await assert.rejects(ctx.slots.invoke('tools:open', ['missing']), /工具不存在/);
  const saved = await ctx.slots.invoke('tools:list', []);
  await fiber.dispose();
  assert.deepEqual(ctx.slots.snapshot().entries, []);
  await assert.rejects(ctx.slots.invoke('tools:list', []), /未注册或已卸载/);
  await ctx.plugin(toolsPlugin, { directory });
  assert.deepEqual(await ctx.slots.invoke('tools:list', []), saved);
});
