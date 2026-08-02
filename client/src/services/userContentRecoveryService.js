/*
  userContentRecoveryService.js 模块说明

  - 文件职责:
      连接用户内容记录、SourceManager 可用性、搜索/详情路由上下文、分集匹配和最终双仓重绑定。
      页面只调用通用恢复门面，不自行解释授权指纹、Provider readiness、健康状态或用户记录保存结构。

  - 导入库及文件汇总(8 条，内置 0 条，第三方 0 条，自定义 8 条):
      USER_CONTENT_RECOVERY_KIND: 自定义配置，提供收藏和历史恢复类型。
      HEALTH_STATUS: 自定义配置，提供数据源不可用健康枚举。
      userContentSelectors exports: 自定义 selector，按稳定记录键读取恢复目标并定位收藏关联的最近历史。
      settingsService exports: 自定义设置服务，读取可见 SourceRecord 并复用统一可运行门禁。
      findEpisodeByLocator: 自定义快照服务，按冻结优先级匹配替代分集。
      rebindUserContent: 自定义用户内容服务，在双仓事务中提交最终重绑定。
      playerNavigationService exports: 自定义导航服务，创建稳定恢复入口和当前目录对应的规范播放目标。
      playCatalogSelectionService exports: 自定义目录服务，读取合法线路并按冻结优先级选择当前线路。

  - 模块级常量:
      USER_CONTENT_RECOVERY_QUERY: Readonly<object>，路由 query 稳定字段名。
      RECOVERY_CONTENT_TYPE: Readonly<object>，恢复解析使用的标准内容类型。
      RECOVERY_EPISODE_KIND: Readonly<object>，恢复解析使用的标准剧集类型。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeQueryText(value): 把 Vue Router query 收敛为单一文本。
      normalizeSourceName(value): 把来源名称候选收敛为非空文本。
      getUniquePlayCatalogEpisodes(playCatalog): 按逻辑剧集 id 汇总当前目录候选。
      findRecoveryCatalogEpisode(playCatalog, historyRecord): 先按旧 id、再按 EpisodeLocator 精确匹配当前剧集。
      resolveRecoveryMovieSelection(playCatalog, historyLineId): 按线路优先级选择唯一可播放电影正片。
      omitUserContentRecoveryQuery(query): 从最终播放 query 删除一次性恢复键。

  - 模块级类:
      无

  - 对外导出:
      getUserContentRecoveryContext: Function，从 query 读取并验证恢复记录。
      getUserContentSourceStatus: Function，返回个人中心状态点所需可用性。
      resolveUserContentSourceName: Function，按快照、当前定义、旧字段和身份顺序解析来源名称。
      createUserContentRecoverySearchTarget: Function，为失效记录创建搜索路由。
      createUserContentRecoveryDetailTarget: Function，为搜索结果创建保留恢复键的详情路由。
      createUserContentRecoveryPlaybackTarget: Function，为可用源用户记录创建只携带稳定记录键的播放入口。
      resolveUserContentRecoveryPlaybackTarget: Function，把稳定记录键解析为当前目录的规范线路和分集目标。
      findUserContentRecoveryEpisode: Function，在详情分集列表中匹配历史定位器。
      commitUserContentRecovery: Function，用户点击播放时原子重绑定用户记录。
*/

// 导入来源: ../config/user-content.config.js；导入内容: USER_CONTENT_RECOVERY_KIND；文件作用: 限制恢复类型。
import { USER_CONTENT_RECOVERY_KIND } from '../config/user-content.config.js';

// 导入来源: ../config/source-manager.config.js；导入内容: HEALTH_STATUS；文件作用: 排除健康检测明确不可用的数据源。
import { HEALTH_STATUS } from '../config/source-manager.config.js';

