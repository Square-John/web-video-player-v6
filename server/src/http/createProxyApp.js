/*
  createProxyApp.js 模块说明

  - 文件职责:
      创建后端 Fastify 应用，注册独立健康入口和唯一代理业务入口，并统一处理 HTTP 输入、双向连接生命周期中止和 ProxyErrorEnvelope 输出。
      路由只协调协议校验与注入的执行端口；DNS、SSRF、重定向和上游响应处理不得写入本文件。

  - 导入库及文件汇总(11 条，内置 0 条，第三方 2 条，自定义 9 条):
      fastify#Fastify、LogController: 创建 HTTP 应用，并使用正式日志控制器关闭框架逐请求日志。
      @fastify/cors#cors: 按部署允许源处理浏览器预检和响应头。
      ../../../scripts/startup/configContracts.mjs#APPLICATION_CLIENT_IP_MODE: 选择 direct 或受信转发公网来源。
      ../config/proxyPolicy.js#proxyPolicy: 提供请求体上限和默认部署策略。
      ../contracts/proxyProtocol.js#PROXY_REQUEST_ROUTE: 注册协议冻结的唯一业务路径。
      ../contracts/backendHealth.js#BACKEND_HEALTH_*：注册独立基础设施健康路径和固定响应。
      ../errors/proxyError.js#ProxyError: 将 HTTP 媒体类型、查询参数和框架解析失败转换为领域错误。
      ../errors/proxyError.js#createProxyErrorEnvelope: 生成统一错误状态与安全响应外壳。
      ../proxy/proxyExecutor.js#createProxyExecutor: 按当前 policy 创建生产安全无状态转发执行端口。
      ../security/ipAddressPolicy.js#normalizePublicIpAddress: 只投影可记录的公网 socket 或受信转发候选。
      ../validation/proxyRequestValidator.js#validateProxyRequestEnvelope: 在调用任何执行端口前完成精确协议校验。

  - 模块级常量:
      JSON_MEDIA_TYPE: string，代理入口要求的请求和响应媒体类型。
      FRAMEWORK_VALIDATION_ERROR_CODES: ReadonlyArray<string>，可安全归类为输入校验失败的 Fastify 错误码。
      REQUEST_LOG_CONTROLLER_OPTIONS: Readonly<object>，为每个应用创建日志控制器的冻结选项。
      CORS_ALLOWED_METHODS / CORS_ALLOWED_HEADERS: ReadonlyArray<string>，浏览器代理入口最小跨域能力。
      REQUEST_EXECUTION_STARTED: symbol，请求是否已经交给 Executor 的请求内标记。

  - 模块级变量:
      无

  - 模块级辅助函数:
      extractRequestId(body, maximumCharacters): 从原始请求体安全提取错误关联标识。
      hasExactJsonMediaType(headerValue): 校验 Content-Type 主媒体类型。
      acceptsJson(headerValue): 校验 Accept 明确包含 application/json。
      normalizeHttpBoundaryError(error): 把已知框架输入错误转换为 ProxyError。
      createCorsOptions(policy): 创建无凭据、明确来源的 CORS 插件配置。
      createBackendHealthRouteHandler(): 创建不调用执行端口的独立健康处理器。
      resolveClientPublicIp(request, clientIpPolicy): 解析可记录公网客户端 IP 或 null。
      runAuditObservation(callback): 隔离日志观察失败。
      createProxyRouteHandler(policy, executeProxyRequest): 创建绑定策略、执行端口和双向断开监听的请求处理器。
      createProxyApp(options): 组装应用、路由和统一失败边界。

  - 模块级类:
      无

  - 对外导出:
      createProxyApp: function，生产启动、启动检查和 HTTP 边界测试创建隔离应用实例。
*/

