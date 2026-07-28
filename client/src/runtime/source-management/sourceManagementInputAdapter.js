/*
  sourceManagementInputAdapter.js 模块说明

  - 文件职责:
      把已通过单文件加载器校验的 SourcePackagePayload、sourceManifest 和用户决定映射为 SourceManager 导入命令。
      把 SourceUpdatePort 返回的受审候选转换为保持稳定身份字段的完整更新命令。
      本模块只做严格校验、字段映射和跨对象完整性复核，不读网络、不执行脚本、不注册工厂或写 Repository。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      IMPORT_METHOD、SOURCE_KIND: 自定义配置，限定用户导入方式并固定自定义来源。
      cloneSerializableValue: 自定义工具，隔离载荷、manifest、记录和更新候选。
      Repository validators: 自定义校验，复用精确字段、保存对象和普通对象规则。
      createSourceScriptHash: 自定义工具，从真实脚本文本重新计算 SHA-256。
      SOURCE_MANIFEST_FIELDS、SOURCE_PACKAGE_POLICY: 自定义单文件配置，约束 manifest 字段、版本和完整性算法。
      SourceManagementValidationError: 自定义错误，把映射失败统一到设置管理边界。

  - 模块级常量:
      SOURCE_IMPORT_ARTIFACT_FIELDS: Array<string>，导入映射输入精确字段。
      SOURCE_PACKAGE_PAYLOAD_FIELDS: Array<string>，共同载荷精确字段。
      SOURCE_PACKAGE_INTEGRITY_FIELDS: Array<string>，载荷完整性精确字段。
      SOURCE_UPDATE_CANDIDATE_FIELDS: Array<string>，更新候选精确字段。
      SOURCE_UPDATE_STABLE_DEFINITION_FIELDS: Array<string>，更新不可改变的 Definition 身份字段。
      SOURCE_PACKAGE_REF_PREFIX: string，稳定 Package 引用前缀。
      SOURCE_MANAGEMENT_INPUT_ADAPTER_PUBLIC_METHODS: Array<string>，适配器公开方法集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      wrapValidation(action, message): 把底层校验转换为管理校验错误。
      assertIsoTimestamp(value, fieldName): 校验标准 UTC ISO 时间。
      validatePackageDefinitionPair(sourcePackage, sourceDefinition, fieldName): 复核保存对象、身份和 SHA-256。
      normalizeImportArtifacts(input): 校验并隔离载荷、manifest 和用户决定。
      createSourceManagementInputAdapter(): 创建导入与更新命令适配门面。

  - 模块级类:
      无

  - 对外导出:
      createSourceManagementInputAdapter(): Function，创建单文件导入和更新命令适配器。
*/

import {
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 数据源导入方式枚举。
  // 文件作用: 动态单文件只接受 file、remote 或 text，不接受 builtin。
  IMPORT_METHOD,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源来源类型枚举。
  // 文件作用: 用户信任后导入仍固定创建 custom Definition。
  SOURCE_KIND
} from '../../config/source-manager.config.js';

// 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON 隔离工具。
// 文件作用: 映射和更新比较不保留加载器、页面或端口对象引用。
import { cloneSerializableValue } from '../../repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertExactObjectKeys 精确字段校验函数。
  // 文件作用: 拒绝载荷、manifest、完整性和更新候选未知字段。
  assertExactObjectKeys,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertNonEmptyString 非空字符串校验函数。
  // 文件作用: 校验导入时间和必要身份字段。
  assertNonEmptyString,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 普通对象校验函数。
  // 文件作用: 在字段读取前拒绝数组、类实例和异常原型。
  assertPlainObject,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourceDefinition Definition 完整校验函数。
  // 文件作用: 校验 manifest 映射和更新候选的正式保存结构。
  validateSourceDefinition,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourcePackage Package 完整校验函数。
  // 文件作用: 校验脚本文本、完整性和包身份字段。
  validateSourcePackage
} from '../../repositories/source/sourceRepositoryValidators.js';

// 导入来源: ../../utils/sourceAuthorization.js。
// 导入内容: createSourceScriptHash 统一 SHA-256 计算函数。
// 文件作用: 不信任载荷声明，映射前从规范化脚本文本重新计算摘要。
import { createSourceScriptHash } from '../../utils/sourceAuthorization.js';

