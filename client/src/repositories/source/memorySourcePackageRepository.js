/*
  memorySourcePackageRepository.js 模块说明

  - 文件职责:
      实现 SourcePackageRepository 的内存适配器。
      使用私有 Map 保存经过集中领域校验的脚本包，不依赖 Vue、页面、store、SourceManager 或执行宿主。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      SourceRepositoryConflictError: 自定义错误，报告重复种子和 packageRef 归属冲突。
      SourceRepositoryValidationError: 自定义错误，报告包集合和快照结构错误。
      cloneSerializableValue: 自定义工具，隔离仓库输入、输出和事务快照。
      assertNonEmptyString: 自定义校验函数，校验查询和删除使用的 packageRef。
      validateSourcePackage: 自定义校验函数，让构造种子、运行时保存和快照恢复共用完整包契约。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      createPackageMap(sourcePackages, fieldName)
          - params:
              -- sourcePackages: Array<object>，待载入的 SourcePackage 集合。
              -- fieldName: string，校验错误使用的集合字段名。
          - return:
              Map<string, object>，完成校验和引用隔离的包索引。
          - description:
              在修改 Repository 状态前完整校验集合、包字段和 packageRef 唯一性。

  - 模块级类:
      MemorySourcePackageRepository: SourcePackage 私有内存仓库。

  - 对外导出:
      MemorySourcePackageRepository: Class，异步包查询、upsert、删除和事务快照能力。
*/

import {
  // 导入来源: ./sourceRepositoryErrors.js。
  // 导入内容: SourceRepositoryConflictError 冲突错误类。
  // 文件作用: 阻止重复种子和同一 packageRef 被改绑到其他 sourceId。
  SourceRepositoryConflictError,

  // 导入来源: ./sourceRepositoryErrors.js。
  // 导入内容: SourceRepositoryValidationError 校验错误类。
  // 文件作用: 报告构造种子和事务快照不是数组的结构错误。
  SourceRepositoryValidationError
} from './sourceRepositoryErrors.js';

// 导入来源: ./sourceRepositoryUtils.js。
// 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
// 文件作用: 隔离全部仓库输入、输出和事务快照，避免外部引用穿透私有 Map。
import { cloneSerializableValue } from './sourceRepositoryUtils.js';

import {
  // 导入来源: ./sourceRepositoryValidators.js。
  // 导入内容: assertNonEmptyString 非空字符串校验函数。
  // 文件作用: 查询和删除入口区分非法 packageRef 与合法未命中。
  assertNonEmptyString,

  // 导入来源: ./sourceRepositoryValidators.js。
  // 导入内容: validateSourcePackage 完整 SourcePackage 校验函数。
  // 文件作用: 让初始种子、运行时 save 和快照恢复执行同一冻结领域契约。
  validateSourcePackage
} from './sourceRepositoryValidators.js';

/**
 * 根据 SourcePackage 集合创建私有包索引。
 * 纯函数: 返回新的 Map 和包副本，不修改输入集合。
 * 成功路径: 所有包通过集中校验且 packageRef 唯一后返回完整 Map。
 * 失败路径: 集合结构、包字段或重复 packageRef 非法时抛领域错误，不产生可观察的 Repository 写入。
 *
 * @param {Array<object>} sourcePackages 待载入的 SourcePackage 集合。
 * @param {string} fieldName 校验错误使用的集合字段名。
 * @returns {Map<string, object>} 按 packageRef 索引的隔离 SourcePackage Map。
 * @throws {SourceRepositoryValidationError} 当 sourcePackages 不是严格 JSON 数组或包结构非法时抛出。
 * @throws {SourceRepositoryConflictError} 当集合内出现重复 packageRef 时抛出。
 */
function createPackageMap(sourcePackages, fieldName) {
  // 条件分支: 包集合不是数组时进入。
  // 执行内容: 拒绝对象或可迭代值伪装成初始化种子和事务快照。
  if (!Array.isArray(sourcePackages)) {
    throw new SourceRepositoryValidationError(`${fieldName} 必须是数组`);
  }

  // 类型: Array<object>。
  // 作用: 在遍历前校验集合本身没有稀疏项、附加属性或非法嵌套值，并切断调用方引用。
  const safePackages = cloneSerializableValue(sourcePackages, fieldName);

  // 类型: Map<string, object>。
  // 作用: 暂存完整校验后的下一份包状态；只有函数成功返回后，Repository 才会采用该 Map。
  const packagesByRef = new Map();

  // 循环类型: Array.prototype.forEach。
  // 循环作用: 让每个构造种子或快照条目执行与运行时 save 相同的领域校验和唯一性检查。
  safePackages.forEach((sourcePackage) => {
    // 类型: object。
    // 作用: 通过集中校验器确认包字段、脚本文本和完整性对象满足冻结契约。
    const validatedPackage = validateSourcePackage(sourcePackage);

    // 条件分支: 临时 Map 已包含当前 packageRef 时进入。
    // 执行内容: 拒绝构造阶段和快照恢复阶段静默覆盖前一条包记录。
    if (packagesByRef.has(validatedPackage.packageRef)) {
      throw new SourceRepositoryConflictError(
        `SourcePackage 集合包含重复 packageRef: ${validatedPackage.packageRef}`
      );
    }

    // 副作用范围: 只写入本函数新建的临时 Map，外部在函数成功返回前无法观察该状态。
    packagesByRef.set(validatedPackage.packageRef, validatedPackage);
  });

  // 返回值类型: Map<string, object>。
  // 作用: 返回完整、唯一且引用隔离的下一份包索引。
  return packagesByRef;
}

