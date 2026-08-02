/*
  system-source-4.js 模块说明

  - 文件职责:
      提供可通过文件、文本或远程地址导入的单文件系统演示 Provider。
      通过 Host 注入的 SourceContext 接受生命周期管理，并返回标准内容、筛选、健康与挑战结果。
      本文件不访问全局网络、DOM、store、Repository、浏览器存储或其他 Provider。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      sourceManifest: object，单文件 Provider 的静态身份、版本、能力和网络主机声明。
      PROVIDER_PHASE: object，Provider 实例生命周期枚举。
      DEMO_TIMESTAMP: string，系统演示响应使用的稳定时间。
      DEMO_SECTION_DEFINITIONS: object，四个公开演示分区的类型、标签和容量。
      HOME_SECTION_POLICY: object，首页五个数据桶的分区切片策略。
      TV_CATALOG_POLICY: object，电视剧混合目录和分类容量策略。
      SEARCH_PAGE_SIZE: number，搜索结果正式逻辑页容量。
      DEMO_CATALOG_BY_SECTION: object，按分区保存的确定性内容种子。
      DEMO_CONTENT_BY_ID: object，详情与播放使用的内容身份索引。

  - 模块级变量:
      无

  - 模块级辅助函数:
      createSectionSeeds(sectionKey, definition): 创建一个分区的确定性内容种子。
      createContentItem(seed, sourceId, options): 从种子创建完整标准内容对象。
      createLogicalPage(items, params, fallbackPageSize): 创建连续逻辑分页。
      createMixedTvPage(sourceId, params): 创建三个电视剧分区各六条的混合页。
      createHomeModuleItems(moduleKey, sourceId): 按首页策略合并模块内容。
      createDataResponse(request): 按页面、模块和分类创建标准内容响应。
      createFilterResponse(request): 创建电影或电视剧目录筛选响应。
      createProvider(definition): 创建独立生命周期 Provider 实例。

  - 模块级类:
      无

  - 对外导出:
      sourceManifest: object，供单文件加载器在执行前静态预检。
      createProviderFactory: Function，创建只支持当前 manifest 身份的 Provider 工厂。
*/

// 类型: object。
// 作用: 静态声明系统数据源4的 ABI、身份、显示信息、页面能力和允许网络主机。
export const sourceManifest = Object.freeze({
  schemaVersion: '1.0.0',
  providerApiVersion: '2.0.0',
  id: 'source.system.4',
  name: '系统数据源4',
  description: '提供离线标准内容和完整单文件 Provider 生命周期的系统演示数据源。',
  version: '2.2.2',
  providerKey: 'source.system.4.provider',
  capabilities: {
    home: true,
    movie: true,
    tv: true,
    search: true,
    detail: true,
    play: true
  },
  settingsSchema: [],
  networkHosts: ['system-source-4.invalid']
});

// 类型: object。
// 作用: 约束单个 Provider 实例的生命周期顺序，业务方法只允许在 running 阶段执行。
const PROVIDER_PHASE = Object.freeze({
  created: 'created',
  initialized: 'initialized',
  running: 'running',
  stopped: 'stopped',
  disposed: 'disposed'
});

// 类型: string。
// 作用: 给离线演示响应提供稳定时间，避免无网络数据在重复导入时产生无意义差异。
const DEMO_TIMESTAMP = '2026-01-01T00:00:00.000Z';

// 类型: object。
// 作用: 冻结四个公开演示分区的标准类型、卡片元信息标签、标题前缀和可分页容量。
const DEMO_SECTION_DEFINITIONS = Object.freeze({
  movie: Object.freeze({ type: 'movie', label: '热门电影', titlePrefix: '演示电影', itemCount: 32 }),
  tv: Object.freeze({ type: 'tv', label: '热门剧集', titlePrefix: '演示剧集', itemCount: 24 }),
  show: Object.freeze({ type: 'tv', label: '热门综艺', titlePrefix: '演示综艺', itemCount: 24 }),
  cartoon: Object.freeze({ type: 'tv', label: '日本动画', titlePrefix: '演示动画', itemCount: 24 })
});

