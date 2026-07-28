/*
  createIndexedDbSourceRepositories.js 模块说明

  - 文件职责:
      根据调用方显式创建的 BrowserPersistenceDatabase 装配三个 IndexedDB Repository 和一个原生 UnitOfWork。
      工厂不打开数据库、不读取默认种子、不创建 Memory 回退，也不向上层泄漏连接。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      IndexedDbSourcePackageRepository: 自定义适配器，创建 Package 仓。
      IndexedDbSourceDefinitionRepository: 自定义适配器，创建 Definition/Preferences 仓。
      IndexedDbSourceStorageRepository: 自定义适配器，创建 Storage 仓。
      IndexedDbSourceRepositoryUnitOfWork: 自定义协调器，创建四仓原生事务权威。

  - 模块级常量:
      FACTORY_OPTION_FIELDS: Array<string>，工厂允许的精确字段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeFactoryOptions(options): 校验工厂只接收 database 门面。

  - 模块级类:
      无

  - 对外导出:
      createIndexedDbSourceRepositories: Function，创建完整 IndexedDB 数据源 Repository 基础设施。
*/

// 导入来源: ./indexedDbSourcePackageRepository.js；导入内容: IndexedDbSourcePackageRepository；文件作用: 创建单仓 Package 适配器。
import { IndexedDbSourcePackageRepository } from './indexedDbSourcePackageRepository.js';

// 导入来源: ./indexedDbSourceDefinitionRepository.js；导入内容: IndexedDbSourceDefinitionRepository；文件作用: 创建单仓 Definition/Preferences 适配器。
import { IndexedDbSourceDefinitionRepository } from './indexedDbSourceDefinitionRepository.js';

// 导入来源: ./indexedDbSourceStorageRepository.js；导入内容: IndexedDbSourceStorageRepository；文件作用: 创建单仓五分区 Storage 适配器。
import { IndexedDbSourceStorageRepository } from './indexedDbSourceStorageRepository.js';

// 导入来源: ./indexedDbSourceRepositoryUnitOfWork.js；导入内容: IndexedDbSourceRepositoryUnitOfWork；文件作用: 创建跨仓原生事务协调器。
import { IndexedDbSourceRepositoryUnitOfWork } from './indexedDbSourceRepositoryUnitOfWork.js';

// 类型: Array<string>；作用: 工厂只接受唯一 database 字段，禁止隐式种子、模式或备用实现。
const FACTORY_OPTION_FIELDS = Object.freeze(['database']);

/**
 * 校验 IndexedDB Repository 工厂输入。
 * 纯函数: 不调用或修改数据库门面，只返回原始已验证引用。
 *
 * @param {*} options 工厂输入候选。
 * @returns {object} 只包含 database 的已验证普通对象。
 * @throws {TypeError} 当字段、门面或事务能力不符合契约时抛出。
 */
function normalizeFactoryOptions(options) {
  // 条件分支: options 不是普通对象时进入。
  // 执行内容: 在创建任何 Repository 前拒绝数组、null 和类实例。
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.getPrototypeOf(options) !== Object.prototype) {
    throw new TypeError('IndexedDB Repository 工厂 options 必须是普通对象');
  }
  // 类型: Array<string>；作用: 检查缺失 database 和未进入契约的影子配置。
  const optionFields = Object.keys(options);
  // 条件分支: 字段数量或名称不等于唯一 database 时进入。
  // 执行内容: 拒绝工厂读取种子、模式或 fallback 选项。
  if (optionFields.length !== FACTORY_OPTION_FIELDS.length
    || optionFields.some(field => !FACTORY_OPTION_FIELDS.includes(field))) {
    throw new TypeError('IndexedDB Repository 工厂必须只提供 database');
  }
  // 条件分支: database 缺少受控只读或读写事务时进入。
  // 执行内容: 阻止原生 IDBDatabase 或不完整替身绕过统一门面。
  if (!options.database || typeof options.database !== 'object'
    || typeof options.database.runReadonly !== 'function'
    || typeof options.database.runReadwrite !== 'function') {
    throw new TypeError('IndexedDB Repository 工厂 database 无效');
  }
  return options;
}

/**
 * 创建完整 IndexedDB 数据源 Repository 基础设施。
 * 副作用: 只创建三个单仓适配器和一个 UnitOfWork，不打开连接、不播种、不写数据库。
 * 成功路径: 四个对象共享调用方显式提供的同一 BrowserPersistenceDatabase。
 * 失败路径: options 或门面无效时同步抛 TypeError，不返回部分基础设施。
 *
 * @param {object} options 工厂输入。
 * @param {object} options.database 已由组合层创建并初始化的 BrowserPersistenceDatabase。
 * @returns {object} Package、Definition、Storage Repository 和 UnitOfWork。
 */
export function createIndexedDbSourceRepositories(options) {
  // 类型: object；作用: 在创建任何适配器前确认唯一数据库门面依赖。
  const normalizedOptions = normalizeFactoryOptions(options);
  // 类型: IndexedDbSourcePackageRepository；作用: 提供普通单仓 Package CRUD。
  const packageRepository = new IndexedDbSourcePackageRepository(normalizedOptions);
  // 类型: IndexedDbSourceDefinitionRepository；作用: 提供普通 Definition/Preferences CRUD。
  const definitionRepository = new IndexedDbSourceDefinitionRepository(normalizedOptions);
  // 类型: IndexedDbSourceStorageRepository；作用: 提供普通五分区 Storage CRUD 与容量查询。
  const storageRepository = new IndexedDbSourceStorageRepository(normalizedOptions);
  // 类型: IndexedDbSourceRepositoryUnitOfWork；作用: 提供同一数据库四仓原生事务。
  const unitOfWork = new IndexedDbSourceRepositoryUnitOfWork(normalizedOptions.database);

  return {
    packageRepository,
    definitionRepository,
    storageRepository,
    unitOfWork
  };
}
