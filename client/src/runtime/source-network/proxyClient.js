/*
  proxyClient.js 模块说明

  - 文件职责:
      把 SourceContext.network.request() 已规范化的 SourceNetworkRequest 映射为 ProxyRequestEnvelope 1.0.0，
      调用后端唯一代理入口，并把 ProxyResponseEnvelope / ProxyErrorEnvelope 转回前端网络边界结果。
      本文件是前端唯一的后端代理协议调用者，不解析影视业务、不写页面状态、不保存 Cookie 或会话。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      proxyClient.config.js#PROXY_BODY_ENCODING、PROXY_CLIENT_CONFIG、PROXY_PROTOCOL_ERROR_CODE、PROXY_PROTOCOL_ERROR_RETRYABLE: 公共协议编码、入口和错误语义配置。
      proxyClientErrors.js#PROXY_CLIENT_ERROR_CODE、ProxyClientError: 前端稳定错误分类和错误对象。
      sourceShell.config.js#SOURCE_NETWORK_METHOD、SOURCE_NETWORK_RESPONSE_TYPE: Shell 方法和响应类型枚举。
      sourceShellValidators.js#assertAbortSignal、assertNotAborted、normalizeSourceNetworkRequest: 独立复核请求和生命周期边界。

  - 模块级常量:
      PROXY_RESPONSE_FIELDS / PROXY_UPSTREAM_FIELDS / PROXY_HEADER_FIELDS / PROXY_RESPONSE_BODY_FIELDS / PROXY_META_FIELDS / PROXY_ERROR_ENVELOPE_FIELDS / PROXY_ERROR_FIELDS: 公共代理响应对象精确字段集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertPlainObject(value, fieldName): 校验 JSON 对象边界。
      assertExactFields(value, fields, fieldName): 拒绝代理对象未知字段。
      normalizeBaseUrl(baseUrl): 校验并规范化代理服务地址。
      normalizeResponseUrl(responseUrl): 校验并规范化上游最终响应地址。
      normalizeProxyRequest(request, signal): 把 Shell 校验失败归一为客户端输入错误。
      createProxyRequest(request): 映射 SourceNetworkRequest 为代理请求外壳。
      createProxyEndpoint(baseUrl): 组合唯一代理入口地址。
      assertFetchResponse(response): 校验 fetch 响应最小稳定形状和状态语义。
      parseJsonResponse(response, signal): 读取并校验 JSON 响应正文。
      createResponseHeaders(headers): 把有序重复响应头转换为换行连接的 Record。
      decodeBase64Body(value): 把代理 base64 响应还原为 ArrayBuffer。
      createSourceNetworkResponse(envelope, request): 校验并转换成功响应外壳。
      createProxyError(errorEnvelope, request): 校验并转换后端稳定错误外壳。
      normalizeFetchError(error, signal): 区分中止和网络失败。

  - 模块级类:
      无

  - 对外导出:
      createProxyClient: function，创建只公开 request 方法的冻结前端代理客户端。
*/

import {
  // 导入来源: ./proxyClient.config.js；导入内容: PROXY_BODY_ENCODING；文件作用: 映射请求正文并核对响应编码。
  PROXY_BODY_ENCODING,

  // 导入来源: ./proxyClient.config.js；导入内容: PROXY_CLIENT_CONFIG；文件作用: 集中读取协议版本、入口和媒体类型。
  PROXY_CLIENT_CONFIG,

  // 导入来源: ./proxyClient.config.js；导入内容: PROXY_PROTOCOL_ERROR_CODE；文件作用: 拒绝后端返回未冻结的错误码。
  PROXY_PROTOCOL_ERROR_CODE,

  // 导入来源: ./proxyClient.config.js；导入内容: PROXY_PROTOCOL_ERROR_RETRYABLE；文件作用: 核对错误码与重试语义固定组合。
  PROXY_PROTOCOL_ERROR_RETRYABLE
} from './proxyClient.config.js';

import {
  // 导入来源: ./proxyClientErrors.js；导入内容: PROXY_CLIENT_ERROR_CODE；文件作用: 选择稳定前端错误分类。
  PROXY_CLIENT_ERROR_CODE,

  // 导入来源: ./proxyClientErrors.js；导入内容: ProxyClientError；文件作用: 创建不携带敏感正文的前端错误对象。
  ProxyClientError
} from './proxyClientErrors.js';

