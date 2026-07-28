/*
  indexedDbSourceStorageRepository.js 模块说明

  - 文件职责:
      实现五分区 SourceStorageRepository 的 IndexedDB 适配器，提供命名空间 CRUD、清理和真实容量摘要。
      使用 sourceId、partition、key 复合主键与两个索引隔离数据源，不保存页面容量占位或影子缓存。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      browserPersistence.config: 自定义配置，提供私有空间 store 和索引名称。
      createIndexedDbSourceRepositoryContext: 自定义内部访问器，统一单仓与绑定事务。
      sourceRepositoryUtils: 自定义工具，提供五分区、隔离复制、容量计算和清理分区集合。
      sourceRepositoryValidators: 自定义校验，验证动态 sourceId/key 和存储记录普通对象。

  - 模块级常量:
      STORAGE_RECORD_FIELDS: Array<string>，私有空间条目精确字段。
      SOURCE_STORAGE_PARTITION_NAMES: Array<string>，五分区稳定顺序。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeStorageIdentity(sourceId, partition, key): 校验复合主键输入。
      validateStorageRecord(record): 校验 IndexedDB 条目并返回原对象。
      createEmptyPartitionUsage(): 创建五分区零容量对象。

  - 模块级类:
      IndexedDbSourceStorageRepository: IndexedDB 五分区私有空间异步仓。

  - 对外导出:
      IndexedDbSourceStorageRepository: Class，供工厂、SourceContext 和 UnitOfWork 使用。
*/

import {
  // 导入来源: ../persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_INDEX；文件作用: 按 sourceId 或 sourceId/partition 查询复合记录。
  BROWSER_PERSISTENCE_INDEX,
  // 导入来源: ../persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_STORE；文件作用: 固定私有空间 object store。
  BROWSER_PERSISTENCE_STORE
} from '../persistence/browserPersistence.config.js';

// 导入来源: ./indexedDbSourceRepositoryContext.js；导入内容: createIndexedDbSourceRepositoryContext；文件作用: 统一单仓与绑定事务 object store 访问。
import { createIndexedDbSourceRepositoryContext } from './indexedDbSourceRepositoryContext.js';

import {
  // 导入来源: ./sourceRepositoryUtils.js；导入内容: SOURCE_RUNTIME_STORAGE_PARTITIONS；文件作用: clearAll 删除四个运行分区并保留 settings。
  SOURCE_RUNTIME_STORAGE_PARTITIONS,
  // 导入来源: ./sourceRepositoryUtils.js；导入内容: SOURCE_STORAGE_PARTITION；文件作用: 创建五分区容量摘要。
  SOURCE_STORAGE_PARTITION,
  // 导入来源: ./sourceRepositoryUtils.js；导入内容: SOURCE_TEMPORARY_STORAGE_PARTITIONS；文件作用: 派生临时缓存容量。
  SOURCE_TEMPORARY_STORAGE_PARTITIONS,
  // 导入来源: ./sourceRepositoryUtils.js；导入内容: assertSourceStoragePartition；文件作用: 拒绝未定义分区。
  assertSourceStoragePartition,
  // 导入来源: ./sourceRepositoryUtils.js；导入内容: cloneSerializableValue；文件作用: 隔离保存值和读取结果。
  cloneSerializableValue,
  // 导入来源: ./sourceRepositoryUtils.js；导入内容: getSerializableByteLength；文件作用: 使用与 Memory 相同 JSON UTF-8 容量口径。
  getSerializableByteLength
} from './sourceRepositoryUtils.js';

import {
  // 导入来源: ./sourceRepositoryValidators.js；导入内容: assertExactObjectKeys；文件作用: 检查条目没有未知持久化字段。
  assertExactObjectKeys,
  // 导入来源: ./sourceRepositoryValidators.js；导入内容: assertPlainObject；文件作用: 检查 IndexedDB 条目是普通对象。
  assertPlainObject,
  // 导入来源: ./sourceRepositoryValidators.js；导入内容: assertSafeRecordKey；文件作用: 校验 sourceId 和 storage key。
  assertSafeRecordKey
} from './sourceRepositoryValidators.js';

// 类型: Array<string>；作用: 固定私有空间复合记录只保存身份、分区、键和值。
const STORAGE_RECORD_FIELDS = Object.freeze(['sourceId', 'partition', 'key', 'value']);

