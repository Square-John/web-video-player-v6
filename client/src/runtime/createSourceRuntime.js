/*
  createSourceRuntime.js 模块说明

  - 文件职责:
      组合调用方显式注入的 Repository、SourceManager、NetworkAdapter、受信任 ProviderFactory、Source Shell 和 SourceExecutionHost。
      从同一基础设施图裁剪内容门面和完整设置管理门面，供内容、筛选与设置页适配共同使用。
      收敛并发初始化、同源按需启动和最新优先活动源切换，避免创建第二套保存态或生命周期权威。

  - 导入库及文件汇总(20 条，内置 0 条，第三方 0 条，自定义 20 条):
      HEALTH_STATUS、PROVIDER_READINESS_REASON_CODE、PROVIDER_READINESS_STATUS、SOURCE_SWITCH_STATUS: 自定义配置，生成 Provider 就绪结果并判断健康与切换事务状态。
      cloneSerializableValue: 自定义工具，隔离 runtime 接收的请求和构造选项。
      SourceManager: 自定义领域服务，负责保存态事务和轻量 SourceManagerState 投影。
      createProviderFactoryRegistry: 自定义注册表工厂，保存受审 providerKey 到工厂门面。
      SOURCE_EXECUTION_HOST_PHASE: 自定义枚举，判断 Host entry 是否已经运行或停止。
      SourceExecutionHost errors: 自定义错误，区分不可用门禁和未注册可信工厂。
      createSourceExecutionHost: 自定义 Host 工厂，创建 Provider 生命周期唯一权威。
      Source Shell factories: 自定义工厂，把注入 NetworkAdapter 与挑战、日志和 SourceContext 组合。
      normalizeSourceShellId: 自定义校验函数，统一 runtime 入口的 sourceId 规则。
      createSourceManagementInputAdapter: 自定义适配器工厂，把页面输入转换为完整领域命令。
      createMockSourceUpdatePort: 自定义更新端口工厂，提供确定性检测结果和受审候选。
      createSourceManagementRuntime: 自定义管理门面工厂，协调设置意图 FIFO、Manager 事务和 Host 补偿。
      createSourcePackageInputReader: 自定义三入口读取器，把文件、HTTPS 和文本统一为 SourcePackagePayload。
      createSourcePackageManifestParser: 自定义 Acorn 预检器，信任前静态提取并校验 manifest。
      createBrowserSourcePackageModuleExecutor: 自定义执行端口，信任后执行 Blob 模块并释放 URL。
      createSourcePackageLoader: 自定义加载边界，协调预览、信任、执行和 ProviderFactory 校验。
      createSourcePackageRestoreCoordinator: 自定义恢复协调器，在 Manager 初始化前恢复授权有效动态工厂。
      evaluateSourceAuthorizationFingerprint: 自定义授权工具，复用 Host 的版本与脚本指纹有效性规则派生页面候选。

  - 模块级常量:
      SOURCE_RUNTIME_ERROR_CODE: object，runtime 稳定错误码。
      SOURCE_RUNTIME_OPTION_FIELDS: Array<string>，Runtime Bundle 允许的精确选项。
      SOURCE_RUNTIME_PAGE_CAPABILITY: object，页面键到 SourceDefinition 能力键的唯一映射。
      SOURCE_RUNTIME_PUBLIC_METHODS: Array<string>，公开 runtime 十二方法顺序。
      SOURCE_RUNTIME_SWITCH_REQUEST_PREFIX: string，当前 Runtime 切换请求身份前缀。
      SOURCE_RUNTIME_SWITCH_ERROR_MESSAGE_BY_CODE: object，Runtime 错误到用户切换说明的映射。
      SOURCE_PROVIDER_READINESS_REASON_MESSAGE: object，Provider 未就绪原因码到用户说明的映射。
      SOURCE_MANAGEMENT_RUNTIME_PUBLIC_METHODS: Array<string>，设置管理完整门面十八方法顺序。
      SOURCE_RUNTIME_BUNDLE_PUBLIC_FIELDS: Array<string>，Bundle 两个公开门面字段顺序。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createSourceRuntimeError(code, message, cause): 创建保留底层 cause 的稳定 runtime 错误。
      resolveSourceSwitchErrorMessage(error): 把 Runtime 内部错误转换为用户可读切换说明。
      normalizeRuntimeNetworkAdapter(networkAdapter): 校验显式注入的统一网络端口。
      normalizeRuntimeChallengeRequestPort(challengeRequestPort): 校验可选挑战请求窄端口。
      normalizeRuntimeRepositories(repositories): 校验显式注入的三仓和 UnitOfWork。
      normalizeRuntimeInfrastructureInitializer(initializer): 校验可选基础设施初始化函数。
      normalizeRuntimeProviderFactories(providerFactories): 校验调用方显式受信任工厂集合。
      normalizeRuntimeModuleExecutor(moduleExecutor): 校验可替换模块执行端口或创建浏览器默认实现。
      normalizeRuntimeOptions(options): 校验并隔离 runtime 构造选项。
      createSourceUpdateCheckPortView(sourceUpdatePort): 从完整更新端口裁剪 SourceManager 只读检测能力。
      normalizeRuntimeSourceId(sourceId, fieldName): 把 Shell 身份校验错误转换为 runtime validation。
      normalizeRuntimeOptionalSourceId(sourceId, fieldName): 规范化可省略的页面请求源身份。
      normalizeRuntimePageKey(pageKey, fieldName): 校验页面键并返回对应能力键。
      normalizeRuntimeRequest(request, fieldName): 隔离请求并读取真实 sourceId。
      findRuntimeSourceRecord(state, sourceId): 从 Manager 投影按真实身份定位记录。

  - 模块级类:
      SourceRuntimeError: Error，携带稳定 code 和可选 cause。

  - 对外导出:
      SOURCE_RUNTIME_ERROR_CODE: object，runtime 稳定错误码。
      SourceRuntimeError: Class，runtime 统一错误基类。
      createSourceRuntimeBundle: Function，创建共享基础设施和两个冻结门面。
      createSourceRuntime: Function，创建冻结十二方法运行门面。
*/

import {
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 数据源健康状态枚举。
  // 文件作用: 活动源只有在本次标准健康检查收敛为 normal 后才允许采用。
  HEALTH_STATUS,

  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: PROVIDER_READINESS_REASON_CODE Provider 未就绪稳定原因码。
  // 文件作用: Runtime 评估端口区分工厂未注册和 Definition 不受支持。
  PROVIDER_READINESS_REASON_CODE,

  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: PROVIDER_READINESS_STATUS Provider 当前会话就绪枚举。
  // 文件作用: Runtime 生成端口结果并消费 SourceManagerState 中的唯一就绪投影。
  PROVIDER_READINESS_STATUS,

  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: SOURCE_SWITCH_STATUS 活动源切换状态枚举。
  // 文件作用: Runtime 判断 begin/complete/fail 返回状态是否仍属于当前 requestId。
  SOURCE_SWITCH_STATUS
} from '../config/source-manager.config.js';

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

// 导入来源: ./source-management/sourceManagementInputAdapter.js。
// 导入内容: createSourceManagementInputAdapter 设置输入适配器工厂。
// 文件作用: 为当前 Bundle 创建唯一纯适配器，组件和 service 不拼接 Repository 保存对象。
import { createSourceManagementInputAdapter } from './source-management/sourceManagementInputAdapter.js';

// 导入来源: ./source-management/mockSourceUpdatePort.js。
// 导入内容: createMockSourceUpdatePort 模拟在线更新端口工厂。
// 文件作用: 同一端口同时供 SourceManager 检测和管理 Runtime 读取受审候选。
import { createMockSourceUpdatePort } from './source-management/mockSourceUpdatePort.js';

// 导入来源: ./source-management/sourceManagementRuntime.js。
// 导入内容: createSourceManagementRuntime 设置管理门面工厂。
// 文件作用: 在当前 Bundle 内协调唯一 SourceManager、Host、输入适配器和更新端口。
import { createSourceManagementRuntime } from './source-management/sourceManagementRuntime.js';

// 导入来源: ./source-package/sourcePackageInputReader.js。
// 导入内容: createSourcePackageInputReader 三入口共同读取器工厂。
// 文件作用: 绑定当前 Bundle 唯一 NetworkAdapter，统一生成 SourcePackagePayload。
import { createSourcePackageInputReader } from './source-package/sourcePackageInputReader.js';

// 导入来源: ./source-package/sourcePackageManifestParser.js。
// 导入内容: createSourcePackageManifestParser 信任前静态预检器工厂。
// 文件作用: 使用公共协议校验单文件导出、manifest 和禁用全局能力。
import { createSourcePackageManifestParser } from './source-package/sourcePackageManifestParser.js';

// 导入来源: ./source-package/sourcePackageModuleExecutor.js。
// 导入内容: createBrowserSourcePackageModuleExecutor 浏览器模块执行器工厂。
// 文件作用: 用户确认后执行同一规范化文本并在 finally 释放 Blob URL。
import { createBrowserSourcePackageModuleExecutor } from './source-package/sourcePackageModuleExecutor.js';

