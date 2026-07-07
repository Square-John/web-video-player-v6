/*
  mockSourceProvider.js 模块说明

  - 文件职责:
      提供 当前项目 统一数据主干的 mock 数据源 provider。
      接收 SourceDataRequest，读取 mock-source.mock.js，并返回标准 SourceDataResponse。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      mockSourceData: 自定义数据，集中式 mock 数据源数据对象。
      createListSourceDataResponse/createItemSourceDataResponse: 自定义工具函数，创建标准数据源响应。

  - 模块级常量:
      HOME_MODULE_KEYS: Array<string>，首页允许请求的数据块名称。
      mockSourceProvider: object，mock 数据源 provider。

  - 模块级变量:
      无

  - 模块级辅助函数:
      getContentItemById(contentId)
          - params:
              -- contentId: string，内容唯一标识。
          - return:
              object|null，匹配到的 ContentItem 或 null。
          - description:
              从集中式 mock 内容池中读取单条内容。
      getContentItemsByIds(contentIds)
          - params:
              -- contentIds: Array<string>，内容 id 列表。
          - return:
              Array<object>，匹配到的 ContentItem 列表。
          - description:
              按页面数据块引用关系批量读取内容对象。
      applyRanking(items)
          - params:
              -- items: Array<object>，原始内容列表。
          - return:
              Array<object>，补齐 rank 的内容列表。
          - description:
              为排行榜数据块生成稳定 rank 字段，不修改原始内容对象。
      getMockListPageCandidates(pageKey)
          - params:
              -- pageKey: string，列表页面名称。
          - return:
              Array<object>，当前页面完整候选内容数组。
          - description:
              读取电影页、电视剧页或搜索页的全量候选内容，供筛选元数据代理和列表过滤逻辑复用。
      getSearchItems(request)
          - params:
              -- request: object，标准 SourceDataRequest。
          - return:
              Array<object>，搜索结果候选内容列表。
          - description:
              根据 keyword 过滤 mock 搜索候选内容，模拟真实搜索数据源。
      filterListPageItems(pageKey, items, params)
          - params:
              -- pageKey: string，列表页面名称。
              -- items: Array<object>，完整候选内容数组。
              -- params: object，列表筛选和排序参数。
          - return:
              Array<object>，过滤和排序后的列表内容数组。
          - description:
              根据页面筛选参数对电影页或电视剧页候选内容做本地过滤和排序。
      fetchHomeModule(request)
          - params:
              -- request: object，标准 SourceDataRequest。
          - return:
              object，首页区域 SourceDataResponse。
          - description:
              根据 moduleKey 返回首页对应数据块。
      fetchListPage(request)
          - params:
              -- request: object，标准 SourceDataRequest。
          - return:
              object，电影页、电视剧页或搜索页 SourceDataResponse。
          - description:
              根据 pageKey 返回单列表页面数据。
      fetchSingleContentPage(request)
          - params:
              -- request: object，标准 SourceDataRequest。
          - return:
              object，详情页或播放页 SourceDataResponse。
          - description:
              根据 params.contentId 返回增强版 ContentItem。

  - 模块级类:
      无

  - 对外导出:
      mockSourceProvider: object，mock 数据源 provider。
*/

// 导入来源: ../mock-source.mock。
// 导入内容: mockSourceData 集中式 mock 数据源数据对象。
// 文件作用: provider 根据请求从该数据对象读取内容池和页面数据块引用关系。
import { mockSourceData } from '../mock-source.mock.js';

import {
  // 导入来源: ../../utils/sourceDataResponse。
  // 导入内容: createListSourceDataResponse 列表响应创建函数。
  // 文件作用: 用于创建首页区域、电影页、电视剧页和搜索页的标准响应。
  createListSourceDataResponse,

  // 导入来源: ../../utils/sourceDataResponse。
  // 导入内容: createItemSourceDataResponse 单内容响应创建函数。
  // 文件作用: 用于创建详情页和播放页的标准响应。
  createItemSourceDataResponse
} from '../../utils/sourceDataResponse.js';

// 类型: Array<string>。
// 作用: 限定首页 provider 支持的数据块，避免传入未知 moduleKey 时静默返回错误数据。
const HOME_MODULE_KEYS = ['banners', 'hotMovies', 'hotTv', 'movieRanking', 'tvRanking'];

