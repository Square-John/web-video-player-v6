/*
  source-repositories.test.js 模块说明

  - 文件职责:
      使用 Node 内置测试验证严格校验器、三个 Memory Repository、mock 种子转换和 Unit of Work。
      由 npm run build 调用，阻止有损 JSON 输入、字段契约漂移、引用穿透和半完成事务进入生产代码。

  - 导入库及文件汇总(13 条，内置 3 条，第三方 0 条，自定义 10 条):
      assert: 内置模块，提供严格断言。
      readFile: 内置模块，读取工厂和种子源码执行依赖边界静态回归。
      test: 内置模块，注册 Node 测试。
      builtinSourceCatalog: 自定义产品目录，提供当前单文件 manifest 和 raw 文本，不携带运行工厂。
      createBuiltinSourceRepositorySeeds/sourceRepositorySeeds: 自定义产品种子，提供目录转换和默认分离保存图。
      normalizeSourceScriptContent: 自定义授权工具，比较 raw 原文件和 Package 规范化文本。
      createMemorySourceRepositories: 自定义服务，装配三个仓库和 Unit of Work。
      MemorySourcePackageRepository、MemorySourceDefinitionRepository、MemorySourceStorageRepository: 自定义服务，被测内存仓。
      SOURCE_STORAGE_PARTITION、cloneSerializableValue、getSerializableByteLength: 自定义工具，测试五分区、无损隔离复制和精确容量。
      SourceRepositoryConflictError、SourceRepositoryTransactionError、SourceRepositoryValidationError: 自定义错误，被测失败类型。
      assertPlainObject、assertSafeRecordKey: 自定义校验函数，测试普通对象和动态键边界。
      validateSourceAuthorization、validateSourceDefinition、validateSourcePackage、validateSourcePreferences: 自定义领域校验函数，测试冻结保存契约。

  - 模块级常量:
      SOURCE_ID: string，测试数据源 id。
      PACKAGE_REF: string，测试包引用。
      SOURCE_PACKAGE: object，测试脚本包。
      SOURCE_DEFINITION: object，测试 Definition。
      SOURCE_PREFERENCES: object，测试偏好。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createSmallRepositories(): 创建不依赖大 mock 容量的测试仓库。
      createPackageFixture(overrides): 创建引用独立的 SourcePackage 测试夹具。
      createDefinitionFixture(overrides): 创建引用独立的 SourceDefinition 测试夹具。
      createPreferencesFixture(overrides): 创建引用独立的 SourcePreferences 测试夹具。
      createStorageNamespaceFixture(overrides): 创建引用独立的完整五分区测试夹具。
      createDeferred(): 创建可由测试精确放行的 Promise 控制器。
      saveTransactionSource(repositories, sourceId): 在事务上下文中写入三仓关联数据。
      createCircularValue(): 创建循环引用攻击性夹具。
      createHiddenPropertyValue(): 创建带隐藏字段的攻击性夹具。
      verifyStrictJsonValidation(): 验证严格 JSON Value 和无损复制。
      verifyRepositoryDomainValidation(): 验证 Package、Definition、Preferences 和授权契约。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert Node 严格断言模块。
// 文件作用: 比较 Repository 结果、错误类型和引用隔离行为。
import assert from 'node:assert/strict';

// 导入来源: node:fs/promises。
// 导入内容: readFile 异步文件读取函数。
// 文件作用: 静态扫描工厂和种子源码，防止反向依赖与容量占位实现回归。
import { readFile } from 'node:fs/promises';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 把同步和异步契约场景注册到 npm test 流程。
import test from 'node:test';

// 导入来源: ../src/data/settings/builtin-source-catalog.js。
// 导入内容: builtinSourceCatalog 当前真实内置源目录。
// 文件作用: 验证 Package 与 Definition 从同一物理文件组成产品种子，且目录不保存运行工厂旁路。
import { builtinSourceCatalog } from '../src/data/settings/builtin-source-catalog.js';

import {
  // 导入来源: ../src/data/settings/source-repository.seed.js。
  // 导入内容: createBuiltinSourceRepositorySeeds 内置目录转换函数。
  // 文件作用: 对隔离当前目录执行严格产品保存图转换测试。
  createBuiltinSourceRepositorySeeds,

  // 导入来源: ../src/data/settings/source-repository.seed.js。
  // 导入内容: sourceRepositorySeeds 默认 Repository 种子。
  // 文件作用: 验证当前九条 mock 记录的默认装配结果。
  sourceRepositorySeeds
} from '../src/data/settings/source-repository.seed.js';

// 导入来源: ../src/utils/sourceAuthorization.js；导入内容: normalizeSourceScriptContent；文件作用: 以正式规则比较 raw 原文件和 Package 文本。
import { normalizeSourceScriptContent } from '../src/utils/sourceAuthorization.js';

// 导入来源: ../src/repositories/source/createMemorySourceRepositories.js。
// 导入内容: createMemorySourceRepositories Memory 基础设施工厂。
// 文件作用: 为 Repository 和 Unit of Work 测试创建独立实例。
import { createMemorySourceRepositories } from '../src/repositories/source/createMemorySourceRepositories.js';

// 导入来源: ../src/repositories/source/memorySourcePackageRepository.js。
// 导入内容: MemorySourcePackageRepository 脚本包内存仓。
// 文件作用: 验证包查询、保存、冲突和引用隔离。
import { MemorySourcePackageRepository } from '../src/repositories/source/memorySourcePackageRepository.js';

// 导入来源: ../src/repositories/source/memorySourceDefinitionRepository.js。
// 导入内容: MemorySourceDefinitionRepository 定义和偏好内存仓。
// 文件作用: 验证 Definition 与 Preferences 查询和隔离。
import { MemorySourceDefinitionRepository } from '../src/repositories/source/memorySourceDefinitionRepository.js';

// 导入来源: ../src/repositories/source/memorySourceStorageRepository.js。
// 导入内容: MemorySourceStorageRepository 私有空间内存仓。
// 文件作用: 验证分区、容量和清理行为。
import { MemorySourceStorageRepository } from '../src/repositories/source/memorySourceStorageRepository.js';

import {
  // 导入来源: ../src/repositories/source/sourceRepositoryUtils.js。
  // 导入内容: SOURCE_STORAGE_PARTITION 五分区枚举。
  // 文件作用: 测试使用正式分区值，避免散落字符串。
  SOURCE_STORAGE_PARTITION,

  // 导入来源: ../src/repositories/source/sourceRepositoryUtils.js。
  // 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
  // 文件作用: 验证合法值无损复制和非法值明确失败。
  cloneSerializableValue,

  // 导入来源: ../src/repositories/source/sourceRepositoryUtils.js。
  // 导入内容: getSerializableByteLength 严格 JSON Value 容量函数。
  // 文件作用: 精确验证 Storage 五分区和两级缓存摘要字节数。
  getSerializableByteLength
} from '../src/repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../src/repositories/source/sourceRepositoryErrors.js。
  // 导入内容: SourceRepositoryConflictError 唯一关联冲突错误。
  // 文件作用: 验证 packageRef 冲突使用稳定领域错误。
  SourceRepositoryConflictError,

  // 导入来源: ../src/repositories/source/sourceRepositoryErrors.js。
  // 导入内容: SourceRepositoryTransactionError 跨仓事务错误。
  // 文件作用: 验证事务失败完成回滚后统一包装异常。
  SourceRepositoryTransactionError,

  // 导入来源: ../src/repositories/source/sourceRepositoryErrors.js。
  // 导入内容: SourceRepositoryValidationError Repository 校验错误。
  // 文件作用: 验证严格 JSON、领域字段、分区和动态键失败类型。
  SourceRepositoryValidationError
} from '../src/repositories/source/sourceRepositoryErrors.js';

import {
  // 导入来源: ../src/repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 普通对象校验函数。
  // 文件作用: 验证 Date、Map、Set 和自定义类不会被误认为 JSON 对象。
  assertPlainObject,

  // 导入来源: ../src/repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertSafeRecordKey 动态键校验函数。
  // 文件作用: 验证原型敏感 sourceId 和 Storage key 被明确拒绝。
  assertSafeRecordKey,

  // 导入来源: ../src/repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourceAuthorization 授权快照校验函数。
  // 文件作用: 验证 authorized 状态必须包含完整时间、版本和哈希。
  validateSourceAuthorization,

  // 导入来源: ../src/repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourceDefinition Definition 校验函数。
  // 文件作用: 验证数据源类型、导入方式和六类能力契约。
  validateSourceDefinition,

  // 导入来源: ../src/repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourcePackage SourcePackage 校验函数。
  // 文件作用: 验证包身份、脚本文本和完整性字段。
  validateSourcePackage,

  // 导入来源: ../src/repositories/source/sourceRepositoryValidators.js。
  // 导入内容: validateSourcePreferences SourcePreferences 校验函数。
  // 文件作用: 验证默认源、每源启用决定和授权快照。
  validateSourcePreferences
} from '../src/repositories/source/sourceRepositoryValidators.js';

// 类型: string。
// 作用: 给全部小型仓库测试提供稳定 sourceId。
const SOURCE_ID = 'repository-test-source';

// 类型: string。
// 作用: 给包、Definition 和事务测试提供同一引用。
const PACKAGE_REF = `source-package::${SOURCE_ID}`;

// 类型: object。
// 作用: 最小 SourcePackage 测试夹具。
const SOURCE_PACKAGE = Object.freeze({
  // 类型: string。
  // 作用: 作为 Package Repository 唯一查询键，并与 Definition.packageRef 建立关联。
  packageRef: PACKAGE_REF,

  // 类型: string。
  // 作用: 表示脚本包保存结构版本，不与业务版本混用。
  schemaVersion: '1.0.0',

  // 类型: string。
  // 作用: 标识脚本包所属数据源，供跨对象关联和删除事务校验。
  sourceId: SOURCE_ID,

  // 类型: string。
  // 作用: 指向项目内可信模拟 Provider 工厂，后续由执行宿主消费。
  providerKey: 'mock-source-provider',

  // 类型: string。
  // 作用: 提供可导出和计算指纹的最小测试脚本文本，本阶段不会执行该文本。
  scriptContent: 'export default {};',

  // 类型: object。
  // 作用: 保存脚本文本指纹算法和结果，供包变化检测测试使用。
  integrity: {
    // 类型: string；作用: 标识当前测试内容使用全领域统一 SHA-256 算法。
    algorithm: 'sha-256',
    // 类型: string；作用: 保存 `export default {};` 规范化文本对应的 64 位摘要。
    scriptHash: '9f085b1079ab38f776bbb3930dfd067a838ca3e0483aff8625f88837e8ed964c'
  }
});

// 类型: object。
// 作用: 最小 SourceDefinition 测试夹具。
const SOURCE_DEFINITION = Object.freeze({
  // 类型: string；作用: 标识 Definition 保存结构版本。
  schemaVersion: '1.0.0',
  // 类型: string；作用: 保存跨设置页、Repository 和私有空间共用的数据源 id。
  id: SOURCE_ID,
  // 类型: string；作用: 提供测试和错误信息使用的数据源名称。
  name: 'Repository 测试源',
  // 类型: string；作用: 说明该夹具用于验证 Memory Repository 契约。
  description: '验证 Memory Repository 契约。',
  // 类型: string；作用: 使用系统源枚举，验证内置源 Definition 保存路径。
  sourceKind: 'system',
  // 类型: string；作用: 作为页面展示和授权比较使用的唯一业务版本。
  version: 'v1.0.0',
  // 类型: string；作用: 与 SourcePackage.providerKey 保持同一可信工厂引用。
  providerKey: 'mock-source-provider',
  // 类型: string；作用: 关联 SOURCE_PACKAGE，供跨 Repository 测试使用。
  packageRef: PACKAGE_REF,
  // 类型: string；作用: 标识该测试源随应用内置，不来自用户导入。
  importMethod: 'builtin',
  // 类型: string；作用: 内置源没有远程更新地址，使用空字符串。
  remoteUrl: '',
  // 类型: string；作用: 提供稳定首次导入时间，验证必填时间字段。
  importedAt: '2026-07-14T00:00:00.000Z',
  // 类型: string；作用: 提供稳定本地更新时间，验证必填时间字段。
  lastUpdatedAt: '2026-07-14T00:00:00.000Z',
  // 类型: object。
  // 作用: 完整声明六类页面能力，验证缺失、未知和非 Boolean 能力都会失败。
  capabilities: {
    // 类型: boolean；true 表示支持首页数据；false 表示不支持首页数据。
    home: true,
    // 类型: boolean；true 表示支持电影目录；false 表示不支持电影目录。
    movie: true,
    // 类型: boolean；true 表示支持电视剧目录；false 表示不支持电视剧目录。
    tv: true,
    // 类型: boolean；true 表示支持搜索；false 表示不支持搜索。
    search: true,
    // 类型: boolean；true 表示支持详情；false 表示不支持详情。
    detail: true,
    // 类型: boolean；true 表示支持播放；false 表示不支持播放。
    play: true
  },
  // 类型: Array<object>。
  // 作用: 当前测试源没有普通非敏感设置，空数组验证合法空 Schema。
  settingsSchema: []
});

// 类型: object。
// 作用: 最小 SourcePreferences 测试夹具。
const SOURCE_PREFERENCES = Object.freeze({
  // 类型: string；作用: 标识偏好保存结构版本。
  schemaVersion: '1.0.0',
  // 类型: string；作用: 把当前测试源设为默认源，用于偏好读取和事务测试。
  defaultSourceId: SOURCE_ID,
  // 类型: Array<string>；作用: 当前没有软隐藏系统源，使用空数组。
  removedSystemSourceIds: [],
  // 类型: Record<string, object>。
  // 作用: 按 sourceId 保存用户启用决定和授权快照。
  sourceStates: {
    // 类型: object。
    // 作用: 保存当前测试源的用户级偏好，不混入 Definition。
    [SOURCE_ID]: {
      // 类型: boolean。
      // true: 用户希望该源启用；false: 用户希望该源关闭。
      enabled: true,
      // 类型: object。
      // 作用: 保存用户对当前版本和脚本文本的授权快照。
      authorization: {
        // 类型: string；作用: 标识当前测试脚本已经获得用户授权。
        status: 'authorized',
        // 类型: string；作用: 保存用户确认当前脚本风险的时间。
        authorizedAt: '2026-07-14T00:00:00.000Z',
        // 类型: string；作用: 保存授权时业务版本，用于后续有效性比较。
        authorizedVersion: 'v1.0.0',
        // 类型: string；作用: 复用当前 Package 的 SHA-256，验证授权快照和脚本文本使用同一指纹。
        authorizedScriptHash: SOURCE_PACKAGE.integrity.scriptHash
      }
    }
  }
});

/**
 * 创建引用独立的 SourcePackage 测试夹具。
 * 纯函数: 不修改模块级 SOURCE_PACKAGE；每次返回新的根对象和 integrity 对象。
 *
 * @param {object} overrides 待覆盖的包字段；默认不覆盖。
 * @returns {object} 可安全修改的完整 SourcePackage 测试夹具。
 */
