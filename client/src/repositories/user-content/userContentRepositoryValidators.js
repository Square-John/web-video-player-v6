/*
  userContentRepositoryValidators.js 模块说明

  - 文件职责:
      严格校验游客资料、收藏、播放历史、恢复策略、快捷键偏好和完整 UserContentState。
      同时生成隔离 JSON 副本，阻止未声明字段、错误唯一键和外部引用进入 Repository。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      user-content.config exports: 自定义配置，约束收藏/历史上限与播放恢复阈值范围。
      mediaPlayback.config exports: 自定义配置，提供快捷键动作、修饰符和偏好版本契约。
      homeDisplay.config exports: 自定义配置，提供首页展示偏好版本和轮播数量边界。
      buildContentKey: 自定义工具，复核 contentKey。
      buildFavoriteKey/buildHistoryKey: 自定义工具，复核用户内容唯一键。
      UserContentRepositoryValidationError: 自定义错误，报告候选字段失败。

  - 模块级常量:
      USER_PROFILE_FIELDS: Array<string>，游客资料精确字段。
      FAVORITE_RECORD_FIELDS: Array<string>，收藏记录精确字段。
      PLAY_HISTORY_RECORD_FIELDS: Array<string>，播放历史精确字段。
      COLLECTION_FIELDS: Array<string>，收藏和历史集合精确字段。
      RESUME_POLICY_FIELDS: Array<string>，恢复策略精确字段。
      SHORTCUT_PREFERENCES_FIELDS: Array<string>，快捷键偏好顶层精确字段。
      SHORTCUT_BINDING_FIELDS: Array<string>，单条快捷键绑定精确字段。
      HOME_DISPLAY_PREFERENCES_FIELDS: Array<string>，首页展示偏好精确字段。
      USER_CONTENT_STATE_FIELDS: Array<string>，完整状态精确字段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertPlainObject(value, fieldName): 校验普通对象。
      assertExactFields(value, fields, fieldName): 校验精确字段集合。
      assertNonEmptyString(value, fieldName): 校验非空字符串。
      assertIsoTimestamp(value, fieldName): 校验 ISO 时间。
      assertNonNegativeNumber(value, fieldName): 校验非负有限数字。
      assertNullablePositiveNumber(value, fieldName): 校验正数或 null。
      validateContentCardSnapshot(snapshot, fieldName): 校验完整卡片快照或旧记录 null。
      validateEpisodeLocator(locator, fieldName): 校验跨源分集定位器。
      cloneJson(value): 复制已验证 JSON 对象。

  - 模块级类:
      无

  - 对外导出:
      validateUserProfile: Function，校验用户资料。
      validateFavoritesState: Function，校验收藏集合。
      validatePlayHistoryState: Function，校验历史集合。
      validateResumePolicy: Function，校验恢复策略。
      validateShortcutPreferences: Function，校验快捷键偏好。
      validateHomeDisplayPreferences: Function，校验首页展示偏好。
      validateUserContentState: Function，校验完整状态并排除长期 currentPlaying。
      cloneValidatedUserContentState: Function，返回完整状态隔离副本。
      cloneValidatedFavoritesState: Function，返回收藏集合隔离副本。
      cloneValidatedPlayHistoryState: Function，返回历史集合隔离副本。
      cloneValidatedResumePolicy: Function，返回恢复策略隔离副本。
      cloneValidatedShortcutPreferences: Function，返回快捷键偏好隔离副本。
      cloneValidatedHomeDisplayPreferences: Function，返回首页展示偏好隔离副本。
      cloneValidatedUserProfile: Function，返回用户资料隔离副本。
*/

import {
  // 导入来源: ../../config/user-content.config.js；导入内容: USER_CONTENT_RECORD_LIMIT；文件作用: 校验集合上限只使用正式配置。
  USER_CONTENT_RECORD_LIMIT,
  // 导入来源: ../../config/user-content.config.js；导入内容: USER_CONTENT_SNAPSHOT_SCHEMA_VERSION；文件作用: 校验卡片快照结构版本。
  USER_CONTENT_SNAPSHOT_SCHEMA_VERSION,
  // 导入来源: ../../config/user-content.config.js；导入内容: USER_CONTENT_RESUME_POLICY_LIMITS；文件作用: 校验恢复设置范围只使用集中配置。
  USER_CONTENT_RESUME_POLICY_LIMITS
} from '../../config/user-content.config.js';

import {
  // 导入来源: ../../config/mediaPlayback.config.js；导入内容: PLAYBACK_SHORTCUT_ACTION；文件作用: 限制保存动作集合。
  PLAYBACK_SHORTCUT_ACTION,
  // 导入来源: ../../config/mediaPlayback.config.js；导入内容: PLAYBACK_SHORTCUT_MODIFIER；文件作用: 限制保存修饰符集合。
  PLAYBACK_SHORTCUT_MODIFIER,
  // 导入来源: ../../config/mediaPlayback.config.js；导入内容: PLAYBACK_SHORTCUT_PREFERENCES_SCHEMA_VERSION；文件作用: 校验保存结构版本。
  PLAYBACK_SHORTCUT_PREFERENCES_SCHEMA_VERSION
} from '../../config/mediaPlayback.config.js';

import {
  // 导入来源: ../../config/homeDisplay.config.js；导入内容: HOME_DISPLAY_PREFERENCES_SCHEMA_VERSION；文件作用: 校验首页展示偏好结构版本。
  HOME_DISPLAY_PREFERENCES_SCHEMA_VERSION,
  // 导入来源: ../../config/homeDisplay.config.js；导入内容: HOME_CAROUSEL_ITEM_LIMIT；文件作用: 校验轮播数量范围。
  HOME_CAROUSEL_ITEM_LIMIT
} from '../../config/homeDisplay.config.js';

