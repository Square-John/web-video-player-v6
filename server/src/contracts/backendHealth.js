/*
  backendHealth.js 模块说明

  - 文件职责:
      冻结后端基础设施健康入口的路径、成功响应和缓存边界。
      健康入口与 Proxy Protocol 业务入口分离，不调用 ProxyExecutor、不访问上游，也不产生代理审计事件。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      BACKEND_HEALTH_ROUTE: string，独立健康 GET 路径。
      BACKEND_HEALTH_CONTENT_TYPE: string，健康响应媒体类型。
      BACKEND_HEALTH_CACHE_CONTROL: string，健康响应缓存策略。
      BACKEND_HEALTH_RESPONSE: Readonly<object>，最小稳定健康响应。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      BACKEND_HEALTH_ROUTE: string，createProxyApp 注册健康路由使用。
      BACKEND_HEALTH_CONTENT_TYPE: string，健康响应类型使用。
      BACKEND_HEALTH_CACHE_CONTROL: string，健康响应缓存头使用。
      BACKEND_HEALTH_RESPONSE: Readonly<object>，健康响应正文使用。
*/

// 类型: string；来源: 后端基础设施健康协议；作用: 注册不依赖代理业务的唯一健康入口。
export const BACKEND_HEALTH_ROUTE = '/health';

// 类型: string；来源: 后端健康协议 7.1；作用: 声明健康响应是 JSON，避免 Fastify 推断其他媒体类型。
export const BACKEND_HEALTH_CONTENT_TYPE = 'application/json';

// 类型: string；来源: 后端健康协议 7.1；作用: 禁止浏览器、CDN 和代理缓存健康结果。
export const BACKEND_HEALTH_CACHE_CONTROL = 'no-store';

// 类型: Readonly<object>；来源: 后端健康协议 7.1；作用: 提供不包含环境、版本、主机或诊断信息的最小成功响应。
export const BACKEND_HEALTH_RESPONSE = Object.freeze({
  // 类型: string；作用: 表示当前 HTTP 应用已就绪，可以接受代理请求。
  status: 'available'
});