// 类型: Array<string>。
// 作用: 当前 mock provider 支持的列表页面名称，供候选内容读取和本地筛选逻辑复用。
const LIST_PAGE_KEYS = ['movie', 'tv', 'search'];

/**
 * 根据内容 id 读取 mock 内容对象。
 * 纯函数: 只读取 mockSourceData，不修改内容池。
 *
 * @param {string} contentId 内容唯一标识。
 * @returns {object|null} 匹配到的 ContentItem；不存在时返回 null。
 */
function getContentItemById(contentId) {
  // 类型: string。
  // 作用: 将空值兜底为空字符串，避免用 undefined 访问内容池。
  const safeContentId = contentId || '';

  // 返回值类型: object|null。
  // 作用: 返回匹配内容；找不到时返回 null，让详情和播放响应进入 empty 状态。
  return mockSourceData.contentItems[safeContentId] || null;
}

/**
 * 根据内容 id 列表读取 mock 内容对象列表。
 * 纯函数: 只读取 mockSourceData，不修改内容池或传入数组。
 *
 * @param {Array<string>} contentIds 内容 id 列表。
 * @returns {Array<object>} 匹配到的 ContentItem 列表。
 */
function getContentItemsByIds(contentIds) {
  // 类型: Array<string>。
  // 作用: 确保后续 map/filter 只处理数组，避免页面配置缺失时抛错。
  const safeContentIds = Array.isArray(contentIds) ? contentIds : [];

  // 返回值类型: Array<object>。
  // 作用: 批量读取内容对象，并过滤掉未命中的 id。
  return safeContentIds
    .map(contentId => getContentItemById(contentId))
    .filter(Boolean);
}

/**
 * 读取指定列表页面的完整候选内容数组。
 * 纯函数: 只读取 mockSourceData，不修改内容池或页面引用关系。
 *
 * @param {string} pageKey 列表页面名称，支持 movie、tv、search。
 * @returns {Array<object>} 当前页面完整候选内容数组。
 * @throws {Error} 当 pageKey 不属于支持范围时抛出。
 */
export function getMockListPageCandidates(pageKey) {
  // 类型: string。
  // 作用: 当前请求页面名称。
  const safePageKey = pageKey || '';

  // 条件分支: pageKey 不属于支持的列表页面时进入。
  // 执行内容: 抛出明确错误，避免筛选元数据代理读取未知页面。
  if (!LIST_PAGE_KEYS.includes(safePageKey)) {
    throw new Error(`mock 候选列表页面未实现: ${safePageKey || 'unknown'}`);
  }

  // 返回值类型: Array<object>。
  // 作用: 根据页面引用关系读取完整候选内容数组，不在这里做分页截取。
  return getContentItemsByIds(mockSourceData.pages[safePageKey]);
}

/**
 * 为排行榜列表补齐 rank。
 * 纯函数: 返回新对象列表，不修改原始 ContentItem。
 *
 * @param {Array<object>} items 原始内容列表。
 * @returns {Array<object>} 带稳定 rank 的内容列表。
 */
function applyRanking(items) {
  // 类型: Array<object>。
  // 作用: 确保排行榜输入是数组，避免 map 调用异常。
  const safeItems = Array.isArray(items) ? items : [];

  // 返回值类型: Array<object>。
  // 作用: 使用数组下标生成 rank，保留原有字段并避免污染内容池。
  return safeItems.map((item, index) => ({
    ...item,

    // 类型: number。
    // 作用: 当前榜单排名，从 1 开始，页面排行榜可直接展示。
    rank: index + 1
  }));
}

/**
 * 根据搜索请求过滤 mock 内容。
 * 纯函数: 只读取 mockSourceData 和 request，不修改外部状态。
 *
 * @param {object} request 标准 SourceDataRequest。
 * @param {object} request.params 请求参数集合。
 * @param {string} request.params.keyword 搜索关键词。
 * @returns {Array<object>} 搜索结果候选内容列表。
 */
