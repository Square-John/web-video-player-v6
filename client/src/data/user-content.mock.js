/*
  user-content.mock.js 模块说明

  - 文件职责:
      提供项目内部用户内容状态的初始化 mock 数据。
      供 userContentStore.js 在站点启动或重置时深拷贝为运行时内存状态。
      该文件只保存用户和内容之间的引用关系，不保存完整 ContentItem 对象。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      buildFavoriteKey/buildHistoryKey: 自定义工具函数，生成收藏和历史唯一 key。

  - 模块级常量:
      USER_CONTENT_RECORD_LIMIT: number，收藏和历史记录上限。
      USER_CONTENT_MOCK_USER: object，个人中心 mock 用户信息。
      FAVORITE_RECORD_SEEDS: Array<object>，初始化收藏真实身份种子。
      HISTORY_RECORD_SEEDS: Array<object>，初始化播放历史引用种子。
      userContentMockData: object，用户内容状态初始化对象。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createFavoriteRecord(seed, index)
          - params:
              -- seed: object，收藏内容的 sourceId 和 contentId。
              -- index: number，收藏记录序号。
          - return:
              object，收藏记录引用对象。
          - description:
              根据内容 id 生成只保存引用的收藏记录。
      createHistoryRecord(seed, index)
          - params:
              -- seed: object，播放历史种子。
              -- index: number，历史记录序号。
          - return:
              object，播放历史引用对象。
          - description:
              根据历史种子生成电影或电视剧播放历史记录。

  - 模块级类:
      无

  - 对外导出:
      USER_CONTENT_RECORD_LIMIT: number，用户内容记录上限。
      userContentMockData: object，用户内容初始化 mock 数据。
*/

import {
  // 导入来源: ../utils/userContentKeys。
  // 导入内容: buildFavoriteKey 收藏唯一 key 生成函数。
  // 文件作用: 为初始化收藏记录生成稳定 favoriteKey。
  buildFavoriteKey,

  // 导入来源: ../utils/userContentKeys。
  // 导入内容: buildHistoryKey 播放历史唯一 key 生成函数。
  // 文件作用: 为初始化播放历史生成稳定 historyKey。
  buildHistoryKey
} from '../utils/userContentKeys.js';

// 类型: number。
// 作用: 收藏记录和播放历史最多保留 100 条，超过后由 service 按先进先出规则裁剪。
export const USER_CONTENT_RECORD_LIMIT = 100;

// 类型: object。
// 作用: 个人中心默认用户信息，当前只作为游客内存状态展示，不接登录系统。
const USER_CONTENT_MOCK_USER = {
  // 类型: string。
  // 作用: 用户状态唯一标识，后续接登录后可替换为真实用户 id。
  id: 'guest-user',

  // 类型: string。
  // 作用: 个人中心用户名称展示。
  name: '游客用户',

  // 类型: string。
  // 作用: 用户角色标识，当前用于显示游客模式。
  role: 'guest',

  // 类型: string。
  // 作用: 当前用户内容状态的保存方式说明，memory 表示仅运行时内存保存。
  status: 'memory',

  // 类型: string。
  // 作用: 提醒当前阶段关闭页面后会从 mock 初始化数据恢复。
  message: '当前阶段使用 mock 初始化，运行时只保存在内存中。'
};

// 类型: Array<object>。
// 作用: 初始化收藏引用的真实 Provider 内容身份，覆盖当前三个已启用受审源的全部内容并可通过 Runtime 补全。
// 条目字段: sourceId，string，Repository、Provider 和内容实体池共用的数据源身份。
// 条目字段: contentId，string，当前 Provider 数据集中真实存在的 ContentItem.id。
const FAVORITE_RECORD_SEEDS = [
  { sourceId: 'system-source-1', contentId: 'system-source-1-movie-001' },
  { sourceId: 'system-source-1', contentId: 'system-source-1-tv-001' },
  { sourceId: 'system-source-4', contentId: 'system-source-4-movie-201' },
  { sourceId: 'system-source-2', contentId: 'system-source-2-tv-101' },
  { sourceId: 'system-source-2', contentId: 'system-source-2-movie-101' },
  { sourceId: 'system-source-4', contentId: 'system-source-4-tv-201' }
];

