/*
  source-repository.seed.js 模块说明

  - 文件职责:
      把当前设置页混合 mock 和逐数据源显式配置纯转换为 package、definition、preferences 和 storage 四类 Repository 种子。
      供 SourceManager 初始化入口显式传给 Memory Repository 工厂。
      本文件属于数据层，可以读取页面 mock；Repository 工厂和 Repository 实现不得反向导入本文件。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      sourceManagerMock: 自定义数据，提供九条设置页兼容初始化记录。
      SOURCE_SCRIPT_INTEGRITY_ALGORITHM: 自定义领域配置，统一种子 Package 的 SHA-256 算法名称。
      createSourceScriptHash、normalizeSourceScriptContent: 自定义工具，统一脚本文本和完整性指纹。
      cloneSerializableValue、createSourcePackageRef: 自定义 Repository 工具，隔离种子并创建稳定包引用。
      SourceRepositoryValidationError: 自定义错误，报告配置覆盖和字段集合错误。
      assertNonEmptyString: 自定义校验函数，校验显式 providerKey。
      assertPlainObject: 自定义校验函数，校验配置与运行分区对象。
      assertSafeRecordKey: 自定义校验函数，校验配置和记录 sourceId。

  - 模块级常量:
      SOURCE_PACKAGE_SCHEMA_VERSION: string，Memory 脚本包结构版本。
      SOURCE_PREFERENCES_SCHEMA_VERSION: string，Memory 偏好结构版本。
      TRUSTED_MOCK_PROVIDER_KEY: string，项目内可信 mock Provider 工厂键。
      SOURCE_PROVIDER_KEY_SUFFIX: string，旧自定义占位记录唯一 Provider 键后缀。
      SOURCE_SEED_CONFIG_KEYS: Array<string>，单条显式种子配置字段。
      RUNTIME_STORAGE_PARTITION_KEYS: Array<string>，配置声明的四个运行分区。
      sourceRepositorySeedConfigs: object，九条数据源显式 Provider 和小型运行空间配置。
      sourceRepositorySeeds: object，当前九条记录转换后的默认分离种子数据。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertExactObjectKeys(value, expectedKeys, fieldName): 校验普通对象字段集合。
      createCustomProviderKey(sourceId): 为每条旧自定义占位记录创建唯一 Provider 键。
      validateSourceSeedConfigs(sourceSeedConfigs, sourceIds): 校验配置与九条记录一一对应。
      createStorageNamespace(definitionInput, seedConfig, sourceId): 创建完整五分区小型 Storage 种子。

  - 模块级类:
      无

  - 对外导出:
      sourceRepositorySeedConfigs: object，九条模拟数据源显式 Repository 配置。
      createSourceRepositorySeeds: Function，把兼容 SourceManagerState 和显式配置转换为四类种子。
      sourceRepositorySeeds: object，当前设置页 mock 的默认分离种子数据。
*/

// 导入来源: ./source-manager.mock.js。
// 导入内容: sourceManagerMock 当前设置页混合初始化数据。
// 文件作用: 作为只读兼容记录输入，与显式配置共同转换为 Repository 种子。
import { sourceManagerMock } from './source-manager.mock.js';

// 导入来源: ../../config/source-manager.config.js。
// 导入内容: SOURCE_SCRIPT_INTEGRITY_ALGORITHM 数据源脚本完整性算法。
// 文件作用: 默认 Repository Package 与导入、授权和 Manager 组装共用 SHA-256 名称。
import { SOURCE_SCRIPT_INTEGRITY_ALGORITHM } from '../../config/source-manager.config.js';

