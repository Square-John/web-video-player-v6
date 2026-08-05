/*
  backendLogger.js 模块说明

  - 文件职责:
      把已校验 ProxyPolicy.logging 装配为唯一后端日志中心，并连接 console sink、可选 JSONL 文件 sink 和文件生命周期事件。
      相对日志目录只在此以仓库根解析；本模块不创建代理应用、不读取环境变量，也不解释业务事件。

  - 导入库及文件汇总(4 条，内置 1 条，第三方 0 条，自定义 3 条):
      node:path#isAbsolute、resolve: 相对仓库根解析日志目录并复核组合根路径。
      ./consoleLogSink.js#createConsoleLogSink: 创建 Render/stdout/stderr 输出端。
      ./jsonlFileSink.js#createJsonlFileSink: 创建完整 JSONL 和有限轮转输出端。
      ./logCenter.js#createLogCenter: 创建统一事件、汇总和关闭生命周期。

  - 模块级常量:
      FILE_FAILURE_EVENT: string，文件 sink 首次故障事件名。
      FILE_ROTATED_EVENT: string，文件 sink 成功轮转事件名。

  - 模块级变量:
      无

  - 模块级辅助函数:
      resolveLogDirectory(repositoryRoot, directory): 解析日志目录唯一绝对路径。
      createBackendLogger(options): 组装后端唯一日志中心。

  - 模块级类:
      无

  - 对外导出:
      createBackendLogger: function，后端 index 和生产装配测试使用的日志中心工厂。
*/

// 导入来源: node:path；导入内容: isAbsolute、resolve；文件作用: 相对目录只从仓库根解析，不依赖 process.cwd。
import { isAbsolute, resolve } from 'node:path';
// 导入来源: ./consoleLogSink.js；导入内容: createConsoleLogSink；文件作用: 建立本地终端与 Render 标准流输出。
import { createConsoleLogSink } from './consoleLogSink.js';
// 导入来源: ./jsonlFileSink.js；导入内容: createJsonlFileSink；文件作用: 按配置启用完整 JSONL 文件与轮转。
import { createJsonlFileSink } from './jsonlFileSink.js';
// 导入来源: ./logCenter.js；导入内容: createLogCenter；文件作用: console 与 file sink 共享同一事件和生命周期。
import { createLogCenter } from './logCenter.js';

// 类型: string；作用: 文件 sink 首次停用时由统一中心输出有限错误原因。
const FILE_FAILURE_EVENT = 'proxy.logging.file.failed';

// 类型: string；作用: 成功轮转由统一中心记录最多文件数，不包含本地路径。
const FILE_ROTATED_EVENT = 'proxy.logging.file.rotated';

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
 * 状态所有权: 返回 logCenter 拥有全部 sink、周期汇总和关闭生命周期；本工厂不保留第二引用集合。
 * 状态释放: 调用方必须在 Fastify 关闭后调用 logger.close，排空汇总和文件队列。
 * 失败路径: loggingConfig 或仓库根非法时同步失败；文件运行故障由统一中心输出一次 error 并停用 file sink。
 *
 * @param {object} options 生产日志配置和依赖。
 * @param {Readonly<object>} options.loggingConfig 已校验 ProxyPolicy.logging。
 * @param {string} options.repositoryRoot 仓库绝对根目录。
 * @param {Function} [options.writeStdout] 可选测试标准输出端口。
 * @param {Function} [options.writeStderr] 可选测试错误输出端口。
 * @param {Function} [options.now] 可选测试时钟。
 * @param {Function} [options.schedule] 可选测试调度器。
 * @param {Function} [options.cancel] 可选测试取消器。
 * @returns {Readonly<object>} 统一 debug/info/warn/error、汇总和 close 端口。
 * @throws {TypeError} 配置或路径边界无效时抛出。
 */
export function createBackendLogger({
  loggingConfig,
  repositoryRoot,
  writeStdout,
  writeStderr,
  now,
  schedule,
  cancel
}) {
  if (!loggingConfig?.console || !loggingConfig?.file) {
    throw new TypeError('createBackendLogger 需要完整 loggingConfig');
  }

  const consoleOptions = {
    minimumLevel: loggingConfig.console.minimumLevel,
    format: loggingConfig.console.format
  };
  if (writeStdout !== undefined) consoleOptions.writeStdout = writeStdout;
  if (writeStderr !== undefined) consoleOptions.writeStderr = writeStderr;
  // 类型: object；作用: console 始终存在，Render 和本地终端不依赖临时文件系统。
  const consoleSink = createConsoleLogSink(consoleOptions);
  // 类型: Array<object>；作用: 文件启用时追加同一标准事件 sink，禁用时只保留 console。
  const sinks = [consoleSink];
  // 类型: object|undefined；生命周期: 工厂回调闭包；作用: 文件异步故障发生时回到已经创建的唯一中心。
  let logger;

  if (loggingConfig.file.enabled) {
    sinks.push(createJsonlFileSink({
      directory: resolveLogDirectory(repositoryRoot, loggingConfig.file.directory),
      baseName: loggingConfig.file.baseName,
      minimumLevel: loggingConfig.file.minimumLevel,
      maximumFileBytes: loggingConfig.file.maximumFileBytes,
      maximumFiles: loggingConfig.file.maximumFiles,
      // 文件故障事件只携带稳定原因；file sink 先停用再回调，因此不会递归写文件。
      onFailure: (reason) => logger?.reportSinkFailure(FILE_FAILURE_EVENT, { reason }),
      // 轮转成功事件只携带有限文件数；事件会在当前写任务之后进入同一 FIFO。
      onRotated: (fields) => logger?.info(FILE_ROTATED_EVENT, fields)
    }));
  }

  const centerOptions = {
    sinks,
    summaryIntervalSeconds: loggingConfig.console.summaryIntervalSeconds
  };
  if (now !== undefined) centerOptions.now = now;
  if (schedule !== undefined) centerOptions.schedule = schedule;
  if (cancel !== undefined) centerOptions.cancel = cancel;
  logger = createLogCenter(centerOptions);
  return logger;
}
