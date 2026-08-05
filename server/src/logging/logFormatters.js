/*
  logFormatters.js 模块说明

  - 文件职责:
      把统一日志事件格式化为完整单行 JSON 或适合终端阅读的紧凑单行文本。
      本模块只改变表现形式，不增加、删除或推断标准事件事实，也不执行输出。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      ../../../scripts/startup/configContracts.mjs#APPLICATION_LOG_FORMAT: 根运行配置和 formatter 共用的唯一日志格式枚举。

  - 模块级常量:
      CORE_EVENT_KEYS: ReadonlySet<string>，紧凑格式固定前缀字段。
      PROXY_COMPACT_KEYS: ReadonlyArray<string>，代理完成事件允许进入终端摘要的字段。
      SUMMARY_COMPACT_KEYS: ReadonlyArray<string>，周期汇总终端字段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      formatValue(value): 把值转换为无换行的紧凑 JSON 文本。
      selectCompactKeys(event): 选择事件对应的有限终端字段。
      formatJsonLogEvent(event): 生成完整单行 JSON。
      formatCompactLogEvent(event): 生成紧凑终端文本。
      createLogFormatter(format): 返回指定格式的纯函数。

  - 模块级类:
      无

  - 对外导出:
      formatJsonLogEvent: function，完整 JSONL formatter。
      formatCompactLogEvent: function，有限终端 formatter。
      createLogFormatter: function，按配置选择 formatter。
*/

// 导入来源: ../../../scripts/startup/configContracts.mjs；导入内容: APPLICATION_LOG_FORMAT；文件作用: 配置校验和 formatter 不再维护两份格式枚举。
import { APPLICATION_LOG_FORMAT } from '../../../scripts/startup/configContracts.mjs';

// 类型: ReadonlySet<string>；作用: 这些字段已经在紧凑前缀中展示，不重复输出。
const CORE_EVENT_KEYS = new Set(['timestamp', 'level', 'event']);

// 类型: ReadonlyArray<string>；作用: 避免终端输出完整哈希、头名称、body 摘要和跳转数组形成长行。
const PROXY_COMPACT_KEYS = Object.freeze([
  'method',
  'clientIp',
  'finalHost',
  'finalIp',
  'outcome',
  'durationMs',
  'upstreamStatus',
  'receivedBytes',
  'redirectCount',
  'errorCode'
]);

// 类型: ReadonlyArray<string>；作用: 周期汇总只显示有限计数和容量，不展开内部对象之外的数据。
const SUMMARY_COMPACT_KEYS = Object.freeze([
  'requestCount',
  'successCount',
  'failureCount',
  'averageDurationMs',
  'maximumDurationMs',
  'totalReceivedBytes',
  'errorCounts'
]);

/**
 * 把事件值转换为单行且类型明确的紧凑文本。
 * 调用方: formatCompactLogEvent。
 * 纯函数: 只执行 JSON 序列化，不修改事件。
 * 失败路径: 统一事件已经保证 JSON 安全；意外序列化失败由调用方保留。
 *
 * @param {*} value JSON 安全事件值。
 * @returns {string} 不包含原始换行的紧凑 JSON 文本。
 */
function formatValue(value) {
  return JSON.stringify(value);
}

/**
 * 为紧凑输出选择有限字段。
 * 调用方: formatCompactLogEvent。
 * 纯函数: 返回冻结配置或当前事件自有字段的新数组。
 * 失败路径: 无；未知运行事件显示除核心字段外的全部受控字段。
 *
 * @param {Readonly<object>} event 统一日志事件。
 * @returns {ReadonlyArray<string>|Array<string>} 应输出的字段顺序。
 */
function selectCompactKeys(event) {
  if (event.event === 'proxy.request.completed') {
    return PROXY_COMPACT_KEYS;
  }
  if (event.event === 'proxy.runtime.summary') {
    return SUMMARY_COMPACT_KEYS;
  }
  return Object.keys(event).filter((key) => !CORE_EVENT_KEYS.has(key));
}

/**
 * 把统一事件格式化为完整单行 JSON。
 * 调用方: JSON console sink 和 JSONL 文件 sink。
 * 纯函数: 不修改事件；JSON.stringify 对事件内换行执行转义。
 * 失败路径: 输入不是统一事件时可能抛 TypeError，由 sink 故障边界处理。
 *
 * @param {Readonly<object>} event 统一日志事件。
 * @returns {string} 不带行终止符的完整 JSON 文本。
 */
export function formatJsonLogEvent(event) {
  return JSON.stringify(event);
}

/**
 * 把统一事件格式化为紧凑终端单行。
 * 调用方: compact console sink。
 * 纯函数: 只读取事件并创建文本，不改变标准事件对象。
 * 失败路径: 输入字段不能 JSON 序列化时保留异常，由 sink 关闭自身。
 *
 * @param {Readonly<object>} event 统一日志事件。
 * @returns {string} 时间、级别、事件和有限字段组成的单行文本。
 */
export function formatCompactLogEvent(event) {
  // 类型: Array<string>；作用: 前三个元素固定提供事件定位，后续按事件类型追加有限字段。
  const parts = [event.timestamp, String(event.level).toUpperCase(), event.event];
  for (const key of selectCompactKeys(event)) {
    if (Object.hasOwn(event, key)) {
      parts.push(`${key}=${formatValue(event[key])}`);
    }
  }
  return parts.join(' ');
}

/**
 * 按配置选择日志格式化函数。
 * 调用方: console sink 和后续文件 sink。
 * 纯函数: 返回模块级函数引用，不保存配置状态。
 * 失败路径: 未知格式同步抛 TypeError，启动不能静默采用其他格式。
 *
 * @param {string} format compact 或 json。
 * @returns {Function} 统一事件 formatter。
 * @throws {TypeError} 格式未知时抛出。
 */
export function createLogFormatter(format) {
  if (format === APPLICATION_LOG_FORMAT.compact) return formatCompactLogEvent;
  if (format === APPLICATION_LOG_FORMAT.json) return formatJsonLogEvent;
  throw new TypeError('日志格式必须是 compact 或 json');
}
