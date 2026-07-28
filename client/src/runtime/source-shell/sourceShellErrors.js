/*
  sourceShellErrors.js 模块说明

  - 文件职责:
      提供 Source Shell 稳定错误码和分层错误类型，让 Provider、Host 和测试依赖 code 而不是错误文案。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SOURCE_SHELL_ERROR_CODE: object，Shell 稳定错误码枚举。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      SourceShellError: Shell 错误基类。
      SourceShellValidationError: 输入契约错误。
      SourceShellNotFoundError: 模拟网络路由未命中错误。
      SourceShellAbortedError: 生命周期中止错误。
      SourceShellLimitError: 容量策略超限错误。
      SourceShellFixtureError: 模拟响应夹具结构错误。
      SourceShellOperationError: Repository 或端口执行失败错误。

  - 对外导出:
      SOURCE_SHELL_ERROR_CODE: object，稳定错误码。
      全部 SourceShell 错误类，供能力实现和测试执行 instanceof 与 code 判断。
*/

// 类型: object。
// 作用: 冻结 Shell 六类稳定错误码，调用方不能解析中文 message 决定分支。
export const SOURCE_SHELL_ERROR_CODE = Object.freeze({
  // 类型: string。
  // 作用: 表示输入字段、依赖或方法参数不符合契约。
  validation: 'SOURCE_SHELL_VALIDATION',

  // 类型: string。
  // 作用: 表示精确模拟网络路由没有匹配项。
  notFound: 'SOURCE_SHELL_NOT_FOUND',

  // 类型: string。
  // 作用: 表示 AbortSignal 已经中止当前能力调用。
  aborted: 'SOURCE_SHELL_ABORTED',

  // 类型: string。
  // 作用: 表示请求、响应或日志超过集中策略上限。
  limit: 'SOURCE_SHELL_LIMIT',

  // 类型: string。
  // 作用: 表示模拟响应夹具自身结构不符合标准响应契约。
  fixture: 'SOURCE_SHELL_FIXTURE',

  // 类型: string。
  // 作用: 表示 Repository 或注入端口执行失败，错误对象保留 cause。
  operation: 'SOURCE_SHELL_OPERATION'
});

/**
 * Source Shell 稳定错误基类。
 * 副作用: 创建 Error 实例并保存 code 与可选 cause，不修改业务状态。
 *
 * @param {string} message 诊断文案，调用方不能据此决定业务分支。
 * @param {string} code SOURCE_SHELL_ERROR_CODE 中的稳定值。
 * @param {object} options 可选错误参数。
 * @param {Error} options.cause 原始失败原因。
 */
export class SourceShellError extends Error {
  /**
   * 创建 Source Shell 错误基类实例。
   * 副作用: 初始化 Error、name 和稳定 code，不修改外部状态。
   *
   * @param {string} message 诊断文案。
   * @param {string} code 稳定错误码。
   * @param {object} options 可选 Error 参数。
   * @param {Error} options.cause 原始失败原因，供上层诊断但不参与业务分支。
   */
  constructor(message, code, options = {}) {
    // 执行内容: 交给原生 Error 保存 message 和可选 cause，保留标准错误链行为。
    super(message, options);

    // 类型: string。
    // 作用: 使用实际子类构造名称标识错误类型，便于日志和调试定位。
    this.name = this.constructor.name;

    // 类型: string。
    // 作用: 保存稳定机器错误码，Provider、Host 和测试不解析中文 message 决定分支。
    this.code = code;
  }
}

/**
 * 表示 Shell 输入契约错误。
 * 副作用: 创建带 validation code 的错误对象。
 *
 * @param {string} message 输入错误说明。
 * @param {object} options 可选错误参数。
 * @param {Error} options.cause 底层校验错误。
 */
export class SourceShellValidationError extends SourceShellError {
  /**
   * 创建 Shell 输入契约错误。
   * 副作用: 初始化 validation code 并保留可选 cause。
   *
   * @param {string} message 输入错误说明。
   * @param {object} options 可选 Error 参数。
   * @param {Error} options.cause 底层输入校验失败原因。
   */
  constructor(message, options = {}) {
    // 执行内容: 委托基类保存 message、validation 稳定码和可选 cause。
    super(message, SOURCE_SHELL_ERROR_CODE.validation, options);
  }
}

