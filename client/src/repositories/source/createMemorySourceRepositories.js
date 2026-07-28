/*
  createMemorySourceRepositories.js 模块说明

  - 文件职责:
      根据调用方显式传入的分离种子装配三个 Memory Repository 和 FIFO Unit of Work。
      供 SourceManager 和其他初始化适配器使用，不导入页面数据、默认种子或数据层文件。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      SourceRepositoryValidationError: 自定义错误，报告工厂种子顶层结构不完整。
      assertPlainObject: 自定义校验函数，校验工厂种子、Preferences 和 Storage 根对象。
      MemorySourcePackageRepository: 自定义服务，脚本包内存仓。
      MemorySourceDefinitionRepository: 自定义服务，Definition/Preferences 内存仓。
      MemorySourceStorageRepository: 自定义服务，私有空间内存仓。
      MemorySourceRepositoryUnitOfWork: 自定义服务，FIFO 跨仓事务协调器。

  - 模块级常量:
      MEMORY_REPOSITORY_SEED_KEYS: Array<string>，工厂要求的四个顶层种子字段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      validateMemoryRepositorySeeds(seeds): 校验显式工厂种子顶层结构和基础容器类型。

  - 模块级类:
      无

  - 对外导出:
      createMemorySourceRepositories: Function，根据显式 seeds 创建完整 Memory Repository 基础设施。
*/

// 导入来源: ./sourceRepositoryErrors.js。
// 导入内容: SourceRepositoryValidationError Repository 校验错误类。
// 文件作用: 统一报告工厂缺失、多余或容器类型错误的顶层种子。
import { SourceRepositoryValidationError } from './sourceRepositoryErrors.js';

// 导入来源: ./sourceRepositoryValidators.js。
// 导入内容: assertPlainObject 原型安全普通对象校验函数。
// 文件作用: 工厂只接受明确普通对象 seeds、Preferences 和 Storage 根对象。
import { assertPlainObject } from './sourceRepositoryValidators.js';

// 导入来源: ./memorySourcePackageRepository.js。
// 导入内容: MemorySourcePackageRepository 脚本包内存仓。
// 文件作用: 使用 seeds.packages 创建 Package 保存权威。
import { MemorySourcePackageRepository } from './memorySourcePackageRepository.js';

// 导入来源: ./memorySourceDefinitionRepository.js。
// 导入内容: MemorySourceDefinitionRepository Definition/Preferences 内存仓。
// 文件作用: 使用 definitions 和 preferences 创建定义与偏好保存权威。
import { MemorySourceDefinitionRepository } from './memorySourceDefinitionRepository.js';

// 导入来源: ./memorySourceStorageRepository.js。
// 导入内容: MemorySourceStorageRepository 私有空间内存仓。
// 文件作用: 使用 storageNamespaces 创建 sourceId 五分区私有空间。
import { MemorySourceStorageRepository } from './memorySourceStorageRepository.js';

// 导入来源: ./memorySourceRepositoryUnitOfWork.js。
// 导入内容: MemorySourceRepositoryUnitOfWork FIFO 跨仓事务协调器。
// 文件作用: 把三个新建 Repository 组合成同一串行事务边界。
import { MemorySourceRepositoryUnitOfWork } from './memorySourceRepositoryUnitOfWork.js';

// 类型: Array<string>。
// 作用: 固定 Memory Repository 工厂唯一接受的四个顶层字段，禁止隐式默认数据和影子配置。
const MEMORY_REPOSITORY_SEED_KEYS = Object.freeze([
  'packages',
  'definitions',
  'preferences',
  'storageNamespaces'
]);

/**
 * 校验 Memory Repository 工厂种子。
 * 纯函数: 不修改种子；具体领域对象仍由三个 Repository 使用集中校验器完整验证。
 * 成功路径: 顶层字段与容器类型完整时返回原始 seeds。
 * 失败路径: 无参数、缺失字段、额外字段或基础容器类型错误时抛领域校验错误。
 *
 * @param {object} seeds 调用方显式提供的分离 Repository 种子。
 * @returns {object} 已通过工厂顶层边界校验的原始 seeds。
 * @throws {SourceRepositoryValidationError} 当工厂种子不符合四字段结构时抛出。
 */
