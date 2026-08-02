/*
  proxy-http-boundary.test.js 模块说明

  - 文件职责:
      验证 Fastify 唯一业务路由、HTTP 媒体类型、网络前校验顺序和统一安全错误外壳。
      测试使用 Fastify.inject 与注入执行端口，不监听 TCP 端口、不解析 DNS，也不发起真实上游请求。

  - 导入库及文件汇总(8 条，内置 5 条，第三方 0 条，自定义 3 条):
      node:assert/strict: 核对 HTTP 状态、响应外壳和执行端口调用事实。
      node:fs#readFileSync: 读取合法请求语言无关向量。
      node:path: 从测试文件定位仓库根 contracts/v2。
      node:test#test: 注册隔离 Fastify 应用测试。
      node:url#fileURLToPath: 将模块 URL 转为文件路径。
      ../src/contracts/proxyProtocol.js: 使用冻结入口和协议版本构造期望响应。
      ../src/errors/proxyError.js#ProxyError: 注入固定执行失败以验证 HTTP 脱敏外壳。
      ../src/http/createProxyApp.js#createProxyApp: 创建待验收的 HTTP 应用边界。

  - 模块级常量:
      CONTRACT_FILE: string，合法请求向量绝对路径。
      VALID_REQUEST: object，HTTP 测试复用的 GET 请求隔离基线。
      SUCCESS_RESPONSE: Readonly<object>，注入执行端口返回的最小合法成功外壳。
      JSON_HEADERS: Readonly<object>，固定 Content-Type 和 Accept 请求头。
      LOCAL_FRONTEND_ORIGINS: ReadonlyArray<string>，本机 IPv4、IPv6 和 localhost 浏览器来源。
      DISALLOWED_ORIGIN: string，未登记的浏览器来源。

  - 模块级变量:
      无

  - 模块级辅助函数:
      loadValidRequest(): 读取第一个合法请求向量并返回隔离副本。

  - 模块级类:
      无

  - 对外导出:
      无；由 node --test 直接执行。
*/

// 导入来源: node:assert/strict；导入内容: assert 默认对象；文件作用: 验证 HTTP 状态、JSON 外壳和执行调用。
import assert from 'node:assert/strict';
// 导入来源: node:fs；导入内容: readFileSync；文件作用: 读取共享合法请求向量。
import { readFileSync } from 'node:fs';
// 导入来源: node:path；导入内容: dirname、resolve；文件作用: 从 server/tests 定位仓库根契约文件。
import { dirname, resolve } from 'node:path';
// 导入来源: node:test；导入内容: test；文件作用: 注册异步 Fastify.inject 用例并管理关闭清理。
import test from 'node:test';
// 导入来源: node:url；导入内容: fileURLToPath；文件作用: 将 import.meta.url 转换为测试目录路径。
import { fileURLToPath } from 'node:url';
// 导入来源: ../src/contracts/proxyProtocol.js；导入内容: PROXY_PROTOCOL_VERSION、PROXY_REQUEST_ROUTE；文件作用: 避免测试复制入口和版本字符串。
import { PROXY_PROTOCOL_VERSION, PROXY_REQUEST_ROUTE } from '../src/contracts/proxyProtocol.js';
// 导入来源: ../src/errors/proxyError.js；导入内容: ProxyError；文件作用: 构造不执行网络的固定执行层失败。
import { ProxyError } from '../src/errors/proxyError.js';
// 导入来源: ../src/http/createProxyApp.js；导入内容: createProxyApp；文件作用: 创建未监听网络端口的待验收应用。
import { createProxyApp } from '../src/http/createProxyApp.js';

// 类型: string；来源: 当前测试目录向上两级；作用: 定位共享合法请求向量。
const CONTRACT_FILE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'contracts', 'v2', 'proxy-request.valid.json');

/**
 * 读取第一个合法请求向量。
 * 调用方: 模块基线初始化。
 * 副作用: 同步读取 contracts/v2 JSON 文件；不修改文件。
 * 失败路径: 文件缺失、JSON 非法或 cases 为空时抛出异常并阻断测试加载。
 *
 * @returns {object} 与文件解析对象隔离的合法 GET 请求。
 */
function loadValidRequest() {
  // 类型: object；来源: 语言无关合法向量；作用: 保证 HTTP 测试和纯校验测试消费同一字段契约。
  const vectors = JSON.parse(readFileSync(CONTRACT_FILE, 'utf8'));

  if (!Array.isArray(vectors.cases) || vectors.cases.length === 0) {
    throw new Error('proxy-request.valid.json 必须至少包含一个案例');
  }

  return structuredClone(vectors.cases[0].request);
}

