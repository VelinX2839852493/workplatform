# @workplatform/bundle

桌面插件装配包。package.json 声明可解析的插件依赖，cordis.patch.yml 按 insert 顺序指定要启动的插件。

当前配置唯一真实插件 `@workplatform/plugin-market`，标识为 `plugin-market`。
它通过 workspace 依赖链接到 packages/plugin-market，由 boot 动态导入默认插件入口并调用 ctx.plugin 注册。
移除这条 YAML 配置后，应用不会加载市场服务，侧栏也不会显示市场入口。

本包没有源码或独立构建命令，依赖安装与构建统一在根目录执行 `pnpm install`、`pnpm run build`。
市场关闭自身后服务和入口会消失；重新启动应用会根据未改写的 YAML 配置再次加载。
