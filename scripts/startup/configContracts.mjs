/*
  configContracts.mjs 模块说明

  - 文件职责:
      定义三份根运行配置的版本、枚举、严格字段校验和不可变规范化投影。
      供开发启动器、前端构建配置和后端启动入口复用；不读取文件、不启动进程也不访问网络。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      APPLICATION_CONFIG_SCHEMA_VERSION: string，当前三配置共同支持的字段版本。
      APPLICATION_LOG_LEVEL: Readonly<object>，后端日志级别枚举。
      APPLICATION_LOG_FORMAT: Readonly<object>，后端日志格式枚举。
      PROJECT_SELECTION_MODE: Readonly<object>，项目启动选择方式枚举。
      PROJECT_START_TARGET: Readonly<object>，开发启动目标枚举。
      CONFIG_KEYS: Readonly<object>，每类配置对象允许的精确字段集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createConfigError(path, message): 创建带字段路径的稳定配置错误。
      assertPlainObject(value, path): 要求候选是普通对象。
      assertExactKeys(value, expectedKeys, path): 拒绝缺失或未知字段。
      assertSchemaVersion(value, path): 核对当前配置版本。
      assertBoolean(value, path): 核对布尔字段。
      assertNonEmptyString(value, path): 核对非空文本。
      assertPort(value, path): 核对 TCP 端口。
      assertSafePositiveInteger(value, path): 核对有界正整数配置。
      normalizeHttpOrigin(value, path): 规范化无路径 HTTP(S) origin。
      normalizeBasePath(value, path): 规范化前端构建基础路径。
      normalizeSafePath(value, path): 核对日志目录路径文本。
      normalizeSafeFileName(value, path): 核对日志文件名。
      validateLoggingConfig(candidate): 校验后端日志配置。
      validateProjectConfig(candidate): 校验并冻结项目启动配置。
      validateFrontendConfig(candidate): 校验并冻结前端完整配置。
      createFrontendRuntimeConfig(candidate): 从完整前端配置建立浏览器最小运行投影。
      validateBackendConfig(candidate): 校验并冻结后端结构配置。

  - 模块级类:
      ApplicationConfigError: 表示配置字段、版本或组合不满足契约的稳定错误。

  - 对外导出:
      APPLICATION_CONFIG_SCHEMA_VERSION: string，配置文件和测试共同使用的当前版本。
      APPLICATION_LOG_LEVEL: Readonly<object>，后端日志级别配置枚举。
      APPLICATION_LOG_FORMAT: Readonly<object>，后端日志格式配置枚举。
      PROJECT_SELECTION_MODE: Readonly<object>，开发启动选择枚举。
      PROJECT_START_TARGET: Readonly<object>，开发启动目标枚举。
      ApplicationConfigError: class，调用方识别配置失败使用的错误类型。
      validateProjectConfig: function，返回严格项目配置投影。
      validateFrontendConfig: function，返回严格前端配置投影。
      createFrontendRuntimeConfig: function，返回浏览器启动和 ProxyClient 共用的最小运行投影。
      validateBackendConfig: function，返回严格后端配置投影。
*/

// 类型: string；作用: 三份根配置必须共同声明该版本，避免单份配置使用不同字段语义。
export const APPLICATION_CONFIG_SCHEMA_VERSION = '2.0.0';

// 类型: Readonly<object>；作用: 三份根配置和后端日志 sink 共用稳定级别文本，拒绝 warning 等第二套命名。
export const APPLICATION_LOG_LEVEL = Object.freeze({
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error'
});

// 类型: Readonly<object>；作用: 冻结 console/file sink 唯一允许的输出格式。
export const APPLICATION_LOG_FORMAT = Object.freeze({ compact: 'compact', json: 'json' });

// 单位: 秒；作用: 防止汇总定时器被配置为超长或溢出时长，实际默认值由 backend.config.js 提供。
const MAXIMUM_LOG_SUMMARY_INTERVAL_SECONDS = 86400;

// 单位: 字节；作用: 防止单个轮转文件超过后端内存和平台文件操作安全上限。
const MAXIMUM_LOG_FILE_BYTES = 104857600;

