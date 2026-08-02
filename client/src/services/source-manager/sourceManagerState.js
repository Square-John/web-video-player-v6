/*
  sourceManagerState.js 模块说明

  - 文件职责:
      把 Repository 图、Storage usage 和当前会话运行态组装为轻量 SourceManagerState。
      集中执行包关联、Provider、完整性、偏好、授权、软隐藏、活动源和默认源失败关闭。
      区分包图结构损坏与授权失效，避免把“需要用户重新授权”误报成“数据源不可用”。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      领域枚举与摘要算法: 自定义配置，提供授权、健康、Provider、来源类型、切换状态和 SHA-256 稳定值。
      SOURCE_STORAGE_PARTITION、cloneSerializableValue: 自定义工具，冻结五分区名称并隔离 Repository 输入和状态输出。
      assertPlainObject、assertSafeRecordKey: 自定义校验，约束动态记录和普通对象边界。
      createSourceScriptHash、evaluateSourceAuthorizationFingerprint: 自定义授权工具，验证脚本完整性和授权快照。
      SourceManagerInitializationError、SourceManagerValidationError: 自定义错误，表达组装输入和整体初始化失败。
      validateSourceProviderReadinessResult: 自定义端口结果校验，保证会话就绪投影字段和组合严格有效。

  - 模块级常量:
      SOURCE_RECORD_FAILURE_REASON: object，单记录失败关闭原因枚举。
      SOURCE_STRUCTURAL_FAILURE_REASONS: Set<string>，会使 Provider 和健康状态失败关闭的结构原因。
      SOURCE_STABLE_RUNTIME_FIELDS: Array<string>，允许跨 Repository 重组装保留的稳定会话字段。
      SOURCE_RUNTIME_STRING_FIELDS: Array<string>，初始运行态字符串字段。
      SOURCE_MANAGER_ASSEMBLY_FIELDS: Array<string>，状态组装输入精确字段。
      SOURCE_SWITCH_STATE_FIELDS: Array<string>，活动源切换状态精确字段。
      SOURCE_STORAGE_USAGE_FIELDS: Array<string>，Repository usage 完整字段集合。
      SOURCE_STORAGE_PARTITION_NAMES: Array<string>，私有空间五分区稳定名称。

  - 模块级变量:
      无

  - 模块级辅助函数:
      wrapManagerValidation(action): Function，把 Repository 通用校验错误转换为 SourceManager 校验错误。
      assertExactFields(value, fields, name): Function，校验对象精确字段集合。
      createPendingAuthorizationState(): Function，创建无共享引用的待授权快照。
      createStructuralFailureRuntimeState(runtime, reason): Function，创建结构损坏失败运行态。
      evaluateRecordGraph(definition, packageIndex, preference): Function，评估单条跨 Repository 关系。
      normalizeSourceCacheSummary(usageInput, sourceId): Function，校验并隔离两级缓存摘要。
      isRecordSelectable(record, removedSet): Function，判断记录能否成为默认源或活动源。

  - 模块级类:
      无

  - 对外导出:
      SOURCE_RECORD_FAILURE_REASON: object，稳定单记录失败原因枚举。
      SOURCE_STABLE_RUNTIME_FIELDS: Array<string>，稳定会话运行态字段唯一集合。
      createIdleSourceSwitchState: Function，创建无活动切换事务的初始状态。
      normalizeSourceSwitchState: Function，校验并隔离 Manager 当前切换状态。
      createDefaultSourceRuntimeState: Function，严格默认会话运行态工厂。
      normalizeInitialSourceRuntimeStates: Function，初始会话运行态白名单校验。
      assembleSourceManagerState: Function，轻量安全投影组装入口。
*/

import {
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: AUTHORIZATION_STATUS 授权状态枚举。
  // 文件作用: 创建待授权投影，并把失效的 authorized 快照收敛为 pending。
  AUTHORIZATION_STATUS,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 健康状态枚举。
  // 文件作用: 约束初始健康状态，并把包图结构损坏标记为 unavailable。
  HEALTH_STATUS,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: PROVIDER_RUNTIME_STATUS Provider 生命周期枚举。
  // 文件作用: 创建 stopped 默认运行态和 failed 结构损坏运行态。
  PROVIDER_RUNTIME_STATUS,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: PROVIDER_READINESS_STATUS Provider 当前会话就绪枚举。
  // 文件作用: 默认源和活动源只保留具有受审可执行 Provider 的记录。
  PROVIDER_READINESS_STATUS,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: 识别系统源软隐藏集合，避免使用魔法 system 字符串。
  SOURCE_KIND,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_SCRIPT_INTEGRITY_ALGORITHM 数据源脚本完整性算法。
  // 文件作用: Repository 图只接受与导入和授权一致的 SHA-256 Package。
  SOURCE_SCRIPT_INTEGRITY_ALGORITHM,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_SWITCH_STATUS 活动源切换状态枚举。
  // 文件作用: 初始化尚未开始切换时的 idle 切换投影。
  SOURCE_SWITCH_STATUS
} from '../../config/source-manager.config.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: SOURCE_STORAGE_PARTITION 私有空间五分区枚举。
  // 文件作用: 严格校验 Repository usage.partitions 的字段和求和关系。
  SOURCE_STORAGE_PARTITION,

  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
  // 文件作用: 隔离初始运行态、Definition、授权快照、usage 和最终 SourceManagerState。
  cloneSerializableValue
} from '../../repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 严格普通对象校验函数。
  // 文件作用: 拒绝数组、复杂实例和异常原型运行态或 usage 容器。
  assertPlainObject,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertSafeRecordKey 动态记录键校验函数。
  // 文件作用: 初始运行态和活动源 id 拒绝空白及原型敏感危险名称。
  assertSafeRecordKey
} from '../../repositories/source/sourceRepositoryValidators.js';

import {
  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: createSourceScriptHash 规范化脚本文本指纹函数。
  // 文件作用: 重新计算 Package.scriptContent 指纹，不能直接信任保存声明。
  createSourceScriptHash,

  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: evaluateSourceAuthorizationFingerprint 指纹授权评估函数。
  // 文件作用: 使用 Definition.version 和已验证脚本指纹判断自定义源授权是否有效。
  evaluateSourceAuthorizationFingerprint
} from '../../utils/sourceAuthorization.js';

import {
  // 导入来源: ./sourceManagerErrors.js。
  // 导入内容: SourceManagerInitializationError 初始化领域错误。
  // 文件作用: 包装无法生成任何安全投影的意外组装异常并保留 cause。
  SourceManagerInitializationError,

  // 导入来源: ./sourceManagerErrors.js。
  // 导入内容: SourceManagerValidationError 输入校验错误。
  // 文件作用: 表达运行态、usage、活动源和组装对象不符合契约。
  SourceManagerValidationError
} from './sourceManagerErrors.js';

