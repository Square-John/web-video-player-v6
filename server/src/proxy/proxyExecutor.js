/*
  proxyExecutor.js 模块说明

  - 文件职责:
      把准入、总超时、逐跳 URL/DNS/IP 校验、固定 TLS 连接、手动重定向和流式响应编码编排为单次无状态事务。
      供 Fastify 路由消费已经通过协议校验的请求；本文件不保存 Cookie/会话、不识别 Provider 业务，也不代理媒体流。

  - 导入库及文件汇总(10 条，内置 1 条，第三方 0 条，自定义 9 条):
      node:perf_hooks#performance: 使用单调时钟计算最小日志耗时。
      ../contracts/proxyProtocol.js#PROXY_PROTOCOL_VERSION: 回填成功响应冻结协议版本。
      ../errors/proxyError.js#ProxyError: 表达重定向上限、中止、超时和内部失败。
      ../network/proxyBodyEncoder.js#encodeProxyRequestBody: 把规范请求体转换为上游字节。
      ../network/proxyHeaders.js: 裁剪每跳请求头、响应头并读取唯一 Location。
      ../network/proxyResponseEncoder.js#encodeProxyResponseBody: 流式限制并把最终原始响应字节包装为 base64。
      ../network/upstreamTransport.js#createUpstreamTransport: 创建固定 IP 的单跳 Undici 传输端口。
      ../security/targetResolver.js#createTargetResolver: 每跳无缓存解析并校验全部 DNS 结果。
      ../security/targetUrlPolicy.js#resolveRedirectTargetUrl: 对每个 Location 重做完整 HTTPS URL 校验。
      ./requestAdmissionGate.js: 提供运行准入；标准请求审计事务由组合根显式注入。

  - 模块级常量:
      REDIRECT_STATUS_CODES: ReadonlySet<number>，代理手动处理的 HTTP 重定向状态。
      POST_TO_GET_REDIRECT_STATUS_CODES: ReadonlySet<number>，按通用 HTTP 语义把 POST 改为 GET 的状态。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeExecutionError(error, externalSignal, timeoutSignal): 把未知失败映射为冻结代理错误。
      runAuditObservation(callback): 隔离请求审计观察异常，保护代理结果。
      deriveRedirectMethod(statusCode, currentMethod): 计算下一跳 GET/POST 方法。
      createResponseEnvelope(options): 组装深层冻结 ProxyResponseEnvelope。
      createProxyExecutor(options): 创建应用级无状态代理执行端口。

  - 模块级类:
      无

  - 对外导出:
      createProxyExecutor: function，createProxyApp 为当前应用创建真实安全转发执行器。
*/

// 导入来源: node:perf_hooks；导入内容: performance；文件作用: 以单调时间计算事务耗时，不参与超时控制。
import { performance } from 'node:perf_hooks';
// 导入来源: ../contracts/proxyProtocol.js；导入内容: PROXY_PROTOCOL_VERSION；文件作用: 成功外壳回填冻结协议版本。
import { PROXY_PROTOCOL_VERSION } from '../contracts/proxyProtocol.js';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 统一执行层错误分类和失败关闭。
import { ProxyError } from '../errors/proxyError.js';
// 导入来源: ../network/proxyBodyEncoder.js；导入内容: encodeProxyRequestBody；文件作用: 创建可供初始或保留 body 重定向复用的请求字节。
import { encodeProxyRequestBody } from '../network/proxyBodyEncoder.js';
// 导入来源: ../network/proxyHeaders.js；导入内容: getSingleResponseHeader、sanitizeRequestHeaders、sanitizeResponseHeaders；文件作用: 管理每跳请求头、响应头和唯一 Location。
import {
  getSingleResponseHeader,
  sanitizeRequestHeaders,
  sanitizeResponseHeaders
} from '../network/proxyHeaders.js';
// 导入来源: ../network/proxyResponseEncoder.js；导入内容: encodeProxyResponseBody；文件作用: 对最终响应执行流式容量门禁和原始字节包装。
import { encodeProxyResponseBody } from '../network/proxyResponseEncoder.js';
// 导入来源: ../network/upstreamTransport.js；导入内容: createUpstreamTransport；文件作用: 创建每跳独立且固定 IP 的 Undici 传输端口。
import { createUpstreamTransport } from '../network/upstreamTransport.js';
// 导入来源: ../security/targetResolver.js；导入内容: createTargetResolver；文件作用: 初始目标和每次重定向重新解析全部 DNS 结果。
import { createTargetResolver } from '../security/targetResolver.js';
// 导入来源: ../security/targetUrlPolicy.js；导入内容: resolveRedirectTargetUrl；文件作用: 解析相对 Location 并执行完整 HTTPS URL 规则。
import { resolveRedirectTargetUrl } from '../security/targetUrlPolicy.js';
// 导入来源: ./requestAdmissionGate.js；导入内容: createRequestAdmissionGate；文件作用: 提供应用级并发和速率无等待准入。
import { createRequestAdmissionGate } from './requestAdmissionGate.js';

