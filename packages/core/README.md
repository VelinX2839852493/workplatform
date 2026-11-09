# @workplatform/core

公共逻辑包，提供 `GreetingService` 接口及 `DefaultGreetingService` 实现。
应用通过 `@workplatform/core` 引用公共入口，不跨包导入内部文件。

- `src/index.ts`：公共导出。
- `src/greeting.ts`：问候服务接口与实现。
- `test/`：问候服务行为测试。
- `dist/`：构建产物，包含 JavaScript、类型声明及源码映射。

构建及类型检查统一在根目录执行 `pnpm run build`、`pnpm run typecheck`。
本包只保留独立 TypeScript 配置，不提供构建或类型检查脚本。
在根目录执行 `pnpm --filter @workplatform/core test` 可单独运行本包测试。
开发模式启用 `development` 条件时加载源码；默认加载 dist 中的构建产物。
类型检查始终使用构建生成的类型声明。
