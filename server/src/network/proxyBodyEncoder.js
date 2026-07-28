/*
  proxyBodyEncoder.js 模块说明

  - 文件职责:
      把已通过 ProxyRequestValidator 的 none、utf8、json 或 base64 请求体转换为 Undici 可发送字节。
      供代理执行器在每跳方法确定后调用；本文件不重新解释协议、不设置请求头，也不访问网络。

  - 导入库及文件汇总(2 条，内置 1 条，第三方 0 条，自定义 1 条):
      node:buffer#Buffer: 按声明编码创建上游请求字节。
      ../errors/proxyError.js#ProxyError: 将不可能出现的内部编码状态失败关闭为固定内部错误。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      encodeProxyRequestBody(body): 转换冻结协议请求体并返回 body/hasBody 描述。

  - 模块级类:
      无

  - 对外导出:
      encodeProxyRequestBody: function，proxyExecutor 构造当前跳上游 body。
*/

// 导入来源: node:buffer；导入内容: Buffer；文件作用: 生成 UTF-8、JSON 或 base64 解码后的上游请求字节。
import { Buffer } from 'node:buffer';
// 导入来源: ../errors/proxyError.js；导入内容: ProxyError；文件作用: 校验后出现未知编码时失败关闭。
import { ProxyError } from '../errors/proxyError.js';

/**
 * 把规范化 ProxyRequestEnvelope.body 转换为上游请求字节。
 * 调用方: proxyExecutor 在初始请求和保留 body 的重定向跳调用。
 * 副作用: 为有 body 请求创建新 Buffer；不修改协议对象、不写入请求头或网络。
 * 成功路径: none 返回 undefined，其他编码返回对应字节和 hasBody=true。
 * 失败路径: 未知编码或 JSON 序列化异常抛 PROXY_INTERNAL_ERROR，不能用空 body 隐藏内部契约破坏。
 *
 * @param {Readonly<{ encoding: string, data: unknown }>} body 已通过请求校验的冻结请求体。
 * @returns {Readonly<{ body: Buffer|undefined, hasBody: boolean }>} Undici body 和是否携带实体的描述。
 * @throws {ProxyError} 校验后状态无法按冻结编码转换时抛出。
 */
export function encodeProxyRequestBody(body) {
  if (body.encoding === 'none') {
    return Object.freeze({ body: undefined, hasBody: false });
  }

  try {
    if (body.encoding === 'utf8') {
      return Object.freeze({ body: Buffer.from(body.data, 'utf8'), hasBody: true });
    }

    if (body.encoding === 'json') {
      return Object.freeze({ body: Buffer.from(JSON.stringify(body.data), 'utf8'), hasBody: true });
    }

    if (body.encoding === 'base64') {
      return Object.freeze({ body: Buffer.from(body.data, 'base64'), hasBody: true });
    }
  } catch (error) {
    // 错误转换: 输入已通过协议校验，转换仍失败表示内部状态破坏；原始 body 和异常不进入响应。
    throw new ProxyError('PROXY_INTERNAL_ERROR', { cause: error });
  }

  throw new ProxyError('PROXY_INTERNAL_ERROR');
}
