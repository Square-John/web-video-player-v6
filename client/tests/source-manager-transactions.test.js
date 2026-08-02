/*
  source-manager-transactions.test.js 模块说明

  - 文件职责:
      验证 SourceManager 活动源切换、默认源、检测、启停、授权、撤销、恢复和两级缓存事务。
      证明切换只采用最新 requestId、Repository 重组装不丢切换状态，其他事务失败不采用候选投影。

  - 导入库及文件汇总(6 条，内置 2 条，第三方 0 条，自定义 4 条):
      assert、test: 内置测试能力，执行严格断言并注册 Node 测试。
      AUTHORIZATION_STATUS、HEALTH_STATUS、IMPORT_METHOD、PROVIDER_READINESS_REASON_CODE、PROVIDER_READINESS_STATUS、SOURCE_KIND、SOURCE_SWITCH_STATUS: 自定义配置，断言稳定领域状态。
      SOURCE_STORAGE_PARTITION: 自定义 Repository 工具，测试五分区清理边界。
      SourceManagerInvariantError、SourceManagerNotFoundError、SourceManagerOperationError: 自定义错误，断言未命中、领域拒绝和事务失败。
      createSourceManagerTestEnvironment: 自定义夹具，创建隔离 Repository、端口和 SourceManager。

  - 模块级常量:
      SOURCE_MANAGER_TEST_AUTHORIZED_AT: string，授权测试固定确认时间。
      SOURCE_MANAGER_TEST_CHECKED_AT: string，检测测试固定完成时间。
      SOURCE_MANAGER_TEST_UPDATED_AT: string，在线版本固定更新时间。
      SOURCE_MANAGER_SWITCH_REQUEST_IDS: object，活动源切换测试固定请求身份。
      UNREGISTERED_PROVIDER_KEY: string，标识当前测试 Registry 没有工厂的 Provider 身份。

  - 模块级变量:
      无

  - 模块级辅助函数:
      findRecord(state, sourceId): Function，按 sourceId 查找轻量记录。
      findAlternativeEnabledRecord(state, excludedSourceId): Function，选择有效默认源接替记录。
      findDisabledEnableableRecord(state): Function，选择关闭但结构和授权有效的记录。
      findPendingCustomRecord(state): Function，选择等待用户授权的自定义记录。
      findRemoteRecord(state): Function，选择在线导入记录。
      createCheckPort(check): Function，把测试回调包装成唯一 check 端口。
      createDeferred(): Function，创建可控 Promise 以观察检测过程状态。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert Node 严格断言对象。
// 文件作用: 比较事务状态、Repository 保存结果、端口调用和错误类型。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 声明构建前执行的 SourceManager 4C 事务测试。
import test from 'node:test';

import {
  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: AUTHORIZATION_STATUS 授权状态枚举。
  // 文件作用: 断言授权和撤销事务采用 authorized/revoked 稳定值。
  AUTHORIZATION_STATUS,

  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 健康状态枚举。
  // 文件作用: 断言 checking、normal 和 unavailable 过程及完成状态。
  HEALTH_STATUS,

  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: IMPORT_METHOD 数据源导入方式枚举。
  // 文件作用: 动态选择 remote 记录执行在线更新检查。
  IMPORT_METHOD,

  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: PROVIDER_READINESS_REASON_CODE Provider 未就绪原因码枚举。
  // 文件作用: 构造未注册 Provider 的严格测试端口结果。
  PROVIDER_READINESS_REASON_CODE,

  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: PROVIDER_READINESS_STATUS Provider 就绪状态枚举。
  // 文件作用: 断言未就绪投影及 ready 健康检测目标。
  PROVIDER_READINESS_STATUS,

  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: SOURCE_KIND 数据源类型枚举。
  // 文件作用: 动态选择系统源恢复目标和自定义源授权目标。
  SOURCE_KIND,

  // 导入来源: ../src/config/source-manager.config.js。
  // 导入内容: SOURCE_SWITCH_STATUS 活动源切换状态枚举。
  // 文件作用: 断言 idle、switching、success 和 failed 状态收敛。
  SOURCE_SWITCH_STATUS
} from '../src/config/source-manager.config.js';

// 导入来源: ../src/repositories/source/sourceRepositoryUtils.js。
// 导入内容: SOURCE_STORAGE_PARTITION 私有空间五分区枚举。
// 文件作用: 缓存测试显式写入和读取 settings、credentials、session、cache、diagnostics。
import { SOURCE_STORAGE_PARTITION } from '../src/repositories/source/sourceRepositoryUtils.js';

import {
  // 导入来源: ../src/services/source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerInvariantError 领域不变量错误。
  // 文件作用: 断言无效默认源、缺少交接和不支持操作不会提交。
  SourceManagerInvariantError,

  // 导入来源: ../src/services/source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerNotFoundError 记录未找到错误。
  // 文件作用: 断言全部 4C 单源操作对未知 sourceId 使用稳定 notFound 边界。
  SourceManagerNotFoundError,

  // 导入来源: ../src/services/source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerOperationError 领域操作错误。
  // 文件作用: 断言 Repository 基础设施失败完成回滚后保留 operation 边界。
  SourceManagerOperationError
} from '../src/services/source-manager/sourceManagerErrors.js';

// 导入来源: ./source-manager-test-fixtures.js。
// 导入内容: createSourceManagerTestEnvironment 隔离测试环境工厂。
// 文件作用: 每个事务测试获得独立种子、Repository、检测端口和 SourceManager。
import { createSourceManagerTestEnvironment } from './source-manager-test-fixtures.js';

// 类型: string。
// 作用: 授权事务使用固定标准 UTC ISO 时间，避免测试依赖系统时钟。
const SOURCE_MANAGER_TEST_AUTHORIZED_AT = '2026-07-15T01:00:00.000Z';

// 类型: string。
// 作用: 健康和更新检测使用固定完成时间，便于断言端口结果被准确采用。
const SOURCE_MANAGER_TEST_CHECKED_AT = '2026-07-15T02:00:00.000Z';

// 类型: string。
// 作用: 有更新结果使用固定在线版本时间，证明版本元信息完整进入 runtime。
const SOURCE_MANAGER_TEST_UPDATED_AT = '2026-07-15T01:30:00.000Z';

// 类型: string。
// 作用: 在默认 Repository 种子中定位用户已启用但测试 Registry 没有工厂的独立 Provider 身份，不依赖数组位置或显示名称。
const UNREGISTERED_PROVIDER_KEY = 'custom-online-latest.provider';

// 类型: object。
// 作用: 为正常、过期、失败和切回场景提供可区分请求身份，测试不依赖时钟或随机数。
const SOURCE_MANAGER_SWITCH_REQUEST_IDS = Object.freeze({
  first: 'manager-switch-1',
  latest: 'manager-switch-2',
  failed: 'manager-switch-3',
  restore: 'manager-switch-4'
});

/**
 * 按 sourceId 查找轻量记录。
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
 * 选择当前默认源之外的有效启用记录。
 * 纯函数: 只读取投影，不修改记录顺序或默认源。
 *
 * @param {object} state SourceManagerState 轻量投影。
 * @param {string} excludedSourceId 不允许选择的 sourceId。
 * @returns {object} 有效启用且未软隐藏的替代记录。
 * @throws {AssertionError} 当当前种子没有可用替代记录时抛出测试断言错误。
 */
