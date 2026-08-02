/*
  mock-network-adapter.test.js 模块说明

  - 文件职责:
      验证 MockNetworkAdapter 精确双源路由、响应类型、引用隔离、超限、中止和损坏 fixture 边界。

  - 导入库及文件汇总(5 条，内置 2 条，第三方 0 条，自定义 3 条):
      assert: 内置模块，执行响应、错误和引用隔离断言。
      test: 内置模块，注册 Node 领域测试。
      Shell config: 自定义配置，创建标准方法和响应类型请求。
      Shell errors: 自定义错误，验证 notFound、limit、aborted、fixture 和 validation。
      createMockNetworkAdapter: 自定义 Adapter 工厂，被测对象。

  - 模块级常量:
      MOCK_NETWORK_TEST_TIMEOUT: number，标准测试超时。
      MOCK_NETWORK_TEST_MAX_BYTES: number，标准测试响应上限。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createRequest(sourceId, url, overrides): Function，创建完整标准网络请求。
      createFixture(overrides): Function，创建可注入测试 fixture。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言对象。
// 文件作用: 比较双源响应、类型转换、错误和引用隔离。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册 MockNetworkAdapter 领域测试。
import test from 'node:test';

import {
  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_METHOD 标准网络方法。
  // 文件作用: 创建精确 GET 请求和损坏方法 fixture。
  SOURCE_NETWORK_METHOD,

} from '../src/runtime/source-shell/source-shell.config.js';

import {
  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellAbortedError 中止错误。
  // 文件作用: 验证 Adapter 不采用 aborted 请求。
  SourceShellAbortedError,

  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellFixtureError 夹具错误。
  // 文件作用: 验证损坏、重复和无法解析 JSON fixture。
  SourceShellFixtureError,

  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellLimitError 响应超限错误。
  // 文件作用: 验证 maxResponseBytes 门禁。
  SourceShellLimitError,

  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellNotFoundError 精确路由未命中错误。
  // 文件作用: 验证未知 URL 和跨源请求不回退。
  SourceShellNotFoundError,

  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellValidationError Adapter 构造和请求输入错误。
  // 文件作用: 验证未知 options 和伪造 signal。
  SourceShellValidationError
} from '../src/runtime/source-shell/sourceShellErrors.js';

// 导入来源: ../src/runtime/source-shell/mockNetworkAdapter.js。
// 导入内容: createMockNetworkAdapter 模拟网络工厂。
// 文件作用: 创建默认和注入 fixture 的被测 Adapter。
import { createMockNetworkAdapter } from '../src/runtime/source-shell/mockNetworkAdapter.js';

// 类型: number。
// 作用: 所有标准测试请求使用的合法 timeout 毫秒数。
const MOCK_NETWORK_TEST_TIMEOUT = 5000;

// 类型: number。
// 作用: 标准成功请求允许 1 MiB 响应，超限测试单独覆盖。
const MOCK_NETWORK_TEST_MAX_BYTES = 1048576;

/**
 * 创建完整 SourceNetworkRequest。
 * 纯函数: 返回新对象和新 headers，不修改 overrides。
 *
 * @param {string} sourceId 请求数据源 id。
 * @param {string} url 精确模拟路由 URL。
 * @param {object} overrides 需要覆盖的请求字段。
 * @returns {object} 完整网络请求候选。
 * @returns {string} return.sourceId 当前请求所属数据源身份，用于 Context 绑定校验。
 * @returns {string} return.requestId 请求和响应关联标识。
 * @returns {string} return.url 精确模拟路由绝对地址。
 * @returns {string} return.method 标准 GET/POST 方法。
 * @returns {Array<object>} return.headers 有序多值请求头数组。
 * @returns {object} return.body 原始请求体运输描述。
 * @returns {number} return.timeout 请求超时策略输入。
 * @returns {number} return.maxResponseBytes 调用方允许采用的响应体字节上限。
 */
