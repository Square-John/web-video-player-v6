/*
  userContentService.js 模块说明

  - 文件职责:
      提供项目内部用户内容状态的写入服务。
      封装收藏切换、播放历史写入、历史删除、清空列表、当前播放状态和恢复播放判断。
      当前项目只修改 userContentStore 内存状态，不写浏览器存储、数据库或 mock 文件。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      userContentStore/replaceFavoriteRecords/replacePlayHistoryRecords/setCurrentPlaying: 自定义 store，读取和写入用户内容运行态。
      buildFavoriteKey/buildHistoryKey: 自定义工具函数，生成收藏和历史唯一 key。
      buildContentKey: 自定义工具函数，生成内容实体引用 key。
      getFavoriteRecord/getHistoryRecord: 自定义 selector，读取当前收藏和历史记录。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      getNowIso()
          - params:
              无
          - return:
              string，当前 ISO 时间。
          - description:
              统一生成用户内容状态更新时间。
      normalizeContentRef(input)
          - params:
              -- input: object，ContentItem 或内容引用对象。
          - return:
              object，标准内容引用。
          - description:
              将 ContentItem 或引用对象整理成 sourceId/contentId/type。
      trimRecordsByFifo(records, limit, timeField)
          - params:
              -- records: Array<object>，待裁剪记录数组。
              -- limit: number，最大保留数量。
              -- timeField: string，先进先出判断时间字段。
          - return:
              Array<object>，裁剪后的记录数组。
          - description:
              超过上限时删除最早创建的记录，保持最多 100 条。

  - 模块级类:
      无

  - 对外导出:
      toggleFavorite: Function，切换收藏状态。
      addFavorite: Function，添加收藏记录。
      removeFavorite: Function，移除收藏记录。
      clearFavorites: Function，清空收藏记录。
      upsertPlayHistory: Function，新增或更新播放历史。
      removePlayHistory: Function，删除播放历史记录。
      clearPlayHistory: Function，清空播放历史。
      updateCurrentPlaying: Function，写入当前播放状态。
      getPlaybackResumeDecision: Function，计算恢复播放策略。
*/

import {
  // 导入来源: ../store/userContentStore。
  // 导入内容: userContentStore 用户内容运行时状态。
  // 文件作用: 读取记录上限和恢复播放策略。
  userContentStore,

  // 导入来源: ../store/userContentStore。
  // 导入内容: replaceFavoriteRecords 收藏记录替换函数。
  // 文件作用: 收藏增删和清空后统一写回响应式数组。
  replaceFavoriteRecords,

  // 导入来源: ../store/userContentStore。
  // 导入内容: replacePlayHistoryRecords 历史记录替换函数。
  // 文件作用: 播放历史新增、更新、删除和清空后统一写回响应式数组。
  replacePlayHistoryRecords,

  // 导入来源: ../store/userContentStore。
  // 导入内容: setCurrentPlaying 当前播放状态写入函数。
  // 文件作用: 播放页开始播放、暂停或停止时更新全站当前播放状态。
  setCurrentPlaying
} from '../store/userContentStore.js';

import {
  // 导入来源: ../utils/userContentKeys。
  // 导入内容: buildFavoriteKey 收藏 key 生成函数。
  // 文件作用: 收藏新增、取消和查询时统一定位记录。
  buildFavoriteKey,

  // 导入来源: ../utils/userContentKeys。
  // 导入内容: buildHistoryKey 播放历史 key 生成函数。
  // 文件作用: 电影和电视剧历史写入时统一定位记录。
  buildHistoryKey
} from '../utils/userContentKeys.js';

// 导入来源: ../utils/contentKeys。
// 导入内容: buildContentKey 内容实体 key 生成函数。
// 文件作用: 用户内容记录保存 contentKey，后续通过内容共享池补全 ContentItem。
import { buildContentKey } from '../utils/contentKeys.js';

import {
  // 导入来源: ../selectors/userContentSelectors。
  // 导入内容: getFavoriteRecord 收藏记录读取 selector。
  // 文件作用: 切换收藏前判断当前内容是否已经收藏。
  getFavoriteRecord,

  // 导入来源: ../selectors/userContentSelectors。
  // 导入内容: getHistoryRecord 历史记录读取 selector。
  // 文件作用: 写入播放历史前判断当前电影或电视剧单集是否已有记录。
  getHistoryRecord
} from '../selectors/userContentSelectors.js';

/**
 * 生成当前 ISO 时间。
 * 纯函数: 除读取系统当前时间外，不修改外部状态。
 *
 * @returns {string} 当前 ISO 时间文本。
 */
