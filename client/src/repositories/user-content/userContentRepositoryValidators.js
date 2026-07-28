/*
  userContentRepositoryValidators.js 模块说明

  - 文件职责:
      严格校验游客资料、收藏、播放历史、恢复策略和完整 UserContentState。
      同时生成隔离 JSON 副本，阻止未声明字段、错误唯一键和外部引用进入 Repository。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      USER_CONTENT_RECORD_LIMIT: 自定义配置，约束收藏和历史集合上限。
      buildContentKey: 自定义工具，复核 contentKey。
      buildFavoriteKey/buildHistoryKey: 自定义工具，复核用户内容唯一键。
      UserContentRepositoryValidationError: 自定义错误，报告候选字段失败。

  - 模块级常量:
      USER_PROFILE_FIELDS: Array<string>，游客资料精确字段。
      FAVORITE_RECORD_FIELDS: Array<string>，收藏记录精确字段。
      PLAY_HISTORY_RECORD_FIELDS: Array<string>，播放历史精确字段。
      COLLECTION_FIELDS: Array<string>，收藏和历史集合精确字段。
      RESUME_POLICY_FIELDS: Array<string>，恢复策略精确字段。
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
      cloneJson(value): 复制已验证 JSON 对象。

  - 模块级类:
      无

  - 对外导出:
      validateUserProfile: Function，校验用户资料。
      validateFavoritesState: Function，校验收藏集合。
      validatePlayHistoryState: Function，校验历史集合。
      validateResumePolicy: Function，校验恢复策略。
      validateUserContentState: Function，校验完整状态并排除长期 currentPlaying。
      cloneValidatedUserContentState: Function，返回完整状态隔离副本。
      cloneValidatedFavoritesState: Function，返回收藏集合隔离副本。
      cloneValidatedPlayHistoryState: Function，返回历史集合隔离副本。
      cloneValidatedResumePolicy: Function，返回恢复策略隔离副本。
      cloneValidatedUserProfile: Function，返回用户资料隔离副本。
*/

// 导入来源: ../../config/user-content.config.js；导入内容: USER_CONTENT_RECORD_LIMIT；文件作用: 校验集合上限只使用正式配置。
import { USER_CONTENT_RECORD_LIMIT } from '../../config/user-content.config.js';

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
// 类型: Array<string>；作用: 收藏保存对象只允许身份、引用和时间字段。
const FAVORITE_RECORD_FIELDS = Object.freeze([
  'sourceId', 'contentId', 'favoriteKey', 'contentKey', 'favoritedAt', 'updatedAt'
]);
// 类型: Array<string>；作用: 历史保存对象不允许混入路由或 ContentItem 展示字段。
const PLAY_HISTORY_RECORD_FIELDS = Object.freeze([
  'sourceId', 'contentId', 'type', 'episodeId', 'episodeIndex', 'historyKey', 'contentKey',
  'firstPlayedAt', 'lastPlayedAt', 'playedSeconds', 'durationSeconds', 'playStatus',
  'playbackSourceId', 'updatedAt'
]);
// 类型: Array<string>；作用: 收藏与历史集合共同只保存上限和记录数组。
const COLLECTION_FIELDS = Object.freeze(['maxRecords', 'records']);
// 类型: Array<string>；作用: 恢复策略只包含开头和结尾阈值。
const RESUME_POLICY_FIELDS = Object.freeze(['nearStartThresholdSeconds', 'nearEndThresholdSeconds']);
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
  // 条件分支: 结尾阈值小于开头阈值时进入。
  // 执行内容: 拒绝两个恢复区间倒置的策略。
  if (policy.nearEndThresholdSeconds < policy.nearStartThresholdSeconds) {
    throw new UserContentRepositoryValidationError(`${fieldName} 的结尾阈值不能小于开头阈值`);
  }
  return policy;
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
 * 校验并隔离复制完整用户内容状态。
 * 纯函数: 返回完整新对象，currentPlaying 保持 null。
 *
 * @param {*} state UserContentState 候选。
 * @returns {object} 已验证完整状态副本。
 */
export function cloneValidatedUserContentState(state) {
  return cloneJson(validateUserContentState(state));
}
