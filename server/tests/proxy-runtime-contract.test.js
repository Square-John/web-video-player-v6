/*
  proxy-runtime-contract.test.js 模块说明

  - 文件职责:
      验证成功外壳精确字段、调用方可控日志标识脱敏、监听参数隔离、HTTPS 有效端口、固定连接端点和 DNS 每次解析变化。
      测试只使用契约文件、纯函数和注入解析端口，不监听网络端口、不访问真实 DNS 或公网。

  - 导入库及文件汇总(13 条，内置 6 条，第三方 0 条，自定义 7 条):
      node:assert/strict: 核对精确键集合、摘要、地址和稳定错误码。
      node:crypto#createHash: 计算测试期望的关联摘要，不复用生产实现生成期望值。
      node:fs#readFileSync: 读取语言无关成功响应向量。
      node:path: 从测试目录定位仓库根 contracts/v2。
      node:test#test: 注册相互隔离的契约和安全回归用例。
      node:url#fileURLToPath: 将测试模块 URL 转换为文件系统路径。
      ../src/errors/proxyError.js#ProxyError: 验证地址换址使用冻结领域错误。
      ../src/index.js#createProxyListenOptions: 验证冻结部署策略不会直接进入可变 Fastify 监听边界。
      ../src/network/pinnedConnector.js#createPinnedConnector、assertPinnedRemoteAddress: 验证端口偏离和连接后真实远端复核。
      ../src/network/upstreamEndpoint.js#resolveHttpsEndpointPort: 验证默认、显式和非法 HTTPS 端口语义。
      ../src/network/upstreamTransport.js#createUpstreamTransport: 用注入 Client 验证有效端口进入连接器工厂。
      ../src/proxy/proxyAuditLogger.js#createProxyAuditLogger: 验证生产日志只输出关联摘要和容量字段。
      ../src/security/targetResolver.js#createTargetResolver: 注入变化的 DNS 结果并证明解析器不缓存。

  - 模块级常量:
      CONTRACT_FILE: string，成功响应语言无关向量绝对路径。
      RESPONSE_VECTORS: object，步骤 2 真实执行器必须生成的成功响应集合。
      RESPONSE_KEYS / UPSTREAM_KEYS / HEADER_KEYS / BODY_KEYS / META_KEYS: ReadonlyArray<string>，协议 2.0.0 精确键集合。
      SENSITIVE_REQUEST_ID / SENSITIVE_SOURCE_ID: string，验证日志不回显的调用方可控敏感样例。
      PUBLIC_TEST_ADDRESS: string，无网络固定连接参数使用的公网地址样例。
      TEST_TIMEOUT_MS: number，无网络传输与连接器参数使用的测试超时。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertExactKeys(value, expectedKeys): 核对普通对象只包含冻结协议键。
      assertProxyErrorCode(error, code): 核对固定 ProxyError 类型和错误码。

  - 模块级类:
      StubUpstreamClient: 不建立连接的 Undici Client 替身，只返回可释放的最小成功响应。

  - 对外导出:
      无；由 node --test 直接执行。
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证精确对象形状、摘要和安全错误。
import assert from 'node:assert/strict';
// 导入来源: node:crypto；导入内容: createHash；文件作用: 独立计算日志摘要期望值。
import { createHash } from 'node:crypto';
// 导入来源: node:fs；导入内容: readFileSync；文件作用: 读取共享成功响应向量。
import { readFileSync } from 'node:fs';
// 导入来源: node:path；导入内容: dirname、resolve；文件作用: 从当前测试文件推导契约绝对路径。
import { dirname, resolve } from 'node:path';
// 导入来源: node:test；导入内容: test；文件作用: 注册无真实网络的步骤 3 回归用例。
import test from 'node:test';
// 导入来源: node:url；导入内容: fileURLToPath；文件作用: 把 import.meta.url 转为测试目录路径。
import { fileURLToPath } from 'node:url';
// 导入来源: ../src/errors/proxyError.js；导入内容: ProxyError；文件作用: 核对连接地址偏离的固定错误类型。
import { ProxyError } from '../src/errors/proxyError.js';
// 导入来源: ../src/index.js；导入内容: createProxyListenOptions；文件作用: 验证生产启动只投影 host/port 并返回可扩展入参。
import { createProxyListenOptions } from '../src/index.js';
// 导入来源: ../src/network/pinnedConnector.js；导入内容: createPinnedConnector、assertPinnedRemoteAddress；文件作用: 验证端口偏离与远端地址复核断言。
import { createPinnedConnector, assertPinnedRemoteAddress } from '../src/network/pinnedConnector.js';
// 导入来源: ../src/network/upstreamEndpoint.js；导入内容: resolveHttpsEndpointPort；文件作用: 直接验证 HTTPS 默认和显式端口解析。
import { resolveHttpsEndpointPort } from '../src/network/upstreamEndpoint.js';
// 导入来源: ../src/network/upstreamTransport.js；导入内容: createUpstreamTransport；文件作用: 注入无网络 Client 观察连接器收到的冻结端口。
import { createUpstreamTransport } from '../src/network/upstreamTransport.js';
// 导入来源: ../src/proxy/proxyAuditLogger.js；导入内容: createProxyAuditLogger；文件作用: 捕获生产脱敏日志输出。
import { createProxyAuditLogger } from '../src/proxy/proxyAuditLogger.js';
// 导入来源: ../src/security/targetResolver.js；导入内容: createTargetResolver；文件作用: 注入逐次变化的 DNS 结果。
import { createTargetResolver } from '../src/security/targetResolver.js';

// 类型: string；来源: 当前测试目录向上两级；作用: 定位后端和未来 ProxyClient 共用的成功响应向量。
const CONTRACT_FILE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'contracts', 'v2', 'proxy-response.valid.json');

// 类型: object；来源: proxy-response.valid.json；作用: 所有成功案例都必须满足同一精确外壳键集合。
const RESPONSE_VECTORS = JSON.parse(readFileSync(CONTRACT_FILE, 'utf8'));

// 类型: ReadonlyArray<string>；来源: 公共协议第 5.3 节；作用: 拒绝成功外壳静默增加顶层字段。
const RESPONSE_KEYS = Object.freeze(['protocolVersion', 'requestId', 'upstream', 'body', 'meta']);
// 类型: ReadonlyArray<string>；来源: ProxyResponseEnvelope.upstream；作用: 冻结上游状态和响应定位字段。
const UPSTREAM_KEYS = Object.freeze(['status', 'statusText', 'responseUrl', 'headers']);
// 类型: ReadonlyArray<string>；来源: ProxyResponseEnvelope.upstream.headers 条目；作用: 同名头只通过有序 name/value 条目表达。
const HEADER_KEYS = Object.freeze(['name', 'value']);
// 类型: ReadonlyArray<string>；来源: ProxyResponseEnvelope.body；作用: 响应体只声明编码和对应数据。
const BODY_KEYS = Object.freeze(['encoding', 'data']);
// 类型: ReadonlyArray<string>；来源: ProxyResponseEnvelope.meta；作用: 只回填重定向次数和转换前字节数。
const META_KEYS = Object.freeze(['redirectCount', 'receivedBytes']);

// 类型: string；来源: 测试恶意调用方输入；作用: 证明 URL、IP 和 Token 即使伪装成 requestId 也不会原样进入日志。
const SENSITIVE_REQUEST_ID = 'https://127.0.0.1/private?token=request-secret';
// 类型: string；来源: 测试恶意调用方输入；作用: 证明凭证样例即使伪装成 sourceId 也只记录摘要。
const SENSITIVE_SOURCE_ID = 'Bearer source-secret';

// 类型: string；来源: IANA 文档示例公网地址；作用: 构造不会真正连接的固定地址参数并通过地址类型约束。
const PUBLIC_TEST_ADDRESS = '93.184.216.34';

// 单位: 毫秒；来源: 当前测试不访问网络的有限调用边界；作用: 为连接器和传输输入提供有效正整数。
const TEST_TIMEOUT_MS = 1000;

/**
 * 提供不访问网络的最小 Undici Client 测试替身。
 * 使用场景: 验证 upstreamTransport 在构造 Client 前交给 connectorFactory 的端口参数。
 * 状态所有权: 实例不保存 origin、连接器或响应；每次 request 返回独立只读候选。
 * 失败路径: 无；输入验证由生产 upstreamTransport 和当前测试断言承担。
 */
