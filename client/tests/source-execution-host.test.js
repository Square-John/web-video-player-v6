/*
  source-execution-host.test.js 模块说明

  - 文件职责:
      验证可信 Provider 工厂注册表和 SourceExecutionHost 的门禁、生命周期、受管调用、并发停止及失败补偿契约。
      使用纯 Node 夹具构造可控 Provider 和 SourceContext runtime，不访问真实网络、页面、store 或用户脚本文本。
      重点防止初始化微任务与立即 stop/dispose 竞争、停止后旧候选结果返回、释放失败丢失 entry 等回归。

  - 导入库及文件汇总(6 条，内置 2 条，第三方 0 条，自定义 4 条):
      test: 内置模块，声明 Node 测试用例。
      assert: 内置模块，执行严格相等、异常、冻结和调用顺序断言。
      SOURCE_EXECUTION_HOST_PHASE: 自定义配置，断言 Host 细粒度生命周期阶段。
      SOURCE_EXECUTION_HOST_ERROR_CODE: 自定义错误配置，断言稳定失败分类。
      createProviderFactoryRegistry: 自定义运行模块，创建隔离可信工厂注册表。
      createSourceExecutionHost: 自定义运行模块，创建待测 Provider 生命周期宿主。

  - 模块级常量:
      TEST_PROVIDER_KEY: string，测试可信工厂注册键。
      TEST_SOURCE_ID: string，默认系统模拟源身份。
      TEST_PACKAGE_REF: string，默认 SourcePackage 引用。
      TEST_SCRIPT_HASH: string，已验证脚本指纹。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createDeferred(): Function，创建可控 Promise 用于并发生命周期测试。
      createSourceRecord(options): Function，创建符合 Host 门禁的轻量 SourceRecord。
      createProviderController(options): Function，创建可观察且可注入失败的标准 Provider。
      createContextRuntime(sourceId, signal): Function，创建同源同 signal 的冻结 Context 和日志控制器。
      createHostEnvironment(options): Function，组合注册表、工厂、Provider 控制器和 Host。
      assertRejectsWithCode(operation, expectedCode): Function，断言异步操作使用稳定 Host 错误码失败。

  - 模块级类:
      无

  - 对外导出:
      无；本文件由 Node test runner 直接执行。
*/

// 导入来源: node:test。
// 导入内容: test Node 内置测试声明函数。
// 文件作用: 注册 Host 门禁、生命周期、并发和失败补偿测试。
import test from 'node:test';

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言工具。
// 文件作用: 验证返回值、错误码、调用顺序、引用隔离和运行摘要。
import assert from 'node:assert/strict';

// 导入来源: ../src/runtime/source-host/sourceExecutionHost.config.js。
// 导入内容: SOURCE_EXECUTION_HOST_PHASE Host 内部阶段枚举。
// 文件作用: 不依赖散落字符串断言初始化、运行、停止和失败状态。
import { SOURCE_EXECUTION_HOST_PHASE } from '../src/runtime/source-host/sourceExecutionHost.config.js';

// 导入来源: ../src/runtime/source-host/sourceExecutionHostErrors.js。
// 导入内容: SOURCE_EXECUTION_HOST_ERROR_CODE 稳定错误码枚举。
// 文件作用: 断言调用方可以按 code 识别失败，不解析中文文案。
import { SOURCE_EXECUTION_HOST_ERROR_CODE } from '../src/runtime/source-host/sourceExecutionHostErrors.js';

// 导入来源: ../src/runtime/source-host/providerFactoryRegistry.js。
// 导入内容: createProviderFactoryRegistry 可信工厂注册表工厂。
// 文件作用: 验证显式注册、重复拒绝和 Host 工厂定位。
import { createProviderFactoryRegistry } from '../src/runtime/source-host/providerFactoryRegistry.js';

// 导入来源: ../src/runtime/sourceExecutionHost.js。
// 导入内容: createSourceExecutionHost 执行宿主工厂。
// 文件作用: 创建每个测试独立的 Provider 生命周期权威。
import { createSourceExecutionHost } from '../src/runtime/sourceExecutionHost.js';

// 类型: string。
// 作用: 测试中唯一允许注册的可信 Provider 工厂键。
const TEST_PROVIDER_KEY = 'trusted-test-provider';

// 类型: string。
// 作用: 默认系统模拟源身份，贯穿 SourceRecord、Context、Provider、请求和响应。
const TEST_SOURCE_ID = 'source-host-test';

// 类型: string。
// 作用: 默认 SourcePackage 引用，用于验证 Definition 与 SourceRecord 包身份一致。
const TEST_PACKAGE_REF = `source-package::${TEST_SOURCE_ID}`;

// 类型: string。
// 作用: 模拟 Repository 已验证脚本指纹，让正常记录通过 Host 完整性门禁。
const TEST_SCRIPT_HASH = '1234abcd';

/**
 * 创建可由测试显式完成或拒绝的 Promise。
 * 副作用: 把 resolve/reject 保存到返回控制器，调用后会改变 promise 的收敛状态。
 * 成功路径: resolve(value) 让 promise 完成并返回 value。
 * 失败路径: reject(error) 让 promise 以指定 error 失败。
 *
 * @returns {object} 可控 Promise 及其完成函数。
 * @returns {Promise<*>} return.promise 待测试控制的 Promise。
 * @returns {Function} return.resolve 完成 Promise 的函数。
 * @returns {Function} return.reject 拒绝 Promise 的函数。
 */
function createDeferred() {
  // 类型: Function|undefined。
  // 作用: 保存 Promise 构造器提供的 resolve，供测试在指定生命周期节点放行。
  let resolvePromise;

  // 类型: Function|undefined。
  // 作用: 保存 Promise 构造器提供的 reject，供测试注入 Provider 异步失败。
  let rejectPromise;

  // 类型: Promise<*>。
  // 作用: 建立尚未收敛的异步控制点，模拟初始化或业务调用仍在执行。
  const promise = new Promise((resolve, reject) => {
    // 副作用: 捕获当前 Promise 的完成函数，不修改生产代码或全局时间。
    resolvePromise = resolve;

    // 副作用: 捕获当前 Promise 的拒绝函数，允许测试精确制造失败时机。
    rejectPromise = reject;
  });

  // 返回值类型: object。
  // 作用: 返回单次测试私有异步控制器。
  return Object.freeze({
    promise,
    resolve: resolvePromise,
    reject: rejectPromise
  });
}

