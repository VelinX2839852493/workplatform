/**
 * @author Codex
 * @date 2026-11-09
 * 隔离文件测试：覆盖用户目录发现、异常元数据、格式保留、冲突、链接及插件卸载。
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { LocalSkillsManager, userSkillRoots } from '../src/index.js';

const source = '---\nname: shared-name\ndescription: A test skill\nextra:\n  keep: true\n---\n\n# Instructions\nOriginal text.\n';

/** @param t 测试上下文。@returns 临时目录、服务及创建技能的辅助函数。 */
async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'workplatform-skills-'));
  const codex = join(directory, 'codex');
  const agents = join(directory, 'agents');
  const manager = new LocalSkillsManager([{ source: 'codex', path: codex }, { source: 'agents', path: agents }]);
  t.after(async () => {
    // 只清理本测试在系统临时目录下创建的唯一目录；无入参、无返回值。
    manager.dispose();
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.ok(directory.startsWith(join(tmpdir(), 'workplatform-skills-')));
    await rm(directory, { recursive: true, force: true });
  });
  /** @param root 用户根目录。@param folder 技能子目录。@param content 完整文件。@returns 文件路径。 */
  async function skill(root: string, folder: string, content = source): Promise<string> {
    const path = join(root, folder, 'SKILL.md');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
    return path;
  }
  return { directory, codex, agents, manager, skill };
}

test('discovers both roots, keeps same names distinct, skips system and companion files', async (t) => {
  const f = await fixture(t);
  await f.skill(f.codex, 'one');
  await f.skill(f.agents, 'group/two');
  await f.skill(f.codex, '.system/internal');
  await f.skill(f.codex, 'one/references/example');
  const result = await f.manager.list();
  assert.equal(result.skills.length, 2);
  assert.equal(new Set(result.skills.map(skill => skill.id)).size, 2);
  assert.deepEqual(new Set(result.skills.map(skill => skill.source)), new Set(['codex', 'agents']));
  assert.ok(result.skills.every(skill => skill.name === 'shared-name' && skill.status === 'ready'));
  assert.deepEqual(result.errors, []);
  const next = await f.manager.list();
  assert.deepEqual(next.skills.map(skill => skill.id), result.skills.map(skill => skill.id));
});

test('treats missing roots as empty and reports a failed root without hiding healthy skills', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await f.manager.list(), { skills: [], errors: [] });
  await writeFile(f.codex, 'not a directory');
  await f.skill(f.agents, 'valid');
  const result = await f.manager.list();
  assert.equal(result.skills.length, 1);
  assert.equal(result.errors.length, 1);
});

test('invalid metadata remains readable and can be repaired without changing other files', async (t) => {
  const f = await fixture(t);
  const path = await f.skill(f.codex, 'broken', '---\nname: [unterminated\n---\nText');
  await writeFile(join(dirname(path), 'reference.txt'), 'keep me');
  const result = await f.manager.list();
  assert.equal(result.skills[0]!.status, 'invalid');
  const document = await f.manager.read(result.skills[0]!.id);
  const saved = await f.manager.save(document.id, source, document.revision);
  assert.equal(saved.content, source);
  assert.equal((await f.manager.list()).skills[0]!.status, 'ready');
  assert.equal(await readFile(join(dirname(path), 'reference.txt'), 'utf8'), 'keep me');
});

test('rejects missing or empty required metadata without altering the original', async (t) => {
  const f = await fixture(t);
  const path = await f.skill(f.codex, 'valid');
  const document = await f.manager.read((await f.manager.list()).skills[0]!.id);
  for (const invalid of ['Plain text', '---\nname: empty\ndescription: ""\n---\n', '---\nname: 123\ndescription: text\n---\n']) {
    await assert.rejects(f.manager.save(document.id, invalid, document.revision));
    assert.equal(await readFile(path, 'utf8'), source);
  }
});

test('preserves BOM, CRLF, extra metadata and raw Markdown; cleans temporary files', async (t) => {
  const f = await fixture(t);
  const original = '\uFEFF' + source.replace(/\n/g, '\r\n');
  const path = await f.skill(f.codex, 'windows', original);
  const document = await f.manager.read((await f.manager.list()).skills[0]!.id);
  assert.equal(document.content, original);
  const edited = source.replace('Original text.', '中文和 `code` <tag> & text.');
  const saved = await f.manager.save(document.id, edited, document.revision);
  assert.equal(saved.content, '\uFEFF' + edited.replace(/\n/g, '\r\n'));
  assert.equal(await readFile(path, 'utf8'), saved.content);
  assert.notEqual(saved.revision, document.revision);
  assert.deepEqual(await readdir(dirname(path)), ['SKILL.md']);
});

