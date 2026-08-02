/*
  user-content-persistence.integration.test.js 模块说明

  - 文件职责:
      验证 UserContentRepository 四仓保存、跨数据库门面重建、service FIFO 和 Repository-first 投影采用。
      使用 fake-indexeddb 运行正式 BrowserPersistenceDatabase，不以 Memory 或页面 mock 替代事务语义。

  - 导入库及文件汇总(13 条，内置 2 条，第三方 1 条，自定义 10 条):
      fake-indexeddb/auto: 第三方测试环境，在 Node 安装 IndexedDB 全局 API。
      node:assert/strict: 内置断言，验证保存对象与失败不变量。
      node:test: 内置测试运行器，注册异步集成用例。
      USER_CONTENT_RECORD_LIMIT: 自定义配置，验证正式集合上限。
      HOME_CAROUSEL_ITEM_LIMIT: 自定义配置，构造合法非默认轮播数量。
      builtinSourceCatalogRelease/LEGACY_PRODUCT_SOURCE_IDS/RETIRED_BUILTIN_SOURCE_IDS/sourceRepositorySeeds: 自定义目录发布、Source 迁移身份和首次种子，满足九仓初始化输入。
      userContentMockData: 自定义游客种子，只传给空库初始化。
      BrowserPersistenceDatabase: 自定义数据库门面，执行正式 schema 和事务。
      BROWSER_PERSISTENCE_DATABASE_VERSION: 自定义配置，提供当前数据库 schema 版本。
      createIndexedDbUserContentRepository: 自定义工厂，创建正式用户内容 Repository。
      createUserContentService: 自定义工厂，创建隔离写队列和投影端口。
      MEDIA_PLAYBACK_PHASE: 自定义配置，构造真实播放器稳定阶段。
      createMediaPlaybackProgressService: 自定义工厂，把媒体事件协调到现有用户内容写端口。

  - 模块级常量:
      TEST_DATABASE_PREFIX: string，测试数据库唯一名前缀。

  - 模块级变量:
      databaseSequence: number，为每个用例生成隔离数据库名称。

  - 模块级辅助函数:
      clone(value): 隔离测试夹具引用。
      createDatabaseName(label): 创建唯一数据库名称。
      initializeDatabase(database): 使用正式九仓种子初始化门面。
      createRepositoryPort(repository): 裁剪 service 所需 Repository 端口。
      createStatePort(): 创建保持对象身份的测试投影端口。
      createFavoriteRecord(index): 创建严格收藏记录。
      createHistoryPayload(overrides): 创建 service 播放历史输入。
      createPlayHistoryRecord(overrides): 创建 Repository 严格播放历史记录。

  - 模块级类:
      无

  - 对外导出:
      无，测试文件由 node:test 执行。
*/

// 导入来源: fake-indexeddb/auto；导入内容: IndexedDB 全局测试实现；文件作用: 让正式 idb 数据库门面在 Node 中运行。
import 'fake-indexeddb/auto';

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 比较投影、跨重建结果和失败状态。
import assert from 'node:assert/strict';

// 导入来源: node:test；导入内容: test；文件作用: 注册隔离异步集成用例。
import test from 'node:test';

// 导入来源: ../src/config/user-content.config.js；导入内容: USER_CONTENT_RECORD_LIMIT；文件作用: 构造和验证正式上限。
import { USER_CONTENT_RECORD_LIMIT } from '../src/config/user-content.config.js';

// 导入来源: ../src/config/homeDisplay.config.js；导入内容: HOME_CAROUSEL_ITEM_LIMIT；文件作用: 构造合法非默认首页轮播数量。
import { HOME_CAROUSEL_ITEM_LIMIT } from '../src/config/homeDisplay.config.js';

import {
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: builtinSourceCatalogRelease；文件作用: 满足数据库独立目录发布输入。
  builtinSourceCatalogRelease,
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: LEGACY_PRODUCT_SOURCE_IDS；文件作用: 满足数据库初始化 v3 精确迁移输入。
  LEGACY_PRODUCT_SOURCE_IDS,
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: RETIRED_BUILTIN_SOURCE_IDS；文件作用: 满足数据库初始化 v20 精确退役输入。
  RETIRED_BUILTIN_SOURCE_IDS,
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: sourceRepositorySeeds；文件作用: 满足完整数据库当前系统源首次种子输入。
  sourceRepositorySeeds
} from '../src/data/settings/source-repository.seed.js';

// 导入来源: ../src/data/user-content.mock.js；导入内容: userContentMockData；文件作用: 只为真正空测试数据库写入游客种子。
import { userContentMockData } from '../src/data/user-content.mock.js';

// 导入来源: ../src/repositories/persistence/browserPersistenceDatabase.js；导入内容: BrowserPersistenceDatabase；文件作用: 运行正式连接、种子和事务。
import { BrowserPersistenceDatabase } from '../src/repositories/persistence/browserPersistenceDatabase.js';

// 导入来源: ../src/repositories/persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_DATABASE_VERSION；文件作用: 让当前 Repository 测试运行在最终 userSettings schema。
import { BROWSER_PERSISTENCE_DATABASE_VERSION } from '../src/repositories/persistence/browserPersistence.config.js';

// 导入来源: ../src/repositories/user-content/createIndexedDbUserContentRepository.js；导入内容: createIndexedDbUserContentRepository；文件作用: 创建正式四仓适配器。
import { createIndexedDbUserContentRepository } from '../src/repositories/user-content/createIndexedDbUserContentRepository.js';

// 导入来源: ../src/services/userContentService.js；导入内容: createUserContentService；文件作用: 验证 FIFO 与提交后采用，不使用应用单例。
import { createUserContentService } from '../src/services/userContentService.js';

// 导入来源: ../src/config/mediaPlayback.config.js；导入内容: MEDIA_PLAYBACK_PHASE；文件作用: 构造 playing 和 paused 稳定媒体事件。
import { MEDIA_PLAYBACK_PHASE } from '../src/config/mediaPlayback.config.js';

// 导入来源: ../src/services/mediaPlaybackProgressService.js；导入内容: createMediaPlaybackProgressService；文件作用: 验证真实媒体检查点经过现有 service 写入 IndexedDB。
import { createMediaPlaybackProgressService } from '../src/services/mediaPlaybackProgressService.js';

// 类型: string；作用: 让本文件数据库可识别且不与应用正式库冲突。
const TEST_DATABASE_PREFIX = 'wvp5-user-content-test';

// 类型: number；生命周期: 当前测试进程；作用: 保证每个数据库名称唯一。
let databaseSequence = 0;

