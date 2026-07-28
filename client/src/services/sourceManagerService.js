/*
  sourceManagerService.js 模块说明

  - 文件职责:
      定义 SourceManager 领域服务入口，组合三个 Repository、Unit of Work、检测端口和轻量状态组装能力。
      统一协调初始化、操作 FIFO、状态观察、活动源切换、检测、偏好事务、导入、更新、混合删除和最小导出。
      不实现 Shell、Host、任意脚本执行或页面 store 接管，Provider 准备由 Runtime 协调。

  - 导入库及文件汇总(9 条，内置 0 条，第三方 0 条，自定义 9 条):
      HEALTH_STATUS、IMPORT_METHOD、SOURCE_KIND、SOURCE_SWITCH_STATUS: 自定义配置，提供检测、在线来源、系统源和切换状态枚举。
      SOURCE_STORAGE_PARTITION、cloneSerializableValue: 自定义 Repository 工具，提供缓存分区名和严格隔离复制。
      assertPlainObject、assertSafeRecordKey: 自定义校验，约束依赖容器和活动源 id。
      SourceRepositoryTransactionError: 自定义 Repository 错误，识别已经回滚的事务失败。
      SOURCE_MANAGER_ERROR_CODE、SourceManagerError、SourceManagerInitializationError、SourceManagerInvariantError、SourceManagerOperationError、SourceManagerValidationError: 自定义领域错误。
      createSourceProviderReadinessPort、createSourceHealthCheckPort、createSourceUpdateCheckPort: 自定义端口工厂，冻结并校验就绪与检测实现。
      createIdleSourceSwitchState、normalizeInitialSourceRuntimeStates: 自定义状态能力，建立唯一切换初态并规范化构造会话输入。
      normalizeSourceSwitchFailure、normalizeSourceSwitchRequest: 自定义命令校验，约束切换请求身份和用户错误。
      SourceManager 事务辅助集合: 自定义服务，提供命令、门禁、授权、交接、运行态和 Repository 投影加载。

  - 模块级常量:
      SOURCE_MANAGER_OPTION_FIELDS: Array<string>，构造选项允许字段集合。
      SOURCE_UPDATE_STABLE_DEFINITION_FIELDS: Array<string>，更新必须保持不变的 Definition 身份字段。
      SOURCE_HEALTH_CHECK_FAILURE_REASON_BY_CODE: object，健康端口领域错误码到用户可读原因的映射。
      DEFAULT_SOURCE_HEALTH_CHECK_FAILURE_REASON: string，未知健康失败的用户可读兜底原因。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertRepositoryMethod: Function，构造依赖方法校验。
      normalizeSourceManagerOptions: Function，构造会话选项精确字段和活动源校验。
      resolveSourceHealthCheckFailureReason: Function，把内部健康错误转换为页面可展示原因。

  - 模块级类:
      SourceManager: 数据源领域事务、检测顺序和轻量投影唯一权威。

  - 对外导出:
      SourceManager: Class，初始化、读取、检测和 4C 基础领域事务服务。
*/

import {
  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 健康状态枚举。
  // 文件作用: 检测过程使用 checking，成功或失败收敛为 normal/unavailable。
  HEALTH_STATUS,

  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 数据源导入方式枚举。
  // 文件作用: 在线更新检查只允许作用于 remote 数据源。
  IMPORT_METHOD,

  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: 恢复事务只允许处理系统源。
  SOURCE_KIND,

  // 导入来源: ../config/source-manager.config.js。
  // 导入内容: SOURCE_SWITCH_STATUS 活动源切换状态枚举。
  // 文件作用: Manager 使用 switching、success 和 failed 组装唯一切换状态机。
  SOURCE_SWITCH_STATUS
} from '../config/source-manager.config.js';

import {
  // 导入来源: ../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: SOURCE_STORAGE_PARTITION 私有空间五分区枚举。
  // 文件作用: 临时缓存事务精确清理 cache 和 diagnostics，不使用魔法字符串。
  SOURCE_STORAGE_PARTITION,

  // 导入来源: ../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
  // 文件作用: 命令候选、Preferences、过渡投影和状态输出不保留调用方引用。
  cloneSerializableValue
} from '../repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 严格普通对象校验函数。
  // 文件作用: 构造函数只接受普通 dependencies 和 options 容器。
  assertPlainObject,

  // 导入来源: ../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertSafeRecordKey 动态记录键校验函数。
  // 文件作用: 非空 activeSourceId 拒绝空白和原型敏感危险名称。
  assertSafeRecordKey
} from '../repositories/source/sourceRepositoryValidators.js';

// 导入来源: ../repositories/source/sourceRepositoryErrors.js。
// 导入内容: SourceRepositoryTransactionError 已回滚事务错误。
// 文件作用: SourceManager 区分领域拒绝与基础设施失败，并保留或解包真实 cause。
import { SourceRepositoryTransactionError } from '../repositories/source/sourceRepositoryErrors.js';

import {
  // 导入来源: ./source-manager/sourceManagerErrors.js。
  // 导入内容: SOURCE_MANAGER_ERROR_CODE 稳定领域错误码枚举。
  // 文件作用: 健康端口失败按稳定错误码映射用户可读原因，不把程序错误码写入页面字段。
  SOURCE_MANAGER_ERROR_CODE,

  // 导入来源: ./source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerError 领域错误基类。
  // 文件作用: 事务错误解包时识别 validation、notFound、invariant、initialization 和 operation 子类。
  SourceManagerError,

  // 导入来源: ./source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerInitializationError 初始化领域错误。
  // 文件作用: 包装 Repository 初始载入失败和未初始化读取。
  SourceManagerInitializationError,

  // 导入来源: ./source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerInvariantError 领域不变量错误。
  // 文件作用: 表达更新检查来源不支持和恢复目标类型错误。
  SourceManagerInvariantError,

  // 导入来源: ./source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerOperationError 领域操作错误。
  // 文件作用: 包装事务基础设施、检测刷新和未知操作失败并保留 cause。
  SourceManagerOperationError,

  // 导入来源: ./source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerValidationError 构造输入校验错误。
  // 文件作用: 统一表达依赖方法、选项字段和活动源 id 不符合契约。
  SourceManagerValidationError
} from './source-manager/sourceManagerErrors.js';

import {
  // 导入来源: ./source-manager/sourceManagerPorts.js。
  // 导入内容: createSourceProviderReadinessPort Provider 就绪端口门面工厂。
  // 文件作用: 每次 Repository 投影组装都从当前 Bundle 取得严格就绪结果。
  createSourceProviderReadinessPort,

  // 导入来源: ./source-manager/sourceManagerPorts.js。
  // 导入内容: createSourceHealthCheckPort 健康端口门面工厂。
  // 文件作用: 校验注入端口和健康结果，并包装实现失败。
  createSourceHealthCheckPort,

  // 导入来源: ./source-manager/sourceManagerPorts.js。
  // 导入内容: createSourceUpdateCheckPort 更新端口门面工厂。
  // 文件作用: 校验注入端口和在线更新结果，并包装实现失败。
  createSourceUpdateCheckPort
} from './source-manager/sourceManagerPorts.js';

// 导入来源: ./source-manager/sourceManagerState.js。
import {
  // 导入来源: ./source-manager/sourceManagerState.js。
  // 导入内容: createIdleSourceSwitchState 空闲切换状态工厂。
  // 文件作用: 构造器建立当前 Manager 唯一切换状态，不从页面或 Repository 恢复影子状态。
  createIdleSourceSwitchState,

  // 导入来源: ./source-manager/sourceManagerState.js。
  // 导入内容: normalizeInitialSourceRuntimeStates 初始运行态规范化函数。
  // 文件作用: 隔离并限制调用方可注入的健康和更新会话字段。
  normalizeInitialSourceRuntimeStates
} from './source-manager/sourceManagerState.js';

import {
  // 导入来源: ./source-manager/sourceManagerCommands.js。
  // 导入内容: normalizeSourceSwitchFailure 切换失败命令规范化函数。
  // 文件作用: 失败发布只接受匹配请求身份和用户可读错误。
  normalizeSourceSwitchFailure,

  // 导入来源: ./source-manager/sourceManagerCommands.js。
  // 导入内容: normalizeSourceSwitchRequest 切换请求命令规范化函数。
  // 文件作用: 开始和完成入口共享严格 sourceId/requestId 契约。
  normalizeSourceSwitchRequest
} from './source-manager/sourceManagerCommands.js';

import {
  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: assertCustomSourceRecord 自定义源门禁函数。
  // 文件作用: 撤销授权和授权事务拒绝系统源。
  assertCustomSourceRecord,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: assertSourceCanBeEnabled 启用门禁函数。
  // 文件作用: 启用前校验结构、指纹、授权和软隐藏状态。
  assertSourceCanBeEnabled,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: assertSourceSelectable 默认源候选门禁函数。
  // 文件作用: 默认源只能选择有效启用且未隐藏记录。
  assertSourceSelectable,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: createAuthorizedSourceImportSnapshot 首次导入授权快照工厂。
  // 文件作用: 从已验证 Package、Definition 和用户确认时间原子创建有效授权。
  createAuthorizedSourceImportSnapshot,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: createAuthorizedSourceSnapshot 授权快照工厂。
  // 文件作用: 只从当前版本、已验证指纹和用户确认时间创建 authorized 快照。
  createAuthorizedSourceSnapshot,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: createPendingSourceAuthorizationSnapshot 待授权快照工厂。
  // 文件作用: 新导入自定义源进入 pending；更新失效授权时保留历史诊断字段。
  createPendingSourceAuthorizationSnapshot,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: createRevokedSourceSnapshot 撤销授权快照工厂。
  // 文件作用: 把状态改为 revoked 并保留最近授权诊断字段。
  createRevokedSourceSnapshot,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: createSourceRuntimeIndex 会话运行态提取函数。
  // 文件作用: 从稳定投影提取下一次 Repository 重组装允许的字段。
  createSourceRuntimeIndex,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: findRequiredSourceRecord 记录查询函数。
  // 文件作用: 指定 sourceId 未命中时抛稳定 notFound 错误。
  findRequiredSourceRecord,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: isSourceProviderReady Provider 就绪纯判断。
  // 文件作用: 健康检测和自动默认源采用复用投影中的唯一就绪资格。
  isSourceProviderReady,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: loadSourceManagerRepositoryProjection Repository 图加载器。
  // 文件作用: 初始化和事务都从最新保存图及真实 usage 组装同构投影。
  loadSourceManagerRepositoryProjection,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: normalizeApplySourceUpdateCommand 更新命令规范化函数。
  // 文件作用: 更新进入 FIFO 前完成包定义关联、指纹、sourceId 和交接校验。
  normalizeApplySourceUpdateCommand,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: normalizeAuthorizeSourceCommand 授权命令规范化函数。
  // 文件作用: 授权时间、sourceId 和同时启用决定在排队前完整校验。
  normalizeAuthorizeSourceCommand,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: normalizeDeleteSourcesCommand 混合批量删除命令规范化函数。
  // 文件作用: 删除进入 FIFO 前完成目标去重、危险键和可选交接校验。
  normalizeDeleteSourcesCommand,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: normalizeImportSourceCommand 导入命令规范化函数。
  // 文件作用: 导入进入 FIFO 前完成 Package、Definition、settings 和脚本指纹校验。
  normalizeImportSourceCommand,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: normalizeRevokeSourceAuthorizationCommand 撤销命令规范化函数。
  // 文件作用: 撤销目标和可选默认源交接在排队前完整校验。
  normalizeRevokeSourceAuthorizationCommand,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: normalizeRestoreSystemSourceIds 恢复目标集合规范化函数。
  // 文件作用: 恢复事务在排队前统一拒绝非数组、空集合和危险 sourceId。
  normalizeRestoreSystemSourceIds,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: normalizeSetSourceEnabledCommand 启停命令规范化函数。
  // 文件作用: 启停 Boolean、sourceId 和可选交接在排队前完整校验。
  normalizeSetSourceEnabledCommand,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: normalizeSourceManagerId 单 sourceId 规范化函数。
  // 文件作用: 默认源、检测和缓存方法统一拒绝危险或空 id。
  normalizeSourceManagerId,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: normalizeSourceExportCommand 最小导出命令规范化函数。
  // 文件作用: 导出只接受安全 sourceIds 和标准 exportedAt，不接受浏览器选项。
  normalizeSourceExportCommand,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: resolveDefaultSourceHandoff 默认源交接解析函数。
  // 文件作用: 关闭和撤销当前默认源必须消费 replace 或 clear 决定。
  resolveDefaultSourceHandoff,

  // 导入来源: ./source-manager/sourceManagerTransactions.js。
  // 导入内容: SOURCE_EXPORT_SCHEMA_VERSION 最小导出结构版本。
  // 文件作用: 导出对象使用集中版本，不在方法内部散落字面值。
  SOURCE_EXPORT_SCHEMA_VERSION
} from './source-manager/sourceManagerTransactions.js';

