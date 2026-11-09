# @workplatform/elect

Electron 应用，只打开一个 960 × 640 的窗口，包含左侧栏、工作区、插件市场和设置模态框。
窗口标题为 Workplatform，不显示菜单。左下角“设置”打开原生 dialog，支持关闭按钮、Esc 和点击遮罩关闭。
所有控件及模态框使用浏览器默认样式，只保留左侧栏及底部设置入口所需的基本布局。
目前没有具体设置项，不显示尚未实现的开关或配置。

在根目录执行 `pnpm run dev`，先统一编译所有包，再启动 Electron。
修改源码后关闭窗口，重新运行此命令即可。

`pnpm start` 自动按 core、app-boot、plugin-market、elect 的顺序构建并打开窗口。
构建与类型检查命令全部定义在根目录，子包只保留独立配置：

```sh
pnpm run build
pnpm run typecheck
```

本包使用独立的 package.json、tsconfig.json 和 tsconfig.build.json，开发工具及启动命令由根目录统一提供。

- `src/index.ts`：Electron 主进程入口，先调用 app-boot，窗口关闭时释放 Context 后退出；启动错误显示原生错误框。
- `dist/index.js`：编译后的主进程入口，由 package.json 的 main 字段指定。
- `index.html`：本地工作台、市场列表及原生设置模态框。
- `src/renderer.ts`：侧栏页面切换、插件列表及加载/关闭按钮，所有插件信息通过 textContent 展示。
- `src/preload.cts`：编译为 preload.cjs，使用 contextBridge 暴露市场状态、插件开关及服务状态变化订阅。
- `src/plugin-market-ipc.ts`：校验 IPC 来源和参数，每次查询可选市场服务；订阅服务变化以通知页面，不创建市场实例。
- `styles.css`：仅提供侧栏和工作区的基本布局，不包含装饰样式。

界面继续使用默认控件和最少布局，没有引入 React 或安装包构建。
插件市场列出启动时 YAML 配置的本地插件，可刷新运行状态、即时关闭及再次加载，不重启窗口。
市场自身也是 YAML 中的普通 Cordis 插件，未配置或关闭后隐藏侧栏入口并回到工作台。
关闭市场后当前界面不提供重新加载它的入口，重新启动应用将按 YAML 恢复。
操作不保存到 YAML，不包含在线下载或源码自动替换。
页面通过有限 preload 接口调用主进程，不获得 Node.js 或通用 IPC 权限。
实现参考：[Electron 最小应用教程](https://www.electronjs.org/docs/latest/tutorial/tutorial-first-app)。
