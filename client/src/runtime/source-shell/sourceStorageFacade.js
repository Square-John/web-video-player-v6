/*
  sourceStorageFacade.js 模块说明

  - 文件职责:
      创建绑定单一 sourceId 的五分区 Storage 门面，让 Provider 无法把其他 sourceId 作为方法参数访问。
      所有操作实时委托 SourceStorageRepository，不保存第二份私有空间状态。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      SOURCE_STORAGE_PARTITION、cloneSerializableValue: 自定义 Repository 工具，提供五分区枚举和返回值隔离。
      SourceRepositoryValidationError: 自定义 Repository 错误，转换为 Shell validation。
      SourceShellError、SourceShellOperationError、SourceShellValidationError: 自定义 Shell 错误，统一失败边界。
      assertExactArgumentCount、normalizeSourceShellId: 自定义 Shell 验证器，校验精确方法参数和绑定身份。

  - 模块级常量:
      SOURCE_STORAGE_REPOSITORY_METHODS: Array<string>，门面依赖的 Repository 方法集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      assertStorageRepository(storageRepository): Function，校验 Repository 依赖方法。
      runStorageOperation(operationName, action): Function，转换 Repository validation 和基础设施错误。
      createPartitionFacade(sourceId, partition, storageRepository): Function，创建单分区冻结门面。

  - 模块级类:
      无

  - 对外导出:
      createSourceStorageFacade(options): Function，创建绑定 sourceId 的五分区冻结门面。
*/

import {
  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: SOURCE_STORAGE_PARTITION 五分区枚举。
  // 文件作用: 创建 settings、credentials、session、cache 和 diagnostics 固定门面。
  SOURCE_STORAGE_PARTITION,

  // 导入来源: ../../repositories/source/sourceRepositoryUtils.js。
  // 导入内容: cloneSerializableValue 严格 JSON Value 隔离复制函数。
  // 文件作用: 对 Repository 返回值和 list 条目执行第二层边界隔离。
  cloneSerializableValue
} from '../../repositories/source/sourceRepositoryUtils.js';

// 导入来源: ../../repositories/source/sourceRepositoryErrors.js。
// 导入内容: SourceRepositoryValidationError Repository 输入错误。
// 文件作用: 将动态 key、partition 和 value 校验失败转换为 Shell validation。
import { SourceRepositoryValidationError } from '../../repositories/source/sourceRepositoryErrors.js';

import {
  // 导入来源: ./sourceShellErrors.js。
  // 导入内容: SourceShellError Shell 稳定错误基类。
  // 文件作用: 避免重复包装已经分类的 Shell 错误。
  SourceShellError,

  // 导入来源: ./sourceShellErrors.js。
  // 导入内容: SourceShellOperationError Storage 基础设施错误。
  // 文件作用: 包装非校验 Repository 失败并保留 cause。
  SourceShellOperationError,

  // 导入来源: ./sourceShellErrors.js。
  // 导入内容: SourceShellValidationError Storage 输入错误。
  // 文件作用: 包装 Repository validation 并提供稳定 code。
  SourceShellValidationError
} from './sourceShellErrors.js';

import {
  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: assertExactArgumentCount 精确参数数量校验。
  // 文件作用: 禁止 Provider 向分区方法附带 sourceId 或其他额外参数。
  assertExactArgumentCount,

  // 导入来源: ./sourceShellValidators.js。
  // 导入内容: normalizeSourceShellId 安全 sourceId 校验。
  // 文件作用: 构造时冻结唯一数据源身份并拒绝危险动态键。
  normalizeSourceShellId
} from './sourceShellValidators.js';

// 类型: Array<string>。
// 作用: SourceStorageFacade 必需的 Repository 方法，缺少任一方法都禁止创建门面。
const SOURCE_STORAGE_REPOSITORY_METHODS = Object.freeze([
  // 类型: string。
  // 作用: 分区门面读取单个键时委托的 Repository 方法。
  'get',

  // 类型: string。
  // 作用: 分区门面写入单个严格 JSON Value 时委托的 Repository 方法。
  'set',

  // 类型: string。
  // 作用: 分区门面删除单个键时委托的 Repository 方法。
  'remove',

  // 类型: string。
  // 作用: 分区门面列出全部隔离键值条目时委托的 Repository 方法。
  'list',

  // 类型: string。
  // 作用: 分区门面清理当前单一分区时委托的 Repository 方法。
  'clear'
]);

/**
 * 校验 SourceStorageRepository 依赖方法完整。
 * 纯函数: 只读取依赖对象方法，不调用或修改 Repository。
 *
 * @param {*} storageRepository Storage Repository 候选。
 * @returns {object} 方法完整的原 Repository 引用。
 * @throws {SourceShellValidationError} 当依赖不是对象或缺少方法时抛出。
 */
