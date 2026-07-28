/*
  sourceRuntimeInstance.js 模块说明

  - 文件职责:
      创建应用内容链、筛选链和设置管理链共同使用的唯一 Runtime Bundle。
      从集中网络模式创建唯一 NetworkAdapter，并创建应用唯一挑战协调器。
      从同一基础设施图导出内容、设置管理、挑战交互和用户内容持久化裁剪门面。
      防止多个 service 分别创建底层基础设施，或在调用失败后切换网络模式。

  - 导入库及文件汇总(11 条，内置 0 条，第三方 0 条，自定义 11 条):
      createSourceRuntimeBundle: 自定义服务，组合当前应用的数据源保存、事务、Shell、执行宿主和两个裁剪门面。
      createSourceChallengeCoordinator: 自定义协调器工厂，提供 Shell 请求端与页面交互端的权限分离。
      SOURCE_NETWORK_RUNTIME_CONFIG: 自定义配置，提供应用显式 proxy/mock 模式。
      createSourceNetworkAdapter: 自定义工厂，按集中模式只创建一个 NetworkAdapter。
      builtinSourceCatalogRelease/LEGACY_PRODUCT_SOURCE_IDS/RETIRED_BUILTIN_SOURCE_IDS/sourceRepositorySeeds: 自定义数据，提供目录发布身份、迁移边界和 Source 种子。
      userContentMockData: 自定义数据，提供真正空库的一次性游客内容种子。
      BrowserPersistenceDatabase: 自定义持久化底座，管理唯一数据库连接、首次种子和 Runtime 前目录对账。
      createIndexedDbSourceRepositories: 自定义工厂，创建正式浏览器三仓和原生 UnitOfWork。
      createIndexedDbUserContentRepository: 自定义工厂，创建共享数据库上的用户内容 Repository。
      createSourceSelectionSessionStorage: 自定义适配器工厂，把当前活动源限制在标签页 sessionStorage 生命周期。
      assertSafeRecordKey: 自定义通用记录键校验，恢复会话值进入 Runtime 前拒绝危险身份。

  - 模块级常量:
      sourceNetworkAdapter: object，应用进程内唯一显式网络适配器。
      sourceChallengeCoordinator: object，应用进程内唯一人工挑战队列和端口集合。
      browserPersistenceDatabase: BrowserPersistenceDatabase，应用进程内唯一数据库门面。
      sourceRepositories: object，应用进程内显式选择的 Repository 基础设施。
      userContentRepository: object，应用进程内唯一用户内容 Repository。
      sourceSelectionSessionStorage: object|null，当前标签页活动源会话适配器；无浏览器能力时为 null。
      restoredActiveSourceId: string，经过通用安全校验的 Runtime 初始活动源候选。
      sourceRuntimeBundle: object，应用进程内唯一 Runtime Bundle，仅在当前模块持有。
      sourceRuntimeInstance: object，应用进程内共享的冻结 SourceRuntime 门面。
      sourceManagementRuntimeInstance: object，应用进程内共享的冻结完整设置管理门面。
      sourceChallengeInteractionInstance: object，应用进程内共享的冻结挑战交互门面。

  - 模块级变量:
      无

  - 模块级辅助函数:
      initializeSourcePersistence(): 打开数据库、执行迁移、真正空库首次种子和内置目录启动对账。
      createBrowserSourceSelectionSessionStorage(): 在组合根绑定浏览器 sessionStorage；不可用时关闭会话恢复能力。
      loadRestoredActiveSourceId(): 读取并校验标签页活动源候选；损坏值清理后返回空身份。
      synchronizeActiveSourceSession(sourceManagerState): 用 Manager 已裁决投影覆盖或清理标签页活动源。
      initializeUserContentPersistence(): 复用数据库屏障并读取游客保存投影。
      loadUserContentState(userId): 读取指定用户完整保存投影。
      saveUserContentProfile(user): 保存用户资料。
      saveUserFavorites(userId, favorites): 原子替换用户收藏。
      saveUserPlayHistory(userId, playHistory): 原子替换用户历史。
      saveUserContentCollections(userId, favorites, playHistory): 在一个事务中原子替换收藏与历史。
      saveUserResumePolicy(userId, resumePolicy): 保存用户恢复策略。
      loadUserShortcutPreferences(userId): 读取用户快捷键偏好。
      saveUserShortcutPreferences(userId, shortcutPreferences): 保存用户快捷键偏好。
      loadUserHomeDisplayPreferences(userId): 读取首页展示偏好。
      saveUserHomeDisplayPreferences(userId, homeDisplayPreferences): 保存首页展示偏好。

  - 模块级类:
      无

  - 对外导出:
      sourceRuntimeInstance: object，供内容和筛选 service 复用的唯一内容 Runtime 门面。
      sourceManagementRuntimeInstance: object，供设置适配层复用的同 Bundle 完整管理门面。
      sourceChallengeInteractionInstance: object，供挑战 service 订阅、提交和取消当前挑战。
      userContentPersistenceInstance: object，供用户内容 service 初始化和提交长期状态。
      shortcutSettingsPersistenceInstance: object，供快捷键设置 service 读取和保存偏好。
      homeDisplaySettingsPersistenceInstance: object，供界面设置 service 读取和保存首页展示偏好。
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
  // 导入内容: builtinSourceCatalogRelease 当前内置目录独立发布身份。
  // 文件作用: 让数据库在 Runtime 恢复 Provider 前比较 revision 和 fingerprint 并原子采用新脚本。
  builtinSourceCatalogRelease,
  // 导入来源: ../data/settings/source-repository.seed.js。
  // 导入内容: LEGACY_PRODUCT_SOURCE_IDS 旧产品模拟身份冻结集合。
  // 文件作用: 只允许 v3 迁移精确删除已知旧记录及其悬空用户引用。
  LEGACY_PRODUCT_SOURCE_IDS,
  // 导入来源: ../data/settings/source-repository.seed.js。
  // 导入内容: RETIRED_BUILTIN_SOURCE_IDS 产品退役系统身份冻结集合。
  // 文件作用: 只允许 v20 迁移清理明确退役源的 Source 保存图和私有缓存，用户内容继续保留。
  RETIRED_BUILTIN_SOURCE_IDS,
  // 导入来源: ../data/settings/source-repository.seed.js。
  // 导入内容: sourceRepositorySeeds 当前真实系统源保存图。
  // 文件作用: 真正空库首次种子与 v3 冲突替换共用同一产品事实。
  sourceRepositorySeeds
} from '../data/settings/source-repository.seed.js';

// 导入来源: ../data/user-content.mock.js；导入内容: userContentMockData；文件作用: 只在真正空库写入一次游客内容种子。
import { userContentMockData } from '../data/user-content.mock.js';

// 导入来源: ../repositories/persistence/browserPersistenceDatabase.js；导入内容: BrowserPersistenceDatabase；文件作用: 创建应用唯一 IndexedDB 门面。
import { BrowserPersistenceDatabase } from '../repositories/persistence/browserPersistenceDatabase.js';

// 导入来源: ../repositories/source/createIndexedDbSourceRepositories.js；导入内容: createIndexedDbSourceRepositories；文件作用: 从唯一数据库门面创建正式三仓和 UnitOfWork。
import { createIndexedDbSourceRepositories } from '../repositories/source/createIndexedDbSourceRepositories.js';

// 导入来源: ../repositories/user-content/createIndexedDbUserContentRepository.js。
// 导入内容: createIndexedDbUserContentRepository 用户内容 Repository 工厂。
// 文件作用: 从应用唯一数据库门面创建正式四仓适配器。
import { createIndexedDbUserContentRepository } from '../repositories/user-content/createIndexedDbUserContentRepository.js';

// 导入来源: ../repositories/persistence/sourceSelectionSessionStorage.js。
// 导入内容: createSourceSelectionSessionStorage 注入式会话适配器工厂。
// 文件作用: 在当前组合根绑定 window.sessionStorage，不让 Runtime、Manager、Store 或页面直接访问浏览器存储。
import { createSourceSelectionSessionStorage } from '../repositories/persistence/sourceSelectionSessionStorage.js';

// 导入来源: ../repositories/source/sourceRepositoryValidators.js。
// 导入内容: assertSafeRecordKey 通用动态键校验函数。
// 文件作用: 会话候选进入 Runtime 构造前拒绝空白和原型敏感身份，站点可选性仍由 Manager 初始化投影裁决。
import { assertSafeRecordKey } from '../repositories/source/sourceRepositoryValidators.js';

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
 * 在应用组合根创建浏览器活动源会话适配器。
 * 副作用: 只读取一次 window.sessionStorage 引用；不读写任何会话键。
 * 成功路径: 浏览器提供可访问 sessionStorage 时返回注入式适配器。
 * 失败路径: SSR、Node 测试或浏览器安全策略不允许访问时返回 null；不会建立 Memory、localStorage 或 IndexedDB 回退。
 *
 * @returns {Readonly<object>|null} 当前标签页会话适配器；浏览器能力不可用时为 null。
 */
