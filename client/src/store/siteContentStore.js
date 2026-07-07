/*
  siteContentStore.js 模块说明

  - 文件职责:
      提供 当前项目 内容数据主干的本地运行态存储对象。
      供 sourceDataService.js 写入数据源响应，后续供首页、电影页、电视剧页、搜索页、详情页和播放页读取页面数据块。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      MOCK_SOURCE_ID/mockSourceData: 自定义数据，提供 mock 阶段默认数据源 id 和数据源基础信息。

  - 模块级常量:
      DEFAULT_PAGE: number，空桶默认页码。
      DEFAULT_PAGE_SIZE: number，空桶默认每页数量。
      HOME_BUCKET_KEYS: Array<string>，首页支持的数据桶名称。
      LIST_PAGE_KEYS: Array<string>，单列表页面名称。
      ITEM_PAGE_KEYS: Array<string>，单内容页面名称。

  - 模块级变量:
      siteContentStore: object，全站内容运行态存储对象。

  - 模块级辅助函数:
      createDefaultRequest(pageKey, moduleKey)
          - params:
              -- pageKey: string，当前数据桶所属页面。
              -- moduleKey: string，当前数据桶所属页面区域。
          - return:
              object，默认 SourceDataRequest。
          - description:
              为尚未发起真实请求的数据桶补齐稳定 request 结构。
      createDefaultPagination()
          - params:
              无
          - return:
              object，默认分页对象。
          - description:
              为列表数据桶提供空列表分页初始值。
      createPageBucket(pageKey, moduleKey)
          - params:
              -- pageKey: string，当前数据桶所属页面。
              -- moduleKey: string，当前数据桶所属页面区域。
          - return:
              object，标准 PageBucket。
          - description:
              创建可被页面直接读取的列表数据桶。
      createItemBucket(pageKey)
          - params:
              -- pageKey: string，当前单内容桶所属页面。
          - return:
              object，单内容页面数据桶。
          - description:
              创建详情页或播放页使用的 current 数据桶。
      createPagesState()
          - params:
              无
          - return:
              object，全站页面数据桶集合。
          - description:
              初始化首页区域、列表页和单内容页的存储结构。
      getResponseFetchedAt(response)
          - params:
              -- response: object，SourceDataResponse。
          - return:
              string，响应时间。
          - description:
              从响应 meta 中读取 fetchedAt，缺失时使用当前时间兜底。
      assertSupportedResponse(response)
          - params:
              -- response: object，SourceDataResponse。
          - return:
              object，校验后的 SourceDataResponse。
          - description:
              在写入 store 前校验响应基本结构，避免未知 pageKey 污染存储。

  - 模块级类:
      无

  - 对外导出:
      HOME_BUCKET_KEYS: Array<string>，首页数据桶名称。
      LIST_PAGE_KEYS: Array<string>，列表页名称。
      ITEM_PAGE_KEYS: Array<string>，单内容页名称。
      createPageBucket: Function，创建标准列表数据桶。
      siteContentStore: object，全站内容运行态存储对象。
      resetSiteContentStore: Function，重置内容存储。
      getPageBucket: Function，读取指定列表数据桶。
      getItemBucket: Function，读取指定单内容数据桶。
      commitSourceDataResponse: Function，写入标准数据源响应。
*/

// 导入来源: ../data/mock-source.mock。
// 导入内容: MOCK_SOURCE_ID 默认 mock 数据源 id，mockSourceData mock 数据源完整数据对象。
// 文件作用: 用于初始化本地内容 store 的默认数据源上下文。
import { MOCK_SOURCE_ID, mockSourceData } from '../data/mock-source.mock.js';

// 类型: number。
// 作用: 数据桶尚未请求前使用第一页作为默认页码，保证 pagination.page 始终可读。
const DEFAULT_PAGE = 1;

// 类型: number。
// 作用: 数据桶尚未请求前使用 20 条作为默认每页数量，和 SourceDataResponse 工具默认值保持一致。
const DEFAULT_PAGE_SIZE = 20;

// 类型: Array<string>。
// 作用: 首页数据被切分成五个独立数据桶，每个桶都能单独请求、写入和刷新。
export const HOME_BUCKET_KEYS = ['banners', 'hotMovies', 'hotTv', 'movieRanking', 'tvRanking'];

// 类型: Array<string>。
// 作用: 电影页、电视剧页和搜索页都是单列表数据桶，页面直接读取 pages[pageKey]。
export const LIST_PAGE_KEYS = ['movie', 'tv', 'search'];

