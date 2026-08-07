/*
  requestLogSanitizer.js 模块说明

  - 文件职责:
      把已校验代理请求和实际请求字节投影为可记录的 requestProcess，并规范响应 Content-Type。
      本模块只处理日志数据最小化，不改变代理请求、响应或 Provider 业务数据。

  - 导入库及文件汇总(1 条，内置 1 条，第三方 0 条，自定义 0 条):
      node:buffer#Buffer: 核对实际 POST 字节并按 UTF-8 解析结构化正文。

  - 模块级常量:
      CONTENT_TYPE_PATTERN: RegExp，合法主媒体类型格式。
      CHARSET_PATTERN: RegExp，可记录 charset 参数格式。
      JSON_MEDIA_TYPES: ReadonlySet<string>，允许解析为 JSON 参数的媒体类型。
      FORM_MEDIA_TYPE: string，允许解析为表单参数的媒体类型。
      SENSITIVE_PARAMETER_KEYS: ReadonlySet<string>，递归整项删除的敏感键。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeParameterKey(value): 归一化敏感键比较文本。
      sanitizeParameterValue(value): 递归删除敏感键并复制 JSON 值。
      normalizeLogContentType(value): 规范可记录媒体类型和 charset。
      extractUniqueContentType(headers): 从有序头中读取唯一 Content-Type。
      appendParameter(target, key, value): 保留重复 query/form 键顺序。
      parseUrlEncodedParameters(text): 解析 URLSearchParams 并递归脱敏。
      createRequestLogProcess(options): 创建请求过程固定字段。
      extractResponseLogContentType(headers): 读取上游响应规范内容类型。

  - 模块级类:
      无

  - 对外导出:
      createRequestLogProcess: ProxyAuditLogger 创建请求快照使用。
      extractResponseLogContentType: ProxyAuditLogger 登记响应概况使用。
*/

// 导入来源: node:buffer；导入内容: Buffer；文件作用: 核对 Executor 交付的实际 POST 字节并解析 UTF-8 结构化正文。
import { Buffer } from 'node:buffer';

// 类型: RegExp；作用: 只记录标准 type/subtype，拒绝任意头值文本。
const CONTENT_TYPE_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;

// 类型: RegExp；作用: charset 只允许稳定 token，不保留其它 Content-Type 参数。
const CHARSET_PATTERN = /^[A-Za-z0-9._-]+$/u;

// 类型: ReadonlySet<string>；作用: 标准 JSON 和 +json 类型可以尝试解析结构化参数。
const JSON_MEDIA_TYPES = new Set(['application/json']);

// 类型: string；作用: 只有标准 URL 编码表单可以按键值记录。
const FORM_MEDIA_TYPE = 'application/x-www-form-urlencoded';

// 类型: ReadonlySet<string>；作用: 大小写和常见分隔符归一后命中即递归删除整项，不能用掩码保留形状。
const SENSITIVE_PARAMETER_KEYS = new Set([
  'authorization',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'token',
  'cookie',
  'cookies',
  'password',
  'passwd',
  'pwd',
  'captcha',
  'verificationcode',
  'verifycode',
  'secret',
  'clientsecret',
  'credential',
  'credentials',
  'session',
  'sessionid',
  '密码',
  '验证码',
  '令牌',
  '密钥',
  '授权'
]);

/**
 * 归一化参数键供敏感集合比较。
 * 调用方: sanitizeParameterValue。
 * 纯函数: 执行 Unicode 兼容规范化、删除分隔符并转小写。
 * 失败路径: 对象键由 JavaScript 保证为字符串，不抛出。
 *
 * @param {string} value 当前参数键。
 * @returns {string} 可与敏感集合比较的文本。
 */
function normalizeParameterKey(value) {
  return value.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
}

/**
 * 递归复制 JSON 参数并删除敏感键。
 * 调用方: JSON、query 和表单参数解析。
 * 纯函数: 创建新对象/数组，不修改输入；JSON.parse 和 URLSearchParams 只产生 JSON 安全值。
 * 失败路径: 非 JSON 标量返回 null，避免把类实例或可执行值带入日志。
 *
 * @param {*} value 当前参数值。
 * @returns {*} 已删除敏感项的 JSON 安全副本。
 */
function sanitizeParameterValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((entry) => sanitizeParameterValue(entry));
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return null;

  const sanitized = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!SENSITIVE_PARAMETER_KEYS.has(normalizeParameterKey(key))) {
      sanitized[key] = sanitizeParameterValue(entry);
    }
  }
  return sanitized;
}

/**
 * 规范可记录的 Content-Type。
 * 调用方: 请求和响应内容类型提取。
 * 纯函数: 只保留小写主媒体类型和唯一合法 charset，删除 boundary 等自由参数。
 * 失败路径: 缺失、重复外部判断或非法主类型返回 null。
 *
 * @param {unknown} value 单一 Content-Type 值。
 * @returns {string|null} 规范媒体类型，可带 charset，或 null。
 */
function normalizeLogContentType(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split(';').map((part) => part.trim());
  const mediaType = parts.shift()?.toLowerCase() ?? '';
  if (!CONTENT_TYPE_PATTERN.test(mediaType)) return null;

  const charsetValues = parts
    .map((part) => part.match(/^charset\s*=\s*"?([^"\s;]+)"?$/iu)?.[1] ?? null)
    .filter((part) => part !== null);
  if (charsetValues.length !== 1 || !CHARSET_PATTERN.test(charsetValues[0])) return mediaType;
  return `${mediaType}; charset=${charsetValues[0].toLowerCase()}`;
}

