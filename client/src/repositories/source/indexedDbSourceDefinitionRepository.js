/*
  indexedDbSourceDefinitionRepository.js 模块说明

  - 文件职责:
      实现 SourceDefinitionRepository 的 IndexedDB 适配器，管理 Definition 集合与唯一 SourcePreferences。
      保持 sourceId、packageRef 唯一性、精确对象校验和引用隔离，不保存页面运行态或脚本文本。

  - 导入库及文件汇总(5 条，内置 0 条，第三方 0 条，自定义 5 条):
      browserPersistence.config: 自定义配置，提供 Definition/Preferences store 和单例键。
      createIndexedDbSourceRepositoryContext: 自定义内部访问器，统一单仓与绑定事务。
      SourceRepositoryConflictError/ValidationError: 自定义错误，报告引用冲突和损坏记录。
      cloneSerializableValue: 自定义工具，隔离输入输出。
      sourceRepositoryValidators: 自定义校验，验证身份、包装记录、Definition 和 Preferences 正式契约。

  - 模块级常量:
      PREFERENCES_RECORD_FIELDS: Array<string>，SourcePreferences 包装记录精确字段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      validatePreferencesRecord(record): 校验并返回 SourcePreferences 隔离副本。

  - 模块级类:
      IndexedDbSourceDefinitionRepository: IndexedDB Definition/Preferences 异步仓。

  - 对外导出:
      IndexedDbSourceDefinitionRepository: Class，供工厂和 UnitOfWork 创建适配器。
*/

import {
  // 导入来源: ../persistence/browserPersistence.config.js；导入内容: BROWSER_PERSISTENCE_STORE；文件作用: 固定 Definition 与 Preferences store。
  BROWSER_PERSISTENCE_STORE,
  // 导入来源: ../persistence/browserPersistence.config.js；导入内容: SOURCE_PREFERENCES_RECORD_KEY；文件作用: 定位唯一 Preferences 包装记录。
  SOURCE_PREFERENCES_RECORD_KEY
} from '../persistence/browserPersistence.config.js';

// 导入来源: ./indexedDbSourceRepositoryContext.js；导入内容: createIndexedDbSourceRepositoryContext；文件作用: 创建两个固定 store 访问器。
import { createIndexedDbSourceRepositoryContext } from './indexedDbSourceRepositoryContext.js';

import {
  // 导入来源: ./sourceRepositoryErrors.js；导入内容: SourceRepositoryConflictError；文件作用: 阻止多个 Definition 复用 packageRef。
  SourceRepositoryConflictError,
  // 导入来源: ./sourceRepositoryErrors.js；导入内容: SourceRepositoryValidationError；文件作用: 报告缺失或损坏 Preferences 单例。
  SourceRepositoryValidationError
} from './sourceRepositoryErrors.js';

// 导入来源: ./sourceRepositoryUtils.js；导入内容: cloneSerializableValue；文件作用: 隔离 Definition 与 Preferences 输入输出。
import { cloneSerializableValue } from './sourceRepositoryUtils.js';

import {
  // 导入来源: ./sourceRepositoryValidators.js；导入内容: assertExactObjectKeys；文件作用: 校验 Preferences 包装记录没有未知字段。
  assertExactObjectKeys,
  // 导入来源: ./sourceRepositoryValidators.js；导入内容: assertPlainObject；文件作用: 校验 Preferences 包装记录是普通对象。
  assertPlainObject,
  // 导入来源: ./sourceRepositoryValidators.js；导入内容: assertSafeRecordKey；文件作用: 查询和删除前校验 sourceId。
  assertSafeRecordKey,
  // 导入来源: ./sourceRepositoryValidators.js；导入内容: validateSourceDefinition；文件作用: 读取和保存时执行完整 Definition 契约。
  validateSourceDefinition,
  // 导入来源: ./sourceRepositoryValidators.js；导入内容: validateSourcePreferences；文件作用: 读取和保存时执行完整 Preferences 契约。
  validateSourcePreferences
} from './sourceRepositoryValidators.js';

// 类型: Array<string>；作用: 固定 Preferences object store 单例包装只包含 key 和 value。
const PREFERENCES_RECORD_FIELDS = Object.freeze(['key', 'value']);

