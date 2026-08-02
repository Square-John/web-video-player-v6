/*
  mediaPlaybackValidators.js 模块说明

  - 文件职责:
      严格校验并隔离 ContentItem.playback.media 和媒体会话事件。
      在创建 xgplayer 或采用组件事件前失败关闭非法类型、代理交付、URL、状态和错误组合。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      mediaPlayback.config exports: 自定义配置，提供媒体类型、交付方式、阶段和稳定错误码。

  - 模块级常量:
      MEDIA_FIELDS: Array<string>，已解析媒体精确字段集合。
      MEDIA_SESSION_FIELDS: Array<string>，媒体会话精确字段集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      isPlainObject(value): 判断输入是否为普通对象。
      assertContractFields(value, allowedFields, requiredFields, label): 拒绝契约外字段和必填字段缺失。
      normalizeText(value): 清理字符串字段。
      normalizeNonNegativeNumber(value, nullable, label): 校验媒体秒数。
      isHttpMediaUrl(value): 校验浏览器直连 HTTP/HTTPS URL。

  - 模块级类:
      MediaPlaybackValidationError: 媒体线路或会话字段非法时抛出的稳定校验错误。

  - 对外导出:
      MediaPlaybackValidationError: Class，供页面和测试识别契约失败。
      normalizeMediaPlaybackMedia: Function，返回隔离且冻结的浏览器直连媒体。
      normalizeMediaPlaybackSession: Function，返回隔离且冻结的媒体会话状态。
*/

import {
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: MEDIA_DELIVERY_MODE；文件作用: 只接受浏览器 direct 线路。
  MEDIA_DELIVERY_MODE,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: MEDIA_PLAYBACK_ERROR_CODE；文件作用: 为校验错误提供稳定 code。
  MEDIA_PLAYBACK_ERROR_CODE,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: MEDIA_PLAYBACK_PHASE；文件作用: 限制媒体会话阶段。
  MEDIA_PLAYBACK_PHASE,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: MEDIA_TYPE；文件作用: 限制播放器支持类型。
  MEDIA_TYPE
} from '../config/mediaPlayback.config.js';

// 类型: Array<string>。
// 作用: 媒体只允许正式 ContentItem.playback.media 四字段，阻止线路、headers、Cookie 或源站页面进入适配层。
const MEDIA_FIELDS = Object.freeze([
  'type',
  'url',
  'quality',
  'deliveryMode'
]);

// 类型: Array<string>。
// 作用: 媒体事件只能发布冻结会话字段，不泄漏第三方 Error、Player 或 HTMLMediaElement。
const MEDIA_SESSION_FIELDS = Object.freeze([
  'phase',
  'sourceId',
  'contentId',
  'episodeId',
  'episodeIndex',
  'playbackSourceId',
  'playedSeconds',
  'durationSeconds',
  'bufferedSeconds',
  'errorCode',
  'errorMessage'
]);

/**
 * 媒体契约校验错误。
 * 调用方: 播放器适配组件和媒体领域测试。
 * 状态: 只保存稳定 code、用户安全 message 和可选 cause，不保存媒体 URL 或凭据。
 */
