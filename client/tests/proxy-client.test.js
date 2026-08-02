/*
  proxy-client.test.js 模块说明

  - 文件职责:
      使用隔离 fetch stub 验证 ProxyClient 2.0 原始字节请求映射、重复响应头、错误外壳和 AbortSignal 边界。
      测试不启动服务、不访问真实网络、不调用 MockNetworkAdapter，也不允许 ProxyClient 失败后静默回退。

  - 导入库及文件汇总(4 条，内置 2 条，第三方 0 条，自定义 2 条):
      node:assert/strict#assert: 核对请求外壳、响应对象和稳定错误字段。
      node:test#test: 注册彼此隔离的 ProxyClient 契约测试。
      ../src/runtime/source-network/proxyClient.js#createProxyClient: 被测前端代理客户端。
      ../src/runtime/source-network/proxyClientErrors.js#PROXY_CLIENT_ERROR_CODE、ProxyClientError: 核对稳定错误分类和后端错误码。

  - 模块级常量:
      SOURCE_ID / BASE_URL / REQUEST: 测试使用的标准请求输入。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createResponse(body, options): 创建最小 Response stub。
      createJsonResponse(body, options): 创建 JSON Response stub。
      createRequest(overrides): 创建隔离 SourceNetworkRequest。
      createProxyErrorEnvelope(overrides): 创建后端错误外壳候选。
      createStaticFetch(response): 创建返回固定响应的 fetch stub。
      getProxyRequestBody(request): 读取已捕获代理请求的 body。
      createClientWithUnknownOption(): 触发未知客户端配置校验。
      createClientWithEmptyBaseUrl(): 触发空代理地址校验。
      throwUnexpectedFetch(): 标记中止前意外执行的 fetch。

  - 模块级类:
      无

  - 对外导出:
      无；由 node --test 直接执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert Node 严格断言集合。
// 文件作用: 核对请求外壳、响应转换和稳定错误字段。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册彼此隔离且不访问真实网络的 ProxyClient 契约测试。
import test from 'node:test';

// 导入来源: ../src/runtime/source-network/proxyClient.js。
// 导入内容: createProxyClient 前端代理客户端工厂。
// 文件作用: 创建注入 fetch stub 的被测 NetworkAdapter。
import { createProxyClient } from '../src/runtime/source-network/proxyClient.js';

import {
  // 导入来源: ../src/runtime/source-network/proxyClientErrors.js。
  // 导入内容: PROXY_CLIENT_ERROR_CODE 稳定前端错误分类。
  // 文件作用: 断言 validation、aborted、response 和 proxy 失败边界。
  PROXY_CLIENT_ERROR_CODE,

  // 导入来源: ../src/runtime/source-network/proxyClientErrors.js。
  // 导入内容: ProxyClientError 统一错误类。
  // 文件作用: 断言后端稳定错误转换后没有泄漏原始外壳。
  ProxyClientError
} from '../src/runtime/source-network/proxyClientErrors.js';

// 类型: string；来源: 测试请求身份；作用: 验证 requestId/sourceId 在前端和代理外壳之间保持一致。
const SOURCE_ID = 'proxy-client-test-source';
// 类型: string；来源: 测试配置；作用: 注入隔离代理地址，不依赖环境变量或真实服务。
const BASE_URL = 'http://127.0.0.1:3000';
// 类型: object；来源: SourceNetworkRequest 契约；作用: 提供默认 GET 文本请求，测试按用例覆盖差异字段。
const REQUEST = Object.freeze({
  sourceId: SOURCE_ID,
  requestId: 'proxy-client-request-001',
  url: 'https://example.com/catalog',
  method: 'GET',
  headers: Object.freeze([{ name: 'accept', value: 'text/plain' }]),
  body: Object.freeze({ encoding: 'none', data: null }),
  timeout: 5000,
  maxResponseBytes: 4096
});

/**
 * 创建最小 fetch Response stub。
 * 纯函数: 创建只持有当前 body/options 的对象，不访问网络或修改输入。
 *
 * @param {*} body json() 返回值。
 * @param {object} [options={}] status、ok 和解析失败配置。
 * @returns {object} ProxyClient 可消费的 Response 形状。
 */
