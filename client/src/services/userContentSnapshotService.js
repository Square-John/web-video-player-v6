/*
  userContentSnapshotService.js 模块说明

  - 文件职责:
      把标准 ContentItem 和 Episode 收敛为用户收藏、播放历史可长期保存的轻量快照与跨源分集定位器。
      为个人中心本地渲染、失效源重新搜索和详情页分集匹配提供唯一纯函数实现，不访问 Store、Router、Repository 或 Provider。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      USER_CONTENT_SNAPSHOT_SCHEMA_VERSION: 自定义配置，提供快照保存结构版本。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeText(value): 把可展示标量收敛为字符串。
      normalizePositiveInteger(value): 把分集序号收敛为正整数或 null。
      normalizeStringList(value): 清理字符串数组并保持原顺序。

  - 模块级类:
      无

  - 对外导出:
      createContentCardSnapshot: Function，从 ContentItem 创建完整卡片快照。
      createContentItemFromSnapshot: Function，把快照恢复为 VideoCard 可消费的标准内容子集。
      createEpisodeLocator: Function，从当前分集创建跨源定位器。
      findEpisodeByLocator: Function，按冻结优先级在当前内容逻辑分集列表中匹配目标。
*/

// 导入来源: ../config/user-content.config.js。
// 导入内容: USER_CONTENT_SNAPSHOT_SCHEMA_VERSION 用户内容快照结构版本。
// 文件作用: 新快照写入统一版本，Repository 和 v24 迁移据此区分保存形状。
import { USER_CONTENT_SNAPSHOT_SCHEMA_VERSION } from '../config/user-content.config.js';

/**
 * 把展示标量收敛为字符串。
 * 纯函数: 不修改输入；只接受字符串和有限数字，其他值返回空字符串。
 *
 * @param {*} value ContentItem 或 Episode 字段候选。
 * @returns {string} 去除首尾空白的文本。
 */
function normalizeText(value) {
  // 条件分支: 候选已经是字符串时进入；执行内容: 只清理首尾空白并保留正文。
  if (typeof value === 'string') return value.trim();
  // 条件分支: 候选是有限数字时进入；执行内容: 转成稳定展示文本，不接受 NaN 或 Infinity。
  if (Number.isFinite(value)) return String(value);
  return '';
}

/**
 * 把分集序号收敛为正整数。
 * 纯函数: 不修改输入；空值和非法值返回 null，不猜测标题中的数字。
 *
 * @param {*} value 分集序号候选。
 * @returns {number|null} 正整数或 null。
 */
