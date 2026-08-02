/*
  proxyRuntimeServer.fixture.js 模块说明

  - 文件职责:
      在独立子进程启动正式 Fastify HTTP 边界，并用只读模拟源站夹具替代外部上游执行端口。
      供前端 Runtime 跨进程测试验证真实 ProxyClient 传输；不进入生产构建产物或放宽后端安全策略。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      server/createProxyApp.js#createProxyApp: 创建正式协议、CORS 和错误处理 HTTP 应用。
      server/proxyError.js#ProxyError: 把未命中、超限和中止转换为稳定后端错误。
      response-fixtures.js#mockNetworkResponseFixtures: 提供确定性 A/B 原始源站响应。

  - 模块级常量:
      FIXTURE_HOST: string，子进程只监听的回环地址。
      FIXTURE_PORT: number，供 Node Fetch 使用的非保留本地测试端口。
      FIXTURE_MESSAGE_TYPE: Readonly<object>，父子进程 IPC 消息类型。
      fixtureByRequestKey: ReadonlyMap<string, object>，请求身份到只读响应夹具索引。

  - 模块级变量:
      proxyApp: FastifyInstance|null，当前子进程唯一监听应用。
      closePromise: Promise<void>|null，幂等关闭流程。

  - 模块级辅助函数:
      createRequestKey(sourceId, method, url): 创建精确夹具索引键。
      createFixtureIndex(fixtures): 校验并创建只读精确路由索引。
      createResponseHeaders(headers): 转换为代理协议有序响应头。
      encodeBase64(bytes): 把模拟上游原始字节包装为协议 base64。
      executeFixtureProxyRequest(validatedRequest, context): 返回标准代理成功或错误外壳。
      sendMessage(message): 向父进程发送 IPC 消息。
      closeFixtureServer(): 幂等关闭 Fastify 并退出 IPC 生命周期。
      startFixtureServer(): 监听随机回环端口并报告 baseUrl。

  - 模块级类:
      无

  - 对外导出:
      无；仅由 child_process.fork 直接执行。
*/

// 导入来源: ../../../server/src/http/createProxyApp.js。
// 导入内容: createProxyApp 正式 Fastify 应用工厂。
// 文件作用: 复用真实 HTTP 入口、请求校验、CORS、中止和错误外壳处理。
import { createProxyApp } from '../../../server/src/http/createProxyApp.js';

// 导入来源: ../../../server/src/errors/proxyError.js。
// 导入内容: ProxyError 后端稳定领域错误。
// 文件作用: 测试上游未命中、容量和中止继续使用公共协议错误码。
import { ProxyError } from '../../../server/src/errors/proxyError.js';

// 导入来源: ../../src/data/providers/mock-network/response-fixtures.js。
// 导入内容: mockNetworkResponseFixtures A/B 原始响应夹具。
// 文件作用: 子进程模拟外部源站，不创建第二套业务标准对象。
import { mockNetworkResponseFixtures } from '../../src/data/providers/mock-network/response-fixtures.js';

// 类型: string；来源: 本地跨进程测试安全边界；作用: Fastify 只监听回环地址并使用专用测试端口。
const FIXTURE_HOST = '127.0.0.1';

// 类型: number；来源: Fetch 禁止端口策略之外的本地测试约定；作用: 避免随机端口落入浏览器保留端口而使 ProxyClient 在请求前失败。
const FIXTURE_PORT = 5180;

// 类型: Readonly<object>；来源: 当前测试父子进程协议；作用: 避免按任意 message 文本执行关闭或采用地址。
const FIXTURE_MESSAGE_TYPE = Object.freeze({
  ready: 'ready',
  close: 'close',
  closed: 'closed',
  failed: 'failed'
});

/**
 * 创建模拟源站精确请求键。
 * 纯函数: 只组合已验证字符串，不修改请求或夹具。
 *
 * @param {string} sourceId 数据源身份。
 * @param {string} method 标准 HTTP 方法。
 * @param {string} url 规范化目标 URL。
 * @returns {string} 唯一夹具索引键。
 */
function createRequestKey(sourceId, method, url) {
  return `${sourceId}\n${method}\n${url}`;
}

/**
 * 创建只读模拟源站路由索引。
 * 纯函数: 返回新 Map；不修改或复制深冻结夹具正文。
 * 成功路径: 每条 sourceId/method/url 唯一登记并返回 Map。
 * 失败路径: 输入不是数组或出现重复路由时抛 TypeError。
 *
 * @param {*} fixtures 响应夹具候选数组。
 * @returns {Map<string, object>} 当前子进程私有只读使用索引。
 * @throws {TypeError} 夹具集合结构或身份重复时抛出。
 */