/**
 * 深拷贝 JSON 夹具。
 * 纯函数: 返回新对象，测试修改不会污染模块种子。
 *
 * @param {*} value JSON 值。
 * @returns {*} 隔离副本。
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 创建唯一测试数据库名称。
 * 副作用: 递增模块内序号，不访问 IndexedDB。
 *
 * @param {string} label 用例标签。
 * @returns {string} 唯一名称。
 */
function createDatabaseName(label) {
  databaseSequence += 1;
  return `${TEST_DATABASE_PREFIX}-${label}-${databaseSequence}`;
}

/**
 * 初始化正式九仓数据库。
 * 副作用: 新库在单一事务中写入 Source、UserContent 和 appMeta 种子。
 * 成功路径: 数据库门面进入 ready；失败路径: 原错误传播给用例。
 *
 * @param {BrowserPersistenceDatabase} database 测试数据库门面。
 * @returns {Promise<void>} 初始化完成。
 */
async function initializeDatabase(database) {
  await database.initialize({
    sourceSeeds: sourceRepositorySeeds,
    userContentSeed: userContentMockData,
    builtinCatalogRelease: builtinSourceCatalogRelease,
    legacyProductSourceIds: LEGACY_PRODUCT_SOURCE_IDS,
    retiredBuiltinSourceIds: RETIRED_BUILTIN_SOURCE_IDS
  });
}

/**
 * 裁剪 service 所需的 Repository 端口。
 * 纯函数: 返回冻结委托，不创建第二保存实现。
 *
 * @param {object} repository 正式 IndexedDB Repository。
 * @returns {Readonly<object>} service 持久化端口。
 */
function createRepositoryPort(repository) {
  return Object.freeze({
    /**
     * 初始化种子游客保存图。
     * 副作用: 委托正式 Repository 读取四仓状态。
     *
     * @returns {Promise<object>} 完整状态。
     */
    initialize() {
      return repository.initialize(userContentMockData);
    },
    /**
     * 基于数据库最新事实更新收藏集合。
     * 副作用: 委托正式 Repository 在同一事务中读取、转换并提交用户收藏。
     *
     * @param {string} userId 用户 id。
     * @param {Function} updater 同步收藏集合转换函数。
     * @returns {Promise<object>} 已提交集合。
     */
    updateFavorites(userId, updater) {
      return repository.updateFavorites(userId, updater);
    },
    /**
     * 基于数据库最新事实更新历史集合。
     * 副作用: 委托正式 Repository 在同一事务中读取、转换并提交用户历史。
     *
     * @param {string} userId 用户 id。
     * @param {Function} updater 同步历史集合转换函数。
     * @returns {Promise<object>} 已提交集合。
     */
    updatePlayHistory(userId, updater) {
      return repository.updatePlayHistory(userId, updater);
    },
    /**
     * 基于数据库最新事实原子更新收藏和历史集合。
     * 副作用: 委托正式 Repository 双仓读取、转换和提交事务。
     * 成功路径: 两个集合共同提交后 resolve；失败路径: 任一请求失败时 reject。
     *
     * @param {string} userId 用户 id。
     * @param {Function} updater 同步双集合转换函数。
     * @returns {Promise<object>} 已提交双集合。
     */
    updateCollections(userId, updater) {
      return repository.updateCollections(userId, updater);
    },
    /**
     * 保存恢复策略。
     * 副作用: 委托正式 Repository 覆盖 userSettings。
     *
     * @param {string} userId 用户 id。
     * @param {object} state 恢复策略。
     * @returns {Promise<object>} 已提交策略。
     */
    saveResumePolicy(userId, state) {
      return repository.saveResumePolicy(userId, state);
    }
  });
}

/**
 * 创建测试响应式投影端口。
 * 副作用: 端口方法原位替换 state 顶层字段，模拟 Vue store 稳定对象身份。
 *
 * @returns {object} state 和五个采用方法。
 */
function createStatePort() {
  // 类型: object；作用: service 读取的稳定投影对象，初始化前记录上限为零。
  const state = {
    user: null,
    favorites: { maxRecords: 0, records: [] },
    playHistory: { maxRecords: 0, records: [] },
    currentPlaying: null,
    resumePolicy: null
  };
  return {
    state,
    /**
     * 完整采用初始化状态。
     * 副作用: 原位替换测试 state，currentPlaying 强制为空。
     *
     * @param {object} nextState Repository 状态。
     * @returns {object} 当前 state。
     */
    replaceState(nextState) {
      // 类型: object；作用: 隔离 Repository 响应与测试投影引用。
      const next = clone(nextState);
      Object.assign(state, next, { currentPlaying: null });
      return state;
    },
    /**
     * 采用收藏集合。
     * 副作用: 替换 state.favorites。
     *
     * @param {object} favorites 已提交集合。
     * @returns {object} 当前收藏集合。
     */
    replaceFavorites(favorites) {
      state.favorites = clone(favorites);
      return state.favorites;
    },
    /**
     * 采用历史集合。
     * 副作用: 替换 state.playHistory。
     *
     * @param {object} playHistory 已提交集合。
     * @returns {object} 当前历史集合。
     */
    replacePlayHistory(playHistory) {
      state.playHistory = clone(playHistory);
      return state.playHistory;
    },
    /**
     * 采用恢复策略。
     * 副作用: 替换 state.resumePolicy。
     *
     * @param {object} resumePolicy 已提交策略。
     * @returns {object} 当前策略。
     */
    replaceResumePolicy(resumePolicy) {
      state.resumePolicy = clone(resumePolicy);
      return state.resumePolicy;
    },
    /**
     * 写当前播放会话。
     * 副作用: 只替换测试 state.currentPlaying。
     *
     * @param {object|null} currentPlaying 当前播放状态。
     * @returns {object|null} 当前会话状态。
     */
    setCurrentPlaying(currentPlaying) {
      state.currentPlaying = currentPlaying ? clone(currentPlaying) : null;
      return state.currentPlaying;
    }
  };
}

/**
 * 创建严格收藏记录。
 * 纯函数: 使用唯一内容 id 和稳定时间，不读取 store。
 *
 * @param {number} index 记录序号。
 * @returns {object} 收藏记录。
 */