// 导入来源: fastify；导入内容: Fastify、LogController；文件作用: 创建代理应用并通过正式控制器关闭框架逐请求日志。
import Fastify, { LogController } from 'fastify';
// 导入来源: @fastify/cors；导入内容: cors Fastify 官方跨域插件；文件作用: 处理明确前端来源的 OPTIONS 预检和响应头。
import cors from '@fastify/cors';
// 导入来源: ../../../scripts/startup/configContracts.mjs；导入内容: APPLICATION_CLIENT_IP_MODE；文件作用: HTTP 边界与根配置校验共用来源模式枚举。
import { APPLICATION_CLIENT_IP_MODE } from '../../../scripts/startup/configContracts.mjs';
// 导入来源: ../config/proxyPolicy.js；导入内容: proxyPolicy；文件作用: 提供默认 HTTP 外壳、转发容量和运行限制。
import { proxyPolicy } from '../config/proxyPolicy.js';
// 导入来源: ../contracts/proxyProtocol.js；导入内容: PROXY_REQUEST_ROUTE；文件作用: 注册冻结的代理业务入口。
import { PROXY_REQUEST_ROUTE } from '../contracts/proxyProtocol.js';
// 导入来源: ../contracts/backendHealth.js；导入内容: 健康入口常量；文件作用: 注册独立基础设施健康路由，不与代理协议混用。
import {
  BACKEND_HEALTH_CACHE_CONTROL,
  BACKEND_HEALTH_CONTENT_TYPE,
  BACKEND_HEALTH_RESPONSE,
  BACKEND_HEALTH_ROUTE
} from '../contracts/backendHealth.js';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 表达 HTTP 边界的固定输入错误。
import { ProxyError } from '../errors/proxyError.js';
// 导入来源: ../errors/proxyError.js；导入内容: createProxyErrorEnvelope；文件作用: 统一输出协议错误响应。
import { createProxyErrorEnvelope } from '../errors/proxyError.js';
// 导入来源: ../proxy/proxyExecutor.js；导入内容: createProxyExecutor；文件作用: 未注入测试端口时创建真实安全无状态转发器。
import { createProxyExecutor } from '../proxy/proxyExecutor.js';
// 导入来源: ../security/ipAddressPolicy.js；导入内容: normalizePublicIpAddress；文件作用: 内部、环回和非法候选统一投影为 null。
import { normalizePublicIpAddress } from '../security/ipAddressPolicy.js';
// 导入来源: ../validation/proxyRequestValidator.js；导入内容: validateProxyRequestEnvelope；文件作用: 在执行端口前精确校验请求外壳。
import { validateProxyRequestEnvelope } from '../validation/proxyRequestValidator.js';

// 类型: string；来源: 公共协议第 5.1 节；作用: 固定请求 Content-Type、Accept 和所有 JSON 外壳响应类型。
const JSON_MEDIA_TYPE = 'application/json';

// 类型: ReadonlyArray<string>；来源: Fastify 内容类型解析错误契约；作用: 只把已知客户端输入失败映射为 PROXY_VALIDATION_ERROR。
const FRAMEWORK_VALIDATION_ERROR_CODES = Object.freeze([
  'FST_ERR_CTP_BODY_TOO_LARGE',
  'FST_ERR_CTP_EMPTY_JSON_BODY',
  'FST_ERR_CTP_INVALID_JSON_BODY',
  'FST_ERR_CTP_INVALID_MEDIA_TYPE'
]);

// 类型: Readonly<object>；来源: 后端最小日志策略；作用: true 禁止 Fastify 自动记录完整请求，false 会恢复框架逐请求日志并扩大敏感信息风险。
const REQUEST_LOG_CONTROLLER_OPTIONS = Object.freeze({ disableRequestLogging: true });

// 类型: ReadonlyArray<string>；来源: 后端健康协议和公共代理协议；作用: 预检只允许健康 GET 和代理 POST，不开放其他业务方法。
const CORS_ALLOWED_METHODS = Object.freeze(['GET', 'POST']);

// 类型: ReadonlyArray<string>；来源: ProxyClient 固定 fetch 选项；作用: 预检只允许 JSON 媒体类型声明和响应媒体协商头。
const CORS_ALLOWED_HEADERS = Object.freeze(['Content-Type', 'Accept']);

