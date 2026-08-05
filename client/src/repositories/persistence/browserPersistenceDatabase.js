/*
  browserPersistenceDatabase.js 模块说明

  - 文件职责:
      使用 idb 管理 Web Video Player 唯一 IndexedDB 连接、schema 创建、首次空库种子和受控事务。
      向 Repository 提供事务执行边界，不泄漏 IDBDatabase，不在失败后创建 Memory 或其他存储实现。

  - 导入库及文件汇总(9 条，内置 0 条，第三方 1 条，自定义 8 条):
      openDB/deleteDB: 第三方 idb，打开、包装和删除 IndexedDB 数据库。
      browserPersistence.config: 自定义配置，提供数据库、store、索引和元信息稳定名称。
      browserPersistenceErrors: 自定义错误，转换连接、迁移、种子和事务失败。
      sourceRepositoryUtils: 自定义工具，校验五分区并隔离严格 JSON Value。
      sourceRepositoryValidators: 自定义校验，校验保存对象、动态键和精确普通对象。
      mediaPlayback.config exports: 自定义配置，提供默认快捷键绑定与偏好版本。
      homeDisplay.config exports: 自定义配置，创建默认首页展示偏好。
      source-manager.config exports: 自定义配置，提供 Definition 版本和署名缺省值。
      userContentRepositoryValidators exports: 自定义校验，复核恢复策略、快捷键和首页展示偏好迁移对象。

  - 模块级常量:
      DATABASE_OPTION_FIELDS: Array<string>，数据库构造器允许字段。
      INITIALIZATION_OPTION_FIELDS: Array<string>，首次初始化与 v3 至当前迁移允许字段。
      BUILTIN_CATALOG_RELEASE_FIELDS: Array<string>，内置目录发布身份精确字段集合。
      BUILTIN_CATALOG_FINGERPRINT_PATTERN: RegExp，目录 SHA-256 指纹格式。
      SOURCE_SEED_FIELDS: Array<string>，数据源种子允许字段。
      USER_CONTENT_SEED_FIELDS: Array<string>，用户内容种子允许字段。
      SOURCE_STORAGE_PARTITION_NAMES: Array<string>，私有空间五分区稳定名称。
      VERSION_TWENTY_FOUR_SOURCE_DEFINITION_FIELDS: Array<string>，v25 接受的紧邻旧 Definition 精确字段。
      VERSION_TWENTY_FOUR_SOURCE_DEFINITION_SCHEMA_VERSION: string，v25 接受的紧邻旧 Definition 版本。
      DATABASE_MIGRATIONS: Array<object>，按整数版本连续执行的 schema 迁移表。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertExactPlainObject(value, fields, fieldName): 校验精确普通对象字段。
      normalizeDatabaseOptions(options): 校验数据库名称和整数版本。
      normalizeSourceSeeds(sourceSeeds): 校验并隔离数据源四类种子。
      normalizeUserContentSeed(userContentSeed): 校验并隔离首次游客种子。
      normalizeBuiltinCatalogRelease(release, fieldName): 校验并隔离内置目录发布身份。
      normalizeRequiredSourceIdList(sourceIds, fieldName): 校验并冻结迁移使用的精确身份集合。
      hasExactSourceDefinitionFields(value, fields): 判断 Definition 是否使用指定精确字段集合。
      validateMigrationSourceDefinition(sourceDefinition, fieldName): 校验历史或当前 Definition，且不改写旧对象。
      normalizeInitializationOptions(options): 组合首次初始化输入。
      normalizeStoreNames(storeNames): 校验事务 store 集合。
      createInitialSchema(database, transaction): 创建 v1 九仓、索引和版本事实。
      applyLifecycleMetadataMigration(database, transaction): 复核 v1 schema 并写入 v2 版本事实。
      applyBuiltinSourceCatalogMigration(database, transaction, context): 原子替换旧产品模拟保存图并清理悬空用户引用。
      reconcileBuiltinSourceCatalog(transaction, context, targetSchemaVersion): 供迁移和普通启动共用的系统源原子对账核心。
      applyBuiltinSourceRefreshMigration(database, transaction, context): 以幂等对账语义执行 v4 内置目录刷新。
      applyBuiltinSourceReconciliationMigration(database, transaction, context): 为既有 v4 库执行 v5 系统源对账恢复。
      applyBuiltinSourceChallengeRefreshMigration(database, transaction, context): 为既有 v5 库执行 v6 挑战请求语义源刷新。
      applyBuiltinSourceVerificationRefreshMigration(database, transaction, context): 为既有 v6 库执行 v7 验证响应语义源刷新。
      applyBuiltinSourceSearchTransactionRefreshMigration(database, transaction, context): 为既有 v7 库执行 v8 搜索表单 URL 语义源刷新。
      applyProviderApiVersion2RefreshMigration(database, transaction, context): 为既有 v8 库执行 v9 Provider ABI 2.0 四源刷新。
      applyBuiltinSourceRequestPolicyRefreshMigration(database, transaction, context): 为既有 v9 库执行 v10 当前内置 Provider 请求语义刷新。
      createDefaultShortcutPreferences(): 创建可写入 IndexedDB 的默认快捷键偏好。
      applyUserShortcutPreferencesRefreshMigration(database, transaction): 为既有 v10 库执行 v11 用户快捷键偏好迁移。
      applyHomeDisplayPreferencesRefreshMigration(database, transaction): 为既有 v11 库执行 v12 首页展示偏好迁移。
      applyBuiltinSourceDisplayNameRefreshMigration(database, transaction, context): 为既有 v12 库执行 v13 系统源纯名称发布。
      applyBuiltinSourceLogicalPaginationRefreshMigration(database, transaction, context): 为既有 v13 库执行 v14 首页逻辑分页脚本发布。
      applyBuiltinSourceHomeMappingRefreshMigration(database, transaction, context): 为既有 v14 库执行 v15 首页区域映射脚本发布。
      applyBuiltinSourceMovieCatalogRefreshMigration(database, transaction, context): 为既有 v15 库执行 v16 电影目录脚本发布。
      applyBuiltinSourceTvCatalogRefreshMigration(database, transaction, context): 为既有 v16 库执行 v17 电视剧目录脚本发布。
      applyBuiltinSourceSearchPaginationRefreshMigration(database, transaction, context): 为既有 v17 库执行 v18 搜索分页脚本发布。
      applyBuiltinSourceDetailMappingRefreshMigration(database, transaction, context): 为既有 v18 库执行 v19 详情字段和播放列表脚本发布。
      applyBuiltinSourceRetirementMigration(database, transaction, context): 为既有 v19 库执行 v20 系统源保存图与私有空间退役。
      applyBuiltinSourceCardMetadataRefreshMigration(database, transaction, context): 为既有 v20 库执行 v21 完整卡片字段脚本发布。
      applyBuiltinSourceSearchMetadataRepairMigration(database, transaction, context): 为既有 v21 库执行 v22 搜索行解析修复脚本发布。
      applyBuiltinSourceDetailStatusRepairMigration(database, transaction, context): 为既有 v22 库执行 v23 详情状态边界修复脚本发布。
      applyUserContentSnapshotsMigration(database, transaction): 为既有 v23 用户记录补齐快照与分集定位字段。
      applySourceAttributionMigration(database, transaction): 为既有 v24 Definition 补齐作者和原站地址。
      applyPublicBuiltinSourceReplacementMigration(database, transaction, context): 为既有 v25 库移除公开版旧模拟系统源。
      runSchemaMigrations(database, transaction, oldVersion, newVersion, context): 逐版本执行迁移表。
      seedSourceStores(transaction, sourceSeeds): 写入数据源四仓种子。
      seedUserContentStores(transaction, userContentSeed, targetSchemaVersion): 按目标 schema 写入用户内容四仓种子。
      compareBuiltinCatalogReleases(localRelease, currentRelease): 判断启动目录无需写入、需要升级或必须失败关闭。

  - 模块级类:
      BrowserPersistenceDatabase: 单连接数据库门面，管理初始化、事务、关闭和测试删除。

  - 对外导出:
      BrowserPersistenceDatabase: Class，供 Repository 组合层创建唯一数据库门面。
*/

import {
  // 导入来源: idb；导入内容: openDB；文件作用: 把 IndexedDB 打开请求、事务和 object store 包装为 Promise 接口。
  openDB,
  // 导入来源: idb；导入内容: deleteDB；文件作用: 只在测试或明确重置入口删除指定数据库。
  deleteDB
} from 'idb';

import {
  // 导入来源: ./browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_ALL_STORE_NAMES；文件作用: 校验事务只能访问正式九仓。
  BROWSER_PERSISTENCE_ALL_STORE_NAMES,
  // 导入来源: ./browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_BUSINESS_STORE_NAMES；文件作用: 首次种子前判定真正空库。
  BROWSER_PERSISTENCE_BUSINESS_STORE_NAMES,
  // 导入来源: ./browserPersistence.config.js；导入内容: BUILTIN_SOURCE_CATALOG_STORE_NAMES；文件作用: 限定普通启动目录对账的四仓写集。
  BUILTIN_SOURCE_CATALOG_STORE_NAMES,
  // 导入来源: ./browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_DATABASE_NAME；文件作用: 提供正式默认数据库名。
  BROWSER_PERSISTENCE_DATABASE_NAME,
  // 导入来源: ./browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_DATABASE_VERSION；文件作用: 提供正式默认 schema 版本。
  BROWSER_PERSISTENCE_DATABASE_VERSION,
  // 导入来源: ./browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_INDEX；文件作用: 创建私有空间与用户内容索引。
  BROWSER_PERSISTENCE_INDEX,
  // 导入来源: ./browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_META_KEY；文件作用: 写入初始化、结构和目录发布事实。
  BROWSER_PERSISTENCE_META_KEY,
  // 导入来源: ./browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_SCHEMA_VERSION；文件作用: 绑定迁移表和元信息的具名整数版本。
  BROWSER_PERSISTENCE_SCHEMA_VERSION,
  // 导入来源: ./browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_STORE；文件作用: 创建并访问九个正式 store。
  BROWSER_PERSISTENCE_STORE,
  // 导入来源: ./browserPersistence.config.js；导入内容: SOURCE_PREFERENCES_RECORD_KEY；文件作用: 保存 SourcePreferences 单例包装记录。
  SOURCE_PREFERENCES_RECORD_KEY
} from './browserPersistence.config.js';

import {
  // 导入来源: ./browserPersistenceErrors.js；导入内容: BROWSER_PERSISTENCE_ERROR_CODE；文件作用: 为连接、迁移、种子和事务失败选择稳定 code。
  BROWSER_PERSISTENCE_ERROR_CODE,
  // 导入来源: ./browserPersistenceErrors.js；导入内容: BrowserPersistenceError；文件作用: 创建 blocked、terminated 和损坏状态错误。
  BrowserPersistenceError,
  // 导入来源: ./browserPersistenceErrors.js；导入内容: createBrowserPersistenceError；文件作用: 保留 cause 并统一包装原生失败。
  createBrowserPersistenceError
} from './browserPersistenceErrors.js';

import {
  // 导入来源: ../source/sourceRepositoryUtils.js；导入内容: SOURCE_STORAGE_PARTITION；文件作用: 校验种子命名空间完整包含五分区。
  SOURCE_STORAGE_PARTITION,
  // 导入来源: ../source/sourceRepositoryUtils.js；导入内容: cloneSerializableValue；文件作用: 切断调用方种子引用并验证严格 JSON Value。
  cloneSerializableValue
} from '../source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../source/sourceRepositoryValidators.js；导入内容: assertPlainObject；文件作用: 拒绝数组和复杂实例进入数据库配置与种子。
  assertPlainObject,
  // 导入来源: ../source/sourceRepositoryValidators.js；导入内容: assertSafeRecordKey；文件作用: 校验 sourceId、storage key、userId 和记录键。
  assertSafeRecordKey,
  // 导入来源: ../source/sourceRepositoryValidators.js；导入内容: validateSourceDefinition；文件作用: 首次写入前复用正式 Definition 契约。
  validateSourceDefinition,
  // 导入来源: ../source/sourceRepositoryValidators.js；导入内容: validateSourcePackage；文件作用: 首次写入前复用正式 Package 契约。
  validateSourcePackage,
  // 导入来源: ../source/sourceRepositoryValidators.js；导入内容: validateSourcePreferences；文件作用: 首次写入前复用正式 Preferences 契约。
  validateSourcePreferences
} from '../source/sourceRepositoryValidators.js';

import {
  // 导入来源: ../../config/mediaPlayback.config.js；导入内容: DEFAULT_PLAYBACK_SHORTCUT_BINDINGS；文件作用: 为首次种子和 v11 迁移生成默认绑定。
  DEFAULT_PLAYBACK_SHORTCUT_BINDINGS,
  // 导入来源: ../../config/mediaPlayback.config.js；导入内容: PLAYBACK_SHORTCUT_PREFERENCES_SCHEMA_VERSION；文件作用: 写入当前快捷键偏好结构版本。
  PLAYBACK_SHORTCUT_PREFERENCES_SCHEMA_VERSION
} from '../../config/mediaPlayback.config.js';

// 导入来源: ../../config/homeDisplay.config.js；导入内容: createDefaultHomeDisplayPreferences；文件作用: 为首次种子和 v12 迁移创建默认首页展示偏好。
import { createDefaultHomeDisplayPreferences } from '../../config/homeDisplay.config.js';

import {
  // 导入来源: ../../config/source-manager.config.js；导入内容: SOURCE_ATTRIBUTION_POLICY；文件作用: v25 使用统一作者与空地址默认值。
  SOURCE_ATTRIBUTION_POLICY,
  // 导入来源: ../../config/source-manager.config.js；导入内容: SOURCE_DEFINITION_SCHEMA_VERSION；文件作用: v25 写入当前 Definition 保存结构版本。
  SOURCE_DEFINITION_SCHEMA_VERSION
} from '../../config/source-manager.config.js';

import {
  // 导入来源: ../user-content/userContentRepositoryValidators.js；导入内容: cloneValidatedResumePolicy；文件作用: 复核 v10 用户设置恢复策略。
  cloneValidatedResumePolicy,
  // 导入来源: ../user-content/userContentRepositoryValidators.js；导入内容: cloneValidatedShortcutPreferences；文件作用: 复核默认快捷键偏好。
  cloneValidatedShortcutPreferences,
  // 导入来源: ../user-content/userContentRepositoryValidators.js；导入内容: cloneValidatedHomeDisplayPreferences；文件作用: 复核默认首页展示偏好。
  cloneValidatedHomeDisplayPreferences
} from '../user-content/userContentRepositoryValidators.js';

// 类型: Array<string>；作用: 数据库构造器只允许正式名称与整数版本，测试可用唯一名称隔离数据库。
const DATABASE_OPTION_FIELDS = Object.freeze(['databaseName', 'databaseVersion']);

// 类型: Array<string>；作用: 初始化必须同时提供数据源种子、游客种子和当前内置目录发布身份。
const INITIALIZATION_OPTION_FIELDS = Object.freeze([
  'sourceSeeds',
  'userContentSeed',
  'builtinCatalogRelease',
  'legacyProductSourceIds',
  'retiredBuiltinSourceIds',
  'replacedPublicBuiltinSourceIds'
]);

// 类型: Array<string>；作用: 目录发布身份只允许结构版本、单调 revision、可读 version 和确定性 fingerprint 四个字段。
const BUILTIN_CATALOG_RELEASE_FIELDS = Object.freeze([
  'schemaVersion',
  'revision',
  'version',
  'fingerprint'
]);

// 类型: RegExp；作用: 目录 fingerprint 必须是 createSourceScriptHash 生成的 64 位小写 SHA-256，拒绝模糊版本文本。
const BUILTIN_CATALOG_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

// 类型: Array<string>；作用: 数据源首次种子沿用 Memory 工厂的四类分离输入，不接收页面投影。
const SOURCE_SEED_FIELDS = Object.freeze(['packages', 'definitions', 'preferences', 'storageNamespaces']);

// 类型: Array<string>；作用: 用户首次种子只接受 UserContentState 五个正式顶层字段。
const USER_CONTENT_SEED_FIELDS = Object.freeze([
  'user',
  'favorites',
  'playHistory',
  'currentPlaying',
  'resumePolicy'
]);

// 类型: Array<string>；作用: 首次种子要求每个 sourceId 命名空间显式具备完整五分区。
const SOURCE_STORAGE_PARTITION_NAMES = Object.freeze(Object.values(SOURCE_STORAGE_PARTITION));

// 类型: Array<string>；作用: 精确描述 v24 SourceDefinition 字段，v25 迁移拒绝损坏或混入未知字段的历史记录。
const VERSION_TWENTY_FOUR_SOURCE_DEFINITION_FIELDS = Object.freeze([
  'schemaVersion',
  'id',
  'name',
  'description',
  'sourceKind',
  'version',
  'providerKey',
  'packageRef',
  'importMethod',
  'remoteUrl',
  'importedAt',
  'lastUpdatedAt',
  'capabilities',
  'settingsSchema'
]);

// 类型: string；作用: 冻结紧邻上一版 Definition 保存版本，避免形状相同但来源未知的记录被误迁移。
const VERSION_TWENTY_FOUR_SOURCE_DEFINITION_SCHEMA_VERSION = '1.0.0';

/**
 * 判断 SourceDefinition 是否使用指定精确字段集合。
 * 纯函数: 只读取普通对象自有键，不修改候选或字段配置。
 * 成功路径: 字段数量和成员完全一致时返回 true，属性声明顺序不影响结果。
 * 失败路径: 非普通对象由 assertPlainObject 抛校验错误，未知或缺失字段返回 false。
 *
 * @param {*} value SourceDefinition 候选。
 * @param {Array<string>} fields 允许的精确字段集合。
 * @returns {boolean} true 表示字段集合精确一致，false 表示字段版本不同或损坏。
 */
function hasExactSourceDefinitionFields(value, fields) {
  assertPlainObject(value, 'sourceDefinition');
  // 类型: Array<string|symbol>；作用: 同时检查可枚举字符串键和 Symbol，阻止隐藏扩展绕过迁移边界。
  const actualFields = Reflect.ownKeys(value);
  return actualFields.length === fields.length
    && fields.every(field => Object.hasOwn(value, field));
}