function createResponse(body, options = {}) {
  /**
   * 返回当前 Response stub 的 JSON 正文。
   * 纯函数: 返回闭包 body 原值；rejectJson 用例抛确定性解析错误。
   * 成功路径: 返回当前响应构造时捕获的 body。
   * 失败路径: rejectJson 为 true 时抛确定性 Error。
   *
   * @returns {Promise<*>} 当前响应正文。
   * @throws {Error} rejectJson 为 true 时模拟 JSON 解析失败。
   */
  async function readJsonBody() {
    // 条件分支: 当前用例要求模拟响应 JSON 读取失败时进入。
    // 执行内容: 抛确定性错误，供 ProxyClient 响应解析边界转换。
    if (options.rejectJson) {
      throw new Error('invalid json');
    }
    return body;
  }

  return Object.freeze({
    ok: options.ok !== false,
    status: options.status ?? 200,
    json: readJsonBody
  });
}

/**
 * 创建成功代理响应。
 * 纯函数: 返回公共协议 2.0.0 的确定性原始字节外壳，不修改 data/options。
 *
 * @param {string} dataInput 待包装的文本或已编码 base64。
 * @param {object} [options={}] headers、状态、字节数和 rawBase64 覆盖。
 * @returns {object} ProxyResponseEnvelope。
 */
function createJsonResponse(dataInput, options = {}) {
  // 类型: string；作用: 把测试文本或已编码二进制统一放入 base64 原始运输外壳。
  const data = options.rawBase64 === true ? dataInput : btoa(dataInput);
  // 类型: number；作用: 保存 base64 解码后的真实字节数，供 ProxyClient meta 校验。
  const receivedBytes = options.receivedBytes ?? (options.rawBase64 === true
    ? atob(data).length
    : new TextEncoder().encode(dataInput).byteLength);
  return {
    protocolVersion: '2.0.0',
    requestId: options.requestId ?? REQUEST.requestId,
    upstream: {
      status: options.upstreamStatus ?? 200,
      statusText: options.statusText ?? 'OK',
      responseUrl: options.responseUrl ?? REQUEST.url,
      headers: options.headers ?? [{ name: 'content-type', value: 'text/plain' }]
    },
    body: { encoding: 'base64', data },
    meta: { redirectCount: options.redirectCount ?? 0, receivedBytes }
  };
}

/**
 * 创建标准请求副本。
 * 纯函数: 只覆盖显式字段并返回新对象，不保存跨用例状态。
 *
 * @param {object} [overrides={}] 请求字段覆盖。
 * @returns {object} SourceNetworkRequest。
 */
function createRequest(overrides = {}) {
  return { ...REQUEST, ...overrides };
}

/**
 * 创建后端代理错误外壳候选。
 * 纯函数: 返回新外壳和新 error 对象，只覆盖当前用例指定字段。
 *
 * @param {object} [overrides={}] error 字段覆盖。
 * @returns {object} ProxyErrorEnvelope 候选。
 */
function createProxyErrorEnvelope(overrides = {}) {
  return {
    protocolVersion: '2.0.0',
    requestId: REQUEST.requestId,
    error: {
      code: 'PROXY_INTERNAL_ERROR',
      message: '代理请求失败',
      retryable: false,
      details: {},
      ...overrides
    }
  };
}

/**
 * 创建始终返回固定 Response stub 的 fetch 函数。
 * 纯函数: 工厂只捕获 response；返回函数不访问网络或保存调用历史。
 *
 * @param {object} response 固定 Response stub。
 * @returns {Function} 可注入 ProxyClient 的异步 fetch stub。
 */
function createStaticFetch(response) {
  /**
   * 返回工厂捕获的固定响应。
   * 纯函数: 不读取请求参数、不访问网络、不修改 response。
   * 成功路径: 返回当前工厂捕获的 Response stub。
   * 失败路径: 无；固定响应由外层测试预先创建。
   *
   * @returns {Promise<object>} 固定 Response stub。
   */
  async function fetchStub() {
    return response;
  }

  return fetchStub;
}

/**
 * 读取已捕获代理请求的正文外壳。
 * 纯函数: 只读取 request.body，不修改数组元素。
 *
 * @param {object} request 已捕获 ProxyRequestEnvelope。
 * @returns {object} 当前请求 body 外壳。
 */
function getProxyRequestBody(request) {
  return request.body;
}

/**
 * 使用未知配置字段创建客户端。
 * 纯函数: 只触发同步配置校验，不访问网络。
 *
 * @returns {Readonly<object>} 不应成功返回的客户端。
 * @throws {ProxyClientError} 未知字段触发 validation。
 */
function createClientWithUnknownOption() {
  return createProxyClient({ unknown: true });
}