function createFixtureIndex(fixtures) {
  // 条件分支: 夹具根不是数组时进入。
  // 执行内容: 抛 TypeError，子进程不会带不明确上游数据启动。
  if (!Array.isArray(fixtures)) {
    throw new TypeError('proxy runtime fixtures 必须是数组');
  }

  // 类型: Map<string, object>；作用: 保存精确请求身份到冻结原始响应夹具的映射。
  const index = new Map();
  // 循环类型: for...of；终止条件: 全部 A/B catalog/health 路由完成唯一登记。
  // 循环作用: 建立与 MockNetworkAdapter 相同的精确路由事实，但响应通过后端 HTTP 返回。
  for (const fixture of fixtures) {
    // 类型: string；作用: 组合当前夹具 sourceId、method 和 URL 的不可猜测路由键。
    const key = createRequestKey(fixture.sourceId, fixture.method, fixture.url);
    // 条件分支: 同一精确路由已经登记时进入。
    // 执行内容: 抛 TypeError，禁止后写覆盖改变联调结果。
    if (index.has(key)) {
      throw new TypeError(`proxy runtime fixture 重复: ${fixture.url}`);
    }
    index.set(key, fixture);
  }

  return index;
}

/**
 * 把夹具响应头对象转换为代理协议有序条目。
 * 纯函数: 返回新数组和条目对象，不修改夹具 headers。
 *
 * @param {Readonly<Record<string,string>>} headers 模拟上游响应头。
 * @returns {ReadonlyArray<Readonly<object>>} 有序 name/value 条目。
 */
function createResponseHeaders(headers) {
  return Object.freeze(Object.entries(headers).map(([name, value]) => Object.freeze({ name, value })));
}

/**
 * 把原始响应字节编码为 Proxy Protocol 2.0 base64 文本。
 * 纯函数: 只读取 Uint8Array，不解释字符编码或业务正文。
 *
 * @param {Uint8Array} bytes 模拟上游完整原始响应字节。
 * @returns {string} 可放入 JSON 运输外壳的标准 base64。
 */
function encodeBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

// 类型: Map<string, object>；来源: 生产模拟响应夹具；作用: 当前子进程全部请求只读命中该精确索引。
const fixtureByRequestKey = createFixtureIndex(mockNetworkResponseFixtures);

/**
 * 执行确定性模拟源站代理请求。
 * 副作用: 只读取当前子进程夹具索引并序列化一次正文计算字节，不保存请求、响应或会话。
 * 成功路径: 请求命中夹具后返回只包装原始字节的 ProxyResponseEnvelope 2.0.0。
 * 失败路径: 中止、未知路由或容量超限抛稳定 ProxyError。
 *
 * @param {Readonly<object>} validatedRequest 后端请求校验器返回的 request/effectiveLimits。
 * @param {Readonly<{ signal: AbortSignal }>} context 当前 HTTP 生命周期上下文。
 * @returns {Promise<Readonly<object>>} 标准代理成功外壳。
 * @throws {ProxyError} 模拟上游请求不能安全完成时抛出。
 */
async function executeFixtureProxyRequest(validatedRequest, context) {
  // 条件分支: 父进程连接已中止当前 HTTP 生命周期时进入。
  // 执行内容: 抛 PROXY_REQUEST_ABORTED，不继续读取或序列化夹具。
  if (context.signal.aborted) {
    throw new ProxyError('PROXY_REQUEST_ABORTED');
  }

  // 类型: Readonly<object>；作用: 保存后端精确校验后的公共协议请求字段。
  const request = validatedRequest.request;
  // 类型: string；作用: 生成与夹具索引相同的 sourceId/method/url 精确身份。
  const requestKey = createRequestKey(request.sourceId, request.target.method, request.target.url);
  // 类型: object|undefined；作用: 读取当前请求对应的模拟源站原始响应。
  const fixture = fixtureByRequestKey.get(requestKey);

  // 条件分支: 请求未命中受审模拟源站路由时进入。
  // 执行内容: 抛上游网络错误，不回退 MockNetworkAdapter 或按 URL 猜测响应。
  if (!fixture) {
    throw new ProxyError('PROXY_UPSTREAM_NETWORK_ERROR');
  }

  // 类型: string；作用: 模拟源站把业务 JSON 序列化为线上文本，代理本身不再解析该文本。
  const serializedBody = JSON.stringify(fixture.body);
  // 类型: Uint8Array；作用: 保存模拟上游完整原始字节，容量和 base64 都消费同一事实。
  const responseBytes = new TextEncoder().encode(serializedBody);
  // 类型: number；作用: 保存模拟上游原始响应字节数并回填协议 meta。
  const receivedBytes = responseBytes.byteLength;

  // 条件分支: 模拟上游正文超过当前请求有效响应上限时进入。
  // 执行内容: 抛响应超限错误，不截断或返回半解析正文。
  if (receivedBytes > validatedRequest.effectiveLimits.maxResponseBytes) {
    throw new ProxyError('PROXY_RESPONSE_TOO_LARGE');
  }

  return Object.freeze({
    protocolVersion: request.protocolVersion,
    requestId: request.requestId,
    upstream: Object.freeze({
      status: fixture.status,
      statusText: fixture.statusText,
      responseUrl: fixture.responseUrl,
      headers: createResponseHeaders(fixture.headers)
    }),
    body: Object.freeze({ encoding: 'base64', data: encodeBase64(responseBytes) }),
    meta: Object.freeze({ redirectCount: 0, receivedBytes })
  });
}