// 导入来源: ./source-package/sourcePackageLoader.js。
// 导入内容: createSourcePackageLoader 单文件加载器工厂。
// 文件作用: 协调读取、预检、信任、执行和动态工厂校验，不直接保存或注册。
import { createSourcePackageLoader } from './source-package/sourcePackageLoader.js';

// 导入来源: ./source-package/sourcePackageRestoreCoordinator.js；导入内容: createSourcePackageRestoreCoordinator；文件作用: 在 Manager 初始化前恢复已授权动态工厂并提供失败释放。
import { createSourcePackageRestoreCoordinator } from './source-package/sourcePackageRestoreCoordinator.js';

// 导入来源: ../utils/sourceAuthorization.js。
// 导入内容: evaluateSourceAuthorizationFingerprint 指纹授权评估函数。
// 文件作用: 页面候选与 Host 复用同一授权有效性规则，不把 authorization.status 当成运行许可。
import { evaluateSourceAuthorizationFingerprint } from '../utils/sourceAuthorization.js';

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

// 类型: string。
// 作用: 给当前 Runtime 实例单调序号提供稳定命名空间；不使用时间戳、随机数或跨实例全局状态。
const SOURCE_RUNTIME_SWITCH_REQUEST_PREFIX = 'source-switch-';

// 类型: object。
// 作用: 把 Runtime 稳定错误码映射为页面可直接展示的切换失败说明，不泄漏内部类名、code、cause 或堆栈。
const SOURCE_RUNTIME_SWITCH_ERROR_MESSAGE_BY_CODE = Object.freeze({
  [SOURCE_RUNTIME_ERROR_CODE.validation]: '数据源切换参数无效，请重新选择。',
  [SOURCE_RUNTIME_ERROR_CODE.initialization]: '数据源服务初始化失败，请稍后重试。',
  [SOURCE_RUNTIME_ERROR_CODE.notFound]: '目标数据源不存在，请刷新后重新选择。',
  [SOURCE_RUNTIME_ERROR_CODE.unavailable]: '目标数据源当前不可用，请选择其他数据源。',
  [SOURCE_RUNTIME_ERROR_CODE.operation]: '目标数据源启动失败，请稍后重试。'
});

// 类型: object。
// 作用: 把 Provider 就绪失败原因码映射为用户可理解说明；设置页只消费投影结果，不解析 providerKey。
const SOURCE_PROVIDER_READINESS_REASON_MESSAGE = Object.freeze({
  // 类型: string；作用: 当前 Bundle 没有对应受审工厂时说明脚本尚未接入可执行 Provider。
  [PROVIDER_READINESS_REASON_CODE.providerNotRegistered]: '当前数据源脚本尚未接入可执行 Provider。',
  // 类型: string；作用: 工厂存在但没有当前 Definition 数据集或实现时说明不支持关系。
  [PROVIDER_READINESS_REASON_CODE.definitionNotSupported]: '当前 Provider 不支持该数据源定义。'
});

// 类型: Array<string>。
// 作用: Runtime Bundle 只允许九项显式选项，阻止页面、store、模式判断、种子或脚本文本进入组合层。
const SOURCE_RUNTIME_OPTION_FIELDS = Object.freeze([
  'networkAdapter',
  'challengeRequestPort',
  'repositories',
  'initializeInfrastructure',
  'trustedProviderFactories',
  'sourcePackageModuleExecutor',
  'initialRuntimeStates',
  'activeSourceId',
  'sourceUpdatePort'
]);

// 类型: object。
// 作用: 集中映射六类页面请求键与 SourceDefinition.capabilities；播放请求使用 player，但定义能力仍为 play。
const SOURCE_RUNTIME_PAGE_CAPABILITY = Object.freeze({
  home: 'home',
  movie: 'movie',
  tv: 'tv',
  search: 'search',
  detail: 'detail',
  player: 'play'
});

// 类型: Array<string>。
// 作用: 固定公开 runtime 十二方法及 Object.keys 顺序，测试据此确认没有基础设施引用泄漏。
const SOURCE_RUNTIME_PUBLIC_METHODS = Object.freeze([
  'initialize',
  'getSourceManagerState',
  'listSwitchableSources',
  'listAvailableSources',
  'resolveSourceId',
  'switchActiveSource',
  'ensureSourceRunning',
  'fetchData',
  'fetchFilterMeta',
  'checkHealth',
  'stopSource',
  'disposeSource'
]);

// 类型: Array<string>。
// 作用: 固定设置管理门面的十八项公开方法，测试据此确认没有 Manager、Host、端口或 FIFO 引用泄漏。
const SOURCE_MANAGEMENT_RUNTIME_PUBLIC_METHODS = Object.freeze([
  'initialize',
  'subscribe',
  'getSourceManagerState',
  'setDefaultSource',
  'checkSource',
  'checkAllSources',
  'checkSourceUpdate',
  'setSourceEnabled',
  'authorizeSource',
  'revokeSourceAuthorization',
  'restoreSystemSources',
  'clearTemporarySourceCache',
  'clearAllSourceCache',
  'previewSourceImport',
  'importSource',
  'applySourceUpdate',
  'deleteSources',
  'createSourceExportBundle'
]);

// 类型: Array<string>。
// 作用: 固定 Bundle 只公开内容和设置管理两个门面，防止 Repository、Manager 或 Host 引用泄漏。
const SOURCE_RUNTIME_BUNDLE_PUBLIC_FIELDS = Object.freeze([
  'sourceRuntime',
  'sourceManagementRuntime'
]);

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
 * 把活动源切换内部错误转换为用户可直接理解的稳定说明。
 * 纯函数: 只读取 SourceRuntimeError.code，不修改错误或 cause。
 * 调用方: switchActiveSource 在发布 failed 前收敛页面文本。
 * 未知错误使用通用启动失败说明，不能把原始 message 或堆栈写入 SourceManagerState。
 *
 * @param {*} error Runtime、Manager、Host 或校验边界抛出的失败。
 * @returns {string} 不含内部错误细节的用户可读说明。
 */
function resolveSourceSwitchErrorMessage(error) {
  // 类型: string|undefined。
  // 作用: 只有 Runtime 稳定错误码参与公开文案映射，其他错误不读取 message 猜测分类。
  const errorCode = error instanceof SourceRuntimeError ? error.code : undefined;

  // 返回值类型: string。
  // 作用: 已知分类使用对应说明，Manager 或未知错误统一使用启动失败说明。
  return SOURCE_RUNTIME_SWITCH_ERROR_MESSAGE_BY_CODE[errorCode]
    || SOURCE_RUNTIME_SWITCH_ERROR_MESSAGE_BY_CODE[SOURCE_RUNTIME_ERROR_CODE.operation];
}

/**
 * 校验 Runtime 显式注入的统一 NetworkAdapter。
 * 纯函数: 只读取对象形状、冻结状态和 request 方法，不调用适配器或修改输入。
 * 成功路径: 返回只含 request 方法且不可替换的原适配器引用。
 * 失败路径: 非普通对象、可变对象、额外字段或缺少 request 时抛 TypeError。
 *
 * @param {*} networkAdapter Runtime 网络依赖候选。
 * @returns {Readonly<{ request: Function }>} 已验证的统一网络端口。
 * @throws {TypeError} 适配器不符合最小依赖契约时抛出。
 */
function normalizeRuntimeNetworkAdapter(networkAdapter) {
  // 条件分支: 适配器不是冻结普通对象时进入。
  // 执行内容: 抛 TypeError，避免 Runtime 创建后 request 方法被替换或挂载外部状态。
  if (!networkAdapter
    || typeof networkAdapter !== 'object'
    || Array.isArray(networkAdapter)
    || Object.getPrototypeOf(networkAdapter) !== Object.prototype
    || !Object.isFrozen(networkAdapter)) {
    throw new TypeError('sourceRuntime.networkAdapter 必须是冻结普通对象');
  }

  // 类型: Array<string|symbol>；作用: 读取全部自有键，确保 Runtime 只获得最小 request 能力。
  const adapterKeys = Reflect.ownKeys(networkAdapter);
  // 条件分支: 适配器不是精确单字段，或 request 不是函数时进入。
  // 执行内容: 抛 TypeError，禁止泄漏模式、fixture、fetch 或 fallback 控制面。
  if (adapterKeys.length !== 1
    || adapterKeys[0] !== 'request'
    || typeof networkAdapter.request !== 'function') {
    throw new TypeError('sourceRuntime.networkAdapter 必须只提供 request 方法');
  }

  return networkAdapter;
}

/**
 * 校验可选全局挑战请求端口。
 * 纯函数: 不调用或修改端口；只检查冻结状态和精确 request 能力。
 * 成功路径: undefined 返回 null，显式端口返回原冻结引用。
 * 失败路径: 可变对象、额外字段或缺少 request 时抛 TypeError。
 *
 * @param {*} challengeRequestPort 全局协调器请求端口候选。
 * @returns {Readonly<{ request: Function }>|null} 已验证窄端口或明确无交互 null。
 * @throws {TypeError} 端口不符合最小依赖契约时抛出。
 */
