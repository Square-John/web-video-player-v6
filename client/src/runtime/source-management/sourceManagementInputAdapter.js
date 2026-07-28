/*
  sourceManagementInputAdapter.js 模块说明

  - 文件职责:
      把设置页文件、在线地址和粘贴文本输入转换成 SourceManager 接受的完整导入命令。
      把 MockSourceUpdatePort 返回的受审候选转换成保持稳定身份字段的完整更新命令。
      本模块只做严格校验、规范化和命令构造，不写 Repository、不调用 Host、不访问网络，也不执行 scriptContent。

  - 导入库及文件汇总(5 条，内置 0 条，第三方 0 条，自定义 5 条):
      IMPORT_METHOD、SOURCE_KIND: 自定义配置，限定导入方式并固定用户导入为自定义源。
      cloneSerializableValue: 自定义工具，隔离页面输入和更新候选。
      Repository validators: 自定义校验，复用普通对象、精确字段、保存对象和安全键规则。
      createSourceScriptHash、normalizeSourceScriptContent: 自定义工具，规范化脚本文本并生成稳定指纹。
      SourceManagementValidationError: 自定义错误，把输入和候选失败统一到管理边界。

  - 模块级常量:
      SOURCE_IMPORT_INPUT_FIELDS: Array<string>，导入适配器允许的精确输入字段。
      SOURCE_UPDATE_CANDIDATE_FIELDS: Array<string>，受审更新候选固定字段。
      SOURCE_UPDATE_STABLE_DEFINITION_FIELDS: Array<string>，更新不能改变的 Definition 身份字段。
      SOURCE_CAPABILITY_FIELDS: Array<string>，SourceDefinition 六类页面能力键。
      SOURCE_PACKAGE_SCHEMA_VERSION: string，当前 SourcePackage 保存结构版本。
      SOURCE_DEFINITION_SCHEMA_VERSION: string，当前 SourceDefinition 保存结构版本。
      SOURCE_PACKAGE_HASH_ALGORITHM: string，脚本变化检测算法名称。
      SOURCE_PACKAGE_REF_PREFIX: string，稳定 Package 引用前缀。
      UNRESOLVED_CUSTOM_PROVIDER_KEY: string，当前不可执行自定义脚本门禁键。
      IMPORTED_SOURCE_ID_PREFIX: string，内容寻址自定义 sourceId 前缀。
      IMPORTED_SOURCE_DESCRIPTION: string，当前未解析导入源统一说明。
      SOURCE_MANAGEMENT_INPUT_ADAPTER_PUBLIC_METHODS: Array<string>，适配器公开方法顺序。

  - 模块级变量:
      无

  - 模块级辅助函数:
      wrapValidation(action, message): 把底层严格校验转换为管理校验错误。
      assertIsoTimestamp(value, fieldName): 校验标准 UTC ISO 时间。
      normalizeRemoteUrl(importMethod, remoteUrl): 校验远程地址和非远程空值规则。
      createDefaultCapabilities(): 创建六类页面能力完整默认映射。
      createImportedSourceId(input): 根据导入身份材料生成稳定 sourceId。
      validatePackageDefinitionPair(sourcePackage, sourceDefinition, fieldName): 校验包定义和脚本指纹关联。
      createSourceManagementInputAdapter(): 创建冻结纯适配门面。

  - 模块级类:
      无

  - 对外导出:
      UNRESOLVED_CUSTOM_PROVIDER_KEY: string，供组合层识别尚不可执行的自定义源。
      createSourceManagementInputAdapter: Function，创建导入和更新命令适配器。
*/

import {
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 数据源导入方式枚举。
  // 文件作用: 只接受 file、remote 和 text 用户导入方式，拒绝伪造 builtin。
  IMPORT_METHOD,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源来源类型枚举。
  // 文件作用: 所有页面导入命令固定创建 custom Definition。
  SOURCE_KIND
} from '../../config/source-manager.config.js';

