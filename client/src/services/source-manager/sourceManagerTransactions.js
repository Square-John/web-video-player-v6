/*
  sourceManagerTransactions.js 模块说明

  - 文件职责:
      提供 SourceManager 基础领域事务使用的严格命令、记录门禁、默认源交接、授权快照和 Repository 投影加载能力。
      本模块只生成隔离命令或候选值，不持有操作队列、不直接保存 Preferences、不清理 Storage。
      供 SourceManager 在 Unit of Work 真正取得执行权后读取最新图并执行领域规则。

  - 导入库及文件汇总(7 条，内置 0 条，第三方 0 条，自定义 7 条):
      AUTHORIZATION_STATUS、IMPORT_METHOD、PROVIDER_READINESS_STATUS、SOURCE_KIND: 自定义配置，提供授权、导入方式、Provider 就绪和数据源类型枚举。
      cloneSerializableValue: 自定义工具，隔离命令、Preferences 和运行态输出。
      assertPlainObject、assertSafeRecordKey: 自定义校验，约束命令对象和动态 sourceId。
      validateSourceAuthorization、validateSourceDefinition、validateSourcePackage: 自定义校验，复用 Repository 授权和保存对象完整字段契约。
      createSourceAuthorizationStateFromFingerprint、createSourceScriptHash、evaluateSourceAuthorizationFingerprint: 自定义授权核心，创建授权快照并验证脚本文本指纹。
      assertSourceManagerBoolean、normalizeDefaultSourceHandoff、normalizeSourceIds: 自定义命令校验，复用严格 Boolean、交接和 id 集合规则。
      SourceManagerInvariantError、SourceManagerNotFoundError、SourceManagerValidationError: 自定义错误，表达领域失败。
      SOURCE_STABLE_RUNTIME_FIELDS、assembleSourceManagerState: 自定义状态能力，统一稳定运行态字段并把最新 Repository 图转换为轻量投影。

  - 模块级常量:
      SET_SOURCE_ENABLED_COMMAND_FIELDS: object，启停命令必填和可选字段。
      AUTHORIZE_SOURCE_COMMAND_FIELDS: object，授权命令精确字段。
      REVOKE_SOURCE_AUTHORIZATION_COMMAND_FIELDS: object，撤销授权命令必填和可选字段。
      IMPORT_SOURCE_COMMAND_FIELDS: object，导入命令精确字段。
      APPLY_SOURCE_UPDATE_COMMAND_FIELDS: object，更新命令必填和可选字段。
      DELETE_SOURCES_COMMAND_FIELDS: object，批量删除命令必填和可选字段。
      SOURCE_EXPORT_COMMAND_FIELDS: object，最小导出命令精确字段。
      SOURCE_PACKAGE_INTEGRITY_ALGORITHM: string，当前允许的脚本指纹算法。
      SOURCE_EXPORT_SCHEMA_VERSION: string，最小导出包结构版本。

  - 模块级变量:
      无

  - 模块级辅助函数:
      wrapManagerValidation(action): Function，把 Repository 通用校验错误转换为 SourceManager 校验错误。
      normalizeCommandObject(command, fieldRules, name): Function，隔离并校验命令精确字段。
      assertIsoTimestamp(value, name): Function，校验标准 UTC ISO 时间。
      normalizeSourcePackageDefinitionPair(sourcePackage, sourceDefinition, name): Function，校验包、定义和脚本指纹关联。

  - 模块级类:
      无

  - 对外导出:
      normalizeSourceManagerId: Function，严格单个 sourceId 校验。
      normalizeSetSourceEnabledCommand: Function，启停命令规范化。
      normalizeAuthorizeSourceCommand: Function，授权命令规范化。
      normalizeRevokeSourceAuthorizationCommand: Function，撤销授权命令规范化。
      normalizeRestoreSystemSourceIds: Function，恢复系统源 id 集合规范化。
      normalizeImportSourceCommand: Function，导入包、定义和 settings 命令规范化。
      normalizeApplySourceUpdateCommand: Function，更新包、定义和交接命令规范化。
      normalizeDeleteSourcesCommand: Function，混合批量删除命令规范化。
      normalizeSourceExportCommand: Function，最小导出命令规范化。
      findRequiredSourceRecord: Function，读取必须存在的轻量记录。
      assertCustomSourceRecord: Function，限制用户授权操作只作用自定义源。
      assertSourceCanBeEnabled: Function，校验结构、授权和软隐藏门禁。
      isSourceProviderReady: Function，判断当前会话是否具有支持 Definition 的受审 Provider。
      assertSourceSelectable: Function，校验默认源候选有效启用且未隐藏。
      resolveDefaultSourceHandoff: Function，解析影响默认源操作的 replace/clear 决策。
      createAuthorizedSourceSnapshot: Function，从当前版本和指纹创建授权快照。
      createRevokedSourceSnapshot: Function，撤销授权并保留历史诊断字段。
      createPendingSourceAuthorizationSnapshot: Function，创建待授权快照并可保留历史诊断。
      createSourceRuntimeIndex: Function，从轻量投影提取可重组装会话运行态。
      loadSourceManagerRepositoryProjection: Function，读取最新 Repository 图和 usage 并组装投影。
*/

import {
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: AUTHORIZATION_STATUS 授权状态枚举。
  // 文件作用: 创建 authorized 和 revoked 快照时不使用散落字符串。
  AUTHORIZATION_STATUS,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 数据源导入方式枚举。
  // 文件作用: 用户导入不能伪装成随应用提供的 builtin 系统源。
  IMPORT_METHOD,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: PROVIDER_READINESS_STATUS Provider 当前会话就绪枚举。
  // 文件作用: 默认源、活动源和健康检测候选复用 SourceRecord 中的唯一就绪投影。
  PROVIDER_READINESS_STATUS,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: 用户授权和撤销授权事务只允许作用于 custom 数据源。
  SOURCE_KIND
} from '../../config/source-manager.config.js';

// 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
// 文件作用: 命令、授权和运行态候选不能保留调用方可变引用。
import { cloneSerializableValue } from '../../repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourceAuthorization 授权快照完整校验函数。
  // 文件作用: 更新保留历史诊断前确认授权字段、状态和组合仍符合保存契约。
  validateSourceAuthorization,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 严格普通对象校验函数。
  // 文件作用: 命令容器拒绝数组、复杂实例和异常原型。
  assertPlainObject,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertSafeRecordKey 动态记录键校验函数。
  // 文件作用: 单 sourceId 拒绝空白和原型敏感危险名称。
  assertSafeRecordKey,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourceDefinition Definition 保存对象校验函数。
  // 文件作用: 导入和更新命令在 Repository 写入前验证完整字段、枚举和能力结构。
  validateSourceDefinition,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourcePackage Package 保存对象校验函数。
  // 文件作用: 导入和更新命令在 Repository 写入前验证脚本包完整字段和 integrity 结构。
  validateSourcePackage
} from '../../repositories/source/sourceRepositoryValidators.js';

