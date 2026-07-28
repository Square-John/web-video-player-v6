/*
  proxyRequestValidator.js 模块说明

  - 文件职责:
      精确校验 ProxyRequestEnvelope 1.0.0，并生成与 HTTP 输入引用隔离的规范化请求和有效客户端限制。
      供 Fastify 路由在任何 DNS 或上游网络访问前调用；目标 IP 和重定向安全检查由后续转发事务继续执行。

  - 导入库及文件汇总(4 条，内置 1 条，第三方 0 条，自定义 3 条):
      node:buffer#Buffer: 按 UTF-8 或 base64 计算真实请求体和请求头字节数。
      ../contracts/proxyProtocol.js: 使用冻结协议版本、字段集合和枚举完成精确校验。
      ../errors/proxyError.js#ProxyError: 把所有输入缺陷转换为稳定协议错误码和安全字段定位。
      ../security/targetUrlPolicy.js#normalizeInitialTargetUrl: 复用初始与重定向共同的 HTTPS URL 规则。

  - 模块级常量:
      HTTP_HEADER_NAME_PATTERN: RegExp，RFC token 范围内的请求头名称格式。
      STANDARD_BASE64_PATTERN: RegExp，允许空串及标准带填充 base64 的格式。

  - 模块级变量:
      无

  - 模块级辅助函数:
      isPlainObject(value): 判断输入是否为 JSON 普通对象。
      failValidation(field, reason): 抛出不携带原始值的固定校验错误。
      assertExactKeys(value, expectedKeys, field): 校验普通对象和精确字段集合。
      assertBoundedIdentifier(value, field, maximumCharacters): 校验非空且容量受限的关联标识。
      assertPositiveSafeInteger(value, field): 校验客户端容量和超时参数。
      validateTarget(target, limits): 校验 HTTPS URL 和 GET/POST 方法并返回规范化目标。
      validateHeaders(headers, limits): 校验、规范化并冻结请求头候选。
      assertStrictJsonValue(value, field, ancestors): 递归拒绝非 JSON 值和循环引用。
      deepFreezeJson(value): 深层冻结隔离后的 JSON 请求体。
      validateBody(method, body, limits): 校验方法、编码、数据类型和解码后容量组合。
      validateProxyRequestEnvelope(input, policy): 生成网络层唯一允许消费的校验结果。

  - 模块级类:
      无

  - 对外导出:
      validateProxyRequestEnvelope: function，HTTP 路由使用的网络前置门禁。
*/

// 导入来源: node:buffer；导入内容: Buffer；文件作用: 计算 UTF-8 字节并严格检查 base64 请求体容量。
import { Buffer } from 'node:buffer';
// 导入来源: ../contracts/proxyProtocol.js；导入内容: 全部请求字段和枚举常量；文件作用: 避免校验器自行复制协议字符串。
import {
  PROXY_BODY_ENCODINGS,
  PROXY_BODY_KEYS,
  PROXY_PROTOCOL_VERSION,
  PROXY_REQUEST_KEYS,
  PROXY_REQUEST_METHODS,
  PROXY_RESPONSE_TYPES,
  PROXY_TARGET_KEYS
} from '../contracts/proxyProtocol.js';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 将协议缺陷映射为稳定且不泄漏输入的错误对象。
import { ProxyError } from '../errors/proxyError.js';
// 导入来源: ../security/targetUrlPolicy.js；导入内容: normalizeInitialTargetUrl；文件作用: 初始目标复用执行链的唯一 URL 安全策略。
import { normalizeInitialTargetUrl } from '../security/targetUrlPolicy.js';

// 类型: RegExp；来源: HTTP field-name token 语法；作用: 在转发头裁剪前拒绝空白、控制符和分隔符名称。
const HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;

// 类型: RegExp；来源: RFC 4648 标准 base64 四字符分组；作用: 拒绝 URL-safe、错误填充和部分可解码垃圾输入。
const STANDARD_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

/**
 * 判断候选值是否为 JSON 普通对象。
 * 调用方: 精确字段、请求头和 JSON body 校验。
 * 副作用: 无；纯类型判断。
 * 失败路径: null、数组和自定义原型实例返回 false，由调用方形成字段错误。
 *
 * @param {unknown} value 当前待检查值。
 * @returns {boolean} true 表示普通对象；false 表示不能作为协议对象。
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * 抛出不包含原始输入值的固定校验错误。
 * 调用方: 本模块全部协议断言函数。
 * 副作用: 终止当前校验调用；不记录日志、不访问网络。
 * 失败路径: 始终抛出 PROXY_VALIDATION_ERROR。
 *
 * @param {string} field 协议字段路径，只能由实现声明，不能直接使用用户输入。
 * @param {string} reason 稳定缺陷分类，只描述规则，不回显敏感原值。
 * @returns {never} 本函数不会正常返回。
 * @throws {ProxyError} 固定校验错误。
 */
