# @workplatform/elect

Electron 单窗口宿主，默认 960 × 640，左侧工作台和底部设置入口使用原生控件。
设置为原生 dialog，支持关闭按钮、Esc 和遮罩关闭；目前没有具体设置项。

宿主仅持有 Cordis Context 和通用 slots 注册表：

- `index.html` 只声明工作台、设置、导航容器和面板容器，不包含业务入口和页面。
- `src/renderer.ts` 订阅注册表，消费 `sidebar.panellist` 生成导航，按 `main` 加载客户端模块。
- `src/desktop-ui-ipc.ts` 校验主页面请求，桥接快照和已注册的方法；窗口关闭时撤销桥接。
- `src/preload.cts` 暴露有限的 `window.desktopUi`，不暴露 Node.js 或任意 IPC 通道。
- `src/index.ts` 启动应用和通用桥接，统一处理未保存草稿的关闭确认。

业务插件自己的 `apply` 注册导航、面板模块和请求，卸载时由 effect 撤销。
客户端模块收到容器和请求接口，返回 dispose 与可选的 snapshot。
在页面之间切换保留实例；插件卸载时暂存草稿数据并释放实例，重载后把草稿重新注入。
删除当前页面的注册时自动回到工作台。新增业务插件无需编辑宿主 HTML、渲染器或 preload。

默认 bundle 加载插件市场和 Skills 管理，两者的页面、业务代码和样式由各自包持有。
Skills 页面支持完整 SKILL.md 编辑、手动刷新、未保存提示、冲突保护及窄窗口上下布局。
插件开关只影响当前运行，重启按 YAML 恢复。市场自关闭后，当前界面无入口重新加载市场。

在根目录运行 `pnpm run dev` 构建并启动；修改源码后关闭窗口并重新运行。
构建顺序是 ui-slots、core、app-boot、plugin-market、skills-manager、elect。
`pnpm run check` 包含类型检查、所有包测试及构建。

`test/desktop-ui.electron.mjs` 使用真实 Electron preload、IPC、宿主和插件模块，在隐藏窗口
验收动态插件注入、排序、卸载/重载、草稿恢复、保存/冲突、参数与窗口校验和关闭保护。
技能根目录及 Electron 用户数据均放在隔离临时目录，不读写用户真实技能。
窄窗口测试通过 Chromium 视口模拟检查 CSS 布局，不依赖截图或 GPU。

参考 [Electron 应用教程](https://www.electronjs.org/docs/latest/tutorial/tutorial-first-app)。