import {
  // 导入来源: ../selectors/userContentSelectors.js；导入内容: getFavoriteRecordByKey；文件作用: 按 query key 读取收藏恢复记录。
  getFavoriteRecordByKey,
  // 导入来源: ../selectors/userContentSelectors.js；导入内容: getHistoryRecordByKey；文件作用: 按 query key 读取历史恢复记录。
  getHistoryRecordByKey,
  // 导入来源: ../selectors/userContentSelectors.js；导入内容: getLatestPlayHistoryRecord；文件作用: 收藏恢复时定位同内容最近历史。
  getLatestPlayHistoryRecord
} from '../selectors/userContentSelectors.js';

import {
  // 导入来源: ./settingsService.js；导入内容: getSourceRecords；文件作用: 软隐藏或已删除源不进入可用候选。
  getSourceRecords,
  // 导入来源: ./settingsService.js；导入内容: isSourceRecordRunnable；文件作用: 复用启用、授权和 Provider 就绪门禁。
  isSourceRecordRunnable
} from './settingsService.js';

// 导入来源: ./userContentSnapshotService.js；导入内容: findEpisodeByLocator；文件作用: 详情页匹配替代分集。
import { findEpisodeByLocator } from './userContentSnapshotService.js';

// 导入来源: ./userContentService.js；导入内容: rebindUserContent；文件作用: 用户确认播放时提交双仓事务。
import { rebindUserContent } from './userContentService.js';

import {
  // 导入来源: ./playerNavigationService.js；导入内容: createPlayerNavigationTarget；文件作用: 创建不含旧线路和旧分集的稳定播放器入口。
  createPlayerNavigationTarget,
  // 导入来源: ./playerNavigationService.js；导入内容: createContentPlaybackNavigationTarget；文件作用: 只用当前目录已验证选择创建最终播放目标。
  createContentPlaybackNavigationTarget
} from './playerNavigationService.js';

import {
  // 导入来源: ./playCatalogSelectionService.js；导入内容: getPlayCatalogLines；文件作用: 汇总当前详情目录的合法线路和逻辑剧集。
  getPlayCatalogLines,
  // 导入来源: ./playCatalogSelectionService.js；导入内容: findPlayCatalogLine；文件作用: 复核最终线路仍属于当前目录。
  findPlayCatalogLine,
  // 导入来源: ./playCatalogSelectionService.js；导入内容: findPlayCatalogEpisode；文件作用: 复核目标线路包含当前逻辑剧集。
  findPlayCatalogEpisode,
  // 导入来源: ./playCatalogSelectionService.js；导入内容: resolveInitialPlayCatalogLineId；文件作用: 按旧成功线路、Provider 默认和首条可用线路选择恢复线路。
  resolveInitialPlayCatalogLineId
} from './playCatalogSelectionService.js';

// 类型: Readonly<object>；作用: 冻结跨搜索和详情页面只传递恢复类型与记录键，不传用户数据正文。
export const USER_CONTENT_RECOVERY_QUERY = Object.freeze({
  // 类型: string；作用: query 中的收藏或历史类型字段名。
  kind: 'recoveryKind',
  // 类型: string；作用: query 中的稳定用户记录键字段名。
  key: 'recoveryKey'
});

// 类型: Readonly<object>；作用: 冻结电影内容类型，只有电影允许在旧 episodeId 缺失时采用当前线路唯一正片。
const RECOVERY_CONTENT_TYPE = Object.freeze({
  // 类型: string；作用: 对应 ContentItem.type 的标准电影值。
  movie: 'movie'
});

// 类型: Readonly<object>；作用: 冻结电影正片剧集类型，避免把预告、花絮或其它目录条目当作历史目标。
const RECOVERY_EPISODE_KIND = Object.freeze({
  // 类型: string；作用: 对应 PlayCatalogEpisode.kind 的标准电影正片值。
  feature: 'feature'
});

/**
 * 把 Vue Router query 值收敛为单一文本。
 * 纯函数: 数组只读取首项，字符串清理空白，其他输入返回空字符串。
 *
 * @param {*} value 路由 query 候选。
 * @returns {string} 标准 query 文本。
 */
