/*
  createSourceRuntime.js 模块说明

  - 文件职责:
      组合 Memory Repository、SourceManager、Source Shell、SourceExecutionHost 和可信模拟 Provider 工厂。
      向内容 service、筛选 service 和后续设置页适配层提供唯一受管运行入口。
      收敛并发首次初始化和同一 sourceId 的并发按需启动，避免创建第二套保存态或生命周期权威。

  - 导入库及文件汇总(14 条，内置 0 条，第三方 0 条，自定义 14 条):
      sourceRepositorySeeds: 自定义数据，提供当前阶段显式 Memory Repository 种子。
      createMemorySourceRepositories: 自定义 Repository 工厂，创建三仓和 FIFO UnitOfWork。
      cloneSerializableValue: 自定义工具，隔离 runtime 接收的请求和构造选项。
      SourceManager: 自定义领域服务，负责保存态事务和轻量 SourceManagerState 投影。
      createProviderFactoryRegistry: 自定义注册表工厂，保存受审 providerKey 到工厂门面。
      SOURCE_EXECUTION_HOST_PHASE: 自定义枚举，判断 Host entry 是否已经运行或停止。
      SourceExecutionHost errors: 自定义错误，区分不可用门禁和未注册可信工厂。
      createSourceExecutionHost: 自定义 Host 工厂，创建 Provider 生命周期唯一权威。
      createMockSourceProviderFactory: 自定义可信工厂，为四个受审 sourceId 创建统一 Provider。
      Source Shell factories: 自定义工厂，组合模拟网络、挑战、日志和 SourceContext。
      normalizeSourceShellId: 自定义校验函数，统一 runtime 入口的 sourceId 规则。

  - 模块级常量:
      SOURCE_RUNTIME_ERROR_CODE: object，runtime 稳定错误码。
      SOURCE_RUNTIME_OPTION_FIELDS: Array<string>，createSourceRuntime 允许的精确选项。
      SOURCE_RUNTIME_PUBLIC_METHODS: Array<string>，公开 runtime 八方法顺序。
      DEFAULT_UPDATE_CHECK_PORT: object，当前阶段无远程更新时的标准更新端口。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createSourceRuntimeError(code, message, cause): 创建保留底层 cause 的稳定 runtime 错误。
      normalizeRuntimeOptions(options): 校验并隔离 runtime 构造选项。
      normalizeRuntimeSourceId(sourceId, fieldName): 把 Shell 身份校验错误转换为 runtime validation。
      normalizeRuntimeRequest(request, fieldName): 隔离请求并读取真实 sourceId。
      findRuntimeSourceRecord(state, sourceId): 从 Manager 投影定位记录并执行可用性前置门禁。

  - 模块级类:
      SourceRuntimeError: Error，携带稳定 code 和可选 cause。

  - 对外导出:
      SOURCE_RUNTIME_ERROR_CODE: object，runtime 稳定错误码。
      SourceRuntimeError: Class，runtime 统一错误基类。
      createSourceRuntime: Function，创建冻结八方法运行门面。
*/

// 导入来源: ../data/settings/source-repository.seed.js。
// 导入内容: sourceRepositorySeeds 当前模拟数据源分离种子。
// 文件作用: 给默认 runtime 创建显式 Memory Repository，不让 Repository 工厂读取页面 mock。
import { sourceRepositorySeeds } from '../data/settings/source-repository.seed.js';

// 导入来源: ../repositories/source/createMemorySourceRepositories.js。
// 导入内容: createMemorySourceRepositories Repository 基础设施工厂。
// 文件作用: 每个 runtime 实例创建自己的一组三仓和 UnitOfWork。
import { createMemorySourceRepositories } from '../repositories/source/createMemorySourceRepositories.js';

// 导入来源: ../repositories/source/sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON 隔离工具。
// 文件作用: 防止调用方在初始化或按需启动等待期间修改请求和构造输入。
import { cloneSerializableValue } from '../repositories/source/sourceRepositoryUtils.js';

// 导入来源: ../services/sourceManagerService.js。
// 导入内容: SourceManager 数据源领域事务服务。
// 文件作用: 从 Repository 组装 SourceManagerState，并保持保存态唯一权威。
import { SourceManager } from '../services/sourceManagerService.js';

// 导入来源: ./source-host/providerFactoryRegistry.js。
// 导入内容: createProviderFactoryRegistry 可信工厂注册表工厂。
// 文件作用: 显式注册内置模拟 Provider 工厂，不根据脚本文本推断可执行函数。
import { createProviderFactoryRegistry } from './source-host/providerFactoryRegistry.js';