function normalizeRuntimeChallengeRequestPort(challengeRequestPort) {
  // 条件分支: 调用方没有注入挑战协调器时进入。
  // 执行内容: 返回 null，让 SourceChallengePort 保持明确 unsupported 语义。
  if (challengeRequestPort === undefined) return null;

  // 条件分支: 端口不是冻结对象时进入。
  // 执行内容: 拒绝后续替换 request 改变 Host 生命周期行为。
  if (!challengeRequestPort || typeof challengeRequestPort !== 'object'
    || Array.isArray(challengeRequestPort) || !Object.isFrozen(challengeRequestPort)) {
    throw new TypeError('sourceRuntime.challengeRequestPort 必须是冻结对象');
  }

  // 类型: Array<string|symbol>。
  // 作用: 检查端口只暴露 request，不泄漏页面订阅、提交或队列控制能力。
  const portKeys = Reflect.ownKeys(challengeRequestPort);
  // 条件分支: 字段集合不是精确 request 或其值不是函数时进入。
  // 执行内容: 拒绝未裁剪协调器进入 Runtime 基础设施图。
  if (portKeys.length !== 1 || portKeys[0] !== 'request'
    || typeof challengeRequestPort.request !== 'function') {
    throw new TypeError('sourceRuntime.challengeRequestPort 必须只提供 request 方法');
  }

  return challengeRequestPort;
}

/**
 * 校验 Runtime 显式注入的 Repository 基础设施。
 * 纯函数: 不调用、不复制或修改仓实例，只检查精确四字段和公开方法能力。
 * 成功路径: 返回原始基础设施引用，让 Bundle 内所有对象共享同一保存权威。
 * 失败路径: 字段、Repository 或 UnitOfWork 不完整时抛 TypeError，不创建 Memory 或备用实现。
 *
 * @param {*} repositories Package、Definition、Storage Repository 和 UnitOfWork 候选。
 * @returns {object} 已验证原始 Repository 基础设施。
 * @throws {TypeError} 当依赖不符合 Runtime 最小调用契约时抛出。
 */
function normalizeRuntimeRepositories(repositories) {
  // 条件分支: 基础设施不是原型安全普通对象时进入。
  // 执行内容: 拒绝数组、类实例和原生数据库连接直接成为 Runtime 选项。
  if (!repositories || typeof repositories !== 'object' || Array.isArray(repositories)
    || Object.getPrototypeOf(repositories) !== Object.prototype) {
    throw new TypeError('sourceRuntime.repositories 必须是普通对象');
  }
  // 类型: Array<string>；作用: 固定 Runtime 只获得三仓和 UnitOfWork，不接受种子、连接或模式字段。
  const repositoryFields = Object.freeze([
    'packageRepository',
    'definitionRepository',
    'storageRepository',
    'unitOfWork'
  ]);
  // 类型: Array<string>；作用: 检查调用方真实注入字段与四项冻结依赖完全一致。
  const actualFields = Object.keys(repositories);
  // 条件分支: 基础设施缺字段、包含额外字段或字段顺序之外的名称时进入。
  // 执行内容: 阻止 Runtime 获得数据库、fallback 或第二状态入口。
  if (actualFields.length !== repositoryFields.length
    || actualFields.some(field => !repositoryFields.includes(field))) {
    throw new TypeError('sourceRuntime.repositories 字段不完整');
  }

  // 类型: object；作用: 定义每项依赖最小公开方法集合，不检查或读取私有实现。
  const requiredMethods = {
    packageRepository: ['loadAll', 'get', 'save', 'remove'],
    definitionRepository: [
      'loadDefinitions',
      'getDefinition',
      'saveDefinition',
      'removeDefinition',
      'loadPreferences',
      'savePreferences'
    ],
    storageRepository: [
      'get',
      'set',
      'remove',
      'list',
      'clear',
      'clearAll',
      'removeSource',
      'getUsage'
    ],
    unitOfWork: ['runInTransaction']
  };
  // 循环作用: 逐项确认 SourceManager 与 SourceContext 实际需要的方法存在。
  Object.entries(requiredMethods).forEach(([repositoryName, methodNames]) => {
    // 类型: object；作用: 保存当前待校验 Repository 或 UnitOfWork 实例。
    const repository = repositories[repositoryName];
    // 条件分支: 当前依赖不是对象或缺少任一正式方法时进入。
    // 执行内容: 在组合 SourceManager 前失败，不返回部分 Runtime Bundle。
    if (!repository || typeof repository !== 'object'
      || methodNames.some(methodName => typeof repository[methodName] !== 'function')) {
      throw new TypeError(`sourceRuntime.repositories.${repositoryName} 无效`);
    }
  });

  return repositories;
}

/**
 * 校验应用组合层提供的基础设施初始化函数。
 * 纯函数: 不调用初始化器；缺失时返回只服务显式 Memory 测试的无副作用异步函数。
 * 成功路径: 返回调用方原函数或唯一 no-op。
 * 失败路径: 非函数输入抛 TypeError，不打开数据库或创建备用 Repository。
 *
 * @param {*} initializer 数据库打开、迁移和首次种子函数候选。
 * @returns {Function} 返回 Promise 的基础设施初始化函数。
 */
function normalizeRuntimeInfrastructureInitializer(initializer) {
  // 条件分支: 调用方使用无需异步准备的显式测试基础设施时进入。
  // 执行内容: 返回无副作用 no-op，不选择或创建具体 Repository。
  if (initializer === undefined) return async () => undefined;
  // 条件分支: 显式值不是函数时进入。
  // 执行内容: 拒绝 Promise、Boolean 或数据库对象成为隐式模式开关。
  if (typeof initializer !== 'function') {
    throw new TypeError('sourceRuntime.initializeInfrastructure 必须是函数');
  }
  return initializer;
}

/**
 * 校验应用组合层显式提供的受信任 ProviderFactory 集合。
 * 纯函数: 返回同一冻结数组，不注册工厂、不创建 Provider，也不复制函数对象。
 * 成功路径: 产品未提供该测试注入项时返回冻结空数组；显式冻结数组中的每项都是冻结三字段工厂候选时返回。
 * 失败路径: 显式值可变、包含重复引用或字段形状偏离时抛 TypeError，后续 Registry 不接收部分集合。
 *
 * @param {*} providerFactories 产品内置目录或测试夹具提供的冻结工厂数组。
 * @returns {ReadonlyArray<Readonly<object>>} 已验证受信任工厂集合。
 * @throws {TypeError} 当集合不能安全交给 Registry 时抛出。
 */
function normalizeRuntimeProviderFactories(providerFactories) {
  // 条件分支: 产品组合点没有提供隔离测试工厂时进入。
  // 执行内容: 使用冻结空集合启动 Registry，系统源和用户源都只能从保存脚本文本恢复。
  if (providerFactories === undefined) return Object.freeze([]);

  // 条件分支: 调用方显式提供的隔离测试集合不是冻结数组时进入。
  // 执行内容: 禁止 Runtime 偷偷建立 Mock 默认工厂或从 Definition 推断实现。
  if (!Array.isArray(providerFactories) || !Object.isFrozen(providerFactories)) {
    throw new TypeError('sourceRuntime.trustedProviderFactories 必须是冻结数组');
  }

  // 类型: Set<object>。
  // 作用: 阻止同一个工厂对象重复注册两次并制造无意义冲突。
  const uniqueFactories = new Set();
  providerFactories.forEach((providerFactory, factoryIndex) => {
    // 类型: Array<string|symbol>。
    // 作用: 复核工厂只公开 Registry 接受的 providerKey、supports 和 create。
    const factoryFields = providerFactory && typeof providerFactory === 'object'
      ? Reflect.ownKeys(providerFactory)
      : [];

    // 条件分支: 工厂可变、字段不精确、方法缺失或重复引用时进入。
    // 执行内容: 在创建 Registry 前拒绝半完成集合，详细身份冲突仍由 Registry 统一报告。
    if (!providerFactory || typeof providerFactory !== 'object'
      || !Object.isFrozen(providerFactory)
      || factoryFields.length !== 3
      || !factoryFields.includes('providerKey')
      || !factoryFields.includes('supports')
      || !factoryFields.includes('create')
      || typeof providerFactory.providerKey !== 'string'
      || typeof providerFactory.supports !== 'function'
      || typeof providerFactory.create !== 'function'
      || uniqueFactories.has(providerFactory)) {
      throw new TypeError(`sourceRuntime.trustedProviderFactories[${factoryIndex}] 无效`);
    }
    uniqueFactories.add(providerFactory);
  });

  return providerFactories;
}

/**
 * 校验可替换的数据源模块执行端口。
 * 纯函数: 显式端口只读取形状；未提供时创建浏览器 Blob 执行器，但不执行脚本或创建 URL。
 * 成功路径: 返回精确冻结 execute 端口，供导入与启动恢复共享同一执行策略。
 * 失败路径: 可变对象、额外能力或缺少 execute 时抛 TypeError，不回退 eval、Function 或第二执行器。
 *
 * @param {*} moduleExecutor 应用组合层、测试或未来沙盒提供的执行端口候选。
 * @returns {Readonly<{ execute: Function }>} 已验证执行端口。
 * @throws {TypeError} 显式端口不符合最小能力边界时抛出。
 */