/**
 * 表示精确模拟网络路由未命中。
 * 副作用: 创建带 notFound code 的错误对象。
 *
 * @param {string} message 路由未命中说明。
 * @param {object} options 可选错误参数。
 * @param {Error} options.cause 底层查询错误。
 */
export class SourceShellNotFoundError extends SourceShellError {
  /**
   * 创建模拟网络路由未命中错误。
   * 副作用: 初始化 notFound code 并保留可选 cause。
   *
   * @param {string} message 路由未命中说明。
   * @param {object} options 可选 Error 参数。
   * @param {Error} options.cause 底层路由查询失败原因。
   */
  constructor(message, options = {}) {
    // 执行内容: 委托基类保存 message、notFound 稳定码和可选 cause。
    super(message, SOURCE_SHELL_ERROR_CODE.notFound, options);
  }
}

/**
 * 表示当前 Shell 调用已经被生命周期中止。
 * 副作用: 创建带 aborted code 的错误对象。
 *
 * @param {string} message 中止说明。
 * @param {object} options 可选错误参数。
 * @param {Error} options.cause 原始中止原因。
 */
export class SourceShellAbortedError extends SourceShellError {
  /**
   * 创建生命周期中止错误。
   * 副作用: 初始化 aborted code 并保留可选 cause。
   *
   * @param {string} message 中止说明。
   * @param {object} options 可选 Error 参数。
   * @param {Error} options.cause 原始生命周期中止原因。
   */
  constructor(message, options = {}) {
    // 执行内容: 委托基类保存 message、aborted 稳定码和可选 cause。
    super(message, SOURCE_SHELL_ERROR_CODE.aborted, options);
  }
}

/**
 * 表示请求、响应或日志超过集中策略上限。
 * 副作用: 创建带 limit code 的错误对象。
 *
 * @param {string} message 超限说明。
 * @param {object} options 可选错误参数。
 * @param {Error} options.cause 底层容量计算错误。
 */
export class SourceShellLimitError extends SourceShellError {
  /**
   * 创建容量策略超限错误。
   * 副作用: 初始化 limit code 并保留可选 cause。
   *
   * @param {string} message 超限说明。
   * @param {object} options 可选 Error 参数。
   * @param {Error} options.cause 底层容量计算失败原因。
   */
  constructor(message, options = {}) {
    // 执行内容: 委托基类保存 message、limit 稳定码和可选 cause。
    super(message, SOURCE_SHELL_ERROR_CODE.limit, options);
  }
}

/**
 * 表示模拟响应夹具不符合标准结构。
 * 副作用: 创建带 fixture code 的错误对象。
 *
 * @param {string} message 夹具结构错误说明。
 * @param {object} options 可选错误参数。
 * @param {Error} options.cause 底层夹具校验错误。
 */
export class SourceShellFixtureError extends SourceShellError {
  /**
   * 创建模拟响应夹具结构错误。
   * 副作用: 初始化 fixture code 并保留可选 cause。
   *
   * @param {string} message 夹具错误说明。
   * @param {object} options 可选 Error 参数。
   * @param {Error} options.cause 底层夹具校验或解析失败原因。
   */
  constructor(message, options = {}) {
    // 执行内容: 委托基类保存 message、fixture 稳定码和可选 cause。
    super(message, SOURCE_SHELL_ERROR_CODE.fixture, options);
  }
}

/**
 * 表示 Repository 或注入端口执行失败。
 * 副作用: 创建带 operation code 的错误对象并保留原始 cause。
 *
 * @param {string} message 操作失败说明。
 * @param {Error} cause 原始基础设施失败。
 */
export class SourceShellOperationError extends SourceShellError {
  /**
   * 创建 Shell 基础设施操作错误。
   * 副作用: 初始化 operation code 并保存原始 cause。
   *
   * @param {string} message 操作失败说明。
   * @param {Error} cause 原始基础设施失败。
   */
  constructor(message, cause) {
    // 执行内容: 委托基类保存 message、operation 稳定码，并把基础设施错误放入标准 cause。
    super(message, SOURCE_SHELL_ERROR_CODE.operation, { cause });
  }
}