/**
 * 校验数据库连续迁移期间读取的历史或当前 SourceDefinition。
 * 纯函数: 不修改历史 Definition；旧形状只通过临时当前候选复用正式字段校验。
 * 成功路径: 当前 1.1.0 Definition 直接通过正式校验；精确 v24 1.0.0 Definition 在补入确定缺省值后通过同一校验。
 * 失败路径: 旧版本错误、字段损坏、署名 URL 非法或其他领域字段无效时抛错并中止 upgrade transaction。
 * 维护边界: 只供 IndexedDB 历史迁移使用，Repository 和普通初始化入口仍只接受当前 Definition。
 *
 * @param {object} sourceDefinition 数据库读取的 SourceDefinition。
 * @param {string} fieldName 错误定位字段名。
 * @returns {object} 原始已验证 Definition，调用方可以原样保留旧记录。
 */
function validateMigrationSourceDefinition(sourceDefinition, fieldName) {
  // 条件分支: 候选使用 v24 精确旧字段时进入；执行内容: 复核旧版本并构造只用于验证的当前候选。
  if (hasExactSourceDefinitionFields(
    sourceDefinition,
    VERSION_TWENTY_FOUR_SOURCE_DEFINITION_FIELDS
  )) {
    // 条件分支: 精确旧字段对象没有声明紧邻上一版 Definition 版本时进入。
    // 执行内容: 中止完整 upgrade transaction，不能猜测未知结构与 v24 等价。
    if (sourceDefinition.schemaVersion !== VERSION_TWENTY_FOUR_SOURCE_DEFINITION_SCHEMA_VERSION) {
      throw new BrowserPersistenceError(
        BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed,
        `${fieldName}.schemaVersion 不是受支持的 v24 Definition 版本`
      );
    }
    validateSourceDefinition({
      ...sourceDefinition,
      schemaVersion: SOURCE_DEFINITION_SCHEMA_VERSION,
      authorName: SOURCE_ATTRIBUTION_POLICY.anonymousAuthorName,
      siteUrl: SOURCE_ATTRIBUTION_POLICY.emptySiteUrl
    });
    return sourceDefinition;
  }

  // 返回值类型: object；作用: 当前形状必须通过正式 Repository 校验，未知第三种结构不会进入兼容链。
  validateSourceDefinition(sourceDefinition);
  return sourceDefinition;
}

// 类型: Array<Readonly<object>>；作用: 以连续整数版本绑定唯一迁移函数，缺少任一步时数据库升级失败关闭。
const DATABASE_MIGRATIONS = Object.freeze([
  Object.freeze({
    // 类型: number；作用: 新数据库和历史 v0 进入正式九仓结构的第一步。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.initial,
    // 类型: Function；作用: 在 upgrade transaction 中创建初始 schema 和版本事实。
    migrate: createInitialSchema
  }),
  Object.freeze({
    // 类型: number；作用: 已有 v1 数据库进入可诊断生命周期元信息边界。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.lifecycleMetadata,
    // 类型: Function；作用: 先复核历史 schema，再更新当前版本事实而不改写业务数据。
    migrate: applyLifecycleMetadataMigration
  }),
  Object.freeze({
    // 类型: number；作用: 已有 v2 保存图进入当前真实系统源产品目录。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceCatalog,
    // 类型: Function；作用: 在唯一 upgrade transaction 中完成系统源替换与悬空用户引用清理。
    migrate: applyBuiltinSourceCatalogMigration
  }),
  Object.freeze({
    // 类型: number；作用: 已有 v3 保存图采用当前受审内置目录发布。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRefresh,
    // 类型: Function；作用: 在唯一 upgrade transaction 中同步脚本、定义与授权，同时保留用户决定和运行数据。
    migrate: applyBuiltinSourceRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v4 的真实开发库重新对账当前应用拥有的系统源。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceReconciliation,
    // 类型: Function；作用: 为已提交 v4 的历史库原子修复缺失或陈旧系统记录。
    migrate: applyBuiltinSourceReconciliationMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v5 的浏览器库采用 MJWO 1.0.3 和当前四源完整授权事实。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceChallengeRefresh,
    // 类型: Function；作用: 复用唯一系统源对账器原子刷新脚本、Definition 和授权，不清理用户运行数据。
    migrate: applyBuiltinSourceChallengeRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v6 的浏览器库采用当前 MJWO 验证响应判定和完整授权事实。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceVerificationRefresh,
    // 类型: Function；作用: 复用唯一系统源对账器原子刷新脚本、Definition 和授权，不清理用户运行数据。
    migrate: applyBuiltinSourceVerificationRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v7 的浏览器库采用当前 MJWO 完整搜索表单 URL 和完整授权事实。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchTransactionRefresh,
    // 类型: Function；作用: 复用唯一系统源对账器原子刷新脚本、Definition 和授权，不清理用户运行数据。
    migrate: applyBuiltinSourceSearchTransactionRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v8 的浏览器库原子采用四条 Provider ABI 2.0 单文件。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.providerApiVersion2Refresh,
    // 类型: Function；作用: 复用唯一系统源对账器刷新应用系统事实，保留用户决定、私有空间、自定义源和用户内容。
    migrate: applyProviderApiVersion2RefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v9 的浏览器库原子采用当前内置 Provider 请求语义。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRequestPolicyRefresh,
    // 类型: Function；作用: 复用唯一系统源对账器发布当前脚本、Definition 和授权，不解释站点请求规则。
    migrate: applyBuiltinSourceRequestPolicyRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v10 的浏览器库原子补齐项目快捷键偏好。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.userShortcutPreferencesRefresh,
    // 类型: Function；作用: 只迁移 userSettings 行并提交 v11 事实，不触碰数据源和用户内容集合。
    migrate: applyUserShortcutPreferencesRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v11 的浏览器库原子补齐首页展示偏好。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.homeDisplayPreferencesRefresh,
    // 类型: Function；作用: 只迁移 userSettings 行并提交 v12 事实，不触碰数据源和用户内容集合。
    migrate: applyHomeDisplayPreferencesRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v12 的浏览器库原子采用当前系统源纯名称与同源发布事实。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceDisplayNameRefresh,
    // 类型: Function；作用: 复用唯一系统源对账器发布脚本、Definition 和授权，不解释站点名称。
    migrate: applyBuiltinSourceDisplayNameRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v13 的浏览器库原子采用四条内置 Provider 首页逻辑分页脚本。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceLogicalPaginationRefresh,
    // 类型: Function；作用: 复用唯一系统源对账器发布当前脚本、Definition 和授权，保留用户保存域。
    migrate: applyBuiltinSourceLogicalPaginationRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v14 的浏览器库原子采用当前内置 Provider 首页区域映射脚本。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceHomeMappingRefresh,
    // 类型: Function；作用: 复用唯一系统源对账器发布当前脚本、Definition 和授权，不解释站点板块。
    migrate: applyBuiltinSourceHomeMappingRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v15 的浏览器库原子采用当前内置 Provider 电影目录筛选、双区域内容和真实分页脚本。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceMovieCatalogRefresh,
    // 类型: Function；作用: 复用唯一系统源对账器发布当前脚本、Definition 和授权，不解释站点筛选、卡片或分页。
    migrate: applyBuiltinSourceMovieCatalogRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v16 的浏览器库原子采用当前内置 Provider 电视剧目录筛选、双区域内容和真实分页脚本。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceTvCatalogRefresh,
    // 类型: Function；作用: 复用唯一系统源对账器发布当前脚本、Definition 和授权，不解释站点筛选、卡片或分页。
    migrate: applyBuiltinSourceTvCatalogRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v17 的浏览器库原子采用当前内置 Provider 搜索真实分页和平台逻辑页脚本。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchPaginationRefresh,
    // 类型: Function；作用: 复用唯一系统源对账器发布当前脚本、Definition 和授权，不解释站点搜索路径、HTML 或分页批次。
    migrate: applyBuiltinSourceSearchPaginationRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v18 的浏览器库原子采用当前内置 Provider 详情字段和权威播放列表脚本。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceDetailMappingRefresh,
    // 类型: Function；作用: 复用唯一系统源对账器发布当前脚本、Definition 和授权，不解释详情 HTML 或播放列表。
    migrate: applyBuiltinSourceDetailMappingRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v19 的浏览器库原子删除产品明确退役的系统源及关联本地数据。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRetirement,
    // 类型: Function；作用: 按冻结身份清理 Source 保存图和私有空间，收藏与播放历史作为用户资产保留。
    migrate: applyBuiltinSourceRetirementMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v20 的浏览器库原子采用当前内置 Provider 完整卡片字段脚本。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceCardMetadataRefresh,
    // 类型: Function；作用: 复用唯一系统源对账器发布当前脚本、Definition 和授权，不解释站点卡片字段。
    migrate: applyBuiltinSourceCardMetadataRefreshMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v21 的浏览器库原子采用当前内置 Provider 搜索行独立元信息解析修复。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchMetadataRepair,
    // 类型: Function；作用: 复用唯一系统源对账器发布当前脚本、Definition 和授权，不解释站点搜索 HTML 或字段。
    migrate: applyBuiltinSourceSearchMetadataRepairMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v22 的浏览器库原子采用当前内置 Provider 详情状态结构边界修复。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceDetailStatusRepair,
    // 类型: Function；作用: 复用唯一系统源对账器发布当前脚本、Definition 和授权，不解释站点详情 HTML 或状态文案。
    migrate: applyBuiltinSourceDetailStatusRepairMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v23 的收藏和历史进入完整卡片快照保存形状。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.userContentSnapshots,
    // 类型: Function；作用: 原子保留全部用户记录并补齐 contentSnapshot 和 episodeLocator 字段。
    migrate: applyUserContentSnapshotsMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v24 的 Definition 进入完整脚本署名保存形状。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.sourceAttribution,
    // 类型: Function；作用: 原子补齐作者、原站地址和独立 Definition 结构版本，不触碰其他保存域。
    migrate: applySourceAttributionMigration
  }),
  Object.freeze({
    // 类型: number；作用: 让已经提交 v25 的公开版数据库移除旧模拟系统源并采用当前真实 Provider 目录。
    version: BROWSER_PERSISTENCE_SCHEMA_VERSION.publicBuiltinSourceReplacement,
    // 类型: Function；作用: 原子清理旧模拟源的系统保存图和私有空间，收藏与播放历史继续保留。
    migrate: applyPublicBuiltinSourceReplacementMigration
  })
]);

/**
 * 校验精确普通对象字段。
 * 纯函数: 不修改输入；缺失、额外字段、数组和复杂实例均失败关闭。
 *
 * @param {*} value 待校验对象。
 * @param {Array<string>} expectedFields 允许且必须存在的字段。
 * @param {string} fieldName 错误路径名称。
 * @returns {object} 原始已验证普通对象。
 * @throws {TypeError} 当对象形状偏离当前边界时抛出。
 */
function assertExactPlainObject(value, expectedFields, fieldName) {
  assertPlainObject(value, fieldName);

  // 类型: Array<string>；作用: 比较真实字段集合，阻止初始化静默忽略影子配置。
  const actualFields = Object.keys(value);
  // 条件分支: 字段数量或名称不等于冻结集合时进入。
  // 执行内容: 在打开数据库和创建事务前拒绝不完整输入。
  if (actualFields.length !== expectedFields.length
    || actualFields.some(field => !expectedFields.includes(field))) {
    throw new TypeError(`${fieldName} 字段必须是: ${expectedFields.join(', ')}`);
  }

  return value;
}

/**
 * 标准化数据库构造选项。
 * 纯函数: 不修改输入，只返回冻结名称与版本。
 *
 * @param {object} options 数据库构造配置。
 * @returns {Readonly<object>} 已验证数据库名称和正整数版本。
 */
function normalizeDatabaseOptions(options) {
  assertExactPlainObject(options, DATABASE_OPTION_FIELDS, 'browserPersistenceDatabase.options');

  // 条件分支: 名称为空或版本不是正整数时进入。
  // 执行内容: 拒绝创建无法稳定升级或与正式数据库混淆的连接。
  if (typeof options.databaseName !== 'string' || !options.databaseName.trim()) {
    throw new TypeError('browserPersistenceDatabase.databaseName 必须是非空字符串');
  }
  // 条件分支: schema 版本不是正整数时进入。
  // 执行内容: 拒绝 IndexedDB 无法接受或不能表达连续迁移的版本。
  if (!Number.isInteger(options.databaseVersion) || options.databaseVersion <= 0) {
    throw new TypeError('browserPersistenceDatabase.databaseVersion 必须是正整数');
  }

  return Object.freeze({
    databaseName: options.databaseName,
    databaseVersion: options.databaseVersion
  });
}

/**
 * 校验并隔离数据源首次种子。
 * 纯函数: 不修改输入；复用 Repository 领域校验并检查五分区完整性。
 *
 * @param {object} sourceSeeds 四类分离数据源种子。
 * @returns {object} 可安全写入 IndexedDB 的隔离种子。
 */
function normalizeSourceSeeds(sourceSeeds) {
  assertExactPlainObject(sourceSeeds, SOURCE_SEED_FIELDS, 'sourceSeeds');
  // 类型: object；作用: 一次深拷贝全部输入，后续异步事务不受调用方修改影响。
  const safeSeeds = cloneSerializableValue(sourceSeeds, 'sourceSeeds');

  // 条件分支: Package 或 Definition 集合不是数组时进入。
  // 执行内容: 拒绝无法保持集合顺序、重复检测和逐项领域校验的结构。
  if (!Array.isArray(safeSeeds.packages) || !Array.isArray(safeSeeds.definitions)) {
    throw new TypeError('sourceSeeds.packages 和 definitions 必须是数组');
  }

  // 循环作用: 让首次种子与运行时 Repository save 使用同一 Package 精确字段契约。
  safeSeeds.packages.forEach(sourcePackage => validateSourcePackage(sourcePackage));
  // 循环作用: 让首次种子与运行时 Repository saveDefinition 使用同一 Definition 契约。
  safeSeeds.definitions.forEach(sourceDefinition => validateSourceDefinition(sourceDefinition));
  validateSourcePreferences(safeSeeds.preferences);
  assertPlainObject(safeSeeds.storageNamespaces, 'sourceSeeds.storageNamespaces');

  // 循环作用: 校验每个动态 sourceId 和完整五分区，避免种子阶段创建不完整命名空间。
  Object.entries(safeSeeds.storageNamespaces).forEach(([sourceId, namespace]) => {
    assertSafeRecordKey(sourceId, 'sourceSeeds.storageNamespaces sourceId');
    assertExactPlainObject(namespace, SOURCE_STORAGE_PARTITION_NAMES, `storageNamespaces.${sourceId}`);
    // 循环作用: 每个分区必须是键值普通对象，动态 storage key 统一执行原型安全校验。
    SOURCE_STORAGE_PARTITION_NAMES.forEach((partition) => {
      assertPlainObject(namespace[partition], `storageNamespaces.${sourceId}.${partition}`);
      Object.keys(namespace[partition]).forEach((storageKey) => {
        assertSafeRecordKey(storageKey, `storageNamespaces.${sourceId}.${partition} key`);
      });
    });
  });

  return safeSeeds;
}

/**
 * 校验并隔离用户内容首次种子。
 * 纯函数: 当前步骤只冻结数据库写入形态；完整记录字段由后续 UserContentRepository 校验器负责。
 *
 * @param {object} userContentSeed UserContentState 首次游客种子。
 * @returns {object} 排除长期 currentPlaying 的隔离种子。
 */
function normalizeUserContentSeed(userContentSeed) {
  assertExactPlainObject(userContentSeed, USER_CONTENT_SEED_FIELDS, 'userContentSeed');
  // 类型: object；作用: 隔离用户内容首次种子，避免异步事务期间被调用方修改。
  const safeSeed = cloneSerializableValue(userContentSeed, 'userContentSeed');
  assertPlainObject(safeSeed.user, 'userContentSeed.user');
  assertSafeRecordKey(safeSeed.user.id, 'userContentSeed.user.id');
  assertPlainObject(safeSeed.favorites, 'userContentSeed.favorites');
  assertPlainObject(safeSeed.playHistory, 'userContentSeed.playHistory');
  assertPlainObject(safeSeed.resumePolicy, 'userContentSeed.resumePolicy');

  // 条件分支: 收藏或播放历史 records 不是数组时进入。
  // 执行内容: 拒绝无法展开为复合主键记录的用户内容集合。
  if (!Array.isArray(safeSeed.favorites.records)
    || !Array.isArray(safeSeed.playHistory.records)) {
    throw new TypeError('userContentSeed 收藏和历史 records 必须是数组');
  }
  // 条件分支: 首次种子携带 currentPlaying 时进入。
  // 执行内容: 拒绝把播放会话写入长期数据库，不通过删除字段掩盖调用方偏离。
  if (safeSeed.currentPlaying !== null) {
    throw new TypeError('userContentSeed.currentPlaying 必须是 null');
  }

  return safeSeed;
}

/**
 * 校验迁移允许处理的精确 sourceId 集合。
 * 纯函数: 返回冻结副本，不修改调用方数组，也不根据名称或来源类型推断身份。
 * 成功路径: 非空、无重复且全部通过动态键安全校验时返回。
 * 失败路径: 集合缺失、包含重复或非法 id 时抛 TypeError，数据库尚未打开。
 *
 * @param {*} sourceIds 产品种子模块冻结的迁移身份数组。
 * @param {string} fieldName 初始化字段路径，用于稳定错误定位。
 * @returns {ReadonlyArray<string>} 可交给迁移器精确匹配的冻结副本。
 * @throws {TypeError} 当身份集合不能作为精确迁移输入时抛出。
 */
function normalizeRequiredSourceIdList(sourceIds, fieldName) {
  // 条件分支: 调用方没有提供非空数组时进入。
  // 执行内容: 禁止迁移通过名称模糊删除，或在缺少身份边界时静默跳过目标记录。
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    throw new TypeError(`${fieldName} 必须是非空数组`);
  }

  // 类型: Array<string>；作用: 逐项复核安全动态键并切断调用方数组引用。
  const normalizedSourceIds = sourceIds.map((sourceId, sourceIndex) => {
    return assertSafeRecordKey(sourceId, `${fieldName}[${sourceIndex}]`);
  });
  // 条件分支: 同一旧身份重复出现时进入。
  // 执行内容: 拒绝让迁移删除次数和默认源判断依赖重复输入。
  if (new Set(normalizedSourceIds).size !== normalizedSourceIds.length) {
    throw new TypeError(`${fieldName} 不能重复`);
  }
  return Object.freeze(normalizedSourceIds);
}