// 类型: Array<string>。
// 作用: 详情页和播放页都是单内容数据桶，页面读取 current 作为当前内容。
export const ITEM_PAGE_KEYS = ['detail', 'player'];

/**
 * 创建默认请求对象。
 * 纯函数: 只根据 pageKey 和 moduleKey 返回新对象，不读取或修改外部状态。
 * 使用场景: 初始化空数据桶，让页面即使尚未请求数据也能读取稳定 request 字段。
 *
 * @param {string} pageKey 当前数据桶所属页面。
 * @param {string} moduleKey 当前数据桶所属页面区域，单列表页面允许为空字符串。
 * @returns {object} 默认 SourceDataRequest。
 */
function createDefaultRequest(pageKey, moduleKey) {
  // 返回值类型: object。
  // 作用: 提供稳定 request 结构，后续外部请求刷新时会整体替换。
  return {
    // 类型: string。
    // 作用: 默认使用 mock 数据源，保证静态 mock 阶段不需要页面重复传 sourceId。
    sourceId: MOCK_SOURCE_ID,

    // 类型: string。
    // 作用: 标记当前数据桶所属页面，便于刷新当前桶时复用请求。
    pageKey: pageKey || '',

    // 类型: string。
    // 作用: 标记当前数据桶所属页面区域，首页按该字段区分多个数据桶。
    moduleKey: moduleKey || '',

    // 类型: object。
    // 作用: 保存分页、关键词、内容 id 等请求参数；空桶阶段暂无实际参数。
    params: {}
  };
}

/**
 * 创建默认分页对象。
 * 纯函数: 每次调用都返回新对象，避免多个数据桶共享同一个 pagination 引用。
 *
 * @returns {object} 默认 pagination 对象。
 * @returns {number} return.page 当前页码。
 * @returns {number} return.pageSize 每页数量。
 * @returns {number} return.total 当前请求总条数。
 * @returns {number} return.totalPages 当前请求总页数。
 * @returns {boolean} return.hasMore 是否还有下一页。
 */
function createDefaultPagination() {
  // 返回值类型: object。
  // 作用: 空桶默认没有数据，页面可根据 total 为 0 展示空态或等待请求。
  return {
    // 类型: number。
    // 作用: 空桶默认页码。
    page: DEFAULT_PAGE,

    // 类型: number。
    // 作用: 空桶默认每页数量。
    pageSize: DEFAULT_PAGE_SIZE,

    // 类型: number。
    // 作用: 空桶默认总条数为 0。
    total: 0,

    // 类型: number。
    // 作用: 空桶默认总页数为 0。
    totalPages: 0,

    // 类型: boolean。
    // 作用: true 表示仍有下一页；false 表示空桶或已经没有下一页。
    hasMore: false
  };
}

/**
 * 创建列表页面数据桶。
 * 纯函数: 每次调用都返回新的 PageBucket，不共享 request、pagination 和 items 引用。
 * 使用场景: 首页区域、电影页、电视剧页和搜索页。
 *
 * @param {string} pageKey 当前数据桶所属页面。
 * @param {string} moduleKey 当前数据桶所属页面区域，单列表页面允许为空字符串。
 * @returns {object} 标准 PageBucket。
 * @returns {object} return.request 当前数据桶最后一次请求参数。
 * @returns {object} return.pagination 当前数据桶分页信息。
 * @returns {Array<object>} return.items 当前数据桶内容列表。
 * @returns {string} return.updatedAt 当前数据桶最后更新时间。
 */
export function createPageBucket(pageKey, moduleKey) {
  // 返回值类型: object。
  // 作用: 提供标准列表数据桶结构，sourceDataService 后续只需要覆盖对应字段。
  return {
    // 类型: object。
    // 作用: 保存当前数据桶最后一次请求，便于后续刷新和调试数据流。
    request: createDefaultRequest(pageKey, moduleKey),

    // 类型: object。
    // 作用: 保存当前数据桶分页信息，供分页组件或加载更多逻辑读取。
    pagination: createDefaultPagination(),

    // 类型: Array<object>。
    // 作用: 保存当前页内容对象列表，页面卡片、轮播和排行榜都从这里读取。
    items: [],

    // 类型: string。
    // 作用: 保存数据桶最后更新时间；空字符串表示尚未收到数据源响应。
    updatedAt: ''
  };
}

