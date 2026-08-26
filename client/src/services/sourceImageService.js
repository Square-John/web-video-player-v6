/*
  sourceImageService.js 模块说明

  - 文件职责:
      把 SourceAssetTransport 返回的图片原始字节转换为浏览器临时 Blob URL 租约。
      由 SourceImage 组件显式释放租约，避免 Blob URL 跨组件和跨路由泄漏。
      不修改、缓存或持久化 ContentItem.poster/cover。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      sourceRuntimeInstance.js#sourceAssetTransportInstance: 复用应用组合根唯一 NetworkAdapter 的图片运输端口。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertServiceDependencies(options): 校验运输、Blob 和 Object URL 浏览器能力。

  - 模块级类:
      无

  - 对外导出:
      createSourceImageService: function，供领域测试注入隔离运输和浏览器 API。
      sourceImageService: object，生产组件共享的唯一无状态图片租约服务。
*/

// 导入来源: ../runtime/sourceRuntimeInstance.js。
// 导入内容: sourceAssetTransportInstance 应用唯一图片运输裁剪端口。
// 文件作用: 复用组合根中的唯一 NetworkAdapter，不在 service 内创建 fetch 或第二 ProxyClient。
import { sourceAssetTransportInstance } from '../runtime/sourceRuntimeInstance.js';

/**
 * 校验图片服务依赖。
 * 纯函数: 只读取公开方法形状，不创建 Blob 或 Object URL。
 * 失败路径: 任一能力缺失时抛 TypeError，生产不回退 data URL、内存缓存或直接 fetch。
 *
 * @param {*} options 服务依赖候选。
 * @returns {Readonly<object>} 已验证依赖集合。
 * @throws {TypeError} 运输或浏览器对象 URL 能力不可用时抛出。
 */
function assertServiceDependencies(options) {
  // 条件分支: 运输、Blob 构造器或 Object URL 创建/撤销能力任一缺失时进入。
  // 执行内容: 明确拒绝创建服务，禁止退回 data URL、缓存或全局 fetch。
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || !options.transport || typeof options.transport.requestImage !== 'function'
    || typeof options.BlobConstructor !== 'function'
    || !options.objectUrlApi || typeof options.objectUrlApi.createObjectURL !== 'function'
    || typeof options.objectUrlApi.revokeObjectURL !== 'function') {
    throw new TypeError('SourceImageService 依赖无效');
  }
  return Object.freeze({
    transport: options.transport,
    BlobConstructor: options.BlobConstructor,
    objectUrlApi: options.objectUrlApi
  });
}

/**
 * 创建临时展示图片租约服务。
 * 状态所有权: 服务本身不保存缓存；每次 acquire 返回独立 URL 和幂等 release 闭包。
 * 副作用: acquire 创建 Blob URL，release 撤销同一 URL。
 * 成功路径: 调用者得到可赋给 img.src 的临时 URL；失败路径: 运输或浏览器能力错误原样拒绝。
 *
 * @param {object} options 服务依赖。
 * @param {Readonly<object>} options.transport SourceAssetTransport 裁剪端口。
 * @param {Function} options.BlobConstructor 浏览器 Blob 构造函数。
 * @param {object} options.objectUrlApi 提供 createObjectURL/revokeObjectURL 的 URL API。
 * @returns {Readonly<{acquire: Function}>} 图片租约服务。
 */
export function createSourceImageService(options) {
  // 类型: Readonly<object>；作用: 保存经过形状校验的运输与浏览器资源依赖，供每次独立租约复用。
  const dependencies = assertServiceDependencies(options);

  return Object.freeze({
    /**
     * 获取一个临时图片 URL 租约。
     * 副作用: 通过运输端口请求图片，随后创建一个 Blob 和 Object URL；不修改原 URL 字段。
     * 成功路径: 返回可展示临时 URL 以及只撤销该 URL 的幂等 release 函数。
     * 失败路径: 运输、Blob 构造或 Object URL 创建失败时原样拒绝，不返回伪租约。
     *
     * @param {object} request 图片请求。
     * @param {string} request.sourceId 图片所属内容的数据源身份。
     * @param {string} request.url 浏览器直接加载失败的原始标准图片地址。
     * @param {AbortSignal} request.signal 当前组件代次中止信号。
     * @returns {Promise<Readonly<{url: string, release: Function}>>} 临时 URL 与幂等释放函数。
     */
    async acquire(request) {
      // 类型: Readonly<{body: ArrayBuffer, contentType: string}>；作用: 保存运输层已验证的图片字节和媒体类型。
      const imageResponse = await dependencies.transport.requestImage(request);
      // 类型: Blob；作用: 以可信媒体类型封装图片原始字节，供浏览器 Object URL 展示。
      const blob = new dependencies.BlobConstructor(
        [imageResponse.body],
        { type: imageResponse.contentType }
      );
      // 类型: string；作用: 保存当前租约唯一临时 URL，由返回的 release 闭包负责撤销。
      const objectUrl = dependencies.objectUrlApi.createObjectURL(blob);
      // 条件分支: 浏览器没有返回非空字符串 Object URL 时进入。
      // 执行内容: 明确失败，不把无效地址交给图片组件。
      if (typeof objectUrl !== 'string' || !objectUrl) {
        throw new Error('浏览器未创建有效图片 Object URL');
      }

      // 类型: boolean；作用: 记录当前 Object URL 是否已经撤销，保证 release 多次调用仍幂等。
      let released = false;
      return Object.freeze({
        url: objectUrl,
        /**
         * 撤销当前租约持有的 Object URL。
         * 副作用: 首次调用使用浏览器 API 释放 URL；后续调用不重复撤销。
         *
         * @returns {void} 当前租约释放完成后结束。
         */
        release() {
          // 条件分支: 当前租约已经释放时进入。
          // 执行内容: 直接结束，避免对同一 Object URL 重复执行浏览器撤销。
          if (released) return;
          released = true;
          dependencies.objectUrlApi.revokeObjectURL(objectUrl);
        }
      });
    }
  });
}

// 类型: Readonly<object>。
// 作用: 生产组件共享同一服务定义；服务不缓存图片，资源所有权仍由每个 SourceImage 租约持有。
export const sourceImageService = createSourceImageService({
  transport: sourceAssetTransportInstance,
  BlobConstructor: globalThis.Blob,
  objectUrlApi: globalThis.URL
});