/**
 * 使用显式空代理地址创建客户端。
 * 纯函数: 只触发同步地址校验，不采用默认地址或访问网络。
 *
 * @returns {Readonly<object>} 不应成功返回的客户端。
 * @throws {ProxyClientError} 空地址触发 validation。
 */
function createClientWithEmptyBaseUrl() {
  return createProxyClient({ baseUrl: '' });
}

/**
 * 标记生命周期中止前意外执行的 fetch。
 * 副作用: 总是抛错以立即暴露本不应发生的传输调用。
 * 成功路径: 无；该函数不应被 ProxyClient 调用。
 * 失败路径: 一旦调用立即抛确定性 Error。
 *
 * @returns {Promise<never>} 不会成功返回。
 * @throws {Error} 每次调用都抛出确定性测试错误。
 */
async function throwUnexpectedFetch() {
  throw new Error('fetch must not run');
}

// 测试目的: GET 请求必须精确映射协议字段，且传输明确省略浏览器凭据。
test('ProxyClient 将 GET 请求精确映射为代理请求外壳', async () => {
  // 类型: object|undefined；作用: 保存 fetch stub 收到的地址、选项和请求外壳。
  let captured;
  /**
   * 捕获 GET 用例发送的唯一代理请求并返回成功外壳。
   * 副作用: 写入当前测试局部 captured；不访问真实网络。
   * 成功路径: 保存请求并返回与标准 requestId 对齐的 Response stub。
   * 失败路径: 请求 body 不是合法 JSON 时由 JSON.parse 抛错并使测试失败。
   *
   * @param {string} url ProxyClient 请求地址。
   * @param {object} options fetch 请求选项。
   * @returns {Promise<object>} 成功 Response stub。
   */
  async function captureGetRequest(url, options) {
    captured = { url, options, body: JSON.parse(options.body) };
    return createResponse(createJsonResponse('done'));
  }

  // 类型: Readonly<object>；作用: 注入捕获函数创建当前 GET 用例客户端。
  const client = createProxyClient({
    baseUrl: BASE_URL,
    fetchImpl: captureGetRequest
  });

  // 类型: Readonly<object>；作用: 保存成功转换后的 SourceNetworkResponse。
  const result = await client.request(REQUEST, new AbortController().signal);

  assert.equal(captured.url, `${BASE_URL}/api/proxy/v2/request`);
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers.accept, 'application/json');
  assert.equal(captured.options.headers['content-type'], 'application/json');
  assert.equal(captured.options.credentials, 'omit');
  assert.deepEqual(captured.body, {
    protocolVersion: '2.0.0',
    requestId: REQUEST.requestId,
    sourceId: SOURCE_ID,
    target: { url: REQUEST.url, method: 'GET' },
    headers: [{ name: 'accept', value: 'text/plain' }],
    body: { encoding: 'none', data: null },
    timeoutMs: 5000,
    maxResponseBytes: 4096
  });
  assert.deepEqual(result, {
    requestId: REQUEST.requestId,
    status: 200,
    statusText: 'OK',
    headers: [{ name: 'content-type', value: 'text/plain' }],
    body: result.body,
    responseUrl: REQUEST.url
  });
  assert.equal(new TextDecoder().decode(result.body), 'done');
});

// 测试目的: POST 的 utf8 与 base64 原始正文必须原样映射，且每次 requestId 独立回填。
test('ProxyClient 原样映射 POST UTF-8 和 base64 body', async () => {
  // 类型: Array<object>；作用: 按调用顺序保存两个 ProxyRequestEnvelope。
  const captured = [];
  /**
   * 捕获 POST 请求并按其 requestId 返回对应成功外壳。
   * 副作用: 向当前测试局部 captured 追加一次请求；不访问真实网络。
   * 成功路径: 返回与当前请求 requestId 对齐的文本 Response stub。
   * 失败路径: 请求 body 不是合法 JSON 时由 JSON.parse 抛错并使测试失败。
   *
   * @param {string} _url 当前用例不使用的代理地址。
   * @param {object} options fetch 请求选项。
   * @returns {Promise<object>} 与请求 id 对齐的成功 Response stub。
   */
  async function capturePostRequest(_url, options) {
    // 类型: object；作用: 保存当前 JSON 文本解析出的 ProxyRequestEnvelope。
    const request = JSON.parse(options.body);
    captured.push(request);
    return createResponse(createJsonResponse('{}', { requestId: request.requestId }));
  }

  // 类型: Readonly<object>；作用: 注入 POST 捕获函数创建当前映射用例客户端。
  const client = createProxyClient({
    baseUrl: BASE_URL,
    fetchImpl: capturePostRequest
  });

  await client.request(createRequest({
    requestId: 'proxy-client-base64-001',
    method: 'POST',
    body: { encoding: 'base64', data: 'AQID' }
  }), new AbortController().signal);
  await client.request(createRequest({
    requestId: 'proxy-client-text-001',
    method: 'POST',
    body: { encoding: 'utf8', data: 'keyword=test' }
  }), new AbortController().signal);

  assert.deepEqual(captured.map(getProxyRequestBody), [
    { encoding: 'base64', data: 'AQID' },
    { encoding: 'utf8', data: 'keyword=test' }
  ]);
});

