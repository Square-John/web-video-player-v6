/*
  mediaProgressPromptService.js 模块说明

  - 文件职责:
      从稳定媒体阶段和秒数派生唯一 MediaProgressPrompt。
      本模块只执行时间格式化、优先级和锚点计算，不读取播放器实例、Router、目录、Store 或 Repository。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      mediaPlayback.config exports: 自定义配置，提供媒体阶段、提示种类、动作和集中数值策略。

  - 模块级常量:
      TERMINAL_ERROR_PHASES: ReadonlyArray<string>，允许生成终态提示的媒体阶段。
      RESUME_PROMPT_PHASES: ReadonlyArray<string>，允许展示恢复位置的播放前阶段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeSeconds(value): 标准化非负媒体秒数。
      clamp(value, minimum, maximum): 把数值夹取到闭区间。
      resolvePromptPositionPercent(playedSeconds, durationSeconds): 计算安全锚点。
      createPrompt(kind, message, actions, positionPercent, isTerminal): 创建冻结提示。

  - 模块级类:
      无

  - 对外导出:
      formatMediaProgressTime: Function，把秒数格式化为 MM:SS 或 HH:MM:SS。
      createMediaProgressPrompt: Function，按冻结优先级创建进度提示或 null。
*/

import {
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: MEDIA_PLAYBACK_PHASE；文件作用: 判断稳定媒体生命周期阶段。
  MEDIA_PLAYBACK_PHASE,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: MEDIA_PROGRESS_PROMPT_ACTION；文件作用: 生成受限动作身份。
  MEDIA_PROGRESS_PROMPT_ACTION,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: MEDIA_PROGRESS_PROMPT_KIND；文件作用: 生成受限提示种类。
  MEDIA_PROGRESS_PROMPT_KIND,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: MEDIA_PROGRESS_PROMPT_POLICY；文件作用: 计算近尾和锚点边界。
  MEDIA_PROGRESS_PROMPT_POLICY
} from '../config/mediaPlayback.config.js';

// 类型: ReadonlyArray<string>；作用: 只有稳定不可播放终态可以创建带重试动作的错误提示。
const TERMINAL_ERROR_PHASES = Object.freeze([
  MEDIA_PLAYBACK_PHASE.unsupported,
  MEDIA_PLAYBACK_PHASE.error
]);

// 类型: ReadonlyArray<string>；作用: 恢复位置只在真正开始播放前展示，playing 后由事件驱动自然关闭。
const RESUME_PROMPT_PHASES = Object.freeze([
  MEDIA_PLAYBACK_PHASE.ready,
  MEDIA_PLAYBACK_PHASE.autoplayBlocked
]);

/**
 * 把任意秒数标准化为非负有限数。
 * 纯函数: 不修改输入；非法值返回 null 保留未知语义。
 *
 * @param {*} value 秒数候选。
 * @returns {number|null} 非负有限秒数或 null。
 */