function createFavoriteRecord(index) {
  // 类型: string；作用: 所有测试收藏共用的稳定数据源身份。
  const sourceId = 'test-source';
  // 类型: string；作用: 根据序号生成唯一内容身份。
  const contentId = `movie-${index}`;
  // 类型: string；作用: 同时作为 favoriteKey 和 contentKey。
  const favoriteKey = `${sourceId}::${contentId}`;
  // 类型: string；作用: 生成可解析且稳定的收藏时间。
  const timestamp = `2026-07-20T10:${String(index % 60).padStart(2, '0')}:00.000Z`;
  return {
    sourceId,
    contentId,
    favoriteKey,
    contentKey: favoriteKey,
    contentSnapshot: {
      schemaVersion: 1,
      sourceId,
      contentId,
      sourceName: '测试源',
      type: 'movie',
      title: `测试电影 ${index}`,
      poster: '',
      cover: '',
      year: '2026',
      area: '测试地区',
      genres: ['剧情'],
      displayTags: [],
      score: null,
      quality: 'HD',
      badge: '',
      movie: { duration: '3600' },
      tv: { updateStatus: '', latestEpisode: '', totalEpisodes: '' },
      searchHints: { title: `测试电影 ${index}`, aliases: [], year: '2026', type: 'movie' },
      capturedAt: timestamp
    },
    favoritedAt: timestamp,
    updatedAt: timestamp
  };
}

/**
 * 创建用户内容 service 可保存的完整测试 ContentItem。
 * 纯函数: 返回新对象，标题和身份由参数决定，不访问 Provider 或 Store。
 *
 * @param {string} contentId 内容 id。
 * @param {string} type movie 或 tv。
 * @returns {object} 具备卡片快照字段的标准内容对象。
 */
function createTestContentItem(contentId, type = 'movie') {
  return {
    sourceId: 'test-source',
    id: contentId,
    sourceName: '测试源',
    type,
    title: `测试内容 ${contentId}`,
    poster: '',
    cover: '',
    year: '2026',
    area: '测试地区',
    genres: ['剧情'],
    displayTags: [],
    score: null,
    quality: type === 'movie' ? 'HD' : '',
    badge: '',
    aliases: [],
    movie: { duration: '3600' },
    tv: { updateStatus: type === 'tv' ? '更新中' : '', latestEpisode: '', totalEpisodes: '' }
  };
}

/**
 * 创建播放历史 service 输入。
 * 纯函数: 返回电影默认载荷，并允许调用方覆盖字段。
 *
 * @param {object} overrides 字段覆盖。
 * @returns {object} 历史写入载荷。
 */
function createHistoryPayload(overrides = {}) {
  // 类型: object；作用: 新历史必须携带完整标准 ContentItem，服务据此生成本地卡片快照。
  const contentItem = {
    sourceId: 'test-source',
    id: 'movie-history',
    sourceName: '测试源',
    type: 'movie',
    title: '历史测试电影',
    poster: '',
    cover: '',
    year: '2026',
    area: '测试地区',
    genres: ['剧情'],
    displayTags: [],
    score: null,
    quality: 'HD',
    badge: '',
    aliases: [],
    movie: { duration: '3600' },
    tv: { updateStatus: '', latestEpisode: '', totalEpisodes: '' }
  };
  // 类型: object；作用: 覆盖内容身份的用例同时更新 ContentItem，保证快照和历史主字段一致。
  const resolvedContentItem = {
    ...contentItem,
    id: overrides.contentId || contentItem.id,
    type: overrides.type || contentItem.type,
    title: overrides.title || contentItem.title
  };
  // 类型: object|null；作用: 电视剧覆盖用例根据显式分集身份生成标准 Episode，电影保持 null。
  const resolvedEpisode = overrides.episode || (overrides.episodeId || overrides.episodeIndex
    ? {
      id: overrides.episodeId || '',
      episodeNumber: overrides.episodeIndex || null,
      index: overrides.episodeIndex || null,
      title: overrides.episodeTitle || ''
    }
    : null);
  return {
    sourceId: 'test-source',
    contentId: 'movie-history',
    type: 'movie',
    playedSeconds: 120,
    durationSeconds: 3600,
    playStatus: 'playing',
    playbackSourceId: 'line-main',
    contentItem: resolvedContentItem,
    episode: resolvedEpisode,
    ...overrides
  };
}

/**
 * 创建 Repository 可以直接保存的完整播放历史记录。
 * 纯函数: 从稳定电影身份派生复合键和时间字段，不读取用户种子或运行态 store。
 * 成功路径: 返回全部必填字段，并允许用例覆盖进度和时间。
 * 失败路径: 覆盖值不符合契约时由被测 Repository 校验器拒绝。
 *
 * @param {object} overrides 完整历史记录字段覆盖。
 * @returns {object} UserContentRepository 严格播放历史记录。
 */
function createPlayHistoryRecord(overrides = {}) {
  // 类型: string；作用: 当前直接保存用例的稳定数据源身份。
  const sourceId = 'test-source';
  // 类型: string；作用: 当前直接保存用例的稳定内容身份。
  const contentId = 'movie-history';
  // 类型: string；作用: 电影历史按 sourceId 和 contentId 形成唯一复合键。
  const historyKey = `${sourceId}::${contentId}`;
  // 类型: string；作用: 当前历史创建与更新时间使用可解析稳定 UTC 时间。
  const timestamp = '2026-07-20T12:00:00.000Z';
  return {
    sourceId,
    contentId,
    type: 'movie',
    episodeId: '',
    episodeIndex: null,
    episodeLocator: {
      episodeId: '',
      seasonNumber: null,
      episodeNumber: null,
      episodeIndex: null,
      episodeTitle: ''
    },
    contentSnapshot: {
      schemaVersion: 1,
      sourceId,
      contentId,
      sourceName: '测试源',
      type: 'movie',
      title: '历史测试电影',
      poster: '',
      cover: '',
      year: '2026',
      area: '测试地区',
      genres: ['剧情'],
      displayTags: [],
      score: null,
      quality: 'HD',
      badge: '',
      movie: { duration: '3600' },
      tv: { updateStatus: '', latestEpisode: '', totalEpisodes: '' },
      searchHints: { title: '历史测试电影', aliases: [], year: '2026', type: 'movie' },
      capturedAt: timestamp
    },
    historyKey,
    contentKey: historyKey,
    firstPlayedAt: timestamp,
    lastPlayedAt: timestamp,
    playedSeconds: 120,
    durationSeconds: 3600,
    playStatus: 'played',
    playbackSourceId: 'line-main',
    updatedAt: timestamp,
    ...overrides
  };
}

/**
 * 使用 Array.from 回调序号创建收藏记录。
 * 纯函数: 忽略数组占位值，只把 index 交给严格记录工厂。
 *
 * @param {*} unusedValue Array.from 未初始化占位值。
 * @param {number} index 当前数组序号。
 * @returns {object} 收藏记录。
 */
function createFavoriteRecordFromIndex(unusedValue, index) {
  return createFavoriteRecord(index);
}