import {
  // 导入来源: ../source-package/sourcePackage.config.js。
  // 导入内容: SOURCE_MANIFEST_FIELDS manifest 精确字段集合。
  // 文件作用: 映射器只接受加载器冻结的完整 manifest。
  SOURCE_MANIFEST_FIELDS,

  // 导入来源: ../source-package/sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_POLICY 单文件版本和 SHA-256 策略。
  // 文件作用: Package/Definition 保存版本和完整性算法与预检器一致。
  SOURCE_PACKAGE_POLICY
} from '../source-package/sourcePackage.config.js';

// 导入来源: ./sourceManagementErrors.js。
// 导入内容: SourceManagementValidationError 设置管理校验错误。
// 文件作用: Repository、时间、映射和跨对象失败统一返回管理 validation。
import { SourceManagementValidationError } from './sourceManagementErrors.js';

// 类型: Array<string>。
// 作用: Runtime 只把加载结果和用户决定交给适配器，不允许页面字段或工厂引用进入 Manager 命令。
const SOURCE_IMPORT_ARTIFACT_FIELDS = Object.freeze([
  'payload',
  'manifest',
  'authorizedAt',
  'enableAfterImport'
]);

// 类型: Array<string>。
// 作用: SourcePackagePayload 必须保持公共协议六字段，不接受预览或执行状态。
const SOURCE_PACKAGE_PAYLOAD_FIELDS = Object.freeze([
  'importMethod',
  'scriptContent',
  'remoteUrl',
  'originalFileName',
  'importedAt',
  'integrity'
]);

// 类型: Array<string>。
// 作用: 动态单文件完整性只包含算法与摘要，不接受签名或旧哈希别名。
const SOURCE_PACKAGE_INTEGRITY_FIELDS = Object.freeze([
  'algorithm',
  'scriptHash'
]);

// 类型: Array<string>。
// 作用: 更新端口只能返回下一 Package 和 Definition，不携带脚本执行或页面状态。
const SOURCE_UPDATE_CANDIDATE_FIELDS = Object.freeze([
  'sourcePackage',
  'sourceDefinition'
]);

// 类型: Array<string>。
// 作用: 更新必须保持 sourceId、来源、工厂、包引用、导入方式、远程地址和首次导入时间不变。
const SOURCE_UPDATE_STABLE_DEFINITION_FIELDS = Object.freeze([
  'id',
  'sourceKind',
  'providerKey',
  'packageRef',
  'importMethod',
  'remoteUrl',
  'importedAt'
]);

// 类型: string。
// 作用: 根据 manifest.id 生成 Repository 稳定引用，文件名和导入时间不参与身份。
const SOURCE_PACKAGE_REF_PREFIX = 'source-package::';

// 类型: Array<string>。
// 作用: 适配器只公开导入和更新命令构造，不泄漏校验或映射辅助函数。
const SOURCE_MANAGEMENT_INPUT_ADAPTER_PUBLIC_METHODS = Object.freeze([
  'createImportCommand',
  'createUpdateCommand'
]);

/**
 * 执行底层严格校验并转换为设置管理错误。
 * 纯函数: 除调用 action 外不修改输入或状态。
 * 失败路径: 保留底层 cause 供内部诊断，但页面只接收管理错误说明。
 *
 * @param {Function} action 严格校验回调。
 * @param {string} message 当前映射边界说明。
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
 * 校验可逆标准 UTC ISO 时间。
 * 纯函数: 不读取系统时间或修改输入。
 *
 * @param {*} value 时间候选。
 * @param {string} fieldName 字段路径。
 * @returns {string} 原标准时间文本。
 */
function assertIsoTimestamp(value, fieldName) {
  // 类型: string。
  // 作用: 保存已通过非空校验的时间文本，后续执行可逆 UTC 检查。
  const timestamp = wrapValidation(
    () => assertNonEmptyString(value, fieldName),
    `${fieldName} 必须是非空字符串`
  );

  // 类型: number。
  // 作用: 解析时间候选；NaN 表示无法作为标准导入或授权时间。
  const timestampValue = Date.parse(timestamp);

  // 条件分支: 时间无效或标准 UTC 序列化后与原值不同则进入。
  // 执行内容: 拒绝本地时区、缩写和模糊精度文本。
  if (!Number.isFinite(timestampValue) || new Date(timestampValue).toISOString() !== timestamp) {
    throw new SourceManagementValidationError(`${fieldName} 必须是标准 UTC ISO 时间`);
  }

  return timestamp;
}