// 类型: object；来源: proxy-request.valid.json；作用: 每个用例 structuredClone 后独立修改，避免测试间状态污染。
const VALID_REQUEST = loadValidRequest();

// 类型: Readonly<object>；来源: 公共协议 ProxyResponseEnvelope；作用: 只验证路由成功转交和 HTTP 200，本 HTTP 边界测试不执行上游网络。
const SUCCESS_RESPONSE = Object.freeze({
  protocolVersion: PROXY_PROTOCOL_VERSION,
  requestId: VALID_REQUEST.requestId,
  upstream: Object.freeze({
    status: 200,
    statusText: 'OK',
    responseUrl: VALID_REQUEST.target.url,
    headers: Object.freeze([])
  }),
  body: Object.freeze({ encoding: 'base64', data: 'eyJvayI6dHJ1ZX0=' }),
  meta: Object.freeze({ redirectCount: 0, receivedBytes: 11 })
});

// 类型: Readonly<object>；来源: 公共协议 HTTP 入口；作用: 所有标准 inject 请求显式声明 JSON 输入输出。
const JSON_HEADERS = Object.freeze({
  'content-type': 'application/json',
  accept: 'application/json'
});

// 类型: ReadonlyArray<string>；来源: 默认部署 CORS 策略；作用: 逐项验证 Vite 三种本机入口都能完成预检和业务请求，顺序与策略契约一致。
const LOCAL_FRONTEND_ORIGINS = Object.freeze([
  'http://127.0.0.1:5173',
  'http://[::1]:5173',
  'http://localhost:5173'
]);

// 类型: string；来源: 测试外部站点；作用: 验证未登记来源不会收到 Access-Control-Allow-Origin。
const DISALLOWED_ORIGIN = 'https://untrusted.example.com';

// CORS 不变量: 三种明确本机前端来源都可以预检和 POST，未登记来源与凭据能力不能被反射放行。
test('代理入口只向三种明确本机 origin 开放无凭据 CORS', async (testContext) => {
  // 类型: FastifyInstance；作用: 使用默认本地允许源和固定成功执行端口创建隔离应用。
  const app = createProxyApp({ executeProxyRequest: async () => SUCCESS_RESPONSE });
  testContext.after(() => app.close());

  // 循环类型: 默认本机 Origin 顺序；终止条件: IPv4、IPv6 与 localhost 均完成预检和 POST 响应断言。
  // 循环作用: 使用同一 Fastify CORS 配置验证三种入口等价，避免只测试策略数组而遗漏真实 HTTP 头。
  for (const frontendOrigin of LOCAL_FRONTEND_ORIGINS) {
    // 类型: object；作用: 模拟当前 5173 Origin 发送的标准 POST 预检。
    const allowedPreflight = await app.inject({
      method: 'OPTIONS',
      url: PROXY_REQUEST_ROUTE,
      headers: {
        origin: frontendOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,accept'
      }
    });
    // 类型: object；作用: 验证当前允许 Origin 的真实 POST 成功响应携带精确 CORS 头。
    const allowedPost = await app.inject({
      method: 'POST',
      url: PROXY_REQUEST_ROUTE,
      headers: { ...JSON_HEADERS, origin: frontendOrigin },
      payload: structuredClone(VALID_REQUEST)
    });

    assert.equal(allowedPreflight.statusCode, 204);
    assert.equal(allowedPreflight.headers['access-control-allow-origin'], frontendOrigin);
    assert.equal(allowedPreflight.headers['access-control-allow-methods'], 'POST');
    assert.equal(allowedPreflight.headers['access-control-allow-headers'], 'Content-Type, Accept');
    assert.equal(allowedPreflight.headers['access-control-allow-credentials'], undefined);
    assert.equal(allowedPost.statusCode, 200);
    assert.equal(allowedPost.headers['access-control-allow-origin'], frontendOrigin);
    assert.equal(allowedPost.headers['access-control-allow-credentials'], undefined);
  }

  // 类型: object；作用: 使用相同预检字段验证未登记来源不会获得跨域读取许可。
  const deniedPreflight = await app.inject({
    method: 'OPTIONS',
    url: PROXY_REQUEST_ROUTE,
    headers: {
      origin: DISALLOWED_ORIGIN,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,accept'
    }
  });

  assert.equal(deniedPreflight.headers['access-control-allow-origin'], undefined);
});

