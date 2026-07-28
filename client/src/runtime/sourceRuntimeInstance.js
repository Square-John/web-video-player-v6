/*
  sourceRuntimeInstance.js 模块说明

  - 文件职责:
      创建应用内容链、筛选链和设置管理链共同使用的唯一 Runtime Bundle。
      从集中网络模式创建唯一 NetworkAdapter，并创建应用唯一挑战协调器。
      从同一基础设施图导出内容、设置管理、挑战交互和用户内容持久化裁剪门面。
      防止多个 service 分别创建底层基础设施，或在调用失败后切换网络模式。

  - 导入库及文件汇总(10 条，内置 0 条，第三方 0 条，自定义 10 条):
      createSourceRuntimeBundle: 自定义服务，组合当前应用的数据源保存、事务、Shell、执行宿主和两个裁剪门面。
      createSourceChallengeCoordinator: 自定义协调器工厂，提供 Shell 请求端与页面交互端的权限分离。
      SOURCE_NETWORK_RUNTIME_CONFIG: 自定义配置，提供应用显式 proxy/mock 模式。
      createSourceNetworkAdapter: 自定义工厂，按集中模式只创建一个 NetworkAdapter。
      LEGACY_PRODUCT_SOURCE_IDS/sourceRepositorySeeds: 自定义数据，提供 v3 精确清理身份和真正空库 Source 种子。
      userContentMockData: 自定义数据，提供真正空库的一次性游客内容种子。
      BrowserPersistenceDatabase/BROWSER_PERSISTENCE_SEED_VERSION: 自定义持久化底座，管理唯一数据库连接和种子版本。
      createIndexedDbSourceRepositories: 自定义工厂，创建正式浏览器三仓和原生 UnitOfWork。
      createIndexedDbUserContentRepository: 自定义工厂，创建共享数据库上的用户内容 Repository。

  - 模块级常量:
      sourceNetworkAdapter: object，应用进程内唯一显式网络适配器。
      sourceChallengeCoordinator: object，应用进程内唯一人工挑战队列和端口集合。
      browserPersistenceDatabase: BrowserPersistenceDatabase，应用进程内唯一数据库门面。
      sourceRepositories: object，应用进程内显式选择的 Repository 基础设施。
      userContentRepository: object，应用进程内唯一用户内容 Repository。
      sourceRuntimeBundle: object，应用进程内唯一 Runtime Bundle，仅在当前模块持有。
      sourceRuntimeInstance: object，应用进程内共享的冻结 SourceRuntime 门面。
      sourceManagementRuntimeInstance: object，应用进程内共享的冻结完整设置管理门面。
      sourceChallengeInteractionInstance: object，应用进程内共享的冻结挑战交互门面。

  - 模块级变量:
      无

  - 模块级辅助函数:
      initializeSourcePersistence(): 打开数据库、执行迁移和真正空库首次种子。
      initializeUserContentPersistence(): 复用数据库屏障并读取游客保存投影。
      loadUserContentState(userId): 读取指定用户完整保存投影。
      saveUserContentProfile(user): 保存用户资料。
      saveUserFavorites(userId, favorites): 原子替换用户收藏。
      saveUserPlayHistory(userId, playHistory): 原子替换用户历史。
      saveUserResumePolicy(userId, resumePolicy): 保存用户恢复策略。
      loadUserShortcutPreferences(userId): 读取用户快捷键偏好。
      saveUserShortcutPreferences(userId, shortcutPreferences): 保存用户快捷键偏好。

  - 模块级类:
      无

  - 对外导出:
      sourceRuntimeInstance: object，供内容和筛选 service 复用的唯一内容 Runtime 门面。
      sourceManagementRuntimeInstance: object，供设置适配层复用的同 Bundle 完整管理门面。
      sourceChallengeInteractionInstance: object，供挑战 service 订阅、提交和取消当前挑战。
      userContentPersistenceInstance: object，供用户内容 service 初始化和提交长期状态。
      shortcutSettingsPersistenceInstance: object，供快捷键设置 service 读取和保存偏好。
*/

// 导入来源: ./createSourceRuntime.js。
// 导入内容: createSourceRuntimeBundle 应用基础设施组合工厂。
// 文件作用: 在当前模块首次加载时一次创建内容与设置管理共用的底层对象。
import { createSourceRuntimeBundle } from './createSourceRuntime.js';

