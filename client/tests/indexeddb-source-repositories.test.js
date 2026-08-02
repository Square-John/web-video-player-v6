/*
  indexeddb-source-repositories.test.js 模块说明

  - 文件职责:
      使用 fake-indexeddb 验证三个 IndexedDB Source Repository 与 Memory 契约一致，并验证四仓 UnitOfWork 原子提交和 abort。
      覆盖引用隔离、未命中、五分区同键隔离、两级清理、完整删除和事务失败后无部分保存。

  - 导入库及文件汇总(9 条，内置 2 条，第三方 1 条，自定义 6 条):
      node:assert/strict: 内置断言，验证 CRUD、容量和原子事务结果。
      node:test: 内置测试运行器，声明异步 Repository 用例。
      fake-indexeddb/auto: 第三方测试 IndexedDB 实现。
      BrowserPersistenceDatabase: 自定义数据库门面，提供真实 idb 事务。
      createIndexedDbSourceRepositories: 自定义工厂，被测三仓与 UnitOfWork。
      SourceRepositoryTransactionError: 自定义错误，验证 abort 后稳定事务失败。
      builtinSourceCatalogRelease/LEGACY_PRODUCT_SOURCE_IDS/RETIRED_BUILTIN_SOURCE_IDS/sourceRepositorySeeds: 自定义数据，提供目录发布、迁移身份和正式数据源首次种子。
      userContentMockData: 自定义数据，满足单数据库首次种子输入。
      SOURCE_STORAGE_PARTITION: 自定义配置，提供五分区稳定名称。

  - 模块级常量:
      TEST_DATABASE_PREFIX: string，测试数据库名称前缀。

  - 模块级变量:
      databaseSequence: number，测试进程内数据库递增序号。

  - 模块级辅助函数:
      createHarness(): 创建已初始化数据库与完整 IndexedDB Repository 基础设施。
      createSourceGraph(sourceId): 从正式种子创建同源 Package、Definition 和 Preferences 候选。

  - 模块级类:
      无

  - 对外导出:
      无
*/

// 导入来源: node:assert/strict；导入内容: assert；文件作用: 验证 Repository 与事务不变量。
import assert from 'node:assert/strict';
// 导入来源: node:test；导入内容: test；文件作用: 声明独立异步测试。
import test from 'node:test';
// 导入来源: fake-indexeddb/auto；导入内容: Node IndexedDB 全局实现；文件作用: 运行真实 object store、索引和事务行为。
import 'fake-indexeddb/auto';

// 导入来源: ../src/repositories/persistence/browserPersistenceDatabase.js；导入内容: BrowserPersistenceDatabase；文件作用: 创建测试数据库门面。
import { BrowserPersistenceDatabase } from '../src/repositories/persistence/browserPersistenceDatabase.js';
// 导入来源: ../src/repositories/source/createIndexedDbSourceRepositories.js；导入内容: createIndexedDbSourceRepositories；文件作用: 创建被测基础设施。
import { createIndexedDbSourceRepositories } from '../src/repositories/source/createIndexedDbSourceRepositories.js';
// 导入来源: ../src/repositories/source/sourceRepositoryErrors.js；导入内容: SourceRepositoryTransactionError；文件作用: 验证跨仓失败已完成 abort。
import { SourceRepositoryTransactionError } from '../src/repositories/source/sourceRepositoryErrors.js';
// 导入来源: ../src/repositories/source/sourceRepositoryUtils.js；导入内容: SOURCE_STORAGE_PARTITION；文件作用: 使用正式五分区名称。
import { SOURCE_STORAGE_PARTITION } from '../src/repositories/source/sourceRepositoryUtils.js';
import {
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: builtinSourceCatalogRelease；文件作用: 满足数据库独立目录发布输入。
  builtinSourceCatalogRelease,
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: LEGACY_PRODUCT_SOURCE_IDS；文件作用: 满足数据库初始化 v3 精确迁移输入。
  LEGACY_PRODUCT_SOURCE_IDS,
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: RETIRED_BUILTIN_SOURCE_IDS；文件作用: 满足数据库初始化 v20 精确退役输入。
  RETIRED_BUILTIN_SOURCE_IDS,
  // 导入来源: ../src/data/settings/source-repository.seed.js；导入内容: sourceRepositorySeeds；文件作用: 提供已验证当前种子和候选基准。
  sourceRepositorySeeds
} from '../src/data/settings/source-repository.seed.js';
// 导入来源: ../src/data/user-content.mock.js；导入内容: userContentMockData；文件作用: 满足单数据库初始化的用户内容种子。
import { userContentMockData } from '../src/data/user-content.mock.js';

