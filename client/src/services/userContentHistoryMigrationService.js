/*
  userContentHistoryMigrationService.js 模块说明

  - 文件职责:
      识别同一内容中仍使用源站 URL 作为 episodeId 的旧播放历史，并按可靠 EpisodeLocator 证据寻找唯一迁移候选。
      供用户内容 selector 在迁移前恢复旧进度，也供 UserContentService 在媒体成功写入时原子替换旧 historyKey。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      createEpisodeLocator: 自定义服务，把当前逻辑剧集与页面序号整理为统一定位事实。

  - 模块级常量:
      ABSOLUTE_HTTP_URL_PATTERN: RegExp，识别旧 Provider 保存的绝对 HTTP/HTTPS 播放页身份。
      RELATIVE_URL_PATH_PATTERN: RegExp，识别旧 Provider 保存的站内相对播放页身份。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeText(value): 把迁移比较文本整理为去首尾空白字符串。
      normalizePositiveInteger(value): 把迁移比较数字整理为正整数或 null。
      isLegacyUrlEpisodeId(value): 判断 episodeId 是否属于旧 URL 型身份。
      hasReliableEpisodeEvidence(record, targetLocator, targetKind): 判断旧记录与当前逻辑剧集是否具有可靠同集证据。

  - 模块级类:
      无

  - 对外导出:
      findUniqueLegacyHistoryRecord: Function，在同源同内容历史中返回唯一可靠的旧 URL 型迁移候选。
*/

// 导入来源: ./userContentSnapshotService.js；导入内容: createEpisodeLocator；文件作用: 统一当前逻辑剧集的季、集、序号和完整标题事实。
import { createEpisodeLocator } from './userContentSnapshotService.js';

// 类型: RegExp；作用: 只把明确 HTTP/HTTPS 绝对地址识别为旧 Provider 播放页身份。
const ABSOLUTE_HTTP_URL_PATTERN = /^https?:\/\//iu;

// 类型: RegExp；作用: 只把根相对或点相对路径识别为旧 Provider 播放页身份，普通逻辑 id 不参与迁移。
const RELATIVE_URL_PATH_PATTERN = /^(?:\/|\.\.?\/)/u;

/**
 * 标准化迁移比较文本。
 * 纯函数: 不修改输入；空值返回空字符串，其他值转字符串并去除首尾空白。
 *
 * @param {*} value 文本候选。
 * @returns {string} 可执行完整相等比较的文本。
 */
function normalizeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * 标准化迁移比较使用的正整数。
 * 纯函数: 不修改输入；非安全正整数返回 null，禁止把小数、负数或文本噪声当作剧集身份。
 *
 * @param {*} value 数字候选。
 * @returns {number|null} 安全正整数或 null。
 */
