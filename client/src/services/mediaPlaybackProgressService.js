/*
  mediaPlaybackProgressService.js 模块说明

  - 文件职责:
      把 XgplayerMediaPlayer 发布的稳定媒体会话转换为 currentPlaying 和播放历史写入意图。
      本服务只协调当前媒体身份、检查点、阶段映射、最终提交和去重；真正状态写入仍委托 userContentService。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      mediaPlayback.config exports: 自定义配置，提供媒体阶段、用户播放状态和集中检查点。
      normalizeMediaPlaybackSession: 自定义校验器，确保协调器只消费稳定媒体会话。

  - 模块级常量:
      SERVICE_OPTION_FIELDS: Array<string>，服务工厂允许选项集合。
      PLAYBACK_CONTEXT_FIELDS: Array<string>，页面播放上下文精确字段集合。
      ACTIVE_PROGRESS_PHASES: Array<string>，映射为 playing 的媒体阶段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createSystemNowIso(): 返回当前 ISO 时间。
      normalizeText(value): 标准化文本。
      normalizeEpisodeIndex(value): 标准化分集序号。
      normalizePlaybackContext(context): 校验页面提供的用户内容身份。
      createSessionIdentity(value): 生成媒体会话身份。
      combinePersistenceOperations(operations): 合并本次同步触发的历史事务 Promise。

  - 模块级类:
      MediaPlaybackProgressError: 播放上下文或依赖无效时抛出的稳定协调错误。
      MediaPlaybackProgressService: 当前页面媒体进度协调器，拥有单一活动会话和检查点状态。

  - 对外导出:
      MediaPlaybackProgressError: Class，供页面和测试识别协调边界失败。
      createMediaPlaybackProgressService: Function，为每个 PlayerView 创建独立进度协调器。
*/

import {
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: MEDIA_PLAYBACK_PHASE；文件作用: 分派稳定媒体阶段。
  MEDIA_PLAYBACK_PHASE,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: MEDIA_PLAY_STATUS；文件作用: 构造 currentPlaying 和历史状态。
  MEDIA_PLAY_STATUS,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: PLAYBACK_PROGRESS_CHECKPOINT_SECONDS；文件作用: 限制长期历史写入频率。
  PLAYBACK_PROGRESS_CHECKPOINT_SECONDS
} from '../config/mediaPlayback.config.js';

// 导入来源: ../utils/mediaPlaybackValidators.js；导入内容: normalizeMediaPlaybackSession；文件作用: 在协调和最终提交前再次采用稳定事件边界。
import { normalizeMediaPlaybackSession } from '../utils/mediaPlaybackValidators.js';

// 类型: Array<string>。
// 作用: 服务只接收用户内容写端口和可替换时钟，拒绝 Repository、store 或备用保存实现直接注入。
const SERVICE_OPTION_FIELDS = Object.freeze(['now', 'updateCurrentPlaying', 'upsertPlayHistory']);

// 类型: Array<string>。
// 作用: 页面上下文只允许用户历史所需身份、标准 ContentItem 和当前 Episode，不接收 Router、媒体 URL或播放器实例。
const PLAYBACK_CONTEXT_FIELDS = Object.freeze([
  'sourceId',
  'contentId',
  'type',
  'episodeId',
  'episodeIndex',
  'playbackSourceId',
  'contentItem',
  'episode'
]);

// 类型: Array<string>。
// 作用: playing 与 buffering 都表示实际播放会话仍在进行，并映射为用户内容 playing 状态。
const ACTIVE_PROGRESS_PHASES = Object.freeze([
  MEDIA_PLAYBACK_PHASE.playing,
  MEDIA_PLAYBACK_PHASE.buffering
]);

/**
 * 播放进度协调错误。
 * 调用方: PlayerView 和媒体领域测试。
 * 状态: 只保存安全 message，不保存媒体 URL、第三方实例或 Repository 引用。
 */
