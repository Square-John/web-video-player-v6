/*
  upstreamTransport.js 模块说明

  - 文件职责:
      使用独立 Undici Client 对单个已解析 HTTPS 跳发送一次请求，并把连接固定到指定已验证 IP。
      供代理执行器逐跳调用；自动重定向关闭，每跳 Client 在 release 时销毁，不形成跨请求连接池或会话。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 1 条，自定义 3 条):
      undici#Client: 发送可注入固定 connector 的低层 HTTPS 请求并保留原始重复响应头。
      ../errors/proxyError.js#ProxyError: 将未分类连接、TLS 和传输失败映射为固定网络错误。
      ./upstreamEndpoint.js#resolveHttpsEndpointPort: 从已验证 URL 冻结当前跳有效 HTTPS 端口。
      ./pinnedConnector.js#createPinnedConnector: 约束真实 TLS 连接只能使用已验证地址。

  - 模块级常量:
      RAW_RESPONSE_HEADERS: string，要求 Undici 返回 name/value 交替数组以保留重复头顺序。
      DISABLED_PIPELINING: number，禁止 Client 复用 keep-alive 管线的配置值。

  - 模块级变量:
      无

  - 模块级辅助函数:
      findProxyError(error): 沿 cause 链查找固定地址连接器产生的 ProxyError。
      attachCleanupErrorHandler(body): 消费主动销毁响应流产生的预期 error，并在 close 后移除监听。
      destroyClient(client): 释放单跳 Client 且不让清理错误覆盖主失败。
      createUndiciHeaders(headers): 把协议有序头条目投影为 Undici 扁平数组，保留顺序和重复项。
      createUpstreamTransport(options): 创建可替换 Client/connector 工厂的单跳传输端口。

  - 模块级类:
      无

  - 对外导出:
      createUpstreamTransport: function，proxyExecutor 创建生产单跳请求端口。
*/

// 导入来源: undici；导入内容: Client；文件作用: 为每个上游跳创建不池化的低层 HTTPS 客户端。
import { Client } from 'undici';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 保留固定连接安全错误并映射其他网络失败。
import { ProxyError } from '../errors/proxyError.js';
// 导入来源: ./upstreamEndpoint.js；导入内容: resolveHttpsEndpointPort；文件作用: 在连接前把 URL 空端口或显式端口转换成冻结整数。
import { resolveHttpsEndpointPort } from './upstreamEndpoint.js';
// 导入来源: ./pinnedConnector.js；导入内容: createPinnedConnector；文件作用: 将 Undici TLS 连接固定到已审地址。
import { createPinnedConnector } from './pinnedConnector.js';

// 类型: string；来源: Undici request API；作用: 返回交替数组而不是合并对象，保留 set-cookie 等同名头顺序。
const RAW_RESPONSE_HEADERS = 'raw';

// 类型: number；来源: Undici Client pipelining 语义；作用: 0 禁止连接复用，确保每跳和每请求资源隔离。
const DISABLED_PIPELINING = 0;

/**
 * 沿有限 cause 链查找连接器或下层保留的 ProxyError。
 * 调用方: requestUpstream 的请求失败分支。
 * 副作用: 无；只读取 Error.cause，使用 Set 防止异常循环引用。
 * 失败路径: 未找到返回 null，不按 message 猜测错误分类。
 *
 * @param {unknown} error Undici 或连接器抛出的异常。
 * @returns {ProxyError|null} 找到的固定领域错误或 null。
 */
function findProxyError(error) {
  // 类型: Set<object>；生命周期: 当前错误归类；作用: 防止恶意或异常 cause 链循环。
  const visited = new Set();
  // 类型: unknown；来源: 初始错误及其 cause；作用: 逐层寻找 ProxyError，不解析文案。
  let currentError = error;

  while (currentError !== null && typeof currentError === 'object' && !visited.has(currentError)) {
    if (currentError instanceof ProxyError) {
      return currentError;
    }

    visited.add(currentError);
    currentError = currentError.cause;
  }

  return null;
}