// 类型: Array<object>。
// 作用: 初始化播放历史引用种子，覆盖电影历史和电视剧单集历史两类 key 规则。
const HISTORY_RECORD_SEEDS = [
  {
    sourceId: 'system-source-1',
    contentId: 'system-source-1-movie-001',
    type: 'movie',
    playedSeconds: 1860,
    durationSeconds: 7680,
    playStatus: 'played'
  },
  {
    sourceId: 'system-source-1',
    contentId: 'system-source-1-tv-001',
    type: 'tv',
    episodeId: 'system-source-1-tv-001-ep-3',
    episodeIndex: 3,
    playedSeconds: 492,
    durationSeconds: 2760,
    playStatus: 'played'
  },
  {
    sourceId: 'system-source-4',
    contentId: 'system-source-4-tv-201',
    type: 'tv',
    episodeId: 'system-source-4-tv-201-ep-1',
    episodeIndex: 1,
    playedSeconds: 1260,
    durationSeconds: 2580,
    playStatus: 'paused'
  },
  {
    sourceId: 'system-source-2',
    contentId: 'system-source-2-movie-101',
    type: 'movie',
    playedSeconds: 12,
    durationSeconds: 7200,
    playStatus: 'played'
  },
  {
    sourceId: 'system-source-4',
    contentId: 'system-source-4-movie-201',
    type: 'movie',
    playedSeconds: 6410,
    durationSeconds: 6420,
    playStatus: 'played'
  },
  {
    sourceId: 'system-source-2',
    contentId: 'system-source-2-tv-101',
    type: 'tv',
    episodeId: 'system-source-2-tv-101-ep-2',
    episodeIndex: 2,
    playedSeconds: 2180,
    durationSeconds: 2820,
    playStatus: 'played'
  }
];

/**
 * 创建收藏记录。
 * 纯函数: 只根据 seed 和 index 返回新对象，不读取或修改运行时 store。
 *
 * @param {object} seed 收藏身份种子。
 * @param {string} seed.sourceId 收藏内容所属真实数据源 id。
 * @param {string} seed.contentId Provider 数据集中真实存在的内容 id。
 * @param {number} index 收藏记录序号。
 * @returns {object} 收藏记录引用对象。
 */
function createFavoriteRecord(seed, index) {
  // 类型: string。
  // 作用: 当前收藏记录的创建时间，使用稳定 mock 时间便于排序验证。
  const favoritedAt = `2026-07-${String(1 + index).padStart(2, '0')}T10:00:00.000Z`;

  // 返回值类型: object。
  // 作用: 收藏记录只保存 sourceId + contentId 引用，不保存完整视频对象。
  return {
    // 类型: string。
    // 作用: 收藏内容所属数据源标识。
    sourceId: seed.sourceId,

    // 类型: string。
    // 作用: 收藏内容 id，对应 ContentItem.id。
    contentId: seed.contentId,

    // 类型: string。
    // 作用: 收藏唯一键，当前规则为 sourceId + contentId。
    favoriteKey: buildFavoriteKey(seed.sourceId, seed.contentId),

    // 类型: string。
    // 作用: 内容实体共享池引用 key，便于后续补全 ContentItem。
    contentKey: buildFavoriteKey(seed.sourceId, seed.contentId),

    // 类型: string。
    // 作用: 首次收藏时间；没有播放历史时用于收藏列表排序。
    favoritedAt,

    // 类型: string。
    // 作用: 收藏记录更新时间；当前 mock 初始化时与 favoritedAt 保持一致。
    updatedAt: favoritedAt
  };
}

