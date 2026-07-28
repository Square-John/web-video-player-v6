/*
  proxyClientErrors.js 模块说明

  - 文件职责:
      定义 ProxyClient 的稳定错误对象，把请求输入、网络传输、响应外壳和后端代理错误分开表达。
      调用方只依赖 code、proxyCode 和 retryable，不解析后端文案或底层异常文本。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      PROXY_CLIENT_ERROR_CODE: Readonly<object>，ProxyClient 的稳定错误分类。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      ProxyClientError: Error，保存前端错误分类、后端错误码和有限诊断详情。

  - 对外导出:
      PROXY_CLIENT_ERROR_CODE: object，错误分类枚举。
      ProxyClientError: class，ProxyClient 和测试使用的统一错误类型。
*/

// 类型: Readonly<object>；来源: ProxyClient 前端边界；作用: 让 Provider/Host 按稳定分类处理，不读取错误文案。
export const PROXY_CLIENT_ERROR_CODE = Object.freeze({
  // 类型: string；作用: SourceNetworkRequest 或客户端配置不符合契约。
  validation: 'PROXY_CLIENT_VALIDATION_ERROR',

  // 类型: string；作用: fetch 无法完成请求或响应读取失败。
  network: 'PROXY_CLIENT_NETWORK_ERROR',

  // 类型: string；作用: 生命周期中止，当前结果不能被 Provider 采用。
  aborted: 'PROXY_CLIENT_ABORTED',

  // 类型: string；作用: 后端返回的成功或错误外壳不符合公共协议。
  response: 'PROXY_CLIENT_RESPONSE_ERROR',

  // 类型: string；作用: 后端返回稳定 ProxyErrorEnvelope，proxyCode 保存原始错误码。
  proxy: 'PROXY_CLIENT_PROXY_ERROR'
});

/**
 * ProxyClient 统一错误。
 * 状态所有权: 错误只保存当前调用的分类和有限详情，不保存请求体、响应体、凭据或历史记录。
 * 副作用: 创建 Error 实例，不修改 SourceContext、Runtime 或页面状态。
 * 失败路径: 具体调用方负责选择 validation、network、aborted、response 或 proxy 分类。
 */
export class ProxyClientError extends Error {
  /**
   * 初始化当前代理调用的稳定前端错误。
   * 副作用: 只创建错误实例和冻结诊断详情，不读取或修改运行时状态。
   * 失败路径: 调用点负责在构造前选择冻结错误码并裁剪敏感详情。
   *
   * @param {string} code PROXY_CLIENT_ERROR_CODE 中的稳定错误码。
   * @param {string} message 面向诊断的错误说明，调用方不能用文案分支。
   * @param {object} [options={}] 错误附加信息。
   * @param {string} [options.proxyCode] 后端 ProxyErrorEnvelope.error.code。
   * @param {boolean} [options.retryable=false] 后端声明的可重试语义。
   * @param {object} [options.details={}] 不含敏感值的有限诊断字段。
   * @param {*} [options.cause] 底层失败原因，仅供诊断链使用。
   */
  constructor(code, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ProxyClientError';
    this.code = code;
    this.proxyCode = options.proxyCode || '';
    this.retryable = options.retryable === true;
    this.details = Object.freeze({ ...(options.details || {}) });
  }
}
