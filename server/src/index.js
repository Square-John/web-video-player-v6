/*
  index.js 模块说明

  - 文件职责:
      读取冻结部署策略、创建代理 Fastify 应用并提供正式 Node.js 启动入口。
      本文件只负责进程生命周期和监听地址，不实现协议校验、网络安全策略或上游业务逻辑。

  - 导入库及文件汇总(4 条，内置 2 条，第三方 0 条，自定义 2 条):
      node:url#fileURLToPath: 判断当前模块是否作为直接启动脚本执行。
      node:process: 读取进程参数、监听信号和输出启动失败摘要。
      ./config/proxyPolicy.js#proxyPolicy: 提供冻结监听地址和端口。
      ./http/createProxyApp.js#createProxyApp: 创建未监听端口的 HTTP 应用。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      start(): 创建应用、监听端口并注册关闭信号。
      isDirectExecution(): 判断当前模块是否由 node 直接运行。

  - 模块级类:
      无

  - 对外导出:
      start: async function，应用组合入口和 node 直接启动共同使用。
*/

// 导入来源: node:url；导入内容: fileURLToPath；文件作用: 安全比较当前入口模块绝对路径，避免 import 时意外监听端口。
import { fileURLToPath } from 'node:url';
// 导入来源: node:process；导入内容: process；文件作用: 读取启动参数、环境进程和终止信号。
import process from 'node:process';
// 导入来源: ./config/proxyPolicy.js；导入内容: proxyPolicy；文件作用: 提供当前进程冻结监听配置。
import { proxyPolicy } from './config/proxyPolicy.js';
// 导入来源: ./http/createProxyApp.js；导入内容: createProxyApp；文件作用: 组装唯一代理 HTTP 边界。
import { createProxyApp } from './http/createProxyApp.js';

/**
 * 创建代理应用并开始监听部署策略指定的地址。
 * 调用方: 直接 node 启动入口和应用组合层。
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
  // 异步调用: 只绑定集中策略声明的地址；不在启动处修改任何代理限制。
  await app.listen(proxyPolicy.server);

  // 类型: boolean；来源: 关闭回调；作用: 防止 SIGINT 和 SIGTERM 同时触发两次 close。
  let isClosing = false;
  // 回调: 收到进程终止信号后开始当前应用的有界关闭流程，不创建新的请求。
  const shutdown = async (signal) => {
    if (isClosing) {
      return;
    }

    isClosing = true;
    // 异步清理: Fastify 等待现有生命周期收束并释放监听器；失败向进程级 catch 传递。
    await app.close();
    process.stdout.write(`代理服务已响应 ${signal} 并关闭。\n`);
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
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