test('UserContentRepository 原子保存用户内容与三类设置并跨数据库门面重建', async () => {
  // 类型: string；作用: 本用例两次数据库门面重建共用的隔离名称。
  const databaseName = createDatabaseName('repository-rebuild');
  // 类型: BrowserPersistenceDatabase；作用: 创建首个正式数据库连接门面。
  const database = new BrowserPersistenceDatabase({ databaseName, databaseVersion: BROWSER_PERSISTENCE_DATABASE_VERSION });
  await initializeDatabase(database);
  // 类型: IndexedDbUserContentRepository；作用: 使用首个门面执行保存操作。
  const repository = createIndexedDbUserContentRepository({ database });

  try {
    // 类型: object；作用: 保存首次种子恢复的完整游客状态。
    const initialState = await repository.initialize(userContentMockData);
    assert.equal(initialState.user.status, 'indexeddb');
    assert.equal(initialState.currentPlaying, null);

    // 类型: object；作用: 构造两条严格收藏记录的完整集合。
    const favorites = {
      maxRecords: USER_CONTENT_RECORD_LIMIT,
      records: [createFavoriteRecord(1), createFavoriteRecord(2)]
    };
    // 类型: object；作用: 保存 Repository 提交后的隔离收藏集合，用于验证外部修改不回写。
    const savedFavorites = await repository.saveFavorites(initialState.user.id, favorites);
    savedFavorites.records[0].contentId = 'mutated-outside';

    // 类型: object；作用: 保存已提交恢复策略并验证返回值。
    const savedPolicy = await repository.saveResumePolicy(initialState.user.id, {
      nearStartThresholdSeconds: 8,
      nearEndThresholdSeconds: 40
    });
    assert.equal(savedPolicy.nearStartThresholdSeconds, 8);

    // 类型: object；作用: 从 v11 首次种子读取默认快捷键并构造不与其他启用绑定冲突的用户设置。
    const shortcutPreferences = await repository.loadShortcutPreferences(initialState.user.id);
    shortcutPreferences.bindings[0].key = 'KeyQ';
    shortcutPreferences.bindings[0].modifiers = ['control'];
    await repository.saveShortcutPreferences(initialState.user.id, shortcutPreferences);
    // 类型: object；作用: 从 v12 首次种子读取首页展示偏好并保存合法非默认数量。
    const homeDisplayPreferences = await repository.loadHomeDisplayPreferences(initialState.user.id);
    homeDisplayPreferences.carouselItemLimit = HOME_CAROUSEL_ITEM_LIMIT.minimum + HOME_CAROUSEL_ITEM_LIMIT.step;
    await repository.saveHomeDisplayPreferences(initialState.user.id, homeDisplayPreferences);
    // 副作用: 保存快捷键后再次保存恢复策略，验证两个字段都通过同一设置行读改写保留另一方。
    await repository.saveResumePolicy(initialState.user.id, {
      nearStartThresholdSeconds: 9,
      nearEndThresholdSeconds: 45
    });
    // 断言: 恢复策略提交没有覆盖此前已提交快捷键。
    assert.equal(
      (await repository.loadShortcutPreferences(initialState.user.id)).bindings[0].key,
      'KeyQ'
    );
    // 断言: 恢复策略和快捷键提交都没有覆盖此前已提交首页展示偏好。
    assert.equal(
      (await repository.loadHomeDisplayPreferences(initialState.user.id)).carouselItemLimit,
      homeDisplayPreferences.carouselItemLimit
    );

    // 类型: object；作用: 更新一条种子历史进度，验证历史集合跨 Repository 重建保存。
    const updatedHistoryRecord = createPlayHistoryRecord({
      playedSeconds: 2222,
      lastPlayedAt: '2026-07-21T07:00:00.000Z',
      updatedAt: '2026-07-21T07:00:00.000Z'
    });
    await repository.savePlayHistory(initialState.user.id, {
      maxRecords: USER_CONTENT_RECORD_LIMIT,
      records: [updatedHistoryRecord]
    });

    // 类型: object；作用: 保存已提交本地游客资料。
    const profile = await repository.saveProfile({
      ...initialState.user,
      name: '本地游客'
    });
    assert.equal(profile.name, '本地游客');

    database.close();
    // 类型: BrowserPersistenceDatabase；作用: 用同一名称模拟刷新后的新数据库门面。
    const rebuiltDatabase = new BrowserPersistenceDatabase({ databaseName, databaseVersion: BROWSER_PERSISTENCE_DATABASE_VERSION });
    await initializeDatabase(rebuiltDatabase);
    // 类型: IndexedDbUserContentRepository；作用: 模拟刷新后新 Repository 实例。
    const rebuiltRepository = createIndexedDbUserContentRepository({ database: rebuiltDatabase });
    // 类型: object；作用: 保存跨门面重建后的完整用户内容状态。
    const rebuiltState = await rebuiltRepository.initialize(userContentMockData);

    assert.deepEqual(
      rebuiltState.favorites.records.map(record => record.contentId).sort(),
      ['movie-1', 'movie-2']
    );
    assert.equal(rebuiltState.user.name, '本地游客');
    assert.deepEqual(rebuiltState.resumePolicy, {
      nearStartThresholdSeconds: 9,
      nearEndThresholdSeconds: 45
    });
    // 类型: object；作用: 保存刷新重建后从同一 userSettings 单例恢复的用户自定义组合键。
    const rebuiltShortcutPreferences = await rebuiltRepository.loadShortcutPreferences(rebuiltState.user.id);
    assert.deepEqual(rebuiltShortcutPreferences.bindings[0], {
      action: shortcutPreferences.bindings[0].action,
      key: 'KeyQ',
      modifiers: ['control'],
      enabled: true
    });
    assert.deepEqual(
      await rebuiltRepository.loadHomeDisplayPreferences(rebuiltState.user.id),
      homeDisplayPreferences
    );
    assert.equal(rebuiltState.currentPlaying, null);
    assert.equal(rebuiltState.playHistory.records[0].playedSeconds, 2222);
    await rebuiltDatabase.deleteDatabase();
  } finally {
    database.close();
  }
});