function createBrowserSourceSelectionSessionStorage() {
  // 条件分支: 当前模块不在浏览器 window 环境中执行时进入。
  // 执行内容: 显式关闭可选会话恢复能力。
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // 浏览器边界: sessionStorage 由当前标签页拥有；关闭标签页后浏览器结束其生命周期。
    return createSourceSelectionSessionStorage({ storage: window.sessionStorage });
  } catch {
    // 失败边界: 浏览器拒绝会话存储时继续使用 Manager 默认源，不切换到其他保存实现。
    return null;
  }
}

// 类型: Readonly<object>|null。
// 作用: 保存当前应用模块图唯一标签页会话适配器；null 表示本次环境不提供该可选浏览器能力。
const sourceSelectionSessionStorage = createBrowserSourceSelectionSessionStorage();

/**
 * 读取并校验本标签页上次采用的活动源身份。
 * 副作用: 读取唯一 sessionStorage 键；值不满足通用记录键约束时尝试清理该键。
 * 成功路径: 返回安全身份交给 SourceManager 初始化保存图后裁决是否仍可选。
 * 失败路径: 适配器缺失、读取失败或身份损坏时返回空字符串；不创建其他保存回退。
 *
 * @returns {string} Runtime 初始活动源候选；没有可恢复身份时为空字符串。
 */
