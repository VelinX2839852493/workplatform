/**
 * @author Codex
 * @date 2026-11-09
 * Skills 插件集成测试：验证 Fiber 服务生命周期与真实 bundle 的默认插件配置。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import boot from '@workplatform/app-boot';
import skillsManager from '../src/index.js';
import { LocalSlotRegistry } from '@workplatform/ui-slots';

test('provides its own service, disposes stale references and can be reloaded', async (t) => {
  const ctx = new Context();
  ctx.provide('slots', new LocalSlotRegistry());
  t.after(() => ctx.fiber.dispose());
  assert.equal(ctx.get('skillsManager'), undefined);
  const fiber = await ctx.plugin(skillsManager);
  const service = ctx.skillsManager;
  assert.ok(service);
  assert.deepEqual(ctx.slots.snapshot().entries.map(entry => entry.name), ['main', 'sidebar.panellist']);
  assert.equal(ctx.slots.snapshot().entries.find(entry => entry.name === 'sidebar.panellist')!.label, 'Skills 管理');
  await assert.rejects(ctx.slots.invoke('skills-manager:read', ['../SKILL.md']), /标识无效/);
  await fiber.dispose();
  assert.equal(ctx.get('skillsManager'), undefined);
  assert.deepEqual(ctx.slots.snapshot().entries, []);
  await assert.rejects(ctx.slots.invoke('skills-manager:list', []), /未注册或已卸载/);
  await assert.rejects(service.list(), /未加载/);
  await ctx.plugin(skillsManager);
  assert.ok(ctx.skillsManager);
  assert.notEqual(ctx.skillsManager, service);
});

test('the real bundle boots all plugins and reloads Skills independently of the market', async (t) => {
  // pnpm 的测试工作目录为包根；真实 boot 固定从工作区根解析 bundle 配置。
  const previous = process.cwd();
  process.chdir(fileURLToPath(new URL('../../../', import.meta.url)));
  t.after(() => { process.chdir(previous); });
  const ctx = await boot('SkillsTest');
  t.after(() => ctx.fiber.dispose());
  assert.equal(ctx.pluginRuntime.list().find(plugin => plugin.id === 'skills-manager')!.state, 'loaded');
  assert.ok(ctx.get('skillsManager'));
  assert.deepEqual(ctx.slots.snapshot().entries.filter(entry => entry.name === 'sidebar.panellist').map(entry => entry.id), ['plugin-market', 'skills-manager', 'tools']);
  await ctx.pluginRuntime.close('skills-manager');
  assert.equal(ctx.get('skillsManager'), undefined);
  assert.ok(ctx.slots.snapshot().entries.every(entry => entry.name === 'main' ? entry.key !== 'skills-manager' : entry.id !== 'skills-manager'));
  assert.ok(ctx.get('pluginMarket'));
  await ctx.pluginRuntime.load('skills-manager');
  assert.ok(ctx.get('skillsManager'));
  await ctx.pluginRuntime.close('plugin-market');
  assert.ok(ctx.get('skillsManager'));
  assert.deepEqual(ctx.slots.snapshot().entries.filter(entry => entry.name === 'sidebar.panellist').map(entry => entry.id), ['tools', 'skills-manager']);
});
