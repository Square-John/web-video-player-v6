/*
  sourceManagementRuntime.js 模块说明

  - 文件职责:
      创建设置管理门面，使用单一 FIFO 串行协调 SourceManager 事务和 SourceExecutionHost 生命周期。
      统一处理单文件预检、信任后加载、动态工厂注册、可信源启动、破坏类操作恢复和最小导出查询。
      本模块不保存第二份 SourceManagerState，不写 Repository、store 或 DOM；脚本执行只委托受控加载器。

  - 导入库及文件汇总(7 条，内置 0 条，第三方 0 条，自定义 7 条):
      DEFAULT_SOURCE_HANDOFF_MODE: 自定义配置，创建明确 replace 或 clear 默认源交接。
      PROVIDER_READINESS_STATUS: 自定义配置，复用 Manager 投影中的 Provider 就绪资格。
      SOURCE_KIND: 自定义配置，判断更新是否会使自定义源旧授权失效。
      SOURCE_EXECUTION_HOST_PHASE: 自定义配置，识别操作前真实 running Host 集合。
      cloneSerializableValue: 自定义工具，隔离进入 FIFO 前的页面命令。
      normalizeSourceShellId: 自定义校验，统一 Manager、Host 和 Runtime 使用的 sourceId。
      SOURCE_PACKAGE_ERROR_CODE、SOURCE_PACKAGE_LOAD_STAGE: 自定义配置，分类动态工厂注册失败。
      SourcePackageLoadError: 自定义错误，向页面公开安全的注册阶段错误。
      SourceManagement errors: 自定义错误，区分输入、未命中、主操作和补偿失败。

  - 模块级常量:
      SOURCE_MANAGEMENT_RUNTIME_DEPENDENCY_FIELDS: Array<string>，工厂允许的精确依赖字段。
      SOURCE_MANAGER_METHOD_FIELDS: Array<string>，管理门面需要的 SourceManager 方法。
      SOURCE_EXECUTION_HOST_METHOD_FIELDS: Array<string>，生命周期协调需要的 Host 方法。
      SOURCE_INPUT_ADAPTER_METHOD_FIELDS: Array<string>，输入适配器固定方法。
      SOURCE_PACKAGE_LOADER_METHOD_FIELDS: Array<string>，单文件加载器固定方法。
      PROVIDER_FACTORY_REGISTRATION_PORT_METHOD_FIELDS: Array<string>，动态工厂注册端口固定方法。
      SOURCE_UPDATE_PORT_METHOD_FIELDS: Array<string>，更新端口固定方法。
      SOURCE_IMPORT_REQUEST_FIELDS: Array<string>，正式导入请求精确字段。
      SOURCE_MANAGEMENT_RUNTIME_PUBLIC_METHODS: Array<string>，管理门面公开方法和顺序。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertFunctionDependencies(value, fields, fieldName, requireExactFields): 校验函数依赖对象。
      normalizeDependencies(dependencies): 校验管理 Runtime 完整依赖图。
      isolateIntentInput(value, fieldName): 在排队前隔离严格 JSON 输入。
      findSourceRecord(state, sourceId): 从隔离投影定位真实 SourceRecord。
      createDefaultHandoff(state, excludedSourceIds, submittedHandoff): 生成明确默认源交接。
      createManagerCommand(baseCommand, handoff): 只在需要时附加 handoff。
      normalizeSourceImportRequest(request): 校验正式导入的输入和信任决定容器。
      createSourceManagementRuntime(dependencies): 创建冻结管理门面。

  - 模块级类:
      无

  - 对外导出:
      createSourceManagementRuntime: Function，创建共享 Manager/Host 的冻结设置管理门面。
*/

import {
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: DEFAULT_SOURCE_HANDOFF_MODE 默认源交接枚举。
  // 文件作用: 自动适配现有页面时仍向 SourceManager 提交明确 replace 或 clear 命令。
  DEFAULT_SOURCE_HANDOFF_MODE,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: PROVIDER_READINESS_STATUS Provider 当前会话就绪枚举。
  // 文件作用: 默认源交接和 Host 恢复只采用 Manager 已评估为 ready 的记录。
  PROVIDER_READINESS_STATUS,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源来源类型枚举。
  // 文件作用: 判断更新版本或脚本变化是否会使自定义源授权失效并关闭。
  SOURCE_KIND
} from '../../config/source-manager.config.js';

// 导入来源: ../source-host/sourceExecutionHost.config.js。
// 导入内容: SOURCE_EXECUTION_HOST_PHASE Host 生命周期阶段枚举。
// 文件作用: 只有 phase=running 的 entry 进入操作前真实运行集合。
import { SOURCE_EXECUTION_HOST_PHASE } from '../source-host/sourceExecutionHost.config.js';

// 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON 隔离工具。
// 文件作用: 在设置意图进入 FIFO 前隔离调用方命令和更新候选。
import { cloneSerializableValue } from '../../repositories/source/sourceRepositoryUtils.js';

// 导入来源: ../source-shell/sourceShellValidators.js。
// 导入内容: normalizeSourceShellId 统一 sourceId 校验函数。
// 文件作用: 保证管理 Runtime、Manager、Host 和 Provider 使用同一真实身份规则。
import { normalizeSourceShellId } from '../source-shell/sourceShellValidators.js';

import {
  // 导入来源: ../source-package/sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_ERROR_CODE 单文件加载错误码。
  // 文件作用: 动态工厂注册冲突使用公共协议冻结分类。
  SOURCE_PACKAGE_ERROR_CODE,

  // 导入来源: ../source-package/sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_LOAD_STAGE 单文件加载阶段。
  // 文件作用: 注册失败明确落在 register 阶段，不伪装成保存失败。
  SOURCE_PACKAGE_LOAD_STAGE
} from '../source-package/sourcePackage.config.js';

// 导入来源: ../source-package/sourcePackageErrors.js。
// 导入内容: SourcePackageLoadError 单文件加载安全错误。
// 文件作用: 注册表拒绝动态工厂时只公开 code、stage、message 和 field。
import { SourcePackageLoadError } from '../source-package/sourcePackageErrors.js';

import {
  // 导入来源: ./sourceManagementErrors.js。
  // 导入内容: SourceManagementCompensationError 补偿失败错误。
  // 文件作用: 同时保留主操作与关闭/恢复失败，禁止吞掉未收敛状态。
  SourceManagementCompensationError,

  // 导入来源: ./sourceManagementErrors.js。
  // 导入内容: SourceManagementNotFoundError 管理目标未命中错误。
  // 文件作用: 目标记录不存在时在调用 Manager 或 Host 前失败。
  SourceManagementNotFoundError,

  // 导入来源: ./sourceManagementErrors.js。
  // 导入内容: SourceManagementOperationError 管理主操作错误。
  // 文件作用: 包装 Host 生命周期和协调骨架失败并保留 cause。
  SourceManagementOperationError,

  // 导入来源: ./sourceManagementErrors.js。
  // 导入内容: SourceManagementValidationError 管理输入错误。
  // 文件作用: 拒绝缺失依赖、额外字段和不可序列化设置意图。
  SourceManagementValidationError
} from './sourceManagementErrors.js';

// 类型: Array<string>。
// 作用: 管理 Runtime 工厂只接受这十项基础设施能力，阻止 Vue、store、DOM、完整注册表或第二 Runtime 进入组合层。
const SOURCE_MANAGEMENT_RUNTIME_DEPENDENCY_FIELDS = Object.freeze([
  'initialize',
  'getSourceManagerState',
  'subscribe',
  'sourceManager',
  'sourceExecutionHost',
  'sourceManagementInputAdapter',
  'sourcePackageLoader',
  'providerFactoryRegistrationPort',
  'sourceUpdatePort',
  'ensureSourceRunning'
]);