export class MediaPlaybackProgressError extends Error {
  /**
   * 创建协调错误。
   * 副作用: 只创建 Error 实例，不修改播放器或用户内容状态。
   *
   * @param {string} message 安全错误说明。
   */
  constructor(message) {
    super(message);
    this.name = 'MediaPlaybackProgressError';
  }
}

/**
 * 生成系统当前 ISO 时间。
 * 纯函数: 除读取系统时钟外不修改状态。
 *
 * @returns {string} 当前 ISO 时间。
 */
function createSystemNowIso() {
  return new Date().toISOString();
}

/**
 * 标准化文本。
 * 纯函数: null/undefined 返回空字符串，其余值转换并清理首尾空白。
 *
 * @param {*} value 文本候选。
 * @returns {string} 稳定文本。
 */
function normalizeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * 标准化分集序号。
 * 纯函数: 空值返回 null，正整数原样返回。
 * 失败路径: 非正整数抛 MediaPlaybackProgressError。
 *
 * @param {*} value 分集序号候选。
 * @returns {number|null} 正整数分集序号或 null。
 * @throws {MediaPlaybackProgressError} 候选不满足边界时抛出。
 */
function normalizeEpisodeIndex(value) {
  // 条件分支: 电影或未知分集没有序号时进入；执行内容: 保留 null 语义。
  if (value === null || value === undefined || value === '') {
    return null;
  }
  // 类型: number；作用: 统一路由和分集对象传入的序号候选。
  const episodeIndex = Number(value);
  // 条件分支: 序号不是正整数时进入；执行内容: 阻止不稳定 historyKey 进入用户内容写链。
  if (!Number.isInteger(episodeIndex) || episodeIndex <= 0) {
    throw new MediaPlaybackProgressError('播放进度上下文的分集序号无效');
  }
  return episodeIndex;
}

/**
 * 校验并隔离页面播放上下文。
 * 纯函数: 返回冻结新对象，不保留 PlayerView 响应式引用。
 * 失败路径: 字段、内容身份、类型或线路身份无效时抛 MediaPlaybackProgressError。
 *
 * @param {*} context 页面从 ContentItem 与路由派生的播放上下文。
 * @returns {Readonly<object>} 用户内容写入所需稳定身份。
 * @throws {MediaPlaybackProgressError} 上下文不满足精确边界时抛出。
 */
function normalizePlaybackContext(context) {
  // 条件分支: 上下文不是普通对象时进入；执行内容: 在读取字段前失败关闭。
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw new MediaPlaybackProgressError('播放进度上下文必须是对象');
  }
  // 类型: Array<string>；作用: 保存调用方真实字段，供精确契约比较。
  const fields = Object.keys(context).sort();
  // 类型: Array<string>；作用: 创建允许字段排序副本，不修改冻结常量。
  const expectedFields = [...PLAYBACK_CONTEXT_FIELDS].sort();
  // 条件分支: 字段数量或名称与精确上下文不一致时进入；执行内容: 拒绝 Router、URL 和展示字段渗入保存层。
  if (fields.length !== expectedFields.length || fields.some((field, index) => field !== expectedFields[index])) {
    throw new MediaPlaybackProgressError('播放进度上下文字段不符合契约');
  }
  // 类型: object；作用: 隔离标准 ContentItem；历史写入使用它生成卡片快照，不把页面响应式引用交给 FIFO。
  const contentItem = context.contentItem && typeof context.contentItem === 'object' && !Array.isArray(context.contentItem)
    ? JSON.parse(JSON.stringify(context.contentItem))
    : null;
  // 类型: object|null；作用: 隔离当前标准 Episode；历史写入使用它生成跨源定位器。
  const episode = context.episode && typeof context.episode === 'object' && !Array.isArray(context.episode)
    ? JSON.parse(JSON.stringify(context.episode))
    : null;
  // 类型: object；作用: 创建引用隔离的标准上下文，供会话身份和用户内容载荷共用。
  const normalized = {
    sourceId: normalizeText(context.sourceId),
    contentId: normalizeText(context.contentId),
    type: normalizeText(context.type),
    episodeId: normalizeText(context.episodeId),
    episodeIndex: normalizeEpisodeIndex(context.episodeIndex),
    playbackSourceId: normalizeText(context.playbackSourceId),
    contentItem,
    episode
  };
  // 条件分支: 身份、线路或标准 ContentItem 缺失时进入；执行内容: 阻止无法离线展示的新历史写入。
  if (!normalized.sourceId || !normalized.contentId || !normalized.type || !normalized.playbackSourceId
    || !normalized.contentItem) {
    throw new MediaPlaybackProgressError('播放进度上下文缺少必要身份');
  }
  return Object.freeze(normalized);
}

