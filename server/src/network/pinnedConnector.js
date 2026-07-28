/*
  pinnedConnector.js 模块说明

  - 文件职责:
      为单个已解析 HTTPS 跳创建 Undici TLS 连接器，把域名连接固定到一个已通过安全检查的 IP。
      先用已验证 IP 建立原始 TCP 连接并复核 remoteAddress，再把该 socket 交给 Undici 完成 TLS，阻止连接阶段二次解析或换址。

  - 导入库及文件汇总(5 条，内置 1 条，第三方 1 条，自定义 3 条):
      node:net#connect、isIP: 直接连接已审 IP，并判断 IP 目标是否需要 TLS SNI。
      undici#buildConnector: 使用 Undici 正式连接器把已复核 TCP socket 升级为 TLS 并保持证书校验语义。
      ../errors/proxyError.js#ProxyError: 将主机偏离和地址换址映射为目标禁止错误。
      ../security/ipAddressPolicy.js#normalizeIpAddress: 用同一规则比较 DNS 候选和真实 TCP 远端地址。
      ./upstreamEndpoint.js#resolveHttpsEndpointPort: 统一验证冻结端口并解释 Undici 默认 HTTPS 空端口。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeConnectorHostname(hostname): 规范化 Undici 连接参数中的主机文本。
      assertConnectorHostname(expectedHostname, actualHostname): 阻止连接参数主机偏离当前解析快照。
      normalizePinnedPort(port): 验证上游传输交付的冻结整数端口。
      assertConnectorPort(expectedPort, protocol, port): 复核 Undici 有效端口没有偏离冻结目标。
      assertPinnedRemoteAddress(pinnedAddress, remoteAddress): 复核真实 TCP 地址没有脱离已验证结果。
      createPinnedTcpConnection(options, callback): 建立已验证地址的原始 TCP 连接并复核远端地址。
      createPinnedConnector(options): 创建保留域名校验并复用已复核 socket 的 Undici connector。

  - 模块级类:
      无

  - 对外导出:
      assertPinnedRemoteAddress: function，连接层安全测试与 connector 共用地址一致性断言。
      createPinnedConnector: function，upstreamTransport 为每个跳和地址创建隔离连接器。
*/

// 导入来源: node:net；导入内容: connect、isIP；文件作用: 直接连接已审 IP 并判断 IP 字面量目标的 SNI 边界。
import { connect as createTcpConnection, isIP } from 'node:net';
// 导入来源: undici；导入内容: buildConnector；文件作用: 将已复核 TCP socket 升级为正式 Undici TLS 连接。
import { buildConnector } from 'undici';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 表达主机或连接地址脱离已验证结果的安全失败。
import { ProxyError } from '../errors/proxyError.js';
// 导入来源: ../security/ipAddressPolicy.js；导入内容: normalizeIpAddress；文件作用: 统一比较已验证地址和真实 TCP 远端地址。
import { normalizeIpAddress } from '../security/ipAddressPolicy.js';
// 导入来源: ./upstreamEndpoint.js；导入内容: resolveHttpsEndpointPort；文件作用: 验证冻结端口并复核 Undici 的空端口/显式端口语义。
import { resolveHttpsEndpointPort } from './upstreamEndpoint.js';

/**
 * 规范化 Undici 连接参数中的主机文本。
 * 调用方: assertConnectorHostname 和 createPinnedConnector。
 * 副作用: 无；只移除 IPv6 文本方括号并转为小写。
 * 失败路径: 非字符串或空主机返回空字符串，由调用方形成目标禁止错误。
 *
 * @param {unknown} hostname Undici connector 提供的 hostname 或 host。
 * @returns {string} 可比较的主机文本。
 */
function normalizeConnectorHostname(hostname) {
  if (typeof hostname !== 'string' || hostname.length === 0) {
    return '';
  }

  const unwrapped = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  return unwrapped.toLowerCase();
}

