/*
  browserPersistenceErrors.js 模块说明

  - 文件职责:
      定义浏览器 IndexedDB 连接、迁移、种子、容量和普通操作的稳定错误边界。
      供数据库门面与 Repository 把原生 DOMException 转为可测试错误，同时保留 cause。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      BROWSER_PERSISTENCE_ERROR_CODE: object，持久化稳定错误码。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createBrowserPersistenceError(code, message, cause): 保留既有持久化错误或包装原始失败。
      resolveBrowserPersistenceErrorCode(error, fallbackCode): 识别配额错误并返回稳定分类。

  - 模块级类:
      BrowserPersistenceError: Error，浏览器持久化错误基类。

  - 对外导出:
      BROWSER_PERSISTENCE_ERROR_CODE: object，稳定错误码。
      BrowserPersistenceError: Class，持久化错误类型。
      createBrowserPersistenceError: Function，统一错误包装函数。
*/

// 类型: object；作用: 固定数据库失败分类，上层不得解析浏览器文案决定分支。
export const BROWSER_PERSISTENCE_ERROR_CODE = Object.freeze({
  // 类型: string；作用: 当前环境没有可用 IndexedDB 全局能力。
  unsupported: 'PERSISTENCE_UNSUPPORTED',
  // 类型: string；作用: 旧连接阻塞数据库版本升级。
  blocked: 'PERSISTENCE_BLOCKED',
  // 类型: string；作用: 浏览器异常终止当前数据库连接。
  terminated: 'PERSISTENCE_TERMINATED',
  // 类型: string；作用: schema 创建或迁移未能完成。
  migrationFailed: 'PERSISTENCE_MIGRATION_FAILED',
  // 类型: string；作用: 首次空库种子事务失败。
  seedFailed: 'PERSISTENCE_SEED_FAILED',
  // 类型: string；作用: 浏览器存储配额不足导致事务失败。
  quotaExceeded: 'PERSISTENCE_QUOTA_EXCEEDED',
  // 类型: string；作用: 现有数据库对象或初始化事实不符合冻结契约。
  dataCorrupted: 'PERSISTENCE_DATA_CORRUPTED',
  // 类型: string；作用: 普通读取、写入或事务失败且没有更具体分类。
  operationFailed: 'PERSISTENCE_OPERATION_FAILED'
});

/**
 * 浏览器持久化统一错误。
 * 职责: 保存稳定 code、诊断 message 和原始 cause，不修改数据库或 Repository 状态。
 */
export class BrowserPersistenceError extends Error {
  /**
   * 创建浏览器持久化错误。
   * 副作用: 仅初始化当前 Error 实例字段，不访问 IndexedDB。
   *
   * @param {string} code BROWSER_PERSISTENCE_ERROR_CODE 中的稳定错误码。
   * @param {string} message 当前失败边界的诊断说明。
   * @param {object} options 可选错误上下文。
   * @param {*} options.cause 浏览器原生错误或下层领域错误。
   */
  constructor(code, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'BrowserPersistenceError';
    this.code = code;
  }
}

/**
 * 根据原始失败确定稳定错误码。
 * 纯函数: 只读取 error.name，不修改错误或数据库状态。
 * 配额错误优先转换为 quotaExceeded，其他失败使用调用方提供的边界分类。
 *
 * @param {*} error 原生 DOMException、领域错误或任意 reject 原因。
 * @param {string} fallbackCode 当前调用边界默认错误码。
 * @returns {string} 稳定持久化错误码。
 */
function resolveBrowserPersistenceErrorCode(error, fallbackCode) {
  // 条件分支: 浏览器以标准名称报告存储配额不足时进入。
  // 执行内容: 使用容量错误分类，让页面可以引导用户执行正式缓存清理。
  if (error && typeof error === 'object' && error.name === 'QuotaExceededError') {
    return BROWSER_PERSISTENCE_ERROR_CODE.quotaExceeded;
  }

  return fallbackCode;
}

/**
 * 创建稳定浏览器持久化错误。
 * 纯函数: 已经是 BrowserPersistenceError 时原样返回，避免覆盖更精确 code 和 cause。
 * 成功路径: 返回可由 Repository、启动流程和测试按 code 识别的错误。
 *
 * @param {string} fallbackCode 当前边界默认错误码。
 * @param {string} message 当前边界诊断说明。
 * @param {*} cause 原始失败。
 * @returns {BrowserPersistenceError} 稳定持久化错误。
 */
export function createBrowserPersistenceError(fallbackCode, message, cause) {
  // 条件分支: 下层已经完成稳定持久化分类时进入。
  // 执行内容: 保留最初错误，不重复包装或改变失败语义。
  if (cause instanceof BrowserPersistenceError) return cause;

  return new BrowserPersistenceError(
    resolveBrowserPersistenceErrorCode(cause, fallbackCode),
    message,
    { cause }
  );
}
