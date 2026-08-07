/*
  logEvent.js 模块说明

  - 文件职责:
      定义后端唯一三分区日志事件、类别动作、终态级别和 JSON 安全冻结规则。
      所有 sink 消费同一个事件对象；本模块不输出日志、不访问网络也不保存事件历史。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      ../../../scripts/startup/configContracts.mjs#APPLICATION_LOG_LEVEL: 配置阈值和事件级别共用枚举。

  - 模块级常量:
      LOG_LEVEL_PRIORITY: Readonly<object>，sink 阈值比较顺序。
      LOG_CATEGORY: Readonly<object>，四类日志事件。
      LOG_ACTION: Readonly<object>，各类别稳定动作。
      LOG_RESULT: Readonly<object>，成功和失败终态。
      LOG_ACTIONS_BY_CATEGORY: Readonly<object>，类别允许动作集合。
      FAILURE_ACTIONS: ReadonlySet<string>，必须使用 failure 终态的动作。
      SUCCESS_ACTIONS: ReadonlySet<string>，必须使用 success 终态的动作。
      REQUEST_PROCESS_KEYS: ReadonlyArray<string>，请求过程允许的精确字段。
      RESPONSE_PROCESS_KEYS: ReadonlyArray<string>，响应过程允许的精确字段。
      FAILURE_REASON_PATTERN: RegExp，稳定失败原因格式。
      INTERNAL_ERROR_REASON: string，代理内部失败的错误级别边界。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeTimestamp(value): 生成规范 UTC 时间。
      cloneLogValue(value, path, ancestors): 深复制并冻结 JSON 安全值。
      hasExactKeys(value, expectedKeys): 判断普通对象是否具有精确字段集合。
      validateProcessSections(options): 校验类别对应的过程分区及精确字段语义。
      isLogLevelEnabled(level, minimumLevel): 执行统一阈值判断。
      getLogEventLevel(event): 从类别和终态推导输出级别。
      createLogEvent(options): 创建唯一三分区冻结事件。

  - 模块级类:
      无

  - 对外导出:
      LOG_CATEGORY、LOG_ACTION、LOG_RESULT: 日志生产者使用的冻结枚举。
      isLogLevelEnabled: sink 使用的阈值判断。
      getLogEventLevel: sink 使用的事件级别投影。
      createLogEvent: 日志中心使用的事件工厂。
*/

// 导入来源: ../../../scripts/startup/configContracts.mjs；导入内容: APPLICATION_LOG_LEVEL；文件作用: 事件级别和配置阈值不维护两份枚举。
import { APPLICATION_LOG_LEVEL } from '../../../scripts/startup/configContracts.mjs';

// 类型: Readonly<object>；作用: debug 至 error 的稳定比较顺序，事件当前最低为 info 但配置仍可选择 debug。
const LOG_LEVEL_PRIORITY = Object.freeze({
  [APPLICATION_LOG_LEVEL.debug]: 0,
  [APPLICATION_LOG_LEVEL.info]: 1,
  [APPLICATION_LOG_LEVEL.warn]: 2,
  [APPLICATION_LOG_LEVEL.error]: 3
});

// 类型: Readonly<object>；作用: 一个日志文件中只允许四类可检索事件。
export const LOG_CATEGORY = Object.freeze({
  runtime: 'runtime',
  request: 'request',
  rejected: 'rejected',
  logging: 'logging'
});

// 类型: Readonly<object>；作用: 动作只表达稳定生命周期，不把运行值拼进事件身份。
export const LOG_ACTION = Object.freeze({
  runtimeStarted: 'started',
  runtimeStopped: 'stopped',
  runtimeStartFailed: 'start_failed',
  runtimeStopFailed: 'stop_failed',
  requestCompleted: 'completed',
  requestRejected: 'rejected',
  fileRotated: 'file_rotated',
  fileFailed: 'file_failed'
});

// 类型: Readonly<object>；作用: 所有类别使用同一成功和失败终态。
export const LOG_RESULT = Object.freeze({ success: 'success', failure: 'failure' });

