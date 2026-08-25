/*
  mediaReachabilitySessionService.js 模块说明

  - 文件职责:
      为详情页与播放页提供按 sourceId + contentId 复用的唯一媒体可达性会话。
      会话只保存当前应用内存中的线路/分集三态、订阅者、探测代次和协调器在途事实；不保存 ContentItem、不写 Store、不写 Router、不写用户内容。
      详情页取得目录后可以启动双通道探测；播放页进入同一内容时只订阅和复用，避免两页各自探测造成重复请求和状态漂移。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      mediaReachabilityService: 自定义纯协调器和目标计划服务，提供统一探测队列、精确身份和三态结果。
      mediaPlayback.config: 自定义配置，提供页面和共享会话共用的三态枚举。

  - 模块级常量:
      MEDIA_REACHABILITY_SESSION_PHASE: Readonly<object>，共享会话阶段枚举。

  - 模块级变量:
      sessionsByKey: Map<string, object>，当前应用内按内容身份保存的共享会话注册表。

  - 模块级辅助函数:
      normalizeIdentity(value): string，清理会话身份。
      createSessionKey(sourceId, contentId): string，生成共享会话键。
      cloneReachabilityState(state): object，创建响应式消费者安全快照。
      createMediaReachabilitySession(sourceId, contentId): object，创建单内容会话。

  - 模块级类:
      无

  - 对外导出:
      acquireMediaReachabilitySession: Function，获取同一内容的共享会话租约。
      clearInactiveMediaReachabilitySessions: Function，内容切换时清理无订阅旧会话。
      MEDIA_REACHABILITY_SESSION_PHASE: Readonly<object>，共享会话阶段枚举。
*/

// 导入来源: ./mediaReachabilityService.js。
// 导入内容: createMediaReachabilityCoordinator、createMediaReachabilityKey、MEDIA_REACHABILITY_PROBE_RESULT。
// 文件作用: 复用既有探测队列、精确身份去重和内部失败分类，不复制并发或重试策略。
import {
  createMediaReachabilityCoordinator,
  createMediaReachabilityKey,
  MEDIA_REACHABILITY_PLAN_LANE,
  MEDIA_REACHABILITY_PROBE_RESULT
} from './mediaReachabilityService.js';

// 导入来源: ../config/mediaPlayback.config.js。
// 导入内容: MEDIA_REACHABILITY_STATUS 三态枚举。
// 文件作用: 共享会话只发布统一 checking/available/unavailable 状态。
import { MEDIA_REACHABILITY_STATUS } from '../config/mediaPlayback.config.js';

// 类型: Readonly<object>；作用: 限定共享探测会话的生命周期，不把页面加载或播放器阶段混入媒体三态。
export const MEDIA_REACHABILITY_SESSION_PHASE = Object.freeze({
  idle: 'idle',
  running: 'running',
  completed: 'completed',
  cancelled: 'cancelled'
});

// 类型: Map<string, object>；生命周期: 当前前端应用进程；作用: 按同一 sourceId/contentId 复用内存会话，内容切换时由清理端口回收无订阅旧会话。
const sessionsByKey = new Map();

/**
 * 清理共享会话身份文本。
 * 纯函数: 只接受字符串并去除首尾空白，不访问路由、Store 或 Provider。
 * 失败路径: 非字符串返回空字符串，调用方拒绝创建会话。
 *
 * @param {*} value 会话身份候选。
 * @returns {string} 可比较身份文本或空字符串。
 */
