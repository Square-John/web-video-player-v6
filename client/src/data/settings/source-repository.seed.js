/*
  source-repository.seed.js 模块说明

  - 文件职责:
      把真实内置源目录转换为 SourcePackage、SourceDefinition、SourcePreferences 和五分区 Storage 种子。
      为 IndexedDB v3 迁移公开精确旧产品模拟 sourceId 集合，不按名称或来源类型模糊删除。
      为 IndexedDB v26 迁移公开版曾发布的模拟系统身份，替换时保留用户收藏和播放历史。
      供产品空库、领域测试和迁移复用同一四类保存图，不读取设置页 Mock 投影。

  - 导入库及文件汇总(5 条，内置 0 条，第三方 0 条，自定义 5 条):
      内置源目录、发布身份与发布时间: 自定义产品目录，提供当前同源 manifest、完整脚本文本和独立发布版本。
      数据源领域枚举: 自定义配置，提供系统源、内置导入、授权状态和哈希算法。
      createSourceScriptHash/normalizeSourceScriptContent/createSourceAuthorizationStateFromFingerprint: 自定义授权工具，生成脚本文本和系统授权快照。
      SOURCE_STORAGE_PARTITION/createSourcePackageRef/cloneSerializableValue: 自定义 Repository 工具，创建引用、分区和隔离值。
      validateSourcePackage/validateSourceDefinition/validateSourcePreferences: 自定义校验器，复核生成保存对象。

  - 模块级常量:
      SOURCE_PACKAGE_SCHEMA_VERSION: string，SourcePackage 保存结构版本。
      SOURCE_PREFERENCES_SCHEMA_VERSION: string，SourcePreferences 保存结构版本。
      BUILTIN_SOURCE_CATALOG_RELEASE_SCHEMA_VERSION: string，目录发布身份对象结构版本。
      LEGACY_PRODUCT_SOURCE_IDS: Array<string>，v3 精确删除的九个旧模拟身份。
      RETIRED_BUILTIN_SOURCE_IDS: Array<string>，v20 精确退役的历史系统身份。
      REPLACED_PUBLIC_BUILTIN_SOURCE_IDS: Array<string>，v26 精确替换的旧公开模拟系统身份。
      sourceRepositorySeeds: object，当前真实系统源默认保存图。
      calculatedBuiltinSourceCatalogFingerprint: string，由当前 Package 与 Definition 实时计算的目录指纹。
      builtinSourceCatalogRelease: object，当前内置目录 revision、version 和 fingerprint 发布身份。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createEmptyStorageNamespace(): 创建完整空五分区命名空间。
      validateBuiltinSourceCatalog(catalog): 校验目录数量、身份唯一性和冻结条目。
      createBuiltinSourceRepositorySeeds(catalog, options): 按指定发布时刻生成并复核四类 Repository 种子。
      createBuiltinSourceCatalogFingerprint(sourceSeeds): 由系统 Package 与 Definition 生成确定性发布指纹。
      assertBuiltinSourceCatalogReleaseIntegrity(): 在数据库初始化前核对冻结发布指纹与真实目录内容。

  - 模块级类:
      无

  - 对外导出:
      LEGACY_PRODUCT_SOURCE_IDS: Array<string>，数据库迁移精确旧身份输入。
      RETIRED_BUILTIN_SOURCE_IDS: Array<string>，数据库迁移精确退役身份输入。
      REPLACED_PUBLIC_BUILTIN_SOURCE_IDS: Array<string>，公开版真实 Provider 替换迁移输入。
      createBuiltinSourceRepositorySeeds: Function，把受审内置目录转换为四类种子。
      createBuiltinSourceCatalogFingerprint: Function，为测试和发布输入生成同一目录指纹。
      assertBuiltinSourceCatalogReleaseIntegrity: Function，拒绝未更新目录发布身份的 Provider 或 Definition 内容。
      sourceRepositorySeeds: object，产品和持久化默认使用的当前系统源保存图。
      builtinSourceCatalogRelease: object，普通启动对账使用的当前目录发布身份。
*/