// 类型: symbol；作用: 只在当前 Fastify request 上标记已经进入 Executor，防止执行失败被重复记录为 rejected。
const REQUEST_EXECUTION_STARTED = Symbol('requestExecutionStarted');

/**
 * 从尚未通过完整校验的请求体中安全提取 requestId。
 * 调用方: Fastify 全局错误处理器和路由错误路径。
 * 副作用: 无；不修改请求体，不进行隐式字符串化。
 * 失败路径: 非普通对象、非字符串、空串或超长标识返回空字符串，避免错误响应放大输入。
 *
 * @param {unknown} body Fastify 当前可见的请求体。
 * @param {number} maximumCharacters 当前部署 requestId 字符上限。
 * @returns {string} 可安全回填的关联标识或空字符串。
 */
function extractRequestId(body, maximumCharacters) {
  if (body === null || typeof body !== 'object' || Array.isArray(body) || Object.getPrototypeOf(body) !== Object.prototype) {
    return '';
  }

  // 类型: unknown；来源: 未校验请求体的自有字段；作用: 只在严格字符串和长度边界内用于错误关联。
  const requestId = Object.hasOwn(body, 'requestId') ? body.requestId : '';
  return typeof requestId === 'string' && requestId.length > 0 && requestId.length <= maximumCharacters ? requestId : '';
}

/**
 * 校验 Content-Type 主媒体类型为 application/json。
 * 调用方: 代理路由处理器。
 * 副作用: 无；纯字符串解析。
 * 失败路径: 缺失、数组或其他媒体类型返回 false，由路由抛出固定校验错误。
 *
 * @param {unknown} headerValue Fastify request.headers 的 content-type 值。
 * @returns {boolean} true 表示主媒体类型精确为 application/json，可带 charset 参数。
 */
function hasExactJsonMediaType(headerValue) {
  if (typeof headerValue !== 'string') {
    return false;
  }

  // 类型: string；来源: Content-Type 分号前部分；作用: 接受标准 charset 参数但拒绝 +json 等隐式兼容类型。
  const mediaType = headerValue.split(';', 1)[0].trim().toLowerCase();
  return mediaType === JSON_MEDIA_TYPE;
}

/**
 * 校验 Accept 明确包含 application/json。
 * 调用方: 代理路由处理器。
 * 副作用: 无；纯字符串拆分。
 * 失败路径: 缺失、数组、通配符或不包含 JSON 的列表返回 false，调用方形成固定校验错误。
 *
 * @param {unknown} headerValue Fastify request.headers 的 accept 值。
 * @returns {boolean} true 表示至少一个媒体范围精确接受 application/json。
 */
function acceptsJson(headerValue) {
  if (typeof headerValue !== 'string') {
    return false;
  }

  // 循环: Accept 列表允许质量参数，但当前协议不把 */* 当作 application/json 的显式声明。
  return headerValue.split(',').some((entry) => entry.split(';', 1)[0].trim().toLowerCase() === JSON_MEDIA_TYPE);
}

/**
 * 把 Fastify 已知客户端输入错误转换为稳定 ProxyError。
 * 调用方: Fastify 全局错误处理器。
 * 副作用: 已知框架异常作为 cause 保留在服务端对象中，但不会进入响应。
 * 失败路径: 未知异常原样返回，createProxyErrorEnvelope 会失败关闭为 PROXY_INTERNAL_ERROR。
 *
 * @param {unknown} error Fastify 路由或解析生命周期抛出的异常。
 * @returns {unknown} ProxyError、原有 ProxyError 或未分类原始异常。
 */
function normalizeHttpBoundaryError(error) {
  if (error instanceof ProxyError) {
    return error;
  }

  // 类型: unknown；来源: Fastify Error.code；作用: 只依赖登记错误码，不解析框架文案。
  const errorCode = error !== null && typeof error === 'object' ? error.code : undefined;

  if (typeof errorCode === 'string' && FRAMEWORK_VALIDATION_ERROR_CODES.includes(errorCode)) {
    return new ProxyError('PROXY_VALIDATION_ERROR', {
      details: { field: 'request', reason: 'invalid_json_http_body' },
      cause: error
    });
  }

  return error;
}