// 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON 隔离工具。
// 文件作用: 防止页面和更新端口在适配完成后修改命令对象。
import { cloneSerializableValue } from '../../repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertExactObjectKeys 精确字段校验函数。
  // 文件作用: 拒绝导入输入和更新候选携带未声明兼容字段。
  assertExactObjectKeys,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertNonEmptyString 非空字符串校验函数。
  // 文件作用: 校验名称、版本和导入时间等必填字符串。
  assertNonEmptyString,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 普通对象校验函数。
  // 文件作用: 在字段读取前拒绝数组、复杂实例和异常原型。
  assertPlainObject,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourceDefinition Definition 完整校验函数。
  // 文件作用: 对适配器构造和更新端口候选执行同一保存对象校验。
  validateSourceDefinition,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourcePackage Package 完整校验函数。
  // 文件作用: 校验包字段、integrity 结构和脚本文本类型。
  validateSourcePackage
} from '../../repositories/source/sourceRepositoryValidators.js';

import {
  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: createSourceScriptHash 稳定脚本指纹函数。
  // 文件作用: 生成 Package.integrity.scriptHash 和内容寻址 sourceId。
  createSourceScriptHash,

  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: normalizeSourceScriptContent 跨平台换行规范化函数。
  // 文件作用: 文件、远程和文本输入使用同一脚本文本保存与授权指纹。
  normalizeSourceScriptContent
} from '../../utils/sourceAuthorization.js';

// 导入来源: ./sourceManagementErrors.js。
// 导入内容: SourceManagementValidationError 设置管理校验错误。
// 文件作用: 把 Repository 校验、URL、时间和跨对象关系失败统一转换为稳定管理错误。
import { SourceManagementValidationError } from './sourceManagementErrors.js';

// 类型: Array<string>。
// 作用: 导入 Runtime 必须补齐 importedAt，页面其余五个字段保持现有表单契约；额外字段明确失败。
const SOURCE_IMPORT_INPUT_FIELDS = Object.freeze([
  'importMethod',
  'name',
  'version',
  'remoteUrl',
  'scriptContent',
  'importedAt'
]);

// 类型: Array<string>。
// 作用: 更新端口只能返回下一 Package 和 Definition，不携带 handoff、页面状态或保存副作用。
const SOURCE_UPDATE_CANDIDATE_FIELDS = Object.freeze([
  'sourcePackage',
  'sourceDefinition'
]);

// 类型: Array<string>。
// 作用: 更新必须保持 id、来源类型、工厂、包引用、导入方式、远程地址和首次导入时间不变。
const SOURCE_UPDATE_STABLE_DEFINITION_FIELDS = Object.freeze([
  'id',
  'sourceKind',
  'providerKey',
  'packageRef',
  'importMethod',
  'remoteUrl',
  'importedAt'
]);

// 类型: Array<string>。
// 作用: 当前导入表单没有能力编辑项，因此按已冻结旧页面行为创建六类完整 true 映射。
const SOURCE_CAPABILITY_FIELDS = Object.freeze([
  'home',
  'movie',
  'tv',
  'search',
  'detail',
  'play'
]);

// 类型: string。
// 作用: 标识当前 SourcePackage 保存结构版本，与 Memory Repository 种子保持一致。
const SOURCE_PACKAGE_SCHEMA_VERSION = '1.0.0';

// 类型: string。
// 作用: 标识当前 SourceDefinition 保存结构版本，与设置页冻结记录保持一致。
const SOURCE_DEFINITION_SCHEMA_VERSION = '1.0.0';

// 类型: string。
// 作用: 说明 integrity.scriptHash 使用项目现有 FNV-1a 32 位变化检测，不表示安全签名。
const SOURCE_PACKAGE_HASH_ALGORITHM = 'fnv1a-32';

// 类型: string。
// 作用: 给导入源建立稳定 Package 引用，Repository 不根据 Definition 反向猜测引用。
const SOURCE_PACKAGE_REF_PREFIX = 'source-package::';