// 类型: object。
// 作用: 按公开页面模块冻结分区切片；Provider 负责生产模块商品，首页不解释分区业务。
const HOME_SECTION_POLICY = Object.freeze({
  banners: Object.freeze([
    Object.freeze({ sectionKey: 'movie', offset: 0, count: 5 }),
    Object.freeze({ sectionKey: 'tv', offset: 0, count: 5 }),
    Object.freeze({ sectionKey: 'show', offset: 0, count: 5 }),
    Object.freeze({ sectionKey: 'cartoon', offset: 0, count: 5 })
  ]),
  hotMovies: Object.freeze([Object.freeze({ sectionKey: 'movie', offset: 5, count: 24 })]),
  movieRanking: Object.freeze([Object.freeze({ sectionKey: 'movie', offset: 0, count: 14 })]),
  hotTv: Object.freeze([
    Object.freeze({ sectionKey: 'tv', offset: 5, count: 8 }),
    Object.freeze({ sectionKey: 'show', offset: 5, count: 8 }),
    Object.freeze({ sectionKey: 'cartoon', offset: 5, count: 8 })
  ]),
  tvRanking: Object.freeze([
    Object.freeze({ sectionKey: 'tv', offset: 0, count: 5 }),
    Object.freeze({ sectionKey: 'show', offset: 0, count: 5 }),
    Object.freeze({ sectionKey: 'cartoon', offset: 0, count: 4 })
  ])
});

// 类型: object。
// 作用: 冻结电视剧未筛选时每区六条、总容量十八条和三个可选分类。
const TV_CATALOG_POLICY = Object.freeze({
  itemsPerSection: 6,
  pageSize: 18,
  sectionKeys: Object.freeze(['tv', 'show', 'cartoon'])
});

// 类型: number；作用: 搜索页使用十二条连续逻辑分页，与公开目录请求容量保持稳定。
const SEARCH_PAGE_SIZE = 12;

/**
 * 创建一个公开演示分区的确定性内容种子。
 * 纯函数: 只读取冻结分区定义并返回新的冻结数组，不访问网络、存储或页面状态。
 * 成功路径: 按一开始的稳定序号生成可跨首页、目录、搜索、详情和播放复用的身份。
 * 失败路径: 分区定义由模块常量保证完整，调用方不接受外部定义。
 *
 * @param {string} sectionKey 分区稳定键。
 * @param {object} definition 分区类型、标签、标题前缀和容量。
 * @returns {ReadonlyArray<Readonly<object>>} 当前分区内容种子。
 */
function createSectionSeeds(sectionKey, definition) {
  return Object.freeze(Array.from({ length: definition.itemCount }, (_, offset) => {
    // 类型: number；作用: 使用从一开始的稳定序号生成身份、标题和展示字段。
    const index = offset + 1;
    // 类型: string；作用: 三位序号保证字符串排序与源分区顺序一致。
    const serial = String(index).padStart(3, '0');
    return Object.freeze({
      id: `${sourceManifest.id}-${sectionKey}-${serial}`,
      sectionKey,
      sectionLabel: definition.label,
      type: definition.type,
      title: `${definition.titlePrefix}${serial}`,
      originalTitle: `System Demo ${sectionKey.toUpperCase()} ${serial}`,
      score: Number((7 + (index % 20) / 10).toFixed(1)),
      year: String(2026 - (offset % 6))
    });
  }));
}

// 类型: object。
// 作用: 按分区保存全部离线内容种子，列表请求只做切片，不在调用期间制造随机数据。
const DEMO_CATALOG_BY_SECTION = Object.freeze(Object.fromEntries(
  Object.entries(DEMO_SECTION_DEFINITIONS).map(([sectionKey, definition]) => [
    sectionKey,
    createSectionSeeds(sectionKey, definition)
  ])
));

