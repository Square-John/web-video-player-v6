/*
  contentItemResolver.js 模块说明

  - 文件职责:
      提供内容引用补全服务。
      根据 sourceId + contentId 优先从 siteContentStore.entities.contentItems 读取 ContentItem。
      实体池未命中时使用后台 detail 请求独立采用实体，不占用任何页面请求事务。
      批量入口按 contentKey 去重后并发补全不同内容。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      getContentItemById: 自定义 store selector，根据 sourceId + contentId 读取实体池内容。
      requestSourceContentItem: 自定义服务，复用 Runtime 但只采用后台实体。
      buildContentKey: 自定义工具，生成批量补全去重键。

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

// 导入来源: ./sourceDataService.js；导入内容: requestSourceContentItem；文件作用: 未命中时通过后台入口请求并独立采用实体。
import { requestSourceContentItem } from './sourceDataService.js';

// 导入来源: ../utils/contentKeys.js；导入内容: buildContentKey；文件作用: 批量补全按标准实体身份去重请求。
import { buildContentKey } from '../utils/contentKeys.js';

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
 * 副作用: 实体池未命中时调用后台详情入口，并只写入 siteContentStore.entities.contentItems。
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

  // 异步调用: 复用 Runtime 的 detail 数据生产链，但由后台入口独立采用实体，不发布 detail 页面事务。
  // 成功结果: 直接返回已写入 entities.contentItems 的 ContentItem。
  // 失败结果: Provider 或实体采用失败由 catch 收敛为当前单条 null。
  try {
    return await requestSourceContentItem({
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

  // 类型: Map<string, object>；作用: 同一内容同时出现在收藏和多条历史时只请求一次，键顺序保留首次记录顺序。
  const uniqueRecords = new Map();
  safeRecords.forEach((record) => {
    // 类型: object；作用: 把记录或 ContentItem 统一为可生成 contentKey 的引用。
    const contentRef = normalizeContentRef(record);
    // 类型: string；作用: 使用正式实体键识别同源同内容重复引用，空值记录不进入请求集合。
    const contentKey = buildContentKey(contentRef.sourceId, contentRef.contentId);
    // 条件分支: 当前 key 有效且尚未登记时进入；执行内容: 保留首条引用并跳过后续重复项。
    if (contentKey && !uniqueRecords.has(contentKey)) uniqueRecords.set(contentKey, contentRef);
  });

  // 类型: Array<object|null>。
  // 作用: 不同 contentKey 并发请求并独立写实体池；不新增批量 Provider 契约，也不共享页面事务。
  const resolvedItems = await Promise.all([...uniqueRecords.values()].map(
    contentRef => resolveContentItem(contentRef)
  ));

  // 返回值类型: Array<object>。
  // 作用: 过滤补全失败的 null，只返回页面可渲染内容。
  return resolvedItems.filter(Boolean);
}