function assertStorageRepository(storageRepository) {
  // 条件分支: Repository 不是对象或为 null 时进入。
  // 执行内容: 拒绝创建无法委托真实保存态的空门面。
  if (!storageRepository || typeof storageRepository !== 'object') {
    throw new SourceShellValidationError('storageRepository 必须是对象');
  }

  // 类型: Array<string>。
  // 作用: 找出门面运行必需但依赖没有提供的异步方法。
  const missingMethods = SOURCE_STORAGE_REPOSITORY_METHODS.filter((methodName) => {
    return typeof storageRepository[methodName] !== 'function';
  });

  // 条件分支: 至少缺少一个 Repository 方法时进入。
  // 执行内容: 抛 validation，避免调用阶段才出现模糊 TypeError。
  if (missingMethods.length > 0) {
    throw new SourceShellValidationError(
      `storageRepository 缺少方法: ${missingMethods.join(', ')}`
    );
  }

  // 返回值类型: object。
  // 作用: 返回同一 Repository 原引用，五个分区门面共享唯一保存态权威而不复制状态。
  return storageRepository;
}

/**
 * 执行一次 Repository Storage 操作并统一错误边界。
 * 副作用: 调用 action，action 可以读写当前绑定 sourceId 的 Repository 分区。
 * 成功路径: 原样返回 action 的异步结果。
 * 失败路径: Repository validation 转 Shell validation；其他失败转 operation 并保留 cause。
 *
 * @param {string} operationName 当前分区方法诊断名称。
 * @param {Function} action 异步 Repository 调用。
 * @returns {Promise<*>} Repository 操作结果。
 * @throws {SourceShellValidationError} 当 Repository 拒绝输入时抛出。
 * @throws {SourceShellOperationError} 当 Repository 基础设施失败时抛出。
 */
async function runStorageOperation(operationName, action) {
  try {
    return await action();
  } catch (error) {
    // 异常来源: Shell 参数门禁、Repository 严格校验或 Repository 基础设施执行失败。
    // 处理策略: 保留已有 Shell 分类；Repository validation 转换为 Shell validation；其余失败包装 operation 并保留 cause。
    // 条件分支: 错误已经属于稳定 Shell 分类时进入。
    // 执行内容: 原样抛出，避免重复包装改变 code 或 cause。
    if (error instanceof SourceShellError) {
      throw error;
    }

    // 条件分支: Repository 严格输入校验拒绝当前值时进入。
    // 执行内容: 转换为 Shell validation 并保留 Repository cause。
    if (error instanceof SourceRepositoryValidationError) {
      throw new SourceShellValidationError(error.message, { cause: error });
    }

    // 异常处理: 非稳定 Shell 和非 Repository validation 错误属于基础设施失败。
    // 处理作用: 包装为 operation 并保留原始 error，调用方不解析底层实现类型。
    throw new SourceShellOperationError(`${operationName} 失败`, error);
  }
}

/**
 * 创建绑定 sourceId 和单一 partition 的冻结门面。
 * 纯函数: 只创建方法闭包；实际 Repository 副作用发生在方法被调用时。
 *
 * @param {string} sourceId 已验证且永久绑定的数据源 id。
 * @param {string} partition SOURCE_STORAGE_PARTITION 中的固定分区。
 * @param {object} storageRepository 方法完整的 SourceStorageRepository。
 * @returns {object} 只含 get、set、remove、list 和 clear 的冻结分区门面。
 */
