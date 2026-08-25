/*
  contentRouteShellService.js 模块说明

  - 文件职责:
      为内容卡片到详情或播放路由提供唯一页面壳发布与读取端口。
      页面壳只进入共享 ContentEntityStore，不复制路由状态、不创建页面事务，也不取得 detail/player 增强字段权威。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      siteContentStore exports: 自定义 Store 端口，以 list 投影采用页面壳并按严格内容身份读取共享实体。

  - 模块级常量:
      无

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      stageContentRouteShell: Function，在 Router 导航前发布入口已经持有的标准 ContentItem。
      getContentRouteShell: Function，按 sourceId + contentId 读取当前最佳已知共享实体。
*/

import {
  // 导入来源: ../store/siteContentStore.js；导入内容: commitSourceContentShell；文件作用: 以 list 投影采用入口字段，不提升增强字段权威。
  commitSourceContentShell,
  // 导入来源: ../store/siteContentStore.js；导入内容: getContentItemById；文件作用: 页面按严格路由身份读取同一共享实体。
  getContentItemById
} from '../store/siteContentStore.js';

/**
 * 发布内容导航入口已经持有的页面壳。
 * 副作用: 仅以 list 投影合并到共享实体池；不修改 Router、页面桶、请求事务、导航上下文或持久化数据。
 * 成功路径: 标准 sourceId + id 形成唯一实体，较弱入口字段不能降级已有详情、目录和媒体。
 * 失败路径: 非对象或身份不完整返回 null，调用方继续由 Router 自身的身份门禁决定是否导航。
 *
 * @param {object} contentItem 卡片、轮播、排行或用户记录当前持有的标准 ContentItem。
 * @returns {object|null} 当前共享实体池采用后的最佳已知 ContentItem。
 */
export function stageContentRouteShell(contentItem) {
  // 类型: string；作用: 只接受标准对象自己的 sourceId，服务不读取活动源或页面上下文补身份。
  const sourceId = typeof contentItem?.sourceId === 'string' ? contentItem.sourceId.trim() : '';
  // 条件分支: 内容不是普通对象或缺少严格身份时进入；执行内容: 不产生实体或隐式源回退。
  if (!contentItem || typeof contentItem !== 'object' || Array.isArray(contentItem)
    || !sourceId || typeof contentItem.id !== 'string' || !contentItem.id.trim()) return null;
  return commitSourceContentShell(contentItem, sourceId);
}

/**
 * 读取严格内容路由当前可以展示的最佳已知页面壳。
 * 纯函数: 只读取共享实体池，不访问页面 currentKey、Router、Provider 或持久化仓库。
 * 成功路径: 返回列表、详情或播放投影信息不降级合并后的唯一 ContentItem。
 * 失败路径: 身份无效或实体未命中返回 null，页面显示目标加载壳而不是上一内容。
 *
 * @param {string} sourceId 严格路由中的数据源身份。
 * @param {string} contentId 严格路由中的内容身份。
 * @returns {object|null} 当前最佳已知 ContentItem。
 */
export function getContentRouteShell(sourceId, contentId) {
  return getContentItemById(sourceId, contentId);
}