function normalizeQueryText(value) {
  // 类型: *；作用: Vue Router 重复 query 可能是数组，恢复协议只接受首个稳定值。
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' ? candidate.trim() : '';
}

/**
 * 把用户记录或当前 SourceDefinition 的来源名称候选收敛为非空文本。
 * 纯函数: 字符串只清理首尾空白，其他输入返回空字符串。
 *
 * @param {*} value 来源名称候选。
 * @returns {string} 可用于优先级判断的完整来源名称。
 */
function normalizeSourceName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 按逻辑剧集 id 汇总当前播放目录中的唯一剧集候选。
 * 纯函数: 返回新的数组外壳，不修改 ContentItem、线路或剧集对象。
 * 维护边界: 同一逻辑 id 跨线路只参与一次 EpisodeLocator 匹配，避免合法多线路被误判为重复分集。
 * 失败路径: 目录无效或没有具名剧集时返回空数组。
 *
 * @param {*} playCatalog 当前 ContentItem.playCatalog。
 * @returns {Array<object>} 按 Provider 目录顺序去重后的逻辑剧集集合。
 */
function getUniquePlayCatalogEpisodes(playCatalog) {
  // 类型: Map<string, object>；作用: 以标准逻辑剧集 id 去重跨线路副本，保留首次出现的标准对象。
  const episodesById = new Map();
  // 循环类型: for...of；初始值: Provider 目录首条合法线路；终止条件: 所有线路完成；作用: 汇总当前可验证逻辑剧集。
  for (const line of getPlayCatalogLines(playCatalog)) {
    // 类型: Array<object>；作用: 非数组选集按空集合处理，不为异常目录制造兼容对象。
    const episodes = Array.isArray(line.episodes) ? line.episodes : [];
    // 循环类型: for...of；初始值: 当前线路首个剧集；终止条件: 当前线路完成；作用: 按稳定 id 建立目录级唯一候选。
    for (const episode of episodes) {
      // 类型: string；作用: 只接受标准非空逻辑 id，其他条目不能参与自动恢复。
      const episodeId = normalizeQueryText(episode?.id);
      // 条件分支: 剧集对象、逻辑 id 无效或该身份已经由更早线路登记时进入；执行内容: 跳过当前副本。
      if (!episode || typeof episode !== 'object' || Array.isArray(episode)
        || !episodeId || episodesById.has(episodeId)) continue;
      episodesById.set(episodeId, episode);
    }
  }
  return Array.from(episodesById.values());
}

/**
 * 把历史记录映射到当前 Provider 详情目录的逻辑剧集。
 * 纯函数: 先使用旧逻辑 id 完全匹配；旧 id 失效时只允许 EpisodeLocator 的唯一季集号、无季号唯一明确集号或完整特辑标题匹配。
 * 失败路径: 没有历史、目录候选或唯一证据时返回 null，调用方不得请求相邻集、末集或数组同位置。
 *
 * @param {*} playCatalog 当前 ContentItem.playCatalog。
 * @param {*} historyRecord 稳定恢复键读取到的播放历史记录。
 * @returns {object|null} 当前目录中确定匹配的逻辑剧集或 null。
 */
function findRecoveryCatalogEpisode(playCatalog, historyRecord) {
  // 类型: Array<object>；作用: 跨线路相同逻辑 id 只保留一个候选，EpisodeLocator 唯一性在内容维度判断。
  const episodes = getUniquePlayCatalogEpisodes(playCatalog);
  // 类型: string；作用: 旧历史自身逻辑 id 优先于定位器字段，完全一致时无需结构化迁移。
  const previousEpisodeId = normalizeQueryText(historyRecord?.episodeId)
    || normalizeQueryText(historyRecord?.episodeLocator?.episodeId);
  // 类型: object|null；作用: 只按完整逻辑 id 查找，不使用包含、前后缀或序号匹配。
  const exactEpisode = previousEpisodeId
    ? episodes.find(episode => normalizeQueryText(episode.id) === previousEpisodeId) || null
    : null;
  // 条件分支: 当前目录仍保留旧逻辑 id 时进入；执行内容: 直接采用最高可靠身份。
  if (exactEpisode) return exactEpisode;
  // 返回值类型: object|null；作用: 旧 id 已变化时只委托冻结 EpisodeLocator 规则确认唯一替代身份。
  return findEpisodeByLocator(episodes, historyRecord?.episodeLocator);
}