function getSearchItems(request) {
  // 类型: object。
  // 作用: request.params 缺失时使用空对象兜底，避免读取 keyword 报错。
  const params = request && request.params ? request.params : {};

  // 类型: string。
  // 作用: 统一搜索关键词大小写和首尾空白，便于本地 mock 做包含匹配。
  const keyword = String(params.keyword || '').trim().toLowerCase();

  // 类型: Array<object>。
  // 作用: 搜索页候选内容列表，默认来自 mockSourceData.pages.search。
  const candidates = getMockListPageCandidates('search');

  // 条件分支: keyword 为空时进入。
  // 执行内容: 返回默认搜索候选列表，模拟未输入关键词时展示推荐结果。
  if (!keyword) {
    return candidates;
  }

  // 返回值类型: Array<object>。
  // 作用: 根据标题、简介、类型、内容语义标签、展示标签和地区做简单本地过滤，模拟真实搜索返回。
  return candidates.filter((item) => {
    // 类型: string。
    // 作用: 拼接当前内容可被搜索的文本字段，用于本地 includes 匹配。
    const searchableText = [
      item.title,
      item.description,
      item.year,
      item.area,
      item.language,
      item.type,
      ...(Array.isArray(item.genres) ? item.genres : []),
      ...(Array.isArray(item.tags) ? item.tags : []),
      ...(Array.isArray(item.displayTags) ? item.displayTags : [])
    ].join(' ').toLowerCase();

    // 返回值类型: boolean。
    // 作用: true 表示当前内容命中关键词，应出现在搜索结果中。
    return searchableText.includes(keyword);
  });
}

/**
 * 根据筛选参数过滤和排序列表页面内容。
 * 纯函数: 只读取 pageKey、items 和 params，不修改传入数组或内容对象。
 *
 * @param {string} pageKey 列表页面名称。
 * @param {Array<object>} items 当前页面完整候选内容数组。
 * @param {object} params 列表筛选和排序参数。
 * @param {string} params.genre 内容类型筛选值。
 * @param {string} params.area 地区筛选值。
 * @param {string} params.year 年份筛选值。
 * @param {string} params.sort 排序值。
 * @returns {Array<object>} 过滤和排序后的内容数组。
 */
function filterListPageItems(pageKey, items, params) {
  // 类型: Array<object>。
  // 作用: 非数组兜底为空数组，避免后续 filter 和 sort 调用异常。
  const safeItems = Array.isArray(items) ? items : [];

  // 类型: object。
  // 作用: params 缺失时使用空对象兜底，避免读取筛选字段时报错。
  const safeParams = params && typeof params === 'object' ? params : {};

  // 类型: string。
  // 作用: genre 当前页面动态筛选值，all 表示不过滤。
  const genre = String(safeParams.genre || 'all').trim();

  // 类型: string。
  // 作用: area 当前页面动态筛选值，all 表示不过滤。
  const area = String(safeParams.area || 'all').trim();

  // 类型: string。
  // 作用: year 当前页面动态筛选值，all 表示不过滤。
  const year = String(safeParams.year || 'all').trim();

  // 类型: string。
  // 作用: sort 当前页面排序值，没有时回到最新。
  const sort = String(safeParams.sort || 'latest').trim();

  // 类型: Array<object>。
  // 作用: 先复制一份数组，避免排序直接修改调用方传入的数组引用。
  let filteredItems = [...safeItems];

  // 条件分支: genre 存在有效筛选值时进入。
  // 执行内容: 只保留 genres 中包含当前类型值的内容。
  if (genre && genre !== 'all') {
    filteredItems = filteredItems.filter(item => Array.isArray(item.genres) && item.genres.includes(genre));
  }

  // 条件分支: area 存在有效筛选值时进入。
  // 执行内容: 只保留地区字段和当前筛选值完全一致的内容。
  if (area && area !== 'all') {
    filteredItems = filteredItems.filter(item => String(item.area || '').trim() === area);
  }

  // 条件分支: year 存在有效筛选值时进入。
  // 执行内容: 只保留年份字段和当前筛选值完全一致的内容。
  if (year && year !== 'all') {
    filteredItems = filteredItems.filter(item => String(item.year || '').trim() === year);
  }

  // 条件分支: 当前排序值为评分时进入。
  // 执行内容: 按 score 降序、rank 升序排序。
  if (sort === 'score') {
    return filteredItems.sort((previousItem, nextItem) => {
      const previousScore = Number(previousItem.score || 0);
      const nextScore = Number(nextItem.score || 0);

      if (nextScore !== previousScore) {
        return nextScore - previousScore;
      }

      return Number(previousItem.rank || 0) - Number(nextItem.rank || 0);
    });
  }

  // 条件分支: 当前排序值为最热时进入。
  // 执行内容: 先按 displayTags 是否包含“热”排序，再按 score 降序。
  if (sort === 'hot') {
    return filteredItems.sort((previousItem, nextItem) => {
      const previousHot = Array.isArray(previousItem.displayTags) && previousItem.displayTags.includes('热') ? 1 : 0;
      const nextHot = Array.isArray(nextItem.displayTags) && nextItem.displayTags.includes('热') ? 1 : 0;

      if (nextHot !== previousHot) {
        return nextHot - previousHot;
      }

      const previousScore = Number(previousItem.score || 0);
      const nextScore = Number(nextItem.score || 0);

      if (nextScore !== previousScore) {
        return nextScore - previousScore;
      }

      return Number(previousItem.rank || 0) - Number(nextItem.rank || 0);
    });
  }

  // 返回值类型: Array<object>。
  // 作用: 默认按年份降序排序；年份相同则继续按 rank 升序保持稳定顺序。
  return filteredItems.sort((previousItem, nextItem) => {
    const previousYear = Number(previousItem.year || 0);
    const nextYear = Number(nextItem.year || 0);

    if (nextYear !== previousYear) {
      return nextYear - previousYear;
    }

    return Number(previousItem.rank || 0) - Number(nextItem.rank || 0);
  });
}