// 导入来源: ./sourceManagerPorts.js。
// 导入内容: validateSourceProviderReadinessResult Provider 就绪结果校验函数。
// 文件作用: 组装器再次校验按 sourceId 注入的会话就绪投影，不信任调用方普通对象。
import { validateSourceProviderReadinessResult } from './sourceManagerPorts.js';

// 类型: object。
// 作用: 固定单记录跨对象失败原因，页面和测试不得解析中文说明判断失败类型。
export const SOURCE_RECORD_FAILURE_REASON = Object.freeze({
  // 类型: string。
  // 作用: Definition.packageRef 无法定位 SourcePackage，记录必须失败关闭。
  missingPackage: 'missing-package',

  // 类型: string。
  // 作用: Package.sourceId 不属于当前 Definition，阻止跨源包引用。
  packageSourceMismatch: 'package-source-mismatch',

  // 类型: string。
  // 作用: Package 和 Definition 的显式 Provider 绑定不一致，阻止按来源类型猜测 Provider。
  providerMismatch: 'provider-mismatch',

  // 类型: string。
  // 作用: 完整性算法未知或脚本文本指纹与声明不一致，阻止未验证脚本通过授权。
  integrityMismatch: 'integrity-mismatch',

  // 类型: string。
  // 作用: Preferences 缺少当前 sourceId 状态，不能把缺失 enabled 静默视为 true。
  missingPreference: 'missing-preference',

  // 类型: string。
  // 作用: 自定义源授权版本或指纹不匹配，记录保持健康状态但必须关闭并等待用户确认。
  authorizationInvalid: 'authorization-invalid'
});

// 类型: Set<string>。
// 作用: 标识会把 Provider 和健康状态收敛为 failed/unavailable 的包图结构损坏；授权失效不属于此集合。
const SOURCE_STRUCTURAL_FAILURE_REASONS = new Set([
  SOURCE_RECORD_FAILURE_REASON.missingPackage,
  SOURCE_RECORD_FAILURE_REASON.packageSourceMismatch,
  SOURCE_RECORD_FAILURE_REASON.providerMismatch,
  SOURCE_RECORD_FAILURE_REASON.integrityMismatch,
  SOURCE_RECORD_FAILURE_REASON.missingPreference
]);

// 类型: Array<string>。
// 作用: 限制组合入口可注入的会话字段，明确排除 enabled、currentScriptHash、授权、默认源和私有空间值。
export const SOURCE_STABLE_RUNTIME_FIELDS = Object.freeze([
  'providerStatus',
  'healthStatus',
  'lastCheckedAt',
  'lastUnavailableReason',
  'updateAvailable',
  'availableVersion',
  'availableVersionUpdatedAt',
  'lastUpdateCheckedAt'
]);

// 类型: Array<string>。
// 作用: 集中校验初始运行态的可选字符串字段，禁止通过逻辑或运算静默转换非法类型。
const SOURCE_RUNTIME_STRING_FIELDS = Object.freeze([
  'lastCheckedAt',
  'lastUnavailableReason',
  'availableVersion',
  'availableVersionUpdatedAt',
  'lastUpdateCheckedAt'
]);

// 类型: Array<string>。
// 作用: 固定 assembleSourceManagerState 的完整输入字段，阻止页面状态或保存态通过额外字段进入组装器。
const SOURCE_MANAGER_ASSEMBLY_FIELDS = Object.freeze([
  'packages',
  'definitions',
  'preferences',
  'usageBySourceId',
  'providerReadinessBySourceId',
  'runtimeBySourceId',
  'activeSourceId',
  'switchState'
]);

// 类型: Array<string>。
// 作用: 固定活动源切换投影的目标、请求身份、状态和用户错误四字段，阻止第二套切换数据进入状态。
const SOURCE_SWITCH_STATE_FIELDS = Object.freeze([
  'pendingSourceId',
  'requestId',
  'status',
  'errorMessage'
]);

// 类型: Array<string>。
// 作用: 固定 SourceStorageRepository.getUsage 完整返回字段，页面投影前仍需验证 Repository 契约没有缺失或扩张。
const SOURCE_STORAGE_USAGE_FIELDS = Object.freeze([
  'sourceId',
  'partitions',
  'temporaryCacheBytes',
  'totalCacheBytes',
  'totalStorageBytes'
]);

// 类型: Array<string>。
// 作用: 固定 settings、credentials、session、cache 和 diagnostics 五分区名称及求和读取顺序。
const SOURCE_STORAGE_PARTITION_NAMES = Object.freeze(Object.values(SOURCE_STORAGE_PARTITION));

/**
 * 执行 Repository 通用严格校验并转换错误边界。
 * 纯函数: 除执行 action 外不读取或修改模块状态。
 *
 * @param {Function} action 严格校验回调。
 * @returns {*} 原校验结果。
 * @throws {SourceManagerValidationError} 当 Repository 通用校验拒绝输入时抛出并保留 cause。
 */
function wrapManagerValidation(action) {
  try {
    // 返回值类型: any。
    // 作用: 校验成功时原样返回结果，不改变输入语义。
    return action();
  } catch (error) {
    // 异常来源: 严格 JSON、普通对象或动态键校验拒绝当前输入。
    // 处理策略: 转换为 SourceManager 校验错误并保留底层 cause。
    throw new SourceManagerValidationError(error.message, { cause: error });
  }
}

/**
 * 创建尚未发生活动源切换的完整状态。
 * 纯函数: 每次返回独立普通对象，不共享可变引用。
 * 调用方: SourceManager 构造器建立当前会话唯一切换状态。
 *
 * @returns {object} status 为 idle 且三个说明字段为空字符串的切换状态。
 */
export function createIdleSourceSwitchState() {
  return {
    pendingSourceId: '',
    requestId: '',
    status: SOURCE_SWITCH_STATUS.idle,
    errorMessage: ''
  };
}

/**
 * 校验并隔离 SourceManager 当前活动源切换状态。
 * 纯函数: 返回严格 JSON 隔离副本，不修改 Manager 或调用方对象。
 * 状态规则: idle 不保留请求；switching/success 保留目标和 requestId；failed 额外要求用户可读错误。
 * 失败路径: 字段、枚举、身份或状态组合不符合契约时抛稳定校验错误。
 *
 * @param {*} switchState 活动源切换状态候选。
 * @returns {object} 字段和组合均完整的隔离切换状态。
 * @throws {SourceManagerValidationError} 当切换状态无法安全发布时抛出。
 */