/**
 * 创建后端代理入口的最小 CORS 配置。
 * 纯函数: 只读取冻结 policy 并返回新配置对象，不注册路由或修改允许源。
 * 成功路径: 返回明确 origin、POST、必要请求头、严格预检且无凭据的配置。
 * 失败路径: policy 未提供非空冻结允许源时抛 TypeError，应用不会按通配符启动。
 *
 * @param {Readonly<object>} policy 当前应用部署策略。
 * @returns {Readonly<object>} @fastify/cors 注册选项。
 * @throws {TypeError} 允许源配置不符合后端边界时抛出。
 */
function createCorsOptions(policy) {
  // 类型: unknown；作用: 读取部署策略中已经标准化的浏览器前端来源。
  const allowedOrigins = policy?.server?.allowedOrigins;
  // 条件分支: 允许源不是非空冻结数组时进入。
  // 执行内容: 抛 TypeError，不回退到来源反射或通配符。
  if (!Array.isArray(allowedOrigins)
    || allowedOrigins.length === 0
    || !Object.isFrozen(allowedOrigins)) {
    throw new TypeError('createProxyApp 需要冻结的 CORS allowedOrigins');
  }

  return Object.freeze({
    origin: allowedOrigins,
    methods: CORS_ALLOWED_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    credentials: false,
    strictPreflight: true
  });
}

/**
 * 创建独立后端基础设施健康路由处理器。
 * 调用方: createProxyApp。
 * 副作用: 只向当前 HTTP 客户端返回冻结健康结果和 no-store 缓存头，不创建执行器调用、上游请求或审计事务。
 * 成功路径: 始终返回 HTTP 200 和固定 `{"status":"available"}` JSON 正文。
 * 失败路径: 健康处理器不读取请求正文、query 或业务状态，Fastify 仅负责响应发送失败。
 *
 * @returns {Function} Fastify 健康 GET 路由处理器。
 */
function createBackendHealthRouteHandler() {
  /**
   * 返回当前后端 HTTP 应用已就绪的最小事实。
   * 调用方: Fastify GET /health 路由。
   * 副作用: 设置 JSON Content-Type 和 no-store 响应头，不访问任何 Provider 或代理执行端口。
   * 成功路径: 返回冻结的健康响应对象。
   * 失败路径: reply 发送错误由 Fastify 生命周期处理，不能转入代理审计。
   *
   * @param {object} _request 当前 Fastify 请求；只为保持路由处理器签名，不读取请求内容。
   * @param {object} reply 当前 Fastify 响应对象。
   * @returns {object} Fastify 已发送的健康响应。
   */
  return async function backendHealthRouteHandler(_request, reply) {
    return reply
      .code(200)
      .type(BACKEND_HEALTH_CONTENT_TYPE)
      .header('cache-control', BACKEND_HEALTH_CACHE_CONTROL)
      .send(BACKEND_HEALTH_RESPONSE);
  };
}

/**
 * 解析当前 HTTP 请求可记录的公网客户端地址。
 * 调用方: 代理路由、错误处理器和未找到处理器。
 * 副作用: 无；只读取 socket.remoteAddress 和配置允许的 x-forwarded-for，不写回请求。
 * 成功路径: direct 采用公网 socket；trusted-forwarded-first 采用首个公网转发候选，再尝试公网 socket。
 * 失败路径: 地址非法、内部或无法确认时返回 null，不抛错也不暴露代理节点。
 *
 * @param {object} request 当前 Fastify 请求。
 * @param {Readonly<{mode: string}>} clientIpPolicy 已校验公网来源模式。
 * @returns {string|null} 已确认公网客户端 IP 或 null。
 */