/**
 * 为没有旧剧集身份的电影历史选择当前目录线路和唯一正片。
 * 纯函数: 按旧成功线路、Provider 默认线路和其余 Provider 顺序检查，不修改目录对象。
 * 成功路径: 返回首条可用且恰好含一个可播放 feature 的线路与正片。
 * 失败路径: 所有线路都缺少唯一正片时返回 null，不采用预告、花絮或数组首项。
 *
 * @param {*} playCatalog 当前 ContentItem.playCatalog。
 * @param {*} historyLineId 历史最近成功线路 id。
 * @returns {Readonly<object>|null} line 与唯一 feature；没有确定候选时返回 null。
 */
function resolveRecoveryMovieSelection(playCatalog, historyLineId) {
  // 类型: Array<object>；作用: 保留 Provider 目录顺序，作为历史和默认偏好之后的确定回退顺序。
  const lines = getPlayCatalogLines(playCatalog);
  // 类型: Array<string>；作用: 旧成功线路和 Provider 默认线路优先，重复或空身份只评估一次。
  const preferredLineIds = [historyLineId, playCatalog?.defaultLineId]
    .map(normalizeQueryText)
    .filter((lineId, index, values) => lineId && values.indexOf(lineId) === index);
  // 类型: Array<object>；作用: 先放偏好线路，再追加尚未出现的其余线路，形成完整确定选择顺序。
  const candidates = [
    ...preferredLineIds.map(lineId => findPlayCatalogLine(playCatalog, lineId)).filter(Boolean),
    ...lines.filter(line => !preferredLineIds.includes(normalizeQueryText(line.id)))
  ];

  // 循环类型: for...of；初始值: 旧成功线路；终止条件: 首个唯一正片或所有线路完成；作用: 安全选择电影播放目标。
  for (const line of candidates) {
    // 条件分支: 线路显式不可用时进入；执行内容: 跳过该线路并继续固定优先级。
    if (line.available === false) continue;
    // 类型: Array<object>；作用: 只保留标准 feature 且可播放条目，预告和不可用正片不参与。
    const playableFeatures = Array.isArray(line.episodes)
      ? line.episodes.filter(episode => episode && typeof episode === 'object'
        && !Array.isArray(episode)
        && episode.kind === RECOVERY_EPISODE_KIND.feature
        && episode.playable !== false)
      : [];
    // 条件分支: 当前线路恰好交付一个可播放正片时进入；执行内容: 返回确定线路和电影目标。
    if (playableFeatures.length === 1) return Object.freeze({ line, episode: playableFeatures[0] });
  }
  return null;
}

/**
 * 从最终播放 query 删除只服务一次恢复解析的记录键。
 * 纯函数: 返回新对象，不修改 Vue Router query。
 * 维护边界: 分集、线路、自动播放和其他平台 query 原样保留；恢复键在当前目录解析后必须退出 URL。
 *
 * @param {*} query 当前恢复入口 query。
 * @returns {object} 不含 recoveryKind/recoveryKey 的 query 副本。
 */
function omitUserContentRecoveryQuery(query) {
  // 类型: object；作用: 非普通 query 使用空对象，合法 query 复制后再删除一次性字段。
  const normalizedQuery = query && typeof query === 'object' && !Array.isArray(query) ? { ...query } : {};
  delete normalizedQuery[USER_CONTENT_RECOVERY_QUERY.kind];
  delete normalizedQuery[USER_CONTENT_RECOVERY_QUERY.key];
  return normalizedQuery;
}

