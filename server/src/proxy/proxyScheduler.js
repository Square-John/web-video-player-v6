/*
  proxyScheduler.js 模块说明

  - 文件职责:
      为后端无状态代理提供全局并发、目标域名并发和速率准入调度。
      调度器只保存当前进程的等待任务、活动计数和速率窗口，不保存请求正文、Cookie、Token、Provider 状态或 DNS 结果。
      供 ProxyExecutor 在安全协议校验后、DNS 和上游连接前调用；不解析目标业务，也不改变代理响应。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      requestAdmissionGate: 自定义准入门禁，提供全局活动计数和固定窗口速率限制。
      proxyError: 自定义代理错误，用于统一表达取消和准入拒绝。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeDestinationDomain(value): 规范化当前事务的目标域名分组键。
      createProxyScheduler(options): 创建可取消的公平准入调度器。

  - 模块级类:
      无

  - 对外导出:
      createProxyScheduler: function，创建 ProxyExecutor 使用的异步准入端口。
*/

// 导入来源: ./requestAdmissionGate.js；导入内容: createRequestAdmissionGate；文件作用: 复用全局并发和速率窗口的稳定计数实现。
import { createRequestAdmissionGate } from './requestAdmissionGate.js';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 为排队取消和准入拒绝返回固定错误码。
import { ProxyError } from '../errors/proxyError.js';

/**
 * 规范化目标域名分组键。
 * 调用方: createProxyScheduler 内部 acquire。
 * 纯函数: 只读取字符串并转为小写，不执行 DNS、不访问网络，也不保存域名以外的请求事实。
 * 失败路径: 空值或包含空白的值返回空字符串，由调度器拒绝非法分组。
 *
 * @param {*} value 已通过 URL 校验的目标域名。
 * @returns {string} 小写域名分组键或空字符串。
 */
function normalizeDestinationDomain(value) {
  if (typeof value !== 'string') return '';
  const domain = value.trim().toLowerCase();
  return domain && !/\s/u.test(domain) ? domain : '';
}

/**
 * 创建代理请求有界调度器。
 * 调用方: createProxyExecutor 和后端代理调度回归测试。
 * 状态所有权: queue、activeByDomain 和 scheduler 状态只属于当前 ProxyExecutor 进程。
 * 副作用: acquire 可能等待；获得释放端口后，调用方必须在最外层 finally 执行 release。
 * 成功路径: 目标域名和全局额度可用时返回释放函数；额度不足时按提交顺序公平唤醒可执行任务。
 * 失败路径: 排队信号中止时移除等待任务；固定窗口速率耗尽时拒绝当前批次，不创建隐性定时器或静默重试。
 *
 * @param {object} options 调度器配置。
 * @param {number} options.maximumConcurrentRequests 当前进程全局并发上限。
 * @param {number} options.maximumConcurrentRequestsPerDestinationDomain 单个目标域名并发上限。
 * @param {number} options.maximumRequestsPerMinute 当前进程每分钟准入上限。
 * @param {Function} [options.now] 单调时钟端口，供速率门禁和测试使用。
 * @returns {Readonly<{ acquire: Function }>} 异步 acquire 端口。
 * @throws {TypeError} 配置或时钟不满足边界时抛出。
 */