import {
  // 导入来源: ./builtin-source-catalog.js。
  // 导入内容: BUILTIN_SOURCE_CATALOG_FINGERPRINT 当前发布冻结目录指纹。
  // 文件作用: 在打开 IndexedDB 前与真实种子计算值比对，阻止同 revision 中间脚本进入浏览器保存图。
  BUILTIN_SOURCE_CATALOG_FINGERPRINT,
  // 导入来源: ./builtin-source-catalog.js。
  // 导入内容: BUILTIN_SOURCE_CATALOG_REVISION 内置目录独立发布序号。
  // 文件作用: 与 fingerprint 共同判断普通启动是否需要更新系统保存图。
  BUILTIN_SOURCE_CATALOG_REVISION,
  // 导入来源: ./builtin-source-catalog.js。
  // 导入内容: BUILTIN_SOURCE_CATALOG_RELEASED_AT 目录发布时间。
  // 文件作用: 为当前 Definition 提供稳定导入和更新时间。
  BUILTIN_SOURCE_CATALOG_RELEASED_AT,
  // 导入来源: ./builtin-source-catalog.js。
  // 导入内容: BUILTIN_SOURCE_CATALOG_VERSION 内置目录发布版本。
  // 文件作用: 为目录发布身份提供可读版本，不复用数据库 schema 整数。
  BUILTIN_SOURCE_CATALOG_VERSION,
  // 导入来源: ./builtin-source-catalog.js。
  // 导入内容: builtinSourceCatalog 产品真实内置源目录。
  // 文件作用: 作为 Package、Definition、Preferences 和 Storage 的唯一输入。
  builtinSourceCatalog
} from './builtin-source-catalog.js';

import {
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: AUTHORIZATION_STATUS 授权状态枚举。
  // 文件作用: 系统内置脚本使用与当前版本和指纹一致的授权快照。
  AUTHORIZATION_STATUS,
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 导入方式枚举。
  // 文件作用: Definition 明确标记随应用交付的 builtin 来源。
  IMPORT_METHOD,
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_DEFINITION_SCHEMA_VERSION Definition 保存结构版本。
  // 文件作用: 系统 Definition 使用平台保存版本，不复用 Provider manifest schema。
  SOURCE_DEFINITION_SCHEMA_VERSION,
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: Definition 标记系统源，删除操作采用软隐藏和恢复语义。
  SOURCE_KIND,
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_SCRIPT_INTEGRITY_ALGORITHM 完整性算法名称。
  // 文件作用: Package 与授权快照共用 SHA-256 标识。
  SOURCE_SCRIPT_INTEGRITY_ALGORITHM
} from '../../config/source-manager.config.js';

import {
  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: createSourceAuthorizationStateFromFingerprint 授权构造函数。
  // 文件作用: 根据当前 Definition 版本和 Package 指纹生成系统授权快照。
  createSourceAuthorizationStateFromFingerprint,
  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: createSourceScriptHash 脚本哈希函数。
  // 文件作用: 计算 raw 原文件规范化后的 SourcePackage 指纹。
  createSourceScriptHash,
  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: normalizeSourceScriptContent 换行规范化函数。
  // 文件作用: 保证文件导出、Vite 和 Node 测试使用相同脚本文本。
  normalizeSourceScriptContent
} from '../../utils/sourceAuthorization.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: SOURCE_STORAGE_PARTITION 五分区枚举。
  // 文件作用: 空库和迁移都建立完整私有空间命名空间。
  SOURCE_STORAGE_PARTITION,
  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: cloneSerializableValue 严格隔离函数。
  // 文件作用: 切断 manifest 与 Repository 保存对象的嵌套引用。
  cloneSerializableValue,
  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: createSourcePackageRef 稳定包引用函数。
  // 文件作用: 根据真实 sourceId 创建 Package 与 Definition 共用引用。
  createSourcePackageRef
} from '../../repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourceDefinition Definition 校验函数。
  // 文件作用: 输出前复核全部 Definition 精确字段和能力结构。
  validateSourceDefinition,
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourcePackage Package 校验函数。
  // 文件作用: 输出前复核脚本文本、引用和完整性结构。
  validateSourcePackage,
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourcePreferences Preferences 校验函数。
  // 文件作用: 输出前复核默认源、软隐藏集合和全部授权状态。
  validateSourcePreferences
} from '../../repositories/source/sourceRepositoryValidators.js';

// 类型: string。
// 作用: 标识当前 SourcePackage 保存字段结构，不复用数据源业务版本。
const SOURCE_PACKAGE_SCHEMA_VERSION = '1.0.0';