import {
  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: createSourceAuthorizationStateFromFingerprint 指纹授权快照工厂。
  // 文件作用: 授权和撤销只从当前 Definition.version、已验证指纹和用户决定生成快照。
  createSourceAuthorizationStateFromFingerprint,

  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: createSourceScriptHash 脚本文本指纹函数。
  // 文件作用: 重新计算命令脚本文本哈希，不能直接信任调用方声明的 integrity.scriptHash。
  createSourceScriptHash,

  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: evaluateSourceAuthorizationFingerprint 指纹授权评估函数。
  // 文件作用: 启用自定义源前重新验证当前授权、版本和脚本指纹。
  evaluateSourceAuthorizationFingerprint
} from '../../utils/sourceAuthorization.js';

import {
  // 导入来源: ./sourceManagerCommands.js。
  // 导入内容: assertSourceManagerBoolean 严格 Boolean 校验函数。
  // 文件作用: enabled 和 enableAfterAuthorization 不接受 0、1 或字符串。
  assertSourceManagerBoolean,

  // 导入来源: ./sourceManagerCommands.js。
  // 导入内容: normalizeDefaultSourceHandoff 默认源交接规范化函数。
  // 文件作用: 影响当前默认源的操作只接受明确 replace 或 clear 决策。
  normalizeDefaultSourceHandoff,

  // 导入来源: ./sourceManagerCommands.js。
  // 导入内容: normalizeSourceIds sourceId 集合规范化函数。
  // 文件作用: 交接影响集合统一执行严格 JSON、危险键和去重校验。
  normalizeSourceIds
} from './sourceManagerCommands.js';

import {
  // 导入来源: ./sourceManagerErrors.js。
  // 导入内容: SourceManagerInvariantError 领域不变量错误。
  // 文件作用: 表达未授权启用、无效默认源候选和缺少交接决定。
  SourceManagerInvariantError,

  // 导入来源: ./sourceManagerErrors.js。
  // 导入内容: SourceManagerNotFoundError 记录未找到错误。
  // 文件作用: 指定 sourceId 不存在时使用稳定 notFound code。
  SourceManagerNotFoundError,

  // 导入来源: ./sourceManagerErrors.js。
  // 导入内容: SourceManagerValidationError 命令校验错误。
  // 文件作用: 表达命令字段、时间、sourceId 和不必要交接不符合契约。
  SourceManagerValidationError
} from './sourceManagerErrors.js';

import {
  // 导入来源: ./sourceManagerState.js。
  // 导入内容: SOURCE_STABLE_RUNTIME_FIELDS 稳定会话运行态字段集合。
  // 文件作用: 事务重组装与初始运行态规范化共用唯一字段契约，排除检查过程和保存态字段。
  SOURCE_STABLE_RUNTIME_FIELDS,

  // 导入来源: ./sourceManagerState.js。
  // 导入内容: assembleSourceManagerState 轻量状态组装函数。
  // 文件作用: 使用最新 Repository 图、usage 和会话运行态生成事务前后安全投影。
  assembleSourceManagerState
} from './sourceManagerState.js';

// 类型: object。
// 作用: 固定启停命令必须包含 sourceId/enabled，并只允许额外交接字段。
const SET_SOURCE_ENABLED_COMMAND_FIELDS = Object.freeze({
  // 类型: Array<string>。
  // 作用: 启停事务任何路径都必须具备的命令字段。
  required: Object.freeze(['sourceId', 'enabled']),

  // 类型: Array<string>。
  // 作用: 仅关闭当前默认源时允许出现的显式交接字段。
  optional: Object.freeze(['handoff'])
});

// 类型: object。
// 作用: 固定授权命令完整字段，授权时间和是否同时启用都必须由用户意图明确提供。
const AUTHORIZE_SOURCE_COMMAND_FIELDS = Object.freeze({
  // 类型: Array<string>。
  // 作用: 授权事务必须同时提供 sourceId、标准时间和严格启用决定。
  required: Object.freeze(['sourceId', 'authorizedAt', 'enableAfterAuthorization']),

  // 类型: Array<string>。
  // 作用: 当前授权命令没有可选扩展字段。
  optional: Object.freeze([])
});

// 类型: object。
// 作用: 固定撤销授权命令必须包含 sourceId，并只允许当前默认源交接字段。
const REVOKE_SOURCE_AUTHORIZATION_COMMAND_FIELDS = Object.freeze({
  // 类型: Array<string>。
  // 作用: 撤销授权事务必须明确目标 sourceId。
  required: Object.freeze(['sourceId']),

  // 类型: Array<string>。
  // 作用: 目标是当前默认源时允许提交 replace 或 clear 交接。
  optional: Object.freeze(['handoff'])
});

// 类型: object。
// 作用: 固定导入命令必须同时提供标准 Package、Definition 和普通 settings，不接受文件、URL 或页面状态。
const IMPORT_SOURCE_COMMAND_FIELDS = Object.freeze({
  // 类型: Array<string>。
  // 作用: 导入事务缺少任一保存域时必须在写入前失败。
  required: Object.freeze(['sourcePackage', 'sourceDefinition', 'settings']),

  // 类型: Array<string>。
  // 作用: 当前导入命令没有可选字段，授权和启用由后续用户操作决定。
  optional: Object.freeze([])
});

// 类型: object。
// 作用: 固定更新命令的目标身份、下一 Package/Definition 和可选默认源交接。
const APPLY_SOURCE_UPDATE_COMMAND_FIELDS = Object.freeze({
  // 类型: Array<string>。
  // 作用: 更新事务必须明确目标 sourceId 和完整下一包/定义。
  required: Object.freeze(['sourceId', 'sourcePackage', 'sourceDefinition']),

  // 类型: Array<string>。
  // 作用: 只有更新会使当前默认源关闭时允许提供 replace 或 clear 交接。
  optional: Object.freeze(['handoff'])
});

// 类型: object。
// 作用: 固定混合批量删除命令的完整目标集合和可选默认源交接。
const DELETE_SOURCES_COMMAND_FIELDS = Object.freeze({
  // 类型: Array<string>。
  // 作用: 删除事务必须提供非空 sourceIds 集合。
  required: Object.freeze(['sourceIds']),

  // 类型: Array<string>。
  // 作用: 整批目标包含当前默认源时允许提供 replace 或 clear 交接。
  optional: Object.freeze(['handoff'])
});

// 类型: object。
// 作用: 固定最小导出查询只接受 sourceIds 和审计时间，不接受缓存、授权或下载选项。
const SOURCE_EXPORT_COMMAND_FIELDS = Object.freeze({
  // 类型: Array<string>。
  // 作用: 导出包必须明确目标集合和标准导出时间。
  required: Object.freeze(['sourceIds', 'exportedAt']),

  // 类型: Array<string>。
  // 作用: 浏览器文件名、Blob 和缓存选项不属于 SourceManager 导出契约。
  optional: Object.freeze([])
});

// 类型: string。
// 作用: 限制 4D 导入和更新只接受当前组装器能够重新计算验证的 FNV-1a 32 位指纹。
const SOURCE_PACKAGE_INTEGRITY_ALGORITHM = 'fnv1a-32';

// 类型: string。
// 作用: 标识最小导出对象当前结构版本，未来扩展必须显式升级而不是静默增加私密字段。
export const SOURCE_EXPORT_SCHEMA_VERSION = '1.0.0';

