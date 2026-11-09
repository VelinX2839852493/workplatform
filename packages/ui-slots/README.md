# 桌面 UI 插槽

参考 DSH 的 `sidebar.panellist` 与 `main` 组合方式。宿主提供插槽和渲染容器，
业务插件拥有导航信息和客户端模块，通过 Cordis effect 注册，卸载时撤销。
保留原生 DOM，不引入 DSH 的 React 渲染器或完整插槽引擎。

```ts
// 插件声明 inject: ['slots']，在 apply(ctx) 内注册：
ctx.effect(() => ctx.slots.register({
  name: 'main', key: 'example', entry: new URL('./client.js', import.meta.url).href
}));
ctx.effect(() => ctx.slots.register({
  name: 'sidebar.panellist', id: 'example', label: '示例', order: 10
}));
```

客户端模块默认导出 `PanelModule`，`mount(container, {client, draft})` 获得容器、
有限请求接口及先前草稿，返回 `dispose()` 和可选 `snapshot()`。
`snapshot()` 返回 `{ dirty, value }`，卸载后宿主只保留数据，不保留页面监听。
插件通过 `ctx.slots.handle(method, handler)` 注册有限请求，处理器在入口校验参数。
通过扩充 `DesktopRequestMap` 获得客户端类型；卸载时一并撤销请求。

Electron 主进程只桥接快照和已注册请求，渲染器按 order 稳定排列导航；
导航和 main 同时存在才显示入口。新增业务插件无需修改 Electron HTML、侧栏渲染器、
主进程或 preload。运行 `pnpm run check` 验证注册、通知、重复键及 Fiber 自动清理。