function getNowIso() {
  // 返回值类型: string。
  // 作用: 统一用户内容状态的更新时间格式。
  return new Date().toISOString();
}

/**
 * 标准化内容引用。
 * 纯函数: 只读取 input，不修改传入对象。
 * 兜底策略: contentId 缺失时读取 ContentItem.id。
 *
 * @param {object} input ContentItem 或内容引用对象。
 * @returns {object} 标准内容引用。
 * @returns {string} return.sourceId 内容所属数据源 id。
 * @returns {string} return.contentId 内容 id。
 * @returns {string} return.type 内容类型。
 */
function normalizeContentRef(input) {
  // 类型: object。
  // 作用: input 不是对象时使用空对象兜底，保证失败路径可控。
  const safeInput = input && typeof input === 'object' ? input : {};

  // 返回值类型: object。
  // 作用: 返回用户内容记录需要的基础引用字段。
  return {
    sourceId: safeInput.sourceId || '',
    contentId: safeInput.contentId || safeInput.id || '',
    type: safeInput.type || 'movie'
  };
}

/**
 * 按先进先出规则裁剪记录。
 * 纯函数: 返回新数组，不修改传入 records。
 * 裁剪策略: 超过 limit 时按 timeField 时间升序删除最早创建的记录。
 *
 * @param {Array<object>} records 待裁剪记录数组。
 * @param {number} limit 最大保留数量。
 * @param {string} timeField 判断先进先出的时间字段。
 * @returns {Array<object>} 裁剪后的记录数组。
 */
function trimRecordsByFifo(records, limit, timeField) {
  // 类型: Array<object>。
  // 作用: 非数组输入兜底为空数组，避免排序和切片异常。
  const safeRecords = Array.isArray(records) ? records : [];

  // 类型: number。
  // 作用: limit 异常时默认保留 100 条，符合当前用户内容上限规则。
  const safeLimit = Number(limit) > 0 ? Number(limit) : 100;

  // 条件分支: 当前数量没有超过上限时进入。
  // 执行内容: 返回浅拷贝，避免调用方误以为可以修改原数组。
  if (safeRecords.length <= safeLimit) {
    return [...safeRecords];
  }

  // 类型: Array<object>。
  // 作用: 按创建时间从新到旧排序，再截取前 limit 条，相当于删除最早进入的记录。
  const trimmedRecords = [...safeRecords]
    .sort((previousRecord, nextRecord) => Date.parse(nextRecord[timeField] || '') - Date.parse(previousRecord[timeField] || ''))
    .slice(0, safeLimit);

  // 返回值类型: Array<object>。
  // 作用: 返回裁剪结果，service 后续写回对应记录集合。
  return trimmedRecords;
}

/**
 * 添加收藏记录。
 * 副作用: 写入 userContentStore.favorites.records。
 * 失败路径: sourceId 或 contentId 缺失时返回 null，不写入记录。
 *
 * @param {object} contentRef ContentItem 或内容引用对象。
 * @returns {object|null} 新增或已有的收藏记录。
 */
export function addFavorite(contentRef) {
  // 类型: object。
  // 作用: 标准化外部传入内容引用。
  const normalizedRef = normalizeContentRef(contentRef);

  // 类型: string。
  // 作用: 生成收藏唯一 key，收藏按整部内容维度保存。
  const favoriteKey = buildFavoriteKey(normalizedRef.sourceId, normalizedRef.contentId);

  // 条件分支: 收藏 key 不可用时进入。
  // 执行内容: 返回 null，避免写入无法补全内容的收藏记录。
  if (!favoriteKey) {
    return null;
  }

  // 类型: object|null。
  // 作用: 当前内容已有收藏记录时直接返回，避免重复收藏。
  const existingRecord = getFavoriteRecord(normalizedRef.sourceId, normalizedRef.contentId);

  // 条件分支: 收藏记录已存在时进入。
  // 执行内容: 返回已有记录，不改变收藏时间。
  if (existingRecord) {
    return existingRecord;
  }

  // 类型: string。
  // 作用: 当前收藏时间，同时作为首次收藏时间和更新时间。
  const now = getNowIso();

  // 类型: object。
  // 作用: 新收藏记录只保存引用，不保存完整 ContentItem。
  const favoriteRecord = {
    sourceId: normalizedRef.sourceId,
    contentId: normalizedRef.contentId,
    favoriteKey,
    contentKey: buildContentKey(normalizedRef.sourceId, normalizedRef.contentId),
    favoritedAt: now,
    updatedAt: now
  };

  // 类型: Array<object>。
  // 作用: 合并新收藏并按先进先出规则控制最大 100 条。
  const nextRecords = trimRecordsByFifo(
    [...userContentStore.favorites.records, favoriteRecord],
    userContentStore.favorites.maxRecords,
    'favoritedAt'
  );

  // 副作用: 写回收藏记录数组。
  // 影响范围: 所有收藏状态 selector 和个人中心收藏列表。
  replaceFavoriteRecords(nextRecords);

  // 返回值类型: object。
  // 作用: 返回新收藏记录，便于调用方更新按钮状态。
  return favoriteRecord;
}