export function normalizeSourceSwitchState(switchState) {
  // 类型: object。
  // 作用: 严格隔离输入，拒绝访问器、Symbol、循环和不可序列化内部异常。
  const isolatedState = wrapManagerValidation(() => cloneSerializableValue(
    switchState,
    'sourceSwitchState'
  ));

  // 执行内容: 只接受精确四字段普通对象，避免页面 pending 或 Host 状态混入 Manager 权威。
  assertExactFields(isolatedState, SOURCE_SWITCH_STATE_FIELDS, 'sourceSwitchState');

  // 类型: Array<string>。
  // 作用: 集中验证三个文本字段，禁止 null、Error 或数字通过隐式转换进入状态发布。
  const stringFields = ['pendingSourceId', 'requestId', 'errorMessage'];

  // 条件分支: 任一文本字段不是字符串时进入。
  // 执行内容: 拒绝无法稳定序列化和展示的切换状态。
  if (stringFields.some(field => typeof isolatedState[field] !== 'string')) {
    throw new SourceManagerValidationError('sourceSwitchState 文本字段必须是字符串');
  }

  // 条件分支: status 不属于冻结切换枚举时进入。
  // 执行内容: 阻止页面或 Runtime 自行扩张状态机。
  if (!Object.values(SOURCE_SWITCH_STATUS).includes(isolatedState.status)) {
    throw new SourceManagerValidationError('sourceSwitchState.status 不在允许枚举中');
  }

  // 条件分支: idle 仍携带目标、请求或错误时进入。
  // 执行内容: 初始状态必须没有可被误认为当前事务的残留身份。
  if (isolatedState.status === SOURCE_SWITCH_STATUS.idle) {
    // 条件分支: 任一请求身份或错误字段没有清空时进入。
    // 执行内容: 拒绝带残留结果的 idle 状态，避免观察者误判仍有事务。
    if (isolatedState.pendingSourceId || isolatedState.requestId || isolatedState.errorMessage) {
      throw new SourceManagerValidationError('idle 切换状态不能携带目标、请求或错误');
    }
    return isolatedState;
  }

  // 执行内容: switching、success 和 failed 都保留本次或最近一次目标及唯一 requestId，供过期结果比较。
  wrapManagerValidation(
    () => assertSafeRecordKey(isolatedState.pendingSourceId, 'sourceSwitchState.pendingSourceId')
  );
  wrapManagerValidation(
    () => assertSafeRecordKey(isolatedState.requestId, 'sourceSwitchState.requestId')
  );

  // 条件分支: failed 状态缺少用户可读错误时进入。
  // 执行内容: 失败投影必须可以直接供页面展示，不能要求解析 Error 或 cause。
  if (isolatedState.status === SOURCE_SWITCH_STATUS.failed) {
    // 条件分支: 错误说明为空或只有空白时进入。
    // 执行内容: 拒绝无法向用户解释的失败完成态。
    if (!isolatedState.errorMessage.trim()) {
      throw new SourceManagerValidationError('failed 切换状态必须提供用户可读错误');
    }
    isolatedState.errorMessage = isolatedState.errorMessage.trim();
    return isolatedState;
  }

  // 条件分支: switching 或 success 仍携带错误文本时进入。
  // 执行内容: 成功和进行中状态不得展示上一次失败说明。
  if (isolatedState.errorMessage) {
    throw new SourceManagerValidationError('switching 或 success 切换状态不能携带错误');
  }

  return isolatedState;
}

/**
 * 校验普通对象只包含指定字段。
 * 纯函数: 只读取对象自有字段，不修改输入。
 *
 * @param {object} value 待校验普通对象。
 * @param {Array<string>} fields 完整允许字段集合。
 * @param {string} name 错误信息使用的对象名称。
 * @returns {void} 字段集合完全一致时结束。
 * @throws {SourceManagerValidationError} 当对象类型、字段缺失或存在额外字段时抛出。
 */
function assertExactFields(value, fields, name) {
  // 执行内容: 先验证普通对象边界，避免 Reflect.ownKeys 读取复杂实例或异常原型。
  wrapManagerValidation(() => assertPlainObject(value, name));

  // 类型: Array<string|symbol>。
  // 作用: 读取全部自有键，Symbol 和额外字段都会参与精确集合校验。
  const keys = Reflect.ownKeys(value);

  // 条件分支: 字段数量或任一字段名称与契约不一致时进入。
  // 执行内容: 拒绝缺失输入和未经设计的扩展字段。
  if (keys.length !== fields.length || fields.some(field => !keys.includes(field))) {
    throw new SourceManagerValidationError(`${name} 字段必须完整且不能包含额外字段`);
  }
}

/**
 * 创建待授权快照。
 * 纯函数: 每次返回新的普通对象，不共享可变引用。
 *
 * @returns {object} 字段完整的 pending 授权快照。
 * @returns {string} return.status pending 表示必须由用户确认后才能启用。
 * @returns {string} return.authorizedAt 尚未授权时为空字符串。
 * @returns {string} return.authorizedVersion 尚未授权时为空字符串。
 * @returns {string} return.authorizedScriptHash 尚未授权时为空字符串。
 */
function createPendingAuthorizationState() {
  // 返回值类型: object。
  // 作用: 返回独立待授权对象，单条记录修改状态不会影响其他记录。
  return {
    status: AUTHORIZATION_STATUS.pending,
    authorizedAt: '',
    authorizedVersion: '',
    authorizedScriptHash: ''
  };
}

/**
 * 创建未启动、等待首次健康检查且没有更新检查结果的默认会话运行态。
 * 纯函数: 严格隔离输入并返回新对象，不共享嵌套引用。
 *
 * @param {object} runtimeInput 可选健康和更新会话字段。
 * @returns {object} 完整 SourceRuntimeState。
 * @returns {string} return.providerStatus Provider 生命周期状态，默认 stopped。
 * @returns {string} return.healthStatus 最近健康状态，默认 checking，首次真实检查前不得显示正常。
 * @returns {string} return.lastCheckedAt 最近健康检查时间，没有记录时为空字符串。
 * @returns {string} return.lastUnavailableReason 最近不可用原因，健康正常时为空字符串。
 * @returns {boolean} return.checkingUpdate 始终为 false，初始化不能伪造正在检查。
 * @returns {boolean} return.updateAvailable true 表示有更新，false 表示没有更新。
 * @returns {string} return.availableVersion 可用版本，没有更新时为空字符串。
 * @returns {string} return.availableVersionUpdatedAt 在线版本时间，没有更新时为空字符串。
 * @returns {string} return.lastUpdateCheckedAt 最近更新检查时间，没有记录时为空字符串。
 * @throws {SourceManagerValidationError} 当输入类型、字段、枚举或状态组合不符合契约时抛出。
 */
