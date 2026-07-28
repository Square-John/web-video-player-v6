/*
  indexedDbSourceRepositoryUnitOfWork.js 模块说明

  - 文件职责:
      使用 BrowserPersistenceDatabase 单一四仓 readwrite transaction 实现 SourceRepositoryUnitOfWork。
      executor 获得三个绑定同一事务的 Repository；成功以 transaction.done 为事实，失败由 IndexedDB 原子 abort。

  - 导入库及文件汇总(5 条，内置 0 条，第三方 0 条，自定义 5 条):
      SOURCE_PERSISTENCE_STORE_NAMES: 自定义配置，固定四仓事务范围。
      IndexedDbSourcePackageRepository: 自定义适配器，创建事务绑定 Package 仓。
      IndexedDbSourceDefinitionRepository: 自定义适配器，创建事务绑定 Definition/Preferences 仓。
      IndexedDbSourceStorageRepository: 自定义适配器，创建事务绑定 Storage 仓。
      SourceRepositoryTransactionError/ValidationError: 自定义错误，报告 executor 与原子事务失败。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertDatabaseFacade(database): 校验数据库门面读写事务能力。

  - 模块级类:
      IndexedDbSourceRepositoryUnitOfWork: 四仓原生事务协调器。

  - 对外导出:
      IndexedDbSourceRepositoryUnitOfWork: Class，供 IndexedDB Repository 工厂创建事务权威。
*/

// 导入来源: ../persistence/browserPersistence.config.js；导入内容: SOURCE_PERSISTENCE_STORE_NAMES；文件作用: 固定 Package/Definition/Preferences/Storage 四仓事务范围。
import { SOURCE_PERSISTENCE_STORE_NAMES } from '../persistence/browserPersistence.config.js';

// 导入来源: ./indexedDbSourcePackageRepository.js；导入内容: IndexedDbSourcePackageRepository；文件作用: 创建 transaction-bound Package 仓。
import { IndexedDbSourcePackageRepository } from './indexedDbSourcePackageRepository.js';

// 导入来源: ./indexedDbSourceDefinitionRepository.js；导入内容: IndexedDbSourceDefinitionRepository；文件作用: 创建 transaction-bound Definition/Preferences 仓。
import { IndexedDbSourceDefinitionRepository } from './indexedDbSourceDefinitionRepository.js';

// 导入来源: ./indexedDbSourceStorageRepository.js；导入内容: IndexedDbSourceStorageRepository；文件作用: 创建 transaction-bound Storage 仓。
import { IndexedDbSourceStorageRepository } from './indexedDbSourceStorageRepository.js';

import {
  // 导入来源: ./sourceRepositoryErrors.js；导入内容: SourceRepositoryTransactionError；文件作用: 包装已经 abort 的跨仓事务失败并保留 cause。
  SourceRepositoryTransactionError,
  // 导入来源: ./sourceRepositoryErrors.js；导入内容: SourceRepositoryValidationError；文件作用: 非函数 executor 在创建事务前失败。
  SourceRepositoryValidationError
} from './sourceRepositoryErrors.js';

/**
 * 校验数据库门面读写事务能力。
 * 纯函数: 不调用或修改门面，只返回已验证原引用。
 *
 * @param {*} database BrowserPersistenceDatabase 候选。
 * @returns {object} 已验证数据库门面。
 * @throws {TypeError} 当候选不能创建受控读写事务时抛出。
 */
function assertDatabaseFacade(database) {
  // 条件分支: 候选不是对象或缺少 runReadwrite 时进入。
  // 执行内容: 阻止 UnitOfWork 接收原生连接或不具备 transaction.done 管理的替身。
  if (!database || typeof database !== 'object' || typeof database.runReadwrite !== 'function') {
    throw new TypeError('IndexedDbSourceRepositoryUnitOfWork 必须接收 BrowserPersistenceDatabase');
  }
  return database;
}

/**
 * IndexedDB 数据源四仓事务协调器。
 * 状态所有权: 只持有数据库门面，不保存队列、快照、Repository 长期实例或事务外候选。
 * 并发规则: IndexedDB 按重叠 readwrite scope 串行化事务；每次调用创建自己的绑定仓和冻结上下文。
 */
export class IndexedDbSourceRepositoryUnitOfWork {
  // 类型: object；作用: 创建四仓原生事务并等待 transaction.done 的唯一数据库门面。
  #database;

  /**
   * 创建 IndexedDB UnitOfWork。
   * 副作用: 只保存已验证数据库门面，不立即创建事务。
   *
   * @param {object} database BrowserPersistenceDatabase 门面。
   */
  constructor(database) {
    this.#database = assertDatabaseFacade(database);
  }

  /**
   * 在同一四仓原生事务中执行领域写入。
   * 副作用: 创建覆盖四个数据源 store 的 readwrite transaction，并把绑定仓交给 executor。
   * 成功路径: executor resolve 且 transaction.done 完成后原样返回结果。
   * 失败路径: 非函数直接校验失败；executor、请求、配额或提交失败时 transaction abort 并抛事务错误。
   *
   * @param {Function} executor 接收冻结三仓上下文的领域事务函数。
   * @returns {Promise<*>} 原生提交后的 executor 结果。
   * @throws {SourceRepositoryValidationError} 当 executor 不是函数时抛出。
   * @throws {SourceRepositoryTransactionError} 当事务失败并完成 abort 时抛出。
   */
  async runInTransaction(executor) {
    // 条件分支: executor 不是函数时进入。
    // 执行内容: 在创建原生事务前失败，不影响后续合法调用。
    if (typeof executor !== 'function') {
      throw new SourceRepositoryValidationError('transaction executor 必须是函数');
    }

    try {
      return await this.#database.runReadwrite(
        SOURCE_PERSISTENCE_STORE_NAMES,
        async (transaction) => {
          // 类型: IndexedDbSourcePackageRepository；作用: 绑定当前四仓事务的 Package 仓。
          const packageRepository = new IndexedDbSourcePackageRepository({
            database: this.#database,
            transaction
          });
          // 类型: IndexedDbSourceDefinitionRepository；作用: 绑定当前四仓事务的 Definition/Preferences 仓。
          const definitionRepository = new IndexedDbSourceDefinitionRepository({
            database: this.#database,
            transaction
          });
          // 类型: IndexedDbSourceStorageRepository；作用: 绑定当前四仓事务的 Storage 仓。
          const storageRepository = new IndexedDbSourceStorageRepository({
            database: this.#database,
            transaction
          });
          // 类型: Readonly<object>；作用: 防止 executor 替换任一事务绑定仓引用。
          const transactionContext = Object.freeze({
            packageRepository,
            definitionRepository,
            storageRepository
          });
          return executor(transactionContext);
        }
      );
    } catch (error) {
      throw new SourceRepositoryTransactionError(
        '数据源 IndexedDB 事务失败，原生事务已中止',
        error
      );
    }
  }
}