// 类型: Readonly<object>；作用: 阻止类别和动作形成无意义组合。
const LOG_ACTIONS_BY_CATEGORY = Object.freeze({
  [LOG_CATEGORY.runtime]: new Set([
    LOG_ACTION.runtimeStarted,
    LOG_ACTION.runtimeStopped,
    LOG_ACTION.runtimeStartFailed,
    LOG_ACTION.runtimeStopFailed
  ]),
  [LOG_CATEGORY.request]: new Set([LOG_ACTION.requestCompleted]),
  [LOG_CATEGORY.rejected]: new Set([LOG_ACTION.requestRejected]),
  [LOG_CATEGORY.logging]: new Set([LOG_ACTION.fileRotated, LOG_ACTION.fileFailed])
});

// 类型: ReadonlySet<string>；作用: 拒绝失败动作被错误记录为成功，避免运行和文件故障统计失真。
const FAILURE_ACTIONS = new Set([
  LOG_ACTION.runtimeStartFailed,
  LOG_ACTION.runtimeStopFailed,
  LOG_ACTION.requestRejected,
  LOG_ACTION.fileFailed
]);

// 类型: ReadonlySet<string>；作用: 拒绝成功生命周期动作携带 failure 终态；request/completed 可按真实结果取两种终态。
const SUCCESS_ACTIONS = new Set([
  LOG_ACTION.runtimeStarted,
  LOG_ACTION.runtimeStopped,
  LOG_ACTION.fileRotated
]);

// 类型: ReadonlyArray<string>；作用: 过程分区不能追加请求头、响应体或未登记诊断字段。
const REQUEST_PROCESS_KEYS = Object.freeze([
  'fromIP',
  'destinationDomain',
  'destinationIP',
  'method',
  'url',
  'parameterSource',
  'parameters',
  'contentType',
  'contentLengthBytes'
]);

// 类型: ReadonlyArray<string>；作用: 响应过程只允许可达事实、状态、规范类型和完整字节数。
const RESPONSE_PROCESS_KEYS = Object.freeze([
  'responseReceived',
  'status',
  'contentType',
  'contentLengthBytes'
]);

// 类型: RegExp；作用: 失败原因只允许稳定错误码或内部原因，不接受错误文案、路径和堆栈。
const FAILURE_REASON_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/u;

// 类型: string；作用: 代理内部错误进入 stderr，其他受控请求失败进入 warn。
const INTERNAL_ERROR_REASON = 'PROXY_INTERNAL_ERROR';

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
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('日志时间必须有效');
  }
  return date.toISOString();
}

/**
 * 复制一个 JSON 安全日志值并冻结全部容器。
 * 调用方: createLogEvent 处理请求和响应过程。
 * 纯函数: 创建隔离副本，不修改输入；ancestors 只跟踪当前递归链。
 * 失败路径: undefined、函数、Symbol、BigInt、非有限数字、类实例或循环引用抛 TypeError。
 *
 * @param {*} value 当前值。
 * @param {string} path 当前字段定位。
 * @param {Set<object>} ancestors 当前递归祖先集合。
 * @returns {*} 冻结 JSON 安全副本或原始标量。
 * @throws {TypeError} 字段不能安全序列化时抛出。
 */
function cloneLogValue(value, path, ancestors) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} 必须是有限数字`);
    return value;
  }
  if (typeof value !== 'object') throw new TypeError(`${path} 必须是 JSON 安全值`);
  if (ancestors.has(value)) throw new TypeError(`${path} 不能包含循环引用`);

  const nextAncestors = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry, index) => cloneLogValue(entry, `${path}[${index}]`, nextAncestors)));
  }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${path} 必须是普通对象`);
  }

  const clone = Object.create(null);
  for (const [key, entry] of Object.entries(value)) {
    clone[key] = cloneLogValue(entry, `${path}.${key}`, nextAncestors);
  }
  return Object.freeze({ ...clone });
}