import {
  // 导入来源: ../source-shell/source-shell.config.js；导入内容: SOURCE_NETWORK_METHOD；文件作用: 映射 GET/POST body encoding。
  SOURCE_NETWORK_METHOD,

  // 导入来源: ../source-shell/source-shell.config.js；导入内容: SOURCE_NETWORK_RESPONSE_TYPE；文件作用: 校验响应转换目标。
  SOURCE_NETWORK_RESPONSE_TYPE
} from '../source-shell/source-shell.config.js';

import {
  // 导入来源: ../source-shell/sourceShellValidators.js；导入内容: assertAbortSignal；文件作用: 拒绝伪造生命周期对象。
  assertAbortSignal,

  // 导入来源: ../source-shell/sourceShellValidators.js；导入内容: assertNotAborted；文件作用: 请求前后阻止采用已中止结果。
  assertNotAborted,

  // 导入来源: ../source-shell/sourceShellValidators.js；导入内容: normalizeSourceNetworkRequest；文件作用: ProxyClient 独立复核调用方请求。
  normalizeSourceNetworkRequest
} from '../source-shell/sourceShellValidators.js';

// 类型: ReadonlyArray<string>；来源: 公共协议 6.3；作用: 固定代理成功外壳字段。
const PROXY_RESPONSE_FIELDS = Object.freeze(['protocolVersion', 'requestId', 'upstream', 'body', 'meta']);
// 类型: ReadonlyArray<string>；来源: 公共协议 6.3；作用: 固定上游响应字段。
const PROXY_UPSTREAM_FIELDS = Object.freeze(['status', 'statusText', 'responseUrl', 'headers']);
// 类型: ReadonlyArray<string>；来源: 公共协议 6.3；作用: 固定重复响应头条目字段。
const PROXY_HEADER_FIELDS = Object.freeze(['name', 'value']);
// 类型: ReadonlyArray<string>；来源: 公共协议 6.3；作用: 固定响应体外壳字段。
const PROXY_RESPONSE_BODY_FIELDS = Object.freeze(['encoding', 'data']);
// 类型: ReadonlyArray<string>；来源: 公共协议 6.3；作用: 固定响应元信息字段。
const PROXY_META_FIELDS = Object.freeze(['redirectCount', 'receivedBytes']);
// 类型: ReadonlyArray<string>；来源: 公共协议 6.4；作用: 固定代理错误外壳字段。
const PROXY_ERROR_ENVELOPE_FIELDS = Object.freeze(['protocolVersion', 'requestId', 'error']);
// 类型: ReadonlyArray<string>；来源: 公共协议 6.4；作用: 固定代理错误字段。
const PROXY_ERROR_FIELDS = Object.freeze(['code', 'message', 'retryable', 'details']);

/**
 * 校验普通 JSON 对象。
 * 纯函数: 只读取对象原型，不修改输入。
 * 失败路径: null、数组或非普通对象抛 ProxyClient response 错误。
 *
 * @param {*} value 待校验对象。
 * @param {string} fieldName 错误字段路径。
 * @returns {object} 原普通对象引用。
 * @throws {ProxyClientError} 输入不是普通对象时抛 response。
 */
function assertPlainObject(value, fieldName) {
  // 条件分支: 候选值不是具有 Object.prototype 的非数组普通对象时进入。
  // 执行内容: 抛 response，禁止代理外壳使用 null、数组或自定义实例冒充字段容器。
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new ProxyClientError(
      PROXY_CLIENT_ERROR_CODE.response,
      `${fieldName} 必须是普通对象`
    );
  }
  return value;
}

/**
 * 校验对象具有精确字段集合。
 * 纯函数: 只读取自有键，不修改对象。
 * 失败路径: 缺失或未知字段抛响应协议错误，避免静默忽略后端版本漂移。
 *
 * @param {*} value 待校验对象。
 * @param {ReadonlyArray<string>} fields 必须且只能存在的字段。
 * @param {string} fieldName 错误字段路径。
 * @returns {object} 通过校验的普通对象。
 * @throws {ProxyClientError} 字段不精确时抛 response。
 */