class StubUpstreamClient {
  /**
   * 接受与 Undici Client 相同的构造调用但不建立连接。
   * 副作用: 无；不保存参数或创建资源。
   *
   * @returns {StubUpstreamClient} 当前无状态实例。
   */
  constructor() {}

  /**
   * 返回 upstreamTransport 可以包装和释放的最小成功响应。
   * 副作用: 创建只属于当前调用的已销毁 body 标记，release 不需要访问事件或网络。
   *
   * @returns {Promise<object>} 状态、空头和已释放 body 候选。
   */
  async request() {
    return {
      statusCode: 200,
      statusText: 'OK',
      headers: [],
      body: { destroyed: true }
    };
  }

  /**
   * 模拟关闭独占 Client。
   * 副作用: 无；测试替身没有套接字或流。
   *
   * @returns {Promise<void>} 立即完成。
   */
  async destroy() {}
}

/**
 * 确认普通对象只包含指定精确键集合。
 * 调用方: 成功向量逐层回归和未知字段反例。
 * 副作用: 无；只读取对象自有可枚举键并排序比较。
 * 失败路径: 输入不是普通对象或键集合不同，由 assert 抛 AssertionError。
 *
 * @param {unknown} value 待检查协议对象。
 * @param {ReadonlyArray<string>} expectedKeys 当前层冻结键集合。
 * @returns {void} 键集合完全一致时无返回值。
 */
