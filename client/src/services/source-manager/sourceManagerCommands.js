/*
  sourceManagerCommands.js 模块说明

  - 文件职责:
      提供 SourceManager 公共命令使用的严格 Boolean、sourceId 集合和默认源交接校验。
      供后续领域事务在进入 Repository Unit of Work 前统一拒绝模糊或危险输入。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      DEFAULT_SOURCE_HANDOFF_MODE: 自定义配置，默认源交接枚举。
      assertPlainObject、assertSafeRecordKey、assertSerializableJsonValue: 自定义校验，复用严格对象、危险键和无损 JSON 边界。
      SourceManagerValidationError: 自定义错误，统一命令校验失败。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      wrapValidation(action): Function，把 Repository 通用校验错误转换为 SourceManager 校验错误。

  - 模块级类:
      无

  - 对外导出:
      assertSourceManagerBoolean、normalizeSourceIds、normalizeDefaultSourceHandoff: Function，公共命令输入校验函数。
*/

// 导入来源: ../../config/source-manager.config。
// 导入内容: DEFAULT_SOURCE_HANDOFF_MODE 默认源交接枚举。
// 文件作用: 只接受 replace 和 clear 两种明确交接模式。
import { DEFAULT_SOURCE_HANDOFF_MODE } from '../../config/source-manager.config.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryValidators。
  // 导入内容: assertPlainObject 严格普通对象校验函数。
  // 文件作用: 拒绝数组、复杂实例和异常原型交接对象。
  assertPlainObject,
  // 导入来源: ../../repositories/source/sourceRepositoryValidators。
  // 导入内容: assertSafeRecordKey 动态键校验函数。
  // 文件作用: 统一拒绝空 sourceId 和危险动态键。
  assertSafeRecordKey,
  // 导入来源: ../../repositories/source/sourceRepositoryValidators。
  // 导入内容: assertSerializableJsonValue 严格 JSON Value 校验函数。
  // 文件作用: 拒绝稀疏数组、Symbol、隐藏字段、访问器和循环命令输入。
  assertSerializableJsonValue
} from '../../repositories/source/sourceRepositoryValidators.js';

// 导入来源: ./sourceManagerErrors。
// 导入内容: SourceManagerValidationError SourceManager 校验错误。
// 文件作用: 把公共命令校验失败统一转换为稳定 SourceManager 错误。
import { SourceManagerValidationError } from './sourceManagerErrors.js';

/**
 * 执行 Repository 层通用严格校验并转换错误边界。
 * 纯函数: 除执行 action 外不修改外部状态。
 * 失败路径: 把底层 ValidationError 转换为 SourceManagerValidationError，并保留 cause。
 *
 * @param {Function} action 严格校验回调。
 * @returns {*} 原校验结果。
 * @throws {SourceManagerValidationError} 当 action 拒绝输入时抛出。
 */
function wrapValidation(action) {
  try {
    // 返回值类型: any。
    // 作用: 校验成功时原样返回隔离前的稳定值。
    return action();
  } catch (error) {
    // 错误类型: SourceManagerValidationError。
    // 作用: 统一上层错误类型，同时保留底层严格校验失败作为 cause。
    throw new SourceManagerValidationError(error.message, { cause: error });
  }
}

/**
 * 校验 SourceManager 命令中的严格 Boolean。
 * 纯函数: 不修改输入，不使用 Boolean(input) 静默强制转换。
 *
 * @param {*} value 待校验值。
 * @param {string} fieldName 错误信息使用的字段名。
 * @returns {boolean} 原始 Boolean；true 和 false 均保持原语义。
 * @throws {SourceManagerValidationError} 当 value 不是 Boolean 时抛出。
 */
export function assertSourceManagerBoolean(value, fieldName) {
  // 条件分支: value 不是严格 Boolean 时进入。
  // 执行内容: 拒绝 0、1、空字符串和其他可被强制转换的模糊输入。
  if (typeof value !== 'boolean') {
    throw new SourceManagerValidationError(`${fieldName} 必须是 boolean`);
  }

  // 返回值类型: boolean。
  // 作用: true 保持开启语义，false 保持关闭语义，不改变调用方决定。
  return value;
}

/**
 * 校验、去重并隔离 sourceId 集合。
 * 纯函数: 返回新数组，不修改调用方数组。
 *
 * @param {*} sourceIds 命令传入的数据源 id 集合。
 * @returns {Array<string>} 保持首次出现顺序的去重 sourceId 数组。
 * @throws {SourceManagerValidationError} 当输入为空、不是数组或包含危险 sourceId 时抛出。
 */