function assertExactFields(value, fields, fieldName) {
  // 类型: object；作用: 保存已通过普通对象边界的代理外壳节点。
  const object = assertPlainObject(value, fieldName);
  // 类型: Array<string|symbol>；作用: 读取全部自有键以发现缺失、未知、symbol 和不可枚举字段。
  const actualFields = Reflect.ownKeys(object);
  // 条件分支: 实际字段数量或成员与当前协议精确集合不一致时进入。
  // 执行内容: 抛 response，阻止协议版本漂移被客户端静默忽略。
  if (actualFields.length !== fields.length
    || actualFields.some(field => typeof field !== 'string' || !fields.includes(field))) {
    throw new ProxyClientError(
      PROXY_CLIENT_ERROR_CODE.response,
      `${fieldName} 字段不符合代理协议`
    );
  }
  return object;
}

/**
 * 校验前端代理服务地址。
 * 纯函数: 只解析地址，不访问网络或浏览器状态。
 * 成功路径: 返回无路径、无凭据、无 query/hash 的 HTTP(S) origin 文本。
 * 失败路径: 非 HTTP(S)、携带路径、凭据、query 或 hash 的地址抛 validation。
 *
 * @param {*} baseUrl 代理服务基地址。
 * @returns {string} 规范化代理服务 origin。
 * @throws {ProxyClientError} 地址不符合配置边界时抛 validation。
 */
function normalizeBaseUrl(baseUrl) {
  // 条件分支: 配置不是非空字符串时进入。
  // 执行内容: 抛 validation，不把显式空配置替换为默认代理地址。
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.validation, '代理服务地址不能为空');
  }

  // 类型: URL|undefined；作用: 保存标准 URL 解析结果，供 origin 边界逐项校验。
  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch (error) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.validation, '代理服务地址无效', { cause: error });
  }

  // 条件分支: 地址不是纯 HTTP(S) origin，或携带路径、凭据、查询和片段时进入。
  // 执行内容: 抛 validation，代理入口路径只能由集中配置追加。
  if (!['http:', 'https:'].includes(parsedUrl.protocol)
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.pathname !== '/'
    || parsedUrl.search
    || parsedUrl.hash) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.validation, '代理服务地址必须是无路径、无凭据的 HTTP(S) origin');
  }

  return parsedUrl.origin;
}

/**
 * 校验并规范化代理返回的上游最终地址。
 * 纯函数: 只解析字符串并返回 URL.href，不访问网络或修改响应外壳。
 * 成功路径: 返回无凭据、无片段的 HTTPS 最终地址。
 * 失败路径: 空值、非法 URL、非 HTTPS、凭据或片段抛 response。
 *
 * @param {*} responseUrl ProxyResponseEnvelope.upstream.responseUrl 候选。
 * @returns {string} 规范化后的上游最终 URL。
 * @throws {ProxyClientError} 地址不符合 SourceNetworkResponse 边界时抛 response。
 */
function normalizeResponseUrl(responseUrl) {
  // 条件分支: 最终地址不是非空字符串时进入。
  // 执行内容: 抛 response，不向 Provider 返回空定位信息。
  if (typeof responseUrl !== 'string' || !responseUrl.trim()) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理最终响应地址无效');
  }

  // 类型: URL|undefined；作用: 保存标准解析结果，供 HTTPS 和凭据边界校验。
  let parsedUrl;
  try {
    parsedUrl = new URL(responseUrl);
  } catch (error) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理最终响应地址无法解析', { cause: error });
  }

  // 条件分支: 最终地址不是 HTTPS，或包含凭据和片段时进入。
  // 执行内容: 抛 response，保持与后端目标安全策略相同的公开地址边界。
  if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password || parsedUrl.hash) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理最终响应地址不符合安全边界');
  }

  return parsedUrl.href;
}

/**
 * 规范化 ProxyClient 收到的 Shell 请求和生命周期信号。
 * 纯函数: 复用 Source Shell 唯一校验器创建隔离请求，不修改调用方输入。
 * 成功路径: 返回 sourceId、字段、容量和 signal 均有效的 SourceNetworkRequest。
 * 失败路径: 已中止信号转 aborted，其他 Shell 校验错误转 validation，不误归类为网络失败。
 *
 * @param {*} request SourceNetworkRequest 候选。
 * @param {*} signal AbortSignal 候选。
 * @returns {Readonly<object>} Shell 规范化后的隔离请求。
 * @throws {ProxyClientError} 输入或生命周期不符合客户端边界时抛出。
 */