/**
 * 移除收藏记录。
 * 副作用: 写入 userContentStore.favorites.records。
 *
 * @param {object} contentRef ContentItem 或内容引用对象。
 * @returns {boolean} true 表示删除了记录，false 表示没有命中收藏。
 */
export function removeFavorite(contentRef) {
  // 类型: object。
  // 作用: 标准化外部传入内容引用。
  const normalizedRef = normalizeContentRef(contentRef);

  // 类型: string。
  // 作用: 生成待删除收藏 key。
  const favoriteKey = buildFavoriteKey(normalizedRef.sourceId, normalizedRef.contentId);

  // 条件分支: 收藏 key 不可用时进入。
  // 执行内容: 返回 false，表示没有删除任何记录。
  if (!favoriteKey) {
    return false;
  }

  // 类型: Array<object>。
  // 作用: 删除目标收藏记录。
  const nextRecords = userContentStore.favorites.records.filter(record => record.favoriteKey !== favoriteKey);

  // 类型: boolean。
  // 作用: 判断记录数量是否变化，用于告诉调用方是否真的删除。
  const removed = nextRecords.length !== userContentStore.favorites.records.length;

  // 副作用: 写回收藏记录数组。
  // 影响范围: 所有收藏状态 selector 和个人中心收藏列表。
  replaceFavoriteRecords(nextRecords);

  // 返回值类型: boolean。
  // 作用: 返回删除结果。
  return removed;
}

/**
 * 切换收藏状态。
 * 副作用: 根据当前收藏状态新增或删除收藏记录。
 *
 * @param {object} contentRef ContentItem 或内容引用对象。
 * @returns {object} 收藏切换结果。
 * @returns {boolean} return.favorite 切换后是否已收藏。
 * @returns {object|null} return.record 切换后的收藏记录。
 */
export function toggleFavorite(contentRef) {
  // 类型: object。
  // 作用: 标准化外部传入内容引用。
  const normalizedRef = normalizeContentRef(contentRef);

  // 类型: object|null。
  // 作用: 判断当前内容是否已经收藏。
  const existingRecord = getFavoriteRecord(normalizedRef.sourceId, normalizedRef.contentId);

  // 条件分支: 已收藏时进入。
  // 执行内容: 删除收藏并返回未收藏状态。
  if (existingRecord) {
    removeFavorite(normalizedRef);

    return {
      favorite: false,
      record: null
    };
  }

  // 类型: object|null。
  // 作用: 未收藏时新增收藏记录。
  const record = addFavorite(normalizedRef);

  // 返回值类型: object。
  // 作用: 返回切换后的收藏状态。
  return {
    favorite: Boolean(record),
    record
  };
}

/**
 * 清空收藏记录。
 * 副作用: 将 userContentStore.favorites.records 替换为空数组。
 *
 * @returns {Array<object>} 清空后的收藏记录数组。
 */
export function clearFavorites() {
  // 返回值类型: Array<object>。
  // 作用: 返回空收藏列表，便于页面清空后同步分页。
  return replaceFavoriteRecords([]);
}

/**
 * 新增或更新播放历史。
 * 副作用: 写入 userContentStore.playHistory.records。
 * 失败路径: 内容引用缺失、电视剧缺少 episodeId/episodeIndex 时返回 null。
 *
 * @param {object} payload 播放历史写入参数。
 * @param {object} payload.contentItem 当前播放 ContentItem。
 * @param {string} payload.sourceId 内容所属数据源 id。
 * @param {string} payload.contentId 内容 id。
 * @param {string} payload.type 内容类型。
 * @param {object} payload.episode 当前播放剧集对象。
 * @param {string} payload.episodeId 当前播放剧集 id。
 * @param {number|null} payload.episodeIndex 当前播放剧集序号。
 * @param {number} payload.playedSeconds 已播放秒数。
 * @param {number|null} payload.durationSeconds 总时长秒数。
 * @param {string} payload.playStatus 播放状态。
 * @param {string} payload.playbackSourceId 播放线路 id。
 * @returns {object|null} 写入后的播放历史记录。
 */
