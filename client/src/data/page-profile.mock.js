/*
  page-profile.mock.js 模块说明

  - 文件职责:
      提供个人中心页面的本地 mock 数据。
      供 ProfileView.vue 渲染用户资料、播放历史和收藏记录。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      PROFILE_SOURCE_ID: string，个人中心 mock 记录使用的数据源 id。
      PROFILE_SOURCE_NAME: string，个人中心 mock 记录展示的数据源名称。
      PROFILE_PAGE_SIZE: number，个人中心历史和收藏每页展示数量。
      PROFILE_HISTORY_TOTAL: number，播放历史 mock 总数。
      PROFILE_FAVORITE_TOTAL: number，收藏记录 mock 总数。
      PROFILE_TITLE_SEEDS: Array<string>，个人中心视频标题种子。
      PROFILE_GENRE_GROUPS: Array<Array<string>>，个人中心类型组合种子。
      PROFILE_AREA_SEEDS: Array<string>，个人中心地区种子。

  - 模块级变量:
      无

  - 模块级辅助函数:
      padProfileSequence(value)
          - params:
              -- value: number，待格式化的序号。
          - return:
              string，三位序号文本。
          - description:
              生成稳定 record id 和 video id，便于个人中心分页、删除和卡片跳转。
      pickProfileSeed(list, index)
          - params:
              -- list: Array，候选数组。
              -- index: number，当前记录序号。
          - return:
              any，根据序号循环命中的候选值。
          - description:
              让个人中心 mock 记录在标题、地区、类型和清晰度上形成稳定分布。
      createProfileHistoryItem(index)
          - params:
              -- index: number，从 1 开始的历史记录序号。
          - return:
              object，播放历史记录。
          - description:
              生成 VideoCard 可归一化的播放历史 mock 记录。
      createProfileFavoriteItem(index)
          - params:
              -- index: number，从 1 开始的收藏记录序号。
          - return:
              object，收藏记录。
          - description:
              生成 VideoCard 可归一化的收藏 mock 记录。
      createProfileList(total, factory)
          - params:
              -- total: number，需要生成的记录数量。
              -- factory: Function，单条记录生成函数。
          - return:
              Array<object>，个人中心记录列表。
          - description:
              统一生成历史和收藏列表，保证双倍分页数据量稳定。

  - 模块级类:
      无

  - 对外导出:
      profilePageData: object，个人中心页面 mock 数据对象。
*/

// 类型: string。
// 作用: 个人中心 mock 记录使用的数据源 id，VideoCard 点击详情页时会把它作为 sourceId。
const PROFILE_SOURCE_ID = 'mock-source';

// 类型: string。
// 作用: 个人中心 mock 记录展示的数据源名称，卡片来源字段会读取它。
const PROFILE_SOURCE_NAME = 'mock-source';

// 类型: number。
// 作用: 个人中心播放历史和收藏记录每页展示数量，和页面统一分页规则保持一致。
const PROFILE_PAGE_SIZE = 12;

// 类型: number。
// 作用: 播放历史准备双倍分页数据，保证存在第二页。
const PROFILE_HISTORY_TOTAL = PROFILE_PAGE_SIZE * 2;

// 类型: number。
// 作用: 收藏记录准备双倍分页数据，保证存在第二页。
const PROFILE_FAVORITE_TOTAL = PROFILE_PAGE_SIZE * 2;

// 类型: Array<string>。
// 作用: 个人中心历史和收藏共用标题种子，生成 24 条时循环取值。
const PROFILE_TITLE_SEEDS = [
  '无声街区', '晴空档案', '南方列车', '远山回响', '城市边缘', '晨光办公室',
  '夜航电台', '旧日航线', '风雪归途', '无人码头', '边城故事', '北巷人家',
  '长街灯火', '群山来信', '暮色行者', '白塔疑云', '深巷计划', '河湾旅馆'
];

// 类型: Array<Array<string>>。
// 作用: 个人中心卡片类型组合，VideoCard 会读取第一项作为卡片元信息。
const PROFILE_GENRE_GROUPS = [
  ['悬疑', '剧情'],
  ['犯罪', '动作'],
  ['剧情', '家庭'],
  ['职场', '都市'],
  ['年代', '剧情'],
  ['科幻', '冒险']
];

// 类型: Array<string>。
// 作用: 个人中心卡片地区字段候选值。
const PROFILE_AREA_SEEDS = ['中国大陆', '中国香港', '美国', '日本', '韩国', '英国'];