// 导入来源: ../../utils/contentKeys.js；导入内容: buildContentKey；文件作用: 复核记录的内容实体引用。
import { buildContentKey } from '../../utils/contentKeys.js';

import {
  // 导入来源: ../../utils/userContentKeys.js；导入内容: buildFavoriteKey；文件作用: 复核收藏唯一键。
  buildFavoriteKey,
  // 导入来源: ../../utils/userContentKeys.js；导入内容: buildHistoryKey；文件作用: 复核电影和分集历史唯一键。
  buildHistoryKey
} from '../../utils/userContentKeys.js';

// 导入来源: ./userContentRepositoryErrors.js；导入内容: UserContentRepositoryValidationError；文件作用: 统一候选校验错误类型。
import { UserContentRepositoryValidationError } from './userContentRepositoryErrors.js';

// 类型: Array<string>；作用: 用户资料字段增减必须先更新正式契约。
const USER_PROFILE_FIELDS = Object.freeze(['id', 'name', 'role', 'status', 'message']);
// 类型: Array<string>；作用: 收藏保存对象必须包含身份、完整卡片快照和时间字段。
const FAVORITE_RECORD_FIELDS = Object.freeze([
  'sourceId', 'contentId', 'favoriteKey', 'contentKey', 'contentSnapshot', 'favoritedAt', 'updatedAt'
]);
// 类型: Array<string>；作用: 历史保存对象包含完整卡片快照和跨源定位器，不允许混入路由对象。
const PLAY_HISTORY_RECORD_FIELDS = Object.freeze([
  'sourceId', 'contentId', 'type', 'episodeId', 'episodeIndex', 'episodeLocator', 'contentSnapshot', 'historyKey', 'contentKey',
  'firstPlayedAt', 'lastPlayedAt', 'playedSeconds', 'durationSeconds', 'playStatus',
  'playbackSourceId', 'updatedAt'
]);
// 类型: Array<string>；作用: 卡片快照只保存 VideoCard 和重新搜索需要的稳定字段。
const CONTENT_CARD_SNAPSHOT_FIELDS = Object.freeze([
  'schemaVersion', 'sourceId', 'contentId', 'sourceName', 'type', 'title', 'poster', 'cover',
  'year', 'area', 'genres', 'displayTags', 'score', 'quality', 'badge', 'movie', 'tv',
  'searchHints', 'capturedAt'
]);
// 类型: Array<string>；作用: 电影快照只允许保存卡片使用的总时长。
const CONTENT_CARD_MOVIE_FIELDS = Object.freeze(['duration']);
// 类型: Array<string>；作用: 电视剧快照只允许保存卡片使用的更新和集数字段。
const CONTENT_CARD_TV_FIELDS = Object.freeze(['updateStatus', 'latestEpisode', 'totalEpisodes']);
// 类型: Array<string>；作用: 搜索提示只允许保存标题、别名、年份和类型。
const CONTENT_SEARCH_HINT_FIELDS = Object.freeze(['title', 'aliases', 'year', 'type']);
// 类型: Array<string>；作用: 分集定位器冻结跨源匹配优先级所需字段。
const EPISODE_LOCATOR_FIELDS = Object.freeze([
  'episodeId', 'seasonNumber', 'episodeNumber', 'episodeIndex', 'episodeTitle'
]);
// 类型: Array<string>；作用: 收藏与历史集合共同只保存上限和记录数组。
const COLLECTION_FIELDS = Object.freeze(['maxRecords', 'records']);
// 类型: Array<string>；作用: 恢复策略只包含开头和结尾阈值。
const RESUME_POLICY_FIELDS = Object.freeze(['nearStartThresholdSeconds', 'nearEndThresholdSeconds']);
// 类型: Array<string>；作用: 快捷键偏好只保存结构版本和绑定集合。
const SHORTCUT_PREFERENCES_FIELDS = Object.freeze(['schemaVersion', 'bindings']);
// 类型: Array<string>；作用: 单条绑定只保存项目动作、KeyboardEvent.code、修饰符和启用决定。
const SHORTCUT_BINDING_FIELDS = Object.freeze(['action', 'key', 'modifiers', 'enabled']);
// 类型: Array<string>；作用: 首页展示偏好只保存结构版本和轮播数量。
const HOME_DISPLAY_PREFERENCES_FIELDS = Object.freeze(['schemaVersion', 'carouselItemLimit']);
// 类型: Array<string>；作用: UserContentState 字段必须完整，currentPlaying 只允许会话空值进入初始化响应。
const USER_CONTENT_STATE_FIELDS = Object.freeze([
  'user', 'favorites', 'playHistory', 'currentPlaying', 'resumePolicy'
]);

/**
 * 校验普通对象。
 * 纯函数: 不修改输入，拒绝数组、null 和自定义原型实例。
 *
 * @param {*} value 待校验候选。
 * @param {string} fieldName 字段路径。
 * @returns {object} 原始普通对象。
 * @throws {UserContentRepositoryValidationError} 输入不是普通对象时抛出。
 */
function assertPlainObject(value, fieldName) {
  // 条件分支: 输入为空、数组、非对象或具有自定义原型时进入。
  // 执行内容: 拒绝无法按冻结 JSON 对象语义保存的候选。
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new UserContentRepositoryValidationError(`${fieldName} 必须是普通对象`);
  }
  return value;
}

/**
 * 校验对象字段集合与契约完全一致。
 * 纯函数: 不增删字段；缺失和额外字段都拒绝，避免保存影子状态。
 *
 * @param {object} value 已确认普通对象。
 * @param {Array<string>} fields 允许字段稳定顺序。
 * @param {string} fieldName 字段路径。
 * @returns {object} 原始对象。
 */
