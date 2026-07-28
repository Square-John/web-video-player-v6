/*
  sourcePackageLoader.js 模块说明

  - 文件职责:
      协调共同读取器、信任前静态预检器和用户信任后模块执行器，形成唯一单文件加载边界。
      preview 只返回不含脚本文本的 SourceImportPreview；load 重新读取并核对用户确认哈希后才执行。
      restore 从 Repository 已验证 Package 恢复工厂，不重新请求原始文件或远程地址。
      精确校验模块命名空间、运行时 manifest、ProviderFactory 和 supports，不注册工厂或写 Repository。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      cloneSerializableValue: 自定义工具，隔离用户决定、Definition 和 manifest 比较输入。
      createSourceScriptHash: 自定义授权工具，复算已保存脚本文本 SHA-256。
      assertExactObjectKeys、assertPlainObject、validateSourceDefinition、validateSourcePackage: 自定义校验，拒绝加载决定、依赖端口和保存对象偏离契约。
      SOURCE_KIND: 自定义配置，限制恢复入口只接受自定义数据源。
      sourcePackage 配置: 自定义边界，提供导出集合、错误码和阶段。
      SourcePackageLoadError、createSourcePackageLoadError: 自定义错误，统一信任、执行和工厂失败。

  - 模块级常量:
      SOURCE_PACKAGE_LOADER_DEPENDENCY_FIELDS: Array<string>，加载器精确依赖字段。
      SOURCE_PACKAGE_LOADER_PUBLIC_METHODS: Array<string>，加载器公开方法集合。
      SOURCE_PACKAGE_TRUST_DECISION_FIELDS: Array<string>，用户信任决定精确字段。
      PROVIDER_FACTORY_FIELDS: Array<string>，ProviderFactory 精确字段集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertSingleMethodPort(port, methodName, fieldName): 校验冻结单方法依赖端口。
      normalizeDependencies(dependencies): 校验读取、预检和执行依赖。
      normalizeTrustDecision(decision): 校验用户确认哈希与是否启用决定。
      createProviderFactoryFacade(providerFactory, manifest): 校验并冻结工厂门面。
      assertRuntimeManifestMatches(staticManifest, runtimeManifest): 校验执行前后 manifest 一致。
      executeInspectedPackage(payload, inspection): 执行已预检脚本并返回冻结工厂。
      assertPersistedManifestMatchesDefinition(manifest, definition): 复核保存 Definition 与脚本 manifest。
      createSourcePackageLoader(dependencies): 创建 preview/load/restore/assertFactorySupports 门面。

  - 模块级类:
      无

  - 对外导出:
      createSourcePackageLoader(dependencies): Function，创建单文件预检、导入、恢复和工厂支持校验门面。
*/

// 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON 隔离工具。
// 文件作用: 用户决定、Definition 和 manifest 比较不保留调用方可变引用。
import { cloneSerializableValue } from '../../repositories/source/sourceRepositoryUtils.js';

// 导入来源: ../../utils/sourceAuthorization.js；导入内容: createSourceScriptHash；文件作用: 恢复前复算已保存脚本文本 SHA-256。
import { createSourceScriptHash } from '../../utils/sourceAuthorization.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertExactObjectKeys 精确字段校验函数。
  // 文件作用: 用户决定和依赖容器拒绝未知兼容字段。
  assertExactObjectKeys,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 普通对象校验函数。
  // 文件作用: 在字段读取前拒绝数组、类实例和异常原型。
  assertPlainObject,
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js；导入内容: validateSourceDefinition；文件作用: 恢复前校验完整 Definition。
  validateSourceDefinition,
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js；导入内容: validateSourcePackage；文件作用: 恢复前校验完整 Package。
  validateSourcePackage
} from '../../repositories/source/sourceRepositoryValidators.js';