/**
 * SourcePackage 内存 Repository。
 * 职责: 按 packageRef 保存隔离脚本包，提供与未来异步持久化适配器一致的方法。
 * 内部状态: 私有 Map<string, SourcePackage>；调用方不能直接读取、替换或修改该 Map。
 */
export class MemorySourcePackageRepository {
  // 类型: Map<string, object>。
  // 作用: 按 packageRef 保存仓库内部 SourcePackage；私有字段阻止调用方绕过正式 Repository 接口。
  #packagesByRef;

  /**
   * 创建包 Repository。
   * 副作用: 只初始化当前实例私有状态，不修改传入种子。
   * 成功路径: 全部种子通过完整包校验和重复引用检查后一次性建立私有 Map。
   * 失败路径: 任一条种子非法或 packageRef 重复时抛领域错误，实例不会以半完成状态返回。
   *
   * @param {Array<object>} sourcePackages 初始脚本包数组。
   * @throws {SourceRepositoryValidationError} 当种子集合或任一 SourcePackage 不符合契约时抛出。
   * @throws {SourceRepositoryConflictError} 当种子包含重复 packageRef 时抛出。
   */
  constructor(sourcePackages = []) {
    // 类型: Map<string, object>。
    // 作用: 使用预校验临时 Map 一次性初始化私有保存权威，避免构造循环中留下部分状态。
    this.#packagesByRef = createPackageMap(sourcePackages, 'sourcePackages');
  }

