/**
 * @author Codex
 * @date 2026-11-09
 * 工具文件存储：以单个 JSON 保存网址与分类，每次操作读取文件，不依赖内存缓存。
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** 保存的工具；新建时 id 传空字符串，由存储生成。 */
export interface Tool { id: string; name: string; url: string; category: string; }

/** 插件内部的存储契约，由 JsonToolStore 实现。 */
export interface ToolStore {
  /** @returns 全部工具。 */
  list(): Tool[];
  /** @param input 外部工具数据。@returns 新增或修改后的全部工具。 */
  save(input: unknown): Tool[];
  /** @param id 外部工具标识。@returns 删除后的全部工具。 */
  remove(id: unknown): Tool[];
}

/** 小型本地配置采用同步读写，保证单进程内读改写按顺序完成。 */
export class JsonToolStore implements ToolStore {
  private readonly file: string;

  /** @param directory 配置文件夹。@returns 存储实例，首次保存时创建文件夹。 */
  constructor(private readonly directory: string) { this.file = join(directory, 'tools.json'); }

  /** @returns 文件中的工具，文件尚未创建时返回空列表；读取错误直接交给调用边界。 */
  list(): Tool[] {
    return existsSync(this.file) ? JSON.parse(readFileSync(this.file, 'utf8')) : [];
  }

  /** @param input 未信任的保存数据，在此单次校验。@returns 保存后的全部工具。 */
  save(input: unknown): Tool[] {
    if (!input || typeof input !== 'object') throw new TypeError('工具参数无效');
    const { id, name, url, category } = input as Partial<Tool>;
    if (typeof id !== 'string' || typeof name !== 'string' || !name.trim()
      || typeof url !== 'string' || !/^https?:\/\/\S+$/i.test(url.trim()) || typeof category !== 'string') {
      throw new TypeError('请填写名字和有效的 HTTP/HTTPS 网址');
    }
    const address = new URL(url.trim());
    const tools = this.list();
    const index = tools.findIndex(tool => tool.id === id);
    // 等价于依次遍历 tools，返回首个 id 相等的位置；未找到返回 -1。
    if (id && index < 0) throw new Error('工具不存在，请刷新列表');
    const tool: Tool = { id: id || randomUUID(), name: name.trim(), url: address.href, category: category.trim() || '未分类' };
    if (index < 0) tools.push(tool);
    else tools[index] = tool;
    this.write(tools);
    return tools;
  }

  /** @param id 待删除的工具标识。@returns 保存后的全部工具。 */
  remove(id: unknown): Tool[] {
    if (typeof id !== 'string' || !id) throw new TypeError('工具标识无效');
    const tools = this.list().filter(tool => tool.id !== id);
    this.write(tools);
    return tools;
  }

  /** @param tools 完整工具列表。@returns 无返回值，写入失败时抛出文件错误。 */
  private write(tools: Tool[]): void {
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(this.file, JSON.stringify(tools, null, 2) + '\n', 'utf8');
  }
}
