/*
  frontend.config.js 模块说明

  - 文件职责:
      保存前端公开运行参数、本地开发服务器参数和生产构建参数的唯一配置。
      构建时原样复制到 dist/config；浏览器只采用 runtime 分区，部署后可直接修改该分区并刷新生效。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      FRONTEND_CONFIG_GLOBAL_KEY: string，浏览器读取公开运行配置使用的唯一全局键。
      FRONTEND_CONFIG: Readonly<object>，前端运行、开发服务和构建配置。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      FRONTEND_CONFIG: default Readonly<object>，Vite 和配置检查器读取的完整前端配置。
*/

// 类型: string；来源: 前端运行配置契约；作用: 让外部配置脚本和应用启动屏障使用同一个不可混淆的全局入口。
const FRONTEND_CONFIG_GLOBAL_KEY = '__WVP_FRONTEND_CONFIG__';

// 类型: Readonly<object>；来源: 项目维护者或部署人员编辑；作用: 为前端构建和浏览器启动提供唯一配置事实。
const FRONTEND_CONFIG = Object.freeze({
  // 类型: string；默认值: 1.0.0；作用: 浏览器与构建器据此拒绝不兼容字段语义。
  schemaVersion: '1.0.0',

  // 类型: Readonly<object>；公开性: 会进入 dist 并由浏览器读取；作用: 部署后可直接修改且刷新生效的参数。
  runtime: Object.freeze({
    // 类型: string；默认值: http://localhost:3000；作用: ProxyClient 发送信息请求使用的无路径 HTTP(S) 后端 origin。
    backendOrigin: 'http://localhost:3000'
  }),

  // 类型: Readonly<object>；作用: 只控制 Vite 本地开发服务，修改后需要重启开发进程。
  developmentServer: Object.freeze({
    // 类型: string；默认值: ::；作用: Windows 等双栈主机使用一个监听器接受 localhost、IPv4 和 IPv6 回环连接。
    host: '::',
    // 类型: number；默认值: 5173；作用: 冻结公开开发前端 origin，供后端 allowedOrigins 精确授权。
    port: 5173,
    // 类型: boolean；true 表示端口占用时启动失败，false 会自动漂移并破坏已配置 origin；默认必须为 true。
    strictPort: true
  }),

  // 类型: Readonly<object>；作用: 只在生产构建时生效，部署后修改 dist 中该字段不会重写已生成资源路径。
  build: Object.freeze({
    // 类型: string；默认值: /；作用: 决定 Vite 生成的脚本、样式和资源公开基础路径；修改后必须重新构建。
    basePath: '/'
  })
});

// 条件分支: 当前模块在浏览器中作为 dist 外部配置脚本执行时进入。
// 执行内容: 发布完整冻结配置；Node/Vite 导入时不创建无意义全局运行配置。
if (typeof document !== 'undefined') {
  // 副作用: 在当前页面全局对象发布只读完整前端配置；主程序启动屏障只消费 runtime，开发和构建字段不会进入业务配置。
  globalThis[FRONTEND_CONFIG_GLOBAL_KEY] = FRONTEND_CONFIG;
}

// 导出类型: default Readonly<object>；导出内容: 完整前端配置；外部调用方: Vite、根配置加载器和发布事实检查。
export default FRONTEND_CONFIG;
