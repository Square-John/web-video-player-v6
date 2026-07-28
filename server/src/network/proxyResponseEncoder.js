/*
  proxyResponseEncoder.js 模块说明

  - 文件职责:
      流式读取最终上游响应，在下载过程中执行容量与媒体运输门禁，并把完整原始字节统一包装为 base64。
      ProxyExecutor 对最终非重定向响应调用本模块；本文件不解码文本、JSON、HTML、压缩内容或站点业务。

  - 导入库及文件汇总(3 条，内置 1 条，第三方 0 条，自定义 2 条):
      node:buffer#Buffer: 规范响应块、累计受限字节并生成 base64 运输文本。
      ../errors/proxyError.js#ProxyError: 表达容量、网络、媒体和中止失败。
      ./proxyHeaders.js#getResponseHeaderValues: 从有序响应头读取通用容量与媒体元数据。

  - 模块级常量:
      FORBIDDEN_MEDIA_TYPES: ReadonlySet<string>，不允许通过代理传输的媒体清单和容器 MIME。
      DECIMAL_BYTE_LENGTH_PATTERN: RegExp，可用于提前容量拒绝的 Content-Length 格式。

  - 模块级变量:
      无

  - 模块级辅助函数:
      attachCleanupErrorHandler(body): 消费主动销毁响应流产生的预期清理错误。
      destroyResponseBody(body): 在超限、媒体或中止时关闭当前上游流。
      assertNonMediaResponse(headers): 阻止视频、音频和流媒体清单进入代理。
      assertDeclaredLengthWithinLimit(headers, maximumBytes, body): 对唯一可信 Content-Length 提前执行容量门禁。
      encodeProxyResponseBody(options): 流式累计并返回 base64 原始字节和真实计数。

  - 模块级类:
      无

  - 对外导出:
      encodeProxyResponseBody: function，ProxyExecutor 生成 ProxyResponseEnvelope.body 与 receivedBytes。
*/

// 导入来源: node:buffer；导入内容: Buffer；文件作用: 规范响应 chunk、拼接受限原始字节和生成 base64。
import { Buffer } from 'node:buffer';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 把响应容量、媒体和网络失败映射到冻结错误码。
import { ProxyError } from '../errors/proxyError.js';
// 导入来源: ./proxyHeaders.js；导入内容: getResponseHeaderValues；文件作用: 从有序头读取通用媒体类型和声明长度。
import { getResponseHeaderValues } from './proxyHeaders.js';

// 类型: ReadonlySet<string>；来源: 公共协议“媒体地址由浏览器直连”边界；作用: 补充 video/*、audio/* 之外的常见流清单与容器。
const FORBIDDEN_MEDIA_TYPES = new Set([
  'application/dash+xml',
  'application/mp4',
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl'
]);

// 类型: RegExp；来源: HTTP Content-Length 语法；作用: 仅在唯一无符号十进制值时提前拒绝确定超限正文。
const DECIMAL_BYTE_LENGTH_PATTERN = /^(?:0|[1-9]\d*)$/u;

/**
 * 为主动销毁的上游响应流挂载预期错误清理端口。
 * 调用方: destroyResponseBody。
 * 副作用: 在当前 body 添加一次 error/close 监听；不改写主事务错误或日志。
 * 成功路径: destroy 产生的中止错误被消费，执行器仍返回原始容量、媒体或中止结果。
 * 失败路径: body 不支持标准事件端口时不执行任何操作。
 *
 * @param {unknown} body 当前上游响应流。
 * @returns {void} 监听挂载完成或流不可监听时返回。
 */
function attachCleanupErrorHandler(body) {
  if (!body || typeof body.once !== 'function' || typeof body.removeListener !== 'function') {
    return;
  }

  // 回调: 主动 destroy 的错误只属于资源清理，不能覆盖已经确定的固定代理结果。
  const absorbCleanupError = () => {};
  // 回调: close 后移除吸收器，避免监听继续持有响应流。
  const removeCleanupErrorHandler = () => body.removeListener('error', absorbCleanupError);
  body.once('error', absorbCleanupError);
  body.once('close', removeCleanupErrorHandler);
}

/**
 * 关闭当前上游响应流。
 * 调用方: 容量预检、媒体拒绝、流式超限和异常路径。
 * 副作用: 若 body 可销毁且尚未销毁，立即停止上游读取。
 * 失败路径: destroy 自身异常被吸收，原始事务错误继续向上传递。
 *
 * @param {unknown} body Undici 响应 body 流。
 * @returns {void} 清理完成或无需清理时返回。
 */
function destroyResponseBody(body) {
  if (body && typeof body.destroy === 'function' && body.destroyed !== true) {
    try {
      attachCleanupErrorHandler(body);
      body.destroy();
    } catch {
      // 清理边界: 流销毁失败不能替换更具体的容量、媒体、网络或中止结果。
    }
  }
}

/**
 * 拒绝视频、音频和流媒体清单响应。
 * 调用方: encodeProxyResponseBody 读取字节前。
 * 副作用: 无；只读取所有 Content-Type 的媒体类型部分。
 * 成功路径: 未声明或全部为非媒体类型时继续运输。
 * 失败路径: 任一值命中通用媒体类型时抛 PROXY_TARGET_FORBIDDEN。
 *
 * @param {ReadonlyArray<object>} headers 已裁剪有序响应头。
 * @returns {void} 非媒体响应可继续处理。
 * @throws {ProxyError} 媒体响应不允许通过元数据代理时抛出。
 */
