/*
  index.js 模块说明

  - 文件职责:
      使用根 backend.config.js 已校验生成的冻结策略，创建代理 Fastify 应用并提供正式 Node.js 启动入口。
      本文件只负责进程生命周期和监听地址，不实现协议校验、网络安全策略或上游业务逻辑。

  - 导入库及文件汇总(8 条，内置 3 条，第三方 0 条，自定义 5 条):
      node:path#dirname、resolve: 从当前入口定位仓库根，作为相对日志目录唯一基准。
      node:url#fileURLToPath: 判断当前模块是否作为直接启动脚本执行。
      node:process: 读取进程参数、监听信号并设置直接启动失败退出码。
      ./config/proxyPolicy.js#proxyPolicy: 提供由根后端配置生成的冻结监听、CORS 和限制策略。
      ./logging/backendLogger.js#createBackendLogger: 创建 console/file 统一 JSON 日志中心。
      ./logging/logEvent.js: 提供 runtime 类别、动作和结果枚举。
      ./proxy/proxyAuditLogger.js#createProxyAuditLogger: 把代理事务事实投影到统一日志中心。
      ./http/createProxyApp.js#createProxyApp: 创建未监听端口的 HTTP 应用。

  - 模块级常量:
      SERVER_ROOT: string，server package 绝对根目录。
      REPOSITORY_ROOT: string，仓库绝对根目录和相对日志目录解析基准。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createProxyListenOptions(serverPolicy): 把冻结部署策略投影为 Fastify 可以安全接管的监听参数。
      writeRuntimeEvent(logger, options): 输出没有请求过程的运行生命周期事件。
      start(): 创建应用、监听端口并注册关闭信号。
      isDirectExecution(): 判断当前模块是否由 node 直接运行。

  - 模块级类:
      无

  - 对外导出:
      createProxyListenOptions: function，生产启动和运行时契约测试共用的第三方可变入参边界。
      start: async function，生产启动检查和 node 直接启动共同使用。
*/

// 导入来源: node:path；导入内容: dirname、resolve；文件作用: 从当前入口定位 server 与仓库根，日志相对目录不依赖 process.cwd。
import { dirname, resolve } from 'node:path';
// 导入来源: node:url；导入内容: fileURLToPath；文件作用: 安全比较当前入口模块绝对路径，避免 import 时意外监听端口。
import { fileURLToPath } from 'node:url';
// 导入来源: node:process；导入内容: process；文件作用: 读取启动参数、环境进程和终止信号。
import process from 'node:process';
// 导入来源: ./config/proxyPolicy.js；导入内容: proxyPolicy；文件作用: 提供根 backend.config.js 经严格校验和硬上限映射后的当前进程策略。
import { proxyPolicy } from './config/proxyPolicy.js';
// 导入来源: ./logging/backendLogger.js；导入内容: createBackendLogger；文件作用: 组装标准流、文件和关闭排空唯一日志中心。
import { createBackendLogger } from './logging/backendLogger.js';
// 导入来源: ./logging/logEvent.js；导入内容: LOG_ACTION、LOG_CATEGORY、LOG_RESULT；文件作用: 运行生命周期使用统一事件枚举。
import { LOG_ACTION, LOG_CATEGORY, LOG_RESULT } from './logging/logEvent.js';
// 导入来源: ./proxy/proxyAuditLogger.js；导入内容: createProxyAuditLogger；文件作用: 为生产 ProxyExecutor 提供统一请求审计事务。
import { createProxyAuditLogger } from './proxy/proxyAuditLogger.js';
// 导入来源: ./http/createProxyApp.js；导入内容: createProxyApp；文件作用: 组装唯一代理 HTTP 边界。
import { createProxyApp } from './http/createProxyApp.js';

// 类型: string；来源: 当前入口文件目录父级；作用: 定位 server package，不读取当前工作目录。
const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 类型: string；来源: server package 父级；作用: 解析 BackendConfig.logging.file.directory 相对路径。
const REPOSITORY_ROOT = resolve(SERVER_ROOT, '..');