// 类型: Array<string>。
// 作用: 固定管理门面委托的 SourceManager 公共能力，避免直接读取 Repository 或 Manager 私有字段。
const SOURCE_MANAGER_METHOD_FIELDS = Object.freeze([
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
  'importSource',
  'applySourceUpdate',
  'deleteSources',
  'createSourceExportBundle'
]);

// 类型: Array<string>。
// 作用: 生命周期协调只读取 Host 隔离摘要并释放实例，不获得 Provider、Context 或内部 entry。
const SOURCE_EXECUTION_HOST_METHOD_FIELDS = Object.freeze([
  'getRuntimeState',
  'dispose'
]);

// 类型: Array<string>。
// 作用: 输入适配器只提供导入和更新两种纯命令构造能力。
const SOURCE_INPUT_ADAPTER_METHOD_FIELDS = Object.freeze([
  'createImportCommand',
  'createUpdateCommand'
]);

// 类型: Array<string>。
// 作用: 单文件加载器只向管理 Runtime 提供预检、信任后加载和工厂支持复核，不泄漏读取器或执行器。
const SOURCE_PACKAGE_LOADER_METHOD_FIELDS = Object.freeze([
  'preview',
  'load',
  'assertFactorySupports'
]);

// 类型: Array<string>。
// 作用: 管理 Runtime 只获得动态工厂注册和移除能力，不能查询或遍历完整注册表。
const PROVIDER_FACTORY_REGISTRATION_PORT_METHOD_FIELDS = Object.freeze([
  'register',
  'remove'
]);

// 类型: Array<string>。
// 作用: 更新检测和候选读取必须分离，用户确认前不能取得并应用更新包。
const SOURCE_UPDATE_PORT_METHOD_FIELDS = Object.freeze([
  'check',
  'getUpdateCandidate'
]);

// 类型: Array<string>。
// 作用: 正式导入只接收三入口原始输入与用户信任决定，不允许预览、manifest 或保存对象由页面回传。
const SOURCE_IMPORT_REQUEST_FIELDS = Object.freeze([
  'input',
  'trustDecision'
]);

// 类型: Array<string>。
// 作用: 固定设置管理门面十八项方法和 Object.keys 顺序，阻止内部队列、Manager、Host 或加载器引用泄漏。
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

/**
 * 校验对象包含固定函数字段，并按调用场景决定是否拒绝额外字段。
 * 纯函数: 不修改依赖对象，只返回原对象供闭包持有。
 * 失败路径: 非对象、缺字段、受控门面额外字段或非函数字段抛管理 validation。
 *
 * @param {*} value 依赖对象候选。
 * @param {Array<string>} fields 允许且必需的字段顺序。
 * @param {string} fieldName 诊断字段名。
 * @param {boolean} requireExactFields true 要求精确公开门面，false 允许类实例保留私有字段。
 * @returns {object} 原依赖对象。
 */
function assertFunctionDependencies(value, fields, fieldName, requireExactFields) {
  // 条件分支: 候选不是可调用方法容器时进入。
  // 执行内容: 在读取字段前拒绝 null、数组和标量；SourceManager/Host 类实例允许使用原型方法。
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SourceManagementValidationError(`${fieldName} 必须是对象`);
  }

  // 类型: Array<string>。
  // 作用: 保存候选真实可枚举字段，执行精确集合校验。
  const actualFields = Object.keys(value);

  // 条件分支: 字段数量或名称不符合冻结契约时进入。
  // 执行内容: 拒绝缺失能力和携带未声明内部引用的对象。
  if (requireExactFields && (actualFields.length !== fields.length
    || fields.some(field => !actualFields.includes(field)))) {
    throw new SourceManagementValidationError(`${fieldName} 字段集合无效`);
  }

  // 类型: string|undefined。
  // 作用: 保存第一项非函数字段，避免运行到操作中途才出现 TypeError。
  const invalidField = fields.find(field => typeof value[field] !== 'function');

  // 条件分支: 任一依赖字段不是函数时进入。
  // 执行内容: 拒绝半完成端口或伪造对象。
  if (invalidField) {
    throw new SourceManagementValidationError(`${fieldName}.${invalidField} 必须是函数`);
  }

  return value;
}

/**
 * 校验管理 Runtime 的完整依赖图。
 * 纯函数: 返回冻结浅层依赖对象，不调用初始化、Manager、Host、适配器或更新端口。
 * 失败路径: 根对象、精确字段或任一方法缺失时抛管理 validation。
 *
 * @param {*} dependencies 工厂依赖候选。
 * @returns {object} 冻结且字段完整的管理 Runtime 依赖。
 */
function normalizeDependencies(dependencies) {
  // 条件分支: 根依赖不是普通对象时进入。
  // 执行内容: 拒绝数组、null、类实例和异常原型。
  if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)
    || Object.getPrototypeOf(dependencies) !== Object.prototype) {
    throw new SourceManagementValidationError('sourceManagementRuntime dependencies 必须是普通对象');
  }

  // 类型: Array<string>。
  // 作用: 保存调用方实际依赖字段，阻止页面对象和内部基础设施意外泄漏。
  const actualFields = Object.keys(dependencies);

  // 条件分支: 根依赖缺字段或包含额外字段时进入。
  // 执行内容: 在创建 FIFO 前失败，避免形成半完成管理门面。
  if (actualFields.length !== SOURCE_MANAGEMENT_RUNTIME_DEPENDENCY_FIELDS.length
    || SOURCE_MANAGEMENT_RUNTIME_DEPENDENCY_FIELDS.some(
      field => !actualFields.includes(field)
    )) {
    throw new SourceManagementValidationError('sourceManagementRuntime dependencies 字段集合无效');
  }

  // 循环类型: Array.prototype.forEach。
  // 初始值: initialize。
  // 终止条件: 四个直接函数依赖全部通过。
  // 循环作用: 提前验证共享初始化、状态读取、订阅和按需启动能力；工厂资格只来自 Manager 投影。
  ['initialize', 'getSourceManagerState', 'subscribe', 'ensureSourceRunning']
    .forEach((field) => {
      // 条件分支: 当前直接依赖不是函数时进入。
      // 执行内容: 拒绝无法完成共享组合或补偿的 Runtime。
      if (typeof dependencies[field] !== 'function') {
        throw new SourceManagementValidationError(`sourceManagementRuntime.${field} 必须是函数`);
      }
    });

  assertFunctionDependencies(
    dependencies.sourceManager,
    SOURCE_MANAGER_METHOD_FIELDS,
    'sourceManagementRuntime.sourceManager',
    false
  );
  assertFunctionDependencies(
    dependencies.sourceExecutionHost,
    SOURCE_EXECUTION_HOST_METHOD_FIELDS,
    'sourceManagementRuntime.sourceExecutionHost',
    false
  );
  assertFunctionDependencies(
    dependencies.sourceManagementInputAdapter,
    SOURCE_INPUT_ADAPTER_METHOD_FIELDS,
    'sourceManagementRuntime.sourceManagementInputAdapter',
    true
  );
  assertFunctionDependencies(
    dependencies.sourcePackageLoader,
    SOURCE_PACKAGE_LOADER_METHOD_FIELDS,
    'sourceManagementRuntime.sourcePackageLoader',
    true
  );
  assertFunctionDependencies(
    dependencies.providerFactoryRegistrationPort,
    PROVIDER_FACTORY_REGISTRATION_PORT_METHOD_FIELDS,
    'sourceManagementRuntime.providerFactoryRegistrationPort',
    true
  );
  assertFunctionDependencies(
    dependencies.sourceUpdatePort,
    SOURCE_UPDATE_PORT_METHOD_FIELDS,
    'sourceManagementRuntime.sourceUpdatePort',
    true
  );

  // 返回值类型: object。
  // 作用: 冻结浅层依赖字段，防止调用方在 Runtime 创建后替换 Manager、Host 或端口引用。
  return Object.freeze({ ...dependencies });
}

