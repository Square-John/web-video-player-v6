/*
  siteContentStore.js 模块说明

  - 文件职责:
      提供 当前项目 内容数据主干的本地运行态存储对象。
      供 sourceDataService.js 写入数据源响应，并把 ContentItem 归一化到全站内容实体共享池。
      供首页、电影页、电视剧页、搜索页、详情页和播放页通过 selector 读取页面数据块。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      MOCK_SOURCE_ID/mockSourceData: 自定义数据，提供 mock 阶段默认数据源 id 和数据源基础信息。
      buildContentKey/getContentKeyFromItem/isValidContentKey: 自定义工具函数，提供 contentKey 生成和校验能力。

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
              为尚未发起外部请求的数据桶补齐稳定 request 结构。
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
      createEntitiesState()
          - params:
              无
          - return:
              object，全站内容实体共享池初始结构。
          - description:
              初始化 entities.contentItems，确保页面桶只需要保存内容引用 key。
      normalizeContentItemForStore(contentItem, fallbackSourceId)
          - params:
              -- contentItem: object，数据源返回的 ContentItem。
              -- fallbackSourceId: string，响应所属数据源 id。
          - return:
              object|null，可写入实体池的 ContentItem。
          - description:
              为缺少 sourceId 的内容对象补齐响应 sourceId，并过滤非对象内容。
      upsertContentItem(contentItem, fallbackSourceId)
          - params:
              -- contentItem: object，数据源返回的 ContentItem。
              -- fallbackSourceId: string，响应所属数据源 id。
          - return:
              string，写入实体池后的 contentKey。
          - description:
              将 ContentItem 写入 entities.contentItems，并返回页面桶可保存的引用 key。
      getItemsByKeys(contentKeys)
          - params:
              -- contentKeys: Array<string>，页面桶保存的内容引用 key 列表。
          - return:
              Array<object>，解析后的 ContentItem 列表。
          - description:
              将 itemKeys 解析成页面可渲染的完整内容对象列表。

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
      getContentItemByKey: Function，根据 contentKey 读取内容实体。
      getContentItemById: Function，根据 sourceId 和 contentId 读取内容实体。
      getBucketItems: Function，根据 pageKey/moduleKey 读取列表桶完整内容。
      getCurrentContentItem: Function，根据 pageKey 读取单内容页当前内容。
      commitSourceDataResponse: Function，写入标准数据源响应。
*/

// 导入来源: ../data/mock-source.mock。
// 导入内容: MOCK_SOURCE_ID 默认 mock 数据源 id，mockSourceData mock 数据源完整数据对象。
// 文件作用: 用于初始化本地内容 store 的默认数据源上下文。
import { MOCK_SOURCE_ID, mockSourceData } from '../data/mock-source.mock.js';

import {
  // 导入来源: ../utils/contentKeys。
  // 导入内容: buildContentKey 内容 key 生成函数。
  // 文件作用: 用于根据 sourceId 和 contentId 读取内容实体。
  buildContentKey,

  // 导入来源: ../utils/contentKeys。
  // 导入内容: getContentKeyFromItem ContentItem key 生成函数。
  // 文件作用: 用于把 provider 返回的 ContentItem 转成实体池引用 key。
  getContentKeyFromItem,

  // 导入来源: ../utils/contentKeys。
  // 导入内容: isValidContentKey 内容 key 校验函数。
  // 文件作用: 用于过滤无效 itemKeys，避免页面桶保存不可定位引用。
  isValidContentKey
} from '../utils/contentKeys.js';

// 类型: number。
// 作用: 数据桶尚未请求前使用第一页作为默认页码，保证 pagination.page 始终可读。
const DEFAULT_PAGE = 1;

// 类型: number。
// 作用: 数据桶尚未请求前使用 12 条作为默认每页数量，和当前目录页、搜索页统一展示数量保持一致。
const DEFAULT_PAGE_SIZE = 12;

// 类型: Array<string>。
// 作用: 首页数据被切分成五个独立数据桶，每个桶都能单独请求、写入和刷新。
export const HOME_BUCKET_KEYS = ['banners', 'hotMovies', 'hotTv', 'movieRanking', 'tvRanking'];

