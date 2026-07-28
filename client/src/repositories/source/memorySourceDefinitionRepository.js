/*
  memorySourceDefinitionRepository.js 模块说明

  - 文件职责:
      实现 SourceDefinitionRepository 的内存适配器。
      使用私有 Map 保存 Definition、私有对象保存 SourcePreferences，不保存脚本文本、私有空间或页面运行态。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      SourceRepositoryConflictError: 自定义错误，报告重复 Definition 和 packageRef 复用冲突。
      SourceRepositoryValidationError: 自定义错误，报告集合与快照结构错误。
      cloneSerializableValue: 自定义工具，隔离仓库输入、输出和事务快照。
      assertPlainObject: 自定义校验函数，校验事务快照根对象。
      assertSafeRecordKey: 自定义校验函数，校验查询和删除使用的 sourceId。
      validateSourceDefinition: 自定义校验函数，让构造、保存和快照恢复共用完整 Definition 契约。
      validateSourcePreferences: 自定义校验函数，让构造、保存和快照恢复共用完整 Preferences 契约。

  - 模块级常量:
      DEFAULT_SOURCE_PREFERENCES: object，空仓库默认偏好。
      DEFINITION_SNAPSHOT_KEYS: Array<string>，事务快照固定字段集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createDefinitionMap(definitions, fieldName): 完整校验 Definition 集合并创建唯一私有索引。
      createStoredPreferences(preferences, fieldName): 校验并隔离 SourcePreferences。
      createDefinitionRepositoryState(snapshot): 校验事务快照并创建可一次替换的完整候选状态。

  - 模块级类:
      MemorySourceDefinitionRepository: Definition 和 Preferences 私有内存仓库。

  - 对外导出:
      MemorySourceDefinitionRepository: Class，Definition/Preferences 异步 CRUD 和事务快照能力。
*/

import {
  // 导入来源: ./sourceRepositoryErrors.js。
  // 导入内容: SourceRepositoryConflictError 冲突错误类。
  // 文件作用: 阻止重复 sourceId 和多个 Definition 复用同一 packageRef。
  SourceRepositoryConflictError,

  // 导入来源: ./sourceRepositoryErrors.js。
  // 导入内容: SourceRepositoryValidationError 校验错误类。
  // 文件作用: 报告 Definition 集合和事务快照根结构错误。
  SourceRepositoryValidationError
} from './sourceRepositoryErrors.js';

// 导入来源: ./sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
// 文件作用: 隔离全部 Definition、Preferences、列表结果和事务快照。
import { cloneSerializableValue } from './sourceRepositoryUtils.js';

import {
  // 导入来源: ./sourceRepositoryValidators.js。
  // 导入内容: assertPlainObject 普通对象校验函数。
  // 文件作用: 保证事务快照根节点没有数组或自定义原型行为。
  assertPlainObject,

  // 导入来源: ./sourceRepositoryValidators.js。
  // 导入内容: assertSafeRecordKey 动态 sourceId 校验函数。
  // 文件作用: 查询和删除入口拒绝空 id 与原型敏感保留键。
  assertSafeRecordKey,

  // 导入来源: ./sourceRepositoryValidators.js。
  // 导入内容: validateSourceDefinition 完整 Definition 校验函数。
  // 文件作用: 让初始种子、运行时 save 和快照恢复执行同一冻结字段契约。
  validateSourceDefinition,

  // 导入来源: ./sourceRepositoryValidators.js。
  // 导入内容: validateSourcePreferences 完整 Preferences 校验函数。
  // 文件作用: 统一校验默认源、软隐藏列表、启用决定和授权快照。
  validateSourcePreferences
} from './sourceRepositoryValidators.js';

// 类型: object。
// 作用: 没有传入偏好种子时提供完整空结构，保证 loadPreferences 始终返回冻结契约对象。
const DEFAULT_SOURCE_PREFERENCES = Object.freeze({
  // 类型: string；作用: 空偏好使用的保存结构版本。
  schemaVersion: '1.0.0',
  // 类型: string；作用: 空仓库没有默认源，允许使用空字符串。
  defaultSourceId: '',
  // 类型: Array<string>；作用: 空仓库没有被软隐藏的系统源。
  removedSystemSourceIds: [],
  // 类型: Record<string, object>；作用: 空仓库没有每源启用决定或授权快照。
  sourceStates: {}
});

// 类型: Array<string>。
// 作用: 固定事务快照根字段，拒绝恢复包含影子状态或缺失保存态的对象。
const DEFINITION_SNAPSHOT_KEYS = Object.freeze([
  'definitions',
  'preferences'
]);