// 类型: object。
// 作用: 为详情和播放提供 contentId 到冻结种子的确定性索引，不读取页面缓存或 Store。
const DEMO_CONTENT_BY_ID = Object.freeze(Object.fromEntries(
  Object.values(DEMO_CATALOG_BY_SECTION).flat().map(seed => [seed.id, seed])
));

/**
 * 从冻结种子创建完整标准内容对象。
 * 纯函数: 每次返回新的嵌套对象，不修改种子、目录或请求。
 * 成功路径: 电影形成一个正片，电视剧形成三个演示分集；分类标签进入 genres/tags 供卡片元信息展示。
 * 失败路径: seed 缺失时抛 TypeError，禁止详情或播放回退默认内容。
 *
 * @param {object} seed 当前内容冻结种子。
 * @param {string} sourceId Host Definition 提供的数据源身份。
 * @param {object} [options={}] 当前页面投影选项。
 * @param {number|null} [options.rank=null] 排行榜中的连续名次。
 * @returns {object} 可由统一内容 Store 消费的完整 ContentItem。
 * @throws {TypeError} seed 无效时抛出。
 */
function createContentItem(seed, sourceId, options = {}) {
  if (!seed || typeof seed !== 'object') throw new TypeError('系统演示内容种子无效');
  // 类型: string；作用: 优先采用请求身份，缺失时回退 manifest，始终形成明确来源。
  const effectiveSourceId = sourceId || sourceManifest.id;
  // 类型: number；作用: 电影只有正片，电视剧使用三个分集证明详情和播放链可恢复。
  const episodeCount = seed.type === 'movie' ? 1 : 3;
  // 类型: Array<object>；作用: 为当前调用创建不共享引用的标准分集目录。
  const episodes = Array.from({ length: episodeCount }, (_, offset) => {
    const episodeNumber = offset + 1;
    const episodeId = `${seed.id}-episode-${episodeNumber}`;
    const label = seed.type === 'movie' ? '正片' : `第${episodeNumber}集`;
    return {
      id: episodeId,
      episodeNumber,
      title: label,
      label,
      duration: seed.type === 'movie' ? '90分钟' : '45分钟',
      description: '',
      cover: '',
      playable: false
    };
  });
  // 类型: string；作用: 每条内容使用稳定线路身份，后续页面可按内容和分集恢复选择。
  const playbackSourceId = `${seed.id}-line-1`;

  return {
    id: seed.id,
    sourceId: effectiveSourceId,
    sourceName: sourceManifest.name,
    type: seed.type,
    title: seed.title,
    originalTitle: seed.originalTitle,
    aliases: [],
    poster: '',
    cover: '',
    description: `${seed.sectionLabel}离线演示内容，用于验证可插拔 Provider 的统一页面映射。`,
    year: seed.year,
    area: '演示区域',
    language: '国语',
    genres: seed.type === 'tv' ? [seed.sectionLabel] : ['电影'],
    tags: [seed.sectionLabel],
    displayTags: [],
    score: seed.score,
    quality: seed.type === 'movie' ? 'HD' : '',
    rank: Number.isSafeInteger(options.rank) ? options.rank : null,
    badge: seed.type === 'movie' ? 'HD' : '更新至3集',
    detail: {
      fullDescription: `${seed.title}用于公开演示详情字段、分类元信息、选集和播放线路的标准交付。`,
      directors: ['演示导演'],
      writers: ['演示编剧'],
      actors: ['演示演员'],
      releaseDate: `${seed.year}-01-01`,
      updateTime: '2026-01-01',
      status: seed.type === 'movie' ? '已发布' : '更新中',
      screenshots: [],
      trailerUrl: ''
    },
    movie: { duration: seed.type === 'movie' ? '90分钟' : '' },
    tv: {
      totalEpisodes: seed.type === 'tv' ? 12 : null,
      latestEpisode: seed.type === 'tv' ? 3 : null,
      updateStatus: seed.type === 'tv' ? '更新至3集' : '',
      season: seed.type === 'tv' ? '第1季' : ''
    },
    playCatalog: {
      defaultLineId: playbackSourceId,
      lines: [{
        id: playbackSourceId,
        name: '演示线路四',
        available: false,
        unavailableReason: '公开演示 Provider 不提供媒体资源',
        episodes
      }]
    },
    playback: null,
    source: {
      name: sourceManifest.name,
      domain: sourceManifest.networkHosts[0],
      rawId: seed.id,
      sourceDetailUrl: `https://${sourceManifest.networkHosts[0]}/detail/${seed.id}`,
      rawData: { category: seed.sectionKey, categoryLabel: seed.sectionLabel },
      fetchedAt: DEMO_TIMESTAMP
    }
  };
}

