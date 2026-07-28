/*
  proxyHeaders.js 模块说明

  - 文件职责:
      集中裁剪代理控制头，并在请求和响应方向保留端到端头的顺序与同名多值语义。
      ProxyExecutor 每跳调用本模块；本文件不合并业务头、不注入内容协商、不保存 Cookie，也不访问网络。

  - 导入库及文件汇总(2 条，内置 1 条，第三方 0 条，自定义 1 条):
      node:buffer#Buffer: 按 Latin-1 计算上游响应头运输容量。
      ../errors/proxyError.js#ProxyError: 将头结构、容量和重定向歧义映射为稳定代理错误。

  - 模块级常量:
      HOP_BY_HOP_HEADERS: ReadonlySet<string>，请求和响应均不得跨代理边界传递的逐跳头。
      REQUEST_CONTROL_HEADERS: ReadonlySet<string>，必须由代理或 Undici 生成的请求控制头。
      CROSS_ORIGIN_SENSITIVE_HEADERS: ReadonlySet<string>，跨 origin 重定向不得继续携带的凭证头。
      STRIPPED_REQUEST_NAMES: ReadonlySet<string>，禁止客户端伪造的代理链头。
      STRIPPED_REQUEST_PREFIXES: ReadonlyArray<string>，禁止客户端伪造的代理和浏览器控制头前缀。
      HTTP_HEADER_NAME_PATTERN: RegExp，上游响应头名称格式。

  - 模块级变量:
      无

  - 模块级辅助函数:
      collectConnectionTokens(headers): 收集 Connection 声明的附加逐跳头。
      shouldStripRequestHeader(name, blockedHeaders, crossOrigin): 判断请求头是否越过运输边界。
      sanitizeRequestHeaders(headers, options): 生成当前跳有序请求头条目。
      sanitizeResponseHeaders(rawHeaders, limits): 生成容量受限的有序响应头条目。
      getResponseHeaderValues(headers, name): 按顺序读取指定响应头全部值。
      getSingleResponseHeader(headers, name): 为重定向读取唯一响应头。

  - 模块级类:
      无

  - 对外导出:
      sanitizeRequestHeaders: function，ProxyExecutor 构造每跳安全有序请求头。
      sanitizeResponseHeaders: function，ProxyExecutor 裁剪 Undici 原始响应头。
      getResponseHeaderValues: function，媒体安全边界按名称读取全部值。
      getSingleResponseHeader: function，重定向安全边界读取唯一 Location。
*/

// 导入来源: node:buffer；导入内容: Buffer；文件作用: 按 HTTP 头字节表示计算响应头容量。
import { Buffer } from 'node:buffer';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 将响应头运输失败和重定向歧义转换为固定错误。
import { ProxyError } from '../errors/proxyError.js';

// 类型: ReadonlySet<string>；来源: RFC 9110 hop-by-hop 语义；作用: 这些头只描述当前连接，不能进入下一跳或协议响应。
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

// 类型: ReadonlySet<string>；来源: 代理与 Undici 连接职责；作用: 防止客户端覆盖目标主机、长度、连接和媒体范围边界。
const REQUEST_CONTROL_HEADERS = new Set([
  ...HOP_BY_HOP_HEADERS,
  'host',
  'content-length',
  'expect',
  'range'
]);

// 类型: ReadonlySet<string>；来源: HTTP 跨 origin 重定向凭证安全规则；作用: 凭证只允许继续发送给原始 origin。
const CROSS_ORIGIN_SENSITIVE_HEADERS = new Set(['authorization', 'cookie']);

// 类型: ReadonlySet<string>；来源: 标准代理链头；作用: 客户端不能伪造原始来源和已经经过的代理节点。
const STRIPPED_REQUEST_NAMES = new Set(['forwarded', 'via']);

// 类型: ReadonlyArray<string>；来源: 代理和浏览器受控头边界；作用: 客户端不能伪造代理扩展或浏览器连接上下文。
const STRIPPED_REQUEST_PREFIXES = Object.freeze(['proxy-', 'sec-', 'x-forwarded-']);

// 类型: RegExp；来源: RFC 9110 field-name token；作用: 防止异常传输适配器把非法名称放进 ProxyResponseEnvelope。
const HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9a-z-]+$/u;