function resolveClientPublicIp(request, clientIpPolicy) {
  const socketPublicIp = normalizePublicIpAddress(request.raw.socket.remoteAddress);
  if (clientIpPolicy.mode === APPLICATION_CLIENT_IP_MODE.direct) return socketPublicIp;
  if (clientIpPolicy.mode !== APPLICATION_CLIENT_IP_MODE.trustedForwardedFirst) {
    throw new TypeError('createProxyApp 收到未知 clientIp.mode');
  }

  const forwardedHeader = request.headers['x-forwarded-for'];
  if (typeof forwardedHeader === 'string') {
    for (const candidate of forwardedHeader.split(',')) {
      const publicIp = normalizePublicIpAddress(candidate.trim());
      if (publicIp !== null) return publicIp;
    }
  }
  return socketPublicIp;
}

/**
 * 执行一次日志观察并隔离失败。
 * 调用方: HTTP 错误和未找到处理器。
 * 副作用: 调用 callback；异常被吸收，不能改变响应状态或错误外壳。
 * 失败路径: callback 抛错时返回 false，不建立第二日志通道。
 *
 * @param {Function} callback 当前审计调用。
 * @returns {boolean} true 表示观察完成，false 表示失败已隔离。
 */
function runAuditObservation(callback) {
  try {
    callback();
    return true;
  } catch {
    return false;
  }
}

/**
 * 创建绑定部署策略和代理执行端口的 Fastify 路由处理器。
 * 调用方: createProxyApp。
 * 副作用: 每次请求创建 AbortController，同时监听请求中止和响应连接提前关闭，在 finally 中移除监听。
 * 成功路径: 协议和 HTTP 边界通过后调用一次 executeProxyRequest，并始终以 HTTP 200 返回 ProxyResponseEnvelope。
 * 失败路径: 媒体类型、query、协议或执行错误向上抛给全局错误处理器。
 *
 * @param {Readonly<object>} policy 当前应用冻结部署策略。
 * @param {Function} executeProxyRequest 注入的无状态代理执行端口。
 * @returns {Function} Fastify 异步路由处理器。
 */
function createProxyRouteHandler(policy, executeProxyRequest) {
  /**
   * 处理唯一代理业务请求。
   * 调用方: Fastify POST /api/proxy/v2/request 路由。
   * 副作用: 创建并清理请求中止与响应关闭监听；只调用注入执行端口一次，不保存跨请求状态。
   * 成功路径: 执行端口返回 ProxyResponseEnvelope 后，以 application/json 和 HTTP 200 发送。
   * 失败路径: 任一边界错误 reject 给 Fastify 全局错误处理器，响应不会泄漏堆栈。
   *
   * @param {object} request Fastify 当前请求对象。
   * @param {object} reply Fastify 当前响应对象。
   * @returns {Promise<object>} Fastify 发送的成功响应外壳。
   */
  return async function proxyRequestRouteHandler(request, reply) {
    if (!hasExactJsonMediaType(request.headers['content-type'])) {
      throw new ProxyError('PROXY_VALIDATION_ERROR', { details: { field: 'content-type', reason: 'application_json_required' } });
    }

    if (!acceptsJson(request.headers.accept)) {
      throw new ProxyError('PROXY_VALIDATION_ERROR', { details: { field: 'accept', reason: 'application_json_required' } });
    }

    // 类型: Array<string>；来源: Fastify query 对象；作用: 固定入口不接受 query 兼容参数或第二套协议输入。
    const queryKeys = request.query && typeof request.query === 'object' ? Object.keys(request.query) : [];

    if (queryKeys.length > 0) {
      throw new ProxyError('PROXY_VALIDATION_ERROR', { details: { field: 'query', reason: 'query_parameters_forbidden' } });
    }

    // 类型: Readonly<object>；来源: 精确协议校验器；作用: 执行端口唯一允许消费的请求和有效限制。
    const validatedRequest = validateProxyRequestEnvelope(request.body, policy);
    // 类型: AbortController；生命周期: 当前 HTTP 请求；作用: 客户端从请求或响应方向断开时通知上游事务立即释放资源。
    const abortController = new AbortController();
    // 回调: 请求体传输未完成就被客户端中止时，只取消当前代理事务。
    const abortCurrentRequest = () => abortController.abort();
    // 回调: 请求体已完成但响应连接提前关闭时取消当前事务；正常 writableEnded 关闭不能误报为客户端中止。
    const abortClosedResponse = () => {
      if (reply.raw.writableEnded !== true) {
        abortController.abort();
      }
    };

    request.raw.once('aborted', abortCurrentRequest);
    reply.raw.once('close', abortClosedResponse);

    try {
      // 异步调用: 执行端口收到隔离请求和当前 signal；部署上限由应用创建执行器时单向注入，不由请求上下文重复提供。
      // 类型: string|null；来源: 当前 socket 与显式来源策略；作用: Executor 只消费可记录公网值，不接触代理链或内部地址。
      const fromIP = resolveClientPublicIp(request, policy.server.clientIp);
      // 请求生命周期: 从此以后所有失败由 Executor 的 request 事务记录，全局错误处理器不得重复记录 rejected。
      request[REQUEST_EXECUTION_STARTED] = true;
      const responseEnvelope = await executeProxyRequest(
        validatedRequest,
        Object.freeze({ signal: abortController.signal, fromIP })
      );
      return reply.code(200).type(JSON_MEDIA_TYPE).send(responseEnvelope);
    } finally {
      // 资源清理: 无论成功或失败都移除双向监听，避免 Fastify 请求和响应对象被闭包延长生命周期。
      request.raw.removeListener('aborted', abortCurrentRequest);
      reply.raw.removeListener('close', abortClosedResponse);
    }
  };
}