// 类型: string；作用: 隔离正式数据库和其他测试进程的数据名称前缀。
const TEST_DATABASE_PREFIX = 'indexeddb-source-repositories-';
// 类型: number；生命周期: 当前测试模块；作用: 为每个 harness 生成唯一数据库名称。
let databaseSequence = 0;

/**
 * 创建已初始化 IndexedDB Repository 测试环境。
 * 副作用: 创建唯一 fake-indexeddb 数据库、写入首次种子并装配三仓与 UnitOfWork。
 * 成功路径: 返回 database 和四项 Repository 基础设施。
 * 失败路径: schema、种子或工厂失败时 reject，不返回部分环境。
 *
 * @returns {Promise<object>} database、packageRepository、definitionRepository、storageRepository 和 unitOfWork。
 */
async function createHarness() {
  databaseSequence += 1;
  // 类型: BrowserPersistenceDatabase；作用: 当前用例唯一单连接数据库门面。
  const database = new BrowserPersistenceDatabase({
    databaseName: `${TEST_DATABASE_PREFIX}${databaseSequence}`,
    databaseVersion: 1
  });
  await database.initialize({
    sourceSeeds: structuredClone(sourceRepositorySeeds),
    userContentSeed: structuredClone(userContentMockData),
    builtinCatalogRelease: structuredClone(builtinSourceCatalogRelease),
    legacyProductSourceIds: LEGACY_PRODUCT_SOURCE_IDS,
    retiredBuiltinSourceIds: RETIRED_BUILTIN_SOURCE_IDS
  });
  return { database, ...createIndexedDbSourceRepositories({ database }) };
}

/**
 * 从正式种子创建一组同源保存候选。
 * 纯函数: 深拷贝种子，不修改共享模块；返回字段满足 Package、Definition 和 Preferences 契约。
 *
 * @param {string} sourceId 候选数据源唯一身份。
 * @returns {object} sourcePackage、sourceDefinition 和 sourcePreferences。
 */
function createSourceGraph(sourceId) {
  // 类型: object；作用: 创建候选 sourceId 独占的完整 Package 保存对象。
  const sourcePackage = structuredClone(sourceRepositorySeeds.packages[0]);
  sourcePackage.packageRef = `source-package::${sourceId}`;
  sourcePackage.sourceId = sourceId;
  sourcePackage.providerKey = `${sourceId}.provider`;
  // 类型: object；作用: 创建与候选 Package 身份、引用和 providerKey 一致的 Definition。
  const sourceDefinition = structuredClone(sourceRepositorySeeds.definitions[0]);
  sourceDefinition.id = sourceId;
  sourceDefinition.name = `测试数据源 ${sourceId}`;
  sourceDefinition.packageRef = sourcePackage.packageRef;
  sourceDefinition.providerKey = sourcePackage.providerKey;
  // 类型: object；作用: 在现有用户偏好中加入候选源的关闭和待授权决定。
  const sourcePreferences = structuredClone(sourceRepositorySeeds.preferences);
  sourcePreferences.sourceStates[sourceId] = {
    enabled: false,
    authorization: {
      status: 'pending',
      authorizedAt: '',
      authorizedVersion: '',
      authorizedScriptHash: ''
    }
  };
  return { sourcePackage, sourceDefinition, sourcePreferences };
}

test('IndexedDB Package 与 Definition 仓保持 CRUD 和引用隔离', async () => {
  // 类型: object；作用: 提供当前 CRUD 用例独占数据库和 Repository 基础设施。
  const harness = await createHarness();
  // 类型: Array<object>；作用: 读取 Package 集合并通过外部修改验证返回引用隔离。
  const packages = await harness.packageRepository.loadAll();
  // 类型: Array<object>；作用: 读取 Definition 集合并通过外部修改验证返回引用隔离。
  const definitions = await harness.definitionRepository.loadDefinitions();
  assert.equal(packages.length, sourceRepositorySeeds.packages.length);
  assert.equal(definitions.length, sourceRepositorySeeds.definitions.length);
  packages[0].sourceId = 'mutated';
  definitions[0].name = 'mutated';
  assert.notEqual((await harness.packageRepository.loadAll())[0].sourceId, 'mutated');
  assert.notEqual((await harness.definitionRepository.loadDefinitions())[0].name, 'mutated');

  // 类型: object；作用: 提供新增 Package、Definition 和 Preferences 的一致保存候选。
  const graph = createSourceGraph('repository-crud');
  assert.deepEqual(await harness.packageRepository.save(graph.sourcePackage), graph.sourcePackage);
  assert.deepEqual(
    await harness.definitionRepository.saveDefinition(graph.sourceDefinition),
    graph.sourceDefinition
  );
  assert.deepEqual(
    await harness.definitionRepository.savePreferences(graph.sourcePreferences),
    graph.sourcePreferences
  );
  assert.equal(await harness.packageRepository.remove('missing-package'), false);
  assert.equal(await harness.definitionRepository.removeDefinition('missing-source'), false);
  await harness.database.deleteDatabase();
});