/**
 * 为主动销毁的 Undici 响应流挂载预期错误清理端口。
 * 调用方: release 和响应编码器已经失败关闭的资源路径。
 * 副作用: 在当前 body 上添加一次 error/close 监听；不修改错误、不向日志输出。
 * 成功路径: destroy 产生的 UND_ERR_ABORTED 等清理错误被消费，不升级为未处理进程错误。
 * 失败路径: body 不支持标准事件端口时不执行任何操作，由上层继续关闭 Client。
 *
 * @param {unknown} body 当前 Undici 响应流。
 * @returns {void} 监听挂载完成或 body 不可监听时返回。
 */
function attachCleanupErrorHandler(body) {
  if (!body || typeof body.once !== 'function' || typeof body.removeListener !== 'function') {
    return;
  }

  // 回调: 主动 destroy 的错误只代表清理动作，真正的事务错误已经由执行器持有并继续返回。
  const absorbCleanupError = () => {};
  // 回调: 无 error 的正常 close 也要移除吸收器，避免 body 闭包延长生命周期。
  const removeCleanupErrorHandler = () => body.removeListener('error', absorbCleanupError);
  body.once('error', absorbCleanupError);
  body.once('close', removeCleanupErrorHandler);
}

/**
 * 销毁一个单跳 Undici Client。
 * 调用方: requestUpstream 失败路径和返回 release 端口。
 * 副作用: 关闭当前 Client、套接字和未完成 body；不影响其他请求，因为 Client 不共享。
 * 失败路径: destroy reject 被吸收，避免覆盖更具体的代理成功或失败结果。
 *
 * @param {Client} client 当前跳独占 Client。
 * @returns {Promise<void>} 清理完成或清理失败被吸收后完成。
 */
async function destroyClient(client) {
  try {
    await client.destroy();
  } catch {
    // 清理边界: Client 销毁失败不替换已经确定的网络、容量、媒体或成功结果。
  }
}

/**
 * 把协议有序头条目投影为 Undici 请求头扁平数组。
 * 调用方: requestUpstream 在进入 Client.request 前调用。
 * 副作用: 创建新的可变字符串数组交给 Undici 规范化；不修改、合并或排序冻结协议头。
 * 成功路径: 每个 name/value 相邻写入且保持原相对顺序，同名条目继续独立。
 * 失败路径: 无；条目形状已由请求校验器和头裁剪器保证。
 *
 * @param {ReadonlyArray<Readonly<{ name: string, value: string }>>} headers 当前跳已裁剪有序请求头。
 * @returns {Array<string>} 与协议对象隔离且供 Undici 内部管理的扁平 name/value 数组。
 */
function createUndiciHeaders(headers) {
  return headers.flatMap((header) => [header.name, header.value]);
}

/**
 * 创建单跳 Undici 传输端口。
 * 调用方: proxyExecutor 生产依赖和网络单元测试。
 * 状态所有权: 工厂只持有 Client 与 connector 构造端口；每次 requestUpstream 创建独立 Client。
 * 失败路径: 注入工厂不是函数时同步抛 TypeError。
 *
 * @param {object} [options={}] 传输依赖。
 * @param {Function} [options.ClientConstructor=Client] Undici Client 构造器。
 * @param {Function} [options.connectorFactory=createPinnedConnector] 固定 TLS 连接器工厂。
 * @returns {Readonly<{ requestUpstream: Function }>} 冻结单跳传输端口。
 * @throws {TypeError} 依赖无效时抛出。
 */