/**
 * 执行 Repository 通用校验并转换错误边界。
 * 纯函数: 除执行 action 外不读取或修改模块状态。
 *
 * @param {Function} action 严格校验回调。
 * @returns {*} 原校验结果。
 * @throws {SourceManagerValidationError} 当底层校验拒绝输入时抛出并保留 cause。
 */
function wrapManagerValidation(action) {
  try {
    // 返回值类型: any。
    // 作用: 校验成功时原样返回结果，不改变输入语义。
    return action();
  } catch (error) {
    // 异常来源: 普通对象、严格 JSON 或动态键校验拒绝输入。
    // 处理策略: 转换为 SourceManager 校验错误并保留底层 cause。
    throw new SourceManagerValidationError(error.message, { cause: error });
  }
}

/**
 * 隔离并校验命令对象的必填和可选字段。
 * 纯函数: 返回新普通对象，不修改调用方命令。
 *
 * @param {*} command 原始领域命令。
 * @param {object} fieldRules 命令字段规则。
 * @param {Array<string>} fieldRules.required 必填字段集合。
 * @param {Array<string>} fieldRules.optional 可选字段集合。
 * @param {string} name 错误信息使用的命令名称。
 * @returns {object} 严格 JSON 隔离且字段合法的命令对象。
 * @throws {SourceManagerValidationError} 当命令类型、字段缺失或存在额外字段时抛出。
 */
function normalizeCommandObject(command, fieldRules, name) {
  // 类型: object。
  // 作用: 严格隔离命令并拒绝函数、Symbol、隐藏字段、访问器、循环和有损值。
  const safeCommand = wrapManagerValidation(() => {
    // 类型: object。
    // 作用: 保存严格 JSON Value 隔离副本，后续字段读取不会穿透调用方对象。
    const isolatedCommand = cloneSerializableValue(command, name);

    // 执行内容: 命令根节点只接受普通对象，不接受数组或复杂实例。
    assertPlainObject(isolatedCommand, name);

    // 返回值类型: object。
    // 作用: 返回已隔离普通对象供精确字段校验。
    return isolatedCommand;
  });

  // 类型: Array<string|symbol>。
  // 作用: 读取命令全部自有字段，Symbol 和未知字段都不能绕过校验。
  const commandFields = Reflect.ownKeys(safeCommand);

  // 类型: Array<string>。
  // 作用: 合并必填和可选字段形成完整允许集合。
  const allowedFields = [...fieldRules.required, ...fieldRules.optional];

  // 条件分支: 任一必填字段缺失时进入。
  // 执行内容: 拒绝半完成命令，避免事务内部猜测用户意图。
  if (fieldRules.required.some(field => !commandFields.includes(field))) {
    throw new SourceManagerValidationError(`${name} 缺少必填字段`);
  }

  // 条件分支: 命令包含任一未冻结字段时进入。
  // 执行内容: 拒绝兼容别名和页面局部状态进入领域事务。
  if (commandFields.some(field => !allowedFields.includes(field))) {
    throw new SourceManagerValidationError(`${name} 包含禁止字段`);
  }

  // 返回值类型: object。
  // 作用: 返回字段受控的隔离命令，具体字段类型由专用规范化函数继续校验。
  return safeCommand;
}

/**
 * 校验标准 UTC ISO 时间。
 * 纯函数: 只读取时间文本，不修改输入或系统时钟。
 *
 * @param {*} value 待校验时间值。
 * @param {string} name 错误信息使用的字段名。
 * @returns {string} 原始标准 UTC ISO 时间。
 * @throws {SourceManagerValidationError} 当输入不是非空字符串、无法解析或格式不标准时抛出。
 */
function assertIsoTimestamp(value, name) {
  // 条件分支: 输入不是非空字符串时进入。
  // 执行内容: 拒绝数字时间戳、Date 对象和空白文本。
  if (typeof value !== 'string' || !value.trim()) {
    throw new SourceManagerValidationError(`${name} 必须是非空 ISO 时间字符串`);
  }

  // 条件分支: 时间无法解析，或标准 UTC 序列化后与原文本不一致时进入。
  // 执行内容: 拒绝本地时区和宽松日期格式，保持授权审计时间唯一。
  if (Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new SourceManagerValidationError(`${name} 必须是标准 UTC ISO 时间`);
  }

  // 返回值类型: string。
  // 作用: 返回原始标准时间，不做时区或精度转换。
  return value;
}

/**
 * 校验并隔离一组相互关联的 SourcePackage 和 SourceDefinition。
 * 纯函数: 返回两个隔离保存对象，不修改调用方输入。
 * 完整性边界: 重新计算 scriptContent 指纹，不信任命令声明的 scriptHash。
 *
 * @param {*} sourcePackageInput 原始 SourcePackage 输入。
 * @param {*} sourceDefinitionInput 原始 SourceDefinition 输入。
 * @param {string} name 错误信息使用的命令名称。
 * @returns {object} 已验证并隔离的包定义组合。
 * @returns {object} return.sourcePackage 字段完整且脚本指纹有效的 SourcePackage。
 * @returns {object} return.sourceDefinition 与 Package 身份和引用一致的 SourceDefinition。
 * @throws {SourceManagerValidationError} 当保存对象、跨对象关联或脚本完整性不符合契约时抛出。
 */