// 导入来源: ../../config/source-manager.config.js；导入内容: SOURCE_KIND；文件作用: 恢复入口只执行自定义脚本包。
import { SOURCE_KIND } from '../../config/source-manager.config.js';

import {
  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_ERROR_CODE 稳定错误码。
  // 文件作用: 区分信任、模块、加载和工厂失败。
  SOURCE_PACKAGE_ERROR_CODE,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_LOAD_STAGE 加载阶段。
  // 文件作用: 错误明确落在 trust、execute 或 factory。
  SOURCE_PACKAGE_LOAD_STAGE,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_MODULE_EXPORTS 精确模块导出集合。
  // 文件作用: 执行后命名空间不得增加第三个导出。
  SOURCE_PACKAGE_MODULE_EXPORTS,
  // 导入来源: ./sourcePackage.config.js；导入内容: SOURCE_PACKAGE_POLICY；文件作用: 复核已保存完整性算法。
  SOURCE_PACKAGE_POLICY
} from './sourcePackage.config.js';

import {
  // 导入来源: ./sourcePackageErrors.js。
  // 导入内容: SourcePackageLoadError 稳定错误类。
  // 文件作用: 已分类加载失败保持原 code/stage，不重复包装。
  SourcePackageLoadError,

  // 导入来源: ./sourcePackageErrors.js。
  // 导入内容: createSourcePackageLoadError 安全错误工厂。
  // 文件作用: 未知模块或工厂异常转换为不泄漏内部信息的稳定错误。
  createSourcePackageLoadError
} from './sourcePackageErrors.js';

// 类型: Array<string>。
// 作用: 加载器只依赖读取、静态预检和模块执行三个窄端口，不接收注册表或 Manager。
const SOURCE_PACKAGE_LOADER_DEPENDENCY_FIELDS = Object.freeze([
  'inputReader',
  'manifestParser',
  'moduleExecutor'
]);

// 类型: Array<string>。
// 作用: 公开预览、加载和 Definition 支持复核，不泄漏依赖或内部校验函数。
const SOURCE_PACKAGE_LOADER_PUBLIC_METHODS = Object.freeze([
  'preview',
  'load',
  'restore',
  'assertFactorySupports'
]);

// 类型: Array<string>；作用: manifest 中必须与保存 Definition 完全一致的页面和工厂字段。
const PERSISTED_MANIFEST_DEFINITION_FIELDS = Object.freeze([
  'id',
  'name',
  'description',
  'version',
  'providerKey',
  'capabilities',
  'settingsSchema'
]);

// 类型: Array<string>。
// 作用: 用户决定只包含已确认 SHA-256 和是否启用，不接受“已安全”或页面状态字段。
const SOURCE_PACKAGE_TRUST_DECISION_FIELDS = Object.freeze([
  'trustedScriptHash',
  'enableAfterImport'
]);

// 类型: Array<string>。
// 作用: 动态工厂只允许身份、纯支持判断和实例创建三个公开成员。
const PROVIDER_FACTORY_FIELDS = Object.freeze([
  'providerKey',
  'supports',
  'create'
]);

/**
 * 校验冻结单方法依赖端口。
 * 纯函数: 不调用或修改端口。
 * 失败路径: 非冻结普通对象、额外字段或方法缺失时抛 TypeError。
 *
 * @param {*} port 依赖端口候选。
 * @param {string} methodName 唯一公开方法名。
 * @param {string} fieldName 依赖字段路径。
 * @returns {object} 原已验证端口。
 */
function assertSingleMethodPort(port, methodName, fieldName) {
  // 条件分支: 端口不是冻结单方法对象时进入。
  // 执行内容: 拒绝半实现依赖和基础设施引用泄漏。
  if (!port
    || typeof port !== 'object'
    || !Object.isFrozen(port)
    || Reflect.ownKeys(port).length !== 1
    || typeof port[methodName] !== 'function') {
    throw new TypeError(`${fieldName} 必须是冻结单方法端口`);
  }

  return port;
}

