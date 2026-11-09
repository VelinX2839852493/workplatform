/**
 * @author Codex
 * @date 2026-11-09
 * 插槽契约测试：独立业务插件注册导航、主面板和请求，验证快照隔离及 Fiber 自动撤销。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Context, type Plugin } from '@deepseek-ai/cordis';
import { LocalSlotRegistry, type SidebarEntry } from '../src/index.js';

test('publishes versioned snapshots and removes only its own registration', () => {
  const slots = new LocalSlotRegistry();
  const seen: number[] = [];
  const unsubscribe = slots.subscribe(snapshot => { seen.push(snapshot.revision); });
  const entry: SidebarEntry = { name: 'sidebar.panellist', id: 'example', label: '示例', order: 10 };
  const remove = slots.register(entry);
  entry.label = 'changed outside';
  assert.equal(slots.snapshot().entries[0]!.name, 'sidebar.panellist');
  const copy = slots.snapshot();
  assert.equal((copy.entries[0] as SidebarEntry).label, '示例');
  (copy.entries[0] as SidebarEntry).label = 'changed copy';
  assert.equal((slots.snapshot().entries[0] as SidebarEntry).label, '示例');
  assert.throws(() => slots.register(entry), /重复 UI/);
  remove();
  remove();
  assert.deepEqual(seen, [1, 2]);
  const removeNew = slots.register(entry);
  remove();
  assert.equal(slots.snapshot().entries.length, 1);
  unsubscribe();
  removeNew();
  assert.deepEqual(seen, [1, 2, 3]);
});

test('calls only registered requests and unregisters without deleting replacements', async () => {
  const slots = new LocalSlotRegistry();
  const remove = slots.handle('example:read', (value) => {
    // @param value 外部参数。@returns 已校验的字符串。
    if (typeof value !== 'string') throw new TypeError('expected string');
    return value;
  });
  assert.equal(await slots.invoke('example:read', ['hello']), 'hello');
  await assert.rejects(slots.invoke('example:read', [123]), /expected string/);
  assert.throws(() => slots.handle('example:read', () => undefined), /重复桌面请求/);
  remove();
  await assert.rejects(slots.invoke('example:read', []), /未注册或已卸载/);
  const removeNew = slots.handle('example:read', () => 'replacement');
  remove();
  assert.equal(await slots.invoke('example:read', []), 'replacement');
  removeNew();
});

test('a new plugin contributes and removes navigation, panel and requests without host changes', async (t) => {
  const ctx = new Context();
  ctx.provide('slots', new LocalSlotRegistry());
  t.after(() => ctx.fiber.dispose());
  const example: Plugin.Object = {
    name: 'example', inject: ['slots'],
    /** @param plugin 当前 Fiber 上下文。@returns 无返回值，生命周期由 effect 维护。 */
    apply(plugin): void {
      plugin.effect(() => plugin.slots.register({ name: 'main', key: 'example', entry: 'file:///example/client.js' }));
      plugin.effect(() => plugin.slots.register({ name: 'sidebar.panellist', id: 'example', label: '示例', order: 15 }));
      plugin.effect(() => plugin.slots.handle('example:read', () => 'ready'));
    }
  };
  const fiber = await ctx.plugin(example);
  assert.equal(ctx.slots.snapshot().entries.length, 2);
  assert.equal(await ctx.slots.invoke('example:read', []), 'ready');
  await fiber.dispose();
  assert.deepEqual(ctx.slots.snapshot().entries, []);
  await assert.rejects(ctx.slots.invoke('example:read', []), /未注册或已卸载/);
  await ctx.plugin(example);
  assert.equal(ctx.slots.snapshot().entries.length, 2);
});