function normalizeSourcePackageDefinitionPair(
  sourcePackageInput,
  sourceDefinitionInput,
  name
) {
  // 类型: object。
  // 作用: 严格隔离并复用 Repository 完整 Package 字段校验，不让后续事务读取调用方引用。
  const sourcePackage = wrapManagerValidation(() => {
    // 类型: object。
    // 作用: 保存严格 JSON 隔离副本，拒绝函数、复杂实例、访问器和有损值。
    const isolatedPackage = cloneSerializableValue(sourcePackageInput, `${name}.sourcePackage`);

    // 执行内容: 使用 Repository 保存对象契约校验全部 Package 字段。
    validateSourcePackage(isolatedPackage);

    // 返回值类型: object。
    // 作用: 返回完整且隔离的 Package 候选。
    return isolatedPackage;
  });

  // 类型: object。
  // 作用: 严格隔离并复用 Repository 完整 Definition 字段校验。
  const sourceDefinition = wrapManagerValidation(() => {
    // 类型: object。
    // 作用: 保存严格 JSON 隔离副本，后续身份比较不会穿透调用方对象。
    const isolatedDefinition = cloneSerializableValue(
      sourceDefinitionInput,
      `${name}.sourceDefinition`
    );

    // 执行内容: 使用 Repository 保存对象契约校验全部 Definition 字段、枚举和能力。
    validateSourceDefinition(isolatedDefinition);

    // 返回值类型: object。
    // 作用: 返回完整且隔离的 Definition 候选。
    return isolatedDefinition;
  });

  // 条件分支: Package.sourceId 和 Definition.id 不一致时进入。
  // 执行内容: 拒绝跨源包绑定，避免一个脚本包覆盖另一数据源定义。
  if (sourcePackage.sourceId !== sourceDefinition.id) {
    throw new SourceManagerValidationError(`${name} 的 Package.sourceId 必须等于 Definition.id`);
  }

  // 条件分支: Package 和 Definition 使用不同 packageRef 时进入。
  // 执行内容: 拒绝保存后无法通过 Definition 定位当前包的组合。
  if (sourcePackage.packageRef !== sourceDefinition.packageRef) {
    throw new SourceManagerValidationError(`${name} 的 Package 和 Definition.packageRef 必须一致`);
  }

  // 条件分支: Package 和 Definition 使用不同 providerKey 时进入。
  // 执行内容: 拒绝按来源类型猜测或暗中替换可信 Provider 绑定。
  if (sourcePackage.providerKey !== sourceDefinition.providerKey) {
    throw new SourceManagerValidationError(`${name} 的 Package 和 Definition.providerKey 必须一致`);
  }

  // 执行内容: 首次导入和最后更新时间必须使用标准 UTC ISO 文本，避免本地时区产生排序和审计歧义。
  assertIsoTimestamp(sourceDefinition.importedAt, `${name}.sourceDefinition.importedAt`);
  assertIsoTimestamp(sourceDefinition.lastUpdatedAt, `${name}.sourceDefinition.lastUpdatedAt`);

  // 类型: boolean。
  // 作用: 标识当前 Definition 是否来自远程连接，决定 remoteUrl 的必填或清空规则。
  const isRemoteImport = sourceDefinition.importMethod === IMPORT_METHOD.remote;

  // 条件分支: remote 导入没有非空 URL，或非 remote 导入仍携带 URL 时进入。
  // 执行内容: 拒绝导入方式与更新来源互相矛盾的 Definition。
  if ((isRemoteImport && !sourceDefinition.remoteUrl.trim())
    || (!isRemoteImport && sourceDefinition.remoteUrl !== '')) {
    throw new SourceManagerValidationError(`${name} 的 importMethod 和 remoteUrl 不一致`);
  }

  // 条件分支: Package 声明了当前不支持重新验证的完整性算法时进入。
  // 执行内容: 拒绝未知算法，不能把未验证声明哈希当作可信指纹。
  if (sourcePackage.integrity.algorithm !== SOURCE_PACKAGE_INTEGRITY_ALGORITHM) {
    throw new SourceManagerValidationError(`${name} 的 Package.integrity.algorithm 不受支持`);
  }

  // 类型: string。
  // 作用: 从实际脚本文本重新计算稳定指纹，供下一步和声明哈希严格比较。
  const calculatedScriptHash = createSourceScriptHash(sourcePackage.scriptContent);

  // 条件分支: 实际脚本文本指纹与 Package 声明不一致时进入。
  // 执行内容: 拒绝损坏或被篡改的导入/更新输入，不让它先保存再失败关闭。
  if (calculatedScriptHash !== sourcePackage.integrity.scriptHash) {
    throw new SourceManagerValidationError(`${name} 的 Package 脚本文本与声明指纹不一致`);
  }

  // 返回值类型: object。
  // 作用: 返回关联和完整性全部通过的隔离 Package/Definition 组合。
  return { sourcePackage, sourceDefinition };
}

/**
 * 校验单个 SourceManager sourceId。
 * 纯函数: 只读取输入并返回同一字符串。
 *
 * @param {*} sourceId 原始数据源 id。
 * @param {string} fieldName 错误信息使用的字段名。
 * @returns {string} 已通过动态键安全校验的 sourceId。
 * @throws {SourceManagerValidationError} 当 sourceId 为空、非字符串或使用危险名称时抛出。
 */
export function normalizeSourceManagerId(sourceId, fieldName = 'sourceId') {
  // 返回值类型: string。
  // 作用: 复用 Repository 动态键安全边界，并转换为 SourceManager 校验错误。
  return wrapManagerValidation(() => assertSafeRecordKey(sourceId, fieldName));
}

/**
 * 规范化启停命令。
 * 纯函数: 返回新对象，不修改调用方命令或交接对象。
 *
 * @param {*} command 原始启停命令。
 * @returns {object} 字段受控的启停命令。
 * @returns {string} return.sourceId 目标数据源 id。
 * @returns {boolean} return.enabled true 表示启用，false 表示关闭。
 * @returns {object|null} return.handoff 关闭默认源时的明确交接；其他路径为 null。
 * @throws {SourceManagerValidationError} 当字段、sourceId、Boolean 或交接结构不符合契约时抛出。
 */
export function normalizeSetSourceEnabledCommand(command) {
  // 类型: object。
  // 作用: 隔离并校验启停命令必填和可选字段集合。
  const safeCommand = normalizeCommandObject(
    command,
    SET_SOURCE_ENABLED_COMMAND_FIELDS,
    'setSourceEnabledCommand'
  );

  // 类型: string。
  // 作用: 保存已通过动态键安全校验的目标 sourceId。
  const sourceId = normalizeSourceManagerId(safeCommand.sourceId, 'setSourceEnabledCommand.sourceId');

  // 类型: boolean。
  // 作用: 保留用户明确 true/false 启停决定，不执行强制类型转换。
  const enabled = assertSourceManagerBoolean(safeCommand.enabled, 'setSourceEnabledCommand.enabled');

  // 类型: object|null。
  // 作用: 只有调用方显式提供 handoff 时才规范化；是否允许由最新默认源状态决定。
  const handoff = Object.hasOwn(safeCommand, 'handoff')
    ? normalizeDefaultSourceHandoff(safeCommand.handoff)
    : null;

  // 返回值类型: object。
  // 作用: 返回隔离启停命令，领域事务无需再次读取原输入。
  return { sourceId, enabled, handoff };
}

/**
 * 规范化用户授权命令。
 * 纯函数: 返回新对象，不修改调用方命令。
 *
 * @param {*} command 原始授权命令。
 * @returns {object} 字段完整的授权命令。
 * @returns {string} return.sourceId 目标自定义源 id。
 * @returns {string} return.authorizedAt 用户确认的标准 UTC ISO 时间。
 * @returns {boolean} return.enableAfterAuthorization true 表示授权后同时启用，false 表示只保存授权。
 * @throws {SourceManagerValidationError} 当字段、sourceId、时间或 Boolean 不符合契约时抛出。
 */
export function normalizeAuthorizeSourceCommand(command) {
  // 类型: object。
  // 作用: 隔离并校验授权命令精确字段集合。
  const safeCommand = normalizeCommandObject(
    command,
    AUTHORIZE_SOURCE_COMMAND_FIELDS,
    'authorizeSourceCommand'
  );

  // 返回值类型: object。
  // 作用: 返回严格 sourceId、标准时间和明确启用决定。
  return {
    sourceId: normalizeSourceManagerId(safeCommand.sourceId, 'authorizeSourceCommand.sourceId'),
    authorizedAt: assertIsoTimestamp(safeCommand.authorizedAt, 'authorizeSourceCommand.authorizedAt'),
    enableAfterAuthorization: assertSourceManagerBoolean(
      safeCommand.enableAfterAuthorization,
      'authorizeSourceCommand.enableAfterAuthorization'
    )
  };
}