/**
 * 判断普通对象是否恰好具有登记字段。
 * 调用方: validateProcessSections。
 * 纯函数: 排序比较自有键，不修改输入或冻结字段表。
 * 失败路径: 非普通对象返回 false。
 *
 * @param {*} value 待检查过程分区。
 * @param {ReadonlyArray<string>} expectedKeys 唯一允许字段集合。
 * @returns {boolean} true 表示对象原型和字段集合都精确匹配。
 */
function hasExactKeys(value, expectedKeys) {
  if (value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return false;
  }
  const actualKeys = Object.keys(value).sort();
  const requiredKeys = [...expectedKeys].sort();
  return actualKeys.length === requiredKeys.length
    && actualKeys.every((key, index) => key === requiredKeys[index]);
}

/**
 * 校验事件类别对应的过程分区和字段语义。
 * 调用方: createLogEvent。
 * 纯函数: 只读取输入；runtime/logging 必须没有请求过程，request/rejected 必须使用固定字段。
 * 失败路径: 额外字段、缺失字段、非法类型或自相矛盾的响应事实抛 TypeError。
 *
 * @param {object} options 过程校验输入。
 * @param {string} options.category 当前日志类别。
 * @param {object|null} options.requestProcess 请求过程。
 * @param {object|null} options.responseProcess 响应过程。
 * @returns {void} 输入满足唯一事件契约时无返回值。
 * @throws {TypeError} 过程分区不满足类别和字段契约时抛出。
 */
function validateProcessSections({ category, requestProcess, responseProcess }) {
  if ([LOG_CATEGORY.runtime, LOG_CATEGORY.logging].includes(category)) {
    if (requestProcess !== null || responseProcess !== null) {
      throw new TypeError('runtime 和 logging 事件的过程分区必须为 null');
    }
    return;
  }
  if (!hasExactKeys(requestProcess, REQUEST_PROCESS_KEYS)
    || !hasExactKeys(responseProcess, RESPONSE_PROCESS_KEYS)) {
    throw new TypeError('request 和 rejected 事件必须使用精确过程字段');
  }

  const nullableStrings = [
    requestProcess.fromIP,
    requestProcess.destinationDomain,
    requestProcess.destinationIP,
    requestProcess.url,
    requestProcess.contentType,
    responseProcess.contentType
  ];
  if (nullableStrings.some((value) => value !== null && typeof value !== 'string')
    || ![null, 'GET', 'POST'].includes(requestProcess.method)
    || ![null, 'query', 'body'].includes(requestProcess.parameterSource)
    || (requestProcess.parameterSource === null && requestProcess.parameters !== null)
    || (requestProcess.contentLengthBytes !== null
      && (!Number.isSafeInteger(requestProcess.contentLengthBytes) || requestProcess.contentLengthBytes < 0))
    || typeof responseProcess.responseReceived !== 'boolean'
    || (responseProcess.status !== null
      && (!Number.isInteger(responseProcess.status) || responseProcess.status < 100 || responseProcess.status > 599))
    || (responseProcess.contentLengthBytes !== null
      && (!Number.isSafeInteger(responseProcess.contentLengthBytes) || responseProcess.contentLengthBytes < 0))) {
    throw new TypeError('日志过程字段类型无效');
  }
  if (responseProcess.responseReceived === false
    && (responseProcess.status !== null
      || responseProcess.contentType !== null
      || responseProcess.contentLengthBytes !== null)) {
    throw new TypeError('未收到上游响应时响应概况必须为空');
  }
  if (responseProcess.responseReceived === true && responseProcess.status === null) {
    throw new TypeError('收到上游响应时必须记录状态码');
  }
}

/**
 * 判断事件级别是否达到 sink 阈值。
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
 * 从标准事件类别和终态推导输出级别。
 * 调用方: console 和文件 sink。
 * 纯函数: 不读取隐藏元数据，stdout/stderr 和文件阈值对同一事件得到相同结果。
 * 失败路径: 非标准事件抛 TypeError，sink 不猜测默认级别。
 *
 * @param {Readonly<object>} event 三分区标准事件。
 * @returns {string} info、warn 或 error。
 * @throws {TypeError} 事件缺少有效 overall 时抛出。
 */