function loadRestoredActiveSourceId() {
  // 条件分支: 当前环境没有可用标签页会话适配器时进入。
  // 执行内容: 交给 Manager 采用 defaultSourceId。
  if (!sourceSelectionSessionStorage) {
    return '';
  }

  try {
    // 类型: string；作用: 读取会话候选，空字符串表示当前标签页尚未产生活动源选择。
    const storedSourceId = sourceSelectionSessionStorage.loadActiveSourceId();

    // 条件分支: 会话键不存在时进入。
    // 执行内容: 直接返回空身份，不调用记录键校验制造缺值错误。
    if (storedSourceId === '') {
      return '';
    }

    // 返回值类型: string；作用: 只完成通用键安全校验，存在、启用、授权和可执行性留给 Manager 完整投影。
    return assertSafeRecordKey(storedSourceId, 'sourceSelectionSession.activeSourceId');
  } catch {
    try {
      // 失败补偿: 损坏值或读取异常后清理唯一会话键，下一次刷新不重复注入同一失败候选。
      sourceSelectionSessionStorage.clearActiveSourceId();
    } catch {
      // 清理失败边界: 浏览器存储仍不可用时保持无恢复能力，不切换存储或阻断长期数据初始化。
    }
    return '';
  }
}

/**
 * 使用 SourceManager 已裁决的完整投影同步标签页活动源。
 * 调用方: 当前组合根对唯一 SourceManagementRuntime 建立的应用生命周期订阅。
 * 副作用: 非空 activeSourceId 写入 sessionStorage，空值清理唯一键；不写长期数据库或 Provider 私有空间。
 * 成功路径: 当前标签页刷新后可以把最近采用源重新交给 Runtime 初始化。
 * 失败路径: 浏览器会话存储不可用时忽略本次可选同步；Manager、页面和长期保存状态保持不变。
 *
 * @param {object} sourceManagerState SourceManager 发布的完整隔离投影。
 * @param {string} sourceManagerState.activeSourceId 当前经过存在、启用和可选性裁决的活动源；空字符串表示清理。
 * @returns {void} 同步尝试完成后结束。
 */
function synchronizeActiveSourceSession(sourceManagerState) {
  // 条件分支: 当前环境没有标签页会话适配器时进入。
  // 执行内容: 不产生任何存储副作用。
  if (!sourceSelectionSessionStorage) {
    return;
  }

  try {
    // 副作用: 只采用 Manager 完整投影中的真实 activeSourceId；空值由适配器转换为移除键。
    sourceSelectionSessionStorage.saveActiveSourceId(sourceManagerState.activeSourceId);
  } catch {
    // 失败边界: 会话偏好写入失败不回滚已完成领域事务，也不建立第二存储或页面影子状态。
  }
}

// 类型: string。
// 作用: 保存模块创建期读取的标签页活动源候选，仅作为 SourceManager 构造输入使用一次。
const restoredActiveSourceId = loadRestoredActiveSourceId();

/**
 * 初始化应用唯一浏览器持久化基础设施。
 * 副作用: 打开 IndexedDB、执行连续 schema 迁移、真正空库种子，并在四仓事务中对账独立内置目录发布。
 * 成功路径: 当前 Provider 脚本在 Repository 可读前完成采用；并发调用由数据库门面复用同一 Promise。
 * 失败路径: 连接、迁移、种子、发布冲突、配额或损坏错误原样 reject，Runtime 不恢复旧 Provider 或回退 Memory。
 *
 * @returns {Promise<void>} 数据库保存图可用时完成。
 */
