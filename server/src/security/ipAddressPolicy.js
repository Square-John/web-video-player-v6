/*
  ipAddressPolicy.js 模块说明

  - 文件职责:
      归一化 DNS 或连接套接字提供的 IPv4、IPv6 与 IPv4 映射 IPv6，并只允许公网单播目标。
      供目标解析器和固定连接器共享同一 IP 判定；本文件不解析域名、不创建连接，也不回显被拒绝地址。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 1 条，自定义 1 条):
      ipaddr.js#ipaddr: 严格解析 IP、识别地址族、映射地址和特殊地址范围。
      ../errors/proxyError.js#ProxyError: 使用冻结目标禁止错误表达非法或非公网地址。

  - 模块级常量:
      PUBLIC_UNICAST_RANGE: string，ipaddr.js 对可访问公网单播地址的唯一允许分类。
      CLOUD_METADATA_ADDRESSES: ReadonlySet<string>，不完全落入通用私网分类的云平台元数据端点。

  - 模块级变量:
      无

  - 模块级辅助函数:
      failAddressPolicy(reason): 抛出不含原始地址的固定目标禁止错误。
      tryParseNormalizedAddress(value): 尝试解析并把 IPv4 映射 IPv6 转换为 IPv4。
      parseNormalizedAddress(value): 为目标安全边界执行严格解析。
      normalizeIpAddress(value): 返回可用于连接复核的规范地址文本。
      normalizePublicIpAddress(value): 为日志返回公网单播文本或 null。
      assertPublicIpAddress(value): 校验公网单播和云元数据边界并返回冻结地址描述。

  - 模块级类:
      无

  - 对外导出:
      normalizeIpAddress: function，固定连接器比较已验证地址和真实远端地址。
      normalizePublicIpAddress: function，HTTP 日志来源投影使用的公网地址或 null。
      assertPublicIpAddress: function，目标解析器校验每个 DNS 结果并生成连接候选。
*/

// 导入来源: ipaddr.js；导入内容: ipaddr 默认命名空间；文件作用: 解析、归一化并分类 IPv4 与 IPv6。
import ipaddr from 'ipaddr.js';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 将 IP 安全失败映射为冻结协议错误。
import { ProxyError } from '../errors/proxyError.js';

// 类型: string；来源: ipaddr.js range() 分类；作用: 所有特殊、私有、保留或组播分类默认拒绝，只显式允许公网单播。
const PUBLIC_UNICAST_RANGE = 'unicast';

// 类型: ReadonlySet<string>；来源: 主流云平台固定元数据服务地址；作用: 补充拦截落在公网分类中的元数据控制端点。
const CLOUD_METADATA_ADDRESSES = new Set([
  '100.100.100.200',
  '168.63.129.16'
]);

/**
 * 抛出不包含原始 IP 或解析细节的目标安全错误。
 * 调用方: parseNormalizedAddress 和 assertPublicIpAddress。
 * 副作用: 终止当前目标解析或连接复核；不写日志、不修改状态。
 * 失败路径: 始终抛出 PROXY_TARGET_FORBIDDEN，details 只携带稳定规则原因。
 *
 * @param {string} reason 不包含地址原值的稳定失败分类。
 * @returns {never} 本函数不会正常返回。
 * @throws {ProxyError} 固定目标禁止错误。
 */
function failAddressPolicy(reason) {
  throw new ProxyError('PROXY_TARGET_FORBIDDEN', { details: { field: 'target.url', reason } });
}

/**
 * 尝试解析并归一化一个 IP 地址对象。
 * 调用方: parseNormalizedAddress 和 normalizePublicIpAddress。
 * 副作用: 无；只创建 ipaddr.js 地址对象。
 * 失败路径: 非字符串、空值、带作用域标识或非法地址返回 null，不记录原始候选。
 *
 * @param {unknown} value DNS 结果或 socket.remoteAddress 候选值。
 * @returns {import('ipaddr.js').IPv4|import('ipaddr.js').IPv6|null} IPv4 映射地址已转换为 IPv4 的解析对象，失败为 null。
 */
