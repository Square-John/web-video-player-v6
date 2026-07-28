/*
  proxyPolicy.js 模块说明

  - 文件职责:
      集中定义代理协议的编译期安全上限，并把部署环境变量解析为只能收紧这些上限的运行策略。
      供 Fastify 应用、请求校验和后续安全转发器读取；调用点不得自行声明容量、超时或并发魔法值。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      HARD_LIMITS: Readonly<object>，代码审查固定的代理安全上限。
      DEFAULT_SERVER_BINDING: Readonly<object>，没有环境覆盖时的本地监听配置。
      DEFAULT_ALLOWED_ORIGINS: ReadonlyArray<string>，本地前端默认允许源。
      ENVIRONMENT_LIMIT_KEYS: Readonly<object>，策略字段到环境变量名的唯一映射。

  - 模块级变量:
      无

  - 模块级辅助函数:
      readPositiveInteger(value, name): 把环境文本解析为正整数，非法时抛出 RangeError。
      readTightenedLimit(environment, policyKey): 读取部署上限并拒绝超过编译期上限的配置。
      readServerPort(environment): 读取合法 TCP 端口，非法时阻止服务启动。
      normalizeAllowedOrigin(value, fieldName): 校验单个无路径 HTTP(S) origin。
      readAllowedOrigins(environment): 读取、校验并冻结部署允许源列表。
      createProxyPolicy(environment): 生成深层冻结的部署策略快照。

  - 模块级类:
      无

  - 对外导出:
      HARD_LIMITS: Readonly<object>，工程闸门和策略测试使用。
      createProxyPolicy: function，测试和部署启动按指定环境创建策略。
      proxyPolicy: Readonly<object>，当前进程启动时生成的唯一默认策略。
*/

// 类型: Readonly<object>；来源: 公共协议第 8 节的部署安全边界；作用: 环境变量只能降低这些值，不能扩大开放代理能力。
export const HARD_LIMITS = Object.freeze({
  // 单位: 字符；作用: 限制请求和响应关联标识，避免日志与内存被超长标识占用。
  requestIdCharacters: 128,
  // 单位: 字符；作用: sourceId 仅用于审计关联，不允许承载任意大业务数据。
  sourceIdCharacters: 128,
  // 单位: 字符；作用: 限制解析前 URL 文本大小，后续仍需执行 DNS 与 IP 安全检查。
  targetUrlCharacters: 4096,
  // 单位: 条；作用: 限制候选请求头数量，转发前还会删除代理控制头。
  requestHeaderCount: 64,
  // 单位: 字符；作用: 限制单个标准 HTTP 头名称长度。
  requestHeaderNameCharacters: 128,
  // 单位: UTF-8 字节；作用: 限制单个请求头值的传输容量。
  requestHeaderValueBytes: 8192,
  // 单位: 字节；作用: 约束包含协议字段和 base64 膨胀的完整客户端 JSON 外壳，不与解码后上游 body 上限混用。
  httpRequestBytes: 2097152,
  // 单位: 字节；作用: 约束解码后实际发送给上游的 POST body。
  requestBodyBytes: 1048576,
  // 单位: 条；作用: 限制回填到 ProxyResponseEnvelope 的上游响应头数量。
  responseHeaderCount: 128,
  // 单位: 字符；作用: 限制单个上游响应头名称，防止异常服务器放大 JSON 外壳。
  responseHeaderNameCharacters: 128,
  // 单位: Latin-1 字节；作用: 限制单个上游响应头值的传输容量。
  responseHeaderValueBytes: 16384,
  // 单位: 毫秒；作用: 客户端声明更大 timeoutMs 时仍只能采用该部署上限。
  upstreamTimeoutMs: 30000,
  // 单位: 字节；作用: 客户端声明更大 maxResponseBytes 时仍只能采用该部署上限。
  responseBytes: 5242880,
  // 单位: 次；作用: 限制转发事务逐跳处理重定向的最大次数，客户端不能覆盖。
  redirectCount: 5,
  // 单位: 个；作用: 限制当前进程同时占用的上游连接事务。
  concurrentRequests: 32,
  // 单位: 次/分钟；作用: 无等待准入门禁限制当前进程每个固定自然分钟内接受的代理事务。
  rateLimitRequestsPerMinute: 120
});