/**
 * 根据 Definition 集合创建私有索引。
 * 纯函数: 返回新的 Map 和隔离 Definition，不修改输入集合。
 * 成功路径: 全部 Definition 通过集中校验，且 sourceId 与 packageRef 分别唯一。
 * 失败路径: 集合结构、Definition 字段或唯一性非法时抛领域错误，不产生可观察写入。
 *
 * @param {Array<object>} definitions 待载入的 SourceDefinition 集合。
 * @param {string} fieldName 校验错误使用的集合字段名。
 * @returns {Map<string, object>} 按 sourceId 索引的隔离 Definition Map。
 * @throws {SourceRepositoryValidationError} 当集合或任一 Definition 不符合契约时抛出。
 * @throws {SourceRepositoryConflictError} 当 sourceId 重复或 packageRef 被多个 Definition 复用时抛出。
 */
function createDefinitionMap(definitions, fieldName) {
  // 条件分支: Definition 集合不是数组时进入。
  // 执行内容: 拒绝无法表达稳定顺序和重复项的伪集合。
  if (!Array.isArray(definitions)) {
    throw new SourceRepositoryValidationError(`${fieldName} 必须是数组`);
  }

  // 类型: Array<object>。
  // 作用: 校验集合没有稀疏项、附加属性和非法嵌套值，并切断调用方引用。
  const safeDefinitions = cloneSerializableValue(definitions, fieldName);

  // 类型: Map<string, object>。
  // 作用: 暂存完整校验后的下一份 Definition 状态，成功前不替换 Repository 私有状态。
  const definitionsById = new Map();

  // 类型: Set<string>。
  // 作用: 在构建临时 Map 时记录 packageRef，避免每条 Definition 重复扫描已处理记录。
  const usedPackageRefs = new Set();

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 对构造种子和快照条目执行与运行时 save 相同的完整领域校验和冲突检查。
  safeDefinitions.forEach((sourceDefinition) => {
    // 类型: object。
    // 作用: 验证 Definition 字段、枚举、六类能力和普通设置 Schema 满足冻结契约。
    const validatedDefinition = validateSourceDefinition(sourceDefinition);

    // 条件分支: 临时 Map 已包含当前 sourceId 时进入。
    // 执行内容: 拒绝构造和恢复阶段静默覆盖同 id Definition。
    if (definitionsById.has(validatedDefinition.id)) {
      throw new SourceRepositoryConflictError(
        `SourceDefinition 集合包含重复 sourceId: ${validatedDefinition.id}`
      );
    }

    // 条件分支: 其他 Definition 已使用当前 packageRef 时进入。
    // 执行内容: 保证一个脚本包引用只属于一个 Definition。
    if (usedPackageRefs.has(validatedDefinition.packageRef)) {
      throw new SourceRepositoryConflictError(
        `packageRef 已被其他 Definition 使用: ${validatedDefinition.packageRef}`
      );
    }

    // 副作用范围: 只写入本函数创建的临时 Set 和 Map，函数失败时不会触碰 Repository 当前状态。
    usedPackageRefs.add(validatedDefinition.packageRef);
    definitionsById.set(validatedDefinition.id, validatedDefinition);
  });

  // 返回值类型: Map<string, object>。
  // 作用: 返回完整、唯一且引用隔离的 Definition 索引。
  return definitionsById;
}

/**
 * 创建可保存的 SourcePreferences 副本。
 * 纯函数: 不修改输入偏好。
 * 成功路径: 完整校验默认源、软隐藏列表、每源启用决定和授权快照后返回隔离副本。
 * 失败路径: 任一字段不符合冻结契约时抛 SourceRepositoryValidationError。
 *
 * @param {object} preferences 待保存 SourcePreferences。
 * @param {string} fieldName 隔离复制错误使用的字段名。
 * @returns {object} 完整校验且引用隔离的 SourcePreferences。
 * @throws {SourceRepositoryValidationError} 当 Preferences 不符合契约时抛出。
 */
function createStoredPreferences(preferences, fieldName) {
  // 返回值类型: object。
  // 作用: 先执行集中领域校验，再创建只能由 Repository 私有保存态持有的副本。
  return cloneSerializableValue(validateSourcePreferences(preferences), fieldName);
}