function normalizeProxyRequest(request, signal) {
  try {
    assertAbortSignal(signal, 'proxyClient.signal');
    assertNotAborted(signal, 'proxyClient.request');
    return normalizeSourceNetworkRequest(request, request?.sourceId);
  } catch (error) {
    // 条件分支: 当前信号已经中止时进入。
    // 执行内容: 把 Shell 生命周期异常归一为 ProxyClient aborted，调用方不解析 Shell 错误类型。
    if (signal && typeof signal === 'object' && signal.aborted === true) {
      throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.aborted, '代理请求已中止', { cause: error });
    }
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.validation, '代理请求输入不符合 SourceNetworkRequest 契约', {
      cause: error
    });
  }
}

/**
 * 把 SourceNetworkRequest 映射为 ProxyRequestEnvelope。
 * 纯函数: 只创建新对象，不修改 Shell 已规范化请求。
 * 成功路径: GET 使用 none，POST 字符串使用 utf8，POST 普通对象使用 json。
 * 失败路径: POST null 或未知 body 类型抛 validation，禁止猜测第二套编码。
 *
 * @param {object} request SourceContext 传入的规范化请求。
 * @returns {Readonly<object>} 后端代理精确请求外壳。
 * @throws {ProxyClientError} 请求体和方法组合无法映射时抛 validation。
 */
function createProxyRequest(request) {
  // 类型: object|undefined；作用: 保存与 GET/POST 方法精确匹配的代理正文编码外壳。
  let body;

  // 条件分支: 当前请求是 GET 时进入。
  // 执行内容: 固定映射为 none/null，后端不会收到隐式 GET 正文。
  if (request.method === SOURCE_NETWORK_METHOD.get) {
    body = { encoding: PROXY_BODY_ENCODING.none, data: null };
  }

  // 条件分支: 当前 POST 正文是字符串时进入。
  // 执行内容: 映射为 utf8，保持 Provider 提交的文本值。
  if (typeof request.body === 'string') {
    body = { encoding: PROXY_BODY_ENCODING.utf8, data: request.body };
  }

  // 条件分支: 当前 POST 正文是已通过 Shell 隔离的普通 JSON 对象时进入。
  // 执行内容: 映射为 json，后端继续执行独立严格 JSON 校验。
  if (request.body && typeof request.body === 'object' && !Array.isArray(request.body)) {
    body = { encoding: PROXY_BODY_ENCODING.json, data: request.body };
  }

  // 条件分支: POST 正文不是字符串或普通 JSON 对象，导致没有形成编码外壳时进入。
  // 执行内容: 抛 validation，禁止空 POST 或隐式类型转换。
  if (!body) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.validation, 'POST 请求必须提供字符串或 JSON 对象 body');
  }

  return Object.freeze({
    protocolVersion: PROXY_CLIENT_CONFIG.protocolVersion,
    requestId: request.requestId,
    sourceId: request.sourceId,
    target: Object.freeze({ url: request.url, method: request.method }),
    headers: Object.freeze({ ...request.headers }),
    body: Object.freeze(body),
    responseType: request.responseType,
    timeoutMs: request.timeout,
    maxResponseBytes: request.maxResponseBytes
  });
}

/**
 * 组合后端唯一代理入口。
 * 纯函数: 只组合已校验 origin 和固定路径。
 *
 * @param {string} baseUrl 已规范化代理 origin。
 * @returns {string} POST 请求地址。
 */
function createProxyEndpoint(baseUrl) {
  return new URL(PROXY_CLIENT_CONFIG.requestPath, `${baseUrl}/`).href;
}

/**
 * 校验 fetch Response 的最小稳定形状和 HTTP 成功语义。
 * 纯函数: 只读取 ok、status 和 json 方法，不消费响应正文。
 * 失败路径: 伪造响应、非法状态或 ok 与 2xx 不一致时抛 response。
 *
 * @param {*} response fetch 返回值候选。
 * @returns {object} 已验证的 Response 原引用。
 * @throws {ProxyClientError} 响应不具备协议读取所需形状时抛 response。
 */
function assertFetchResponse(response) {
  // 条件分支: fetch 返回值缺少 Boolean ok、有效状态码或 json() 读取能力时进入。
  // 执行内容: 抛 response，禁止测试 stub 或异常传输对象绕过 HTTP 边界。
  if (!response
    || typeof response !== 'object'
    || typeof response.ok !== 'boolean'
    || !Number.isInteger(response.status)
    || response.status < 100
    || response.status > 599
    || typeof response.json !== 'function') {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理 HTTP 响应形状无效');
  }

  // 类型: boolean；作用: 按标准 2xx 区间独立计算 HTTP 成功语义，与 Response.ok 交叉核对。
  const hasSuccessStatus = response.status >= 200 && response.status < 300;
  // 条件分支: Response.ok 与实际状态区间不一致时进入。
  // 执行内容: 抛 response，不猜测应采用成功外壳还是错误外壳。
  if (response.ok !== hasSuccessStatus) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理 HTTP 状态与 ok 语义不一致');
  }

  return response;
}

