/*
  proxyBodyEncoder.js 模块说明

  - 文件职责:
      把已通过 Proxy 2.0 校验的 none、utf8 或 base64 运输体转换为 Undici 可发送的原始字节。
      代理执行器在初始请求前调用本模块；本文件不序列化业务对象、不设置请求头，也不访问网络。

  - 导入库及文件汇总(2 条，内置 1 条，第三方 0 条，自定义 1 条):
      node:buffer#Buffer: 按冻结运输编码创建上游请求字节。
      ../errors/proxyError.js#ProxyError: 将校验后不可能出现的编码状态失败关闭为内部错误。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      encodeProxyRequestBody(body): 转换冻结运输体并返回 body/hasBody 描述。

  - 模块级类:
      无

  - 对外导出:
      encodeProxyRequestBody: function，ProxyExecutor 构造可在安全重定向中复用的请求字节。
*/

// 导入来源: node:buffer；导入内容: Buffer；文件作用: 生成 UTF-8 或 base64 解码后的上游原始字节。
import { Buffer } from 'node:buffer';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 校验后出现未知编码时失败关闭。
import { ProxyError } from '../errors/proxyError.js';

/**
 * 把规范化 ProxyRequestEnvelope.body 转换为上游请求字节。
 * 调用方: ProxyExecutor 在初始请求前调用，307/308 重定向复用返回的同一 Buffer。
 * 副作用: 为有正文请求创建新 Buffer；不修改协议对象、不序列化业务数据、不访问网络。
 * 成功路径: none 返回 undefined，utf8 和 base64 返回对应原始字节并标记 hasBody=true。
 * 失败路径: 校验后仍出现未知编码或 Buffer 转换异常时抛 PROXY_INTERNAL_ERROR。
 *
 * @param {Readonly<{ encoding: string, data: string|null }>} body 已通过请求校验的冻结运输体。
 * @returns {Readonly<{ body: Buffer|undefined, hasBody: boolean }>} Undici body 和实体存在标记。
 * @throws {ProxyError} 运输体无法按冻结编码转换时抛出。
 */
export function encodeProxyRequestBody(body) {
  if (body.encoding === 'none') {
    return Object.freeze({ body: undefined, hasBody: false });
  }

  try {
    if (body.encoding === 'utf8') {
      return Object.freeze({ body: Buffer.from(body.data, 'utf8'), hasBody: true });
    }

    if (body.encoding === 'base64') {
      return Object.freeze({ body: Buffer.from(body.data, 'base64'), hasBody: true });
    }
  } catch (error) {
    // 错误转换: 输入已通过协议校验，转换失败表示内部状态破坏；原始正文和异常不进入代理响应。
    throw new ProxyError('PROXY_INTERNAL_ERROR', { cause: error });
  }

  // 契约边界: 未知编码不能被当作空正文发送，否则会把内部协议破坏隐藏成上游业务失败。
  throw new ProxyError('PROXY_INTERNAL_ERROR');
}
