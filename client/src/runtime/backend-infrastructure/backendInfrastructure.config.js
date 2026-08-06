/*
  backendInfrastructure.config.js 模块说明

  - 文件职责:
      集中保存前端后端基础设施健康检查使用的路径、响应、状态和安全用户文案。
      本文件不读取环境变量、Provider、页面、Store 或浏览器持久化；后端 origin 仍由 FrontendRuntimeConfig 提供。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      BACKEND_INFRASTRUCTURE_STATUS: Readonly<object>，基础设施四态枚举。
      BACKEND_INFRASTRUCTURE_CONFIG: Readonly<object>，健康检查协议和状态展示配置。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      BACKEND_INFRASTRUCTURE_STATUS: object，服务和组件共用的四态枚举。
      BACKEND_INFRASTRUCTURE_CONFIG: object，健康检查服务使用的冻结配置。
*/

// 类型: Readonly<object>；来源: BackendInfrastructureStatus 契约；作用: 防止基础设施状态与 Provider normal/unavailable 枚举混用。
export const BACKEND_INFRASTRUCTURE_STATUS = Object.freeze({
  // 类型: string；作用: 尚未发生健康检查，状态栏不显示。
  idle: 'idle',

  // 类型: string；作用: 健康检查请求在途，状态栏显示蓝色检测中提示。
  checking: 'checking',

  // 类型: string；作用: 健康端点返回精确成功响应，状态栏收起。
  available: 'available',

  // 类型: string；作用: 健康端点或后端连接边界失败，状态栏显示错误和重试。
  unavailable: 'unavailable'
});

// 类型: Readonly<object>；来源: BackendInfrastructureStatus 契约；作用: 集中健康请求、成功响应和用户安全文案，避免调用处散落协议值。
export const BACKEND_INFRASTRUCTURE_CONFIG = Object.freeze({
  // 类型: string；作用: 健康端点固定路径，拼接在 FrontendRuntimeConfig.backendOrigin 后使用。
  healthPath: '/health',

  // 类型: string；作用: 健康请求要求后端返回 JSON，避免把 HTML 错误页当作就绪结果。
  accept: 'application/json',

  // 类型: string；作用: 健康请求显式禁止浏览器缓存。
  cacheMode: 'no-store',

  // 类型: string；作用: 健康响应必须使用的媒体类型主值。
  contentType: 'application/json',

  // 类型: Readonly<object>；作用: 健康响应必须精确匹配的最小 JSON 对象。
  successResponse: Object.freeze({
    // 类型: string；作用: 表示后端 HTTP 应用已就绪。
    status: 'available'
  }),

  // 类型: string；作用: unavailable 状态向用户展示的固定安全说明，不泄漏底层异常。
  unavailableMessage: '后端服务暂时不可用，请稍后重试。',

  // 类型: string；作用: checking 状态向用户展示的短暂连接提示，成功后随状态栏收起。
  checkingMessage: '正在连接后端服务…'
});
