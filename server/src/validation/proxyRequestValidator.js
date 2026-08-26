/*
  proxyRequestValidator.js 模块说明

  - 文件职责:
      精确校验 ProxyRequestEnvelope 2.1.0，并生成与 HTTP 输入引用隔离的原始运输请求和有效客户端限制。
      Fastify 路由必须在 DNS 或上游访问前调用本模块；目标 IP、重定向和媒体安全由后续运输事务负责。

  - 导入库及文件汇总(4 条，内置 1 条，第三方 0 条，自定义 3 条):
      node:buffer#Buffer: 计算 UTF-8、base64 和请求头真实字节数。
      ../contracts/proxyProtocol.js: 提供冻结版本、精确字段和运输枚举。
      ../errors/proxyError.js#ProxyError: 把输入缺陷转换为稳定且不泄漏原值的协议错误。
      ../security/targetUrlPolicy.js#normalizeInitialTargetUrl: 复用初始与重定向共同的 HTTPS URL 规则。

  - 模块级常量:
      HTTP_HEADER_NAME_PATTERN: RegExp，HTTP token 请求头名称格式。
      HTTP_HEADER_FORBIDDEN_VALUE_PATTERN: RegExp，禁止进入上游头值的控制字符集合。
      STANDARD_BASE64_PATTERN: RegExp，标准带填充 base64 外形。

  - 模块级变量:
      无

  - 模块级辅助函数:
      isPlainObject(value): 判断输入是否为 JSON 普通对象。
      failValidation(field, reason): 抛出不携带原始输入的固定校验错误。
      assertExactKeys(value, expectedKeys, field): 校验普通对象和精确字段集合。
      assertBoundedIdentifier(value, field, maximumCharacters): 校验关联标识。
      assertPositiveSafeInteger(value, field): 校验超时和容量参数。
      validateTarget(target, limits): 校验 HTTPS URL 和 GET/POST 方法。
      validateHeaders(headers, limits): 校验并冻结有序多值请求头。
      validateBody(method, body, limits): 校验原始请求体运输编码和容量。
      validateProxyRequestEnvelope(input, policy): 生成网络层唯一允许消费的冻结结果。

  - 模块级类:
      无

  - 对外导出:
      validateProxyRequestEnvelope: function，HTTP 路由和契约测试使用的网络前置门禁。
*/

// 导入来源: node:buffer；导入内容: Buffer；文件作用: 计算 UTF-8 字节并严格验证 base64 请求体容量。
import { Buffer } from 'node:buffer';
// 导入来源: ../contracts/proxyProtocol.js；导入内容: 请求字段和枚举常量；文件作用: 避免校验器复制协议字符串。
import {
  PROXY_BODY_ENCODINGS,
  PROXY_BODY_KEYS,
  PROXY_HEADER_KEYS,
  PROXY_PROTOCOL_VERSION,
  PROXY_REQUEST_KEYS,
  PROXY_REQUEST_METHODS,
  PROXY_TARGET_KEYS
} from '../contracts/proxyProtocol.js';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 将协议缺陷映射为稳定错误。
import { ProxyError } from '../errors/proxyError.js';
// 导入来源: ../security/targetUrlPolicy.js；导入内容: normalizeInitialTargetUrl；文件作用: 初始目标复用唯一 URL 安全策略。
import { normalizeInitialTargetUrl } from '../security/targetUrlPolicy.js';

// 类型: RegExp；来源: HTTP field-name token 语法；作用: 在头裁剪前拒绝空白、控制符和分隔符名称。
const HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;

// 类型: RegExp；来源: HTTP field-value 安全边界；作用: 拒绝换行、NUL 和其他控制字符，水平制表符仍按协议允许。
const HTTP_HEADER_FORBIDDEN_VALUE_PATTERN = /[\u0000-\u0008\u000a-\u001f\u007f]/u;

// 类型: RegExp；来源: RFC 4648 标准 base64 四字符分组；作用: 拒绝 URL-safe、错误填充和部分可解码垃圾输入。
const STANDARD_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

/**
 * 判断候选值是否为 JSON 普通对象。
 * 调用方: 精确字段和头条目校验。
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
 * @param {string} field 实现声明的稳定协议字段路径。
 * @param {string} reason 不回显敏感原值的稳定缺陷分类。
 * @returns {never} 本函数不会正常返回。
 * @throws {ProxyError} 固定校验错误。
 */
function failValidation(field, reason) {
  throw new ProxyError('PROXY_VALIDATION_ERROR', { details: { field, reason } });
}

