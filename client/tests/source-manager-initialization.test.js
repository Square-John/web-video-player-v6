/*
  source-manager-initialization.test.js 模块说明

  - 文件职责:
      验证 SourceManager 从 Repository 图组装轻量状态、单记录失败关闭、默认源与活动源校验、usage、引用隔离和状态观察。
      区分包图结构损坏与授权失效，证明授权待确认不会被误报成数据源健康不可用。

  - 导入库及文件汇总(6 条，内置 2 条，第三方 0 条，自定义 4 条):
      assert、test: 内置测试能力，执行严格断言并注册 Node 测试。
      HEALTH_STATUS、IMPORT_METHOD、PROVIDER_READINESS_STATUS、PROVIDER_RUNTIME_STATUS: 自定义配置，断言运行态和在线导入使用稳定领域枚举。
      SOURCE_RECORD_FAILURE_REASON: 自定义状态枚举，断言单记录失败原因。
      SourceManagerInitializationError、SourceManagerValidationError: 自定义错误，断言初始化和构造输入失败边界。
      createSourceManagerTestEnvironment: 自定义夹具，创建隔离 Repository 和 SourceManager。

  - 模块级常量:
      STRUCTURAL_FAILURE_SCENARIOS: Array<object>，包图结构损坏场景表。

  - 模块级变量:
      无

  - 模块级辅助函数:
      findRecord(state, sourceId): Function，按 sourceId 查找轻量投影记录。
      findDefaultSourcePackage(seeds): Function，定位当前种子默认源脚本包。
      removeDefaultSourcePackage(seeds): Function，制造缺包场景。
      mismatchDefaultPackageSource(seeds): Function，制造包归属错误场景。
      mismatchDefaultPackageProvider(seeds): Function，制造 Provider 绑定错误场景。
      mismatchDefaultPackageHash(seeds): Function，制造脚本指纹错误场景。
      replaceDefaultPackageAlgorithm(seeds): Function，制造未知完整性算法场景。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert Node 严格断言对象。
// 文件作用: 比较状态字段、错误类型、引用隔离和 Repository usage。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 声明构建前执行的 SourceManager 4B 初始化测试。
import test from 'node:test';

import {
  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 健康状态枚举。
  // 文件作用: 断言结构损坏为 unavailable、授权失效保持 normal。
  HEALTH_STATUS,

  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 导入方式枚举。
  // 文件作用: 状态观察测试使用正式 remote 值定位在线更新目标，不散落魔法字符串。
  IMPORT_METHOD,

  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: PROVIDER_READINESS_STATUS Provider 就绪状态枚举。
  // 文件作用: 断言每条组装记录都包含当前会话就绪投影。
  PROVIDER_READINESS_STATUS,

  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: PROVIDER_RUNTIME_STATUS Provider 生命周期枚举。
  // 文件作用: 断言结构损坏为 failed、授权失效保持 stopped。
  PROVIDER_RUNTIME_STATUS
} from '../src/config/source-manager.config.js';

// 导入来源: ../src/services/source-manager/sourceManagerState.js。
// 导入内容: SOURCE_RECORD_FAILURE_REASON 单记录失败原因枚举。
// 文件作用: 结构损坏测试不依赖中文错误说明。
import { SOURCE_RECORD_FAILURE_REASON } from '../src/services/source-manager/sourceManagerState.js';

import {
  // 导入来源: ../src/services/source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerInitializationError 初始化领域错误。
  // 文件作用: 断言未知 runtime sourceId 和未初始化读取使用稳定初始化失败边界。
  SourceManagerInitializationError,

  // 导入来源: ../src/services/source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerValidationError 构造输入校验错误。
  // 文件作用: 断言越权运行态、非法活动源和未知构造选项被立即拒绝。
  SourceManagerValidationError
} from '../src/services/source-manager/sourceManagerErrors.js';

// 导入来源: ./source-manager-test-fixtures.js。
// 导入内容: createSourceManagerTestEnvironment 隔离测试环境工厂。
// 文件作用: 每个测试获得独立种子、Repository 和 SourceManager，避免场景互相污染。
import { createSourceManagerTestEnvironment } from './source-manager-test-fixtures.js';

/**
 * 按 sourceId 查找轻量投影记录。
 * 纯函数: 只读取 SourceManagerState.records，不修改状态。
 *
 * @param {object} state SourceManagerState 轻量投影。
 * @param {string} sourceId 数据源唯一标识。
 * @returns {object|null} 匹配 SourceRecord；未命中时返回 null。
 */