import {
  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: createSourceScriptHash 当前脚本文本指纹函数。
  // 文件作用: 生成 SourcePackage.integrity.scriptHash。
  createSourceScriptHash,

  // 导入来源: ../../utils/sourceAuthorization.js。
  // 导入内容: normalizeSourceScriptContent 脚本文本规范化函数。
  // 文件作用: 让包保存文本、导出文本和授权指纹使用同一规范内容。
  normalizeSourceScriptContent
} from '../../utils/sourceAuthorization.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
  // 文件作用: 隔离混合 mock、显式配置和全部输出嵌套值。
  cloneSerializableValue,

  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: createSourcePackageRef 稳定包引用函数。
  // 文件作用: 根据 sourceId 创建 Definition 和 Package 共用引用。
  createSourcePackageRef
} from '../../repositories/source/sourceRepositoryUtils.js';

// 导入来源: ../../repositories/source/sourceRepositoryErrors.js。
// 导入内容: SourceRepositoryValidationError Repository 校验错误类。
// 文件作用: 配置覆盖、重复 sourceId 和字段集合错误使用统一领域失败类型。
import { SourceRepositoryValidationError } from '../../repositories/source/sourceRepositoryErrors.js';

import {
  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertNonEmptyString 非空字符串校验函数。
  // 文件作用: 每条显式配置必须声明可用 providerKey。
  assertNonEmptyString,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 原型安全普通对象校验函数。
  // 文件作用: 配置根节点、单条配置和四个运行分区只接受普通对象。
  assertPlainObject,

  // 导入来源: ../../repositories/source/sourceRepositoryValidators.js。
  // 导入内容: assertSafeRecordKey 动态记录键校验函数。
  // 文件作用: mock 记录和配置 sourceId 统一拒绝原型敏感保留键。
  assertSafeRecordKey
} from '../../repositories/source/sourceRepositoryValidators.js';

// 类型: string。
// 作用: 标识当前 Memory SourcePackage 保存结构版本，不复用 Definition schemaVersion。
const SOURCE_PACKAGE_SCHEMA_VERSION = '1.0.0';

// 类型: string。
// 作用: 标识 SourcePreferences 保存结构版本，供后续偏好字段迁移。
const SOURCE_PREFERENCES_SCHEMA_VERSION = '1.0.0';

// 类型: string。
// 作用: 项目内可信 mock Provider 工厂键；每条系统模拟源仍必须在配置中逐项显式引用。
const TRUSTED_MOCK_PROVIDER_KEY = 'system-demo-provider';

// 类型: string。
// 作用: 公共协议要求 ProviderFactory 身份由数据源 id 加固定后缀组成，旧占位记录也保持一源一键。
const SOURCE_PROVIDER_KEY_SUFFIX = '.provider';

// 类型: Array<string>。
// 作用: 固定每条数据源种子配置只允许 providerKey 和 runtimeStorage 两个职责字段。
const SOURCE_SEED_CONFIG_KEYS = Object.freeze([
  'providerKey',
  'runtimeStorage'
]);

// 类型: Array<string>。
// 作用: 固定配置需要声明的四个运行分区；settings 始终来自 Definition.settingsValues。
const RUNTIME_STORAGE_PARTITION_KEYS = Object.freeze([
  'credentials',
  'session',
  'cache',
  'diagnostics'
]);

