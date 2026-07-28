/*
  proxyHeaders.js 模块说明

  - 文件职责:
      集中裁剪代理请求控制头，并把 Undici 原始响应头转换为容量受限、顺序稳定且允许同名项的协议数组。
      供每个上游跳和响应编码共用；本文件不发起网络、不保存 Cookie，也不合并重复响应头。

  - 导入库及文件汇总(2 条，内置 1 条，第三方 0 条，自定义 1 条):
      node:buffer#Buffer: 按 UTF-8 或 Latin-1 计算请求和响应头真实字节容量。
      ../errors/proxyError.js#ProxyError: 将响应头容量和结构失败映射为冻结代理错误。

  - 模块级常量:
      HOP_BY_HOP_HEADERS: ReadonlySet<string>，请求和响应都不得跨代理边界传递的逐跳头。
      REQUEST_CONTROL_HEADERS: ReadonlySet<string>，必须由代理或 Undici 自行生成的请求头。
      CROSS_ORIGIN_SENSITIVE_HEADERS: ReadonlySet<string>，重定向跨 origin 时不得继续携带的凭证头。
      STRIPPED_REQUEST_NAMES: ReadonlySet<string>，禁止客户端伪造的代理链控制头名称。
      STRIPPED_REQUEST_PREFIXES: ReadonlyArray<string>，禁止客户端伪造的代理和浏览器控制头前缀。
      IDENTITY_CONTENT_ENCODING: string，代理要求上游返回未压缩字节的请求头值。
      HTTP_HEADER_NAME_PATTERN: RegExp，响应头名称必须满足的标准 token 语法。

  - 模块级变量:
      无

  - 模块级辅助函数:
      collectConnectionTokens(entries): 解析 Connection 声明的附加逐跳头名称。
      shouldStripRequestHeader(name, blockedHeaders, crossOrigin): 判断请求头是否越过代理边界。
      sanitizeRequestHeaders(headers, options): 生成当前跳安全请求头对象。
      sanitizeResponseHeaders(rawHeaders, limits): 生成有序且容量受限的响应头条目。
      getResponseHeaderValues(headers, name): 按顺序读取指定响应头全部值。
      getSingleResponseHeader(headers, name): 读取只能出现一次的响应头并拒绝歧义。

  - 模块级类:
      无

  - 对外导出:
      sanitizeRequestHeaders: function，upstreamTransport 构造每跳请求头。
      sanitizeResponseHeaders: function，proxyExecutor 在处理重定向或响应体前裁剪原始头。
      getResponseHeaderValues: function，响应编码检查 content-type 与 content-encoding。
      getSingleResponseHeader: function，重定向处理读取唯一 Location。
*/

// 导入来源: node:buffer；导入内容: Buffer；文件作用: 按协议指定编码计算单个头值容量。
import { Buffer } from 'node:buffer';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 将响应头容量、结构或歧义转换为固定错误。
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

// 类型: ReadonlySet<string>；来源: 标准代理链头；作用: 客户端不能伪造原始来源和已经过的代理节点。
const STRIPPED_REQUEST_NAMES = new Set(['forwarded', 'via']);

// 类型: ReadonlyArray<string>；来源: 代理和浏览器受控头边界；作用: 客户端不能伪造代理扩展或浏览器连接上下文。
const STRIPPED_REQUEST_PREFIXES = Object.freeze(['proxy-', 'sec-', 'x-forwarded-']);

// 类型: string；来源: HTTP Content-Encoding 标准值；作用: 避免上游压缩字节导致容量和 JSON/UTF-8 解码语义不明确。
const IDENTITY_CONTENT_ENCODING = 'identity';

// 类型: RegExp；来源: RFC 9110 field-name token；作用: 即使测试或传输适配器异常，也不让非法名称进入协议响应。
const HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9a-z-]+$/u;

/**
 * 从 Connection 头中收集当前消息声明的附加逐跳头。
 * 调用方: sanitizeRequestHeaders 和 sanitizeResponseHeaders。
 * 副作用: 无；返回新 Set，不修改输入条目。
 * 失败路径: 非字符串值被忽略，输入结构的合法性由对应调用方独立处理。
 *
 * @param {Array<[string, unknown]>} entries 已规范或原始头名称和值。
 * @returns {Set<string>} 小写逐跳头名称集合。
 */
