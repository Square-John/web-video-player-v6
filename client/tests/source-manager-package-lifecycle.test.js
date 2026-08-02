/*
  source-manager-package-lifecycle.test.js 模块说明

  - 文件职责:
      验证 SourceManager 4D 自定义源导入、包更新、混合批量删除和最小脚本导出。
      证明四个保存域原子提交、更新授权失效、默认源整批交接、系统源保留、自定义源完整删除和失败回滚。

  - 导入库及文件汇总(7 条，内置 2 条，第三方 0 条，自定义 5 条):
      assert、test: 内置测试能力，注册 Node 测试并执行严格断言。
      AUTHORIZATION_STATUS、HEALTH_STATUS、IMPORT_METHOD、SOURCE_KIND: 自定义配置，构造和断言首次授权、更新失效及稳定领域枚举。
      SOURCE_STORAGE_PARTITION、cloneSerializableValue: 自定义 Repository 工具，访问私有分区并隔离测试输入。
      createSourceScriptHash: 自定义授权工具，为测试 Package 生成与真实实现一致的脚本指纹。
      SourceManagerInvariantError、SourceManagerNotFoundError、SourceManagerOperationError、SourceManagerValidationError: 自定义错误，断言稳定失败边界。
      createSourceManagerTestEnvironment: 自定义夹具，创建隔离 Repository、端口和 SourceManager。

  - 模块级常量:
      PACKAGE_LIFECYCLE_TEST_SOURCE_ID: string，4D 导入测试唯一 sourceId。
      PACKAGE_LIFECYCLE_TEST_IMPORTED_AT: string，导入测试固定 UTC 时间。
      PACKAGE_LIFECYCLE_TEST_UPDATED_AT: string，更新测试固定 UTC 时间。
      PACKAGE_LIFECYCLE_TEST_EXPORTED_AT: string，导出测试固定 UTC 时间。

  - 模块级变量:
      无

  - 模块级辅助函数:
      findRecord(state, sourceId): Function，按 sourceId 查找轻量记录。
      createImportCommand(seeds, sourceId): Function，从现有自定义源结构创建新身份导入命令。
      findAlternativeEnabledRecord(state, excludedSourceIds): Function，选择整批目标之外的默认源候选。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert Node 严格断言对象。
// 文件作用: 比较 Repository 保存对象、投影、导出字段和错误类型。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 声明生产构建前执行的 SourceManager 4D 生命周期测试。
import test from 'node:test';

import {
  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: AUTHORIZATION_STATUS 授权状态枚举。
  // 文件作用: 断言新导入和脚本更新后的自定义源进入 pending。
  AUTHORIZATION_STATUS,

  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 健康状态枚举。
  // 文件作用: 构造更新前稳定会话运行态，不使用散落状态字符串。
  HEALTH_STATUS,

  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 导入方式枚举。
  // 文件作用: 测试导入命令使用 text 自定义源，不伪装成 builtin。
  IMPORT_METHOD,

  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: 动态选择现有自定义模板和系统软隐藏目标。
  SOURCE_KIND
} from '../src/config/source-manager.config.js';

import {
  // 导入来源: ../src/repositories/source/sourceRepositoryUtils.js。
  // 导入内容: SOURCE_STORAGE_PARTITION 私有空间五分区枚举。
  // 文件作用: 写入和读取普通 settings，并验证自定义删除清理完整命名空间。
  SOURCE_STORAGE_PARTITION,

  // 导入来源: ../src/repositories/source/sourceRepositoryUtils.js。
  // 导入内容: cloneSerializableValue 严格 JSON 隔离函数。
  // 文件作用: 从默认种子创建不会污染其他测试的 Package 和 Definition 候选。
  cloneSerializableValue
} from '../src/repositories/source/sourceRepositoryUtils.js';

// 导入来源: ../src/utils/sourceAuthorization.js。
// 导入内容: createSourceScriptHash 规范化脚本文本指纹函数。
// 文件作用: 为导入和更新 Package 生成真实完整性声明。
import { createSourceScriptHash } from '../src/utils/sourceAuthorization.js';

import {
  // 导入来源: ../src/services/source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerInvariantError 领域不变量错误。
  // 文件作用: 断言重复导入、身份变化和错误默认源交接不提交。
  SourceManagerInvariantError,

  // 导入来源: ../src/services/source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerNotFoundError 记录未找到错误。
  // 文件作用: 断言导出包含未知 sourceId 时不返回部分结果。
  SourceManagerNotFoundError,

  // 导入来源: ../src/services/source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerOperationError 领域操作错误。
  // 文件作用: 断言 Repository 写入失败完成回滚后保留统一 operation 边界。
  SourceManagerOperationError,

  // 导入来源: ../src/services/source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerValidationError 命令校验错误。
  // 文件作用: 断言脚本声明哈希和真实文本不一致时在排队前失败。
  SourceManagerValidationError
} from '../src/services/source-manager/sourceManagerErrors.js';

// 导入来源: ./source-manager-test-fixtures.js。
// 导入内容: createSourceManagerTestEnvironment 隔离测试环境工厂。
// 文件作用: 每个 4D 测试获得独立种子、Repository 和 SourceManager。
import { createSourceManagerTestEnvironment } from './source-manager-test-fixtures.js';

// 类型: string。
// 作用: 固定 4D 新导入自定义源身份，测试结束后只存在于当前内存环境。
const PACKAGE_LIFECYCLE_TEST_SOURCE_ID = 'custom-package-lifecycle-4d';

// 类型: string。
// 作用: 导入 Definition 使用固定标准 UTC 时间，避免依赖系统时钟。
const PACKAGE_LIFECYCLE_TEST_IMPORTED_AT = '2026-07-15T03:00:00.000Z';

// 类型: string。
// 作用: 更新 Definition 使用固定标准 UTC 时间，便于断言保存值准确采用。
const PACKAGE_LIFECYCLE_TEST_UPDATED_AT = '2026-07-15T04:00:00.000Z';

// 类型: string。
// 作用: 最小导出包使用固定审计时间，证明 SourceManager 不自行读取系统时钟。
const PACKAGE_LIFECYCLE_TEST_EXPORTED_AT = '2026-07-15T05:00:00.000Z';

/**
 * 按 sourceId 查找轻量 SourceRecord。
 * 纯函数: 只读取 SourceManagerState.records，不修改数组或记录。
 *
 * @param {object} state SourceManagerState 轻量投影。
 * @param {string} sourceId 数据源唯一标识。
 * @returns {object|null} 匹配记录；未命中时返回 null。
 */
