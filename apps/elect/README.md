# @workplatform/elect

Electron 单窗口宿主，默认 1280 × 800，使用浅色主题、深绿色选中态和统一的原生表单控件样式。
设置为原生 dialog，支持关闭按钮、Esc 和遮罩关闭；目前没有具体设置项。

`styles.css` 持有共享配色变量、导航、按钮、表单、表格和对话框样式；业务插件保留各自的布局 CSS。
启动直接进入侧栏首个插件页面，不提供独立工作台首页。600px 及以下宽度改为顶部导航，
Skills 在窄窗口上下排列，主内容区独立滚动并预留滚动条宽度，页面切换时保持对齐。

宿主仅持有 Cordis Context 和通用 slots 注册表：

- `index.html` 只提供 Vue 挂载点，`src/renderer.ts` 挂载宿主组件。
- `src/Shell.vue` 声明设置、导航和插件容器模板；通过外置 `script src` 引用 `src/shell.ts`。
- `src/shell.ts` 订阅注册表，消费 `sidebar.panellist` 生成导航，按 `main` 加载客户端模块。
- `src/desktop-ui-ipc.ts` 校验主页面请求，桥接快照和已注册的方法；窗口关闭时撤销桥接。
- `src/preload.cts` 暴露有限的 `window.desktopUi`，不暴露 Node.js 或任意 IPC 通道。
- `src/index.ts` 启动应用和通用桥接，统一处理未保存草稿的关闭确认。

业务插件自己的 `apply` 注册导航、面板模块和请求，卸载时由 effect 撤销。
客户端模块收到容器和请求接口，返回 dispose 与可选的 snapshot。
在页面之间切换保留实例；插件卸载时暂存草稿数据并释放实例，重载后把草稿重新注入。
初始路由、未知路由及当前页面被卸载时，自动选择按侧栏顺序排列的第一个页面；
全部页面卸载后显示空状态，重新注册页面后自动进入。新增业务插件无需编辑宿主 HTML、渲染器或 preload。

默认 bundle 加载插件市场、Skills 管理和工具，页面、业务代码和样式由各自包持有。
工具支持网址增删改查、分类筛选和系统浏览器跳转，保存到根目录 `config/tool/tools.json`。
Skills 页面支持完整 SKILL.md 编辑、手动刷新、未保存提示、冲突保护及窄窗口上下布局。
插件开关只影响当前运行，重启按 YAML 恢复。市场自关闭后，当前界面无入口重新加载市场。

在根目录运行 `pnpm run dev` 构建并启动；修改源码后关闭窗口并重新运行。
构建顺序是 ui-slots、core、app-boot、plugin-market、skills-manager、tools、elect。
`pnpm run check` 包含类型检查、所有包测试及构建。

界面使用 Vue 3，HTML 模板、TypeScript 逻辑和 CSS 分别存放；三个业务插件使用相同结构。
`scripts/build-ui.mjs` 使用 Vite 和官方 Vue 插件预编译模板，分别生成宿主 `dist/renderer.js`
与各插件 `dist/client.js`，浏览器直接加载，不依赖开发服务器或运行时模板编译。
每个面板独立挂载 Vue 应用，继续实现通用 `PanelModule` 接口；卸载释放组件和插件样式。
渲染端通过根目录 `tsconfig.renderer.json` 开启严格模板检查，Node.js 端仍使用原有配置。
现有 TypeScript 7 用于 Node.js 构建；`typescript-vue` 别名固定 TypeScript 6，
由 `scripts/typecheck-ui.cjs` 运行需要编译器 API 的 vue-tsc，避免更换项目主编译器。
可单独运行 `pnpm run build:ui` 构建界面；编辑器推荐使用 Vue - Official 扩展。

外置脚本规则参考 [Vue SFC src 引用](https://vuejs.org/api/sfc-spec.html#src-imports)，
模板检查参考 [Vue TypeScript 工具说明](https://vuejs.org/guide/typescript/overview.html)。

## Windows 打包

在 Windows x64 环境的项目根目录执行：

- `pnpm run pack`：先构建，再生成 `release/win-unpacked/Workplatform.exe` 及运行所需文件。
- `pnpm run dist`：先构建，再生成 `release/Workplatform-0.1.0-x64-setup.exe` NSIS 安装包。

`win-unpacked` 必须作为完整目录分发；安装包支持选择安装目录，默认按当前用户安装，完成后不自动启动。
产物名称中的版本取本包 package.json。打包命令均禁止自动发布，产物保留在被 Git 忽略的 release 目录。
当前未配置代码签名证书，生成的 Windows 产物未签名，使用 Electron 默认图标。
首次打包需要联网下载 Electron 及 Windows 打包工具。

根目录 `electron-builder.yml` 以本包为应用目录，将主进程、preload、渲染器、HTML、CSS
和生产依赖收录到 ASAR。宿主显式依赖 `@workplatform/bundle`，其 YAML 和插件依赖随应用分发。
启动通过包解析定位配置，不要求工作目录指向源码仓库；插件客户端也从包内加载。

配置参考 [electron-builder 应用内容](https://www.electron.build/v26/docs/contents/)
及 [NSIS 配置](https://www.electron.build/v26/docs/nsis/)。

`test/desktop-ui.electron.mjs` 使用真实 Electron preload、IPC、宿主和插件模块，在隐藏窗口
验收动态插件注入、排序、卸载/重载、草稿恢复、保存/冲突、参数与窗口校验和关闭保护。
技能根目录及 Electron 用户数据均放在隔离临时目录，不读写用户真实技能。
窄窗口测试通过 Chromium 视口模拟检查 CSS 布局，不依赖截图或 GPU。

参考 [Electron 应用教程](https://www.electronjs.org/docs/latest/tutorial/tutorial-first-app)。