// 类型: ReadonlySet<number>；来源: HTTP 重定向语义；作用: 只有这些状态且存在唯一 Location 时进入下一跳安全复查。
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

// 类型: ReadonlySet<number>；来源: 通用客户端重定向行为；作用: POST 在 301/302/303 后改为无 body GET，307/308 保留原方法和 body。
const POST_TO_GET_REDIRECT_STATUS_CODES = new Set([301, 302, 303]);

/**
 * 把执行链未知异常转换为冻结代理领域错误。
 * 调用方: executeProxyRequest 最外层 catch。
 * 副作用: 未知异常只作为 cause 保存在服务端 Error，不进入响应或日志。
 * 失败路径: 已知 ProxyError 原样保留；外部中止优先于超时；其他未知异常失败关闭为内部错误。
 *
 * @param {unknown} error 当前执行链异常。
 * @param {AbortSignal} externalSignal Fastify 客户端生命周期 signal。
 * @param {AbortSignal|undefined} timeoutSignal 当前事务总超时 signal。
 * @returns {ProxyError} 可交给 HTTP 错误外壳的固定领域错误。
 */
function normalizeExecutionError(error, externalSignal, timeoutSignal) {
  if (error instanceof ProxyError) {
    return error;
  }

  if (externalSignal.aborted) {
    return new ProxyError('PROXY_REQUEST_ABORTED', { cause: error });
  }

  if (timeoutSignal?.aborted) {
    return new ProxyError('PROXY_UPSTREAM_TIMEOUT', { cause: error });
  }

  return new ProxyError('PROXY_INTERNAL_ERROR', { cause: error });
}

/**
 * 执行一次请求审计观察并隔离异常。
 * 调用方: ProxyExecutor 的逐跳登记、连接回调、响应登记、容量登记和完成路径。
 * 副作用: 调用 callback；异常被吸收，不能改变代理运输结果或错误分类。
 * 失败路径: callback 抛错时返回 false，调用方继续真实网络流程且不建立第二日志输出。
 *
 * @param {Function} callback 当前请求审计方法调用。
 * @returns {boolean} true 表示观察完成，false 表示审计失败已隔离。
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
 * 根据当前方法和重定向状态计算下一跳方法。
 * 调用方: executeProxyRequest 的重定向分支。
 * 副作用: 无；纯枚举判断。
 * 失败路径: 无；请求校验已限定当前方法为 GET/POST。
 *
 * @param {number} statusCode 当前上游重定向状态。
 * @param {string} currentMethod 当前跳 GET 或 POST。
 * @returns {string} 下一跳 GET 或保留的当前方法。
 */
function deriveRedirectMethod(statusCode, currentMethod) {
  return currentMethod === 'POST' && POST_TO_GET_REDIRECT_STATUS_CODES.has(statusCode) ? 'GET' : currentMethod;
}

/**
 * 组装深层冻结的 ProxyResponseEnvelope。
 * 调用方: executeProxyRequest 最终非重定向响应分支。
 * 副作用: 无；创建冻结容器，body 和 headers 已由下层冻结。
 * 失败路径: 无；输入来自受控传输与响应编码器。
 *
 * @param {object} options 成功响应字段。
 * @param {string} options.requestId 原样回填的请求标识。
 * @param {number} options.status 上游 HTTP 状态。
 * @param {string} options.statusText 上游 HTTP 状态文本。
 * @param {string} options.responseUrl 最终已验证 URL。
 * @param {ReadonlyArray<object>} options.headers 有序响应头条目。
 * @param {Readonly<object>} options.body 编码后的协议 body。
 * @param {number} options.redirectCount 已完成跳转数。
 * @param {number} options.receivedBytes 转换前响应字节数。
 * @returns {Readonly<object>} 深层冻结成功响应外壳。
 */
