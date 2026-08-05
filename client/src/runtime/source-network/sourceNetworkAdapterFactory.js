/*
  sourceNetworkAdapterFactory.js 模块说明

  - 文件职责:
      创建生产 Runtime 唯一 ProxyClient，并返回统一 NetworkAdapter 门面。
      MockNetworkAdapter 只由测试组合直接创建，不能通过产品工厂或环境模式进入生产导入图。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      proxyClient.js#createProxyClient: 创建真实后端代理客户端。

  - 模块级常量:
      SOURCE_NETWORK_ADAPTER_OPTION_FIELDS: ReadonlyArray<string>，适配器工厂允许的选项字段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertFactoryOptions(options): 校验普通对象和允许的 ProxyClient 配置字段。

  - 模块级类:
      无

  - 对外导出:
      createSourceNetworkAdapter: function，创建唯一生产 ProxyClient NetworkAdapter。
*/

// 导入来源: ./proxyClient.js；导入内容: createProxyClient；文件作用: proxy 模式创建唯一后端协议客户端。
import { createProxyClient } from './proxyClient.js';

// 类型: ReadonlyArray<string>；来源: 适配器选择边界；作用: 拒绝回退开关、双写端口和其他未声明配置。
const SOURCE_NETWORK_ADAPTER_OPTION_FIELDS = Object.freeze([
  'proxyClientOptions'
]);

/**
 * 校验网络适配器工厂选项。
 * 纯函数: 只读取选项字段，不创建适配器或修改输入。
 * 成功路径: 返回字段精确的原选项对象。
 * 失败路径: 非普通对象或未知字段抛 TypeError，旧模式开关不能重新接入生产工厂。
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

  // 类型: Array<string|symbol>；作用: 读取全部自有键，symbol、mode 和不可枚举未知字段同样不能绕过配置边界。
  const optionKeys = Reflect.ownKeys(options);
  // 条件分支: 任一字段不属于 proxyClientOptions 时进入。
  // 执行内容: 抛 TypeError，不静默接受 fallback 或第二适配器字段。
  if (optionKeys.some(key => typeof key !== 'string' || !SOURCE_NETWORK_ADAPTER_OPTION_FIELDS.includes(key))) {
    throw new TypeError('sourceNetworkAdapter options 包含未知字段');
  }

  return options;
}

/**
 * 创建唯一生产 Source NetworkAdapter。
 * 副作用: 创建持有 endpoint/fetch 的 ProxyClient，但不会立即发送请求。
 * 成功路径: 返回只公开 request 方法的冻结 ProxyClient 适配器。
 * 失败路径: 配置或 ProxyClient 工厂失败原样抛出，不捕获并创建模拟适配器。
 *
 * @param {object} [options={}] 适配器创建选项。
 * @param {object} [options.proxyClientOptions] 传给 createProxyClient 的配置。
 * @returns {Readonly<{ request: Function }>} 唯一生产 NetworkAdapter。
 * @throws {TypeError|ProxyClientError} 选项或 ProxyClient 配置非法时抛出。
 */
export function createSourceNetworkAdapter(options = {}) {
  // 类型: object；作用: 保存已通过精确字段校验的选项引用。
  const normalizedOptions = assertFactoryOptions(options);

  // 返回值类型: Readonly<object>；作用: 生产工厂唯一创建 ProxyClient，失败原样传播且不回退 Mock。
  return createProxyClient(normalizedOptions.proxyClientOptions);
}
