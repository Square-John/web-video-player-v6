/*
  source-runtime-persistence.integration.test.js 模块说明

  - 文件职责:
      使用 fake-indexeddb 验证 SourceRuntime Bundle 显式注入 IndexedDB Repository 后的跨重建保存能力。
      通过设置管理门面提交默认源和缓存清理，再重建数据库门面、Repository 与 Runtime，证明页面投影来自已提交数据库。
      验证三入口动态 Provider 的保存脚本恢复、无效授权失败关闭和 Manager 初始化失败后的注册释放。

  - 导入库及文件汇总(13 条，内置 2 条，第三方 1 条，自定义 10 条):
      node:assert/strict: 内置断言，验证重建前后的 Manager 投影和私有空间结果。
      node:test: 内置测试运行器，声明异步持久化集成用例。
      fake-indexeddb/auto: 第三方测试环境，在 Node 全局安装 IndexedDB API。
      browserPersistence.config: 自定义配置，提供正式数据库 schema 版本。
      BrowserPersistenceDatabase: 自定义数据库门面，模拟刷新前后两个独立连接生命周期。
      createIndexedDbSourceRepositories: 自定义工厂，为每次 Runtime 重建创建独立三仓与 UnitOfWork。
      sourceRepositoryUtils: 自定义工具，提供 settings 和 cache 正式分区名。
      builtinSourceCatalogRelease/LEGACY_PRODUCT_SOURCE_IDS/RETIRED_BUILTIN_SOURCE_IDS/sourceRepositorySeeds: 自定义数据，提供目录发布、迁移身份、首次空库种子和默认源身份。
      userContentMockData: 自定义数据，满足单数据库首次初始化用户内容输入。
      createSourceRuntimeBundle/createMockNetworkAdapter: 自定义 Runtime 与网络工厂，组合正式调用链和显式离线网络依赖。
      createSourceScriptHash: 自定义授权工具，为动态保存脚本生成真实 SHA-256。
      source-manager.config: 自定义配置，提供授权、导入、就绪和来源类型正式枚举。

  - 模块级常量:
      TEST_DATABASE_PREFIX: string，当前测试数据库名称前缀。
      DYNAMIC_IMPORT_SCENARIOS: Array<object>，三入口有效恢复与三类无效授权场景。

  - 模块级变量:
      databaseSequence: number，当前测试进程内唯一数据库递增序号。

  - 模块级辅助函数:
      createDatabase(databaseName): 创建绑定同一名称和正式版本的数据库门面。
      initializeDatabase(database, sourceSeeds): 使用隔离 Source/UserContent 种子初始化门面。
      createNodeSourcePackageModuleExecutor(): 创建执行保存脚本文本的 Node 测试端口。
      createIndependentProviderPackage(): 创建不依赖产品内置源的独立 ABI 2.0 单文件测试包。
      createRuntime(repositories, sourcePackageModuleExecutor): 创建显式 IndexedDB Repository 与可替换执行端口的 Runtime Bundle。
      findRecord(state, sourceId): 从 Manager 投影定位指定数据源记录。
      deepFreezeJson(value): 递归冻结测试模块运行时 manifest。
      createDynamicSourceGraph(): 创建三入口与无效授权动态保存图。
      createTestModuleExecutor(manifestByScript, options): 创建冻结可观测模块执行端口。
      createFailingDefinitionRepository(definitionRepository): 创建只失败一次 Manager 读取的 Repository 代理。

  - 模块级类:
      无

  - 对外导出:
      无
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证跨 Runtime 重建的保存事实。
import assert from 'node:assert/strict';

// 导入来源: node:test；导入内容: test；文件作用: 声明独立异步持久化集成用例。
import test from 'node:test';

// 导入来源: fake-indexeddb/auto；导入内容: Node IndexedDB 全局实现；文件作用: 执行真实 object store 与 transaction.done 语义。
import 'fake-indexeddb/auto';

import {
  // 导入来源: ../src/config/source-manager.config.js；导入内容: AUTHORIZATION_STATUS；文件作用: 构造有效、待授权和撤销保存快照。
  AUTHORIZATION_STATUS,
  // 导入来源: ../src/config/source-manager.config.js；导入内容: IMPORT_METHOD；文件作用: 覆盖 file、remote 和 text 三种正式入口。
  IMPORT_METHOD,
  // 导入来源: ../src/config/source-manager.config.js；导入内容: PROVIDER_READINESS_STATUS；文件作用: 验证恢复成功与失败关闭投影。
  PROVIDER_READINESS_STATUS,
  // 导入来源: ../src/config/source-manager.config.js；导入内容: SOURCE_KIND；文件作用: 创建必须经过授权恢复的自定义 Definition。
  SOURCE_KIND
} from '../src/config/source-manager.config.js';

// 导入来源: ../src/repositories/persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_DATABASE_VERSION；文件作用: 测试门面与正式 schema 使用同一版本事实。
import { BROWSER_PERSISTENCE_DATABASE_VERSION } from '../src/repositories/persistence/browserPersistence.config.js';

// 导入来源: ../src/repositories/persistence/browserPersistenceDatabase.js；导入内容: BrowserPersistenceDatabase；文件作用: 创建刷新前后两个独立数据库门面。
import { BrowserPersistenceDatabase } from '../src/repositories/persistence/browserPersistenceDatabase.js';

// 导入来源: ../src/repositories/source/createIndexedDbSourceRepositories.js；导入内容: createIndexedDbSourceRepositories；文件作用: 为每个 Runtime 注入同一数据库上的新 Repository 基础设施。
import { createIndexedDbSourceRepositories } from '../src/repositories/source/createIndexedDbSourceRepositories.js';

// 导入来源: ../src/repositories/source/sourceRepositoryUtils.js；导入内容: SOURCE_STORAGE_PARTITION；文件作用: 使用正式 settings 与 cache 分区名准备和复查数据。
import { SOURCE_STORAGE_PARTITION } from '../src/repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: builtinSourceCatalogRelease；文件作用: 让每次 Runtime 重建先完成当前目录发布对账。
  builtinSourceCatalogRelease,
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: LEGACY_PRODUCT_SOURCE_IDS；文件作用: 为正式 v3 迁移提供精确旧身份集合。
  LEGACY_PRODUCT_SOURCE_IDS,
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: RETIRED_BUILTIN_SOURCE_IDS；文件作用: 为正式 v20 迁移提供精确退役身份集合。
  RETIRED_BUILTIN_SOURCE_IDS,
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: sourceRepositorySeeds；文件作用: 提供首次空库种子与初始默认源。
  sourceRepositorySeeds
} from '../src/data/settings/source-repository.seed.js';

// 导入来源: ../src/data/user-content.mock.js；导入内容: userContentMockData；文件作用: 满足单数据库九仓首次种子输入。
import { userContentMockData } from '../src/data/user-content.mock.js';

// 导入来源: ../src/runtime/createSourceRuntime.js；导入内容: createSourceRuntimeBundle；文件作用: 创建显式 Repository 注入的完整 Runtime Bundle。
import { createSourceRuntimeBundle } from '../src/runtime/createSourceRuntime.js';

// 导入来源: ../src/runtime/source-shell/mockNetworkAdapter.js；导入内容: createMockNetworkAdapter；文件作用: 测试只选择离线网络实现，不触发代理或网络回退。
import { createMockNetworkAdapter } from '../src/runtime/source-shell/mockNetworkAdapter.js';

// 导入来源: ../src/utils/sourceAuthorization.js；导入内容: createSourceScriptHash；文件作用: 为测试保存包生成与生产恢复一致的 SHA-256。
import { createSourceScriptHash } from '../src/utils/sourceAuthorization.js';

// 类型: string；作用: 隔离正式数据库和其他持久化测试数据库。
const TEST_DATABASE_PREFIX = 'source-runtime-persistence-';

// 类型: Array<object>；作用: 固定三入口有效恢复和三种不应执行的授权状态，顺序决定执行断言顺序。
const DYNAMIC_IMPORT_SCENARIOS = Object.freeze([
  Object.freeze({ suffix: 'file', importMethod: IMPORT_METHOD.file, authorizationStatus: AUTHORIZATION_STATUS.authorized }),
  Object.freeze({ suffix: 'remote', importMethod: IMPORT_METHOD.remote, authorizationStatus: AUTHORIZATION_STATUS.authorized }),
  Object.freeze({ suffix: 'text', importMethod: IMPORT_METHOD.text, authorizationStatus: AUTHORIZATION_STATUS.authorized }),
  Object.freeze({ suffix: 'pending', importMethod: IMPORT_METHOD.file, authorizationStatus: AUTHORIZATION_STATUS.pending }),
  Object.freeze({ suffix: 'revoked', importMethod: IMPORT_METHOD.remote, authorizationStatus: AUTHORIZATION_STATUS.revoked }),
  Object.freeze({ suffix: 'hash-mismatch', importMethod: IMPORT_METHOD.text, authorizationStatus: 'hash-mismatch' })
]);

// 类型: number；生命周期: 当前测试模块；作用: 为每个用例生成唯一数据库名称。
let databaseSequence = 0;

/**
 * 创建绑定测试名称和正式 schema 版本的数据库门面。
 * 副作用: 只创建门面对象，initialize 前不打开 IndexedDB。
 *
 * @param {string} databaseName 当前用例刷新前后共享的数据库名称。
 * @returns {BrowserPersistenceDatabase} 尚未初始化的数据库门面。
 */