// 导入来源: ./source-challenge/sourceChallengeCoordinator.js。
// 导入内容: createSourceChallengeCoordinator 全局挑战协调器工厂。
// 文件作用: 在应用模块图内创建唯一 FIFO，并把请求端和交互端分别交给 Runtime 与 service。
import { createSourceChallengeCoordinator } from './source-challenge/sourceChallengeCoordinator.js';

// 导入来源: ./source-network/sourceNetwork.config.js。
// 导入内容: SOURCE_NETWORK_RUNTIME_CONFIG 应用网络模式配置。
// 文件作用: 默认明确选择 ProxyClient，只有环境显式声明 mock 才使用模拟适配器。
import { SOURCE_NETWORK_RUNTIME_CONFIG } from './source-network/sourceNetwork.config.js';

// 导入来源: ./source-network/sourceNetworkAdapterFactory.js。
// 导入内容: createSourceNetworkAdapter 模式工厂。
// 文件作用: 在 Runtime 创建前完成一次模式选择，失败后不建立第二适配器。
import { createSourceNetworkAdapter } from './source-network/sourceNetworkAdapterFactory.js';

import {
  // 导入来源: ../data/settings/source-repository.seed.js。
  // 导入内容: LEGACY_PRODUCT_SOURCE_IDS 旧产品模拟身份冻结集合。
  // 文件作用: 只允许 v3 迁移精确删除已知旧记录及其悬空用户引用。
  LEGACY_PRODUCT_SOURCE_IDS,
  // 导入来源: ../data/settings/source-repository.seed.js。
  // 导入内容: sourceRepositorySeeds 四条真实系统源保存图。
  // 文件作用: 真正空库首次种子与 v3 冲突替换共用同一产品事实。
  sourceRepositorySeeds
} from '../data/settings/source-repository.seed.js';

// 导入来源: ../data/user-content.mock.js；导入内容: userContentMockData；文件作用: 只在真正空库写入一次游客内容种子。
import { userContentMockData } from '../data/user-content.mock.js';

// 导入来源: ../repositories/persistence/browserPersistenceDatabase.js；导入内容: BrowserPersistenceDatabase；文件作用: 创建应用唯一 IndexedDB 门面。
import { BrowserPersistenceDatabase } from '../repositories/persistence/browserPersistenceDatabase.js';

// 导入来源: ../repositories/persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_SEED_VERSION；文件作用: 为首次种子记录集中版本事实。
import { BROWSER_PERSISTENCE_SEED_VERSION } from '../repositories/persistence/browserPersistence.config.js';

// 导入来源: ../repositories/source/createIndexedDbSourceRepositories.js；导入内容: createIndexedDbSourceRepositories；文件作用: 从唯一数据库门面创建正式三仓和 UnitOfWork。
import { createIndexedDbSourceRepositories } from '../repositories/source/createIndexedDbSourceRepositories.js';

// 导入来源: ../repositories/user-content/createIndexedDbUserContentRepository.js。
// 导入内容: createIndexedDbUserContentRepository 用户内容 Repository 工厂。
// 文件作用: 从应用唯一数据库门面创建正式四仓适配器。
import { createIndexedDbUserContentRepository } from '../repositories/user-content/createIndexedDbUserContentRepository.js';

// 类型: Readonly<object>。
// 作用: 保存应用模块图内唯一 NetworkAdapter；生产/联调默认 ProxyClient，显式 Mock 模式也只创建一次。
// 副作用: 模块首次加载时创建适配器内部只读配置或夹具索引，尚不发送网络请求。
const sourceNetworkAdapter = createSourceNetworkAdapter(SOURCE_NETWORK_RUNTIME_CONFIG);

// 类型: object。
// 作用: 保存应用生命周期内唯一挑战队列；页面刷新释放整个模块图，路由切换不创建第二协调器。
// 副作用: 模块首次加载时只创建空监听器和空队列，尚不发布挑战或注册 AbortSignal。
const sourceChallengeCoordinator = createSourceChallengeCoordinator();

// 类型: BrowserPersistenceDatabase。
// 作用: 保存当前应用模块图唯一 IndexedDB 连接门面；连接只由 Runtime 初始化屏障打开。
const browserPersistenceDatabase = new BrowserPersistenceDatabase();

// 类型: object。
// 作用: 保存应用组合层从唯一数据库门面创建的正式 IndexedDB 三仓和 UnitOfWork。
// 失败边界: 数据库不可用时方法明确失败，不创建 Memory、localStorage 或其他适配器接管。
const sourceRepositories = createIndexedDbSourceRepositories({ database: browserPersistenceDatabase });