function findRecord(state, sourceId) {
  // 返回值类型: object|null。
  // 作用: 返回唯一匹配记录，便于测试显式断言存在或删除结果。
  return state.records.find(record => record.definition.id === sourceId) || null;
}

/**
 * 从现有自定义源结构创建一个新身份导入命令。
 * 纯函数: 克隆并改写测试专属对象，不修改默认种子。
 *
 * @param {object} seeds 当前测试隔离 Repository 种子。
 * @param {string} sourceId 新导入数据源 id。
 * @returns {object} 字段完整、关联一致且指纹有效的导入命令。
 * @returns {object} return.sourcePackage 新 SourcePackage。
 * @returns {object} return.sourceDefinition 新自定义 SourceDefinition。
 * @returns {object} return.settings 两个普通设置值。
 * @returns {string} return.authorizedAt 用户确认当前脚本风险的固定 UTC 时间。
 * @returns {boolean} return.enableAfterImport 固定 false，表示保存有效授权但保持关闭。
 * @throws {AssertionError} 当种子没有可复用自定义源结构时抛出。
 */
function createImportCommand(seeds, sourceId = PACKAGE_LIFECYCLE_TEST_SOURCE_ID) {
  // 类型: object|null。
  // 作用: 选择现有自定义 Definition 作为字段完整结构模板，不复制系统源权限。
  const templateDefinition = seeds.definitions.find(
    definition => definition.sourceKind === SOURCE_KIND.custom
  ) || null;
  assert.ok(templateDefinition);

  // 类型: object|null。
  // 作用: 按模板 packageRef 定位对应 Package，确保测试候选字段与真实契约一致。
  const templatePackage = seeds.packages.find(
    sourcePackage => sourcePackage.packageRef === templateDefinition.packageRef
  ) || null;
  assert.ok(templatePackage);

  // 类型: string。
  // 作用: 为新 sourceId 创建稳定唯一包引用，避免与九条默认 Package 冲突。
  const packageRef = `source-package::${sourceId}`;

  // 类型: string。
  // 作用: 按单文件公共协议从新 sourceId 唯一派生 Provider 工厂键，Package 与 Definition 共用。
  const providerKey = `${sourceId}.provider`;

  // 类型: string。
  // 作用: 提供可辨认测试脚本文本，只参与保存、指纹和导出，不执行。
  const scriptContent = `export default { sourceId: '${sourceId}' };`;

  // 类型: object。
  // 作用: 克隆模板 Package 并替换新身份和真实脚本指纹。
  const sourcePackage = cloneSerializableValue(templatePackage, 'packageLifecycleImportPackage');
  sourcePackage.packageRef = packageRef;
  sourcePackage.sourceId = sourceId;
  sourcePackage.providerKey = providerKey;
  sourcePackage.scriptContent = scriptContent;
  sourcePackage.integrity.scriptHash = createSourceScriptHash(scriptContent);

  // 类型: object。
  // 作用: 克隆模板 Definition 并替换新身份、展示字段和导入审计字段。
  const sourceDefinition = cloneSerializableValue(
    templateDefinition,
    'packageLifecycleImportDefinition'
  );
  sourceDefinition.id = sourceId;
  sourceDefinition.name = '模拟导入数据源 4D';
  sourceDefinition.description = 'SourceManager 4D 生命周期测试数据源。';
  sourceDefinition.version = 'v1.0.0';
  sourceDefinition.providerKey = providerKey;
  sourceDefinition.packageRef = packageRef;
  sourceDefinition.importMethod = IMPORT_METHOD.text;
  sourceDefinition.remoteUrl = '';
  sourceDefinition.importedAt = PACKAGE_LIFECYCLE_TEST_IMPORTED_AT;
  sourceDefinition.lastUpdatedAt = PACKAGE_LIFECYCLE_TEST_IMPORTED_AT;

  // 返回值类型: object。
  // 作用: 返回标准导入命令，settings 只包含普通非敏感测试值。
  return {
    sourcePackage,
    sourceDefinition,
    settings: {
      layout: 'compact',
      pageSize: 24
    },
    authorizedAt: PACKAGE_LIFECYCLE_TEST_IMPORTED_AT,
    enableAfterImport: false
  };
}