function assertExactKeys(value, expectedKeys) {
  assert.equal(value !== null && typeof value === 'object' && !Array.isArray(value), true);
  assert.deepEqual(Object.keys(value).sort(), [...expectedKeys].sort());
}

/**
 * 确认异常是指定固定代理错误。
 * 调用方: 地址偏离回归断言。
 * 副作用: 无；只读取异常类型和 code。
 * 失败路径: 类型或 code 不一致时由 assert 抛 AssertionError。
 *
 * @param {unknown} error 当前捕获异常。
 * @param {string} code 期望冻结错误码。
 * @returns {true} 供 assert.throws 判定。
 */
function assertProxyErrorCode(error, code) {
  assert.equal(error instanceof ProxyError, true);
  assert.equal(error.code, code);
  return true;
}

// 契约不变量: 每个成功向量逐层只包含协议 2.0.0 精确字段，任意未知字段都会让同一断言失败。
test('ProxyResponseEnvelope 成功向量保持精确字段并拒绝未知字段', () => {
  for (const vector of RESPONSE_VECTORS.cases) {
    assertExactKeys(vector.response, RESPONSE_KEYS);
    assertExactKeys(vector.response.upstream, UPSTREAM_KEYS);
    assertExactKeys(vector.response.body, BODY_KEYS);
    assertExactKeys(vector.response.meta, META_KEYS);

    for (const header of vector.response.upstream.headers) {
      assertExactKeys(header, HEADER_KEYS);
    }
  }

  const responseWithUnknownField = structuredClone(RESPONSE_VECTORS.cases[0].response);
  responseWithUnknownField.unknownField = true;
  assert.throws(() => assertExactKeys(responseWithUnknownField, RESPONSE_KEYS), assert.AssertionError);
});

