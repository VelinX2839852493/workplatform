# TypeScript 脚手架

这是一个使用 pnpm workspace、TypeScript 和 ESM 的多包项目。
需要 Node.js 24 或更高版本及 pnpm 11.7.0。依赖由 `pnpm-lock.yaml` 锁定。

## 使用

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

开发命令先统一编译所有包，启动 Cordis 上下文，再打开标题为 Workplatform 的工作台窗口；关闭窗口时释放上下文并退出。
修改源码后重新执行开发命令。

| 命令 | 用途 |
| --- | --- |
| `pnpm run dev` | 在根目录统一构建所有包，再启动单窗口 Electron 应用 |
| `pnpm run typecheck` | 先在根目录构建 app-boot、plugin-market 的跨包类型契约，再检查各包源码和测试 |
| `pnpm test` | 执行有 test 脚本的工作区包的测试 |
| `pnpm run build` | 在根目录直接执行 tsc，依次构建 core、app-boot、plugin-market、elect，各自输出到包内 dist |
| `pnpm start` | 先统一构建所有包，再通过 Electron 打开窗口 |
| `pnpm run check` | 依次执行类型检查、测试、构建 |

## 目录与配置

- `packages/core/`：公共逻辑包，包名 `@workplatform/core`。
- `packages/plugin-market/`：真正的 Cordis 市场插件，启用时提供市场服务，卸载时移除服务与侧栏入口。
- `packages/boot/app-boot/`：应用启动包，包名 `@workplatform/app-boot`，读取 YAML 补丁并顺序注册插件。
- `packages/bundle/`：实际插件装配包，package.json 依赖市场插件，cordis.patch.yml 指定其启动注册。
- `apps/elect/`：最小 Electron 应用包，包名 `@workplatform/elect`。
- `docs/`：项目包的用途、命令及配置说明。
- `tsconfig.base.json`：共享严格检查及 NodeNext 配置，各包继承此文件。
- 各包的 `tsconfig.json`：本包类型检查范围。
- 各包的 `tsconfig.build.json`：本包构建范围、产物目录及输出选项。
- 根目录 `package.json`：统一开发依赖、工作区、构建、类型检查、开发与启动命令。
- 各包 `package.json`：独立声明包信息、业务依赖、公共入口及相关测试脚本。
- `pnpm-workspace.yaml`：注册工作区，配置 Electron 使用的 hoisted 布局，并只允许 esbuild 安装脚本执行。
- `pnpm-lock.yaml`：pnpm 自动生成的依赖锁文件，不手工修改。

所有安装操作均在根目录使用 pnpm 执行。内部依赖使用 `workspace:*`，跨包调用通过包名及公共 exports 引用。
不混用 npm 安装，避免 node_modules 被不同包管理器反复迁移。
core 与 app-boot 通过 `development` 条件提供源码入口，默认提供 dist 产物和类型声明。
elect 通过包名调用 app-boot，在主进程持有 Context；渲染页面不访问 Node.js 或 Cordis。
新增包后按实际依赖关系调整根目录构建顺序。

运行依赖由实际消费它们的包声明；app-boot 和 plugin-market 使用同一版本的 Cordis，yaml 由 app-boot 使用。
`^4.0.5` 允许兼容的 4.x 版本，
本次安装的具体版本由 pnpm-lock.yaml 锁定。
`packages/boot/*` 单独注册为嵌套工作区。bundle 现已加入真实市场插件依赖和配置，不再是空目录。

插件配置使用 `- insert:` 补丁数组，格式及行为详见 `packages/boot/app-boot/README.md`。
没有配置文件时按无插件启动。当前真实配置通过普通插件流程加载 @workplatform/plugin-market。
app-boot 只创建通用 pluginRuntime，不创建市场服务。市场插件被加载后，侧栏才显示入口。
侧栏“插件市场”展示这份启动配置中的插件，支持在当前运行中加载或关闭，状态不写回配置。

文件头中的 `@author Codex` 标记初始生成者，`@date 2026-11-06` 标记创建日期。

配置依据：[TypeScript 配置文档](https://www.typescriptlang.org/tsconfig/)、[pnpm workspace 文档](https://pnpm.io/workspaces)、[Node.js 条件导出文档](https://nodejs.org/api/packages.html#conditional-exports)。
