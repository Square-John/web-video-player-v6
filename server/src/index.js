/*
  index.js 模块说明

  - 文件职责:
      使用根 backend.config.js 已校验生成的冻结策略，创建代理 Fastify 应用并提供正式 Node.js 启动入口。
      本文件只负责进程生命周期和监听地址，不实现协议校验、网络安全策略或上游业务逻辑。

  - 导入库及文件汇总(4 条，内置 2 条，第三方 0 条，自定义 2 条):
      node:url#fileURLToPath: 判断当前模块是否作为直接启动脚本执行。
      node:process: 读取进程参数、监听信号和输出启动失败摘要。
      ./config/proxyPolicy.js#proxyPolicy: 提供由根后端配置生成的冻结监听、CORS 和限制策略。
      ./http/createProxyApp.js#createProxyApp: 创建未监听端口的 HTTP 应用。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      createProxyListenOptions(serverPolicy): 把冻结部署策略投影为 Fastify 可以安全接管的监听参数。
      formatProxyListenAddress(listenOptions): 把 IPv4、IPv6 或主机名监听参数转换为可读地址。
      start(): 创建应用、监听端口并注册关闭信号。
      isDirectExecution(): 判断当前模块是否由 node 直接运行。

  - 模块级类:
      无

  - 对外导出:
      createProxyListenOptions: function，生产启动和运行时契约测试共用的第三方可变入参边界。
      start: async function，生产启动检查和 node 直接启动共同使用。
*/

// 导入来源: node:url；导入内容: fileURLToPath；文件作用: 安全比较当前入口模块绝对路径，避免 import 时意外监听端口。
import { fileURLToPath } from 'node:url';
// 导入来源: node:process；导入内容: process；文件作用: 读取启动参数、环境进程和终止信号。
import process from 'node:process';
// 导入来源: ./config/proxyPolicy.js；导入内容: proxyPolicy；文件作用: 提供根 backend.config.js 经严格校验和硬上限映射后的当前进程策略。
import { proxyPolicy } from './config/proxyPolicy.js';
// 导入来源: ./http/createProxyApp.js；导入内容: createProxyApp；文件作用: 组装唯一代理 HTTP 边界。
import { createProxyApp } from './http/createProxyApp.js';

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
 * 把 Fastify 监听参数转换为可读主机和端口。
 * 调用方: start 的监听成功输出。
 * 纯函数: 只读取 host 和 port，不访问网络或修改监听参数。
 * 成功路径: IPv6 主机补充方括号，IPv4 和主机名保持原文本。
 * 失败路径: 输入已由 createProxyListenOptions 校验，本函数不提供第二套回退。
 *
 * @param {{host: string, port: number}} listenOptions 已校验的 Fastify 监听参数。
 * @returns {string} 适合终端展示的 host:port 文本。
 */
function formatProxyListenAddress(listenOptions) {
  // 类型: string；作用: IPv6 含冒号时使用方括号消除与端口分隔符的歧义。
  const displayHost = listenOptions.host.includes(':')
    ? `[${listenOptions.host}]`
    : listenOptions.host;
  return `${displayHost}:${listenOptions.port}`;
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
  // 类型: FastifyInstance；来源: createProxyApp；生命周期: 进程启动至关闭；作用: 承载当前代理 HTTP 服务。
  const app = createProxyApp({ policy: proxyPolicy });
  // 类型: object；来源: createProxyListenOptions；作用: 隔离冻结策略和 Fastify 可变监听入参，只交付 host/port。
  const listenOptions = createProxyListenOptions(proxyPolicy.server);
  // 异步调用: 绑定集中策略声明的地址；Fastify 只接管新投影，不会修改原部署策略。
  await app.listen(listenOptions);
  // 副作用: 仅在真实监听成功后输出就绪事实，根开发编排器和进程管理器可据此判断后端已经可用。
  process.stdout.write(`代理服务已启动，监听 ${formatProxyListenAddress(listenOptions)}。\n`);

  // 类型: boolean；来源: 关闭回调；作用: 防止 SIGINT 和 SIGTERM 同时触发两次 close。
  let isClosing = false;
  /**
   * 收到进程终止信号后关闭当前 Fastify 应用。
   * 调用方: 当前进程 SIGINT 和 SIGTERM 一次性监听。
   * 副作用: 首次调用关闭 Fastify 连接资源并输出关闭结果；后续并发信号直接返回。
   * 成功路径: app.close 完成后输出实际信号名称并 resolve。
   * 失败路径: Fastify 关闭失败时 reject，由 Node 未处理异步事件规则暴露进程故障。
   *
   * @param {NodeJS.Signals} signal 当前收到的终止信号。
   * @returns {Promise<void>} 应用资源释放后完成。
   */
  async function shutdown(signal) {
    // 条件分支: 关闭流程已经由另一个信号启动时进入；执行内容: 直接返回，避免重复调用 app.close。
    if (isClosing) {
      return;
    }

    isClosing = true;
    // 异步清理: Fastify 等待现有生命周期收束并释放监听器；失败向进程级 catch 传递。
    await app.close();
    process.stdout.write(`代理服务已响应 ${signal} 并关闭。\n`);
  }

  // 类型: Function；作用: 为 SIGTERM 监听固定实际信号名称，避免 Node 事件不传参数时输出 undefined。
  const shutdownForSigterm = shutdown.bind(null, 'SIGTERM');
  // 类型: Function；作用: 为 SIGINT 监听固定实际信号名称，供终端 Ctrl+C 关闭。
  const shutdownForSigint = shutdown.bind(null, 'SIGINT');
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
  start().catch((error) => {
    // 失败转换: 直接启动只输出安全错误摘要，避免向终端暴露运行时堆栈和内部对象。
    process.stderr.write(`代理服务启动失败: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