/**
 * 从有序头中提取唯一可记录 Content-Type。
 * 调用方: createRequestLogProcess 和 extractResponseLogContentType。
 * 纯函数: 只读取名称精确为 content-type 的条目，不记录其它请求头。
 * 失败路径: 缺失、重复或非法值返回 null。
 *
 * @param {ReadonlyArray<Readonly<{name: string, value: string}>>} headers 已校验或裁剪的有序头。
 * @returns {string|null} 规范内容类型或 null。
 */
function extractUniqueContentType(headers) {
  const values = headers.filter((header) => header.name === 'content-type').map((header) => header.value);
  return values.length === 1 ? normalizeLogContentType(values[0]) : null;
}

/**
 * 向参数对象追加一个值并保留重复键顺序。
 * 调用方: parseUrlEncodedParameters。
 * 副作用: 只修改当前新建 target；首值为字符串，重复后转换为数组。
 * 失败路径: 无，URLSearchParams 已返回字符串键值。
 *
 * @param {Record<string, string|Array<string>>} target 当前参数对象。
 * @param {string} key 参数键。
 * @param {string} value 参数值。
 * @returns {void} 结果保存在 target。
 */
function appendParameter(target, key, value) {
  if (!Object.hasOwn(target, key)) {
    target[key] = value;
  } else if (Array.isArray(target[key])) {
    target[key].push(value);
  } else {
    target[key] = [target[key], value];
  }
}

/**
 * 解析 query 或 URL 编码表单并删除敏感键。
 * 调用方: createRequestLogProcess。
 * 纯函数: 创建 URLSearchParams 和新对象，不修改 URL 或正文。
 * 失败路径: 标准解析器失败时返回 null。
 *
 * @param {string} text query 或表单文本。
 * @returns {object|null} 保留重复键的脱敏参数对象或 null。
 */
function parseUrlEncodedParameters(text) {
  try {
    const parameters = {};
    for (const [key, value] of new URLSearchParams(text)) appendParameter(parameters, key, value);
    return sanitizeParameterValue(parameters);
  } catch {
    return null;
  }
}

/**
 * 创建代理请求的日志过程快照。
 * 调用方: ProxyAuditLogger.beginRequest。
 * 纯函数: 读取已校验请求和 Executor 隔离字节，返回新对象；不改变上游请求。
 * 成功路径: GET 记录 query；POST 只解析 JSON 或表单，其它正文只记录类型和字节数。
 * 失败路径: 输入缺失或实际字节形状无效时抛 TypeError；正文解析失败只令 parameters=null。
 *
 * @param {object} options 请求日志输入。
 * @param {Readonly<object>} options.request 已校验 ProxyRequestEnvelope。
 * @param {string|null} options.fromIP 已确认公网客户端地址或 null。
 * @param {Readonly<{body: Buffer|undefined, hasBody: boolean}>} options.encodedBody 实际上游请求字节。
 * @returns {object} 可交给日志事件工厂深冻结的 requestProcess。
 * @throws {TypeError} 输入不满足 Executor 审计边界时抛出。
 */
export function createRequestLogProcess({ request, fromIP, encodedBody }) {
  if (!request?.target
    || (fromIP !== null && typeof fromIP !== 'string')
    || !encodedBody
    || (encodedBody.body !== undefined && !Buffer.isBuffer(encodedBody.body))) {
    throw new TypeError('请求日志快照需要已校验请求、公网来源和实际请求字节');
  }

  const targetUrl = new URL(request.target.url);
  const requestContentType = extractUniqueContentType(request.headers);
  const bodyBytes = encodedBody.body?.byteLength ?? 0;
  let parameterSource = null;
  let parameters = null;

  if (request.target.method === 'GET') {
    parameterSource = 'query';
    parameters = parseUrlEncodedParameters(targetUrl.searchParams.toString());
  } else if (encodedBody.body !== undefined && requestContentType !== null) {
    const mediaType = requestContentType.split(';', 1)[0];
    const text = encodedBody.body.toString('utf8');
    if (JSON_MEDIA_TYPES.has(mediaType) || mediaType.endsWith('+json')) {
      try {
        parameterSource = 'body';
        parameters = sanitizeParameterValue(JSON.parse(text));
      } catch {
        parameters = null;
      }
    } else if (mediaType === FORM_MEDIA_TYPE) {
      parameterSource = 'body';
      parameters = parseUrlEncodedParameters(text);
    }
  }

  targetUrl.search = '';
  targetUrl.hash = '';
  return {
    fromIP,
    destinationDomain: targetUrl.hostname,
    destinationIP: null,
    method: request.target.method,
    url: targetUrl.toString(),
    parameterSource,
    parameters,
    contentType: requestContentType,
    contentLengthBytes: bodyBytes
  };
}

/**
 * 从裁剪后的上游响应头提取日志 Content-Type。
 * 调用方: ProxyAuditLogger.recordResponse。
 * 纯函数: 不修改响应头，也不读取响应正文。
 * 失败路径: Content-Type 缺失、重复或非法时返回 null。
 *
 * @param {ReadonlyArray<Readonly<{name: string, value: string}>>} headers 已裁剪响应头。
 * @returns {string|null} 规范响应内容类型或 null。
 */
export function extractResponseLogContentType(headers) {
  if (!Array.isArray(headers)) throw new TypeError('响应日志内容类型需要有序头数组');
  return extractUniqueContentType(headers);
}
