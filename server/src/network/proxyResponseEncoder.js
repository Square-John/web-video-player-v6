/*
  proxyResponseEncoder.js 模块说明

  - 文件职责:
      流式读取上游响应并在下载过程中执行容量门禁，再按 json、text 或 arrayBuffer 生成冻结协议 body。
      供代理执行器处理最终非重定向响应；本文件拒绝压缩和媒体响应，不负责 DNS、重定向或 HTTP 发送。

  - 导入库及文件汇总(4 条，内置 2 条，第三方 0 条，自定义 2 条):
      node:buffer#Buffer: 累计响应字节并生成 UTF-8 输入或 base64 文本。
      node:util#TextDecoder: 以 fatal 模式拒绝非法 UTF-8，而不是静默插入替换字符。
      ../errors/proxyError.js#ProxyError: 表达容量、网络、解码和媒体禁止失败。
      ./proxyHeaders.js#getResponseHeaderValues: 从有序响应头中读取内容长度、编码和类型。

  - 模块级常量:
      UTF8_DECODER_OPTIONS: Readonly<object>，严格 UTF-8 解码选项。
      FORBIDDEN_MEDIA_TYPES: ReadonlySet<string>，不允许通过代理传输的媒体和流清单 MIME。
      DECIMAL_BYTE_LENGTH_PATTERN: RegExp，Content-Length 非负十进制格式。

  - 模块级变量:
      无

  - 模块级辅助函数:
      deepFreezeJson(value): 深层冻结 JSON.parse 创建的隔离响应值。
      attachCleanupErrorHandler(body): 消费主动销毁响应流产生的预期 error，并在 close 后移除监听。
      destroyResponseBody(body): 在超限或提前拒绝时销毁当前上游流。
      assertIdentityEncoding(headers): 拒绝上游未遵守 identity 的压缩表示。
      assertNonMediaResponse(headers): 阻止视频、音频和流媒体清单进入代理。
      assertDeclaredLengthWithinLimit(headers, maximumBytes, body): 使用可信格式的 Content-Length 提前停止超限下载。
      decodeResponseBytes(bytes, responseType): 按冻结 responseType 生成协议 body。
      encodeProxyResponseBody(options): 流式容量检查并返回编码 body 与 receivedBytes。

  - 模块级类:
      无

  - 对外导出:
      encodeProxyResponseBody: function，proxyExecutor 生成 ProxyResponseEnvelope.body 与容量元数据。
*/

// 导入来源: node:buffer；导入内容: Buffer；文件作用: 规范响应 chunk、拼接受限字节和生成 base64。
import { Buffer } from 'node:buffer';
// 导入来源: node:util；导入内容: TextDecoder；文件作用: 使用 fatal UTF-8 解码拒绝无效文本字节。
import { TextDecoder } from 'node:util';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 把响应容量、媒体、网络和解码失败映射到冻结错误码。
import { ProxyError } from '../errors/proxyError.js';
// 导入来源: ./proxyHeaders.js；导入内容: getResponseHeaderValues；文件作用: 从有序头条目读取响应表示元数据。
import { getResponseHeaderValues } from './proxyHeaders.js';

// 类型: Readonly<object>；来源: WHATWG TextDecoder；作用: fatal=true 遇到非法 UTF-8 直接失败，ignoreBOM=false 按标准处理 BOM。
const UTF8_DECODER_OPTIONS = Object.freeze({ fatal: true, ignoreBOM: false });

// 类型: ReadonlySet<string>；来源: 公共协议“视频地址不进入代理”边界；作用: 补充 video/*、audio/* 前缀之外的常见流媒体清单与容器类型。
const FORBIDDEN_MEDIA_TYPES = new Set([
  'application/dash+xml',
  'application/mp4',
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl'
]);

// 类型: RegExp；来源: HTTP Content-Length 语法；作用: 仅在无符号十进制且安全可解析时用于提前容量拒绝。
const DECIMAL_BYTE_LENGTH_PATTERN = /^(?:0|[1-9]\d*)$/u;

/**
 * 深层冻结 JSON.parse 创建的隔离响应值。
 * 调用方: decodeResponseBytes 的 json 分支及本函数递归。
 * 副作用: 冻结传入的隔离对象或数组；不接触上游 Buffer 和请求对象。
 * 失败路径: 无；JSON.parse 已保证无循环且只包含标准 JSON Value。
 *
 * @param {unknown} value 已解析 JSON Value。
 * @returns {unknown} 原值或深层冻结后的原引用。
 */
function deepFreezeJson(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) {
      deepFreezeJson(child);
    }
    Object.freeze(value);
  }

  return value;
}

/**
 * 为主动销毁的上游响应流挂载预期错误清理端口。
 * 调用方: destroyResponseBody。
 * 副作用: 在当前 body 上添加一次 error/close 监听；不改写主事务错误或日志。
 * 成功路径: destroy 产生的中止错误被消费，执行器仍返回原始容量、媒体或解码错误。
 * 失败路径: body 不支持标准事件端口时不执行任何操作。
 *
 * @param {unknown} body 当前上游响应流。
 * @returns {void} 监听挂载完成或 body 不可监听时返回。
 */
