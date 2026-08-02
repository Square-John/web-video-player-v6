/*
  proxy-security-policy.test.js 模块说明

  - 文件职责:
      验证 IP 公网单播、DNS 全结果、初始/重定向 URL、代理头裁剪以及无等待准入的纯安全边界。
      测试只使用内存地址和注入解析端口，不建立 TLS、不监听端口，也不访问真实 DNS 或公网。

  - 导入库及文件汇总(8 条，内置 2 条，第三方 0 条，自定义 6 条):
      node:assert/strict: 核对冻结结果、地址分类、头顺序和错误码。
      node:test#test: 注册相互隔离的纯安全策略用例。
      ../src/errors/proxyError.js#ProxyError: 验证失败使用冻结领域错误而非文案匹配。
      ../src/network/proxyHeaders.js: 验证请求控制头、跨 origin 凭证和重复响应头语义。
      ../src/proxy/requestAdmissionGate.js#createRequestAdmissionGate: 验证并发、速率和窗口释放。
      ../src/security/ipAddressPolicy.js: 验证 IPv4、IPv6、映射地址和云元数据分类。
      ../src/security/targetResolver.js 与 targetUrlPolicy.js: 验证每跳 DNS 全结果和共享 URL 规则。

  - 模块级常量:
      BLOCKED_ADDRESS_CASES: ReadonlyArray<string>，必须失败关闭的特殊和元数据地址样例。
      TEST_LIMITS: Readonly<object>，URL 和响应头纯策略测试使用的受限配置。
      ONE_MINUTE_MS: number，准入窗口推进使用的明确时间单位。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertProxyErrorCode(error, code): 核对固定 ProxyError 类型和错误码。

  - 模块级类:
      无

  - 对外导出:
      无；由 node --test 直接执行。
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证纯安全策略结果和固定错误码。
import assert from 'node:assert/strict';
// 导入来源: node:test；导入内容: test；文件作用: 注册同步与异步安全边界用例。
import test from 'node:test';
// 导入来源: ../src/errors/proxyError.js；导入内容: ProxyError；文件作用: 确认安全失败进入冻结领域错误。
import { ProxyError } from '../src/errors/proxyError.js';
// 导入来源: ../src/network/proxyHeaders.js；导入内容: sanitizeRequestHeaders、sanitizeResponseHeaders；文件作用: 验证双向代理头边界。
import { sanitizeRequestHeaders, sanitizeResponseHeaders } from '../src/network/proxyHeaders.js';
// 导入来源: ../src/proxy/requestAdmissionGate.js；导入内容: createRequestAdmissionGate；文件作用: 验证运行控制计数和无等待拒绝。
import { createRequestAdmissionGate } from '../src/proxy/requestAdmissionGate.js';
// 导入来源: ../src/security/ipAddressPolicy.js；导入内容: assertPublicIpAddress、normalizeIpAddress；文件作用: 验证地址归一与公网单播分类。
import { assertPublicIpAddress, normalizeIpAddress } from '../src/security/ipAddressPolicy.js';
// 导入来源: ../src/security/targetResolver.js；导入内容: createTargetResolver；文件作用: 使用注入 lookup 验证 DNS 全结果和无缓存调用。
import { createTargetResolver } from '../src/security/targetResolver.js';
// 导入来源: ../src/security/targetUrlPolicy.js；导入内容: normalizeInitialTargetUrl、resolveRedirectTargetUrl；文件作用: 验证初始和重定向共享 HTTPS 规则。
import { normalizeInitialTargetUrl, resolveRedirectTargetUrl } from '../src/security/targetUrlPolicy.js';

// 类型: ReadonlyArray<string>；来源: 公共协议 SSRF 禁止范围；作用: 覆盖环回、私网、链路本地、CGNAT、元数据、组播和映射绕过。
const BLOCKED_ADDRESS_CASES = Object.freeze([
  '127.0.0.1',
  '10.0.0.1',
  '169.254.169.254',
  '100.100.100.200',
  '168.63.129.16',
  '::1',
  'fc00::1',
  'fe80::1',
  'ff02::1',
  '::ffff:127.0.0.1'
]);

// 类型: Readonly<object>；来源: 生产策略字段形状；作用: 只给纯 URL 和响应头函数提供明确测试容量，不放宽生产配置。
const TEST_LIMITS = Object.freeze({
  targetUrlCharacters: 4096,
  responseHeaderCount: 8,
  responseHeaderNameCharacters: 64,
  responseHeaderValueBytes: 256
});

// 单位: 毫秒；来源: rateLimitRequestsPerMinute 的固定窗口单位；作用: 测试推进到下一准入窗口而不散落时间字面值。
const ONE_MINUTE_MS = 60000;

/**
 * 确认一个异常是指定固定代理错误。
 * 调用方: 本文件同步和异步断言回调。
 * 副作用: 无；只读取异常类型和 code。
 * 失败路径: 类型或 code 不一致时使用 assert 抛 AssertionError。
 *
 * @param {unknown} error 当前捕获异常。
 * @param {string} code 期望冻结错误码。
 * @returns {true} 供 assert.throws/assert.rejects 判定回调使用。
 */
