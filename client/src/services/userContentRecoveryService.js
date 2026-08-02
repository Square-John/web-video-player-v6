/*
  userContentRecoveryService.js 模块说明

  - 文件职责:
      连接用户内容记录、SourceManager 可用性、搜索/详情路由上下文、分集匹配和最终双仓重绑定。
      页面只调用通用恢复门面，不自行解释授权指纹、Provider readiness、健康状态或用户记录保存结构。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      USER_CONTENT_RECOVERY_KIND: 自定义配置，提供收藏和历史恢复类型。
      HEALTH_STATUS: 自定义配置，提供数据源不可用健康枚举。
      userContentSelectors exports: 自定义 selector，按稳定记录键读取恢复目标并定位收藏关联的最近历史。
      settingsService exports: 自定义设置服务，读取可见 SourceRecord 并复用统一可运行门禁。
      findEpisodeByLocator: 自定义快照服务，按冻结优先级匹配替代分集。
      rebindUserContent: 自定义用户内容服务，在双仓事务中提交最终重绑定。

  - 模块级常量:
      USER_CONTENT_RECOVERY_QUERY: Readonly<object>，路由 query 稳定字段名。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeQueryText(value): 把 Vue Router query 收敛为单一文本。
      normalizeSourceName(value): 把来源名称候选收敛为非空文本。

  - 模块级类:
      无

  - 对外导出:
      getUserContentRecoveryContext: Function，从 query 读取并验证恢复记录。
      getUserContentSourceStatus: Function，返回个人中心状态点所需可用性。
      resolveUserContentSourceName: Function，按快照、当前定义、旧字段和身份顺序解析来源名称。
      createUserContentRecoverySearchTarget: Function，为失效记录创建搜索路由。
      createUserContentRecoveryDetailTarget: Function，为搜索结果创建保留恢复键的详情路由。
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

// 类型: Readonly<object>；作用: 冻结跨搜索和详情页面只传递恢复类型与记录键，不传用户数据正文。
export const USER_CONTENT_RECOVERY_QUERY = Object.freeze({
  // 类型: string；作用: query 中的收藏或历史类型字段名。
  kind: 'recoveryKind',
  // 类型: string；作用: query 中的稳定用户记录键字段名。
  key: 'recoveryKey'
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
