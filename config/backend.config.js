/*
  backend.config.js 模块说明

  - 文件职责:
      保存后端监听、浏览器来源准入和可收紧代理限制的唯一部署配置。
      后端启动直接读取该文件；反向代理、证书和进程管理器配置不进入本对象。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      BACKEND_CONFIG: Readonly<object>，后端监听、CORS 与部署限制配置。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      BACKEND_CONFIG: default Readonly<object>，后端策略创建器和根配置检查器读取的部署配置。
*/

// 类型: Readonly<object>；来源: 项目维护者或服务器部署人员编辑；作用: 为后端进程提供唯一运行配置事实。
const BACKEND_CONFIG = Object.freeze({
  // 类型: string；默认值: 1.0.0；作用: 后端在监听端口前拒绝不兼容字段语义。
  schemaVersion: '1.0.0',

  // 类型: Readonly<object>；作用: 决定 Node 监听地址、端口和允许调用代理的浏览器 origin。
  server: Object.freeze({
    // 类型: string；默认值: 0.0.0.0；作用: 使用同一 IPv4 监听配置接受本机连接和 Render 容器入口转发。
    host: '0.0.0.0',
    // 类型: number；默认值: 3000；作用: Node 后端和反向代理 upstream 必须共同使用的内部服务端口。
    port: 3000,
    // 类型: ReadonlyArray<string>；作用: 精确允许三个等价本机前端 origin 和公开 GitHub Pages origin，不反射任意来源也不启用凭据模式。
    allowedOrigins: Object.freeze([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://[::1]:5173',
      'https://square-john.github.io'
    ])
  }),

  // 类型: Readonly<object>；作用: 按后端 HARD_LIMITS 字段选择性收紧部署限制；空对象表示采用全部代码审查上限。
  limits: Object.freeze({})
});

// 导出类型: default Readonly<object>；导出内容: 后端部署配置；外部调用方: 后端 ProxyPolicy 和根配置加载器。
export default BACKEND_CONFIG;
