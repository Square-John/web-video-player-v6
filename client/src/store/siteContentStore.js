/*
  siteContentStore.js 模块说明

  - 文件职责:
      提供 v5 内容数据主干的本地运行态存储对象。
      供 sourceDataService.js 写入数据源响应，并把 ContentItem 归一化到全站内容实体共享池。
      供首页、电影页、电视剧页、搜索页、详情页和播放页通过 selector 读取页面数据块。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 1 条，自定义 1 条):
      Vue: 第三方库，提供 Vue.observable 和 Vue.set，让轻量 store 具备 Vue 2 响应式能力。
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
      createContentCommitPlan(response)
          - params:
              -- response: object，SourceDataResponse。
          - return:
              object，完成全部读取、定位和转换的内容提交计划。
          - description:
              在第一次写入 store 前完成响应校验、目标桶定位、实体 key 生成和桶字段准备。
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
      createContentEntityEntry(contentItem, fallbackSourceId)
          - params:
              -- contentItem: object，数据源返回的 ContentItem。
              -- fallbackSourceId: string，响应所属数据源 id。
          - return:
              object|null，待写入实体池的 contentKey 和 ContentItem。
          - description:
              在不修改 store 的前提下准备实体写入条目，并过滤无法生成 key 的内容。
      applyContentCommitPlan(commitPlan)
          - params:
              -- commitPlan: object，已经完成全部失败检查的内容提交计划。
          - return:
              object，写入后的目标页面桶。
          - description:
              按实体、页面桶、活动身份的固定顺序采用提交计划。
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
      getPagePagination: Function，根据 pageKey/moduleKey 读取列表桶分页信息。
      getCurrentContentItem: Function，根据 pageKey 读取单内容页当前内容。
      getActiveSourceId: Function，读取当前默认数据源 id。
      commitSourceDataResponse: Function，写入标准数据源响应。
*/

// 导入来源: vue。
// 导入内容: Vue 构造函数。
// 文件作用: 用于通过 Vue.observable 创建响应式内容 store，并通过 Vue.set 写入动态实体字段。
import Vue from 'vue';

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
  // 作用: 提供稳定 request 结构，后续真实请求写入时会整体替换。
  return {
    // 类型: string。
    // 作用: 空桶尚未接收 Runtime 响应，不预先伪造数据源身份；service 会从当前 store 或 SourceManagerState 解析真实 sourceId。
    sourceId: '',

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
 * 纯函数: 每次调用都返回新的 PageBucket，不共享 request、pagination 和 itemKeys 引用。
 * 使用场景: 首页区域、电影页、电视剧页和搜索页。
 *
 * @param {string} pageKey 当前数据桶所属页面。
 * @param {string} moduleKey 当前数据桶所属页面区域，单列表页面允许为空字符串。
 * @returns {object} 标准 PageBucket。
 * @returns {object} return.request 当前数据桶最后一次请求参数。
 * @returns {object} return.pagination 当前数据桶分页信息。
 * @returns {Array<string>} return.itemKeys 当前数据桶内容引用 key 列表。
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

    // 类型: string。
    // 作用: 保存数据桶最后更新时间；空字符串表示尚未收到数据源响应。
    updatedAt: ''
  };
}

/**
 * 创建单内容页面数据桶。
 * 纯函数: 每次调用都返回新对象，不和其他页面共享 currentKey 引用。
 * 使用场景: 详情页和播放页。
 *
 * @param {string} pageKey 当前单内容桶所属页面。
 * @returns {object} 单内容页面数据桶。
 * @returns {object} return.request 当前单内容页最后一次请求参数。
 * @returns {string} return.currentKey 当前详情或播放内容引用 key。
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
  // 作用: 按页面和数据块切分内容状态，避免后续数据流像 v4 那样分散到多个方向。
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
 * 准备单个 ContentItem 实体写入条目。
 * 纯函数: 不修改 siteContentStore，只返回后续提交需要的 contentKey 和 ContentItem。
 * 使用场景: 列表响应和单内容响应在第一次 store 写入前统一生成实体计划。
 *
 * @param {object} contentItem 数据源返回的 ContentItem。
 * @param {string} fallbackSourceId 响应所属数据源 id，用于内容缺少 sourceId 时兜底。
 * @returns {object|null} 实体写入条目；无法生成 key 时返回 null。
 * @returns {string} return.contentKey 实体池动态字段 key。
 * @returns {object} return.contentItem 已补齐必要 sourceId 的 ContentItem。
 */