function failValidation(field, reason) {
  throw new ProxyError('PROXY_VALIDATION_ERROR', { details: { field, reason } });
}

/**
 * 校验协议对象类型和精确字段集合。
 * 调用方: validateProxyRequestEnvelope、validateTarget 和 validateBody。
 * 副作用: 无；只读取对象键。
 * 失败路径: 非普通对象、字段缺失或未知字段都会立即抛出固定校验错误。
 *
 * @param {unknown} value 当前待检查协议对象。
 * @param {ReadonlyArray<string>} expectedKeys 当前协议版本要求的精确键集合。
 * @param {string} field 当前对象的稳定字段路径。
 * @returns {Record<string, unknown>} 通过类型和字段集合检查的原对象，仅供本模块继续读取。
 * @throws {ProxyError} 对象类型或字段集合不精确时抛出。
 */
function assertExactKeys(value, expectedKeys, field) {
  if (!isPlainObject(value)) {
    failValidation(field, 'must_be_plain_object');
  }

  // 类型: Array<string>；来源: 当前协议对象自有可枚举键；作用: 同时检查缺失与未知字段。
  const actualKeys = Object.keys(value);

  // 条件分支: 数量不同必然存在缺失或未知字段，先失败可避免继续读取不完整对象。
  if (actualKeys.length !== expectedKeys.length) {
    failValidation(field, 'must_have_exact_fields');
  }

  // 循环: 每个真实字段都必须属于冻结集合，未来字段不能被旧服务静默忽略。
  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) {
      failValidation(field, 'contains_unknown_field');
    }
  }

  // 循环: 即使数量相同，也必须确认每个冻结字段确实存在而非被另一个未知字段替代。
  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      failValidation(field, 'missing_required_field');
    }
  }

  return value;
}

/**
 * 校验请求关联标识为非空且长度受部署策略限制的字符串。
 * 调用方: validateProxyRequestEnvelope。
 * 副作用: 无；原样返回字符串，不 trim 或重写关联值。
 * 失败路径: 类型错误、空字符串或超长时抛出固定校验错误。
 *
 * @param {unknown} value 当前标识候选值。
 * @param {string} field requestId 或 sourceId 字段路径。
 * @param {number} maximumCharacters 当前部署允许的最大字符数。
 * @returns {string} 原样保留的合法标识。
 * @throws {ProxyError} 标识不满足规则时抛出。
 */
function assertBoundedIdentifier(value, field, maximumCharacters) {
  if (typeof value !== 'string' || value.length === 0) {
    failValidation(field, 'must_be_non_empty_string');
  }

  if (value.length > maximumCharacters) {
    failValidation(field, 'exceeds_character_limit');
  }

  return value;
}

/**
 * 校验客户端声明的超时或容量为正安全整数。
 * 调用方: validateProxyRequestEnvelope。
 * 副作用: 无；纯数值判断。
 * 失败路径: 非整数、零、负数或超出安全整数时抛出固定校验错误。
 *
 * @param {unknown} value 客户端声明的数值。
 * @param {string} field 当前字段路径。
 * @returns {number} 通过校验的正安全整数。
 * @throws {ProxyError} 数值不满足协议时抛出。
 */
function assertPositiveSafeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    failValidation(field, 'must_be_positive_safe_integer');
  }

  return value;
}

/**
 * 校验并规范化目标 HTTPS URL 与方法。
 * 调用方: validateProxyRequestEnvelope。
 * 副作用: 调用共享 URL 策略创建临时 URL 对象；不执行 DNS、连接或重定向。
 * 失败路径: target 字段不精确、URL 无效、非 HTTPS、带凭据/片段或方法未知时抛出固定错误。
 *
 * @param {unknown} target ProxyRequestEnvelope.target 候选值。
 * @param {Readonly<object>} limits 当前部署容量策略。
 * @returns {Readonly<{ url: string, method: string }>} 规范化绝对 URL 和精确方法。
 * @throws {ProxyError} 目标字段不满足网络前置协议时抛出。
 */
