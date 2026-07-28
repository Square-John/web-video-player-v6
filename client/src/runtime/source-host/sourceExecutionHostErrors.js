/*
  sourceExecutionHostErrors.js 模块说明

  - 文件职责:
      定义 SourceExecutionHost 参数、未命中、冲突、门禁、状态、中止和生命周期失败的稳定错误类型。
      所有错误保留固定 code；生命周期包装可以保留原始 cause，但页面和 service 不能解析错误文案决定分支。
      供可信工厂注册表、SourceExecutionHost、SourceRuntime 和 Host 测试统一识别失败类别。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SOURCE_EXECUTION_HOST_ERROR_CODE: object，Host 稳定错误码枚举。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      SourceExecutionHostError: Host 错误基类，统一 name、code 和 cause。
      SourceExecutionHostValidationError: Host 输入结构错误。
      SourceExecutionHostNotFoundError: 工厂、数据集或受管实例未命中。
      SourceExecutionHostConflictError: 重复注册或重复初始化冲突。
      SourceExecutionHostGateRejectedError: 数据源运行门禁拒绝。
      SourceExecutionHostInvalidStateError: 当前生命周期阶段不允许操作。
      SourceExecutionHostCallAbortedError: 中止或过期结果不可采用。
      SourceExecutionHostLifecycleError: Provider 生命周期执行失败。

  - 对外导出:
      SOURCE_EXECUTION_HOST_ERROR_CODE: object，Host 稳定错误码枚举。
      SourceExecutionHostError 及七个具体子类: Class，Host 稳定错误类型。
*/

// 类型: object。
// 作用: 固定 Host 失败分类；上层只能按 code 或具体错误类型处理，不能依赖中文 message。
export const SOURCE_EXECUTION_HOST_ERROR_CODE = Object.freeze({
  // 类型: string。
  // 作用: 标识 sourceId、record、gateContext、工厂或调用参数不符合精确契约。
  validation: 'SOURCE_EXECUTION_HOST_VALIDATION_ERROR',

  // 类型: string。
  // 作用: 标识 providerKey、数据集、sourceId 或受管实例不存在。
  notFound: 'SOURCE_EXECUTION_HOST_NOT_FOUND',

  // 类型: string。
  // 作用: 标识工厂重复注册、sourceId 重复初始化或同一身份冲突。
  conflict: 'SOURCE_EXECUTION_HOST_CONFLICT',

  // 类型: string。
  // 作用: 标识禁用、软隐藏、缺包、空指纹、授权无效或缺少受审数据集。
  gateRejected: 'SOURCE_EXECUTION_HOST_GATE_REJECTED',

  // 类型: string。
  // 作用: 标识当前 Host phase 不允许目标生命周期或业务调用。
  invalidState: 'SOURCE_EXECUTION_HOST_INVALID_STATE',

  // 类型: string。
  // 作用: 标识 signal 中止、生命周期代次变化或停止后的候选结果不可采用。
  callAborted: 'SOURCE_EXECUTION_HOST_CALL_ABORTED',

  // 类型: string。
  // 作用: 标识 Provider initialize、start、stop、dispose 或清理过程失败。
  lifecycle: 'SOURCE_EXECUTION_HOST_LIFECYCLE_ERROR'
});

/**
 * SourceExecutionHost 稳定错误基类。
 * 构造时固定 Error.name 和 code，并在存在原始异常时保留 cause 引用。
 * 错误对象只表达失败，不修改 Host entry、Provider、Repository 或页面状态。
 */
export class SourceExecutionHostError extends Error {
  /**
   * 创建 Host 稳定错误。
   *
   * @param {string} message 面向开发诊断的错误说明，调用方不能据此决定分支。
   * @param {string} code SOURCE_EXECUTION_HOST_ERROR_CODE 中的稳定值。
   * @param {object} options 可选错误上下文。
   * @param {*} options.cause 可选原始失败，用于保留底层调用栈和分类。
   */
  constructor(message, code, options = {}) {
    // 执行内容: 使用标准 Error 保存稳定 message 和调用栈。
    super(message);

    // 类型: string。
    // 作用: 使用真实子类名，便于测试和诊断区分具体 Host 失败类型。
    this.name = new.target.name;

    // 类型: string。
    // 作用: 保存跨层稳定错误码，service 和 runtime 不需要解析 message。
    this.code = code;

    // 条件分支: 调用方显式提供 cause 字段时进入。
    // 执行内容: 保留原始失败引用，不用新的通用错误覆盖底层原因。
    if (Object.hasOwn(options, 'cause')) {
      // 类型: *。
      // 作用: 保存 Provider、Context 或工厂抛出的原始失败，供调试和上层包装继续追踪。
      this.cause = options.cause;
    }
  }
}