/**
 * 创建连续逻辑分页。
 * 纯函数: 只切片输入数组并创建分页对象，不修改内容或请求参数。
 * 成功路径: 正整数 page/pageSize 形成已知总量分页；缺失容量使用调用方提供的正式值。
 * 失败路径: 空数组返回 totalPages=0 和空 items，不伪造下一页。
 *
 * @param {Array<object>} items 完整候选内容集合。
 * @param {object} params 标准请求参数。
 * @param {number} fallbackPageSize 当前页面正式默认容量。
 * @returns {object} 当前页 items 与 pagination。
 */
function createLogicalPage(items, params, fallbackPageSize) {
  const page = Number.isSafeInteger(params?.page) && params.page > 0 ? params.page : 1;
  const pageSize = Number.isSafeInteger(params?.pageSize) && params.pageSize > 0
    ? params.pageSize
    : fallbackPageSize;
  const total = items.length;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  const startIndex = (page - 1) * pageSize;
  return {
    items: items.slice(startIndex, startIndex + pageSize),
    pagination: { page, pageSize, total, totalPages, hasMore: page < totalPages }
  };
}

/**
 * 创建电视剧未筛选混合页。
 * 纯函数: 三个分类使用同一页窗口各取六条，并按热门剧集、热门综艺、日本动画顺序连接。
 * 成功路径: pageSize=18 时返回标准混合分页。
 * 失败路径: 调用方传入其他容量时抛 Error，禁止按比例猜测分区窗口。
 *
 * @param {string} sourceId 当前数据源身份。
 * @param {object} params 标准电视剧请求参数。
 * @returns {object} 当前混合页 items 与 pagination。
 * @throws {Error} pageSize 不等于十八时抛出。
 */
function createMixedTvPage(sourceId, params) {
  const page = Number.isSafeInteger(params?.page) && params.page > 0 ? params.page : 1;
  const pageSize = Number.isSafeInteger(params?.pageSize) && params.pageSize > 0
    ? params.pageSize
    : TV_CATALOG_POLICY.pageSize;
  if (pageSize !== TV_CATALOG_POLICY.pageSize) throw new Error('系统演示电视剧混合页容量无效');
  const startIndex = (page - 1) * TV_CATALOG_POLICY.itemsPerSection;
  const sectionLengths = TV_CATALOG_POLICY.sectionKeys.map(sectionKey => DEMO_CATALOG_BY_SECTION[sectionKey].length);
  const items = TV_CATALOG_POLICY.sectionKeys.flatMap((sectionKey) => {
    return DEMO_CATALOG_BY_SECTION[sectionKey]
      .slice(startIndex, startIndex + TV_CATALOG_POLICY.itemsPerSection)
      .map(seed => createContentItem(seed, sourceId));
  });
  const totalPages = Math.max(0, ...sectionLengths.map(length => Math.ceil(length / TV_CATALOG_POLICY.itemsPerSection)));
  return {
    items,
    pagination: {
      page,
      pageSize,
      total: sectionLengths.reduce((total, length) => total + length, 0),
      totalPages,
      hasMore: page < totalPages
    }
  };
}

/**
 * 按首页模块策略创建完整候选集合。
 * 纯函数: 只读取冻结分区和切片策略，返回新的标准内容对象。
 * 成功路径: 五个正式 moduleKey 按策略合并；排行榜生成跨分区连续 rank。
 * 失败路径: 未知 moduleKey 抛 Error，不回退电影列表。
 *
 * @param {string} moduleKey 首页数据桶键。
 * @param {string} sourceId 当前数据源身份。
 * @returns {Array<object>} 当前模块全部标准内容候选。
 * @throws {Error} moduleKey 未登记时抛出。
 */
