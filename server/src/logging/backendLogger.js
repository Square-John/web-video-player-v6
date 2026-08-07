/*
  backendLogger.js 模块说明

  - 文件职责:
      把已校验 ProxyPolicy.logging 装配为唯一日志中心，并连接标准流、可选 JSONL 文件和文件生命周期事件。
      相对日志目录只在此以仓库根解析；本模块不创建代理应用、不读取环境变量，也不维护平台专用 logger。

  - 导入库及文件汇总(5 条，内置 1 条，第三方 0 条，自定义 4 条):
      node:path#isAbsolute、resolve: 以仓库根解析日志目录。
      ./consoleLogSink.js#createConsoleLogSink: 创建 stdout/stderr JSON 输出端。
      ./jsonlFileSink.js#createJsonlFileSink: 创建 JSONL FIFO 和有限轮转输出端。
      ./logCenter.js#createLogCenter: 创建统一事件与关闭生命周期。
      ./logEvent.js: 提供 logging 类别、动作和结果枚举。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      resolveLogDirectory(repositoryRoot, directory): 解析日志目录唯一绝对路径。
      createBackendLogger(options): 组装后端唯一日志中心。

  - 模块级类:
      无

  - 对外导出:
      createBackendLogger: 后端 index 和生产装配测试使用的日志中心工厂。
*/

// 导入来源: node:path；导入内容: isAbsolute、resolve；文件作用: 相对目录只从仓库根解析，不依赖 process.cwd。
import { isAbsolute, resolve } from 'node:path';
// 导入来源: ./consoleLogSink.js；导入内容: createConsoleLogSink；文件作用: 建立本地终端与平台标准流输出。
import { createConsoleLogSink } from './consoleLogSink.js';
// 导入来源: ./jsonlFileSink.js；导入内容: createJsonlFileSink；文件作用: 按配置启用完整 JSONL 文件与轮转。
import { createJsonlFileSink } from './jsonlFileSink.js';
// 导入来源: ./logCenter.js；导入内容: createLogCenter；文件作用: 标准流与文件共享同一事件和生命周期。
import { createLogCenter } from './logCenter.js';
// 导入来源: ./logEvent.js；导入内容: LOG_ACTION、LOG_CATEGORY、LOG_RESULT；文件作用: 文件生命周期回调使用正式事件枚举。
import { LOG_ACTION, LOG_CATEGORY, LOG_RESULT } from './logEvent.js';

/**
 * 把配置目录解析为唯一绝对路径。
 * 调用方: createBackendLogger。
 * 纯函数: 不访问文件系统；绝对路径规范化，相对路径以 repositoryRoot 为唯一基准。
 * 失败路径: repositoryRoot 不是绝对路径或 directory 为空时抛 TypeError。
 *
 * @param {string} repositoryRoot 当前项目仓库绝对根目录。
 * @param {string} directory 已校验文件日志目录文本。
 * @returns {string} 可交给文件 sink 的规范绝对目录。
 * @throws {TypeError} 路径不能形成确定基准时抛出。
 */
function resolveLogDirectory(repositoryRoot, directory) {
  if (typeof repositoryRoot !== 'string'
    || !isAbsolute(repositoryRoot)
    || typeof directory !== 'string'
    || directory.length === 0) {
    throw new TypeError('日志组合根需要仓库绝对根目录和非空文件目录');
  }
  return isAbsolute(directory) ? resolve(directory) : resolve(repositoryRoot, directory);
}

/**
 * 创建后端唯一日志中心。
 * 调用方: index.start 和生产装配测试。
 * 状态所有权: 返回中心拥有全部 sink 和关闭生命周期；本工厂只通过闭包接收文件生命周期回调。
 * 状态释放: 调用方必须在 Fastify 关闭后调用 logger.close，排空文件 FIFO。
 * 失败路径: 配置或仓库根非法时同步失败；文件运行故障输出一次 logging/file_failed 并停用 file sink。
 *
 * @param {object} options 生产日志配置和依赖。
 * @param {Readonly<object>} options.loggingConfig 已校验 ProxyPolicy.logging。
 * @param {string} options.repositoryRoot 仓库绝对根目录。
 * @param {Function} [options.writeStdout] 可选测试标准输出端口。
 * @param {Function} [options.writeStderr] 可选测试错误输出端口。
 * @param {Function} [options.now] 可选测试时钟。
 * @returns {Readonly<object>} 统一 write、close 和 isClosed 端口。
 * @throws {TypeError} 配置或路径边界无效时抛出。
 */
export function createBackendLogger({
  loggingConfig,
  repositoryRoot,
  writeStdout,
  writeStderr,
  now
}) {
  if (!loggingConfig?.console || !loggingConfig?.file) {
    throw new TypeError('createBackendLogger 需要完整 loggingConfig');
  }

  const consoleOptions = { minimumLevel: loggingConfig.console.minimumLevel };
  if (writeStdout !== undefined) consoleOptions.writeStdout = writeStdout;
  if (writeStderr !== undefined) consoleOptions.writeStderr = writeStderr;
  const consoleSink = createConsoleLogSink(consoleOptions);
  const sinks = [consoleSink];
  let logger;

  /**
   * 创建没有请求和响应过程的日志系统生命周期事件。
   * 调用方: 文件 sink 的 onFailure 和 onRotated 回调。
   * 副作用: 日志中心存在时同步分发一条 logging 事件；不存在或已关闭时不抛出。
   * 失败路径: 日志中心写入异常被回调边界吸收，不能让文件队列失败。
   *
   * @param {string} action logging 类别动作。
   * @param {string} result success 或 failure。
   * @param {string|null} failureReason 稳定失败原因或 null。
   * @returns {void} 事件结果不进入文件操作返回值。
   */
  function reportFileLifecycle(action, result, failureReason) {
    try {
      logger?.reportSinkEvent({
        category: LOG_CATEGORY.logging,
        action,
        requestId: null,
        result,
        durationMs: null,
        failureReason,
        requestProcess: null,
        responseProcess: null
      });
    } catch {
      // 文件回调边界: 日志中心关闭或标准流故障不能反向破坏文件队列。
    }
  }

  if (loggingConfig.file.enabled) {
    sinks.push(createJsonlFileSink({
      directory: resolveLogDirectory(repositoryRoot, loggingConfig.file.directory),
      baseName: loggingConfig.file.baseName,
      minimumLevel: loggingConfig.file.minimumLevel,
      maximumFileBytes: loggingConfig.file.maximumFileBytes,
      maximumFiles: loggingConfig.file.maximumFiles,
      onFailure: (reason) => reportFileLifecycle(LOG_ACTION.fileFailed, LOG_RESULT.failure, reason),
      onRotated: () => reportFileLifecycle(LOG_ACTION.fileRotated, LOG_RESULT.success, null)
    }));
  }

  const centerOptions = { sinks };
  if (now !== undefined) centerOptions.now = now;
  logger = createLogCenter(centerOptions);
  return logger;
}
