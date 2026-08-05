/*
  sourceNetwork.config.js 模块说明

  - 文件职责:
      集中冻结应用 Runtime 创建 ProxyClient 时使用的生产网络选项。
      产品模块图不提供 Mock 模式开关；测试直接组合自己的 NetworkAdapter。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SOURCE_NETWORK_RUNTIME_CONFIG: Readonly<object>，应用实例使用的 ProxyClient 构造配置。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SOURCE_NETWORK_RUNTIME_CONFIG: object，应用 Runtime 实例的 ProxyClient 构造配置。
*/

// 类型: Readonly<object>；来源: Runtime 网络依赖设计；作用: 生产组合只创建 ProxyClient，并由其读取严格前端运行配置。
export const SOURCE_NETWORK_RUNTIME_CONFIG = Object.freeze({});