/**
 * 读取 fetch 响应 JSON 正文。
 * 副作用: 消费当前 Response body；不保存响应正文或响应历史。
 * 成功路径: 返回一次解析出的 JSON 值，并在转换前检查 signal。
 * 失败路径: JSON 语法、读取或中止失败转换为 ProxyClient 错误。
 *
 * @param {object} response fetch Response 对象。
 * @param {AbortSignal} signal 当前 SourceContext 生命周期信号。
 * @returns {Promise<object>} 解析后的 JSON 对象。
 * @throws {ProxyClientError} 响应读取或 JSON 外壳不合法时抛 response/network/aborted。
 */
async function parseJsonResponse(response, signal) {
  assertFetchResponse(response);
  try {
    // 类型: unknown；作用: 保存本次 Response.json() 生成的隔离代理外壳候选。
    const payload = await response.json();
    assertNotAborted(signal, 'proxyClient.response');
    return payload;
  } catch (error) {
    // 条件分支: 读取或读取后复查时当前生命周期已经中止时进入。
    // 执行内容: 抛 aborted，禁止采用中止后才完成的响应正文。
    if (signal.aborted) {
      throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.aborted, '代理响应处理已中止', { cause: error });
    }
    // 条件分支: 已是客户端稳定错误时进入。
    // 执行内容: 原样传播，保留 response 或 aborted 分类。
    if (error instanceof ProxyClientError) {
      throw error;
    }
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理响应不是合法 JSON', { cause: error });
  }
}

/**
 * 把有序响应头数组转换为 SourceNetworkResponse.headers。
 * 纯函数: 创建新的普通对象；重复名称按公共协议使用换行连接。
 * 失败路径: 头条目字段、名称或值非法时抛 response。
 *
 * @param {Array<object>} headers ProxyResponseEnvelope.upstream.headers。
 * @returns {Readonly<Record<string,string>>} 小写响应头对象。
 * @throws {ProxyClientError} 响应头数组或条目不符合契约时抛 response。
 */
function createResponseHeaders(headers) {
  // 条件分支: 上游响应头不是公共协议规定的有序数组时进入。
  // 执行内容: 抛 response，不接受合并对象等第二种传输格式。
  if (!Array.isArray(headers)) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理响应 headers 必须是数组');
  }

  // 类型: Record<string,string>；作用: 使用无原型对象收集小写头名并按顺序合并重复值。
  const normalizedHeaders = Object.create(null);
  // 循环类型: headers.entries()；终止条件: 全部有序响应头条目完成校验和合并。
  // 循环作用: 保留同名条目顺序，并避免动态头名写入对象原型。
  for (const [index, header] of headers.entries()) {
    assertExactFields(header, PROXY_HEADER_FIELDS, `ProxyResponseEnvelope.upstream.headers[${index}]`);
    // 条件分支: 头名称为空或名称/值不是字符串时进入。
    // 执行内容: 抛 response，Provider 只接收稳定 Record<string,string>。
    if (typeof header.name !== 'string' || !header.name.trim()
      || typeof header.value !== 'string') {
      throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理响应头条目无效');
    }
    // 类型: string；作用: 统一头名称大小写，确保重复头命中同一合并槽位。
    const name = header.name.trim().toLowerCase();
    normalizedHeaders[name] = Object.hasOwn(normalizedHeaders, name)
      ? `${normalizedHeaders[name]}\n${header.value}`
      : header.value;
  }

  return Object.freeze({ ...normalizedHeaders });
}

/**
 * 把代理 base64 body 还原为独立 ArrayBuffer。
 * 纯函数: 创建新的 Uint8Array 和 ArrayBuffer，不保存二进制引用。
 * 失败路径: 非字符串、非法 base64 或运行时解码失败抛 response。
 *
 * @param {*} value ProxyResponseEnvelope.body.data。
 * @returns {ArrayBuffer} 隔离二进制响应。
 * @throws {ProxyClientError} 编码内容不合法时抛 response。
 */
