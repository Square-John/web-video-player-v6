/*
  source-repository-test-fixtures.js 模块说明

  - 文件职责:
      把测试专用 SourceManagerState 场景转换为严格 Repository 保存图，供 Mock Provider 领域测试复用。
      本文件只位于 tests 模块图，产品种子、Runtime 和页面不得导入旧模拟身份。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      sourceManagerMock: 自定义测试数据，提供九条授权、启停和 Provider 未就绪场景。
      MOCK_SOURCE_PROVIDER_KEY: 自定义测试 Provider 标识，绑定四条可运行场景和一条不支持场景。
      SOURCE_SCRIPT_INTEGRITY_ALGORITHM: 自定义配置，统一测试 Package 的 SHA-256 算法。
      createSourceScriptHash/normalizeSourceScriptContent: 自定义工具，生成与授权快照一致的规范化脚本指纹。
      SOURCE_STORAGE_PARTITION/cloneSerializableValue/createSourcePackageRef: 自定义 Repository 工具，创建隔离保存图。
      Repository validators: 自定义校验器，复核动态身份和三类保存对象。

  - 模块级常量:
      SOURCE_PACKAGE_SCHEMA_VERSION: string，测试 SourcePackage 保存结构版本。
      SOURCE_PREFERENCES_SCHEMA_VERSION: string，测试 SourcePreferences 保存结构版本。
      CUSTOM_PROVIDER_KEY_SUFFIX: string，未注册自定义测试工厂键后缀。
      MOCK_PROVIDER_BINDING_SOURCE_IDS: Set<string>，测试 Mock 工厂绑定的显式身份。
      mockSourceRepositorySeeds: object，默认九条测试专用 Repository 保存图。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createEmptyStorageNamespace(settingsValues): 创建完整五分区测试命名空间。
      resolveTestProviderKey(sourceId): 读取显式 Mock 绑定或创建独立未注册键。
      createMockSourceRepositorySeeds(sourceManagerState): 转换并复核测试保存图。

  - 模块级类:
      无

  - 对外导出:
      createMockSourceRepositorySeeds: Function，供专项测试转换隔离 SourceManagerState 场景。
      mockSourceRepositorySeeds: object，供 Runtime 和 Manager 测试创建独占 Memory Repository。
*/

// 导入来源: ../src/data/settings/source-manager.mock.js。
// 导入内容: sourceManagerMock 九条测试专用管理状态。
// 文件作用: 提供授权、禁用、未注册和工厂不支持等自动测试场景，不进入产品模块图。
import { sourceManagerMock } from '../src/data/settings/source-manager.mock.js';

// 导入来源: ../src/data/providers/createMockSourceProvider.js。
// 导入内容: MOCK_SOURCE_PROVIDER_KEY 测试 Mock ProviderFactory 注册键。
// 文件作用: 让四条可运行测试源与 system-source-5 不支持场景共用同一工厂身份。
import { MOCK_SOURCE_PROVIDER_KEY } from '../src/data/providers/createMockSourceProvider.js';

// 导入来源: ../src/config/source-manager.config.js。
// 导入内容: SOURCE_SCRIPT_INTEGRITY_ALGORITHM 脚本完整性算法名称。
// 文件作用: 测试 Package 使用与产品 Repository 相同的 SHA-256 契约。
import { SOURCE_SCRIPT_INTEGRITY_ALGORITHM } from '../src/config/source-manager.config.js';

import {
  // 导入来源: ../src/utils/sourceAuthorization.js；导入内容: createSourceScriptHash；文件作用: 计算测试脚本 SHA-256。
  createSourceScriptHash,
  // 导入来源: ../src/utils/sourceAuthorization.js；导入内容: normalizeSourceScriptContent；文件作用: 统一换行和文本边界。
  normalizeSourceScriptContent
} from '../src/utils/sourceAuthorization.js';

