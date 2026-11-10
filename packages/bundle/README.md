# @workplatform/bundle

桌面插件装配包。package.json 声明可解析的插件依赖，cordis.patch.yml 按 insert 顺序指定要启动的插件。

当前配置三个真实插件：`@workplatform/plugin-market`（`plugin-market`）、
`@workplatform/skills-manager`（`skills-manager`）及 `@workplatform/tools`（`tools`）。它们通过 workspace 依赖链接，
由 boot 动态导入默认插件入口并调用 ctx.plugin 注册。
移除对应 YAML 配置后，应用不会加载该服务，侧栏也不会显示对应入口。

本包没有源码或独立构建命令，依赖安装与构建统一在根目录执行 `pnpm install`、`pnpm run build`。
Electron 宿主将本包声明为生产依赖；打包时连同 YAML、市场、Skills 和工具插件一起收录，启动不依赖源码目录。
市场关闭自身后服务和入口会消失；重新启动应用会根据未改写的 YAML 配置再次加载。
Skills 管理插件可在市场中独立关闭或重新加载；其关闭不会清除页面内存中的编辑草稿。