// 单位: 个；作用: 防止轮转配置产生无界文件扫描或删除队列。
const MAXIMUM_LOG_FILES = 100;

// 单位: 跳；作用: 当前部署模型只支持与应用直接相邻的一层可信代理。
const MAXIMUM_TRUSTED_PROXY_HOPS = 1;

// 类型: Readonly<object>；作用: 冻结项目启动器允许的选择方式，拒绝自由文本形成隐式分支。
export const PROJECT_SELECTION_MODE = Object.freeze({
  // 类型: string；作用: 在交互终端显示前端、后端或全部选择菜单。
  manual: 'manual',
  // 类型: string；作用: 不询问用户，直接采用项目配置的 target。
  configured: 'configured'
});

// 类型: Readonly<object>；作用: 冻结开发编排器唯一支持的三个进程目标。
export const PROJECT_START_TARGET = Object.freeze({
  // 类型: string；作用: 只启动 Vite 前端开发服务。
  frontend: 'frontend',
  // 类型: string；作用: 只启动 Node 后端开发服务。
  backend: 'backend',
  // 类型: string；作用: 在同一开发会话中启动并管理前后端。
  all: 'all'
});

// 类型: Readonly<object>；作用: 集中声明每层配置允许的精确键，未知字段不能被静默忽略。
const CONFIG_KEYS = Object.freeze({
  // 类型: ReadonlyArray<string>；作用: 项目配置顶层只允许版本和启动偏好。
  project: Object.freeze(['schemaVersion', 'startup']),
  // 类型: ReadonlyArray<string>；作用: 项目启动偏好必须完整表达选择、目标、浏览器和失败联动。
  projectStartup: Object.freeze(['selectionMode', 'target', 'openBrowser', 'stopAllOnFailure']),
  // 类型: ReadonlyArray<string>；作用: 前端配置顶层严格分离运行时、开发服务和构建字段。
  frontend: Object.freeze(['schemaVersion', 'runtime', 'developmentServer', 'build']),
  // 类型: ReadonlyArray<string>；作用: 浏览器公开运行配置当前只允许后端 origin。
  frontendRuntime: Object.freeze(['backendOrigin']),
  // 类型: ReadonlyArray<string>；作用: Vite 开发服务必须显式声明监听、端口和漂移策略。
  frontendDevelopmentServer: Object.freeze(['host', 'port', 'strictPort']),
  // 类型: ReadonlyArray<string>；作用: 前端编译期配置当前只允许资源基础路径。
  frontendBuild: Object.freeze(['basePath']),
  // 类型: ReadonlyArray<string>；作用: 后端配置顶层严格分离版本、监听/CORS、日志和收紧限制。
  backend: Object.freeze(['schemaVersion', 'server', 'logging', 'limits']),
  // 类型: ReadonlyArray<string>；作用: 后端服务必须显式声明监听地址、端口、来源和可信代理跳数。
  backendServer: Object.freeze(['host', 'port', 'allowedOrigins', 'trustedProxyHops']),
  // 类型: ReadonlyArray<string>；作用: 日志配置严格分离 console 与 JSONL 文件 sink。
  backendLogging: Object.freeze(['console', 'file']),
  // 类型: ReadonlyArray<string>；作用: console sink 必须声明阈值、格式和汇总周期。
  backendLoggingConsole: Object.freeze(['minimumLevel', 'format', 'summaryIntervalSeconds']),
  // 类型: ReadonlyArray<string>；作用: file sink 必须声明启用、路径、阈值和轮转边界。
  backendLoggingFile: Object.freeze(['enabled', 'directory', 'baseName', 'minimumLevel', 'maximumFileBytes', 'maximumFiles'])
});

/**
 * 表示三份根运行配置不符合当前契约。
 * 使用场景: 配置加载、构建、开发编排和后端启动在产生副作用前统一失败关闭。
 * 状态所有权: 实例只保存稳定 code 和字段 path，不保存配置对象或敏感值。
 */
export class ApplicationConfigError extends Error {
  /**
   * 创建一个可定位配置字段的稳定错误。
   * 副作用: 创建 Error 实例并设置 name、code 与 path；不输出日志或修改配置。
   *
   * @param {string} path 失败字段的配置路径。
   * @param {string} message 不包含候选敏感值的失败原因。
   */
  constructor(path, message) {
    super(`${path}: ${message}`);
    this.name = 'ApplicationConfigError';
    this.code = 'APPLICATION_CONFIG_INVALID';
    this.path = path;
  }
}

