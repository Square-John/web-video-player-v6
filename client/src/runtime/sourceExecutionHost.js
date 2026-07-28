/*
  sourceExecutionHost.js 模块说明

  - 文件职责:
      实现 Provider 工厂定位、运行门禁、实例创建、初始化、启动、受管调用、停止和释放的唯一生命周期权威。
      每个 sourceId 独立保存 Context、控制器、Provider、生命周期代次、在途调用数量和拒绝新调用状态。
      Provider 候选结果只有在 entry、代次、AbortSignal 和采用门禁复查通过后才返回 service。
      本文件不读取 Repository、store、页面或脚本文本，也不直接创建真实网络请求。

  - 导入库及文件汇总(5 条，内置 0 条，第三方 0 条，自定义 5 条):
      Host 配置: 自定义配置，提供 phase、受管操作、计数器初值和页面五态映射。
      Host 错误: 自定义错误，提供门禁、状态、中止和生命周期稳定失败类型。
      evaluateSourceAuthorizationFingerprint: 自定义授权工具，评估轻量 SourceRecord 当前授权有效性。
      normalizeSourceShellId: 自定义 Shell 校验器，统一 sourceId 安全规则。
      cloneSerializableValue: 自定义 Repository 工具，隔离传给可信工厂的 Definition。

  - 模块级常量:
      HOST_DEPENDENCY_FIELDS: Array<string>，Host 构造依赖精确字段。
      FACTORY_REGISTRY_METHOD_FIELDS: Array<string>，可信工厂注册表公开方法。
      SOURCE_CONTEXT_RUNTIME_FIELDS: Array<string>，Context 组合工厂返回字段。
      SOURCE_PROVIDER_FIELDS: Array<string>，标准 Provider 精确字段。
      SOURCE_PROVIDER_METHOD_FIELDS: Array<string>，需要捕获绑定的 Provider 方法。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertObject(value, fieldName): Function，校验非数组对象。
      assertExactFields(value, expectedFields, fieldName): Function，校验精确自有字段。
      normalizeHostSourceId(sourceId, fieldName): Function，把 Shell 身份错误转换为 Host validation。
      assertFunctionFields(value, fields, fieldName): Function，校验方法集合。
      normalizeHostDependencies(dependencies): Function，校验并绑定 Host 构造依赖。
      normalizeSourceRecordAndGateContext(sourceRecord, gateContext): Function，隔离并校验 Host 门禁输入。
      createProviderFacade(provider, sourceId): Function，校验并捕获冻结 Provider 方法门面。
      validateSourceContextRuntime(runtime, sourceId, signal): Function，校验 Context 与控制器同源同 signal。

  - 模块级类:
      SourceExecutionHost: Provider 生命周期和候选结果采用唯一权威。

  - 对外导出:
      SourceExecutionHost: Class，执行宿主类。
      createSourceExecutionHost(dependencies): Function，创建 SourceExecutionHost 实例。
*/

import {
  // 导入来源: ./source-host/sourceExecutionHost.config.js。
  // 导入内容: SOURCE_EXECUTION_HOST_COUNTER_INITIAL 计数器初始值。
  // 文件作用: 创建首代 entry 和零在途调用状态，不散落裸初值。
  SOURCE_EXECUTION_HOST_COUNTER_INITIAL,

  // 导入来源: ./source-host/sourceExecutionHost.config.js。
  // 导入内容: SOURCE_EXECUTION_HOST_OPERATION 受管业务能力枚举。
  // 文件作用: 私有调用器只分派三个受审 Provider 业务方法。
  SOURCE_EXECUTION_HOST_OPERATION,

  // 导入来源: ./source-host/sourceExecutionHost.config.js。
  // 导入内容: SOURCE_EXECUTION_HOST_PHASE Host 内部生命周期阶段。
  // 文件作用: 统一 entry 状态转换和非法状态校验。
  SOURCE_EXECUTION_HOST_PHASE,

  // 导入来源: ./source-host/sourceExecutionHost.config.js。
  // 导入内容: SOURCE_EXECUTION_HOST_PHASE_TO_PROVIDER_STATUS phase 五态映射。
  // 文件作用: getRuntimeState 返回 SourceManager 可以消费的稳定 providerStatus。
  SOURCE_EXECUTION_HOST_PHASE_TO_PROVIDER_STATUS
} from './source-host/sourceExecutionHost.config.js';

import {
  // 导入来源: ./source-host/sourceExecutionHostErrors.js。
  // 导入内容: SourceExecutionHostCallAbortedError 旧候选结果错误。
  // 文件作用: signal 中止或 lifecycleGeneration 变化时拒绝返回 Provider 结果。
  SourceExecutionHostCallAbortedError,

  // 导入来源: ./source-host/sourceExecutionHostErrors.js。
  // 导入内容: SourceExecutionHostConflictError Host 冲突错误。
  // 文件作用: 同一 sourceId 重复 initialize 时阻止覆盖现有 entry。
  SourceExecutionHostConflictError,

  // 导入来源: ./source-host/sourceExecutionHostErrors.js。
  // 导入内容: SourceExecutionHostError Host 错误基类。
  // 文件作用: 避免把已经分类的 Host 错误重复包装成 lifecycle。
  SourceExecutionHostError,

  // 导入来源: ./source-host/sourceExecutionHostErrors.js。
  // 导入内容: SourceExecutionHostGateRejectedError Host 门禁错误。
  // 文件作用: 禁用、软隐藏、无指纹、授权无效或缺数据集时拒绝初始化。
  SourceExecutionHostGateRejectedError,

  // 导入来源: ./source-host/sourceExecutionHostErrors.js。
  // 导入内容: SourceExecutionHostInvalidStateError Host 状态错误。
  // 文件作用: 阻止未初始化启动、未运行调用和失败 entry 被直接重启。
  SourceExecutionHostInvalidStateError,

  // 导入来源: ./source-host/sourceExecutionHostErrors.js。
  // 导入内容: SourceExecutionHostLifecycleError Host 生命周期错误。
  // 文件作用: 包装工厂、Context、Provider initialize/start/stop/dispose 失败并保留 cause。
  SourceExecutionHostLifecycleError,

  // 导入来源: ./source-host/sourceExecutionHostErrors.js。
  // 导入内容: SourceExecutionHostNotFoundError Host 未命中错误。
  // 文件作用: sourceId 或 providerKey 没有受管对象时返回稳定失败。
  SourceExecutionHostNotFoundError,

  // 导入来源: ./source-host/sourceExecutionHostErrors.js。
  // 导入内容: SourceExecutionHostValidationError Host 输入错误。
  // 文件作用: 构造依赖、SourceRecord、gateContext、Provider 或 Context 不符合契约时失败。
  SourceExecutionHostValidationError
} from './source-host/sourceExecutionHostErrors.js';

// 导入来源: ../utils/sourceAuthorization.js。
// 导入内容: evaluateSourceAuthorizationFingerprint 指纹授权评估函数。
// 文件作用: 使用 SourceRecord 已验证 currentScriptHash 判断自定义源是否具备当前运行授权。
import { evaluateSourceAuthorizationFingerprint } from '../utils/sourceAuthorization.js';

// 导入来源: ./source-shell/sourceShellValidators.js。
// 导入内容: normalizeSourceShellId Shell 身份规范化函数。
// 文件作用: Host、Context 和 Provider 使用同一 sourceId 安全规则，拒绝空白和危险动态键。
import { normalizeSourceShellId } from './source-shell/sourceShellValidators.js';

// 导入来源: ../repositories/source/sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON Value 隔离函数。
// 文件作用: 传给可信工厂的 Definition 与 SourceManagerState 引用隔离，工厂修改不会反向污染投影。
import { cloneSerializableValue } from '../repositories/source/sourceRepositoryUtils.js';

// 类型: Array<string>。
// 作用: 固定 Host 只接收可信工厂注册表和 Context runtime 工厂两个依赖。
const HOST_DEPENDENCY_FIELDS = Object.freeze([
  // 类型: string。
  // 作用: 提供 providerKey 到可信工厂的显式查询能力。
  'factoryRegistry',

  // 类型: string。
  // 作用: 为每个 sourceId 和生命周期 signal 创建 Context 与 Logger Controller。
  'createSourceContextRuntime'
]);

// 类型: Array<string>。
// 作用: 要求注册表完整公开四个契约方法，Host 只捕获 get 但拒绝半完成依赖。
const FACTORY_REGISTRY_METHOD_FIELDS = Object.freeze([
  'register',
  'get',
  'remove',
  'listKeys'
]);

// 类型: Array<string>。
// 作用: 固定 Context 组合工厂只返回 Provider 工具箱和 Host 日志控制器。
const SOURCE_CONTEXT_RUNTIME_FIELDS = Object.freeze([
  'context',
  'loggerController'
]);

