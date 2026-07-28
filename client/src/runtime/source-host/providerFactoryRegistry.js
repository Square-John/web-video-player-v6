/*
  providerFactoryRegistry.js 模块说明

  - 文件职责:
      创建 providerKey 到项目内可信 Provider 工厂的显式注册表。
      注册时严格校验工厂字段、身份和函数，并捕获冻结方法门面，防止外部后续替换工厂实现。
      供 SourceExecutionHost 定位受审工厂；不保存 Provider 实例、不读取脚本文本，也不推断 sourceKind 对应实现。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      SourceExecutionHostValidationError: 自定义 Host 错误，拒绝非法 providerKey 或工厂结构。
      SourceExecutionHostConflictError: 自定义 Host 错误，拒绝重复 providerKey 覆盖。

  - 模块级常量:
      PROVIDER_FACTORY_FIELDS: Array<string>，可信工厂允许的精确字段集合。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeProviderKey(providerKey): Function，校验并规范化非空 providerKey。
      createProviderFactoryFacade(providerKey, providerFactory): Function，校验并捕获冻结可信工厂门面。

  - 模块级类:
      无

  - 对外导出:
      createProviderFactoryRegistry(options): Function，创建隔离可信工厂注册表。
*/

import {
  // 导入来源: ./sourceExecutionHostErrors.js。
  // 导入内容: SourceExecutionHostConflictError Host 冲突错误。
  // 文件作用: 重复 providerKey 注册时阻止新工厂覆盖已经受审的旧工厂。
  SourceExecutionHostConflictError,

  // 导入来源: ./sourceExecutionHostErrors.js。
  // 导入内容: SourceExecutionHostValidationError Host 输入错误。
  // 文件作用: providerKey、options 或工厂结构不符合精确契约时返回稳定错误。
  SourceExecutionHostValidationError
} from './sourceExecutionHostErrors.js';

// 类型: Array<string>。
// 作用: 固定可信工厂只能公开 providerKey、supports 和 create，禁止夹带脚本文本、Repository 或页面能力。
const PROVIDER_FACTORY_FIELDS = Object.freeze([
  // 类型: string。
  // 作用: 要求工厂声明与注册键一致的唯一身份。
  'providerKey',

  // 类型: string。
  // 作用: 要求工厂在创建前判断 Definition 是否存在受审数据集。
  'supports',

  // 类型: string。
  // 作用: 要求工厂提供创建标准 SourceProvider 的唯一入口。
  'create'
]);

/**
 * 校验并规范化 providerKey。
 * 纯函数: 返回去除首尾空白后的新字符串，不修改调用方输入。
 * 失败路径: 非字符串或空白键抛 Host validation，避免 Map 出现不可追踪键。
 *
 * @param {*} providerKey 待校验的可信工厂注册键。
 * @returns {string} 非空 providerKey。
 * @throws {SourceExecutionHostValidationError} 当 providerKey 不是非空字符串时抛出。
 */
function normalizeProviderKey(providerKey) {
  // 条件分支: providerKey 不是字符串时进入。
  // 执行内容: 拒绝对象、数字或 Symbol 隐式转换成注册键。
  if (typeof providerKey !== 'string') {
    throw new SourceExecutionHostValidationError('providerKey 必须是非空字符串');
  }

  // 类型: string。
  // 作用: 去除用户不可见的首尾空白，避免相同视觉键产生两条注册记录。
  const normalizedProviderKey = providerKey.trim();

  // 条件分支: 规范化结果为空时进入。
  // 执行内容: 阻止空键进入可信工厂索引。
  if (!normalizedProviderKey) {
    throw new SourceExecutionHostValidationError('providerKey 必须是非空字符串');
  }

  // 返回值类型: string。
  // 作用: 返回可安全用作 Map 键和错误定位的工厂身份。
  return normalizedProviderKey;
}