/**
 * 选择整批目标之外的有效默认源候选。
 * 纯函数: 只读取投影，不修改记录顺序或默认源。
 *
 * @param {object} state SourceManagerState 轻量投影。
 * @param {Array<string>} excludedSourceIds 不能作为接替目标的整批 sourceId。
 * @returns {object} 有效启用且未软隐藏的替代记录。
 * @throws {AssertionError} 当种子没有可用候选时抛出。
 */
function findAlternativeEnabledRecord(state, excludedSourceIds) {
  // 类型: object|null。
  // 作用: 动态选择整批之外的有效启用记录，避免测试依赖具体默认源排序。
  const record = state.records.find(item => !excludedSourceIds.includes(item.definition.id)
    && item.runtime.enabled
    && !state.removedSystemSourceIds.includes(item.definition.id)) || null;
  assert.ok(record);

  // 返回值类型: object。
  // 作用: 返回可以通过 replace 交接门禁的真实候选。
  return record;
}

// 测试目的: 导入原子保存四个域和有效授权，按明确决定保持关闭，并拒绝重复身份和损坏指纹。
test('SourceManager 原子导入自定义源并保持输入输出引用隔离', async () => {
  // 类型: object。
  // 作用: 创建隔离 Repository 和 Manager，导入命令从当前测试专属种子生成。
  const environment = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 保存字段完整导入命令，后续还用于检查调用方修改不会穿透 Repository。
  const command = createImportCommand(environment.seeds);

  await environment.sourceManager.initialize();

  // 类型: object。
  // 作用: 保存导入提交后的轻量投影。
  const importedState = await environment.sourceManager.importSource(command);

  // 类型: object|null。
  // 作用: 定位新导入记录并断言首次有效授权与明确关闭决定。
  const importedRecord = findRecord(importedState, PACKAGE_LIFECYCLE_TEST_SOURCE_ID);
  assert.ok(importedRecord);
  assert.equal(importedRecord.authorization.status, AUTHORIZATION_STATUS.authorized);
  assert.equal(importedRecord.authorization.authorizedAt, PACKAGE_LIFECYCLE_TEST_IMPORTED_AT);
  assert.equal(
    importedRecord.authorization.authorizedScriptHash,
    command.sourcePackage.integrity.scriptHash
  );
  assert.equal(importedRecord.runtime.enabled, false);
  assert.equal(importedState.defaultSourceId, environment.seeds.preferences.defaultSourceId);

  assert.deepEqual(
    await environment.repositories.storageRepository.get(
      PACKAGE_LIFECYCLE_TEST_SOURCE_ID,
      SOURCE_STORAGE_PARTITION.settings,
      'layout'
    ),
    'compact'
  );
  assert.equal(
    (await environment.repositories.definitionRepository.loadPreferences())
      .sourceStates[PACKAGE_LIFECYCLE_TEST_SOURCE_ID].enabled,
    false
  );

  // 副作用范围: 只修改调用方原命令，Repository 和 Manager 必须保持已隔离保存值。
  command.sourceDefinition.name = '被外部修改的名称';
  command.sourcePackage.scriptContent = 'changed outside';
  command.settings.layout = 'changed-outside';

  assert.equal(
    (await environment.repositories.definitionRepository.getDefinition(PACKAGE_LIFECYCLE_TEST_SOURCE_ID)).name,
    '模拟导入数据源 4D'
  );
  assert.equal(
    await environment.repositories.storageRepository.get(
      PACKAGE_LIFECYCLE_TEST_SOURCE_ID,
      SOURCE_STORAGE_PARTITION.settings,
      'layout'
    ),
    'compact'
  );

  await assert.rejects(
    environment.sourceManager.importSource(createImportCommand(environment.seeds)),
    SourceManagerInvariantError
  );

  // 类型: object。
  // 作用: 创建声明哈希与实际脚本文本不一致的命令，必须在进入事务前同步失败。
  const invalidIntegrityCommand = createImportCommand(environment.seeds, 'custom-invalid-integrity-4d');
  invalidIntegrityCommand.sourcePackage.integrity.scriptHash = '00000000';
  assert.throws(
    () => environment.sourceManager.importSource(invalidIntegrityCommand),
    SourceManagerValidationError
  );

  // 类型: object。
  // 作用: 创建包含原型敏感设置键的导入命令，必须在任何 Repository 写入前同步失败。
  const dangerousSettingsCommand = createImportCommand(environment.seeds, 'custom-dangerous-setting-4d');
  dangerousSettingsCommand.settings.constructor = { value: 'blocked' };
  assert.throws(
    () => environment.sourceManager.importSource(dangerousSettingsCommand),
    SourceManagerValidationError
  );
});

