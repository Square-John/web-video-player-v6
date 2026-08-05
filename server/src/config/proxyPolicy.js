/*
  proxyPolicy.js 模块说明

  - 文件职责:
      保存代理协议的编译期安全硬上限，并把根 backend.config.js 的严格投影转换为唯一运行策略。
      供 Fastify 应用、请求校验、执行器和发布检查共享；本模块不读取环境变量或维护部署默认值。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      backendConfigCandidate: 自定义配置，后端监听、CORS 和可收紧限制的唯一部署候选。
      ApplicationConfigError: 自定义错误，用于报告未知限制和扩大硬上限的稳定配置路径。
      validateBackendConfig: 自定义校验器，在策略映射前验证完整 BackendConfig 结构。

  - 模块级常量:
      HARD_LIMITS: Readonly<object>，代码审查冻结的代理安全上限。
      HARD_LIMIT_KEYS: ReadonlyArray<string>，允许出现在 BackendConfig.limits 的精确字段集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createLimitConfigError(policyKey, message): 创建带限制字段路径的稳定配置错误。
      createEffectiveLimits(configuredLimits): 合并可选收紧值与全部编译期硬上限。
      createProxyPolicy(candidate): 校验完整 BackendConfig 并生成深层冻结运行策略。

  - 模块级类:
      无

  - 对外导出:
      HARD_LIMITS: Readonly<object>，工程闸门、配置样板和策略测试使用的代码硬上限。
      createProxyPolicy: function，把显式 BackendConfig 候选转换为唯一 ProxyPolicy。
      proxyPolicy: Readonly<object>，从根 backend.config.js 创建的当前进程策略快照。
*/

// 导入来源: ../../../config/backend.config.js；导入内容: backendConfigCandidate 根后端配置候选；文件作用: 作为生产策略唯一默认输入，不从环境变量或源码绑定常量回退。
import backendConfigCandidate from '../../../config/backend.config.js';

// 导入来源: ../../../scripts/startup/configContracts.mjs；导入内容: ApplicationConfigError、validateBackendConfig；文件作用: 统一配置错误身份并在策略映射前验证完整 BackendConfig。
import {
  // 导入来源: ../../../scripts/startup/configContracts.mjs。
  // 导入内容: ApplicationConfigError 稳定配置错误。
  // 文件作用: 让策略层的限制键和硬上限错误保持与三配置契约相同身份。
  ApplicationConfigError,

  // 导入来源: ../../../scripts/startup/configContracts.mjs。
  // 导入内容: validateBackendConfig 后端完整配置校验器。
  // 文件作用: 在策略映射前拒绝版本、字段、监听、CORS 和限制值结构错误。
  validateBackendConfig
} from '../../../scripts/startup/configContracts.mjs';

// 类型: Readonly<object>；来源: 公共协议的部署安全边界；作用: 配置只能降低这些值，不能扩大开放代理能力。
export const HARD_LIMITS = Object.freeze({
  // 单位: 字符；作用: 限制请求和响应关联标识，避免日志与内存被超长标识占用。
  requestIdCharacters: 128,
  // 单位: 字符；作用: sourceId 仅用于审计关联，不允许承载任意大业务数据。
  sourceIdCharacters: 128,
  // 单位: 字符；作用: 限制解析前 URL 文本大小，DNS 与 IP 安全检查继续由安全层执行。
  targetUrlCharacters: 4096,
  // 单位: 条；作用: 限制候选请求头数量，代理控制头仍由网络边界删除。
  requestHeaderCount: 64,
  // 单位: 字符；作用: 限制单个标准 HTTP 头名称长度。
  requestHeaderNameCharacters: 128,
  // 单位: UTF-8 字节；作用: 限制单个请求头值的传输容量。
  requestHeaderValueBytes: 8192,
  // 单位: 字节；作用: 限制包含协议字段和 base64 膨胀的完整客户端 JSON 外壳。
  httpRequestBytes: 2097152,
  // 单位: 字节；作用: 限制解码后实际发送给上游的 POST body。
  requestBodyBytes: 1048576,
  // 单位: 条；作用: 限制回填到 ProxyResponseEnvelope 的上游响应头数量。
  responseHeaderCount: 128,
  // 单位: 字符；作用: 限制单个上游响应头名称，防止异常服务器放大 JSON 外壳。
  responseHeaderNameCharacters: 128,
  // 单位: Latin-1 字节；作用: 限制单个上游响应头值的传输容量。
  responseHeaderValueBytes: 16384,
  // 单位: 毫秒；作用: 客户端声明更大 timeoutMs 时仍只能采用该后端上限。
  upstreamTimeoutMs: 30000,
  // 单位: 字节；作用: 客户端声明更大 maxResponseBytes 时仍只能采用该后端上限。
  responseBytes: 5242880,
  // 单位: 次；作用: 限制后端逐跳处理重定向的最大跳数。
  redirectCount: 5,
  // 单位: 个；作用: 限制当前进程同时占用的上游连接事务。
  concurrentRequests: 32,
  // 单位: 次/分钟；作用: 限制当前进程每个固定自然分钟接受的代理事务。
  rateLimitRequestsPerMinute: 120
});

// 类型: ReadonlyArray<string>；来源: HARD_LIMITS 自有字段；作用: 精确限制 BackendConfig.limits 可声明的键。
const HARD_LIMIT_KEYS = Object.freeze(Object.keys(HARD_LIMITS));

