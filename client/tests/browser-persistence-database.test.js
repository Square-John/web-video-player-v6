/*
  browser-persistence-database.test.js 模块说明

  - 文件职责:
      使用 fake-indexeddb 验证 BrowserPersistenceDatabase 的九仓 schema、连续升级、首次种子和事务回滚。
      覆盖 blocked、blocking、terminated、QuotaExceeded、迁移失败和损坏对象的稳定失败关闭。
      测试只替换浏览器 IndexedDB 实现，不引入 Memory Repository 或备用保存路径。

  - 导入库及文件汇总(15 条，内置 2 条，第三方 2 条，自定义 11 条):
      node:assert/strict: 内置断言，验证 schema、记录和错误不变量。
      node:test: 内置测试运行器，隔离数据库门面用例。
      fake-indexeddb/auto: 第三方测试环境，在 Node 全局安装 IndexedDB API。
      fake-indexeddb: 第三方测试工具，触发浏览器异常终止连接事件。
      browserPersistence.config: 自定义配置，读取正式 store、索引与元信息名称。
      mediaPlayback.config: 自定义配置，构造 v11 默认快捷键保存对象期望。
      homeDisplay.config: 自定义配置，构造 v12 默认首页展示偏好期望。
      BrowserPersistenceDatabase: 自定义数据库门面，被测连接、种子和事务对象。
      BrowserPersistenceError: 自定义错误，验证稳定失败类型和 code。
      builtinSourceCatalogRelease/LEGACY_PRODUCT_SOURCE_IDS/RETIRED_BUILTIN_SOURCE_IDS/sourceRepositorySeeds: 自定义数据，提供当前目录发布、迁移身份与首次种子。
      mockSourceRepositorySeeds: 自定义测试数据，提供 v2 旧九源迁移前置保存图。
      userContentMockData: 自定义数据，提供当前游客首次种子。
      source-manager.config: 自定义枚举，构造无关自定义源的类型、入口和待授权状态。
      SOURCE_STORAGE_PARTITION: 自定义 Repository 枚举，写入正式缓存分区。
      createSourceScriptHash: 自定义授权工具，为 v3 旧脚本夹具生成与产品一致的 SHA-256。

  - 模块级常量:
      TEST_DATABASE_PREFIX: string，测试数据库唯一名称前缀。
      系统数据源1_SOURCE_ID: string，v4 至当前版本脚本刷新与系统记录恢复目标身份。
      PRESERVED_DEFAULT_SOURCE_ID: string，迁移保留默认源决定的夹具身份。
      PRESERVED_HIDDEN_SOURCE_ID: string，迁移保留软隐藏决定的夹具身份。
      VERSION_THREE_CATALOG_TIME: string，v3 Definition 首次导入与更新时间夹具。

  - 模块级变量:
      databaseSequence: number，当前测试进程内递增数据库序号。

  - 模块级辅助函数:
      createDatabaseName(): 创建不会与正式库或其他用例碰撞的测试数据库名。
      createInitializationOptions(): 创建与调用方引用隔离的初始化输入。
      createHistoricalCatalogRelease(version, fingerprintCharacter): 创建 revision=0 的合法旧目录发布身份。
      createVersionThreeSourceSeeds(): 创建脚本、版本和授权均早于当前目录的合法 v3 种子。
      createVersionEightSourceSeeds(): 创建 Provider ABI 1.x、但包含 v8 搜索事务语义的当前目录种子。
      createVersionNineteenSourceSeeds(): 创建包含两条待退役系统源的合法 v19 保存图。
      createVersionTwelveSourceSeeds(): 创建仍使用类别后缀名称和上一补丁版本的 v12 当前目录种子。
      createVersionEightCustomSourceGraph(): 创建 v9 必须原样保留的 ABI 1.x 自定义源保存图。
      readPreservedRuntimeSnapshot(transaction): 读取系统源目录迁移不得改写的私有空间与用户四仓快照。
      createExpectedShortcutPreferences(): 创建与播放配置一致的默认快捷键保存对象。
      createExpectedHomeDisplayPreferences(): 创建 v12 默认首页展示偏好保存对象。
      assertRuntimePreservedWithShortcutMigration(actual, previous): 验证 v11 只扩展用户设置并保留其他保存域。
      createDatabase(databaseName, databaseVersion): 创建绑定名称和目标版本的数据库门面。
      openRawDatabase(databaseName, databaseVersion, upgrade): 打开原生连接以制造版本与阻塞场景。
      captureNextRawConnection(): 捕获 idb 打开请求的底层连接以触发 terminated。

  - 模块级类:
      无

  - 对外导出:
      无
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证数据库行为与稳定失败。
import assert from 'node:assert/strict';

// 导入来源: node:test；导入内容: test；文件作用: 声明独立异步数据库用例。
import test from 'node:test';

// 导入来源: fake-indexeddb/auto；导入内容: Node IndexedDB 全局实现；文件作用: 让 idb 运行真实请求与事务语义。
import 'fake-indexeddb/auto';

// 导入来源: fake-indexeddb。
// 导入内容: forceCloseDatabase 测试连接终止工具。
// 文件作用: 触发与浏览器异常终止等价的 close 事件，验证数据库门面稳定失效。
import { forceCloseDatabase } from 'fake-indexeddb';

import {
  // 导入来源: ../src/repositories/persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_ALL_STORE_NAMES；文件作用: 检查九仓完整性。
  BROWSER_PERSISTENCE_ALL_STORE_NAMES,
  // 导入来源: ../src/repositories/persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_DATABASE_VERSION；文件作用: 测试正式目标版本。
  BROWSER_PERSISTENCE_DATABASE_VERSION,
  // 导入来源: ../src/repositories/persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_INDEX；文件作用: 检查私有空间索引存在。
  BROWSER_PERSISTENCE_INDEX,
  // 导入来源: ../src/repositories/persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_META_KEY；文件作用: 定位初始化元信息。
  BROWSER_PERSISTENCE_META_KEY,
  // 导入来源: ../src/repositories/persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_SCHEMA_VERSION；文件作用: 创建 v1/v2 历史库并验证连续 v3 迁移。
  BROWSER_PERSISTENCE_SCHEMA_VERSION,
  // 导入来源: ../src/repositories/persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_STORE；文件作用: 创建精确事务范围。
  BROWSER_PERSISTENCE_STORE,
  // 导入来源: ../src/repositories/persistence/browserPersistence.config.js；导入内容: SOURCE_PREFERENCES_RECORD_KEY；文件作用: 读取唯一全局偏好记录。
  SOURCE_PREFERENCES_RECORD_KEY
} from '../src/repositories/persistence/browserPersistence.config.js';

import {
  // 导入来源: ../src/config/mediaPlayback.config.js；导入内容: DEFAULT_PLAYBACK_SHORTCUT_BINDINGS；文件作用: 构造 v11 默认绑定期望。
  DEFAULT_PLAYBACK_SHORTCUT_BINDINGS,
  // 导入来源: ../src/config/mediaPlayback.config.js；导入内容: PLAYBACK_SHORTCUT_PREFERENCES_SCHEMA_VERSION；文件作用: 验证 v11 设置结构版本。
  PLAYBACK_SHORTCUT_PREFERENCES_SCHEMA_VERSION
} from '../src/config/mediaPlayback.config.js';

// 导入来源: ../src/config/homeDisplay.config.js；导入内容: 首页展示偏好版本和数量边界；文件作用: 验证 v12 默认展示设置。
import {
  // 导入来源: ../src/config/homeDisplay.config.js；导入内容: HOME_DISPLAY_PREFERENCES_SCHEMA_VERSION；文件作用: 验证默认保存结构版本。
  HOME_DISPLAY_PREFERENCES_SCHEMA_VERSION,
  // 导入来源: ../src/config/homeDisplay.config.js；导入内容: HOME_CAROUSEL_ITEM_LIMIT；文件作用: 验证默认轮播数量。
  HOME_CAROUSEL_ITEM_LIMIT
} from '../src/config/homeDisplay.config.js';

// 导入来源: ../src/repositories/persistence/browserPersistenceDatabase.js。
// 导入内容: BrowserPersistenceDatabase 单连接数据库门面。
// 文件作用: 执行被测初始化、事务、关闭和删除行为。
import { BrowserPersistenceDatabase } from '../src/repositories/persistence/browserPersistenceDatabase.js';

import {
  // 导入来源: ../src/repositories/persistence/browserPersistenceErrors.js；导入内容: BROWSER_PERSISTENCE_ERROR_CODE；文件作用: 验证损坏和事务稳定错误码。
  BROWSER_PERSISTENCE_ERROR_CODE,
  // 导入来源: ../src/repositories/persistence/browserPersistenceErrors.js；导入内容: BrowserPersistenceError；文件作用: 验证原生失败已转换为统一类型。
  BrowserPersistenceError
} from '../src/repositories/persistence/browserPersistenceErrors.js';

import {
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: builtinSourceCatalogRelease；文件作用: 提供当前目录 revision、version 和确定性指纹。
  builtinSourceCatalogRelease,
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: LEGACY_PRODUCT_SOURCE_IDS；文件作用: 为 v3 测试提供精确旧身份集合。
  LEGACY_PRODUCT_SOURCE_IDS,
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: RETIRED_BUILTIN_SOURCE_IDS；文件作用: 为 v20 测试提供精确退役身份集合。
  RETIRED_BUILTIN_SOURCE_IDS,
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: sourceRepositorySeeds；文件作用: 提供正式当前系统源种子。
  sourceRepositorySeeds
} from '../src/data/settings/source-repository.seed.js';

// 导入来源: ./source-repository-test-fixtures.js；导入内容: mockSourceRepositorySeeds；文件作用: 构造包含旧九源的 v2 迁移前置保存图。
import { mockSourceRepositorySeeds } from './source-repository-test-fixtures.js';

import {
  // 导入来源: ../src/config/source-manager.config.js；导入内容: AUTHORIZATION_STATUS；文件作用: 构造未授权自定义源偏好。
  AUTHORIZATION_STATUS,
  // 导入来源: ../src/config/source-manager.config.js；导入内容: IMPORT_METHOD；文件作用: 声明自定义源由文本导入。
  IMPORT_METHOD,
  // 导入来源: ../src/config/source-manager.config.js；导入内容: SOURCE_KIND；文件作用: 声明无关保存图属于自定义源。
  SOURCE_KIND
} from '../src/config/source-manager.config.js';

// 导入来源: ../src/repositories/source/sourceRepositoryUtils.js；导入内容: SOURCE_STORAGE_PARTITION；文件作用: 写入正式缓存分区而不散落字符串。
import { SOURCE_STORAGE_PARTITION } from '../src/repositories/source/sourceRepositoryUtils.js';

// 导入来源: ../src/utils/sourceAuthorization.js。
// 导入内容: createSourceScriptHash 规范化脚本文本指纹函数。
// 文件作用: 为 v3 系统数据源1 脚本夹具生成与正式 SourcePackage 相同算法的完整性摘要。
import { createSourceScriptHash } from '../src/utils/sourceAuthorization.js';

// 导入来源: ../src/data/user-content.mock.js；导入内容: userContentMockData；文件作用: 提供游客资料、收藏、历史和恢复策略首次种子。
import { userContentMockData } from '../src/data/user-content.mock.js';

// 类型: string；作用: 测试数据库名称前缀，明确隔离正式 Web Video Player 数据库。
const TEST_DATABASE_PREFIX = 'web-video-player-test-';

// 类型: string；作用: 标识 v4 至当前版本必须从历史记录恢复到当前目录版本的 系统数据源1 系统源。
const SYSTEM_SOURCE_1_SOURCE_ID = 'source.system.1';

// 类型: string；作用: 目录迁移前由用户选择的默认源，升级后必须原样保留。
const PRESERVED_DEFAULT_SOURCE_ID = 'source.system.4';

// 类型: string；作用: 目录迁移前由用户软隐藏的系统源，升级后不得自动恢复。
const PRESERVED_HIDDEN_SOURCE_ID = SYSTEM_SOURCE_1_SOURCE_ID;

// 类型: string；作用: v3 目录首次导入与更新时间，证明 v4 只保留 importedAt 并采用当前 lastUpdatedAt。
const VERSION_THREE_CATALOG_TIME = '2026-07-20T00:00:00.000Z';

// 类型: string；作用: 标识 v12 旧名称目录最后更新时间，v13 必须采用新发布时间但保留更早 importedAt。
const VERSION_TWELVE_CATALOG_TIME = '2026-07-22T00:00:00.000Z';

// 类型: string；作用: 标识 v8 到 v9 迁移必须保留、但不得升级脚本 ABI 的自定义源。
const VERSION_EIGHT_CUSTOM_SOURCE_ID = 'source.custom.version-eight';

// 类型: string；作用: 为 v8 自定义源建立与 Package、Definition 一致的独立 Provider 注册键。
const VERSION_EIGHT_CUSTOM_PROVIDER_KEY = `${VERSION_EIGHT_CUSTOM_SOURCE_ID}.provider`;

// 类型: string；作用: 固定 v8 自定义源的稳定 Package 主键，迁移后不得被系统源对账器重写。
const VERSION_EIGHT_CUSTOM_PACKAGE_REF = `source-package::${VERSION_EIGHT_CUSTOM_SOURCE_ID}`;

// 类型: number；生命周期: 当前 Node 测试进程；作用: 保证同毫秒创建的数据库名仍然唯一。
let databaseSequence = 0;

/**
 * 创建测试数据库唯一名称。
 * 副作用: 递增当前测试模块序号，不访问 IndexedDB。
 *
 * @returns {string} 不与正式数据库碰撞的测试名称。
 */
function createDatabaseName() {
  databaseSequence += 1;
  return `${TEST_DATABASE_PREFIX}${databaseSequence}`;
}

/**
 * 创建数据库初始化输入。
 * 纯函数: 使用 structuredClone 切断每个用例对正式种子模块的引用。
 *
 * @returns {object} Source、UserContent 和当前内置目录发布完整输入。
 */
function createInitializationOptions() {
  return {
    sourceSeeds: structuredClone(sourceRepositorySeeds),
    userContentSeed: structuredClone(userContentMockData),
    builtinCatalogRelease: structuredClone(builtinSourceCatalogRelease),
    legacyProductSourceIds: LEGACY_PRODUCT_SOURCE_IDS,
    retiredBuiltinSourceIds: RETIRED_BUILTIN_SOURCE_IDS
  };
}

/**
 * 创建早于当前 revision 的合法目录发布身份。
 * 纯函数: 使用固定结构版本和调用方可读版本生成测试对象，不修改正式发布常量。
 * 成功路径: revision=0 可驱动普通启动升级和历史 schema 迁移夹具。
 * 失败路径: 无；fingerprintCharacter 由测试调用方负责传入单个小写十六进制字符。
 *
 * @param {string} version 历史目录可读版本。
 * @param {string} fingerprintCharacter 重复 64 次形成测试 SHA-256 的小写十六进制字符。
 * @returns {object} 可通过数据库发布身份校验的历史 release。
 */
function createHistoricalCatalogRelease(version, fingerprintCharacter) {
  return {
    schemaVersion: builtinSourceCatalogRelease.schemaVersion,
    revision: 0,
    version,
    fingerprint: fingerprintCharacter.repeat(64)
  };
}

/**
 * 创建早于当前目录发布的合法 v3 系统源种子。
 * 纯函数: 克隆当前产品种子，只把 系统数据源1 脚本、版本和系统授权还原为 1.0.1，并把全部目录时间设置为旧发布事实。
 * 成功路径: 返回可由 BrowserPersistenceDatabase v3 首次种子直接写入的完整保存图。
 * 失败路径: 产品种子缺少 系统数据源1 Package、Definition 或授权状态时抛 Error，测试不构造半完成前置条件。
 *
 * @returns {object} 旧脚本事实、当前 Definition、Preferences 和 Storage 命名空间。
 * @throws {Error} 当前产品种子缺少 系统数据源1 关联对象时抛出。
 */
function createVersionThreeSourceSeeds() {
  // 类型: object；作用: 隔离当前产品种子，避免测试改写模块级目录事实。
  const versionThreeSeeds = structuredClone(sourceRepositorySeeds);
  // 类型: object|undefined；作用: 定位 v3 需要模拟的 系统数据源1 完整脚本包。
  const systemSource1Package = versionThreeSeeds.packages.find(sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID);
  // 类型: object|undefined；作用: 定位 v3 系统数据源1 业务版本和导入审计字段。
  const systemSource1Definition = versionThreeSeeds.definitions.find(sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID);
  // 类型: object|undefined；作用: 定位 v3 系统数据源1 启用与系统授权快照。
  const systemSource1SourceState = versionThreeSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID];

  // 条件分支: 当前产品种子缺少任一 系统数据源1 保存对象时进入。
  // 执行内容: 立即失败，防止迁移测试在错误前置保存图上产生误导结论。
  if (!systemSource1Package || !systemSource1Definition || !systemSource1SourceState) {
    throw new Error('v3 迁移夹具缺少 system-source-1 保存对象');
  }

  // 状态变化: 旧脚本文本增加确定性夹具标记，并同步重算 Package 完整性摘要。
  systemSource1Package.scriptContent = `${systemSource1Package.scriptContent}\n// v3 source release fixture`;
  systemSource1Package.integrity.scriptHash = createSourceScriptHash(systemSource1Package.scriptContent);
  // 状态变化: Definition 与授权同时回到 1.0.1，保持 v3 内部脚本事实自洽。
  systemSource1Definition.version = '1.0.1';
  systemSource1SourceState.authorization.authorizedVersion = '1.0.1';
  systemSource1SourceState.authorization.authorizedScriptHash = systemSource1Package.integrity.scriptHash;
  systemSource1SourceState.authorization.authorizedAt = VERSION_THREE_CATALOG_TIME;

  versionThreeSeeds.definitions.forEach((sourceDefinition) => {
    // 状态变化: 当前目录 v3 首次导入和最后更新时间使用同一旧发布事实。
    sourceDefinition.importedAt = VERSION_THREE_CATALOG_TIME;
    sourceDefinition.lastUpdatedAt = VERSION_THREE_CATALOG_TIME;
  });
  return versionThreeSeeds;
}

/**
 * 创建已发布搜索事务、但仍使用 Provider ABI 1.x 的 v8 当前目录种子。
 * 纯函数: 克隆当前产品种子并同步降级 manifest 版本、Definition 与授权，不修改正式目录。
 * 成功路径: 当前全部 Package 都形成 ABI 1.x 自洽保存图，系统数据源1 保留带 submit 字段的 v8 搜索 URL 语义。
 * 失败路径: 任一当前脚本缺少 ABI 2.0 manifest 片段或关联 Definition/授权时抛 Error。
 *
 * @returns {object} 可直接初始化 schema v7/v8 历史数据库的四类 Source 种子。
 * @throws {Error} 当前产品种子不能确定性还原为 v8 发布事实时抛出。
 */
function createVersionEightSourceSeeds() {
  // 类型: object；作用: 隔离当前 ABI 2.0 产品种子，所有历史改写仅属于当前测试夹具。
  const versionEightSeeds = structuredClone(sourceRepositorySeeds);

  versionEightSeeds.packages.forEach((sourcePackage) => {
    // 类型: object|undefined；作用: 定位与当前 Package 同源的 Definition，保持版本与授权关系自洽。
    const sourceDefinition = versionEightSeeds.definitions.find(
      definition => definition.id === sourcePackage.sourceId
    );
    // 类型: object|undefined；作用: 定位同源启停和授权快照，只刷新脚本绑定事实。
    const sourceState = versionEightSeeds.preferences.sourceStates[sourcePackage.sourceId];
    // 类型: string；作用: 从同源 Definition 取得当前业务版本，避免历史夹具假设所有 Provider 永远同步发版。
    const currentProviderVersion = sourceDefinition?.version;
    // 类型: string；作用: 把当前单文件 manifest 确定性还原为 v8 的 ABI 与业务版本。
    const historicalScriptContent = sourcePackage.scriptContent
      .replace("providerApiVersion: '2.0.0'", "providerApiVersion: '1.1.0'")
      .replace(`version: '${currentProviderVersion}'`, "version: '1.0.5'");

    // 条件分支: 当前目录结构变化导致历史 manifest 片段无法唯一替换时进入。
    // 执行内容: 中止夹具构造，避免让 v8 测试在 ABI 2.0 或错误版本上产生假通过。
    if (!sourceDefinition || !sourceState || typeof currentProviderVersion !== 'string'
      || historicalScriptContent === sourcePackage.scriptContent
      || !historicalScriptContent.includes("providerApiVersion: '1.1.0'")
      || !historicalScriptContent.includes("version: '1.0.5'")) {
      throw new Error(`v8 迁移夹具无法还原数据源: ${sourcePackage.sourceId}`);
    }

    // 状态变化: Package、Definition 和授权共同采用同一 v8 版本及脚本指纹。
    sourcePackage.scriptContent = historicalScriptContent;
    sourcePackage.integrity.scriptHash = createSourceScriptHash(historicalScriptContent);
    sourceDefinition.version = '1.0.5';
    sourceDefinition.importedAt = VERSION_THREE_CATALOG_TIME;
    sourceDefinition.lastUpdatedAt = '2026-07-21T02:00:00.000Z';
    sourceState.authorization.authorizedVersion = sourceDefinition.version;
    sourceState.authorization.authorizedScriptHash = sourcePackage.integrity.scriptHash;
    sourceState.authorization.authorizedAt = sourceDefinition.lastUpdatedAt;
  });

  return versionEightSeeds;
}