/**
 * 返回首页指定数据块响应。
 * 纯函数: 只根据 request 和 mockSourceData 创建响应，不修改外部状态。
 *
 * @param {object} request 标准 SourceDataRequest。
 * @param {string} request.moduleKey 首页数据块名称。
 * @returns {object} 首页数据块 SourceDataResponse。
 * @throws {Error} 当 moduleKey 不属于首页支持范围时抛出。
 */
function fetchHomeModule(request) {
  // 类型: string。
  // 作用: 当前首页请求的数据块名称，例如 banners 或 hotMovies。
  const moduleKey = request.moduleKey || '';

  // 条件分支: moduleKey 不在首页允许列表中时进入。
  // 执行内容: 抛出明确错误，避免返回错误数据块导致页面误判。
  if (!HOME_MODULE_KEYS.includes(moduleKey)) {
    throw new Error(`mock 首页数据块未实现: ${moduleKey}`);
  }

  // 类型: Array<string>。
  // 作用: 当前首页数据块引用的内容 id 列表。
  const contentIds = mockSourceData.pages.home[moduleKey];

  // 类型: Array<object>。
  // 作用: 根据内容 id 列表读取当前数据块内容。
  const items = getContentItemsByIds(contentIds);

  // 类型: Array<object>。
  // 作用: 排行榜数据块需要补齐 rank；普通首页数据块保留原内容。
  const responseItems = moduleKey.includes('Ranking') ? applyRanking(items) : items;

  // 返回值类型: object。
  // 作用: 返回首页区域标准响应，后续写入 pages.home[moduleKey]。
  return createListSourceDataResponse({
    request,
    items: responseItems,
    message: `mock 首页 ${moduleKey} 数据已返回`
  });
}

/**
 * 返回单列表页面响应。
 * 纯函数: 只根据 request 和 mockSourceData 创建响应，不修改外部状态。
 *
 * @param {object} request 标准 SourceDataRequest。
 * @param {string} request.pageKey 页面名称，支持 movie、tv、search。
 * @returns {object} 单列表页面 SourceDataResponse。
 * @throws {Error} 当 pageKey 不属于支持范围时抛出。
 */
function fetchListPage(request) {
  // 类型: string。
  // 作用: 当前请求页面名称。
  const pageKey = request.pageKey || '';

  // 条件分支: 搜索页请求时进入。
  // 执行内容: 根据关键词过滤搜索候选内容。
  if (pageKey === 'search') {
    return createListSourceDataResponse({
      request,
      items: getSearchItems(request),
      message: 'mock 搜索结果数据已返回'
    });
  }

  // 条件分支: movie 或 tv 页面请求时进入。
  // 执行内容: 从页面引用关系读取对应内容列表。
  if (pageKey === 'movie' || pageKey === 'tv') {
    // 类型: Array<object>。
    // 作用: 当前目录页完整候选内容列表。
    const items = getMockListPageCandidates(pageKey);

    // 类型: Array<object>。
    // 作用: 根据目录页筛选和排序参数生成当前请求实际候选列表，再交给响应工具做分页截取。
    const filteredItems = filterListPageItems(pageKey, items, request.params);

    // 返回值类型: object。
    // 作用: 返回目录页标准响应，后续写入 pages.movie 或 pages.tv。
    return createListSourceDataResponse({
      request,
      items: filteredItems,
      message: `mock ${pageKey} 列表数据已返回`
    });
  }

  // 错误类型: Error。
  // 作用: 明确提示当前 provider 没有实现该列表页面。
  throw new Error(`mock 列表页面未实现: ${pageKey}`);
}

