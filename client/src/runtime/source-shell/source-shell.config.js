/*
  source-shell.config.js 模块说明

  - 文件职责:
      集中冻结 Source Shell 网络、挑战、日志和容量策略，避免各能力模块散落魔法字符串或数字。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SOURCE_NETWORK_METHOD: object，允许的标准网络方法枚举。
      SOURCE_NETWORK_BODY_ENCODING: object，允许的请求体运输编码枚举。
      SOURCE_CHALLENGE_STATUS: object，挑战完成、取消和不支持结果枚举。
      SOURCE_CHALLENGE_FIELD_TYPE: object，挑战输入控件类型枚举。
      SOURCE_LOG_LEVEL: object，受控日志级别枚举。
      SOURCE_NETWORK_POLICY: object，网络字段和容量边界。
      SOURCE_LOGGER_POLICY: object，日志条数、消息和详情容量边界。
      SOURCE_SENSITIVE_KEYS: Array<string>，网络和日志递归脱敏键集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SOURCE_NETWORK_METHOD、SOURCE_NETWORK_BODY_ENCODING、SOURCE_CHALLENGE_STATUS、SOURCE_CHALLENGE_FIELD_TYPE、SOURCE_LOG_LEVEL: object，Shell 稳定枚举。
      SOURCE_NETWORK_POLICY、SOURCE_LOGGER_POLICY: object，Shell 集中策略。
      SOURCE_SENSITIVE_KEYS: Array<string>，只读敏感键集合。
*/

// 类型: object。
// 作用: 限定当前 Shell 支持的网络方法；MockNetworkAdapter 和未来 ProxyClient 必须消费同一枚举。
export const SOURCE_NETWORK_METHOD = Object.freeze({
  // 类型: string。
  // 作用: 标识不携带业务请求体的读取请求。
  get: 'GET',

  // 类型: string。
  // 作用: 标识可以提交 none、UTF-8 或 base64 原始请求体的请求。
  post: 'POST'
});

// 类型: object。
// 作用: 限定 Provider 可以声明的请求体运输编码；响应始终返回原始 ArrayBuffer，不再由 Shell 选择解码类型。
export const SOURCE_NETWORK_BODY_ENCODING = Object.freeze({
  // 类型: string。
  // 作用: 表示请求没有正文，data 必须为 null。
  none: 'none',

  // 类型: string。
  // 作用: 表示 data 字符串按 UTF-8 原始字节发送。
  utf8: 'utf8',

  // 类型: string。
  // 作用: 表示 data 是待还原为原始请求字节的标准 base64。
  base64: 'base64'
});

// 类型: object。
// 作用: 冻结挑战协调器可返回的三种稳定结果，Provider 不能使用布尔值猜测交互结论。
export const SOURCE_CHALLENGE_STATUS = Object.freeze({
  // 类型: string。
  // 作用: 表示用户已经提交并通过字段契约校验，values 可以恢复原 Provider 请求。
  resolved: 'resolved',

  // 类型: string。
  // 作用: 表示当前前端尚未实现该挑战交互。
  unsupported: 'unsupported',

  // 类型: string。
  // 作用: 表示生命周期已经中止或挑战被取消。
  cancelled: 'cancelled'
});

// 类型: object。
// 作用: 限定根级挑战弹窗可以渲染的输入类型，防止 Provider 注入任意页面控件。
export const SOURCE_CHALLENGE_FIELD_TYPE = Object.freeze({
  // 类型: string；作用: 收集普通可见字符串，例如验证码。
  text: 'text',
  // 类型: string；作用: 收集需要遮挡显示的字符串，例如登录密码。
  password: 'password'
});

// 类型: object。
// 作用: 冻结 Provider 可以使用的四个日志级别，页面不能依赖日志文案决定业务状态。
export const SOURCE_LOG_LEVEL = Object.freeze({
  // 类型: string。
  // 作用: 记录开发诊断摘要。
  debug: 'debug',

  // 类型: string。
  // 作用: 记录正常关键运行节点。
  info: 'info',

  // 类型: string。
  // 作用: 记录可恢复异常或降级结果。
  warn: 'warn',

  // 类型: string。
  // 作用: 记录失败摘要，不保存敏感原值。
  error: 'error'
});

// 类型: object。
// 作用: 集中定义网络请求字段和容量边界，所有调用点通过字段读取而不是复制数字。
export const SOURCE_NETWORK_POLICY = Object.freeze({
  // 类型: number。
  // 作用: 允许的最小超时毫秒数，避免零值或负值进入未来网络层。
  minTimeoutMs: 100,

  // 类型: number。
  // 作用: 允许的最大超时毫秒数，限制 Provider 长时间占用网络能力。
  maxTimeoutMs: 30000,

  // 类型: number。
  // 作用: 允许 Provider 声明的最小响应字节上限。
  minResponseBytes: 1,

  // 类型: number。
  // 作用: 允许 Provider 声明的最大响应字节上限，当前为 2 MiB。
  maxResponseBytes: 2097152,

  // 类型: number。
  // 作用: 限制 URL 字符数量，避免异常大输入进入路由键和日志。
  maxUrlLength: 2048,

  // 类型: number。
  // 作用: 限制单次请求头字段数量。
  maxHeaderCount: 64,

  // 类型: number。
  // 作用: 限制规范化请求头 JSON 字节数。
  maxHeaderBytes: 16384,

  // 类型: number。
  // 作用: 限制字符串或 JSON 请求体字节数，当前为 256 KiB。
  maxRequestBodyBytes: 262144
});

// 类型: object。
// 作用: 集中定义 SourceLogger 有界内存和单项容量策略。
export const SOURCE_LOGGER_POLICY = Object.freeze({
  // 类型: number。
  // 作用: 单个 SourceLogger 最多保留的最新日志条数。
  maxEntries: 100,

  // 类型: number。
  // 作用: 单条日志消息允许的最大字符数量。
  maxMessageLength: 500,

  // 类型: number。
  // 作用: 单条日志 details 脱敏后允许的最大 JSON 字节数。
  maxDetailsBytes: 16384
});

// 类型: Array<string>。
// 作用: 网络头和日志详情执行大小写无关递归脱敏的敏感键集合。
export const SOURCE_SENSITIVE_KEYS = Object.freeze([
  // 类型: string。
  // 作用: 匹配标准 Authorization 请求头，避免 Basic、Bearer 等认证值进入日志。
  'authorization',

  // 类型: string。
  // 作用: 匹配请求 Cookie 字段，避免浏览器或源站会话标识进入日志。
  'cookie',

  // 类型: string。
  // 作用: 匹配响应 Set-Cookie 字段，避免新会话凭据进入日志详情。
  'set-cookie',

  // 类型: string。
  // 作用: 匹配通用 token 字段，覆盖数据源自定义认证对象中的令牌值。
  'token',

  // 类型: string。
  // 作用: 匹配访问令牌字段，避免短期访问凭据泄露。
  'access-token',

  // 类型: string。
  // 作用: 匹配刷新令牌字段，避免长期续期凭据泄露。
  'refresh-token',

  // 类型: string。
  // 作用: 匹配密码字段，避免用户挑战输入或源站登录值进入日志。
  'password',

  // 类型: string。
  // 作用: 匹配通用 secret 字段，覆盖数据源私有密钥命名。
  'secret',

  // 类型: string。
  // 作用: 匹配 API key 字段，避免第三方接口访问密钥进入诊断记录。
  'api-key'
]);