// 导入来源: ./source-host/sourceExecutionHost.config.js。
// 导入内容: SOURCE_EXECUTION_HOST_PHASE Host 内部阶段枚举。
// 文件作用: 判断 entry 是否可直接复用，以及 stopped entry 是否需要释放后重建。
import { SOURCE_EXECUTION_HOST_PHASE } from './source-host/sourceExecutionHost.config.js';

// 导入来源: ./source-host/sourceExecutionHostErrors.js。
import {
  // 导入来源: ./source-host/sourceExecutionHostErrors.js。
  // 导入内容: SourceExecutionHostGateRejectedError Host 门禁错误。
  // 文件作用: 把禁用、授权、软隐藏或未知受审数据集转换为 runtime unavailable。
  SourceExecutionHostGateRejectedError,

  // 导入来源: ./source-host/sourceExecutionHostErrors.js。
  // 导入内容: SourceExecutionHostNotFoundError Host 未命中错误。
  // 文件作用: 把 providerKey 未注册这一明确工厂门禁转换为 runtime unavailable。
  SourceExecutionHostNotFoundError
} from './source-host/sourceExecutionHostErrors.js';

// 导入来源: ./sourceExecutionHost.js。
// 导入内容: createSourceExecutionHost Host 工厂。
// 文件作用: 创建当前 runtime 唯一 Provider 生命周期和受管调用入口。
import { createSourceExecutionHost } from './sourceExecutionHost.js';

import {
  // 导入来源: ../data/providers/createMockSourceProvider.js。
  // 导入内容: SYSTEM_DEMO_PROVIDER_KEY 可信系统演示工厂注册键。
  // 文件作用: 保证注册键和 SourceDefinition.providerKey 使用同一常量。
  SYSTEM_DEMO_PROVIDER_KEY,

  // 导入来源: ../data/providers/createMockSourceProvider.js。
  // 导入内容: createMockSourceProviderFactory 统一可信模拟 Provider 工厂。
  // 文件作用: 给四个受审 sourceId 提供同一 Provider 实现和不同 A/B 数据集。
  createMockSourceProviderFactory
} from '../data/providers/createMockSourceProvider.js';

// 导入来源: ./source-shell/mockNetworkAdapter.js。
// 导入内容: createMockNetworkAdapter 模拟网络适配器工厂。
// 文件作用: 创建当前 runtime 共享的模拟响应读取入口。
import { createMockNetworkAdapter } from './source-shell/mockNetworkAdapter.js';

// 导入来源: ./source-shell/sourceChallengePort.js。
// 导入内容: createSourceChallengePort 挑战占位端口工厂。
// 文件作用: 为每个 Host 生命周期创建同 sourceId、同 signal 的挑战能力。
import { createSourceChallengePort } from './source-shell/sourceChallengePort.js';

// 导入来源: ./source-shell/sourceLogger.js。
// 导入内容: createSourceLoggerController 脱敏有界日志控制器工厂。
// 文件作用: 为每个 Provider 生命周期创建独立日志空间，并把读取端只交给 Host。
import { createSourceLoggerController } from './source-shell/sourceLogger.js';

// 导入来源: ./source-shell/createSourceContext.js。
// 导入内容: createSourceContext SourceContext 工厂。
// 文件作用: 组合当前 sourceId 的 network、storage、challenge、logger 和 signal 能力。
import { createSourceContext } from './source-shell/createSourceContext.js';

// 导入来源: ./source-shell/sourceShellValidators.js。
// 导入内容: normalizeSourceShellId Shell 统一身份校验函数。
// 文件作用: runtime 公开入口复用与 Context、Host 一致的 sourceId 规则。
import { normalizeSourceShellId } from './source-shell/sourceShellValidators.js';

// 类型: object。
// 作用: 固定 runtime 边界的五类稳定错误码，上层不能解析中文消息决定恢复策略。
export const SOURCE_RUNTIME_ERROR_CODE = Object.freeze({
  // 类型: string。
  // 作用: 构造选项、sourceId 或请求对象不符合 runtime 精确契约。
  validation: 'SOURCE_RUNTIME_VALIDATION_ERROR',

  // 类型: string。
  // 作用: Repository 或 SourceManager 首次初始化失败。
  initialization: 'SOURCE_RUNTIME_INITIALIZATION_ERROR',

  // 类型: string。
  // 作用: SourceManagerState 中不存在目标真实 sourceId。
  notFound: 'SOURCE_RUNTIME_NOT_FOUND',

  // 类型: string。
  // 作用: 目标记录禁用、授权无效、软隐藏或没有受审 Provider 数据集。
  unavailable: 'SOURCE_RUNTIME_UNAVAILABLE',

  // 类型: string。
  // 作用: Host 生命周期、Shell 或 Provider 受管调用失败。
  operation: 'SOURCE_RUNTIME_OPERATION_ERROR'
});