// 类型: string。
// 作用: 标识当前 SourcePreferences 保存字段结构，供未来偏好迁移识别。
const SOURCE_PREFERENCES_SCHEMA_VERSION = '1.0.0';

// 类型: string；作用: 标识 catalog release 的 revision、version 和 fingerprint 精确结构。
const BUILTIN_SOURCE_CATALOG_RELEASE_SCHEMA_VERSION = '1.0.0';

// 类型: ReadonlyArray<string>。
// 作用: v3 只删除这些由旧产品首次种子创建的模拟身份，不按名称、system/custom 或 providerKey 扩大删除范围。
export const LEGACY_PRODUCT_SOURCE_IDS = Object.freeze([
  'system-source-1',
  'system-source-2',
  'system-source-3',
  'system-source-4',
  'custom-online-demo',
  'custom-online-latest',
  'custom-file-demo',
  'custom-text-demo',
  'system-source-5'
]);

// 类型: ReadonlyArray<string>。
// 作用: v20 只退役这两个历史系统身份；迁移器按输入执行通用删除，不理解站点名称、域名或页面业务。
export const RETIRED_BUILTIN_SOURCE_IDS = Object.freeze([
  'source.system.2',
  'source.system.3'
]);

// 类型: ReadonlyArray<string>。
// 作用: v26 只替换公开版曾正式发布的两条模拟系统源；收藏和播放历史仍按用户资产原样保留。
export const REPLACED_PUBLIC_BUILTIN_SOURCE_IDS = Object.freeze([
  'system-source-1',
  'system-source-4'
]);

/**
 * 创建完整空五分区私有空间。
 * 纯函数: 每次返回五个新普通对象，不共享可变分区引用。
 * 数据边界: 系统源首次运行需要的缓存、凭据和会话由 Provider 通过 SourceContext 后续写入。
 *
 * @returns {object} settings、credentials、session、cache 和 diagnostics 空分区。
 */
function createEmptyStorageNamespace() {
  return {
    [SOURCE_STORAGE_PARTITION.settings]: {},
    [SOURCE_STORAGE_PARTITION.credentials]: {},
    [SOURCE_STORAGE_PARTITION.session]: {},
    [SOURCE_STORAGE_PARTITION.cache]: {},
    [SOURCE_STORAGE_PARTITION.diagnostics]: {}
  };
}

/**
 * 校验产品内置源目录的数量、冻结状态和唯一身份。
 * 纯函数: 返回原目录供生成器迭代，不修改条目、manifest 或脚本文本。
 * 成功路径: 目录至少包含一条冻结记录且 sourceId、providerKey 均唯一时返回。
 * 失败路径: 目录为空、容器可变、条目可变或身份重复时抛出 TypeError，不生成部分种子。
 *
 * @param {*} catalog 内置源目录候选。
 * @returns {ReadonlyArray<object>} 已验证原目录。
 * @throws {TypeError} 当目录不能形成非空唯一系统源集合时抛出。
 */
function validateBuiltinSourceCatalog(catalog) {
  // 条件分支: 目录不是冻结非空数组时进入。
  // 执行内容: 拒绝启动时动态改写目录或把空目录当成有效产品状态；实际数量由受审目录本身决定。
  if (!Array.isArray(catalog) || !Object.isFrozen(catalog) || catalog.length === 0) {
    throw new TypeError('内置数据源目录必须是冻结非空数组');
  }

  // 类型: Set<string>。
  // 作用: 收集真实 sourceId，防止两个 Package、Definition 和 Storage 共用主键。
  const sourceIds = new Set();
  // 类型: Set<string>。
  // 作用: 收集 Provider 注册键，防止动态 Loader 注册时后项覆盖前项。
  const providerKeys = new Set();

  catalog.forEach((entry, index) => {
    // 条件分支: 条目、manifest 或脚本文本不满足冻结发布目录时进入。
    // 执行内容: 拒绝初始化期间被调用方替换身份，或生成没有可执行单文件的假系统源。
    if (!entry || typeof entry !== 'object' || !Object.isFrozen(entry)
      || !entry.manifest || !Object.isFrozen(entry.manifest)
      || typeof entry.scriptContent !== 'string' || !entry.scriptContent.trim()) {
      throw new TypeError(`builtinSourceCatalog[${index}] 必须完整冻结`);
    }

    // 类型: string。
    // 作用: 当前真实源身份，关联四类保存对象和 Provider。
    const sourceId = entry.manifest.id;
    // 类型: string。
    // 作用: 当前 Provider 身份，Package、Definition 和动态 Registry 必须一致。
    const providerKey = entry.manifest.providerKey;

    // 条件分支: 任一身份重复时进入。
    // 执行内容: 在创建 Map 键或写 IndexedDB 前失败，禁止静默覆盖前项。
    if (sourceIds.has(sourceId) || providerKeys.has(providerKey)) {
      throw new TypeError(`内置数据源身份重复: ${sourceId}`);
    }
    sourceIds.add(sourceId);
    providerKeys.add(providerKey);
  });

  return catalog;
}

