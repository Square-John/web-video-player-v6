/*
  runProxyLiveIntegration.js 模块说明

  - 文件职责:
      在受信任测试 CA 的独立 Node.js 子进程中启动可控 HTTPS 上游和 Fastify 代理边界，执行真实 TLS 与资源释放回归。
      本文件只由 proxy-live-integration.test.js 派生；生产规则仍拒绝环回地址，测试通过显式依赖端口验证连接层而不增加生产白名单。

  - 导入库及文件汇总(14 条，内置 5 条，第三方 0 条，自定义 9 条):
      node:assert/strict: 核对 TLS SNI、响应、重定向、Cookie 隔离和固定错误码。
      node:events#once: 以事件和 AbortSignal 等待服务、套接字和请求生命周期，不使用固定等待。
      node:http#request: 创建真实客户端并在请求体完成后主动断开代理响应连接。
      node:https#createServer: 启动使用测试证书的可控 HTTPS 上游。
      node:process#process: 输出子进程结果并设置失败退出码。
      ../../src/config/proxyPolicy.js#createProxyPolicy: 创建只能收紧的测试部署策略。
      ../../../config/backend.config.js: 提供完整后端配置候选，测试不再伪造环境变量来源。
      ../../src/contracts/proxyProtocol.js#PROXY_REQUEST_ROUTE: 请求真实 Fastify 唯一入口。
      ../../src/errors/proxyError.js#ProxyError: 验证稳定执行错误并驱动中止测试失败路径。
      ../../src/http/createProxyApp.js#createProxyApp: 创建真实 HTTP 生命周期边界。
      ../../src/network/upstreamTransport.js#createUpstreamTransport: 执行固定 IP、SNI 和 TLS 证书校验。
      ../../src/proxy/proxyExecutor.js#createProxyExecutor: 运行真实重定向、超时、容量、媒体和资源释放事务。
      ../../src/validation/proxyRequestValidator.js#validateProxyRequestEnvelope: 让集成输入先经过生产协议门禁。
      ../fixtures/localTlsCredentials.js: 提供测试专用 localhost 证书与私钥。

  - 模块级常量:
      LOOPBACK_ADDRESS / TLS_HOSTNAME: string，本地测试监听地址和证书主机名。
      EVENT_TIMEOUT_MS: number，事件丢失时阻断测试的安全上限，不参与被测业务等待。
      TEST_POLICY: Readonly<object>，收紧超时和响应容量的后端部署策略。
      NOOP_AUDIT_LOGGER: Readonly<object>，避免子进程集成结果混入生产格式日志。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createDeferred(): 创建由明确事件完成的测试同步端口。
      waitForEvent(emitter, eventName): 使用 AbortSignal 超时等待一次事件。
      waitForCloseEvent(emitter): 等待主动断开的 close 事件并允许预期 socket error。
      listenHttps(handler): 在随机环回端口启动测试 HTTPS 上游。
      closeHttpsServer(server): 关闭并清理测试 HTTPS 连接和监听器。
      consumeBody(body): 完整读取受限成功响应流。
      createResolvedTarget(url): 创建仅供真实连接层测试的环回解析快照。
      createValidatedRequest(options): 构造并校验协议 2.0.0 原始运输测试请求。
      createLoopbackResolver(resolvedUrls): 为执行器注入记录每跳 URL 的本地解析端口。
      assertProxyErrorCode(error, code): 核对固定 ProxyError 类型和错误码。
      verifyTlsTransportAndExecutor(): 验证 TLS、SNI、重定向、无状态和资源释放。
      verifyHttpClientDisconnect(): 验证响应连接提前关闭会中止当前执行事务。
      run(): 顺序执行两组真实服务检查并输出最小结果。

  - 模块级类:
      无

  - 对外导出:
      无；由父测试作为独立 Node.js 进程直接执行。
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证真实网络与 HTTP 生命周期不变量。
import assert from 'node:assert/strict';
// 导入来源: node:events；导入内容: once；文件作用: 通过事件同步服务、套接字和客户端关闭，不轮询或固定等待。
import { once } from 'node:events';
// 导入来源: node:http；导入内容: request；文件作用: 向真实 Fastify 入口发送请求并模拟客户端提前断开。
import { request as requestHttp } from 'node:http';
// 导入来源: node:https；导入内容: createServer；文件作用: 启动可控 localhost TLS 上游。
import { createServer as createHttpsServer } from 'node:https';
// 导入来源: node:process；导入内容: process；文件作用: 向父测试输出结果并以退出码报告失败。
import process from 'node:process';
// 导入来源: ../../src/config/proxyPolicy.js；导入内容: createProxyPolicy；文件作用: 使用生产收紧规则创建集成测试策略。
import { createProxyPolicy } from '../../src/config/proxyPolicy.js';
// 导入来源: ../../../config/backend.config.js；导入内容: BACKEND_CONFIG；文件作用: 为集成测试提供完整后端配置基线。
import BACKEND_CONFIG from '../../../config/backend.config.js';
// 导入来源: ../../src/contracts/proxyProtocol.js；导入内容: PROXY_REQUEST_ROUTE；文件作用: 避免客户端测试复制唯一入口字符串。
import { PROXY_REQUEST_ROUTE } from '../../src/contracts/proxyProtocol.js';
// 导入来源: ../../src/errors/proxyError.js；导入内容: ProxyError；文件作用: 核对固定错误并结束已中止执行 Promise。
import { ProxyError } from '../../src/errors/proxyError.js';
// 导入来源: ../../src/http/createProxyApp.js；导入内容: createProxyApp；文件作用: 创建真实 Fastify 监听边界。
import { createProxyApp } from '../../src/http/createProxyApp.js';
// 导入来源: ../../src/network/upstreamTransport.js；导入内容: createUpstreamTransport；文件作用: 运行生产 Undici 固定连接链。
import { createUpstreamTransport } from '../../src/network/upstreamTransport.js';
// 导入来源: ../../src/proxy/proxyExecutor.js；导入内容: createProxyExecutor；文件作用: 运行生产重定向、响应编码和清理事务。
import { createProxyExecutor } from '../../src/proxy/proxyExecutor.js';
// 导入来源: ../../src/validation/proxyRequestValidator.js；导入内容: validateProxyRequestEnvelope；文件作用: 让集成输入先通过生产协议门禁。
import { validateProxyRequestEnvelope } from '../../src/validation/proxyRequestValidator.js';
// 导入来源: ../fixtures/localTlsCredentials.js；导入内容: LOCAL_TLS_CERTIFICATE_PEM、LOCAL_TLS_PRIVATE_KEY_PEM；文件作用: 启动测试 TLS 上游。
import { LOCAL_TLS_CERTIFICATE_PEM, LOCAL_TLS_PRIVATE_KEY_PEM } from '../fixtures/localTlsCredentials.js';

// 类型: string；来源: 本地集成测试边界；作用: 服务只监听环回地址，不暴露到局域网或公网。
const LOOPBACK_ADDRESS = '127.0.0.1';
// 类型: string；来源: 测试证书 SAN；作用: 验证连接固定到 IP 时仍按原域名发送 SNI 和校验证书。
const TLS_HOSTNAME = 'localhost';
// 单位: 毫秒；来源: 集成测试资源清理上限；作用: 事件未发生时终止测试，不能替代被测代码的超时机制。
const EVENT_TIMEOUT_MS = 3000;

// 类型: object；作用: 复制根配置并只替换集成测试需要收紧的两个限制字段。
const TEST_BACKEND_CONFIG = structuredClone(BACKEND_CONFIG);
TEST_BACKEND_CONFIG.limits = {
  upstreamTimeoutMs: 250,
  responseBytes: 64
};

// 类型: Readonly<object>；来源: 生产 createProxyPolicy；作用: 只收紧集成事务超时和最大响应字节，不增加测试专用生产入口。
const TEST_POLICY = createProxyPolicy(TEST_BACKEND_CONFIG);

// 类型: Readonly<object>；来源: ProxyExecutor 日志端口形状；作用: 集成测试不把预期失败写入父测试 stdout，且不保存任何事件。
const NOOP_AUDIT_LOGGER = Object.freeze({
  // 回调: 成功摘要已由独立日志契约测试覆盖，本集成进程不输出。
  recordSuccess: () => {},
  // 回调: 失败摘要已由独立日志契约测试覆盖，本集成进程不输出。
  recordFailure: () => {}
});

/**
 * 创建由明确事件完成的单次同步端口。
 * 调用方: HTTPS 端点资源关闭和 HTTP 执行开始/中止测试。
 * 状态所有权: resolve/reject 只属于当前调用，Promise 完成后不保留外部资源。
 * 失败路径: 调用方事件 reject 时保留原始错误；事件未完成时由安全上限 reject，避免测试进程悬挂。
 *
 * @returns {{ promise: Promise<unknown>, resolve: Function, reject: Function }} 当前事件同步对象。
 */
function createDeferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
    // 安全上限: deferred 必须由明确事件完成；事件链断裂时主动失败，不能无限占用测试服务。
    const timeoutSignal = AbortSignal.timeout(EVENT_TIMEOUT_MS);
    timeoutSignal.addEventListener('abort', () => reject(timeoutSignal.reason), { once: true });
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

/**
 * 在安全上限内等待 EventEmitter 的下一次指定事件。
 * 调用方: listenHttps、端点套接字关闭和 HTTP 客户端关闭。
 * 副作用: 注册一次性监听和超时 signal；事件完成后 node:events 自动清理监听。
 * 失败路径: 事件未在上限内出现时由 AbortSignal.timeout 终止并 reject。
 *
 * @param {import('node:events').EventEmitter} emitter 事件来源。
 * @param {string} eventName 需要等待的事件名。
 * @returns {Promise<Array<unknown>>} 事件参数数组。
 */
function waitForEvent(emitter, eventName) {
  return once(emitter, eventName, { signal: AbortSignal.timeout(EVENT_TIMEOUT_MS) });
}

/**
 * 等待主动断开资源的 close 事件，不把预期 socket error 当成测试失败。
 * 调用方: verifyHttpClientDisconnect 的客户端请求。
 * 副作用: 注册一次性 close 监听，并由事件完成 Promise；客户端 error 已由调用方显式消费。
 * 失败路径: close 事件不出现时由调用方的总测试超时阻断，不能再把 hang up 误判为业务失败。
 *
 * @param {import('node:events').EventEmitter} emitter 主动销毁的客户端请求。
 * @returns {Promise<Array<unknown>>} close 事件参数数组。
 */
