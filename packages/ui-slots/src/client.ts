/**
 * @author Codex
 * @date 2026-11-09
 * 客户端面板生命周期契约，独立出口避免 Node.js 端依赖 DOM 类型。
 */
import type { DesktopClient } from './contracts.js';

/** 卸载时暂存、重载时注入的数据，宿主不解释业务内容。 */
export interface PanelDraft { dirty: boolean; value: unknown; }

/** 客户端页面的生命周期句柄。 */
export interface PanelInstance {
  /** @returns 页面草稿，供卸载保留和关闭保护使用。 */
  snapshot?(): PanelDraft;
  /** @returns 无返回值，移除监听并使异步请求失效。 */
  dispose(): void;
}

/** 页面挂载时由宿主注入的依赖。 */
export interface PanelContext { client: DesktopClient; draft: PanelDraft | undefined; }

/** 客户端模块的默认导出，插件拥有 DOM 和页面行为。 */
export interface PanelModule {
  /** @param container 面板容器。@param context 请求接口及草稿。@returns 页面生命周期。 */
  mount(container: HTMLElement, context: PanelContext): PanelInstance;
}