// 测试目的: 二进制响应必须还原独立 ArrayBuffer，重复响应头必须保留独立条目和顺序。
test('ProxyClient 将 base64 响应转换为 ArrayBuffer 并保留重复响应头', async () => {
  // 类型: object；作用: 保存包含 base64 正文和重复响应头的成功 Response stub。
  const response = createResponse(createJsonResponse('AQID', {
    rawBase64: true,
    headers: [
      { name: 'set-cookie', value: 'a=1' },
      { name: 'set-cookie', value: 'b=2' }
    ]
  }));
  // 类型: Readonly<object>；作用: 注入固定响应创建二进制转换用例客户端。
  const client = createProxyClient({
    baseUrl: BASE_URL,
    fetchImpl: createStaticFetch(response)
  });

  // 类型: Readonly<object>；作用: 保存 arrayBuffer 响应转换结果。
  const result = await client.request(createRequest(), new AbortController().signal);

  assert.deepEqual([...new Uint8Array(result.body)], [1, 2, 3]);
  assert.deepEqual(result.headers, [
    { name: 'set-cookie', value: 'a=1' },
    { name: 'set-cookie', value: 'b=2' }
  ]);
});

// 测试目的: 合法 ProxyErrorEnvelope 必须转换为保留稳定后端码的 ProxyClientError。
test('ProxyClient 将后端稳定错误转换为 ProxyClientError', async () => {
  // 类型: object；作用: 保存目标禁止错误的非 2xx Response stub。
  const response = createResponse(createProxyErrorEnvelope({
    code: 'PROXY_TARGET_FORBIDDEN',
    message: '目标地址不允许访问'
  }), { ok: false, status: 403 });
  // 类型: Readonly<object>；作用: 注入合法后端错误创建转换用例客户端。
  const client = createProxyClient({
    baseUrl: BASE_URL,
    fetchImpl: createStaticFetch(response)
  });

  await assert.rejects(
    client.request(REQUEST, new AbortController().signal),
    {
      name: ProxyClientError.name,
      code: PROXY_CLIENT_ERROR_CODE.proxy,
      proxyCode: 'PROXY_TARGET_FORBIDDEN',
      retryable: false
    }
  );
});

// 测试目的: 未冻结后端错误码和非对象 details 都属于协议响应错误，不能进入 proxy 分支。
test('ProxyClient 拒绝后端未知错误码和非对象 details', async () => {
  // 循环类型: Array 迭代；终止条件: 未知错误码和非法 details 两个外壳均完成拒绝断言。
  // 循环作用: 证明错误语义和错误对象结构共享同一失败关闭边界。
  for (const errorEnvelope of [
    createProxyErrorEnvelope({ code: 'PROXY_UNKNOWN_ERROR' }),
    createProxyErrorEnvelope({ details: [] }),
    createProxyErrorEnvelope({ code: 'PROXY_RATE_LIMITED', retryable: false })
  ]) {
    // 类型: object；作用: 保存当前非法错误外壳对应的非 2xx Response stub。
    const response = createResponse(errorEnvelope, { ok: false, status: 500 });
    // 类型: Readonly<object>；作用: 为当前非法外壳创建隔离客户端。
    const client = createProxyClient({
      baseUrl: BASE_URL,
      fetchImpl: createStaticFetch(response)
    });
    await assert.rejects(
      client.request(REQUEST, new AbortController().signal),
      { code: PROXY_CLIENT_ERROR_CODE.response }
    );
  }
});

