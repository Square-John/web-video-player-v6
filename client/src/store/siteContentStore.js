/*
  siteContentStore.js 模块说明

  - 文件职责:
      提供项目内容数据主干的本地运行态存储对象。
      供 sourceDataService.js 写入数据源响应，并把 ContentItem 归一化到全站内容实体共享池。
      供首页、电影页、电视剧页、搜索页、详情页和播放页通过 selector 读取页面数据块。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 1 条，自定义 2 条):
      Vue: 第三方库，提供 Vue.observable 和 Vue.set，让轻量 store 具备 Vue 2 响应式能力。
      buildContentKey/getContentKeyFromItem/isValidContentKey: 自定义工具函数，提供 contentKey 生成和校验能力。

  - 模块级常量:
      DEFAULT_PAGE: number，空桶默认页码。
      DEFAULT_PAGE_SIZE: number，空桶默认每页数量。
      HOME_BUCKET_KEYS: Array<string>，首页支持的数据桶名称。
      LIST_PAGE_KEYS: Array<string>，单列表页面名称。
      ITEM_PAGE_KEYS: Array<string>，单内容页面名称。
      SITE_CONTENT_REQUEST_STATUS: object，页面桶请求事务阶段枚举。
      CONTENT_ENTITY_PROJECTION: object，列表、详情和播放响应的实体投影类型。
      CONTENT_ENTITY_FIELD_PRIORITY: object，增强字段按投影类型采用的优先级。

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
      createRequestTransaction(): 创建页面桶唯一请求事务初始值。
      getRequestBucket(pageKey, moduleKey): 定位列表或单内容请求桶。
      resolveSourceDataRequestTransaction(transaction, resolvedSourceId): 为最新 loading 事务补齐 Runtime 解析的真实源。
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
              初始化唯一 ContentItem 字典和增强字段投影元数据，确保页面桶只保存内容引用 key。
      normalizeContentItemForStore(contentItem, fallbackSourceId)
          - params:
              -- contentItem: object，数据源返回的 ContentItem。
              -- fallbackSourceId: string，响应所属数据源 id。
          - return:
              object|null，可写入实体池的 ContentItem。
          - description:
              为缺少 sourceId 的内容对象补齐响应 sourceId，并过滤非对象内容。
      mergeContentEntityProjection(existingContentItem, incomingContentItem, incomingProjection, existingProjections)
          - params:
              -- existingContentItem: object|null，实体池已有唯一 ContentItem。
              -- incomingContentItem: object，本次响应提供的 ContentItem 投影。
              -- incomingProjection: string，本次响应所属列表、详情或播放投影。
              -- existingProjections: object|null，已有增强字段投影来源。
          - return:
              object，信息不降级的唯一 ContentItem 与字段投影元数据。
          - description:
              让普通列表或任何 null 增强响应更新通用展示字段时不能清空详情、播放目录或已解析媒体字段。
      createContentEntityEntry(contentItem, fallbackSourceId, projection)
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
      commitSourceContentItem(contentItem, fallbackSourceId)
          - params:
              -- contentItem: object，后台详情补全返回的 ContentItem。
              -- fallbackSourceId: string，标准响应所属数据源 id。
          - return:
              object|null，已写入实体池的 ContentItem。
          - description:
               只按 contentKey 采用后台补全实体，不修改页面桶、页面事务或最近页面响应来源。
      commitContentEntityProjection(contentItem, fallbackSourceId, projection)
          - params:
              -- contentItem: object，待采用的标准 ContentItem。
              -- fallbackSourceId: string，内容所属数据源 id。
              -- projection: string，当前列表、详情或播放投影。
          - return:
              object|null，已写入实体池的 ContentItem。
          - description:
              复用唯一实体合并和响应式写入链，供页面壳与后台详情补全选择自己的正式投影。
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
      getPageRequestTransaction: Function，根据 pageKey/moduleKey 读取列表桶请求事务隔离快照。
      getCurrentContentItem: Function，根据 pageKey 读取单内容页当前内容。
      getActiveSourceId: Function，读取最近成功提交内容响应的数据源 id。
      commitSourceContentItem: Function，独立采用后台补全的单个内容实体。
      commitSourceContentShell: Function，以列表投影独立采用路由页面壳。
      commitSourceDataResponse: Function，写入标准数据源响应。
      beginSourceDataRequest: Function，发布页面桶 loading 请求事务。
      resolveSourceDataRequestTransaction: Function，为最新 loading 事务补齐真实 Provider 身份。
      failSourceDataRequest: Function，为仍是最新的请求发布 error/stale。
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

import {
  // 导入来源: ../config/siteContentSession.config.js；导入内容: SITE_CONTENT_SESSION_PAGE_KEYS；文件作用: 限制快照导出和水合全部六类页面桶。
  SITE_CONTENT_SESSION_PAGE_KEYS,
  // 导入来源: ../config/siteContentSession.config.js；导入内容: SITE_CONTENT_SESSION_PREVIOUS_SCHEMA_VERSION；文件作用: 识别只含搜索、详情和播放桶的紧邻旧快照。
  SITE_CONTENT_SESSION_PREVIOUS_SCHEMA_VERSION,
  // 导入来源: ../config/siteContentSession.config.js；导入内容: SITE_CONTENT_SESSION_SCHEMA_VERSION；文件作用: 校验和生成当前标签页快照版本。
  SITE_CONTENT_SESSION_SCHEMA_VERSION
} from '../config/siteContentSession.config.js';

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

// 类型: object；作用: 冻结页面桶唯一请求事务阶段，页面不使用健康状态替代当前请求结果。
export const SITE_CONTENT_REQUEST_STATUS = Object.freeze({
  idle: 'idle',
  loading: 'loading',
  success: 'success',
  error: 'error'
});

// 类型: object。
// 作用: 把页面响应归并为三种平台级内容投影；该枚举不包含 sourceId、域名或 Provider 业务。
const CONTENT_ENTITY_PROJECTION = Object.freeze({
  // 类型: string；作用: 首页、目录和搜索响应只提供通用列表展示投影。
  list: 'list',
  // 类型: string；作用: 详情响应可以权威更新 detail 和统一 playCatalog。
  detail: 'detail',
  // 类型: string；作用: 播放响应可以刷新统一 playCatalog，并独占 playback 已解析媒体投影。
  player: 'player'
});

// 类型: object。
// 作用: 按增强字段定义三类投影的采用优先级；数字只用于同一字段内部比较，越大表示该字段信息越权威。
const CONTENT_ENTITY_FIELD_PRIORITY = Object.freeze({
  // 类型: object；作用: detail 响应最有权更新详情，player 可在尚无详情时提供次级补全，list 不能降级详情。
  detail: Object.freeze({ list: 0, player: 1, detail: 2 }),
  // 类型: object；作用: detail 与 player 都可用最新非空成功响应刷新统一目录，list 或 null 永远不能清理它。
  playCatalog: Object.freeze({ list: 0, detail: 1, player: 1 }),
  // 类型: object；作用: 只有 player 响应可以权威更新已解析媒体，列表和详情的 null/空结构不能清空它。
  playback: Object.freeze({ list: 0, detail: 0, player: 1 })
});

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
 * 通过 JSON 边界创建标签页快照隔离副本。
 * 纯函数: 不修改输入；不可序列化值由 JSON.stringify 明确失败关闭。
 *
 * @param {*} value Store 中准备进入会话快照的标准值。
 * @returns {*} 与 Store 无引用共享的 JSON 值。
 */
