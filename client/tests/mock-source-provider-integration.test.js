/*
  mock-source-provider-integration.test.js 模块说明

  - 文件职责:
      验证统一可信模拟 Provider 工厂可以通过 Registry、SourceExecutionHost 和 SourceContext 同时运行 A/B 两类数据源。
      验证内容、筛选、健康、私有 cache、失败收敛和生命周期门禁只通过公开接口完成。
      本测试不直接导入受审数据集或 response fixture，不访问真实网络，也不读取 Host 或 Provider 私有状态。

  - 导入库及文件汇总(12 条，内置 2 条，第三方 0 条，自定义 10 条):
      assert: 内置模块，执行字段、错误码、隔离副本和生命周期结果断言。
      test: 内置模块，注册 Node 集成测试。
      MOCK_SOURCE_PROVIDER_KEY、createMockSourceProviderFactory: 自定义 Provider 工厂，提供冻结可信工厂候选。
      MemorySourceStorageRepository: 自定义 Repository，验证两个 sourceId 的 cache 命名空间隔离。
      createMockNetworkAdapter: 自定义 Shell 适配器，通过默认 fixture 返回受控原始响应。
      createSourceChallengePort: 自定义 Shell 端口，为每个 Context 绑定同一 sourceId 和 AbortSignal。
      createSourceContext: 自定义 Shell 工厂，组合 Provider 可见的六项受控能力。
      createSourceLoggerController: 自定义 Shell 控制器，提供同源只写日志和 Host 清理入口。
      SOURCE_SHELL_ERROR_CODE: 自定义 Shell 错误码，断言跨源、未知路由和损坏原始响应稳定失败。
      SOURCE_EXECUTION_HOST_ERROR_CODE: 自定义 Host 错误码，断言门禁、停止、释放和在途中止分类。
      createProviderFactoryRegistry、createSourceExecutionHost: 自定义 Host 基础设施，注册工厂并管理 Provider 生命周期。

  - 模块级常量:
      TEST_SOURCE_IDS: object，核心 A/B 双源真实身份。
      TEST_SUPPORTED_SOURCE_IDS: Array<string>，工厂必须支持的四个受审数据源。
      TEST_SCRIPT_HASH: string，Host 门禁使用的已验证脚本指纹。
      TEST_CACHE_PARTITION: string，Provider 诊断值写入的私有 cache 分区。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createDeferred(): Function，创建无固定 sleep 的可控 Promise。
      createSourceRecord(sourceId): Function，创建 Host 可消费的轻量系统源记录。
      createDataRequest(sourceId, pageKey): Function，创建标准内容请求。
      createFilterRequest(sourceId, pageKey): Function，创建标准筛选请求。
      createNetworkAdapterFacade(options): Function，在默认 Adapter 外建立公开失败注入门面。
      createHostEnvironment(options): Function，组合 Registry、Host、Context、默认网络和 Memory Storage。
      initializeAndStartSource(environment, sourceId): Function，初始化并启动一个受管数据源。
      disposeSources(environment, sourceIds): Function，幂等释放一组公开 Host 实例。
      assertRejectsWithCode(operation, expectedCode): Function，断言同步或异步操作使用稳定错误码失败。
      findFilterGroup(response, groupName): Function，定位并验证标准筛选组。
      sumPositiveOptionCounts(group): Function，验证并累计筛选统计数量。

  - 模块级类:
      无

  - 对外导出:
      无；文件由 Node test runner 直接执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言对象。
// 文件作用: 验证公开响应、稳定错误码、引用隔离和生命周期结果。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册可信模拟 Provider 集成测试。
import test from 'node:test';

import {
  // 导入来源: ../src/data/providers/createMockSourceProvider.js。
  // 导入内容: MOCK_SOURCE_PROVIDER_KEY 可信模拟 Provider 注册键。
  // 文件作用: 以生产工厂声明的唯一 providerKey 注册并构造 SourceRecord。
  MOCK_SOURCE_PROVIDER_KEY,

  // 导入来源: ../src/data/providers/createMockSourceProvider.js。
  // 导入内容: createMockSourceProviderFactory 统一可信模拟 Provider 工厂。
  // 文件作用: 由同一工厂为 系统数据源1 和 系统数据源2 创建独立 Provider 实例。
  createMockSourceProviderFactory
} from '../src/data/providers/createMockSourceProvider.js';

// 导入来源: ../src/repositories/source/memorySourceStorageRepository.js。
// 导入内容: MemorySourceStorageRepository 内存私有空间实现。
// 文件作用: 给两个 Context 提供同一保存权威，并通过公开 get/list 证明 sourceId 隔离。
import { MemorySourceStorageRepository } from '../src/repositories/source/memorySourceStorageRepository.js';

// 导入来源: ../src/runtime/source-shell/mockNetworkAdapter.js。
// 导入内容: createMockNetworkAdapter 模拟网络工厂。
// 文件作用: 正常路径只使用默认 fixture，负向路径通过公开 request 门面注入未知端点或损坏 body。
import { createMockNetworkAdapter } from '../src/runtime/source-shell/mockNetworkAdapter.js';

// 导入来源: ../src/runtime/source-shell/sourceChallengePort.js。
// 导入内容: createSourceChallengePort 挑战占位端口工厂。
// 文件作用: 为每个 Context 创建同源同 signal 的受控挑战能力。
import { createSourceChallengePort } from '../src/runtime/source-shell/sourceChallengePort.js';

// 导入来源: ../src/runtime/source-shell/createSourceContext.js。
// 导入内容: createSourceContext Provider 工具箱工厂。
// 文件作用: 组合网络、存储、挑战、日志和 signal，不向 Provider 暴露基础设施根对象。
import { createSourceContext } from '../src/runtime/source-shell/createSourceContext.js';

// 导入来源: ../src/runtime/source-shell/sourceLogger.js。
// 导入内容: createSourceLoggerController 脱敏有界日志控制器工厂。
// 文件作用: 满足 Host Context runtime 契约，并在释放时通过公开 clear 清理。
import { createSourceLoggerController } from '../src/runtime/source-shell/sourceLogger.js';

// 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
// 导入内容: SOURCE_SHELL_ERROR_CODE Shell 稳定错误码。
// 文件作用: 精确断言跨源请求、未知端点和损坏原始 body 的失败分类。
import { SOURCE_SHELL_ERROR_CODE } from '../src/runtime/source-shell/sourceShellErrors.js';

// 导入来源: ../src/runtime/source-host/sourceExecutionHostErrors.js。
// 导入内容: SOURCE_EXECUTION_HOST_ERROR_CODE Host 稳定错误码。
// 文件作用: 精确断言工厂门禁、在途中止、停止和释放后的失败分类。
import { SOURCE_EXECUTION_HOST_ERROR_CODE } from '../src/runtime/source-host/sourceExecutionHostErrors.js';

// 导入来源: ../src/runtime/source-host/providerFactoryRegistry.js。
// 导入内容: createProviderFactoryRegistry 可信工厂注册表工厂。
// 文件作用: 使用生产 Registry 注册统一模拟工厂，不直接创建或保存 Provider 实例。
import { createProviderFactoryRegistry } from '../src/runtime/source-host/providerFactoryRegistry.js';

// 导入来源: ../src/runtime/sourceExecutionHost.js。
// 导入内容: createSourceExecutionHost Provider 生命周期宿主工厂。
// 文件作用: 所有内容、筛选、健康、停止和释放观察都经过 Host 公开方法。
import { createSourceExecutionHost } from '../src/runtime/sourceExecutionHost.js';

// 类型: object。
// 作用: 固定核心 A/B 协议双源真实身份，测试不使用 mock-source 别名。
const TEST_SOURCE_IDS = Object.freeze({
  // 类型: string。
  // 作用: A 协议核心系统源，使用 records 风格原始目录。
  protocolA: 'system-source-1',

  // 类型: string。
  // 作用: B 协议核心系统源，使用 list 风格原始目录。
  protocolB: 'system-source-2'
});

// 类型: Array<string>。
// 作用: 冻结工厂必须明确支持的四个项目内受审数据源，未知 Definition 必须返回 false。
const TEST_SUPPORTED_SOURCE_IDS = Object.freeze([
  'system-source-1',
  'system-source-3',
  'system-source-2',
  'system-source-4'
]);

// 类型: string。
// 作用: 模拟 Repository 已验证 Package 脚本指纹，使正常系统源通过 Host 完整性和授权门禁。
const TEST_SCRIPT_HASH = '6c-provider-integrity-hash';

// 类型: string。
// 作用: 指定 Provider 诊断值必须写入的私有分区；测试通过 Repository 公共接口读取。
const TEST_CACHE_PARTITION = 'cache';

/**
 * 创建可由测试显式完成或拒绝的 Promise。
 * 副作用: 把 resolve/reject 保存到返回控制器；调用后改变当前私有 Promise 的收敛状态。
 * 成功路径: resolve(value) 让 promise 返回指定 value。
 * 失败路径: reject(error) 让 promise 以指定 error 拒绝。
 *
 * @returns {object} 冻结可控 Promise 控制器。
 * @returns {Promise<*>} return.promise 尚未收敛的 Promise。
 * @returns {Function} return.resolve 显式完成 Promise 的函数。
 * @returns {Function} return.reject 显式拒绝 Promise 的函数。
 */
