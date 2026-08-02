/*
  mediaReachabilityService.js 模块说明

  - 文件职责:
      定义播放页会话级媒体可达目标、严格后台顺序和单任务可取消协调器。
      只协调标准播放目录身份和调用方注入的真实媒体探测端口，不请求 Provider、不创建播放器、不写 Store 或持久化。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      MEDIA_REACHABILITY_STATUS: 自定义配置，提供 checking/available/unavailable 三态。
      getPlayCatalogLines、findPlayCatalogEpisode: 自定义服务，按稳定线路和逻辑剧集身份读取标准目录。

  - 模块级常量:
      MEDIA_REACHABILITY_QUEUE_RESULT: Readonly<object>，后台队列完成与取消结果枚举。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeText(value): 清理契约身份文本。
      resolveEpisodeIndex(episode): 读取标准正整数剧集序号。
      normalizeProbeTarget(target): 校验并冻结一个精确媒体探测目标。
      createProbeTarget(context, line, episode, representsLine): 从目录对象创建探测目标。

  - 模块级类:
      无

  - 对外导出:
      createMediaReachabilityKey: Function，生成不依赖分隔符的精确媒体键。
      createMediaReachabilityProbePlan: Function，按当前线路剩余分集和其他线路代表分集生成顺序计划。
      createMediaReachabilityCoordinator: Function，创建单任务、可取消且不持久化的后台队列。
*/

// 导入来源: ../config/mediaPlayback.config.js。
// 导入内容: MEDIA_REACHABILITY_STATUS 三态枚举。
// 文件作用: 队列只发布当前会话允许的蓝、绿、红状态。
import { MEDIA_REACHABILITY_STATUS } from '../config/mediaPlayback.config.js';

// 导入来源: ./playCatalogSelectionService.js。
// 导入内容: getPlayCatalogLines 与 findPlayCatalogEpisode 目录读取函数。
// 文件作用: 按 Provider 标准线路顺序和完全相同逻辑剧集 id 生成探测目标。
import {
  getPlayCatalogLines,
  findPlayCatalogEpisode
} from './playCatalogSelectionService.js';

// 类型: Readonly<object>。
// 作用: 让队列调用方区分完整完成与被新用户目标取消，不依赖错误文案判断控制流。
export const MEDIA_REACHABILITY_QUEUE_RESULT = Object.freeze({
  completed: 'completed',
  cancelled: 'cancelled'
});

/**
 * 清理契约身份文本。
 * 纯函数: 字符串去除首尾空白，其他输入返回空字符串。
 *
 * @param {*} value 待清理身份。
 * @returns {string} 可比较文本或空字符串。
 */
function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 读取逻辑剧集的结构化序号。
 * 纯函数: 只接受 PlayCatalogEpisode.episodeNumber，不使用数组位置或标题猜测。
 *
 * @param {object|null} episode 标准目录剧集。
 * @returns {number|null} 正整数剧集序号或 null。
 */
function resolveEpisodeIndex(episode) {
  // 类型: number；作用: 把标准 episodeNumber 转换为数值候选。
  const episodeIndex = Number(episode?.episodeNumber);
  return Number.isInteger(episodeIndex) && episodeIndex > 0 ? episodeIndex : null;
}

/**
 * 校验并冻结精确媒体探测目标。
 * 纯函数: 返回不引用调用方外壳的新对象，不访问目录、Provider 或页面状态。
 * 失败路径: 四段媒体身份任一为空时抛出，禁止队列探测相邻集或默认线路。
 *
 * @param {*} target 探测目标候选。
 * @returns {Readonly<object>} 标准探测目标。
 * @throws {Error} 当 sourceId、contentId、lineId 或 episodeId 缺失时抛出。
 */
function normalizeProbeTarget(target) {
  // 类型: object；作用: 非普通对象使用空对象进入统一身份失败路径。
  const candidate = target && typeof target === 'object' && !Array.isArray(target) ? target : {};
  // 类型: object；作用: 一次读取四段稳定身份，后续键和请求使用同一值。
  const identity = {
    sourceId: normalizeText(candidate.sourceId),
    contentId: normalizeText(candidate.contentId),
    lineId: normalizeText(candidate.lineId),
    episodeId: normalizeText(candidate.episodeId)
  };
  // 条件分支: 任一身份为空时进入；执行内容: 阻止半完整目标进入队列或状态表。
  if (!identity.sourceId || !identity.contentId || !identity.lineId || !identity.episodeId) {
    throw new Error('媒体可达目标身份不完整');
  }

  return Object.freeze({
    ...identity,
    // 类型: number|null；作用: Provider 支持序号定位时提供标准正整数，未知时保持 null。
    episodeIndex: Number.isInteger(candidate.episodeIndex) && candidate.episodeIndex > 0
      ? candidate.episodeIndex
      : null,
    // 类型: boolean；true 表示该目标结果同时代表线路状态，false 只更新精确剧集状态。
    representsLine: candidate.representsLine === true
  });
}