function normalizePositiveInteger(value) {
  // 类型: number；作用: 把数字字符串和数值统一为 Number，供安全整数边界复核。
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/**
 * 判断 episodeId 是否属于旧 URL 型身份。
 * 纯函数: 只识别明确绝对 HTTP/HTTPS 地址和相对路径，不解析域名、站点或 URL 业务参数。
 *
 * @param {*} value 历史 episodeId 候选。
 * @returns {boolean} true 表示旧 URL 型身份可进入迁移候选集，false 表示普通逻辑剧集身份。
 */
function isLegacyUrlEpisodeId(value) {
  // 类型: string；作用: 清理旧保存值外围空白，避免格式噪声影响 URL 类型判断。
  const episodeId = normalizeText(value);
  return Boolean(episodeId
    && (ABSOLUTE_HTTP_URL_PATTERN.test(episodeId) || RELATIVE_URL_PATH_PATTERN.test(episodeId)));
}

/**
 * 判断旧记录与当前逻辑剧集是否具有可靠同集证据。
 * 纯函数: 只比较 EpisodeLocator；不使用 URL 内容、数组位置单项、模糊标题或相邻集回退。
 * 成功路径: 季号加集号完全一致，或明确集号、完整标题和显示序号三项一致；特辑允许完整标题单独确认。
 * 失败路径: 任一证据冲突、缺失或只剩 episodeIndex 时返回 false。
 *
 * @param {object} record 旧播放历史记录。
 * @param {object} targetLocator 当前逻辑剧集定位器。
 * @param {string} targetKind 当前逻辑剧集 kind。
 * @returns {boolean} true 表示可把旧记录视为当前逻辑剧集，false 表示证据不足。
 */
function hasReliableEpisodeEvidence(record, targetLocator, targetKind) {
  // 类型: object；作用: 只读取旧记录已经持久化的定位事实，异常形状按无证据处理。
  const legacyLocator = record?.episodeLocator && typeof record.episodeLocator === 'object'
    && !Array.isArray(record.episodeLocator)
    ? record.episodeLocator
    : {};
  // 类型: number|null；作用: 读取旧记录明确季号，不从 episodeId 或标题猜测。
  const legacySeasonNumber = normalizePositiveInteger(legacyLocator.seasonNumber);
  // 类型: number|null；作用: 读取当前逻辑剧集明确季号。
  const targetSeasonNumber = normalizePositiveInteger(targetLocator.seasonNumber);
  // 类型: number|null；作用: 读取旧记录明确集号。
  const legacyEpisodeNumber = normalizePositiveInteger(legacyLocator.episodeNumber);
  // 类型: number|null；作用: 读取当前逻辑剧集明确集号。
  const targetEpisodeNumber = normalizePositiveInteger(targetLocator.episodeNumber);

  // 条件分支: 两侧都具有完整季集号时进入。
  // 执行内容: 只接受季号和集号同时完全一致，任一冲突都关闭迁移。
  if (legacySeasonNumber && targetSeasonNumber && legacyEpisodeNumber && targetEpisodeNumber) {
    return legacySeasonNumber === targetSeasonNumber && legacyEpisodeNumber === targetEpisodeNumber;
  }

  // 类型: string；作用: 读取旧记录保存的完整单集或特辑标题，不做包含和裁剪。
  const legacyTitle = normalizeText(legacyLocator.episodeTitle);
  // 类型: string；作用: 读取当前逻辑剧集完整标题或线路按钮标签。
  const targetTitle = normalizeText(targetLocator.episodeTitle);
  // 条件分支: 当前目标明确是特辑时进入。
  // 执行内容: 完整标题相等即可确认；空标题和普通集不得走该分支。
  if (targetKind === 'special') {
    return Boolean(legacyTitle && targetTitle && legacyTitle === targetTitle);
  }

  // 类型: number|null；作用: 读取旧页面稳定显示序号，只能与集号和完整标题共同作为证据。
  const legacyEpisodeIndex = normalizePositiveInteger(legacyLocator.episodeIndex);
  // 类型: number|null；作用: 读取当前页面显示序号，禁止单独驱动迁移。
  const targetEpisodeIndex = normalizePositiveInteger(targetLocator.episodeIndex);
  return Boolean(
    legacyEpisodeNumber
    && targetEpisodeNumber
    && legacyEpisodeNumber === targetEpisodeNumber
    && legacyTitle
    && targetTitle
    && legacyTitle === targetTitle
    && legacyEpisodeIndex
    && targetEpisodeIndex
    && legacyEpisodeIndex === targetEpisodeIndex
  );
}

/**
 * 在同源同内容历史中寻找唯一可靠的旧 URL 型迁移候选。
 * 纯函数: 不修改记录数组、历史记录或当前剧集；候选数量不是一条时失败关闭。
 * 成功路径: 仅电视剧、当前非 URL 逻辑 id、同源同内容和可靠定位证据同时成立时返回唯一旧记录。
 * 失败路径: 身份不完整、电影、当前仍是 URL id、没有候选或多个候选时返回 null。
 *
 * @param {*} records 当前用户完整播放历史数组。
 * @param {object} target 当前播放目标。
 * @param {string} target.sourceId 当前数据源 id。
 * @param {string} target.contentId 当前内容 id。
 * @param {string} target.type 当前内容类型。
 * @param {string} target.episodeId 当前逻辑剧集 id。
 * @param {number|null} target.episodeIndex 当前剧集显示序号。
 * @param {object} target.episode 当前标准 PlayCatalogEpisode。
 * @returns {object|null} 唯一旧 URL 型历史记录；证据不足或不唯一时为 null。
 */
export function findUniqueLegacyHistoryRecord(records, target) {
  // 类型: object；作用: 非对象输入使用空候选，使迁移判断稳定失败关闭。
  const safeTarget = target && typeof target === 'object' && !Array.isArray(target) ? target : {};
  // 类型: string；作用: 当前逻辑剧集 id 必须非空且已经退出 URL 身份。
  const targetEpisodeId = normalizeText(safeTarget.episodeId || safeTarget.episode?.id);
  // 类型: string；作用: 统一内容类型后只开放电视剧单集迁移。
  const targetType = normalizeText(safeTarget.type).toLowerCase();
  // 条件分支: 身份不完整、不是电视剧或当前仍使用 URL id 时进入。
  // 执行内容: 返回 null，电影内容键无需分集迁移，未知身份不得猜测。
  if (!normalizeText(safeTarget.sourceId) || !normalizeText(safeTarget.contentId)
    || !['tv', 'series'].includes(targetType) || !targetEpisodeId || isLegacyUrlEpisodeId(targetEpisodeId)) {
    return null;
  }
  // 类型: object；作用: 把当前标准剧集和页面序号统一成与旧记录相同的定位形状。
  const targetLocator = createEpisodeLocator(safeTarget.episode, {
    episodeId: targetEpisodeId,
    episodeIndex: safeTarget.episodeIndex
  });
  // 类型: string；作用: 当前标准 kind 决定特辑是否允许完整标题作为唯一语义证据。
  const targetKind = normalizeText(safeTarget.episode?.kind);
  // 类型: Array<object>；作用: 只保留同源同内容、旧 URL 身份和可靠同集证据全部成立的候选。
  const candidates = (Array.isArray(records) ? records : []).filter((record) => {
    return record && typeof record === 'object' && !Array.isArray(record)
      && record.sourceId === safeTarget.sourceId
      && record.contentId === safeTarget.contentId
      && ['tv', 'series'].includes(normalizeText(record.type).toLowerCase())
      && isLegacyUrlEpisodeId(record.episodeId || record.episodeLocator?.episodeId)
      && hasReliableEpisodeEvidence(record, targetLocator, targetKind);
  });
  return candidates.length === 1 ? candidates[0] : null;
}