// 日志不变量: requestId/sourceId 只作为哈希关联输入，输出不能包含调用方伪装的地址、凭证或正文片段。
test('代理审计日志只记录关联摘要且不保存历史', () => {
  const lines = [];
  const logger = createProxyAuditLogger({
    // 回调: 捕获当前调用产生的单行 JSON；数组只属于当前测试，不代表生产日志状态。
    write: (line) => lines.push(line)
  });

  logger.recordSuccess({
    requestId: SENSITIVE_REQUEST_ID,
    sourceId: SENSITIVE_SOURCE_ID,
    durationMs: 12.4,
    upstreamStatus: 200,
    receivedBytes: 16,
    redirectCount: 1
  });
  logger.recordFailure({
    requestId: SENSITIVE_REQUEST_ID,
    sourceId: SENSITIVE_SOURCE_ID,
    durationMs: 4.6,
    errorCode: 'PROXY_UPSTREAM_TIMEOUT'
  });

  assert.equal(lines.length, 2);
  assert.equal(lines.join('').includes(SENSITIVE_REQUEST_ID), false);
  assert.equal(lines.join('').includes(SENSITIVE_SOURCE_ID), false);
  const success = JSON.parse(lines[0]);
  const failure = JSON.parse(lines[1]);
  const expectedRequestHash = createHash('sha256').update(SENSITIVE_REQUEST_ID, 'utf8').digest('hex');
  const expectedSourceHash = createHash('sha256').update(SENSITIVE_SOURCE_ID, 'utf8').digest('hex');

  assert.equal(success.requestIdHash, expectedRequestHash);
  assert.equal(success.sourceIdHash, expectedSourceHash);
  assert.equal(Object.hasOwn(success, 'requestId'), false);
  assert.equal(Object.hasOwn(success, 'sourceId'), false);
  assert.equal(failure.requestIdHash, expectedRequestHash);
  assert.equal(failure.errorCode, 'PROXY_UPSTREAM_TIMEOUT');
});

// 启动不变量: 冻结部署策略不能直接交给会扩展入参的 Fastify，监听边界只接收一个可扩展 host/port 投影。
test('监听参数投影隔离冻结部署策略和应用策略字段', () => {
  // 类型: Readonly<object>；作用: 模拟生产 proxyPolicy.server，包含不能泄露给 Fastify listen 的 CORS 字段。
  const serverPolicy = Object.freeze({
    host: '127.0.0.1',
    port: 3000,
    allowedOrigins: Object.freeze(['http://127.0.0.1:5173'])
  });
  // 类型: object；作用: 获得生产启动真正传给 Fastify 的隔离参数。
  const listenOptions = createProxyListenOptions(serverPolicy);

  // 断言作用: 精确字段阻止 CORS 策略进入第三方监听层，可扩展性允许 Fastify 管理自己的内部生命周期状态。
  assert.deepEqual(listenOptions, { host: serverPolicy.host, port: serverPolicy.port });
  assert.equal(Object.isExtensible(listenOptions), true);
  assert.equal(Object.hasOwn(listenOptions, 'allowedOrigins'), false);
  assert.equal(Object.isFrozen(serverPolicy), true);
  assert.throws(
    () => createProxyListenOptions(Object.freeze({ host: '', port: serverPolicy.port })),
    TypeError
  );
});

// 连接不变量: 文本表示等价的地址允许通过，真实远端偏离固定地址时使用目标禁止错误失败关闭。
test('固定连接地址复核接受等价表示并拒绝换址', () => {
  assert.doesNotThrow(() => assertPinnedRemoteAddress('93.184.216.34', '::ffff:93.184.216.34'));
  assert.throws(
    () => assertPinnedRemoteAddress('93.184.216.34', '93.184.216.35'),
    (error) => assertProxyErrorCode(error, 'PROXY_TARGET_FORBIDDEN')
  );
});

// 端口不变量: URL/Undici 的空端口只在 HTTPS 下表示 443，显式端口保持原值，模糊或越界输入不能进入连接层。
test('HTTPS 有效端口统一处理默认、显式和非法输入', () => {
  assert.equal(resolveHttpsEndpointPort({ protocol: 'https:', port: '' }), 443);
  assert.equal(resolveHttpsEndpointPort({ protocol: 'https:', port: '8443' }), 8443);
  assert.throws(() => resolveHttpsEndpointPort({ protocol: 'http:', port: '' }), TypeError);
  assert.throws(() => resolveHttpsEndpointPort({ protocol: 'https:', port: undefined }), TypeError);
  assert.throws(() => resolveHttpsEndpointPort({ protocol: 'https:', port: '0' }), RangeError);
  assert.throws(() => resolveHttpsEndpointPort({ protocol: 'https:', port: '65536' }), RangeError);
});