function createPackageFixture(overrides = {}) {
  // 返回值类型: object。
  // 作用: 复制嵌套完整性对象，避免引用隔离测试污染模块级基准夹具。
  return {
    ...SOURCE_PACKAGE,
    integrity: { ...SOURCE_PACKAGE.integrity },
    ...overrides
  };
}

/**
 * 创建引用独立的 SourceDefinition 测试夹具。
 * 纯函数: 不修改模块级 SOURCE_DEFINITION；每次返回新的能力对象和设置 Schema 数组。
 *
 * @param {object} overrides 待覆盖的 Definition 字段；默认不覆盖。
 * @returns {object} 可安全修改的完整 SourceDefinition 测试夹具。
 */
function createDefinitionFixture(overrides = {}) {
  // 返回值类型: object。
  // 作用: 复制全部可变嵌套字段，让构造输入和查询结果污染测试互不影响。
  return {
    ...SOURCE_DEFINITION,
    capabilities: { ...SOURCE_DEFINITION.capabilities },
    settingsSchema: [...SOURCE_DEFINITION.settingsSchema],
    ...overrides
  };
}

/**
 * 创建引用独立的 SourcePreferences 测试夹具。
 * 纯函数: 不修改模块级 SOURCE_PREFERENCES；每次重建软隐藏数组、sourceStates 和授权快照。
 *
 * @param {object} overrides 待覆盖的 Preferences 顶层字段；默认不覆盖。
 * @returns {object} 可安全修改的完整 SourcePreferences 测试夹具。
 */
function createPreferencesFixture(overrides = {}) {
  // 返回值类型: object。
  // 作用: 复制偏好对象的全部当前嵌套层级，供保存输入和输出隔离测试修改。
  return {
    ...SOURCE_PREFERENCES,
    removedSystemSourceIds: [...SOURCE_PREFERENCES.removedSystemSourceIds],
    sourceStates: {
      [SOURCE_ID]: {
        ...SOURCE_PREFERENCES.sourceStates[SOURCE_ID],
        authorization: {
          ...SOURCE_PREFERENCES.sourceStates[SOURCE_ID].authorization
        }
      }
    },
    ...overrides
  };
}

/**
 * 创建引用独立的完整五分区 Storage 命名空间夹具。
 * 纯函数: 每次重建五个分区和全部嵌套测试值，不修改其他测试夹具。
 *
 * @param {object} overrides 待覆盖的分区对象；默认保留完整五分区。
 * @returns {object} 可用于构造种子、快照和外部引用修改的完整命名空间。
 */
function createStorageNamespaceFixture(overrides = {}) {
  // 返回值类型: object。
  // 作用: 提供五个职责不同且包含嵌套值的分区，支持隔离、usage 和清理测试。
  return {
    // 类型: object。
    // 作用: 保存普通非敏感质量设置，两级缓存清理都必须保留。
    settings: {
      quality: { mode: 'auto' }
    },

    // 类型: object。
    // 作用: 保存模拟凭据值，clearAll 应当清理。
    credentials: {
      token: { value: 'secret' }
    },

    // 类型: object。
    // 作用: 保存模拟验证会话，clearAll 应当清理。
    session: {
      challenge: { id: 'challenge-01' }
    },

    // 类型: object。
    // 作用: 保存可重新生成页面缓存，临时摘要和 clearAll 都包含该分区。
    cache: {
      page: { items: ['item-01'] }
    },

    // 类型: object。
    // 作用: 保存诊断摘要，临时摘要和 clearAll 都包含该分区。
    diagnostics: {
      lastCheck: { ok: true }
    },

    ...overrides
  };
}

/**
 * 创建可控 Promise 控制器。
 * 副作用: 只创建当前测试局部 Promise，并把 resolve/reject 保存到返回对象。
 * 使用场景: 精确暂停和放行 FIFO 事务，不依赖 setTimeout 或运行速度猜测顺序。
 *
 * @returns {object} Deferred 控制器。
 * @returns {Promise<*>} return.promise 由测试等待的可控 Promise。
 * @returns {Function} return.resolve 让 promise fulfilled 的控制函数。
 * @returns {Function} return.reject 让 promise rejected 的控制函数。
 */
function createDeferred() {
  // 类型: Function。
  // 作用: 保存 Promise resolve，创建完成后由测试流程主动放行等待点。
  let resolvePromise;

  // 类型: Function。
  // 作用: 保存 Promise reject，供需要模拟等待点失败的测试使用。
  let rejectPromise;

  // 类型: Promise<*>。
  // 作用: 提供不会自行完成的等待点，消除定时器和执行速度造成的不确定性。
  const promise = new Promise((resolve, reject) => {
    // 赋值内容: 保存当前 Promise 的 resolve 控制函数。
    resolvePromise = resolve;

    // 赋值内容: 保存当前 Promise 的 reject 控制函数。
    rejectPromise = reject;
  });

  // 返回值类型: object。
  // 作用: 返回等待 Promise 和两个精确控制函数。
  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise
  };
}

/**
 * 在事务上下文中写入一组关联的 Package、Definition 和 Storage 数据。
 * 副作用: 依次写入 executor 收到的三个 Repository，用于验证成功提交和跨仓回滚。
 * 成功路径: 三仓写入全部完成后返回 sourceId 与 packageRef。
 * 失败路径: 任一 Repository 拒绝写入时原样抛错，由 Unit of Work 负责恢复事务快照。
 *
 * @param {object} repositories Unit of Work 传给 executor 的事务上下文。
 * @param {object} repositories.packageRepository Package Repository。
 * @param {object} repositories.definitionRepository Definition Repository。
 * @param {object} repositories.storageRepository Storage Repository。
 * @param {string} sourceId 当前事务测试数据源 id。
 * @returns {Promise<object>} 写入后的关联标识。
 * @returns {string} return.sourceId 当前事务数据源 id。
 * @returns {string} return.packageRef 当前事务脚本包引用。
 */