/**
 * 确认 Undici 本次连接使用的主机仍是当前解析快照对应的原主机。
 * 调用方: createPinnedTcpConnection 的每次连接入口。
 * 副作用: 无；只比较参数，不访问 DNS 或创建 socket。
 * 失败路径: 主机缺失或改变时抛 PROXY_TARGET_FORBIDDEN。
 *
 * @param {string} expectedHostname targetResolver 返回的当前原主机。
 * @param {unknown} actualHostname Undici connector 当前提供的 hostname 或 host。
 * @returns {void} 主机一致时无返回值。
 * @throws {ProxyError} 连接主机偏离当前解析快照时抛出。
 */
function assertConnectorHostname(expectedHostname, actualHostname) {
  if (normalizeConnectorHostname(expectedHostname) !== normalizeConnectorHostname(actualHostname)) {
    throw new ProxyError('PROXY_TARGET_FORBIDDEN', {
      details: { field: 'target.url', reason: 'connection_hostname_changed' }
    });
  }
}

/**
 * 验证上游传输交付的冻结目标端口。
 * 调用方: createPinnedConnector 构造阶段。
 * 副作用: 无；只把整数端口交给共用 HTTPS 端点规则复核。
 * 成功路径: 返回 1 至 65535 的原整数端口。
 * 失败路径: 非正安全整数或超出 TCP 范围时抛 TypeError，阻止创建连接器。
 *
 * @param {unknown} port upstreamTransport 从已验证 URL 解析的端口。
 * @returns {number} 通过共用规则复核的 HTTPS 端口。
 * @throws {TypeError} 端口不能作为冻结连接身份时抛出。
 */
function normalizePinnedPort(port) {
  if (!Number.isSafeInteger(port) || port <= 0) {
    throw new TypeError('固定连接端口必须是正安全整数');
  }

  try {
    return resolveHttpsEndpointPort({ protocol: 'https:', port: String(port) });
  } catch (error) {
    throw new TypeError('固定连接端口超出 HTTPS 端点范围', { cause: error });
  }
}

/**
 * 复核 Undici 当前连接参数的有效端口仍等于冻结目标端口。
 * 调用方: createPinnedTcpConnection 在创建 raw socket 前执行。
 * 副作用: 无；只读取协议和端口文本，不创建网络资源。
 * 成功路径: Undici 的默认 HTTPS 空端口或显式端口解析后与 expectedPort 一致。
 * 失败路径: 协议/端口非法或端口改变时抛 PROXY_TARGET_FORBIDDEN。
 *
 * @param {number} expectedPort 上游传输冻结的有效端口。
 * @param {unknown} protocol Undici connector 提供的协议文本。
 * @param {unknown} port Undici connector 提供的端口文本。
 * @returns {void} 有效端口一致时无返回值。
 * @throws {ProxyError} 连接端点无法验证或发生变化时抛出。
 */
function assertConnectorPort(expectedPort, protocol, port) {
  // 类型: number|undefined；作用: 保存第三方连接参数解析结果，解析失败统一转换为不泄漏输入的目标禁止错误。
  let actualPort;
  try {
    actualPort = resolveHttpsEndpointPort({ protocol, port });
  } catch (error) {
    throw new ProxyError('PROXY_TARGET_FORBIDDEN', {
      details: { field: 'target.url', reason: 'connection_port_invalid' },
      cause: error
    });
  }

  // 安全边界: Undici 不能在 Client 创建后把默认或显式端口改为另一个目标端口。
  if (actualPort !== expectedPort) {
    throw new ProxyError('PROXY_TARGET_FORBIDDEN', {
      details: { field: 'target.url', reason: 'connection_port_changed' }
    });
  }
}

/**
 * 确认 TLS 套接字真实远端地址与当前已验证地址一致。
 * 调用方: createPinnedTcpConnection 的 TCP connect 回调；安全策略测试直接验证失败关闭语义。
 * 副作用: 无；只规范化并比较两个地址，不访问 DNS、不创建或销毁套接字。
 * 成功路径: IPv4、IPv6 或 IPv4 映射形式规范化后相同则正常返回。
 * 失败路径: 地址非法或不一致时抛 PROXY_TARGET_FORBIDDEN，错误详情不包含地址原值。
 *
 * @param {unknown} pinnedAddress 当前连接前已通过安全检查的地址。
 * @param {unknown} remoteAddress TCP connect 后 socket.remoteAddress。
 * @returns {void} 地址一致时无返回值。
 * @throws {ProxyError} 地址非法或真实连接发生换址时抛出。
 */