function assertProxyErrorCode(error, code) {
  assert.equal(error instanceof ProxyError, true);
  assert.equal(error.code, code);
  return true;
}

// 地址不变量: 只有公网单播通过，IPv4 映射 IPv6 按内嵌 IPv4 分类，特殊与元数据地址全部失败关闭。
test('IP 策略只允许公网单播并阻止映射地址绕过', () => {
  assert.deepEqual(assertPublicIpAddress('93.184.216.34'), { address: '93.184.216.34', family: 4 });
  assert.deepEqual(assertPublicIpAddress('2606:2800:220:1:248:1893:25c8:1946'), {
    address: '2606:2800:220:1:248:1893:25c8:1946',
    family: 6
  });
  assert.equal(normalizeIpAddress('::ffff:93.184.216.34'), '93.184.216.34');

  for (const address of BLOCKED_ADDRESS_CASES) {
    assert.throws(() => assertPublicIpAddress(address), (error) => assertProxyErrorCode(error, 'PROXY_TARGET_FORBIDDEN'));
  }
});

// DNS 不变量: 每次调用重新查询且必须校验全部结果，公网与私网混合不能只选择公网项继续连接。
test('目标解析器逐次查询并拒绝混合公私网 DNS 结果', async () => {
  let lookupCount = 0;
  // 回调: 每次返回新数组证明解析器不缓存；第二个私网结果必须让整个目标失败。
  const mixedResolver = createTargetResolver({
    lookupAll: async () => {
      lookupCount += 1;
      return [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.1', family: 4 }
      ];
    }
  });

  await assert.rejects(
    () => mixedResolver.resolveTarget('https://example.com/data', new AbortController().signal),
    (error) => assertProxyErrorCode(error, 'PROXY_TARGET_FORBIDDEN')
  );
  assert.equal(lookupCount, 1);

  let safeLookupCount = 0;
  const safeResolver = createTargetResolver({
    // 回调: 同一地址重复出现只影响连接候选去重，不跳过任何记录的安全检查。
    lookupAll: async () => {
      safeLookupCount += 1;
      return [
        { address: '93.184.216.34', family: 4 },
        { address: '93.184.216.34', family: 4 }
      ];
    }
  });
  const first = await safeResolver.resolveTarget('https://example.com/data', new AbortController().signal);
  const second = await safeResolver.resolveTarget('https://example.com/data', new AbortController().signal);
  assert.equal(first.addresses.length, 1);
  assert.equal(Object.isFrozen(first.addresses), true);
  assert.notEqual(first, second);
  assert.equal(safeLookupCount, 2);
});