/**
 * 创建稳定配置错误。
 * 纯函数: 相同路径和原因产生等价新错误，不读取或修改外部状态。
 *
 * @param {string} path 失败字段路径。
 * @param {string} message 安全失败原因。
 * @returns {ApplicationConfigError} 可向启动边界抛出的配置错误。
 */
function createConfigError(path, message) {
  return new ApplicationConfigError(path, message);
}

/**
 * 要求候选是普通对象。
 * 纯函数: 只读取类型和原型，不修改候选。
 * 失败路径: null、数组、类实例和其他非普通对象抛 ApplicationConfigError。
 *
 * @param {*} value 待校验候选。
 * @param {string} path 当前字段路径。
 * @returns {Record<string, *>} 已确认的普通对象引用。
 * @throws {ApplicationConfigError} 候选不是普通对象时抛出。
 */
function assertPlainObject(value, path) {
  // 类型: boolean；作用: 只接受 Object 原型或 null 原型对象，拒绝数组和可执行类实例。
  const isPlainObject = value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));

  // 条件分支: 候选不是普通对象时进入。
  // 执行内容: 抛稳定错误，阻止后续 Object.keys 或字段读取产生含混异常。
  if (!isPlainObject) {
    throw createConfigError(path, '必须是普通对象');
  }

  return value;
}

/**
 * 要求普通对象恰好包含允许字段。
 * 纯函数: 只比较排序后的键集合，不修改候选和期望数组。
 * 失败路径: 缺失或未知字段抛 ApplicationConfigError。
 *
 * @param {Record<string, *>} value 已确认的普通对象。
 * @param {ReadonlyArray<string>} expectedKeys 当前对象允许的精确键集合。
 * @param {string} path 当前对象路径。
 * @returns {void} 键集合完全一致时无返回值。
 * @throws {ApplicationConfigError} 键集合不一致时抛出。
 */
function assertExactKeys(value, expectedKeys, path) {
  // 类型: Array<string>；作用: 稳定排序真实键，避免声明顺序影响错误判断。
  const actualKeys = Object.keys(value).sort();
  // 类型: Array<string>；作用: 复制并排序冻结期望键，不修改契约常量。
  const sortedExpectedKeys = [...expectedKeys].sort();

  // 条件分支: 数量或任一位置不一致时进入。
  // 执行内容: 拒绝缺失和未知字段，不把拼写错误静默当成默认配置。
  if (actualKeys.length !== sortedExpectedKeys.length
    || actualKeys.some((key, index) => key !== sortedExpectedKeys[index])) {
    throw createConfigError(path, `字段必须精确为 ${expectedKeys.join(', ')}`);
  }
}

/**
 * 核对配置版本。
 * 纯函数: 只比较版本文本，不修改候选。
 * 失败路径: 版本不等于当前支持值时抛 ApplicationConfigError。
 *
 * @param {*} value 配置声明版本。
 * @param {string} path 版本字段路径。
 * @returns {string} 当前受支持版本。
 * @throws {ApplicationConfigError} 版本缺失或不兼容时抛出。
 */
function assertSchemaVersion(value, path) {
  // 条件分支: 版本不是当前唯一受支持值时进入。
  // 执行内容: 失败关闭，避免新旧字段在启动过程中混用。
  if (value !== APPLICATION_CONFIG_SCHEMA_VERSION) {
    throw createConfigError(path, `必须是 ${APPLICATION_CONFIG_SCHEMA_VERSION}`);
  }

  return value;
}

/**
 * 核对布尔配置。
 * 纯函数: 只读取候选类型，不修改外部状态。
 *
 * @param {*} value 布尔候选。
 * @param {string} path 字段路径。
 * @returns {boolean} 已确认布尔值。
 * @throws {ApplicationConfigError} 候选不是 boolean 时抛出。
 */
