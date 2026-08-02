/*
  source-storage-facade.test.js 模块说明

  - 文件职责:
      验证 SourceStorageFacade 的五分区结构、sourceId 绑定、跨源隔离、精确参数、引用隔离和失败边界。

  - 导入库及文件汇总(6 条，内置 2 条，第三方 0 条，自定义 4 条):
      assert: 内置模块，执行结构、保存态、错误和引用断言。
      test: 内置模块，注册 Node 领域测试。
      MemorySourceStorageRepository: 自定义 Repository，提供真实五分区内存保存态。
      SourceRepositoryValidationError: 自定义 Repository 错误，用于制造依赖 validation。
      Shell errors: 自定义错误，验证 validation 和 operation/cause。
      createSourceStorageFacade: 自定义 Shell 门面工厂，被测对象。

  - 模块级常量:
      STORAGE_TEST_SOURCE_IDS: Array<string>，两个隔离测试 sourceId。
      STORAGE_PARTITION_NAMES: Array<string>，门面五分区稳定顺序。
      STORAGE_METHOD_NAMES: Array<string>，单分区五方法稳定集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createFacadePair(): Function，创建共享 Repository 的双 sourceId 门面。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言对象。
// 文件作用: 比较门面结构、Repository 保存态、返回值和错误。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册 SourceStorageFacade 领域测试。
import test from 'node:test';

// 导入来源: ../src/repositories/source/memorySourceStorageRepository.js。
// 导入内容: MemorySourceStorageRepository 五分区内存实现。
// 文件作用: 使用真实 Repository 证明门面不保存影子状态。
import { MemorySourceStorageRepository } from '../src/repositories/source/memorySourceStorageRepository.js';

// 导入来源: ../src/repositories/source/sourceRepositoryErrors.js。
// 导入内容: SourceRepositoryValidationError Repository 校验错误。
// 文件作用: 验证门面把 Repository validation 转换为 Shell validation。
import { SourceRepositoryValidationError } from '../src/repositories/source/sourceRepositoryErrors.js';

import {
  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellOperationError Storage 基础设施错误。
  // 文件作用: 验证非校验失败包装并保留 cause。
  SourceShellOperationError,

  // 导入来源: ../src/runtime/source-shell/sourceShellErrors.js。
  // 导入内容: SourceShellValidationError Storage 输入错误。
  // 文件作用: 验证额外参数、危险键和非法依赖统一失败。
  SourceShellValidationError
} from '../src/runtime/source-shell/sourceShellErrors.js';

// 导入来源: ../src/runtime/source-shell/sourceStorageFacade.js。
// 导入内容: createSourceStorageFacade 五分区门面工厂。
// 文件作用: 创建被测双源隔离门面。
import { createSourceStorageFacade } from '../src/runtime/source-shell/sourceStorageFacade.js';

// 类型: Array<string>。
// 作用: 两个门面共享 Repository 但绑定不同 sourceId，供跨源隔离断言。
const STORAGE_TEST_SOURCE_IDS = Object.freeze([
  // 类型: string。
  // 作用: 第一门面绑定身份，与当前系统模拟源 id 保持一致。
  'system-source-1',

  // 类型: string。
  // 作用: 第二门面绑定身份，用于证明同 Repository 下的跨源隔离。
  'system-source-2'
]);

// 类型: Array<string>。
// 作用: 固定门面根对象五分区顺序和精确集合。
const STORAGE_PARTITION_NAMES = Object.freeze([
  // 类型: string。
  // 作用: 普通非敏感设置分区，供输入输出引用隔离用例使用。
  'settings',

  // 类型: string。
  // 作用: 敏感运行凭据分区，结构测试确认门面稳定暴露该能力。
  'credentials',

  // 类型: string。
  // 作用: 挑战和连续请求上下文分区，结构测试确认五分区完整。
  'session',

  // 类型: string。
  // 作用: 可重新生成缓存分区，双源隔离和失败边界用例主要操作该分区。
  'cache',

  // 类型: string。
  // 作用: 有界诊断记录分区，结构测试确认五分区稳定顺序。
  'diagnostics'
]);

// 类型: Array<string>。
// 作用: 固定每个分区门面的五个公开方法。
const STORAGE_METHOD_NAMES = Object.freeze([
  // 类型: string。
  // 作用: 读取当前闭包分区单个键的公开方法名。
  'get',

  // 类型: string。
  // 作用: 写入当前闭包分区单个严格 JSON Value 的公开方法名。
  'set',

  // 类型: string。
  // 作用: 删除当前闭包分区单个键的公开方法名。
  'remove',

  // 类型: string。
  // 作用: 列出当前闭包分区全部隔离条目的公开方法名。
  'list',

  // 类型: string。
  // 作用: 清理当前闭包分区全部键的公开方法名。
  'clear'
]);

/**
 * 创建共享同一 Memory Repository 的双 sourceId 门面。
 * 副作用: 只创建空内存 Repository 和闭包，不写入任何分区值。
 *
 * @returns {object} Repository、第一源门面和第二源门面。
 * @returns {MemorySourceStorageRepository} return.storageRepository 两个门面共享的唯一内存保存权威。
 * @returns {object} return.firstFacade 绑定 系统数据源1 的五分区冻结门面。
 * @returns {object} return.secondFacade 绑定 系统数据源2 的五分区冻结门面。
 */
