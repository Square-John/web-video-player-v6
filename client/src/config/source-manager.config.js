/*
  source-manager.config.js 模块说明

  - 文件职责:
      集中声明数据源管理领域使用的稳定枚举。
      供 mock、store、service、授权工具和页面展示共享，避免状态值分散在不同模块。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SOURCE_KIND: object，系统源和自定义源类型枚举。
      HEALTH_STATUS: object，数据源三态健康枚举。
      AUTHORIZATION_STATUS: object，自定义脚本运行授权枚举。
      IMPORT_METHOD: object，数据源导入方式枚举。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SOURCE_KIND、HEALTH_STATUS、AUTHORIZATION_STATUS、IMPORT_METHOD: object，数据源管理领域枚举。
*/

// 类型: object。
// 作用: 统一系统源和自定义源类型值，决定删除方式和用户授权边界。
export const SOURCE_KIND = Object.freeze({
  // 类型: string；作用: 标识随应用提供、删除后可以恢复的系统内置数据源。
  system: 'system',
  // 类型: string；作用: 标识由用户导入、运行前需要确认风险的自定义数据源。
  custom: 'custom'
});

// 类型: object。
// 作用: 统一数据源健康状态，页面只允许正常、检测中和不可用三种结果。
export const HEALTH_STATUS = Object.freeze({
  // 类型: string；作用: 标识数据源最近一次检测可以正常使用。
  normal: 'normal',
  // 类型: string；作用: 标识当前正在执行数据源健康检测。
  checking: 'checking',
  // 类型: string；作用: 标识数据源最近一次检测不可用。
  unavailable: 'unavailable'
});

// 类型: object。
// 作用: 统一自定义脚本运行授权状态，描述用户决定而不是脚本安全认证结果。
export const AUTHORIZATION_STATUS = Object.freeze({
  // 类型: string；作用: 用户已经确认当前版本和脚本文本对应的运行风险。
  authorized: 'authorized',
  // 类型: string；作用: 自定义脚本等待首次确认或因内容变化等待重新确认。
  pending: 'pending',
  // 类型: string；作用: 用户已经主动撤销该脚本的运行授权。
  revoked: 'revoked'
});

// 类型: object。
// 作用: 统一系统内置、文件、在线和粘贴文本四种数据源导入方式。
export const IMPORT_METHOD = Object.freeze({
  // 类型: string；作用: 标识随应用代码提供的系统内置数据源。
  builtin: 'builtin',
  // 类型: string；作用: 标识用户从本地脚本文件导入的数据源。
  file: 'file',
  // 类型: string；作用: 标识用户从在线地址导入并可检查更新的数据源。
  remote: 'remote',
  // 类型: string；作用: 标识用户通过粘贴脚本文本导入的数据源。
  text: 'text'
});
