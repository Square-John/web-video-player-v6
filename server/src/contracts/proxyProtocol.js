/*
  proxyProtocol.js 模块说明

  - 文件职责:
      冻结后端 Proxy Protocol 2.1.0 的入口、精确字段、运输编码和稳定代理错误定义。
      请求校验、HTTP 路由、错误映射和契约测试必须共同引用本模块；协议变化须先修改公共协议并提升版本。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      PROXY_PROTOCOL_VERSION: string，当前唯一支持的代理协议版本。
      PROXY_REQUEST_ROUTE: string，当前唯一代理业务入口。
      PROXY_REQUEST_METHODS: ReadonlyArray<string>，允许的上游方法集合。
      PROXY_BODY_ENCODINGS: ReadonlyArray<string>，允许的原始请求体运输编码集合。
      PROXY_REQUEST_KEYS: ReadonlyArray<string>，请求外壳精确顶层字段。
      PROXY_TARGET_KEYS: ReadonlyArray<string>，target 精确字段。
      PROXY_HEADER_KEYS: ReadonlyArray<string>，有序头条目的精确字段。
      PROXY_BODY_KEYS: ReadonlyArray<string>，body 精确字段。
      PROXY_ERROR_DEFINITIONS: Readonly<object>，代理自身错误到 HTTP 状态、重试语义和安全文案的唯一映射。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      PROXY_PROTOCOL_VERSION: string，协议版本校验和响应回填使用。
      PROXY_REQUEST_ROUTE: string，服务注册和工程闸门使用。
      PROXY_REQUEST_METHODS: ReadonlyArray<string>，方法精确校验使用。
      PROXY_BODY_ENCODINGS: ReadonlyArray<string>，请求体组合校验使用。
      PROXY_REQUEST_KEYS: ReadonlyArray<string>，顶层未知字段拒绝使用。
      PROXY_TARGET_KEYS: ReadonlyArray<string>，target 未知字段拒绝使用。
      PROXY_HEADER_KEYS: ReadonlyArray<string>，头条目未知字段拒绝使用。
      PROXY_BODY_KEYS: ReadonlyArray<string>，body 未知字段拒绝使用。
      PROXY_ERROR_DEFINITIONS: Readonly<object>，统一错误对象和 HTTP 响应使用。
*/

// 类型: string；来源: 公共协议第 1、5、14 节；作用: 精确拒绝未知版本并回填全部代理响应。
export const PROXY_PROTOCOL_VERSION = '2.1.0';

// 类型: string；来源: 公共协议第 5.1 节；作用: 防止服务层散落旧版或第二个代理入口。
export const PROXY_REQUEST_ROUTE = '/api/proxy/v2/request';

// 类型: ReadonlyArray<string>；来源: 公共协议第 4.3 节；作用: 只允许无请求体 GET 和受控请求体 POST。
export const PROXY_REQUEST_METHODS = Object.freeze(['GET', 'POST']);

// 类型: ReadonlyArray<string>；来源: ProxyRequestEnvelope 2.1.0；作用: 只表达 JSON 外壳中的原始字节运输方式，不接收业务对象。
export const PROXY_BODY_ENCODINGS = Object.freeze(['none', 'utf8', 'base64']);

// 类型: ReadonlyArray<string>；来源: 公共协议第 5.2 节；作用: 精确校验顶层字段并拒绝旧 responseType 或未来字段。
export const PROXY_REQUEST_KEYS = Object.freeze([
  'protocolVersion',
  'requestId',
  'sourceId',
  'target',
  'headers',
  'body',
  'timeoutMs',
  'maxResponseBytes'
]);

// 类型: ReadonlyArray<string>；来源: ProxyRequestEnvelope.target；作用: target 只表达地址和方法，不承载业务路由信息。
export const PROXY_TARGET_KEYS = Object.freeze(['url', 'method']);

// 类型: ReadonlyArray<string>；来源: SourceHeaderEntry；作用: 每个有序头条目只携带名称和值。
export const PROXY_HEADER_KEYS = Object.freeze(['name', 'value']);

// 类型: ReadonlyArray<string>；来源: SourceNetworkBody；作用: body 只能声明运输编码和对应数据。
export const PROXY_BODY_KEYS = Object.freeze(['encoding', 'data']);

// 类型: Readonly<object>；来源: 公共协议第 5.4 节；作用: 所有代理自身错误共享固定状态、retryable 和不含敏感输入的默认消息。
export const PROXY_ERROR_DEFINITIONS = Object.freeze({
  // 协议语义: 当前服务不能消费请求声明的协议版本，客户端修改协议后才可重试。
  PROXY_PROTOCOL_UNSUPPORTED: Object.freeze({ httpStatus: 400, retryable: false, message: '代理协议版本不受支持' }),
  // 校验语义: 外壳字段、枚举、组合或容量参数不满足冻结协议。
  PROXY_VALIDATION_ERROR: Object.freeze({ httpStatus: 400, retryable: false, message: '代理请求不符合协议' }),
  // 安全语义: 目标协议、地址、解析 IP、重定向或媒体运输违反访问边界。
  PROXY_TARGET_FORBIDDEN: Object.freeze({ httpStatus: 403, retryable: false, message: '目标地址不允许访问' }),
  // 配额语义: 当前部署并发或速率额度已用尽，调用方可以稍后重试。
  PROXY_RATE_LIMITED: Object.freeze({ httpStatus: 429, retryable: true, message: '代理请求超过当前额度' }),
  // 准入语义: 请求等待并发槽位超过后端独立队列上限，未开始 DNS 或上游运输。
  PROXY_ADMISSION_TIMEOUT: Object.freeze({ httpStatus: 503, retryable: true, message: '代理请求等待准入超时' }),
  // 上游语义: 受控请求超过最终有效超时，重试仍须经过全部安全校验。
  PROXY_UPSTREAM_TIMEOUT: Object.freeze({ httpStatus: 504, retryable: true, message: '目标请求超时' }),
  // 容量语义: 响应流超过最终有效字节上限，不能以截断响应伪装成功。
  PROXY_RESPONSE_TOO_LARGE: Object.freeze({ httpStatus: 413, retryable: false, message: '目标响应超过容量限制' }),
  // 传输语义: DNS、连接、TLS、HTTP 解析或上游流读取失败且没有形成合法运输响应。
  PROXY_UPSTREAM_NETWORK_ERROR: Object.freeze({ httpStatus: 502, retryable: true, message: '目标网络请求失败' }),
  // 中止语义: 客户端断开或请求生命周期主动取消，必须同步释放上游资源。
  PROXY_REQUEST_ABORTED: Object.freeze({ httpStatus: 499, retryable: true, message: '代理请求已中止' }),
  // 内部语义: 未分类实现错误失败关闭；响应不得携带错误栈或内部对象。
  PROXY_INTERNAL_ERROR: Object.freeze({ httpStatus: 500, retryable: false, message: '代理内部错误' })
});