/**
 * 创建不依赖分隔符的精确媒体可达键。
 * 纯函数: 标准化身份后使用 JSON 数组编码，Provider id 中出现普通标点也不会产生碰撞。
 *
 * @param {*} target 媒体可达目标。
 * @returns {string} sourceId、contentId、lineId、episodeId 四段身份键。
 */
export function createMediaReachabilityKey(target) {
  // 类型: Readonly<object>；作用: 复用同一身份校验，非法目标不能进入去重集合。
  const normalizedTarget = normalizeProbeTarget(target);
  return JSON.stringify([
    normalizedTarget.sourceId,
    normalizedTarget.contentId,
    normalizedTarget.lineId,
    normalizedTarget.episodeId
  ]);
}

/**
 * 从标准目录对象创建一个精确探测目标。
 * 纯函数: 不修改目录线路和剧集，返回冻结新对象。
 *
 * @param {object} context 当前内容身份。
 * @param {string} context.sourceId 当前 Provider 身份。
 * @param {string} context.contentId 当前内容身份。
 * @param {object} line 标准 PlayCatalogLine。
 * @param {object} episode 标准 PlayCatalogEpisode。
 * @param {boolean} representsLine true 让结果代表线路，false 只代表分集。
 * @returns {Readonly<object>} 标准探测目标。
 */
function createProbeTarget(context, line, episode, representsLine) {
  return normalizeProbeTarget({
    sourceId: context.sourceId,
    contentId: context.contentId,
    lineId: line.id,
    episodeId: episode.id,
    episodeIndex: resolveEpisodeIndex(episode),
    representsLine
  });
}

/**
 * 按冻结顺序生成当前媒体成功后的后台探测计划。
 * 纯函数: 保留 Provider 线路和分集顺序，不修改目录、不请求媒体、不猜测相邻集。
 * 成功路径: 先返回当前线路除当前集外的全部明确 playable 分集，再为其他可用线路返回当前同集或首个 playable 代表分集。
 * 失败路径: 当前线路不在目录、身份不完整或没有可探测条目时返回空数组。
 *
 * @param {*} playCatalog 当前 ContentItem.playCatalog。
 * @param {object} context 当前正式媒体身份。
 * @param {string} context.sourceId 当前数据源 id。
 * @param {string} context.contentId 当前内容 id。
 * @param {string} context.lineId 当前实际线路 id。
 * @param {string} context.episodeId 当前实际逻辑剧集 id。
 * @returns {Array<Readonly<object>>} 已去重的严格顺序探测目标。
 */