/**
 * 在设置意图进入 FIFO 前隔离输入。
 * 纯函数: 返回严格 JSON 副本，不修改调用方对象或数组。
 * 失败路径: 函数、Symbol、BigInt、访问器、危险结构或循环引用转换为管理 validation。
 *
 * @param {*} value 设置意图输入。
 * @param {string} fieldName 诊断字段名。
 * @returns {*} 与调用方引用隔离的严格 JSON 值。
 */
function isolateIntentInput(value, fieldName) {
  try {
    return cloneSerializableValue(value, fieldName);
  } catch (error) {
    throw new SourceManagementValidationError(`${fieldName} 无效`, { cause: error });
  }
}

/**
 * 从 SourceManagerState 定位真实数据源记录。
 * 纯函数: 只读取隔离投影，不修改 records 或目标记录。
 * 失败路径: 未命中时抛稳定管理 notFound，不回退到别名或其他记录。
 *
 * @param {object} state 当前隔离 SourceManagerState。
 * @param {string} sourceId 已规范化真实数据源 id。
 * @returns {object} 目标隔离 SourceRecord。
 */
function findSourceRecord(state, sourceId) {
  // 类型: object|null。
  // 作用: 只使用 SourceRecord.definition.id 定位统一身份。
  const record = state.records.find(candidate => candidate.definition.id === sourceId) || null;

  // 条件分支: 投影没有目标记录时进入。
  // 执行内容: 阻止 Runtime 伪造记录或使用 sourceId 兼容别名。
  if (!record) {
    throw new SourceManagementNotFoundError(`数据源不存在: ${sourceId}`);
  }

  return record;
}

/**
 * 为影响当前默认源的操作创建明确交接。
 * 纯函数: 返回隔离 submittedHandoff、replace 命令或 clear 命令，不修改投影。
 * 选择规则: 优先使用页面明确提交；缺失时按 records 当前顺序选择未排除且有效启用的候选。
 *
 * @param {object} state 操作前或提交后 SourceManagerState。
 * @param {Array<string>} excludedSourceIds 本次会关闭、删除或失效的 sourceId。
 * @param {object|null|undefined} submittedHandoff 页面已提交的明确交接。
 * @returns {object|null} 不影响默认源时为 null，影响时为 replace 或 clear。
 */
function createDefaultHandoff(state, excludedSourceIds, submittedHandoff) {
  // 条件分支: 当前默认源不属于受影响集合时进入。
  // 执行内容: 返回调用方原交接或 null，让 Manager 继续拒绝不必要的额外交接。
  if (!excludedSourceIds.includes(state.defaultSourceId)) {
    return submittedHandoff === undefined || submittedHandoff === null
      ? null
      : isolateIntentInput(submittedHandoff, 'sourceManagementRuntime.handoff');
  }

  // 条件分支: 页面已经提交明确交接时进入。
  // 执行内容: 隔离后原样交给 Manager 执行最终候选不变量校验。
  if (submittedHandoff !== undefined && submittedHandoff !== null) {
    return isolateIntentInput(submittedHandoff, 'sourceManagementRuntime.handoff');
  }

  // 类型: object|null。
  // 作用: 按当前 records 稳定顺序选择未排除、未软隐藏、有效启用且 Provider 就绪的回退源。
  const fallbackRecord = state.records.find((record) => {
    // 类型: string。
    // 作用: 保存当前候选统一身份，参与排除集合、软隐藏集合和启用状态判断。
    const candidateId = record.definition.id;
    return !excludedSourceIds.includes(candidateId)
      && !state.removedSystemSourceIds.includes(candidateId)
      && record.runtime.enabled === true
      && record.runtime.providerReadiness.status === PROVIDER_READINESS_STATUS.ready;
  }) || null;

  // 条件分支: 存在有效回退记录时进入。
  // 执行内容: 生成 Manager 再次验证的明确 replace 命令。
  if (fallbackRecord) {
    return {
      mode: DEFAULT_SOURCE_HANDOFF_MODE.replace,
      sourceId: fallbackRecord.definition.id
    };
  }

  // 返回值类型: object。
  // 作用: 没有回退源时明确进入无默认源状态，不使用模糊 Boolean。
  return { mode: DEFAULT_SOURCE_HANDOFF_MODE.clear };
}

/**
 * 只在需要时给 Manager 命令附加 handoff。
 * 纯函数: 返回新对象，不修改 baseCommand 或 handoff。
 *
 * @param {object} baseCommand 不含 handoff 的基础命令。
 * @param {object|null} handoff 明确交接或 null。
 * @returns {object} 可交给 SourceManager 的新命令。
 */
function createManagerCommand(baseCommand, handoff) {
  // 三目条件: handoff 是否存在。
  // true 分支: 创建包含明确交接的新命令。
  // false 分支: 创建不含 handoff 字段的新命令，避免 undefined 进入精确字段校验。
  return handoff ? { ...baseCommand, handoff } : { ...baseCommand };
}

/**
 * 校验正式导入请求只包含原始三入口输入和用户信任决定。
 * 纯函数: 返回已经由 FIFO 入队边界隔离的原对象，不执行脚本或修改字段。
 * 失败路径: 根对象缺失、字段不精确或两个子对象不是普通对象时抛管理 validation。
 *
 * @param {*} request 已隔离的正式导入请求候选。
 * @returns {object} input 与 trustDecision 精确请求。
 */
function normalizeSourceImportRequest(request) {
  // 条件分支: 根请求不是普通对象时进入。
  // 执行内容: 在加载器读取文件、网络或脚本文本前失败关闭。
  if (!request
    || typeof request !== 'object'
    || Array.isArray(request)
    || Object.getPrototypeOf(request) !== Object.prototype) {
    throw new SourceManagementValidationError('importSource.request 必须是普通对象');
  }

  // 类型: Array<string>。
  // 作用: 读取正式导入真实字段，用于拒绝页面回传预览、manifest 或授权时间。
  const requestFields = Object.keys(request);

  // 条件分支: 字段数量或名称不符合冻结请求时进入。
  // 执行内容: 防止页面绕过加载器自行提交已解析制品。
  if (requestFields.length !== SOURCE_IMPORT_REQUEST_FIELDS.length
    || SOURCE_IMPORT_REQUEST_FIELDS.some(field => !requestFields.includes(field))) {
    throw new SourceManagementValidationError('importSource.request 字段集合无效');
  }

  // 循环类型: Array.prototype.forEach。
  // 初始值: input。
  // 终止条件: input 与 trustDecision 都通过普通对象校验。
  // 循环作用: 让下层精确字段校验可以安全读取两个独立输入域。
  SOURCE_IMPORT_REQUEST_FIELDS.forEach((field) => {
    // 类型: *。
    // 作用: 保存当前导入请求子对象候选。
    const value = request[field];

    // 条件分支: 子对象不是普通对象时进入。
    // 执行内容: 拒绝数组、类实例和空值进入加载边界。
    if (!value
      || typeof value !== 'object'
      || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) {
      throw new SourceManagementValidationError(`importSource.request.${field} 必须是普通对象`);
    }
  });

  return request;
}

/**
 * 创建设置管理 Runtime 门面。
 * 副作用: 创建当前门面私有单一 FIFO 尾 Promise；不初始化 Manager、Host 或 Provider。
 * 成功路径: 返回十八方法冻结门面，全部设置意图共享同一串行队列。
 * 失败路径: 依赖不完整时同步抛管理 validation，运行失败保留 Manager/Host cause。
 *
 * @param {object} dependencies 管理 Runtime 基础设施依赖。
 * @returns {object} 冻结 SourceManagementRuntime 门面。
 */