import {
  // 导入来源: ../src/repositories/source/sourceRepositoryUtils.js；导入内容: SOURCE_STORAGE_PARTITION；文件作用: 建立完整五分区。
  SOURCE_STORAGE_PARTITION,
  // 导入来源: ../src/repositories/source/sourceRepositoryUtils.js；导入内容: cloneSerializableValue；文件作用: 隔离测试输入和导出。
  cloneSerializableValue,
  // 导入来源: ../src/repositories/source/sourceRepositoryUtils.js；导入内容: createSourcePackageRef；文件作用: 创建稳定 Package 引用。
  createSourcePackageRef
} from '../src/repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../src/repositories/source/sourceRepositoryValidators.js；导入内容: assertSafeRecordKey；文件作用: 校验动态 sourceId。
  assertSafeRecordKey,
  // 导入来源: ../src/repositories/source/sourceRepositoryValidators.js；导入内容: validateSourceDefinition；文件作用: 复核 Definition 精确字段。
  validateSourceDefinition,
  // 导入来源: ../src/repositories/source/sourceRepositoryValidators.js；导入内容: validateSourcePackage；文件作用: 复核 Package 精确字段。
  validateSourcePackage,
  // 导入来源: ../src/repositories/source/sourceRepositoryValidators.js；导入内容: validateSourcePreferences；文件作用: 复核 Preferences 精确字段。
  validateSourcePreferences
} from '../src/repositories/source/sourceRepositoryValidators.js';

// 类型: string；作用: 测试脚本包沿用正式 SourcePackage 第一版保存结构。
const SOURCE_PACKAGE_SCHEMA_VERSION = '1.0.0';
// 类型: string；作用: 测试全局偏好沿用正式 SourcePreferences 第一版保存结构。
const SOURCE_PREFERENCES_SCHEMA_VERSION = '1.0.0';
// 类型: string；作用: 为缺少受信任工厂的自定义测试记录创建稳定独立 providerKey。
const CUSTOM_PROVIDER_KEY_SUFFIX = '.provider';
// 类型: Set<string>；作用: 显式绑定 Mock 工厂的测试身份；system-source-5 由工厂 supports 返回 false。
const MOCK_PROVIDER_BINDING_SOURCE_IDS = new Set([
  'system-source-1',
  'system-source-2',
  'system-source-3',
  'system-source-4',
  'system-source-5'
]);

/**
 * 创建测试数据源完整五分区命名空间。
 * 纯函数: 隔离复制普通设置值，每次创建独立分区对象，不修改 SourceManagerState。
 * 成功路径: settings 保存测试声明值，其余运行分区为空并等待用例显式写入。
 * 失败路径: settingsValues 不是严格 JSON Value 时由 cloneSerializableValue 抛 Repository 校验错误。
 *
 * @param {object} settingsValues 测试记录声明的普通非敏感设置值。
 * @returns {object} 完整五分区私有空间。
 */
function createEmptyStorageNamespace(settingsValues) {
  return {
    [SOURCE_STORAGE_PARTITION.settings]: cloneSerializableValue(settingsValues, 'testSource.settingsValues'),
    [SOURCE_STORAGE_PARTITION.credentials]: {},
    [SOURCE_STORAGE_PARTITION.session]: {},
    [SOURCE_STORAGE_PARTITION.cache]: {},
    [SOURCE_STORAGE_PARTITION.diagnostics]: {}
  };
}

/**
 * 解析测试 Definition 使用的显式 ProviderFactory 键。
 * 纯函数: 只读取冻结绑定集合，不根据 sourceKind、importMethod 或启用状态推断实现。
 * 成功路径: Mock 场景返回统一工厂键，其他记录返回自身独立未注册键。
 * 失败路径: 非法 sourceId 由调用方在进入本函数前拒绝。
 *
 * @param {string} sourceId 测试记录安全身份。
 * @returns {string} Package 与 Definition 共用的 providerKey。
 */
function resolveTestProviderKey(sourceId) {
  return MOCK_PROVIDER_BINDING_SOURCE_IDS.has(sourceId)
    ? MOCK_SOURCE_PROVIDER_KEY
    : `${sourceId}${CUSTOM_PROVIDER_KEY_SUFFIX}`;
}

/**
 * 把测试专用 SourceManagerState 转换为四类严格 Repository 种子。
 * 纯函数: 对输入和输出执行隔离复制，不创建 Repository、Runtime 或 Provider。
 * 成功路径: 保持测试记录顺序、启停和授权决定，并生成完整关联保存图。
 * 失败路径: 输入字段、脚本哈希或跨对象关联无效时由正式校验器抛出，测试不能获得半完成种子。
 *
 * @param {object} sourceManagerState 测试专用管理状态候选。
 * @returns {object} packages、definitions、preferences 和 storageNamespaces 四类保存图。
 */