/**
 * 校验并隔离内置目录发布身份。
 * 纯函数: 不读取数据库或修改调用方对象，返回只包含四个正式字段的冻结副本。
 * 成功路径: 当前发布和数据库历史记录都通过同一结构、revision、version 与 SHA-256 规则。
 * 失败路径: 字段缺失、revision 不能单调比较或 fingerprint 非法时抛 TypeError，调用方不得猜测目录新旧。
 *
 * @param {*} release 当前应用或 appMeta 读取的目录发布身份。
 * @param {string} fieldName 错误路径，区分初始化输入和数据库历史记录。
 * @returns {Readonly<object>} 可安全跨异步事务比较和保存的发布身份。
 * @throws {TypeError} 当发布身份不能作为确定性对账依据时抛出。
 */
function normalizeBuiltinCatalogRelease(release, fieldName) {
  assertExactPlainObject(release, BUILTIN_CATALOG_RELEASE_FIELDS, fieldName);
  // 条件分支: 发布身份结构版本为空时进入；执行内容: 拒绝无法解释字段语义的元信息。
  if (typeof release.schemaVersion !== 'string' || !release.schemaVersion.trim()) {
    throw new TypeError(`${fieldName}.schemaVersion 必须是非空字符串`);
  }
  // 条件分支: revision 不是非负整数时进入；执行内容: 阻止浮点数、负数和字符串参与升级或降级判断，0 保留给首个历史基线。
  if (!Number.isSafeInteger(release.revision) || release.revision < 0) {
    throw new TypeError(`${fieldName}.revision 必须是非负安全整数`);
  }
  // 条件分支: 可读版本为空时进入；执行内容: 保证诊断记录能够明确指向产品目录发布。
  if (typeof release.version !== 'string' || !release.version.trim()) {
    throw new TypeError(`${fieldName}.version 必须是非空字符串`);
  }
  // 条件分支: fingerprint 不是规范 SHA-256 时进入；执行内容: 禁止同 revision 内容冲突检查退化为普通文本比较。
  if (typeof release.fingerprint !== 'string'
    || !BUILTIN_CATALOG_FINGERPRINT_PATTERN.test(release.fingerprint)) {
    throw new TypeError(`${fieldName}.fingerprint 必须是 64 位小写 SHA-256`);
  }

  return Object.freeze({
    schemaVersion: release.schemaVersion,
    revision: release.revision,
    version: release.version,
    fingerprint: release.fingerprint
  });
}

/**
 * 标准化数据库初始化输入。
 * 纯函数: 完成所有种子隔离和版本校验后返回冻结对象。
 *
 * @param {object} options 初始化输入。
 * @returns {Readonly<object>} 可跨异步打开与事务使用的初始化数据。
 */
function normalizeInitializationOptions(options) {
  assertExactPlainObject(options, INITIALIZATION_OPTION_FIELDS, 'browserPersistence.initialize');

  return Object.freeze({
    sourceSeeds: normalizeSourceSeeds(options.sourceSeeds),
    userContentSeed: normalizeUserContentSeed(options.userContentSeed),
    builtinCatalogRelease: normalizeBuiltinCatalogRelease(
      options.builtinCatalogRelease,
      'browserPersistence.builtinCatalogRelease'
    ),
    legacyProductSourceIds: normalizeRequiredSourceIdList(
      options.legacyProductSourceIds,
      'browserPersistence.legacyProductSourceIds'
    ),
    retiredBuiltinSourceIds: normalizeRequiredSourceIdList(
      options.retiredBuiltinSourceIds,
      'browserPersistence.retiredBuiltinSourceIds'
    ),
    replacedPublicBuiltinSourceIds: normalizeRequiredSourceIdList(
      options.replacedPublicBuiltinSourceIds,
      'browserPersistence.replacedPublicBuiltinSourceIds'
    )
  });
}

/**
 * 校验事务 store 集合。
 * 纯函数: 返回冻结副本，不允许空集合、重复名称或非正式 store。
 *
 * @param {Array<string>} storeNames 调用方需要访问的 store 名称。
 * @returns {ReadonlyArray<string>} 已验证 store 稳定顺序副本。
 */
function normalizeStoreNames(storeNames) {
  // 条件分支: storeNames 不是非空数组时进入。
  // 执行内容: 拒绝无事务范围或无法稳定迭代的输入。
  if (!Array.isArray(storeNames) || storeNames.length === 0) {
    throw new TypeError('browserPersistence storeNames 必须是非空数组');
  }
  // 条件分支: store 名称重复或不属于正式九仓时进入。
  // 执行内容: 阻止调用方扩大数据库保存域或用重复名称掩盖事务范围。
  if (new Set(storeNames).size !== storeNames.length
    || storeNames.some(storeName => !BROWSER_PERSISTENCE_ALL_STORE_NAMES.includes(storeName))) {
    throw new TypeError('browserPersistence storeNames 包含重复或未定义 store');
  }
  return Object.freeze([...storeNames]);
}

/**
 * 创建第一版数据库 schema。
 * 副作用: 只在 v0 -> v1 upgrade transaction 中创建九仓、四个索引和 schemaVersion 事实。
 * 失败路径: 任一 store、索引或元信息请求失败时由原生 upgrade transaction 回滚。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的新版本数据库代理。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @returns {void}
 */
function createInitialSchema(database, transaction) {
  database.createObjectStore(BROWSER_PERSISTENCE_STORE.appMeta, { keyPath: 'key' });
  database.createObjectStore(BROWSER_PERSISTENCE_STORE.sourcePackages, { keyPath: 'packageRef' });
  database.createObjectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions, { keyPath: 'id' });
  database.createObjectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences, { keyPath: 'key' });

  // 类型: IDBObjectStore；作用: 创建私有空间复合主键 store，并在同一 schema 迁移中建立两个查询索引。
  const sourceStorageStore = database.createObjectStore(
    BROWSER_PERSISTENCE_STORE.sourceStorageEntries,
    { keyPath: ['sourceId', 'partition', 'key'] }
  );
  sourceStorageStore.createIndex(
    BROWSER_PERSISTENCE_INDEX.sourceStorageBySourceId,
    'sourceId'
  );
  sourceStorageStore.createIndex(
    BROWSER_PERSISTENCE_INDEX.sourceStorageBySourcePartition,
    ['sourceId', 'partition']
  );

  database.createObjectStore(BROWSER_PERSISTENCE_STORE.userProfiles, { keyPath: 'id' });
  // 类型: IDBObjectStore；作用: 创建收藏复合主键和按用户查询索引。
  const userFavoritesStore = database.createObjectStore(
    BROWSER_PERSISTENCE_STORE.userFavorites,
    { keyPath: ['userId', 'favoriteKey'] }
  );
  userFavoritesStore.createIndex(BROWSER_PERSISTENCE_INDEX.userFavoritesByUserId, 'userId');
  // 类型: IDBObjectStore；作用: 创建历史复合主键和按用户查询索引。
  const userHistoryStore = database.createObjectStore(
    BROWSER_PERSISTENCE_STORE.userPlayHistory,
    { keyPath: ['userId', 'historyKey'] }
  );
  userHistoryStore.createIndex(BROWSER_PERSISTENCE_INDEX.userPlayHistoryByUserId, 'userId');
  database.createObjectStore(BROWSER_PERSISTENCE_STORE.userSettings, { keyPath: 'userId' });

  // 副作用: 在同一 upgrade transaction 写入当前已完成迁移版本，失败时与全部 schema 创建一起回滚。
  transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta).put({
    key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
    value: BROWSER_PERSISTENCE_SCHEMA_VERSION.initial
  });
}

/**
 * 执行第二版生命周期元信息迁移。
 * 副作用: 不改写业务 store，只在确认 v1 九仓和索引完整后更新 appMeta.schemaVersion。
 * 失败路径: 历史 schema 缺仓或缺索引时抛 migrationFailed，使浏览器保留原数据库版本和数据。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的目标数据库代理。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @returns {void}
 * @throws {BrowserPersistenceError} 当历史 schema 不满足 v1 契约时抛出。
 */
function applyLifecycleMetadataMigration(database, transaction) {
  // 类型: Array<string>；作用: 找出历史数据库缺失的正式 store，空数组表示九仓完整。
  const missingStoreNames = BROWSER_PERSISTENCE_ALL_STORE_NAMES.filter((storeName) => {
    return !database.objectStoreNames.contains(storeName);
  });
  // 条件分支: 历史 v1 缺少任一正式 store 时进入。
  // 执行内容: 中止迁移，不用补建空仓掩盖旧数据结构损坏。
  if (missingStoreNames.length > 0) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed,
      `历史数据库缺少 object store: ${missingStoreNames.join(', ')}`
    );
  }

  // 类型: IDBObjectStore；作用: 复核历史私有空间 store 的两个正式查询索引。
  const sourceStorageStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries);
  // 类型: Array<string>；作用: 找出私有空间缺失索引，避免升级后 Repository 查询到不完整能力。
  const missingSourceStorageIndexes = [
    BROWSER_PERSISTENCE_INDEX.sourceStorageBySourceId,
    BROWSER_PERSISTENCE_INDEX.sourceStorageBySourcePartition
  ].filter(indexName => !sourceStorageStore.indexNames.contains(indexName));
  // 类型: IDBObjectStore；作用: 复核收藏按 userId 查询索引。
  const userFavoritesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites);
  // 类型: IDBObjectStore；作用: 复核播放历史按 userId 查询索引。
  const userHistoryStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory);
  // 条件分支: 任一历史索引缺失时进入。
  // 执行内容: 失败关闭，禁止用运行时全表扫描兼容损坏 schema。
  if (missingSourceStorageIndexes.length > 0
    || !userFavoritesStore.indexNames.contains(BROWSER_PERSISTENCE_INDEX.userFavoritesByUserId)
    || !userHistoryStore.indexNames.contains(BROWSER_PERSISTENCE_INDEX.userPlayHistoryByUserId)) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed,
      '历史数据库缺少正式查询索引'
    );
  }

  // 副作用: 只在完整历史 schema 上推进版本事实；业务记录保持原主键和值。
  transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta).put({
    key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
    value: BROWSER_PERSISTENCE_SCHEMA_VERSION.lifecycleMetadata
  });
}

/**
 * 把已有 v2 产品模拟保存图原子迁移为当前真实系统源目录。
 * 副作用: 只使用当前 upgrade transaction 读写 Source 四仓、收藏、历史和 appMeta；不触碰用户资料与恢复策略。
 * 成功路径: 新空库只推进 schema 事实并交给首次种子；已初始化库精确替换目标保存图、交接失效默认源并清理旧源悬空引用。
 * 失败路径: 历史偏好缺失、保存对象损坏或任一请求失败时 reject，调用方中止整个 upgrade transaction 并保留 v2。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的目标数据库代理。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @param {object} context.sourceSeeds 当前真实系统源 Package、Definition、Preferences 和 Storage 保存图。
 * @param {object} context.builtinCatalogRelease 当前产品内置目录发布身份。
 * @param {ReadonlyArray<string>} context.legacyProductSourceIds 精确旧模拟身份集合。
 * @returns {Promise<void>} 全部迁移请求已进入并完成当前事务时结束。
 * @throws {BrowserPersistenceError} 当历史保存图无法满足原子迁移前置条件时抛出。
 */
async function applyBuiltinSourceCatalogMigration(database, transaction, context) {
  // 类型: IDBObjectStore；作用: 读取初始化事实并在成功末尾推进 schema 与种子版本。
  const metaStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta);
  // 类型: object|undefined；作用: 区分全新数据库和已经完成首次种子的 v2 数据库。
  const initializedRecord = await metaStore.get(BROWSER_PERSISTENCE_META_KEY.initialized);

  // 条件分支: v0 新库连续创建到 v3 且尚未执行首次种子时进入。
  // 执行内容: 只推进 schema 事实；四源和空用户内容随后由唯一九仓首次种子事务写入。
  if (initializedRecord === undefined) {
    await metaStore.put({
      key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
      value: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceCatalog
    });
    return;
  }
  // 条件分支: initialized 存在但不是严格 true 时进入。
  // 执行内容: 视为历史元信息损坏，不把部分数据库当作可迁移保存图。
  if (initializedRecord.value !== true) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed,
      '历史数据库初始化元信息无效'
    );
  }

  // 类型: IDBObjectStore；作用: 删除目标 Package 并写入四条真实完整脚本包。
  const packageStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages);
  // 类型: IDBObjectStore；作用: 删除目标 Definition 并写入四条真实静态定义。
  const definitionStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions);
  // 类型: IDBObjectStore；作用: 读取并一次覆盖全局 SourcePreferences。
  const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
  // 类型: IDBObjectStore；作用: 删除目标命名空间并写入四源初始分区值。
  const storageStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries);
  // 类型: IDBObjectStore；作用: 删除 sourceId 精确命中旧模拟集合的收藏记录。
  const favoritesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites);
  // 类型: IDBObjectStore；作用: 删除 sourceId 精确命中旧模拟集合的播放历史记录。
  const historyStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory);

  // 类型: Array<Array<object>|object|undefined>；作用: 在写入前并发读取六仓历史快照，任一请求失败会中止同一 upgrade transaction。
  const [packages, definitions, preferencesRecord, storageEntries, favorites, playHistory] = await Promise.all([
    packageStore.getAll(),
    definitionStore.getAll(),
    preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY),
    storageStore.getAll(),
    favoritesStore.getAll(),
    historyStore.getAll()
  ]);

  // 条件分支: 已初始化 v2 库缺少全局偏好时进入。
  // 执行内容: 拒绝猜测启用、授权、隐藏与默认源决定。
  if (!preferencesRecord || preferencesRecord.key !== SOURCE_PREFERENCES_RECORD_KEY) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed,
      '历史数据库缺少数据源偏好'
    );
  }
  validateSourcePreferences(preferencesRecord.value);

  // 类型: Set<string>；作用: 精确识别允许退役的九个旧产品模拟身份。
  const legacySourceIds = new Set(context.legacyProductSourceIds);
  // 类型: Set<string>；作用: 识别四条真实系统身份，用受审目录覆盖可能存在的同 id 自定义保存图。
  const builtinSourceIds = new Set(context.sourceSeeds.definitions.map(definition => definition.id));
  // 类型: Set<string>；作用: 合并需要清理旧 Package、Definition、Preferences state 和 Storage 的目标身份。
  const replacedSourceIds = new Set([...legacySourceIds, ...builtinSourceIds]);

  // 类型: Array<object>；作用: 保留与迁移目标无关的 Definition，供默认源有效性判断。
  const preservedDefinitions = definitions.filter((definition) => {
    validateMigrationSourceDefinition(definition, 'browserPersistence.v3.definition');
    return !replacedSourceIds.has(definition.id);
  });
  // 类型: Array<Promise<*>>；作用: 复核历史 Package 结构，并按其真实 sourceId 精确删除目标脚本包。
  const packageDeletes = packages.map((sourcePackage) => {
    validateSourcePackage(sourcePackage);
    return replacedSourceIds.has(sourcePackage.sourceId)
      ? packageStore.delete(sourcePackage.packageRef)
      : Promise.resolve();
  });
  // 类型: Array<Promise<*>>；作用: 按 Definition 主键删除旧模拟与四源同 id 冲突，不影响保留自定义定义。
  const definitionDeletes = definitions
    .filter(definition => replacedSourceIds.has(definition.id))
    .map(definition => definitionStore.delete(definition.id));
  // 类型: Array<Promise<*>>；作用: 删除目标 sourceId 全部真实 Storage 条目，空分区不依赖占位记录。
  const storageDeletes = storageEntries
    .filter(entry => replacedSourceIds.has(entry.sourceId))
    .map(entry => storageStore.delete([entry.sourceId, entry.partition, entry.key]));
  // 类型: Array<Promise<*>>；作用: 只删除引用九个旧模拟身份的收藏，不按标题、内容 id 或时间猜测。
  const favoriteDeletes = favorites
    .filter(record => legacySourceIds.has(record.sourceId))
    .map(record => favoritesStore.delete([record.userId, record.favoriteKey]));
  // 类型: Array<Promise<*>>；作用: 只删除引用九个旧模拟身份的历史，四源新身份和无关自定义记录继续保留。
  const historyDeletes = playHistory
    .filter(record => legacySourceIds.has(record.sourceId))
    .map(record => historyStore.delete([record.userId, record.historyKey]));

  // 类型: object；作用: 从历史偏好隔离复制后移除目标 state，再采用四源当前系统授权与启用事实。
  const nextPreferences = cloneSerializableValue(
    preferencesRecord.value,
    'browserPersistence.v3.preferences'
  );
  replacedSourceIds.forEach((sourceId) => {
    // 赋值副作用: 只修改迁移候选偏好，不写入原历史对象。
    delete nextPreferences.sourceStates[sourceId];
  });
  Object.entries(context.sourceSeeds.preferences.sourceStates).forEach(([sourceId, sourceState]) => {
    // 赋值副作用: 四源状态使用同一产品种子隔离副本，版本与脚本哈希保持一致。
    nextPreferences.sourceStates[sourceId] = cloneSerializableValue(
      sourceState,
      `browserPersistence.v3.sourceStates.${sourceId}`
    );
  });
  // 类型: Set<string>；作用: 保留无关系统源软隐藏决定，并保证新四源不会继承旧隐藏状态。
  const nextRemovedSystemSourceIds = new Set(
    nextPreferences.removedSystemSourceIds.filter(sourceId => !replacedSourceIds.has(sourceId))
  );
  nextPreferences.removedSystemSourceIds = [...nextRemovedSystemSourceIds];

  // 类型: Set<string>；作用: 默认源只能保留在未被替换的 Definition 或新四源身份中。
  const validDefaultSourceIds = new Set([
    ...preservedDefinitions.map(definition => definition.id),
    ...builtinSourceIds
  ]);
  // 条件分支: 旧默认源属于退役模拟身份、为空或已经没有 Definition 时进入。
  // 执行内容: 交接到产品目录第一条真实系统源；保留的自定义默认源不被擅自修改。
  if (legacySourceIds.has(nextPreferences.defaultSourceId)
    || !validDefaultSourceIds.has(nextPreferences.defaultSourceId)) {
    nextPreferences.defaultSourceId = context.sourceSeeds.preferences.defaultSourceId;
  }
  validateSourcePreferences(nextPreferences);

  // 写入顺序: 先清除目标保存图，再写入同一受审四源目录；所有请求仍属于唯一 upgrade transaction。
  await Promise.all([
    ...packageDeletes,
    ...definitionDeletes,
    ...storageDeletes,
    ...favoriteDeletes,
    ...historyDeletes
  ]);
  await Promise.all(context.sourceSeeds.packages.map(sourcePackage => packageStore.put(sourcePackage)));
  await Promise.all(context.sourceSeeds.definitions.map(sourceDefinition => definitionStore.put(sourceDefinition)));

  // 类型: Array<Promise<IDBValidKey>>；作用: 展开四源五分区中真实存在的种子键，空分区不制造占位行。
  const storageWrites = [];
  Object.entries(context.sourceSeeds.storageNamespaces).forEach(([sourceId, namespace]) => {
    SOURCE_STORAGE_PARTITION_NAMES.forEach((partition) => {
      Object.entries(namespace[partition]).forEach(([key, value]) => {
        storageWrites.push(storageStore.put({ sourceId, partition, key, value }));
      });
    });
  });
  await Promise.all(storageWrites);
  await preferencesStore.put({ key: SOURCE_PREFERENCES_RECORD_KEY, value: nextPreferences });
  await metaStore.put({
    key: BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease,
    value: context.builtinCatalogRelease
  });
  // 清理副作用: v23 及更早版本使用的 seedVersion 不再参与运行判断，随当前原子提交移除第二权威。
  await metaStore.delete(BROWSER_PERSISTENCE_META_KEY.legacySeedVersion);
  await metaStore.put({
    key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
    value: BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceCatalog
  });
}