export function createDefaultSourceRuntimeState(runtimeInput = {}) {
  // 类型: object。
  // 作用: 严格隔离调用方运行态输入，后续校验和默认值组装不会修改原对象。
  const safeInput = wrapManagerValidation(() => {
    // 类型: object。
    // 作用: 保存严格 JSON Value 隔离副本，拒绝函数、访问器、循环和有损值。
    const isolatedInput = cloneSerializableValue(runtimeInput, 'sourceRuntimeInput');

    // 执行内容: 只接受普通对象，拒绝数组和复杂实例作为运行态容器。
    assertPlainObject(isolatedInput, 'sourceRuntimeInput');

    // 返回值类型: object。
    // 作用: 返回已隔离普通对象供精确字段和状态组合校验。
    return isolatedInput;
  });

  // 类型: Array<string|symbol>。
  // 作用: 保存未进入初始运行态白名单的字段，防止覆盖 enabled、指纹或授权权威。
  const unknownFields = Reflect.ownKeys(safeInput)
    .filter(field => !SOURCE_STABLE_RUNTIME_FIELDS.includes(field));

  // 条件分支: 初始运行态包含任一禁止字段时进入。
  // 执行内容: 一次性拒绝全部越权字段，不静默删除后继续初始化。
  if (unknownFields.length > 0) {
    throw new SourceManagerValidationError(`sourceRuntimeInput 包含禁止字段: ${unknownFields.join(', ')}`);
  }

  // 条件分支: updateAvailable 已提供但不是严格 Boolean 时进入。
  // 执行内容: 拒绝 0、1 和字符串等模糊更新状态。
  if (safeInput.updateAvailable !== undefined && typeof safeInput.updateAvailable !== 'boolean') {
    throw new SourceManagerValidationError('runtime.updateAvailable 必须是 boolean');
  }

  // 条件分支: providerStatus 已提供但不属于稳定生命周期枚举时进入。
  // 执行内容: 拒绝未知 Provider 状态进入 SourceManagerState。
  if (safeInput.providerStatus !== undefined
    && !Object.values(PROVIDER_RUNTIME_STATUS).includes(safeInput.providerStatus)) {
    throw new SourceManagerValidationError('runtime.providerStatus 不在允许枚举中');
  }

  // 条件分支: healthStatus 已提供但不是 checking、normal 或 unavailable 时进入。
  // 执行内容: 允许当前运行会话以 checking 启动，但拒绝页面或未来未知状态扩张领域枚举。
  if (safeInput.healthStatus !== undefined
    && !Object.values(HEALTH_STATUS).includes(safeInput.healthStatus)) {
    throw new SourceManagerValidationError('runtime.healthStatus 不在允许枚举中');
  }

  // 循环类型: Array.prototype.forEach。
  // 初始值: 第一个可选字符串运行态字段。
  // 终止条件: 全部字符串字段类型校验完成。
  // 循环作用: 拒绝通过逻辑或运算把数字、对象或 null 静默转换为空字符串。
  SOURCE_RUNTIME_STRING_FIELDS.forEach((field) => {
    // 条件分支: 字段已提供但不是字符串时进入。
    // 执行内容: 抛出稳定校验错误并指出具体运行态字段。
    if (safeInput[field] !== undefined && typeof safeInput[field] !== 'string') {
      throw new SourceManagerValidationError(`runtime.${field} 必须是字符串`);
    }
  });

  // 类型: string。
  // 作用: 生成最终健康状态；没有会话检查结果时进入 checking，禁止未检测源默认显示正常。
  const healthStatus = safeInput.healthStatus || HEALTH_STATUS.checking;

  // 类型: string。
  // 作用: 生成最终不可用原因，未提供时使用空字符串。
  const lastUnavailableReason = safeInput.lastUnavailableReason || '';

  // 条件分支: 健康正常但仍携带不可用原因时进入。
  // 执行内容: 拒绝矛盾健康组合，避免页面显示陈旧错误。
  if (healthStatus === HEALTH_STATUS.normal && lastUnavailableReason) {
    throw new SourceManagerValidationError('normal 运行态不能携带不可用原因');
  }

  // 条件分支: 健康不可用但没有非空原因时进入。
  // 执行内容: 要求初始化失败状态具备可诊断原因。
  if (healthStatus === HEALTH_STATUS.unavailable && !lastUnavailableReason.trim()) {
    throw new SourceManagerValidationError('unavailable 运行态必须提供不可用原因');
  }

  // 类型: boolean。
  // 作用: 生成最终更新状态；true 保留有更新语义，未提供或 false 表示没有更新。
  const updateAvailable = safeInput.updateAvailable === true;

  // 类型: string。
  // 作用: 生成最终可用版本；未提供时使用空字符串。
  const availableVersion = safeInput.availableVersion || '';

  // 类型: string。
  // 作用: 生成最终在线版本更新时间；未提供时使用空字符串。
  const availableVersionUpdatedAt = safeInput.availableVersionUpdatedAt || '';

  // 条件分支: 存在更新但缺少可用版本或版本时间时进入。
  // 执行内容: 拒绝无法执行后续更新确认的半完成运行态。
  if (updateAvailable && (!availableVersion || !availableVersionUpdatedAt)) {
    throw new SourceManagerValidationError('存在更新时必须提供版本和版本时间');
  }

  // 条件分支: 没有更新但仍携带可用版本或版本时间时进入。
  // 执行内容: 拒绝矛盾更新组合，避免页面错误展示更新按钮。
  if (!updateAvailable && (availableVersion || availableVersionUpdatedAt)) {
    throw new SourceManagerValidationError('没有更新时版本和版本时间必须为空字符串');
  }

  // 返回值类型: object。
  // 作用: 返回字段完整的新会话运行态；enabled 和 currentScriptHash 由跨对象评估后追加。
  return {
    providerStatus: safeInput.providerStatus || PROVIDER_RUNTIME_STATUS.stopped,
    healthStatus,
    lastCheckedAt: safeInput.lastCheckedAt || '',
    lastUnavailableReason,
    checkingUpdate: false,
    updateAvailable,
    availableVersion,
    availableVersionUpdatedAt,
    lastUpdateCheckedAt: safeInput.lastUpdateCheckedAt || ''
  };
}

