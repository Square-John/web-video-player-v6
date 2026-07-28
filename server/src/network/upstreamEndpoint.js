/*
  upstreamEndpoint.js 模块说明

  - 文件职责:
      统一解释已验证 URL 和 Undici connector 的 HTTPS 有效端口。
      供上游传输冻结目标端口，并供固定连接器复核第三方连接参数没有改变目标端点。
      本文件只处理协议与端口值，不解析 DNS、不创建套接字，也不修改公共代理协议。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      HTTPS_PROTOCOL: string，当前上游唯一允许的 HTTPS 协议文本。
      DEFAULT_HTTPS_PORT: number，URL 省略端口时采用的标准 HTTPS 端口。
      MAXIMUM_TCP_PORT: number，TCP 端口允许的最大值。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      resolveHttpsEndpointPort: function，把 HTTPS 协议和规范端口文本转换为有效整数端口。
*/

// 类型: string；来源: 后端代理只允许 HTTPS 的冻结安全边界；作用: 拒绝连接层自行解释其他协议默认端口。
const HTTPS_PROTOCOL = 'https:';

// 类型: number；来源: HTTPS 标准默认端口；作用: URL.port 和 Undici port 为空字符串时生成明确连接端口。
const DEFAULT_HTTPS_PORT = 443;

// 类型: number；来源: TCP 端口标准范围；作用: 阻止超范围整数进入 net.connect。
const MAXIMUM_TCP_PORT = 65535;

/**
 * 解析 HTTPS 端点的有效 TCP 端口。
 * 调用方: upstreamTransport 从已验证 URL 冻结目标端口；pinnedConnector 从 Undici 参数复核实际连接端点。
 * 副作用: 无；纯值校验和转换，不修改输入或访问网络。
 * 成功路径: 空端口返回 443，合法十进制端口返回对应整数。
 * 失败路径: 输入对象、协议、端口类型、十进制格式或范围无效时抛 TypeError/RangeError。
 *
 * @param {object} endpoint HTTPS 端点候选。
 * @param {string} endpoint.protocol 必须精确为 https: 的协议文本。
 * @param {string} endpoint.port URL 或 Undici 提供的规范端口文本；空字符串表示标准 HTTPS 端口。
 * @returns {number} 1 至 65535 的有效 TCP 端口。
 * @throws {TypeError|RangeError} 输入不能唯一确定安全 HTTPS 端口时抛出。
 */
export function resolveHttpsEndpointPort(endpoint) {
  // 类型边界: 只接受非数组对象，避免把缺失字段或位置参数静默解释为默认 HTTPS 端点。
  if (!endpoint || typeof endpoint !== 'object' || Array.isArray(endpoint)) {
    throw new TypeError('resolveHttpsEndpointPort 需要 HTTPS 端点对象');
  }

  // 协议边界: 上游代理只支持 HTTPS，其他协议不能借用 443 或自定义端口进入连接层。
  if (endpoint.protocol !== HTTPS_PROTOCOL) {
    throw new TypeError('上游端点协议必须是 https:');
  }

  // 类型边界: 只有明确空字符串代表 URL 省略端口，undefined/null 不能被当作默认值。
  if (typeof endpoint.port !== 'string') {
    throw new TypeError('上游端点端口必须是字符串');
  }

  // 标准语义: URL 和 Undici 都用空字符串表达默认 HTTPS 端口，在此唯一转换为 443。
  if (endpoint.port === '') {
    return DEFAULT_HTTPS_PORT;
  }

  // 格式边界: 只接受不带符号和单位的十进制正整数，拒绝 Number 的空值、指数和部分解析行为。
  if (!/^[1-9]\d*$/u.test(endpoint.port)) {
    throw new RangeError('上游端点端口必须是十进制正整数');
  }

  // 类型: number；来源: 已通过十进制格式检查的端口文本；作用: 执行安全整数和 TCP 上限判断。
  const port = Number(endpoint.port);

  // 范围边界: 超出 JavaScript 安全整数或 TCP 端口范围时在创建套接字前失败关闭。
  if (!Number.isSafeInteger(port) || port > MAXIMUM_TCP_PORT) {
    throw new RangeError(`上游端点端口不能超过 ${MAXIMUM_TCP_PORT}`);
  }

  return port;
}
