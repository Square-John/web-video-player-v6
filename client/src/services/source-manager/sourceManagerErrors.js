/*
  sourceManagerErrors.js 模块说明

  - 文件职责:
      定义 SourceManager 稳定领域错误码、基类和五类具体错误。
      供命令校验、检测端口、领域事务和设置适配层按 code/instanceof 判断失败。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SOURCE_MANAGER_ERROR_CODE: object，SourceManager 稳定错误码枚举。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      SourceManagerError: SourceManager 领域错误基类。
      SourceManagerValidationError、SourceManagerNotFoundError、SourceManagerInvariantError、SourceManagerInitializationError、SourceManagerOperationError: 具体领域错误。

  - 对外导出:
      SOURCE_MANAGER_ERROR_CODE: object，稳定错误码枚举。
      SourceManagerError 及五类具体错误: Class，SourceManager 标准失败对象。
*/

// 类型: object。
// 作用: 固定 SourceManager 失败类型，调用方不得解析中文 message 决定分支。
export const SOURCE_MANAGER_ERROR_CODE = Object.freeze({
  // 类型: string；作用: 标识命令字段、Boolean、sourceId、交接或端口结果不符合契约。
  validation: 'SOURCE_MANAGER_VALIDATION_ERROR',
  // 类型: string；作用: 标识指定数据源、Package、Definition 或受管对象不存在。
  notFound: 'SOURCE_MANAGER_NOT_FOUND',
  // 类型: string；作用: 标识授权、默认源、重复导入或跨对象关系违反领域不变量。
  invariant: 'SOURCE_MANAGER_INVARIANT_ERROR',
  // 类型: string；作用: 标识 Repository 整体载入失败，无法建立安全初始投影。
  initialization: 'SOURCE_MANAGER_INITIALIZATION_ERROR',
  // 类型: string；作用: 标识事务、检测端口或重新组装执行失败。
  operation: 'SOURCE_MANAGER_OPERATION_ERROR'
});

/**
 * SourceManager 领域错误基类。
 * 职责: 保存稳定 code、可读 message 和可追踪 cause，不修改 SourceManager 或 Repository 状态。
 * 使用场景: 上层通过 instanceof 或 code 判断失败类型，不能解析中文错误文案。
 */
export class SourceManagerError extends Error {
  /**
   * 创建 SourceManager 领域错误。
   *
   * @param {string} message 错误说明。
   * @param {string} code 稳定错误码。
   * @param {object} options 可选错误上下文。
   * @param {*} options.cause 原始异常；没有原始异常时为 undefined。
   */
  constructor(message, code, options = {}) {
    // 执行内容: 让原生 Error 保存 message 和标准 cause，供日志与后续诊断追踪原始失败。
    super(message, options.cause === undefined ? undefined : { cause: options.cause });

    // 类型: string。
    // 作用: 使用实际子类名称覆盖 Error，便于堆栈和上层调用方识别具体错误类型。
    this.name = new.target.name;

    // 类型: string。
    // 作用: 保存稳定领域错误码，避免调用方依赖易变化的中文文案。
    this.code = code;
  }
}

/**
 * SourceManager 命令和端口结果校验错误。
 * 触发条件: Boolean、sourceId、交接对象、端口或标准结果不符合契约。
 */
export class SourceManagerValidationError extends SourceManagerError {
  /**
   * 创建 SourceManager 校验错误。
   *
   * @param {string} message 校验失败说明。
   * @param {object} options 可选错误上下文。
   */
  constructor(message, options = {}) {
    super(message, SOURCE_MANAGER_ERROR_CODE.validation, options);
  }
}

/**
 * SourceManager 领域对象未找到错误。
 * 触发条件: 指定数据源、Package、Definition 或受管对象不存在。
 */
export class SourceManagerNotFoundError extends SourceManagerError {
  /**
   * 创建 SourceManager 未找到错误。
   *
   * @param {string} message 未命中说明。
   * @param {object} options 可选错误上下文。
   */
  constructor(message, options = {}) {
    super(message, SOURCE_MANAGER_ERROR_CODE.notFound, options);
  }
}

/**
 * SourceManager 领域不变量错误。
 * 触发条件: 授权、默认源、重复导入或跨对象关系不允许当前操作。
 */
export class SourceManagerInvariantError extends SourceManagerError {
  /**
   * 创建 SourceManager 不变量错误。
   *
   * @param {string} message 不变量失败说明。
   * @param {object} options 可选错误上下文。
   */
  constructor(message, options = {}) {
    super(message, SOURCE_MANAGER_ERROR_CODE.invariant, options);
  }
}

/**
 * SourceManager 初始化错误。
 * 触发条件: Repository 整体载入失败，无法建立任何安全投影。
 */
export class SourceManagerInitializationError extends SourceManagerError {
  /**
   * 创建 SourceManager 初始化错误并保留原始异常。
   *
   * @param {string} message 初始化失败说明。
   * @param {*} cause 原始异常。
   */
  constructor(message, cause) {
    super(message, SOURCE_MANAGER_ERROR_CODE.initialization, { cause });
  }
}

/**
 * SourceManager 领域操作错误。
 * 触发条件: 事务、检测端口或重新组装失败。
 */
export class SourceManagerOperationError extends SourceManagerError {
  /**
   * 创建 SourceManager 操作错误并保留原始异常。
   *
   * @param {string} message 操作失败说明。
   * @param {*} cause 原始异常。
   */
  constructor(message, cause) {
    super(message, SOURCE_MANAGER_ERROR_CODE.operation, { cause });
  }
}