// 类型: string。
// 作用: 标识用户导入文本尚未接入受审工厂；用户可以保存授权与 enabled 决定，但 Host 不执行它。
export const UNRESOLVED_CUSTOM_PROVIDER_KEY = 'unresolved-custom-provider';

// 类型: string。
// 作用: 给内容寻址自定义源 id 提供可识别前缀，避免模块计数器、随机数和时间戳碰撞策略。
const IMPORTED_SOURCE_ID_PREFIX = 'custom-source-';

// 类型: string。
// 作用: 说明当前页面导入记录仍处于未解析执行阶段，不伪装成安全认证或可运行 Provider。
const IMPORTED_SOURCE_DESCRIPTION = '用户导入的未解析自定义数据源。';

// 类型: Array<string>。
// 作用: 固定适配器只公开导入和更新命令构造能力，不泄漏校验函数或配置常量。
const SOURCE_MANAGEMENT_INPUT_ADAPTER_PUBLIC_METHODS = Object.freeze([
  'createImportCommand',
  'createUpdateCommand'
]);

/**
 * 执行底层严格校验并转换为设置管理错误。
 * 纯函数: 除调用 action 外不修改任何输入或状态。
 * 失败路径: 保留 Repository 或原生校验 cause，统一抛 SourceManagementValidationError。
 *
 * @param {Function} action 严格校验回调。
 * @param {string} message 当前适配边界错误说明。
 * @returns {*} action 成功结果。
 */
function wrapValidation(action, message) {
  try {
    return action();
  } catch (error) {
    throw new SourceManagementValidationError(message, { cause: error });
  }
}

/**
 * 校验标准 UTC ISO 时间。
 * 纯函数: 不修改输入，也不读取系统时间。
 * 失败路径: 非字符串、无效日期或非标准 UTC 序列化文本抛管理 validation。
 *
 * @param {*} value 时间候选。
 * @param {string} fieldName 诊断字段名。
 * @returns {string} 原标准 UTC ISO 时间。
 */
function assertIsoTimestamp(value, fieldName) {
  // 类型: string。
  // 作用: 保存通过非空校验的时间文本，后续执行无歧义 UTC 比较。
  const timestamp = wrapValidation(
    () => assertNonEmptyString(value, fieldName),
    `${fieldName} 必须是非空字符串`
  );

  // 类型: number。
  // 作用: 解析时间候选；NaN 表示浏览器和 Node 都无法识别为有效日期。
  const timestampValue = Date.parse(timestamp);

  // 条件分支: 时间无效或重新序列化后不等于原输入时进入。
  // 执行内容: 拒绝本地时区、缩写和非标准精度文本，保证保存和测试一致。
  if (!Number.isFinite(timestampValue) || new Date(timestampValue).toISOString() !== timestamp) {
    throw new SourceManagementValidationError(`${fieldName} 必须是标准 UTC ISO 时间`);
  }

  return timestamp;
}

/**
 * 校验导入方式对应的远程地址。
 * 纯函数: 只解析 URL 并返回字符串，不发起网络请求。
 * 成功路径: remote 返回 http/https URL；file/text 返回空字符串。
 * 失败路径: remote 缺地址、协议不受控，或非 remote 携带地址时抛管理 validation。
 *
 * @param {string} importMethod 已校验导入方式。
 * @param {*} remoteUrl 远程地址候选。
 * @returns {string} 标准保存地址或空字符串。
 */
