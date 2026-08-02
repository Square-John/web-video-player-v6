/*
  source-runtime-proxy.integration.test.js 模块说明

  - 文件职责:
      在独立 Fastify 子进程上验证 Runtime 显式 ProxyClient 注入和 A/B 模拟 Provider 完整请求响应链。
      测试通过 IPC 事件启动和关闭服务，不使用固定等待、真实公网、MockNetworkAdapter 回退或临时文件。

  - 导入库及文件汇总(10 条，内置 5 条，第三方 0 条，自定义 5 条):
      node:assert/strict#assert: 核对跨进程标准内容和健康结果。
      node:child_process#fork: 启动隔离 Fastify 测试子进程。
      node:events#once: 事件驱动等待子进程最终退出。
      node:test#test: 注册带资源清理的集成测试。
      node:url#fileURLToPath: 定位子进程夹具脚本。
      createSourceRuntime.js#createSourceRuntimeBundle: 创建显式注入代理适配器的 Runtime Bundle。
      proxyClient.js#createProxyClient: 创建真实 HTTP ProxyClient NetworkAdapter。
      source-repository-test-fixtures.js#mockSourceRepositorySeeds: 提供代理联调显式测试种子。
      createMockSourceProvider.js#createMockSourceProviderFactory: 提供代理联调显式 Mock 工厂。
      createMemorySourceRepositories.js#createMemorySourceRepositories: 创建代理联调独占 Repository。

  - 模块级常量:
      FIXTURE_PROCESS_FILE: string，跨进程 Fastify 夹具脚本绝对路径。
      FIXTURE_MESSAGE_TYPE: Readonly<object>，父进程接受和发送的 IPC 类型。
      SOURCE_IDS: ReadonlyArray<string>，A/B 协议核心模拟源身份。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createDataRequest(sourceId): 创建标准电影目录 SourceDataRequest。
      waitForFixtureMessage(child, expectedType): 事件驱动等待指定 IPC 消息。
      stopFixtureProcess(child): 发送关闭命令并等待子进程退出。

  - 模块级类:
      无

  - 对外导出:
      无；由 node --test 直接执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert Node 严格断言集合。
// 文件作用: 核对跨进程内容、健康、来源身份和子进程退出状态。
import assert from 'node:assert/strict';

// 导入来源: node:child_process。
// 导入内容: fork Node 子进程工厂。
// 文件作用: 通过 IPC 启动独立 Fastify 服务，避免进程内 inject 冒充跨进程联调。
import { fork } from 'node:child_process';

// 导入来源: node:events。
// 导入内容: once 单次事件 Promise 工具。
// 文件作用: 在发送关闭命令前建立 exit 等待，不使用轮询、sleep 或固定等待。
import { once } from 'node:events';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册单一跨进程 Runtime 联调并保证 finally 清理。
import test from 'node:test';

// 导入来源: node:url。
// 导入内容: fileURLToPath URL 到路径转换函数。
// 文件作用: 从当前测试模块稳定定位子进程夹具文件。
import { fileURLToPath } from 'node:url';

// 导入来源: ../src/runtime/createSourceRuntime.js。
// 导入内容: createSourceRuntimeBundle 唯一 Runtime 组合工厂。
// 文件作用: 注入真实 ProxyClient 并通过正式 Host/Provider 门面执行内容请求。
import { createSourceRuntimeBundle } from '../src/runtime/createSourceRuntime.js';

// 导入来源: ../src/runtime/source-network/proxyClient.js。
// 导入内容: createProxyClient 前端代理客户端工厂。
// 文件作用: 使用子进程 baseUrl 创建 Runtime 唯一 NetworkAdapter。
import { createProxyClient } from '../src/runtime/source-network/proxyClient.js';

// 导入来源: ./source-repository-test-fixtures.js；导入内容: mockSourceRepositorySeeds；文件作用: 为 A/B 代理联调提供测试专用保存图。
import { mockSourceRepositorySeeds } from './source-repository-test-fixtures.js';

// 导入来源: ../src/data/providers/createMockSourceProvider.js；导入内容: createMockSourceProviderFactory；文件作用: 显式注入 A/B 测试工厂。
import { createMockSourceProviderFactory } from '../src/data/providers/createMockSourceProvider.js';

// 导入来源: ../src/repositories/source/createMemorySourceRepositories.js；导入内容: createMemorySourceRepositories；文件作用: 创建代理联调独占三仓和 UnitOfWork。
import { createMemorySourceRepositories } from '../src/repositories/source/createMemorySourceRepositories.js';

// 类型: string；来源: 当前测试模块相对 URL；作用: fork 唯一跨进程 Fastify 夹具入口。
const FIXTURE_PROCESS_FILE = fileURLToPath(new URL('./helpers/proxyRuntimeServer.fixture.js', import.meta.url));

// 类型: Readonly<object>；来源: 测试父子进程协议；作用: 只采用 ready/failed/closed 并发送 close。
const FIXTURE_MESSAGE_TYPE = Object.freeze({
  ready: 'ready',
  close: 'close',
  closed: 'closed',
  failed: 'failed'
});

// 类型: ReadonlyArray<string>；来源: 受审 A/B 模拟 Provider 定义；作用: 证明两套原始解析规则都经过同一 ProxyClient。
const SOURCE_IDS = Object.freeze(['system-source-1', 'system-source-2']);

/**
 * 创建标准电影目录数据请求。
 * 纯函数: 每次返回新对象和 params，不共享可变引用。
 *
 * @param {string} sourceId 当前 A/B 数据源身份。
 * @returns {object} SourceDataRequest。
 */
