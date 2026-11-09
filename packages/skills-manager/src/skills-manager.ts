/**
 * @author Codex
 * @date 2026-11-09
 * 用户级 Skills 文件服务：发现技能、读取源码，并在版本校验后原子保存；不执行技能内容。
 */
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile, realpath, stat, open, rename, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';

/** 列表条目可安全跨 IPC 传递；同名技能以路径派生的 id 区分。 */
export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  source: 'codex' | 'agents';
  path: string;
  status: 'ready' | 'invalid' | 'unreadable';
  error?: string;
}

/** 扫描结果包含独立的目录错误，避免一个不可读目录使整个页面失败。 */
export interface SkillList {
  skills: SkillSummary[];
  errors: string[];
}

/** 原文及版本，不向渲染进程暴露文件句柄。 */
export interface SkillDocument {
  id: string;
  path: string;
  content: string;
  revision: string;
}

/** Skills 插件的公共文件操作契约。 */
export interface SkillsManager {
  /** @returns 用户目录中的技能及扫描错误。 */
  list(): Promise<SkillList>;
  /** @param id 列表中已发现的技能标识。@returns 文件源码及内容版本。 */
  read(id: string): Promise<SkillDocument>;
  /** @param id 技能标识。@param content 完整源码。@param revision 读取时的版本。@returns 保存后的文件。 */
  save(id: string, content: string, revision: string): Promise<SkillDocument>;
}

/** 根目录由主进程构造，测试可传入临时目录；不由渲染进程指定。 */
export interface SkillRoot {
  source: SkillSummary['source'];
  path: string;
}

/** 内部注册信息绑定扫描时的真实文件目标，防止路径或链接在编辑期间被替换。 */
interface SkillEntry {
  path: string;
  target: string | undefined;
}

/** @returns 当前进程使用的 Codex 及 agents 用户技能根目录。 */
export function userSkillRoots(): SkillRoot[] {
  const home = homedir();
  return [
    { source: 'codex', path: resolve(process.env.CODEX_HOME || join(home, '.codex'), 'skills') },
    { source: 'agents', path: join(home, '.agents', 'skills') }
  ];
}

/** @param value 任意错误。@returns 适合页面显示的错误信息。 */
function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

/** @param error 文件系统错误。@returns 是否为不存在的路径。 */
function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

/** @param content 完整 Markdown。@returns 必需元数据；语法或字段不合法时抛错。 */
function metadata(content: string): { name: string; description: string } {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) throw new Error('缺少 YAML frontmatter，请在文件开头添加 ---、name 和 description。');
  const value: unknown = parse(match[1]!);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('技能元数据必须是 YAML 对象。');
  const fields = value as Record<string, unknown>;
  if (typeof fields.name !== 'string' || !fields.name.trim()) throw new Error('name 必须是非空字符串。');
  if (typeof fields.description !== 'string' || !fields.description.trim()) throw new Error('description 必须是非空字符串。');
  return { name: fields.name, description: fields.description };
}

/** @param target 真实文件路径。@param bytes 文件字节。@returns 同时绑定目标和内容的版本。 */
function version(target: string, bytes: Buffer): string {
  return createHash('sha256').update(target).update('\0').update(bytes).digest('hex');
}

/** 实现 SkillsManager；文件系统与 Electron 解耦，所有操作仅作用于扫描注册的技能。 */
export class LocalSkillsManager implements SkillsManager {
  private entries = new Map<string, SkillEntry>();
  private readonly saves = new Map<string, Promise<SkillDocument>>();
  private active = true;

  /** @param roots 可信的用户技能根目录；默认按当前用户和 CODEX_HOME 解析。 */
  constructor(private readonly roots: SkillRoot[] = userSkillRoots()) {}

  /** @returns 无返回值；卸载后禁止服务继续读写文件。 */
  dispose(): void {
    this.active = false;
    this.entries.clear();
  }

  /** @returns 无返回值；插件已卸载时抛错。 */
  private ensureActive(): void {
    if (!this.active) throw new Error('Skills 管理插件未加载。');
  }

  /** @param id 已注册的标识。@returns 内部文件注册信息。 */
  private entry(id: string): SkillEntry {
    this.ensureActive();
    const entry = this.entries.get(id);
    if (!entry) throw new Error('未知技能，请刷新列表后重试。');
    return entry;
  }