function validateTarget(target, limits) {
  // 类型: Record<string, unknown>；来源: 精确字段断言；作用: 后续只读取冻结 target 键。
  const targetObject = assertExactKeys(target, PROXY_TARGET_KEYS, 'target');

  // 类型: string；来源: 共享 targetUrlPolicy；作用: 初始请求和重定向使用同一 HTTPS、长度、凭据与片段边界。
  const normalizedUrl = normalizeInitialTargetUrl(targetObject.url, limits);

  if (typeof targetObject.method !== 'string' || !PROXY_REQUEST_METHODS.includes(targetObject.method)) {
    failValidation('target.method', 'unsupported_method');
  }

  return Object.freeze({ url: normalizedUrl, method: targetObject.method });
}

/**
 * 校验、规范化并冻结候选请求头。
 * 调用方: validateProxyRequestEnvelope。
 * 副作用: 创建新的 null-prototype 临时对象和最终普通冻结对象，不修改输入 headers。
 * 失败路径: 非普通对象、数量超限、非法名称、大小写重复、非字符串值或字节超限时抛错。
 *
 * @param {unknown} headers ProxyRequestEnvelope.headers 候选值。
 * @param {Readonly<object>} limits 当前部署请求头策略。
 * @returns {Readonly<Record<string, string>>} 名称统一为小写且与输入引用隔离的请求头对象。
 * @throws {ProxyError} 请求头不满足协议和容量边界时抛出。
 */
function validateHeaders(headers, limits) {
  if (!isPlainObject(headers)) {
    failValidation('headers', 'must_be_plain_object');
  }

  // 类型: Array<[string, unknown]>；来源: 候选请求头自有键值；作用: 检查数量并按原有顺序规范化。
  const entries = Object.entries(headers);

  if (entries.length > limits.requestHeaderCount) {
    failValidation('headers', 'exceeds_header_count_limit');
  }

  // 类型: Record<string, string>；来源: 当前请求头规范化结果；作用: 用 null 原型避免特殊键改变对象继承行为。
  const normalizedHeaders = Object.create(null);

  // 循环: 每个候选头独立执行名称、重复和字节上限检查，转发层再集中删除代理控制头。
  for (const [name, value] of entries) {
    if (name.length === 0 || name.length > limits.requestHeaderNameCharacters || !HTTP_HEADER_NAME_PATTERN.test(name)) {
      failValidation('headers', 'invalid_header_name');
    }

    // 类型: string；来源: 合法头名称；作用: 后续裁剪只处理一种大小写，且检测 JSON 对象中的大小写重复键。
    const normalizedName = name.toLowerCase();

    if (Object.hasOwn(normalizedHeaders, normalizedName)) {
      failValidation('headers', 'contains_case_insensitive_duplicate');
    }

    if (typeof value !== 'string') {
      failValidation('headers', 'header_value_must_be_string');
    }

    if (Buffer.byteLength(value, 'utf8') > limits.requestHeaderValueBytes) {
      failValidation('headers', 'header_value_exceeds_byte_limit');
    }

    normalizedHeaders[normalizedName] = value;
  }

  return Object.freeze({ ...normalizedHeaders });
}

/**
 * 递归确认 body.data 是严格 JSON Value 且不存在循环引用。
 * 调用方: validateBody 及本函数自身。
 * 副作用: ancestors 在当前递归分支进入和退出时成对增删对象引用；调用结束后不保留输入状态。
 * 失败路径: undefined、函数、Symbol、BigInt、非有限数、自定义对象或循环引用时抛出校验错误。
 *
 * @param {unknown} value 当前 JSON 值节点。
 * @param {string} field 对外错误使用的稳定字段路径，不展开用户对象键。
 * @param {Set<object>} ancestors 当前递归祖先集合，用于只拒绝真实循环而允许重复引用。
 * @returns {void} 通过表示整个当前节点可安全 JSON 序列化。
 * @throws {ProxyError} 节点不是严格 JSON Value 时抛出。
 */
function assertStrictJsonValue(value, field, ancestors) {
  // 条件分支: null、字符串和 Boolean 是无需继续递归的合法 JSON 基础值。
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return;
  }

  // 条件分支: JSON 数字必须有限，拒绝序列化时会静默变成 null 的 Infinity 和 NaN。
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      failValidation(field, 'contains_non_finite_number');
    }
    return;
  }

  if (typeof value !== 'object') {
    failValidation(field, 'contains_non_json_value');
  }

  if (ancestors.has(value)) {
    failValidation(field, 'contains_cycle');
  }

  // 状态变化: 当前对象只在本递归分支存活，finally 确保失败或成功都清理祖先集合。
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      // 循环: 数组顺序属于请求体语义，逐项校验但错误只暴露稳定 body.data 字段。
      for (const item of value) {
        assertStrictJsonValue(item, field, ancestors);
      }
      return;
    }

    if (!isPlainObject(value)) {
      failValidation(field, 'contains_non_plain_object');
    }

    // 循环: 对象键不进入错误响应，值必须全部满足严格 JSON Value。
    for (const item of Object.values(value)) {
      assertStrictJsonValue(item, field, ancestors);
    }
  } finally {
    // 资源清理: 当前递归节点离开后移除引用，允许同一对象在非祖先分支重复出现。
    ancestors.delete(value);
  }
}