function assertExactFields(value, fields, fieldName) {
  // 类型: Array<string>；作用: 保存候选实际提供的可枚举字段。
  const actualFields = Object.keys(value);
  // 类型: Array<string>；作用: 定位契约声明但候选未提供的字段。
  const missingFields = fields.filter(field => !actualFields.includes(field));
  // 类型: Array<string>；作用: 定位契约未声明的影子字段。
  const unknownFields = actualFields.filter(field => !fields.includes(field));
  // 条件分支: 候选存在缺失字段或额外字段时进入。
  // 执行内容: 拒绝字段不完整或未经契约冻结的保存对象。
  if (missingFields.length > 0 || unknownFields.length > 0) {
    throw new UserContentRepositoryValidationError(
      `${fieldName} 字段不符合契约，缺失: ${missingFields.join(', ') || '无'}；额外: ${unknownFields.join(', ') || '无'}`
    );
  }
  return value;
}

/**
 * 校验非空字符串。
 * 纯函数: 不修剪或转换保存值，只有全空白文本失败。
 *
 * @param {*} value 待校验值。
 * @param {string} fieldName 字段路径。
 * @returns {string} 原始非空字符串。
 */
function assertNonEmptyString(value, fieldName) {
  // 条件分支: 输入不是字符串或只包含空白字符时进入。
  // 执行内容: 拒绝无法稳定作为身份或展示事实的文本。
  if (typeof value !== 'string' || !value.trim()) {
    throw new UserContentRepositoryValidationError(`${fieldName} 必须是非空字符串`);
  }
  return value;
}

/**
 * 校验允许为空的字符串。
 * 纯函数: 不转换值，供电影分集字段和未知线路保存空字符串。
 *
 * @param {*} value 待校验值。
 * @param {string} fieldName 字段路径。
 * @returns {string} 原始字符串。
 */
function assertString(value, fieldName) {
  // 条件分支: 输入不是字符串时进入。
  // 执行内容: 拒绝隐式类型转换，保留空字符串的正式语义。
  if (typeof value !== 'string') {
    throw new UserContentRepositoryValidationError(`${fieldName} 必须是字符串`);
  }
  return value;
}

/**
 * 校验可解析 ISO 时间文本。
 * 纯函数: 不改写时区或精度，保存调用方原始文本。
 *
 * @param {*} value 待校验时间。
 * @param {string} fieldName 字段路径。
 * @returns {string} 原始时间文本。
 */
function assertIsoTimestamp(value, fieldName) {
  // 类型: string；作用: 保存已经通过非空检查的原始时间文本。
  const timestamp = assertNonEmptyString(value, fieldName);
  // 条件分支: 浏览器无法把文本解析为有限时间戳时进入。
  // 执行内容: 拒绝无法排序和恢复的时间字段。
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new UserContentRepositoryValidationError(`${fieldName} 必须是可解析时间`);
  }
  return timestamp;
}

/**
 * 校验非负有限数字。
 * 纯函数: 不执行字符串到数字的隐式转换。
 *
 * @param {*} value 待校验数字。
 * @param {string} fieldName 字段路径。
 * @returns {number} 原始数字。
 */
function assertNonNegativeNumber(value, fieldName) {
  // 条件分支: 输入不是有限数字或小于零时进入。
  // 执行内容: 拒绝无效播放进度与恢复阈值。
  if (!Number.isFinite(value) || value < 0) {
    throw new UserContentRepositoryValidationError(`${fieldName} 必须是非负有限数字`);
  }
  return value;
}

/**
 * 校验正有限数字或 null。
 * 纯函数: null 表示数据源或播放器尚不知道总时长。
 *
 * @param {*} value 待校验值。
 * @param {string} fieldName 字段路径。
 * @returns {number|null} 原始值。
 */
function assertNullablePositiveNumber(value, fieldName) {
  // 条件分支: 输入为 null 时进入。
  // 执行内容: 保留“总时长未知”的正式空值语义。
  if (value === null) return null;
  // 条件分支: 非空输入不是正有限数字时进入。
  // 执行内容: 拒绝零、负数和无穷时长。
  if (!Number.isFinite(value) || value <= 0) {
    throw new UserContentRepositoryValidationError(`${fieldName} 必须是正有限数字或 null`);
  }
  return value;
}

/**
 * 复制已验证 JSON 值。
 * 纯函数: 校验器已经排除未声明复杂值；复制切断调用方和 Repository 引用。
 *
 * @param {*} value 已验证值。
 * @returns {*} JSON 隔离副本。
 */
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 校验正整数或 null。
 * 纯函数: 不转换输入；null 表示 Provider 没有交付该结构化序号。
 *
 * @param {*} value 序号候选。
 * @param {string} fieldName 字段路径。
 * @returns {number|null} 原始正整数或 null。
 */
function assertNullablePositiveInteger(value, fieldName) {
  // 条件分支: 候选为 null 时进入；执行内容: 保留未知序号语义。
  if (value === null) return null;
  // 条件分支: 候选不是正整数时进入；执行内容: 拒绝模糊或不可稳定匹配的序号。
  if (!Number.isInteger(value) || value <= 0) {
    throw new UserContentRepositoryValidationError(`${fieldName} 必须是正整数或 null`);
  }
  return value;
}

/**
 * 校验字符串数组。
 * 纯函数: 不修改数组；拒绝空白项和重复项，保持保存顺序可解释。
 *
 * @param {*} value 字符串数组候选。
 * @param {string} fieldName 字段路径。
 * @returns {Array<string>} 原始数组。
 */