test('UserContentService 串行合并并发意图且只在事务成功后采用投影', async () => {
  // 类型: string；作用: 本用例独立数据库名称。
  const databaseName = createDatabaseName('service-fifo');
  // 类型: BrowserPersistenceDatabase；作用: 为真实 Repository 提供事务门面。
  const database = new BrowserPersistenceDatabase({ databaseName, databaseVersion: BROWSER_PERSISTENCE_DATABASE_VERSION });
  await initializeDatabase(database);
  // 类型: IndexedDbUserContentRepository；作用: 承接 service 的真实持久化操作。
  const repository = createIndexedDbUserContentRepository({ database });
  // 类型: object；作用: 观察 Repository 提交前后测试投影变化。
  const statePort = createStatePort();
  // 类型: number；生命周期: 当前用例；作用: 生成严格递增收藏时间。
  let clockIndex = 0;
  // 类型: UserContentService；作用: 验证并发意图经过单一 FIFO 合并。
  const service = createUserContentService({
    repository: createRepositoryPort(repository),
    statePort,
    /**
     * 生成测试 ISO 时间。
     * 副作用: 递增当前用例 clockIndex，使并发收藏具有稳定先后顺序。
     *
     * @returns {string} 当前测试时间。
     */
    now() {
      // 类型: string；作用: 在递增序号前生成当前命令的稳定 ISO 时间。
      const timestamp = `2026-07-21T08:${String(clockIndex).padStart(2, '0')}:00.000Z`;
      clockIndex += 1;
      return timestamp;
    }
  });

  try {
    await service.initialize();
    await service.clearFavorites();
    await Promise.all([
      service.addFavorite(createTestContentItem('parallel-a')),
      service.addFavorite(createTestContentItem('parallel-b'))
    ]);
    assert.deepEqual(
      statePort.state.favorites.records.map(record => record.contentId).sort(),
      ['parallel-a', 'parallel-b']
    );
    // 类型: object；作用: 验证 toggle 在 FIFO 最新状态上删除已收藏内容。
    const toggleResult = await service.toggleFavorite(createTestContentItem('parallel-a'));
    assert.equal(toggleResult.favorite, false);
    assert.deepEqual(
      statePort.state.favorites.records.map(record => record.contentId),
      ['parallel-b']
    );

    await service.clearPlayHistory();
    await service.upsertPlayHistory(createHistoryPayload());
    await service.upsertPlayHistory(createHistoryPayload({ playedSeconds: 360 }));
    assert.equal(
      statePort.state.playHistory.records.filter(record => record.contentId === 'movie-history').length,
      1
    );
    assert.equal(
      statePort.state.playHistory.records.find(record => record.contentId === 'movie-history').playedSeconds,
      360
    );
    await service.upsertPlayHistory(createHistoryPayload({
      contentId: 'tv-history',
      type: 'tv',
      episodeId: 'episode-1',
      episodeIndex: 1
    }));
    // 类型: boolean；作用: 保存电视剧单集历史删除结果，验证 historyKey 精确命中。
    const removedHistory = await service.removePlayHistory({
      sourceId: 'test-source',
      contentId: 'tv-history',
      type: 'tv',
      episodeId: 'episode-1',
      episodeIndex: 1
    });
    assert.equal(removedHistory, true);
    assert.equal(
      statePort.state.playHistory.records.some(record => record.contentId === 'movie-history'),
      true
    );

    await service.saveResumePolicy({
      nearStartThresholdSeconds: 7,
      nearEndThresholdSeconds: 35
    });
    assert.equal(statePort.state.resumePolicy.nearEndThresholdSeconds, 35);

    service.updateCurrentPlaying({
      sourceId: 'test-source',
      contentId: 'movie-history',
      type: 'movie',
      episodeId: '',
      episodeIndex: null,
      playbackSourceId: 'line-main',
      playStatus: 'playing',
      playedSeconds: 120,
      durationSeconds: 3600,
      updatedAt: '2026-07-21T08:30:00.000Z'
    });
    assert.equal(statePort.state.currentPlaying.contentId, 'movie-history');

    // 类型: object；作用: 读取数据库长期状态，反证 currentPlaying 未持久化。
    const storedState = await repository.loadState(statePort.state.user.id);
    assert.equal(storedState.currentPlaying, null);
    assert.equal(storedState.favorites.records.length, 1);
    assert.equal(storedState.playHistory.records.length, 1);
    assert.equal(storedState.resumePolicy.nearStartThresholdSeconds, 7);
    await database.deleteDatabase();
  } finally {
    database.close();
  }
});

// 测试目的: 两个标签页持有各自旧内存投影时，历史检查点必须在数据库事务内合并，刷新后不能丢失另一标签页记录。
test('跨标签页播放历史基于数据库最新集合原子合并', async () => {
  // 类型: string；作用: 两个独立数据库门面共享同一逻辑数据库，模拟同源浏览器标签页。
  const databaseName = createDatabaseName('multi-tab-history');
  // 类型: BrowserPersistenceDatabase；作用: 模拟第一个标签页独立连接和事务生命周期。
  const firstDatabase = new BrowserPersistenceDatabase({
    databaseName,
    databaseVersion: BROWSER_PERSISTENCE_DATABASE_VERSION
  });
  // 类型: BrowserPersistenceDatabase；作用: 模拟第二个标签页独立连接和事务生命周期。
  const secondDatabase = new BrowserPersistenceDatabase({
    databaseName,
    databaseVersion: BROWSER_PERSISTENCE_DATABASE_VERSION
  });
  await initializeDatabase(firstDatabase);
  await initializeDatabase(secondDatabase);
  // 类型: IndexedDbUserContentRepository；作用: 第一个标签页的独立用户内容 Repository。
  const firstRepository = createIndexedDbUserContentRepository({ database: firstDatabase });
  // 类型: IndexedDbUserContentRepository；作用: 第二个标签页的独立用户内容 Repository。
  const secondRepository = createIndexedDbUserContentRepository({ database: secondDatabase });
  // 类型: object；作用: 保留第一个标签页独立响应式投影，后续故意不手工同步第二个标签页状态。
  const firstStatePort = createStatePort();
  // 类型: object；作用: 保留第二个标签页独立响应式投影，制造真实旧内存条件。
  const secondStatePort = createStatePort();
  // 类型: UserContentService；作用: 绑定第一个 Repository 和固定时钟。
  const firstService = createUserContentService({
    repository: createRepositoryPort(firstRepository),
    statePort: firstStatePort,
    /**
     * 返回第一个标签页的固定记录时间。
     * 纯函数: 不读取数据库或修改测试状态。
     *
     * @returns {string} 固定 ISO 时间。
     */
    now() {
      return '2026-07-21T19:00:00.000Z';
    }
  });
  // 类型: UserContentService；作用: 绑定第二个 Repository 和不同固定时钟，模拟并行播放器检查点。
  const secondService = createUserContentService({
    repository: createRepositoryPort(secondRepository),
    statePort: secondStatePort,
    /**
     * 返回第二个标签页的固定记录时间。
     * 纯函数: 不读取数据库或修改测试状态。
     *
     * @returns {string} 固定 ISO 时间。
     */
    now() {
      return '2026-07-21T19:01:00.000Z';
    }
  });

  try {
    await firstService.initialize();
    await firstService.clearPlayHistory();
    await firstService.clearFavorites();
    // 初始化顺序: 第二标签页在清空后读取空集合，此后两个 service 不共享任何内存投影。
    await secondService.initialize();
    await Promise.all([
      firstService.addFavorite(createTestContentItem('first-tab-favorite')),
      secondService.addFavorite(createTestContentItem('second-tab-favorite'))
    ]);
    await Promise.all([
      firstService.upsertPlayHistory(createHistoryPayload({
        contentId: 'first-tab-movie',
        playedSeconds: 120
      })),
      secondService.upsertPlayHistory(createHistoryPayload({
        contentId: 'second-tab-movie',
        playedSeconds: 180
      }))
    ]);
    // 类型: object；作用: 模拟 F5 从 IndexedDB 重新加载的真实持久化快照。
    let storedState = await firstRepository.loadState(firstStatePort.state.user.id);
    assert.deepEqual(
      storedState.playHistory.records.map(record => record.contentId).sort(),
      ['first-tab-movie', 'second-tab-movie']
    );
    assert.deepEqual(
      storedState.favorites.records.map(record => record.contentId).sort(),
      ['first-tab-favorite', 'second-tab-favorite']
    );

    // 交错写入: 两个 service 继续保留各自旧投影，但 Repository updater 每次必须读取数据库最新集合。
    await firstService.upsertPlayHistory(createHistoryPayload({
      contentId: 'first-tab-movie',
      playedSeconds: 240
    }));
    await secondService.upsertPlayHistory(createHistoryPayload({
      contentId: 'second-tab-movie',
      playedSeconds: 300
    }));
    storedState = await secondRepository.loadState(secondStatePort.state.user.id);
    assert.equal(
      storedState.playHistory.records.find(record => record.contentId === 'first-tab-movie').playedSeconds,
      240
    );
    assert.equal(
      storedState.playHistory.records.find(record => record.contentId === 'second-tab-movie').playedSeconds,
      300
    );
  } finally {
    secondDatabase.close();
    await firstDatabase.deleteDatabase();
    firstDatabase.close();
  }
});

