/*
  logSummary.js 模块说明

  - 文件职责:
      在一个有限时间窗口内汇总代理完成事件，并在取出时清零全部计数。
      本模块不保存请求对象、标识、地址、跳转、正文或事件历史，只维护固定计数和有限错误码桶。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      PROXY_COMPLETED_EVENT: string，允许进入汇总的标准事件名。
      MAXIMUM_REGULAR_ERROR_BUCKETS: number，具体错误码桶的固定容量。
      OVERFLOW_ERROR_BUCKET: string，超过容量后的统一桶名。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createLogSummaryCollector(): 创建 add/take 有限汇总端口。

  - 模块级类:
      无

  - 对外导出:
      createLogSummaryCollector: function，日志中心使用的周期汇总器。
*/

// 类型: string；作用: 只有完整代理事务事件进入请求汇总，启动和日志故障不污染请求统计。
const PROXY_COMPLETED_EVENT = 'proxy.request.completed';

// 单位: 个；作用: 为具体错误码保留 15 个桶，最后一个容量由 OTHER 统一承接溢出错误。
const MAXIMUM_REGULAR_ERROR_BUCKETS = 15;

// 类型: string；作用: 超过固定错误桶容量后合并计数，不保留新的自由文本键。
const OVERFLOW_ERROR_BUCKET = 'OTHER';

/**
 * 创建有限代理运行汇总器。
 * 调用方: createLogCenter。
 * 状态所有权: 只保存当前窗口计数、耗时、容量和最多 16 个错误码计数。
 * 状态释放: take 生成隔离快照后同步清零；空窗口返回 null。
 * 失败路径: 非标准或形状不完整的事件返回 false，不推断和修补事件。
 *
 * @returns {Readonly<{ add: Function, take: Function, hasEntries: Function }>} 冻结汇总端口。
 */
export function createLogSummaryCollector() {
  let requestCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let totalDurationMs = 0;
  let maximumDurationMs = 0;
  let totalReceivedBytes = 0;
  // 类型: Map<string, number>；生命周期: 当前窗口；作用: 只保存有限稳定错误码及其计数。
  const errorCounts = new Map();

  /**
   * 累加一个代理完成事件。
   * 调用方: logCenter.emit。
   * 副作用: 标准成功/失败事件更新当前窗口固定计数。
   * 成功路径: 合法代理完成事件返回 true；其他事件或无效结果返回 false。
   *
   * @param {Readonly<object>} event 统一日志事件。
   * @returns {boolean} 当前事件是否进入汇总。
   */
  function add(event) {
    if (event?.event !== PROXY_COMPLETED_EVENT
      || !['success', 'failure'].includes(event.outcome)
      || !Number.isFinite(event.durationMs)
      || event.durationMs < 0) {
      return false;
    }

    requestCount += 1;
    totalDurationMs += event.durationMs;
    maximumDurationMs = Math.max(maximumDurationMs, event.durationMs);
    if (event.outcome === 'success') successCount += 1;
    if (event.outcome === 'failure') failureCount += 1;
    if (Number.isFinite(event.receivedBytes) && event.receivedBytes >= 0) {
      totalReceivedBytes += event.receivedBytes;
    }

    if (event.outcome === 'failure' && typeof event.errorCode === 'string' && event.errorCode.length > 0) {
      // 类型: string；作用: 已登记错误码保留，达到容量后新错误码统一进入 OTHER。
      const bucket = errorCounts.has(event.errorCode) || errorCounts.size < MAXIMUM_REGULAR_ERROR_BUCKETS
        ? event.errorCode
        : OVERFLOW_ERROR_BUCKET;
      errorCounts.set(bucket, (errorCounts.get(bucket) ?? 0) + 1);
    }
    return true;
  }

  /**
   * 取出当前窗口汇总并同步清零。
   * 调用方: 日志中心定时回调、显式 flush 和 close。
   * 副作用: 非空窗口全部计数恢复初始值，错误 Map 清空。
   * 成功路径: 返回冻结汇总字段；空窗口返回 null 且不产生日志。
   *
   * @returns {Readonly<object>|null} 当前窗口汇总或 null。
   */
  function take() {
    if (requestCount === 0) return null;
    // 类型: Readonly<object>；作用: 在清零前生成按错误码排序的隔离稳定快照。
    const summary = Object.freeze({
      requestCount,
      successCount,
      failureCount,
      averageDurationMs: Math.round(totalDurationMs / requestCount),
      maximumDurationMs: Math.round(maximumDurationMs),
      totalReceivedBytes,
      errorCounts: Object.freeze(Object.fromEntries([...errorCounts.entries()].sort(([left], [right]) => left.localeCompare(right))))
    });

    requestCount = 0;
    successCount = 0;
    failureCount = 0;
    totalDurationMs = 0;
    maximumDurationMs = 0;
    totalReceivedBytes = 0;
    errorCounts.clear();
    return summary;
  }

  return Object.freeze({ add, take, hasEntries: () => requestCount > 0 });
}