function createFacadePair() {
  // 类型: MemorySourceStorageRepository。
  // 作用: 保存两个门面的唯一私有空间权威，初始命名空间为空。
  const storageRepository = new MemorySourceStorageRepository();

  // 类型: object。
  // 作用: 绑定第一 sourceId 的五分区门面。
  const firstFacade = createSourceStorageFacade({
    // 类型: string。
    // 作用: 把第一测试身份永久绑定到门面闭包。
    sourceId: STORAGE_TEST_SOURCE_IDS[0],

    // 类型: MemorySourceStorageRepository。
    // 作用: 两个门面共享同一保存权威，跨源隔离由 Repository 的 sourceId 命名空间证明。
    storageRepository
  });

  // 类型: object。
  // 作用: 绑定第二 sourceId 的五分区门面。
  const secondFacade = createSourceStorageFacade({
    // 类型: string。
    // 作用: 把第二测试身份永久绑定到门面闭包。
    sourceId: STORAGE_TEST_SOURCE_IDS[1],

    // 类型: MemorySourceStorageRepository。
    // 作用: 与第一门面共享保存权威，避免使用两个 Repository 伪造隔离结果。
    storageRepository
  });

  // 返回值类型: object。
  // 作用: 返回共享 Repository 和两个闭包门面，供结构、隔离、失败和引用测试复用。
  return {
    // 类型: MemorySourceStorageRepository。
    // 作用: 提供真实保存态和可控失败注入入口。
    storageRepository,

    // 类型: object。
    // 作用: 提供绑定第一 sourceId 的五分区门面。
    firstFacade,

    // 类型: object。
    // 作用: 提供绑定第二 sourceId 的五分区门面。
    secondFacade
  };
}

// 测试目的: 门面根对象和五个分区必须使用精确字段、同构方法并全部冻结。
test('SourceStorageFacade 提供冻结五分区同构方法', () => {
  // 类型: object。
  // 作用: 创建第一源门面供结构检查。
  const { firstFacade } = createFacadePair();

  // 断言作用: 根对象字段顺序与五分区契约完全一致，并且根对象被冻结。
  assert.deepEqual(Object.keys(firstFacade), STORAGE_PARTITION_NAMES);
  assert.equal(Object.isFrozen(firstFacade), true);

  // 循环类型: Array.prototype.forEach。
  // 初始值: settings 分区名称。
  // 终止条件: 五个固定分区全部完成结构检查。
  // 循环作用: 验证每个分区都暴露相同五方法集合并冻结。
  STORAGE_PARTITION_NAMES.forEach((partition) => {
    // 断言作用: 当前分区的方法字段与稳定集合一致，调用方不能获得额外能力。
    assert.deepEqual(Object.keys(firstFacade[partition]), STORAGE_METHOD_NAMES);
    assert.equal(Object.isFrozen(firstFacade[partition]), true);

    // 循环类型: Array.prototype.forEach。
    // 初始值: get 方法名。
    // 终止条件: 当前分区五个公开方法全部完成类型检查。
    // 循环作用: 证明方法字段不是静态占位值，而是可调用函数。
    STORAGE_METHOD_NAMES.forEach((methodName) => {
      // 断言作用: 当前分区的目标方法必须是函数。
      assert.equal(typeof firstFacade[partition][methodName], 'function');
    });
  });
});

