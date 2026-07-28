/*
  proxyError.js 模块说明

  - 文件职责:
      表达代理领域错误，并把已知或未知异常转换为冻结协议规定的安全 ProxyErrorEnvelope。
      供校验器、HTTP 边界和后续转发器共同使用；响应只暴露固定错误码、稳定文案和非敏感定位信息。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      ../contracts/proxyProtocol.js#PROXY_ERROR_DEFINITIONS: 查询错误码对应的 HTTP 状态和重试语义。
      ../contracts/proxyProtocol.js#PROXY_PROTOCOL_VERSION: 回填错误外壳当前协议版本。

  - 模块级常量:
      EMPTY_DETAILS: Readonly<object>，没有安全详情时复用的不可变空对象。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeDetails(details): 只接受普通对象并返回冻结浅拷贝，非法详情回落为空对象。
      normalizeRequestId(requestId): 只允许字符串进入错误关联字段，非法值回落为空字符串。
      normalizeProxyError(error): 保留 ProxyError，其他异常统一失败关闭为内部错误。
      createProxyErrorEnvelope(error, requestId): 创建稳定 HTTP 状态与错误外壳。

  - 模块级类:
      ProxyError: 保存冻结错误码、安全详情和可选 cause，不把内部异常直接序列化。

  - 对外导出:
      ProxyError: class，校验、安全策略和转发模块抛出稳定领域错误。
      createProxyErrorEnvelope: function，HTTP 边界生成协议错误响应。
*/

// 导入来源: ../contracts/proxyProtocol.js；导入内容: PROXY_ERROR_DEFINITIONS；文件作用: 校验错误码并读取固定 HTTP 语义。
import { PROXY_ERROR_DEFINITIONS } from '../contracts/proxyProtocol.js';
// 导入来源: ../contracts/proxyProtocol.js；导入内容: PROXY_PROTOCOL_VERSION；文件作用: 生成 ProxyErrorEnvelope 的版本字段。
import { PROXY_PROTOCOL_VERSION } from '../contracts/proxyProtocol.js';

// 类型: Readonly<object>；来源: 模块内部；作用: 避免无详情错误创建可变共享状态。
const EMPTY_DETAILS = Object.freeze({});

/**
 * 把错误详情限制为可序列化边界继续检查前的普通浅层对象。
 * 调用方: ProxyError 构造器。
 * 副作用: 无；返回冻结浅拷贝，不修改调用方对象。
 * 失败路径: null、数组、原始值或自定义原型对象一律回落为空详情，防止内部对象泄漏。
 *
 * @param {unknown} details 错误创建点提供的候选安全详情。
 * @returns {Readonly<object>} 可安全持有的冻结浅层对象或共享空对象。
 */
function normalizeDetails(details) {
  // 安全边界: 错误 details 只接受普通对象；Error、URL、Headers 等内部实例不能进入响应候选。
  if (details === null || typeof details !== 'object' || Array.isArray(details) || Object.getPrototypeOf(details) !== Object.prototype) {
    return EMPTY_DETAILS;
  }

  return Object.freeze({ ...details });
}

/**
 * 规范错误外壳的请求关联标识。
 * 调用方: createProxyErrorEnvelope。
 * 副作用: 无；纯值判断。
 * 失败路径: 非字符串标识返回空字符串，不进行隐式字符串化以免泄漏对象内容。
 *
 * @param {unknown} requestId HTTP 输入中尽早提取的候选请求标识。
 * @returns {string} 原始字符串标识或空字符串。
 */
function normalizeRequestId(requestId) {
  return typeof requestId === 'string' ? requestId : '';
}

/**
 * 把未知异常转换为稳定 ProxyError。
 * 调用方: createProxyErrorEnvelope。
 * 副作用: 未知异常作为 cause 保存在服务端 Error 实例中，但不会进入响应 JSON。
 * 失败路径: 非 ProxyError 一律失败关闭为 PROXY_INTERNAL_ERROR，不根据错误文案猜测分类。
 *
 * @param {unknown} error 当前 HTTP 生命周期捕获的异常。
 * @returns {ProxyError} 可安全映射到协议外壳的领域错误。
 */