export function createProxyScheduler({
  maximumConcurrentRequests,
  maximumConcurrentRequestsPerDestinationDomain,
  maximumRequestsPerMinute,
  now
}) {
  if (!Number.isSafeInteger(maximumConcurrentRequestsPerDestinationDomain)
    || maximumConcurrentRequestsPerDestinationDomain <= 0) {
    throw new TypeError('createProxyScheduler 需要有效目标域名并发上限');
  }

  // 类型: Readonly<object>；作用: 复用已有全局并发和速率门禁，避免产生第二套窗口计数。
  const admissionGate = createRequestAdmissionGate({
    maximumConcurrentRequests,
    maximumRequestsPerMinute,
    now
  });
  // 类型: Array<object>；生命周期: 当前进程；作用: 保存等待准入的最小控制对象，不保存请求正文和请求身份。
  const queue = [];
  // 类型: number；生命周期: 当前进程；作用: 在调用旧门禁前判断全局槽位是否可用，使并发满载任务保持排队。
  let activeRequestCount = 0;
  // 类型: Map<string, number>；生命周期: 当前进程；作用: 统计每个目标域名当前已占用的上游事务槽位。
  const activeByDomain = new Map();
  // 类型: boolean；作用: 防止 drain 在同一同步调用栈重入。
  let draining = false;

   /**
   * 创建当前调度器的固定准入错误。
   * 调用方: cancelQueuedTask、drain 和 acquire。
   * 纯函数: 只构造错误对象，不修改队列或计数。
   * 失败路径: ProxyError 构造失败时保留原异常并阻断当前调度流程。
   *
   * @param {string} code 固定代理错误码。
   * @returns {ProxyError} 可交给 ProxyExecutor 统一转换的代理错误。
   */
  function createAdmissionError(code) {
    return new ProxyError(code);
  }

   /**
   * 读取目标域名当前活动数量。
   * 调用方: changeActiveDomainCount 和 drain。
   * 纯函数: 只读取 activeByDomain。
   * 失败路径: Map 未登记目标域名时返回零，不抛出异常。
   *
   * @param {string} destinationDomain 规范域名分组键。
   * @returns {number} 当前域名活动数，未出现时为零。
   */
  function getActiveDomainCount(destinationDomain) {
    return activeByDomain.get(destinationDomain) ?? 0;
  }

   /**
   * 修改目标域名活动计数。
   * 调用方: drain 生成和释放目标域名租约时调用。
   * 副作用: 只更新当前调度器的内存计数；计数归零时移除 Map 键。
   * 失败路径: delta 使计数低于零时抛内部错误，阻止静默泄漏。
   *
   * @param {string} destinationDomain 规范域名分组键。
   * @param {number} delta 本次加一或减一变化。
   * @returns {void} 无返回业务对象。
   */
  function changeActiveDomainCount(destinationDomain, delta) {
    const nextCount = getActiveDomainCount(destinationDomain) + delta;
    if (nextCount < 0) throw new Error('代理目标域名活动计数不能为负数');
    if (nextCount === 0) {
      activeByDomain.delete(destinationDomain);
      return;
    }
    activeByDomain.set(destinationDomain, nextCount);
  }

   /**
   * 取消一个仍在等待的任务。
   * 调用方: acquire 为排队任务注册的 AbortSignal 监听器。
   * 副作用: 从 queue 移除任务并以 PROXY_REQUEST_ABORTED 兑现 reject；已获得准入的任务不经过此函数。
   * 失败路径: 任务已离开队列时直接返回，避免重复 reject 或修改活动计数。
   *
   * @param {object} task 当前等待任务。
   * @returns {void} 任务已经取消或不在队列时无操作。
   */
  function cancelQueuedTask(task) {
    const index = queue.indexOf(task);
    if (index < 0) return;
    queue.splice(index, 1);
    task.signal.removeEventListener('abort', task.abortListener);
    task.reject(createAdmissionError('PROXY_REQUEST_ABORTED'));
    drain();
  }

   /**
   * 尝试从等待队列中公平唤醒可以执行的任务。
   * 调用方: acquire 入队、cancelQueuedTask 取消以及活动事务 release。
   * 副作用: 任务获得全局和域名槽位后兑现 release；速率耗尽时拒绝当前等待批次。
   * 成功路径: 每轮只启动已经满足两个并发边界的任务，优先保留队列中较早且域名可用的任务。
   * 失败路径: 全局速率窗口没有额度时拒绝当前所有等待任务，不安装定时器、不静默等待窗口。
   *
   * @returns {void} 当前同步调度轮结束后返回。
   */
  function drain() {
    if (draining) return;
    draining = true;
    try {
      let startedTask = true;
      while (startedTask
        && queue.length > 0
        && activeRequestCount < maximumConcurrentRequests) {
        startedTask = false;
        for (let index = 0; index < queue.length; index += 1) {
          const task = queue[index];
          if (getActiveDomainCount(task.destinationDomain)
            >= maximumConcurrentRequestsPerDestinationDomain) continue;
          queue.splice(index, 1);
          task.signal.removeEventListener('abort', task.abortListener);
          let releaseGlobal;
          try {
            releaseGlobal = admissionGate.enter();
          } catch (error) {
            task.reject(error);
            while (queue.length > 0) {
              const remainingTask = queue.shift();
              remainingTask.signal.removeEventListener('abort', remainingTask.abortListener);
              remainingTask.reject(createAdmissionError('PROXY_RATE_LIMITED'));
            }
            return;
          }
          // 状态变化: 旧门禁已经确认全局并发与速率额度，本调度器同步登记全局活动数以决定后续任务是否等待。
          activeRequestCount += 1;
          changeActiveDomainCount(task.destinationDomain, 1);
          let released = false;
          task.resolve(() => {
            if (released) return;
            released = true;
            releaseGlobal();
            activeRequestCount -= 1;
            changeActiveDomainCount(task.destinationDomain, -1);
            drain();
          });
          startedTask = true;
          break;
        }
      }
    } finally {
      draining = false;
    }
  }

   /**
   * 请求一个目标域名的代理准入。
   * 调用方: ProxyExecutor 在 DNS 和上游连接前调用。
   * 副作用: 活动资源不足时进入内存队列；不会访问 DNS、上游或 Provider。
   * 成功路径: 返回当前事务必须调用的幂等 release。
   * 失败路径: signal 已中止或排队期间中止时抛 PROXY_REQUEST_ABORTED；速率窗口耗尽时抛 PROXY_RATE_LIMITED。
   *
   * @param {object} options 请求准入参数。
   * @param {string} options.destinationDomain 已通过 URL 校验的目标域名。
   * @param {AbortSignal} options.signal 当前客户端与事务超时组合信号。
   * @returns {Promise<Function>} 当前事务的异步 release 端口。
   * @throws {ProxyError} 参数非法、请求中止或速率额度耗尽时抛出。
   */
  function acquire({ destinationDomain, signal } = {}) {
    const normalizedDomain = normalizeDestinationDomain(destinationDomain);
    if (!normalizedDomain || !signal || typeof signal.addEventListener !== 'function') {
      return Promise.reject(new TypeError('代理准入需要目标域名和 AbortSignal'));
    }
    if (signal.aborted) return Promise.reject(createAdmissionError('PROXY_REQUEST_ABORTED'));

    return new Promise((resolve, reject) => {
      const task = {
        destinationDomain: normalizedDomain,
        signal,
        resolve,
        reject,
        abortListener: null
      };
      task.abortListener = () => cancelQueuedTask(task);
      signal.addEventListener('abort', task.abortListener, { once: true });
      queue.push(task);
      drain();
    });
  }

  return Object.freeze({ acquire });
}
