/*
  source-context.test.js 模块说明

  - 文件职责:
      验证 SourceContext 六字段冻结能力树和 network/storage/challenge/logger 的真实组合调用。
      验证跨源、signal 分裂、额外依赖、中止采用和构造后方法替换不能突破闭包边界。

  - 导入库及文件汇总(9 条，内置 2 条，第三方 0 条，自定义 7 条):
      assert: 内置模块，执行结构、响应、保存、日志和错误断言。
      test: 内置模块，注册 Node 领域测试。
      MemorySourceStorageRepository: 自定义 Repository，提供真实五分区保存权威。
      Shell config: 自定义配置，创建标准请求并断言挑战/日志状态。
      Shell errors: 自定义错误，验证跨源、中止和依赖 validation。
      createSourceContext: 自定义 Context 工厂，被测组合入口。
      createMockNetworkAdapter: 自定义模拟网络适配器，提供真实标准响应。
      createSourceChallengePort: 自定义挑战端口工厂，提供同源同 signal 占位能力。
      createSourceLoggerController: 自定义日志控制器工厂，提供 Provider 写入和 Host 读取能力。

  - 模块级常量:
      SOURCE_CONTEXT_TEST_SOURCE_ID: string，标准 Context 绑定数据源 id。
      SOURCE_CONTEXT_SECONDARY_SOURCE_ID: string，双源攻击复验使用的第二数据源 id。
      SOURCE_CONTEXT_PRIMARY_URL: string，系统数据源1 A 协议模拟目录精确路由。
      SOURCE_CONTEXT_SECONDARY_URL: string，系统数据源2 B 协议模拟目录精确路由。
      SOURCE_CONTEXT_SHARED_CACHE_KEY: string，双源私有空间隔离复验使用的同名缓存键。
      SOURCE_CONTEXT_TEST_TIMEOUT: number，标准请求超时毫秒数。
      SOURCE_CONTEXT_TEST_MAX_BYTES: number，标准响应采用上限。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createNetworkRequest(overrides): Function，创建完整 SourceNetworkRequest 候选。
      createChallenge(overrides): Function，创建完整 SourceChallenge 候选。
      createContextHarness(overrides): Function，创建真实 Adapter、Repository、端口、控制器和 Context 测试组合。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言对象。
// 文件作用: 比较 Context 结构、跨能力结果、冻结和错误边界。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册 SourceContext 组合领域测试。
import test from 'node:test';

// 导入来源: ../src/repositories/source/memorySourceStorageRepository.js。
// 导入内容: MemorySourceStorageRepository 五分区内存实现。
// 文件作用: 使用真实 Repository 证明 Context Storage 不保存影子状态。
import { MemorySourceStorageRepository } from '../src/repositories/source/memorySourceStorageRepository.js';

import {
  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_CHALLENGE_STATUS 挑战状态枚举。
  // 文件作用: 断言 Context challenge 返回 unsupported/cancelled。
  SOURCE_CHALLENGE_STATUS,

  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_LOG_LEVEL 日志级别枚举。
  // 文件作用: 断言 Context logger 写入 Host 可读 info 条目。
  SOURCE_LOG_LEVEL,

  // 导入来源: ../src/runtime/source-shell/source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_METHOD 网络方法枚举。
  // 文件作用: 创建标准 GET 模拟路由请求。
  SOURCE_NETWORK_METHOD,

} from '../src/runtime/source-shell/source-shell.config.js';

import {
  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellAbortedError 生命周期中止错误。
  // 文件作用: 验证 Context network 中止后拒绝采用响应。
  SourceShellAbortedError,

  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellValidationError Shell 输入错误。
  // 文件作用: 验证跨源、signal 分裂、依赖结构和额外参数拒绝。
  SourceShellValidationError
} from '../src/runtime/source-shell/sourceShellErrors.js';

// 导入来源: ../src/runtime/source-shell/createSourceContext.js。
// 导入内容: createSourceContext SourceContext 工厂。
// 文件作用: 创建被测六字段冻结 Provider 工具箱。
import { createSourceContext } from '../src/runtime/source-shell/createSourceContext.js';

// 导入来源: ../src/runtime/source-shell/mockNetworkAdapter.js。
// 导入内容: createMockNetworkAdapter 模拟网络工厂。
// 文件作用: 通过 Context network 返回真实 5C 标准响应。
import { createMockNetworkAdapter } from '../src/runtime/source-shell/mockNetworkAdapter.js';

// 导入来源: ../src/runtime/source-shell/sourceChallengePort.js。
// 导入内容: createSourceChallengePort 挑战端口工厂。
// 文件作用: 创建同源同 signal 的标准占位挑战依赖。
import { createSourceChallengePort } from '../src/runtime/source-shell/sourceChallengePort.js';

// 导入来源: ../src/runtime/source-shell/sourceLogger.js。
// 导入内容: createSourceLoggerController 日志控制器工厂。
// 文件作用: 验证 Context 只暴露 logger，Host 仍可通过控制器读取日志。
import { createSourceLoggerController } from '../src/runtime/source-shell/sourceLogger.js';

// 类型: string。
// 作用: 标准 Context、Adapter 路由、挑战和日志共用的数据源身份。
const SOURCE_CONTEXT_TEST_SOURCE_ID = 'system-source-1';

// 类型: string。
// 作用: 标识双 Context 攻击复验的第二数据源，验证同一 Adapter 和 Repository 下不会与 系统数据源1 串线。
const SOURCE_CONTEXT_SECONDARY_SOURCE_ID = 'system-source-2';

// 类型: string。
// 作用: 保存 系统数据源1 A 协议目录原始响应的精确模拟路由，供双源并发和中止后续调用复用。
const SOURCE_CONTEXT_PRIMARY_URL = 'https://mock-source.local/system-source-1/catalog';

// 类型: string。
// 作用: 保存 系统数据源2 B 协议目录原始响应的精确模拟路由，供双源并发和单边中止隔离复验使用。
const SOURCE_CONTEXT_SECONDARY_URL = 'https://mock-source.local/system-source-2/catalog';

// 类型: string。
// 作用: 两个数据源在同一 cache 分区写入相同键名，证明 StorageFacade 通过闭包 sourceId 隔离命名空间。
const SOURCE_CONTEXT_SHARED_CACHE_KEY = 'shared-context-cache';

// 类型: number。
// 作用: 标准网络请求使用的合法超时毫秒数。
const SOURCE_CONTEXT_TEST_TIMEOUT = 5000;

// 类型: number。
// 作用: 标准网络请求允许采用的 1 MiB 响应字节上限。
const SOURCE_CONTEXT_TEST_MAX_BYTES = 1048576;

/**
 * 创建完整 SourceNetworkRequest 候选。
 * 纯函数: 返回新对象和新 headers，不修改 overrides。
 *
 * @param {object} overrides 需要覆盖的请求字段。
 * @returns {object} 完整 SourceNetworkRequest 候选。
 * @returns {string} return.sourceId 请求所属数据源身份。
 * @returns {string} return.requestId 请求和响应关联标识。
 * @returns {string} return.url 精确模拟路由 URL。
 * @returns {string} return.method 标准 GET 方法。
 * @returns {object} return.headers 请求头普通对象。
 * @returns {null} return.body GET 无请求体值。
 * @returns {number} return.timeout 请求超时毫秒数。
 * @returns {number} return.maxResponseBytes 响应采用上限。
 */