async function initializeSourcePersistence() {
  await browserPersistenceDatabase.initialize({
    sourceSeeds: sourceRepositorySeeds,
    userContentSeed: userContentMockData,
    builtinCatalogRelease: builtinSourceCatalogRelease,
    legacyProductSourceIds: LEGACY_PRODUCT_SOURCE_IDS,
    retiredBuiltinSourceIds: RETIRED_BUILTIN_SOURCE_IDS
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
 * 原子替换用户收藏与播放历史两个集合。
 * 副作用: 委托唯一 Repository 在 userFavorites 和 userPlayHistory 双仓事务中提交完整候选。
 * 成功路径: 两个集合同时提交后返回隔离投影。
 * 失败路径: 任一删除或写入失败时整个事务回滚，调用方继续保留两个旧投影。
 *
 * @param {string} userId 目标用户 id。
 * @param {object} favorites 完整收藏集合。
 * @param {object} playHistory 完整播放历史集合。
 * @returns {Promise<object>} 已提交 favorites 和 playHistory。
 */
function saveUserContentCollections(userId, favorites, playHistory) {
  return userContentRepository.saveCollections(userId, favorites, playHistory);
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

/**
 * 读取用户首页展示偏好。
 * 副作用: 委托唯一 Repository 读取该 userId 的 userSettings 单例，不修改其他设置。
 * 成功路径: 返回已验证隔离 HomeDisplayPreferences。
 * 失败路径: 设置行损坏、数据库不可用或用户不存在时 reject。
 *
 * @param {string} userId 目标用户 id。
 * @returns {Promise<object>} 已保存首页展示偏好。
 */
function loadUserHomeDisplayPreferences(userId) {
  return userContentRepository.loadHomeDisplayPreferences(userId);
}

/**
 * 保存用户首页展示偏好。
 * 副作用: 委托唯一 Repository 在 userSettings 事务中保留其他设置并替换展示偏好。
 * 成功路径: 返回已提交隔离 HomeDisplayPreferences。
 * 失败路径: 候选或事务失败时 reject，调用方保持旧投影。
 *
 * @param {string} userId 目标用户 id。
 * @param {object} homeDisplayPreferences 首页展示偏好候选。
 * @returns {Promise<object>} 已提交首页展示偏好。
 */
function saveUserHomeDisplayPreferences(userId, homeDisplayPreferences) {
  return userContentRepository.saveHomeDisplayPreferences(userId, homeDisplayPreferences);
}

// 类型: object。
// 作用: 保存应用模块图内唯一 Runtime Bundle；只在当前组合实例模块拆出两个公开门面，不向 service 导出 Bundle 本身。
// 副作用: 模块首次加载时组合 Repository、SourceManager、空工厂注册表和 SourceExecutionHost；初始化时系统源与自定义源都从保存脚本文本恢复。
const sourceRuntimeBundle = createSourceRuntimeBundle({
  networkAdapter: sourceNetworkAdapter,
  challengeRequestPort: sourceChallengeCoordinator.requestPort,
  repositories: sourceRepositories,
  initializeInfrastructure: initializeSourcePersistence,
  activeSourceId: restoredActiveSourceId
});

// 副作用: 在应用初始化前订阅唯一 Manager 投影；首份稳定投影会校正无效会话候选，后续切换同步当前标签页选择。
// 资源边界: 订阅与应用模块图同生命周期，页面路由切换不重复注册；浏览器刷新统一释放监听器。
sourceRuntimeBundle.sourceManagementRuntime.subscribe(synchronizeActiveSourceSession);

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
// 作用: 向 userContentService 提供初始化、读取、单仓提交和跨源恢复双仓提交能力，不泄漏 Repository 实例或数据库连接。
// 失败边界: 所有异步失败原样传播，调用方只能在提交成功后采用响应式投影。
export const userContentPersistenceInstance = Object.freeze({
  initialize: initializeUserContentPersistence,
  loadState: loadUserContentState,
  saveProfile: saveUserContentProfile,
  saveFavorites: saveUserFavorites,
  savePlayHistory: saveUserPlayHistory,
  saveCollections: saveUserContentCollections,
  saveResumePolicy: saveUserResumePolicy
});

// 类型: Readonly<object>。
// 作用: 向 shortcutSettingsService 只提供快捷键读取和保存端口，不泄漏用户内容其他写能力、Repository 或数据库。
// 失败边界: 读取或事务失败原样传播，service 只能在提交成功后采用响应式投影。
export const shortcutSettingsPersistenceInstance = Object.freeze({
  loadShortcutPreferences: loadUserShortcutPreferences,
  saveShortcutPreferences: saveUserShortcutPreferences
});

// 类型: Readonly<object>；作用: 向 homeDisplaySettingsService 只提供首页展示偏好读取和保存端口。
// 失败边界: Repository 和数据库错误原样传播，Service 只能在提交成功后采用响应式投影。
export const homeDisplaySettingsPersistenceInstance = Object.freeze({
  loadHomeDisplayPreferences: loadUserHomeDisplayPreferences,
  saveHomeDisplayPreferences: saveUserHomeDisplayPreferences
});