function createDataRequest(sourceId) {
  return {
    sourceId,
    pageKey: 'movie',
    moduleKey: '',
    params: {
      page: 1,
      pageSize: 20,
      keyword: '',
      category: '',
      genre: '',
      area: '',
      year: '',
      sort: '',
      contentId: '',
      episodeId: ''
    }
  };
}

/**
 * 事件驱动等待子进程指定 IPC 消息。
 * 副作用: 临时注册 message/error/exit 监听并在任一结算路径全部移除。
 * 成功路径: 收到 expectedType 时返回消息对象。
 * 失败路径: failed 消息、进程错误或目标消息前退出时 reject，不轮询或 sleep。
 *
 * @param {import('node:child_process').ChildProcess} child 当前夹具子进程。
 * @param {string} expectedType 期望 IPC 消息类型。
 * @returns {Promise<object>} 指定类型消息。
 */
function waitForFixtureMessage(child, expectedType) {
  return new Promise((resolve, reject) => {
    /**
     * 移除当前等待注册的全部监听器。
     * 副作用: 只修改 child 当前三个事件监听集合。
     * 成功路径: 可重复调用且不影响其他测试监听器。
     * 失败路径: 无；removeListener 对不存在回调幂等。
     *
     * @returns {void} 清理完成不返回业务值。
     */
    function cleanup() {
      child.removeListener('message', handleMessage);
      child.removeListener('error', handleError);
      child.removeListener('exit', handleExit);
    }

    /**
     * 采用指定 IPC 消息或收敛子进程失败消息。
     * 副作用: 命中结算消息时移除当前等待监听器。
     * 成功路径: expectedType 消息 resolve。
     * 失败路径: failed 消息 reject 最小错误说明，其他消息继续等待。
     *
     * @param {*} message 子进程 IPC 消息候选。
     * @returns {void} 结果通过 Promise 结算表达。
     */
    function handleMessage(message) {
      // 条件分支: 子进程报告固定 failed 类型时进入。
      // 执行内容: 清理监听并 reject，不等待进程超时。
      if (message?.type === FIXTURE_MESSAGE_TYPE.failed) {
        cleanup();
        reject(new Error(message.message || 'proxy runtime fixture failed'));
        return;
      }

      // 条件分支: 消息类型等于当前等待目标时进入。
      // 执行内容: 清理监听并 resolve 完整结构化消息。
      if (message?.type === expectedType) {
        cleanup();
        resolve(message);
      }
    }

    /**
     * 收敛 child_process 自身错误。
     * 副作用: 清理当前等待监听器并 reject。
     * 成功路径: 无；只处理失败。
     * 失败路径: 原 Error 作为 Promise 拒绝原因。
     *
     * @param {Error} error 子进程创建或 IPC 错误。
     * @returns {void} 结果通过 Promise reject 表达。
     */
    function handleError(error) {
      cleanup();
      reject(error);
    }

    /**
     * 收敛目标消息前的子进程退出。
     * 副作用: 清理当前等待监听器并 reject。
     * 成功路径: 无；等待消息期间退出始终是失败。
     * 失败路径: 生成含退出码和信号的 Error。
     *
     * @param {number|null} code 子进程退出码。
     * @param {string|null} signal 子进程终止信号。
     * @returns {void} 结果通过 Promise reject 表达。
     */
    function handleExit(code, signal) {
      cleanup();
      reject(new Error(`proxy runtime fixture 提前退出: code=${code}, signal=${signal}`));
    }

    child.on('message', handleMessage);
    child.once('error', handleError);
    child.once('exit', handleExit);
  });
}

/**
 * 关闭 Fastify 夹具并等待子进程退出。
 * 副作用: 通过 IPC 发送一次 close；无 IPC 时终止孤立子进程，随后等待 exit 事件。
 * 成功路径: 子进程正常退出码为 0。
 * 失败路径: 非零退出码由断言抛出；已经退出时直接核对现有 exitCode。
 *
 * @param {import('node:child_process').ChildProcess} child 当前夹具子进程。
 * @returns {Promise<void>} 子进程资源全部释放后完成。
 */