export function normalizeSourceIds(sourceIds) {
  // 执行内容: 在数组判断前拒绝稀疏项、附加属性、Symbol 和其他会被 JSON 静默改写的输入。
  wrapValidation(() => assertSerializableJsonValue(sourceIds, 'sourceIds'));

  // 条件分支: 输入不是非空数组时进入。
  // 执行内容: 拒绝模糊空操作，避免批量事务静默返回部分结果。
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    throw new SourceManagerValidationError('sourceIds 必须是非空数组');
  }

  // 类型: Array<string>。
  // 作用: 逐项执行动态键安全校验，并保留原始调用顺序。
  const validatedSourceIds = sourceIds.map((sourceId, index) => wrapValidation(
    () => assertSafeRecordKey(sourceId, `sourceIds[${index}]`)
  ));

  // 返回值类型: Array<string>。
  // 作用: 使用 Set 去重并创建新数组，整批删除和恢复不会重复处理同一数据源。
  return [...new Set(validatedSourceIds)];
}

/**
 * 校验 replace/clear 默认源交接并返回隔离对象。
 * 纯函数: 返回新对象，不修改调用方 handoff。
 *
 * @param {*} handoff 默认源交接命令。
 * @returns {object} 字段完整的 replace 或 clear 交接对象。
 * @throws {SourceManagerValidationError} 当模式、字段集合或接替 sourceId 不符合契约时抛出。
 */
export function normalizeDefaultSourceHandoff(handoff) {
  // 执行内容: 先拒绝隐藏字段、访问器、Symbol 和不可序列化值，避免精确字段检查存在盲区。
  wrapValidation(() => assertSerializableJsonValue(handoff, 'handoff'));

  // 执行内容: 先拒绝数组、复杂实例和异常原型，后续字段读取只基于严格普通对象。
  wrapValidation(() => assertPlainObject(handoff, 'handoff'));

  // 类型: Array<string>。
  // 作用: 用于执行精确字段集合校验，阻止未知兼容字段进入事务命令。
  const keys = Object.keys(handoff);

  // 条件分支: 用户明确接受无默认源结果时进入。
  // 执行内容: clear 只能包含 mode，禁止同时携带容易被误解的 sourceId。
  if (handoff.mode === DEFAULT_SOURCE_HANDOFF_MODE.clear) {
    // 条件分支: clear 命令包含 mode 之外的字段，或唯一字段不是 mode 时进入。
    // 执行内容: 拒绝携带 sourceId 和未知扩展字段，保证无默认源决定没有第二种解释。
    if (keys.length !== 1 || keys[0] !== 'mode') {
      throw new SourceManagerValidationError('clear 交接只能包含 mode');
    }

    // 返回值类型: object。
    // 作用: 返回隔离 clear 命令，后续事务把 defaultSourceId 收敛为空字符串。
    return { mode: DEFAULT_SOURCE_HANDOFF_MODE.clear };
  }

  // 条件分支: 用户选择另一个数据源接替默认源时进入。
  // 执行内容: replace 必须且只能提供 mode 和 sourceId。
  if (handoff.mode === DEFAULT_SOURCE_HANDOFF_MODE.replace) {
    // 条件分支: replace 命令缺少固定字段或包含额外字段时进入。
    // 执行内容: 拒绝不完整候选和未经契约设计的兼容字段，避免事务误读交接目标。
    if (keys.length !== 2 || !keys.includes('mode') || !keys.includes('sourceId')) {
      throw new SourceManagerValidationError('replace 交接必须只包含 mode 和 sourceId');
    }

    // 类型: string。
    // 作用: 校验接替数据源 id 非空且不包含危险动态键名称。
    const sourceId = wrapValidation(
      () => assertSafeRecordKey(handoff.sourceId, 'handoff.sourceId')
    );

    // 返回值类型: object。
    // 作用: 返回隔离 replace 命令，后续事务继续验证候选是否存在、可见且有效启用。
    return {
      mode: DEFAULT_SOURCE_HANDOFF_MODE.replace,
      sourceId
    };
  }

  // 错误类型: SourceManagerValidationError。
  // 作用: 拒绝 allowNoDefault 等未冻结模式，确保交接目标明确可验证。
  throw new SourceManagerValidationError('handoff.mode 只允许 replace 或 clear');
}
