# @workplatform/app-boot

应用启动包，默认导出 `boot(appName: string): Promise<Context>`。
读取进程工作目录下 `packages/bundle/cordis.patch.yml`，以 bundle/package.json 为模块解析起点，
创建通用插件运行时并顺序加载每个插件的默认导出，不直接依赖或注册插件市场。
运行时通过返回 Context 的 `pluginRuntime` 服务提供加载、关闭及状态查询。
同时提供通用 `slots` 注册表供插件注册侧栏、主面板和有限请求；不在启动内核枚举业务入口。
返回的 Context 由应用退出流程调用 `ctx.fiber.dispose()` 释放。

- `src/index.ts`：创建 Context 和 LocalPluginRuntime，按配置顺序加载所有插件。
- `src/plugin-runtime.ts`：通用 PluginRuntime 接口及 LocalPluginRuntime 实现，使用 ctx.plugin 注册并保存各 Fiber。
- `src/read-desktop-plugins.ts`：公开配置读取函数和 DesktopPlugin 接口，内部 PluginPatch 接口对应 YAML 补丁。
- `tsconfig.json`：继承根目录 TypeScript 基础配置。
- `tsconfig.build.json`：将源码、类型声明及源码映射输出到本包 dist。
- `package.json`：独立包信息及公共入口。

在根目录执行以下命令统一检查或构建所有包：

```sh
pnpm run typecheck
pnpm run build
```

构建后可通过包名 `@workplatform/app-boot` 导入。开发工具和构建命令统一由根目录提供。

插件市场也使用普通插件配置，当前 bundle 中实际配置为：

```yaml
- insert:
    - id: plugin-market
      name: '@workplatform/plugin-market'
      required: true
    - id: skills-manager
      name: '@workplatform/skills-manager'
      required: true
```

`readDesktopPlugins(path)` 直接读取并解析 YAML，通过 flatMap 按顺序展开各段 insert。
`id` 与 `required` 保留为配置元数据；当前流程注册所有条目，仅使用 name 解析模块。
没有配置文件时 boot 返回空 Context；显式读取缺失文件、YAML 语法错误和模块加载错误均抛出。
appName 用于启动日志命名，当前不按应用名称筛选插件。
没有业务插件条目时，仅有通用运行时和 slots 注册表，不会提供 pluginMarket 或 skillsManager 服务。

`test/boot.test.ts` 在临时目录验证顺序展开、读取异常、空启动、bundle 模块解析及插件注册顺序。
测试不向项目的 bundle 目录写入插件。运行根目录 `pnpm test` 执行全部测试。
`test/runtime.test.ts` 验证通用加载、资源清理、关闭后恢复、错误处理和无效插件。