function findAlternativeEnabledRecord(state, excludedSourceId) {
  // 类型: object|null。
  // 作用: 从当前投影动态选择非排除目标、有效启用且未软隐藏的记录。
  const record = state.records.find(item => item.definition.id !== excludedSourceId
    && item.runtime.enabled
    && !state.removedSystemSourceIds.includes(item.definition.id)) || null;

  // 执行内容: 当前测试种子必须至少提供一个默认源接替候选。
  assert.ok(record);

  // 返回值类型: object。
  // 作用: 返回动态候选，测试不固化迁移期旧内部 id。
  return record;
}

/**
 * 选择关闭但具备已验证脚本和有效授权的记录。
 * 纯函数: 只读取投影，不修改 enabled。
 *
 * @param {object} state SourceManagerState 轻量投影。
 * @returns {object} 可以由 setSourceEnabled 启用的记录。
 * @throws {AssertionError} 当当前种子没有适合记录时抛出测试断言错误。
 */
function findDisabledEnableableRecord(state) {
  // 类型: object|null。
  // 作用: 选择用户关闭但结构有效的系统源，避免授权状态干扰基础启停测试。
  const record = state.records.find(item => item.definition.sourceKind === SOURCE_KIND.system
    && !item.runtime.enabled
    && Boolean(item.runtime.currentScriptHash)
    && !state.removedSystemSourceIds.includes(item.definition.id)) || null;

  // 执行内容: 当前测试种子必须提供至少一个关闭且可启用系统源。
  assert.ok(record);

  // 返回值类型: object。
  // 作用: 返回动态启停目标，测试不固化迁移期旧内部 id。
  return record;
}

/**
 * 选择等待用户授权的自定义源。
 * 纯函数: 只读取投影，不修改授权或 enabled。
 *
 * @param {object} state SourceManagerState 轻量投影。
 * @returns {object} pending 且具有已验证脚本指纹的自定义记录。
 * @throws {AssertionError} 当当前种子没有适合记录时抛出测试断言错误。
 */
function findPendingCustomRecord(state) {
  // 类型: object|null。
  // 作用: 动态选择等待授权且结构有效的自定义记录。
  const record = state.records.find(item => item.definition.sourceKind === SOURCE_KIND.custom
    && item.authorization.status === AUTHORIZATION_STATUS.pending
    && Boolean(item.runtime.currentScriptHash)) || null;

  // 执行内容: 当前测试种子必须提供至少一个 pending 自定义源。
  assert.ok(record);

  // 返回值类型: object。
  // 作用: 返回动态授权目标，测试只依赖领域字段而不是显示名称。
  return record;
}

/**
 * 选择在线导入记录。
 * 纯函数: 只读取投影，不修改更新状态。
 *
 * @param {object} state SourceManagerState 轻量投影。
 * @returns {object} importMethod 为 remote 且结构有效的记录。
 * @throws {AssertionError} 当当前种子没有在线记录时抛出测试断言错误。
 */
function findRemoteRecord(state) {
  // 类型: object|null。
  // 作用: 动态选择具备远程更新语义和已验证脚本的记录。
  const record = state.records.find(item => item.definition.importMethod === IMPORT_METHOD.remote
    && Boolean(item.runtime.currentScriptHash)) || null;

  // 执行内容: 当前测试种子必须提供至少一个在线导入记录。
  assert.ok(record);

  // 返回值类型: object。
  // 作用: 返回动态更新检查目标。
  return record;
}

/**
 * 把测试回调包装成唯一 check 方法端口。
 * 纯函数: 返回新普通对象，不调用或修改回调。
 *
 * @param {Function} check 测试控制的同步或异步检测实现。
 * @returns {object} 只包含 check 的端口对象。
 */
function createCheckPort(check) {
  // 返回值类型: object。
  // 作用: 满足 SourceManager 检测端口精确字段契约，不附加测试状态。
  return { check };
}

/**
 * 创建可由测试控制完成时机的 Promise。
 * 副作用: 保存 Promise 构造器提供的 resolve/reject 函数到返回对象。
 *
 * @returns {object} 可控 Promise 及其完成函数。
 * @returns {Promise<*>} return.promise 等待测试显式完成的 Promise。
 * @returns {Function} return.resolve 让 Promise resolve 的函数。
 * @returns {Function} return.reject 让 Promise reject 的函数。
 */