function createResponseEnvelope({ requestId, status, statusText, responseUrl, headers, body, redirectCount, receivedBytes }) {
  return Object.freeze({
    protocolVersion: PROXY_PROTOCOL_VERSION,
    requestId,
    upstream: Object.freeze({
      status,
      statusText,
      responseUrl,
      headers
    }),
    body,
    meta: Object.freeze({ redirectCount, receivedBytes })
  });
}

/**
 * 创建应用级安全无状态代理执行端口。
 * 调用方: createProxyApp。
 * 状态所有权: 只共享准入运行计数和无状态依赖；请求、DNS、连接、重定向和响应都在单次调用结束时释放。
 * 失败路径: policy 或依赖端口缺失时同步抛 TypeError；运行失败统一映射为冻结 ProxyError。
 *
 * @param {object} options 执行器依赖。
 * @param {Readonly<object>} options.policy 当前应用冻结部署策略。
 * @param {Readonly<{ resolveTarget: Function }>} [options.targetResolver] 可选目标解析端口。
 * @param {Readonly<{ requestUpstream: Function }>} [options.upstreamTransport] 可选单跳传输端口。
 * @param {Readonly<{ enter: Function }>} [options.admissionGate] 可选应用级准入门禁。
 * @param {Readonly<{ beginRequest: Function }>} options.auditLogger 标准请求审计事务工厂。
 * @param {Function} [options.now=performance.now] 单调耗时端口。
 * @returns {Function} Fastify 路由可调用的 executeProxyRequest。
 * @throws {TypeError} 依赖形状不满足边界时抛出。
 */