function assertBoolean(value, path) {
  // 条件分支: 候选不是 boolean 时进入。
  // 执行内容: 拒绝字符串 true/false 等隐式转换。
  if (typeof value !== 'boolean') {
    throw createConfigError(path, '必须是 boolean');
  }

  return value;
}

/**
 * 核对非空文本。
 * 纯函数: 返回清理首尾空白的新文本，不修改输入。
 *
 * @param {*} value 文本候选。
 * @param {string} path 字段路径。
 * @returns {string} 清理后的非空文本。
 * @throws {ApplicationConfigError} 候选不是非空字符串时抛出。
 */
function assertNonEmptyString(value, path) {
  // 条件分支: 候选不是字符串或清理后为空时进入。
  // 执行内容: 拒绝缺失监听地址和枚举文本。
  if (typeof value !== 'string' || value.trim() === '') {
    throw createConfigError(path, '必须是非空字符串');
  }

  return value.trim();
}

/**
 * 核对 TCP 端口。
 * 纯函数: 只检查整数和标准端口范围，不修改输入。
 *
 * @param {*} value 端口候选。
 * @param {string} path 字段路径。
 * @returns {number} 1 至 65535 的整数端口。
 * @throws {ApplicationConfigError} 端口无效时抛出。
 */
function assertPort(value, path) {
  // 条件分支: 端口不是标准范围内整数时进入。
  // 执行内容: 拒绝字符串、小数、零、负数和越界端口。
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw createConfigError(path, '必须是 1 至 65535 的整数');
  }

  return value;
}

/**
 * 核对具有明确上限的安全正整数。
 * 调用方: validateLoggingConfig。
 * 纯函数: 只检查类型和范围，不修改输入。
 * 失败路径: 零、负数、小数、非安全整数或超过上限时抛 ApplicationConfigError。
 *
 * @param {*} value 数值候选。
 * @param {string} path 字段路径。
 * @param {number} maximum 当前字段允许上限。
 * @returns {number} 已确认的安全正整数。
 * @throws {ApplicationConfigError} 候选不在 1 至 maximum 范围时抛出。
 */
function assertSafePositiveInteger(value, path, maximum) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw createConfigError(path, `必须是 1 至 ${maximum} 的安全整数`);
  }
  return value;
}

/**
 * 规范化无路径 HTTP(S) origin。
 * 纯函数: 使用标准 URL 解析并返回 origin，不访问网络。
 * 失败路径: 非法 URL、非 HTTP(S)、凭据、路径、查询或片段抛 ApplicationConfigError。
 *
 * @param {*} value origin 候选。
 * @param {string} path 字段路径。
 * @returns {string} 标准化 origin。
 * @throws {ApplicationConfigError} 候选不是纯 HTTP(S) origin 时抛出。
 */
function normalizeHttpOrigin(value, path) {
  // 类型: string；作用: 先执行非空字符串校验，避免 URL 把其他类型隐式转换。
  const text = assertNonEmptyString(value, path);
  // 类型: URL|undefined；作用: 保存标准 URL 解析结果供精确边界判断。
  let parsedUrl;

  try {
    parsedUrl = new URL(text);
  } catch (error) {
    // 异常来源: 标准 URL 解析拒绝非法地址。
    // 处理策略: 转换为不回显完整候选的稳定配置错误。
    throw createConfigError(path, '必须是有效 HTTP(S) origin');
  }

  // 条件分支: 地址不是纯 HTTP(S) origin 或携带凭据、路径、查询、片段时进入。
  // 执行内容: 拒绝把代理路径或秘密混入部署 origin。
  if (!['http:', 'https:'].includes(parsedUrl.protocol)
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.pathname !== '/'
    || parsedUrl.search
    || parsedUrl.hash) {
    throw createConfigError(path, '必须是无路径、无凭据的 HTTP(S) origin');
  }

  return parsedUrl.origin;
}

/**
 * 规范化 Vite 构建基础路径。
 * 纯函数: 只检查路径文本并返回原规范值，不读取文件系统。
 * 失败路径: 不是以单斜杠起止的纯路径时抛 ApplicationConfigError。
 *
 * @param {*} value 构建基础路径候选。
 * @param {string} path 字段路径。
 * @returns {string} 以 / 开头和结尾的基础路径。
 * @throws {ApplicationConfigError} 路径格式无效时抛出。
 */