/**
 * 创建包含两条待退役系统源的合法 v19 保存图。
 * 纯函数: 从当前产品种子复制保存对象模板，为冻结退役身份补齐 Package、Definition、授权和空五分区命名空间。
 * 成功路径: 返回可直接初始化 schema v19 的四类 Source 种子，当前源和退役源身份互不冲突。
 * 失败路径: 当前产品种子缺少可复制保存对象时抛 Error，不构造部分历史图。
 *
 * @returns {object} 当前源与两条待退役源共同组成的 v19 Source 种子。
 * @throws {Error} 当前产品种子不能提供 Package、Definition 或授权模板时抛出。
 */
function createVersionNineteenSourceSeeds() {
  // 类型: object；作用: 隔离当前双源种子，全部历史对象只属于本次迁移夹具。
  const versionNineteenSeeds = structuredClone(sourceRepositorySeeds);
  // 类型: object|undefined；作用: 提供合法 Package 字段结构和完整性算法模板。
  const packageTemplate = versionNineteenSeeds.packages[0];
  // 类型: object|undefined；作用: 提供合法系统 Definition 能力和设置结构模板。
  const definitionTemplate = versionNineteenSeeds.definitions[0];
  // 类型: object|undefined；作用: 提供合法系统授权结构模板。
  const sourceStateTemplate = versionNineteenSeeds.preferences.sourceStates[definitionTemplate?.id];
  // 条件分支: 当前目录不能提供完整保存对象模板时进入。
  // 执行内容: 立即失败，避免 v20 在伪造历史图上获得假通过。
  if (!packageTemplate || !definitionTemplate || !sourceStateTemplate) {
    throw new Error('v19 退役迁移夹具缺少当前系统源模板');
  }

  RETIRED_BUILTIN_SOURCE_IDS.forEach((sourceId, sourceIndex) => {
    // 类型: string；作用: 为历史退役源创建与 Definition 唯一关联的稳定包主键。
    const packageRef = `source-package::${sourceId}`;
    // 类型: string；作用: 提供满足 Package 非空约束、但不会在数据库迁移测试中执行的历史脚本文本。
    const scriptContent = `export const historicalSourceId = '${sourceId}';`;
    // 类型: string；作用: Package 与授权共同绑定同一历史脚本文本指纹。
    const scriptHash = createSourceScriptHash(scriptContent);
    // 类型: object；作用: 保存 v19 仍存在的退役系统脚本包。
    const sourcePackage = {
      ...structuredClone(packageTemplate),
      packageRef,
      sourceId,
      providerKey: `${sourceId}.provider`,
      scriptContent,
      integrity: {
        ...structuredClone(packageTemplate.integrity),
        scriptHash
      }
    };
    // 类型: object；作用: 保存设置页在 v19 仍能读取的退役系统定义。
    const sourceDefinition = {
      ...structuredClone(definitionTemplate),
      id: sourceId,
      name: `待退役系统源 ${sourceIndex + 1}`,
      description: '只用于验证 v20 系统源退役迁移。',
      version: '2.0.0',
      providerKey: sourcePackage.providerKey,
      packageRef,
      importedAt: '2026-07-19T00:00:00.000Z',
      lastUpdatedAt: '2026-07-26T00:00:00.000Z'
    };
    // 状态变化: 把完整 Package、Definition、授权和空命名空间加入当前夹具的同源保存图。
    versionNineteenSeeds.packages.push(sourcePackage);
    versionNineteenSeeds.definitions.push(sourceDefinition);
    versionNineteenSeeds.preferences.sourceStates[sourceId] = {
      ...structuredClone(sourceStateTemplate),
      authorization: {
        ...structuredClone(sourceStateTemplate.authorization),
        authorizedVersion: sourceDefinition.version,
        authorizedScriptHash: scriptHash,
        authorizedAt: sourceDefinition.lastUpdatedAt
      }
    };
    versionNineteenSeeds.storageNamespaces[sourceId] = {
      settings: {},
      credentials: {},
      session: {},
      cache: {},
      diagnostics: {}
    };
  });
  return versionNineteenSeeds;
}

/**
 * 创建仍使用“数据源”类别后缀和上一补丁版本的合法 v12 当前目录种子。
 * 纯函数: 克隆当前产品种子，逐源同步还原 manifest.name、manifest.version、Definition 和授权快照，不修改正式目录。
 * 成功路径: 当前系统源形成名称、版本、脚本文本和授权哈希互相一致的 v12 保存图。
 * 失败路径: 当前业务版本不能回退一个补丁号，或 manifest 名称/版本片段无法唯一还原时抛 Error，禁止伪造迁移前置库。
 *
 * @returns {object} 可直接初始化 schema v12 历史数据库的四类 Source 种子。
 * @throws {Error} 当前产品种子不能确定性还原为 v12 发布事实时抛出。
 */
function createVersionTwelveSourceSeeds() {
  // 类型: object；作用: 隔离当前纯名称产品种子，所有旧名称和旧版本改写只属于本测试夹具。
  const versionTwelveSeeds = structuredClone(sourceRepositorySeeds);

  versionTwelveSeeds.packages.forEach((sourcePackage) => {
    // 类型: object|undefined；作用: 定位当前 Package 同源 Definition，取得正式名称、版本和导入审计字段。
    const sourceDefinition = versionTwelveSeeds.definitions.find(
      definition => definition.id === sourcePackage.sourceId
    );
    // 类型: object|undefined；作用: 定位同源授权快照，使 v12 Package、Definition 和授权保持自洽。
    const sourceState = versionTwelveSeeds.preferences.sourceStates[sourcePackage.sourceId];
    // 类型: Array<string>；作用: 拆分当前三段业务版本，v13 名称发布只允许回退最后一个补丁号。
    const versionParts = String(sourceDefinition?.version || '').split('.');
    // 类型: number；作用: 读取当前补丁号并验证存在可表达的上一发布版本。
    const currentPatchVersion = Number(versionParts[2]);

    // 条件分支: 同源 Definition、授权或三段正整数补丁版本无效时进入。
    // 执行内容: 中止夹具构造，避免 v13 测试在不自洽历史图上产生假通过。
    if (!sourceDefinition || !sourceState || versionParts.length !== 3
      || !Number.isInteger(currentPatchVersion) || currentPatchVersion <= 0) {
      throw new Error(`v12 迁移夹具缺少可回退系统源事实: ${sourcePackage.sourceId}`);
    }

    // 类型: string；作用: 由当前业务版本确定性计算上一补丁版本，不维护站点身份到版本的并行字典。
    const previousVersion = `${versionParts[0]}.${versionParts[1]}.${currentPatchVersion - 1}`;
    // 类型: string；作用: v12 正式名称在当前纯名称后包含类别后缀，用于验证 v13 从根源替换而非页面裁剪。
    const previousName = `${sourceDefinition.name} 数据源`;
    // 类型: string；作用: 同时还原 manifest 名称和版本，保留 Provider 其余业务实现不变。
    const historicalScriptContent = sourcePackage.scriptContent
      .replace(`name: '${sourceDefinition.name}'`, `name: '${previousName}'`)
      .replace(`version: '${sourceDefinition.version}'`, `version: '${previousVersion}'`);

    // 条件分支: 当前单文件 manifest 结构变化导致名称或版本没有按预期替换时进入。
    // 执行内容: 明确失败并要求同步夹具，不把当前脚本冒充 v12 历史发布。
    if (historicalScriptContent === sourcePackage.scriptContent
      || !historicalScriptContent.includes(`name: '${previousName}'`)
      || !historicalScriptContent.includes(`version: '${previousVersion}'`)) {
      throw new Error(`v12 迁移夹具无法还原系统源: ${sourcePackage.sourceId}`);
    }

    // 状态变化: Package、Definition 和授权共同采用旧名称、上一补丁版本与同一脚本哈希。
    sourcePackage.scriptContent = historicalScriptContent;
    sourcePackage.integrity.scriptHash = createSourceScriptHash(historicalScriptContent);
    sourceDefinition.name = previousName;
    sourceDefinition.version = previousVersion;
    sourceDefinition.importedAt = VERSION_THREE_CATALOG_TIME;
    sourceDefinition.lastUpdatedAt = VERSION_TWELVE_CATALOG_TIME;
    sourceState.authorization.authorizedVersion = previousVersion;
    sourceState.authorization.authorizedScriptHash = sourcePackage.integrity.scriptHash;
    sourceState.authorization.authorizedAt = VERSION_TWELVE_CATALOG_TIME;
  });

  return versionTwelveSeeds;
}

/**
 * 创建 v9 系统源对账不得修改的 ABI 1.x 自定义源保存图。
 * 纯函数: 每次返回独立 Package、Definition、偏好状态和私有空间条目。
 * 成功路径: 脚本文本、哈希、版本和授权互相一致，可并入合法 v8 保存图。
 * 失败路径: 无；固定夹具只使用严格 JSON 值和稳定测试身份。
 *
 * @returns {object} 自定义源 Package、Definition、sourceState 和 storageEntry。
 */
function createVersionEightCustomSourceGraph() {
  // 类型: string；作用: 提供最小 ABI 1.x 自定义脚本事实，v9 只负责保留而不执行或改写。
  const scriptContent = [
    "export const sourceManifest = Object.freeze({ providerApiVersion: '1.1.0' });",
    'export const sourceProviderFactory = Object.freeze({});'
  ].join('\n');
  // 类型: string；作用: Package 完整性与授权快照共同绑定同一脚本文本。
  const scriptHash = createSourceScriptHash(scriptContent);

  return {
    sourcePackage: {
      packageRef: VERSION_EIGHT_CUSTOM_PACKAGE_REF,
      schemaVersion: '1.0.0',
      sourceId: VERSION_EIGHT_CUSTOM_SOURCE_ID,
      providerKey: VERSION_EIGHT_CUSTOM_PROVIDER_KEY,
      scriptContent,
      integrity: {
        algorithm: 'sha-256',
        scriptHash
      }
    },
    sourceDefinition: {
      schemaVersion: '1.0.0',
      id: VERSION_EIGHT_CUSTOM_SOURCE_ID,
      name: 'v8 自定义数据源',
      description: '验证 v9 只刷新系统源，不改写用户导入的 ABI 1.x 脚本。',
      sourceKind: SOURCE_KIND.custom,
      version: '1.0.0',
      providerKey: VERSION_EIGHT_CUSTOM_PROVIDER_KEY,
      packageRef: VERSION_EIGHT_CUSTOM_PACKAGE_REF,
      importMethod: IMPORT_METHOD.text,
      remoteUrl: '',
      importedAt: '2026-07-21T03:00:00.000Z',
      lastUpdatedAt: '2026-07-21T03:00:00.000Z',
      capabilities: {
        home: true,
        movie: false,
        tv: false,
        search: true,
        detail: true,
        play: false
      },
      settingsSchema: []
    },
    sourceState: {
      enabled: true,
      authorization: {
        status: AUTHORIZATION_STATUS.authorized,
        authorizedAt: '2026-07-21T03:00:00.000Z',
        authorizedVersion: '1.0.0',
        authorizedScriptHash: scriptHash
      }
    },
    storageEntry: {
      sourceId: VERSION_EIGHT_CUSTOM_SOURCE_ID,
      partition: SOURCE_STORAGE_PARTITION.session,
      key: 'preserved-session',
      value: { token: 'v8-custom-session' }
    }
  };
}

/**
 * 读取系统源目录迁移不得改写的运行数据快照。
 * 副作用: 只通过调用方 readonly transaction 读取私有空间和用户四仓，不写数据库。
 * 成功路径: 返回五个 store 的完整记录数组，供升级前后深比较。
 * 失败路径: 任一 IndexedDB 请求失败时 reject，并由数据库门面转换为稳定事务错误。
 *
 * @param {IDBTransaction} transaction 已覆盖正式九仓的只读事务。
 * @returns {Promise<object>} storageEntries、profiles、favorites、playHistory 和 settings 快照。
 */
async function readPreservedRuntimeSnapshot(transaction) {
  return {
    storageEntries: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).getAll(),
    profiles: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userProfiles).getAll(),
    favorites: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).getAll(),
    playHistory: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).getAll(),
    settings: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings).getAll()
  };
}

/**
 * 创建 v11 默认快捷键保存对象期望。
 * 纯函数: 每次复制绑定和修饰符数组，不修改冻结播放配置。
 *
 * @returns {object} 默认 ShortcutPreferences 保存对象。
 */
function createExpectedShortcutPreferences() {
  return {
    schemaVersion: PLAYBACK_SHORTCUT_PREFERENCES_SCHEMA_VERSION,
    bindings: DEFAULT_PLAYBACK_SHORTCUT_BINDINGS.map(binding => ({
      action: binding.action,
      key: binding.key,
      modifiers: [...binding.modifiers],
      enabled: binding.enabled
    }))
  };
}

/**
 * 创建 v12 默认首页展示偏好期望。
 * 纯函数: 只读取正式配置边界，不共享可变保存对象。
 *
 * @returns {object} 默认 HomeDisplayPreferences 保存对象。
 */
function createExpectedHomeDisplayPreferences() {
  return {
    schemaVersion: HOME_DISPLAY_PREFERENCES_SCHEMA_VERSION,
    carouselItemLimit: HOME_CAROUSEL_ITEM_LIMIT.defaultValue
  };
}

/**
 * 验证 v11/v12 只向每条旧用户设置追加正式默认偏好。
 * 副作用: 通过 node:assert 记录断言失败，不修改实际或升级前快照。
 * 成功路径: 私有空间、资料、收藏、历史、用户身份和恢复策略全部保持，快捷键与首页展示偏好精确采用项目默认值。
 * 失败路径: 任一保存域被改写、丢失或新增未知设置字段时抛 AssertionError。
 *
 * @param {object} actual 当前升级后的运行数据快照。
 * @param {object} previous v10 或更早版本升级前快照。
 * @returns {void}
 */
function assertRuntimePreservedWithShortcutMigration(actual, previous) {
  assert.deepEqual(actual.storageEntries, previous.storageEntries);
  assert.deepEqual(actual.profiles, previous.profiles);
  assert.deepEqual(actual.favorites, previous.favorites);
  assert.deepEqual(actual.playHistory, previous.playHistory);
  assert.equal(actual.settings.length, previous.settings.length);
  previous.settings.forEach((legacySettings) => {
    // 类型: object|undefined；作用: 按 userId 定位 v11 设置行，顺序变化不影响归属验证。
    const upgradedSettings = actual.settings.find(settings => settings.userId === legacySettings.userId);
    assert.deepEqual(upgradedSettings, {
      userId: legacySettings.userId,
      resumePolicy: legacySettings.resumePolicy,
      shortcutPreferences: createExpectedShortcutPreferences(),
      homeDisplayPreferences: createExpectedHomeDisplayPreferences()
    });
  });
}

/**
 * 创建绑定测试名称的数据库门面。
 * 副作用: 只创建门面对象，initialize 前不打开 IndexedDB。
 *
 * @param {string} databaseName 当前用例唯一数据库名称。
 * @param {number} databaseVersion 当前门面请求的 schema 目标版本。
 * @returns {BrowserPersistenceDatabase} 绑定明确目标版本的数据库门面。
 */
function createDatabase(databaseName, databaseVersion = BROWSER_PERSISTENCE_DATABASE_VERSION) {
  return new BrowserPersistenceDatabase({ databaseName, databaseVersion });
}

/**
 * 打开测试专用原生 IndexedDB 连接。
 * 副作用: 创建独立连接；调用方必须 close，并在用例结束删除唯一数据库。
 * 成功路径: upgrade 回调完成且 onsuccess 触发后返回 IDBDatabase。
 * 失败路径: blocked 或 error 时 reject，不通过轮询等待连接状态。
 *
 * @param {string} databaseName 当前用例唯一数据库名称。
 * @param {number} databaseVersion 原生打开请求目标版本。
 * @param {Function|null} upgrade 仅在 versionchange transaction 中执行的 schema 准备函数。
 * @returns {Promise<IDBDatabase>} 已打开原生连接。
 */
function openRawDatabase(databaseName, databaseVersion, upgrade = null) {
  return new Promise((resolve, reject) => {
    // 类型: IDBOpenDBRequest；作用: 直接控制版本连接以制造 blocked 和 blocking 生命周期。
    const request = globalThis.indexedDB.open(databaseName, databaseVersion);
    // 副作用: 当前请求需要升级时只执行调用方提供的 schema 准备，不接触正式门面私有连接。
    request.onupgradeneeded = (event) => {
      // 条件分支: 当前用例提供 schema 准备函数时进入。
      // 执行内容: 只在原生 versionchange transaction 中调用一次，空值表示无需修改 schema。
      if (upgrade) upgrade(request.result, request.transaction, event.oldVersion, event.newVersion);
    };
    // 成功回调: 返回原生连接，由用例负责关闭。
    request.onsuccess = () => resolve(request.result);
    // 失败回调: 保留原生错误供当前测试定位。
    request.onerror = () => reject(request.error);
    // 阻塞回调: 当前辅助请求不等待未知连接，立即以明确错误结束。
    request.onblocked = () => reject(new Error('测试原生数据库打开请求被阻塞'));
  });
}

/**
 * 捕获下一次 idb openDB 使用的底层原生连接。
 * 副作用: 在当前用例内短暂替换 indexedDB.open；restore 必须在 initialize 完成后调用。
 * 成功路径: connectionPromise 在原生打开成功事件触发时返回同一连接。
 * 失败路径: 原生打开失败时 reject，恢复函数仍由 finally 调用。
 *
 * @returns {object} 捕获控制器。
 * @returns {Promise<IDBDatabase>} return.connectionPromise 下一次打开成功的底层连接。
 * @returns {Function} return.restore 恢复原始 indexedDB.open 方法。
 */
function captureNextRawConnection() {
  // 类型: IDBFactory；作用: 保存当前 fake-indexeddb 工厂和原始 open 方法所有权。
  const factory = globalThis.indexedDB;
  // 类型: Function；作用: 用例结束时恢复原始工厂方法，避免影响后续测试。
  const originalOpen = factory.open;
  // 类型: Function；作用: 保存连接 Promise 成功入口，只由捕获请求 success 事件调用。
  let resolveConnection;
  // 类型: Function；作用: 保存连接 Promise 失败入口，只由捕获请求 error 事件调用。
  let rejectConnection;
  // 类型: Promise<IDBDatabase>；作用: 把底层连接交给 terminated 用例，不暴露到生产实现。
  const connectionPromise = new Promise((resolve, reject) => {
    resolveConnection = resolve;
    rejectConnection = reject;
  });

  // 副作用: 只拦截下一次调用并保留原始 this，返回值仍是标准 IDBOpenDBRequest。
  factory.open = function captureOpen(...args) {
    // 类型: IDBOpenDBRequest；作用: 同时交给 idb 和当前测试监听底层成功/失败事件。
    const request = originalOpen.apply(factory, args);
    request.addEventListener('success', () => resolveConnection(request.result), { once: true });
    request.addEventListener('error', () => rejectConnection(request.error), { once: true });
    return request;
  };

  return {
    connectionPromise,
    /**
     * 恢复原始 indexedDB.open。
     * 副作用: 清除当前用例捕获器，后续数据库打开不再被观察。
     *
     * @returns {void}
     */
    restore() {
      factory.open = originalOpen;
    }
  };
}