// 类型: Array<string>。
// 作用: createSourceRuntime 只允许四项显式选项，阻止页面、store 或脚本文本进入组合层。
const SOURCE_RUNTIME_OPTION_FIELDS = Object.freeze([
  'repositorySeeds',
  'initialRuntimeStates',
  'activeSourceId',
  'updateCheckPort'
]);

// 类型: Array<string>。
// 作用: 固定公开 runtime 八方法及 Object.keys 顺序，测试据此确认没有基础设施引用泄漏。
const SOURCE_RUNTIME_PUBLIC_METHODS = Object.freeze([
  'initialize',
  'getSourceManagerState',
  'ensureSourceRunning',
  'fetchData',
  'fetchFilterMeta',
  'checkHealth',
  'stopSource',
  'disposeSource'
]);

// 类型: object。
// 作用: 未配置远程更新端口时返回标准无更新结果；调用方可以通过显式选项替换该端口。
const DEFAULT_UPDATE_CHECK_PORT = Object.freeze({
  /**
   * 返回当前阶段标准无更新结果。
   * 副作用: 只读取系统时间；不访问网络、Repository 或外部可变状态。
   * 成功路径: 返回 updateAvailable=false 的完整标准对象。
   * 失败路径: 当前实现没有外部依赖，不主动抛出业务错误。
   *
   * @returns {Promise<object>} SourceUpdateCheckResult 标准无更新结果。
   */
  async check() {
    return Object.freeze({
      updateAvailable: false,
      availableVersion: '',
      availableVersionUpdatedAt: '',
      checkedAt: new Date().toISOString()
    });
  }
});

/**
 * runtime 统一错误。
 * 保存稳定 code 和底层 cause，不保存 Repository、Provider 或请求对象。
 */
export class SourceRuntimeError extends Error {
  /**
   * 创建 runtime 错误。
   * 副作用: 初始化当前 Error 实例的 message、name、code 和可选 cause。
   * 成功路径: 构造可由上层按稳定 code 识别的错误对象。
   * 失败路径: code/message 由内部调用点提供，当前构造器不执行额外校验。
   *
   * @param {string} code SOURCE_RUNTIME_ERROR_CODE 中的稳定错误码。
   * @param {string} message 面向开发诊断的错误消息。
   * @param {object} options 可选错误配置。
   * @param {*} options.cause 底层原始失败。
   */
  constructor(code, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'SourceRuntimeError';
    this.code = code;
  }
}

/**
 * 创建稳定 runtime 错误。
 * 纯函数: 不修改 cause；只返回原错误或创建新的错误对象。
 * 已经是 SourceRuntimeError 时原样返回，避免重复包装 cause 链。
 *
 * @param {string} code 稳定错误码。
 * @param {string} message 当前边界诊断消息。
 * @param {*} cause 底层失败。
 * @returns {SourceRuntimeError} runtime 错误。
 */
function createSourceRuntimeError(code, message, cause) {
  // 条件分支: 底层失败已经是 runtime 错误时进入。
  // 执行内容: 原样返回，避免重复包装稳定 code 和 cause 链。
  if (cause instanceof SourceRuntimeError) {
    return cause;
  }

  return new SourceRuntimeError(code, message, { cause });
}

/**
 * 校验并隔离 runtime 构造选项。
 * 纯函数: 不修改 options 或默认种子，只创建严格 JSON 隔离副本和冻结结果。
 * 成功时补齐默认 Repository 种子、会话状态、活动源和更新端口。
 * 失败路径: 任一字段非法时转换为 runtime validation 并保留底层 cause。
 *
 * @param {*} options runtime 构造选项候选。
 * @returns {object} 字段完整的隔离选项。
 * @throws {SourceRuntimeError} 当字段、容器或端口不符合契约时抛出 validation。
 */