/**
 * 校验加载器三个窄依赖。
 * 纯函数: 返回冻结浅层引用，不执行读取、解析或模块加载。
 *
 * @param {*} dependencies 加载器依赖候选。
 * @returns {object} 字段完整的冻结依赖。
 */
function normalizeDependencies(dependencies) {
  try {
    assertPlainObject(dependencies, 'sourcePackageLoader.dependencies');
    assertExactObjectKeys(
      dependencies,
      SOURCE_PACKAGE_LOADER_DEPENDENCY_FIELDS,
      'sourcePackageLoader.dependencies'
    );
  } catch (error) {
    throw new TypeError('sourcePackageLoader.dependencies 字段无效');
  }

  return Object.freeze({
    inputReader: assertSingleMethodPort(
      dependencies.inputReader,
      'read',
      'sourcePackageLoader.inputReader'
    ),
    manifestParser: assertSingleMethodPort(
      dependencies.manifestParser,
      'inspect',
      'sourcePackageLoader.manifestParser'
    ),
    moduleExecutor: assertSingleMethodPort(
      dependencies.moduleExecutor,
      'execute',
      'sourcePackageLoader.moduleExecutor'
    )
  });
}

/**
 * 校验用户信任和启用决定。
 * 纯函数: 返回严格 JSON 隔离对象，不修改页面输入。
 * 失败路径: 未确认哈希、非 64 位小写 SHA-256 或非 Boolean 启用决定抛 trust 错误。
 *
 * @param {*} decision 用户决定候选。
 * @returns {object} trustedScriptHash 与 enableAfterImport 精确对象。
 */
function normalizeTrustDecision(decision) {
  // 类型: object|undefined。
  // 作用: 保存严格 JSON 隔离决定，后续不读取页面响应式对象。
  let safeDecision;
  try {
    safeDecision = cloneSerializableValue(decision, 'sourcePackageTrustDecision');
    assertPlainObject(safeDecision, 'sourcePackageTrustDecision');
    assertExactObjectKeys(
      safeDecision,
      SOURCE_PACKAGE_TRUST_DECISION_FIELDS,
      'sourcePackageTrustDecision'
    );
  } catch (error) {
    throw new SourcePackageLoadError({
      code: SOURCE_PACKAGE_ERROR_CODE.trustRequired,
      stage: SOURCE_PACKAGE_LOAD_STAGE.trust,
      message: '请先确认当前数据源脚本的运行风险。',
      field: 'trustDecision'
    });
  }

  // 条件分支: 确认哈希不是 64 位小写 SHA-256 时进入。
  // 执行内容: 拒绝空确认、旧 FNV 和任意文本信任标记。
  if (typeof safeDecision.trustedScriptHash !== 'string'
    || !/^[a-f0-9]{64}$/.test(safeDecision.trustedScriptHash)) {
    throw new SourcePackageLoadError({
      code: SOURCE_PACKAGE_ERROR_CODE.trustRequired,
      stage: SOURCE_PACKAGE_LOAD_STAGE.trust,
      message: '脚本确认指纹无效，请重新预检。',
      field: 'trustDecision.trustedScriptHash'
    });
  }

  // 条件分支: 是否启用不是严格 Boolean 时进入。
  // 执行内容: 不使用 truthy 值代替用户明确决定。
  if (typeof safeDecision.enableAfterImport !== 'boolean') {
    throw new SourcePackageLoadError({
      code: SOURCE_PACKAGE_ERROR_CODE.trustRequired,
      stage: SOURCE_PACKAGE_LOAD_STAGE.trust,
      message: '请选择导入后是否启用数据源。',
      field: 'trustDecision.enableAfterImport'
    });
  }

  return safeDecision;
}