/**
 * 从 Connection 头中收集当前消息声明的附加逐跳头。
 * 调用方: sanitizeRequestHeaders 和 sanitizeResponseHeaders。
 * 副作用: 无；返回新 Set，不修改输入条目。
 * 失败路径: 无；两类调用方已经把名称和值规范为字符串。
 *
 * @param {ReadonlyArray<Readonly<{ name: string, value: string }>>} headers 规范化有序头条目。
 * @returns {Set<string>} 小写逐跳头名称集合。
 */
function collectConnectionTokens(headers) {
  // 类型: Set<string>；生命周期: 当前消息头处理；作用: 合并所有 Connection 值声明的动态逐跳字段。
  const tokens = new Set();

  for (const header of headers) {
    if (header.name !== 'connection') {
      continue;
    }

    // 循环: 每个逗号分隔 token 规范为小写，空 token 不进入阻止集合。
    for (const token of header.value.split(',')) {
      const normalizedToken = token.trim().toLowerCase();
      if (normalizedToken !== '') {
        tokens.add(normalizedToken);
      }
    }
  }

  return tokens;
}

/**
 * 判断候选请求头是否必须在当前跳删除。
 * 调用方: sanitizeRequestHeaders 逐项循环。
 * 副作用: 无；纯集合和前缀判断。
 * 失败路径: 无；true 表示删除，false 表示允许原样运输。
 *
 * @param {string} name 已小写请求头名称。
 * @param {Set<string>} blockedHeaders 静态和 Connection 动态控制头集合。
 * @param {boolean} crossOrigin true 表示已经离开原始 origin，false 表示仍在原 origin。
 * @returns {boolean} true 删除当前头；false 保留。
 */
