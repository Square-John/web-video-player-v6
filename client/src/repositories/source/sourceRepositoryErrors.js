/*
  sourceRepositoryErrors.js 模块说明

  - 文件职责:
      定义数据源 Repository 统一领域错误。
      供三个 Memory Repository、Unit of Work 和 SourceManager 区分校验、冲突与事务失败。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SOURCE_REPOSITORY_ERROR_CODE: object，Repository 错误码枚举。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      SourceRepositoryError: Repository 领域错误基类。
      SourceRepositoryValidationError: 参数和对象结构校验错误。
      SourceRepositoryConflictError: 唯一引用或跨对象关联冲突错误。
      SourceRepositoryTransactionError: 跨 Repository 事务失败错误。

  - 对外导出:
      SOURCE_REPOSITORY_ERROR_CODE: object，稳定错误码枚举。
      SourceRepositoryError: Class，Repository 领域错误基类。
      SourceRepositoryValidationError: Class，校验错误。
      SourceRepositoryConflictError: Class，冲突错误。
      SourceRepositoryTransactionError: Class，事务错误。
*/

// 类型: object。
// 作用: 统一 Repository 失败类型，调用方不得依赖易变化的错误文案判断分支。
export const SOURCE_REPOSITORY_ERROR_CODE = Object.freeze({
  // 类型: string；作用: 标识参数、分区、键、值或保存对象结构不符合契约。
  validation: 'SOURCE_REPOSITORY_VALIDATION_ERROR',
  // 类型: string；作用: 标识 packageRef、sourceId 或关联对象出现唯一性冲突。
  conflict: 'SOURCE_REPOSITORY_CONFLICT_ERROR',
  // 类型: string；作用: 标识 Unit of Work executor 失败并已经执行回滚。
  transaction: 'SOURCE_REPOSITORY_TRANSACTION_ERROR'
});

/**
 * 数据源 Repository 领域错误基类。
 * 职责: 保存稳定 code、用户可读 message 和原始 cause，不修改 Repository 状态。
 * 使用场景: 上层通过 instanceof 或 code 区分领域失败，不解析错误文案。
 */
export class SourceRepositoryError extends Error {
  /**
   * 创建 Repository 领域错误。
   *
   * @param {string} message 错误说明。
   * @param {string} code 稳定错误码。
   * @param {object} options 可选错误上下文。
   * @param {*} options.cause 原始异常；没有原始异常时为 undefined。
   */
  constructor(message, code, options = {}) {
    // 执行内容: 让原生 Error 保存 message 和标准 cause，供日志与上层诊断追踪原始失败。
    super(message, options.cause === undefined ? undefined : { cause: options.cause });

    // 类型: string。
    // 作用: 使用实际子类名称覆盖 Error，便于堆栈和上层调用方识别错误类型。
    this.name = new.target.name;

    // 类型: string。
    // 作用: 保存稳定领域错误码，避免上层依赖中文文案。
    this.code = code;
  }
}

/**
 * Repository 校验错误。
 * 触发条件: 必填字符串、普通对象、分区、键或可序列化值不符合契约。
 */
export class SourceRepositoryValidationError extends SourceRepositoryError {
  /**
   * 创建校验错误。
   *
   * @param {string} message 校验失败说明。
   * @param {object} options 可选错误上下文。
   */
  constructor(message, options = {}) {
    super(message, SOURCE_REPOSITORY_ERROR_CODE.validation, options);
  }
}

/**
 * Repository 唯一关联冲突错误。
 * 触发条件: 同一 packageRef 指向不同 sourceId，或多个 Definition 复用同一 packageRef。
 */
export class SourceRepositoryConflictError extends SourceRepositoryError {
  /**
   * 创建冲突错误。
   *
   * @param {string} message 冲突说明。
   * @param {object} options 可选错误上下文。
   */
  constructor(message, options = {}) {
    super(message, SOURCE_REPOSITORY_ERROR_CODE.conflict, options);
  }
}

/**
 * Repository 跨仓事务错误。
 * 触发条件: Unit of Work executor 抛错，三个 Repository 快照已经恢复。
 */
export class SourceRepositoryTransactionError extends SourceRepositoryError {
  /**
   * 创建事务错误并保留原始 cause。
   *
   * @param {string} message 事务失败说明。
   * @param {*} cause executor 抛出的原始异常。
   */
  constructor(message, cause) {
    super(message, SOURCE_REPOSITORY_ERROR_CODE.transaction, { cause });
  }
}