// 类型: Array<string>。
// 作用: 固定 Provider 根对象身份与八个生命周期/业务方法，拒绝夹带 Repository、store 或脚本能力。
const SOURCE_PROVIDER_FIELDS = Object.freeze([
  'id',
  'initialize',
  'start',
  'fetchData',
  'fetchFilterMeta',
  'checkHealth',
  'detectChallenge',
  'continueChallenge',
  'stop',
  'dispose'
]);

// 类型: Array<string>。
// 作用: 列出需要在创建时绑定到原 Provider 实例的函数，防止外部后续替换方法实现。
const SOURCE_PROVIDER_METHOD_FIELDS = Object.freeze(
  SOURCE_PROVIDER_FIELDS.filter(field => field !== 'id')
);

/**
 * 校验值是非数组对象。
 * 纯函数: 只检查输入，不修改对象。
 *
 * @param {*} value 待校验值。
 * @param {string} fieldName 错误信息中的字段路径。
 * @returns {object} 已确认的对象原引用。
 * @throws {SourceExecutionHostValidationError} 当值不是非数组对象时抛出。
 */
function assertObject(value, fieldName) {
  // 条件分支: 值为空、不是对象或是数组时进入。
  // 执行内容: 返回稳定 validation，避免后续 Reflect.ownKeys 或字段读取抛原生异常。
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SourceExecutionHostValidationError(`${fieldName} 必须是对象`);
  }

  // 返回值类型: object。
  // 作用: 返回已确认对象，供后续精确字段和方法检查继续使用。
  return value;
}

/**
 * 校验对象字段与固定集合完全一致。
 * 纯函数: 只读取对象全部自有键，不修改输入。
 *
 * @param {object} value 已确认的对象。
 * @param {Array<string>} expectedFields 允许的精确字段集合。
 * @param {string} fieldName 错误信息中的字段路径。
 * @returns {object} 字段完整且无额外键的原对象。
 * @throws {SourceExecutionHostValidationError} 当缺少、额外或 Symbol 字段存在时抛出。
 */
function assertExactFields(value, expectedFields, fieldName) {
  // 类型: Array<string|symbol>。
  // 作用: 获取全部自有键，确保 Symbol 隐藏能力也进入字段比较。
  const fields = Reflect.ownKeys(value);

  // 类型: boolean。
  // 作用: 同时比较字段数量和每个固定字段是否存在。
  const hasExactFields = fields.length === expectedFields.length
    && expectedFields.every(field => fields.includes(field));

  // 条件分支: 字段集合不完全一致时进入。
  // 执行内容: 拒绝缺失能力和额外越权引用。
  if (!hasExactFields) {
    throw new SourceExecutionHostValidationError(`${fieldName} 字段必须完整且不能包含额外字段`);
  }

  // 返回值类型: object。
  // 作用: 返回字段已经受控的原对象。
  return value;
}

/**
 * 使用 Shell 统一规则规范化 Host sourceId。
 * 纯函数: 返回新字符串，不修改调用方输入。
 *
 * @param {*} sourceId 待校验数据源身份。
 * @param {string} fieldName 错误信息中的字段路径。
 * @returns {string} 安全非空 sourceId。
 * @throws {SourceExecutionHostValidationError} 当 Shell 身份校验失败时抛出并保留 cause。
 */
function normalizeHostSourceId(sourceId, fieldName) {
  try {
    // 返回值类型: string。
    // 作用: 复用 Shell 身份规则，保证 Host 与 Context 不出现两套安全判断。
    return normalizeSourceShellId(sourceId, fieldName);
  } catch (error) {
    // 异常来源: Shell 拒绝空白、非字符串或危险 sourceId。
    // 处理策略: 转换为 Host validation，同时保留底层 cause 供诊断。
    throw new SourceExecutionHostValidationError(error.message, { cause: error });
  }
}

/**
 * 校验对象指定字段全部是函数。
 * 纯函数: 只读取字段类型，不调用或修改方法。
 *
 * @param {object} value 待校验方法容器。
 * @param {Array<string>} fields 必须存在的函数字段。
 * @param {string} fieldName 错误信息中的字段路径。
 * @returns {object} 方法集合完整的原对象。
 * @throws {SourceExecutionHostValidationError} 当任一字段不是函数时抛出。
 */
function assertFunctionFields(value, fields, fieldName) {
  // 类型: string|undefined。
  // 作用: 定位第一项缺失或非函数字段，生成可修复错误路径。
  const invalidField = fields.find(field => typeof value[field] !== 'function');

  // 条件分支: 找到无效方法字段时进入。
  // 执行内容: 阻止 Host 调用半完成依赖后产生原生 TypeError。
  if (invalidField) {
    throw new SourceExecutionHostValidationError(`${fieldName}.${invalidField} 必须是函数`);
  }

  // 返回值类型: object。
  // 作用: 返回方法集合已经完整的原对象。
  return value;
}

/**
 * 校验并捕获 Host 构造依赖。
 * 纯函数: 返回新的冻结门面，不保存调用方依赖容器。
 *
 * @param {*} dependencies Host 构造依赖。
 * @returns {object} 只含绑定 factoryRegistryGet 和 createSourceContextRuntime 的冻结依赖。
 * @throws {SourceExecutionHostValidationError} 当依赖字段或方法不符合契约时抛出。
 */
function normalizeHostDependencies(dependencies) {
  // 类型: object。
  // 作用: 确认依赖根节点可执行精确字段检查。
  const safeDependencies = assertObject(dependencies, 'sourceExecutionHost dependencies');

  // 执行内容: Host 构造依赖只能包含注册表和 Context runtime 工厂。
  assertExactFields(safeDependencies, HOST_DEPENDENCY_FIELDS, 'sourceExecutionHost dependencies');

  // 类型: object。
  // 作用: 确认注册表是对象并完整公开四个契约方法。
  const factoryRegistry = assertFunctionFields(
    assertObject(safeDependencies.factoryRegistry, 'factoryRegistry'),
    FACTORY_REGISTRY_METHOD_FIELDS,
    'factoryRegistry'
  );

  // 条件分支: Context runtime 工厂不是函数时进入。
  // 执行内容: 阻止 Host 初始化时无法创建同源 Shell。
  if (typeof safeDependencies.createSourceContextRuntime !== 'function') {
    throw new SourceExecutionHostValidationError('createSourceContextRuntime 必须是函数');
  }

  // 返回值类型: object。
  // 作用: 捕获绑定方法，外部替换依赖对象字段后当前 Host 行为不会漂移。
  return Object.freeze({
    // 类型: Function。
    // 作用: 只捕获注册表查询能力，Host 不能注册或删除工厂。
    factoryRegistryGet: factoryRegistry.get.bind(factoryRegistry),

    // 类型: Function。
    // 作用: 捕获 Context runtime 工厂，初始化时传入 sourceId 和生命周期 signal。
    createSourceContextRuntime: safeDependencies.createSourceContextRuntime
  });
}

/**
 * 隔离并校验 SourceRecord 与显式软隐藏上下文。
 * 纯函数: 返回严格 JSON Value 隔离副本，不修改 SourceManagerState 输入。
 *
 * @param {*} sourceRecord SourceManager 组装的轻量记录。
 * @param {*} gateContext 只包含 removedSystemSourceIds 的门禁上下文。
 * @returns {object} 隔离 sourceRecord、definition、sourceId、providerKey 和软隐藏集合。
 * @throws {SourceExecutionHostValidationError} 当结构、身份或关联字段不一致时抛出。
 */