/**
 * 创建播放历史记录。
 * 纯函数: 只根据 seed 和 index 返回新对象，不读取或修改运行时 store。
 *
 * @param {object} seed 播放历史种子。
 * @param {string} seed.sourceId 播放内容所属真实数据源 id。
 * @param {string} seed.contentId 内容 id。
 * @param {string} seed.type 内容类型，movie 或 tv。
 * @param {string} seed.episodeId 电视剧剧集 id。
 * @param {number|null} seed.episodeIndex 电视剧剧集序号。
 * @param {number} seed.playedSeconds 已播放秒数。
 * @param {number|null} seed.durationSeconds 总时长秒数。
 * @param {string} seed.playStatus 播放状态。
 * @param {number} index 历史记录序号。
 * @returns {object} 播放历史引用对象。
 */
function createHistoryRecord(seed, index) {
  // 类型: object。
  // 作用: 标准化历史引用字段，确保 buildHistoryKey 可以按电影/电视剧规则生成 key。
  const historyRef = {
    sourceId: seed.sourceId,
    contentId: seed.contentId,
    type: seed.type,
    episodeId: seed.episodeId || '',
    episodeIndex: seed.episodeIndex || null
  };

  // 类型: string。
  // 作用: 当前历史记录首次创建时间，用于超过上限时执行先进先出裁剪。
  const firstPlayedAt = `2026-07-${String(2 + index).padStart(2, '0')}T20:00:00.000Z`;

  // 类型: string。
  // 作用: 当前历史记录最近播放时间，用于历史列表倒序和收藏列表联动排序。
  const lastPlayedAt = `2026-07-${String(2 + index).padStart(2, '0')}T21:${String(index * 7).padStart(2, '0')}:00.000Z`;

  // 返回值类型: object。
  // 作用: 播放历史记录只保存引用、播放进度和分集定位信息，不保存完整 ContentItem。
  return {
    ...historyRef,
    historyKey: buildHistoryKey(historyRef),
    contentKey: buildFavoriteKey(seed.sourceId, seed.contentId),
    firstPlayedAt,
    lastPlayedAt,
    playedSeconds: seed.playedSeconds,
    durationSeconds: seed.durationSeconds,
    playStatus: seed.playStatus || 'played',
    playbackSourceId: '',
    updatedAt: lastPlayedAt
  };
}

// 类型: object。
// 作用: 用户内容状态初始化数据；store 启动时会深拷贝该对象，运行时修改不会写回本文件。
// 字段: user，object，当前游客用户信息。
// 字段: favorites，object，收藏记录集合。
// 字段: playHistory，object，播放历史记录集合。
// 字段: currentPlaying，object|null，当前正在播放状态。
// 字段: resumePolicy，object，播放恢复策略配置。
export const userContentMockData = {
  // 类型: object。
  // 作用: 提供个人中心当前游客资料，运行时 store 会隔离复制该对象。
  user: USER_CONTENT_MOCK_USER,

  // 类型: object。
  // 作用: 提供收藏上限和真实内容引用种子，个人中心通过内容补全服务解析卡片实体。
  favorites: {
    maxRecords: USER_CONTENT_RECORD_LIMIT,
    records: FAVORITE_RECORD_SEEDS.map((seed, index) => createFavoriteRecord(seed, index))
  },

  // 类型: object。
  // 作用: 提供播放历史上限、进度和真实分集引用，供历史列表、卡片状态和恢复播放读取。
  playHistory: {
    maxRecords: USER_CONTENT_RECORD_LIMIT,
    records: HISTORY_RECORD_SEEDS.map((seed, index) => createHistoryRecord(seed, index))
  },

  // 类型: null。
  // 作用: 初始化时没有正在播放内容，进入播放页后由 userContentService 写入真实状态。
  currentPlaying: null,

  // 类型: object。
  // 作用: 保存接近开头和结尾的统一恢复阈值，播放页据此决定从头、续播或提示重播。
  resumePolicy: {
    nearStartThresholdSeconds: 5,
    nearEndThresholdSeconds: 30
  }
};