test('Repository 失败保持旧投影，集合上限和唯一键在事务前失败关闭', async () => {
  // 类型: string；作用: 本失败注入用例独立数据库名称。
  const databaseName = createDatabaseName('failure-boundary');
  // 类型: BrowserPersistenceDatabase；作用: 提供真实首次种子和读取事务。
  const database = new BrowserPersistenceDatabase({ databaseName, databaseVersion: BROWSER_PERSISTENCE_DATABASE_VERSION });
  await initializeDatabase(database);
  // 类型: IndexedDbUserContentRepository；作用: 初始化和上限校验继续使用真实适配器。
  const repository = createIndexedDbUserContentRepository({ database });
  // 类型: object；作用: 观察失败事务前后的投影是否相同。
  const statePort = createStatePort();
  // 类型: Readonly<object>；作用: 保存真实 Repository 委托基线。
  const repositoryPort = createRepositoryPort(repository);
  // 类型: Readonly<object>；作用: 只覆盖收藏原子更新方法以注入确定失败。
  const failingPort = Object.freeze({
    ...repositoryPort,
    /**
     * 注入收藏保存失败。
     * 副作用: 不访问数据库，直接 reject 供 service 失败投影测试。
     * 成功路径: 无；失败路径: 始终抛出固定测试错误。
     *
     * @returns {Promise<never>} 始终 reject。
     */
    async updateFavorites() {
      throw new Error('injected favorites failure');
    }
  });
  // 类型: UserContentService；作用: 绑定失败端口验证 Repository-first 采用边界。
  const service = createUserContentService({
    repository: failingPort,
    statePort,
    /**
     * 返回固定测试时间。
     * 纯函数: 不读取或修改外部状态。
     *
     * @returns {string} 固定 ISO 时间。
     */
    now() {
      return '2026-07-21T09:00:00.000Z';
    }
  });

  try {
    await service.initialize();
    // 类型: object；作用: 保存失败操作前收藏投影快照。
    const beforeFavorites = clone(statePort.state.favorites);
    await assert.rejects(
      service.toggleFavorite(createTestContentItem('failure-item')),
      /injected favorites failure/
    );
    assert.deepEqual(statePort.state.favorites, beforeFavorites);

    // 类型: object；作用: 构造超过正式上限一条的非法集合。
    const overflowFavorites = {
      maxRecords: USER_CONTENT_RECORD_LIMIT,
      records: Array.from(
        { length: USER_CONTENT_RECORD_LIMIT + 1 },
        createFavoriteRecordFromIndex
      )
    };
    await assert.rejects(
      repository.saveFavorites(statePort.state.user.id, overflowFavorites),
      /未超过上限/
    );
    // 类型: object；作用: 构造重复 favoriteKey 集合，验证复合主键冲突前由领域校验拒绝。
    const duplicateFavorites = {
      maxRecords: USER_CONTENT_RECORD_LIMIT,
      records: [createFavoriteRecord(1), createFavoriteRecord(1)]
    };
    await assert.rejects(
      repository.saveFavorites(statePort.state.user.id, duplicateFavorites),
      /重复 favoriteKey/
    );
    assert.deepEqual(await repository.loadState(statePort.state.user.id), {
      ...statePort.state,
      currentPlaying: null
    });
    await database.deleteDatabase();
  } finally {
    database.close();
  }
});