/**
 * 深层冻结已经与 HTTP 输入隔离的 JSON Value。
 * 调用方: validateBody 及本函数自身。
 * 副作用: 冻结传入的隔离副本；不会冻结 Fastify 原始 request.body。
 * 失败路径: 无；调用前已保证值为有限无环 JSON Value。
 *
 * @param {unknown} value JSON.parse 创建的隔离值。
 * @returns {unknown} 原引用的深层冻结版本。
 */
function deepFreezeJson(value) {
  if (value !== null && typeof value === 'object') {
    // 循环: 先冻结所有子节点，再冻结容器，保证网络层不能修改任何嵌套请求字段。
    for (const child of Object.values(value)) {
      deepFreezeJson(child);
    }
    Object.freeze(value);
  }

  return value;
}

/**
 * 校验请求方法、body encoding、数据类型和解码后容量的精确组合。
 * 调用方: validateProxyRequestEnvelope。
 * 副作用: JSON body 会序列化并解析为隔离冻结副本；不修改原输入。
 * 失败路径: 字段不精确、组合非法、base64 非标准或真实字节超限时抛出校验错误。
 *
 * @param {string} method 已通过枚举校验的 GET 或 POST。
 * @param {unknown} body ProxyRequestEnvelope.body 候选值。
 * @param {Readonly<object>} limits 当前部署请求体容量策略。
 * @returns {Readonly<{ encoding: string, data: unknown }>} 与输入引用隔离的标准请求体。
 * @throws {ProxyError} 请求体不满足协议组合或容量限制时抛出。
 */
function validateBody(method, body, limits) {
  // 类型: Record<string, unknown>；来源: 精确字段断言；作用: 后续只读取 encoding 和 data。
  const bodyObject = assertExactKeys(body, PROXY_BODY_KEYS, 'body');

  if (typeof bodyObject.encoding !== 'string' || !PROXY_BODY_ENCODINGS.includes(bodyObject.encoding)) {
    failValidation('body.encoding', 'unsupported_encoding');
  }

  // 条件分支: GET 的唯一合法 body 是 none/null，阻止中间层通过 GET 隐式发送请求体。
  if (method === 'GET') {
    if (bodyObject.encoding !== 'none' || bodyObject.data !== null) {
      failValidation('body', 'get_requires_none_and_null');
    }
    return Object.freeze({ encoding: 'none', data: null });
  }

  // 条件分支: POST 必须显式声明真实编码；none 不作为空 POST 的兼容别名。
  if (bodyObject.encoding === 'none') {
    failValidation('body.encoding', 'post_requires_payload_encoding');
  }

  if (bodyObject.encoding === 'utf8') {
    if (typeof bodyObject.data !== 'string') {
      failValidation('body.data', 'utf8_requires_string');
    }

    if (Buffer.byteLength(bodyObject.data, 'utf8') > limits.requestBodyBytes) {
      failValidation('body.data', 'exceeds_request_body_limit');
    }

    return Object.freeze({ encoding: 'utf8', data: bodyObject.data });
  }

  if (bodyObject.encoding === 'base64') {
    if (typeof bodyObject.data !== 'string' || !STANDARD_BASE64_PATTERN.test(bodyObject.data)) {
      failValidation('body.data', 'base64_requires_canonical_string');
    }

    if (Buffer.byteLength(bodyObject.data, 'base64') > limits.requestBodyBytes) {
      failValidation('body.data', 'exceeds_request_body_limit');
    }

    return Object.freeze({ encoding: 'base64', data: bodyObject.data });
  }

  // 条件分支: json 编码只接受 object/array；SourceNetworkRequest 的字符串由 ProxyClient 映射为 utf8。
  if (bodyObject.data === null || typeof bodyObject.data !== 'object') {
    failValidation('body.data', 'json_requires_object_or_array');
  }

  assertStrictJsonValue(bodyObject.data, 'body.data', new Set());
  // 类型: string；来源: 通过严格 JSON Value 校验的 body；作用: 精确计算线上 UTF-8 字节并创建隔离副本。
  const serializedBody = JSON.stringify(bodyObject.data);

  if (Buffer.byteLength(serializedBody, 'utf8') > limits.requestBodyBytes) {
    failValidation('body.data', 'exceeds_request_body_limit');
  }

  return Object.freeze({ encoding: 'json', data: deepFreezeJson(JSON.parse(serializedBody)) });
}