/**
 * 格式化个人中心记录序号。
 * 纯函数: 相同 value 输入始终返回相同文本。
 *
 * @param {number} value 待格式化的序号。
 * @returns {string} 三位序号文本。
 */
function padProfileSequence(value) {
  // 返回值类型: string。
  // 作用: 统一记录 id 和视频 id 的序号长度，方便排序和排查。
  return String(value).padStart(3, '0');
}

/**
 * 根据序号循环读取候选值。
 * 纯函数: 只读取传入数组，不修改数组。
 *
 * @param {Array} list 候选数组。
 * @param {number} index 当前记录序号。
 * @returns {*} 命中的候选值；候选数组为空时返回空字符串。
 */
function pickProfileSeed(list, index) {
  // 条件分支: 候选数组缺失或为空时进入。
  // 执行内容: 返回空字符串，让调用方走自己的兜底逻辑。
  if (!Array.isArray(list) || !list.length) {
    return '';
  }

  // 返回值类型: any。
  // 作用: 通过取模让字段值在候选数组中稳定循环。
  return list[(index - 1) % list.length];
}

/**
 * 创建播放历史记录。
 * 纯函数: 根据序号生成一条可被 ProfileView 归一化的历史数据。
 *
 * @param {number} index 从 1 开始的历史记录序号。
 * @returns {object} 播放历史记录。
 */
function createProfileHistoryItem(index) {
  // 类型: boolean。
  // 作用: 奇数记录模拟电视剧，偶数记录模拟电影，覆盖 VideoCard 两类角标。
  const isTv = index % 2 === 1;

  // 类型: string。
  // 作用: 当前记录视频标题。
  const title = pickProfileSeed(PROFILE_TITLE_SEEDS, index);

  // 类型: Array<string>。
  // 作用: 当前记录类型组合。
  const genres = pickProfileSeed(PROFILE_GENRE_GROUPS, index);

  // 类型: string。
  // 作用: 当前记录三位序号，复用于 recordId 和 videoId。
  const sequence = padProfileSequence(index);

  // 类型: number。
  // 作用: 当前电视剧播放到的集数，电影记录会被 VideoCard 忽略。
  const currentEpisode = (index % 12) + 1;

  // 返回值类型: object。
  // 作用: 播放历史 mock 记录，字段形状兼容 ProfileView.normalizeHistoryItem。
  return {
    id: `history-${sequence}`,
    videoId: `${isTv ? 'tv' : 'movie'}-${sequence}`,
    type: isTv ? 'tv' : 'movie',
    title,
    cover: '',
    poster: '',
    year: String(2026 - ((index - 1) % 4)),
    area: pickProfileSeed(PROFILE_AREA_SEEDS, index),
    genres,
    score: Number((8.9 - ((index - 1) % 12) * 0.1).toFixed(1)),
    quality: index % 3 === 0 ? '1080P' : 'HD',
    episodeLabel: isTv ? `第 ${currentEpisode} 集` : '',
    episodeValue: isTv ? `ep-${padProfileSequence(currentEpisode)}` : '',
    currentEpisode,
    progressText: `看到 ${String(6 + (index % 12)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`,
    playedTimeText: `${String(6 + (index % 12)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`,
    totalTimeText: isTv ? `${42 + (index % 8)}:00` : `${105 + (index % 30)}分钟`,
    episodeDuration: isTv ? `${42 + (index % 8)}:00` : '',
    duration: isTv ? '' : `${105 + (index % 30)}分钟`,
    updatedAt: `2026-06-${String((index % 28) + 1).padStart(2, '0')} 21:${String((index * 3) % 60).padStart(2, '0')}`,
    sourceId: PROFILE_SOURCE_ID,
    sourceName: PROFILE_SOURCE_NAME,
    favorite: index % 4 === 0,
    completed: index % 5 === 0,
    movie: {
      duration: isTv ? '' : `${105 + (index % 30)}分钟`
    },
    tv: {
      updateStatus: isTv ? `更新至${12 + (index % 16)}集` : '',
      totalEpisodes: isTv ? 12 + (index % 16) : ''
    }
  };
}

/**
 * 创建收藏记录。
 * 纯函数: 根据序号生成一条可被 ProfileView 归一化的收藏数据。
 *
 * @param {number} index 从 1 开始的收藏记录序号。
 * @returns {object} 收藏记录。
 */