export function getLogEventLevel(event) {
  const overall = event?.overall;
  if (!overall || !Object.values(LOG_CATEGORY).includes(overall.category)) {
    throw new TypeError('日志事件缺少有效 overall.category');
  }
  if (overall.result === LOG_RESULT.success) return APPLICATION_LOG_LEVEL.info;
  if (overall.result !== LOG_RESULT.failure) throw new TypeError('日志事件缺少有效 overall.result');
  if (overall.category === LOG_CATEGORY.rejected) return APPLICATION_LOG_LEVEL.warn;
  if (overall.category === LOG_CATEGORY.request && overall.failureReason !== INTERNAL_ERROR_REASON) {
    return APPLICATION_LOG_LEVEL.warn;
  }
  return APPLICATION_LOG_LEVEL.error;
}

/**
 * 创建唯一三分区冻结日志事件。
 * 调用方: logCenter.write。
 * 纯函数: 复制两个过程分区并创建新事件，不输出、不缓存也不修改调用方对象。
 * 失败路径: 类别、动作、终态、关联字段或过程分区非法时抛 TypeError。
 *
 * @param {object} options 事件输入。
 * @param {Date|string} options.timestamp 注入时钟值。
 * @param {string} options.category 四类事件之一。
 * @param {string} options.action 当前类别登记动作。
 * @param {string|null} options.requestId 请求标识或 null。
 * @param {string} options.result success 或 failure。
 * @param {number|null} options.durationMs 非负整数耗时或 null。
 * @param {string|null} options.failureReason 稳定失败原因或 null。
 * @param {object|null} options.requestProcess 请求过程或 null。
 * @param {object|null} options.responseProcess 响应过程或 null。
 * @returns {Readonly<object>} 只有 overall、requestProcess、responseProcess 的冻结事件。
 * @throws {TypeError} 输入不满足统一日志边界时抛出。
 */
export function createLogEvent({
  timestamp,
  category,
  action,
  requestId,
  result,
  durationMs,
  failureReason,
  requestProcess,
  responseProcess
}) {
  if (!Object.hasOwn(LOG_ACTIONS_BY_CATEGORY, category) || !LOG_ACTIONS_BY_CATEGORY[category].has(action)) {
    throw new TypeError('日志类别与动作组合无效');
  }
  if (![LOG_RESULT.success, LOG_RESULT.failure].includes(result)) {
    throw new TypeError('日志 result 必须是 success 或 failure');
  }
  if ((FAILURE_ACTIONS.has(action) && result !== LOG_RESULT.failure)
    || (SUCCESS_ACTIONS.has(action) && result !== LOG_RESULT.success)) {
    throw new TypeError('日志动作与 result 终态不一致');
  }
  if (requestId !== null && (typeof requestId !== 'string' || requestId.length === 0)) {
    throw new TypeError('日志 requestId 必须是非空字符串或 null');
  }
  if (durationMs !== null && (!Number.isSafeInteger(durationMs) || durationMs < 0)) {
    throw new TypeError('日志 durationMs 必须是非负安全整数或 null');
  }
  const validFailureReason = typeof failureReason === 'string' && FAILURE_REASON_PATTERN.test(failureReason);
  if ((result === LOG_RESULT.success && failureReason !== null)
    || (result === LOG_RESULT.failure && !validFailureReason)) {
    throw new TypeError('日志 failureReason 必须与 result 终态一致');
  }
  validateProcessSections({ category, requestProcess, responseProcess });

  const event = Object.freeze({
    overall: Object.freeze({
      timestamp: normalizeTimestamp(timestamp),
      category,
      action,
      requestId,
      result,
      durationMs,
      failureReason
    }),
    requestProcess: cloneLogValue(requestProcess, 'requestProcess', new Set()),
    responseProcess: cloneLogValue(responseProcess, 'responseProcess', new Set())
  });
  getLogEventLevel(event);
  return event;
}