// 类型: Array<string>；作用: 固定容量摘要和分区验证使用的五分区顺序。
const SOURCE_STORAGE_PARTITION_NAMES = Object.freeze(Object.values(SOURCE_STORAGE_PARTITION));

/**
 * 校验私有空间复合身份。
 * 纯函数: 不修改输入，返回可直接构造 IndexedDB 复合键的冻结对象。
 *
 * @param {string} sourceId 数据源稳定身份。
 * @param {string} partition 五分区之一。
 * @param {string} key 数据源自有存储键。
 * @returns {Readonly<object>} 已验证 sourceId、partition 和 key。
 */
function normalizeStorageIdentity(sourceId, partition, key) {
  return Object.freeze({
    sourceId: assertSafeRecordKey(sourceId, 'sourceId'),
    partition: assertSourceStoragePartition(partition),
    key: assertSafeRecordKey(key, 'storage key')
  });
}

/**
 * 校验 IndexedDB 私有空间条目。
 * 纯函数: 不修改记录；验证精确字段、复合身份和可隔离 value。
 *
 * @param {*} record object store 返回条目。
 * @returns {object} 原始已验证条目。
 */
function validateStorageRecord(record) {
  assertPlainObject(record, 'sourceStorageRecord');
  assertExactObjectKeys(record, STORAGE_RECORD_FIELDS, 'sourceStorageRecord');
  normalizeStorageIdentity(record.sourceId, record.partition, record.key);
  cloneSerializableValue(record.value, 'sourceStorageRecord.value');
  return record;
}

/**
 * 创建五分区零容量摘要。
 * 纯函数: 每次返回新对象，调用方可以在局部计算中安全累加。
 *
 * @returns {Record<string, number>} settings、credentials、session、cache、diagnostics 零值映射。
 */
function createEmptyPartitionUsage() {
  return SOURCE_STORAGE_PARTITION_NAMES.reduce((usage, partition) => {
    usage[partition] = 0;
    return usage;
  }, {});
}

/**
 * IndexedDB SourceStorage Repository。
 * 状态所有权: 只持有固定 sourceStorageEntries 上下文，不缓存命名空间或容量摘要。
 * 隔离边界: 所有方法显式接收 sourceId，Provider 仍只能通过绑定身份的 SourceStorageFacade 调用。
 */
export class IndexedDbSourceStorageRepository {
  // 类型: Readonly<object>；作用: 提供私有空间 store 的单仓或 UnitOfWork 绑定访问。
  #context;