/**
 * 校验并隔离组合入口提供的初始会话运行态。
 * 纯函数: 返回新对象，不修改输入或任一 sourceId 的运行态。
 *
 * @param {*} initialRuntimeStates 按 sourceId 保存的可选会话运行态。
 * @returns {Record<string, object>} 字段受控的隔离运行态集合。
 * @throws {SourceManagerValidationError} 当根对象、sourceId 或单源运行态不符合契约时抛出。
 */
export function normalizeInitialSourceRuntimeStates(initialRuntimeStates = {}) {
  // 类型: object。
  // 作用: 严格隔离整个初始运行态集合，防止后续外部修改穿透 Manager 当前会话状态。
  const isolatedStates = wrapManagerValidation(() => {
    // 类型: object。
    // 作用: 保存严格 JSON Value 隔离副本，拒绝有损值和原型访问器。
    const states = cloneSerializableValue(initialRuntimeStates, 'initialRuntimeStates');

    // 执行内容: 初始运行态根节点只接受普通对象，不接受数组或复杂实例。
    assertPlainObject(states, 'initialRuntimeStates');

    // 返回值类型: object。
    // 作用: 返回已隔离普通对象供 sourceId 和单源字段校验。
    return states;
  });

  // 类型: Array<[string, object]>。
  // 作用: 保存按 sourceId 规范化后的运行态条目，最终转换为不共享引用的新记录对象。
  const normalizedEntries = Object.entries(isolatedStates).map(([sourceId, runtimeInput]) => {
    // 执行内容: sourceId 必须可安全作为动态记录键，拒绝空白和原型敏感名称。
    wrapManagerValidation(() => assertSafeRecordKey(sourceId, 'initialRuntimeStates sourceId'));

    // 类型: object。
    // 作用: 使用完整运行态工厂校验枚举、Boolean 和字段组合，但不把过程字段写入稳定索引。
    const normalizedRuntime = createDefaultSourceRuntimeState(runtimeInput);

    // 类型: object。
    // 作用: 只投影可跨 Repository 重组装保留的稳定字段，使重复规范化保持同一输入契约。
    const stableRuntime = Object.fromEntries(SOURCE_STABLE_RUNTIME_FIELDS.map(field => [
      field,
      normalizedRuntime[field]
    ]));

    // 返回值类型: [string, object]。
    // 作用: 保留 sourceId 和稳定运行态，不携带 checkingUpdate、enabled 或 currentScriptHash。
    return [sourceId, stableRuntime];
  });

  // 返回值类型: Record<string, object>。
  // 作用: 返回全新的 sourceId 运行态索引，供 SourceManager 当前会话持有。
  return Object.fromEntries(normalizedEntries);
}

/**
 * 创建包图结构损坏时的失败关闭运行态。
 * 纯函数: 返回新对象，不修改基础运行态。
 *
 * @param {object} runtime 已校验的基础会话运行态。
 * @param {string} reason 稳定结构损坏原因。
 * @returns {object} Provider failed、健康 unavailable 且记录原因的运行态。
 */
function createStructuralFailureRuntimeState(runtime, reason) {
  // 返回值类型: object。
  // 作用: 保留无关更新字段，只覆盖与结构损坏直接相关的 Provider 和健康状态。
  return {
    ...runtime,
    providerStatus: PROVIDER_RUNTIME_STATUS.failed,
    healthStatus: HEALTH_STATUS.unavailable,
    lastUnavailableReason: reason
  };
}

/**
 * 校验一条 Definition 的 Package、偏好、指纹和授权关系。
 * 纯函数: 只读取索引并返回新授权对象和派生结论，不修改 Repository 图。
 *
 * @param {object} definition 当前 SourceDefinition 隔离副本。
 * @param {Map<string, object>} packageIndex 按 packageRef 建立的 SourcePackage 索引。
 * @param {object|null} preference 当前 sourceId 的用户偏好；缺失时为 null。
 * @returns {object} 单记录跨对象评估结果。
 * @returns {string} return.currentScriptHash 当前已验证脚本指纹；结构损坏时为空字符串。
 * @returns {object} return.authorization 页面使用的隔离授权快照。
 * @returns {string} return.failureReason 最终失败原因；记录有效时为空字符串。
 * @returns {string} return.structuralFailureReason 包图结构失败原因；没有结构损坏时为空字符串。
 */
function evaluateRecordGraph(definition, packageIndex, preference) {
  // 类型: object|null。
  // 作用: 根据 Definition.packageRef 定位脚本包；未命中时保留 null 供失败关闭。
  const sourcePackage = packageIndex.get(definition.packageRef) || null;

  // 类型: string。
  // 作用: 保存包引用、归属、Provider、完整性或偏好结构失败原因；空字符串表示结构有效。
  let structuralFailureReason = '';

  // 条件分支: Definition.packageRef 无法定位脚本包时进入。
  // 执行内容: 记录缺包原因，后续不读取不存在脚本文本。
  if (!sourcePackage) {
    structuralFailureReason = SOURCE_RECORD_FAILURE_REASON.missingPackage;
  } else {
    // 条件分支: 脚本包声明的 sourceId 不属于当前 Definition 时进入。
    // 执行内容: 记录跨源包归属错误，阻止错误脚本进入当前记录。
    if (sourcePackage.sourceId !== definition.id) {
      structuralFailureReason = SOURCE_RECORD_FAILURE_REASON.packageSourceMismatch;
    } else {
      // 条件分支: Package 与 Definition 的显式 Provider 绑定不一致时进入。
      // 执行内容: 记录 Provider 失配，禁止根据来源类型或页面状态猜测实现。
      if (sourcePackage.providerKey !== definition.providerKey) {
        structuralFailureReason = SOURCE_RECORD_FAILURE_REASON.providerMismatch;
      }
    }
  }

  // 类型: string。
  // 作用: 保存从规范化脚本文本重新计算的指纹；缺包时为空字符串。
  const computedScriptHash = sourcePackage
    ? createSourceScriptHash(sourcePackage.scriptContent)
    : '';

  // 条件分支: 前置关联有效，但完整性算法未知或脚本指纹与声明不一致时进入。
  // 执行内容: 记录完整性失败，未验证声明哈希不能用于授权门禁。
  if (!structuralFailureReason && (
    sourcePackage.integrity.algorithm !== SOURCE_SCRIPT_INTEGRITY_ALGORITHM
    || computedScriptHash !== sourcePackage.integrity.scriptHash
  )) {
    structuralFailureReason = SOURCE_RECORD_FAILURE_REASON.integrityMismatch;
  }

  // 条件分支: Package 图有效但 Preferences 缺少当前 sourceId 状态时进入。
  // 执行内容: 记录偏好缺失，不能把缺失 enabled 静默解释成启用。
  if (!structuralFailureReason && !preference) {
    structuralFailureReason = SOURCE_RECORD_FAILURE_REASON.missingPreference;
  }

  // 类型: string。
  // 作用: 只在包图完整且指纹校验通过时暴露当前指纹；结构损坏时明确为空字符串。
  const currentScriptHash = structuralFailureReason ? '' : computedScriptHash;

  // 类型: object。
  // 作用: 复制已保存授权快照；缺偏好时创建独立 pending 对象供安全页面投影。
  const authorization = preference?.authorization
    ? cloneSerializableValue(preference.authorization, `authorization.${definition.id}`)
    : createPendingAuthorizationState();

  // 类型: object。
  // 作用: 使用当前 Definition.version 和已验证脚本指纹评估授权，不读取 Definition.scriptContent。
  const authorizationState = evaluateSourceAuthorizationFingerprint({
    sourceKind: definition.sourceKind,
    version: definition.version,
    currentScriptHash,
    authorization
  });

  // 类型: string。
  // 作用: 结构失败优先；结构完整但授权无效时使用 authorization-invalid；有效记录为空字符串。
  const failureReason = structuralFailureReason
    || (authorizationState.isAuthorized ? '' : SOURCE_RECORD_FAILURE_REASON.authorizationInvalid);

  // 条件分支: 保存快照声称 authorized，但当前版本或已验证指纹不再匹配时进入。
  // 执行内容: 页面状态收敛为 pending；保留时间、版本和旧指纹字段供失效诊断。
  if (!authorizationState.isAuthorized && authorization.status === AUTHORIZATION_STATUS.authorized) {
    authorization.status = AUTHORIZATION_STATUS.pending;
  }

  // 返回值类型: object。
  // 作用: 返回不含 scriptContent 的跨对象评估结果；授权失效仍保留已验证 currentScriptHash 供重新授权。
  return {
    currentScriptHash,
    authorization,
    failureReason,
    structuralFailureReason
  };
}

