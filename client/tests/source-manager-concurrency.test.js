/*
  source-manager-concurrency.test.js 模块说明

  - 文件职责:
      验证 SourceManager FIFO 与 SourceRepositoryUnitOfWork FIFO 组合后的并发顺序、失败恢复、cause 和引用隔离。
      使用可控 Promise 制造真实排队窗口，不向生产代码增加测试钩子、延时或环境分支。

  - 导入库及文件汇总(6 条，内置 2 条，第三方 0 条，自定义 4 条):
      assert: 内置模块，断言并发结果、Repository 保存态和错误 cause 链。
      test: 内置模块，注册 Node 领域测试。
      SOURCE_KIND: 自定义配置，选择可物理删除的自定义源。
      SourceRepositoryTransactionError: 自定义错误，验证 Unit of Work 保留基础设施失败 cause。
      SourceManagerNotFoundError、SourceManagerOperationError: 自定义错误，验证删除后拒绝和事务失败包装。
      createSourceManagerTestEnvironment: 自定义测试夹具，创建隔离 Repository、Unit of Work 和 SourceManager。

  - 模块级常量:
      CONCURRENCY_MISSING_SOURCE_ID: string，命令排队后篡改使用的不存在 sourceId。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createDeferred(): Function，创建测试可控 Promise。
      findRecord(state, sourceId): Function，从 Manager 投影定位记录。
      findEnabledNonDefaultRecords(state): Function，选择并发事务使用的有效非默认源。
      findRemovableCustomRecord(state): Function，选择混合删除测试的非默认自定义源。

  - 模块级类:
      无

  - 对外导出:
      无，文件由 Node test runner 执行。
*/

// 导入来源: node:assert/strict。
// 导入内容: assert 严格断言对象。
// 文件作用: 比较 Manager 投影、Repository 保存态、并发顺序和错误 cause。
import assert from 'node:assert/strict';

// 导入来源: node:test。
// 导入内容: test Node 测试注册函数。
// 文件作用: 注册 SourceManager 并发和失败恢复领域测试。
import test from 'node:test';

// 导入来源: ../src/config/source-manager.config.js。
// 导入内容: SOURCE_KIND 数据源类型枚举。
// 文件作用: 从投影中选择执行物理删除的自定义源，不使用类型魔法字符串。
import { SOURCE_KIND } from '../src/config/source-manager.config.js';

// 导入来源: ../src/repositories/source/sourceRepositoryErrors.js。
// 导入内容: SourceRepositoryTransactionError Repository 事务错误类型。
// 文件作用: 验证 SourceManager operation 错误保留 Unit of Work 和原始基础设施双层 cause。
import { SourceRepositoryTransactionError } from '../src/repositories/source/sourceRepositoryErrors.js';

import {
  // 导入来源: ../src/services/source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerNotFoundError 数据源未命中错误。
  // 文件作用: 断言删除后的排队命令读取最新 Repository 图并拒绝已删除 sourceId。
  SourceManagerNotFoundError,

  // 导入来源: ../src/services/source-manager/sourceManagerErrors.js。
  // 导入内容: SourceManagerOperationError 领域操作错误。
  // 文件作用: 断言基础设施失败经过 Manager 包装且队列后续仍可执行。
  SourceManagerOperationError
} from '../src/services/source-manager/sourceManagerErrors.js';

// 导入来源: ./source-manager-test-fixtures.js。
// 导入内容: createSourceManagerTestEnvironment 隔离测试环境工厂。
// 文件作用: 为每项并发测试创建独立 Memory Repository、真实 Unit of Work 和 SourceManager。
import { createSourceManagerTestEnvironment } from './source-manager-test-fixtures.js';

// 类型: string。
// 作用: 命令排队后把调用方对象改成不存在 id，用于证明 SourceManager 已在入队前隔离输入。
const CONCURRENCY_MISSING_SOURCE_ID = 'concurrency-missing-source';