function createRequest(sourceId, url, overrides = {}) {
  return {
    // 类型: string。
    // 作用: 把测试调用方指定的数据源身份交给请求侧绑定和 Adapter 精确路由校验。
    sourceId,

    // 类型: string。
    // 作用: 为当前测试请求生成稳定关联标识，供响应 requestId 断言使用。
    requestId: `${sourceId}-request`,

    // 类型: string。
    // 作用: 保存当前用例准备命中的精确 HTTPS 模拟地址。
    url,

    // 类型: string。
    // 作用: 默认使用冻结 GET 方法，非法方法用例通过 overrides 显式替换。
    method: SOURCE_NETWORK_METHOD.get,

    // 类型: object。
    // 作用: 默认不携带请求头，保持测试只聚焦 Adapter 响应边界。
    headers: [],

    // 类型: object。
    // 作用: 满足 GET 请求的 none/null 原始正文契约。
    body: { encoding: 'none', data: null },

    // 类型: number。
    // 作用: 提供集中策略范围内的合法请求超时值。
    timeout: MOCK_NETWORK_TEST_TIMEOUT,

    // 类型: number。
    // 作用: 提供标准成功响应上限，超限用例通过 overrides 缩小该值。
    maxResponseBytes: MOCK_NETWORK_TEST_MAX_BYTES,

    // 展开来源: 当前测试用例传入的局部覆盖字段。
    // 作用: 只改变目标用例需要的请求差异，保持其余契约字段完整。
    ...overrides
  };
}

/**
 * 创建完整可注入模拟响应夹具。
 * 纯函数: 返回新对象、headers 和 body，不修改 overrides。
 *
 * @param {object} overrides 需要覆盖的 fixture 字段。
 * @returns {object} 完整 fixture 候选。
 * @returns {string} return.sourceId fixture 所属数据源身份。
 * @returns {string} return.method 精确路由网络方法。
 * @returns {string} return.url 精确路由绝对地址。
 * @returns {number} return.status 模拟 HTTP 状态码。
 * @returns {string} return.statusText 模拟状态说明。
 * @returns {object} return.headers 模拟响应头。
 * @returns {*} return.body 模拟源站原始响应体。
 * @returns {string} return.responseUrl Provider 最终可见响应地址。
 */
function createFixture(overrides = {}) {
  return {
    // 类型: string。
    // 作用: 默认绑定独立测试数据源，不与正式 系统数据源1/系统数据源2 路由混用。
    sourceId: 'fixture-source',

    // 类型: string。
    // 作用: 默认建立冻结 GET 路由，非法方法用例通过 overrides 替换。
    method: SOURCE_NETWORK_METHOD.get,

    // 类型: string。
    // 作用: 默认精确测试路由地址，重复和解析失败用例按需覆盖。
    url: 'https://fixture.local/content',

    // 类型: number。
    // 作用: 默认模拟成功状态，非法状态码用例按需覆盖。
    status: 200,

    // 类型: string。
    // 作用: 提供非空成功状态说明，满足响应契约。
    statusText: 'OK',

    // 类型: object。
    // 作用: 声明默认 body 为 JSON，供响应转换路径读取。
    headers: { 'content-type': 'application/json' },

    // 类型: object。
    // 作用: 提供可隔离的严格 JSON Value 原始响应体。
    body: { value: 'fixture' },

    // 类型: string。
    // 作用: 默认表示没有重定向，和路由地址保持一致。
    responseUrl: 'https://fixture.local/content',

    // 展开来源: 当前测试用例传入的局部 fixture 覆盖字段。
    // 作用: 构造单一损坏条件或替换路由，同时保留其他合法字段。
    ...overrides
  };
}

