/*
  logEvent.js 模块说明

  - 文件职责:
      定义后端统一日志级别、级别过滤和 JSON 安全事件创建规则。
      所有 sink 只消费本模块创建的冻结事件；本模块不输出日志、不访问网络也不保存事件历史。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      ../../../scripts/startup/configContracts.mjs#APPLICATION_LOG_LEVEL: 根运行配置和日志运行层共用的唯一日志级别枚举。

  - 模块级常量:
      LOG_LEVEL_PRIORITY: Readonly<object>，级别过滤使用的固定优先级。
      LOG_EVENT_NAME_PATTERN: RegExp，运行事件名称格式。
      RESERVED_EVENT_KEYS: ReadonlySet<string>，只能由日志核心生成的事件字段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeTimestamp(value): 把 Date 或 ISO 文本转换为规范 UTC 时间。
      cloneLogValue(value, path, ancestors): 复制并冻结 JSON 安全字段，拒绝循环和可执行值。
      isLogLevelEnabled(level, minimumLevel): 判断事件是否达到 sink 阈值。
      createLogEvent(options): 创建带时间、级别和名称的统一冻结事件。

  - 模块级类:
      无

  - 对外导出:
      isLogLevelEnabled: function，执行统一级别过滤。
      createLogEvent: function，创建统一标准事件。
*/

// 导入来源: ../../../scripts/startup/configContracts.mjs；导入内容: APPLICATION_LOG_LEVEL；文件作用: 配置校验与运行事件复用同一日志级别事实。
import { APPLICATION_LOG_LEVEL } from '../../../scripts/startup/configContracts.mjs';

// 类型: Readonly<object>；来源: APPLICATION_LOG_LEVEL 从低到高顺序；作用: 所有 sink 使用同一阈值比较语义。
const LOG_LEVEL_PRIORITY = Object.freeze({
  [APPLICATION_LOG_LEVEL.debug]: 0,
  [APPLICATION_LOG_LEVEL.info]: 1,
  [APPLICATION_LOG_LEVEL.warn]: 2,
  [APPLICATION_LOG_LEVEL.error]: 3
});

// 类型: RegExp；作用: 事件名只允许稳定的小写点分段标识，不能把运行数据拼进事件名。
const LOG_EVENT_NAME_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/u;

// 类型: ReadonlySet<string>；作用: 调用方字段不能覆盖日志核心生成的时间、级别和事件身份。
const RESERVED_EVENT_KEYS = new Set(['timestamp', 'level', 'event']);

/**
 * 把时钟值转换为规范 UTC ISO 时间。
 * 调用方: createLogEvent。
 * 纯函数: 只创建 Date 并返回文本，不读取系统时钟。
 * 失败路径: 非 Date/字符串或无效时间抛 TypeError。
 *
 * @param {Date|string} value 注入时钟生成的时间值。
 * @returns {string} 规范 UTC ISO 时间。
 * @throws {TypeError} 时间不能唯一解析时抛出。
 */
function normalizeTimestamp(value) {
  if (!(value instanceof Date) && typeof value !== 'string') {
    throw new TypeError('日志时间必须是 Date 或 ISO 字符串');
  }
  // 类型: Date；作用: Date 输入复制以隔离可变实例，字符串按标准日期语义解析。
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('日志时间必须有效');
  }
  return date.toISOString();
}

/**
 * 复制一个 JSON 安全日志字段并冻结全部容器。
 * 调用方: createLogEvent 递归处理 fields。
 * 纯函数: 创建隔离副本，不修改输入；ancestors 只跟踪当前递归链。
 * 失败路径: undefined、函数、Symbol、BigInt、非有限数字、类实例或循环引用抛 TypeError。
 *
 * @param {*} value 当前字段值。
 * @param {string} path 当前字段定位。
 * @param {Set<object>} ancestors 当前递归祖先集合。
 * @returns {*} 冻结 JSON 安全副本或原始标量。
 * @throws {TypeError} 字段不能安全序列化时抛出。
 */
function cloneLogValue(value, path, ancestors) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} 必须是有限数字`);
    }
    return value;
  }
  if (typeof value !== 'object') {
    throw new TypeError(`${path} 必须是 JSON 安全值`);
  }
  if (ancestors.has(value)) {
    throw new TypeError(`${path} 不能包含循环引用`);
  }

  // 类型: Set<object>；作用: 当前分支使用独立祖先集合，允许不同字段安全引用同一只读对象。
  const nextAncestors = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry, index) => cloneLogValue(entry, `${path}[${index}]`, nextAncestors)));
  }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${path} 必须是普通对象`);
  }

  // 类型: object；作用: 使用 null 原型临时容器避免特殊键影响复制语义，返回前再转成普通冻结对象。
  const clone = Object.create(null);
  for (const [key, entry] of Object.entries(value)) {
    clone[key] = cloneLogValue(entry, `${path}.${key}`, nextAncestors);
  }
  return Object.freeze({ ...clone });
}

/**
 * 判断一个日志级别是否达到指定 sink 阈值。
 * 调用方: console 和文件 sink。
 * 纯函数: 只读取冻结优先级表。
 * 失败路径: 任一级别未知时抛 TypeError，不能静默输出或丢弃。
 *
 * @param {string} level 当前事件级别。
 * @param {string} minimumLevel sink 最低级别。
 * @returns {boolean} true 表示当前事件应进入 sink。
 * @throws {TypeError} 级别不属于冻结枚举时抛出。
 */
export function isLogLevelEnabled(level, minimumLevel) {
  if (!Object.hasOwn(LOG_LEVEL_PRIORITY, level) || !Object.hasOwn(LOG_LEVEL_PRIORITY, minimumLevel)) {
    throw new TypeError('日志级别必须是 debug、info、warn 或 error');
  }
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minimumLevel];
}

/**
 * 创建一个统一冻结日志事件。
 * 调用方: logCenter 的公开级别方法和运行汇总。
 * 纯函数: 复制 fields 并生成新事件，不输出、不缓存也不修改调用方对象。
 * 失败路径: 级别、事件名、时间、保留键或字段值非法时抛 TypeError。
 *
 * @param {object} options 事件输入。
 * @param {Date|string} options.timestamp 注入时钟值。
 * @param {string} options.level 冻结日志级别。
 * @param {string} options.event 点分段事件名称。
 * @param {object} [options.fields={}] 事件允许字段。
 * @returns {Readonly<object>} 深层冻结且 JSON 安全的日志事件。
 * @throws {TypeError} 输入不满足统一日志边界时抛出。
 */
export function createLogEvent({ timestamp, level, event, fields = {} }) {
  isLogLevelEnabled(level, APPLICATION_LOG_LEVEL.debug);
  if (typeof event !== 'string' || !LOG_EVENT_NAME_PATTERN.test(event)) {
    throw new TypeError('日志事件名必须是小写点分段标识');
  }
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || ![Object.prototype, null].includes(Object.getPrototypeOf(fields))) {
    throw new TypeError('日志 fields 必须是普通对象');
  }
  for (const key of Object.keys(fields)) {
    if (RESERVED_EVENT_KEYS.has(key)) {
      throw new TypeError(`日志 fields 不能覆盖保留字段 ${key}`);
    }
  }

  // 类型: Readonly<object>；作用: 先完成字段隔离，再与三个核心身份字段组成最终事件。
  const safeFields = cloneLogValue(fields, 'fields', new Set());
  return Object.freeze({
    timestamp: normalizeTimestamp(timestamp),
    level,
    event,
    ...safeFields
  });
}