function decodeBase64Body(value) {
  // 条件分支: 正文不是四字符对齐的标准 base64 候选时进入。
  // 执行内容: 抛 response，不把有损或模糊编码交给 Provider。
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
    || value.length % 4 !== 0) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理 base64 响应无效');
  }

  try {
    // 类型: string；作用: 保存浏览器标准 atob 解码后的二进制字符串。
    const decoded = globalThis.atob(value);
    // 类型: Uint8Array；作用: 为每个解码字节创建独立缓冲区，避免持有代理外壳文本引用。
    const bytes = new Uint8Array(decoded.length);
    // 循环类型: 索引递增；初始值: 0；终止条件: 全部 decoded 字符转换完成。
    // 循环作用: 把每个二进制字符码写入独立 Uint8Array。
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }
    return bytes.buffer;
  } catch (error) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理 base64 响应无法解码', { cause: error });
  }
}

/**
 * 校验并转换 ProxyResponseEnvelope。
 * 纯函数: 只读取代理外壳并创建新的 SourceNetworkResponse，不把代理外壳交给 Provider。
 * 成功路径: responseType 与 body.encoding 对齐，状态、头、最终 URL 和 requestId 一并返回。
 * 失败路径: 协议版本、requestId、状态、元信息或编码不匹配时抛 response。
 *
 * @param {*} envelope 后端成功响应候选。
 * @param {object} request 已规范化的原始网络请求。
 * @returns {Readonly<object>} SourceNetworkResponse。
 * @throws {ProxyClientError} 成功外壳不符合公共协议时抛 response。
 */
function createSourceNetworkResponse(envelope, request) {
  assertExactFields(envelope, PROXY_RESPONSE_FIELDS, 'ProxyResponseEnvelope');
  // 条件分支: 协议版本不是 1.0.0 或响应 requestId 不属于当前调用时进入。
  // 执行内容: 抛 response，禁止跨请求采用或隐式兼容未知版本。
  if (envelope.protocolVersion !== PROXY_CLIENT_CONFIG.protocolVersion
    || envelope.requestId !== request.requestId) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理响应版本或 requestId 不匹配');
  }

  assertExactFields(envelope.upstream, PROXY_UPSTREAM_FIELDS, 'ProxyResponseEnvelope.upstream');
  assertExactFields(envelope.body, PROXY_RESPONSE_BODY_FIELDS, 'ProxyResponseEnvelope.body');
  assertExactFields(envelope.meta, PROXY_META_FIELDS, 'ProxyResponseEnvelope.meta');

  // 条件分支: 上游状态、最终 URL 或容量元信息缺少协议规定的基础类型和范围时进入。
  // 执行内容: 抛 response，不向 Provider 返回半合法 SourceNetworkResponse。
  if (!Number.isInteger(envelope.upstream.status)
    || envelope.upstream.status < 100
    || envelope.upstream.status > 599
    || typeof envelope.upstream.statusText !== 'string'
    || !Number.isInteger(envelope.meta.redirectCount)
    || envelope.meta.redirectCount < 0
    || !Number.isInteger(envelope.meta.receivedBytes)
    || envelope.meta.receivedBytes < 0
    || envelope.meta.receivedBytes > request.maxResponseBytes) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理响应状态或元信息无效');
  }

  // 类型: Record<string,string>；作用: 建立 SourceNetwork responseType 到唯一代理正文编码的映射。
  const bodyEncodingByResponseType = {
    [SOURCE_NETWORK_RESPONSE_TYPE.json]: PROXY_BODY_ENCODING.json,
    [SOURCE_NETWORK_RESPONSE_TYPE.text]: PROXY_BODY_ENCODING.utf8,
    [SOURCE_NETWORK_RESPONSE_TYPE.arrayBuffer]: PROXY_BODY_ENCODING.base64
  };
  // 类型: string；作用: 保存当前请求声明对应的唯一合法响应编码。
  const expectedEncoding = bodyEncodingByResponseType[request.responseType];
  // 条件分支: 后端正文编码与当前请求 responseType 不一致时进入。
  // 执行内容: 抛 response，禁止客户端猜测或执行第二套转换。
  if (envelope.body.encoding !== expectedEncoding) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理响应编码与请求 responseType 不匹配');
  }

  // 类型: unknown；作用: 保存按声明编码转换后的 SourceNetworkResponse 正文。
  const body = expectedEncoding === PROXY_BODY_ENCODING.base64
    ? decodeBase64Body(envelope.body.data)
    : envelope.body.data;

  // 条件分支: UTF-8 响应的数据不是字符串时进入。
  // 执行内容: 抛 response，不执行隐式字符串化。
  if (expectedEncoding === PROXY_BODY_ENCODING.utf8 && typeof body !== 'string') {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理文本响应 body 无效');
  }

  // 条件分支: JSON 响应缺失数据或出现 JSON 无法表达的函数时进入。
  // 执行内容: 抛 response，Provider 不接收非法 JSON 值。
  if (expectedEncoding === PROXY_BODY_ENCODING.json
    && body !== null
    && !['object', 'string'].includes(typeof body)) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理 JSON 响应 body 无效');
  }

  return Object.freeze({
    requestId: envelope.requestId,
    status: envelope.upstream.status,
    statusText: envelope.upstream.statusText,
    headers: createResponseHeaders(envelope.upstream.headers),
    body,
    responseUrl: normalizeResponseUrl(envelope.upstream.responseUrl)
  });
}