/**
 * 精确校验 ProxyRequestEnvelope 1.0.0 并生成网络层输入。
 * 调用方: POST /api/proxy/v1/request 路由。
 * 副作用: 只创建规范化冻结副本；不执行 DNS、上游网络、日志或跨请求状态写入。
 * 失败路径: 未知协议版本抛 PROXY_PROTOCOL_UNSUPPORTED；其他字段和组合缺陷抛 PROXY_VALIDATION_ERROR。
 *
 * @param {unknown} input Fastify 解析后的 JSON 请求体。
 * @param {Readonly<object>} policy 当前进程冻结代理策略。
 * @returns {Readonly<{ request: object, effectiveLimits: object }>} 隔离请求与客户端不能提高的最终超时/响应上限。
 * @throws {ProxyError} 任何网络前置协议检查失败时抛出。
 */
export function validateProxyRequestEnvelope(input, policy) {
  // 类型: Record<string, unknown>；来源: 精确顶层断言；作用: 后续字段读取不接受未知或缺失键。
  const envelope = assertExactKeys(input, PROXY_REQUEST_KEYS, 'request');

  // 版本边界: 类型正确但不是 1.0.0 的版本使用专用错误码；不根据主次版本做隐式兼容。
  if (typeof envelope.protocolVersion !== 'string' || envelope.protocolVersion !== PROXY_PROTOCOL_VERSION) {
    throw new ProxyError('PROXY_PROTOCOL_UNSUPPORTED', { details: { field: 'protocolVersion', reason: 'exact_version_required' } });
  }

  // 类型: string；来源: 客户端请求；作用: 原样回填响应并用于最小诊断关联。
  const requestId = assertBoundedIdentifier(envelope.requestId, 'requestId', policy.limits.requestIdCharacters);
  // 类型: string；来源: 客户端请求；作用: 只用于审计关联，不能决定目标路由或安全策略。
  const sourceId = assertBoundedIdentifier(envelope.sourceId, 'sourceId', policy.limits.sourceIdCharacters);
  // 类型: Readonly<object>；来源: validateTarget；作用: 为转发事务提供标准 HTTPS URL 和方法。
  const target = validateTarget(envelope.target, policy.limits);
  // 类型: Readonly<object>；来源: validateHeaders；作用: 为转发事务的代理控制头裁剪提供小写候选。
  const headers = validateHeaders(envelope.headers, policy.limits);
  // 类型: Readonly<object>；来源: validateBody；作用: 保证方法和请求体编码组合在联网前已经成立。
  const body = validateBody(target.method, envelope.body, policy.limits);

  if (typeof envelope.responseType !== 'string' || !PROXY_RESPONSE_TYPES.includes(envelope.responseType)) {
    failValidation('responseType', 'unsupported_response_type');
  }

  // 类型: number；来源: 客户端 timeoutMs；作用: 与部署上限取较小值，客户端不能扩大服务超时。
  const requestedTimeoutMs = assertPositiveSafeInteger(envelope.timeoutMs, 'timeoutMs');
  // 类型: number；来源: 客户端 maxResponseBytes；作用: 与部署上限取较小值，客户端不能扩大响应容量。
  const requestedResponseBytes = assertPositiveSafeInteger(envelope.maxResponseBytes, 'maxResponseBytes');
  // 类型: Readonly<object>；来源: 规范化字段；作用: 网络执行器唯一允许消费的请求对象。
  const request = Object.freeze({
    protocolVersion: PROXY_PROTOCOL_VERSION,
    requestId,
    sourceId,
    target,
    headers,
    body,
    responseType: envelope.responseType,
    timeoutMs: requestedTimeoutMs,
    maxResponseBytes: requestedResponseBytes
  });
  // 类型: Readonly<object>；来源: 客户端值与部署上限逐项取小；作用: 转发事务必须使用该值而非原始请求上限。
  const effectiveLimits = Object.freeze({
    timeoutMs: Math.min(requestedTimeoutMs, policy.limits.upstreamTimeoutMs),
    maxResponseBytes: Math.min(requestedResponseBytes, policy.limits.responseBytes)
  });

  return Object.freeze({ request, effectiveLimits });
}