/**
 * 校验并隔离单个数据源的两级缓存摘要。
 * 纯函数: 返回新对象，不修改 Repository usage 结果。
 *
 * @param {*} usageInput SourceStorageRepository.getUsage 完整返回值。
 * @param {string} sourceId 当前数据源 id，用于错误定位。
 * @returns {object} 字段完整的两级缓存摘要。
 * @returns {number} return.temporaryCacheBytes cache 与 diagnostics 的真实字节数。
 * @returns {number} return.totalCacheBytes 四个运行分区的真实字节数。
 * @throws {SourceManagerValidationError} 当 sourceId、字段、五分区容量或求和关系不符合 Repository 契约时抛出。
 */
function normalizeSourceCacheSummary(usageInput, sourceId) {
  // 类型: object。
  // 作用: 隔离 Repository 完整 usage 返回值，页面投影不能修改分区或汇总容量。
  const usage = wrapManagerValidation(() => cloneSerializableValue(
    usageInput,
    `usageBySourceId.${sourceId}`
  ));

  // 执行内容: usage 必须完整包含 sourceId、五分区、两个页面摘要和五分区总量。
  assertExactFields(usage, SOURCE_STORAGE_USAGE_FIELDS, `usageBySourceId.${sourceId}`);

  // 条件分支: usage.sourceId 与当前 Definition.id 不一致时进入。
  // 执行内容: 拒绝把其他命名空间的缓存摘要投影到当前记录。
  if (usage.sourceId !== sourceId) {
    throw new SourceManagerValidationError(`usageBySourceId.${sourceId}.sourceId 不匹配`);
  }

  // 执行内容: partitions 必须且只能包含五个私有空间分区。
  assertExactFields(
    usage.partitions,
    SOURCE_STORAGE_PARTITION_NAMES,
    `usageBySourceId.${sourceId}.partitions`
  );

  // 类型: Array<number>。
  // 作用: 集中校验五分区容量和三个 Repository 汇总值。
  const cacheByteValues = [
    ...Object.values(usage.partitions),
    usage.temporaryCacheBytes,
    usage.totalCacheBytes,
    usage.totalStorageBytes
  ];

  // 条件分支: 任一容量不是非负安全整数时进入。
  // 执行内容: 拒绝 NaN、负数、小数和超出安全范围的伪容量。
  if (cacheByteValues.some(value => !Number.isSafeInteger(value) || value < 0)) {
    throw new SourceManagerValidationError(`usageBySourceId.${sourceId} 容量必须是非负安全整数`);
  }

  // 类型: number。
  // 作用: 根据 cache 和 diagnostics 分区重新计算页面临时缓存摘要。
  const expectedTemporaryCacheBytes = usage.partitions[SOURCE_STORAGE_PARTITION.cache]
    + usage.partitions[SOURCE_STORAGE_PARTITION.diagnostics];

  // 类型: number。
  // 作用: 根据四个运行分区重新计算页面全部缓存摘要，明确排除 settings。
  const expectedTotalCacheBytes = usage.partitions[SOURCE_STORAGE_PARTITION.credentials]
    + usage.partitions[SOURCE_STORAGE_PARTITION.session]
    + usage.partitions[SOURCE_STORAGE_PARTITION.cache]
    + usage.partitions[SOURCE_STORAGE_PARTITION.diagnostics];

  // 类型: number。
  // 作用: 根据五个分区重新计算 Repository 内部总空间容量。
  const expectedTotalStorageBytes = Object.values(usage.partitions)
    .reduce((totalBytes, partitionBytes) => totalBytes + partitionBytes, 0);

  // 条件分支: 任一 Repository 汇总值与五分区重新计算结果不一致时进入。
  // 执行内容: 拒绝伪造或陈旧 usage，页面缓存摘要只能来自真实分区容量。
  if (usage.temporaryCacheBytes !== expectedTemporaryCacheBytes
    || usage.totalCacheBytes !== expectedTotalCacheBytes
    || usage.totalStorageBytes !== expectedTotalStorageBytes) {
    throw new SourceManagerValidationError(`usageBySourceId.${sourceId} 容量汇总关系不一致`);
  }

  // 返回值类型: object。
  // 作用: 返回新摘要对象，页面修改不会穿透 Repository usage 结果。
  return {
    temporaryCacheBytes: usage.temporaryCacheBytes,
    totalCacheBytes: usage.totalCacheBytes
  };
}