function collectConnectionTokens(entries) {
  // 类型: Set<string>；生命周期: 当前消息头处理；作用: 合并所有 Connection 值中声明的动态逐跳字段。
  const tokens = new Set();

  for (const [name, value] of entries) {
    if (name.toLowerCase() !== 'connection' || typeof value !== 'string') {
      continue;
    }

    // 循环: 每个逗号分隔 token 规范为小写，空 token 不进入阻止集合。
    for (const token of value.split(',')) {
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
 * 调用方: sanitizeRequestHeaders 的逐项循环。
 * 副作用: 无；纯集合和前缀判断。
 * 失败路径: 无；true 表示删除，false 表示允许交给 Undici。
 *
 * @param {string} name 已小写的请求头名称。
 * @param {Set<string>} blockedHeaders 静态和 Connection 动态控制头集合。
 * @param {boolean} crossOrigin true 表示当前跳已离开原始 origin，false 表示仍在原 origin。
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
 * 为当前上游跳生成安全请求头对象。
 * 调用方: proxyExecutor 在初始请求和每个重定向跳调用。
 * 副作用: 创建冻结副本并强制 accept-encoding=identity；不修改原 headers、不保存 Cookie。
 * 成功路径: 保留端到端业务头，同 origin 可保留凭证，控制头和跨 origin 凭证被删除。
 * 失败路径: 无；候选头已由 ProxyRequestValidator 完成名称和值校验。
 *
 * @param {Readonly<Record<string, string>>} headers 已规范为小写的协议候选请求头。
 * @param {object} options 当前跳语义。
 * @param {boolean} options.crossOrigin true 删除 authorization/cookie，false 允许发送给原 origin。
 * @param {boolean} options.hasBody true 保留 content-type，false 删除无请求体的内容描述。
 * @returns {Readonly<Record<string, string>>} 可直接交给 Undici 的冻结请求头。
 */
export function sanitizeRequestHeaders(headers, { crossOrigin, hasBody }) {
  // 类型: Array<[string,string]>；来源: 已校验协议头对象；作用: 保留输入顺序并提取 Connection 动态控制项。
  const entries = Object.entries(headers);
  // 类型: Set<string>；来源: 静态控制头和 Connection tokens；作用: 统一执行逐跳删除。
  const blockedHeaders = new Set([...REQUEST_CONTROL_HEADERS, ...collectConnectionTokens(entries)]);
  // 类型: Record<string,string>；生命周期: 当前跳；作用: 使用 null 原型避免特殊键影响对象继承。
  const forwardedHeaders = Object.create(null);

  for (const [name, value] of entries) {
    if (shouldStripRequestHeader(name, blockedHeaders, crossOrigin)) {
      continue;
    }

    if (!hasBody && name === 'content-type') {
      continue;
    }

    forwardedHeaders[name] = value;
  }

  // 代理控制: 覆盖客户端 accept-encoding，确保响应容量统计和解码面对未压缩原始表示。
  forwardedHeaders['accept-encoding'] = IDENTITY_CONTENT_ENCODING;
  return Object.freeze({ ...forwardedHeaders });
}

/**
 * 把 Undici raw 交替数组转换为有序响应头条目。
 * 调用方: proxyExecutor 每次收到上游响应后、读取 Location 或 body 前。
 * 副作用: 创建并冻结新条目；不合并同名头，不修改 rawHeaders。
 * 成功路径: 删除静态和 Connection 声明的逐跳头，保留 set-cookie 等重复端到端头顺序。
 * 失败路径: 数组结构非法或名称非法抛解码错误；数量和单项容量超限抛响应过大。
 *
 * @param {unknown} rawHeaders Undici responseHeaders='raw' 返回的 name/value 交替数组。
 * @param {Readonly<object>} limits 当前部署响应头容量策略。
 * @returns {ReadonlyArray<Readonly<{ name: string, value: string }>>} 冻结有序响应头条目。
 * @throws {ProxyError} 响应头不能安全进入协议外壳时抛出。
 */
export function sanitizeResponseHeaders(rawHeaders, limits) {
  if (!Array.isArray(rawHeaders) || rawHeaders.length % 2 !== 0) {
    throw new ProxyError('PROXY_RESPONSE_DECODE_ERROR', { details: { field: 'upstream.headers', reason: 'invalid_raw_header_shape' } });
  }

  // 类型: Array<[string,string]>；来源: Undici raw 交替数组；作用: 先规范值，再统一解析 Connection tokens。
  const entries = [];

  for (let index = 0; index < rawHeaders.length; index += 2) {
    entries.push([String(rawHeaders[index]).toLowerCase(), String(rawHeaders[index + 1])]);
  }

  if (entries.length > limits.responseHeaderCount) {
    throw new ProxyError('PROXY_RESPONSE_TOO_LARGE', { details: { field: 'upstream.headers', reason: 'header_count_limit' } });
  }

  // 类型: Set<string>；来源: 静态逐跳集合和上游 Connection tokens；作用: 删除只描述当前上游连接的字段。
  const blockedHeaders = new Set([...HOP_BY_HOP_HEADERS, ...collectConnectionTokens(entries)]);
  // 类型: Array<Readonly<object>>；生命周期: 当前响应；作用: 按上游顺序保存允许回填的重复头。
  const sanitizedHeaders = [];

  for (const [name, value] of entries) {
    if (name.length === 0 || name.length > limits.responseHeaderNameCharacters) {
      throw new ProxyError('PROXY_RESPONSE_TOO_LARGE', { details: { field: 'upstream.headers', reason: 'header_name_limit' } });
    }

    if (!HTTP_HEADER_NAME_PATTERN.test(name)) {
      throw new ProxyError('PROXY_RESPONSE_DECODE_ERROR', { details: { field: 'upstream.headers', reason: 'invalid_header_name' } });
    }

    if (Buffer.byteLength(value, 'latin1') > limits.responseHeaderValueBytes) {
      throw new ProxyError('PROXY_RESPONSE_TOO_LARGE', { details: { field: 'upstream.headers', reason: 'header_value_limit' } });
    }

    if (!blockedHeaders.has(name)) {
      sanitizedHeaders.push(Object.freeze({ name, value }));
    }
  }

  return Object.freeze(sanitizedHeaders);
}

/**
 * 按协议顺序读取指定响应头的全部值。
 * 调用方: getSingleResponseHeader 和 proxyResponseEncoder。
 * 副作用: 无；返回新冻结数组，不修改响应头条目。
 * 失败路径: 无；不存在时返回空数组。
 *
 * @param {ReadonlyArray<Readonly<{ name: string, value: string }>>} headers 已裁剪响应头。
 * @param {string} name 需要查询的小写或混合大小写头名称。
 * @returns {ReadonlyArray<string>} 与上游顺序一致的全部匹配值。
 */
export function getResponseHeaderValues(headers, name) {
  const normalizedName = name.toLowerCase();
  return Object.freeze(headers.filter((header) => header.name === normalizedName).map((header) => header.value));
}

/**
 * 读取协议要求唯一的响应头。
 * 调用方: proxyExecutor 读取重定向 Location。
 * 副作用: 无；不删除或合并头。
 * 成功路径: 不存在返回 null，单项返回原值。
 * 失败路径: 同名头超过一个时抛响应解码错误，避免重定向目标选择歧义。
 *
 * @param {ReadonlyArray<Readonly<{ name: string, value: string }>>} headers 已裁剪响应头。
 * @param {string} name 需要唯一读取的头名称。
 * @returns {string|null} 唯一头值或不存在。
 * @throws {ProxyError} 同名头出现多次时抛出。
 */
export function getSingleResponseHeader(headers, name) {
  const values = getResponseHeaderValues(headers, name);

  if (values.length > 1) {
    throw new ProxyError('PROXY_RESPONSE_DECODE_ERROR', { details: { field: `upstream.headers.${name.toLowerCase()}`, reason: 'duplicate_single_header' } });
  }

  return values[0] ?? null;
}