function createProfileFavoriteItem(index) {
  // 类型: boolean。
  // 作用: 每三条中两条模拟电影、一条模拟电视剧，避免收藏页内容类型过于单一。
  const isTv = index % 3 === 0;

  // 类型: string。
  // 作用: 当前收藏记录标题。
  const title = pickProfileSeed(PROFILE_TITLE_SEEDS, index + 2);

  // 类型: Array<string>。
  // 作用: 当前收藏记录类型组合。
  const genres = pickProfileSeed(PROFILE_GENRE_GROUPS, index + 1);

  // 类型: string。
  // 作用: 当前记录三位序号，复用于 recordId 和 videoId。
  const sequence = padProfileSequence(index);

  // 返回值类型: object。
  // 作用: 收藏 mock 记录，字段形状兼容 ProfileView.normalizeFavoriteItem。
  return {
    id: `favorite-${sequence}`,
    videoId: `${isTv ? 'tv' : 'movie'}-${padProfileSequence(index + 12)}`,
    type: isTv ? 'tv' : 'movie',
    title,
    cover: '',
    poster: '',
    year: String(2026 - ((index + 1) % 4)),
    area: pickProfileSeed(PROFILE_AREA_SEEDS, index + 1),
    genres,
    score: Number((8.8 - ((index - 1) % 10) * 0.1).toFixed(1)),
    quality: index % 4 === 0 ? '4K' : 'HD',
    summary: `${title}收藏记录，用于验证个人中心收藏分页和统一 VideoCard 布局。`,
    rating: Number((8.8 - ((index - 1) % 10) * 0.1).toFixed(1)),
    duration: isTv ? '' : `${100 + (index % 35)}分钟`,
    sourceId: PROFILE_SOURCE_ID,
    sourceName: PROFILE_SOURCE_NAME,
    played: index % 6 === 0,
    playedTimeText: index % 6 === 0 ? `${String(4 + (index % 10)).padStart(2, '0')}:15` : '00:00',
    totalTimeText: isTv ? `${44 + (index % 7)}:00` : `${100 + (index % 35)}分钟`,
    completed: index % 7 === 0,
    movie: {
      duration: isTv ? '' : `${100 + (index % 35)}分钟`
    },
    tv: {
      updateStatus: isTv ? `全${16 + (index % 18)}集` : '',
      totalEpisodes: isTv ? 16 + (index % 18) : ''
    }
  };
}

/**
 * 创建个人中心记录列表。
 * 纯函数: 根据数量和工厂函数生成新数组。
 *
 * @param {number} total 需要生成的记录数量。
 * @param {Function} factory 单条记录生成函数。
 * @returns {Array<object>} 个人中心记录列表。
 */
function createProfileList(total, factory) {
  // 返回值类型: Array<object>。
  // 作用: 生成固定数量记录，保证历史和收藏都有第二页数据。
  return Array.from({ length: total }, (unusedValue, itemIndex) => factory(itemIndex + 1));
}

// 类型: object。
// 作用: 个人中心页本地数据，固定个人信息、播放历史、收藏列表和本地操作入口字段形状。
// 字段: user，object，顶部用户信息卡数据。
// 字段: playHistory，Array<object>，播放历史记录，当前准备 24 条。
// 字段: favorites，Array<object>，收藏记录，当前准备 24 条。
// 字段: localActions，Array<object>，本地数据操作入口。
export const profilePageData = {
  // user 驱动页面顶部用户信息卡；为 null 时用户卡显示游客空状态。
  user: {
    id: 'guest-user',
    name: '游客用户',
    role: 'guest',
    status: 'local',
    message: '当前数据保存在本地浏览器中。'
  },

  // playHistory 驱动播放历史区；每页 12 条，当前准备 24 条用于验证翻页。
  playHistory: createProfileList(PROFILE_HISTORY_TOTAL, createProfileHistoryItem),

  // favorites 驱动收藏列表区；每页 12 条，当前准备 24 条用于验证翻页。
  favorites: createProfileList(PROFILE_FAVORITE_TOTAL, createProfileFavoriteItem),

  // localActions 驱动本地数据操作区；数组为空时该分区显示暂无操作。
  localActions: [
    {
      id: 'clear-history',
      label: '清理播放历史',
      description: '删除当前浏览器保存的播放历史记录。',
      danger: false
    },
    {
      id: 'clear-favorites',
      label: '清理收藏列表',
      description: '删除当前浏览器保存的收藏记录。',
      danger: false
    },
    {
      id: 'reset-local-data',
      label: '重置本地数据',
      description: '清空播放历史、收藏和本地页面状态。',
      danger: true
    }
  ]
};