/**
 * 规范化撤销授权命令。
 * 纯函数: 返回新对象，不修改调用方命令或交接对象。
 *
 * @param {*} command 原始撤销授权命令。
 * @returns {object} 字段受控的撤销授权命令。
 * @returns {string} return.sourceId 目标自定义源 id。
 * @returns {object|null} return.handoff 目标是默认源时的明确交接；其他路径为 null。
 * @throws {SourceManagerValidationError} 当字段、sourceId 或交接结构不符合契约时抛出。
 */
export function normalizeRevokeSourceAuthorizationCommand(command) {
  // 类型: object。
  // 作用: 隔离并校验撤销命令必填和可选字段集合。
  const safeCommand = normalizeCommandObject(
    command,
    REVOKE_SOURCE_AUTHORIZATION_COMMAND_FIELDS,
    'revokeSourceAuthorizationCommand'
  );

  // 返回值类型: object。
  // 作用: 返回严格 sourceId 和可选交接，领域事务无需读取原命令。
  return {
    sourceId: normalizeSourceManagerId(safeCommand.sourceId, 'revokeSourceAuthorizationCommand.sourceId'),
    handoff: Object.hasOwn(safeCommand, 'handoff')
      ? normalizeDefaultSourceHandoff(safeCommand.handoff)
      : null
  };
}

/**
 * 规范化恢复系统源 id 集合。
 * 纯函数: 返回新数组，不修改调用方集合。
 *
 * @param {*} sourceIds 原始恢复目标集合。
 * @returns {Array<string>} 非空、去重且保持首次出现顺序的安全 sourceId 数组。
 * @throws {SourceManagerValidationError} 当输入不是非空数组或包含危险 sourceId 时抛出。
 */
export function normalizeRestoreSystemSourceIds(sourceIds) {
  // 返回值类型: Array<string>。
  // 作用: 复用统一严格 JSON、非空数组、危险键和去重边界，不在服务层重新实现第二套规则。
  return normalizeSourceIds(sourceIds);
}

/**
 * 规范化数据源导入命令。
 * 纯函数: 返回隔离命令，不修改 Package、Definition 或 settings 输入。
 *
 * @param {*} command 原始导入命令。
 * @returns {object} 标准自定义源导入命令。
 * @returns {object} return.sourcePackage 已验证 SourcePackage。
 * @returns {object} return.sourceDefinition 已验证自定义 SourceDefinition。
 * @returns {object} return.settings 普通非敏感设置键值对象。
 * @throws {SourceManagerValidationError} 当字段、保存对象、关联、来源类型或 settings 不符合契约时抛出。
 */
export function normalizeImportSourceCommand(command) {
  // 类型: object。
  // 作用: 隔离并校验导入命令必须且只能包含三个标准保存输入。
  const safeCommand = normalizeCommandObject(
    command,
    IMPORT_SOURCE_COMMAND_FIELDS,
    'importSourceCommand'
  );

  // 类型: object。
  // 作用: 同时校验并隔离 Package、Definition 及其跨对象关联和脚本指纹。
  const sourcePair = normalizeSourcePackageDefinitionPair(
    safeCommand.sourcePackage,
    safeCommand.sourceDefinition,
    'importSourceCommand'
  );

  // 条件分支: 导入命令尝试安装 system 或 builtin 数据源时进入。
  // 执行内容: 拒绝把用户导入伪装为应用内置系统源；系统源只能随应用种子提供和软隐藏恢复。
  if (sourcePair.sourceDefinition.sourceKind !== SOURCE_KIND.custom
    || sourcePair.sourceDefinition.importMethod === IMPORT_METHOD.builtin) {
    throw new SourceManagerValidationError('importSourceCommand 只能安装非 builtin 自定义数据源');
  }

  // 类型: object。
  // 作用: 严格隔离普通 settings 值，Storage Repository 后续按每个键执行动态键和 JSON 校验。
  const settings = wrapManagerValidation(() => {
    // 类型: object。
    // 作用: 保存设置值隔离副本，避免导入完成后调用方修改 Repository 输入。
    const isolatedSettings = cloneSerializableValue(safeCommand.settings, 'importSourceCommand.settings');

    // 执行内容: settings 只接受普通键值对象，不接受数组、类实例或敏感分区容器。
    assertPlainObject(isolatedSettings, 'importSourceCommand.settings');

    // 循环类型: Object.keys.forEach。
    // 初始值: 第一个普通设置键。
    // 终止条件: 全部 settings 动态键完成安全校验。
    // 循环作用: 在任何 Repository 写入前拒绝空白和原型敏感键，不把失败推迟到 Storage.set。
    Object.keys(isolatedSettings).forEach((settingKey) => {
      assertSafeRecordKey(settingKey, 'importSourceCommand.settings key');
    });

    // 返回值类型: object。
    // 作用: 返回隔离普通设置供事务逐键保存。
    return isolatedSettings;
  });

  // 返回值类型: object。
  // 作用: 返回可直接进入领域冲突校验的标准导入命令。
  return { ...sourcePair, settings };
}

/**
 * 规范化数据源更新命令。
 * 纯函数: 返回隔离命令，不修改下一 Package、Definition 或交接输入。
 *
 * @param {*} command 原始更新命令。
 * @returns {object} 标准更新命令。
 * @returns {string} return.sourceId 必须保持稳定的目标数据源 id。
 * @returns {object} return.sourcePackage 已验证下一 SourcePackage。
 * @returns {object} return.sourceDefinition 已验证下一 SourceDefinition。
 * @returns {object|null} return.handoff 更新关闭当前默认源时的明确交接。
 * @throws {SourceManagerValidationError} 当字段、关联、目标身份或交接不符合契约时抛出。
 */
export function normalizeApplySourceUpdateCommand(command) {
  // 类型: object。
  // 作用: 隔离并校验更新命令必填字段和可选交接。
  const safeCommand = normalizeCommandObject(
    command,
    APPLY_SOURCE_UPDATE_COMMAND_FIELDS,
    'applySourceUpdateCommand'
  );

  // 类型: string。
  // 作用: 保存严格安全的目标 sourceId，更新不能通过新定义暗中改名。
  const sourceId = normalizeSourceManagerId(
    safeCommand.sourceId,
    'applySourceUpdateCommand.sourceId'
  );

  // 类型: object。
  // 作用: 校验并隔离下一 Package、Definition 和脚本指纹。
  const sourcePair = normalizeSourcePackageDefinitionPair(
    safeCommand.sourcePackage,
    safeCommand.sourceDefinition,
    'applySourceUpdateCommand'
  );

  // 条件分支: 下一包定义组合使用其他 sourceId 时进入。
  // 执行内容: 拒绝把更新操作变成隐式删除加导入，保持路由、缓存和用户内容身份稳定。
  if (sourcePair.sourceDefinition.id !== sourceId) {
    throw new SourceManagerValidationError('applySourceUpdateCommand 必须保持 sourceId 不变');
  }

  // 类型: object|null。
  // 作用: 只有调用方显式提供交接时才规范化；是否需要由事务中的最新默认源状态决定。
  const handoff = Object.hasOwn(safeCommand, 'handoff')
    ? normalizeDefaultSourceHandoff(safeCommand.handoff)
    : null;

  // 返回值类型: object。
  // 作用: 返回身份稳定、关联完整且交接受控的更新命令。
  return { sourceId, ...sourcePair, handoff };
}

