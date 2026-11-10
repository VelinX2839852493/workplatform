# @workplatform/plugin-market

界面模板位于 `src/View.vue`，列表查询与插件启停逻辑位于外置脚本 `src/view.ts`。
`src/client.ts` 只负责 Vue 面板挂载与卸载；构建后仍输出本包 `dist/client.js`，
保持通用插件模块契约，并在卸载时停止更新页面状态。

真正的 Cordis 插件，默认导出包含 inject 和 apply 的插件对象。
由 `packages/bundle/cordis.patch.yml` 配置加载，app-boot 没有直接依赖或创建市场服务。
插件依赖通用 `pluginRuntime` 和 `slots` 服务，启用时在自己的 Fiber 上提供 `pluginMarket`，卸载时由 Cordis 自动移除。
PluginMarket 复用 PluginRuntime 的管理接口；通用生命周期由启动内核的 LocalPluginRuntime 实现。

- `list()`：按配置顺序返回 id、包名和当前状态，可区分已加载、等待依赖、处理中、失败与关闭。
- `load(id)`：从 bundle/package.json 为起点解析模块，导入默认导出并等待注册完成；已加载时不会重复创建。
- `close(id)`：等待 Fiber 释放服务、事件及 effect，然后允许再次加载。

当前目录来自启动时读取的 cordis.patch.yml，操作仅影响当前运行，不改写 YAML。
插件通过 `ctx.slots.register` 向 `sidebar.panellist` 注册导航，向 `main` 注册本包
`client.js`；通过 `ctx.slots.handle` 注册有限的列表和开关请求，所有注册由 effect 托管。
宿主按注册表注入侧栏和面板。市场可在列表中关闭自身；此时服务、请求、页面和入口都消失，
根 Context 的通用运行时仍存在，可再次加载。当前界面在市场关闭后不提供管理入口，重新启动会按 YAML 恢复。
本包不查询在线注册表、不安装插件，也不监听源码文件变化；关闭再加载会重新运行插件入口，模块仍遵循 Node.js 的导入缓存。
插件需要使用 Cordis effect 或自身生命周期回调登记资源，才能在关闭时完整释放。
`required` 目前仍是配置元数据，所有已配置插件均可手动关闭。

类型检查和构建统一在根目录执行 `pnpm run typecheck`、`pnpm run build`。
运行根目录 `pnpm test` 验证真实默认插件注册、服务随 Fiber 移除、YAML 加载市场和市场再次加载。
通用生命周期、失败恢复和无效插件测试位于 app-boot/test/runtime.test.ts。