  /** @returns 扫描结果；单个文件错误以条目状态保留，缺失根目录视为空目录。 */
  async list(): Promise<SkillList> {
    this.ensureActive();
    const result: SkillList = { skills: [], errors: [] };
    const discovered = new Map<string, SkillEntry>();
    for (const root of this.roots) {
      const visited = new Set<string>();
      /** @param directory 当前目录。@returns 该目录及子技能扫描完成后的 Promise。 */
      async function scan(directory: string): Promise<void> {
        try {
          const canonical = await realpath(directory);
          if (visited.has(canonical)) return;
          visited.add(canonical);
          const children = await readdir(directory, { withFileTypes: true });
          const manifest = children.find(child => child.name === 'SKILL.md');
          if (manifest && (manifest.isFile() || manifest.isSymbolicLink())) {
            const path = join(directory, manifest.name);
            const id = createHash('sha256').update(resolve(path)).digest('hex');
            const summary: SkillSummary = {
              id, path, source: root.source, name: basename(directory), description: '', status: 'unreadable'
            };
            const entry: SkillEntry = { path, target: undefined };
            discovered.set(id, entry);
            try {
              entry.target = await realpath(path);
              const content = await readFile(entry.target, 'utf8');
              summary.status = 'invalid';
              const fields = metadata(content);
              summary.name = fields.name;
              summary.description = fields.description;
              summary.status = 'ready';
            } catch (error) {
              summary.error = errorMessage(error);
            }
            result.skills.push(summary);
            return; // 一个技能的 scripts、references 等配套目录不继续当成技能扫描。
          }
          for (const child of children) {
            if (child.name === '.system') continue;
            if (child.isDirectory()) await scan(join(directory, child.name));
            else if (child.isSymbolicLink()) {
              const path = join(directory, child.name);
              try {
                if ((await stat(path)).isDirectory()) await scan(path);
              } catch (error) {
                result.errors.push(path + '：' + errorMessage(error));
              }
            }
          }
        } catch (error) {
          if (directory !== resolve(root.path) || !isMissing(error)) result.errors.push(directory + '：' + errorMessage(error));
        }
      }
      await scan(resolve(root.path));
    }
    this.ensureActive();
    this.entries = discovered;
    result.skills.sort((left, right) => left.name.localeCompare(right.name) || left.path.localeCompare(right.path));
    return result;
  }

  /** @param entry 已注册文件。@returns 目标保持一致时的真实路径，变化或缺失时抛错。 */
  private async target(entry: SkillEntry): Promise<string> {
    let target: string;
    try {
      target = await realpath(entry.path);
    } catch (error) {
      if (isMissing(error)) throw new Error('技能文件已删除或移动，请刷新列表。');
      throw error;
    }
    if (!entry.target || target !== entry.target) throw new Error('技能链接目标已变化，请刷新列表并重新读取。');
    return target;
  }

  /** @param id 列表标识。@returns 未经 Markdown 重写的完整原文及版本。 */
  async read(id: string): Promise<SkillDocument> {
    const entry = this.entry(id);
    const target = await this.target(entry);
    const bytes = await readFile(target);
    this.ensureActive();
    return { id, path: entry.path, content: bytes.toString('utf8'), revision: version(target, bytes) };
  }

  /** @param id 技能标识。@param content 完整 Markdown。@param revision 读取版本。@returns 串行保存后的文件。 */
  async save(id: string, content: string, revision: string): Promise<SkillDocument> {
    const entry = this.entry(id);
    const key = entry.target || entry.path;
    const previous = this.saves.get(key);
    // 等价于等待上一次保存完成（包括失败）后才允许本次保存进行版本检查。
    const operation = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(() => this.write(id, entry, content, revision));
    this.saves.set(key, operation);
    try {
      return await operation;
    } finally {
      if (this.saves.get(key) === operation) this.saves.delete(key);
    }
  }

  /** @param id 标识。@param entry 注册目标。@param content 编辑源码。@param revision 原版本。@returns 已提交的源码。 */
  private async write(id: string, entry: SkillEntry, content: string, revision: string): Promise<SkillDocument> {
    this.ensureActive();
    metadata(content);
    const target = await this.target(entry);
    const original = await readFile(target);
    if (version(target, original) !== revision) throw new Error('文件已被其他程序修改，请重新读取；当前编辑内容已保留。');
    const originalText = original.toString('utf8');
    const newline = originalText.includes('\r\n') ? '\r\n' : '\n';
    const text = (originalText.startsWith('\uFEFF') ? '\uFEFF' : '') + content.replace(/^\uFEFF/, '').replace(/\r\n|\r|\n/g, newline);
    const bytes = Buffer.from(text, 'utf8');
    const temporary = join(dirname(target), '.' + basename(target) + '.' + randomUUID() + '.tmp');
    const info = await stat(target);
    try {
      const file = await open(temporary, 'wx', info.mode);
      try {
        await file.writeFile(bytes);
        await file.sync();
      } finally {
        await file.close();
      }
      this.ensureActive();
      await this.target(entry);
      if (version(target, await readFile(target)) !== revision) throw new Error('保存期间文件发生变化，请重新读取；当前编辑内容已保留。');
      await rename(temporary, target);
    } finally {
      try {
        await unlink(temporary);
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
    return { id, path: entry.path, content: text, revision: version(target, bytes) };
  }
}