test('detects external edits and deletion rather than overwriting or recreating the file', async (t) => {
  const f = await fixture(t);
  const path = await f.skill(f.codex, 'conflict');
  const document = await f.manager.read((await f.manager.list()).skills[0]!.id);
  await writeFile(path, source + 'External edit\n');
  await assert.rejects(f.manager.save(document.id, source + 'My edit\n', document.revision), /其他程序修改/);
  assert.equal(await readFile(path, 'utf8'), source + 'External edit\n');
  await unlink(path);
  await assert.rejects(f.manager.save(document.id, source, document.revision), /删除或移动/);
  await assert.rejects(readFile(path), /ENOENT/);
});

test('serializes competing saves so only one write with the same version succeeds', async (t) => {
  const f = await fixture(t);
  const path = await f.skill(f.codex, 'serial');
  const document = await f.manager.read((await f.manager.list()).skills[0]!.id);
  const outcomes = await Promise.allSettled([
    f.manager.save(document.id, source + 'First\n', document.revision),
    f.manager.save(document.id, source + 'Second\n', document.revision)
  ]);
  assert.equal(outcomes[0]!.status, 'fulfilled');
  assert.equal(outcomes[1]!.status, 'rejected');
  assert.equal(await readFile(path, 'utf8'), source + 'First\n');
});

test('rejects arbitrary paths, unknown ids and use after plugin disposal', async (t) => {
  const f = await fixture(t);
  await f.skill(f.codex, 'valid');
  const id = (await f.manager.list()).skills[0]!.id;
  for (const unknown of ['../SKILL.md', join(f.codex, 'valid/SKILL.md'), 'a'.repeat(64)]) {
    await assert.rejects(f.manager.read(unknown), /未知技能/);
    await assert.rejects(f.manager.save(unknown, source, ''), /未知技能/);
  }
  f.manager.dispose();
  await assert.rejects(f.manager.list(), /未加载/);
  await assert.rejects(f.manager.read(id), /未加载/);
  await assert.rejects(f.manager.save(id, source, ''), /未加载/);
});

test('supports junction skills, stops cycles, and rejects changed link targets even after rescan', async (t) => {
  const f = await fixture(t);
  const first = join(f.directory, 'first');
  const second = join(f.directory, 'second');
  const path = await f.skill(first, 'linked');
  await f.skill(second, 'linked');
  await mkdir(f.codex);
  const link = join(f.codex, 'alias');
  await symlink(dirname(path), link, process.platform === 'win32' ? 'junction' : 'dir');
  await mkdir(join(f.codex, 'loop'));
  await symlink(f.codex, join(f.codex, 'loop/back'), process.platform === 'win32' ? 'junction' : 'dir');
  const listed = await f.manager.list();
  assert.equal(listed.skills.length, 1);
  const document = await f.manager.read(listed.skills[0]!.id);
  const saved = await f.manager.save(document.id, source + 'Via link\n', document.revision);
  assert.equal(await readFile(path, 'utf8'), saved.content);
  await unlink(link);
  await symlink(join(second, 'linked'), link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.manager.save(document.id, source, saved.revision), /目标已变化/);
  await f.manager.list();
  await assert.rejects(f.manager.save(document.id, source, saved.revision), /其他程序修改/);
  assert.equal(await readFile(join(second, 'linked/SKILL.md'), 'utf8'), source);
});

test('reports an unreadable manifest while keeping other entries available', async (t) => {
  const f = await fixture(t);
  await f.skill(f.agents, 'valid');
  const invalid = join(f.codex, 'unreadable');
  const target = join(f.directory, 'directory-target');
  await mkdir(invalid, { recursive: true });
  await mkdir(target);
  await symlink(target, join(invalid, 'SKILL.md'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = await f.manager.list();
  assert.equal(result.skills.length, 2);
  assert.equal(result.skills.find(skill => skill.path.includes('unreadable'))!.status, 'unreadable');
});

test('uses CODEX_HOME only for the Codex root', () => {
  const previous = process.env.CODEX_HOME;
  try {
    process.env.CODEX_HOME = join(tmpdir(), 'custom-codex-home');
    const roots = userSkillRoots();
    assert.equal(roots[0]!.path, join(process.env.CODEX_HOME, 'skills'));
    assert.ok(roots[1]!.path.endsWith(join('.agents', 'skills')));
  } finally {
    if (previous === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previous;
  }
});