function createNetworkRequest(overrides = {}) {
  return {
    // 类型: string。
    // 作用: 默认与 Context 根身份一致，跨源用例通过 overrides 替换。
    sourceId: SOURCE_CONTEXT_TEST_SOURCE_ID,

    // 类型: string。
    // 作用: 提供稳定请求和响应关联标识。
    requestId: 'context-request-001',

    // 类型: string。
    // 作用: 命中 系统数据源1 A 协议目录原始响应精确路由。
    url: SOURCE_CONTEXT_PRIMARY_URL,

    // 类型: string。
    // 作用: 使用冻结 GET 方法匹配默认 fixture。
    method: SOURCE_NETWORK_METHOD.get,

    // 类型: object。
    // 作用: 当前组合测试不携带额外请求头。
    headers: [],

    // 类型: null。
    // 作用: 满足 GET 请求不能携带 body 的 Shell 契约。
    body: { encoding: 'none', data: null },

    // 类型: number。
    // 作用: 提供集中策略范围内的合法超时。
    timeout: SOURCE_CONTEXT_TEST_TIMEOUT,

    // 类型: number。
    // 作用: 提供标准响应采用上限。
    maxResponseBytes: SOURCE_CONTEXT_TEST_MAX_BYTES,

    // 展开来源: 当前测试传入的局部请求字段。
    // 作用: 只改变目标用例条件，保持其他精确字段完整。
    ...overrides
  };
}

/**
 * 创建完整 SourceChallenge 候选。
 * 纯函数: 返回新对象和新 fields 数组，不修改 overrides。
 *
 * @param {object} overrides 需要覆盖的挑战字段。
 * @returns {object} 完整 SourceChallenge 候选。
 * @returns {string} return.challengeId 挑战请求关联标识。
 * @returns {string} return.sourceId 挑战所属数据源身份。
 * @returns {string} return.type 挑战类型。
 * @returns {string} return.title 挑战标题。
 * @returns {string} return.image 图片地址占位。
 * @returns {Array<object>} return.fields 挑战字段声明。
 * @returns {string} return.expiresAt 到期时间占位。
 * @returns {string} return.contextKey 私有空间续接键。
 */
