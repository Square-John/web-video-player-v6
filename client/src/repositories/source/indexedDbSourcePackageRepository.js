/*
  indexedDbSourcePackageRepository.js 模块说明

  - 文件职责:
      实现 SourcePackageRepository 的 IndexedDB 适配器，提供包集合、单项查询、同引用 upsert 和删除。
      复用正式领域校验与隔离工具；单仓和 UnitOfWork 模式共享同一 CRUD 实现。

  - 导入库及文件汇总(5 条，内置 0 条，第三方 0 条，自定义 5 条):
      BROWSER_PERSISTENCE_STORE: 自定义配置，提供 SourcePackage store 名称。
      createIndexedDbSourceRepositoryContext: 自定义内部访问器，统一单仓和绑定事务。
      SourceRepositoryConflictError: 自定义错误，阻止 packageRef 跨 sourceId 改绑。
      cloneSerializableValue: 自定义工具，隔离 Repository 输入输出。
      assertNonEmptyString/validateSourcePackage: 自定义校验，验证引用和完整包对象。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      IndexedDbSourcePackageRepository: IndexedDB SourcePackage 异步仓。

  - 对外导出:
      IndexedDbSourcePackageRepository: Class，供工厂和 UnitOfWork 创建单仓或事务绑定实例。
*/

// 导入来源: ../persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_STORE；文件作用: 固定 SourcePackage store 名称。
import { BROWSER_PERSISTENCE_STORE } from '../persistence/browserPersistence.config.js';

// 导入来源: ./indexedDbSourceRepositoryContext.js；导入内容: createIndexedDbSourceRepositoryContext；文件作用: 统一单仓与绑定事务 object store 访问。
import { createIndexedDbSourceRepositoryContext } from './indexedDbSourceRepositoryContext.js';

// 导入来源: ./sourceRepositoryErrors.js；导入内容: SourceRepositoryConflictError；文件作用: 报告 packageRef 跨 sourceId 改绑。
import { SourceRepositoryConflictError } from './sourceRepositoryErrors.js';

// 导入来源: ./sourceRepositoryUtils.js；导入内容: cloneSerializableValue；文件作用: 深拷贝全部保存对象和返回值。
import { cloneSerializableValue } from './sourceRepositoryUtils.js';

import {
  // 导入来源: ./sourceRepositoryValidators.js；导入内容: assertNonEmptyString；文件作用: 查询与删除前校验 packageRef。
  assertNonEmptyString,
  // 导入来源: ./sourceRepositoryValidators.js；导入内容: validateSourcePackage；文件作用: 保存和读取时执行完整 Package 契约。
  validateSourcePackage
} from './sourceRepositoryValidators.js';

/**
 * IndexedDB SourcePackage Repository。
 * 状态所有权: 只持有冻结 store 访问器，不持有包副本、页面投影或第二数据库连接。
 * 事务边界: 普通实例每个方法创建最小事务；UnitOfWork 实例复用外层四仓 transaction。
 */
export class IndexedDbSourcePackageRepository {
  // 类型: Readonly<object>；作用: 统一当前 Package store 的只读和读写访问，不泄漏 transaction。
  #context;

