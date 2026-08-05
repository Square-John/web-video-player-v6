/*
  proxyAuditLogger.js 模块说明

  - 文件职责:
      把已校验请求、HTTP 来源事实、实际请求字节和 ProxyExecutor 逐跳事实投影为统一 proxy.request.completed 事件。
      每个 beginRequest 返回一个请求内审计事务；本模块不访问网络、文件或 stdout，也不保存跨请求历史。

  - 导入库及文件汇总(2 条，内置 2 条，第三方 0 条，自定义 0 条):
      node:buffer#Buffer: 核对实际请求体字节并创建零长度摘要输入。
      node:crypto#createHash: 计算身份和实际请求字节的完整 SHA-256。

  - 模块级常量:
      LOG_EVENT_NAME: string，标准代理完成事件名。
      CONTENT_TYPE_PATTERN: RegExp，只允许记录 type/subtype 主媒体类型。
      INTERNAL_ERROR_CODE: string，内部故障日志级别判断值。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createSha256(value): 计算字符串或字节摘要。
      normalizeHostname(url): 从已校验 URL 提取规范主机名。
      extractContentType(headers): 只提取唯一合法主媒体类型。
      createProxyAuditLogger(options): 创建绑定统一日志中心的审计适配器。

  - 模块级类:
      无

  - 对外导出:
      createProxyAuditLogger: function，ProxyExecutor 使用的请求审计事务工厂。
*/

// 导入来源: node:buffer；导入内容: Buffer；文件作用: 核对 Executor 交付实际请求字节并为 none 创建零长度摘要输入。
import { Buffer } from 'node:buffer';
// 导入来源: node:crypto；导入内容: createHash；文件作用: 对原始身份和实际请求字节生成不可逆完整摘要。
import { createHash } from 'node:crypto';

// 类型: string；来源: 阶段二标准日志契约；作用: 所有代理事务完成事件使用同一可检索名称。
const LOG_EVENT_NAME = 'proxy.request.completed';

// 类型: RegExp；作用: contentType 只允许 HTTP token 组成的 type/subtype，不保存参数或任意头值文本。
const CONTENT_TYPE_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;

// 类型: string；来源: Proxy Protocol 稳定错误码；作用: 内部故障使用 error，其他受控失败使用 warn。
const INTERNAL_ERROR_CODE = 'PROXY_INTERNAL_ERROR';

/**
 * 计算字符串或字节的完整 SHA-256。
 * 调用方: beginRequest 固定身份与 body 摘要。
 * 纯函数: 每次创建独立 hash，不保存原始输入或跨请求状态。
 * 失败路径: 输入只来自已校验字符串或 Buffer；意外类型由 createHash.update 抛出并暴露内部契约破坏。
 *
 * @param {string|Buffer} value 待摘要身份或请求字节。
 * @returns {string} 小写十六进制 SHA-256。
 */
function createSha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * 从已校验 URL 提取适合审计的规范主机名。
 * 调用方: beginRequest 和 startHop。
 * 纯函数: 只使用标准 URL API，不执行 DNS 或访问网络。
 * 失败路径: URL 已通过协议校验；意外非法值保留标准 URL 异常以暴露内部错误。
 *
 * @param {string} url 已校验 HTTPS 绝对 URL。
 * @returns {string} 域名、IPv4 或去方括号 IPv6 主机文本。
 */