  /**
   * 创建 Storage Repository。
   * 副作用: 只创建固定 store 上下文，不打开连接或读取数据。
   *
   * @param {object} options Repository 依赖。
   * @param {object} options.database BrowserPersistenceDatabase 门面。
   * @param {object|null} options.transaction UnitOfWork 绑定事务或 null。
   */
  constructor({ database, transaction = null }) {
    this.#context = createIndexedDbSourceRepositoryContext({
      database,
      transaction,
      storeName: BROWSER_PERSISTENCE_STORE.sourceStorageEntries
    });
  }

  /**
   * 读取一个私有空间值。
   * 副作用: 只查询复合主键。
   * 成功路径: 命中返回隔离 value，未命中返回 null。
   * 失败路径: 身份、分区、条目或数据库非法时 reject。
   *
   * @param {string} sourceId 数据源身份。
   * @param {string} partition 五分区名称。
   * @param {string} key 数据源存储键。
   * @returns {Promise<*|null>} 隔离保存值或 null。
   */
  async get(sourceId, partition, key) {
    // 类型: Readonly<object>；作用: 生成安全复合主键字段。
    const identity = normalizeStorageIdentity(sourceId, partition, key);
    return this.#context.read(async (store) => {
      // 类型: object|undefined；作用: 保存复合主键查询结果。
      const record = await store.get([identity.sourceId, identity.partition, identity.key]);
      // 条件分支: 当前复合键没有保存值时进入。
      // 执行内容: 按 Repository 契约返回 null。
      if (record === undefined) return null;
      validateStorageRecord(record);
      return cloneSerializableValue(record.value, 'sourceStorageValue');
    });
  }

  /**
   * 保存一个私有空间值。
   * 副作用: 在当前事务中 upsert 一个复合主键条目。
   * 成功路径: 严格 JSON Value 提交后返回隔离副本。
   * 失败路径: 身份、分区、值或事务非法时不提交候选。
   *
   * @param {string} sourceId 数据源身份。
   * @param {string} partition 五分区名称。
   * @param {string} key 数据源存储键。
   * @param {*} value 待保存严格 JSON Value。
   * @returns {Promise<*>} 提交后的隔离值。
   */
  async set(sourceId, partition, key, value) {
    // 类型: Readonly<object>；作用: 保存已验证复合身份，后续 put 不再读取可变调用参数。
    const identity = normalizeStorageIdentity(sourceId, partition, key);
    // 类型: *；作用: 保存严格 JSON Value 隔离副本，数据库和调用方不共享引用。
    const storedValue = cloneSerializableValue(value, 'sourceStorageValue');
    return this.#context.write(async (store) => {
      await store.put({ ...identity, value: storedValue });
      return cloneSerializableValue(storedValue, 'savedSourceStorageValue');
    });
  }

  /**
   * 删除一个私有空间值。
   * 副作用: 命中时删除一个复合主键条目。
   * 成功路径: 命中返回 true，未命中返回 false。
   * 失败路径: 身份、分区或事务非法时 reject。
   *
   * @param {string} sourceId 数据源身份。
   * @param {string} partition 五分区名称。
   * @param {string} key 数据源存储键。
   * @returns {Promise<boolean>} 是否删除既有条目。
   */
  async remove(sourceId, partition, key) {
    // 类型: Readonly<object>；作用: 删除前校验 sourceId、partition 和 key。
    const identity = normalizeStorageIdentity(sourceId, partition, key);
    // 类型: Array<string>；作用: 构造与 object store keyPath 一致的复合主键。
    const compoundKey = [identity.sourceId, identity.partition, identity.key];
    return this.#context.write(async (store) => {
      // 类型: IDBValidKey|undefined；作用: 判断复合键是否存在以保持未命中 false 语义。
      const existingKey = await store.getKey(compoundKey);
      // 条件分支: 当前复合键没有记录时进入。
      // 执行内容: 不发起 delete，明确返回 false。
      if (existingKey === undefined) return false;
      await store.delete(compoundKey);
      return true;
    });
  }

  /**
   * 列出一个数据源分区全部键值。
   * 副作用: 只通过 sourceId/partition 索引查询。
   * 成功路径: 返回主键顺序的隔离 { key, value } 数组，空分区返回空数组。
   * 失败路径: 身份、分区、条目或数据库非法时 reject。
   *
   * @param {string} sourceId 数据源身份。
   * @param {string} partition 五分区名称。
   * @returns {Promise<Array<object>>} 当前分区隔离键值数组。
   */
  async list(sourceId, partition) {
    // 类型: string；作用: 查询索引前校验数据源动态身份。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');
    // 类型: string；作用: 查询索引前收敛为正式五分区名称。
    const safePartition = assertSourceStoragePartition(partition);
    return this.#context.read(async (store) => {
      // 类型: Array<object>；作用: 保存当前 sourceId/partition 索引命中的完整条目集合。
      const records = await store.index(
        BROWSER_PERSISTENCE_INDEX.sourceStorageBySourcePartition
      ).getAll(IDBKeyRange.only([safeSourceId, safePartition]));
      return records.map((record) => {
        validateStorageRecord(record);
        return {
          key: record.key,
          value: cloneSerializableValue(record.value, 'sourceStorageListValue')
        };
      });
    });
  }

  /**
   * 清空一个数据源分区。
   * 副作用: 删除索引命中的全部复合主键记录。
   * 成功路径: 返回真实删除条目数，空分区返回 0。
   * 失败路径: 身份、分区或事务失败时不提交部分删除。
   *
   * @param {string} sourceId 数据源身份。
   * @param {string} partition 五分区名称。
   * @returns {Promise<number>} 删除条目数。
   */
  async clear(sourceId, partition) {
    // 类型: string；作用: 清理前校验目标数据源身份。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');
    // 类型: string；作用: 清理前校验目标属于正式五分区。
    const safePartition = assertSourceStoragePartition(partition);
    return this.#context.write(async (store) => {
      // 类型: Array<IDBValidKey>；作用: 收集目标分区全部复合主键，在同一事务逐项删除。
      const keys = await store.index(
        BROWSER_PERSISTENCE_INDEX.sourceStorageBySourcePartition
      ).getAllKeys(IDBKeyRange.only([safeSourceId, safePartition]));
      await Promise.all(keys.map(compoundKey => store.delete(compoundKey)));
      return keys.length;
    });
  }

  /**
   * 清理一个数据源全部运行缓存并保留 settings。
   * 副作用: 删除 credentials、session、cache 和 diagnostics 四分区条目。
   * 成功路径: 在同一事务完成四分区删除并返回总条目数。
   * 失败路径: 任一分区查询或删除失败时事务整体 abort。
   *
   * @param {string} sourceId 数据源身份。
   * @returns {Promise<number>} 四个运行分区删除总数。
   */
  async clearAll(sourceId) {
    // 类型: string；作用: 清理四个运行分区前校验目标数据源身份。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');
    return this.#context.write(async (store) => {
      // 类型: number；初始值: 0；作用: 累加四个运行分区真实删除条目数。
      let removedCount = 0;
      for (const partition of SOURCE_RUNTIME_STORAGE_PARTITIONS) {
        // 类型: Array<IDBValidKey>；作用: 保存当前运行分区全部复合主键，settings 不进入循环。
        const keys = await store.index(
          BROWSER_PERSISTENCE_INDEX.sourceStorageBySourcePartition
        ).getAllKeys(IDBKeyRange.only([safeSourceId, partition]));
        await Promise.all(keys.map(compoundKey => store.delete(compoundKey)));
        removedCount += keys.length;
      }
      return removedCount;
    });
  }

  /**
   * 删除一个数据源完整私有命名空间。
   * 副作用: 删除 sourceId 索引命中的五分区全部条目。
   * 成功路径: 有记录返回 true，无记录返回 false。
   * 失败路径: sourceId 或事务非法时不提交部分删除。
   *
   * @param {string} sourceId 数据源身份。
   * @returns {Promise<boolean>} 是否删除至少一个条目。
   */
  async removeSource(sourceId) {
    // 类型: string；作用: 删除完整命名空间前校验目标数据源身份。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');
    return this.#context.write(async (store) => {
      // 类型: Array<IDBValidKey>；作用: 通过 sourceId 索引收集五分区全部复合主键。
      const keys = await store.index(
        BROWSER_PERSISTENCE_INDEX.sourceStorageBySourceId
      ).getAllKeys(IDBKeyRange.only(safeSourceId));
      await Promise.all(keys.map(compoundKey => store.delete(compoundKey)));
      return keys.length > 0;
    });
  }

  /**
   * 计算一个数据源五分区真实容量摘要。
   * 副作用: 只查询 sourceId 索引，不写入或缓存计算结果。
   * 成功路径: 返回五分区、临时缓存、全部运行缓存和总空间字节数。
   * 失败路径: sourceId、条目或数据库非法时 reject，不跳过损坏值。
   *
   * @param {string} sourceId 数据源身份。
   * @returns {Promise<object>} SourceStorageUsage 隔离对象。
   */
  async getUsage(sourceId) {
    // 类型: string；作用: 容量查询前校验目标数据源身份。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');
    return this.#context.read(async (store) => {
      // 类型: Array<object>；作用: 保存当前 sourceId 五分区全部条目，空命名空间为空数组。
      const records = await store.index(
        BROWSER_PERSISTENCE_INDEX.sourceStorageBySourceId
      ).getAll(IDBKeyRange.only(safeSourceId));
      // 类型: Record<string, number>；作用: 逐条累加五分区严格 JSON Value UTF-8 字节数。
      const partitions = createEmptyPartitionUsage();
      records.forEach((record) => {
        validateStorageRecord(record);
        partitions[record.partition] += getSerializableByteLength(record.value);
      });
      // 类型: number；作用: cache 与 diagnostics 容量之和，映射页面临时缓存摘要。
      const temporaryCacheBytes = SOURCE_TEMPORARY_STORAGE_PARTITIONS.reduce((sum, partition) => {
        return sum + partitions[partition];
      }, 0);
      // 类型: number；作用: 四个运行分区容量之和，映射页面全部缓存摘要。
      const totalCacheBytes = SOURCE_RUNTIME_STORAGE_PARTITIONS.reduce((sum, partition) => {
        return sum + partitions[partition];
      }, 0);
      // 类型: number；作用: 五分区总容量，仅用于内部配额控制。
      const totalStorageBytes = SOURCE_STORAGE_PARTITION_NAMES.reduce((sum, partition) => {
        return sum + partitions[partition];
      }, 0);
      return {
        sourceId: safeSourceId,
        partitions,
        temporaryCacheBytes,
        totalCacheBytes,
        totalStorageBytes
      };
    });
  }
}