function createChallenge(overrides = {}) {
  return {
    // 类型: string。
    // 作用: 提供稳定挑战结果关联标识。
    challengeId: 'context-challenge-001',

    // 类型: string。
    // 作用: 默认与 Context 根身份一致，跨源用例通过 overrides 替换。
    sourceId: SOURCE_CONTEXT_TEST_SOURCE_ID,

    // 类型: string。
    // 作用: 提供非空验证码挑战类型。
    type: 'captcha',

    // 类型: string。
    // 作用: 提供未来挑战界面标题。
    title: '请输入验证码',

    // 类型: string。
    // 作用: 空字符串表示当前测试没有挑战图片。
    image: '',

    // 类型: Array<object>。
    // 作用: 提供完整验证码字段声明，验证 Context 只转发而不渲染输入。
    fields: [{
      name: 'code',
      type: 'text',
      label: '验证码',
      required: true,
      placeholder: '请输入验证码'
    }],

    // 类型: string。
    // 作用: 空字符串表示当前挑战没有明确到期时间。
    expiresAt: '',

    // 类型: string。
    // 作用: 提供 Provider 私有空间中的最小续接键。
    contextKey: 'context-session',

    // 展开来源: 当前测试传入的局部挑战字段。
    // 作用: 只改变目标用例条件，保持其他精确字段完整。
    ...overrides
  };
}

/**
 * 创建真实 5D SourceContext 测试组合。
 * 副作用: 创建空 Memory Repository、Adapter、AbortController、挑战端口和日志控制器，不写入业务数据。
 * 成功路径: 返回 Context 和 Host 后续需要保留的依赖引用。
 * 失败路径: overrides 造成身份或 signal 不一致时由 createSourceContext 抛稳定 validation。
 *
 * @param {object} overrides 需要替换的组合依赖。
 * @returns {object} SourceContext 测试组合。
 * @returns {string} return.sourceId 当前组合绑定的数据源 id。
 * @returns {object} return.context 冻结 Provider 工具箱。
 * @returns {AbortController} return.controller 当前生命周期控制器。
 * @returns {MemorySourceStorageRepository} return.storageRepository 唯一 Storage 保存权威。
 * @returns {object} return.networkAdapter 模拟网络适配器。
 * @returns {object} return.challengePort 挑战端口。
 * @returns {object} return.loggerController Logger Controller。
 */
function createContextHarness(overrides = {}) {
  // 类型: string。
  // 作用: 默认绑定 系统数据源1；双源攻击用例显式传入 系统数据源2，并让全部子能力使用同一值。
  const sourceId = overrides.sourceId || SOURCE_CONTEXT_TEST_SOURCE_ID;

  // 类型: AbortController。
  // 作用: 默认提供未中止生命周期，Host 步骤 6 将负责真实创建和中止。
  const controller = overrides.controller || new AbortController();

  // 类型: MemorySourceStorageRepository。
  // 作用: 提供 Context Storage 唯一保存权威。
  const storageRepository = overrides.storageRepository || new MemorySourceStorageRepository();

  // 类型: object。
  // 作用: 提供 5C 默认精确模拟网络路由。
  const networkAdapter = overrides.networkAdapter || createMockNetworkAdapter();

  // 类型: object。
  // 作用: 默认创建与 Context 同源同 signal 挑战端口。
  const challengePort = overrides.challengePort || createSourceChallengePort({
    // 类型: string。
    // 作用: 绑定当前 harness 数据源身份。
    sourceId,

    // 类型: AbortSignal。
    // 作用: 与 Context 根和 network 共用同一生命周期引用。
    signal: controller.signal
  });

  // 类型: object。
  // 作用: 默认创建与 Context 同源 Logger Controller，Host 可保留读取能力。
  const loggerController = overrides.loggerController || createSourceLoggerController({
    // 类型: string。
    // 作用: 所有 Context 日志自动附带当前 harness sourceId。
    sourceId
  });

  // 类型: object。
  // 作用: 创建绑定全部真实依赖的被测 SourceContext。
  const context = createSourceContext({
    // 类型: string。
    // 作用: 冻结 Context 根身份，全部能力必须与它一致。
    sourceId,

    // 类型: object。
    // 作用: 提供标准网络 request，不把 Adapter 根对象暴露给 Provider。
    networkAdapter,

    // 类型: MemorySourceStorageRepository。
    // 作用: 提供五分区唯一保存权威。
    storageRepository,

    // 类型: object。
    // 作用: 提供同源同 signal 挑战端口，Context 只暴露 request。
    challengePort,

    // 类型: object。
    // 作用: 提供同源日志控制器，Context 只暴露四个写方法。
    loggerController,

    // 类型: AbortSignal。
    // 作用: 提供 Context 根、network 和 challenge 共用生命周期。
    signal: controller.signal
  });

  // 返回值类型: object。
  // 作用: 返回 Context 与组合依赖，供能力调用、Host 诊断和中止测试复用。
  return {
    // 类型: string。
    // 作用: 返回当前组合绑定身份，供双源攻击断言与请求构造复用。
    sourceId,

    // 类型: object。
    // 作用: 被测冻结 Provider 工具箱。
    context,

    // 类型: AbortController。
    // 作用: 控制当前测试 Context 生命周期。
    controller,

    // 类型: MemorySourceStorageRepository。
    // 作用: 供测试确认 Storage 委托真实保存权威。
    storageRepository,

    // 类型: object。
    // 作用: 供方法捕获和 Adapter 边界测试使用。
    networkAdapter,

    // 类型: object。
    // 作用: 供方法捕获和 signal 一致性测试使用。
    challengePort,

    // 类型: object。
    // 作用: Host 侧读取 Context logger 写入的隔离日志。
    loggerController
  };
}

