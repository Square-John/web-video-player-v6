/*
  browserPersistence.config.js 模块说明

  - 文件职责:
      集中定义浏览器持久化数据库名称、整数版本、九个 object store、索引和元信息键。
      供 BrowserPersistenceDatabase 与 IndexedDB Repository 共用，禁止各适配器散落数据库魔法字符串。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      BROWSER_PERSISTENCE_DATABASE_NAME: string，当前 origin 下唯一数据库名称。
      BROWSER_PERSISTENCE_SCHEMA_VERSION: object，连续迁移步骤的稳定整数版本。
      BROWSER_PERSISTENCE_DATABASE_VERSION: number，IndexedDB schema 整数版本。
      BROWSER_PERSISTENCE_SEED_VERSION: string，当前系统首次种子版本。
      BROWSER_PERSISTENCE_STORE: object，九个 object store 名称。
      BROWSER_PERSISTENCE_INDEX: object，复合查询使用的索引名称。
      BROWSER_PERSISTENCE_META_KEY: object，初始化和种子版本元信息键。
      SOURCE_PREFERENCES_RECORD_KEY: string，SourcePreferences 单例记录键。
      SOURCE_PERSISTENCE_STORE_NAMES: Array<string>，数据源原子事务覆盖的四个 store。
      BROWSER_PERSISTENCE_BUSINESS_STORE_NAMES: Array<string>，空库判定使用的八个业务 store。
      BROWSER_PERSISTENCE_ALL_STORE_NAMES: Array<string>，数据库全部 store 稳定顺序。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      全部模块级常量，供数据库门面、Repository 和测试共享同一 schema 身份。
*/

// 类型: string；作用: 当前 origin 下 Web Video Player 唯一 IndexedDB 数据库名称。
export const BROWSER_PERSISTENCE_DATABASE_NAME = 'web-video-player';

// 类型: object；作用: 为每个连续迁移提供具名整数，禁止在迁移执行器和测试中散落版本魔法值。
export const BROWSER_PERSISTENCE_SCHEMA_VERSION = Object.freeze({
  // 类型: number；作用: 创建九仓和四个正式索引的初始 schema。
  initial: 1,
  // 类型: number；作用: 增加 appMeta schemaVersion 事实并复核初始 schema 完整性。
  lifecycleMetadata: 2,
  // 类型: number；作用: 原子退役旧产品模拟保存图并安装四条内置系统源。
  builtinSourceCatalog: 3,
  // 类型: number；作用: 原子刷新内置目录脚本、Definition 和系统授权指纹，同时保留用户决定与运行数据。
  builtinSourceRefresh: 4,
  // 类型: number；作用: 幂等对账应用拥有的四条系统源，修复开发期历史库中的缺项和陈旧关联。
  builtinSourceReconciliation: 5,
  // 类型: number；作用: 原子发布 系统数据源1 1.0.3 挑战请求语义并同步脚本、Definition 与授权指纹。
  builtinSourceChallengeRefresh: 6,
  // 类型: number；作用: 原子发布 系统数据源1 验证响应成功判定并同步当前脚本、Definition 与系统授权指纹。
  builtinSourceVerificationRefresh: 7,
  // 类型: number；作用: 原子发布 系统数据源1 完整搜索表单 URL 语义并同步脚本、Definition 与系统授权指纹。
  builtinSourceSearchTransactionRefresh: 8,
  // 类型: number；作用: 原子发布四条 Provider ABI 2.0 单文件，同时保留用户决定、私有空间、自定义源和用户内容。
  providerApiVersion2Refresh: 9,
  // 类型: number；作用: 原子发布当前内置 Provider 请求语义，同时保留全部用户决定和保存域。
  builtinSourceRequestPolicyRefresh: 10,
  // 类型: number；作用: 为现有 userSettings 原子补入项目快捷键偏好，不改动恢复策略和其他用户内容。
  userShortcutPreferencesRefresh: 11
});

// 类型: number；作用: IndexedDB 当前目标结构版本，始终指向最后一个连续迁移步骤。
export const BROWSER_PERSISTENCE_DATABASE_VERSION = BROWSER_PERSISTENCE_SCHEMA_VERSION.userShortcutPreferencesRefresh;

// 类型: string；作用: 标识包含当前四条 Provider 与快捷键默认偏好的系统目录及空用户内容首次种子版本。
export const BROWSER_PERSISTENCE_SEED_VERSION = '2.3.0';

