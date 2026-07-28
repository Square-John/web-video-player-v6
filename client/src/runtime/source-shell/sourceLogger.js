/*
  sourceLogger.js 模块说明

  - 文件职责:
      创建绑定单一 sourceId 的脱敏有界日志控制器。
      分离 Provider 只写 logger 与 Host 隔离读取/清理能力，不写 console、Repository、页面或全局状态。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      SOURCE_LOG_LEVEL、SOURCE_LOGGER_POLICY、SOURCE_SENSITIVE_KEYS: 自定义配置，提供级别、容量和脱敏键。
      cloneSerializableValue、getSerializableByteLength: 自定义 Repository 工具，创建日志读取隔离副本并核对脱敏后真实字节数。
      SourceShellLimitError、SourceShellValidationError: 自定义 Shell 错误，拒绝最终日志超限和非法控制器依赖。
      Shell validators: 自定义验证器，校验 sourceId、精确参数、消息和 details 容量。

  - 模块级常量:
      SOURCE_LOGGER_OPTION_FIELDS: Array<string>，Logger Controller 精确依赖字段。
      SOURCE_LOG_REDACTED_VALUE: string，敏感值统一替换文本。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertLoggerOptions(options): Function，校验并规范化绑定 sourceId。
      normalizeSensitiveKey(key): Function，统一敏感键大小写和分隔符。
      isSensitiveLogKey(key): Function，判断日志字段是否命中集中敏感键。
      redactSerializableValue(value): Function，递归复制并脱敏严格 JSON Value。
      freezeSerializableValue(value): Function，递归冻结隔离日志快照。
      appendLogEntry(entries, sourceId, level, message, details): Function，规范化并有界追加日志。

  - 模块级类:
      无

  - 对外导出:
      createSourceLoggerController(options): Function，创建绑定身份的冻结日志控制器。
*/

import {
  // 导入来源: ./source-shell.config.js。
  // 导入内容: SOURCE_LOG_LEVEL 日志级别枚举。
  // 文件作用: Provider 只能写入 debug、info、warn 和 error 四个稳定级别。
  SOURCE_LOG_LEVEL,

  // 导入来源: ./source-shell.config.js。
  // 导入内容: SOURCE_LOGGER_POLICY 日志容量策略。
  // 文件作用: 限制消息、details 和内存保留条数，禁止无限增长。
  SOURCE_LOGGER_POLICY,

  // 导入来源: ./source-shell.config.js。
  // 导入内容: SOURCE_SENSITIVE_KEYS 冻结敏感键数组。
  // 文件作用: 对 details 中大小写不同的认证、会话和密钥字段递归脱敏。
  SOURCE_SENSITIVE_KEYS
} from './source-shell.config.js';

// 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
import {
  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
  // 文件作用: getEntries 返回与内部有界数组完全隔离的快照。
  cloneSerializableValue,

  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: getSerializableByteLength 严格 JSON Value 字节计算函数。
  // 文件作用: 以脱敏后的最终 details 为准执行日志容量门禁。
  getSerializableByteLength
} from '../../repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ./sourceShellErrors.js。
  // 导入内容: SourceShellLimitError 日志容量超限错误。
  // 文件作用: 脱敏后的最终 details 超过集中上限时拒绝写入。
  SourceShellLimitError,

  // 导入来源: ./sourceShellErrors.js。
  // 导入内容: SourceShellValidationError Shell 输入错误。
  // 文件作用: options 字段不符合精确契约时返回稳定 validation。
  SourceShellValidationError
} from './sourceShellErrors.js';

import {
  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: assertExactArgumentCount 精确参数数量校验。
  // 文件作用: 四个写方法、读取和清理方法都拒绝额外参数。
  assertExactArgumentCount,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: normalizeSourceLogInput 日志输入规范化函数。
  // 文件作用: 统一校验消息、普通 details、严格 JSON 和容量边界。
  normalizeSourceLogInput,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: normalizeSourceShellId 安全数据源身份规范化函数。
  // 文件作用: 构造时永久绑定安全 sourceId 并拒绝危险动态键。
  normalizeSourceShellId
} from './sourceShellValidators.js';