export function createMockSourceRepositorySeeds(sourceManagerState = sourceManagerMock) {
  // 类型: object；作用: 隔离当前用例输入，后续转换不污染共享测试状态。
  const safeState = cloneSerializableValue(sourceManagerState, 'mockSourceManagerState');
  // 类型: Array<object>；作用: 按管理记录顺序累积测试脚本包。
  const packages = [];
  // 类型: Array<object>；作用: 按 Package 相同顺序累积测试定义。
  const definitions = [];
  // 类型: Record<string, object>；作用: 按 sourceId 保存测试启用和授权决定。
  const sourceStates = {};
  // 类型: Record<string, object>；作用: 按 sourceId 保存独立五分区命名空间。
  const storageNamespaces = {};

  // 循环作用: 每条测试记录生成一个 Package、Definition、Preferences state 和 Storage namespace。
  safeState.records.forEach((record, recordIndex) => {
    // 类型: string；作用: 校验并保存四类对象共同使用的安全 sourceId。
    const sourceId = assertSafeRecordKey(record.definition.id, `mockSource.records[${recordIndex}].id`);
    // 类型: string；作用: 规范化测试脚本文本，使 Package 哈希与既有授权快照使用同一事实。
    const scriptContent = normalizeSourceScriptContent(record.definition.scriptContent);
    // 类型: string；作用: 当前测试脚本 SHA-256，供 Package 完整性和授权有效性共同判断。
    const scriptHash = createSourceScriptHash(scriptContent);
    // 类型: string；作用: Package 和 Definition 共用的显式测试工厂身份。
    const providerKey = resolveTestProviderKey(sourceId);
    // 类型: string；作用: 当前测试 sourceId 的稳定 Package Repository 引用。
    const packageRef = createSourcePackageRef(sourceId);

    // 类型: object；作用: 保存当前测试脚本文本、工厂身份和完整性。
    const sourcePackage = {
      packageRef,
      schemaVersion: SOURCE_PACKAGE_SCHEMA_VERSION,
      sourceId,
      providerKey,
      scriptContent,
      integrity: {
        algorithm: SOURCE_SCRIPT_INTEGRITY_ALGORITHM,
        scriptHash
      }
    };
    // 类型: object；作用: 删除页面临时脚本与设置值后生成正式可序列化 Definition。
    const sourceDefinition = {
      schemaVersion: record.definition.schemaVersion,
      id: sourceId,
      name: record.definition.name,
      description: record.definition.description,
      sourceKind: record.definition.sourceKind,
      version: record.definition.version,
      providerKey,
      packageRef,
      importMethod: record.definition.importMethod,
      remoteUrl: record.definition.remoteUrl,
      importedAt: record.definition.importedAt,
      lastUpdatedAt: record.definition.lastUpdatedAt,
      capabilities: cloneSerializableValue(record.definition.capabilities, `mockSource.${sourceId}.capabilities`),
      settingsSchema: cloneSerializableValue(record.definition.settingsSchema, `mockSource.${sourceId}.settingsSchema`)
    };

    validateSourcePackage(sourcePackage);
    validateSourceDefinition(sourceDefinition);
    packages.push(sourcePackage);
    definitions.push(sourceDefinition);
    // 赋值副作用: 只写本函数局部安全对象；授权快照继续接受正式有效性评估。
    sourceStates[sourceId] = {
      enabled: record.runtime.enabled,
      authorization: cloneSerializableValue(record.authorization, `mockSource.${sourceId}.authorization`)
    };
    // 赋值副作用: 只写本函数局部安全对象；测试需要运行缓存时必须在用例中显式写入。
    storageNamespaces[sourceId] = createEmptyStorageNamespace(record.definition.settingsValues);
  });

  // 类型: object；作用: 保持测试默认源和软隐藏决定，同时关联当前生成的 sourceStates。
  const preferences = {
    schemaVersion: SOURCE_PREFERENCES_SCHEMA_VERSION,
    defaultSourceId: safeState.defaultSourceId,
    removedSystemSourceIds: cloneSerializableValue(
      safeState.removedSystemSourceIds,
      'mockSource.removedSystemSourceIds'
    ),
    sourceStates
  };
  validateSourcePreferences(preferences);

  return { packages, definitions, preferences, storageNamespaces };
}

// 类型: object；作用: 默认九条测试专用保存图，产品 Runtime 和产品种子不得导入。
export const mockSourceRepositorySeeds = createMockSourceRepositorySeeds();