/**
 * 幂等对账应用当前拥有的系统源保存事实。
 * 副作用: 只使用当前 upgrade transaction 读写 Source Package、Definition、Preferences 和 appMeta；私有空间与用户四仓不进入写集。
 * 成功路径: 删除四个内置身份的陈旧包，采用当前目录脚本、定义和授权；可验证的 enabled、importedAt、默认源和软隐藏决定继续保留。
 * 修复边界: 系统 Package、Definition 或授权缺失属于应用目录可重建数据；无关自定义保存对象和 Preferences 顶层结构仍执行严格校验。
 * 失败路径: 全局偏好、无关自定义对象、目录种子或任一请求无效时 reject，upgrade transaction 原子回滚。
 *
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @param {object} context.sourceSeeds 当前内置源 Package、Definition 和系统授权事实。
 * @param {object} context.builtinCatalogRelease 当前内置目录发布身份。
 * @param {number} targetSchemaVersion 当前迁移需要提交的连续 schema 整数版本。
 * @returns {Promise<void>} 全部对账请求完成时结束。
 * @throws {BrowserPersistenceError|SourceRepositoryValidationError} 当非系统保存图或目录输入不能安全迁移时抛出。
 */
async function reconcileBuiltinSourceCatalog(transaction, context, targetSchemaVersion = null) {
  // 类型: IDBObjectStore；作用: 读取初始化事实并在成功末尾提交目录发布身份及可选 schema 版本。
  const metaStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta);
  // 类型: object|undefined；作用: 区分尚未首次种子的全新数据库和已有业务保存图。
  const initializedRecord = await metaStore.get(BROWSER_PERSISTENCE_META_KEY.initialized);

  // 条件分支: 新库连续执行 schema 迁移但尚未运行首次种子时进入。
  // 执行内容: 只推进 schema 事实；当前系统源保存图和发布身份随后由唯一九仓首次种子事务写入。
  if (initializedRecord === undefined) {
    // 条件分支: 普通启动不应遇到未初始化库；只有连续 schema 迁移传入目标版本时允许推进。
    // 执行内容: 缺少迁移目标时把该状态视为损坏，阻止启动对账掩盖未完成初始化。
    if (!Number.isInteger(targetSchemaVersion)) {
      throw new BrowserPersistenceError(
        BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted,
        '数据库缺少初始化元信息，不能执行内置目录启动对账'
      );
    }
    await metaStore.put({ key: BROWSER_PERSISTENCE_META_KEY.schemaVersion, value: targetSchemaVersion });
    return;
  }
  // 条件分支: initialized 存在但不是严格 true 时进入。
  // 执行内容: 拒绝把部分初始化记录当作可对账保存图。
  if (initializedRecord.value !== true) {
    throw new BrowserPersistenceError(
      Number.isInteger(targetSchemaVersion)
        ? BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed
        : BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted,
      '历史数据库初始化元信息无效'
    );
  }

  // 类型: string；作用: 同一对账核心在 schema 升级中报告迁移失败，在普通启动中报告已保存数据损坏。
  const reconciliationErrorCode = Number.isInteger(targetSchemaVersion)
    ? BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed
    : BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted;

  // 类型: IDBObjectStore；作用: 删除内置身份的全部陈旧包并写入当前完整脚本包。
  const packageStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages);
  // 类型: IDBObjectStore；作用: 覆盖四条内置静态定义并保留无关定义。
  const definitionStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions);
  // 类型: IDBObjectStore；作用: 一次覆盖全局授权与用户决定偏好。
  const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);

  // 类型: Array<Array<object>|object|undefined>；作用: 在写入前取得三仓完整快照，任一读取失败会中止同一事务。
  const [packages, definitions, preferencesRecord] = await Promise.all([
    packageStore.getAll(),
    definitionStore.getAll(),
    preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY)
  ]);
  // 条件分支: 已初始化库缺少全局偏好时进入。
  // 执行内容: 拒绝猜测启用、授权、软隐藏和默认源决定。
  if (!preferencesRecord || preferencesRecord.key !== SOURCE_PREFERENCES_RECORD_KEY) {
    throw new BrowserPersistenceError(
      reconciliationErrorCode,
      '历史数据库缺少数据源偏好'
    );
  }

  // 类型: Map<string, object>；作用: 按 sourceId 关联当前目录 Package，避免依赖数组下标耦合脚本与 Definition。
  const seedPackagesBySourceId = new Map(
    context.sourceSeeds.packages.map(sourcePackage => [sourcePackage.sourceId, sourcePackage])
  );
  // 类型: Set<string>；作用: 固定应用拥有且允许从目录重建的当前系统身份。
  const builtinSourceIds = new Set(
    context.sourceSeeds.definitions.map(sourceDefinition => sourceDefinition.id)
  );
  // 类型: Set<string>；作用: 标记当前目录占用的稳定包引用，清除旧记录对这些主键的错误占用。
  const builtinPackageRefs = new Set(
    context.sourceSeeds.packages.map(sourcePackage => sourcePackage.packageRef)
  );
  // 条件分支: 当前目录 Package 与 Definition 数量或身份无法一一对应时进入。
  // 执行内容: 在改写历史数据前拒绝不完整目录发布。
  if (seedPackagesBySourceId.size !== context.sourceSeeds.packages.length
    || builtinSourceIds.size !== context.sourceSeeds.definitions.length
    || seedPackagesBySourceId.size !== context.sourceSeeds.definitions.length
    || context.sourceSeeds.definitions.some((definition) => {
      return seedPackagesBySourceId.get(definition.id)?.packageRef !== definition.packageRef;
    })) {
    throw new BrowserPersistenceError(
      reconciliationErrorCode,
      '当前内置源目录 Package 与 Definition 无法一一对应'
    );
  }

  // 类型: Array<object>；作用: 保存与当前系统身份无关且必须原样保留的合法自定义 Package。
  const preservedPackages = packages.filter((sourcePackage) => {
    // 类型: boolean；作用: sourceId 或 packageRef 命中当前目录时，该记录属于应用可重建边界。
    const isBuiltinOwned = builtinSourceIds.has(sourcePackage?.sourceId)
      || builtinPackageRefs.has(sourcePackage?.packageRef);
    // 条件分支: 非系统记录进入。
    // 执行内容: 继续执行完整契约校验，禁止对账顺带放宽自定义保存图。
    if (!isBuiltinOwned) {
      validateSourcePackage(sourcePackage);
    }
    return !isBuiltinOwned;
  });
  // 类型: Array<object>；作用: 保存无关合法 Definition，供默认源有效性判断并证明对账不改写自定义定义。
  const preservedDefinitions = definitions.filter((sourceDefinition) => {
    // 类型: boolean；作用: id 命中当前目录时，该定义由应用 manifest 权威重建。
    const isBuiltinOwned = builtinSourceIds.has(sourceDefinition?.id);
    // 条件分支: 非系统记录进入。
    // 执行内容: 严格校验后原样保留。
    if (!isBuiltinOwned) {
      validateMigrationSourceDefinition(
        sourceDefinition,
        'browserPersistence.builtinReconciliation.definition'
      );
    }
    return !isBuiltinOwned;
  });
  // 类型: Map<string, object>；作用: 定位历史系统 Definition，仅从中提取可验证首次导入时间。
  const definitionsById = new Map();
  definitions.forEach((sourceDefinition) => {
    // 条件分支: 当前历史定义属于四个应用系统身份时进入。
    // 执行内容: 只索引系统定义供 importedAt 恢复；无关定义已在 preservedDefinitions 中完整校验。
    if (builtinSourceIds.has(sourceDefinition?.id)) {
      definitionsById.set(sourceDefinition.id, sourceDefinition);
    }
  });

  // 类型: object；作用: 从历史偏好隔离复制，只重建应用拥有的系统状态。
  const nextPreferences = cloneSerializableValue(
    preferencesRecord.value,
    'browserPersistence.builtinReconciliation.preferences'
  );
  // 执行内容: sourceStates 必须仍是可逐项保留的普通对象；不存在或整体损坏时不能安全恢复自定义用户决定。
  assertPlainObject(nextPreferences.sourceStates, 'browserPersistence.preferences.sourceStates');
  // 类型: Array<object>；作用: 保存保留 importedAt 后待写入的当前内置 Definition。
  const refreshedDefinitions = [];

  context.sourceSeeds.definitions.forEach((seedDefinition) => {
    // 类型: object|undefined；作用: 当前目录 Definition 对应的历史系统定义；缺失时使用完整当前种子。
    const currentDefinition = definitionsById.get(seedDefinition.id);
    // 类型: object|undefined；作用: 保存用户对当前内置源的历史启停决定；授权内容由当前目录重建。
    const currentSourceState = nextPreferences.sourceStates[seedDefinition.id];
    // 类型: object|undefined；作用: 保存当前目录为内置源生成的新系统授权快照。
    const seedSourceState = context.sourceSeeds.preferences.sourceStates[seedDefinition.id];
    // 条件分支: 当前受审目录自身缺少系统状态时进入。
    // 执行内容: 中止迁移；历史缺项可以修复，发布种子缺项不能猜测。
    if (!seedSourceState) {
      throw new BrowserPersistenceError(
        reconciliationErrorCode,
        `当前内置源目录缺少系统状态: ${seedDefinition.id}`
      );
    }

    // 类型: boolean；作用: 仅严格 Boolean 能证明用户启停决定；缺失或损坏状态回到当前系统种子决定。
    const preservedEnabled = typeof currentSourceState?.enabled === 'boolean'
      ? currentSourceState.enabled
      : seedSourceState.enabled;
    // 类型: string；作用: 仅标准 UTC ISO 历史值能继续作为首次导入事实，否则采用当前目录发布时间。
    const preservedImportedAt = typeof currentDefinition?.importedAt === 'string'
      && !Number.isNaN(Date.parse(currentDefinition.importedAt))
      && new Date(currentDefinition.importedAt).toISOString() === currentDefinition.importedAt
      ? currentDefinition.importedAt
      : seedDefinition.importedAt;
    // 类型: object；作用: 采用当前 manifest 全部字段和最后更新时间，只保留上述可验证首次导入时间。
    const refreshedDefinition = cloneSerializableValue(
      {
        ...seedDefinition,
        importedAt: preservedImportedAt
      },
      `browserPersistence.builtinReconciliation.definitions.${seedDefinition.id}`
    );
    validateSourceDefinition(refreshedDefinition);
    refreshedDefinitions.push(refreshedDefinition);

    // 赋值副作用: enabled 采用可验证用户决定；authorization 始终绑定当前目录版本和脚本哈希。
    nextPreferences.sourceStates[seedDefinition.id] = {
      enabled: preservedEnabled,
      authorization: cloneSerializableValue(
        seedSourceState.authorization,
        `browserPersistence.builtinReconciliation.authorization.${seedDefinition.id}`
      )
    };
  });

  // 类型: Map<string, object>；作用: 建立保留自定义 Package 的唯一 sourceId 索引，验证 Definition 引用关系。
  const preservedPackagesBySourceId = new Map();
  preservedPackages.forEach((sourcePackage) => {
    // 条件分支: 同一自定义 sourceId 保存了多条 Package 时进入。
    // 执行内容: 拒绝任意选择脚本，保持无关保存图损坏时整体回滚。
    if (preservedPackagesBySourceId.has(sourcePackage.sourceId)) {
      throw new BrowserPersistenceError(
        reconciliationErrorCode,
        `历史数据库存在重复自定义数据源包: ${sourcePackage.sourceId}`
      );
    }
    preservedPackagesBySourceId.set(sourcePackage.sourceId, sourcePackage);
  });
  // 类型: Set<string>；作用: 保存全部合法自定义 Definition 身份，验证 Package 与 Preferences 不存在悬空记录。
  const preservedDefinitionIds = new Set(preservedDefinitions.map(definition => definition.id));
  preservedDefinitions.forEach((sourceDefinition) => {
    // 类型: object|undefined；作用: 当前自定义 Definition 必须唯一关联的历史 Package。
    const sourcePackage = preservedPackagesBySourceId.get(sourceDefinition.id);
    // 类型: object|undefined；作用: 当前自定义 Definition 必须拥有的用户启停与授权偏好。
    const sourceState = nextPreferences.sourceStates[sourceDefinition.id];
    // 条件分支: 自定义 Definition 缺少 Package、偏好，或 packageRef 关系断裂时进入。
    // 执行内容: 中止迁移并回滚，不借系统源对账掩盖用户自定义保存图损坏。
    if (!sourcePackage || !sourceState || sourcePackage.packageRef !== sourceDefinition.packageRef) {
      throw new BrowserPersistenceError(
        reconciliationErrorCode,
        `历史自定义数据源保存图不完整: ${sourceDefinition.id}`
      );
    }
  });
  preservedPackages.forEach((sourcePackage) => {
    // 条件分支: 自定义 Package 没有对应 Definition 时进入。
    // 执行内容: 拒绝保留无法由 SourceManager 组装的孤立脚本包。
    if (!preservedDefinitionIds.has(sourcePackage.sourceId)) {
      throw new BrowserPersistenceError(
        reconciliationErrorCode,
        `历史数据库存在孤立自定义数据源包: ${sourcePackage.sourceId}`
      );
    }
  });
  Object.keys(nextPreferences.sourceStates).forEach((sourceId) => {
    // 条件分支: 偏好既不属于当前系统源，也没有对应的保留自定义 Definition 时进入。
    // 执行内容: 拒绝提交悬空授权或启停决定，避免 v5 后仍在 SourceManager 初始化阶段失败。
    if (!builtinSourceIds.has(sourceId) && !preservedDefinitionIds.has(sourceId)) {
      throw new BrowserPersistenceError(
        reconciliationErrorCode,
        `历史数据库存在孤立数据源偏好: ${sourceId}`
      );
    }
  });

  // 类型: Set<string>；作用: 默认源只允许指向保留自定义定义或当前内置定义。
  const validDefaultSourceIds = new Set([
    ...preservedDefinitions.map(definition => definition.id),
    ...builtinSourceIds
  ]);
  // 条件分支: 历史默认源已经没有 Definition 或为空时进入。
  // 执行内容: 交接到当前目录第一条系统源，不根据启停状态猜测第二候选。
  if (!validDefaultSourceIds.has(nextPreferences.defaultSourceId)) {
    nextPreferences.defaultSourceId = context.sourceSeeds.preferences.defaultSourceId;
  }
  validateSourcePreferences(nextPreferences);

  // 类型: Array<Promise<*>>；作用: 删除所有命中系统 sourceId 或当前稳定 packageRef 的历史包，消除同源多包和主键错配。
  const builtinPackageDeletes = packages
    .filter(sourcePackage => builtinSourceIds.has(sourcePackage?.sourceId)
      || builtinPackageRefs.has(sourcePackage?.packageRef))
    .map(sourcePackage => packageStore.delete(sourcePackage.packageRef));
  // 写入顺序: 删除系统旧包后采用当前三仓事实；全部请求和两个元信息更新共享唯一 upgrade transaction。
  await Promise.all(builtinPackageDeletes);
  await Promise.all(context.sourceSeeds.packages.map(sourcePackage => packageStore.put(sourcePackage)));
  await Promise.all(refreshedDefinitions.map(sourceDefinition => definitionStore.put(sourceDefinition)));
  await preferencesStore.put({ key: SOURCE_PREFERENCES_RECORD_KEY, value: nextPreferences });
  await metaStore.put({
    key: BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease,
    value: context.builtinCatalogRelease
  });
  // 清理副作用: 旧 seedVersion 只代表历史迁移时期的混合版本，当前发布提交后不再保留第二判断依据。
  await metaStore.delete(BROWSER_PERSISTENCE_META_KEY.legacySeedVersion);
  // 条件分支: schema 迁移复用对账核心时进入；普通启动只更新目录事实，不改变数据库结构版本。
  // 执行内容: 仅迁移调用方提交明确目标整数，普通启动保持现有 schemaVersion 原值。
  if (Number.isInteger(targetSchemaVersion)) {
    await metaStore.put({
      key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
      value: targetSchemaVersion
    });
  }

}

/**
 * 执行 v4 内置目录刷新。
 * 副作用: 复用幂等系统源对账器，在唯一 upgrade transaction 提交 schemaVersion=4。
 * 成功路径: v3 历史缺少应用系统记录时直接从当前目录恢复，不清理用户数据。
 * 失败路径: 当前目录、无关自定义保存图或事务请求失败时 reject 并回滚 v4。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；当前迁移不修改 schema 对象。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v4 对账完成时结束。
 */
async function applyBuiltinSourceRefreshMigration(database, transaction, context) {
  // 参数边界: database 由统一迁移表传入；本次只操作既有 object store，因此不直接读取该代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRefresh
  );
}