function createDatabase(databaseName) {
  return new BrowserPersistenceDatabase({
    databaseName,
    databaseVersion: BROWSER_PERSISTENCE_DATABASE_VERSION
  });
}

/**
 * 使用隔离种子初始化数据库门面。
 * 副作用: 首次调用写入九仓种子；同名重建只读取 initialized 事实，不覆盖既有数据。
 * 成功路径: 数据库可供 Repository 使用时完成。
 * 失败路径: schema、种子或保存图损坏时原样 reject，不创建备用仓。
 *
 * @param {BrowserPersistenceDatabase} database 当前连接生命周期的数据库门面。
 * @param {object} [sourceSeeds=sourceRepositorySeeds] 当前用例首次写入的数据源保存图。
 * @param {object} [catalogRelease=builtinSourceCatalogRelease] 当前用例内置目录发布身份。
 * @returns {Promise<void>} 初始化完成后结束。
 */
async function initializeDatabase(
  database,
  sourceSeeds = sourceRepositorySeeds,
  catalogRelease = builtinSourceCatalogRelease
) {
  await database.initialize({
    sourceSeeds: structuredClone(sourceSeeds),
    userContentSeed: structuredClone(userContentMockData),
    builtinCatalogRelease: structuredClone(catalogRelease),
    legacyProductSourceIds: LEGACY_PRODUCT_SOURCE_IDS,
    retiredBuiltinSourceIds: RETIRED_BUILTIN_SOURCE_IDS
  });
}

/**
 * 创建 Node 测试环境使用的单文件模块执行端口。
 * 副作用: 把已经由生产 Loader 静态预检的同一脚本文本编码为一次 data URL，并交给 Node 原生模块加载器执行。
 * 成功路径: 返回真实 Module Namespace，后续继续由生产 Loader 复核精确导出、manifest 和工厂。
 * 失败路径: 非文本或模块执行错误由原生 import reject，测试不能回退静态工厂或伪造命名空间。
 * 维护边界: 仅替代浏览器 Blob URL 执行设施，不复制 Loader、Registry、Host 或 Provider 业务。
 *
 * @returns {Readonly<{execute: Function}>} 只公开 execute 的冻结测试端口。
 */