/**
 * 校验 SourcePreferences IndexedDB 包装记录。
 * 纯函数: 不修改记录，返回内部 value 的领域校验隔离副本。
 *
 * @param {*} record sourcePreferences store 主键 global 对应记录。
 * @returns {object} 完整 SourcePreferences 隔离副本。
 * @throws {SourceRepositoryValidationError} 当单例缺失、包装或内部对象损坏时抛出。
 */
function validatePreferencesRecord(record) {
  // 条件分支: 初始化数据库缺少唯一 Preferences 记录时进入。
  // 执行内容: 报告保存图损坏，不创建默认偏好或重新播种。
  if (record === undefined) {
    throw new SourceRepositoryValidationError('IndexedDB 缺少 SourcePreferences 单例记录');
  }
  assertPlainObject(record, 'sourcePreferencesRecord');
  assertExactObjectKeys(record, PREFERENCES_RECORD_FIELDS, 'sourcePreferencesRecord');
  // 条件分支: 包装记录主键不是冻结 global 时进入。
  // 执行内容: 拒绝把其他单例或页面状态当作 SourcePreferences。
  if (record.key !== SOURCE_PREFERENCES_RECORD_KEY) {
    throw new SourceRepositoryValidationError('SourcePreferences 包装记录主键无效');
  }
  return cloneSerializableValue(
    validateSourcePreferences(record.value),
    'sourcePreferences'
  );
}

/**
 * IndexedDB SourceDefinition Repository。
 * 状态所有权: 只持有 Definition 与 Preferences 两个固定 store 上下文。
 * 事务边界: 普通调用分别使用最小事务，UnitOfWork 调用共享同一四仓 readwrite transaction。
 */
export class IndexedDbSourceDefinitionRepository {
  // 类型: Readonly<object>；作用: 提供 SourceDefinition store 的受控 read/write。
  #definitionContext;
  // 类型: Readonly<object>；作用: 提供唯一 SourcePreferences store 的受控 read/write。
  #preferencesContext;

