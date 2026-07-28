/*
  sourceChallengeCoordinator.js 模块说明

  - 文件职责:
      协调所有 Provider 的人工挑战请求，维护一个活动挑战和 FIFO 等待队列。
      分离 Shell 请求端口与页面交互端口，不让任一侧获得另一侧的生命周期引用。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      SOURCE_CHALLENGE_STATUS: 自定义 Shell 配置，提供 resolved、cancelled 和 unsupported 稳定状态。
      SourceShellValidationError: 自定义 Shell 错误，拒绝重复挑战和错误交互身份。
      assertAbortSignal、normalizeSourceChallengeValues: 自定义 Shell 验证器，校验 Host signal 和用户输入。

  - 模块级常量:
      CHALLENGE_RESULT_MESSAGE: object，三种结果状态对应的稳定说明。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createChallengeResult(challengeId, status, values): Function，创建冻结精确结果。
      createChallengeKey(challenge): Function，形成跨源隔离的挑战事务键。

  - 模块级类:
      无

  - 对外导出:
      createSourceChallengeCoordinator(): Function，创建隔离请求端口、交互端口和统一释放入口。
*/

// 导入来源: ../source-shell/source-shell.config.js。
// 导入内容: SOURCE_CHALLENGE_STATUS 挑战结果状态枚举。
// 文件作用: 协调器只返回正式协议允许的三种结果。
import { SOURCE_CHALLENGE_STATUS } from '../source-shell/source-shell.config.js';

// 导入来源: ../source-shell/sourceShellErrors.js。
// 导入内容: SourceShellValidationError Shell 输入错误。
// 文件作用: 对重复身份、错误 challengeId 和已释放交互返回稳定 validation。
import { SourceShellValidationError } from '../source-shell/sourceShellErrors.js';

import {
  // 导入来源: ../source-shell/sourceShellValidators.js。
  // 导入内容: assertAbortSignal Host 生命周期信号校验。
  // 文件作用: 请求入队前拒绝普通对象伪装的取消状态。
  assertAbortSignal,

  // 导入来源: ../source-shell/sourceShellValidators.js。
  // 导入内容: normalizeSourceChallengeValues 用户输入规范化函数。
  // 文件作用: resolved 结果只采用挑战声明过的字符串字段。
  normalizeSourceChallengeValues
} from '../source-shell/sourceShellValidators.js';

// 类型: object。
// 作用: 集中维护结果说明；Provider 必须按 status 分支，不能解析这些文案。
const CHALLENGE_RESULT_MESSAGE = Object.freeze({
  resolved: '用户已提交验证信息',
  cancelled: '当前挑战已取消',
  unsupported: '当前没有可用的验证交互'
});

/**
 * 创建精确冻结的挑战结果。
 * 纯函数: 不修改 values，只把已经规范化的对象放入结果。
 * 成功路径: 返回四字段 SourceChallengeResult。
 * 失败路径: status 和 values 只由协调器内部调用，不接受外部直接构造。
 *
 * @param {string} challengeId 当前挑战关联标识。
 * @param {string} status 正式挑战结果状态。
 * @param {object} values resolved 的规范化输入，其他状态为空对象。
 * @returns {object} 冻结 SourceChallengeResult。
 */
function createChallengeResult(challengeId, status, values = Object.freeze({})) {
  return Object.freeze({
    status,
    challengeId,
    values,
    message: CHALLENGE_RESULT_MESSAGE[status]
  });
}

/**
 * 创建跨源唯一挑战事务键。
 * 纯函数: 只读取已规范化 challenge 的 sourceId 和 challengeId。
 * 成功路径: 不同数据源使用相同 challengeId 时仍得到不同键。
 * 失败路径: 输入已由 SourceChallengePort 校验，当前函数不提供兼容默认值。
 *
 * @param {object} challenge 标准 SourceChallenge。
 * @returns {string} 当前协调器生命周期内的事务键。
 */
function createChallengeKey(challenge) {
  return `${challenge.sourceId}\u0000${challenge.challengeId}`;
}

/**
 * 创建全局人工挑战协调器。
 * 副作用: 在当前实例内维护监听器、一个活动项、FIFO 队列和每项 AbortSignal 监听器。
 * 并发规则: 请求按入队顺序逐个发布；不同 sourceId 不共享输入，重复事务键稳定拒绝。
 * 资源清理: 每项完成时移除 abort 监听器；最后一个 UI 订阅取消或 dispose 时取消全部在途项。
 *
 * @returns {object} 冻结协调器端口集合。
 * @returns {object} return.requestPort 只供 SourceChallengePort 调用的请求端口。
 * @returns {object} return.interactionPort 只供页面 service 使用的订阅、提交和取消端口。
 * @returns {Function} return.dispose 取消全部请求并永久释放当前协调器。
 */