// 测试目的: 两个 sourceId 在相同分区和 key 下读写、列出和清理必须互不泄漏。
test('SourceStorageFacade 绑定 sourceId 并隔离双源同键数据', async () => {
  // 类型: object。
  // 作用: 创建共享 Repository 的双源门面。
  const { storageRepository, firstFacade, secondFacade } = createFacadePair();

  // 异步调用: 两个门面向同一 cache 分区和同一 key 写入不同 owner。
  // 成功结果: Repository 应按闭包 sourceId 保存为两个独立命名空间。
  await firstFacade.cache.set('shared-key', {
    // 类型: string。
    // 作用: 标识第一门面写入值所属 sourceId，供跨源读取断言比较。
    owner: STORAGE_TEST_SOURCE_IDS[0]
  });
  await secondFacade.cache.set('shared-key', {
    // 类型: string。
    // 作用: 标识第二门面写入值所属 sourceId，必须与第一源同键值隔离。
    owner: STORAGE_TEST_SOURCE_IDS[1]
  });

  // 断言作用: 两个门面读取同名 key 时只能得到各自 owner，第一门面 list 也不能包含第二源值。
  assert.deepEqual(await firstFacade.cache.get('shared-key'), {
    // 类型: string。
    // 作用: 期望第一门面读取结果仍标识第一 sourceId。
    owner: STORAGE_TEST_SOURCE_IDS[0]
  });
  assert.deepEqual(await secondFacade.cache.get('shared-key'), {
    // 类型: string。
    // 作用: 期望第二门面读取结果仍标识第二 sourceId。
    owner: STORAGE_TEST_SOURCE_IDS[1]
  });
  assert.deepEqual(await firstFacade.cache.list(), [{
    // 类型: string。
    // 作用: 期望列表条目保留当前分区真实 key。
    key: 'shared-key',

    // 类型: object。
    // 作用: 期望列表值只包含第一门面保存的数据。
    value: {
      // 类型: string。
      // 作用: 期望嵌套 owner 仍标识第一 sourceId。
      owner: STORAGE_TEST_SOURCE_IDS[0]
    }
  }]);

  // 断言作用: 第一门面清理只删除自身 cache；第二门面值和 Repository usage 保持存在。
  assert.equal(await firstFacade.cache.clear(), 1);
  assert.equal(await firstFacade.cache.get('shared-key'), null);
  assert.deepEqual(await secondFacade.cache.get('shared-key'), {
    // 类型: string。
    // 作用: 第一源清理后第二源同键值仍必须保留第二 sourceId。
    owner: STORAGE_TEST_SOURCE_IDS[1]
  });
  assert.equal((await storageRepository.getUsage(STORAGE_TEST_SOURCE_IDS[0])).partitions.cache, 0);
  assert.ok((await storageRepository.getUsage(STORAGE_TEST_SOURCE_IDS[1])).partitions.cache > 0);
});

// 测试目的: 方法必须拒绝额外 sourceId、缺参、危险键和非法 JSON Value，不能静默忽略输入。
test('SourceStorageFacade 严格拒绝额外参数和危险输入', async () => {
  // 类型: object。
  // 作用: 创建第一源门面供参数和 validation 攻击。
  const { firstFacade } = createFacadePair();

  // 断言作用: get/list/clear 不能接收额外 sourceId，调用方无法覆盖闭包身份。
  await assert.rejects(firstFacade.cache.get(STORAGE_TEST_SOURCE_IDS[1], 'key'), SourceShellValidationError);
  await assert.rejects(firstFacade.cache.list(STORAGE_TEST_SOURCE_IDS[1]), SourceShellValidationError);
  await assert.rejects(firstFacade.cache.clear(STORAGE_TEST_SOURCE_IDS[1]), SourceShellValidationError);

  // 断言作用: set 缺值、危险 key、undefined 值和 remove 危险 key 均转换为稳定 Shell validation。
  await assert.rejects(firstFacade.cache.set('only-key'), SourceShellValidationError);
  await assert.rejects(firstFacade.cache.set('__proto__', 'unsafe'), SourceShellValidationError);
  await assert.rejects(firstFacade.cache.set('invalid', undefined), SourceShellValidationError);
  await assert.rejects(firstFacade.cache.remove('constructor'), SourceShellValidationError);
});

// 测试目的: set/get/list 返回值和调用方输入必须与 Repository 及后续查询保持引用隔离。
test('SourceStorageFacade 隔离输入、单值输出和列表输出引用', async () => {
  // 类型: object。
  // 作用: 创建第一源门面供多层引用篡改测试。
  const { firstFacade } = createFacadePair();

  // 类型: object。
  // 作用: 保存调用方原始嵌套值，set 后修改不能污染 Repository。
  const input = {
    // 类型: object。
    // 作用: 提供实际被修改的嵌套引用，验证 Repository 和门面执行深层隔离。
    nested: {
      // 类型: string。
      // 作用: 保存初始值，调用方后续修改后 Repository 仍应保留该文本。
      value: 'stored'
    }
  };

  // 类型: object。
  // 作用: 保存 set 返回副本，修改后不能污染 Repository。
  const storedResult = await firstFacade.settings.set('profile', input);

  // 副作用范围: 只修改调用方输入和首次返回对象。
  input.nested.value = 'changed-input';
  storedResult.nested.value = 'changed-result';

  // 断言作用: 调用方输入和 set 返回对象均不能穿透 Repository 保存值。
  assert.deepEqual(await firstFacade.settings.get('profile'), {
    // 类型: object。
    // 作用: 期望查询仍返回独立嵌套对象。
    nested: {
      // 类型: string。
      // 作用: 期望保存值没有被调用方两次篡改污染。
      value: 'stored'
    }
  });

  // 类型: Array<object>。
  // 作用: 保存 list 返回条目，修改后不能污染后续 get/list。
  const entries = await firstFacade.settings.list();

  // 副作用范围: 只修改调用方列表条目和嵌套值。
  entries[0].key = 'changed-key';
  entries[0].value.nested.value = 'changed-list';

  // 断言作用: list 返回条目修改不能改变后续 get 或下一次 list 结果。
  assert.deepEqual(await firstFacade.settings.get('profile'), {
    // 类型: object。
    // 作用: 期望查询仍返回未污染嵌套对象。
    nested: {
      // 类型: string。
      // 作用: 期望列表篡改后保存值继续保持初始文本。
      value: 'stored'
    }
  });
  assert.deepEqual(await firstFacade.settings.list(), [{
    // 类型: string。
    // 作用: 期望列表 key 没有被首次列表返回对象篡改。
    key: 'profile',

    // 类型: object。
    // 作用: 期望列表 value 是新的隔离对象。
    value: {
      // 类型: object。
      // 作用: 期望嵌套对象没有复用首次列表引用。
      nested: {
        // 类型: string。
        // 作用: 期望嵌套值继续保持 Repository 初始保存文本。
        value: 'stored'
      }
    }
  }]);
});