export function createProxyExecutor({
  policy,
  targetResolver = createTargetResolver(),
  upstreamTransport = createUpstreamTransport(),
  admissionGate,
  auditLogger,
  now = performance.now.bind(performance)
}) {
  if (!policy?.limits) {
    throw new TypeError('createProxyExecutor 需要有效 policy');
  }

  // 类型: Readonly<object>；来源: 注入门禁或集中部署限制；生命周期: 当前应用；作用: 只保存运行控制计数。
  const gate = admissionGate ?? createRequestAdmissionGate({
    maximumConcurrentRequests: policy.limits.concurrentRequests,
    maximumRequestsPerMinute: policy.limits.rateLimitRequestsPerMinute
  });

  if (
    typeof targetResolver?.resolveTarget !== 'function'
    || typeof upstreamTransport?.requestUpstream !== 'function'
    || typeof gate?.enter !== 'function'
    || typeof auditLogger?.beginRequest !== 'function'
    || typeof now !== 'function'
  ) {
    throw new TypeError('createProxyExecutor 依赖端口形状无效');
  }

  /**
   * 执行一个已经通过 ProxyRequestEnvelope 校验的代理事务。
   * 调用方: POST /api/proxy/v2/request 路由。
   * 副作用: 准入后执行 DNS 和逐跳 HTTPS；每跳 release Client，最外层 finally 释放并发额度并记录摘要。
   * 成功路径: 上游任意 2xx—5xx 最终响应以 base64 原始字节形成 ProxyResponseEnvelope。
   * 失败路径: 安全、网络、超时、容量和客户端中止转换为固定 ProxyError；不返回部分 body。
   *
   * @param {Readonly<{ request: object, effectiveLimits: object }>} validatedRequest 网络前校验输出。
   * @param {Readonly<{ signal: AbortSignal, clientNetwork: object }>} context 当前 Fastify 请求生命周期和客户端来源上下文。
   * @returns {Promise<Readonly<object>>} 成功 ProxyResponseEnvelope。
   * @throws {ProxyError} 代理自身失败时抛出。
   */
  return async function executeProxyRequest(validatedRequest, context) {
    // 类型: object；来源: 请求校验器隔离输出；作用: 当前事务唯一协议输入。
    const request = validatedRequest.request;
    // 类型: number；来源: 单调 now；作用: 只计算脱敏日志耗时。
    const startedAt = now();
    // 类型: Function|undefined；生命周期: 当前事务；作用: 仅在成功准入后由 finally 释放并发额度。
    let releaseAdmission;
    // 类型: AbortSignal|undefined；生命周期: 当前事务；作用: catch 区分总超时和其他未知异常。
    let timeoutSignal;
    // 类型: object|undefined；生命周期: 当前事务；作用: 在请求字节建立后记录逐跳网络事实和唯一完成事件。
    let auditTransaction;
    // 类型: number；生命周期: 当前事务；作用: 失败路径也保留已经实际跟随的重定向数量。
    let redirectCount = 0;

    try {
      if (!context?.signal
        || typeof context.signal.aborted !== 'boolean'
        || !context.clientNetwork) {
        throw new ProxyError('PROXY_INTERNAL_ERROR');
      }

      // 类型: object；来源: 已校验协议 body；作用: 307/308 可复用同一隔离 Buffer，同时作为日志真实 body 摘要输入。
      const encodedRequestBody = encodeProxyRequestBody(request.body);
      // 类型: object；来源: 审计适配器；作用: 当前请求全部允许日志字段只通过该有限事务汇总。
      runAuditObservation(() => {
        auditTransaction = auditLogger.beginRequest({
          validatedRequest,
          clientNetwork: context.clientNetwork,
          encodedBody: encodedRequestBody
        });
      });

      if (context.signal.aborted) {
        throw new ProxyError('PROXY_REQUEST_ABORTED');
      }

      releaseAdmission = gate.enter();
      // 类型: AbortSignal；来源: 有效客户端 timeoutMs；作用: 覆盖 DNS、全部重定向、连接、头和 body 的总事务时间。
      timeoutSignal = AbortSignal.timeout(validatedRequest.effectiveLimits.timeoutMs);
      // 类型: AbortSignal；来源: 客户端中止和总超时；作用: 任一先发生都立即通知当前 DNS/Undici/流读取链。
      const transactionSignal = AbortSignal.any([context.signal, timeoutSignal]);
      // 类型: string；来源: 初始规范 URL；作用: 每跳判断是否跨 origin，跨域时剥离凭证。
      const initialOrigin = new URL(request.target.url).origin;
      // 类型: string；生命周期: 当前逐跳事务；作用: 每次重定向更新后重新执行 URL 与 DNS/IP 校验。
      let currentUrl = request.target.url;
      // 类型: string；生命周期: 当前逐跳事务；作用: 301/302/303 可从 POST 变 GET，307/308 保留。
      let currentMethod = request.target.method;
      // 类型: Buffer|undefined；生命周期: 当前逐跳事务；作用: 跟随 method 语义决定是否发送原请求体。
      let currentBody = encodedRequestBody.body;
      // 循环终止: 返回最终非重定向响应，或任一安全/网络/超时/容量错误中止；不会自动无限跟随。
      while (true) {
        transactionSignal.throwIfAborted();
        // 审计事实: 当前跳域名在 DNS 前登记；后续失败不会从错误文案猜测目标。
        runAuditObservation(() => auditTransaction?.startHop(currentUrl));
        // 异步调用: 每一跳重新解析全部 DNS 地址，不沿用上一跳结果或缓存。
        const resolvedTarget = await targetResolver.resolveTarget(currentUrl, transactionSignal);
        // 类型: URL；来源: 当前规范跳；作用: 计算跨 origin 凭证删除，不决定业务路由。
        const currentUrlObject = new URL(currentUrl);
        // 类型: ReadonlyArray<object>；来源: 统一头策略；作用: 删除控制头和跨 origin 凭证，同时保留允许头顺序与重复项。
        const requestHeaders = sanitizeRequestHeaders(request.headers, {
          crossOrigin: currentUrlObject.origin !== initialOrigin,
          hasBody: currentBody !== undefined
        });
        // 异步调用: 单跳传输不自动跟随重定向，返回资源必须在 finally 释放。
        const upstreamResponse = await upstreamTransport.requestUpstream({
          resolvedTarget,
          method: currentMethod,
          headers: requestHeaders,
          body: currentBody,
          signal: transactionSignal,
          timeoutMs: validatedRequest.effectiveLimits.timeoutMs,
          // 连接观察: 只有固定连接器复核 remoteAddress 后才会调用，DNS 候选不能直接进入日志。
          onConnected: (actualIp) => runAuditObservation(() => auditTransaction?.recordConnection(actualIp))
        });

        try {
          // 审计事实: 只有已经取得 HTTP 状态的跳才进入 hops，连接或 TLS 失败不会伪造响应跳。
          runAuditObservation(() => auditTransaction?.recordResponse(upstreamResponse.statusCode));
          // 类型: ReadonlyArray<object>；来源: Undici raw 头；作用: 删除逐跳字段并保持重复头原顺序。
          const responseHeaders = sanitizeResponseHeaders(upstreamResponse.rawHeaders, policy.limits);
          // 类型: string|null；来源: 有序响应头；作用: 只有单一 Location 才允许进入下一跳。
          const location = REDIRECT_STATUS_CODES.has(upstreamResponse.statusCode)
            ? getSingleResponseHeader(responseHeaders, 'location')
            : null;

          if (location !== null) {
            if (redirectCount >= policy.limits.redirectCount) {
              throw new ProxyError('PROXY_TARGET_FORBIDDEN', { details: { field: 'target.url', reason: 'redirect_limit_exceeded' } });
            }

            // 安全边界: 每个 Location 先经过共享 URL 规则；下一轮再独立执行 DNS、全部 IP 和固定连接检查。
            currentUrl = resolveRedirectTargetUrl(location, currentUrl, policy.limits);
            currentMethod = deriveRedirectMethod(upstreamResponse.statusCode, currentMethod);
            // 状态变化: POST 改为 GET 时必须同步丢弃 body；307/308 保留同一已校验字节。
            currentBody = currentMethod === 'GET' ? undefined : encodedRequestBody.body;
            redirectCount += 1;
            continue;
          }

          // 异步调用: 最终 4xx/5xx 与 2xx 一样进入成功外壳；只有代理自身失败才抛错误。
          const encodedResponse = await encodeProxyResponseBody({
            body: upstreamResponse.body,
            headers: responseHeaders,
            maximumBytes: validatedRequest.effectiveLimits.maxResponseBytes,
            signal: transactionSignal
          });
          // 审计事实: 只有完整响应编码成功后登记 receivedBytes，容量或流中止保持 null。
          runAuditObservation(() => auditTransaction?.recordReceivedBytes(encodedResponse.receivedBytes));
          // 类型: Readonly<object>；来源: 受控上游与原始字节编码结果；作用: 返回公共协议 2.0.0 成功外壳。
          const responseEnvelope = createResponseEnvelope({
            requestId: request.requestId,
            status: upstreamResponse.statusCode,
            statusText: typeof upstreamResponse.statusText === 'string' ? upstreamResponse.statusText : '',
            responseUrl: currentUrl,
            headers: responseHeaders,
            body: encodedResponse.body,
            redirectCount,
            receivedBytes: encodedResponse.receivedBytes
          });

          runAuditObservation(() => auditTransaction?.completeSuccess({ durationMs: now() - startedAt, redirectCount }));
          return responseEnvelope;
        } finally {
          // 资源清理: 最终响应、重定向和错误都关闭当前 body 与独占 Client，下一跳不会复用连接状态。
          await upstreamResponse.release();
        }
      }
    } catch (error) {
      // 类型: ProxyError；来源: 固定错误或中止/超时/未知异常归一；作用: HTTP 边界唯一接收的执行失败类型。
      const proxyError = normalizeExecutionError(error, context?.signal ?? AbortSignal.abort(), timeoutSignal);
      runAuditObservation(() => auditTransaction?.completeFailure({
          durationMs: now() - startedAt,
          redirectCount,
          errorCode: proxyError.code
        }));
      throw proxyError;
    } finally {
      // 状态清理: 只有成功 gate.enter 后才释放；幂等 release 防止异常路径重复修改活跃计数。
      releaseAdmission?.();
    }
  };
}