// 类型: Record<string, object>。
// 作用: 为九条模拟数据源逐项声明 Provider 绑定和小型、有业务含义的运行空间。
// 维护边界: 新增或删除 sourceManagerMock 记录时必须同步配置；转换器会拒绝缺失和多余配置。
export const sourceRepositorySeedConfigs = Object.freeze({
  // 类型: object。
  // 作用: 系统数据源1 使用可信 mock Provider，并保存首页目录与健康检查小型状态。
  'system-source-1': {
    // 类型: string。
    // 作用: 显式绑定项目内可信 mock Provider，不根据系统源类型推断。
    providerKey: TRUSTED_MOCK_PROVIDER_KEY,

    // 类型: object。
    // 作用: 定义系统数据源1 的四个小型运行分区，不保存页面手写容量摘要。
    runtimeStorage: {
      // 类型: object。
      // 作用: 保存内置请求配置标识，全部缓存清理会删除。
      credentials: {
        requestProfile: { mode: 'builtin', profileId: 'system-01' }
      },
      // 类型: object。作用: 当前没有需要保留的连续请求会话。
      session: {},
      // 类型: object。作用: 保存可重建的首页目录候选 id。
      cache: {
        homeCatalog: { page: 1, contentIds: ['movie-001', 'tv-001'] }
      },
      // 类型: object。作用: 保存最近健康检查摘要，临时缓存清理会删除。
      diagnostics: {
        lastHealthCheck: { status: 'normal' }
      }
    }
  },

  // 类型: object。
  // 作用: 系统数据源2 显式绑定可信 Provider，并保存电影目录缓存摘要。
  'system-source-2': {
    // 类型: string。作用: 显式绑定项目内可信 mock Provider。
    providerKey: TRUSTED_MOCK_PROVIDER_KEY,
    // 类型: object。作用: 定义系统数据源2 的四个运行分区。
    runtimeStorage: {
      // 类型: object。作用: 当前没有模拟运行凭据。
      credentials: {},
      // 类型: object。作用: 当前没有模拟会话上下文。
      session: {},
      // 类型: object。作用: 保存可重建的电影目录候选 id。
      cache: {
        movieCatalog: { page: 1, contentIds: ['movie-002'] }
      },
      // 类型: object。作用: 保存最近正常健康检查摘要。
      diagnostics: {
        lastHealthCheck: { status: 'normal' }
      }
    }
  },

  // 类型: object。
  // 作用: 系统数据源3 显式绑定可信 Provider，并保存不可用健康检查摘要。
  'system-source-3': {
    // 类型: string。作用: 显式绑定项目内可信 mock Provider。
    providerKey: TRUSTED_MOCK_PROVIDER_KEY,
    // 类型: object。作用: 定义系统数据源3 的四个运行分区。
    runtimeStorage: {
      // 类型: object。作用: 当前没有模拟运行凭据。
      credentials: {},
      // 类型: object。作用: 当前没有模拟会话上下文。
      session: {},
      // 类型: object。作用: 当前没有可重建内容缓存。
      cache: {},
      // 类型: object。作用: 保存模拟超时的不可用健康摘要。
      diagnostics: {
        lastHealthCheck: { status: 'unavailable', reasonCode: 'mock-timeout' }
      }
    }
  },

  // 类型: object。
  // 作用: 系统数据源4 显式绑定可信 Provider，并保存搜索候选缓存。
  'system-source-4': {
    // 类型: string。作用: 显式绑定项目内可信 mock Provider。
    providerKey: TRUSTED_MOCK_PROVIDER_KEY,
    // 类型: object。作用: 定义系统数据源4 的四个运行分区。
    runtimeStorage: {
      // 类型: object。作用: 保存内置请求配置标识。
      credentials: {
        requestProfile: { mode: 'builtin', profileId: 'system-04' }
      },
      // 类型: object。作用: 当前没有模拟会话上下文。
      session: {},
      // 类型: object。作用: 保存可重建的搜索词与内容候选 id。
      cache: {
        searchPreview: { keyword: '示例', contentIds: ['movie-004'] }
      },
      // 类型: object。作用: 当前没有诊断摘要。
      diagnostics: {}
    }
  },

  // 类型: object。
  // 作用: 模拟数据源 05 使用独立未注册 Provider 身份，并保存远程更新检查上下文。
  'custom-online-demo': {
    // 类型: string。作用: 显式绑定当前占位源唯一 Provider 键；未注册时投影明确不可运行。
    providerKey: createCustomProviderKey('custom-online-demo'),
    // 类型: object。作用: 定义模拟数据源 05 的四个运行分区。
    runtimeStorage: {
      // 类型: object。作用: 未解析脚本当前没有运行凭据。
      credentials: {},
      // 类型: object。作用: 保存在线更新检查中发现的可用版本。
      session: {
        updateCheck: { availableVersion: 'v1.3.0' }
      },
      // 类型: object。作用: 保存可重建的远程导入预览摘要。
      cache: {
        importPreview: { method: 'remote' }
      },
      // 类型: object。作用: 保存最近正常健康检查摘要。
      diagnostics: {
        lastHealthCheck: { status: 'normal' }
      }
    }
  },

  // 类型: object。
  // 作用: 模拟数据源 06 使用独立未注册 Provider 身份，并保存当前在线版本检查摘要。
  'custom-online-latest': {
    // 类型: string。作用: 显式绑定当前占位源唯一 Provider 键；不与其他记录共享工厂身份。
    providerKey: createCustomProviderKey('custom-online-latest'),
    // 类型: object。作用: 定义模拟数据源 06 的四个运行分区。
    runtimeStorage: {
      // 类型: object。作用: 保存自定义运行请求配置类型摘要。
      credentials: {
        requestProfile: { mode: 'custom-runtime' }
      },
      // 类型: object。作用: 保存当前无可用更新的检查结果。
      session: {
        updateCheck: { updateAvailable: false }
      },
      // 类型: object。作用: 保存可重建的详情预览内容 id。
      cache: {
        detailPreview: { contentId: 'custom-online-latest-demo' }
      },
      // 类型: object。作用: 当前没有诊断摘要。
      diagnostics: {}
    }
  },

  // 类型: object。
  // 作用: 模拟数据源 07 使用独立未注册 Provider 身份，并保存文件导入预览缓存。
  'custom-file-demo': {
    // 类型: string。作用: 显式绑定当前占位源唯一 Provider 键；不执行种子脚本文本。
    providerKey: createCustomProviderKey('custom-file-demo'),
    // 类型: object。作用: 定义模拟数据源 07 的四个运行分区。
    runtimeStorage: {
      // 类型: object。作用: 未解析脚本当前没有运行凭据。
      credentials: {},
      // 类型: object。作用: 当前没有模拟会话上下文。
      session: {},
      // 类型: object。作用: 保存可重建的文件导入方式与文件名摘要。
      cache: {
        importPreview: { method: 'file', fileName: 'mock-source-07.js' }
      },
      // 类型: object。作用: 保存最近正常健康检查摘要。
      diagnostics: {
        lastHealthCheck: { status: 'normal' }
      }
    }
  },

  // 类型: object。
  // 作用: 模拟数据源 08 使用独立未注册 Provider 身份，当前没有运行缓存。
  'custom-text-demo': {
    // 类型: string。作用: 显式绑定当前占位源唯一 Provider 键；不与其他文本导入共享身份。
    providerKey: createCustomProviderKey('custom-text-demo'),
    // 类型: object。作用: 定义四个已声明但当前为空的运行分区。
    runtimeStorage: {
      // 类型: object。作用: 当前没有模拟运行凭据。
      credentials: {},
      // 类型: object。作用: 当前没有模拟会话上下文。
      session: {},
      // 类型: object。作用: 当前没有可重建内容缓存。
      cache: {},
      // 类型: object。作用: 当前没有诊断摘要。
      diagnostics: {}
    }
  },

  // 类型: object。
  // 作用: 模拟数据源 09 显式绑定可信 Provider，并保存迁移检查摘要。
  'legacy-system-demo': {
    // 类型: string。作用: 显式绑定项目内可信 mock Provider。
    providerKey: TRUSTED_MOCK_PROVIDER_KEY,
    // 类型: object。作用: 定义模拟数据源 09 的四个运行分区。
    runtimeStorage: {
      // 类型: object。作用: 当前没有模拟运行凭据。
      credentials: {},
      // 类型: object。作用: 当前没有模拟会话上下文。
      session: {},
      // 类型: object。作用: 当前没有可重建内容缓存。
      cache: {},
      // 类型: object。作用: 保存该系统源已可进入新 Repository 链路的迁移检查摘要。
      diagnostics: {
        migrationCheck: { status: 'ready' }
      }
    }
  }
});