export function createSourceManagementRuntime(dependencies) {
  // 类型: object。
  // 作用: 保存字段完整且引用不可替换的 Manager、Host、适配器、端口和共享 Runtime 能力。
  const safeDependencies = normalizeDependencies(dependencies);

  // 类型: Promise<void>。
  // 作用: 保存前一设置意图收敛后的 fulfilled 队尾，失败不会阻塞后续合法意图。
  let intentQueueTail = Promise.resolve();

  /**
   * 把一个完整设置意图加入单一 FIFO。
   * 副作用: 更新私有队尾；action 的 Manager、Host 和补偿副作用只在取得执行权后发生。
   * 成功路径: 返回当前 action 真实结果。
   * 失败路径: 当前调用保留真实拒绝，私有队尾转换为 fulfilled 以允许下一意图继续。
   *
   * @param {Function} action 已隔离输入的完整设置意图。
   * @returns {Promise<*>} 当前设置意图结果。
   */
  function enqueueIntent(action) {
    // 类型: Promise<*>。
    // 作用: 无论前一任务成功或失败，都在其收敛后执行当前 action，保持调用顺序。
    const operation = intentQueueTail.then(action, action);

    // 副作用范围: 只更新当前门面私有 FIFO 尾；catch 吞掉的是队尾状态，不改变返回给当前调用方的 operation。
    intentQueueTail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  /**
   * 读取全部 SourceRecord 对应的 Host 隔离摘要。
   * 副作用: 只调用 Host.getRuntimeState，不停止、启动或修改 entry。
   * 成功路径: 返回与 records 顺序一致的 sourceId/runtimeState 数组。
   * 失败路径: Host 读取失败原样拒绝，由调用骨架包装为操作错误。
   *
   * @param {object} state 操作前 SourceManagerState。
   * @returns {Promise<Array<object>>} Host 摘要列表。
   */
  async function captureHostStates(state) {
    // 循环类型: Promise.all + Array.prototype.map。
    // 初始值: state.records 第一条记录。
    // 终止条件: 全部记录完成 Host 摘要读取。
    // 循环作用: 在任何 dispose 前建立同一时点的真实运行集合证据。
    return Promise.all(state.records.map(async (record) => {
      // 类型: string。
      // 作用: 保存当前记录统一身份，作为 Host 隔离摘要查询键。
      const sourceId = record.definition.id;

      // 类型: object|null。
      // 作用: 保存当前 Host entry 的隔离摘要；null 表示从未创建或已经成功释放。
      const runtimeState = await safeDependencies.sourceExecutionHost.getRuntimeState(sourceId);
      return { sourceId, runtimeState };
    }));
  }

  /**
   * 判断投影记录当前是否应拥有可信运行实例。
   * 纯函数: 只读取投影和可信工厂注册判断，不启动 Host。
   *
   * @param {object} state 当前 SourceManagerState。
   * @param {object} record 当前 SourceRecord。
   * @returns {boolean} true 表示启用、可见且 Manager 投影确认 Provider 就绪；false 表示不应执行。
   */
  function shouldRunRecord(state, record) {
    // 类型: string。
    // 作用: 保存记录真实身份，用于软隐藏集合判断并保持 Manager、Host 与工厂注册表同源。
    const sourceId = record.definition.id;
    return record.runtime.enabled === true
      && !state.removedSystemSourceIds.includes(sourceId)
      && record.runtime.providerReadiness.status === PROVIDER_READINESS_STATUS.ready;
  }

  /**
   * 关闭 Host 启动失败后已经提交的 enabled 状态，并清理可能残留的 Host entry。
   * 副作用: 调用 SourceManager.setSourceEnabled(false)，随后在存在 entry 时调用 Host.dispose。
   * 成功路径: 保存态关闭且 Host 不再持有目标实例。
   * 失败路径: 任一补偿失败抛 SourceManagementCompensationError，同时保留启动失败和补偿失败。
   *
   * @param {string} sourceId 启动失败的数据源 id。
   * @param {*} operationCause Host 启动原始失败。
   * @returns {Promise<void>} 补偿完成后结束。
   */
  async function compensateFailedStart(sourceId, operationCause) {
    try {
      // 类型: object。
      // 作用: 读取启动失败后的最新提交投影，确保关闭补偿基于真实默认源状态。
      const state = await safeDependencies.getSourceManagerState();

      // 类型: object|null。
      // 作用: 目标成为默认源时生成明确回退或 clear，其他情况不附加交接。
      const handoff = createDefaultHandoff(state, [sourceId], null);
      await safeDependencies.sourceManager.setSourceEnabled(
        createManagerCommand({ sourceId, enabled: false }, handoff)
      );

      // 类型: object|null。
      // 作用: 检查启动失败是否留下 initialized、failed 或其他 Host entry，存在时执行完整释放。
      const runtimeState = await safeDependencies.sourceExecutionHost.getRuntimeState(sourceId);

      // 条件分支: 启动失败仍留下 Host entry 时进入。
      // 执行内容: 在保存态关闭后释放 Provider、Context 和控制器引用。
      if (runtimeState) {
        await safeDependencies.sourceExecutionHost.dispose(sourceId);
      }
    } catch (compensationCause) {
      throw new SourceManagementCompensationError(
        `数据源启动失败后的关闭补偿失败: ${sourceId}`,
        operationCause,
        compensationCause
      );
    }
  }

  /**
   * 在 Manager 已提交启用决定后启动可信源。
   * 副作用: 对具有受审工厂的记录调用 ensureSourceRunning；未解析自定义源保持不执行。
   * 成功路径: 可信源 Host running 或未解析源只保存用户决定后返回提交投影。
   * 失败路径: 启动失败先执行关闭补偿，再抛保留 cause 的管理 operation。
   *
   * @param {object} committedState Manager 提交后的隔离投影。
   * @param {string} sourceId 目标数据源 id。
   * @returns {Promise<object>} Manager 提交投影。
   */
  async function startCommittedSource(committedState, sourceId) {
    // 类型: object。
    // 作用: 定位 Manager 刚提交的真实记录，用于可信工厂和可见启用门禁。
    const record = findSourceRecord(committedState, sourceId);

    // 条件分支: 保存启用决定但 providerKey 没有受审工厂时进入。
    // 执行内容: 不调用 Host、不执行脚本文本，也不伪造 running。
    if (!shouldRunRecord(committedState, record)) {
      return committedState;
    }

    try {
      await safeDependencies.ensureSourceRunning(sourceId);
      return committedState;
    } catch (error) {
      await compensateFailedStart(sourceId, error);
      throw new SourceManagementOperationError(`数据源启动失败并已关闭: ${sourceId}`, error);
    }
  }

  /**
   * 按投影恢复指定集合中仍应运行的可信源。
   * 副作用: 顺序调用 ensureSourceRunning；启动失败时对该源执行关闭补偿。
   * 成功路径: 全部目标已运行、无需运行或已经从新投影删除。
   * 失败路径: 第一项启动失败完成补偿后抛管理 operation，后续目标不再启动。
   *
   * @param {object} state Manager 当前稳定投影。
   * @param {Array<string>} sourceIds 待恢复目标集合。
   * @param {boolean} disableOnFailure true 表示提交后启动失败需关闭补偿，false 表示回滚恢复失败只上报。
   * @returns {Promise<void>} 恢复完成后结束。
   */
  async function restoreRequiredSources(state, sourceIds, disableOnFailure = true) {
    // 循环类型: for...of。
    // 初始值: sourceIds 第一项。
    // 终止条件: 全部目标恢复、跳过或第一项失败收敛。
    // 循环作用: 逐源复查新投影门禁，避免并发补偿相互覆盖默认源状态。
    for (const sourceId of sourceIds) {
      // 类型: object|null。
      // 作用: 从指定稳定投影定位恢复候选；删除后的源为 null 并直接跳过。
      const record = state.records.find(candidate => candidate.definition.id === sourceId) || null;

      // 条件分支: 记录已删除、已关闭、软隐藏或没有受审工厂时进入。
      // 执行内容: 不调用 Host，也不伪造 running。
      if (!record || !shouldRunRecord(state, record)) {
        continue;
      }

      try {
        await safeDependencies.ensureSourceRunning(sourceId);
      } catch (error) {
        // 条件分支: Manager 已成功提交新投影时进入。
        // 执行内容: 关闭无法恢复的可信源，避免保存 enabled=true 与 Host 不可运行分裂。
        if (disableOnFailure) {
          await compensateFailedStart(sourceId, error);
          throw new SourceManagementOperationError(`数据源恢复运行失败并已关闭: ${sourceId}`, error);
        }

        // 错误类型: SourceManagementOperationError。
        // 作用: Manager 已回滚时只上报原运行集合恢复失败，不再改变已回滚保存态。
        throw new SourceManagementOperationError(`原运行数据源恢复失败: ${sourceId}`, error);
      }
    }
  }

  /**
   * 执行关闭、撤销、删除、更新或缓存清理的统一破坏类骨架。
   * 副作用: 捕获真实 Host 状态，释放受影响 entry，执行 Manager 事务，并按成功或失败结果恢复。
   * 成功路径: 返回 Manager 新稳定投影，且受影响可信运行集合与新投影一致。
   * 失败路径: dispose 失败不进入 Manager；Manager 失败恢复原 running；恢复失败保留补偿错误。
   *
   * @param {Array<string>} affectedSourceIds 本次可能读取或修改运行数据的 sourceId。
   * @param {Function} managerAction 全部 Host 释放成功后执行的 Manager 事务。
   * @returns {Promise<object>} Manager 成功投影。
   */
  async function runDestructiveIntent(affectedSourceIds, managerAction) {
    // 类型: object。
    // 作用: 保存任何 Host 释放前的稳定 Manager 投影，供真实 running 捕获和事务失败恢复。
    const previousState = await safeDependencies.getSourceManagerState();

    // 类型: Array<object>|undefined。
    // 作用: 保存全部 Host 隔离摘要；只有捕获完整后才允许释放受影响 entry。
    let hostStates;

    // 类型: Array<string>。
    // 作用: 保存操作前确实 phase=running 的受影响源；释放中途失败时据此恢复已经被释放的运行集合。
    let previouslyRunningSourceIds = [];

    try {
      hostStates = await captureHostStates(previousState);

      // 执行内容: 在第一次 dispose 前冻结真实 running 集合，避免中途失败后再从已变化 Host 状态反推补偿目标。
      previouslyRunningSourceIds = hostStates
        .filter(hostState => affectedSourceIds.includes(hostState.sourceId)
          && hostState.runtimeState?.phase === SOURCE_EXECUTION_HOST_PHASE.running)
        .map(hostState => hostState.sourceId);

      // 循环类型: for...of。
      // 初始值: hostStates 第一项。
      // 终止条件: 全部受影响 entry 释放或第一项失败。
      // 循环作用: 保证 Manager 事务开始前没有 Provider 继续使用将被修改的数据。
      for (const hostState of hostStates) {
        // 条件分支: 当前 entry 属于受影响集合且真实存在时进入。
        // 执行内容: 委托 Host 完整 stop/dispose；未创建 entry 保持幂等跳过。
        if (affectedSourceIds.includes(hostState.sourceId) && hostState.runtimeState) {
          await safeDependencies.sourceExecutionHost.dispose(hostState.sourceId);
        }
      }
    } catch (error) {
      try {
        // 执行内容: Manager 尚未执行，按原投影恢复全部原 running 源；仍在运行的失败目标由 ensureSourceRunning 幂等采用。
        await restoreRequiredSources(previousState, previouslyRunningSourceIds, false);
      } catch (compensationCause) {
        throw new SourceManagementCompensationError(
          '运行实例释放失败后的原运行集合恢复失败',
          error,
          compensationCause
        );
      }
      throw new SourceManagementOperationError(
        '数据源运行实例释放失败，保存事务未执行且原运行集合已恢复',
        error
      );
    }

    // 类型: object|undefined。
    // 作用: 保存 Manager 事务成功后的新稳定投影；失败分支不采用候选值。
    let committedState;
    try {
      committedState = await managerAction(previousState);
    } catch (error) {
      try {
        await restoreRequiredSources(previousState, previouslyRunningSourceIds, false);
      } catch (compensationCause) {
        throw new SourceManagementCompensationError(
          'Manager 事务失败后的运行集合恢复失败',
          error,
          compensationCause
        );
      }
      throw new SourceManagementOperationError('Manager 事务失败，原运行集合已恢复', error);
    }

    await restoreRequiredSources(committedState, affectedSourceIds);
    return committedState;
  }

  /**
   * 规范化管理 Runtime 的 sourceId。
   * 纯函数: 复用 Shell 身份规则，不修改输入。
   * 失败路径: Shell 校验失败转换为管理 validation 并保留 cause。
   *
   * @param {*} sourceId 身份候选。
   * @param {string} fieldName 诊断字段名。
   * @returns {string} Manager、Host 和 Provider 共用的真实 sourceId。
   */
  function normalizeSourceId(sourceId, fieldName) {
    try {
      return normalizeSourceShellId(sourceId, fieldName);
    } catch (error) {
      throw new SourceManagementValidationError(`${fieldName} 无效`, { cause: error });
    }
  }

  /**
   * 串行设置唯一默认源。
   * 副作用: 通过 SourceManager 事务更新 Preferences 并发布新投影。
   *
   * @param {*} sourceId 默认源身份候选。
   * @returns {Promise<object>} 提交后的 SourceManagerState。
   */
  function setDefaultSource(sourceId) {
    // 类型: string。
    // 作用: 保存排队前已规范化身份，调用方后续修改不能改变目标。
    const safeSourceId = normalizeSourceId(sourceId, 'setDefaultSource.sourceId');
    return enqueueIntent(() => safeDependencies.sourceManager.setDefaultSource(safeSourceId));
  }

  /**
   * 检测单个数据源健康状态。
   * 副作用: SourceManager 统一执行 FIFO、同源在途去重、checking 和最终稳定投影，端口可能按需启动可信 Provider。
   *
   * @param {*} sourceId 检测目标身份候选。
   * @returns {Promise<object>} 检测完成后的 SourceManagerState。
   */
  function checkSource(sourceId) {
    // 类型: string。
    // 作用: 保存排队前已规范化检测目标。
    const safeSourceId = normalizeSourceId(sourceId, 'checkSource.sourceId');
    // 返回值类型: Promise<object>；作用: 直接进入 Manager 唯一健康事务边界，避免 Runtime 外层 FIFO 把同源并发意图拆成两次顺序检查。
    return safeDependencies.sourceManager.checkSource(safeSourceId);
  }

  /**
   * 串行检测全部有效启用源。
   * 副作用: SourceManager 发布 checkingAll、逐源检测和最终稳定投影。
   *
   * @returns {Promise<object>} 全部检测完成后的 SourceManagerState。
   */
  function checkAllSources() {
    return enqueueIntent(() => safeDependencies.sourceManager.checkAllSources());
  }

  /**
   * 串行检查一个在线导入源是否有更新。
   * 副作用: SourceManager 通过同一 SourceUpdatePort 发布 checkingUpdate 和检测结果。
   *
   * @param {*} sourceId 在线源身份候选。
   * @returns {Promise<object>} 更新检测完成后的 SourceManagerState。
   */
  function checkSourceUpdate(sourceId) {
    // 类型: string。
    // 作用: 保存排队前已规范化更新检测目标。
    const safeSourceId = normalizeSourceId(sourceId, 'checkSourceUpdate.sourceId');
    return enqueueIntent(() => safeDependencies.sourceManager.checkSourceUpdate(safeSourceId));
  }

  /**
   * 串行启用或关闭数据源。
   * 副作用: 启用时 Manager 提交后启动可信 Host；关闭时先释放 Host 再提交 Manager，并执行失败补偿。
   *
   * @param {*} command 启停命令候选。
   * @returns {Promise<object>} 成功提交后的 SourceManagerState。
   */
  function setSourceEnabled(command) {
    // 类型: object。
    // 作用: 保存排队前严格隔离的启停命令，等待期间不再读取调用方引用。
    const safeCommand = isolateIntentInput(command, 'setSourceEnabled.command');
    return enqueueIntent(async () => {
      // 类型: object。
      // 作用: 读取当前稳定投影，关闭路径据此创建明确默认源交接。
      const state = await safeDependencies.getSourceManagerState();

      // 类型: string。
      // 作用: 保存启停目标真实身份，供 Manager、Host 和补偿共用。
      const sourceId = normalizeSourceId(safeCommand.sourceId, 'setSourceEnabled.command.sourceId');

      // 条件分支: enabled 不是严格 Boolean 时进入。
      // 执行内容: 在任何 Host 释放或 Manager 事务前拒绝 0、1、字符串和其他模糊输入。
      if (typeof safeCommand.enabled !== 'boolean') {
        throw new SourceManagementValidationError('setSourceEnabled.command.enabled 必须是 boolean');
      }

      // 条件分支: 用户要求启用目标时进入。
      // 执行内容: Manager 先提交 enabled=true，再启动可信 Host；失败由 startCommittedSource 关闭补偿。
      if (safeCommand.enabled === true) {
        // 类型: object。
        // 作用: 保存 Manager 已提交启用决定后的稳定投影，作为 Host 门禁输入来源。
        const committedState = await safeDependencies.sourceManager.setSourceEnabled(safeCommand);
        return startCommittedSource(committedState, sourceId);
      }

      // 类型: object|null。
      // 作用: 关闭当前默认源时保存明确回退/clear；其他情况保持 null。
      const handoff = createDefaultHandoff(state, [sourceId], safeCommand.handoff);

      // 类型: object。
      // 作用: 保存精确关闭命令，避免 undefined handoff 进入 Manager 字段校验。
      const managerCommand = createManagerCommand({ sourceId, enabled: safeCommand.enabled }, handoff);
      return runDestructiveIntent(
        [sourceId],
        () => safeDependencies.sourceManager.setSourceEnabled(managerCommand)
      );
    });
  }

  /**
   * 串行授权自定义源，并按用户决定选择是否同时启用。
   * 副作用: Manager 保存当前版本/指纹授权；同时启用时复用可信启动和关闭补偿。
   *
   * @param {*} command 授权命令候选。
   * @returns {Promise<object>} 授权提交后的 SourceManagerState。
   */
  function authorizeSource(command) {
    // 类型: object。
    // 作用: 保存排队前严格隔离的授权时间、sourceId 和同时启用决定。
    const safeCommand = isolateIntentInput(command, 'authorizeSource.command');
    return enqueueIntent(async () => {
      // 类型: object。
      // 作用: 保存 Manager 已提交授权和 enabled 决定后的稳定投影。
      const committedState = await safeDependencies.sourceManager.authorizeSource(safeCommand);

      // 条件分支: 用户只授权但不要求启用时进入。
      // 执行内容: 返回保存结果，不调用 Host。
      if (safeCommand.enableAfterAuthorization !== true) {
        return committedState;
      }
      return startCommittedSource(committedState, safeCommand.sourceId);
    });
  }

  /**
   * 串行撤销自定义源授权。
   * 副作用: 先释放目标 Host，再提交 revoked、enabled=false 和必要默认源交接；失败恢复原 running。
   *
   * @param {*} command 撤销授权命令候选。
   * @returns {Promise<object>} 撤销提交后的 SourceManagerState。
   */
  function revokeSourceAuthorization(command) {
    // 类型: object。
    // 作用: 保存排队前严格隔离的撤销命令。
    const safeCommand = isolateIntentInput(command, 'revokeSourceAuthorization.command');
    return enqueueIntent(async () => {
      // 类型: object。
      // 作用: 保存操作前投影，判断撤销是否影响当前默认源。
      const state = await safeDependencies.getSourceManagerState();

      // 类型: string。
      // 作用: 保存撤销目标真实身份。
      const sourceId = normalizeSourceId(
        safeCommand.sourceId,
        'revokeSourceAuthorization.command.sourceId'
      );
      // 类型: object|null。
      // 作用: 保存页面提交或按旧页面规则派生的明确默认源交接。
      const handoff = createDefaultHandoff(state, [sourceId], safeCommand.handoff);

      // 类型: object。
      // 作用: 保存不含 undefined 字段的 Manager 撤销命令。
      const managerCommand = createManagerCommand({ sourceId }, handoff);
      return runDestructiveIntent(
        [sourceId],
        () => safeDependencies.sourceManager.revokeSourceAuthorization(managerCommand)
      );
    });
  }

  /**
   * 串行恢复软隐藏系统源。
   * 副作用: Manager 移除软隐藏 id，随后只启动恢复后仍启用且具有受审工厂的源。
   *
   * @param {*} sourceIds 恢复目标数组候选。
   * @returns {Promise<object>} 恢复提交后的 SourceManagerState。
   */
  function restoreSystemSources(sourceIds) {
    // 类型: Array<string>。
    // 作用: 保存排队前隔离的恢复目标；Manager 继续负责非空、去重和系统源不变量。
    const safeSourceIds = isolateIntentInput(sourceIds, 'restoreSystemSources.sourceIds');
    return enqueueIntent(async () => {
      // 类型: object。
      // 作用: 保存软隐藏集合提交后的稳定投影，作为恢复可信 Host 的唯一门禁来源。
      const committedState = await safeDependencies.sourceManager.restoreSystemSources(safeSourceIds);
      await restoreRequiredSources(committedState, safeSourceIds);
      return committedState;
    });
  }

  /**
   * 串行清理 cache 和 diagnostics 临时缓存。
   * 副作用: 先释放目标 Host，再由 Manager UnitOfWork 清理并按新投影恢复可信源。
   *
   * @param {*} sourceId 缓存命名空间身份候选。
   * @returns {Promise<object>} 缓存摘要更新后的 SourceManagerState。
   */
  function clearTemporarySourceCache(sourceId) {
    // 类型: string。
    // 作用: 保存排队前已规范化缓存清理目标。
    const safeSourceId = normalizeSourceId(sourceId, 'clearTemporarySourceCache.sourceId');
    return enqueueIntent(() => runDestructiveIntent(
      [safeSourceId],
      () => safeDependencies.sourceManager.clearTemporarySourceCache(safeSourceId)
    ));
  }

  /**
   * 串行清理 credentials、session、cache 和 diagnostics，保留 settings。
   * 副作用: 先释放目标 Host，再由 Manager UnitOfWork 清理并按新投影恢复可信源。
   *
   * @param {*} sourceId 缓存命名空间身份候选。
   * @returns {Promise<object>} 缓存摘要更新后的 SourceManagerState。
   */
  function clearAllSourceCache(sourceId) {
    // 类型: string。
    // 作用: 保存排队前已规范化全部缓存清理目标。
    const safeSourceId = normalizeSourceId(sourceId, 'clearAllSourceCache.sourceId');
    return enqueueIntent(() => runDestructiveIntent(
      [safeSourceId],
      () => safeDependencies.sourceManager.clearAllSourceCache(safeSourceId)
    ));
  }

  /**
   * 串行预检一个三入口单文件输入。
   * 副作用: 远程入口通过受控 NetworkAdapter 读取文本；不执行脚本、不注册工厂、不写 Repository 或 Host。
   * 成功路径: 返回不含 scriptContent 和工厂引用的 SourceImportPreview。
   * 失败路径: 读取、容量、AST 或 manifest 失败时保留稳定 SourcePackageLoadError。
   *
   * @param {*} input 文件、HTTPS 远程地址或粘贴文本共同输入候选。
   * @returns {Promise<object>} 信任前安全预览。
   */
  function previewSourceImport(input) {
    // 类型: object。
    // 作用: 在入队前隔离三入口原始输入，页面后续修改表单不会改变本次预检。
    const safeInput = isolateIntentInput(input, 'previewSourceImport.input');
    return enqueueIntent(() => {
      // 类型: string。
      // 作用: 在预检真正取得 FIFO 执行权后生成来源时间；预览不提前消耗排队时间语义。
      const previewedAt = new Date().toISOString();
      return safeDependencies.sourcePackageLoader.preview(safeInput, previewedAt);
    });
  }

  /**
   * 移除本次已经成功注册的动态 ProviderFactory。
   * 副作用: 调用裁剪注册端口删除 providerKey 映射；不接触 Host 或 Repository。
   * 成功路径: 注册映射存在或已不存在时均收敛为无动态工厂状态。
   * 失败路径: 注册端口抛错时抛补偿错误，由调用方保留主操作失败。
   *
   * @param {string} providerKey 本次动态工厂唯一键。
   * @param {*} operationCause 触发注册回滚的主操作失败。
   * @returns {void} 工厂移除调用完成后结束。
   */
  function compensateRegisteredProviderFactory(providerKey, operationCause) {
    try {
      // 副作用范围: 只修改当前 Bundle 私有工厂 Map；false 表示映射已不存在，同样没有残留引用。
      safeDependencies.providerFactoryRegistrationPort.remove(providerKey);
    } catch (compensationCause) {
      throw new SourceManagementCompensationError(
        `动态 ProviderFactory 回滚失败: ${providerKey}`,
        operationCause,
        compensationCause
      );
    }
  }

  /**
   * 回滚已经保存但启动失败的首次导入源。
   * 副作用: SourceManager 物理删除自定义 Package、Definition、Preferences 和 Storage，随后移除动态工厂。
   * 成功路径: 保存图和注册表都回到正式导入前状态。
   * 失败路径: 保存删除或工厂移除失败时抛补偿错误，同时保留启动主因。
   *
   * @param {string} sourceId 本次首次导入的自定义源 id。
   * @param {string} providerKey 本次已注册的动态工厂键。
   * @param {*} operationCause 启动失败及其关闭补偿结果。
   * @returns {Promise<void>} 逆序补偿完成后结束。
   */
  async function rollbackFailedSourceImport(sourceId, providerKey, operationCause) {
    try {
      // 异步调用: 首次导入不会自动成为默认源；启动失败已由 startCommittedSource 关闭，因此删除命令无需 handoff。
      // resolve: Repository 图已物理移除目标自定义源；reject: Manager 事务自行回滚并保留记录。
      await safeDependencies.sourceManager.deleteSources({ sourceIds: [sourceId] });
    } catch (compensationCause) {
      throw new SourceManagementCompensationError(
        `启动失败后的导入保存图回滚失败: ${sourceId}`,
        operationCause,
        compensationCause
      );
    }

    // 执行内容: 保存图删除成功后移除对应动态工厂，恢复导入前注册状态。
    compensateRegisteredProviderFactory(providerKey, operationCause);
  }

  /**
   * 串行导入一个自定义数据源。
   * 副作用: 重新读取并执行已确认脚本、注册动态工厂、原子保存四个对象域，并按用户决定可选启动。
   * 成功路径: 当前文本哈希仍等于预览确认值，工厂支持 Definition，保存和可选启动全部收敛。
   * 失败路径: 注册、保存或启动失败按已发生副作用逆序移除 Host、保存图和动态工厂。
   *
   * @param {*} request 三入口原始输入与用户信任决定。
   * @returns {Promise<object>} 导入提交后的 SourceManagerState。
   */
  function importSource(request) {
    // 类型: object。
    // 作用: 保存排队前严格隔离的输入和信任决定，组件等待期间修改表单不会改变执行内容。
    const safeRequest = isolateIntentInput(request, 'importSource.request');
    return enqueueIntent(async () => {
      // 类型: object。
      // 作用: 在读取或执行脚本前拒绝页面回传预览、manifest、授权时间或保存对象。
      const normalizedRequest = normalizeSourceImportRequest(safeRequest);

      // 类型: string。
      // 作用: 在正式导入取得 FIFO 执行权后生成唯一导入和授权确认时间。
      const importedAt = new Date().toISOString();

      // 类型: object。
      // 作用: 重新读取、复检并核对确认 SHA-256 后执行模块，结果仍未注册或持久化。
      const loadedPackage = await safeDependencies.sourcePackageLoader.load(
        normalizedRequest.input,
        normalizedRequest.trustDecision,
        importedAt
      );

      // 类型: object。
      // 作用: 只从加载器载荷、静态 manifest 和 Runtime 时间生成完整 Manager 命令。
      const command = safeDependencies.sourceManagementInputAdapter.createImportCommand({
        payload: loadedPackage.payload,
        manifest: loadedPackage.manifest,
        authorizedAt: importedAt,
        enableAfterImport: loadedPackage.enableAfterImport
      });

      // 执行内容: 注册前要求受信任工厂明确支持由同一 manifest 映射的 Definition。
      safeDependencies.sourcePackageLoader.assertFactorySupports(
        loadedPackage.providerFactory,
        command.sourceDefinition
      );

      // 类型: string。
      // 作用: 保存 manifest、Package、Definition 与工厂共同使用的唯一注册键。
      const providerKey = command.sourceDefinition.providerKey;

      try {
        // 副作用范围: 向当前 Bundle 私有注册表写入一个冻结工厂门面；冲突时不覆盖旧工厂。
        safeDependencies.providerFactoryRegistrationPort.register(
          providerKey,
          loadedPackage.providerFactory
        );
      } catch (error) {
        throw new SourcePackageLoadError({
          code: SOURCE_PACKAGE_ERROR_CODE.registrationConflict,
          stage: SOURCE_PACKAGE_LOAD_STAGE.register,
          message: 'ProviderFactory 注册失败，数据源身份可能已经存在。',
          field: 'sourceManifest.providerKey'
        });
      }

      // 类型: object|undefined。
      // 作用: 保存 SourceManager 原子事务成功后的投影；失败时不得继续启动 Host。
      let committedState;
      try {
        committedState = await safeDependencies.sourceManager.importSource(command);
      } catch (error) {
        // 执行内容: Manager 自身已回滚 Repository；Runtime 只需移除先发生的动态注册副作用。
        compensateRegisteredProviderFactory(providerKey, error);
        throw new SourceManagementOperationError('数据源导入保存事务失败，动态工厂已移除', error);
      }

      // 条件分支: 用户明确选择只导入不启用时进入。
      // 执行内容: 返回已授权但关闭的保存投影，工厂保留供后续启用。
      if (loadedPackage.enableAfterImport === false) {
        return committedState;
      }

      try {
        return await startCommittedSource(committedState, command.sourceDefinition.id);
      } catch (error) {
        // 异步补偿: startCommittedSource 已关闭并释放失败 Host；继续物理删除首次导入保存图和动态工厂。
        await rollbackFailedSourceImport(
          command.sourceDefinition.id,
          providerKey,
          error
        );
        throw error;
      }
    });
  }

  /**
   * 串行应用受审模拟更新候选。
   * 副作用: 读取候选、构造完整命令、释放目标 Host、提交 Manager 更新并按新授权状态决定是否恢复。
   *
   * @param {*} sourceId 更新目标身份候选。
   * @returns {Promise<object>} 更新提交后的 SourceManagerState。
   */
  function applySourceUpdate(sourceId) {
    // 类型: string。
    // 作用: 保存排队前已规范化更新目标。
    const safeSourceId = normalizeSourceId(sourceId, 'applySourceUpdate.sourceId');
    return enqueueIntent(async () => {
      // 类型: object。
      // 作用: 保存操作前稳定投影，提供当前记录和默认源交接依据。
      const state = await safeDependencies.getSourceManagerState();

      // 类型: object。
      // 作用: 保存更新前 SourceRecord，端口和适配器不能读取 Manager 私有状态。
      const record = findSourceRecord(state, safeSourceId);

      // 类型: object。
      // 作用: 保存 SourceUpdatePort 返回的受审 Package/Definition 候选；用户确认前检测流程不会读取它。
      const candidate = await safeDependencies.sourceUpdatePort.getUpdateCandidate(record);

      // 类型: object。
      // 作用: 保存适配器校验稳定身份后生成的完整 Manager 更新命令。
      const baseCommand = safeDependencies.sourceManagementInputAdapter.createUpdateCommand(
        record,
        candidate
      );
      // 类型: boolean。
      // 作用: true 表示自定义源业务版本或脚本指纹变化，Manager 会关闭并使旧授权失效；false 表示无需交接。
      const invalidatesAuthorization = record.definition.sourceKind === SOURCE_KIND.custom
        && (baseCommand.sourceDefinition.version !== record.definition.version
          || baseCommand.sourcePackage.integrity.scriptHash !== record.runtime.currentScriptHash);
      // 类型: object|null。
      // 作用: 只有更新会关闭当前默认自定义源时创建明确回退或 clear 命令。
      const handoff = invalidatesAuthorization
        ? createDefaultHandoff(state, [safeSourceId], null)
        : null;
      // 类型: object。
      // 作用: 保存字段精确的 Manager 更新命令，非失效更新不携带 handoff。
      const managerCommand = createManagerCommand(baseCommand, handoff);
      return runDestructiveIntent(
        [safeSourceId],
        () => safeDependencies.sourceManager.applySourceUpdate(managerCommand)
      );
    });
  }

  /**
   * 串行删除系统源和自定义源混合目标集合。
   * 副作用: 释放整批 Host 后由 Manager 一笔事务完成软隐藏、物理删除、Storage 清理和默认源交接。
   *
   * @param {*} command 批量删除命令候选。
   * @returns {Promise<object>} 整批删除提交后的 SourceManagerState。
   */
  function deleteSources(command) {
    // 类型: object。
    // 作用: 保存排队前严格隔离的目标集合和可选页面交接。
    const safeCommand = isolateIntentInput(command, 'deleteSources.command');
    return enqueueIntent(async () => {
      // 类型: object。
      // 作用: 保存操作前稳定投影，供默认源候选和真实 Host 集合捕获使用。
      const state = await safeDependencies.getSourceManagerState();

      // 条件分支: sourceIds 不是非空数组时进入。
      // 执行内容: 在捕获或释放 Host 前拒绝无效批量操作。
      if (!Array.isArray(safeCommand.sourceIds) || safeCommand.sourceIds.length === 0) {
        throw new SourceManagementValidationError('deleteSources.command.sourceIds 必须是非空数组');
      }

      // 类型: Array<string>。
      // 作用: 保存保持首次顺序的规范化目标；重复项仍由 Manager 统一去重。
      const sourceIds = safeCommand.sourceIds.map((sourceId, index) => normalizeSourceId(
        sourceId,
        `deleteSources.command.sourceIds[${index}]`
      ));

      // 类型: Array<string>。
      // 作用: 在 Manager 物理删除前保存自定义源动态工厂键；系统源只软隐藏且保留内置工厂。
      const customProviderKeys = sourceIds.map(sourceId => findSourceRecord(state, sourceId))
        .filter(record => record.definition.sourceKind === SOURCE_KIND.custom)
        .map(record => record.definition.providerKey);
      // 类型: object|null。
      // 作用: 整批包含默认源时保存明确交接，不影响默认源时保持 null。
      const handoff = createDefaultHandoff(state, sourceIds, safeCommand.handoff);

      // 类型: object。
      // 作用: 保存不含 undefined 字段的 Manager 批量删除命令。
      const managerCommand = createManagerCommand({ sourceIds }, handoff);
      // 类型: object。
      // 作用: 保存 Host 释放、Manager 删除和必要运行恢复全部完成后的稳定投影。
      const committedState = await runDestructiveIntent(
        sourceIds,
        () => safeDependencies.sourceManager.deleteSources(managerCommand)
      );

      // 循环类型: Array.prototype.forEach。
      // 初始值: 第一条已物理删除自定义源的 providerKey。
      // 终止条件: 全部对应动态工厂映射被移除。
      // 循环作用: 防止删除后重新导入命中旧模块闭包；系统源工厂不在此集合中。
      customProviderKeys.forEach((providerKey) => {
        // 副作用范围: 只删除当前 Bundle 私有注册表映射；不存在时保持幂等完成。
        safeDependencies.providerFactoryRegistrationPort.remove(providerKey);
      });

      return committedState;
    });
  }

  /**
   * 串行读取最小脚本导出包。
   * 副作用: 只进入 Manager FIFO 读取 Repository 一致快照；不创建 Blob、DOM、对象 URL 或下载链接。
   *
   * @param {*} command 导出 sourceIds 和 exportedAt 候选。
   * @returns {Promise<object>} 最小 SourceExportBundle。
   */
  function createSourceExportBundle(command) {
    // 类型: object。
    // 作用: 保存排队前严格隔离的导出命令，防止等待期间目标集合变化。
    const safeCommand = isolateIntentInput(command, 'createSourceExportBundle.command');
    return enqueueIntent(() => safeDependencies.sourceManager.createSourceExportBundle(safeCommand));
  }

  // 类型: object。
  // 作用: 汇总冻结契约十八方法；对象不包含 FIFO、Manager、Host、适配器、端口或工厂注册表引用。
  const sourceManagementRuntime = {
    initialize: safeDependencies.initialize,
    subscribe: safeDependencies.subscribe,
    getSourceManagerState: safeDependencies.getSourceManagerState,
    setDefaultSource,
    checkSource,
    checkAllSources,
    checkSourceUpdate,
    setSourceEnabled,
    authorizeSource,
    revokeSourceAuthorization,
    restoreSystemSources,
    clearTemporarySourceCache,
    clearAllSourceCache,
    previewSourceImport,
    importSource,
    applySourceUpdate,
    deleteSources,
    createSourceExportBundle
  };

  // 条件分支: 公开键数量、顺序或名称与冻结契约不一致时进入。
  // 执行内容: 在返回门面前阻止内部依赖泄漏或遗漏管理操作。
  if (Object.keys(sourceManagementRuntime).length !== SOURCE_MANAGEMENT_RUNTIME_PUBLIC_METHODS.length
    || Object.keys(sourceManagementRuntime).some(
      (methodName, index) => methodName !== SOURCE_MANAGEMENT_RUNTIME_PUBLIC_METHODS[index]
    )) {
    throw new SourceManagementValidationError('SourceManagementRuntime 公开方法顺序与冻结契约不一致');
  }

  return Object.freeze(sourceManagementRuntime);
}
