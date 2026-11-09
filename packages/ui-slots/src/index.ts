/**
 * @author Codex
 * @date 2026-11-09
 * 插件注册导航、页面和有限请求，宿主订阅快照，Cordis effect 负责撤销注册。
 */
import type { SlotEntry, SlotSnapshot } from './contracts.js';
import '@deepseek-ai/cordis';
export type { SidebarEntry, MainEntry, SlotEntry, SlotSnapshot, DesktopClient, DesktopRequestMap } from './contracts.js';

/** 插件在处理函数入口校验序列化参数。 */
type RequestHandler = (...args: unknown[]) => unknown | Promise<unknown>;

/** 插件使用的注册表契约，宿主不关心具体业务。 */
export interface SlotRegistry {
  /** @param entry 插槽条目。@returns 释放本次注册的函数。 */
  register(entry: SlotEntry): () => void;
  /** @param method 唯一方法名。@param handler 请求入口。@returns 取消注册函数。 */
  handle(method: string, handler: RequestHandler): () => void;
  /** @param method 方法名。@param args 参数。@returns 方法结果，未知方法拒绝。 */
  invoke(method: string, args: unknown[]): Promise<unknown>;
  /** @returns 完整可序列化快照。 */
  snapshot(): SlotSnapshot;
  /** @param listener 变化回调。@returns 取消订阅函数。 */
  subscribe(listener: (snapshot: SlotSnapshot) => void): () => void;
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 业务插件通过 effect 注册导航、页面及有限请求。 */
    slots: SlotRegistry;
  }
}

/** 通用注册表；不依赖任何业务服务或 Electron。 */
export class LocalSlotRegistry implements SlotRegistry {
  private readonly entries = new Map<string, SlotEntry>();
  private readonly handlers = new Map<string, RequestHandler>();
  private readonly listeners = new Set<(snapshot: SlotSnapshot) => void>();
  private revision = 0;

  /** @param entry 插槽条目。@returns 幂等释放函数，重复键抛错。 */
  register(entry: SlotEntry): () => void {
    const key = entry.name + ':' + (entry.name === 'main' ? entry.key : entry.id);
    if (this.entries.has(key)) throw new Error('重复 UI 插槽注册：' + key);
    const stored = { ...entry };
    // 等价于逐字段复制，防止外部修改原对象绕过变化通知。
    this.entries.set(key, stored);
    this.changed();
    return () => {
      // 无入参、无返回值；旧释放函数不会误删重载后的条目。
      if (this.entries.get(key) !== stored) return;
      this.entries.delete(key);
      this.changed();
    };
  }

  /** @param method 方法名。@param handler 请求入口。@returns 幂等取消注册函数。 */
  handle(method: string, handler: RequestHandler): () => void {
    if (this.handlers.has(method)) throw new Error('重复桌面请求注册：' + method);
    this.handlers.set(method, handler);
    return () => { if (this.handlers.get(method) === handler) this.handlers.delete(method); };
  }

  /** @param method 方法名。@param args 序列化参数。@returns 处理器结果。 */
  async invoke(method: string, args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(method);
    if (!handler) throw new Error('插件请求未注册或已卸载：' + method);
    return handler(...args);
  }

  /** @returns 克隆的快照，保留条目的注册顺序。 */
  snapshot(): SlotSnapshot {
    return { revision: this.revision, entries: Array.from(this.entries.values(), entry => ({ ...entry })) };
  }

  /** @param listener 快照回调。@returns 取消订阅函数。 */
  subscribe(listener: (snapshot: SlotSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** @returns 无返回值，向宿主广播最新完整快照。 */
  private changed(): void {
    this.revision++;
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