/**
 * 校验 Package、Definition 及跨对象 SHA-256 关系。
 * 纯函数: 返回严格 JSON 隔离对象，不修改输入。
 * 失败路径: 保存结构、sourceId/providerKey/packageRef 或 SHA-256 不一致时抛管理 validation。
 *
 * @param {*} sourcePackageInput SourcePackage 候选。
 * @param {*} sourceDefinitionInput SourceDefinition 候选。
 * @param {string} fieldName 错误字段前缀。
 * @returns {object} 隔离 sourcePackage 和 sourceDefinition。
 */
function validatePackageDefinitionPair(sourcePackageInput, sourceDefinitionInput, fieldName) {
  // 类型: object。
  // 作用: 保存严格 JSON 隔离且通过正式 Package 校验的脚本包。
  const sourcePackage = wrapValidation(
    () => validateSourcePackage(cloneSerializableValue(
      sourcePackageInput,
      `${fieldName}.sourcePackage`
    )),
    `${fieldName}.sourcePackage 无效`
  );
  // 类型: object。
  // 作用: 保存严格 JSON 隔离且通过正式 Definition 校验的数据源定义。
  const sourceDefinition = wrapValidation(
    () => validateSourceDefinition(cloneSerializableValue(
      sourceDefinitionInput,
      `${fieldName}.sourceDefinition`
    )),
    `${fieldName}.sourceDefinition 无效`
  );

  // 条件分支: Package 与 Definition 的三个身份关联任一不一致时进入。
  // 执行内容: 拒绝跨源包、工厂别名和断裂 Repository 引用。
  if (sourcePackage.sourceId !== sourceDefinition.id
    || sourcePackage.providerKey !== sourceDefinition.providerKey
    || sourcePackage.packageRef !== sourceDefinition.packageRef) {
    throw new SourceManagementValidationError(`${fieldName} 的 Package 与 Definition 身份关联不一致`);
  }

  // 类型: string。
  // 作用: 从真实规范化脚本文本重新计算摘要，不信任载荷或更新端口声明。
  const calculatedScriptHash = createSourceScriptHash(sourcePackage.scriptContent);

  // 条件分支: 算法不是 SHA-256 或声明摘要与重算值不一致时进入。
  // 执行内容: 拒绝损坏、旧 FNV 或被替换脚本进入 Manager。
  if (sourcePackage.integrity.algorithm !== SOURCE_PACKAGE_POLICY.integrityAlgorithm
    || sourcePackage.integrity.scriptHash !== calculatedScriptHash) {
    throw new SourceManagementValidationError(`${fieldName}.sourcePackage 脚本完整性声明无效`);
  }

  return { sourcePackage, sourceDefinition };
}

/**
 * 校验并隔离加载器交给适配器的导入制品。
 * 纯函数: 返回新对象，不修改冻结载荷、manifest 或用户决定。
 * 失败路径: 字段、来源、SHA-256、时间或 Boolean 决定不符合契约时抛管理 validation。
 *
 * @param {*} input 加载器导入制品候选。
 * @returns {object} payload、manifest、authorizedAt 和 enableAfterImport。
 */