function normalizeIdentity(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 生成共享媒体可达会话键。
 * 纯函数: 用 JSON 数组编码两段身份，避免 sourceId/contentId 中的分隔符产生碰撞。
 *
 * @param {string} sourceId 数据源身份。
 * @param {string} contentId 内容身份。
 * @returns {string} 稳定会话键。
 */
function createSessionKey(sourceId, contentId) {
  return JSON.stringify([sourceId, contentId]);
}

/**
 * 规范共享会话接收的双通道计划。
 * 纯函数: 只保留属于当前 sourceId + contentId 的精确目标，分集通道优先取得重复目标所有权。
 * 失败路径: 非对象或非数组通道按空计划处理；非法四段身份由精确键校验抛出。
 *
 * @param {*} probePlan 双通道计划候选。
 * @param {string} sourceId 当前共享会话数据源身份。
 * @param {string} contentId 当前共享会话内容身份。
 * @returns {Readonly<object>} 已隔离、去重且冻结的会话计划。
 */
function normalizeSessionProbePlan(probePlan, sourceId, contentId) {
  // 类型: Set<string>；作用: 分集通道优先登记精确键，线路通道不能重复请求同一四段身份。
  const seenKeys = new Set();
  /**
   * 规范一个会话通道。
   * 纯函数: 返回冻结新数组，不修改调用方目标集合。
   *
   * @param {*} targets 当前通道目标候选。
   * @returns {ReadonlyArray<object>} 当前内容且跨通道唯一的目标。
   */
  function normalizeLane(targets) {
    // 类型: Array<object>；作用: 保存当前通道属于本内容且尚未跨通道重复的目标。
    const normalizedTargets = [];
    (Array.isArray(targets) ? targets : []).forEach((target) => {
      // 条件分支: 目标不属于当前共享内容时进入；执行内容: 阻止跨内容计划污染状态。
      if (target?.sourceId !== sourceId || target?.contentId !== contentId) return;
      // 类型: string；作用: 同时验证四段身份并生成跨通道去重键。
      const targetKey = createMediaReachabilityKey(target);
      // 条件分支: 当前精确目标已经由前序或分集通道登记时进入；执行内容: 跳过重复请求。
      if (seenKeys.has(targetKey)) return;
      seenKeys.add(targetKey);
      normalizedTargets.push(target);
    });
    return Object.freeze(normalizedTargets);
  }

  return Object.freeze({
    [MEDIA_REACHABILITY_PLAN_LANE.episodes]: normalizeLane(
      probePlan?.[MEDIA_REACHABILITY_PLAN_LANE.episodes]
    ),
    [MEDIA_REACHABILITY_PLAN_LANE.lines]: normalizeLane(
      probePlan?.[MEDIA_REACHABILITY_PLAN_LANE.lines]
    )
  });
}

/**
 * 创建双通道计划签名。
 * 纯函数: 按通道、目标顺序、四段身份和线路代表职责编码；不读取状态或网络。
 *
 * @param {Readonly<object>} probePlan 已规范双通道计划。
 * @returns {string} 可比较计划签名。
 */
function createSessionProbePlanSignature(probePlan) {
  // 类型: Array<string>；作用: 固定分集通道和线路通道顺序，避免对象键顺序影响签名。
  const lanes = [
    MEDIA_REACHABILITY_PLAN_LANE.episodes,
    MEDIA_REACHABILITY_PLAN_LANE.lines
  ];
  return JSON.stringify(lanes.map(lane => probePlan[lane].map(target => [
    createMediaReachabilityKey(target),
    target.representsLine === true
  ])));
}

/**
 * 复制共享可达性状态。
 * 纯函数: 只创建深度足够的快照，不把会话内部对象引用交给页面。
 *
 * @param {object} state 会话内部状态。
 * @returns {object} 页面可消费的线路和分集三态快照。
 */
function cloneReachabilityState(state) {
  // 类型: object；作用: 深拷贝每条线路的分集状态，避免把会话内部嵌套对象交给页面。
  const episodeReachabilityStatuses = Object.fromEntries(
    Object.entries(state.episodeReachabilityStatuses).map(([lineId, statuses]) => [lineId, { ...statuses }])
  );
  return {
    lineReachabilityStatuses: { ...state.lineReachabilityStatuses },
    episodeReachabilityStatuses
  };
}

/**
 * 创建一个 sourceId + contentId 唯一的共享探测会话。
 * 副作用: 创建仅存在于当前模块内存的状态和单个协调器；不触发网络、不写持久化。
 * 成功路径: 页面可以通过租约订阅快照、交付探测端口并启动一份计划。
 * 失败路径: 身份缺失时抛出，阻止无主会话和跨内容状态污染。
 *
 * @param {string} sourceId 数据源身份。
 * @param {string} contentId 内容身份。
 * @returns {object} 共享会话内部端口。
 */
function createMediaReachabilitySession(sourceId, contentId) {
  // 类型: string；作用: 保存当前会话稳定键，供返回端口和订阅者身份使用。
  const sessionKey = createSessionKey(sourceId, contentId);
  // 类型: object；作用: 保存不含 ContentItem 的共享线路和分集三态事实。
  const state = {
    lineReachabilityStatuses: {},
    episodeReachabilityStatuses: {}
  };
  // 类型: Map<string, object>；作用: 保存当前详情/播放页面的状态回调和探测端口。
  const subscribers = new Map();
  // 类型: number；作用: 为当前会话内每个页面租约生成单调订阅者身份。
  let nextSubscriberId = 0;
  // 类型: number；作用: 标识共享探测计划代次，拒绝迟到状态进入当前会话。
  let generation = 0;
  // 类型: string；作用: 保存当前共享探测生命周期阶段。
  let phase = MEDIA_REACHABILITY_SESSION_PHASE.idle;
  // 类型: object|null；作用: 保存当前唯一在途计划，详情和播放重复进入时共享它。
  let activePlan = null;
  // 类型: object|null；作用: 保存当前最晚附着页面的真实媒体探测宿主。
  let currentProbePort = null;

  /**
   * 向全部订阅者发送当前共享会话快照。
   * 副作用: 只调用页面提供的内存回调，不保存回调以外的页面对象。
   * 失败路径: 单个页面回调抛错时记录诊断并继续通知其它订阅者。
   *
   * @returns {void} 当前快照已广播。
  */
  function notifySubscribers() {
    // 类型: Readonly<object>；作用: 生成当前共享会话的隔离快照，供全部订阅者消费。
    const snapshot = getSnapshot();
    subscribers.forEach((subscriber) => {
      try {
        subscriber.onStateChange(snapshot);
      } catch (error) {
        console.error('媒体可达共享状态订阅回调失败', error);
      }
    });
  }

  /**
   * 读取共享会话快照。
   * 纯函数: 只复制会话身份、阶段、代次和三态投影，不暴露协调器或订阅者。
   *
   * @returns {Readonly<object>} 页面隔离快照。
   */
  function getSnapshot() {
    return Object.freeze({
      sourceId,
      contentId,
      generation,
      phase,
      ...cloneReachabilityState(state)
    });
  }

  /**
   * 采用一个精确探测目标状态。
   * 副作用: 更新共享线路/分集状态并通知详情与播放订阅者。
   * 失败路径: 目标身份不属于当前会话或状态非法时忽略迟到结果。
   *
   * @param {object} target 精确媒体探测目标。
   * @param {string} status 统一三态。
   * @param {object} plan 当前计划身份。
   * @returns {void} 合法状态已进入共享快照。
   */
function applyStatus(target, status, plan) {
    // 条件分支: 计划已失效或状态不在统一三态中时进入；执行内容: 丢弃迟到或非法状态。
    if ((plan && activePlan !== plan) || !Object.values(MEDIA_REACHABILITY_STATUS).includes(status)) return;
    // 条件分支: 目标不属于当前共享内容时进入；执行内容: 阻止跨内容探测污染当前状态。
    if (!target || target.sourceId !== sourceId || target.contentId !== contentId) return;
    // 类型: string；作用: 保存当前目标的稳定线路身份。
    const lineId = normalizeIdentity(target.lineId);
    // 类型: string；作用: 保存当前目标的稳定逻辑分集身份。
    const episodeId = normalizeIdentity(target.episodeId);
    // 条件分支: 线路或分集身份缺失时进入；执行内容: 不构造无法定位的共享状态。
    if (!lineId || !episodeId) return;
    state.episodeReachabilityStatuses[lineId] = {
      ...(state.episodeReachabilityStatuses[lineId] || {}),
      [episodeId]: status
    };
    // 条件分支: 当前目标承担线路代表职责时进入；执行内容: 同步更新线路级三态。
    if (target.representsLine === true) {
      state.lineReachabilityStatuses[lineId] = status;
    }
    notifySubscribers();
  }

  /**
   * 清理被取消目标中仍为 checking 的状态。
   * 副作用: 只撤销当前共享会话的蓝色等待态，已完成红绿事实继续保留。
   *
   * @param {Array<object>} targets 被取消的精确目标。
   * @returns {void} checking 状态已清理。
   */
function clearChecking(targets) {
    // 类型: boolean；作用: 标记本次清理是否实际删除了共享蓝色等待态。
    let changed = false;
    (Array.isArray(targets) ? targets : []).forEach((target) => {
      // 条件分支: 目标不属于当前共享内容时进入；执行内容: 忽略迟到取消目标。
      if (!target || target.sourceId !== sourceId || target.contentId !== contentId) return;
      // 类型: string；作用: 保存当前取消目标的稳定线路身份。
      const lineId = normalizeIdentity(target.lineId);
      // 类型: string；作用: 保存当前取消目标的稳定分集身份。
      const episodeId = normalizeIdentity(target.episodeId);
      // 类型: object|undefined；作用: 读取当前线路的精确分集状态表。
      const episodeStatuses = state.episodeReachabilityStatuses[lineId];
      // 条件分支: 当前分集仍是 checking 时进入；执行内容: 删除未完成的蓝色状态。
      if (episodeStatuses?.[episodeId] === MEDIA_REACHABILITY_STATUS.checking) {
        delete episodeStatuses[episodeId];
        changed = true;
      }
      // 条件分支: 当前目标是线路代表且线路仍是 checking 时进入；执行内容: 删除线路级蓝色状态。
      if (target.representsLine === true
        && state.lineReachabilityStatuses[lineId] === MEDIA_REACHABILITY_STATUS.checking) {
        delete state.lineReachabilityStatuses[lineId];
        changed = true;
      }
    });
    // 条件分支: 至少有一个 checking 状态被删除时进入；执行内容: 广播撤销后的共享快照。
    if (changed) notifySubscribers();
  }

  /**
   * 读取当前最晚附着页面提供的探测端口。
   * 纯函数: 只读取订阅者注册顺序，详情销毁后可切换到播放页的真实宿主。
   *
   * @returns {object|null} 当前可用的探测和释放端口。
   */
function resolveProbePort() {
    // 条件分支: 已有当前宿主时进入；执行内容: 继续使用最新页面交付的真实资源端口。
    if (currentProbePort) return currentProbePort;
    // 类型: Array<object>；作用: 按附着顺序倒序收集可能提供探测能力的页面租约。
    const candidates = [...subscribers.values()].reverse();
    return candidates.find(subscriber => typeof subscriber.probeTarget === 'function') || null;
  }

  /**
   * 处理协调器请求的媒体目标探测。
   * 副作用: 委托当前仍挂载页面的真实探测宿主，不创建第二个播放器或 Provider 通道。
   * 失败路径: 没有活动宿主时返回 inconclusive，目标由协调器按既有轮次处理。
   *
   * @param {object} target 精确媒体探测目标。
   * @param {object} probeContext 协调器代次和媒体 Origin 端口。
   * @param {object} plan 当前共享计划及其实际宿主集合。
   * @returns {Promise<string>} 内部探测结果。
   */
  function probeTarget(target, probeContext, plan) {
    // 类型: object|null；作用: 读取当前可执行探测的页面宿主端口。
    const port = resolveProbePort();
    // 条件分支: 当前没有可用页面宿主时进入；执行内容: 返回不可判定并让协调器执行既定重试。
    if (!port) return Promise.resolve(MEDIA_REACHABILITY_PROBE_RESULT.inconclusive);
    // 资源所有权: 记录本代次实际使用的页面宿主；取消必须逐一释放，不能只依赖届时最新附着页面。
    plan.usedProbePorts.add(port);
    return port.probeTarget(target, probeContext);
  }

  /**
   * 处理协调器取消时的资源屏障。
   * 副作用: 先清理共享 checking，再委托当前页面释放已挂载的隐藏播放器。
   *
   * @param {Array<object>} targets 未完成探测目标。
   * @param {object} plan 当前共享计划及其实际资源宿主集合。
    * 成功路径: 当前页面资源释放端口完成后返回。
    * 失败路径: 页面资源释放端口拒绝时向共享协调器传播，禁止假装已清理。
    *
    * @returns {Promise<void>} 资源释放完成后兑现。
   */
 async function handleCancellation(targets, plan) {
    clearChecking(targets);
    // 类型: Array<object>；作用: 冻结本代次所有实际资源宿主，页面切换或最后租约释放都不能丢失旧宿主。
    const usedProbePorts = [...plan.usedProbePorts];
    // 资源屏障: 同一计划可能先后使用详情和播放宿主，必须等待所有宿主释放各自隐藏播放器。
    await Promise.all(usedProbePorts.map(port => port.onCancel(targets)));
    plan.usedProbePorts.clear();
  }

  /**
   * 判断精确目标是否已经拥有红绿终态。
   * 纯函数: 只读取共享状态，不从目录 available/playable 推断绿色。
   *
   * @param {object} target 精确媒体探测目标。
   * @returns {boolean} 当前目标及其线路代表状态均已收敛时返回 true。
   */
function isTerminalTarget(target) {
    // 类型: string|undefined；作用: 读取目标精确分集的最近共享终态。
    const episodeStatus = state.episodeReachabilityStatuses[target.lineId]?.[target.episodeId];
    // 类型: string；作用: 代表目标读取线路终态，非代表目标使用精确分集终态以外的默认满足条件。
    const lineStatus = target.representsLine === true
      ? state.lineReachabilityStatuses[target.lineId]
      : MEDIA_REACHABILITY_STATUS.available;
    return [episodeStatus, lineStatus].every(status => (
      status === MEDIA_REACHABILITY_STATUS.available
      || status === MEDIA_REACHABILITY_STATUS.unavailable
    ));
  }

  /**
   * 启动或复用一份共享探测计划。
   * 副作用: 只在当前会话没有在途计划时创建唯一协调器；全部目标先进入 checking，再由三轮有界队列收敛。
   * 成功路径: 同一内容的详情和播放重复调用时复用同一个 Promise，不重复请求。
   * 失败路径: 无可探测目标直接收敛 completed；协调器异常由调用方观察并保持安全状态。
   *
   * @param {object} probePlan 由详情或播放纯计划服务生成的双通道目标。
   * @returns {Promise<string>} 共享计划完成或取消结果。
   */
  function ensurePlan(probePlan) {
    // 类型: Readonly<object>；作用: 在比较或启动前把调用方计划收敛到当前内容双通道边界。
    const normalizedPlan = normalizeSessionProbePlan(probePlan, sourceId, contentId);
    // 类型: string；作用: 同一浏览线路和目录目标复用在途 Promise，切线或目录变化触发新代次。
    const planSignature = createSessionProbePlanSignature(normalizedPlan);
    // 类型: object|null；作用: 捕获当前在途计划，判断复用或等待取消收敛。
    const existingPlan = activePlan;
    // 条件分支: 当前计划已经进入取消屏障时进入；执行内容: 等待旧协调器完全收敛后再创建新计划，避免播放页复用已取消 Promise。
    if (existingPlan?.cancellationPromise) {
      return existingPlan.promise.then(() => ensurePlan(normalizedPlan));
    }
    // 条件分支: 当前计划仍在运行且签名完全一致时进入；执行内容: 详情和播放复用同一个在途 Promise。
    if (existingPlan?.signature === planSignature) return existingPlan.promise;
    // 条件分支: 当前运行计划与新浏览线路或目录计划不同；执行内容: 先取消并等待旧资源/Promise 收敛，再按新签名重排未完成目标。
    if (existingPlan) {
      return cancel()
        .then(() => existingPlan.promise)
        .then(() => ensurePlan(normalizedPlan));
    }
    // 类型: Readonly<object>；作用: 两个通道分别过滤已有红绿终态，切线不重新请求已完成目标。
    const unfinishedPlan = Object.freeze({
      [MEDIA_REACHABILITY_PLAN_LANE.episodes]: Object.freeze(
        normalizedPlan[MEDIA_REACHABILITY_PLAN_LANE.episodes]
          .filter(target => !isTerminalTarget(target))
      ),
      [MEDIA_REACHABILITY_PLAN_LANE.lines]: Object.freeze(
        normalizedPlan[MEDIA_REACHABILITY_PLAN_LANE.lines]
          .filter(target => !isTerminalTarget(target))
      )
    });
    // 类型: number；作用: 汇总两个通道未完成数量，零目标时不创建协调器。
    const unfinishedTargetCount = unfinishedPlan[MEDIA_REACHABILITY_PLAN_LANE.episodes].length
      + unfinishedPlan[MEDIA_REACHABILITY_PLAN_LANE.lines].length;
    // 条件分支: 当前没有未完成目标时进入；执行内容: 直接发布 completed，不创建网络协调器。
    if (unfinishedTargetCount === 0) {
      phase = MEDIA_REACHABILITY_SESSION_PHASE.completed;
      notifySubscribers();
      return Promise.resolve('completed');
    }

    generation += 1;
    phase = MEDIA_REACHABILITY_SESSION_PHASE.running;
    // 类型: object；作用: 保存当前唯一计划的取消标记、协调器和 Promise。
    const plan = {
      // 类型: Promise<void>|null；生命周期: 当前计划；作用: 标记取消已经开始，后续消费者必须等待旧资源屏障后重新规划。
      cancellationPromise: null,
      // 类型: string；生命周期: 当前计划；作用: 相同双通道目标复用在途 Promise，切线或目录变化不会错误复用旧计划。
      signature: planSignature,
      // 类型: Set<object>；生命周期: 当前计划；作用: 保存实际执行过隐藏探测的页面宿主，取消时逐一完成资源释放。
      usedProbePorts: new Set()
    };
    // 类型: object；作用: 保存当前共享计划唯一使用的有界并发协调器。
    const coordinator = createMediaReachabilityCoordinator({
      /**
       * 使用当前计划记录资源宿主后执行精确媒体探测。
       * 副作用: 可能把当前页面宿主加入 usedProbePorts，并调用其 Provider/播放器端口。
       * 成功路径: 返回标准媒体探测内部结果。
       * 失败路径: 没有宿主时返回 inconclusive，端口异常交由协调器失败集合处理。
       *
       * @param {object} target 当前精确媒体目标。
       * @param {object} probeContext 当前协调器轮次上下文。
       * @returns {Promise<string>} 标准探测内部结果。
       */
      probeTarget: (target, probeContext) => probeTarget(target, probeContext, plan),
      /**
       * 共享状态端口。
       * 副作用: 把协调器三态交给当前会话快照。
       * @param {object} target 当前精确探测目标。
       * @param {string} status 当前目标三态。
       * @returns {void} 状态已经进入共享会话。
       */
      onStatusChange: (target, status) => applyStatus(target, status, plan),
      /**
       * 共享取消端口。
       * 副作用: 委托页面释放仍在途的隐藏媒体资源。
       * @param {Array<object>} targets 取消时仍未完成的目标。
       * @returns {Promise<void>} 资源释放屏障。
       */
      onCancel: targetsToClear => handleCancellation(targetsToClear, plan)
    });
    plan.coordinator = coordinator;
    plan.generation = generation;
    activePlan = plan;
    notifySubscribers();
    // 类型: Promise<string>；作用: 保存协调器启动结果，后续包装为共享计划 Promise。
    const operation = coordinator.start(unfinishedPlan);
    // 类型: Promise<string>；作用: 保存协调器当前计划结果，供详情和播放共同等待。
    plan.promise = operation.then((result) => {
      // 条件分支: 当前计划仍是共享会话活动计划时进入；执行内容: 采用完成阶段并释放活动引用。
      if (activePlan === plan) {
        activePlan = null;
        phase = result === 'completed'
          ? MEDIA_REACHABILITY_SESSION_PHASE.completed
          : MEDIA_REACHABILITY_SESSION_PHASE.cancelled;
        notifySubscribers();
      }
      return result;
    }, (error) => {
      // 条件分支: 当前计划仍是共享会话活动计划时进入；执行内容: 采用取消阶段并释放活动引用。
      if (activePlan === plan) {
        activePlan = null;
        phase = MEDIA_REACHABILITY_SESSION_PHASE.cancelled;
        notifySubscribers();
      }
      throw error;
    });
    return plan.promise;
  }

  /**
   * 取消当前共享探测计划。
   * 副作用: 使当前计划进入取消屏障；已完成状态保留，checking 等待释放后删除。
   *
   * @returns {Promise<string>} 取消后的队列结果。
   */
  function cancel() {
    // 类型: object|null；作用: 捕获当前活动计划，供幂等取消和 Promise 复用。
    const currentPlan = activePlan;
    // 条件分支: 当前没有活动计划时进入；执行内容: 返回幂等完成结果。
    if (!currentPlan) return Promise.resolve('completed');
    // 条件分支: 当前计划已经进入取消屏障时进入；执行内容: 复用同一取消 Promise，避免多个页面重复触发资源释放。
    if (currentPlan.cancellationPromise) return currentPlan.cancellationPromise;
    currentPlan.cancellationPromise = currentPlan.coordinator.cancel();
    return currentPlan.cancellationPromise;
  }

  /**
   * 附着一个详情或播放页面消费者。
   * 副作用: 注册状态订阅和当前真实探测宿主；返回租约释放端口。
   * 失败路径: 回调和探测端口不完整时抛出，阻止没有 UI 所有者的共享计划。
   *
   * @param {object} options 页面消费者端口。
   * @param {Function} options.onStateChange 共享快照变化回调。
   * @param {Function} options.probeTarget 真实媒体探测回调。
   * @param {Function} options.onCancel 真实隐藏媒体释放回调。
   * @returns {object} 页面租约端口。
   */
  function attach({ onStateChange, probeTarget: pageProbeTarget, onCancel } = {}) {
    // 条件分支: 任一页面端口缺失或类型不正确时进入；执行内容: 拒绝建立无 UI 所有者的租约。
    if (typeof onStateChange !== 'function'
      || typeof pageProbeTarget !== 'function'
      || typeof onCancel !== 'function') {
      throw new TypeError('媒体可达共享会话端口不完整');
    }
    // 类型: string；作用: 生成当前页面租约在共享会话内唯一的订阅身份。
    const subscriberId = `${sessionKey}:${nextSubscriberId += 1}`;
    // 类型: object；作用: 保存页面状态回调、真实探测端口和资源释放端口。
    const subscriber = { onStateChange, probeTarget: pageProbeTarget, onCancel };
    subscribers.set(subscriberId, subscriber);
    currentProbePort = subscriber;
    onStateChange(getSnapshot());
    // 类型: boolean；作用: 标记当前租约是否已释放，保证 release 幂等。
    let released = false;
    return Object.freeze({
      getSnapshot,
      ensurePlan,
      cancel,
      /**
       * 更新共享状态端口。
       * 副作用: 把正式播放 CANPLAY 或失败事实同步给详情和播放订阅者。
       * @param {object} target 正式媒体对应的精确目标。
       * @param {string} status 统一三态。
       * @returns {void} 状态已经发布。
       */
      updateStatus(target, status) {
        applyStatus(target, status, null);
      },
      /**
       * 释放当前页面租约。
       * 副作用: 删除页面订阅；最后一个订阅者离开时取消共享计划。
       * @returns {Promise<void>} 必要的资源取消屏障。
       */
      release() {
        // 条件分支: 当前租约已经释放时进入；执行内容: 保持幂等，不重复删除订阅或取消计划。
        if (released) return Promise.resolve();
        // 状态变化: 标记当前租约已经释放，后续调用只返回完成 Promise。
        released = true;
        // 副作用: 从共享会话中删除当前页面订阅。
        subscribers.delete(subscriberId);
        // 条件分支: 当前页面仍是探测宿主时进入；执行内容: 允许后续播放页面重新接管真实探测端口。
        if (currentProbePort === subscriber) currentProbePort = null;
        // 条件分支: 当前没有其它页面订阅者时进入；执行内容: 取消共享计划并等待资源屏障。
        if (subscribers.size === 0) return cancel().then(() => undefined);
        return Promise.resolve();
      }
    });
  }

  return Object.freeze({
    key: sessionKey,
    getSnapshot,
    attach,
    ensurePlan,
    cancel,
    /**
     * 查询当前会话是否仍有页面消费者。
     * 纯函数: 只读取订阅者数量，不修改计划或资源。
     * @returns {boolean} 存在至少一个页面租约时返回 true。
     */
    hasSubscribers: () => subscribers.size > 0
  });
}

/**
 * 清理无页面消费者的旧共享会话。
 * 副作用: 取消并释放非目标会话的在途计划，防止用户连续打开内容后内存和网络任务累积。
 * 成功路径: 所有无订阅旧会话完成取消后返回。
 * 失败路径: 任一旧会话资源释放失败时向调用方传播，保留失败证据。
 *
 * @param {string} keepKey 当前需要保留的会话键。
 * @returns {Promise<void>} 旧会话取消屏障完成后兑现。
 */
export async function clearInactiveMediaReachabilitySessions(keepKey = '') {
  // 类型: Array<Promise<*>>；作用: 收集所有无订阅旧会话的取消屏障。
  const operations = [];
  sessionsByKey.forEach((session, key) => {
    // 条件分支: 当前会话需要保留或仍有页面订阅者时进入；执行内容: 跳过本次清理。
    if (key === keepKey || session.hasSubscribers()) return;
    operations.push(session.cancel());
    sessionsByKey.delete(key);
  });
  await Promise.all(operations);
}

/**
 * 获取同一 sourceId + contentId 的共享媒体可达性租约。
 * 副作用: 必要时创建内存会话并清理无消费者旧会话；不访问网络或持久化。
 * 成功路径: 同一身份返回同一会话，详情与播放可通过租约订阅同一个快照和在途计划。
 * 失败路径: 身份不完整时抛出，禁止按活动源或上一内容猜测会话。
 *
 * @param {object} options 页面消费者和内容身份。
 * @param {string} options.sourceId 当前数据源身份。
 * @param {string} options.contentId 当前内容身份。
 * @param {Function} options.onStateChange 共享快照变化回调。
 * @param {Function} options.probeTarget 页面真实媒体探测回调。
 * @param {Function} options.onCancel 页面隐藏播放器释放回调。
 * @returns {Promise<object>} 页面共享会话租约。
 */
export async function acquireMediaReachabilitySession(options = {}) {
  // 类型: string；作用: 保存经严格清理的当前数据源身份。
  const sourceId = normalizeIdentity(options.sourceId);
  // 类型: string；作用: 保存经严格清理的当前内容身份。
  const contentId = normalizeIdentity(options.contentId);
  // 条件分支: 任一共享会话身份为空时进入；执行内容: 拒绝无身份租约。
  if (!sourceId || !contentId) throw new TypeError('媒体可达共享会话身份不完整');
  // 类型: string；作用: 生成当前内容的唯一共享会话键。
  const key = createSessionKey(sourceId, contentId);
  // 异步屏障: 清理其它无订阅内容会话，避免多个内容计划长期占用资源。
  await clearInactiveMediaReachabilitySessions(key);
  // 类型: object|undefined；作用: 读取当前内容已有会话或准备创建新会话。
  let session = sessionsByKey.get(key);
  // 条件分支: 当前内容尚无会话时进入；执行内容: 创建并登记唯一共享会话。
  if (!session) {
    session = createMediaReachabilitySession(sourceId, contentId);
    sessionsByKey.set(key, session);
  }
  return session.attach(options);
}