function normalizeBasePath(value, path) {
  // 类型: string；作用: 拒绝非字符串并清理无意义外部空白。
  const text = assertNonEmptyString(value, path);

  // 条件分支: 路径不是单斜杠根路径或规范子路径时进入。
  // 执行内容: 拒绝完整 URL、反斜杠、查询、片段和重复斜杠。
  if (!text.startsWith('/')
    || !text.endsWith('/')
    || text.includes('\\')
    || text.includes('?')
    || text.includes('#')
    || text.slice(1).includes('//')) {
    throw createConfigError(path, '必须是以 / 开头和结尾的规范路径');
  }

  return text;
}

/**
 * 核对日志目录路径文本不含控制字符。
 * 调用方: validateLoggingConfig。
 * 纯函数: 清理外部空白并返回原平台路径语义，不访问文件系统或解析相对基准。
 * 失败路径: 空值、NUL 或其他控制字符抛 ApplicationConfigError。
 *
 * @param {*} value 日志目录候选。
 * @param {string} path 字段路径。
 * @returns {string} 可由后端组合根相对仓库根解析的目录文本。
 * @throws {ApplicationConfigError} 路径文本不安全时抛出。
 */
function normalizeSafePath(value, path) {
  // 类型: string；作用: 复用非空校验并保留 Windows/Posix 路径分隔语义。
  const text = assertNonEmptyString(value, path);
  if (/[\u0000-\u001f\u007f]/u.test(text)) {
    throw createConfigError(path, '不能包含控制字符');
  }
  return text;
}

/**
 * 核对日志基名是单一安全文件名。
 * 调用方: validateLoggingConfig。
 * 纯函数: 只检查文本，不访问或创建目标文件。
 * 失败路径: 路径分隔符、父目录、控制字符或不安全字符抛 ApplicationConfigError。
 *
 * @param {*} value 日志文件基名候选。
 * @param {string} path 字段路径。
 * @returns {string} 只含字母、数字、点、下划线和连字符的文件名。
 * @throws {ApplicationConfigError} 候选不是单一安全文件名时抛出。
 */
function normalizeSafeFileName(value, path) {
  const text = assertNonEmptyString(value, path);
  if (text === '.' || text === '..' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(text)) {
    throw createConfigError(path, '必须是单一安全文件名');
  }
  return text;
}

/**
 * 校验并冻结后端 console 与文件日志配置。
 * 调用方: validateBackendConfig。
 * 纯函数: 返回深层冻结投影，不访问目录、不创建文件也不修改候选。
 * 失败路径: 字段、级别、格式、路径、容量或文件数量不满足契约时抛 ApplicationConfigError。
 *
 * @param {*} candidate backendConfig.logging 候选。
 * @returns {Readonly<object>} console 与 file 两个冻结配置分区。
 * @throws {ApplicationConfigError} 任一日志字段非法时抛出。
 */
