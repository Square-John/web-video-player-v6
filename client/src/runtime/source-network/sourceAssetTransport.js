/*
  sourceAssetTransport.js 模块说明

  - 文件职责:
      为页面已经持有的标准 poster/cover 地址提供受控展示资源运输端口。
      只在浏览器直接嵌入失败后复用应用唯一 NetworkAdapter 获取原始图片字节。
      不识别 Provider、域名或站点业务，不解析图片内容，也不修改 ContentItem。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      source-shell.config.js exports: 提供标准 GET、none 请求体和统一响应容量上限。

  - 模块级常量:
      SOURCE_ASSET_TRANSPORT_CONFIG: Readonly<object>，图片展示运输的请求头、超时、容量和请求标识前缀。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertNetworkAdapter(networkAdapter): 校验组合根注入的唯一 NetworkAdapter。
      normalizeAssetRequest(request): 校验 sourceId、HTTPS URL 和 AbortSignal。
      readResponseHeader(headers, expectedName): 从有序响应头读取最后一个同名值。
      normalizeImageResponse(response): 校验 2xx、image/* 和 ArrayBuffer 后返回图片运输结果。

  - 模块级类:
      无

  - 对外导出:
      SOURCE_ASSET_TRANSPORT_CONFIG: object，供测试和审查读取集中策略。
      createSourceAssetTransport: function，从唯一 NetworkAdapter 创建裁剪图片运输端口。
*/

import {
  // 导入来源: ../source-shell/source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_BODY_ENCODING 请求正文编码枚举。
  // 文件作用: 将图片 GET 固定为 none 正文，保持既有 Shell/ProxyClient 协议。
  SOURCE_NETWORK_BODY_ENCODING,
  // 导入来源: ../source-shell/source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_METHOD 请求方法枚举。
  // 文件作用: 将展示资源运输限制为既有标准 GET 方法。
  SOURCE_NETWORK_METHOD,
  // 导入来源: ../source-shell/source-shell.config.js。
  // 导入内容: SOURCE_NETWORK_POLICY 公共网络容量策略。
  // 文件作用: 复用 Shell 已有响应容量上限，不在图片链复制魔法数字。
  SOURCE_NETWORK_POLICY
} from '../source-shell/source-shell.config.js';

// 类型: Readonly<object>。
// 作用: 集中定义展示图片请求，不让组件和 service 复制请求头、超时、容量或请求身份字符串。
export const SOURCE_ASSET_TRANSPORT_CONFIG = Object.freeze({
  // 类型: string；作用: 请求源站优先返回浏览器可展示图片格式，但最终仍以响应 Content-Type 为准。
  acceptHeaderValue: 'image/avif,image/webp,image/apng,image/*;q=0.8',
  // 类型: string；作用: 从有序响应头中定位真实媒体类型。
  contentTypeHeaderName: 'content-type',
  // 类型: string；作用: 生成只属于展示资源运输的进程内单调请求标识。
  requestIdPrefix: 'source-display-asset',
  // 类型: number；作用: 单次图片兜底允许的上游时间，不产生自动重试或固定等待。
  timeoutMilliseconds: 15000,
  // 类型: number；作用: 复用 Shell 当前 2 MiB 上限，超限图片明确失败并显示既有占位。
  maxResponseBytes: SOURCE_NETWORK_POLICY.maxResponseBytes
});

/**
 * 校验组合根注入的 NetworkAdapter。
 * 纯函数: 只读取 request 方法，不创建请求或修改依赖。
 * 失败路径: 缺少唯一 request 端口时抛 TypeError，不建立 fetch 或第二 ProxyClient 回退。
 *
 * @param {*} networkAdapter 组合根持有的生产 NetworkAdapter 候选。
 * @returns {Readonly<object>} 已验证适配器原引用。
 * @throws {TypeError} 适配器形状无效时抛出。
 */
function assertNetworkAdapter(networkAdapter) {
  // 条件分支: 注入对象缺失、类型错误或不具备唯一 request 方法时进入。
  // 执行内容: 明确拒绝创建运输端口，禁止回退到全局 fetch 或第二 ProxyClient。
  if (!networkAdapter || typeof networkAdapter !== 'object'
    || typeof networkAdapter.request !== 'function') {
    throw new TypeError('SourceAssetTransport 需要有效 NetworkAdapter');
  }
  return networkAdapter;
}

