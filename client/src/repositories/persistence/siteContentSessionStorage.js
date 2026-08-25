/*
  siteContentSessionStorage.js 模块说明

  - 文件职责:
      通过调用方注入的 Storage-like 端口读写唯一 SiteContentSessionSnapshot。
      本模块不读取 window，不解释页面、Provider 或 ContentItem，只负责版本边界、JSON 隔离和存储失败收敛。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      siteContentSession.config exports: 自定义配置，提供唯一存储键和当前 schema 版本。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      isPlainObject(value): 判断输入是否为普通对象。

  - 模块级类:
      无

  - 对外导出:
      createSiteContentSessionStorage: Function，创建当前标签页内容快照 Repository。
*/

import {
  // 导入来源: ../../config/siteContentSession.config.js；导入内容: SITE_CONTENT_SESSION_SCHEMA_VERSION；文件作用: 拒绝未知结构版本。
  SITE_CONTENT_SESSION_SCHEMA_VERSION,
  // 导入来源: ../../config/siteContentSession.config.js；导入内容: SITE_CONTENT_SESSION_SUPPORTED_SCHEMA_VERSIONS；文件作用: 允许 Store 对连续旧版本执行确定迁移。
  SITE_CONTENT_SESSION_SUPPORTED_SCHEMA_VERSIONS,
  // 导入来源: ../../config/siteContentSession.config.js；导入内容: SITE_CONTENT_SESSION_STORAGE_KEY；文件作用: 限制 Repository 只读写唯一会话键。
  SITE_CONTENT_SESSION_STORAGE_KEY
} from '../../config/siteContentSession.config.js';

/**
 * 判断输入是否为普通对象。
 * 纯函数: 不修改输入，不接受数组和 null。
 *
 * @param {*} value 待检查值。
 * @returns {boolean} 普通对象返回 true。
 */
function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/**
 * 创建注入式标签页内容快照 Repository。
 * 副作用: 公开方法只读写注入 storage 的唯一键；失败时不创建其它保存位置。
 *
 * @param {object} options 创建参数。
 * @param {object} options.storage 实现 getItem/setItem/removeItem 的 Storage-like 端口。
 * @returns {Readonly<object>} load/replace/clear 窄接口。
 * @throws {TypeError} storage 缺少必要端口时抛出。
 */
export function createSiteContentSessionStorage({ storage } = {}) {
  // 条件分支: 注入对象缺少任一 Storage-like 端口时进入；执行内容: 在创建 Repository 前失败关闭。
  if (!storage
    || typeof storage.getItem !== 'function'
    || typeof storage.setItem !== 'function'
    || typeof storage.removeItem !== 'function') {
    throw new TypeError('内容会话存储必须提供完整 Storage-like 端口');
  }

  /**
   * 读取当前版本快照。
   * 副作用: 损坏或未知版本时只清理本 Repository 唯一键；存储本身失败时保持原状。
   *
   * @returns {object|null} 解析后的隔离快照；缺失、损坏或不可用时为 null。
   */
  function load() {
    // 类型: string|null|undefined；作用: 保存唯一会话键原始文本，读取失败直接关闭本次恢复。
    let rawSnapshot;
    try {
      rawSnapshot = storage.getItem(SITE_CONTENT_SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
    // 条件分支: 唯一键不存在或为空文本时进入；执行内容: 按首次标签页会话返回无快照。
    if (rawSnapshot === null || rawSnapshot === '') return null;

    try {
      // 类型: *；作用: 保存 JSON 解析候选，随后只采用普通对象和当前版本。
      const snapshot = JSON.parse(rawSnapshot);
      // 条件分支: 候选不是普通对象或版本未知时进入；执行内容: 转入统一损坏清理路径。
      if (!isPlainObject(snapshot)
        || !SITE_CONTENT_SESSION_SUPPORTED_SCHEMA_VERSIONS.includes(snapshot.schemaVersion)) {
        throw new TypeError('内容会话快照版本或结构无效');
      }
      return snapshot;
    } catch {
      try {
        storage.removeItem(SITE_CONTENT_SESSION_STORAGE_KEY);
      } catch {
        // 存储清理失败只关闭本次恢复能力，不触碰其它保存域或阻止 URL 请求。
      }
      return null;
    }
  }

  /**
   * 原子替换当前标签页快照文本。
   * 副作用: 序列化成功后调用一次 setItem；失败不删除上一份合法快照。
   *
   * @param {object} snapshot Store 导出的当前版本快照。
   * @returns {boolean} 写入成功为 true，校验、序列化或存储失败为 false。
   */
  function replace(snapshot) {
    // 条件分支: Store 候选不是当前版本普通对象时进入；执行内容: 拒绝覆盖上一份合法快照。
    if (!isPlainObject(snapshot)
      || snapshot.schemaVersion !== SITE_CONTENT_SESSION_SCHEMA_VERSION) return false;
    try {
      // 类型: string；作用: 在 setItem 前完成完整序列化，序列化失败不会触碰存储。
      const serializedSnapshot = JSON.stringify(snapshot);
      storage.setItem(SITE_CONTENT_SESSION_STORAGE_KEY, serializedSnapshot);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清理当前内容快照键。
   * 副作用: 只调用注入 storage.removeItem，不修改其它会话或长期数据。
   *
   * @returns {boolean} 清理成功为 true，存储不可用为 false。
   */
  function clear() {
    try {
      storage.removeItem(SITE_CONTENT_SESSION_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  return Object.freeze({ load, replace, clear });
}