/**
 * 创建单内容页面数据桶。
 * 纯函数: 每次调用都返回新对象，不和其他页面共享 current 引用。
 * 使用场景: 详情页和播放页。
 *
 * @param {string} pageKey 当前单内容桶所属页面。
 * @returns {object} 单内容页面数据桶。
 * @returns {object} return.request 当前单内容页最后一次请求参数。
 * @returns {object|null} return.current 当前详情或播放内容。
 * @returns {string} return.updatedAt 当前数据桶最后更新时间。
 */
function createItemBucket(pageKey) {
  // 返回值类型: object。
  // 作用: 详情页和播放页不使用 items，而是通过 current 保存当前内容。
  return {
    // 类型: object。
    // 作用: 保存当前单内容页最后一次请求，通常包含 params.contentId。
    request: createDefaultRequest(pageKey, ''),

    // 类型: object|null。
    // 作用: 当前详情或播放内容；null 表示尚未请求或没有命中内容。
    current: null,

    // 类型: string。
    // 作用: 保存单内容页最后更新时间；空字符串表示尚未收到数据源响应。
    updatedAt: ''
  };
}

/**
 * 创建全站页面数据状态。
 * 纯函数: 每次调用都返回一套新的页面数据桶集合。
 *
 * @returns {object} 全站页面数据桶集合。
 */
function createPagesState() {
  // 返回值类型: object。
  // 作用: 按页面和数据块切分内容状态，避免后续数据流像 当前布局 那样分散到多个方向。
  return {
    // 类型: object。
    // 作用: 首页由多个独立区域组成，每个区域都是可单独请求和写入的 PageBucket。
    home: {
      // 类型: object。
      // 作用: 首页轮播图数据桶。
      banners: createPageBucket('home', 'banners'),

      // 类型: object。
      // 作用: 首页热门电影数据桶。
      hotMovies: createPageBucket('home', 'hotMovies'),

      // 类型: object。
      // 作用: 首页热门电视剧数据桶。
      hotTv: createPageBucket('home', 'hotTv'),

      // 类型: object。
      // 作用: 首页电影排行榜数据桶。
      movieRanking: createPageBucket('home', 'movieRanking'),

      // 类型: object。
      // 作用: 首页电视剧排行榜数据桶。
      tvRanking: createPageBucket('home', 'tvRanking')
    },

    // 类型: object。
    // 作用: 电影页单列表数据桶。
    movie: createPageBucket('movie', ''),

    // 类型: object。
    // 作用: 电视剧页单列表数据桶。
    tv: createPageBucket('tv', ''),

    // 类型: object。
    // 作用: 搜索页单列表数据桶。
    search: createPageBucket('search', ''),

    // 类型: object。
    // 作用: 详情页单内容数据桶。
    detail: createItemBucket('detail'),

    // 类型: object。
    // 作用: 播放页单内容数据桶。
    player: createItemBucket('player')
  };
}

// 类型: object。
// 作用: 全站内容运行态存储对象；当前项目不是 Vuex，只先建立统一数据落点和读取入口。
// 字段: activeSourceId，string，当前默认数据源 id，后续 SourceSwitchTabs 切换时会更新。
// 字段: sources，Array<object>，当前可用数据源列表，后续源管理和顶部切换组件可读取。
// 字段: pages，object，全站页面数据桶集合。
export const siteContentStore = {
  // 类型: string。
  // 作用: 当前启用的数据源 id；mock 阶段固定使用 MOCK_SOURCE_ID。
  activeSourceId: MOCK_SOURCE_ID,

  // 类型: Array<object>。
  // 作用: 当前可用数据源列表；先放入 mock 数据源，后续外部数据源接入后可扩展。
  sources: [mockSourceData.source],

  // 类型: object。
  // 作用: 全站页面数据桶集合，所有页面后续都从这里读取内容数据。
  pages: createPagesState()
};

/**
 * 重置全站内容存储。
 * 副作用: 原地覆盖 siteContentStore 的 activeSourceId、sources 和 pages。
 * 使用场景: 测试、切换数据源重建状态或后续退出登录时清理内容运行态。
 *
 * @returns {object} 重置后的 siteContentStore。
 */