/**
 * 执行 v5 系统源目录恢复对账。
 * 副作用: 对已提交 v4 的真实历史库再次运行幂等对账，在同一 upgrade transaction 提交 schemaVersion=5。
 * 成功路径: 修复开发期中间版本留下的缺失 Package、Definition、授权或陈旧同源包，并保持用户保存域。
 * 失败路径: 当前目录、无关自定义保存图或事务请求失败时 reject 并保留完整 v4。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；当前迁移不修改 schema 对象。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v5 对账完成时结束。
 */
async function applyBuiltinSourceReconciliationMigration(database, transaction, context) {
  // 参数边界: database 由统一迁移表传入；本次只操作既有 object store，因此不直接读取该代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceReconciliation
  );
}

/**
 * 执行 v6 内置挑战请求语义源刷新。
 * 副作用: 复用 v5 已验证的系统源幂等对账器，在唯一 upgrade transaction 中提交 schemaVersion=6。
 * 成功路径: 以当前 datasource/*.js 同源种子刷新 MJWO 1.0.3 Package、Definition 和授权指纹，同时保持用户保存域。
 * 失败路径: 当前目录、无关自定义保存图或任一事务请求失败时 reject，并由 IndexedDB 回滚完整 v5。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；当前迁移不修改 schema 对象。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v6 对账完成时结束。
 */
async function applyBuiltinSourceChallengeRefreshMigration(database, transaction, context) {
  // 参数边界: database 由统一迁移表传入；v6 只写既有 object store，不直接使用数据库代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceChallengeRefresh
  );
}

/**
 * 执行 v7 内置验证响应语义源刷新。
 * 副作用: 复用既有系统源幂等对账器，在唯一 upgrade transaction 中提交 schemaVersion=7。
 * 成功路径: 以当前 datasource/*.js 同源种子刷新 Provider 脚本、Definition 和授权指纹，同时保持用户保存域。
 * 失败路径: 当前目录、无关自定义保存图或任一事务请求失败时 reject，并由 IndexedDB 回滚完整 v6。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；当前迁移不修改 schema 对象。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v7 对账完成时结束。
 */
async function applyBuiltinSourceVerificationRefreshMigration(database, transaction, context) {
  // 参数边界: database 由统一迁移表传入；v7 只写既有 object store，不直接使用数据库代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceVerificationRefresh
  );
}

/**
 * 执行 v8 内置搜索事务语义源刷新。
 * 副作用: 复用既有系统源幂等对账器，在唯一 upgrade transaction 中提交 schemaVersion=8。
 * 成功路径: 以当前 datasource/*.js 同源种子刷新 MJWO 搜索 URL 语义、Package、Definition 和系统授权指纹，同时保持用户保存域。
 * 失败路径: 当前目录、无关自定义保存图或任一事务请求失败时 reject，并由 IndexedDB 回滚完整 v7。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；当前迁移不修改 schema 对象。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v8 对账完成时结束。
 */
async function applyBuiltinSourceSearchTransactionRefreshMigration(database, transaction, context) {
  // 参数边界: database 由统一迁移表传入；v8 只写既有 object store，不直接使用数据库代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchTransactionRefresh
  );
}

/**
 * 执行 v9 Provider ABI 2.0 系统源原子刷新。
 * 副作用: 复用唯一系统源对账器，在同一个 upgrade transaction 更新四条应用拥有的 Package、Definition、授权和 schemaVersion=9。
 * 成功路径: 当前系统源采用 ABI 2.0 单文件，同时保留 enabled、默认源、软隐藏、importedAt、全部私有空间、自定义保存图和用户四仓。
 * 失败路径: 当前目录、无关自定义保存图或任一事务请求无效时 reject，并由 IndexedDB 回滚完整 v8。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v9 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v9 对账完成时结束。
 */
async function applyProviderApiVersion2RefreshMigration(database, transaction, context) {
  // 参数边界: v9 只在既有九仓中替换应用拥有的系统记录，不直接操作数据库 schema 代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.providerApiVersion2Refresh
  );
}

/**
 * 执行 v10 内置 Provider 请求语义原子刷新。
 * 副作用: 复用唯一系统源对账器，在同一个 upgrade transaction 更新应用拥有的 Package、Definition、授权和 schemaVersion=10。
 * 成功路径: 当前内置目录的请求语义随 Provider 单文件发布，同时保留 enabled、默认源、软隐藏、importedAt、全部私有空间、自定义保存图和用户四仓。
 * 架构边界: 本迁移只采用目录脚本和指纹，不识别 sourceId、域名、请求头或站点业务。
 * 失败路径: 当前目录、无关自定义保存图或任一事务请求无效时 reject，并由 IndexedDB 回滚完整 v9。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v10 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v10 对账完成时结束。
 */
async function applyBuiltinSourceRequestPolicyRefreshMigration(database, transaction, context) {
  // 参数边界: v10 只在既有九仓中替换应用拥有的系统记录，不直接操作数据库 schema 代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRequestPolicyRefresh
  );
}

/**
 * 创建默认快捷键偏好保存对象。
 * 纯函数: 从冻结播放配置生成新的顶层对象、绑定数组和修饰符数组。
 * 成功路径: 返回通过 Repository 校验器的 ShortcutPreferences。
 * 失败路径: 配置与正式契约偏离时抛校验错误并阻断首次种子或迁移。
 *
 * @returns {object} 可写入 userSettings 的默认快捷键偏好。
 */
function createDefaultShortcutPreferences() {
  return cloneValidatedShortcutPreferences({
    schemaVersion: PLAYBACK_SHORTCUT_PREFERENCES_SCHEMA_VERSION,
    bindings: DEFAULT_PLAYBACK_SHORTCUT_BINDINGS.map(binding => ({
      action: binding.action,
      key: binding.key,
      modifiers: [...binding.modifiers],
      enabled: binding.enabled
    }))
  });
}

/**
 * 执行 v11 用户快捷键偏好原子迁移。
 * 副作用: 在同一 upgrade transaction 中把每条旧 userSettings 行扩展为恢复策略与快捷键偏好完整对象，并提交 schemaVersion=11。
 * 成功路径: 逐条保留 userId 和已保存恢复策略，只增加当前默认 ShortcutPreferences。
 * 失败路径: 旧设置字段、用户身份、恢复策略或默认快捷键无效时 reject，并由 IndexedDB 回滚完整 v10。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v11 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @returns {Promise<void>} 全部用户设置和版本事实写入升级事务时结束。
 */
async function applyUserShortcutPreferencesRefreshMigration(database, transaction) {
  // 参数边界: v11 只使用既有 userSettings 和 appMeta，不修改 object store 结构。
  void database;
  // 类型: IDBObjectStore；作用: 在当前升级事务内读取并替换全部用户设置单例。
  const settingsStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings);
  // 类型: Array<object>；作用: 保存 v10 已提交的全部用户设置行，空数组表示尚未首次播种的新库。
  const settingsRecords = await settingsStore.getAll();
  // 循环作用: 为每个已有用户原子补入默认快捷键，同时保留其恢复策略。
  await Promise.all(settingsRecords.map((record, index) => {
    // 类型: object；作用: 只接受 v10 正式 userSettings 形状，拒绝未知长期字段。
    const legacyRecord = assertExactPlainObject(
      record,
      ['userId', 'resumePolicy'],
      `userSettings[${index}]`
    );
    assertSafeRecordKey(legacyRecord.userId, `userSettings[${index}].userId`);
    return settingsStore.put({
      userId: legacyRecord.userId,
      resumePolicy: cloneValidatedResumePolicy(legacyRecord.resumePolicy),
      shortcutPreferences: createDefaultShortcutPreferences()
    });
  }));
  await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta).put({
    key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
    value: BROWSER_PERSISTENCE_SCHEMA_VERSION.userShortcutPreferencesRefresh
  });
}

/**
 * 执行 v12 首页展示偏好原子迁移。
 * 副作用: 在同一 upgrade transaction 中把每条 v11 userSettings 行扩展为四字段完整对象，并提交 schemaVersion=12。
 * 成功路径: 逐条保留 userId、恢复策略和快捷键偏好，只增加当前默认 HomeDisplayPreferences。
 * 失败路径: 旧设置字段、用户身份或任一设置对象无效时 reject，并由 IndexedDB 回滚完整 v11。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v12 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @returns {Promise<void>} 全部用户设置和版本事实写入升级事务时结束。
 */
async function applyHomeDisplayPreferencesRefreshMigration(database, transaction) {
  // 参数边界: v12 只使用既有 userSettings 和 appMeta，不修改 object store 结构。
  void database;
  // 类型: IDBObjectStore；作用: 在当前升级事务内读取并替换全部用户设置单例。
  const settingsStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings);
  // 类型: Array<object>；作用: 保存 v11 已提交的全部用户设置行，空数组表示尚未首次播种的新库。
  const settingsRecords = await settingsStore.getAll();
  // 循环作用: 为每个已有用户原子补入默认首页展示偏好，同时保留两个既有设置领域。
  await Promise.all(settingsRecords.map((record, index) => {
    // 类型: object；作用: 只接受 v11 正式 userSettings 形状，拒绝未知长期字段。
    const legacyRecord = assertExactPlainObject(
      record,
      ['userId', 'resumePolicy', 'shortcutPreferences'],
      `userSettings[${index}]`
    );
    assertSafeRecordKey(legacyRecord.userId, `userSettings[${index}].userId`);
    return settingsStore.put({
      userId: legacyRecord.userId,
      resumePolicy: cloneValidatedResumePolicy(legacyRecord.resumePolicy),
      shortcutPreferences: cloneValidatedShortcutPreferences(legacyRecord.shortcutPreferences),
      homeDisplayPreferences: cloneValidatedHomeDisplayPreferences(createDefaultHomeDisplayPreferences())
    });
  }));
  await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta).put({
    key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
    value: BROWSER_PERSISTENCE_SCHEMA_VERSION.homeDisplayPreferencesRefresh
  });
}

/**
 * 执行 v13 内置系统源纯名称原子发布。
 * 副作用: 复用唯一系统源对账器，在同一个 upgrade transaction 更新应用拥有的 Package、Definition、授权和 schemaVersion=13。
 * 成功路径: 当前目录的纯显示名称、补丁版本和完整脚本文本被同源采用，同时保留 enabled、默认源、软隐藏、importedAt、全部私有空间、自定义保存图和用户四仓。
 * 架构边界: 本迁移只采用当前受审目录，不识别 sourceId、域名或名称后缀，也不创建页面显示映射。
 * 失败路径: 当前目录、无关自定义保存图或任一事务请求无效时 reject，并由 IndexedDB 回滚完整 v12。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v13 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v13 系统源目录对账完成时结束。
 */
async function applyBuiltinSourceDisplayNameRefreshMigration(database, transaction, context) {
  // 参数边界: v13 只在既有九仓中采用应用拥有的系统记录，不直接操作数据库 schema 代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceDisplayNameRefresh
  );
}

/**
 * 执行 v14 内置 Provider 首页逻辑分页原子发布。
 * 副作用: 复用唯一系统源对账器，在同一个 upgrade transaction 更新四条系统 Package、Definition、授权和 schemaVersion=14。
 * 成功路径: 当前 Provider 脚本按 page/pageSize 交付连续逻辑页，同时保留 enabled、默认源、软隐藏、importedAt、私有空间、自定义保存图和用户四仓。
 * 架构边界: 本迁移只采用当前受审目录，不解释 sourceId、域名、源站批次或页面布局。
 * 失败路径: 目录或任一保存图无效时 reject，并由 IndexedDB 回滚完整 v13。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v14 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v14 系统源脚本对账完成时结束。
 */
async function applyBuiltinSourceLogicalPaginationRefreshMigration(database, transaction, context) {
  // 参数边界: v14 只在既有九仓中采用应用拥有的系统记录，不直接操作数据库 schema 代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceLogicalPaginationRefresh
  );
}

/**
 * 执行 v15 内置 Provider 首页区域映射原子发布。
 * 副作用: 复用唯一系统源对账器，在同一个 upgrade transaction 更新应用拥有的系统 Package、Definition、授权和 schemaVersion=15。
 * 成功路径: 当前目录脚本采用各 Provider 自己声明的首页区域映射，同时保留 enabled、默认源、软隐藏、importedAt、私有空间、自定义保存图和用户四仓。
 * 架构边界: 本迁移只发布当前受审目录和指纹，不识别 sourceId、域名、HTML 标题、板块 id 或页面 moduleKey。
 * 失败路径: 当前目录或任一保存图无效时 reject，并由 IndexedDB 回滚完整 v14。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v15 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v15 系统源脚本对账完成时结束。
 */
async function applyBuiltinSourceHomeMappingRefreshMigration(database, transaction, context) {
  // 参数边界: v15 只在既有九仓中采用应用拥有的系统记录，不直接操作数据库 schema 代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceHomeMappingRefresh
  );
}

/**
 * 执行 v16 内置 Provider 电影目录能力原子发布。
 * 副作用: 复用唯一系统源对账器，在同一个 upgrade transaction 更新应用拥有的系统 Package、Definition、授权和 schemaVersion=16。
 * 成功路径: 当前目录脚本采用各 Provider 自己声明的筛选、内容区域和分页规则，同时保留 enabled、默认源、软隐藏、importedAt、私有空间、自定义保存图和用户四仓。
 * 架构边界: 本迁移只发布当前受审目录和指纹，不识别 sourceId、域名、HTML label、卡片容器、筛选路径或分页批次。
 * 失败路径: 当前目录或任一保存图无效时 reject，并由 IndexedDB 回滚完整 v15。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v16 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v16 系统源脚本对账完成时结束。
 */
async function applyBuiltinSourceMovieCatalogRefreshMigration(database, transaction, context) {
  // 参数边界: v16 只在既有九仓中采用应用拥有的系统记录，不直接操作数据库 schema 代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceMovieCatalogRefresh
  );
}

/**
 * 执行 v17 内置 Provider 电视剧目录能力原子发布。
 * 副作用: 复用唯一系统源对账器，在同一个 upgrade transaction 更新应用拥有的系统 Package、Definition、授权和 schemaVersion=17。
 * 成功路径: 当前目录脚本采用各 Provider 自己声明的电视剧筛选、内容区域和分页规则，同时保留用户决定、私有空间、自定义保存图和用户四仓。
 * 架构边界: 本迁移只发布当前受审目录和指纹，不识别 sourceId、域名、HTML label、卡片容器、筛选路径或分页批次。
 * 失败路径: 当前目录或任一保存图无效时 reject，并由 IndexedDB 回滚完整 v16。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v17 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v17 系统源脚本对账完成时结束。
 */
async function applyBuiltinSourceTvCatalogRefreshMigration(database, transaction, context) {
  // 参数边界: v17 只在既有九仓中采用应用拥有的系统记录，不直接操作数据库 schema 代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceTvCatalogRefresh
  );
}

/**
 * 执行 v18 内置 Provider 搜索分页能力原子发布。
 * 副作用: 复用唯一系统源对账器，在同一个 upgrade transaction 更新应用拥有的系统 Package、Definition、授权和 schemaVersion=18。
 * 成功路径: 当前目录脚本采用各 Provider 自己声明的搜索分页与逻辑页规则，同时保留用户决定、私有空间、自定义保存图和用户四仓。
 * 架构边界: 本迁移只发布当前受审目录和指纹，不识别 sourceId、域名、搜索 URL、HTML 分页结构、验证码或源站批次。
 * 失败路径: 当前目录或任一保存图无效时 reject，并由 IndexedDB 回滚完整 v17。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v18 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v18 系统源脚本对账完成时结束。
 */
async function applyBuiltinSourceSearchPaginationRefreshMigration(database, transaction, context) {
  // 参数边界: v18 只在既有九仓中采用应用拥有的系统记录，不直接操作数据库 schema 代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchPaginationRefresh
  );
}

/**
 * 执行 v19 内置 Provider 详情映射能力原子发布。
 * 副作用: 复用唯一系统源对账器，在同一个 upgrade transaction 更新应用拥有的系统 Package、Definition、授权和 schemaVersion=19。
 * 成功路径: 当前目录脚本采用各 Provider 自己声明的详情字段和播放列表规则，同时保留用户决定、私有空间、自定义保存图和用户四仓。
 * 架构边界: 本迁移只发布当前受审目录和指纹，不识别 sourceId、域名、详情容器、字段标签、播放列表或分集 URL。
 * 失败路径: 当前目录或任一保存图无效时 reject，并由 IndexedDB 回滚完整 v18。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v19 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v19 系统源脚本对账完成时结束。
 */
async function applyBuiltinSourceDetailMappingRefreshMigration(database, transaction, context) {
  // 参数边界: v19 只在既有九仓中采用应用拥有的系统记录，不直接操作数据库 schema 代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceDetailMappingRefresh
  );
}

/**
 * 执行 v20 内置系统源原子退役。
 * 副作用: 在唯一 upgrade transaction 删除冻结退役身份的 Package、Definition、偏好状态、软隐藏记录和五分区私有空间。
 * 成功路径: 当前内置源、自定义源、收藏、播放历史、用户资料与设置保持不变；失效默认源交接到当前目录第一条内置源。
 * 架构边界: 迁移器只消费 sourceId 集合，不解释站点名称、域名、Provider 响应或页面字段；页面运行态在应用重新加载时由空 Store 建立。
 * 失败路径: 初始化事实、偏好、当前目录或任一保存对象无效时 reject，并由 IndexedDB 回滚完整 v19。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v20 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @param {ReadonlyArray<string>} context.retiredBuiltinSourceIds 产品种子冻结的精确退役身份。
 * @param {object} [migrationOptions] 内部连续迁移覆盖项；普通 v20 调用不传入。
 * @param {ReadonlyArray<string>} [migrationOptions.sourceIds] 本次迁移精确删除的系统身份。
 * @param {number} [migrationOptions.targetSchemaVersion] 本次成功提交的连续 schema 版本。
 * @returns {Promise<void>} 退役 Source 保存图和私有空间清理完成时结束。
 * @throws {BrowserPersistenceError|SourceRepositoryValidationError} 当历史保存图或退役输入不能安全迁移时抛出。
 */