function normalizeRuntimeOptions(options) {
  try {
    // 条件分支: options 不是原型安全普通对象时进入。
    // 执行内容: 在读取字段前拒绝数组、null 和类实例。
    if (!options || typeof options !== 'object' || Array.isArray(options)
      || Object.getPrototypeOf(options) !== Object.prototype) {
      throw new TypeError('sourceRuntime options 必须是普通对象');
    }

    // 类型: Array<string>。
    // 作用: 保存调用方实际字段，检查页面依赖或未声明配置是否越过组合边界。
    const optionKeys = Object.keys(options);

    // 条件分支: 任一字段不属于四项冻结选项时进入。
    // 执行内容: 拒绝静默忽略额外字段。
    if (optionKeys.some(optionKey => !SOURCE_RUNTIME_OPTION_FIELDS.includes(optionKey))) {
      throw new TypeError('sourceRuntime options 包含未声明字段');
    }

    // 类型: object。
    // 作用: 保存隔离 Repository 种子，避免 runtime 创建后仍受调用方对象修改影响。
    const repositorySeeds = cloneSerializableValue(
      options.repositorySeeds || sourceRepositorySeeds,
      'sourceRuntime.repositorySeeds'
    );
    // 类型: Record<string, object>。
    // 作用: 保存隔离会话运行态种子，交给 SourceManager 完成字段校验。
    const initialRuntimeStates = cloneSerializableValue(
      options.initialRuntimeStates || {},
      'sourceRuntime.initialRuntimeStates'
    );
    // 类型: string。
    // 作用: 保存初始活动源；未显式提供时使用隔离偏好中的默认源。
    const activeSourceId = options.activeSourceId === undefined
      ? repositorySeeds.preferences.defaultSourceId
      : options.activeSourceId === ''
        ? ''
        : normalizeSourceShellId(options.activeSourceId, 'sourceRuntime.activeSourceId');
    // 类型: object。
    // 作用: 保存在线更新检测端口；当前阶段默认返回标准无更新结果。
    const updateCheckPort = options.updateCheckPort || DEFAULT_UPDATE_CHECK_PORT;

    // 条件分支: 更新端口不是对象或缺少 check 方法时进入。
    // 执行内容: 阻止 SourceManager 创建半完成检测能力。
    if (!updateCheckPort || typeof updateCheckPort !== 'object'
      || typeof updateCheckPort.check !== 'function') {
      throw new TypeError('sourceRuntime.updateCheckPort 必须提供 check 方法');
    }

    return Object.freeze({
      repositorySeeds,
      initialRuntimeStates,
      activeSourceId,
      updateCheckPort
    });
  } catch (error) {
    throw createSourceRuntimeError(
      SOURCE_RUNTIME_ERROR_CODE.validation,
      'SourceRuntime 构造选项无效',
      error
    );
  }
}

/**
 * 规范化 runtime sourceId。
 * 纯函数: 不修改 sourceId，只复用 Shell 校验并返回规范化字符串。
 * 复用 Shell 身份规则，并把底层校验失败转换为 runtime validation。
 * 成功路径: 返回可用于 Manager、Host 和 Provider 的同一真实身份。
 * 失败路径: Shell 校验失败时抛 runtime validation 并保留 cause。
 *
 * @param {*} sourceId 数据源身份候选。
 * @param {string} fieldName 诊断字段名。
 * @returns {string} 安全真实 sourceId。
 */
function normalizeRuntimeSourceId(sourceId, fieldName) {
  try {
    return normalizeSourceShellId(sourceId, fieldName);
  } catch (error) {
    throw createSourceRuntimeError(
      SOURCE_RUNTIME_ERROR_CODE.validation,
      `${fieldName} 无效`,
      error
    );
  }
}

/**
 * 隔离 runtime 内容或筛选请求。
 * 纯函数: 不修改原请求，只创建严格 JSON 副本并规范化副本 sourceId。
 * 等待初始化和按需启动期间调用方修改原对象不会改变最终 Provider 输入。
 * 成功路径: 返回可交给 Host 的隔离请求。
 * 失败路径: 非 JSON、非对象或身份非法时抛 runtime validation。
 *
 * @param {*} request 请求候选。
 * @param {string} fieldName 诊断字段名。
 * @returns {object} 包含安全 sourceId 的隔离请求。
 */
function normalizeRuntimeRequest(request, fieldName) {
  try {
    // 类型: object。
    // 作用: 保存请求严格 JSON 副本，后续等待不会继续读取调用方引用。
    const safeRequest = cloneSerializableValue(request, fieldName);

    // 条件分支: 隔离结果不是普通请求对象时进入。
    // 执行内容: 拒绝数组或标量进入 Host 业务调用。
    if (!safeRequest || typeof safeRequest !== 'object' || Array.isArray(safeRequest)) {
      throw new TypeError(`${fieldName} 必须是普通对象`);
    }

    safeRequest.sourceId = normalizeSourceShellId(safeRequest.sourceId, `${fieldName}.sourceId`);
    return safeRequest;
  } catch (error) {
    throw createSourceRuntimeError(
      SOURCE_RUNTIME_ERROR_CODE.validation,
      `${fieldName} 无效`,
      error
    );
  }
}

/**
 * 从 SourceManagerState 定位可按需启动的记录。
 * 纯函数: 只读取 Manager 隔离投影，不修改记录、运行态或软隐藏集合。
 * 不复制保存态；state 本身已经是 Manager 返回的隔离投影。
 * 成功路径: 返回目标隔离 SourceRecord。
 * 失败路径: 未命中抛 notFound；禁用或软隐藏抛 unavailable。
 *
 * @param {object} state 当前 SourceManagerState。
 * @param {string} sourceId 目标真实 sourceId。
 * @returns {object} 当前隔离 SourceRecord。
 * @throws {SourceRuntimeError} 记录不存在时抛 notFound，不可用或软隐藏时抛 unavailable。
 */