// 测试目的: Context 六字段能力全部冻结，并通过真实 Adapter、Repository、ChallengePort 和 LoggerController 联动。
test('SourceContext 提供冻结同源能力并完成真实组合调用', async () => {
  // 类型: object。
  // 作用: 创建标准未中止 Context 测试组合。
  const { context, storageRepository, loggerController } = createContextHarness();

  // 断言作用: Context 只含正式六字段，根对象和四个子能力全部冻结。
  assert.deepEqual(Object.keys(context), ['sourceId', 'network', 'storage', 'challenge', 'logger', 'signal']);
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(context.network), true);
  assert.equal(Object.isFrozen(context.storage), true);
  assert.equal(Object.isFrozen(context.challenge), true);
  assert.equal(Object.isFrozen(context.logger), true);

  // 断言作用: Provider 只能看到 network/challenge 的 request 和 logger 四写方法，不能读取日志或获得端口组合字段。
  assert.deepEqual(Object.keys(context.network), ['request']);
  assert.deepEqual(Object.keys(context.challenge), ['request']);
  assert.deepEqual(Object.keys(context.logger), ['debug', 'info', 'warn', 'error']);
  assert.equal(Object.hasOwn(context.logger, 'getEntries'), false);
  assert.equal(Object.hasOwn(context.logger, 'clear'), false);

  // 类型: object。
  // 作用: 保存 Context network 从真实 MockNetworkAdapter 返回的 系统数据源1 原始响应。
  const networkResponse = await context.network.request(createNetworkRequest());

  // 断言作用: Context 保留根 sourceId，并返回 系统数据源1 A 协议 site/entries 原始结构。
  assert.equal(context.sourceId, SOURCE_CONTEXT_TEST_SOURCE_ID);
  // 类型: object；作用: 在测试 Provider 侧语义位置解码原始字节，验证 Context 未提前解释正文。
  const networkBody = JSON.parse(new TextDecoder().decode(networkResponse.body));
  assert.equal(networkBody.site.id, SOURCE_CONTEXT_TEST_SOURCE_ID);
  assert.equal(networkBody.entries[0].contentKey, 'system-source-1-movie-001');

  // 执行内容: 通过 Context cache 分区写入并读取一条严格 JSON 值。
  await context.storage.cache.set('context-cache', {
    // 类型: string。
    // 作用: 供 Context 和真实 Repository 双向读取断言比较。
    value: 'stored'
  });

  // 断言作用: Context Storage 与 Repository 同一 sourceId 命名空间保存值，不存在影子状态。
  assert.deepEqual(await context.storage.cache.get('context-cache'), { value: 'stored' });
  assert.deepEqual(
    await storageRepository.get(SOURCE_CONTEXT_TEST_SOURCE_ID, 'cache', 'context-cache'),
    { value: 'stored' }
  );

  // 类型: object。
  // 作用: 保存 Context challenge 返回的未中止占位结果。
  const challengeResult = await context.challenge.request(createChallenge());

  // 断言作用: Context challenge 只返回 unsupported，不暴露端口 sourceId 或 signal 字段。
  assert.equal(challengeResult.status, SOURCE_CHALLENGE_STATUS.unsupported);

  // 执行内容: Provider 通过 Context logger 写入一条包含 Cookie 的 info 日志。
  context.logger.info('Context 已创建', {
    // 类型: string。
    // 作用: 验证 Context 暴露的 logger 仍执行递归敏感值替换。
    cookie: 'secret-cookie'
  });

  // 类型: Array<object>。
  // 作用: Host 通过保留的 Controller 读取 Provider 写入日志。
  const entries = loggerController.getEntries();

  // 断言作用: 日志自动附带同一 sourceId、info 级别和脱敏 Cookie。
  assert.equal(entries[0].sourceId, SOURCE_CONTEXT_TEST_SOURCE_ID);
  assert.equal(entries[0].level, SOURCE_LOG_LEVEL.info);
  assert.equal(entries[0].details.cookie, '[REDACTED]');
});

