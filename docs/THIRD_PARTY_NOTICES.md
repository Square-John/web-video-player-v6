# Third-Party Notices

Web Video Player 源码采用 MIT License。项目使用的第三方软件仍按各自许可证授权；本文件列出当前主要直接运行和生产构建依赖，不能替代安装包内各项目的完整许可证文本，也不宣称覆盖传递依赖。

## 前端运行依赖

| 项目 | Package | 许可证 | 用途 | 项目地址 |
|---|---|---|---|---|
| Vue.js | `vue` | MIT | 组件、响应式状态和页面渲染 | https://v2.vuejs.org/ |
| Vue Router | `vue-router` | MIT | 命名路由和页面导航 | https://v3.router.vuejs.org/ |
| Element UI | `element-ui` | MIT | 表单、反馈和基础交互组件 | https://element.eleme.io/ |
| idb | `idb` | ISC | IndexedDB Promise 与事务封装 | https://github.com/jakearchibald/idb |
| core-js | `core-js` | MIT | JavaScript 标准能力兼容 | https://core-js.io/ |
| Acorn | `acorn` | MIT | Provider 单文件静态语法解析 | https://github.com/acornjs/acorn |
| Noble Hashes | `@noble/hashes` | MIT | 浏览器端 SHA-256 等哈希 | https://github.com/paulmillr/noble-hashes |
| XGPlayer | `xgplayer`、`xgplayer-hls` | MIT | MP4/HLS 播放界面与适配 | https://github.com/bytedance/xgplayer |

## 后端运行依赖

| 项目 | Package | 许可证 | 用途 | 项目地址 |
|---|---|---|---|---|
| Fastify | `fastify` | MIT | HTTP 服务、路由和生命周期 | https://fastify.dev/ |
| @fastify/cors | `@fastify/cors` | MIT | 浏览器 Origin 准入和预检 | https://github.com/fastify/fastify-cors |
| ipaddr.js | `ipaddr.js` | MIT | IP 分类和代理目标安全判断 | https://github.com/whitequark/ipaddr.js |
| Undici | `undici` | MIT | 受控 HTTPS 上游连接和响应流 | https://undici.nodejs.org/ |

## 生产构建依赖

| 项目 | Package | 许可证 | 用途 | 项目地址 |
|---|---|---|---|---|
| Vite | `vite` | MIT | 前端开发服务和生产构建 | https://vite.dev/ |
| Vue 2 plugin for Vite | `@vitejs/plugin-vue2` | MIT | 编译 Vue 2 单文件组件 | https://github.com/vitejs/vite-plugin-vue2 |
| PostCSS | `postcss` | MIT | 构建期 CSS 处理 | https://postcss.org/ |

## 不在本声明范围内

- `fake-indexeddb` 等仅用于私有开发仓库测试的工具不属于公开生产依赖清单。
- 外部站点、媒体内容、站点 API 和 Provider 脚本不是上述开源依赖。
- 内置 Provider 的作者、源站和责任声明在应用“设置 → 系统源致谢声明”中展示。
- 用户导入 Provider 的授权和责任由脚本提供者、使用者与相关站点分别承担。

发布版本应根据实际迁移后的 package 和 lockfile 核对此清单。增加、删除或替换直接生产依赖时，必须同步本文件和应用关于页的集中开源项目列表。