// 类型: Readonly<object>；来源: 本地安全启动约定；作用: 默认只监听回环地址，公开部署必须显式配置监听主机。
const DEFAULT_SERVER_BINDING = Object.freeze({
  host: '127.0.0.1',
  port: 3000
});

// 类型: ReadonlyArray<string>；来源: 本地 Vite 双栈固定端口；作用: 只允许 IPv4、IPv6 和 localhost 三个等价本地 origin，不使用通配符。
const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  'http://127.0.0.1:5173',
  'http://[::1]:5173',
  'http://localhost:5173'
]);

// 类型: Readonly<object>；来源: 后端部署配置约定；作用: 集中维护可收紧策略字段，避免环境变量名称散落在业务模块。
const ENVIRONMENT_LIMIT_KEYS = Object.freeze({
  requestIdCharacters: 'PROXY_MAX_REQUEST_ID_CHARACTERS',
  sourceIdCharacters: 'PROXY_MAX_SOURCE_ID_CHARACTERS',
  targetUrlCharacters: 'PROXY_MAX_TARGET_URL_CHARACTERS',
  requestHeaderCount: 'PROXY_MAX_REQUEST_HEADER_COUNT',
  requestHeaderNameCharacters: 'PROXY_MAX_REQUEST_HEADER_NAME_CHARACTERS',
  requestHeaderValueBytes: 'PROXY_MAX_REQUEST_HEADER_VALUE_BYTES',
  httpRequestBytes: 'PROXY_MAX_HTTP_REQUEST_BYTES',
  requestBodyBytes: 'PROXY_MAX_REQUEST_BODY_BYTES',
  responseHeaderCount: 'PROXY_MAX_RESPONSE_HEADER_COUNT',
  responseHeaderNameCharacters: 'PROXY_MAX_RESPONSE_HEADER_NAME_CHARACTERS',
  responseHeaderValueBytes: 'PROXY_MAX_RESPONSE_HEADER_VALUE_BYTES',
  upstreamTimeoutMs: 'PROXY_MAX_UPSTREAM_TIMEOUT_MS',
  responseBytes: 'PROXY_MAX_RESPONSE_BYTES',
  redirectCount: 'PROXY_MAX_REDIRECT_COUNT',
  concurrentRequests: 'PROXY_MAX_CONCURRENT_REQUESTS',
  rateLimitRequestsPerMinute: 'PROXY_MAX_REQUESTS_PER_MINUTE'
});

/**
 * 把部署环境文本解析为严格正整数。
 * 调用方: readTightenedLimit 和 readServerPort。
 * 副作用: 无；纯值转换。
 * 失败路径: 空值、小数、零、负数、超出安全整数或混合字符输入抛出 RangeError。
 *
 * @param {unknown} value 环境变量提供的原始值。
 * @param {string} name 用于启动错误定位的环境变量名称，不进入代理响应。
 * @returns {number} 通过正整数校验的数值。
 * @throws {RangeError} 输入不是安全正整数时抛出。
 */
function readPositiveInteger(value, name) {
  // 类型: string；来源: 环境变量值；作用: 保留精确十进制格式检查，拒绝 parseInt 的部分解析行为。
  const text = String(value);

  // 配置边界: 只接受不带符号的十进制正整数，避免隐式单位、小数或科学计数法改变安全上限。
  if (!/^[1-9]\d*$/u.test(text)) {
    throw new RangeError(`${name} 必须是十进制正整数`);
  }

  // 类型: number；来源: 已通过格式检查的十进制文本；作用: 执行安全整数和范围判断。
  const parsed = Number(text);

  if (!Number.isSafeInteger(parsed)) {
    throw new RangeError(`${name} 超出 JavaScript 安全整数范围`);
  }

  return parsed;
}