function normalizeImportArtifacts(input) {
  // 类型: object。
  // 作用: 保存严格 JSON 隔离输入，适配过程不持有加载器对象引用。
  const safeInput = wrapValidation(
    () => cloneSerializableValue(input, 'sourceImportArtifacts'),
    'sourceImportArtifacts 必须是严格 JSON 对象'
  );
  wrapValidation(() => assertPlainObject(safeInput, 'sourceImportArtifacts'), 'sourceImportArtifacts 必须是普通对象');
  wrapValidation(
    () => assertExactObjectKeys(safeInput, SOURCE_IMPORT_ARTIFACT_FIELDS, 'sourceImportArtifacts'),
    'sourceImportArtifacts 字段集合无效'
  );

  wrapValidation(() => assertPlainObject(safeInput.payload, 'sourceImportArtifacts.payload'), 'payload 必须是普通对象');
  wrapValidation(
    () => assertExactObjectKeys(
      safeInput.payload,
      SOURCE_PACKAGE_PAYLOAD_FIELDS,
      'sourceImportArtifacts.payload'
    ),
    'payload 字段集合无效'
  );
  wrapValidation(() => assertPlainObject(safeInput.payload.integrity, 'payload.integrity'), 'integrity 必须是普通对象');
  wrapValidation(
    () => assertExactObjectKeys(
      safeInput.payload.integrity,
      SOURCE_PACKAGE_INTEGRITY_FIELDS,
      'payload.integrity'
    ),
    'integrity 字段集合无效'
  );

  wrapValidation(() => assertPlainObject(safeInput.manifest, 'sourceImportArtifacts.manifest'), 'manifest 必须是普通对象');
  wrapValidation(
    () => assertExactObjectKeys(safeInput.manifest, SOURCE_MANIFEST_FIELDS, 'sourceImportArtifacts.manifest'),
    'manifest 字段集合无效'
  );

  // 条件分支: 导入方式不是三个用户入口时进入。
  // 执行内容: 拒绝 builtin 和未知来源绕过读取器。
  if (![IMPORT_METHOD.file, IMPORT_METHOD.remote, IMPORT_METHOD.text].includes(
    safeInput.payload.importMethod
  )) {
    throw new SourceManagementValidationError('payload.importMethod 只允许 file、remote 或 text');
  }

  // 条件分支: 脚本文本为空、摘要算法或重算 SHA-256 不匹配时进入。
  // 执行内容: 在构造保存对象前拒绝损坏载荷。
  if (typeof safeInput.payload.scriptContent !== 'string'
    || safeInput.payload.scriptContent.trim() === ''
    || safeInput.payload.integrity.algorithm !== SOURCE_PACKAGE_POLICY.integrityAlgorithm
    || safeInput.payload.integrity.scriptHash !== createSourceScriptHash(
      safeInput.payload.scriptContent
    )) {
    throw new SourceManagementValidationError('payload 脚本文本或 SHA-256 完整性无效');
  }

  // 条件分支: 是否启用不是严格 Boolean 时进入。
  // 执行内容: 不用 truthy 值代替用户确认。
  if (typeof safeInput.enableAfterImport !== 'boolean') {
    throw new SourceManagementValidationError('enableAfterImport 必须是 boolean');
  }

  assertIsoTimestamp(safeInput.payload.importedAt, 'payload.importedAt');
  assertIsoTimestamp(safeInput.authorizedAt, 'sourceImportArtifacts.authorizedAt');
  return safeInput;
}

/**
 * 创建设置管理输入适配器。
 * 副作用: 只创建冻结双方法门面，不读取时间、网络、Repository、注册表或 Host。
 *
 * @returns {object} createImportCommand 和 createUpdateCommand 冻结门面。
 */