async function applyBuiltinSourceRetirementMigration(
  database,
  transaction,
  context,
  migrationOptions = {}
) {
  // 参数边界: 退役与公开替换迁移只在既有九仓中删除精确系统记录，不直接修改 schema 代理。
  void database;
  // 类型: ReadonlyArray<string>；作用: v20 使用历史退役名单，后续公开替换迁移可复用同一原子删除核心。
  const sourceIds = migrationOptions.sourceIds ?? context.retiredBuiltinSourceIds;
  // 类型: number；作用: 由调用迁移决定最终连续版本，禁止复用事务核心时回写旧 schema 事实。
  const targetSchemaVersion = migrationOptions.targetSchemaVersion
    ?? BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRetirement;
  // 类型: IDBObjectStore；作用: 区分新库与历史库，并在全部清理成功后提交 v20 和当前种子版本事实。
  const metaStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta);
  // 类型: object|undefined；作用: 新库尚未播种时不读取不存在的业务保存图。
  const initializedRecord = await metaStore.get(BROWSER_PERSISTENCE_META_KEY.initialized);

  // 条件分支: 新库连续执行到 v20 但尚未运行首次种子时进入。
  // 执行内容: 只推进 schema 事实，后续唯一首次种子事务直接写入当前双源目录。
  if (initializedRecord === undefined) {
    await metaStore.put({
      key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
      value: targetSchemaVersion
    });
    return;
  }
  // 条件分支: initialized 存在但不是严格 true 时进入。
  // 执行内容: 拒绝在部分初始化数据库上执行不可逆退役。
  if (initializedRecord.value !== true) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed,
      '历史数据库初始化元信息无效'
    );
  }

  // 类型: IDBObjectStore；作用: 删除退役脚本包并保留其他系统源和自定义脚本。
  const packageStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages);
  // 类型: IDBObjectStore；作用: 删除退役定义并为默认源有效性提供完整身份集合。
  const definitionStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions);
  // 类型: IDBObjectStore；作用: 原子移除退役授权、启停、软隐藏和失效默认源。
  const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
  // 类型: IDBObjectStore；作用: 删除退役源 settings、credentials、session、cache 和 diagnostics 全部条目。
  const storageStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries);
  // 类型: Array<Array<object>|object|undefined>；作用: 写入前取得四仓一致快照，任何读取失败都会中止同一 upgrade transaction。
  const [packages, definitions, preferencesRecord, storageEntries] = await Promise.all([
    packageStore.getAll(),
    definitionStore.getAll(),
    preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY),
    storageStore.getAll()
  ]);
  // 条件分支: 已初始化库缺少全局偏好时进入。
  // 执行内容: 不猜测默认源、授权或软隐藏决定。
  if (!preferencesRecord || preferencesRecord.key !== SOURCE_PREFERENCES_RECORD_KEY) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed,
      '历史数据库缺少数据源偏好'
    );
  }
  validateSourcePreferences(preferencesRecord.value);

  // 类型: Set<string>；作用: 为 Source 保存图和私有空间使用同一精确退役边界，不按名称、类型或 URL 扩大清理。
  const retiredSourceIds = new Set(sourceIds);
  // 类型: Set<string>；作用: 证明当前产品目录没有继续发布任一待退役身份。
  const currentBuiltinSourceIds = new Set(
    context.sourceSeeds.definitions.map(sourceDefinition => sourceDefinition.id)
  );
  // 条件分支: 当前目录仍包含待退役身份时进入。
  // 执行内容: 阻止同一迁移先删除又由产品种子重新安装。
  if (sourceIds.some(sourceId => currentBuiltinSourceIds.has(sourceId))) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed,
      '当前内置源目录仍包含待退役身份'
    );
  }

  // 类型: Set<string>；作用: 同时删除退役 Definition 指向的包引用，避免历史错误 sourceId 留下孤立脚本。
  const retiredPackageRefs = new Set();
  // 类型: Set<string>；作用: 保存退役后仍存在的 Definition 身份，供默认源交接和偏好校验使用。
  const preservedDefinitionIds = new Set();
  definitions.forEach((sourceDefinition) => {
    validateMigrationSourceDefinition(
      sourceDefinition,
      'browserPersistence.v20.definition'
    );
    // 条件分支: 当前定义属于退役集合时进入；执行内容: 记录其包引用，不加入保留身份。
    if (retiredSourceIds.has(sourceDefinition.id)) {
      retiredPackageRefs.add(sourceDefinition.packageRef);
    } else {
      preservedDefinitionIds.add(sourceDefinition.id);
    }
  });

  // 类型: Array<Promise<*>>；作用: 删除 sourceId 或关联 packageRef 命中退役集合的全部脚本包。
  const packageDeletes = packages.map((sourcePackage) => {
    validateSourcePackage(sourcePackage);
    return retiredSourceIds.has(sourcePackage.sourceId)
      || retiredPackageRefs.has(sourcePackage.packageRef)
      ? packageStore.delete(sourcePackage.packageRef)
      : Promise.resolve();
  });
  // 类型: Array<Promise<*>>；作用: 按 Definition 主键删除精确退役身份。
  const definitionDeletes = definitions
    .filter(sourceDefinition => retiredSourceIds.has(sourceDefinition.id))
    .map(sourceDefinition => definitionStore.delete(sourceDefinition.id));
  // 类型: Array<Promise<*>>；作用: 删除两源五个分区内所有键，包括请求头、凭据、会话、内容缓存和诊断日志。
  const storageDeletes = storageEntries
    .filter(storageEntry => retiredSourceIds.has(storageEntry.sourceId))
    .map(storageEntry => storageStore.delete([
      storageEntry.sourceId,
      storageEntry.partition,
      storageEntry.key
    ]));
  // 类型: object；作用: 隔离历史偏好，只从副本删除退役状态和交接失效默认源。
  const nextPreferences = cloneSerializableValue(
    preferencesRecord.value,
    'browserPersistence.v20.preferences'
  );
  assertPlainObject(nextPreferences.sourceStates, 'browserPersistence.preferences.sourceStates');
  sourceIds.forEach((sourceId) => {
    // 赋值副作用: 只删除迁移副本中的退役授权和启停状态，原记录在事务提交前保持不变。
    delete nextPreferences.sourceStates[sourceId];
  });
  // 赋值副作用: 软删除集合不再保留已从产品目录永久退役的系统身份。
  nextPreferences.removedSystemSourceIds = nextPreferences.removedSystemSourceIds.filter(
    sourceId => !retiredSourceIds.has(sourceId)
  );

  // 条件分支: 历史默认源已经退役或没有保留 Definition 时进入。
  // 执行内容: 交接到当前目录第一条内置源；有效自定义默认源保持用户选择。
  if (!preservedDefinitionIds.has(nextPreferences.defaultSourceId)) {
    nextPreferences.defaultSourceId = context.sourceSeeds.preferences.defaultSourceId;
  }
  validateSourcePreferences(nextPreferences);

  // 写入顺序: Source 删除、偏好覆盖和元信息推进全部属于同一个 upgrade transaction，失败时完整回滚。
  await Promise.all([
    ...packageDeletes,
    ...definitionDeletes,
    ...storageDeletes
  ]);
  await preferencesStore.put({ key: SOURCE_PREFERENCES_RECORD_KEY, value: nextPreferences });
  await metaStore.put({
    key: BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease,
    value: context.builtinCatalogRelease
  });
  // 清理副作用: 退役事务已采用当前目录发布身份，旧 seedVersion 不再保留为并行版本依据。
  await metaStore.delete(BROWSER_PERSISTENCE_META_KEY.legacySeedVersion);
  await metaStore.put({
    key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
    value: targetSchemaVersion
  });
}

/**
 * 执行 v26 公开版模拟系统源原子替换。
 * 副作用: 复用 v20 退役事务核心，删除冻结旧公开身份的 Package、Definition、偏好和私有空间，并提交 schemaVersion=26。
 * 成功路径: MJWO、Moovie、自定义源、收藏、播放历史、用户资料与设置保持；失效默认源交接到当前目录第一条真实系统源。
 * 失败路径: 历史保存图、当前目录或任一删除请求无效时 reject，并由 IndexedDB 回滚完整 v25。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v26 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} 旧公开模拟源保存图清理完成时结束。
 */
async function applyPublicBuiltinSourceReplacementMigration(database, transaction, context) {
  // 写入顺序: 先在同一 upgrade transaction 安装当前真实目录，使默认源和系统授权在旧模拟源删除前已有确定接替对象。
  await reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.publicBuiltinSourceReplacement
  );
  // 跨层边界: 目录采用和旧模拟源清理共享同一原生事务，任一步失败时完整 v25 保存图保持不变。
  return applyBuiltinSourceRetirementMigration(database, transaction, context, {
    sourceIds: context.replacedPublicBuiltinSourceIds,
    targetSchemaVersion: BROWSER_PERSISTENCE_SCHEMA_VERSION.publicBuiltinSourceReplacement
  });
}

/**
 * 执行 v21 内置 Provider 完整卡片字段原子发布。
 * 副作用: 复用唯一系统源对账器，在同一个 upgrade transaction 更新当前内置 Package、Definition、授权和 schemaVersion=21。
 * 成功路径: 当前 Provider 脚本交付完整卡片可见字段，同时保留启停、默认源、软隐藏、importedAt、五分区私有空间、自定义保存图和用户四仓。
 * 架构边界: 本迁移只采用当前受审目录，不识别 sourceId、域名、HTML 容器、推荐标签、评分、质量、剧集状态或基础元信息。
 * 失败路径: 当前目录、无关自定义保存图或任一事务请求无效时 reject，并由 IndexedDB 回滚完整 v20。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v21 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v21 系统源脚本对账完成时结束。
 */
async function applyBuiltinSourceCardMetadataRefreshMigration(database, transaction, context) {
  // 参数边界: v21 只在既有九仓中采用应用拥有的系统记录，不直接操作数据库 schema 代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceCardMetadataRefresh
  );
}

/**
 * 执行 v22 内置 Provider 搜索行解析修复原子发布。
 * 副作用: 复用唯一系统源对账器，在同一个 upgrade transaction 更新当前内置 Package、Definition、授权和 schemaVersion=22。
 * 成功路径: Runtime 后续加载搜索行独立元信息解析脚本，同时保留启停、默认源、软隐藏、importedAt、五分区私有空间、自定义保存图和用户四仓。
 * 架构边界: 本迁移只采用当前受审目录，不识别 sourceId、域名、搜索 HTML、分类、年份、地区、类型或 ContentItem。
 * 失败路径: 当前目录、无关自定义保存图或任一事务请求无效时 reject，并由 IndexedDB 回滚完整 v21。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v22 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v22 系统源脚本对账完成时结束。
 */
async function applyBuiltinSourceSearchMetadataRepairMigration(database, transaction, context) {
  // 参数边界: v22 只在既有九仓中采用应用拥有的系统记录，不直接操作数据库 schema 代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchMetadataRepair
  );
}

/**
 * 执行 v23 内置 Provider 详情状态边界修复原子发布。
 * 副作用: 复用唯一系统源对账器，在同一个 upgrade transaction 更新当前内置 Package、Definition、授权和 schemaVersion=23。
 * 成功路径: Runtime 后续加载只从 Provider 权威结构读取详情状态的脚本，同时保留启停、默认源、软隐藏、importedAt、五分区私有空间、自定义保存图和用户四仓。
 * 架构边界: 本迁移只采用当前受审目录，不识别 sourceId、域名、详情 HTML、状态文案或 ContentItem。
 * 失败路径: 当前目录、无关自定义保存图或任一事务请求无效时 reject，并由 IndexedDB 回滚完整 v22。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v23 不修改 object store 结构。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {object} context 已验证初始化与迁移输入。
 * @returns {Promise<void>} v23 系统源脚本对账完成时结束。
 */
async function applyBuiltinSourceDetailStatusRepairMigration(database, transaction, context) {
  // 参数边界: v23 只在既有九仓中采用应用拥有的系统记录，不直接操作数据库 schema 代理。
  void database;
  return reconcileBuiltinSourceCatalog(
    transaction,
    context,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceDetailStatusRepair
  );
}

/**
 * 执行 v24 用户内容卡片快照保存形状迁移。
 * 副作用: 在唯一 upgrade transaction 中逐行补齐收藏 contentSnapshot 和历史 contentSnapshot/episodeLocator，并推进 schemaVersion。
 * 成功路径: 所有既有用户记录、身份、时间和播放进度原样保留；旧记录快照为 null，分集定位器只采用既有结构化字段。
 * 架构边界: 迁移不请求 Provider、不读取页面 Store、不伪造标题海报，也不修改 Source 保存图或私有空间。
 * 失败路径: 初始化元信息或任一记录写入失败时 reject，并由 IndexedDB 回滚完整 v23。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v24 不增加 object store 或索引。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @returns {Promise<void>} 用户记录保存形状和 schemaVersion 原子提交准备完成时结束。
 */
async function applyUserContentSnapshotsMigration(database, transaction) {
  // 参数边界: v24 只修改既有用户记录形状，不直接修改 schema 代理。
  void database;
  // 类型: IDBObjectStore；作用: 区分新库与已初始化历史库，并提交 v24 结构事实。
  const metaStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta);
  // 类型: object|undefined；作用: 新库尚未播种时只需推进 schema，最终种子本身为空收藏和历史。
  const initializedRecord = await metaStore.get(BROWSER_PERSISTENCE_META_KEY.initialized);
  // 条件分支: 新库连续执行到 v24 但尚未运行首次种子时进入；执行内容: 只提交 schemaVersion。
  if (initializedRecord === undefined) {
    await metaStore.put({
      key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
      value: BROWSER_PERSISTENCE_SCHEMA_VERSION.userContentSnapshots
    });
    return;
  }
  // 条件分支: 初始化事实不是严格 true 时进入；执行内容: 拒绝在部分数据库上改写用户记录。
  if (initializedRecord.value !== true) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed,
      '历史数据库初始化元信息无效'
    );
  }

  // 类型: IDBObjectStore；作用: 读取并覆盖收藏行，复合主键和 userId 保持不变。
  const favoritesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites);
  // 类型: IDBObjectStore；作用: 读取并覆盖播放历史行，进度和 historyKey 保持不变。
  const historyStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory);
  // 类型: Array<Array<object>>；作用: 在写入前取得两仓一致快照，读取失败会中止同一升级事务。
  const [favorites, playHistory] = await Promise.all([
    favoritesStore.getAll(),
    historyStore.getAll()
  ]);

  // 类型: Array<Promise<*>>；作用: 为每条旧收藏增加显式 null 快照，不伪造无法从旧字段恢复的内容信息。
  const favoriteWrites = favorites.map((record) => {
    return favoritesStore.put({
      ...record,
      contentSnapshot: null
    });
  });
  // 类型: Array<Promise<*>>；作用: 为每条旧历史增加 null 快照和只由既有分集字段构成的定位器。
  const historyWrites = playHistory.map((record) => {
    return historyStore.put({
      ...record,
      contentSnapshot: null,
      episodeLocator: {
        episodeId: typeof record.episodeId === 'string' ? record.episodeId : '',
        seasonNumber: null,
        episodeNumber: null,
        episodeIndex: Number.isInteger(record.episodeIndex) && record.episodeIndex > 0
          ? record.episodeIndex
          : null,
        episodeTitle: ''
      }
    });
  });

  // 提交准备: 两仓所有行和结构版本属于同一 upgrade transaction，任一 put 失败都会整体回滚。
  await Promise.all([...favoriteWrites, ...historyWrites]);
  await metaStore.put({
    key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
    value: BROWSER_PERSISTENCE_SCHEMA_VERSION.userContentSnapshots
  });
}

/**
 * 执行 v25 SourceDefinition 署名保存形状迁移。
 * 副作用: 在唯一 upgrade transaction 中逐行补齐 authorName、siteUrl 和当前 Definition schemaVersion。
 * 成功路径: 系统源和自定义源全部保留原身份、版本、导入、能力与设置声明；系统源在普通启动目录对账时再采用当前 Provider 明确值。
 * 架构边界: 本迁移不读取脚本文本、站点域名、页面、Store 或用户内容，也不修改 Package、Preferences、私有空间和用户四仓。
 * 失败路径: 初始化元信息、v24 Definition 形状或任一写入无效时 reject，并由 IndexedDB 回滚完整 v24。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的数据库代理；v25 不增加 object store 或索引。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @returns {Promise<void>} Definition 署名字段和 schemaVersion 原子提交准备完成时结束。
 */
async function applySourceAttributionMigration(database, transaction) {
  // 参数边界: v25 只修改既有 SourceDefinition 记录形状，不直接修改 schema 代理。
  void database;
  // 类型: IDBObjectStore；作用: 区分新库与已初始化历史库，并提交 v25 结构事实。
  const metaStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta);
  // 类型: object|undefined；作用: 新库尚未播种时只需推进 schema，当前种子已经使用完整 Definition。
  const initializedRecord = await metaStore.get(BROWSER_PERSISTENCE_META_KEY.initialized);
  // 条件分支: 新库连续执行到 v25 但尚未运行首次种子时进入；执行内容: 只提交 schemaVersion。
  if (initializedRecord === undefined) {
    await metaStore.put({
      key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
      value: BROWSER_PERSISTENCE_SCHEMA_VERSION.sourceAttribution
    });
    return;
  }
  // 条件分支: 初始化事实不是严格 true 时进入；执行内容: 拒绝在部分数据库上改写 Definition。
  if (initializedRecord.value !== true) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed,
      '历史数据库初始化元信息无效'
    );
  }

  // 类型: IDBObjectStore；作用: 读取并覆盖全部系统和自定义 Definition，主键 id 保持不变。
  const definitionStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions);
  // 类型: Array<object>；作用: 在写入前取得一致历史快照，读取失败会中止同一升级事务。
  const sourceDefinitions = await definitionStore.getAll();
  // 类型: Array<Promise<*>>；作用: 收集全部 Definition 完整形状写入，任一失败整体回滚。
  const definitionWrites = sourceDefinitions.map((sourceDefinition, definitionIndex) => {
    // 执行内容: 先接受精确 v24 旧形状或较早迁移已写入的当前形状，第三种结构必须中止升级。
    validateMigrationSourceDefinition(sourceDefinition, `sourceDefinitions[${definitionIndex}]`);
    // 条件分支: 较早连续迁移已通过当前目录对账写入完整 Definition 时进入。
    // 执行内容: 保留现有署名，不用 v24 缺省值覆盖 Provider 已明确声明的字段。
    if (!hasExactSourceDefinitionFields(
      sourceDefinition,
      VERSION_TWENTY_FOUR_SOURCE_DEFINITION_FIELDS
    )) {
      return Promise.resolve();
    }
    // 类型: object；作用: 保留 v24 所有字段，只增加确定默认值并切换到独立 Definition 结构版本。
    const migratedDefinition = {
      ...sourceDefinition,
      schemaVersion: SOURCE_DEFINITION_SCHEMA_VERSION,
      authorName: SOURCE_ATTRIBUTION_POLICY.anonymousAuthorName,
      siteUrl: SOURCE_ATTRIBUTION_POLICY.emptySiteUrl
    };
    validateSourceDefinition(migratedDefinition);
    return definitionStore.put(migratedDefinition);
  });

  // 提交准备: 全部 Definition 与结构版本属于同一 upgrade transaction，任一 put 失败都会整体回滚。
  await Promise.all(definitionWrites);
  await metaStore.put({
    key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
    value: BROWSER_PERSISTENCE_SCHEMA_VERSION.sourceAttribution
  });
}