// 类型: Array<string>。
// 作用: 电影页、电视剧页和搜索页都是单列表数据桶，页面直接读取 pages[pageKey]。
export const LIST_PAGE_KEYS = ['movie', 'tv', 'search'];

// 类型: Array<string>。
// 作用: 详情页和播放页都是单内容数据桶，页面读取 currentKey 对应的实体作为当前内容。
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
  // 作用: 提供稳定 request 结构，后续外部请求写入时会整体替换。
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
 * 纯函数: 每次调用都返回新的 PageBucket，不共享 request、pagination、itemKeys 和兼容 items 引用。
 * 使用场景: 首页区域、电影页、电视剧页和搜索页。
 *
 * @param {string} pageKey 当前数据桶所属页面。
 * @param {string} moduleKey 当前数据桶所属页面区域，单列表页面允许为空字符串。
 * @returns {object} 标准 PageBucket。
 * @returns {object} return.request 当前数据桶最后一次请求参数。
 * @returns {object} return.pagination 当前数据桶分页信息。
 * @returns {Array<string>} return.itemKeys 当前数据桶内容引用 key 列表。
 * @returns {Array<object>} return.items 当前数据桶内容列表，兼容仍直接读取列表内容的页面。
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

    // 类型: Array<string>。
    // 作用: 保存当前页内容引用 key 列表，页面后续应通过 getBucketItems 解析完整 ContentItem。
    itemKeys: [],

    // 类型: Array<object>。
    // 作用: 兼容仍直接读取 items 的页面；页面完成统一读取入口后可删除该字段。
    items: [],

    // 类型: string。
    // 作用: 保存数据桶最后更新时间；空字符串表示尚未收到数据源响应。
    updatedAt: ''
  };
}

/**
 * 创建单内容页面数据桶。
 * 纯函数: 每次调用都返回新对象，不和其他页面共享 currentKey 和兼容 current 引用。
 * 使用场景: 详情页和播放页。
 *
 * @param {string} pageKey 当前单内容桶所属页面。
 * @returns {object} 单内容页面数据桶。
 * @returns {object} return.request 当前单内容页最后一次请求参数。
 * @returns {string} return.currentKey 当前详情或播放内容引用 key。
 * @returns {object|null} return.current 当前详情或播放内容，兼容仍直接读取当前内容的页面。
 * @returns {string} return.updatedAt 当前数据桶最后更新时间。
 */