function cloneContentSessionValue(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 创建页面桶唯一请求事务初始值。
 * 纯函数: 每次返回新对象，不在多个桶之间共享状态。
 *
 * @returns {object} idle 且没有请求身份、错误或 stale 内容的事务。
 */
function createRequestTransaction() {
  return {
    requestId: '',
    requestedSourceId: '',
    resolvedSourceId: '',
    status: SITE_CONTENT_REQUEST_STATUS.idle,
    error: null,
    stale: false
  };
}

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

    // 类型: object；作用: 保存当前列表桶唯一请求身份、阶段、错误和跨源旧内容可见性。
    transaction: createRequestTransaction(),

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

    // 类型: object；作用: 保存当前单内容桶唯一请求身份、阶段、错误和跨源旧内容可见性。
    transaction: createRequestTransaction(),

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
 * @returns {object} return.contentItemProjections 以 contentKey 为键保存增强字段最近权威投影。
 */
function createEntitiesState() {
  // 返回值类型: object。
  // 作用: 初始化内容实体池，后续列表桶和单内容桶只保存这里的引用 key。
  return {
    // 类型: Record<string, object>。
    // 作用: 保存全站唯一 ContentItem，同一个 sourceId + contentId 只在这里保留一份。
    contentItems: {},

    // 类型: Record<string, object>。
    // 作用: 只记录 detail/playCatalog/playback 的投影来源，不复制 ContentItem，也不供页面直接渲染。
    contentItemProjections: {}
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
 * 把同一 contentKey 的新页面投影合并到唯一 ContentItem。
 * 纯函数: 不修改已有实体、响应对象、投影元数据或 store；首次采用保留响应对象引用，已有实体时返回新合并对象。
 * 成功路径: 通用展示字段采用最新响应；detail/playCatalog/playback 只有非空值且本次投影优先级不低于已有来源时采用。
 * 失败路径: null 增强字段表示本次没有交付有效信息，不得清空已有值或登记新的权威来源。
 *
 * @param {object|null} existingContentItem 实体池已有 ContentItem；首次采用时为 null。
 * @param {object} incomingContentItem 当前响应已经补齐 sourceId 的 ContentItem。
 * @param {string} incomingProjection CONTENT_ENTITY_PROJECTION 中的当前响应投影。
 * @param {object|null} existingProjections 已有 detail/playCatalog/playback 投影来源；首次采用时为 null。
 * @returns {{contentItem: object, projections: object}} 信息不降级的实体和字段投影。
 */
function mergeContentEntityProjection(
  existingContentItem,
  incomingContentItem,
  incomingProjection,
  existingProjections
) {
  // 类型: boolean；作用: 区分首次采用和同 key 更新，首次采用保持既有引用契约。
  const hasExistingContentItem = Boolean(
    existingContentItem
    && typeof existingContentItem === 'object'
    && !Array.isArray(existingContentItem)
  );
  // 类型: object；作用: 过滤异常旧值，同 key 更新时作为通用字段合并基线。
  const safeExistingContentItem = existingContentItem
    && typeof existingContentItem === 'object'
    && !Array.isArray(existingContentItem)
    ? existingContentItem
    : {};
  // 类型: object；作用: 过滤异常投影元数据，避免损坏诊断字段影响真实内容采用。
  const safeExistingProjections = existingProjections
    && typeof existingProjections === 'object'
    && !Array.isArray(existingProjections)
    ? existingProjections
    : {};
  // 类型: object；作用: 首次采用保留 Provider 对象引用；已有实体时让通用展示字段采用最新响应并保留缺失字段。
  const mergedContentItem = hasExistingContentItem
    ? {
        ...safeExistingContentItem,
        ...incomingContentItem
      }
    : incomingContentItem;
  // 类型: object；作用: 创建隔离投影结果，后续字段循环不会修改 store 中的旧元数据。
  const mergedProjections = {
    ...safeExistingProjections
  };

  // 循环类型: Object.entries + for...of。
  // 顺序意义: 按固定 detail、playCatalog、playback 字段表逐项比较，不依赖响应对象属性顺序。
  // 循环作用: 阻止低完整度普通页面响应覆盖已由更权威页面建立的增强字段。
  for (const [fieldName, priorities] of Object.entries(CONTENT_ENTITY_FIELD_PRIORITY)) {
    // 条件分支: 当前响应根本没有提供该增强字段时进入。
    // 执行内容: 保留已有字段和投影来源；缺失字段不被解释为空值或清理指令。
    if (!Object.prototype.hasOwnProperty.call(incomingContentItem, fieldName)) {
      continue;
    }

    // 类型: boolean；作用: 只有旧实体已有非 null 增强对象时，后续空响应或低权威响应才需要保护它。
    const existingFieldHasValue = Object.prototype.hasOwnProperty.call(safeExistingContentItem, fieldName)
      && safeExistingContentItem[fieldName] !== null
      && safeExistingContentItem[fieldName] !== undefined;
    // 类型: boolean；作用: null/undefined 表示当前响应没有交付有效增强信息，不能取得字段权威或清理已有值。
    const incomingFieldHasValue = incomingContentItem[fieldName] !== null
      && incomingContentItem[fieldName] !== undefined;

    // 条件分支: 当前响应显式携带空增强字段时进入。
    // 执行内容: 已有有效值则恢复该值；首次空值只保留对象形状，不登记虚假的字段投影来源。
    if (!incomingFieldHasValue) {
      // 条件分支: 旧实体已经保存当前增强字段的非空有效值时进入。
      // 执行内容: 恢复旧值，阻止上方通用对象展开产生的 null 覆盖进入唯一实体池。
      if (existingFieldHasValue) {
        mergedContentItem[fieldName] = safeExistingContentItem[fieldName];
      }
      continue;
    }

    // 类型: string；作用: 读取当前字段上次采用的投影来源，未知或首次状态按最低 list 处理。
    const existingProjection = typeof safeExistingProjections[fieldName] === 'string'
      ? safeExistingProjections[fieldName]
      : CONTENT_ENTITY_PROJECTION.list;
    // 类型: number；作用: 当前已有字段来源在本字段内的权威级别。
    const existingPriority = priorities[existingProjection] ?? priorities.list;
    // 类型: number；作用: 本次响应投影在当前字段内的权威级别。
    const incomingPriority = priorities[incomingProjection] ?? priorities.list;

    // 条件分支: 已有实体真正包含该字段，且本次响应权威级别更低时进入。
    // 执行内容: 恢复已有增强值和来源，避免列表空数组/null 让常驻播放器主动卸载。
    if (existingFieldHasValue && incomingPriority < existingPriority) {
      mergedContentItem[fieldName] = safeExistingContentItem[fieldName];
      mergedProjections[fieldName] = existingProjection;
      continue;
    }

    // 状态交接: 本次响应首次提供或权威级别不低于已有来源，登记真实投影供后续采用比较。
    mergedProjections[fieldName] = incomingProjection;
  }

  return {
    // 类型: object；作用: 页面 selector 继续读取的唯一标准 ContentItem。
    contentItem: mergedContentItem,
    // 类型: object；作用: Store 内部采用元数据，不进入 ContentItem、页面桶或持久化。
    projections: mergedProjections
  };
}

/**
 * 准备单个 ContentItem 实体写入条目。
 * 纯函数: 不修改 siteContentStore，只返回后续提交需要的 contentKey 和 ContentItem。
 * 使用场景: 列表响应和单内容响应在第一次 store 写入前统一生成实体计划。
 *
 * @param {object} contentItem 数据源返回的 ContentItem。
 * @param {string} fallbackSourceId 响应所属数据源 id，用于内容缺少 sourceId 时兜底。
 * @param {string} projection 当前响应的列表、详情或播放投影。
 * @returns {object|null} 实体写入条目；无法生成 key 时返回 null。
 * @returns {string} return.contentKey 实体池动态字段 key。
 * @returns {object} return.contentItem 已合并且信息不降级的 ContentItem。
 * @returns {object} return.projections detail/playCatalog/playback 的权威投影来源。
 */
function createContentEntityEntry(contentItem, fallbackSourceId, projection) {
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

  // 类型: object|null；作用: 读取同 contentKey 已有唯一实体，准备阶段只读且不产生响应式写入。
  const existingContentItem = siteContentStore.entities.contentItems[contentKey] || null;
  // 类型: object|null；作用: 读取已有增强字段投影，决定本次响应是否有权替换对应字段。
  const existingProjections = siteContentStore.entities.contentItemProjections[contentKey] || null;
  // 类型: object；作用: 在第一次 store 写入前完成全部对象 getter 和字段优先级计算。
  const mergedEntity = mergeContentEntityProjection(
    existingContentItem,
    normalizedContentItem,
    projection,
    existingProjections
  );

  // 返回值类型: object。
  // 作用: 返回不产生 store 副作用的实体写入条目，供完整提交计划统一采用。
  return {
    // 类型: string。
    // 作用: 动态写入 entities.contentItems 时使用的唯一字段 key，同时进入页面桶引用列表。
    contentKey,

    // 类型: object。
    // 作用: 提交阶段写入实体池的信息不降级 ContentItem。
    contentItem: mergedEntity.contentItem,

    // 类型: object。
    // 作用: 与 ContentItem 同批采用的增强字段投影来源，不复制业务字段。
    projections: mergedEntity.projections
  };
}

/**
 * 准备列表响应的唯一内容实体条目。
 * 纯函数: 只读取响应条目和当前实体池，不修改响应、页面桶或 Store；同一 contentKey 只保留一个页面引用。
 * 成功路径: 按 Provider 返回顺序保留首次出现位置，并把重复条目的标准字段按同一 list 投影合并到该实体。
 * 失败路径: 无法生成 contentKey 的条目被忽略，调用方得到可直接写入 itemKeys 的唯一条目集合。
 *
 * @param {Array<object>} responseItems 列表响应内容候选。
 * @param {string} sourceId 响应所属数据源身份。
 * @returns {Array<object>} contentKey 唯一且保持 Provider 顺序的实体写入条目。
 */
function createUniqueListEntityEntries(responseItems, sourceId) {
  // 类型: Map<string, object>；作用: 按规范 contentKey 收集列表实体，消除源站重复行而保留首次排序位置。
  const entriesByContentKey = new Map();
  responseItems.forEach((contentItem) => {
    // 类型: object|null；作用: 将当前源站条目转换为共享实体池可采用的标准条目。
    const entry = createContentEntityEntry(
      contentItem,
      sourceId,
      CONTENT_ENTITY_PROJECTION.list
    );
    // 条件分支: 当前条目缺少有效实体身份时进入；执行内容: 忽略无法安全进入页面桶的条目。
    if (!entry) return;
    // 类型: object|undefined；作用: 读取同一列表响应中此前已经登记的规范实体条目。
    const existingEntry = entriesByContentKey.get(entry.contentKey);
    // 条件分支: 当前规范实体首次出现时进入；执行内容: 登记条目并保留 Provider 返回顺序。
    if (!existingEntry) {
      entriesByContentKey.set(entry.contentKey, entry);
      return;
    }
    // 类型: object；作用: 合并重复行的标准字段和投影，避免后出现的完整信息被重复引用丢弃。
    const mergedEntity = mergeContentEntityProjection(
      existingEntry.contentItem,
      entry.contentItem,
      CONTENT_ENTITY_PROJECTION.list,
      existingEntry.projections
    );
    entriesByContentKey.set(entry.contentKey, {
      ...existingEntry,
      contentItem: mergedEntity.contentItem,
      projections: mergedEntity.projections
    });
  });
  // 返回值类型: Array<object>；作用: 输出去重后的实体条目，供实体池和 itemKeys 同一事务采用。
  return [...entriesByContentKey.values()];
}

/**
 * 归一化页面桶内容引用。
 * 纯函数: 只读取候选 key 数组，不读取或修改 Store；返回顺序稳定且每个 key 只出现一次。
 * 失败路径: 非数组、非法 key 和重复 key 被过滤，避免旧快照或异常响应造成重复 Vue key。
 *
 * @param {*} contentKeys 页面桶或会话快照中的内容引用候选。
 * @returns {Array<string>} 合法且唯一的 contentKey 列表。
 */
function normalizeUniqueContentKeys(contentKeys) {
  // 类型: Set<string>；作用: 记录已经进入结果的内容引用，阻止同一页面桶重复渲染实体。
  const seenKeys = new Set();
  // 类型: Array<string>；作用: 把非数组输入收敛为空列表，供后续过滤安全执行。
  const safeContentKeys = Array.isArray(contentKeys) ? contentKeys : [];
  return safeContentKeys.filter((contentKey) => {
    // 条件分支: 当前 key 非法或已经进入结果时进入；执行内容: 拒绝不能安全定位或重复渲染的引用。
    if (!isValidContentKey(contentKey) || seenKeys.has(contentKey)) return false;
    seenKeys.add(contentKey);
    return true;
  });
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
  // 类型: Array<string>；作用: 先消除新响应或旧快照中的重复引用，再解析完整 ContentItem。
  const safeContentKeys = normalizeUniqueContentKeys(contentKeys);

  // 返回值类型: Array<object>。
  // 作用: 将有效 contentKey 映射为 ContentItem，并过滤掉已经不存在的实体。
  return safeContentKeys
    .filter(isValidContentKey)
    .map((contentKey) => getContentItemByKey(contentKey))
    .filter(Boolean);
}

// 类型: object。
// 作用: 全站内容运行态响应式存储对象；当前阶段不是 Vuex，但通过 Vue.observable 保证页面 selector 能响应异步写入。
// 字段: activeSourceId，string，最近成功提交内容响应的真实数据源 id；不代表 Manager 当前活动源。
// 字段: entities，object，全站内容实体共享池，同一个 sourceId + contentId 只保存一份 ContentItem。
// 字段: pages，object，全站页面数据桶集合。
export const siteContentStore = Vue.observable({
  // 类型: string。
  // 作用: 最近成功提交内容响应的数据源 id；初始为空，只用于诊断已采用页面数据来源，不决定下一次请求源。
  activeSourceId: '',

  // 类型: object。
  // 作用: 全站内容实体共享池，页面桶通过 itemKeys/currentKey 引用这里的 ContentItem。
  entities: createEntitiesState(),

  // 类型: object。
  // 作用: 全站页面数据桶集合，所有页面后续都从这里读取内容数据。
  pages: createPagesState()
});

/**
 * 重置全站内容存储。
 * 副作用: 原地覆盖 siteContentStore 的 activeSourceId、entities 和 pages。
 * 使用场景: 测试、切换数据源重建状态或后续退出登录时清理内容运行态。
 *
 * @returns {object} 重置后的 siteContentStore。
 */
export function resetSiteContentStore() {
  // 副作用: 使用 Vue.set 清空当前响应身份。
  // 影响范围: 后续未显式传 sourceId 的请求会从共享 Runtime 的 SourceManagerState 重新解析活动源或默认源。
  Vue.set(siteContentStore, 'activeSourceId', '');

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
 * 导出一个列表桶的标签页快照字段。
 * 纯函数: 只读取 PageBucket 和实体池，过滤不能定位的引用并登记实际实体集合。
 *
 * @param {*} sourceBucket 响应式列表 PageBucket 候选。
 * @param {Set<string>} referencedContentKeys 当前快照引用实体集合。
 * @returns {object} 不含 transaction 的隔离列表桶。
 */
function createSessionListBucketSnapshot(sourceBucket, referencedContentKeys) {
  // 类型: Array<string>；作用: 过滤列表桶中能在当前实体池定位的内容引用。
  const itemKeys = normalizeUniqueContentKeys(sourceBucket?.itemKeys)
    .filter((contentKey) => (
        isValidContentKey(contentKey) && Boolean(getContentItemByKey(contentKey))
      ));
  itemKeys.forEach(contentKey => referencedContentKeys.add(contentKey));
  return cloneContentSessionValue({
    request: sourceBucket?.request || {},
    pagination: sourceBucket?.pagination || {},
    itemKeys,
    updatedAt: typeof sourceBucket?.updatedAt === 'string' ? sourceBucket.updatedAt : ''
  });
}

/**
 * 导出一个单内容桶的标签页快照字段。
 * 纯函数: 只保留能够在实体池定位的 currentKey，不导出 transaction。
 *
 * @param {*} sourceBucket 响应式单内容 PageBucket 候选。
 * @param {Set<string>} referencedContentKeys 当前快照引用实体集合。
 * @returns {object} 不含 transaction 的隔离单内容桶。
 */
function createSessionItemBucketSnapshot(sourceBucket, referencedContentKeys) {
  // 类型: string；作用: 保留能够在当前实体池定位的单内容桶当前实体键。
  const currentKey = isValidContentKey(sourceBucket?.currentKey)
    && getContentItemByKey(sourceBucket.currentKey)
    ? sourceBucket.currentKey
    : '';
  // 条件分支: 当前内容键有效且非空时进入；执行内容: 将单内容桶引用登记到快照实体集合。
  if (currentKey) referencedContentKeys.add(currentKey);
  return cloneContentSessionValue({
    request: sourceBucket?.request || {},
    currentKey,
    updatedAt: typeof sourceBucket?.updatedAt === 'string' ? sourceBucket.updatedAt : ''
  });
}

/**
 * 把紧邻旧版内容会话快照升级为当前完整页面结构。
 * 纯函数: 不修改输入；旧版三个页面桶和全部实体原样隔离复制，新增页面使用正式空桶。
 * 失败路径: 非旧版或当前版普通对象返回 null，调用方拒绝水合。
 *
 * @param {*} snapshot Repository 读取的快照候选。
 * @returns {object|null} 当前 schema 候选或 null。
 */
function migrateSiteContentSessionSnapshot(snapshot) {
  // 条件分支: 输入不是普通对象时进入；执行内容: 拒绝无法安全读取 schemaVersion 的快照。
  if (!isPlainObject(snapshot)) return null;
  // 条件分支: 输入已经是当前 schema 时进入；执行内容: 隔离复制当前快照并跳过旧版迁移。
  if (snapshot.schemaVersion === SITE_CONTENT_SESSION_SCHEMA_VERSION) {
    return cloneContentSessionValue(snapshot);
  }
  // 条件分支: 输入不是当前紧邻旧 schema 时进入；执行内容: 拒绝无连续迁移链的未知版本。
  if (snapshot.schemaVersion !== SITE_CONTENT_SESSION_PREVIOUS_SCHEMA_VERSION) return null;

  // 类型: object；作用: 提供迁移过程中缺失页面桶的正式空结构来源。
  const emptyPages = createPagesState();
  // 类型: Set<string>；作用: 收集迁移生成首页桶时实际引用的实体身份。
  const emptyReferencedContentKeys = new Set();
  // 类型: Record<string, object>；作用: 建立当前版本首页五个模块桶的迁移结果。
  const home = {};
  HOME_BUCKET_KEYS.forEach((moduleKey) => {
    home[moduleKey] = createSessionListBucketSnapshot(
      emptyPages.home[moduleKey],
      emptyReferencedContentKeys
    );
  });
  return cloneContentSessionValue({
    schemaVersion: SITE_CONTENT_SESSION_SCHEMA_VERSION,
    activeSourceId: snapshot.activeSourceId,
    entities: snapshot.entities,
    pages: {
      home,
      movie: createSessionListBucketSnapshot(emptyPages.movie, emptyReferencedContentKeys),
      tv: createSessionListBucketSnapshot(emptyPages.tv, emptyReferencedContentKeys),
      search: snapshot.pages?.search,
      detail: snapshot.pages?.detail,
      player: snapshot.pages?.player
    }
  });
}

/**
 * 校验并重建一个列表桶。
 * 纯函数: 使用正式 PageBucket 工厂重建 idle 事务，先登记引用再返回隔离桶。
 *
 * @param {*} snapshotBucket 快照列表桶候选。
 * @param {string} pageKey 页面身份。
 * @param {string} moduleKey 首页模块身份，普通列表为空字符串。
 * @param {Set<string>} referencedContentKeys 当前快照引用实体集合。
 * @returns {object|null} 合法 PageBucket 或 null。
 */
function hydrateSessionListBucket(snapshotBucket, pageKey, moduleKey, referencedContentKeys) {
  // 条件分支: 快照列表桶任一结构、身份或时间字段无效时进入；执行内容: 拒绝该桶并阻止部分水合。
  if (!isPlainObject(snapshotBucket)
    || !isPlainObject(snapshotBucket.request)
    || snapshotBucket.request.pageKey !== pageKey
    || snapshotBucket.request.moduleKey !== moduleKey
    || !isPlainObject(snapshotBucket.pagination)
    || !Array.isArray(snapshotBucket.itemKeys)
    || snapshotBucket.itemKeys.some(contentKey => !isValidContentKey(contentKey))
    || typeof snapshotBucket.updatedAt !== 'string') return null;
  // 遍历作用: 将已通过格式校验的全部列表实体键登记到快照完整性集合。
  // 类型: Array<string>；作用: 保存已经去重的列表引用，兼容旧快照中的重复 key 而不改变实体身份。
  const uniqueItemKeys = normalizeUniqueContentKeys(snapshotBucket.itemKeys);
  uniqueItemKeys.forEach(contentKey => referencedContentKeys.add(contentKey));
  // 类型: object；作用: 使用正式页面工厂创建响应式空桶，再填充隔离快照字段。
  const hydratedBucket = createPageBucket(pageKey, moduleKey);
  hydratedBucket.request = cloneContentSessionValue(snapshotBucket.request);
  hydratedBucket.pagination = cloneContentSessionValue(snapshotBucket.pagination);
  hydratedBucket.itemKeys = uniqueItemKeys;
  hydratedBucket.updatedAt = snapshotBucket.updatedAt;
  return hydratedBucket;
}

/**
 * 校验并重建一个单内容桶。
 * 纯函数: 使用正式 ItemBucket 工厂重建 idle 事务，非空 currentKey 登记为实体完整性要求。
 *
 * @param {*} snapshotBucket 快照单内容桶候选。
 * @param {string} pageKey detail 或 player。
 * @param {Set<string>} referencedContentKeys 当前快照引用实体集合。
 * @returns {object|null} 合法单内容桶或 null。
 */
function hydrateSessionItemBucket(snapshotBucket, pageKey, referencedContentKeys) {
  // 条件分支: 快照单内容桶任一结构、身份或时间字段无效时进入；执行内容: 拒绝该桶并阻止部分水合。
  if (!isPlainObject(snapshotBucket)
    || !isPlainObject(snapshotBucket.request)
    || snapshotBucket.request.pageKey !== pageKey
    || typeof snapshotBucket.currentKey !== 'string'
    || (snapshotBucket.currentKey && !isValidContentKey(snapshotBucket.currentKey))
    || typeof snapshotBucket.updatedAt !== 'string') return null;
  // 条件分支: 单内容桶带有当前实体键时进入；执行内容: 登记该键以便后续校验实体完整性。
  if (snapshotBucket.currentKey) referencedContentKeys.add(snapshotBucket.currentKey);
  // 类型: object；作用: 使用正式单内容工厂创建响应式空桶，再填充隔离快照字段。
  const hydratedBucket = createItemBucket(pageKey);
  hydratedBucket.request = cloneContentSessionValue(snapshotBucket.request);
  hydratedBucket.currentKey = snapshotBucket.currentKey;
  hydratedBucket.updatedAt = snapshotBucket.updatedAt;
  return hydratedBucket;
}

/**
 * 导出当前标签页全部内容页面的标准刷新快照。
 * 纯函数: 只读取六类页面桶及其实际引用实体，返回与响应式 Store 隔离的 JSON 对象。
 * 禁止范围: 不导出请求事务、筛选元数据、导航、媒体会话、用户内容或 Provider 私有状态。
 *
 * @returns {object} 当前版本 SiteContentSessionSnapshot。
 */
export function createSiteContentSessionSnapshot() {
  // 类型: Set<string>；作用: 记录六类页面桶导出的实体引用，避免快照携带无引用运行时实体。
  const referencedContentKeys = new Set();
  // 类型: Record<string, object>；作用: 收集当前版本六类页面桶及首页模块桶。
  const pages = {};
  SITE_CONTENT_SESSION_PAGE_KEYS.forEach((pageKey) => {
    // 条件分支: 当前页面身份是首页时进入；执行内容: 逐个导出首页正式模块桶。
    if (pageKey === 'home') {
      pages.home = {};
      HOME_BUCKET_KEYS.forEach((moduleKey) => {
        pages.home[moduleKey] = createSessionListBucketSnapshot(
          siteContentStore.pages.home[moduleKey],
          referencedContentKeys
        );
      });
      return;
    }
    // 条件分支: 当前页面身份是电影、电视剧或搜索列表时进入；执行内容: 导出对应列表桶。
    if (LIST_PAGE_KEYS.includes(pageKey)) {
      pages[pageKey] = createSessionListBucketSnapshot(
        siteContentStore.pages[pageKey],
        referencedContentKeys
      );
      return;
    }
    pages[pageKey] = createSessionItemBucketSnapshot(
      siteContentStore.pages[pageKey],
      referencedContentKeys
    );
  });

  // 类型: Record<string, object>；作用: 收集页面引用的完整内容实体。
  const contentItems = {};
  // 类型: Record<string, object>；作用: 收集与内容实体配套的页面投影字段。
  const contentItemProjections = {};
  referencedContentKeys.forEach((contentKey) => {
    contentItems[contentKey] = cloneContentSessionValue(
      siteContentStore.entities.contentItems[contentKey]
    );
    contentItemProjections[contentKey] = cloneContentSessionValue(
      siteContentStore.entities.contentItemProjections[contentKey] || {}
    );
  });
  return {
    schemaVersion: SITE_CONTENT_SESSION_SCHEMA_VERSION,
    activeSourceId: typeof siteContentStore.activeSourceId === 'string'
      ? siteContentStore.activeSourceId
      : '',
    entities: { contentItems, contentItemProjections },
    pages
  };
}

/**
 * 在 Vue 挂载前升级并采用当前标签页全部内容页面快照。
 * 副作用: 全部结构和引用验证通过后一次替换六类页面桶与引用实体；请求事务统一重建为 idle。
 * 成功路径: 当前版本直接采用，紧邻旧版先确定补齐首页、电影和电视剧空桶再采用。
 * 失败路径: 任一字段无效返回 false，Store 保持原状；清理快照由上层 Repository 协调。
 *
 * @param {*} snapshot SiteContentSessionSnapshot 候选。
 * @returns {boolean} 完整采用成功为 true，无效快照为 false。
 */
export function hydrateSiteContentSessionSnapshot(snapshot) {
  try {
    // 类型: object|null；作用: 将当前或紧邻旧版输入收敛为当前 schema 的隔离快照。
    const currentSnapshot = migrateSiteContentSessionSnapshot(snapshot);
    // 条件分支: 快照版本、实体根或页面根任一不符合正式结构时进入；执行内容: 拒绝整体水合并保持原 Store。
    if (!currentSnapshot
      || currentSnapshot.schemaVersion !== SITE_CONTENT_SESSION_SCHEMA_VERSION
      || typeof currentSnapshot.activeSourceId !== 'string'
      || !isPlainObject(currentSnapshot.entities)
      || !isPlainObject(currentSnapshot.entities.contentItems)
      || !isPlainObject(currentSnapshot.entities.contentItemProjections)
      || !isPlainObject(currentSnapshot.pages)) return false;

    // 类型: Set<string>；作用: 收集所有已验证页面桶引用的实体身份。
    const referencedContentKeys = new Set();
    // 类型: Record<string, object>；作用: 暂存全部通过校验的页面桶，完成后一次替换 Store。
    const hydratedPages = {};
    for (const pageKey of SITE_CONTENT_SESSION_PAGE_KEYS) {
        // 条件分支: 当前页面身份是首页时进入；执行内容: 校验首页根并逐个重建五个模块桶。
        if (pageKey === 'home') {
          // 类型: object；作用: 读取当前版本首页模块桶根节点。
        const snapshotHome = currentSnapshot.pages.home;
          // 条件分支: 首页根不是普通对象时进入；执行内容: 拒绝整个快照，避免首页部分水合。
          if (!isPlainObject(snapshotHome)) return false;
          // 类型: Record<string, object>；作用: 暂存通过校验的首页模块桶。
        const hydratedHome = {};
        for (const moduleKey of HOME_BUCKET_KEYS) {
          // 类型: object|null；作用: 暂存当前首页模块桶通过结构和引用校验后的响应式结果。
          const hydratedBucket = hydrateSessionListBucket(
            snapshotHome[moduleKey],
            'home',
            moduleKey,
            referencedContentKeys
          );
          // 条件分支: 当前首页模块桶无法完整水合时进入；执行内容: 拒绝整个快照而不是留下部分页面。
          if (!hydratedBucket) return false;
          hydratedHome[moduleKey] = hydratedBucket;
        }
        hydratedPages.home = hydratedHome;
        continue;
      }
      // 条件分支: 当前页面身份属于普通列表页时进入；执行内容: 校验并重建对应列表桶。
      if (LIST_PAGE_KEYS.includes(pageKey)) {
        // 类型: object|null；作用: 暂存当前普通列表页通过校验的响应式桶。
        const hydratedBucket = hydrateSessionListBucket(
          currentSnapshot.pages[pageKey],
          pageKey,
          '',
          referencedContentKeys
        );
        // 条件分支: 当前普通列表桶无法完整水合时进入；执行内容: 拒绝整个快照。
        if (!hydratedBucket) return false;
        hydratedPages[pageKey] = hydratedBucket;
        continue;
      }
      // 类型: object|null；作用: 暂存当前详情或播放单内容页通过校验的响应式桶。
      const hydratedBucket = hydrateSessionItemBucket(
        currentSnapshot.pages[pageKey],
        pageKey,
        referencedContentKeys
      );
      // 条件分支: 当前单内容桶无法完整水合时进入；执行内容: 拒绝整个快照。
      if (!hydratedBucket) return false;
      hydratedPages[pageKey] = hydratedBucket;
    }

    // 类型: Record<string, object>；作用: 暂存通过实体身份校验的内容实体。
    const hydratedEntities = {};
    // 类型: Record<string, object>；作用: 暂存通过实体身份校验的页面投影。
    const hydratedProjections = {};
    for (const contentKey of referencedContentKeys) {
      // 类型: object；作用: 读取当前引用键对应的内容实体候选。
      const contentItem = currentSnapshot.entities.contentItems[contentKey];
      // 类型: object；作用: 读取当前实体对应的页面投影候选，缺失时使用空对象。
      const projections = currentSnapshot.entities.contentItemProjections[contentKey] || {};
      // 条件分支: 实体身份或投影结构不匹配时进入；执行内容: 拒绝整个快照并保持现有 Store。
      if (!isPlainObject(contentItem)
        || getContentKeyFromItem(contentItem) !== contentKey
        || !isPlainObject(projections)) return false;
      hydratedEntities[contentKey] = cloneContentSessionValue(contentItem);
      hydratedProjections[contentKey] = cloneContentSessionValue(projections);
    }

    // 类型: object；作用: 创建新的响应式实体根，避免把旧运行时实体残留到水合结果。
    const hydratedEntityState = createEntitiesState();
    Object.entries(hydratedEntities).forEach(([contentKey, contentItem]) => {
      Vue.set(hydratedEntityState.contentItems, contentKey, contentItem);
      Vue.set(
        hydratedEntityState.contentItemProjections,
        contentKey,
        hydratedProjections[contentKey]
      );
    });
    // 原子边界: 只有全部页面桶、实体和引用校验完成后，才整体替换两个响应式根节点，避免残留旧运行时实体。
    Vue.set(siteContentStore, 'entities', hydratedEntityState);
    Vue.set(siteContentStore, 'pages', hydratedPages);
    Vue.set(siteContentStore, 'activeSourceId', currentSnapshot.activeSourceId);
    return true;
  } catch {
    return false;
  }
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
 * 以指定投影独立采用一个 ContentItem 实体。
 * 副作用: 只写 entities.contentItems 和 contentItemProjections，不修改 activeSourceId、页面桶或请求事务。
 * 成功路径: 标准内容形成稳定 key 后复用信息不降级合并并通过 Vue.set 原子采用实体与投影。
 * 失败路径: 非对象、身份不完整或未知投影返回 null，Store 保持不变。
 *
 * @param {object} contentItem 待采用的标准 ContentItem。
 * @param {string} fallbackSourceId 内容所属 sourceId，仅在对象缺少 sourceId 时补齐。
 * @param {string} projection CONTENT_ENTITY_PROJECTION 中的正式投影。
 * @returns {object|null} 已采用的响应式 ContentItem；输入无效时为 null。
 */
function commitContentEntityProjection(contentItem, fallbackSourceId, projection) {
  // 条件分支: 调用方提交未知投影时进入；执行内容: 拒绝写入，防止页面自行扩张字段权威层级。
  if (!Object.values(CONTENT_ENTITY_PROJECTION).includes(projection)) return null;
  // 类型: object|null；作用: 在第一次写入前完成身份、投影优先级和信息不降级合并。
  const entityEntry = createContentEntityEntry(contentItem, fallbackSourceId, projection);
  // 条件分支: 内容不能形成稳定实体引用时进入；执行内容: 返回 null，不改写任何运行态。
  if (!entityEntry) return null;

  // 副作用: 只写当前实体动态 key；不同页面入口共享同一 sourceId + contentId 对象。
  Vue.set(
    siteContentStore.entities.contentItems,
    entityEntry.contentKey,
    entityEntry.contentItem
  );
  // 副作用: 与实体同批采用增强字段权威来源，弱页面壳不能覆盖 detail/player 已有增强字段。
  Vue.set(
    siteContentStore.entities.contentItemProjections,
    entityEntry.contentKey,
    entityEntry.projections
  );
  return siteContentStore.entities.contentItems[entityEntry.contentKey];
}

/**
 * 独立采用一次页面跳转已经知道的 ContentItem 壳。
 * 副作用: 仅以 list 投影写入共享实体池，不建立详情/播放页面事务，也不取得增强字段权威。
 * 使用场景: 普通卡片、个人中心快照、首页轮播和排行榜在 Router 导航前发布目标页面可立即读取的字段。
 *
 * @param {object} contentItem 页面入口当前持有的标准 ContentItem。
 * @param {string} fallbackSourceId 内容所属 sourceId。
 * @returns {object|null} 已采用的共享页面壳；身份无效时为 null。
 */
export function commitSourceContentShell(contentItem, fallbackSourceId) {
  return commitContentEntityProjection(
    contentItem,
    fallbackSourceId,
    CONTENT_ENTITY_PROJECTION.list
  );
}

/**
 * 独立采用后台补全的单个内容实体。
 * 副作用: 只按 contentKey 写入 entities.contentItems，不修改 activeSourceId、任何页面桶或页面请求事务。
 * 使用场景: 收藏、历史等引用消费者并发补全详情；页面详情和播放请求继续使用 commitSourceDataResponse。
 * 成功路径: ContentItem 可以形成稳定 key 时使用 Vue.set 写入并返回当前实体。
 * 失败路径: 非对象或身份不完整时返回 null，不产生任何 store 写入。
 *
 * @param {object} contentItem Provider 标准响应中的单个 ContentItem。
 * @param {string} fallbackSourceId 响应所属 sourceId，仅在内容缺少 sourceId 时补齐。
 * @returns {object|null} 已采用的响应式 ContentItem；输入无法形成 contentKey 时为 null。
 */
export function commitSourceContentItem(contentItem, fallbackSourceId) {
  return commitContentEntityProjection(
    contentItem,
    fallbackSourceId,
    CONTENT_ENTITY_PROJECTION.detail
  );
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
  return bucket.transaction?.stale === true
    ? []
    : Array.isArray(bucket.itemKeys) ? getItemsByKeys(bucket.itemKeys) : [];
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
 * 根据页面数据桶读取最新请求事务。
 * 纯函数: 只读取 PageBucket.transaction，并返回与 Store 引用隔离的浅层快照。
 * 正式策略: 页面从唯一事务派生 loading、error 和 stale，不建立第二份请求状态。
 * 失败路径: pageKey 或 moduleKey 不受支持时沿用 getPageBucket 的明确错误。
 *
 * @param {string} pageKey 页面名称，支持 home、movie、tv、search。
 * @param {string} moduleKey 首页区域名称，pageKey 为 home 时必填。
 * @returns {object|null} 标准请求事务隔离快照；事务缺失时返回 null。
 * @returns {string} return.requestId 当前桶最新请求标识。
 * @returns {string} return.requestedSourceId 页面发起请求时的源意图。
 * @returns {string} return.resolvedSourceId Runtime 实际调用的 Provider 身份。
 * @returns {string} return.status idle、loading、success 或 error。
 * @returns {object|null} return.error 失败时的稳定 code/message 快照。
 * @returns {boolean} return.stale true 时当前桶旧内容不可见，false 时按当前事务展示。
 */
export function getPageRequestTransaction(pageKey, moduleKey = '') {
  // 类型: object。
  // 作用: 使用和内容、分页 selector 相同的页面定位规则读取目标列表桶。
  const bucket = getPageBucket(pageKey, moduleKey);

  // 条件分支: 目标桶没有标准请求事务时进入。
  // 执行内容: 返回 null，让页面保持失败关闭，不自行构造第二份默认事务。
  if (!bucket || !bucket.transaction) {
    return null;
  }

  // 返回值类型: object。
  // 作用: 隔离顶层事务与 error 对象，阻止页面误改 Store 中的唯一请求事实。
  return {
    ...bucket.transaction,
    error: bucket.transaction.error ? { ...bucket.transaction.error } : null
  };
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
  if (bucket.transaction?.stale !== true && bucket.currentKey) {
    return getContentItemByKey(bucket.currentKey);
  }

  // 返回值类型: null。
  // 作用: 当前单内容桶没有引用 key 时，页面进入空状态或等待请求完成。
  return null;
}

/**
 * 读取最近成功提交内容响应的数据源 id。
 * 纯函数: 只读取 siteContentStore.activeSourceId，不修改 store。
 * 使用边界: 仅供页面展示和无内容兜底；下一次请求源必须由 SourceRuntime 读取 Manager activeSourceId。
 *
 * @returns {string} 最近成功响应 sourceId；尚无内容响应时返回空字符串。
 */
export function getActiveSourceId() {
  // 返回值类型: string。
  // 作用: 提供页面已采用数据的诊断身份，不代表 Manager 当前活动源或默认偏好。
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
 * @returns {string} return.sourceId 成功采用后记录为最近响应来源的真实身份。
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
  // 作用: 当前响应真实数据源身份，成功提交后记录为内容运行态最近响应来源。
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
    const entityEntry = createContentEntityEntry(
      response.item,
      sourceId,
      pageKey === 'player' ? CONTENT_ENTITY_PROJECTION.player : CONTENT_ENTITY_PROJECTION.detail
    );

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
  // 类型: Array<object>；作用: 生成 contentKey 唯一的实体条目，确保同一响应不会写入重复 itemKeys。
  const entityEntries = createUniqueListEntityEntries(responseItems, sourceId);

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
 * 副作用: 按实体池、目标页面桶、最近响应 sourceId 的固定顺序修改 siteContentStore。
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
    // 副作用: 同步采用当前实体增强字段的权威投影，后续响应据此执行信息不降级合并。
    Vue.set(
      siteContentStore.entities.contentItemProjections,
      entry.contentKey,
      entry.projections
    );
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

  // 副作用: 在实体与目标桶全部采用后，最后记录本次成功响应的真实来源。
  // 影响范围: 只用于诊断页面桶最近响应身份；后续请求仍由 Manager activeSourceId 解析。
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
 * @param {object} transaction beginSourceDataRequest 已发布的同一请求身份。
 * @returns {object} 写入后的目标数据桶。
 * @throws {Error} 当响应结构不完整或 pageKey/moduleKey 不受支持时抛出。
 */
export function commitSourceDataResponse(response, transaction) {
  // 类型: object。
  // 作用: 在第一次 store 写入前完成响应校验、目标桶定位、响应字段读取和实体 key 生成。
  const commitPlan = createContentCommitPlan(response);

  // 条件分支: 当前桶已经开始更晚请求，或响应身份不匹配本次解析源时进入。
  // 执行内容: 返回现有桶且不写实体、页面引用和事务，阻止过期结果覆盖最新页面状态。
  if (!transaction
    || commitPlan.bucket.transaction.requestId !== transaction.requestId
    || commitPlan.bucket.transaction.resolvedSourceId !== transaction.resolvedSourceId
    || response.sourceId !== transaction.resolvedSourceId) {
    return commitPlan.bucket;
  }

  // 类型: object；作用: 先一次采用实体和桶字段，再发布与同一内容对应的 success 事务。
  const bucket = applyContentCommitPlan(commitPlan);
  bucket.transaction = {
    ...transaction,
    status: SITE_CONTENT_REQUEST_STATUS.success,
    error: null,
    stale: false
  };
  return bucket;
}

/**
 * 定位页面请求对应的数据桶。
 * 纯函数: 只复用既有列表和单内容定位器，不修改 store。
 *
 * @param {string} pageKey 页面键。
 * @param {string} moduleKey 首页区域键。
 * @returns {object} 当前唯一目标桶。
 */
function getRequestBucket(pageKey, moduleKey) {
  return ITEM_PAGE_KEYS.includes(pageKey)
    ? getItemBucket(pageKey)
    : getPageBucket(pageKey, moduleKey);
}

/**
 * 发布页面桶 loading 请求事务。
 * 副作用: 只替换目标桶 transaction；旧内容来源不同时立即标记 stale，selector 隐藏旧引用。
 *
 * @param {object} transaction 当前请求身份。
 * @param {string} transaction.requestId 当前唯一请求标识。
 * @param {string} transaction.requestedSourceId 页面原始源意图。
 * @param {string} transaction.resolvedSourceId Runtime 真正调用的 Provider。
 * @param {string} transaction.pageKey 页面键。
 * @param {string} transaction.moduleKey 首页区域键。
 * @returns {object} 已发布的隔离事务对象。
 */
export function beginSourceDataRequest(transaction) {
  // 类型: object；作用: 定位本次页面和区域唯一桶，事务不会写入其他页面状态。
  const bucket = getRequestBucket(transaction.pageKey, transaction.moduleKey || '');
  // 类型: string；作用: 读取旧内容真实来源，决定 loading 期间 selector 是否必须隐藏旧引用。
  const previousSourceId = bucket.request?.sourceId || '';
  // 类型: string；作用: 身份解析前使用显式意图，解析后使用真实源；两者为空表示当前来源尚未确定。
  const pendingSourceId = transaction.resolvedSourceId || transaction.requestedSourceId || '';
  bucket.transaction = {
    requestId: transaction.requestId,
    requestedSourceId: transaction.requestedSourceId,
    resolvedSourceId: transaction.resolvedSourceId,
    status: SITE_CONTENT_REQUEST_STATUS.loading,
    error: null,
    // 来源尚未解析不是跨源证据；只有已知目标源与最后成功源不同时才隐藏旧内容，避免硬刷新期间闪空。
    stale: previousSourceId !== ''
      && pendingSourceId !== ''
      && previousSourceId !== pendingSourceId
  };
  return { ...bucket.transaction };
}

/**
 * 为最新 loading 请求事务补齐 Runtime 解析的真实数据源身份。
 * 副作用: 只替换 requestId 仍匹配的目标桶 transaction；不修改内容实体、引用、分页或最后成功请求。
 * 成功路径: 同一事务写入 resolvedSourceId，并根据最后成功桶来源重新计算 stale 可见性。
 * 失败路径: resolvedSourceId 为空时抛出 TypeError；事务已经过期时返回较新事务且不写入。
 *
 * @param {object} transaction beginSourceDataRequest 已发布的请求身份和页面定位。
 * @param {string} resolvedSourceId SourceRuntime 解析并通过页面候选门禁的真实 Provider 身份。
 * @returns {object} 已更新的事务隔离快照；过期请求返回当前较新事务快照。
 * @throws {TypeError} resolvedSourceId 不是非空字符串时抛出。
 */
export function resolveSourceDataRequestTransaction(transaction, resolvedSourceId) {
  // 类型: string；作用: 清理 Runtime 返回身份，禁止空身份进入 Host、Provider 或成功采用门禁。
  const normalizedSourceId = typeof resolvedSourceId === 'string'
    ? resolvedSourceId.trim()
    : '';
  // 条件分支: Runtime 没有返回非空真实身份时进入；执行内容: 拒绝写入半解析事务，由 service 的 catch 收敛原请求失败。
  if (!normalizedSourceId) {
    throw new TypeError('页面请求解析后的 sourceId 不能为空');
  }

  // 类型: object；作用: 定位本次页面和区域唯一桶，解析结果不会影响其他页面事务。
  const bucket = getRequestBucket(transaction.pageKey, transaction.moduleKey || '');
  // 条件分支: 目标桶已经开始更晚请求或当前事务不再 loading 时进入；执行内容: 保留较新状态并拒绝旧解析结果回写。
  if (bucket.transaction.requestId !== transaction.requestId
    || bucket.transaction.status !== SITE_CONTENT_REQUEST_STATUS.loading) {
    return {
      ...bucket.transaction,
      error: bucket.transaction.error ? { ...bucket.transaction.error } : null
    };
  }

  // 类型: string；作用: 读取最后成功桶真实来源，决定解析完成后是否可以继续展示同源旧内容。
  const previousSourceId = bucket.request?.sourceId || '';
  bucket.transaction = {
    requestId: transaction.requestId,
    requestedSourceId: transaction.requestedSourceId,
    resolvedSourceId: normalizedSourceId,
    status: SITE_CONTENT_REQUEST_STATUS.loading,
    error: null,
    stale: previousSourceId !== '' && previousSourceId !== normalizedSourceId
  };
  return { ...bucket.transaction };
}

/**
 * 为仍是最新的页面请求发布 error/stale。
 * 副作用: 只替换目标桶 transaction；保留实体和引用供诊断，但 selector 不再把它们显示为当前结果。
 *
 * @param {object} transaction 当前请求身份和页面定位。
 * @param {*} error Runtime、Provider 或采用阶段失败。
 * @returns {object} 当前目标桶事务；过期失败返回较新事务。
 */
export function failSourceDataRequest(transaction, error) {
  // 类型: object；作用: 定位失败请求对应的唯一页面桶，供 requestId 最新性复查。
  const bucket = getRequestBucket(transaction.pageKey, transaction.moduleKey || '');
  // 条件分支: 桶已经开始更晚请求时进入。
  // 执行内容: 保留较新事务，过期失败不得覆盖 loading 或 success 状态。
  if (bucket.transaction.requestId !== transaction.requestId) {
    return { ...bucket.transaction };
  }
  // 类型: boolean；作用: 保留 begin/resolve 已按旧桶来源和目标源裁决的可见性，同源失败不能清空可恢复内容。
  const shouldHidePreviousContent = bucket.transaction.stale === true;
  bucket.transaction = {
    requestId: transaction.requestId,
    requestedSourceId: transaction.requestedSourceId,
    resolvedSourceId: transaction.resolvedSourceId,
    status: SITE_CONTENT_REQUEST_STATUS.error,
    error: {
      code: typeof error?.code === 'string' && error.code ? error.code : 'SOURCE_DATA_REQUEST_ERROR',
      message: typeof error?.message === 'string' && error.message ? error.message : '内容请求失败'
    },
    stale: shouldHidePreviousContent
  };
  return { ...bucket.transaction, error: { ...bucket.transaction.error } };
}

// 导出类型: default object。
// 导出内容: 全站内容运行态存储对象。
// 外部调用方: 页面组件、sourceDataService 和后续调试面板。
// 使用场景: 读取或观察全站内容数据桶。
export default siteContentStore;