function normalizeSeconds(value) {
  // 类型: number；作用: 把字符串数值等候选统一转换为可验证媒体秒数。
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * 把数值夹取到闭区间。
 * 纯函数: 只比较输入数值。
 *
 * @param {number} value 原始值。
 * @param {number} minimum 最小值。
 * @param {number} maximum 最大值。
 * @returns {number} 夹取结果。
 */
function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * 格式化媒体时间。
 * 纯函数: 小于一小时返回 MM:SS，一小时及以上返回 HH:MM:SS。
 *
 * @param {*} value 秒数候选。
 * @returns {string} 稳定时间文本；非法输入返回 00:00。
 */
export function formatMediaProgressTime(value) {
  // 类型: number；作用: 使用向下取整后的非负总秒数生成稳定显示文本。
  const totalSeconds = Math.floor(normalizeSeconds(value) || 0);
  // 类型: number；作用: 保存当前分钟内的秒数部分。
  const seconds = totalSeconds % 60;
  // 类型: number；作用: 保存完整分钟总数，供小时和分钟部分共用。
  const totalMinutes = Math.floor(totalSeconds / 60);
  // 类型: number；作用: 保存当前小时内的分钟部分。
  const minutes = totalMinutes % 60;
  // 类型: number；作用: 保存完整小时数。
  const hours = Math.floor(totalMinutes / 60);
  // 类型: string；作用: 把秒数固定为两位显示。
  const paddedSeconds = String(seconds).padStart(2, '0');
  // 类型: string；作用: 把分钟部分固定为两位显示。
  const paddedMinutes = String(minutes).padStart(2, '0');
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
}

/**
 * 计算提示锚点百分比。
 * 纯函数: 优先使用当前播放秒数，没有有效时长时使用集中默认位置。
 *
 * @param {number|null} playedSeconds 当前播放秒数。
 * @param {number|null} durationSeconds 总时长。
 * @returns {number} 已按安全边界夹取的百分比。
 */
function resolvePromptPositionPercent(playedSeconds, durationSeconds) {
  // 条件分支: 总时长或当前秒数不能形成有效比例时进入；执行内容: 使用集中默认锚点。
  if (durationSeconds === null || durationSeconds <= 0 || playedSeconds === null) {
    return MEDIA_PROGRESS_PROMPT_POLICY.defaultAnchorPercent;
  }
  // 类型: number；作用: 把当前媒体进度转换为未经边界处理的百分比。
  const rawPercent = (playedSeconds / durationSeconds) * 100;
  return clamp(
    rawPercent,
    MEDIA_PROGRESS_PROMPT_POLICY.minimumAnchorPercent,
    MEDIA_PROGRESS_PROMPT_POLICY.maximumAnchorPercent
  );
}

/**
 * 创建冻结进度提示。
 * 纯函数: 只组合已经标准化的种类、文案、动作和位置。
 *
 * @param {string} kind MEDIA_PROGRESS_PROMPT_KIND。
 * @param {string} message 用户文案。
 * @param {Array<object>} actions 项目动作数组。
 * @param {number} positionPercent 锚点百分比。
 * @param {boolean} isTerminal 是否为终态错误。
 * @returns {Readonly<object>} MediaProgressPrompt。
 */
function createPrompt(kind, message, actions, positionPercent, isTerminal = false) {
  return Object.freeze({
    kind,
    message,
    actions: Object.freeze(actions.map(action => Object.freeze({ ...action }))),
    positionPercent,
    isTerminal
  });
}

/**
 * 按冻结优先级派生唯一 MediaProgressPrompt。
 * 纯函数: 不修改输入，不读取外部状态。
 *
 * @param {object} options 提示输入。
 * @param {string} options.phase 稳定媒体阶段。
 * @param {string} options.errorMessage 安全错误文案。
 * @param {number} options.startSeconds 当前资源恢复起点。
 * @param {number} options.playedSeconds 当前播放秒数。
 * @param {number|null} options.durationSeconds 总时长。
 * @param {boolean} options.hasNextEpisode 是否存在下一集。
 * @param {boolean} options.resumeAcknowledged 恢复提示是否已由播放或从头动作关闭。
 * @returns {Readonly<object>|null} 当前唯一提示；无需提示时为 null。
 */
export function createMediaProgressPrompt(options = {}) {
  // 类型: string；作用: 采用稳定媒体阶段，异常输入回退 idle 并最终不显示提示。
  const phase = typeof options.phase === 'string' ? options.phase : MEDIA_PLAYBACK_PHASE.idle;
  // 类型: string；作用: 清理已通过会话边界的安全错误说明。
  const errorMessage = typeof options.errorMessage === 'string' ? options.errorMessage.trim() : '';
  // 类型: number；作用: 保存当前资源恢复起点，非法输入按零处理。
  const startSeconds = normalizeSeconds(options.startSeconds) || 0;
  // 类型: number|null；作用: 保存当前播放秒数，未知时保留 null。
  const playedSeconds = normalizeSeconds(options.playedSeconds);
  // 类型: number|null；作用: 保存当前媒体总时长，未知时保留 null。
  const durationSeconds = normalizeSeconds(options.durationSeconds);
  // 类型: number；作用: 保存纯模型集中计算和夹取后的水平锚点。
  const positionPercent = resolvePromptPositionPercent(playedSeconds, durationSeconds);

  // 条件分支: 当前阶段是不可播放终态时进入；执行内容: 以最高优先级生成错误和重试动作。
  if (TERMINAL_ERROR_PHASES.includes(phase)) {
    return createPrompt(
      MEDIA_PROGRESS_PROMPT_KIND.error,
      errorMessage || '当前媒体播放失败',
      [{ id: MEDIA_PROGRESS_PROMPT_ACTION.retry, label: '重试当前线路' }],
      positionPercent,
      true
    );
  }

  // 类型: number；作用: 保存当前播放比例，缺少完整指标时为零。
  const progressRatio = durationSeconds && playedSeconds !== null
    ? playedSeconds / durationSeconds
    : 0;
  // 类型: number|null；作用: 保存距媒体结尾剩余秒数，未知时为 null。
  const remainingSeconds = durationSeconds && playedSeconds !== null
    ? Math.max(0, durationSeconds - playedSeconds)
    : null;
  // 类型: boolean；作用: 同时使用结束阶段或集中秒数与比例策略判断近尾提示。
  const isNearEnd = phase === MEDIA_PLAYBACK_PHASE.ended
    || (remainingSeconds !== null
      && remainingSeconds <= MEDIA_PROGRESS_PROMPT_POLICY.nearEndThresholdSeconds
      && progressRatio >= MEDIA_PROGRESS_PROMPT_POLICY.nearEndMinimumProgressRatio);
  // 条件分支: 当前媒体已经结束或达到近尾策略时进入；执行内容: 生成下一集和从头动作。
  if (isNearEnd) {
    // 类型: Array<object>；作用: 按下一集优先、从头随后顺序组织近尾动作。
    const actions = [];
    // 条件分支: 页面证明当前实际线路存在下一集时进入；执行内容: 增加既有 nextEpisode 项目命令。
    if (options.hasNextEpisode === true) {
      actions.push({ id: MEDIA_PROGRESS_PROMPT_ACTION.nextEpisode, label: '播放下一集' });
    }
    actions.push({ id: MEDIA_PROGRESS_PROMPT_ACTION.restart, label: '从头开始' });
    return createPrompt(
      MEDIA_PROGRESS_PROMPT_KIND.nearEnd,
      '即将播放结束',
      actions,
      positionPercent
    );
  }

  // 条件分支: 当前媒体正在等待更多数据时进入；执行内容: 在最后进度位置展示努力加载提示。
  if (phase === MEDIA_PLAYBACK_PHASE.buffering) {
    return createPrompt(
      MEDIA_PROGRESS_PROMPT_KIND.buffering,
      '正在努力加载视频中',
      [],
      positionPercent
    );
  }

  // 条件分支: 当前资源具有恢复起点、尚未开始播放且阶段允许说明时进入；执行内容: 生成定位文案和从头动作。
  if (startSeconds > 0
    && options.resumeAcknowledged !== true
    && RESUME_PROMPT_PHASES.includes(phase)) {
    return createPrompt(
      MEDIA_PROGRESS_PROMPT_KIND.resume,
      `已为您定位至 ${formatMediaProgressTime(startSeconds)}`,
      [{ id: MEDIA_PROGRESS_PROMPT_ACTION.restart, label: '从头播放' }],
      positionPercent
    );
  }

  // 条件分支: 自动播放被浏览器阻止且没有更高优先级恢复提示时进入；执行内容: 提示用户手动开始。
  if (phase === MEDIA_PLAYBACK_PHASE.autoplayBlocked) {
    return createPrompt(
      MEDIA_PROGRESS_PROMPT_KIND.autoplayBlocked,
      '浏览器已阻止自动播放，请点击播放器开始',
      [],
      positionPercent
    );
  }

  // 条件分支: 当前资源处于初始加载且没有更高优先级提示时进入；执行内容: 生成低优先级加载说明。
  if (phase === MEDIA_PLAYBACK_PHASE.loading) {
    return createPrompt(
      MEDIA_PROGRESS_PROMPT_KIND.loading,
      '正在加载视频',
      [],
      positionPercent
    );
  }

  return null;
}