test('BrowserPersistenceDatabase 创建九仓索引并只播种一次', async () => {
  // 类型: string；作用: 当前用例两次门面重建共用的唯一数据库名称。
  const databaseName = createDatabaseName();
  // 类型: BrowserPersistenceDatabase；作用: 执行首次空库 schema 和种子事务。
  const firstDatabase = createDatabase(databaseName);
  await firstDatabase.initialize(createInitializationOptions());

  // 类型: object；作用: 在一个只读事务中读取 schema、索引、元信息和种子数量。
  const firstSnapshot = await firstDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => {
      // 类型: IDBObjectStore；作用: 检查正式私有空间 store 已创建两个冻结索引。
      const storageStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries);
      return {
        storeNames: Array.from(transaction.objectStoreNames),
        sourceStorageIndexes: Array.from(storageStore.indexNames),
        initialized: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
          .get(BROWSER_PERSISTENCE_META_KEY.initialized),
        schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
          .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
        packageCount: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).count(),
        definitionCount: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).count(),
        favoriteCount: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).count()
      };
    }
  );

  assert.deepEqual(firstSnapshot.storeNames, [...BROWSER_PERSISTENCE_ALL_STORE_NAMES].sort());
  assert.deepEqual(
    firstSnapshot.sourceStorageIndexes,
    [
      BROWSER_PERSISTENCE_INDEX.sourceStorageBySourceId,
      BROWSER_PERSISTENCE_INDEX.sourceStorageBySourcePartition
    ].sort()
  );
  assert.deepEqual(firstSnapshot.initialized, { key: BROWSER_PERSISTENCE_META_KEY.initialized, value: true });
  assert.deepEqual(firstSnapshot.schemaVersion, {
    key: BROWSER_PERSISTENCE_META_KEY.schemaVersion,
    value: BROWSER_PERSISTENCE_DATABASE_VERSION
  });
  assert.equal(firstSnapshot.packageCount, sourceRepositorySeeds.packages.length);
  assert.equal(firstSnapshot.definitionCount, sourceRepositorySeeds.definitions.length);
  assert.equal(firstSnapshot.favoriteCount, userContentMockData.favorites.records.length);

  // 资源清理: 关闭首次门面，使同名第二门面模拟刷新后的应用模块重建。
  firstDatabase.close();
  // 类型: BrowserPersistenceDatabase；作用: 验证 appMeta 已存在时不会采用传入替代种子。
  const reopenedDatabase = createDatabase(databaseName);
  // 类型: object；作用: 构造不同 Definition 名称的第二次初始化输入，验证不会覆盖已提交种子。
  const replacementOptions = createInitializationOptions();
  replacementOptions.sourceSeeds.definitions[0].name = '不应覆盖的名称';
  await reopenedDatabase.initialize(replacementOptions);

  // 类型: object；作用: 读取重开后的原始 Definition，确认替代种子没有生效。
  const persistedDefinition = await reopenedDatabase.runReadonly(
    [BROWSER_PERSISTENCE_STORE.sourceDefinitions],
    async (transaction) => transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
      .get(sourceRepositorySeeds.definitions[0].id)
  );
  assert.equal(persistedDefinition.name, sourceRepositorySeeds.definitions[0].name);
  await reopenedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase 对缺失初始化事实的部分数据库失败关闭', async () => {
  // 类型: string；作用: 当前损坏状态用例独占的测试数据库名称。
  const databaseName = createDatabaseName();
  // 类型: BrowserPersistenceDatabase；作用: 先建立一份完整已初始化数据库。
  const initializedDatabase = createDatabase(databaseName);
  await initializedDatabase.initialize(createInitializationOptions());
  await initializedDatabase.runReadwrite(
    [BROWSER_PERSISTENCE_STORE.appMeta],
    async (transaction) => transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
      .delete(BROWSER_PERSISTENCE_META_KEY.initialized)
  );
  initializedDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 模拟刷新后重新打开缺少 initialized 事实的部分数据库。
  const corruptedDatabase = createDatabase(databaseName);
  await assert.rejects(
    corruptedDatabase.initialize(createInitializationOptions()),
    error => error instanceof BrowserPersistenceError
      && error.code === BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted
  );
  await corruptedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase executor 失败会中止原生读写事务', async () => {
  // 类型: string；作用: 当前事务回滚用例独占的测试数据库名称。
  const databaseName = createDatabaseName();
  // 类型: BrowserPersistenceDatabase；作用: 提供真实 readwrite transaction 被测门面。
  const database = createDatabase(databaseName);
  await database.initialize(createInitializationOptions());
  // 类型: object；作用: 构造只在失败事务中写入的唯一 Package 候选。
  const candidatePackage = structuredClone(sourceRepositorySeeds.packages[0]);
  candidatePackage.packageRef = 'source-package::transaction-abort';
  candidatePackage.sourceId = 'transaction-abort';

  await assert.rejects(
    database.runReadwrite(
      [BROWSER_PERSISTENCE_STORE.sourcePackages],
      async (transaction) => {
        await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).add(candidatePackage);
        throw new Error('force transaction abort');
      }
    ),
    error => error instanceof BrowserPersistenceError
      && error.code === BROWSER_PERSISTENCE_ERROR_CODE.operationFailed
  );

  // 类型: object|undefined；作用: 事务失败后复查候选包是否留下部分写入。
  const storedPackage = await database.runReadonly(
    [BROWSER_PERSISTENCE_STORE.sourcePackages],
    async (transaction) => transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
      .get(candidatePackage.packageRef)
  );
  assert.equal(storedPackage, undefined);
  await database.deleteDatabase();
});