function validateMemoryRepositorySeeds(seeds) {
  // 执行内容: 无参数、null、数组和复杂实例都在访问字段前明确失败。
  assertPlainObject(seeds, 'memoryRepositorySeeds');

  // 类型: Array<string>。
  // 作用: 读取调用方实际提供的顶层字段，检查缺失和未进入契约的额外字段。
  const seedKeys = Object.keys(seeds);

  // 条件分支: 顶层字段数量或名称与固定集合不一致时进入。
  // 执行内容: 阻止工厂猜测默认值或忽略影子配置。
  if (seedKeys.length !== MEMORY_REPOSITORY_SEED_KEYS.length
    || seedKeys.some(seedKey => !MEMORY_REPOSITORY_SEED_KEYS.includes(seedKey))) {
    throw new SourceRepositoryValidationError(
      `memoryRepositorySeeds 必须完整包含: ${MEMORY_REPOSITORY_SEED_KEYS.join(', ')}`
    );
  }

  // 条件分支: packages 不是数组时进入。
  // 执行内容: 在创建任何 Repository 前拒绝无法表达包集合的容器。
  if (!Array.isArray(seeds.packages)) {
    throw new SourceRepositoryValidationError('memoryRepositorySeeds.packages 必须是数组');
  }

  // 条件分支: definitions 不是数组时进入。
  // 执行内容: 在创建任何 Repository 前拒绝无法表达 Definition 集合的容器。
  if (!Array.isArray(seeds.definitions)) {
    throw new SourceRepositoryValidationError('memoryRepositorySeeds.definitions 必须是数组');
  }

  // 执行内容: Preferences 必须是普通对象；完整字段由 Definition Repository 校验。
  assertPlainObject(seeds.preferences, 'memoryRepositorySeeds.preferences');

  // 执行内容: Storage 命名空间集合必须是普通对象；完整五分区由 Storage Repository 校验。
  assertPlainObject(seeds.storageNamespaces, 'memoryRepositorySeeds.storageNamespaces');

  // 返回值类型: object。
  // 作用: 返回已确认顶层完整的显式种子，交给三个 Repository 分别完成领域校验和隔离复制。
  return seeds;
}

/**
 * 创建 Memory Repository 基础设施。
 * 副作用: 仅在内存中创建三个隔离 Repository 和一个 FIFO Unit of Work，不修改传入 seeds。
 * 成功路径: 返回 Package、Definition、Storage Repository 和事务协调器。
 * 失败路径: 工厂顶层结构或任一 Repository 领域对象非法时抛领域错误，不返回部分基础设施。
 * 依赖边界: 调用方必须显式传入 seeds；本工厂不会导入或选择默认数据种子。
 *
 * @param {object} seeds 分离 Repository 种子。
 * @param {Array<object>} seeds.packages SourcePackage 数组。
 * @param {Array<object>} seeds.definitions SourceDefinition 数组。
 * @param {object} seeds.preferences SourcePreferences 对象。
 * @param {Record<string, object>} seeds.storageNamespaces 完整五分区命名空间集合。
 * @returns {object} 完整 Memory Repository 基础设施。
 * @returns {MemorySourcePackageRepository} return.packageRepository Package Repository。
 * @returns {MemorySourceDefinitionRepository} return.definitionRepository Definition Repository。
 * @returns {MemorySourceStorageRepository} return.storageRepository Storage Repository。
 * @returns {MemorySourceRepositoryUnitOfWork} return.unitOfWork FIFO 事务协调器。
 * @throws {SourceRepositoryValidationError} 当显式种子不符合工厂或 Repository 契约时抛出。
 */
export function createMemorySourceRepositories(seeds) {
  // 类型: object。
  // 作用: 在实例化任何 Repository 前完成顶层字段和容器校验。
  const validatedSeeds = validateMemoryRepositorySeeds(seeds);

  // 类型: MemorySourcePackageRepository。
  // 作用: 使用显式 Package 种子创建脚本包保存权威。
  const packageRepository = new MemorySourcePackageRepository(validatedSeeds.packages);

  // 类型: MemorySourceDefinitionRepository。
  // 作用: 使用显式 Definition 和 Preferences 创建定义与偏好保存权威。
  const definitionRepository = new MemorySourceDefinitionRepository(
    validatedSeeds.definitions,
    validatedSeeds.preferences
  );

  // 类型: MemorySourceStorageRepository。
  // 作用: 使用显式五分区种子创建数据源私有空间保存权威。
  const storageRepository = new MemorySourceStorageRepository(
    validatedSeeds.storageNamespaces
  );

  // 类型: MemorySourceRepositoryUnitOfWork。
  // 作用: 把三个新建 Repository 组合为同一 FIFO 跨仓事务边界。
  const unitOfWork = new MemorySourceRepositoryUnitOfWork({
    packageRepository,
    definitionRepository,
    storageRepository
  });

  // 返回值类型: object。
  // 作用: 返回同一组 Repository 和协调器，供 SourceManager 或独立领域调用方显式持有。
  return {
    packageRepository,
    definitionRepository,
    storageRepository,
    unitOfWork
  };
}