/**
 * 校验对象只包含指定字段。
 * 纯函数: 不修改对象或字段清单。
 * 成功路径: 字段数量和名称完全一致时返回原对象。
 * 失败路径: 缺失或额外字段时抛领域校验错误。
 *
 * @param {object} value 已确认的普通对象。
 * @param {Array<string>} expectedKeys 固定允许字段。
 * @param {string} fieldName 错误信息中的对象路径。
 * @returns {object} 字段集合完整的原对象。
 * @throws {SourceRepositoryValidationError} 当字段集合不一致时抛出。
 */
function assertExactObjectKeys(value, expectedKeys, fieldName) {
  // 类型: Array<string>。
  // 作用: 读取实际字段，用于同时发现缺失和未进入配置契约的影子字段。
  const actualKeys = Object.keys(value);

  // 条件分支: 字段数量或名称与固定集合不一致时进入。
  // 执行内容: 明确拒绝配置默认补齐和静默忽略。
  if (actualKeys.length !== expectedKeys.length
    || actualKeys.some(actualKey => !expectedKeys.includes(actualKey))) {
    throw new SourceRepositoryValidationError(
      `${fieldName} 必须完整包含: ${expectedKeys.join(', ')}`
    );
  }

  // 返回值类型: object。
  // 作用: 返回字段集合已确认的原对象，供后续逐字段校验。
  return value;
}