async function stopFixtureProcess(child) {
  // 条件分支: 子进程已经退出时进入。
  // 执行内容: 直接核对退出码，不再发送 IPC 或等待第二个事件。
  if (child.exitCode !== null) {
    assert.equal(child.exitCode, 0);
    return;
  }

  // 类型: Promise<Array<number|null|string|null>>；作用: 在发送 close 前建立 exit 等待，确保进程资源真正释放。
  const exitPromise = once(child, 'exit');

  // 条件分支: IPC 仍连接时进入。
  // 执行内容: 请求子进程幂等关闭 Fastify；断开时发送终止信号避免孤立进程。
  if (child.connected) {
    // 类型: Promise<object>；作用: 在发送 close 前建立 closed 消息等待，避免极快关闭造成事件丢失。
    const closedMessagePromise = waitForFixtureMessage(child, FIXTURE_MESSAGE_TYPE.closed);
    child.send({ type: FIXTURE_MESSAGE_TYPE.close });
    await closedMessagePromise;
  } else {
    child.kill();
  }

  // 类型: Array<number|null|string|null>；作用: 保存最终退出码和信号供资源关闭断言。
  const [code, signal] = await exitPromise;
  assert.equal(signal, null);
  assert.equal(code, 0);
}

// 跨进程不变量: A/B Provider 都必须经过 ProxyClient 与 Fastify HTTP 返回原始响应，再由现有解析器形成标准对象。
test('Runtime 通过 ProxyClient 和后端子进程完成 A/B 模拟源联调', async () => {
  // 类型: ChildProcess；作用: 保存独立 Fastify 夹具进程，stdio 不继承且只通过 IPC 协调。
  const child = fork(FIXTURE_PROCESS_FILE, [], {
    stdio: ['ignore', 'ignore', 'pipe', 'ipc']
  });
  // 类型: string；作用: 收集子进程最小 stderr，失败时提供断言上下文且不写临时日志。
  let childStderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    childStderr += chunk;
  });

  // 类型: object|null；作用: 保存创建后的 Runtime 门面，finally 只释放真实启动过的 Provider。
  let runtime = null;
  try {
    // 类型: object；作用: 保存子进程报告的随机回环 baseUrl。
    const readyMessage = await waitForFixtureMessage(child, FIXTURE_MESSAGE_TYPE.ready);
    assert.equal(typeof readyMessage.baseUrl, 'string');

    // 类型: Readonly<object>；作用: 保存只连接当前子进程的真实 ProxyClient NetworkAdapter。
    const networkAdapter = createProxyClient({ baseUrl: readyMessage.baseUrl });
    // 类型: object；作用: 为当前跨进程 Runtime 显式创建独占 Memory Repository 基础设施。
    const repositories = createMemorySourceRepositories(structuredClone(mockSourceRepositorySeeds));
    // 类型: ReadonlyArray<object>；作用: 代理联调 Runtime 只注册当前 A/B 测试所需的冻结 Mock 工厂。
    const trustedProviderFactories = Object.freeze([createMockSourceProviderFactory()]);
    // 类型: Readonly<object>；作用: 创建显式代理依赖的唯一 Runtime Bundle 内容门面。
    runtime = createSourceRuntimeBundle({
      networkAdapter,
      repositories,
      trustedProviderFactories,
      activeSourceId: mockSourceRepositorySeeds.preferences.defaultSourceId
    }).sourceRuntime;
    await runtime.initialize();

    // 类型: Array<object>；作用: 并发保存 A/B Provider 经后端返回并清洗的电影目录响应。
    const responses = await Promise.all(SOURCE_IDS.map(sourceId => (
      runtime.fetchData(createDataRequest(sourceId))
    )));
    // 类型: Array<object>；作用: 保存同一两个 Provider 经代理健康路由返回的标准结果。
    const healthResults = await Promise.all(SOURCE_IDS.map(sourceId => runtime.checkHealth(sourceId)));

    assert.deepEqual(responses.map(response => response.sourceId), SOURCE_IDS);
    assert.equal(responses.every(response => response.items.length > 0), true);
    assert.notEqual(responses[0].items[0].title, responses[1].items[0].title);
    // 断言作用: 两个 Provider 都把各自原始健康协议清洗为既有健康契约，不向结果临时扩张 sourceId 或 status 别名。
    assert.equal(healthResults.every(result => result.healthStatus === 'normal'), true);
    assert.equal(healthResults.every(result => result.unavailableReason === ''), true);
    assert.equal(healthResults.every(result => !Object.hasOwn(result, 'sourceId')), true);
    assert.equal(healthResults.every(result => !Object.hasOwn(result, 'status')), true);
    assert.equal(childStderr, '');
  } finally {
    // 资源清理: 先释放已启动 Provider/Host，再关闭 Fastify 子进程；任一测试失败也不留下监听服务。
    // 条件分支: Runtime 已创建且可能持有 Provider/Host 生命周期时进入。
    // 执行内容: 释放 A/B 实例后再关闭后端，避免在途清理面对已断开的代理进程。
    if (runtime) {
      await Promise.all(SOURCE_IDS.map(sourceId => runtime.disposeSource(sourceId)));
    }
    await stopFixtureProcess(child);
  }
});