function normalizeRuntimeModuleExecutor(moduleExecutor) {
  // 类型: Readonly<{ execute: Function }>；作用: 未显式替换时使用生产浏览器执行边界。
  const resolvedExecutor = moduleExecutor === undefined
    ? createBrowserSourcePackageModuleExecutor()
    : moduleExecutor;
  // 类型: Array<string|symbol>；作用: 检查端口没有暴露脚本文本、URL、注册表或清理控制面。
  const executorKeys = resolvedExecutor && typeof resolvedExecutor === 'object'
    ? Reflect.ownKeys(resolvedExecutor)
    : [];

  // 条件分支: 端口不是冻结普通对象、字段不精确或 execute 不是函数时进入。
  // 执行内容: 构造阶段失败，阻止可变或越权执行能力进入 Runtime 安装图。
  if (!resolvedExecutor
    || typeof resolvedExecutor !== 'object'
    || Array.isArray(resolvedExecutor)
    || Object.getPrototypeOf(resolvedExecutor) !== Object.prototype
    || !Object.isFrozen(resolvedExecutor)
    || executorKeys.length !== 1
    || executorKeys[0] !== 'execute'
    || typeof resolvedExecutor.execute !== 'function') {
    throw new TypeError('sourceRuntime.sourcePackageModuleExecutor 必须是冻结单方法端口');
  }

  return resolvedExecutor;
}

/**
 * 校验并隔离 runtime 构造选项。
 * 纯函数: 不修改 options 或默认种子，只创建严格 JSON 隔离副本和冻结结果。
 * 成功时采用显式 NetworkAdapter、Repository 基础设施，并补齐会话状态、活动源和检测/候选共用更新端口。
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

    // 条件分支: 任一字段不属于九项冻结选项时进入。
    // 执行内容: 拒绝静默忽略额外字段。
    if (optionKeys.some(optionKey => !SOURCE_RUNTIME_OPTION_FIELDS.includes(optionKey))) {
      throw new TypeError('sourceRuntime options 包含未声明字段');
    }

    // 类型: Readonly<object>。
    // 作用: 保存调用方显式选择并创建的唯一网络适配器；Runtime 不读取模式或创建回退实现。
    const networkAdapter = normalizeRuntimeNetworkAdapter(options.networkAdapter);
    // 类型: Readonly<object>|null。
    // 作用: 保存应用唯一协调器请求窄端口；null 表示当前 Runtime 不提供人工交互。
    const challengeRequestPort = normalizeRuntimeChallengeRequestPort(
      options.challengeRequestPort
    );
    // 类型: object。
    // 作用: 保存调用方显式选择的三仓与 UnitOfWork；Runtime 不创建或切换具体适配器。
    const repositories = normalizeRuntimeRepositories(options.repositories);
    // 类型: Function；作用: 保存 Repository 读取和脚本恢复前必须完成的基础设施初始化屏障。
    const initializeInfrastructure = normalizeRuntimeInfrastructureInitializer(
      options.initializeInfrastructure
    );
    // 类型: ReadonlyArray<Readonly<object>>。
    // 作用: 保存隔离领域测试显式提供的静态工厂；产品缺省为空并只从 Repository 保存脚本恢复。
    const trustedProviderFactories = normalizeRuntimeProviderFactories(
      options.trustedProviderFactories
    );
    // 类型: Readonly<{ execute: Function }>；作用: 保存导入和恢复共用的唯一脚本执行策略。
    const sourcePackageModuleExecutor = normalizeRuntimeModuleExecutor(
      options.sourcePackageModuleExecutor
    );
    // 类型: Record<string, object>。
    // 作用: 保存隔离会话运行态种子，交给 SourceManager 完成字段校验。
    const initialRuntimeStates = cloneSerializableValue(
      options.initialRuntimeStates || {},
      'sourceRuntime.initialRuntimeStates'
    );
    // 类型: string。
    // 作用: 保存初始活动源；未显式提供时保持空值，由 SourceManager 初始化保存图决定默认源。
    const activeSourceId = options.activeSourceId === undefined
      ? ''
      : options.activeSourceId === ''
        ? ''
        : normalizeSourceShellId(options.activeSourceId, 'sourceRuntime.activeSourceId');
    // 类型: object。
    // 作用: 保存检查更新和读取受审候选共用端口；未注入时创建当前 Bundle 独立的只读模拟端口。
    const sourceUpdatePort = options.sourceUpdatePort || createMockSourceUpdatePort();

    // 条件分支: 更新端口不是对象，或缺少 check/getUpdateCandidate 任一方法时进入。
    // 执行内容: 阻止 Manager 检测和管理 Runtime 候选读取使用两套不完整端口。
    if (!sourceUpdatePort || typeof sourceUpdatePort !== 'object'
      || typeof sourceUpdatePort.check !== 'function'
      || typeof sourceUpdatePort.getUpdateCandidate !== 'function') {
      throw new TypeError('sourceRuntime.sourceUpdatePort 必须提供 check 和 getUpdateCandidate 方法');
    }

    return Object.freeze({
      networkAdapter,
      challengeRequestPort,
      repositories,
      initializeInfrastructure,
      trustedProviderFactories,
      sourcePackageModuleExecutor,
      initialRuntimeStates,
      activeSourceId,
      sourceUpdatePort
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
 * 创建 SourceManager 专用的更新检测端口视图。
 * 纯函数: 不修改完整更新端口，只创建一个只暴露 check 的冻结委托对象。
 * 能力边界: SourceManager 只能检测更新，不能读取用户确认后才能采用的更新候选。
 * 成功路径: check 原样委托同一完整端口实例，检测与候选读取继续共享唯一数据来源。
 * 失败路径: 完整端口的同步或异步错误原样传播，由 SourceManager 端口边界统一包装。
 *
 * @param {object} sourceUpdatePort 已由 normalizeRuntimeOptions 校验的完整更新端口。
 * @returns {object} 只包含异步 check 方法的冻结端口视图。
 */