/**
 * 规范化混合批量删除命令。
 * 纯函数: 返回新数组和交接对象，不修改调用方输入。
 *
 * @param {*} command 原始删除命令。
 * @returns {object} 标准删除命令。
 * @returns {Array<string>} return.sourceIds 非空去重目标集合。
 * @returns {object|null} return.handoff 整批影响默认源时的明确交接。
 * @throws {SourceManagerValidationError} 当字段、sourceIds 或交接结构不符合契约时抛出。
 */
export function normalizeDeleteSourcesCommand(command) {
  // 类型: object。
  // 作用: 隔离并校验删除命令只包含目标集合和可选交接。
  const safeCommand = normalizeCommandObject(
    command,
    DELETE_SOURCES_COMMAND_FIELDS,
    'deleteSourcesCommand'
  );

  // 返回值类型: object。
  // 作用: 返回去重安全 id 集合和隔离交接，整批领域规则在取得事务执行权后判断。
  return {
    sourceIds: normalizeSourceIds(safeCommand.sourceIds),
    handoff: Object.hasOwn(safeCommand, 'handoff')
      ? normalizeDefaultSourceHandoff(safeCommand.handoff)
      : null
  };
}

/**
 * 规范化最小脚本导出命令。
 * 纯函数: 返回新数组和原标准时间，不修改调用方输入。
 *
 * @param {*} command 原始导出命令。
 * @returns {object} 标准导出查询。
 * @returns {Array<string>} return.sourceIds 非空去重目标集合。
 * @returns {string} return.exportedAt 标准 UTC ISO 导出时间。
 * @throws {SourceManagerValidationError} 当字段、sourceIds 或时间不符合契约时抛出。
 */
export function normalizeSourceExportCommand(command) {
  // 类型: object。
  // 作用: 隔离并校验导出查询不包含下载、缓存、授权或页面选项。
  const safeCommand = normalizeCommandObject(
    command,
    SOURCE_EXPORT_COMMAND_FIELDS,
    'sourceExportCommand'
  );

  // 返回值类型: object。
  // 作用: 返回去重安全目标集合和未经时区转换的标准审计时间。
  return {
    sourceIds: normalizeSourceIds(safeCommand.sourceIds),
    exportedAt: assertIsoTimestamp(safeCommand.exportedAt, 'sourceExportCommand.exportedAt')
  };
}

/**
 * 读取必须存在的轻量 SourceRecord。
 * 纯函数: 只读取 SourceManagerState.records，不修改投影。
 *
 * @param {object} state 最新 SourceManagerState。
 * @param {string} sourceId 已规范化数据源 id。
 * @returns {object} 匹配 SourceRecord。
 * @throws {SourceManagerNotFoundError} 当记录不存在时抛出。
 */
export function findRequiredSourceRecord(state, sourceId) {
  // 类型: object|null。
  // 作用: 在最新投影中定位目标记录，未命中时保留 null 进入稳定错误分支。
  const record = state.records.find(item => item.definition.id === sourceId) || null;

  // 条件分支: 最新 Repository 投影中没有目标记录时进入。
  // 执行内容: 抛出稳定 notFound 错误，不返回模糊 false。
  if (!record) {
    throw new SourceManagerNotFoundError(`数据源不存在: ${sourceId}`);
  }

  // 返回值类型: object。
  // 作用: 返回当前事务局部投影记录，调用方只读取或基于它生成候选 Preferences。
  return record;
}

/**
 * 校验记录属于自定义源。
 * 纯函数: 只读取 Definition.sourceKind，不修改记录。
 *
 * @param {object} record 目标 SourceRecord。
 * @returns {object} 原自定义源记录。
 * @throws {SourceManagerInvariantError} 当目标是系统源时抛出。
 */
export function assertCustomSourceRecord(record) {
  // 条件分支: 目标不是 custom 数据源时进入。
  // 执行内容: 拒绝对系统内置源执行用户脚本授权或撤销事务。
  if (record.definition.sourceKind !== SOURCE_KIND.custom) {
    throw new SourceManagerInvariantError('只有自定义数据源支持用户运行授权');
  }

  // 返回值类型: object。
  // 作用: 返回原自定义源记录，便于后续授权快照生成。
  return record;
}

/**
 * 校验记录具备启用所需的结构、授权和软隐藏条件。
 * 纯函数: 只读取状态和记录，不修改 Preferences 或 runtime。
 *
 * @param {object} state 最新 SourceManagerState。
 * @param {object} record 目标 SourceRecord。
 * @returns {object} 可以启用的原记录。
 * @throws {SourceManagerInvariantError} 当记录软隐藏、结构损坏或自定义授权无效时抛出。
 */
export function assertSourceCanBeEnabled(state, record) {
  // 条件分支: 目标系统源仍在软隐藏集合中时进入。
  // 执行内容: 要求用户先执行恢复事务，不允许启用不可见记录。
  if (state.removedSystemSourceIds.includes(record.definition.id)) {
    throw new SourceManagerInvariantError('软隐藏系统源必须先恢复后才能启用');
  }

  // 条件分支: 当前记录没有已验证脚本指纹时进入。
  // 执行内容: 拒绝缺包、归属、Provider、完整性或偏好损坏记录启用。
  if (!record.runtime.currentScriptHash) {
    throw new SourceManagerInvariantError('数据源结构或脚本完整性无效，不能启用');
  }

  // 类型: object。
  // 作用: 使用当前 Definition.version、已验证指纹和授权快照重新评估启用权限。
  const authorizationState = evaluateSourceAuthorizationFingerprint({
    sourceKind: record.definition.sourceKind,
    version: record.definition.version,
    currentScriptHash: record.runtime.currentScriptHash,
    authorization: record.authorization
  });

  // 条件分支: 当前记录没有有效运行授权时进入。
  // 执行内容: 拒绝自定义源启用，要求用户先完成授权事务。
  if (!authorizationState.isAuthorized) {
    throw new SourceManagerInvariantError('数据源尚未获得当前版本运行授权');
  }

  // 返回值类型: object。
  // 作用: 返回通过结构、授权和可见性门禁的原记录。
  return record;
}

/**
 * 判断记录当前是否具有受审可执行 Provider。
 * 纯函数: 只读取 SourceRecord.runtime.providerReadiness，不查询注册表、不创建 Provider。
 *
 * @param {object|null} record 待判断 SourceRecord；记录缺失时为 null。
 * @returns {boolean} true 表示当前 Bundle 已注册并支持该 Definition；false 表示不能进入执行候选。
 */
export function isSourceProviderReady(record) {
  // 返回值类型: boolean。
  // 作用: 只把严格 ready 视为可执行资格；缺失或未知字段失败关闭，不推断 providerKey。
  return Boolean(
    record
    && record.runtime
    && record.runtime.providerReadiness
    && record.runtime.providerReadiness.status === PROVIDER_READINESS_STATUS.ready
  );
}

/**
 * 校验记录可以作为默认源候选。
 * 纯函数: 只读取状态和记录，不修改投影。
 *
 * @param {object} state 最新 SourceManagerState。
 * @param {object} record 目标 SourceRecord。
 * @returns {object} 有效启用、Provider 就绪且未隐藏的原记录。
 * @throws {SourceManagerInvariantError} 当记录关闭、Provider 未就绪或软隐藏时抛出。
 */