export function resetSiteContentStore() {
  // 副作用: 恢复当前默认数据源 id。
  // 影响范围: 后续未显式传 sourceId 的请求会回到 mock 数据源。
  siteContentStore.activeSourceId = MOCK_SOURCE_ID;

  // 副作用: 重建数据源列表数组。
  // 影响范围: 避免外部修改 sources 数组后污染后续检查。
  siteContentStore.sources = [mockSourceData.source];

  // 副作用: 重建所有页面数据桶。
  // 影响范围: 清空已写入的列表 items、current 和更新时间。
  siteContentStore.pages = createPagesState();

  // 返回值类型: object。
  // 作用: 方便测试或调用方链式读取重置后的 store。
  return siteContentStore;
}

/**
 * 读取指定列表数据桶。
 * 纯函数: 只根据 pageKey 和 moduleKey 返回已有数据桶引用，不修改 store。
 * 使用场景: 页面渲染和 sourceDataService 写入列表响应前定位目标桶。
 *
 * @param {string} pageKey 页面名称，支持 home、movie、tv、search。
 * @param {string} moduleKey 首页区域名称，pageKey 为 home 时必填。
 * @returns {object} 匹配到的 PageBucket。
 * @throws {Error} 当 pageKey 或 moduleKey 不受支持时抛出。
 */
export function getPageBucket(pageKey, moduleKey = '') {
  // 条件分支: 请求首页数据桶时进入。
  // 执行内容: 根据 moduleKey 定位首页对应区域桶。
  if (pageKey === 'home') {
    // 条件分支: moduleKey 不在首页数据桶清单中时进入。
    // 执行内容: 抛出明确错误，避免写入未知首页区域。
    if (!HOME_BUCKET_KEYS.includes(moduleKey)) {
      throw new Error(`未知首页数据桶: ${moduleKey || 'empty'}`);
    }

    // 返回值类型: object。
    // 作用: 返回首页指定区域 PageBucket。
    return siteContentStore.pages.home[moduleKey];
  }

  // 条件分支: 请求单列表页面数据桶时进入。
  // 执行内容: 直接按 pageKey 返回目标桶。
  if (LIST_PAGE_KEYS.includes(pageKey)) {
    return siteContentStore.pages[pageKey];
  }

  // 错误类型: Error。
  // 作用: 提醒调用方当前页面不是列表桶或尚未纳入内容数据主干。
  throw new Error(`未知列表页面数据桶: ${pageKey || 'empty'}`);
}

/**
 * 读取指定单内容数据桶。
 * 纯函数: 只根据 pageKey 返回已有数据桶引用，不修改 store。
 * 使用场景: 详情页和播放页渲染 current 内容，或 service 写入单内容响应。
 *
 * @param {string} pageKey 页面名称，支持 detail、player。
 * @returns {object} 匹配到的单内容数据桶。
 * @throws {Error} 当 pageKey 不受支持时抛出。
 */
export function getItemBucket(pageKey) {
  // 条件分支: pageKey 属于单内容页面时进入。
  // 执行内容: 返回 detail 或 player 对应数据桶。
  if (ITEM_PAGE_KEYS.includes(pageKey)) {
    return siteContentStore.pages[pageKey];
  }

  // 错误类型: Error。
  // 作用: 提醒调用方当前页面不是单内容桶。
  throw new Error(`未知单内容页面数据桶: ${pageKey || 'empty'}`);
}

/**
 * 从响应对象读取更新时间。
 * 纯函数: 除在缺失 fetchedAt 时读取当前时间外，不修改外部状态。
 * 兜底策略: response.meta.fetchedAt 缺失时使用当前时间，保证写入 store 后 updatedAt 始终有值。
 *
 * @param {object} response 标准 SourceDataResponse。
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
 * 校验 SourceDataResponse 基础结构。
 * 纯函数: 只读取 response 字段，不修改传入对象或 store。
 * 失败路径: 响应不是对象或 pageKey 不受支持时抛出 Error。
 *
 * @param {object} response 待写入的 SourceDataResponse。
 * @returns {object} 校验通过的 SourceDataResponse。
 * @throws {Error} 当响应结构不完整或 pageKey 未纳入 store 时抛出。
 */
function assertSupportedResponse(response) {
  // 条件分支: response 不是对象时进入。
  // 执行内容: 抛出错误，阻止无效响应写入 store。
  if (!response || typeof response !== 'object') {
    throw new Error('SourceDataResponse 必须是对象');
  }

  // 类型: string。
  // 作用: 当前响应目标页面，决定写入列表桶还是单内容桶。
  const pageKey = response.pageKey || '';

  // 条件分支: pageKey 属于已支持页面时进入。
  // 执行内容: 直接返回响应对象，交给后续提交函数继续处理。
  if (pageKey === 'home' || LIST_PAGE_KEYS.includes(pageKey) || ITEM_PAGE_KEYS.includes(pageKey)) {
    return response;
  }

  // 错误类型: Error。
  // 作用: 阻止未知页面响应写入 store，避免数据结构失控。
  throw new Error(`SourceDataResponse.pageKey 未纳入 store: ${pageKey || 'empty'}`);
}

