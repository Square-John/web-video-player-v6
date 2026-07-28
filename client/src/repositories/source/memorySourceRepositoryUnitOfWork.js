/*
  memorySourceRepositoryUnitOfWork.js 模块说明

  - 文件职责:
      为三个 Memory Repository 提供 FIFO 串行事务协调、成功提交和失败回滚。
      供 SourceManager 执行导入、更新、删除和偏好修改，保证并发调用不会交错快照或覆盖其他成功事务。
      本文件只协调 Repository 原子边界，不包含数据源授权、默认源、页面投影或 Provider 生命周期规则。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      SourceRepositoryTransactionError: 自定义错误，包装 executor 失败并保留原始 cause。
      SourceRepositoryValidationError: 自定义错误，校验 Repository 快照接口和 executor 类型。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertTransactionalRepository(repository, name): 校验 Repository 事务快照接口。

  - 模块级类:
      MemorySourceRepositoryUnitOfWork: 持有私有 Repository 引用并按 FIFO 顺序执行跨仓事务。

  - 对外导出:
      MemorySourceRepositoryUnitOfWork: Class，runInTransaction 串行原子事务能力。
*/

import {
  // 导入来源: ./sourceRepositoryErrors.js。
  // 导入内容: SourceRepositoryTransactionError 事务错误类。
  // 文件作用: executor 失败并完成三仓回滚后统一包装原始异常。
  SourceRepositoryTransactionError,

  // 导入来源: ./sourceRepositoryErrors.js。
  // 导入内容: SourceRepositoryValidationError 校验错误类。
  // 文件作用: 校验 Repository 快照能力和 runInTransaction executor 类型。
  SourceRepositoryValidationError
} from './sourceRepositoryErrors.js';

/**
 * 校验 Repository 是否提供 Memory 事务快照接口。
 * 纯函数: 不修改 Repository 或名称。
 * 成功路径: createSnapshot 和 restoreSnapshot 都是函数时返回原实例。
 * 失败路径: Repository 缺失或快照接口不完整时抛领域校验错误。
 *
 * @param {object} repository Repository 实例。
 * @param {string} name 错误信息中的 Repository 名称。
 * @returns {object} 已验证的原始 Repository 实例。
 * @throws {SourceRepositoryValidationError} 当 Repository 不能参与 Memory 事务时抛出。
 */
function assertTransactionalRepository(repository, name) {
  // 条件分支: Repository 不存在，或缺少任一事务快照方法时进入。
  // 执行内容: 阻止 Unit of Work 持有无法完整回滚的半适配器。
  if (!repository
    || typeof repository.createSnapshot !== 'function'
    || typeof repository.restoreSnapshot !== 'function') {
    throw new SourceRepositoryValidationError(
      `${name} 必须提供 createSnapshot 和 restoreSnapshot`
    );
  }

  // 返回值类型: object。
  // 作用: 返回已验证实例，供 Unit of Work 保存为私有稳定引用。
  return repository;
}

/**
 * Memory Repository 跨仓事务协调器。
 * 职责: 串行调度事务、延迟创建三仓快照、保留成功写入并在失败时恢复当前事务快照。
 * 内部状态: 私有持有三个 Repository 和始终可继续链接的 Promise 队列尾。
 * 并发边界: 后一事务必须等待前一事务提交或回滚后，才能创建自己的快照和执行 executor。
 */
export class MemorySourceRepositoryUnitOfWork {
  // 类型: object。
  // 作用: 私有保存 SourcePackageRepository，防止调用方在排队期间替换事务参与者。
  #packageRepository;

  // 类型: object。
  // 作用: 私有保存 SourceDefinitionRepository，保证 Definition 和 Preferences 使用同一稳定实例。
  #definitionRepository;

  // 类型: object。
  // 作用: 私有保存 SourceStorageRepository，保证私有空间快照和恢复落在同一稳定实例。
  #storageRepository;

  // 类型: Promise<void>。
  // 作用: 指向最后一笔排队事务的收敛结果；无论上一事务成功或失败，队列尾最终都 fulfilled。
  #transactionQueueTail;

  /**
   * 创建 Memory Unit of Work。
   * 副作用: 只保存三个已验证 Repository 私有引用并创建空 FIFO 队列，不修改 Repository 数据。
   * 成功路径: 三个 Repository 都支持快照后完成实例初始化。
   * 失败路径: 任一 Repository 不完整时抛 SourceRepositoryValidationError。
   *
   * @param {object} repositories Repository 集合。
   * @param {object} repositories.packageRepository SourcePackageRepository。
   * @param {object} repositories.definitionRepository SourceDefinitionRepository。
   * @param {object} repositories.storageRepository SourceStorageRepository。
   * @throws {SourceRepositoryValidationError} 当任一 Repository 缺少事务快照接口时抛出。
   */
  constructor({ packageRepository, definitionRepository, storageRepository }) {
    // 类型: object。
    // 作用: 保存已验证 Package Repository 私有引用，后续事务上下文只暴露该稳定实例。
    this.#packageRepository = assertTransactionalRepository(
      packageRepository,
      'packageRepository'
    );