function createNodeSourcePackageModuleExecutor() {
  return Object.freeze({
    /**
     * 执行当前 Repository 保存的完整单文件脚本。
     * 副作用: 创建 data URL 模块身份；Node 可能缓存相同文本的 Module Namespace，Provider 实例仍由工厂每次独立创建。
     * 成功路径: resolve 真实模块命名空间。
     * 失败路径: 输入无效或脚本执行失败时 reject，不尝试第二执行协议。
     *
     * @param {*} scriptContent 生产 Loader 已预检的规范化脚本文本。
     * @returns {Promise<object>} 真实 Module Namespace。
     */
    execute(scriptContent) {
      // 条件分支: 保存内容不是非空单文件文本时进入。
      // 执行内容: 在创建模块 URL 前失败，保持测试执行边界与生产一致。
      if (typeof scriptContent !== 'string' || !scriptContent.trim()) {
        return Promise.reject(new TypeError('Node 测试模块脚本文本无效'));
      }
      // 类型: string；作用: 使用同一脚本文本创建 Node 可执行模块 URL，不读取源码文件或另一份实现。
      const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(scriptContent)}`;
      return import(moduleUrl);
    }
  });
}

/**
 * 创建不依赖产品内置源的独立 ABI 2.0 单文件测试包。
 * 纯函数: 每次返回同一确定性文本和 manifest，不读取产品目录、页面、Store、Runtime 内部对象或源码文件。
 * 成功路径: 脚本经文本导入后创建完整 Provider，通过 SourceContext 私有缓存记录请求并返回标准内容响应。
 * 失败路径: 脚本字段或 ABI 漂移由正式 Parser、Loader、Host 和响应断言失败关闭。
 *
 * @returns {object} scriptContent、manifest 和 sourceId 测试制品。
 */
function createIndependentProviderPackage() {
  // 类型: object；作用: 第五条 Provider 的静态身份、页面能力和独立 host 声明，不复用任何内置源字段。
  const manifest = {
    schemaVersion: '1.0.0',
    providerApiVersion: '2.0.0',
    id: 'source.test.independent.fifth',
    name: '第五条独立 Provider',
    description: '验证单文件 Provider 不修改平台公共业务代码即可导入、启用和返回标准商品。',
    version: '1.0.0',
    providerKey: 'source.test.independent.fifth.provider',
    capabilities: {
      home: true,
      movie: true,
      tv: false,
      search: true,
      detail: true,
      play: false
    },
    settingsSchema: [],
    networkHosts: ['fifth-provider.example.com']
  };
  // 类型: string；作用: 可由正式静态 Parser 提取两个导出，并由 Node 测试执行器运行的完整单文件脚本。
  const scriptContent = `
export const sourceManifest = Object.freeze(${JSON.stringify(manifest)});

export function createProviderFactory() {
  return Object.freeze({
    providerKey: sourceManifest.providerKey,
    supports(definition) {
      return definition.id === sourceManifest.id
        && definition.providerKey === sourceManifest.providerKey;
    },
    create({ definition }) {
      let sourceContext = null;
      let running = false;
      return Object.freeze({
        id: definition.id,
        async initialize(context) {
          sourceContext = context;
        },
        async start() {
          running = true;
        },
        async fetchData(request) {
          if (!running || !sourceContext) throw new Error('independent provider is not running');
          await sourceContext.storage.cache.set('last-request', { pageKey: request.pageKey });
          const item = {
            id: 'independent-item-01',
            sourceId: definition.id,
            sourceName: sourceManifest.name,
            type: 'movie',
            title: '第五条 Provider 标准商品',
            originalTitle: '',
            aliases: [],
            poster: '',
            cover: '',
            description: '由独立单文件 Provider 生产。',
            year: '2026',
            area: '',
            language: '',
            genres: [],
            tags: [],
            displayTags: [],
            score: null,
            quality: '',
            rank: null,
            badge: '',
            detail: {
              fullDescription: '由独立单文件 Provider 生产。',
              directors: [],
              writers: [],
              actors: [],
              releaseDate: '',
              updateTime: '',
              status: '',
              screenshots: [],
              trailerUrl: ''
            },
            movie: { duration: '' },
            tv: { totalEpisodes: null, latestEpisode: null, updateStatus: '', season: '' },
            episodes: [],
            playback: { defaultSourceId: '', sources: [] },
            source: {
              name: sourceManifest.name,
              domain: 'fifth-provider.example.com',
              rawId: 'independent-item-01',
              sourceDetailUrl: '',
              rawData: null
            }
          };
          return {
            sourceId: definition.id,
            pageKey: request.pageKey,
            moduleKey: request.moduleKey,
            request: JSON.parse(JSON.stringify(request)),
            pagination: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
            items: [item],
            item: null,
            meta: { fetchedAt: '', status: 'ready', message: '' }
          };
        },
        async fetchFilterMeta(request) {
          return {
            sourceId: definition.id,
            pageKey: request.pageKey,
            request: JSON.parse(JSON.stringify(request)),
            groups: [],
            meta: { status: 'ready', message: '', fetchedAt: '' }
          };
        },
        async checkHealth() {
          return { healthStatus: 'normal', checkedAt: '', unavailableReason: '' };
        },
        async detectChallenge(response) {
          void response;
          return null;
        },
        async continueChallenge(challengeInput) {
          void challengeInput;
          return { status: 'unsupported' };
        },
        async stop() {
          running = false;
        },
        async dispose() {
          running = false;
          sourceContext = null;
        }
      });
    }
  });
}
`.trim();

  return { manifest, scriptContent, sourceId: manifest.id };
}

/**
 * 创建使用显式 IndexedDB Repository 的 Runtime Bundle。
 * 副作用: 创建独立 MockNetworkAdapter、Manager、Host 和 Runtime 门面，不打开或关闭数据库。
 * 成功路径: 返回共享同一 Repository 基础设施的内容与设置管理门面。
 * 失败路径: Repository 或 Runtime 依赖无效时同步抛错，不切换 Memory。
 *
 * @param {object} repositories 当前数据库门面创建的三仓和 UnitOfWork。
 * @param {Readonly<{ execute: Function }>} [sourcePackageModuleExecutor] 可选测试模块执行端口。
 * @returns {object} 冻结 SourceRuntime Bundle。
 */
function createRuntime(repositories, sourcePackageModuleExecutor) {
  return createSourceRuntimeBundle({
    networkAdapter: createMockNetworkAdapter(),
    repositories,
    activeSourceId: '',
    sourcePackageModuleExecutor: sourcePackageModuleExecutor || createNodeSourcePackageModuleExecutor()
  });
}

/**
 * 递归冻结严格 JSON 测试对象。
 * 副作用: 只冻结调用方刚创建的隔离树；不修改正式种子或 Repository 返回对象。
 * 成功路径: 子节点先冻结，最终返回同一根引用。
 * 失败路径: 本测试只传入无循环 JSON 值，不注入冻结失败。
 *
 * @param {*} value 待冻结的 JSON 值。
 * @returns {*} 同一冻结值。
 */
function deepFreezeJson(value) {
  // 条件分支: 当前值是非 null 对象或数组时进入。
  // 执行内容: 先冻结全部子值，再冻结根，满足 Loader 对运行时 manifest 的不可变要求。
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreezeJson);
    Object.freeze(value);
  }
  return value;
}

/**
 * 创建覆盖三种导入来源和三种失效授权的完整 Source 保存图。
 * 纯函数: 从正式种子创建隔离副本并追加测试记录，不修改模块级正式种子。
 * 成功路径: 返回可首次写入数据库的 seeds，以及脚本文本到 manifest 的执行索引。
 * 失败路径: 测试常量不符合 Repository 或 Parser 契约时由后续初始化明确 reject。
 *
 * @returns {object} seeds、manifestByScript、validSourceIds 和 invalidSourceIds。
 */
function createDynamicSourceGraph() {
  // 类型: object；作用: 保存当前用例独占的完整四域 Source 种子。
  const seeds = structuredClone(sourceRepositorySeeds);
  // 类型: Map<string, object>；作用: 让测试执行端口按实际保存脚本文本返回对应运行时 manifest。
  const manifestByScript = new Map();
  // 类型: Array<string>；作用: 保存应在每次启动执行的 file、remote、text 三个 sourceId。
  const validSourceIds = [];
  // 类型: Array<string>；作用: 保存 pending、revoked 和哈希失效三个失败关闭 sourceId。
  const invalidSourceIds = [];

  // 循环作用: 每个场景创建一套互相引用的 Package、Definition、Preferences 和五分区命名空间。
  DYNAMIC_IMPORT_SCENARIOS.forEach((scenario) => {
    // 类型: string；作用: 使用反向域名风格身份连接保存图、Registry 和 Manager 投影。
    const normalizedSuffix = scenario.suffix.replaceAll('-', '');
    // 类型: string；作用: 当前场景跨 Package、Definition、Preferences、Storage 和 Runtime 共用的真实身份。
    const sourceId = `source.persistence.${normalizedSuffix}`;
    // 类型: string；作用: 当前动态源独占工厂键，防止多源共享错误闭包。
    const providerKey = `${sourceId}.provider`;
    // 类型: string；作用: Package Repository 和 Definition 的唯一关联键。
    const packageRef = `source-package::${sourceId}`;
    // 类型: object；作用: 静态脚本声明，字段与恢复 Loader 映射契约一致。
    const manifest = {
      schemaVersion: '1.0.0',
      providerApiVersion: '2.0.0',
      id: sourceId,
      name: `持久化恢复 ${scenario.suffix}`,
      description: `验证 ${scenario.importMethod} 保存脚本的启动恢复边界。`,
      version: '1.0.0',
      providerKey,
      capabilities: {
        home: true,
        movie: true,
        tv: true,
        search: true,
        detail: true,
        play: true
      },
      settingsSchema: [],
      networkHosts: ['media.example.com']
    };
    // 类型: string；作用: 使用 Parser 可静态提取的两个精确 ES module 导出保存脚本。
    const scriptContent = `export const sourceManifest = Object.freeze(${JSON.stringify(manifest)});\n`
      + 'export function createProviderFactory() { return {}; }\n';
    // 类型: string；作用: 当前保存脚本按生产算法生成的真实授权与完整性指纹。
    const scriptHash = createSourceScriptHash(scriptContent);
    // 类型: boolean；作用: true 表示本场景应执行并注册；false 表示必须在执行前失败关闭。
    const isAuthorized = scenario.authorizationStatus === AUTHORIZATION_STATUS.authorized;
    // 类型: string；作用: hash-mismatch 保留 authorized 状态但使用不同指纹，验证指纹门禁优先于执行。
    const authorizedScriptHash = scenario.authorizationStatus === 'hash-mismatch'
      ? '0'.repeat(scriptHash.length)
      : isAuthorized
        ? scriptHash
        : '';

    manifestByScript.set(scriptContent, structuredClone(manifest));
    seeds.packages.push({
      packageRef,
      schemaVersion: '1.0.0',
      sourceId,
      providerKey,
      scriptContent,
      integrity: {
        algorithm: 'sha-256',
        scriptHash
      }
    });
    seeds.definitions.push({
      schemaVersion: manifest.schemaVersion,
      id: sourceId,
      name: manifest.name,
      description: manifest.description,
      sourceKind: SOURCE_KIND.custom,
      version: manifest.version,
      providerKey,
      packageRef,
      importMethod: scenario.importMethod,
      remoteUrl: scenario.importMethod === IMPORT_METHOD.remote
        ? `https://packages.example.com/${normalizedSuffix}.js`
        : '',
      importedAt: '2026-07-21T00:00:00.000Z',
      lastUpdatedAt: '2026-07-21T00:00:00.000Z',
      capabilities: structuredClone(manifest.capabilities),
      settingsSchema: []
    });
    seeds.preferences.sourceStates[sourceId] = {
      enabled: true,
      authorization: {
        status: scenario.authorizationStatus === 'hash-mismatch'
          ? AUTHORIZATION_STATUS.authorized
          : scenario.authorizationStatus,
        authorizedAt: isAuthorized || scenario.authorizationStatus === 'hash-mismatch'
          ? '2026-07-21T00:00:00.000Z'
          : '',
        authorizedVersion: isAuthorized || scenario.authorizationStatus === 'hash-mismatch'
          ? manifest.version
          : '',
        authorizedScriptHash
      }
    };
    seeds.storageNamespaces[sourceId] = {
      settings: {},
      credentials: {},
      session: {},
      cache: {},
      diagnostics: {}
    };

    // 条件分支: 当前授权和指纹完整时进入。
    // 执行内容: 归入预期执行集合；其他状态归入必须失败关闭集合。
    if (isAuthorized) validSourceIds.push(sourceId);
    else invalidSourceIds.push(sourceId);
  });

  // 副作用: 默认源指向有效 file 动态源，证明恢复失败不能被默认源身份掩盖。
  seeds.preferences.defaultSourceId = validSourceIds[0];
  return { seeds, manifestByScript, validSourceIds, invalidSourceIds };
}

