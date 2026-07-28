/*
  userContentRepositoryErrors.js 模块说明

  - 文件职责:
      定义用户内容 Repository 输入校验错误。
      供校验器区分调用方候选无效与 IndexedDB 连接、事务或保存对象损坏。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      UserContentRepositoryValidationError: TypeError，用户内容保存候选校验错误。

  - 对外导出:
      UserContentRepositoryValidationError: Class，Repository 严格字段校验失败类型。
*/

/**
 * 用户内容 Repository 校验错误。
 * 职责: 保存稳定错误类型与字段诊断，不访问数据库或修改 store。
 */
export class UserContentRepositoryValidationError extends TypeError {
  /**
   * 创建用户内容校验错误。
   * 副作用: 只初始化当前错误实例，不执行持久化操作。
   *
   * @param {string} message 字段路径和失败原因。
   */
  constructor(message) {
    super(message);
    this.name = 'UserContentRepositoryValidationError';
  }
}