/**
 * 校验单次展示资源请求输入。
 * 纯函数: 规范化 sourceId 和 URL，不访问网络或保存内容对象。
 * 成功路径: 返回新的冻结输入；失败路径: 身份、协议、凭据或 signal 无效时抛 TypeError。
 *
 * @param {*} request 展示资源请求候选。
 * @returns {Readonly<{sourceId: string, url: string, signal: AbortSignal}>} 规范化请求。
 * @throws {TypeError} 请求字段不满足展示运输边界时抛出。
 */
function normalizeAssetRequest(request) {
  // 条件分支: 请求候选不是普通对象时进入。
  // 执行内容: 明确拒绝不具备字段契约的展示资源请求。
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('展示资源请求必须是对象');
  }

  // 类型: string；作用: 保存去除首尾空白后的数据源身份，供唯一 NetworkAdapter 绑定 SourceContext。
  const sourceId = typeof request.sourceId === 'string' ? request.sourceId.trim() : '';
  // 条件分支: 请求没有有效 sourceId 时进入。
  // 执行内容: 明确拒绝无法绑定数据源上下文的图片运输。
  if (!sourceId) {
    throw new TypeError('展示资源请求缺少 sourceId');
  }

  // 类型: URL|undefined；作用: 保存经过浏览器 URL 语义解析的展示资源地址，供协议与凭据校验。
  let parsedUrl;
  try {
    parsedUrl = new URL(request.url);
  } catch (error) {
    throw new TypeError('展示资源 URL 无效', { cause: error });
  }
  // 条件分支: 图片地址不是 HTTPS，或在 URL 中携带用户名/密码时进入。
  // 执行内容: 拒绝不安全协议和 URL 凭据，保持代理安全边界。
  if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) {
    throw new TypeError('展示资源只允许无凭据 HTTPS URL');
  }

  // 条件分支: 调用者没有提供符合最小形状的 AbortSignal 时进入。
  // 执行内容: 拒绝无法被组件生命周期中止的图片请求。
  if (!request.signal || typeof request.signal !== 'object'
    || typeof request.signal.aborted !== 'boolean'
    || typeof request.signal.addEventListener !== 'function') {
    throw new TypeError('展示资源请求需要有效 AbortSignal');
  }

  return Object.freeze({ sourceId, url: parsedUrl.href, signal: request.signal });
}

/**
 * 从有序响应头读取最后一个同名值。
 * 纯函数: 不合并或重排响应头；同名值按 HTTP 后到覆盖语义选择最后一条。
 *
 * @param {*} headers SourceNetworkResponse.headers 候选。
 * @param {string} expectedName 已规范化的小写头名称。
 * @returns {string} 最后一条同名响应头值；不存在时为空字符串。
 */
function readResponseHeader(headers, expectedName) {
  // 条件分支: 响应头不是标准有序数组时进入。
  // 执行内容: 返回空值，由上层媒体类型校验收敛为明确失败。
  if (!Array.isArray(headers)) return '';
  // 类型: string；作用: 保存遍历过程中最后一条同名响应头值，符合后到覆盖语义。
  let value = '';
  // 循环类型: for...of；初始值: 第一条响应头；终止条件: 全部响应头遍历完成；作用: 定位最后一个同名值。
  for (const header of headers) {
    // 条件分支: 当前成员名称匹配且值为字符串时进入。
    // 执行内容: 采用当前值，让后续同名成员仍可按顺序覆盖。
    if (header && header.name === expectedName && typeof header.value === 'string') {
      value = header.value;
    }
  }
  return value;
}

/**
 * 校验图片运输响应并裁剪为展示 service 所需字段。
 * 纯函数: 不解码图片、不创建 Blob URL、不修改 SourceNetworkResponse。
 * 成功路径: 只接受 2xx、image/* 和 ArrayBuffer；失败路径: 真实上游错误或非图片正文明确抛错。
 *
 * @param {*} response SourceNetworkResponse 候选。
 * @returns {Readonly<{body: ArrayBuffer, contentType: string}>} 原始图片字节与标准媒体类型。
 * @throws {Error} 上游状态或媒体类型不满足图片展示要求时抛出。
 */