// 测试目的: 导入最后一个 settings 写入失败时，Package、Definition、Preferences 和 Storage 全部回滚。
test('SourceManager 导入任一保存域失败后完整回滚', async () => {
  // 类型: object。
  // 作用: 创建导入回滚使用的隔离 Repository 和 Manager 环境。
  const environment = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 保存标准导入命令，失败后按相同身份检查四个保存域均不存在。
  const command = createImportCommand(environment.seeds);
  await environment.sourceManager.initialize();

  // 副作用: 覆盖当前测试 Storage set，制造前三个保存域写入后的最终阶段失败。
  // 影响范围: 当前隔离 Repository 实例；其他测试不受影响。
  environment.repositories.storageRepository.set = async () => {
    throw new Error('storage settings failed');
  };

  await assert.rejects(
    environment.sourceManager.importSource(command),
    SourceManagerOperationError
  );

  assert.equal(
    await environment.repositories.packageRepository.get(command.sourcePackage.packageRef),
    null
  );
  assert.equal(
    await environment.repositories.definitionRepository.getDefinition(PACKAGE_LIFECYCLE_TEST_SOURCE_ID),
    null
  );
  assert.equal(
    Object.hasOwn(
      (await environment.repositories.definitionRepository.loadPreferences()).sourceStates,
      PACKAGE_LIFECYCLE_TEST_SOURCE_ID
    ),
    false
  );
  assert.equal(findRecord(await environment.sourceManager.getState(), PACKAGE_LIFECYCLE_TEST_SOURCE_ID), null);
});