function findRecord(state, sourceId) {
  // 返回值类型: object|null。
  // 作用: 返回唯一匹配记录；未找到时明确使用 null，便于断言失败位置。
  return state.records.find(record => record.definition.id === sourceId) || null;
}

/**
 * 定位当前种子默认源的 SourcePackage。
 * 纯函数: 只读取种子，不修改 Package 集合。
 *
 * @param {object} seeds 当前测试隔离 Repository 种子。
 * @returns {object} 默认源 SourcePackage。
 * @throws {AssertionError} 当种子默认源没有对应 Package 时抛出测试断言错误。
 */
function findDefaultSourcePackage(seeds) {
  // 类型: object|null。
  // 作用: 根据 Preferences.defaultSourceId 定位当前默认源脚本包。
  const sourcePackage = seeds.packages.find(item => item.sourceId === seeds.preferences.defaultSourceId) || null;

  // 执行内容: 基础种子必须具备默认源脚本包，避免场景函数在错误前提下继续修改。
  assert.ok(sourcePackage);

  // 返回值类型: object。
  // 作用: 返回当前测试隔离包，场景函数可以安全修改且不会污染默认种子。
  return sourcePackage;
}

/**
 * 删除默认源脚本包以制造缺包场景。
 * 副作用: 只修改当前测试隔离 seeds.packages。
 *
 * @param {object} seeds 当前测试隔离 Repository 种子。
 * @returns {void} 场景通过修改种子生效，不返回业务对象。
 */
function removeDefaultSourcePackage(seeds) {
  // 副作用: 删除当前测试默认源脚本包。
  // 影响范围: 当前测试隔离 seeds.packages，不修改模块级默认种子。
  seeds.packages = seeds.packages.filter(item => item.sourceId !== seeds.preferences.defaultSourceId);
}

/**
 * 修改默认源包归属以制造 sourceId 失配场景。
 * 副作用: 只修改当前测试隔离默认源 Package.sourceId。
 *
 * @param {object} seeds 当前测试隔离 Repository 种子。
 * @returns {void} 场景通过修改种子生效，不返回业务对象。
 */
function mismatchDefaultPackageSource(seeds) {
  // 副作用: 把默认源 Package.sourceId 改成不存在的其他源。
  // 影响范围: 当前测试隔离包，不修改 Definition 或 Preferences。
  findDefaultSourcePackage(seeds).sourceId = 'mismatched-source';
}

/**
 * 修改默认源 Provider 绑定以制造跨对象失配场景。
 * 副作用: 只修改当前测试隔离默认源 Package.providerKey。
 *
 * @param {object} seeds 当前测试隔离 Repository 种子。
 * @returns {void} 场景通过修改种子生效，不返回业务对象。
 */
function mismatchDefaultPackageProvider(seeds) {
  // 副作用: 把默认源 Package.providerKey 改成与 Definition 不同的值。
  // 影响范围: 当前测试隔离包，不修改显式 Definition 绑定。
  findDefaultSourcePackage(seeds).providerKey = 'mismatched-provider';
}

/**
 * 修改默认源声明指纹以制造完整性失配场景。
 * 副作用: 只修改当前测试隔离默认源 Package.integrity.scriptHash。
 *
 * @param {object} seeds 当前测试隔离 Repository 种子。
 * @returns {void} 场景通过修改种子生效，不返回业务对象。
 */
function mismatchDefaultPackageHash(seeds) {
  // 副作用: 把默认源声明指纹改成与真实脚本文本不一致的固定值。
  // 影响范围: 当前测试隔离 Package.integrity，不修改 scriptContent。
  findDefaultSourcePackage(seeds).integrity.scriptHash = '00000000';
}