/**
 * 创建一个定位到 BackendConfig.limits 字段的稳定错误。
 * 调用方: createEffectiveLimits。
 * 纯函数: 相同字段与原因生成等价新错误，不读取或修改外部状态。
 * 失败路径: 本函数不失败；ApplicationConfigError 构造结果由调用方立即抛出。
 *
 * @param {string} policyKey 当前限制字段名称。
 * @param {string} message 不包含配置候选敏感值的失败原因。
 * @returns {ApplicationConfigError} 可阻止构建或监听的配置错误。
 */
function createLimitConfigError(policyKey, message) {
  return new ApplicationConfigError(`backendConfig.limits.${policyKey}`, message);
}

/**
 * 把可选部署收紧值映射为包含全部字段的有效限制。
 * 调用方: createProxyPolicy。
 * 纯函数: 返回新冻结对象，不修改配置投影或 HARD_LIMITS。
 * 成功路径: 省略字段采用代码硬上限，显式字段采用不大于硬上限的正整数。
 * 失败路径: 未知字段或扩大硬上限时抛 ApplicationConfigError，服务不会部分采用配置。
 *
 * @param {Readonly<Record<string, number>>} configuredLimits 已通过结构校验的可选收紧限制。
 * @returns {Readonly<Record<string, number>>} 包含全部 HARD_LIMITS 字段的冻结有效限制。
 * @throws {ApplicationConfigError} 限制键未知或配置值超过代码硬上限时抛出。
 */
function createEffectiveLimits(configuredLimits) {
  // 循环类型: Object.keys。
  // 循环作用: 在合并前拒绝所有未知键，避免拼写错误静默回退到硬上限。
  for (const policyKey of Object.keys(configuredLimits)) {
    // 条件分支: 当前键不属于代码冻结限制集合时进入。
    // 执行内容: 抛稳定字段错误，阻止后端使用不完整或误拼配置启动。
    if (!Object.hasOwn(HARD_LIMITS, policyKey)) {
      throw createLimitConfigError(policyKey, `未知限制字段；允许字段为 ${HARD_LIMIT_KEYS.join(', ')}`);
    }

    // 条件分支: 显式部署值大于对应硬上限时进入。
    // 执行内容: 拒绝通过运行配置扩大代码审查过的代理能力。
    if (configuredLimits[policyKey] > HARD_LIMITS[policyKey]) {
      throw createLimitConfigError(policyKey, `不能超过代码硬上限 ${HARD_LIMITS[policyKey]}`);
    }
  }

  // 返回值类型: Readonly<Record<string, number>>。
  // 作用: 每个硬上限字段显式存在；配置缺省项使用硬上限，配置项只进行收紧替换。
  return Object.freeze(Object.fromEntries(HARD_LIMIT_KEYS.map((policyKey) => [
    policyKey,
    configuredLimits[policyKey] ?? HARD_LIMITS[policyKey]
  ])));
}

/**
 * 根据完整 BackendConfig 候选创建不可变代理策略快照。
 * 调用方: 模块生产初始化、配置测试、集成测试和发布事实检查。
 * 纯函数: 校验候选并返回新深层冻结对象，不读取环境变量、不修改候选也不启动服务。
 * 成功路径: 返回 server 与完整 effective limits，供 HTTP 应用和监听入口共享。
 * 失败路径: 完整配置、未知限制或扩大硬上限非法时抛 ApplicationConfigError。
 *
 * @param {*} [candidate=backendConfigCandidate] 根配置或测试显式提供的完整 BackendConfig 候选。
 * @returns {Readonly<object>} 包含 server、logging 和 limits 三个冻结分区的运行策略。
 * @throws {ApplicationConfigError} BackendConfig 不满足结构或安全收紧规则时抛出。
 */
export function createProxyPolicy(candidate = backendConfigCandidate) {
  // 类型: Readonly<object>；作用: 先完成完整 BackendConfig 契约校验，后续只处理策略层硬上限规则。
  const backendConfig = validateBackendConfig(candidate);
  // 类型: Readonly<object>；作用: 生成包含全部限制字段的唯一有效安全投影。
  const limits = createEffectiveLimits(backendConfig.limits);
  // 类型: Readonly<object>；作用: 复制监听与 CORS 字段，使运行策略不共享用户配置对象引用。
  const server = Object.freeze({
    // 类型: string；作用: Node/Fastify 监听使用的唯一主机配置。
    host: backendConfig.server.host,
    // 类型: number；作用: Node/Fastify 监听使用的唯一端口配置。
    port: backendConfig.server.port,
    // 类型: ReadonlyArray<string>；作用: Fastify CORS 只采用根配置中经过规范化的精确来源。
    allowedOrigins: Object.freeze([...backendConfig.server.allowedOrigins]),
    // 类型: number；作用: HTTP 来源事实只按根配置确定是否采用最右侧单跳转发地址。
    trustedProxyHops: backendConfig.server.trustedProxyHops
  });

  // 类型: Readonly<object>；作用: 深复制 console 与 file 配置，日志中心不持有用户配置原对象引用。
  const logging = Object.freeze({
    console: Object.freeze({ ...backendConfig.logging.console }),
    file: Object.freeze({ ...backendConfig.logging.file })
  });

  // 返回值类型: Readonly<object>；作用: 给服务端所有运行模块提供同一不可变部署和安全策略快照。
  return Object.freeze({ server, logging, limits });
}

// 类型: Readonly<object>；来源: 根 backend.config.js 的严格校验与硬上限映射；生命周期: 模块首次加载时创建并保持不变。
export const proxyPolicy = createProxyPolicy();