function assertNonMediaResponse(headers) {
  const values = getResponseHeaderValues(headers, 'content-type');

  for (const value of values) {
    // 类型: string；来源: 当前 Content-Type 分号前部分；作用: 参数不影响通用媒体代理禁止判断。
    const mediaType = value.split(';', 1)[0].trim().toLowerCase();

    if (mediaType.startsWith('video/') || mediaType.startsWith('audio/') || FORBIDDEN_MEDIA_TYPES.has(mediaType)) {
      throw new ProxyError('PROXY_TARGET_FORBIDDEN', { details: { field: 'upstream.headers.content-type', reason: 'media_response_forbidden' } });
    }
  }
}

/**
 * 使用唯一且格式可信的 Content-Length 在读流前拒绝确定超限响应。
 * 调用方: encodeProxyResponseBody。
 * 副作用: 声明长度超限时销毁 body；不相信该值替代后续真实流计数。
 * 成功路径: 缺失、重复、非法或未超限的声明交给流式真实计数处理。
 * 失败路径: 唯一安全整数超过上限时抛 PROXY_RESPONSE_TOO_LARGE。
 *
 * @param {ReadonlyArray<object>} headers 已裁剪响应头。
 * @param {number} maximumBytes 当前请求有效响应字节上限。
 * @param {unknown} body 当前上游响应流。
 * @returns {void} 可继续流式读取时返回。
 * @throws {ProxyError} 唯一声明确定超限时抛出。
 */
function assertDeclaredLengthWithinLimit(headers, maximumBytes, body) {
  const values = getResponseHeaderValues(headers, 'content-length');

  // 运输边界: 重复或非法长度头仍原样返回 Provider，代理只在唯一可信值时做提前优化。
  if (values.length !== 1 || !DECIMAL_BYTE_LENGTH_PATTERN.test(values[0])) {
    return;
  }

  const declaredBytes = Number(values[0]);

  if (Number.isSafeInteger(declaredBytes) && declaredBytes > maximumBytes) {
    destroyResponseBody(body);
    throw new ProxyError('PROXY_RESPONSE_TOO_LARGE', { details: { field: 'body', reason: 'declared_length_limit' } });
  }
}

/**
 * 流式限制并编码一个最终上游响应体。
 * 调用方: ProxyExecutor 对非重定向响应调用。
 * 副作用: 消费并结束上游 body 流；超限、媒体、中止或流错误时销毁当前流。
 * 成功路径: 任意原始字节统一返回 base64，receivedBytes 等于 base64 解码后的真实字节数。
 * 失败路径: 容量和媒体错误原样抛出；流读取异常转网络错误；signal 中止保留原中止原因。
 *
 * @param {object} options 响应编码参数。
 * @param {AsyncIterable<Uint8Array>} options.body Undici 上游响应流。
 * @param {ReadonlyArray<object>} options.headers 已裁剪有序响应头。
 * @param {number} options.maximumBytes 当前请求有效响应字节上限。
 * @param {AbortSignal} options.signal 当前代理事务组合中止信号。
 * @returns {Promise<Readonly<{ body: object, receivedBytes: number }>>} base64 运输体和原始字节计数。
 * @throws {ProxyError|unknown} 固定代理错误或中止 reason。
 */
export async function encodeProxyResponseBody({ body, headers, maximumBytes, signal }) {
  try {
    assertNonMediaResponse(headers);
    assertDeclaredLengthWithinLimit(headers, maximumBytes, body);
  } catch (error) {
    destroyResponseBody(body);
    throw error;
  }

  if (!body || typeof body[Symbol.asyncIterator] !== 'function') {
    throw new ProxyError('PROXY_UPSTREAM_NETWORK_ERROR', { details: { field: 'body', reason: 'response_body_not_streamable' } });
  }

  // 类型: Array<Buffer>；生命周期: 当前响应且总字节受 maximumBytes 约束；作用: 完成后一次拼接生成 base64。
  const chunks = [];
  // 类型: number；生命周期: 当前响应；作用: 每个 chunk 到达时累计原始传输字节。
  let receivedBytes = 0;

  try {
    // 流式边界: 每个 chunk 到达即检查中止和容量，不能完整下载后再比较上限。
    for await (const chunk of body) {
      signal.throwIfAborted();
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += buffer.byteLength;

      if (receivedBytes > maximumBytes) {
        destroyResponseBody(body);
        throw new ProxyError('PROXY_RESPONSE_TOO_LARGE', { details: { field: 'body', reason: 'stream_byte_limit' } });
      }

      chunks.push(buffer);
    }
  } catch (error) {
    destroyResponseBody(body);

    if (signal.aborted || error instanceof ProxyError) {
      throw error;
    }

    // 错误转换: 上游流错误只作为服务端 cause 保留，响应不暴露套接字、地址或传输内部信息。
    throw new ProxyError('PROXY_UPSTREAM_NETWORK_ERROR', { cause: error });
  }

  const bytes = Buffer.concat(chunks, receivedBytes);
  return Object.freeze({
    body: Object.freeze({ encoding: 'base64', data: bytes.toString('base64') }),
    receivedBytes
  });
}