/**
 * 生成媒体会话身份。
 * 纯函数: 只读取标准身份字段并返回确定性 JSON 文本。
 *
 * @param {object} value MediaPlaybackSessionState 或标准播放上下文。
 * @returns {string} 数据源、内容、分集和线路联合身份。
 */
function createSessionIdentity(value) {
  return JSON.stringify([
    value.sourceId,
    value.contentId,
    value.episodeId,
    value.episodeIndex,
    value.playbackSourceId
  ]);
}

/**
 * 合并同一同步事件触发的历史事务。
 * 纯函数: 不创建重试或串行队列；userContentService 继续拥有唯一长期写 FIFO。
 *
 * @param {Array<Promise|null>} operations 旧会话最终提交和当前会话提交结果。
 * @returns {Promise<Array<*>>|null} 存在事务时返回联合 Promise，否则返回 null。
 */
function combinePersistenceOperations(operations) {
  // 类型: Array<Promise>；作用: 排除只更新内存态或没有实际播放的空操作。
  const activeOperations = operations.filter(Boolean);
  // 条件分支: 本次事件没有触发历史事务时进入；执行内容: 返回 null，让页面不建立无意义异步跟踪。
  if (activeOperations.length === 0) {
    return null;
  }
  return Promise.all(activeOperations);
}

/**
 * 当前页面媒体进度协调器。
 * 使用场景: 每个 PlayerView 实例创建一个服务，消费适配组件的稳定事件。
 * 状态所有权: 只持有当前媒体身份、隔离上下文、最新会话和上次已尝试提交签名。
 * 并发边界: 不拥有长期写队列；每次调用立即把事务交给 userContentService 的唯一 FIFO。
 * 失败边界: 历史 Promise reject 原样交给页面；已尝试签名不回滚，因此不会形成补写循环。
 * 资源边界: finalize 后清空全部会话引用，不保留 ContentItem、Router、播放器或 Repository。
 */
class MediaPlaybackProgressService {
  // 类型: Function；生命周期: 当前服务实例；作用: 为 currentPlaying 和历史候选提供可测试 ISO 时间。
  #now;
  // 类型: Function；生命周期: 当前服务实例；作用: 指向 userContentService 唯一 currentPlaying 写端口。
  #updateCurrentPlaying;
  // 类型: Function；生命周期: 当前服务实例；作用: 指向 userContentService 唯一历史异步写端口。
  #upsertPlayHistory;
  // 类型: string；生命周期: 当前活动媒体会话；作用: 隔离分集和线路，空字符串表示没有活动会话。
  #sessionIdentity;
  // 类型: Readonly<object>|null；生命周期: 当前活动媒体会话；作用: 保存用户内容写入所需隔离身份。
  #context;
  // 类型: Readonly<object>|null；生命周期: 当前活动媒体会话；作用: 保存最终提交可使用的最新稳定媒体指标。
  #latestSession;
  // 类型: boolean；生命周期: 当前活动媒体会话；作用: true 允许创建或最终提交历史，false 表示尚未实际播放。
  #hasStarted;
  // 类型: number|null；生命周期: 当前活动媒体会话；作用: 保存上次已尝试历史事务的真实秒数。
  #lastAttemptedSeconds;
  // 类型: string；生命周期: 当前活动媒体会话；作用: 保存上次已尝试的 MEDIA_PLAY_STATUS。
  #lastAttemptedStatus;
  // 类型: number|null；生命周期: 当前活动媒体会话；作用: 参与同秒数时长变化的提交去重。
  #lastAttemptedDuration;
  // 类型: string；生命周期: 当前活动媒体会话；作用: 避免相同 currentPlaying 摘要重复触发 Vue 响应式替换。
  #lastCurrentSignature;