// 测试目的: 非 HTTPS 最终地址、超出调用方容量和错误字节元信息必须拒绝采用。
test('ProxyClient 拒绝非法成功响应地址、容量和字节元信息', async () => {
  // 类型: Array<object>；作用: 组合每个非法成功外壳及其对应 SourceNetworkRequest。
  const cases = [
    {
      request: REQUEST,
      envelope: createJsonResponse('done', { responseUrl: 'http://example.com/catalog' })
    },
    {
      request: REQUEST,
      envelope: createJsonResponse('done', { receivedBytes: REQUEST.maxResponseBytes + 1 })
    },
    { request: REQUEST, envelope: createJsonResponse('done', { receivedBytes: 3 }) }
  ];

  // 循环类型: Array 迭代；终止条件: 地址、容量和 JSON 类型三个失败向量全部完成。
  // 循环作用: 证明成功外壳各字段都在返回 Provider 前执行失败关闭校验。
  for (const testCase of cases) {
    // 类型: object；作用: 保存当前非法成功外壳对应的 2xx Response stub。
    const response = createResponse(testCase.envelope);
    // 类型: Readonly<object>；作用: 为当前失败向量创建隔离客户端。
    const client = createProxyClient({
      baseUrl: BASE_URL,
      fetchImpl: createStaticFetch(response)
    });
    await assert.rejects(
      client.request(testCase.request, new AbortController().signal),
      { code: PROXY_CLIENT_ERROR_CODE.response }
    );
  }
});

// 测试目的: 成功外壳未知字段、错位 requestId 和已中止 signal 必须在 fetch/采用边界失败关闭。
test('ProxyClient 拒绝未知响应字段、requestId 错位和中止请求', async () => {
  // 类型: object；作用: 保存带未知顶层字段的成功 Response stub。
  const invalidResponse = createResponse({
    ...createJsonResponse('done'),
    unknown: true
  });
  // 类型: Readonly<object>；作用: 创建未知字段拒绝用例客户端。
  const invalidClient = createProxyClient({
    baseUrl: BASE_URL,
    fetchImpl: createStaticFetch(invalidResponse)
  });
  await assert.rejects(
    invalidClient.request(REQUEST, new AbortController().signal),
    { code: PROXY_CLIENT_ERROR_CODE.response }
  );

  // 类型: object；作用: 保存 requestId 不属于当前调用的成功 Response stub。
  const mismatchResponse = createResponse({
    ...createJsonResponse('done'),
    requestId: 'other-request'
  });
  // 类型: Readonly<object>；作用: 创建跨请求响应拒绝用例客户端。
  const mismatchClient = createProxyClient({
    baseUrl: BASE_URL,
    fetchImpl: createStaticFetch(mismatchResponse)
  });
  await assert.rejects(
    mismatchClient.request(REQUEST, new AbortController().signal),
    { code: PROXY_CLIENT_ERROR_CODE.response }
  );

  // 类型: AbortController；作用: 在调用前终止生命周期，证明 fetch 不会运行。
  const controller = new AbortController();
  controller.abort();
  // 类型: Readonly<object>；作用: 注入总是抛错的 fetch，任何真实调用都会让测试失败。
  const abortedClient = createProxyClient({
    baseUrl: BASE_URL,
    fetchImpl: throwUnexpectedFetch
  });
  await assert.rejects(
    abortedClient.request(REQUEST, controller.signal),
    { code: PROXY_CLIENT_ERROR_CODE.aborted }
  );
});

// 测试目的: 未知配置、空地址、POST 非运输对象和请求未知字段都必须归类为 validation。
test('ProxyClient 不接受 POST 非运输对象或代理配置未知字段', () => {
  assert.throws(
    createClientWithUnknownOption,
    { code: PROXY_CLIENT_ERROR_CODE.validation }
  );
  assert.throws(
    createClientWithEmptyBaseUrl,
    { code: PROXY_CLIENT_ERROR_CODE.validation }
  );

  // 类型: object；作用: 保存不应被非法请求实际消费的固定成功响应。
  const response = createResponse(createJsonResponse('done'));
  // 类型: Readonly<object>；作用: 创建请求输入校验用例客户端。
  const client = createProxyClient({
    baseUrl: BASE_URL,
    fetchImpl: createStaticFetch(response)
  });
  return Promise.all([
    assert.rejects(
      client.request(createRequest({ method: 'POST', body: null }), new AbortController().signal),
      { code: PROXY_CLIENT_ERROR_CODE.validation }
    ),
    assert.rejects(
      client.request({ ...REQUEST, unknown: true }, new AbortController().signal),
      { code: PROXY_CLIENT_ERROR_CODE.validation }
    )
  ]);
});