function normalizeSourceRecordAndGateContext(sourceRecord, gateContext) {
  // 类型: object。
  // 作用: 确认轻量记录根节点可执行字段校验。
  const safeRecordInput = assertObject(sourceRecord, 'sourceRecord');

  // 执行内容: 拒绝 scriptContent 或其他额外保存态进入 Host 门禁对象。
  assertExactFields(
    safeRecordInput,
    ['definition', 'packageRef', 'storageNamespace', 'runtime', 'authorization', 'cache'],
    'sourceRecord'
  );

  // 类型: object。
  // 作用: 使用严格 JSON Value 复制轻量记录，调用方后续修改不会改变排队中的初始化输入。
  let safeRecord;
  try {
    safeRecord = cloneSerializableValue(safeRecordInput, 'sourceRecord');
  } catch (error) {
    // 异常来源: 记录含函数、循环、危险键或其他非 JSON Value。
    // 处理策略: 转换为 Host validation 并保留 Repository 校验 cause。
    throw new SourceExecutionHostValidationError(error.message, { cause: error });
  }

  // 类型: object。
  // 作用: 确认 Definition 可安全读取并作为门禁身份来源。
  const definition = assertObject(safeRecord.definition, 'sourceRecord.definition');

  // 类型: object。
  // 作用: 确认 runtime 可安全读取，并为启用状态和已验证脚本指纹门禁提供输入。
  const runtime = assertObject(safeRecord.runtime, 'sourceRecord.runtime');

  // 执行内容: 确认 authorization 是对象；具体授权字段由统一授权评估函数校验。
  assertObject(safeRecord.authorization, 'sourceRecord.authorization');

  // 类型: string。
  // 作用: 规范化 Definition 真实身份，后续所有 entry 和 Context 使用同一值。
  const sourceId = normalizeHostSourceId(definition.id, 'sourceRecord.definition.id');

  // 类型: string。
  // 作用: 校验可信工厂键是非空字符串；不根据 sourceKind 推断。
  const providerKey = typeof definition.providerKey === 'string'
    ? definition.providerKey.trim()
    : '';

  // 条件分支: providerKey 为空时进入。
  // 执行内容: 阻止缺失可信工厂身份的记录进入注册表查询。
  if (!providerKey) {
    throw new SourceExecutionHostValidationError('sourceRecord.definition.providerKey 不能为空');
  }

  // 条件分支: packageRef 或 storageNamespace 与 Definition 身份不一致时进入。
  // 执行内容: 阻止跨包或跨私有空间记录创建 Provider。
  if (typeof safeRecord.packageRef !== 'string'
    || !safeRecord.packageRef.trim()
    || safeRecord.packageRef !== definition.packageRef
    || safeRecord.storageNamespace !== sourceId) {
    throw new SourceExecutionHostValidationError('sourceRecord 包引用或私有空间身份不一致');
  }

  // 类型: object。
  // 作用: 确认门禁上下文只包含软隐藏 sourceId 集合。
  const safeGateContextInput = assertObject(gateContext, 'gateContext');
  assertExactFields(safeGateContextInput, ['removedSystemSourceIds'], 'gateContext');

  // 条件分支: removedSystemSourceIds 不是数组时进入。
  // 执行内容: 阻止 Host 把缺失软隐藏状态解释为空集合。
  if (!Array.isArray(safeGateContextInput.removedSystemSourceIds)) {
    throw new SourceExecutionHostValidationError('gateContext.removedSystemSourceIds 必须是数组');
  }

  // 类型: Array<string>。
  // 作用: 逐项规范化软隐藏身份，避免无效值绕过 membership 门禁。
  const removedSystemSourceIds = safeGateContextInput.removedSystemSourceIds.map((removedSourceId) => {
    // 返回值类型: string。
    // 作用: 使用 Host/Shell 统一身份规则校验当前软隐藏 id。
    return normalizeHostSourceId(removedSourceId, 'gateContext.removedSystemSourceIds[]');
  });

  // 返回值类型: object。
  // 作用: 返回不共享调用方引用的门禁输入，供生命周期队列延迟采用。
  return Object.freeze({
    sourceRecord: safeRecord,
    definition,
    runtime,
    sourceId,
    providerKey,
    removedSystemSourceIds: Object.freeze([...removedSystemSourceIds])
  });
}

/**
 * 校验并捕获标准 SourceProvider 方法门面。
 * 纯函数: 返回冻结新对象，方法在创建时绑定原 Provider 实例。
 *
 * @param {*} provider 可信工厂创建的 Provider。
 * @param {string} sourceId 当前 SourceRecord 真实身份。
 * @returns {object} 只含 id 和九个绑定方法的冻结门面。
 * @throws {SourceExecutionHostValidationError} 当字段、身份或方法不符合契约时抛出。
 */
function createProviderFacade(provider, sourceId) {
  // 类型: object。
  // 作用: 确认 Provider 根节点可以执行精确字段检查。
  const safeProvider = assertObject(provider, 'sourceProvider');

  // 执行内容: Provider 只能包含契约身份和方法，不能夹带 Repository、store 或脚本文本。
  assertExactFields(safeProvider, SOURCE_PROVIDER_FIELDS, 'sourceProvider');

  // 执行内容: Provider 九个生命周期和业务字段必须全部是函数。
  assertFunctionFields(safeProvider, SOURCE_PROVIDER_METHOD_FIELDS, 'sourceProvider');

  // 类型: string。
  // 作用: 规范化 Provider 自报身份，供 SourceRecord 执行严格比较。
  const providerSourceId = normalizeHostSourceId(safeProvider.id, 'sourceProvider.id');

  // 条件分支: Provider 与 SourceRecord 身份不一致时进入。
  // 执行内容: 阻止工厂返回其他数据源实例或通过别名复用 Provider。
  if (providerSourceId !== sourceId) {
    throw new SourceExecutionHostValidationError('sourceProvider.id 与 SourceRecord 不一致');
  }

  // 类型: object。
  // 作用: 创建只包含真实 id 和绑定函数的门面，外部替换原 Provider 字段后 Host 调用不漂移。
  const facade = {
    id: sourceId
  };

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 在初始化前一次性绑定全部 Provider 方法到原实例。
  SOURCE_PROVIDER_METHOD_FIELDS.forEach((methodName) => {
    // 类型: Function。
    // 作用: 捕获当前方法并绑定原 Provider this，后续调用不读取可变属性。
    facade[methodName] = safeProvider[methodName].bind(safeProvider);
  });

  // 返回值类型: object。
  // 作用: 返回冻结门面，Host 生命周期内不能替换方法或身份。
  return Object.freeze(facade);
}

/**
 * 校验 Context runtime 与 Host 生命周期身份一致。
 * 纯函数: 返回原 Context 和 Logger Controller 引用组成的新冻结对象，不修改依赖。
 *
 * @param {*} runtime Context 组合工厂返回值。
 * @param {string} sourceId 当前 entry 真实身份。
 * @param {AbortSignal} signal 当前 entry 生命周期信号。
 * @returns {object} 同源同 signal 的 Context 与 Logger Controller。
 * @throws {SourceExecutionHostValidationError} 当字段、身份、signal 或控制器方法不一致时抛出。
 */
function validateSourceContextRuntime(runtime, sourceId, signal) {
  // 类型: object。
  // 作用: 确认 Context runtime 根节点并拒绝额外控制对象。
  const safeRuntime = assertExactFields(
    assertObject(runtime, 'sourceContextRuntime'),
    SOURCE_CONTEXT_RUNTIME_FIELDS,
    'sourceContextRuntime'
  );

  // 类型: object。
  // 作用: 读取 Provider 可见冻结 Context。
  const context = assertObject(safeRuntime.context, 'sourceContextRuntime.context');

  // 类型: object。
  // 作用: 读取 Host 私有 Logger Controller，不把它放入 Context 根对象。
  const loggerController = assertObject(
    safeRuntime.loggerController,
    'sourceContextRuntime.loggerController'
  );

  // 类型: string。
  // 作用: 规范化 Context 身份，用于确认 Provider 工具箱绑定当前 entry。
  const contextSourceId = normalizeHostSourceId(context.sourceId, 'sourceContext.sourceId');

  // 类型: string。
  // 作用: 规范化 Logger Controller 身份，用于阻止跨源诊断控制器进入当前 Context runtime。
  const loggerSourceId = normalizeHostSourceId(
    loggerController.sourceId,
    'sourceLoggerController.sourceId'
  );

  // 条件分支: Context、Logger 或 signal 与 entry 不一致时进入。
  // 执行内容: 拒绝跨源或分裂生命周期工具箱。
  if (contextSourceId !== sourceId
    || loggerSourceId !== sourceId
    || context.signal !== signal) {
    throw new SourceExecutionHostValidationError('SourceContext runtime 身份或 signal 不一致');
  }

  // 条件分支: Context 未冻结时进入。
  // 执行内容: 阻止 Provider 在运行中替换 network、storage、challenge、logger 或 signal。
  if (!Object.isFrozen(context)) {
    throw new SourceExecutionHostValidationError('SourceContext 必须被冻结');
  }

  // 执行内容: Logger Controller 必须提供 Host 读取与清理能力；Provider 只会获得 context.logger。
  assertFunctionFields(loggerController, ['getEntries', 'clear'], 'sourceLoggerController');

  // 返回值类型: object。
  // 作用: 返回冻结组合，不暴露给 Provider 或上层 service。
  return Object.freeze({ context, loggerController });
}

/**
 * Provider 生命周期和受管调用执行宿主。
 * 保存边界: 只保存当前会话实例、Context、控制器、生命周期完成事实、计数器和操作队列，不保存 Definition、Preferences 或页面投影。
 * 调用边界: service 只能使用 fetchData、fetchFilterMeta 和 checkHealth，不能获得原始 Provider。
 */
export class SourceExecutionHost {
  // 类型: Function。
  // 作用: 查询 providerKey 对应冻结可信工厂门面。
  #factoryRegistryGet;

  // 类型: Function。
  // 作用: 为 sourceId 和 AbortSignal 创建同生命周期 Context runtime。
  #createSourceContextRuntime;

