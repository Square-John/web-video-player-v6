/*
  memorySourceStorageRepository.js 模块说明

  - 文件职责:
      实现 SourceStorageRepository 的内存适配器。
      使用 sourceId、partition 和 key 私有三层 Map 隔离普通设置、凭据、会话、缓存和诊断数据。
      供 SourceManager、SourceContext 和 Memory Unit of Work 通过稳定异步接口读写、清理、统计和恢复数据源私有空间。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      SourceRepositoryValidationError: 自定义错误，报告命名空间字段集合不符合五分区契约。
      SOURCE_RUNTIME_STORAGE_PARTITIONS: 自定义配置，固定全部缓存清理和汇总目标。
      SOURCE_STORAGE_PARTITION: 自定义配置，固定五个私有空间分区名称。
      SOURCE_TEMPORARY_STORAGE_PARTITIONS: 自定义配置，固定临时缓存汇总目标。
      assertSourceStoragePartition: 自定义工具，校验公开方法接收的分区名称。
      cloneSerializableValue: 自定义工具，严格校验并隔离保存值、返回值和快照。
      getSerializableByteLength: 自定义工具，按严格 JSON UTF-8 文本计算保存值容量。
      assertPlainObject、assertSafeRecordKey: 自定义校验函数，校验种子对象、sourceId 和动态 key。

  - 模块级常量:
      SOURCE_STORAGE_PARTITION_NAMES: Array<string>，五分区稳定顺序。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createEmptyNamespaceMap(): 创建包含五个空分区 Map 的命名空间。
      createPartitionMap(partitionSeed, fieldName): 校验并转换单个分区种子。
      createNamespaceMap(namespaceSeed, fieldName): 校验固定五分区并创建命名空间 Map。
      createNamespacesMap(namespaceSeeds, fieldName): 校验全部 sourceId 并创建私有三层 Map。
      createStorageSnapshot(namespacesBySourceId): 把私有三层 Map 转换为隔离可序列化快照。
      calculatePartitionBytes(partitionMap): 计算一个分区全部保存值的字节数。

  - 模块级类:
      MemorySourceStorageRepository: 数据源私有空间内存仓库。

  - 对外导出:
      MemorySourceStorageRepository: Class，私有空间异步 CRUD、清理、删除、usage 和事务快照能力。
*/

// 导入来源: ./sourceRepositoryErrors.js。
// 导入内容: SourceRepositoryValidationError Repository 校验错误类。
// 文件作用: 固定命名空间缺失或增加分区时的领域失败类型。
import { SourceRepositoryValidationError } from './sourceRepositoryErrors.js';

import {
  // 导入来源: ./sourceRepositoryUtils.js。
  // 导入内容: SOURCE_RUNTIME_STORAGE_PARTITIONS 全部缓存分区数组。
  // 文件作用: clearAll 和 totalCacheBytes 使用同一分区集合并明确保留 settings。
  SOURCE_RUNTIME_STORAGE_PARTITIONS,

  // 导入来源: ./sourceRepositoryUtils.js。
  // 导入内容: SOURCE_STORAGE_PARTITION 五分区枚举。
  // 文件作用: 创建固定命名空间和校验快照分区字段。
  SOURCE_STORAGE_PARTITION,

  // 导入来源: ./sourceRepositoryUtils.js。
  // 导入内容: SOURCE_TEMPORARY_STORAGE_PARTITIONS 临时分区数组。
  // 文件作用: 统一计算 cache 与 diagnostics 的 temporaryCacheBytes。
  SOURCE_TEMPORARY_STORAGE_PARTITIONS,

  // 导入来源: ./sourceRepositoryUtils.js。
  // 导入内容: assertSourceStoragePartition 分区校验函数。
  // 文件作用: 公开 CRUD 和清理方法拒绝五分区之外的名称。
  assertSourceStoragePartition,

  // 导入来源: ./sourceRepositoryUtils.js。
  // 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
  // 文件作用: 构造、set、get、list 和快照边界不保留调用方可变引用。
  cloneSerializableValue,

  // 导入来源: ./sourceRepositoryUtils.js。
  // 导入内容: getSerializableByteLength 严格 JSON Value 容量计算函数。
  // 文件作用: 按实际保存值生成五分区 usage 和设置页两级缓存摘要。
  getSerializableByteLength
} from './sourceRepositoryUtils.js';