// 测试目的: 自定义源版本和脚本更新使授权失效，强制默认源交接，并保留设置和历史授权诊断。
test('SourceManager 原子更新自定义源并系统收敛授权和 runtime', async () => {
  // 类型: string。
  // 作用: 使用种子中明确的已授权在线自定义源，初始化后先断言场景真实存在。
  const sourceId = 'custom-online-latest';

  // 类型: object。
  // 作用: 创建以目标为默认源且已有更新提示的隔离环境。
  const environment = createSourceManagerTestEnvironment((seeds) => {
    seeds.preferences.defaultSourceId = sourceId;
  }, {
    initialRuntimeStates: {
      [sourceId]: {
        healthStatus: HEALTH_STATUS.normal,
        lastCheckedAt: '',
        lastUnavailableReason: '',
        updateAvailable: true,
        availableVersion: 'v99.0.0',
        availableVersionUpdatedAt: PACKAGE_LIFECYCLE_TEST_UPDATED_AT,
        lastUpdateCheckedAt: PACKAGE_LIFECYCLE_TEST_UPDATED_AT
      }
    }
  });

  await environment.repositories.storageRepository.set(
    sourceId,
    SOURCE_STORAGE_PARTITION.settings,
    'preserved-setting',
    { value: 'keep-me' }
  );

  // 类型: object。
  // 作用: 初始化并确认目标确实是有效启用、已授权的默认自定义源。
  const initialState = await environment.sourceManager.initialize();

  // 类型: object|null。
  // 作用: 定位更新目标并保存授权、启用和版本字段基线。
  const initialRecord = findRecord(initialState, sourceId);
  assert.ok(initialRecord);
  assert.equal(initialRecord.definition.sourceKind, SOURCE_KIND.custom);
  assert.equal(initialRecord.runtime.enabled, true);
  assert.equal(initialRecord.authorization.status, AUTHORIZATION_STATUS.authorized);

  // 类型: object。
  // 作用: 读取并克隆当前 Package，创建脚本文本变化的新包。
  const currentPackage = await environment.repositories.packageRepository.get(initialRecord.packageRef);

  // 类型: object。
  // 作用: 保存身份稳定但脚本文本和声明指纹更新后的 Package 候选。
  const nextPackage = cloneSerializableValue(currentPackage, 'packageLifecycleUpdatePackage');
  nextPackage.scriptContent = `${currentPackage.scriptContent}\n// updated in 4D`;
  nextPackage.integrity.scriptHash = createSourceScriptHash(nextPackage.scriptContent);

  // 类型: object。
  // 作用: 克隆当前 Definition，只修改业务版本、显示说明和最后更新时间。
  const nextDefinition = cloneSerializableValue(initialRecord.definition, 'packageLifecycleUpdateDefinition');
  nextDefinition.version = 'v99.0.0';
  nextDefinition.description = '已通过 4D 原子更新。';
  nextDefinition.lastUpdatedAt = PACKAGE_LIFECYCLE_TEST_UPDATED_AT;

  await assert.rejects(environment.sourceManager.applySourceUpdate({
    sourceId,
    sourcePackage: nextPackage,
    sourceDefinition: nextDefinition
  }), SourceManagerInvariantError);

  // 类型: object|null。
  // 作用: 使用 clear 交接应用更新并读取更新后目标记录。
  const updatedRecord = findRecord(await environment.sourceManager.applySourceUpdate({
    sourceId,
    sourcePackage: nextPackage,
    sourceDefinition: nextDefinition,
    handoff: { mode: 'clear' }
  }), sourceId);

  assert.equal(updatedRecord.definition.version, 'v99.0.0');
  assert.equal(updatedRecord.authorization.status, AUTHORIZATION_STATUS.pending);
  assert.equal(updatedRecord.authorization.authorizedAt, initialRecord.authorization.authorizedAt);
  assert.equal(updatedRecord.authorization.authorizedVersion, initialRecord.authorization.authorizedVersion);
  assert.equal(updatedRecord.authorization.authorizedScriptHash, initialRecord.authorization.authorizedScriptHash);
  assert.equal(updatedRecord.runtime.enabled, false);
  assert.equal(updatedRecord.runtime.updateAvailable, false);
  assert.equal(updatedRecord.runtime.availableVersion, '');
  assert.equal((await environment.sourceManager.getState()).defaultSourceId, '');
  assert.deepEqual(
    await environment.repositories.storageRepository.get(
      sourceId,
      SOURCE_STORAGE_PARTITION.settings,
      'preserved-setting'
    ),
    { value: 'keep-me' }
  );
});

