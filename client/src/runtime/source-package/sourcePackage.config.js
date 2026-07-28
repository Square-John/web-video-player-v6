/*
  sourcePackage.config.js 模块说明

  - 文件职责:
      集中冻结单文件 Provider 三入口读取、静态预检、信任和执行使用的版本、容量、网络与语法策略。
      供输入读取器、manifest 解析器、模块执行器和加载器共享；页面和 Provider 不复制这些数值或枚举。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      SOURCE_SCRIPT_INTEGRITY_ALGORITHM: 自定义领域配置，统一 Package、授权和加载器摘要算法名称。

  - 模块级常量:
      SOURCE_PACKAGE_POLICY: object，单文件编码、容量、远程请求、兼容 ABI 和完整性策略。
      SOURCE_PACKAGE_LOAD_STAGE: object，读取到补偿的稳定阶段枚举。
      SOURCE_PACKAGE_ERROR_CODE: object，页面可识别的稳定加载错误码。
      SOURCE_PACKAGE_MODULE_EXPORTS: Array<string>，模块允许的精确导出集合。
      SOURCE_MANIFEST_FIELDS: Array<string>，manifest 顶层精确字段集合。
      SOURCE_MANIFEST_CAPABILITY_FIELDS: Array<string>，六类页面能力精确字段集合。
      SOURCE_PACKAGE_FORBIDDEN_GLOBALS: Array<string>，无沙盒阶段静态拒绝的越权全局能力。
      SOURCE_PACKAGE_REMOTE_CONTENT_TYPES: Array<string>，远程脚本文本允许的媒体类型。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SOURCE_PACKAGE_POLICY、SOURCE_PACKAGE_LOAD_STAGE、SOURCE_PACKAGE_ERROR_CODE、SOURCE_PACKAGE_MODULE_EXPORTS、SOURCE_MANIFEST_FIELDS、SOURCE_MANIFEST_CAPABILITY_FIELDS、SOURCE_PACKAGE_FORBIDDEN_GLOBALS、SOURCE_PACKAGE_REMOTE_CONTENT_TYPES: 冻结配置和枚举。
*/

// 导入来源: ../../config/source-manager.config.js。
// 导入内容: SOURCE_SCRIPT_INTEGRITY_ALGORITHM 数据源脚本完整性算法。
// 文件作用: 单文件载荷与 SourceManager 保存图使用同一 SHA-256 名称。
import { SOURCE_SCRIPT_INTEGRITY_ALGORITHM } from '../../config/source-manager.config.js';

// 类型: object。
// 作用: 集中定义三入口共用的编码、容量、远程请求和版本边界，禁止组件散落相同字面值。
export const SOURCE_PACKAGE_POLICY = Object.freeze({
  // 类型: string；作用: manifest、Provider ABI 和 SourcePackage 保存对象当前共同接受的精确版本。
  schemaVersion: '1.0.0',
  // 类型: string；作用: 当前 Host 唯一 Provider ABI，网络能力固定返回原始 ArrayBuffer。
  providerApiVersion: '2.0.0',
  // 类型: Array<string>；作用: Host 只接受 2.0.0；1.x 保存包保留但不得通过别名或隐式转换执行。
  supportedProviderApiVersions: Object.freeze(['2.0.0']),
  // 类型: string；作用: 文件、远程响应和粘贴文本统一采用 UTF-8 字节语义。
  textEncoding: 'utf-8',
  // 类型: number；作用: 规范化脚本文本最大 1 MiB，读取器和远程请求共用同一上限。
  maxScriptBytes: 1048576,
  // 类型: string；作用: 动态单文件完整性和授权快照统一使用 SHA-256。
  integrityAlgorithm: SOURCE_SCRIPT_INTEGRITY_ALGORITHM,
  // 类型: string；作用: 远程入口只允许 HTTPS，不接受 HTTP、data、file 或 javascript。
  remoteProtocol: 'https:',
  // 类型: number；作用: 远程脚本读取最多等待十秒，不由页面或脚本提高。
  remoteTimeoutMs: 10000,
  // 类型: string；作用: 未安装数据源的远程导入请求使用固定诊断身份，后端不据此分流。
  remoteImportSourceId: 'source.package-import',
  // 类型: string；作用: 远程导入请求 id 使用单调序号前缀，不采用随机数或时间戳。
  remoteRequestIdPrefix: 'source-package-read-'
});

// 类型: object。
// 作用: 固定加载错误所处阶段，页面和补偿逻辑不能解析中文 message 判断进度。
export const SOURCE_PACKAGE_LOAD_STAGE = Object.freeze({
  read: 'read',
  normalize: 'normalize',
  parse: 'parse',
  validate: 'validate',
  trust: 'trust',
  execute: 'execute',
  factory: 'factory',
  register: 'register',
  persist: 'persist',
  start: 'start',
  rollback: 'rollback'
});

// 类型: object。
// 作用: 固定导入和加载失败分类，调用方只依赖 code，不依赖易变文案。
export const SOURCE_PACKAGE_ERROR_CODE = Object.freeze({
  parse: 'SOURCE_PACKAGE_PARSE_ERROR',
  tooLarge: 'SOURCE_PACKAGE_TOO_LARGE',
  manifestInvalid: 'SOURCE_PACKAGE_MANIFEST_INVALID',
  moduleInvalid: 'SOURCE_PACKAGE_MODULE_INVALID',
  trustRequired: 'SOURCE_PACKAGE_TRUST_REQUIRED',
  load: 'SOURCE_PACKAGE_LOAD_ERROR',
  factoryInvalid: 'SOURCE_PACKAGE_FACTORY_INVALID',
  registrationConflict: 'SOURCE_PACKAGE_REGISTRATION_CONFLICT',
  remote: 'SOURCE_PACKAGE_REMOTE_ERROR'
});

// 类型: Array<string>。
// 作用: 模块命名空间只允许静态 manifest 和工厂创建函数，不接受第三个兼容导出。
export const SOURCE_PACKAGE_MODULE_EXPORTS = Object.freeze([
  'sourceManifest',
  'createProviderFactory'
]);

// 类型: Array<string>。
// 作用: manifest 顶层必须完整且没有额外字段，字段顺序不作为业务语义。
export const SOURCE_MANIFEST_FIELDS = Object.freeze([
  'schemaVersion',
  'providerApiVersion',
  'id',
  'name',
  'description',
  'version',
  'providerKey',
  'capabilities',
  'settingsSchema',
  'networkHosts'
]);

// 类型: Array<string>。
// 作用: Definition 和页面只接受六类冻结能力，缺失或额外能力都在执行前失败。
export const SOURCE_MANIFEST_CAPABILITY_FIELDS = Object.freeze([
  'home',
  'movie',
  'tv',
  'search',
  'detail',
  'play'
]);

// 类型: Array<string>。
// 作用: 无沙盒阶段在信任前拒绝直接网络、DOM、浏览器存储、代码执行和并行宿主能力。
export const SOURCE_PACKAGE_FORBIDDEN_GLOBALS = Object.freeze([
  'window',
  'document',
  'globalThis',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'eval',
  'Function',
  'Worker',
  'SharedWorker',
  'DOMParser'
]);

// 类型: Array<string>。
// 作用: 远程入口只接受 JavaScript 或明确文本媒体类型；参数在比较前由读取器移除。
export const SOURCE_PACKAGE_REMOTE_CONTENT_TYPES = Object.freeze([
  'text/javascript',
  'application/javascript',
  'application/ecmascript',
  'text/ecmascript',
  'text/plain'
]);