// 类型: Array<string>。
// 作用: 固定 SourceManager 当前构造选项，只允许会话 runtime 和活动源，不接受保存态或页面对象。
const SOURCE_MANAGER_OPTION_FIELDS = Object.freeze([
  'initialRuntimeStates',
  'activeSourceId'
]);

// 类型: Array<string>。
// 作用: 固定 applySourceUpdate 不允许改变的数据源身份字段，避免更新暗中变成删除加重新导入。
const SOURCE_UPDATE_STABLE_DEFINITION_FIELDS = Object.freeze([
  'id',
  'sourceKind',
  'providerKey',
  'packageRef',
  'importMethod',
  'remoteUrl',
  'importedAt'
]);

// 类型: object。
// 作用: 把健康端口可能返回的稳定领域错误码转换为用户可理解的不可用原因。
// 字段: validation、operation，string，分别说明结果契约无效和检测执行失败；内部code仍保留在Error对象中供程序判断。
const SOURCE_HEALTH_CHECK_FAILURE_REASON_BY_CODE = Object.freeze({
  [SOURCE_MANAGER_ERROR_CODE.validation]: '数据源返回的健康检测结果不符合要求，请联系数据源提供方。',
  [SOURCE_MANAGER_ERROR_CODE.operation]: '数据源健康检测执行失败，请稍后重试。'
});

// 类型: string。
// 作用: 未知异常类型仍收敛为稳定用户原因，禁止错误类名、堆栈或内部code穿透到页面。
const DEFAULT_SOURCE_HEALTH_CHECK_FAILURE_REASON = '数据源健康检测失败，请稍后重试。';

/**
 * 校验 Repository、Unit of Work 或检测端口依赖方法。
 * 纯函数: 只读取注入依赖的方法类型，不调用或修改依赖。
 *
 * @param {object} dependency 注入依赖。
 * @param {string} methodName 必须存在的方法名。
 * @param {string} dependencyName 错误信息使用的依赖名。
 * @returns {void} 依赖方法有效时结束。
 * @throws {SourceManagerValidationError} 当依赖缺失或指定成员不是函数时抛出。
 */
function assertRepositoryMethod(dependency, methodName, dependencyName) {
  // 条件分支: 依赖不存在或指定成员不是可调用方法时进入。
  // 执行内容: 拒绝创建无法载入、执行事务或检测的半初始化 Manager。
  if (!dependency || typeof dependency[methodName] !== 'function') {
    throw new SourceManagerValidationError(`${dependencyName}.${methodName} 必须是函数`);
  }
}

/**
 * 校验并规范化 SourceManager 当前会话选项。
 * 纯函数: 返回新对象，不修改调用方 options 或初始运行态。
 *
 * @param {*} options SourceManager 构造选项。
 * @returns {object} 字段受控的隔离会话选项。
 * @returns {Record<string, object>} return.initialRuntimeStates 按 sourceId 保存的健康和更新会话状态。
 * @returns {string} return.activeSourceId 当前活动源 id；没有活动源时为空字符串。
 * @throws {SourceManagerValidationError} 当 options 类型、字段集合或活动源 id 不符合契约时抛出。
 */
function normalizeSourceManagerOptions(options) {
  try {
    // 执行内容: 拒绝数组、类实例和异常原型，保证选项字段读取不会触发继承行为。
    assertPlainObject(options, 'sourceManagerOptions');
  } catch (error) {
    // 异常来源: Repository 普通对象校验拒绝构造选项容器。
    // 处理策略: 转换为 SourceManager 校验错误并保留底层 cause。
    throw new SourceManagerValidationError(error.message, { cause: error });
  }

  // 类型: Array<string|symbol>。
  // 作用: 读取全部自有选项键，阻止保存态、页面状态或未经设计的兼容字段进入 Manager。
  const optionKeys = Reflect.ownKeys(options);

  // 类型: Array<string|symbol>。
  // 作用: 保存不属于当前构造契约的字段，用于一次性输出完整失败原因。
  const unknownOptionFields = optionKeys.filter(field => !SOURCE_MANAGER_OPTION_FIELDS.includes(field));

  // 条件分支: 构造选项包含任何未冻结字段时进入。
  // 执行内容: 拒绝未知能力，避免 SourceManager 成为页面状态或保存态的隐式容器。
  if (unknownOptionFields.length > 0) {
    throw new SourceManagerValidationError(`sourceManagerOptions 包含禁止字段: ${unknownOptionFields.join(', ')}`);
  }

  // 类型: string。
  // 作用: 保存调用方声明的活动源 id；未提供时使用明确空字符串。
  const activeSourceId = options.activeSourceId === undefined ? '' : options.activeSourceId;

  // 条件分支: 调用方提供了非空活动源 id 时进入。
  // 执行内容: 复用动态键安全校验，拒绝非字符串、空白和原型敏感名称。
  if (activeSourceId !== '') {
    try {
      // 执行内容: 校验活动源 id 可以安全参与记录索引和跨层传递。
      assertSafeRecordKey(activeSourceId, 'sourceManagerOptions.activeSourceId');
    } catch (error) {
      // 异常来源: Repository 动态键校验拒绝活动源 id。
      // 处理策略: 转换为 SourceManager 校验错误并保留底层 cause。
      throw new SourceManagerValidationError(error.message, { cause: error });
    }
  }

  // 返回值类型: object。
  // 作用: 返回字段受控的新选项对象，初始运行态由专用规范化函数隔离。
  return {
    initialRuntimeStates: normalizeInitialSourceRuntimeStates(options.initialRuntimeStates || {}),
    activeSourceId
  };
}

/**
 * 把健康检测内部错误转换为页面可展示的不可用原因。
 * 纯函数: 只读取稳定领域错误码，不修改错误对象或运行态。
 * 调用方: SourceManager健康端口失败收敛分支。
 * 维护边界: Error.code继续用于程序判断，Error.message/cause继续用于诊断；返回文本只进入lastUnavailableReason。
 *
 * @param {*} error 健康端口拒绝值；标准领域错误包含稳定code。
 * @returns {string} 用户可读且不暴露内部错误码的不可用原因。
 */
function resolveSourceHealthCheckFailureReason(error) {
  // 类型: string|undefined。
  // 作用: 只接受错误对象公开的稳定code作为映射键，未知拒绝值不会被序列化到页面。
  const errorCode = error && typeof error === 'object' ? error.code : undefined;

  // 返回值类型: string。
  // 作用: 已知领域错误使用专用用户说明，未知错误使用稳定兜底；两者均不泄漏内部code或cause。
  return SOURCE_HEALTH_CHECK_FAILURE_REASON_BY_CODE[errorCode]
    || DEFAULT_SOURCE_HEALTH_CHECK_FAILURE_REASON;
}

/**
 * 数据源领域管理服务。
 * 职责: 从 Repository 读取保存态、调度原子事务、维护当前会话 runtime，并返回隔离 SourceManagerState。
 * 使用场景: 可由独立领域调用方直接实例化，也可由应用组合入口创建并交给 settingsService 委托。
 * 保存边界: 不保存 Package、Definition、Preferences 或 Storage 副本；Repository 是唯一保存权威。
 * 内部状态: 只保存基础设施和端口引用、操作队列、状态监听器、当前会话 runtime、活动源 id 和最近成功投影。
 * 公共方法: initialize/getState/subscribe、检测、基础偏好事务，以及导入、更新、混合删除和最小导出。
 * 抛错条件: 构造输入非法抛 validation；未命中抛 notFound；领域门禁抛 invariant；事务或端口失败抛 operation。
 */
export class SourceManager {
  // 类型: object。
  // 作用: 保存 SourcePackageRepository 引用，只用于读取脚本包和后续包生命周期事务。
  #packageRepository;

  // 类型: object。
  // 作用: 保存 SourceDefinitionRepository 引用，用于读取 Definition 和原子保存 Preferences。
  #definitionRepository;

  // 类型: object。
  // 作用: 保存 SourceStorageRepository 引用，用于派生 usage 和执行缓存清理。
  #storageRepository;

  // 类型: object。
  // 作用: 保存 SourceRepositoryUnitOfWork 引用，保证 Preferences 和 Storage 写事务提交或回滚。
  #unitOfWork;

  // 类型: object。
  // 作用: 保存冻结 Provider 就绪端口门面，每次投影组装重新评估当前 Definition，不持久化结果。
  #providerReadinessPort;

  // 类型: object。
  // 作用: 保存冻结健康检测端口门面，端口实现不能直接修改 Manager 或 Repository。
  #healthCheckPort;

  // 类型: object。
  // 作用: 保存冻结在线更新检测端口门面，SourceManager 只消费标准结果。
  #updateCheckPort;

  // 类型: Record<string, object>。
  // 作用: 保存字段受控的当前会话健康、Provider 和更新状态，不保存 Repository 数据。
  #runtimeBySourceId;

  // 类型: string。
  // 作用: 保存当前会话活动源 id；失效时由投影组装清空，不自动选择候选。
  #activeSourceId;

  // 类型: object。
  // 作用: 保存当前唯一活动源切换状态；Repository 重组装只能接收并返回该状态，不能重置或另建权威。
  #switchState;

  // 类型: object|null。
  // 作用: 保存最近一次成功或检测过程中的轻量投影；初始化前为 null。
  #state;

  // 类型: Promise<void>。
  // 作用: SourceManager 公开操作 FIFO 队列尾；成功和失败都收敛为 fulfilled，后续操作继续执行。
  #operationQueueTail;

  // 类型: Set<object>。
  // 作用: 保存每次 subscribe 独立创建的订阅记录；相同函数可以拥有互不干扰的多份订阅和取消句柄。
  #stateListeners;

