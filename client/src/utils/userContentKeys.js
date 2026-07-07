/*
  userContentKeys.js 模块说明

  - 文件职责:
      提供用户内容状态使用的 favoriteKey 和 historyKey 生成工具。
      供 user-content.mock.js、userContentStore、userContentService 和 userContentSelectors 复用。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      buildContentKey: 自定义工具函数，根据 sourceId 和 contentId 生成内容实体 key。

  - 模块级常量:
      USER_HISTORY_EPISODE_SEPARATOR: string，历史记录中内容 key 和剧集 key 的连接符。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeUserKeyPart(value)
          - params:
              -- value: any，待写入用户内容 key 的原始值。
          - return:
              string，去除首尾空白后的字段文本。
          - description:
              将 sourceId、contentId、episodeId 和 episodeIndex 统一整理成可拼接文本。
      resolveEpisodePart(record)
          - params:
              -- record: object，播放历史记录或待写入历史的引用对象。
          - return:
              string，电视剧历史记录使用的剧集 key 片段。
          - description:
              优先使用 episodeId，其次使用 episodeIndex，确保电视剧不同集生成不同历史 key。

  - 模块级类:
      无

  - 对外导出:
      USER_HISTORY_EPISODE_SEPARATOR: string，用户历史 key 分隔符。
      buildFavoriteKey: Function，生成收藏记录唯一 key。
      buildHistoryKey: Function，生成播放历史唯一 key。
*/

// 导入来源: ./contentKeys。
// 导入内容: buildContentKey 内容实体 key 生成函数。
// 文件作用: 收藏 key 与内容 key 当前同形，但通过独立函数表达不同业务语义。
import { buildContentKey } from './contentKeys.js';

// 类型: string。
// 作用: 连接 contentKey 和 episodeId/episodeIndex，让电视剧不同分集形成不同历史记录。
export const USER_HISTORY_EPISODE_SEPARATOR = '::';

/**
 * 标准化用户内容 key 片段。
 * 纯函数: 相同 value 输入始终返回相同字符串，不读取或修改外部状态。
 * 兜底策略: null 和 undefined 返回空字符串，其它值转字符串并去除首尾空白。
 *
 * @param {*} value 待写入 key 的原始字段值。
 * @returns {string} 可用于 key 拼接的稳定文本。
 */
function normalizeUserKeyPart(value) {
  // 条件分支: value 是 null 或 undefined 时进入。
  // 执行内容: 返回空字符串，让上层函数统一判断 key 是否可用。
  if (value === null || value === undefined) {
    return '';
  }

  // 返回值类型: string。
  // 作用: 把数字型集数等值转为字符串，保证 key 拼接和比较稳定。
  return String(value).trim();
}

/**
 * 生成收藏记录唯一 key。
 * 纯函数: 收藏只定位到整部内容，因此直接复用 sourceId + contentId 组合。
 *
 * @param {string} sourceId 内容所属数据源 id。
 * @param {string} contentId 内容 id，对应 ContentItem.id。
 * @returns {string} 收藏记录唯一 key；字段缺失时返回空字符串。
 */
export function buildFavoriteKey(sourceId, contentId) {
  // 返回值类型: string。
  // 作用: 当前收藏 key 与 contentKey 同形，但调用方不应该把两者语义混用。
  return buildContentKey(sourceId, contentId);
}

/**
 * 解析电视剧历史记录的剧集 key 片段。
 * 纯函数: 只读取 record.episodeId 和 record.episodeIndex，不修改传入对象。
 * 兜底策略: episodeId 优先；episodeIndex 存在时转成 episode-index-N；两者都缺失时返回空字符串。
 *
 * @param {object} record 播放历史记录或待写入历史的引用对象。
 * @param {string} record.episodeId 电视剧剧集 id。
 * @param {number|string|null} record.episodeIndex 电视剧剧集序号。
 * @returns {string} 剧集 key 片段。
 */
function resolveEpisodePart(record) {
  // 类型: object。
  // 作用: record 不是对象时使用空对象兜底，避免读取字段时报错。
  const safeRecord = record && typeof record === 'object' ? record : {};

  // 类型: string。
  // 作用: episodeId 是最稳定的电视剧分集标识，优先用于生成历史 key。
  const episodeId = normalizeUserKeyPart(safeRecord.episodeId);

  // 条件分支: episodeId 存在时进入。
  // 执行内容: 直接返回 episodeId，保证同一分集历史记录可被更新命中。
  if (episodeId) {
    return episodeId;
  }

  // 类型: string。
  // 作用: episodeIndex 用于没有 episodeId 的数据源兜底区分电视剧不同集。
  const episodeIndex = normalizeUserKeyPart(safeRecord.episodeIndex);

  // 返回值类型: string。
  // 作用: 有集数时生成可读片段；没有分集信息时返回空字符串。
  return episodeIndex ? `episode-index-${episodeIndex}` : '';
}

/**
 * 生成播放历史唯一 key。
 * 纯函数: 电影历史定位到整部内容，电视剧历史定位到具体分集。
 * 失败路径: sourceId/contentId 缺失，或电视剧缺少 episodeId/episodeIndex 时返回空字符串。
 *
 * @param {object} record 播放历史引用对象。
 * @param {string} record.sourceId 内容所属数据源 id。
 * @param {string} record.contentId 内容 id，对应 ContentItem.id。
 * @param {string} record.type 内容类型，tv 或 series 按电视剧处理。
 * @param {string} record.episodeId 电视剧剧集 id。
 * @param {number|string|null} record.episodeIndex 电视剧剧集序号。
 * @returns {string} 播放历史唯一 key。
 */
export function buildHistoryKey(record) {
  // 类型: object。
  // 作用: record 不是对象时使用空对象兜底，保证函数失败路径稳定返回空字符串。
  const safeRecord = record && typeof record === 'object' ? record : {};

  // 类型: string。
  // 作用: 播放历史基础内容 key，电影历史直接使用该值。
  const contentKey = buildContentKey(safeRecord.sourceId, safeRecord.contentId);

  // 条件分支: 基础内容 key 不可用时进入。
  // 执行内容: 返回空字符串，避免产生无法定位内容的历史记录。
  if (!contentKey) {
    return '';
  }

  // 类型: string。
  // 作用: 判断当前历史是否需要按电视剧分集拆分。
  const contentType = normalizeUserKeyPart(safeRecord.type).toLowerCase();

  // 类型: boolean。
  // 作用: tv 和 series 都按电视剧处理，电影和未知类型按整部内容处理。
  const isTvContent = contentType === 'tv' || contentType === 'series';

  // 条件分支: 当前内容不是电视剧时进入。
  // 执行内容: 电影历史直接返回 sourceId + contentId。
  if (!isTvContent) {
    return contentKey;
  }

  // 类型: string。
  // 作用: 电视剧历史必须带分集片段，否则无法区分不同集的播放进度。
  const episodePart = resolveEpisodePart(safeRecord);

  // 条件分支: 电视剧缺少分集标识时进入。
  // 执行内容: 返回空字符串，调用方应跳过写入或补齐 episodeId/episodeIndex。
  if (!episodePart) {
    return '';
  }

  // 返回值类型: string。
  // 作用: 返回电视剧单集历史 key，例如 mock1::tv-001::tv-001-episode-001。
  return `${contentKey}${USER_HISTORY_EPISODE_SEPARATOR}${episodePart}`;
}
