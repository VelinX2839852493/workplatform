/**
 * @author Codex
 * @date 2026-11-09
 * Skills 管理 Cordis 插件：注册文件服务，并使服务与插件 Fiber 同时释放。
 */
import type { Context, Plugin } from '@deepseek-ai/cordis';
import { LocalSkillsManager, type SkillsManager } from './skills-manager.js';
import { registerSkillsRequests } from './requests.js';

export { LocalSkillsManager, userSkillRoots } from './skills-manager.js';
export type { SkillsManager, SkillRoot, SkillSummary, SkillList, SkillDocument } from './skills-manager.js';

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 可选 Skills 管理服务，仅在对应插件已加载时存在。 */
    skillsManager: SkillsManager;
  }
}

const skillsManager: Plugin.Object = {
  name: 'skills-manager',
  inject: ['slots'],
  /** @param ctx 当前插件上下文。@returns 无返回值，服务由 Cordis Fiber 托管。 */
  apply(ctx: Context): void {
    const manager = new LocalSkillsManager();
    ctx.effect(() => () => manager.dispose());
    ctx.provide('skillsManager', manager);
    registerSkillsRequests(ctx, manager);
    ctx.effect(() => ctx.slots.register({
      name: 'main', key: 'skills-manager', entry: new URL('./client.js', import.meta.url).href
    }));
    ctx.effect(() => ctx.slots.register({
      name: 'sidebar.panellist', id: 'skills-manager', label: 'Skills 管理', order: 20
    }));
  }
};

export default skillsManager;