/**
 * 从受审真实内置源目录生成四类 Repository 种子。
 * 纯函数: 输出为全新严格 JSON 对象；不修改目录、执行 Provider、注册工厂或写 Repository。
 * 成功路径: 当前目录全部 Package、Definition、授权偏好和空五分区命名空间通过正式校验后返回。
 * 失败路径: 目录、manifest、脚本文本或保存对象偏离时抛错，调用方不能采用部分结果。
 *
 * @param {ReadonlyArray<object>} catalog 产品内置源目录。
 * @param {object} options 种子生成选项；产品运行省略时采用正式目录发布时间。
 * @param {string} options.releasedAt 当前候选目录统一 ISO 发布时间，驱动 Definition 和授权审计字段。
 * @returns {object} packages、definitions、preferences 和 storageNamespaces 四类种子。
 * @throws {TypeError|SourceRepositoryValidationError} 当输入或输出不符合契约时抛出。
 */
export function createBuiltinSourceRepositorySeeds(catalog = builtinSourceCatalog, options = {}) {
  // 类型: ReadonlyArray<object>。
  // 作用: 完成数量、冻结与唯一身份检查后作为唯一迭代输入。
  const safeCatalog = validateBuiltinSourceCatalog(catalog);
  // 类型: string；作用: 发布工具可以在内存中计算候选保存图；产品默认仍采用正式目录冻结时间。
  const releasedAt = options.releasedAt === undefined
    ? BUILTIN_SOURCE_CATALOG_RELEASED_AT
    : options.releasedAt;
  // 类型: Date|null；作用: 只有字符串候选才创建日期对象，非法时间通过 NaN 分支稳定拒绝。
  const releasedAtDate = typeof releasedAt === 'string' ? new Date(releasedAt) : null;
  // 条件分支: 候选发布时间不是可往返的 ISO UTC 字符串时进入；执行内容: 拒绝生成会随时区或解析器漂移的 Definition。
  if (typeof releasedAt !== 'string'
    || Number.isNaN(releasedAtDate.getTime())
    || releasedAtDate.toISOString() !== releasedAt) {
    throw new TypeError('内置目录发布时间必须是规范 ISO UTC 字符串');
  }

  // 类型: Array<object>。
  // 作用: 按目录顺序累积全部完整脚本包。
  const packages = [];
  // 类型: Array<object>。
  // 作用: 按目录顺序累积全部页面与运行定义。
  const definitions = [];
  // 类型: Record<string, object>。
  // 作用: 按真实 sourceId 保存系统授权和启用决定。
  const sourceStates = {};
  // 类型: Record<string, object>。
  // 作用: 按真实 sourceId 保存完整空五分区命名空间。
  const storageNamespaces = {};

  safeCatalog.forEach((entry) => {
    // 类型: object。
    // 作用: 当前单文件静态 manifest，是 Definition 元信息和 Provider 身份的唯一来源。
    const manifest = entry.manifest;
    // 类型: string。
    // 作用: 规范化当前原文件文本，Package、导出和授权哈希共同使用。
    const scriptContent = normalizeSourceScriptContent(entry.scriptContent);
    // 类型: string。
    // 作用: 根据真实 sourceId 创建稳定包引用。
    const packageRef = createSourcePackageRef(manifest.id);
    // 类型: string。
    // 作用: 当前完整脚本文本的 SHA-256，授权快照不得重新计算另一份字符串。
    const scriptHash = createSourceScriptHash(scriptContent);

    // 类型: object。
    // 作用: 保存可导出完整脚本和完整性事实，不复制页面元信息。
    const sourcePackage = {
      packageRef,
      schemaVersion: SOURCE_PACKAGE_SCHEMA_VERSION,
      sourceId: manifest.id,
      providerKey: manifest.providerKey,
      scriptContent,
      integrity: {
        algorithm: SOURCE_SCRIPT_INTEGRITY_ALGORITHM,
        scriptHash
      }
    };

    // 类型: object。
    // 作用: 从同一 manifest 生成设置页和 Host 消费的可序列化定义。
    const sourceDefinition = {
      schemaVersion: SOURCE_DEFINITION_SCHEMA_VERSION,
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      authorName: manifest.authorName,
      siteUrl: manifest.siteUrl,
      sourceKind: SOURCE_KIND.system,
      version: manifest.version,
      providerKey: manifest.providerKey,
      packageRef,
      importMethod: IMPORT_METHOD.builtin,
      remoteUrl: '',
      importedAt: releasedAt,
      lastUpdatedAt: releasedAt,
      capabilities: cloneSerializableValue(
        manifest.capabilities,
        `builtinSource.${manifest.id}.capabilities`
      ),
      settingsSchema: cloneSerializableValue(
        manifest.settingsSchema,
        `builtinSource.${manifest.id}.settingsSchema`
      )
    };

    // 执行内容: 在加入集合前复用正式 Repository 精确字段校验，拒绝内置源享受宽松特例。
    validateSourcePackage(sourcePackage);
    validateSourceDefinition(sourceDefinition);
    packages.push(sourcePackage);
    definitions.push(sourceDefinition);

    // 类型: object。
    // 作用: 系统源由应用交付，授权快照仍绑定当前版本和同一脚本哈希，后续脚本变化可被统一评估。
    sourceStates[manifest.id] = {
      enabled: true,
      authorization: createSourceAuthorizationStateFromFingerprint(
        {
          version: manifest.version,
          currentScriptHash: scriptHash
        },
        {
          status: AUTHORIZATION_STATUS.authorized,
          authorizedAt: releasedAt
        }
      )
    };

    // 赋值副作用: 只写当前函数局部对象；每个源取得独立五分区对象。
    storageNamespaces[manifest.id] = createEmptyStorageNamespace();
  });

  // 类型: object。
  // 作用: 第一条真实内置源成为新空库默认源，当前目录全部源均可见且启用。
  const preferences = {
    schemaVersion: SOURCE_PREFERENCES_SCHEMA_VERSION,
    defaultSourceId: definitions[0].id,
    removedSystemSourceIds: [],
    sourceStates
  };
  validateSourcePreferences(preferences);

  // 返回值类型: object。
  // 作用: 调用方只能显式把完整四类保存图交给 Memory 或 IndexedDB 基础设施。
  return {
    packages,
    definitions,
    preferences,
    storageNamespaces
  };
}