/**
 * 修改默认源完整性算法以制造未知算法场景。
 * 副作用: 只修改当前测试隔离默认源 Package.integrity.algorithm。
 *
 * @param {object} seeds 当前测试隔离 Repository 种子。
 * @returns {void} 场景通过修改种子生效，不返回业务对象。
 */
function replaceDefaultPackageAlgorithm(seeds) {
  // 副作用: 把默认源完整性算法替换为当前 SourceManager 不支持的值。
  // 影响范围: 当前测试隔离 Package.integrity，不修改声明指纹。
  findDefaultSourcePackage(seeds).integrity.algorithm = 'sha256';
}

// 类型: Array<object>。
// 作用: 集中列出应当触发 Provider failed、健康 unavailable 和默认源清空的包图结构场景。
const STRUCTURAL_FAILURE_SCENARIOS = Object.freeze([
  {
    // 类型: string。
    // 作用: 测试标题使用的稳定场景名称。
    name: 'missingPackage',
    // 类型: string。
    // 作用: 当前场景期望投影的稳定失败原因。
    reason: SOURCE_RECORD_FAILURE_REASON.missingPackage,
    // 类型: Function。
    // 作用: 在 Repository 构造前删除默认源脚本包。
    mutateSeeds: removeDefaultSourcePackage
  },
  {
    // 类型: string。
    // 作用: 测试标题使用的稳定场景名称。
    name: 'packageSourceMismatch',
    // 类型: string。
    // 作用: 当前场景期望投影的稳定失败原因。
    reason: SOURCE_RECORD_FAILURE_REASON.packageSourceMismatch,
    // 类型: Function。
    // 作用: 在 Repository 构造前修改默认源包归属。
    mutateSeeds: mismatchDefaultPackageSource
  },
  {
    // 类型: string。
    // 作用: 测试标题使用的稳定场景名称。
    name: 'providerMismatch',
    // 类型: string。
    // 作用: 当前场景期望投影的稳定失败原因。
    reason: SOURCE_RECORD_FAILURE_REASON.providerMismatch,
    // 类型: Function。
    // 作用: 在 Repository 构造前修改默认源 Provider 绑定。
    mutateSeeds: mismatchDefaultPackageProvider
  },
  {
    // 类型: string。
    // 作用: 测试标题使用的稳定场景名称。
    name: 'integrityHashMismatch',
    // 类型: string。
    // 作用: 当前场景期望投影的稳定失败原因。
    reason: SOURCE_RECORD_FAILURE_REASON.integrityMismatch,
    // 类型: Function。
    // 作用: 在 Repository 构造前修改默认源声明指纹。
    mutateSeeds: mismatchDefaultPackageHash
  },
  {
    // 类型: string。
    // 作用: 测试标题使用的稳定场景名称。
    name: 'integrityAlgorithmMismatch',
    // 类型: string。
    // 作用: 未知算法和错误指纹统一属于完整性失配。
    reason: SOURCE_RECORD_FAILURE_REASON.integrityMismatch,
    // 类型: Function。
    // 作用: 在 Repository 构造前替换默认源完整性算法。
    mutateSeeds: replaceDefaultPackageAlgorithm
  }
]);