function createItemBucket(pageKey) {
  // 返回值类型: object。
  // 作用: 详情页和播放页不使用 itemKeys，而是通过 currentKey 保存当前内容引用。
  return {
    // 类型: object。
    // 作用: 保存当前单内容页最后一次请求，通常包含 params.contentId。
    request: createDefaultRequest(pageKey, ''),

    // 类型: string。
    // 作用: 当前详情或播放内容引用 key；空字符串表示尚未请求或没有命中内容。
    currentKey: '',

    // 类型: object|null。
    // 作用: 兼容仍直接读取 current 的页面；页面完成统一读取入口后可删除该字段。
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

/**
 * 创建全站内容实体共享池状态。
 * 纯函数: 每次调用都返回新的 entities 对象，避免重置 store 时复用旧实体引用。
 *
 * @returns {object} 全站内容实体共享池状态。
 * @returns {object} return.contentItems 以 contentKey 为键保存的 ContentItem 字典。
 */
function createEntitiesState() {
  // 返回值类型: object。
  // 作用: 初始化内容实体池，后续列表桶和单内容桶只保存这里的引用 key。
  return {
    // 类型: Record<string, object>。
    // 作用: 保存全站唯一 ContentItem，同一个 sourceId + contentId 只在这里保留一份。
    contentItems: {}
  };
}

/**
 * 标准化准备写入实体池的 ContentItem。
 * 纯函数: 不修改传入 contentItem，只在需要补 sourceId 时创建浅拷贝。
 * 兜底策略: contentItem 不是对象时返回 null；sourceId 缺失时使用响应 sourceId 兜底。
 *
 * @param {object} contentItem 数据源返回的 ContentItem。
 * @param {string} fallbackSourceId 响应所属数据源 id。
 * @returns {object|null} 可写入实体池的 ContentItem。
 */
function normalizeContentItemForStore(contentItem, fallbackSourceId) {
  // 条件分支: contentItem 不是对象时进入。
  // 执行内容: 返回 null，避免无效条目污染实体池。
  if (!contentItem || typeof contentItem !== 'object') {
    return null;
  }

  // 条件分支: 内容对象已经带 sourceId 时进入。
  // 执行内容: 直接返回原对象，保持 provider 返回字段不被额外浅拷贝。
  if (contentItem.sourceId) {
    return contentItem;
  }

  // 返回值类型: object。
  // 作用: 为少数缺少 sourceId 的内容补齐响应所属数据源，保证 contentKey 可生成。
  return {
    ...contentItem,
    sourceId: fallbackSourceId || ''
  };
}

/**
 * 写入或更新单个 ContentItem 实体。
 * 副作用: 修改 siteContentStore.entities.contentItems。
 * 使用场景: 列表响应和单内容响应写入时统一调用，保证页面桶只保存 contentKey。
 *
 * @param {object} contentItem 数据源返回的 ContentItem。
 * @param {string} fallbackSourceId 响应所属数据源 id，用于内容缺少 sourceId 时兜底。
 * @returns {string} 写入实体池后的 contentKey；无法生成时返回空字符串。
 */
function upsertContentItem(contentItem, fallbackSourceId) {
  // 类型: object|null。
  // 作用: 标准化待写入内容，过滤非对象条目并补齐必要 sourceId。
  const normalizedContentItem = normalizeContentItemForStore(contentItem, fallbackSourceId);

  // 条件分支: 内容对象不可用时进入。
  // 执行内容: 返回空字符串，调用方会跳过该条引用。
  if (!normalizedContentItem) {
    return '';
  }

  // 类型: string。
  // 作用: 根据 ContentItem.sourceId 和 ContentItem.id 生成实体池引用 key。
  const contentKey = getContentKeyFromItem(normalizedContentItem);

  // 条件分支: key 无效时进入。
  // 执行内容: 返回空字符串，避免把无法定位的内容写入共享池。
  if (!contentKey) {
    return '';
  }

  // 副作用: 写入或覆盖共享池中的唯一内容实体。
  // 影响范围: 所有持有同一个 contentKey 的页面桶会通过 selector 读取到最新实体。
  siteContentStore.entities.contentItems[contentKey] = normalizedContentItem;

  // 返回值类型: string。
  // 作用: 返回页面桶需要保存的内容引用 key。
  return contentKey;
}

/**
 * 根据 contentKey 列表读取完整 ContentItem 列表。
 * 纯函数: 只读取 siteContentStore.entities.contentItems，不修改 store。
 * 兜底策略: 非数组输入返回空数组，无效 key 或缺失实体会被过滤。
 *
 * @param {Array<string>} contentKeys 页面桶保存的内容引用 key 列表。
 * @returns {Array<object>} 可供页面渲染的 ContentItem 列表。
 */
function getItemsByKeys(contentKeys) {
  // 类型: Array<string>。
  // 作用: 确保后续 map/filter 操作始终基于数组执行。
  const safeContentKeys = Array.isArray(contentKeys) ? contentKeys : [];

  // 返回值类型: Array<object>。
  // 作用: 将有效 contentKey 映射为 ContentItem，并过滤掉已经不存在的实体。
  return safeContentKeys
    .filter(isValidContentKey)
    .map((contentKey) => getContentItemByKey(contentKey))
    .filter(Boolean);
}

// 类型: object。
// 作用: 全站内容运行态存储对象；当前项目不是 Vuex，只先建立统一数据落点和读取入口。
// 字段: activeSourceId，string，当前默认数据源 id，后续 SourceSwitchTabs 切换时会更新。
// 字段: sources，Array<object>，当前可用数据源列表，后续源管理和顶部切换组件可读取。
// 字段: entities，object，全站内容实体共享池，同一个 sourceId + contentId 只保存一份 ContentItem。
// 字段: pages，object，全站页面数据桶集合。
export const siteContentStore = {
  // 类型: string。
  // 作用: 当前启用的数据源 id；mock 阶段固定使用 MOCK_SOURCE_ID。
  activeSourceId: MOCK_SOURCE_ID,

  // 类型: Array<object>。
  // 作用: 当前可用数据源列表；先放入 mock 数据源，后续外部数据源接入后可扩展。
  sources: [mockSourceData.source],

  // 类型: object。
  // 作用: 全站内容实体共享池，页面桶通过 itemKeys/currentKey 引用这里的 ContentItem。
  entities: createEntitiesState(),

  // 类型: object。
  // 作用: 全站页面数据桶集合，所有页面后续都从这里读取内容数据。
  pages: createPagesState()
};

/**
 * 重置全站内容存储。
 * 副作用: 原地覆盖 siteContentStore 的 activeSourceId、sources、entities 和 pages。
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

  // 副作用: 重建内容实体共享池。
  // 影响范围: 清空所有已归一化写入的 ContentItem，避免切源后读取旧实体。
  siteContentStore.entities = createEntitiesState();

  // 副作用: 重建所有页面数据桶。
  // 影响范围: 清空已写入的 itemKeys、currentKey、过渡兼容字段和更新时间。
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
 * 使用场景: 详情页和播放页定位 currentKey 数据桶，或 service 写入单内容响应。
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
 * 根据 contentKey 读取内容实体。
 * 纯函数: 只读取 siteContentStore.entities.contentItems，不修改 store。
 * 兜底策略: contentKey 无效或实体不存在时返回 null，让调用方自行决定空态。
 *
 * @param {string} contentKey 内容实体共享池引用 key。
 * @returns {object|null} 匹配到的 ContentItem。
 */
export function getContentItemByKey(contentKey) {
  // 条件分支: contentKey 不符合标准结构时进入。
  // 执行内容: 返回 null，避免访问实体池时出现无意义键名。
  if (!isValidContentKey(contentKey)) {
    return null;
  }

  // 类型: object。
  // 作用: 读取全站内容实体字典，缺失时使用空对象兜底。
  const contentItems = siteContentStore.entities && siteContentStore.entities.contentItems
    ? siteContentStore.entities.contentItems
    : {};

  // 返回值类型: object|null。
  // 作用: 返回 contentKey 对应的唯一 ContentItem；没有命中时返回 null。
  return contentItems[contentKey] || null;
}

/**
 * 根据 sourceId 和 contentId 读取内容实体。
 * 纯函数: 只读取实体池，不修改 store。
 * 使用场景: 后续个人中心、收藏记录和播放历史根据引用补全完整内容。
 *
 * @param {string} sourceId 内容所属数据源 id。
 * @param {string} contentId 内容 id，对应 ContentItem.id。
 * @returns {object|null} 匹配到的 ContentItem。
 */
export function getContentItemById(sourceId, contentId) {
  // 类型: string。
  // 作用: 使用统一工具生成 contentKey，避免调用方手写拼接规则。
  const contentKey = buildContentKey(sourceId, contentId);

  // 返回值类型: object|null。
  // 作用: 返回实体池中对应内容，缺失时返回 null。
  return getContentItemByKey(contentKey);
}

/**
 * 根据页面数据桶读取完整内容列表。
 * 纯函数: 只读取 PageBucket.itemKeys 和实体池，不修改 store。
 * 兼容策略: 如果页面桶暂时只有 items 而没有 itemKeys，则返回 items，保证页面渲染稳定。
 *
 * @param {string} pageKey 页面名称，支持 home、movie、tv、search。
 * @param {string} moduleKey 首页区域名称，pageKey 为 home 时必填。
 * @returns {Array<object>} 当前页面桶可渲染的 ContentItem 列表。
 */
export function getBucketItems(pageKey, moduleKey = '') {
  // 类型: object。
  // 作用: 根据页面定位目标列表数据桶。
  const bucket = getPageBucket(pageKey, moduleKey);

  // 条件分支: 当前桶已经保存 itemKeys 时进入。
  // 执行内容: 按实体池解析完整 ContentItem 列表。
  if (Array.isArray(bucket.itemKeys) && bucket.itemKeys.length > 0) {
    return getItemsByKeys(bucket.itemKeys);
  }

  // 条件分支: 当前桶处于空数据状态但 itemKeys 字段存在时进入。
  // 执行内容: 返回空数组，表示新结构下该桶没有内容引用。
  if (Array.isArray(bucket.itemKeys)) {
    return [];
  }

  // 返回值类型: Array<object>。
  // 作用: 兼容仍保存完整 items 的桶结构，后续页面全部切 selector 后可以删除该兜底。
  return Array.isArray(bucket.items) ? bucket.items : [];
}

/**
 * 根据单内容页面桶读取当前 ContentItem。
 * 纯函数: 只读取 ItemBucket.currentKey 和实体池，不修改 store。
 * 兼容策略: 如果页面桶暂时只有 current 而没有 currentKey，则返回 current。
 *
 * @param {string} pageKey 页面名称，支持 detail、player。
 * @returns {object|null} 当前详情页或播放页内容。
 */
export function getCurrentContentItem(pageKey) {
  // 类型: object。
  // 作用: 根据页面定位 detail 或 player 单内容桶。
  const bucket = getItemBucket(pageKey);

  // 条件分支: 当前桶保存了 currentKey 时进入。
  // 执行内容: 从实体池读取完整 ContentItem。
  if (bucket.currentKey) {
    return getContentItemByKey(bucket.currentKey);
  }

  // 返回值类型: object|null。
  // 作用: 兼容仍保存 current 的页面桶字段，后续页面全部切 selector 后可以删除该兜底。
  return bucket.current || null;
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
 * 副作用: 把 response.items 归一化写入 entities.contentItems，并覆盖目标 PageBucket 的 request、pagination、itemKeys、过渡 items 和 updatedAt。
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

  // 类型: Array<object>。
  // 作用: 标准化 provider 返回的列表内容，非数组响应按空列表处理。
  const responseItems = Array.isArray(response.items) ? response.items : [];

  // 类型: Array<string>。
  // 作用: 将 ContentItem 逐条写入实体池，并收集可用于页面桶保存的引用 key。
  const itemKeys = responseItems
    .map((contentItem) => upsertContentItem(contentItem, response.sourceId))
    .filter(Boolean);

  // 副作用: 保存当前桶内容引用 key 列表。
  // 影响范围: 后续页面 selector 会从 itemKeys 解析完整 ContentItem。
  bucket.itemKeys = itemKeys;

  // 副作用: 同步保存完整 items。
  // 影响范围: 仍直接读取 items 的页面可以继续渲染；后续统一读取入口完成后应删除该兼容字段。
  bucket.items = getItemsByKeys(itemKeys);

  // 副作用: 保存当前桶最后更新时间。
  // 影响范围: 调试数据流或后续状态提示可读取该时间。
  bucket.updatedAt = getResponseFetchedAt(response);

  // 返回值类型: object。
  // 作用: 返回写入后的目标桶，方便 service 或测试直接断言。
  return bucket;
}

/**
 * 写入单内容 SourceDataResponse。
 * 副作用: 把 response.item 归一化写入 entities.contentItems，并覆盖 detail/player 数据桶的 request、currentKey、过渡 current 和 updatedAt。
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

  // 类型: string。
  // 作用: 将当前 ContentItem 写入实体池，并得到单内容桶保存的引用 key。
  const currentKey = upsertContentItem(response.item, response.sourceId);

  // 副作用: 保存当前详情或播放内容引用 key。
  // 影响范围: 后续详情页和播放页 selector 会通过 currentKey 读取完整 ContentItem。
  bucket.currentKey = currentKey;

  // 副作用: 同步保存完整 current。
  // 影响范围: 仍直接读取 current 的详情页和播放页可以继续渲染；后续统一读取入口完成后应删除该兼容字段。
  bucket.current = currentKey ? getContentItemByKey(currentKey) : null;

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
  // 执行内容: 写入 detail.currentKey 或 player.currentKey，并同步过渡 current。
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