test('BrowserPersistenceDatabase 从 v1 连续升级到 v6 并替换当前目录冲突保存图', async () => {
  // 类型: string；作用: 当前版本升级用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: BrowserPersistenceDatabase；作用: 使用正式 v1 迁移建立历史数据库。
  const versionOneDatabase = createDatabase(databaseName, BROWSER_PERSISTENCE_SCHEMA_VERSION.initial);
  await versionOneDatabase.initialize(createInitializationOptions());
  // 类型: string；作用: 模拟用户在 v1 修改同 id Definition，v3 必须用受审系统定义覆盖冲突。
  const conflictingName = '版本一冲突的数据源名称';
  await versionOneDatabase.runReadwrite(
    [BROWSER_PERSISTENCE_STORE.sourceDefinitions],
    async (transaction) => {
      // 类型: object；作用: 读取并更新当前历史 Definition，而不是创建测试专用影子结构。
      const definition = await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(sourceRepositorySeeds.definitions[0].id);
      definition.name = conflictingName;
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).put(definition);
    }
  );
  versionOneDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 目标固定为 v6，隔离验证 v1 至 v6 连续迁移。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceChallengeRefresh
  );
  await upgradedDatabase.initialize(createInitializationOptions());
  // 类型: object；作用: 同时读取系统 Definition 与 schemaVersion，证明冲突图由产品目录原子替换。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    [BROWSER_PERSISTENCE_STORE.appMeta, BROWSER_PERSISTENCE_STORE.sourceDefinitions],
    async (transaction) => ({
      definition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(sourceRepositorySeeds.definitions[0].id),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion)
    })
  );
  assert.equal(upgradedSnapshot.definition.name, sourceRepositorySeeds.definitions[0].name);
  assert.equal(
    upgradedSnapshot.schemaVersion.value,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceChallengeRefresh
  );
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v19 到 v20 原子退役系统源并清理缓存、保留用户记录', async () => {
  // 类型: string；作用: 当前 v19 到 v20 系统源退役用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 提供当前双源和两条明确待退役系统源共同组成的合法 v19 保存图。
  const versionNineteenOptions = createInitializationOptions();
  versionNineteenOptions.sourceSeeds = createVersionNineteenSourceSeeds();
  // 类型: Array<string>；作用: 为默认源交接和软隐藏清理分别选择两个冻结退役身份，避免在断言中散落数组下标。
  const [retiredDefaultSourceId, retiredHiddenSourceId] = RETIRED_BUILTIN_SOURCE_IDS;
  // 类型: BrowserPersistenceDatabase；作用: 只建立并提交 schema v19，避免提前执行 v20 退役清理。
  const versionNineteenDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceDetailMappingRefresh
  );
  await versionNineteenDatabase.initialize(versionNineteenOptions);
  // 类型: object；作用: 提供 v20 必须原样保留的自定义 Package、Definition、授权和私有空间。
  const customSourceGraph = createVersionEightCustomSourceGraph();

  await versionNineteenDatabase.runReadwrite(
    [
      BROWSER_PERSISTENCE_STORE.sourcePackages,
      BROWSER_PERSISTENCE_STORE.sourceDefinitions,
      BROWSER_PERSISTENCE_STORE.sourcePreferences,
      BROWSER_PERSISTENCE_STORE.sourceStorageEntries,
      BROWSER_PERSISTENCE_STORE.userFavorites,
      BROWSER_PERSISTENCE_STORE.userPlayHistory
    ],
    async (transaction) => {
      // 副作用: 追加一条无关自定义源完整保存图，证明 v20 只删除冻结退役身份。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .put(customSourceGraph.sourcePackage);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .put(customSourceGraph.sourceDefinition);
      // 类型: IDBObjectStore；作用: 保存 v20 必须交接的退役默认源、清理的退役软隐藏项和保留的自定义授权决定。
      const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
      // 类型: object；作用: 当前 v19 全局偏好候选，只写入明确用户决定。
      const preferencesRecord = await preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY);
      preferencesRecord.value.defaultSourceId = retiredDefaultSourceId;
      preferencesRecord.value.removedSystemSourceIds = [retiredHiddenSourceId];
      preferencesRecord.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID] = customSourceGraph.sourceState;
      await preferencesStore.put(preferencesRecord);

      // 循环作用: 为两条退役源分别写入凭据和内容缓存，证明 v20 删除整个五分区命名空间而非只清一类缓存。
      for (const [sourceIndex, sourceId] of RETIRED_BUILTIN_SOURCE_IDS.entries()) {
        await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put({
          sourceId,
          partition: sourceIndex === 0
            ? SOURCE_STORAGE_PARTITION.credentials
            : SOURCE_STORAGE_PARTITION.cache,
          key: `retired-storage-${sourceIndex}`,
          value: { sourceIndex }
        });
      }
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries)
        .put(customSourceGraph.storageEntry);
      // 循环作用: 为两条退役源写入收藏和历史引用，证明 v20 把它们作为用户资产保留给后续恢复链。
      for (const [sourceIndex, sourceId] of RETIRED_BUILTIN_SOURCE_IDS.entries()) {
        await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).put({
          userId: userContentMockData.user.id,
          favoriteKey: `retired-favorite-${sourceIndex}`,
          sourceId
        });
        await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).put({
          userId: userContentMockData.user.id,
          historyKey: `retired-history-${sourceIndex}`,
          sourceId
        });
      }
      // 副作用: 追加自定义源历史哨兵，证明退役清理不扩大到无关用户内容。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).put({
        userId: userContentMockData.user.id,
        historyKey: 'v20-preserved-custom-history',
        sourceId: VERSION_EIGHT_CUSTOM_SOURCE_ID
      });
    }
  );

  // 类型: object；作用: 冻结升级前自定义保存图、用户资料和设置，供 v20 逐项证明不扩大删除。
  const preservedBeforeUpgrade = await versionNineteenDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      customPackage: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(VERSION_EIGHT_CUSTOM_PACKAGE_REF),
      customDefinition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(VERSION_EIGHT_CUSTOM_SOURCE_ID),
      profiles: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userProfiles).getAll(),
      settings: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings).getAll()
    })
  );
  versionNineteenDatabase.close();

  // 类型: object；作用: 当前双源目录和冻结退役列表是 v20 唯一产品事实输入。
  const currentOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 打开同一历史库并只执行新增 v20 退役迁移。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRetirement
  );
  await upgradedDatabase.initialize(currentOptions);
  // 类型: object；作用: 一次读取 v20 Source 保存图、私有空间、保留用户引用与元信息最终事实。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      packages: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).getAll(),
      definitions: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll(),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      storageEntries: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).getAll(),
      favorites: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).getAll(),
      playHistory: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).getAll(),
      profiles: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userProfiles).getAll(),
      settings: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings).getAll(),
      builtinCatalogRelease: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion)
    })
  );
  // 断言作用: 当前产品 Package 和 Definition 恰好加上保留自定义源，不残留任一退役身份。
  assert.equal(upgradedSnapshot.packages.length, currentOptions.sourceSeeds.packages.length + 1);
  assert.equal(upgradedSnapshot.definitions.length, currentOptions.sourceSeeds.definitions.length + 1);
  RETIRED_BUILTIN_SOURCE_IDS.forEach((sourceId) => {
    assert.equal(upgradedSnapshot.packages.some(sourcePackage => sourcePackage.sourceId === sourceId), false);
    assert.equal(upgradedSnapshot.definitions.some(sourceDefinition => sourceDefinition.id === sourceId), false);
    assert.equal(Object.hasOwn(upgradedSnapshot.preferences.value.sourceStates, sourceId), false);
    assert.equal(upgradedSnapshot.storageEntries.some(storageEntry => storageEntry.sourceId === sourceId), false);
    assert.equal(upgradedSnapshot.favorites.some(favorite => favorite.sourceId === sourceId), true);
    assert.equal(upgradedSnapshot.playHistory.some(history => history.sourceId === sourceId), true);
  });
  // 断言作用: 退役默认源交接到当前目录第一条源，退役软隐藏身份同时消失。
  assert.equal(upgradedSnapshot.preferences.value.defaultSourceId, currentOptions.sourceSeeds.preferences.defaultSourceId);
  assert.deepEqual(upgradedSnapshot.preferences.value.removedSystemSourceIds, []);
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID],
    customSourceGraph.sourceState
  );
  assert.deepEqual(
    upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    preservedBeforeUpgrade.customPackage
  );
  assert.deepEqual(
    upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    preservedBeforeUpgrade.customDefinition
  );
  assert.deepEqual(upgradedSnapshot.profiles, preservedBeforeUpgrade.profiles);
  assert.deepEqual(upgradedSnapshot.settings, preservedBeforeUpgrade.settings);
  assert.equal(
    upgradedSnapshot.playHistory.some(history => history.sourceId === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    true
  );
  assert.deepEqual(upgradedSnapshot.builtinCatalogRelease.value, currentOptions.builtinCatalogRelease);
  assert.equal(
    upgradedSnapshot.schemaVersion.value,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRetirement
  );
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v20 到 v21 原子发布完整卡片字段脚本并保留用户保存域', async () => {
  // 类型: string；作用: 当前 v20 到 v21 卡片字段脚本发布用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 从当前目录克隆完整种子，再把 系统数据源1 构造成自洽的 2.0.7 历史发布事实。
  const versionTwentyOptions = createInitializationOptions();
  // 类型: object；作用: 定位 v20 将保存的 系统数据源1 Package，脚本文本和哈希必须一起降级。
  const staleSystemSource1Package = versionTwentyOptions.sourceSeeds.packages.find(
    sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 定位 v20 系统数据源1 Definition，版本和首次导入时间由历史保存图提供。
  const staleSystemSource1Definition = versionTwentyOptions.sourceSeeds.definitions.find(
    sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 定位 v20 系统数据源1 用户状态，使授权与旧脚本哈希和版本保持同源。
  const staleSystemSource1State = versionTwentyOptions.sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID];
  // 条件分支: 当前目录缺少 系统数据源1 任一关联保存对象时进入。
  // 执行内容: 夹具立即失败，不能在不完整历史图上验证 v21 对账。
  if (!staleSystemSource1Package || !staleSystemSource1Definition || !staleSystemSource1State) {
    throw new Error('v20 迁移夹具缺少 system-source-1 保存对象');
  }
  // 状态变化: Package、Definition 和授权共同降级为 2.0.7，形成与当前目录不同且内部哈希一致的 v20 事实。
  staleSystemSource1Package.scriptContent = `${staleSystemSource1Package.scriptContent}\n// v20 stale card metadata fixture`;
  staleSystemSource1Package.integrity.scriptHash = createSourceScriptHash(staleSystemSource1Package.scriptContent);
  staleSystemSource1Definition.version = '2.0.7';
  staleSystemSource1State.authorization.authorizedVersion = staleSystemSource1Definition.version;
  staleSystemSource1State.authorization.authorizedScriptHash = staleSystemSource1Package.integrity.scriptHash;

  // 类型: BrowserPersistenceDatabase；作用: 只提交到 schema v20，确保 v21 完整卡片字段脚本尚未被采用。
  const versionTwentyDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRetirement
  );
  await versionTwentyDatabase.initialize(versionTwentyOptions);
  // 类型: object；作用: 提供 v21 必须原样保留的自定义 Package、Definition、授权和私有空间。
  const customSourceGraph = createVersionEightCustomSourceGraph();

  await versionTwentyDatabase.runReadwrite(
    [
      BROWSER_PERSISTENCE_STORE.sourcePackages,
      BROWSER_PERSISTENCE_STORE.sourceDefinitions,
      BROWSER_PERSISTENCE_STORE.sourcePreferences,
      BROWSER_PERSISTENCE_STORE.sourceStorageEntries,
      BROWSER_PERSISTENCE_STORE.userFavorites,
      BROWSER_PERSISTENCE_STORE.userPlayHistory
    ],
    async (transaction) => {
      // 副作用: 追加完整自定义源保存图，证明 v21 只发布应用拥有的系统脚本。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .put(customSourceGraph.sourcePackage);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .put(customSourceGraph.sourceDefinition);
      // 类型: IDBObjectStore；作用: 提交必须跨 v21 保持的默认源、软隐藏、启停和自定义授权决定。
      const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
      // 类型: object；作用: 保存当前 v20 偏好副本，只写入明确用户决定。
      const preferencesRecord = await preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY);
      preferencesRecord.value.defaultSourceId = VERSION_EIGHT_CUSTOM_SOURCE_ID;
      preferencesRecord.value.removedSystemSourceIds = [PRESERVED_HIDDEN_SOURCE_ID];
      preferencesRecord.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled = false;
      preferencesRecord.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID] = customSourceGraph.sourceState;
      await preferencesStore.put(preferencesRecord);

      // 副作用: 同时写入系统源缓存和自定义源会话，锁定脚本发布不得清理任何私有分区。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put({
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID,
        partition: SOURCE_STORAGE_PARTITION.cache,
        key: 'preserved-card-metadata-cache',
        value: { marker: 'v20-system-source-1-cache' }
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries)
        .put(customSourceGraph.storageEntry);
      // 副作用: 追加用户内容哨兵，证明 v21 不进入收藏和播放历史业务仓。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).put({
        userId: userContentMockData.user.id,
        favoriteKey: 'v21-preserved-favorite',
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).put({
        userId: userContentMockData.user.id,
        historyKey: 'v21-preserved-history',
        sourceId: VERSION_EIGHT_CUSTOM_SOURCE_ID
      });
    }
  );

  // 类型: object；作用: 冻结升级前运行数据、自定义保存图和 系统数据源1 首次导入时间，供 v21 逐项比较。
  const preservedBeforeUpgrade = await versionTwentyDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      runtime: await readPreservedRuntimeSnapshot(transaction),
      customPackage: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(VERSION_EIGHT_CUSTOM_PACKAGE_REF),
      customDefinition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(VERSION_EIGHT_CUSTOM_SOURCE_ID),
      systemSource1Package: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(staleSystemSource1Package.packageRef),
      systemSource1Definition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(SYSTEM_SOURCE_1_SOURCE_ID)
    })
  );
  versionTwentyDatabase.close();

  // 类型: object；作用: 当前目录是 v21 通用对账迁移唯一允许采用的系统 Provider 发布事实。
  const currentOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 打开同一历史库并只执行新增 v21 对账迁移。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceCardMetadataRefresh
  );
  await upgradedDatabase.initialize(currentOptions);
  // 类型: object；作用: 一次读取 v21 系统发布、用户决定、自定义保存图和运行数据最终事实。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      packages: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).getAll(),
      definitions: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll(),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      builtinCatalogRelease: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease),
      runtime: await readPreservedRuntimeSnapshot(transaction)
    })
  );
  // 类型: object；作用: 当前 系统数据源1 Package 必须与 datasource/系统数据源1.js 原文和当前哈希完全一致。
  const currentSystemSource1Package = currentOptions.sourceSeeds.packages.find(
    sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 当前 系统数据源1 Definition 只允许继承历史 importedAt。
  const currentSystemSource1Definition = currentOptions.sourceSeeds.definitions.find(
    sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID
  );
  assert.equal(preservedBeforeUpgrade.systemSource1Definition.version, '2.0.7');
  assert.notEqual(preservedBeforeUpgrade.systemSource1Package.integrity.scriptHash, currentSystemSource1Package.integrity.scriptHash);
  assert.deepEqual(
    upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID),
    currentSystemSource1Package
  );
  assert.deepEqual(
    upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID),
    { ...currentSystemSource1Definition, importedAt: preservedBeforeUpgrade.systemSource1Definition.importedAt }
  );
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization,
    currentOptions.sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization
  );
  // 断言: v21 只替换系统发布事实，用户决定、自定义源、五分区数据和用户内容逐项保持。
  assert.equal(upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled, false);
  assert.equal(upgradedSnapshot.preferences.value.defaultSourceId, VERSION_EIGHT_CUSTOM_SOURCE_ID);
  assert.deepEqual(upgradedSnapshot.preferences.value.removedSystemSourceIds, [PRESERVED_HIDDEN_SOURCE_ID]);
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID],
    customSourceGraph.sourceState
  );
  assert.deepEqual(
    upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    preservedBeforeUpgrade.customPackage
  );
  assert.deepEqual(
    upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    preservedBeforeUpgrade.customDefinition
  );
  assert.deepEqual(upgradedSnapshot.runtime, preservedBeforeUpgrade.runtime);
  assert.equal(upgradedSnapshot.schemaVersion.value, BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceCardMetadataRefresh);
  assert.deepEqual(upgradedSnapshot.builtinCatalogRelease.value, currentOptions.builtinCatalogRelease);
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v21 到 v22 原子发布搜索行解析修复并保留运行数据', async () => {
  // 类型: string；作用: 当前 v21 到 v22 搜索解析修复用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 从当前目录克隆完整种子，再把 系统数据源1 构造成自洽的 2.0.8 历史发布事实。
  const versionTwentyOneOptions = createInitializationOptions();
  versionTwentyOneOptions.builtinCatalogRelease = createHistoricalCatalogRelease('2.13.0', '1');
  // 类型: object；作用: 定位 v21 保存的 系统数据源1 Package，脚本文本和哈希必须一起形成历史事实。
  const staleSystemSource1Package = versionTwentyOneOptions.sourceSeeds.packages.find(
    sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 定位 v21 系统数据源1 Definition，版本和首次导入时间由历史保存图提供。
  const staleSystemSource1Definition = versionTwentyOneOptions.sourceSeeds.definitions.find(
    sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 定位 v21 系统数据源1 用户状态，使授权与旧脚本哈希和版本保持同源。
  const staleSystemSource1State = versionTwentyOneOptions.sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID];
  // 条件分支: 当前目录缺少 系统数据源1 任一关联保存对象时进入；执行内容: 夹具立即失败，不能验证半完成 v22 对账。
  if (!staleSystemSource1Package || !staleSystemSource1Definition || !staleSystemSource1State) {
    throw new Error('v21 搜索解析修复夹具缺少 system-source-1 保存对象');
  }
  // 状态变化: Package、Definition 和授权共同降级为 2.0.8，形成与当前目录不同且内部哈希一致的 v21 事实。
  staleSystemSource1Package.scriptContent = `${staleSystemSource1Package.scriptContent}\n// v21 stale search metadata fixture`;
  staleSystemSource1Package.integrity.scriptHash = createSourceScriptHash(staleSystemSource1Package.scriptContent);
  staleSystemSource1Definition.version = '2.0.8';
  staleSystemSource1State.authorization.authorizedVersion = staleSystemSource1Definition.version;
  staleSystemSource1State.authorization.authorizedScriptHash = staleSystemSource1Package.integrity.scriptHash;

  // 类型: BrowserPersistenceDatabase；作用: 只提交到 schema v21，确保搜索行解析修复尚未发布。
  const versionTwentyOneDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceCardMetadataRefresh
  );
  await versionTwentyOneDatabase.initialize(versionTwentyOneOptions);
  await versionTwentyOneDatabase.runReadwrite(
    [BROWSER_PERSISTENCE_STORE.sourcePreferences, BROWSER_PERSISTENCE_STORE.sourceStorageEntries],
    async (transaction) => {
      // 类型: IDBObjectStore；作用: 保存 v22 必须保留的系统源启停决定。
      const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
      // 类型: object；作用: 只在当前用例副本中关闭 系统数据源1，不改授权或默认源。
      const preferencesRecord = await preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY);
      preferencesRecord.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled = false;
      await preferencesStore.put(preferencesRecord);
      // 副作用: 写入 系统数据源1 cache 分区哨兵，证明脚本发布不清理 Provider 私有空间。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put({
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID,
        partition: SOURCE_STORAGE_PARTITION.cache,
        key: 'v22-preserved-search-cache',
        value: { marker: 'v21-search-cache' }
      });
    }
  );
  // 类型: object；作用: 冻结升级前运行数据和 系统数据源1 首次导入时间，供 v22 逐项比较。
  const preservedBeforeUpgrade = await versionTwentyOneDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      runtime: await readPreservedRuntimeSnapshot(transaction),
      systemSource1Package: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(staleSystemSource1Package.packageRef),
      systemSource1Definition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(SYSTEM_SOURCE_1_SOURCE_ID)
    })
  );
  versionTwentyOneDatabase.close();

  // 类型: object；作用: 当前 2.14.0 目录是 v22 唯一允许采用的系统 Provider 发布事实。
  const currentOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 打开同一历史库并只执行新增 v22 对账迁移，不提前混入后续发布。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchMetadataRepair
  );
  await upgradedDatabase.initialize(currentOptions);
  // 类型: object；作用: 一次读取 v22 系统发布、用户决定和运行数据最终事实。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      packages: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).getAll(),
      definitions: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll(),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      builtinCatalogRelease: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease),
      runtime: await readPreservedRuntimeSnapshot(transaction)
    })
  );
  // 类型: object；作用: 当前 系统数据源1 Package 必须与修复后的 datasource/系统数据源1.js 原文和哈希完全一致。
  const currentSystemSource1Package = currentOptions.sourceSeeds.packages.find(
    sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 当前 系统数据源1 Definition 只允许继承历史 importedAt。
  const currentSystemSource1Definition = currentOptions.sourceSeeds.definitions.find(
    sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID
  );
  assert.equal(preservedBeforeUpgrade.systemSource1Definition.version, '2.0.8');
  assert.notEqual(preservedBeforeUpgrade.systemSource1Package.integrity.scriptHash, currentSystemSource1Package.integrity.scriptHash);
  assert.deepEqual(
    upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID),
    currentSystemSource1Package
  );
  assert.deepEqual(
    upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID),
    { ...currentSystemSource1Definition, importedAt: preservedBeforeUpgrade.systemSource1Definition.importedAt }
  );
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization,
    currentOptions.sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization
  );
  // 断言: v22 只替换系统发布事实，用户启停决定和全部运行数据必须逐项保持。
  assert.equal(upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled, false);
  assert.deepEqual(upgradedSnapshot.runtime, preservedBeforeUpgrade.runtime);
  assert.equal(upgradedSnapshot.schemaVersion.value, BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchMetadataRepair);
  assert.deepEqual(upgradedSnapshot.builtinCatalogRelease.value, currentOptions.builtinCatalogRelease);
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v22 到 v23 原子发布详情状态边界修复并保留全部用户保存域', async () => {
  // 类型: string；作用: 当前 v22 到 v23 详情状态修复用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 从当前目录克隆完整种子，再把 系统数据源1 构造成自洽的 2.0.9 历史发布事实。
  const versionTwentyTwoOptions = createInitializationOptions();
  versionTwentyTwoOptions.builtinCatalogRelease = createHistoricalCatalogRelease('2.14.0', '2');
  // 类型: object；作用: 定位 v22 保存的 系统数据源1 Package，脚本文本和哈希必须一起形成历史事实。
  const staleSystemSource1Package = versionTwentyTwoOptions.sourceSeeds.packages.find(
    sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 定位 v22 系统数据源1 Definition，版本和首次导入时间由历史保存图提供。
  const staleSystemSource1Definition = versionTwentyTwoOptions.sourceSeeds.definitions.find(
    sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 定位 v22 系统数据源1 用户状态，使授权与旧脚本哈希和版本保持同源。
  const staleSystemSource1State = versionTwentyTwoOptions.sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID];
  // 条件分支: 当前目录缺少 系统数据源1 任一关联保存对象时进入；执行内容: 夹具立即失败，不能验证半完成 v23 对账。
  if (!staleSystemSource1Package || !staleSystemSource1Definition || !staleSystemSource1State) {
    throw new Error('v22 详情状态修复夹具缺少 system-source-1 保存对象');
  }
  // 状态变化: Package、Definition 和授权共同降级为 2.0.9，形成与当前目录不同且内部哈希一致的 v22 事实。
  staleSystemSource1Package.scriptContent = `${staleSystemSource1Package.scriptContent}\n// v22 stale detail status fixture`;
  staleSystemSource1Package.integrity.scriptHash = createSourceScriptHash(staleSystemSource1Package.scriptContent);
  staleSystemSource1Definition.version = '2.0.9';
  staleSystemSource1State.authorization.authorizedVersion = staleSystemSource1Definition.version;
  staleSystemSource1State.authorization.authorizedScriptHash = staleSystemSource1Package.integrity.scriptHash;

  // 类型: BrowserPersistenceDatabase；作用: 只提交到 schema v22，确保详情状态边界修复尚未发布。
  const versionTwentyTwoDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchMetadataRepair
  );
  await versionTwentyTwoDatabase.initialize(versionTwentyTwoOptions);
  // 类型: object；作用: 提供 v23 必须原样保留的自定义 Package、Definition、授权和私有空间。
  const customSourceGraph = createVersionEightCustomSourceGraph();
  await versionTwentyTwoDatabase.runReadwrite(
    [
      BROWSER_PERSISTENCE_STORE.sourcePackages,
      BROWSER_PERSISTENCE_STORE.sourceDefinitions,
      BROWSER_PERSISTENCE_STORE.sourcePreferences,
      BROWSER_PERSISTENCE_STORE.sourceStorageEntries,
      BROWSER_PERSISTENCE_STORE.userFavorites,
      BROWSER_PERSISTENCE_STORE.userPlayHistory
    ],
    async (transaction) => {
      // 副作用: 写入合法自定义源完整保存图，证明通用系统源对账器不会改写用户导入脚本。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).put(customSourceGraph.sourcePackage);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).put(customSourceGraph.sourceDefinition);
      // 类型: IDBObjectStore；作用: 保存 v23 必须保留的启停、默认源、软隐藏和自定义授权决定。
      const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
      // 类型: object；作用: 只修改当前用例副本中的用户决定，不改变历史 系统数据源1 授权指纹。
      const preferencesRecord = await preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY);
      preferencesRecord.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled = false;
      preferencesRecord.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID] = customSourceGraph.sourceState;
      preferencesRecord.value.defaultSourceId = VERSION_EIGHT_CUSTOM_SOURCE_ID;
      preferencesRecord.value.removedSystemSourceIds = [PRESERVED_HIDDEN_SOURCE_ID];
      await preferencesStore.put(preferencesRecord);
      // 副作用: 同时写入系统源缓存和自定义源会话，证明 v23 不清理任何 Provider 私有空间。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put({
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID,
        partition: SOURCE_STORAGE_PARTITION.cache,
        key: 'v23-preserved-detail-cache',
        value: { marker: 'v22-detail-cache' }
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put(customSourceGraph.storageEntry);
      // 副作用: 写入收藏和历史哨兵，证明脚本发布迁移不进入用户内容业务语义。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).put({
        userId: userContentMockData.user.id,
        favoriteKey: 'v23-preserved-favorite',
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).put({
        userId: userContentMockData.user.id,
        historyKey: 'v23-preserved-history',
        sourceId: VERSION_EIGHT_CUSTOM_SOURCE_ID
      });
    }
  );
  // 类型: object；作用: 冻结升级前全部运行数据、自定义保存图和 系统数据源1 首次导入时间，供 v23 逐项比较。
  const preservedBeforeUpgrade = await versionTwentyTwoDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      runtime: await readPreservedRuntimeSnapshot(transaction),
      customPackage: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(VERSION_EIGHT_CUSTOM_PACKAGE_REF),
      customDefinition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(VERSION_EIGHT_CUSTOM_SOURCE_ID),
      systemSource1Package: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(staleSystemSource1Package.packageRef),
      systemSource1Definition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(SYSTEM_SOURCE_1_SOURCE_ID)
    })
  );
  versionTwentyTwoDatabase.close();

  // 类型: object；作用: 当前 2.18.0 目录是 v23 唯一允许采用的系统 Provider 发布事实。
  const currentOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 打开同一历史库并只执行新增 v23 对账迁移。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceDetailStatusRepair
  );
  await upgradedDatabase.initialize(currentOptions);
  // 类型: object；作用: 一次读取 v23 系统发布、用户决定、自定义源和运行数据最终事实。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      packages: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).getAll(),
      definitions: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll(),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      builtinCatalogRelease: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease),
      runtime: await readPreservedRuntimeSnapshot(transaction)
    })
  );
  // 类型: object；作用: 当前 系统数据源1 Package 必须与 2.0.10 datasource/系统数据源1.js 原文和哈希完全一致。
  const currentSystemSource1Package = currentOptions.sourceSeeds.packages.find(
    sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 当前 系统数据源1 Definition 只允许继承历史 importedAt，其他发布字段采用当前目录。
  const currentSystemSource1Definition = currentOptions.sourceSeeds.definitions.find(
    sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID
  );
  assert.equal(preservedBeforeUpgrade.systemSource1Definition.version, '2.0.9');
  assert.notEqual(preservedBeforeUpgrade.systemSource1Package.integrity.scriptHash, currentSystemSource1Package.integrity.scriptHash);
  assert.deepEqual(
    upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID),
    currentSystemSource1Package
  );
  assert.deepEqual(
    upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID),
    { ...currentSystemSource1Definition, importedAt: preservedBeforeUpgrade.systemSource1Definition.importedAt }
  );
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization,
    currentOptions.sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization
  );
  // 断言: v23 只替换系统发布事实，全部用户决定、自定义保存图、私有空间和用户内容必须逐项保持。
  assert.equal(upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled, false);
  assert.equal(upgradedSnapshot.preferences.value.defaultSourceId, VERSION_EIGHT_CUSTOM_SOURCE_ID);
  assert.deepEqual(upgradedSnapshot.preferences.value.removedSystemSourceIds, [PRESERVED_HIDDEN_SOURCE_ID]);
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID],
    customSourceGraph.sourceState
  );
  assert.deepEqual(
    upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    preservedBeforeUpgrade.customPackage
  );
  assert.deepEqual(
    upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    preservedBeforeUpgrade.customDefinition
  );
  assert.deepEqual(upgradedSnapshot.runtime, preservedBeforeUpgrade.runtime);
  assert.equal(upgradedSnapshot.schemaVersion.value, BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceDetailStatusRepair);
  assert.deepEqual(upgradedSnapshot.builtinCatalogRelease.value, currentOptions.builtinCatalogRelease);
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v23 到 v24 保留全部用户记录并补齐快照保存形状', async () => {
  // 类型: string；作用: 当前用户内容保存形状迁移用例独占数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: v23 历史库使用当前目录和空用户种子建立合法九仓保存图。
  const options = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 只初始化到 v23，确保旧用户记录尚无快照字段。
  const versionTwentyThreeDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceDetailStatusRepair
  );
  await versionTwentyThreeDatabase.initialize(options);
  // 类型: object；作用: 模拟 v23 收藏完整旧字段，v24 后除新增 contentSnapshot 外必须逐项保留。
  const legacyFavorite = {
    userId: userContentMockData.user.id,
    sourceId: SYSTEM_SOURCE_1_SOURCE_ID,
    contentId: 'legacy-favorite-content',
    favoriteKey: `${SYSTEM_SOURCE_1_SOURCE_ID}::legacy-favorite-content`,
    contentKey: `${SYSTEM_SOURCE_1_SOURCE_ID}::legacy-favorite-content`,
    favoritedAt: '2026-07-20T08:00:00.000Z',
    updatedAt: '2026-07-20T08:00:00.000Z'
  };
  // 类型: object；作用: 模拟 v23 电视剧单集历史，v24 只能从现有 episodeId/index 构造定位器。
  const legacyHistory = {
    userId: userContentMockData.user.id,
    sourceId: SYSTEM_SOURCE_1_SOURCE_ID,
    contentId: 'legacy-history-content',
    type: 'tv',
    episodeId: 'legacy-episode-3',
    episodeIndex: 3,
    historyKey: `${SYSTEM_SOURCE_1_SOURCE_ID}::legacy-history-content::legacy-episode-3`,
    contentKey: `${SYSTEM_SOURCE_1_SOURCE_ID}::legacy-history-content`,
    firstPlayedAt: '2026-07-20T09:00:00.000Z',
    lastPlayedAt: '2026-07-20T09:30:00.000Z',
    playedSeconds: 900,
    durationSeconds: 2700,
    playStatus: 'paused',
    playbackSourceId: 'legacy-line',
    updatedAt: '2026-07-20T09:30:00.000Z'
  };
  await versionTwentyThreeDatabase.runReadwrite(
    [BROWSER_PERSISTENCE_STORE.userFavorites, BROWSER_PERSISTENCE_STORE.userPlayHistory],
    async (transaction) => {
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).put(legacyFavorite);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).put(legacyHistory);
    }
  );
  versionTwentyThreeDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 打开同库执行唯一 v24 用户内容保存形状迁移。
  const upgradedDatabase = createDatabase(databaseName);
  await upgradedDatabase.initialize(options);
  // 类型: object；作用: 同时读取两类用户记录和 schema 事实，证明没有删除或伪造卡片内容。
  const snapshot = await upgradedDatabase.runReadonly(
    [
      BROWSER_PERSISTENCE_STORE.appMeta,
      BROWSER_PERSISTENCE_STORE.userFavorites,
      BROWSER_PERSISTENCE_STORE.userPlayHistory
    ],
    async (transaction) => ({
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      favorite: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites)
        .get([legacyFavorite.userId, legacyFavorite.favoriteKey]),
      history: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory)
        .get([legacyHistory.userId, legacyHistory.historyKey])
    })
  );
  assert.equal(snapshot.schemaVersion.value, BROWSER_PERSISTENCE_SCHEMA_VERSION.userContentSnapshots);
  assert.deepEqual(snapshot.favorite, { ...legacyFavorite, contentSnapshot: null });
  assert.deepEqual(snapshot.history, {
    ...legacyHistory,
    contentSnapshot: null,
    episodeLocator: {
      episodeId: legacyHistory.episodeId,
      seasonNumber: null,
      episodeNumber: null,
      episodeIndex: legacyHistory.episodeIndex,
      episodeTitle: ''
    }
  });
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v17 到 v18 原子发布搜索分页脚本并保留用户保存域', async () => {
  // 类型: string；作用: 当前 v17 到 v18 搜索分页能力发布用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 从当前目录克隆完整种子，再只把 系统数据源1 构造成自洽的 2.0.5 历史发布事实。
  const versionSeventeenOptions = createInitializationOptions();
  // 类型: object；作用: 定位 v17 将保存的 系统数据源1 Package，脚本文本和哈希必须一起降级。
  const staleSystemSource1Package = versionSeventeenOptions.sourceSeeds.packages.find(
    sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 定位 v17 系统数据源1 Definition，版本和导入审计字段由升级前保存图提供。
  const staleSystemSource1Definition = versionSeventeenOptions.sourceSeeds.definitions.find(
    sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 定位 v17 系统数据源1 用户状态，授权必须与降级后的脚本哈希和版本保持自洽。
  const staleSystemSource1State = versionSeventeenOptions.sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID];
  // 条件分支: 当前目录缺少 系统数据源1 任一关联保存对象时进入。
  // 执行内容: 夹具立即失败，不能构造半完成历史库掩盖目录错误。
  if (!staleSystemSource1Package || !staleSystemSource1Definition || !staleSystemSource1State) {
    throw new Error('v17 迁移夹具缺少 system-source-1 保存对象');
  }
  // 副作用: 只修改当前用例独占的克隆脚本，形成与当前目录脚本不同的 v17 哈希事实。
  staleSystemSource1Package.scriptContent = `${staleSystemSource1Package.scriptContent}\n// v17 stale search pagination fixture`;
  staleSystemSource1Package.integrity.scriptHash = createSourceScriptHash(staleSystemSource1Package.scriptContent);
  staleSystemSource1Definition.version = '2.0.5';
  staleSystemSource1State.authorization.authorizedVersion = staleSystemSource1Definition.version;
  staleSystemSource1State.authorization.authorizedScriptHash = staleSystemSource1Package.integrity.scriptHash;

  // 类型: BrowserPersistenceDatabase；作用: 只提交到 schema v17，确保搜索分页脚本尚未被 v18 采用。
  const versionSeventeenDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceTvCatalogRefresh
  );
  await versionSeventeenDatabase.initialize(versionSeventeenOptions);
  // 类型: object；作用: 提供 v18 必须原样保留的无关自定义 Package、Definition、授权和私有空间。
  const customSourceGraph = createVersionEightCustomSourceGraph();

  await versionSeventeenDatabase.runReadwrite(
    [
      BROWSER_PERSISTENCE_STORE.sourcePackages,
      BROWSER_PERSISTENCE_STORE.sourceDefinitions,
      BROWSER_PERSISTENCE_STORE.sourcePreferences,
      BROWSER_PERSISTENCE_STORE.sourceStorageEntries,
      BROWSER_PERSISTENCE_STORE.userFavorites,
      BROWSER_PERSISTENCE_STORE.userPlayHistory
    ],
    async (transaction) => {
      // 副作用: 追加完整自定义源保存图，证明 v18 不把用户脚本当作系统目录成员覆盖。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .put(customSourceGraph.sourcePackage);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .put(customSourceGraph.sourceDefinition);
      // 类型: IDBObjectStore；作用: 读取并提交 v18 必须保留的用户默认源、软隐藏和启停决定。
      const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
      // 类型: object；作用: 保存 v17 全局偏好副本，只写入明确的用户决定和自定义授权。
      const preferencesRecord = await preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY);
      preferencesRecord.value.defaultSourceId = VERSION_EIGHT_CUSTOM_SOURCE_ID;
      preferencesRecord.value.removedSystemSourceIds = [PRESERVED_HIDDEN_SOURCE_ID];
      preferencesRecord.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled = false;
      preferencesRecord.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID] = customSourceGraph.sourceState;
      await preferencesStore.put(preferencesRecord);

      // 副作用: 写入 系统数据源1 缓存和自定义源会话，锁定 v18 不清空任何 sourceId 私有空间。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put({
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID,
        partition: SOURCE_STORAGE_PARTITION.cache,
        key: 'preserved-search-cache',
        value: { marker: 'v17-system-source-1-cache' }
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries)
        .put(customSourceGraph.storageEntry);
      // 副作用: 追加收藏和历史哨兵，证明系统脚本发布不进入用户内容业务仓。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).put({
        userId: userContentMockData.user.id,
        favoriteKey: 'v18-preserved-favorite',
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).put({
        userId: userContentMockData.user.id,
        historyKey: 'v18-preserved-history',
        sourceId: VERSION_EIGHT_CUSTOM_SOURCE_ID
      });
    }
  );

  // 类型: object；作用: 冻结升级前运行数据、自定义保存图和 系统数据源1 首次导入时间权威事实。
  const preservedBeforeUpgrade = await versionSeventeenDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      runtime: await readPreservedRuntimeSnapshot(transaction),
      customPackage: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(VERSION_EIGHT_CUSTOM_PACKAGE_REF),
      customDefinition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(VERSION_EIGHT_CUSTOM_SOURCE_ID),
      systemSource1Package: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(staleSystemSource1Package.packageRef),
      systemSource1Definition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(SYSTEM_SOURCE_1_SOURCE_ID)
    })
  );
  versionSeventeenDatabase.close();

  // 类型: object；作用: 当前受审目录输入，是 v18 唯一允许采用的系统 Provider 发布事实。
  const currentOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 目标固定为 v18，避免后续连续迁移掩盖本用例的搜索分页发布边界。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchPaginationRefresh
  );
  await upgradedDatabase.initialize(currentOptions);
  // 类型: object；作用: 一次读取 v18 系统发布、用户决定、自定义保存图和运行数据最终事实。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      packages: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).getAll(),
      definitions: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll(),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      builtinCatalogRelease: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease),
      runtime: await readPreservedRuntimeSnapshot(transaction)
    })
  );
  // 类型: object；作用: 定位当前 系统数据源1 Package，必须与 datasource/系统数据源1.js 原文和哈希完全一致。
  const currentSystemSource1Package = currentOptions.sourceSeeds.packages.find(
    sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 定位当前 系统数据源1 Definition，v18 只保留历史 importedAt。
  const currentSystemSource1Definition = currentOptions.sourceSeeds.definitions.find(
    sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 断言: v17 的 2.0.5 旧脚本和当前目录脚本必须真实不同，确保本用例验证发布而不是相同对象重写。
  assert.equal(preservedBeforeUpgrade.systemSource1Definition.version, '2.0.5');
  assert.notEqual(preservedBeforeUpgrade.systemSource1Package.integrity.scriptHash, currentSystemSource1Package.integrity.scriptHash);
  assert.deepEqual(
    upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID),
    currentSystemSource1Package
  );
  assert.deepEqual(
    upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID),
    { ...currentSystemSource1Definition, importedAt: preservedBeforeUpgrade.systemSource1Definition.importedAt }
  );
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization,
    currentOptions.sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization
  );
  // 断言: v18 只替换系统发布事实，用户决定、自定义源、私有空间和用户内容逐项保持。
  assert.equal(upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled, false);
  assert.equal(upgradedSnapshot.preferences.value.defaultSourceId, VERSION_EIGHT_CUSTOM_SOURCE_ID);
  assert.deepEqual(upgradedSnapshot.preferences.value.removedSystemSourceIds, [PRESERVED_HIDDEN_SOURCE_ID]);
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID],
    customSourceGraph.sourceState
  );
  assert.deepEqual(
    upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    preservedBeforeUpgrade.customPackage
  );
  assert.deepEqual(
    upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    preservedBeforeUpgrade.customDefinition
  );
  assert.deepEqual(upgradedSnapshot.runtime, preservedBeforeUpgrade.runtime);
  assert.equal(upgradedSnapshot.schemaVersion.value, BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchPaginationRefresh);
  assert.deepEqual(upgradedSnapshot.builtinCatalogRelease.value, currentOptions.builtinCatalogRelease);
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v18 到 v19 原子发布详情映射脚本并保留用户保存域', async () => {
  // 类型: string；作用: 当前 v19 详情映射发布用例独占数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 从当前目录克隆完整种子，再把 系统数据源1 构造成自洽的 2.0.6 v18 发布事实。
  const versionEighteenOptions = createInitializationOptions();
  // 类型: object；作用: 定位 v18 将保存的 系统数据源1 Package，脚本文本和哈希必须一起降级。
  const staleSystemSource1Package = versionEighteenOptions.sourceSeeds.packages.find(
    sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 定位 v18 系统数据源1 Definition，首次导入时间由升级前保存图继续拥有。
  const staleSystemSource1Definition = versionEighteenOptions.sourceSeeds.definitions.find(
    sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 定位 v18 系统数据源1 用户状态，授权版本和指纹必须与降级脚本自洽。
  const staleSystemSource1State = versionEighteenOptions.sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID];
  // 条件分支: 当前目录缺少 系统数据源1 任一关联保存对象时进入；执行内容: 夹具立即失败，不制造半完成历史库。
  if (!staleSystemSource1Package || !staleSystemSource1Definition || !staleSystemSource1State) {
    throw new Error('v18 详情映射迁移夹具缺少 system-source-1 保存对象');
  }
  // 副作用: 只修改当前用例克隆脚本，形成与 2.0.7 详情解析不同的 v18 指纹事实。
  staleSystemSource1Package.scriptContent = `${staleSystemSource1Package.scriptContent}\n// v18 stale detail mapping fixture`;
  staleSystemSource1Package.integrity.scriptHash = createSourceScriptHash(staleSystemSource1Package.scriptContent);
  staleSystemSource1Definition.version = '2.0.6';
  staleSystemSource1State.authorization.authorizedVersion = staleSystemSource1Definition.version;
  staleSystemSource1State.authorization.authorizedScriptHash = staleSystemSource1Package.integrity.scriptHash;

  // 类型: BrowserPersistenceDatabase；作用: 只提交到 v18，确保当前详情脚本尚未由 v19 采用。
  const versionEighteenDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchPaginationRefresh
  );
  await versionEighteenDatabase.initialize(versionEighteenOptions);
  // 类型: object；作用: 提供 v19 必须原样保留的自定义 Package、Definition、授权和私有空间。
  const customSourceGraph = createVersionEightCustomSourceGraph();
  await versionEighteenDatabase.runReadwrite(
    [
      BROWSER_PERSISTENCE_STORE.sourcePackages,
      BROWSER_PERSISTENCE_STORE.sourceDefinitions,
      BROWSER_PERSISTENCE_STORE.sourcePreferences,
      BROWSER_PERSISTENCE_STORE.sourceStorageEntries,
      BROWSER_PERSISTENCE_STORE.userFavorites,
      BROWSER_PERSISTENCE_STORE.userPlayHistory
    ],
    async (transaction) => {
      // 副作用: 写入完整自定义源保存图，证明 v19 只更新应用拥有的系统目录成员。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).put(customSourceGraph.sourcePackage);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).put(customSourceGraph.sourceDefinition);
      // 类型: IDBObjectStore；作用: 保存用户默认源、软隐藏、系统数据源1 关闭状态和自定义授权决定。
      const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
      // 类型: object；作用: 当前 v18 偏好副本，只修改明确用户决定和自定义状态。
      const preferencesRecord = await preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY);
      preferencesRecord.value.defaultSourceId = VERSION_EIGHT_CUSTOM_SOURCE_ID;
      preferencesRecord.value.removedSystemSourceIds = [PRESERVED_HIDDEN_SOURCE_ID];
      preferencesRecord.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled = false;
      preferencesRecord.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID] = customSourceGraph.sourceState;
      await preferencesStore.put(preferencesRecord);
      // 副作用: 写入系统缓存和自定义会话，锁定 v19 不清理任何 Provider 私有空间。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put({
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID,
        partition: SOURCE_STORAGE_PARTITION.cache,
        key: 'v19-preserved-detail-cache',
        value: { marker: 'keep' }
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put(customSourceGraph.storageEntry);
      // 副作用: 写入收藏和历史哨兵，证明详情脚本发布不进入用户内容仓。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).put({
        userId: userContentMockData.user.id,
        favoriteKey: 'v19-preserved-favorite',
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).put({
        userId: userContentMockData.user.id,
        historyKey: 'v19-preserved-history',
        sourceId: VERSION_EIGHT_CUSTOM_SOURCE_ID
      });
    }
  );
  // 类型: object；作用: 冻结 v19 升级前运行数据、自定义保存图和 系统数据源1 首次导入时间。
  const preservedBeforeUpgrade = await versionEighteenDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      runtime: await readPreservedRuntimeSnapshot(transaction),
      customPackage: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(VERSION_EIGHT_CUSTOM_PACKAGE_REF),
      customDefinition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(VERSION_EIGHT_CUSTOM_SOURCE_ID),
      systemSource1Definition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(SYSTEM_SOURCE_1_SOURCE_ID)
    })
  );
  versionEighteenDatabase.close();

  // 类型: object；作用: 当前目录输入是 v19 唯一允许采用的系统 Provider 发布事实。
  const currentOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 目标固定为 v19，只执行详情映射发布而不混入后续迁移。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceDetailMappingRefresh
  );
  await upgradedDatabase.initialize(currentOptions);
  // 类型: object；作用: 一次读取 v19 系统发布、用户决定、自定义保存图和运行数据最终事实。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      packages: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).getAll(),
      definitions: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll(),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      builtinCatalogRelease: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease),
      runtime: await readPreservedRuntimeSnapshot(transaction)
    })
  );
  // 类型: object；作用: 定位当前 系统数据源1 Package，必须与 datasource/系统数据源1.js 原文和哈希完全一致。
  const currentSystemSource1Package = currentOptions.sourceSeeds.packages.find(
    sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 定位当前 系统数据源1 Definition，v19 只保留历史 importedAt。
  const currentSystemSource1Definition = currentOptions.sourceSeeds.definitions.find(
    sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID
  );
  assert.equal(preservedBeforeUpgrade.systemSource1Definition.version, '2.0.6');
  assert.deepEqual(
    upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID),
    currentSystemSource1Package
  );
  assert.deepEqual(
    upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID),
    { ...currentSystemSource1Definition, importedAt: preservedBeforeUpgrade.systemSource1Definition.importedAt }
  );
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization,
    currentOptions.sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization
  );
  // 断言: v19 只替换系统发布事实，用户决定、自定义源、私有空间和用户内容逐项保持。
  assert.equal(upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled, false);
  assert.equal(upgradedSnapshot.preferences.value.defaultSourceId, VERSION_EIGHT_CUSTOM_SOURCE_ID);
  assert.deepEqual(upgradedSnapshot.preferences.value.removedSystemSourceIds, [PRESERVED_HIDDEN_SOURCE_ID]);
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID],
    customSourceGraph.sourceState
  );
  assert.deepEqual(
    upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    preservedBeforeUpgrade.customPackage
  );
  assert.deepEqual(
    upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    preservedBeforeUpgrade.customDefinition
  );
  assert.deepEqual(upgradedSnapshot.runtime, preservedBeforeUpgrade.runtime);
  assert.equal(upgradedSnapshot.schemaVersion.value, BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceDetailMappingRefresh);
  assert.deepEqual(upgradedSnapshot.builtinCatalogRelease.value, currentOptions.builtinCatalogRelease);
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v10 连续到 v12 原子补入默认用户展示偏好并保留全部既有数据', async () => {
  // 类型: string；作用: 当前 v11/v12 用户设置连续迁移用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 提供完整九仓首次种子，并让 v10 空库写入不含快捷键与首页展示偏好的历史设置行。
  const initializationOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 只提交到 v10，建立真实迁移前数据库。
  const versionTenDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRequestPolicyRefresh
  );
  await versionTenDatabase.initialize(initializationOptions);
  await versionTenDatabase.runReadwrite(
    [BROWSER_PERSISTENCE_STORE.userSettings],
    async (transaction) => {
      // 副作用: 写入可区分的合法恢复策略，证明连续迁移只追加默认设置而不覆盖用户决定。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings).put({
        userId: userContentMockData.user.id,
        resumePolicy: {
          nearStartThresholdSeconds: 12,
          nearEndThresholdSeconds: 90
        }
      });
    }
  );
  // 类型: object；作用: 冻结 v11 前全部运行数据，供连续迁移后逐域比较。
  const preservedBeforeUpgrade = await versionTenDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    readPreservedRuntimeSnapshot
  );
  versionTenDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 明确只执行到 v12，隔离验证用户设置迁移而不混入后续系统源目录发布。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.homeDisplayPreferencesRefresh
  );
  await upgradedDatabase.initialize(initializationOptions);
  // 类型: object；作用: 同一只读事务读取运行数据与最终 schemaVersion。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      runtime: await readPreservedRuntimeSnapshot(transaction),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion)
    })
  );
  assertRuntimePreservedWithShortcutMigration(upgradedSnapshot.runtime, preservedBeforeUpgrade);
  assert.equal(
    upgradedSnapshot.schemaVersion.value,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.homeDisplayPreferencesRefresh
  );
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v12 连续到 v18 发布当前系统源并保留全部用户保存域', async () => {
  // 类型: string；作用: 当前 v13 至 v18 六次连续系统源发布用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 构造名称、脚本版本和授权哈希均属于上一发布的合法 v12 初始化输入。
  const versionTwelveOptions = createInitializationOptions();
  versionTwelveOptions.sourceSeeds = createVersionTwelveSourceSeeds();
  // 类型: object；作用: 增加不属于产品目录的自定义保存图，证明连续系统源对账不会扩大到用户脚本。
  const customSourceGraph = createVersionEightCustomSourceGraph();
  versionTwelveOptions.sourceSeeds.packages.push(customSourceGraph.sourcePackage);
  versionTwelveOptions.sourceSeeds.definitions.push(customSourceGraph.sourceDefinition);
  versionTwelveOptions.sourceSeeds.preferences.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID] = customSourceGraph.sourceState;
  versionTwelveOptions.sourceSeeds.storageNamespaces[VERSION_EIGHT_CUSTOM_SOURCE_ID] = {
    settings: { theme: 'preserved-custom-setting' },
    credentials: {},
    session: {},
    cache: {},
    diagnostics: {}
  };
  // 状态变化: 自定义源保持用户默认选择，系统源保留关闭与软隐藏决定，v13 至 v18 不得按当前目录重置这些偏好。
  versionTwelveOptions.sourceSeeds.preferences.defaultSourceId = VERSION_EIGHT_CUSTOM_SOURCE_ID;
  versionTwelveOptions.sourceSeeds.preferences.removedSystemSourceIds = [PRESERVED_HIDDEN_SOURCE_ID];
  versionTwelveOptions.sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled = false;
  // 状态变化: 在系统源私有空间写入凭据哨兵，证明脚本与授权发布不清空 Provider 自有状态。
  versionTwelveOptions.sourceSeeds.storageNamespaces[SYSTEM_SOURCE_1_SOURCE_ID].credentials = {
    preservedCredential: 'v12-session-token'
  };

  // 类型: BrowserPersistenceDatabase；作用: 只提交到 v12，建立包含旧名称和完整用户保存域的真实前置库。
  const versionTwelveDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.homeDisplayPreferencesRefresh
  );
  await versionTwelveDatabase.initialize(versionTwelveOptions);
  // 类型: object；作用: 冻结升级前系统发布、自定义保存图、偏好和五类运行数据供逐项比较。
  const preservedBeforeUpgrade = await versionTwelveDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      packages: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).getAll(),
      definitions: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll(),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      runtime: await readPreservedRuntimeSnapshot(transaction)
    })
  );
  // 断言: v12 全部系统 Definition 确实带类别后缀，保证本用例验证数据库迁移而不是当前种子重复写入。
  assert.equal(
    preservedBeforeUpgrade.definitions.filter(definition => definition.sourceKind === 'system')
      .every(definition => definition.name.endsWith(' 数据源')),
    true
  );
  versionTwelveDatabase.close();

  // 类型: object；作用: 当前目录提供纯名称、补丁版本、完整脚本和同源授权的唯一当前发布输入。
  const currentOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 目标固定为 v18，在同一 upgrade transaction 连续执行 v13 至 v18。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchPaginationRefresh
  );
  await upgradedDatabase.initialize(currentOptions);
  // 类型: object；作用: 一次读取 v18 系统发布事实、用户决定、自定义保存图、运行数据和版本元信息。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      packages: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).getAll(),
      definitions: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll(),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      runtime: await readPreservedRuntimeSnapshot(transaction)
    })
  );

  currentOptions.sourceSeeds.definitions.forEach((currentDefinition) => {
    // 类型: object|undefined；作用: 定位同源当前 Package，验证连续发布后脚本文本和哈希完整采用目录事实。
    const currentPackage = currentOptions.sourceSeeds.packages.find(
      sourcePackage => sourcePackage.sourceId === currentDefinition.id
    );
    // 类型: object|undefined；作用: 定位 v12 同源 Definition，验证首次导入时间是用户保存事实而非产品发布时间。
    const previousDefinition = preservedBeforeUpgrade.definitions.find(
      sourceDefinition => sourceDefinition.id === currentDefinition.id
    );
    // 类型: object|undefined；作用: 定位升级后的同源 Definition，验证纯名称和补丁版本已被原子采用。
    const upgradedDefinition = upgradedSnapshot.definitions.find(
      sourceDefinition => sourceDefinition.id === currentDefinition.id
    );
    assert.deepEqual(
      upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === currentDefinition.id),
      currentPackage
    );
    assert.deepEqual(upgradedDefinition, {
      ...currentDefinition,
      importedAt: previousDefinition.importedAt
    });
    assert.match(upgradedDefinition.name, /^系统数据源\d+$/u);
    assert.deepEqual(
      upgradedSnapshot.preferences.value.sourceStates[currentDefinition.id].authorization,
      currentOptions.sourceSeeds.preferences.sourceStates[currentDefinition.id].authorization
    );
  });

  // 断言: v13 至 v18 只替换系统发布事实；用户启停、默认源、软隐藏、自定义源、私有空间和用户四仓保持原值。
  assert.equal(upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled, false);
  assert.equal(upgradedSnapshot.preferences.value.defaultSourceId, VERSION_EIGHT_CUSTOM_SOURCE_ID);
  assert.deepEqual(upgradedSnapshot.preferences.value.removedSystemSourceIds, [PRESERVED_HIDDEN_SOURCE_ID]);
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID],
    customSourceGraph.sourceState
  );
  assert.deepEqual(
    upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    customSourceGraph.sourcePackage
  );
  assert.deepEqual(
    upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    customSourceGraph.sourceDefinition
  );
  assert.deepEqual(upgradedSnapshot.runtime, preservedBeforeUpgrade.runtime);
  assert.equal(
    upgradedSnapshot.schemaVersion.value,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchPaginationRefresh
  );
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v11 设置迁移失败会原子保留完整 v10', async () => {
  // 类型: string；作用: 当前 v11 回滚用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 提供 v10 初始化和失败后重开共同使用的合法其他领域种子。
  const initializationOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 建立可定向破坏 userSettings 的合法 v10 基线。
  const versionTenDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRequestPolicyRefresh
  );
  await versionTenDatabase.initialize(initializationOptions);
  // 类型: object；作用: 增加 v10 契约不允许的字段，触发 v11 严格迁移失败。
  const corruptedSettings = {
    userId: userContentMockData.user.id,
    resumePolicy: structuredClone(userContentMockData.resumePolicy),
    unexpectedField: 'must-rollback'
  };
  await versionTenDatabase.runReadwrite(
    [BROWSER_PERSISTENCE_STORE.userSettings],
    async transaction => transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings).put(corruptedSettings)
  );
  versionTenDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 尝试执行必须失败并回滚的 v11 升级。
  const failedUpgradeDatabase = createDatabase(databaseName);
  await assert.rejects(
    failedUpgradeDatabase.initialize(initializationOptions),
    error => error instanceof BrowserPersistenceError
      && error.code === BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed
  );
  // 类型: BrowserPersistenceDatabase；作用: 按 v10 重新打开，证明 IndexedDB 没有提交部分 v11 结果。
  const preservedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRequestPolicyRefresh
  );
  await preservedDatabase.initialize(initializationOptions);
  // 类型: object；作用: 同时读取损坏行和版本元信息，验证失败迁移没有改写任一事实。
  const preservedSnapshot = await preservedDatabase.runReadonly(
    [BROWSER_PERSISTENCE_STORE.userSettings, BROWSER_PERSISTENCE_STORE.appMeta],
    async (transaction) => ({
      settings: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings)
        .get(userContentMockData.user.id),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion)
    })
  );
  assert.deepEqual(preservedSnapshot.settings, corruptedSettings);
  assert.equal(
    preservedSnapshot.schemaVersion.value,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRequestPolicyRefresh
  );
  await preservedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v12 首页展示迁移失败会原子保留完整 v11', async () => {
  // 类型: string；作用: 当前 v12 回滚用例独占的数据库名称，避免与其他迁移用例共享保存图。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 提供当前真实系统源与用户种子，建立 v11 迁移前置库。
  const initializationOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 建立只包含 userId、恢复策略和快捷键的 v11 合法基线。
  const versionElevenDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.userShortcutPreferencesRefresh
  );
  await versionElevenDatabase.initialize(initializationOptions);
  // 类型: object；作用: 给 v11 设置行增加未声明字段，触发 v12 精确字段校验并验证整库回滚。
  const corruptedSettings = {
    userId: userContentMockData.user.id,
    resumePolicy: structuredClone(userContentMockData.resumePolicy),
    shortcutPreferences: createExpectedShortcutPreferences(),
    unexpectedField: 'must-rollback-v12'
  };
  await versionElevenDatabase.runReadwrite(
    [BROWSER_PERSISTENCE_STORE.userSettings],
    async transaction => transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings).put(corruptedSettings)
  );
  versionElevenDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 尝试执行必须失败的 v11 到 v12 升级。
  const failedUpgradeDatabase = createDatabase(databaseName);
  await assert.rejects(
    failedUpgradeDatabase.initialize(initializationOptions),
    error => error instanceof BrowserPersistenceError
      && error.code === BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed
  );
  // 类型: BrowserPersistenceDatabase；作用: 按 v11 重开，证明 v12 未提交部分首页展示字段或版本事实。
  const preservedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.userShortcutPreferencesRefresh
  );
  await preservedDatabase.initialize(initializationOptions);
  // 类型: object；作用: 同时读取失败升级后的设置行和 schemaVersion，证明 v12 没有提交部分结果。
  const preservedSnapshot = await preservedDatabase.runReadonly(
    [BROWSER_PERSISTENCE_STORE.userSettings, BROWSER_PERSISTENCE_STORE.appMeta],
    async (transaction) => ({
      settings: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings)
        .get(userContentMockData.user.id),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion)
    })
  );
  assert.deepEqual(preservedSnapshot.settings, corruptedSettings);
  assert.equal(
    preservedSnapshot.schemaVersion.value,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.userShortcutPreferencesRefresh
  );
  await preservedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v2 连续到 v6 精确退役旧源并保留无关数据', async () => {
  // 类型: string；作用: 当前领域迁移用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 隔离九条旧 Mock 保存图，并追加一个不属于迁移删除集合的自定义源。
  const legacySeeds = structuredClone(mockSourceRepositorySeeds);
  // 类型: string；作用: 标识必须跨 v3 完整保留的无关自定义源。
  const preservedSourceId = 'preserved-custom-source';
  // 类型: string；作用: 为保留自定义源创建稳定 Package 引用。
  const preservedPackageRef = `source-package::${preservedSourceId}`;
  // 类型: object；作用: 复用受审脚本文本与完整性字段，建立 Repository 合法的无关自定义 Package。
  const preservedPackage = {
    ...structuredClone(sourceRepositorySeeds.packages[0]),
    packageRef: preservedPackageRef,
    sourceId: preservedSourceId,
    providerKey: `${preservedSourceId}.provider`
  };
  // 类型: object；作用: 建立与保留 Package 一致且不会与当前系统身份冲突的自定义 Definition。
  const preservedDefinition = {
    ...structuredClone(sourceRepositorySeeds.definitions[0]),
    id: preservedSourceId,
    name: '应保留的自定义数据源',
    sourceKind: SOURCE_KIND.custom,
    providerKey: preservedPackage.providerKey,
    packageRef: preservedPackageRef,
    importMethod: IMPORT_METHOD.text
  };
  legacySeeds.packages.push(preservedPackage);
  legacySeeds.definitions.push(preservedDefinition);
  // 赋值副作用: 让无关自定义源成为旧默认源，验证迁移不会擅自交接有效用户选择。
  legacySeeds.preferences.defaultSourceId = preservedSourceId;
  legacySeeds.preferences.sourceStates[preservedSourceId] = {
    enabled: false,
    authorization: {
      status: AUTHORIZATION_STATUS.pending,
      authorizedAt: '',
      authorizedVersion: '',
      authorizedScriptHash: ''
    }
  };
  legacySeeds.storageNamespaces[preservedSourceId] = {
    settings: {},
    credentials: {},
    session: {},
    cache: {},
    diagnostics: {}
  };

  // 类型: BrowserPersistenceDatabase；作用: 建立包含旧九源、无关自定义源和空用户种子的正式 v2 数据库。
  const versionTwoDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.lifecycleMetadata
  );
  await versionTwoDatabase.initialize({
    sourceSeeds: legacySeeds,
    userContentSeed: structuredClone(userContentMockData),
    builtinCatalogRelease: createHistoricalCatalogRelease('legacy-v2', '3'),
    legacyProductSourceIds: LEGACY_PRODUCT_SOURCE_IDS,
    retiredBuiltinSourceIds: RETIRED_BUILTIN_SOURCE_IDS
  });

  await versionTwoDatabase.runReadwrite(
    [
      BROWSER_PERSISTENCE_STORE.sourceStorageEntries,
      BROWSER_PERSISTENCE_STORE.userFavorites,
      BROWSER_PERSISTENCE_STORE.userPlayHistory
    ],
    async (transaction) => {
      // 类型: IDBObjectStore；作用: 写入旧源和保留源缓存，验证 v3 只清理目标命名空间。
      const storageStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries);
      await storageStore.add({ sourceId: 'system-source-1', partition: SOURCE_STORAGE_PARTITION.cache, key: 'legacy', value: 1 });
      await storageStore.add({ sourceId: preservedSourceId, partition: SOURCE_STORAGE_PARTITION.cache, key: 'preserved', value: 2 });
      // 类型: IDBObjectStore；作用: 写入旧源和保留源收藏，验证悬空清理只匹配旧 sourceId。
      const favoritesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites);
      await favoritesStore.add({ userId: 'guest-user', favoriteKey: 'legacy-favorite', sourceId: 'system-source-1' });
      await favoritesStore.add({ userId: 'guest-user', favoriteKey: 'preserved-favorite', sourceId: preservedSourceId });
      // 类型: IDBObjectStore；作用: 写入旧源和保留源历史，验证其他用户内容逐项保持。
      const historyStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory);
      await historyStore.add({ userId: 'guest-user', historyKey: 'legacy-history', sourceId: 'system-source-1' });
      await historyStore.add({ userId: 'guest-user', historyKey: 'preserved-history', sourceId: preservedSourceId });
    }
  );
  versionTwoDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 目标固定为 v6，连续执行 v3 到 v6 upgrade transaction。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceChallengeRefresh
  );
  await upgradedDatabase.initialize(createInitializationOptions());
  // 类型: object；作用: 一次读取全部迁移写集与两个只保留用户仓的最终事实。
  const snapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      packages: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).getAll(),
      definitions: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll(),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      storageEntries: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).getAll(),
      favorites: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).getAll(),
      playHistory: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).getAll(),
      profiles: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userProfiles).getAll(),
      settings: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userSettings).getAll(),
      builtinCatalogRelease: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease)
    })
  );

  // 类型: Set<string>；作用: 比较迁移后当前系统源与保留自定义源的唯一 Definition 身份。
  const definitionIds = new Set(snapshot.definitions.map(definition => definition.id));
  assert.equal(snapshot.packages.length, sourceRepositorySeeds.packages.length + 1);
  assert.equal(snapshot.definitions.length, sourceRepositorySeeds.definitions.length + 1);
  assert.equal(definitionIds.has(preservedSourceId), true);
  LEGACY_PRODUCT_SOURCE_IDS.forEach((sourceId) => assert.equal(definitionIds.has(sourceId), false));
  assert.equal(snapshot.preferences.value.defaultSourceId, preservedSourceId);
  assert.equal(Object.hasOwn(snapshot.preferences.value.sourceStates, preservedSourceId), true);
  assert.equal(snapshot.storageEntries.some(entry => entry.sourceId === 'system-source-1'), false);
  assert.equal(snapshot.storageEntries.some(entry => entry.sourceId === preservedSourceId), true);
  assert.deepEqual(snapshot.favorites.map(record => record.sourceId), [preservedSourceId]);
  assert.deepEqual(snapshot.playHistory.map(record => record.sourceId), [preservedSourceId]);
  assert.equal(snapshot.profiles.length, 1);
  assert.equal(snapshot.settings.length, 1);
  assert.deepEqual(
    snapshot.builtinCatalogRelease.value,
    createInitializationOptions().builtinCatalogRelease
  );
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v3 连续到 v6 刷新内置脚本事实并保留用户决定与运行数据', async () => {
  // 类型: string；作用: 当前内置目录刷新用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 构造 系统数据源1 仍为 1.0.1 且目录时间早于当前发布的合法 v3 保存图。
  const versionThreeSeeds = createVersionThreeSourceSeeds();
  // 类型: object；作用: 保存 v3 初始化输入，后续升级不依赖当前目录种子引用。
  const versionThreeOptions = createInitializationOptions();
  versionThreeOptions.sourceSeeds = versionThreeSeeds;
  versionThreeOptions.builtinCatalogRelease = createHistoricalCatalogRelease('test-catalog-v3', '4');
  // 类型: BrowserPersistenceDatabase；作用: 只执行到 builtinSourceCatalog，建立真实 v3 前置数据库。
  const versionThreeDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceCatalog
  );
  await versionThreeDatabase.initialize(versionThreeOptions);

  await versionThreeDatabase.runReadwrite(
    [
      BROWSER_PERSISTENCE_STORE.sourcePreferences,
      BROWSER_PERSISTENCE_STORE.sourceStorageEntries,
      BROWSER_PERSISTENCE_STORE.userFavorites,
      BROWSER_PERSISTENCE_STORE.userPlayHistory
    ],
    async (transaction) => {
      // 类型: IDBObjectStore；作用: 写入迁移必须保留的启停、默认源和软隐藏用户决定。
      const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
      // 类型: object；作用: 隔离修改 v3 全局偏好，不改写测试模块种子对象。
      const preferencesRecord = await preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY);
      preferencesRecord.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled = false;
      preferencesRecord.value.defaultSourceId = PRESERVED_DEFAULT_SOURCE_ID;
      preferencesRecord.value.removedSystemSourceIds = [PRESERVED_HIDDEN_SOURCE_ID];
      await preferencesStore.put(preferencesRecord);

      // 副作用: 写入 Provider 私有缓存，证明 v4/v5/v6 不通过重建命名空间清除运行数据。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put({
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID,
        partition: SOURCE_STORAGE_PARTITION.cache,
        key: 'v4-preserved-cache',
        value: { marker: 'keep' }
      });
      // 副作用: 写入当前真实源收藏和历史哨兵，证明 v4/v5/v6 不把目录发布误当成用户内容迁移。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).put({
        userId: userContentMockData.user.id,
        favoriteKey: 'v4-preserved-favorite',
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).put({
        userId: userContentMockData.user.id,
        historyKey: 'v4-preserved-history',
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID
      });
    }
  );
  // 类型: object；作用: 保存升级前私有空间与用户四仓完整快照，作为逐项保留权威。
  const preservedBeforeUpgrade = await versionThreeDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    readPreservedRuntimeSnapshot
  );
  versionThreeDatabase.close();

  // 类型: object；作用: 当前 v6 初始化输入，Package、Definition 与授权均来自现行目录。
  const currentOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 目标固定为 v6，连续执行 v4、v5 和 v6 对账。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceChallengeRefresh
  );
  await upgradedDatabase.initialize(currentOptions);
  // 类型: object；作用: 一次读取 v6 对账结果、元信息和必须保持的运行数据。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      packages: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).getAll(),
      definitions: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll(),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      builtinCatalogRelease: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      preservedRuntime: await readPreservedRuntimeSnapshot(transaction)
    })
  );

  sourceRepositorySeeds.definitions.forEach((seedDefinition) => {
    // 类型: object|undefined；作用: 定位 v6 提交后的同源 Package，脚本文本与哈希必须等于当前目录种子。
    const storedPackage = upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === seedDefinition.id);
    // 类型: object|undefined；作用: 定位 v6 提交后的同源 Definition，版本和更新时间必须采用当前目录。
    const storedDefinition = upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === seedDefinition.id);
    // 类型: object；作用: 形成只保留旧 importedAt 的精确 Definition 期望。
    const expectedDefinition = { ...seedDefinition, importedAt: VERSION_THREE_CATALOG_TIME };
    assert.deepEqual(storedPackage, sourceRepositorySeeds.packages.find(sourcePackage => sourcePackage.sourceId === seedDefinition.id));
    assert.deepEqual(storedDefinition, expectedDefinition);
    assert.equal(
      upgradedSnapshot.preferences.value.sourceStates[seedDefinition.id].enabled,
      seedDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID ? false : true
    );
    assert.deepEqual(
      upgradedSnapshot.preferences.value.sourceStates[seedDefinition.id].authorization,
      sourceRepositorySeeds.preferences.sourceStates[seedDefinition.id].authorization
    );
  });
  assert.equal(upgradedSnapshot.preferences.value.defaultSourceId, PRESERVED_DEFAULT_SOURCE_ID);
  assert.deepEqual(upgradedSnapshot.preferences.value.removedSystemSourceIds, [PRESERVED_HIDDEN_SOURCE_ID]);
  // 版本边界: v4 至 v6 只更新系统目录，不得提前执行 v11/v12 用户设置扩展。
  assert.deepEqual(upgradedSnapshot.preservedRuntime, preservedBeforeUpgrade);
  assert.deepEqual(upgradedSnapshot.builtinCatalogRelease.value, currentOptions.builtinCatalogRelease);
  assert.equal(
    upgradedSnapshot.schemaVersion.value,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceChallengeRefresh
  );
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v4 到 v6 原子恢复缺失系统记录并清理陈旧同源包', async () => {
  // 类型: string；作用: 当前 v6 系统源恢复用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 使用当前目录种子建立可提交 v4、随后可定向破坏系统记录的历史库。
  const versionFourOptions = createInitializationOptions();
  versionFourOptions.builtinCatalogRelease = createHistoricalCatalogRelease('test-catalog-v4', '5');
  // 类型: BrowserPersistenceDatabase；作用: 只执行到 v4，模拟开发期间已经提交 schema 但业务图处于中间版本的浏览器库。
  const versionFourDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRefresh
  );
  await versionFourDatabase.initialize(versionFourOptions);

  // 类型: object；作用: 定位将被删除并由 v5/v6 从当前目录恢复的 系统数据源1 Package。
  const systemSource1Package = versionFourOptions.sourceSeeds.packages.find(sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID);
  // 类型: object；作用: 构造 sourceId 仍命中 系统数据源1、但 packageRef 和脚本文本均陈旧的同源包。
  const staleSystemSource1Package = structuredClone(systemSource1Package);
  staleSystemSource1Package.packageRef = `${systemSource1Package.packageRef}::stale`;
  staleSystemSource1Package.scriptContent = `${staleSystemSource1Package.scriptContent}\n// stale v4 package fixture`;
  staleSystemSource1Package.integrity.scriptHash = createSourceScriptHash(staleSystemSource1Package.scriptContent);

  await versionFourDatabase.runReadwrite(
    [
      BROWSER_PERSISTENCE_STORE.sourcePackages,
      BROWSER_PERSISTENCE_STORE.sourceDefinitions,
      BROWSER_PERSISTENCE_STORE.sourcePreferences,
      BROWSER_PERSISTENCE_STORE.sourceStorageEntries,
      BROWSER_PERSISTENCE_STORE.userFavorites,
      BROWSER_PERSISTENCE_STORE.userPlayHistory
    ],
    async (transaction) => {
      // 类型: IDBObjectStore；作用: 制造缺正式包并存在陈旧同源包的真实开发历史形态。
      const packageStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages);
      await packageStore.delete(systemSource1Package.packageRef);
      await packageStore.put(staleSystemSource1Package);
      // 副作用: 删除默认源 Definition，证明 v5/v6 从目录恢复后仍能保留用户默认源决定。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .delete(PRESERVED_DEFAULT_SOURCE_ID);

      // 类型: IDBObjectStore；作用: 制造一个缺系统状态和一个授权损坏但 enabled 可保留的历史偏好。
      const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
      // 类型: object；作用: 隔离修改历史 Preferences，不改写测试初始化输入。
      const preferencesRecord = await preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY);
      preferencesRecord.value.defaultSourceId = PRESERVED_DEFAULT_SOURCE_ID;
      preferencesRecord.value.removedSystemSourceIds = [PRESERVED_HIDDEN_SOURCE_ID];
      preferencesRecord.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID] = {
        enabled: false,
        authorization: null
      };
      // 状态变化: 删除另一条系统源状态，系统数据源1 的 enabled=false 与软隐藏决定必须继续保留。
      delete preferencesRecord.value.sourceStates[PRESERVED_DEFAULT_SOURCE_ID];
      await preferencesStore.put(preferencesRecord);

      // 副作用: 写入私有缓存与用户内容哨兵，证明 v5/v6 对账不进入这些保存域。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put({
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID,
        partition: SOURCE_STORAGE_PARTITION.cache,
        key: 'v5-preserved-cache',
        value: { marker: 'keep' }
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).put({
        userId: userContentMockData.user.id,
        favoriteKey: 'v5-preserved-favorite',
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).put({
        userId: userContentMockData.user.id,
        historyKey: 'v5-preserved-history',
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID
      });
    }
  );
  // 类型: object；作用: 保存 v5/v6 迁移不得改写的私有空间和用户四仓权威快照。
  const preservedBeforeUpgrade = await versionFourDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    readPreservedRuntimeSnapshot
  );
  versionFourDatabase.close();

  // 类型: object；作用: 当前目录恢复输入，v5/v6 必须以它重建系统 Package、Definition 和授权。
  const currentOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 目标固定为 v6，连续执行 v5 和 v6 原子对账。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceChallengeRefresh
  );
  await upgradedDatabase.initialize(currentOptions);
  // 类型: object；作用: 同时读取系统源对账结果、元信息和用户保存域快照。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      packages: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).getAll(),
      definitions: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll(),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      preservedRuntime: await readPreservedRuntimeSnapshot(transaction)
    })
  );

  assert.equal(upgradedSnapshot.packages.length, sourceRepositorySeeds.packages.length);
  assert.equal(upgradedSnapshot.definitions.length, sourceRepositorySeeds.definitions.length);
  sourceRepositorySeeds.packages.forEach((sourcePackage) => {
    // 类型: object|undefined；作用: 按稳定 sourceId 取得恢复后的 Package，避免依赖 IndexedDB key 顺序。
    const restoredPackage = upgradedSnapshot.packages.find(
      candidate => candidate.sourceId === sourcePackage.sourceId
    );
    assert.deepEqual(restoredPackage, sourcePackage);
  });
  sourceRepositorySeeds.definitions.forEach((sourceDefinition) => {
    // 类型: object|undefined；作用: 按稳定 Definition.id 取得恢复后的定义，验证当前目录字段完整一致。
    const restoredDefinition = upgradedSnapshot.definitions.find(
      candidate => candidate.id === sourceDefinition.id
    );
    assert.deepEqual(restoredDefinition, sourceDefinition);
  });
  assert.equal(upgradedSnapshot.preferences.value.defaultSourceId, PRESERVED_DEFAULT_SOURCE_ID);
  assert.deepEqual(upgradedSnapshot.preferences.value.removedSystemSourceIds, [PRESERVED_HIDDEN_SOURCE_ID]);
  assert.equal(upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled, false);
  assert.equal(upgradedSnapshot.preferences.value.sourceStates[PRESERVED_DEFAULT_SOURCE_ID].enabled, true);
  sourceRepositorySeeds.definitions.forEach((sourceDefinition) => {
    assert.deepEqual(
      upgradedSnapshot.preferences.value.sourceStates[sourceDefinition.id].authorization,
      sourceRepositorySeeds.preferences.sourceStates[sourceDefinition.id].authorization
    );
  });
  // 版本边界: v5/v6 只能恢复系统保存图，用户设置仍保持升级前原始形状。
  assert.deepEqual(upgradedSnapshot.preservedRuntime, preservedBeforeUpgrade);
  assert.equal(
    upgradedSnapshot.schemaVersion.value,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceChallengeRefresh
  );
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v5 到 v6 使用当前目录刷新 system-source-1 并保留用户保存域', async () => {
  // 类型: string；作用: 当前 v5 到 v6 发布升级用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 以当前目录建立已经提交 v5 的历史库，后续只制造 系统数据源1 旧脚本事实。
  const versionFiveOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 以 schema v5 打开历史库，确保下一次打开才会单独触发 v6。
  const versionFiveDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceReconciliation
  );
  await versionFiveDatabase.initialize(versionFiveOptions);

  // 类型: object；作用: 定位当前 系统数据源1 Package，构造内容、版本和授权均自洽但落后于 1.0.3 的 v5 记录。
  const currentSystemSource1Package = versionFiveOptions.sourceSeeds.packages.find(
    sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID
  );
  // 类型: object；作用: 创建旧请求语义脚本并同步重算其保存指纹，模拟真实 v5 浏览器保存图。
  const staleSystemSource1Package = structuredClone(currentSystemSource1Package);
  staleSystemSource1Package.scriptContent = `${staleSystemSource1Package.scriptContent}\n// stale v5 request semantics`;
  staleSystemSource1Package.integrity.scriptHash = createSourceScriptHash(staleSystemSource1Package.scriptContent);
  // 类型: object；作用: 复用同一稳定 packageRef，验证 v6 通过主键覆盖旧脚本而不是追加第二个包。
  const staleSystemSource1Definition = structuredClone(
    versionFiveOptions.sourceSeeds.definitions.find(sourceDefinition => sourceDefinition.id === SYSTEM_SOURCE_1_SOURCE_ID)
  );
  staleSystemSource1Definition.version = '1.0.2';
  // 类型: object；作用: 把历史授权绑定到旧脚本，证明 v6 必须和脚本一起刷新授权而非只改显示版本。
  const staleSystemSource1Authorization = {
    status: 'authorized',
    authorizedAt: '2026-07-21T01:00:00.000Z',
    authorizedVersion: staleSystemSource1Definition.version,
    authorizedScriptHash: staleSystemSource1Package.integrity.scriptHash
  };

  await versionFiveDatabase.runReadwrite(
    [
      BROWSER_PERSISTENCE_STORE.sourcePackages,
      BROWSER_PERSISTENCE_STORE.sourceDefinitions,
      BROWSER_PERSISTENCE_STORE.sourcePreferences,
      BROWSER_PERSISTENCE_STORE.sourceStorageEntries,
      BROWSER_PERSISTENCE_STORE.userFavorites,
      BROWSER_PERSISTENCE_STORE.userPlayHistory
    ],
    async (transaction) => {
      // 副作用: 写入同源旧 Package、Definition 和授权，制造 v5 到 v6 必须修复的真实发布差异。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).put(staleSystemSource1Package);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).put(staleSystemSource1Definition);
      // 类型: IDBObjectStore；作用: 读取并保存当前全局偏好，保留用户启停决定并替换旧授权快照。
      const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
      // 类型: object；作用: 保存当前全局偏好记录的隔离副本，供本用例写入 v5 历史授权。
      const preferencesRecord = await preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY);
      preferencesRecord.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID] = {
        enabled: false,
        authorization: staleSystemSource1Authorization
      };
      await preferencesStore.put(preferencesRecord);

      // 副作用: 写入必须保留的 Provider 私有缓存和用户收藏，证明 v6 写集不触碰这些 store。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put({
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID,
        partition: SOURCE_STORAGE_PARTITION.cache,
        key: 'v6-preserved-cache',
        value: { marker: 'keep' }
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).put({
        userId: userContentMockData.user.id,
        favoriteKey: 'v6-preserved-favorite',
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID
      });
    }
  );
  // 类型: object；作用: 保存 v6 迁移不得改写的运行数据和 Definition 首次导入事实。
  const preservedBeforeUpgrade = await versionFiveDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      runtime: await readPreservedRuntimeSnapshot(transaction),
      definition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(SYSTEM_SOURCE_1_SOURCE_ID)
    })
  );
  versionFiveDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 以 schema v6 打开 v5 历史库，单独触发 v5 到 v6 upgrade transaction。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceChallengeRefresh
  );
  await upgradedDatabase.initialize(createInitializationOptions());
  // 类型: object；作用: 读取 v6 Package、Definition、授权元信息和不得被迁移改写的运行数据。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      package: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(currentSystemSource1Package.packageRef),
      definition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(SYSTEM_SOURCE_1_SOURCE_ID),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      runtime: await readPreservedRuntimeSnapshot(transaction)
    })
  );

  // 断言: Package 必须回到当前 datasource/系统数据源1.js 原文，防止 Repository 保存旧脚本而 Runtime 执行新工厂。
  assert.deepEqual(
    upgradedSnapshot.package,
    createInitializationOptions().sourceSeeds.packages.find(sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID)
  );
  // 断言: Definition 版本更新时间采用当前目录事实，但首次导入时间只能保留 v5 历史值。
  assert.equal(
    upgradedSnapshot.definition.version,
    createInitializationOptions().sourceSeeds.definitions.find(definition => definition.id === SYSTEM_SOURCE_1_SOURCE_ID).version
  );
  assert.equal(upgradedSnapshot.definition.importedAt, preservedBeforeUpgrade.definition.importedAt);
  assert.equal(
    upgradedSnapshot.definition.lastUpdatedAt,
    createInitializationOptions().sourceSeeds.definitions.find(
      definition => definition.id === SYSTEM_SOURCE_1_SOURCE_ID
    ).lastUpdatedAt
  );
  // 断言: 用户关闭决定保持，授权快照改为当前脚本版本与指纹，不能把 v6 当成重新启用。
  assert.equal(upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled, false);
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization,
    createInitializationOptions().sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization
  );
  assert.deepEqual(upgradedSnapshot.runtime, preservedBeforeUpgrade.runtime);
  assert.equal(upgradedSnapshot.schemaVersion.value, BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceChallengeRefresh);
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v7 到 v8 原子发布 system-source-1 搜索事务并保留用户保存域', async () => {
  // 类型: string；作用: 当前 v7 到 v8 发布升级用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 当前目录输入先建立完整 v7 保存图，随后只把 系统数据源1 改造成已发布的 1.0.4 历史事实。
  const versionSevenOptions = createInitializationOptions();
  versionSevenOptions.sourceSeeds = createVersionEightSourceSeeds();
  // 类型: BrowserPersistenceDatabase；作用: 只打开到 schema v7，确保下一次打开单独执行 v8 对账器。
  const versionSevenDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceVerificationRefresh
  );
  await versionSevenDatabase.initialize(versionSevenOptions);

  // 类型: object；作用: 当前目录 系统数据源1 Package 副本，主键和身份保持不变，脚本降级为已发布的 1.0.4 搜索事务。
  const stalePackage = structuredClone(
    versionSevenOptions.sourceSeeds.packages.find(sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID)
  );
  // 夹具转换: 同时恢复 1.0.4 manifest 和缺少空 submit 字段的旧 URL 构造；任一源片段缺失都会由后续断言阻断测试。
  stalePackage.scriptContent = stalePackage.scriptContent
    .replace("version: '1.0.5'", "version: '1.0.4'")
    .replace(
      "const query = new URLSearchParams({ wd: keyword, submit: '' });\n  return `${PAGE_BASE_URL}${pathname}?${query.toString()}`;",
      'return `${PAGE_BASE_URL}${pathname}?wd=${encodeURIComponent(keyword)}`;'
    );
  // 前置不变量: v7 夹具必须真实缺少 submit 字段且声明 1.0.4，避免任意文本差异制造迁移通过假象。
  assert.match(stalePackage.scriptContent, /version: '1\.0\.4'/);
  assert.doesNotMatch(stalePackage.scriptContent, /submit:/);
  stalePackage.integrity.scriptHash = createSourceScriptHash(stalePackage.scriptContent);
  // 类型: object；作用: 与旧脚本保持自洽的 1.0.4 Definition，证明 v8 不只修改页面显示版本。
  const staleDefinition = structuredClone(
    versionSevenOptions.sourceSeeds.definitions.find(definition => definition.id === SYSTEM_SOURCE_1_SOURCE_ID)
  );
  staleDefinition.version = '1.0.4';

  await versionSevenDatabase.runReadwrite(
    [
      BROWSER_PERSISTENCE_STORE.sourcePackages,
      BROWSER_PERSISTENCE_STORE.sourceDefinitions,
      BROWSER_PERSISTENCE_STORE.sourcePreferences,
      BROWSER_PERSISTENCE_STORE.sourceStorageEntries,
      BROWSER_PERSISTENCE_STORE.userFavorites
    ],
    async (transaction) => {
      // 副作用: 写入同源旧 Package 和 Definition，形成 v8 必须替换的单一历史保存事实。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).put(stalePackage);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).put(staleDefinition);
      // 类型: IDBObjectStore；作用: 保存用户关闭决定，同时把授权绑定到 1.0.4 旧脚本指纹。
      const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
      // 类型: object；作用: 当前全局偏好副本，只修改 系统数据源1 的历史状态。
      const preferencesRecord = await preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY);
      preferencesRecord.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID] = {
        enabled: false,
        authorization: {
          status: 'authorized',
          authorizedAt: '2026-07-21T02:00:00.000Z',
          authorizedVersion: staleDefinition.version,
          authorizedScriptHash: stalePackage.integrity.scriptHash
        }
      };
      await preferencesStore.put(preferencesRecord);
      // 副作用: 写入私有缓存和收藏哨兵，证明 v8 只对账应用拥有的三仓系统事实。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put({
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID,
        partition: SOURCE_STORAGE_PARTITION.cache,
        key: 'v8-preserved-cache',
        value: { marker: 'keep' }
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).put({
        userId: userContentMockData.user.id,
        favoriteKey: 'v8-preserved-favorite',
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID
      });
    }
  );
  // 类型: object；作用: 保存 v8 不得改写的私有空间、用户内容和首次导入时间权威快照。
  const preservedBeforeUpgrade = await versionSevenDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      runtime: await readPreservedRuntimeSnapshot(transaction),
      definition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).get(SYSTEM_SOURCE_1_SOURCE_ID)
    })
  );
  versionSevenDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 使用正式目标版本只执行 v7 到 v8 搜索事务发布。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchTransactionRefresh
  );
  // 类型: object；作用: 当前 v8 目录输入，是 Package、Definition 和授权的唯一发布事实。
  const currentOptions = createInitializationOptions();
  currentOptions.sourceSeeds = createVersionEightSourceSeeds();
  await upgradedDatabase.initialize(currentOptions);
  // 类型: object；作用: 一次读取 v8 对账结果和必须保持的用户运行数据。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      package: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).get(stalePackage.packageRef),
      definition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).get(SYSTEM_SOURCE_1_SOURCE_ID),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences).get(SOURCE_PREFERENCES_RECORD_KEY),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta).get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      runtime: await readPreservedRuntimeSnapshot(transaction)
    })
  );
  // 类型: object；作用: 当前目录 系统数据源1 Definition，断言不得依赖测试内复制的版本字符串。
  const currentDefinition = currentOptions.sourceSeeds.definitions.find(definition => definition.id === SYSTEM_SOURCE_1_SOURCE_ID);
  // 类型: object；作用: 当前目录 系统数据源1 Package，脚本文本和授权哈希必须采用同一事实。
  const currentPackage = currentOptions.sourceSeeds.packages.find(sourcePackage => sourcePackage.sourceId === SYSTEM_SOURCE_1_SOURCE_ID);
  assert.deepEqual(upgradedSnapshot.package, currentPackage);
  assert.equal(upgradedSnapshot.definition.version, currentDefinition.version);
  assert.equal(upgradedSnapshot.definition.importedAt, preservedBeforeUpgrade.definition.importedAt);
  assert.equal(upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled, false);
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization,
    currentOptions.sourceSeeds.preferences.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].authorization
  );
  assert.deepEqual(upgradedSnapshot.runtime, preservedBeforeUpgrade.runtime);
  assert.equal(
    upgradedSnapshot.schemaVersion.value,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchTransactionRefresh
  );
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v8 到 v9 原子发布当前 ABI 2.0 Provider 并保留用户保存域', async () => {
  // 类型: string；作用: 当前 v8 到 v9 ABI 发布升级用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 保存当前 ABI 1.x 系统源的 v8 初始化输入，下一次打开才执行 v9。
  const versionEightOptions = createInitializationOptions();
  versionEightOptions.sourceSeeds = createVersionEightSourceSeeds();
  // 类型: BrowserPersistenceDatabase；作用: 建立真实 schema v8 保存图，不提前运行 ABI 2.0 对账器。
  const versionEightDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceSearchTransactionRefresh
  );
  await versionEightDatabase.initialize(versionEightOptions);
  // 类型: object；作用: 提供 v9 必须原样保留的用户导入 ABI 1.x 自定义源关联保存图。
  const customSourceGraph = createVersionEightCustomSourceGraph();

  await versionEightDatabase.runReadwrite(
    [
      BROWSER_PERSISTENCE_STORE.sourcePackages,
      BROWSER_PERSISTENCE_STORE.sourceDefinitions,
      BROWSER_PERSISTENCE_STORE.sourcePreferences,
      BROWSER_PERSISTENCE_STORE.sourceStorageEntries,
      BROWSER_PERSISTENCE_STORE.userFavorites,
      BROWSER_PERSISTENCE_STORE.userPlayHistory
    ],
    async (transaction) => {
      // 副作用: 追加自定义源三仓保存图；v9 对账必须识别它不属于应用当前系统源。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .put(customSourceGraph.sourcePackage);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .put(customSourceGraph.sourceDefinition);
      // 类型: IDBObjectStore；作用: 保存用户默认源、软隐藏、系统启停和自定义源授权决定。
      const preferencesStore = transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences);
      // 类型: object；作用: 当前 v8 全局偏好副本，作为 v9 用户决定保留基准。
      const preferencesRecord = await preferencesStore.get(SOURCE_PREFERENCES_RECORD_KEY);
      preferencesRecord.value.defaultSourceId = PRESERVED_DEFAULT_SOURCE_ID;
      preferencesRecord.value.removedSystemSourceIds = [PRESERVED_HIDDEN_SOURCE_ID];
      preferencesRecord.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled = false;
      preferencesRecord.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID] = customSourceGraph.sourceState;
      await preferencesStore.put(preferencesRecord);

      // 副作用: 同时写入系统与自定义源私有数据，证明 v9 不清空任何 sourceId 命名空间。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put({
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID,
        partition: SOURCE_STORAGE_PARTITION.credentials,
        key: 'preserved-cookie',
        value: { cookie: 'system-source-1-v8-cookie' }
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries)
        .put(customSourceGraph.storageEntry);
      // 副作用: 写入收藏和播放历史哨兵，锁定 v9 不进入用户内容仓的边界。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userFavorites).put({
        userId: userContentMockData.user.id,
        favoriteKey: 'v9-preserved-favorite',
        sourceId: SYSTEM_SOURCE_1_SOURCE_ID
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.userPlayHistory).put({
        userId: userContentMockData.user.id,
        historyKey: 'v9-preserved-history',
        sourceId: VERSION_EIGHT_CUSTOM_SOURCE_ID
      });
    }
  );

  // 类型: object；作用: 保存升级前全部私有空间、用户内容、自定义源和系统首次导入时间权威快照。
  const preservedBeforeUpgrade = await versionEightDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      runtime: await readPreservedRuntimeSnapshot(transaction),
      customPackage: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(VERSION_EIGHT_CUSTOM_PACKAGE_REF),
      customDefinition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(VERSION_EIGHT_CUSTOM_SOURCE_ID),
      systemImportedAt: new Map(
        (await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll())
          .filter(definition => definition.sourceKind === SOURCE_KIND.system)
          .map(definition => [definition.id, definition.importedAt])
      )
    })
  );
  versionEightDatabase.close();

  // 类型: object；作用: 当前 ABI 2.0 产品目录输入，是 v9 唯一允许覆盖的系统发布事实。
  const currentOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 只执行到 v9，确保当前用例不借 v10 重复对账获得通过。
  const upgradedDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.providerApiVersion2Refresh
  );
  await upgradedDatabase.initialize(currentOptions);
  // 类型: object；作用: 一次读取 v9 当前系统源、用户决定、自定义保存图和运行数据最终事实。
  const upgradedSnapshot = await upgradedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      packages: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).getAll(),
      definitions: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).getAll(),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      runtime: await readPreservedRuntimeSnapshot(transaction)
    })
  );

  currentOptions.sourceSeeds.packages.forEach((currentPackage) => {
    // 类型: object|undefined；作用: 按 sourceId 定位 v9 系统 Package，避免依赖自定义源加入后的记录顺序。
    const storedPackage = upgradedSnapshot.packages.find(
      sourcePackage => sourcePackage.sourceId === currentPackage.sourceId
    );
    assert.deepEqual(storedPackage, currentPackage);
  });
  currentOptions.sourceSeeds.definitions.forEach((currentDefinition) => {
    // 类型: object|undefined；作用: 按 sourceId 定位 v9 系统 Definition，并只允许保留历史 importedAt。
    const storedDefinition = upgradedSnapshot.definitions.find(
      sourceDefinition => sourceDefinition.id === currentDefinition.id
    );
    assert.deepEqual(storedDefinition, {
      ...currentDefinition,
      importedAt: preservedBeforeUpgrade.systemImportedAt.get(currentDefinition.id)
    });
    assert.deepEqual(
      upgradedSnapshot.preferences.value.sourceStates[currentDefinition.id].authorization,
      currentOptions.sourceSeeds.preferences.sourceStates[currentDefinition.id].authorization
    );
  });
  // 断言: 用户启停、默认源、软隐藏和全部非系统保存域保持 v8 原值；自定义 ABI 1.x 不被平台代升级。
  assert.equal(upgradedSnapshot.preferences.value.sourceStates[SYSTEM_SOURCE_1_SOURCE_ID].enabled, false);
  assert.equal(upgradedSnapshot.preferences.value.defaultSourceId, PRESERVED_DEFAULT_SOURCE_ID);
  assert.deepEqual(upgradedSnapshot.preferences.value.removedSystemSourceIds, [PRESERVED_HIDDEN_SOURCE_ID]);
  assert.deepEqual(
    upgradedSnapshot.preferences.value.sourceStates[VERSION_EIGHT_CUSTOM_SOURCE_ID],
    customSourceGraph.sourceState
  );
  assert.deepEqual(
    upgradedSnapshot.packages.find(sourcePackage => sourcePackage.sourceId === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    preservedBeforeUpgrade.customPackage
  );
  assert.deepEqual(
    upgradedSnapshot.definitions.find(sourceDefinition => sourceDefinition.id === VERSION_EIGHT_CUSTOM_SOURCE_ID),
    preservedBeforeUpgrade.customDefinition
  );
  assert.deepEqual(upgradedSnapshot.runtime, preservedBeforeUpgrade.runtime);
  assert.equal(
    upgradedSnapshot.schemaVersion.value,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.providerApiVersion2Refresh
  );
  await upgradedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase v5 遇到孤立自定义包时回滚并保留完整 v4', async () => {
  // 类型: string；作用: 当前无关自定义图回滚用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 建立合法 v4 系统源库，随后只注入无关自定义孤立包。
  const versionFourOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 只执行到正式 v4 schema。
  const versionFourDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRefresh
  );
  await versionFourDatabase.initialize(versionFourOptions);
  // 类型: object；作用: 构造字段合法但没有 Definition 和 Preferences state 的孤立自定义 Package。
  const orphanPackage = structuredClone(versionFourOptions.sourceSeeds.packages[0]);
  orphanPackage.packageRef = 'source-package::source.custom.orphan';
  orphanPackage.sourceId = 'source.custom.orphan';
  orphanPackage.providerKey = 'source.custom.orphan.provider';
  await versionFourDatabase.runReadwrite(
    [BROWSER_PERSISTENCE_STORE.sourcePackages],
    async (transaction) => transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).put(orphanPackage)
  );
  versionFourDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 尝试把含无关孤立包的 v4 升级到 v5，必须失败关闭。
  const failedUpgradeDatabase = createDatabase(databaseName);
  await assert.rejects(
    failedUpgradeDatabase.initialize(createInitializationOptions()),
    error => error instanceof BrowserPersistenceError
      && error.code === BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed
  );

  // 类型: BrowserPersistenceDatabase；作用: 以 v4 重新打开失败数据库，证明 v5 未提交或删除原记录。
  const preservedVersionFourDatabase = createDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRefresh
  );
  await preservedVersionFourDatabase.initialize(versionFourOptions);
  // 类型: object；作用: 读取版本和孤立包，确认失败事务完整回滚。
  const preservedSnapshot = await preservedVersionFourDatabase.runReadonly(
    [BROWSER_PERSISTENCE_STORE.appMeta, BROWSER_PERSISTENCE_STORE.sourcePackages],
    async (transaction) => ({
      schemaVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.schemaVersion),
      orphanPackage: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(orphanPackage.packageRef)
    })
  );
  assert.equal(preservedSnapshot.schemaVersion.value, BROWSER_PERSISTENCE_SCHEMA_VERSION.builtinSourceRefresh);
  assert.deepEqual(preservedSnapshot.orphanPackage, orphanPackage);
  await preservedVersionFourDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase 同 schema 启动会采用较新内置目录并保留全部用户保存域', async () => {
  // 类型: string；作用: 隔离普通启动目录升级用例，不依赖 schema versionchange 触发更新。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 当前应用初始化输入，后续只把数据库内发布事实降为历史版本。
  const currentOptions = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 先建立完整 v23 数据库，再制造同 schema 的旧目录保存图。
  const historicalDatabase = createDatabase(databaseName);
  await historicalDatabase.initialize(currentOptions);

  // 类型: object；作用: 定位当前目录第一条系统 Package，构造可验证但内容陈旧的历史脚本事实。
  const currentBuiltinPackage = currentOptions.sourceSeeds.packages[0];
  // 类型: object；作用: 使用相同 packageRef/sourceId 覆盖历史记录，证明普通启动必须真正重写脚本文本。
  const staleBuiltinPackage = structuredClone(currentBuiltinPackage);
  staleBuiltinPackage.scriptContent = `${staleBuiltinPackage.scriptContent}\n// stale catalog release`;
  staleBuiltinPackage.integrity.scriptHash = createSourceScriptHash(staleBuiltinPackage.scriptContent);
  // 类型: object；作用: 定位同源 Definition 并保留其首次导入时间作为用户可见审计事实。
  const staleBuiltinDefinition = structuredClone(
    currentOptions.sourceSeeds.definitions.find(definition => definition.id === staleBuiltinPackage.sourceId)
  );
  staleBuiltinDefinition.version = '0.9.0';
  staleBuiltinDefinition.lastUpdatedAt = VERSION_TWELVE_CATALOG_TIME;
  // 类型: object；作用: 创建必须跨普通启动完整保留的自定义 Package、Definition、授权和私有空间。
  const customSourceGraph = createVersionEightCustomSourceGraph();
  // 类型: object；作用: 从已提交偏好隔离副本制造旧系统授权、用户禁用、默认源和软隐藏决定。
  const historicalPreferences = structuredClone(currentOptions.sourceSeeds.preferences);
  historicalPreferences.sourceStates[staleBuiltinPackage.sourceId].enabled = false;
  historicalPreferences.sourceStates[staleBuiltinPackage.sourceId].authorization.authorizedVersion = staleBuiltinDefinition.version;
  historicalPreferences.sourceStates[staleBuiltinPackage.sourceId].authorization.authorizedScriptHash = staleBuiltinPackage.integrity.scriptHash;
  historicalPreferences.sourceStates[customSourceGraph.sourceDefinition.id] = customSourceGraph.sourceState;
  historicalPreferences.defaultSourceId = customSourceGraph.sourceDefinition.id;
  historicalPreferences.removedSystemSourceIds = [staleBuiltinPackage.sourceId];
  // 类型: object；作用: revision=0 表示同 schema 数据库仍采用旧 Provider 目录。
  const historicalRelease = createHistoricalCatalogRelease('0.9.0', '6');

  await historicalDatabase.runReadwrite(
    [
      BROWSER_PERSISTENCE_STORE.appMeta,
      BROWSER_PERSISTENCE_STORE.sourcePackages,
      BROWSER_PERSISTENCE_STORE.sourceDefinitions,
      BROWSER_PERSISTENCE_STORE.sourcePreferences,
      BROWSER_PERSISTENCE_STORE.sourceStorageEntries
    ],
    async (transaction) => {
      // 副作用: 在同一测试事务中制造自洽历史目录和自定义保存图，用户四仓保持首次种子原值。
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).put(staleBuiltinPackage);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).put(customSourceGraph.sourcePackage);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).put(staleBuiltinDefinition);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions).put(customSourceGraph.sourceDefinition);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences).put({
        key: SOURCE_PREFERENCES_RECORD_KEY,
        value: historicalPreferences
      });
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceStorageEntries).put(customSourceGraph.storageEntry);
      await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta).put({
        key: BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease,
        value: historicalRelease
      });
    }
  );
  // 类型: object；作用: 对账前保存 Storage 和用户四仓完整快照，升级后必须逐项一致。
  const preservedRuntime = await historicalDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    readPreservedRuntimeSnapshot
  );
  historicalDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 用相同 schema 和当前 release 模拟用户刷新后的新应用连接。
  const reopenedDatabase = createDatabase(databaseName);
  await reopenedDatabase.initialize(currentOptions);
  // 类型: object；作用: 一次读取系统更新结果、自定义保存图、发布身份和禁止进入对账写集的用户数据。
  const updatedSnapshot = await reopenedDatabase.runReadonly(
    BROWSER_PERSISTENCE_ALL_STORE_NAMES,
    async (transaction) => ({
      builtinPackage: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(currentBuiltinPackage.packageRef),
      builtinDefinition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(staleBuiltinDefinition.id),
      customPackage: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(customSourceGraph.sourcePackage.packageRef),
      customDefinition: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourceDefinitions)
        .get(customSourceGraph.sourceDefinition.id),
      preferences: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePreferences)
        .get(SOURCE_PREFERENCES_RECORD_KEY),
      release: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease),
      legacySeedVersion: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.legacySeedVersion),
      runtime: await readPreservedRuntimeSnapshot(transaction)
    })
  );

  assert.deepEqual(updatedSnapshot.builtinPackage, currentBuiltinPackage);
  assert.equal(updatedSnapshot.builtinDefinition.version, currentOptions.sourceSeeds.definitions[0].version);
  assert.equal(updatedSnapshot.builtinDefinition.importedAt, staleBuiltinDefinition.importedAt);
  assert.deepEqual(updatedSnapshot.customPackage, customSourceGraph.sourcePackage);
  assert.deepEqual(updatedSnapshot.customDefinition, customSourceGraph.sourceDefinition);
  assert.equal(updatedSnapshot.preferences.value.sourceStates[staleBuiltinPackage.sourceId].enabled, false);
  assert.deepEqual(
    updatedSnapshot.preferences.value.sourceStates[staleBuiltinPackage.sourceId].authorization,
    currentOptions.sourceSeeds.preferences.sourceStates[staleBuiltinPackage.sourceId].authorization
  );
  assert.equal(updatedSnapshot.preferences.value.defaultSourceId, customSourceGraph.sourceDefinition.id);
  assert.deepEqual(updatedSnapshot.preferences.value.removedSystemSourceIds, [staleBuiltinPackage.sourceId]);
  assert.deepEqual(updatedSnapshot.release.value, currentOptions.builtinCatalogRelease);
  assert.equal(updatedSnapshot.legacySeedVersion, undefined);
  assert.deepEqual(updatedSnapshot.runtime, preservedRuntime);
  await reopenedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase 当前目录发布相同时启动不产生任何 IndexedDB 写请求', async () => {
  // 类型: string；作用: 隔离相同发布幂等用例。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 两次独立连接使用完全相同的目录发布与种子事实。
  const options = createInitializationOptions();
  // 类型: BrowserPersistenceDatabase；作用: 首次建立当前目录数据库并完成所有合法写入。
  const firstDatabase = createDatabase(databaseName);
  await firstDatabase.initialize(options);
  firstDatabase.close();

  // 类型: Function；作用: 保存 fake-indexeddb 原始 put，检查结束后必须恢复全局测试设施。
  const originalPut = IDBObjectStore.prototype.put;
  // 类型: Function；作用: 保存 fake-indexeddb 原始 add，避免后续测试继承监控包装。
  const originalAdd = IDBObjectStore.prototype.add;
  // 类型: Function；作用: 保存 fake-indexeddb 原始 delete，覆盖旧 seedVersion 清理也必须被计数。
  const originalDelete = IDBObjectStore.prototype.delete;
  // 类型: number；生命周期: 当前用例第二次 initialize；作用: 统计全部 object store 写请求。
  let writeRequestCount = 0;

  // 副作用: 只在当前用例临时包装 fake-indexeddb 写方法；每次调用仍委托原方法保持原生行为。
  IDBObjectStore.prototype.put = function monitoredPut(...args) {
    writeRequestCount += 1;
    return originalPut.apply(this, args);
  };
  IDBObjectStore.prototype.add = function monitoredAdd(...args) {
    writeRequestCount += 1;
    return originalAdd.apply(this, args);
  };
  IDBObjectStore.prototype.delete = function monitoredDelete(...args) {
    writeRequestCount += 1;
    return originalDelete.apply(this, args);
  };

  // 类型: BrowserPersistenceDatabase；作用: 使用新门面模拟相同应用版本刷新。
  const reopenedDatabase = createDatabase(databaseName);
  try {
    await reopenedDatabase.initialize(options);
  } finally {
    // 资源清理: 无论初始化结果如何都恢复全局 IndexedDB 原型，防止污染后续用例。
    IDBObjectStore.prototype.put = originalPut;
    IDBObjectStore.prototype.add = originalAdd;
    IDBObjectStore.prototype.delete = originalDelete;
  }

  assert.equal(writeRequestCount, 0);
  await reopenedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase 拒绝目录降级和相同 revision 内容冲突', async () => {
  // 类型: Array<object>；作用: 分别制造本地 revision 更高和同 revision 指纹冲突两类失败关闭事实。
  const conflictCases = [
    {
      label: 'newer-local-release',
      release: {
        ...structuredClone(builtinSourceCatalogRelease),
        revision: builtinSourceCatalogRelease.revision + 1,
        version: 'future-catalog'
      }
    },
    {
      label: 'same-revision-fingerprint-conflict',
      release: {
        ...structuredClone(builtinSourceCatalogRelease),
        fingerprint: 'b'.repeat(64)
      }
    }
  ];

  // 循环作用: 每类冲突使用独立数据库，避免前一失败状态影响后一判断。
  for (const conflictCase of conflictCases) {
    // 类型: string；作用: 当前冲突用例独占数据库名称。
    const databaseName = `${createDatabaseName()}-${conflictCase.label}`;
    // 类型: object；作用: 当前应用正式初始化输入。
    const currentOptions = createInitializationOptions();
    // 类型: BrowserPersistenceDatabase；作用: 建立当前数据库后手动写入冲突发布元信息。
    const currentDatabase = createDatabase(databaseName);
    await currentDatabase.initialize(currentOptions);
    await currentDatabase.runReadwrite(
      [BROWSER_PERSISTENCE_STORE.appMeta],
      async (transaction) => {
        await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta).put({
          key: BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease,
          value: conflictCase.release
        });
      }
    );
    currentDatabase.close();

    // 类型: BrowserPersistenceDatabase；作用: 以当前较旧或冲突应用发布重新打开，必须在 Runtime 读取前失败。
    const rejectedDatabase = createDatabase(databaseName);
    await assert.rejects(
      rejectedDatabase.initialize(currentOptions),
      error => error instanceof BrowserPersistenceError
        && error.code === BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted
    );

    // 类型: object；作用: 使用与数据库冲突记录一致的输入重新打开，只为安全删除隔离测试数据库。
    const cleanupOptions = createInitializationOptions();
    cleanupOptions.builtinCatalogRelease = conflictCase.release;
    // 类型: BrowserPersistenceDatabase；作用: 采用本地冲突发布本身完成清理，不让当前较旧发布覆盖它。
    const cleanupDatabase = createDatabase(databaseName);
    await cleanupDatabase.initialize(cleanupOptions);
    await cleanupDatabase.deleteDatabase();
  }
});

