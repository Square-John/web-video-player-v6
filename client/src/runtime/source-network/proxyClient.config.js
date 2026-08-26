/*
  proxyClient.config.js 模块说明

  - 文件职责:
      集中保存前端 ProxyClient 与后端无状态代理共同使用的传输常量。
      后端 origin 由已通过启动屏障的 FrontendRuntimeConfig 提供；本文件不读取环境变量或保存部署默认值。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      getFrontendRuntimeConfig: 自定义运行配置读取函数，返回当前页面已经采用的唯一 backendOrigin。

  - 模块级常量:
      PROXY_BODY_ENCODING: Readonly<object>，公共协议请求和响应正文编码枚举。
      PROXY_PROTOCOL_ERROR_CODE: Readonly<object>，后端允许返回的稳定代理错误码。
      PROXY_PROTOCOL_ERROR_RETRYABLE: Readonly<object>，稳定代理错误码对应的重试语义。
      PROXY_CLIENT_CONFIG: Readonly<object>，代理协议入口、版本和媒体类型。

  - 模块级变量:
      getConfiguredProxyBaseUrl(): 从启动屏障读取当前页面唯一代理 origin。

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      PROXY_BODY_ENCODING: object，ProxyClient 请求映射和响应解码使用的编码枚举。
      PROXY_PROTOCOL_ERROR_CODE: object，ProxyClient 校验 ProxyErrorEnvelope 使用的错误码枚举。
      PROXY_PROTOCOL_ERROR_RETRYABLE: object，ProxyClient 核对错误码与 retryable 组合使用的映射。
      PROXY_CLIENT_CONFIG: object，ProxyClient 创建和请求外壳校验使用的集中配置。
      getConfiguredProxyBaseUrl: function，向 ProxyClient 提供已经通过启动校验的后端 origin。
*/

// 导入来源: ../../config/frontendRuntimeConfig.js；导入内容: getFrontendRuntimeConfig；文件作用: 只从已采用运行投影取得后端 origin。
import { getFrontendRuntimeConfig } from '../../config/frontendRuntimeConfig.js';

// 类型: Readonly<object>；来源: 公共代理协议 6.2—6.3；作用: 让请求映射和响应解码共用唯一编码值集合。
export const PROXY_BODY_ENCODING = Object.freeze({
  // 类型: string；作用: 表示 GET 请求不携带正文。
  none: 'none',

  // 类型: string；作用: 表示 POST 请求把字符串转换为 UTF-8 原始字节。
  utf8: 'utf8',
  // 类型: string；作用: 表示请求或响应使用标准 base64 包装原始字节。
  base64: 'base64'
});

// 类型: Readonly<object>；来源: 公共代理协议 6.4；作用: 拒绝后端静默扩张未知错误分支。
export const PROXY_PROTOCOL_ERROR_CODE = Object.freeze({
  // 类型: string；作用: 表示客户端协议版本不受后端支持。
  protocolUnsupported: 'PROXY_PROTOCOL_UNSUPPORTED',

  // 类型: string；作用: 表示代理请求字段或组合不符合公共协议。
  validation: 'PROXY_VALIDATION_ERROR',

  // 类型: string；作用: 表示目标地址、DNS 或 IP 不满足安全策略。
  targetForbidden: 'PROXY_TARGET_FORBIDDEN',

  // 类型: string；作用: 表示当前调用方或部署配额已超限。
  rateLimited: 'PROXY_RATE_LIMITED',

  // 类型: string；作用: 表示请求等待后端并发准入超过独立队列上限。
  admissionTimeout: 'PROXY_ADMISSION_TIMEOUT',

  // 类型: string；作用: 表示受控上游请求超过有效超时。
  upstreamTimeout: 'PROXY_UPSTREAM_TIMEOUT',

  // 类型: string；作用: 表示上游响应超过当前有效容量上限。
  responseTooLarge: 'PROXY_RESPONSE_TOO_LARGE',

  // 类型: string；作用: 表示 DNS、连接、TLS 或上游传输失败。
  upstreamNetwork: 'PROXY_UPSTREAM_NETWORK_ERROR',

  // 类型: string；作用: 表示客户端断开或当前请求被中止。
  requestAborted: 'PROXY_REQUEST_ABORTED',

  // 类型: string；作用: 表示后端未分类内部失败且不得泄漏实现详情。
  internal: 'PROXY_INTERNAL_ERROR'
});

// 类型: Readonly<object>；来源: 公共代理协议 6.4；作用: 防止稳定错误码携带相反重试语义误导调用方。
export const PROXY_PROTOCOL_ERROR_RETRYABLE = Object.freeze({
  [PROXY_PROTOCOL_ERROR_CODE.protocolUnsupported]: false,
  [PROXY_PROTOCOL_ERROR_CODE.validation]: false,
  [PROXY_PROTOCOL_ERROR_CODE.targetForbidden]: false,
  [PROXY_PROTOCOL_ERROR_CODE.rateLimited]: true,
  [PROXY_PROTOCOL_ERROR_CODE.admissionTimeout]: true,
  [PROXY_PROTOCOL_ERROR_CODE.upstreamTimeout]: true,
  [PROXY_PROTOCOL_ERROR_CODE.responseTooLarge]: false,
  [PROXY_PROTOCOL_ERROR_CODE.upstreamNetwork]: true,
  [PROXY_PROTOCOL_ERROR_CODE.requestAborted]: true,
  [PROXY_PROTOCOL_ERROR_CODE.internal]: false
});

// 类型: Readonly<object>；来源: 公共代理协议 2.1.0；作用: 统一冻结 ProxyClient 的外部传输常量，避免调用处散落协议字符串。
export const PROXY_CLIENT_CONFIG = Object.freeze({
  // 类型: string；来源: 公共协议 5.1；作用: 固定后端唯一 POST 入口。
  requestPath: '/api/proxy/v2/request',

  // 类型: string；来源: 公共协议 5.2—5.4；作用: 约束请求和响应外壳的协议版本。
  protocolVersion: '2.1.0',

  // 类型: string；来源: 公共协议 6.1；作用: 声明代理入口只消费和返回 JSON 外壳。
  contentType: 'application/json',

  // 类型: string；来源: 公共协议 6.1；作用: 要求后端错误和成功结果都使用 JSON 外壳。
  accept: 'application/json'
});

/**
 * 读取当前页面已经采用的代理服务 origin。
 * 纯函数: 只读取 FrontendRuntimeConfig 冻结投影，不访问环境变量、外部配置全局或浏览器存储。
 * 成功路径: 返回启动屏障规范化的 backendOrigin。
 * 失败路径: 应用尚未完成配置启动屏障时由运行配置模块抛错，禁止采用任何默认地址。
 *
 * @returns {string} 当前页面唯一后端 origin。
 * @throws {Error} 前端运行配置尚未采用时抛出启动顺序错误。
 */
export function getConfiguredProxyBaseUrl() {
  return getFrontendRuntimeConfig().backendOrigin;
}