function assertStringList(value, fieldName) {
  // 条件分支: 候选不是数组时进入；执行内容: 拒绝对象或标量冒充列表。
  if (!Array.isArray(value)) {
    throw new UserContentRepositoryValidationError(`${fieldName} 必须是字符串数组`);
  }
  // 类型: Set<string>；作用: 验证快照不会长期保存重复展示或搜索字段。
  const seen = new Set();
  value.forEach((item, index) => {
    assertNonEmptyString(item, `${fieldName}[${index}]`);
    // 条件分支: 当前文本已经出现时进入；执行内容: 拒绝重复保存事实。
    if (seen.has(item)) {
      throw new UserContentRepositoryValidationError(`${fieldName} 不能包含重复文本`);
    }
    seen.add(item);
  });
  return value;
}

/**
 * 校验完整卡片快照或旧记录空值。
 * 纯函数: 不修改候选；null 仅表示 v24 前记录没有可恢复展示字段。
 *
 * @param {*} snapshot ContentCardSnapshot 候选。
 * @param {string} fieldName 字段路径。
 * @returns {object|null} 原始快照或 null。
 */
function validateContentCardSnapshot(snapshot, fieldName) {
  // 条件分支: v24 迁移的旧记录没有快照时进入；执行内容: 保留 null，不伪造标题或海报。
  if (snapshot === null) return null;
  // 类型: object；作用: 保存字段集合已经冻结的快照候选。
  const candidate = assertExactFields(
    assertPlainObject(snapshot, fieldName),
    CONTENT_CARD_SNAPSHOT_FIELDS,
    fieldName
  );
  // 条件分支: 快照结构版本不是当前版本时进入；执行内容: 拒绝未知字段语义。
  if (candidate.schemaVersion !== USER_CONTENT_SNAPSHOT_SCHEMA_VERSION) {
    throw new UserContentRepositoryValidationError(`${fieldName}.schemaVersion 不受支持`);
  }
  assertNonEmptyString(candidate.sourceId, `${fieldName}.sourceId`);
  assertNonEmptyString(candidate.contentId, `${fieldName}.contentId`);
  assertString(candidate.sourceName, `${fieldName}.sourceName`);
  assertNonEmptyString(candidate.type, `${fieldName}.type`);
  assertNonEmptyString(candidate.title, `${fieldName}.title`);
  ['poster', 'cover', 'year', 'area', 'quality', 'badge'].forEach((field) => {
    assertString(candidate[field], `${fieldName}.${field}`);
  });
  assertStringList(candidate.genres, `${fieldName}.genres`);
  assertStringList(candidate.displayTags, `${fieldName}.displayTags`);
  // 条件分支: score 既非 null 也非有限数字时进入；执行内容: 拒绝字符串评分进入标准快照。
  if (candidate.score !== null && !Number.isFinite(candidate.score)) {
    throw new UserContentRepositoryValidationError(`${fieldName}.score 必须是有限数字或 null`);
  }
  // 类型: object；作用: 校验电影卡片字段没有夹带额外详情数据。
  const movie = assertExactFields(
    assertPlainObject(candidate.movie, `${fieldName}.movie`),
    CONTENT_CARD_MOVIE_FIELDS,
    `${fieldName}.movie`
  );
  assertString(movie.duration, `${fieldName}.movie.duration`);
  // 类型: object；作用: 校验电视剧卡片字段没有夹带完整 episodes。
  const tv = assertExactFields(
    assertPlainObject(candidate.tv, `${fieldName}.tv`),
    CONTENT_CARD_TV_FIELDS,
    `${fieldName}.tv`
  );
  CONTENT_CARD_TV_FIELDS.forEach(field => assertString(tv[field], `${fieldName}.tv.${field}`));
  // 类型: object；作用: 校验重新搜索提示与快照身份保持同一内容事实。
  const searchHints = assertExactFields(
    assertPlainObject(candidate.searchHints, `${fieldName}.searchHints`),
    CONTENT_SEARCH_HINT_FIELDS,
    `${fieldName}.searchHints`
  );
  assertNonEmptyString(searchHints.title, `${fieldName}.searchHints.title`);
  assertStringList(searchHints.aliases, `${fieldName}.searchHints.aliases`);
  assertString(searchHints.year, `${fieldName}.searchHints.year`);
  assertNonEmptyString(searchHints.type, `${fieldName}.searchHints.type`);
  assertIsoTimestamp(candidate.capturedAt, `${fieldName}.capturedAt`);
  // 条件分支: 快照或搜索提示身份与记录内容不自洽时进入；执行内容: 阻止恢复到错误内容。
  if (searchHints.title !== candidate.title || searchHints.year !== candidate.year || searchHints.type !== candidate.type) {
    throw new UserContentRepositoryValidationError(`${fieldName}.searchHints 与卡片快照不一致`);
  }
  return candidate;
}

/**
 * 校验跨源分集定位器。
 * 纯函数: 不修改候选；电影也保存字段完整的空定位器。
 *
 * @param {*} locator EpisodeLocator 候选。
 * @param {string} fieldName 字段路径。
 * @returns {object} 原始定位器。
 */
function validateEpisodeLocator(locator, fieldName) {
  // 类型: object；作用: 保存字段集合已经冻结的定位器候选。
  const candidate = assertExactFields(
    assertPlainObject(locator, fieldName),
    EPISODE_LOCATOR_FIELDS,
    fieldName
  );
  assertString(candidate.episodeId, `${fieldName}.episodeId`);
  assertNullablePositiveInteger(candidate.seasonNumber, `${fieldName}.seasonNumber`);
  assertNullablePositiveInteger(candidate.episodeNumber, `${fieldName}.episodeNumber`);
  assertNullablePositiveInteger(candidate.episodeIndex, `${fieldName}.episodeIndex`);
  assertString(candidate.episodeTitle, `${fieldName}.episodeTitle`);
  return candidate;
}