import {
  // 导入来源: ./sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 原型安全普通对象校验函数。
  // 文件作用: 构造种子、命名空间、分区和恢复快照只接受普通 JSON 对象。
  assertPlainObject,

  // 导入来源: ./sourceRepositoryValidators.js。
  // 导入内容: assertSafeRecordKey 动态记录键校验函数。
  // 文件作用: sourceId 和分区 key 统一拒绝 __proto__、constructor 和 prototype。
  assertSafeRecordKey
} from './sourceRepositoryValidators.js';

// 类型: Array<string>。
// 作用: 固定命名空间构建、快照输出和 usage 返回的五分区顺序。
const SOURCE_STORAGE_PARTITION_NAMES = Object.freeze(Object.values(SOURCE_STORAGE_PARTITION));

/**
 * 创建空数据源私有空间 Map。
 * 纯函数: 每次返回全新的命名空间和五个分区 Map，不保存模块级可变状态。
 *
 * @returns {Map<string, Map<string, *>>} 以分区名索引的空命名空间 Map。
 */
function createEmptyNamespaceMap() {
  // 类型: Map<string, Map<string, *>>。
  // 作用: 暂存五个职责固定且互相隔离的分区 Map。
  const namespaceMap = new Map();

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 为每个固定分区创建独立 Map，避免分区之间共享动态 key 容器。
  SOURCE_STORAGE_PARTITION_NAMES.forEach((partition) => {
    // 副作用范围: 只写入当前函数新建的 namespaceMap。
    namespaceMap.set(partition, new Map());
  });

  // 返回值类型: Map<string, Map<string, *>>。
  // 作用: 返回可由单个 sourceId 私有持有的完整空命名空间。
  return namespaceMap;
}

/**
 * 把一个分区种子转换为私有 Map。
 * 纯函数: 返回新的 Map 和隔离保存值，不修改种子对象。
 * 成功路径: 每个 key 通过动态键校验，每个 value 已在上层严格复制后进入 Map。
 * 失败路径: 分区不是普通对象或 key 使用保留名称时抛领域校验错误。
 *
 * @param {object} partitionSeed 单个分区的键值种子对象。
 * @param {string} fieldName 错误信息中的分区字段路径。
 * @returns {Map<string, *>} 按安全 key 保存隔离 JSON Value 的分区 Map。
 * @throws {SourceRepositoryValidationError} 当分区结构或动态 key 不符合契约时抛出。
 */
function createPartitionMap(partitionSeed, fieldName) {
  // 执行内容: 要求分区种子是原型安全普通对象，拒绝数组和复杂实例。
  assertPlainObject(partitionSeed, fieldName);

  // 类型: Map<string, *>。
  // 作用: 保存当前分区全部安全动态 key 和隔离值。
  const partitionMap = new Map();

  // 循环类型: Object.entries。
  // 循环作用: 校验每个外部 key 后写入私有 Map，避免普通对象原型行为。
  Object.entries(partitionSeed).forEach(([key, value]) => {
    // 类型: string。
    // 作用: 拒绝空 key 和三个原型敏感保留键，保持跨存储适配器行为一致。
    const safeKey = assertSafeRecordKey(key, `${fieldName} key`);

    // 副作用范围: 只写入当前函数创建的临时分区 Map。
    // 值边界: namespaceSeeds 已整体通过 cloneSerializableValue，当前 value 不含非法 JSON 类型或外部引用。
    partitionMap.set(safeKey, value);
  });

  // 返回值类型: Map<string, *>。
  // 作用: 返回完成键校验的私有分区候选状态。
  return partitionMap;
}

/**
 * 把单个 sourceId 命名空间种子转换为五分区 Map。
 * 纯函数: 返回新的命名空间 Map，不修改输入。
 * 成功路径: 字段集合与五分区完全一致后逐分区转换。
 * 失败路径: 缺失分区、额外分区或任一分区非法时抛领域错误。
 *
 * @param {object} namespaceSeed 单个 sourceId 的五分区种子。
 * @param {string} fieldName 错误信息中的命名空间字段路径。
 * @returns {Map<string, Map<string, *>>} 完整五分区命名空间 Map。
 * @throws {SourceRepositoryValidationError} 当命名空间字段或分区内容不符合契约时抛出。
 */