// 测试目的: 默认 Adapter 必须按 sourceId + method + URL 返回内容可区分的 系统数据源1 和 系统数据源2 原始 JSON。
test('MockNetworkAdapter 精确路由双源可区分 JSON 响应', async () => {
  // 类型: object。
  // 作用: 创建使用正式默认 fixture 的 Adapter。
  const adapter = createMockNetworkAdapter();

  // 类型: AbortController。
  // 作用: 为两次合法请求提供未中止 signal。
  const controller = new AbortController();

  // 类型: object。
  // 作用: 保存 系统数据源1 原始网络响应。
  const firstResponse = await adapter.request(createRequest(
    'system-source-1',
    'https://mock-source.local/system-source-1/catalog'
  ), controller.signal);

  // 类型: object。
  // 作用: 保存 系统数据源2 原始网络响应。
  const secondResponse = await adapter.request(createRequest(
    'system-source-2',
    'https://mock-source.local/system-source-2/catalog'
  ), controller.signal);

  // 类型: object；作用: Provider 侧解码两条源各自的原始 JSON 字节。
  const firstBody = JSON.parse(new TextDecoder().decode(firstResponse.body));
  // 类型: object；作用: 解码第二条源原始 JSON 字节，核对跨源响应没有串线。
  const secondBody = JSON.parse(new TextDecoder().decode(secondResponse.body));

  // 断言作用: 两个 sourceId 命中各自原始数据结构，且响应身份和冻结边界保持稳定。
  assert.equal(firstBody.site.id, 'system-source-1');
  assert.equal(firstBody.entries[0].contentKey, 'system-source-1-movie-001');
  assert.equal(secondBody.station.key, 'system-source-2');
  assert.equal(secondBody.data.videos[0].vod_id, 'system-source-2-movie-101');
  assert.equal(firstResponse.requestId, 'system-source-1-request');
  assert.equal(Object.isFrozen(firstResponse), true);
  assert.equal(Object.isFrozen(firstResponse.headers), true);
});

// 测试目的: 同一原始 JSON fixture 必须始终交付原始 ArrayBuffer，由 Provider 决定解码。
test('MockNetworkAdapter 只返回原始 ArrayBuffer', async () => {
  // 类型: object。
  // 作用: 创建默认 Adapter 和未中止 signal。
  const adapter = createMockNetworkAdapter();

  // 类型: AbortController。
  // 作用: 提供合法生命周期信号。
  const controller = new AbortController();

  // 类型: object；作用: 保存固定原始字节响应。
  const response = await adapter.request(createRequest(
    'system-source-1',
    'https://mock-source.local/system-source-1/health',
  ), controller.signal);

  // 类型: object；作用: Provider 侧才把原始字节还原为 A 协议健康对象。
  const parsedBody = JSON.parse(new TextDecoder().decode(response.body));

  // 断言作用: Mock 与真实 ProxyClient 都只交付 ArrayBuffer，业务解析不在 Adapter 发生。
  assert.equal(parsedBody.service.source, 'system-source-1');
  assert.ok(response.body instanceof ArrayBuffer);
});

// 测试目的: 返回 JSON、headers 和 ArrayBuffer 必须与 Adapter 私有 fixture 索引和后续响应隔离。
test('MockNetworkAdapter 隔离响应头和 body 引用', async () => {
  // 类型: object。
  // 作用: 创建默认 Adapter 和 signal。
  const adapter = createMockNetworkAdapter();

  // 类型: AbortController。
  // 作用: 提供合法生命周期信号。
  const controller = new AbortController();

  // 类型: object。
  // 作用: 保存首次 JSON 响应供调用方篡改。
  const firstResponse = await adapter.request(createRequest(
    'system-source-1',
    'https://mock-source.local/system-source-1/catalog'
  ), controller.signal);

  // 副作用范围: 只修改调用方持有的 ArrayBuffer 字节和 headers 修改尝试。
  new Uint8Array(firstResponse.body)[0] = 0;

  // 断言作用: 冻结响应头拒绝调用方覆盖，不允许污染 Adapter 私有索引。
  assert.throws(() => {
    firstResponse.headers[0].value = 'changed';
  }, TypeError);

  // 类型: object。
  // 作用: 再次请求证明 Adapter 私有索引没有被首次响应污染。
  const secondResponse = await adapter.request(createRequest(
    'system-source-1',
    'https://mock-source.local/system-source-1/catalog'
  ), controller.signal);

  // 类型: object；作用: Provider 侧解码第二次独立响应，验证首次字节修改没有污染 Adapter 索引。
  const secondBody = JSON.parse(new TextDecoder().decode(secondResponse.body));
  // 断言作用: 第二次响应仍返回原始 fixture 值，证明原始字节和有序头均与前次调用隔离。
  assert.equal(secondBody.entries[0].headline, '雾港回声');
  assert.deepEqual(secondResponse.headers[0], { name: 'content-type', value: 'application/json; charset=utf-8' });
});