/**
 * 校验本地游客资料。
 * 纯函数: 不修改资料；当前字段仍不表示登录或云端同步。
 *
 * @param {*} user 用户资料候选。
 * @param {string} fieldName 字段路径。
 * @returns {object} 原始已验证资料。
 */
export function validateUserProfile(user, fieldName = 'user') {
  // 类型: object；作用: 保存字段集合已与用户资料契约一致的候选。
  const profile = assertExactFields(assertPlainObject(user, fieldName), USER_PROFILE_FIELDS, fieldName);
  USER_PROFILE_FIELDS.forEach(field => assertNonEmptyString(profile[field], `${fieldName}.${field}`));
  return profile;
}

/**
 * 校验单条收藏记录。
 * 纯函数: 复算 favoriteKey 和 contentKey，不修改记录。
 *
 * @param {*} record 收藏候选。
 * @param {string} fieldName 字段路径。
 * @returns {object} 原始已验证记录。
 */
function validateFavoriteRecord(record, fieldName) {
  // 类型: object；作用: 保存字段集合已与收藏记录契约一致的候选。
  const candidate = assertExactFields(assertPlainObject(record, fieldName), FAVORITE_RECORD_FIELDS, fieldName);
  assertNonEmptyString(candidate.sourceId, `${fieldName}.sourceId`);
  assertNonEmptyString(candidate.contentId, `${fieldName}.contentId`);
  assertIsoTimestamp(candidate.favoritedAt, `${fieldName}.favoritedAt`);
  assertIsoTimestamp(candidate.updatedAt, `${fieldName}.updatedAt`);
  // 类型: object|null；作用: 复核快照与收藏主身份一致，null 只允许历史迁移记录保留。
  const contentSnapshot = validateContentCardSnapshot(candidate.contentSnapshot, `${fieldName}.contentSnapshot`);
  // 条件分支: 快照身份与收藏主字段不一致时进入；执行内容: 阻止卡片展示和删除键指向不同内容。
  if (contentSnapshot
    && (contentSnapshot.sourceId !== candidate.sourceId || contentSnapshot.contentId !== candidate.contentId)) {
    throw new UserContentRepositoryValidationError(`${fieldName}.contentSnapshot 与收藏身份不一致`);
  }
  // 类型: string；作用: 根据 sourceId/contentId 复算权威收藏唯一键。
  const expectedKey = buildFavoriteKey(candidate.sourceId, candidate.contentId);
  // 条件分支: 候选唯一键或内容引用键与身份字段不一致时进入。
  // 执行内容: 拒绝后续无法稳定查询或补全内容的收藏记录。
  if (candidate.favoriteKey !== expectedKey || candidate.contentKey !== buildContentKey(candidate.sourceId, candidate.contentId)) {
    throw new UserContentRepositoryValidationError(`${fieldName} 的 favoriteKey 或 contentKey 与内容身份不一致`);
  }
  return candidate;
}

/**
 * 校验单条播放历史。
 * 纯函数: 复算 historyKey/contentKey，并检查分集、进度和时间字段。
 *
 * @param {*} record 历史候选。
 * @param {string} fieldName 字段路径。
 * @returns {object} 原始已验证记录。
 */
function validatePlayHistoryRecord(record, fieldName) {
  // 类型: object；作用: 保存字段集合已与播放历史契约一致的候选。
  const candidate = assertExactFields(assertPlainObject(record, fieldName), PLAY_HISTORY_RECORD_FIELDS, fieldName);
  assertNonEmptyString(candidate.sourceId, `${fieldName}.sourceId`);
  assertNonEmptyString(candidate.contentId, `${fieldName}.contentId`);
  assertNonEmptyString(candidate.type, `${fieldName}.type`);
  assertString(candidate.episodeId, `${fieldName}.episodeId`);
  // 类型: object；作用: 校验分集定位器并用于和当前 Provider 内身份字段交叉复核。
  const episodeLocator = validateEpisodeLocator(candidate.episodeLocator, `${fieldName}.episodeLocator`);
  // 类型: object|null；作用: 校验历史卡片快照，null 只表示 v24 前旧记录。
  const contentSnapshot = validateContentCardSnapshot(candidate.contentSnapshot, `${fieldName}.contentSnapshot`);
  // 条件分支: 快照身份或类型与历史主字段不一致时进入；执行内容: 阻止跨源恢复读取错误内容。
  if (contentSnapshot
    && (contentSnapshot.sourceId !== candidate.sourceId
      || contentSnapshot.contentId !== candidate.contentId
      || contentSnapshot.type !== candidate.type)) {
    throw new UserContentRepositoryValidationError(`${fieldName}.contentSnapshot 与历史身份不一致`);
  }
  // 条件分支: 定位器的原 Provider 分集身份与历史键字段不一致时进入；执行内容: 阻止恢复链定位另一分集。
  if (episodeLocator.episodeId !== candidate.episodeId || episodeLocator.episodeIndex !== candidate.episodeIndex) {
    throw new UserContentRepositoryValidationError(`${fieldName}.episodeLocator 与历史分集身份不一致`);
  }
  // 条件分支: 分集序号既非 null 也非正整数时进入。
  // 执行内容: 拒绝无法稳定定位电视剧分集的序号。
  if (candidate.episodeIndex !== null
    && (!Number.isInteger(candidate.episodeIndex) || candidate.episodeIndex <= 0)) {
    throw new UserContentRepositoryValidationError(`${fieldName}.episodeIndex 必须是正整数或 null`);
  }
  assertIsoTimestamp(candidate.firstPlayedAt, `${fieldName}.firstPlayedAt`);
  assertIsoTimestamp(candidate.lastPlayedAt, `${fieldName}.lastPlayedAt`);
  assertIsoTimestamp(candidate.updatedAt, `${fieldName}.updatedAt`);
  assertNonNegativeNumber(candidate.playedSeconds, `${fieldName}.playedSeconds`);
  assertNullablePositiveNumber(candidate.durationSeconds, `${fieldName}.durationSeconds`);
  assertNonEmptyString(candidate.playStatus, `${fieldName}.playStatus`);
  assertString(candidate.playbackSourceId, `${fieldName}.playbackSourceId`);
  // 条件分支: 历史唯一键或内容引用键与身份字段不一致时进入。
  // 执行内容: 拒绝会覆盖错误分集或无法补全内容的记录。
  if (candidate.historyKey !== buildHistoryKey(candidate)
    || candidate.contentKey !== buildContentKey(candidate.sourceId, candidate.contentId)) {
    throw new UserContentRepositoryValidationError(`${fieldName} 的 historyKey 或 contentKey 与播放身份不一致`);
  }
  return candidate;
}

