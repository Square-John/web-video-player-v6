/*
  check-production-startup.mjs 模块说明

  - 文件职责:
      在不绑定 TCP 端口的前提下创建生产 Fastify 应用、完成插件就绪并验证唯一 POST 入口可注册。
      供 npm run build 最后执行；它证明生产模块可加载和关闭，但不替代步骤 2 的网络集成测试。

  - 导入库及文件汇总(3 条，内置 1 条，第三方 0 条，自定义 2 条):
      node:assert/strict: 验证 POST 入口存在且 GET 别名不存在。
      ../src/contracts/proxyProtocol.js#PROXY_REQUEST_ROUTE: 使用协议冻结路径检查路由。
      ../src/http/createProxyApp.js#createProxyApp: 创建生产默认依赖应用。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      run(): 完成应用 ready、路由断言和 finally 关闭。

  - 模块级类:
      无

  - 对外导出:
      无；由 npm run check:startup 直接执行。
*/

// 导入来源: node:assert/strict；导入内容: assert 默认对象；文件作用: 验证冻结 POST 路由和禁用 GET 别名。
import assert from 'node:assert/strict';
// 导入来源: ../src/contracts/proxyProtocol.js；导入内容: PROXY_REQUEST_ROUTE；文件作用: 使用唯一协议路径执行启动断言。
import { PROXY_REQUEST_ROUTE } from '../src/contracts/proxyProtocol.js';
// 导入来源: ../src/http/createProxyApp.js；导入内容: createProxyApp；文件作用: 创建默认生产应用并执行 Fastify ready。
import { createProxyApp } from '../src/http/createProxyApp.js';

/**
 * 验证生产应用可以完成模块加载、路由注册和资源关闭。
 * 调用方: npm run check:startup。
 * 副作用: 创建内存 Fastify 实例并在 finally 中关闭；不调用 listen，不占用端口，不访问网络。
 * 失败路径: 应用加载、ready、路由边界或 close 失败时保留异常并使脚本非零退出。
 *
 * @returns {Promise<void>} 全部启动边界通过后 resolve。
 */
async function run() {
  // 类型: FastifyInstance；来源: 生产默认 createProxyApp；生命周期: 当前检查；作用: 验证真实应用依赖可以注册。
  const app = createProxyApp();

  try {
    // 异步调用: 完成 Fastify 插件和路由初始化，但不启动 TCP 监听。
    await app.ready();
    assert.equal(app.hasRoute({ method: 'POST', url: PROXY_REQUEST_ROUTE }), true);
    assert.equal(app.hasRoute({ method: 'GET', url: PROXY_REQUEST_ROUTE }), false);
    process.stdout.write('生产启动检查通过：唯一 POST 代理入口已注册，未绑定网络端口。\n');
  } finally {
    // 资源清理: ready 成功或断言失败都关闭 Fastify 实例，避免构建进程残留句柄。
    await app.close();
  }
}

run().catch((error) => {
  // 失败转换: 构建日志只需要错误摘要；进程退出码负责阻断后续提交。
  process.stderr.write(`生产启动检查失败: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
