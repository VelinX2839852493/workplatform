/**
 * @author Codex
 * @date 2026-11-09
 * Electron UI 通用桥接类型：插件插槽快照、变化订阅和已注册有限请求。
 */
import type { DesktopClient, SlotSnapshot } from '@workplatform/ui-slots';

/** 宿主桥接与具体业务插件解耦。 */
export interface DesktopUiClient extends DesktopClient {
  /** @returns 当前插槽完整快照。 */
  getSnapshot(): Promise<SlotSnapshot>;
  /** @param listener 新快照回调。@returns 取消订阅函数。 */
  onChanged(listener: (snapshot: SlotSnapshot) => void): () => void;
}

declare global {
  interface Window { desktopUi: DesktopUiClient; }
}