export function createMediaReachabilityProbePlan(playCatalog, context = {}) {
  // 类型: object；作用: 清理当前正式媒体四段身份，非法输入直接返回空计划。
  const normalizedContext = {
    sourceId: normalizeText(context.sourceId),
    contentId: normalizeText(context.contentId),
    lineId: normalizeText(context.lineId),
    episodeId: normalizeText(context.episodeId)
  };
  // 条件分支: 当前正式媒体缺少任一身份时进入；执行内容: 返回空计划，不请求默认线路或相邻内容。
  if (!normalizedContext.sourceId || !normalizedContext.contentId
    || !normalizedContext.lineId || !normalizedContext.episodeId) return [];

  // 类型: Array<object>；作用: 保留 Provider 正式线路顺序，后续阶段不重新排序。
  const lines = getPlayCatalogLines(playCatalog);
  // 类型: object|undefined；作用: 精确定位当前实际线路，缺失时不能生成跨目录计划。
  const currentLine = lines.find(line => normalizeText(line.id) === normalizedContext.lineId);
  // 条件分支: 当前正式线路已经不属于目录时进入；执行内容: 返回空计划，避免跨目录探测。
  if (!currentLine) return [];

  // 类型: Array<Readonly<object>>；作用: 按冻结顺序累计当前线路分集和其他线路代表目标。
  const targets = [];
  // 类型: Set<string>；作用: 防止 Provider 目录重复条目形成重复媒体请求。
  const targetKeys = new Set();

  /**
   * 追加一个尚未出现的探测目标。
   * 副作用: 只修改本函数局部 targets 和 targetKeys，不修改输入目录。
   *
   * @param {object} line 标准线路。
   * @param {object} episode 标准剧集。
   * @param {boolean} representsLine 是否代表线路状态。
   * @returns {void} 无返回业务对象。
   */
  function appendTarget(line, episode, representsLine) {
    // 条件分支: 线路、剧集或结构可用性明确失败时进入；执行内容: 不创建无法请求的后台目标。
    if (!line || !episode || line.available === false || episode.playable === false) return;
    // 类型: Readonly<object>；作用: 创建包含完整内容、线路和剧集身份的队列条目。
    const target = createProbeTarget(normalizedContext, line, episode, representsLine);
    // 类型: string；作用: 以四段稳定身份去重，不使用数组位置。
    const targetKey = createMediaReachabilityKey(target);
    // 条件分支: 同一四段媒体身份已经加入计划时进入；执行内容: 跳过重复 Provider 目录条目。
    if (targetKeys.has(targetKey)) return;
    targetKeys.add(targetKey);
    targets.push(target);
  }

  // 类型: Array<object>；作用: 当前线路按 Provider 原顺序筛选除当前集外的明确可播放分集。
  const currentLineEpisodes = Array.isArray(currentLine.episodes) ? currentLine.episodes : [];
  currentLineEpisodes.forEach((episode) => {
    // 条件分支: 当前正式分集不重复后台探测；执行内容: 当前 CANPLAY 事实由页面直接标绿。
    if (normalizeText(episode?.id) === normalizedContext.episodeId) return;
    appendTarget(currentLine, episode, false);
  });

  // 循环类型: Array.prototype.forEach；初始值: Provider 第一条线路；终止条件: 全部其他线路完成代表目标选择；作用: 保持目录顺序。
  lines.forEach((line) => {
    // 条件分支: 当前实际线路或结构不可用线路进入；执行内容: 当前线路已处理，不可用线路没有可请求代表目标。
    if (normalizeText(line.id) === normalizedContext.lineId || line.available === false) return;
    // 类型: object|null；作用: 优先采用与当前正式媒体完全相同的逻辑剧集。
    const sameEpisode = findPlayCatalogEpisode(line, normalizedContext.episodeId);
    // 类型: Array<object>；作用: 同集缺失或不可播放时按 Provider 顺序查找首个明确 playable 分集，不猜测相邻集。
    const lineEpisodes = Array.isArray(line.episodes) ? line.episodes : [];
    // 类型: object|undefined|null；作用: 优先保存当前同集，否则保存该线路首个明确可播放分集作为线路代表目标。
    const representativeEpisode = sameEpisode && sameEpisode.playable !== false
      ? sameEpisode
      : lineEpisodes.find(episode => episode && episode.playable !== false);
    // 条件分支: 其他线路存在可请求代表分集时进入；执行内容: 追加一次代表线路状态的精确探测。
    if (representativeEpisode) appendTarget(line, representativeEpisode, true);
  });

  return targets;
}

/**
 * 创建播放页后台媒体可达协调器。
 * 内部状态: 保存单调代次和当前尚未完成目标；不保存媒体响应、播放器实例或长期状态。
 * 副作用: start 依次调用 probeTarget 和 onStatusChange；cancel/dispose 调用 onCancel 清理调用方候选实例。
 * 成功路径: 全部目标先发布 checking，再严格串行探测并分别发布 available/unavailable。
 * 失败路径: 单个 probe reject 收敛为 unavailable 后继续；新 start、cancel 或 dispose 让旧结果失效且不启动后续目标。
 *
 * @param {object} ports 协调器窄端口。
 * @param {Function} ports.probeTarget 真实媒体探测函数，返回 Promise<boolean>。
 * @param {Function} ports.onStatusChange 状态采用函数，接收 target 和三态。
 * @param {Function} ports.onCancel 取消清理函数，接收仍为 checking 的目标数组。
 * @returns {Readonly<object>} start、cancel、dispose 三个生命周期方法。
 */