/**
 * 从事务快照创建 Definition Repository 完整候选状态。
 * 纯函数: 不修改快照和当前 Repository。
 * 成功路径: 快照根字段、Definition 集合和 Preferences 全部通过后返回候选状态。
 * 失败路径: 任一部分非法时抛领域错误，调用方不得替换当前私有状态。
 *
 * @param {object} snapshot createSnapshot 返回的事务快照。
 * @returns {object} 可一次性替换的候选状态。
 * @returns {Map<string, object>} return.definitionsById 完整 Definition 私有索引。
 * @returns {object} return.preferences 完整 SourcePreferences 私有副本。
 * @throws {SourceRepositoryValidationError} 当快照根结构或保存对象非法时抛出。
 * @throws {SourceRepositoryConflictError} 当快照中的 Definition 唯一性冲突时抛出。
 */
function createDefinitionRepositoryState(snapshot) {
  // 类型: object。
  // 作用: 在读取字段前验证严格 JSON Value 并切断事务协调器对原快照的引用。
  const safeSnapshot = cloneSerializableValue(snapshot, 'definitionSnapshot');

  // 执行内容: 要求快照根节点是普通对象，拒绝数组和自定义实例。
  assertPlainObject(safeSnapshot, 'definitionSnapshot');

  // 类型: Array<string>。
  // 作用: 收集快照实际根字段，用于拒绝缺失字段和未进入内部快照契约的影子状态。
  const snapshotKeys = Object.keys(safeSnapshot);

  // 条件分支: 快照字段数量或名称与固定集合不一致时进入。
  // 执行内容: 阻止部分快照恢复和未知状态混入 Repository。
  if (snapshotKeys.length !== DEFINITION_SNAPSHOT_KEYS.length
    || snapshotKeys.some(snapshotKey => !DEFINITION_SNAPSHOT_KEYS.includes(snapshotKey))) {
    throw new SourceRepositoryValidationError('definitionSnapshot 字段必须是 definitions 和 preferences');
  }

  // 类型: Map<string, object>。
  // 作用: 使用构造种子相同规则建立候选 Definition 索引。
  const definitionsById = createDefinitionMap(
    safeSnapshot.definitions,
    'definitionSnapshot.definitions'
  );

  // 类型: object。
  // 作用: 使用运行时 savePreferences 相同规则建立候选偏好对象。
  const preferences = createStoredPreferences(
    safeSnapshot.preferences,
    'definitionSnapshot.preferences'
  );

  // 返回值类型: object。
  // 作用: 只有两个候选部分都成功时，才把完整状态交给恢复入口一次替换。
  return {
    definitionsById,
    preferences
  };
}

/**
 * SourceDefinition 和 SourcePreferences 内存 Repository。
 * 职责: 分别保存 Definition 与用户偏好，并提供与未来异步持久化适配器一致的方法。
 * 内部状态: 私有 Map 保存 Definition，私有普通对象保存 Preferences；外部只能通过正式方法访问副本。
 */
export class MemorySourceDefinitionRepository {
  // 类型: Map<string, object>。
  // 作用: 按 sourceId 保存内部 Definition；私有字段阻止组件、service 和事务协调器直接修改 Map。
  #definitionsById;

  // 类型: object。
  // 作用: 保存完整 SourcePreferences 私有副本，不与 Definition、运行态或页面局部状态混写。
  #preferences;

  /**
   * 创建 Definition Repository。
   * 副作用: 只初始化当前实例私有状态，不修改传入种子。
   * 成功路径: Definition 和 Preferences 全部通过集中校验后一次性建立保存权威。
   * 失败路径: 任一字段或唯一性非法时抛领域错误，实例不会以半完成状态返回。
   *
   * @param {Array<object>} definitions 初始 SourceDefinition 数组。
   * @param {object} preferences 初始 SourcePreferences。
   * @throws {SourceRepositoryValidationError} 当种子或偏好不符合冻结契约时抛出。
   * @throws {SourceRepositoryConflictError} 当 Definition sourceId 或 packageRef 冲突时抛出。
   */
  constructor(definitions = [], preferences = DEFAULT_SOURCE_PREFERENCES) {
    // 类型: Map<string, object>。
    // 作用: 完整校验后一次性初始化私有 Definition 保存态。
    this.#definitionsById = createDefinitionMap(definitions, 'sourceDefinitions');

    // 类型: object。
    // 作用: 完整校验后一次性初始化私有 Preferences 保存态。
    this.#preferences = createStoredPreferences(preferences, 'sourcePreferences');
  }