function normalizeImageResponse(response) {
  // 条件分支: 响应缺失、状态不是整数或不属于 2xx 时进入。
  // 执行内容: 保留真实上游失败，不把错误页转换成图片成功。
  if (!response || typeof response !== 'object'
    || !Number.isInteger(response.status)
    || response.status < 200
    || response.status > 299) {
    throw new Error('展示资源上游响应状态不可用');
  }
  // 条件分支: 代理没有按原始字节协议返回 ArrayBuffer 时进入。
  // 执行内容: 拒绝文本或其它正文进入 Blob 图片链。
  if (!(response.body instanceof ArrayBuffer)) {
    throw new Error('展示资源响应正文不是 ArrayBuffer');
  }

  // 类型: string；作用: 保存响应头声明的原始媒体类型，供参数剥离和 image 主类型校验。
  const rawContentType = readResponseHeader(
    response.headers,
    SOURCE_ASSET_TRANSPORT_CONFIG.contentTypeHeaderName
  );
  // 类型: string；作用: 保存去除参数并规范为小写的媒体类型，作为 Blob 的唯一类型来源。
  const contentType = rawContentType.split(';', 1)[0].trim().toLowerCase();
  // 条件分支: 上游正文没有声明 image 主类型时进入。
  // 执行内容: 拒绝 HTML 错误页或其它非图片内容伪装成可展示资源。
  if (!contentType.startsWith('image/')) {
    throw new Error('展示资源响应不是图片');
  }

  return Object.freeze({ body: response.body, contentType });
}

/**
 * 从应用唯一 NetworkAdapter 创建展示图片运输端口。
 * 状态所有权: 闭包只保存单调请求序号，不缓存 URL、字节、Blob 或 ContentItem。
 * 副作用: requestImage 每次执行一条既有 ProxyClient 请求；调用者 signal 决定中止。
 * 成功路径: 返回经过状态和媒体类型校验的图片字节；失败路径: 输入、代理或上游失败原样拒绝。
 *
 * @param {object} options 创建选项。
 * @param {Readonly<object>} options.networkAdapter 应用组合根持有的唯一 NetworkAdapter。
 * @returns {Readonly<{requestImage: Function}>} 裁剪图片运输端口。
 */
export function createSourceAssetTransport({ networkAdapter } = {}) {
  // 类型: Readonly<object>；作用: 保存通过形状校验的应用唯一 NetworkAdapter 引用。
  const adapter = assertNetworkAdapter(networkAdapter);
  // 类型: number；作用: 为进程内展示图片请求生成单调标识，不承担缓存、重试或业务身份。
  let requestSequence = 0;

  return Object.freeze({
    /**
     * 获取一个标准内容对象已经声明的展示图片 URL。
     * 副作用: 通过唯一 NetworkAdapter 发送一次 GET；不保存响应、不重试、不改写输入内容。
     * 成功路径: 返回通过状态、原始字节和 image 媒体类型校验的冻结结果。
     * 失败路径: 输入、取消、代理、上游状态、容量或媒体类型错误原样拒绝。
     *
     * @param {object} request 展示资源请求。
     * @param {string} request.sourceId 图片所属标准 ContentItem.sourceId。
     * @param {string} request.url 浏览器直接嵌入失败的 poster/cover HTTPS URL。
     * @param {AbortSignal} request.signal 当前组件图片代次的中止信号。
     * @returns {Promise<Readonly<{body: ArrayBuffer, contentType: string}>>} 图片原始字节和媒体类型。
     */
    async requestImage(request) {
      // 类型: Readonly<{sourceId: string, url: string, signal: AbortSignal}>；作用: 保存本次已验证运输输入。
      const normalizedRequest = normalizeAssetRequest(request);
      requestSequence += 1;
      // 类型: SourceNetworkResponse；作用: 保存唯一 NetworkAdapter 返回的原始响应，供图片边界校验。
      const response = await adapter.request(Object.freeze({
        sourceId: normalizedRequest.sourceId,
        requestId: `${SOURCE_ASSET_TRANSPORT_CONFIG.requestIdPrefix}-${requestSequence}`,
        url: normalizedRequest.url,
        method: SOURCE_NETWORK_METHOD.get,
        headers: Object.freeze([
          Object.freeze({ name: 'accept', value: SOURCE_ASSET_TRANSPORT_CONFIG.acceptHeaderValue })
        ]),
        body: Object.freeze({ encoding: SOURCE_NETWORK_BODY_ENCODING.none, data: null }),
        timeout: SOURCE_ASSET_TRANSPORT_CONFIG.timeoutMilliseconds,
        maxResponseBytes: SOURCE_ASSET_TRANSPORT_CONFIG.maxResponseBytes
      }), normalizedRequest.signal);
      return normalizeImageResponse(response);
    }
  });
}