/**
 * 从路由 query 读取并验证跨源恢复上下文。
 * 纯函数: 只通过 selector 读取当前 userContentStore，不修改 query 或记录。
 * 成功路径: 返回 kind、key、当前仍存在的原记录，以及可用于定位分集的最近历史。
 * 失败路径: 类型、key 或记录无效时返回 null，页面按普通搜索或详情流程工作。
 *
 * @param {*} query Vue Router query 候选。
 * @returns {object|null} 标准恢复上下文或 null。
 */
export function getUserContentRecoveryContext(query) {
  // 类型: object；作用: 非普通 query 使用空对象，避免读取异常字段。
  const safeQuery = query && typeof query === 'object' && !Array.isArray(query) ? query : {};
  // 类型: string；作用: 标准化恢复记录类型。
  const recoveryKind = normalizeQueryText(safeQuery[USER_CONTENT_RECOVERY_QUERY.kind]);
  // 类型: string；作用: 标准化收藏键或历史键。
  const recoveryKey = normalizeQueryText(safeQuery[USER_CONTENT_RECOVERY_QUERY.key]);
  // 条件分支: 类型不受支持或 key 为空时进入；执行内容: 返回 null，不读取任意用户记录。
  if (!Object.values(USER_CONTENT_RECOVERY_KIND).includes(recoveryKind) || !recoveryKey) return null;
  // 类型: object|null；作用: 根据冻结类型按精确键读取原用户记录。
  const record = recoveryKind === USER_CONTENT_RECOVERY_KIND.favorite
    ? getFavoriteRecordByKey(recoveryKey)
    : getHistoryRecordByKey(recoveryKey);
  // 条件分支: 原记录已被用户删除时进入；执行内容: 恢复 query 立即失效，不尝试从快照重建记录。
  if (!record) return null;
  // 类型: object|null；作用: 历史恢复使用自身，收藏恢复使用同内容最近历史，以便详情定位原分集并迁移进度。
  const historyRecord = recoveryKind === USER_CONTENT_RECOVERY_KIND.history
    ? record
    : getLatestPlayHistoryRecord(record.sourceId, record.contentId);
  return { recoveryKind, recoveryKey, record, historyRecord };
}

/**
 * 读取用户记录原数据源当前可用状态。
 * 纯函数: 复用 SourceManager 可见投影和可运行门禁，不启动 Provider 或发起健康检查。
 *
 * @param {*} record 收藏或播放历史记录。
 * @returns {object} available、statusText 和 sourceRecord。
 */
export function getUserContentSourceStatus(record) {
  // 类型: string；作用: 从用户记录读取原数据源身份。
  const sourceId = record && typeof record === 'object' ? record.sourceId || '' : '';
  // 类型: object|null；作用: 只在未软隐藏的 SourceManager 记录中定位目标源。
  const sourceRecord = getSourceRecords().find(candidate => candidate?.definition?.id === sourceId) || null;
  // 类型: boolean；作用: 健康明确 unavailable 时即使授权和 Provider 就绪也不能作为恢复目标。
  const healthy = sourceRecord?.runtime?.healthStatus !== HEALTH_STATUS.unavailable;
  // 类型: boolean；作用: 可用必须同时满足可见、启用、授权、Provider ready 和健康状态。
  const available = Boolean(sourceRecord && healthy && isSourceRecordRunnable(sourceRecord));
  return {
    available,
    statusText: available ? '数据源可用' : '数据源不可用，点击重新搜索',
    sourceRecord
  };
}

/**
 * 解析用户内容卡片应该展示的完整来源名称。
 * 纯函数: 只读取记录快照和调用方已经取得的 SourceRecord，不查询 Manager 或修改用户记录。
 * 优先级: 保存时快照名称、当前 Definition 名称、历史记录名称字段、稳定 sourceId。
 * 失败路径: 所有候选都无效时返回空字符串，由 VideoCard 使用自己的通用空值策略。
 *
 * @param {*} record 收藏或播放历史记录。
 * @param {*} sourceRecord getUserContentSourceStatus 返回的当前 SourceRecord，可为 null。
 * @returns {string} 未裁剪的来源名称，十字符显示边界继续由 VideoCard 统一处理。
 */
