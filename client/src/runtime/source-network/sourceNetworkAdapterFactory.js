/*
  sourceNetworkAdapterFactory.js 模块说明

  - 文件职责:
      根据唯一显式模式创建 MockNetworkAdapter 或 ProxyClient，并返回统一 NetworkAdapter 门面。
      工厂只负责一次依赖选择；适配器失败后不会创建、调用或切换另一适配器。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      sourceNetwork.config.js#SOURCE_NETWORK_MODE: 冻结允许选择的 mock/proxy 模式。
      proxyClient.js#createProxyClient: 创建真实后端代理客户端。
      mockNetworkAdapter.js#createMockNetworkAdapter: 创建显式模拟响应适配器。

  - 模块级常量:
      SOURCE_NETWORK_ADAPTER_OPTION_FIELDS: ReadonlyArray<string>，适配器工厂允许的选项字段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertFactoryOptions(options): 校验普通对象、允许字段和模式组合。

  - 模块级类:
      无

  - 对外导出:
      createSourceNetworkAdapter: function，根据显式模式创建唯一 NetworkAdapter。
*/

// 导入来源: ./sourceNetwork.config.js；导入内容: SOURCE_NETWORK_MODE；文件作用: 校验适配器模式且不复制字符串。
import { SOURCE_NETWORK_MODE } from './sourceNetwork.config.js';
// 导入来源: ./proxyClient.js；导入内容: createProxyClient；文件作用: proxy 模式创建唯一后端协议客户端。
import { createProxyClient } from './proxyClient.js';
// 导入来源: ../source-shell/mockNetworkAdapter.js；导入内容: createMockNetworkAdapter；文件作用: mock 模式创建只读夹具适配器。
import { createMockNetworkAdapter } from '../source-shell/mockNetworkAdapter.js';

// 类型: ReadonlyArray<string>；来源: 适配器选择边界；作用: 拒绝回退开关、双写端口和其他未声明配置。
const SOURCE_NETWORK_ADAPTER_OPTION_FIELDS = Object.freeze([
  'mode',
  'proxyClientOptions'
]);

/**
 * 校验网络适配器工厂选项。
 * 纯函数: 只读取选项字段，不创建适配器或修改输入。
 * 成功路径: 返回模式有效且组合明确的原选项对象。
 * 失败路径: 非普通对象、未知字段、未知模式或 Mock 携带代理选项时抛 TypeError。
 *
 * @param {*} options 适配器工厂选项候选。
 * @returns {object} 已验证选项原引用。
 * @throws {TypeError} 选项结构或模式组合不符合边界时抛出。
 */
function assertFactoryOptions(options) {
  // 条件分支: options 不是原型安全普通对象时进入。
  // 执行内容: 抛 TypeError，不对 null、数组或类实例执行字段读取。
  if (!options
    || typeof options !== 'object'
    || Array.isArray(options)
    || Object.getPrototypeOf(options) !== Object.prototype) {
    throw new TypeError('sourceNetworkAdapter options 必须是普通对象');
  }

  // 类型: Array<string|symbol>；作用: 读取全部自有键，symbol 和不可枚举未知字段同样不能绕过配置边界。
  const optionKeys = Reflect.ownKeys(options);
  // 条件分支: 任一字段不属于 mode/proxyClientOptions 时进入。
  // 执行内容: 抛 TypeError，不静默接受 fallback 或第二适配器字段。
  if (optionKeys.some(key => typeof key !== 'string' || !SOURCE_NETWORK_ADAPTER_OPTION_FIELDS.includes(key))) {
    throw new TypeError('sourceNetworkAdapter options 包含未知字段');
  }

  // 条件分支: mode 不属于冻结 mock/proxy 枚举时进入。
  // 执行内容: 抛 TypeError，不根据环境名称、sourceId 或 truthy 值猜测模式。
  if (!Object.values(SOURCE_NETWORK_MODE).includes(options.mode)) {
    throw new TypeError('sourceNetworkAdapter mode 不受支持');
  }

  // 条件分支: Mock 模式仍声明 proxyClientOptions 字段时进入。
  // 执行内容: 抛 TypeError，避免调用方误以为代理配置会参与或在失败后接管。
  if (options.mode === SOURCE_NETWORK_MODE.mock && Object.hasOwn(options, 'proxyClientOptions')) {
    throw new TypeError('Mock 模式不能声明 proxyClientOptions');
  }

  return options;
}

/**
 * 按显式模式创建唯一 Source NetworkAdapter。
 * 副作用: mock 模式创建夹具索引；proxy 模式创建持有 endpoint/fetch 的客户端，但都不会立即发送请求。
 * 成功路径: 返回只公开 request 方法的冻结适配器。
 * 失败路径: 配置或目标工厂失败原样抛出，不捕获并切换另一模式。
 *
 * @param {object} options 适配器创建选项。
 * @param {string} options.mode SOURCE_NETWORK_MODE 中的显式模式。
 * @param {object} [options.proxyClientOptions] 只在 proxy 模式传给 createProxyClient 的配置。
 * @returns {Readonly<{ request: Function }>} 当前模式唯一 NetworkAdapter。
 * @throws {TypeError|ProxyClientError} 模式或 ProxyClient 配置非法时抛出。
 */
export function createSourceNetworkAdapter(options) {
  // 类型: object；作用: 保存已通过精确字段和模式组合校验的选项引用。
  const normalizedOptions = assertFactoryOptions(options);

  // 条件分支: 显式模式为 mock 时进入。
  // 执行内容: 只创建 MockNetworkAdapter 并立即返回，不构造 ProxyClient。
  if (normalizedOptions.mode === SOURCE_NETWORK_MODE.mock) {
    return createMockNetworkAdapter();
  }

  // 返回值类型: Readonly<object>；作用: proxy 是剩余唯一合法模式，失败原样传播且不回退 Mock。
  return createProxyClient(normalizedOptions.proxyClientOptions);
}