/**
 * 校验协议对象类型和精确字段集合。
 * 调用方: validateProxyRequestEnvelope、validateTarget、validateHeaders 和 validateBody。
 * 副作用: 无；只读取对象自有键。
 * 失败路径: 非普通对象、字段缺失或未知字段立即抛出固定校验错误。
 *
 * @param {unknown} value 当前协议对象候选。
 * @param {ReadonlyArray<string>} expectedKeys 当前版本要求的精确键集合。
 * @param {string} field 当前对象稳定字段路径。
 * @returns {Record<string, unknown>} 通过形状检查的原对象，仅供本模块继续读取。
 * @throws {ProxyError} 对象类型或字段集合不精确时抛出。
 */
function assertExactKeys(value, expectedKeys, field) {
  if (!isPlainObject(value)) {
    failValidation(field, 'must_be_plain_object');
  }

  // 类型: Array<string>；来源: 当前协议对象自有可枚举键；作用: 同时检查缺失与未知字段。
  const actualKeys = Object.keys(value);

  if (actualKeys.length !== expectedKeys.length) {
    failValidation(field, 'must_have_exact_fields');
  }

  // 循环: 真实字段和冻结字段双向核对，未来字段不能被旧服务静默忽略。
  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) {
      failValidation(field, 'contains_unknown_field');
    }
  }

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
 * @param {unknown} value 客户端声明数值。
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
 * 失败路径: target 不精确、URL 非法或方法未知时抛出固定错误。
 *
 * @param {unknown} target ProxyRequestEnvelope.target 候选值。
 * @param {Readonly<object>} limits 当前部署容量策略。
 * @returns {Readonly<{ url: string, method: string }>} 规范化绝对 URL 和精确方法。
 * @throws {ProxyError} 目标字段不满足协议时抛出。
 */
function validateTarget(target, limits) {
  const targetObject = assertExactKeys(target, PROXY_TARGET_KEYS, 'target');
  // 类型: string；来源: 共享 URL 策略；作用: 初始请求和重定向使用同一 HTTPS、凭据与片段边界。
  const normalizedUrl = normalizeInitialTargetUrl(targetObject.url, limits);

  if (typeof targetObject.method !== 'string' || !PROXY_REQUEST_METHODS.includes(targetObject.method)) {
    failValidation('target.method', 'unsupported_method');
  }

  return Object.freeze({ url: normalizedUrl, method: targetObject.method });
}

/**
 * 校验、规范化并冻结有序多值请求头。
 * 调用方: validateProxyRequestEnvelope。
 * 副作用: 为每项创建冻结副本并冻结数组；不修改输入，不合并同名字段。
 * 失败路径: 非数组、数量超限、条目字段越界、非法名称/值或字节超限时抛错。
 *
 * @param {unknown} headers ProxyRequestEnvelope.headers 候选值。
 * @param {Readonly<object>} limits 当前部署请求头策略。
 * @returns {ReadonlyArray<Readonly<{ name: string, value: string }>>} 小写名称、有序且允许重复的冻结条目。
 * @throws {ProxyError} 请求头不满足协议和容量边界时抛出。
 */
function validateHeaders(headers, limits) {
  if (!Array.isArray(headers)) {
    failValidation('headers', 'must_be_ordered_array');
  }

  if (headers.length > limits.requestHeaderCount) {
    failValidation('headers', 'exceeds_header_count_limit');
  }

  // 类型: Array<Readonly<object>>；生命周期: 当前校验；作用: 保留输入顺序和同名多值语义。
  const normalizedHeaders = [];

  for (let index = 0; index < headers.length; index += 1) {
    const field = `headers[${index}]`;
    const header = assertExactKeys(headers[index], PROXY_HEADER_KEYS, field);

    if (typeof header.name !== 'string'
      || header.name.length === 0
      || header.name.length > limits.requestHeaderNameCharacters
      || !HTTP_HEADER_NAME_PATTERN.test(header.name)) {
      failValidation(`${field}.name`, 'invalid_header_name');
    }

    if (typeof header.value !== 'string') {
      failValidation(`${field}.value`, 'header_value_must_be_string');
    }

    if (HTTP_HEADER_FORBIDDEN_VALUE_PATTERN.test(header.value)) {
      failValidation(`${field}.value`, 'header_value_contains_control_character');
    }

    if (Buffer.byteLength(header.value, 'utf8') > limits.requestHeaderValueBytes) {
      failValidation(`${field}.value`, 'header_value_exceeds_byte_limit');
    }

    normalizedHeaders.push(Object.freeze({ name: header.name.toLowerCase(), value: header.value }));
  }

  return Object.freeze(normalizedHeaders);
}