export function upsertPlayHistory(payload) {
  // 类型: object。
  // 作用: payload 不是对象时使用空对象兜底。
  const safePayload = payload && typeof payload === 'object' ? payload : {};

  // 类型: object。
  // 作用: 优先从 contentItem 读取引用字段，再使用显式 payload 字段覆盖。
  const contentRef = normalizeContentRef({
    ...(safePayload.contentItem || {}),
    sourceId: safePayload.sourceId || (safePayload.contentItem && safePayload.contentItem.sourceId),
    contentId: safePayload.contentId || (safePayload.contentItem && safePayload.contentItem.id),
    type: safePayload.type || (safePayload.contentItem && safePayload.contentItem.type)
  });

  // 类型: object。
  // 作用: 当前播放剧集对象，播放页后续可以直接传入 selectedEpisode。
  const episode = safePayload.episode && typeof safePayload.episode === 'object' ? safePayload.episode : {};

  // 类型: object。
  // 作用: 构造历史 key 所需字段，电视剧会按 episodeId 或 episodeIndex 区分不同集。
  const historyRef = {
    ...contentRef,
    episodeId: safePayload.episodeId || episode.id || '',
    episodeIndex: safePayload.episodeIndex || episode.episodeNumber || null
  };

  // 类型: string。
  // 作用: 生成电影或电视剧单集历史唯一 key。
  const historyKey = buildHistoryKey(historyRef);

  // 条件分支: 历史 key 不可用时进入。
  // 执行内容: 返回 null，避免写入无法匹配或无法恢复的播放历史。
  if (!historyKey) {
    return null;
  }

  // 类型: object|null。
  // 作用: 查找已有历史记录，命中时更新播放进度而不是新增重复记录。
  const existingRecord = getHistoryRecord(historyRef);

  // 类型: string。
  // 作用: 最近播放时间，显式传入时使用外部时间，否则使用当前时间。
  const now = safePayload.lastPlayedAt || getNowIso();

  // 类型: object。
  // 作用: 构造待写入历史记录，保留首次播放时间并更新最近播放状态。
  const nextRecord = {
    sourceId: contentRef.sourceId,
    contentId: contentRef.contentId,
    type: contentRef.type,
    episodeId: historyRef.episodeId,
    episodeIndex: historyRef.episodeIndex,
    historyKey,
    contentKey: buildContentKey(contentRef.sourceId, contentRef.contentId),
    firstPlayedAt: existingRecord ? existingRecord.firstPlayedAt : now,
    lastPlayedAt: now,
    playedSeconds: Number(safePayload.playedSeconds) > 0 ? Number(safePayload.playedSeconds) : 0,
    durationSeconds: Number(safePayload.durationSeconds) > 0 ? Number(safePayload.durationSeconds) : null,
    playStatus: safePayload.playStatus || 'played',
    playbackSourceId: safePayload.playbackSourceId || '',
    updatedAt: now
  };

  // 类型: Array<object>。
  // 作用: 移除旧记录后追加新记录，保证同一 historyKey 只有一条记录。
  const mergedRecords = [
    ...userContentStore.playHistory.records.filter(record => record.historyKey !== historyKey),
    nextRecord
  ];

  // 类型: Array<object>。
  // 作用: 历史记录超过上限时按首次播放时间执行先进先出裁剪。
  const nextRecords = trimRecordsByFifo(
    mergedRecords,
    userContentStore.playHistory.maxRecords,
    'firstPlayedAt'
  );

  // 副作用: 写回播放历史记录数组。
  // 影响范围: VideoCard 播放状态、个人中心历史列表和收藏排序。
  replacePlayHistoryRecords(nextRecords);

  // 返回值类型: object。
  // 作用: 返回写入后的历史记录，方便播放页继续计算恢复策略。
  return nextRecord;
}

/**
 * 删除播放历史记录。
 * 副作用: 写入 userContentStore.playHistory.records。
 *
 * @param {string|object} target 历史 key 或历史引用对象。
 * @returns {boolean} true 表示删除了记录，false 表示没有命中记录。
 */