/**
 * 创建 Node 可执行的冻结 SourcePackageModuleExecutor 测试端口。
 * 副作用: 每次 execute 记录实际 sourceId；不访问 Blob、网络、DOM 或 Repository。
 * 成功路径: 返回与保存脚本静态声明一致的冻结 manifest 和严格 ProviderFactory。
 * 失败路径: 未知脚本文本明确抛错；firstFactorySingleSupport 可令首次工厂只通过一次 supports。
 *
 * @param {Map<string, object>} manifestByScript 保存脚本文本到 manifest 的测试索引。
 * @param {object} [options={}] 可控执行行为。
 * @param {boolean} [options.firstFactorySingleSupport=false] true 令首次工厂只在 Loader 复核时返回支持，false 所有工厂保持支持。
 * @returns {object} moduleExecutor 和 executedSourceIds。
 */
function createTestModuleExecutor(manifestByScript, { firstFactorySingleSupport = false } = {}) {
  // 类型: Array<string>；作用: 记录恢复流程实际执行的 sourceId 和顺序。
  const executedSourceIds = [];
  // 类型: number；作用: 标记跨初始化执行代次，构造失败释放用例的首次短生命周期工厂。
  let executionCount = 0;
  // 类型: Readonly<{ execute: Function }>；作用: 以正式单方法端口形状注入 Runtime 组合层。
  const moduleExecutor = Object.freeze({
    /**
     * 根据保存脚本文本返回对应测试模块命名空间。
     * 副作用: 递增执行代次并记录 sourceId；工厂 supports 闭包只属于本次执行。
     * 成功路径: resolve 两个精确导出的模块对象。
     * 失败路径: 脚本文本没有对应 manifest 时抛 Error，不猜测或执行未知内容。
     *
     * @param {string} scriptContent Loader 已完成哈希和静态预检的保存脚本。
     * @returns {Promise<object>} sourceManifest 和 createProviderFactory 模块命名空间。
     * @throws {Error} 输入不属于当前测试保存图时抛出。
     */
    async execute(scriptContent) {
      // 类型: object|undefined；作用: 按完整脚本文本定位运行时声明，不从 sourceId 别名构造结果。
      const manifest = manifestByScript.get(scriptContent);
      // 条件分支: 当前脚本文本不属于夹具冻结保存图时进入。
      // 执行内容: 立即失败，禁止根据文本片段或 sourceId 猜测模块命名空间。
      if (!manifest) throw new Error('测试模块执行器收到未知保存脚本');
      executionCount += 1;
      executedSourceIds.push(manifest.id);
      // 类型: object；作用: Loader 要求运行时根及嵌套 JSON 值不可变。
      const runtimeManifest = deepFreezeJson(structuredClone(manifest));
      // 类型: boolean；作用: 只让整个端口首次创建的工厂在一次 supports 后失效，用于观察失败释放。
      const hasSingleSupport = firstFactorySingleSupport && executionCount === 1;
      // 类型: number；作用: 当前工厂独占支持调用计数，不与后续恢复工厂共享。
      let supportCallCount = 0;

      return {
        sourceManifest: runtimeManifest,
        /**
         * 创建符合动态 ProviderFactory ABI 的测试工厂。
         * 副作用: 返回工厂拥有独立 supportCallCount；不创建 Provider 或访问外部状态。
         * 成功路径: providerKey、supports 和 create 三字段完整。
         * 失败路径: 本夹具不注入工厂创建异常。
         *
         * @returns {object} 当前模块代次的 ProviderFactory。
         */
        createProviderFactory() {
          return {
            providerKey: runtimeManifest.providerKey,
            /**
             * 判断当前工厂是否支持给定 Definition。
             * 副作用: 递增当前工厂调用计数；单次支持模式只允许第一次 Loader 复核通过。
             * 成功路径: 身份一致且调用资格有效时返回 true。
             * 失败路径: 身份不一致或短生命周期资格耗尽时返回 false。
             *
             * @param {object} definition Runtime 当前评估的数据源定义。
             * @returns {boolean} 当前工厂能否服务该 Definition。
             */
            supports(definition) {
              supportCallCount += 1;
              return definition.id === runtimeManifest.id
                && (!hasSingleSupport || supportCallCount === 1);
            },
            /**
             * 创建占位测试 Provider。
             * 纯函数: 返回新空对象；本步骤只验证启动 readiness，不启动该 Provider。
             * 成功路径: 返回普通对象满足 ABI。
             * 失败路径: 无。
             *
             * @returns {object} 未启动的占位 Provider。
             */
            create() {
              return {};
            }
          };
        }
      };
    }
  });

  return { moduleExecutor, executedSourceIds };
}