/**
 * 校验并捕获用户信任后模块返回的 ProviderFactory。
 * 副作用: 调用 createProviderFactory 一次执行受信任脚本工厂创建逻辑；返回门面绑定两个方法并冻结。
 * 失败路径: 工厂创建抛错、字段、身份或方法不符合 ABI 时抛 factory 错误。
 *
 * @param {*} createProviderFactory 模块命名空间工厂创建函数。
 * @param {object} manifest 已静态验证且与运行时一致的 manifest。
 * @returns {object} providerKey、supports 和 create 冻结门面。
 */
function createProviderFactoryFacade(createProviderFactory, manifest) {
  // 类型: object|undefined。
  // 作用: 保存用户工厂创建函数返回值；只在当前调用栈中存在。
  let providerFactory;
  try {
    providerFactory = createProviderFactory();
  } catch (error) {
    throw createSourcePackageLoadError({
      error,
      code: SOURCE_PACKAGE_ERROR_CODE.factoryInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.factory,
      message: '数据源工厂创建失败。',
      field: 'createProviderFactory'
    });
  }

  // 条件分支: 工厂不是普通对象或自有字段不精确时进入。
  // 执行内容: 拒绝脚本文本、Context、Repository 或额外执行能力进入注册表。
  if (!providerFactory
    || typeof providerFactory !== 'object'
    || Array.isArray(providerFactory)
    || Object.getPrototypeOf(providerFactory) !== Object.prototype
    || Reflect.ownKeys(providerFactory).length !== PROVIDER_FACTORY_FIELDS.length
    || Reflect.ownKeys(providerFactory).some(
      field => typeof field !== 'string' || !PROVIDER_FACTORY_FIELDS.includes(field)
    )) {
    throw new SourcePackageLoadError({
      code: SOURCE_PACKAGE_ERROR_CODE.factoryInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.factory,
      message: 'ProviderFactory 字段必须完整且不能包含额外能力。',
      field: 'ProviderFactory'
    });
  }

  // 条件分支: 工厂键不等于 manifest 或 supports/create 不是函数时进入。
  // 执行内容: 在注册前拒绝身份别名和半实现工厂。
  if (providerFactory.providerKey !== manifest.providerKey
    || typeof providerFactory.supports !== 'function'
    || typeof providerFactory.create !== 'function') {
    throw new SourcePackageLoadError({
      code: SOURCE_PACKAGE_ERROR_CODE.factoryInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.factory,
      message: 'ProviderFactory 身份或方法不符合 ABI。',
      field: 'ProviderFactory'
    });
  }

  return Object.freeze({
    providerKey: providerFactory.providerKey,
    supports: providerFactory.supports.bind(providerFactory),
    create: providerFactory.create.bind(providerFactory)
  });
}

/**
 * 校验模块执行后的 manifest 与信任前静态 manifest 逐字段一致。
 * 纯函数: 只比较严格 JSON 隔离文本，不修改任一 manifest。
 * 失败路径: 运行时值不可序列化、根未冻结或执行期间发生变化时抛 module 错误。
 *
 * @param {object} staticManifest 信任前静态 manifest。
 * @param {*} runtimeManifest 模块命名空间运行时 manifest。
 * @returns {void} 完全一致时结束。
 */