function validateLoggingConfig(candidate) {
  const logging = assertPlainObject(candidate, 'backendConfig.logging');
  assertExactKeys(logging, CONFIG_KEYS.backendLogging, 'backendConfig.logging');
  const consoleConfig = assertPlainObject(logging.console, 'backendConfig.logging.console');
  const fileConfig = assertPlainObject(logging.file, 'backendConfig.logging.file');
  assertExactKeys(consoleConfig, CONFIG_KEYS.backendLoggingConsole, 'backendConfig.logging.console');
  assertExactKeys(fileConfig, CONFIG_KEYS.backendLoggingFile, 'backendConfig.logging.file');

  // 类型: string；作用: console 和 file 阈值都必须来自同一冻结级别枚举。
  const consoleMinimumLevel = assertNonEmptyString(consoleConfig.minimumLevel, 'backendConfig.logging.console.minimumLevel');
  const fileMinimumLevel = assertNonEmptyString(fileConfig.minimumLevel, 'backendConfig.logging.file.minimumLevel');
  // 类型: string；作用: console 表现形式只允许 compact 或完整 JSON。
  const consoleFormat = assertNonEmptyString(consoleConfig.format, 'backendConfig.logging.console.format');
  if (!Object.values(APPLICATION_LOG_LEVEL).includes(consoleMinimumLevel)) {
    throw createConfigError('backendConfig.logging.console.minimumLevel', '必须是 debug、info、warn 或 error');
  }
  if (!Object.values(APPLICATION_LOG_LEVEL).includes(fileMinimumLevel)) {
    throw createConfigError('backendConfig.logging.file.minimumLevel', '必须是 debug、info、warn 或 error');
  }
  if (!Object.values(APPLICATION_LOG_FORMAT).includes(consoleFormat)) {
    throw createConfigError('backendConfig.logging.console.format', '必须是 compact 或 json');
  }

  // 类型: number；作用: 文件数量至少包含当前文件和一个历史文件，避免配置成无法轮转。
  const maximumFiles = assertSafePositiveInteger(
    fileConfig.maximumFiles,
    'backendConfig.logging.file.maximumFiles',
    MAXIMUM_LOG_FILES
  );
  if (maximumFiles < 2) {
    throw createConfigError('backendConfig.logging.file.maximumFiles', '必须至少为 2');
  }

  return Object.freeze({
    console: Object.freeze({
      minimumLevel: consoleMinimumLevel,
      format: consoleFormat,
      summaryIntervalSeconds: assertSafePositiveInteger(
        consoleConfig.summaryIntervalSeconds,
        'backendConfig.logging.console.summaryIntervalSeconds',
        MAXIMUM_LOG_SUMMARY_INTERVAL_SECONDS
      )
    }),
    file: Object.freeze({
      enabled: assertBoolean(fileConfig.enabled, 'backendConfig.logging.file.enabled'),
      directory: normalizeSafePath(fileConfig.directory, 'backendConfig.logging.file.directory'),
      baseName: normalizeSafeFileName(fileConfig.baseName, 'backendConfig.logging.file.baseName'),
      minimumLevel: fileMinimumLevel,
      maximumFileBytes: assertSafePositiveInteger(
        fileConfig.maximumFileBytes,
        'backendConfig.logging.file.maximumFileBytes',
        MAXIMUM_LOG_FILE_BYTES
      ),
      maximumFiles
    })
  });
}

/**
 * 校验并冻结项目启动配置。
 * 纯函数: 返回新冻结投影，不修改候选。
 * 失败路径: 对象形状、版本、枚举或布尔字段非法时抛 ApplicationConfigError。
 *
 * @param {*} candidate 项目配置候选。
 * @returns {Readonly<object>} 严格项目配置投影。
 * @throws {ApplicationConfigError} 任一字段不满足契约时抛出。
 */
export function validateProjectConfig(candidate) {
  // 类型: Record<string, *>；作用: 冻结前先确认项目配置是普通对象。
  const config = assertPlainObject(candidate, 'projectConfig');
  assertExactKeys(config, CONFIG_KEYS.project, 'projectConfig');
  // 类型: Record<string, *>；作用: 单独校验开发启动偏好，不允许与连接参数混放。
  const startup = assertPlainObject(config.startup, 'projectConfig.startup');
  assertExactKeys(startup, CONFIG_KEYS.projectStartup, 'projectConfig.startup');
  // 类型: string；作用: 清理并核对启动选择枚举。
  const selectionMode = assertNonEmptyString(startup.selectionMode, 'projectConfig.startup.selectionMode');
  // 类型: string；作用: 清理并核对启动目标枚举。
  const target = assertNonEmptyString(startup.target, 'projectConfig.startup.target');

  // 条件分支: 选择方式不属于冻结枚举时进入。
  // 执行内容: 拒绝未知交互模式，避免启动器自行猜测。
  if (!Object.values(PROJECT_SELECTION_MODE).includes(selectionMode)) {
    throw createConfigError('projectConfig.startup.selectionMode', '必须是 manual 或 configured');
  }

  // 条件分支: 启动目标不属于冻结枚举时进入。
  // 执行内容: 拒绝未知进程组合。
  if (!Object.values(PROJECT_START_TARGET).includes(target)) {
    throw createConfigError('projectConfig.startup.target', '必须是 frontend、backend 或 all');
  }

  return Object.freeze({
    schemaVersion: assertSchemaVersion(config.schemaVersion, 'projectConfig.schemaVersion'),
    startup: Object.freeze({
      selectionMode,
      target,
      openBrowser: assertBoolean(startup.openBrowser, 'projectConfig.startup.openBrowser'),
      stopAllOnFailure: assertBoolean(startup.stopAllOnFailure, 'projectConfig.startup.stopAllOnFailure')
    })
  });
}