/**
 * 输出一个不含请求和响应过程的运行生命周期事件。
 * 调用方: start 的监听和关闭成功/失败路径。
 * 副作用: 同步向统一日志中心分发一次 runtime 事件。
 * 失败路径: logger 或字段非法时保留日志核心异常，启动边界按原失败继续处理。
 *
 * @param {Readonly<{write: Function}>} logger 当前进程唯一日志中心。
 * @param {object} options 运行事件字段。
 * @param {string} options.action runtime 动作。
 * @param {string} options.result success 或 failure。
 * @param {string|null} options.failureReason 稳定失败原因或 null。
 * @returns {Readonly<object>} 已分发冻结事件。
 */
function writeRuntimeEvent(logger, { action, result, failureReason }) {
  return logger.write({
    category: LOG_CATEGORY.runtime,
    action,
    requestId: null,
    result,
    durationMs: null,
    failureReason,
    requestProcess: null,
    responseProcess: null
  });
}

/**
 * 把冻结部署策略投影为 Fastify 监听参数。
 * 调用方: start 和运行时契约测试。
 * 副作用: 无；返回一个新的可扩展普通对象，允许 Fastify 在监听生命周期附加内部状态，同时不修改原部署策略。
 * 失败路径: serverPolicy 不是对象、host 为空或 port 不是正整数时抛 TypeError，服务不会尝试绑定网络端口。
 *
 * @param {*} serverPolicy 已由 proxyPolicy 校验并冻结的服务监听策略。
 * @returns {{host: string, port: number}} 只包含 host 和 port 的新监听参数。
 * @throws {TypeError} 监听策略缺少有效 host 或 port 时抛出。
 */
export function createProxyListenOptions(serverPolicy) {
  // 类型: string；来源: 冻结部署策略；作用: 只把监听主机交给 Fastify，不传递 CORS 等应用策略。
  const host = typeof serverPolicy?.host === 'string' ? serverPolicy.host.trim() : '';
  // 类型: number；来源: 冻结部署策略；作用: 保留已经过配置层校验的监听端口。
  const port = serverPolicy?.port;

  // 条件分支: 投影前再次验证第三方边界所需的两个字段，避免无效配置进入 Fastify 内部生命周期。
  if (host === '' || !Number.isInteger(port) || port <= 0) {
    throw new TypeError('代理监听策略需要有效 host 和 port');
  }

  // 返回值类型: object；作用: 有意保持可扩展，隔离 Fastify 对监听参数的内部写入与冻结部署策略。
  return { host, port };
}

/**
 * 创建代理应用并开始监听部署策略指定的地址。
 * 调用方: 直接 node 启动入口、生产启动检查。
 * 副作用: 绑定一个 TCP 监听端口并注册 SIGTERM/SIGINT 关闭处理；关闭时释放 Fastify 连接资源。
 * 成功路径: 返回已监听的 Fastify 应用，调用方可以继续观察进程生命周期。
 * 失败路径: 应用创建或监听失败向上 reject；直接启动入口只输出不带堆栈的错误摘要并以非零码退出。
 *
 * @returns {Promise<import('fastify').FastifyInstance>} 已成功监听的代理应用。
 * @throws {Error} 配置、路由注册或 TCP 监听失败时抛出。
 */
