/*
  source-network-adapter.test.js 模块说明

  - 文件职责:
      验证网络适配器工厂只接受显式 mock/proxy 模式，并为两种模式创建统一冻结门面。
      证明 ProxyClient 传输失败不会改用 MockNetworkAdapter 或返回本地夹具。

  - 导入库及文件汇总(5 条，内置 2 条，第三方 0 条，自定义 3 条):
      node:assert/strict#assert: 核对模式、响应和稳定错误字段。
      node:test#test: 注册隔离网络适配器工厂测试。
      sourceNetwork.config.js#SOURCE_NETWORK_MODE: 使用生产冻结模式值。
      sourceNetworkAdapterFactory.js#createSourceNetworkAdapter: 被测显式模式工厂。
      proxyClientErrors.js#PROXY_CLIENT_ERROR_CODE: 断言代理传输失败分类。

  - 模块级常量:
      SOURCE_ID / REQUEST: Mock 与 Proxy 共用的标准 SourceNetworkRequest。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createProxySuccessEnvelope(): 创建与 REQUEST 对齐的成功代理外壳。
      createResponse(body): 创建最小成功 fetch Response stub。
      createUnknownModeAdapter(): 触发未知模式校验。
      createMockAdapterWithProxyOptions(): 触发模式组合校验。

  - 模块级类:
      无

  - 对外导出:
      无；由 node --test 直接执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert Node 严格断言集合。
// 文件作用: 核对适配器形状、响应字段、传输次数和错误分类。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册彼此隔离且不访问真实网络的模式工厂测试。
import test from 'node:test';

// 导入来源: ../src/runtime/source-network/sourceNetwork.config.js。
// 导入内容: SOURCE_NETWORK_MODE 冻结模式枚举。
// 文件作用: 测试不复制 mock/proxy 模式字符串决定工厂分支。
import { SOURCE_NETWORK_MODE } from '../src/runtime/source-network/sourceNetwork.config.js';

// 导入来源: ../src/runtime/source-network/sourceNetworkAdapterFactory.js。
// 导入内容: createSourceNetworkAdapter 显式模式工厂。
// 文件作用: 创建并验证 MockNetworkAdapter 或 ProxyClient 唯一实例。
import { createSourceNetworkAdapter } from '../src/runtime/source-network/sourceNetworkAdapterFactory.js';

// 导入来源: ../src/runtime/source-network/proxyClientErrors.js。
// 导入内容: PROXY_CLIENT_ERROR_CODE 稳定客户端错误分类。
// 文件作用: 证明 proxy 模式传输失败保持 network 且不回退本地夹具。
import { PROXY_CLIENT_ERROR_CODE } from '../src/runtime/source-network/proxyClientErrors.js';

// 类型: string；来源: 当前受审模拟 Provider 身份；作用: 命中 MockNetworkAdapter 的 系统数据源1 目录夹具。
const SOURCE_ID = 'system-source-1';
// 类型: Readonly<object>；来源: SourceNetworkRequest 契约；作用: 两个模式使用同一标准输入比较不同适配器行为。
const REQUEST = Object.freeze({
  sourceId: SOURCE_ID,
  requestId: 'source-network-adapter-request-001',
  url: 'https://mock-source.local/system-source-1/catalog',
  method: 'GET',
  headers: Object.freeze([]),
  body: Object.freeze({ encoding: 'none', data: null }),
  timeout: 5000,
  maxResponseBytes: 1048576
});

/**
 * 创建与标准请求对齐的成功代理外壳。
 * 纯函数: 每次返回新对象，不读取网络或修改 REQUEST。
 *
 * @returns {object} ProxyResponseEnvelope 2.0.0 候选。
 */
function createProxySuccessEnvelope() {
  return {
    protocolVersion: '2.0.0',
    requestId: REQUEST.requestId,
    upstream: {
      status: 200,
      statusText: 'OK',
      responseUrl: REQUEST.url,
      headers: [{ name: 'content-type', value: 'application/json' }]
    },
    body: { encoding: 'base64', data: 'eyJ0cmFuc3BvcnQiOiJwcm94eSJ9' },
    meta: { redirectCount: 0, receivedBytes: 21 }
  };
}

/**
 * 创建最小成功 fetch Response stub。
 * 纯函数: 返回只持有当前 body 的冻结对象，不访问网络。
 *
 * @param {*} body json() 返回值。
 * @returns {object} ProxyClient 可读取的 Response 形状。
 */
function createResponse(body) {
  /**
   * 返回当前 stub 捕获的 JSON 正文。
   * 纯函数: 不修改 body 或保存调用状态。
   * 成功路径: resolve 当前代理外壳。
   * 失败路径: 无；解析失败由其他 ProxyClient 测试覆盖。
   *
   * @returns {Promise<*>} 当前代理外壳。
   */
  async function readJsonBody() {
    return body;
  }

  return Object.freeze({ ok: true, status: 200, json: readJsonBody });
}