function findRuntimeSourceRecord(state, sourceId) {
  // 类型: object|null。
  // 作用: 通过 SourceRecord.definition.id 定位真实身份；根对象不维护第二个 id 别名。
  const record = state.records.find(
    candidate => candidate.definition.id === sourceId
  ) || null;

  // 条件分支: Manager 投影不存在目标记录时进入。
  // 执行内容: 阻止 runtime 伪造记录或回退到 sourceId 别名。
  if (!record) {
    throw createSourceRuntimeError(
      SOURCE_RUNTIME_ERROR_CODE.notFound,
      `数据源不存在: ${sourceId}`
    );
  }

  // 条件分支: 记录未有效启用或属于软隐藏系统源时进入。
  // 执行内容: 在创建 Context 和 Provider 前失败关闭。
  if (record.runtime.enabled !== true || state.removedSystemSourceIds.includes(sourceId)) {
    throw createSourceRuntimeError(
      SOURCE_RUNTIME_ERROR_CODE.unavailable,
      `数据源当前不可用: ${sourceId}`
    );
  }

  return record;
}

/**
 * 创建统一 SourceRuntime。
 * 副作用: 只创建当前实例私有的 Memory Repository、Manager、Host、Adapter 和 Promise 索引。
 * 公开边界: 返回冻结八方法门面，不泄漏任何基础设施引用。
 * 成功路径: 返回可独立初始化和按需调用多源 Provider 的冻结 runtime。
 * 失败路径: 构造依赖、种子、注册表或 Manager 非法时同步抛稳定 runtime 错误或底层领域错误。
 *
 * @param {object} options 可选组合输入。
 * @returns {object} 冻结 SourceRuntime 门面。
 */