// 测试目的: 未知 URL、跨源 URL 和响应字节超限必须稳定失败，不能回退到其他路由或真实网络。
test('MockNetworkAdapter 拒绝未知跨源路由和响应超限', async () => {
  // 类型: object。
  // 作用: 创建默认 Adapter 和 signal。
  const adapter = createMockNetworkAdapter();

  // 类型: AbortController。
  // 作用: 提供合法生命周期信号。
  const controller = new AbortController();

  // 断言作用: 未知地址、跨源地址和响应超限分别返回稳定 notFound/limit，均不得回退真实网络。
  await assert.rejects(adapter.request(createRequest(
    'system-source-1',
    'https://mock-source.local/system-source-1/missing'
  ), controller.signal), SourceShellNotFoundError);
  await assert.rejects(adapter.request(createRequest(
    'system-source-2',
    'https://mock-source.local/system-source-1/catalog'
  ), controller.signal), SourceShellNotFoundError);
  await assert.rejects(adapter.request(createRequest(
    'system-source-1',
    'https://mock-source.local/system-source-1/health',
    { maxResponseBytes: 1 }
  ), controller.signal), SourceShellLimitError);
});

// 测试目的: Adapter 必须拒绝伪造或已中止 signal，且 request 只接受两个精确参数。
test('MockNetworkAdapter 遵守 AbortSignal 和精确调用参数', async () => {
  // 类型: object。
  // 作用: 创建默认 Adapter 和标准请求。
  const adapter = createMockNetworkAdapter();

  // 类型: object。
  // 作用: 保存合法 系统数据源1 请求供三种 signal/参数路径复用。
  const request = createRequest('system-source-1', 'https://mock-source.local/system-source-1/catalog');

  // 断言作用: 普通对象不能伪装 AbortSignal，Adapter 在读取 fixture 前返回 validation。
  await assert.rejects(adapter.request(request, { aborted: false }), SourceShellValidationError);

  // 类型: AbortController。
  // 作用: 创建并立即中止，Adapter 不得读取或返回 fixture。
  const controller = new AbortController();
  controller.abort();

  // 断言作用: 已中止生命周期返回 aborted；额外第三个参数返回 validation，不能被静默忽略。
  await assert.rejects(adapter.request(request, controller.signal), SourceShellAbortedError);
  await assert.rejects(adapter.request(request, controller.signal, 'extra'), SourceShellValidationError);
});

