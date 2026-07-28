/*
  proxyAuditLogger.js 模块说明

  - 文件职责:
      输出不含原始标识、URL、IP、头、Cookie、Token 和 body 的最小代理事务摘要，用于请求关联与容量诊断。
      供 ProxyExecutor 在事务结束时调用；日志写入失败不改变代理结果，也不在内存保存历史记录。

  - 导入库及文件汇总(2 条，内置 2 条，第三方 0 条，自定义 0 条):
      node:crypto#createHash: 把调用方可控请求标识转换为不可逆关联摘要。
      node:process#process: 默认把单行 JSON 摘要写入服务标准输出。

  - 模块级常量:
      LOG_EVENT_NAME: string，最小代理事务日志固定事件名。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createCorrelationHash(value): 把原始关联标识转换为固定 SHA-256 摘要。
      writeJsonLine(write, payload): 安全序列化并写入单行，吸收日志端口异常。
      createProxyAuditLogger(options): 创建不保存历史的成功与失败摘要端口。

  - 模块级类:
      无

  - 对外导出:
      createProxyAuditLogger: function，ProxyExecutor 创建生产或测试日志端口。
*/

// 导入来源: node:crypto；导入内容: createHash；文件作用: 防止调用方把敏感内容伪装进标识后被日志原样记录。
import { createHash } from 'node:crypto';
// 导入来源: node:process；导入内容: process；文件作用: 默认向当前服务 stdout 写入脱敏事务摘要。
import process from 'node:process';

// 类型: string；来源: 后端最小日志约定；作用: 运维采集只识别固定事务摘要，不根据文案推断事件。
const LOG_EVENT_NAME = 'proxy.request.completed';

/**
 * 把调用方可控关联标识转换为固定摘要。
 * 调用方: recordSuccess 和 recordFailure。
 * 副作用: 无；每次创建独立 SHA-256 计算器，不保存原始值或跨请求状态。
 * 失败路径: 校验层保证输入是字符串；防御性分支把其他值按空字符串处理，不进行对象字符串化。
 *
 * @param {unknown} value requestId 或 sourceId 候选值。
 * @returns {string} 小写十六进制 SHA-256 摘要。
 */
function createCorrelationHash(value) {
  // 安全边界: 不对对象执行 String(value)，避免自定义序列化或对象内容进入日志关联输入。
  const safeValue = typeof value === 'string' ? value : '';
  return createHash('sha256').update(safeValue, 'utf8').digest('hex');
}

/**
 * 把脱敏摘要序列化为单行 JSON 并调用写入端口。
 * 调用方: recordSuccess 和 recordFailure。
 * 副作用: 调用 write 一次；JSON.stringify 会转义 requestId/sourceId 中的换行，防止日志注入新记录。
 * 失败路径: 序列化或 write 抛错被吸收，日志系统不能覆盖真实代理结果。
 *
 * @param {Function} write 单行日志写入端口。
 * @param {Readonly<object>} payload 只含允许摘要字段的冻结对象。
 * @returns {void} 无返回值。
 */
function writeJsonLine(write, payload) {
  try {
    write(`${JSON.stringify(payload)}\n`);
  } catch {
    // 日志边界: 写入异常不能让已经完成或失败的代理事务改变协议响应。
  }
}

/**
 * 创建不保存历史的最小代理审计日志端口。
 * 调用方: createProxyExecutor。
 * 状态所有权: 工厂只持有无状态 write 函数，不缓存事件、请求或失败对象。
 * 失败路径: write 不是函数时同步抛 TypeError；运行时写入失败由 writeJsonLine 吸收。
 *
 * @param {object} [options={}] 日志依赖。
 * @param {Function} [options.write=process.stdout.write] 单行文本写入端口。
 * @returns {Readonly<{ recordSuccess: Function, recordFailure: Function }>} 冻结日志端口。
 * @throws {TypeError} 写入端口无效时抛出。
 */
export function createProxyAuditLogger({ write = process.stdout.write.bind(process.stdout) } = {}) {
  if (typeof write !== 'function') {
    throw new TypeError('createProxyAuditLogger 需要有效 write');
  }

  /**
   * 记录一次成功代理事务的脱敏摘要。
   * 调用方: ProxyExecutor 成功形成 ProxyResponseEnvelope 后。
   * 副作用: 写入一行 JSON；不记录 URL、状态文本、响应头或 body。
   * 失败路径: 写入失败被吸收。
   *
   * @param {object} summary 成功摘要。
   * @param {string} summary.requestId 请求关联标识；只记录摘要，不记录原文。
   * @param {string} summary.sourceId 数据源审计关联标识；只记录摘要且不参与策略。
   * @param {number} summary.durationMs 单调时钟计算的事务耗时。
   * @param {number} summary.upstreamStatus 最终上游 HTTP 状态。
   * @param {number} summary.receivedBytes 转换前响应字节数。
   * @param {number} summary.redirectCount 已完成重定向次数。
   * @returns {void} 无返回值。
   */
  function recordSuccess({ requestId, sourceId, durationMs, upstreamStatus, receivedBytes, redirectCount }) {
    writeJsonLine(write, Object.freeze({
      event: LOG_EVENT_NAME,
      requestIdHash: createCorrelationHash(requestId),
      sourceIdHash: createCorrelationHash(sourceId),
      outcome: 'success',
      durationMs: Math.max(0, Math.round(durationMs)),
      upstreamStatus,
      receivedBytes,
      redirectCount
    }));
  }

  /**
   * 记录一次代理失败的脱敏摘要。
   * 调用方: ProxyExecutor 错误归类完成后。
   * 副作用: 写入一行 JSON；不序列化 Error、cause、details、URL、IP、头或 body。
   * 失败路径: 写入失败被吸收。
   *
   * @param {object} summary 失败摘要。
   * @param {string} summary.requestId 请求关联标识；只记录摘要，不记录原文。
   * @param {string} summary.sourceId 数据源审计关联标识；只记录摘要且不参与策略。
   * @param {number} summary.durationMs 单调时钟计算的事务耗时。
   * @param {string} summary.errorCode 已冻结代理错误码。
   * @returns {void} 无返回值。
   */
  function recordFailure({ requestId, sourceId, durationMs, errorCode }) {
    writeJsonLine(write, Object.freeze({
      event: LOG_EVENT_NAME,
      requestIdHash: createCorrelationHash(requestId),
      sourceIdHash: createCorrelationHash(sourceId),
      outcome: 'failure',
      durationMs: Math.max(0, Math.round(durationMs)),
      errorCode
    }));
  }

  return Object.freeze({ recordSuccess, recordFailure });
}