test('真实媒体进度通过用户内容服务写入 IndexedDB 并可恢复', async () => {
  // 类型: string；作用: 本媒体进度集成用例独立数据库名称。
  const databaseName = createDatabaseName('media-progress');
  // 类型: BrowserPersistenceDatabase；作用: 提供正式九仓和原生事务门面。
  const database = new BrowserPersistenceDatabase({ databaseName, databaseVersion: BROWSER_PERSISTENCE_DATABASE_VERSION });
  await initializeDatabase(database);
  // 类型: IndexedDbUserContentRepository；作用: 承接协调器最终经过 userContentService 发起的历史事务。
  const repository = createIndexedDbUserContentRepository({ database });
  // 类型: object；作用: 观察 currentPlaying 会话态和 Repository 成功后的历史投影。
  const statePort = createStatePort();
  // 类型: UserContentService；作用: 保持应用相同的唯一长期 FIFO 和提交后采用边界。
  const userContentService = createUserContentService({
    repository: createRepositoryPort(repository),
    statePort,
    /**
     * 返回用户内容记录固定时间。
     * 纯函数: 不读取或修改外部状态。
     *
     * @returns {string} 固定 ISO 时间。
     */
    now() {
      return '2026-07-21T14:00:00.000Z';
    }
  });

  /**
   * 委托当前播放会话写入。
   * 副作用: 调用隔离 userContentService 更新测试 statePort.currentPlaying，不访问 Repository。
   *
   * @param {object|null} currentPlaying 当前播放摘要或 null。
   * @returns {object|null} 已采用测试会话投影。
   */
  function updateCurrentPlayingPort(currentPlaying) {
    return userContentService.updateCurrentPlaying(currentPlaying);
  }

  /**
   * 委托播放历史长期写入。
   * 副作用: 调用隔离 userContentService FIFO，并在 Repository 成功后采用 playHistory 投影。
   * 成功路径: resolve 已提交历史；失败路径: 原 Repository 错误传播给协调器调用方。
   *
   * @param {object} payload 真实媒体进度载荷。
   * @returns {Promise<object|null>} 已提交历史记录或 null。
   */
  function upsertPlayHistoryPort(payload) {
    return userContentService.upsertPlayHistory(payload);
  }

  try {
    await userContentService.initialize();
    await userContentService.clearPlayHistory();
    // 类型: object；作用: 创建只依赖现有 userContentService 两个公开写端口的进度协调器。
    const progressService = createMediaPlaybackProgressService({
      /**
       * 返回媒体事件固定时间。
       * 纯函数: 不读取或修改外部状态。
       *
       * @returns {string} 固定 ISO 时间。
       */
      now() {
        return '2026-07-21T14:30:00.000Z';
      },
      updateCurrentPlaying: updateCurrentPlayingPort,
      upsertPlayHistory: upsertPlayHistoryPort
    });
    // 类型: object；作用: 提供电影历史和当前播放需要的精确内容/线路身份。
    const playbackContext = {
      sourceId: 'test-source',
      contentId: 'media-progress-movie',
      type: 'movie',
      episodeId: '',
      episodeIndex: null,
      playbackSourceId: 'line-main',
      contentItem: createTestContentItem('media-progress-movie'),
      episode: null
    };
    // 类型: object；作用: 构造已经真实播放 12 秒的稳定媒体会话。
    const playingSession = {
      phase: MEDIA_PLAYBACK_PHASE.playing,
      sourceId: playbackContext.sourceId,
      contentId: playbackContext.contentId,
      episodeId: playbackContext.episodeId,
      episodeIndex: playbackContext.episodeIndex,
      playbackSourceId: playbackContext.playbackSourceId,
      playedSeconds: 12,
      durationSeconds: 120,
      bufferedSeconds: 36,
      errorCode: '',
      errorMessage: ''
    };
    // 副作用: 首次 playing 通过协调器和用户内容 FIFO 建立真实 IndexedDB 历史。
    await progressService.handleSession(playingSession, playbackContext);
    assert.equal(statePort.state.currentPlaying.playedSeconds, 12);

    // 类型: object；作用: 模拟 18 秒暂停，验证未达到下一检查点也执行最终 paused 提交。
    const pausedSession = {
      ...playingSession,
      phase: MEDIA_PLAYBACK_PHASE.paused,
      playedSeconds: 18,
      bufferedSeconds: 40
    };
    await progressService.handleSession(pausedSession, playbackContext);
    await progressService.finalize(pausedSession);
    // 断言: 页面会话终结后 currentPlaying 清空，长期历史保留最后真实暂停秒数。
    assert.equal(statePort.state.currentPlaying, null);
    assert.equal(statePort.state.playHistory.records.length, 1);
    assert.equal(statePort.state.playHistory.records[0].playedSeconds, 18);
    assert.equal(statePort.state.playHistory.records[0].playStatus, 'paused');

    // 类型: object；作用: 从正式 Repository 重新读取数据库保存图，反证结果不是页面内存影子状态。
    const storedState = await repository.loadState(statePort.state.user.id);
    // 类型: object；作用: 定位本次媒体内容对应的持久历史记录。
    const storedRecord = storedState.playHistory.records.find(
      record => record.contentId === playbackContext.contentId
    );
    assert.equal(storedRecord.playedSeconds, 18);
    assert.equal(storedRecord.playbackSourceId, 'line-main');
    assert.equal(storedState.currentPlaying, null);

    // 类型: object；作用: 使用现有恢复策略读取已提交记录，模拟刷新后 PlayerView 的起播决策。
    const resumeDecision = userContentService.getPlaybackResumeDecision(storedRecord);
    assert.deepEqual(resumeDecision, {
      mode: 'resume',
      startSeconds: 18,
      shouldPromptReplay: false
    });
    // 断言: 小于近头阈值的历史必须从零开始且不弹恢复选择。
    assert.deepEqual(userContentService.getPlaybackResumeDecision({
      playedSeconds: 4,
      durationSeconds: 120
    }), {
      mode: 'restart',
      startSeconds: 0,
      shouldPromptReplay: false
    });
    // 断言: 距离结尾不超过阈值时必须返回近尾选择，不允许页面直接重头或自动结束。
    assert.deepEqual(userContentService.getPlaybackResumeDecision({
      playedSeconds: 95,
      durationSeconds: 120
    }), {
      mode: 'prompt-replay',
      startSeconds: 95,
      shouldPromptReplay: true
    });
    await database.deleteDatabase();
  } finally {
    database.close();
  }
});

