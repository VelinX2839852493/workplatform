/**
 * @author Codex
 * @date 2026-11-07
 * 插件配置读取模块：解析 YAML 补丁数组，按各 insert 列表的原始顺序展开插件条目。
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

/** 桌面插件配置条目；required 保留为配置元数据，当前启动流程注册全部条目。 */
export interface DesktopPlugin {
  id: string;
  name: string;
  required?: boolean;
}

/** YAML 中的单个插入补丁，仅供读取模块内部使用。 */
interface PluginPatch {
  insert: DesktopPlugin[];
}

/**
 * 读取插件配置文件并按 YAML 中的顺序展开插件列表。
 * @param path 配置文件路径；相对路径以进程工作目录为基准。
 * @returns 按各 insert 列表顺序排列的插件条目。
 * @throws 文件读取失败或 YAML 解析失败时抛出错误。
 */
export function readDesktopPlugins(path: string): DesktopPlugin[] {
  const content = readFileSync(path, 'utf8');
  const patches = parse(content) as PluginPatch[];

  return patches.flatMap(patch => patch.insert);
  // 等价展开：const plugins: DesktopPlugin[] = [];
  // for (const patch of patches) { for (const plugin of patch.insert) { plugins.push(plugin); } }
  // return plugins;
}