/**
 * 校验并捕获可信 Provider 工厂门面。
 * 纯函数: 返回冻结新对象，不修改或直接保存调用方工厂对象。
 * 身份边界: providerFactory.providerKey 必须与注册参数相同。
 * 变更边界: supports/create 在注册时绑定，外部后续替换原对象字段不会改变已注册行为。
 *
 * @param {string} providerKey 已规范化注册键。
 * @param {*} providerFactory 待注册可信工厂。
 * @returns {object} 只包含 providerKey、supports 和 create 的冻结工厂门面。
 * @throws {SourceExecutionHostValidationError} 当工厂字段、身份或方法不符合契约时抛出。
 */
function createProviderFactoryFacade(providerKey, providerFactory) {
  // 条件分支: 工厂不是非数组对象时进入。
  // 执行内容: 阻止 null、数组和原始值进入字段检查。
  if (!providerFactory || typeof providerFactory !== 'object' || Array.isArray(providerFactory)) {
    throw new SourceExecutionHostValidationError('providerFactory 必须是对象');
  }

  // 类型: Array<string|symbol>。
  // 作用: 读取全部自有字段，Symbol 和额外能力也必须被精确字段门禁发现。
  const factoryFields = Reflect.ownKeys(providerFactory);

  // 类型: boolean。
  // 作用: 判断字段数量和名称是否与可信工厂契约完全一致。
  const hasExactFields = factoryFields.length === PROVIDER_FACTORY_FIELDS.length
    && PROVIDER_FACTORY_FIELDS.every(field => factoryFields.includes(field));

  // 条件分支: 工厂缺少字段、包含额外字段或使用 Symbol 时进入。
  // 执行内容: 拒绝 scriptContent、Repository、Context 或任意隐藏能力夹带到工厂门面。
  if (!hasExactFields) {
    throw new SourceExecutionHostValidationError('providerFactory 字段必须完整且不能包含额外字段');
  }

  // 类型: string。
  // 作用: 校验工厂自报身份，供注册参数执行严格一致比较。
  const factoryProviderKey = normalizeProviderKey(providerFactory.providerKey);

  // 条件分支: 工厂身份和注册参数不一致时进入。
  // 执行内容: 拒绝一个工厂被别名注册为多个执行入口。
  if (factoryProviderKey !== providerKey) {
    throw new SourceExecutionHostValidationError('providerFactory.providerKey 与注册键不一致');
  }

  // 条件分支: supports 或 create 不是函数时进入。
  // 执行内容: 阻止 Host 在门禁或实例创建时遇到原生 TypeError。
  if (typeof providerFactory.supports !== 'function' || typeof providerFactory.create !== 'function') {
    throw new SourceExecutionHostValidationError('providerFactory.supports 和 create 必须是函数');
  }

  // 类型: Function。
  // 作用: 注册时绑定 supports，外部替换原对象字段后已注册门禁仍保持不变。
  const supports = providerFactory.supports.bind(providerFactory);

  // 类型: Function。
  // 作用: 注册时绑定 create，外部替换原对象字段后实例创建行为不会漂移。
  const create = providerFactory.create.bind(providerFactory);

  // 返回值类型: object。
  // 作用: 返回只含三项受审能力的冻结门面，不共享原工厂根对象。
  return Object.freeze({
    // 类型: string。
    // 作用: 已规范化且与注册参数一致的可信工厂键。
    providerKey,

    // 类型: Function。
    // 作用: 判断 Definition 是否存在受审数据集，不创建 Provider。
    supports,

    // 类型: Function。
    // 作用: 创建标准 Provider；Host 仍负责 Context 和生命周期。
    create
  });
}

/**
 * 创建隔离可信 Provider 工厂注册表。
 * 副作用: 每个注册表实例创建一份私有 Map，后续只由返回门面的 register/remove 修改。
 * 状态边界: 私有 Map 只保存冻结工厂门面，外部不能获得或替换 Map。
 * 注册边界: 重复键明确失败，不允许后写覆盖。
 * 删除边界: remove 只删除工厂映射；调用方必须先通过 Host 证明没有受管实例依赖。
 *
 * @param {object} options 可选初始化参数。
 * @returns {object} 只包含 register、get、remove 和 listKeys 的冻结注册表。
 * @throws {SourceExecutionHostValidationError} 当 options 包含字段或不是普通空对象时抛出。
 */