function waitForCloseEvent(emitter) {
  return new Promise((resolve) => emitter.once('close', resolve));
}

/**
 * 在随机环回端口启动测试 HTTPS 上游。
 * 调用方: verifyTlsTransportAndExecutor。
 * 副作用: 创建 TLS 服务并短暂绑定一个本地端口；调用方必须在 finally 中关闭。
 * 成功路径: 返回已监听 server 和实际端口。
 * 失败路径: 证书、监听或事件失败向上 reject。
 *
 * @param {Function} handler HTTPS 请求处理器。
 * @returns {Promise<{ server: import('node:https').Server, port: number }>} 已监听测试服务。
 */
async function listenHttps(handler) {
  const server = createHttpsServer({ cert: LOCAL_TLS_CERTIFICATE_PEM, key: LOCAL_TLS_PRIVATE_KEY_PEM }, handler);
  server.listen(0, LOOPBACK_ADDRESS);
  await waitForEvent(server, 'listening');
  const address = server.address();
  assert.equal(address !== null && typeof address === 'object', true);
  return { server, port: address.port };
}

/**
 * 关闭测试 HTTPS 服务及意外残留连接。
 * 调用方: verifyTlsTransportAndExecutor 的 finally。
 * 副作用: 停止监听并销毁只属于测试进程的连接。
 * 失败路径: close 回调错误向上 reject；未监听服务直接完成。
 *
 * @param {import('node:https').Server} server 当前测试 HTTPS 服务。
 * @returns {Promise<void>} 监听器和连接释放后完成。
 */
