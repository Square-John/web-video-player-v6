/*
  proxyAuditLogger.js 模块说明

  - 文件职责:
      把已校验请求、确认的公网来源和 ProxyExecutor 真实网络事实投影为统一三分区 request 事件。
      同一适配器还记录未进入 Executor 的 rejected 事件；不访问网络、文件或标准流，也不保存跨请求历史。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      ../logging/logEvent.js: 提供类别、动作和结果枚举。
      ../logging/requestLogSanitizer.js: 创建脱敏请求快照并提取响应内容类型。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      createEmptyRequestProcess(fromIP): 创建拒绝事件的未知上游过程。
      createEmptyResponseProcess(): 创建尚未收到上游响应的过程。
      createProxyAuditLogger(options): 创建绑定统一日志中心的审计适配器。

  - 模块级类:
      无

  - 对外导出:
      createProxyAuditLogger: HTTP 边界和 ProxyExecutor 使用的审计工厂。
*/

// 导入来源: ../logging/logEvent.js；导入内容: LOG_ACTION、LOG_CATEGORY、LOG_RESULT；文件作用: 所有审计事件使用正式枚举。
import { LOG_ACTION, LOG_CATEGORY, LOG_RESULT } from '../logging/logEvent.js';
// 导入来源: ../logging/requestLogSanitizer.js；导入内容: createRequestLogProcess、extractResponseLogContentType；文件作用: 请求参数和响应内容类型只在统一脱敏边界处理。
import {
  createRequestLogProcess,
  extractResponseLogContentType
} from '../logging/requestLogSanitizer.js';

/**
 * 创建未知上游请求的固定空过程。
 * 调用方: rejectRequest。
 * 纯函数: 返回新对象，只保留已经确认的公网来源；不从无效外壳猜测目标或参数。
 * 失败路径: fromIP 由 HTTP 来源策略产生，非法值由统一事件工厂拒绝。
 *
 * @param {string|null} fromIP 已确认公网客户端地址或 null。
 * @returns {object} 字段完整但未知事实为 null 的 requestProcess。
 */
function createEmptyRequestProcess(fromIP) {
  return {
    fromIP,
    destinationDomain: null,
    destinationIP: null,
    method: null,
    url: null,
    parameterSource: null,
    parameters: null,
    contentType: null,
    contentLengthBytes: null
  };
}

/**
 * 创建未收到上游响应的固定过程。
 * 调用方: rejectRequest 和 beginRequest 初始状态。
 * 纯函数: 每次返回独立对象，调用方可以在请求事务内更新。
 * 失败路径: 无。
 *
 * @returns {object} responseReceived=false 且其它字段为 null 的 responseProcess。
 */
function createEmptyResponseProcess() {
  return {
    responseReceived: false,
    status: null,
    contentType: null,
    contentLengthBytes: null
  };
}

/**
 * 创建代理请求审计适配器。
 * 调用方: 后端 index、HTTP 边界和 ProxyExecutor。
 * 状态所有权: 每个 beginRequest 闭包只保存当前请求最终跳和响应事实；适配器不保存跨请求状态。
 * 失败路径: logger 缺少 write 时同步抛 TypeError；运行日志故障由调用方观察边界隔离。
 *
 * @param {object} options 审计依赖。
 * @param {Readonly<{write: Function}>} options.logger 统一日志中心。
 * @returns {Readonly<object>} beginRequest 和 rejectRequest 端口。
 * @throws {TypeError} logger 形状无效时抛出。
 */
