/*
  sourceManagementErrors.js 模块说明

  - 文件职责:
      定义设置管理输入适配、更新端口、生命周期协调和失败补偿使用的稳定错误边界。
      供 SourceManagementInputAdapter、MockSourceUpdatePort、SourceManagementRuntime 和集成测试按 code 或具体类型识别失败。
      错误对象只描述失败，不修改 Repository、SourceManagerState、Host、Provider、store 或页面状态。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SOURCE_MANAGEMENT_ERROR_CODE: object，设置管理边界稳定错误码枚举。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      SourceManagementError: Error，设置管理稳定错误基类。
      SourceManagementValidationError: SourceManagementError，输入、依赖或端口结果校验错误。
      SourceManagementNotFoundError: SourceManagementError，记录或模拟更新候选未命中错误。
      SourceManagementOperationError: SourceManagementError，Manager 或 Host 主操作失败错误。
      SourceManagementCompensationError: SourceManagementError，主操作失败后补偿也失败的组合错误。

  - 对外导出:
      SOURCE_MANAGEMENT_ERROR_CODE: object，供调用方识别失败类别的冻结枚举。
      SourceManagementError 及四个具体子类: Class，设置管理层标准失败对象。
*/

// 类型: object。
// 作用: 固定设置管理失败分类；service 和页面不能解析中文 message 决定交互或恢复分支。
export const SOURCE_MANAGEMENT_ERROR_CODE = Object.freeze({
  // 类型: string。
  // 作用: 标识输入字段、构造依赖、领域对象或端口结果不符合精确契约。
  validation: 'SOURCE_MANAGEMENT_VALIDATION_ERROR',

  // 类型: string。
  // 作用: 标识目标 SourceRecord、模拟更新检测结果或受审更新候选不存在。
  notFound: 'SOURCE_MANAGEMENT_NOT_FOUND',

  // 类型: string。
  // 作用: 标识 Manager 事务、Host 生命周期或更新端口主操作执行失败。
  operation: 'SOURCE_MANAGEMENT_OPERATION_ERROR',

  // 类型: string。
  // 作用: 标识主操作失败后，关闭或恢复运行集合的补偿操作也失败。
  compensation: 'SOURCE_MANAGEMENT_COMPENSATION_ERROR'
});

/**
 * 设置管理稳定错误基类。
 * 职责: 保存固定 code、可读 message 和可追踪 cause，不执行任何领域或生命周期补偿。
 * 使用场景: 上层通过 instanceof 或 code 区分输入、未命中、主操作和补偿失败。
 */
export class SourceManagementError extends Error {
  /**
   * 创建设置管理错误。
   * 副作用: 只初始化当前 Error 实例的 message、name、code 和可选 cause。
   * 成功路径: 返回可跨 Runtime 与 service 边界识别的稳定错误对象。
   * 失败路径: 构造参数由模块内部具体子类提供，本构造器不主动执行领域校验。
   *
   * @param {string} message 面向开发诊断的错误说明，调用方不能据此决定分支。
   * @param {string} code SOURCE_MANAGEMENT_ERROR_CODE 中的稳定错误码。
   * @param {object} options 可选错误上下文。
   * @param {*} options.cause 可选底层失败，用于保留原始分类和调用栈。
   */
  constructor(message, code, options = {}) {
    // 执行内容: 使用标准 Error 保存 message，并在存在底层失败时建立原生 cause 链。
    super(message, options.cause === undefined ? undefined : { cause: options.cause });

    // 类型: string。
    // 作用: 使用实际子类名称覆盖 Error，便于日志和上层调用方识别具体管理失败类型。
    this.name = new.target.name;

    // 类型: string。
    // 作用: 保存跨层稳定错误码，调用方无需依赖可能调整的中文错误说明。
    this.code = code;
  }
}

/**
 * 设置管理输入和依赖校验错误。
 * 触发条件: 页面输入、SourceRecord、更新候选、构造依赖或返回对象不符合冻结契约。
 */
export class SourceManagementValidationError extends SourceManagementError {
  /**
   * 创建设置管理校验错误。
   * 副作用: 只创建错误对象，不进入 Manager FIFO、Repository 或 Host 生命周期。
   *
   * @param {string} message 校验失败说明。
   * @param {object} options 可选错误上下文。
   * @param {*} options.cause 可选底层严格校验错误。
   */
  constructor(message, options = {}) {
    // 执行内容: 使用固定 validation code 创建具体错误并保留可选 cause。
    super(message, SOURCE_MANAGEMENT_ERROR_CODE.validation, options);
  }
}

/**
 * 设置管理目标未命中错误。
 * 触发条件: SourceManagerState 没有目标记录，或模拟更新端口没有对应检测结果和候选。
 */
export class SourceManagementNotFoundError extends SourceManagementError {
  /**
   * 创建设置管理未命中错误。
   * 副作用: 只创建错误对象，不伪造默认候选或回退到其他 sourceId。
   *
   * @param {string} message 未命中说明。
   * @param {object} options 可选错误上下文。
   * @param {*} options.cause 可选底层未命中错误。
   */
  constructor(message, options = {}) {
    // 执行内容: 使用固定 notFound code 创建具体错误并保留可选 cause。
    super(message, SOURCE_MANAGEMENT_ERROR_CODE.notFound, options);
  }
}

/**
 * 设置管理主操作错误。
 * 触发条件: 更新端口、SourceManager 事务或 Host 生命周期操作失败且补偿边界已经收敛。
 */
export class SourceManagementOperationError extends SourceManagementError {
  /**
   * 创建设置管理主操作错误。
   * 副作用: 只包装已经完成或无需补偿的失败，不自行重试 Manager 或 Host。
   *
   * @param {string} message 主操作失败说明。
   * @param {*} cause Manager、Host 或端口原始失败。
   */
  constructor(message, cause) {
    // 执行内容: 使用固定 operation code 包装主操作失败，并保留原始 cause。
    super(message, SOURCE_MANAGEMENT_ERROR_CODE.operation, { cause });
  }
}

/**
 * 设置管理补偿失败错误。
 * 触发条件: 主操作已经失败，随后用于关闭提交或恢复真实 running 集合的补偿也失败。
 * 维护边界: cause 保存补偿失败；operationCause 单独保存触发补偿的原始主操作失败。
 */
export class SourceManagementCompensationError extends SourceManagementError {
  /**
   * 创建设置管理补偿失败错误。
   * 副作用: 只保存两段失败信息，不继续执行新的隐式重试或直接修改内部状态。
   *
   * @param {string} message 补偿失败说明。
   * @param {*} operationCause 触发补偿的 Manager、Host 或端口原始失败。
   * @param {*} compensationCause 关闭或恢复补偿本身的失败。
   */
  constructor(message, operationCause, compensationCause) {
    // 执行内容: 让标准 cause 指向最后一次补偿失败，便于错误链定位当前未收敛原因。
    super(message, SOURCE_MANAGEMENT_ERROR_CODE.compensation, {
      cause: compensationCause
    });

    // 类型: *。
    // 作用: 保存触发补偿的原始主操作失败，使诊断同时保留主因和补偿失败原因。
    this.operationCause = operationCause;
  }
}