// 类型: FastifyInstance|null；生命周期: 子进程启动至关闭；作用: 保存唯一监听应用供 IPC close 使用。
let proxyApp = null;
// 类型: Promise<void>|null；生命周期: 首次关闭请求至进程退出；作用: 合并重复 close/disconnect 清理调用。
let closePromise = null;

/**
 * 向父进程发送一个结构化状态消息。
 * 副作用: 通过当前 IPC 通道发送一次消息，不写 stdout、文件或网络日志。
 * 成功路径: 父进程连接存在时发送并返回。
 * 失败路径: IPC 不可用时抛 Error，子进程启动测试失败。
 *
 * @param {object} message 只含类型和必要地址/错误说明的消息。
 * @returns {void} 发送完成不返回业务值。
 * @throws {Error} 当前进程没有可用 IPC 通道时抛出。
 */
function sendMessage(message) {
  // 条件分支: 当前脚本没有由 fork 创建 IPC 通道时进入。
  // 执行内容: 抛 Error，禁止退回 stdout 文本协议。
  if (typeof process.send !== 'function') {
    throw new Error('proxy runtime fixture 需要 IPC 通道');
  }
  process.send(message);
}

/**
 * 幂等关闭当前 Fastify 测试服务。
 * 副作用: 关闭唯一监听 socket、通知父进程并断开 IPC；不删除或创建文件。
 * 成功路径: 首次调用完成全部清理，重复调用复用同一 Promise。
 * 失败路径: Fastify close 失败向调用方传播并由进程失败处理发送安全摘要。
 *
 * @returns {Promise<void>} 服务和 IPC 均关闭后完成。
 */
async function closeFixtureServer() {
  // 条件分支: 已经存在关闭流程时进入。
  // 执行内容: 返回同一 Promise，不重复关闭 Fastify 或发送 closed。
  if (closePromise) {
    return closePromise;
  }

  closePromise = (async () => {
    // 条件分支: 应用已经创建时进入。
    // 执行内容: 等待 Fastify 释放监听 socket 和请求资源。
    if (proxyApp) {
      await proxyApp.close();
    }
    sendMessage({ type: FIXTURE_MESSAGE_TYPE.closed });
    process.disconnect();
  })();

  return closePromise;
}

/**
 * 启动跨进程测试代理服务。
 * 副作用: 创建 Fastify 应用并监听回环随机端口，注册一个 IPC 关闭监听器。
 * 成功路径: 在专用安全端口监听并向父进程发送可供 ProxyClient 使用的 baseUrl。
 * 失败路径: 应用创建、监听或地址解析失败向调用方 reject。
 *
 * @returns {Promise<void>} 服务进入监听并发送 ready 后完成。
 */
async function startFixtureServer() {
  proxyApp = createProxyApp({ executeProxyRequest: executeFixtureProxyRequest });
  // 类型: string；作用: 保存 Fastify 专用测试端口监听地址，直接作为 ProxyClient baseUrl。
  const baseUrl = await proxyApp.listen({ host: FIXTURE_HOST, port: FIXTURE_PORT });

  /**
   * 处理父进程关闭命令。
   * 副作用: 合法 close 消息触发幂等 Fastify/IPC 清理；其他消息被忽略。
   * 成功路径: close 消息完成清理，其他类型保持服务运行。
   * 失败路径: 关闭失败由 Promise catch 进入统一子进程失败路径。
   *
   * @param {*} message 父进程 IPC 消息候选。
   * @returns {void} 处理器本身不返回业务值。
   */
  function handleParentMessage(message) {
    // 条件分支: 消息是精确 close 命令时进入。
    // 执行内容: 启动幂等关闭，并把失败交给统一失败处理函数。
    if (message?.type === FIXTURE_MESSAGE_TYPE.close) {
      closeFixtureServer().catch(handleFixtureFailure);
    }
  }

  process.on('message', handleParentMessage);
  sendMessage({ type: FIXTURE_MESSAGE_TYPE.ready, baseUrl });
}

/**
 * 收敛子进程启动或关闭失败。
 * 副作用: 尽力发送不含堆栈的 failed 消息并设置非零退出码。
 * 成功路径: 无；该函数只处理失败。
 * 失败路径: IPC 已断开时跳过消息发送，仍设置 process.exitCode。
 *
 * @param {*} error 当前子进程失败。
 * @returns {void} 失败通过 IPC 和退出码表达。
 */
function handleFixtureFailure(error) {
  // 类型: string；作用: 只保留 Error.message 或稳定字符串，不把堆栈和对象传给父进程。
  const message = error instanceof Error ? error.message : String(error);
  // 条件分支: IPC 仍连接且 send 可用时进入。
  // 执行内容: 向父进程发送最小失败摘要，便于立即终止测试。
  if (process.connected && typeof process.send === 'function') {
    process.send({ type: FIXTURE_MESSAGE_TYPE.failed, message });
    process.disconnect();
  }
  process.exitCode = 1;
}

// 启动边界: 文件只由 fork 直接执行，所有启动失败都转换为 IPC 摘要和非零退出码。
startFixtureServer().catch(handleFixtureFailure);