// URL 不变量: 初始绝对地址和相对 Location 共享 HTTPS、凭据、片段和长度规则，但使用各自固定错误码。
test('初始和重定向 URL 使用同一 HTTPS 安全规则', () => {
  assert.equal(normalizeInitialTargetUrl('https://example.com/a/../data', TEST_LIMITS), 'https://example.com/data');
  assert.equal(
    resolveRedirectTargetUrl('../next?value=1', 'https://example.com/a/current', TEST_LIMITS),
    'https://example.com/next?value=1'
  );
  assert.throws(
    () => normalizeInitialTargetUrl('http://example.com/data', TEST_LIMITS),
    (error) => assertProxyErrorCode(error, 'PROXY_VALIDATION_ERROR')
  );
  assert.throws(
    () => resolveRedirectTargetUrl('https://user:secret@example.com/data', 'https://example.com/', TEST_LIMITS),
    (error) => assertProxyErrorCode(error, 'PROXY_TARGET_FORBIDDEN')
  );
});

// 头边界: 控制头永不转发，跨 origin 删除凭证，响应重复头保持原序且 Connection 声明项被删除。
test('代理头策略裁剪控制字段并保留有序重复响应头', () => {
  const candidateHeaders = Object.freeze([
    Object.freeze({ name: 'host', value: 'forged.example' }),
    Object.freeze({ name: 'connection', value: 'x-hop' }),
    Object.freeze({ name: 'x-hop', value: 'remove-me' }),
    Object.freeze({ name: 'authorization', value: 'Bearer secret' }),
    Object.freeze({ name: 'cookie', value: 'session=secret' }),
    Object.freeze({ name: 'accept', value: 'application/json' }),
    Object.freeze({ name: 'accept', value: 'text/plain' })
  ]);
  const sameOriginHeaders = sanitizeRequestHeaders(candidateHeaders, { crossOrigin: false, hasBody: false });
  const crossOriginHeaders = sanitizeRequestHeaders(candidateHeaders, { crossOrigin: true, hasBody: false });

  assert.deepEqual(sameOriginHeaders, [
    { name: 'authorization', value: 'Bearer secret' },
    { name: 'cookie', value: 'session=secret' },
    { name: 'accept', value: 'application/json' },
    { name: 'accept', value: 'text/plain' }
  ]);
  assert.deepEqual(crossOriginHeaders, [
    { name: 'accept', value: 'application/json' },
    { name: 'accept', value: 'text/plain' }
  ]);

  const responseHeaders = sanitizeResponseHeaders([
    'content-type', 'application/json',
    'set-cookie', 'a=1',
    'connection', 'x-hop',
    'x-hop', 'remove-me',
    'set-cookie', 'b=2'
  ], TEST_LIMITS);
  assert.deepEqual(responseHeaders, [
    { name: 'content-type', value: 'application/json' },
    { name: 'set-cookie', value: 'a=1' },
    { name: 'set-cookie', value: 'b=2' }
  ]);
});

// 准入不变量: 并发和速率都立即拒绝，release 只归还并发额度，窗口到期才重置速率计数。
test('准入门禁不排队并正确释放并发与速率窗口', () => {
  let currentTime = 0;
  const gate = createRequestAdmissionGate({
    maximumConcurrentRequests: 1,
    maximumRequestsPerMinute: 2,
    now: () => currentTime
  });
  const releaseFirst = gate.enter();
  assert.throws(() => gate.enter(), (error) => assertProxyErrorCode(error, 'PROXY_RATE_LIMITED'));
  releaseFirst();
  releaseFirst();
  const releaseSecond = gate.enter();
  releaseSecond();
  assert.throws(() => gate.enter(), (error) => assertProxyErrorCode(error, 'PROXY_RATE_LIMITED'));

  currentTime = ONE_MINUTE_MS;
  const releaseNextWindow = gate.enter();
  releaseNextWindow();
});