// 类型: Array<string>。
// 作用: 固定 Logger Controller 构造依赖，禁止调用方注入数组、容量覆盖或日志消费者。
const SOURCE_LOGGER_OPTION_FIELDS = Object.freeze([
  // 类型: string。
  // 作用: 要求控制器显式绑定唯一数据源身份。
  'sourceId'
]);

// 类型: string。
// 作用: 统一替换所有敏感字段原值，使日志保留字段存在性但不泄漏凭据内容。
const SOURCE_LOG_REDACTED_VALUE = '[REDACTED]';

/**
 * 校验 Logger Controller 构造选项。
 * 纯函数: 只读取 options 并返回安全 sourceId，不创建日志或修改输入。
 * 成功路径: 返回规范化 sourceId。
 * 失败路径: options 类型、字段或 sourceId 不合法时抛稳定 validation。
 *
 * @param {*} options Logger Controller 依赖候选。
 * @returns {string} 安全且永久绑定的数据源 id。
 * @throws {SourceShellValidationError} 当 options 不符合精确契约时抛出。
 */
function assertLoggerOptions(options) {
  // 条件分支: options 不是非数组对象时进入。
  // 执行内容: 拒绝读取缺失 sourceId 的依赖容器。
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new SourceShellValidationError('sourceLogger options 必须是对象');
  }

  // 类型: Array<string|symbol>。
  // 作用: 读取包括 symbol 和不可枚举属性在内的全部字段，防止隐藏控制能力进入闭包。
  const optionFields = Reflect.ownKeys(options);

  // 条件分支: 字段数量不同或存在非 sourceId 字段时进入。
  // 执行内容: 拒绝调用方覆盖容量、内部数组、脱敏规则或输出目标。
  if (optionFields.length !== SOURCE_LOGGER_OPTION_FIELDS.length
    || optionFields.some(field => (
      typeof field !== 'string' || !SOURCE_LOGGER_OPTION_FIELDS.includes(field)
    ))) {
    throw new SourceShellValidationError('sourceLogger options 字段不符合契约');
  }

  // 返回值类型: string。
  // 作用: 返回安全绑定身份，后续条目自动附带该值且 Provider 不能覆盖。
  return normalizeSourceShellId(options.sourceId, 'sourceLogger.sourceId');
}

/**
 * 规范化敏感字段键。
 * 纯函数: 返回小写并移除连字符、下划线和空白的新字符串，不修改原键。
 * 成功路径: Authorization、access-token、access_token 和 accessToken 等命名形成可比较文本。
 * 失败路径: 调用点只传入 Object.entries 的字符串键，本函数不接受其他输入来源。
 *
 * @param {string} key 日志详情字段键或集中敏感键。
 * @returns {string} 用于大小写和分隔符无关比较的规范化键。
 */
function normalizeSensitiveKey(key) {
  // 返回值类型: string。
  // 作用: 移除常见字段分隔符并统一小写，覆盖 camelCase、kebab-case 和 snake_case 差异。
  return key.toLowerCase().replaceAll(/[-_\s]/gu, '');
}

/**
 * 判断日志字段是否命中集中敏感键。
 * 纯函数: 只比较规范化字符串，不修改配置数组或日志对象。
 * 成功路径: 任一集中敏感键在忽略大小写和分隔符后相等时返回 true。
 * 失败路径: 没有匹配项时返回 false，调用方继续递归复制非敏感值。
 *
 * @param {string} key 当前日志详情字段键。
 * @returns {boolean} true 表示必须替换原值，false 表示可以递归保留非敏感结构。
 */