export function assertSourceSelectable(state, record) {
  // 条件分支: 目标记录当前没有有效启用时进入。
  // 执行内容: 拒绝关闭、结构损坏或授权失效记录成为默认源。
  if (!record.runtime.enabled) {
    throw new SourceManagerInvariantError('只有有效启用的数据源可以成为默认源');
  }

  // 条件分支: 当前 Bundle 没有可执行 Provider 或工厂不支持 Definition 时进入。
  // 执行内容: 拒绝把只保存用户启用意愿的记录作为默认源或活动源。
  if (!isSourceProviderReady(record)) {
    throw new SourceManagerInvariantError('只有 Provider 已就绪的数据源可以成为默认源');
  }

  // 条件分支: 目标系统源仍在软隐藏集合中时进入。
  // 执行内容: 拒绝不可见系统源成为默认源候选。
  if (state.removedSystemSourceIds.includes(record.definition.id)) {
    throw new SourceManagerInvariantError('软隐藏系统源不能成为默认源');
  }

  // 返回值类型: object。
  // 作用: 返回通过启用、Provider 就绪和可见性门禁的原记录。
  return record;
}

/**
 * 解析会使当前默认源失效的操作交接结果。
 * 纯函数: 只读取状态、影响集合和交接命令，不修改默认源。
 *
 * @param {object} state 最新 SourceManagerState。
 * @param {Array<string>} affectedSourceIds 本次操作会使其失效的 sourceId 集合。
 * @param {object|null} handoff 调用方明确交接；不影响默认源时应为 null。
 * @returns {string} 操作完成后的 defaultSourceId；clear 返回空字符串。
 * @throws {SourceManagerValidationError} 当不需要交接却提供 handoff 时抛出。
 * @throws {SourceManagerInvariantError} 当需要交接但缺失命令，或 replace 候选无效时抛出。
 */
export function resolveDefaultSourceHandoff(state, affectedSourceIds, handoff) {
  // 类型: Array<string>。
  // 作用: 严格校验、去重并保留本次失效范围顺序。
  const normalizedAffectedSourceIds = normalizeSourceIds(affectedSourceIds);

  // 类型: boolean。
  // 作用: 判断当前默认源是否属于本次将失效的完整目标集合。
  const affectsCurrentDefault = Boolean(
    state.defaultSourceId
    && normalizedAffectedSourceIds.includes(state.defaultSourceId)
  );

  // 条件分支: 操作不影响当前默认源但调用方仍提交 handoff 时进入。
  // 执行内容: 拒绝无意义交接，避免命令暗中修改与目标无关的默认源。
  if (!affectsCurrentDefault && handoff !== null) {
    throw new SourceManagerValidationError('当前操作不影响默认源，不能提交 handoff');
  }

  // 条件分支: 操作不影响当前默认源时进入。
  // 执行内容: 保留当前 defaultSourceId，不执行候选选择或额外写入。
  if (!affectsCurrentDefault) {
    return state.defaultSourceId;
  }

  // 条件分支: 操作会使当前默认源失效但没有交接决定时进入。
  // 执行内容: 拒绝事务，不能由 SourceManager 替用户自动挑选候选。
  if (handoff === null) {
    throw new SourceManagerInvariantError('影响当前默认源的操作必须提交 replace 或 clear 交接');
  }

  // 条件分支: 用户明确选择 clear 模式时进入。
  // 执行内容: 返回空默认源，不自动选择其他有效记录。
  if (handoff.mode === 'clear') {
    return '';
  }

  // 条件分支: replace 候选也在本次失效集合中时进入。
  // 执行内容: 拒绝会在同一事务内失效的交接目标。
  if (normalizedAffectedSourceIds.includes(handoff.sourceId)) {
    throw new SourceManagerInvariantError('默认源接替目标不能属于本次失效范围');
  }

  // 类型: object。
  // 作用: 从最新投影定位明确 replace 候选，不使用旧 Preferences 或页面快照。
  const replacementRecord = findRequiredSourceRecord(state, handoff.sourceId);

  // 执行内容: replace 候选必须有效启用且未软隐藏。
  assertSourceSelectable(state, replacementRecord);

  // 返回值类型: string。
  // 作用: 返回用户明确选择且已通过最新状态门禁的接替 sourceId。
  return replacementRecord.definition.id;
}

/**
 * 从当前版本和已验证指纹创建 authorized 快照。
 * 纯函数: 返回新授权对象，不修改记录。
 *
 * @param {object} record 目标自定义源 SourceRecord。
 * @param {string} authorizedAt 用户确认授权的标准 UTC ISO 时间。
 * @returns {object} 与当前版本和脚本指纹完全匹配的授权快照。
 * @throws {SourceManagerInvariantError} 当记录不是自定义源或没有已验证指纹时抛出。
 */
export function createAuthorizedSourceSnapshot(record, authorizedAt) {
  // 执行内容: 用户授权只允许作用于自定义源。
  assertCustomSourceRecord(record);

  // 条件分支: 当前记录没有已验证脚本指纹时进入。
  // 执行内容: 拒绝为结构损坏或完整性失败脚本创建授权快照。
  if (!record.runtime.currentScriptHash) {
    throw new SourceManagerInvariantError('脚本完整性无效，不能创建运行授权');
  }

  // 返回值类型: object。
  // 作用: 只从当前 Definition.version、已验证指纹和用户确认时间生成 authorized 快照。
  return createSourceAuthorizationStateFromFingerprint({
    version: record.definition.version,
    currentScriptHash: record.runtime.currentScriptHash
  }, {
    status: AUTHORIZATION_STATUS.authorized,
    authorizedAt
  });
}

/**
 * 创建 revoked 授权快照并保留最近授权诊断字段。
 * 纯函数: 返回新授权对象，不修改记录授权。
 *
 * @param {object} record 目标自定义源 SourceRecord。
 * @returns {object} status 为 revoked 且保留历史时间、版本和指纹的快照。
 * @throws {SourceManagerInvariantError} 当记录不是自定义源时抛出。
 */
export function createRevokedSourceSnapshot(record) {
  // 执行内容: 用户撤销授权只允许作用于自定义源。
  assertCustomSourceRecord(record);

  // 返回值类型: object。
  // 作用: 使用统一授权工厂保留历史诊断字段，同时把用户决定明确改为 revoked。
  return createSourceAuthorizationStateFromFingerprint({
    version: record.definition.version,
    currentScriptHash: record.runtime.currentScriptHash
  }, {
    status: AUTHORIZATION_STATUS.revoked,
    authorizedAt: record.authorization.authorizedAt,
    authorizedVersion: record.authorization.authorizedVersion,
    authorizedScriptHash: record.authorization.authorizedScriptHash
  });
}