test('BrowserPersistenceDatabase 启动目录对账失败会回滚旧 Package 与旧 release', async () => {
  // 类型: string；作用: 隔离普通启动事务回滚用例。
  const databaseName = createDatabaseName();
  // 类型: object；作用: revision=0 的旧发布输入，用于建立同 schema 历史数据库。
  const historicalOptions = createInitializationOptions();
  historicalOptions.builtinCatalogRelease = createHistoricalCatalogRelease('rollback-old', '7');
  // 类型: object；作用: 制造与旧发布对应的不同脚本文本，回滚后必须保持该字节事实。
  const historicalPackage = historicalOptions.sourceSeeds.packages[0];
  historicalPackage.scriptContent = `${historicalPackage.scriptContent}\n// rollback old package`;
  historicalPackage.integrity.scriptHash = createSourceScriptHash(historicalPackage.scriptContent);
  historicalOptions.sourceSeeds.preferences.sourceStates[historicalPackage.sourceId]
    .authorization.authorizedScriptHash = historicalPackage.integrity.scriptHash;
  // 类型: BrowserPersistenceDatabase；作用: 使用旧 release 和旧 Package 建立可升级历史库。
  const historicalDatabase = createDatabase(databaseName);
  await historicalDatabase.initialize(historicalOptions);
  historicalDatabase.close();

  // 类型: Function；作用: 保存 fake-indexeddb 原始 put，失败注入完成后恢复。
  const originalPut = IDBObjectStore.prototype.put;
  // 副作用: 只让 sourceDefinitions 的当前发布写入失败，Package 写入请求仍先进入同一事务以验证原子回滚。
  IDBObjectStore.prototype.put = function failDefinitionWrite(...args) {
    // 条件分支: 当前写请求目标是 Definition store 时进入；执行内容: 同步抛出原生事务失败以触发完整回滚。
    if (this.name === BROWSER_PERSISTENCE_STORE.sourceDefinitions) {
      throw new DOMException('catalog reconciliation write failure', 'UnknownError');
    }
    return originalPut.apply(this, args);
  };

  // 类型: BrowserPersistenceDatabase；作用: 尝试以当前 release 执行普通启动对账，预期事务失败。
  const failedDatabase = createDatabase(databaseName);
  try {
    await assert.rejects(
      failedDatabase.initialize(createInitializationOptions()),
      error => error instanceof BrowserPersistenceError
        && error.code === BROWSER_PERSISTENCE_ERROR_CODE.dataCorrupted
    );
  } finally {
    // 资源清理: 恢复 IndexedDB 原型，后续只读回滚检查使用真实实现。
    IDBObjectStore.prototype.put = originalPut;
  }

  // 类型: BrowserPersistenceDatabase；作用: 使用旧 release 重新打开，若前次部分提交则本次会暴露不一致。
  const preservedDatabase = createDatabase(databaseName);
  await preservedDatabase.initialize(historicalOptions);
  // 类型: object；作用: 同时复查旧 Package 字节和旧 release，证明两个写入没有任一提前提交。
  const preservedSnapshot = await preservedDatabase.runReadonly(
    [BROWSER_PERSISTENCE_STORE.appMeta, BROWSER_PERSISTENCE_STORE.sourcePackages],
    async (transaction) => ({
      sourcePackage: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
        .get(historicalPackage.packageRef),
      release: await transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta)
        .get(BROWSER_PERSISTENCE_META_KEY.builtinCatalogRelease)
    })
  );
  assert.deepEqual(preservedSnapshot.sourcePackage, historicalPackage);
  assert.deepEqual(preservedSnapshot.release.value, historicalOptions.builtinCatalogRelease);
  await preservedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase 迁移失败会保留旧版本与原始数据', async () => {
  // 类型: string；作用: 当前损坏历史 schema 用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: IDBDatabase；作用: 创建只含 appMeta 的损坏 v1 数据库，并保存可复查标记。
  const legacyDatabase = await openRawDatabase(
    databaseName,
    BROWSER_PERSISTENCE_SCHEMA_VERSION.initial,
    (database, transaction) => {
      database.createObjectStore(BROWSER_PERSISTENCE_STORE.appMeta, { keyPath: 'key' });
      transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta).put({ key: 'preserved', value: 'legacy' });
    }
  );
  legacyDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 尝试把缺仓历史库升级到 v2，预期失败关闭。
  const migrationDatabase = createDatabase(databaseName);
  await assert.rejects(
    migrationDatabase.initialize(createInitializationOptions()),
    error => error instanceof BrowserPersistenceError
      && error.code === BROWSER_PERSISTENCE_ERROR_CODE.migrationFailed
  );

  // 类型: IDBDatabase；作用: 按原 v1 重新打开，证明失败升级没有删除或推进旧数据库。
  const preservedDatabase = await openRawDatabase(databaseName, BROWSER_PERSISTENCE_SCHEMA_VERSION.initial);
  assert.equal(preservedDatabase.version, BROWSER_PERSISTENCE_SCHEMA_VERSION.initial);
  // 类型: IDBTransaction；作用: 复查升级失败前的原始 appMeta 标记仍然存在。
  const transaction = preservedDatabase.transaction(BROWSER_PERSISTENCE_STORE.appMeta, 'readonly');
  // 类型: IDBRequest；作用: 读取原始标记，成功事件表示旧数据可访问。
  const request = transaction.objectStore(BROWSER_PERSISTENCE_STORE.appMeta).get('preserved');
  // 类型: object；作用: 通过原生请求事件取得保留记录，不使用固定等待。
  const preservedRecord = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  assert.deepEqual(preservedRecord, { key: 'preserved', value: 'legacy' });
  preservedDatabase.close();
  await migrationDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase blocked 会立即失败且不轮询等待旧连接', async () => {
  // 类型: string；作用: 当前升级阻塞用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: BrowserPersistenceDatabase；作用: 建立可被 v2 升级的完整 v1 保存图。
  const versionOneDatabase = createDatabase(databaseName, BROWSER_PERSISTENCE_SCHEMA_VERSION.initial);
  await versionOneDatabase.initialize(createInitializationOptions());
  versionOneDatabase.close();
  // 类型: IDBDatabase；作用: 模拟未响应 versionchange 的旧页面连接，阻塞 v2 打开请求。
  const blockingConnection = await openRawDatabase(databaseName, BROWSER_PERSISTENCE_SCHEMA_VERSION.initial);
  blockingConnection.onversionchange = () => undefined;

  // 类型: BrowserPersistenceDatabase；作用: 发起应被 blocked 回调立即拒绝的 v2 初始化。
  const blockedDatabase = createDatabase(databaseName);
  await assert.rejects(
    blockedDatabase.initialize(createInitializationOptions()),
    error => error instanceof BrowserPersistenceError
      && error.code === BROWSER_PERSISTENCE_ERROR_CODE.blocked
  );
  blockingConnection.close();

  // 类型: IDBDatabase；作用: 等待排队升级自然完成，确保失败路径迟到连接已经关闭后再清理。
  const settledConnection = await openRawDatabase(databaseName, BROWSER_PERSISTENCE_DATABASE_VERSION);
  settledConnection.close();
  await blockedDatabase.deleteDatabase();
});