/**
 * 写入列表型 SourceDataResponse。
 * 副作用: 原地覆盖目标 PageBucket 的 request、pagination、items 和 updatedAt。
 *
 * @param {object} response 标准列表型 SourceDataResponse。
 * @returns {object} 写入后的 PageBucket。
 */
function commitListResponse(response) {
  // 类型: object。
  // 作用: 根据 pageKey/moduleKey 定位目标列表数据桶。
  const bucket = getPageBucket(response.pageKey, response.moduleKey || '');

  // 副作用: 保存当前桶最后一次请求。
  // 影响范围: 后续刷新或调试当前桶时可复用该请求。
  bucket.request = response.request || createDefaultRequest(response.pageKey, response.moduleKey || '');

  // 副作用: 保存当前桶分页信息。
  // 影响范围: 页面分页组件、加载更多状态和空态判断会读取该字段。
  bucket.pagination = response.pagination || createDefaultPagination();

  // 副作用: 保存当前桶内容列表。
  // 影响范围: 页面卡片、轮播和排行榜会从该数组渲染内容。
  bucket.items = Array.isArray(response.items) ? response.items : [];

  // 副作用: 保存当前桶最后更新时间。
  // 影响范围: 调试数据流或后续状态提示可读取该时间。
  bucket.updatedAt = getResponseFetchedAt(response);

  // 返回值类型: object。
  // 作用: 返回写入后的目标桶，方便 service 或测试直接断言。
  return bucket;
}

/**
 * 写入单内容 SourceDataResponse。
 * 副作用: 原地覆盖 detail/player 数据桶的 request、current 和 updatedAt。
 *
 * @param {object} response 标准单内容 SourceDataResponse。
 * @returns {object} 写入后的单内容数据桶。
 */
function commitItemResponse(response) {
  // 类型: object。
  // 作用: 根据 pageKey 定位详情页或播放页单内容桶。
  const bucket = getItemBucket(response.pageKey);

  // 副作用: 保存当前单内容页最后一次请求。
  // 影响范围: 后续刷新详情或播放数据时可复用 contentId 和 sourceId。
  bucket.request = response.request || createDefaultRequest(response.pageKey, '');

  // 副作用: 保存当前详情或播放内容。
  // 影响范围: 详情页和播放页会读取 current 渲染主体内容。
  bucket.current = response.item || null;

  // 副作用: 保存当前桶最后更新时间。
  // 影响范围: 调试数据流或后续状态提示可读取该时间。
  bucket.updatedAt = getResponseFetchedAt(response);

  // 返回值类型: object。
  // 作用: 返回写入后的目标桶，方便 service 或测试直接断言。
  return bucket;
}

/**
 * 写入标准数据源响应。
 * 副作用: 根据 response.pageKey 把响应写入 siteContentStore 对应数据桶。
 * 使用场景: sourceDataService 请求 provider 成功后统一调用，页面不直接写 store。
 *
 * @param {object} response 标准 SourceDataResponse。
 * @returns {object} 写入后的目标数据桶。
 * @throws {Error} 当响应结构不完整或 pageKey/moduleKey 不受支持时抛出。
 */
export function commitSourceDataResponse(response) {
  // 类型: object。
  // 作用: 校验响应对象，避免无效数据写入全站内容状态。
  const safeResponse = assertSupportedResponse(response);

  // 条件分支: 响应属于单内容页面时进入。
  // 执行内容: 写入 detail.current 或 player.current。
  if (ITEM_PAGE_KEYS.includes(safeResponse.pageKey)) {
    return commitItemResponse(safeResponse);
  }

  // 返回值类型: object。
  // 作用: 列表型页面写入 PageBucket 并返回目标桶。
  return commitListResponse(safeResponse);
}

// 导出类型: default object。
// 导出内容: 全站内容运行态存储对象。
// 外部调用方: 页面组件、sourceDataService 和后续调试面板。
// 使用场景: 读取或观察全站内容数据桶。
export default siteContentStore;