function normalizePositiveInteger(value) {
  // 条件分支: 候选为空时进入；执行内容: 保留未知序号的 null 语义。
  if (value === null || value === undefined || value === '') return null;
  // 类型: number；作用: 统一字符串和数字形式的契约序号。
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

/**
 * 清理字符串数组并保持 Provider 原顺序。
 * 纯函数: 返回新数组；过滤空项并去除完全重复文本，不排序、不推断。
 *
 * @param {*} value 字符串数组候选。
 * @returns {Array<string>} 可序列化文本数组。
 */
function normalizeStringList(value) {
  // 条件分支: 候选不是数组时进入；执行内容: 返回独立空数组，不遍历对象键。
  if (!Array.isArray(value)) return [];
  // 类型: Set<string>；作用: 在保持首个出现顺序的同时排除完全重复字段。
  const seen = new Set();
  return value.reduce((result, item) => {
    // 类型: string；作用: 只保留可展示文本，不把对象隐式转换为字符串。
    const text = normalizeText(item);
    // 条件分支: 当前文本为空或已经出现时进入；执行内容: 保留首个有效条目并跳过当前项。
    if (!text || seen.has(text)) return result;
    seen.add(text);
    result.push(text);
    return result;
  }, []);
}

/**
 * 从标准 ContentItem 创建用户内容卡片快照。
 * 纯函数: 返回独立 JSON 对象，不保留页面响应式引用。
 * 成功路径: 保存 VideoCard 展示字段和重新搜索提示，不保存详情正文、播放 URL、episodes 或 Provider 私有值。
 * 失败路径: 内容身份、标题或捕获时间无效时返回 null，调用方不得写入不完整新记录。
 *
 * @param {*} contentItem Provider 已清洗并由平台采用的标准 ContentItem。
 * @param {string} capturedAt 本次用户动作的 ISO 时间。
 * @returns {object|null} 完整 ContentCardSnapshot 或 null。
 */
export function createContentCardSnapshot(contentItem, capturedAt) {
  // 类型: object；作用: 非普通对象使用空候选，保证失败路径稳定。
  const item = contentItem && typeof contentItem === 'object' && !Array.isArray(contentItem)
    ? contentItem
    : {};
  // 类型: string；作用: 快照身份必须与收藏和历史主身份一致。
  const sourceId = normalizeText(item.sourceId);
  // 类型: string；作用: ContentItem 对外使用 id，保存对象统一命名为 contentId。
  const contentId = normalizeText(item.id || item.contentId);
  // 类型: string；作用: 新记录必须具备可离线展示和搜索的真实标题。
  const title = normalizeText(item.title);
  // 类型: number；作用: 验证捕获时间可排序，保留调用方原始 ISO 文本。
  const capturedTimestamp = Date.parse(capturedAt || '');

  // 条件分支: 新快照缺少身份、标题或合法时间时进入。
  // 执行内容: 返回 null，避免再次产生“未命名视频”长期记录。
  if (!sourceId || !contentId || !title || !Number.isFinite(capturedTimestamp)) return null;

  // 类型: object；作用: 电影快照只保留卡片当前使用的总时长字段。
  const movie = item.movie && typeof item.movie === 'object' && !Array.isArray(item.movie)
    ? item.movie
    : {};
  // 类型: object；作用: 电视剧快照只保留卡片当前使用的更新与集数字段。
  const tv = item.tv && typeof item.tv === 'object' && !Array.isArray(item.tv)
    ? item.tv
    : {};
  // 类型: Array<string>；作用: 搜索别名来自标准 ContentItem，缺失时为空数组而非标题复制。
  const aliases = normalizeStringList(item.aliases);
  // 类型: string；作用: 统一电影或电视剧类型；未知值保持空字符串并由 Repository 拒绝。
  const type = normalizeText(item.type);
  // 类型: number|null；作用: 评分仅保留有限数字，缺失或非数字不伪造。
  const score = Number.isFinite(item.score) ? item.score : null;

  return {
    schemaVersion: USER_CONTENT_SNAPSHOT_SCHEMA_VERSION,
    sourceId,
    contentId,
    sourceName: normalizeText(item.sourceName),
    type,
    title,
    poster: normalizeText(item.poster),
    cover: normalizeText(item.cover),
    year: normalizeText(item.year),
    area: normalizeText(item.area),
    genres: normalizeStringList(item.genres),
    displayTags: normalizeStringList(item.displayTags),
    score,
    quality: normalizeText(item.quality),
    badge: normalizeText(item.badge),
    movie: {
      duration: normalizeText(movie.duration || item.duration)
    },
    tv: {
      updateStatus: normalizeText(tv.updateStatus),
      latestEpisode: normalizeText(tv.latestEpisode),
      totalEpisodes: normalizeText(tv.totalEpisodes)
    },
    searchHints: {
      title,
      aliases,
      year: normalizeText(item.year),
      type
    },
    capturedAt
  };
}

/**
 * 把保存快照恢复为 VideoCard 可消费的 ContentItem 子集。
 * 纯函数: 返回新对象，不修改快照；null 快照返回 null，让旧记录使用明确旧记录占位。
 *
 * @param {*} snapshot ContentCardSnapshot 候选。
 * @returns {object|null} 标准卡片内容对象或 null。
 */
export function createContentItemFromSnapshot(snapshot) {
  // 条件分支: 旧记录没有快照或候选不是对象时进入；执行内容: 返回 null，让页面显示明确旧记录状态。
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  return {
    id: snapshot.contentId,
    sourceId: snapshot.sourceId,
    sourceName: snapshot.sourceName,
    type: snapshot.type,
    title: snapshot.title,
    poster: snapshot.poster,
    cover: snapshot.cover,
    year: snapshot.year,
    area: snapshot.area,
    genres: [...snapshot.genres],
    displayTags: [...snapshot.displayTags],
    score: snapshot.score,
    quality: snapshot.quality,
    badge: snapshot.badge,
    movie: { ...snapshot.movie },
    tv: { ...snapshot.tv }
  };
}

/**
 * 从当前标准 Episode 创建跨源分集定位器。
 * 纯函数: 返回新对象；不解析 label 中数字，也不把旧 Provider episodeId 当作跨源主键。
 *
 * @param {*} episode 当前 ContentItem 中已选择的标准 Episode。
 * @param {object} fallback 页面路由或历史提供的稳定后备身份。
 * @returns {object} EpisodeLocator，未知字段使用空字符串或 null。
 */
export function createEpisodeLocator(episode, fallback = {}) {
  // 类型: object；作用: 缺失分集时使用空对象，电影仍得到字段完整定位器。
  const safeEpisode = episode && typeof episode === 'object' && !Array.isArray(episode) ? episode : {};
  // 类型: object；作用: 只读取调用方显式提供的标准后备字段。
  const safeFallback = fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? fallback : {};
  return {
    episodeId: normalizeText(safeEpisode.id || safeEpisode.value || safeFallback.episodeId),
    seasonNumber: normalizePositiveInteger(safeEpisode.seasonNumber || safeFallback.seasonNumber),
    episodeNumber: normalizePositiveInteger(safeEpisode.episodeNumber || safeFallback.episodeNumber),
    episodeIndex: normalizePositiveInteger(
      safeFallback.episodeIndex || safeEpisode.index || safeEpisode.episodeIndex || safeEpisode.episodeNumber
    ),
    episodeTitle: normalizeText(
      safeEpisode.title || safeEpisode.label || safeEpisode.description || safeFallback.episodeTitle
    )
  };
}

/**
 * 在当前内容的逻辑分集列表中匹配历史定位器。
 * 纯函数: 不修改分集数组；依次接受唯一季集号、季号未知时的唯一明确集号或唯一特辑完整标题，不按普通标题或页面序号猜测。
 * 失败路径: 没有确定匹配时返回 null，详情页保持默认分集并等待用户选择。
 *
 * @param {*} episodes 新 Provider 返回的标准 Episode 数组。
 * @param {*} locator 历史记录保存的 EpisodeLocator。
 * @returns {object|null} 匹配分集对象或 null。
 */
export function findEpisodeByLocator(episodes, locator) {
  // 条件分支: 分集列表或定位器形状无效时进入；执行内容: 不尝试猜测匹配并返回 null。
  if (!Array.isArray(episodes) || !locator || typeof locator !== 'object' || Array.isArray(locator)) {
    return null;
  }
  // 类型: Array<object>；作用: 排除空项但保留 Provider 原始分集顺序。
  const candidates = episodes.filter(episode => episode && typeof episode === 'object' && !Array.isArray(episode));
  // 类型: number|null；作用: 只接受定位器显式正整数季号，0、空值和非法值统一表示季号未知。
  const targetSeasonNumber = normalizePositiveInteger(locator.seasonNumber);
  // 类型: number|null；作用: 只接受定位器显式正整数集号，不从标题或页面位置推断。
  const targetEpisodeNumber = normalizePositiveInteger(locator.episodeNumber);
  // 条件分支: 季号和集号都存在时进入；执行内容: 使用跨 Provider 最稳定的结构化身份匹配。
  if (targetSeasonNumber && targetEpisodeNumber) {
    // 类型: Array<object>；作用: 保存季号与集号同时一致的全部标准分集，后续必须验证唯一性。
    const structuredMatches = candidates.filter((episode) => {
      return normalizePositiveInteger(episode.seasonNumber) === targetSeasonNumber
        && normalizePositiveInteger(episode.episodeNumber) === targetEpisodeNumber;
    });
    // 条件分支: 结构化身份恰好命中一项时进入；执行内容: 返回唯一最高优先级结果。
    if (structuredMatches.length === 1) return structuredMatches[0];
    // 条件分支: 同一季集号出现多项时进入；执行内容: 失败关闭，不降级到标题或序号选择其中一项。
    if (structuredMatches.length > 1) return null;
  }
  // 条件分支: 定位器明确集号但没有合法季号时进入；执行内容: 只在当前内容逻辑目录内接受唯一同集号普通剧集。
  if (!targetSeasonNumber && targetEpisodeNumber) {
    // 类型: Array<object>；作用: 汇总所有明确同集号普通剧集；多季重复集号或重复逻辑身份必须保持歧义。
    const episodeNumberMatches = candidates.filter((episode) => {
      return episode.kind === 'episode'
        && normalizePositiveInteger(episode.episodeNumber) === targetEpisodeNumber;
    });
    // 条件分支: 当前内容只有一个明确同集号逻辑剧集时进入；执行内容: 返回无需数组位置参与的确定匹配。
    if (episodeNumberMatches.length === 1) return episodeNumberMatches[0];
    // 条件分支: 当前内容存在多个同集号逻辑剧集时进入；执行内容: 立即失败，不降级到标题或首项。
    if (episodeNumberMatches.length > 1) return null;
  }
  // 类型: string；作用: 标题匹配只服务明确特辑，并使用完整规范化文本避免误选普通相邻剧集。
  const targetTitle = normalizeText(locator.episodeTitle);
  // 条件分支: 历史定位器具有真实标题时进入；执行内容: 只在 kind=special 的候选中尝试完整文本匹配。
  if (targetTitle) {
    // 类型: Array<object>；作用: 保存完整标题命中的特辑候选，普通集即使标签相同也不自动恢复。
    const titleMatches = candidates.filter((episode) => {
      return episode.kind === 'special' && [episode.title, episode.label, episode.description]
        .some(value => normalizeText(value) === targetTitle);
    });
    // 条件分支: 特辑完整标题恰好命中一项时进入；执行内容: 返回唯一语义结果。
    if (titleMatches.length === 1) return titleMatches[0];
  }
  // 返回值类型: null；作用: 禁止 episodeIndex、数组位置、普通标题或首项回退驱动跨源自动选集。
  return null;
}
