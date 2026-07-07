/*
  siteFilterStore.js 模块说明

  - 文件职责:
      提供 当前项目 筛选元数据主干的本地运行态存储对象。
      供 sourceFilterService.js 写入电影页、电视剧页和搜索页的筛选元数据响应，后续供 CatalogFilterBar 渲染使用。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      MOCK_SOURCE_ID: 自定义数据，提供 mock 阶段默认数据源 id。

  - 模块级常量:
      FILTER_PAGE_KEYS: Array<string>，支持筛选元数据的页面名称。

  - 模块级变量:
      siteFilterStore: object，全站筛选元数据运行态存储对象。

  - 模块级辅助函数:
      createDefaultFilterRequest(pageKey)
          - params:
              -- pageKey: string，当前筛选元数据所属页面。
          - return:
              object，默认 SourceFilterMetaRequest。
          - description:
              为尚未发起真实请求的筛选桶补齐稳定 request 结构。
      createFilterBucket(pageKey)
          - params:
              -- pageKey: string，当前筛选元数据所属页面。
          - return:
              object，标准筛选元数据桶。
          - description:
              创建电影页、电视剧页或搜索页的筛选元数据桶。
      createFilterState()
          - params:
              无
          - return:
              object，全站筛选元数据桶集合。
          - description:
              初始化 movie、tv 和 search 三个筛选元数据桶。
      getResponseFetchedAt(response)
          - params:
              -- response: object，SourceFilterMetaResponse。
          - return:
              string，响应时间。
          - description:
              从响应 meta 中读取 fetchedAt，缺失时使用当前时间兜底。
      assertSupportedFilterResponse(response)
          - params:
              -- response: object，SourceFilterMetaResponse。
          - return:
              object，校验后的 SourceFilterMetaResponse。
          - description:
              在写入 store 前校验响应基本结构，避免未知 pageKey 污染筛选元数据存储。

  - 模块级类:
      无

  - 对外导出:
      FILTER_PAGE_KEYS: Array<string>，支持筛选元数据的页面名称。
      createFilterBucket: Function，创建标准筛选元数据桶。
      siteFilterStore: object，全站筛选元数据运行态存储对象。
      resetSiteFilterStore: Function，重置筛选元数据存储。
      getFilterBucket: Function，读取指定筛选元数据桶。
      commitSourceFilterMetaResponse: Function，写入标准筛选元数据响应。
*/

// 导入来源: ../data/mock-source.mock。
// 导入内容: MOCK_SOURCE_ID 默认 mock 数据源 id。
// 文件作用: 用于初始化本地筛选元数据 store 的默认数据源上下文。
import { MOCK_SOURCE_ID } from '../data/mock-source.mock.js';

// 类型: Array<string>。
// 作用: 电影页、电视剧页和搜索页都可能需要动态筛选元数据。
export const FILTER_PAGE_KEYS = ['movie', 'tv', 'search'];

/**
 * 创建默认筛选元数据请求对象。
 * 纯函数: 只根据 pageKey 返回新对象，不读取或修改外部状态。
 *
 * @param {string} pageKey 当前筛选元数据所属页面。
 * @returns {object} 默认 SourceFilterMetaRequest。
 */
function createDefaultFilterRequest(pageKey) {
  // 返回值类型: object。
  // 作用: 为筛选元数据桶提供稳定 request 结构，后续外部请求刷新时会整体替换。
  return {
    sourceId: MOCK_SOURCE_ID,
    pageKey: pageKey || '',
    params: {}
  };
}

/**
 * 创建筛选元数据桶。
 * 纯函数: 每次调用都返回新的桶对象，不共享 request 和 groups 引用。
 *
 * @param {string} pageKey 当前筛选元数据所属页面。
 * @returns {object} 标准筛选元数据桶。
 */
export function createFilterBucket(pageKey) {
  // 返回值类型: object。
  // 作用: 提供稳定的筛选元数据结构，页面后续只需要读取 groups 渲染筛选按钮。
  return {
    request: createDefaultFilterRequest(pageKey),
    groups: [],
    updatedAt: ''
  };
}

/**
 * 创建全站筛选元数据状态。
 * 纯函数: 每次调用都返回一套新的筛选元数据桶集合。
 *
 * @returns {object} 全站筛选元数据桶集合。
 */
function createFilterState() {
  // 返回值类型: object。
  // 作用: 按页面切分筛选元数据，避免不同页面的筛选字段混在一起。
  return {
    movie: createFilterBucket('movie'),
    tv: createFilterBucket('tv'),
    search: createFilterBucket('search')
  };
}

// 类型: object。
// 作用: 全站筛选元数据运行态存储对象。
// 字段: activeSourceId，string，当前默认数据源 id。
// 字段: pages，object，按页面切分的筛选元数据桶集合。
export const siteFilterStore = {
  activeSourceId: MOCK_SOURCE_ID,
  pages: createFilterState()
};

/**
 * 重置全站筛选元数据存储。
 * 副作用: 原地覆盖 siteFilterStore 的 activeSourceId 和 pages。
 *
 * @returns {object} 重置后的 siteFilterStore。
 */