function createHomeModuleItems(moduleKey, sourceId) {
  const policy = HOME_SECTION_POLICY[moduleKey];
  if (!policy) throw new Error('系统演示首页 moduleKey 不受支持');
  const seeds = policy.flatMap((slice) => {
    return DEMO_CATALOG_BY_SECTION[slice.sectionKey].slice(slice.offset, slice.offset + slice.count);
  });
  const ranked = moduleKey === 'movieRanking' || moduleKey === 'tvRanking';
  return seeds.map((seed, index) => createContentItem(seed, sourceId, {
    rank: ranked ? index + 1 : null
  }));
}

/**
 * 创建标准内容响应。
 * 纯函数: 只读取请求和冻结演示目录，不请求网络、不写存储也不修改请求对象。
 * 成功路径: 首页、电影、电视剧、搜索、详情和播放分别按标准契约返回。
 * 失败路径: 未知页面、模块、分类、空搜索或未知内容身份抛 Error，不回退默认内容。
 *
 * @param {object} request Host 交付的标准 SourceDataRequest。
 * @returns {object} 标准 SourceDataResponse。
 * @throws {Error} 请求不能映射到公开演示目录时抛出。
 */
function createDataResponse(request) {
  const safeRequest = request && typeof request === 'object' ? request : {};
  const sourceId = safeRequest.sourceId || sourceManifest.id;
  const params = safeRequest.params && typeof safeRequest.params === 'object' ? { ...safeRequest.params } : {};
  const responseRequest = {
    sourceId,
    pageKey: safeRequest.pageKey || '',
    moduleKey: safeRequest.moduleKey || '',
    params
  };
  // 类型: Function；作用: 统一创建精确响应外壳，避免各页面分支复制字段集合。
  const createResponse = ({ items = [], item = null, pagination = null }) => ({
    sourceId,
    pageKey: responseRequest.pageKey,
    moduleKey: responseRequest.moduleKey,
    request: responseRequest,
    pagination,
    items,
    item,
    meta: {
      status: items.length > 0 || item ? 'ready' : 'empty',
      message: '',
      fetchedAt: DEMO_TIMESTAMP
    }
  });

  if (responseRequest.pageKey === 'home') {
    const moduleItems = createHomeModuleItems(responseRequest.moduleKey, sourceId);
    const logicalPage = createLogicalPage(moduleItems, params, Math.max(moduleItems.length, 1));
    return createResponse(logicalPage);
  }
  if (responseRequest.pageKey === 'movie') {
    const movieItems = DEMO_CATALOG_BY_SECTION.movie.map(seed => createContentItem(seed, sourceId));
    return createResponse(createLogicalPage(movieItems, params, 12));
  }
  if (responseRequest.pageKey === 'tv') {
    const category = typeof params.category === 'string' && params.category.trim() ? params.category.trim() : 'all';
    if (category === 'all') return createResponse(createMixedTvPage(sourceId, params));
    if (!TV_CATALOG_POLICY.sectionKeys.includes(category)) throw new Error('系统演示电视剧 category 不受支持');
    const categoryItems = DEMO_CATALOG_BY_SECTION[category].map(seed => createContentItem(seed, sourceId));
    return createResponse(createLogicalPage(categoryItems, params, TV_CATALOG_POLICY.pageSize));
  }
  if (responseRequest.pageKey === 'search') {
    const keyword = typeof params.keyword === 'string' ? params.keyword.trim().toLocaleLowerCase() : '';
    if (!keyword) throw new Error('系统演示搜索缺少 keyword');
    const pageSize = Number.isSafeInteger(params.pageSize) && params.pageSize > 0 ? params.pageSize : SEARCH_PAGE_SIZE;
    if (pageSize !== SEARCH_PAGE_SIZE) throw new Error('系统演示搜索 pageSize 无效');
    const searchItems = Object.values(DEMO_CATALOG_BY_SECTION).flat()
      .filter(seed => [seed.title, seed.originalTitle, seed.sectionLabel].some(value => value.toLocaleLowerCase().includes(keyword)))
      .map(seed => createContentItem(seed, sourceId));
    return createResponse(createLogicalPage(searchItems, { ...params, pageSize }, SEARCH_PAGE_SIZE));
  }
  if (responseRequest.pageKey === 'detail' || responseRequest.pageKey === 'player') {
    const contentId = typeof params.contentId === 'string' ? params.contentId.trim() : '';
    const seed = DEMO_CONTENT_BY_ID[contentId];
    if (!seed) throw new Error('系统演示 contentId 无效');
    return createResponse({
      item: createContentItem(seed, sourceId)
    });
  }
  throw new Error('系统演示页面请求不受支持');
}