function createSourceUpdateCheckPortView(sourceUpdatePort) {
  return Object.freeze({
    /**
     * 委托同一更新端口执行只读检测。
     * 副作用: 只调用完整端口的 check；不读取候选，不修改 Manager、Host 或 Repository。
     * 成功路径: 返回标准 SourceUpdateCheckResult 候选，由 SourceManager 再执行结果校验。
     * 失败路径: 完整端口拒绝时原样传播，不回退到第二端口或静态默认结果。
     *
     * @param {object} sourceRecord SourceManager 提供的隔离轻量记录。
     * @returns {Promise<object>} 完整端口返回的标准更新检测结果。
     */
    async check(sourceRecord) {
      return sourceUpdatePort.check(sourceRecord);
    }
  });
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
 * 规范化页面请求中允许省略的数据源身份。
 * 纯函数: undefined、null 和空白字符串统一返回空字符串；其他输入复用 Shell 身份规则。
 * 成功路径: 返回空字符串或已规范化真实 sourceId。
 * 失败路径: 非字符串非空值或非法身份转换为 runtime validation。
 *
 * @param {*} sourceId 页面显式数据源身份候选。
 * @param {string} fieldName 错误消息中的字段路径。
 * @returns {string} 空字符串或真实 sourceId。
 * @throws {SourceRuntimeError} 非法身份候选抛 validation。
 */
function normalizeRuntimeOptionalSourceId(sourceId, fieldName) {
  // 条件分支: 调用方没有指定身份，或只传入空白文本时进入。
  // 执行内容: 保留“由 Runtime 解析活动源”的明确语义，不读取页面 store。
  if (sourceId === undefined || sourceId === null
    || (typeof sourceId === 'string' && !sourceId.trim())) {
    return '';
  }

  return normalizeRuntimeSourceId(sourceId, fieldName);
}

/**
 * 校验内容页面键并解析 Definition 能力键。
 * 纯函数: 只读取冻结页面映射，不修改请求、记录或运行态。
 * 成功路径: 返回 home/movie/tv/search/detail 或 player 对应的能力键。
 * 失败路径: 非字符串、空白或未知页面键抛 runtime validation。
 *
 * @param {*} pageKey 页面请求键候选。
 * @param {string} fieldName 错误消息中的字段路径。
 * @returns {string} SourceDefinition.capabilities 中的能力键。
 * @throws {SourceRuntimeError} 页面键不属于正式六类内容能力时抛 validation。
 */
function normalizeRuntimePageKey(pageKey, fieldName) {
  // 类型: string。
  // 作用: 去除页面输入首尾空白；非字符串保持空值并进入统一失败路径。
  const safePageKey = typeof pageKey === 'string' ? pageKey.trim() : '';

  // 条件分支: 页面键没有正式能力映射时进入。
  // 执行内容: 拒绝 service、store 或 Provider 自行扩张页面能力。
  if (!Object.hasOwn(SOURCE_RUNTIME_PAGE_CAPABILITY, safePageKey)) {
    throw createSourceRuntimeError(
      SOURCE_RUNTIME_ERROR_CODE.validation,
      `${fieldName} 不受支持: ${safePageKey || 'unknown'}`
    );
  }

  return SOURCE_RUNTIME_PAGE_CAPABILITY[safePageKey];
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
 * 从 SourceManagerState 定位真实数据源记录。
 * 纯函数: 只读取 Manager 隔离投影，不修改记录、运行态或软隐藏集合。
 * 不复制保存态；state 本身已经是 Manager 返回的隔离投影。
 * 成功路径: 返回目标隔离 SourceRecord。
 * 失败路径: 未命中抛 notFound；可执行性由 Runtime 候选规则或 Host 门禁继续判断。
 *
 * @param {object} state 当前 SourceManagerState。
 * @param {string} sourceId 目标真实 sourceId。
 * @returns {object} 当前隔离 SourceRecord。
 * @throws {SourceRuntimeError} 记录不存在时抛 notFound。
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

  return record;
}

/**
 * 创建统一 SourceRuntime Bundle。
 * 副作用: 只组合调用方 Repository 与当前 Bundle 私有的 Manager、Host、Adapter 和 Promise 索引。
 * 公开边界: 返回冻结内容门面和完整设置管理门面，不泄漏任何基础设施引用。
 * 成功路径: 两个门面共享初始化 Promise、SourceManager、Host、Repository 和可信工厂注册表。
 * 失败路径: 构造依赖、种子、注册表或 Manager 非法时同步抛稳定 runtime 错误或底层领域错误。
 *
 * @param {object} options 组合输入，必须显式提供冻结 NetworkAdapter。
 * @returns {object} 只包含 sourceRuntime 和 sourceManagementRuntime 的冻结 Bundle。
 * @returns {object} return.sourceRuntime 全局/页面候选解析、活动源切换、内容、筛选、健康和 Host 生命周期十二方法门面。
 * @returns {object} return.sourceManagementRuntime 十八方法设置管理门面。
 */
export function createSourceRuntimeBundle(options = {}) {
  // 类型: object。
  // 作用: 保存字段完整的隔离构造选项，后续组合不再读取调用方 options。
  const normalizedOptions = normalizeRuntimeOptions(options);

  // 类型: object。
  // 作用: 保存调用方显式创建的三仓和 UnitOfWork；Bundle 不知道其 Memory 或 IndexedDB 实现类型。
  const repositories = normalizedOptions.repositories;

  // 类型: Readonly<object>。
  // 作用: 保存调用方已明确选择的唯一 NetworkAdapter；当前 Bundle 生命周期内不切换模式或建立回退。
  const networkAdapter = normalizedOptions.networkAdapter;

  // 类型: object。
  // 作用: 保存当前 runtime 独占可信工厂映射，不暴露给公开门面。
  const factoryRegistry = createProviderFactoryRegistry();

  // 循环作用: 按调用方冻结顺序注册全部静态受信任工厂；Registry 负责身份、ABI 和重复键失败关闭。
  normalizedOptions.trustedProviderFactories.forEach((providerFactory) => {
    factoryRegistry.register(providerFactory.providerKey, providerFactory);
  });

  // 类型: object。
  // 作用: 绑定当前 Bundle 唯一 NetworkAdapter，文件、远程和文本统一生成相同载荷。
  const sourcePackageInputReader = createSourcePackageInputReader({ networkAdapter });

  // 类型: object。
  // 作用: 创建无状态 Acorn 预检器，用户确认前只静态返回 manifest 和安全预览。
  const sourcePackageManifestParser = createSourcePackageManifestParser();

  // 类型: object。
  // 作用: 组合读取、预检和唯一执行策略三个窄端口，不取得注册表、Manager 或 Host。
  const sourcePackageLoader = createSourcePackageLoader({
    inputReader: sourcePackageInputReader,
    manifestParser: sourcePackageManifestParser,
    moduleExecutor: normalizedOptions.sourcePackageModuleExecutor
  });

  // 类型: Readonly<object>。
  // 作用: 向设置管理 Runtime 只暴露导入所需三方法；启动恢复专用 restore 不进入页面意图链。
  const sourceManagementPackageLoaderPort = Object.freeze({
    preview: sourcePackageLoader.preview,
    load: sourcePackageLoader.load,
    assertFactorySupports: sourcePackageLoader.assertFactorySupports
  });

  // 类型: object。
  // 作用: 只向管理协调层开放动态工厂注册与移除，不泄漏 get、listKeys 或私有 Map。
  const providerFactoryRegistrationPort = Object.freeze({
    register: factoryRegistry.register,
    remove: factoryRegistry.remove
  });

  // 类型: Readonly<object>。
  // 作用: 在 Manager 读取保存图前恢复授权有效动态工厂，并在整体启动失败时释放本轮注册。
  const sourcePackageRestoreCoordinator = createSourcePackageRestoreCoordinator({
    packageRepository: repositories.packageRepository,
    definitionRepository: repositories.definitionRepository,
    sourcePackageLoader,
    providerFactoryRegistrationPort
  });

  // 类型: object。
  // 作用: 保存当前 Bundle 唯一设置输入适配器，导入和更新命令使用同一严格转换边界。
  const sourceManagementInputAdapter = createSourceManagementInputAdapter();

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
      // 作用: 保存与 Host 同源同 signal 的挑战端口；只注入全局协调器请求能力。
      const challengePort = createSourceChallengePort({
        sourceId,
        signal,
        requestPort: normalizedOptions.challengeRequestPort
      });

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

  // 类型: number。
  // 初始值: 0，表示当前 Runtime 尚未创建切换请求。
  // 修改入口: switchActiveSource 每次在发布 begin 前严格递增一次。
  // 作用: 与固定前缀组合成当前 Runtime 生命周期内唯一、单调且可测试的 requestId。
  let sourceSwitchRequestSequence = 0;

  // 类型: object。
  // 作用: 从唯一完整更新端口裁剪只含 check 的能力视图，满足 SourceManager 最小端口边界。
  const sourceUpdateCheckPort = createSourceUpdateCheckPortView(
    normalizedOptions.sourceUpdatePort
  );

  // 类型: object。
  // 作用: 把当前 Bundle 私有注册表裁剪为只返回严格普通结果的 SourceManager 端口，不泄漏工厂门面。
  const providerReadinessPort = Object.freeze({
    /**
     * 评估 SourceDefinition 在当前 Bundle 中是否具备受审 Provider。
     * 副作用: 调用匹配工厂的纯 supports(definition)；不创建 Provider、不启动 Host、不写 Repository。
     * 成功路径: 工厂存在且明确支持时返回 ready；未注册或不支持时返回带稳定原因的 unavailable。
     * 失败路径: 注册表校验或工厂 supports 异常原样抛出，由 SourceManager 端口门面包装并保留 cause。
     *
     * @param {object} sourceDefinition Repository 载入的隔离 SourceDefinition。
     * @returns {object} Provider 就绪标准结果。
     * @returns {string} return.status ready 或 unavailable。
     * @returns {string} return.reasonCode 稳定原因码，ready 时为空字符串。
     * @returns {string} return.reason 用户说明，ready 时为空字符串。
     */
    evaluate(sourceDefinition) {
      // 类型: object|null。
      // 作用: 只按 Definition.providerKey 查询受审注册表；导入脚本文本不能自行注册执行入口。
      const providerFactory = factoryRegistry.get(sourceDefinition.providerKey);

      // 条件分支: providerKey 没有命中当前 Bundle 受审工厂时进入。
      // 执行内容: 返回可管理但不可执行状态，不读取或执行 SourcePackage.scriptContent。
      if (!providerFactory) {
        return {
          status: PROVIDER_READINESS_STATUS.unavailable,
          reasonCode: PROVIDER_READINESS_REASON_CODE.providerNotRegistered,
          reason: SOURCE_PROVIDER_READINESS_REASON_MESSAGE[
            PROVIDER_READINESS_REASON_CODE.providerNotRegistered
          ]
        };
      }

      // 类型: boolean。
      // 作用: 使用隔离 Definition 调用受审工厂支持门禁，防止工厂修改 Repository 读取对象。
      const isSupported = providerFactory.supports(cloneSerializableValue(
        sourceDefinition,
        'sourceRuntime.providerReadiness.definition'
      )) === true;

      // 条件分支: 工厂没有明确支持当前 Definition 时进入。
      // 执行内容: 返回不可执行原因，不能因为 providerKey 注册成功就猜测存在对应数据集。
      if (!isSupported) {
        return {
          status: PROVIDER_READINESS_STATUS.unavailable,
          reasonCode: PROVIDER_READINESS_REASON_CODE.definitionNotSupported,
          reason: SOURCE_PROVIDER_READINESS_REASON_MESSAGE[
            PROVIDER_READINESS_REASON_CODE.definitionNotSupported
          ]
        };
      }

      // 返回值类型: object。
      // 作用: ready 结果不携带陈旧失败原因，SourceManager 端口门面会再次验证组合。
      return {
        status: PROVIDER_READINESS_STATUS.ready,
        reasonCode: PROVIDER_READINESS_REASON_CODE.none,
        reason: ''
      };
    }
  });

  // 类型: SourceManager。
  // 作用: 保存当前 runtime 唯一数据源事务权威和轻量投影来源。
  const sourceManager = new SourceManager({
    ...repositories,
    providerReadinessPort,
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
    updateCheckPort: sourceUpdateCheckPort
  }, {
    initialRuntimeStates: normalizedOptions.initialRuntimeStates,
    activeSourceId: normalizedOptions.activeSourceId
  });

  /**
   * 初始化当前 runtime 的 SourceManagerState。
   * 副作用: 首次调用依次初始化基础设施、恢复动态工厂和初始化 Manager；成功设置 initialized，失败释放本轮注册并清空 Promise。
   * 成功路径: 每个调用方获得独立 Manager 投影副本。
   * 失败路径: 数据库、恢复、Repository 或 Manager 失败转换为 initialization 并保留 cause。
   *
   * @returns {Promise<object>} 隔离 SourceManagerState。
   */
  function initialize() {
    // 条件分支: 当前尚无初始化 Promise 时进入。
    // 执行内容: 创建唯一基础设施初始化、动态恢复和 Manager.initialize 调用链。
    if (!initializationPromise) {
      initializationPromise = Promise.resolve()
        // 异步顺序: 数据库或测试基础设施必须先完成，Repository 读取不能抢跑。
        .then(() => normalizedOptions.initializeInfrastructure())
        // 异步顺序: 当前授权有效自定义工厂必须先注册，Manager 才能派生真实 readiness。
        .then(() => sourcePackageRestoreCoordinator.restore())
        .then(() => sourceManager.initialize())
        .then(
        (state) => {
          initialized = true;
          return state;
        },
        async (error) => {
          initializationPromise = null;
          // 失败补偿: 撤销本轮恢复成功的全部动态注册，重试不能命中旧闭包。
          try {
            await sourcePackageRestoreCoordinator.releaseAll();
          } catch (releaseError) {
            throw createSourceRuntimeError(
              SOURCE_RUNTIME_ERROR_CODE.initialization,
              'SourceRuntime 初始化失败且动态工厂释放失败',
              new AggregateError([error, releaseError])
            );
          }
          throw createSourceRuntimeError(
            SOURCE_RUNTIME_ERROR_CODE.initialization,
            'SourceRuntime 初始化失败',
            error
          );
        });
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
   * 判断 SourceRecord 是否具备全局执行资格。
   * 纯函数: 只读取 Manager 已组装的启用、授权、软隐藏和 Provider 就绪投影。
   * 成功路径: 可见、有效启用、当前授权有效且 Provider 就绪时返回 true。
   * 失败路径: 任一普通门禁不满足返回 false，不创建 Provider 或修改 Manager 投影。
   *
   * @param {object} state 当前隔离 SourceManagerState。
   * @param {object} sourceRecord 当前隔离 SourceRecord。
   * @returns {boolean} 当前记录是否可以作为活动源并由 Host 执行。
   */
  function isRuntimeSourceExecutable(state, sourceRecord) {
    // 类型: string。
    // 作用: 从 Definition 唯一身份字段读取候选源，关联软隐藏集合、授权和后续 Host 生命周期。
    const sourceId = sourceRecord.definition.id;

    // 条件分支: 用户未有效启用记录或系统源被软隐藏时进入。
    // 执行内容: 直接排除执行候选，不把健康状态或页面 store 当成额外门禁。
    if (sourceRecord.runtime.enabled !== true
      || state.removedSystemSourceIds.includes(sourceId)) {
      return false;
    }

    // 类型: object。
    // 作用: 使用 Manager 已验证脚本指纹复查系统/自定义源授权，和 Host 启动门禁保持同一规则。
    const authorizationState = evaluateSourceAuthorizationFingerprint({
      sourceKind: sourceRecord.definition.sourceKind,
      version: sourceRecord.definition.version,
      currentScriptHash: sourceRecord.runtime.currentScriptHash,
      authorization: sourceRecord.authorization
    });

    // 条件分支: 当前版本或脚本指纹没有有效用户授权时进入。
    // 执行内容: 失败关闭，不允许页面先选择再等待 Host 拒绝。
    if (!authorizationState.isAuthorized) {
      return false;
    }

    // 返回值类型: boolean。
    // 作用: Manager 投影已经通过唯一就绪端口确认工厂注册和 supports，不在候选入口重复查询注册表。
    return sourceRecord.runtime.providerReadiness.status === PROVIDER_READINESS_STATUS.ready;
  }

  /**
   * 判断 SourceRecord 是否属于指定页面的可执行候选。
   * 副作用: 复用唯一基础执行门禁，并读取 Definition 当前页面能力；不创建 Provider 或修改状态。
   * 成功路径: 基础执行门禁和当前 capability 均通过时返回 true。
   * 失败路径: 普通门禁不满足返回 false；工厂 supports 异常保留 Runtime operation。
   *
   * @param {object} state 当前隔离 SourceManagerState。
   * @param {object} sourceRecord 当前隔离 SourceRecord。
   * @param {string} capabilityKey 当前页面对应的 Definition capability 键。
   * @returns {boolean} 当前记录是否可以被指定页面选择并执行。
   */
  function isRuntimeSourceAvailable(state, sourceRecord, capabilityKey) {
    // 条件分支: 当前页面能力没有明确声明 true 时进入。
    // 执行内容: 页面候选失败关闭，不改变该源对其他页面或全局切换的执行资格。
    if (sourceRecord.definition.capabilities[capabilityKey] !== true) {
      return false;
    }

    // 返回值类型: boolean。
    // 作用: 页面能力通过后复用唯一授权、可见性和工厂 supports 门禁。
    return isRuntimeSourceExecutable(state, sourceRecord);
  }

  /**
   * 列出指定页面可以选择和执行的数据源记录。
   * 副作用: 未初始化时复用唯一初始化 Promise；只调用可信工厂 supports，不启动 Provider 或修改活动源。
   * 成功路径: 返回按 SourceManagerState.records 顺序排列的隔离 SourceRecord 数组。
   * 失败路径: 页面键非法抛 validation；初始化或工厂门禁失败保留稳定 runtime 错误。
   *
   * @param {*} pageKey 内容页面键候选。
   * @returns {Promise<Array<object>>} 当前页面可执行 SourceRecord 隔离数组；无候选时为空数组。
   */
  async function listAvailableSources(pageKey) {
    // 类型: string。
    // 作用: 把页面键转换为唯一 capability 键，后续不复制 player/play 特例。
    const capabilityKey = normalizeRuntimePageKey(pageKey, 'listAvailableSources.pageKey');

    // 类型: object。
    // 作用: 保存 Manager 最新隔离投影，候选不使用初始化时旧快照或页面缓存。
    const state = await getSourceManagerState();

    // 类型: Array<object>。
    // 作用: 按唯一候选规则筛选 Manager 记录，不创建第二份保存态或候选索引。
    const availableSources = state.records.filter(
      sourceRecord => isRuntimeSourceAvailable(state, sourceRecord, capabilityKey)
    );

    // 返回值类型: Array<object>。
    // 作用: 再次隔离公开投影，调用方修改候选字段不能影响本次 Manager 投影内其他运行判断。
    return cloneSerializableValue(availableSources, 'sourceRuntime.availableSources');
  }

  /**
   * 列出当前全局可以成为活动源的数据源记录。
   * 副作用: 未初始化时复用唯一初始化 Promise；只调用可信工厂 supports，不启动 Provider 或修改活动源。
   * 成功路径: 复用全局可见、有效启用、有效授权和 Provider 就绪唯一门禁，按 Manager 记录顺序返回隔离数组。
   * 失败路径: 初始化或工厂 supports 失败时保留稳定 Runtime 错误，不回退页面 capability 或设置页记录筛选。
   *
   * @returns {Promise<Array<object>>} 当前可以提交 switchActiveSource 的隔离 SourceRecord 数组。
   */
  async function listSwitchableSources() {
    // 类型: object。
    // 作用: 读取 Manager 最新隔离投影，导航候选不使用初始化快照、页面 capability 或设置页局部状态。
    const state = await getSourceManagerState();

    // 类型: Array<object>。
    // 作用: 复用 switchActiveSource 相同全局执行门禁，保证导航列表和真实切换资格一致。
    const switchableSources = state.records.filter(
      sourceRecord => isRuntimeSourceExecutable(state, sourceRecord)
    );

    // 返回值类型: Array<object>。
    // 作用: 隔离公开候选，导航层修改字段不能污染 Manager 投影或后续切换判断。
    return cloneSerializableValue(switchableSources, 'sourceRuntime.switchableSources');
  }

  /**
   * 解析并校验一次页面请求应使用的数据源身份。
   * 副作用: 未初始化时复用唯一初始化 Promise；不启动 Provider、不写 store、不切换 activeSourceId。
   * 选择顺序: 显式 sourceId 优先；省略时采用 Manager activeSourceId；仅活动源为空时采用 defaultSourceId。
   * 成功路径: 返回经过当前页面统一候选门禁的真实 sourceId。
   * 失败路径: 身份或页面键非法抛 validation，记录不存在抛 notFound，候选门禁未通过抛 unavailable。
   *
   * @param {*} sourceId 可省略的显式数据源身份候选。
   * @param {*} pageKey 当前内容页面键候选。
   * @returns {Promise<string>} 已通过当前页面候选门禁的真实 sourceId。
   * @throws {SourceRuntimeError} 请求无法解析为当前页面可执行数据源时抛稳定错误。
   */
  async function resolveSourceId(sourceId, pageKey) {
    // 类型: string。
    // 作用: 保存显式身份；空字符串表示调用方要求 Runtime 从活动源语义解析。
    const explicitSourceId = normalizeRuntimeOptionalSourceId(
      sourceId,
      'resolveSourceId.sourceId'
    );

    // 类型: string。
    // 作用: 保存页面对应能力键，播放页统一解析为 Definition.play。
    const capabilityKey = normalizeRuntimePageKey(pageKey, 'resolveSourceId.pageKey');

    // 类型: object。
    // 作用: 读取唯一 Manager 最新隔离投影，身份语义不依赖内容或筛选 store 的上次成功响应。
    const state = await getSourceManagerState();

    // 类型: string。
    // 作用: 显式身份优先；没有显式身份时仅在 activeSourceId 为空后采用 defaultSourceId。
    const resolvedSourceId = explicitSourceId
      || state.activeSourceId
      || state.defaultSourceId
      || '';

    // 条件分支: 显式、活动和默认身份都为空时进入。
    // 执行内容: 返回可识别不可用错误，不构造匿名 Provider 请求。
    if (!resolvedSourceId) {
      throw createSourceRuntimeError(
        SOURCE_RUNTIME_ERROR_CODE.unavailable,
        '当前没有可用于页面请求的数据源'
      );
    }

    // 类型: object。
    // 作用: 定位最终身份对应的记录；显式或活动源无效时不静默回退默认源。
    const sourceRecord = findRuntimeSourceRecord(state, resolvedSourceId);

    // 条件分支: 最终记录没有通过当前页面统一候选门禁时进入。
    // 执行内容: 失败关闭并保留原身份，禁止 service 自行寻找其他源掩盖配置问题。
    if (!isRuntimeSourceAvailable(state, sourceRecord, capabilityKey)) {
      throw createSourceRuntimeError(
        SOURCE_RUNTIME_ERROR_CODE.unavailable,
        `数据源不支持当前页面请求: ${resolvedSourceId}`
      );
    }

    return resolvedSourceId;
  }

  /**
   * 清理一次失败或过期切换新建的目标 Provider 生命周期。
   * 副作用: 仅当本请求原先没有 running entry，且目标既非当前活动源也非更新请求 pending 目标时委托 Host dispose。
   * 成功路径: 无需清理时幂等结束；需要清理时释放目标 Context、Provider 和日志引用。
   * 失败路径: Host 状态读取或释放失败时转换为 Runtime operation 并保留 cause。
   *
   * @param {string} sourceId 当前切换目标真实身份。
   * @param {boolean} ownsPreparedLifecycle true 表示本请求准备前没有可复用 running entry；false 禁止释放既有生命周期。
   * @param {object} state Manager 对本请求 complete/fail 后返回的最新隔离状态。
   * @returns {Promise<void>} 清理完成或无需清理后结束。
   */
  async function disposePreparedSwitchTarget(sourceId, ownsPreparedLifecycle, state) {
    // 条件分支: 目标在本请求前已经 running，或现在已成为活动源时进入。
    // 执行内容: 保留可复用 Provider，切回原源不创建和销毁第二份生命周期。
    if (!ownsPreparedLifecycle || state.activeSourceId === sourceId) {
      return;
    }

    // 条件分支: 更新切换请求仍在等待同一目标时进入。
    // 执行内容: 把已准备生命周期留给最新请求，旧请求不能抢先释放共享目标。
    if (state.switchState.status === SOURCE_SWITCH_STATUS.switching
      && state.switchState.pendingSourceId === sourceId) {
      return;
    }

    try {
      // 类型: object|null。
      // 作用: 只在 Host 仍持有目标 entry 时执行释放，缺失 entry 按幂等完成处理。
      const runtimeState = await sourceExecutionHost.getRuntimeState(sourceId);

      // 条件分支: 失败或过期目标仍有 Host entry 时进入。
      // 执行内容: 完整停止并释放本请求新建的生命周期，不修改 Repository 或其他 sourceId。
      if (runtimeState) {
        await sourceExecutionHost.dispose(sourceId);
      }
    } catch (error) {
      throw createSourceRuntimeError(
        SOURCE_RUNTIME_ERROR_CODE.operation,
        `切换目标生命周期清理失败: ${sourceId}`,
        error
      );
    }
  }

  /**
   * 原子切换当前内容活动源。
   * 副作用: 生成当前 Runtime 唯一 requestId，发布 Manager switching，按统一门禁准备 Provider，并提交最新 success/failed。
   * 成功路径: 只有仍为最新的请求一次采用 activeSourceId；过期请求只返回更新状态并清理自身多余生命周期。
   * 失败路径: 当前请求发布用户可读 failed、保持原活动源；过期失败不覆盖更新请求，也不向调用方抛旧错误。
   *
   * @param {*} sourceId 目标活动源身份候选。
   * @returns {Promise<object>} 当前最新隔离 SourceManagerState。
   * @throws {SourceRuntimeError} 当前最新切换准备或生命周期清理失败时抛稳定 Runtime 错误。
   */
  async function switchActiveSource(sourceId) {
    // 类型: string。
    // 作用: 在创建请求身份和发布状态前统一拒绝空白、危险或非字符串 sourceId。
    const safeSourceId = normalizeRuntimeSourceId(sourceId, 'switchActiveSource.sourceId');

    // 副作用范围: 只递增当前 Runtime 私有序号；不同 Bundle 不共享计数或全局状态。
    sourceSwitchRequestSequence += 1;

    // 类型: string。
    // 作用: 固定前缀与单调序号组成当前 Runtime 生命周期内唯一 requestId，不依赖时钟或随机数。
    const requestId = `${SOURCE_RUNTIME_SWITCH_REQUEST_PREFIX}${sourceSwitchRequestSequence}`;

    // 类型: boolean。
    // 初始值: false，表示尚未确认本请求是否会创建新 Provider 生命周期。
    // 作用: 只有从非 running 状态开始准备的目标才允许在失败或过期后由本请求清理。
    let ownsPreparedLifecycle = false;

    // 类型: boolean。
    // 初始值: false，表示 Manager 尚未发布本次 switching。
    // 作用: 只有真实开始的事务才允许在 catch 中发布 failed；输入和未命中错误直接返回调用方。
    let switchStarted = false;

    try {
      // 类型: object。
      // 作用: 在发布 switching 前用 Manager 最新投影定位目标，未知记录返回 Runtime notFound。
      const currentState = await getSourceManagerState();

      // 类型: object。
      // 作用: 在发布切换状态前定位目标，稳定区分 unknown sourceId，并提供全局执行资格预检输入。
      const currentSourceRecord = findRuntimeSourceRecord(currentState, safeSourceId);

      // 条件分支: 目标未通过可见、启用、授权和 Provider 就绪的统一全局门禁时进入。
      // 执行内容: 在 Manager begin 前返回 unavailable，不发布无法执行的 switching/failed 过渡状态。
      if (!isRuntimeSourceExecutable(currentState, currentSourceRecord)) {
        throw createSourceRuntimeError(
          SOURCE_RUNTIME_ERROR_CODE.unavailable,
          `数据源不具备活动源执行能力: ${safeSourceId}`
        );
      }

      // 类型: object。
      // 作用: Manager FIFO 再次验证目标全局可运行资格，并返回已采用当前 requestId 的完整 switching 投影。
      const switchingState = await sourceManager.beginSourceSwitch({
        sourceId: safeSourceId,
        requestId
      });
      switchStarted = true;

      // 类型: object。
      // 作用: 从 begin 返回的同一最新投影重新定位目标，后续执行门禁不使用发布前旧快照。
      const sourceRecord = findRuntimeSourceRecord(switchingState, safeSourceId);

      // 条件分支: 目标在预检与 Manager begin 之间失去全局执行资格时进入。
      // 执行内容: 让已发布事务进入统一 failed 路径；Host 后续仍保留最终注册表和工厂门禁。
      if (!isRuntimeSourceExecutable(switchingState, sourceRecord)) {
        throw createSourceRuntimeError(
          SOURCE_RUNTIME_ERROR_CODE.unavailable,
          `数据源不具备活动源执行能力: ${safeSourceId}`
        );
      }

      // 类型: object|null。
      // 作用: 记录准备前目标是否已有可复用 running entry，决定失败或过期后的清理所有权。
      const runtimeStateBeforePrepare = await sourceExecutionHost.getRuntimeState(safeSourceId);
      ownsPreparedLifecycle = runtimeStateBeforePrepare?.phase !== SOURCE_EXECUTION_HOST_PHASE.running;

      // 异步调用: 使用现有同源 Promise 去重和 Host 生命周期门禁准备目标 Provider。
      await ensureSourceRunning(safeSourceId);

      // 异步调用: 目标 Provider 启动只证明生命周期就绪；采用活动源前必须执行其标准健康检测。
      // 类型: object；作用: 保存检测完成后的 Manager 投影，只有 normal 才允许继续提交切换。
      const healthState = await sourceManager.checkSource(safeSourceId);
      // 类型: object|null；作用: 从同一次检测结果定位目标运行态，不使用切换前旧快照。
      const checkedRecord = findRuntimeSourceRecord(healthState, safeSourceId);
      // 条件分支: Provider 标准检测没有收敛为 normal 时进入；执行内容: 保持原活动源并进入统一切换失败补偿。
      if (checkedRecord?.runtime?.healthStatus !== HEALTH_STATUS.normal) {
        throw createSourceRuntimeError(
          SOURCE_RUNTIME_ERROR_CODE.unavailable,
          `数据源健康检测未通过: ${safeSourceId}`
        );
      }

      // 类型: object。
      // 作用: Manager 只在 requestId 仍为最新时一次采用 activeSourceId；否则返回更新请求状态。
      const completedState = await sourceManager.completeSourceSwitch({
        sourceId: safeSourceId,
        requestId
      });

      // 类型: boolean。
      // 作用: 精确判断 success 是否由当前请求提交，同目标更新请求也不能被旧调用误认为自身成功。
      const adoptedByCurrentRequest = completedState.switchState.status === SOURCE_SWITCH_STATUS.success
        && completedState.switchState.requestId === requestId;

      // 条件分支: 当前请求已过期且准备了更新请求不需要的目标生命周期时进入。
      // 执行内容: 按最新活动/pending 状态决定是否释放，不修改 Manager 或其他 Provider。
      if (!adoptedByCurrentRequest) {
        await disposePreparedSwitchTarget(safeSourceId, ownsPreparedLifecycle, completedState);
      }

      return completedState;
    } catch (error) {
      // 类型: SourceRuntimeError。
      // 作用: 保留已有 Runtime 分类；Manager 或 Host 未分类失败统一收敛为 operation 并保留 cause。
      const runtimeError = error instanceof SourceRuntimeError
        ? error
        : createSourceRuntimeError(
          SOURCE_RUNTIME_ERROR_CODE.operation,
          `活动源切换失败: ${safeSourceId}`,
          error
        );

      // 条件分支: Manager 尚未成功发布本次 switching 时进入。
      // 执行内容: 直接返回稳定 Runtime 错误，不能让不存在的事务覆盖上一份 switchState。
      if (!switchStarted) {
        throw runtimeError;
      }

      // 类型: object。
      // 作用: 仅匹配当前 requestId 时发布 failed；更晚请求存在时返回其最新状态且不覆盖。
      const failedState = await sourceManager.failSourceSwitch({
        sourceId: safeSourceId,
        requestId,
        errorMessage: resolveSourceSwitchErrorMessage(runtimeError)
      });

      // 异步调用: 清理本请求新建且不再被活动源或更新 pending 使用的失败目标生命周期。
      await disposePreparedSwitchTarget(safeSourceId, ownsPreparedLifecycle, failedState);

      // 类型: boolean。
      // 作用: 只有当前请求真实采用 failed 时向当前调用方抛错；过期错误不能制造错误提示竞态。
      const failedByCurrentRequest = failedState.switchState.status === SOURCE_SWITCH_STATUS.failed
        && failedState.switchState.requestId === requestId;

      // 条件分支: 当前失败已经被更新请求取代时进入。
      // 执行内容: 返回最新 Manager 状态，让调用方只观察最新用户意图，不传播旧错误。
      if (!failedByCurrentRequest) {
        return failedState;
      }

      throw runtimeError;
    }
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
  // 作用: 只汇总契约十二方法，作为最终冻结内容门面候选。
  const sourceRuntime = {
    initialize,
    getSourceManagerState,
    listSwitchableSources,
    listAvailableSources,
    resolveSourceId,
    switchActiveSource,
    ensureSourceRunning,
    fetchData,
    fetchFilterMeta,
    checkHealth,
    stopSource,
    disposeSource
  };

  // 条件分支: 公开键数量、顺序或名称与冻结契约不一致时进入。
  // 执行内容: 在返回门面前阻止基础设施字段或遗漏方法泄漏。
  if (Object.keys(sourceRuntime).length !== SOURCE_RUNTIME_PUBLIC_METHODS.length
    || Object.keys(sourceRuntime).some(
      (methodName, index) => methodName !== SOURCE_RUNTIME_PUBLIC_METHODS[index]
    )) {
    throw createSourceRuntimeError(
      SOURCE_RUNTIME_ERROR_CODE.initialization,
      'SourceRuntime 公开方法顺序与冻结契约不一致'
    );
  }

  /**
   * 订阅当前 Bundle 唯一 SourceManager 的完整隔离投影。
   * 副作用: 向 SourceManager 注册同步 listener；已有投影时由 Manager 立即发送当前副本。
   * 成功路径: 返回只移除本次订阅记录的幂等取消函数。
   * 失败路径: listener 非函数时由 SourceManager 同步抛出稳定校验错误。
   *
   * @param {Function} listener SourceManagerState 同步监听器。
   * @returns {Function} 幂等取消订阅函数。
   */
  function subscribe(listener) {
    // 返回值类型: Function。
    // 作用: 原样转发唯一 Manager 的取消句柄，不创建第二个事件源、轮询或投影缓存。
    return sourceManager.subscribe(listener);
  }

  // 类型: object。
  // 作用: 创建完整设置管理门面，与内容门面共享 Manager、Host、单文件加载器、注册端口和更新端口。
  const sourceManagementRuntime = createSourceManagementRuntime({
    initialize,
    getSourceManagerState,
    subscribe,
    sourceManager,
    sourceExecutionHost,
    sourceManagementInputAdapter,
    sourcePackageLoader: sourceManagementPackageLoaderPort,
    providerFactoryRegistrationPort,
    sourceUpdatePort: normalizedOptions.sourceUpdatePort,
    ensureSourceRunning
  });

  // 条件分支: 设置管理门面公开键数量、顺序或名称与冻结契约不一致时进入。
  // 执行内容: 阻止遗漏管理方法或暴露 Manager、Host、Repository、端口和 FIFO。
  if (Object.keys(sourceManagementRuntime).length !== SOURCE_MANAGEMENT_RUNTIME_PUBLIC_METHODS.length
    || Object.keys(sourceManagementRuntime).some(
      (methodName, index) => methodName !== SOURCE_MANAGEMENT_RUNTIME_PUBLIC_METHODS[index]
    )) {
    throw createSourceRuntimeError(
      SOURCE_RUNTIME_ERROR_CODE.initialization,
      'SourceManagementRuntime 公开方法顺序与冻结契约不一致'
    );
  }

  // 类型: object。
  // 作用: 把两个冻结门面装入唯一公开 Bundle；门面闭包共享同一基础设施图。
  const runtimeBundle = {
    sourceRuntime: Object.freeze(sourceRuntime),
    sourceManagementRuntime: Object.freeze(sourceManagementRuntime)
  };

  // 条件分支: Bundle 公开字段数量、顺序或名称与冻结契约不一致时进入。
  // 执行内容: 阻止组合层向调用方泄漏内部依赖或产生第三个门面。
  if (Object.keys(runtimeBundle).length !== SOURCE_RUNTIME_BUNDLE_PUBLIC_FIELDS.length
    || Object.keys(runtimeBundle).some(
      (fieldName, index) => fieldName !== SOURCE_RUNTIME_BUNDLE_PUBLIC_FIELDS[index]
    )) {
    throw createSourceRuntimeError(
      SOURCE_RUNTIME_ERROR_CODE.initialization,
      'SourceRuntimeBundle 公开字段顺序与冻结契约不一致'
    );
  }

  // 返回值类型: object。
  // 作用: 返回冻结 Bundle，调用方不能替换两个门面；内部基础设施始终只存在一份。
  return Object.freeze(runtimeBundle);
}

/**
 * 创建兼容的内容 SourceRuntime 门面。
 * 副作用: 创建一份完整 Runtime Bundle，但只把其中内容门面返回给既有独立测试和调用方。
 * 成功路径: 返回与统一 Bundle 相同的冻结十二方法内容门面。
 * 失败路径: Bundle 构造失败时原样抛出稳定 runtime 或底层领域错误。
 * 维护边界: 应用共享实例必须直接创建一次 Bundle；不得分别调用本函数创建内容和设置 Runtime。
 *
 * @param {object} options 可选组合输入。
 * @returns {object} 冻结 SourceRuntime 内容门面。
 */
export function createSourceRuntime(options = {}) {
  // 返回值类型: object。
  // 作用: 保留既有工厂签名，并确保实际组合逻辑只维护在 createSourceRuntimeBundle 中。
  return createSourceRuntimeBundle(options).sourceRuntime;
}