  /**
   * 读取全部 Definition。
   * 副作用: 不修改私有 Map，并返回不暴露内部引用的隔离数组。
   * 成功路径: 按当前 Map 插入顺序返回全部 Definition，空仓库返回空数组。
   * 失败路径: 私有保存态无法按严格 JSON 规则复制时抛领域校验错误。
   *
   * @returns {Promise<Array<object>>} 全部 Definition 隔离副本；空仓库返回空数组。
   */
  async loadDefinitions() {
    // 返回值类型: Promise<Array<object>>。
    // 作用: 将私有 Map 值复制成调用方可安全修改的 Definition 列表。
    return cloneSerializableValue(
      Array.from(this.#definitionsById.values()),
      'sourceDefinitions'
    );
  }

  /**
   * 按 sourceId 读取 Definition。
   * 副作用: 不修改私有 Map。
   * 成功路径: 命中时返回 Definition 隔离副本。
   * 未命中路径: 合法 sourceId 不存在时返回 null。
   * 失败路径: sourceId 非法或命中值无法隔离复制时抛领域校验错误。
   *
   * @param {string} sourceId 数据源 id，来自 SourceManager 查询或事务计划。
   * @returns {Promise<object|null>} 命中返回隔离副本，未命中返回 null。
   * @throws {SourceRepositoryValidationError} 当 sourceId 为空或使用保留键时抛出。
   */
  async getDefinition(sourceId) {
    // 类型: string。
    // 作用: 在查询前统一校验动态 id，避免非法键被误判为正常未命中。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');

    // 类型: object|undefined。
    // 作用: 从私有 Map 获取当前 Definition 内部值。
    const definition = this.#definitionsById.get(safeSourceId);

    // 返回值类型: object|null。
    // 作用: 命中返回隔离副本；合法未命中遵守冻结契约返回 null。
    return definition
      ? cloneSerializableValue(definition, 'sourceDefinition')
      : null;
  }

  /**
   * 新增或更新 Definition。
   * 副作用: 完整校验成功后 upsert 私有 Map 中一个 sourceId。
   * 成功路径: 新 Definition 写入，或同 id Definition 被完整替换，并返回隔离副本。
   * 失败路径: Definition 非法或其他 sourceId 已使用同一 packageRef 时抛领域错误，私有 Map 保持不变。
   *
   * @param {object} sourceDefinition 待保存 Definition，来自 SourceManager 写入计划。
   * @returns {Promise<object>} 保存后的隔离副本。
   * @throws {SourceRepositoryValidationError} 当 Definition 不符合冻结契约时抛出。
   * @throws {SourceRepositoryConflictError} 当 packageRef 被其他 Definition 使用时抛出。
   */
  async saveDefinition(sourceDefinition) {
    // 类型: object。
    // 作用: 在任何 Map 写入前执行完整领域校验和隔离复制。
    const storedDefinition = cloneSerializableValue(
      validateSourceDefinition(sourceDefinition),
      'sourceDefinition'
    );

    // 类型: object|undefined。
    // 作用: 查找复用同一 packageRef 的其他 Definition，维护一对一包引用关系。
    const conflictingDefinition = Array.from(this.#definitionsById.values()).find((definition) => {
      return definition.id !== storedDefinition.id
        && definition.packageRef === storedDefinition.packageRef;
    });

    // 条件分支: 其他 sourceId 已使用当前 packageRef 时进入。
    // 执行内容: 拒绝冲突写入，保留当前私有 Map 原状态。
    if (conflictingDefinition) {
      throw new SourceRepositoryConflictError(
        `packageRef 已被其他 Definition 使用: ${storedDefinition.packageRef}`
      );
    }

    // 副作用: 将完整隔离 Definition upsert 到当前实例私有 Map。
    // 影响范围: 仅当前 sourceId；此前失败路径不会执行该写入。
    this.#definitionsById.set(storedDefinition.id, storedDefinition);

    // 返回值类型: object。
    // 作用: 返回第二份隔离副本，调用方修改保存结果不会污染私有 Map。
    return cloneSerializableValue(storedDefinition, 'sourceDefinition');
  }

  /**
   * 删除 Definition。
   * 副作用: 删除当前实例私有 Map 中一个 sourceId。
   * 成功路径: 命中并删除返回 true。
   * 未命中路径: 合法 sourceId 不存在时返回 false。
   * 失败路径: sourceId 为空或使用危险动态键时抛领域校验错误，私有 Map 保持不变。
   *
   * @param {string} sourceId 数据源 id。
   * @returns {Promise<boolean>} true 表示命中并删除；false 表示仓库原本没有该 Definition。
   * @throws {SourceRepositoryValidationError} 当 sourceId 为空或使用保留键时抛出。
   */
  async removeDefinition(sourceId) {
    // 类型: string。
    // 作用: 删除前统一校验动态 id，非法参数不能伪装成未命中。
    const safeSourceId = assertSafeRecordKey(sourceId, 'sourceId');

    // 返回值类型: boolean。
    // true: 私有 Map 已删除命中 Definition；false: 没有对应 Definition。
    return this.#definitionsById.delete(safeSourceId);
  }

