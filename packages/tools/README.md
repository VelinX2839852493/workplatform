# 工具插件

`@workplatform/tools` 通过 Cordis 注册“工具”侧边栏和原生 DOM 页面，支持网址的增删改查、
单级分类与分类筛选。分类随条目保存，空分类归入“未分类”；点击名字用系统默认浏览器打开网页。
只允许 HTTP/HTTPS 网址，动态名字与分类按纯文本呈现。

开发环境固定保存到项目根目录 `config/tool/tools.json`，不依赖启动工作目录。
打包后保存到可执行文件旁的 `config/tool/tools.json`，应用目录需要有写入权限。
每次操作直接读取文件，重启、插件关闭再加载后保留已保存内容；写入失败会展示错误并保留输入。
`ToolStore` 是内部存储接口，`JsonToolStore` 是单 JSON 文件实现；没有数据库或额外运行依赖。

在根目录运行 `pnpm run check` 验证类型、持久化和插件生命周期，以及真实 Electron 的页面交互。