export function resolveUserContentSourceName(record, sourceRecord = null) {
  // 类型: object。
  // 作用: 非普通记录使用空对象，避免旧数据或异常输入破坏个人中心渲染。
  const safeRecord = record && typeof record === 'object' && !Array.isArray(record) ? record : {};
  // 类型: Array<*>。
  // 作用: 固定来源名称事实优先级；删除源后保留快照名，可用旧记录则采用当前 Definition 的正式名称。
  const candidates = [
    safeRecord.contentSnapshot?.sourceName,
    sourceRecord?.definition?.name,
    safeRecord.sourceName,
    safeRecord.sourceId
  ];
  // 返回值类型: string。
  // 作用: 返回第一个非空完整名称，不在服务层提前执行展示裁剪。
  return candidates.map(normalizeSourceName).find(Boolean) || '';
}

/**
 * 为失效用户记录创建搜索路由。
 * 纯函数: query 只携带搜索词、恢复类型和记录键，不泄漏快照或播放进度。
 *
 * @param {string} recoveryKind 收藏或历史恢复类型。
 * @param {object} record 原用户记录。
 * @returns {object|null} Vue Router 搜索目标或 null。
 */
export function createUserContentRecoverySearchTarget(recoveryKind, record) {
  // 类型: string；作用: 有快照时使用真实标题自动搜索，旧记录没有快照时为空并允许用户手动输入。
  const keyword = record?.contentSnapshot?.searchHints?.title || '';
  // 类型: string；作用: 根据恢复类型读取唯一记录键。
  const recoveryKey = recoveryKind === USER_CONTENT_RECOVERY_KIND.favorite
    ? record?.favoriteKey || ''
    : record?.historyKey || '';
  // 条件分支: 类型或记录键无效时进入；执行内容: 不生成带空恢复身份的路由。
  if (!Object.values(USER_CONTENT_RECOVERY_KIND).includes(recoveryKind) || !recoveryKey) return null;
  return {
    name: 'search',
    query: {
      keyword,
      [USER_CONTENT_RECOVERY_QUERY.kind]: recoveryKind,
      [USER_CONTENT_RECOVERY_QUERY.key]: recoveryKey
    }
  };
}

/**
 * 为搜索结果创建保留恢复上下文的详情路由。
 * 纯函数: 只读取标准 ContentItem 身份和已验证恢复上下文。
 *
 * @param {*} contentItem 搜索结果标准 ContentItem。
 * @param {*} recoveryContext getUserContentRecoveryContext 返回值。
 * @returns {object|null} Vue Router 详情目标或 null。
 */
export function createUserContentRecoveryDetailTarget(contentItem, recoveryContext) {
  // 类型: string；作用: 详情路由使用替代 Provider 的真实 sourceId。
  const sourceId = contentItem?.sourceId || '';
  // 类型: string；作用: 详情路由使用替代 Provider 的真实内容 id。
  const videoId = contentItem?.id || '';
  // 条件分支: 内容身份或恢复上下文缺失时进入；执行内容: 返回 null，让卡片使用普通详情导航。
  if (!sourceId || !videoId || !recoveryContext) return null;
  return {
    name: 'detail',
    params: { sourceId, videoId },
    query: {
      [USER_CONTENT_RECOVERY_QUERY.kind]: recoveryContext.recoveryKind,
      [USER_CONTENT_RECOVERY_QUERY.key]: recoveryContext.recoveryKey
    }
  };
}

/**
 * 为原数据源仍可运行的用户记录创建稳定播放器恢复入口。
 * 纯函数: 路由只携带 sourceId、contentId、恢复类型和稳定记录键，不携带持久化旧线路或旧分集身份。
 * 成功路径: PlayerView 先用记录键读取当前用户记录和当前详情目录，再构造规范播放请求。
 * 失败路径: 类型、记录键或内容身份缺失时返回 null，个人中心阻止错误导航。
 *
 * @param {string} recoveryKind 收藏或历史恢复类型。
 * @param {*} record 收藏或播放历史记录。
 * @returns {object|null} Vue Router 播放恢复入口或 null。
 */