/**
 * 创建符合 Host 轻量门禁契约的 SourceRecord。
 * 纯函数: 每次返回新的严格 JSON 对象，不共享 Definition、runtime、authorization 或 cache 引用。
 * 成功路径: 默认生成启用、完整、系统源且未软隐藏的记录。
 * 失败路径: 测试可通过 options 精确覆盖门禁字段，由 Host 产生对应稳定错误。
 *
 * @param {object} options 记录覆盖选项。
 * @param {string} options.sourceId 数据源身份。
 * @param {string} options.providerKey 可信工厂键。
 * @param {string} options.sourceKind 系统源或自定义源。
 * @param {boolean} options.enabled 用户启用投影。
 * @param {string} options.currentScriptHash 已验证脚本指纹。
 * @param {object} options.authorization 授权快照。
 * @returns {object} Host initialize 可消费的轻量 SourceRecord。
 */
function createSourceRecord(options = {}) {
  // 类型: string。
  // 作用: 使用显式身份或默认测试身份，保证包、空间和 Provider 可以同源构造。
  const sourceId = options.sourceId || TEST_SOURCE_ID;

  // 类型: string。
  // 作用: 生成与当前 sourceId 绑定的包引用，避免测试无意制造关联错误。
  const packageRef = sourceId === TEST_SOURCE_ID
    ? TEST_PACKAGE_REF
    : `source-package::${sourceId}`;

  // 类型: boolean。
  // 作用: 只有显式提供 enabled 时采用测试值，允许 false 真正进入禁用门禁场景。
  const enabled = Object.hasOwn(options, 'enabled') ? options.enabled : true;

  // 类型: string。
  // 作用: 只有显式提供指纹时采用测试值，允许空字符串验证完整性失败关闭。
  const currentScriptHash = Object.hasOwn(options, 'currentScriptHash')
    ? options.currentScriptHash
    : TEST_SCRIPT_HASH;

  // 返回值类型: object。
  // 作用: 返回字段精确的 SourceRecord，脚本文本和私有空间真实值不会进入 Host。
  return {
    // 类型: object。
    // 作用: 提供 Host 身份、工厂、包引用、来源类型和授权版本门禁输入。
    definition: {
      schemaVersion: '1.0.0',
      id: sourceId,
      name: 'Host 测试数据源',
      description: '用于纯 Node 生命周期契约测试。',
      sourceKind: options.sourceKind || 'system',
      version: 'v1.0.0',
      providerKey: options.providerKey || TEST_PROVIDER_KEY,
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
    // 作用: 定位当前已验证安装包；Host 只校验引用，不读取包正文。
    packageRef,

    // 类型: string。
    // 作用: 固定为 sourceId，证明 Context 私有空间不能绑定其他数据源。
    storageNamespace: sourceId,

    // 类型: object。
    // 作用: 提供启用、完整性、健康和更新运行投影；Host 只消费 enabled/currentScriptHash。
    runtime: {
      enabled,
      providerStatus: 'stopped',
      currentScriptHash,
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
    // 作用: 提供自定义源授权门禁快照；系统源默认也保留完整结构以贴合正式投影。
    authorization: options.authorization || {
      status: 'authorized',
      authorizedAt: '2026-07-16T00:00:00.000Z',
      authorizedVersion: 'v1.0.0',
      authorizedScriptHash: currentScriptHash
    },

    // 类型: object。
    // 作用: 保留设置页两级缓存摘要字段，Host 不读取或修改这些值。
    cache: {
      temporaryCacheBytes: 0,
      totalCacheBytes: 0
    }
  };
}

/**
 * 创建可观察且可注入生命周期行为的标准 Provider。
 * 副作用: Provider 方法调用会写入 controller.events、context 和调用计数；不访问真实外部能力。
 * 成功路径: 未覆盖的方法返回稳定标准候选对象或完成生命周期。
 * 失败路径: options 中的覆盖函数可以抛错或返回待控制 Promise。
 *
 * @param {object} options Provider 行为覆盖。
 * @param {string} options.sourceId Provider 真实身份。
 * @param {Function} options.initialize 可选初始化行为。
 * @param {Function} options.start 可选启动行为。
 * @param {Function} options.fetchData 可选内容行为。
 * @param {Function} options.stop 可选停止行为。
 * @param {Function} options.dispose 可选释放行为。
 * @returns {object} Provider、事件、Context 和调用计数控制器。
 */
function createProviderController(options = {}) {
  // 类型: Array<string>。
  // 作用: 按真实调用顺序记录生命周期和业务方法，供 FIFO、drain 与补偿断言。
  const events = [];

  // 类型: object。
  // 作用: 保存 Provider 采用的 Context 和各方法调用次数，不把测试字段夹带进 Provider 根对象。
  const state = {
    context: null,
    initializeCalls: 0,
    startCalls: 0,
    fetchDataCalls: 0,
    fetchFilterMetaCalls: 0,
    checkHealthCalls: 0,
    stopCalls: 0,
    disposeCalls: 0
  };

  // 类型: string。
  // 作用: Provider 自报身份，默认与 SourceRecord 和 Context 一致。
  const sourceId = options.sourceId || TEST_SOURCE_ID;

  // 类型: object。
  // 作用: 精确实现 SourceProvider 十字段契约，不携带测试状态或外部能力引用。
  const provider = {
    id: sourceId,

    /**
     * 采用 Host 创建的唯一 SourceContext。
     * 副作用: 更新当前控制器的初始化次数、Context 引用和事件顺序。
     * 成功路径: 记录 Context 和调用顺序，再执行可选测试覆盖。
     * 失败路径: 可选覆盖抛错或拒绝时原样交给 Host 生命周期边界。
     * @param {object} context 当前 Provider 工具箱。
     * @returns {Promise<void>} 初始化测试行为完成后结束。
     */
    async initialize(context) {
      state.initializeCalls += 1;
      state.context = context;
      events.push('initialize');

      // 条件分支: 当前场景注入 initialize 行为时进入。
      // 执行内容: 返回可控 Promise 或测试失败，让 Host 处理初始化结果。
      if (options.initialize) return options.initialize(context, state, events);
    },

    /**
     * 启动测试 Provider。
     * 副作用: 更新当前控制器的启动次数和事件顺序。
     * 成功路径: 记录启动次数并执行可选覆盖。
     * 失败路径: 可选覆盖抛错时由 Host 转换为 lifecycle 错误。
     * @returns {Promise<void>} 启动测试行为完成后结束。
     */
    async start() {
      state.startCalls += 1;
      events.push('start');

      // 条件分支: 当前场景注入 start 行为时进入。
      // 执行内容: 执行测试启动覆盖并把结果交还 Host。
      if (options.start) return options.start(state, events);
    },

    /**
     * 返回内容响应候选。
     * 副作用: 更新当前控制器的内容调用次数和事件顺序。
     * 成功路径: 默认返回带 sourceId/request 的可辨认测试对象。
     * 失败路径: 可选覆盖可以延迟、拒绝或抛出业务错误。
     * @param {object} request 标准内容请求候选。
     * @returns {Promise<object>} Provider 内容候选结果。
     */
    async fetchData(request) {
      state.fetchDataCalls += 1;
      events.push('fetchData');

      // 条件分支: 当前场景注入内容行为时进入。
      // 执行内容: 执行可控内容 Promise，供停止与过期结果测试使用。
      if (options.fetchData) return options.fetchData(request, state, events);
      return { sourceId, request, kind: 'content' };
    },

    /**
     * 返回筛选元数据响应候选。
     * 副作用: 更新当前控制器的筛选调用次数和事件顺序。
     * 成功路径: 默认返回带 sourceId/request 的可辨认测试对象。
     * 失败路径: 可选覆盖可以返回业务失败。
     * @param {object} request 标准筛选请求候选。
     * @returns {Promise<object>} Provider 筛选候选结果。
     */
    async fetchFilterMeta(request) {
      state.fetchFilterMetaCalls += 1;
      events.push('fetchFilterMeta');

      // 条件分支: 当前场景注入筛选行为时进入。
      // 执行内容: 返回测试覆盖结果供 Host 采用门禁复查。
      if (options.fetchFilterMeta) return options.fetchFilterMeta(request, state, events);
      return { sourceId, request, kind: 'filter' };
    },

    /**
     * 返回健康检测候选。
     * 副作用: 更新当前控制器的健康检测次数和事件顺序。
     * 成功路径: 默认返回正常状态和固定检查时间。
     * 失败路径: 可选覆盖可以抛出健康检测业务错误。
     * @returns {Promise<object>} 标准健康检测候选。
     */
    async checkHealth() {
      state.checkHealthCalls += 1;
      events.push('checkHealth');

      // 条件分支: 当前场景注入健康检测行为时进入。
      // 执行内容: 返回覆盖结果供 Host 生命周期复查。
      if (options.checkHealth) return options.checkHealth(state, events);
      return { healthStatus: 'normal', checkedAt: '2026-07-16T00:00:00.000Z', unavailableReason: '' };
    },

    /**
     * 检测受控响应中的挑战。
     * 副作用: 把挑战检测调用追加到当前控制器事件顺序。
     * 成功路径: 默认返回 null 表示没有挑战。
     * 失败路径: 可选覆盖可以抛出解析错误。
     * @param {object} response 受控网络响应候选。
     * @returns {Promise<object|null>} 挑战对象或 null。
     */
    async detectChallenge(response) {
      events.push('detectChallenge');

      // 条件分支: 当前场景注入挑战检测行为时进入。
      // 执行内容: 返回覆盖结果，不访问页面或全局状态。
      if (options.detectChallenge) return options.detectChallenge(response, state, events);
      return null;
    },

    /**
     * 继续测试挑战流程。
     * 副作用: 把挑战续接调用追加到当前控制器事件顺序。
     * 成功路径: 默认返回 unsupported 占位结果。
     * 失败路径: 可选覆盖可以抛出挑战续接错误。
     * @param {object} challengeInput 标准挑战输入。
     * @returns {Promise<object>} 挑战续接测试结果。
     */
    async continueChallenge(challengeInput) {
      events.push('continueChallenge');

      // 条件分支: 当前场景注入挑战续接行为时进入。
      // 执行内容: 执行覆盖函数并把候选结果交给调用方。
      if (options.continueChallenge) return options.continueChallenge(challengeInput, state, events);
      return { status: 'unsupported' };
    },

    /**
     * 停止测试 Provider。
     * 副作用: 更新当前控制器的停止次数和事件顺序。
     * 成功路径: 记录停止次数并执行可选覆盖。
     * 失败路径: 可选覆盖抛错时由 Host 保留 failed entry。
     * @returns {Promise<void>} 停止测试行为完成后结束。
     */
    async stop() {
      state.stopCalls += 1;
      events.push('stop');

      // 条件分支: 当前场景注入 stop 行为时进入。
      // 执行内容: 执行成功、失败或重试计数覆盖。
      if (options.stop) return options.stop(state, events);
    },

    /**
     * 永久释放测试 Provider。
     * 副作用: 更新当前控制器的释放次数和事件顺序。
     * 成功路径: 记录释放次数并执行可选覆盖。
     * 失败路径: 可选覆盖抛错时由 Host 保留全部受管引用。
     * @returns {Promise<void>} 释放测试行为完成后结束。
     */
    async dispose() {
      state.disposeCalls += 1;
      events.push('dispose');

      // 条件分支: 当前场景注入 dispose 行为时进入。
      // 执行内容: 执行失败一次或最终成功的释放覆盖。
      if (options.dispose) return options.dispose(state, events);
    }
  };

  // 返回值类型: object。
  // 作用: 返回 Provider 与独立测试观察面，Host 只能获得 provider 字段。
  return { provider, events, state };
}

/**
 * 创建与 Host entry 同源同 signal 的最小冻结 Context runtime。
 * 副作用: 创建私有日志数组；logger 写入和 controller.clear 只修改当前 runtime。
 * 成功路径: 返回 Host 可以校验的 Context 与 Logger Controller。
 * 失败路径: 本测试工厂只接收 Host 提供的合法 sourceId 和 AbortSignal，不主动抛错。
 *
 * @param {string} sourceId 当前 Host entry 身份。
 * @param {AbortSignal} signal 当前 Host entry 生命周期信号。
 * @returns {object} 冻结 Context runtime。
 */
function createContextRuntime(sourceId, signal) {
  // 类型: Array<object>。
  // 作用: 保存当前测试 Context 私有诊断条目，验证 dispose 会清理控制器。
  const logEntries = [];

  // 类型: object。
  // 作用: 提供 Provider 可见六字段冻结工具箱；各能力只返回稳定测试结果。
  const context = Object.freeze({
    sourceId,
    network: Object.freeze({
      /**
       * 返回与请求 id 对齐的测试网络结果。
       * 纯函数: 只从 request 读取 requestId，不修改 Context、请求对象或外部状态。
       * 成功路径: 返回只包含相同 requestId 的已完成 Promise。
       * 失败路径: request 缺失时由属性读取抛出 TypeError，测试不提供静默兜底。
       * @param {object} request 测试网络请求。
       * @returns {Promise<object>} 最小测试响应。
       */
      request: async request => ({ requestId: request.requestId })
    }),
    storage: Object.freeze({}),
    challenge: Object.freeze({
      /**
       * 返回 unsupported 测试挑战结果。
       * 纯函数: 只从 challenge 读取 challengeId，不修改挑战对象或外部状态。
       * 成功路径: 返回 unsupported 状态和原 challengeId 的已完成 Promise。
       * 失败路径: challenge 缺失时由属性读取抛出 TypeError，测试不提供静默兜底。
       * @param {object} challenge 标准挑战候选。
       * @returns {Promise<object>} 最小挑战结果。
       */
      request: async challenge => ({ status: 'unsupported', challengeId: challenge.challengeId })
    }),
    logger: Object.freeze({
      /**
       * 写入 debug 测试日志。
       * 副作用: 向当前 Context 私有 logEntries 追加一条 debug 观察记录。
       * @param {string} message 日志消息。
       * @param {object} details 日志详情。
       * @returns {number} 当前日志条数。
       */
      debug: (message, details) => logEntries.push({ message, details }),
      /**
       * 写入 info 测试日志。
       * 副作用: 向当前 Context 私有 logEntries 追加一条 info 观察记录。
       * @param {string} message 日志消息。
       * @param {object} details 日志详情。
       * @returns {number} 当前日志条数。
       */
      info: (message, details) => logEntries.push({ message, details }),
      /**
       * 写入 warn 测试日志。
       * 副作用: 向当前 Context 私有 logEntries 追加一条 warn 观察记录。
       * @param {string} message 日志消息。
       * @param {object} details 日志详情。
       * @returns {number} 当前日志条数。
       */
      warn: (message, details) => logEntries.push({ message, details }),
      /**
       * 写入 error 测试日志。
       * 副作用: 向当前 Context 私有 logEntries 追加一条 error 观察记录。
       * @param {string} message 日志消息。
       * @param {object} details 日志详情。
       * @returns {number} 当前日志条数。
       */
      error: (message, details) => logEntries.push({ message, details })
    }),
    signal
  });

  // 类型: object。
  // 作用: 给 Host 提供同源诊断读取与清理能力，不进入 Provider Context 根对象。
  const loggerController = Object.freeze({
    sourceId,
    logger: context.logger,
    /**
     * 读取隔离日志快照。
     * 纯函数: 不修改 logEntries，并为每个条目创建新的浅层副本。
     * @returns {Array<object>} 新日志条目数组。
     */
    getEntries: () => logEntries.map(entry => ({ ...entry })),
    /**
     * 清空当前测试日志。
     * 副作用: 删除当前 Context 私有 logEntries 中的全部条目。
     * @returns {number} 清理前日志条数。
     */
    clear: () => logEntries.splice(0, logEntries.length).length
  });

  // 返回值类型: object。
  // 作用: 返回精确 context/loggerController 两字段，避免额外测试控制器越过 Host 门禁。
  return Object.freeze({ context, loggerController });
}

/**
 * 组合单个 Host 测试环境。
 * 副作用: 注册一个可信工厂，并让工厂每次 create 生成新的 Provider 控制器。
 * 成功路径: 默认 supports 全部测试 Definition，Host 可以按正常记录初始化和启动。
 * 失败路径: options 可关闭注册、拒绝 supports 或注入 Provider 方法失败。
 *
 * @param {object} options 环境行为选项。
 * @param {boolean} options.registerFactory 是否注册可信工厂。
 * @param {Function} options.supports 工厂受审数据集判断函数。
 * @param {Function} options.createProviderOptions 按 Definition 生成 Provider 选项。
 * @returns {object} Host、注册表和已创建 Provider 控制器集合。
 */
function createHostEnvironment(options = {}) {
  // 类型: object。
  // 作用: 创建当前测试独立注册表，避免不同用例共享可信工厂状态。
  const factoryRegistry = createProviderFactoryRegistry();

  // 类型: Array<object>。
  // 作用: 按工厂创建顺序保存 Provider 测试控制器，Host 不获得该数组。
  const controllers = [];

  // 类型: boolean。
  // 作用: 默认注册工厂；false 用于验证未知 providerKey 门禁。
  const shouldRegisterFactory = options.registerFactory !== false;

  // 条件分支: 当前场景需要可信工厂时进入。
  // 执行内容: 注册精确三字段工厂，不使用脚本文本或来源类型推断。
  if (shouldRegisterFactory) {
    factoryRegistry.register(TEST_PROVIDER_KEY, {
      providerKey: TEST_PROVIDER_KEY,
      /**
       * 判断 Definition 是否具备受审测试数据集。
       * 副作用: 包装器自身不修改 Definition；若注入 supports，其副作用由该测试回调承担。
       * @param {object} definition 隔离数据源定义。
       * @returns {boolean} 当前测试支持结果。
       */
      supports(definition) {
        return options.supports ? options.supports(definition) : true;
      },
      /**
       * 为 Definition 创建标准测试 Provider。
       * 副作用: 创建 Provider 控制器并将观察面追加到当前测试环境的 controllers。
       * @param {object} input 工厂输入。
       * @param {object} input.definition 隔离数据源定义。
       * @returns {object} 标准测试 Provider。
       */
      create({ definition }) {
        // 类型: object。
        // 作用: 保存当前 Definition 对应的 Provider 行为覆盖。
        const providerOptions = options.createProviderOptions
          ? options.createProviderOptions(definition)
          : { sourceId: definition.id };

        // 类型: object。
        // 作用: 创建 Provider 和测试观察面，并只把 Provider 返回 Host。
        const controller = createProviderController(providerOptions);
        controllers.push(controller);
        return controller.provider;
      }
    });
  }

  // 类型: SourceExecutionHost。
  // 作用: 创建待测生命周期权威，依赖当前注册表和纯测试 Context runtime。
  const host = createSourceExecutionHost({
    factoryRegistry,
    createSourceContextRuntime: createContextRuntime
  });

  // 返回值类型: object。
  // 作用: 返回测试可观察环境，不把 controllers 注入 Host。
  return { host, factoryRegistry, controllers };
}

/**
 * 断言异步操作使用指定 Host 错误码失败。
 * 副作用: 执行 operation；不修改生产对象以外的测试控制流。
 * 成功路径: 捕获错误且 code 与 expectedCode 相同时完成。
 * 失败路径: 操作成功或错误码不同会由 strict assert 抛出测试失败。
 *
 * @param {Function} operation 返回 Promise 或抛出同步 Host 错误的操作函数。
 * @param {string} expectedCode 预期 SOURCE_EXECUTION_HOST_ERROR_CODE 值。
 * @returns {Promise<void>} 错误分类断言完成后结束。
 */
async function assertRejectsWithCode(operation, expectedCode) {
  // 类型: Promise<*>。
  // 作用: 在 Promise 微任务中执行 operation，把 Host 同步门禁抛错和异步拒绝统一转换为可断言的 rejected Promise。
  const operationPromise = Promise.resolve().then(operation);

  // 异步断言: 验证统一 Promise 使用预期稳定错误码拒绝。
  // resolve: 操作意外成功时由 assert.rejects 产生测试失败。
  // reject: matcher 返回 true 时视为符合预期，错误码不符时产生测试失败。
  await assert.rejects(operationPromise, error => (
    Boolean(error) && error.code === expectedCode
  ));
}

test('可信工厂注册表拒绝重复和可变门面，并返回隔离键列表', () => {
  // 类型: object。
  // 作用: 当前用例独立可信工厂注册表，验证注册、查询、删除和重复冲突。
  const registry = createProviderFactoryRegistry();

  // 类型: object。
  // 作用: 保存待注册原始工厂，注册后会修改 supports 以验证冻结绑定门面不漂移。
  const factory = {
    providerKey: TEST_PROVIDER_KEY,
    /**
     * 表示原始工厂支持测试 Definition。
     * 纯函数: 固定返回 true，不读取参数或修改外部状态。
     * @returns {boolean} 固定返回 true。
     */
    supports: () => true,
    /**
     * 创建标准测试 Provider。
     * 副作用: 创建新的 Provider 控制器，但不保存到测试环境或全局集合。
     * @returns {object} 新测试 Provider。
     */
    create: () => createProviderController().provider
  };

  // 类型: object。
  // 作用: 保存注册表返回的冻结绑定门面，验证原始工厂后续变化不会穿透。
  const registeredFactory = registry.register(TEST_PROVIDER_KEY, factory);

  // 副作用: 替换原始工厂方法，验证注册表已经捕获注册时实现。
  factory.supports = () => false;

  assert.equal(registeredFactory.supports(createSourceRecord().definition), true);
  assert.equal(Object.isFrozen(registeredFactory), true);
  assert.deepEqual(registry.listKeys(), [TEST_PROVIDER_KEY]);
  assert.throws(
    () => registry.register(TEST_PROVIDER_KEY, factory),
    error => error.code === SOURCE_EXECUTION_HOST_ERROR_CODE.conflict
  );
  assert.equal(registry.remove('missing-provider'), false);
  assert.equal(registry.remove(TEST_PROVIDER_KEY), true);
  assert.equal(registry.get(TEST_PROVIDER_KEY), null);
});

test('Host 按禁用、空指纹、软隐藏、授权、未知工厂和未知数据集完整拒绝门禁', async () => {
  // 类型: Array<object>。
  // 作用: 表驱动覆盖六类独立门禁根因及其稳定错误分类。
  const gateScenarios = [
    {
      name: 'disabled',
      environment: createHostEnvironment(),
      record: createSourceRecord({ enabled: false }),
      gateContext: { removedSystemSourceIds: [] },
      code: SOURCE_EXECUTION_HOST_ERROR_CODE.gateRejected
    },
    {
      name: 'missing-hash',
      environment: createHostEnvironment(),
      record: createSourceRecord({ currentScriptHash: '' }),
      gateContext: { removedSystemSourceIds: [] },
      code: SOURCE_EXECUTION_HOST_ERROR_CODE.gateRejected
    },
    {
      name: 'soft-hidden',
      environment: createHostEnvironment(),
      record: createSourceRecord(),
      gateContext: { removedSystemSourceIds: [TEST_SOURCE_ID] },
      code: SOURCE_EXECUTION_HOST_ERROR_CODE.gateRejected
    },
    {
      name: 'authorization-invalid',
      environment: createHostEnvironment(),
      record: createSourceRecord({
        sourceKind: 'custom',
        authorization: {
          status: 'pending',
          authorizedAt: '',
          authorizedVersion: '',
          authorizedScriptHash: ''
        }
      }),
      gateContext: { removedSystemSourceIds: [] },
      code: SOURCE_EXECUTION_HOST_ERROR_CODE.gateRejected
    },
    {
      name: 'unknown-factory',
      environment: createHostEnvironment({ registerFactory: false }),
      record: createSourceRecord(),
      gateContext: { removedSystemSourceIds: [] },
      code: SOURCE_EXECUTION_HOST_ERROR_CODE.notFound
    },
    {
      name: 'unsupported-data-set',
      environment: createHostEnvironment({
        /**
         * 模拟可信工厂缺少当前 Definition 的受审数据集。
         * 纯函数: 固定返回 false，不读取 Definition 或修改外部状态。
         * @returns {boolean} 固定返回 false。
         */
        supports: () => false
      }),
      record: createSourceRecord(),
      gateContext: { removedSystemSourceIds: [] },
      code: SOURCE_EXECUTION_HOST_ERROR_CODE.gateRejected
    }
  ];

  // 循环类型: for...of。
  // 初始值: 第一条禁用门禁场景。
  // 终止条件: 六类场景全部验证完成。
  // 循环作用: 证明门禁失败不创建 Provider 控制器或 Host entry。
  for (const scenario of gateScenarios) {
    await assertRejectsWithCode(
      () => scenario.environment.host.initialize(scenario.record, scenario.gateContext),
      scenario.code
    );
    assert.equal(await scenario.environment.host.getRuntimeState(TEST_SOURCE_ID), null, scenario.name);
    assert.equal(scenario.environment.controllers.length, 0, scenario.name);
  }
});

test('Host 完成初始化、幂等启动、三项受管调用、停止、释放和新代次重建', async () => {
  // 类型: object。
  // 作用: 默认正常 Host 环境，覆盖完整成功生命周期。
  const environment = createHostEnvironment();

  // 类型: object。
  // 作用: 保存初始化摘要，作为首代 phase 和 generation 基线。
  const initializedState = await environment.host.initialize(
    createSourceRecord(),
    { removedSystemSourceIds: [] }
  );
  // 类型: object。
  // 作用: 读取首代 Provider 观察面，验证幂等启动和 stop/dispose 调用顺序。
  const firstController = environment.controllers[0];

  assert.equal(initializedState.phase, SOURCE_EXECUTION_HOST_PHASE.initialized);
  assert.equal(initializedState.acceptingCalls, false);
  assert.equal(Object.isFrozen(initializedState), true);

  // 类型: object。
  // 作用: 保存首次启动后的可调用运行摘要。
  const runningState = await environment.host.start(TEST_SOURCE_ID);

  // 类型: object。
  // 作用: 保存重复启动摘要，验证不会第二次调用 Provider.start。
  const duplicateRunningState = await environment.host.start(TEST_SOURCE_ID);
  assert.equal(runningState.phase, SOURCE_EXECUTION_HOST_PHASE.running);
  assert.equal(duplicateRunningState.lifecycleGeneration, runningState.lifecycleGeneration);
  assert.equal(firstController.state.startCalls, 1);

  // 类型: object。
  // 作用: 保存 Host 采用门禁通过的内容候选。
  const contentResult = await environment.host.fetchData(TEST_SOURCE_ID, { pageKey: 'home' });

  // 类型: object。
  // 作用: 保存同一 Provider 返回的筛选候选。
  const filterResult = await environment.host.fetchFilterMeta(TEST_SOURCE_ID, { pageKey: 'movie' });

  // 类型: object。
  // 作用: 保存同一生命周期内返回的健康候选。
  const healthResult = await environment.host.checkHealth(TEST_SOURCE_ID);
  assert.equal(contentResult.kind, 'content');
  assert.equal(filterResult.kind, 'filter');
  assert.equal(healthResult.healthStatus, 'normal');

  // 类型: object。
  // 作用: 保存停止摘要，验证调用门禁关闭且实例仍等待释放。
  const stoppedState = await environment.host.stop(TEST_SOURCE_ID);
  assert.equal(stoppedState.phase, SOURCE_EXECUTION_HOST_PHASE.stopped);
  assert.equal(stoppedState.acceptingCalls, false);
  await environment.host.dispose(TEST_SOURCE_ID);
  assert.equal(await environment.host.getRuntimeState(TEST_SOURCE_ID), null);
  assert.deepEqual(firstController.events.slice(-2), ['stop', 'dispose']);

  // 类型: object。
  // 作用: 保存释放后重建摘要，验证 generation 单调递增而不复用旧代次。
  const rebuiltState = await environment.host.initialize(
    createSourceRecord(),
    { removedSystemSourceIds: [] }
  );
  assert.equal(rebuiltState.lifecycleGeneration > initializedState.lifecycleGeneration, true);
  await environment.host.dispose(TEST_SOURCE_ID);
});

test('initialize 后同一事件循环立即 stop 能定位 entry、中止初始化并完成真实停止', async () => {
  // 类型: object。
  // 作用: 控制 Provider.initialize 的完成时机，制造立即 stop 竞争窗口。
  const initializeDeferred = createDeferred();

  // 类型: object。
  // 作用: 注入延迟初始化 Provider 的 Host 环境。
  const environment = createHostEnvironment({
    /**
     * 为当前 Definition 注入延迟 initialize 行为。
     * 纯函数: 仅根据 Definition 组装新的 Provider 行为对象，不修改外部状态。
     * @param {object} definition 隔离数据源定义。
     * @returns {object} Provider 行为覆盖。
     */
    createProviderOptions: definition => ({
      sourceId: definition.id,
      /**
       * 等待测试显式放行初始化。
       * 纯函数: 只返回既有可控 Promise，不创建或修改其他状态。
       * @returns {Promise<*>} 可控初始化 Promise。
       */
      initialize: () => initializeDeferred.promise
    })
  });

  // 类型: Promise<object>。
  // 作用: 保存尚未完成的初始化调用，预期因立即 stop 变成 callAborted。
  const initializePromise = environment.host.initialize(
    createSourceRecord(),
    { removedSystemSourceIds: [] }
  );
  // 类型: Promise<object>。
  // 作用: 同一事件循环立即发起停止，验证同步 entry 登记可被定位。
  const stopPromise = environment.host.stop(TEST_SOURCE_ID);

  // 类型: object。
  // 作用: 读取 stop 排队前已经同步生效的 stopping 摘要。
  const stoppingState = await environment.host.getRuntimeState(TEST_SOURCE_ID);

  assert.equal(stoppingState.phase, SOURCE_EXECUTION_HOST_PHASE.stopping);
  assert.equal(stoppingState.acceptingCalls, false);
  initializeDeferred.resolve();

  await assertRejectsWithCode(
    () => initializePromise,
    SOURCE_EXECUTION_HOST_ERROR_CODE.callAborted
  );
  // 类型: object。
  // 作用: 保存初始化收敛后真实 Provider.stop 的最终摘要。
  const stoppedState = await stopPromise;
  assert.equal(stoppedState.phase, SOURCE_EXECUTION_HOST_PHASE.stopped);
  assert.deepEqual(environment.controllers[0].events, ['initialize', 'stop']);
  await environment.host.dispose(TEST_SOURCE_ID);
});

test('dispose 紧随 initialize 时不会误判空实例，初始化收敛后执行 stop 和 dispose', async () => {
  // 类型: object。
  // 作用: 控制 Provider.initialize 完成时机，制造立即 dispose 竞争窗口。
  const initializeDeferred = createDeferred();

  // 类型: object。
  // 作用: 注入延迟初始化 Provider 的 Host 环境。
  const environment = createHostEnvironment({
    /**
     * 为当前 Definition 注入延迟初始化行为。
     * 纯函数: 仅根据 Definition 组装新的 Provider 行为对象，不修改外部状态。
     * @param {object} definition 隔离数据源定义。
     * @returns {object} Provider 行为覆盖。
     */
    createProviderOptions: definition => ({
      sourceId: definition.id,
      /**
       * 等待测试显式放行初始化。
       * 纯函数: 只返回既有可控 Promise，不创建或修改其他状态。
       * @returns {Promise<*>} 可控初始化 Promise。
       */
      initialize: () => initializeDeferred.promise
    })
  });

  // 类型: Promise<object>。
  // 作用: 保存尚未完成的初始化调用，预期被释放请求中止。
  const initializePromise = environment.host.initialize(
    createSourceRecord(),
    { removedSystemSourceIds: [] }
  );
  // 类型: Promise<void>。
  // 作用: 保存紧随初始化的释放调用，验证它不会因微任务尚未执行而误判空 entry。
  const disposePromise = environment.host.dispose(TEST_SOURCE_ID);
  initializeDeferred.resolve();

  await assertRejectsWithCode(
    () => initializePromise,
    SOURCE_EXECUTION_HOST_ERROR_CODE.callAborted
  );
  await disposePromise;
  assert.deepEqual(environment.controllers[0].events, ['initialize', 'stop', 'dispose']);
  assert.equal(await environment.host.getRuntimeState(TEST_SOURCE_ID), null);
});

test('stop 先关闭门禁并等待在途调用，旧候选结果不能在生命周期变化后返回成功', async () => {
  // 类型: object。
  // 作用: 控制 Provider.fetchData 候选返回时机，制造停止期间的在途调用。
  const fetchDeferred = createDeferred();

  // 类型: object。
  // 作用: 注入延迟内容候选的 Host 环境。
  const environment = createHostEnvironment({
    /**
     * 为当前 Definition 注入延迟内容行为。
     * 纯函数: 仅根据 Definition 组装新的 Provider 行为对象，不修改外部状态。
     * @param {object} definition 隔离数据源定义。
     * @returns {object} Provider 行为覆盖。
     */
    createProviderOptions: definition => ({
      sourceId: definition.id,
      /**
       * 等待测试显式返回旧候选。
       * 纯函数: 只返回既有可控 Promise，不创建或修改其他状态。
       * @returns {Promise<*>} 可控内容 Promise。
       */
      fetchData: () => fetchDeferred.promise
    })
  });

  await environment.host.initialize(createSourceRecord(), { removedSystemSourceIds: [] });
  await environment.host.start(TEST_SOURCE_ID);
  // 类型: Promise<object>。
  // 作用: 保存停止前已经进入 Provider 的内容调用。
  const fetchPromise = environment.host.fetchData(TEST_SOURCE_ID, { pageKey: 'home' });
  await Promise.resolve();

  // 类型: Promise<object>。
  // 作用: 保存等待 activeCallCount 归零的停止调用。
  const stopPromise = environment.host.stop(TEST_SOURCE_ID);

  // 类型: object。
  // 作用: 读取停止期间摘要，验证门禁关闭且在途计数仍为一。
  const stoppingState = await environment.host.getRuntimeState(TEST_SOURCE_ID);
  assert.equal(stoppingState.phase, SOURCE_EXECUTION_HOST_PHASE.stopping);
  assert.equal(stoppingState.activeCallCount, 1);
  await assertRejectsWithCode(
    () => environment.host.fetchData(TEST_SOURCE_ID, { pageKey: 'movie' }),
    SOURCE_EXECUTION_HOST_ERROR_CODE.invalidState
  );

  fetchDeferred.resolve({ sourceId: TEST_SOURCE_ID, stale: true });
  await assertRejectsWithCode(
    () => fetchPromise,
    SOURCE_EXECUTION_HOST_ERROR_CODE.callAborted
  );
  // 类型: object。
  // 作用: 保存旧候选拒绝并释放计数后的停止摘要。
  const stoppedState = await stopPromise;
  assert.equal(stoppedState.activeCallCount, 0);
  assert.deepEqual(environment.controllers[0].events.slice(-2), ['fetchData', 'stop']);
  await environment.host.dispose(TEST_SOURCE_ID);
});

test('生命周期失败保留不可调用 entry 和原始 cause，释放重试成功后才删除引用', async () => {
  // 类型: Error。
  // 作用: 第一次 Provider.stop 抛出的原始失败，用于验证 Host lifecycle cause 保真。
  const stopFailure = new Error('stop failed once');

  // 类型: Error。
  // 作用: 第一次 Provider.dispose 抛出的原始失败，用于验证释放失败保留 entry。
  const disposeFailure = new Error('dispose failed once');

  // 类型: number。
  // 作用: 记录 stop 尝试次数，第一次失败、第二次由 dispose 补偿成功。
  let stopAttempts = 0;

  // 类型: number。
  // 作用: 记录 dispose 尝试次数，验证失败后显式重试才删除 entry。
  let disposeAttempts = 0;

  // 类型: object。
  // 作用: 注入各失败一次的 Provider，覆盖 stop/dispose 补偿和重试路径。
  const environment = createHostEnvironment({
    /**
     * 为当前 Definition 创建失败一次的生命周期覆盖。
     * 纯函数: 仅根据 Definition 组装新的 Provider 行为对象，不直接修改尝试计数。
     * @param {object} definition 隔离数据源定义。
     * @returns {object} Provider 行为覆盖。
     */
    createProviderOptions: definition => ({
      sourceId: definition.id,
      /**
       * 第一次停止失败，后续停止成功。
       * 副作用: 递增 stopAttempts；第一次调用还会抛出预设 stopFailure。
       * @returns {void} 成功尝试不返回业务值。
       */
      stop: () => {
        stopAttempts += 1;

        // 条件分支: 当前是第一次停止尝试时进入。
        // 执行内容: 抛出原始 stopFailure，验证 failed entry 和 cause。
        if (stopAttempts === 1) throw stopFailure;
      },
      /**
       * 第一次释放失败，第二次释放成功。
       * 副作用: 递增 disposeAttempts；第一次调用还会抛出预设 disposeFailure。
       * @returns {void} 成功尝试不返回业务值。
       */
      dispose: () => {
        disposeAttempts += 1;

        // 条件分支: 当前是第一次释放尝试时进入。
        // 执行内容: 抛出原始 disposeFailure，验证 Host 保留全部引用。
        if (disposeAttempts === 1) throw disposeFailure;
      }
    })
  });

  await environment.host.initialize(createSourceRecord(), { removedSystemSourceIds: [] });
  await environment.host.start(TEST_SOURCE_ID);

  await assert.rejects(
    () => environment.host.stop(TEST_SOURCE_ID),
    error => error.code === SOURCE_EXECUTION_HOST_ERROR_CODE.lifecycle && error.cause === stopFailure
  );
  // 类型: object。
  // 作用: 保存 stop 失败后的摘要，验证 entry 仍存在且不可调用。
  const failedAfterStop = await environment.host.getRuntimeState(TEST_SOURCE_ID);
  assert.equal(failedAfterStop.phase, SOURCE_EXECUTION_HOST_PHASE.failed);
  assert.equal(failedAfterStop.acceptingCalls, false);

  await assert.rejects(
    () => environment.host.dispose(TEST_SOURCE_ID),
    error => error.code === SOURCE_EXECUTION_HOST_ERROR_CODE.lifecycle && error.cause === disposeFailure
  );
  // 类型: object。
  // 作用: 保存 dispose 失败后的摘要，验证 Host 没有假装释放成功。
  const failedAfterDispose = await environment.host.getRuntimeState(TEST_SOURCE_ID);
  assert.equal(failedAfterDispose.phase, SOURCE_EXECUTION_HOST_PHASE.failed);
  assert.equal(failedAfterDispose.acceptingCalls, false);

  await environment.host.dispose(TEST_SOURCE_ID);
  assert.equal(await environment.host.getRuntimeState(TEST_SOURCE_ID), null);
  assert.equal(stopAttempts, 2);
  assert.equal(disposeAttempts, 2);
});

test('Host 不泄漏 Provider、Context、控制器或内部 Map，外部修改摘要不能穿透', async () => {
  // 类型: object。
  // 作用: 默认 Host 环境，用于检查公开运行摘要精确字段和冻结边界。
  const environment = createHostEnvironment();
  await environment.host.initialize(createSourceRecord(), { removedSystemSourceIds: [] });

  // 类型: object。
  // 作用: 保存 Host 返回的隔离摘要，验证内部对象和后续状态不能被外部修改。
  const runtimeState = await environment.host.getRuntimeState(TEST_SOURCE_ID);

  assert.deepEqual(Object.keys(runtimeState).sort(), [
    'acceptingCalls',
    'activeCallCount',
    'lastErrorCode',
    'lifecycleGeneration',
    'phase',
    'providerStatus',
    'sourceId'
  ]);
  assert.equal(Object.isFrozen(runtimeState), true);
  assert.equal('provider' in runtimeState, false);
  assert.equal('context' in runtimeState, false);
  assert.equal('abortController' in runtimeState, false);
  assert.throws(() => {
    runtimeState.phase = SOURCE_EXECUTION_HOST_PHASE.running;
  }, TypeError);
  assert.equal(
    (await environment.host.getRuntimeState(TEST_SOURCE_ID)).phase,
    SOURCE_EXECUTION_HOST_PHASE.initialized
  );
  await environment.host.dispose(TEST_SOURCE_ID);
});