async function saveTransactionSource({
  packageRepository,
  definitionRepository,
  storageRepository
}, sourceId) {
  // 类型: string。
  // 作用: 让当前事务写入的 Package 和 Definition 使用同一稳定包引用。
  const packageRef = `source-package::${sourceId}`;

  // 异步写入: 保存当前事务脚本包。
  // 失败路径: Package 校验或冲突时 reject，由 Unit of Work 统一回滚。
  await packageRepository.save(createPackageFixture({
    packageRef,
    sourceId,
    integrity: {
      ...SOURCE_PACKAGE.integrity,
      scriptHash: `hash-${sourceId}`
    }
  }));

  // 异步写入: 保存关联同一 packageRef 的 Definition。
  // 失败路径: Definition 校验或引用冲突时 reject，由 Unit of Work 统一回滚。
  await definitionRepository.saveDefinition(createDefinitionFixture({
    id: sourceId,
    name: `事务测试源 ${sourceId}`,
    packageRef
  }));

  // 异步写入: 在当前 sourceId settings 分区保存事务标记。
  // 失败路径: Storage 地址或值非法时 reject，由 Unit of Work 统一回滚。
  await storageRepository.set(
    sourceId,
    SOURCE_STORAGE_PARTITION.settings,
    'transactionMarker',
    { sourceId }
  );

  // 返回值类型: object。
  // 作用: 让事务测试验证 executor 成功结果由 runInTransaction 原样传递。
  return {
    sourceId,
    packageRef
  };
}

/**
 * 创建小型 Memory Repository 集合。
 * 副作用: 只创建测试内存对象，不修改共享默认种子。
 *
 * @returns {object} 三个 Repository 和 Unit of Work。
 */
function createSmallRepositories() {
  return createMemorySourceRepositories({
    packages: [SOURCE_PACKAGE],
    definitions: [SOURCE_DEFINITION],
    preferences: SOURCE_PREFERENCES,
    storageNamespaces: {
      [SOURCE_ID]: {
        settings: { quality: 'auto' },
        credentials: {},
        session: {},
        cache: {},
        diagnostics: {}
      }
    }
  });
}

/**
 * 创建循环引用攻击性夹具。
 * 副作用: 只在新对象内部建立 self 引用，不修改模块级测试夹具。
 *
 * @returns {object} self 指向对象自身的循环结构。
 */
function createCircularValue() {
  // 类型: object。
  // 作用: 创建独立普通对象，随后用于验证递归校验的循环引用检测。
  const circularValue = {};

  // 副作用: 建立对象到自身的引用；该对象只存在于当前测试调用中。
  circularValue.self = circularValue;

  // 返回值类型: object。
  // 作用: 返回 JSON.stringify 无法处理的循环结构攻击性夹具。
  return circularValue;
}

/**
 * 创建包含 JSON 会忽略字段的攻击性夹具。
 * 副作用: 使用 defineProperty 在新对象上增加不可枚举字段，不修改共享状态。
 *
 * @returns {object} 包含不可枚举 hidden 字段的普通对象。
 */
function createHiddenPropertyValue() {
  // 类型: object。
  // 作用: 创建原型正常但属性描述符不符合严格 JSON Value 的测试对象。
  const hiddenPropertyValue = {};

  // 副作用: 增加 JSON.stringify 会静默忽略的不可枚举字段，用于验证校验器提前拒绝。
  Object.defineProperty(hiddenPropertyValue, 'hidden', {
    // 类型: string。
    // 作用: 作为不可枚举字段内容，证明字段不能在复制后静默消失。
    value: 'must-not-disappear',

    // 类型: boolean。
    // true: 字段会进入 Object.keys 和 JSON。
    // false: 字段会被 JSON 忽略，本测试明确使用 false 触发校验失败。
    enumerable: false
  });

  // 返回值类型: object。
  // 作用: 返回带隐藏字段的攻击性夹具。
  return hiddenPropertyValue;
}

/**
 * 验证严格 JSON Value 和无损隔离复制。
 * 纯函数: 只创建局部夹具和断言，不修改 Repository、默认种子或页面状态。
 * 成功路径: 合法 JSON Value 保持字段和值并获得新引用。
 * 失败路径: JSON 会删除、转换或改变语义的输入统一抛 SourceRepositoryValidationError。
 *
 * @returns {void} 断言通过后结束。
 */
function verifyStrictJsonValidation() {
  // 类型: object。
  // 作用: 覆盖严格 JSON Value 允许的 null、字符串、有限数字、Boolean、数组和普通对象。
  const validValue = {
    text: 'value',
    count: 0,
    enabled: false,
    empty: null,
    items: [1, 'two', true, null, { nested: 'value' }]
  };

  // 类型: object。
  // 作用: 保存合法值的隔离副本，用于同时验证数据无损和引用分离。
  const clonedValue = cloneSerializableValue(validValue, 'validValue');

  // 断言内容: 克隆结果字段和值与输入完全一致。
  assert.deepEqual(clonedValue, validValue);
  // 断言内容: 顶层和嵌套对象均不是原输入引用。
  assert.notStrictEqual(clonedValue, validValue);
  assert.notStrictEqual(clonedValue.items[4], validValue.items[4]);

  // 类型: Array<*>。
  // 作用: 汇总 JSON 会静默删除、转换、调用或无法序列化的攻击性输入。
  const invalidValues = [
    undefined,
    () => 'function-value',
    Symbol('symbol-value'),
    BigInt(1),
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -0,
    new Date('2026-07-15T00:00:00.000Z'),
    new Map([['key', 'value']]),
    new Set(['value']),
    Object.create({ inherited: true }),
    createCircularValue(),
    createHiddenPropertyValue(),
    { nestedUndefined: undefined },
    {
      /**
       * 提供嵌套函数攻击字段。
       * 纯函数: 不读取或修改状态。
       * @returns {void} 无返回值。
       */
      nestedFunction() {}
    }
  ];

  // 类型: Array<*>。
  // 作用: 创建 JSON 会转换为空数组项或忽略附加属性的数组攻击性输入。
  const sparseArray = [];
  sparseArray.length = 1;

  // 类型: Array<*>。
  // 作用: 携带非索引附加属性，验证 JSON 会忽略的数组元数据被严格拒绝。
  const arrayWithMetadata = [];
  arrayWithMetadata.metadata = 'ignored-by-json';
  invalidValues.push(sparseArray, arrayWithMetadata);

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 保证每类有损输入都在复制前得到同一领域校验错误。
  invalidValues.forEach((invalidValue, invalidIndex) => {
    assert.throws(
      () => cloneSerializableValue(invalidValue, `invalidValues[${invalidIndex}]`),
      SourceRepositoryValidationError
    );
  });

  // 断言内容: 复杂对象不能绕过普通对象边界。
  assert.throws(() => assertPlainObject(new Date(), 'dateValue'), SourceRepositoryValidationError);
  assert.throws(() => assertPlainObject(new Map(), 'mapValue'), SourceRepositoryValidationError);
  assert.throws(() => assertPlainObject(new Set(), 'setValue'), SourceRepositoryValidationError);
}

/**
 * 验证 Repository 领域对象的完整字段契约。
 * 纯函数: 只组合隔离测试对象并执行校验，不写入 Repository。
 * 成功路径: 合法 Package、Definition、Preferences 和授权快照通过。
 * 失败路径: 非法枚举、能力、授权字段、Boolean 和动态键统一抛 ValidationError。
 *
 * @returns {void} 断言通过后结束。
 */
function verifyRepositoryDomainValidation() {
  // 断言内容: 当前最小测试夹具满足步骤 2 冻结契约。
  assert.strictEqual(validateSourcePackage(SOURCE_PACKAGE), SOURCE_PACKAGE);
  assert.strictEqual(validateSourceDefinition(SOURCE_DEFINITION), SOURCE_DEFINITION);
  assert.strictEqual(validateSourcePreferences(SOURCE_PREFERENCES), SOURCE_PREFERENCES);
  assert.strictEqual(
    validateSourceAuthorization(SOURCE_PREFERENCES.sourceStates[SOURCE_ID].authorization),
    SOURCE_PREFERENCES.sourceStates[SOURCE_ID].authorization
  );

  // 断言内容: SourcePackage 脚本文本缺失时不能被 JSON 静默删除。
  assert.throws(
    () => validateSourcePackage({ ...SOURCE_PACKAGE, scriptContent: undefined }),
    SourceRepositoryValidationError
  );

  // 断言内容: Definition 只接受集中定义的数据源类型和导入方式。
  assert.throws(
    () => validateSourceDefinition({ ...SOURCE_DEFINITION, sourceKind: 'invalid-kind' }),
    SourceRepositoryValidationError
  );
  assert.throws(
    () => validateSourceDefinition({ ...SOURCE_DEFINITION, importMethod: 'invalid-method' }),
    SourceRepositoryValidationError
  );

  // 类型: object。
  // 作用: 删除 play 能力，验证缺失能力不能被当成 false 静默保存。
  const incompleteCapabilities = { ...SOURCE_DEFINITION.capabilities };
  delete incompleteCapabilities.play;
  assert.throws(
    () => validateSourceDefinition({ ...SOURCE_DEFINITION, capabilities: incompleteCapabilities }),
    SourceRepositoryValidationError
  );

  // 断言内容: 能力必须是严格 Boolean，不能接受字符串真值。
  assert.throws(
    () => validateSourceDefinition({
      ...SOURCE_DEFINITION,
      capabilities: { ...SOURCE_DEFINITION.capabilities, home: 'true' }
    }),
    SourceRepositoryValidationError
  );

  // 断言内容: 未更新正式契约时不能增加未知页面能力。
  assert.throws(
    () => validateSourceDefinition({
      ...SOURCE_DEFINITION,
      capabilities: { ...SOURCE_DEFINITION.capabilities, unknown: false }
    }),
    SourceRepositoryValidationError
  );

  // 断言内容: authorized 状态必须具备时间、版本和脚本哈希完整快照。
  assert.throws(
    () => validateSourceAuthorization({
      status: 'authorized',
      authorizedAt: '',
      authorizedVersion: '',
      authorizedScriptHash: ''
    }),
    SourceRepositoryValidationError
  );

  // 断言内容: 授权对象不能携带未进入冻结契约的影子字段。
  assert.throws(
    () => validateSourceAuthorization({
      ...SOURCE_PREFERENCES.sourceStates[SOURCE_ID].authorization,
      trustedByRuntime: true
    }),
    SourceRepositoryValidationError
  );

  // 断言内容: enabled 必须是 Boolean，字符串 false 不能被强制转换为 true。
  assert.throws(
    () => validateSourcePreferences({
      ...SOURCE_PREFERENCES,
      sourceStates: {
        [SOURCE_ID]: {
          ...SOURCE_PREFERENCES.sourceStates[SOURCE_ID],
          enabled: 'false'
        }
      }
    }),
    SourceRepositoryValidationError
  );

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 验证三个原型敏感名称都不能进入动态记录键边界。
  ['__proto__', 'constructor', 'prototype'].forEach((unsafeKey) => {
    assert.throws(
      () => assertSafeRecordKey(unsafeKey, 'unsafeKey'),
      SourceRepositoryValidationError
    );
  });

  // 断言内容: 默认源 id 同样执行动态键安全校验。
  assert.throws(
    () => validateSourcePreferences({ ...SOURCE_PREFERENCES, defaultSourceId: '__proto__' }),
    SourceRepositoryValidationError
  );
}