export function createSourceRuntime(options = {}) {
  // 类型: object。
  // 作用: 保存字段完整的隔离构造选项，后续组合不再读取调用方 options。
  const normalizedOptions = normalizeRuntimeOptions(options);

  // 类型: object。
  // 作用: 保存当前 runtime 独占的三仓和 FIFO UnitOfWork 基础设施。
  const repositories = createMemorySourceRepositories(normalizedOptions.repositorySeeds);

  // 类型: object。
  // 作用: 保存当前 runtime 全源共享的模拟网络适配器，所有原始响应仍按请求 sourceId 精确路由。
  const networkAdapter = createMockNetworkAdapter();

  // 类型: object。
  // 作用: 保存当前 runtime 独占可信工厂映射，不暴露给公开门面。
  const factoryRegistry = createProviderFactoryRegistry();

  // 副作用: 显式注册唯一受审模拟 Provider 工厂；不读取或执行脚本文本。
  factoryRegistry.register(SYSTEM_DEMO_PROVIDER_KEY, createMockSourceProviderFactory());

  // 类型: SourceExecutionHost。
  // 作用: 保存当前 runtime 唯一 Provider 生命周期和受管调用权威。
  const sourceExecutionHost = createSourceExecutionHost({
    factoryRegistry,

    /**
     * 为一个 Host 生命周期创建 SourceContext runtime。
     * 副作用: 创建同 sourceId、同 signal 的挑战端口、日志控制器和冻结 Context；不启动 Provider。
     * 成功路径: 返回 Host 精确需要的 context/loggerController 两字段组合。
     * 失败路径: 任一 Shell 依赖校验失败时抛稳定 Shell 错误，由 Host/runtime 保留 cause。
     *
     * @param {string} sourceId 当前真实数据源身份。
     * @param {AbortSignal} signal Host 当前生命周期中止信号。
     * @returns {object} 冻结 Context runtime。
     */
    createSourceContextRuntime(sourceId, signal) {
      // 类型: object。
      // 作用: 保存与 Host 同源同 signal 的挑战占位端口。
      const challengePort = createSourceChallengePort({ sourceId, signal });

      // 类型: object。
      // 作用: 保存当前 Provider 独立脱敏日志控制器，读取端只交给 Host。
      const loggerController = createSourceLoggerController({ sourceId });

      // 类型: object。
      // 作用: 组合当前生命周期五类 Shell 能力，Provider 只能接收该冻结工具箱。
      const context = createSourceContext({
        sourceId,
        networkAdapter,
        storageRepository: repositories.storageRepository,
        challengePort,
        loggerController,
        signal
      });

      return Object.freeze({ context, loggerController });
    }
  });

  // 类型: Promise<object>|null。
  // 作用: 保存当前唯一 SourceManager 初始化 Promise；失败后清空以允许显式重试。
  let initializationPromise = null;

  // 类型: boolean。
  // 作用: true 表示 Manager 至少一次初始化成功；false 表示 getState 前必须先初始化。
  let initialized = false;

  // 类型: Map<string, Promise<object>>。
  // 作用: 按 sourceId 去重并发按需启动，不阻塞其他 sourceId 独立运行。
  const ensurePromiseBySourceId = new Map();

  // 类型: SourceManager。
  // 作用: 保存当前 runtime 唯一数据源事务权威和轻量投影来源。
  const sourceManager = new SourceManager({
    ...repositories,
    healthCheckPort: Object.freeze({
      /**
       * 通过同一 runtime/Host 执行 SourceManager 健康检测端口。
       * 副作用: 可能按需启动 Provider，并由 Host 执行网络健康请求。
       * 成功路径: 返回 Provider 标准健康结果。
       * 失败路径: runtime 门禁或 Host 调用失败时原样拒绝，SourceManager 负责收敛检测状态。
       *
       * @param {object} sourceRecord SourceManager 当前隔离记录。
       * @param {object} sourceRecord.definition 记录的可序列化数据源定义。
       * @param {string} sourceRecord.definition.id Repository、Host 和 Provider 共用的真实数据源身份。
       * @returns {Promise<object>} SourceHealthCheckResult。
       */
      async check(sourceRecord) {
        // 类型: string。
        // 作用: 从 SourceRecord 唯一身份位置读取健康检测目标，避免使用根对象不存在的 id 别名。
        const sourceId = sourceRecord.definition.id;

        return checkHealth(sourceId);
      }
    }),
    updateCheckPort: normalizedOptions.updateCheckPort
  }, {
    initialRuntimeStates: normalizedOptions.initialRuntimeStates,
    activeSourceId: normalizedOptions.activeSourceId
  });

  /**
   * 初始化当前 runtime 的 SourceManagerState。
   * 副作用: 首次调用创建并保存唯一 initializationPromise；成功设置 initialized，失败清空 Promise。
   * 成功路径: 每个调用方获得独立 Manager 投影副本。
   * 失败路径: Repository 或 Manager 失败转换为 initialization 并保留 cause。
   *
   * @returns {Promise<object>} 隔离 SourceManagerState。
   */
  function initialize() {
    // 条件分支: 当前尚无初始化 Promise 时进入。
    // 执行内容: 创建唯一真实 Manager.initialize 调用并记录成功/失败状态。
    if (!initializationPromise) {
      initializationPromise = sourceManager.initialize().then(
        (state) => {
          initialized = true;
          return state;
        },
        (error) => {
          initializationPromise = null;
          throw createSourceRuntimeError(
            SOURCE_RUNTIME_ERROR_CODE.initialization,
            'SourceRuntime 初始化失败',
            error
          );
        }
      );
    }

    return initializationPromise.then(() => sourceManager.getState());
  }

  /**
   * 读取当前 runtime 的 SourceManagerState。
   * 副作用: 尚未初始化时触发统一 initialize；已初始化时只读取隔离投影。
   * 成功路径: 返回 Manager 新副本。
   * 失败路径: 初始化失败时保留 initialization 错误。
   *
   * @returns {Promise<object>} 隔离 SourceManagerState。
   */
  async function getSourceManagerState() {
    // 条件分支: Manager 从未初始化成功时进入。
    // 执行内容: 等待唯一初始化 Promise，避免直接调用未初始化 getState。
    if (!initialized) {
      await initialize();
    }
    return sourceManager.getState();
  }

  /**
   * 执行单个 sourceId 的真实按需启动。
   * 副作用: 读取 Manager 投影，必要时释放旧 entry，并初始化、启动新 Provider 生命周期。
   * 成功路径: 返回 running Host 摘要。
   * 失败路径: 门禁失败转 unavailable，其他生命周期失败转 operation 并保留 cause。
   *
   * @param {string} sourceId 已规范化真实数据源身份。
   * @returns {Promise<object>} running Host 运行摘要。
   */
  async function ensureSourceRunningInternal(sourceId) {
    // 类型: object。
    // 作用: 保存 Manager 最新隔离投影，启动门禁不使用初始化时旧快照。
    const state = await getSourceManagerState();

    // 类型: object。
    // 作用: 保存目标有效 SourceRecord，交给 Host 完整门禁和工厂定位。
    const sourceRecord = findRuntimeSourceRecord(state, sourceId);

    try {
      // 类型: object|null。
      // 作用: 保存目标当前 Host 摘要；null 表示尚未创建或已经释放。
      const currentRuntimeState = await sourceExecutionHost.getRuntimeState(sourceId);

      // 条件分支: 当前 entry 已处于 running 时进入。
      // 执行内容: 直接复用有效生命周期，不重复 initialize/start。
      if (currentRuntimeState?.phase === SOURCE_EXECUTION_HOST_PHASE.running) {
        return currentRuntimeState;
      }

      // 条件分支: 存在 stopped、failed 或其他不可直接采用的旧 entry 时进入。
      // 执行内容: 完整释放旧 Context 和 Provider，再创建单调递增新代次。
      if (currentRuntimeState) {
        await sourceExecutionHost.dispose(sourceId);
      }

      await sourceExecutionHost.initialize(sourceRecord, {
        removedSystemSourceIds: state.removedSystemSourceIds
      });
      return await sourceExecutionHost.start(sourceId);
    } catch (error) {
      // 条件分支: Host 明确拒绝保存态、授权、软隐藏、工厂或数据集门禁时进入。
      // 执行内容: 转换为上层可识别 unavailable，并保留 Host cause。
      if (error instanceof SourceExecutionHostGateRejectedError
        || error instanceof SourceExecutionHostNotFoundError) {
        throw createSourceRuntimeError(
          SOURCE_RUNTIME_ERROR_CODE.unavailable,
          `数据源未通过运行门禁: ${sourceId}`,
          error
        );
      }

      throw createSourceRuntimeError(
        SOURCE_RUNTIME_ERROR_CODE.operation,
        `数据源启动失败: ${sourceId}`,
        error
      );
    }
  }

  /**
   * 确保目标 sourceId 已运行。
   * 副作用: 为当前 sourceId 保存一条在途 ensure Promise，收敛后仅删除同一 Promise。
   * 成功路径: 同源并发调用共享结果，不同源独立执行。
   * 失败路径: 规范化、门禁或生命周期错误原样返回给全部同源等待者。
   *
   * @param {*} sourceId 数据源身份候选。
   * @returns {Promise<object>} running Host 运行摘要。
   */
  function ensureSourceRunning(sourceId) {
    // 类型: string。
    // 作用: 保存符合 Shell/Host 统一规则的真实 sourceId。
    const safeSourceId = normalizeRuntimeSourceId(sourceId, 'ensureSourceRunning.sourceId');

    // 类型: Promise<object>|undefined。
    // 作用: 保存当前 sourceId 已存在的按需启动任务，用于并发复用。
    const existingPromise = ensurePromiseBySourceId.get(safeSourceId);

    // 条件分支: 当前 sourceId 已有在途启动时进入。
    // 执行内容: 返回同一 Promise，不向 Host 发起第二次 initialize。
    if (existingPromise) {
      return existingPromise;
    }

    // 类型: Promise<object>。
    // 作用: 保存本次真实启动任务，并在收敛后安全移除当前 Map 项。
    const ensurePromise = ensureSourceRunningInternal(safeSourceId).finally(() => {
      // 条件分支: Map 仍指向当前 Promise 时进入。
      // 执行内容: 删除已收敛任务；后续调用可以重新检查 Host 最新状态。
      if (ensurePromiseBySourceId.get(safeSourceId) === ensurePromise) {
        ensurePromiseBySourceId.delete(safeSourceId);
      }
    });
    ensurePromiseBySourceId.set(safeSourceId, ensurePromise);
    return ensurePromise;
  }

  /**
   * 通过 runtime 获取标准内容响应。
   * 副作用: 隔离请求、按需启动目标源并执行 Host 受管 Provider 调用。
   * 成功路径: 返回通过生命周期复查的 SourceDataResponse。
   * 失败路径: 请求和门禁错误保留分类；Provider/Host 调用失败转换为 operation。
   *
   * @param {*} request SourceDataRequest 候选。
   * @returns {Promise<object>} SourceDataResponse。
   */
  async function fetchData(request) {
    // 类型: object。
    // 作用: 保存调用开始时隔离的标准请求候选。
    const safeRequest = normalizeRuntimeRequest(request, 'fetchData.request');
    await ensureSourceRunning(safeRequest.sourceId);
    try {
      return await sourceExecutionHost.fetchData(safeRequest.sourceId, safeRequest);
    } catch (error) {
      throw createSourceRuntimeError(
        SOURCE_RUNTIME_ERROR_CODE.operation,
        `内容请求失败: ${safeRequest.sourceId}`,
        error
      );
    }
  }

  /**
   * 通过 runtime 获取标准筛选元数据响应。
   * 副作用: 隔离请求、复用同一 Provider 生命周期并执行 Host 筛选调用。
   * 成功路径: 返回 SourceFilterMetaResponse。
   * 失败路径: 请求和门禁错误保留分类；Provider/Host 调用失败转换为 operation。
   *
   * @param {*} request SourceFilterMetaRequest 候选。
   * @returns {Promise<object>} SourceFilterMetaResponse。
   */
  async function fetchFilterMeta(request) {
    // 类型: object。
    // 作用: 保存调用开始时隔离的筛选请求候选。
    const safeRequest = normalizeRuntimeRequest(request, 'fetchFilterMeta.request');
    await ensureSourceRunning(safeRequest.sourceId);
    try {
      return await sourceExecutionHost.fetchFilterMeta(safeRequest.sourceId, safeRequest);
    } catch (error) {
      throw createSourceRuntimeError(
        SOURCE_RUNTIME_ERROR_CODE.operation,
        `筛选元数据请求失败: ${safeRequest.sourceId}`,
        error
      );
    }
  }

  /**
   * 通过 runtime 获取 Provider 健康结果。
   * 副作用: 必要时按需启动 Provider，再执行 Host 受管健康调用。
   * 成功路径: 返回 SourceHealthCheckResult。
   * 失败路径: 身份和门禁错误保留分类；Host 调用失败转换为 operation。
   *
   * @param {*} sourceId 数据源身份候选。
   * @returns {Promise<object>} SourceHealthCheckResult。
   */
  async function checkHealth(sourceId) {
    // 类型: string。
    // 作用: 保存符合统一身份规则的健康检测目标。
    const safeSourceId = normalizeRuntimeSourceId(sourceId, 'checkHealth.sourceId');
    await ensureSourceRunning(safeSourceId);
    try {
      return await sourceExecutionHost.checkHealth(safeSourceId);
    } catch (error) {
      throw createSourceRuntimeError(
        SOURCE_RUNTIME_ERROR_CODE.operation,
        `健康检测失败: ${safeSourceId}`,
        error
      );
    }
  }

  /**
   * 停止一个已经受管运行的数据源。
   * 副作用: 委托 Host 拒绝新调用、abort、drain 并执行 Provider.stop。
   * 成功路径: 返回 stopped Host 摘要。
   * 失败路径: 未启动或生命周期失败转换为 operation 并保留 cause。
   *
   * @param {*} sourceId 数据源身份候选。
   * @returns {Promise<object>} stopped Host 运行摘要。
   */
  async function stopSource(sourceId) {
    // 类型: string。
    // 作用: 保存符合统一身份规则的停止目标。
    const safeSourceId = normalizeRuntimeSourceId(sourceId, 'stopSource.sourceId');
    await getSourceManagerState();
    try {
      return await sourceExecutionHost.stop(safeSourceId);
    } catch (error) {
      throw createSourceRuntimeError(
        SOURCE_RUNTIME_ERROR_CODE.operation,
        `数据源停止失败: ${safeSourceId}`,
        error
      );
    }
  }

  /**
   * 永久释放当前 runtime 内一个数据源实例。
   * 副作用: 已存在 entry 时委托 Host stop/dispose/日志清理；不删除 Repository 数据。
   * 成功路径: entry 不存在时幂等完成，存在时成功删除 Host 引用。
   * 失败路径: Host 释放失败转换为 operation 并保留可重试 cause。
   *
   * @param {*} sourceId 数据源身份候选。
   * @returns {Promise<void>} 释放完成后结束。
   */
  async function disposeSource(sourceId) {
    // 类型: string。
    // 作用: 保存符合统一身份规则的释放目标。
    const safeSourceId = normalizeRuntimeSourceId(sourceId, 'disposeSource.sourceId');
    await getSourceManagerState();
    try {
      // 类型: object|null。
      // 作用: 保存当前 Host entry 摘要；null 时释放操作幂等结束。
      const runtimeState = await sourceExecutionHost.getRuntimeState(safeSourceId);

      // 条件分支: 当前 sourceId 仍有 Host entry 时进入。
      // 执行内容: 完整停止并释放，不对 Repository 执行删除。
      if (runtimeState) {
        await sourceExecutionHost.dispose(safeSourceId);
      }
    } catch (error) {
      throw createSourceRuntimeError(
        SOURCE_RUNTIME_ERROR_CODE.operation,
        `数据源释放失败: ${safeSourceId}`,
        error
      );
    }
  }

  // 类型: object。
  // 作用: 只汇总契约八方法，作为最终冻结公开门面候选。
  const runtime = {
    initialize,
    getSourceManagerState,
    ensureSourceRunning,
    fetchData,
    fetchFilterMeta,
    checkHealth,
    stopSource,
    disposeSource
  };

  // 条件分支: 公开键数量、顺序或名称与冻结契约不一致时进入。
  // 执行内容: 在返回门面前阻止基础设施字段或遗漏方法泄漏。
  if (Object.keys(runtime).length !== SOURCE_RUNTIME_PUBLIC_METHODS.length
    || Object.keys(runtime).some(
      (methodName, index) => methodName !== SOURCE_RUNTIME_PUBLIC_METHODS[index]
    )) {
    throw createSourceRuntimeError(
      SOURCE_RUNTIME_ERROR_CODE.initialization,
      'SourceRuntime 公开方法顺序与冻结契约不一致'
    );
  }

  return Object.freeze(runtime);
}