// 测试目的: 系统源或不改变版本脚本的更新保持启用和默认源，不要求虚假的交接命令。
test('SourceManager 应用不失效授权的更新并保持默认源', async () => {
  // 类型: object。
  // 作用: 创建隔离环境，当前默认系统源作为不需要用户授权的更新目标。
  const environment = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 保存初始化投影和当前默认源基线。
  const initialState = await environment.sourceManager.initialize();

  // 类型: object|null。
  // 作用: 定位当前默认系统源并确认测试分支不属于自定义授权更新。
  const initialRecord = findRecord(initialState, initialState.defaultSourceId);
  assert.ok(initialRecord);
  assert.equal(initialRecord.definition.sourceKind, SOURCE_KIND.system);

  // 类型: object|null。
  // 作用: 读取当前系统 Package；脚本文本和指纹保持不变。
  const sourcePackage = await environment.repositories.packageRepository.get(initialRecord.packageRef);

  // 类型: object。
  // 作用: 只修改系统源说明和最后更新时间，不改变身份、业务版本或脚本文本。
  const sourceDefinition = cloneSerializableValue(
    initialRecord.definition,
    'nonInvalidatingUpdateDefinition'
  );
  sourceDefinition.description = '系统源元数据已更新。';
  sourceDefinition.lastUpdatedAt = PACKAGE_LIFECYCLE_TEST_UPDATED_AT;

  // 类型: object。
  // 作用: 保存不失效授权的更新结果，默认源和 enabled 必须保持。
  const updatedState = await environment.sourceManager.applySourceUpdate({
    sourceId: initialRecord.definition.id,
    sourcePackage,
    sourceDefinition
  });

  assert.equal(updatedState.defaultSourceId, initialState.defaultSourceId);
  assert.equal(findRecord(updatedState, initialRecord.definition.id).runtime.enabled, true);
  assert.equal(
    findRecord(updatedState, initialRecord.definition.id).definition.description,
    '系统源元数据已更新。'
  );

  await assert.rejects(environment.sourceManager.applySourceUpdate({
    sourceId: initialRecord.definition.id,
    sourcePackage,
    sourceDefinition,
    handoff: { mode: 'clear' }
  }), SourceManagerValidationError);
});

// 测试目的: 更新不能改变稳定身份，保存偏好失败时新 Package 和 Definition 不得残留。
test('SourceManager 更新拒绝身份漂移并在保存失败后回滚', async () => {
  // 类型: object。
  // 作用: 创建身份漂移和更新回滚使用的隔离 Repository 与 Manager 环境。
  const environment = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 保存初始化投影，供下一步动态选择现有自定义源。
  const initialState = await environment.sourceManager.initialize();

  // 类型: object|undefined。
  // 作用: 动态选择现有自定义源作为身份门禁和回滚目标。
  const targetRecord = initialState.records.find(
    record => record.definition.sourceKind === SOURCE_KIND.custom
  );
  assert.ok(targetRecord);

  // 类型: object。
  // 作用: 保存更新前 Package 和 Definition，供失败后逐字段比较。
  const previousPackage = await environment.repositories.packageRepository.get(targetRecord.packageRef);

  // 类型: object|null。
  // 作用: 保存更新前 Definition，失败后必须与 Repository 恢复结果完全一致。
  const previousDefinition = await environment.repositories.definitionRepository.getDefinition(
    targetRecord.definition.id
  );

  // 类型: object。
  // 作用: 创建完整有效但 providerKey 改变的包，和下一 Definition 保持内部一致以触发领域身份门禁。
  const identityPackage = cloneSerializableValue(previousPackage, 'identityChangePackage');
  identityPackage.providerKey = 'changed-provider-key';

  // 类型: object。
  // 作用: 创建与 identityPackage 内部一致但违反稳定身份规则的 Definition 候选。
  const identityDefinition = cloneSerializableValue(previousDefinition, 'identityChangeDefinition');
  identityDefinition.providerKey = 'changed-provider-key';

  await assert.rejects(environment.sourceManager.applySourceUpdate({
    sourceId: targetRecord.definition.id,
    sourcePackage: identityPackage,
    sourceDefinition: identityDefinition
  }), SourceManagerInvariantError);

  // 类型: object。
  // 作用: 创建身份稳定但版本和脚本变化的下一 Package。
  const nextPackage = cloneSerializableValue(previousPackage, 'rollbackUpdatePackage');
  nextPackage.scriptContent = `${previousPackage.scriptContent}\n// rollback update`;
  nextPackage.integrity.scriptHash = createSourceScriptHash(nextPackage.scriptContent);

  // 类型: object。
  // 作用: 创建身份稳定的下一 Definition，更新业务版本和时间。
  const nextDefinition = cloneSerializableValue(previousDefinition, 'rollbackUpdateDefinition');
  nextDefinition.version = 'v88.0.0';
  nextDefinition.lastUpdatedAt = PACKAGE_LIFECYCLE_TEST_UPDATED_AT;

  // 副作用: 覆盖当前测试 Preferences 保存方法，制造 Package 和 Definition upsert 后失败。
  // 影响范围: 当前隔离 Repository 实例；事务快照恢复不依赖该公开保存方法。
  environment.repositories.definitionRepository.savePreferences = async () => {
    throw new Error('update preferences failed');
  };

  await assert.rejects(environment.sourceManager.applySourceUpdate({
    sourceId: targetRecord.definition.id,
    sourcePackage: nextPackage,
    sourceDefinition: nextDefinition
  }), SourceManagerOperationError);

  assert.deepEqual(
    await environment.repositories.packageRepository.get(targetRecord.packageRef),
    previousPackage
  );
  assert.deepEqual(
    await environment.repositories.definitionRepository.getDefinition(targetRecord.definition.id),
    previousDefinition
  );
  assert.equal(
    findRecord(await environment.sourceManager.getState(), targetRecord.definition.id).definition.version,
    previousDefinition.version
  );
});