function normalizeRemoteUrl(importMethod, remoteUrl) {
  // 条件分支: 当前不是远程导入时进入。
  // 执行内容: 只接受空字符串，防止文件/文本记录暗中保存远程更新地址。
  if (importMethod !== IMPORT_METHOD.remote) {
    // 条件分支: 文件或粘贴文本输入仍携带远程地址时进入。
    // 执行内容: 拒绝一条 Definition 同时表达两种导入来源。
    if (remoteUrl !== '') {
      throw new SourceManagementValidationError('非远程导入的 remoteUrl 必须为空字符串');
    }
    return '';
  }

  // 类型: string。
  // 作用: 保存远程导入必填地址，供 URL 协议校验和 Definition 保存。
  const safeRemoteUrl = wrapValidation(
    () => assertNonEmptyString(remoteUrl, 'sourceImportInput.remoteUrl'),
    '远程导入必须提供 remoteUrl'
  );

  // 类型: URL|undefined。
  // 作用: 保存浏览器/Node 标准 URL 解析结果，后续只读取协议而不发起请求。
  let parsedUrl;
  try {
    parsedUrl = new URL(safeRemoteUrl);
  } catch (error) {
    throw new SourceManagementValidationError('sourceImportInput.remoteUrl 不是有效 URL', {
      cause: error
    });
  }

  // 条件分支: URL 不是 http 或 https 时进入。
  // 执行内容: 拒绝 file、javascript、data 等不能作为未来远程脚本端口输入的协议。
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new SourceManagementValidationError('sourceImportInput.remoteUrl 只允许 http 或 https');
  }

  return safeRemoteUrl;
}

/**
 * 创建当前导入页默认能力映射。
 * 纯函数: 每次返回新普通对象，调用方不能通过共享引用修改后续命令。
 *
 * @returns {object} 六类页面能力均为 true 的完整映射。
 */
function createDefaultCapabilities() {
  // 类型: object。
  // 作用: 保存当前调用独立能力映射，避免复用冻结样板或页面显示对象。
  const capabilities = {};

  // 循环类型: Array.prototype.forEach。
  // 初始值: home。
  // 终止条件: 六类能力字段全部写入。
  // 循环作用: 以领域字段清单构造完整 Boolean 映射，避免散落对象字面量漂移。
  SOURCE_CAPABILITY_FIELDS.forEach((field) => {
    // 类型: boolean。
    // 作用: true 表示当前 mock 导入阶段默认声明支持该页面能力；后续真实清单可由正式解析端口覆盖。
    capabilities[field] = true;
  });

  return capabilities;
}

/**
 * 根据稳定导入身份材料创建内容寻址 sourceId。
 * 纯函数: 相同名称、版本、方式、地址和脚本文本始终生成同一 id，不读取 store、计数器、随机数或时间。
 *
 * @param {object} input 已规范化导入身份材料。
 * @returns {string} 安全自定义 sourceId。
 */
function createImportedSourceId(input) {
  // 类型: string。
  // 作用: 使用字段顺序固定的 JSON 文本表达导入身份，不包含 importedAt 等每次变化字段。
  const identityMaterial = JSON.stringify({
    importMethod: input.importMethod,
    name: input.name,
    version: input.version,
    remoteUrl: input.remoteUrl,
    scriptContent: input.scriptContent
  });

  // 返回值类型: string。
  // 作用: 使用稳定前缀和八位内容指纹生成 Repository、Host、路由和页面共用身份。
  return `${IMPORTED_SOURCE_ID_PREFIX}${createSourceScriptHash(identityMaterial)}`;
}

/**
 * 校验 Package、Definition 及跨对象脚本指纹关系。
 * 纯函数: 返回隔离对象，不修改端口候选或构造对象。
 * 失败路径: 保存对象字段、sourceId/providerKey/packageRef 关系或指纹不一致时抛管理 validation。
 *
 * @param {*} sourcePackageInput SourcePackage 候选。
 * @param {*} sourceDefinitionInput SourceDefinition 候选。
 * @param {string} fieldName 诊断字段名前缀。
 * @returns {object} 包含隔离 sourcePackage 和 sourceDefinition 的对象。
 */