export function removePlayHistory(target) {
  // 类型: string。
  // 作用: target 是字符串时直接作为 historyKey；对象时使用 buildHistoryKey 生成。
  const historyKey = typeof target === 'string' ? target : buildHistoryKey(target);

  // 条件分支: historyKey 不可用时进入。
  // 执行内容: 返回 false，避免清理错误记录。
  if (!historyKey) {
    return false;
  }

  // 类型: Array<object>。
  // 作用: 过滤掉目标历史记录。
  const nextRecords = userContentStore.playHistory.records.filter(record => record.historyKey !== historyKey);

  // 类型: boolean。
  // 作用: 判断是否真的删除了记录。
  const removed = nextRecords.length !== userContentStore.playHistory.records.length;

  // 副作用: 写回播放历史记录数组。
  // 影响范围: 历史列表、VideoCard 播放状态和收藏排序。
  replacePlayHistoryRecords(nextRecords);

  // 返回值类型: boolean。
  // 作用: 返回删除结果。
  return removed;
}

/**
 * 清空播放历史。
 * 副作用: 将 userContentStore.playHistory.records 替换为空数组。
 *
 * @returns {Array<object>} 清空后的播放历史数组。
 */
export function clearPlayHistory() {
  // 返回值类型: Array<object>。
  // 作用: 返回空历史列表，便于页面清空后同步分页。
  return replacePlayHistoryRecords([]);
}

/**
 * 更新当前播放状态。
 * 副作用: 覆盖 userContentStore.currentPlaying。
 *
 * @param {object|null} currentPlaying 当前播放状态。
 * @returns {object|null} 写入后的当前播放状态。
 */
export function updateCurrentPlaying(currentPlaying) {
  // 返回值类型: object|null。
  // 作用: 通过 store 写入函数保持响应式更新。
  return setCurrentPlaying(currentPlaying);
}

/**
 * 计算播放恢复策略。
 * 纯函数: 只读取 historyRecord 和 userContentStore.resumePolicy，不修改 store。
 *
 * @param {object|null} historyRecord 播放历史记录。
 * @param {number} historyRecord.playedSeconds 已播放秒数。
 * @param {number|null} historyRecord.durationSeconds 总时长秒数。
 * @returns {object} 恢复播放判断结果。
 * @returns {string} return.mode 恢复模式，restart、resume 或 ask-replay。
 * @returns {number} return.startSeconds 建议开始播放秒数。
 * @returns {boolean} return.shouldAskReplay 是否应该提示重播。
 */
export function getPlaybackResumeDecision(historyRecord) {
  // 类型: object。
  // 作用: historyRecord 缺失时使用空对象，表示没有历史记录。
  const safeRecord = historyRecord && typeof historyRecord === 'object' ? historyRecord : {};

  // 类型: object。
  // 作用: 读取恢复策略配置，缺失时使用当前约定阈值兜底。
  const resumePolicy = userContentStore.resumePolicy || {};

  // 类型: number。
  // 作用: 小于该秒数认为接近开头，直接从 0 开始。
  const nearStartThreshold = Number(resumePolicy.nearStartThresholdSeconds) || 5;

  // 类型: number。
  // 作用: 距离结尾小于等于该秒数时提示用户选择重播或继续。
  const nearEndThreshold = Number(resumePolicy.nearEndThresholdSeconds) || 30;

  // 类型: number。
  // 作用: 已播放秒数，异常值按 0 处理。
  const playedSeconds = Number(safeRecord.playedSeconds) > 0 ? Number(safeRecord.playedSeconds) : 0;

  // 类型: number|null。
  // 作用: 总时长秒数，未知时使用 null，不执行接近结尾判断。
  const durationSeconds = Number(safeRecord.durationSeconds) > 0 ? Number(safeRecord.durationSeconds) : null;

  // 条件分支: 已播放时间小于开头阈值时进入。
  // 执行内容: 从头开始播放，不提示用户恢复。
  if (playedSeconds < nearStartThreshold) {
    return {
      mode: 'restart',
      startSeconds: 0,
      shouldAskReplay: false
    };
  }

  // 条件分支: 有总时长且已接近结尾时进入。
  // 执行内容: 不直接重头开始，而是提示用户选择重播或继续最后位置。
  if (durationSeconds && durationSeconds - playedSeconds <= nearEndThreshold) {
    return {
      mode: 'ask-replay',
      startSeconds: playedSeconds,
      shouldAskReplay: true
    };
  }

  // 返回值类型: object。
  // 作用: 正常历史记录从上次播放位置恢复。
  return {
    mode: 'resume',
    startSeconds: playedSeconds,
    shouldAskReplay: false
  };
}