function isSensitiveLogKey(key) {
  // 类型: string。
  // 作用: 保存当前字段规范化结果，避免在敏感键循环中重复计算。
  const normalizedKey = normalizeSensitiveKey(key);

  // 循环类型: Array.prototype.some。
  // 初始值: 集中敏感键数组第一项。
  // 终止条件: 找到首个规范化匹配项或全部敏感键比较完成。
  // 循环作用: 覆盖配置键与日志键的大小写、连字符、下划线和 camelCase 差异。
  return SOURCE_SENSITIVE_KEYS.some(sensitiveKey => (
    normalizeSensitiveKey(sensitiveKey) === normalizedKey
  ));
}

/**
 * 递归复制并脱敏严格 JSON Value。
 * 纯函数: 返回新数组、普通对象或基础值，不修改 normalizeSourceLogInput 返回的 details。
 * 成功路径: 敏感键值替换为统一文本，非敏感结构递归复制。
 * 失败路径: 输入已由 normalizeSourceLogInput 校验为严格 JSON Value，本函数不接受其他调用入口。
 *
 * @param {*} value 待脱敏严格 JSON Value。
 * @returns {*} 不包含敏感原值的新 JSON Value。
 */
function redactSerializableValue(value) {
  // 条件分支: 当前值是数组时进入。
  // 执行内容: 按原顺序递归脱敏每个成员，返回新数组避免共享引用。
  if (Array.isArray(value)) {
    // 循环类型: Array.prototype.map。
    // 初始值: 数组第一个成员。
    // 终止条件: 全部成员完成递归复制和脱敏。
    // 循环作用: 保持数组形状并移除任意嵌套敏感原值。
    return value.map(item => redactSerializableValue(item));
  }

  // 条件分支: 当前值是非 null 对象时进入。
  // 执行内容: 创建新普通对象并按键名执行大小写无关敏感判断。
  if (value !== null && typeof value === 'object') {
    // 类型: object。
    // 作用: 收集当前层脱敏字段，不复用调用方或规范化输入对象。
    const redactedObject = {};

    // 循环类型: Array.prototype.forEach。
    // 初始值: 当前对象第一条可枚举键值。
    // 终止条件: 全部字段完成敏感判断或递归复制。
    // 循环作用: 保留字段名和非敏感结构，同时移除敏感字段原值。
    Object.entries(value).forEach(([key, nestedValue]) => {
      // 类型: boolean。
      // 作用: 忽略大小写和常见分隔符匹配集中敏感数组，覆盖 accessToken、refresh_token 和 apiKey 等命名。
      const isSensitiveKey = isSensitiveLogKey(key);

      // 副作用范围: 只写入当前函数新建的 redactedObject，不修改输入对象。
      redactedObject[key] = isSensitiveKey
        ? SOURCE_LOG_REDACTED_VALUE
        : redactSerializableValue(nestedValue);
    });

    // 返回值类型: object。
    // 作用: 返回当前层新建脱敏对象，供父层继续组合。
    return redactedObject;
  }

  // 返回值类型: string|number|boolean|null。
  // 作用: JSON 基础值按值返回，不执行隐式字符串转换。
  return value;
}

/**
 * 递归冻结隔离 JSON Value。
 * 副作用: 冻结传入的内部快照副本及其全部嵌套数组和对象；不接触日志内部数组。
 * 成功路径: 返回同一已深度冻结引用。
 * 失败路径: 输入由 cloneSerializableValue 生成，不包含循环或复杂实例。
 *
 * @param {*} value 待冻结隔离 JSON Value。
 * @returns {*} 同一深度冻结 JSON Value 引用。
 */