test('IndexedDB Storage 仓隔离五分区并保持两级清理边界', async () => {
  // 类型: object；作用: 提供当前 Storage 用例独占数据库和五分区 Repository。
  const harness = await createHarness();
  await harness.storageRepository.set('storage-a', SOURCE_STORAGE_PARTITION.settings, 'same', { value: 1 });
  await harness.storageRepository.set('storage-a', SOURCE_STORAGE_PARTITION.cache, 'same', { value: 2 });
  await harness.storageRepository.set('storage-b', SOURCE_STORAGE_PARTITION.cache, 'same', { value: 3 });
  assert.deepEqual(
    await harness.storageRepository.get('storage-a', SOURCE_STORAGE_PARTITION.cache, 'same'),
    { value: 2 }
  );
  assert.equal((await harness.storageRepository.list('storage-a', SOURCE_STORAGE_PARTITION.cache)).length, 1);
  // 类型: object；作用: 验证 settings 与 cache 使用相同值口径但归入不同容量摘要。
  const usageBefore = await harness.storageRepository.getUsage('storage-a');
  assert.ok(usageBefore.totalStorageBytes > usageBefore.totalCacheBytes);
  assert.equal(await harness.storageRepository.clearAll('storage-a'), 1);
  assert.deepEqual(
    await harness.storageRepository.get('storage-a', SOURCE_STORAGE_PARTITION.settings, 'same'),
    { value: 1 }
  );
  assert.deepEqual(
    await harness.storageRepository.get('storage-b', SOURCE_STORAGE_PARTITION.cache, 'same'),
    { value: 3 }
  );
  assert.equal(await harness.storageRepository.removeSource('storage-a'), true);
  assert.equal(await harness.storageRepository.removeSource('storage-a'), false);
  await harness.database.deleteDatabase();
});

test('IndexedDB UnitOfWork 四仓要么全部提交要么全部 abort', async () => {
  // 类型: object；作用: 提供当前原子事务用例独占数据库、三仓和 UnitOfWork。
  const harness = await createHarness();
  // 类型: object；作用: 第一笔事务应完整提交的同源保存图。
  const committedGraph = createSourceGraph('transaction-commit');
  await harness.unitOfWork.runInTransaction(async (repositories) => {
    await repositories.packageRepository.save(committedGraph.sourcePackage);
    await repositories.definitionRepository.saveDefinition(committedGraph.sourceDefinition);
    await repositories.definitionRepository.savePreferences(committedGraph.sourcePreferences);
    await repositories.storageRepository.set(
      committedGraph.sourceDefinition.id,
      SOURCE_STORAGE_PARTITION.settings,
      'mode',
      'committed'
    );
  });
  assert.ok(await harness.packageRepository.get(committedGraph.sourcePackage.packageRef));
  assert.ok(await harness.definitionRepository.getDefinition(committedGraph.sourceDefinition.id));

  // 类型: object；作用: 第二笔事务在显式失败后必须从四仓全部消失的候选图。
  const abortedGraph = createSourceGraph('transaction-abort');
  await assert.rejects(
    harness.unitOfWork.runInTransaction(async (repositories) => {
      await repositories.packageRepository.save(abortedGraph.sourcePackage);
      await repositories.definitionRepository.saveDefinition(abortedGraph.sourceDefinition);
      await repositories.storageRepository.set(
        abortedGraph.sourceDefinition.id,
        SOURCE_STORAGE_PARTITION.settings,
        'mode',
        'aborted'
      );
      throw new Error('force unit of work abort');
    }),
    error => error instanceof SourceRepositoryTransactionError
  );
  assert.equal(await harness.packageRepository.get(abortedGraph.sourcePackage.packageRef), null);
  assert.equal(await harness.definitionRepository.getDefinition(abortedGraph.sourceDefinition.id), null);
  assert.equal(
    await harness.storageRepository.get(
      abortedGraph.sourceDefinition.id,
      SOURCE_STORAGE_PARTITION.settings,
      'mode'
    ),
    null
  );
  await harness.database.deleteDatabase();
});