function shouldStripRequestHeader(name, blockedHeaders, crossOrigin) {
  if (blockedHeaders.has(name)) {
    return true;
  }

  if (crossOrigin && CROSS_ORIGIN_SENSITIVE_HEADERS.has(name)) {
    return true;
  }

  return STRIPPED_REQUEST_NAMES.has(name) || STRIPPED_REQUEST_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * 为当前上游跳生成安全且有序的请求头条目。
 * 调用方: ProxyExecutor 在初始请求和每个重定向跳调用。
 * 副作用: 创建冻结条目数组；不修改输入、不合并同名头、不注入内容协商，也不保存 Cookie。
 * 成功路径: 保留端到端业务头顺序，同 origin 保留凭证，控制头和跨 origin 凭证被删除。
 * 失败路径: 无；候选头已由 ProxyRequestValidator 完成名称、值和容量校验。
 *
 * @param {ReadonlyArray<Readonly<{ name: string, value: string }>>} headers 已校验协议请求头。
 * @param {object} options 当前跳语义。
 * @param {boolean} options.crossOrigin true 删除 authorization/cookie；false 保留原始凭证头。
 * @param {boolean} options.hasBody true 保留实体描述；false 删除 content-type。
 * @returns {ReadonlyArray<Readonly<{ name: string, value: string }>>} 当前跳冻结请求头条目。
 */
export function sanitizeRequestHeaders(headers, { crossOrigin, hasBody }) {
  const blockedHeaders = new Set([...REQUEST_CONTROL_HEADERS, ...collectConnectionTokens(headers)]);
  // 类型: Array<Readonly<object>>；生命周期: 当前上游跳；作用: 保留全部允许头的相对顺序和重复项。
  const forwardedHeaders = [];

  for (const header of headers) {
    if (shouldStripRequestHeader(header.name, blockedHeaders, crossOrigin)) {
      continue;
    }

    if (!hasBody && header.name === 'content-type') {
      continue;
    }

    forwardedHeaders.push(Object.freeze({ name: header.name, value: header.value }));
  }

  return Object.freeze(forwardedHeaders);
}

/**
 * 把 Undici raw 交替数组转换为有序响应头条目。
 * 调用方: ProxyExecutor 每次收到上游响应后、读取 Location 或正文前。
 * 副作用: 创建并冻结新条目；不合并同名头，不修改 rawHeaders。
 * 成功路径: 删除静态和 Connection 声明的逐跳头，保留 set-cookie 等端到端重复头顺序。
 * 失败路径: 结构或名称非法视为上游 HTTP 运输失败；数量和值容量超限视为响应过大。
 *
 * @param {unknown} rawHeaders Undici responseHeaders='raw' 返回的 name/value 交替数组。
 * @param {Readonly<object>} limits 当前部署响应头容量策略。
 * @returns {ReadonlyArray<Readonly<{ name: string, value: string }>>} 冻结有序响应头条目。
 * @throws {ProxyError} 响应头不能安全进入协议外壳时抛出。
 */
export function sanitizeResponseHeaders(rawHeaders, limits) {
  if (!Array.isArray(rawHeaders) || rawHeaders.length % 2 !== 0) {
    throw new ProxyError('PROXY_UPSTREAM_NETWORK_ERROR', { details: { field: 'upstream.headers', reason: 'invalid_raw_header_shape' } });
  }

  // 类型: Array<Readonly<object>>；来源: Undici raw 交替数组；作用: 保留上游相对顺序并统一小写名称。
  const normalizedHeaders = [];

  for (let index = 0; index < rawHeaders.length; index += 2) {
    normalizedHeaders.push(Object.freeze({
      name: String(rawHeaders[index]).toLowerCase(),
      value: String(rawHeaders[index + 1])
    }));
  }

  if (normalizedHeaders.length > limits.responseHeaderCount) {
    throw new ProxyError('PROXY_RESPONSE_TOO_LARGE', { details: { field: 'upstream.headers', reason: 'header_count_limit' } });
  }

  const blockedHeaders = new Set([...HOP_BY_HOP_HEADERS, ...collectConnectionTokens(normalizedHeaders)]);
  const sanitizedHeaders = [];

  for (const header of normalizedHeaders) {
    if (header.name.length === 0 || header.name.length > limits.responseHeaderNameCharacters) {
      throw new ProxyError('PROXY_RESPONSE_TOO_LARGE', { details: { field: 'upstream.headers', reason: 'header_name_limit' } });
    }

    if (!HTTP_HEADER_NAME_PATTERN.test(header.name)) {
      throw new ProxyError('PROXY_UPSTREAM_NETWORK_ERROR', { details: { field: 'upstream.headers', reason: 'invalid_header_name' } });
    }

    if (Buffer.byteLength(header.value, 'latin1') > limits.responseHeaderValueBytes) {
      throw new ProxyError('PROXY_RESPONSE_TOO_LARGE', { details: { field: 'upstream.headers', reason: 'header_value_limit' } });
    }

    if (!blockedHeaders.has(header.name)) {
      sanitizedHeaders.push(header);
    }
  }

  return Object.freeze(sanitizedHeaders);
}

/**
 * 按协议顺序读取指定响应头的全部值。
 * 调用方: getSingleResponseHeader 和响应媒体安全检查。
 * 副作用: 无；返回新冻结数组，不修改响应头条目。
 * 失败路径: 无；不存在时返回空数组。
 *
 * @param {ReadonlyArray<Readonly<{ name: string, value: string }>>} headers 已裁剪响应头。
 * @param {string} name 需要查询的头名称。
 * @returns {ReadonlyArray<string>} 与上游顺序一致的全部匹配值。
 */
export function getResponseHeaderValues(headers, name) {
  const normalizedName = name.toLowerCase();
  return Object.freeze(headers.filter((header) => header.name === normalizedName).map((header) => header.value));
}

/**
 * 为重定向安全判断读取唯一响应头。
 * 调用方: ProxyExecutor 只在 3xx 状态读取 Location。
 * 副作用: 无；不删除、合并或改写头。
 * 成功路径: 不存在返回 null，单项返回原值。
 * 失败路径: 同名值超过一个时抛 PROXY_TARGET_FORBIDDEN，避免选择不确定的重定向目标。
 *
 * @param {ReadonlyArray<Readonly<{ name: string, value: string }>>} headers 已裁剪响应头。
 * @param {string} name 需要唯一读取的头名称。
 * @returns {string|null} 唯一头值或不存在。
 * @throws {ProxyError} 重定向头存在歧义时抛出。
 */
export function getSingleResponseHeader(headers, name) {
  const values = getResponseHeaderValues(headers, name);

  if (values.length > 1) {
    throw new ProxyError('PROXY_TARGET_FORBIDDEN', { details: { field: `upstream.headers.${name.toLowerCase()}`, reason: 'ambiguous_redirect_header' } });
  }

  return values[0] ?? null;
}