function assertRuntimeManifestMatches(staticManifest, runtimeManifest) {
  // 条件分支: 运行时 manifest 不是冻结普通对象时进入。
  // 执行内容: 拒绝模块执行后替换声明或返回可变根对象。
  if (!runtimeManifest
    || typeof runtimeManifest !== 'object'
    || Array.isArray(runtimeManifest)
    || Object.getPrototypeOf(runtimeManifest) !== Object.prototype
    || !Object.isFrozen(runtimeManifest)) {
    throw new SourcePackageLoadError({
      code: SOURCE_PACKAGE_ERROR_CODE.moduleInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.factory,
      message: '运行时 sourceManifest 不是冻结普通对象。',
      field: 'sourceManifest'
    });
  }

  // 类型: object|undefined。
  // 作用: 保存严格 JSON 隔离运行时 manifest，拒绝函数、Symbol、循环或有损值。
  let safeRuntimeManifest;
  try {
    safeRuntimeManifest = cloneSerializableValue(runtimeManifest, 'runtimeSourceManifest');
  } catch (error) {
    throw new SourcePackageLoadError({
      code: SOURCE_PACKAGE_ERROR_CODE.moduleInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.factory,
      message: '运行时 sourceManifest 不是严格 JSON 对象。',
      field: 'sourceManifest'
    });
  }

  // 条件分支: 执行后 manifest 与用户确认的静态值不同则进入。
  // 执行内容: 拒绝模块顶层代码修改身份、能力或 host 后继续注册。
  if (JSON.stringify(safeRuntimeManifest) !== JSON.stringify(staticManifest)) {
    throw new SourcePackageLoadError({
      code: SOURCE_PACKAGE_ERROR_CODE.moduleInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.factory,
      message: '运行时 sourceManifest 与信任前预检结果不一致。',
      field: 'sourceManifest'
    });
  }
}

/**
 * 执行已经完成静态预检的规范化脚本并创建冻结 ProviderFactory。
 * 副作用: 在当前前端上下文执行 payload.scriptContent 一次；模块执行器负责释放 Blob URL。
 * 成功路径: 运行时导出、manifest 和工厂 ABI 全部复核后返回冻结工厂。
 * 失败路径: 执行、导出、manifest 或工厂异常使用稳定 SourcePackageLoadError。
 *
 * @param {object} payload 已验证 SourcePackagePayload。
 * @param {object} inspection manifestParser 返回的静态预检结果。
 * @param {object} moduleExecutor 只含 execute 的冻结模块执行端口。
 * @returns {Promise<object>} 冻结 ProviderFactory 门面。
 */
async function executeInspectedPackage(payload, inspection, moduleExecutor) {
  // 类型: object；作用: 保存同一规范化脚本文本执行后的模块命名空间。
  const moduleNamespace = await moduleExecutor.execute(payload.scriptContent);

  // 条件分支: 模块命名空间公开字符串键不等于两个冻结导出时进入。
  // 执行内容: 拒绝 default、额外兼容导出和执行器伪造结果。
  if (!moduleNamespace || typeof moduleNamespace !== 'object'
    || Object.keys(moduleNamespace).length !== SOURCE_PACKAGE_MODULE_EXPORTS.length
    || Object.keys(moduleNamespace).some(key => !SOURCE_PACKAGE_MODULE_EXPORTS.includes(key))) {
    throw new SourcePackageLoadError({
      code: SOURCE_PACKAGE_ERROR_CODE.moduleInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.factory,
      message: '数据源模块运行时导出集合无效。',
      field: 'module.exports'
    });
  }

  assertRuntimeManifestMatches(inspection.manifest, moduleNamespace.sourceManifest);

  // 条件分支: 工厂创建导出不是函数时进入。
  // 执行内容: 在调用前给出精确 factory 错误。
  if (typeof moduleNamespace.createProviderFactory !== 'function') {
    throw new SourcePackageLoadError({
      code: SOURCE_PACKAGE_ERROR_CODE.factoryInvalid,
      stage: SOURCE_PACKAGE_LOAD_STAGE.factory,
      message: 'createProviderFactory 必须是函数。',
      field: 'createProviderFactory'
    });
  }

  return createProviderFactoryFacade(
    moduleNamespace.createProviderFactory,
    inspection.manifest
  );
}

/**
 * 复核脚本静态 manifest 与 Repository 中 SourceDefinition 的映射字段。
 * 纯函数: 使用严格 JSON 比较字段，不修改 manifest 或 Definition。
 * 失败路径: 身份、版本、展示信息、能力或设置声明不一致时拒绝恢复旧保存记录。
 *
 * @param {object} manifest 当前保存脚本静态预检结果。
 * @param {object} sourceDefinition Repository 返回的完整 Definition。
 * @returns {void} 全部映射字段一致时结束。
 */