/**
 * 校验收藏集合。
 * 纯函数: 检查上限、数组、唯一键和每条记录，不排序或裁剪调用方输入。
 *
 * @param {*} favorites 收藏集合候选。
 * @param {string} fieldName 字段路径。
 * @returns {object} 原始已验证收藏集合。
 */
export function validateFavoritesState(favorites, fieldName = 'favorites') {
  // 类型: object；作用: 保存字段集合已与收藏集合契约一致的候选。
  const state = assertExactFields(assertPlainObject(favorites, fieldName), COLLECTION_FIELDS, fieldName);
  // 条件分支: 集合上限没有使用正式配置时进入。
  // 执行内容: 拒绝调用方私自扩大或缩小持久化边界。
  if (state.maxRecords !== USER_CONTENT_RECORD_LIMIT) {
    throw new UserContentRepositoryValidationError(`${fieldName}.maxRecords 必须等于正式上限 ${USER_CONTENT_RECORD_LIMIT}`);
  }
  // 条件分支: records 不是数组或数量超过正式上限时进入。
  // 执行内容: 拒绝无法逐条校验或需要 Repository 隐式裁剪的候选。
  if (!Array.isArray(state.records) || state.records.length > state.maxRecords) {
    throw new UserContentRepositoryValidationError(`${fieldName}.records 必须是未超过上限的数组`);
  }
  // 类型: Set<string>；作用: 在单次校验中检测重复 favoriteKey。
  const keys = new Set();
  state.records.forEach((record, index) => {
    validateFavoriteRecord(record, `${fieldName}.records[${index}]`);
    // 条件分支: 当前 favoriteKey 已在前序记录出现时进入。
    // 执行内容: 拒绝同一内容的重复收藏保存对象。
    if (keys.has(record.favoriteKey)) {
      throw new UserContentRepositoryValidationError(`${fieldName}.records 包含重复 favoriteKey`);
    }
    keys.add(record.favoriteKey);
  });
  return state;
}

/**
 * 校验播放历史集合。
 * 纯函数: 检查上限、数组、唯一键和每条记录，不改变记录顺序。
 *
 * @param {*} playHistory 历史集合候选。
 * @param {string} fieldName 字段路径。
 * @returns {object} 原始已验证历史集合。
 */
export function validatePlayHistoryState(playHistory, fieldName = 'playHistory') {
  // 类型: object；作用: 保存字段集合已与历史集合契约一致的候选。
  const state = assertExactFields(assertPlainObject(playHistory, fieldName), COLLECTION_FIELDS, fieldName);
  // 条件分支: 集合上限没有使用正式配置时进入。
  // 执行内容: 拒绝调用方私自改变历史容量边界。
  if (state.maxRecords !== USER_CONTENT_RECORD_LIMIT) {
    throw new UserContentRepositoryValidationError(`${fieldName}.maxRecords 必须等于正式上限 ${USER_CONTENT_RECORD_LIMIT}`);
  }
  // 条件分支: records 不是数组或数量超过正式上限时进入。
  // 执行内容: 拒绝需要 Repository 猜测修复或隐式裁剪的候选。
  if (!Array.isArray(state.records) || state.records.length > state.maxRecords) {
    throw new UserContentRepositoryValidationError(`${fieldName}.records 必须是未超过上限的数组`);
  }
  // 类型: Set<string>；作用: 在单次校验中检测重复 historyKey。
  const keys = new Set();
  state.records.forEach((record, index) => {
    validatePlayHistoryRecord(record, `${fieldName}.records[${index}]`);
    // 条件分支: 当前 historyKey 已在前序记录出现时进入。
    // 执行内容: 拒绝同一电影或电视剧分集重复保存。
    if (keys.has(record.historyKey)) {
      throw new UserContentRepositoryValidationError(`${fieldName}.records 包含重复 historyKey`);
    }
    keys.add(record.historyKey);
  });
  return state;
}

/**
 * 校验播放恢复策略。
 * 纯函数: 两个阈值必须是非负有限数字，结尾阈值不得小于开头阈值。
 *
 * @param {*} resumePolicy 恢复策略候选。
 * @param {string} fieldName 字段路径。
 * @returns {object} 原始已验证策略。
 */