/**
 * 创建目录筛选响应。
 * 纯函数: 不读取 Provider 状态或外部数据；电影不伪造筛选，电视剧只发布真实演示分区。
 * 成功路径: movie 返回空 groups，tv 返回 category 的全部与三个分区。
 * 失败路径: 其他页面抛 Error，阻止筛选服务误用。
 *
 * @param {object} request Host 交付的标准 SourceFilterMetaRequest。
 * @returns {object} 标准 SourceFilterMetaResponse。
 * @throws {Error} pageKey 不是 movie 或 tv 时抛出。
 */
function createFilterResponse(request) {
  const safeRequest = request && typeof request === 'object' ? request : {};
  if (safeRequest.pageKey !== 'movie' && safeRequest.pageKey !== 'tv') throw new Error('系统演示筛选页不受支持');
  const sourceId = safeRequest.sourceId || sourceManifest.id;
  const params = safeRequest.params && typeof safeRequest.params === 'object' ? { ...safeRequest.params } : {};
  const groups = safeRequest.pageKey === 'tv' ? [{
    name: 'category',
    label: '分类',
    options: [
      { label: '全部', value: 'all', count: 72, active: true },
      ...TV_CATALOG_POLICY.sectionKeys.map(sectionKey => ({
        label: DEMO_SECTION_DEFINITIONS[sectionKey].label,
        value: sectionKey,
        count: DEMO_CATALOG_BY_SECTION[sectionKey].length,
        active: false
      }))
    ]
  }] : [];
  return {
    sourceId,
    pageKey: safeRequest.pageKey,
    request: { sourceId, pageKey: safeRequest.pageKey, params },
    groups,
    meta: { status: 'ready', message: '', fetchedAt: DEMO_TIMESTAMP }
  };
}

/**
 * 创建独立 Provider 实例。
 * 副作用: 返回的生命周期方法会保存 Host 注入的 SourceContext 和当前阶段。
 * 成功路径: 实例按 initialize、start、业务调用、stop、dispose 顺序受管运行。
 * 失败路径: 跨源 Context 或错误生命周期顺序抛出 Error，并保持原阶段不变。
 *
 * @param {object} definition Host 已校验的 SourceDefinition。
 * @returns {object} 完整 SourceProvider 实例。
 */