// 测试目的: 正常九条 Repository 图必须组装为无脚本、usage 正确且输入输出引用隔离的轻量投影。
test('SourceManager 初始化九条轻量记录并保持引用隔离', async () => {
  // 类型: object。
  // 作用: 创建当前测试隔离种子、Repository 和 SourceManager。
  const { seeds, repositories, sourceManager } = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 保存首次初始化返回的轻量状态，供字段、usage 和输出隔离断言。
  const state = await sourceManager.initialize();

  assert.equal(state.records.length, 9);
  assert.equal(state.defaultSourceId, seeds.preferences.defaultSourceId);

  // 循环类型: Array.prototype.forEach。
  // 初始值: 第一条 SourceRecord。
  // 终止条件: 九条记录全部检查完成。
  // 循环作用: 证明 Definition 不携带脚本和设置真实值，并保持 package/storage 引用字段一致。
  state.records.forEach((record) => {
    assert.equal('scriptContent' in record.definition, false);
    assert.equal('settingsValues' in record.definition, false);
    assert.equal(record.packageRef, record.definition.packageRef);
    assert.equal(record.storageNamespace, record.definition.id);
    assert.deepEqual(record.runtime.providerReadiness, {
      status: PROVIDER_READINESS_STATUS.ready,
      reasonCode: '',
      reason: ''
    });
  });

  // 类型: object。
  // 作用: 选择第一条记录验证 Storage usage 和输出引用隔离。
  const firstRecord = state.records[0];

  // 类型: object。
  // 作用: 从真实 Storage Repository 读取同一 sourceId 的容量摘要作为投影对照。
  const usage = await repositories.storageRepository.getUsage(firstRecord.definition.id);

  assert.equal(firstRecord.cache.temporaryCacheBytes, usage.temporaryCacheBytes);
  assert.equal(firstRecord.cache.totalCacheBytes, usage.totalCacheBytes);

  // 副作用: 修改调用方持有的返回投影名称。
  // 影响范围: 仅当前 state 副本；下方断言证明不会穿透 SourceManager 内部状态。
  firstRecord.definition.name = 'external mutation';

  assert.notEqual((await sourceManager.getState()).records[0].definition.name, 'external mutation');
});

// 循环类型: for...of。
// 初始值: 第一项包图结构失败场景。
// 终止条件: 缺包、归属、Provider、指纹和算法场景全部注册测试。
// 循环作用: 使用同一组不变量验证所有结构损坏都只关闭目标记录并清空失效默认源。
for (const scenario of STRUCTURAL_FAILURE_SCENARIOS) {
  // 测试目的: 当前结构损坏必须收敛为 failed/unavailable，且不能暴露未验证脚本指纹。
  test(`SourceManager 对 ${scenario.name} 执行结构失败关闭`, async () => {
    // 类型: object。
    // 作用: 使用当前具名场景创建隔离种子和被测 SourceManager。
    const { seeds, sourceManager } = createSourceManagerTestEnvironment(scenario.mutateSeeds);

    // 类型: object。
    // 作用: 保存结构损坏后的安全投影，其他八条记录仍应保留。
    const state = await sourceManager.initialize();

    // 类型: object|null。
    // 作用: 定位当前失效默认源记录，验证单记录失败关闭字段。
    const record = findRecord(state, seeds.preferences.defaultSourceId);

    assert.ok(record);
    assert.equal(record.runtime.enabled, false);
    assert.equal(record.runtime.providerStatus, PROVIDER_RUNTIME_STATUS.failed);
    assert.equal(record.runtime.healthStatus, HEALTH_STATUS.unavailable);
    assert.equal(record.runtime.lastUnavailableReason, scenario.reason);
    assert.equal(record.runtime.currentScriptHash, '');
    assert.equal(state.defaultSourceId, '');
    assert.equal(state.records.length, 9);
  });
}

// 测试目的: 缺偏好属于结构损坏，必须失败关闭但仍保留 Definition 供用户识别和后续修复。
test('SourceManager 对缺失每源偏好执行结构失败关闭', async () => {
  // 类型: object。
  // 作用: 删除一个自定义源偏好后创建隔离测试环境。
  const environment = createSourceManagerTestEnvironment((seeds) => {
    // 副作用: 删除当前测试自定义源 sourceStates 节点。
    // 影响范围: 当前测试隔离 Preferences，不修改其他记录。
    delete seeds.preferences.sourceStates['custom-online-demo'];
  });

  // 类型: object|null。
  // 作用: 定位缺偏好记录，验证其仍存在于页面投影并携带稳定结构失败原因。
  const record = findRecord(await environment.sourceManager.initialize(), 'custom-online-demo');

  assert.ok(record);
  assert.equal(record.runtime.enabled, false);
  assert.equal(record.runtime.providerStatus, PROVIDER_RUNTIME_STATUS.failed);
  assert.equal(record.runtime.healthStatus, HEALTH_STATUS.unavailable);
  assert.equal(record.runtime.lastUnavailableReason, SOURCE_RECORD_FAILURE_REASON.missingPreference);
  assert.equal(record.runtime.currentScriptHash, '');
});