/**
 * 创建自定义源待授权快照，并可保留最近授权诊断字段。
 * 纯函数: 返回新授权对象，不修改 Package、Definition 或历史授权。
 * 使用场景: 新导入源使用空历史；版本或脚本变化的更新源保留旧授权时间、版本和指纹。
 *
 * @param {object} sourcePackage 当前已经通过完整性校验的 SourcePackage。
 * @param {object} sourceDefinition 当前自定义 SourceDefinition。
 * @param {object|null} previousAuthorization 可选历史授权快照；首次导入时为 null。
 * @returns {object} status 为 pending 的授权快照。
 * @throws {SourceManagerValidationError} 当 Package/Definition 关联或历史授权不是普通对象时抛出。
 * @throws {SourceManagerInvariantError} 当目标不是自定义数据源时抛出。
 */
export function createPendingSourceAuthorizationSnapshot(
  sourcePackage,
  sourceDefinition,
  previousAuthorization = null
) {
  // 类型: object。
  // 作用: 重新验证并隔离 Package/Definition，授权快照不能建立在未验证声明指纹上。
  const sourcePair = normalizeSourcePackageDefinitionPair(
    sourcePackage,
    sourceDefinition,
    'pendingSourceAuthorization'
  );

  // 条件分支: 目标不是自定义源时进入。
  // 执行内容: 系统源由来源类型直接获得运行权限，不创建用户 pending 授权。
  if (sourcePair.sourceDefinition.sourceKind !== SOURCE_KIND.custom) {
    throw new SourceManagerInvariantError('只有自定义数据源使用 pending 运行授权');
  }

  // 类型: object。
  // 作用: 没有历史授权时使用空对象；更新路径保留最近诊断字段但不保留 authorized 状态。
  const authorizationHistory = previousAuthorization === null
    ? {}
    : wrapManagerValidation(() => {
      // 类型: object。
      // 作用: 隔离历史授权，避免返回快照和旧投影共享引用。
      const isolatedAuthorization = cloneSerializableValue(
        previousAuthorization,
        'previousAuthorization'
      );

      // 执行内容: 历史授权必须是普通保存对象，拒绝数组或复杂实例。
      assertPlainObject(isolatedAuthorization, 'previousAuthorization');

      // 执行内容: 历史授权必须具备精确字段、稳定状态和合法组合，不能把损坏快照带入新 pending 状态。
      validateSourceAuthorization(isolatedAuthorization, 'previousAuthorization');

      // 返回值类型: object。
      // 作用: 返回隔离历史字段供统一授权工厂读取。
      return isolatedAuthorization;
    });

  // 返回值类型: object。
  // 作用: 使用新版本和已验证新指纹建立 pending 状态，同时保留旧授权诊断字段。
  return createSourceAuthorizationStateFromFingerprint({
    version: sourcePair.sourceDefinition.version,
    currentScriptHash: sourcePair.sourcePackage.integrity.scriptHash
  }, {
    status: AUTHORIZATION_STATUS.pending,
    authorizedAt: authorizationHistory.authorizedAt || '',
    authorizedVersion: authorizationHistory.authorizedVersion || '',
    authorizedScriptHash: authorizationHistory.authorizedScriptHash || ''
  });
}

/**
 * 从轻量状态提取下一次组装可接受的会话运行态索引。
 * 纯函数: 返回严格隔离新对象，不修改 SourceManagerState。
 *
 * @param {object} state 当前 SourceManagerState。
 * @returns {Record<string, object>} 按 sourceId 保存的健康、Provider 和更新会话字段。
 */
export function createSourceRuntimeIndex(state) {
  // 类型: Array<[string, object]>。
  // 作用: 按当前记录顺序提取组装器允许的会话字段，排除 enabled、指纹和检查过程状态。
  const runtimeEntries = state.records.map((record) => {
    // 类型: object。
    // 作用: 保存当前记录可跨 Repository 重组装保留的会话字段。
    const runtimeState = Object.fromEntries(SOURCE_STABLE_RUNTIME_FIELDS.map(field => [
      field,
      record.runtime[field]
    ]));

    // 返回值类型: [string, object]。
    // 作用: 使用 Definition.id 建立运行态索引条目。
    return [record.definition.id, runtimeState];
  });

  // 返回值类型: Record<string, object>。
  // 作用: 严格隔离运行态索引，后续事务采用不会保留 state 嵌套引用。
  return cloneSerializableValue(Object.fromEntries(runtimeEntries), 'sourceRuntimeIndex');
}

/**
 * 从三个 Repository 读取最新保存图和 usage 并组装轻量投影。
 * 副作用: 调用 Repository 异步只读方法；不执行保存、清理或页面更新。
 * 成功路径: 返回最新 Preferences 隔离副本和 SourceManagerState。
 * 失败路径: 任一 Repository 读取、usage 或状态组装失败时 reject 原领域错误。
 *
 * @param {object} repositories 三个 Repository 引用。
 * @param {object} repositories.packageRepository SourcePackageRepository。
 * @param {object} repositories.definitionRepository SourceDefinitionRepository。
 * @param {object} repositories.storageRepository SourceStorageRepository。
 * @param {object} providerReadinessPort 当前 Bundle Provider 就绪只读端口，只包含 evaluate。
 * @param {Record<string, object>} runtimeBySourceId 当前会话运行态索引。
 * @param {string} activeSourceId 当前活动源 id；没有活动源时为空字符串。
 * @param {object} switchState SourceManager 当前唯一活动源切换状态。
 * @returns {Promise<object>} 最新 Repository 图投影结果。
 * @returns {object} return.state 轻量 SourceManagerState。
 * @returns {object} return.preferences 当前 SourcePreferences 隔离副本。
 * @throws {Error} 当 Repository 读取或投影组装失败时抛出原错误。
 */
export async function loadSourceManagerRepositoryProjection(
  repositories,
  providerReadinessPort,
  runtimeBySourceId,
  activeSourceId,
  switchState
) {
  // 类型: Array<object>|object。
  // 作用: 并行载入 Package、Definition 和 Preferences，全部成功后才读取 usage。
  const [packages, definitions, preferences] = await Promise.all([
    repositories.packageRepository.loadAll(),
    repositories.definitionRepository.loadDefinitions(),
    repositories.definitionRepository.loadPreferences()
  ]);

  // 类型: Array<[string, object]>。
  // 作用: 按每条 Definition 的 sourceId 并行读取完整 SourceStorageUsage。
  const usageEntries = await Promise.all(definitions.map(async definition => [
    definition.id,
    await repositories.storageRepository.getUsage(definition.id)
  ]));

  // 类型: Array<[string, object]>。
  // 作用: 按 Definition 原顺序并行取得当前 Bundle 就绪结果；端口不返回工厂或注册表引用。
  const providerReadinessEntries = await Promise.all(definitions.map(async definition => [
    definition.id,
    await providerReadinessPort.evaluate(definition)
  ]));

  // 类型: object。
  // 作用: 使用最新保存图、真实 usage 和当前会话运行态组装安全轻量投影。
  const state = assembleSourceManagerState({
    packages,
    definitions,
    preferences,
    usageBySourceId: Object.fromEntries(usageEntries),
    providerReadinessBySourceId: Object.fromEntries(providerReadinessEntries),
    runtimeBySourceId,
    activeSourceId,
    switchState
  });

  // 返回值类型: object。
  // 作用: 同时返回最新投影和 Preferences，事务可以基于同一读取时点生成候选保存值。
  return {
    state,
    preferences
  };
}