function createDeferred() {
  // 类型: Function|null。
  // 初始值: null，表示 Promise 构造回调尚未同步交付 resolve 函数。
  // 作用: 构造回调执行后保存真实 resolve，供测试在指定检查点完成异步操作。
  let resolvePromise = null;

  // 类型: Function|null。
  // 初始值: null，表示 Promise 构造回调尚未同步交付 reject 函数。
  // 作用: 构造回调执行后保存真实 reject，供测试在指定检查点触发异步失败。
  let rejectPromise = null;

  // 类型: Promise<*>。
  // 作用: 由测试显式 resolve/reject，允许在端口等待期间读取 checking 状态。
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  // 返回值类型: object。
  // 作用: 返回 Promise 和控制函数，测试不依赖定时器或真实网络延迟。
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

// 测试目的: 默认源只能切换到有效启用记录，无效候选失败且不修改 Repository。
test('SourceManager 原子设置有效默认源并拒绝关闭候选', async () => {
  // 类型: object。
  // 作用: 创建隔离 Repository 和 SourceManager。
  const { repositories, sourceManager } = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 保存初始化投影，动态选择有效替代记录和关闭记录。
  const initialState = await sourceManager.initialize();

  // 类型: object。
  // 作用: 选择当前默认源之外的有效启用记录。
  const replacementRecord = findAlternativeEnabledRecord(initialState, initialState.defaultSourceId);

  // 类型: object。
  // 作用: 选择关闭记录，验证它不能直接成为默认源。
  const disabledRecord = findDisabledEnableableRecord(initialState);

  await assert.rejects(
    sourceManager.setDefaultSource(disabledRecord.definition.id),
    SourceManagerInvariantError
  );

  assert.equal((await repositories.definitionRepository.loadPreferences()).defaultSourceId, initialState.defaultSourceId);

  // 类型: object。
  // 作用: 保存成功切换默认源后的投影。
  const nextState = await sourceManager.setDefaultSource(replacementRecord.definition.id);

  assert.equal(nextState.defaultSourceId, replacementRecord.definition.id);
  assert.equal((await repositories.definitionRepository.loadPreferences()).defaultSourceId, replacementRecord.definition.id);
});

// 测试目的: 用户启用意愿不能绕过 Provider 就绪门禁成为默认源、交接候选或健康检测目标。
test('SourceManager 保留未就绪源启用意愿并拒绝运行类操作', async () => {
  // 类型: Array<string>。
  // 作用: 记录健康端口实际收到的 sourceId，证明单源和批量检测都跳过未就绪记录。
  const checkedSourceIds = [];

  // 类型: object。
  // 作用: 创建按 providerKey 返回 ready 或未注册结果的就绪端口，不泄漏 Registry 或工厂对象。
  const providerReadinessPort = {
    /**
     * 根据 Definition 的 providerKey 返回当前会话就绪结果。
     * 纯函数: 只读取传入 Definition，不修改种子、Repository 或调用计数。
     * 成功路径: 未注册 key 返回 unavailable，其他受审模拟 key 返回 ready。
     * 失败路径: 当前测试端口不主动 reject。
     *
     * @param {object} definition SourceManager 从 Repository 组装前提供的隔离 Definition。
     * @returns {Promise<object>} 严格 Provider 就绪结果。
     */
    async evaluate(definition) {
      // 条件分支: 当前 Definition 使用测试约定的未注册 Provider key 时进入。
      // 执行内容: 返回稳定未注册原因，保留用户管理记录但关闭运行资格。
      if (definition.providerKey === UNREGISTERED_PROVIDER_KEY) {
        return {
          status: PROVIDER_READINESS_STATUS.unavailable,
          reasonCode: PROVIDER_READINESS_REASON_CODE.providerNotRegistered,
          reason: '当前数据源脚本尚未接入可执行 Provider。'
        };
      }

      return {
        status: PROVIDER_READINESS_STATUS.ready,
        reasonCode: PROVIDER_READINESS_REASON_CODE.none,
        reason: ''
      };
    }
  };

  // 类型: object。
  // 作用: 注入就绪和健康端口，隔离验证 Manager 运行类入口的统一门禁。
  const { sourceManager } = createSourceManagerTestEnvironment(null, {}, {
    providerReadinessPort,
    healthCheckPort: createCheckPort(async (record) => {
      // 副作用范围: 只记录当前测试真实健康调用身份，不修改领域状态。
      checkedSourceIds.push(record.definition.id);
      return {
        healthStatus: HEALTH_STATUS.normal,
        checkedAt: SOURCE_MANAGER_TEST_CHECKED_AT,
        unavailableReason: ''
      };
    })
  });

  // 类型: object。
  // 作用: 初始化后定位已启用但未就绪的记录，验证启用决定和 Provider 事实保持正交。
  const initialState = await sourceManager.initialize();
  // 类型: object。
  // 作用: 同时按稳定 providerKey 和启用意愿定位目标，避免误取其他本来关闭的未注册自定义源。
  const unavailableRecord = initialState.records.find(
    record => record.definition.providerKey === UNREGISTERED_PROVIDER_KEY
      && record.runtime.enabled === true
  );
  assert.ok(unavailableRecord);
  assert.equal(unavailableRecord.runtime.enabled, true);
  assert.equal(unavailableRecord.runtime.providerReadiness.status, PROVIDER_READINESS_STATUS.unavailable);

  await assert.rejects(
    sourceManager.setDefaultSource(unavailableRecord.definition.id),
    SourceManagerInvariantError
  );
  await assert.rejects(
    sourceManager.checkSource(unavailableRecord.definition.id),
    SourceManagerInvariantError
  );
  assert.equal(checkedSourceIds.includes(unavailableRecord.definition.id), false);

  // 执行内容: 明确把未就绪记录提交为默认源接替目标时必须拒绝，不能把启用意愿误当成运行资格。
  await assert.rejects(sourceManager.setSourceEnabled({
    sourceId: initialState.defaultSourceId,
    enabled: false,
    handoff: {
      mode: 'replace',
      sourceId: unavailableRecord.definition.id
    }
  }), SourceManagerInvariantError);
  assert.equal((await sourceManager.getState()).defaultSourceId, initialState.defaultSourceId);

  await sourceManager.checkAllSources();
  assert.equal(checkedSourceIds.includes(unavailableRecord.definition.id), false);
});

// 测试目的: 活动源切换必须保留原源直到最新 requestId 成功，并让 Repository 重组装、过期完成和失败都遵守同一状态机。
test('SourceManager 原子活动源切换只采用最新请求并保留失败前活动源', async () => {
  // 类型: object。
  // 作用: 读取默认种子真实默认源，作为本测试明确的原活动源身份。
  const baseline = createSourceManagerTestEnvironment();

  // 类型: string。
  // 作用: 从隔离种子读取本测试原活动源，不把具体内部 id 重复写入用例。
  const originalSourceId = baseline.seeds.preferences.defaultSourceId;

  // 类型: object。
  // 作用: 创建带明确活动源的隔离 Manager，避免空活动源掩盖失败回滚行为。
  const { sourceManager } = createSourceManagerTestEnvironment(
    null,
    { activeSourceId: originalSourceId }
  );

  // 类型: object。
  // 作用: 保存初始化状态，并动态选择两个不同的有效启用切换目标。
  const initialState = await sourceManager.initialize();

  // 类型: Array<object>。
  // 作用: 保持 records 顺序收集原活动源之外的有效候选，快速切换需要两个不同目标。
  const switchTargets = initialState.records.filter(record => record.definition.id !== originalSourceId
    && record.runtime.enabled
    && !initialState.removedSystemSourceIds.includes(record.definition.id));
  assert.equal(switchTargets.length >= 2, true);

  // 类型: string。
  // 作用: 第一请求目标稍后将变为过期完成结果。
  const firstTargetId = switchTargets[0].definition.id;

  // 类型: string。
  // 作用: 第二请求目标代表用户最后一次切换意图。
  const latestTargetId = switchTargets[1].definition.id;

  // 类型: object。
  // 作用: 发布第一请求后验证活动源仍保持原值，只有切换状态进入 switching。
  const firstSwitchingState = await sourceManager.beginSourceSwitch({
    sourceId: firstTargetId,
    requestId: SOURCE_MANAGER_SWITCH_REQUEST_IDS.first
  });
  assert.equal(firstSwitchingState.activeSourceId, originalSourceId);
  assert.equal(firstSwitchingState.switchState.status, SOURCE_SWITCH_STATUS.switching);

  // 类型: object。
  // 作用: 在 switching 期间执行 Repository 投影刷新，证明它不会把 requestId 重置为 idle。
  const refreshedState = await sourceManager.setDefaultSource(initialState.defaultSourceId);
  assert.deepEqual(refreshedState.switchState, firstSwitchingState.switchState);

  // 类型: object。
  // 作用: 发布更新请求，当前 pending 和 requestId 必须一次替换为最后用户意图。
  const latestSwitchingState = await sourceManager.beginSourceSwitch({
    sourceId: latestTargetId,
    requestId: SOURCE_MANAGER_SWITCH_REQUEST_IDS.latest
  });
  assert.equal(latestSwitchingState.activeSourceId, originalSourceId);
  assert.equal(latestSwitchingState.switchState.pendingSourceId, latestTargetId);

  // 类型: object。
  // 作用: 尝试提交旧请求，Manager 必须原样返回最新 switching 而不发布 success。
  const staleCompletionState = await sourceManager.completeSourceSwitch({
    sourceId: firstTargetId,
    requestId: SOURCE_MANAGER_SWITCH_REQUEST_IDS.first
  });
  assert.deepEqual(staleCompletionState.switchState, latestSwitchingState.switchState);
  assert.equal(staleCompletionState.activeSourceId, originalSourceId);

  // 类型: object。
  // 作用: 提交最新请求后，activeSourceId 和 success 必须在同一完整投影中采用。
  const successState = await sourceManager.completeSourceSwitch({
    sourceId: latestTargetId,
    requestId: SOURCE_MANAGER_SWITCH_REQUEST_IDS.latest
  });
  assert.equal(successState.activeSourceId, latestTargetId);
  assert.equal(successState.switchState.status, SOURCE_SWITCH_STATUS.success);
  assert.equal(successState.switchState.requestId, SOURCE_MANAGER_SWITCH_REQUEST_IDS.latest);

  await sourceManager.beginSourceSwitch({
    sourceId: firstTargetId,
    requestId: SOURCE_MANAGER_SWITCH_REQUEST_IDS.failed
  });

  // 类型: object。
  // 作用: 模拟 Runtime 启动失败，failed 必须保留最近成功活动源并发布用户可读错误。
  const failedState = await sourceManager.failSourceSwitch({
    sourceId: firstTargetId,
    requestId: SOURCE_MANAGER_SWITCH_REQUEST_IDS.failed,
    errorMessage: '目标数据源启动失败，请稍后重试。'
  });
  assert.equal(failedState.activeSourceId, latestTargetId);
  assert.equal(failedState.switchState.status, SOURCE_SWITCH_STATUS.failed);
  assert.equal(failedState.switchState.errorMessage, '目标数据源启动失败，请稍后重试。');

  await sourceManager.beginSourceSwitch({
    sourceId: originalSourceId,
    requestId: SOURCE_MANAGER_SWITCH_REQUEST_IDS.restore
  });

  // 类型: object。
  // 作用: 切回原源仍使用同一事务，不创建第二活动源字段或修改默认偏好。
  const restoredState = await sourceManager.completeSourceSwitch({
    sourceId: originalSourceId,
    requestId: SOURCE_MANAGER_SWITCH_REQUEST_IDS.restore
  });
  assert.equal(restoredState.activeSourceId, originalSourceId);
  assert.equal(restoredState.defaultSourceId, initialState.defaultSourceId);
  assert.equal(restoredState.switchState.status, SOURCE_SWITCH_STATUS.success);
});

// 测试目的: 全部 4C 单源入口对未知 sourceId 使用统一 notFound 错误且失败后队列继续可用。
test('SourceManager 4C 单源操作统一拒绝不存在的数据源', async () => {
  // 类型: string。
  // 作用: 使用不属于九条种子的安全 id，触发各公开入口的记录未命中边界。
  const missingSourceId = 'missing-source-for-4c';

  // 类型: object。
  // 作用: 创建隔离 Manager，连续失败还可以证明操作 FIFO 不会因 rejected 状态中毒。
  const { sourceManager } = createSourceManagerTestEnvironment();

  await sourceManager.initialize();
  await assert.rejects(sourceManager.setDefaultSource(missingSourceId), SourceManagerNotFoundError);
  await assert.rejects(sourceManager.checkSource(missingSourceId), SourceManagerNotFoundError);
  await assert.rejects(sourceManager.checkSourceUpdate(missingSourceId), SourceManagerNotFoundError);
  await assert.rejects(sourceManager.setSourceEnabled({
    sourceId: missingSourceId,
    enabled: true
  }), SourceManagerNotFoundError);
  await assert.rejects(sourceManager.authorizeSource({
    sourceId: missingSourceId,
    authorizedAt: SOURCE_MANAGER_TEST_AUTHORIZED_AT,
    enableAfterAuthorization: false
  }), SourceManagerNotFoundError);
  await assert.rejects(sourceManager.revokeSourceAuthorization({
    sourceId: missingSourceId
  }), SourceManagerNotFoundError);
  await assert.rejects(sourceManager.restoreSystemSources([missingSourceId]), SourceManagerNotFoundError);
  await assert.rejects(sourceManager.clearTemporarySourceCache(missingSourceId), SourceManagerNotFoundError);
  await assert.rejects(sourceManager.clearAllSourceCache(missingSourceId), SourceManagerNotFoundError);

  // 类型: object。
  // 作用: 连续未命中后读取状态，证明 FIFO 仍可执行合法后续操作。
  const recoveredState = await sourceManager.getState();
  assert.equal(recoveredState.records.length, 9);
});

// 测试目的: 单源健康检查在端口等待期间暴露 checking，并准确采用成功结果。
test('SourceManager 单源健康检查暴露过程状态并采用成功结果', async () => {
  // 类型: object。
  // 作用: 控制健康端口何时开始和何时返回结果。
  const started = createDeferred();

  // 类型: object。
  // 作用: 控制健康结果完成时机，使测试可以读取 checking 过渡投影。
  const resultGate = createDeferred();

  // 类型: object。
  // 作用: 创建使用可控健康端口的隔离环境。
  const { sourceManager } = createSourceManagerTestEnvironment(null, {}, {
    healthCheckPort: createCheckPort(async () => {
      started.resolve();
      return resultGate.promise;
    })
  });

  // 类型: object。
  // 作用: 保存初始化投影并动态选择当前有效默认源作为健康检测目标。
  const initialState = await sourceManager.initialize();

  // 类型: string。
  // 作用: 使用当前默认源 id，避免测试依赖具体内部身份。
  const sourceId = initialState.defaultSourceId;

  // 类型: Promise<object>。
  // 作用: 启动健康检查但暂不等待完成，以读取 checking 过程状态。
  const checkingPromise = sourceManager.checkSource(sourceId);
  await started.promise;

  // 类型: object|null。
  // 作用: 读取端口等待期间的目标记录，验证 healthStatus 已进入 checking。
  const checkingRecord = findRecord(await sourceManager.getState(), sourceId);
  assert.equal(checkingRecord.runtime.healthStatus, HEALTH_STATUS.checking);

  resultGate.resolve({
    healthStatus: HEALTH_STATUS.normal,
    checkedAt: SOURCE_MANAGER_TEST_CHECKED_AT,
    unavailableReason: ''
  });

  // 类型: object|null。
  // 作用: 读取检测完成记录，验证标准结果和时间被准确采用。
  const completedRecord = findRecord(await checkingPromise, sourceId);
  assert.equal(completedRecord.runtime.healthStatus, HEALTH_STATUS.normal);
  assert.equal(completedRecord.runtime.lastCheckedAt, SOURCE_MANAGER_TEST_CHECKED_AT);
  assert.equal(completedRecord.runtime.lastUnavailableReason, '');
});

// 测试目的: 单源健康端口失败必须收敛 unavailable、复位 checking，并分离程序错误码和用户可读原因。
test('SourceManager 单源健康端口失败后收敛状态并保存用户可读原因', async () => {
  // 类型: Error。
  // 作用: 作为健康端口实现失败的固定原始异常。
  const cause = new Error('health port failed');

  // 类型: object。
  // 作用: 创建始终失败的健康端口环境。
  const { sourceManager } = createSourceManagerTestEnvironment(null, {}, {
    healthCheckPort: createCheckPort(async () => {
      throw cause;
    })
  });

  // 类型: object。
  // 作用: 初始化并读取当前默认源作为检测目标。
  const initialState = await sourceManager.initialize();

  await assert.rejects(sourceManager.checkSource(initialState.defaultSourceId), SourceManagerOperationError);

  // 类型: object|null。
  // 作用: 读取失败后稳定记录，证明checking已复位，页面原因不会泄漏内部operation错误码。
  const record = findRecord(await sourceManager.getState(), initialState.defaultSourceId);
  assert.equal(record.runtime.healthStatus, HEALTH_STATUS.unavailable);
  assert.equal(record.runtime.lastUnavailableReason, '数据源健康检测执行失败，请稍后重试。');
});

// 测试目的: 批量健康检查顺序处理有效启用源，单源失败不阻断后续记录且 checkingAll 可靠复位。
test('SourceManager 批量健康检查容纳部分失败并可靠复位', async () => {
  // 类型: Array<string>。
  // 作用: 记录健康端口实际调用顺序和 sourceId。
  const checkedSourceIds = [];

  // 类型: object。
  // 作用: 创建第二次调用失败、其余调用成功的健康端口环境。
  const { sourceManager } = createSourceManagerTestEnvironment(null, {}, {
    healthCheckPort: createCheckPort(async (record) => {
      checkedSourceIds.push(record.definition.id);

      // 条件分支: 当前是第二条健康检测调用时进入。
      // 执行内容: 制造单源端口失败，验证整批继续执行后续记录。
      if (checkedSourceIds.length === 2) {
        throw new Error('partial health failure');
      }

      return {
        healthStatus: HEALTH_STATUS.normal,
        checkedAt: SOURCE_MANAGER_TEST_CHECKED_AT,
        unavailableReason: ''
      };
    })
  });

  // 类型: object。
  // 作用: 初始化并计算应当参与整批检测的有效启用记录数量。
  const initialState = await sourceManager.initialize();

  // 类型: Array<object>。
  // 作用: 保存当前有效启用目标，批量端口调用数量必须与之相同。
  const enabledRecords = initialState.records.filter(record => record.runtime.enabled);

  // 类型: object。
  // 作用: 保存批量检测完成投影，验证根状态和失败记录收敛。
  const completedState = await sourceManager.checkAllSources();

  assert.equal(checkedSourceIds.length, enabledRecords.length);
  assert.equal(completedState.checkingAll, false);
  assert.equal(findRecord(completedState, checkedSourceIds[1]).runtime.healthStatus, HEALTH_STATUS.unavailable);
  assert.equal(
    findRecord(completedState, checkedSourceIds[1]).runtime.lastUnavailableReason,
    '数据源健康检测执行失败，请稍后重试。'
  );
  assert.equal(findRecord(completedState, checkedSourceIds.at(-1)).runtime.healthStatus, HEALTH_STATUS.normal);
});

// 测试目的: 在线更新检查暴露 checkingUpdate，采用有更新结果，并在失败时复位且保留上次成功值。
test('SourceManager 在线更新检查采用结果并在失败时复位', async () => {
  // 类型: number。
  // 初始值: 0，表示更新端口尚未收到检查请求。
  // 作用: 让同一端口第一次返回成功结果、第二次抛错，验证连续运行态不会被失败覆盖。
  let updateCheckCount = 0;

  // 类型: object。
  // 作用: 创建先成功后失败的在线更新端口环境，两个调用共享同一 SourceManager 运行态。
  const environment = createSourceManagerTestEnvironment(null, {}, {
    updateCheckPort: createCheckPort(async () => {
      // 副作用范围: 只增加当前测试局部调用计数，用于选择成功或失败场景。
      updateCheckCount += 1;

      // 条件分支: 当前是第一次更新检查时进入。
      // 执行内容: 返回完整有更新结果，建立后续失败必须保留的稳定运行态。
      if (updateCheckCount === 1) {
        // 返回值类型: object。
        // 作用: 提供固定版本和时间，证明成功结果完整进入 SourceManager runtime。
        return {
          updateAvailable: true,
          availableVersion: 'v9.9.9',
          availableVersionUpdatedAt: SOURCE_MANAGER_TEST_UPDATED_AT,
          checkedAt: SOURCE_MANAGER_TEST_CHECKED_AT
        };
      }

      // 异常来源: 当前测试第二次更新检查。
      // 处理策略: 制造端口失败，验证 Manager 复位 checkingUpdate 并保留第一次成功结果。
      throw new Error('update port failed');
    })
  });

  // 类型: object。
  // 作用: 初始化共享环境并动态选择 remote 记录。
  const initialState = await environment.sourceManager.initialize();

  // 类型: object。
  // 作用: 选择在线导入记录作为更新检查目标。
  const remoteRecord = findRemoteRecord(initialState);

  // 类型: object|null。
  // 作用: 读取成功检查后的目标记录，验证版本和时间字段完整采用。
  const updatedRecord = findRecord(
    await environment.sourceManager.checkSourceUpdate(remoteRecord.definition.id),
    remoteRecord.definition.id
  );

  assert.equal(updatedRecord.runtime.checkingUpdate, false);
  assert.equal(updatedRecord.runtime.updateAvailable, true);
  assert.equal(updatedRecord.runtime.availableVersion, 'v9.9.9');
  assert.equal(updatedRecord.runtime.availableVersionUpdatedAt, SOURCE_MANAGER_TEST_UPDATED_AT);
  assert.equal(updatedRecord.runtime.lastUpdateCheckedAt, SOURCE_MANAGER_TEST_CHECKED_AT);

  await assert.rejects(
    environment.sourceManager.checkSourceUpdate(remoteRecord.definition.id),
    SourceManagerOperationError
  );

  // 类型: object|null。
  // 作用: 读取同一 Manager 第二次检查失败后的记录，证明过程状态复位且第一次成功结果保持不变。
  const recoveredRecord = findRecord(
    await environment.sourceManager.getState(),
    remoteRecord.definition.id
  );

  assert.equal(recoveredRecord.runtime.checkingUpdate, false);
  assert.equal(recoveredRecord.runtime.updateAvailable, updatedRecord.runtime.updateAvailable);
  assert.equal(recoveredRecord.runtime.availableVersion, updatedRecord.runtime.availableVersion);
  assert.equal(
    recoveredRecord.runtime.availableVersionUpdatedAt,
    updatedRecord.runtime.availableVersionUpdatedAt
  );
  assert.equal(recoveredRecord.runtime.lastUpdateCheckedAt, updatedRecord.runtime.lastUpdateCheckedAt);
});

// 测试目的: 启停使用严格事务，无默认源时首次明确启用的有效源成为默认源。
test('SourceManager 原子启停并在无默认源时采用首次启用源', async () => {
  // 类型: object。
  // 作用: 创建无默认源隔离环境，启用目标从投影动态选择。
  const { repositories, sourceManager } = createSourceManagerTestEnvironment((seeds) => {
    seeds.preferences.defaultSourceId = '';
  });

  // 类型: object。
  // 作用: 初始化无默认源状态并选择关闭但可启用系统源。
  const initialState = await sourceManager.initialize();

  // 类型: object。
  // 作用: 动态选择启用目标，避免测试固化内部 sourceId。
  const targetRecord = findDisabledEnableableRecord(initialState);

  // 类型: object。
  // 作用: 保存启用提交后投影，目标应同时成为默认源。
  const enabledState = await sourceManager.setSourceEnabled({
    sourceId: targetRecord.definition.id,
    enabled: true
  });

  assert.equal(findRecord(enabledState, targetRecord.definition.id).runtime.enabled, true);
  assert.equal(enabledState.defaultSourceId, targetRecord.definition.id);

  // 类型: object。
  // 作用: 保存 clear 交接关闭后的投影，默认源必须为空。
  const disabledState = await sourceManager.setSourceEnabled({
    sourceId: targetRecord.definition.id,
    enabled: false,
    handoff: { mode: 'clear' }
  });

  assert.equal(findRecord(disabledState, targetRecord.definition.id).runtime.enabled, false);
  assert.equal(disabledState.defaultSourceId, '');
  assert.equal((await repositories.definitionRepository.loadPreferences()).defaultSourceId, '');
});

// 测试目的: 关闭当前默认源必须提交 replace/clear，失败不写偏好，replace 候选必须排除目标。
test('SourceManager 关闭默认源强制明确交接并原子替换', async () => {
  // 类型: object。
  // 作用: 创建隔离 Repository 和 SourceManager。
  const { repositories, sourceManager } = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 初始化并读取当前默认源及有效接替记录。
  const initialState = await sourceManager.initialize();

  // 类型: object。
  // 作用: 动态选择当前默认源之外的有效替代记录。
  const replacementRecord = findAlternativeEnabledRecord(initialState, initialState.defaultSourceId);

  await assert.rejects(sourceManager.setSourceEnabled({
    sourceId: initialState.defaultSourceId,
    enabled: false
  }), SourceManagerInvariantError);

  assert.equal((await repositories.definitionRepository.loadPreferences()).defaultSourceId, initialState.defaultSourceId);

  // 类型: object。
  // 作用: 保存 replace 交接提交后投影。
  const nextState = await sourceManager.setSourceEnabled({
    sourceId: initialState.defaultSourceId,
    enabled: false,
    handoff: {
      mode: 'replace',
      sourceId: replacementRecord.definition.id
    }
  });

  assert.equal(nextState.defaultSourceId, replacementRecord.definition.id);
  assert.equal(findRecord(nextState, initialState.defaultSourceId).runtime.enabled, false);
});

// 测试目的: 自定义源授权快照必须来自当前版本和已验证指纹，false 只授权并保持关闭。
test('SourceManager 原子授权自定义源并按用户决定启用', async () => {
  // 类型: object。
  // 作用: 创建隔离环境并初始化授权目标投影。
  const { sourceManager } = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 保存初始化状态并动态选择 pending 自定义源。
  const initialState = await sourceManager.initialize();

  // 类型: object。
  // 作用: 动态选择等待授权目标。
  const pendingRecord = findPendingCustomRecord(initialState);

  await assert.rejects(sourceManager.setSourceEnabled({
    sourceId: pendingRecord.definition.id,
    enabled: true
  }), SourceManagerInvariantError);

  // 类型: object|null。
  // 作用: 读取只授权提交后的目标记录，enabled 必须保持 false。
  const authorizedRecord = findRecord(await sourceManager.authorizeSource({
    sourceId: pendingRecord.definition.id,
    authorizedAt: SOURCE_MANAGER_TEST_AUTHORIZED_AT,
    enableAfterAuthorization: false
  }), pendingRecord.definition.id);

  assert.equal(authorizedRecord.authorization.status, AUTHORIZATION_STATUS.authorized);
  assert.equal(authorizedRecord.authorization.authorizedVersion, pendingRecord.definition.version);
  assert.equal(authorizedRecord.authorization.authorizedScriptHash, pendingRecord.runtime.currentScriptHash);
  assert.equal(authorizedRecord.runtime.enabled, false);

  // 类型: object|null。
  // 作用: 再次授权并明确启用，目标记录应进入有效启用状态。
  const enabledRecord = findRecord(await sourceManager.authorizeSource({
    sourceId: pendingRecord.definition.id,
    authorizedAt: SOURCE_MANAGER_TEST_AUTHORIZED_AT,
    enableAfterAuthorization: true
  }), pendingRecord.definition.id);

  assert.equal(enabledRecord.runtime.enabled, true);
});

// 测试目的: 撤销自定义源授权必须关闭运行权限并消费默认源交接，同时保留历史快照。
test('SourceManager 撤销默认自定义源授权并保留历史诊断', async () => {
  // 类型: string。
  // 作用: 使用当前种子中稳定的已授权在线自定义场景，种子回调先把它设为默认源。
  const customSourceId = 'custom-online-latest';

  // 类型: object。
  // 作用: 创建以已授权自定义源为默认源的隔离环境。
  const { sourceManager } = createSourceManagerTestEnvironment((seeds) => {
    seeds.preferences.defaultSourceId = customSourceId;
  });

  // 类型: object。
  // 作用: 初始化并确认目标确实是有效启用自定义源。
  const initialState = await sourceManager.initialize();

  // 类型: object|null。
  // 作用: 定位撤销目标并保存授权历史字段对照。
  const initialRecord = findRecord(initialState, customSourceId);
  assert.equal(initialRecord.definition.sourceKind, SOURCE_KIND.custom);
  assert.equal(initialRecord.runtime.enabled, true);

  await assert.rejects(
    sourceManager.revokeSourceAuthorization({ sourceId: customSourceId }),
    SourceManagerInvariantError
  );

  // 类型: object|null。
  // 作用: 读取 clear 交接撤销后的目标记录。
  const revokedRecord = findRecord(await sourceManager.revokeSourceAuthorization({
    sourceId: customSourceId,
    handoff: { mode: 'clear' }
  }), customSourceId);

  assert.equal(revokedRecord.authorization.status, AUTHORIZATION_STATUS.revoked);
  assert.equal(revokedRecord.authorization.authorizedAt, initialRecord.authorization.authorizedAt);
  assert.equal(revokedRecord.authorization.authorizedVersion, initialRecord.authorization.authorizedVersion);
  assert.equal(revokedRecord.authorization.authorizedScriptHash, initialRecord.authorization.authorizedScriptHash);
  assert.equal(revokedRecord.runtime.enabled, false);
  assert.equal((await sourceManager.getState()).defaultSourceId, '');
});

// 测试目的: 恢复系统源只移除软隐藏 id，不自动启用、设默认或重建 Package。
test('SourceManager 原子恢复软隐藏系统源且保留保存对象', async () => {
  // 类型: string。
  // 作用: 从基线种子动态派生一个当前关闭系统源作为软隐藏恢复目标。
  const baseline = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 从基线投影前种子选择系统源定义，后续回调只写其 id。
  const hiddenDefinition = baseline.seeds.definitions.find(definition => definition.sourceKind === SOURCE_KIND.system);
  assert.ok(hiddenDefinition);

  // 类型: object。
  // 作用: 创建把目标系统源写入软隐藏集合的隔离环境。
  const { repositories, sourceManager } = createSourceManagerTestEnvironment((seeds) => {
    seeds.preferences.removedSystemSourceIds = [hiddenDefinition.id];
  });

  // 类型: object。
  // 作用: 初始化并保存恢复前目标启用状态。
  const initialState = await sourceManager.initialize();

  // 类型: boolean。
  // 作用: 记录恢复前 Preferences.enabled，恢复事务必须保持该用户决定。
  const enabledBeforeRestore = initialState.records.find(record => record.definition.id === hiddenDefinition.id).runtime.enabled;

  // 类型: object。
  // 作用: 保存恢复提交后的投影。
  const restoredState = await sourceManager.restoreSystemSources([hiddenDefinition.id, hiddenDefinition.id]);

  assert.equal(restoredState.removedSystemSourceIds.includes(hiddenDefinition.id), false);
  assert.equal(findRecord(restoredState, hiddenDefinition.id).runtime.enabled, enabledBeforeRestore);

  // 类型: Array<object>。
  // 作用: 读取全部 Package，证明恢复没有重建或删除脚本包。
  const packages = await repositories.packageRepository.loadAll();
  assert.equal(packages.filter(item => item.sourceId === hiddenDefinition.id).length, 1);
});

// 测试目的: 临时缓存清理只删除 cache/diagnostics，并从真实 Storage usage 重新派生页面摘要。
test('SourceManager 清理临时缓存并保留设置、凭据和会话', async () => {
  // 类型: object。
  // 作用: 创建隔离环境并从 Preferences 动态读取目标 sourceId。
  const environment = createSourceManagerTestEnvironment();

  // 类型: string。
  // 作用: 使用当前默认源作为已存在 Storage 命名空间目标。
  const sourceId = environment.seeds.preferences.defaultSourceId;

  await environment.repositories.storageRepository.set(sourceId, SOURCE_STORAGE_PARTITION.settings, 'setting', { enabled: true });
  await environment.repositories.storageRepository.set(sourceId, SOURCE_STORAGE_PARTITION.credentials, 'credential', { token: 'secret' });
  await environment.repositories.storageRepository.set(sourceId, SOURCE_STORAGE_PARTITION.session, 'session', { id: 'session-1' });
  await environment.repositories.storageRepository.set(sourceId, SOURCE_STORAGE_PARTITION.cache, 'cache', { value: 1 });
  await environment.repositories.storageRepository.set(sourceId, SOURCE_STORAGE_PARTITION.diagnostics, 'diagnostic', { value: 2 });
  await environment.sourceManager.initialize();

  // 类型: object|null。
  // 作用: 读取清理后目标记录，临时缓存摘要必须重新派生为零。
  const record = findRecord(await environment.sourceManager.clearTemporarySourceCache(sourceId), sourceId);

  assert.equal(record.cache.temporaryCacheBytes, 0);
  assert.ok(record.cache.totalCacheBytes > 0);
  assert.equal((await environment.repositories.storageRepository.list(sourceId, SOURCE_STORAGE_PARTITION.cache)).length, 0);
  assert.equal((await environment.repositories.storageRepository.list(sourceId, SOURCE_STORAGE_PARTITION.diagnostics)).length, 0);
  assert.deepEqual(
    await environment.repositories.storageRepository.get(sourceId, SOURCE_STORAGE_PARTITION.settings, 'setting'),
    { enabled: true }
  );
  assert.deepEqual(
    await environment.repositories.storageRepository.get(sourceId, SOURCE_STORAGE_PARTITION.credentials, 'credential'),
    { token: 'secret' }
  );
  assert.deepEqual(
    await environment.repositories.storageRepository.get(sourceId, SOURCE_STORAGE_PARTITION.session, 'session'),
    { id: 'session-1' }
  );
});

// 测试目的: 全部缓存清理删除四个运行分区并保留 settings，投影两级摘要都归零。
test('SourceManager 清理全部运行缓存并保留普通设置', async () => {
  // 类型: object。
  // 作用: 创建隔离环境并从 Preferences 动态读取目标 sourceId。
  const environment = createSourceManagerTestEnvironment();

  // 类型: string。
  // 作用: 使用当前默认源作为已存在 Storage 命名空间目标。
  const sourceId = environment.seeds.preferences.defaultSourceId;

  await environment.repositories.storageRepository.set(sourceId, SOURCE_STORAGE_PARTITION.settings, 'setting', { enabled: true });
  await environment.repositories.storageRepository.set(sourceId, SOURCE_STORAGE_PARTITION.credentials, 'credential', { token: 'secret' });
  await environment.repositories.storageRepository.set(sourceId, SOURCE_STORAGE_PARTITION.session, 'session', { id: 'session-1' });
  await environment.repositories.storageRepository.set(sourceId, SOURCE_STORAGE_PARTITION.cache, 'cache', { value: 1 });
  await environment.repositories.storageRepository.set(sourceId, SOURCE_STORAGE_PARTITION.diagnostics, 'diagnostic', { value: 2 });
  await environment.sourceManager.initialize();

  // 类型: object|null。
  // 作用: 读取清理后目标记录，两级缓存摘要必须根据四个空运行分区归零。
  const record = findRecord(await environment.sourceManager.clearAllSourceCache(sourceId), sourceId);

  assert.equal(record.cache.temporaryCacheBytes, 0);
  assert.equal(record.cache.totalCacheBytes, 0);
  assert.equal((await environment.repositories.storageRepository.list(sourceId, SOURCE_STORAGE_PARTITION.settings)).length, 1);
  assert.equal((await environment.repositories.storageRepository.list(sourceId, SOURCE_STORAGE_PARTITION.credentials)).length, 0);
  assert.equal((await environment.repositories.storageRepository.list(sourceId, SOURCE_STORAGE_PARTITION.session)).length, 0);
  assert.equal((await environment.repositories.storageRepository.list(sourceId, SOURCE_STORAGE_PARTITION.cache)).length, 0);
  assert.equal((await environment.repositories.storageRepository.list(sourceId, SOURCE_STORAGE_PARTITION.diagnostics)).length, 0);
});

// 测试目的: Repository 保存失败必须回滚并保持 Manager 旧投影，不能先采用候选默认源。
test('SourceManager Repository 事务失败后保留偏好和当前投影', async () => {
  // 类型: object。
  // 作用: 创建隔离 Repository 和 SourceManager。
  const { repositories, sourceManager } = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 初始化并选择有效默认源替代记录。
  const initialState = await sourceManager.initialize();

  // 类型: object。
  // 作用: 动态选择新的默认源候选。
  const replacementRecord = findAlternativeEnabledRecord(initialState, initialState.defaultSourceId);

  // 副作用: 覆盖当前测试 Definition Repository 保存方法，制造 Unit of Work 内基础设施失败。
  // 影响范围: 当前隔离 Repository 实例；其他测试环境不受影响。
  repositories.definitionRepository.savePreferences = async () => {
    throw new Error('save preferences failed');
  };

  await assert.rejects(
    sourceManager.setDefaultSource(replacementRecord.definition.id),
    SourceManagerOperationError
  );

  assert.equal((await sourceManager.getState()).defaultSourceId, initialState.defaultSourceId);
  assert.equal((await repositories.definitionRepository.loadPreferences()).defaultSourceId, initialState.defaultSourceId);
});