function validatePackageDefinitionPair(sourcePackageInput, sourceDefinitionInput, fieldName) {
  // 类型: object。
  // 作用: 保存通过严格 JSON、精确字段和 Package 结构校验的隔离脚本包。
  const sourcePackage = wrapValidation(
    () => validateSourcePackage(cloneSerializableValue(sourcePackageInput, `${fieldName}.sourcePackage`)),
    `${fieldName}.sourcePackage 无效`
  );
  // 类型: object。
  // 作用: 保存通过严格 JSON、精确字段、枚举、能力和 settingsSchema 校验的隔离定义。
  const sourceDefinition = wrapValidation(
    () => validateSourceDefinition(
      cloneSerializableValue(sourceDefinitionInput, `${fieldName}.sourceDefinition`)
    ),
    `${fieldName}.sourceDefinition 无效`
  );

  // 条件分支: Package 与 Definition 的 sourceId、providerKey 或 packageRef 任一不一致时进入。
  // 执行内容: 拒绝跨对象身份断裂的导入或更新候选。
  if (sourcePackage.sourceId !== sourceDefinition.id
    || sourcePackage.providerKey !== sourceDefinition.providerKey
    || sourcePackage.packageRef !== sourceDefinition.packageRef) {
    throw new SourceManagementValidationError(`${fieldName} 的 Package 与 Definition 身份关联不一致`);
  }

  // 类型: string。
  // 作用: 从候选真实规范化脚本文本重新计算指纹，不信任端口或输入声明。
  const calculatedScriptHash = createSourceScriptHash(sourcePackage.scriptContent);

  // 条件分支: 算法名称或声明指纹与重新计算结果不一致时进入。
  // 执行内容: 拒绝损坏或被修改的脚本包进入 Manager 事务。
  if (sourcePackage.integrity.algorithm !== SOURCE_PACKAGE_HASH_ALGORITHM
    || sourcePackage.integrity.scriptHash !== calculatedScriptHash) {
    throw new SourceManagementValidationError(`${fieldName}.sourcePackage 脚本完整性声明无效`);
  }

  return { sourcePackage, sourceDefinition };
}

/**
 * 创建设置管理输入适配器。
 * 副作用: 只创建冻结两方法门面，不读取系统时间、网络、Repository、Manager 或 Host。
 * 成功路径: 返回 createImportCommand 和 createUpdateCommand 纯适配能力。
 *
 * @returns {object} 冻结 SourceManagementInputAdapter 门面。
 */