test('BrowserPersistenceDatabase blocking 会关闭旧连接并使门面稳定不可用', async () => {
  // 类型: string；作用: 当前旧连接让路用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: BrowserPersistenceDatabase；作用: 建立当前 v2 ready 连接。
  const database = createDatabase(databaseName);
  await database.initialize(createInitializationOptions());
  // 类型: IDBDatabase；作用: 请求更高版本，触发当前门面的 blocking 回调和连接关闭。
  const higherVersionConnection = await openRawDatabase(
    databaseName,
    BROWSER_PERSISTENCE_DATABASE_VERSION + 1
  );

  await assert.rejects(
    database.runReadonly([BROWSER_PERSISTENCE_STORE.appMeta], async () => null),
    error => error instanceof BrowserPersistenceError
      && error.code === BROWSER_PERSISTENCE_ERROR_CODE.blocked
  );
  await assert.rejects(
    database.initialize(createInitializationOptions()),
    error => error instanceof BrowserPersistenceError
      && error.code === BROWSER_PERSISTENCE_ERROR_CODE.blocked
  );
  higherVersionConnection.close();
  await database.deleteDatabase();
});

test('BrowserPersistenceDatabase terminated 会永久失效当前门面连接', async () => {
  // 类型: string；作用: 当前异常终止用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: object；作用: 捕获正式门面本次 openDB 对应的底层连接。
  const capture = captureNextRawConnection();
  // 类型: BrowserPersistenceDatabase；作用: 建立即将被异常终止的 ready 门面。
  const database = createDatabase(databaseName);
  // 类型: IDBDatabase；作用: fake-indexeddb 终止工具要求的底层连接实例。
  let rawConnection;
  try {
    await database.initialize(createInitializationOptions());
    rawConnection = await capture.connectionPromise;
  } finally {
    // 资源清理: 无论初始化成功或失败都恢复 IndexedDB 工厂原始 open 方法。
    capture.restore();
  }
  // 副作用: 触发 idb terminated 回调，不通过 close() 主动关闭路径伪造结果。
  forceCloseDatabase(rawConnection);
  await Promise.resolve();

  await assert.rejects(
    database.runReadonly([BROWSER_PERSISTENCE_STORE.appMeta], async () => null),
    error => error instanceof BrowserPersistenceError
      && error.code === BROWSER_PERSISTENCE_ERROR_CODE.terminated
  );
  await assert.rejects(
    database.initialize(createInitializationOptions()),
    error => error instanceof BrowserPersistenceError
      && error.code === BROWSER_PERSISTENCE_ERROR_CODE.terminated
  );
  await database.deleteDatabase();
});