// 测试目的: 授权版本失效只关闭运行权限并转为 pending，不能清空已验证指纹或伪造健康不可用。
test('SourceManager 对失效授权关闭运行权限但保留健康状态和已验证指纹', async () => {
  // 类型: object。
  // 作用: 修改授权版本后创建隔离种子、Repository 和 SourceManager。
  const { seeds, sourceManager } = createSourceManagerTestEnvironment((mutableSeeds) => {
    // 副作用: 只把当前测试自定义源授权版本改成旧版本。
    // 影响范围: 当前测试隔离 Preferences.authorization。
    mutableSeeds.preferences.sourceStates['custom-online-latest'].authorization.authorizedVersion = 'v0.0.0';
  });

  // 类型: object|null。
  // 作用: 定位授权失效记录，验证授权门禁与健康状态职责分离。
  const record = findRecord(await sourceManager.initialize(), 'custom-online-latest');

  // 类型: object。
  // 作用: 定位同一 sourceId 的已验证 Package 声明指纹，作为投影 currentScriptHash 对照。
  const sourcePackage = seeds.packages.find(item => item.sourceId === 'custom-online-latest');

  assert.ok(record);
  assert.ok(sourcePackage);
  assert.equal(record.runtime.enabled, false);
  assert.equal(record.runtime.providerStatus, PROVIDER_RUNTIME_STATUS.stopped);
  assert.equal(record.runtime.healthStatus, HEALTH_STATUS.normal);
  assert.equal(record.runtime.lastUnavailableReason, '');
  assert.equal(record.runtime.currentScriptHash, sourcePackage.integrity.scriptHash);
  assert.equal(record.authorization.status, 'pending');
  assert.equal(record.authorization.authorizedVersion, 'v0.0.0');
});

// 测试目的: 软隐藏只影响默认源和活动源可选性，不删除系统源记录、Package 或 Repository 数据。
test('SourceManager 保留软隐藏系统源并清空失效默认源和活动源', async () => {
  // 类型: object。
  // 作用: 创建只用于读取默认源 id 的基线环境，避免测试硬编码旧数据源身份。
  const baselineEnvironment = createSourceManagerTestEnvironment();

  // 类型: string。
  // 作用: 从当前 Repository 种子派生需要软隐藏的默认系统源 id，并在构造 Manager 前确定活动源选项。
  const hiddenSourceId = baselineEnvironment.seeds.preferences.defaultSourceId;

  // 类型: object。
  // 作用: 把默认系统源加入重复软隐藏列表，并把同一 id 作为初始活动源。
  const { repositories, sourceManager } = createSourceManagerTestEnvironment((seeds) => {
    // 副作用: 写入重复、有效和不存在 id，验证投影去重及过滤规则。
    // 影响范围: 当前测试隔离 Preferences.removedSystemSourceIds。
    seeds.preferences.removedSystemSourceIds = [hiddenSourceId, hiddenSourceId, 'missing-system'];
  }, {
    activeSourceId: hiddenSourceId
  });

  // 类型: object。
  // 作用: 保存软隐藏收敛后的投影，默认源和活动源都必须为空且不自动选择候选。
  const state = await sourceManager.initialize();

  assert.deepEqual(state.removedSystemSourceIds, [hiddenSourceId]);
  assert.ok(findRecord(state, hiddenSourceId));
  assert.equal(state.defaultSourceId, '');
  assert.equal(state.activeSourceId, '');

  // 类型: Array<object>。
  // 作用: 读取全部 Package，验证软隐藏没有执行任何脚本包删除。
  const packages = await repositories.packageRepository.loadAll();

  // 类型: object|null。
  // 作用: 从现有 Package 集合定位被软隐藏系统源脚本包。
  const sourcePackage = packages.find(item => item.sourceId === hiddenSourceId) || null;

  assert.ok(sourcePackage);
});