/**
 * 为一条旧自定义模拟记录创建与公共协议一致的唯一 Provider 键。
 * 纯函数: 只拼接显式 sourceId 和固定后缀，不读取 sourceKind、页面或注册表。
 * 失败路径: sourceId 的正式安全校验仍由 validateSourceSeedConfigs 执行。
 *
 * @param {string} sourceId 当前显式自定义模拟记录 id。
 * @returns {string} `${sourceId}.provider` 唯一工厂身份。
 */
function createCustomProviderKey(sourceId) {
  return `${sourceId}${SOURCE_PROVIDER_KEY_SUFFIX}`;
}

/**
 * 校验显式数据源种子配置与记录 sourceId 一一对应。
 * 纯函数: 返回配置隔离副本，不修改调用方配置和 sourceId 数组。
 * 成功路径: 配置覆盖、providerKey 和四运行分区全部完整时返回安全配置。
 * 失败路径: 记录重复、配置缺失/多余、字段或分区非法时抛领域校验错误。
 *
 * @param {object} sourceSeedConfigs 按 sourceId 声明的显式配置。
 * @param {Array<string>} sourceIds 当前 SourceManagerState 记录 id 数组。
 * @returns {object} 已严格校验和隔离的显式配置。
 * @throws {SourceRepositoryValidationError} 当配置不能和记录一一对应时抛出。
 */