test('BrowserPersistenceDatabase QuotaExceeded 会回滚并返回稳定容量错误', async () => {
  // 类型: string；作用: 当前容量失败用例独占的数据库名称。
  const databaseName = createDatabaseName();
  // 类型: BrowserPersistenceDatabase；作用: 提供真实 readwrite transaction 和回滚检查。
  const database = createDatabase(databaseName);
  await database.initialize(createInitializationOptions());
  // 类型: object；作用: 构造只在容量失败事务中尝试写入的唯一 Package。
  const candidatePackage = structuredClone(sourceRepositorySeeds.packages[0]);
  candidatePackage.packageRef = 'source-package::quota-exceeded';
  candidatePackage.sourceId = 'quota-exceeded';

  await assert.rejects(
    database.runReadwrite(
      [BROWSER_PERSISTENCE_STORE.sourcePackages],
      async (transaction) => {
        await transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages).add(candidatePackage);
        // 失败注入: 使用浏览器标准 DOMException 名称，验证统一错误转换和事务 abort。
        throw new DOMException('test quota exceeded', 'QuotaExceededError');
      }
    ),
    error => error instanceof BrowserPersistenceError
      && error.code === BROWSER_PERSISTENCE_ERROR_CODE.quotaExceeded
  );
  // 类型: object|undefined；作用: 容量失败后确认候选包没有形成部分提交。
  const storedPackage = await database.runReadonly(
    [BROWSER_PERSISTENCE_STORE.sourcePackages],
    async (transaction) => transaction.objectStore(BROWSER_PERSISTENCE_STORE.sourcePackages)
      .get(candidatePackage.packageRef)
  );
  assert.equal(storedPackage, undefined);
  await database.deleteDatabase();
});
