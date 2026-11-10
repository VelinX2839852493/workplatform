/**
 * @author Codex
 * @date 2026-11-09
 * 从隔离目录启动打包后的真实入口，通过本地 DevTools 验证 ASAR 内的插件、preload 和页面。
 * 仅在显式执行 test:pack 时运行，不读取用户真实 Skills，不依赖源码目录或开发版 Electron。
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

test('packaged Windows app boots all plugin panels outside the repository', { timeout: 30000 }, async (t) => {
  const executable = fileURLToPath(new URL('../../../release/win-unpacked/Workplatform.exe', import.meta.url));
  const directory = await mkdtemp(join(tmpdir(), 'workplatform-packaged-'));
  let child: ChildProcessWithoutNullStreams | undefined;
  const profile = join(directory, 'profile');
  const roaming = join(directory, 'roaming');
  const local = join(directory, 'local');
  await mkdir(roaming);
  await mkdir(local);
  t.after(async () => {
    // 先退出本测试启动的应用，再清理已验证归属的临时目录；无入参、无返回值。
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.ok(directory.startsWith(join(tmpdir(), 'workplatform-packaged-')));
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  const environment: NodeJS.ProcessEnv = {
    ...process.env, APPDATA: roaming, LOCALAPPDATA: local,
    USERPROFILE: directory, HOME: directory, CODEX_HOME: join(directory, '.codex')
  };
  delete environment.ELECTRON_RUN_AS_NODE;
  child = spawn(executable, [
    '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    '--user-data-dir=' + profile, '--disable-gpu'
  ], { cwd: directory, env: environment, windowsHide: true, timeout: 25000 });
  let diagnostics = '';
  child.stdout.on('data', chunk => { diagnostics += String(chunk); });
  child.stderr.on('data', chunk => { diagnostics += String(chunk); });
  const deadline = Date.now() + 15000;
  let port = '';
  while (!port && Date.now() < deadline) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]!; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await delay(100);
    }
  }
  assert.ok(port, '应用未开启调试端口：\n' + diagnostics);
  let page: { url: string; webSocketDebuggerUrl: string } | undefined;
  while (!page && Date.now() < deadline) {
    const response = await fetch('http://127.0.0.1:' + port + '/json/list');
    const targets = await response.json() as { type: string; url: string; webSocketDebuggerUrl: string }[];
    page = targets.find(target => target.type === 'page' && target.url.includes('app.asar'));
    if (!page) await delay(100);
  }
  assert.ok(page, '未加载 ASAR 中的宿主页面：\n' + diagnostics);
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise<void>((fulfill, reject) => {
    socket.addEventListener('open', () => fulfill(), { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  t.after(() => { socket.close(); });
  let nextId = 0;

  /** @param expression 页面内执行的表达式。@returns DevTools 返回的序列化值，异常时拒绝。 */
  async function evaluate(expression: string): Promise<unknown> {
    const id = ++nextId;
    return new Promise((fulfill, reject) => {
      /** @param event 本地 DevTools 响应。@returns 无返回值，匹配当前请求并完成 Promise。 */
      function receive(event: MessageEvent): void {
        const message = JSON.parse(String(event.data));
        if (message.id !== id) return;
        socket.removeEventListener('message', receive);
        if (message.error || message.result.exceptionDetails) reject(new Error(JSON.stringify(message)));
        else fulfill(message.result.result.value);
      }
      socket.addEventListener('message', receive);
      socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
    });
  }

  const ready = "document.querySelectorAll('#plugin-navigation a').length === 3 && document.querySelector('[data-panel=plugin-market] h1') && document.querySelector('[data-panel=skills-manager] h1') && document.querySelector('[data-panel=tools] h1')";
  while (!await evaluate('Boolean(' + ready + ')') && Date.now() < deadline) await delay(100);
  assert.equal(await evaluate('Boolean(' + ready + ')'), true, '插件客户端未挂载：\n' + await evaluate('document.body.innerText'));
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#plugin-navigation a'), link => link.textContent)"), ['插件市场', 'Skills 管理', '工具']);
  assert.equal(await evaluate("typeof window.desktopUi?.getSnapshot"), 'function');
  assert.equal(await evaluate("document.querySelector('#shell-message').textContent"), '');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('aside')).display"), 'flex');
  t.diagnostic('真实打包入口、任意工作目录、ASAR 插件配置、三个插件客户端、preload 桥接及宿主 CSS 均通过');
});