function validateSourceSeedConfigs(sourceSeedConfigs, sourceIds) {
  // 类型: object。
  // 作用: 严格校验配置为 JSON Value 并切断导出配置或调用方对象引用。
  const safeConfigs = cloneSerializableValue(sourceSeedConfigs, 'sourceRepositorySeedConfigs');

  // 执行内容: 配置根节点必须是普通对象。
  assertPlainObject(safeConfigs, 'sourceRepositorySeedConfigs');

  // 类型: Array<string>。
  // 作用: 校验每个记录 id 安全，并保留输入顺序供重复检查和覆盖对比。
  const safeSourceIds = sourceIds.map((sourceId, sourceIndex) => {
    return assertSafeRecordKey(sourceId, `sourceIds[${sourceIndex}]`);
  });

  // 类型: Set<string>。
  // 作用: 检查 SourceManagerState 是否包含重复记录 id。
  const uniqueSourceIds = new Set(safeSourceIds);
  // 条件分支: 去重后数量小于原记录数量时进入。
  // 执行内容: 拒绝两个保存图对象共享 sourceId，避免配置和 Repository 关联歧义。
  if (uniqueSourceIds.size !== safeSourceIds.length) {
    throw new SourceRepositoryValidationError('sourceManagerState.records 包含重复 sourceId');
  }

  // 类型: Array<string>。
  // 作用: 读取显式配置 id，并校验每个动态键安全。
  const configSourceIds = Object.keys(safeConfigs).map((sourceId) => {
    return assertSafeRecordKey(sourceId, 'sourceRepositorySeedConfigs sourceId');
  });

  // 类型: Array<string>。
  // 作用: 找出有记录但没有显式 Provider/Storage 配置的 sourceId。
  const missingSourceIds = safeSourceIds.filter(sourceId => !Object.hasOwn(safeConfigs, sourceId));

  // 类型: Array<string>。
  // 作用: 找出配置中已经没有对应 SourceManagerState 记录的陈旧 sourceId。
  const extraSourceIds = configSourceIds.filter(sourceId => !uniqueSourceIds.has(sourceId));

  // 条件分支: 配置覆盖不是一一对应时进入。
  // 执行内容: 拒绝 Provider 推断、默认配置和无人维护的陈旧条目。
  if (missingSourceIds.length > 0 || extraSourceIds.length > 0) {
    throw new SourceRepositoryValidationError(
      `显式种子配置与记录不一致；缺失: ${missingSourceIds.join(', ') || '无'}；多余: ${extraSourceIds.join(', ') || '无'}`
    );
  }

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 对每条记录配置执行相同 providerKey 和四运行分区校验。
  safeSourceIds.forEach((sourceId) => {
    // 类型: object。
    // 作用: 保存当前 sourceId 的显式配置对象。
    const seedConfig = safeConfigs[sourceId];
    assertPlainObject(seedConfig, `sourceRepositorySeedConfigs.${sourceId}`);
    assertExactObjectKeys(
      seedConfig,
      SOURCE_SEED_CONFIG_KEYS,
      `sourceRepositorySeedConfigs.${sourceId}`
    );
    assertNonEmptyString(
      seedConfig.providerKey,
      `sourceRepositorySeedConfigs.${sourceId}.providerKey`
    );

    // 执行内容: runtimeStorage 必须完整声明四个运行分区，不从旧缓存摘要推导。
    assertPlainObject(
      seedConfig.runtimeStorage,
      `sourceRepositorySeedConfigs.${sourceId}.runtimeStorage`
    );
    assertExactObjectKeys(
      seedConfig.runtimeStorage,
      RUNTIME_STORAGE_PARTITION_KEYS,
      `sourceRepositorySeedConfigs.${sourceId}.runtimeStorage`
    );

    // 循环类型: Array.prototype.forEach。
    // 循环作用: 四个运行分区均必须是普通小型键值对象。
    RUNTIME_STORAGE_PARTITION_KEYS.forEach((partition) => {
      assertPlainObject(
        seedConfig.runtimeStorage[partition],
        `sourceRepositorySeedConfigs.${sourceId}.runtimeStorage.${partition}`
      );
    });
  });

  // 返回值类型: object。
  // 作用: 返回覆盖完整且引用隔离的配置，供纯转换过程逐条消费。
  return safeConfigs;
}

/**
 * 创建单个数据源完整五分区 Storage 种子。
 * 纯函数: 所有分区均创建隔离副本，不修改 Definition 或显式配置。
 *
 * @param {object} definitionInput 兼容 mock Definition。
 * @param {object} seedConfig 当前 sourceId 显式种子配置。
 * @param {string} sourceId 当前数据源 id，用于错误字段路径。
 * @returns {object} settings 与四个运行分区组成的完整命名空间。
 */
