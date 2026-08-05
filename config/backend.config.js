/*
  backend.config.js 模块说明

  - 文件职责:
      保存后端监听、浏览器来源准入、可信代理、日志和可收紧代理限制的唯一部署配置。
      后端启动直接读取该文件；反向代理、证书和进程管理器配置不进入本对象。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      BACKEND_CONFIG: Readonly<object>，后端监听、CORS、日志与部署限制配置。

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
  // 类型: string；默认值: 2.0.0；作用: 后端在监听端口前拒绝缺失日志和可信代理字段的旧配置。
  schemaVersion: '2.0.0',

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
    ]),
    // 单位: 跳；默认值: 1；作用: 只信任与应用直接相邻的一层 Render 或反向代理提供的最右侧 X-Forwarded-For 地址。
    trustedProxyHops: 1
  }),

  // 类型: Readonly<object>；作用: 配置统一日志中心的终端表现、周期汇总和 JSONL 文件轮转。
  logging: Object.freeze({
    // 类型: Readonly<object>；作用: Render 和本地终端共同消费的标准输出配置。
    console: Object.freeze({
      // 类型: string；默认值: info；作用: debug 事件默认不进入终端，info/warn/error 按级别输出。
      minimumLevel: 'info',
      // 类型: string；默认值: compact；作用: 终端显示有限摘要；切换 json 可让平台按完整字段检索。
      format: 'compact',
      // 单位: 秒；默认值: 60；作用: 仅在存在代理请求时安排一次有限运行汇总。
      summaryIntervalSeconds: 60
    }),
    // 类型: Readonly<object>；作用: 本地或持久磁盘上的完整 JSONL 文件输出和轮转配置。
    file: Object.freeze({
      // 类型: boolean；默认值: true；作用: true 创建文件 sink，false 只保留 console/Render 输出。
      enabled: true,
      // 类型: string；默认值: ./logs/backend；作用: 相对路径从仓库根解析，绝对路径可指向部署挂载磁盘。
      directory: './logs/backend',
      // 类型: string；默认值: backend.log；作用: 当前文件名，历史文件在轮转时追加编号。
      baseName: 'backend.log',
      // 类型: string；默认值: info；作用: 文件保存 info、warn 和 error 完整事件。
      minimumLevel: 'info',
      // 单位: 字节；默认值: 10 MiB；作用: 追加下一行前达到该上限则先轮转。
      maximumFileBytes: 10485760,
      // 单位: 个；默认值: 5；作用: 当前文件与编号历史文件总数上限。
      maximumFiles: 5
    })
  }),

  // 类型: Readonly<object>；作用: 按后端 HARD_LIMITS 字段选择性收紧部署限制；空对象表示采用全部代码审查上限。
  limits: Object.freeze({})
});

// 导出类型: default Readonly<object>；导出内容: 后端部署配置；外部调用方: 后端 ProxyPolicy、日志组合根和根配置加载器。
export default BACKEND_CONFIG;