function createDeferred() {
  // 类型: Function|undefined。
  // 作用: 保存 Promise 构造器提供的 resolve，供测试在准确生命周期节点放行。
  let resolvePromise;

  // 类型: Function|undefined。
  // 作用: 保存 Promise 构造器提供的 reject，供失败场景显式拒绝。
  let rejectPromise;

  // 类型: Promise<*>。
  // 作用: 建立不依赖 setTimeout 或固定 sleep 的异步控制点。
  const promise = new Promise((resolve, reject) => {
    // 副作用范围: 只捕获当前 Promise 的完成函数。
    resolvePromise = resolve;

    // 副作用范围: 只捕获当前 Promise 的拒绝函数。
    rejectPromise = reject;
  });

  // 返回值类型: object。
  // 作用: 返回当前测试私有异步控制器，外部不能替换三个字段。
  return Object.freeze({
    promise,
    resolve: resolvePromise,
    reject: rejectPromise
  });
}

/**
 * 创建符合 Host 门禁的轻量系统 SourceRecord。
 * 纯函数: 每次返回新的 Definition、runtime、authorization 和 cache 对象，不共享可变引用。
 * 成功路径: 使用真实 sourceId、统一 providerKey、有效指纹和 enabled=true 通过 Host 门禁。
 * 失败路径: 未支持 sourceId 仍能形成合法记录，由工厂 supports 门禁稳定拒绝。
 *
 * @param {string} sourceId 数据源真实身份。
 * @returns {object} SourceExecutionHost.initialize 可消费的轻量 SourceRecord。
 */
function createSourceRecord(sourceId) {
  // 类型: string。
  // 作用: 创建与 Definition 和 Storage namespace 同源的稳定 Package 引用。
  const packageRef = `source-package::${sourceId}`;

  // 返回值类型: object。
  // 作用: 返回不含 scriptContent、Repository 或页面状态的轻量记录。
  return {
    // 类型: object。
    // 作用: 提供 Host 身份、可信工厂、能力和版本门禁输入。
    definition: {
      schemaVersion: '1.0.0',
      id: sourceId,
      name: `${sourceId} 集成测试源`,
      description: '用于可信模拟 Provider 公开接口集成测试。',
      sourceKind: 'system',
      version: 'v1.0.0',
      providerKey: MOCK_SOURCE_PROVIDER_KEY,
      packageRef,
      importMethod: 'builtin',
      remoteUrl: '',
      importedAt: '2026-07-16T00:00:00.000Z',
      lastUpdatedAt: '2026-07-16T00:00:00.000Z',
      capabilities: {
        home: true,
        movie: true,
        tv: true,
        search: true,
        detail: true,
        play: true
      },
      settingsSchema: []
    },

    // 类型: string。
    // 作用: 与 Definition.packageRef 完全一致，Host 不读取 Package 正文。
    packageRef,

    // 类型: string。
    // 作用: 固定等于 sourceId，让 Context Storage 只能进入当前源命名空间。
    storageNamespace: sourceId,

    // 类型: object。
    // 作用: 提供有效启用和已验证指纹；Host 只消费 enabled/currentScriptHash 门禁字段。
    runtime: {
      enabled: true,
      providerStatus: 'stopped',
      currentScriptHash: TEST_SCRIPT_HASH,
      healthStatus: 'normal',
      lastCheckedAt: '',
      lastUnavailableReason: '',
      checkingUpdate: false,
      updateAvailable: false,
      availableVersion: '',
      availableVersionUpdatedAt: '',
      lastUpdateCheckedAt: ''
    },

    // 类型: object。
    // 作用: 保留完整授权快照结构；系统源由统一授权算法判定为可运行。
    authorization: {
      status: 'authorized',
      authorizedAt: '2026-07-16T00:00:00.000Z',
      authorizedVersion: 'v1.0.0',
      authorizedScriptHash: TEST_SCRIPT_HASH
    },

    // 类型: object。
    // 作用: 保留轻量设置页 cache 摘要；Host 和 Provider 不修改该投影对象。
    cache: {
      temporaryCacheBytes: 0,
      totalCacheBytes: 0
    }
  };
}