/**
 * 校验并转换 ProxyErrorEnvelope。
 * 纯函数: 只创建带后端稳定错误码的 ProxyClientError，不保存完整 error details。
 * 失败路径: 错误外壳本身不合法时由调用方改为 response 错误。
 *
 * @param {*} envelope 后端错误响应候选。
 * @param {object} request 原始规范化请求。
 * @returns {never} 总是抛出 ProxyClientError。
 * @throws {ProxyClientError} 后端稳定错误或响应外壳错误。
 */
function createProxyError(envelope, request) {
  assertExactFields(envelope, PROXY_ERROR_ENVELOPE_FIELDS, 'ProxyErrorEnvelope');
  assertExactFields(envelope.error, PROXY_ERROR_FIELDS, 'ProxyErrorEnvelope.error');
  assertPlainObject(envelope.error.details, 'ProxyErrorEnvelope.error.details');
  // 条件分支: 版本、请求关联、稳定错误码或错误字段类型不符合公共协议时进入。
  // 执行内容: 抛 response，不按未知错误码或错误文案决定程序分支。
  if (envelope.protocolVersion !== PROXY_CLIENT_CONFIG.protocolVersion
    || (envelope.requestId !== '' && envelope.requestId !== request.requestId)
    || typeof envelope.error.code !== 'string'
    || !Object.values(PROXY_PROTOCOL_ERROR_CODE).includes(envelope.error.code)
    || typeof envelope.error.message !== 'string'
    || typeof envelope.error.retryable !== 'boolean'
    || PROXY_PROTOCOL_ERROR_RETRYABLE[envelope.error.code] !== envelope.error.retryable) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.response, '代理错误外壳无效');
  }

  throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.proxy, '代理请求失败', {
    proxyCode: envelope.error.code,
    retryable: envelope.error.retryable,
    details: {}
  });
}

/**
 * 把 fetch 失败转换为稳定前端错误。
 * 纯函数: 只读取 signal 和错误，不访问响应或保存状态。
 *
 * @param {*} error fetch 原始异常。
 * @param {AbortSignal} signal 当前生命周期信号。
 * @returns {ProxyClientError} 统一错误对象。
 */
function normalizeFetchError(error, signal) {
  // 条件分支: 生命周期已中止或 fetch 使用标准 AbortError 拒绝时进入。
  // 执行内容: 返回 aborted；其他传输异常才归类为 network。
  if (signal.aborted || error?.name === 'AbortError') {
    return new ProxyClientError(PROXY_CLIENT_ERROR_CODE.aborted, '代理请求已中止', { cause: error });
  }
  return new ProxyClientError(PROXY_CLIENT_ERROR_CODE.network, '代理请求无法完成', { cause: error });
}

/**
 * 创建前端代理客户端。
 * 状态所有权: 客户端只保存规范化 endpoint 和注入的 fetch 函数，不保存 Cookie、Token、响应或请求历史。
 * 副作用: request 调用时向后端唯一入口发送一次 JSON 请求；release/取消由 AbortSignal 控制。
 * 成功路径: 返回 SourceNetworkResponse，Provider 不接触 ProxyResponseEnvelope。
 * 失败路径: 输入、fetch、响应外壳和后端稳定错误分别抛 ProxyClientError；不会自动调用 MockNetworkAdapter。
 *
 * @param {object} [options={}] 创建选项。
 * @param {string} [options.baseUrl] 代理服务 origin，缺省读取集中环境配置。
 * @param {Function} [options.fetchImpl] 可注入 fetch 实现，生产使用全局 fetch，测试使用隔离 stub。
 * @returns {Readonly<{ request: Function }>} 只含 request 的冻结 NetworkAdapter。
 * @throws {ProxyClientError} 配置非法时同步抛 validation。
 */