function createProvider(definition) {
  // 类型: string。
  // 作用: 保存当前实例唯一数据源身份，所有响应必须回填该值。
  const sourceId = definition.id;

  // 类型: string。
  // 作用: 保存当前生命周期阶段，阻止停止后继续调用业务方法。
  let phase = PROVIDER_PHASE.created;

  // 类型: object|null。
  // 作用: 保存 Host 唯一注入的 SourceContext，dispose 时清除引用。
  let sourceContext = null;

  /**
   * 要求 Provider 已处于运行状态。
   * 纯函数: 只读取当前阶段和 Context，不修改实例状态。
   * 成功路径: 状态有效时返回当前 SourceContext。
   * 失败路径: 未运行或 Context 缺失时抛 Error。
   *
   * @param {string} operation 当前业务操作名称。
   * @returns {object} Host 注入的 SourceContext。
   */
  function requireRunningContext(operation) {
    // 条件分支: 当前实例未运行或 Context 已释放时进入。
    // 执行内容: 拒绝业务调用，避免绕过 Host 生命周期门禁。
    if (phase !== PROVIDER_PHASE.running || !sourceContext) {
      throw new Error(`系统演示 Provider 无法执行 ${operation}`);
    }
    return sourceContext;
  }

  // 返回值类型: object。
  // 作用: 返回冻结 Provider 门面，Host 不能替换生命周期或业务方法。
  return Object.freeze({
    id: sourceId,

    /**
     * 采用 Host SourceContext。
     * 副作用: 保存唯一 Context，并把阶段从 created 改为 initialized。
     * 成功路径: 同源 Context 首次采用后完成。
     * 失败路径: 重复初始化或跨源 Context 抛 Error。
     *
     * @param {object} context Host 注入的冻结 SourceContext。
     * @returns {Promise<void>} 初始化完成 Promise。
     */
    initialize(context) {
      // 条件分支: 生命周期、Context 或来源身份不符合要求时进入。
      // 执行内容: 拒绝替换能力容器或跨源使用 Context。
      if (phase !== PROVIDER_PHASE.created || !context || context.sourceId !== sourceId) {
        throw new Error('系统演示 Provider 初始化上下文无效');
      }
      sourceContext = context;
      phase = PROVIDER_PHASE.initialized;
      return Promise.resolve();
    },

    /**
     * 启动 Provider。
     * 副作用: 把生命周期从 initialized 改为 running。
     * 成功路径: 初始化完成后进入可调用状态。
     * 失败路径: 未初始化或重复启动时抛 Error。
     *
     * @returns {Promise<void>} 启动完成 Promise。
     */
    start() {
      // 条件分支: 当前阶段不是 initialized 时进入。
      // 执行内容: 拒绝越过初始化或重复启动。
      if (phase !== PROVIDER_PHASE.initialized) {
        throw new Error('系统演示 Provider 启动顺序无效');
      }
      phase = PROVIDER_PHASE.running;
      return Promise.resolve();
    },

    /**
     * 返回标准内容数据。
     * 副作用: 只读取实例生命周期，不请求网络或修改 SourceContext 私有空间。
     * 成功路径: 运行阶段返回标准内容响应。
     * 失败路径: 未运行时抛 Error。
     *
     * @param {object} request 标准 SourceDataRequest。
     * @returns {Promise<object>} 标准 SourceDataResponse。
     */
    async fetchData(request) {
      requireRunningContext('fetchData');
      return createDataResponse(request);
    },

    /**
     * 返回标准筛选元数据。
     * 副作用: 只读取实例生命周期，不请求网络或写入私有空间。
     * 成功路径: 运行阶段返回标准筛选响应。
     * 失败路径: 未运行时抛 Error。
     *
     * @param {object} request 标准 SourceFilterMetaRequest。
     * @returns {Promise<object>} 标准 SourceFilterMetaResponse。
     */
    async fetchFilterMeta(request) {
      requireRunningContext('fetchFilterMeta');
      return createFilterResponse(request);
    },

    /**
     * 返回当前 Provider 健康状态。
     * 副作用: 只读取生命周期，不访问网络或保存状态。
     * 成功路径: 运行阶段返回 normal。
     * 失败路径: 未运行时抛 Error。
     *
     * @returns {Promise<object>} 标准 SourceHealthCheckResult。
     */
    async checkHealth() {
      requireRunningContext('checkHealth');
      return {
        healthStatus: 'normal',
        checkedAt: DEMO_TIMESTAMP,
        unavailableReason: ''
      };
    },

    /**
     * 检测网络挑战。
     * 纯函数: 系统演示 Provider 不请求外部站点，固定返回 null。
     * 成功路径: 返回 null 表示当前响应没有挑战。
     * 失败路径: 无。
     *
     * @param {*} response 网络响应候选。
     * @returns {Promise<null>} 当前演示源没有挑战。
     */
    async detectChallenge() {
      return null;
    },

    /**
     * 继续挑战流程。
     * 副作用: 只验证生命周期，不读取页面或建立第二份会话状态。
     * 成功路径: 运行阶段原样返回协调器提交结果。
     * 失败路径: 未运行时抛 Error。
     *
     * @param {*} challengeInput 全局挑战协调器提交结果。
     * @returns {Promise<*>} 原样返回的挑战结果。
     */
    async continueChallenge(challengeInput) {
      requireRunningContext('continueChallenge');
      return challengeInput;
    },

    /**
     * 停止 Provider。
     * 副作用: 把 running 收敛为 stopped；Host signal 负责中止在途请求。
     * 成功路径: running 和 stopped 均可幂等完成。
     * 失败路径: 尚未启动时抛 Error，disposed 状态直接完成。
     *
     * @returns {Promise<void>} 停止完成 Promise。
     */
    stop() {
      // 条件分支: 实例已经永久释放时进入。
      // 执行内容: 幂等完成，不恢复 Context。
      if (phase === PROVIDER_PHASE.disposed) return Promise.resolve();

      // 条件分支: 当前阶段既不是 running 也不是 stopped 时进入。
      // 执行内容: 拒绝尚未启动的错误停止顺序。
      if (phase !== PROVIDER_PHASE.running && phase !== PROVIDER_PHASE.stopped) {
        throw new Error('系统演示 Provider 停止顺序无效');
      }
      phase = PROVIDER_PHASE.stopped;
      return Promise.resolve();
    },

    /**
     * 永久释放 Provider。
     * 副作用: 清除 SourceContext 并把实例标记为 disposed。
     * 成功路径: 任意已创建实例均可幂等释放。
     * 失败路径: 无。
     *
     * @returns {Promise<void>} 释放完成 Promise。
     */
    dispose() {
      sourceContext = null;
      phase = PROVIDER_PHASE.disposed;
      return Promise.resolve();
    }
  });
}

