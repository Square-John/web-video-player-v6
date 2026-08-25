/*
  mediaReachabilityService.js 模块说明

  - 文件职责:
      定义详情与播放页会话级媒体可达目标、有界后台并发和可取消协调器。
      只协调标准播放目录身份和调用方注入的真实媒体探测端口，不请求 Provider、不创建播放器、不写 Store 或持久化。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      MEDIA_REACHABILITY_STATUS、MEDIA_REACHABILITY_POLICY: 自定义配置，提供三态和统一探测并发上限。
      getPlayCatalogLines、findPlayCatalogEpisode: 自定义服务，按稳定线路和逻辑剧集身份读取标准目录。

  - 模块级常量:
      MEDIA_REACHABILITY_QUEUE_RESULT: Readonly<object>，后台队列完成与取消结果枚举。
      MEDIA_REACHABILITY_PROBE_RESULT: Readonly<object>，单目标可达、不可达与内部不可判定结果枚举。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeText(value): 清理契约身份文本。
      resolveMediaOrigin(media): 从标准直连媒体读取 Origin 级调度身份。
      createMediaOriginAdmissionGate(): 创建同 Origin 单槽位、可取消的媒体准备准入门禁。
      resolveEpisodeIndex(episode): 读取标准正整数剧集序号。
      normalizeProbeTarget(target): 校验并冻结一个精确媒体探测目标。
      createProbeTarget(context, line, episode, representsLine): 从目录对象创建探测目标。

  - 模块级类:
      无

  - 对外导出:
      createMediaReachabilityKey: Function，生成不依赖分隔符的精确媒体键。
      createDetailLineReachabilityProbePlan: Function，为详情页每条线路生成一个代表目标。
      createMediaReachabilityProbePlan: Function，按当前线路剩余分集和其他线路代表分集生成顺序计划。
      createMediaReachabilityCoordinator: Function，创建有界并发、按媒体 Origin 准入、可取消且不持久化的后台队列。
*/

// 导入来源: ../config/mediaPlayback.config.js。
// 导入内容: MEDIA_REACHABILITY_STATUS 三态枚举。
// 文件作用: 队列只发布当前会话允许的蓝、绿、红状态。
import {
  MEDIA_REACHABILITY_POLICY,
  MEDIA_REACHABILITY_STATUS
} from '../config/mediaPlayback.config.js';

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

