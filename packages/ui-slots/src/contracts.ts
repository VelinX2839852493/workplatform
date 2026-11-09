/**
 * @author Codex
 * @date 2026-11-09
 * 进程间 UI 插槽和客户端面板契约，不依赖 Node.js 或 Electron，业务插件可扩充请求类型。
 */

/** 侧栏列表插槽，id 指向 main 插槽的 key。 */
export interface SidebarEntry {
  name: 'sidebar.panellist';
  id: string;
  label: string;
  order: number;
}

/** 插件拥有主面板的客户端模块，entry 是插件注册的模块 URL。 */
export interface MainEntry {
  name: 'main';
  key: string;
  entry: string;
}

/** 当前桌面的两个通用插槽，不包含业务页面专用字段。 */
export type SlotEntry = SidebarEntry | MainEntry;

/** 带单调版本的完整快照，防止初始化查询覆盖较新的事件。 */
export interface SlotSnapshot {
  revision: number;
  entries: SlotEntry[];
}

/** 由业务插件扩充，声明各自的有限请求。 */
export interface DesktopRequestMap {}

/** 主机注入客户端模块的有限请求桥接。 */
export interface DesktopClient {
  /** @param method 已注册方法。@param args 方法参数。@returns 方法结果。 */
  invoke<K extends keyof DesktopRequestMap>(method: K,
    ...args: DesktopRequestMap[K] extends { args: infer A extends unknown[] } ? A : never
  ): Promise<DesktopRequestMap[K] extends { result: infer R } ? R : never>;
}