/**
 * 校验并冻结前端完整配置。
 * 纯函数: 返回运行时、开发服务和构建分区的新冻结投影，不修改候选。
 * 失败路径: 字段、origin、监听或基础路径非法时抛 ApplicationConfigError。
 *
 * @param {*} candidate 前端配置候选。
 * @returns {Readonly<object>} 严格前端配置投影。
 * @throws {ApplicationConfigError} 任一字段不满足契约时抛出。
 */
export function validateFrontendConfig(candidate) {
  // 类型: Record<string, *>；作用: 确认前端顶层对象并拒绝未知分区。
  const config = assertPlainObject(candidate, 'frontendConfig');
  assertExactKeys(config, CONFIG_KEYS.frontend, 'frontendConfig');
  // 类型: Record<string, *>；作用: 保存浏览器公开运行字段候选。
  const runtime = assertPlainObject(config.runtime, 'frontendConfig.runtime');
  // 类型: Record<string, *>；作用: 保存 Vite 开发服务字段候选。
  const developmentServer = assertPlainObject(config.developmentServer, 'frontendConfig.developmentServer');
  // 类型: Record<string, *>；作用: 保存生产构建字段候选。
  const build = assertPlainObject(config.build, 'frontendConfig.build');
  assertExactKeys(runtime, CONFIG_KEYS.frontendRuntime, 'frontendConfig.runtime');
  assertExactKeys(developmentServer, CONFIG_KEYS.frontendDevelopmentServer, 'frontendConfig.developmentServer');
  assertExactKeys(build, CONFIG_KEYS.frontendBuild, 'frontendConfig.build');

  return Object.freeze({
    schemaVersion: assertSchemaVersion(config.schemaVersion, 'frontendConfig.schemaVersion'),
    runtime: Object.freeze({
      backendOrigin: normalizeHttpOrigin(runtime.backendOrigin, 'frontendConfig.runtime.backendOrigin')
    }),
    developmentServer: Object.freeze({
      host: assertNonEmptyString(developmentServer.host, 'frontendConfig.developmentServer.host'),
      port: assertPort(developmentServer.port, 'frontendConfig.developmentServer.port'),
      strictPort: assertBoolean(developmentServer.strictPort, 'frontendConfig.developmentServer.strictPort')
    }),
    build: Object.freeze({
      basePath: normalizeBasePath(build.basePath, 'frontendConfig.build.basePath')
    })
  });
}

/**
 * 从完整前端配置建立浏览器最小运行投影。
 * 纯函数: 先复用完整 FrontendConfig 严格校验，再返回不含开发服务器和构建字段的新冻结对象。
 * 成功路径: 返回 schemaVersion 与规范化 backendOrigin，供浏览器启动屏障采用。
 * 失败路径: 完整配置任一字段缺失、未知或非法时原样抛 ApplicationConfigError，不只校验 runtime 后忽略公开文件漂移。
 * 安全边界: 返回对象不包含 developmentServer、build、Cookie、Token 或后端安全策略。
 *
 * @param {*} candidate 外部配置脚本发布的完整 FrontendConfig 候选。
 * @returns {Readonly<object>} 浏览器启动和 ProxyClient 使用的 FrontendRuntimeConfig。
 * @throws {ApplicationConfigError} 完整前端配置不符合当前契约时抛出。
 */
export function createFrontendRuntimeConfig(candidate) {
  // 类型: Readonly<object>；作用: 复用唯一完整契约，避免浏览器维护一份宽松字段规则。
  const frontendConfig = validateFrontendConfig(candidate);

  return Object.freeze({
    // 类型: string；作用: 保留运行投影使用的字段语义版本，供诊断和后续迁移判断。
    schemaVersion: frontendConfig.schemaVersion,
    // 类型: string；作用: 向 ProxyClient 提供当前页面启动时采用的唯一后端 origin。
    backendOrigin: frontendConfig.runtime.backendOrigin
  });
}