/**
 * 创建一个隔离 Fastify 代理应用实例。
 * 调用方: 生产入口、生产启动检查和 HTTP 契约测试。
 * 副作用: 创建应用级执行器/准入计数并注册一个健康 GET、一个代理 POST、错误处理器和 404 处理器；调用 listen 前不占用端口。
 * 失败路径: 策略缺失或执行端口不是函数时抛出 TypeError；应用运行错误统一映射为安全错误外壳。
 *
 * @param {object} [options={}] 应用依赖。
 * @param {Readonly<object>} [options.policy=proxyPolicy] 当前应用使用的冻结部署策略。
 * @param {Function} [options.executeProxyRequest] 可选测试或替代执行端口；缺省时按 policy 创建生产 ProxyExecutor。
 * @param {Readonly<{beginRequest: Function}>} [options.auditLogger] 生产 Executor 使用的统一审计事务工厂。
 * @returns {import('fastify').FastifyInstance} 尚未监听端口的 Fastify 应用。
 * @throws {TypeError} 依赖形状不满足应用边界时抛出。
 */
export function createProxyApp({ policy = proxyPolicy, executeProxyRequest, auditLogger } = {}) {
  if (!policy || !policy.limits || !policy.server?.clientIp) {
    throw new TypeError('createProxyApp 需要有效 policy');
  }

  // 类型: Function；来源: 显式注入或当前 policy 的生产 ProxyExecutor；生命周期: 当前应用；作用: 所有合法请求共用准入门禁但不共享业务状态。
  const proxyExecutor = executeProxyRequest ?? createProxyExecutor({ policy, auditLogger });

  if (typeof proxyExecutor !== 'function') {
    throw new TypeError('createProxyApp 需要有效 executeProxyRequest');
  }

  // 类型: FastifyInstance；来源: fastify 工厂；生命周期: 调用方负责 ready/listen 和 close；作用: 承载无状态代理 HTTP 边界。
  const app = Fastify({
    bodyLimit: policy.limits.httpRequestBytes,
    logger: false,
    // 框架边界: 每个应用拥有独立 LogController，使用 Fastify 5 正式接口关闭默认逐请求日志且不触发弃用路径。
    logController: new LogController(REQUEST_LOG_CONTROLLER_OPTIONS)
  });

  // 副作用: 注册标准 CORS onRequest 钩子和 OPTIONS 预检处理；来源、方法和头只来自冻结部署策略。
  app.register(cors, createCorsOptions(policy));

  // 路由: 健康 GET 先于代理业务注册，保持基础设施检测与 ProxyExecutor 完全隔离。
  app.get(BACKEND_HEALTH_ROUTE, createBackendHealthRouteHandler());
  app.post(PROXY_REQUEST_ROUTE, createProxyRouteHandler(policy, proxyExecutor));

  /**
   * 处理 Fastify 路由、解析和执行错误。
   * 调用方: Fastify 全局错误生命周期。
   * 副作用: 读取请求体关联字段并发送一次 JSON 错误响应，不记录或返回内部堆栈。
   * 失败路径: 已知输入错误映射为校验错误，其他异常由错误外壳失败关闭为内部错误。
   *
   * @param {unknown} error Fastify 生命周期捕获的异常。
   * @param {object} request 当前 Fastify 请求。
   * @param {object} reply 当前 Fastify 响应。
   * @returns {object} 已发送的 Fastify 响应。
   */
  const proxyErrorHandler = (error, request, reply) => {
    // HTTP 失败边界: 所有路由、解析和执行错误统一形成 ProxyErrorEnvelope，不把 Fastify 默认错误或堆栈发给客户端。
    // 类型: string；来源: 未校验 request.body；作用: 仅在安全字符上限内回填错误关联标识。
    const requestId = extractRequestId(request.body, policy.limits.requestIdCharacters);
    // 类型: ProxyError|unknown；来源: HTTP 和执行失败；作用: 日志与错误外壳共用一次稳定归类。
    const normalizedError = normalizeHttpBoundaryError(error);
    if (request.url !== BACKEND_HEALTH_ROUTE && request[REQUEST_EXECUTION_STARTED] !== true) {
      runAuditObservation(() => auditLogger?.rejectRequest({
        requestId: requestId || null,
        errorCode: normalizedError instanceof ProxyError ? normalizedError.code : 'PROXY_INTERNAL_ERROR',
        fromIP: resolveClientPublicIp(request, policy.server.clientIp)
      }));
    }
    // 类型: object；来源: 固定错误映射；作用: 同时决定 HTTP 状态和安全 JSON 外壳。
    const response = createProxyErrorEnvelope(normalizedError, requestId);
    return reply.code(response.statusCode).type(JSON_MEDIA_TYPE).send(response.body);
  };
  app.setErrorHandler(proxyErrorHandler);

  /**
   * 处理所有未注册的 HTTP 路径和方法。
   * 调用方: Fastify 未找到生命周期。
   * 副作用: 发送一次固定 JSON 校验错误，不创建执行端口或访问网络。
   * 失败路径: 始终返回 PROXY_VALIDATION_ERROR，不提供兼容入口或默认页面。
   *
   * @param {object} request 当前 Fastify 请求。
   * @param {object} reply 当前 Fastify 响应。
   * @returns {object} 已发送的 Fastify 响应。
   */
  const proxyNotFoundHandler = (request, reply) => {
    // 未找到边界: 不提供兼容路由、GET 别名或默认页面，所有未知入口都使用固定校验错误响应。
    const requestId = extractRequestId(request.body, policy.limits.requestIdCharacters);
    const notFoundError = new ProxyError('PROXY_VALIDATION_ERROR', { details: { field: 'route', reason: 'route_not_found' } });
    runAuditObservation(() => auditLogger?.rejectRequest({
      requestId: requestId || null,
      errorCode: notFoundError.code,
      fromIP: resolveClientPublicIp(request, policy.server.clientIp)
    }));
    const response = createProxyErrorEnvelope(notFoundError, requestId);
    return reply.code(response.statusCode).type(JSON_MEDIA_TYPE).send(response.body);
  };
  app.setNotFoundHandler(proxyNotFoundHandler);

  return app;
}