// 测试注册: 验证严格 JSON Value 和隔离复制根因修复。
test('Repository 严格 JSON Value 校验拒绝静默数据损坏', verifyStrictJsonValidation);

// 测试注册: 验证步骤 2 冻结的 Repository 领域字段契约。
test('Repository 领域校验覆盖包、定义、偏好和授权快照', verifyRepositoryDomainValidation);

// 测试目的: 包仓库的构造输入、查询结果、列表结果和保存结果都不能穿透私有 Map。
test('MemorySourcePackageRepository 提供完整 CRUD 和引用隔离', async () => {
  // 类型: object。
  // 作用: 使用可变种子验证构造函数会在保存前切断外部嵌套引用。
  const packageSeed = createPackageFixture();

  // 类型: MemorySourcePackageRepository。
  // 作用: 创建只包含一个脚本包的独立被测仓库。
  const repository = new MemorySourcePackageRepository([packageSeed]);

  // 副作用: 修改构造输入的脚本哈希；Repository 内部值必须保持初始内容。
  packageSeed.integrity.scriptHash = 'changed-seed-outside';
  assert.equal(
    (await repository.get(PACKAGE_REF)).integrity.scriptHash,
    SOURCE_PACKAGE.integrity.scriptHash
  );

  // 断言内容: 旧公开字段不再存在，调用方不能直接取得内部 Map。
  assert.equal('packagesByRef' in repository, false);

  // 类型: object。
  // 作用: 修改单项查询结果，验证 get 返回值与私有保存态隔离。
  const firstRead = await repository.get(PACKAGE_REF);
  firstRead.integrity.scriptHash = 'changed-get-result';
  assert.equal(
    (await repository.get(PACKAGE_REF)).integrity.scriptHash,
    SOURCE_PACKAGE.integrity.scriptHash
  );

  // 类型: Array<object>。
  // 作用: 修改列表和列表条目，验证 loadAll 不暴露内部数组或包引用。
  const packageList = await repository.loadAll();
  packageList[0].scriptContent = 'changed-list-result';
  packageList.push(createPackageFixture({
    packageRef: 'source-package::external-only',
    sourceId: 'external-only'
  }));
  assert.equal((await repository.loadAll()).length, 1);
  assert.equal((await repository.get(PACKAGE_REF)).scriptContent, SOURCE_PACKAGE.scriptContent);

  // 类型: object。
  // 作用: 保存同一 sourceId 的新包内容，验证正式 upsert 和保存输入隔离。
  const updatedPackage = createPackageFixture({
    scriptContent: 'export default { version: 2 };',
    integrity: { ...SOURCE_PACKAGE.integrity, scriptHash: 'updated' }
  });

  // 类型: object。
  // 作用: 保存返回值用于验证返回对象也不是私有 Map 内部引用。
  const savedPackage = await repository.save(updatedPackage);
  updatedPackage.integrity.scriptHash = 'changed-save-input';
  savedPackage.integrity.scriptHash = 'changed-save-result';
  assert.equal((await repository.get(PACKAGE_REF)).integrity.scriptHash, 'updated');

  // 断言内容: 合法查询未命中返回 null，删除命中返回 true，重复删除返回 false。
  assert.equal(await repository.get('source-package::missing'), null);
  assert.equal(await repository.remove(PACKAGE_REF), true);
  assert.equal(await repository.remove(PACKAGE_REF), false);
  assert.deepEqual(await repository.loadAll(), []);
});

// 测试目的: 包构造种子和运行时保存必须共用完整校验，并拒绝静默覆盖和跨源改绑。
test('MemorySourcePackageRepository 拒绝非法种子、重复引用和跨源冲突', async () => {
  // 断言内容: 构造阶段的完整包字段缺失必须使用集中 ValidationError 失败。
  assert.throws(
    () => new MemorySourcePackageRepository([
      createPackageFixture({ scriptContent: undefined })
    ]),
    SourceRepositoryValidationError
  );

  // 断言内容: 即使两条包内容相同，重复 packageRef 也不能在构造阶段静默覆盖。
  assert.throws(
    () => new MemorySourcePackageRepository([
      createPackageFixture(),
      createPackageFixture()
    ]),
    SourceRepositoryConflictError
  );

  // 类型: MemorySourcePackageRepository。
  // 作用: 验证运行时 save 对同一 packageRef 的 sourceId 改绑保持冲突语义。
  const repository = new MemorySourcePackageRepository([createPackageFixture()]);
  await assert.rejects(
    () => repository.save(createPackageFixture({ sourceId: 'another-source' })),
    SourceRepositoryConflictError
  );

  // 断言内容: 运行时 save 使用与构造种子相同的完整包字段校验。
  await assert.rejects(
    () => repository.save(createPackageFixture({ providerKey: '' })),
    SourceRepositoryValidationError
  );

  // 断言内容: 冲突和校验失败后原包归属与内容保持不变。
  assert.equal((await repository.get(PACKAGE_REF)).sourceId, SOURCE_ID);
  assert.equal((await repository.loadAll()).length, 1);
});

// 测试目的: 包事务快照必须引用隔离，恢复前完整校验，失败恢复不能破坏当前状态。
test('MemorySourcePackageRepository 安全创建和恢复事务快照', async () => {
  // 类型: MemorySourcePackageRepository。
  // 作用: 创建包含单个脚本包的被测仓库，用于验证快照恢复边界。
  const repository = new MemorySourcePackageRepository([createPackageFixture()]);

  // 类型: Array<object>。
  // 作用: 保存事务前快照，并验证修改快照本身不会污染当前仓库。
  const snapshot = repository.createSnapshot();
  snapshot[0].integrity.scriptHash = 'changed-snapshot-outside';
  assert.equal(
    (await repository.get(PACKAGE_REF)).integrity.scriptHash,
    SOURCE_PACKAGE.integrity.scriptHash
  );

  // 类型: string。
  // 作用: 标识事务期间新增的第二个包，恢复后必须消失。
  const transientPackageRef = 'source-package::transient-source';
  await repository.save(createPackageFixture({
    packageRef: transientPackageRef,
    sourceId: 'transient-source'
  }));

  // 类型: Array<object>。
  // 作用: 作为恢复输入，恢复完成后继续修改它以验证 restoreSnapshot 不保留外部引用。
  const restoreInput = [createPackageFixture()];

  // 执行内容: 使用完整合法快照恢复事务前状态。
  repository.restoreSnapshot(restoreInput);
  restoreInput[0].integrity.scriptHash = 'changed-after-restore';
  assert.equal(await repository.get(transientPackageRef), null);
  assert.equal(
    (await repository.get(PACKAGE_REF)).integrity.scriptHash,
    SOURCE_PACKAGE.integrity.scriptHash
  );

  // 类型: Array<object>。
  // 作用: 创建重复引用非法快照，验证恢复失败发生在私有 Map 替换之前。
  const invalidSnapshot = [createPackageFixture(), createPackageFixture()];
  assert.throws(
    () => repository.restoreSnapshot(invalidSnapshot),
    SourceRepositoryConflictError
  );
  assert.equal((await repository.loadAll()).length, 1);
  assert.equal(
    (await repository.get(PACKAGE_REF)).integrity.scriptHash,
    SOURCE_PACKAGE.integrity.scriptHash
  );
});

// 测试目的: Definition 仓库的构造输入、查询、列表、保存和删除结果必须遵守私有保存边界。
test('MemorySourceDefinitionRepository 提供 Definition CRUD 和引用隔离', async () => {
  // 类型: object。
  // 作用: 使用可变 Definition 种子验证构造阶段会隔离嵌套能力对象。
  const definitionSeed = createDefinitionFixture();

  // 类型: MemorySourceDefinitionRepository。
  // 作用: 创建带完整 Definition 和 Preferences 的独立被测仓库。
  const repository = new MemorySourceDefinitionRepository(
    [definitionSeed],
    createPreferencesFixture()
  );

  // 副作用: 修改构造输入的能力字段；Repository 内部 Definition 必须保持原始 Boolean。
  definitionSeed.capabilities.home = false;
  assert.equal((await repository.getDefinition(SOURCE_ID)).capabilities.home, true);

  // 断言内容: 旧公开 Map 和 Preferences 字段不再存在，调用方只能通过正式接口读取。
  assert.equal('definitionsById' in repository, false);
  assert.equal('preferences' in repository, false);

  // 类型: object。
  // 作用: 修改单项查询结果，验证 getDefinition 不暴露内部 Definition 引用。
  const definition = await repository.getDefinition(SOURCE_ID);
  definition.name = '外部修改';
  definition.capabilities.movie = false;
  assert.equal((await repository.getDefinition(SOURCE_ID)).name, SOURCE_DEFINITION.name);
  assert.equal((await repository.getDefinition(SOURCE_ID)).capabilities.movie, true);

  // 类型: Array<object>。
  // 作用: 修改列表及其条目，验证 loadDefinitions 返回完整隔离集合。
  const definitions = await repository.loadDefinitions();
  definitions[0].description = '外部列表修改';
  definitions.length = 0;
  assert.equal((await repository.loadDefinitions()).length, 1);
  assert.equal(
    (await repository.getDefinition(SOURCE_ID)).description,
    SOURCE_DEFINITION.description
  );

  // 类型: string。
  // 作用: 标识通过 saveDefinition 新增的 Definition，验证创建、查询和删除完整路径。
  const nextSourceId = 'repository-next-source';

  // 类型: object。
  // 作用: 保存输入包含独立 capabilities，用于验证 save 输入与返回结果双重隔离。
  const nextDefinition = createDefinitionFixture({
    id: nextSourceId,
    packageRef: `source-package::${nextSourceId}`,
    name: '第二个 Repository 测试源'
  });

  // 类型: object。
  // 作用: 保存 saveDefinition 返回的隔离副本，验证修改返回值不会污染私有 Definition。
  const savedDefinition = await repository.saveDefinition(nextDefinition);
  nextDefinition.capabilities.search = false;
  savedDefinition.capabilities.search = false;
  assert.equal((await repository.getDefinition(nextSourceId)).capabilities.search, true);

  // 类型: object。
  // 作用: 更新已有 sourceId 的名称，验证 saveDefinition 执行 upsert 而不是追加重复记录。
  const updatedDefinition = createDefinitionFixture({ name: '更新后的 Repository 测试源' });
  await repository.saveDefinition(updatedDefinition);
  updatedDefinition.name = '外部再次修改';
  assert.equal((await repository.getDefinition(SOURCE_ID)).name, '更新后的 Repository 测试源');
  assert.equal((await repository.loadDefinitions()).length, 2);

  // 断言内容: 合法未命中返回 null；删除命中返回 true，重复删除返回 false。
  assert.equal(await repository.getDefinition('missing-source'), null);
  assert.equal(await repository.removeDefinition(nextSourceId), true);
  assert.equal(await repository.removeDefinition(nextSourceId), false);
});