// 测试目的: 初始运行态只能包含会话字段，不能覆盖 enabled、脚本指纹或更新状态组合权威。
test('SourceManager 拒绝越权或矛盾初始运行态字段', () => {
  // 类型: string。
  // 作用: 从当前 Preferences 派生有效 sourceId，避免测试固化迁移期旧内部身份。
  const sourceId = createSourceManagerTestEnvironment().seeds.preferences.defaultSourceId;

  assert.throws(() => createSourceManagerTestEnvironment(null, {
    initialRuntimeStates: { [sourceId]: { enabled: true } }
  }), SourceManagerValidationError);

  assert.throws(() => createSourceManagerTestEnvironment(null, {
    initialRuntimeStates: { [sourceId]: { updateAvailable: true } }
  }), SourceManagerValidationError);
});

// 测试目的: 会话运行态不能为不存在的 Definition 创建影子记录，初始化必须整体失败并保留 validation cause。
test('SourceManager 拒绝未知初始运行态 sourceId', async () => {
  // 类型: object。
  // 作用: 创建包含未知 sourceId 会话状态的 Manager；构造阶段尚未载入 Definition，初始化阶段执行关联拒绝。
  const { sourceManager } = createSourceManagerTestEnvironment(null, {
    initialRuntimeStates: {
      'missing-source': {}
    }
  });

  await assert.rejects(
    sourceManager.initialize(),
    error => error instanceof SourceManagerInitializationError
      && error.cause instanceof SourceManagerValidationError
  );
});

// 测试目的: 构造选项必须使用精确字段和安全活动源 id，不能静默忽略非法输入。
test('SourceManager 拒绝非法构造选项和活动源 id', () => {
  assert.throws(() => createSourceManagerTestEnvironment(null, {
    activeSourceId: 1
  }), SourceManagerValidationError);

  assert.throws(() => createSourceManagerTestEnvironment(null, {
    activeSourceId: '__proto__'
  }), SourceManagerValidationError);

  assert.throws(() => createSourceManagerTestEnvironment(null, {
    pageSelection: 'source-a'
  }), SourceManagerValidationError);
});

// 测试目的: 从未成功初始化的 Manager 不得伪造空状态，调用方必须先建立 Repository 投影。
test('SourceManager 在初始化前拒绝读取状态', async () => {
  // 类型: SourceManager。
  // 作用: 创建尚未执行 initialize 的被测实例。
  const { sourceManager } = createSourceManagerTestEnvironment();

  await assert.rejects(sourceManager.getState(), SourceManagerInitializationError);
});

// 测试目的: 初始化前订阅必须接收首份稳定投影，监听器异常和外部修改不能穿透 Manager 或阻止其他监听器。
test('SourceManager 状态订阅隔离监听失败和投影引用', async () => {
  // 类型: SourceManager。
  // 作用: 创建尚未初始化的 Manager，验证订阅者从第一份初始化投影开始接收。
  const { sourceManager } = createSourceManagerTestEnvironment();

  // 断言作用: 非函数监听器在注册阶段同步失败，不污染监听集合。
  assert.throws(() => sourceManager.subscribe(null), SourceManagerValidationError);

  // 类型: Array<object>。
  // 作用: 保存正常监听器收到的完整投影，后续验证异常监听器没有阻止发布。
  const receivedStates = [];

  // 类型: Array<object>。
  // 作用: 保存后注册监听器收到的投影，验证前一个监听器修改嵌套字段不会跨监听器传播。
  const unaffectedStates = [];

  // 副作用: 注册会同步抛错的监听器，验证发布边界隔离外部观察者失败。
  sourceManager.subscribe(() => {
    throw new Error('listener failed');
  });

  // 副作用: 注册正常监听器并主动修改收到的隔离副本，验证不会污染 Manager 内部投影。
  sourceManager.subscribe((state) => {
    receivedStates.push(state);
    state.defaultSourceId = 'listener-mutated-source';
    state.records[0].definition.name = 'listener-mutated-name';
  });

  // 副作用: 注册第二个正常监听器，读取同一发布轮次的独立副本。
  sourceManager.subscribe(state => unaffectedStates.push(state));

  // 类型: object。
  // 作用: 初始化触发首份稳定投影发布，公开结果不能受监听器异常或修改影响。
  const initializedState = await sourceManager.initialize();

  assert.equal(receivedStates.length, 1);
  assert.equal(unaffectedStates.length, 1);
  assert.notEqual(initializedState.defaultSourceId, 'listener-mutated-source');
  assert.notEqual(unaffectedStates[0].records[0].definition.name, 'listener-mutated-name');
  assert.notEqual((await sourceManager.getState()).defaultSourceId, 'listener-mutated-source');
});