// 测试目的: 混合删除软隐藏系统源、完整删除自定义源，并要求整批之外的默认源接替。
test('SourceManager 原子执行系统与自定义源混合批量删除', async () => {
  // 类型: object。
  // 作用: 创建混合删除成功路径使用的隔离 Repository 和 Manager 环境。
  const environment = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 保存删除前初始投影，提供当前默认系统源和接替候选基线。
  const initialState = await environment.sourceManager.initialize();

  // 类型: object。
  // 作用: 创建带 settings 的测试自定义源导入命令，作为物理删除目标。
  const importCommand = createImportCommand(environment.seeds);
  await environment.sourceManager.importSource(importCommand);

  // 类型: string。
  // 作用: 当前默认系统源作为软隐藏目标，删除后必须执行明确交接。
  const systemSourceId = initialState.defaultSourceId;

  // 类型: Array<string>。
  // 作用: 保存系统源和新自定义源组成的完整混合目标集合。
  const sourceIds = [systemSourceId, PACKAGE_LIFECYCLE_TEST_SOURCE_ID];

  // 类型: object。
  // 作用: 从整批之外动态选择有效默认源接替记录。
  const replacementRecord = findAlternativeEnabledRecord(initialState, sourceIds);

  await assert.rejects(
    environment.sourceManager.deleteSources({ sourceIds }),
    SourceManagerInvariantError
  );
  await assert.rejects(environment.sourceManager.deleteSources({
    sourceIds,
    handoff: { mode: 'replace', sourceId: PACKAGE_LIFECYCLE_TEST_SOURCE_ID }
  }), SourceManagerInvariantError);

  // 类型: object。
  // 作用: 保存合法 replace 交接后的混合删除投影。
  const deletedState = await environment.sourceManager.deleteSources({
    sourceIds,
    handoff: { mode: 'replace', sourceId: replacementRecord.definition.id }
  });

  assert.equal(deletedState.defaultSourceId, replacementRecord.definition.id);
  assert.equal(deletedState.removedSystemSourceIds.includes(systemSourceId), true);
  assert.ok(findRecord(deletedState, systemSourceId));
  assert.equal(findRecord(deletedState, PACKAGE_LIFECYCLE_TEST_SOURCE_ID), null);
  assert.ok(await environment.repositories.definitionRepository.getDefinition(systemSourceId));
  assert.ok(await environment.repositories.packageRepository.get(
    findRecord(deletedState, systemSourceId).packageRef
  ));
  assert.equal(
    await environment.repositories.definitionRepository.getDefinition(PACKAGE_LIFECYCLE_TEST_SOURCE_ID),
    null
  );
  assert.equal(
    await environment.repositories.packageRepository.get(importCommand.sourcePackage.packageRef),
    null
  );
  assert.equal(
    (await environment.repositories.storageRepository.getUsage(PACKAGE_LIFECYCLE_TEST_SOURCE_ID)).totalStorageBytes,
    0
  );
});