  /**
   * 创建页面级进度协调器。
   * 副作用: 捕获 userContentService 窄端口和时钟；不读取或写入用户状态。
   * 失败路径: 选项字段或写端口无效时抛 MediaPlaybackProgressError。
   *
   * @param {object} options 服务依赖。
   * @param {Function} options.updateCurrentPlaying currentPlaying 唯一写端口。
   * @param {Function} options.upsertPlayHistory 播放历史唯一异步写端口。
   * @param {Function} [options.now] 可测试 ISO 时钟。
   */
  constructor(options) {
    // 条件分支: 选项不是普通对象时进入；执行内容: 在捕获依赖前失败关闭。
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new MediaPlaybackProgressError('播放进度服务选项必须是对象');
    }
    // 类型: Array<string>；作用: 保存调用方选项字段，拒绝 Repository 或备用保存端口注入。
    const optionFields = Object.keys(options);
    // 条件分支: 出现服务未定义选项时进入；执行内容: 保持依赖边界精确。
    if (optionFields.some(field => !SERVICE_OPTION_FIELDS.includes(field))) {
      throw new MediaPlaybackProgressError('播放进度服务包含未知选项');
    }
    // 条件分支: 两个用户内容写端口不是函数时进入；执行内容: 阻止创建不能收敛状态的协调器。
    if (typeof options.updateCurrentPlaying !== 'function' || typeof options.upsertPlayHistory !== 'function') {
      throw new MediaPlaybackProgressError('播放进度服务缺少用户内容写端口');
    }
    // 条件分支: 调用方提供 now 但不是函数时进入；执行内容: 拒绝不稳定时间来源。
    if (options.now !== undefined && typeof options.now !== 'function') {
      throw new MediaPlaybackProgressError('播放进度服务时钟无效');
    }
    this.#now = options.now || createSystemNowIso;
    this.#updateCurrentPlaying = options.updateCurrentPlaying;
    this.#upsertPlayHistory = options.upsertPlayHistory;
    this.#resetSessionState();
  }

  /**
   * 消费一条稳定媒体会话。
   * 副作用: 实际播放阶段可以更新 currentPlaying，并在首播、检查点、暂停或结束时调用历史写端口。
   * 成功路径: 返回本次触发的历史事务 Promise；只更新内存态或无动作时返回 null。
   * 失败路径: 会话或上下文非法时同步抛错；历史保存失败通过返回 Promise reject 交给页面。
   *
   * @param {object} session XgplayerMediaPlayer 发布的 MediaPlaybackSessionState。
   * @param {object} context PlayerView 从当前 ContentItem 和路由派生的播放上下文。
   * @returns {Promise<Array<*>>|null} 本次历史事务联合结果或 null。
   */
  handleSession(session, context) {
    // 类型: object；作用: 再次采用稳定媒体契约，防止页面或测试绕过适配层注入半完整事件。
    const normalizedSession = normalizeMediaPlaybackSession(session);
    // 类型: Readonly<object>；作用: 隔离当前用户内容身份，不保留页面响应式对象。
    const normalizedContext = normalizePlaybackContext(context);
    // 类型: string；作用: 核对媒体事件和页面上下文是否属于同一分集与线路。
    const sessionIdentity = createSessionIdentity(normalizedSession);
    // 条件分支: 事件身份与页面上下文不一致时进入；执行内容: 拒绝旧组件或错误线路事件写入用户状态。
    if (sessionIdentity !== createSessionIdentity(normalizedContext)) {
      throw new MediaPlaybackProgressError('媒体会话与播放进度上下文不一致');
    }

    // 条件分支: 协调器仍持有另一媒体身份时进入；执行内容: 拒绝迟到旧事件或未经过 finalize 的隐式切换。
    if (this.#sessionIdentity && this.#sessionIdentity !== sessionIdentity) {
      throw new MediaPlaybackProgressError('活动媒体会话尚未终结，拒绝采用其它播放身份');
    }
    // 条件分支: 当前没有活动身份时进入；执行内容: 采用本次隔离上下文并初始化检查点状态。
    if (!this.#sessionIdentity) {
      this.#sessionIdentity = sessionIdentity;
      this.#context = normalizedContext;
    }

    this.#latestSession = normalizedSession;
    // 类型: Promise|null；作用: 保存当前阶段可能触发的历史事务，不自行等待或重试。
    let currentOperation = null;
    // 条件分支: 媒体正在播放或缓冲时进入；执行内容: 标记实际开始并按检查点提交 playing 状态。
    if (ACTIVE_PROGRESS_PHASES.includes(normalizedSession.phase)) {
      this.#hasStarted = true;
      currentOperation = this.#commitProgress(normalizedSession, MEDIA_PLAY_STATUS.playing, false, false);
    }
    // 条件分支: 媒体暂停且本轮已经实际播放时进入；执行内容: 强制提交 paused 最终进度并保留当前会话投影。
    if (normalizedSession.phase === MEDIA_PLAYBACK_PHASE.paused && this.#hasStarted) {
      currentOperation = this.#commitProgress(normalizedSession, MEDIA_PLAY_STATUS.paused, true, false);
    }
    // 条件分支: 媒体结束时进入；执行内容: 强制提交 finished 并清空当前播放投影，为同一内容重播保留协调身份。
    if (normalizedSession.phase === MEDIA_PLAYBACK_PHASE.ended) {
      this.#hasStarted = true;
      currentOperation = this.#commitProgress(normalizedSession, MEDIA_PLAY_STATUS.finished, true, true);
      this.#hasStarted = false;
    }
    // 条件分支: 已开始会话发生媒体失败时进入；执行内容: 以 paused 保存最后秒数并结束当前播放会话。
    if ([MEDIA_PLAYBACK_PHASE.error, MEDIA_PLAYBACK_PHASE.unsupported].includes(normalizedSession.phase)
      && this.#hasStarted) {
      currentOperation = this.#commitProgress(normalizedSession, MEDIA_PLAY_STATUS.paused, true, true);
      this.#resetSessionState();
    }

    return combinePersistenceOperations([currentOperation]);
  }

  /**
   * 最终提交并释放当前媒体会话。
   * 副作用: 可采用同身份最终快照，以 paused 写入最后进度，清空 currentPlaying 并释放协调器引用。
   * 成功路径: 已播放会话返回历史事务 Promise；没有活动或未开始播放时只清理并返回 null。
   * 失败路径: 最终快照非法时同步抛错；历史事务失败通过 Promise reject 交给页面。
   *
   * @param {object|null} [finalSession] 适配组件销毁前发布的最后稳定快照。
   * @returns {Promise<Array<*>>|null} 最终历史事务联合结果或 null。
   */
  finalize(finalSession = null) {
    // 条件分支: 协调器没有活动媒体身份时进入；执行内容: 幂等返回，不清理其它页面会话。
    if (!this.#sessionIdentity) {
      return null;
    }
    // 条件分支: 调用方提供适配组件最终快照时进入；执行内容: 只在同身份时采用更接近销毁时刻的媒体指标。
    if (finalSession) {
      // 类型: object；作用: 严格采用最终快照，拒绝第三方实例或额外字段。
      const normalizedFinalSession = normalizeMediaPlaybackSession(finalSession);
      // 条件分支: 最终快照身份仍属于当前协调会话时进入；执行内容: 覆盖最新秒数和时长供最终提交。
      if (createSessionIdentity(normalizedFinalSession) === this.#sessionIdentity) {
        this.#latestSession = normalizedFinalSession;
      }
    }

    // 类型: Promise|null；作用: 保存最终历史事务；未实际播放时不创建历史。
    const operation = this.#hasStarted && this.#latestSession
      ? this.#commitProgress(this.#latestSession, MEDIA_PLAY_STATUS.paused, true, true)
      : null;
    // 条件分支: 当前会话未实际播放时进入；执行内容: 仍清空本页面可能保留的 currentPlaying 投影。
    if (!this.#hasStarted) {
      this.#updateCurrentPlaying(null);
    }
    this.#resetSessionState();
    return combinePersistenceOperations([operation]);
  }

  /**
   * 按检查点或最终事件提交用户内容状态。
   * 副作用: 需要时更新 currentPlaying，并调用 userContentService 历史写端口。
   * 成功路径: 返回历史事务 Promise；同签名或未达到检查点时返回 null。
   * 失败路径: 写端口同步错误直接抛出，异步 Repository 错误由 Promise reject 表达；不回滚已尝试签名。
   *
   * @param {object} session 当前稳定媒体会话。
   * @param {string} playStatus MEDIA_PLAY_STATUS 状态。
   * @param {boolean} force true 跳过检查点但仍去重同签名，false 仅在首播、状态变化或达到检查点时提交。
   * @param {boolean} clearCurrentPlaying true 清空当前投影，false 采用当前播放摘要。
   * @returns {Promise<*>|null} 历史写事务或 null。
   */
  #commitProgress(session, playStatus, force, clearCurrentPlaying) {
    // 类型: number；作用: 使用真实非负媒体秒数作为检查点和历史进度。
    const playedSeconds = session.playedSeconds;
    // 类型: string；作用: 精确标记当前身份、状态和秒数，所有强制事件仍避免重复写同一快照。
    const attemptSignature = JSON.stringify([this.#sessionIdentity, playStatus, playedSeconds, session.durationSeconds]);
    // 类型: boolean；作用: 标记状态或媒体身份是否变化，首播和 finished 后重播必须立即写入。
    const statusChanged = this.#lastAttemptedStatus !== playStatus;
    // 类型: boolean；作用: 前进和后退拖动都按相对上次已尝试点的绝对变化触发检查点。
    const checkpointReached = this.#lastAttemptedSeconds === null
      || Math.abs(playedSeconds - this.#lastAttemptedSeconds) >= PLAYBACK_PROGRESS_CHECKPOINT_SECONDS;
    // 类型: boolean；作用: 同一最终事件重复到达时阻止第二次历史事务。
    const isDuplicateAttempt = attemptSignature === this.#createLastAttemptSignature();
    // 类型: boolean；作用: 汇总首次、状态变化、检查点和最终事件，决定是否调用长期写端口。
    const shouldPersistHistory = !isDuplicateAttempt && (force || statusChanged || checkpointReached);

    // 条件分支: 生命周期要求结束当前播放投影时进入；执行内容: 立即清空会话态，不等待 IndexedDB。
    if (clearCurrentPlaying) {
      this.#updateCurrentPlaying(null);
      this.#lastCurrentSignature = '';
    }

    // 条件分支: 同签名重复事件或未达到检查点时进入；执行内容: 不调用 IndexedDB 历史写端口。
    if (!shouldPersistHistory) {
      return null;
    }
    // 类型: string；作用: currentPlaying 和历史共用同一事件时间，保证页面投影与持久记录可比较。
    const timestamp = this.#now();
    // 条件分支: 当前播放会话仍在进行时进入；执行内容: 与历史候选使用同一时间更新全站卡片摘要。
    if (!clearCurrentPlaying) {
      this.#updateCurrentProjection(session, playStatus, timestamp);
    }
    this.#lastAttemptedSeconds = playedSeconds;
    this.#lastAttemptedStatus = playStatus;
    this.#lastAttemptedDuration = session.durationSeconds;
    return this.#upsertPlayHistory({
      sourceId: this.#context.sourceId,
      contentId: this.#context.contentId,
      type: this.#context.type,
      episodeId: this.#context.episodeId,
      episodeIndex: this.#context.episodeIndex,
      playbackSourceId: this.#context.playbackSourceId,
      contentItem: this.#context.contentItem,
      episode: this.#context.episode,
      playedSeconds,
      durationSeconds: session.durationSeconds,
      playStatus,
      lastPlayedAt: timestamp
    });
  }

  /**
   * 更新 currentPlaying 会话投影。
   * 副作用: 通过唯一 userContentService 端口替换内存态 currentPlaying；不访问 Repository。
   * 成功路径: 同一状态和指标签名只写一次，减少高频媒体事件引起的响应式更新。
   *
   * @param {object} session 当前稳定媒体会话。
   * @param {string} playStatus playing 或 paused。
   * @param {string} timestamp 本次历史和 currentPlaying 共用的 ISO 时间。
   * @returns {void} 写入结果由全站 selector 响应式消费。
   */
  #updateCurrentProjection(session, playStatus, timestamp) {
    // 类型: string；作用: 当前会话摘要去重签名，避免同一检查点重复触发 Vue 响应式替换。
    const currentSignature = JSON.stringify([
      this.#sessionIdentity,
      playStatus,
      session.playedSeconds,
      session.durationSeconds
    ]);
    // 条件分支: 当前摘要与已发布投影完全一致时进入；执行内容: 保留现有响应式对象并结束。
    if (currentSignature === this.#lastCurrentSignature) {
      return;
    }
    this.#lastCurrentSignature = currentSignature;
    this.#updateCurrentPlaying({
      sourceId: this.#context.sourceId,
      contentId: this.#context.contentId,
      type: this.#context.type,
      episodeId: this.#context.episodeId,
      episodeIndex: this.#context.episodeIndex,
      playbackSourceId: this.#context.playbackSourceId,
      playStatus,
      playedSeconds: session.playedSeconds,
      durationSeconds: session.durationSeconds,
      updatedAt: timestamp
    });
  }

  /**
   * 重建上次已尝试提交签名。
   * 纯函数: 只读取协调器当前状态；尚未尝试提交时返回空字符串。
   *
   * @returns {string} 身份、状态、秒数和时长联合签名或空字符串。
   */
  #createLastAttemptSignature() {
    // 条件分支: 当前会话尚未尝试历史提交时进入；执行内容: 返回空签名，允许首个 playing 建立记录。
    if (this.#lastAttemptedSeconds === null || !this.#lastAttemptedStatus || !this.#latestSession) {
      return '';
    }
    return JSON.stringify([
      this.#sessionIdentity,
      this.#lastAttemptedStatus,
      this.#lastAttemptedSeconds,
      this.#lastAttemptedDuration
    ]);
  }

  /**
   * 清空协调器当前会话状态。
   * 副作用: 释放隔离上下文和最新媒体快照，重置检查点；不修改 userContentStore。
   *
   * @returns {void} 下一条媒体事件将建立新活动身份。
   */
  #resetSessionState() {
    this.#sessionIdentity = '';
    this.#context = null;
    this.#latestSession = null;
    this.#hasStarted = false;
    this.#lastAttemptedSeconds = null;
    this.#lastAttemptedStatus = '';
    this.#lastAttemptedDuration = null;
    this.#lastCurrentSignature = '';
  }
}

/**
 * 创建 PlayerView 独享的媒体进度协调器。
 * 纯函数: 返回新实例，不共享会话状态或检查点。
 * 失败路径: 依赖无效时由构造器抛 MediaPlaybackProgressError。
 *
 * @param {object} options userContentService 写端口和可选时钟。
 * @returns {MediaPlaybackProgressService} 页面级协调器。
 * @throws {MediaPlaybackProgressError} 选项不满足边界时抛出。
 */
export function createMediaPlaybackProgressService(options) {
  return new MediaPlaybackProgressService(options);
}