function normalizeProxyError(error) {
  // 条件分支: 已知领域错误保留其固定 code 和安全 details。
  if (error instanceof ProxyError) {
    return error;
  }

  return new ProxyError('PROXY_INTERNAL_ERROR', { cause: error });
}

/**
 * 创建稳定代理领域错误。
 * 调用方: 请求校验器、目标安全策略、转发器和 HTTP 边界。
 * 状态所有权: 实例只持有当前失败的冻结 code/details；没有跨请求静态状态。
 * 失败路径: 未知错误码立即抛出 TypeError，防止实现扩张公共协议未登记的错误分支。
 */
export class ProxyError extends Error {
  /**
   * 初始化一个固定错误码的代理领域错误。
   * 调用方: 全部代理领域模块。
   * 副作用: 创建 Error 实例并可保留服务端 cause；不会写日志或发送响应。
   * 失败路径: code 不在协议定义中时抛出 TypeError；details 非普通对象时安全回落为空对象。
   *
   * @param {keyof PROXY_ERROR_DEFINITIONS} code 冻结公共协议错误码。
   * @param {object} [options={}] 可选错误创建参数。
   * @param {object} [options.details={}] 已确认不含敏感值的定位详情。
   * @param {unknown} [options.cause] 仅供服务端诊断链保留的原始异常。
   */
  constructor(code, { details = EMPTY_DETAILS, cause } = {}) {
    // 类型: object|undefined；来源: 公共协议错误映射；作用: 拒绝任何未冻结的错误码。
    const definition = PROXY_ERROR_DEFINITIONS[code];

    if (!definition) {
      throw new TypeError(`未知代理错误码: ${code}`);
    }

    super(definition.message, { cause });
    this.name = 'ProxyError';
    // 类型: string；来源: 构造参数且已通过协议映射校验；生命周期: 当前错误实例；作用: 程序分支唯一依据。
    this.code = code;
    // 类型: Readonly<object>；来源: normalizeDetails；生命周期: 当前错误实例；作用: 只提供不含输入原值的字段级定位。
    this.details = normalizeDetails(details);
  }
}

/**
 * 把任意异常映射为 HTTP 状态与 ProxyErrorEnvelope。
 * 调用方: Fastify 全局错误处理器和未找到处理器。
 * 副作用: 无；创建新的普通响应对象，不记录日志、不修改错误实例。
 * 失败路径: 未知异常统一映射为不带内部详情的 PROXY_INTERNAL_ERROR。
 *
 * @param {unknown} error 当前 HTTP 生命周期捕获的异常。
 * @param {unknown} requestId 请求体中尽早提取的候选关联标识。
 * @returns {{ statusCode: number, body: object }} 稳定 HTTP 状态和 ProxyErrorEnvelope。
 */
export function createProxyErrorEnvelope(error, requestId) {
  // 类型: ProxyError；来源: normalizeProxyError；作用: 将未知异常失败关闭为固定内部错误。
  const proxyError = normalizeProxyError(error);
  // 类型: object；来源: PROXY_ERROR_DEFINITIONS；作用: 提供固定 HTTP 状态、文案和重试语义。
  const definition = PROXY_ERROR_DEFINITIONS[proxyError.code];
  // 安全边界: 内部错误不返回调用点 details，避免未知异常路径携带服务端结构。
  const details = proxyError.code === 'PROXY_INTERNAL_ERROR' ? EMPTY_DETAILS : proxyError.details;

  return {
    statusCode: definition.httpStatus,
    body: {
      protocolVersion: PROXY_PROTOCOL_VERSION,
      requestId: normalizeRequestId(requestId),
      error: {
        code: proxyError.code,
        message: definition.message,
        retryable: definition.retryable,
        details
      }
    }
  };
}