/**
 * 读取一个部署限制，并保证它不会超过代码冻结的安全上限。
 * 调用方: createProxyPolicy。
 * 副作用: 无；只读取调用方传入的环境对象。
 * 失败路径: 环境值非法或试图扩大硬上限时抛出 RangeError，服务不会带着放宽策略启动。
 *
 * @param {Record<string, string|undefined>} environment 当前部署环境变量对象。
 * @param {keyof HARD_LIMITS} policyKey 需要创建的策略字段。
 * @returns {number} 缺省时使用硬上限，否则返回不大于硬上限的部署值。
 * @throws {RangeError} 部署值非法或大于硬上限时抛出。
 */
function readTightenedLimit(environment, policyKey) {
  // 类型: string；来源: ENVIRONMENT_LIMIT_KEYS；作用: 定位当前策略字段唯一允许的环境覆盖入口。
  const environmentKey = ENVIRONMENT_LIMIT_KEYS[policyKey];
  // 类型: string|undefined；来源: 部署环境；作用: undefined 表示沿用代码审查过的硬上限。
  const configuredValue = environment[environmentKey];

  if (configuredValue === undefined) {
    return HARD_LIMITS[policyKey];
  }

  // 类型: number；来源: 严格环境值解析；作用: 与硬上限比较后进入最终策略。
  const parsedValue = readPositiveInteger(configuredValue, environmentKey);

  // 安全边界: 部署可以收紧但不能通过环境变量提高代码冻结的开放代理能力。
  if (parsedValue > HARD_LIMITS[policyKey]) {
    throw new RangeError(`${environmentKey} 不能超过编译期上限 ${HARD_LIMITS[policyKey]}`);
  }

  return parsedValue;
}

/**
 * 读取服务监听端口。
 * 调用方: createProxyPolicy。
 * 副作用: 无；只读取调用方传入的环境对象。
 * 失败路径: 非法正整数或超过 TCP 端口范围时抛出 RangeError。
 *
 * @param {Record<string, string|undefined>} environment 当前部署环境变量对象。
 * @returns {number} 合法监听端口。
 * @throws {RangeError} PROXY_PORT 不在 1 至 65535 范围时抛出。
 */
function readServerPort(environment) {
  // 类型: string|number；来源: PROXY_PORT 或本地默认值；作用: 统一进入严格端口解析。
  const configuredPort = environment.PROXY_PORT ?? DEFAULT_SERVER_BINDING.port;
  // 类型: number；来源: readPositiveInteger；作用: 执行 TCP 端口最大值判断。
  const port = readPositiveInteger(configuredPort, 'PROXY_PORT');
  // 单位: 端口号；来源: TCP/UDP 标准范围；作用: 阻止无效监听配置进入 Fastify。
  const maximumTcpPort = 65535;

  if (port > maximumTcpPort) {
    throw new RangeError(`PROXY_PORT 不能超过 ${maximumTcpPort}`);
  }

  return port;
}

/**
 * 校验并规范化一个浏览器 CORS 允许源。
 * 纯函数: 只解析 origin 文本，不读取环境、不修改输入或启动服务。
 * 成功路径: 返回无路径、无凭据、无查询和片段的 HTTP(S) origin。
 * 失败路径: 空值、非法 URL、其他协议或附加 URL 部分抛 RangeError。
 *
 * @param {unknown} value 单个允许源候选。
 * @param {string} fieldName 部署错误定位字段。
 * @returns {string} 规范化 origin。
 * @throws {RangeError} 候选不符合明确浏览器来源边界时抛出。
 */
function normalizeAllowedOrigin(value, fieldName) {
  // 条件分支: 候选不是非空字符串时进入。
  // 执行内容: 抛 RangeError，不把空项解释为允许所有来源。
  if (typeof value !== 'string' || !value.trim()) {
    throw new RangeError(`${fieldName} 必须是非空 HTTP(S) origin`);
  }

  // 类型: URL|undefined；作用: 保存标准 URL 解析结果，供 origin 精确边界校验。
  let parsedUrl;
  try {
    parsedUrl = new URL(value.trim());
  } catch (error) {
    throw new RangeError(`${fieldName} 不是有效 URL`, { cause: error });
  }

  // 条件分支: 候选不是纯 HTTP(S) origin，或携带凭据、路径、查询和片段时进入。
  // 执行内容: 抛 RangeError，CORS 配置不能按路径放行或包含敏感信息。
  if (!['http:', 'https:'].includes(parsedUrl.protocol)
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.pathname !== '/'
    || parsedUrl.search
    || parsedUrl.hash) {
    throw new RangeError(`${fieldName} 必须是无路径、无凭据的 HTTP(S) origin`);
  }

  return parsedUrl.origin;
}

