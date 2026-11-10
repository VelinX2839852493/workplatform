# 工具插件

界面模板位于 `src/View.vue`，通过外置脚本 `src/view.ts` 维护表单、筛选和请求状态，
布局位于 `src/view.css`。`src/client.ts` 只适配通用面板的挂载与卸载，释放 Vue 实例和样式。
Vue 模板预编译到本包 `dist/client.js`，沿用原有动态插件接口。

`@workplatform/tools` 通过 Cordis 注册“工具”侧边栏和 Vue 页面，支持网址的增删改查、
单级分类与分类筛选。分类随条目保存，空分类归入“未分类”；点击名字用系统默认浏览器打开网页。
只允许 HTTP/HTTPS 网址，动态名字与分类按纯文本呈现。

开发环境固定保存到项目根目录 `config/tool/tools.json`，不依赖启动工作目录。
打包后保存到可执行文件旁的 `config/tool/tools.json`，应用目录需要有写入权限。
每次操作直接读取文件，重启、插件关闭再加载后保留已保存内容；写入失败会展示错误并保留输入。
`ToolStore` 是内部存储接口，`JsonToolStore` 是单 JSON 文件实现；没有数据库或额外运行依赖。

在根目录运行 `pnpm run check` 验证类型、持久化和插件生命周期，以及真实 Electron 的页面交互。
