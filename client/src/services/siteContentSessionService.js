/*
  siteContentSessionService.js 模块说明

  - 文件职责:
      在应用组合根注入标签页 Repository 后，协调 SiteContentStore 快照水合和成功响应后的快照替换。
      本服务不读取 window、Router、Provider 或用户内容，存储失败不会回滚页面内容提交。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      createSiteContentSessionStorage: 自定义 Repository 工厂，绑定调用方注入的 Storage-like 端口。
      siteContentStore exports: 自定义 Store 端口，创建受限快照并执行完整水合。

  - 模块级常量:
      无

  - 模块级变量:
      siteContentSessionStorage: Readonly<object>|null，当前运行时唯一标签页 Repository。

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      configureSiteContentSession: Function，注入当前标签页 Storage-like 端口。
      hydrateSiteContentSession: Function，在 Vue 挂载前水合一次内容 Store。
      persistSiteContentSession: Function，在成功页面响应采用后替换快照。
*/

// 导入来源: ../repositories/persistence/siteContentSessionStorage.js；导入内容: createSiteContentSessionStorage；文件作用: 创建注入式标签页 Repository。
import { createSiteContentSessionStorage } from '../repositories/persistence/siteContentSessionStorage.js';
import {
  // 导入来源: ../store/siteContentStore.js；导入内容: createSiteContentSessionSnapshot；文件作用: 导出白名单页面和引用实体。
  createSiteContentSessionSnapshot,
  // 导入来源: ../store/siteContentStore.js；导入内容: hydrateSiteContentSessionSnapshot；文件作用: 在全部校验完成后水合 Store。
  hydrateSiteContentSessionSnapshot
} from '../store/siteContentStore.js';

// 类型: Readonly<object>|null；生命周期: 当前页面运行时；作用: 保存组合根唯一注入的标签页 Repository。
let siteContentSessionStorage = null;

/**
 * 注入当前标签页 Storage-like 端口。
 * 副作用: 替换当前模块唯一 Repository；调用方负责只在应用启动时执行一次。
 *
 * @param {object} options 配置参数。
 * @param {object} options.storage 浏览器 sessionStorage 或测试夹具。
 * @returns {boolean} Repository 创建成功为 true，端口不可用为 false。
 */
export function configureSiteContentSession({ storage } = {}) {
  try {
    siteContentSessionStorage = createSiteContentSessionStorage({ storage });
    return true;
  } catch {
    siteContentSessionStorage = null;
    return false;
  }
}

/**
 * 在应用挂载前水合当前版本内容快照。
 * 副作用: 合法快照通过 Store 唯一水合端口采用；结构无效时只清理当前快照键。
 *
 * @returns {boolean} 快照成功水合为 true；缺失、不可用或无效为 false。
 */
export function hydrateSiteContentSession() {
  // 条件分支: 组合根没有成功配置 Repository 时进入；执行内容: 关闭水合增强并保持空 Store。
  if (!siteContentSessionStorage) return false;
  // 类型: object|null；作用: 读取当前版本快照，Repository 已收敛缺失、损坏和存储失败。
  const snapshot = siteContentSessionStorage.load();
  // 条件分支: 当前标签页没有可采用快照时进入；执行内容: 等待页面按 URL 正常请求。
  if (!snapshot) return false;
  // 类型: boolean；作用: 记录 Store 是否完整采用全部白名单桶和引用实体。
  const hydrated = hydrateSiteContentSessionSnapshot(snapshot);
  // 条件分支: Store 拒绝快照内部结构时进入；执行内容: 只清理本内容快照键，避免下次刷新重复失败。
  if (!hydrated) siteContentSessionStorage.clear();
  return hydrated;
}

/**
 * 用当前 Store 成功内容替换标签页快照。
 * 副作用: 导出受限快照并调用 Repository.replace；失败不修改 Store 或其它保存域。
 *
 * @returns {boolean} 快照成功写入为 true；Repository 未配置或写入失败为 false。
 */
export function persistSiteContentSession() {
  // 条件分支: 组合根没有可用 Repository 时进入；执行内容: 保留已成功 Store 提交并关闭保存增强。
  if (!siteContentSessionStorage) return false;
  try {
    return siteContentSessionStorage.replace(createSiteContentSessionSnapshot());
  } catch {
    return false;
  }
}