  /**
   * 创建 SourceManager。
   *
   * @param {object} dependencies 显式基础设施和检测端口依赖。
   * @param {object} dependencies.packageRepository SourcePackageRepository，提供 loadAll。
   * @param {object} dependencies.definitionRepository SourceDefinitionRepository，提供 loadDefinitions/loadPreferences/savePreferences。
   * @param {object} dependencies.storageRepository SourceStorageRepository，提供 getUsage/clear/clearAll。
   * @param {object} dependencies.unitOfWork SourceRepositoryUnitOfWork，提供 runInTransaction。
   * @param {object} dependencies.providerReadinessPort Provider 就绪端口，只包含 evaluate。
   * @param {object} dependencies.healthCheckPort 健康检测端口，只包含 check。
   * @param {object} dependencies.updateCheckPort 在线更新检测端口，只包含 check。
   * @param {object} options 可选会话输入。
   * @param {Record<string, object>} options.initialRuntimeStates 可选健康和更新会话状态。
   * @param {string} options.activeSourceId 可选活动源 id；没有活动源时为空字符串。
   * @throws {SourceManagerValidationError} 当依赖方法、端口、选项字段或活动源 id 不符合契约时抛出。
   */
  constructor(dependencies, options = {}) {
    try {
      // 执行内容: 拒绝数组、类实例和异常原型，保证基础设施只通过显式自有字段注入。
      assertPlainObject(dependencies, 'sourceManagerDependencies');
    } catch (error) {
      // 异常来源: Repository 普通对象校验拒绝依赖容器。
      // 处理策略: 转换为 SourceManager 校验错误并保留底层 cause。
      throw new SourceManagerValidationError(error.message, { cause: error });
    }

    // 类型: object。
    // 作用: 保存字段受控的会话选项，避免构造过程静默忽略非法活动源或未知字段。
    const normalizedOptions = normalizeSourceManagerOptions(options);

    // 执行内容: 逐项验证读取、保存、缓存和事务方法，缺少任一能力都阻止创建实例。
    assertRepositoryMethod(dependencies.packageRepository, 'loadAll', 'packageRepository');
    assertRepositoryMethod(dependencies.packageRepository, 'get', 'packageRepository');
    assertRepositoryMethod(dependencies.packageRepository, 'save', 'packageRepository');
    assertRepositoryMethod(dependencies.packageRepository, 'remove', 'packageRepository');
    assertRepositoryMethod(dependencies.definitionRepository, 'loadDefinitions', 'definitionRepository');
    assertRepositoryMethod(dependencies.definitionRepository, 'getDefinition', 'definitionRepository');
    assertRepositoryMethod(dependencies.definitionRepository, 'saveDefinition', 'definitionRepository');
    assertRepositoryMethod(dependencies.definitionRepository, 'removeDefinition', 'definitionRepository');
    assertRepositoryMethod(dependencies.definitionRepository, 'loadPreferences', 'definitionRepository');
    assertRepositoryMethod(dependencies.definitionRepository, 'savePreferences', 'definitionRepository');
    assertRepositoryMethod(dependencies.storageRepository, 'getUsage', 'storageRepository');
    assertRepositoryMethod(dependencies.storageRepository, 'set', 'storageRepository');
    assertRepositoryMethod(dependencies.storageRepository, 'clear', 'storageRepository');
    assertRepositoryMethod(dependencies.storageRepository, 'clearAll', 'storageRepository');
    assertRepositoryMethod(dependencies.storageRepository, 'removeSource', 'storageRepository');
    assertRepositoryMethod(dependencies.unitOfWork, 'runInTransaction', 'unitOfWork');

    this.#packageRepository = dependencies.packageRepository;
    this.#definitionRepository = dependencies.definitionRepository;
    this.#storageRepository = dependencies.storageRepository;
    this.#unitOfWork = dependencies.unitOfWork;
    this.#providerReadinessPort = createSourceProviderReadinessPort(
      dependencies.providerReadinessPort
    );
    this.#healthCheckPort = createSourceHealthCheckPort(dependencies.healthCheckPort);
    this.#updateCheckPort = createSourceUpdateCheckPort(dependencies.updateCheckPort);
    this.#runtimeBySourceId = normalizedOptions.initialRuntimeStates;
    this.#activeSourceId = normalizedOptions.activeSourceId;
    this.#switchState = createIdleSourceSwitchState();
    this.#state = null;
    this.#operationQueueTail = Promise.resolve();
    this.#stateListeners = new Set();
  }

  /**
   * 返回当前实例三个 Repository 引用组成的局部读取上下文。
   * 纯函数: 每次返回新的冻结根对象，不替换或修改 Repository。
   *
   * @returns {object} Package、Definition 和 Storage Repository 引用。
   */
  #createRepositoryContext() {
    // 返回值类型: object。
    // 作用: 给统一投影加载器提供稳定引用，冻结根对象防止调用点替换字段。
    return Object.freeze({
      packageRepository: this.#packageRepository,
      definitionRepository: this.#definitionRepository,
      storageRepository: this.#storageRepository
    });
  }

  /**
   * 把一个 SourceManager 操作加入私有 FIFO 队列。
   * 副作用: 更新内部队列尾；action 可以读取或修改当前会话状态并调用 Repository。
   * 成功路径: 等待前一操作收敛后执行 action，并原样返回结果。
   * 失败路径: 当前调用保留真实异常；内部队列尾恢复 fulfilled，后续操作继续执行。
   *
   * @param {Function} action 已完成同步命令校验的异步操作。
   * @returns {Promise<*>} 当前操作独立成功结果或失败异常。
   */
  #enqueueOperation(action) {
    // 类型: Promise<*>。
    // 作用: 把当前操作链接到现有队列尾，前一操作成功或失败收敛后才执行 action。
    const queuedOperation = this.#operationQueueTail.then(() => action());

    // 类型: Promise<void>。
    // 作用: 当前操作无论成功或失败都把内部队列尾恢复为 fulfilled，避免队列中毒。
    this.#operationQueueTail = queuedOperation.then(
      () => undefined,
      () => undefined
    );

    // 返回值类型: Promise<*>。
    // 作用: 返回当前调用独立 Promise，不吞掉 action 结果或异常。
    return queuedOperation;
  }

  /**
   * 要求 SourceManager 已经成功初始化。
   * 纯函数: 只读取当前投影引用，不修改状态。
   *
   * @returns {object} 当前内部轻量投影。
   * @throws {SourceManagerInitializationError} 当尚无成功投影时抛出。
   */
  #requireInitializedState() {
    // 条件分支: 当前实例从未成功初始化时进入。
    // 执行内容: 拒绝领域操作读取 null 或伪造空状态。
    if (!this.#state) {
      throw new SourceManagerInitializationError('SourceManager 尚未初始化');
    }

    // 返回值类型: object。
    // 作用: 返回内部当前投影，只供类私有方法读取或创建隔离候选。
    return this.#state;
  }

  /**
   * 向全部当前监听器发布最新完整投影。
   * 副作用: 同步调用监听器；每个监听器获得独立副本，单个监听器抛错不会影响其他监听器或领域操作。
   * 成功路径: 全部监听器均被尝试调用后结束。
   * 失败路径: 监听器异常在当前边界被隔离，不向 SourceManager 公开方法传播。
   *
   * @returns {void} 发布过程不返回监听器结果。
   */
  #publishState() {
    // 类型: Array<object>。
    // 作用: 冻结本轮发布开始时的订阅目标；监听器在回调中取消其他订阅只影响下一轮发布。
    const subscriptions = [...this.#stateListeners];

    // 循环类型: for...of。
    // 初始值: 本轮订阅快照中的第一条记录。
    // 终止条件: 发布开始时存在的全部订阅都完成一次独立投影通知。
    // 循环作用: 监听器失败和回调期间取消彼此隔离，当前轮次仍保持固定通知集合。
    for (const subscription of subscriptions) {
      try {
        // 类型: object。
        // 作用: 为当前监听器创建专属完整副本，阻止不同监听器通过嵌套对象互相污染。
        const isolatedState = cloneSerializableValue(this.#state, 'sourceManagerPublishedState');

        // 副作用: 同步通知当前监听器。
        // 影响范围: 仅监听器自身逻辑；Manager 不采用监听器返回值。
        subscription.listener(isolatedState);
      } catch {
        // 异常来源: 当前监听器同步抛错或修改隔离副本时触发自身异常。
        // 处理策略: 明确隔离异常，保持已完成领域事务和其余监听器通知不变。
      }
    }
  }

  /**
   * 采用一个稳定 SourceManagerState 并同步会话运行态索引。
   * 副作用: 替换当前实例的 state、runtimeBySourceId 和 activeSourceId；不写 Repository。
   *
   * @param {object} state 已完整组装的稳定轻量投影。
   * @returns {object} 与内部状态引用隔离的 SourceManagerState。
   */
  #adoptStableState(state) {
    // 类型: object。
    // 作用: 严格隔离候选投影，避免事务结果对象与 Manager 内部状态共享嵌套引用。
    const isolatedState = cloneSerializableValue(state, 'sourceManagerState');

    // 副作用: 采用最新稳定投影。
    // 影响范围: 当前 SourceManager 实例，不修改 Repository 或页面 store。
    this.#state = isolatedState;

    // 副作用: 从稳定投影重新提取会话运行态索引。
    // 影响范围: 当前 SourceManager 实例，排除 enabled、指纹和检查过程字段。
    this.#runtimeBySourceId = createSourceRuntimeIndex(isolatedState);

    // 类型: string。
    // 作用: 使用投影门禁后的活动源 id 更新当前会话；失效时为空字符串。
    this.#activeSourceId = isolatedState.activeSourceId;

    // 副作用: 同步采用投影中经过状态组装器验证的唯一切换状态。
    // 影响范围: 当前 Manager 会话；不写 Repository 或页面 store。
    this.#switchState = cloneSerializableValue(isolatedState.switchState, 'sourceSwitchState');

    // 执行内容: 稳定投影全部内部索引采用完成后统一发布，监听器不会观察半更新状态。
    this.#publishState();

    // 返回值类型: object。
    // 作用: 返回第二份隔离副本，调用方修改结果不会穿透 Manager 内部投影。
    return cloneSerializableValue(isolatedState, 'sourceManagerState');
  }

  /**
   * 只替换当前过渡投影，不重新提取稳定 runtime。
   * 副作用: 更新当前实例 state，使 getState 可以观察 checking/checkingAll/checkingUpdate。
   *
   * @param {object} state 包含检测过程状态的轻量投影。
   * @returns {void} 过渡投影通过 getState 暴露，不返回业务结果。
   */
  #adoptTransientState(state) {
    // 副作用: 严格隔离并替换当前过渡投影。
    // 影响范围: 当前 SourceManager 实例；Repository 和稳定 runtime 索引保持不变。
    this.#state = cloneSerializableValue(state, 'sourceManagerTransientState');

    // 副作用: 过渡投影可能发布新的切换 requestId，必须与当前可观察 state 同步采用。
    // 影响范围: 当前 Manager 唯一切换状态，不修改活动源或稳定 runtime 索引。
    this.#switchState = cloneSerializableValue(this.#state.switchState, 'sourceSwitchState');

    // 执行内容: 立即发布 checking、checkingAll 或 checkingUpdate 完整投影，让页面无需轮询。
    this.#publishState();
  }

  /**
   * 使用当前 Repository 和会话 runtime 重新组装稳定投影。
   * 副作用: 调用三个 Repository 的只读方法；成功后采用新投影。
   * 成功路径: 返回隔离 SourceManagerState。
   * 失败路径: Repository 读取或组装失败时抛原错误，旧稳定 runtime 保持不变。
   *
   * @returns {Promise<object>} 最新稳定轻量投影。
   * @throws {Error} 当 Repository 读取或组装失败时抛出。
   */
  async #refreshStableState() {
    // 类型: object。
    // 作用: 从当前三个 Repository 读取最新保存图并组装候选投影。
    const projection = await loadSourceManagerRepositoryProjection(
      this.#createRepositoryContext(),
      this.#providerReadinessPort,
      this.#runtimeBySourceId,
      this.#activeSourceId,
      this.#switchState
    );

    // 返回值类型: object。
    // 作用: 采用稳定候选并返回隔离投影。
    return this.#adoptStableState(projection.state);
  }

  /**
   * 更新一个 sourceId 的稳定会话运行态字段。
   * 副作用: 替换 runtimeBySourceId 中目标运行态对象；不修改投影或 Repository。
   *
   * @param {string} sourceId 目标数据源 id。
   * @param {object} patch 健康或更新字段补丁。
   * @returns {void} 稳定投影由后续 refresh 统一组装。
   */
  #patchRuntimeState(sourceId, patch) {
    // 类型: object。
    // 作用: 保存当前 sourceId 已有稳定运行态；初始化后每条记录都应具备该对象。
    const currentRuntime = this.#runtimeBySourceId[sourceId];

    // 条件分支: 当前运行态索引没有目标 sourceId 时进入。
    // 执行内容: 抛出操作错误，禁止检测创建没有 Definition 的影子 runtime。
    if (!currentRuntime) {
      throw new SourceManagerOperationError(`运行态不存在: ${sourceId}`);
    }

    // 副作用: 使用严格隔离的新对象替换目标运行态，其他 sourceId 保持不变。
    // 影响范围: 当前 SourceManager 会话运行态索引。
    this.#runtimeBySourceId[sourceId] = cloneSerializableValue({
      ...currentRuntime,
      ...patch
    }, `sourceRuntime.${sourceId}`);
  }

  /**
   * 把一个 sourceId 的稳定 runtime 同步到当前过渡投影。
   * 副作用: 替换当前 state；保留 checkingAll 等根级过程状态，不写 Repository。
   *
   * @param {string} sourceId 目标数据源 id。
   * @returns {void} 过渡投影通过 getState 暴露，不返回业务结果。
   */
  #syncRuntimeToTransientState(sourceId) {
    // 类型: object。
    // 作用: 复制当前过渡投影，避免直接修改调用期间可能已经返回的状态引用。
    const transientState = cloneSerializableValue(this.#state, 'sourceManagerRuntimeSyncState');

    // 类型: object。
    // 作用: 定位过渡投影目标记录，来源是已初始化 runtime 索引，因此必须命中。
    const transientRecord = findRequiredSourceRecord(transientState, sourceId);

    // 副作用: 把稳定健康、Provider 和更新字段合并到目标过渡记录。
    // 影响范围: 当前 sourceId runtime；enabled、指纹、根 checkingAll 和 Repository 保持不变。
    Object.assign(transientRecord.runtime, this.#runtimeBySourceId[sourceId]);

    // 执行内容: 采用更新后的过渡投影，批量检测不会让已完成记录继续显示 checking。
    this.#adoptTransientState(transientState);
  }

  /**
   * 执行一笔基于最新 Repository 图的原子写事务。
   * 副作用: 加入 SourceManager FIFO，并通过 Unit of Work 允许 executor 保存 Preferences 或清理 Storage。
   * 成功路径: Repository 提交后采用事务内重新组装的候选投影。
   * 失败路径: 领域错误在回滚后解包原样抛出；基础设施失败包装 operation 并保留 cause；旧投影不变。
   *
   * @param {string} operationName 错误诊断使用的操作名称。
   * @param {Function} executor 取得 Unit of Work 执行权后运行的领域写回调。
   * @returns {Promise<object>} 提交后隔离 SourceManagerState。
   * @throws {SourceManagerError} 当命令、记录或领域不变量失败时抛出。
   * @throws {SourceManagerOperationError} 当 Repository 事务或重组装意外失败时抛出。
   */
  #runRepositoryTransaction(operationName, executor) {
    // 返回值类型: Promise<object>。
    // 作用: 所有写事务统一进入 SourceManager FIFO，避免 runtime 和返回投影顺序错乱。
    return this.#enqueueOperation(async () => {
      // 执行内容: 写事务必须建立在已初始化投影上，不能从 null 状态开始。
      this.#requireInitializedState();

      try {
        // 类型: object。
        // 作用: Unit of Work 成功结果包含同一事务内重新组装的稳定候选投影。
        const transactionResult = await this.#unitOfWork.runInTransaction(async (repositories) => {
          // 类型: object。
          // 作用: 在事务真正取得执行权后读取最新 Repository 图，禁止使用排队前旧 Preferences。
          const beforeProjection = await loadSourceManagerRepositoryProjection(
            repositories,
            this.#providerReadinessPort,
            this.#runtimeBySourceId,
            this.#activeSourceId,
            this.#switchState
          );

          // 类型: Record<string, object>。
          // 作用: 创建当前事务专属稳定 runtime 候选；4D 更新或删除可以调整它，失败回滚时整份丢弃。
          const candidateRuntimeBySourceId = cloneSerializableValue(
            this.#runtimeBySourceId,
            `${operationName}.runtimeCandidate`
          );

          // 异步调用: 执行当前领域写回调。
          // resolve: Repository 写入和候选 runtime 调整已经完成，可以在同一事务内重组装。
          // reject: Unit of Work 回滚三个 Repository 并保留原始 cause。
          await executor({
            repositories,
            state: beforeProjection.state,
            preferences: beforeProjection.preferences,
            runtimeBySourceId: candidateRuntimeBySourceId
          });

          // 类型: object。
          // 作用: 在同一独占事务中读取写后 Repository 图，生成提交后候选投影。
          const afterProjection = await loadSourceManagerRepositoryProjection(
            repositories,
            this.#providerReadinessPort,
            candidateRuntimeBySourceId,
            this.#activeSourceId,
            this.#switchState
          );

          // 返回值类型: object。
          // 作用: 把写后稳定投影交给 Unit of Work；只有 executor 完整成功才会提交。
          return { state: afterProjection.state };
        });

        // 返回值类型: object。
        // 作用: Unit of Work 已提交后一次采用候选投影，避免页面先于 Repository 更新。
        return this.#adoptStableState(transactionResult.state);
      } catch (error) {
        // 条件分支: Unit of Work 已回滚，且原始 cause 是 SourceManager 领域拒绝时进入。
        // 执行内容: 原样抛出 validation/notFound/invariant，不把用户可修正错误伪装成基础设施失败。
        if (error instanceof SourceRepositoryTransactionError
          && error.cause instanceof SourceManagerError) {
          throw error.cause;
        }

        // 条件分支: 错误已经是 Unit of Work 之外产生的 SourceManager 领域错误时进入。
        // 执行内容: 原样抛出稳定 code，不重复包装。
        if (error instanceof SourceManagerError) {
          throw error;
        }

        // 错误类型: SourceManagerOperationError。
        // 作用: 包装 Repository 事务、回滚或重组装意外失败，并保留真实 cause。
        throw new SourceManagerOperationError(`${operationName} 失败`, error);
      }
    });
  }

  /**
   * 对一个记录执行健康端口调用并收敛会话状态。
   * 副作用: 更新过渡投影和稳定 runtime；调用注入健康端口；不写 Repository。
   * 成功路径: 返回 null，调用方决定何时刷新稳定投影。
   * 失败路径: 目标 runtime 收敛为 unavailable 并返回端口领域错误对象。
   *
   * @param {object} record 已通过运行门禁的 SourceRecord。
   * @returns {Promise<Error|null>} 成功返回 null；端口失败返回可追踪错误。
   */
  async #checkHealthRecord(record) {
    // 类型: string。
    // 作用: 保存当前检测 sourceId，后续过渡投影和稳定 runtime 使用同一身份。
    const sourceId = record.definition.id;

    // 类型: object。
    // 作用: 复制当前投影并把目标健康状态改为 checking，供并发 getState 观察过程状态。
    const checkingState = cloneSerializableValue(this.#state, 'sourceManagerHealthCheckingState');

    // 类型: object。
    // 作用: 定位过渡投影目标记录；来源是已存在 record，因此此处必须命中。
    const checkingRecord = findRequiredSourceRecord(checkingState, sourceId);

    // 副作用: 只修改局部过渡投影的健康状态。
    // 影响范围: 目标 SourceRecord；稳定 runtime 和 Repository 尚未改变。
    checkingRecord.runtime.healthStatus = HEALTH_STATUS.checking;
    this.#adoptTransientState(checkingState);

    try {
      // 类型: object。
      // 作用: 保存健康端口标准结果，门面已经校验状态、时间和原因组合。
      const result = await this.#healthCheckPort.check(
        cloneSerializableValue(record, `healthCheckRecord.${sourceId}`)
      );

      // 副作用: 把检测完成结果写入稳定会话 runtime，后续统一重组装投影。
      // 影响范围: 当前 sourceId 的健康字段，不修改 Provider 和更新状态。
      this.#patchRuntimeState(sourceId, {
        healthStatus: result.healthStatus,
        lastCheckedAt: result.checkedAt,
        lastUnavailableReason: result.unavailableReason
      });

      // 执行内容: 把当前结果同步到过渡投影，批量检测期间已完成记录立即退出 checking。
      this.#syncRuntimeToTransientState(sourceId);

      // 返回值类型: null。
      // 作用: 明确表示当前端口调用成功，批量检测无需记录错误。
      return null;
    } catch (error) {
      // 类型: string。
      // 作用: 把内部领域错误转换为用户可展示原因；错误对象本身继续携带code/message/cause供调用方诊断。
      const failureReason = resolveSourceHealthCheckFailureReason(error);

      // 副作用: 端口失败收敛为 unavailable，并保留上一次成功 checkedAt 供页面判断数据时效。
      // 影响范围: 当前 sourceId 健康状态；Repository 不写入。
      this.#patchRuntimeState(sourceId, {
        healthStatus: HEALTH_STATUS.unavailable,
        lastUnavailableReason: failureReason
      });

      // 执行内容: 把失败结果同步到过渡投影，批量检测期间当前记录立即显示 unavailable。
      this.#syncRuntimeToTransientState(sourceId);

      // 返回值类型: Error。
      // 作用: 返回可追踪端口错误；单源检测会抛出，批量检测记录状态后继续其他源。
      return error;
    }
  }

  /**
   * 从 Repository 初始化或重新初始化 SourceManager。
   * 副作用: 加入操作 FIFO；成功后替换当前稳定投影和会话 runtime；不写 Repository。
   * 成功路径: 返回隔离 SourceManagerState。
   * 失败路径: Repository 读取或投影组装失败时保留旧状态并抛初始化错误。
   *
   * @returns {Promise<object>} 隔离 SourceManagerState。
   * @throws {SourceManagerInitializationError} 当 Repository 整体载入或安全投影组装失败时抛出并保留 cause。
   */
  initialize() {
    // 返回值类型: Promise<object>。
    // 作用: 初始化也进入操作 FIFO，避免与检测或写事务交错采用状态。
    return this.#enqueueOperation(async () => {
      try {
        // 类型: object。
        // 作用: 从当前 Repository 图、真实 usage 和构造会话 runtime 组装初始候选。
        const projection = await loadSourceManagerRepositoryProjection(
          this.#createRepositoryContext(),
          this.#providerReadinessPort,
          this.#runtimeBySourceId,
          this.#activeSourceId,
          this.#switchState
        );

        // 返回值类型: object。
        // 作用: 全部读取和组装成功后采用候选，并返回隔离投影。
        return this.#adoptStableState(projection.state);
      } catch (error) {
        // 条件分支: 下层已经使用稳定初始化错误包装失败时进入。
        // 执行内容: 原样抛出，避免重复包装 cause 链。
        if (error instanceof SourceManagerInitializationError) {
          throw error;
        }

        // 错误类型: SourceManagerInitializationError。
        // 作用: 统一 Repository 读取、usage 和组装失败边界，并保留原始异常。
        throw new SourceManagerInitializationError('SourceManager 初始化失败', error);
      }
    });
  }

  /**
   * 返回最近一次初始化成功或当前检测过程中的隔离投影。
   * 纯函数: 不修改 Manager 或 Repository；每次返回新的严格 JSON 隔离副本。
   * 成功路径: 已初始化时 resolve 当前投影的隔离副本。
   * 失败路径: 从未成功初始化时 reject 稳定初始化错误。
   *
   * @returns {Promise<object>} 当前 SourceManagerState。
   * @throws {SourceManagerInitializationError} 当当前实例尚无投影时抛出。
   */
  async getState() {
    // 类型: object。
    // 作用: 要求当前实例已经初始化，并读取内部当前稳定或过渡投影。
    const state = this.#requireInitializedState();

    // 返回值类型: object。
    // 作用: 返回严格隔离副本，外部修改不会污染内部状态。
    return cloneSerializableValue(state, 'sourceManagerState');
  }

  /**
   * 订阅稳定态和检测过渡态的完整隔离投影。
   * 副作用: 把 listener 加入当前实例监听集合；已有投影时立即同步发送一份隔离副本。
   * 成功路径: 返回可重复调用的取消函数，首次取消后不再接收后续投影。
   * 失败路径: listener 不是函数时同步抛校验错误；listener 自身抛错被隔离，不改变订阅或领域事务。
   *
   * @param {Function} listener SourceManagerState 同步监听器。
   * @returns {Function} 幂等取消订阅函数。
   * @throws {SourceManagerValidationError} 当 listener 不是函数时抛出。
   */
  subscribe(listener) {
    // 条件分支: listener 不是可调用函数时进入。
    // 执行内容: 拒绝把无效成员加入监听集合，避免发布时产生结构异常。
    if (typeof listener !== 'function') {
      throw new SourceManagerValidationError('SourceManager listener 必须是函数');
    }

    // 类型: object。
    // 作用: 为当前 subscribe 调用建立唯一订阅身份；即使复用相同函数，也由各自取消句柄独立管理。
    const subscription = Object.freeze({ listener });

    // 副作用: 注册当前独立订阅记录。
    // 影响范围: 当前 SourceManager 实例的状态观察端口，不合并相同 listener 函数引用。
    this.#stateListeners.add(subscription);

    // 条件分支: 当前实例已经拥有稳定或过渡投影时进入。
    // 执行内容: 立即发送当前完整副本，订阅者无需等待下一次事务或使用轮询补状态。
    if (this.#state) {
      try {
        subscription.listener(cloneSerializableValue(this.#state, 'sourceManagerSubscribedState'));
      } catch {
        // 异常来源: 新监听器处理首次投影时同步抛错。
        // 处理策略: 隔离页面或外部观察者失败，监听器仍保持注册并可接收后续投影。
      }
    }

    // 类型: boolean。
    // 作用: 记录当前取消函数是否已经执行，保证重复调用不产生额外副作用。
    let unsubscribed = false;

    /**
     * 取消当前状态订阅。
     * 副作用: 首次调用从监听集合移除 listener；重复调用保持无操作。
     *
     * @returns {void} 取消函数不返回业务数据。
     */
    return () => {
      // 条件分支: 当前取消函数已经执行时进入。
      // 执行内容: 直接结束，保证调用方清理流程可以安全重复调用。
      if (unsubscribed) {
        return;
      }

      // 类型: boolean。
      // 作用: 标记订阅已经取消，后续调用不再访问监听集合。
      unsubscribed = true;

      // 副作用: 从当前 SourceManager 监听集合移除本次 subscribe 创建的唯一记录。
      // 影响范围: 只停止当前订阅接收未来投影，不影响复用同一函数建立的其他订阅。
      this.#stateListeners.delete(subscription);
    };
  }

  /**
   * 发布一个新的活动源切换请求。
   * 副作用: 加入 Manager FIFO，并把完整投影切换为 switching；保持当前 activeSourceId 和 runtime 索引不变。
   * 成功路径: 目标记录存在、有效启用且未软隐藏时采用新的 pendingSourceId/requestId。
   * 失败路径: 命令或目标无效时不发布切换状态，保留原活动源和原切换结果。
   *
   * @param {object} command 切换开始命令。
   * @param {string} command.sourceId 目标活动源 id。
   * @param {string} command.requestId Runtime 当前实例生成的唯一请求身份。
   * @returns {Promise<object>} 发布 switching 后的隔离 SourceManagerState。
   */
  beginSourceSwitch(command) {
    // 类型: object。
    // 作用: 在排队前拒绝额外字段、危险身份和非字符串 requestId。
    const safeCommand = normalizeSourceSwitchRequest(command);

    return this.#enqueueOperation(async () => {
      // 类型: object。
      // 作用: 读取 FIFO 真正执行时的最新投影，快速连续切换不会基于排队前旧状态。
      const state = this.#requireInitializedState();

      // 类型: object。
      // 作用: 从最新记录定位目标；不存在时使用稳定 notFound 错误。
      const targetRecord = findRequiredSourceRecord(state, safeCommand.sourceId);

      // 执行内容: Manager 只验证启用和可见性；可信工厂与 Host 准备继续由 Runtime 唯一边界完成。
      assertSourceSelectable(state, targetRecord);

      // 类型: object。
      // 作用: 创建完整切换过渡投影，当前 activeSourceId、记录和 Repository 保存态保持不变。
      const switchingState = cloneSerializableValue(state, 'sourceManagerSwitchingState');
      switchingState.switchState = {
        pendingSourceId: safeCommand.sourceId,
        requestId: safeCommand.requestId,
        status: SOURCE_SWITCH_STATUS.switching,
        errorMessage: ''
      };

      // 执行内容: 一次采用并发布完整 switching 投影，观察者不会看到半更新请求身份。
      this.#adoptTransientState(switchingState);

      return cloneSerializableValue(this.#state, 'sourceManagerState');
    });
  }

  /**
   * 尝试提交一个已经准备完成的活动源切换。
   * 副作用: 加入 Manager FIFO；仅当前最新 requestId 可以一次采用 activeSourceId 和 success。
   * 成功路径: 请求仍为最新且目标仍有效时发布 success；过期请求无发布、无报错并返回当前状态。
   * 失败路径: 当前请求目标失效或请求身份与 pending 目标矛盾时保留 switching，交给 Runtime 发布 failed。
   *
   * @param {object} command 切换完成命令。
   * @param {string} command.sourceId 已准备成功的目标活动源 id。
   * @param {string} command.requestId 对应 beginSourceSwitch 的请求身份。
   * @returns {Promise<object>} success 或当前更新请求的隔离 SourceManagerState。
   */
  completeSourceSwitch(command) {
    // 类型: object。
    // 作用: 切换完成只能携带目标和原请求身份，不接受 activeSourceId 直接写入。
    const safeCommand = normalizeSourceSwitchRequest(command);

    return this.#enqueueOperation(async () => {
      // 类型: object。
      // 作用: 读取 FIFO 执行时最新状态，完成决定不依赖 Runtime 启动前快照。
      const state = this.#requireInitializedState();

      // 条件分支: 当前已不是 switching，或 requestId 已被更新请求替换时进入。
      // 执行内容: 直接返回最新状态，不发布、不回滚，也不覆盖新请求结果。
      if (state.switchState.status !== SOURCE_SWITCH_STATUS.switching
        || state.switchState.requestId !== safeCommand.requestId) {
        return cloneSerializableValue(state, 'sourceManagerState');
      }

      // 条件分支: 同一 requestId 却提交不同目标时进入。
      // 执行内容: 暴露 Runtime 协调错误，不能把请求身份当成跨目标通行证。
      if (state.switchState.pendingSourceId !== safeCommand.sourceId) {
        throw new SourceManagerInvariantError('活动源切换请求身份与目标不一致');
      }

      // 类型: object。
      // 作用: 在提交瞬间重新定位目标，防止启动期间的关闭、删除或授权变化被旧记录绕过。
      const targetRecord = findRequiredSourceRecord(state, safeCommand.sourceId);
      assertSourceSelectable(state, targetRecord);

      // 类型: object。
      // 作用: 同一完整投影中一次写入活动源和成功结果，监听器不能观察半提交 activeSourceId。
      const successState = cloneSerializableValue(state, 'sourceManagerSwitchSuccessState');
      successState.activeSourceId = safeCommand.sourceId;
      successState.switchState = {
        pendingSourceId: safeCommand.sourceId,
        requestId: safeCommand.requestId,
        status: SOURCE_SWITCH_STATUS.success,
        errorMessage: ''
      };

      return this.#adoptStableState(successState);
    });
  }

  /**
   * 尝试把当前最新活动源切换收敛为失败。
   * 副作用: 加入 Manager FIFO；匹配请求发布 failed 和用户错误，activeSourceId 与原页面数据保持不变。
   * 成功路径: 当前 requestId 匹配时采用失败完成态；过期失败无发布并返回当前更新状态。
   * 失败路径: 同一 requestId 对应不同目标时抛领域错误，防止错误归属到其他切换。
   *
   * @param {object} command 切换失败命令。
   * @param {string} command.sourceId 准备失败的目标活动源 id。
   * @param {string} command.requestId 对应 beginSourceSwitch 的请求身份。
   * @param {string} command.errorMessage 面向用户的稳定失败说明。
   * @returns {Promise<object>} failed 或当前更新请求的隔离 SourceManagerState。
   */
  failSourceSwitch(command) {
    // 类型: object。
    // 作用: 在排队前把内部 Error 边界收敛为严格请求身份和用户可读文本。
    const safeCommand = normalizeSourceSwitchFailure(command);

    return this.#enqueueOperation(async () => {
      // 类型: object。
      // 作用: 使用最新状态判断失败是否仍属于当前请求。
      const state = this.#requireInitializedState();

      // 条件分支: 当前请求已经完成，或更晚 requestId 已经进入状态机时进入。
      // 执行内容: 忽略过期失败，不能让旧错误覆盖新请求的 switching/success/failed。
      if (state.switchState.status !== SOURCE_SWITCH_STATUS.switching
        || state.switchState.requestId !== safeCommand.requestId) {
        return cloneSerializableValue(state, 'sourceManagerState');
      }

      // 条件分支: 同一 requestId 的失败目标与当前 pending 目标不同。
      // 执行内容: 拒绝错误归属，保持当前请求仍可由正确协调者完成或失败。
      if (state.switchState.pendingSourceId !== safeCommand.sourceId) {
        throw new SourceManagerInvariantError('活动源切换失败身份与目标不一致');
      }

      // 类型: object。
      // 作用: 只替换切换完成状态，原 activeSourceId、记录、runtime 和 Repository 图保持不变。
      const failedState = cloneSerializableValue(state, 'sourceManagerSwitchFailedState');
      failedState.switchState = {
        pendingSourceId: safeCommand.sourceId,
        requestId: safeCommand.requestId,
        status: SOURCE_SWITCH_STATUS.failed,
        errorMessage: safeCommand.errorMessage
      };

      return this.#adoptStableState(failedState);
    });
  }

  /**
   * 设置唯一默认数据源。
   * 副作用: 通过 Unit of Work 原子保存 Preferences.defaultSourceId；不修改 runtime 或页面 store。
   * 成功路径: 目标存在、有效启用且未隐藏时返回提交后投影。
   * 失败路径: sourceId 非法、记录不存在或候选不可用时抛稳定领域错误且不提交。
   *
   * @param {string} sourceId 目标默认数据源 id。
   * @returns {Promise<object>} 提交后的隔离 SourceManagerState。
   */
  setDefaultSource(sourceId) {
    // 类型: string。
    // 作用: 在排队和 Repository 写入前完成 sourceId 动态键安全校验。
    const safeSourceId = normalizeSourceManagerId(sourceId, 'setDefaultSource.sourceId');

    // 返回值类型: Promise<object>。
    // 作用: 通过统一事务边界读取最新投影并原子保存默认源。
    return this.#runRepositoryTransaction('设置默认数据源', async ({ repositories, state, preferences }) => {
      // 类型: object。
      // 作用: 从最新事务投影定位目标记录，不使用排队前旧状态。
      const record = findRequiredSourceRecord(state, safeSourceId);

      // 执行内容: 默认源候选必须有效启用且未软隐藏。
      assertSourceSelectable(state, record);

      // 条件分支: 目标已经是当前默认源时进入。
      // 执行内容: 不重复保存 Preferences，事务仍返回稳定新投影。
      if (preferences.defaultSourceId === safeSourceId) {
        return;
      }

      // 类型: object。
      // 作用: 隔离最新 Preferences 并只修改 defaultSourceId。
      const nextPreferences = cloneSerializableValue(preferences, 'sourcePreferences');
      nextPreferences.defaultSourceId = safeSourceId;

      // 异步调用: 原子保存完整 Preferences。
      // resolve: Unit of Work 内继续重组装提交后投影。
      // reject: Unit of Work 回滚并保留原始 Repository 错误。
      await repositories.definitionRepository.savePreferences(nextPreferences);
    });
  }

  /**
   * 检测一个数据源健康状态。
   * 副作用: 加入操作 FIFO、暴露 checking 过渡态并调用健康端口；不写 Repository。
   * 成功路径: 采用 normal 或 unavailable 标准结果并返回稳定投影。
   * 失败路径: 状态收敛为 unavailable、checking 复位后抛端口领域错误。
   *
   * @param {string} sourceId 目标数据源 id。
   * @returns {Promise<object>} 检测完成后的隔离 SourceManagerState。
   * @throws {SourceManagerError} 当记录不存在、不能运行或端口失败时抛出。
   */
  checkSource(sourceId) {
    // 类型: string。
    // 作用: 在排队和端口调用前完成 sourceId 校验。
    const safeSourceId = normalizeSourceManagerId(sourceId, 'checkSource.sourceId');

    // 返回值类型: Promise<object>。
    // 作用: 单源检测进入 FIFO，避免与事务或其他检测交错覆盖 runtime。
    return this.#enqueueOperation(async () => {
      // 类型: object。
      // 作用: 从当前稳定投影定位目标记录。
      const record = findRequiredSourceRecord(this.#requireInitializedState(), safeSourceId);

      // 执行内容: 健康检测需要可执行脚本、有效授权和可见状态；用户关闭但有效的源仍可检测。
      assertSourceCanBeEnabled(this.#state, record);

      // 条件分支: 当前 Bundle 没有支持该 Definition 的受审 Provider 时进入。
      // 执行内容: 不调用健康端口，不让未解析脚本通过虚假检测覆盖就绪原因。
      if (!isSourceProviderReady(record)) {
        throw new SourceManagerInvariantError('Provider 尚未就绪，不能执行健康检测');
      }

      // 类型: Error|null。
      // 作用: 保存端口失败；成功为 null，失败时 runtime 已收敛为 unavailable。
      const portError = await this.#checkHealthRecord(record);

      try {
        // 类型: object。
        // 作用: 根据更新后的稳定 runtime 和未修改 Repository 图重组装最终投影，可靠复位 checking。
        const state = await this.#refreshStableState();

        // 条件分支: 健康端口执行失败时进入。
        // 执行内容: 在状态已经可靠收敛后向调用方抛出可追踪领域错误。
        if (portError) {
          throw portError;
        }

        // 返回值类型: object。
        // 作用: 返回健康检测成功后的隔离稳定投影。
        return state;
      } catch (error) {
        // 条件分支: 当前错误已经是端口或 SourceManager 领域错误时进入。
        // 执行内容: 原样抛出稳定 code，不重复包装。
        if (error instanceof SourceManagerError) {
          throw error;
        }

        // 错误类型: SourceManagerOperationError。
        // 作用: 包装检测后 Repository 刷新意外失败并保留 cause。
        throw new SourceManagerOperationError('健康检测状态收敛失败', error);
      }
    });
  }

  /**
   * 顺序检测全部当前有效启用数据源。
   * 副作用: 加入操作 FIFO、维护 checkingAll 和逐源 checking，并调用健康端口；不写 Repository。
   * 成功路径: 全部目标完成后返回稳定投影；单源端口失败收敛 unavailable 后继续其他源。
   * 失败路径: 投影刷新意外失败时可靠关闭 checkingAll 并抛 operation 错误。
   *
   * @returns {Promise<object>} 全部检测完成后的隔离 SourceManagerState。
   */
  checkAllSources() {
    // 返回值类型: Promise<object>。
    // 作用: 整批检测作为一个 FIFO 操作，期间不会插入偏好写事务。
    return this.#enqueueOperation(async () => {
      // 类型: object。
      // 作用: 读取当前稳定投影并作为批量检测目标快照。
      const initialState = this.#requireInitializedState();

      // 类型: Array<object>。
      // 作用: 只检测当前有效启用且 Provider 就绪的记录；关闭、授权失效、结构损坏和未解析记录不调用端口。
      const targetRecords = initialState.records.filter((record) => {
        return record.runtime.enabled && isSourceProviderReady(record);
      });

      // 类型: object。
      // 作用: 创建 checkingAll 过渡投影，供调用期间 getState 禁止重复触发。
      const checkingAllState = cloneSerializableValue(initialState, 'sourceManagerCheckingAllState');
      checkingAllState.checkingAll = true;
      this.#adoptTransientState(checkingAllState);

      try {
        // 循环类型: for...of。
        // 初始值: 第一条有效启用 SourceRecord。
        // 终止条件: 全部目标源成功或失败收敛完成。
        // 循环作用: 顺序调用健康端口，避免批量检查并发覆盖过渡状态。
        for (const record of targetRecords) {
          // 类型: Error|null。
          // 作用: 单源失败已写入稳定 runtime；批量操作忽略返回错误并继续后续记录。
          const portError = await this.#checkHealthRecord(record);

          // 条件分支: 当前单源端口失败时进入。
          // 执行内容: 不抛出中断整批；失败状态已经收敛，继续检测下一条记录。
          if (portError) {
            continue;
          }
        }

        // 返回值类型: object。
        // 作用: 使用全部检测后的 runtime 重组装稳定投影，checkingAll 和 checking 统一复位。
        return await this.#refreshStableState();
      } catch (error) {
        // 类型: object。
        // 作用: 复制当前过渡投影并强制关闭 checkingAll，避免异常路径永久锁定页面。
        const recoveredState = cloneSerializableValue(this.#state, 'sourceManagerCheckingAllRecovery');
        recoveredState.checkingAll = false;
        this.#adoptTransientState(recoveredState);

        // 条件分支: 当前错误已经是 SourceManager 领域错误时进入。
        // 执行内容: 原样抛出稳定错误。
        if (error instanceof SourceManagerError) {
          throw error;
        }

        // 错误类型: SourceManagerOperationError。
        // 作用: 包装批量检测状态收敛意外失败并保留 cause。
        throw new SourceManagerOperationError('批量健康检测失败', error);
      }
    });
  }

  /**
   * 检查一个在线导入数据源是否有可用更新。
   * 副作用: 加入操作 FIFO、维护 checkingUpdate 并调用更新端口；不写 Repository。
   * 成功路径: 采用标准更新结果并返回稳定投影。
   * 失败路径: checkingUpdate 可靠复位，保留上次成功结果并抛端口领域错误。
   *
   * @param {string} sourceId 目标在线数据源 id。
   * @returns {Promise<object>} 更新检查完成后的隔离 SourceManagerState。
   * @throws {SourceManagerError} 当记录不存在、来源不支持、结构无效或端口失败时抛出。
   */
  checkSourceUpdate(sourceId) {
    // 类型: string。
    // 作用: 在排队和端口调用前完成 sourceId 校验。
    const safeSourceId = normalizeSourceManagerId(sourceId, 'checkSourceUpdate.sourceId');

    // 返回值类型: Promise<object>。
    // 作用: 更新检查进入 FIFO，避免与脚本更新事务或其他检测交错。
    return this.#enqueueOperation(async () => {
      // 类型: object。
      // 作用: 从当前稳定投影定位目标记录。
      const record = findRequiredSourceRecord(this.#requireInitializedState(), safeSourceId);

      // 条件分支: 目标不是 remote 在线导入数据源时进入。
      // 执行内容: 拒绝没有远程更新语义的系统、文件或文本来源。
      if (record.definition.importMethod !== IMPORT_METHOD.remote) {
        throw new SourceManagerInvariantError('只有在线导入数据源支持更新检查');
      }

      // 条件分支: 目标没有已验证脚本指纹时进入。
      // 执行内容: 拒绝结构损坏记录执行远程更新比较。
      if (!record.runtime.currentScriptHash) {
        throw new SourceManagerInvariantError('数据源结构或脚本完整性无效，不能检查更新');
      }

      // 类型: object。
      // 作用: 创建 checkingUpdate 过渡投影，供调用期间 getState 禁止重复触发。
      const checkingState = cloneSerializableValue(this.#state, 'sourceManagerUpdateCheckingState');

      // 类型: object。
      // 作用: 定位过渡投影目标记录并设置更新检查过程状态。
      const checkingRecord = findRequiredSourceRecord(checkingState, safeSourceId);
      checkingRecord.runtime.checkingUpdate = true;
      this.#adoptTransientState(checkingState);

      try {
        // 类型: object。
        // 作用: 保存更新端口标准结果，门面已经校验 Boolean、版本和时间组合。
        const result = await this.#updateCheckPort.check(
          cloneSerializableValue(record, `updateCheckRecord.${safeSourceId}`)
        );

        // 副作用: 把更新检查完成结果写入稳定会话 runtime，Repository 保持不变。
        // 影响范围: 当前 sourceId 更新字段，不修改健康和 Provider 状态。
        this.#patchRuntimeState(safeSourceId, {
          updateAvailable: result.updateAvailable,
          availableVersion: result.availableVersion,
          availableVersionUpdatedAt: result.availableVersionUpdatedAt,
          lastUpdateCheckedAt: result.checkedAt
        });

        // 返回值类型: object。
        // 作用: 使用更新后的 runtime 重组装稳定投影并复位 checkingUpdate。
        return await this.#refreshStableState();
      } catch (error) {
        try {
          // 执行内容: 使用未改变的稳定 runtime 重组装投影，可靠复位 checkingUpdate 并保留上次结果。
          await this.#refreshStableState();
        } catch (refreshError) {
          // 错误类型: SourceManagerOperationError。
          // 作用: 状态复位失败优先报告并保留端口错误作为 cause 上下文。
          throw new SourceManagerOperationError('更新检测状态复位失败', {
            portError: error,
            refreshError
          });
        }

        // 条件分支: 当前错误已经是端口或 SourceManager 领域错误时进入。
        // 执行内容: 在 checkingUpdate 已复位后原样抛出稳定错误。
        if (error instanceof SourceManagerError) {
          throw error;
        }

        // 错误类型: SourceManagerOperationError。
        // 作用: 包装未知更新端口失败并保留 cause。
        throw new SourceManagerOperationError('在线更新检测失败', error);
      }
    });
  }

  /**
   * 原子启用或关闭一个数据源。
   * 副作用: 通过 Unit of Work 保存 Preferences.enabled 和必要默认源交接；不直接启动 Provider。
   * 成功路径: 返回提交后轻量投影；无默认源时首次明确启用的有效源成为默认源。
   * 失败路径: 命令、授权、结构、软隐藏或交接不变量失败时不提交。
   *
   * @param {object} command 启停命令。
   * @param {string} command.sourceId 目标数据源 id。
   * @param {boolean} command.enabled true 启用，false 关闭。
   * @param {object} command.handoff 关闭当前默认源时的 replace/clear 交接。
   * @returns {Promise<object>} 提交后的隔离 SourceManagerState。
   */
  setSourceEnabled(command) {
    // 类型: object。
    // 作用: 在排队前严格隔离并校验 sourceId、Boolean 和可选 handoff。
    const safeCommand = normalizeSetSourceEnabledCommand(command);

    // 返回值类型: Promise<object>。
    // 作用: 通过统一事务边界基于最新 Preferences 执行启停和默认源变化。
    return this.#runRepositoryTransaction('设置数据源启停状态', async ({ repositories, state, preferences }) => {
      // 类型: object。
      // 作用: 从最新事务投影定位目标记录。
      const record = findRequiredSourceRecord(state, safeCommand.sourceId);

      // 类型: object。
      // 作用: 隔离最新 Preferences，所有字段修改完成后一次性保存。
      const nextPreferences = cloneSerializableValue(preferences, 'sourcePreferences');

      // 条件分支: 用户明确启用目标源时进入。
      // 执行内容: 校验结构、授权和可见性，并禁止携带与启用无关的 handoff。
      if (safeCommand.enabled) {
        // 条件分支: 启用命令携带默认源交接时进入。
        // 执行内容: 拒绝与启用无关的 handoff，避免暗中修改已有默认源。
        if (safeCommand.handoff !== null) {
          throw new SourceManagerValidationError('启用数据源不能提交默认源 handoff');
        }

        assertSourceCanBeEnabled(state, record);
        nextPreferences.sourceStates[safeCommand.sourceId].enabled = true;

        // 条件分支: 当前没有默认源且目标 Provider 已就绪时进入。
        // 执行内容: 只有实际可执行记录才能成为自动默认源；未解析源仍保存 enabled 用户决定。
        if (!state.defaultSourceId && isSourceProviderReady(record)) {
          nextPreferences.defaultSourceId = safeCommand.sourceId;
        }
      } else {
        // 类型: string。
        // 作用: 关闭当前默认源时消费明确交接；不影响默认源时保留原 id。
        const nextDefaultSourceId = resolveDefaultSourceHandoff(
          state,
          [safeCommand.sourceId],
          safeCommand.handoff
        );

        nextPreferences.sourceStates[safeCommand.sourceId].enabled = false;
        nextPreferences.defaultSourceId = nextDefaultSourceId;
      }

      // 异步调用: 一次性保存完整 Preferences 候选。
      // resolve: Unit of Work 内继续重组装提交后投影。
      // reject: Unit of Work 回滚并保留原始 Repository 错误。
      await repositories.definitionRepository.savePreferences(nextPreferences);
    });
  }

  /**
   * 原子授权一个自定义数据源，并可选择同时启用。
   * 副作用: 通过 Unit of Work 保存当前版本/指纹授权快照和 enabled；不执行脚本文本。
   * 成功路径: 返回提交后轻量投影；同时启用且无默认源时把目标设为默认源。
   * 失败路径: 命令、来源类型或脚本完整性不符合契约时不提交。
   *
   * @param {object} command 授权命令。
   * @param {string} command.sourceId 目标自定义源 id。
   * @param {string} command.authorizedAt 用户确认的标准 UTC ISO 时间。
   * @param {boolean} command.enableAfterAuthorization true 授权并启用，false 只授权并保持关闭。
   * @returns {Promise<object>} 提交后的隔离 SourceManagerState。
   */
  authorizeSource(command) {
    // 类型: object。
    // 作用: 在排队前严格隔离并校验 sourceId、时间和同时启用 Boolean。
    const safeCommand = normalizeAuthorizeSourceCommand(command);

    // 返回值类型: Promise<object>。
    // 作用: 通过统一事务边界基于最新版本和指纹创建授权快照。
    return this.#runRepositoryTransaction('授权自定义数据源', async ({ repositories, state, preferences }) => {
      // 类型: object。
      // 作用: 从最新事务投影定位目标记录。
      const record = findRequiredSourceRecord(state, safeCommand.sourceId);

      // 类型: object。
      // 作用: 使用当前 Definition.version 和已验证指纹生成 authorized 快照。
      const authorization = createAuthorizedSourceSnapshot(record, safeCommand.authorizedAt);

      // 类型: object。
      // 作用: 隔离最新 Preferences，并原子更新授权与明确启用决定。
      const nextPreferences = cloneSerializableValue(preferences, 'sourcePreferences');
      nextPreferences.sourceStates[safeCommand.sourceId].authorization = authorization;
      nextPreferences.sourceStates[safeCommand.sourceId].enabled = safeCommand.enableAfterAuthorization;

      // 条件分支: 用户选择授权后启用、当前没有默认源且目标 Provider 已就绪时进入。
      // 执行内容: 可执行记录成为默认源；未解析脚本只保存授权和 enabled 决定。
      if (safeCommand.enableAfterAuthorization
        && !state.defaultSourceId
        && isSourceProviderReady(record)) {
        nextPreferences.defaultSourceId = safeCommand.sourceId;
      }

      // 异步调用: 一次性保存授权、启用和可能的默认源候选。
      // resolve: Unit of Work 内继续重组装提交后投影。
      // reject: Unit of Work 回滚并保留原始 Repository 错误。
      await repositories.definitionRepository.savePreferences(nextPreferences);
    });
  }

  /**
   * 原子撤销一个自定义数据源授权并关闭运行权限。
   * 副作用: 通过 Unit of Work 保存 revoked、enabled false 和必要默认源交接。
   * 成功路径: 返回提交后轻量投影，并保留最近授权时间、版本和指纹供诊断。
   * 失败路径: 来源类型或默认源交接不符合契约时不提交。
   *
   * @param {object} command 撤销授权命令。
   * @param {string} command.sourceId 目标自定义源 id。
   * @param {object} command.handoff 目标是默认源时的 replace/clear 交接。
   * @returns {Promise<object>} 提交后的隔离 SourceManagerState。
   */
  revokeSourceAuthorization(command) {
    // 类型: object。
    // 作用: 在排队前严格隔离并校验 sourceId 和可选 handoff。
    const safeCommand = normalizeRevokeSourceAuthorizationCommand(command);

    // 返回值类型: Promise<object>。
    // 作用: 通过统一事务边界基于最新授权和默认源状态执行撤销。
    return this.#runRepositoryTransaction('撤销自定义数据源授权', async ({ repositories, state, preferences }) => {
      // 类型: object。
      // 作用: 从最新事务投影定位目标记录并确认它是自定义源。
      const record = assertCustomSourceRecord(
        findRequiredSourceRecord(state, safeCommand.sourceId)
      );

      // 类型: string。
      // 作用: 目标是默认源时消费明确交接；其他情况保留现有 defaultSourceId。
      const nextDefaultSourceId = resolveDefaultSourceHandoff(
        state,
        [safeCommand.sourceId],
        safeCommand.handoff
      );

      // 类型: object。
      // 作用: 隔离最新 Preferences，并原子保存 revoked、关闭和默认源结果。
      const nextPreferences = cloneSerializableValue(preferences, 'sourcePreferences');
      nextPreferences.sourceStates[safeCommand.sourceId].authorization = createRevokedSourceSnapshot(record);
      nextPreferences.sourceStates[safeCommand.sourceId].enabled = false;
      nextPreferences.defaultSourceId = nextDefaultSourceId;

      // 异步调用: 一次性保存完整 Preferences 候选。
      // resolve: Unit of Work 内继续重组装提交后投影。
      // reject: Unit of Work 回滚并保留原始 Repository 错误。
      await repositories.definitionRepository.savePreferences(nextPreferences);
    });
  }

  /**
   * 恢复一个或多个软隐藏系统源。
   * 副作用: 通过 Unit of Work 从 removedSystemSourceIds 移除目标；不重建包、定义、偏好节点或 Storage。
   * 成功路径: 返回提交后轻量投影；恢复后不自动启用或设为默认源。
   * 失败路径: sourceIds 非法、记录不存在或目标不是系统源时不提交。
   *
   * @param {Array<string>} sourceIds 待恢复系统源 id 集合。
   * @returns {Promise<object>} 提交后的隔离 SourceManagerState。
   */
  restoreSystemSources(sourceIds) {
    // 类型: Array<string>。
    // 作用: 在排队前严格校验、去重并隔离恢复目标集合，非数组和空集合直接失败。
    const safeSourceIds = normalizeRestoreSystemSourceIds(sourceIds);

    // 返回值类型: Promise<object>。
    // 作用: 通过统一事务边界基于最新软隐藏集合执行恢复。
    return this.#runRepositoryTransaction('恢复系统数据源', async ({ repositories, state, preferences }) => {
      // 循环类型: for...of。
      // 初始值: 第一个恢复目标 sourceId。
      // 终止条件: 全部目标存在且属于系统源。
      // 循环作用: 在任何 Preferences 写入前完整验证整批恢复目标。
      for (const sourceId of safeSourceIds) {
        // 类型: object。
        // 作用: 从最新事务投影定位恢复目标。
        const record = findRequiredSourceRecord(state, sourceId);

        // 条件分支: 恢复目标不是系统源时进入。
        // 执行内容: 拒绝把自定义源当作软隐藏记录恢复。
        if (record.definition.sourceKind !== SOURCE_KIND.system) {
          throw new SourceManagerInvariantError('只有系统数据源支持软隐藏恢复');
        }
      }

      // 类型: object。
      // 作用: 隔离最新 Preferences，只修改软隐藏集合。
      const nextPreferences = cloneSerializableValue(preferences, 'sourcePreferences');
      nextPreferences.removedSystemSourceIds = nextPreferences.removedSystemSourceIds
        .filter(sourceId => !safeSourceIds.includes(sourceId));

      // 异步调用: 一次性保存恢复后的完整 Preferences。
      // resolve: Unit of Work 内继续重组装提交后投影。
      // reject: Unit of Work 回滚并保留原始 Repository 错误。
      await repositories.definitionRepository.savePreferences(nextPreferences);
    });
  }

  /**
   * 清理一个数据源的临时缓存。
   * 副作用: 在同一 Unit of Work 中清空 cache 和 diagnostics，并重新读取真实 usage。
   * 成功路径: 返回缓存摘要重新派生后的轻量投影。
   * 失败路径: 任一分区清理失败时 Unit of Work 回滚且旧投影保持不变。
   *
   * @param {string} sourceId 目标数据源 id。
   * @returns {Promise<object>} 提交后的隔离 SourceManagerState。
   */
  clearTemporarySourceCache(sourceId) {
    // 类型: string。
    // 作用: 在排队前完成目标 sourceId 动态键安全校验。
    const safeSourceId = normalizeSourceManagerId(sourceId, 'clearTemporarySourceCache.sourceId');

    // 返回值类型: Promise<object>。
    // 作用: 两个临时分区清理统一进入一笔跨仓回滚边界。
    return this.#runRepositoryTransaction('清理数据源临时缓存', async ({ repositories, state }) => {
      // 执行内容: 清理前要求目标 Definition 存在；系统源软隐藏不影响其私有空间清理能力。
      findRequiredSourceRecord(state, safeSourceId);

      // 异步调用: 清空 cache 分区。
      // resolve: 继续清空 diagnostics。
      // reject: Unit of Work 回滚已完成的任何分区清理。
      await repositories.storageRepository.clear(safeSourceId, SOURCE_STORAGE_PARTITION.cache);

      // 异步调用: 清空 diagnostics 分区。
      // resolve: 事务内重新读取 usage 并组装投影。
      // reject: Unit of Work 恢复 cache 和 diagnostics 事务前状态。
      await repositories.storageRepository.clear(safeSourceId, SOURCE_STORAGE_PARTITION.diagnostics);
    });
  }

  /**
   * 清理一个数据源的全部运行缓存并保留普通设置。
   * 副作用: 在 Unit of Work 中清空 credentials、session、cache 和 diagnostics，并重新读取真实 usage。
   * 成功路径: 返回缓存摘要重新派生后的轻量投影，settings 保持不变。
   * 失败路径: 清理失败时 Unit of Work 回滚且旧投影保持不变。
   *
   * @param {string} sourceId 目标数据源 id。
   * @returns {Promise<object>} 提交后的隔离 SourceManagerState。
   */
  clearAllSourceCache(sourceId) {
    // 类型: string。
    // 作用: 在排队前完成目标 sourceId 动态键安全校验。
    const safeSourceId = normalizeSourceManagerId(sourceId, 'clearAllSourceCache.sourceId');

    // 返回值类型: Promise<object>。
    // 作用: 四个运行分区清理统一进入一笔跨仓回滚边界。
    return this.#runRepositoryTransaction('清理数据源全部缓存', async ({ repositories, state }) => {
      // 执行内容: 清理前要求目标 Definition 存在；不修改脚本、授权、启用或默认源。
      findRequiredSourceRecord(state, safeSourceId);

      // 异步调用: 调用 Repository clearAll，只清理四个运行分区并保留 settings。
      // resolve: 事务内重新读取真实 usage 并组装投影。
      // reject: Unit of Work 恢复完整私有空间事务前状态。
      await repositories.storageRepository.clearAll(safeSourceId);
    });
  }

  /**
   * 原子安装一个已经标准化的自定义数据源。
   * 副作用: 在同一 Unit of Work 中保存 Package、Definition、Preferences.sourceStates 和普通 settings。
   * 成功路径: 新源按用户确认写入 authorized 与明确 enabled 决定，不自动设为默认源。
   * 失败路径: 任一冲突、关联、私有空间或 Repository 写入失败时完整回滚。
   *
   * @param {object} command 标准导入命令。
   * @param {object} command.sourcePackage 完整 SourcePackage。
   * @param {object} command.sourceDefinition 完整自定义 SourceDefinition。
   * @param {object} command.settings 普通非敏感设置键值对象。
   * @param {string} command.authorizedAt 用户确认当前脚本风险的标准 UTC 时间。
   * @param {boolean} command.enableAfterImport true 同时启用；false 保存授权但保持关闭。
   * @returns {Promise<object>} 安装提交后的隔离 SourceManagerState。
   */
  importSource(command) {
    // 类型: object。
    // 作用: 在排队前完成保存对象、SHA-256、settings、授权时间和启用决定校验。
    const safeCommand = normalizeImportSourceCommand(command);

    // 返回值类型: Promise<object>。
    // 作用: 四个保存域通过统一事务边界原子安装，任何失败不会留下孤立对象。
    return this.#runRepositoryTransaction('导入数据源', async ({
      repositories,
      state,
      preferences
    }) => {
      // 类型: string。
      // 作用: 使用 Definition.id 作为 Package、偏好、Storage 和投影的统一数据源身份。
      const sourceId = safeCommand.sourceDefinition.id;

      // 条件分支: 最新 Repository 图已经存在同 sourceId Definition 时进入。
      // 执行内容: 拒绝默认覆盖，已有源更新必须使用 applySourceUpdate。
      if (state.records.some(record => record.definition.id === sourceId)) {
        throw new SourceManagerInvariantError(`数据源已经存在: ${sourceId}`);
      }

      // 类型: Array<object>。
      // 作用: 读取全部现有 Package，检测孤立包和 packageRef 冲突，避免导入覆盖未关联保存对象。
      const existingPackages = await repositories.packageRepository.loadAll();

      // 条件分支: 现有 Package 已使用相同 packageRef 或 sourceId 时进入。
      // 执行内容: 拒绝覆盖孤立或冲突包，要求先修复 Repository 状态。
      if (existingPackages.some(sourcePackage => sourcePackage.packageRef === safeCommand.sourcePackage.packageRef
        || sourcePackage.sourceId === sourceId)) {
        throw new SourceManagerInvariantError('导入数据源与现有 Package 身份冲突');
      }

      // 条件分支: Preferences 已经存在同 sourceId 孤立状态时进入。
      // 执行内容: 拒绝静默覆盖用户授权或启用决定。
      if (Object.hasOwn(preferences.sourceStates, sourceId)) {
        throw new SourceManagerInvariantError('导入数据源与现有 Preferences 状态冲突');
      }

      // 类型: object。
      // 作用: 读取目标命名空间当前容量，非零表示存在不能被导入覆盖的孤立私有数据。
      const existingUsage = await repositories.storageRepository.getUsage(sourceId);

      // 条件分支: 目标 sourceId 已经保存任何私有空间数据时进入。
      // 执行内容: 拒绝导入覆盖可能包含设置、凭据、会话或缓存的孤立命名空间。
      if (existingUsage.totalStorageBytes > 0) {
        throw new SourceManagerInvariantError('导入数据源与现有私有空间冲突');
      }

      // 类型: object。
      // 作用: 隔离最新 Preferences，增加与当前版本和 SHA-256 匹配的用户授权及明确启用决定。
      const nextPreferences = cloneSerializableValue(preferences, 'sourcePreferences');
      nextPreferences.sourceStates[sourceId] = {
        enabled: safeCommand.enableAfterImport,
        authorization: createAuthorizedSourceImportSnapshot(
          safeCommand.sourcePackage,
          safeCommand.sourceDefinition,
          safeCommand.authorizedAt
        )
      };

      // 异步调用: 保存脚本包。
      // resolve: 继续保存 Definition；reject: Unit of Work 回滚全部已写对象。
      await repositories.packageRepository.save(safeCommand.sourcePackage);

      // 异步调用: 保存数据源定义。
      // resolve: 继续保存偏好；reject: Unit of Work 回滚 Package。
      await repositories.definitionRepository.saveDefinition(safeCommand.sourceDefinition);

      // 异步调用: 保存新增每源状态后的完整 Preferences。
      // resolve: 继续保存普通 settings；reject: Unit of Work 回滚 Package 和 Definition。
      await repositories.definitionRepository.savePreferences(nextPreferences);

      // 循环类型: for...of Object.entries。
      // 初始值: settings 第一个普通键值。
      // 终止条件: 全部普通设置保存完成；空对象时不创建无意义占位键。
      // 循环作用: 使用正式 Storage 接口逐键保存设置，动态键和 JSON Value 继续由 Repository 校验。
      for (const [settingKey, settingValue] of Object.entries(safeCommand.settings)) {
        await repositories.storageRepository.set(
          sourceId,
          SOURCE_STORAGE_PARTITION.settings,
          settingKey,
          settingValue
        );
      }
    });
  }

  /**
   * 原子应用一个数据源 Package 和 Definition 更新。
   * 副作用: 在同一 Unit of Work 中替换包和定义、必要时使自定义授权失效并更新候选 runtime。
   * 成功路径: sourceId 和身份字段保持稳定；更新检查结果清空，settings 与其他私有空间保持不变。
   * 失败路径: 身份变化、默认源交接、完整性或 Repository 写入失败时保留旧包、定义、偏好和投影。
   *
   * @param {object} command 标准更新命令。
   * @param {string} command.sourceId 稳定目标数据源 id。
   * @param {object} command.sourcePackage 下一 SourcePackage。
   * @param {object} command.sourceDefinition 下一 SourceDefinition。
   * @param {object} command.handoff 更新使默认自定义源关闭时的 replace/clear 交接。
   * @returns {Promise<object>} 更新提交后的隔离 SourceManagerState。
   */
  applySourceUpdate(command) {
    // 类型: object。
    // 作用: 在排队前完成下一包定义、指纹、sourceId 和可选交接校验。
    const safeCommand = normalizeApplySourceUpdateCommand(command);

    // 返回值类型: Promise<object>。
    // 作用: 包、定义、偏好和候选 runtime 在同一领域事务中共同收敛。
    return this.#runRepositoryTransaction('应用数据源更新', async ({
      repositories,
      state,
      preferences,
      runtimeBySourceId
    }) => {
      // 类型: object。
      // 作用: 从最新事务投影定位当前记录，不能使用排队前 Definition。
      const currentRecord = findRequiredSourceRecord(state, safeCommand.sourceId);

      // 类型: Array<string>。
      // 作用: 找出更新命令试图改变的稳定身份字段，任何命中都拒绝隐式重新导入。
      const changedIdentityFields = SOURCE_UPDATE_STABLE_DEFINITION_FIELDS.filter((field) => {
        return currentRecord.definition[field] !== safeCommand.sourceDefinition[field];
      });

      // 条件分支: 下一 Definition 改变任一稳定身份字段时进入。
      // 执行内容: 拒绝更新改变来源类型、Provider、包引用、导入方式、URL 或首次导入时间。
      if (changedIdentityFields.length > 0) {
        throw new SourceManagerInvariantError(
          `数据源更新不能改变身份字段: ${changedIdentityFields.join(', ')}`
        );
      }

      // 条件分支: 当前 Preferences 缺少目标每源状态时进入。
      // 执行内容: 拒绝在损坏偏好上猜测 enabled 或授权决定。
      if (!Object.hasOwn(preferences.sourceStates, safeCommand.sourceId)) {
        throw new SourceManagerInvariantError('数据源更新缺少当前 Preferences 状态');
      }

      // 类型: object|null。
      // 作用: 读取当前保存包，用于判断脚本文本指纹是否真实变化；缺包更新可以修复结构但必须失效自定义授权。
      const currentPackage = await repositories.packageRepository.get(currentRecord.packageRef);

      // 类型: boolean。
      // 作用: 判断唯一业务版本是否变化，变化后的自定义源必须重新授权。
      const versionChanged = currentRecord.definition.version !== safeCommand.sourceDefinition.version;

      // 类型: boolean。
      // 作用: 比较当前保存声明与已验证新指纹；缺失当前包也按脚本变化处理。
      const scriptChanged = currentPackage === null
        || currentPackage.integrity.scriptHash !== safeCommand.sourcePackage.integrity.scriptHash;

      // 类型: boolean。
      // 作用: 只有自定义源版本或脚本变化会使用户授权失效；系统源不需要用户授权。
      const invalidatesAuthorization = currentRecord.definition.sourceKind === SOURCE_KIND.custom
        && (versionChanged || scriptChanged);

      // 类型: string。
      // 作用: 授权失效时解析明确交接；不关闭目标时直接保留当前默认源。
      let nextDefaultSourceId = state.defaultSourceId;

      // 条件分支: 当前更新会使自定义源授权失效并关闭时进入。
      // 执行内容: 只有该路径可能影响默认源，并通过统一交接门禁解析 replace/clear。
      if (invalidatesAuthorization) {
        nextDefaultSourceId = resolveDefaultSourceHandoff(
          state,
          [safeCommand.sourceId],
          safeCommand.handoff
        );
      } else {
        // 条件分支: 更新不关闭目标但调用方仍提交 handoff 时进入。
        // 执行内容: 拒绝借元数据或系统源更新暗中改变默认源。
        if (safeCommand.handoff !== null) {
          throw new SourceManagerValidationError('当前更新不影响默认源，不能提交 handoff');
        }
      }

      // 类型: object。
      // 作用: 隔离最新 Preferences，必要时关闭自定义源并把授权转为 pending。
      const nextPreferences = cloneSerializableValue(preferences, 'sourcePreferences');
      nextPreferences.defaultSourceId = nextDefaultSourceId;

      // 条件分支: 新版本或脚本使自定义源旧授权失效时进入。
      // 执行内容: 同一事务内关闭目标并保留最近授权诊断字段。
      if (invalidatesAuthorization) {
        nextPreferences.sourceStates[safeCommand.sourceId].enabled = false;
        nextPreferences.sourceStates[safeCommand.sourceId].authorization = createPendingSourceAuthorizationSnapshot(
          safeCommand.sourcePackage,
          safeCommand.sourceDefinition,
          currentRecord.authorization
        );
      }

      // 异步调用: upsert 稳定 packageRef 对应的新脚本包。
      // resolve: 继续保存 Definition；reject: Unit of Work 保留旧 Package。
      await repositories.packageRepository.save(safeCommand.sourcePackage);

      // 异步调用: upsert 同 sourceId 的下一 Definition。
      // resolve: 继续保存 Preferences；reject: Unit of Work 回滚 Package。
      await repositories.definitionRepository.saveDefinition(safeCommand.sourceDefinition);

      // 异步调用: 保存授权、启用和默认源候选。
      // resolve: 事务内重组装；reject: Unit of Work 回滚 Package 和 Definition。
      await repositories.definitionRepository.savePreferences(nextPreferences);

      // 类型: object。
      // 作用: 读取事务专属稳定 runtime 候选，更新成功后清除已经消费的可用版本提示。
      const runtimeState = runtimeBySourceId[safeCommand.sourceId];

      // 条件分支: 当前 runtime 候选包含目标 sourceId 时进入。
      // 执行内容: 清除有更新结果但保留最近检查时间、健康和 Provider 状态。
      if (runtimeState) {
        runtimeState.updateAvailable = false;
        runtimeState.availableVersion = '';
        runtimeState.availableVersionUpdatedAt = '';
      }
    });
  }

  /**
   * 原子删除系统源和自定义源混合目标集合。
   * 副作用: 系统源写入软隐藏集合；自定义源删除 Package、Definition、Preferences 状态、完整 Storage 和候选 runtime。
   * 成功路径: 整批验证后一次提交，默认源交接候选必须位于整批目标之外。
   * 失败路径: 任一目标、交接或 Repository 操作失败时整批回滚，不返回部分成功。
   *
   * @param {object} command 混合批量删除命令。
   * @param {Array<string>} command.sourceIds 待删除 sourceId 集合。
   * @param {object} command.handoff 整批包含当前默认源时的 replace/clear 交接。
   * @returns {Promise<object>} 整批提交后的隔离 SourceManagerState。
   */
  deleteSources(command) {
    // 类型: object。
    // 作用: 在排队前严格校验、去重并隔离 sourceIds 和可选交接。
    const safeCommand = normalizeDeleteSourcesCommand(command);

    // 返回值类型: Promise<object>。
    // 作用: 系统软隐藏和自定义物理删除统一进入一笔跨仓事务。
    return this.#runRepositoryTransaction('删除数据源', async ({
      repositories,
      state,
      preferences,
      runtimeBySourceId
    }) => {
      // 类型: Array<object>。
      // 作用: 在任何写入前定位完整目标集合；任一不存在都会终止整批。
      const records = safeCommand.sourceIds.map(sourceId => findRequiredSourceRecord(state, sourceId));

      // 类型: string。
      // 作用: 基于整批目标解析默认源结果，replace 候选不能属于本次删除范围。
      const nextDefaultSourceId = resolveDefaultSourceHandoff(
        state,
        safeCommand.sourceIds,
        safeCommand.handoff
      );

      // 类型: object。
      // 作用: 隔离最新 Preferences，统一保存软隐藏、自定义状态删除和默认源交接。
      const nextPreferences = cloneSerializableValue(preferences, 'sourcePreferences');
      nextPreferences.defaultSourceId = nextDefaultSourceId;

      // 类型: Set<string>。
      // 作用: 合并已有软隐藏系统源和本批系统目标，避免重复 id。
      const removedSystemSourceIds = new Set(nextPreferences.removedSystemSourceIds);

      // 循环类型: for...of。
      // 初始值: 整批第一条已验证 SourceRecord。
      // 终止条件: 全部系统源软隐藏或自定义源物理删除完成。
      // 循环作用: 按来源类型执行不同删除语义，任何失败由 Unit of Work 回滚整批。
      for (const record of records) {
        // 类型: string。
        // 作用: 使用 Definition.id 作为偏好、Storage、runtime 和 Repository 删除的统一身份。
        const sourceId = record.definition.id;

        // 条件分支: 当前记录是系统源时进入。
        // 执行内容: 只追加软隐藏 id，保留 Package、Definition、每源偏好和完整 Storage。
        if (record.definition.sourceKind === SOURCE_KIND.system) {
          removedSystemSourceIds.add(sourceId);
          continue;
        }

        // 异步调用: 删除自定义源当前 Package；缺包失败关闭记录允许返回 false 并继续清理其他保存域。
        await repositories.packageRepository.remove(record.packageRef);

        // 异步调用: 删除自定义 SourceDefinition；失败抛错时整批回滚。
        await repositories.definitionRepository.removeDefinition(sourceId);

        // 异步调用: 删除自定义源完整五分区命名空间；未创建空间时允许返回 false。
        await repositories.storageRepository.removeSource(sourceId);

        // 副作用范围: 只删除事务候选 Preferences 中目标状态，提交前不影响 Manager 或 Repository 当前投影。
        delete nextPreferences.sourceStates[sourceId];

        // 副作用范围: 只删除事务候选 runtime；失败时整份候选丢弃。
        delete runtimeBySourceId[sourceId];
      }

      // 类型: Array<string>。
      // 作用: 按原软隐藏顺序加本批系统源，形成无重复的最终集合。
      nextPreferences.removedSystemSourceIds = [...removedSystemSourceIds];

      // 异步调用: 一次性保存整批删除后的完整 Preferences。
      // resolve: 事务内从剩余定义重组装；reject: Unit of Work 恢复全部删除对象。
      await repositories.definitionRepository.savePreferences(nextPreferences);
    });
  }

  /**
   * 创建一个或多个数据源的最小脚本导出包。
   * 副作用: 加入 SourceManager FIFO 并只读 Repository；不创建 Blob、对象 URL、文件或下载行为。
   * 成功路径: 按调用方 sourceIds 顺序返回 schemaVersion、exportedAt 和最小 sources 数组。
   * 失败路径: 未命中、缺包或脚本完整性失败时抛稳定领域错误，不返回部分导出。
   *
   * @param {object} command 最小导出命令。
   * @param {Array<string>} command.sourceIds 待导出 sourceId 集合。
   * @param {string} command.exportedAt 标准 UTC ISO 导出时间。
   * @returns {Promise<object>} 与 Repository 和 Manager 引用隔离的最小导出包。
   */
  createSourceExportBundle(command) {
    // 类型: object。
    // 作用: 在排队前校验目标集合、时间和禁止的额外选项。
    const safeCommand = normalizeSourceExportCommand(command);

    // 返回值类型: Promise<object>。
    // 作用: 导出查询进入 Manager FIFO，等待前序写事务完成后读取一致最新保存图。
    return this.#enqueueOperation(async () => {
      // 执行内容: 导出只允许在 Manager 已经建立过安全投影后执行。
      this.#requireInitializedState();

      try {
        // 类型: object。
        // 作用: 从当前 Repository、稳定 runtime 和活动源读取最新安全投影，不采用为 Manager 新状态。
        const projection = await loadSourceManagerRepositoryProjection(
          this.#createRepositoryContext(),
          this.#providerReadinessPort,
          this.#runtimeBySourceId,
          this.#activeSourceId,
          this.#switchState
        );

        // 类型: Array<object>。
        // 作用: 按调用方顺序生成最小脚本条目，任一失败都会终止整个导出查询。
        const sources = [];

        // 循环类型: for...of。
        // 初始值: 第一个已规范化 sourceId。
        // 终止条件: 全部目标关联到有效 Package 并生成最小条目。
        // 循环作用: 严格按请求顺序读取 Definition 和脚本文本，不携带任何偏好或私有空间。
        for (const sourceId of safeCommand.sourceIds) {
          // 类型: object。
          // 作用: 从最新安全投影定位目标记录，未命中抛稳定 notFound。
          const record = findRequiredSourceRecord(projection.state, sourceId);

          // 条件分支: 当前记录没有已验证脚本指纹时进入。
          // 执行内容: 拒绝导出缺包、关联失配或完整性失败的脚本文本。
          if (!record.runtime.currentScriptHash) {
            throw new SourceManagerInvariantError(`数据源脚本完整性无效，不能导出: ${sourceId}`);
          }

          // 类型: object|null。
          // 作用: 按轻量记录 packageRef 读取当前 SourcePackage，脚本文本只在导出边界短暂使用。
          const sourcePackage = await this.#packageRepository.get(record.packageRef);

          // 条件分支: 最新投影记录无法读取到当前 Package 时进入。
          // 执行内容: 拒绝返回缺失脚本文本的部分导出包。
          if (!sourcePackage) {
            throw new SourceManagerInvariantError(`数据源 Package 不存在，不能导出: ${sourceId}`);
          }

          // 副作用范围: 只向当前函数局部 sources 数组追加最小导出条目。
          sources.push({
            id: record.definition.id,
            name: record.definition.name,
            version: record.definition.version,
            scriptContent: sourcePackage.scriptContent
          });
        }

        // 返回值类型: object。
        // 作用: 严格隔离最小导出包，调用方修改结果不会穿透 Repository 读取对象。
        return cloneSerializableValue({
          schemaVersion: SOURCE_EXPORT_SCHEMA_VERSION,
          exportedAt: safeCommand.exportedAt,
          sources
        }, 'sourceExportBundle');
      } catch (error) {
        // 条件分支: 当前错误已经属于 SourceManager 稳定领域边界时进入。
        // 执行内容: 原样抛出 notFound 或 invariant，调用方不解析中文文案。
        if (error instanceof SourceManagerError) {
          throw error;
        }

        // 错误类型: SourceManagerOperationError。
        // 作用: 包装 Repository 读取意外失败并保留原始 cause。
        throw new SourceManagerOperationError('创建数据源导出包失败', error);
      }
    });
  }
}