/**
 * 返回详情页或播放页单内容响应。
 * 纯函数: 只根据 request 和 mockSourceData 创建响应，不修改外部状态。
 *
 * @param {object} request 标准 SourceDataRequest。
 * @param {object} request.params 请求参数集合。
 * @param {string} request.params.contentId 当前内容 id。
 * @returns {object} 单内容 SourceDataResponse。
 */
function fetchSingleContentPage(request) {
  // 类型: object。
  // 作用: request.params 缺失时使用空对象兜底，避免读取 contentId 报错。
  const params = request && request.params ? request.params : {};

  // 类型: object|null。
  // 作用: 当前详情或播放目标内容，找不到时为 null。
  const item = getContentItemById(params.contentId);

  // 返回值类型: object。
  // 作用: 返回单内容标准响应，后续写入 detail/player 的 currentKey。
  return createItemSourceDataResponse({
    request,
    item,
    message: `mock ${request.pageKey} 内容数据已返回`
  });
}

// 类型: object。
// 作用: mock 数据源 provider，模拟后续外部数据源脚本的 fetchData(request) 能力。
export const mockSourceProvider = {
  // 类型: string。
  // 作用: provider 唯一标识，应和 mockSourceData.source.id 保持一致。
  id: mockSourceData.source.id,

  // 类型: string。
  // 作用: provider 展示名称，后续源管理界面可使用。
  name: mockSourceData.source.name,

  /**
   * 根据标准请求返回标准响应。
   * 纯函数: 当前 mock provider 只读取本地数据并返回响应，不发起网络请求。
   * 成功路径: 返回 SourceDataResponse。
   * 失败路径: 请求 pageKey 或 moduleKey 不受支持时抛出 Error。
   *
   * @param {object} request 标准 SourceDataRequest。
   * @param {string} request.sourceId 请求目标数据源 id。
   * @param {string} request.pageKey 请求目标页面。
   * @param {string} request.moduleKey 请求目标页面区域。
   * @param {object} request.params 请求参数集合。
   * @returns {Promise<object>} 标准 SourceDataResponse。
   * @throws {Error} 当 pageKey 或 moduleKey 不受支持时抛出。
   */
  async fetchData(request) {
    // 类型: object。
    // 作用: request 不是对象时使用空对象兜底，错误路径会给出清晰未实现提示。
    const safeRequest = request && typeof request === 'object' ? request : {};

    // 条件分支: 请求首页任一数据块时进入。
    // 执行内容: 根据 moduleKey 返回首页对应 PageBucket 响应。
    if (safeRequest.pageKey === 'home') {
      return fetchHomeModule(safeRequest);
    }

    // 条件分支: 请求电影页、电视剧页或搜索页时进入。
    // 执行内容: 返回对应单列表页面响应。
    if (safeRequest.pageKey === 'movie' || safeRequest.pageKey === 'tv' || safeRequest.pageKey === 'search') {
      return fetchListPage(safeRequest);
    }

    // 条件分支: 请求详情页或播放页时进入。
    // 执行内容: 返回增强版 ContentItem 单内容响应。
    if (safeRequest.pageKey === 'detail' || safeRequest.pageKey === 'player') {
      return fetchSingleContentPage(safeRequest);
    }

    // 错误类型: Error。
    // 作用: 明确提示当前 mock provider 没有实现该页面数据块。
    throw new Error(`mock 页面未实现: ${safeRequest.pageKey || 'unknown'}`);
  }
};

// 导出类型: default object。
// 导出内容: mock 数据源 provider。
// 外部调用方: 后续 sourceDataService。
// 使用场景: mock 阶段根据 SourceDataRequest 返回标准 SourceDataResponse。
export default mockSourceProvider;