export function assertPinnedRemoteAddress(pinnedAddress, remoteAddress) {
  // 类型: string；来源: 连接前 DNS 安全快照；作用: 使用与真实套接字相同的规范化规则进行比较。
  const expectedRemoteAddress = normalizeIpAddress(pinnedAddress);
  // 类型: string；来源: TCP socket.remoteAddress；作用: 消除 IPv4 映射 IPv6 的文本差异后执行安全断言。
  const actualRemoteAddress = normalizeIpAddress(remoteAddress);

  if (actualRemoteAddress !== expectedRemoteAddress) {
    throw new ProxyError('PROXY_TARGET_FORBIDDEN', {
      details: { field: 'target.url', reason: 'connected_address_changed' }
    });
  }
}

/**
 * 通过已验证 IP 建立原始 TCP 连接，并在 TCP connect 事件复核真实远端地址。
 * 调用方: createPinnedConnector 的每个 HTTPS 跳。
 * 副作用: 创建一个只属于当前跳的 TCP socket；TLS 升级前地址失败会销毁该 socket。
 * 成功路径: 返回已经连接且 remoteAddress 与 pinnedAddress 一致的 socket。
 * 失败路径: 主机、端口、连接或地址复核失败通过 callback 交付，不能进入 TLS 或 HTTP。
 *
 * @param {object} options 当前 TCP 连接参数。
 * @param {string} options.hostname 当前原主机，用于校验 Undici 参数没有换主机。
 * @param {string} options.actualHostname Undici connector 当前使用的主机。
 * @param {string} options.address 已验证连接地址。
 * @param {4|6} options.family 已验证地址族。
 * @param {number} options.port 上游传输冻结的当前目标端口。
 * @param {unknown} options.actualProtocol Undici connector 当前使用的协议文本。
 * @param {unknown} options.actualPort Undici connector 当前使用的端口文本。
 * @param {number} options.connectTimeoutMs 连接阶段超时。
 * @param {Function} callback 原始 TCP socket 或错误完成回调。
 * @returns {void} 结果只通过 callback 交付。
 */
function createPinnedTcpConnection({
  hostname,
  actualHostname,
  address,
  family,
  port,
  actualProtocol,
  actualPort,
  connectTimeoutMs
}, callback) {
  try {
    assertConnectorHostname(hostname, actualHostname);
    assertConnectorPort(port, actualProtocol, actualPort);
  } catch (error) {
    callback(error, null);
    return;
  }

  // 类型: AbortSignal；来源: 当前连接超时策略；作用: 让 TCP 连接在有限时间内完成或失败关闭。
  const connectTimeoutSignal = AbortSignal.timeout(connectTimeoutMs);
  let socket;

  try {
    // 类型: Socket；生命周期: 当前 TCP 连接直到 TLS 升级或失败销毁；作用: 直接向已验证地址发起连接。
    socket = createTcpConnection({
      host: address,
      family,
      port
    });
  } catch (error) {
    callback(error, null);
    return;
  }

  let callbackCompleted = false;
  // 回调: 连接超时只销毁当前 raw socket，不把未完成连接交给 TLS 或 HTTP。
  const abortSocket = () => socket.destroy();
  // 回调: TCP 建连失败只交付一次，Undici 随后把错误归类为网络失败。
  const completeWithError = (error) => {
    if (callbackCompleted) {
      return;
    }

    callbackCompleted = true;
    connectTimeoutSignal.removeEventListener('abort', abortSocket);
    callback(error, null);
  };
  // 回调: raw socket 已连接后在 TLS 握手前验证真实远端地址，确保实际 TCP 目标没有换址。
  const completeWithSocket = () => {
    if (callbackCompleted) {
      return;
    }

    callbackCompleted = true;
    connectTimeoutSignal.removeEventListener('abort', abortSocket);
    socket.removeListener('error', completeWithError);
    try {
      assertPinnedRemoteAddress(address, socket.remoteAddress);
      callback(null, socket);
    } catch (error) {
      // 资源清理: 地址不一致时不能把 socket 交给 TLS，立即销毁并交付固定安全错误。
      socket.destroy();
      callback(error, null);
    }
  };

  connectTimeoutSignal.addEventListener('abort', abortSocket, { once: true });
  socket.once('error', completeWithError);
  socket.once('connect', completeWithSocket);
}

