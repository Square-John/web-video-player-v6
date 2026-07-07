/*
  contentItemResolver.js 模块说明

  - 文件职责:
      提供内容引用补全服务。
      根据 sourceId + contentId 优先从 siteContentStore.entities.contentItems 读取 ContentItem。
      实体池未命中时复用 detail 请求补全内容，再从实体池读取结果。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      getContentItemById: 自定义 store selector，根据 sourceId + contentId 读取实体池内容。
      requestSourceData: 自定义服务，复用内容数据请求链路请求详情页内容。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeContentRef(ref)
          - params:
              -- ref: object，内容引用对象。
          - return:
              object，标准内容引用。
          - description:
              将外部传入的 sourceId/contentId 或 ContentItem.id 统一成补全服务可识别字段。

  - 模块级类:
      无

  - 对外导出:
      resolveContentItem: Function，补全单条 ContentItem。
      resolveContentItems: Function，批量补全 ContentItem。
*/

// 导入来源: ../store/siteContentStore。
// 导入内容: getContentItemById 内容实体读取 selector。
// 文件作用: 优先从内容共享池读取已存在的 ContentItem，避免重复请求详情。
import { getContentItemById } from '../store/siteContentStore.js';

// 导入来源: ./sourceDataService。
// 导入内容: requestSourceData 内容数据请求服务。
// 文件作用: 当实体池没有目标内容时，复用 detail 数据块请求补全完整 ContentItem。
import { requestSourceData } from './sourceDataService.js';

/**
 * 标准化内容引用。
 * 纯函数: 只读取 ref，不修改传入对象。
 * 兜底策略: contentId 缺失时尝试读取 ref.id，兼容直接传入 ContentItem 的场景。
 *
 * @param {object} ref 内容引用或 ContentItem。
 * @param {string} ref.sourceId 内容所属数据源 id。
 * @param {string} ref.contentId 内容 id。
 * @param {string} ref.id ContentItem id 兜底字段。
 * @returns {object} 标准内容引用。
 * @returns {string} return.sourceId 内容所属数据源 id。
 * @returns {string} return.contentId 内容 id。
 */
function normalizeContentRef(ref) {
  // 类型: object。
  // 作用: ref 异常时使用空对象兜底，保证函数返回稳定空字段。
  const safeRef = ref && typeof ref === 'object' ? ref : {};

  // 返回值类型: object。
  // 作用: 返回补全服务使用的标准引用对象。
  return {
    // 类型: string。
    // 作用: 内容所属数据源 id，用于实体池定位和 detail 请求。
    sourceId: safeRef.sourceId || '',

    // 类型: string。
    // 作用: 内容 id，优先读取 contentId，兼容 ContentItem.id。
    contentId: safeRef.contentId || safeRef.id || ''
  };
}

/**
 * 补全单条 ContentItem。
 * 副作用: 实体池未命中时会调用 requestSourceData 发起 detail 请求，并写入 siteContentStore。
 * 成功路径: 返回实体池中匹配的 ContentItem。
 * 失败路径: sourceId/contentId 缺失、请求失败或请求后仍未命中时返回 null。
 *
 * @param {object} ref 内容引用或 ContentItem。
 * @param {string} ref.sourceId 内容所属数据源 id。
 * @param {string} ref.contentId 内容 id。
 * @param {string} ref.id ContentItem id 兜底字段。
 * @returns {Promise<object|null>} 补全后的 ContentItem；失败时返回 null。
 */
export async function resolveContentItem(ref) {
  // 类型: object。
  // 作用: 统一整理外部传入引用，避免调用方字段命名差异影响补全流程。
  const contentRef = normalizeContentRef(ref);

  // 条件分支: sourceId 或 contentId 缺失时进入。
  // 执行内容: 返回 null，避免发起无法定位内容的 detail 请求。
  if (!contentRef.sourceId || !contentRef.contentId) {
    return null;
  }

  // 类型: object|null。
  // 作用: 优先从内容实体共享池读取，命中时不再请求 provider。
  const cachedItem = getContentItemById(contentRef.sourceId, contentRef.contentId);

  // 条件分支: 共享池已经存在目标内容时进入。
  // 执行内容: 直接返回缓存内容，保持个人中心等引用场景加载轻量。
  if (cachedItem) {
    return cachedItem;
  }

  // 异步调用: 复用 detail 数据块请求目标内容。
  // 成功结果: sourceDataService 会把响应 ContentItem 写入 entities.contentItems。
  // 失败结果: provider 抛错或写入失败时由 catch 捕获并返回 null。
  try {
    await requestSourceData({
      sourceId: contentRef.sourceId,
      pageKey: 'detail',
      moduleKey: '',
      params: {
        contentId: contentRef.contentId
      }
    });
  } catch (error) {
    // 异常来源: 数据源 provider、sourceDataService 或 store 写入。
    // 处理策略: 内容补全失败不让个人中心整页崩溃，返回 null 交给调用方展示空态或兜底。
    return null;
  }

  // 返回值类型: object|null。
  // 作用: 请求完成后再次从实体池读取，仍未命中时返回 null。
  return getContentItemById(contentRef.sourceId, contentRef.contentId);
}

/**
 * 批量补全 ContentItem。
 * 副作用: 对未命中的引用逐条复用 detail 请求写入 siteContentStore。
 * 成功路径: 返回补全成功的 ContentItem 数组。
 * 失败路径: 单条失败只跳过该条，不阻断其它引用补全。
 *
 * @param {Array<object>} records 内容引用列表。
 * @returns {Promise<Array<object>>} 补全成功的 ContentItem 列表。
 */
export async function resolveContentItems(records) {
  // 类型: Array<object>。
  // 作用: 非数组输入兜底为空数组，保证批量补全流程稳定。
  const safeRecords = Array.isArray(records) ? records : [];

  // 类型: Array<object|null>。
  // 作用: 逐条补全内容；当前不新增批量 provider 契约，先复用单条 detail 请求。
  const resolvedItems = await Promise.all(safeRecords.map(record => resolveContentItem(record)));

  // 返回值类型: Array<object>。
  // 作用: 过滤补全失败的 null，只返回页面可渲染内容。
  return resolvedItems.filter(Boolean);
}