// 测试目的: Context 构造必须拒绝跨源 challenge/logger、signal 分裂和额外依赖字段。
test('SourceContext 拒绝跨源能力和生命周期分裂', () => {
  // 类型: AbortController。
  // 作用: 提供 Context 根 signal 和标准依赖创建基础。
  const controller = new AbortController();

  // 类型: object。
  // 作用: 创建错误绑定 系统数据源2 的挑战端口。
  const crossSourceChallengePort = createSourceChallengePort({
    // 类型: string。
    // 作用: 故意与 Context 根 系统数据源1 不一致。
    sourceId: 'system-source-2',

    // 类型: AbortSignal。
    // 作用: 保持 signal 一致，只隔离 sourceId 失败条件。
    signal: controller.signal
  });

  // 断言作用: 挑战端口 sourceId 不一致时 Context 构造立即返回 validation。
  assert.throws(() => createContextHarness({
    controller,
    challengePort: crossSourceChallengePort
  }), SourceShellValidationError);

  // 类型: AbortController。
  // 作用: 创建与 Context 根不同的挑战端口 signal。
  const otherController = new AbortController();

  // 类型: object。
  // 作用: 创建 sourceId 正确但生命周期引用分裂的挑战端口。
  const splitSignalChallengePort = createSourceChallengePort({
    // 类型: string。
    // 作用: 保持身份一致，只隔离 signal 失败条件。
    sourceId: SOURCE_CONTEXT_TEST_SOURCE_ID,

    // 类型: AbortSignal。
    // 作用: 故意使用另一控制器 signal。
    signal: otherController.signal
  });

  // 断言作用: 挑战端口 signal 不是根 signal 同一引用时 Context 构造失败。
  assert.throws(() => createContextHarness({
    controller,
    challengePort: splitSignalChallengePort
  }), SourceShellValidationError);

  // 类型: object。
  // 作用: 创建错误绑定 系统数据源2 的 Logger Controller。
  const crossSourceLogger = createSourceLoggerController({
    // 类型: string。
    // 作用: 故意与 Context 根身份不一致。
    sourceId: 'system-source-2'
  });

  // 断言作用: Logger Controller sourceId 不一致时 Context 构造立即失败。
  assert.throws(() => createContextHarness({
    controller,
    loggerController: crossSourceLogger
  }), SourceShellValidationError);

  // 类型: object。
  // 作用: 创建标准依赖后额外加入页面对象，验证 Context options 精确字段。
  const standard = createContextHarness({ controller });

  // 断言作用: Context options 多出 page 字段时返回 validation，不静默裁剪未声明能力。
  assert.throws(() => createSourceContext({
    sourceId: SOURCE_CONTEXT_TEST_SOURCE_ID,
    networkAdapter: standard.networkAdapter,
    storageRepository: standard.storageRepository,
    challengePort: standard.challengePort,
    loggerController: standard.loggerController,
    signal: controller.signal,

    // 类型: object。
    // 作用: 故意加入未声明页面依赖，精确字段门禁必须拒绝。
    page: {}
  }), SourceShellValidationError);
});

// 测试目的: Context 在调用时拒绝跨源和中止，并捕获依赖方法引用防止创建后替换。
test('SourceContext 阻止跨源中止采用并稳定捕获依赖方法', async () => {
  // 类型: object。
  // 作用: 创建真实冻结 Adapter，给可变包装提供初始 request 实现。
  const baseAdapter = createMockNetworkAdapter();

  // 类型: object。
  // 作用: 创建可在 Context 构造后替换 request 的网络包装对象。
  const mutableNetworkAdapter = {
    // 类型: Function。
    // 作用: 初始绑定真实 Adapter request，Context 构造时应捕获该函数。
    request: baseAdapter.request.bind(baseAdapter)
  };

  // 类型: AbortController。
  // 作用: 提供未中止 Context 根生命周期。
  const controller = new AbortController();

  // 类型: object。
  // 作用: 创建真实冻结 ChallengePort，给可变包装提供身份、signal 和初始 request。
  const baseChallengePort = createSourceChallengePort({
    // 类型: string。
    // 作用: 保持真实端口与 Context 根身份一致。
    sourceId: SOURCE_CONTEXT_TEST_SOURCE_ID,

    // 类型: AbortSignal。
    // 作用: 保持真实端口与 Context 根 signal 同一引用。
    signal: controller.signal
  });

  // 类型: object。
  // 作用: 创建可在 Context 构造后替换 request 的挑战端口包装对象。
  const mutableChallengePort = {
    // 类型: string。
    // 作用: 保持 Context 根身份一致。
    sourceId: baseChallengePort.sourceId,

    // 类型: AbortSignal。
    // 作用: 保持 Context 根 signal 同一引用。
    signal: baseChallengePort.signal,

    // 类型: Function。
    // 作用: 初始绑定真实端口 request，Context 构造时应捕获该函数。
    request: baseChallengePort.request.bind(baseChallengePort)
  };

  // 类型: object。
  // 作用: 创建使用两个可变包装依赖的 Context。
  const { context } = createContextHarness({
    controller,
    networkAdapter: mutableNetworkAdapter,
    challengePort: mutableChallengePort
  });

  /**
   * 替换外部网络包装的 request 方法。
   * 副作用: 只修改当前测试 mutableNetworkAdapter；已创建 Context 应继续使用构造时捕获函数。
   * 成功路径: 无，本桩专门证明替换方法不会被已创建 Context 读取。
   * 失败路径: 每次直接调用均抛固定 Error。
   *
   * @returns {Promise<never>} 当前替换桩始终拒绝。
   * @throws {Error} 每次调用均抛 replaced network method。
   */
  mutableNetworkAdapter.request = async () => {
    throw new Error('replaced network method');
  };

  /**
   * 替换外部挑战包装的 request 方法。
   * 副作用: 只修改当前测试 mutableChallengePort；已创建 Context 应继续使用构造时捕获函数。
   * 成功路径: 无，本桩专门证明替换方法不会被已创建 Context 读取。
   * 失败路径: 每次直接调用均抛固定 Error。
   *
   * @returns {Promise<never>} 当前替换桩始终拒绝。
   * @throws {Error} 每次调用均抛 replaced challenge method。
   */
  mutableChallengePort.request = async () => {
    throw new Error('replaced challenge method');
  };

  // 断言作用: 已创建 Context 不受外部方法替换影响，仍返回真实 Adapter 和 challenge 结果。
  assert.equal(
    JSON.parse(new TextDecoder().decode((await context.network.request(createNetworkRequest())).body)).site.id,
    SOURCE_CONTEXT_TEST_SOURCE_ID
  );
  assert.equal(
    (await context.challenge.request(createChallenge())).status,
    SOURCE_CHALLENGE_STATUS.unsupported
  );

  // 断言作用: Provider 通过 系统数据源1 Context 声明 系统数据源2 请求或挑战时均返回 validation。
  await assert.rejects(context.network.request(createNetworkRequest({
    sourceId: 'system-source-2',
    url: SOURCE_CONTEXT_SECONDARY_URL
  })), SourceShellValidationError);
  await assert.rejects(
    context.challenge.request(createChallenge({ sourceId: 'system-source-2' })),
    SourceShellValidationError
  );

  // 副作用: 中止当前 Context 根 controller，network 不得再采用成功结果。
  controller.abort();

  // 断言作用: 中止后 network 返回 aborted，challenge 使用同一 signal 返回 cancelled。
  await assert.rejects(
    context.network.request(createNetworkRequest()),
    SourceShellAbortedError
  );
  assert.equal(
    (await context.challenge.request(createChallenge())).status,
    SOURCE_CHALLENGE_STATUS.cancelled
  );
});