// 类型: Readonly<object>。
// 作用: 保留真实媒体成功、可归属媒体失败和基础设施未知三类内部事实；活动探测计划把未知投影为 UI 不可用，取消任务不发布终态。
export const MEDIA_REACHABILITY_PROBE_RESULT = Object.freeze({
  // 类型: string；作用: 当前精确媒体已经由真实 Xgplayer/HLS CANPLAY 证明可达。
  available: 'available',
  // 类型: string；作用: 当前精确媒体已经由可归属的播放器媒体加载错误证明不可达。
  unavailable: 'unavailable',
  // 类型: string；作用: Provider、契约、取消、槽位或播放器基础设施失败，不能据此把资源标红。
  inconclusive: 'inconclusive'
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
 * 读取标准直连媒体的 Origin 调度身份。
 * 纯函数: 只解析已经通过候选校验的媒体 URL，不请求网络、不保留完整路径或查询参数。
 * 失败路径: URL 无效时抛出，由调用方按不可判定失败收敛。
 *
 * @param {object} media 标准 playback.media。
 * @returns {string} 协议、主机和端口组成的 Origin。
 */
function resolveMediaOrigin(media) {
  // 类型: string；作用: 只接受标准媒体对象中的非空绝对 URL。
  const mediaUrl = normalizeText(media?.url);
  // 条件分支: 标准媒体没有非空 URL 时进入；执行内容: 拒绝无法按 Origin 分组的媒体候选。
  if (!mediaUrl) throw new Error('媒体探测 Origin 缺少 URL');
  // 返回值类型: string；作用: 同一 CDN 路径和分集共享 Origin 准入，不把完整媒体地址写入调度状态。
  return new URL(mediaUrl).origin;
}

/**
 * 创建当前探测计划的媒体 Origin 准入门禁。
 * 副作用: 按 Origin 保存活动数量和 FIFO 等待票据；取消时只唤醒未开始票据，活动媒体由页面资源屏障释放。
 * 成功路径: 同一 Origin 同时不超过集中上限，不同 Origin 可以被外层 worker 并发执行。
 * 失败路径: 计划取消或票据代次失效时返回内部不可判定，不启动媒体准备操作。
 *
 * @returns {Readonly<object>} runMediaProbe 和 cancel 生命周期端口。
 */
function createMediaOriginAdmissionGate() {
  // 类型: Map<string, object>；生命周期: 当前 start 计划；作用: 保存每个媒体 Origin 的活动数与 FIFO 票据。
  const originStates = new Map();
  // 类型: boolean；作用: true 后不再准入新媒体并唤醒全部等待票据。
  let cancelled = false;

  /**
   * 清理空闲 Origin 状态。
   * 副作用: Origin 没有活动或等待票据时删除 Map 项，避免长页面会话累积主机键。
   *
   * @param {string} origin 媒体 Origin。
   * @param {object} state 当前 Origin 状态。
   * @returns {void} 空闲项已清理或继续保留。
   */
  function cleanupOrigin(origin, state) {
    // 条件分支: 当前 Origin 没有活动任务、等待票据且仍由当前状态对象持有时进入；执行内容: 删除空闲主机键。
    if (state.activeCount === 0 && state.queue.length === 0 && originStates.get(origin) === state) {
      originStates.delete(origin);
    }
  }

  /**
   * 尝试准入当前 Origin 的等待票据。
   * 副作用: 按 FIFO 提升票据并向其返回一次性 release；取消或失效票据返回 null。
   *
   * @param {string} origin 媒体 Origin。
   * @param {object} state 当前 Origin 状态。
   * @returns {void} 当前可准入票据已同步完成。
   */
  function drainOrigin(origin, state) {
    while (!cancelled
      && state.activeCount < MEDIA_REACHABILITY_POLICY.maxConcurrentMediaProbesPerOrigin
      && state.queue.length > 0) {
      // 类型: object；作用: 按 FIFO 取得下一张媒体准备票据。
      const ticket = state.queue.shift();
      // 条件分支: 票据等待期间页面代次已取消时进入；执行内容: 返回 null 且继续检查后续票据。
      if (ticket.isCurrent() !== true) {
        ticket.resolve(null);
        continue;
      }
      state.activeCount += 1;
      // 类型: boolean；作用: 保证调用方重复 finally 也只释放一次 Origin 配额。
      let released = false;
      ticket.resolve(() => {
        // 条件分支: 当前票据已经释放过时进入；执行内容: 忽略重复释放，防止 Origin 活动数减到负数。
        if (released) return;
        released = true;
        state.activeCount -= 1;
        drainOrigin(origin, state);
        cleanupOrigin(origin, state);
      });
    }
    cleanupOrigin(origin, state);
  }

  /**
   * 在媒体 Origin 配额内执行一个真实播放器准备操作。
   * 副作用: 等待同 Origin FIFO 票据并在任意终态释放；操作本身由页面注入。
   * 成功路径: 取得票据后执行 operation，并把 operation 的标准结果原样返回。
   * 失败路径: 计划取消、代次失效或票据未取得时返回 inconclusive；operation 抛错由上层分类。
   *
   * @param {object} media 标准 playback.media。
   * @param {Function} operation 已取得 Origin 配额后执行的媒体准备函数。
   * @param {Function} isCurrent 当前探测计划代次检查函数。
   * @returns {Promise<string>} 单目标媒体探测内部结果。
   */
  async function runMediaProbe(media, operation, isCurrent) {
    // 条件分支: operation 或 isCurrent 不是函数时进入；执行内容: 拒绝创建没有生命周期和代次边界的准入任务。
    if (typeof operation !== 'function' || typeof isCurrent !== 'function') {
      throw new Error('媒体 Origin 准入端口不完整');
    }
    // 条件分支: 门禁已取消或当前代次已经失效时进入；执行内容: 不解析 URL、不入队且返回内部不可判定。
    if (cancelled || isCurrent() !== true) return MEDIA_REACHABILITY_PROBE_RESULT.inconclusive;
    // 类型: string；作用: 仅以标准 URL Origin 分组，不读取 Provider 或线路身份。
    const origin = resolveMediaOrigin(media);
    // 类型: object；作用: 复用当前 Origin 状态或创建隔离 FIFO。
    const state = originStates.get(origin) || { activeCount: 0, queue: [] };
    originStates.set(origin, state);
    // 类型: Function|null；作用: 非 null 表示当前票据已取得一次性释放端口。
    const release = await new Promise((resolve) => {
      state.queue.push({ resolve, isCurrent });
      drainOrigin(origin, state);
    });
    // 条件分支: 等待期间门禁取消、当前代次失效或没有释放端口时进入；执行内容: 不启动隐藏媒体操作并返回内部不可判定。
    if (!release || cancelled || isCurrent() !== true) return MEDIA_REACHABILITY_PROBE_RESULT.inconclusive;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  /**
   * 取消全部尚未准入的媒体票据。
   * 副作用: 等待票据统一返回 null；活动操作继续由页面 onCancel 释放真实播放器。
   *
   * @returns {void} 门禁已永久取消。
   */
  function cancel() {
    cancelled = true;
    originStates.forEach((state, origin) => {
      // 类型: Array<object>；作用: 保存当前 Origin 尚未取得媒体准入的票据，取消后统一唤醒为 null。
      const queuedTickets = state.queue.splice(0);
      queuedTickets.forEach(ticket => ticket.resolve(null));
      cleanupOrigin(origin, state);
    });
  }

  return Object.freeze({ runMediaProbe, cancel });
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
 * 为详情页生成每条线路一个代表媒体的严格顺序计划。
 * 纯函数: 保留 Provider 线路和分集顺序，不修改目录、不请求媒体、不推测逻辑剧集。
 * 成功路径: 每条可请求线路只取第一个明确 playable 分集，并让结果代表该线路。
 * 失败路径: 内容身份不完整、线路不可请求或没有 playable 分集时跳过该线路；无目标返回空数组。
 *
 * @param {*} playCatalog 当前 ContentItem.playCatalog。
 * @param {object} context 当前详情内容身份。
 * @param {string} context.sourceId 当前 Provider 身份。
 * @param {string} context.contentId 当前内容身份。
 * @returns {Array<Readonly<object>>} 按 Provider 线路顺序排列的代表探测目标。
 */
export function createDetailLineReachabilityProbePlan(playCatalog, context = {}) {
  // 类型: object；作用: 清理当前详情内容身份，非法输入不能生成跨内容探测目标。
  const normalizedContext = {
    sourceId: normalizeText(context.sourceId),
    contentId: normalizeText(context.contentId)
  };
  // 条件分支: 数据源或内容身份缺失时进入；执行内容: 返回空计划，不请求默认内容。
  if (!normalizedContext.sourceId || !normalizedContext.contentId) return [];

  // 类型: Array<Readonly<object>>；作用: 按 Provider 线路顺序保存每条线路唯一代表目标。
  const targets = [];
  // 循环类型: Array.prototype.forEach；初始值: 第一条 Provider 线路；终止条件: 全部线路处理完成；作用: 保持目录展示顺序。
  getPlayCatalogLines(playCatalog).forEach((line) => {
    // 条件分支: 线路被 Provider 明确标记不可请求时进入；执行内容: 不创建媒体请求。
    if (line?.available === false) return;
    // 类型: Array<object>；作用: 只在当前线路自己的标准选集中寻找代表目标。
    const episodes = Array.isArray(line?.episodes) ? line.episodes : [];
    // 类型: object|undefined；作用: 选择 Provider 顺序中的第一个明确可请求条目，不按标题或集数猜测。
    const representativeEpisode = episodes.find(episode => episode && episode.playable !== false);
    // 条件分支: 当前线路没有可请求条目时进入；执行内容: 保持未知状态且不制造空目标。
    if (!representativeEpisode) return;
    targets.push(createProbeTarget(normalizedContext, line, representativeEpisode, true));
  });

  return targets;
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
 * 内部状态: 保存单调代次、当前未完成目标、Origin 门禁和取消屏障；不保存媒体响应、播放器实例或长期状态。
 * 副作用: start 并发调用受策略限制数量的 probeTarget；cancel/dispose 关闭 Origin 门禁并等待调用方释放全部已启动候选实例。
 * 成功路径: 全部目标先发布 checking，再以有界并发按整轮失败集合重试；任一轮可达立即发布 available，最后一轮仍失败才发布 unavailable。
 * 失败路径: 单次 unavailable、inconclusive 或 probe reject 只进入下一轮失败集合；新 start 必须等待旧候选释放屏障后才能启动下一目标。
 *
 * @param {object} ports 协调器窄端口。
 * @param {Function} ports.probeTarget 真实媒体探测函数，返回 Promise<MEDIA_REACHABILITY_PROBE_RESULT>。
 * @param {Function} ports.onStatusChange 状态采用函数，接收 target 和三态。
 * @param {Function} ports.onCancel 取消清理函数，接收仍为 checking 的目标数组并返回资源释放 Promise。
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
  // 类型: Map<string, Readonly<object>>；生命周期: 当前队列；作用: 保存尚未完成目标，取消时仅清理仍为 checking 的状态。
  let pendingTargets = new Map();
  // 类型: boolean；作用: true 表示协调器已经销毁且不能再次启动，false 表示仍属于活动 PlayerView。
  let disposed = false;
  // 类型: Promise<void>；生命周期: 当前协调器；作用: 串联取消清理，下一目标必须等前一候选真实释放后才可启动。
  let cancellationBarrier = Promise.resolve();
  // 类型: Readonly<object>|null；生命周期: 当前 start 计划；作用: 取消时封闭旧计划同 Origin 等待队列，不复用到下一代次。
  let activeMediaOriginAdmissionGate = null;

  /**
   * 取消当前后台队列。
   * 副作用: 使当前代次失效并通知调用方移除在途候选和 checking 状态；已完成状态保持。
   *
   * @returns {Promise<void>} 调用方候选资源完成释放后兑现。
   */
  function cancel() {
    generation += 1;
    // 类型: Readonly<object>|null；作用: 捕获旧计划门禁后立即断开协调器引用，新计划只能创建自己的隔离门禁。
    const cancelledMediaOriginAdmissionGate = activeMediaOriginAdmissionGate;
    activeMediaOriginAdmissionGate = null;
    // 准入取消: 先唤醒尚未开始的同 Origin 票据；已经启动的媒体操作继续由 onCancel 资源屏障销毁。
    cancelledMediaOriginAdmissionGate?.cancel();
    // 类型: Array<Readonly<object>>；作用: 隔离当前未完成集合，回调不能修改协调器内部数组。
    const cancelledTargets = Array.from(pendingTargets.values());
    pendingTargets = new Map();
    // 资源屏障: 即使上一轮清理失败也继续执行本轮取消；本轮失败向 start 传播并阻止创建新候选。
    cancellationBarrier = cancellationBarrier.then(
      () => Promise.resolve(ports.onCancel(cancelledTargets)),
      () => Promise.resolve(ports.onCancel(cancelledTargets))
    );
    return cancellationBarrier;
  }

  /**
   * 有界并发执行一组媒体探测目标。
   * 副作用: 取消旧队列、发布三态并调用真实 probeTarget；同一时刻最多由集中策略允许数量的 probe Promise 在途。
   * 成功路径: 返回 completed；每个目标无论成功或失败都完成一次终态采用。
   * 失败路径: 新命令或销毁返回 cancelled，迟到结果不再发布状态或启动后续目标。
   *
   * @param {Array<object>} targets 按 Provider 目录顺序排列的探测目标。
   * @returns {Promise<string>} MEDIA_REACHABILITY_QUEUE_RESULT。
   */
  async function start(targets) {
    // 副作用: 新计划优先取消上一队列和在途候选，用户目标不会排在后台工作之后。
    // 类型: Promise<void>；作用: 捕获旧队列候选的真实释放屏障，禁止下一 Provider/播放器目标与旧实例销毁交错。
    const previousCancellation = cancel();
    // 类型: number；作用: 捕获本轮唯一代次；等待释放期间出现新命令时本轮直接取消。
    const currentGeneration = generation;
    await previousCancellation;
    // 条件分支: 页面已销毁时进入；执行内容: 不发布 checking、不调用探测端口。
    if (disposed || currentGeneration !== generation) return MEDIA_REACHABILITY_QUEUE_RESULT.cancelled;
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

    pendingTargets = new Map(normalizedTargets.map(target => [
      createMediaReachabilityKey(target),
      target
    ]));

    /**
     * 判断当前队列代次是否仍可创建或采用媒体候选。
     * 纯函数: 只读取协调器 disposed 和 generation，不修改队列或页面状态。
     *
     * @returns {boolean} true 表示当前 start 仍有效，false 表示已取消或销毁。
     */
    function isCurrent() {
      return !disposed && currentGeneration === generation;
    }

    // 循环类型: Array.prototype.forEach；作用: 队列开始时全部待处理目标先显示蓝色，等待和正在请求共用 checking。
    normalizedTargets.forEach(target => ports.onStatusChange(target, MEDIA_REACHABILITY_STATUS.checking));
    // 类型: Readonly<object>；生命周期: 当前 start 计划；作用: 只约束取得媒体 URL 后的隐藏准备，同一 Origin 单槽位且不同 Origin 可并发。
    const mediaOriginAdmissionGate = createMediaOriginAdmissionGate();
    activeMediaOriginAdmissionGate = mediaOriginAdmissionGate;

    // 类型: Array<Readonly<object>>；作用: 保存当前轮仍需探测的失败集合；每轮结束后按原顺序缩减，不重复成功目标。
    let roundTargets = normalizedTargets;

    // 循环类型: for；初始值: 第一次完整探测；终止条件: 达到集中最大尝试次数、全部目标成功或代次取消；作用: 整轮结束后只重试失败目标。
    for (let attemptNumber = 1;
      attemptNumber <= MEDIA_REACHABILITY_POLICY.probeAttemptTimeoutMs.length
        && roundTargets.length > 0
        && isCurrent();
      attemptNumber += 1) {
      // 类型: Array<Readonly<object>>；作用: 固定本轮输入，worker 和下一轮筛选不共享可变数组。
      const currentRoundTargets = roundTargets;
      // 类型: number；作用: 从集中递增策略读取本轮 Provider 与媒体准备共享期限，不在页面、宿主或 Provider 散落数值。
      const timeoutMs = MEDIA_REACHABILITY_POLICY.probeAttemptTimeoutMs[attemptNumber - 1];
      // 类型: Readonly<object>；作用: 向异步 Provider 和媒体准备调用链交付当前代次、轮次、统一期限和当前计划 Origin 准入端口。
      const probeContext = Object.freeze({
        isCurrent,
        attemptNumber,
        timeoutMs,
        /**
         * 在当前探测计划的媒体 Origin 准入内执行隐藏媒体准备。
         * 端口边界: Provider 请求仍受外层三个 worker 调度；只有标准媒体解析完成后的隐藏播放器准备按 Origin 准入。
         * 副作用: 取得 Origin 票据后执行调用方注入的 operation，不修改协调器外部状态。
         * 成功路径: 同 Origin FIFO 取得单槽位后执行 operation 并返回其结果。
         * 失败路径: 计划取消或代次失效时不启动 operation，返回内部不可判定。
         *
         * @param {object} media 标准 playback.media。
         * @param {Function} operation 已取得媒体准入后创建隐藏播放器的函数。
         * @returns {Promise<string>} 标准媒体探测内部结果。
         */
        runMediaProbe(media, operation) {
          return mediaOriginAdmissionGate.runMediaProbe(media, operation, isCurrent);
        }
      });
      // 类型: Array<boolean>；作用: 按本轮原始索引记录失败，确保下一轮仍保持 Provider 目录顺序。
      const retryFlags = currentRoundTargets.map(() => false);
      // 类型: number；作用: 读取本轮集中并发上限，失败集合缩小时不创建空 worker。
      const workerCount = Math.min(
        MEDIA_REACHABILITY_POLICY.maxConcurrentProbes,
        currentRoundTargets.length
      );
      // 类型: number；作用: 多 worker 共享的本轮下一个目标索引，保持目标分配顺序且不重复消费。
      let nextTargetIndex = 0;

      /**
       * 处理本轮一个探测目标并采用结果。
       * 副作用: 调用真实 probeTarget；成功目标立即发布 available 并移出 pendingTargets，失败目标按索引进入下一轮或在最后一轮发布 unavailable。
       * 成功路径: 当前代次有效时继续消费本轮下一个目标。
       * 失败路径: unavailable、inconclusive 和 reject 使用同一有界重试策略；代次失效时立即结束 worker。
       *
       * @returns {Promise<void>} 当前 worker 完成本轮目标消费后兑现。
       */
      async function processNextTarget() {
        while (isCurrent() && nextTargetIndex < currentRoundTargets.length) {
          // 类型: number；作用: 捕获当前 worker 领取的稳定本轮索引，异步完成后仍可写回正确 retryFlags 位置。
          const targetIndex = nextTargetIndex;
          // 类型: object；作用: 读取当前 worker 从本轮固定输入领取的精确媒体目标。
          const target = currentRoundTargets[targetIndex];
          nextTargetIndex += 1;
          // 类型: string；作用: 按四段身份定位 pendingTargets 中当前目标的状态。
          const targetKey = createMediaReachabilityKey(target);
          // 类型: string；作用: 默认把异常归为内部不可判定，交给本轮失败集合处理。
          let probeResult = MEDIA_REACHABILITY_PROBE_RESULT.inconclusive;
          try {
            // 类型: string；作用: 接收探测宿主返回的标准内部结果，未知值保持不可判定。
            const candidateResult = await ports.probeTarget(target, probeContext);
            // 条件分支: probeTarget 返回已知内部结果时进入；执行内容: 采用该结果，否则保持不可判定。
            if (Object.values(MEDIA_REACHABILITY_PROBE_RESULT).includes(candidateResult)) {
              probeResult = candidateResult;
            }
          } catch {
            probeResult = MEDIA_REACHABILITY_PROBE_RESULT.inconclusive;
          }
          // 条件分支: 等待 Provider 或 CANPLAY 期间代次已经失效时进入；执行内容: 丢弃迟到结果且不启动后续目标。
          if (!isCurrent()) return;
          // 条件分支: 当前目标形成真实可达证据时进入；执行内容: 立即发布绿色并永久移出后续轮次。
          if (probeResult === MEDIA_REACHABILITY_PROBE_RESULT.available) {
            pendingTargets.delete(targetKey);
            ports.onStatusChange(target, MEDIA_REACHABILITY_STATUS.available);
            continue;
          }
          // 条件分支: 当前还不是最后一次尝试时进入；执行内容: 保持 checking 并按原顺序加入下一轮失败集合。
          if (attemptNumber < MEDIA_REACHABILITY_POLICY.probeAttemptTimeoutMs.length) {
            retryFlags[targetIndex] = true;
            continue;
          }
          // 最终收敛: 同一精确目标完成全部尝试仍未形成可达证据时，才移出 pendingTargets 并发布红色。
          pendingTargets.delete(targetKey);
          ports.onStatusChange(target, MEDIA_REACHABILITY_STATUS.unavailable);
        }
      }

      // 循环类型: Array.from + Promise.all；作用: 建立本轮最多 workerCount 个独立探测 worker，并等待整轮完成后再开始失败集合重试。
      await Promise.all(Array.from({ length: workerCount }, () => processNextTarget()));
      // 条件分支: 本轮完成后当前代次已经失效时进入；执行内容: 返回取消终态，不提交新一代之外的结果。
      if (!isCurrent()) return MEDIA_REACHABILITY_QUEUE_RESULT.cancelled;
      // 类型: Array<Readonly<object>>；作用: 保持本轮原始顺序，只携带失败目标进入下一轮。
      roundTargets = currentRoundTargets.filter((target, targetIndex) => retryFlags[targetIndex]);
    }

    // 条件分支: 当前计划仍拥有活动门禁时进入；执行内容: 清除空闲引用，后续计划必须创建新门禁。
    if (activeMediaOriginAdmissionGate === mediaOriginAdmissionGate) {
      activeMediaOriginAdmissionGate = null;
    }
    return MEDIA_REACHABILITY_QUEUE_RESULT.completed;
  }

  /**
   * 永久释放协调器。
   * 副作用: 标记 disposed 并取消当前队列；后续 start 只返回 cancelled。
   *
   * @returns {Promise<void>} 当前候选释放屏障。
   */
  function dispose() {
    disposed = true;
    return cancel();
  }

  return Object.freeze({ start, cancel, dispose });
}
