/*
  source-runtime-test-fixtures.js 模块说明

  - 文件职责:
      为不依赖后端的 Runtime 领域测试显式创建独立 MockNetworkAdapter 选项。
      每次调用都返回新适配器，测试不能依赖生产默认模式或共享夹具索引实例。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      mockNetworkAdapter.js#createMockNetworkAdapter: 创建当前测试 Runtime 独占的显式模拟适配器。
      createMockSourceProvider.js#createMockSourceProviderFactory: 创建当前测试 Runtime 显式 Mock 工厂。
      source-repository-test-fixtures.js#mockSourceRepositorySeeds: 提供测试专用 Memory 种子。
      createMemorySourceRepositories.js#createMemorySourceRepositories: 创建测试独占三仓和 UnitOfWork。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      createMockSourceRuntimeOptions: function，组合 Runtime 其他选项与新 MockNetworkAdapter。
*/

// 导入来源: ../src/runtime/source-shell/mockNetworkAdapter.js。
// 导入内容: createMockNetworkAdapter 显式模拟适配器工厂。
// 文件作用: 每个领域测试 Runtime 使用独立夹具索引且不依赖应用 proxy 默认值。
import { createMockNetworkAdapter } from '../src/runtime/source-shell/mockNetworkAdapter.js';

// 导入来源: ../src/data/providers/createMockSourceProvider.js。
// 导入内容: createMockSourceProviderFactory 测试专用冻结 ProviderFactory 工厂。
// 文件作用: Runtime 测试显式注入 Mock 工厂，产品组合器不再提供默认实现。
import { createMockSourceProviderFactory } from '../src/data/providers/createMockSourceProvider.js';

// 导入来源: ./source-repository-test-fixtures.js。
// 导入内容: mockSourceRepositorySeeds 九条测试专用 Repository 保存图。
// 文件作用: 保留 Mock Provider 行为覆盖，同时与四条真实产品种子彻底隔离。
import { mockSourceRepositorySeeds } from './source-repository-test-fixtures.js';

// 导入来源: ../src/repositories/source/createMemorySourceRepositories.js；导入内容: createMemorySourceRepositories；文件作用: 显式创建测试独占 Repository 基础设施。
import { createMemorySourceRepositories } from '../src/repositories/source/createMemorySourceRepositories.js';

/**
 * 创建显式 Mock 模式的 SourceRuntime 构造选项。
 * 纯函数: 不修改 overrides；返回新选项对象和新 MockNetworkAdapter。
 * 成功路径: 保留调用方 Repository/状态/更新端口选项，缺省时创建显式 Memory 基础设施，并追加唯一 networkAdapter。
 * 失败路径: overrides 非普通对象或试图覆盖测试工具拥有的网络/工厂依赖时抛 TypeError。
 *
 * @param {object} [overrides={}] Runtime 其他构造选项。
 * @returns {object} 含独立 MockNetworkAdapter 的 Runtime 选项。
 * @throws {TypeError} 输入结构或依赖所有权不符合测试边界时抛出。
 */
export function createMockSourceRuntimeOptions(overrides = {}) {
  // 条件分支: overrides 不是原型安全普通对象时进入。
  // 执行内容: 抛 TypeError，不使用展开运算隐式转换数组或类实例。
  if (!overrides
    || typeof overrides !== 'object'
    || Array.isArray(overrides)
    || Object.getPrototypeOf(overrides) !== Object.prototype) {
    throw new TypeError('Mock SourceRuntime overrides 必须是普通对象');
  }

  // 条件分支: 调用方试图自行提供 networkAdapter 或 trustedProviderFactories 时进入。
  // 执行内容: 抛 TypeError，测试工具始终成对创建 Mock 网络和 Mock 工厂依赖。
  if (Object.hasOwn(overrides, 'networkAdapter')
    || Object.hasOwn(overrides, 'trustedProviderFactories')) {
    throw new TypeError('Mock SourceRuntime overrides 不能覆盖网络或受信任工厂依赖');
  }

  // 类型: object；作用: 调用方可显式提供 IndexedDB/可控仓，否则为当前测试创建独占 Memory 基础设施。
  const repositories = Object.hasOwn(overrides, 'repositories')
    ? overrides.repositories
    : createMemorySourceRepositories(structuredClone(mockSourceRepositorySeeds));

  // 类型: string；作用: 未显式覆盖时使用种子默认源保持既有 Runtime 测试活动身份。
  const activeSourceId = Object.hasOwn(overrides, 'activeSourceId')
    ? overrides.activeSourceId
    : mockSourceRepositorySeeds.preferences.defaultSourceId;

  // 类型: ReadonlyArray<object>；作用: 当前测试 Runtime 唯一静态工厂集合，每次调用创建独立冻结数组。
  const trustedProviderFactories = Object.freeze([createMockSourceProviderFactory()]);

  return {
    ...overrides,
    repositories,
    activeSourceId,
    networkAdapter: createMockNetworkAdapter(),
    trustedProviderFactories
  };
}
