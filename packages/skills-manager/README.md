# Skills 管理插件

界面模板位于 `src/View.vue`，搜索、编辑和保存逻辑位于外置脚本 `src/view.ts`，
布局位于 `src/view.css`。`src/client.ts` 适配 Vue 挂载、草稿快照和卸载；
构建后继续以 `dist/client.js` 动态加载，插件重载仍恢复文件版本、编辑草稿和搜索条件。

`@workplatform/skills-manager` 是由 bundle 加载的 Cordis 插件。启用时提供
`ctx.skillsManager`，卸载时移除服务并停止文件操作，不依赖 Electron。

扫描 `$CODEX_HOME/skills`（默认 `~/.codex/skills`）及 `~/.agents/skills`，排除
`.system`；支持嵌套技能目录、目录链接及循环检测。只编辑已发现的 `SKILL.md`，
不安装、删除、运行技能，也不修改 `config.toml` 或配套文件。

服务接口：`list()` 返回条目和扫描错误；`read(id)` 返回完整源码和版本；
`save(id, content, revision)` 校验 YAML 的 name、description 后写回原文件。
同名技能按路径区分，链接目标变化或文件内容版本冲突会阻止保存。
保存保留 UTF-8 BOM 和原换行风格，经同目录临时文件刷新后替换目标文件。
这是保存前的乐观版本检查，不是对其他程序实施文件锁。

插件依赖通用 `slots` 服务，通过 Cordis effect 向 `sidebar.panellist` 注册导航项，向
`main` 注册本包的 `client.js`；通过 `slots.handle` 注册列表、读取和保存请求。
卸载会撤销导航、面板与请求，Electron 不需要了解 Skills 的入口、路由或服务。
页面从宿主注入的 `client` 调用请求；用户可搜索、手动刷新、编辑完整 Markdown 并保存。
插件卸载时由 `snapshot()` 交出草稿，宿主暂存，重载时重新注入；页面自己的事件和样式会清理。
系统技能和插件缓存不在管理范围。Codex 通常自动发现修改；未显示更新时可重启 Codex。
参见 [官方 Skills 文档](https://learn.chatgpt.com/docs/build-skills)。

在根目录运行 `pnpm run check`；文件测试全部使用临时目录，不修改用户技能。