// 测试目的: Definition 构造和保存必须拒绝非法字段、重复 id 与 packageRef 复用。
test('MemorySourceDefinitionRepository 拒绝非法种子和 Definition 冲突', async () => {
  // 断言内容: 构造阶段非法 sourceKind 必须经过集中 Definition 校验失败。
  assert.throws(
    () => new MemorySourceDefinitionRepository([
      createDefinitionFixture({ sourceKind: 'invalid-kind' })
    ]),
    SourceRepositoryValidationError
  );

  // 断言内容: 相同 sourceId 的重复种子不能被后项静默覆盖。
  assert.throws(
    () => new MemorySourceDefinitionRepository([
      createDefinitionFixture(),
      createDefinitionFixture()
    ]),
    SourceRepositoryConflictError
  );

  // 类型: object。
  // 作用: 创建不完整授权快照，验证构造阶段 Preferences 使用运行时保存相同的集中校验。
  const invalidPreferencesSeed = createPreferencesFixture();
  invalidPreferencesSeed.sourceStates[SOURCE_ID].authorization.authorizedVersion = '';
  assert.throws(
    () => new MemorySourceDefinitionRepository(
      [createDefinitionFixture()],
      invalidPreferencesSeed
    ),
    SourceRepositoryValidationError
  );

  // 断言内容: 不同 sourceId 也不能复用同一 packageRef。
  assert.throws(
    () => new MemorySourceDefinitionRepository([
      createDefinitionFixture(),
      createDefinitionFixture({ id: 'package-ref-conflict-source' })
    ]),
    SourceRepositoryConflictError
  );

  // 类型: MemorySourceDefinitionRepository。
  // 作用: 验证运行时 saveDefinition 的 packageRef 冲突与失败不提交。
  const repository = new MemorySourceDefinitionRepository(
    [createDefinitionFixture()],
    createPreferencesFixture()
  );
  await assert.rejects(
    () => repository.saveDefinition(createDefinitionFixture({ id: 'runtime-conflict-source' })),
    SourceRepositoryConflictError
  );
  assert.equal(await repository.getDefinition('runtime-conflict-source'), null);
  assert.equal((await repository.loadDefinitions()).length, 1);
});

// 测试目的: Preferences 构造、读取和整体保存必须共用完整校验并保持输入输出隔离。
test('MemorySourceDefinitionRepository 隔离并完整校验 SourcePreferences', async () => {
  // 类型: object。
  // 作用: 使用可变偏好种子验证构造阶段切断授权和 enabled 嵌套引用。
  const preferencesSeed = createPreferencesFixture();

  // 类型: MemorySourceDefinitionRepository。
  // 作用: 使用可变偏好种子创建被测仓库，验证 Preferences 输入输出隔离。
  const repository = new MemorySourceDefinitionRepository(
    [createDefinitionFixture()],
    preferencesSeed
  );
  preferencesSeed.sourceStates[SOURCE_ID].enabled = false;
  assert.equal((await repository.loadPreferences()).sourceStates[SOURCE_ID].enabled, true);

  // 类型: object。
  // 作用: 修改查询结果，验证授权快照和 sourceStates 不穿透私有 Preferences。
  const loadedPreferences = await repository.loadPreferences();
  loadedPreferences.sourceStates[SOURCE_ID].enabled = false;
  loadedPreferences.sourceStates[SOURCE_ID].authorization.authorizedVersion = 'outside';
  assert.equal((await repository.loadPreferences()).sourceStates[SOURCE_ID].enabled, true);
  assert.equal(
    (await repository.loadPreferences()).sourceStates[SOURCE_ID].authorization.authorizedVersion,
    'v1.0.0'
  );

  // 类型: object。
  // 作用: 保存关闭状态，并验证 save 输入与保存返回值都不能污染私有偏好。
  const nextPreferences = createPreferencesFixture();
  nextPreferences.sourceStates[SOURCE_ID].enabled = false;

  // 类型: object。
  // 作用: 保存 savePreferences 返回的隔离副本，验证外部修改不会回写私有偏好。
  const savedPreferences = await repository.savePreferences(nextPreferences);
  nextPreferences.sourceStates[SOURCE_ID].enabled = true;
  savedPreferences.sourceStates[SOURCE_ID].enabled = true;
  assert.equal((await repository.loadPreferences()).sourceStates[SOURCE_ID].enabled, false);

  // 类型: object。
  // 作用: 制造不完整 authorized 快照，验证保存失败前不会覆盖当前合法偏好。
  const invalidPreferences = createPreferencesFixture();
  invalidPreferences.sourceStates[SOURCE_ID].authorization.authorizedScriptHash = '';
  await assert.rejects(
    () => repository.savePreferences(invalidPreferences),
    SourceRepositoryValidationError
  );
  assert.equal((await repository.loadPreferences()).sourceStates[SOURCE_ID].enabled, false);
});

// 测试目的: Definition/Preferences 快照必须整体校验和恢复，失败快照不能形成半恢复状态。
test('MemorySourceDefinitionRepository 安全创建和恢复事务快照', async () => {
  // 类型: MemorySourceDefinitionRepository。
  // 作用: 创建同时持有 Definition 和 Preferences 的被测仓库，验证整体快照恢复。
  const repository = new MemorySourceDefinitionRepository(
    [createDefinitionFixture()],
    createPreferencesFixture()
  );

  // 类型: object。
  // 作用: 修改外部事务快照，验证 Definition 和 Preferences 当前状态均不会被穿透。
  const snapshot = repository.createSnapshot();
  snapshot.definitions[0].name = '外部快照修改';
  snapshot.preferences.sourceStates[SOURCE_ID].enabled = false;
  assert.equal((await repository.getDefinition(SOURCE_ID)).name, SOURCE_DEFINITION.name);
  assert.equal((await repository.loadPreferences()).sourceStates[SOURCE_ID].enabled, true);

  // 类型: string。
  // 作用: 标识事务期间新增 Definition，恢复后必须消失。
  const transientSourceId = 'definition-transient-source';
  await repository.saveDefinition(createDefinitionFixture({
    id: transientSourceId,
    packageRef: `source-package::${transientSourceId}`
  }));
  await repository.savePreferences(createPreferencesFixture({ defaultSourceId: '' }));

  // 类型: object。
  // 作用: 作为恢复输入，恢复后继续修改它以验证 Repository 不保留外部快照引用。
  const restoreInput = {
    definitions: [createDefinitionFixture()],
    preferences: createPreferencesFixture()
  };

  // 执行内容: 使用完整合法快照恢复 Definition 和 Preferences 两个保存域。
  repository.restoreSnapshot(restoreInput);
  restoreInput.definitions[0].name = '恢复后外部修改';
  restoreInput.preferences.defaultSourceId = '';
  assert.equal(await repository.getDefinition(transientSourceId), null);
  assert.equal((await repository.getDefinition(SOURCE_ID)).name, SOURCE_DEFINITION.name);
  assert.equal((await repository.loadPreferences()).defaultSourceId, SOURCE_ID);

  // 类型: object。
  // 作用: 使用合法 Definition 与非法 Preferences 构造失败快照，验证两个保存域都不被替换。
  const invalidSnapshot = {
    definitions: [createDefinitionFixture({ name: '不能部分恢复的名称' })],
    preferences: createPreferencesFixture()
  };
  invalidSnapshot.preferences.sourceStates[SOURCE_ID].authorization.authorizedAt = '';
  assert.throws(
    () => repository.restoreSnapshot(invalidSnapshot),
    SourceRepositoryValidationError
  );
  assert.equal((await repository.getDefinition(SOURCE_ID)).name, SOURCE_DEFINITION.name);
  assert.equal((await repository.loadPreferences()).defaultSourceId, SOURCE_ID);
});

// 测试目的: Storage 构造种子必须完整校验五分区，并且外部不能取得私有三层 Map。
test('MemorySourceStorageRepository 严格校验构造种子并隐藏内部状态', async () => {
  // 类型: object。
  // 作用: 使用可变五分区种子验证构造阶段会隔离嵌套保存值。
  const namespaceSeed = createStorageNamespaceFixture();

  // 类型: MemorySourceStorageRepository。
  // 作用: 创建包含一个完整命名空间的独立被测仓库。
  const repository = new MemorySourceStorageRepository({
    [SOURCE_ID]: namespaceSeed
  });

  // 副作用: 修改构造输入中的嵌套设置；Repository 内部保存值必须保持初始内容。
  namespaceSeed.settings.quality.mode = 'outside-seed-change';
  assert.deepEqual(
    await repository.get(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings, 'quality'),
    { mode: 'auto' }
  );

  // 断言内容: 旧公开命名空间对象和 getNamespace 引用入口均已删除。
  assert.equal('namespaces' in repository, false);
  assert.equal('getNamespace' in repository, false);

  // 类型: object。
  // 作用: 删除 diagnostics 分区，验证构造阶段不会静默补齐缺失分区。
  const incompleteNamespace = createStorageNamespaceFixture();
  delete incompleteNamespace.diagnostics;
  assert.throws(
    () => new MemorySourceStorageRepository({ [SOURCE_ID]: incompleteNamespace }),
    SourceRepositoryValidationError
  );

  // 类型: object。
  // 作用: 增加未定义分区，验证构造阶段不会静默忽略契约外字段。
  const extendedNamespace = createStorageNamespaceFixture({
    unknown: { hidden: true }
  });
  assert.throws(
    () => new MemorySourceStorageRepository({ [SOURCE_ID]: extendedNamespace }),
    SourceRepositoryValidationError
  );

  // 类型: object。
  // 作用: 创建独立普通种子对象，随后显式增加 __proto__ 自有数据属性。
  const unsafeSourceSeeds = {};

  // 副作用: 定义可枚举的 __proto__ 自有数据属性，不触发普通赋值的原型 setter。
  // 影响范围: 只作用于当前测试夹具，用于验证构造种子动态键安全校验。
  Object.defineProperty(unsafeSourceSeeds, '__proto__', {
    // 类型: object。
    // 作用: 作为危险 sourceId 对应的完整命名空间，使失败原因只来自 sourceId 校验。
    value: createStorageNamespaceFixture(),

    // 类型: boolean。
    // true: 字段进入 Object.entries 和 JSON 保存边界；false: 字段会被忽略。
    enumerable: true
  });
  assert.throws(
    () => new MemorySourceStorageRepository(unsafeSourceSeeds),
    SourceRepositoryValidationError
  );
});