export function createUpstreamTransport({ ClientConstructor = Client, connectorFactory = createPinnedConnector } = {}) {
  if (typeof ClientConstructor !== 'function' || typeof connectorFactory !== 'function') {
    throw new TypeError('createUpstreamTransport 需要有效 Client 和 connector 工厂');
  }

  /**
   * 向当前已解析 HTTPS 跳发送一次请求。
   * 调用方: proxyExecutor 的逐跳循环。
   * 副作用: 创建一个独占 Client 和 TLS 连接；调用方必须在 finally 中调用返回的 release。
   * 成功路径: 返回状态、状态文本、原始有序头、body 流和幂等 release。
   * 失败路径: signal 中止原因向上保留；嵌套 ProxyError 保留；其他错误转 PROXY_UPSTREAM_NETWORK_ERROR。
   *
   * @param {object} options 当前跳请求参数。
   * @param {Readonly<{ url: string, hostname: string, addresses: ReadonlyArray<object> }>} options.resolvedTarget 当前跳解析快照。
   * @param {string} options.method GET 或 POST。
   * @param {ReadonlyArray<Readonly<{ name: string, value: string }>>} options.headers 已裁剪当前跳有序请求头。
   * @param {Buffer|undefined} options.body 已编码请求体。
   * @param {AbortSignal} options.signal 当前代理事务组合中止信号。
   * @param {number} options.timeoutMs 当前请求有效超时。
   * @returns {Promise<Readonly<object>>} 单跳响应资源与 release 端口。
   * @throws {ProxyError|unknown} 固定网络/安全错误或 signal 中止原因。
   */
  async function requestUpstream({ resolvedTarget, method, headers, body, signal, timeoutMs }) {
    // 类型: URL；来源: 当前跳已验证规范 URL；作用: 为 Client 提供原 origin 和不含片段的请求 path。
    const url = new URL(resolvedTarget.url);
    // 类型: number；来源: 已验证 HTTPS URL 的规范协议和端口；作用: 在进入 Undici 前冻结默认 443 或显式目标端口。
    const targetPort = resolveHttpsEndpointPort({ protocol: url.protocol, port: url.port });
    // 类型: Readonly<object>；来源: 全部 DNS 结果均通过安全门禁后的首个记录；作用: 当前 TLS 连接唯一允许地址。
    const pinnedAddress = resolvedTarget.addresses[0];
    // 类型: Function；来源: connectorFactory；作用: 连接前固定主机、地址和端口，并在握手后复核真实远端。
    const connect = connectorFactory({
      hostname: resolvedTarget.hostname,
      pinnedAddress,
      port: targetPort,
      connectTimeoutMs: timeoutMs
    });
    // 类型: Client；生命周期: 当前跳请求至 release；作用: 不与重定向跳或其他代理请求共享连接、Cookie 或会话。
    const client = new ClientConstructor(url.origin, {
      connect,
      pipelining: DISABLED_PIPELINING,
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs
    });

    try {
      // 异步调用: Client 不自动跟随 3xx；raw 响应头保留重复顺序，signal 覆盖连接、头和 body 生命周期。
      const response = await client.request({
        path: `${url.pathname}${url.search}`,
        method,
        // 运输适配: 只改变容器形状以满足 Undici，不合并、排序或解释 Provider 构造的允许头。
        headers: createUndiciHeaders(headers),
        body,
        signal,
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
        responseHeaders: RAW_RESPONSE_HEADERS
      });
      // 类型: boolean；生命周期: 当前响应资源；作用: release 可由多个 finally 路径调用但只销毁一次 Client。
      let released = false;

      /**
       * 释放当前跳响应流和独占 Client。
       * 调用方: proxyExecutor 每跳 finally。
       * 副作用: 必要时销毁未消费 body，并关闭 TLS Client；第二次调用无操作。
       * 失败路径: 清理异常被 destroyClient 吸收，不覆盖主事务结果。
       *
       * @returns {Promise<void>} 当前跳资源释放完成。
       */
      async function release() {
        if (released) {
          return;
        }

        released = true;
        if (response.body && typeof response.body.destroy === 'function' && response.body.destroyed !== true) {
          try {
            // 资源清理: 先消费主动 destroy 的异步 error，再销毁 body，避免正常失败关闭升级为未处理异常。
            attachCleanupErrorHandler(response.body);
            response.body.destroy();
          } catch {
            // 清理边界: body 销毁异常不阻止继续关闭独占 Client，也不覆盖主事务结果。
          }
        }
        await destroyClient(client);
      }

      return Object.freeze({
        statusCode: response.statusCode,
        statusText: response.statusText,
        rawHeaders: response.headers,
        body: response.body,
        release
      });
    } catch (error) {
      await destroyClient(client);

      if (signal.aborted) {
        throw error;
      }

      // 类型: ProxyError|null；来源: 明确 cause 链检查；作用: 保留固定连接器的目标禁止语义。
      const proxyError = findProxyError(error);
      if (proxyError) {
        throw proxyError;
      }

      // 错误转换: DNS 已在上层完成，剩余连接、TLS、请求头和传输错误统一为网络失败且不泄漏内部结构。
      throw new ProxyError('PROXY_UPSTREAM_NETWORK_ERROR', { cause: error });
    }
  }

  return Object.freeze({ requestUpstream });
}