  // 类型: Map<string, object>。
  // 作用: 保存每个 sourceId 当前唯一受管 entry。
  #entryBySourceId;

  // 类型: Map<string, number>。
  // 作用: 保存每个 sourceId 下一次 initialize 应分配的单调生命周期代次。
  #nextGenerationBySourceId;

  // 类型: Map<string, Promise<void>>。
  // 作用: 按 sourceId 串行 initialize/start/stop/dispose，失败后队列仍可继续。
  #lifecycleQueueBySourceId;

  /**
   * 创建 SourceExecutionHost。
   *
   * @param {object} dependencies Host 构造依赖。
   * @param {object} dependencies.factoryRegistry 可信 Provider 工厂注册表。
   * @param {Function} dependencies.createSourceContextRuntime Context runtime 工厂。
   * @throws {SourceExecutionHostValidationError} 当依赖字段或方法不符合契约时抛出。
   */
  constructor(dependencies) {
    // 类型: object。
    // 作用: 校验并捕获依赖方法，Host 不保存可变依赖容器。
    const normalizedDependencies = normalizeHostDependencies(dependencies);

    // 副作用: 保存只读工厂查询函数。
    // 影响范围: 当前 Host 实例，不暴露给外部调用方。
    this.#factoryRegistryGet = normalizedDependencies.factoryRegistryGet;

    // 副作用: 保存 Context runtime 工厂。
    // 影响范围: 每次 initialize 创建独立 Context 和 Logger Controller。
    this.#createSourceContextRuntime = normalizedDependencies.createSourceContextRuntime;

    // 类型: Map<string, object>。
    // 作用: 初始化空受管实例索引。
    this.#entryBySourceId = new Map();

    // 类型: Map<string, number>。
    // 作用: 初始化空生命周期代次索引，首代值在首次 initialize 时分配。
    this.#nextGenerationBySourceId = new Map();

    // 类型: Map<string, Promise<void>>。
    // 作用: 初始化空生命周期队列，不阻塞不同 sourceId 并行运行。
    this.#lifecycleQueueBySourceId = new Map();
  }

  /**
   * 把一个生命周期操作加入当前 sourceId FIFO 队列。
   * 副作用: 更新 lifecycleQueueBySourceId；action 可以修改当前 entry 和调用 Provider 生命周期方法。
   * 失败路径: 当前调用保留真实异常；内部队列尾恢复 fulfilled，后续 dispose 仍可执行。
   *
   * @param {string} sourceId 已规范化数据源身份。
   * @param {Function} action 当前生命周期操作。
   * @returns {Promise<*>} 当前操作独立结果。
   */
  #enqueueLifecycle(sourceId, action) {
    // 类型: Promise<void>。
    // 作用: 读取当前 sourceId 队列尾；没有历史操作时使用已完成 Promise。
    const previousTail = this.#lifecycleQueueBySourceId.get(sourceId) || Promise.resolve();

    // 类型: Promise<*>。
    // 作用: 无论前一操作成功或失败都继续执行当前 action，避免队列中毒。
    const operation = previousTail.then(action, action);

    // 类型: Promise<void>。
    // 作用: 把当前结果收敛为 fulfilled 队列尾，同时不吞掉返回给调用方的 operation 异常。
    const settledTail = operation.then(
      () => undefined,
      () => undefined
    );

    // 副作用: 保存当前 sourceId 新队列尾。
    // 影响范围: 同 sourceId 后续生命周期操作，不影响其他数据源。
    this.#lifecycleQueueBySourceId.set(sourceId, settledTail);

