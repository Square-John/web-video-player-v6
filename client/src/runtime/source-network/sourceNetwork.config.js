/*
  sourceNetwork.config.js 模块说明

  - 文件职责:
      集中冻结应用 Runtime 的网络适配器模式，并读取唯一 Vite 模式配置。
      默认应用模式是 proxy；Mock 只能通过显式环境值或测试工厂选择。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SOURCE_NETWORK_MODE: Readonly<object>，Runtime 支持的 mock/proxy 模式枚举。
      configuredNetworkMode: string，Vite 环境声明或默认 proxy 模式。
      SOURCE_NETWORK_RUNTIME_CONFIG: Readonly<object>，应用实例使用的显式模式配置。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SOURCE_NETWORK_MODE: object，适配器工厂和测试共用的模式枚举。
      SOURCE_NETWORK_RUNTIME_CONFIG: object，应用 Runtime 实例的显式网络配置。
*/

// 类型: Readonly<object>；来源: Runtime 网络依赖设计；作用: 禁止用 Boolean、站点名称或 sourceId 隐式选择适配器。
export const SOURCE_NETWORK_MODE = Object.freeze({
  // 类型: string；作用: 显式选择只读取受审本地响应夹具的 MockNetworkAdapter。
  mock: 'mock',

  // 类型: string；作用: 显式选择通过后端公共协议发送请求的 ProxyClient。
  proxy: 'proxy'
});

// 类型: string；来源: VITE_SOURCE_NETWORK_MODE 或应用默认；作用: 生产和联调默认走代理，Mock 必须由调用方明确声明。
const configuredNetworkMode = import.meta.env?.VITE_SOURCE_NETWORK_MODE || SOURCE_NETWORK_MODE.proxy;

// 类型: Readonly<object>；来源: 集中模式配置；作用: sourceRuntimeInstance 不在组合点读取环境或散落模式字符串。
export const SOURCE_NETWORK_RUNTIME_CONFIG = Object.freeze({
  mode: configuredNetworkMode
});