export function createUserContentRecoveryPlaybackTarget(recoveryKind, record) {
  // 类型: object；作用: 非普通记录使用空对象，所有缺失字段统一进入失败关闭。
  const safeRecord = record && typeof record === 'object' && !Array.isArray(record) ? record : {};
  // 类型: string；作用: 根据恢复类型读取用户内容集合中的稳定主键。
  const recoveryKey = recoveryKind === USER_CONTENT_RECOVERY_KIND.favorite
    ? normalizeQueryText(safeRecord.favoriteKey)
    : normalizeQueryText(safeRecord.historyKey);
  // 条件分支: 类型不受支持或稳定键缺失时进入；执行内容: 不生成无法回读用户记录的 URL。
  if (!Object.values(USER_CONTENT_RECOVERY_KIND).includes(recoveryKind) || !recoveryKey) return null;

  // 返回值类型: object|null；作用: 基础导航服务只写内容身份和自动播放，旧 episodeId/playbackSourceId 不进入请求参数。
  return createPlayerNavigationTarget({
    sourceId: safeRecord.sourceId,
    contentId: safeRecord.contentId,
    autoplay: true
  }, {
    [USER_CONTENT_RECOVERY_QUERY.kind]: recoveryKind,
    [USER_CONTENT_RECOVERY_QUERY.key]: recoveryKey
  });
}

/**
 * 把稳定用户记录恢复入口解析为当前 Provider 目录中的规范播放目标。
 * 纯函数: 只读取恢复上下文、标准 ContentItem 和 playCatalog，不请求 Provider、不写 Router 或用户记录。
 * 成功路径: 旧逻辑 id 或 EpisodeLocator 确认当前剧集后，按旧成功线路、Provider 默认和首条可用线路选择目标。
 * 失败路径: 内容身份、历史、剧集、线路或可播放状态无法确定时返回 null，禁止误播和迁移原记录。
 *
 * @param {*} contentItem 当前 detail 请求返回的完整 ContentItem。
 * @param {*} recoveryContext getUserContentRecoveryContext 返回的稳定恢复上下文。
 * @param {*} baseQuery 恢复入口 query；最终目标会删除一次性恢复键。
 * @returns {Readonly<object>|null} 当前 line、episode 和规范 player target，无法精确解析时返回 null。
 */