function assertPersistedManifestMatchesDefinition(manifest, sourceDefinition) {
  // 循环作用: 逐项复核 manifest 到 Definition 的唯一映射，避免只比较 sourceId 后执行漂移脚本。
  PERSISTED_MANIFEST_DEFINITION_FIELDS.forEach((fieldName) => {
    // 条件分支: 当前字段的严格 JSON 表达不一致时进入。
    // 执行内容: 以 manifest 错误失败关闭，不注册当前候选工厂。
    if (JSON.stringify(manifest[fieldName]) !== JSON.stringify(sourceDefinition[fieldName])) {
      throw new SourcePackageLoadError({
        code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
        message: '已保存数据源定义与脚本声明不一致。',
        field: `sourceManifest.${fieldName}`
      });
    }
  });
}

/**
 * 创建单文件预检、加载和工厂支持校验门面。
 * 副作用: 只保存三个冻结端口引用；每次调用状态由下层端口控制，不缓存脚本文本或工厂。
 *
 * @param {object} dependencies inputReader、manifestParser 和 moduleExecutor。
 * @returns {object} preview、load 和 assertFactorySupports 冻结门面。
 */
export function createSourcePackageLoader(dependencies) {
  // 类型: object。
  // 作用: 保存经过精确字段和单方法门禁的三个加载依赖。
  const safeDependencies = normalizeDependencies(dependencies);

  /**
   * 读取并静态预检一次导入输入。
   * 副作用: remote 可能通过受控 NetworkAdapter 读取文本；不执行模块或保存状态。
   * 成功路径: 只返回不含 scriptContent 的 SourceImportPreview。
   * 失败路径: 读取或预检稳定错误原样 reject。
   *
   * @param {*} input 三入口共同输入。
   * @param {string} importedAt 当前预检取得执行权后的 UTC ISO 时间。
   * @returns {Promise<object>} 深冻结 SourceImportPreview。
   */
  async function preview(input, importedAt) {
    // 类型: object。
    // 作用: 保存三入口共同读取载荷；只在当前预检调用中存在。
    const payload = await safeDependencies.inputReader.read(input, importedAt);
    // 类型: object。
    // 作用: 保存静态 manifest 和无脚本文本预览，当前函数只向上返回 preview。
    const inspection = safeDependencies.manifestParser.inspect(payload);
    return inspection.preview;
  }

  /**
   * 重新读取、复检、核对信任哈希并执行单文件模块。
   * 副作用: remote 再读取一次当前内容；哈希一致后模块执行器在当前前端上下文执行脚本一次。
   * 成功路径: 返回同一 payload、manifest 和冻结 ProviderFactory，不注册或持久化。
   * 失败路径: 内容变化、未信任、执行、命名空间或工厂失败使用稳定错误。
   *
   * @param {*} input 三入口共同输入。
   * @param {*} trustDecision 用户确认哈希和是否启用决定。
   * @param {string} importedAt 正式导入取得执行权后的 UTC ISO 时间。
   * @returns {Promise<object>} payload、manifest、providerFactory 和 enableAfterImport。
   */
  async function load(input, trustDecision, importedAt) {
    // 类型: object。
    // 作用: 隔离并校验用户信任哈希和严格 Boolean 启用决定。
    const safeTrustDecision = normalizeTrustDecision(trustDecision);
    // 类型: object。
    // 作用: 正式导入重新读取当前文本，远程内容不能沿用陈旧预览缓存。
    const payload = await safeDependencies.inputReader.read(input, importedAt);
    // 类型: object。
    // 作用: 对正式读取的同一文本再次执行完整静态预检。
    const inspection = safeDependencies.manifestParser.inspect(payload);

    // 条件分支: 当前脚本 SHA-256 与用户确认预览不一致时进入。
    // 执行内容: 返回 trustRequired，不执行发生变化的本地或远程脚本。
    if (payload.integrity.scriptHash !== safeTrustDecision.trustedScriptHash) {
      throw new SourcePackageLoadError({
        code: SOURCE_PACKAGE_ERROR_CODE.trustRequired,
        stage: SOURCE_PACKAGE_LOAD_STAGE.trust,
        message: '数据源脚本内容已变化，请重新预检并确认。',
        field: 'trustDecision.trustedScriptHash'
      });
    }

    // 类型: object；作用: 用户确认后执行同一文本并完成运行时 manifest 与工厂 ABI 复核。
    const providerFactory = await executeInspectedPackage(
      payload,
      inspection,
      safeDependencies.moduleExecutor
    );

    return Object.freeze({
      payload,
      manifest: inspection.manifest,
      providerFactory,
      enableAfterImport: safeTrustDecision.enableAfterImport
    });
  }

  /**
   * 从 Repository 保存对象恢复一个已授权自定义 ProviderFactory。
   * 副作用: 只执行 Package 中已经保存的脚本文本，不读取文件、不请求 remoteUrl、不注册工厂。
   * 成功路径: Package/Definition/哈希/manifest/ABI/supports 全部一致后返回冻结工厂。
   * 失败路径: 任一保存或脚本事实漂移时稳定 reject，调用方不得回退旧工厂。
   *
   * @param {*} sourcePackage Repository 返回的 SourcePackage。
   * @param {*} sourceDefinition Repository 返回的关联 SourceDefinition。
   * @returns {Promise<object>} 冻结 ProviderFactory 门面。
   */
  async function restore(sourcePackage, sourceDefinition) {
    // 类型: object；作用: 校验并隔离完整 Package，后续异步执行不读取调用方引用。
    const safePackage = cloneSerializableValue(
      validateSourcePackage(sourcePackage),
      'persistedSourcePackage'
    );
    // 类型: object；作用: 校验并隔离完整 Definition，供 manifest 映射和 supports 复核。
    const safeDefinition = cloneSerializableValue(
      validateSourceDefinition(sourceDefinition),
      'persistedSourceDefinition'
    );

    // 条件分支: 保存对象不是同一自定义源、工厂或包引用时进入。
    // 执行内容: 在静态解析和脚本执行前拒绝断裂保存图。
    if (safeDefinition.sourceKind !== SOURCE_KIND.custom
      || safePackage.sourceId !== safeDefinition.id
      || safePackage.providerKey !== safeDefinition.providerKey
      || safePackage.packageRef !== safeDefinition.packageRef) {
      throw new SourcePackageLoadError({
        code: SOURCE_PACKAGE_ERROR_CODE.manifestInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.validate,
        message: '已保存数据源 Package 与 Definition 关联无效。',
        field: 'sourcePackage'
      });
    }

    // 类型: string；作用: 从真实保存文本复算 SHA-256，不信任完整性声明自身。
    const calculatedScriptHash = createSourceScriptHash(safePackage.scriptContent);
    // 条件分支: 算法或摘要与真实脚本文本不一致时进入。
    // 执行内容: 脚本执行前失败关闭，损坏 Package 不获得工厂注册机会。
    if (safePackage.integrity.algorithm !== SOURCE_PACKAGE_POLICY.integrityAlgorithm
      || safePackage.integrity.scriptHash !== calculatedScriptHash) {
      throw new SourcePackageLoadError({
        code: SOURCE_PACKAGE_ERROR_CODE.trustRequired,
        stage: SOURCE_PACKAGE_LOAD_STAGE.trust,
        message: '已保存数据源脚本完整性校验失败。',
        field: 'sourcePackage.integrity.scriptHash'
      });
    }

    // 类型: Readonly<object>；作用: 以保存对象重建静态预检载荷，不重新访问原文件或远程地址。
    const payload = Object.freeze({
      importMethod: safeDefinition.importMethod,
      scriptContent: safePackage.scriptContent,
      remoteUrl: safeDefinition.remoteUrl,
      originalFileName: '',
      importedAt: safeDefinition.importedAt,
      integrity: Object.freeze({ ...safePackage.integrity })
    });
    // 类型: object；作用: 对已保存脚本重新执行完整 AST 预检并取得当前 manifest。
    const inspection = safeDependencies.manifestParser.inspect(payload);
    assertPersistedManifestMatchesDefinition(inspection.manifest, safeDefinition);
    // 类型: object；作用: 执行同一已验证文本并创建冻结工厂。
    const providerFactory = await executeInspectedPackage(
      payload,
      inspection,
      safeDependencies.moduleExecutor
    );
    assertFactorySupports(providerFactory, safeDefinition);
    return providerFactory;
  }

  /**
   * 复核动态工厂明确支持由同一 manifest 映射的 SourceDefinition。
   * 副作用: 调用受信任工厂 supports 一次；不创建 Provider、访问网络或注册工厂。
   * 成功路径: supports 返回严格 true 时结束。
   * 失败路径: Definition 隔离失败、supports 抛错或非 true 结果抛 factory 错误。
   *
   * @param {object} providerFactory load 返回的冻结工厂门面。
   * @param {object} sourceDefinition 输入适配器从 manifest 映射的 Definition。
   * @returns {void} 工厂明确支持时结束。
   */
  function assertFactorySupports(providerFactory, sourceDefinition) {
    // 条件分支: 工厂门面缺失或 supports 非函数时进入。
    // 执行内容: 拒绝绕过 load 结果直接提交注册。
    if (!providerFactory || typeof providerFactory.supports !== 'function') {
      throw new SourcePackageLoadError({
        code: SOURCE_PACKAGE_ERROR_CODE.factoryInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.factory,
        message: 'ProviderFactory 支持检查入口无效。',
        field: 'ProviderFactory.supports'
      });
    }

    // 类型: boolean。
    // 作用: 只接受受信任工厂对隔离 Definition 返回的严格 true。
    let isSupported = false;
    try {
      isSupported = providerFactory.supports(cloneSerializableValue(
        sourceDefinition,
        'sourcePackageFactoryDefinition'
      )) === true;
    } catch (error) {
      throw createSourcePackageLoadError({
        error,
        code: SOURCE_PACKAGE_ERROR_CODE.factoryInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.factory,
        message: 'ProviderFactory.supports 执行失败。',
        field: 'ProviderFactory.supports'
      });
    }

    // 条件分支: 工厂没有明确支持当前 Definition 时进入。
    // 执行内容: 在注册和 Repository 保存前失败关闭。
    if (!isSupported) {
      throw new SourcePackageLoadError({
        code: SOURCE_PACKAGE_ERROR_CODE.factoryInvalid,
        stage: SOURCE_PACKAGE_LOAD_STAGE.factory,
        message: 'ProviderFactory 不支持当前数据源定义。',
        field: 'ProviderFactory.supports'
      });
    }
  }

  // 类型: object。
  // 作用: 冻结加载门面，不泄漏三个依赖端口或内部工厂校验函数。
  const loader = Object.freeze({ preview, load, restore, assertFactorySupports });

  // 条件分支: 公开方法数量或顺序与冻结契约不一致时进入。
  // 执行内容: 构造阶段失败，阻止内部能力意外公开。
  if (Object.keys(loader).length !== SOURCE_PACKAGE_LOADER_PUBLIC_METHODS.length
    || Object.keys(loader).some(
      (methodName, index) => methodName !== SOURCE_PACKAGE_LOADER_PUBLIC_METHODS[index]
    )) {
    throw new TypeError('SourcePackageLoader 公开方法无效');
  }

  return loader;
}