function createPartitionFacade(sourceId, partition, storageRepository) {
  // 返回值类型: object。
  // 作用: 每个方法只接受业务 key/value 参数，sourceId 和 partition 从闭包注入。
  return Object.freeze({
    /**
     * 读取当前绑定分区中的单个值。
     * 副作用: 调用 Repository 只读接口，不创建缺失命名空间。
     * 成功路径: 命中返回隔离 JSON Value，未命中返回 null。
     * 失败路径: 参数或 Repository 失败使用稳定 Shell 错误。
     *
     * @param {...*} args 精确包含一个 key。
     * @returns {Promise<*>} 隔离保存值或 null。
     */
    async get(...args) {
      // 执行内容: 要求调用方只提供 key，不允许附带 sourceId、partition 或其他越权参数。
      assertExactArgumentCount(args, 1, `storage.${partition}.get`);

      // 类型: *。
      // 作用: 保存调用方唯一 key 参数，具体字符串和危险键校验由 Repository 执行。
      const [key] = args;

      // 类型: *。
      // 作用: 保存 Repository 隔离返回值，门面再次复制以防替换实现泄漏引用。
      const value = await runStorageOperation(`storage.${partition}.get`, () => {
        // 返回值类型: Promise<*>。
        // 作用: 使用闭包 sourceId 和 partition 委托唯一 Repository 读取目标 key。
        return storageRepository.get(sourceId, partition, key);
      });

      // 条件分支: Repository 明确返回 null 表示未命中时进入。
      // 执行内容: 保留 null，不尝试按 JSON Value 克隆。
      if (value === null) {
        return null;
      }

      // 返回值类型: *。
      // 作用: 再次隔离 Repository 命中值，替换实现也不能向 Provider 泄漏内部引用。
      return cloneSerializableValue(value, `storage.${partition}.value`);
    },

    /**
     * 保存当前绑定分区中的单个值。
     * 副作用: 调用 Repository.set 写入当前 sourceId 和 partition。
     * 成功路径: 返回实际保存值的隔离副本。
     * 失败路径: 参数、危险键、非法 JSON Value 或 Repository 失败使用稳定 Shell 错误。
     *
     * @param {...*} args 精确包含 key 和 value。
     * @returns {Promise<*>} 隔离保存值。
     */
    async set(...args) {
      // 执行内容: 要求调用方只提供 key 和 value，不允许覆盖闭包身份或分区。
      assertExactArgumentCount(args, 2, `storage.${partition}.set`);

      // 类型: Array<*>。
      // 作用: 保存调用方 key 和 value，sourceId/partition 不从参数读取。
      const [key, value] = args;

      // 类型: *。
      // 作用: 保存 Repository 返回的真实写入副本。
      const storedValue = await runStorageOperation(`storage.${partition}.set`, () => {
        // 返回值类型: Promise<*>。
        // 作用: 使用闭包身份委托唯一 Repository 校验并保存当前 value。
        return storageRepository.set(sourceId, partition, key, value);
      });

      // 返回值类型: *。
      // 作用: 再次隔离实际保存值，调用方不能通过返回对象修改 Repository 保存态。
      return cloneSerializableValue(storedValue, `storage.${partition}.storedValue`);
    },

    /**
     * 删除当前绑定分区中的单个键。
     * 副作用: 调用 Repository.remove 修改当前 sourceId 和 partition。
     * 成功路径: 返回是否真实删除现存键。
     * 失败路径: 参数、危险键或 Repository 失败使用稳定 Shell 错误。
     *
     * @param {...*} args 精确包含一个 key。
     * @returns {Promise<boolean>} true 表示删除现存键，false 表示未命中。
     */
    async remove(...args) {
      // 执行内容: 要求调用方只提供 key，不允许附带 sourceId 或 partition。
      assertExactArgumentCount(args, 1, `storage.${partition}.remove`);

      // 类型: *。
      // 作用: 保存调用方唯一 key 参数。
      const [key] = args;

      // 返回值类型: Promise<boolean>。
      // 作用: 返回 Repository 对当前闭包分区的真实删除结果，不建立门面影子状态。
      return runStorageOperation(`storage.${partition}.remove`, () => {
        // 返回值类型: Promise<boolean>。
        // 作用: 使用闭包身份委托唯一 Repository 删除目标 key。
        return storageRepository.remove(sourceId, partition, key);
      });
    },

    /**
     * 列出当前绑定分区全部键值条目。
     * 副作用: 调用 Repository.list 只读接口，不修改保存态。
     * 成功路径: 返回按 Repository 顺序排列的隔离条目数组。
     * 失败路径: 额外参数或 Repository 失败使用稳定 Shell 错误。
     *
     * @param {...*} args 必须为空数组，方法不接受 sourceId 或其他参数。
     * @returns {Promise<Array<object>>} 隔离 key/value 条目数组。
     */
    async list(...args) {
      // 执行内容: 要求 list 不接收任何参数，防止调用方夹带其他数据源身份。
      assertExactArgumentCount(args, 0, `storage.${partition}.list`);

      // 类型: Array<object>。
      // 作用: 保存 Repository 返回条目，门面再次整体复制隔离 key/value 引用。
      const entries = await runStorageOperation(`storage.${partition}.list`, () => {
        // 返回值类型: Promise<Array<object>>。
        // 作用: 使用闭包身份委托唯一 Repository 列出当前分区条目。
        return storageRepository.list(sourceId, partition);
      });

      // 返回值类型: Array<object>。
      // 作用: 再次整体隔离 key/value 条目，替换 Repository 也不能泄漏嵌套引用。
      return cloneSerializableValue(entries, `storage.${partition}.entries`);
    },

    /**
     * 清理当前绑定分区全部键。
     * 副作用: 调用 Repository.clear 修改当前 sourceId 的单一 partition。
     * 成功路径: 返回实际删除键数量。
     * 失败路径: 额外参数或 Repository 失败使用稳定 Shell 错误。
     *
     * @param {...*} args 必须为空数组，方法不接受 sourceId 或其他参数。
     * @returns {Promise<number>} 清理前分区键数量。
     */
    async clear(...args) {
      // 执行内容: 要求 clear 不接收任何参数，清理范围只能由当前闭包分区决定。
      assertExactArgumentCount(args, 0, `storage.${partition}.clear`);

      // 返回值类型: Promise<number>。
      // 作用: 返回 Repository 对当前闭包分区的真实清理数量，不修改其他四个分区。
      return runStorageOperation(`storage.${partition}.clear`, () => {
        // 返回值类型: Promise<number>。
        // 作用: 使用闭包身份委托唯一 Repository 清理当前固定分区。
        return storageRepository.clear(sourceId, partition);
      });
    }
  });
}

