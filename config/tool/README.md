# 工具配置

工具页面首次保存时自动创建 `tools.json`，以 UTF-8 JSON 数组保存 `id`、`name`、`url`、`category`。
应用重启后继续读取本目录的文件。备份或迁移时复制 `tools.json` 即可。
本地工具数据不提交到 Git。