/**
 * 创建一个由测试显式放行的 Promise。
 * 副作用: 创建 Promise 并暴露其 resolve；只在当前测试内协调异步执行顺序。
 * 成功路径: 调用 resolve 后 promise 进入 fulfilled。
 * 失败路径: 本辅助对象不提供 reject，测试失败由断言和被测 Promise 表达。
 *
 * @returns {object} 可控 Promise 对象。
 * @returns {Promise<void>} return.promise 测试等待的 Promise。
 * @returns {Function} return.resolve 放行等待点的方法。
 */
function createDeferred() {
  // 类型: Function|null。
  // 作用: 保存 Promise 构造器提供的 resolve，构造完成后一定替换为函数。
  let resolvePromise = null;

  // 类型: Promise<void>。
  // 作用: 在测试指定位置阻塞 Repository 写入，形成可观察的 Manager 排队窗口。
  const promise = new Promise((resolve) => {
    // 副作用范围: 只把当前 Promise 的 resolve 保存到局部变量。
    resolvePromise = resolve;
  });

  // 返回值类型: object。
  // 作用: 返回冻结根对象，测试只能调用 resolve，不能替换协调能力。
  return Object.freeze({ promise, resolve: resolvePromise });
}

/**
 * 从 SourceManagerState 中定位一条记录。
 * 纯函数: 只读取传入投影，不修改记录数组。
 *
 * @param {object} state SourceManagerState。
 * @param {string} sourceId 目标数据源 id。
 * @returns {object|null} 命中返回 SourceRecord，未命中返回 null。
 */
function findRecord(state, sourceId) {
  // 返回值类型: object|null。
  // 作用: 使用 Definition.id 统一定位投影记录，未命中时提供稳定 null。
  return state.records.find(record => record.definition.id === sourceId) || null;
}

/**
 * 选择当前有效启用且不是默认源的记录。
 * 纯函数: 只筛选传入投影并返回新数组，不修改运行态或偏好。
 *
 * @param {object} state SourceManagerState。
 * @returns {Array<object>} 可用于无交接启停和默认源切换的记录集合。
 */
function findEnabledNonDefaultRecords(state) {
  // 返回值类型: Array<object>。
  // 作用: 排除当前默认源，保证启停测试不需要额外交接命令干扰并发断言。
  return state.records.filter((record) => {
    return record.runtime.enabled
      && record.definition.id !== state.defaultSourceId
      && !state.removedSystemSourceIds.includes(record.definition.id);
  });
}

/**
 * 选择一个不影响当前默认源的自定义记录。
 * 纯函数: 只读取投影；不改变授权、启用或隐藏状态。
 *
 * @param {object} state SourceManagerState。
 * @returns {object|null} 可物理删除的自定义记录；没有候选时返回 null。
 */
function findRemovableCustomRecord(state) {
  // 返回值类型: object|null。
  // 作用: 选择非默认自定义源，让测试只聚焦删除与后续启停交错，不混入默认源交接。
  return state.records.find((record) => {
    return record.definition.sourceKind === SOURCE_KIND.custom
      && record.definition.id !== state.defaultSourceId;
  }) || null;
}