// 类型: IndexedDbUserContentRepository。
// 作用: 保存应用生命周期内唯一用户内容 Repository，与 Source 三仓共享数据库连接和首次种子事务。
// 失败边界: 数据库不可用时方法明确 reject，不读取 mock 覆盖保存结果。
const userContentRepository = createIndexedDbUserContentRepository({
  database: browserPersistenceDatabase
});

/**
 * 初始化应用唯一浏览器持久化基础设施。
 * 副作用: 打开 IndexedDB、执行连续 schema 迁移，并仅在真正空库原子写入 Source/UserContent 种子。
 * 成功路径: Repository 可以读取保存图后 resolve；并发调用由数据库门面复用同一 Promise。
 * 失败路径: 连接、迁移、种子、配额或损坏错误原样 reject，Runtime 不初始化 Manager 或回退 Memory。
 *
 * @returns {Promise<void>} 数据库保存图可用时完成。
 */
async function initializeSourcePersistence() {
  await browserPersistenceDatabase.initialize({
    sourceSeeds: sourceRepositorySeeds,
    userContentSeed: userContentMockData,
    seedVersion: BROWSER_PERSISTENCE_SEED_VERSION,
    legacyProductSourceIds: LEGACY_PRODUCT_SOURCE_IDS
  });
}

/**
 * 初始化用户内容持久化投影。
 * 副作用: 复用应用唯一数据库初始化屏障，随后只读取首次种子用户的四仓保存图。
 * 成功路径: 返回 currentPlaying=null 的完整隔离 UserContentState。
 * 失败路径: 数据库、种子或保存对象损坏时 reject，不重新播种或采用内存 mock。
 *
 * @returns {Promise<object>} 当前本地游客完整用户内容状态。
 */
async function initializeUserContentPersistence() {
  await initializeSourcePersistence();
  return userContentRepository.initialize(userContentMockData);
}

/**
 * 读取指定用户完整持久化状态。
 * 副作用: 只读四个用户内容仓，不修改页面或数据库。
 * 成功路径: 返回隔离状态或不存在时返回 null。
 * 失败路径: 数据库和保存对象损坏错误原样 reject。
 *
 * @param {string} userId 目标用户 id。
 * @returns {Promise<object|null>} 完整状态或 null。
 */
function loadUserContentState(userId) {
  return userContentRepository.loadState(userId);
}

/**
 * 保存用户资料。
 * 副作用: 委托唯一 Repository 提交 userProfiles 事务。
 * 成功路径: 返回已提交资料副本。
 * 失败路径: 候选或事务失败时 reject，调用方保持旧投影。
 *
 * @param {object} user 用户资料候选。
 * @returns {Promise<object>} 已提交资料。
 */
function saveUserContentProfile(user) {
  return userContentRepository.saveProfile(user);
}

/**
 * 原子替换用户收藏集合。
 * 副作用: 委托唯一 Repository 替换该 userId 全部收藏行。
 * 成功路径: 返回已提交集合。
 * 失败路径: transaction abort 并 reject，调用方保持旧投影。
 *
 * @param {string} userId 目标用户 id。
 * @param {object} favorites 完整收藏集合。
 * @returns {Promise<object>} 已提交收藏集合。
 */
function saveUserFavorites(userId, favorites) {
  return userContentRepository.saveFavorites(userId, favorites);
}

/**
 * 原子替换用户播放历史集合。
 * 副作用: 委托唯一 Repository 替换该 userId 全部历史行。
 * 成功路径: 返回已提交集合。
 * 失败路径: transaction abort 并 reject，调用方保持旧投影。
 *
 * @param {string} userId 目标用户 id。
 * @param {object} playHistory 完整历史集合。
 * @returns {Promise<object>} 已提交历史集合。
 */
function saveUserPlayHistory(userId, playHistory) {
  return userContentRepository.savePlayHistory(userId, playHistory);
}

/**
 * 保存用户播放恢复策略。
 * 副作用: 委托唯一 Repository 覆盖该 userId 的 userSettings 单例。
 * 成功路径: 返回已提交策略。
 * 失败路径: 候选或事务失败时 reject，调用方保持旧投影。
 *
 * @param {string} userId 目标用户 id。
 * @param {object} resumePolicy 恢复策略候选。
 * @returns {Promise<object>} 已提交策略。
 */