/**
 * 判断记录能否成为默认源或活动源。
 * 纯函数: 只读取轻量记录和软隐藏集合。
 *
 * @param {object|null} record 待判断 SourceRecord；未找到时为 null。
 * @param {Set<string>} removedSet 当前软隐藏系统源集合。
 * @returns {boolean} true 表示记录存在、有效启用、Provider 就绪且未隐藏；false 表示必须从选择投影中拒绝。
 */
function isRecordSelectable(record, removedSet) {
  // 返回值类型: boolean。
  // 作用: 同时执行存在、启用、Provider 就绪和软隐藏门禁，不自动选择其他候选源。
  return Boolean(
    record
    && record.runtime.enabled
    && record.runtime.providerReadiness.status === PROVIDER_READINESS_STATUS.ready
    && !removedSet.has(record.definition.id)
  );
}

/**
 * 组装轻量 SourceManagerState。
 * 纯函数: 返回隔离投影，不修改 Repository 读取结果、usage 或会话运行态输入。
 *
 * @param {object} input Repository 图和会话输入。
 * @param {Array<object>} input.packages 全部 SourcePackage 隔离副本。
 * @param {Array<object>} input.definitions 全部 SourceDefinition 隔离副本。
 * @param {object} input.preferences SourcePreferences 隔离副本。
 * @param {Record<string, object>} input.usageBySourceId 按 sourceId 保存的真实 Storage usage。
 * @param {Record<string, object>} input.providerReadinessBySourceId 按 sourceId 保存的当前 Bundle Provider 就绪结果。
 * @param {Record<string, object>} input.runtimeBySourceId 字段受控的当前会话运行态。
 * @param {string} input.activeSourceId 当前活动源 id；没有活动源时为空字符串。
 * @param {object} input.switchState SourceManager 当前唯一活动源切换状态。
 * @returns {object} 不含 scriptContent、settingsValues 和私有分区值的 SourceManagerState。
 * @throws {SourceManagerValidationError} 当组装输入、runtime、usage 或活动源字段不符合契约时抛出。
 * @throws {SourceManagerInitializationError} 当意外异常导致无法生成安全投影时抛出并保留 cause。
 */