// 测试目的: 两笔并发启停必须按 Manager FIFO 执行，后入队启用读取前一事务提交后的 disabled 状态并最终获胜。
test('SourceManager 并发启停按 FIFO 采用后提交命令', async () => {
  // 类型: object。
  // 作用: 创建使用真实 Memory Unit of Work 的隔离并发环境。
  const environment = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 初始化 Manager 并提供有效非默认源候选。
  const initialState = await environment.sourceManager.initialize();

  // 类型: Array<object>。
  // 作用: 获取不需要默认源交接的已启用候选，避免测试依赖固定 sourceId。
  const candidates = findEnabledNonDefaultRecords(initialState);
  assert.ok(candidates.length > 0);

  // 类型: string。
  // 作用: 同一目标先关闭再启用，最终值可以证明第二笔事务读取了第一笔提交结果。
  const sourceId = candidates[0].definition.id;

  // 类型: Promise<object>。
  // 作用: 第一笔事务把目标 enabled 原子改为 false。
  const disablePromise = environment.sourceManager.setSourceEnabled({ sourceId, enabled: false });

  // 类型: Promise<object>。
  // 作用: 第二笔事务紧接着入队并把同一目标恢复为 true。
  const enablePromise = environment.sourceManager.setSourceEnabled({ sourceId, enabled: true });

  // 类型: Array<object>。
  // 作用: 同时等待两个独立调用结果，结果顺序与 Promise 输入顺序一致。
  const [disabledState, enabledState] = await Promise.all([disablePromise, enablePromise]);

  assert.equal(findRecord(disabledState, sourceId).runtime.enabled, false);
  assert.equal(findRecord(enabledState, sourceId).runtime.enabled, true);
  assert.equal(findRecord(await environment.sourceManager.getState(), sourceId).runtime.enabled, true);
  assert.equal(
    (await environment.repositories.definitionRepository.loadPreferences()).sourceStates[sourceId].enabled,
    true
  );
});

// 测试目的: 删除先提交后，已经排队的启停命令必须读取最新 Repository 图并拒绝，不得用旧投影复活自定义源。
test('SourceManager 删除与启停交错不会复活已删除数据源', async () => {
  // 类型: object。
  // 作用: 创建混合删除和后续启停共享同一 Manager FIFO 的隔离环境。
  const environment = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 初始化并提供现有自定义源、Package 和 Preferences 基线。
  const initialState = await environment.sourceManager.initialize();

  // 类型: object|null。
  // 作用: 动态选择不影响默认源的自定义源，删除后应物理移除全部保存对象。
  const targetRecord = findRemovableCustomRecord(initialState);
  assert.ok(targetRecord);

  // 类型: object|null。
  // 作用: 保存删除前 Package，失败后可通过 packageRef 精确确认物理删除。
  const previousPackage = await environment.repositories.packageRepository.get(targetRecord.packageRef);
  assert.ok(previousPackage);

  // 类型: Promise<object>。
  // 作用: 第一笔事务物理删除自定义源的 Package、Definition、Preferences 和 Storage。
  const deletePromise = environment.sourceManager.deleteSources({
    sourceIds: [targetRecord.definition.id]
  });

  // 类型: Promise<object>。
  // 作用: 第二笔命令在删除尚未返回时入队，执行时必须重新读取删除后的最新图。
  const disablePromise = environment.sourceManager.setSourceEnabled({
    sourceId: targetRecord.definition.id,
    enabled: false
  });

  // 类型: object。
  // 作用: 保存第一笔删除提交后的投影，目标记录必须已经消失。
  const deletedState = await deletePromise;
  assert.equal(findRecord(deletedState, targetRecord.definition.id), null);
  await assert.rejects(disablePromise, SourceManagerNotFoundError);

  // 类型: object。
  // 作用: 读取失败后 Manager 当前投影，证明第二笔失败没有恢复旧记录。
  const finalState = await environment.sourceManager.getState();
  assert.equal(findRecord(finalState, targetRecord.definition.id), null);
  assert.equal(await environment.repositories.packageRepository.get(previousPackage.packageRef), null);
  assert.equal(
    await environment.repositories.definitionRepository.getDefinition(targetRecord.definition.id),
    null
  );
  assert.equal(
    Object.hasOwn(
      (await environment.repositories.definitionRepository.loadPreferences()).sourceStates,
      targetRecord.definition.id
    ),
    false
  );
});