/**
 * 校验请求方法、运输编码、数据类型和解码后容量组合。
 * 调用方: validateProxyRequestEnvelope。
 * 副作用: 只创建冻结容器；不解析或序列化 Provider 的业务对象。
 * 失败路径: 字段不精确、GET 携带正文、编码/数据不匹配、base64 非规范或字节超限时抛错。
 *
 * @param {string} method 已通过枚举校验的 GET 或 POST。
 * @param {unknown} body ProxyRequestEnvelope.body 候选值。
 * @param {Readonly<object>} limits 当前部署请求体容量策略。
 * @returns {Readonly<{ encoding: string, data: string|null }>} 与输入容器隔离的原始运输描述。
 * @throws {ProxyError} 请求体不满足协议组合或容量限制时抛出。
 */
function validateBody(method, body, limits) {
  const bodyObject = assertExactKeys(body, PROXY_BODY_KEYS, 'body');

  if (typeof bodyObject.encoding !== 'string' || !PROXY_BODY_ENCODINGS.includes(bodyObject.encoding)) {
    failValidation('body.encoding', 'unsupported_encoding');
  }

  if (bodyObject.encoding === 'none') {
    if (bodyObject.data !== null) {
      failValidation('body.data', 'none_requires_null');
    }
    return Object.freeze({ encoding: 'none', data: null });
  }

  // 方法边界: GET 不允许通过任何编码携带实体，避免中间网络栈产生不一致语义。
  if (method === 'GET') {
    failValidation('body', 'get_requires_none_and_null');
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

  if (typeof bodyObject.data !== 'string'
    || !STANDARD_BASE64_PATTERN.test(bodyObject.data)
    || Buffer.from(bodyObject.data, 'base64').toString('base64') !== bodyObject.data) {
    failValidation('body.data', 'base64_requires_canonical_string');
  }

  if (Buffer.byteLength(bodyObject.data, 'base64') > limits.requestBodyBytes) {
    failValidation('body.data', 'exceeds_request_body_limit');
  }

  return Object.freeze({ encoding: 'base64', data: bodyObject.data });
}

/**
 * 精确校验 ProxyRequestEnvelope 2.1.0 并生成网络层输入。
 * 调用方: POST /api/proxy/v2/request 路由和契约测试。
 * 副作用: 只创建规范化冻结副本；不执行 DNS、上游网络、日志或跨请求状态写入。
 * 失败路径: 未知协议版本抛 PROXY_PROTOCOL_UNSUPPORTED；其他缺陷抛 PROXY_VALIDATION_ERROR。
 *
 * @param {unknown} input Fastify 解析后的 JSON 请求体。
 * @param {Readonly<object>} policy 当前进程冻结代理策略。
 * @returns {Readonly<{ request: object, effectiveLimits: object }>} 隔离请求与客户端不能提高的最终限制。
 * @throws {ProxyError} 任何网络前置协议检查失败时抛出。
 */
export function validateProxyRequestEnvelope(input, policy) {
  const envelope = assertExactKeys(input, PROXY_REQUEST_KEYS, 'request');

  // 版本边界: 只接受精确 2.1.0，不根据主次版本或旧字段推断兼容行为。
  if (typeof envelope.protocolVersion !== 'string' || envelope.protocolVersion !== PROXY_PROTOCOL_VERSION) {
    throw new ProxyError('PROXY_PROTOCOL_UNSUPPORTED', { details: { field: 'protocolVersion', reason: 'exact_version_required' } });
  }

  const requestId = assertBoundedIdentifier(envelope.requestId, 'requestId', policy.limits.requestIdCharacters);
  // 类型: string；来源: 客户端请求；作用: 只用于审计关联，不能决定目标、安全或响应分支。
  const sourceId = assertBoundedIdentifier(envelope.sourceId, 'sourceId', policy.limits.sourceIdCharacters);
  const target = validateTarget(envelope.target, policy.limits);
  const headers = validateHeaders(envelope.headers, policy.limits);
  const body = validateBody(target.method, envelope.body, policy.limits);
  const requestedTimeoutMs = assertPositiveSafeInteger(envelope.timeoutMs, 'timeoutMs');
  const requestedResponseBytes = assertPositiveSafeInteger(envelope.maxResponseBytes, 'maxResponseBytes');

  // 类型: Readonly<object>；来源: 全部规范化字段；作用: 运输执行器唯一允许消费的请求对象。
  const request = Object.freeze({
    protocolVersion: PROXY_PROTOCOL_VERSION,
    requestId,
    sourceId,
    target,
    headers,
    body,
    timeoutMs: requestedTimeoutMs,
    maxResponseBytes: requestedResponseBytes
  });
  // 类型: Readonly<object>；来源: 客户端值与部署上限逐项取小；作用: 客户端只能收紧超时和响应容量。
  const effectiveLimits = Object.freeze({
    timeoutMs: Math.min(requestedTimeoutMs, policy.limits.upstreamTimeoutMs),
    maxResponseBytes: Math.min(requestedResponseBytes, policy.limits.responseBytes)
  });

  return Object.freeze({ request, effectiveLimits });
}