  /**
   * 创建 Package Repository。
   * 副作用: 只创建访问上下文，不打开连接或执行请求。
   *
   * @param {object} options Repository 依赖。
   * @param {object} options.database BrowserPersistenceDatabase 门面。
   * @param {object|null} options.transaction UnitOfWork 绑定事务或 null。
   */
  constructor({ database, transaction = null }) {
    this.#context = createIndexedDbSourceRepositoryContext({
      database,
      transaction,
      storeName: BROWSER_PERSISTENCE_STORE.sourcePackages
    });
  }

  /**
   * 读取全部 SourcePackage。
   * 副作用: 只执行 IndexedDB 查询，不修改数据库。
   * 成功路径: 返回按主键顺序的完整隔离包数组，空仓返回空数组。
   * 失败路径: 损坏包校验失败或数据库查询失败时 reject，不跳过记录。
   *
   * @returns {Promise<Array<object>>} SourcePackage 隔离数组。
   */
  async loadAll() {
    return this.#context.read(async (store) => {
      // 类型: Array<object>；作用: 取得当前 store 全部结构化克隆结果并重新执行领域校验。
      const packages = await store.getAll();
      return packages.map((sourcePackage, packageIndex) => {
        validateSourcePackage(sourcePackage);
        return cloneSerializableValue(sourcePackage, `sourcePackages[${packageIndex}]`);
      });
    });
  }

  /**
   * 按 packageRef 查询 SourcePackage。
   * 副作用: 只执行 IndexedDB 查询。
   * 成功路径: 命中返回隔离包，未命中返回 null。
   * 失败路径: 引用非法、对象损坏或数据库查询失败时 reject。
   *
   * @param {string} packageRef Definition 持有的稳定包引用。
   * @returns {Promise<object|null>} SourcePackage 隔离副本或 null。
   */
  async get(packageRef) {
    // 类型: string；作用: 查询前统一拒绝空 packageRef。
    const safePackageRef = assertNonEmptyString(packageRef, 'packageRef');
    return this.#context.read(async (store) => {
      // 类型: object|undefined；作用: 保存 IndexedDB 主键查询结果，undefined 表示未命中。
      const sourcePackage = await store.get(safePackageRef);
      // 条件分支: object store 没有当前 packageRef 时进入。
      // 执行内容: 按统一 Repository 契约返回 null，不抛不存在错误。
      if (sourcePackage === undefined) return null;
      validateSourcePackage(sourcePackage);
      return cloneSerializableValue(sourcePackage, 'sourcePackage');
    });
  }

  /**
   * 保存或替换 SourcePackage。
   * 副作用: 在当前单仓或 UnitOfWork 事务中 upsert 一个包。
   * 成功路径: 新包写入，或同 packageRef 同 sourceId 完整替换并返回隔离副本。
   * 失败路径: 对象非法、packageRef 跨源改绑或事务失败时不提交写入。
   *
   * @param {object} sourcePackage 待保存完整 SourcePackage。
   * @returns {Promise<object>} 提交后的隔离包副本。
   */
  async save(sourcePackage) {
    // 类型: object；作用: 在异步事务前完成领域校验和引用隔离。
    const storedPackage = cloneSerializableValue(
      validateSourcePackage(sourcePackage),
      'sourcePackage'
    );
    return this.#context.write(async (store) => {
      // 类型: object|undefined；作用: 区分合法同源 upsert 与非法 packageRef 跨源改绑。
      const existingPackage = await store.get(storedPackage.packageRef);
      // 条件分支: 既有 packageRef 属于其他 sourceId 时进入。
      // 执行内容: 在 put 前抛冲突错误，外层事务不会提交候选。
      if (existingPackage && existingPackage.sourceId !== storedPackage.sourceId) {
        throw new SourceRepositoryConflictError(
          `packageRef 已属于其他数据源: ${storedPackage.packageRef}`
        );
      }
      await store.put(storedPackage);
      return cloneSerializableValue(storedPackage, 'savedSourcePackage');
    });
  }

  /**
   * 删除 SourcePackage。
   * 副作用: 命中时在当前事务删除一个 packageRef。
   * 成功路径: 命中返回 true，未命中返回 false。
   * 失败路径: 引用非法或数据库事务失败时 reject。
   *
   * @param {string} packageRef 待删除稳定引用。
   * @returns {Promise<boolean>} 是否删除了既有记录。
   */
  async remove(packageRef) {
    // 类型: string；作用: 删除前统一拒绝空 packageRef，并保持合法未命中返回 false。
    const safePackageRef = assertNonEmptyString(packageRef, 'packageRef');
    return this.#context.write(async (store) => {
      // 类型: IDBValidKey|undefined；作用: 先判断主键是否存在，保持未命中返回 false 契约。
      const existingKey = await store.getKey(safePackageRef);
      // 条件分支: 当前 packageRef 没有记录时进入。
      // 执行内容: 不发起 delete，明确返回 false。
      if (existingKey === undefined) return false;
      await store.delete(safePackageRef);
      return true;
    });
  }
}