export function createSourceManagementInputAdapter() {
  /**
   * 从已验证单文件制品创建完整 SourceManager 导入命令。
   * 纯函数: manifest 是名称、版本、能力和 Provider 身份唯一来源；originalFileName 不持久化。
   * 成功路径: 返回 Package、Definition、空 settings、授权时间和启用决定。
   * 失败路径: 映射、保存结构、身份或 SHA-256 失败抛管理 validation。
   *
   * @param {*} input 单文件加载结果与用户决定。
   * @returns {object} SourceManager.importSource 标准命令。
   */
  function createImportCommand(input) {
    // 类型: object。
    // 作用: 保存字段完整且隔离的 payload、manifest 和用户决定。
    const artifacts = normalizeImportArtifacts(input);
    // 类型: string。
    // 作用: 根据 manifest.id 创建稳定 Package 引用，与入口方式、文件名和时间无关。
    const packageRef = `${SOURCE_PACKAGE_REF_PREFIX}${artifacts.manifest.id}`;

    // 类型: object。
    // 作用: 保存规范化脚本文本、唯一身份和读取器重新计算的 SHA-256。
    const sourcePackage = {
      packageRef,
      schemaVersion: SOURCE_PACKAGE_POLICY.schemaVersion,
      sourceId: artifacts.manifest.id,
      providerKey: artifacts.manifest.providerKey,
      scriptContent: artifacts.payload.scriptContent,
      integrity: cloneSerializableValue(artifacts.payload.integrity, 'sourcePackage.integrity')
    };

    // 类型: object。
    // 作用: 只从静态验证 manifest 和来源元信息映射可序列化 Definition。
    const sourceDefinition = {
      schemaVersion: SOURCE_PACKAGE_POLICY.schemaVersion,
      id: artifacts.manifest.id,
      name: artifacts.manifest.name,
      description: artifacts.manifest.description,
      sourceKind: SOURCE_KIND.custom,
      version: artifacts.manifest.version,
      providerKey: artifacts.manifest.providerKey,
      packageRef,
      importMethod: artifacts.payload.importMethod,
      remoteUrl: artifacts.payload.remoteUrl,
      importedAt: artifacts.payload.importedAt,
      lastUpdatedAt: artifacts.payload.importedAt,
      capabilities: cloneSerializableValue(
        artifacts.manifest.capabilities,
        'sourceDefinition.capabilities'
      ),
      settingsSchema: cloneSerializableValue(
        artifacts.manifest.settingsSchema,
        'sourceDefinition.settingsSchema'
      )
    };

    // 类型: object。
    // 作用: 保存经过正式结构、跨对象身份和 SHA-256 二次复核的 Package/Definition。
    const sourcePair = validatePackageDefinitionPair(
      sourcePackage,
      sourceDefinition,
      'sourceImportCommand'
    );

    return {
      ...sourcePair,
      settings: {},
      authorizedAt: artifacts.authorizedAt,
      enableAfterImport: artifacts.enableAfterImport
    };
  }

  /**
   * 创建保持身份稳定的完整更新命令。
   * 纯函数: 隔离当前记录和候选，不修改 SourceManagerState 或更新端口结果。
   *
   * @param {*} sourceRecord 当前隔离 SourceRecord。
   * @param {*} updateCandidate 受审下一 Package/Definition 候选。
   * @returns {object} 不含 handoff 的 SourceManager.applySourceUpdate 基础命令。
   */
  function createUpdateCommand(sourceRecord, updateCandidate) {
    // 类型: object。
    // 作用: 保存当前记录严格 JSON 副本，身份比较不读取 Manager 内部引用。
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
    // 作用: 保存受审更新候选严格 JSON 副本并执行精确字段校验。
    const safeCandidate = wrapValidation(
      () => cloneSerializableValue(updateCandidate, 'sourceUpdateCandidate'),
      'sourceUpdateCandidate 必须是严格 JSON 对象'
    );
    wrapValidation(() => assertPlainObject(safeCandidate, 'sourceUpdateCandidate'), 'sourceUpdateCandidate 必须是普通对象');
    wrapValidation(
      () => assertExactObjectKeys(
        safeCandidate,
        SOURCE_UPDATE_CANDIDATE_FIELDS,
        'sourceUpdateCandidate'
      ),
      'sourceUpdateCandidate 字段集合无效'
    );

    // 类型: object。
    // 作用: 保存字段完整、关联一致且 SHA-256 重新验证的下一包定义组合。
    const sourcePair = validatePackageDefinitionPair(
      safeCandidate.sourcePackage,
      safeCandidate.sourceDefinition,
      'sourceUpdateCandidate'
    );
    // 类型: Array<string>。
    // 作用: 收集更新试图改变的稳定身份字段，任何命中都会拒绝。
    const changedIdentityFields = SOURCE_UPDATE_STABLE_DEFINITION_FIELDS.filter(
      field => sourcePair.sourceDefinition[field] !== safeRecord.definition[field]
    );

    // 条件分支: 候选改变任一稳定身份字段时进入。
    // 执行内容: 拒绝把更新变成隐式删除与重新导入。
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
  // 作用: 汇总两个纯适配方法，不暴露内部常量、校验函数或状态。
  const adapter = Object.freeze({ createImportCommand, createUpdateCommand });

  // 条件分支: 公开键数量或顺序与冻结契约不一致时进入。
  // 执行内容: 构造阶段失败，阻止遗漏方法或内部能力泄漏。
  if (Object.keys(adapter).length !== SOURCE_MANAGEMENT_INPUT_ADAPTER_PUBLIC_METHODS.length
    || Object.keys(adapter).some(
      (methodName, index) => methodName !== SOURCE_MANAGEMENT_INPUT_ADAPTER_PUBLIC_METHODS[index]
    )) {
    throw new SourceManagementValidationError('SourceManagementInputAdapter 公开方法无效');
  }

  return adapter;
}