/**
 * 创建标准内容请求。
 * 纯函数: 返回新的 request 和 params，不修改外部状态。
 * 成功路径: Provider 可以按 pageKey 和分页参数返回标准列表响应。
 * 失败路径: 调用方可传入其他 sourceId 制造跨源请求，Provider 必须稳定拒绝。
 *
 * @param {string} sourceId 请求声明的数据源身份。
 * @param {string} pageKey 目标内容页面，当前测试使用 movie。
 * @returns {object} 标准 SourceDataRequest。
 */
function createDataRequest(sourceId, pageKey = 'movie') {
  // 返回值类型: object。
  // 作用: 返回字段完整请求，避免测试依赖 Provider 的缺字段兜底。
  return {
    sourceId,
    pageKey,
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
 * 创建标准筛选元数据请求。
 * 纯函数: 每次返回新的空 params，不共享调用方引用。
 * 成功路径: movie 或 tv 返回标准筛选组与统计数量。
 * 失败路径: 非同源请求由 Provider 身份门禁拒绝。
 *
 * @param {string} sourceId 请求声明的数据源身份。
 * @param {string} pageKey movie 或 tv 页面键。
 * @returns {object} 标准 SourceFilterMetaRequest。
 */
function createFilterRequest(sourceId, pageKey) {
  // 返回值类型: object。
  // 作用: 返回筛选契约精确三字段，不携带内容分页或 Context 参数。
  return {
    sourceId,
    pageKey,
    params: {}
  };
}

/**
 * 在默认 MockNetworkAdapter 外创建只含 request 的公开门面。
 * 副作用: 正常调用只读取默认 fixture；可选 transformRequest/transformResponse 只服务负向测试。
 * 成功路径: 没有变换时原样委托默认 Adapter。
 * 失败路径: 请求改写为未知端点时保留 notFound；响应改写为损坏 body 时由 Provider 解码器稳定失败。
 *
 * @param {object} options 可选公开门面变换。
 * @param {Function} options.transformRequest 请求进入默认 Adapter 前的转换函数。
 * @param {Function} options.transformResponse 默认 Adapter 返回后的响应转换函数。
 * @param {Function} options.beforeRequest 默认 Adapter 前的异步控制函数。
 * @returns {object} 只含 request 的冻结网络适配器门面。
 */
function createNetworkAdapterFacade(options = {}) {
  // 类型: object。
  // 作用: 创建使用生产默认 fixture 的真实 MockNetworkAdapter。
  const baseAdapter = createMockNetworkAdapter();

  // 返回值类型: object。
  // 作用: 保持 SourceContext 只接受 request 的精确依赖结构。
  return Object.freeze({
    /**
     * 经可选公开变换调用默认 MockNetworkAdapter。
     * 副作用: 委托 baseAdapter.request；不读取 fixture 模块或真实网络。
     * 成功路径: 返回默认 Adapter 响应或 transformResponse 生成的测试候选。
     * 失败路径: beforeRequest、Adapter 或变换函数异常原样交给 Provider/Host 收敛。
     *
     * @param {object} request Provider 通过 Context 提交的标准网络请求。
     * @param {AbortSignal} signal Host 当前生命周期信号。
     * @returns {Promise<object>} 标准或负向测试 SourceNetworkResponse。
     */
    async request(request, signal) {
      // 条件分支: 当前用例提供异步控制点时进入。
      // 执行内容: 在默认 Adapter 前等待显式放行，不使用固定 sleep。
      if (options.beforeRequest) {
        await options.beforeRequest(request, signal);
      }

      // 类型: object。
      // 作用: 保存原请求或负向用例生成的新请求，不修改 Provider 输入对象。
      const effectiveRequest = options.transformRequest
        ? options.transformRequest(request)
        : request;

      // 类型: object。
      // 作用: 保存默认 Adapter 基于受审 fixture 返回的隔离原始响应。
      const response = await baseAdapter.request(effectiveRequest, signal);

      // 返回值类型: object。
      // 作用: 正常路径原样返回；损坏 raw body 用例返回字段完整但 body 非法的候选。
      return options.transformResponse
        ? options.transformResponse(response)
        : response;
    }
  });
}

/**
 * 组合可信模拟 Provider 的公开 Host/Shell 测试环境。
 * 副作用: 创建 Memory Storage、注册统一工厂，并让 Host 后续创建独立 Context 与 Provider 实例。
 * 成功路径: 默认使用生产 MockNetworkAdapter fixture 和真实 sourceId。
 * 失败路径: contextSourceId 可制造 Host 可观察的跨源 Context 拒绝；networkOptions 可制造网络负向场景。
 *
 * @param {object} options 环境覆盖选项。
 * @param {object} options.networkOptions 默认 Adapter 公开门面变换。
 * @param {Function} options.contextSourceId 根据 Host sourceId 返回 Context sourceId 的函数。
 * @returns {object} Host、Memory Storage、Registry 和网络门面组成的测试环境。
 */
function createHostEnvironment(options = {}) {
  // 类型: MemorySourceStorageRepository。
  // 作用: 两个 Context 共享同一保存权威，隔离由 sourceId 命名空间而不是双 Repository 实现。
  const storageRepository = new MemorySourceStorageRepository();

  // 类型: object。
  // 作用: 创建生产默认 Adapter 或带公开负向变换的门面，始终不直接导入 fixture。
  const networkAdapter = createNetworkAdapterFacade(options.networkOptions || {});

  // 类型: object。
  // 作用: 创建当前环境独立可信工厂注册表。
  const factoryRegistry = createProviderFactoryRegistry();

  // 类型: object。
  // 作用: 创建统一可信模拟工厂，内部私有定位 A/B 数据集。
  const providerFactory = createMockSourceProviderFactory();

  // 副作用: 按生产唯一 key 注册工厂；Host 后续只通过 Registry 查询冻结门面。
  factoryRegistry.register(MOCK_SOURCE_PROVIDER_KEY, providerFactory);

  // 类型: object。
  // 作用: 创建 Provider 生命周期唯一权威，Context runtime 每个 sourceId 和 signal 独立组合。
  const host = createSourceExecutionHost({
    factoryRegistry,

    /**
     * 为一个 Host entry 创建同生命周期 SourceContext runtime。
     * 副作用: 创建独立 ChallengePort、LoggerController 和 StorageFacade；不访问 Provider 私有状态。
     * 成功路径: 返回精确 context/loggerController 两字段。
     * 失败路径: contextSourceId 返回其他身份时由 Host 的同源校验稳定拒绝。
     *
     * @param {string} sourceId Host entry 真实身份。
     * @param {AbortSignal} signal Host entry 生命周期信号。
     * @returns {object} 冻结 SourceContext runtime。
     */
    createSourceContextRuntime(sourceId, signal) {
      // 类型: string。
      // 作用: 正常使用 Host 身份；负向用例可显式返回另一安全身份验证同源门禁。
      const contextSourceId = options.contextSourceId
        ? options.contextSourceId(sourceId)
        : sourceId;

      // 类型: object。
      // 作用: 创建绑定 Context 身份和 Host signal 的挑战占位端口。
      const challengePort = createSourceChallengePort({
        sourceId: contextSourceId,
        signal
      });

      // 类型: object。
      // 作用: 创建绑定 Context 身份的脱敏有界日志控制器。
      const loggerController = createSourceLoggerController({
        sourceId: contextSourceId
      });

      // 类型: object。
      // 作用: 组合 Provider 可见六字段工具箱，StorageFacade 闭包绑定 contextSourceId。
      const context = createSourceContext({
        sourceId: contextSourceId,
        networkAdapter,
        storageRepository,
        challengePort,
        loggerController,
        signal
      });

      // 返回值类型: object。
      // 作用: 返回 Host 契约要求的精确两字段，不暴露测试环境或网络基础对象。
      return Object.freeze({
        context,
        loggerController
      });
    }
  });

  // 返回值类型: object。
  // 作用: 只暴露生产公开对象，测试不读取 Host/Provider 私有 entry。
  return Object.freeze({
    host,
    storageRepository,
    factoryRegistry,
    networkAdapter
  });
}

/**
 * 初始化并启动一个受管数据源。
 * 副作用: Host 创建 Context、Provider entry 并调用 initialize/start。
 * 成功路径: 返回 running 且 acceptingCalls=true 的隔离运行摘要。
 * 失败路径: SourceRecord、工厂、Context 或 Provider 错误按 Host 稳定 code 拒绝。
 *
 * @param {object} environment createHostEnvironment 返回环境。
 * @param {string} sourceId 数据源真实身份。
 * @returns {Promise<object>} running Host 运行摘要。
 */
async function initializeAndStartSource(environment, sourceId) {
  // 异步调用: 由 Host 校验记录、定位工厂、创建 Context 并采用 Provider。
  await environment.host.initialize(
    createSourceRecord(sourceId),
    { removedSystemSourceIds: [] }
  );

  // 返回值类型: Promise<object>。
  // 作用: 返回 Host 启动后的公开运行摘要，不返回 Provider 引用。
  return environment.host.start(sourceId);
}

/**
 * 通过 Host 公开方法幂等释放一组 sourceId。
 * 副作用: 对每个仍存在的 entry 执行拒绝新调用、abort、stop、dispose 和日志清理。
 * 成功路径: 全部 sourceId 释放后完成。
 * 失败路径: 任一公开 dispose 失败时原样拒绝，使测试不能掩盖资源清理问题。
 *
 * @param {object} environment createHostEnvironment 返回环境。
 * @param {Array<string>} sourceIds 待释放真实身份集合。
 * @returns {Promise<void>} 全部释放完成后结束。
 */
async function disposeSources(environment, sourceIds) {
  // 循环类型: for...of。
  // 初始值: sourceIds 第一项。
  // 终止条件: 全部受管 sourceId 完成幂等 dispose。
  // 循环作用: 保证每个测试只清理自身公开 Host 实例。
  for (const sourceId of sourceIds) {
    // 异步调用: Host 未初始化或已释放时按公开幂等契约直接完成。
    await environment.host.dispose(sourceId);
  }
}

/**
 * 断言操作使用指定稳定错误码失败。
 * 副作用: 执行 operation；不修改生产对象以外的测试控制流。
 * 成功路径: 同步抛错或异步拒绝的 code 与 expectedCode 完全一致时完成。
 * 失败路径: 操作成功、没有 code 或 code 不一致时由 assert.rejects 抛出测试失败。
 *
 * @param {Function} operation 返回 Promise 或同步抛错的操作函数。
 * @param {string} expectedCode 预期稳定错误码。
 * @returns {Promise<void>} 错误码断言完成后结束。
 */
async function assertRejectsWithCode(operation, expectedCode) {
  // 类型: Promise<*>。
  // 作用: 把同步抛错和异步拒绝统一成可由 assert.rejects 检查的 Promise。
  const operationPromise = Promise.resolve().then(operation);

  // 异步断言: 错误必须存在并精确提供 expectedCode，不能只断言 truthy 或任意 Error。
  await assert.rejects(operationPromise, error => (
    error instanceof Error && error.code === expectedCode
  ));
}

/**
 * 从标准筛选响应中定位指定筛选组。
 * 纯函数: 只读取 response.groups，不修改响应或选项。
 * 成功路径: 返回名称精确匹配且包含 options 数组的筛选组。
 * 失败路径: 缺少筛选组时用明确断言终止测试，不返回空对象兜底。
 *
 * @param {object} response 标准 SourceFilterMetaResponse。
 * @param {string} groupName 目标筛选组 name。
 * @returns {object} 匹配筛选组。
 */
function findFilterGroup(response, groupName) {
  // 类型: object|undefined。
  // 作用: 定位 Provider 统计生成的目标组，不依赖数组固定位置。
  const group = response.groups.find(candidate => candidate.name === groupName);

  // 断言作用: 标准筛选响应必须包含目标组和可遍历 options，缺失不能静默按空统计通过。
  assert.notEqual(group, undefined, `缺少筛选组: ${groupName}`);
  assert.equal(Array.isArray(group.options), true, `${groupName}.options 必须是数组`);

  // 返回值类型: object。
  // 作用: 返回已经通过结构断言的筛选组。
  return group;
}

/**
 * 验证筛选项 count 并累计正数统计。
 * 纯函数: 只读取 group.options，不修改选项。
 * 成功路径: 每个 count 都是非负安全整数，并返回大于零的候选总数。
 * 失败路径: 非数字、负值或全部零统计由明确断言终止测试。
 *
 * @param {object} group 已验证筛选组。
 * @returns {number} 所有非“全部”选项的累计候选数量。
 */
function sumPositiveOptionCounts(group) {
  // 类型: Array<object>。
  // 作用: 排除 value 为空的“全部”选项，避免同一候选被总计和具体项重复计入证明。
  const countedOptions = group.options.filter(option => option.value !== '');

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 精确验证每个数据集统计结果是非负安全整数。
  countedOptions.forEach((option) => {
    assert.equal(Number.isSafeInteger(option.count), true);
    assert.equal(option.count >= 0, true);
  });

  // 类型: number。
  // 作用: 累计具体筛选项候选数，至少一个正数才证明 Provider 执行了真实统计。
  const total = countedOptions.reduce((sum, option) => sum + option.count, 0);

  // 断言作用: 当前受审 movie/tv 数据集必须产生至少一个可匹配候选，不允许空组冒充统计完成。
  assert.equal(total > 0, true);

  // 返回值类型: number。
  // 作用: 返回可用于 A/B 数据集差异比较的统计摘要。
  return total;
}

// 测试目的: 工厂必须是精确冻结三字段门面，并显式支持四个受审 sourceId、拒绝未知 Definition。
test('统一模拟 Provider 工厂精确支持四个受审数据源', () => {
  // 类型: object。
  // 作用: 创建生产可信模拟工厂，测试不访问其内部数据集映射。
  const factory = createMockSourceProviderFactory();

  // 断言作用: 工厂根对象精确且冻结，providerKey 与导出唯一键一致。
  assert.deepEqual(Object.keys(factory).sort(), ['create', 'providerKey', 'supports']);
  assert.equal(Object.isFrozen(factory), true);
  assert.equal(factory.providerKey, MOCK_SOURCE_PROVIDER_KEY);

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 证明 A/B 两类四个真实 sourceId 均由同一工厂支持。
  TEST_SUPPORTED_SOURCE_IDS.forEach((sourceId) => {
    assert.equal(factory.supports(createSourceRecord(sourceId).definition), true, sourceId);
  });

  // 断言作用: 未知 Definition 返回严格 false，不创建临时别名或回退默认数据集。
  assert.equal(factory.supports(createSourceRecord('unsupported-source').definition), false);
});

// 测试目的: 同一 Host/Shell/工厂必须返回可辨认 A/B 内容，并以同键 cache 证明命名空间和返回引用隔离。
test('system-source-1 与 system-source-2 内容和私有 cache 通过同一 Host/Shell 独立运行', async () => {
  // 类型: object。
  // 作用: 创建共享 Registry、Host、默认 Adapter 和 Memory Storage 的双源环境。
  const environment = createHostEnvironment();

  try {
    // 异步调用: 并发初始化和启动两个 sourceId，Host 为它们创建独立 Context、signal 和 Provider。
    await Promise.all([
      initializeAndStartSource(environment, TEST_SOURCE_IDS.protocolA),
      initializeAndStartSource(environment, TEST_SOURCE_IDS.protocolB)
    ]);

    // 类型: Array<object>。
    // 作用: 保存 Host 采用门禁通过的 A/B 标准内容响应。
    const [protocolAResponse, protocolBResponse] = await Promise.all([
      environment.host.fetchData(
        TEST_SOURCE_IDS.protocolA,
        createDataRequest(TEST_SOURCE_IDS.protocolA)
      ),
      environment.host.fetchData(
        TEST_SOURCE_IDS.protocolB,
        createDataRequest(TEST_SOURCE_IDS.protocolB)
      )
    ]);

    // 断言作用: 响应、请求和每条 ContentItem 使用统一真实 sourceId，不依赖 mock-source 别名。
    assert.equal(protocolAResponse.sourceId, TEST_SOURCE_IDS.protocolA);
    assert.equal(protocolAResponse.request.sourceId, TEST_SOURCE_IDS.protocolA);
    assert.equal(protocolAResponse.items.every(item => item.sourceId === TEST_SOURCE_IDS.protocolA), true);
    assert.equal(protocolBResponse.sourceId, TEST_SOURCE_IDS.protocolB);
    assert.equal(protocolBResponse.request.sourceId, TEST_SOURCE_IDS.protocolB);
    assert.equal(protocolBResponse.items.every(item => item.sourceId === TEST_SOURCE_IDS.protocolB), true);

    // 断言作用: A/B 原始协议经各自解码器生成不同 id 和 title，不能由同一硬编码标准响应冒充双源。
    assert.equal(protocolAResponse.items.length > 0, true);
    assert.equal(protocolBResponse.items.length > 0, true);
    assert.match(protocolAResponse.items[0].id, /^system-source-1-/u);
    assert.match(protocolBResponse.items[0].id, /^system-source-2-/u);
    assert.notEqual(protocolAResponse.items[0].title, protocolBResponse.items[0].title);

    // 类型: string。
    // 作用: 保存首次 A 协议标题，供调用方修改返回引用后的重复请求比较。
    const originalProtocolATitle = protocolAResponse.items[0].title;

    // 副作用范围: 只修改调用方持有的候选响应，不应穿透 Provider 数据集或后续响应。
    protocolAResponse.items[0].title = '调用方污染标题';

    // 类型: object。
    // 作用: 重复请求 A 协议内容，验证 Provider 每次返回隔离标准对象。
    const repeatedProtocolAResponse = await environment.host.fetchData(
      TEST_SOURCE_IDS.protocolA,
      createDataRequest(TEST_SOURCE_IDS.protocolA)
    );
    assert.equal(repeatedProtocolAResponse.items[0].title, originalProtocolATitle);

    // 类型: Array<object>。
    // 作用: 通过 Repository 公开 list 读取两个 Context 在 cache 保存的诊断条目。
    const [protocolACacheEntries, protocolBCacheEntries] = await Promise.all([
      environment.storageRepository.list(TEST_SOURCE_IDS.protocolA, TEST_CACHE_PARTITION),
      environment.storageRepository.list(TEST_SOURCE_IDS.protocolB, TEST_CACHE_PARTITION)
    ]);

    // 断言作用: 两个 Provider 都保存同 key、同结构诊断值；值相同仍能并存，证明隔离不能依赖人为制造字段差异。
    assert.equal(protocolACacheEntries.length, 1);
    assert.equal(protocolBCacheEntries.length, 1);
    assert.equal(protocolACacheEntries[0].key, protocolBCacheEntries[0].key);
    assert.deepEqual(protocolACacheEntries[0].value, protocolBCacheEntries[0].value);

    // 副作用范围: 只通过 Repository 公开接口覆盖 A 协议命名空间同键值，用于证明 B 协议值不会跟随变化。
    await environment.storageRepository.set(
      TEST_SOURCE_IDS.protocolA,
      TEST_CACHE_PARTITION,
      protocolACacheEntries[0].key,
      { ...protocolACacheEntries[0].value, sourceMarker: TEST_SOURCE_IDS.protocolA }
    );

    // 类型: object。
    // 作用: 重新读取 B 协议同键值，确认 A 命名空间的真实写入不会穿透到 B。
    const protocolBCacheValueAfterProtocolAWrite = await environment.storageRepository.get(
      TEST_SOURCE_IDS.protocolB,
      TEST_CACHE_PARTITION,
      protocolBCacheEntries[0].key
    );
    assert.deepEqual(protocolBCacheValueAfterProtocolAWrite, protocolBCacheEntries[0].value);

    // 类型: object。
    // 作用: 保存 Repository 返回的 A 协议 cache 隔离副本，供外部修改攻击。
    const protocolACacheValue = await environment.storageRepository.get(
      TEST_SOURCE_IDS.protocolA,
      TEST_CACHE_PARTITION,
      protocolACacheEntries[0].key
    );

    // 类型: string。
    // 作用: 保存修改前严格 JSON 文本，供二次读取执行深值比较。
    const originalCacheValueText = JSON.stringify(protocolACacheValue);

    // 类型: string。
    // 作用: 读取诊断对象第一项字段，确保攻击修改真实作用于返回副本而不是添加无关字段。
    const mutableField = Object.keys(protocolACacheValue)[0];
    assert.notEqual(mutableField, undefined);

    // 副作用范围: 只修改调用方持有的 Repository 返回副本。
    protocolACacheValue[mutableField] = '调用方污染 cache';

    // 类型: object。
    // 作用: 再次读取同一 sourceId/partition/key，证明保存权威没有被返回引用穿透。
    const repeatedProtocolACacheValue = await environment.storageRepository.get(
      TEST_SOURCE_IDS.protocolA,
      TEST_CACHE_PARTITION,
      protocolACacheEntries[0].key
    );
    assert.equal(JSON.stringify(repeatedProtocolACacheValue), originalCacheValueText);
  } finally {
    // 清理作用: 只通过 Host 公开 dispose 释放两个 Context、Provider、signal 和日志控制器。
    await disposeSources(environment, Object.values(TEST_SOURCE_IDS));
  }
});

// 测试目的: movie/tv 筛选响应必须按当前 sourceId 统计真实目录，并保持 A/B 结果可区分。
test('system-source-1 与 system-source-2 返回可辨认 movie/tv 筛选统计', async () => {
  // 类型: object。
  // 作用: 创建正常双源公开运行环境。
  const environment = createHostEnvironment();

  try {
    // 异步调用: 两个数据源在各自 Host entry 中进入 running。
    await Promise.all([
      initializeAndStartSource(environment, TEST_SOURCE_IDS.protocolA),
      initializeAndStartSource(environment, TEST_SOURCE_IDS.protocolB)
    ]);

    // 类型: Array<object>。
    // 作用: 并发读取两个 sourceId 的 movie/tv 四份标准筛选响应。
    const [protocolAMovie, protocolBMovie, protocolATv, protocolBTv] = await Promise.all([
      environment.host.fetchFilterMeta(
        TEST_SOURCE_IDS.protocolA,
        createFilterRequest(TEST_SOURCE_IDS.protocolA, 'movie')
      ),
      environment.host.fetchFilterMeta(
        TEST_SOURCE_IDS.protocolB,
        createFilterRequest(TEST_SOURCE_IDS.protocolB, 'movie')
      ),
      environment.host.fetchFilterMeta(
        TEST_SOURCE_IDS.protocolA,
        createFilterRequest(TEST_SOURCE_IDS.protocolA, 'tv')
      ),
      environment.host.fetchFilterMeta(
        TEST_SOURCE_IDS.protocolB,
        createFilterRequest(TEST_SOURCE_IDS.protocolB, 'tv')
      )
    ]);

    // 断言作用: 四份响应和请求保持真实 sourceId/pageKey，不共用第二套筛选 Provider 身份。
    assert.equal(protocolAMovie.sourceId, TEST_SOURCE_IDS.protocolA);
    assert.equal(protocolAMovie.request.sourceId, TEST_SOURCE_IDS.protocolA);
    assert.equal(protocolAMovie.pageKey, 'movie');
    assert.equal(protocolBMovie.sourceId, TEST_SOURCE_IDS.protocolB);
    assert.equal(protocolATv.sourceId, TEST_SOURCE_IDS.protocolA);
    assert.equal(protocolATv.pageKey, 'tv');
    assert.equal(protocolBTv.sourceId, TEST_SOURCE_IDS.protocolB);
    assert.equal(protocolBTv.pageKey, 'tv');

    // 类型: number。
    // 作用: 验证 A 协议 movie genre 组包含非负安全整数统计，并保存可比较摘要。
    const protocolAMovieCount = sumPositiveOptionCounts(findFilterGroup(protocolAMovie, 'genre'));

    // 类型: number。
    // 作用: 验证 B 协议 movie genre 组包含非负安全整数统计，并保存可比较摘要。
    const protocolBMovieCount = sumPositiveOptionCounts(findFilterGroup(protocolBMovie, 'genre'));

    // 类型: number。
    // 作用: 验证 A 协议 tv genre 组包含非负安全整数统计，并保存可比较摘要。
    const protocolATvCount = sumPositiveOptionCounts(findFilterGroup(protocolATv, 'genre'));

    // 类型: number。
    // 作用: 验证 B 协议 tv genre 组包含非负安全整数统计，并保存可比较摘要。
    const protocolBTvCount = sumPositiveOptionCounts(findFilterGroup(protocolBTv, 'genre'));

    // 断言作用: A/B 数据集的标准筛选组或统计至少一处不同，不能硬编码同一组响应。
    assert.notDeepEqual(protocolAMovie.groups, protocolBMovie.groups);
    assert.notDeepEqual(protocolATv.groups, protocolBTv.groups);
    assert.equal(protocolAMovieCount > 0 && protocolBMovieCount > 0, true);
    assert.equal(protocolATvCount > 0 && protocolBTvCount > 0, true);
  } finally {
    // 清理作用: 通过公开 Host 释放本测试两个 Provider 实例。
    await disposeSources(environment, Object.values(TEST_SOURCE_IDS));
  }
});

// 测试目的: 两个 Provider 健康检查必须返回正常状态、标准 ISO 时间和空不可用原因。
test('system-source-1 与 system-source-2 健康结果符合标准契约', async () => {
  // 类型: object。
  // 作用: 创建使用四源 /health 默认 fixture 的双源环境。
  const environment = createHostEnvironment();

  try {
    // 异步调用: 初始化并启动核心双源，健康检查只能在 running 阶段执行。
    await Promise.all([
      initializeAndStartSource(environment, TEST_SOURCE_IDS.protocolA),
      initializeAndStartSource(environment, TEST_SOURCE_IDS.protocolB)
    ]);

    // 类型: Array<object>。
    // 作用: 保存 Host 生命周期复查通过的两份健康候选。
    const healthResults = await Promise.all([
      environment.host.checkHealth(TEST_SOURCE_IDS.protocolA),
      environment.host.checkHealth(TEST_SOURCE_IDS.protocolB)
    ]);

    // 循环类型: Array.prototype.forEach。
    // 循环作用: 两个协议都必须满足同一标准健康结果，而不是返回源站原始结构。
    healthResults.forEach((result) => {
      assert.equal(result.healthStatus, 'normal');
      assert.equal(result.unavailableReason, '');
      assert.equal(new Date(result.checkedAt).toISOString(), result.checkedAt);
    });
  } finally {
    // 清理作用: 释放两份健康检查使用的公开 Host 实例。
    await disposeSources(environment, Object.values(TEST_SOURCE_IDS));
  }
});

// 测试目的: 未支持 Definition、跨源 Context/请求、未知端点和损坏 raw body 必须使用稳定公开错误失败。
test('Provider 工厂和 Shell 失败矩阵保持稳定错误边界', async () => {
  // 类型: object。
  // 作用: 未支持 Definition 环境使用真实工厂和正常 Context，Host 必须在创建 Provider 前拒绝。
  const unsupportedEnvironment = createHostEnvironment();
  await assertRejectsWithCode(
    () => unsupportedEnvironment.host.initialize(
      createSourceRecord('unsupported-source'),
      { removedSystemSourceIds: [] }
    ),
    SOURCE_EXECUTION_HOST_ERROR_CODE.gateRejected
  );
  assert.equal(
    await unsupportedEnvironment.host.getRuntimeState('unsupported-source'),
    null
  );

  // 类型: object。
  // 作用: Context runtime 故意为 系统数据源1 返回 系统数据源2 身份，Host 必须拒绝跨源工具箱。
  const crossContextEnvironment = createHostEnvironment({
    /**
     * 为跨源负向用例返回与 Host entry 不同的 Context 身份。
     * 纯函数: 固定返回 系统数据源2，不修改 Host sourceId 或外部状态。
     * 成功路径: createHostEnvironment 使用该身份创建结构完整的 Context runtime。
     * 失败路径: Host 比较 entry 与 Context 身份后返回稳定 validation。
     *
     * @returns {string} B 协议真实 sourceId，用于制造同源门禁失败。
     */
    contextSourceId: () => TEST_SOURCE_IDS.protocolB
  });
  await assertRejectsWithCode(
    () => crossContextEnvironment.host.initialize(
      createSourceRecord(TEST_SOURCE_IDS.protocolA),
      { removedSystemSourceIds: [] }
    ),
    SOURCE_EXECUTION_HOST_ERROR_CODE.validation
  );
  assert.equal(
    await crossContextEnvironment.host.getRuntimeState(TEST_SOURCE_IDS.protocolA),
    null
  );

  // 类型: object。
  // 作用: 正常环境用于验证运行中 Provider 拒绝请求对象声明其他 sourceId。
  const crossRequestEnvironment = createHostEnvironment();
  try {
    await initializeAndStartSource(crossRequestEnvironment, TEST_SOURCE_IDS.protocolA);
    // 断言作用: 跨源业务请求由 Provider 输入边界直接返回 TypeError；Host 只管理生命周期，不把业务校验伪装成 Shell 或生命周期错误码。
    await assert.rejects(
      crossRequestEnvironment.host.fetchData(
        TEST_SOURCE_IDS.protocolA,
        createDataRequest(TEST_SOURCE_IDS.protocolB)
      ),
      error => error instanceof TypeError
        && error.message === 'provider request.sourceId 与 Provider 不一致'
    );
  } finally {
    await disposeSources(crossRequestEnvironment, [TEST_SOURCE_IDS.protocolA]);
  }

  // 类型: object。
  // 作用: 请求变换只把 Provider 目录地址改为同源未知端点，仍由默认 Adapter 执行精确路由查找。
  const unknownEndpointEnvironment = createHostEnvironment({
    networkOptions: {
      /**
       * 把标准请求改写为同源未知 HTTPS 地址。
       * 纯函数: 返回新的 request，不修改 Provider 请求候选。
       * @param {object} request 标准网络请求。
       * @returns {object} URL 改写后的完整请求。
       */
      transformRequest: request => ({
        ...request,
        url: `https://invalid/${request.sourceId}/unknown-endpoint`
      })
    }
  });
  try {
    await initializeAndStartSource(unknownEndpointEnvironment, TEST_SOURCE_IDS.protocolA);
    await assertRejectsWithCode(
      () => unknownEndpointEnvironment.host.fetchData(
        TEST_SOURCE_IDS.protocolA,
        createDataRequest(TEST_SOURCE_IDS.protocolA)
      ),
      SOURCE_SHELL_ERROR_CODE.notFound
    );
  } finally {
    await disposeSources(unknownEndpointEnvironment, [TEST_SOURCE_IDS.protocolA]);
  }

  // 类型: object。
  // 作用: 响应变换保留默认 Adapter 标准外壳，只把原始字节换为协议解码器不接受的字段集合。
  const damagedBodyEnvironment = createHostEnvironment({
    networkOptions: {
      /**
       * 生成字段完整但 raw body 损坏的 SourceNetworkResponse。
       * 纯函数: 返回新冻结对象，不修改默认 Adapter 响应。
       * @param {object} response 默认 Adapter 隔离响应。
       * @returns {object} body 被替换为可解析但业务字段损坏的原始字节响应。
       */
      transformResponse: response => Object.freeze({
        ...response,
        body: new TextEncoder().encode('{"damaged":true}').buffer
      })
    }
  });
  try {
    await initializeAndStartSource(damagedBodyEnvironment, TEST_SOURCE_IDS.protocolA);
    // 断言作用: 网络外壳合法但 A 协议 body 损坏时，由数据集解码器返回精确 TypeError；不能伪装成 Adapter fixture 错误。
    await assert.rejects(
      damagedBodyEnvironment.host.fetchData(
        TEST_SOURCE_IDS.protocolA,
        createDataRequest(TEST_SOURCE_IDS.protocolA)
      ),
      error => error instanceof TypeError
        && error.message === 'protocolA.catalog.site 必须是普通对象'
    );
  } finally {
    await disposeSources(damagedBodyEnvironment, [TEST_SOURCE_IDS.protocolA]);
  }
});

// 测试目的: 在途 Provider 网络调用被 stop 中止后，即使控制点放行也不能返回旧候选结果。
test('stop 无固定 sleep 地中止在途调用并拒绝旧结果', async () => {
  // 类型: object。
  // 作用: Provider 网络请求到达公开门面后通知测试继续发起 stop。
  const requestEntered = createDeferred();

  // 类型: object。
  // 作用: stop 已同步 abort 后由测试显式放行网络门面继续委托默认 Adapter。
  const requestRelease = createDeferred();

  // 类型: object。
  // 作用: 通过 beforeRequest 建立真实在途窗口，不使用 setTimeout 或固定等待毫秒数。
  const environment = createHostEnvironment({
    networkOptions: {
      /**
       * 等待测试显式释放当前网络请求。
       * 副作用: 完成 requestEntered，并等待 requestRelease；不读取 fixture 或修改 signal。
       * 成功路径: requestRelease 完成后允许门面继续调用默认 Adapter。
       * 失败路径: requestRelease 被拒绝时原样传播错误，本测试不使用该分支吞掉失败。
       * @returns {Promise<void>} requestRelease 完成后结束。
       */
      beforeRequest: async () => {
        requestEntered.resolve();
        await requestRelease.promise;
      }
    }
  });

  await initializeAndStartSource(environment, TEST_SOURCE_IDS.protocolA);

  // 类型: Promise<object>。
  // 作用: 保存已经进入 Provider/Context 网络链但尚未返回的内容调用。
  const fetchPromise = environment.host.fetchData(
    TEST_SOURCE_IDS.protocolA,
    createDataRequest(TEST_SOURCE_IDS.protocolA)
  );

  // 异步控制: 等待网络门面真实收到请求，而不是按时间猜测调用已经开始。
  await requestEntered.promise;

  // 类型: Promise<object>。
  // 作用: stop 同步关闭 acceptingCalls 并 abort，随后等待当前 fetch finally 释放计数。
  const stopPromise = environment.host.stop(TEST_SOURCE_IDS.protocolA);

  // 副作用: 放行网络门面继续调用默认 Adapter；signal 已中止，不能返回 fixture 候选。
  requestRelease.resolve();

  // 断言作用: Host 把停止期间的底层 aborted 统一收敛为生命周期 callAborted，旧结果不能返回 service。
  await assertRejectsWithCode(
    () => fetchPromise,
    SOURCE_EXECUTION_HOST_ERROR_CODE.callAborted
  );

  // 类型: object。
  // 作用: 保存 drain 完成后的停止摘要，验证没有遗留在途计数。
  const stoppedState = await stopPromise;
  assert.equal(stoppedState.acceptingCalls, false);
  assert.equal(stoppedState.activeCallCount, 0);

  // 清理作用: stop 后通过公开 dispose 永久释放 entry。
  await environment.host.dispose(TEST_SOURCE_IDS.protocolA);
});

// 测试目的: stop 和 dispose 后业务调用分别使用 invalidState/notFound 失败，不能绕过 Host 获得 Provider 结果。
test('stop 和 dispose 后 Host 公开业务调用不能成功', async () => {
  // 类型: object。
  // 作用: 创建正常单源运行环境验证两个生命周期边界。
  const environment = createHostEnvironment();
  await initializeAndStartSource(environment, TEST_SOURCE_IDS.protocolA);

  // 类型: object。
  // 作用: 保存停止摘要，证明 entry 仍存在但已经拒绝新调用。
  const stoppedState = await environment.host.stop(TEST_SOURCE_IDS.protocolA);
  assert.equal(stoppedState.acceptingCalls, false);

  // 断言作用: stopped entry 明确返回 invalidState，不调用 Provider 或网络适配器。
  await assertRejectsWithCode(
    () => environment.host.fetchData(
      TEST_SOURCE_IDS.protocolA,
      createDataRequest(TEST_SOURCE_IDS.protocolA)
    ),
    SOURCE_EXECUTION_HOST_ERROR_CODE.invalidState
  );

  // 副作用: 通过公开 dispose 永久删除当前 entry 和 Shell 引用。
  await environment.host.dispose(TEST_SOURCE_IDS.protocolA);
  assert.equal(await environment.host.getRuntimeState(TEST_SOURCE_IDS.protocolA), null);

  // 断言作用: 释放后 sourceId 未命中，不能通过旧 Provider 引用继续调用。
  await assertRejectsWithCode(
    () => environment.host.checkHealth(TEST_SOURCE_IDS.protocolA),
    SOURCE_EXECUTION_HOST_ERROR_CODE.notFound
  );
});