// 传输不变量: 默认和显式端口必须由已验证 URL 解析后进入 connectorFactory，不能再次读取 Undici 空端口决定目标。
test('上游传输把默认和显式 HTTPS 端口交给固定连接器', async () => {
  // 类型: Array<object>；来源: 当前测试 connectorFactory 调用；作用: 记录每个 URL 进入固定连接器前的隔离参数。
  const connectorOptions = [];
  const transport = createUpstreamTransport({
    ClientConstructor: StubUpstreamClient,
    // 回调: 只记录生产传入参数并返回不会被 StubUpstreamClient 调用的连接函数。
    connectorFactory: (options) => {
      connectorOptions.push(options);
      return () => {};
    }
  });
  const cases = Object.freeze([
    Object.freeze({ url: 'https://example.com/data', expectedPort: 443 }),
    Object.freeze({ url: 'https://example.com:8443/data', expectedPort: 8443 })
  ]);

  for (const testCase of cases) {
    // 异步调用: 使用独立响应和 release 验证每次端口解析不共享 Client 或资源状态。
    const response = await transport.requestUpstream({
      resolvedTarget: Object.freeze({
        url: testCase.url,
        hostname: 'example.com',
        addresses: Object.freeze([Object.freeze({ address: PUBLIC_TEST_ADDRESS, family: 4 })])
      }),
      method: 'GET',
      headers: Object.freeze([]),
      body: undefined,
      signal: new AbortController().signal,
      timeoutMs: TEST_TIMEOUT_MS
    });
    await response.release();
  }

  assert.deepEqual(connectorOptions.map((options) => options.port), cases.map((testCase) => testCase.expectedPort));
});

// 连接不变量: connector 构造时拒绝非法冻结端口，调用时拒绝 Undici 把已经冻结的 443 改成其他端口。
test('固定连接器在创建 socket 前拒绝非法或偏离端口', async () => {
  assert.throws(
    () => createPinnedConnector({
      hostname: 'example.com',
      pinnedAddress: Object.freeze({ address: PUBLIC_TEST_ADDRESS, family: 4 }),
      port: 65536,
      connectTimeoutMs: TEST_TIMEOUT_MS
    }),
    TypeError
  );

  const connector = createPinnedConnector({
    hostname: 'example.com',
    pinnedAddress: Object.freeze({ address: PUBLIC_TEST_ADDRESS, family: 4 }),
    port: 443,
    connectTimeoutMs: TEST_TIMEOUT_MS
  });
  const error = await new Promise((resolveCallback) => {
    // 回调: 偏离端口必须同步进入错误回调，不能创建真实公网 socket。
    connector({ hostname: 'example.com', protocol: 'https:', port: '8443' }, (connectorError) => {
      resolveCallback(connectorError);
    });
  });

  assertProxyErrorCode(error, 'PROXY_TARGET_FORBIDDEN');
  assert.equal(error.details.reason, 'connection_port_changed');
});

// DNS 不变量: 同一 URL 连续解析必须采用本次 lookup 返回值，不能复用上一次安全快照。
test('目标解析器采用逐次变化的 DNS 结果且不跨请求缓存', async () => {
  const addresses = ['93.184.216.34', '93.184.216.35'];
  let lookupIndex = 0;
  const resolver = createTargetResolver({
    // 回调: 每次返回下一个公网地址；超过预期调用立即暴露测试失败。
    lookupAll: async () => [{ address: addresses.at(lookupIndex++), family: 4 }]
  });

  const first = await resolver.resolveTarget('https://example.com/data', new AbortController().signal);
  const second = await resolver.resolveTarget('https://example.com/data', new AbortController().signal);

  assert.equal(lookupIndex, 2);
  assert.equal(first.addresses[0].address, addresses[0]);
  assert.equal(second.addresses[0].address, addresses[1]);
  assert.notEqual(first, second);
});