test('UserContentService 跨源恢复在双仓事务中保留收藏时间与历史进度', async () => {
  // 类型: string；作用: 当前跨源恢复用例独占数据库名称。
  const databaseName = createDatabaseName();
  // 类型: BrowserPersistenceDatabase；作用: 创建正式九仓与 v24 保存形状。
  const database = new BrowserPersistenceDatabase({
    databaseName,
    databaseVersion: BROWSER_PERSISTENCE_DATABASE_VERSION
  });
  await initializeDatabase(database);
  // 类型: object；作用: 使用正式 Repository 验证双仓原子重绑定结果。
  const repository = createIndexedDbUserContentRepository({ database });
  // 类型: object；作用: 观察 Repository 提交后两个集合投影共同变化。
  const statePort = createStatePort();
  // 类型: UserContentService；作用: 绑定确定性时钟和正式双仓端口。
  const service = createUserContentService({
    repository: createRepositoryPort(repository),
    statePort,
    /**
     * 返回跨源历史恢复事务的固定时间。
     * 纯函数: 不读取或修改测试外部状态。
     *
     * @returns {string} 固定 ISO 时间。
     */
    now() {
      return '2026-07-21T16:00:00.000Z';
    }
  });

  try {
    await service.initialize();
    await service.clearFavorites();
    await service.clearPlayHistory();
    // 类型: object；作用: 模拟即将失效的旧 Provider 电视剧内容。
    const oldContent = createTestContentItem('old-series', 'tv');
    oldContent.sourceId = 'old-source';
    oldContent.sourceName = '旧源';
    oldContent.title = '跨源恢复剧集';
    // 类型: object；作用: 原 Provider 第三集身份和跨源标题事实。
    const oldEpisode = { id: 'old-episode-3', episodeNumber: 3, index: 3, title: '第 3 集' };
    await service.addFavorite(oldContent);
    await service.upsertPlayHistory({
      sourceId: oldContent.sourceId,
      contentId: oldContent.id,
      type: oldContent.type,
      episodeId: oldEpisode.id,
      episodeIndex: 3,
      playbackSourceId: 'old-line',
      playedSeconds: 600,
      durationSeconds: 2700,
      playStatus: 'paused',
      lastPlayedAt: '2026-07-21T15:00:00.000Z',
      contentItem: oldContent,
      episode: oldEpisode
    });
    // 类型: object；作用: 保存重绑定前历史，后续复核首次时间和进度未丢失。
    const oldHistory = statePort.state.playHistory.records[0];
    // 类型: object；作用: 用户在替代 Provider 搜索结果中确认的新标准内容。
    const newContent = createTestContentItem('new-series', 'tv');
    newContent.sourceId = 'new-source';
    newContent.sourceName = '新源';
    newContent.title = oldContent.title;
    // 类型: object；作用: 新 Provider 中与历史定位器对应的第三集。
    const newEpisode = { id: 'new-episode-3', episodeNumber: 3, index: 3, title: '第 3 集' };
    await service.rebindUserContent({
      recoveryKind: 'history',
      recoveryKey: oldHistory.historyKey,
      contentItem: newContent,
      episode: newEpisode
    });

    assert.equal(statePort.state.favorites.records.length, 1);
    assert.equal(statePort.state.favorites.records[0].sourceId, 'new-source');
    assert.equal(statePort.state.favorites.records[0].contentSnapshot.title, oldContent.title);
    assert.equal(statePort.state.playHistory.records.length, 1);
    assert.equal(statePort.state.playHistory.records[0].sourceId, 'new-source');
    assert.equal(statePort.state.playHistory.records[0].episodeId, newEpisode.id);
    assert.equal(statePort.state.playHistory.records[0].playedSeconds, oldHistory.playedSeconds);
    assert.equal(statePort.state.playHistory.records[0].firstPlayedAt, oldHistory.firstPlayedAt);
    assert.equal(statePort.state.playHistory.records[0].playbackSourceId, '');
    await database.deleteDatabase();
  } finally {
    database.close();
  }
});

test('失效收藏恢复会把同内容最近历史一起迁移到用户确认分集', async () => {
  // 类型: string；作用: 当前收藏关联历史恢复用例独占数据库名称。
  const databaseName = createDatabaseName();
  // 类型: BrowserPersistenceDatabase；作用: 提供正式 v24 九仓和双仓事务边界。
  const database = new BrowserPersistenceDatabase({
    databaseName,
    databaseVersion: BROWSER_PERSISTENCE_DATABASE_VERSION
  });
  await initializeDatabase(database);
  // 类型: object；作用: 使用正式 Repository 验证收藏入口不会只迁移收藏而丢下最近历史。
  const repository = createIndexedDbUserContentRepository({ database });
  // 类型: object；作用: 观察双仓提交后收藏和历史投影。
  const statePort = createStatePort();
  // 类型: UserContentService；作用: 绑定应用相同的 FIFO 和确定性事务时间。
  const service = createUserContentService({
    repository: createRepositoryPort(repository),
    statePort,
    /**
     * 返回收藏关联历史恢复事务的固定时间。
     * 纯函数: 不读取或修改测试外部状态。
     *
     * @returns {string} 固定 ISO 时间。
     */
    now() {
      return '2026-07-21T18:00:00.000Z';
    }
  });

  try {
    await service.initialize();
    await service.clearFavorites();
    await service.clearPlayHistory();
    // 类型: object；作用: 模拟个人中心中原源已经失效的收藏电视剧。
    const oldContent = createTestContentItem('favorite-old-series', 'tv');
    oldContent.sourceId = 'favorite-old-source';
    oldContent.sourceName = '收藏旧源';
    oldContent.title = '收藏恢复剧集';
    // 类型: object；作用: 保存收藏最近播放历史对应的第五集身份。
    const oldEpisode = { id: 'favorite-old-episode-5', episodeNumber: 5, index: 5, title: '第 5 集' };
    // 类型: object；作用: 保存后续必须保留的原收藏时间记录。
    const oldFavorite = await service.addFavorite(oldContent);
    await service.upsertPlayHistory({
      sourceId: oldContent.sourceId,
      contentId: oldContent.id,
      type: oldContent.type,
      episodeId: oldEpisode.id,
      episodeIndex: 5,
      playbackSourceId: 'favorite-old-line',
      playedSeconds: 900,
      durationSeconds: 2700,
      playStatus: 'paused',
      lastPlayedAt: '2026-07-21T17:00:00.000Z',
      contentItem: oldContent,
      episode: oldEpisode
    });
    // 类型: object；作用: 收藏恢复上下文冻结的同内容最近历史。
    const oldHistory = statePort.state.playHistory.records[0];
    // 类型: object；作用: 用户从其他可用 Provider 选中的替代内容。
    const newContent = createTestContentItem('favorite-new-series', 'tv');
    newContent.sourceId = 'favorite-new-source';
    newContent.sourceName = '收藏新源';
    newContent.title = oldContent.title;
    // 类型: object；作用: 替代 Provider 中与原历史对应的第五集。
    const newEpisode = { id: 'favorite-new-episode-5', episodeNumber: 5, index: 5, title: '第 5 集' };
    await service.rebindUserContent({
      recoveryKind: 'favorite',
      recoveryKey: oldFavorite.favoriteKey,
      relatedHistoryKey: oldHistory.historyKey,
      contentItem: newContent,
      episode: newEpisode
    });

    assert.equal(statePort.state.favorites.records.length, 1);
    assert.equal(statePort.state.favorites.records[0].sourceId, newContent.sourceId);
    assert.equal(statePort.state.favorites.records[0].favoritedAt, oldFavorite.favoritedAt);
    assert.equal(statePort.state.playHistory.records.length, 1);
    assert.equal(statePort.state.playHistory.records[0].sourceId, newContent.sourceId);
    assert.equal(statePort.state.playHistory.records[0].episodeId, newEpisode.id);
    assert.equal(statePort.state.playHistory.records[0].playedSeconds, oldHistory.playedSeconds);
    assert.equal(statePort.state.playHistory.records[0].firstPlayedAt, oldHistory.firstPlayedAt);
    await database.deleteDatabase();
  } finally {
    database.close();
  }
});