  /**
   * 读取 SourcePreferences。
   * 副作用: 不修改私有 Preferences，并返回不暴露内部引用的隔离对象。
   * 成功路径: 返回完整 SourcePreferences 隔离副本。
   * 失败路径: 私有保存态无法按严格 JSON 规则复制时抛领域校验错误。
   *
   * @returns {Promise<object>} 完整 SourcePreferences 隔离副本。
   */
  async loadPreferences() {
    // 返回值类型: Promise<object>。
    // 作用: 返回可由 SourceManager 安全修改后再整体保存的偏好副本。
    return cloneSerializableValue(this.#preferences, 'sourcePreferences');
  }

  /**
   * 保存完整 SourcePreferences。
   * 副作用: 完整校验成功后一次性替换私有偏好对象，不产生逐字段中间状态。
   * 成功路径: 返回保存后的第二份隔离副本。
   * 失败路径: 默认源、软隐藏、启用决定或授权快照非法时抛校验错误，原偏好保持不变。
   *
   * @param {object} sourcePreferences 待保存偏好，来自 SourceManager 写入计划。
   * @returns {Promise<object>} 保存后的 SourcePreferences 隔离副本。
   * @throws {SourceRepositoryValidationError} 当 Preferences 不符合冻结契约时抛出。
   */
  async savePreferences(sourcePreferences) {
    // 类型: object。
    // 作用: 在触碰私有状态前完成全部偏好字段校验和引用隔离。
    const storedPreferences = createStoredPreferences(
      sourcePreferences,
      'sourcePreferences'
    );

    // 副作用: 一次性替换当前实例私有 Preferences 保存态。
    // 影响范围: 全局默认源、软隐藏列表和所有 per-source 偏好。
    this.#preferences = storedPreferences;

    // 返回值类型: object。
    // 作用: 返回第二份隔离副本，调用方修改结果不会反向污染私有偏好。
    return cloneSerializableValue(storedPreferences, 'sourcePreferences');
  }

  /**
   * 创建事务快照。
   * 副作用: 不修改私有状态，返回可被事务协调器保存和修改的隔离对象。
   * 使用边界: 只供 MemorySourceRepositoryUnitOfWork 创建事务前状态。
   *
   * @returns {object} Definition 和 Preferences 完整隔离快照。
   * @returns {Array<object>} return.definitions 当前 Definition 列表。
   * @returns {object} return.preferences 当前 SourcePreferences。
   */
  createSnapshot() {
    // 返回值类型: object。
    // 作用: 同时复制两个私有保存域，保证事务协调器不会持有 Repository 内部引用。
    return cloneSerializableValue({
      definitions: Array.from(this.#definitionsById.values()),
      preferences: this.#preferences
    }, 'definitionSnapshot');
  }

  /**
   * 恢复事务快照。
   * 副作用: 快照全部校验成功后一次性替换 Definition Map 和 Preferences。
   * 成功路径: 使用与构造、saveDefinition 和 savePreferences 相同的规则重建完整状态。
   * 失败路径: 快照根结构、Definition、Preferences 或唯一性非法时抛领域错误，原状态保持不变。
   *
   * @param {object} snapshot createSnapshot 返回值。
   * @returns {void} 恢复通过两个私有字段的连续不可失败赋值完成。
   * @throws {SourceRepositoryValidationError} 当快照或保存对象结构非法时抛出。
   * @throws {SourceRepositoryConflictError} 当快照 Definition 唯一性冲突时抛出。
   */
  restoreSnapshot(snapshot) {
    // 类型: object。
    // 作用: 在触碰当前私有状态前完整创建候选 Definition Map 和 Preferences。
    const restoredState = createDefinitionRepositoryState(snapshot);

    // 副作用: 用已经完整校验的候选 Map 替换当前 Definition 保存态。
    this.#definitionsById = restoredState.definitionsById;

    // 副作用: 用已经完整校验的候选对象替换当前 Preferences 保存态。
    // 安全性: 此赋值之后不存在可能抛错的处理，因此不会形成半恢复状态。
    this.#preferences = restoredState.preferences;
  }
}