function tryParseNormalizedAddress(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('%')) {
    return null;
  }

  // 类型: IPv4|IPv6；来源: DNS 或已建立套接字；作用: 统一进入 ipaddr.js 的特殊范围分类。
  let parsedAddress;

  try {
    parsedAddress = ipaddr.parse(value);
  } catch {
    return null;
  }

  // 安全边界: IPv4 映射 IPv6 必须按内嵌 IPv4 分类，不能借 ::ffff: 前缀绕过私网或元数据检查。
  if (parsedAddress.kind() === 'ipv6' && parsedAddress.isIPv4MappedAddress()) {
    return parsedAddress.toIPv4Address();
  }

  return parsedAddress;
}

/**
 * 为目标连接边界严格解析规范 IP。
 * 调用方: normalizeIpAddress 和 assertPublicIpAddress。
 * 副作用: 无；复用无异常解析器。
 * 失败路径: 地址非法时抛不含原始值的 PROXY_TARGET_FORBIDDEN。
 *
 * @param {unknown} value DNS 结果或 socket.remoteAddress 候选值。
 * @returns {import('ipaddr.js').IPv4|import('ipaddr.js').IPv6} 规范地址对象。
 * @throws {ProxyError} 输入不能作为无作用域 IP 地址处理时抛出。
 */
function parseNormalizedAddress(value) {
  const parsedAddress = tryParseNormalizedAddress(value);
  if (parsedAddress === null) failAddressPolicy('invalid_ip_address');
  return parsedAddress;
}

/**
 * 把 IP 转换为跨 DNS 和套接字来源可比较的规范文本。
 * 调用方: pinnedConnector 的连接后远端地址复核。
 * 副作用: 无；不执行公网范围判断，调用方必须先或同时使用 assertPublicIpAddress。
 * 失败路径: 输入不是合法无作用域 IP 时抛 PROXY_TARGET_FORBIDDEN。
 *
 * @param {unknown} value 待规范化地址。
 * @returns {string} IPv4 点分十进制或 IPv6 压缩规范文本。
 * @throws {ProxyError} 地址非法时抛出。
 */
export function normalizeIpAddress(value) {
  return parseNormalizedAddress(value).toString();
}

/**
 * 把候选地址投影为可记录的公网单播文本。
 * 调用方: HTTP 边界解析 direct 或受信 X-Forwarded-For 来源。
 * 副作用: 无；不抛目标协议错误，也不返回拒绝原因或内部地址。
 * 失败路径: 非法、非公网、云元数据或特殊地址统一返回 null。
 *
 * @param {unknown} value socket 或受信转发链中的地址候选。
 * @returns {string|null} 规范公网 IPv4/IPv6 文本，无法确认时为 null。
 */
export function normalizePublicIpAddress(value) {
  const parsedAddress = tryParseNormalizedAddress(value);
  if (parsedAddress === null) return null;
  const normalizedAddress = parsedAddress.toString();
  if (parsedAddress.range() !== PUBLIC_UNICAST_RANGE || CLOUD_METADATA_ADDRESSES.has(normalizedAddress)) {
    return null;
  }
  return normalizedAddress;
}

/**
 * 确认地址是允许连接的公网单播，并生成不可变连接候选。
 * 调用方: targetResolver 对 IP 字面量和每个 DNS 结果逐项调用。
 * 副作用: 无；不选择地址、不缓存 DNS 结果。
 * 失败路径: 非公网分类、云元数据端点或非法地址抛 PROXY_TARGET_FORBIDDEN。
 *
 * @param {unknown} value DNS 或 URL 提供的地址文本。
 * @returns {Readonly<{ address: string, family: 4|6 }>} 规范地址和 Node.js 连接地址族。
 * @throws {ProxyError} 地址不满足公网单播安全边界时抛出。
 */
export function assertPublicIpAddress(value) {
  // 类型: IPv4|IPv6；来源: 严格地址解析；作用: 分类前已经消除 IPv4 映射 IPv6 绕过形式。
  const parsedAddress = parseNormalizedAddress(value);
  // 类型: string；来源: ipaddr.js 规范化；作用: 云元数据精确比对和连接目标输出共用同一文本。
  const normalizedAddress = parsedAddress.toString();

  // 安全边界: 除 unicast 外的 loopback、private、linkLocal、multicast、reserved、CGNAT 等分类全部失败关闭。
  if (parsedAddress.range() !== PUBLIC_UNICAST_RANGE || CLOUD_METADATA_ADDRESSES.has(normalizedAddress)) {
    failAddressPolicy('non_public_ip_forbidden');
  }

  return Object.freeze({
    address: normalizedAddress,
    family: parsedAddress.kind() === 'ipv4' ? 4 : 6
  });
}
