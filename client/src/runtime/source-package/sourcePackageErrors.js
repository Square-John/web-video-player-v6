/*
  sourcePackageErrors.js 模块说明

  - 文件职责:
      定义单文件 Provider 读取、预检、信任、执行和注册边界共用的安全错误对象。
      错误只向上层公开 code、stage、message 和 field，不携带脚本文本、响应体、凭据、cause 或内部堆栈字段。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      SOURCE_PACKAGE_ERROR_CODE、SOURCE_PACKAGE_LOAD_STAGE: 自定义配置，限定错误分类和加载阶段。
      cloneSerializableValue: 自定义工具，隔离页面可读错误结果。

  - 模块级常量:
      SOURCE_PACKAGE_LOAD_ERROR_FIELDS: Array<string>，安全错误结果精确字段集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertEnumMember(value, enumObject, fieldName): 校验错误分类或阶段属于冻结枚举。

  - 模块级类:
      SourcePackageLoadError: 单文件加载稳定错误，保留安全公开字段。

  - 对外导出:
      SourcePackageLoadError: Class，供 source-package 各端口抛出稳定错误。
      createSourcePackageLoadError(options): Function，创建或复用安全加载错误。
      toSourcePackageErrorResult(error): Function，向页面返回精确四字段隔离对象。
*/

import {
  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_ERROR_CODE 稳定错误码枚举。
  // 文件作用: 构造器拒绝调用点临时发明错误分类。
  SOURCE_PACKAGE_ERROR_CODE,

  // 导入来源: ./sourcePackage.config.js。
  // 导入内容: SOURCE_PACKAGE_LOAD_STAGE 稳定加载阶段枚举。
  // 文件作用: 错误结果明确失败发生在读取、校验、执行或补偿的哪个边界。
  SOURCE_PACKAGE_LOAD_STAGE
} from './sourcePackage.config.js';

// 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON 隔离工具。
// 文件作用: 页面错误结果不共享 Error 实例或调用方可变引用。
import { cloneSerializableValue } from '../../repositories/source/sourceRepositoryUtils.js';

// 类型: Array<string>。
// 作用: 页面只接收四个安全字段，不能夹带脚本、内部 cause、响应或堆栈。
const SOURCE_PACKAGE_LOAD_ERROR_FIELDS = Object.freeze([
  'code',
  'stage',
  'message',
  'field'
]);

/**
 * 校验值属于冻结枚举。
 * 纯函数: 只读取输入和枚举，不修改任何对象。
 * 失败路径: 未知值抛 TypeError，阻止错误边界本身产生无法分类的结果。
 *
 * @param {*} value 待校验枚举值。
 * @param {object} enumObject 冻结枚举对象。
 * @param {string} fieldName 诊断字段名。
 * @returns {string} 原受控字符串。
 * @throws {TypeError} 当值不属于枚举时抛出。
 */
function assertEnumMember(value, enumObject, fieldName) {
  // 条件分支: 值不是枚举中任一稳定字符串时进入。
  // 执行内容: 立即拒绝调用点拼写错误或协议外扩展。
  if (!Object.values(enumObject).includes(value)) {
    throw new TypeError(`${fieldName} 不属于冻结枚举`);
  }

  return value;
}

/**
 * 单文件 Provider 加载稳定错误。
 * 状态所有权: 实例只保存安全公开分类，不保存底层错误或可执行输入引用。
 * 使用场景: 输入读取器、AST 预检器、模块执行器和协调加载器统一失败出口。
 */
export class SourcePackageLoadError extends Error {
  /**
   * 创建安全加载错误。
   * 副作用: 初始化当前 Error 的 message、name、code、stage 和 field。
   * 失败路径: code/stage 未冻结、message/field 类型非法时抛 TypeError。
   *
   * @param {object} options 错误字段。
   * @param {string} options.code SOURCE_PACKAGE_ERROR_CODE 中的稳定值。
   * @param {string} options.stage SOURCE_PACKAGE_LOAD_STAGE 中的稳定值。
   * @param {string} options.message 不含敏感输入的用户可读说明。
   * @param {string} options.field 可公开的最小字段路径；没有时为空字符串。
   */
  constructor({ code, stage, message, field = '' }) {
    // 条件分支: message 不是非空字符串时进入。
    // 执行内容: 拒绝空错误说明，页面不需要从 code 临时拼接文案。
    if (typeof message !== 'string' || message.trim() === '') {
      throw new TypeError('SourcePackageLoadError.message 必须是非空字符串');
    }

    // 条件分支: field 不是字符串时进入。
    // 执行内容: 拒绝对象或数组字段路径，防止错误结果携带输入片段。
    if (typeof field !== 'string') {
      throw new TypeError('SourcePackageLoadError.field 必须是字符串');
    }

    super(message);
    this.name = 'SourcePackageLoadError';
    this.code = assertEnumMember(code, SOURCE_PACKAGE_ERROR_CODE, 'SourcePackageLoadError.code');
    this.stage = assertEnumMember(stage, SOURCE_PACKAGE_LOAD_STAGE, 'SourcePackageLoadError.stage');
    this.field = field;
  }
}

/**
 * 创建安全加载错误，已经分类的错误保持原实例。
 * 纯函数: 不读取底层错误 message、cause 或 stack，避免非安全细节穿透到页面。
 *
 * @param {object} options 安全错误字段。
 * @param {*} options.error 可选底层失败；只用于识别 SourcePackageLoadError。
 * @param {string} options.code 稳定错误码。
 * @param {string} options.stage 稳定加载阶段。
 * @param {string} options.message 安全用户说明。
 * @param {string} options.field 安全字段路径。
 * @returns {SourcePackageLoadError} 原稳定错误或新错误。
 */
export function createSourcePackageLoadError({ error, code, stage, message, field = '' }) {
  // 条件分支: 下层已经给出完整稳定错误时进入。
  // 执行内容: 原样保留分类和字段，不重复包装或读取内部异常详情。
  if (error instanceof SourcePackageLoadError) {
    return error;
  }

  return new SourcePackageLoadError({ code, stage, message, field });
}

/**
 * 把加载错误转换为页面可读取的精确四字段结果。
 * 纯函数: 返回严格 JSON 隔离副本，不暴露 Error 原型、stack 或未来附加字段。
 * 失败路径: 非 SourcePackageLoadError 抛 TypeError，未知错误必须先在所属边界分类。
 *
 * @param {*} error 单文件加载错误候选。
 * @returns {object} code、stage、message 和 field 精确错误结果。
 */
export function toSourcePackageErrorResult(error) {
  // 条件分支: 调用方试图直接公开未知 Error 时进入。
  // 执行内容: 失败关闭，要求所属端口先提供稳定安全分类。
  if (!(error instanceof SourcePackageLoadError)) {
    throw new TypeError('只能公开 SourcePackageLoadError');
  }

  // 类型: object。
  // 作用: 只挑选四个冻结字段，不依赖 Error 的可枚举属性行为。
  const result = Object.fromEntries(SOURCE_PACKAGE_LOAD_ERROR_FIELDS.map(fieldName => [
    fieldName,
    error[fieldName]
  ]));

  return cloneSerializableValue(result, 'sourcePackageLoadError');
}