// 测试目的: 混合删除在自定义 Storage 删除失败时恢复系统软隐藏、包、定义、偏好和 Manager 投影。
test('SourceManager 混合删除任一 Repository 失败后整批回滚', async () => {
  // 类型: object。
  // 作用: 创建混合删除回滚使用的隔离 Repository 和 Manager 环境。
  const environment = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 保存删除前投影，失败后默认源和记录集合必须保持该基线。
  const initialState = await environment.sourceManager.initialize();

  // 类型: object。
  // 作用: 创建测试自定义源导入命令，使删除路径具备完整保存对象。
  const importCommand = createImportCommand(environment.seeds);
  await environment.sourceManager.importSource(importCommand);

  // 类型: Array<string>。
  // 作用: 当前默认系统源和测试自定义源组成回滚目标集合。
  const sourceIds = [initialState.defaultSourceId, PACKAGE_LIFECYCLE_TEST_SOURCE_ID];

  // 类型: object。
  // 作用: 选择整批之外的合法接替记录，确保失败发生在 Repository 删除阶段。
  const replacementRecord = findAlternativeEnabledRecord(initialState, sourceIds);

  // 副作用: 覆盖当前测试 removeSource，在 Package 和 Definition 删除后制造失败。
  // 影响范围: 当前隔离 Repository 实例；Unit of Work 使用快照恢复全部内部状态。
  environment.repositories.storageRepository.removeSource = async () => {
    throw new Error('remove source storage failed');
  };

  await assert.rejects(environment.sourceManager.deleteSources({
    sourceIds,
    handoff: { mode: 'replace', sourceId: replacementRecord.definition.id }
  }), SourceManagerOperationError);

  assert.ok(await environment.repositories.packageRepository.get(importCommand.sourcePackage.packageRef));
  assert.ok(await environment.repositories.definitionRepository.getDefinition(PACKAGE_LIFECYCLE_TEST_SOURCE_ID));
  assert.equal(
    Object.hasOwn(
      (await environment.repositories.definitionRepository.loadPreferences()).sourceStates,
      PACKAGE_LIFECYCLE_TEST_SOURCE_ID
    ),
    true
  );
  assert.ok(findRecord(await environment.sourceManager.getState(), PACKAGE_LIFECYCLE_TEST_SOURCE_ID));
  assert.equal((await environment.sourceManager.getState()).defaultSourceId, initialState.defaultSourceId);
});

// 测试目的: 最小导出严格限制字段、保持请求顺序和引用隔离，不包含偏好、授权或私有空间。
test('SourceManager 创建严格最小且无浏览器副作用的数据源导出包', async () => {
  // 类型: object。
  // 作用: 创建最小导出使用的隔离 Repository 和 Manager 环境。
  const environment = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 保存初始投影，提供一个系统源导出目标。
  const initialState = await environment.sourceManager.initialize();

  // 类型: object。
  // 作用: 创建第二个带独立脚本文本的自定义源导入命令。
  const importCommand = createImportCommand(environment.seeds);
  await environment.sourceManager.importSource(importCommand);

  // 类型: Array<string>。
  // 作用: 使用系统默认源和新自定义源验证混合导出及输入顺序保持。
  const sourceIds = [PACKAGE_LIFECYCLE_TEST_SOURCE_ID, initialState.defaultSourceId];

  // 类型: object。
  // 作用: 保存首次最小导出结果并检查根字段和条目字段精确集合。
  const bundle = await environment.sourceManager.createSourceExportBundle({
    sourceIds,
    exportedAt: PACKAGE_LIFECYCLE_TEST_EXPORTED_AT
  });

  assert.deepEqual(Object.keys(bundle), ['schemaVersion', 'exportedAt', 'sources']);
  assert.equal(bundle.schemaVersion, '1.0.0');
  assert.equal(bundle.exportedAt, PACKAGE_LIFECYCLE_TEST_EXPORTED_AT);
  assert.deepEqual(bundle.sources.map(source => source.id), sourceIds);
  bundle.sources.forEach((source) => {
    assert.deepEqual(Object.keys(source), ['id', 'name', 'version', 'scriptContent']);
  });
  assert.equal(Object.hasOwn(bundle.sources[0], 'authorization'), false);
  assert.equal(Object.hasOwn(bundle.sources[0], 'cache'), false);
  assert.equal(Object.hasOwn(bundle.sources[0], 'enabled'), false);

  // 副作用范围: 只修改首次导出返回对象，第二次查询和 Repository 脚本文本必须保持不变。
  bundle.sources[0].scriptContent = 'changed export result';

  // 类型: object。
  // 作用: 再次导出同一目标，证明返回对象和 Repository 输入引用隔离。
  const secondBundle = await environment.sourceManager.createSourceExportBundle({
    sourceIds,
    exportedAt: PACKAGE_LIFECYCLE_TEST_EXPORTED_AT
  });
  assert.equal(secondBundle.sources[0].scriptContent, importCommand.sourcePackage.scriptContent);

  await assert.rejects(environment.sourceManager.createSourceExportBundle({
    sourceIds: [sourceIds[0], 'missing-export-source'],
    exportedAt: PACKAGE_LIFECYCLE_TEST_EXPORTED_AT
  }), SourceManagerNotFoundError);
});
