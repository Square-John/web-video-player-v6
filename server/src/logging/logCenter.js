/*
  logCenter.js 模块说明

  - 文件职责:
      创建后端唯一日志事件管线，统一生成事件、分发 sink、按需调度代理运行汇总并在关闭时排空。
      日志中心不理解 Provider、源站响应或文件轮转；sink 故障不能改变调用方业务结果。

  - 导入库及文件汇总(4 条，内置 2 条，第三方 0 条，自定义 2 条):
      node:timers#setTimeout、clearTimeout: 只在首个代理完成事件后调度一个汇总窗口。
      ../../../scripts/startup/configContracts.mjs#APPLICATION_LOG_LEVEL: 配置和日志中心共用的四个级别。
      ./logEvent.js#createLogEvent: 创建统一事件。
      ./logSummary.js#createLogSummaryCollector: 保存有限窗口计数并在 flush 后清零。

  - 模块级常量:
      MILLISECONDS_PER_SECOND: number，把配置秒转换为调度毫秒。
      PROXY_SUMMARY_EVENT: string，周期汇总固定事件名。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createLogCenter(options): 创建统一日志生命周期端口。

  - 模块级类:
      无

  - 对外导出:
      createLogCenter: function，后端组合根和测试使用的日志中心工厂；返回内部 sink 故障报告端口。
*/

// 导入来源: node:timers；导入内容: setTimeout、clearTimeout；文件作用: 只在存在代理请求时安排一次有限汇总，不创建空周期轮询。
import { setTimeout as scheduleTimer, clearTimeout as cancelTimer } from 'node:timers';
// 导入来源: ../../../scripts/startup/configContracts.mjs；导入内容: APPLICATION_LOG_LEVEL；文件作用: 公开日志方法采用根配置契约唯一级别枚举。
import { APPLICATION_LOG_LEVEL } from '../../../scripts/startup/configContracts.mjs';
// 导入来源: ./logEvent.js；导入内容: createLogEvent；文件作用: 所有公开级别方法进入同一事件创建边界。
import { createLogEvent } from './logEvent.js';
// 导入来源: ./logSummary.js；导入内容: createLogSummaryCollector；文件作用: 有界统计代理完成事件并在输出后清零。
import { createLogSummaryCollector } from './logSummary.js';

// 单位: 毫秒/秒；作用: 配置保持人类可读秒，调度端口接收明确毫秒。
const MILLISECONDS_PER_SECOND = 1000;

// 类型: string；作用: 终端和文件 sink 使用固定名称识别有限运行汇总。
const PROXY_SUMMARY_EVENT = 'proxy.runtime.summary';

/**
 * 创建后端统一日志中心。
 * 调用方: 后端启动组合根和日志领域测试。
 * 状态所有权: 持有 sink 列表、一个有限汇总器、至多一个调度句柄和关闭状态。
 * 状态释放: close 取消未触发调度、输出非空汇总、逆序等待 sink.close 并永久关闭中心，保证文件故障先由仍开启的 console 接收。
 * 失败路径: 配置或 sink 形状非法时同步抛 TypeError；运行 sink.write/close 失败被隔离，不覆盖业务结果。
 *
 * @param {object} options 日志中心依赖。
 * @param {ReadonlyArray<{write: Function, close?: Function}>} options.sinks 统一事件输出端。
 * @param {number} options.summaryIntervalSeconds 非空请求汇总窗口秒数。
 * @param {Function} [options.now] 返回 Date 或 ISO 字符串的时钟端口。
 * @param {Function} [options.schedule] 单次调度端口。
 * @param {Function} [options.cancel] 取消调度端口。
 * @returns {Readonly<object>} debug/info/warn/error、flushSummary 和 close 生命周期端口。
 * @throws {TypeError} 配置或依赖形状无效时抛出。
 */