export function createProviderFactoryRegistry(options = {}) {
  // 条件分支: options 不是非数组对象或包含任何字段时进入。
  // 执行内容: 当前注册表不接受脚本文本、默认工厂或外部 Map 注入。
  if (!options || typeof options !== 'object' || Array.isArray(options) || Reflect.ownKeys(options).length > 0) {
    throw new SourceExecutionHostValidationError('providerFactoryRegistry options 必须是空对象');
  }

  // 类型: Map<string, object>。
  // 作用: 私有保存 providerKey 到冻结工厂门面的唯一映射。
  const factoryByProviderKey = new Map();

  // 返回值类型: object。
  // 作用: 返回裁剪后的冻结注册表，外部不能访问私有 Map。
  return Object.freeze({
    /**
     * 注册一个项目内可信 Provider 工厂。
     * 副作用: 成功后向私有 Map 写入一条冻结门面；失败不修改已有映射。
     *
     * @param {*} providerKey 工厂唯一注册键。
     * @param {*} providerFactory 项目内受审工厂对象。
     * @returns {object} 已注册冻结工厂门面。
     * @throws {SourceExecutionHostConflictError} 当 providerKey 已注册时抛出。
     * @throws {SourceExecutionHostValidationError} 当输入不符合工厂契约时抛出。
     */
    register(providerKey, providerFactory) {
      // 类型: string。
      // 作用: 规范化注册键，保证查询、删除和列表使用同一身份。
      const safeProviderKey = normalizeProviderKey(providerKey);

      // 条件分支: 私有 Map 已包含该键时进入。
      // 执行内容: 拒绝覆盖已有受审工厂，避免运行中 providerKey 含义变化。
      if (factoryByProviderKey.has(safeProviderKey)) {
        throw new SourceExecutionHostConflictError(`Provider 工厂已经注册: ${safeProviderKey}`);
      }

      // 类型: object。
      // 作用: 校验并捕获冻结工厂门面，未通过前不写私有 Map。
      const factoryFacade = createProviderFactoryFacade(safeProviderKey, providerFactory);

      // 副作用: 把通过完整校验的冻结门面写入私有 Map。
      // 影响范围: 当前注册表实例，后续 Host 可以按相同键读取。
      factoryByProviderKey.set(safeProviderKey, factoryFacade);

      // 返回值类型: object。
      // 作用: 返回实际保存的冻结门面，调用方不能修改注册内容。
      return factoryFacade;
    },

    /**
     * 查询一个可信 Provider 工厂。
     * 纯函数: 只读取私有 Map，不修改注册状态。
     *
     * @param {*} providerKey 工厂唯一注册键。
     * @returns {object|null} 匹配冻结工厂门面；未注册时返回 null。
     */
    get(providerKey) {
      // 类型: string。
      // 作用: 使用与注册相同的规范化规则定位工厂。
      const safeProviderKey = normalizeProviderKey(providerKey);

      // 返回值类型: object|null。
      // 作用: 返回冻结门面或明确 null，不执行脚本文本或来源类型推断。
      return factoryByProviderKey.get(safeProviderKey) || null;
    },

    /**
     * 删除一个可信 Provider 工厂映射。
     * 副作用: 只修改当前注册表私有 Map；不会停止或释放 Host 实例。
     *
     * @param {*} providerKey 工厂唯一注册键。
     * @returns {boolean} true 表示本次删除了映射；false 表示原本不存在。
     */
    remove(providerKey) {
      // 类型: string。
      // 作用: 使用与注册相同的规范化规则定位待删除键。
      const safeProviderKey = normalizeProviderKey(providerKey);

      // 返回值类型: boolean。
      // 作用: 返回 Map.delete 的真实结果，不伪造成功。
      return factoryByProviderKey.delete(safeProviderKey);
    },

    /**
     * 读取全部可信工厂键。
     * 纯函数: 创建并冻结新数组，不暴露私有 Map iterator 或共享列表。
     *
     * @returns {Array<string>} 按注册顺序排列的冻结 providerKey 数组。
     */
    listKeys() {
      // 返回值类型: Array<string>。
      // 作用: 复制并冻结当前键列表，外部数组操作不能改变注册表。
      return Object.freeze([...factoryByProviderKey.keys()]);
    }
  });
}