export class MediaPlaybackValidationError extends Error {
  /**
   * 创建媒体契约校验错误。
   * 副作用: 创建 Error 实例并保存稳定字段，不写日志或页面状态。
   *
   * @param {string} code 稳定媒体错误码。
   * @param {string} message 用户安全错误说明。
   * @param {Error} [cause] 原始错误，仅供内部诊断链。
   */
  constructor(code, message, cause) {
    super(message);
    this.name = 'MediaPlaybackValidationError';
    this.code = code;
    // 条件分支: 调用方提供底层异常时进入；执行内容: 仅保留内部诊断链，不把 cause 转入页面契约。
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * 判断输入是否为普通对象。
 * 纯函数: 不修改输入。
 *
 * @param {*} value 候选输入。
 * @returns {boolean} 非数组对象时为 true。
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 校验对象允许字段和必填字段集合。
 * 纯函数: 只读取对象 key。
 * 失败路径: 必填字段缺失或出现额外字段时抛 MediaPlaybackValidationError。
 *
 * @param {object} value 候选对象。
 * @param {Array<string>} allowedFields 允许字段。
 * @param {Array<string>} requiredFields 必填字段。
 * @param {string} label 错误定位标签。
 * @returns {void} 校验通过无返回值。
 * @throws {MediaPlaybackValidationError} 结构不精确时抛出。
 */
function assertContractFields(value, allowedFields, requiredFields, label) {
  // 条件分支: 候选值不是普通对象时进入；执行内容: 在读取字段前以稳定校验错误失败关闭。
  if (!isPlainObject(value)) {
    throw new MediaPlaybackValidationError(MEDIA_PLAYBACK_ERROR_CODE.invalidSource, `${label} 必须是对象`);
  }
  // 类型: Array<string>；作用: 保存候选对象真实字段，供允许范围和必填集合检查。
  const actualFields = Object.keys(value);
  // 条件分支: 任一真实字段不在允许集合时进入；执行内容: 拒绝 headers、凭据或未定义扩展进入媒体契约。
  if (actualFields.some(field => !allowedFields.includes(field))) {
    throw new MediaPlaybackValidationError(MEDIA_PLAYBACK_ERROR_CODE.invalidSource, `${label} 字段不符合媒体契约`);
  }
  // 条件分支: 任一必填字段没有作为自有属性提供时进入；执行内容: 拒绝依赖原型或默认猜测补齐关键状态。
  if (requiredFields.some(field => !Object.prototype.hasOwnProperty.call(value, field))) {
    throw new MediaPlaybackValidationError(MEDIA_PLAYBACK_ERROR_CODE.invalidSource, `${label} 缺少媒体契约必填字段`);
  }
}

/**
 * 清理文本字段。
 * 纯函数: null/undefined 返回空字符串，其余输入转换后去除首尾空白。
 *
 * @param {*} value 文本候选值。
 * @returns {string} 稳定文本。
 */
function normalizeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * 校验非负媒体秒数。
 * 纯函数: 不修改输入。
 * 失败路径: 非有限数、负数或不允许的 null 抛 MediaPlaybackValidationError。
 *
 * @param {*} value 秒数候选值。
 * @param {boolean} nullable true 允许 null，false 必须返回 number。
 * @param {string} label 字段标签。
 * @returns {number|null} 有效秒数或 null。
 */
function normalizeNonNegativeNumber(value, nullable, label) {
  // 条件分支: 当前字段允许空值且候选为空时进入；执行内容: 保留 null 语义，不把未知值伪造成 0。
  if (nullable && (value === null || value === undefined)) {
    return null;
  }
  // 类型: number；作用: 统一转换第三方媒体数值，后续同时验证有限性和非负边界。
  const numberValue = Number(value);
  // 条件分支: 转换结果非有限数或小于 0 时进入；执行内容: 阻止非法秒数进入稳定媒体会话。
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new MediaPlaybackValidationError(MEDIA_PLAYBACK_ERROR_CODE.invalidSource, `${label} 必须是非负有限数`);
  }
  return numberValue;
}

/**
 * 校验媒体 URL 是否为浏览器可请求的 HTTP/HTTPS 地址。
 * 纯函数: 只解析 URL，不发起网络请求。
 * 失败路径: 非法 URL、非 HTTP(S) 协议或包含用户凭据时返回 false。
 *
 * @param {*} value URL 候选值。
 * @returns {boolean} 满足直连 URL 基础边界时为 true。
 */
function isHttpMediaUrl(value) {
  try {
    // 类型: URL；作用: 使用浏览器标准解析器检查协议和嵌入凭据，不通过字符串猜测媒体地址。
    const url = new URL(normalizeText(value));
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * 标准化 ContentItem 已解析直连媒体。
 * 纯函数: 返回冻结新对象，不修改 Provider 响应。
 * 成功路径: media 必须精确包含 type/url/quality/deliveryMode，并满足 direct + mp4/hls + HTTP(S) URL。
 * 失败路径: 字段、类型、URL 或交付方式非法时抛稳定校验错误。
 *
 * @param {object} media ContentItem.playback.media。
 * @returns {object} 隔离冻结的标准直连媒体。
 * @throws {MediaPlaybackValidationError} 媒体不满足直连契约时抛出。
 */
export function normalizeMediaPlaybackMedia(media) {
  assertContractFields(media, MEDIA_FIELDS, MEDIA_FIELDS, 'playbackMedia');
  // 类型: object；作用: 创建与 Provider 输入隔离的媒体候选，统一四个文本字段后验证直连组合。
  const normalized = {
    type: normalizeText(media.type),
    url: normalizeText(media.url),
    quality: normalizeText(media.quality),
    deliveryMode: normalizeText(media.deliveryMode)
  };

  // 条件分支: 媒体交付方式不是浏览器直连时进入；执行内容: 拒绝媒体代理和未知传输路径。
  if (normalized.deliveryMode !== MEDIA_DELIVERY_MODE.direct) {
    throw new MediaPlaybackValidationError(MEDIA_PLAYBACK_ERROR_CODE.unsupportedMedia, '当前媒体不支持浏览器直连播放');
  }
  // 条件分支: 类型不是 MP4/HLS 或 URL 不满足 HTTP(S) 直连边界时进入；执行内容: 明确失败，不猜测格式或回退代理。
  if (![MEDIA_TYPE.mp4, MEDIA_TYPE.hls].includes(normalized.type) || !isHttpMediaUrl(normalized.url)) {
    throw new MediaPlaybackValidationError(MEDIA_PLAYBACK_ERROR_CODE.unsupportedMedia, '当前媒体不是受支持的 MP4 或 HLS 直连资源');
  }
  return Object.freeze(normalized);
}

/**
 * 标准化播放器适配层发布的媒体会话。
 * 纯函数: 返回冻结新对象，不保留第三方实例或 Error 引用。
 * 成功路径: 阶段、身份、秒数和错误组合满足契约后返回标准状态。
 * 失败路径: 未知阶段、非法秒数、错误组合或额外字段时抛稳定校验错误。
 *
 * @param {object} session 媒体会话候选。
 * @returns {object} 隔离冻结的 MediaPlaybackSessionState。
 * @throws {MediaPlaybackValidationError} 会话不满足契约时抛出。
 */
export function normalizeMediaPlaybackSession(session) {
  assertContractFields(session, MEDIA_SESSION_FIELDS, MEDIA_SESSION_FIELDS, 'mediaSession');
  // 类型: object；作用: 隔离第三方事件并统一身份、秒数与错误文本，形成待验证的稳定会话。
  const normalized = {
    phase: normalizeText(session.phase),
    sourceId: normalizeText(session.sourceId),
    contentId: normalizeText(session.contentId),
    episodeId: normalizeText(session.episodeId),
    episodeIndex: session.episodeIndex === null ? null : normalizeNonNegativeNumber(session.episodeIndex, true, 'episodeIndex'),
    playbackSourceId: normalizeText(session.playbackSourceId),
    playedSeconds: normalizeNonNegativeNumber(session.playedSeconds, false, 'playedSeconds'),
    durationSeconds: normalizeNonNegativeNumber(session.durationSeconds, true, 'durationSeconds'),
    bufferedSeconds: normalizeNonNegativeNumber(session.bufferedSeconds, true, 'bufferedSeconds'),
    errorCode: normalizeText(session.errorCode),
    errorMessage: normalizeText(session.errorMessage)
  };

  // 条件分支: 会话阶段不属于项目枚举时进入；执行内容: 阻止页面依赖第三方或拼写错误状态。
  if (!Object.values(MEDIA_PLAYBACK_PHASE).includes(normalized.phase)) {
    throw new MediaPlaybackValidationError(MEDIA_PLAYBACK_ERROR_CODE.invalidSource, '媒体会话阶段无效');
  }
  // 条件分支: 非 idle 会话缺少数据源、内容或线路身份时进入；执行内容: 阻止无法归属的真实事件进入页面和后续历史提交链。
  if (normalized.phase !== MEDIA_PLAYBACK_PHASE.idle
    && (!normalized.sourceId || !normalized.contentId || !normalized.playbackSourceId)) {
    throw new MediaPlaybackValidationError(MEDIA_PLAYBACK_ERROR_CODE.invalidSource, '活动媒体会话缺少播放身份');
  }
  // 类型: boolean；作用: 标记当前阶段是否必须同时携带稳定错误码和安全说明。
  const isFailurePhase = [MEDIA_PLAYBACK_PHASE.unsupported, MEDIA_PLAYBACK_PHASE.error].includes(normalized.phase);
  // 条件分支: 失败阶段与错误字段是否存在不一致时进入；执行内容: 拒绝无错误信息的失败或普通阶段夹带错误。
  if (isFailurePhase !== Boolean(normalized.errorCode && normalized.errorMessage)) {
    throw new MediaPlaybackValidationError(MEDIA_PLAYBACK_ERROR_CODE.invalidSource, '媒体会话错误字段与阶段不一致');
  }
  return Object.freeze(normalized);
}