// HTTP 不变量: 只有精确 POST 入口和合法协议才会调用一次注入执行端口，并把上游语义包装在 HTTP 200 内。
test('合法请求通过唯一 POST 入口交给执行端口一次', async (testContext) => {
  // 类型: Array<object>；生命周期: 当前用例；作用: 证明执行端口只收到校验后隔离结果和中止上下文。
  const calls = [];
  // 回调: 模拟步骤 2 执行端口成功，不访问网络；输入不满足冻结边界时断言立即失败。
  const executeProxyRequest = async (validatedRequest, context) => {
    calls.push({ validatedRequest, context });
    return SUCCESS_RESPONSE;
  };
  const app = createProxyApp({ executeProxyRequest });
  testContext.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: PROXY_REQUEST_ROUTE,
    headers: JSON_HEADERS,
    payload: structuredClone(VALID_REQUEST)
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), SUCCESS_RESPONSE);
  assert.equal(calls.length, 1);
  assert.equal(Object.isFrozen(calls[0].validatedRequest), true);
  assert.equal(calls[0].context.signal instanceof AbortSignal, true);
  assert.deepEqual(Object.keys(calls[0].context), ['signal']);
});

// 网络前门禁: 顶层未知字段必须在执行端口调用前失败，错误外壳不回显请求体中的敏感候选内容。
test('未知字段在执行端口前失败且错误响应不泄漏输入', async (testContext) => {
  let executionCount = 0;
  // 回调: 若校验器错误放行就累加计数并让测试失败，不提供任何网络行为。
  const executeProxyRequest = async () => {
    executionCount += 1;
    return SUCCESS_RESPONSE;
  };
  const app = createProxyApp({ executeProxyRequest });
  testContext.after(() => app.close());
  const payload = structuredClone(VALID_REQUEST);
  payload.authorization = 'secret-token-must-not-leak';

  const response = await app.inject({ method: 'POST', url: PROXY_REQUEST_ROUTE, headers: JSON_HEADERS, payload });
  const responseBody = response.json();

  assert.equal(response.statusCode, 400);
  assert.equal(responseBody.error.code, 'PROXY_VALIDATION_ERROR');
  assert.equal(responseBody.requestId, VALID_REQUEST.requestId);
  assert.equal(executionCount, 0);
  assert.equal(response.body.includes('secret-token-must-not-leak'), false);
  assert.equal(response.body.includes('stack'), false);
});

// 版本边界: 未知协议不做主版本或可选字段兼容推断，直接返回专用稳定错误码。
test('未知协议版本返回 PROXY_PROTOCOL_UNSUPPORTED', async (testContext) => {
  const app = createProxyApp({ executeProxyRequest: async () => SUCCESS_RESPONSE });
  testContext.after(() => app.close());
  const payload = structuredClone(VALID_REQUEST);
  payload.protocolVersion = '1.0.0';

  const response = await app.inject({ method: 'POST', url: PROXY_REQUEST_ROUTE, headers: JSON_HEADERS, payload });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'PROXY_PROTOCOL_UNSUPPORTED');
});

// 入口边界: GET 同路径、query 兼容参数和其他路径都不能形成第二业务入口。
test('非 POST 精确入口和 query 参数统一拒绝', async (testContext) => {
  const app = createProxyApp({ executeProxyRequest: async () => SUCCESS_RESPONSE });
  testContext.after(() => app.close());

  const getResponse = await app.inject({ method: 'GET', url: PROXY_REQUEST_ROUTE, headers: { accept: 'application/json' } });
  const queryResponse = await app.inject({
    method: 'POST',
    url: `${PROXY_REQUEST_ROUTE}?compat=true`,
    headers: JSON_HEADERS,
    payload: structuredClone(VALID_REQUEST)
  });
  const otherResponse = await app.inject({ method: 'POST', url: '/api/proxy/request', headers: JSON_HEADERS, payload: structuredClone(VALID_REQUEST) });

  assert.equal(getResponse.statusCode, 400);
  assert.equal(queryResponse.statusCode, 400);
  assert.equal(otherResponse.statusCode, 400);
  assert.equal(getResponse.json().error.code, 'PROXY_VALIDATION_ERROR');
});

// 失败关闭: 执行层内部错误只能通过统一外壳返回，不能泄漏 cause、stack 或输入详情。
test('执行层内部错误使用安全外壳且不泄漏内部信息', async (testContext) => {
  const app = createProxyApp({
    executeProxyRequest: async () => {
      throw new ProxyError('PROXY_INTERNAL_ERROR', { cause: new Error('internal-secret') });
    }
  });
  testContext.after(() => app.close());

  const response = await app.inject({ method: 'POST', url: PROXY_REQUEST_ROUTE, headers: JSON_HEADERS, payload: structuredClone(VALID_REQUEST) });
  const body = response.json();

  assert.equal(response.statusCode, 500);
  assert.equal(body.error.code, 'PROXY_INTERNAL_ERROR');
  assert.deepEqual(body.error.details, {});
  assert.equal(response.body.includes('stack'), false);
  assert.equal(response.body.includes('cause'), false);
});
