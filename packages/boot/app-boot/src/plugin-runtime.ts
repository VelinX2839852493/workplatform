/**
 * @author Codex
 * @date 2026-11-07
 * 通用插件运行时：保存配置与 Fiber，供启动流程及可选管理插件调用，不注册任何市场功能。
 */
import { Context, type FiberState, type Fiber, type Plugin } from '@deepseek-ai/cordis';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Cordis 4.x 仅在类型声明中提供 FiberState，没有同名 JavaScript 导出。
// 按其公开声明保留状态值，避免 tsx 运行源码时请求不存在的运行时枚举。
const fiberStates = { PENDING: 0, LOADING: 1, ACTIVE: 2, FAILED: 3, DISPOSED: 4, UNLOADING: 5 } satisfies Record<string, FiberState>;
// satisfies 等价于用 Record<string, FiberState> 校验每个字段，同时保留各字段的具体类型。

/** 通用插件定义，与桌面 YAML 条目按结构兼容。 */
export interface PluginDefinition {
  id: string;
  name: string;
}

/** 可跨进程传递的插件状态，不包含 Context、Fiber 或函数。 */
export interface PluginSummary extends PluginDefinition {
  state: 'loaded' | 'waiting' | 'loading' | 'failed' | 'closed';
}

/** 通用插件生命周期契约，由 LocalPluginRuntime 实现。 */
export interface PluginRuntime {
  /** @returns 按配置顺序排列的当前插件状态。 */
  list(): PluginSummary[];
  /** @param id 已配置插件的唯一标识。@returns 插件加载完成后兑现的 Promise。 */
  load(id: string): Promise<void>;
  /** @param id 已配置插件的唯一标识。@returns 插件资源释放后兑现的 Promise。 */
  close(id: string): Promise<void>;
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 启动流程创建的通用插件运行时，不代表市场插件已启用。 */
    pluginRuntime: PluginRuntime;
  }
}

/** 仅在运行时实现内部保存插件配置与运行实例。 */
interface PluginEntry {
  definition: PluginDefinition;
  fiber: Fiber | undefined;
}

/** 使用 Cordis 原生 Fiber 生命周期实现 PluginRuntime。 */
export class LocalPluginRuntime implements PluginRuntime {
  private readonly entries = new Map<string, PluginEntry>();
  private readonly bundleRequire: NodeJS.Require;

  /**
   * 建立插件目录；重复 id 会导致配置错误，避免操作错误的实例。
   * @param ctx 供全部插件共用的 Cordis 上下文。
   * @param plugins 按启动顺序排列的插件定义。
   * @param packagePath bundle/package.json 的绝对路径，作为模块解析起点。
   */
  constructor(private readonly ctx: Context, plugins: PluginDefinition[], packagePath: string) {
    this.bundleRequire = createRequire(packagePath);
    for (const plugin of plugins) {
      if (this.entries.has(plugin.id)) throw new Error('插件 id 重复：' + plugin.id);
      this.entries.set(plugin.id, { definition: plugin, fiber: undefined });
    }
  }

  /** @returns 配置顺序下各插件的实际 Fiber 状态。 */
  list(): PluginSummary[] {
    const plugins: PluginSummary[] = [];
    for (const entry of this.entries.values()) {
      let state: PluginSummary['state'];
      switch (entry.fiber?.state) {
        case fiberStates.ACTIVE: state = 'loaded'; break;
        case fiberStates.PENDING: state = 'waiting'; break;
        case fiberStates.LOADING:
        case fiberStates.UNLOADING: state = 'loading'; break;
        case fiberStates.FAILED: state = 'failed'; break;
        default: state = 'closed';
      }
      plugins.push({ id: entry.definition.id, name: entry.definition.name, state: state });
    }
    return plugins;
  }

  /**
   * 加载一个已配置插件，已存在的实例不会重复注册。
   * @param id 插件唯一标识。
   * @returns 插件启动完成后兑现的 Promise；模块或插件错误向调用方传播。
   */
  async load(id: string): Promise<void> {
    const entry = this.getEntry(id);
    if (entry.fiber && entry.fiber.state !== fiberStates.DISPOSED) {
      await entry.fiber.await();
      return;
    }
    const modulePath = this.bundleRequire.resolve(entry.definition.name);
    const module: { default: Plugin } = await import(pathToFileURL(modulePath).href);
    const fiber = this.ctx.plugin(module.default);
    entry.fiber = fiber;
    await fiber;
  }

  /**
   * 关闭插件并等待 Cordis 清理其事件、服务和 effect；已关闭时不重复清理。
   * @param id 插件唯一标识。
   * @returns 资源释放后兑现的 Promise。
   */
  async close(id: string): Promise<void> {
    const entry = this.getEntry(id);
    if (!entry.fiber) return;
    await entry.fiber.dispose();
    entry.fiber = undefined;
  }

  /**
   * 查找已配置插件，拒绝对目录之外的任意模块进行操作。
   * @param id 插件唯一标识。
   * @returns 对应的内部条目。
   */
  private getEntry(id: string): PluginEntry {
    const entry = this.entries.get(id);
    if (!entry) throw new Error('插件未配置：' + id);
    return entry;
  }
}