// 测试目的: 五分区 CRUD、sourceId 隔离、分区隔离和所有输入输出引用必须满足统一契约。
test('MemorySourceStorageRepository 提供五分区 CRUD 和引用隔离', async () => {
  // 类型: MemorySourceStorageRepository。
  // 作用: 创建空私有空间仓库，逐项验证五分区 CRUD 与跨源隔离。
  const repository = new MemorySourceStorageRepository();

  // 类型: object。
  // 作用: 保存可变嵌套值，用于同时验证 set 输入和返回结果隔离。
  const settingsValue = { mode: 'auto', options: ['hd'] };

  // 类型: object。
  // 作用: 保存 set 返回的隔离副本，验证修改返回值不会穿透分区 Map。
  const savedSettingsValue = await repository.set(
    SOURCE_ID,
    SOURCE_STORAGE_PARTITION.settings,
    'quality',
    settingsValue
  );

  // 副作用: 修改 set 输入和返回结果；两者都不能污染私有分区 Map。
  settingsValue.mode = 'outside-input-change';
  savedSettingsValue.options.push('outside-result-change');
  assert.deepEqual(
    await repository.get(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings, 'quality'),
    { mode: 'auto', options: ['hd'] }
  );

  // 类型: Array<object>。
  // 作用: 为其余四个分区提供独立 key 和嵌套值，证明五分区均可正式读写。
  const partitionCases = [
    [SOURCE_STORAGE_PARTITION.credentials, 'token', { value: 'secret' }],
    [SOURCE_STORAGE_PARTITION.session, 'challenge', { id: 'challenge-01' }],
    [SOURCE_STORAGE_PARTITION.cache, 'page', { items: ['item-01'] }],
    [SOURCE_STORAGE_PARTITION.diagnostics, 'lastCheck', { ok: true }]
  ];

  // 循环类型: for...of。
  // 循环作用: 逐个验证 credentials、session、cache 和 diagnostics 的 set/get 能力。
  for (const [partition, key, value] of partitionCases) {
    await repository.set(SOURCE_ID, partition, key, value);
    assert.deepEqual(await repository.get(SOURCE_ID, partition, key), value);
  }

  // 类型: object。
  // 作用: 修改 get 返回值，验证嵌套对象不会反向污染内部保存值。
  const firstRead = await repository.get(
    SOURCE_ID,
    SOURCE_STORAGE_PARTITION.cache,
    'page'
  );
  firstRead.items.push('outside-get-change');
  assert.deepEqual(
    await repository.get(SOURCE_ID, SOURCE_STORAGE_PARTITION.cache, 'page'),
    { items: ['item-01'] }
  );

  // 类型: Array<object>。
  // 作用: 修改 list 数组、条目和 value，验证集合结果完全隔离并保持插入顺序。
  const settingsList = await repository.list(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings);
  settingsList[0].value.mode = 'outside-list-change';
  settingsList.push({ key: 'outside-only', value: true });
  assert.deepEqual(
    await repository.list(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings),
    [{ key: 'quality', value: { mode: 'auto', options: ['hd'] } }]
  );

  // 断言内容: 其他 sourceId 和其他分区不能读取 settings.quality。
  assert.equal(
    await repository.get('another-source', SOURCE_STORAGE_PARTITION.settings, 'quality'),
    null
  );
  assert.equal(
    await repository.get(SOURCE_ID, SOURCE_STORAGE_PARTITION.cache, 'quality'),
    null
  );

  // 断言内容: 单项与集合未命中、删除命中和重复删除结果符合冻结契约。
  assert.equal(await repository.get(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings, 'missing'), null);
  assert.deepEqual(await repository.list('another-source', SOURCE_STORAGE_PARTITION.settings), []);
  assert.equal(await repository.remove(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings, 'quality'), true);
  assert.equal(await repository.remove(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings, 'quality'), false);
});

// 测试目的: sourceId 和分区 key 的三个原型敏感名称必须明确失败且不产生隐藏保存状态。
test('MemorySourceStorageRepository 拒绝危险动态键和非法分区', async () => {
  // 类型: MemorySourceStorageRepository。
  // 作用: 创建空被测仓库，确认危险 sourceId、key 和非法分区失败后不遗留状态。
  const repository = new MemorySourceStorageRepository();

  // 循环类型: for...of。
  // 循环作用: 验证三个保留名称在 sourceId 和 key 两个动态边界都抛统一领域错误。
  for (const unsafeKey of ['__proto__', 'constructor', 'prototype']) {
    await assert.rejects(
      () => repository.set(
        unsafeKey,
        SOURCE_STORAGE_PARTITION.settings,
        'safe-key',
        { value: true }
      ),
      SourceRepositoryValidationError
    );

    await assert.rejects(
      () => repository.set(
        SOURCE_ID,
        SOURCE_STORAGE_PARTITION.settings,
        unsafeKey,
        { value: true }
      ),
      SourceRepositoryValidationError
    );
  }

  // 断言内容: 非法分区不能创建命名空间或保存值。
  await assert.rejects(
    () => repository.set(SOURCE_ID, 'unknown-partition', 'safe-key', true),
    SourceRepositoryValidationError
  );

  // 断言内容: 全部危险写入失败后，合法 sourceId 仍没有条目和容量占用。
  assert.deepEqual(await repository.list(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings), []);
  assert.equal((await repository.getUsage(SOURCE_ID)).totalStorageBytes, 0);
});

// 测试目的: usage 必须由真实值精确派生，clear/clearAll/removeSource 必须遵守固定清理边界。
test('MemorySourceStorageRepository 精确计算 usage 并执行分区清理', async () => {
  // 类型: MemorySourceStorageRepository。
  // 作用: 创建空被测仓库，写入真实值后验证容量公式和清理语义。
  const repository = new MemorySourceStorageRepository();

  // 类型: object。
  // 作用: 提供五分区不同结构的实际保存值，供精确容量断言使用。
  const values = {
    settings: { mode: 'auto' },
    credentials: 'secret',
    session: { challengeId: 'challenge-01' },
    cache: ['item-01', 'item-02'],
    diagnostics: { ok: true }
  };

  await repository.set(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings, 'quality', values.settings);
  await repository.set(SOURCE_ID, SOURCE_STORAGE_PARTITION.credentials, 'token', values.credentials);
  await repository.set(SOURCE_ID, SOURCE_STORAGE_PARTITION.session, 'challenge', values.session);
  await repository.set(SOURCE_ID, SOURCE_STORAGE_PARTITION.cache, 'page', values.cache);
  await repository.set(
    SOURCE_ID,
    SOURCE_STORAGE_PARTITION.diagnostics,
    'lastCheck',
    values.diagnostics
  );

  // 类型: object。
  // 作用: 保存清理前容量摘要，逐项验证值字节数和派生汇总公式。
  const usageBeforeClear = await repository.getUsage(SOURCE_ID);
  assert.equal(
    usageBeforeClear.partitions.settings,
    getSerializableByteLength(values.settings)
  );
  assert.equal(
    usageBeforeClear.partitions.credentials,
    getSerializableByteLength(values.credentials)
  );
  assert.equal(usageBeforeClear.partitions.session, getSerializableByteLength(values.session));
  assert.equal(usageBeforeClear.partitions.cache, getSerializableByteLength(values.cache));
  assert.equal(
    usageBeforeClear.partitions.diagnostics,
    getSerializableByteLength(values.diagnostics)
  );
  assert.equal(
    usageBeforeClear.temporaryCacheBytes,
    usageBeforeClear.partitions.cache + usageBeforeClear.partitions.diagnostics
  );
  assert.equal(
    usageBeforeClear.totalCacheBytes,
    usageBeforeClear.partitions.credentials
      + usageBeforeClear.partitions.session
      + usageBeforeClear.partitions.cache
      + usageBeforeClear.partitions.diagnostics
  );
  assert.equal(
    usageBeforeClear.totalStorageBytes,
    Object.values(usageBeforeClear.partitions).reduce((sum, bytes) => sum + bytes, 0)
  );

  // 断言内容: clear 只删除目标 cache 分区一个条目，其他分区保持可读。
  assert.equal(await repository.clear(SOURCE_ID, SOURCE_STORAGE_PARTITION.cache), 1);
  assert.deepEqual(await repository.list(SOURCE_ID, SOURCE_STORAGE_PARTITION.cache), []);
  assert.deepEqual(
    await repository.get(SOURCE_ID, SOURCE_STORAGE_PARTITION.diagnostics, 'lastCheck'),
    values.diagnostics
  );
  assert.equal(await repository.clear('missing-source', SOURCE_STORAGE_PARTITION.cache), 0);

  // 断言内容: clearAll 清理剩余三个运行分区条目并保留 settings。
  assert.equal(await repository.clearAll(SOURCE_ID), 3);
  assert.deepEqual(
    await repository.get(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings, 'quality'),
    values.settings
  );
  assert.equal((await repository.getUsage(SOURCE_ID)).totalCacheBytes, 0);
  assert.equal(await repository.clearAll('missing-source'), 0);

  // 断言内容: removeSource 删除完整五分区命名空间，重复删除返回 false，usage 返回全零摘要。
  assert.equal(await repository.removeSource(SOURCE_ID), true);
  assert.equal(await repository.removeSource(SOURCE_ID), false);
  assert.equal(
    await repository.get(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings, 'quality'),
    null
  );
  assert.deepEqual((await repository.getUsage(SOURCE_ID)).partitions, {
    settings: 0,
    credentials: 0,
    session: 0,
    cache: 0,
    diagnostics: 0
  });
});