async function closeHttpsServer(server) {
  if (server.listening !== true) {
    return;
  }

  // 资源清理: 测试失败时终止尚未响应的 timeout 端点，避免子进程遗留监听器。
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

/**
 * 完整读取一个成功上游响应流。
 * 调用方: 无状态 Cookie 的两次直接传输检查。
 * 副作用: 消费当前 Undici body；Client 生命周期仍由调用方 release 管理。
 * 失败路径: 流读取失败原样 reject。
 *
 * @param {AsyncIterable<Uint8Array>} body Undici 响应体。
 * @returns {Promise<string>} UTF-8 响应文本。
 */
async function consumeBody(body) {
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * 创建只供真实连接层测试使用的环回解析快照。
 * 调用方: 直接 transport 请求和 createLoopbackResolver。
 * 副作用: 无；返回新的深层冻结对象。
 * 失败路径: URL 主机不是 localhost 时使用 assert 立即暴露夹具越界。
 *
 * @param {string} url 当前测试上游 URL。
 * @returns {Readonly<object>} 与生产 TargetResolver 输出同形状的本地快照。
 */
function createResolvedTarget(url) {
  const parsed = new URL(url);
  assert.equal(parsed.hostname, TLS_HOSTNAME);
  return Object.freeze({
    url: parsed.href,
    hostname: TLS_HOSTNAME,
    addresses: Object.freeze([Object.freeze({ address: LOOPBACK_ADDRESS, family: 4 })])
  });
}

/**
 * 构造并通过生产校验器冻结一个测试请求。
 * 调用方: 重定向、容量、媒体和超时集成场景。
 * 副作用: 无网络；生产校验器创建隔离冻结副本。
 * 失败路径: 选项不满足公共协议时由 ProxyError 阻断测试。
 *
 * @param {object} options 当前请求差异。
 * @param {string} options.url localhost HTTPS 目标。
 * @param {string} options.requestId 测试关联标识。
 * @param {number} options.timeoutMs 当前请求总超时。
 * @param {number} options.maxResponseBytes 当前响应容量上限。
 * @returns {Readonly<object>} 生产 ProxyExecutor 可消费的校验结果。
 */
function createValidatedRequest({ url, requestId, timeoutMs, maxResponseBytes }) {
  return validateProxyRequestEnvelope({
    protocolVersion: '2.0.0',
    requestId,
    sourceId: 'source-live-integration',
    target: { url, method: 'GET' },
    headers: [{ name: 'accept', value: 'text/plain' }],
    body: { encoding: 'none', data: null },
    timeoutMs,
    maxResponseBytes
  }, TEST_POLICY);
}

/**
 * 创建记录每跳 URL 的本地解析端口。
 * 调用方: verifyTlsTransportAndExecutor 注入 ProxyExecutor。
 * 状态所有权: resolvedUrls 由当前测试持有；解析器不缓存地址或跨请求状态。
 * 失败路径: signal 已中止或目标离开 localhost 时立即失败。
 *
 * @param {Array<string>} resolvedUrls 当前测试的每跳 URL 记录。
 * @returns {Readonly<{ resolveTarget: Function }>} 与生产执行器依赖一致的解析端口。
 */
function createLoopbackResolver(resolvedUrls) {
  return Object.freeze({
    /**
     * 记录并解析当前本地测试跳。
     * 调用方: ProxyExecutor 每次初始目标和重定向循环。
     * 副作用: 向当前测试数组追加规范 URL；不执行系统 DNS。
     * 失败路径: signal 中止或 URL 越界时抛错。
     *
     * @param {string} url 当前跳 URL。
     * @param {AbortSignal} signal 当前代理事务 signal。
     * @returns {Promise<Readonly<object>>} 本地固定连接快照。
     */
    resolveTarget: async (url, signal) => {
      signal.throwIfAborted();
      const target = createResolvedTarget(url);
      resolvedUrls.push(target.url);
      return target;
    }
  });
}

/**
 * 确认异常是指定固定代理错误。
 * 调用方: 超时、容量和媒体失败断言。
 * 副作用: 无；只读取类型和 code。
 * 失败路径: 类型或 code 不一致时由 assert 抛 AssertionError。
 *
 * @param {unknown} error 当前 reject 原因。
 * @param {string} code 期望冻结错误码。
 * @returns {true} 供 assert.rejects 判定。
 */
function assertProxyErrorCode(error, code) {
  assert.equal(error instanceof ProxyError, true);
  assert.equal(error.code, code);
  return true;
}

/**
 * 验证真实 TLS 连接、SNI、逐跳重定向、Cookie 隔离以及失败资源释放。
 * 调用方: run。
 * 副作用: 启动一个随机本地 HTTPS 服务并创建多条短生命周期 TLS 连接；finally 关闭全部资源。
 * 成功路径: 返回已验证场景名称数组。
 * 失败路径: 任一 TLS、协议、错误码或 socket close 不变量失败时 reject。
 *
 * @returns {Promise<Array<string>>} 已完成的真实上游场景。
 */
async function verifyTlsTransportAndExecutor() {
  const oversizeClosed = createDeferred();
  const videoClosed = createDeferred();
  const timeoutClosed = createDeferred();
  const requestPaths = [];
  const serverNames = [];
  const receivedCookies = [];
  let cookieRequestCount = 0;

  const { server, port } = await listenHttps((request, response) => {
    requestPaths.push(request.url);
    serverNames.push(request.socket.servername);

    if (request.url === '/cookie') {
      receivedCookies.push(request.headers.cookie ?? null);
      cookieRequestCount += 1;
      response.writeHead(200, { 'content-type': 'text/plain', 'set-cookie': 'session=test-only' });
      response.end(`cookie-${cookieRequestCount}`);
      return;
    }

    if (request.url === '/redirect') {
      response.writeHead(302, { location: '/final' });
      response.end();
      return;
    }

    if (request.url === '/final') {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('done');
      return;
    }

    if (request.url === '/invalid-json') {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end('not-json');
      return;
    }

    if (request.url === '/oversize') {
      waitForEvent(request.socket, 'close').then(oversizeClosed.resolve, oversizeClosed.reject);
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.write('0123456789');
      return;
    }

    if (request.url === '/video') {
      waitForEvent(request.socket, 'close').then(videoClosed.resolve, videoClosed.reject);
      response.writeHead(200, { 'content-type': 'video/mp4' });
      response.write(Buffer.from([1, 2, 3, 4]));
      return;
    }

    if (request.url === '/timeout') {
      waitForEvent(request.socket, 'close').then(timeoutClosed.resolve, timeoutClosed.reject);
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('unknown fixture path');
  });

  try {
    const transport = createUpstreamTransport();
    const cookieUrl = `https://${TLS_HOSTNAME}:${port}/cookie`;

    // 循环: 两次独立真实传输证明 set-cookie 不会形成跨请求 Cookie jar 或连接状态。
    for (const expectedBody of ['cookie-1', 'cookie-2']) {
      const upstream = await transport.requestUpstream({
        resolvedTarget: createResolvedTarget(cookieUrl),
        method: 'GET',
        headers: [],
        body: undefined,
        signal: new AbortController().signal,
        timeoutMs: TEST_POLICY.limits.upstreamTimeoutMs
      });
      try {
        assert.equal(await consumeBody(upstream.body), expectedBody);
      } finally {
        await upstream.release();
      }
    }

    assert.deepEqual(receivedCookies, [null, null]);
    assert.deepEqual(serverNames.slice(0, 2), [TLS_HOSTNAME, TLS_HOSTNAME]);

    const resolvedUrls = [];
    const execute = createProxyExecutor({
      policy: TEST_POLICY,
      targetResolver: createLoopbackResolver(resolvedUrls),
      upstreamTransport: transport,
      auditLogger: NOOP_AUDIT_LOGGER
    });
    const context = Object.freeze({ signal: new AbortController().signal });
    const redirectUrl = `https://${TLS_HOSTNAME}:${port}/redirect`;
    const redirectResponse = await execute(createValidatedRequest({
      url: redirectUrl,
      requestId: 'live-redirect',
      timeoutMs: 250,
      maxResponseBytes: 64
    }), context);

    assert.deepEqual(resolvedUrls, [redirectUrl, `https://${TLS_HOSTNAME}:${port}/final`]);
    assert.equal(redirectResponse.meta.redirectCount, 1);
    assert.deepEqual(redirectResponse.body, { encoding: 'base64', data: Buffer.from('done', 'utf8').toString('base64') });

    // 原始运输: 真实 TLS 上游的 502 非法 JSON 仍是成功物流结果，后端不能在 Provider 前解析正文。
    const invalidJsonResponse = await execute(createValidatedRequest({
      url: `https://${TLS_HOSTNAME}:${port}/invalid-json`,
      requestId: 'live-invalid-json',
      timeoutMs: 250,
      maxResponseBytes: 64
    }), context);
    assert.equal(invalidJsonResponse.upstream.status, 502);
    assert.deepEqual(invalidJsonResponse.body, { encoding: 'base64', data: Buffer.from('not-json', 'utf8').toString('base64') });

    await assert.rejects(
      () => execute(createValidatedRequest({
        url: `https://${TLS_HOSTNAME}:${port}/oversize`,
        requestId: 'live-oversize',
        timeoutMs: 250,
        maxResponseBytes: 8
      }), context),
      (error) => assertProxyErrorCode(error, 'PROXY_RESPONSE_TOO_LARGE')
    );
    await oversizeClosed.promise;

    await assert.rejects(
      () => execute(createValidatedRequest({
        url: `https://${TLS_HOSTNAME}:${port}/video`,
        requestId: 'live-video',
        timeoutMs: 250,
        maxResponseBytes: 8
      }), context),
      (error) => assertProxyErrorCode(error, 'PROXY_TARGET_FORBIDDEN')
    );
    await videoClosed.promise;

    await assert.rejects(
      () => execute(createValidatedRequest({
        url: `https://${TLS_HOSTNAME}:${port}/timeout`,
        requestId: 'live-timeout',
        timeoutMs: 50,
        maxResponseBytes: 8
      }), context),
      (error) => assertProxyErrorCode(error, 'PROXY_UPSTREAM_TIMEOUT')
    );
    await timeoutClosed.promise;

    assert.equal(requestPaths.includes('/final'), true);
    assert.equal(serverNames.every((value) => value === TLS_HOSTNAME), true);
    return ['pinned-tls-sni', 'redirect-revalidation', 'raw-invalid-json', 'stateless-cookie', 'response-limit-release', 'media-release', 'timeout-release'];
  } finally {
    await closeHttpsServer(server);
  }
}

/**
 * 验证客户端在请求体完成后关闭响应连接会中止当前代理执行。
 * 调用方: run。
 * 副作用: Fastify 在随机环回端口短暂监听；Node HTTP 客户端在执行端口启动后主动销毁连接。
 * 成功路径: 执行上下文 signal 被触发，应用和客户端资源在 finally 清理。
 * 失败路径: signal 未触发或事件超时会 reject。
 *
 * @returns {Promise<string>} 已完成场景名称。
 */
async function verifyHttpClientDisconnect() {
  const executionStarted = createDeferred();
  const executionAborted = createDeferred();
  const executeProxyRequest = async (validatedRequest, context) => {
    void validatedRequest;
    executionStarted.resolve();
    return new Promise((resolve, reject) => {
      void resolve;
      // 取消路径: HTTP 响应连接提前关闭必须触发当前上下文 signal，随后执行失败并释放路由生命周期。
      context.signal.addEventListener('abort', () => {
        executionAborted.resolve();
        reject(new ProxyError('PROXY_REQUEST_ABORTED'));
      }, { once: true });
    });
  };
  const app = createProxyApp({ policy: TEST_POLICY, executeProxyRequest });
  let clientRequest;

  try {
    await app.listen({ host: LOOPBACK_ADDRESS, port: 0 });
    const address = app.server.address();
    assert.equal(address !== null && typeof address === 'object', true);
    const payload = JSON.stringify({
      protocolVersion: '2.0.0',
      requestId: 'live-client-disconnect',
      sourceId: 'source-live-integration',
      target: { url: 'https://example.com/content', method: 'GET' },
      headers: [],
      body: { encoding: 'none', data: null },
      timeoutMs: 250,
      maxResponseBytes: 64
    });
    clientRequest = requestHttp({
      host: LOOPBACK_ADDRESS,
      port: address.port,
      method: 'POST',
      path: PROXY_REQUEST_ROUTE,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      }
    });
    // 错误边界: 主动 destroy 产生的客户端错误属于预期断开，只由 close 和执行 signal 决定测试结果。
    clientRequest.on('error', () => {});
    const clientClosed = waitForCloseEvent(clientRequest);
    clientRequest.end(payload);
    await executionStarted.promise;
    clientRequest.destroy();
    await executionAborted.promise;
    await clientClosed;
    return 'client-response-disconnect-abort';
  } finally {
    clientRequest?.destroy();
    await app.close();
  }
}

/**
 * 顺序执行所有需要真实本地服务的步骤 3 集成检查。
 * 调用方: 文件底部直接执行分支。
 * 副作用: 临时监听由各检查内部 finally 清理；只向 stdout 输出一行不含敏感值的 JSON 结果。
 * 失败路径: 任一检查失败向底部 catch 传播并设置非零退出码。
 *
 * @returns {Promise<void>} 全部检查和结果输出完成。
 */
async function run() {
  const tlsScenarios = await verifyTlsTransportAndExecutor();
  const disconnectScenario = await verifyHttpClientDisconnect();
  process.stdout.write(`${JSON.stringify({ ok: true, scenarios: [...tlsScenarios, disconnectScenario] })}\n`);
}

run().catch((error) => {
  // 失败输出: 子进程只输出测试错误栈供父测试定位，不进入生产代理日志或协议响应。
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
