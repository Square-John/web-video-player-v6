/*
  createIndexedDbUserContentRepository.js 模块说明

  - 文件职责:
      根据调用方显式提供的 BrowserPersistenceDatabase 创建唯一用户内容 Repository。
      工厂不打开数据库、不读取种子，也不创建 Memory 或其他存储回退。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      IndexedDbUserContentRepository: 自定义适配器，提供用户内容四仓操作。

  - 模块级常量:
      FACTORY_FIELDS: Array<string>，工厂精确选项字段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      createIndexedDbUserContentRepository: Function，创建正式用户内容 Repository。
*/

// 导入来源: ./indexedDbUserContentRepository.js；导入内容: IndexedDbUserContentRepository；文件作用: 创建正式四仓适配器。
import { IndexedDbUserContentRepository } from './indexedDbUserContentRepository.js';

// 类型: Array<string>；作用: 工厂只接收同一数据库门面，拒绝种子、模式和备用实现字段。
const FACTORY_FIELDS = Object.freeze(['database']);

/**
 * 创建 IndexedDB 用户内容 Repository。
 * 副作用: 只创建适配器实例，不打开连接或访问 object store。
 * 失败路径: options 字段或数据库门面无效时同步抛 TypeError。
 *
 * @param {object} options 工厂选项。
 * @param {object} options.database BrowserPersistenceDatabase 门面。
 * @returns {IndexedDbUserContentRepository} 正式用户内容 Repository。
 */
export function createIndexedDbUserContentRepository(options) {
  // 条件分支: options 为空、数组、非对象或具有自定义原型时进入。
  // 执行内容: 在创建 Repository 前拒绝不稳定配置载体。
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.getPrototypeOf(options) !== Object.prototype) {
    throw new TypeError('用户内容 Repository 工厂 options 必须是普通对象');
  }
  // 类型: Array<string>；作用: 读取工厂实际选项，检查是否只有 database。
  const fields = Object.keys(options);
  // 条件分支: 字段数量或名称不等于唯一 database 时进入。
  // 执行内容: 拒绝种子、模式和备用实现等影子配置。
  if (fields.length !== FACTORY_FIELDS.length
    || fields.some(field => !FACTORY_FIELDS.includes(field))) {
    throw new TypeError('用户内容 Repository 工厂必须只提供 database');
  }
  return new IndexedDbUserContentRepository(options);
}