function createStorageNamespace(definitionInput, seedConfig, sourceId) {
  // 返回值类型: object。
  // 作用: settings 来自现有普通设置值，其他四分区来自显式小型运行数据配置。
  return {
    settings: cloneSerializableValue(
      definitionInput.settingsValues,
      `storageNamespaces.${sourceId}.settings`
    ),
    credentials: cloneSerializableValue(
      seedConfig.runtimeStorage.credentials,
      `storageNamespaces.${sourceId}.credentials`
    ),
    session: cloneSerializableValue(
      seedConfig.runtimeStorage.session,
      `storageNamespaces.${sourceId}.session`
    ),
    cache: cloneSerializableValue(
      seedConfig.runtimeStorage.cache,
      `storageNamespaces.${sourceId}.cache`
    ),
    diagnostics: cloneSerializableValue(
      seedConfig.runtimeStorage.diagnostics,
      `storageNamespaces.${sourceId}.diagnostics`
    )
  };
}

/**
 * 把兼容 SourceManagerState 和显式配置转换成四类 Repository 初始化种子。
 * 纯函数: 全部输入先隔离，全部输出均为新对象，不修改页面 mock 或导出配置。
 * Provider 边界: providerKey 只来自 sourceSeedConfigs，不读取 sourceKind 推断执行入口。
 * Storage 边界: 只保存小型结构化值，不读取旧 cache 摘要或创建容量占位字符串。
 *
 * @param {object} sourceManagerState 当前兼容 SourceManagerState。
 * @param {object} sourceSeedConfigs 按 sourceId 显式声明的 Provider 与运行空间配置。
 * @returns {object} packages、definitions、preferences 和 storageNamespaces 四类种子。
 * @throws {SourceRepositoryValidationError} 当记录、配置覆盖或显式字段不符合契约时抛出。
 */
