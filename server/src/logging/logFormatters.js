/*
  logFormatters.js 模块说明

  - 文件职责:
      把统一三分区日志事件序列化为一行完整 JSON。
      本模块不裁剪、增加或推断事件事实，也不提供 compact 或平台专用格式。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      formatJsonLogEvent(event): 生成不带行终止符的紧凑 JSON。

  - 模块级类:
      无

  - 对外导出:
      formatJsonLogEvent: console 和 JSONL 文件共同使用的唯一 formatter。
*/

/**
 * 把统一事件格式化为完整单行 JSON。
 * 调用方: console sink 和 JSONL 文件 sink。
 * 纯函数: 不修改事件；JSON.stringify 对正文中的换行执行转义。
 * 失败路径: 输入不满足 JSON 安全边界时保留序列化异常，由 sink 故障边界隔离。
 *
 * @param {Readonly<object>} event 统一三分区日志事件。
 * @returns {string} 不带行终止符的完整 JSON 文本。
 */
export function formatJsonLogEvent(event) {
  return JSON.stringify(event);
}