// 测试目的: Storage 快照必须与私有 Map 隔离，恢复前完整校验，失败恢复不能破坏当前状态。
test('MemorySourceStorageRepository 安全创建和恢复事务快照', async () => {
  // 类型: MemorySourceStorageRepository。
  // 作用: 使用完整五分区种子创建被测仓库，验证快照隔离和原子恢复。
  const repository = new MemorySourceStorageRepository({
    [SOURCE_ID]: createStorageNamespaceFixture()
  });

  // 类型: object。
  // 作用: 修改 createSnapshot 返回值，验证外部快照不能穿透私有三层 Map。
  const snapshot = repository.createSnapshot();
  snapshot[SOURCE_ID].settings.quality.mode = 'outside-snapshot-change';
  assert.deepEqual(
    await repository.get(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings, 'quality'),
    { mode: 'auto' }
  );

  // 执行内容: 在当前状态中写入事务期间临时值，合法恢复后该值必须消失。
  await repository.set(
    SOURCE_ID,
    SOURCE_STORAGE_PARTITION.cache,
    'transient',
    { temporary: true }
  );

  // 类型: object。
  // 作用: 作为恢复输入，恢复后继续修改以验证 restoreSnapshot 不保留外部引用。
  const restoreInput = {
    [SOURCE_ID]: createStorageNamespaceFixture()
  };
  repository.restoreSnapshot(restoreInput);
  restoreInput[SOURCE_ID].settings.quality.mode = 'outside-restore-change';
  assert.equal(
    await repository.get(SOURCE_ID, SOURCE_STORAGE_PARTITION.cache, 'transient'),
    null
  );
  assert.deepEqual(
    await repository.get(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings, 'quality'),
    { mode: 'auto' }
  );

  // 类型: object。
  // 作用: 构造缺失 diagnostics 的非法快照，验证恢复失败前不会替换当前私有状态。
  const invalidSnapshotNamespace = createStorageNamespaceFixture();
  delete invalidSnapshotNamespace.diagnostics;
  assert.throws(
    () => repository.restoreSnapshot({ [SOURCE_ID]: invalidSnapshotNamespace }),
    SourceRepositoryValidationError
  );
  assert.deepEqual(
    await repository.get(SOURCE_ID, SOURCE_STORAGE_PARTITION.settings, 'quality'),
    { mode: 'auto' }
  );
  assert.equal((await repository.list(SOURCE_ID, SOURCE_STORAGE_PARTITION.cache)).length, 1);
});

// 测试目的: 成功事务必须提交三仓写入、返回 executor 结果并隐藏 Unit of Work 内部 Repository 引用。
test('MemorySourceRepositoryUnitOfWork 提交成功事务并返回结果', async () => {
  // 类型: object。
  // 作用: 创建小型三仓和 Unit of Work，作为成功提交测试的隔离基础设施。
  const repositories = createSmallRepositories();

  // 类型: string。
  // 作用: 标识当前成功事务新增的数据源，供三仓提交结果关联。
  const committedSourceId = 'transaction-committed-source';

  // 类型: boolean。
  // 作用: 记录 executor 收到的事务上下文是否冻结，防止事务内部替换 Repository 字段。
  let contextIsFrozen = false;

  // 类型: object。
  // 作用: 保存 runInTransaction 返回结果，验证 executor resolve 值不会被队列包装改变。
  const transactionResult = await repositories.unitOfWork.runInTransaction(async (context) => {
    contextIsFrozen = Object.isFrozen(context);
    return saveTransactionSource(context, committedSourceId);
  });

  // 断言内容: 事务上下文冻结，Unit of Work 不公开三个可替换 Repository 字段。
  assert.equal(contextIsFrozen, true);
  assert.equal('packageRepository' in repositories.unitOfWork, false);
  assert.equal('definitionRepository' in repositories.unitOfWork, false);
  assert.equal('storageRepository' in repositories.unitOfWork, false);

  // 断言内容: executor 返回值由 runInTransaction 原样传递。
  assert.deepEqual(transactionResult, {
    sourceId: committedSourceId,
    packageRef: `source-package::${committedSourceId}`
  });

  // 断言内容: 成功事务完成后 Package、Definition 和 Storage 写入全部保留。
  assert.ok(await repositories.packageRepository.get(transactionResult.packageRef));
  assert.ok(await repositories.definitionRepository.getDefinition(committedSourceId));
  assert.deepEqual(
    await repositories.storageRepository.get(
      committedSourceId,
      SOURCE_STORAGE_PARTITION.settings,
      'transactionMarker'
    ),
    { sourceId: committedSourceId }
  );
});

// 测试目的: executor 失败时必须同时恢复三个 Repository，并通过 TransactionError 保留原始 cause。
test('MemorySourceRepositoryUnitOfWork 跨仓失败后完整回滚并保留 cause', async () => {
  // 类型: object。
  // 作用: 创建小型三仓和 Unit of Work，作为失败回滚测试的隔离基础设施。
  const repositories = createSmallRepositories();

  // 类型: string。
  // 作用: 标识必须在 executor 失败后从三仓同时消失的测试数据源。
  const failedSourceId = 'transaction-failed-source';

  // 类型: Error。
  // 作用: 作为 executor 原始失败，验证事务错误 cause 使用同一异常引用。
  const originalError = new Error('force rollback with original cause');

  // 类型: Error|null。
  // 作用: 捕获 Unit of Work 最终错误，便于同时断言错误类型和 cause。
  const transactionError = await repositories.unitOfWork.runInTransaction(async (context) => {
    await saveTransactionSource(context, failedSourceId);
    throw originalError;
  }).then(
    // 成功回调: 当前测试预期失败；返回 null 让后续断言明确报告异常缺失。
    () => null,
    // 失败回调: 返回事务错误对象，供后续检查类型、cause 和回滚结果。
    error => error
  );

  // 断言内容: 失败统一包装为 TransactionError，并保留 executor 原始异常引用。
  assert.ok(transactionError instanceof SourceRepositoryTransactionError);
  assert.strictEqual(transactionError.cause, originalError);

  // 断言内容: 当前失败事务在三个 Repository 中的全部新增数据均已恢复。
  assert.equal(
    await repositories.packageRepository.get(`source-package::${failedSourceId}`),
    null
  );
  assert.equal(await repositories.definitionRepository.getDefinition(failedSourceId), null);
  assert.equal(
    await repositories.storageRepository.get(
      failedSourceId,
      SOURCE_STORAGE_PARTITION.settings,
      'transactionMarker'
    ),
    null
  );

  // 断言内容: 事务开始前已有的 Package 仍然存在，回滚没有清空基线数据。
  assert.ok(await repositories.packageRepository.get(PACKAGE_REF));
});

// 测试目的: 后一事务必须等待前一事务结束后才进入 executor，执行顺序严格遵守 FIFO。
test('MemorySourceRepositoryUnitOfWork 按 FIFO 顺序串行执行事务', async () => {
  // 类型: object。
  // 作用: 创建小型三仓和 Unit of Work，通过可控 Promise 验证 FIFO 执行顺序。
  const repositories = createSmallRepositories();

  // 类型: object。
  // 作用: 第一事务进入 executor 后通知测试主流程。
  const firstStarted = createDeferred();

  // 类型: object。
  // 作用: 精确暂停第一事务，证明第二事务不会提前开始。
  const releaseFirst = createDeferred();

  // 类型: Array<string>。
  // 作用: 记录两个 executor 的开始和结束事件，验证完整 FIFO 时序。
  const events = [];

  // 类型: boolean。
  // 作用: 记录第二事务 executor 是否已经实际取得执行权。
  let secondExecutorStarted = false;

  // 类型: Promise<string>。
  // 作用: 第一笔排队事务，进入后等待 releaseFirst 才允许结束。
  const firstTransaction = repositories.unitOfWork.runInTransaction(async () => {
    events.push('first:start');
    firstStarted.resolve();
    await releaseFirst.promise;
    events.push('first:end');
    return 'first-result';
  });

  // 执行内容: 等待第一事务确认已经进入 executor 并占有 FIFO 执行权。
  await firstStarted.promise;

  // 类型: Promise<string>。
  // 作用: 第一事务仍暂停时入队的第二事务，必须保持等待状态。
  const secondTransaction = repositories.unitOfWork.runInTransaction(async () => {
    secondExecutorStarted = true;
    events.push('second:start');
    events.push('second:end');
    return 'second-result';
  });

  // 异步边界: 放行一次微任务队列，证明第二事务不是仅因当前同步栈未结束而尚未启动。
  await Promise.resolve();
  assert.equal(secondExecutorStarted, false);
  assert.deepEqual(events, ['first:start']);

  // 执行内容: 主动结束第一事务，随后 FIFO 队列才允许第二事务开始。
  releaseFirst.resolve();

  // 类型: Array<string>。
  // 作用: 同时等待两笔事务并验证各自返回值不被队列混淆。
  const results = await Promise.all([firstTransaction, secondTransaction]);
  assert.deepEqual(results, ['first-result', 'second-result']);
  assert.deepEqual(events, [
    'first:start',
    'first:end',
    'second:start',
    'second:end'
  ]);
});

// 测试目的: 较早失败事务完成回滚后，后续成功事务必须正常执行并永久保留结果。
test('MemorySourceRepositoryUnitOfWork 不会用失败回滚覆盖后续成功事务', async () => {
  // 类型: object。
  // 作用: 创建小型三仓和 Unit of Work，复现较早失败与后续成功的排队场景。
  const repositories = createSmallRepositories();

  // 类型: string。
  // 作用: 标识第一笔事务写入后必须完整回滚的数据源。
  const failedSourceId = 'queued-failed-source';

  // 类型: string。
  // 作用: 标识第二笔事务必须在队列放行后永久保留的数据源。
  const successfulSourceId = 'queued-success-source';

  // 类型: object。
  // 作用: 通知测试第一事务已经完成三仓写入并停在失败前。
  const firstWriteFinished = createDeferred();

  // 类型: object。
  // 作用: 精确控制第一事务何时抛错并触发回滚。
  const releaseFailure = createDeferred();

  // 类型: Error。
  // 作用: 作为第一事务原始失败，验证排队场景仍使用统一事务错误。
  const originalError = new Error('queued first transaction failure');

  // 类型: Promise<*>。
  // 作用: 第一笔事务写入失败源后暂停，模拟旧实现中会覆盖后续成功结果的时序。
  const failedTransaction = repositories.unitOfWork.runInTransaction(async (context) => {
    await saveTransactionSource(context, failedSourceId);
    firstWriteFinished.resolve();
    await releaseFailure.promise;
    throw originalError;
  });

  // 执行内容: 等待失败事务已经写入中间状态并持有 FIFO 执行权。
  await firstWriteFinished.promise;

  // 类型: Promise<object>。
  // 作用: 第一事务尚未失败时加入队列的成功事务；不能提前创建快照或写入数据。
  const successfulTransaction = repositories.unitOfWork.runInTransaction((context) => {
    return saveTransactionSource(context, successfulSourceId);
  });

  // 异步边界: 放行一次微任务，验证成功事务仍在队列中且没有提前写入 Package。
  await Promise.resolve();
  assert.equal(
    await repositories.packageRepository.get(`source-package::${successfulSourceId}`),
    null
  );

  // 类型: Promise<void>。
  // 作用: 在放行失败前注册拒绝断言，避免第一事务 rejection 成为未处理异常。
  const failedAssertion = assert.rejects(
    failedTransaction,
    (error) => {
      assert.ok(error instanceof SourceRepositoryTransactionError);
      assert.strictEqual(error.cause, originalError);
      return true;
    }
  );

  // 执行内容: 让第一事务失败并完成三仓回滚，FIFO 队列随后放行成功事务。
  releaseFailure.resolve();
  await failedAssertion;

  // 类型: object。
  // 作用: 等待第二事务完成并取得提交结果。
  const successfulResult = await successfulTransaction;
  assert.equal(successfulResult.sourceId, successfulSourceId);

  // 断言内容: 第一事务的三仓中间写入已经回滚。
  assert.equal(
    await repositories.packageRepository.get(`source-package::${failedSourceId}`),
    null
  );
  assert.equal(await repositories.definitionRepository.getDefinition(failedSourceId), null);
  assert.equal(
    await repositories.storageRepository.get(
      failedSourceId,
      SOURCE_STORAGE_PARTITION.settings,
      'transactionMarker'
    ),
    null
  );

  // 断言内容: 后续成功事务在三个 Repository 中的结果全部存在，不会被较早失败快照覆盖。
  assert.ok(
    await repositories.packageRepository.get(`source-package::${successfulSourceId}`)
  );
  assert.ok(await repositories.definitionRepository.getDefinition(successfulSourceId));
  assert.deepEqual(
    await repositories.storageRepository.get(
      successfulSourceId,
      SOURCE_STORAGE_PARTITION.settings,
      'transactionMarker'
    ),
    { sourceId: successfulSourceId }
  );
});

