/*
  check-production-startup.mjs 模块说明

  - 文件职责:
      在不绑定 TCP 端口的前提下采用根后端配置生成的生产策略，创建 Fastify 应用并验证唯一 POST 入口。
      供 npm run build 最后执行；它证明配置、策略和生产模块可加载关闭，但不替代真实网络集成测试。

  - 导入库及文件汇总(4 条，内置 1 条，第三方 0 条，自定义 3 条):
      node:assert/strict: 验证 POST 入口存在且 GET 别名不存在。
      ../src/config/proxyPolicy.js#HARD_LIMITS/proxyPolicy: 验证根配置已形成完整冻结策略。
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
// 导入来源: ../src/config/proxyPolicy.js；导入内容: HARD_LIMITS、proxyPolicy；文件作用: 验证根后端配置已映射为完整冻结生产策略。
import { HARD_LIMITS, proxyPolicy } from '../src/config/proxyPolicy.js';
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
  // 类型: FastifyInstance；来源: 根配置生成的 proxyPolicy 与生产 createProxyApp；生命周期: 当前检查；作用: 验证真实应用依赖可以注册。
  const app = createProxyApp({ policy: proxyPolicy });

  try {
    // 异步调用: 完成 Fastify 插件和路由初始化，但不启动 TCP 监听。
    await app.ready();
    assert.equal(app.hasRoute({ method: 'POST', url: PROXY_REQUEST_ROUTE }), true);
    assert.equal(app.hasRoute({ method: 'GET', url: PROXY_REQUEST_ROUTE }), false);
    assert.equal(Object.isFrozen(proxyPolicy), true);
    assert.equal(Object.isFrozen(proxyPolicy.server.allowedOrigins), true);
    assert.deepEqual(Object.keys(proxyPolicy.limits).sort(), Object.keys(HARD_LIMITS).sort());
    process.stdout.write('生产启动检查通过：根后端配置已生成冻结策略，唯一 POST 代理入口已注册，未绑定网络端口。\n');
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