// 测试目的: Adapter 构造阶段必须拒绝未知 options、非数组、非法身份/方法/URL、重复路由和损坏 fixture。
test('MockNetworkAdapter 构造阶段拒绝损坏 fixture', () => {
  // 断言作用: 非普通 options 和非数组 fixtureRoutes 必须归类为调用参数 validation，不能创建空索引。
  assert.throws(() => createMockNetworkAdapter({ unknown: true }), SourceShellValidationError);
  assert.throws(() => createMockNetworkAdapter({ fixtureRoutes: {} }), SourceShellValidationError);

  // 类型: object。
  // 作用: 保存合法基础 fixture，重复和损坏场景从该对象派生。
  const fixture = createFixture();

  // 断言作用: 完全相同的 sourceId、method 和 URL 组合不能后写覆盖已有路由。
  assert.throws(() => createMockNetworkAdapter({
    fixtureRoutes: [fixture, { ...fixture }]
  }), SourceShellFixtureError);

  // 断言作用: fixture sourceId 必须复用 Shell 安全动态键规则，原型敏感身份不能进入私有 Map 路由。
  assert.throws(() => createMockNetworkAdapter({
    fixtureRoutes: [{ ...fixture, sourceId: '__proto__' }]
  }), SourceShellFixtureError);

  // 断言作用: fixture method 必须属于请求侧同一 GET/POST 枚举，不能建立请求契约无法合法命中的路由。
  assert.throws(() => createMockNetworkAdapter({
    fixtureRoutes: [{ ...fixture, method: 'DELETE' }]
  }), SourceShellFixtureError);

  // 断言作用: 路由 URL 和响应 URL 都不能嵌入用户名或密码，避免凭据进入路由键或 Provider 可见响应地址。
  assert.throws(() => createMockNetworkAdapter({
    fixtureRoutes: [{ ...fixture, url: 'https://user:secret@fixture.local/content' }]
  }), SourceShellFixtureError);
  assert.throws(() => createMockNetworkAdapter({
    fixtureRoutes: [{ ...fixture, responseUrl: 'https://user:secret@fixture.local/content' }]
  }), SourceShellFixtureError);

  // 断言作用: 非标准状态码、额外字段和非字符串响应头必须在构造阶段稳定归类为 fixture 错误。
  assert.throws(() => createMockNetworkAdapter({
    fixtureRoutes: [{ ...fixture, status: 700 }]
  }), SourceShellFixtureError);
  assert.throws(() => createMockNetworkAdapter({
    fixtureRoutes: [{ ...fixture, extra: true }]
  }), SourceShellFixtureError);
  assert.throws(() => createMockNetworkAdapter({
    fixtureRoutes: [{ ...fixture, headers: { Accept: 1 } }]
  }), SourceShellFixtureError);
});

// 测试目的: JSON 文本 fixture 无法解析时必须在请求阶段返回 fixture 错误并保留 Adapter 后续可用性。
test('MockNetworkAdapter 交付非法 JSON 原始字节且同实例后续路由仍可用', async () => {
  // 类型: object。
  // 作用: 创建一条非法 JSON 原始路由和一条合法 JSON 对象路由。
  const adapter = createMockNetworkAdapter({
    fixtureRoutes: [
      createFixture({
        url: 'https://fixture.local/invalid-json',
        responseUrl: 'https://fixture.local/invalid-json',
        body: '{invalid'
      }),
      createFixture({
        url: 'https://fixture.local/valid-json',
        responseUrl: 'https://fixture.local/valid-json'
      })
    ]
  });

  // 类型: AbortController。
  // 作用: 两次请求共享未中止 signal，失败不应改变生命周期。
  const controller = new AbortController();

  // 类型: object；作用: 保存 Provider 尚未解析的非法 JSON 原始响应。
  const invalidResponse = await adapter.request(createRequest(
    'fixture-source',
    'https://fixture.local/invalid-json'
  ), controller.signal);
  // 断言作用: Adapter 不能解释业务 JSON，非法文本必须原样交给 Provider。
  assert.equal(new TextDecoder().decode(invalidResponse.body), '{invalid');

  // 类型: object。
  // 作用: 保存失败后的合法路由响应，证明 Adapter 没有中毒状态。
  const response = await adapter.request(createRequest(
    'fixture-source',
    'https://fixture.local/valid-json'
  ), controller.signal);

  // 断言作用: 同一 Adapter 在一次转换失败后仍能命中其他合法路由，证明没有中毒状态。
  assert.deepEqual(JSON.parse(new TextDecoder().decode(response.body)), { value: 'fixture' });
});