/**
 * 根据系统 Package 与 Definition 生成内置目录发布指纹。
 * 纯函数: 只读取并校验调用方种子；忽略用户启停、默认源、私有空间和用户内容，返回稳定 SHA-256。
 * 成功路径: 相同有序系统脚本、完整性和 Definition 事实得到相同指纹，任一发布字段变化都会得到新指纹。
 * 失败路径: 输入不是精确四类种子、Package 或 Definition 非法时抛错，不为半完成目录生成可采用身份。
 *
 * @param {object} sourceSeeds packages、definitions、preferences 和 storageNamespaces 四类种子。
 * @returns {string} 64 位小写 SHA-256 目录指纹。
 * @throws {TypeError|SourceRepositoryValidationError} 当种子结构或系统保存对象无效时抛出。
 */
export function createBuiltinSourceCatalogFingerprint(sourceSeeds) {
  // 条件分支: 根对象或四类字段集合偏离正式种子时进入；执行内容: 拒绝未知发布输入。
  if (!sourceSeeds || typeof sourceSeeds !== 'object' || Array.isArray(sourceSeeds)
    || Object.getPrototypeOf(sourceSeeds) !== Object.prototype
    || Object.keys(sourceSeeds).length !== 4
    || !['packages', 'definitions', 'preferences', 'storageNamespaces']
      .every(field => Object.hasOwn(sourceSeeds, field))) {
    throw new TypeError('内置目录指纹输入必须是完整四类 Source 种子');
  }
  // 条件分支: 系统 Package 或 Definition 不是数组时进入；执行内容: 阻止空对象被序列化成合法指纹。
  if (!Array.isArray(sourceSeeds.packages) || !Array.isArray(sourceSeeds.definitions)) {
    throw new TypeError('内置目录指纹缺少 Package 或 Definition 集合');
  }
  // 类型: Array<object>；作用: 只保留脚本身份和完整性，不把完整脚本文本重复放入指纹输入。
  const packages = sourceSeeds.packages.map((sourcePackage) => {
    validateSourcePackage(sourcePackage);
    return {
      packageRef: sourcePackage.packageRef,
      sourceId: sourcePackage.sourceId,
      providerKey: sourcePackage.providerKey,
      schemaVersion: sourcePackage.schemaVersion,
      integrity: cloneSerializableValue(sourcePackage.integrity, 'builtinCatalogFingerprint.integrity')
    };
  });
  // 类型: Array<object>；作用: 保留完整系统 Definition 发布事实，目录顺序变化也会形成新发布指纹。
  const definitions = sourceSeeds.definitions.map((sourceDefinition, definitionIndex) => {
    validateSourceDefinition(sourceDefinition);
    return cloneSerializableValue(
      sourceDefinition,
      `builtinCatalogFingerprint.definitions[${definitionIndex}]`
    );
  });
  return createSourceScriptHash(JSON.stringify({ packages, definitions }));
}