function freezeSerializableValue(value) {
  // 条件分支: 当前值是数组时进入。
  // 执行内容: 先递归冻结全部成员，再冻结数组根对象。
  if (Array.isArray(value)) {
    // 循环类型: Array.prototype.forEach。
    // 初始值: 数组第一个成员。
    // 终止条件: 全部成员完成递归冻结。
    // 循环作用: 阻止调用方修改日志快照中的嵌套结构。
    value.forEach(item => freezeSerializableValue(item));
    return Object.freeze(value);
  }

  // 条件分支: 当前值是非 null 对象时进入。
  // 执行内容: 先递归冻结全部字段值，再冻结对象根。
  if (value !== null && typeof value === 'object') {
    // 循环类型: Array.prototype.forEach。
    // 初始值: 当前对象第一个字段值。
    // 终止条件: 全部字段值完成递归冻结。
    // 循环作用: 让 getEntries 返回值在任意深度都只读。
    Object.values(value).forEach(nestedValue => freezeSerializableValue(nestedValue));
    return Object.freeze(value);
  }

  // 返回值类型: string|number|boolean|null。
  // 作用: JSON 基础值无需冻结，按值返回。
  return value;
}

/**
 * 规范化、脱敏并有界追加一条日志。
 * 副作用: 向当前控制器私有 entries 追加条目；超过上限时只删除最旧条目。
 * 成功路径: 保存 sourceId、level、message 和脱敏 details 四字段，不向 Provider 返回内部引用。
 * 失败路径: 消息、details 或容量不合法时抛稳定 validation/limit，entries 保持不变。
 *
 * @param {Array<object>} entries 当前控制器私有有界日志数组。
 * @param {string} sourceId 当前控制器绑定数据源 id。
 * @param {string} level SOURCE_LOG_LEVEL 中的稳定级别。
 * @param {*} message Provider 日志消息候选。
 * @param {*} details Provider 日志详情候选。
 * @returns {void} 写入成功不向 Provider 返回日志条目。
 */
function appendLogEntry(entries, sourceId, level, message, details) {
  // 类型: object。
  // 作用: 保存非空消息和严格 JSON、容量受控的隔离 details。
  const normalizedInput = normalizeSourceLogInput(message, details);

  // 类型: object。
  // 作用: 递归移除 details 中大小写不同的敏感原值，保留非敏感诊断结构。
  const redactedDetails = redactSerializableValue(normalizedInput.details);

  // 类型: number。
  // 作用: 计算脱敏替换完成后的最终 JSON 字节数，避免较长替换文本突破实际内存上限。
  const redactedDetailsBytes = getSerializableByteLength(redactedDetails);

  // 条件分支: 脱敏后的最终 details 超过集中容量策略时进入。
  // 执行内容: 在修改私有 entries 前抛 limit，保证失败调用不会留下超限日志或部分状态。
  if (redactedDetailsBytes > SOURCE_LOGGER_POLICY.maxDetailsBytes) {
    throw new SourceShellLimitError('sourceLog.details 脱敏后字节超限');
  }

  // 类型: object。
  // 作用: 创建内部冻结日志条目，只包含正式 SourceLogEntry 四字段。
  const entry = Object.freeze({
    // 类型: string。
    // 作用: 自动附带控制器绑定身份，Provider 不能通过 details 或参数覆盖。
    sourceId,

    // 类型: string。
    // 作用: 保存当前写方法对应的稳定日志级别。
    level,

    // 类型: string。
    // 作用: 保存已验证非空且长度受控的诊断消息。
    message: normalizedInput.message,

    // 类型: object。
    // 作用: 保存与 Provider 输入隔离且递归脱敏的诊断详情。
    details: redactedDetails
  });

  // 副作用范围: 只向当前控制器闭包私有 entries 末尾追加新条目。
  entries.push(entry);

  // 类型: number。
  // 作用: 计算超过集中最大条数的旧日志数量，正常范围内为零。
  const overflowCount = entries.length - SOURCE_LOGGER_POLICY.maxEntries;

  // 条件分支: 私有数组超过最大条数时进入。
  // 执行内容: 从头删除最旧 overflowCount 条，只保留最新有界日志。
  if (overflowCount > 0) {
    // 副作用范围: 只裁剪当前控制器私有 entries，不修改任何已返回隔离快照。
    entries.splice(0, overflowCount);
  }
}