// 测试目的: 第一笔 Repository 写失败必须完整保留双层 cause，Manager FIFO 和 Unit of Work FIFO 仍放行下一笔合法事务。
test('SourceManager 首事务失败后保留 cause 并继续执行后续事务', async () => {
  // 类型: object。
  // 作用: 创建失败回滚和后续成功共用的隔离 Repository 与 Manager。
  const environment = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 初始化并提供两个有效默认源候选。
  const initialState = await environment.sourceManager.initialize();

  // 类型: Array<object>。
  // 作用: 第一候选制造写失败，第二候选验证队列恢复后成功采用。
  const candidates = findEnabledNonDefaultRecords(initialState);
  assert.ok(candidates.length >= 2);

  // 类型: Function。
  // 作用: 保存真实 Preferences 写方法，首轮失败后第二轮恢复正常保存。
  const originalSavePreferences = environment.repositories.definitionRepository.savePreferences.bind(
    environment.repositories.definitionRepository
  );

  // 类型: Error。
  // 作用: 固定基础设施失败引用，验证 Manager operation -> Repository transaction -> 原始错误双层 cause。
  const infrastructureCause = new Error('concurrency preferences write failed');

  // 类型: number。
  // 作用: 只让第一笔 Preferences 写失败，后续调用委托真实 Repository。
  let saveAttempt = 0;

  // 副作用: 覆盖当前测试实例的 Preferences 写方法，制造一次性基础设施失败。
  // 影响范围: 当前隔离测试环境；其他测试和生产实现不受影响。
  environment.repositories.definitionRepository.savePreferences = async (preferences) => {
    saveAttempt += 1;

    // 条件分支: 当前是第一笔 Preferences 写入时进入。
    // 执行内容: 抛出固定基础设施错误，触发 Unit of Work 跨仓回滚。
    if (saveAttempt === 1) {
      throw infrastructureCause;
    }

    // 返回值类型: Promise<object>。
    // 作用: 后续事务使用真实保存方法，证明失败队列已经恢复。
    return originalSavePreferences(preferences);
  };

  // 类型: Promise<object>。
  // 作用: 第一笔默认源事务将在 Preferences 保存阶段失败并回滚。
  const failedPromise = environment.sourceManager.setDefaultSource(candidates[0].definition.id);

  // 类型: Promise<object>。
  // 作用: 第二笔默认源事务紧接着入队，必须等待失败收敛后正常执行。
  const succeedingPromise = environment.sourceManager.setDefaultSource(candidates[1].definition.id);

  await assert.rejects(failedPromise, (error) => {
    return error instanceof SourceManagerOperationError
      && error.cause instanceof SourceRepositoryTransactionError
      && error.cause.cause === infrastructureCause;
  });

  // 类型: object。
  // 作用: 保存第二笔成功投影，最终默认源必须采用后续候选。
  const succeedingState = await succeedingPromise;
  assert.equal(succeedingState.defaultSourceId, candidates[1].definition.id);
  assert.equal((await environment.sourceManager.getState()).defaultSourceId, candidates[1].definition.id);
  assert.equal(
    (await environment.repositories.definitionRepository.loadPreferences()).defaultSourceId,
    candidates[1].definition.id
  );
});

