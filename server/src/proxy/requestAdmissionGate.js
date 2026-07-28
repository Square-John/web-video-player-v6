/*
  requestAdmissionGate.js 模块说明

  - 文件职责:
      为代理执行事务提供无等待并发和每分钟速率准入，达到部署上限时立即拒绝而不是排队占用资源。
      供单个 Fastify 应用的 ProxyExecutor 共享；只保存运行控制计数，不保存请求标识、用户、Provider 或业务状态。

  - 导入库及文件汇总(2 条，内置 1 条，第三方 0 条，自定义 1 条):
      node:perf_hooks#performance: 使用单调时钟划分速率窗口，避免系统时间回拨改变配额。
      ../errors/proxyError.js#ProxyError: 将并发或速率超限映射为冻结 PROXY_RATE_LIMITED。

  - 模块级常量:
      RATE_WINDOW_MS: number，固定一分钟单调速率窗口长度。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createRequestAdmissionGate(options): 创建应用级运行控制门禁。

  - 模块级类:
      无

  - 对外导出:
      createRequestAdmissionGate: function，createProxyExecutor 创建并共享准入端口。
*/

// 导入来源: node:perf_hooks；导入内容: performance；文件作用: 使用不受系统时间调整影响的单调毫秒时钟。
import { performance } from 'node:perf_hooks';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 用固定错误码表达无等待准入失败。
import { ProxyError } from '../errors/proxyError.js';

// 单位: 毫秒；来源: rateLimitRequestsPerMinute 字段单位；作用: 定义固定一分钟运行控制窗口，不由请求覆盖。
const RATE_WINDOW_MS = 60000;

/**
 * 创建一个应用级无等待请求准入门禁。
 * 调用方: createProxyExecutor。
 * 状态所有权: activeRequests、windowStartedAt 和 acceptedInWindow 只属于当前应用执行器；不记录请求身份。
 * 状态释放: 每个成功 enter 必须在代理事务 finally 调用幂等 release；速率窗口按单调时间惰性重置。
 * 失败路径: 参数非法同步抛 TypeError；并发或速率达到上限时 enter 抛 PROXY_RATE_LIMITED。
 *
 * @param {object} options 门禁配置。
 * @param {number} options.maximumConcurrentRequests 当前部署并发上限。
 * @param {number} options.maximumRequestsPerMinute 当前部署每分钟接受上限。
 * @param {Function} [options.now=performance.now] 返回单调毫秒值的时钟端口。
 * @returns {Readonly<{ enter: Function }>} 具有 enter 方法的冻结门禁。
 * @throws {TypeError} 上限或时钟不满足边界时抛出。
 */
export function createRequestAdmissionGate({
  maximumConcurrentRequests,
  maximumRequestsPerMinute,
  now = performance.now.bind(performance)
}) {
  if (
    !Number.isSafeInteger(maximumConcurrentRequests)
    || maximumConcurrentRequests <= 0
    || !Number.isSafeInteger(maximumRequestsPerMinute)
    || maximumRequestsPerMinute <= 0
    || typeof now !== 'function'
  ) {
    throw new TypeError('createRequestAdmissionGate 需要有效并发、速率上限和时钟');
  }

  // 类型: number；生命周期: 当前应用；作用: 统计已准入且尚未 release 的网络事务。
  let activeRequests = 0;
  // 类型: number；生命周期: 当前速率窗口；来源: 单调时钟；作用: 判断一分钟窗口何时惰性重置。
  let windowStartedAt = now();
  // 类型: number；生命周期: 当前速率窗口；作用: 统计已经准入的事务，不因其后成功或失败回退。
  let acceptedInWindow = 0;

  /**
   * 尝试准入一个代理事务并返回幂等释放函数。
   * 调用方: proxyExecutor 每个请求的最外层事务。
   * 副作用: 成功时递增速率与活跃计数；release 只递减一次活跃计数。
   * 成功路径: 当前并发和速率均低于上限时立即返回 release，不产生等待。
   * 失败路径: 任一上限已满立即抛 PROXY_RATE_LIMITED，计数不发生部分修改。
   *
   * @returns {Function} 当前事务完成时调用的幂等 release。
   * @throws {ProxyError} 当前应用没有可用准入额度时抛出。
   */
  function enter() {
    // 类型: number；来源: 注入单调时钟；作用: 只在请求到达时判断窗口，不创建定时器。
    const currentTime = now();

    // 状态变化: 窗口到期时同时重置起点和已接受数；活跃请求属于独立并发维度，不随窗口清零。
    if (currentTime - windowStartedAt >= RATE_WINDOW_MS) {
      windowStartedAt = currentTime;
      acceptedInWindow = 0;
    }

    if (activeRequests >= maximumConcurrentRequests || acceptedInWindow >= maximumRequestsPerMinute) {
      throw new ProxyError('PROXY_RATE_LIMITED');
    }

    activeRequests += 1;
    acceptedInWindow += 1;
    // 类型: boolean；生命周期: 当前事务 release 闭包；作用: 防止多条 finally 路径重复递减活跃计数。
    let released = false;

    /**
     * 释放当前事务占用的并发额度。
     * 调用方: proxyExecutor finally。
     * 副作用: 首次调用将 activeRequests 减一；后续调用无操作，速率计数不会回退。
     * 失败路径: 无；闭包只由成功 enter 创建，活跃计数不会降至负数。
     *
     * @returns {void} 无返回值。
     */
    return function release() {
      if (released) {
        return;
      }

      released = true;
      activeRequests -= 1;
    };
  }

  return Object.freeze({ enter });
}