  /**
   * 读取全部脚本包。
   * 副作用: 不修改私有 Map，并返回不暴露内部引用的隔离数组。
   * 成功路径: 按当前 Map 插入顺序返回全部 SourcePackage。
   * 失败路径: 私有状态若因运行时故障无法复制，cloneSerializableValue 抛校验错误。
   *
   * @returns {Promise<Array<object>>} 全部 SourcePackage 隔离副本；空仓库返回空数组。
   */
  async loadAll() {
    // 返回值类型: Promise<Array<object>>。
    // 作用: 将私有 Map 值转换并复制为调用方可安全修改的列表结果。
    return cloneSerializableValue(Array.from(this.#packagesByRef.values()), 'sourcePackages');
  }

  /**
   * 按引用读取脚本包。
   * 副作用: 不修改私有 Map。
   * 成功路径: 命中时返回包的隔离副本。
   * 未命中路径: 返回 null，不抛错误。
   * 失败路径: packageRef 非法或命中值无法隔离复制时抛领域校验错误。
   *
   * @param {string} packageRef 包引用，来自 Definition.packageRef 或 SourceManager 写入计划。
   * @returns {Promise<object|null>} 命中时返回隔离副本，未命中返回 null。
   * @throws {SourceRepositoryValidationError} 当 packageRef 不是非空字符串时抛出。
   */
  async get(packageRef) {
    // 类型: string。
    // 作用: 在查询前统一校验包引用，非法参数不能伪装成正常未命中。
    const safePackageRef = assertNonEmptyString(packageRef, 'packageRef');

    // 类型: object|undefined。
    // 作用: 使用已验证包引用从私有 Map 读取当前内部值。
    const sourcePackage = this.#packagesByRef.get(safePackageRef);

    // 返回值类型: object|null。
    // 作用: 命中时返回隔离包；未命中遵守冻结契约返回 null。
    return sourcePackage
      ? cloneSerializableValue(sourcePackage, 'sourcePackage')
      : null;
  }

  /**
   * 新增或更新脚本包。
   * 副作用: 完整校验成功后 upsert 私有 Map 中一个 packageRef。
   * 成功路径: 新包写入，或同一 packageRef 与 sourceId 的包被完整替换，并返回隔离副本。
   * 失败路径: 包结构非法或 packageRef 试图改绑其他 sourceId 时抛领域错误，私有 Map 保持不变。
   *
   * @param {object} sourcePackage 待保存脚本包，来自 SourceManager 写入计划。
   * @returns {Promise<object>} 保存后的隔离副本。
   * @throws {SourceRepositoryValidationError} 当 SourcePackage 不符合冻结契约时抛出。
   * @throws {SourceRepositoryConflictError} 当 packageRef 已属于其他 sourceId 时抛出。
   */
  async save(sourcePackage) {
    // 类型: object。
    // 作用: 先完成集中领域校验和隔离复制，确保任何失败发生在私有 Map 写入之前。
    const storedPackage = cloneSerializableValue(
      validateSourcePackage(sourcePackage),
      'sourcePackage'
    );

    // 类型: object|undefined。
    // 作用: 读取当前 packageRef 归属，用于区分合法同源 upsert 和非法跨源改绑。
    const existingPackage = this.#packagesByRef.get(storedPackage.packageRef);

    // 条件分支: packageRef 已存在且 sourceId 与新包不同。
    // 执行内容: 拒绝改变稳定包引用归属，保持 Definition 和 Package 关联可验证。
    if (existingPackage && existingPackage.sourceId !== storedPackage.sourceId) {
      throw new SourceRepositoryConflictError(
        `packageRef 已属于其他数据源: ${storedPackage.packageRef}`
      );
    }

    // 副作用: 将完整隔离包 upsert 到当前实例私有 Map。
    // 影响范围: 仅当前 packageRef；此前失败路径不会执行该写入。
    this.#packagesByRef.set(storedPackage.packageRef, storedPackage);

    // 返回值类型: object。
    // 作用: 返回第二份隔离副本，调用方修改保存结果不会污染私有 Map。
    return cloneSerializableValue(storedPackage, 'sourcePackage');
  }

  /**
   * 删除脚本包。
   * 副作用: 删除当前实例私有 Map 中一个 packageRef。
   * 成功路径: 命中并删除返回 true。
   * 未命中路径: 合法 packageRef 不存在时返回 false。
   * 失败路径: packageRef 为空时抛领域校验错误，私有 Map 保持不变。
   *
   * @param {string} packageRef 包引用。
   * @returns {Promise<boolean>} true 表示命中并删除；false 表示仓库原本没有该引用。
   * @throws {SourceRepositoryValidationError} 当 packageRef 不是非空字符串时抛出。
   */
  async remove(packageRef) {
    // 类型: string。
    // 作用: 删除前统一校验包引用，非法参数不能伪装成正常未命中。
    const safePackageRef = assertNonEmptyString(packageRef, 'packageRef');

    // 返回值类型: boolean。
    // true: 私有 Map 已删除命中条目；false: 没有对应条目且状态未变化。
    return this.#packagesByRef.delete(safePackageRef);
  }

  /**
   * 创建事务快照。
   * 副作用: 不修改私有 Map，并返回可被外部修改但不会穿透内部状态的隔离数组。
   * 使用边界: 只供 MemorySourceRepositoryUnitOfWork 创建事务前状态。
   *
   * @returns {Array<object>} 当前全部包的隔离快照。
   */
  createSnapshot() {
    // 返回值类型: Array<object>。
    // 作用: 返回私有 Map 当前值的深拷贝，事务协调器可安全保存或传回恢复入口。
    return cloneSerializableValue(Array.from(this.#packagesByRef.values()), 'packageSnapshot');
  }

  /**
   * 恢复事务快照。
   * 副作用: 快照完整校验成功后一次性替换当前实例私有 Map。
   * 成功路径: 使用与构造种子相同的包校验和重复引用规则重建状态。
   * 失败路径: 快照结构、包字段或唯一性非法时抛领域错误，原私有 Map 保持不变。
   *
   * @param {Array<object>} snapshot createSnapshot 返回的快照。
   * @returns {void} 恢复通过私有状态一次替换完成。
   * @throws {SourceRepositoryValidationError} 当快照或包结构非法时抛出。
   * @throws {SourceRepositoryConflictError} 当快照包含重复 packageRef 时抛出。
   */
  restoreSnapshot(snapshot) {
    // 类型: Map<string, object>。
    // 作用: 在触碰当前状态前完整重建候选 Map，保证失败恢复不会留下半份快照。
    const restoredPackagesByRef = createPackageMap(snapshot, 'packageSnapshot');

    // 副作用: 一次性替换当前实例私有包索引。
    // 影响范围: 当前 Repository 全部包状态；只在候选 Map 完整通过后执行。
    this.#packagesByRef = restoredPackagesByRef;
  }
}