export function createSourceManagementInputAdapter() {
  /**
   * 创建完整自定义源导入命令。
   * 纯函数: 相同输入返回字段一致的新命令，不修改页面表单。
   * 远程边界: 当前不访问网络；remote 可以保存空脚本文本，明确保持 unresolved 且不可执行。
   *
   * @param {*} input 页面输入与 Runtime 补入 importedAt 的候选对象。
   * @returns {object} SourceManager.importSource 接受的完整命令。
   */
  function createImportCommand(input) {
    // 类型: object。
    // 作用: 保存页面输入和 Runtime 时间字段的严格 JSON 副本，后续构造不再读取调用方引用。
    const safeInput = wrapValidation(
      () => cloneSerializableValue(input, 'sourceImportInput'),
      'sourceImportInput 必须是严格 JSON 对象'
    );
    wrapValidation(() => assertPlainObject(safeInput, 'sourceImportInput'), 'sourceImportInput 必须是普通对象');
    wrapValidation(
      () => assertExactObjectKeys(safeInput, SOURCE_IMPORT_INPUT_FIELDS, 'sourceImportInput'),
      'sourceImportInput 字段集合无效'
    );

    // 条件分支: importMethod 不属于三种用户导入方式时进入。
    // 执行内容: 拒绝用户输入伪装 builtin 系统源或使用未知兼容值。
    if (![IMPORT_METHOD.file, IMPORT_METHOD.remote, IMPORT_METHOD.text].includes(safeInput.importMethod)) {
      throw new SourceManagementValidationError('sourceImportInput.importMethod 只允许 file、remote 或 text');
    }

    // 类型: string。
    // 作用: 保存非空展示名称，写入 Definition 并参与稳定 sourceId 身份材料。
    const name = wrapValidation(
      () => assertNonEmptyString(safeInput.name, 'sourceImportInput.name'),
      'sourceImportInput.name 必须是非空字符串'
    );
    // 类型: string。
    // 作用: 保存非空业务版本，供页面展示、更新比较和授权快照使用。
    const version = wrapValidation(
      () => assertNonEmptyString(safeInput.version, 'sourceImportInput.version'),
      'sourceImportInput.version 必须是非空字符串'
    );
    // 类型: string。
    // 作用: 保存 Runtime 在意图取得执行权后生成的标准导入时间。
    const importedAt = assertIsoTimestamp(safeInput.importedAt, 'sourceImportInput.importedAt');

    // 类型: string。
    // 作用: 保存与导入方式一致的 http/https 地址或空字符串。
    const remoteUrl = normalizeRemoteUrl(safeInput.importMethod, safeInput.remoteUrl);

    // 条件分支: scriptContent 不是字符串时进入。
    // 执行内容: 拒绝对象、数组或缺失值被授权工具静默收敛为空文本。
    if (typeof safeInput.scriptContent !== 'string') {
      throw new SourceManagementValidationError('sourceImportInput.scriptContent 必须是字符串');
    }

    // 类型: string。
    // 作用: 保存统一 LF 换行的脚本文本，导出、指纹和后续解析共用同一内容。
    const scriptContent = normalizeSourceScriptContent(safeInput.scriptContent);

    // 条件分支: 文件或粘贴文本导入在规范化后为空时进入。
    // 执行内容: 拒绝没有实际脚本文本的本地导入；remote 空文本明确表示尚未解析。
    if (safeInput.importMethod !== IMPORT_METHOD.remote && scriptContent.trim() === '') {
      throw new SourceManagementValidationError('文件或粘贴文本导入必须提供非空脚本文本');
    }

    // 类型: string。
    // 作用: 保存由稳定导入材料生成的统一身份，避免计数器、随机数或时间型 id。
    const sourceId = createImportedSourceId({
      importMethod: safeInput.importMethod,
      name,
      version,
      remoteUrl,
      scriptContent
    });
    // 类型: string。
    // 作用: 保存 Package Repository 稳定引用，Definition 使用同一值建立关联。
    const packageRef = `${SOURCE_PACKAGE_REF_PREFIX}${sourceId}`;

    // 类型: object。
    // 作用: 保存不可执行自定义脚本文本、稳定身份和重新计算的完整性声明。
    const sourcePackage = {
      packageRef,
      schemaVersion: SOURCE_PACKAGE_SCHEMA_VERSION,
      sourceId,
      providerKey: UNRESOLVED_CUSTOM_PROVIDER_KEY,
      scriptContent,
      integrity: {
        algorithm: SOURCE_PACKAGE_HASH_ALGORITHM,
        scriptHash: createSourceScriptHash(scriptContent)
      }
    };
    // 类型: object。
    // 作用: 保存页面可展示身份、导入来源、默认能力和未解析 Provider 门禁声明。
    const sourceDefinition = {
      schemaVersion: SOURCE_DEFINITION_SCHEMA_VERSION,
      id: sourceId,
      name,
      description: IMPORTED_SOURCE_DESCRIPTION,
      sourceKind: SOURCE_KIND.custom,
      version,
      providerKey: UNRESOLVED_CUSTOM_PROVIDER_KEY,
      packageRef,
      importMethod: safeInput.importMethod,
      remoteUrl,
      importedAt,
      lastUpdatedAt: importedAt,
      capabilities: createDefaultCapabilities(),
      settingsSchema: []
    };
    // 类型: object。
    // 作用: 保存经过第二次跨对象关系与指纹复核的 Package/Definition 组合。
    const sourcePair = validatePackageDefinitionPair(
      sourcePackage,
      sourceDefinition,
      'sourceImportCommand'
    );
    return { ...sourcePair, settings: {} };
  }

  /**
   * 创建保持身份稳定的完整更新命令。
   * 纯函数: 隔离当前记录和候选，不修改 SourceManagerState 或端口夹具。
   *
   * @param {*} sourceRecord 当前隔离 SourceRecord。
   * @param {*} updateCandidate 受审下一 Package/Definition 候选。
   * @returns {object} 不含 handoff 的 SourceManager.applySourceUpdate 基础命令。
   */
  function createUpdateCommand(sourceRecord, updateCandidate) {
    // 类型: object。
    // 作用: 保存当前 SourceRecord 严格 JSON 副本，候选比较不读取 Manager 内部引用。
    const safeRecord = wrapValidation(
      () => cloneSerializableValue(sourceRecord, 'sourceUpdateRecord'),
      'sourceUpdateRecord 必须是严格 JSON 对象'
    );
    wrapValidation(() => assertPlainObject(safeRecord, 'sourceUpdateRecord'), 'sourceUpdateRecord 必须是普通对象');
    wrapValidation(
      () => assertPlainObject(safeRecord.definition, 'sourceUpdateRecord.definition'),
      'sourceUpdateRecord.definition 必须是普通对象'
    );

    // 类型: object。
    // 作用: 保存受审端口候选严格 JSON 副本，后续验证不会受夹具对象修改影响。
    const safeCandidate = wrapValidation(
      () => cloneSerializableValue(updateCandidate, 'sourceUpdateCandidate'),
      'sourceUpdateCandidate 必须是严格 JSON 对象'
    );
    wrapValidation(
      () => assertPlainObject(safeCandidate, 'sourceUpdateCandidate'),
      'sourceUpdateCandidate 必须是普通对象'
    );
    wrapValidation(
      () => assertExactObjectKeys(
        safeCandidate,
        SOURCE_UPDATE_CANDIDATE_FIELDS,
        'sourceUpdateCandidate'
      ),
      'sourceUpdateCandidate 字段集合无效'
    );

    // 类型: object。
    // 作用: 保存字段完整、关联一致且脚本指纹重新验证的下一包定义组合。
    const sourcePair = validatePackageDefinitionPair(
      safeCandidate.sourcePackage,
      safeCandidate.sourceDefinition,
      'sourceUpdateCandidate'
    );
    // 类型: Array<string>。
    // 作用: 收集候选试图改变的稳定身份字段，任何命中都拒绝把更新变成隐式重新导入。
    const changedIdentityFields = SOURCE_UPDATE_STABLE_DEFINITION_FIELDS.filter((field) => {
      return sourcePair.sourceDefinition[field] !== safeRecord.definition[field];
    });
    // 条件分支: 候选改变任一稳定身份字段时进入。
    // 执行内容: 拒绝 sourceId、来源类型、工厂、包引用、导入方式、URL 或首次导入时间变化。
    if (changedIdentityFields.length > 0) {
      throw new SourceManagementValidationError(
        `sourceUpdateCandidate 不能改变身份字段: ${changedIdentityFields.join(', ')}`
      );
    }

    return {
      sourceId: safeRecord.definition.id,
      ...sourcePair
    };
  }

  // 类型: object。
  // 作用: 汇总两个纯适配方法，不暴露内部常量、校验函数或可变状态。
  const adapter = { createImportCommand, createUpdateCommand };

  // 条件分支: 公开键数量、顺序或名称与冻结契约不一致时进入。
  // 执行内容: 在返回门面前阻止遗漏方法或内部能力泄漏。
  if (Object.keys(adapter).length !== SOURCE_MANAGEMENT_INPUT_ADAPTER_PUBLIC_METHODS.length
    || Object.keys(adapter).some(
      (methodName, index) => methodName !== SOURCE_MANAGEMENT_INPUT_ADAPTER_PUBLIC_METHODS[index]
    )) {
    throw new SourceManagementValidationError('SourceManagementInputAdapter 公开方法顺序无效');
  }

  return Object.freeze(adapter);
}