function attachCleanupErrorHandler(body) {
  if (!body || typeof body.once !== 'function' || typeof body.removeListener !== 'function') {
    return;
  }

  // 回调: 主动销毁错误属于资源释放副作用，不应覆盖上层已经确定的固定代理错误。
  const absorbCleanupError = () => {};
  // 回调: close 后移除吸收器，避免清理监听持有响应流引用。
  const removeCleanupErrorHandler = () => body.removeListener('error', absorbCleanupError);
  body.once('error', absorbCleanupError);
  body.once('close', removeCleanupErrorHandler);
}

/**
 * 尽早销毁当前上游响应流。
 * 调用方: Content-Length 预检、媒体拒绝后的调用方和流式超限分支。
 * 副作用: 若 body 提供 destroy 且尚未销毁，立即关闭上游读取资源。
 * 失败路径: destroy 自身异常被忽略，原始容量或安全错误仍由调用方抛出。
 *
 * @param {unknown} body Undici 响应 body 流。
 * @returns {void} 无返回值。
 */
function destroyResponseBody(body) {
  if (body && typeof body.destroy === 'function' && body.destroyed !== true) {
    try {
      // 资源清理: 先消费 destroy 异步 error，再关闭流，保证主错误由调用方稳定返回。
      attachCleanupErrorHandler(body);
      body.destroy();
    } catch {
      // 清理边界: 销毁失败不能覆盖更具体的容量、媒体或解码错误。
    }
  }
}

/**
 * 确认上游没有忽略 accept-encoding=identity 返回压缩表示。
 * 调用方: encodeProxyResponseBody 读取字节前。
 * 副作用: 无；只读取已裁剪响应头。
 * 失败路径: 多个、空值或非 identity Content-Encoding 抛响应解码错误。
 *
 * @param {ReadonlyArray<object>} headers 已裁剪的有序响应头。
 * @returns {void} 缺失或唯一 identity 表示可继续读取。
 * @throws {ProxyError} 响应表示需要未实现的解压时抛出。
 */
function assertIdentityEncoding(headers) {
  const values = getResponseHeaderValues(headers, 'content-encoding');

  if (values.length === 0) {
    return;
  }

  if (values.length !== 1 || values[0].trim().toLowerCase() !== 'identity') {
    throw new ProxyError('PROXY_RESPONSE_DECODE_ERROR', { details: { field: 'upstream.headers.content-encoding', reason: 'compressed_response_forbidden' } });
  }
}

/**
 * 拒绝视频、音频和流媒体清单响应。
 * 调用方: encodeProxyResponseBody 读取字节前。
 * 副作用: 无；只读取 Content-Type 媒体类型部分。
 * 失败路径: 多个 Content-Type 抛解码错误；媒体类型命中禁止边界抛目标禁止错误。
 *
 * @param {ReadonlyArray<object>} headers 已裁剪的有序响应头。
 * @returns {void} 非媒体响应或未声明 Content-Type 可继续处理。
 * @throws {ProxyError} 类型歧义或媒体响应不允许代理时抛出。
 */
function assertNonMediaResponse(headers) {
  const values = getResponseHeaderValues(headers, 'content-type');

  if (values.length > 1) {
    throw new ProxyError('PROXY_RESPONSE_DECODE_ERROR', { details: { field: 'upstream.headers.content-type', reason: 'duplicate_content_type' } });
  }

  if (values.length === 0) {
    return;
  }

  // 类型: string；来源: 唯一 Content-Type 分号前媒体类型；作用: 参数不会影响媒体代理禁止判断。
  const mediaType = values[0].split(';', 1)[0].trim().toLowerCase();

  if (mediaType.startsWith('video/') || mediaType.startsWith('audio/') || FORBIDDEN_MEDIA_TYPES.has(mediaType)) {
    throw new ProxyError('PROXY_TARGET_FORBIDDEN', { details: { field: 'upstream.headers.content-type', reason: 'media_response_forbidden' } });
  }
}

/**
 * 使用唯一且格式可信的 Content-Length 在读流前拒绝明显超限响应。
 * 调用方: encodeProxyResponseBody。
 * 副作用: 声明长度超限时销毁 body；不相信该值替代后续流式真实计数。
 * 失败路径: 多个长度头抛解码错误；唯一安全整数超过上限抛响应过大；非法格式交给真实流计数兜底。
 *
 * @param {ReadonlyArray<object>} headers 已裁剪响应头。
 * @param {number} maximumBytes 当前请求有效响应字节上限。
 * @param {unknown} body 当前上游响应流。
 * @returns {void} 可继续流式读取时无返回。
 * @throws {ProxyError} 声明存在歧义或确定超限时抛出。
 */