function saveUserResumePolicy(userId, resumePolicy) {
  return userContentRepository.saveResumePolicy(userId, resumePolicy);
}

/**
 * 读取用户快捷键偏好。
 * 副作用: 委托唯一 Repository 读取该 userId 的 userSettings 单例，不修改恢复策略。
 * 成功路径: 返回已验证隔离 ShortcutPreferences。
 * 失败路径: 设置行缺失、损坏或数据库不可用时 reject。
 *
 * @param {string} userId 目标用户 id。
 * @returns {Promise<object>} 已保存快捷键偏好。
 */
function loadUserShortcutPreferences(userId) {
  return userContentRepository.loadShortcutPreferences(userId);
}

/**
 * 保存用户快捷键偏好。
 * 副作用: 委托唯一 Repository 在 userSettings 事务中保留恢复策略并替换快捷键偏好。
 * 成功路径: 返回已提交隔离 ShortcutPreferences。
 * 失败路径: 候选或事务失败时 reject，调用方保持旧投影。
 *
 * @param {string} userId 目标用户 id。
 * @param {object} shortcutPreferences 快捷键偏好候选。
 * @returns {Promise<object>} 已提交快捷键偏好。
 */
function saveUserShortcutPreferences(userId, shortcutPreferences) {
  return userContentRepository.saveShortcutPreferences(userId, shortcutPreferences);
}

// 类型: object。
// 作用: 保存应用模块图内唯一 Runtime Bundle；只在当前组合实例模块拆出两个公开门面，不向 service 导出 Bundle 本身。
// 副作用: 模块首次加载时组合 Repository、SourceManager、空工厂注册表和 SourceExecutionHost；初始化时系统源与自定义源都从保存脚本文本恢复。
const sourceRuntimeBundle = createSourceRuntimeBundle({
  networkAdapter: sourceNetworkAdapter,
  challengeRequestPort: sourceChallengeCoordinator.requestPort,
  repositories: sourceRepositories,
  initializeInfrastructure: initializeSourcePersistence,
  activeSourceId: ''
});

// 类型: object。
// 作用: 保存应用模块图内唯一的冻结 SourceRuntime 门面，内容和筛选请求共享同一初始化 Promise、Host 和 Provider 实例。
// 来源: sourceRuntimeBundle.sourceRuntime，由当前模块唯一 Bundle 裁剪。
export const sourceRuntimeInstance = sourceRuntimeBundle.sourceRuntime;

// 类型: object。
// 作用: 保存应用模块图内唯一完整设置管理门面，与内容门面共享初始化 Promise、SourceManager、Host、Repository、输入适配器和更新端口。
// 来源: sourceRuntimeBundle.sourceManagementRuntime；7C 提供设置意图 FIFO、Manager 委托、Host 补偿、导入更新和最小导出能力。
export const sourceManagementRuntimeInstance = sourceRuntimeBundle.sourceManagementRuntime;

// 类型: object。
// 作用: 保存页面侧冻结交互门面，只提供 subscribe、resolve 和 cancel，不暴露请求队列或释放入口。
// 来源: 应用唯一 sourceChallengeCoordinator.interactionPort，由 sourceChallengeService 统一采用。
export const sourceChallengeInteractionInstance = sourceChallengeCoordinator.interactionPort;

// 类型: Readonly<object>。
// 作用: 向 userContentService 提供初始化、读取和四类提交能力，不泄漏 Repository 实例或数据库连接。
// 失败边界: 所有异步失败原样传播，调用方只能在提交成功后采用响应式投影。
export const userContentPersistenceInstance = Object.freeze({
  initialize: initializeUserContentPersistence,
  loadState: loadUserContentState,
  saveProfile: saveUserContentProfile,
  saveFavorites: saveUserFavorites,
  savePlayHistory: saveUserPlayHistory,
  saveResumePolicy: saveUserResumePolicy
});

// 类型: Readonly<object>。
// 作用: 向 shortcutSettingsService 只提供快捷键读取和保存端口，不泄漏用户内容其他写能力、Repository 或数据库。
// 失败边界: 读取或事务失败原样传播，service 只能在提交成功后采用响应式投影。
export const shortcutSettingsPersistenceInstance = Object.freeze({
  loadShortcutPreferences: loadUserShortcutPreferences,
  saveShortcutPreferences: saveUserShortcutPreferences
});