export function validateResumePolicy(resumePolicy, fieldName = 'resumePolicy') {
  // 类型: object；作用: 保存字段集合已与恢复策略契约一致的候选。
  const policy = assertExactFields(assertPlainObject(resumePolicy, fieldName), RESUME_POLICY_FIELDS, fieldName);
  assertNonNegativeNumber(policy.nearStartThresholdSeconds, `${fieldName}.nearStartThresholdSeconds`);
  assertNonNegativeNumber(policy.nearEndThresholdSeconds, `${fieldName}.nearEndThresholdSeconds`);
  // 类型: Readonly<object>；作用: 读取近头阈值集中最小值和最大值。
  const nearStartLimits = USER_CONTENT_RESUME_POLICY_LIMITS.nearStartThresholdSeconds;
  // 类型: Readonly<object>；作用: 读取近尾阈值集中最小值和最大值。
  const nearEndLimits = USER_CONTENT_RESUME_POLICY_LIMITS.nearEndThresholdSeconds;
  // 条件分支: 任一阈值超出设置配置允许范围时进入。
  // 执行内容: 拒绝绕过设置页输入边界的直接保存候选。
  if (policy.nearStartThresholdSeconds < nearStartLimits.minimum
    || policy.nearStartThresholdSeconds > nearStartLimits.maximum
    || policy.nearEndThresholdSeconds < nearEndLimits.minimum
    || policy.nearEndThresholdSeconds > nearEndLimits.maximum) {
    throw new UserContentRepositoryValidationError(`${fieldName} 超出正式设置范围`);
  }
  // 条件分支: 结尾阈值小于开头阈值时进入。
  // 执行内容: 拒绝两个恢复区间倒置的策略。
  if (policy.nearEndThresholdSeconds < policy.nearStartThresholdSeconds) {
    throw new UserContentRepositoryValidationError(`${fieldName} 的结尾阈值不能小于开头阈值`);
  }
  return policy;
}

/**
 * 校验项目快捷键偏好。
 * 纯函数: 只验证保存候选，不排序或修改绑定。
 * 成功路径: 版本、动作、键位、修饰符、Boolean 和启用签名全部有效。
 * 失败路径: 未知字段、重复动作、未知修饰符或启用键位冲突时抛稳定 Repository 校验错误。
 *
 * @param {*} shortcutPreferences 快捷键偏好候选。
 * @param {string} fieldName 字段路径。
 * @returns {object} 原始已验证快捷键偏好。
 */
export function validateShortcutPreferences(shortcutPreferences, fieldName = 'shortcutPreferences') {
  // 类型: object；作用: 保存字段集合已与快捷键偏好契约一致的候选。
  const preferences = assertExactFields(
    assertPlainObject(shortcutPreferences, fieldName),
    SHORTCUT_PREFERENCES_FIELDS,
    fieldName
  );
  // 条件分支: 保存版本不是当前正式版本或 bindings 不是数组时进入。
  // 执行内容: 拒绝未迁移配置和不可枚举绑定集合。
  if (preferences.schemaVersion !== PLAYBACK_SHORTCUT_PREFERENCES_SCHEMA_VERSION
    || !Array.isArray(preferences.bindings)) {
    throw new UserContentRepositoryValidationError(`${fieldName} 版本或 bindings 无效`);
  }

  // 类型: Array<string>；作用: 固定允许保存的项目播放器动作全集。
  const allowedActions = Object.values(PLAYBACK_SHORTCUT_ACTION);
  // 类型: Array<string>；作用: 固定允许保存的组合键修饰符全集。
  const allowedModifiers = Object.values(PLAYBACK_SHORTCUT_MODIFIER);
  // 类型: Set<string>；作用: 检测同一项目动作是否被重复定义。
  const actions = new Set();
  // 类型: Set<string>；作用: 检测启用绑定是否争用同一按键组合。
  const enabledSignatures = new Set();

  preferences.bindings.forEach((binding, index) => {
    // 类型: string；作用: 为当前绑定生成精确错误路径。
    const bindingField = `${fieldName}.bindings[${index}]`;
    // 类型: object；作用: 保存字段集合已与单条绑定契约一致的候选。
    const candidate = assertExactFields(
      assertPlainObject(binding, bindingField),
      SHORTCUT_BINDING_FIELDS,
      bindingField
    );
    assertNonEmptyString(candidate.action, `${bindingField}.action`);
    assertNonEmptyString(candidate.key, `${bindingField}.key`);
    // 条件分支: 动作不属于项目命令或已在前序绑定出现时进入。
    // 执行内容: 拒绝第三方命令和同一动作的多个保存权威。
    if (!allowedActions.includes(candidate.action) || actions.has(candidate.action)) {
      throw new UserContentRepositoryValidationError(`${bindingField}.action 无效或重复`);
    }
    actions.add(candidate.action);
    // 条件分支: 修饰符不是数组、包含重复值或未知值时进入。
    // 执行内容: 拒绝无法形成稳定组合键签名的保存对象。
    if (!Array.isArray(candidate.modifiers)
      || new Set(candidate.modifiers).size !== candidate.modifiers.length
      || candidate.modifiers.some(modifier => !allowedModifiers.includes(modifier))) {
      throw new UserContentRepositoryValidationError(`${bindingField}.modifiers 无效`);
    }
    // 条件分支: enabled 不是布尔值时进入。
    // 执行内容: 不把 truthy/falsy 隐式转换成用户决定。
    if (typeof candidate.enabled !== 'boolean') {
      throw new UserContentRepositoryValidationError(`${bindingField}.enabled 必须是 Boolean`);
    }
    // 条件分支: 当前绑定启用时进入。
    // 执行内容: 只让实际生效配置占用组合键，关闭项可以保留相同键位。
    if (candidate.enabled) {
      // 类型: string；作用: 使用排序后的修饰符和 code 构造与运行时一致的冲突签名。
      const signature = `${[...candidate.modifiers].sort().join('+')}::${candidate.key}`;
      // 条件分支: 组合键已被另一个启用动作占用时进入。
      // 执行内容: 拒绝播放器无法唯一分派的保存配置。
      if (enabledSignatures.has(signature)) {
        throw new UserContentRepositoryValidationError(`${bindingField} 与其他启用快捷键冲突`);
      }
      enabledSignatures.add(signature);
    }
  });

  return preferences;
}