    // 类型: object。
    // 作用: 保存已验证 Definition Repository 私有引用。
    this.#definitionRepository = assertTransactionalRepository(
      definitionRepository,
      'definitionRepository'
    );

    // 类型: object。
    // 作用: 保存已验证 Storage Repository 私有引用。
    this.#storageRepository = assertTransactionalRepository(
      storageRepository,
      'storageRepository'
    );

    // 类型: Promise<void>。
    // 作用: 使用 fulfilled Promise 表示初始队列为空，第一笔事务可以立即取得执行权。
    this.#transactionQueueTail = Promise.resolve();
  }

  /**
   * 执行一笔已经取得 FIFO 执行权的事务。
   * 私有方法: 只由 runInTransaction 排队调用，禁止绕过队列直接执行。
   * 副作用: executor 可以修改三个 Repository；成功保留写入，失败恢复当前事务开始前快照。
   * 成功路径: 原样返回 executor 的同步值或异步 resolve 值。
   * 失败路径: 三仓恢复后抛 SourceRepositoryTransactionError，并保留 executor 原始 cause。
   *
   * @param {Function} executor 已验证的事务执行函数。
   * @returns {Promise<*>} executor 成功结果。
   * @throws {SourceRepositoryTransactionError} 当 executor 同步抛错或异步 reject 时回滚后抛出。
   */
  async #executeTransaction(executor) {
    // 类型: object。
    // 作用: 在当前事务真正取得执行权后创建三个 Repository 的一致快照。
    // 时序约束: 前一事务此时已经完成提交或回滚，不会出现交错基线。
    const snapshots = {
      // 类型: Array<object>。
      // 作用: 保存当前事务开始前的全部 SourcePackage。
      packages: this.#packageRepository.createSnapshot(),

      // 类型: object。
      // 作用: 保存当前事务开始前的 Definition 和 Preferences。
      definitions: this.#definitionRepository.createSnapshot(),

      // 类型: object。
      // 作用: 保存当前事务开始前的全部数据源私有空间。
      storage: this.#storageRepository.createSnapshot()
    };

    // 类型: object。
    // 作用: 给 executor 提供三个稳定 Repository 引用；冻结根对象防止事务内部替换上下文字段。
    const transactionContext = Object.freeze({
      // 类型: object；作用: 当前 Unit of Work 私有持有的 Package Repository。
      packageRepository: this.#packageRepository,
      // 类型: object；作用: 当前 Unit of Work 私有持有的 Definition Repository。
      definitionRepository: this.#definitionRepository,
      // 类型: object；作用: 当前 Unit of Work 私有持有的 Storage Repository。
      storageRepository: this.#storageRepository
    });

    try {
      // 异步调用: 执行当前事务回调。
      // resolve: 返回业务事务结果，三个 Repository 写入作为本事务提交结果保留。
      // reject: 进入 catch，恢复本事务开始前的三个快照。
      return await executor(transactionContext);
    } catch (error) {
      // 副作用: 恢复当前事务开始前的全部 SourcePackage。
      // 影响范围: 只撤销当前串行事务期间的 Package 写入。
      this.#packageRepository.restoreSnapshot(snapshots.packages);

      // 副作用: 恢复当前事务开始前的 Definition 和 Preferences。
      // 影响范围: 只撤销当前串行事务期间的 Definition/Preferences 写入。
      this.#definitionRepository.restoreSnapshot(snapshots.definitions);

      // 副作用: 恢复当前事务开始前的全部私有空间。
      // 影响范围: 只撤销当前串行事务期间的 Storage 写入。
      this.#storageRepository.restoreSnapshot(snapshots.storage);

      // 错误类型: SourceRepositoryTransactionError。
      // 作用: 告诉 SourceManager 当前事务已经失败并完成回滚，同时通过 cause 保留原始异常。
      throw new SourceRepositoryTransactionError(
        '数据源 Repository 事务失败，已恢复事务前状态',
        error
      );
    }
  }

  /**
   * 把跨仓事务加入 FIFO 队列。
   * 副作用: 更新内部队列尾；executor 取得执行权后可以修改三个 Repository。
   * 成功路径: 等待前一事务结束，执行当前 executor，并原样返回其结果。
   * 失败路径: 非函数 executor 直接抛校验错误；事务失败完成回滚后抛事务错误。
   * 队列恢复: 无论当前事务成功或失败，内部队列尾都会收敛为 fulfilled，后续事务继续执行。
   *
   * @param {Function} executor 事务执行函数；不能在内部递归调用同一 Unit of Work 实例。
   * @returns {Promise<*>} 当前事务的独立成功结果或失败异常。
   * @throws {SourceRepositoryValidationError} 当 executor 不是函数时抛出且不加入队列。
   * @throws {SourceRepositoryTransactionError} 当 executor 失败并完成三仓回滚后抛出。
   */
  async runInTransaction(executor) {
    // 条件分支: executor 不是函数时进入。
    // 执行内容: 在更新队列前拒绝非法调用，保证后续合法事务不受影响。
    if (typeof executor !== 'function') {
      throw new SourceRepositoryValidationError('transaction executor 必须是函数');
    }

    // 类型: Promise<*>。
    // 作用: 把当前事务链接到已有队列尾；只有前一事务收敛后才调用私有执行方法并创建快照。
    const queuedTransaction = this.#transactionQueueTail.then(() => {
      return this.#executeTransaction(executor);
    });

    // 类型: Promise<void>。
    // 作用: 把当前事务成功和失败都收敛为 fulfilled 队列尾，避免失败永久阻塞后续事务。
    // 调用方边界: queuedTransaction 本身仍保留真实结果或异常，不会吞掉业务失败。
    this.#transactionQueueTail = queuedTransaction.then(
      // 成功回调: 当前事务提交后把内部队列状态收敛为 undefined fulfilled。
      () => undefined,
      // 失败回调: 当前事务回滚并抛错后仍把内部队列状态收敛为 undefined fulfilled。
      () => undefined
    );

    // 返回值类型: Promise<*>。
    // 作用: 返回当前事务独立 Promise，让调用方获得 executor 结果或 TransactionError。
    return queuedTransaction;
  }
}