// 测试目的: 非函数 executor 必须在入队前失败，并且不能污染或阻塞后续合法事务。
test('MemorySourceRepositoryUnitOfWork 拒绝非法 executor 并保持队列可用', async () => {
  // 类型: object。
  // 作用: 创建小型三仓和 Unit of Work，验证非法调用不会让队列进入失败状态。
  const repositories = createSmallRepositories();

  // 断言内容: 非函数 executor 使用稳定 ValidationError，且不会进入事务执行链。
  await assert.rejects(
    () => repositories.unitOfWork.runInTransaction(null),
    SourceRepositoryValidationError
  );

  // 类型: string。
  // 作用: 非法调用后的合法事务 id，用于证明队列没有进入 rejected 中毒状态。
  const nextSourceId = 'transaction-after-invalid-executor';

  // 类型: object。
  // 作用: 保存后续合法事务结果，验证它仍能正常执行和提交。
  const transactionResult = await repositories.unitOfWork.runInTransaction((context) => {
    return saveTransactionSource(context, nextSourceId);
  });

  assert.equal(transactionResult.sourceId, nextSourceId);
  assert.ok(await repositories.packageRepository.get(transactionResult.packageRef));
});

// 测试目的: Memory 工厂只能装配调用方显式传入的四类种子，不能认识数据层默认值。
test('createMemorySourceRepositories 强制显式种子并保持基础设施依赖方向', async () => {
  // 断言内容: 无参数调用不再隐式创建九条默认数据。
  assert.throws(
    () => createMemorySourceRepositories(),
    SourceRepositoryValidationError
  );

  // 类型: object。
  // 作用: 故意缺少 definitions，验证工厂不使用空集合或默认值补齐。
  const missingTopLevelSeeds = {
    packages: sourceRepositorySeeds.packages,
    preferences: sourceRepositorySeeds.preferences,
    storageNamespaces: sourceRepositorySeeds.storageNamespaces
  };
  assert.throws(
    () => createMemorySourceRepositories(missingTopLevelSeeds),
    SourceRepositoryValidationError
  );

  // 类型: object。
  // 作用: 故意增加未进入契约的影子字段，验证工厂不静默忽略。
  const extraTopLevelSeeds = {
    ...sourceRepositorySeeds,
    legacySourceManagerState: {}
  };
  assert.throws(
    () => createMemorySourceRepositories(extraTopLevelSeeds),
    SourceRepositoryValidationError
  );

  // 类型: object。
  // 作用: 用合法显式种子装配完整基础设施，验证严格入口不影响正常创建。
  const repositories = createMemorySourceRepositories(sourceRepositorySeeds);
  assert.equal(
    (await repositories.packageRepository.loadAll()).length,
    builtinSourceCatalog.length
  );
  assert.equal(
    (await repositories.definitionRepository.loadDefinitions()).length,
    builtinSourceCatalog.length
  );

  // 类型: string。
  // 作用: 读取工厂真实源码，验证 Repository 基础设施没有反向导入数据层。
  const factorySource = await readFile(
    new URL('../src/repositories/source/createMemorySourceRepositories.js', import.meta.url),
    'utf8'
  );

  // 类型: Array<string>。
  // 作用: 固定工厂禁止认识的页面 mock、默认种子和数据层路径。
  const forbiddenFactoryDependencies = [
    'data/settings',
    'source-repository.seed',
    'source-manager.mock'
  ];

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 逐项阻止任一反向依赖字符串重新进入工厂源码。
  forbiddenFactoryDependencies.forEach((dependencyName) => {
    assert.equal(factorySource.includes(dependencyName), false);
  });
});

// 测试目的: 当前真实内置源必须由同一目录生成 Package、Definition、Provider 身份和空 Storage，运行工厂只由保存脚本恢复。
test('真实内置源目录生成同源 Repository 保存图', async () => {
  // 类型: object；作用: 从受审当前目录重新生成隔离产品种子，验证默认导出不是手写第二份数据。
  const seeds = createBuiltinSourceRepositorySeeds(builtinSourceCatalog);
  assert.equal(seeds.packages.length, builtinSourceCatalog.length);
  assert.equal(seeds.definitions.length, builtinSourceCatalog.length);
  assert.equal(Object.keys(seeds.preferences.sourceStates).length, builtinSourceCatalog.length);
  assert.equal(Object.keys(seeds.storageNamespaces).length, builtinSourceCatalog.length);
  assert.equal(seeds.preferences.defaultSourceId, builtinSourceCatalog[0].manifest.id);

  // 类型: object；作用: 通过正式 Memory 工厂复核完整保存图可被 Repository 契约接受。
  const repositories = createMemorySourceRepositories(seeds);

  // 循环作用: 逐条验证 raw 文本、manifest、Package 和 Definition 保持同一身份与版本，并拒绝目录携带静态工厂。
  for (const entry of builtinSourceCatalog) {
    // 类型: object；作用: 读取当前 manifest 对应的持久化 Definition。
    const definition = await repositories.definitionRepository.getDefinition(entry.manifest.id);
    // 类型: object；作用: 按 Definition.packageRef 读取同一源完整脚本包。
    const sourcePackage = await repositories.packageRepository.get(definition.packageRef);
    assert.equal(sourcePackage.scriptContent, normalizeSourceScriptContent(entry.scriptContent));
    assert.equal(sourcePackage.sourceId, entry.manifest.id);
    assert.equal(sourcePackage.providerKey, entry.manifest.providerKey);
    assert.equal(definition.providerKey, entry.manifest.providerKey);
    assert.equal(definition.version, entry.manifest.version);
    assert.deepEqual(Object.keys(entry), ['manifest', 'scriptContent']);
    assert.equal(Object.hasOwn(entry, 'providerFactory'), false);
    assert.deepEqual(seeds.storageNamespaces[entry.manifest.id], {
      settings: {},
      credentials: {},
      session: {},
      cache: {},
      diagnostics: {}
    });
  }
});

// 测试目的: 产品目录非空、冻结边界和身份唯一性偏离时必须在生成部分种子前失败。
test('createBuiltinSourceRepositorySeeds 拒绝空目录、可变条目和重复身份', () => {
  // 类型: ReadonlyArray<object>；作用: 构造冻结空目录，证明产品不能在没有默认源时生成不完整偏好。
  const emptyCatalog = Object.freeze([]);
  assert.throws(() => createBuiltinSourceRepositorySeeds(emptyCatalog), TypeError);

  // 类型: ReadonlyArray<object>；作用: 构造包含可变包装条目的当前目录，证明初始化期间不能替换条目内容。
  const mutableEntryCatalog = Object.freeze([
    { ...builtinSourceCatalog[0] },
    ...builtinSourceCatalog.slice(1)
  ]);
  assert.throws(() => createBuiltinSourceRepositorySeeds(mutableEntryCatalog), TypeError);

  // 类型: ReadonlyArray<object>；作用: 复制首项占据末项，验证 sourceId/providerKey 重复不会覆盖前项。
  const duplicateIdentityCatalog = Object.freeze([
    ...builtinSourceCatalog,
    builtinSourceCatalog[0]
  ]);
  assert.throws(() => createBuiltinSourceRepositorySeeds(duplicateIdentityCatalog), TypeError);
});

// 测试目的: 产品种子只能依赖真实内置目录，全部私有空间必须从完整空五分区开始。
test('产品种子删除设置页 Mock 依赖并保持当前目录空 Storage', async () => {
  // 循环作用: 逐源确认五个正式分区存在且没有通过占位键伪造缓存或会话。
  Object.entries(sourceRepositorySeeds.storageNamespaces).forEach(([sourceId, namespace]) => {
    assertPlainObject(namespace, `storageNamespaces.${sourceId}`);
    assert.deepEqual(Object.keys(namespace), [
      'settings',
      'credentials',
      'session',
      'cache',
      'diagnostics'
    ]);
    Object.values(namespace).forEach((partitionValue) => {
      assertPlainObject(partitionValue, `storageNamespaces.${sourceId}.partition`);
      assert.deepEqual(partitionValue, {});
    });
  });

  // 类型: string；作用: 读取产品种子源码，静态阻止设置页 Mock 和旧转换器重新进入产品模块图。
  const seedSource = await readFile(
    new URL('../src/data/settings/source-repository.seed.js', import.meta.url),
    'utf8'
  );
  // 类型: Array<string>；作用: 固定产品种子不得出现的旧页面 Mock、配置转换和容量占位依赖。
  const forbiddenSeedDependencies = [
    'source-manager.mock',
    'sourceManagerMock',
    'sourceRepositorySeedConfigs',
    'createSizedSeedValue',
    '__mock_usage__'
  ];
  // 循环作用: 任一禁用依赖回归都使 Repository 测试失败，避免产品再次展示或运行模拟记录。
  forbiddenSeedDependencies.forEach((dependencyName) => {
    assert.equal(seedSource.includes(dependencyName), false);
  });
});