// 类型: object。
// 作用: 产品真正空库和连续迁移共同使用的当前真实系统源默认保存图。
export const sourceRepositorySeeds = createBuiltinSourceRepositorySeeds();

// 类型: string。
// 作用: 从当前真实系统 Package 与 Definition 计算发布指纹，供启动屏障验证目录内容没有脱离冻结发布身份。
const calculatedBuiltinSourceCatalogFingerprint = createBuiltinSourceCatalogFingerprint(
  sourceRepositorySeeds
);

// 类型: Readonly<object>；作用: 普通启动比较当前目录与 IndexedDB 保存事实，revision 决定新旧，fingerprint 证明同版本内容一致。
export const builtinSourceCatalogRelease = Object.freeze({
  // 字段类型: string；作用: 当前发布身份对象的字段结构版本。
  schemaVersion: BUILTIN_SOURCE_CATALOG_RELEASE_SCHEMA_VERSION,
  // 字段类型: number；作用: 大于本地值时允许原子升级，小于本地值时禁止旧应用降级。
  revision: BUILTIN_SOURCE_CATALOG_REVISION,
  // 字段类型: string；作用: 面向发布记录和诊断的版本文本，不参与 IndexedDB 结构判断。
  version: BUILTIN_SOURCE_CATALOG_VERSION,
  // 字段类型: string；作用: 当前发布人工冻结的 SHA-256；启动屏障核对真实计算值后才允许交给数据库比较。
  fingerprint: BUILTIN_SOURCE_CATALOG_FINGERPRINT
});

/**
 * 核对当前内置目录内容与冻结发布身份。
 * 纯函数: 只比较模块生成的真实目录指纹和发布常量，不访问 IndexedDB、Store、Provider 私有空间或网络。
 * 成功路径: 两个 SHA-256 完全一致时返回冻结 builtinSourceCatalogRelease，供唯一数据库初始化链使用。
 * 失败路径: Provider 脚本、manifest 或 Definition 变化但发布指纹未同步时抛 TypeError，数据库尚未打开且原数据保持不变。
 * 维护边界: 目录内容变化必须生成新指纹，并同时递增 revision 与可读版本；不得放宽为运行时自动改写发布身份。
 *
 * @returns {Readonly<object>} 已证明与当前 Package 和 Definition 一致的内置目录发布身份。
 * @throws {TypeError} 当冻结指纹与真实目录内容不一致时抛出。
 */
export function assertBuiltinSourceCatalogReleaseIntegrity() {
  // 条件分支: 真实目录内容已经脱离当前冻结发布时进入。
  // 执行内容: 在持久化初始化前失败关闭，阻止中间脚本以旧 revision 写入或对账浏览器数据。
  if (calculatedBuiltinSourceCatalogFingerprint !== BUILTIN_SOURCE_CATALOG_FINGERPRINT) {
    throw new TypeError('内置目录内容与冻结发布指纹不一致，请递增目录 revision、版本并更新指纹');
  }

  return builtinSourceCatalogRelease;
}