export function createSourceRepositorySeeds(sourceManagerState, sourceSeedConfigs) {
  // 类型: object。
  // 作用: 严格复制兼容 SourceManagerState，避免转换过程持有页面 mock 引用。
  const safeState = cloneSerializableValue(sourceManagerState, 'sourceManagerState');

  // 执行内容: 兼容状态根节点必须是普通对象。
  assertPlainObject(safeState, 'sourceManagerState');

  // 条件分支: records 不是数组时进入。
  // 执行内容: 阻止转换器对缺失记录集合进行隐式空转换。
  if (!Array.isArray(safeState.records)) {
    throw new SourceRepositoryValidationError('sourceManagerState.records 必须是数组');
  }

  // 类型: Array<string>。
  // 作用: 提取当前九条记录 id，供显式配置覆盖和重复检查。
  const sourceIds = safeState.records.map((record, recordIndex) => {
    assertPlainObject(record, `sourceManagerState.records[${recordIndex}]`);
    assertPlainObject(record.definition, `sourceManagerState.records[${recordIndex}].definition`);

    // 执行内容: runtime 必须是普通对象，避免读取缺失运行态时泄漏原生 TypeError。
    assertPlainObject(record.runtime, `sourceManagerState.records[${recordIndex}].runtime`);

    // 条件分支: enabled 不是严格 Boolean 时进入。
    // 执行内容: 拒绝将字符串 false 等真值静默转换为启用决定。
    if (typeof record.runtime.enabled !== 'boolean') {
      throw new SourceRepositoryValidationError(
        `sourceManagerState.records[${recordIndex}].runtime.enabled 必须是 boolean`
      );
    }

    return record.definition.id;
  });

  // 类型: object。
  // 作用: 获得与记录一一对应、providerKey 和四运行分区完整的隔离配置。
  const safeConfigs = validateSourceSeedConfigs(sourceSeedConfigs, sourceIds);

  // 类型: Array<object>。
  // 作用: 累积 SourcePackage 种子，保持 sourceManagerState.records 顺序。
  const packages = [];

  // 类型: Array<object>。
  // 作用: 累积 SourceDefinition 种子，保持与 Package 相同顺序。
  const definitions = [];

  // 类型: Record<string, object>。
  // 作用: 按安全 sourceId 保存用户启用决定和授权快照。
  const sourceStates = {};

  // 类型: Record<string, object>。
  // 作用: 按安全 sourceId 保存完整五分区小型私有空间。
  const storageNamespaces = {};

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 把每条兼容记录和对应显式配置转换成四个保存域。
  safeState.records.forEach((record) => {
    // 类型: object。
    // 作用: 保存当前兼容 Definition 输入，不把脚本和设置值直接写入目标 Definition。
    const definitionInput = record.definition;

    // 类型: string。
    // 作用: 当前记录安全 sourceId，关联 Package、Definition、Preferences 和 Storage。
    const sourceId = assertSafeRecordKey(definitionInput.id, 'sourceDefinition.id');

    // 类型: object。
    // 作用: 当前 sourceId 显式 Provider 和运行空间配置。
    const seedConfig = safeConfigs[sourceId];

    // 类型: string。
    // 作用: 根据 sourceId 创建稳定包引用，不包含 Provider 类型推断。
    const packageRef = createSourcePackageRef(sourceId);

    // 类型: string。
    // 作用: 直接读取当前记录显式 providerKey，Package 和 Definition 共用同一值。
    const providerKey = seedConfig.providerKey;

    // 类型: string。
    // 作用: 规范化脚本文本，供 Package 保存、导出和完整性指纹共同使用。
    const scriptContent = normalizeSourceScriptContent(definitionInput.scriptContent);

    // 副作用范围: 只向本函数局部 packages 数组追加新对象。
    packages.push({
      packageRef,
      schemaVersion: SOURCE_PACKAGE_SCHEMA_VERSION,
      sourceId,
      providerKey,
      scriptContent,
      integrity: {
        algorithm: SOURCE_SCRIPT_INTEGRITY_ALGORITHM,
        scriptHash: createSourceScriptHash(scriptContent)
      }
    });

    // 副作用范围: 只向本函数局部 definitions 数组追加新对象。
    definitions.push({
      schemaVersion: definitionInput.schemaVersion,
      id: sourceId,
      name: definitionInput.name,
      description: definitionInput.description,
      sourceKind: definitionInput.sourceKind,
      version: definitionInput.version,
      providerKey,
      packageRef,
      importMethod: definitionInput.importMethod,
      remoteUrl: definitionInput.remoteUrl,
      importedAt: definitionInput.importedAt,
      lastUpdatedAt: definitionInput.lastUpdatedAt,
      capabilities: cloneSerializableValue(
        definitionInput.capabilities,
        `definitions.${sourceId}.capabilities`
      ),
      settingsSchema: cloneSerializableValue(
        definitionInput.settingsSchema,
        `definitions.${sourceId}.settingsSchema`
      )
    });

    // 副作用范围: 写入本函数局部 sourceStates 普通对象；sourceId 已通过动态键安全校验。
    sourceStates[sourceId] = {
      enabled: record.runtime.enabled,
      authorization: cloneSerializableValue(
        record.authorization,
        `sourceStates.${sourceId}.authorization`
      )
    };

    // 副作用范围: 写入本函数局部 storageNamespaces；不读取旧 record.cache 手写摘要。
    storageNamespaces[sourceId] = createStorageNamespace(
      definitionInput,
      seedConfig,
      sourceId
    );
  });

  // 返回值类型: object。
  // 作用: 返回可显式传给 Memory Repository 工厂的四类分离种子。
  return {
    packages,
    definitions,
    preferences: {
      schemaVersion: SOURCE_PREFERENCES_SCHEMA_VERSION,
      defaultSourceId: safeState.defaultSourceId,
      removedSystemSourceIds: cloneSerializableValue(
        safeState.removedSystemSourceIds,
        'removedSystemSourceIds'
      ),
      sourceStates
    },
    storageNamespaces
  };
}

// 类型: object。
// 作用: 使用九条页面 mock 和九条显式配置生成默认分离数据；调用方仍必须显式传给 Repository 工厂。
export const sourceRepositorySeeds = createSourceRepositorySeeds(
  sourceManagerMock,
  sourceRepositorySeedConfigs
);