// 测试目的: 两个 Context 共享 Adapter 和 Repository 时，网络、Storage、日志、失败与中止仍按各自 sourceId 和 signal 隔离。
test('SourceContext 双源跨能力失败和单边中止不会串线', async () => {
  // 类型: object。
  // 作用: 两个 Context 共享同一 MockNetworkAdapter，验证身份隔离来自 Context 请求门禁和 Adapter 精确路由而非实例隔离。
  const sharedNetworkAdapter = createMockNetworkAdapter();

  // 类型: MemorySourceStorageRepository。
  // 作用: 两个 Context 共享同一保存权威，验证相同 partition/key 仍按闭包绑定 sourceId 分离。
  const sharedStorageRepository = new MemorySourceStorageRepository();

  // 类型: object。
  // 作用: 创建 系统数据源1 Context 及其独立 AbortController、ChallengePort 和 LoggerController。
  const primaryHarness = createContextHarness({
    // 类型: string。
    // 作用: 把第一组能力统一绑定到 系统数据源1。
    sourceId: SOURCE_CONTEXT_TEST_SOURCE_ID,

    // 类型: object。
    // 作用: 与第二组能力共用 Adapter，制造真实共享网络边界。
    networkAdapter: sharedNetworkAdapter,

    // 类型: MemorySourceStorageRepository。
    // 作用: 与第二组能力共用 Repository，制造真实共享保存边界。
    storageRepository: sharedStorageRepository
  });

  // 类型: object。
  // 作用: 创建 系统数据源2 Context 及其独立 AbortController、ChallengePort 和 LoggerController。
  const secondaryHarness = createContextHarness({
    // 类型: string。
    // 作用: 把第二组能力统一绑定到 系统数据源2。
    sourceId: SOURCE_CONTEXT_SECONDARY_SOURCE_ID,

    // 类型: object。
    // 作用: 与第一组能力共用 Adapter，验证两个精确路由不会串线。
    networkAdapter: sharedNetworkAdapter,

    // 类型: MemorySourceStorageRepository。
    // 作用: 与第一组能力共用 Repository，验证命名空间由 sourceId 隔离。
    storageRepository: sharedStorageRepository
  });

  // 类型: Array<object>。
  // 作用: 并发保存两个 Context 的网络响应，验证共享 Adapter 按请求身份返回各自原始结构。
  const [primaryResponse, secondaryResponse] = await Promise.all([
    primaryHarness.context.network.request(createNetworkRequest({
      // 类型: string。
      // 作用: 明确第一笔请求属于 系统数据源1 Context。
      sourceId: primaryHarness.sourceId,

      // 类型: string。
      // 作用: 区分并发请求和对应响应。
      requestId: 'context-primary-concurrent',

      // 类型: string。
      // 作用: 命中 系统数据源1 site/entries 原始响应。
      url: SOURCE_CONTEXT_PRIMARY_URL
    })),
    secondaryHarness.context.network.request(createNetworkRequest({
      // 类型: string。
      // 作用: 明确第二笔请求属于 系统数据源2 Context。
      sourceId: secondaryHarness.sourceId,

      // 类型: string。
      // 作用: 区分并发请求和对应响应。
      requestId: 'context-secondary-concurrent',

      // 类型: string。
      // 作用: 命中 系统数据源2 station/data.videos 原始响应。
      url: SOURCE_CONTEXT_SECONDARY_URL
    }))
  ]);

  // 断言作用: 共享 Adapter 并发返回 A 协议 site/entries 和 B 协议 station/data.videos，原始字段与内容均未交叉。
  // 类型: object；作用: 解码主源原始字节，核对 A 协议身份未与另一 Context 串线。
  const primaryBody = JSON.parse(new TextDecoder().decode(primaryResponse.body));
  // 类型: object；作用: 解码次源原始字节，核对 B 协议身份未与另一 Context 串线。
  const secondaryBody = JSON.parse(new TextDecoder().decode(secondaryResponse.body));
  assert.equal(primaryBody.site.id, SOURCE_CONTEXT_TEST_SOURCE_ID);
  assert.equal(primaryBody.entries[0].contentKey, 'system-source-1-movie-001');
  assert.equal(Object.hasOwn(primaryBody, 'data'), false);
  assert.equal(secondaryBody.station.key, SOURCE_CONTEXT_SECONDARY_SOURCE_ID);
  assert.equal(secondaryBody.data.videos[0].vod_id, 'system-source-2-movie-101');
  assert.equal(Object.hasOwn(secondaryBody, 'entries'), false);

  // 执行内容: 两个 Context 向同一 Repository 的 cache 分区和同名 key 并发写入不同值。
  await Promise.all([
    primaryHarness.context.storage.cache.set(SOURCE_CONTEXT_SHARED_CACHE_KEY, {
      // 类型: string。
      // 作用: 标识 系统数据源1 命名空间保存值，供双向隔离断言使用。
      owner: SOURCE_CONTEXT_TEST_SOURCE_ID
    }),
    secondaryHarness.context.storage.cache.set(SOURCE_CONTEXT_SHARED_CACHE_KEY, {
      // 类型: string。
      // 作用: 标识 系统数据源2 命名空间保存值，供双向隔离断言使用。
      owner: SOURCE_CONTEXT_SECONDARY_SOURCE_ID
    })
  ]);

  // 断言作用: 相同 Repository、分区和 key 通过两个门面读取时仍返回各自 sourceId 的值。
  assert.deepEqual(
    await primaryHarness.context.storage.cache.get(SOURCE_CONTEXT_SHARED_CACHE_KEY),
    { owner: SOURCE_CONTEXT_TEST_SOURCE_ID }
  );
  assert.deepEqual(
    await secondaryHarness.context.storage.cache.get(SOURCE_CONTEXT_SHARED_CACHE_KEY),
    { owner: SOURCE_CONTEXT_SECONDARY_SOURCE_ID }
  );

  // 执行内容: 两个 Context 分别写入同级日志，Logger Controller 应自动附带各自绑定身份。
  primaryHarness.context.logger.info('primary context ready', {
    // 类型: string。
    // 作用: 验证 系统数据源1 日志只保存在第一控制器。
    owner: SOURCE_CONTEXT_TEST_SOURCE_ID
  });
  secondaryHarness.context.logger.info('secondary context ready', {
    // 类型: string。
    // 作用: 验证 系统数据源2 日志只保存在第二控制器。
    owner: SOURCE_CONTEXT_SECONDARY_SOURCE_ID
  });

  // 类型: Array<object>。
  // 作用: 保存第一 Logger Controller 的隔离日志快照，验证只包含 系统数据源1 身份。
  const primaryEntries = primaryHarness.loggerController.getEntries();

  // 类型: Array<object>。
  // 作用: 保存第二 Logger Controller 的隔离日志快照，验证只包含 系统数据源2 身份。
  const secondaryEntries = secondaryHarness.loggerController.getEntries();

  // 断言作用: 两个 Logger Controller 各有一条自动绑定日志，身份和详情不会串线。
  assert.equal(primaryEntries.length, 1);
  assert.equal(primaryEntries[0].sourceId, SOURCE_CONTEXT_TEST_SOURCE_ID);
  assert.equal(primaryEntries[0].details.owner, SOURCE_CONTEXT_TEST_SOURCE_ID);
  assert.equal(secondaryEntries.length, 1);
  assert.equal(secondaryEntries[0].sourceId, SOURCE_CONTEXT_SECONDARY_SOURCE_ID);
  assert.equal(secondaryEntries[0].details.owner, SOURCE_CONTEXT_SECONDARY_SOURCE_ID);

  // 断言作用: 系统数据源1 Context 跨源请求在 Adapter 前失败，不会消耗或破坏两个 Context 的合法路由。
  await assert.rejects(primaryHarness.context.network.request(createNetworkRequest({
    // 类型: string。
    // 作用: 故意声明 系统数据源2 身份，攻击 系统数据源1 Context 根身份门禁。
    sourceId: SOURCE_CONTEXT_SECONDARY_SOURCE_ID,

    // 类型: string。
    // 作用: 标识本次跨源攻击请求。
    requestId: 'context-primary-cross-source',

    // 类型: string。
    // 作用: 故意尝试命中 系统数据源2 精确路由。
    url: SOURCE_CONTEXT_SECONDARY_URL
  })), SourceShellValidationError);

  // 类型: Array<object>。
  // 作用: 跨源失败后再次并发调用 A、B 合法路由，证明失败没有使任一 Context 或共享 Adapter 中毒。
  const [primaryRecoveryResponse, secondaryRecoveryResponse] = await Promise.all([
    primaryHarness.context.network.request(createNetworkRequest({
      // 类型: string。
      // 作用: 恢复调用继续使用 系统数据源1 身份。
      sourceId: SOURCE_CONTEXT_TEST_SOURCE_ID,

      // 类型: string。
      // 作用: 区分失败后的合法恢复请求。
      requestId: 'context-primary-recovery',

      // 类型: string。
      // 作用: 继续命中 系统数据源1 合法路由。
      url: SOURCE_CONTEXT_PRIMARY_URL
    })),
    secondaryHarness.context.network.request(createNetworkRequest({
      // 类型: string。
      // 作用: B 保持 系统数据源2 身份，不受 A 的攻击失败影响。
      sourceId: SOURCE_CONTEXT_SECONDARY_SOURCE_ID,

      // 类型: string。
      // 作用: 区分 B 的失败后续请求。
      requestId: 'context-secondary-after-primary-failure',

      // 类型: string。
      // 作用: 继续命中 系统数据源2 合法路由。
      url: SOURCE_CONTEXT_SECONDARY_URL
    }))
  ]);

  // 断言作用: A 的合法恢复请求和 B 的后续请求都返回各自协议原始数据。
  assert.equal(JSON.parse(new TextDecoder().decode(primaryRecoveryResponse.body)).entries[0].contentKey, 'system-source-1-movie-001');
  assert.equal(JSON.parse(new TextDecoder().decode(secondaryRecoveryResponse.body)).data.videos[0].vod_id, 'system-source-2-movie-101');

  // 副作用: 只中止 系统数据源1 Context 的独立控制器，系统数据源2 Context 的 signal 保持可用。
  primaryHarness.controller.abort();

  // 断言作用: 中止后的 A network 返回 aborted，A challenge 读取同一 signal 返回 cancelled。
  await assert.rejects(primaryHarness.context.network.request(createNetworkRequest({
    // 类型: string。
    // 作用: 保持 A 请求身份合法，只隔离生命周期失败条件。
    sourceId: SOURCE_CONTEXT_TEST_SOURCE_ID,

    // 类型: string。
    // 作用: 标识 A 中止后的网络请求。
    requestId: 'context-primary-aborted',

    // 类型: string。
    // 作用: 使用合法 系统数据源1 路由，确保错误仅来自 signal。
    url: SOURCE_CONTEXT_PRIMARY_URL
  })), SourceShellAbortedError);
  assert.equal(
    (await primaryHarness.context.challenge.request(createChallenge({
      sourceId: SOURCE_CONTEXT_TEST_SOURCE_ID
    }))).status,
    SOURCE_CHALLENGE_STATUS.cancelled
  );

  // 类型: object。
  // 作用: A 中止后调用 B 合法网络，验证独立 AbortController 不影响共享 Adapter 的其他 Context。
  const secondaryAfterAbortResponse = await secondaryHarness.context.network.request(createNetworkRequest({
    // 类型: string。
    // 作用: 保持 B 的 系统数据源2 身份。
    sourceId: SOURCE_CONTEXT_SECONDARY_SOURCE_ID,

    // 类型: string。
    // 作用: 标识 A 中止后的 B 网络请求。
    requestId: 'context-secondary-after-primary-abort',

    // 类型: string。
    // 作用: 继续命中 系统数据源2 合法路由。
    url: SOURCE_CONTEXT_SECONDARY_URL
  }));

  // 类型: object。
  // 作用: A 中止后调用 B 挑战端口，验证 B 的独立 signal 仍返回 unsupported。
  const secondaryChallengeResult = await secondaryHarness.context.challenge.request(createChallenge({
    sourceId: SOURCE_CONTEXT_SECONDARY_SOURCE_ID
  }));

  // 执行内容: A 中止后继续读取 B 保存值并写入新日志，验证 B 的 Storage 和 Logger 仍可使用。
  secondaryHarness.context.logger.warn('secondary context remains active', {
    // 类型: boolean。
    // 作用: true 表示 B 在 A 中止后仍能写日志；false 不会由当前成功路径写入。
    active: true
  });

  // 断言作用: B 的网络、challenge、Storage 和 logger 在 A 中止后继续保持完整能力。
  assert.equal(JSON.parse(new TextDecoder().decode(secondaryAfterAbortResponse.body)).station.key, SOURCE_CONTEXT_SECONDARY_SOURCE_ID);
  assert.equal(secondaryChallengeResult.status, SOURCE_CHALLENGE_STATUS.unsupported);
  assert.deepEqual(
    await secondaryHarness.context.storage.cache.get(SOURCE_CONTEXT_SHARED_CACHE_KEY),
    { owner: SOURCE_CONTEXT_SECONDARY_SOURCE_ID }
  );
  assert.equal(secondaryHarness.loggerController.getEntries().length, 2);
  assert.equal(secondaryHarness.loggerController.getEntries()[1].sourceId, SOURCE_CONTEXT_SECONDARY_SOURCE_ID);
});