export function resolveUserContentRecoveryPlaybackTarget(contentItem, recoveryContext, baseQuery = {}) {
  // 类型: object|null；作用: 只有普通 ContentItem 可以进入当前目录解析。
  const safeContentItem = contentItem && typeof contentItem === 'object' && !Array.isArray(contentItem)
    ? contentItem
    : null;
  // 类型: object|null；作用: 历史恢复使用自身，收藏恢复使用同内容最近历史；无历史收藏不应进入播放器恢复入口。
  const historyRecord = recoveryContext?.historyRecord && typeof recoveryContext.historyRecord === 'object'
    && !Array.isArray(recoveryContext.historyRecord)
    ? recoveryContext.historyRecord
    : null;
  // 条件分支: 当前内容、恢复上下文或历史记录缺失时进入；执行内容: 保留原用户记录并拒绝自动播放。
  if (!safeContentItem?.sourceId || !safeContentItem.id || !recoveryContext?.record || !historyRecord
    || safeContentItem.sourceId !== recoveryContext.record.sourceId) return null;

  // 类型: object|null；作用: 电视剧和具名电影先按旧 id、再按冻结定位器从当前目录确认逻辑剧集。
  const matchedEpisode = findRecoveryCatalogEpisode(safeContentItem.playCatalog, historyRecord);
  // 类型: Readonly<object>|null；作用: 旧电影没有剧集身份时按线路优先级寻找唯一正片，其他内容保持 null。
  const movieSelection = !matchedEpisode && safeContentItem.type === RECOVERY_CONTENT_TYPE.movie
    ? resolveRecoveryMovieSelection(safeContentItem.playCatalog, historyRecord.playbackSourceId)
    : null;
  // 类型: object|null；作用: 有逻辑剧集时按包含该集的线路优先级选择；电影无身份时采用唯一正片对应线路。
  const line = matchedEpisode
    ? findPlayCatalogLine(safeContentItem.playCatalog, resolveInitialPlayCatalogLineId(safeContentItem.playCatalog, {
        episodeId: matchedEpisode.id,
        historyLineId: historyRecord.playbackSourceId,
        recentLineId: ''
      }))
    : movieSelection?.line || null;
  // 类型: object|null；作用: 当前目录确定逻辑剧集或电影唯一正片；两者都不存在时恢复失败关闭。
  const episode = matchedEpisode || movieSelection?.episode || null;
  // 条件分支: 当前目录无法唯一确认原剧集或电影正片时进入；执行内容: 不使用显示顺序、相邻集或首项回退。
  if (!line || !episode) return null;
  // 类型: object|null；作用: 从最终线路按当前逻辑 id复核剧集存在性。
  const lineEpisode = findPlayCatalogEpisode(line, episode.id);
  // 条件分支: 线路、剧集不可用或不可播放时进入；执行内容: 不构造 Provider player 请求。
  if (!line || !lineEpisode || line.available === false || lineEpisode.playable === false) return null;

  // 类型: object|null；作用: 导航服务再次从同一目录校验线路和剧集，并删除一次性恢复 query。
  const target = createContentPlaybackNavigationTarget(safeContentItem, {
    episodeId: lineEpisode.id,
    playbackSourceId: line.id,
    autoplay: true
  }, omitUserContentRecoveryQuery(baseQuery));
  // 条件分支: 标准导航服务拒绝目录选择时进入；执行内容: 保持失败关闭，不返回半完整选择。
  if (!target) return null;
  // 返回值类型: Readonly<object>；作用: PlayerView 使用同一目录对象执行 player 请求和成功后的用户记录重绑定。
  return Object.freeze({ line, episode: lineEpisode, target });
}

/**
 * 在详情分集列表中匹配历史恢复目标。
 * 纯函数: 历史恢复使用原记录；收藏恢复使用同内容最近历史；没有定位记录时返回 null。
 *
 * @param {*} episodes 替代 ContentItem 的标准分集列表。
 * @param {*} recoveryContext 当前恢复上下文。
 * @returns {object|null} 匹配 Episode 或 null。
 */
export function findUserContentRecoveryEpisode(episodes, recoveryContext) {
  return findEpisodeByLocator(episodes, recoveryContext?.historyRecord?.episodeLocator);
}

/**
 * 用户点击详情播放时提交跨源重绑定。
 * 副作用: 委托 userContentService 唯一 FIFO 和 Repository 双仓事务。
 * 成功路径: 返回新内容与分集身份，调用方随后进入播放器并使用已迁移进度。
 * 失败路径: 恢复上下文无效时返回 null；Repository 错误原样 reject。
 *
 * @param {*} recoveryContext 当前恢复上下文。
 * @param {*} contentItem 详情页完整标准 ContentItem。
 * @param {*} episode 用户最终选择的标准 Episode。
 * @returns {Promise<object|null>} 已提交恢复结果或 null。
 */
export function commitUserContentRecovery(recoveryContext, contentItem, episode) {
  // 条件分支: 当前详情不是有效恢复流程时进入；执行内容: 不创建用户内容事务。
  if (!recoveryContext) return Promise.resolve(null);
  return rebindUserContent({
    recoveryKind: recoveryContext.recoveryKind,
    recoveryKey: recoveryContext.recoveryKey,
    relatedHistoryKey: recoveryContext.historyRecord?.historyKey || '',
    contentItem,
    episode
  });
}