/**
 * 读取部署允许的浏览器前端来源。
 * 纯函数: 只读取传入 environment 并返回新冻结数组，不修改默认值或环境对象。
 * 成功路径: 未配置时使用三个本地前端 origin，配置时采用逗号分隔的唯一明确 origin。
 * 失败路径: 空列表、空成员、重复 origin 或任一非法成员抛 RangeError，服务不会宽松启动。
 *
 * @param {Record<string, string|undefined>} environment 当前部署配置来源。
 * @returns {ReadonlyArray<string>} 精确允许源列表。
 * @throws {RangeError} 允许源列表结构或成员非法时抛出。
 */
function readAllowedOrigins(environment) {
  // 类型: Array<string>；作用: 未配置时复制本地默认值，配置时保留每个逗号成员供严格空项检查。
  const candidates = environment.PROXY_ALLOWED_ORIGINS === undefined
    ? [...DEFAULT_ALLOWED_ORIGINS]
    : environment.PROXY_ALLOWED_ORIGINS.split(',');

  // 条件分支: 配置没有任何成员时进入。
  // 执行内容: 抛 RangeError，不把空列表回退为通配或默认值。
  if (candidates.length === 0) {
    throw new RangeError('PROXY_ALLOWED_ORIGINS 至少需要一个 origin');
  }

  // 类型: Array<string>；作用: 保存逐项标准化后的精确 origin，后续检查重复并冻结。
  const allowedOrigins = candidates.map((candidate, index) => (
    normalizeAllowedOrigin(candidate, `PROXY_ALLOWED_ORIGINS[${index}]`)
  ));

  // 条件分支: 标准化后存在重复 origin 时进入。
  // 执行内容: 抛 RangeError，避免部署人员误认为重复项表达不同权限。
  if (new Set(allowedOrigins).size !== allowedOrigins.length) {
    throw new RangeError('PROXY_ALLOWED_ORIGINS 不能包含重复 origin');
  }

  return Object.freeze(allowedOrigins);
}

/**
 * 根据部署环境创建不可变代理策略快照。
 * 调用方: 模块默认导出初始化、启动检查和策略测试。
 * 副作用: 无；返回新冻结对象，不修改 environment。
 * 失败路径: 任一环境配置非法时立即抛错，阻止服务以不明确或放宽的策略启动。
 *
 * @param {Record<string, string|undefined>} [environment=process.env] 当前部署配置来源。
 * @returns {Readonly<object>} 包含 server 和 limits 两个冻结分区的运行策略。
 * @throws {RangeError} 端口或任一限制值不满足安全配置规则时抛出。
 */
export function createProxyPolicy(environment = process.env) {
  // 类型: object；来源: 默认绑定、明确允许源与显式部署环境；作用: 决定监听位置和浏览器前端准入，不进入上游代理业务协议。
  const server = Object.freeze({
    host: environment.PROXY_HOST ?? DEFAULT_SERVER_BINDING.host,
    port: readServerPort(environment),
    allowedOrigins: readAllowedOrigins(environment)
  });
  // 类型: object；来源: 硬上限与可选收紧环境变量；作用: 为校验和转发提供单一容量策略。
  const limits = Object.freeze(Object.fromEntries(
    // 循环: 每个冻结策略字段通过同一收紧规则派生，禁止单项绕过硬上限。
    Object.keys(HARD_LIMITS).map((policyKey) => [policyKey, readTightenedLimit(environment, policyKey)])
  ));

  return Object.freeze({ server, limits });
}

// 类型: Readonly<object>；来源: 当前进程 process.env；生命周期: 模块首次加载时创建并保持不变；作用: 默认服务和校验器共享同一策略快照。
export const proxyPolicy = createProxyPolicy();
