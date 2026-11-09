/**
 * @author Codex
 * @date 2026-11-09
 * Skills 插件自己的有限请求，校验外部参数后访问文件服务，随插件 Fiber 撤销。
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SkillDocument, SkillList, SkillsManager } from './skills-manager.js';
import type {} from '@workplatform/ui-slots';

declare module '@workplatform/ui-slots' {
  interface DesktopRequestMap {
    'skills-manager:list': { args: []; result: SkillList };
    'skills-manager:read': { args: [id: string]; result: SkillDocument };
    'skills-manager:save': { args: [id: string, content: string, revision: string]; result: SkillDocument };
  }
}

/** @param ctx 当前插件上下文。@param manager 此插件持有的文件服务。@returns 无返回值。 */
export function registerSkillsRequests(ctx: Context, manager: SkillsManager): void {
  ctx.effect(() => ctx.slots.handle('skills-manager:list', () => manager.list()));
  ctx.effect(() => ctx.slots.handle('skills-manager:read', (id) => {
    // @param id 外部技能标识。@returns 文件原文和版本。
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw new TypeError('技能标识无效');
    return manager.read(id);
  }));
  ctx.effect(() => ctx.slots.handle('skills-manager:save', (id, content, revision) => {
    // @param id 标识。@param content 源码。@param revision 原版本。@returns 保存后的文件。
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id) || typeof content !== 'string' || typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision)) {
      throw new TypeError('技能保存参数无效');
    }
    return manager.save(id, content, revision);
  }));
}