export function createLogCenter({
  sinks,
  summaryIntervalSeconds,
  now = () => new Date(),
  schedule = scheduleTimer,
  cancel = cancelTimer
}) {
  if (!Array.isArray(sinks)
    || sinks.length === 0
    || sinks.some((sink) => typeof sink?.write !== 'function')
    || !Number.isSafeInteger(summaryIntervalSeconds)
    || summaryIntervalSeconds <= 0
    || typeof now !== 'function'
    || typeof schedule !== 'function'
    || typeof cancel !== 'function') {
    throw new TypeError('createLogCenter 需要 sink、正整数汇总周期、时钟和调度端口');
  }

  // 类型: ReadonlyArray<object>；作用: 隔离调用方数组修改，sink 生命周期仍由组合根拥有并由 close 结束。
  const outputs = Object.freeze([...sinks]);
  // 类型: object；生命周期: 当前日志中心；作用: 仅保存一个时间窗口的有限代理统计。
  const summary = createLogSummaryCollector();
  // 类型: number；作用: 配置秒转换为单次调度毫秒，当前中心生命周期保持不变。
  const summaryIntervalMs = summaryIntervalSeconds * MILLISECONDS_PER_SECOND;
  // 类型: unknown；生命周期: 当前活动汇总窗口；作用: 保证同一窗口至多存在一个调度任务。
  let summaryTimer = null;
  // 类型: boolean；生命周期: 当前中心；作用: close 开始后拒绝外部继续创建普通事件。
  let closing = false;
  // 类型: boolean；生命周期: 当前中心；作用: 全部 sink 关闭后标记生命周期终态。
  let closed = false;
  // 类型: Promise<void>|null；生命周期: 首次 close 至完成；作用: 并发或重复关闭共用同一排空任务。
  let closeTask = null;

  /**
   * 向全部 sink 分发一个统一事件。
   * 调用方: emit 和 flushSummary。
   * 副作用: 顺序调用每个 sink.write；单个 sink 异常被隔离，其他 sink 继续收到同一事件。
   * 失败路径: sink 异常被吸收，不递归记录，具体 sink 负责一次性故障状态。
   *
   * @param {Readonly<object>} event 统一冻结事件。
   * @returns {void} 分发结果不进入业务返回值。
   */
  function dispatch(event) {
    for (const sink of outputs) {
      try {
        sink.write(event);
      } catch {
        // 日志边界: sink 必须自有故障状态；中心只隔离异常，不能让日志覆盖代理结果或递归产生日志风暴。
      }
    }
  }

  /**
   * 输出并清零当前非空代理汇总。
   * 调用方: 汇总调度回调、公开 flushSummary 和 close。
   * 副作用: 生成一个 info 事件并分发，空窗口不输出。
   * 成功路径: 非空返回事件，空窗口返回 null。
   * 失败路径: 事件创建错误向显式调用方抛出；调度回调输入均来自内部有限计数。
   *
   * @returns {Readonly<object>|null} 已输出汇总事件或 null。
   */
  function flushSummary() {
    const fields = summary.take();
    if (fields === null) return null;
    const event = createLogEvent({ timestamp: now(), level: APPLICATION_LOG_LEVEL.info, event: PROXY_SUMMARY_EVENT, fields });
    dispatch(event);
    return event;
  }

  /**
   * 为当前非空汇总窗口安排唯一一次输出。
   * 调用方: emit 在首个可汇总代理事件后调用。
   * 副作用: 创建一个 Node 定时器；回调触发后先清除句柄再 flush，不自动空轮询。
   * 失败路径: 已关闭或已有计时器时无操作；调度端口异常向 emit 调用方抛出。
   *
   * @returns {void} 调度状态保存在当前中心。
   */
  function scheduleSummary() {
    if (closed || summaryTimer !== null) return;
    summaryTimer = schedule(() => {
      summaryTimer = null;
      flushSummary();
    }, summaryIntervalMs);
    if (typeof summaryTimer?.unref === 'function') {
      // 进程生命周期: 仅有汇总定时器时不阻止 Node 正常退出；close 仍会显式排空非空窗口。
      summaryTimer.unref();
    }
  }

  /**
   * 创建、分发并按需汇总一个事件。
   * 调用方: 四个公开级别方法。
   * 副作用: 调用时钟、分发 sink；标准代理完成事件更新有限汇总并安排一个窗口。
   * 成功路径: 返回已分发冻结事件。
   * 失败路径: 中心已关闭或事件输入非法时抛 Error/TypeError。
   *
   * @param {string} level 冻结日志级别。
   * @param {string} eventName 点分段事件名称。
   * @param {object} [fields={}] JSON 安全事件字段。
   * @returns {Readonly<object>} 已创建统一事件。
   */
  function emit(level, eventName, fields = {}) {
    if (closing || closed) throw new Error('日志中心已经关闭');
    const event = createLogEvent({ timestamp: now(), level, event: eventName, fields });
    dispatch(event);
    if (summary.add(event)) scheduleSummary();
    return event;
  }

  /**
   * 在日志中心关闭排空期间报告一次 sink 自有故障。
   * 调用方: 后端组合根交给文件 sink 的 onFailure 回调。
   * 副作用: 创建 error 事件并分发给仍启用的 sink；故障文件 sink 已先停用，不会递归写入。
   * 成功路径: 正常运行或 closing 阶段返回已分发事件；全部 sink 已关闭时返回 null。
   * 失败路径: 事件输入非法时抛 TypeError，由文件 sink 回调边界吸收，不能改变代理或关闭结果。
   *
   * @param {string} eventName 稳定小写点分段故障事件名。
   * @param {object} [fields={}] 不含 Error、路径或敏感值的有限故障字段。
   * @returns {Readonly<object>|null} 已分发统一 error 事件，或关闭完成后的 null。
   */
  function reportSinkFailure(eventName, fields = {}) {
    if (closed) return null;
    const event = createLogEvent({
      timestamp: now(),
      level: APPLICATION_LOG_LEVEL.error,
      event: eventName,
      fields
    });
    dispatch(event);
    return event;
  }

  /**
   * 排空汇总并关闭全部 sink。
   * 调用方: 后端进程关闭生命周期和测试清理。
   * 副作用: 取消定时器、输出最后非空汇总并顺序等待 sink.close；重复调用返回同一关闭结果语义。
   * 失败路径: 单个 sink.close reject 被隔离，剩余 sink 继续关闭。
   *
   * @returns {Promise<void>} 全部可关闭 sink 处理完成后结束。
   */
  function close() {
    if (closeTask !== null) return closeTask;
    closing = true;
    closeTask = (async () => {
      if (summaryTimer !== null) {
        cancel(summaryTimer);
        summaryTimer = null;
      }
      flushSummary();
      // 关闭顺序: 文件等后加入 sink 先排空，故障事件仍可由最后关闭的 console 输出。
      for (const sink of [...outputs].reverse()) {
        if (typeof sink.close === 'function') {
          try {
            await sink.close();
          } catch {
            // 关闭边界: 继续关闭后续 sink；启动组合根仍可完成网络资源释放。
          }
        }
      }
      closed = true;
    })();
    return closeTask;
  }

  return Object.freeze({
    debug: (eventName, fields) => emit(APPLICATION_LOG_LEVEL.debug, eventName, fields),
    info: (eventName, fields) => emit(APPLICATION_LOG_LEVEL.info, eventName, fields),
    warn: (eventName, fields) => emit(APPLICATION_LOG_LEVEL.warn, eventName, fields),
    error: (eventName, fields) => emit(APPLICATION_LOG_LEVEL.error, eventName, fields),
    reportSinkFailure,
    flushSummary,
    close,
    isClosed: () => closed
  });
}