/**
 * 校验并冻结后端结构配置。
 * 纯函数: 返回监听、允许来源和正整数限制的新冻结投影，不修改候选。
 * 失败路径: 字段、端口、来源、重复项或限制值非法时抛 ApplicationConfigError；限制键和硬上限由后端策略层继续核对。
 *
 * @param {*} candidate 后端配置候选。
 * @returns {Readonly<object>} 严格后端结构配置投影。
 * @throws {ApplicationConfigError} 任一结构字段不满足契约时抛出。
 */
export function validateBackendConfig(candidate) {
  // 类型: Record<string, *>；作用: 确认后端顶层对象并拒绝未知分区。
  const config = assertPlainObject(candidate, 'backendConfig');
  assertExactKeys(config, CONFIG_KEYS.backend, 'backendConfig');
  // 类型: Record<string, *>；作用: 保存后端监听与 CORS 候选。
  const server = assertPlainObject(config.server, 'backendConfig.server');
  // 类型: Readonly<object>；作用: 在策略映射前完成 console、文件和轮转配置严格校验。
  const logging = validateLoggingConfig(config.logging);
  // 类型: Record<string, *>；作用: 保存可选收紧限制候选，键集合由后端 HARD_LIMITS 决定。
  const limits = assertPlainObject(config.limits, 'backendConfig.limits');
  assertExactKeys(server, CONFIG_KEYS.backendServer, 'backendConfig.server');

  // 条件分支: allowedOrigins 不是非空数组时进入。
  // 执行内容: 拒绝空准入和任意类型候选。
  if (!Array.isArray(server.allowedOrigins) || server.allowedOrigins.length === 0) {
    throw createConfigError('backendConfig.server.allowedOrigins', '必须是非空 origin 数组');
  }

  // 类型: Array<string>；作用: 逐项规范化浏览器来源，后续执行重复检查并冻结。
  const allowedOrigins = server.allowedOrigins.map((origin, index) => (
    normalizeHttpOrigin(origin, `backendConfig.server.allowedOrigins[${index}]`)
  ));

  // 条件分支: 规范化后存在重复来源时进入。
  // 执行内容: 拒绝看似多项但实际相同的 CORS 配置。
  if (new Set(allowedOrigins).size !== allowedOrigins.length) {
    throw createConfigError('backendConfig.server.allowedOrigins', '不能包含重复 origin');
  }

  // 类型: number；作用: 当前后端只允许不信任转发头或信任一个直接相邻代理。
  const trustedProxyHops = server.trustedProxyHops;
  if (!Number.isSafeInteger(trustedProxyHops)
    || trustedProxyHops < 0
    || trustedProxyHops > MAXIMUM_TRUSTED_PROXY_HOPS) {
    throw createConfigError(
      'backendConfig.server.trustedProxyHops',
      `必须是 0 至 ${MAXIMUM_TRUSTED_PROXY_HOPS} 的安全整数`
    );
  }

  // 类型: object；作用: 把每个部署限制转换为冻结正整数投影，不在公共层复制后端硬上限。
  const normalizedLimits = Object.fromEntries(Object.entries(limits).map(([key, value]) => {
    // 条件分支: 限制键不是非空文本时进入。
    // 执行内容: 拒绝无法由后端策略识别的空键。
    if (key.trim() === '') {
      throw createConfigError('backendConfig.limits', '限制键不能为空');
    }

    // 条件分支: 限制值不是安全正整数时进入。
    // 执行内容: 拒绝字符串、零、负数、小数和溢出值。
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw createConfigError(`backendConfig.limits.${key}`, '必须是安全正整数');
    }

    return [key, value];
  }));

  return Object.freeze({
    schemaVersion: assertSchemaVersion(config.schemaVersion, 'backendConfig.schemaVersion'),
    server: Object.freeze({
      host: assertNonEmptyString(server.host, 'backendConfig.server.host'),
      port: assertPort(server.port, 'backendConfig.server.port'),
      allowedOrigins: Object.freeze(allowedOrigins),
      trustedProxyHops
    }),
    logging,
    limits: Object.freeze(normalizedLimits)
  });
}