  /**
   * 创建 Definition/Preferences Repository。
   * 副作用: 只创建两个 store 上下文，不打开连接或读取保存图。
   *
   * @param {object} options Repository 依赖。
   * @param {object} options.database BrowserPersistenceDatabase 门面。
   * @param {object|null} options.transaction UnitOfWork 绑定事务或 null。
   */
  constructor({ database, transaction = null }) {
    this.#definitionContext = createIndexedDbSourceRepositoryContext({
      database,
      transaction,
      storeName: BROWSER_PERSISTENCE_STORE.sourceDefinitions
    });
    this.#preferencesContext = createIndexedDbSourceRepositoryContext({
      database,
      transaction,
      storeName: BROWSER_PERSISTENCE_STORE.sourcePreferences
    });
  }

  /**
   * 读取全部 SourceDefinition。
   * 副作用: 只查询 Definition store。
   * 成功路径: 返回按主键顺序的隔离数组，空仓返回空数组。
   * 失败路径: 任一损坏 Definition 或数据库查询失败时 reject，不跳过记录。
   *
   * @returns {Promise<Array<object>>} SourceDefinition 隔离数组。
   */
  async loadDefinitions() {
    return this.#definitionContext.read(async (store) => {
      // 类型: Array<object>；作用: 保存全部结构化克隆结果并逐条复核正式契约。
      const definitions = await store.getAll();
      return definitions.map((sourceDefinition, definitionIndex) => {
        validateSourceDefinition(sourceDefinition);
        return cloneSerializableValue(
          sourceDefinition,
          `sourceDefinitions[${definitionIndex}]`
        );
      });
    });
  }

  /**
   * 按 sourceId 查询 SourceDefinition。
   * 副作用: 只查询 Definition store。
   * 成功路径: 命中返回隔离 Definition，未命中返回 null。
   * 失败路径: sourceId 非法、对象损坏或数据库查询失败时 reject。
   *
   * @param {string} sourceId 数据源稳定身份。
   * @returns {Promise<object|null>} SourceDefinition 隔离副本或 null。
   */
  async getDefinition(sourceId) {
    // 类型: string；作用: 查询前拒绝空值和原型敏感动态键。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');
    return this.#definitionContext.read(async (store) => {
      // 类型: object|undefined；作用: 保存按 id 主键查询结果，undefined 表示未命中。
      const sourceDefinition = await store.get(safeSourceId);
      // 条件分支: 当前 sourceId 没有 Definition 时进入。
      // 执行内容: 按 Repository 契约返回 null。
      if (sourceDefinition === undefined) return null;
      validateSourceDefinition(sourceDefinition);
      return cloneSerializableValue(sourceDefinition, 'sourceDefinition');
    });
  }

  /**
   * 保存或替换 SourceDefinition。
   * 副作用: 在当前单仓或 UnitOfWork 事务中 upsert 一个 Definition。
   * 成功路径: sourceId 新增或同 id 完整替换，且 packageRef 未被其他 Definition 使用。
   * 失败路径: 字段非法、packageRef 冲突或事务失败时不提交候选。
   *
   * @param {object} sourceDefinition 待保存完整 Definition。
   * @returns {Promise<object>} 提交后的隔离 Definition。
   */
  async saveDefinition(sourceDefinition) {
    // 类型: object；作用: 在异步事务前完成领域校验和引用隔离。
    const storedDefinition = cloneSerializableValue(
      validateSourceDefinition(sourceDefinition),
      'sourceDefinition'
    );
    return this.#definitionContext.write(async (store) => {
      // 类型: Array<object>；作用: 检查其他 sourceId 是否已经占用候选 packageRef。
      const definitions = await store.getAll();
      // 类型: object|undefined；作用: 定位会导致一个包引用属于多个 Definition 的冲突记录。
      const conflictingDefinition = definitions.find((currentDefinition) => {
        return currentDefinition.id !== storedDefinition.id
          && currentDefinition.packageRef === storedDefinition.packageRef;
      });
      // 条件分支: 其他 Definition 已使用候选 packageRef 时进入。
      // 执行内容: put 前失败，保持原保存图不变。
      if (conflictingDefinition) {
        throw new SourceRepositoryConflictError(
          `packageRef 已被其他 Definition 使用: ${storedDefinition.packageRef}`
        );
      }
      await store.put(storedDefinition);
      return cloneSerializableValue(storedDefinition, 'savedSourceDefinition');
    });
  }

  /**
   * 删除 SourceDefinition。
   * 副作用: 命中时在当前事务删除一个 sourceId。
   * 成功路径: 命中返回 true，未命中返回 false。
   * 失败路径: sourceId 非法或数据库事务失败时 reject。
   *
   * @param {string} sourceId 待删除数据源身份。
   * @returns {Promise<boolean>} 是否删除既有 Definition。
   */
  async removeDefinition(sourceId) {
    // 类型: string；作用: 删除前拒绝空值和危险动态键。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');
    return this.#definitionContext.write(async (store) => {
      // 类型: IDBValidKey|undefined；作用: 判断主键是否存在以保持未命中 false 语义。
      const existingKey = await store.getKey(safeSourceId);
      // 条件分支: 当前 sourceId 没有 Definition 时进入。
      // 执行内容: 不发起 delete 并返回 false。
      if (existingKey === undefined) return false;
      await store.delete(safeSourceId);
      return true;
    });
  }

  /**
   * 读取唯一 SourcePreferences。
   * 副作用: 只查询 Preferences store。
   * 成功路径: 返回完整隔离 Preferences。
   * 失败路径: 单例缺失、包装损坏、领域字段非法或数据库失败时 reject。
   *
   * @returns {Promise<object>} SourcePreferences 隔离副本。
   */
  async loadPreferences() {
    return this.#preferencesContext.read(async (store) => {
      // 类型: object|undefined；作用: 读取固定 global 单例包装记录。
      const record = await store.get(SOURCE_PREFERENCES_RECORD_KEY);
      return validatePreferencesRecord(record);
    });
  }

  /**
   * 保存唯一 SourcePreferences。
   * 副作用: 在当前单仓或 UnitOfWork 事务中替换 global 单例记录。
   * 成功路径: 完整校验后提交并返回隔离 Preferences。
   * 失败路径: 字段非法或数据库事务失败时不采用候选。
   *
   * @param {object} sourcePreferences 待保存完整用户数据源偏好。
   * @returns {Promise<object>} 提交后的隔离 Preferences。
   */
  async savePreferences(sourcePreferences) {
    // 类型: object；作用: 在事务前执行领域校验并切断调用方引用。
    const storedPreferences = cloneSerializableValue(
      validateSourcePreferences(sourcePreferences),
      'sourcePreferences'
    );
    return this.#preferencesContext.write(async (store) => {
      await store.put({ key: SOURCE_PREFERENCES_RECORD_KEY, value: storedPreferences });
      return cloneSerializableValue(storedPreferences, 'savedSourcePreferences');
    });
  }
}