function createNamespaceMap(namespaceSeed, fieldName) {
  // 执行内容: 要求命名空间根节点为普通对象。
  assertPlainObject(namespaceSeed, fieldName);

  // 类型: Array<string>。
  // 作用: 读取命名空间实际分区字段，用于拒绝静默补齐和忽略字段。
  const namespaceKeys = Object.keys(namespaceSeed);

  // 条件分支: 字段数量或名称与固定五分区不一致时进入。
  // 执行内容: 明确报告契约漂移，不创建部分命名空间。
  if (namespaceKeys.length !== SOURCE_STORAGE_PARTITION_NAMES.length
    || namespaceKeys.some(partition => !SOURCE_STORAGE_PARTITION_NAMES.includes(partition))) {
    throw new SourceRepositoryValidationError(
      `${fieldName} 必须完整包含五分区: ${SOURCE_STORAGE_PARTITION_NAMES.join(', ')}`
    );
  }

  // 类型: Map<string, Map<string, *>>。
  // 作用: 暂存完整通过校验的五分区候选状态。
  const namespaceMap = new Map();

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 按稳定顺序转换五个分区，保证 list、usage 和快照结果可预测。
  SOURCE_STORAGE_PARTITION_NAMES.forEach((partition) => {
    // 类型: Map<string, *>。
    // 作用: 校验并转换当前分区全部动态 key 与保存值。
    const partitionMap = createPartitionMap(
      namespaceSeed[partition],
      `${fieldName}.${partition}`
    );

    // 副作用范围: 只写入当前函数创建的临时候选命名空间。
    namespaceMap.set(partition, partitionMap);
  });

  // 返回值类型: Map<string, Map<string, *>>。
  // 作用: 返回字段完整、键安全且引用隔离的命名空间候选状态。
  return namespaceMap;
}

/**
 * 把全部 Storage 种子转换为私有三层 Map。
 * 纯函数: 不修改输入；只有完整集合成功时才返回候选保存态。
 * 成功路径: 根对象、全部 sourceId、五分区、动态 key 和 JSON Value 均通过校验。
 * 失败路径: 任一层非法时抛领域错误，调用方可以保留原 Repository 状态。
 *
 * @param {object} namespaceSeeds 按 sourceId 提供的五分区种子或事务快照。
 * @param {string} fieldName 错误信息中的根字段名。
 * @returns {Map<string, Map<string, Map<string, *>>>} 完整私有三层 Map 候选状态。
 * @throws {SourceRepositoryValidationError} 当根对象、sourceId、分区、key 或 value 非法时抛出。
 */
function createNamespacesMap(namespaceSeeds, fieldName) {
  // 类型: object。
  // 作用: 在遍历前完成严格 JSON Value 校验和深拷贝，拒绝隐藏字段、访问器、复杂值和循环引用。
  const safeNamespaceSeeds = cloneSerializableValue(namespaceSeeds, fieldName);

  // 执行内容: 要求全部命名空间集合使用普通对象表达，不接受数组或复杂实例。
  assertPlainObject(safeNamespaceSeeds, fieldName);

  // 类型: Map<string, Map<string, Map<string, *>>>。
  // 作用: 暂存完整校验后的 Repository 下一状态，成功返回前没有外部可观察写入。
  const namespacesBySourceId = new Map();

  // 循环类型: Object.entries。
  // 循环作用: 校验每个 sourceId 并转换对应五分区命名空间。
  Object.entries(safeNamespaceSeeds).forEach(([sourceId, namespaceSeed]) => {
    // 类型: string。
    // 作用: 拒绝空 sourceId 和原型敏感保留键，维持命名空间隔离边界。
    const safeSourceId = assertSafeRecordKey(sourceId, `${fieldName} sourceId`);

    // 类型: Map<string, Map<string, *>>。
    // 作用: 完整转换当前数据源五分区，失败时不写入候选根 Map。
    const namespaceMap = createNamespaceMap(
      namespaceSeed,
      `${fieldName}.${safeSourceId}`
    );

    // 副作用范围: 只写入当前函数创建的临时根 Map。
    namespacesBySourceId.set(safeSourceId, namespaceMap);
  });

  // 返回值类型: Map<string, Map<string, Map<string, *>>>。
  // 作用: 返回可由构造函数或恢复入口一次性采用的完整候选保存态。
  return namespacesBySourceId;
}

/**
 * 把私有三层 Map 转换为可序列化事务快照。
 * 纯函数: 不修改 Map；返回的新对象和值副本不能反向污染 Repository。
 *
 * @param {Map<string, Map<string, Map<string, *>>>} namespacesBySourceId 私有命名空间根 Map。
 * @returns {object} 与构造 namespaceSeeds 同构的严格 JSON 隔离对象。
 */