export function createProxyClient(options = {}) {
  // 条件分支: 工厂选项不是普通非数组对象时进入。
  // 执行内容: 抛 validation，禁止布尔值、数组或 null 触发隐式配置。
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.validation, 'ProxyClient options 必须是对象');
  }
  // 类型: Array<string|symbol>；作用: 读取全部自有配置键，拒绝 symbol 和未登记选项。
  const optionKeys = Reflect.ownKeys(options);
  // 条件分支: 配置包含 baseUrl/fetchImpl 之外的任意字段时进入。
  // 执行内容: 抛 validation，避免未实现配置造成虚假生效认知。
  if (optionKeys.some(key => key !== 'baseUrl' && key !== 'fetchImpl')) {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.validation, 'ProxyClient options 包含未知字段');
  }

  // 类型: unknown；作用: 区分“未提供”与“显式空值”，只对前者采用集中默认地址。
  const configuredBaseUrl = options.baseUrl === undefined
    ? PROXY_CLIENT_CONFIG.defaultBaseUrl
    : options.baseUrl;
  // 类型: string；作用: 保存已通过 origin 边界校验的代理服务地址。
  const baseUrl = normalizeBaseUrl(configuredBaseUrl);
  // 类型: string；作用: 保存集中路径组合出的唯一后端代理入口。
  const endpoint = createProxyEndpoint(baseUrl);
  // 类型: Function|undefined；作用: 保存显式注入或全局绑定的 fetch 传输端口。
  const fetchImpl = options.fetchImpl === undefined
    ? globalThis.fetch?.bind(globalThis)
    : options.fetchImpl;
  // 条件分支: 显式注入值和全局环境都不能提供 fetch 函数时进入。
  // 执行内容: 抛 validation，不建立无效客户端或静默选择 Mock。
  if (typeof fetchImpl !== 'function') {
    throw new ProxyClientError(PROXY_CLIENT_ERROR_CODE.validation, 'ProxyClient 需要可用 fetch 实现');
  }

  return Object.freeze({
    /**
     * 发送一条 SourceNetworkRequest 到后端代理并转换响应。
     * 调用方: SourceContext.network 门面；Provider 不直接调用该方法的底层 fetch。
     * 副作用: 每次调用发送一次 POST；不设置 Cookie jar，不重试，不保存响应。
     * 成功路径: 后端成功外壳通过精确校验后返回 SourceNetworkResponse。
     * 失败路径: signal 中止、fetch 失败、错误外壳或成功外壳非法时抛 ProxyClientError。
     *
     * @param {object} request SourceContext 已规范化的 SourceNetworkRequest 候选。
     * @param {AbortSignal} signal 当前 Host 生命周期信号。
     * @returns {Promise<Readonly<object>>} 标准 SourceNetworkResponse。
     * @throws {ProxyClientError} 请求、网络、响应或代理错误。
     */
    async request(request, signal) {
      // 类型: Readonly<object>；作用: 保存 Shell 校验并隔离后的当前网络请求。
      const normalizedRequest = normalizeProxyRequest(request, signal);
      // 类型: Readonly<object>；作用: 保存只发送一次的公共协议请求外壳。
      const proxyRequest = createProxyRequest(normalizedRequest);
      // 类型: Response|undefined；作用: 保存当前 fetch 返回值，读取后不跨调用持有。
      let response;

      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            accept: PROXY_CLIENT_CONFIG.accept,
            'content-type': PROXY_CLIENT_CONFIG.contentType
          },
          body: JSON.stringify(proxyRequest),
          signal,
          credentials: 'omit'
        });
      } catch (error) {
        throw normalizeFetchError(error, signal);
      }

      // 类型: unknown；作用: 保存已读取且经过中止复查的代理响应外壳候选。
      const payload = await parseJsonResponse(response, signal);
      // 条件分支: HTTP 状态属于 2xx 且 ok 已通过交叉校验时进入。
      // 执行内容: 按成功外壳转换为 SourceNetworkResponse；其他状态只接受 ProxyErrorEnvelope。
      if (response.ok) {
        return createSourceNetworkResponse(payload, normalizedRequest);
      }

      return createProxyError(payload, normalizedRequest);
    }
  });
}
