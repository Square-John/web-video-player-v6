/*
  indexedDbSourceRepositoryContext.js 模块说明

  - 文件职责:
      为 IndexedDB 数据源 Repository 统一单仓事务与 UnitOfWork 绑定事务的 object store 访问方式。
      该内部上下文不导出 IDBDatabase，不提交事务，也不包含任何领域对象校验或页面状态。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      SOURCE_REPOSITORY_CONTEXT_NAME: string，事务访问器错误消息中的稳定模块名称。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertDatabaseFacade(database): 校验数据库门面最小事务能力。
      assertBoundTransaction(transaction): 校验可选 UnitOfWork 事务。

  - 模块级类:
      无

  - 对外导出:
      createIndexedDbSourceRepositoryContext: Function，创建只含 read/write 的冻结 store 访问器。
*/

// 类型: string；作用: 统一内部依赖校验错误前缀，避免同一访问器使用多套名称。
const SOURCE_REPOSITORY_CONTEXT_NAME = 'IndexedDB Source Repository';

/**
 * 校验数据库门面最小事务能力。
 * 纯函数: 不调用或修改门面，只检查两个受控执行方法。
 *
 * @param {*} database 数据库门面候选。
 * @returns {object} 已验证原始门面。
 * @throws {TypeError} 当门面不能提供受控只读和读写事务时抛出。
 */
function assertDatabaseFacade(database) {
  // 条件分支: 候选不是对象或缺少任一受控事务方法时进入。
  // 执行内容: 阻止 Repository 直接接收 IDBDatabase 或不完整测试替身。
  if (!database || typeof database !== 'object'
    || typeof database.runReadonly !== 'function'
    || typeof database.runReadwrite !== 'function') {
    throw new TypeError(`${SOURCE_REPOSITORY_CONTEXT_NAME} 必须接收 BrowserPersistenceDatabase 门面`);
  }
  return database;
}

/**
 * 校验可选 UnitOfWork 绑定事务。
 * 纯函数: null 表示单仓模式；事务模式只检查 objectStore 能力，不调用或泄漏引用。
 *
 * @param {*} transaction 可选 idb transaction。
 * @returns {object|null} 已验证事务或 null。
 * @throws {TypeError} 当显式事务缺少 objectStore 方法时抛出。
 */
function assertBoundTransaction(transaction) {
  // 条件分支: 调用方没有绑定 UnitOfWork 事务时进入。
  // 执行内容: 返回 null，让每个 Repository 方法通过数据库门面创建最小单仓事务。
  if (transaction === null || transaction === undefined) return null;
  // 条件分支: 显式事务不是对象或不能按名称取得 store 时进入。
  // 执行内容: 拒绝把普通对象伪装成共享原生事务。
  if (typeof transaction !== 'object' || typeof transaction.objectStore !== 'function') {
    throw new TypeError(`${SOURCE_REPOSITORY_CONTEXT_NAME} transaction 无效`);
  }
  return transaction;
}

/**
 * 创建一个 Repository 的统一 store 访问上下文。
 * 副作用: 无；只闭包保存数据库门面、可选事务和固定 store 名称。
 * 成功路径: read/write 在事务模式复用同一 object store，在单仓模式委托数据库门面创建事务。
 * 失败路径: 依赖、storeName 或 executor 非法时抛 TypeError；原生失败由数据库门面转换。
 *
 * @param {object} options 访问上下文配置。
 * @param {object} options.database BrowserPersistenceDatabase 门面。
 * @param {object|null} options.transaction UnitOfWork 绑定事务或 null。
 * @param {string} options.storeName 当前 Repository 固定 object store 名称。
 * @returns {Readonly<object>} 只含 read 和 write 方法的冻结访问器。
 */
export function createIndexedDbSourceRepositoryContext({ database, transaction = null, storeName }) {
  // 类型: object；作用: 保存受控数据库门面，单仓操作由它创建和提交事务。
  const databaseFacade = assertDatabaseFacade(database);
  // 类型: object|null；作用: 保存 UnitOfWork 当前共享事务，存在时 Repository 不自行提交。
  const boundTransaction = assertBoundTransaction(transaction);
  // 条件分支: store 名称不是非空字符串时进入。
  // 执行内容: 阻止动态空名称或对象键进入 IndexedDB objectStore 查找。
  if (typeof storeName !== 'string' || !storeName) {
    throw new TypeError(`${SOURCE_REPOSITORY_CONTEXT_NAME} storeName 必须是非空字符串`);
  }

  return Object.freeze({
    /**
     * 在当前固定 store 执行只读操作。
     * 副作用: 单仓模式创建 readonly transaction；绑定模式只复用现有事务。
     * 成功路径: 返回 executor 结果；单仓模式等待 transaction.done 后返回。
     * 失败路径: executor 非法或请求失败时抛出，不建立备用读取路径。
     *
     * @param {Function} executor 接收当前 IDBObjectStore 的 Repository 内部函数。
     * @returns {Promise<*>} executor 查询结果。
     */
    async read(executor) {
      // 条件分支: executor 不是函数时进入。
      // 执行内容: 在取得 store 前拒绝不完整 Repository 实现。
      if (typeof executor !== 'function') throw new TypeError('Repository read executor 必须是函数');
      // 条件分支: 当前 Repository 绑定 UnitOfWork 事务时进入。
      // 执行内容: 直接复用同一原生事务，提交仍由外层 UnitOfWork 负责。
      if (boundTransaction) return executor(boundTransaction.objectStore(storeName));
      return databaseFacade.runReadonly(
        [storeName],
        async currentTransaction => executor(currentTransaction.objectStore(storeName))
      );
    },

    /**
     * 在当前固定 store 执行读写操作。
     * 副作用: 单仓模式创建 readwrite transaction；绑定模式把请求加入现有事务。
     * 成功路径: 单仓模式以 transaction.done 提交，绑定模式把候选结果交给外层统一提交。
     * 失败路径: executor 或原生请求失败时 reject，外层数据库门面或 UnitOfWork 负责 abort。
     *
     * @param {Function} executor 接收当前 IDBObjectStore 的 Repository 内部函数。
     * @returns {Promise<*>} 写入候选或提交后结果。
     */
    async write(executor) {
      // 条件分支: executor 不是函数时进入。
      // 执行内容: 在创建写事务前拒绝非法实现。
      if (typeof executor !== 'function') throw new TypeError('Repository write executor 必须是函数');
      // 条件分支: 当前 Repository 绑定 UnitOfWork 事务时进入。
      // 执行内容: 复用外层事务，不在 Repository 内等待或提交第二次 transaction.done。
      if (boundTransaction) return executor(boundTransaction.objectStore(storeName));
      return databaseFacade.runReadwrite(
        [storeName],
        async currentTransaction => executor(currentTransaction.objectStore(storeName))
      );
    }
  });
}
