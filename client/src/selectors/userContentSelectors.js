/*
  userContentSelectors.js 模块说明

  - 文件职责:
      提供用户内容状态的统一读取 selector。
      供 VideoCard、个人中心、详情页和播放页后续读取收藏状态、播放历史和当前播放状态。
      页面不应直接读取 userContentStore 内部数组结构。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      userContentStore: 自定义 store，用户内容运行时状态。
      buildFavoriteKey/buildHistoryKey: 自定义工具函数，生成收藏和历史唯一 key。
      buildContentKey: 自定义工具函数，生成内容实体 key。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      asRecordList(value)
          - params:
              -- value: any，待转换的记录列表。
          - return:
              Array<object>，安全记录数组。
          - description:
              将异常 records 兜底为空数组，保证 selector 稳定。
      toTimestamp(value)
          - params:
              -- value: string，时间文本。
          - return:
              number，时间戳。
          - description:
              把 ISO 时间转成可排序数字，异常时间按 0 处理。

  - 模块级类:
      无

  - 对外导出:
      getUserContentUser: Function，读取用户资料。
      getFavoriteRecords: Function，读取收藏记录原始数组。
      getPlayHistoryRecords: Function，读取播放历史原始数组。
      getFavoriteRecord: Function，读取指定内容收藏记录。
      isFavoriteContent: Function，判断内容是否已收藏。
      getLatestPlayHistoryRecord: Function，读取指定内容最近播放记录。
      getHistoryRecord: Function，读取指定电影或电视剧单集历史记录。
      getFavoriteRecordByKey: Function，按收藏记录键读取恢复目标。
      getHistoryRecordByKey: Function，按历史记录键读取恢复目标。
      getFavoriteRecordsForDisplay: Function，读取按显示规则排序的收藏记录。
      getPlayHistoryRecordsForDisplay: Function，读取按最近播放排序的历史记录。
      getContentUserStatus: Function，读取单个 ContentItem 的用户状态聚合。
*/

// 导入来源: ../store/userContentStore。
// 导入内容: userContentStore 用户内容运行时状态。
// 文件作用: selector 从该 store 读取收藏、历史和当前播放状态。
import { userContentStore } from '../store/userContentStore.js';

import {
  // 导入来源: ../utils/userContentKeys。
  // 导入内容: buildFavoriteKey 收藏 key 生成函数。
  // 文件作用: 读取收藏状态时统一定位收藏记录。
  buildFavoriteKey,

  // 导入来源: ../utils/userContentKeys。
  // 导入内容: buildHistoryKey 历史 key 生成函数。
  // 文件作用: 读取电影或电视剧单集历史时统一定位历史记录。
  buildHistoryKey
} from '../utils/userContentKeys.js';

// 导入来源: ../utils/contentKeys。
// 导入内容: buildContentKey 内容实体 key 生成函数。
// 文件作用: 读取同一内容的最近播放记录时使用 sourceId + contentId 匹配。
import { buildContentKey } from '../utils/contentKeys.js';

/**
 * 转换安全记录数组。
 * 纯函数: 只读取 value，不修改传入对象或 store。
 *
 * @param {*} value 待转换的 records 字段。
 * @returns {Array<object>} 安全记录数组。
 */
function asRecordList(value) {
  // 返回值类型: Array<object>。
  // 作用: records 异常时返回空数组，避免 selector 调用 map/filter/sort 时报错。
  return Array.isArray(value) ? value : [];
}

/**
 * 将时间文本转成可排序时间戳。
 * 纯函数: 只读取 value，不修改外部状态。
 * 兜底策略: 时间为空或无法解析时返回 0，使异常记录排在最后。
 *
 * @param {string} value 时间文本。
 * @returns {number} 时间戳。
 */