// 测试目的: 命令排队后修改调用方对象不能改变执行目标，返回投影被修改也不能穿透 Manager 或 Repository。
test('SourceManager 隔离延迟命令输入和事务输出引用', async () => {
  // 类型: object。
  // 作用: 创建可控写入窗口、命令隔离和输出隔离共用的测试环境。
  const environment = createSourceManagerTestEnvironment();

  // 类型: object。
  // 作用: 初始化并提供两个互不相同的有效候选。
  const initialState = await environment.sourceManager.initialize();

  // 类型: Array<object>。
  // 作用: 第一候选负责阻塞队列，第二候选作为延迟启停命令真实目标。
  const candidates = findEnabledNonDefaultRecords(initialState);
  assert.ok(candidates.length >= 2);

  // 类型: object。
  // 作用: 第一笔 Preferences 写开始时通知测试，此时第二笔命令尚未执行。
  const writeStarted = createDeferred();

  // 类型: object。
  // 作用: 测试修改第二笔命令后放行第一笔 Repository 写入。
  const releaseWrite = createDeferred();

  // 类型: Function。
  // 作用: 保存真实 Preferences 写方法，延迟结束后完成正常事务。
  const originalSavePreferences = environment.repositories.definitionRepository.savePreferences.bind(
    environment.repositories.definitionRepository
  );

  // 类型: boolean。
  // 作用: true 只延迟第一笔写入；false 时后续命令直接委托真实 Repository。
  let delayNextWrite = true;

  // 副作用: 覆盖当前测试 Preferences 写方法，在第一笔事务中建立确定的排队窗口。
  // 影响范围: 当前隔离环境；不会把延时逻辑加入 SourceManager 或 Repository 生产代码。
  environment.repositories.definitionRepository.savePreferences = async (preferences) => {
    // 条件分支: 当前是需要延迟的第一笔写入时进入。
    // 执行内容: 通知测试命令已占用 Manager 队列，并等待显式放行。
    if (delayNextWrite) {
      delayNextWrite = false;
      writeStarted.resolve();
      await releaseWrite.promise;
    }

    // 返回值类型: Promise<object>。
    // 作用: 使用真实 Repository 完成当前和后续 Preferences 保存。
    return originalSavePreferences(preferences);
  };

  // 类型: Promise<object>。
  // 作用: 第一笔事务占用 Manager FIFO，确保第二笔命令具有真实等待时间。
  const blockingPromise = environment.sourceManager.setDefaultSource(candidates[0].definition.id);
  await writeStarted.promise;

  // 类型: object。
  // 作用: 保存第二笔启停命令；SourceManager 应在返回 Promise 前复制其中的有效输入。
  const queuedCommand = {
    sourceId: candidates[1].definition.id,
    enabled: false
  };

  // 类型: Promise<object>。
  // 作用: 第二笔事务已完成同步命令规范化，但仍在 Manager FIFO 中等待。
  const queuedPromise = environment.sourceManager.setSourceEnabled(queuedCommand);

  // 副作用范围: 只篡改调用方持有的原命令对象，不能改变已经入队的 safeCommand。
  queuedCommand.sourceId = CONCURRENCY_MISSING_SOURCE_ID;
  queuedCommand.enabled = true;

  // 执行内容: 放行第一笔写入，使第二笔事务开始读取最新 Repository 图。
  releaseWrite.resolve();
  await blockingPromise;

  // 类型: object。
  // 作用: 保存第二笔事务返回的隔离投影，真实目标应按入队前值关闭。
  const queuedState = await queuedPromise;

  // 类型: object|null。
  // 作用: 定位真实执行目标并验证命令对象篡改未影响 sourceId 或 enabled。
  const queuedRecord = findRecord(queuedState, candidates[1].definition.id);
  assert.ok(queuedRecord);
  assert.equal(queuedRecord.runtime.enabled, false);
  assert.equal(findRecord(queuedState, CONCURRENCY_MISSING_SOURCE_ID), null);

  // 类型: string。
  // 作用: 保存 Repository 中真实名称，返回投影篡改后必须仍保持该值。
  const repositoryName = (
    await environment.repositories.definitionRepository.getDefinition(candidates[1].definition.id)
  ).name;

  // 副作用范围: 只修改调用方持有的返回投影，验证不会穿透 Manager 或 Repository。
  queuedRecord.definition.name = 'tampered returned state';
  queuedRecord.runtime.enabled = true;

  // 类型: object|null。
  // 作用: 从 Manager 重新读取目标记录，字段必须保持事务提交后的真实值。
  const managerRecord = findRecord(
    await environment.sourceManager.getState(),
    candidates[1].definition.id
  );
  assert.equal(managerRecord.definition.name, repositoryName);
  assert.equal(managerRecord.runtime.enabled, false);
  assert.equal(
    (await environment.repositories.definitionRepository.getDefinition(candidates[1].definition.id)).name,
    repositoryName
  );
});