// 测试目的: Repository validation 转 Shell validation，基础设施失败保留 cause，失败后同门面后续调用仍可执行。
test('SourceStorageFacade 统一失败边界并保持后续调用可用', async () => {
  // 类型: object。
  // 作用: 创建第一源门面和可注入失败的 Repository。
  const { storageRepository, firstFacade } = createFacadePair();

  // 类型: Function。
  // 作用: 保存真实 get 方法，一次失败后恢复后续查询。
  const originalGet = storageRepository.get.bind(storageRepository);

  // 类型: Error。
  // 作用: 模拟非校验基础设施失败并验证 operation cause。
  const infrastructureCause = new Error('storage dependency failed');

  // 类型: number。
  // 作用: 第一次 get 抛基础设施失败，第二次及以后委托真实 Repository。
  let getAttempt = 0;

  /**
   * 注入一次性 Repository get 基础设施失败。
   * 副作用: 覆盖当前隔离测试实例的 get；第一次抛固定 cause，后续委托真实方法。
   * 成功路径: 第二次及后续调用返回 originalGet 的真实异步结果。
   * 失败路径: 第一次调用抛 infrastructureCause，供门面包装 operation。
   *
   * @param {...*} args 原 Repository get 的 sourceId、partition 和 key 参数。
   * @returns {Promise<*>} 第一次之后的真实 Repository 查询结果。
   * @throws {Error} 第一次调用时抛固定基础设施错误。
   */
  storageRepository.get = async (...args) => {
    // 副作用范围: 只递增当前测试局部计数，决定一次性失败与恢复分支。
    getAttempt += 1;

    // 条件分支: 当前是第一次 get 调用时进入。
    // 执行内容: 抛固定基础设施错误，门面应包装 operation 并保留 cause。
    if (getAttempt === 1) {
      throw infrastructureCause;
    }

    // 返回值类型: Promise<*>。
    // 作用: 失败一次后恢复真实 Repository get，证明门面实例没有中毒状态。
    return originalGet(...args);
  };

  // 断言作用: 第一次基础设施失败必须包装为 operation 并保留同一 cause。
  await assert.rejects(firstFacade.cache.get('missing'), (error) => {
    // 返回值类型: boolean。
    // 作用: 只有错误分类和 cause 同时正确时接受本次拒绝断言。
    return error instanceof SourceShellOperationError && error.cause === infrastructureCause;
  });

  // 断言作用: 同门面第二次调用恢复真实查询并返回未命中 null。
  assert.equal(await firstFacade.cache.get('missing'), null);

  /**
   * 注入固定 Repository validation 失败。
   * 副作用: 覆盖当前隔离测试实例的 get，不影响其他测试或生产实现。
   * 成功路径: 无，本函数专门制造 Repository 校验拒绝。
   * 失败路径: 每次调用抛 SourceRepositoryValidationError。
   *
   * @returns {Promise<never>} 当前测试注入函数始终拒绝。
   * @throws {SourceRepositoryValidationError} 每次调用均抛固定 Repository validation。
   */
  storageRepository.get = async () => {
    throw new SourceRepositoryValidationError('repository validation');
  };

  // 断言作用: Repository validation 必须转换为 Shell validation 并保留原始 Repository cause。
  await assert.rejects(firstFacade.cache.get('key'), (error) => {
    // 返回值类型: boolean。
    // 作用: 只有外层和 cause 分类同时正确时接受本次拒绝断言。
    return error instanceof SourceShellValidationError
      && error.cause instanceof SourceRepositoryValidationError;
  });
});