export async function start() {
  // 类型: object；来源: ProxyPolicy.logging 与仓库根；生命周期: 进程启动至关闭；作用: 所有运行和代理审计事件的唯一输出中心。
  const logger = createBackendLogger({ loggingConfig: proxyPolicy.logging, repositoryRoot: REPOSITORY_ROOT });
  // 类型: FastifyInstance|null；生命周期: 创建成功至关闭；作用: 启动任一后续步骤失败时只关闭已经创建的应用。
  let app = null;
  try {
    // 类型: object；来源: 统一日志中心；作用: 为每个 ProxyExecutor 请求创建有限审计事务。
    const auditLogger = createProxyAuditLogger({ logger });
    // 类型: FastifyInstance；来源: createProxyApp；生命周期: 进程启动至关闭；作用: 承载当前代理 HTTP 服务。
    app = createProxyApp({ policy: proxyPolicy, auditLogger });
    // 类型: object；来源: createProxyListenOptions；作用: 隔离冻结策略和 Fastify 可变监听入参，只交付 host/port。
    const listenOptions = createProxyListenOptions(proxyPolicy.server);
    // 异步调用: 绑定集中策略声明的地址；Fastify 只接管新投影，不会修改原部署策略。
    await app.listen(listenOptions);
  } catch (error) {
    // 启动失败只记录稳定阶段，不序列化初始化/listen Error、地址详情或堆栈；随后排空日志并保留原错误给进程边界。
    writeRuntimeEvent(logger, {
      action: LOG_ACTION.runtimeStartFailed,
      result: LOG_RESULT.failure,
      failureReason: 'listen_failed'
    });
    if (app !== null) {
      try {
        await app.close();
      } catch {
        writeRuntimeEvent(logger, {
          action: LOG_ACTION.runtimeStopFailed,
          result: LOG_RESULT.failure,
          failureReason: 'fastify_close_failed'
        });
      }
    }
    await logger.close();
    throw error;
  }
  // 副作用: 仅在真实监听成功后输出结构化就绪事实，开发编排器和 Render 都从标准流读取。
  writeRuntimeEvent(logger, {
    action: LOG_ACTION.runtimeStarted,
    result: LOG_RESULT.success,
    failureReason: null
  });

  // 类型: boolean；来源: 关闭回调；作用: 防止 SIGINT 和 SIGTERM 同时触发两次 close。
  let isClosing = false;
  /**
   * 收到进程终止信号后关闭当前 Fastify 应用。
   * 调用方: 当前进程 SIGINT 和 SIGTERM 一次性监听。
   * 副作用: 首次调用关闭 Fastify 连接资源并输出关闭结果；后续并发信号直接返回。
   * 成功路径: app.close 完成后输出 stopped 终态并 resolve。
   * 失败路径: Fastify 关闭失败时 reject，由 Node 未处理异步事件规则暴露进程故障。
   *
   * @returns {Promise<void>} 应用资源释放后完成。
   */
  async function shutdown() {
    // 条件分支: 关闭流程已经由另一个信号启动时进入；执行内容: 直接返回，避免重复调用 app.close。
    if (isClosing) {
      return;
    }

    isClosing = true;
    try {
      // 异步清理: Fastify 先等待现有请求收束，确保最后请求审计先进入日志队列。
      await app.close();
      writeRuntimeEvent(logger, {
        action: LOG_ACTION.runtimeStopped,
        result: LOG_RESULT.success,
        failureReason: null
      });
    } catch (error) {
      writeRuntimeEvent(logger, {
        action: LOG_ACTION.runtimeStopFailed,
        result: LOG_RESULT.failure,
        failureReason: 'fastify_close_failed'
      });
      throw error;
    } finally {
      // 日志清理: 排空 JSONL FIFO 并关闭文件句柄。
      await logger.close();
    }
  }

  // 类型: Function；作用: 为 SIGTERM 建立独立一次性回调，不让进程事件参数进入日志字段。
  const shutdownForSigterm = () => shutdown();
  // 类型: Function；作用: 为 SIGINT 建立独立一次性回调，与 SIGTERM 共用幂等关闭事务。
  const shutdownForSigint = () => shutdown();
  process.once('SIGTERM', shutdownForSigterm);
  process.once('SIGINT', shutdownForSigint);
  return app;
}

/**
 * 判断当前模块是否由 Node.js 直接执行。
 * 调用方: 文件底部启动分支。
 * 副作用: 读取 process.argv[1]，不监听端口也不修改进程状态。
 * 失败路径: process.argv[1] 缺失或路径不一致时返回 false，允许测试 import 而不启动服务。
 *
 * @returns {boolean} true 表示当前模块路径等于直接启动参数。
 */
function isDirectExecution() {
  return process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isDirectExecution()) {
  start().catch(() => {
    // 失败转换: runtime/start_failed 已由统一日志中心输出；直接入口只设置非零退出码，不建立第二套纯文本日志。
    process.exitCode = 1;
  });
}