// 类型: object；作用: 固定九个 object store 名称，Repository 不接受调用方自定义保存域。
export const BROWSER_PERSISTENCE_STORE = Object.freeze({
  // 类型: string；作用: 保存初始化、种子和领域迁移元信息。
  appMeta: 'appMeta',
  // 类型: string；作用: 保存 SourcePackage，以 packageRef 为主键。
  sourcePackages: 'sourcePackages',
  // 类型: string；作用: 保存 SourceDefinition，以 id 为主键。
  sourceDefinitions: 'sourceDefinitions',
  // 类型: string；作用: 保存唯一 SourcePreferences 包装记录。
  sourcePreferences: 'sourcePreferences',
  // 类型: string；作用: 保存 sourceId、partition、key 复合主键的私有空间条目。
  sourceStorageEntries: 'sourceStorageEntries',
  // 类型: string；作用: 保存本地用户资料。
  userProfiles: 'userProfiles',
  // 类型: string；作用: 保存 userId 与 favoriteKey 复合主键收藏记录。
  userFavorites: 'userFavorites',
  // 类型: string；作用: 保存 userId 与 historyKey 复合主键播放历史。
  userPlayHistory: 'userPlayHistory',
  // 类型: string；作用: 保存 userId 对应的恢复策略与后续用户设置。
  userSettings: 'userSettings'
});

// 类型: object；作用: 固定 Repository 查询和清理所需索引名称，避免与 store 名称或业务字段混用。
export const BROWSER_PERSISTENCE_INDEX = Object.freeze({
  // 类型: string；作用: 按 sourceId 遍历或删除完整私有命名空间。
  sourceStorageBySourceId: 'bySourceId',
  // 类型: string；作用: 按 sourceId 与 partition 遍历或清理单个分区。
  sourceStorageBySourcePartition: 'bySourcePartition',
  // 类型: string；作用: 按 userId 查询当前用户收藏记录。
  userFavoritesByUserId: 'byUserId',
  // 类型: string；作用: 按 userId 查询当前用户播放历史。
  userPlayHistoryByUserId: 'byUserId'
});

// 类型: object；作用: 固定 appMeta 记录键，初始化事实和种子版本不与页面状态混存。
export const BROWSER_PERSISTENCE_META_KEY = Object.freeze({
  // 类型: string；作用: 表示首次空库种子事务已经完整提交。
  initialized: 'initialized',
  // 类型: string；作用: 保存最近成功采用的系统种子版本。
  seedVersion: 'seedVersion',
  // 类型: string；作用: 保存最近成功提交的 IndexedDB schema 整数版本。
  schemaVersion: 'schemaVersion'
});

// 类型: string；作用: SourcePreferences object store 中唯一单例包装记录的固定主键。
export const SOURCE_PREFERENCES_RECORD_KEY = 'global';

// 类型: Array<string>；作用: SourceManager 跨仓事务必须一次覆盖的四个数据源保存域。
export const SOURCE_PERSISTENCE_STORE_NAMES = Object.freeze([
  BROWSER_PERSISTENCE_STORE.sourcePackages,
  BROWSER_PERSISTENCE_STORE.sourceDefinitions,
  BROWSER_PERSISTENCE_STORE.sourcePreferences,
  BROWSER_PERSISTENCE_STORE.sourceStorageEntries
]);

// 类型: Array<string>；作用: 首次种子前判定真正空库，不把 appMeta 自身计入业务数据。
export const BROWSER_PERSISTENCE_BUSINESS_STORE_NAMES = Object.freeze([
  ...SOURCE_PERSISTENCE_STORE_NAMES,
  BROWSER_PERSISTENCE_STORE.userProfiles,
  BROWSER_PERSISTENCE_STORE.userFavorites,
  BROWSER_PERSISTENCE_STORE.userPlayHistory,
  BROWSER_PERSISTENCE_STORE.userSettings
]);

// 类型: Array<string>；作用: 数据库 schema 和测试完整性检查使用的九仓稳定顺序。
export const BROWSER_PERSISTENCE_ALL_STORE_NAMES = Object.freeze([
  BROWSER_PERSISTENCE_STORE.appMeta,
  ...BROWSER_PERSISTENCE_BUSINESS_STORE_NAMES
]);