/**
 * 创建一个绑定原主机、已验证 IP 和连接超时的 Undici connector。
 * 调用方: upstreamTransport 为当前跳创建独立 Client。
 * 副作用: connector 被调用时先创建 raw TCP 套接字，再由 Undici 创建 TLS 包装；失败时释放当前跳资源。
 * 成功路径: TCP remoteAddress 已复核，证书按原 hostname 校验，TLS socket 所有权转交 Undici。
 * 失败路径: 参数非法同步抛 TypeError；主机、连接或 TLS 错误通过 callback 交付。
 *
 * @param {object} options 当前连接参数。
 * @param {string} options.hostname URL 原始主机名，不含 IPv6 方括号。
 * @param {Readonly<{ address: string, family: 4|6 }>} options.pinnedAddress 已通过全部 DNS 结果门禁后选择的地址。
 * @param {number} options.port upstreamTransport 从已验证 URL 冻结的有效 HTTPS 端口。
 * @param {number} options.connectTimeoutMs 当前连接超时上限。
 * @returns {Function} Undici Client connect 端口。
 * @throws {TypeError} 参数不满足固定连接边界时抛出。
 */
export function createPinnedConnector({ hostname, pinnedAddress, port, connectTimeoutMs }) {
  if (
    typeof hostname !== 'string'
    || hostname.length === 0
    || !pinnedAddress
    || typeof pinnedAddress.address !== 'string'
    || ![4, 6].includes(pinnedAddress.family)
    || !Number.isSafeInteger(port)
    || port <= 0
    || !Number.isSafeInteger(connectTimeoutMs)
    || connectTimeoutMs <= 0
  ) {
    throw new TypeError('createPinnedConnector 需要有效主机、固定地址、端口和连接超时');
  }

  // 类型: number；来源: upstreamTransport 已解析端口；作用: 通过共用 HTTPS 规则复核后固定在当前 connector 闭包。
  const pinnedPort = normalizePinnedPort(port);

  // 类型: string|undefined；来源: 原 hostname；作用: 域名保留 TLS SNI 和证书验证，IP 字面量不发送无效 SNI。
  const servername = isIP(hostname) === 0 ? hostname : undefined;
  // 类型: Function；来源: Undici buildConnector；作用: 只负责把已复核 raw socket 升级为 TLS，不再执行 DNS lookup。
  const connectTls = buildConnector({
    maxCachedSessions: 0,
    keepAlive: false,
    timeout: connectTimeoutMs,
    servername
  });

  /**
   * 建立并复核当前跳 TCP/TLS 连接。
   * 调用方: Undici Client。
   * 副作用: 创建 raw TCP 与 TLS 套接字；成功时所有权转交 Client，失败时关闭当前 socket。
   * 失败路径: TCP、主机、地址或 TLS 失败原样回调，不能继续发送 HTTP 请求。
   *
   * @param {object} connectorOptions Undici 为当前 origin 生成的连接参数。
   * @param {Function} callback Undici connector 完成回调。
   * @returns {void} 套接字或错误只通过 callback 交付。
   */
  return function connectPinnedTarget(connectorOptions, callback) {
    createPinnedTcpConnection({
      hostname,
      actualHostname: connectorOptions.hostname ?? connectorOptions.host,
      address: pinnedAddress.address,
      family: pinnedAddress.family,
      port: pinnedPort,
      actualProtocol: connectorOptions.protocol,
      actualPort: connectorOptions.port,
      connectTimeoutMs
    }, (tcpError, tcpSocket) => {
      if (tcpError) {
        callback(tcpError, null);
        return;
      }

      // 异步调用: Undici 只接收已经连接并通过地址复核的 socket，TLS 仍使用原主机 SNI 与证书校验。
      connectTls({ ...connectorOptions, servername, httpSocket: tcpSocket }, (tlsError, tlsSocket) => {
        if (tlsError) {
          // 资源清理: TLS 升级失败时 buildConnector 不再拥有可用 socket，显式关闭 raw 连接。
          tcpSocket.destroy();
        }
        callback(tlsError, tlsSocket);
      });
    });
  };
}