/**
 * 创建在恢复读取成功后只失败一次 Manager Definition 读取的 Repository 代理。
 * 副作用: 维护当前代理独占的读取阶段；其他方法绑定原 Repository 并保持真实 IndexedDB 行为。
 * 成功路径: 首次恢复读取成功，第二次 Manager 读取 reject，后续重试恢复正常。
 * 失败路径: 注入错误原样进入 Runtime 初始化补偿；底层 Repository 错误不改写。
 *
 * @param {object} definitionRepository IndexedDB Definition Repository。
 * @returns {object} 方法能力与原 Repository 相同的代理。
 */
function createFailingDefinitionRepository(definitionRepository) {
  // 类型: boolean；作用: false 表示恢复协调器尚未完成首次读取，true 表示下一次读取属于 Manager。
  let hasRestoreReadCompleted = false;
  // 类型: boolean；作用: true 表示一次性 Manager 失败已经注入，后续重试不得重复阻断。
  let hasInjectedManagerFailure = false;

  /**
   * 按恢复、首次 Manager、重试顺序委托 Definition 列表读取。
   * 副作用: 更新两个阶段 Boolean；不修改数据库内容。
   * 成功路径: 首次和失败后的全部读取委托原 Repository。
   * 失败路径: 恢复后的首次调用抛出确定性错误，触发 Runtime 注册释放。
   *
   * @returns {Promise<Array<object>>} 原 Repository 返回的隔离 Definition 列表。
   * @throws {Error} 首次 Manager 读取时注入。
   */
  async function loadDefinitionsWithFailure() {
    // 条件分支: 恢复读取已经成功且 Manager 失败尚未注入时进入。
    // 执行内容: 只失败一次，不调用底层仓，让 Runtime 进入初始化补偿。
    if (hasRestoreReadCompleted && !hasInjectedManagerFailure) {
      hasInjectedManagerFailure = true;
      throw new Error('测试注入 SourceManager Definition 读取失败');
    }

    // 类型: Array<object>；作用: 保留底层 IndexedDB 隔离和校验语义。
    const definitions = await definitionRepository.loadDefinitions();
    hasRestoreReadCompleted = true;
    return definitions;
  }

  return new Proxy(definitionRepository, {
    /**
     * 裁剪一次性失败方法并绑定其他 Repository 原方法。
     * 纯函数: 除 loadDefinitions 返回测试函数外，只读取目标属性并绑定原实例。
     * 成功路径: 所有正式方法保持原接收者和返回语义。
     * 失败路径: Reflect.get 或底层方法错误原样传播。
     *
     * @param {object} target 原 IndexedDB Definition Repository。
     * @param {string|symbol} property 当前读取属性。
     * @param {object} receiver 当前代理接收者。
     * @returns {*} 注入函数、已绑定方法或原属性值。
     */
    get(target, property, receiver) {
      // 条件分支: Runtime 或 Manager 读取 Definition 列表方法时进入。
      // 执行内容: 返回一次性失败函数，使初始化补偿路径可由公开状态验证。
      if (property === 'loadDefinitions') return loadDefinitionsWithFailure;
      // 类型: *；作用: 读取原 Repository 能力；函数绑定 target，避免私有实例状态丢失。
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

/**
 * 从完整 SourceManagerState 定位一个数据源记录。
 * 纯函数: 不修改投影；找不到时通过断言失败当前测试。
 *
 * @param {object} state Runtime 返回的隔离 SourceManagerState。
 * @param {string} sourceId 待定位数据源身份。
 * @returns {object} 命中的 SourceRecord。
 */
function findRecord(state, sourceId) {
  // 类型: object|undefined；作用: 在 Runtime 公开投影中定位目标缓存摘要，不读取 Repository 私有状态。
  const record = state.records.find(candidate => candidate.definition.id === sourceId);
  assert.ok(record, `SourceManagerState 应包含 ${sourceId}`);
  return record;
}

test('SourceRuntime 使用 IndexedDB 提交默认源和缓存清理并在完整重建后恢复', async () => {
  databaseSequence += 1;
  // 类型: string；作用: 刷新前后两个完整基础设施图共享的唯一数据库身份。
  const databaseName = `${TEST_DATABASE_PREFIX}${databaseSequence}`;
  // 类型: string；作用: 选择产品目录第一条真实系统源作为初始默认源。
  const initialDefaultSourceId = sourceRepositorySeeds.preferences.defaultSourceId;
  // 类型: string；作用: 选择不同于初始默认源且具有自身真实工厂的受审候选。
  const persistedDefaultSourceId = sourceRepositorySeeds.definitions.find((definition) => {
    return definition.id !== initialDefaultSourceId;
  }).id;

  // 类型: BrowserPersistenceDatabase；作用: 模拟刷新前应用持有的唯一数据库门面。
  const firstDatabase = createDatabase(databaseName);
  await initializeDatabase(firstDatabase);
  // 类型: object；作用: 模拟刷新前 Runtime 使用的 IndexedDB 三仓与原生 UnitOfWork。
  const firstRepositories = createIndexedDbSourceRepositories({ database: firstDatabase });
  await firstRepositories.storageRepository.set(
    initialDefaultSourceId,
    SOURCE_STORAGE_PARTITION.settings,
    'display-mode',
    'compact'
  );
  await firstRepositories.storageRepository.set(
    initialDefaultSourceId,
    SOURCE_STORAGE_PARTITION.cache,
    'catalog-page',
    { page: 3 }
  );

  // 类型: object；作用: 通过正式设置管理门面提交 Preferences 和 Storage 事务，不直接改数据库。
  const firstRuntime = createRuntime(firstRepositories).sourceManagementRuntime;
  // 类型: object；作用: 保存首次 Runtime 从种子数据库组装的完整初始投影。
  const initialState = await firstRuntime.initialize();
  // 类型: Array<object>；作用: 失败时输出各系统源真实 Loader/Host 资格，避免默认源断言掩盖恢复根因。
  const initialReadiness = initialState.records.map(record => ({
    sourceId: record.definition.id,
    readiness: record.runtime.providerReadiness
  }));
  assert.equal(
    initialState.defaultSourceId,
    initialDefaultSourceId,
    JSON.stringify(initialReadiness)
  );
  await firstRuntime.setDefaultSource(persistedDefaultSourceId);
  // 类型: object；作用: 保存默认源和全部运行缓存事务提交后的 Manager 投影。
  const committedState = await firstRuntime.clearAllSourceCache(initialDefaultSourceId);
  assert.equal(committedState.defaultSourceId, persistedDefaultSourceId);
  assert.equal(findRecord(committedState, initialDefaultSourceId).cache.totalCacheBytes, 0);
  assert.equal(
    await firstRepositories.storageRepository.get(
      initialDefaultSourceId,
      SOURCE_STORAGE_PARTITION.settings,
      'display-mode'
    ),
    'compact'
  );
  firstDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 模拟页面刷新后创建的新连接门面，不复用任何 Runtime 闭包。
  const reopenedDatabase = createDatabase(databaseName);
  await initializeDatabase(reopenedDatabase);
  // 类型: object；作用: 模拟刷新后重新创建的 Repository 基础设施，不复用旧实例或影子状态。
  const reopenedRepositories = createIndexedDbSourceRepositories({ database: reopenedDatabase });
  // 类型: object；作用: 模拟刷新后重新创建的完整 Runtime 投影。
  const reopenedRuntime = createRuntime(reopenedRepositories).sourceManagementRuntime;
  // 类型: object；作用: 保存新 Runtime 只从既有 IndexedDB 保存图恢复的完整投影。
  const restoredState = await reopenedRuntime.initialize();

  assert.equal(restoredState.defaultSourceId, persistedDefaultSourceId);
  assert.equal(findRecord(restoredState, initialDefaultSourceId).cache.totalCacheBytes, 0);
  assert.equal(
    await reopenedRepositories.storageRepository.get(
      initialDefaultSourceId,
      SOURCE_STORAGE_PARTITION.settings,
      'display-mode'
    ),
    'compact'
  );
  assert.equal(
    await reopenedRepositories.storageRepository.get(
      initialDefaultSourceId,
      SOURCE_STORAGE_PARTITION.cache,
      'catalog-page'
    ),
    null
  );
  await reopenedDatabase.deleteDatabase();
});

test('SourceRuntime 在同 schema 刷新后只执行当前目录 Provider 脚本', async () => {
  databaseSequence += 1;
  // 类型: string；作用: 同 schema 旧脚本恢复用例独占数据库名称。
  const databaseName = `${TEST_DATABASE_PREFIX}catalog-refresh-${databaseSequence}`;
  // 类型: object；作用: 从当前系统种子隔离出无法由 Loader 执行的旧 Package，证明 Runtime 不能绕过数据库对账。
  const historicalSeeds = structuredClone(sourceRepositorySeeds);
  // 类型: object；作用: 第一条系统 Package 使用合法保存结构但不导出 Provider ABI。
  const stalePackage = historicalSeeds.packages[0];
  stalePackage.scriptContent = 'export const staleCatalogFixture = true;';
  stalePackage.integrity.scriptHash = createSourceScriptHash(stalePackage.scriptContent);
  // 类型: object；作用: 同源 Definition 回到旧业务版本，启动更新后必须采用当前目录版本。
  const staleDefinition = historicalSeeds.definitions.find(definition => definition.id === stalePackage.sourceId);
  staleDefinition.version = '0.9.0';
  // 类型: object；作用: 旧系统授权与旧 Package 哈希保持自洽，失败原因只能来自脚本 ABI 而非授权漂移。
  const staleSourceState = historicalSeeds.preferences.sourceStates[stalePackage.sourceId];
  staleSourceState.authorization.authorizedVersion = staleDefinition.version;
  staleSourceState.authorization.authorizedScriptHash = stalePackage.integrity.scriptHash;
  // 类型: object；作用: revision=0 让第二次相同 schema 初始化明确进入目录升级分支。
  const historicalRelease = {
    schemaVersion: builtinSourceCatalogRelease.schemaVersion,
    revision: 0,
    version: '0.9.0',
    fingerprint: '8'.repeat(64)
  };

  // 类型: BrowserPersistenceDatabase；作用: 只保存旧脚本，不创建 Runtime，模拟用户浏览器已有历史 Package。
  const historicalDatabase = createDatabase(databaseName);
  await initializeDatabase(historicalDatabase, historicalSeeds, historicalRelease);
  historicalDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 用户刷新后以相同 schema 和当前目录发布重新建立初始化屏障。
  const currentDatabase = createDatabase(databaseName);
  await initializeDatabase(currentDatabase);
  // 类型: object；作用: Runtime 只能从对账完成后的 IndexedDB 三仓恢复脚本，不接收静态 Provider 工厂。
  const currentRepositories = createIndexedDbSourceRepositories({ database: currentDatabase });
  // 类型: object；作用: 保存当前 Runtime 初始化投影，目标系统源必须通过真实 Loader 和 Host 就绪门禁。
  const currentState = await createRuntime(currentRepositories).sourceRuntime.initialize();
  // 类型: object；作用: 定位此前保存无效旧脚本的同一 sourceId。
  const refreshedRecord = findRecord(currentState, stalePackage.sourceId);
  // 类型: object；作用: 从 Package Repository 复查 Runtime 实际可读取的脚本文本来源。
  const refreshedPackage = (await currentRepositories.packageRepository.loadAll())
    .find(sourcePackage => sourcePackage.sourceId === stalePackage.sourceId);

  assert.equal(refreshedRecord.definition.version, sourceRepositorySeeds.definitions[0].version);
  assert.equal(refreshedRecord.runtime.providerReadiness.status, PROVIDER_READINESS_STATUS.ready);
  assert.deepEqual(refreshedPackage, sourceRepositorySeeds.packages[0]);
  await currentDatabase.deleteDatabase();
});

test('第五条独立 ABI 2.0 Provider 无需修改公共业务代码即可导入、启用和提供标准商品', async () => {
  databaseSequence += 1;
  // 类型: string；作用: 当前独立 Provider 导入与运行用例专属数据库名称。
  const databaseName = `${TEST_DATABASE_PREFIX}independent-provider-${databaseSequence}`;
  // 类型: BrowserPersistenceDatabase；作用: 提供与产品相同的九仓、v9 schema 和事务语义。
  const database = createDatabase(databaseName);
  await initializeDatabase(database);
  // 类型: object；作用: 保存当前数据库创建的正式三仓和 UnitOfWork，导入与 Provider 私有缓存共用它们。
  const repositories = createIndexedDbSourceRepositories({ database });
  // 类型: object；作用: 创建内容与设置管理门面共享的唯一 Runtime Bundle，不注入第五条静态工厂。
  const bundle = createRuntime(repositories);
  await bundle.sourceManagementRuntime.initialize();
  // 类型: object；作用: 保存完全独立于产品系统源的 ABI 2.0 单文件文本和静态 manifest。
  const providerPackage = createIndependentProviderPackage();
  // 类型: object；作用: 让正式 Loader 对文本入口执行信任前 AST 预检，不执行脚本或注册工厂。
  const importInput = {
    importMethod: IMPORT_METHOD.text,
    remoteUrl: '',
    originalFileName: '',
    scriptContent: providerPackage.scriptContent
  };
  // 类型: object；作用: 保存不含脚本文本和工厂引用的预检结果，用户信任只绑定其 SHA-256。
  const preview = await bundle.sourceManagementRuntime.previewSourceImport(importInput);
  // 类型: object；作用: 保存导入、授权、注册、Repository 提交和 Host 启动后的唯一 Manager 投影。
  const importedState = await bundle.sourceManagementRuntime.importSource({
    input: importInput,
    trustDecision: {
      trustedScriptHash: preview.integrity.scriptHash,
      enableAfterImport: true
    }
  });
  // 类型: object；作用: 从正式投影定位第五条记录，证明 Definition 由脚本 manifest 生成而非平台内置字段。
  const importedRecord = findRecord(importedState, providerPackage.sourceId);

  assert.equal(importedRecord.definition.name, providerPackage.manifest.name);
  assert.equal(importedRecord.runtime.enabled, true);
  assert.equal(
    importedRecord.runtime.providerReadiness.status,
    PROVIDER_READINESS_STATUS.ready
  );

  // 类型: object；作用: 通过公共内容 Runtime 请求第五条 Provider 的电影商品，不读取 Provider 或 Registry 内部对象。
  const response = await bundle.sourceRuntime.fetchData({
    sourceId: providerPackage.sourceId,
    pageKey: 'movie',
    moduleKey: '',
    params: {
      page: 1,
      pageSize: 20,
      keyword: '',
      category: '',
      genre: '',
      area: '',
      year: '',
      sort: '',
      contentId: '',
      episodeId: '',
      playSourceId: ''
    }
  });

  assert.equal(response.sourceId, providerPackage.sourceId);
  assert.equal(response.items.length, 1);
  assert.equal(response.items[0].title, '第五条 Provider 标准商品');
  assert.equal(response.items[0].sourceId, providerPackage.sourceId);
  assert.deepEqual(
    await repositories.storageRepository.get(
      providerPackage.sourceId,
      SOURCE_STORAGE_PARTITION.cache,
      'last-request'
    ),
    { pageKey: 'movie' }
  );

  // 资源清理: 先释放第五条 Provider 的 Context 与 Host entry，再删除当前测试数据库。
  await bundle.sourceRuntime.disposeSource(providerPackage.sourceId);
  await database.deleteDatabase();
});

test('SourceRuntime 从 IndexedDB 在完整重建后恢复三入口动态 Provider 并拒绝无效授权', async () => {
  databaseSequence += 1;
  // 类型: string；作用: 两个独立 Runtime 生命周期共享同一个动态保存图数据库。
  const databaseName = `${TEST_DATABASE_PREFIX}dynamic-restore-${databaseSequence}`;
  // 类型: object；作用: 保存三入口有效源、三类无效授权源和执行索引。
  const graph = createDynamicSourceGraph();

  // 类型: BrowserPersistenceDatabase；作用: 模拟动态包首次保存后的当前页面连接。
  const firstDatabase = createDatabase(databaseName);
  await initializeDatabase(firstDatabase, graph.seeds);
  // 类型: object；作用: 第一生命周期的独立执行端口和执行身份记录。
  const firstExecutor = createTestModuleExecutor(graph.manifestByScript);
  // 类型: object；作用: 第一生命周期从数据库恢复后发布的 Manager 投影。
  const firstState = await createRuntime(
    createIndexedDbSourceRepositories({ database: firstDatabase }),
    firstExecutor.moduleExecutor
  ).sourceRuntime.initialize();

  assert.deepEqual(firstExecutor.executedSourceIds, graph.validSourceIds);
  // 循环作用: 三种入口的有效授权保存包都必须注册真实工厂并投影 ready。
  graph.validSourceIds.forEach((sourceId) => {
    assert.equal(
      findRecord(firstState, sourceId).runtime.providerReadiness.status,
      PROVIDER_READINESS_STATUS.ready
    );
  });
  // 循环作用: pending、revoked 和哈希失效候选必须在执行前关闭，且不能成为默认或活动源。
  graph.invalidSourceIds.forEach((sourceId) => {
    assert.equal(
      findRecord(firstState, sourceId).runtime.providerReadiness.status,
      PROVIDER_READINESS_STATUS.unavailable
    );
    assert.notEqual(firstState.defaultSourceId, sourceId);
    assert.notEqual(firstState.activeSourceId, sourceId);
  });
  assert.equal(firstState.defaultSourceId, graph.validSourceIds[0]);
  firstDatabase.close();

  // 类型: BrowserPersistenceDatabase；作用: 模拟刷新后新建连接，不复用旧 Repository、Runtime、Registry 或工厂闭包。
  const reopenedDatabase = createDatabase(databaseName);
  await initializeDatabase(reopenedDatabase);
  // 类型: object；作用: 第二生命周期独占执行端口，执行记录用于证明保存脚本重新恢复。
  const reopenedExecutor = createTestModuleExecutor(graph.manifestByScript);
  // 类型: object；作用: 第二生命周期只从既有 IndexedDB 图恢复的 Manager 投影。
  const reopenedState = await createRuntime(
    createIndexedDbSourceRepositories({ database: reopenedDatabase }),
    reopenedExecutor.moduleExecutor
  ).sourceRuntime.initialize();

  assert.deepEqual(reopenedExecutor.executedSourceIds, graph.validSourceIds);
  graph.validSourceIds.forEach((sourceId) => {
    assert.equal(
      findRecord(reopenedState, sourceId).runtime.providerReadiness.status,
      PROVIDER_READINESS_STATUS.ready
    );
  });
  graph.invalidSourceIds.forEach((sourceId) => {
    assert.equal(
      findRecord(reopenedState, sourceId).runtime.providerReadiness.status,
      PROVIDER_READINESS_STATUS.unavailable
    );
  });
  assert.equal(reopenedState.defaultSourceId, graph.validSourceIds[0]);
  await reopenedDatabase.deleteDatabase();
});

test('SourceRuntime 在 Manager 初始化失败后释放动态注册并用新工厂完成重试', async () => {
  databaseSequence += 1;
  // 类型: string；作用: 隔离初始化补偿测试与其他 fake-indexeddb 数据库。
  const databaseName = `${TEST_DATABASE_PREFIX}restore-release-${databaseSequence}`;
  // 类型: object；作用: 提供至少一个有效动态源和脚本到 manifest 映射。
  const graph = createDynamicSourceGraph();
  // 类型: BrowserPersistenceDatabase；作用: 当前用例唯一连接门面。
  const database = createDatabase(databaseName);
  await initializeDatabase(database, graph.seeds);
  // 类型: object；作用: 当前数据库创建的正式三仓和原生 UnitOfWork。
  const repositories = createIndexedDbSourceRepositories({ database });
  // 类型: object；作用: 第一次恢复的首个工厂只通过 Loader 复核，若未释放则重试投影不可 ready。
  const executor = createTestModuleExecutor(graph.manifestByScript, {
    firstFactorySingleSupport: true
  });
  // 类型: object；作用: 只替换 Definition 读取端口为一次性失败代理，其他仓保持同一实例。
  const failingRepositories = {
    ...repositories,
    definitionRepository: createFailingDefinitionRepository(repositories.definitionRepository)
  };
  // 类型: object；作用: 同一 Bundle 先经历失败补偿，再通过公开 initialize 显式重试。
  const runtime = createRuntime(failingRepositories, executor.moduleExecutor).sourceRuntime;

  await assert.rejects(
    () => runtime.initialize(),
    error => error && error.code === 'SOURCE_RUNTIME_INITIALIZATION_ERROR'
  );
  // 类型: object；作用: 保存释放后第二轮注册和 Manager 初始化成功的投影。
  const recoveredState = await runtime.initialize();

  assert.deepEqual(
    executor.executedSourceIds,
    [...graph.validSourceIds, ...graph.validSourceIds]
  );
  graph.validSourceIds.forEach((sourceId) => {
    assert.equal(
      findRecord(recoveredState, sourceId).runtime.providerReadiness.status,
      PROVIDER_READINESS_STATUS.ready
    );
  });
  assert.equal(recoveredState.defaultSourceId, graph.validSourceIds[0]);
  await database.deleteDatabase();
});