/**
 * 按连续整数执行数据库迁移表。
 * 副作用: 所有迁移共享 idb 提供的同一个 upgrade transaction，不创建补偿事务。
 * 成功路径: 从 oldVersion + 1 依次执行到 newVersion，每一步只能运行一次。
 * 失败路径: 目标版本非法或任一连续版本没有处理器时抛 migrationFailed 并回滚整个升级。
 *
 * @param {IDBDatabase} database idb upgrade 回调提供的目标数据库代理。
 * @param {IDBTransaction} transaction 当前唯一 upgrade transaction。
 * @param {number} oldVersion 已提交的旧 schema 版本，新库为 0。
 * @param {number|null} newVersion 当前打开请求的目标 schema 版本。
 * @param {object} context 已验证初始化与领域迁移输入。
 * @returns {Promise<void>} 全部连续迁移处理器完成时结束。
 */
async function runSchemaMigrations(database, transaction, oldVersion, newVersion, context) {
  // 条件分支: IndexedDB 没有提供正整数目标版本，或旧版本不小于目标版本时进入。
  // 执行内容: 拒绝无法表达连续升级区间的回调输入。
  if (!Number.isInteger(newVersion) || newVersion <= 0 || oldVersion >= newVersion) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed,
      '数据库升级版本区间无效'
    );
  }

  // 循环意义: 必须逐个整数版本执行，禁止从旧版本直接跳到最后迁移。
  for (let version = oldVersion + 1; version <= newVersion; version += 1) {
    // 类型: Readonly<object>|undefined；作用: 定位当前连续版本唯一迁移处理器。
    const migration = DATABASE_MIGRATIONS.find(candidate => candidate.version === version);
    // 条件分支: 当前连续版本没有冻结处理器时进入。
    // 执行内容: 中止升级并保留旧版本，不能假定中间 schema 与目标兼容。
    if (!migration) {
      throw new BrowserPersistenceError(
        BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed,
        `缺少数据库版本 ${version} 的连续迁移`
      );
    }
    // 副作用: 在同一 upgrade transaction 执行当前版本变更；任何异常会回滚全部未提交迁移。
    await migration.migrate(database, transaction, context);
  }
}

/**
 * 把四类数据源种子写入同一首次初始化事务。
 * 副作用: 只写 transaction 指向的新空数据库；调用方负责等待 transaction.done。
 * 成功路径: Package、Definition、Preferences 和非空 Storage 条目全部进入同一事务。
 * 失败路径: 任一 add 请求失败时 reject，由调用方中止整个首次种子事务。
 *
 * @param {IDBTransaction} transaction 覆盖九仓的首次初始化原生事务代理。
 * @param {object} sourceSeeds 已验证隔离数据源种子。
 * @returns {Promise<void>} 全部 put 请求进入事务后完成。
 */
async function seedSourceStores(transaction, sourceSeeds) {
  // 类型: IDBObjectStore；作用: 写入已验证 SourcePackage 首次种子。
  const packageStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages);
  // 类型: IDBObjectStore；作用: 写入已验证 SourceDefinition 首次种子。
  const definitionStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions);
  // 类型: IDBObjectStore；作用: 写入唯一 SourcePreferences 包装记录。
  const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
  // 类型: IDBObjectStore；作用: 写入展开后的五分区复合主键条目。
  const storageStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries);

  await Promise.all(sourceSeeds.packages.map(sourcePackage => packageStore.add(sourcePackage)));
  await Promise.all(sourceSeeds.definitions.map(sourceDefinition => definitionStore.add(sourceDefinition)));
  await preferencesStore.add({ key: SOURCE_PREFERENCES_RECORD_KEY, value: sourceSeeds.preferences });

  // 类型: Array<Promise<IDBValidKey>>；作用: 收集五分区每个真实键的 add 请求，空分区不制造占位记录。
  const storageWrites = [];
  // 循环作用: 把命名空间对象展开为复合主键记录，保证不同 sourceId 和 partition 同名键互不覆盖。
  Object.entries(sourceSeeds.storageNamespaces).forEach(([sourceId, namespace]) => {
    SOURCE_STORAGE_PARTITION_NAMES.forEach((partition) => {
      Object.entries(namespace[partition]).forEach(([key, value]) => {
        storageWrites.push(storageStore.add({ sourceId, partition, key, value }));
      });
    });
  });
  await Promise.all(storageWrites);
}

/**
 * 把游客种子写入四个用户内容 store。
 * 副作用: 当前播放状态被明确排除；userSettings 形状严格服从当前数据库目标版本。
 * 成功路径: v10 及以前只写恢复策略，v11 增加快捷键，v12 起同时写首页展示偏好，全部进入同一首次种子事务。
 * 失败路径: 复合键冲突或任一 add 请求失败时 reject，由调用方统一 abort。
 *
 * @param {IDBTransaction} transaction 覆盖九仓的首次初始化事务代理。
 * @param {object} userContentSeed 已验证 UserContentState 种子。
 * @param {number} targetSchemaVersion 当前门面请求的 schema 版本。
 * @returns {Promise<void>} 用户内容 add 请求全部完成。
 */
async function seedUserContentStores(transaction, userContentSeed, targetSchemaVersion) {
  // 类型: string；作用: 作为资料主键及收藏、历史、设置复合归属键。
  const userId = userContentSeed.user.id;
  await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userProfiles).add(userContentSeed.user);
  await Promise.all(userContentSeed.favorites.records.map((record) => {
    return transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).add({ userId, ...record });
  }));
  await Promise.all(userContentSeed.playHistory.records.map((record) => {
    return transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).add({ userId, ...record });
  }));
  // 类型: object；作用: 先建立所有历史版本共同拥有的 v10 userSettings 字段。
  const settingsRecord = {
    userId,
    resumePolicy: userContentSeed.resumePolicy
  };
  // 条件分支: 当前目标版本已经包含 v11 快捷键偏好迁移时进入；执行内容: 空库直接写最终设置形状。
  if (targetSchemaVersion >= BROWSER_PERSISTENCE_SCHEMA_VERSION.userShortcutPreferencesRefresh) {
    settingsRecord.shortcutPreferences = createDefaultShortcutPreferences();
  }
  // 条件分支: 当前目标版本已经包含 v12 首页展示偏好迁移时进入；执行内容: 空库直接写最终四字段设置形状。
  if (targetSchemaVersion >= BROWSER_PERSISTENCE_SCHEMA_VERSION.homeDisplayPreferencesRefresh) {
    settingsRecord.homeDisplayPreferences = cloneValidatedHomeDisplayPreferences(createDefaultHomeDisplayPreferences());
  }
  await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings).add(settingsRecord);
}

/**
 * 比较数据库已采用发布与当前应用内置目录发布。
 * 纯函数: 不访问 IndexedDB 或修改发布对象；true 表示调用方必须在 Runtime 恢复前执行原子对账，false 表示可只读返回。
 * 成功路径: 本地缺少发布记录或 revision 较旧时返回 true；四字段完全一致时返回 false。
 * 失败路径: 本地 revision 较新、结构版本不兼容，或相同 revision 的 version/fingerprint 冲突时失败关闭。
 *
 * @param {object|undefined} localRelease appMeta 保存的历史发布身份；旧库可缺失。
 * @param {Readonly<object>} currentRelease 已验证的当前应用发布身份。
 * @returns {boolean} true 需要升级；false 已是当前发布且禁止重复写入。
 * @throws {BrowserPersistenceError|TypeError} 当本地发布不能被当前应用安全采用时抛出。
 */
function compareBuiltinCatalogReleases(localRelease, currentRelease) {
  // 条件分支: v23 及更早数据库没有独立目录发布记录时进入；执行内容: 安排一次当前目录对账建立新权威。
  if (localRelease === undefined) return true;

  // 类型: Readonly<object>；作用: 历史记录进入比较前复用与当前输入相同的精确字段校验。
  const normalizedLocalRelease = normalizeBuiltinCatalogRelease(
    localRelease,
    'browserPersistence.appMeta.builtinCatalogRelease'
  );
  // 条件分支: 发布身份结构版本不一致时进入；执行内容: 当前代码不能猜测未知结构字段或迁移方式。
  if (normalizedLocalRelease.schemaVersion !== currentRelease.schemaVersion) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted,
      '内置目录发布身份结构版本不兼容'
    );
  }
  // 条件分支: 浏览器保存的 revision 高于当前应用时进入；执行内容: 禁止旧前端覆盖由新版本发布的 Provider。
  if (normalizedLocalRelease.revision > currentRelease.revision) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted,
      '当前应用内置目录版本低于浏览器已保存版本，禁止降级'
    );
  }
  // 条件分支: 当前应用 revision 更高时进入；执行内容: 允许调用方原子采用当前系统 Package、Definition 和授权。
  if (normalizedLocalRelease.revision < currentRelease.revision) return true;

  // 条件分支: revision 相同但可读版本或内容指纹不同时进入。
  // 执行内容: 视为发布流程漏升 revision 或元信息损坏，禁止静默覆盖和伪装无变化。
  if (normalizedLocalRelease.version !== currentRelease.version
    || normalizedLocalRelease.fingerprint !== currentRelease.fingerprint) {
    throw new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted,
      '内置目录相同 revision 对应的发布内容不一致'
    );
  }

  return false;
}

/**
 * 单一浏览器持久化数据库门面。
 * 状态所有权: 私有连接、初始化 Promise、生命周期状态和最后不可用错误只属于当前实例。
 * 并发规则: 并发 initialize 复用同一 Promise；所有保存原子性由 IndexedDB transaction.done 决定。
 * 资源边界: close、blocking 和 terminated 都释放连接；调用方不能取得私有 IDBDatabase。
 */
export class BrowserPersistenceDatabase {
  // 类型: string；作用: 当前门面绑定的数据库名称，构造后只读。
  #databaseName;
  // 类型: number；作用: 当前门面请求的 schema 整数版本，构造后只读。
  #databaseVersion;
  // 类型: IDBDatabase|null；作用: initialize 成功后的唯一私有连接，关闭或终止时清空。
  #database = null;
  // 类型: Promise<void>|null；作用: 去重并发初始化，失败后清空以允许显式重试。
  #initializationPromise = null;
  // 类型: string；作用: 记录 new、opening、ready、unavailable 或 closed 生命周期状态。
  #status = 'new';
  // 类型: BrowserPersistenceError|null；作用: 保存 blocking、terminated 或 close 后后续调用应得到的稳定失败。
  #unavailableError = null;

  /**
   * 创建数据库门面。
   * 副作用: 只保存配置，不立即打开 IndexedDB。
   *
   * @param {object} options 数据库配置。
   * @param {string} options.databaseName 数据库名称；正式应用使用集中默认值，测试使用唯一名称。
   * @param {number} options.databaseVersion schema 正整数版本。
   */
  constructor(options = {
    databaseName: BROWSER_PERSISTENCE_DATABASE_NAME,
    databaseVersion: BROWSER_PERSISTENCE_DATABASE_VERSION
  }) {
    // 类型: Readonly<object>；作用: 在保存实例字段前完成名称和版本严格校验。
    const normalizedOptions = normalizeDatabaseOptions(options);
    this.#databaseName = normalizedOptions.databaseName;
    this.#databaseVersion = normalizedOptions.databaseVersion;
  }