export function createProxyAuditLogger({ logger }) {
  if (typeof logger?.write !== 'function') {
    throw new TypeError('createProxyAuditLogger 需要统一日志中心');
  }

  /**
   * 记录一个没有进入 Executor 的 HTTP 拒绝事件。
   * 调用方: Fastify 全局错误和未找到处理器。
   * 副作用: 向统一日志中心写入一次 rejected 事件。
   * 成功路径: 返回已写入冻结事件。
   * 失败路径: errorCode 或来源无效时由日志核心抛出，HTTP 边界负责隔离。
   *
   * @param {object} options 拒绝事实。
   * @param {string|null} options.requestId 安全请求标识或 null。
   * @param {string} options.errorCode 稳定代理错误码。
   * @param {string|null} options.fromIP 已确认公网来源或 null。
   * @returns {Readonly<object>} 已写入 rejected 事件。
   */
  function rejectRequest({ requestId, errorCode, fromIP }) {
    return logger.write({
      category: LOG_CATEGORY.rejected,
      action: LOG_ACTION.requestRejected,
      requestId,
      result: LOG_RESULT.failure,
      durationMs: null,
      failureReason: errorCode,
      requestProcess: createEmptyRequestProcess(fromIP),
      responseProcess: createEmptyResponseProcess()
    });
  }

  /**
   * 为一个已校验代理请求创建审计事务。
   * 调用方: ProxyExecutor 在实际编码请求体后、准入和网络前调用。
   * 状态所有权: 闭包保存脱敏请求快照、当前最终跳、响应概况和完成标记。
   * 状态释放: completeSuccess/completeFailure 输出一次事件后标记完成，闭包随代理调用释放。
   * 失败路径: 输入缺失或请求字节形状无效时由统一清洗器抛 TypeError。
   *
   * @param {object} options 当前事务事实。
   * @param {Readonly<{request: object, effectiveLimits: object}>} options.validatedRequest 已校验请求。
   * @param {string|null} options.fromIP HTTP 边界确认的公网来源或 null。
   * @param {Readonly<{body: Buffer|undefined, hasBody: boolean}>} options.encodedBody 实际请求字节。
   * @returns {Readonly<object>} 当前跳、响应和完成登记端口。
   */
  function beginRequest({ validatedRequest, fromIP, encodedBody }) {
    const request = validatedRequest?.request;
    if (!request) throw new TypeError('beginRequest 需要已校验请求');

    const requestProcess = createRequestLogProcess({ request, fromIP, encodedBody });
    const responseProcess = createEmptyResponseProcess();
    let completed = false;

    /**
     * 登记即将进入 DNS 的当前最终跳。
     * 调用方: ProxyExecutor 每轮重定向解析前。
     * 副作用: 更新目标域名并清空上一跳 IP 和响应事实，已脱敏请求参数保持不变。
     * 失败路径: 事务已完成或 URL 无效时抛 Error/TypeError。
     *
     * @param {string} url 当前已校验跳 URL。
     * @returns {void} 当前最终跳保存在闭包。
     */
    function startHop(url) {
      if (completed) throw new Error('代理审计事务已经完成');
      const targetUrl = new URL(url);
      requestProcess.destinationDomain = targetUrl.hostname;
      requestProcess.destinationIP = null;
      Object.assign(responseProcess, createEmptyResponseProcess());
    }

    /**
     * 登记固定连接器复核的真实远端 IP。
     * 调用方: upstreamTransport 的连接观察回调。
     * 副作用: 更新当前最终跳 destinationIP，不执行地址解析或 DNS。
     * 失败路径: 事务完成或 IP 为空时抛 Error。
     *
     * @param {string} actualIp 固定连接器返回的规范真实地址。
     * @returns {void} 真实去向保存在请求过程。
     */
    function recordConnection(actualIp) {
      if (completed || typeof actualIp !== 'string' || actualIp.length === 0) {
        throw new Error('真实连接 IP 必须属于活动审计跳');
      }
      requestProcess.destinationIP = actualIp;
    }

    /**
     * 登记当前最终跳收到的 HTTP 响应概况。
     * 调用方: ProxyExecutor 裁剪响应头后。
     * 副作用: 设置 responseReceived、状态和规范内容类型，不读取响应正文。
     * 失败路径: 状态或头无效、事务完成时抛 Error/TypeError。
     *
     * @param {number} status 当前上游状态码。
     * @param {ReadonlyArray<object>} headers 已裁剪有序响应头。
     * @returns {void} 响应概况保存在闭包。
     */
    function recordResponse(status, headers) {
      if (completed || !Number.isInteger(status)) throw new Error('响应状态必须属于活动审计事务');
      responseProcess.responseReceived = true;
      responseProcess.status = status;
      responseProcess.contentType = extractResponseLogContentType(headers);
      responseProcess.contentLengthBytes = null;
    }

    /**
     * 登记最终响应已经完整接收的实际字节数。
     * 调用方: ProxyExecutor 在 encodeProxyResponseBody 成功后。
     * 副作用: 更新 responseProcess.contentLengthBytes。
     * 失败路径: 尚未收到响应、容量非法或事务完成时抛 Error。
     *
     * @param {number} value 完整响应字节数。
     * @returns {void} 完整容量保存在闭包。
     */
    function recordReceivedBytes(value) {
      if (completed
        || responseProcess.responseReceived !== true
        || !Number.isSafeInteger(value)
        || value < 0) {
        throw new Error('完整响应字节必须属于已响应活动事务');
      }
      responseProcess.contentLengthBytes = value;
    }

    /**
     * 输出唯一 request 终态事件。
     * 调用方: completeSuccess 和 completeFailure。
     * 副作用: completed=true，并把当前两个过程快照交给统一日志中心。
     * 失败路径: 重复完成、耗时或失败原因非法时抛 Error/TypeError。
     *
     * @param {object} result 完成结果。
     * @param {string} result.result success 或 failure。
     * @param {number} result.durationMs 单调事务耗时。
     * @param {string|null} result.failureReason 稳定错误码或 null。
     * @returns {Readonly<object>} 已写入 request 事件。
     */
    function complete({ result, durationMs, failureReason }) {
      if (completed || !Number.isFinite(durationMs) || durationMs < 0) {
        throw new Error('代理审计完成字段无效或事务重复完成');
      }
      completed = true;
      return logger.write({
        category: LOG_CATEGORY.request,
        action: LOG_ACTION.requestCompleted,
        requestId: request.requestId,
        result,
        durationMs: Math.round(durationMs),
        failureReason,
        requestProcess,
        responseProcess
      });
    }

    /**
     * 输出成功请求事件。
     * 调用方: ProxyExecutor 成功形成响应外壳后。
     * 副作用: 调用 complete 写入一次 success 终态。
     * 失败路径: 没有完整响应状态或容量时抛 Error，防止伪造成功日志。
     *
     * @param {object} result 成功结果。
     * @param {number} result.durationMs 单调事务耗时。
     * @returns {Readonly<object>} 已写入 request 事件。
     */
    function completeSuccess({ durationMs }) {
      if (responseProcess.responseReceived !== true || responseProcess.contentLengthBytes === null) {
        throw new Error('成功审计必须具有最终响应和完整容量');
      }
      return complete({ result: LOG_RESULT.success, durationMs, failureReason: null });
    }

    /**
     * 输出失败请求事件。
     * 调用方: ProxyExecutor 完成稳定错误归类后。
     * 副作用: 调用 complete 写入一次 failure 终态；已取得响应概况可以保留。
     * 失败路径: errorCode 为空时抛 Error。
     *
     * @param {object} result 失败结果。
     * @param {number} result.durationMs 单调事务耗时。
     * @param {string} result.errorCode 稳定代理错误码。
     * @returns {Readonly<object>} 已写入 request 事件。
     */
    function completeFailure({ durationMs, errorCode }) {
      if (typeof errorCode !== 'string' || errorCode.length === 0) {
        throw new Error('失败审计必须具有稳定错误码');
      }
      return complete({ result: LOG_RESULT.failure, durationMs, failureReason: errorCode });
    }

    return Object.freeze({
      startHop,
      recordConnection,
      recordResponse,
      recordReceivedBytes,
      completeSuccess,
      completeFailure
    });
  }

  return Object.freeze({ beginRequest, rejectRequest });
}