export function createSourceChallengeCoordinator() {
  // 类型: Set<Function>。
  // 作用: 保存根级交互消费者；通常只有 SourceChallengeDialog 一个订阅者。
  const listeners = new Set();
  // 类型: Array<object>。
  // 作用: 保存尚未发布的挑战项；数组顺序就是用户看到挑战的固定 FIFO 顺序。
  const queue = [];
  // 类型: Map<string, object>。
  // 作用: 按跨源事务键阻止活动项或排队项重复入队。
  const entriesByKey = new Map();

  // 类型: object|null。
  // 初始值: null 表示当前没有正在展示的挑战。
  // 修改入口: promoteNext 设置，settleEntry 清空。
  // 作用: 保证页面同一时刻只处理一个挑战。
  let activeEntry = null;
  // 类型: boolean。
  // 作用: 保存协调器永久释放状态，阻止释放后重新订阅或入队。
  // true 表示 dispose 已执行，后续请求返回 unsupported 且交互写操作拒绝。
  // false 表示协调器仍可接受订阅和挑战请求。
  let disposed = false;

  /**
   * 向全部交互订阅者发布当前挑战快照。
   * 副作用: 同步调用当前监听器；某个监听器抛错不会阻断其他监听器或挑战事务。
   * 成功路径: 活动项存在时发布其冻结 challenge，否则发布 null 关闭弹窗。
   * 失败路径: 监听器错误被隔离，协调器不把页面渲染错误冒充 Provider 结果。
   *
   * @returns {void}
   */
  function publish() {
    // 类型: object|null。
    // 作用: 只向页面暴露标准挑战，不暴露 resolve、signal 或队列项。
    const snapshot = activeEntry ? activeEntry.challenge : null;

    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        // 异常来源: 页面订阅者在采用挑战快照时失败。
        // 处理策略: 隔离失败并继续通知其他订阅者，事务由用户取消、Host 中止或 UI 卸载收敛。
      }
    });
  }

  /**
   * 把 FIFO 队首提升为活动挑战。
   * 副作用: 修改 activeEntry 并向页面发布；没有等待项时发布 null。
   * 成功路径: 只有 activeEntry 为空时消费一个队首。
   * 失败路径: 已有活动项时保持原状态，避免两个挑战同时展示。
   *
   * @returns {void}
   */
  function promoteNext() {
    // 条件分支: 当前仍有活动挑战时进入。
    // 执行内容: 保持单活动项规则，不提前移动 FIFO。
    if (activeEntry) return;

    // 副作用: 取出等待时间最长的第一项；空队列返回 undefined 并规范为 null。
    activeEntry = queue.shift() || null;
    publish();
  }

  /**
   * 完成一个活动或等待中的挑战项。
   * 副作用: 移除索引与 abort 监听器、更新队列或活动项，并兑现原 Provider Promise。
   * 成功路径: 每项只完成一次；活动项完成后自动提升下一项。
   * 失败路径: 已经完成的项被忽略，避免重复 resolve 或重复推进队列。
   *
   * @param {object} entry 协调器私有挑战项。
   * @param {object} result 冻结 SourceChallengeResult。
   * @returns {void}
   */
  function settleEntry(entry, result) {
    // 条件分支: 事务键已经从索引移除时进入。
    // 执行内容: 忽略迟到的 abort、取消或提交事件。
    if (!entriesByKey.has(entry.key)) return;

    entriesByKey.delete(entry.key);
    entry.signal.removeEventListener('abort', entry.abortListener);

    // 条件分支: 当前完成项就是页面正在处理的活动项。
    // 执行内容: 清空活动引用；否则只从等待队列移除目标项。
    if (activeEntry === entry) {
      activeEntry = null;
    } else {
      // 类型: number。
      // 作用: 定位尚在 FIFO 中的等待项；可能已经由前一个分支移除。
      const queueIndex = queue.indexOf(entry);
      // 条件分支: 目标项仍在等待队列中时进入。
      // 执行内容: 只删除目标项并保持其他挑战相对顺序。
      if (queueIndex >= 0) queue.splice(queueIndex, 1);
    }

    // 副作用: 兑现 SourceChallengePort 正在等待的原 Promise，不创建第二条恢复通道。
    entry.resolve(result);
    promoteNext();
  }

  /**
   * 取消协调器当前持有的全部挑战。
   * 副作用: 每项返回 cancelled，移除全部 AbortSignal 监听器并清空 UI。
   * 顺序规则: 复制当前索引后逐项完成，避免 settleEntry 修改迭代集合。
   *
   * @returns {void}
   */
  function cancelAll() {
    // 类型: Array<object>。
    // 作用: 复制当前事务快照，避免 settleEntry 删除 Map 时破坏遍历。
    const entries = Array.from(entriesByKey.values());
    entries.forEach((entry) => {
      settleEntry(entry, createChallengeResult(
        entry.challenge.challengeId,
        SOURCE_CHALLENGE_STATUS.cancelled
      ));
    });
  }

  // 类型: object。
  // 作用: 请求端只暴露 request，不允许 Shell 订阅页面状态或提交用户输入。
  const requestPort = Object.freeze({
    /**
     * 把标准挑战加入全局 FIFO 并等待交互结果。
     * 副作用: 注册一次 AbortSignal 监听器、写入私有索引与队列，并可能发布给页面。
     * 成功路径: 用户提交返回 resolved；取消或中止返回 cancelled；没有交互消费者返回 unsupported。
     * 失败路径: 重复 sourceId + challengeId 抛 validation，不覆盖原事务。
     *
     * @param {object} challenge 已由 SourceChallengePort 规范化的挑战。
     * @param {AbortSignal} signal 当前 Host 生命周期信号。
     * @returns {Promise<object>} 原事务最终 SourceChallengeResult。
     */
    async request(challenge, signal) {
      // 类型: AbortSignal。
      // 作用: 保存已验证的 Host 生命周期原引用，供入队监听和取消判断。
      const safeSignal = assertAbortSignal(signal, 'sourceChallengeCoordinator.signal');

      // 条件分支: 协调器已释放或当前没有页面交互消费者时进入。
      // 执行内容: 立即返回 unsupported，避免 Provider Promise 永久挂起。
      if (disposed || listeners.size === 0) {
        return createChallengeResult(
          challenge.challengeId,
          SOURCE_CHALLENGE_STATUS.unsupported
        );
      }

      // 条件分支: Host 在入队前已经中止时进入。
      // 执行内容: 直接返回 cancelled，不注册无意义监听器。
      if (safeSignal.aborted) {
        return createChallengeResult(
          challenge.challengeId,
          SOURCE_CHALLENGE_STATUS.cancelled
        );
      }

      // 条件分支: 挑战声明了到期时间且当前已经过期时进入。
      // 执行内容: 返回 cancelled，不展示无法采用的表单。
      if (challenge.expiresAt && Date.parse(challenge.expiresAt) <= Date.now()) {
        return createChallengeResult(
          challenge.challengeId,
          SOURCE_CHALLENGE_STATUS.cancelled
        );
      }

      // 类型: string。
      // 作用: 按 sourceId 和 challengeId 形成当前事务唯一索引。
      const key = createChallengeKey(challenge);
      // 条件分支: 相同跨源事务键已经活动或排队时进入。
      // 执行内容: 拒绝覆盖原 Promise、signal 和页面输入。
      if (entriesByKey.has(key)) {
        throw new SourceShellValidationError('相同 sourceId 和 challengeId 的挑战已经在处理中');
      }

      return new Promise((resolve) => {
        // 类型: object。
        // 作用: 保存协调器私有事务引用；页面快照不包含 resolve、signal 或 abortListener。
        const entry = {
          key,
          challenge,
          signal: safeSignal,
          resolve,
          abortListener: null
        };

        // 类型: Function。
        // 作用: Host 中止时只取消当前事务，不影响其他数据源的活动项或队列项。
        entry.abortListener = () => settleEntry(entry, createChallengeResult(
          challenge.challengeId,
          SOURCE_CHALLENGE_STATUS.cancelled
        ));

        entriesByKey.set(key, entry);
        safeSignal.addEventListener('abort', entry.abortListener, { once: true });
        queue.push(entry);
        promoteNext();
      });
    }
  });

  // 类型: object。
  // 作用: 页面交互端只暴露订阅、提交和取消，不允许构造挑战或读取队列。
  const interactionPort = Object.freeze({
    /**
     * 订阅当前活动挑战。
     * 副作用: 注册同步监听器并立即发布当前快照；返回幂等取消函数。
     * 资源清理: 最后一个订阅取消时全部在途挑战返回 cancelled。
     *
     * @param {Function} listener 接收 SourceChallenge 或 null 的页面监听器。
     * @returns {Function} 只移除当前 listener 的幂等取消函数。
     */
    subscribe(listener) {
      // 条件分支: 协调器已释放或 listener 不是函数时进入。
      // 执行内容: 拒绝建立不可清理的无效订阅。
      if (disposed || typeof listener !== 'function') {
        throw new SourceShellValidationError('挑战交互订阅无效');
      }

      listeners.add(listener);
      listener(activeEntry ? activeEntry.challenge : null);
      // 类型: boolean。
      // 作用: 记录当前取消句柄是否仍有效，保证重复取消幂等。
      let subscribed = true;

      return () => {
        // 条件分支: 当前订阅已经取消时进入。
        // 执行内容: 不重复删除监听器或再次取消其他挑战。
        if (!subscribed) return;
        subscribed = false;
        listeners.delete(listener);
        // 条件分支: 当前取消后已经没有任何交互消费者时进入。
        // 执行内容: 取消全部在途挑战，避免 Provider Promise 永久等待。
        if (listeners.size === 0) cancelAll();
      };
    },

    /**
     * 提交当前活动挑战的用户输入。
     * 副作用: 校验 values 后兑现原 Provider Promise，并发布下一项。
     * 成功路径: challengeId 与活动项一致且输入合法时返回 resolved 结果。
     * 失败路径: 无活动项、身份不一致、已过期或值非法时抛 validation 或取消原事务。
     *
     * @param {string} challengeId 页面正在展示的挑战标识。
     * @param {object} values 页面表单字符串值。
     * @returns {object} 已提交的冻结 resolved 结果。
     */
    resolve(challengeId, values) {
      // 条件分支: 协调器释放、没有活动项或页面身份不匹配时进入。
      // 执行内容: 拒绝迟到提交影响另一个挑战。
      if (disposed || !activeEntry || activeEntry.challenge.challengeId !== challengeId) {
        throw new SourceShellValidationError('当前挑战身份不一致或已经结束');
      }

      // 条件分支: 用户提交时挑战已经过期。
      // 执行内容: 原事务收敛为 cancelled，迟到输入不能恢复 Provider 请求。
      if (activeEntry.challenge.expiresAt
        && Date.parse(activeEntry.challenge.expiresAt) <= Date.now()) {
        // 类型: object。
        // 作用: 捕获过期活动项，避免 settle 后读取已经推进的下一项。
        const expiredEntry = activeEntry;
        // 类型: object。
        // 作用: 保存过期事务返回给 Provider 和当前调用方的同一个 cancelled 结果。
        const cancelled = createChallengeResult(
          expiredEntry.challenge.challengeId,
          SOURCE_CHALLENGE_STATUS.cancelled
        );
        settleEntry(expiredEntry, cancelled);
        return cancelled;
      }

      // 类型: object。
      // 作用: 保存只含挑战声明字段的冻结字符串输入。
      const normalizedValues = normalizeSourceChallengeValues(
        values,
        activeEntry.challenge.fields
      );
      // 类型: object。
      // 作用: 捕获提交对应活动项，避免推进队列后错误关联下一项。
      const resolvedEntry = activeEntry;
      // 类型: object。
      // 作用: 保存最终 resolved 结果，同时返回页面并兑现原 Provider Promise。
      const result = createChallengeResult(
        resolvedEntry.challenge.challengeId,
        SOURCE_CHALLENGE_STATUS.resolved,
        normalizedValues
      );
      settleEntry(resolvedEntry, result);
      return result;
    },

    /**
     * 取消当前活动挑战。
     * 副作用: 兑现原 Provider Promise 为 cancelled，并发布 FIFO 下一项。
     * 成功路径: challengeId 与活动项一致时返回 cancelled 结果。
     * 失败路径: 无活动项或身份不一致时抛 validation，不误取消另一请求。
     *
     * @param {string} challengeId 页面正在展示的挑战标识。
     * @returns {object} 冻结 cancelled 结果。
     */
    cancel(challengeId) {
      // 条件分支: 协调器释放、没有活动项或页面身份不匹配时进入。
      // 执行内容: 拒绝迟到取消影响另一个挑战。
      if (disposed || !activeEntry || activeEntry.challenge.challengeId !== challengeId) {
        throw new SourceShellValidationError('当前挑战身份不一致或已经结束');
      }

      // 类型: object。
      // 作用: 捕获页面当前活动项，后续推进 FIFO 不改变取消对象。
      const cancelledEntry = activeEntry;
      // 类型: object。
      // 作用: 保存同时返回页面和原 Provider Promise 的 cancelled 结果。
      const result = createChallengeResult(
        cancelledEntry.challenge.challengeId,
        SOURCE_CHALLENGE_STATUS.cancelled
      );
      settleEntry(cancelledEntry, result);
      return result;
    }
  });

  return Object.freeze({
    requestPort,
    interactionPort,

    /**
     * 永久释放当前协调器。
     * 副作用: 标记 disposed、取消全部请求并清空监听器；重复调用无额外影响。
     * 完成后 request 返回 unsupported，交互写操作稳定拒绝。
     *
     * @returns {void}
     */
    dispose() {
      // 条件分支: 当前协调器已经释放时进入。
      // 执行内容: 保持重复 dispose 幂等，不再次发布或取消。
      if (disposed) return;
      disposed = true;
      cancelAll();
      listeners.clear();
    }
  });
}
