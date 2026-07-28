/*
  targetResolver.js 模块说明

  - 文件职责:
      为每个初始目标和重定向目标独立解析全部 DNS 地址，并要求每个结果都通过统一公网单播策略。
      供代理执行器逐跳调用；返回值只在当前跳存活，不缓存 DNS，也不负责建立 TLS 连接。

  - 导入库及文件汇总(4 条，内置 2 条，第三方 0 条，自定义 2 条):
      node:dns#lookup: 使用操作系统解析器按原顺序获取目标主机全部地址。
      node:net#isIP: 识别 URL 中的 IPv4 或 IPv6 字面量，避免不必要的域名解析。
      ../errors/proxyError.js#ProxyError: 将 DNS 失败映射为冻结网络错误且不泄漏解析细节。
      ./ipAddressPolicy.js#assertPublicIpAddress: 对字面量和每个 DNS 结果执行同一公网单播门禁。

  - 模块级常量:
      DNS_LOOKUP_OPTIONS: Readonly<object>，要求 lookup 返回全部地址并保留解析器顺序。

  - 模块级变量:
      无

  - 模块级辅助函数:
      lookupAllAddresses(hostname): 把 node:dns callback 接口转换为 Promise。
      stripIpv6Brackets(hostname): 移除 WHATWG URL hostname 的 IPv6 方括号。
      raceWithAbort(operation, signal): 让 DNS 等待响应当前代理事务中止且清理监听器。
      normalizeResolvedAddresses(records): 校验全部 DNS 结果并稳定去重。
      createTargetResolver(options): 创建可注入 DNS 端口的无缓存逐跳解析器。

  - 模块级类:
      无

  - 对外导出:
      createTargetResolver: function，生产执行器和安全测试创建目标解析端口。
*/

// 导入来源: node:dns；导入内容: lookup；文件作用: 获取目标主机当前时刻的全部系统 DNS 结果。
import { lookup } from 'node:dns';
// 导入来源: node:net；导入内容: isIP；文件作用: 识别不需要 DNS 的 URL 地址字面量。
import { isIP } from 'node:net';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 把 DNS 失败转换为冻结代理网络错误。
import { ProxyError } from '../errors/proxyError.js';
// 导入来源: ./ipAddressPolicy.js；导入内容: assertPublicIpAddress；文件作用: 对每个候选执行统一公网单播与元数据检查。
import { assertPublicIpAddress } from './ipAddressPolicy.js';

// 类型: Readonly<object>；来源: Node.js dns.lookup API；作用: all=true 防止只检查一个地址，verbatim=true 保留系统解析顺序供固定连接选择。
const DNS_LOOKUP_OPTIONS = Object.freeze({ all: true, verbatim: true });

/**
 * 使用系统解析器获取一个主机名的全部当前地址。
 * 调用方: createTargetResolver 返回的 resolveTarget。
 * 副作用: 发起一次操作系统 DNS 解析；结果不写入缓存或模块状态。
 * 成功路径: resolve 地址记录数组。
 * 失败路径: 系统 DNS 错误原样 reject，由上层转换为安全代理错误。
 *
 * @param {string} hostname WHATWG URL 规范化后的域名。
 * @returns {Promise<Array<{ address: string, family: number }>>} 当前解析器返回的有序全部地址。
 */
function lookupAllAddresses(hostname) {
  return new Promise((resolve, reject) => {
    // 异步调用: 明确要求全部结果；callback 只结束当前 Promise，不保存解析记录。
    lookup(hostname, DNS_LOOKUP_OPTIONS, (error, records) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(records);
    });
  });
}

/**
 * 移除 URL.hostname 包裹 IPv6 字面量的方括号。
 * 调用方: resolveTarget。
 * 副作用: 无；纯字符串转换。
 * 失败路径: 无；普通域名和 IPv4 原样返回，非法 URL 已由 URL 策略提前拒绝。
 *
 * @param {string} hostname URL.hostname 文本。
 * @returns {string} 可交给 isIP、dns.lookup 和 TLS SNI 判断的主机文本。
 */