function createStorageSnapshot(namespacesBySourceId) {
  // 类型: Array<Array<*>>。
  // 作用: 把每个 sourceId Map 条目转换为 Object.fromEntries 可消费的安全键值对。
  const namespaceEntries = Array.from(namespacesBySourceId.entries()).map(([
    sourceId,
    namespaceMap
  ]) => {
    // 类型: Array<Array<*>>。
    // 作用: 按固定顺序转换当前命名空间五个分区。
    const partitionEntries = SOURCE_STORAGE_PARTITION_NAMES.map((partition) => {
      // 类型: Map<string, *>。
      // 作用: 读取当前私有分区 Map；该引用只在模块内部转换，不返回调用方。
      const partitionMap = namespaceMap.get(partition);

      // 返回值类型: Array<*>。
      // 作用: 把分区 Map 转换为普通对象键值对，保持 Map 插入顺序。
      return [partition, Object.fromEntries(partitionMap.entries())];
    });

    // 返回值类型: Array<*>。
    // 作用: 生成当前 sourceId 与五分区普通对象的快照条目。
    return [sourceId, Object.fromEntries(partitionEntries)];
  });

  // 返回值类型: object。
  // 作用: 再次严格复制完整快照，保证嵌套保存值与私有 Map 完全引用隔离。
  return cloneSerializableValue(Object.fromEntries(namespaceEntries), 'storageSnapshot');
}

/**
 * 计算一个分区全部保存值的序列化字节数。
 * 纯函数: 不修改分区 Map；键名不计入当前容量口径，只统计严格 JSON 保存值。
 *
 * @param {Map<string, *>} partitionMap 私有分区 Map。
 * @returns {number} 全部分区保存值的 UTF-8 JSON 字节数之和。
 */
function calculatePartitionBytes(partitionMap) {
  // 返回值类型: number。
  // 作用: 对每个实际保存值使用统一容量函数并累加，空分区返回 0。
  return Array.from(partitionMap.values()).reduce((totalBytes, value) => {
    return totalBytes + getSerializableByteLength(value);
  }, 0);
}

/**
 * 数据源私有空间 Memory Repository。
 * 职责: 提供 sourceId、partition、key 三层隔离的异步 CRUD、清理、容量和事务快照接口。
 * 内部状态: 私有三层 Map；外部不能取得命名空间、分区 Map 或保存值原始引用。
 */
export class MemorySourceStorageRepository {
  // 类型: Map<string, Map<string, Map<string, *>>>。
  // 作用: 保存全部数据源私有空间；私有字段阻止调用方绕过 Repository 接口访问命名空间。
  #namespacesBySourceId;

  /**
   * 创建私有空间 Repository。
   * 副作用: 只初始化当前实例私有状态，不修改传入种子。
   * 成功路径: 全部种子通过严格 JSON、sourceId、五分区和动态 key 校验后一次性建立三层 Map。
   * 失败路径: 任一命名空间非法时抛领域错误，实例不会以半完成状态返回。
   *
   * @param {Record<string, object>} namespaceSeeds 按 sourceId 提供的完整五分区种子。
   * @throws {SourceRepositoryValidationError} 当种子根对象、sourceId、分区、key 或 value 非法时抛出。
   */
  constructor(namespaceSeeds = {}) {
    // 类型: Map<string, Map<string, Map<string, *>>>。
    // 作用: 使用完整候选状态一次性初始化当前实例私有保存权威。
    this.#namespacesBySourceId = createNamespacesMap(namespaceSeeds, 'namespaceSeeds');
  }

  /**
   * 读取内部命名空间，并可按需创建完整五分区 Map。
   * 私有方法: 只接受已经由公开方法完成 assertSafeRecordKey 校验的 sourceId。
   * 副作用: createIfMissing 为 true 且 sourceId 未命中时创建一个完整空命名空间。
   *
   * @param {string} sourceId 已验证的数据源 id。
   * @param {boolean} createIfMissing 是否在缺失时创建命名空间。
   * @returns {Map<string, Map<string, *>>|null} 内部命名空间 Map 或 null；不会离开当前类边界。
   * @returns {true} createIfMissing 为 true 时允许创建缺失命名空间。
   * @returns {false} createIfMissing 为 false 时保持纯读取，缺失直接返回 null。
   */
  #getNamespaceMap(sourceId, createIfMissing = false) {
    // 条件分支: 当前 sourceId 未命中且调用方明确允许创建时进入。
    // 执行内容: 创建固定五分区空 Map；只在 set 的全部输入校验通过后调用。
    if (!this.#namespacesBySourceId.has(sourceId) && createIfMissing) {
      this.#namespacesBySourceId.set(sourceId, createEmptyNamespaceMap());
    }