/**
 * 校验首页展示偏好。
 * 纯函数: 不修改输入；结构版本和轮播数量必须与集中配置一致。
 * 成功路径: 返回原始候选，调用方使用 cloneValidatedHomeDisplayPreferences 断开引用。
 * 失败路径: 未知字段、未知版本、非整数或越界数量抛稳定 Repository 校验错误。
 *
 * @param {*} homeDisplayPreferences 首页展示偏好候选。
 * @param {string} fieldName 字段路径。
 * @returns {object} 原始已验证首页展示偏好。
 */
export function validateHomeDisplayPreferences(homeDisplayPreferences, fieldName = 'homeDisplayPreferences') {
  // 类型: object；作用: 保存字段集合已与首页展示偏好契约一致的候选。
  const preferences = assertExactFields(
    assertPlainObject(homeDisplayPreferences, fieldName),
    HOME_DISPLAY_PREFERENCES_FIELDS,
    fieldName
  );
  // 条件分支: 版本不是当前正式结构时进入；执行内容: 拒绝页面静默解释未知字段版本。
  if (preferences.schemaVersion !== HOME_DISPLAY_PREFERENCES_SCHEMA_VERSION) {
    throw new UserContentRepositoryValidationError(`${fieldName}.schemaVersion 无效`);
  }
  // 条件分支: 数量不是配置范围内的整数时进入；执行内容: 拒绝小数、字符串、NaN 和越界值。
  if (!Number.isInteger(preferences.carouselItemLimit)
    || preferences.carouselItemLimit < HOME_CAROUSEL_ITEM_LIMIT.minimum
    || preferences.carouselItemLimit > HOME_CAROUSEL_ITEM_LIMIT.maximum) {
    throw new UserContentRepositoryValidationError(`${fieldName}.carouselItemLimit 超出正式范围`);
  }
  return preferences;
}

/**
 * 校验完整用户内容状态。
 * 纯函数: 初始化与长期响应必须携带 currentPlaying=null，防止会话状态写入数据库。
 *
 * @param {*} state UserContentState 候选。
 * @param {string} fieldName 字段路径。
 * @returns {object} 原始已验证状态。
 */
export function validateUserContentState(state, fieldName = 'userContentState') {
  // 类型: object；作用: 保存字段集合已与完整 UserContentState 契约一致的候选。
  const candidate = assertExactFields(assertPlainObject(state, fieldName), USER_CONTENT_STATE_FIELDS, fieldName);
  validateUserProfile(candidate.user, `${fieldName}.user`);
  validateFavoritesState(candidate.favorites, `${fieldName}.favorites`);
  validatePlayHistoryState(candidate.playHistory, `${fieldName}.playHistory`);
  validateResumePolicy(candidate.resumePolicy, `${fieldName}.resumePolicy`);
  // 条件分支: 初始化或 Repository 响应携带非空 currentPlaying 时进入。
  // 执行内容: 拒绝把会话播放状态混入长期保存对象。
  if (candidate.currentPlaying !== null) {
    throw new UserContentRepositoryValidationError(`${fieldName}.currentPlaying 必须为 null`);
  }
  return candidate;
}

/**
 * 校验并隔离复制用户资料。
 * 纯函数: 返回新对象，调用方修改结果不会改写输入。
 *
 * @param {*} user 用户资料候选。
 * @returns {object} 已验证资料副本。
 */
export function cloneValidatedUserProfile(user) {
  return cloneJson(validateUserProfile(user));
}

/**
 * 校验并隔离复制收藏集合。
 * 纯函数: 返回包含新 records 数组和记录对象的副本。
 *
 * @param {*} favorites 收藏集合候选。
 * @returns {object} 已验证收藏集合副本。
 */
export function cloneValidatedFavoritesState(favorites) {
  return cloneJson(validateFavoritesState(favorites));
}

/**
 * 校验并隔离复制播放历史集合。
 * 纯函数: 返回包含新 records 数组和记录对象的副本。
 *
 * @param {*} playHistory 播放历史集合候选。
 * @returns {object} 已验证历史集合副本。
 */
export function cloneValidatedPlayHistoryState(playHistory) {
  return cloneJson(validatePlayHistoryState(playHistory));
}

/**
 * 校验并隔离复制恢复策略。
 * 纯函数: 返回新策略对象，不修改输入阈值。
 *
 * @param {*} resumePolicy 恢复策略候选。
 * @returns {object} 已验证策略副本。
 */
export function cloneValidatedResumePolicy(resumePolicy) {
  return cloneJson(validateResumePolicy(resumePolicy));
}

/**
 * 校验并隔离复制快捷键偏好。
 * 纯函数: 返回新顶层对象、绑定数组和修饰符数组，不保留调用方引用。
 *
 * @param {*} shortcutPreferences 快捷键偏好候选。
 * @returns {object} 已验证快捷键偏好副本。
 */
export function cloneValidatedShortcutPreferences(shortcutPreferences) {
  return cloneJson(validateShortcutPreferences(shortcutPreferences));
}

/**
 * 校验并隔离复制首页展示偏好。
 * 纯函数: 返回新的顶层对象，不保留调用方的设置引用。
 *
 * @param {*} homeDisplayPreferences 首页展示偏好候选。
 * @returns {object} 已验证首页展示偏好副本。
 */
export function cloneValidatedHomeDisplayPreferences(homeDisplayPreferences) {
  return cloneJson(validateHomeDisplayPreferences(homeDisplayPreferences));
}

/**
 * 校验并隔离复制完整用户内容状态。
 * 纯函数: 返回完整新对象，currentPlaying 保持 null。
 *
 * @param {*} state UserContentState 候选。
 * @returns {object} 已验证完整状态副本。
 */
export function cloneValidatedUserContentState(state) {
  return cloneJson(validateUserContentState(state));
}