/**
 * 使用未知模式创建适配器。
 * 纯函数: 只触发同步模式校验，不创建网络依赖。
 *
 * @returns {Readonly<object>} 不应成功返回的适配器。
 * @throws {TypeError} 未知模式被工厂拒绝。
 */
function createUnknownModeAdapter() {
  return createSourceNetworkAdapter({ mode: 'automatic' });
}

/**
 * 使用 Mock 模式和代理选项创建适配器。
 * 纯函数: 只触发同步组合校验，不创建两个适配器。
 *
 * @returns {Readonly<object>} 不应成功返回的适配器。
 * @throws {TypeError} Mock 与 proxyClientOptions 组合被拒绝。
 */
function createMockAdapterWithProxyOptions() {
  return createSourceNetworkAdapter({
    mode: SOURCE_NETWORK_MODE.mock,
    proxyClientOptions: {}
  });
}

// 测试目的: 显式 Mock 模式只创建冻结 request 门面并命中受审本地响应夹具。
test('网络适配器工厂显式创建 MockNetworkAdapter', async () => {
  // 类型: Readonly<object>；作用: 保存显式 Mock 模式创建的独立适配器。
  const adapter = createSourceNetworkAdapter({ mode: SOURCE_NETWORK_MODE.mock });
  // 类型: Readonly<object>；作用: 保存 Mock 目录路由返回的 SourceNetworkResponse。
  const response = await adapter.request(REQUEST, new AbortController().signal);

  assert.deepEqual(Object.keys(adapter), ['request']);
  assert.equal(Object.isFrozen(adapter), true);
  assert.equal(response.requestId, REQUEST.requestId);
  assert.equal(JSON.parse(new TextDecoder().decode(response.body)).site.id, SOURCE_ID);
});

// 测试目的: 显式 Proxy 模式只调用注入 fetch，并把代理外壳转换为统一 SourceNetworkResponse。
test('网络适配器工厂显式创建 ProxyClient', async () => {
  // 类型: number；作用: 统计当前 ProxyClient 实际传输次数，预期严格为一次。
  let fetchCount = 0;
  /**
   * 返回确定性代理成功响应。
   * 副作用: 只递增当前测试局部 fetchCount，不访问真实网络。
   * 成功路径: 返回与 REQUEST 对齐的 Response stub。
   * 失败路径: 无；该用例只验证成功模式选择。
   *
   * @returns {Promise<object>} 成功 Response stub。
   */
  async function fetchProxyResponse() {
    fetchCount += 1;
    return createResponse(createProxySuccessEnvelope());
  }

  // 类型: Readonly<object>；作用: 保存显式 Proxy 模式创建的独立适配器。
  const adapter = createSourceNetworkAdapter({
    mode: SOURCE_NETWORK_MODE.proxy,
    proxyClientOptions: {
      baseUrl: 'http://127.0.0.1:3000',
      fetchImpl: fetchProxyResponse
    }
  });
  // 类型: Readonly<object>；作用: 保存 ProxyClient 转换后的 SourceNetworkResponse。
  const response = await adapter.request(REQUEST, new AbortController().signal);

  assert.equal(fetchCount, 1);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(response.body)), { transport: 'proxy' });
});

// 测试目的: Proxy 传输失败保持 network 错误，重复请求也不会读取 Mock 目录夹具。
test('ProxyClient 失败不会静默回退 MockNetworkAdapter', async () => {
  // 类型: number；作用: 统计失败传输次数，证明每次请求都仍走同一个 ProxyClient。
  let fetchCount = 0;
  /**
   * 模拟后端不可达。
   * 副作用: 递增当前测试局部 fetchCount 后抛确定性传输错误。
   * 成功路径: 无；该函数始终失败。
   * 失败路径: 每次调用抛 Error，由 ProxyClient 归一为 network。
   *
   * @returns {Promise<never>} 不会成功返回。
   * @throws {Error} 每次调用都抛出传输失败。
   */
  async function rejectProxyRequest() {
    fetchCount += 1;
    throw new Error('proxy unavailable');
  }

  // 类型: Readonly<object>；作用: 保存只持有失败 fetch 的 ProxyClient 适配器。
  const adapter = createSourceNetworkAdapter({
    mode: SOURCE_NETWORK_MODE.proxy,
    proxyClientOptions: {
      baseUrl: 'http://127.0.0.1:3000',
      fetchImpl: rejectProxyRequest
    }
  });

  await assert.rejects(
    adapter.request(REQUEST, new AbortController().signal),
    { code: PROXY_CLIENT_ERROR_CODE.network }
  );
  await assert.rejects(
    adapter.request(REQUEST, new AbortController().signal),
    { code: PROXY_CLIENT_ERROR_CODE.network }
  );
  assert.equal(fetchCount, 2);
});

// 测试目的: 未知模式和 Mock/Proxy 混合选项在创建阶段立即失败，不生成部分适配器。
test('网络适配器工厂拒绝未知模式和混合配置', () => {
  assert.throws(createUnknownModeAdapter, TypeError);
  assert.throws(createMockAdapterWithProxyOptions, TypeError);
});