    // 返回值类型: Map<string, Map<string, *>>|null。
    // 作用: 返回仅供当前类方法继续操作的内部命名空间；不存在时返回 null。
    return this.#namespacesBySourceId.get(sourceId) || null;
  }

  /**
   * 读取单个私有空间值。
   * 副作用: 不创建命名空间、不修改内部 Map，也不暴露保存值引用。
   * 成功路径: 命中时返回严格 JSON Value 隔离副本。
   * 未命中路径: sourceId 或 key 不存在时返回 null。
   * 失败路径: sourceId、partition 或 key 非法，或命中值无法隔离复制时抛领域校验错误。
   *
   * @param {string} sourceId 数据源 id。
   * @param {string} partition 五分区之一。
   * @param {string} key 分区动态键。
   * @returns {Promise<*|null>} 命中返回隔离副本，未命中返回 null。
   * @throws {SourceRepositoryValidationError} 当 sourceId、partition 或 key 非法时抛出。
   */
  async get(sourceId, partition, key) {
    // 类型: string。
    // 作用: 校验命名空间 id，危险键不能被当作合法未命中。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');

    // 类型: string。
    // 作用: 固定访问分区，阻止跨越五分区契约。
    const safePartition = assertSourceStoragePartition(partition);

    // 类型: string。
    // 作用: 校验分区动态键，拒绝原型敏感名称。
    const safeKey = assertSafeRecordKey(key, 'key');

    // 类型: Map<string, Map<string, *>>|null。
    // 作用: 读取已有命名空间；get 不为未命中 sourceId 创建空状态。
    const namespaceMap = this.#getNamespaceMap(safeSourceId, false);

    // 条件分支: 命名空间不存在时进入。
    // 执行内容: 按单项查询契约返回 null。
    if (!namespaceMap) return null;

    // 类型: Map<string, *>。
    // 作用: 获取固定存在的目标分区 Map。
    const partitionMap = namespaceMap.get(safePartition);

    // 条件分支: 目标 key 未命中时进入。
    // 执行内容: 返回 null，不把合法未命中包装成异常。
    if (!partitionMap.has(safeKey)) return null;

    // 返回值类型: *。
    // 作用: 返回保存值隔离副本，调用方修改嵌套对象不会污染私有 Map。
    return cloneSerializableValue(partitionMap.get(safeKey), 'storageValue');
  }

  /**
   * 保存单个私有空间值。
   * 副作用: 全部输入校验成功后按需创建 sourceId 命名空间，并 upsert 一个分区 key。
   * 成功路径: 保存隔离值并返回第二份隔离副本。
   * 失败路径: sourceId、partition、key 或 value 非法时抛领域错误，不创建空命名空间或修改原值。
   *
   * @param {string} sourceId 数据源 id。
   * @param {string} partition 五分区之一。
   * @param {string} key 分区动态键。
   * @param {*} value 严格 JSON Value。
   * @returns {Promise<*>} 保存后的隔离副本。
   * @throws {SourceRepositoryValidationError} 当地址或保存值不符合契约时抛出。
   */
  async set(sourceId, partition, key, value) {
    // 类型: string。
    // 作用: 在任何状态创建前校验命名空间 id。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');

    // 类型: string。
    // 作用: 在任何状态创建前校验固定五分区名称。
    const safePartition = assertSourceStoragePartition(partition);

    // 类型: string。
    // 作用: 在任何状态创建前校验动态分区键。
    const safeKey = assertSafeRecordKey(key, 'key');

    // 类型: *。
    // 作用: 在创建命名空间前完成严格 JSON Value 校验和输入引用隔离。
    const storedValue = cloneSerializableValue(value, 'storageValue');

    // 类型: Map<string, Map<string, *>>。
    // 作用: 仅在全部输入合法后读取或创建完整命名空间。
    const namespaceMap = this.#getNamespaceMap(safeSourceId, true);

    // 类型: Map<string, *>。
    // 作用: 获取目标分区私有 Map，准备执行单 key upsert。
    const partitionMap = namespaceMap.get(safePartition);

    // 副作用: 在当前 sourceId 和 partition 内 upsert 一个隔离保存值。
    // 影响范围: 不影响其他 sourceId、分区或 key。
    partitionMap.set(safeKey, storedValue);

    // 返回值类型: *。
    // 作用: 返回第二份隔离副本，调用方不能通过 save 返回值修改内部 Map。
    return cloneSerializableValue(storedValue, 'storageValue');
  }

  /**
   * 删除单个私有空间键。
   * 副作用: 命中时删除一个分区 Map 条目。
   * 成功路径: 命中并删除返回 true。
   * 未命中路径: sourceId 或 key 不存在时返回 false。
   * 失败路径: sourceId、partition 或 key 非法时抛领域校验错误，保存态保持不变。
   *
   * @param {string} sourceId 数据源 id。
   * @param {string} partition 五分区之一。
   * @param {string} key 分区动态键。
   * @returns {Promise<boolean>} true 表示命中并删除；false 表示没有对应值。
   * @throws {SourceRepositoryValidationError} 当 sourceId、partition 或 key 非法时抛出。
   */
  async remove(sourceId, partition, key) {
    // 类型: string。
    // 作用: 删除前校验命名空间 id。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');

    // 类型: string。
    // 作用: 删除前校验固定分区名称。
    const safePartition = assertSourceStoragePartition(partition);

    // 类型: string。
    // 作用: 删除前校验动态 key，危险键不能伪装成未命中。
    const safeKey = assertSafeRecordKey(key, 'key');

    // 类型: Map<string, Map<string, *>>|null。
    // 作用: 读取已有命名空间，remove 不创建空状态。
    const namespaceMap = this.#getNamespaceMap(safeSourceId, false);

    // 条件分支: 命名空间未命中时进入。
    // 执行内容: 按删除契约返回 false。
    if (!namespaceMap) return false;

    // 返回值类型: boolean。
    // true: 目标分区 Map 已删除命中条目；false: key 不存在且状态不变。
    return namespaceMap.get(safePartition).delete(safeKey);
  }

  /**
   * 列出一个分区全部键值。
   * 副作用: 不创建命名空间、不修改内部 Map，并返回数组、条目对象和 value 的隔离副本。
   * 成功路径: 按 Map 插入顺序返回全部条目。
   * 未命中路径: sourceId 不存在时返回空数组。
   * 失败路径: sourceId 或 partition 非法，或保存值无法隔离复制时抛领域校验错误。
   *
   * @param {string} sourceId 数据源 id。
   * @param {string} partition 五分区之一。
   * @returns {Promise<Array<object>>} 隔离的 { key, value } 条目数组。
   * @throws {SourceRepositoryValidationError} 当 sourceId 或 partition 非法时抛出。
   */
  async list(sourceId, partition) {
    // 类型: string。
    // 作用: 列表读取前校验命名空间 id。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');

    // 类型: string。
    // 作用: 列表读取前校验固定分区名称。
    const safePartition = assertSourceStoragePartition(partition);

    // 类型: Map<string, Map<string, *>>|null。
    // 作用: 读取已有命名空间，list 不创建空状态。
    const namespaceMap = this.#getNamespaceMap(safeSourceId, false);

    // 条件分支: 命名空间未命中时进入。
    // 执行内容: 按集合查询契约返回空数组。
    if (!namespaceMap) return [];

    // 返回值类型: Array<object>。
    // 作用: 按 Map 插入顺序创建条目，并逐值隔离嵌套引用。
    return Array.from(namespaceMap.get(safePartition).entries()).map(([key, value]) => ({
      key,
      value: cloneSerializableValue(value, 'storageValue')
    }));
  }

  /**
   * 清空单个分区。
   * 副作用: 命中 sourceId 时删除目标分区全部条目，其他分区保持不变。
   * 成功路径: 返回清理前目标分区条目数。
   * 未命中路径: sourceId 不存在时返回 0。
   * 失败路径: sourceId 或 partition 非法时抛领域校验错误，所有分区保持不变。
   *
   * @param {string} sourceId 数据源 id。
   * @param {string} partition 五分区之一。
   * @returns {Promise<number>} 删除条目数量。
   * @throws {SourceRepositoryValidationError} 当 sourceId 或 partition 非法时抛出。
   */
  async clear(sourceId, partition) {
    // 类型: string。
    // 作用: 清理前校验命名空间 id。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');

    // 类型: string。
    // 作用: 清理前校验固定分区名称。
    const safePartition = assertSourceStoragePartition(partition);

    // 类型: Map<string, Map<string, *>>|null。
    // 作用: 读取已有命名空间，clear 不创建空状态。
    const namespaceMap = this.#getNamespaceMap(safeSourceId, false);

    // 条件分支: 命名空间未命中时进入。
    // 执行内容: 按清理契约返回 0。
    if (!namespaceMap) return 0;

    // 类型: Map<string, *>。
    // 作用: 保存目标分区私有 Map，用于读取条目数并清空。
    const partitionMap = namespaceMap.get(safePartition);

    // 类型: number。
    // 作用: 记录清理前条目数，作为清理结果返回。
    const removedCount = partitionMap.size;

    // 副作用: 清空当前 sourceId 的目标分区 Map。
    // 影响范围: 不删除命名空间和其他四个分区。
    partitionMap.clear();

    // 返回值类型: number。
    // 作用: 返回本次实际删除的条目数量。
    return removedCount;
  }

  /**
   * 清理全部运行缓存并保留普通设置。
   * 副作用: 清空 credentials、session、cache 和 diagnostics 四个运行分区。
   * 成功路径: 返回四个分区清理前条目数总和。
   * 未命中路径: sourceId 不存在时返回 0。
   * 失败路径: sourceId 非法时抛领域校验错误，四个运行分区保持不变。
   *
   * @param {string} sourceId 数据源 id。
   * @returns {Promise<number>} 四个运行分区删除条目总数。
   * @throws {SourceRepositoryValidationError} 当 sourceId 非法时抛出。
   */
  async clearAll(sourceId) {
    // 类型: string。
    // 作用: 清理前校验命名空间 id，危险键不能被当成未命中。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');

    // 类型: Map<string, Map<string, *>>|null。
    // 作用: 读取已有命名空间，clearAll 不创建空状态。
    const namespaceMap = this.#getNamespaceMap(safeSourceId, false);

    // 条件分支: 命名空间未命中时进入。
    // 执行内容: 按清理契约返回 0。
    if (!namespaceMap) return 0;

    // 类型: number。
    // 作用: 累计四个运行分区实际删除条目数；settings 不进入该集合。
    let removedCount = 0;

    // 循环类型: Array.prototype.forEach。
    // 循环作用: 清空四个运行分区并累计每个分区原条目数。
    SOURCE_RUNTIME_STORAGE_PARTITIONS.forEach((partition) => {
      // 类型: Map<string, *>。
      // 作用: 读取当前运行分区私有 Map。
      const partitionMap = namespaceMap.get(partition);

      // 计算内容: 把当前分区条目数累计到删除总数。
      removedCount += partitionMap.size;

      // 副作用: 清空当前运行分区；普通 settings 分区保持不变。
      partitionMap.clear();
    });

    // 返回值类型: number。
    // 作用: 返回四个运行分区实际删除条目总数。
    return removedCount;
  }

  /**
   * 删除完整 sourceId 命名空间。
   * 副作用: 命中时删除当前 sourceId 的五个分区和全部保存值。
   * 成功路径: 命中并删除返回 true。
   * 未命中路径: 合法 sourceId 不存在时返回 false。
   * 失败路径: sourceId 非法时抛领域校验错误，根命名空间 Map 保持不变。
   *
   * @param {string} sourceId 数据源 id。
   * @returns {Promise<boolean>} true 表示命中并删除；false 表示没有该命名空间。
   * @throws {SourceRepositoryValidationError} 当 sourceId 非法时抛出。
   */
  async removeSource(sourceId) {
    // 类型: string。
    // 作用: 删除前校验命名空间 id。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');

    // 返回值类型: boolean。
    // true: 根 Map 已删除完整命名空间；false: 命名空间原本不存在。
    return this.#namespacesBySourceId.delete(safeSourceId);
  }

  /**
   * 读取数据源私有空间容量摘要。
   * 副作用: 不创建命名空间、不修改分区内容，也不暴露内部 Map。
   * 成功路径: 返回五分区字节数、两级缓存摘要和内部总容量。
   * 未命中路径: 返回 sourceId 对应的全零摘要。
   * 失败路径: sourceId 非法或保存值无法计算严格 JSON 容量时抛领域校验错误。
   *
   * @param {string} sourceId 数据源 id。
   * @returns {Promise<object>} 五分区和设置页两级缓存容量摘要。
   * @returns {string} return.sourceId 当前容量摘要所属数据源 id。
   * @returns {Record<string, number>} return.partitions 五分区实际保存值字节数。
   * @returns {number} return.temporaryCacheBytes cache 与 diagnostics 字节数之和。
   * @returns {number} return.totalCacheBytes 四个运行分区字节数之和。
   * @returns {number} return.totalStorageBytes 五个分区字节数之和。
   * @throws {SourceRepositoryValidationError} 当 sourceId 非法时抛出。
   */
  async getUsage(sourceId) {
    // 类型: string。
    // 作用: 容量读取前校验命名空间 id。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');

    // 类型: Map<string, Map<string, *>>。
    // 作用: 命中时读取内部命名空间；未命中时使用局部空 Map 计算零摘要，不写入 Repository。
    const namespaceMap = this.#getNamespaceMap(safeSourceId, false)
      || createEmptyNamespaceMap();

    // 类型: Record<string, number>。
    // 作用: 按稳定五分区顺序计算每个分区实际保存值字节数。
    const partitions = SOURCE_STORAGE_PARTITION_NAMES.reduce((usage, partition) => {
      // 类型: number。
      // 作用: 保存当前分区全部值的严格 JSON UTF-8 字节数。
      usage[partition] = calculatePartitionBytes(namespaceMap.get(partition));
      return usage;
    }, {});

    // 类型: number。
    // 作用: 汇总 cache 和 diagnostics，映射设置页“临时缓存”。
    const temporaryCacheBytes = SOURCE_TEMPORARY_STORAGE_PARTITIONS.reduce((sum, partition) => {
      return sum + partitions[partition];
    }, 0);

    // 类型: number。
    // 作用: 汇总四个运行分区，映射设置页“全部缓存”。
    const totalCacheBytes = SOURCE_RUNTIME_STORAGE_PARTITIONS.reduce((sum, partition) => {
      return sum + partitions[partition];
    }, 0);

    // 类型: number。
    // 作用: 汇总五分区容量，仅供内部配额和诊断使用，不新增设置页字段。
    const totalStorageBytes = Object.values(partitions).reduce((sum, bytes) => {
      return sum + bytes;
    }, 0);

    // 返回值类型: object。
    // 作用: 返回不含内部 Map 的普通容量摘要对象。
    return {
      sourceId: safeSourceId,
      partitions,
      temporaryCacheBytes,
      totalCacheBytes,
      totalStorageBytes
    };
  }

  /**
   * 创建事务快照。
   * 副作用: 不修改私有三层 Map，并将其转换为与构造种子同构的隔离普通对象。
   * 使用边界: 只供 MemorySourceRepositoryUnitOfWork 保存事务前状态。
   *
   * @returns {object} 全部 sourceId 和五分区的严格 JSON 隔离快照。
   */
  createSnapshot() {
    // 返回值类型: object。
    // 作用: 返回可由事务协调器保存和传回恢复入口、但不能污染内部 Map 的快照。
    return createStorageSnapshot(this.#namespacesBySourceId);
  }

  /**
   * 恢复事务快照。
   * 副作用: 快照完整校验成功后一次性替换全部私有命名空间。
   * 成功路径: 使用与构造种子相同的严格规则重建三层 Map。
   * 失败路径: 根对象、sourceId、分区、key 或 value 非法时抛领域错误，原状态保持不变。
   *
   * @param {object} snapshot createSnapshot 返回的事务快照。
   * @returns {void} 恢复通过私有根 Map 一次替换完成。
   * @throws {SourceRepositoryValidationError} 当快照不符合完整 Storage 种子契约时抛出。
   */
  restoreSnapshot(snapshot) {
    // 类型: Map<string, Map<string, Map<string, *>>>。
    // 作用: 在触碰当前状态前完整校验并重建候选三层 Map。
    const restoredNamespaces = createNamespacesMap(snapshot, 'storageSnapshot');

    // 副作用: 一次性替换当前实例全部私有命名空间。
    // 安全性: 只在候选状态完整建立后执行，失败快照不会形成半恢复状态。
    this.#namespacesBySourceId = restoredNamespaces;
  }
}
