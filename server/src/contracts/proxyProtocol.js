/*
  proxyProtocol.js 模块说明

  - 文件职责:
      冻结后端公共协议 1.0.0 的入口、精确字段集合、枚举和稳定代理错误定义。
      供请求校验、HTTP 路由和错误映射共同使用；协议变化必须同步提升协议版本。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      PROXY_PROTOCOL_VERSION: string，当前唯一支持的代理协议版本。
      PROXY_REQUEST_ROUTE: string，当前唯一代理业务入口。
      PROXY_REQUEST_METHODS: ReadonlyArray<string>，允许的上游方法集合。
      PROXY_BODY_ENCODINGS: ReadonlyArray<string>，允许的请求体编码集合。
      PROXY_RESPONSE_TYPES: ReadonlyArray<string>，允许的响应转换类型集合。
      PROXY_REQUEST_KEYS: ReadonlyArray<string>，请求外壳精确顶层字段。
      PROXY_TARGET_KEYS: ReadonlyArray<string>，target 精确字段。
      PROXY_BODY_KEYS: ReadonlyArray<string>，body 精确字段。
      PROXY_ERROR_DEFINITIONS: Readonly<object>，错误码到 HTTP 状态、重试语义和安全文案的唯一映射。

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
      PROXY_RESPONSE_TYPES: ReadonlyArray<string>，响应类型校验使用。
      PROXY_REQUEST_KEYS: ReadonlyArray<string>，顶层未知字段拒绝使用。
      PROXY_TARGET_KEYS: ReadonlyArray<string>，target 未知字段拒绝使用。
      PROXY_BODY_KEYS: ReadonlyArray<string>，body 未知字段拒绝使用。
      PROXY_ERROR_DEFINITIONS: Readonly<object>，统一错误对象和 HTTP 响应使用。
*/

// 类型: string；来源: 公共协议第 1、6、12 节；作用: 精确拒绝未知版本并回填全部代理响应。
export const PROXY_PROTOCOL_VERSION = '1.0.0';

// 类型: string；来源: 公共协议第 6.1 节；作用: 防止服务层散落第二个代理入口。
export const PROXY_REQUEST_ROUTE = '/api/proxy/v1/request';

// 类型: ReadonlyArray<string>；来源: 公共协议第 6.2 节；作用: 只允许无请求体 GET 和受控请求体 POST。
export const PROXY_REQUEST_METHODS = Object.freeze(['GET', 'POST']);

// 类型: ReadonlyArray<string>；来源: ProxyRequestEnvelope 1.0.0；作用: 冻结请求体传输编码，不接受隐式别名。
export const PROXY_BODY_ENCODINGS = Object.freeze(['none', 'utf8', 'json', 'base64']);

// 类型: ReadonlyArray<string>；来源: ProxyRequestEnvelope 1.0.0；作用: 决定代理响应编码路径。
export const PROXY_RESPONSE_TYPES = Object.freeze(['json', 'text', 'arrayBuffer']);

// 类型: ReadonlyArray<string>；来源: 公共协议第 6.2 节；作用: 精确校验顶层字段并拒绝未来字段被旧服务静默接受。
export const PROXY_REQUEST_KEYS = Object.freeze([
  'protocolVersion',
  'requestId',
  'sourceId',
  'target',
  'headers',
  'body',
  'responseType',
  'timeoutMs',
  'maxResponseBytes'
]);

// 类型: ReadonlyArray<string>；来源: ProxyRequestEnvelope.target；作用: target 只表达地址和方法，不承载业务路由信息。
export const PROXY_TARGET_KEYS = Object.freeze(['url', 'method']);

// 类型: ReadonlyArray<string>；来源: ProxyRequestEnvelope.body；作用: body 只能声明编码和对应数据。
export const PROXY_BODY_KEYS = Object.freeze(['encoding', 'data']);

// 类型: Readonly<object>；来源: 公共协议第 6.4 节；作用: 所有代理错误共享固定状态、retryable 和不含敏感输入的默认消息。
export const PROXY_ERROR_DEFINITIONS = Object.freeze({
  // 协议语义: 当前服务不能消费请求声明的协议版本，客户端修改协议后才可重试。
  PROXY_PROTOCOL_UNSUPPORTED: Object.freeze({ httpStatus: 400, retryable: false, message: '代理协议版本不受支持' }),
  // 校验语义: 外壳字段、枚举、组合或容量参数不满足冻结协议。
  PROXY_VALIDATION_ERROR: Object.freeze({ httpStatus: 400, retryable: false, message: '代理请求不符合协议' }),
  // 安全语义: 目标协议、地址、解析 IP 或重定向违反访问边界。
  PROXY_TARGET_FORBIDDEN: Object.freeze({ httpStatus: 403, retryable: false, message: '目标地址不允许访问' }),
  // 配额语义: 当前部署并发或速率额度已用尽，调用方可以稍后重试。
  PROXY_RATE_LIMITED: Object.freeze({ httpStatus: 429, retryable: true, message: '代理请求超过当前额度' }),
  // 上游语义: 受控请求超过最终有效超时，重试仍须经过全部安全校验。
  PROXY_UPSTREAM_TIMEOUT: Object.freeze({ httpStatus: 504, retryable: true, message: '目标请求超时' }),
  // 容量语义: 响应流超过最终有效字节上限，不能以截断响应伪装成功。
  PROXY_RESPONSE_TOO_LARGE: Object.freeze({ httpStatus: 413, retryable: false, message: '目标响应超过容量限制' }),
  // 传输语义: DNS、连接、TLS 或上游流读取失败且没有形成合法代理响应。
  PROXY_UPSTREAM_NETWORK_ERROR: Object.freeze({ httpStatus: 502, retryable: true, message: '目标网络请求失败' }),
  // 解码语义: 上游字节不能按请求声明的响应类型转换。
  PROXY_RESPONSE_DECODE_ERROR: Object.freeze({ httpStatus: 502, retryable: false, message: '目标响应无法按声明类型解析' }),
  // 中止语义: 客户端断开或请求生命周期主动取消时，代理必须同步释放上游资源。
  PROXY_REQUEST_ABORTED: Object.freeze({ httpStatus: 499, retryable: true, message: '代理请求已中止' }),
  // 内部语义: 未分类实现错误失败关闭；响应不得携带错误栈或内部对象。
  PROXY_INTERNAL_ERROR: Object.freeze({ httpStatus: 500, retryable: false, message: '代理内部错误' })
});