/**
 * 创建绑定 sourceId 的五分区 SourceStorageFacade。
 * 纯函数: 创建冻结能力对象和方法闭包，不读取或写入 Repository。
 *
 * @param {object} options 门面依赖选项。
 * @param {string} options.sourceId 当前 Provider 唯一数据源 id。
 * @param {object} options.storageRepository SourceStorageRepository 实例。
 * @returns {object} 只含 settings、credentials、session、cache 和 diagnostics 的冻结门面。
 * @returns {object} return.settings 普通非敏感设置分区门面。
 * @returns {object} return.credentials 敏感运行凭据分区门面。
 * @returns {object} return.session 挑战和连续请求上下文分区门面。
 * @returns {object} return.cache 可重新生成内容和解析缓存分区门面。
 * @returns {object} return.diagnostics 有界诊断记录分区门面。
 * @throws {SourceShellValidationError} 当 sourceId 或 Repository 依赖不符合契约时抛出。
 */
export function createSourceStorageFacade(options) {
  // 条件分支: options 不是普通依赖对象或为 null 时进入。
  // 执行内容: 拒绝读取缺失 sourceId 和 Repository。
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new SourceShellValidationError('sourceStorageFacade options 必须是对象');
  }

  // 类型: Array<string|symbol>。
  // 作用: 读取全部依赖字段，拒绝隐藏的额外能力进入门面闭包。
  const optionFields = Reflect.ownKeys(options);

  // 条件分支: options 不是精确 sourceId/storageRepository 两字段时进入。
  // 执行内容: 拒绝页面、store、logger 或其他应用对象被塞入 Storage 门面。
  if (optionFields.length !== 2
    || !Object.hasOwn(options, 'sourceId')
    || !Object.hasOwn(options, 'storageRepository')) {
    throw new SourceShellValidationError('sourceStorageFacade options 字段不符合契约');
  }

  // 类型: string。
  // 作用: 构造时校验并永久绑定唯一 sourceId。
  const sourceId = normalizeSourceShellId(options.sourceId, 'sourceStorageFacade.sourceId');

  // 类型: object。
  // 作用: 保存方法完整的 Repository 引用，全部分区门面共享同一保存权威。
  const storageRepository = assertStorageRepository(options.storageRepository);

  // 返回值类型: object。
  // 作用: 五个分区逐一绑定 sourceId 和固定 partition，根对象不暴露 Repository 或 sourceId 参数入口。
  return Object.freeze({
    // 类型: object。
    // 作用: 提供绑定当前 sourceId 的普通非敏感设置 CRUD，不允许切换到其他分区。
    settings: createPartitionFacade(sourceId, SOURCE_STORAGE_PARTITION.settings, storageRepository),

    // 类型: object。
    // 作用: 提供绑定当前 sourceId 的敏感运行凭据 CRUD，不向页面暴露具体内容。
    credentials: createPartitionFacade(sourceId, SOURCE_STORAGE_PARTITION.credentials, storageRepository),

    // 类型: object。
    // 作用: 提供绑定当前 sourceId 的挑战和连续请求上下文 CRUD。
    session: createPartitionFacade(sourceId, SOURCE_STORAGE_PARTITION.session, storageRepository),

    // 类型: object。
    // 作用: 提供绑定当前 sourceId 的可重新生成内容和解析缓存 CRUD。
    cache: createPartitionFacade(sourceId, SOURCE_STORAGE_PARTITION.cache, storageRepository),

    // 类型: object。
    // 作用: 提供绑定当前 sourceId 的有界诊断记录 CRUD。
    diagnostics: createPartitionFacade(sourceId, SOURCE_STORAGE_PARTITION.diagnostics, storageRepository)
  });
}