  /**
   * 打开数据库、完成 schema 升级、首次种子和内置目录启动对账。
   * 副作用: 创建一个 IndexedDB 连接；空库写入全部种子，旧目录只在四仓事务中采用当前系统发布。
   * 成功路径: 并发调用共享同一 Promise；Runtime 读取 Provider 前，数据库已采用当前或明确拒绝不安全版本。
   * 失败路径: blocked、迁移、种子、目录冲突、配额或损坏状态抛稳定 BrowserPersistenceError，不回退其他存储。
   *
   * @param {object} options 初始化输入。
   * @param {object} options.sourceSeeds 数据源四类分离种子。
   * @param {object} options.userContentSeed 用户内容首次游客种子。
   * @param {object} options.builtinCatalogRelease 当前内置目录 schemaVersion、revision、version 和 fingerprint。
   * @param {ReadonlyArray<string>} options.legacyProductSourceIds v3 精确退役的旧产品模拟身份。
   * @param {ReadonlyArray<string>} options.retiredBuiltinSourceIds v20 精确退役的历史系统身份。
   * @param {ReadonlyArray<string>} options.replacedPublicBuiltinSourceIds v26 精确替换的旧公开模拟系统身份。
   * @returns {Promise<void>} 数据库可供 Repository 使用时完成。
   */
  async initialize(options) {
    // 条件分支: 当前门面已经关闭时进入。
    // 执行内容: 阻止旧门面静默重开；显式重试需创建新的数据库门面实例。
    if (this.#status === 'closed') {
      throw new BrowserPersistenceError(
        BROWSER_PERSISTENCE_ERROR_CODE.operationFailed,
        '数据库门面已关闭，不能重新初始化'
      );
    }
    // 条件分支: blocking 或 terminated 已使当前连接不可用时进入。
    // 执行内容: 返回已保存稳定错误；显式恢复必须创建新门面，不能复用旧成功 Promise 伪装 ready。
    if (this.#status === 'unavailable') throw this.#unavailableError;
    // 条件分支: 当前实例已经存在初始化 Promise 时进入。
    // 执行内容: 并发或后续调用复用同一真实初始化结果，不重复打开连接或播种。
    if (this.#initializationPromise) return this.#initializationPromise;

    // 类型: Readonly<object>；作用: 在异步打开前隔离并冻结全部种子和版本输入。
    const normalizedOptions = normalizeInitializationOptions(options);
    // 副作用: 保存唯一初始化 Promise，收敛同一实例并发启动。
    this.#initializationPromise = this.#initializeOnce(normalizedOptions);

    try {
      await this.#initializationPromise;
    } catch (error) {
      // 失败补偿: 关闭可能已经打开的连接并清空 Promise，允许调用方显式再次调用 initialize。
      // 条件分支: 打开请求已经产生连接后种子失败时进入。
      // 执行内容: 关闭失败连接，数据库内容由原生事务保持未提交状态。
      if (this.#database) this.#database.close();
      this.#database = null;
      this.#initializationPromise = null;
      // 条件分支: 用户没有在失败期间主动 close 当前门面时进入。
      // 执行内容: 恢复 new，允许调用方显式重新执行初始化而不自动重试。
      if (this.#status !== 'closed') this.#status = 'new';
      throw error;
    }
  }

  /**
   * 在只读事务中执行 Repository 查询。
   * 副作用: 创建最小 readonly transaction；executor 不能替换数据库连接。
   * 成功路径: executor 和 transaction.done 均完成后返回隔离查询结果。
   * 失败路径: 连接、executor 或原生事务失败时抛稳定持久化错误。
   *
   * @param {Array<string>} storeNames 查询需要的正式 store。
   * @param {Function} executor 接收 idb transaction 的内部 Repository 执行器。
   * @returns {Promise<*>} executor 结果，transaction.done 完成后返回。
   */
  async runReadonly(storeNames, executor) {
    return this.#runTransaction(storeNames, 'readonly', executor);
  }

  /**
   * 在原生读写事务中执行 Repository 写入。
   * 副作用: 创建覆盖指定 store 的单一 readwrite transaction；只有 transaction.done 表示提交。
   * 成功路径: executor 完成且 transaction.done 提交后返回结果。
   * 失败路径: executor 抛错时主动 abort，原生事务失败或配额不足转换为稳定持久化错误。
   *
   * @param {Array<string>} storeNames 写入需要的正式 store。
   * @param {Function} executor 接收 idb transaction 的内部 Repository 执行器。
   * @returns {Promise<*>} 提交后的 executor 结果。
   */
  async runReadwrite(storeNames, executor) {
    return this.#runTransaction(storeNames, 'readwrite', executor);
  }

  /**
   * 主动关闭当前门面连接。
   * 副作用: 释放 IDBDatabase 并永久关闭当前实例；不删除数据库内容。
   *
   * @returns {void}
   */
  close() {
    // 条件分支: 当前门面持有已打开连接时进入。
    // 执行内容: 立即释放连接，不删除任何已提交数据库内容。
    if (this.#database) this.#database.close();
    this.#database = null;
    this.#status = 'closed';
    this.#unavailableError = new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.operationFailed,
      '数据库门面已关闭'
    );
  }

  /**
   * 删除当前数据库。
   * 副作用: 关闭当前门面并调用 idb deleteDB；只供自动测试或明确全部本地数据重置入口使用。
   * 成功路径: 原生删除事务完成后返回，不创建新数据库。
   * 失败路径: 删除被其他连接阻塞或原生删除失败时抛稳定错误。
   *
   * @returns {Promise<void>} 删除请求完成时返回。
   */
  async deleteDatabase() {
    this.close();
    try {
      await deleteDB(this.#databaseName, {
        /**
         * 处理数据库删除被其他连接阻塞。
         * 副作用: 中断当前删除 Promise，不关闭其他页面连接。
         *
         * @returns {void}
         * @throws {BrowserPersistenceError} 始终以 blocked 稳定错误失败。
         */
        blocked() {
          throw new BrowserPersistenceError(
            BROWSER_PERSISTENCE_ERROR_CODE.blocked,
            '其他页面连接阻塞数据库删除'
          );
        }
      });
    } catch (error) {
      throw createBrowserPersistenceError(
        BROWSER_PERSISTENCE_ERROR_CODE.operationFailed,
        '删除浏览器数据库失败',
        error
      );
    }
  }

  /**
   * 执行一次真实数据库初始化。
   * 副作用: 打开连接、必要时创建 schema，并检查或写入首次种子。
   * 成功路径: 保存唯一连接并把状态置为 ready。
   * 失败路径: unsupported、blocked、迁移或种子失败时抛稳定错误并由 initialize 释放资源。
   *
   * @param {object} options 已隔离初始化输入。
   * @returns {Promise<void>} 连接和种子可用时完成。
   */
  async #initializeOnce(options) {
    // 条件分支: 当前环境没有 IndexedDB 全局工厂时进入。
    // 执行内容: 明确报告不支持，不创建 Memory、localStorage 或其他回退。
    if (typeof globalThis.indexedDB === 'undefined') {
      throw new BrowserPersistenceError(
        BROWSER_PERSISTENCE_ERROR_CODE.unsupported,
        '当前环境不支持 IndexedDB'
      );
    }

    // 状态变化: 标记打开流程开始；只有 schema 和首次种子都完成后才改为 ready。
    this.#status = 'opening';
    // 类型: boolean；作用: 记录本次 openDB 是否触发 blocked，用于关闭迟到成功连接。
    let blocked = false;
    // 类型: Function|undefined；作用: 保存 blocked 竞态 Promise 的 reject 入口，只在 openDB 回调调用。
    let rejectBlocked;
    // 类型: boolean；作用: 标记本次 openDB 已进入 upgrade 回调，使异步事务失败也归入 migrationFailed。
    let upgradeAttempted = false;
    // 类型: *|null；作用: 保存 upgrade 原始失败，确保 openDB AbortError 不覆盖真实迁移 cause。
    let upgradeFailure = null;
    // 类型: Promise<void>|null；作用: 保存异步领域迁移链，确保读取、删除和写入失败统一中止 upgrade transaction。
    let upgradeMigrationPromise = null;
    // 类型: Promise<*>|null；作用: 等待原生 upgrade transaction 的 complete/abort 事件完全结算，禁止迟到 AbortError 泄漏到初始化调用方之外。
    let upgradeTransactionCompletionPromise = null;
    // 类型: Promise<never>；作用: openDB blocked 回调立即拒绝初始化，不轮询或固定等待旧连接。
    const blockedPromise = new Promise((resolve, reject) => {
      rejectBlocked = reject;
    });

    // 类型: Promise<IDBPDatabase>；作用: 保存真实 idb 打开请求，blocked 竞态失败后若迟到成功会立即关闭连接。
    const openPromise = openDB(this.#databaseName, this.#databaseVersion, {
      /**
       * 执行当前版本 schema 迁移。
       * 副作用: 只修改 openDB 提供的 upgrade transaction。
       *
       * @param {IDBDatabase} database 待升级数据库代理。
       * @param {number} oldVersion 升级前版本，新库为 0。
       * @param {number|null} newVersion 当前打开请求目标版本。
       * @param {IDBTransaction} transaction idb 提供的唯一 upgrade transaction。
       * @returns {void}
       */
      upgrade: (database, oldVersion, newVersion, transaction) => {
        // 状态变化: 记录本次打开已经进入 schema 迁移，后续 AbortError 必须归入迁移失败。
        upgradeAttempted = true;
        // 异步边界: 立即登记事务结算 Promise；拒绝值转换为返回值，最终稳定错误仍由下方初始化 catch 统一生成。
        upgradeTransactionCompletionPromise = transaction.done.then(
          () => null,
          error => error
        );
        // 异步边界: v1/v2 结构迁移与 v3/v4/v5/v6/v7/v8 领域迁移共享同一 Promise 和原生 upgrade transaction。
        upgradeMigrationPromise = runSchemaMigrations(
          database,
          transaction,
          oldVersion,
          newVersion,
          options
        );
        // 失败补偿: 保存异步迁移 cause 并显式中止当前 upgrade transaction。
        // 不从事件处理器继续抛出，避免浏览器把事件异常报告为脱离初始化 Promise 的未捕获错误。
        upgradeMigrationPromise.catch((error) => {
          upgradeFailure = error;
          try {
            transaction.abort();
          } catch {
            // 清理说明: 事务已因请求失败自动中止时无需再次 abort，原迁移错误继续作为 cause。
          }
        });
      },
      /**
       * 处理旧连接阻塞升级。
       * 副作用: 标记本次打开失败并拒绝 blockedPromise，不轮询等待。
       *
       * @returns {void}
       */
      blocked: () => {
        blocked = true;
        rejectBlocked(new BrowserPersistenceError(
          BROWSER_PERSISTENCE_ERROR_CODE.blocked,
          '旧数据库连接阻塞版本升级'
        ));
      },
      /**
       * 处理其他页面请求更高数据库版本。
       * 副作用: 关闭当前连接并使本门面后续事务稳定失败。
       *
       * @returns {void}
       */
      blocking: () => {
        // 条件分支: 当前门面仍持有被升级阻塞的连接时进入。
        // 执行内容: 按 IndexedDB versionchange 要求主动关闭，允许新版本继续升级。
        if (this.#database) this.#database.close();
        this.#database = null;
        this.#status = 'unavailable';
        this.#unavailableError = new BrowserPersistenceError(
          BROWSER_PERSISTENCE_ERROR_CODE.blocked,
          '当前连接因其他页面升级数据库而关闭'
        );
      },
      /**
       * 处理浏览器异常终止数据库连接。
       * 副作用: 清空私有连接并保存 terminated 错误供后续调用返回。
       *
       * @returns {void}
       */
      terminated: () => {
        this.#database = null;
        this.#status = 'unavailable';
        this.#unavailableError = new BrowserPersistenceError(
          BROWSER_PERSISTENCE_ERROR_CODE.terminated,
          '浏览器异常终止数据库连接'
        );
      }
    });

    // 资源清理: blocked 已经使初始化失败时，迟到打开的连接不能泄漏为第二条可用路径。
    openPromise.then((database) => {
      // 条件分支: blocked 已经使本次初始化失败，但原打开请求随后成功时进入。
      // 执行内容: 立即关闭迟到连接，防止失败路径泄漏可用数据库实例。
      if (blocked) database.close();
    }).catch(() => undefined);

    try {
      this.#database = await Promise.race([openPromise, blockedPromise]);
      // 条件分支: 本次打开执行过 schema 或领域迁移时进入。
      // 执行内容: openDB 成功后显式等待同一迁移 Promise，确认读取、写入和事务采用链已经完整收敛。
      if (upgradeMigrationPromise) await upgradeMigrationPromise;
    } catch (error) {
      // 异步边界: 原生 AbortError 可能先于迁移 Promise 的真实失败到达；先等待已登记链收敛，确保 cause 和 rejection 都被统一采用。
      // 条件分支: 当前打开过程已经登记领域迁移 Promise 时进入。
      // 执行内容: 消费该 Promise 的最终拒绝，真实失败仍由 upgradeFailure 进入统一 BrowserPersistenceError cause。
      if (upgradeMigrationPromise) {
        await upgradeMigrationPromise.catch(() => undefined);
      }
      // 异步边界: 等待原生事务 abort/complete 事件结算，避免初始化已经返回稳定错误后再泄漏迟到 AbortError。
      // 条件分支: 当前打开过程已经取得 upgrade transaction 完成 Promise 时进入。
      // 执行内容: 等待 abort 或 complete 事件收敛，再向调用方发布唯一稳定失败。
      if (upgradeTransactionCompletionPromise) {
        await upgradeTransactionCompletionPromise;
      }
      // 类型: boolean；作用: 把打开高版本数据库时的原生 VersionError 归入迁移失败，而不是普通操作失败。
      const versionFailure = error && typeof error === 'object' && error.name === 'VersionError';
      throw createBrowserPersistenceError(
        upgradeAttempted || versionFailure
          ? BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed
          : BROWSER_PERSISTENCE_ERROR_CODE.operationFailed,
        upgradeAttempted || versionFailure ? '浏览器数据库迁移失败' : '打开浏览器数据库失败',
        upgradeFailure || error
      );
    }

    try {
      await this.#seedWhenEmpty(options);
      // 启动屏障: schema 和首次种子完成后、Runtime 恢复脚本前比较独立目录发布；失败时门面不能进入 ready。
      await this.#reconcileBuiltinCatalogRelease(options);
      this.#status = 'ready';
      this.#unavailableError = null;
    } catch (error) {
      throw createBrowserPersistenceError(
        error instanceof BrowserPersistenceError
          ? error.code
          : BROWSER_PERSISTENCE_ERROR_CODE.seedFailed,
        '浏览器数据库初始化或内置目录对账失败',
        error
      );
    }
  }

  /**
   * 在真正空库中原子写入全部首次种子。
   * 副作用: 创建覆盖九仓的 readwrite transaction；已有 initialized 事实时只读取并返回。
   * 成功路径: 已初始化库不改写；真正空库提交全部种子、初始化事实和当前目录发布身份。
   * 失败路径: 部分业务数据、请求失败或配额不足时 abort 并保留原数据库。
   *
   * @param {object} options 已验证初始化输入。
   * @returns {Promise<void>} 已存在初始化事实或首次事务提交后完成。
   */
  async #seedWhenEmpty(options) {
    // 类型: IDBTransaction；作用: 首次种子唯一九仓 readwrite transaction，done 是提交事实。
    const transaction = this.#database.transaction(BROWSER_PERSISTENCE_ALL_STORE_NAMES, 'readwrite');
    try {
      // 类型: IDBObjectStore；作用: 读取并最终写入初始化和种子版本元信息。
      const metaStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta);
      // 类型: object|undefined；作用: 复核 upgrade transaction 已提交当前目标 schemaVersion 事实。
      const schemaVersionRecord = await metaStore.get(BROWSER_PERSISTENCE_META_KEY.schemaVersion);
      // 条件分支: 元信息缺失或值与当前门面目标版本不一致时进入。
      // 执行内容: 视为迁移或保存图损坏并 abort，不能继续播种或读取业务数据。
      if (!schemaVersionRecord || schemaVersionRecord.value !== this.#databaseVersion) {
        throw new BrowserPersistenceError(
          BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted,
          '数据库 schema 版本元信息与当前结构不一致'
        );
      }
      // 类型: object|undefined；作用: 判断该数据库是否已经完整提交过首次种子。
      const initializedRecord = await metaStore.get(BROWSER_PERSISTENCE_META_KEY.initialized);
      // 条件分支: 首次种子已经完整提交时进入。
      // 执行内容: 不读取或覆盖新传入种子，只等待本次只读事务结束。
      if (initializedRecord && initializedRecord.value === true) {
        await transaction.done;
        return;
      }

      // 类型: Array<number>；作用: 统计八个业务 store，防止无 appMeta 的部分数据库被误判为空库并覆盖。
      const businessCounts = await Promise.all(
        BROWSER_PERSISTENCE_BUSINESS_STORE_NAMES.map((storeName) => {
          return transaction.objectStore(storeName).count();
        })
      );
      // 条件分支: 任一业务 store 已有数据但没有 initialized 事实时进入。
      // 执行内容: 视为损坏或中断状态并 abort，不自动清库或重播种。
      if (businessCounts.some(count => count > 0)) {
        throw new BrowserPersistenceError(
          BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted,
          '数据库存在业务数据但缺少初始化元信息'
        );
      }

      await seedSourceStores(transaction, options.sourceSeeds);
      await seedUserContentStores(transaction, options.userContentSeed, this.#databaseVersion);
      await metaStore.add({
        key: BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease,
        value: options.builtinCatalogRelease
      });
      await metaStore.add({ key: BROWSER_PERSISTENCE_META_KEY.initialized, value: true });
      // 提交事实: 只有九仓 transaction.done 完成后，调用方才能把数据库视为已初始化。
      await transaction.done;
    } catch (error) {
      // 失败补偿: executor 或请求失败时中止尚未完成事务，避免部分种子提交。
      try {
        transaction.abort();
      } catch {
        // 清理说明: 已完成或已中止事务会拒绝再次 abort，原始失败仍是调用方需要的 cause。
      }
      try {
        await transaction.done;
      } catch {
        // 清理说明: 预期 abort reject 只确认回滚完成，不覆盖原始错误。
      }
      throw error;
    }
  }

  /**
   * 在 Runtime 恢复 Provider 前对账独立内置目录发布。
   * 副作用: 创建仅覆盖 appMeta、Package、Definition 和 Preferences 的 readwrite transaction；Storage 与用户四仓不可访问。
   * 成功路径: 相同发布只读返回；旧库或较旧 revision 复用唯一系统源对账器原子采用当前发布并清理旧 seedVersion。
   * 失败路径: 降级、同 revision 内容冲突、历史保存图损坏或事务失败时 abort，旧 Package 和发布记录完整保留。
   *
   * @param {Readonly<object>} options 已验证初始化输入及当前目录发布身份。
   * @returns {Promise<void>} 无需更新或目录对账事务完整提交后完成。
   * @throws {BrowserPersistenceError} 当发布比较、历史保存图或事务无法安全完成时抛出。
   */
  async #reconcileBuiltinCatalogRelease(options) {
    // 类型: IDBTransaction；作用: 普通启动目录对账的唯一四仓事务，物理上阻止私有空间和用户数据被改写。
    const transaction = this.#database.transaction(BUILTIN_SOURCE_CATALOG_STORE_NAMES, 'readwrite');
    try {
      // 类型: IDBObjectStore；作用: 读取独立目录发布记录和一次性旧 seedVersion，不读取页面或 Provider 私有状态。
      const metaStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta);
      // 类型: Array<object|undefined>；作用: 在同一事务快照中取得当前发布和待清理旧元信息。
      const [releaseRecord, legacySeedVersionRecord] = await Promise.all([
        metaStore.get(BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease),
        metaStore.get(BROWSER_PERSISTENCE_META_KEY.legacySeedVersion)
      ]);
      // 类型: boolean；作用: true 要求原子采用当前目录，false 表示发布四字段完全一致且禁止重复写入。
      const shouldReconcile = compareBuiltinCatalogReleases(
        releaseRecord?.value,
        options.builtinCatalogRelease
      );

      // 条件分支: 当前发布已经完整采用时进入。
      // 执行内容: 不重写 Package、Definition、Preferences 或发布记录；只允许一次性移除旧混合版本键。
      if (!shouldReconcile) {
        // 条件分支: 已采用当前发布但仍残留 v23 及更早 seedVersion 时进入；执行内容: 只删除一次旧键。
        if (legacySeedVersionRecord !== undefined) {
          await metaStore.delete(BROWSER_PERSISTENCE_META_KEY.legacySeedVersion);
        }
        await transaction.done;
        return;
      }

      // 跨层边界: 普通启动和 schema 迁移复用同一系统源对账核心，避免建立第二条补写路径。
      await reconcileBuiltinSourceCatalog(transaction, options);
      // 提交事实: 新脚本、Definition、授权和发布身份只有 transaction.done 后同时可见。
      await transaction.done;
    } catch (error) {
      // 失败补偿: 比较、读取或对账失败时中止四仓事务，禁止发布元信息领先于真实 Package。
      try {
        transaction.abort();
      } catch {
        // 清理说明: 事务已失败或完成时无需再次 abort，原始错误继续作为 cause。
      }
      try {
        await transaction.done;
      } catch {
        // 清理说明: 预期 abort reject 只确认回滚，不覆盖目录冲突或保存图损坏原因。
      }
      // 条件分支: 比较或对账核心已经给出稳定领域错误时进入；执行内容: 原样保留 code 和消息。
      if (error instanceof BrowserPersistenceError) throw error;
      throw createBrowserPersistenceError(
        BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted,
        '内置目录启动对账失败',
        error
      );
    }
  }

  /**
   * 执行受控 readonly 或 readwrite 事务。
   * 副作用: 创建最小 store 集合事务，等待 executor 和 transaction.done；失败时中止未提交写事务。
   * 成功路径: 返回 transaction.done 之后的 executor 结果。
   * 失败路径: 参数、连接、executor、请求或提交失败时抛稳定持久化错误。
   *
   * @param {Array<string>} storeNames 正式 store 名称集合。
   * @param {string} mode readonly 或 readwrite。
   * @param {Function} executor Repository 内部事务执行器。
   * @returns {Promise<*>} 真实提交后的 executor 结果。
   */
  async #runTransaction(storeNames, mode, executor) {
    // 类型: ReadonlyArray<string>；作用: 冻结本次事务允许访问的正式 store 范围。
    const normalizedStoreNames = normalizeStoreNames(storeNames);
    // 条件分支: executor 不是函数时进入。
    // 执行内容: 在创建事务前拒绝无执行契约的输入。
    if (typeof executor !== 'function') {
      throw new TypeError('browserPersistence executor 必须是函数');
    }
    // 类型: IDBDatabase；作用: 取得当前唯一 ready 连接，不触发重开或回退。
    const database = this.#requireReadyDatabase();
    // 类型: IDBTransaction；作用: 覆盖已验证 store 的本次原生事务。
    const transaction = database.transaction(normalizedStoreNames, mode);

    try {
      // 类型: *；作用: 保存 executor 候选结果，只有 transaction.done 后才允许返回。
      const result = await executor(transaction);
      await transaction.done;
      return result;
    } catch (error) {
      // 失败补偿: readwrite executor 失败时明确 abort；readonly abort 只用于尽快释放游标和请求。
      try {
        transaction.abort();
      } catch {
        // 清理说明: 原生事务已经完成或失败时无需二次中止，保留原始 cause。
      }
      try {
        await transaction.done;
      } catch {
        // 清理说明: abort reject 是预期清理结果，不替换 executor 或原生请求错误。
      }
      throw createBrowserPersistenceError(
        BROWSER_PERSISTENCE_ERROR_CODE.operationFailed,
        `浏览器数据库 ${mode} 事务失败`,
        error
      );
    }
  }

  /**
   * 取得当前可用数据库连接。
   * 副作用: 无；不重开连接、不创建回退，连接无效时抛最后稳定错误。
   *
   * @returns {IDBDatabase} 当前 idb 数据库代理，仅在内部事务创建期间使用。
   */
  #requireReadyDatabase() {
    // 条件分支: 当前状态与私有连接同时表明数据库可用时进入。
    // 执行内容: 只把连接返回给本类内部事务创建，不向公开调用方暴露。
    if (this.#status === 'ready' && this.#database) return this.#database;
    throw this.#unavailableError || new BrowserPersistenceError(
      BROWSER_PERSISTENCE_ERROR_CODE.operationFailed,
      '浏览器数据库尚未完成初始化'
    );
  }
}