/**
 * 创建绑定 sourceId 的脱敏有界 Logger Controller。
 * 副作用: 创建私有空日志数组；后续 logger 写方法修改该数组，读取和清理只由控制器持有者调用。
 *
 * @param {object} options Logger Controller 依赖。
 * @param {string} options.sourceId 当前 Provider 唯一数据源 id。
 * @returns {object} 冻结 Logger Controller。
 * @returns {string} return.sourceId 控制器绑定身份，供 SourceContext 组合时校验。
 * @returns {object} return.logger Provider 只写四级日志接口。
 * @returns {Function} return.getEntries Host 读取隔离深冻结日志快照的方法。
 * @returns {Function} return.clear Host 清理全部日志并返回原条数的方法。
 * @throws {SourceShellValidationError} 当 options 不符合精确依赖契约时抛出。
 */
export function createSourceLoggerController(options) {
  // 类型: string。
  // 作用: 保存安全绑定身份，所有日志条目自动附带该值。
  const sourceId = assertLoggerOptions(options);

  // 类型: Array<object>。
  // 作用: 控制器唯一私有有界日志状态，不暴露给 SourceContext、Provider 或调用方。
  const entries = [];

  // 类型: object。
  // 作用: 只向 Provider 暴露四个冻结写方法，不包含读取、清理或容量修改入口。
  const logger = Object.freeze({
    /**
     * 写入 debug 诊断日志。
     * 副作用: 向当前控制器私有有界数组追加脱敏 debug 条目。
     * 成功路径: 追加后不返回内部条目。
     * 失败路径: 参数、消息、details 或容量不合法时抛稳定 Shell 错误。
     *
     * @param {...*} args 精确包含 message 和 details。
     * @returns {void} 写入成功不返回业务值。
     */
    debug(...args) {
      // 执行内容: debug 只接受 message/details 两项，禁止夹带 sourceId 或级别覆盖。
      assertExactArgumentCount(args, 2, 'logger.debug');

      // 类型: Array<*>。
      // 作用: 读取消息和详情，sourceId/level 由闭包和当前方法固定。
      const [message, details] = args;

      // 执行内容: 规范化、脱敏并有界写入当前 sourceId 的 debug 条目。
      appendLogEntry(entries, sourceId, SOURCE_LOG_LEVEL.debug, message, details);
    },

    /**
     * 写入 info 运行日志。
     * 副作用: 向当前控制器私有有界数组追加脱敏 info 条目。
     * 成功路径: 追加后不返回内部条目。
     * 失败路径: 参数、消息、details 或容量不合法时抛稳定 Shell 错误。
     *
     * @param {...*} args 精确包含 message 和 details。
     * @returns {void} 写入成功不返回业务值。
     */
    info(...args) {
      // 执行内容: info 只接受 message/details 两项，禁止夹带 sourceId 或级别覆盖。
      assertExactArgumentCount(args, 2, 'logger.info');

      // 类型: Array<*>。
      // 作用: 读取消息和详情，sourceId/level 由闭包和当前方法固定。
      const [message, details] = args;

      // 执行内容: 规范化、脱敏并有界写入当前 sourceId 的 info 条目。
      appendLogEntry(entries, sourceId, SOURCE_LOG_LEVEL.info, message, details);
    },

    /**
     * 写入 warn 降级日志。
     * 副作用: 向当前控制器私有有界数组追加脱敏 warn 条目。
     * 成功路径: 追加后不返回内部条目。
     * 失败路径: 参数、消息、details 或容量不合法时抛稳定 Shell 错误。
     *
     * @param {...*} args 精确包含 message 和 details。
     * @returns {void} 写入成功不返回业务值。
     */
    warn(...args) {
      // 执行内容: warn 只接受 message/details 两项，禁止夹带 sourceId 或级别覆盖。
      assertExactArgumentCount(args, 2, 'logger.warn');

      // 类型: Array<*>。
      // 作用: 读取消息和详情，sourceId/level 由闭包和当前方法固定。
      const [message, details] = args;

      // 执行内容: 规范化、脱敏并有界写入当前 sourceId 的 warn 条目。
      appendLogEntry(entries, sourceId, SOURCE_LOG_LEVEL.warn, message, details);
    },

    /**
     * 写入 error 失败日志。
     * 副作用: 向当前控制器私有有界数组追加脱敏 error 条目。
     * 成功路径: 追加后不返回内部条目。
     * 失败路径: 参数、消息、details 或容量不合法时抛稳定 Shell 错误。
     *
     * @param {...*} args 精确包含 message 和 details。
     * @returns {void} 写入成功不返回业务值。
     */
    error(...args) {
      // 执行内容: error 只接受 message/details 两项，禁止夹带 sourceId 或级别覆盖。
      assertExactArgumentCount(args, 2, 'logger.error');

      // 类型: Array<*>。
      // 作用: 读取消息和详情，sourceId/level 由闭包和当前方法固定。
      const [message, details] = args;

      // 执行内容: 规范化、脱敏并有界写入当前 sourceId 的 error 条目。
      appendLogEntry(entries, sourceId, SOURCE_LOG_LEVEL.error, message, details);
    }
  });

  // 返回值类型: object。
  // 作用: 返回权限分离控制器；SourceContext 只能采用 logger，Host 后续保留读取和清理方法。
  return Object.freeze({
    // 类型: string。
    // 作用: 供 SourceContext 验证 logger 与其他能力绑定同一 sourceId。
    sourceId,

    // 类型: object。
    // 作用: 提供四个只写方法给 SourceContext，不暴露内部 entries。
    logger,

    /**
     * 读取当前有界日志隔离快照。
     * 纯函数: 克隆并深度冻结内部数组，不修改或暴露 entries 引用。
     * 成功路径: 返回按写入顺序排列的只读 SourceLogEntry 数组。
     * 失败路径: 额外参数被精确参数门禁拒绝。
     *
     * @param {...*} args 必须为空数组。
     * @returns {Array<object>} 与内部状态隔离的深冻结日志快照。
     */
    getEntries(...args) {
      // 执行内容: 读取方法不接受筛选器、sourceId 或内部数组替换参数。
      assertExactArgumentCount(args, 0, 'sourceLogger.getEntries');

      // 类型: Array<object>。
      // 作用: 创建与私有 entries 及其 details 完全隔离的严格 JSON 副本。
      const snapshot = cloneSerializableValue(entries, 'sourceLogger.entries');

      // 返回值类型: Array<object>。
      // 作用: 深度冻结隔离副本，Host 读取后不能修改快照结构或嵌套 details。
      return freezeSerializableValue(snapshot);
    },

    /**
     * 清理当前控制器全部日志。
     * 副作用: 删除私有 entries 中全部条目，不修改策略、logger 方法或其他控制器。
     * 成功路径: 返回清理前条数。
     * 失败路径: 额外参数被精确参数门禁拒绝，清理前不修改数组。
     *
     * @param {...*} args 必须为空数组。
     * @returns {number} 清理前的日志条数。
     */
    clear(...args) {
      // 执行内容: 清理方法不接受 sourceId、范围或替换数组参数。
      assertExactArgumentCount(args, 0, 'sourceLogger.clear');

      // 类型: number。
      // 作用: 保存清理前条数，供 Host 判断是否真实释放诊断记录。
      const clearedCount = entries.length;

      // 副作用范围: 只删除当前控制器私有 entries 全部成员，不影响已返回快照。
      entries.splice(0, entries.length);

      // 返回值类型: number。
      // 作用: 返回清理前条数，空数组时为零。
      return clearedCount;
    }
  });
}