function stripIpv6Brackets(hostname) {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

/**
 * 让一个不可直接取消的异步操作及时响应当前代理事务 signal。
 * 调用方: resolveTarget 的 DNS 分支。
 * 副作用: 在等待期间添加一个一次性 abort 监听，并在任一路径结束后移除。
 * 成功路径: 返回 operation 的 fulfilled 值。
 * 失败路径: operation reject 或 signal 中止时 reject；底层 DNS 可能自行结束但结果不会进入后续连接。
 *
 * @template T
 * @param {Promise<T>} operation 当前 DNS Promise。
 * @param {AbortSignal} signal 整个代理事务的组合中止信号。
 * @returns {Promise<T>} 操作结果或中止 reject。
 */
async function raceWithAbort(operation, signal) {
  if (signal.aborted) {
    throw signal.reason;
  }

  // 类型: Function；生命周期: 当前等待；作用: finally 使用同一引用清理 abort 监听。
  let abortListener;
  // 类型: Promise<never>；来源: 当前事务 signal；作用: 客户端中止或超时先发生时停止等待 DNS 结果。
  const abortPromise = new Promise((resolve, reject) => {
    void resolve;
    abortListener = () => reject(signal.reason);
    signal.addEventListener('abort', abortListener, { once: true });
  });

  try {
    return await Promise.race([operation, abortPromise]);
  } finally {
    // 资源清理: DNS 或中止任一先结束都移除监听，避免组合 signal 持有本次闭包。
    signal.removeEventListener('abort', abortListener);
  }
}

/**
 * 校验 DNS 返回的全部记录并稳定去重。
 * 调用方: resolveTarget 的域名分支。
 * 副作用: 无；创建新的冻结地址条目和数组，不修改 DNS 记录。
 * 失败路径: 空结果、非法地址或任一非公网地址均失败关闭；混合公私网结果不会部分放行。
 *
 * @param {unknown} records DNS 端口返回的候选记录。
 * @returns {ReadonlyArray<Readonly<{ address: string, family: 4|6 }>>} 保留首次出现顺序的全部安全地址。
 * @throws {ProxyError} 记录集合不能形成安全连接候选时抛出。
 */
function normalizeResolvedAddresses(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new ProxyError('PROXY_UPSTREAM_NETWORK_ERROR', { details: { field: 'target.url', reason: 'dns_no_addresses' } });
  }

  // 类型: Map<string, Readonly<object>>；生命周期: 当前解析调用；作用: 先校验所有记录，再按首次出现顺序消除重复地址。
  const uniqueAddresses = new Map();

  // 安全边界: 循环不会在遇到首个公网地址后提前返回，任何混入的私网或元数据地址都会拒绝整次目标。
  for (const record of records) {
    const address = assertPublicIpAddress(record?.address);
    if (!uniqueAddresses.has(address.address)) {
      uniqueAddresses.set(address.address, address);
    }
  }

  return Object.freeze([...uniqueAddresses.values()]);
}

/**
 * 创建一个不缓存 DNS 的目标解析端口。
 * 调用方: proxyExecutor 生产依赖和安全测试夹具。
 * 状态所有权: 工厂只持有只读 lookupAll 端口，不保存主机、地址或请求结果。
 * 失败路径: lookupAll 不是函数时同步抛 TypeError；解析失败按固定网络或目标错误 reject。
 *
 * @param {object} [options={}] 解析器依赖。
 * @param {Function} [options.lookupAll=lookupAllAddresses] 返回指定主机全部 DNS 结果的异步端口。
 * @returns {Readonly<{ resolveTarget: Function }>} 每跳独立解析目标的冻结端口。
 * @throws {TypeError} 注入依赖非法时抛出。
 */
export function createTargetResolver({ lookupAll = lookupAllAddresses } = {}) {
  if (typeof lookupAll !== 'function') {
    throw new TypeError('createTargetResolver 需要有效 lookupAll');
  }

  /**
   * 解析一个已经通过 URL 策略的 HTTPS 目标。
   * 调用方: proxyExecutor 每次初始请求和重定向跳。
   * 副作用: 域名目标执行一次无缓存 DNS 查询；字面量只执行内存检查。
   * 成功路径: 返回规范 URL、主机名和全部安全连接地址。
   * 失败路径: 中止原因向上保留；DNS 失败转 PROXY_UPSTREAM_NETWORK_ERROR；地址策略错误原样保留。
   *
   * @param {string} targetUrl 当前跳规范化 HTTPS URL。
   * @param {AbortSignal} signal 当前代理事务组合中止信号。
   * @returns {Promise<Readonly<{ url: string, hostname: string, addresses: ReadonlyArray<object> }>>} 当前跳解析快照。
   * @throws {ProxyError} DNS 或地址安全边界失败时抛出。
   */
  async function resolveTarget(targetUrl, signal) {
    // 类型: URL；来源: 已通过 targetUrlPolicy 的规范 URL；作用: 提取标准 hostname 并保留完整当前跳地址。
    const url = new URL(targetUrl);
    // 类型: string；来源: URL.hostname；作用: IPv6 去括号后供字面量识别、DNS 和 TLS 主机名使用。
    const hostname = stripIpv6Brackets(url.hostname);
    // 类型: number；来源: node:net.isIP；作用: 非零表示目标本身就是 IP，不再交给 DNS 二次解释。
    const literalFamily = isIP(hostname);

    if (literalFamily !== 0) {
      return Object.freeze({ url: url.href, hostname, addresses: Object.freeze([assertPublicIpAddress(hostname)]) });
    }

    try {
      // 异步调用: 每个重定向跳重新执行 lookupAll，不读取或写入任何 DNS 缓存。
      const records = await raceWithAbort(Promise.resolve().then(() => lookupAll(hostname)), signal);
      return Object.freeze({ url: url.href, hostname, addresses: normalizeResolvedAddresses(records) });
    } catch (error) {
      if (signal.aborted || error instanceof ProxyError) {
        throw error;
      }

      // 错误转换: 系统解析错误只保留为服务端 cause，响应不暴露 DNS code、主机或地址。
      throw new ProxyError('PROXY_UPSTREAM_NETWORK_ERROR', {
        details: { field: 'target.url', reason: 'dns_lookup_failed' },
        cause: error
      });
    }
  }

  return Object.freeze({ resolveTarget });
}