export function assembleSourceManagerState(input) {
  try {
    // 执行内容: 组装入口只接受普通对象，禁止数组、类实例和异常原型容器。
    wrapManagerValidation(() => assertPlainObject(input, 'sourceManagerAssemblyInput'));

    // 执行内容: 组装入口必须具备完整固定字段，不能夹带页面或保存态扩展对象。
    assertExactFields(input, SOURCE_MANAGER_ASSEMBLY_FIELDS, 'sourceManagerAssemblyInput');

    // 条件分支: packages 或 definitions 不是数组时进入。
    // 执行内容: 拒绝无法建立稳定索引和记录顺序的集合输入。
    if (!Array.isArray(input.packages) || !Array.isArray(input.definitions)) {
      throw new SourceManagerValidationError('packages 和 definitions 必须是数组');
    }

    // 执行内容: Preferences、usage 和 Provider 就绪索引必须是普通对象，防止继承字段参与 sourceId 关联。
    wrapManagerValidation(() => assertPlainObject(input.preferences, 'preferences'));
    wrapManagerValidation(() => assertPlainObject(input.usageBySourceId, 'usageBySourceId'));
    wrapManagerValidation(() => assertPlainObject(
      input.providerReadinessBySourceId,
      'providerReadinessBySourceId'
    ));

    // 条件分支: activeSourceId 不是字符串时进入。
    // 执行内容: 拒绝数字、null 和对象活动源，不静默转换为空字符串。
    if (typeof input.activeSourceId !== 'string') {
      throw new SourceManagerValidationError('activeSourceId 必须是字符串');
    }

    // 条件分支: 调用方声明了非空活动源 id 时进入。
    // 执行内容: 复用动态键安全校验，拒绝空白和原型敏感名称。
    if (input.activeSourceId !== '') {
      wrapManagerValidation(() => assertSafeRecordKey(input.activeSourceId, 'activeSourceId'));
    }

    // 类型: object。
    // 作用: 校验并隔离 Manager 当前切换状态，Repository 重组装不能把进行中事务重置为 idle。
    const switchState = normalizeSourceSwitchState(input.switchState);

    // 类型: Record<string, object>。
    // 作用: 再次隔离并校验当前会话运行态，确保直接调用组装器也不能注入越权字段。
    const runtimeBySourceId = normalizeInitialSourceRuntimeStates(input.runtimeBySourceId);

    // 类型: Map<string, object>。
    // 作用: 按 packageRef 建立脚本包索引，单条 Definition 关联不需要重复遍历全部包。
    const packageIndex = new Map(input.packages.map(sourcePackage => [sourcePackage.packageRef, sourcePackage]));

    // 类型: Set<string>。
    // 作用: 保存全部 Definition.id，用于拒绝未知 runtime 和 usage sourceId。
    const definitionIds = new Set(input.definitions.map(definition => definition.id));

    // 类型: Array<string>。
    // 作用: 保存没有对应 Definition 的初始运行态 sourceId，避免会话状态成为影子记录。
    const unknownRuntimeSourceIds = Object.keys(runtimeBySourceId)
      .filter(sourceId => !definitionIds.has(sourceId));

    // 条件分支: 初始运行态包含任一未知 sourceId 时进入。
    // 执行内容: 拒绝整个输入，不静默丢弃调用方会话状态。
    if (unknownRuntimeSourceIds.length > 0) {
      throw new SourceManagerValidationError(`initialRuntimeStates 包含未知 sourceId: ${unknownRuntimeSourceIds.join(', ')}`);
    }

    // 类型: Array<string>。
    // 作用: 保存没有对应 Definition 的 usage sourceId，防止缓存摘要与记录图分离。
    const unknownUsageSourceIds = Object.keys(input.usageBySourceId)
      .filter(sourceId => !definitionIds.has(sourceId));

    // 条件分支: usage 索引包含任一未知 sourceId 时进入。
    // 执行内容: 拒绝影子缓存摘要，确保所有页面容量都能定位唯一 Definition。
    if (unknownUsageSourceIds.length > 0) {
      throw new SourceManagerValidationError(`usageBySourceId 包含未知 sourceId: ${unknownUsageSourceIds.join(', ')}`);
    }

    // 类型: Array<string>。
    // 作用: 保存没有对应 Definition 的 Provider 就绪结果，禁止端口创建影子数据源资格。
    const unknownReadinessSourceIds = Object.keys(input.providerReadinessBySourceId)
      .filter(sourceId => !definitionIds.has(sourceId));

    // 条件分支: Provider 就绪索引包含任一未知 sourceId 时进入。
    // 执行内容: 拒绝整个投影，不让注册表结果扩张 Repository Definition 集合。
    if (unknownReadinessSourceIds.length > 0) {
      throw new SourceManagerValidationError(
        `providerReadinessBySourceId 包含未知 sourceId: ${unknownReadinessSourceIds.join(', ')}`
      );
    }

    // 类型: Array<string>。
    // 作用: 保存缺少就绪结果的 Definition.id，确保每条记录都能解释当前是否可执行。
    const missingReadinessSourceIds = [...definitionIds]
      .filter(sourceId => !Object.hasOwn(input.providerReadinessBySourceId, sourceId));

    // 条件分支: 任一 Definition 没有对应就绪结果时进入。
    // 执行内容: 初始化失败关闭，不使用隐式 ready 或 unavailable 猜测当前 Bundle 能力。
    if (missingReadinessSourceIds.length > 0) {
      throw new SourceManagerValidationError(
        `providerReadinessBySourceId 缺少 sourceId: ${missingReadinessSourceIds.join(', ')}`
      );
    }

    // 类型: Set<string>。
    // 作用: 保存当前真实存在的系统源 id，软隐藏投影只能引用这些记录。
    const systemSourceIds = new Set(input.definitions
      .filter(definition => definition.sourceKind === SOURCE_KIND.system)
      .map(definition => definition.id));

    // 类型: Array<string>。
    // 作用: 去重并过滤已不存在或非系统源 id，Repository 原偏好保持不变。
    const removedSystemSourceIds = [...new Set(input.preferences.removedSystemSourceIds
      .filter(sourceId => systemSourceIds.has(sourceId)))];

    // 类型: Set<string>。
    // 作用: 为默认源和活动源可选性校验提供常数时间软隐藏查询。
    const removedSet = new Set(removedSystemSourceIds);

    // 类型: Array<object>。
    // 作用: 按 Definition 原顺序组装轻量记录，保持设置页显示顺序稳定。
    const records = input.definitions.map((definitionInput) => {
      // 类型: object。
      // 作用: 隔离当前 Definition，页面和返回值不能修改 Repository 读取对象。
      const definition = cloneSerializableValue(definitionInput, `definition.${definitionInput.id}`);

      // 类型: object|null。
      // 作用: 定位当前 sourceId 的用户启用和授权偏好；缺失时保留 null 触发失败关闭。
      const preference = input.preferences.sourceStates[definition.id] || null;

      // 类型: object。
      // 作用: 保存当前记录的包关联、完整性和授权评估结果，不携带脚本文本。
      const graph = evaluateRecordGraph(definition, packageIndex, preference);

      // 类型: object。
      // 作用: 从当前 sourceId 会话种子创建字段完整运行态；没有种子时使用集中默认值。
      const baseRuntime = createDefaultSourceRuntimeState(runtimeBySourceId[definition.id] || {});

      // 类型: object。
      // 作用: 只有结构损坏才覆盖 Provider 和健康状态；授权失效保持原健康状态并仅关闭 enabled。
      const runtime = SOURCE_STRUCTURAL_FAILURE_REASONS.has(graph.structuralFailureReason)
        ? createStructuralFailureRuntimeState(baseRuntime, graph.structuralFailureReason)
        : baseRuntime;

      // 类型: boolean。
      // 作用: true 仅表示用户偏好启用且包图、完整性和授权全部有效；false 表示用户关闭或失败关闭。
      runtime.enabled = preference !== null
        && preference.enabled === true
        && graph.failureReason === '';

      // 类型: string。
      // 作用: 保存当前已验证脚本指纹；授权失效仍保留该值供重新授权，结构损坏时为空字符串。
      runtime.currentScriptHash = graph.currentScriptHash;

      // 类型: object。
      // 作用: 采用当前 Runtime Bundle 对 Definition 的受审工厂评估；该对象不进入稳定 runtime 索引或 Repository。
      runtime.providerReadiness = validateSourceProviderReadinessResult(
        input.providerReadinessBySourceId[definition.id]
      );

      // 类型: object。
      // 作用: 验证 Repository 完整 usage 后只投影设置页需要的两级缓存摘要。
      const cache = normalizeSourceCacheSummary(input.usageBySourceId[definition.id], definition.id);

      // 返回值类型: object。
      // 作用: 返回不含 scriptContent、settingsValues 和私有分区值的轻量 SourceRecord。
      return {
        definition,
        packageRef: definition.packageRef,
        storageNamespace: definition.id,
        runtime,
        authorization: graph.authorization,
        cache
      };
    });

    // 类型: object|null。
    // 作用: 定位用户偏好声明的默认源记录；不存在时保留 null 并投影为空默认源。
    const defaultRecord = records.find(record => record.definition.id === input.preferences.defaultSourceId) || null;

    // 类型: string。
    // 作用: 默认源只有存在、有效启用、Provider 就绪且未软隐藏时保留；失败时为空且不自动选择候选。
    const defaultSourceId = isRecordSelectable(defaultRecord, removedSet)
      ? defaultRecord.definition.id
      : '';

    // 类型: object|null。
    // 作用: 定位调用方声明的活动源记录；空 id 或未命中时保留 null。
    const activeRecord = input.activeSourceId
      ? records.find(record => record.definition.id === input.activeSourceId) || null
      : null;

    // 类型: string。
    // 作用: 活动源只有存在、有效启用、Provider 就绪且未软隐藏时保留；失败时清空且不自动回退。
    const activeSourceId = isRecordSelectable(activeRecord, removedSet)
      ? activeRecord.definition.id
      : '';

    // 类型: object。
    // 作用: 创建完整轻量 SourceManagerState 候选，保留 Manager 当前切换请求身份和完成结果。
    const state = {
      activeSourceId,
      defaultSourceId,
      removedSystemSourceIds,
      checkingAll: false,
      switchState,
      records
    };

    // 返回值类型: object。
    // 作用: 返回严格隔离的最终投影，调用方不能通过嵌套修改污染组装输入或内部候选。
    return cloneSerializableValue(state, 'sourceManagerState');
  } catch (error) {
    // 条件分支: 当前异常已经是明确输入校验错误时进入。
    // 执行内容: 原样抛出 validation code，避免错误包装后丢失调用方修正方向。
    if (error instanceof SourceManagerValidationError) {
      throw error;
    }

    // 错误类型: SourceManagerInitializationError。
    // 作用: 包装 Repository 图意外异常并保留 cause，表明当前无法生成安全投影。
    throw new SourceManagerInitializationError('SourceManagerState 组装失败', error);
  }
}