// 测试目的: 已有投影的新订阅必须立即收到当前副本，取消函数重复调用后不能再收到后续采用。
test('SourceManager 已初始化订阅立即发送且取消函数幂等', async () => {
  // 类型: SourceManager。
  // 作用: 创建并初始化 Manager，使后续 subscribe 命中立即发送路径。
  const { sourceManager } = createSourceManagerTestEnvironment();
  await sourceManager.initialize();

  // 类型: number。
  // 初始值: 0，表示当前监听器尚未收到任何投影。
  // 作用: 统计立即发送和取消后的后续发布次数。
  let notificationCount = 0;

  // 类型: Function。
  // 作用: 注册监听器后应同步收到当前投影，并获得幂等取消函数。
  const unsubscribe = sourceManager.subscribe(() => {
    notificationCount += 1;
  });

  assert.equal(notificationCount, 1);

  // 副作用: 重复取消同一订阅，第二次调用必须保持无操作。
  unsubscribe();
  unsubscribe();

  // 执行内容: 再次初始化会采用并发布新稳定投影，但已取消监听器不能收到。
  await sourceManager.initialize();
  assert.equal(notificationCount, 1);
});

// 测试目的: 同一函数的多次 subscribe 必须形成独立订阅身份，取消其中一份不能误删另一份。
test('SourceManager 对相同监听函数保留独立订阅和取消身份', async () => {
  // 类型: SourceManager。
  // 作用: 创建尚未初始化的 Manager，使两份订阅从同一首轮稳定投影开始计数。
  const { sourceManager } = createSourceManagerTestEnvironment();

  // 类型: number。
  // 初始值: 0，表示复用监听函数尚未接收投影。
  // 作用: 统计两份独立订阅在逐次取消后的真实通知次数。
  let notificationCount = 0;

  /**
   * 记录复用监听函数收到的投影次数。
   * 副作用: 递增当前测试局部 notificationCount；不读取或修改投影内容。
   *
   * @returns {void} 监听函数只记录调用次数。
   */
  function sharedListener() {
    // 副作用: 当前独立订阅每收到一份投影就增加一次测试计数。
    notificationCount += 1;
  }

  // 类型: Function。
  // 作用: 保存第一份订阅的取消句柄，只能移除第一次 subscribe 创建的记录。
  const unsubscribeFirst = sourceManager.subscribe(sharedListener);

  // 类型: Function。
  // 作用: 保存第二份订阅的取消句柄，证明相同函数引用不会被 Set 合并。
  const unsubscribeSecond = sourceManager.subscribe(sharedListener);

  // 执行内容: 首次初始化发布一轮稳定投影，两份独立订阅应各收到一次。
  await sourceManager.initialize();
  assert.equal(notificationCount, 2);

  // 副作用: 只取消第一份订阅；第二份必须继续接收下一轮稳定投影。
  unsubscribeFirst();
  await sourceManager.initialize();
  assert.equal(notificationCount, 3);

  // 副作用: 取消第二份订阅；后续发布不再调用复用监听函数。
  unsubscribeSecond();
  await sourceManager.initialize();
  assert.equal(notificationCount, 3);
});