/**
 * Host 输入结构错误。
 * 适用于 sourceId、SourceRecord、gateContext、工厂和方法参数不符合精确契约。
 */
export class SourceExecutionHostValidationError extends SourceExecutionHostError {
  /**
   * @param {string} message 输入失败说明。
   * @param {object} options 可选 cause 容器。
   */
  constructor(message, options = {}) {
    // 执行内容: 使用固定 validation code 创建具体错误。
    super(message, SOURCE_EXECUTION_HOST_ERROR_CODE.validation, options);
  }
}

/**
 * Host 依赖或实例未命中错误。
 * 适用于未知 providerKey、数据集、sourceId 或已经释放的 entry。
 */
export class SourceExecutionHostNotFoundError extends SourceExecutionHostError {
  /**
   * @param {string} message 未命中对象说明。
   * @param {object} options 可选 cause 容器。
   */
  constructor(message, options = {}) {
    // 执行内容: 使用固定 notFound code 创建具体错误。
    super(message, SOURCE_EXECUTION_HOST_ERROR_CODE.notFound, options);
  }
}

/**
 * Host 身份冲突错误。
 * 适用于重复工厂键或同一 sourceId 已经存在受管 entry。
 */
export class SourceExecutionHostConflictError extends SourceExecutionHostError {
  /**
   * @param {string} message 冲突对象说明。
   * @param {object} options 可选 cause 容器。
   */
  constructor(message, options = {}) {
    // 执行内容: 使用固定 conflict code 创建具体错误。
    super(message, SOURCE_EXECUTION_HOST_ERROR_CODE.conflict, options);
  }
}

/**
 * Host 运行门禁拒绝错误。
 * 适用于记录存在但不满足启用、完整性、授权、软隐藏或可信数据集要求。
 */
export class SourceExecutionHostGateRejectedError extends SourceExecutionHostError {
  /**
   * @param {string} message 门禁拒绝原因说明。
   * @param {object} options 可选 cause 容器。
   */
  constructor(message, options = {}) {
    // 执行内容: 使用固定 gateRejected code 创建具体错误。
    super(message, SOURCE_EXECUTION_HOST_ERROR_CODE.gateRejected, options);
  }
}

/**
 * Host 生命周期阶段错误。
 * 适用于未初始化启动、未运行调用、失败 entry 重启或其他非法状态转换。
 */
export class SourceExecutionHostInvalidStateError extends SourceExecutionHostError {
  /**
   * @param {string} message 非法状态转换说明。
   * @param {object} options 可选 cause 容器。
   */
  constructor(message, options = {}) {
    // 执行内容: 使用固定 invalidState code 创建具体错误。
    super(message, SOURCE_EXECUTION_HOST_ERROR_CODE.invalidState, options);
  }
}

/**
 * Host 业务候选结果不可采用错误。
 * 适用于 signal 已中止、entry 已替换或生命周期代次发生变化。
 */
export class SourceExecutionHostCallAbortedError extends SourceExecutionHostError {
  /**
   * @param {string} message 候选结果失效说明。
   * @param {object} options 可选 cause 容器。
   */
  constructor(message, options = {}) {
    // 执行内容: 使用固定 callAborted code 创建具体错误。
    super(message, SOURCE_EXECUTION_HOST_ERROR_CODE.callAborted, options);
  }
}

/**
 * Provider 生命周期执行错误。
 * 适用于 initialize、start、stop、dispose 或 Host 清理失败，通常保留原始 cause。
 */
export class SourceExecutionHostLifecycleError extends SourceExecutionHostError {
  /**
   * @param {string} message 生命周期失败说明。
   * @param {object} options 可选 cause 容器。
   */
  constructor(message, options = {}) {
    // 执行内容: 使用固定 lifecycle code 创建具体错误。
    super(message, SOURCE_EXECUTION_HOST_ERROR_CODE.lifecycle, options);
  }
}
