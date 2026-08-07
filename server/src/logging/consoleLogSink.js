/*
  consoleLogSink.js 模块说明

  - 文件职责:
      把达到级别阈值的统一 JSON 事件写入 stdout 或 stderr。
      error 进入 stderr，其他级别进入 stdout；首次输出故障后停用当前 sink，不改变代理结果。

  - 导入库及文件汇总(3 条，内置 1 条，第三方 0 条，自定义 2 条):
      node:process#process: 提供生产 stdout 和 stderr 写入端口。
      ./logEvent.js#getLogEventLevel、isLogLevelEnabled: 推导终态级别并执行阈值判断。
      ./logFormatters.js#formatJsonLogEvent: 生成与文件完全相同的单行 JSON。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      createConsoleLogSink(options): 创建标准流输出端口。

  - 模块级类:
      无

  - 对外导出:
      createConsoleLogSink: 日志中心使用的 console sink 工厂。
*/

// 导入来源: node:process；导入内容: process；文件作用: 提供默认标准输出和错误输出端口。
import process from 'node:process';
// 导入来源: ./logEvent.js；导入内容: getLogEventLevel、isLogLevelEnabled；文件作用: 同一事件在所有 sink 使用相同级别语义。
import { getLogEventLevel, isLogLevelEnabled } from './logEvent.js';
// 导入来源: ./logFormatters.js；导入内容: formatJsonLogEvent；文件作用: 标准流和文件使用完全相同的 JSON 表现。
import { formatJsonLogEvent } from './logFormatters.js';

/**
 * 创建 console 日志输出端口。
 * 调用方: 后端启动组合根和日志核心测试。
 * 状态所有权: 只保存写入函数和当前启用状态，不缓存事件或输出文本。
 * 失败路径: 依赖无效时同步抛 TypeError；运行写入首次失败后停用 sink 并返回 false。
 *
 * @param {object} options console 配置和依赖。
 * @param {string} options.minimumLevel 最低输出级别。
 * @param {Function} [options.writeStdout=process.stdout.write] 标准输出端口。
 * @param {Function} [options.writeStderr=process.stderr.write] 错误输出端口。
 * @returns {Readonly<{write: Function, close: Function, isEnabled: Function}>} 冻结 sink。
 * @throws {TypeError} 写入端口或配置非法时抛出。
 */
export function createConsoleLogSink({
  minimumLevel,
  writeStdout = process.stdout.write.bind(process.stdout),
  writeStderr = process.stderr.write.bind(process.stderr)
}) {
  if (typeof writeStdout !== 'function' || typeof writeStderr !== 'function') {
    throw new TypeError('console sink 需要有效 stdout 和 stderr 写入端口');
  }
  isLogLevelEnabled('debug', minimumLevel);
  let enabled = true;

  /**
   * 格式化并写入一个统一事件。
   * 调用方: logCenter。
   * 副作用: 达到阈值时调用一次 stdout 或 stderr；首次异常将 enabled 改为 false。
   * 成功路径: 已写入返回 true；低于阈值、已停用或写入失败返回 false。
   * 失败路径: 级别投影、formatter 或 write 异常被当前 sink 吸收，不能覆盖业务结果。
   *
   * @param {Readonly<object>} event 统一冻结日志事件。
   * @returns {boolean} 当前调用是否成功写入。
   */
  function write(event) {
    if (!enabled) return false;
    try {
      const level = getLogEventLevel(event);
      if (!isLogLevelEnabled(level, minimumLevel)) return false;
      const output = level === 'error' ? writeStderr : writeStdout;
      output(`${formatJsonLogEvent(event)}\n`);
      return true;
    } catch {
      enabled = false;
      return false;
    }
  }

  /**
   * 关闭 console sink。
   * 调用方: logCenter.close。
   * 副作用: 停止后续输出；进程 stdout/stderr 由 Node 所有，不在此关闭。
   * 失败路径: 无，重复关闭保持幂等。
   *
   * @returns {Promise<void>} 立即完成的关闭结果。
   */
  async function close() {
    enabled = false;
  }

  return Object.freeze({ write, close, isEnabled: () => enabled });
}