/**
 * 创建当前单文件 Provider 工厂。
 * 纯函数: 只创建冻结工厂门面，不初始化 Provider、不访问网络也不修改外部状态。
 * 成功路径: supports 精确匹配 manifest 身份，create 返回独立 Provider。
 * 失败路径: Definition 不匹配时 supports 返回 false，create 抛 Error。
 *
 * @returns {object} 只支持当前 manifest 的 ProviderFactory。
 */
export function createProviderFactory() {
  // 返回值类型: object。
  // 作用: 返回冻结工厂，动态注册后不能替换身份判断或实例创建逻辑。
  return Object.freeze({
    providerKey: sourceManifest.providerKey,

    /**
     * 判断 Definition 是否属于当前工厂。
     * 纯函数: 只比较 id 和 providerKey，不创建实例或访问网络。
     * 成功路径: 两个身份字段均匹配时返回 true。
     * 失败路径: 候选缺失或字段不匹配时返回 false。
     *
     * @param {*} definition SourceDefinition 候选。
     * @returns {boolean} 当前工厂是否支持该 Definition。
     */
    supports(definition) {
      return Boolean(definition
        && definition.id === sourceManifest.id
        && definition.providerKey === sourceManifest.providerKey);
    },

    /**
     * 创建独立 Provider。
     * 副作用: 只创建新的闭包状态，不初始化 Context 或请求网络。
     * 成功路径: Definition 身份匹配时返回 Provider。
     * 失败路径: Definition 不匹配时抛 Error。
     *
     * @param {object} options Host 工厂创建参数。
     * @param {object} options.definition SourceDefinition 隔离副本。
     * @returns {object} 新 Provider 实例。
     */
    create({ definition }) {
      // 条件分支: Definition 身份或工厂键不匹配当前 manifest 时进入。
      // 执行内容: 拒绝一个单文件工厂创建其他数据源实例。
      if (!definition
        || definition.id !== sourceManifest.id
        || definition.providerKey !== sourceManifest.providerKey) {
        throw new Error('系统演示 Provider 定义不受支持');
      }
      return createProvider(definition);
    }
  });
}
