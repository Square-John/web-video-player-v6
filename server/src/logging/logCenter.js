/*
  logCenter.js 模块说明

  - 文件职责:
      创建后端唯一日志事件管线，统一生成三分区事件、顺序分发 sink 并在关闭时排空。
      日志中心没有汇总器、计时器或平台分支；sink 故障不能改变调用方业务结果。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      ./logEvent.js#createLogEvent: 创建统一冻结事件。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      createLogCenter(options): 创建统一写入、sink 生命周期报告和关闭端口。

  - 模块级类:
      无

  - 对外导出:
      createLogCenter: 后端组合根和测试使用的日志中心工厂。
*/

// 导入来源: ./logEvent.js；导入内容: createLogEvent；文件作用: 所有生产者进入同一事件创建边界。
import { createLogEvent } from './logEvent.js';

/**
 * 创建后端统一日志中心。
 * 调用方: 后端启动组合根和日志领域测试。
 * 状态所有权: 持有 sink 列表、关闭状态和唯一关闭任务，不保存事件历史。
 * 状态释放: close 逆序等待 sink.close 并永久关闭中心，保证文件故障仍可由最后关闭的 console 接收。
 * 失败路径: sink 或时钟形状非法时同步抛 TypeError；运行 sink.write/close 失败被隔离。
 *
 * @param {object} options 日志中心依赖。
 * @param {ReadonlyArray<{write: Function, close?: Function}>} options.sinks 统一事件输出端。
 * @param {Function} [options.now] 返回 Date 或 ISO 字符串的时钟端口。
 * @returns {Readonly<object>} write、close 和 isClosed 生命周期端口。
 * @throws {TypeError} 配置或依赖形状无效时抛出。
 */
export function createLogCenter({ sinks, now = () => new Date() }) {
  if (!Array.isArray(sinks)
    || sinks.length === 0
    || sinks.some((sink) => typeof sink?.write !== 'function')
    || typeof now !== 'function') {
    throw new TypeError('createLogCenter 需要 sink 和时钟端口');
  }

  const outputs = Object.freeze([...sinks]);
  let closing = false;
  let closed = false;
  let closeTask = null;

  /**
   * 向全部 sink 分发同一个冻结事件。
   * 调用方: write。
   * 副作用: 顺序调用每个 sink.write；单个 sink 异常被隔离，其他 sink 继续收到同一对象。
   * 失败路径: sink 异常被吸收，具体 sink 负责自己的停用和一次性故障报告。
   *
   * @param {Readonly<object>} event 统一冻结事件。
   * @returns {void} 分发结果不进入业务返回值。
   */
  function dispatch(event) {
    for (const sink of outputs) {
      try {
        sink.write(event);
      } catch {
        // 日志边界: 单个输出故障不能改变代理响应，也不能递归创建未知事件。
      }
    }
  }

  /**
   * 创建并分发一个标准事件。
   * 调用方: 运行生命周期、代理审计、HTTP 拒绝和文件 sink 回调。
   * 副作用: 调用时钟并向全部 sink 分发一次同一事件对象。
   * 成功路径: 返回已深冻结和分发的事件。
   * 失败路径: 中心关闭或输入非法时抛 Error/TypeError。
   *
   * @param {object} input 不含 timestamp 的标准事件字段。
   * @returns {Readonly<object>} 已创建统一事件。
   */
  function write(input) {
    if (closing || closed) throw new Error('日志中心已经关闭');
    const event = createLogEvent({ timestamp: now(), ...input });
    dispatch(event);
    return event;
  }

  /**
   * 在关闭排空期间分发一个 sink 生命周期事件。
   * 调用方: backendLogger 连接的文件 sink 失败或轮转回调。
   * 副作用: 中心尚未 closed 时创建并分发同一标准事件；允许 closing 阶段把排空故障送到仍开启的 console。
   * 成功路径: 返回已分发事件；全部 sink 已关闭后返回 null。
   * 失败路径: 输入非法时抛 TypeError，由文件回调边界吸收。
   *
   * @param {object} input 不含 timestamp 的 logging 事件字段。
   * @returns {Readonly<object>|null} 已分发事件或关闭完成后的 null。
   */
  function reportSinkEvent(input) {
    if (closed) return null;
    const event = createLogEvent({ timestamp: now(), ...input });
    dispatch(event);
    return event;
  }

  /**
   * 关闭并排空全部 sink。
   * 调用方: 后端进程关闭生命周期和测试清理。
   * 副作用: 逆序等待 sink.close；重复调用返回同一关闭任务。
   * 失败路径: 单个 sink.close reject 被隔离，剩余 sink 继续关闭。
   *
   * @returns {Promise<void>} 全部可关闭 sink 处理完成后结束。
   */
  function close() {
    if (closeTask !== null) return closeTask;
    closing = true;
    closeTask = (async () => {
      for (const sink of [...outputs].reverse()) {
        if (typeof sink.close === 'function') {
          try {
            await sink.close();
          } catch {
            // 关闭边界: 一个输出端失败不妨碍后续输出端释放资源。
          }
        }
      }
      closed = true;
    })();
    return closeTask;
  }

  return Object.freeze({ write, reportSinkEvent, close, isClosed: () => closed });
}