    // 返回值类型: Promise<*>。
    // 作用: 返回当前调用真实结果，并在它收敛后清理仍指向本次尾的队列项。
    return operation.finally(() => {
      // 条件分支: 当前 Map 仍指向本次 settledTail 时进入。
      // 执行内容: 删除已空闲队列；如果后续操作已经接入则保留新尾。
      if (this.#lifecycleQueueBySourceId.get(sourceId) === settledTail) {
        this.#lifecycleQueueBySourceId.delete(sourceId);
      }
    });
  }

  /**
   * 分配当前 sourceId 新生命周期代次。
   * 副作用: 更新 nextGenerationBySourceId，释放 entry 后仍保留下一代数字。
   *
   * @param {string} sourceId 已规范化数据源身份。
   * @returns {number} 当前新 entry 使用的生命周期代次。
   */
  #allocateGeneration(sourceId) {
    // 类型: number。
    // 作用: 读取下一代值；首次使用集中首代配置。
    const generation = this.#nextGenerationBySourceId.get(sourceId)
      || SOURCE_EXECUTION_HOST_COUNTER_INITIAL.lifecycleGeneration;

    // 副作用: 保存下一次 initialize 使用的更大代次。
    // 影响范围: 当前 sourceId，防止释放后重建实例采用旧 Promise 结果。
    this.#nextGenerationBySourceId.set(
      sourceId,
      generation + SOURCE_EXECUTION_HOST_COUNTER_INITIAL.lifecycleGeneration
    );

    // 返回值类型: number。
    // 作用: 返回当前 entry 固定代次。
    return generation;
  }

  /**
   * 读取必需受管 entry。
   * 纯函数: 只读取 entryBySourceId，不修改状态。
   *
   * @param {string} sourceId 已规范化数据源身份。
   * @returns {object} 当前受管 entry。
   * @throws {SourceExecutionHostNotFoundError} 当 sourceId 未初始化或已释放时抛出。
   */
  #requireEntry(sourceId) {
    // 类型: object|null。
    // 作用: 定位当前 sourceId 唯一受管 entry。
    const entry = this.#entryBySourceId.get(sourceId) || null;

    // 条件分支: entry 不存在时进入。
    // 执行内容: 拒绝调用方绕过 initialize 或继续使用已释放实例。
    if (!entry) {
      throw new SourceExecutionHostNotFoundError(`Provider 尚未初始化: ${sourceId}`);
    }

    // 返回值类型: object。
    // 作用: 返回 Host 私有 entry，仅供类内部方法使用。
    return entry;
  }

  /**
   * 把 entry 转换成隔离冻结运行摘要。
   * 纯函数: 只读取标量字段，不暴露 Provider、Context、控制器、等待器或 Error 实例。
   *
   * @param {object} entry Host 私有受管 entry。
   * @returns {object} SourceExecutionHostRuntimeState。
   */
  #createRuntimeState(entry) {
    // 返回值类型: object。
    // 作用: 返回字段受控冻结摘要，调用方不能修改 Host 内部状态。
    return Object.freeze({
      // 类型: string。
      // 作用: 当前受管 entry 真实数据源身份。
      sourceId: entry.sourceId,

      // 类型: string。
      // 作用: 根据内部 phase 映射 SourceManager 可以消费的 Provider 五态。
      providerStatus: SOURCE_EXECUTION_HOST_PHASE_TO_PROVIDER_STATUS[entry.phase],

      // 类型: string。
      // 作用: 当前细粒度生命周期阶段的标量副本。
      phase: entry.phase,

      // 类型: boolean。
      // 作用: true 表示允许开始新受管调用；false 表示尚未启动、停止中或失败。
      acceptingCalls: entry.acceptingCalls,

      // 类型: number。
      // 作用: 当前尚未收敛的业务调用数量。
      activeCallCount: entry.activeCallCount,

      // 类型: number。
      // 作用: 当前实例生命周期代次，旧结果必须与该值一致。
      lifecycleGeneration: entry.lifecycleGeneration,

      // 类型: string。
      // 作用: 最近 Host 稳定错误码；没有失败时为空字符串。
      lastErrorCode: entry.lastErrorCode
    });
  }

  /**
   * 解析并执行 SourceRecord 运行门禁。
   * 副作用: 调用可信工厂 supports；不创建 Provider、不写 entry 或 Repository。
   *
   * @param {object} gateInput 已隔离门禁输入。
   * @returns {object} 匹配的冻结可信工厂门面。
   * @throws {SourceExecutionHostGateRejectedError} 当记录不可运行或工厂不支持 Definition 时抛出。
   * @throws {SourceExecutionHostNotFoundError} 当 providerKey 未注册时抛出。
   * @throws {SourceExecutionHostLifecycleError} 当工厂 supports 执行失败时抛出。
   */
  #resolveGateFactory(gateInput) {
    // 条件分支: Repository 投影没有有效启用当前记录时进入。
    // 执行内容: Host 不把 disabled 解释为可按需自动启用。
    if (gateInput.runtime.enabled !== true) {
      throw new SourceExecutionHostGateRejectedError('数据源未启用，不能初始化 Provider');
    }

    // 条件分支: 已验证 currentScriptHash 缺失时进入。
    // 执行内容: 阻止缺包、完整性失败或未验证脚本进入工厂。
    if (typeof gateInput.runtime.currentScriptHash !== 'string'
      || !gateInput.runtime.currentScriptHash.trim()) {
      throw new SourceExecutionHostGateRejectedError('数据源脚本完整性无效，不能初始化 Provider');
    }

    // 条件分支: sourceId 位于显式软隐藏集合时进入。
    // 执行内容: 系统源必须先通过 SourceManager 恢复，Host 不自行修改 Preferences。
    if (gateInput.removedSystemSourceIds.includes(gateInput.sourceId)) {
      throw new SourceExecutionHostGateRejectedError('软隐藏系统源不能初始化 Provider');
    }

    // 类型: object。
    // 作用: 使用 Definition 和已验证指纹评估当前授权，不读取 scriptContent。
    const authorizationState = evaluateSourceAuthorizationFingerprint({
      sourceKind: gateInput.definition.sourceKind,
      version: gateInput.definition.version,
      currentScriptHash: gateInput.runtime.currentScriptHash,
      authorization: gateInput.sourceRecord.authorization
    });

    // 条件分支: 当前系统/自定义记录不具备有效授权时进入。
    // 执行内容: 拒绝用户未确认或授权快照失效的脚本启动。
    if (!authorizationState.isAuthorized) {
      throw new SourceExecutionHostGateRejectedError('数据源尚未获得当前版本运行授权');
    }

    // 类型: object|null。
    // 作用: 按显式 providerKey 查询项目内受审工厂，不根据来源类型推断。
    const providerFactory = this.#factoryRegistryGet(gateInput.providerKey);

    // 条件分支: providerKey 没有注册可信工厂时进入。
    // 执行内容: unresolved 自定义脚本和未知键均不能进入动态执行。
    if (!providerFactory) {
      throw new SourceExecutionHostNotFoundError(`Provider 工厂未注册: ${gateInput.providerKey}`);
    }

    // 类型: boolean。
    // 作用: 保存可信工厂对当前 Definition 受审数据集的明确判断。
    let isSupported;
    try {
      // 执行内容: 传入隔离 Definition 副本，工厂修改不会污染 SourceManagerState。
      isSupported = providerFactory.supports(
        cloneSerializableValue(gateInput.definition, 'sourceProviderFactory.definition')
      );
    } catch (error) {
      // 异常来源: 可信工厂 supports 内部执行失败。
      // 处理策略: 包装为 lifecycle 并保留原始 cause，不把异常当作 false 掩盖。
      throw new SourceExecutionHostLifecycleError('Provider 工厂能力门禁执行失败', { cause: error });
    }

    // 条件分支: supports 没有返回严格 Boolean 时进入。
    // 执行内容: 拒绝 truthy 字符串等模糊门禁结果。
    if (typeof isSupported !== 'boolean') {
      throw new SourceExecutionHostValidationError('providerFactory.supports 必须返回 boolean');
    }

    // 条件分支: 工厂没有当前 sourceId 受审数据集时进入。
    // 执行内容: 不允许 Host 临时传入 dataSet 或按别名选择其他源数据。
    if (!isSupported) {
      throw new SourceExecutionHostGateRejectedError('Provider 工厂缺少当前数据源受审数据集');
    }

    // 返回值类型: object。
    // 作用: 返回注册时已经冻结和绑定的可信工厂门面。
    return providerFactory;
  }

  /**
   * 等待 entry 当前全部在途业务调用收敛。
   * 副作用: activeCallCount 大于零时向 entry.drainWaiters 追加一次性 resolve。
   *
   * @param {object} entry Host 私有受管 entry。
   * @returns {Promise<void>} 无在途调用时立即完成，否则由最后一个调用完成。
   */
  #waitForDrain(entry) {
    // 条件分支: 当前没有在途调用时进入。
    // 执行内容: 直接返回已完成 Promise，避免创建无用等待器。
    if (entry.activeCallCount === SOURCE_EXECUTION_HOST_COUNTER_INITIAL.activeCallCount) {
      return Promise.resolve();
    }

    // 返回值类型: Promise<void>。
    // 作用: 保存一次性 resolve，最后一个业务调用释放计数时统一唤醒。
    return new Promise((resolve) => {
      // 副作用: 向当前 entry 私有 drainWaiters 追加等待器。
      // 影响范围: 当前 stop/dispose 调用，不暴露给 Provider 或外部。
      entry.drainWaiters.push(resolve);
    });
  }

  /**
   * 释放一次受管业务调用计数并在归零时唤醒 drain。
   * 副作用: 减少 activeCallCount，并清空和调用当前 entry 的 drainWaiters。
   *
   * @param {object} entry Host 私有受管 entry。
   * @returns {void} 该方法只收敛计数和等待器。
   */
  #releaseActiveCall(entry) {
    // 副作用: 当前受管调用已经收敛，在途数量减少一个。
    // 影响范围: 当前 entry 的停止等待条件。
    entry.activeCallCount -= SOURCE_EXECUTION_HOST_COUNTER_INITIAL.lifecycleGeneration;

    // 条件分支: 仍有其他在途调用时进入。
    // 执行内容: 保留等待器，最后一个调用再统一唤醒。
    if (entry.activeCallCount > SOURCE_EXECUTION_HOST_COUNTER_INITIAL.activeCallCount) {
      return;
    }

    // 类型: Array<Function>。
    // 作用: 复制当前等待器并立即清空 entry，避免 resolve 回调重入时重复执行。
    const drainWaiters = entry.drainWaiters.splice(
      SOURCE_EXECUTION_HOST_COUNTER_INITIAL.activeCallCount
    );

    // 循环类型: Array.prototype.forEach。
    // 循环作用: 通知所有等待同一批在途调用收敛的 stop/dispose 操作。
    drainWaiters.forEach((resolveDrain) => {
      // 执行内容: 完成单个 drain Promise。
      resolveDrain();
    });
  }

  /**
   * 立即拒绝当前 entry 新调用并中止共享生命周期信号。
   * 副作用: 修改 acceptingCalls、phase 并调用 AbortController.abort。
   *
   * @param {object} entry Host 私有受管 entry。
   * @returns {void} 关闭请求同步生效，后续生命周期方法在 FIFO 队列执行。
   */
  #requestShutdown(entry) {
    // 副作用: 先拒绝新调用，避免 stop 等待期间 activeCallCount 继续增长。
    // 影响范围: 当前 entry 的全部 Host 业务入口。
    entry.acceptingCalls = false;

    // 条件分支: 生命周期 signal 尚未中止时进入。
    // 执行内容: abort 当前 Context 网络、存储和挑战调用。
    if (!entry.abortController.signal.aborted) {
      entry.abortController.abort();
    }

    // 条件分支: entry 尚未 stopped、failed 或 disposing 时进入。
    // 执行内容: 立即标记 stopping；并发 start 完成后会看到 phase 已变化并拒绝采用成功。
    if (entry.phase !== SOURCE_EXECUTION_HOST_PHASE.stopped
      && entry.phase !== SOURCE_EXECUTION_HOST_PHASE.failed
      && entry.phase !== SOURCE_EXECUTION_HOST_PHASE.disposing) {
      entry.phase = SOURCE_EXECUTION_HOST_PHASE.stopping;
    }
  }

  /**
   * 执行一个 Provider 受管业务调用。
   * 副作用: 增减 activeCallCount；Provider 方法可以通过 Context 使用网络、存储、挑战和日志能力。
   * 成功路径: Provider 候选结果返回后 entry、generation、signal、phase 和 acceptingCalls 全部仍有效才返回。
   * 失败路径: 生命周期失效返回 callAborted；Provider 业务错误在生命周期仍有效时保留原错误。
   *
   * @param {*} sourceId 目标数据源身份。
   * @param {string} operation SOURCE_EXECUTION_HOST_OPERATION 中的能力名。
   * @param {Array<*>} args 传给 Provider 方法的参数数组。
   * @returns {Promise<*>} 通过 Host 采用门禁的标准业务结果。
   */
  async #invoke(sourceId, operation, args) {
    // 类型: string。
    // 作用: 使用统一安全规则定位受管 entry。
    const safeSourceId = normalizeHostSourceId(sourceId, 'sourceId');

    // 条件分支: operation 不属于三项受审能力时进入。
    // 执行内容: 阻止任意字符串访问 Provider 生命周期或隐藏属性。
    if (!Object.values(SOURCE_EXECUTION_HOST_OPERATION).includes(operation)) {
      throw new SourceExecutionHostValidationError('Host 受管调用能力不受支持');
    }

    // 类型: object。
    // 作用: 读取当前唯一受管 entry。
    const entry = this.#requireEntry(safeSourceId);

    // 条件分支: entry 不在 running、拒绝新调用或 signal 已中止时进入。
    // 执行内容: 阻止停止中、失败或未启动 Provider 接受业务调用。
    if (entry.phase !== SOURCE_EXECUTION_HOST_PHASE.running
      || entry.acceptingCalls !== true
      || entry.abortController.signal.aborted) {
      throw new SourceExecutionHostInvalidStateError(`Provider 当前不可调用: ${safeSourceId}`);
    }

    // 类型: number。
    // 作用: 捕获本次调用开始时的生命周期代次，返回后用于拒绝旧实例结果。
    const lifecycleGeneration = entry.lifecycleGeneration;

    // 副作用: 新受管调用进入，在途数量增加一个。
    // 影响范围: stop/dispose drain 条件和运行摘要。
    entry.activeCallCount += SOURCE_EXECUTION_HOST_COUNTER_INITIAL.lifecycleGeneration;

    try {
      // 类型: *。
      // 作用: 保存 Provider 返回候选结果，尚未通过 Host 生命周期复查。
      const candidate = await entry.provider[operation](...args);

      // 类型: object|null。
      // 作用: 读取 Promise 返回时该 sourceId 当前 entry，可能已经释放或重建。
      const currentEntry = this.#entryBySourceId.get(safeSourceId) || null;

      // 条件分支: entry 被替换、代次变化、中止、停止或不再允许采用时进入。
      // 执行内容: 拒绝旧候选结果返回 service，防止停止后写入 store。
      if (currentEntry !== entry
        || entry.lifecycleGeneration !== lifecycleGeneration
        || entry.abortController.signal.aborted
        || entry.phase !== SOURCE_EXECUTION_HOST_PHASE.running
        || entry.acceptingCalls !== true) {
        throw new SourceExecutionHostCallAbortedError(`Provider 候选结果已经过期: ${safeSourceId}`);
      }

      // 返回值类型: *。
      // 作用: 返回已通过 Host 采用门禁的标准业务结果。
      return candidate;
    } catch (error) {
      // 类型: object|null。
      // 作用: 读取失败时当前 entry，判断业务错误是否伴随生命周期失效。
      const currentEntry = this.#entryBySourceId.get(safeSourceId) || null;

      // 条件分支: 当前错误已是 Host callAborted 时进入。
      // 执行内容: 原样保留稳定错误，不重复包装。
      if (error instanceof SourceExecutionHostCallAbortedError) {
        throw error;
      }

      // 条件分支: Provider 抛错同时 entry 已失效或 signal 已中止时进入。
      // 执行内容: 以生命周期失效为上层采用结论，并保留 Provider cause。
      if (currentEntry !== entry
        || entry.lifecycleGeneration !== lifecycleGeneration
        || entry.abortController.signal.aborted
        || entry.acceptingCalls !== true) {
        throw new SourceExecutionHostCallAbortedError(
          `Provider 调用已经中止: ${safeSourceId}`,
          { cause: error }
        );
      }

      // 异常来源: Provider 在仍有效生命周期内返回业务失败。
      // 处理策略: 保留原始错误类型和 cause，Host 不把内容错误伪装成生命周期错误。
      throw error;
    } finally {
      // 执行内容: 无论成功、业务失败或中止都释放当前调用计数。
      this.#releaseActiveCall(entry);
    }
  }

  /**
   * 校验门禁并初始化一个受管 Provider entry。
   * 副作用: 创建 AbortController、Context、Logger Controller、Provider 和 entry；调用 Provider.initialize。
   * 失败路径: 门禁失败不创建 entry；initialize 失败保留不可调用 failed entry，必须显式 dispose。
   *
   * @param {object} sourceRecord SourceManager 轻量记录。
   * @param {object} gateContext 显式软隐藏门禁上下文。
   * @returns {Promise<object>} 初始化完成的隔离 Host 运行摘要。
   */
  initialize(sourceRecord, gateContext) {
    // 类型: object。
    // 作用: 在进入异步队列前隔离输入，调用方后续修改不会影响门禁结果。
    const gateInput = normalizeSourceRecordAndGateContext(sourceRecord, gateContext);

    // 条件分支: 当前 sourceId 已经存在 entry 时进入。
    // 执行内容: 禁止新 initialize 覆盖 running、failed 或待释放实例。
    if (this.#entryBySourceId.has(gateInput.sourceId)) {
      throw new SourceExecutionHostConflictError(`Provider 已经初始化: ${gateInput.sourceId}`);
    }

    // 类型: object。
    // 作用: 在创建任何生命周期对象前执行保存态、授权、软隐藏和可信数据集门禁。
    const providerFactory = this.#resolveGateFactory(gateInput);

    // 类型: AbortController。
    // 作用: 创建当前新 entry 唯一生命周期中止源。
    const abortController = new AbortController();

    // 类型: object。
    // 作用: 保存通过同 sourceId 和 signal 校验的 Context 与 Logger Controller。
    let contextRuntime;

    // 类型: object。
    // 作用: 保存通过精确字段和身份校验的冻结 Provider 门面。
    let provider;

    try {
      // 执行内容: 为当前 sourceId 创建唯一 Context runtime；Host 不直接 new 网络或 Repository。
      contextRuntime = validateSourceContextRuntime(
        this.#createSourceContextRuntime(gateInput.sourceId, abortController.signal),
        gateInput.sourceId,
        abortController.signal
      );

      // 类型: object。
      // 作用: 为工厂创建第二份隔离 Definition，工厂不能修改门禁快照。
      const factoryDefinition = cloneSerializableValue(
        gateInput.definition,
        'sourceProviderFactory.definition'
      );

      // 执行内容: 工厂内部按 Definition 定位受审数据集；Host 不传 dataSet 或 scriptContent。
      provider = createProviderFacade(
        providerFactory.create({ definition: factoryDefinition }),
        gateInput.sourceId
      );
    } catch (error) {
      // 副作用: Context 或工厂创建失败后立即中止刚创建 signal。
      // 影响范围: 当前尚未写入 entry 的临时能力对象。
      abortController.abort();

      // 条件分支: 当前错误已经是稳定 Host 错误时进入。
      // 执行内容: 原样抛出，避免丢失 validation 或 gate 分类。
      if (error instanceof SourceExecutionHostError) {
        throw error;
      }

      // 异常来源: Context runtime 工厂或可信 Provider 工厂执行失败。
      // 处理策略: 包装为 lifecycle 并保留原始 cause；未创建 entry 不伪造 failed 摘要。
      throw new SourceExecutionHostLifecycleError('Provider 初始化依赖创建失败', { cause: error });
    }

    // 类型: object。
    // 作用: 创建当前 sourceId 完整私有 entry，让紧随 initialize 的 start、stop 或 dispose 都能定位同一实例。
    const entry = {
      sourceId: gateInput.sourceId,
      providerKey: gateInput.providerKey,
      phase: SOURCE_EXECUTION_HOST_PHASE.initializing,
      acceptingCalls: false,
      activeCallCount: SOURCE_EXECUTION_HOST_COUNTER_INITIAL.activeCallCount,
      lifecycleGeneration: this.#allocateGeneration(gateInput.sourceId),
      abortController,
      context: contextRuntime.context,
      loggerController: contextRuntime.loggerController,
      provider,
      // 类型: boolean。
      // 作用: 记录当前 Provider.stop 是否已经成功；true 时 dispose 重试不得重复停止，false 时仍需先停止。
      isProviderStopped: false,
      // 类型: boolean。
      // 作用: 记录当前 Provider.dispose 是否已经成功；true 时释放重试只清理 Host 日志和 entry，false 时仍需调用 Provider.dispose。
      isProviderDisposed: false,
      drainWaiters: [],
      lastErrorCode: ''
    };

    // 副作用: 在 Promise 微任务排队前同步登记 entry。
    // 影响范围: 同一事件循环内紧接着发起的 stop/dispose 可以先拒绝新调用并中止初始化 signal。
    this.#entryBySourceId.set(gateInput.sourceId, entry);

    // 返回值类型: Promise<object>。
    // 作用: Provider.initialize 与紧随其后的 start、stop、dispose 按同一 sourceId FIFO 顺序执行。
    return this.#enqueueLifecycle(gateInput.sourceId, async () => {
      try {
        // 异步调用: Provider 一次性采用当前冻结 Context。
        // reject: Provider 初始化失败时保留 failed entry 供释放重试。
        await entry.provider.initialize(entry.context);

        // 条件分支: initialize 等待期间 shutdown 已改变 phase 或 signal 时进入。
        // 执行内容: 不把已请求停止的 Provider 标记为 initialized。
        if (entry.phase !== SOURCE_EXECUTION_HOST_PHASE.initializing
          || entry.abortController.signal.aborted) {
          throw new SourceExecutionHostCallAbortedError(`Provider 初始化已经中止: ${entry.sourceId}`);
        }

        // 副作用: Provider 已采用 Context，进入等待显式 start 的 initialized 阶段。
        // 影响范围: 当前 entry 运行摘要。
        entry.phase = SOURCE_EXECUTION_HOST_PHASE.initialized;
        entry.lastErrorCode = '';

        // 返回值类型: object。
        // 作用: 返回 initialized/stopped 映射的隔离摘要。
        return this.#createRuntimeState(entry);
      } catch (error) {
        // 条件分支: 并发 shutdown 已把 entry 标记 stopping 时进入。
        // 执行内容: 保留 stopping 阶段，让后续 FIFO stop 执行真实 Provider.stop。
        if (entry.phase !== SOURCE_EXECUTION_HOST_PHASE.stopping) {
          entry.phase = SOURCE_EXECUTION_HOST_PHASE.failed;
          entry.lastErrorCode = error instanceof SourceExecutionHostError
            ? error.code
            : new SourceExecutionHostLifecycleError('Provider 初始化失败').code;
        }

        // 条件分支: 当前错误已经是稳定 Host 错误时进入。
        // 执行内容: 原样抛出，保留 callAborted 或 validation 分类。
        if (error instanceof SourceExecutionHostError) {
          throw error;
        }

        // 异常来源: Provider.initialize 抛出业务实现错误。
        // 处理策略: 包装为 lifecycle 并保留 cause，entry 保持 failed 且不可调用。
        throw new SourceExecutionHostLifecycleError('Provider 初始化失败', { cause: error });
      }
    });
  }

  /**
   * 启动一个已经 initialized 的 Provider。
   * 副作用: 修改 entry phase/acceptingCalls，并调用 Provider.start。
   * 幂等边界: 已 running 时直接返回当前摘要；stopped 或 failed 必须先 dispose 后重新 initialize。
   *
   * @param {*} sourceId 目标数据源身份。
   * @returns {Promise<object>} running Host 运行摘要。
   */
  start(sourceId) {
    // 类型: string。
    // 作用: 在进入生命周期队列前校验目标身份。
    const safeSourceId = normalizeHostSourceId(sourceId, 'sourceId');

    // 返回值类型: Promise<object>。
    // 作用: 与同 sourceId initialize/stop/dispose 串行执行。
    return this.#enqueueLifecycle(safeSourceId, async () => {
      // 类型: object。
      // 作用: 读取当前唯一受管 entry。
      const entry = this.#requireEntry(safeSourceId);

      // 条件分支: Provider 已经 running 时进入。
      // 执行内容: 幂等返回当前摘要，不重复调用 Provider.start。
      if (entry.phase === SOURCE_EXECUTION_HOST_PHASE.running) {
        return this.#createRuntimeState(entry);
      }

      // 条件分支: entry 不是 initialized 时进入。
      // 执行内容: 阻止 starting、stopped、failed 或 disposing 状态直接启动。
      if (entry.phase !== SOURCE_EXECUTION_HOST_PHASE.initialized) {
        throw new SourceExecutionHostInvalidStateError(`Provider 当前不能启动: ${safeSourceId}`);
      }

      // 副作用: 进入 starting 阶段；业务调用继续保持拒绝。
      // 影响范围: 当前 entry 运行摘要。
      entry.phase = SOURCE_EXECUTION_HOST_PHASE.starting;
      entry.acceptingCalls = false;

      try {
        // 异步调用: 启动 Provider 自身业务状态。
        await entry.provider.start();

        // 条件分支: start 等待期间 shutdown 已中止 signal 或改变 phase 时进入。
        // 执行内容: 拒绝把已请求停止的 Provider 标记 running。
        if (entry.phase !== SOURCE_EXECUTION_HOST_PHASE.starting
          || entry.abortController.signal.aborted) {
          throw new SourceExecutionHostCallAbortedError(`Provider 启动已经中止: ${safeSourceId}`);
        }

        // 副作用: Provider 已启动，允许 Host 受管业务调用。
        // 影响范围: 当前 entry 的三个业务入口。
        entry.phase = SOURCE_EXECUTION_HOST_PHASE.running;
        entry.acceptingCalls = true;
        entry.lastErrorCode = '';

        // 返回值类型: object。
        // 作用: 返回 running 隔离摘要。
        return this.#createRuntimeState(entry);
      } catch (error) {
        // 条件分支: 并发 shutdown 已标记 stopping 时进入。
        // 执行内容: 保留 stopping，让队列中的 stop 继续清理。
        if (entry.phase !== SOURCE_EXECUTION_HOST_PHASE.stopping) {
          entry.phase = SOURCE_EXECUTION_HOST_PHASE.failed;
          entry.lastErrorCode = error instanceof SourceExecutionHostError
            ? error.code
            : new SourceExecutionHostLifecycleError('Provider 启动失败').code;
        }

        // 条件分支: 当前错误已经是稳定 Host 错误时进入。
        // 执行内容: 原样保留 callAborted 或状态分类。
        if (error instanceof SourceExecutionHostError) {
          throw error;
        }

        // 异常来源: Provider.start 抛出实现错误。
        // 处理策略: 包装为 lifecycle，entry 保持 failed 且必须先 dispose。
        throw new SourceExecutionHostLifecycleError('Provider 启动失败', { cause: error });
      }
    });
  }

  /**
   * 通过 Host 执行标准内容请求。
   * 副作用: 委托私有受管调用器增减在途计数并调用 Provider.fetchData。
   *
   * @param {*} sourceId 目标数据源身份。
   * @param {*} request 标准 SourceDataRequest。
   * @returns {Promise<object>} 通过生命周期复查的 SourceDataResponse。
   */
  fetchData(sourceId, request) {
    // 返回值类型: Promise<object>。
    // 作用: fetchData 只接收一个请求参数，不向 Provider 传第二份 Context。
    return this.#invoke(sourceId, SOURCE_EXECUTION_HOST_OPERATION.fetchData, [request]);
  }

  /**
   * 通过 Host 执行标准筛选元数据请求。
   * 副作用: 委托私有受管调用器增减在途计数并调用同一 Provider.fetchFilterMeta。
   *
   * @param {*} sourceId 目标数据源身份。
   * @param {*} request 标准 SourceFilterMetaRequest。
   * @returns {Promise<object>} 通过生命周期复查的 SourceFilterMetaResponse。
   */
  fetchFilterMeta(sourceId, request) {
    // 返回值类型: Promise<object>。
    // 作用: 筛选调用复用同一 entry，不创建第二个 Provider 或注册表。
    return this.#invoke(sourceId, SOURCE_EXECUTION_HOST_OPERATION.fetchFilterMeta, [request]);
  }

  /**
   * 通过 Host 执行 Provider 健康检测。
   * 副作用: 委托私有受管调用器增减在途计数并调用 Provider.checkHealth。
   *
   * @param {*} sourceId 目标数据源身份。
   * @returns {Promise<object>} 通过生命周期复查的 SourceHealthCheckResult。
   */
  checkHealth(sourceId) {
    // 返回值类型: Promise<object>。
    // 作用: 健康检测不接收请求对象或 Context 参数。
    return this.#invoke(sourceId, SOURCE_EXECUTION_HOST_OPERATION.checkHealth, []);
  }

  /**
   * 停止一个受管 Provider。
   * 副作用: 调用时立即拒绝新调用并 abort，随后按 FIFO 等待在途调用并执行 Provider.stop。
   * 幂等边界: 已 stopped 时返回当前摘要；失败 entry 会重试 Provider.stop。
   *
   * @param {*} sourceId 目标数据源身份。
   * @returns {Promise<object>} stopped Host 运行摘要。
   */
  stop(sourceId) {
    // 类型: string。
    // 作用: 校验停止目标身份，供同步关闭门禁和生命周期队列使用。
    const safeSourceId = normalizeHostSourceId(sourceId, 'sourceId');

    // 类型: object。
    // 作用: 定位当前受管 entry，让 stop 在进入 Promise 队列前立即拒绝新调用并中止 signal。
    const entry = this.#requireEntry(safeSourceId);

    // 执行内容: 在进入异步队列前同步拒绝新调用和 abort，停止请求不会被新业务调用追赶。
    this.#requestShutdown(entry);

    // 返回值类型: Promise<object>。
    // 作用: 等待同 sourceId 前序生命周期操作后执行真实 stop。
    return this.#enqueueLifecycle(safeSourceId, async () => {
      // 类型: object。
      // 作用: 前序操作后重新读取当前 entry，防止使用旧引用。
      const currentEntry = this.#requireEntry(safeSourceId);

      // 条件分支: Provider 已经 stopped 时进入。
      // 执行内容: 幂等返回摘要，不重复调用 stop。
      if (currentEntry.phase === SOURCE_EXECUTION_HOST_PHASE.stopped) {
        return this.#createRuntimeState(currentEntry);
      }

      // 条件分支: Provider 已经完成永久释放、只剩 Host 后置清理失败时进入。
      // 执行内容: 拒绝再次调用 Provider.stop，要求调用方重试 dispose 完成剩余清理。
      if (currentEntry.isProviderDisposed) {
        throw new SourceExecutionHostInvalidStateError(`Provider 已释放，必须重试清理: ${safeSourceId}`);
      }

      // 条件分支: entry 正在 disposing 时进入。
      // 执行内容: 避免 stop 与永久释放重叠。
      if (currentEntry.phase === SOURCE_EXECUTION_HOST_PHASE.disposing) {
        throw new SourceExecutionHostInvalidStateError(`Provider 正在释放: ${safeSourceId}`);
      }

      // 条件分支: Provider.stop 已成功，但后续 dispose 或日志清理失败使 phase 变成 failed 时进入。
      // 执行内容: 恢复 stopped 摘要且不重复调用 Provider.stop，保留显式 dispose 重试入口。
      if (currentEntry.isProviderStopped) {
        currentEntry.phase = SOURCE_EXECUTION_HOST_PHASE.stopped;
        currentEntry.acceptingCalls = false;
        currentEntry.lastErrorCode = '';
        return this.#createRuntimeState(currentEntry);
      }

      // 副作用: 确保失败或初始化中的 entry 也保持拒绝调用和已中止信号。
      this.#requestShutdown(currentEntry);

      // 异步等待: 等待 stop 请求前已经开始的业务调用全部执行 finally 释放计数。
      await this.#waitForDrain(currentEntry);

      try {
        // 异步调用: Provider 收敛自身业务状态。
        await currentEntry.provider.stop();

        // 副作用: stop 成功后进入 stopped，等待显式 dispose。
        // 影响范围: 当前 entry 运行摘要和后续允许操作。
        currentEntry.phase = SOURCE_EXECUTION_HOST_PHASE.stopped;
        currentEntry.acceptingCalls = false;
        currentEntry.isProviderStopped = true;
        currentEntry.lastErrorCode = '';

        // 返回值类型: object。
        // 作用: 返回 stopped 隔离摘要。
        return this.#createRuntimeState(currentEntry);
      } catch (error) {
        // 副作用: stop 失败保留不可调用 failed entry，不删除可能仍执行的 Provider。
        // 影响范围: 后续只能重试 stop 或 dispose。
        currentEntry.phase = SOURCE_EXECUTION_HOST_PHASE.failed;
        currentEntry.acceptingCalls = false;
        currentEntry.lastErrorCode = new SourceExecutionHostLifecycleError('Provider 停止失败').code;

        // 异常来源: Provider.stop 抛出实现错误。
        // 处理策略: 包装为 lifecycle 并保留 cause。
        throw new SourceExecutionHostLifecycleError('Provider 停止失败', { cause: error });
      }
    });
  }

  /**
   * 永久释放一个受管 Provider entry。
   * 副作用: 立即拒绝新调用并 abort；必要时先 stop，随后 dispose 和清理日志，全部成功才删除 entry。
   * 幂等边界: 已成功释放或从未初始化时直接完成；并发第二次释放在队列中看到空 entry 后完成。
   *
   * @param {*} sourceId 目标数据源身份。
   * @returns {Promise<void>} 释放完成后不返回 Provider 或 Context 引用。
   */
  dispose(sourceId) {
    // 类型: string。
    // 作用: 校验目标身份。
    const safeSourceId = normalizeHostSourceId(sourceId, 'sourceId');

    // 类型: object|null。
    // 作用: 读取当前 entry；不存在时按幂等释放直接完成。
    const entry = this.#entryBySourceId.get(safeSourceId) || null;

    // 条件分支: entry 不存在时进入。
    // 执行内容: 返回已完成 Promise，不伪造运行摘要。
    if (!entry) {
      return Promise.resolve();
    }

    // 执行内容: 在排队前立即拒绝新调用和 abort。
    this.#requestShutdown(entry);

    // 返回值类型: Promise<void>。
    // 作用: 与当前 sourceId 其他生命周期操作串行释放。
    return this.#enqueueLifecycle(safeSourceId, async () => {
      // 类型: object|null。
      // 作用: 前序 dispose 可能已删除 entry，并发调用需重新读取。
      const currentEntry = this.#entryBySourceId.get(safeSourceId) || null;

      // 条件分支: 前序操作已经释放 entry 时进入。
      // 执行内容: 幂等完成，不访问旧 Provider 引用。
      if (!currentEntry) {
        return;
      }

      // 执行内容: 确保释放期间没有新调用并中止全部 Context 能力。
      this.#requestShutdown(currentEntry);

      // 异步等待: 当前全部在途业务调用必须先收敛。
      await this.#waitForDrain(currentEntry);

      // 条件分支: Provider.stop 尚未成功时进入。
      // 执行内容: dispose 不跳过必需停止；停止已经成功的失败 entry 不重复调用 Provider.stop。
      if (!currentEntry.isProviderStopped) {
        try {
          await currentEntry.provider.stop();
          currentEntry.phase = SOURCE_EXECUTION_HOST_PHASE.stopped;
          currentEntry.isProviderStopped = true;
        } catch (error) {
          currentEntry.phase = SOURCE_EXECUTION_HOST_PHASE.failed;
          currentEntry.acceptingCalls = false;
          currentEntry.lastErrorCode = new SourceExecutionHostLifecycleError('Provider 释放前停止失败').code;
          throw new SourceExecutionHostLifecycleError('Provider 释放前停止失败', { cause: error });
        }
      }

      // 副作用: stop 已成功，进入永久释放阶段。
      // 影响范围: getRuntimeState 对外映射 stopping，业务调用继续拒绝。
      currentEntry.phase = SOURCE_EXECUTION_HOST_PHASE.disposing;

      try {
        // 条件分支: Provider.dispose 尚未成功时进入。
        // 执行内容: 永久释放 Provider 自身 Context 和私有资源引用；成功后记录完成事实供后置清理重试使用。
        if (!currentEntry.isProviderDisposed) {
          await currentEntry.provider.dispose();
          currentEntry.isProviderDisposed = true;
        }

        // 副作用: 清理当前 Host 私有有界日志，不把旧诊断带入下一代实例。
        // 影响范围: 当前 Logger Controller 私有条目。
        currentEntry.loggerController.clear();
      } catch (error) {
        // 副作用: dispose 或日志清理失败保留 failed entry 和全部引用，供显式重试。
        // 影响范围: 当前 sourceId；acceptingCalls 保持 false。
        currentEntry.phase = SOURCE_EXECUTION_HOST_PHASE.failed;
        currentEntry.acceptingCalls = false;
        currentEntry.lastErrorCode = new SourceExecutionHostLifecycleError('Provider 释放失败').code;
        throw new SourceExecutionHostLifecycleError('Provider 释放失败', { cause: error });
      }

      // 副作用: 只有 stop、dispose 和日志清理全部成功后才删除 entry。
      // 影响范围: 当前 sourceId 后续 getRuntimeState 返回 null，并允许重新 initialize 新代次。
      this.#entryBySourceId.delete(safeSourceId);
    });
  }

  /**
   * 读取一个 sourceId 的隔离 Host 运行摘要。
   * 纯函数: 只读取当前 entry 标量并创建冻结新对象，不暴露生命周期引用。
   * 成功路径: 已初始化时返回冻结运行摘要，未初始化或释放成功后返回 null。
   * 失败路径: sourceId 不符合统一身份规则时抛出 Host validation 错误。
   *
   * @param {*} sourceId 目标数据源身份。
   * @returns {Promise<object|null>} 当前运行摘要；未初始化或已释放时返回 null。
   */
  async getRuntimeState(sourceId) {
    // 类型: string。
    // 作用: 使用统一安全规则定位当前 entry。
    const safeSourceId = normalizeHostSourceId(sourceId, 'sourceId');

    // 类型: object|null。
    // 作用: 读取当前 entry；释放成功后明确为空。
    const entry = this.#entryBySourceId.get(safeSourceId) || null;

    // 返回值类型: object|null。
    // 作用: 返回隔离摘要或 null，不暴露 Provider、Context、控制器、Map 或错误实例。
    return entry ? this.#createRuntimeState(entry) : null;
  }
}

/**
 * 创建 SourceExecutionHost 实例。
 * 纯函数: 只根据显式依赖 new 独立 Host，不读取全局 runtime、store 或 Repository。
 *
 * @param {object} dependencies Host 构造依赖。
 * @returns {SourceExecutionHost} 独立执行宿主实例。
 */
export function createSourceExecutionHost(dependencies) {
  // 返回值类型: SourceExecutionHost。
  // 作用: 返回独立生命周期权威，测试和应用 runtime 可以显式组合。
  return new SourceExecutionHost(dependencies);
}
