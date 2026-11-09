/**
 * @author Codex
 * @date 2026-11-09
 * Electron 集成验收：加载真实 preload、宿主和插件模块，全部 Skills 来自测试目录。
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { app, BrowserWindow } from 'electron';
import boot from '@workplatform/app-boot';
import { registerDesktopUiIpc } from '../dist/desktop-ui-ipc.js';

const directory = process.argv[2];
const checks = [];
app.on('window-all-closed', () => {});
let window;
let context;

/** @param code 渲染进程表达式。@returns 真实渲染进程执行结果，声明用户手势以覆盖卸载保护。 */
async function evaluate(code) { return window.webContents.executeJavaScript(code, true); }

/** @param code 渲染进程条件。@returns 条件满足时兑现的 Promise，5 秒后报告错误。 */
async function waitFor(code) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await evaluate(code)) return;
    await delay(25);
  }
  throw new Error('页面等待超时：' + code + '\n' + await evaluate('JSON.stringify({ width: window.innerWidth, columns: document.querySelector(".skills-layout") && getComputedStyle(document.querySelector(".skills-layout")).gridTemplateColumns })') + '\n' + await evaluate('document.body.innerText'));
}

/** @returns 全部真实窗口断言完成后的 Promise。 */
async function run() {
  const codex = join(directory, '.codex/skills/alpha');
  const agents = join(directory, '.agents/skills/beta');
  await mkdir(codex, { recursive: true });
  await mkdir(agents, { recursive: true });
  const source = '---\nname: alpha-demo\ndescription: 测试用户技能\nextra: keep\n---\n\n# Alpha\n原始内容。\n';
  const file = join(codex, 'SKILL.md');
  await writeFile(file, source);
  await writeFile(join(agents, 'SKILL.md'), source.replace('alpha-demo', 'beta-demo'));
  await app.whenReady();
  context = await boot('ElectronTest');
  window = new BrowserWindow({ show: false, width: 960, height: 640, webPreferences: {
    offscreen: true, backgroundThrottling: false,
    preload: fileURLToPath(new URL('../dist/preload.cjs', import.meta.url))
  } });
  registerDesktopUiIpc(window, context);
  await window.loadFile(fileURLToPath(new URL('../index.html', import.meta.url)));
  await waitFor("document.querySelectorAll('#plugin-navigation a').length === 2 && document.querySelectorAll('#skill-list button').length === 2");
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#plugin-navigation a'), link => link.textContent)"), ['插件市场', 'Skills 管理']);
  checks.push('双目录列表及插件注册导航');

  const example = join(directory, 'example.mjs');
  await writeFile(example, '/** @author Codex @date 2026-11-09 测试插件页面。 */\nexport default { mount(container) { container.textContent = "动态注入成功"; return { dispose() {} }; } };');
  const removeMain = context.slots.register({ name: 'main', key: 'example', entry: pathToFileURL(example).href });
  const removeSidebar = context.slots.register({ name: 'sidebar.panellist', id: 'example', label: '动态示例', order: 15 });
  await waitFor("document.querySelector('[data-panel=example]')?.textContent === '动态注入成功'");
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#plugin-navigation a'), link => link.textContent)"), ['插件市场', '动态示例', 'Skills 管理']);
  await evaluate("location.hash = '#example'");
  await waitFor("document.querySelector('[data-panel=example]')?.hidden === false");
  removeSidebar();
  removeMain();
  await waitFor("!document.querySelector('[data-panel=example]') && location.hash === '#workspace'");
  checks.push('新插件动态注册、排序、路由及撤销，无需改宿主');

  await evaluate("location.hash = '#skills-manager'; document.querySelector('#skill-list button').click()");
  await waitFor("document.querySelector('#skill-content')?.value.includes('# Alpha')");
  await evaluate("document.querySelector('#skill-search').value = 'beta'; document.querySelector('#skill-search').dispatchEvent(new Event('input'))");
  assert.equal(await evaluate("document.querySelectorAll('#skill-list button').length"), 1);
  await evaluate("document.querySelector('#skill-search').value = ''; document.querySelector('#skill-search').dispatchEvent(new Event('input'))");
  checks.push('搜索过滤及源码读取');

  await evaluate("document.querySelector('#skill-content').value += '\\nDraft retained'; document.querySelector('#skill-content').dispatchEvent(new Event('input'))");
  await evaluate("window.confirm = () => false; document.querySelectorAll('#skill-list button')[1].click(); document.querySelector('#reload-skill').click()");
  assert.ok(await evaluate("document.querySelector('#skill-content').value.includes('Draft retained')"));
  checks.push('切换技能和重新读取的未保存保护');

  await context.pluginRuntime.close('skills-manager');
  await waitFor("!document.querySelector('[data-panel=skills-manager]') && location.hash === '#workspace'");
  await assert.rejects(context.slots.invoke('skills-manager:list', []), /未注册或已卸载/);
  await context.pluginRuntime.load('skills-manager');
  await waitFor("document.querySelector('#skill-content')?.value.includes('Draft retained') && document.querySelectorAll('#skill-list button').length === 2");
  checks.push('插件卸载清理及重载恢复编辑草稿');

  await evaluate("location.hash = '#skills-manager'; document.querySelector('#save-skill').click()");
  await waitFor("document.querySelector('#skills-message').textContent.startsWith('已保存')");
  assert.ok((await readFile(file, 'utf8')).includes('Draft retained'));
  assert.equal(await evaluate("document.querySelector('#save-skill').disabled"), true);
  checks.push('通过插件注册请求保存并更新版本');

  const saved = await readFile(file, 'utf8');
  await evaluate("document.querySelector('#skill-content').value = 'invalid'; document.querySelector('#skill-content').dispatchEvent(new Event('input')); document.querySelector('#save-skill').click()");
  await waitFor("document.querySelector('#skills-message').textContent.includes('frontmatter')");
  assert.equal(await readFile(file, 'utf8'), saved);
  await evaluate("window.confirm = () => true; document.querySelector('#reload-skill').click()");
  await waitFor("document.querySelector('#skill-content').value.includes('Draft retained')");
  checks.push('校验失败保留草稿且不改文件');

  await writeFile(file, saved + '\nExternal edit');
  await evaluate("document.querySelector('#skill-content').value += '\\nConflicting draft'; document.querySelector('#skill-content').dispatchEvent(new Event('input')); document.querySelector('#save-skill').click()");
  await waitFor("document.querySelector('#skills-message').textContent.includes('其他程序修改')");
  assert.ok(await evaluate("document.querySelector('#skill-content').value.includes('Conflicting draft')"));
  assert.ok((await readFile(file, 'utf8')).endsWith('External edit'));
  checks.push('外部修改冲突不会覆盖文件');

  window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: 600, height: 640, deviceScaleFactor: 1, mobile: false });
  await waitFor("window.innerWidth <= 600 && getComputedStyle(document.querySelector('.skills-layout')).gridTemplateColumns.trim().split(' ').length === 1");
  checks.push('窄窗口上下布局');
  await window.webContents.debugger.sendCommand('Emulation.clearDeviceMetricsOverride');
  await waitFor("window.innerWidth > 760");
  window.webContents.debugger.detach();

  await assert.rejects(context.slots.invoke('skills-manager:save', ['../SKILL.md', source, 'invalid']), /参数无效/);
  await assert.rejects(context.slots.invoke('unregistered:read', []), /未注册或已卸载/);
  checks.push('注册请求的参数及未知方法校验');

  const other = new BrowserWindow({ show: false, webPreferences: { preload: fileURLToPath(new URL('../dist/preload.cjs', import.meta.url)) } });
  await other.loadURL('about:blank');
  await assert.rejects(other.webContents.executeJavaScript('window.desktopUi.getSnapshot()'), /不允许的桌面 UI 请求来源/);
  other.destroy();
  checks.push('拒绝其他窗口的桥接请求');

  await evaluate("location.hash = '#plugin-market'; document.querySelector('[aria-label=\"关闭 @workplatform/plugin-market\"]').click()");
  await waitFor("!document.querySelector('[data-panel=plugin-market]') && location.hash === '#workspace'");
  assert.ok(await evaluate("document.querySelector('#skill-content').value.includes('Conflicting draft')"));
  await context.pluginRuntime.load('plugin-market');
  await waitFor("document.querySelector('[data-panel=plugin-market]') && document.querySelectorAll('#plugin-navigation a').length === 2");
  checks.push('市场自关闭及重载不影响 Skills 草稿');

  let prevented = false;
  window.webContents.on('will-prevent-unload', () => { prevented = true; });
  window.close();
  const closeDeadline = Date.now() + 3000;
  while (!prevented && Date.now() < closeDeadline) await delay(25);
  assert.equal(prevented, true, '未保存修改应阻止窗口关闭');
  assert.equal(window.isDestroyed(), false);
  checks.push('窗口关闭前阻止丢失未保存草稿');
}

/** @param failure 测试错误或 undefined。@returns 写出结果并退出后的 Promise。 */
async function finish(failure) {
  if (window && !window.isDestroyed()) window.destroy();
  if (context) await context.fiber.dispose();
  await writeFile(join(directory, 'report.json'), JSON.stringify({ ok: !failure, checks, error: failure?.stack }));
  app.exit(failure ? 1 : 0);
}

// Electron 在主模块求值结束后才发出 ready，不能在模块顶层等待 app.whenReady()。
app.setPath('userData', join(directory, 'profile'));
app.disableHardwareAcceleration();
void run().then(() => finish(undefined), finish);