function normalizeHostname(url) {
  const hostname = new URL(url).hostname;
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

/**
 * 从有序请求头中提取唯一合法主媒体类型。
 * 调用方: beginRequest。
 * 纯函数: 只读取 content-type 条目并返回小写 type/subtype，不记录参数或其他头值。
 * 失败路径: 缺失、重复或主类型非法时返回 null，不猜测或回显原头值。
 *
 * @param {ReadonlyArray<Readonly<{name: string, value: string}>>} headers 已校验有序请求头。
 * @returns {string|null} 唯一规范主媒体类型或 null。
 */
function extractContentType(headers) {
  const values = headers.filter((header) => header.name === 'content-type').map((header) => header.value);
  if (values.length !== 1) return null;
  const mediaType = values[0].split(';', 1)[0].trim().toLowerCase();
  return CONTENT_TYPE_PATTERN.test(mediaType) ? mediaType : null;
}

/**
 * 创建代理审计适配器。
 * 调用方: 后端启动组合根和代理执行器测试。
 * 状态所有权: 工厂只持有统一 logger；每个 beginRequest 独立持有当前跳、hops 和完成状态。
 * 失败路径: logger 形状非法时同步抛 TypeError；请求内方法乱序或字段非法时抛 Error 暴露内部契约破坏。
 *
 * @param {object} options 审计依赖。
 * @param {Readonly<{info: Function, warn: Function, error: Function}>} options.logger 统一日志中心。
 * @returns {Readonly<{beginRequest: Function}>} 冻结请求审计事务工厂。
 * @throws {TypeError} logger 不具备三个所需级别方法时抛出。
 */
export function createProxyAuditLogger({ logger }) {
  if (typeof logger?.info !== 'function' || typeof logger?.warn !== 'function' || typeof logger?.error !== 'function') {
    throw new TypeError('createProxyAuditLogger 需要统一日志中心');
  }

  /**
   * 为一个已校验代理请求创建有限审计事务。
   * 调用方: ProxyExecutor 在实际编码请求体后、准入和网络前调用。
   * 状态所有权: 当前闭包保存固定请求摘要、当前跳事实、已响应 hops 和完成标记。
   * 状态释放: completeSuccess/completeFailure 输出一次事件后标记完成，闭包随代理调用释放。
   * 失败路径: 输入缺失或 encodedBody 不是实际 Buffer/undefined 时抛 TypeError。
   *
   * @param {object} options 当前事务事实。
   * @param {Readonly<{request: object, effectiveLimits: object}>} options.validatedRequest 已校验请求。
   * @param {Readonly<{clientIp: string, clientIpSource: string, proxyPeerIp: string}>} options.clientNetwork HTTP 来源事实。
   * @param {Readonly<{body: Buffer|undefined, hasBody: boolean}>} options.encodedBody 实际请求字节。
   * @returns {Readonly<object>} 当前跳登记、响应登记和完成端口。
   * @throws {TypeError} 请求、来源或字节事实无效时抛出。
   */
  function beginRequest({ validatedRequest, clientNetwork, encodedBody }) {
    const request = validatedRequest?.request;
    const effectiveLimits = validatedRequest?.effectiveLimits;
    if (!request
      || !effectiveLimits
      || typeof clientNetwork?.clientIp !== 'string'
      || typeof clientNetwork?.clientIpSource !== 'string'
      || typeof clientNetwork?.proxyPeerIp !== 'string'
      || !encodedBody
      || (encodedBody.body !== undefined && !Buffer.isBuffer(encodedBody.body))) {
      throw new TypeError('beginRequest 需要已校验请求、客户端来源和实际请求字节');
    }

    // 类型: Buffer；作用: none 请求使用零字节 Buffer 计算稳定空摘要，有正文直接引用执行器隔离 Buffer。
    const requestBytes = encodedBody.body ?? Buffer.alloc(0);
    // 类型: object；作用: 请求固定字段只创建一次，逐跳过程不得修改身份、头或正文摘要。
    const fixedFields = Object.freeze({
      clientIp: clientNetwork.clientIp,
      clientIpSource: clientNetwork.clientIpSource,
      proxyPeerIp: clientNetwork.proxyPeerIp,
      requestIdHash: createSha256(request.requestId),
      sourceIdHash: createSha256(request.sourceId),
      protocolVersion: request.protocolVersion,
      method: request.target.method,
      initialHost: normalizeHostname(request.target.url),
      headerCount: request.headers.length,
      headerNames: Object.freeze(request.headers.map((header) => header.name)),
      contentType: extractContentType(request.headers),
      bodyEncoding: request.body.encoding,
      bodyBytes: requestBytes.byteLength,
      bodyHash: createSha256(requestBytes),
      bodyPreview: null,
      timeoutMs: effectiveLimits.timeoutMs,
      maxResponseBytes: effectiveLimits.maxResponseBytes
    });
    // 类型: Array<object>；生命周期: 当前事务；作用: 只保存已经收到 HTTP 响应的有限跳，数量受代理重定向上限约束。
    const hops = [];
    let finalHost = null;
    let finalIp = null;
    let upstreamStatus = null;
    let receivedBytes = null;
    let redirectCount = 0;
    let completed = false;

    /**
     * 登记即将进入 DNS 的当前跳。
     * 调用方: ProxyExecutor 每轮 while 在 resolveTarget 前。
     * 副作用: 更新 finalHost，并清空上一跳 IP 和状态；已完成 hops 保留。
     * 失败路径: 审计事务已完成时抛 Error。
     *
     * @param {string} url 当前已校验跳 URL。
     * @returns {void} 当前跳状态保存在闭包。
     */
    function startHop(url) {
      if (completed) throw new Error('代理审计事务已经完成');
      finalHost = normalizeHostname(url);
      finalIp = null;
      upstreamStatus = null;
    }

    /**
     * 登记固定连接器已经复核的真实远端 IP。
     * 调用方: upstreamTransport 的连接观察回调。
     * 副作用: 更新当前跳 finalIp，不执行地址解析或 DNS。
     * 失败路径: 未开始当前跳、事务完成或 IP 为空时抛 Error。
     *
     * @param {string} actualIp 固定连接器返回的规范真实地址。
     * @returns {void} 当前跳连接事实保存在闭包。
     */
    function recordConnection(actualIp) {
      if (completed || finalHost === null || typeof actualIp !== 'string' || actualIp.length === 0) {
        throw new Error('真实连接 IP 必须属于活动审计跳');
      }
      finalIp = actualIp;
    }

    /**
     * 登记当前跳收到的上游 HTTP 状态并追加 hops。
     * 调用方: ProxyExecutor 在取得 upstreamResponse 后立即调用。
     * 副作用: 更新 upstreamStatus 并追加一个冻结跳摘要。
     * 失败路径: 未记录真实连接 IP、状态非法或事务完成时抛 Error。
     *
     * @param {number} status 当前跳 HTTP 状态码。
     * @returns {void} 已响应跳追加到有限数组。
     */
    function recordResponse(status) {
      if (completed || finalHost === null || finalIp === null || !Number.isInteger(status)) {
        throw new Error('HTTP 响应必须具有活动域名、真实 IP 和整数状态');
      }
      upstreamStatus = status;
      hops.push(Object.freeze({ index: hops.length + 1, host: finalHost, actualIp: finalIp, status }));
    }

    /**
     * 登记最终响应已经完整接收的真实字节数。
     * 调用方: ProxyExecutor 在 encodeProxyResponseBody 成功后。
     * 副作用: 更新 receivedBytes；失败响应保持 null。
     * 失败路径: 没有最终响应、容量非法或事务完成时抛 Error。
     *
     * @param {number} value 完整响应字节数。
     * @returns {void} 完整容量保存在闭包。
     */
    function recordReceivedBytes(value) {
      if (completed || upstreamStatus === null || !Number.isSafeInteger(value) || value < 0) {
        throw new Error('完整响应字节必须属于已响应活动跳');
      }
      receivedBytes = value;
    }

    /**
     * 生成当前事务完整事件字段并标记完成。
     * 调用方: completeSuccess 和 completeFailure。
     * 副作用: completed 改为 true；返回对象由统一日志中心继续隔离冻结。
     * 失败路径: 重复完成、耗时或跳转数非法时抛 Error。
     *
     * @param {object} result 完成结果。
     * @param {string} result.outcome success 或 failure。
     * @param {number} result.durationMs 单调事务耗时。
     * @param {number} result.completedRedirectCount 已实际跟随重定向数量。
     * @param {string|null} result.errorCode 稳定错误码或 null。
     * @returns {object} 标准代理完成事件字段。
     */
    function complete({ outcome, durationMs, completedRedirectCount, errorCode }) {
      if (completed
        || !['success', 'failure'].includes(outcome)
        || !Number.isFinite(durationMs)
        || durationMs < 0
        || !Number.isSafeInteger(completedRedirectCount)
        || completedRedirectCount < 0) {
        throw new Error('代理审计完成字段无效或事务重复完成');
      }
      completed = true;
      redirectCount = completedRedirectCount;
      return {
        ...fixedFields,
        finalHost,
        finalIp,
        hops,
        outcome,
        durationMs: Math.round(durationMs),
        upstreamStatus,
        receivedBytes,
        redirectCount,
        errorCode
      };
    }

    /**
     * 输出成功代理完成事件。
     * 调用方: ProxyExecutor 成功形成响应外壳后。
     * 副作用: 通过统一 logger.info 输出一次标准事件。
     * 失败路径: 成功但缺少完整响应状态或容量时抛 Error，防止伪造成功日志。
     *
     * @param {object} result 成功结果。
     * @param {number} result.durationMs 单调事务耗时。
     * @param {number} result.redirectCount 已跟随重定向数量。
     * @returns {void} 事件由统一日志中心输出。
     */
    function completeSuccess({ durationMs, redirectCount: completedRedirectCount }) {
      if (upstreamStatus === null || receivedBytes === null) {
        throw new Error('成功审计必须具有最终状态和完整响应容量');
      }
      logger.info(LOG_EVENT_NAME, complete({
        outcome: 'success',
        durationMs,
        completedRedirectCount,
        errorCode: null
      }));
    }

    /**
     * 输出失败代理完成事件。
     * 调用方: ProxyExecutor 完成稳定错误归类后。
     * 副作用: 内部错误调用 logger.error，其他受控失败调用 logger.warn。
     * 失败路径: errorCode 为空时抛 Error，不输出含混失败事件。
     *
     * @param {object} result 失败结果。
     * @param {number} result.durationMs 单调事务耗时。
     * @param {number} result.redirectCount 已跟随重定向数量。
     * @param {string} result.errorCode 稳定代理错误码。
     * @returns {void} 事件由统一日志中心输出。
     */
    function completeFailure({ durationMs, redirectCount: completedRedirectCount, errorCode }) {
      if (typeof errorCode !== 'string' || errorCode.length === 0) {
        throw new Error('失败审计必须具有稳定错误码');
      }
      const fields = complete({ outcome: 'failure', durationMs, completedRedirectCount, errorCode });
      const log = errorCode === INTERNAL_ERROR_CODE ? logger.error : logger.warn;
      log(LOG_EVENT_NAME, fields);
    }

    return Object.freeze({ startHop, recordConnection, recordResponse, recordReceivedBytes, completeSuccess, completeFailure });
  }

  return Object.freeze({ beginRequest });
}