// 测试目的: 监听器在发布回调中取消其他订阅时，当前轮使用固定快照，取消只影响下一轮。
test('SourceManager 发布中取消订阅不改变当前轮通知集合', async () => {
  // 类型: SourceManager。
  // 作用: 创建尚未初始化的 Manager，精确控制首轮和第二轮稳定投影发布。
  const { sourceManager } = createSourceManagerTestEnvironment();

  // 类型: Array<string>。
  // 作用: 按真实调用顺序记录 A、B 监听器，用于区分当前轮和下一轮取消效果。
  const listenerCalls = [];

  /**
   * 提供 B 订阅取消句柄赋值前的安全无操作入口。
   * 纯函数: 不读取或修改测试状态，只保证 A 回调始终调用函数类型。
   *
   * @returns {void} 占位调用直接结束。
   */
  function ignoreUninitializedUnsubscribe() {}

  // 类型: Function。
  // 初始值: ignoreUninitializedUnsubscribe，避免 B 取消句柄赋值前存在不可调用引用。
  // 作用: 保存 B 订阅的幂等取消句柄，供 A 在发布回调中调用。
  let unsubscribeSecond = ignoreUninitializedUnsubscribe;

  // 副作用: 注册 A 监听器；每轮先记录自身，再取消 B 的未来发布资格。
  sourceManager.subscribe(() => {
    listenerCalls.push('A');
    unsubscribeSecond();
  });

  // 副作用: 注册 B 监听器并保存取消句柄；首轮发布快照建立后仍应收到当前投影。
  unsubscribeSecond = sourceManager.subscribe(() => {
    listenerCalls.push('B');
  });

  // 执行内容: 首轮发布开始时 A、B 均存在；A 的取消不能让 B 丢失本轮通知。
  await sourceManager.initialize();
  assert.deepEqual(listenerCalls, ['A', 'B']);

  // 执行内容: 第二轮发布只保留 A，证明取消从下一轮开始生效。
  await sourceManager.initialize();
  assert.deepEqual(listenerCalls, ['A', 'B', 'A']);
});

// 测试目的: 单源、批量和更新检测的全部过渡态必须通过同一观察端口发布并最终复位。
test('SourceManager 发布全部检测过渡态和最终稳定态', async () => {
  // 类型: SourceManager。
  // 作用: 使用默认健康和更新端口创建可完成三类检测的隔离环境。
  const { sourceManager } = createSourceManagerTestEnvironment();

  // 类型: Array<object>。
  // 作用: 收集初始化和三类检测产生的完整隔离投影。
  const receivedStates = [];
  sourceManager.subscribe(state => receivedStates.push(state));

  // 类型: object。
  // 作用: 初始化后读取默认源，作为单源健康检测目标。
  const initialState = await sourceManager.initialize();
  await sourceManager.checkSource(initialState.defaultSourceId);
  await sourceManager.checkAllSources();

  // 类型: object。
  // 作用: 选择在线导入记录，触发 checkingUpdate 过渡态。
  const remoteRecord = initialState.records.find((record) => {
    return record.definition.importMethod === IMPORT_METHOD.remote;
  });
  assert.ok(remoteRecord);
  await sourceManager.checkSourceUpdate(remoteRecord.definition.id);

  // 断言作用: 至少一份投影显示单源 checking，证明端口调用前已经发布过程状态。
  assert.equal(receivedStates.some((state) => {
    return findRecord(state, initialState.defaultSourceId)?.runtime.healthStatus === HEALTH_STATUS.checking;
  }), true);

  // 断言作用: checkingAll true 和最终 false 都曾发布，批量过程不会停留在加载态。
  assert.equal(receivedStates.some(state => state.checkingAll === true), true);
  assert.equal(receivedStates.at(-1).checkingAll, false);

  // 断言作用: 在线更新过程和最终复位都通过同一订阅端口可观察。
  assert.equal(receivedStates.some((state) => {
    return findRecord(state, remoteRecord.definition.id)?.runtime.checkingUpdate === true;
  }), true);
  assert.equal(
    findRecord(receivedStates.at(-1), remoteRecord.definition.id).runtime.checkingUpdate,
    false
  );
});