function assertDeclaredLengthWithinLimit(headers, maximumBytes, body) {
  const values = getResponseHeaderValues(headers, 'content-length');

  if (values.length > 1) {
    destroyResponseBody(body);
    throw new ProxyError('PROXY_RESPONSE_DECODE_ERROR', { details: { field: 'upstream.headers.content-length', reason: 'duplicate_content_length' } });
  }

  if (values.length === 0 || !DECIMAL_BYTE_LENGTH_PATTERN.test(values[0])) {
    return;
  }

  // 类型: number；来源: 严格十进制 Content-Length；作用: 只用于提前拒绝，最终 receivedBytes 仍以实际 chunk 为准。
  const declaredBytes = Number(values[0]);

  if (Number.isSafeInteger(declaredBytes) && declaredBytes > maximumBytes) {
    destroyResponseBody(body);
    throw new ProxyError('PROXY_RESPONSE_TOO_LARGE', { details: { field: 'body', reason: 'declared_length_limit' } });
  }
}

/**
 * 按冻结 responseType 把受限完整字节转换为协议 body。
 * 调用方: encodeProxyResponseBody 完成流读取后。
 * 副作用: JSON 分支创建并深层冻结解析值；其他分支创建字符串。
 * 成功路径: json 返回 encoding=json，text 返回 utf8，arrayBuffer 返回 base64。
 * 失败路径: 非法 UTF-8、JSON 语法或未知 responseType 抛固定解码或内部错误。
 *
 * @param {Buffer} bytes 已通过容量门禁的完整上游字节。
 * @param {string} responseType 已校验的 json、text 或 arrayBuffer。
 * @returns {Readonly<{ encoding: string, data: unknown }>} 冻结协议响应体。
 * @throws {ProxyError} 字节不能按声明类型转换时抛出。
 */
function decodeResponseBytes(bytes, responseType) {
  if (responseType === 'arrayBuffer') {
    return Object.freeze({ encoding: 'base64', data: bytes.toString('base64') });
  }

  // 类型: string；来源: fatal TextDecoder；作用: json 和 text 共用严格 UTF-8 边界，不接受替换字符掩盖上游错误。
  let text;

  try {
    text = new TextDecoder('utf-8', UTF8_DECODER_OPTIONS).decode(bytes);
  } catch (error) {
    throw new ProxyError('PROXY_RESPONSE_DECODE_ERROR', {
      details: { field: 'body', reason: 'invalid_utf8' },
      cause: error
    });
  }

  if (responseType === 'text') {
    return Object.freeze({ encoding: 'utf8', data: text });
  }

  if (responseType === 'json') {
    try {
      return Object.freeze({ encoding: 'json', data: deepFreezeJson(JSON.parse(text)) });
    } catch (error) {
      throw new ProxyError('PROXY_RESPONSE_DECODE_ERROR', {
        details: { field: 'body', reason: 'invalid_json' },
        cause: error
      });
    }
  }

  throw new ProxyError('PROXY_INTERNAL_ERROR');
}

/**
 * 流式限制并编码一个最终上游响应体。
 * 调用方: proxyExecutor 对非重定向响应调用。
 * 副作用: 消费并结束 Undici body 流；超限、媒体、压缩或中止时立即销毁当前流。
 * 成功路径: 返回协议 body 和转换前实际 receivedBytes。
 * 失败路径: 超限、解码、媒体或已知 ProxyError 原样抛出；流读取异常转网络错误；signal 中止保留原原因。
 *
 * @param {object} options 响应编码参数。
 * @param {AsyncIterable<Uint8Array>} options.body Undici 上游响应流。
 * @param {ReadonlyArray<object>} options.headers 已裁剪有序响应头。
 * @param {string} options.responseType 请求声明的响应类型。
 * @param {number} options.maximumBytes 当前请求有效响应字节上限。
 * @param {AbortSignal} options.signal 当前代理事务组合中止信号。
 * @returns {Promise<Readonly<{ body: object, receivedBytes: number }>>} 编码结果和原始字节计数。
 * @throws {ProxyError|unknown} 固定代理错误或中止 reason。
 */
export async function encodeProxyResponseBody({ body, headers, responseType, maximumBytes, signal }) {
  try {
    assertIdentityEncoding(headers);
    assertNonMediaResponse(headers);
    assertDeclaredLengthWithinLimit(headers, maximumBytes, body);
  } catch (error) {
    destroyResponseBody(body);
    throw error;
  }

  // 类型: Array<Buffer>；生命周期: 当前响应且总字节受 maximumBytes 约束；作用: 完成后一次拼接用于协议编码。
  const chunks = [];
  // 类型: number；生命周期: 当前响应；作用: 每个 chunk 到达时累计转换前真实字节。
  let receivedBytes = 0;

  try {
    // 流式边界: 每个 chunk 到达即累计并检查，不能完整下载后才比较上限。
    for await (const chunk of body) {
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

    // 错误转换: 上游流错误只作为 cause 保留，响应不暴露 socket、地址或传输内部信息。
    throw new ProxyError('PROXY_UPSTREAM_NETWORK_ERROR', { cause: error });
  }

  // 类型: Buffer；来源: 受限 chunks；作用: responseType 转换只面对不超过 maximumBytes 的完整字节。
  const bytes = Buffer.concat(chunks, receivedBytes);
  return Object.freeze({ body: decodeResponseBytes(bytes, responseType), receivedBytes });
}