export function resetSiteFilterStore() {
  // 副作用: 恢复当前默认数据源 id。
  // 影响范围: 后续未显式传 sourceId 的筛选元数据请求会回到 mock 数据源。
  siteFilterStore.activeSourceId = MOCK_SOURCE_ID;

  // 副作用: 重建所有筛选元数据桶。
  // 影响范围: 清空已写入的 groups 和更新时间。
  siteFilterStore.pages = createFilterState();

  // 返回值类型: object。
  // 作用: 方便测试或调用方读取重置后的筛选元数据 store。
  return siteFilterStore;
}

/**
 * 读取指定筛选元数据桶。
 * 纯函数: 只根据 pageKey 返回已有数据桶引用，不修改 store。
 *
 * @param {string} pageKey 页面名称，支持 movie、tv、search。
 * @returns {object} 匹配到的筛选元数据桶。
 * @throws {Error} 当 pageKey 不受支持时抛出。
 */
export function getFilterBucket(pageKey) {
  // 条件分支: pageKey 属于支持的筛选页面时进入。
  // 执行内容: 返回目标页面筛选元数据桶。
  if (FILTER_PAGE_KEYS.includes(pageKey)) {
    return siteFilterStore.pages[pageKey];
  }

  // 错误类型: Error。
  // 作用: 阻止未知页面写入或读取筛选元数据。
  throw new Error(`未知筛选元数据桶: ${pageKey || 'empty'}`);
}

/**
 * 从响应对象读取更新时间。
 * 纯函数: 除在缺失 fetchedAt 时读取当前时间外，不修改外部状态。
 *
 * @param {object} response 标准 SourceFilterMetaResponse。
 * @returns {string} 响应时间。
 */
function getResponseFetchedAt(response) {
  // 类型: object。
  // 作用: meta 缺失时使用空对象兜底，避免读取 fetchedAt 报错。
  const meta = response && response.meta && typeof response.meta === 'object' ? response.meta : {};

  // 返回值类型: string。
  // 作用: 优先使用 provider 响应时间；缺失时记录当前写入时间。
  return meta.fetchedAt || new Date().toISOString();
}

/**
 * 校验筛选元数据响应基础结构。
 * 纯函数: 只读取 response 字段，不修改传入对象或 store。
 *
 * @param {object} response 待写入的 SourceFilterMetaResponse。
 * @returns {object} 校验通过的 SourceFilterMetaResponse。
 * @throws {Error} 当响应结构不完整或 pageKey 未纳入 store 时抛出。
 */
function assertSupportedFilterResponse(response) {
  // 条件分支: response 不是对象时进入。
  // 执行内容: 抛出错误，阻止无效响应写入筛选元数据 store。
  if (!response || typeof response !== 'object') {
    throw new Error('SourceFilterMetaResponse 必须是对象');
  }

  // 类型: string。
  // 作用: 当前响应目标页面，决定写入哪个筛选元数据桶。
  const pageKey = response.pageKey || '';

  // 条件分支: pageKey 属于支持的筛选页面时进入。
  // 执行内容: 直接返回响应对象，交给后续提交函数继续处理。
  if (FILTER_PAGE_KEYS.includes(pageKey)) {
    return response;
  }

  // 错误类型: Error。
  // 作用: 阻止未知页面响应写入筛选元数据 store，避免数据结构失控。
  throw new Error(`SourceFilterMetaResponse.pageKey 未纳入 store: ${pageKey || 'empty'}`);
}

/**
 * 写入标准筛选元数据响应。
 * 副作用: 原地覆盖目标筛选元数据桶的 request、groups 和 updatedAt。
 *
 * @param {object} response 标准 SourceFilterMetaResponse。
 * @returns {object} 写入后的筛选元数据桶。
 */
export function commitSourceFilterMetaResponse(response) {
  // 类型: object。
  // 作用: 校验响应对象，避免无效数据写入全站筛选元数据状态。
  const safeResponse = assertSupportedFilterResponse(response);

  // 类型: object。
  // 作用: 根据 pageKey 定位目标筛选元数据桶。
  const bucket = getFilterBucket(safeResponse.pageKey);

  // 副作用: 保存当前桶最后一次请求。
  // 影响范围: 页面刷新当前筛选字段时可复用 sourceId 和 pageKey。
  bucket.request = safeResponse.request || createDefaultFilterRequest(safeResponse.pageKey);

  // 副作用: 保存当前页面的筛选组数组。
  // 影响范围: CatalogFilterBar 后续直接读取该字段渲染筛选按钮。
  bucket.groups = Array.isArray(safeResponse.groups) ? safeResponse.groups : [];

  // 副作用: 保存当前桶最后更新时间。
  // 影响范围: 调试筛选元数据链路时可读取该时间。
  bucket.updatedAt = getResponseFetchedAt(safeResponse);

  // 返回值类型: object。
  // 作用: 返回写入后的目标桶，方便 service 或测试直接断言。
  return bucket;
}

// 导出类型: default object。
// 导出内容: 全站筛选元数据运行态存储对象。
// 外部调用方: 页面组件、sourceFilterService 和后续调试面板。
// 使用场景: 读取或观察全站筛选元数据桶。
export default siteFilterStore;