function toTimestamp(value) {
  // 类型: number。
  // 作用: Date.parse 返回毫秒时间戳，异常时间会得到 NaN。
  const timestamp = Date.parse(value || '');

  // 返回值类型: number。
  // 作用: 合法时间返回 timestamp，异常时间返回 0 参与排序兜底。
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * 读取当前用户资料。
 * 纯函数: 只读取 userContentStore.user，不修改 store。
 *
 * @returns {object|null} 当前用户资料。
 */
export function getUserContentUser() {
  // 返回值类型: object|null。
  // 作用: user 缺失时返回 null，让个人中心自行决定游客空态。
  return userContentStore.user || null;
}

/**
 * 读取收藏记录原始数组。
 * 纯函数: 只读取 userContentStore.favorites.records，不修改 store。
 *
 * @returns {Array<object>} 收藏记录数组。
 */
export function getFavoriteRecords() {
  // 类型: object。
  // 作用: favorites 缺失时使用空对象兜底。
  const favorites = userContentStore.favorites || {};

  // 返回值类型: Array<object>。
  // 作用: 返回收藏记录数组，调用方不要直接修改该数组。
  return asRecordList(favorites.records);
}

/**
 * 读取播放历史记录原始数组。
 * 纯函数: 只读取 userContentStore.playHistory.records，不修改 store。
 *
 * @returns {Array<object>} 播放历史记录数组。
 */
export function getPlayHistoryRecords() {
  // 类型: object。
  // 作用: playHistory 缺失时使用空对象兜底。
  const playHistory = userContentStore.playHistory || {};

  // 返回值类型: Array<object>。
  // 作用: 返回播放历史记录数组，调用方不要直接修改该数组。
  return asRecordList(playHistory.records);
}

/**
 * 读取指定内容的收藏记录。
 * 纯函数: 只读取收藏记录数组，不修改 store。
 *
 * @param {string} sourceId 内容所属数据源 id。
 * @param {string} contentId 内容 id。
 * @returns {object|null} 收藏记录；未收藏时返回 null。
 */
export function getFavoriteRecord(sourceId, contentId) {
  // 类型: string。
  // 作用: 使用统一收藏 key 定位目标记录。
  const favoriteKey = buildFavoriteKey(sourceId, contentId);

  // 条件分支: favoriteKey 不可用时进入。
  // 执行内容: 返回 null，表示无法判断收藏状态。
  if (!favoriteKey) {
    return null;
  }

  // 返回值类型: object|null。
  // 作用: 返回匹配收藏记录；不存在时返回 null。
  return getFavoriteRecords().find(record => record.favoriteKey === favoriteKey) || null;
}

/**
 * 按收藏记录键读取跨源恢复目标。
 * 纯函数: 只读取收藏投影；记录不存在或 key 为空时返回 null。
 *
 * @param {string} favoriteKey 收藏记录稳定键。
 * @returns {object|null} 匹配收藏记录或 null。
 */
export function getFavoriteRecordByKey(favoriteKey) {
  // 条件分支: key 不是非空字符串时进入；执行内容: 返回 null，不进行模糊匹配。
  if (typeof favoriteKey !== 'string' || !favoriteKey.trim()) return null;
  return getFavoriteRecords().find(record => record.favoriteKey === favoriteKey) || null;
}

/**
 * 判断指定内容是否已收藏。
 * 纯函数: 只读取收藏记录，不修改 store。
 *
 * @param {string} sourceId 内容所属数据源 id。
 * @param {string} contentId 内容 id。
 * @returns {boolean} true 表示已收藏，false 表示未收藏。
 */
export function isFavoriteContent(sourceId, contentId) {
  // 返回值类型: boolean。
  // 作用: 把收藏记录存在性转换成组件可直接使用的布尔状态。
  return Boolean(getFavoriteRecord(sourceId, contentId));
}

/**
 * 读取指定电影或电视剧单集的历史记录。
 * 纯函数: 只读取播放历史记录，不修改 store。
 *
 * @param {object} recordRef 历史记录引用对象。
 * @param {string} recordRef.sourceId 内容所属数据源 id。
 * @param {string} recordRef.contentId 内容 id。
 * @param {string} recordRef.type 内容类型。
 * @param {string} recordRef.episodeId 电视剧剧集 id。
 * @param {number|null} recordRef.episodeIndex 电视剧剧集序号。
 * @returns {object|null} 匹配播放历史；不存在时返回 null。
 */
export function getHistoryRecord(recordRef) {
  // 类型: string。
  // 作用: 使用统一历史 key 定位电影历史或电视剧单集历史。
  const historyKey = buildHistoryKey(recordRef);

  // 条件分支: historyKey 不可用时进入。
  // 执行内容: 返回 null，让调用方按未播放处理。
  if (!historyKey) {
    return null;
  }

  // 返回值类型: object|null。
  // 作用: 返回匹配历史记录；不存在时返回 null。
  return getPlayHistoryRecords().find(record => record.historyKey === historyKey) || null;
}

/**
 * 按历史记录键读取跨源恢复目标。
 * 纯函数: 只读取播放历史投影；记录不存在或 key 为空时返回 null。
 *
 * @param {string} historyKey 播放历史稳定键。
 * @returns {object|null} 匹配历史记录或 null。
 */
export function getHistoryRecordByKey(historyKey) {
  // 条件分支: key 不是非空字符串时进入；执行内容: 返回 null，不尝试按内容级 key 猜测。
  if (typeof historyKey !== 'string' || !historyKey.trim()) return null;
  return getPlayHistoryRecords().find(record => record.historyKey === historyKey) || null;
}

/**
 * 读取指定内容最近一次播放历史。
 * 纯函数: 只读取播放历史数组，不修改 store。
 * 使用场景: VideoCard 和收藏列表需要按整部内容显示最近播放状态。
 *
 * @param {string} sourceId 内容所属数据源 id。
 * @param {string} contentId 内容 id。
 * @returns {object|null} 最近播放历史记录；从未播放时返回 null。
 */
export function getLatestPlayHistoryRecord(sourceId, contentId) {
  // 类型: string。
  // 作用: 生成内容级 key，用于匹配同一电影或同一电视剧下所有分集历史。
  const contentKey = buildContentKey(sourceId, contentId);

  // 条件分支: contentKey 不可用时进入。
  // 执行内容: 返回 null，避免误匹配其它历史。
  if (!contentKey) {
    return null;
  }

  // 类型: Array<object>。
  // 作用: 筛出同一内容下的所有历史记录，再按最近播放时间倒序。
  const matchedRecords = getPlayHistoryRecords()
    .filter(record => record.contentKey === contentKey)
    .sort((previousRecord, nextRecord) => toTimestamp(nextRecord.lastPlayedAt) - toTimestamp(previousRecord.lastPlayedAt));

  // 返回值类型: object|null。
  // 作用: 返回最近一条播放历史；没有记录时返回 null。
  return matchedRecords[0] || null;
}

/**
 * 读取按展示规则排序的收藏记录。
 * 纯函数: 返回新数组，不修改 userContentStore.favorites.records。
 * 排序规则: 有播放历史的收藏按最近播放时间倒序，没有播放历史的按收藏时间倒序。
 *
 * @returns {Array<object>} 排序后的收藏记录数组。
 */
export function getFavoriteRecordsForDisplay() {
  // 返回值类型: Array<object>。
  // 作用: 复制收藏数组后排序，避免直接修改 store 中的原数组顺序。
  return [...getFavoriteRecords()].sort((previousRecord, nextRecord) => {
    // 类型: object|null。
    // 作用: 读取前一个收藏对应内容的最近播放记录。
    const previousHistory = getLatestPlayHistoryRecord(previousRecord.sourceId, previousRecord.contentId);

    // 类型: object|null。
    // 作用: 读取后一个收藏对应内容的最近播放记录。
    const nextHistory = getLatestPlayHistoryRecord(nextRecord.sourceId, nextRecord.contentId);

    // 类型: number。
    // 作用: 有播放记录时使用最近播放时间，否则使用收藏时间。
    const previousSortTime = toTimestamp(previousHistory ? previousHistory.lastPlayedAt : previousRecord.favoritedAt);

    // 类型: number。
    // 作用: 有播放记录时使用最近播放时间，否则使用收藏时间。
    const nextSortTime = toTimestamp(nextHistory ? nextHistory.lastPlayedAt : nextRecord.favoritedAt);

    // 返回值类型: number。
    // 作用: 倒序排序，最近发生用户行为的内容排在前面。
    return nextSortTime - previousSortTime;
  });
}

/**
 * 读取按最近播放时间排序的播放历史记录。
 * 纯函数: 返回新数组，不修改 userContentStore.playHistory.records。
 *
 * @returns {Array<object>} 排序后的历史记录数组。
 */
export function getPlayHistoryRecordsForDisplay() {
  // 返回值类型: Array<object>。
  // 作用: 按 lastPlayedAt 倒序返回历史列表，给个人中心历史记录页使用。
  return [...getPlayHistoryRecords()].sort(
    (previousRecord, nextRecord) => toTimestamp(nextRecord.lastPlayedAt) - toTimestamp(previousRecord.lastPlayedAt)
  );
}

/**
 * 读取单个 ContentItem 对应的用户内容状态。
 * 纯函数: 只读取用户内容 store，不修改传入 contentItem 或 store。
 * 使用场景: 后续 VideoCard、详情页和播放页统一读取收藏和播放状态。
 *
 * @param {object} contentItem 统一内容对象。
 * @returns {object} 用户内容状态聚合。
 * @returns {boolean} return.favorite 当前内容是否已收藏。
 * @returns {object|null} return.favoriteRecord 收藏记录。
 * @returns {object|null} return.latestPlaybackRecord 最近播放记录。
 * @returns {boolean} return.isPlaying 当前内容是否正在播放。
 */
export function getContentUserStatus(contentItem) {
  // 类型: object。
  // 作用: contentItem 异常时使用空对象兜底，保证 selector 稳定返回未收藏/未播放状态。
  const safeContentItem = contentItem && typeof contentItem === 'object' ? contentItem : {};

  // 类型: string。
  // 作用: 当前内容所属数据源 id。
  const sourceId = safeContentItem.sourceId || '';

  // 类型: string。
  // 作用: 当前内容 id。
  const contentId = safeContentItem.id || '';

  // 类型: object|null。
  // 作用: 当前内容收藏记录。
  const favoriteRecord = getFavoriteRecord(sourceId, contentId);

  // 类型: object|null。
  // 作用: 当前内容最近一次播放历史，不区分电视剧具体集。
  const latestPlaybackRecord = getLatestPlayHistoryRecord(sourceId, contentId);

  // 类型: object|null。
  // 作用: 当前正在播放状态，后续播放页更新后 VideoCard 可据此显示正在播放。
  const currentPlaying = userContentStore.currentPlaying || null;

  // 类型: boolean。
  // 作用: 判断当前播放状态是否指向同一 sourceId + contentId。
  const isPlaying = Boolean(
    currentPlaying
      && currentPlaying.sourceId === sourceId
      && currentPlaying.contentId === contentId
  );

  // 返回值类型: object。
  // 作用: 返回组件可直接消费的用户内容状态聚合，不暴露 store 内部结构。
  return {
    favorite: Boolean(favoriteRecord),
    favoriteRecord,
    latestPlaybackRecord,
    isPlaying
  };
}