export function createMediaReachabilityCoordinator(ports = {}) {
  // 条件分支: 任一必需端口不是函数时进入；执行内容: 在页面创建前失败关闭。
  if (typeof ports.probeTarget !== 'function'
    || typeof ports.onStatusChange !== 'function'
    || typeof ports.onCancel !== 'function') {
    throw new Error('媒体可达协调器端口不完整');
  }

  // 类型: number；生命周期: 当前协调器；作用: 每次 start/cancel/dispose 单调递增，拒绝迟到 Provider 或媒体结果。
  let generation = 0;
  // 类型: Array<Readonly<object>>；生命周期: 当前队列；作用: 保存尚未完成目标，取消时仅清理仍为 checking 的状态。
  let pendingTargets = [];
  // 类型: boolean；作用: true 表示协调器已经销毁且不能再次启动，false 表示仍属于活动 PlayerView。
  let disposed = false;

  /**
   * 取消当前后台队列。
   * 副作用: 使当前代次失效并通知调用方移除在途候选和 checking 状态；已完成状态保持。
   *
   * @returns {void} 取消同步完成。
   */
  function cancel() {
    generation += 1;
    // 类型: Array<Readonly<object>>；作用: 隔离当前未完成集合，回调不能修改协调器内部数组。
    const cancelledTargets = pendingTargets.slice();
    pendingTargets = [];
    ports.onCancel(cancelledTargets);
  }

  /**
   * 严格串行执行一组媒体探测目标。
   * 副作用: 取消旧队列、发布三态并调用真实 probeTarget；同一时刻最多一个 probe Promise 在途。
   * 成功路径: 返回 completed；每个目标无论成功或失败都完成一次终态采用。
   * 失败路径: 新命令或销毁返回 cancelled，迟到结果不再发布状态或启动后续目标。
   *
   * @param {Array<object>} targets 顺序探测目标。
   * @returns {Promise<string>} MEDIA_REACHABILITY_QUEUE_RESULT。
   */
  async function start(targets) {
    // 副作用: 新计划优先取消上一队列和在途候选，用户目标不会排在后台工作之后。
    cancel();
    // 条件分支: 页面已销毁时进入；执行内容: 不发布 checking、不调用探测端口。
    if (disposed) return MEDIA_REACHABILITY_QUEUE_RESULT.cancelled;

    // 类型: Array<Readonly<object>>；作用: 校验、冻结并按四段媒体键去重，保留调用方顺序。
    const normalizedTargets = [];
    // 类型: Set<string>；作用: 同一计划内重复目标只探测一次。
    const seenKeys = new Set();
    (Array.isArray(targets) ? targets : []).forEach((target) => {
      // 类型: Readonly<object>；作用: 校验并冻结当前调用方目标，禁止队列保存可变身份对象。
      const normalizedTarget = normalizeProbeTarget(target);
      // 类型: string；作用: 生成当前目标四段精确键，供同一计划去重。
      const targetKey = createMediaReachabilityKey(normalizedTarget);
      // 条件分支: 当前目标键已经出现时进入；执行内容: 保留首次顺序并跳过重复项。
      if (seenKeys.has(targetKey)) return;
      seenKeys.add(targetKey);
      normalizedTargets.push(normalizedTarget);
    });

    // 类型: number；作用: 捕获本轮唯一代次，任意后续取消都会使 isCurrent 返回 false。
    const currentGeneration = generation;
    pendingTargets = normalizedTargets.slice();

    /**
     * 判断当前队列代次是否仍可创建或采用媒体候选。
     * 纯函数: 只读取协调器 disposed 和 generation，不修改队列或页面状态。
     *
     * @returns {boolean} true 表示当前 start 仍有效，false 表示已取消或销毁。
     */
    function isCurrent() {
      return !disposed && currentGeneration === generation;
    }

    // 类型: Readonly<object>；作用: 把当前代次检查窄端口交给异步 Provider 和媒体准备调用链。
    const probeContext = Object.freeze({ isCurrent });
    // 循环类型: Array.prototype.forEach；作用: 队列开始时全部待处理目标先显示蓝色，等待和正在请求共用 checking。
    normalizedTargets.forEach(target => ports.onStatusChange(target, MEDIA_REACHABILITY_STATUS.checking));

    // 循环类型: for...of + await；初始值: 第一条当前线路剩余分集；终止条件: 全部目标完成或代次取消；作用: 保证单任务串行。
    for (const target of normalizedTargets) {
      // 条件分支: 页面销毁或新命令已取消本代次时进入；执行内容: 停止队列且不启动当前目标。
      if (disposed || currentGeneration !== generation) return MEDIA_REACHABILITY_QUEUE_RESULT.cancelled;
      // 类型: boolean；作用: 只有调用方真实 Xgplayer/HLS CANPLAY 返回 true，任意 reject 收敛为 false。
      let isAvailable = false;
      try {
        isAvailable = await ports.probeTarget(target, probeContext) === true;
      } catch {
        isAvailable = false;
      }
      // 条件分支: 等待 Provider 或 CANPLAY 期间代次被取消时进入；执行内容: 丢弃迟到终态且不启动后续目标。
      if (disposed || currentGeneration !== generation) return MEDIA_REACHABILITY_QUEUE_RESULT.cancelled;

      // 类型: string；作用: 保存已经得到终态的精确媒体键，后续取消不再清除它的已完成红/绿状态。
      const completedKey = createMediaReachabilityKey(target);
      pendingTargets = pendingTargets.filter(item => createMediaReachabilityKey(item) !== completedKey);
      ports.onStatusChange(
        target,
        isAvailable ? MEDIA_REACHABILITY_STATUS.available : MEDIA_REACHABILITY_STATUS.unavailable
      );
    }

    return MEDIA_REACHABILITY_QUEUE_RESULT.completed;
  }

  /**
   * 永久释放协调器。
   * 副作用: 标记 disposed 并取消当前队列；后续 start 只返回 cancelled。
   *
   * @returns {void} 释放同步完成。
   */
  function dispose() {
    disposed = true;
    cancel();
  }

  return Object.freeze({ start, cancel, dispose });
}