function createContentEntityEntry(contentItem, fallbackSourceId) {
  // 类型: object|null。
  // 作用: 标准化待写入内容，过滤非对象条目并补齐必要 sourceId。
  const normalizedContentItem = normalizeContentItemForStore(contentItem, fallbackSourceId);

  // 条件分支: 内容对象不可用时进入。
  // 执行内容: 返回 null，调用方会跳过该条实体和引用。
  if (!normalizedContentItem) {
    return null;
  }

  // 类型: string。
  // 作用: 根据 ContentItem.sourceId 和 ContentItem.id 生成实体池引用 key。
  const contentKey = getContentKeyFromItem(normalizedContentItem);

  // 条件分支: key 无效时进入。
  // 执行内容: 返回 null，避免把无法定位的内容纳入提交计划。
  if (!contentKey) {
    return null;
  }

  // 返回值类型: object。
  // 作用: 返回不产生 store 副作用的实体写入条目，供完整提交计划统一采用。
  return {
    // 类型: string。
    // 作用: 动态写入 entities.contentItems 时使用的唯一字段 key，同时进入页面桶引用列表。
    contentKey,

    // 类型: object。
    // 作用: 提交阶段写入实体池的标准 ContentItem。
    contentItem: normalizedContentItem
  };
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
// 作用: 全站内容运行态响应式存储对象；当前阶段不是 Vuex，但通过 Vue.observable 保证页面 selector 能响应异步写入。
// 字段: activeSourceId，string，最近成功提交内容响应的真实数据源 id。
// 字段: sources，Array<object>，当前可用数据源列表，后续源管理和顶部切换组件可读取。
// 字段: entities，object，全站内容实体共享池，同一个 sourceId + contentId 只保存一份 ContentItem。
// 字段: pages，object，全站页面数据桶集合。
export const siteContentStore = Vue.observable({
  // 类型: string。
  // 作用: 当前内容运行态采用的数据源 id；初始为空，第一次成功响应提交后采用 response.sourceId。
  activeSourceId: '',

  // 类型: Array<object>。
  // 作用: 当前可用数据源投影；6E 不复制 Repository 配置，下一阶段由 SourceManager 可用源 selector 统一填充。
  sources: [],

  // 类型: object。
  // 作用: 全站内容实体共享池，页面桶通过 itemKeys/currentKey 引用这里的 ContentItem。
  entities: createEntitiesState(),

  // 类型: object。
  // 作用: 全站页面数据桶集合，所有页面后续都从这里读取内容数据。
  pages: createPagesState()
});

/**
 * 重置全站内容存储。
 * 副作用: 原地覆盖 siteContentStore 的 activeSourceId、sources、entities 和 pages。
 * 使用场景: 测试、切换数据源重建状态或后续退出登录时清理内容运行态。
 *
 * @returns {object} 重置后的 siteContentStore。
 */
export function resetSiteContentStore() {
  // 副作用: 使用 Vue.set 清空当前响应身份。
  // 影响范围: 后续未显式传 sourceId 的请求会从共享 Runtime 的 SourceManagerState 重新解析活动源或默认源。
  Vue.set(siteContentStore, 'activeSourceId', '');

  // 副作用: 使用 Vue.set 重建空数据源投影数组。
  // 影响范围: 清除旧页面投影引用；不从内容 mock 伪造 SourceManager 可用源列表。
  Vue.set(siteContentStore, 'sources', []);

  // 副作用: 使用 Vue.set 重建内容实体共享池。
  // 影响范围: 清空所有已归一化写入的 ContentItem，避免切源后读取旧实体，并保证新实体池继续可观察。
  Vue.set(siteContentStore, 'entities', createEntitiesState());

  // 副作用: 使用 Vue.set 重建所有页面数据桶。
  // 影响范围: 清空已写入的 itemKeys、currentKey 和更新时间，并保证新页面桶继续可观察。
  Vue.set(siteContentStore, 'pages', createPagesState());

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
 * 正式策略: 页面桶只保存 itemKeys，完整内容必须从 entities.contentItems 解析。
 *
 * @param {string} pageKey 页面名称，支持 home、movie、tv、search。
 * @param {string} moduleKey 首页区域名称，pageKey 为 home 时必填。
 * @returns {Array<object>} 当前页面桶可渲染的 ContentItem 列表。
 */
export function getBucketItems(pageKey, moduleKey = '') {
  // 类型: object。
  // 作用: 根据页面定位目标列表数据桶。
  const bucket = getPageBucket(pageKey, moduleKey);

  // 返回值类型: Array<object>。
  // 作用: 按实体池解析完整 ContentItem 列表；空桶或异常桶统一返回空数组。
  return Array.isArray(bucket.itemKeys) ? getItemsByKeys(bucket.itemKeys) : [];
}

/**
 * 根据页面数据桶读取分页信息。
 * 纯函数: 只读取 PageBucket.pagination，不修改 store。
 * 正式策略: 页面通过 selector 读取分页，避免直接感知 siteContentStore.pages 内部结构。
 *
 * @param {string} pageKey 页面名称，支持 home、movie、tv、search。
 * @param {string} moduleKey 首页区域名称，pageKey 为 home 时必填。
 * @returns {object|null} 标准 pagination 对象；桶不存在或 pagination 缺失时返回 null。
 */
export function getPagePagination(pageKey, moduleKey = '') {
  // 类型: object。
  // 作用: 根据页面和区域定位目标列表数据桶，让分页读取和列表读取使用同一套桶定位规则。
  const bucket = getPageBucket(pageKey, moduleKey);

  // 返回值类型: object|null。
  // 作用: 返回标准 pagination；缺失时让页面分页组件不渲染。
  return bucket && bucket.pagination ? bucket.pagination : null;
}

/**
 * 根据单内容页面桶读取当前 ContentItem。
 * 纯函数: 只读取 ItemBucket.currentKey 和实体池，不修改 store。
 * 正式策略: 单内容桶只保存 currentKey，完整内容必须从 entities.contentItems 解析。
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

  // 返回值类型: null。
  // 作用: 当前单内容桶没有引用 key 时，页面进入空状态或等待请求完成。
  return null;
}

/**
 * 读取当前默认数据源 id。
 * 纯函数: 只读取 siteContentStore.activeSourceId，不修改 store。
 * 使用场景: 详情页和播放页在路由没有 sourceId 时，用该 selector 获取统一数据源上下文。
 *
 * @returns {string} 当前默认数据源 id；缺失时返回空字符串。
 */
export function getActiveSourceId() {
  // 返回值类型: string。
  // 作用: 给页面请求和跳转兜底提供统一数据源上下文，避免页面直接持有 siteContentStore。
  return siteContentStore.activeSourceId || '';
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
 * 创建标准内容响应的完整提交计划。
 * 纯函数: 只读取响应和现有目标桶引用，不修改传入对象或 store。
 * 失败路径: 响应结构、目标桶定位、字段 getter 或 contentKey 生成失败时抛出 Error，store 保持调用前状态。
 *
 * @param {object} response 待写入的 SourceDataResponse。
 * @returns {object} 已完成所有可失败准备工作的内容提交计划。
 * @returns {string} return.sourceId 成功采用后写入 activeSourceId 的真实身份。
 * @returns {object} return.bucket 当前响应目标页面桶引用。
 * @returns {string} return.bucketType 列表桶使用 list，单内容桶使用 item。
 * @returns {Array<object>} return.entityEntries 待写入实体池的条目。
 * @returns {object} return.bucketValues 待一次采用的页面桶字段。
 * @throws {Error} 当响应结构不完整或 pageKey 未纳入 store 时抛出。
 */
function createContentCommitPlan(response) {
  // 条件分支: response 不是对象时进入。
  // 执行内容: 抛出错误，阻止无效响应写入 store。
  if (!response || typeof response !== 'object') {
    throw new Error('SourceDataResponse 必须是对象');
  }

  // 类型: string。
  // 作用: 当前响应目标页面，决定写入列表桶还是单内容桶。
  const pageKey = response.pageKey || '';

  // 类型: string。
  // 作用: 当前响应真实数据源身份，成功提交后成为内容运行态活动源。
  const sourceId = typeof response.sourceId === 'string' ? response.sourceId.trim() : '';

  // 条件分支: 标准响应缺少真实 sourceId 时进入。
  // 执行内容: 在实体和页面桶写入前拒绝匿名响应，避免生成无法跨页面定位的 contentKey。
  if (!sourceId) {
    throw new Error('SourceDataResponse.sourceId 不能为空');
  }

  // 类型: boolean。
  // 作用: 区分详情/播放单内容桶与首页/目录/搜索列表桶，决定后续只读取当前分支需要的响应字段。
  const isItemResponse = ITEM_PAGE_KEYS.includes(pageKey);

  // 条件分支: pageKey 不属于任何受支持页面时进入。
  // 执行内容: 在读取其他响应字段和定位目标桶前明确拒绝未知页面。
  if (pageKey !== 'home' && !LIST_PAGE_KEYS.includes(pageKey) && !isItemResponse) {
    // 错误类型: Error。
    // 作用: 阻止未知页面响应写入 store，避免数据结构失控。
    throw new Error(`SourceDataResponse.pageKey 未纳入 store: ${pageKey || 'empty'}`);
  }

  // 条件分支: 响应属于单内容页面时进入。
  // 执行内容: 在任何 store 写入前读取单内容字段、定位目标桶并生成实体条目。
  if (isItemResponse) {
    // 类型: object。
    // 作用: 提前定位详情页或播放页目标桶；定位失败时 activeSourceId 和实体池都不会变化。
    const bucket = getItemBucket(pageKey);

    // 类型: object。
    // 作用: 读取当前响应内容并生成不带副作用的实体写入条目。
    const entityEntry = createContentEntityEntry(response.item, sourceId);

    // 返回值类型: object。
    // 作用: 返回单内容完整提交计划，后续采用阶段不再读取 response getter 或执行 key 转换。
    return {
      sourceId,
      bucket,
      bucketType: 'item',
      entityEntries: entityEntry ? [entityEntry] : [],
      bucketValues: {
        request: response.request || createDefaultRequest(pageKey, ''),
        currentKey: entityEntry ? entityEntry.contentKey : '',
        updatedAt: getResponseFetchedAt(response)
      }
    };
  }

  // 类型: string。
  // 作用: 首页使用 moduleKey 定位区域桶，普通列表页保持空字符串。
  const moduleKey = response.moduleKey || '';

  // 类型: object。
  // 作用: 提前定位列表目标桶；未知首页区域会在任何实体和身份写入前失败。
  const bucket = getPageBucket(pageKey, moduleKey);

  // 类型: Array<object>。
  // 作用: 读取标准列表内容；非数组按空列表准备，不修改现有页面桶。
  const responseItems = Array.isArray(response.items) ? response.items : [];

  // 类型: Array<object>。
  // 作用: 在第一次写入前完成全部 ContentItem 标准化和 contentKey 生成。
  const entityEntries = responseItems
    .map((contentItem) => createContentEntityEntry(contentItem, sourceId))
    .filter(Boolean);

  // 返回值类型: object。
  // 作用: 返回列表完整提交计划，后续采用阶段只执行确定性的 store 赋值。
  return {
    sourceId,
    bucket,
    bucketType: 'list',
    entityEntries,
    bucketValues: {
      request: response.request || createDefaultRequest(pageKey, moduleKey),
      pagination: response.pagination || createDefaultPagination(),
      itemKeys: entityEntries.map((entry) => entry.contentKey),
      updatedAt: getResponseFetchedAt(response)
    }
  };
}

/**
 * 采用已经准备完成的内容提交计划。
 * 副作用: 按实体池、目标页面桶、activeSourceId 的固定顺序修改 siteContentStore。
 * 前置条件: createContentCommitPlan 已经完成全部响应 getter 读取、桶定位和 contentKey 转换。
 *
 * @param {object} commitPlan 内容提交计划。
 * @param {string} commitPlan.sourceId 成功提交后采用的真实数据源身份。
 * @param {object} commitPlan.bucket 待更新的目标页面桶。
 * @param {string} commitPlan.bucketType list 或 item，决定目标桶字段集合。
 * @param {Array<object>} commitPlan.entityEntries 待写入实体池的标准条目。
 * @param {object} commitPlan.bucketValues 已准备完成的目标桶字段。
 * @returns {object} 写入后的目标页面桶。
 */
function applyContentCommitPlan(commitPlan) {
  // 循环类型: Array.prototype.forEach。
  // 初始值: 提交计划中的第一个 ContentItem 实体条目。
  // 终止条件: 当前响应全部可定位实体都写入共享池。
  // 循环作用: 使用 Vue.set 采用预先生成的动态实体 key，提交阶段不再读取响应或生成 key。
  commitPlan.entityEntries.forEach((entry) => {
    // 副作用: 写入或覆盖共享池中的唯一内容实体。
    // 影响范围: Vue 2 页面 selector 可以响应动态 contentKey 的新增和内容更新。
    Vue.set(siteContentStore.entities.contentItems, entry.contentKey, entry.contentItem);
  });

  // 副作用: 保存目标桶最后一次请求。
  // 影响范围: 后续刷新和数据流诊断复用已经标准化的请求字段。
  commitPlan.bucket.request = commitPlan.bucketValues.request;

  // 条件分支: 当前计划属于单内容桶时进入。
  // 执行内容: 采用 currentKey；列表桶则采用 pagination 和 itemKeys。
  if (commitPlan.bucketType === 'item') {
    commitPlan.bucket.currentKey = commitPlan.bucketValues.currentKey;
  } else {
    commitPlan.bucket.pagination = commitPlan.bucketValues.pagination;
    commitPlan.bucket.itemKeys = commitPlan.bucketValues.itemKeys;
  }

  // 副作用: 保存目标桶更新时间。
  // 影响范围: 页面状态和链路诊断只会观察到与本次桶数据一致的时间。
  commitPlan.bucket.updatedAt = commitPlan.bucketValues.updatedAt;

  // 副作用: 在实体与目标桶全部采用后，最后更新当前内容运行态活动源。
  // 影响范围: 后续省略 sourceId 的页面请求不会观察到身份先于内容切换的半状态。
  Vue.set(siteContentStore, 'activeSourceId', commitPlan.sourceId);

  // 返回值类型: object。
  // 作用: 返回已经完成本次计划采用的目标桶，保持 service 现有返回契约。
  return commitPlan.bucket;
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
  // 作用: 在第一次 store 写入前完成响应校验、目标桶定位、响应字段读取和实体 key 生成。
  const commitPlan = createContentCommitPlan(response);

  // 返回值类型: object。
  // 作用: 采用完整提交计划并返回目标桶；activeSourceId 在实体与桶字段之后最后更新。
  return applyContentCommitPlan(commitPlan);
}

// 导出类型: default object。
// 导出内容: 全站内容运行态存储对象。
// 外部调用方: 页面组件、sourceDataService 和后续调试面板。
// 使用场景: 读取或观察全站内容数据桶。
export default siteContentStore;
