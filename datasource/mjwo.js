/*
  mjwo.js 模块说明

  - 文件职责:
      把 MJWO HTML 搜索、首页、目录、详情、验证码和播放解析页清洗为 v5 标准 Provider 响应。
      验证码图片与提交都通过 SourceContext.network，Cookie 只保存在当前数据源 credentials/session 分区；媒体地址仍由浏览器直连。
      详情刷新 Provider 私有内容事实，player 复用目录并按逻辑剧集缓存线路集合，避免后台多目标探测重复请求详情与首集。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无；单文件不直接访问网络、DOM、store、Repository、全局浏览器存储或其他 Provider。

  - 模块级常量:
      sourceManifest: object，MJWO 静态身份和能力声明。
      PAGE_BASE_URL、PARSER_BASE_URL、PARSER_NEXT_URL: string，源站页面、播放解析服务与来源参数地址。
      PROVIDER_PHASE: object，生命周期枚举。
      REQUEST_POLICY、REQUEST_HEADERS: object，信息请求策略和端点请求头语义。
      HOME_MODULE_KEY、HOME_CARD_SECTION、HOME_RANKING_SECTION: object，首页区域与源站板块映射。
      HOME_CARD_LIST_CLASS、HOME_RANKING_LIST_CLASS、HOME_BANNER_LIMIT: string/number，首页解析和容量边界。
      CATALOG_SOURCE_PAGE_SIZE、CATALOG_FEATURED_CONTAINER_CLASS、CATALOG_LIST_CLASS、CATALOG_FILTER_LIST_CLASS: string/number，目录源站批次与区域定位规则。
      CATALOG_SORT_VALUE_BY_ROUTE、CATALOG_SORT_ROUTE_BY_VALUE: object，平台排序值与源站路由值映射。
      CATALOG_DEFINITION: object，电影和美剧入口、筛选字段、路由顺序与内容类型配置。
      SEARCH_RESULT_LIST_ID、SEARCH_THUMB_CLASS、SEARCH_DETAIL_CLASS: string，搜索结果、缩略图和详情区域定位规则。
      SEARCH_METADATA_LABELS: Array<string>，搜索结果行允许读取的轻量元信息标签。
      SEARCH_CLASSIFICATION_TYPE_RULES、SEARCH_STATUS_TYPE_RULES: Array<object>，搜索显式分类与辅助状态的类型映射规则。
      DETAIL_CONTAINER_CLASS、DETAIL_STATUS_CLASS、DETAIL_THUMB_CLASS、DETAIL_PLAYLIST_ID: string，详情信息、状态、封面和唯一播放列表定位规则。
      DETAIL_FIELD_LABELS、DETAIL_DESCRIPTION_LOCATORS: Array<string|object>，详情标签字段和精确简介容器候选。
      PLAY_CATALOG_POLICY: object，稳定线路、逻辑剧集和不可用状态规则。
      STABLE_ID_HASH_POLICY: object，Provider 私有线路事实到不透明公共身份的哈希参数。

  - 模块级变量:
      无；请求序号、Context、Cookie 和生命周期按实例隔离。

  - 模块级辅助函数:
      cleanText(value): string，清理 HTML 文本。
      decodeUtf8Body(body): string，把 ABI 2.0 原始响应字节解码为文本。
      readAttribute(tag, name): string，读取标签属性。
      readStyleBackgroundUrl(style): string，读取卡片内联背景图地址。
      readMetaContent(html, name): string，读取指定 meta content。
      absoluteUrl(value, allowMedia): string，规范化允许的 HTTPS 地址。
      normalizeMediaUrl(value): string，只接受浏览器直连 MP4/HLS。
      parseContentId(value): string，形成 MJWO 内容身份。
      extractPlayerParameter(html): string，提取播放页解析参数。
      buildParserUrl(parameter): string，构造源站解析页地址。
      readElementTextByClasses(fragment, tagName, classTokens): string，读取同时满足多个 class 的元素文本。
      readElementTextByClass(fragment, tagName, classToken): string，读取指定单个 class 元素文本。
      parseTvProgress(status): object，把源站剧集状态转换为标准电视剧进度。
      createContentItem(options): object，集中构造 MJWO 标准轻量内容。
      parseCardTags(fragment): object，解析评分和展示标签。
      parseCatalogMetadata(fragment): object，解析年份、地区和剧情标签。
      parseCardFragment(fragment, sourceId, contentType, metadataOverride): object|null，解析单个正式卡片。
      parseCards(html, sourceId, contentType): Array<object>，解析卡片。
      extractElementsByClass(html, tagName, classToken): Array<object>，按平衡标签提取全部同类容器。
      extractElementByClass(html, tagName, classToken): string，按平衡标签提取 class 容器。
      parseCatalogCards(html, sourceId, fallbackType): Array<object>，解析目录主体卡片。
      parseCatalogFilterOptionValue(definition, groupName, href, label): string，解析目录筛选按钮标准值。
      parseCatalogFilterGroups(html, definition): Array<object>，按目录配置解析筛选组。
      normalizeCatalogFilterSelection(params, groups, definition): object，校验目录筛选值。
      buildCatalogUrl(definition, selection, page): string，按配置构造目录源站地址。
      parseSourcePagination(html): object，解析目录或搜索源站分页。
      parseCatalogSourcePage(html, sourceId, definition, includeFeatured): object，解析单个目录批次。
      parseSearchContentType(classification, status): string，按显式分类优先级识别搜索内容类型。
      parseSearchMetadata(detailHtml): object，按搜索行标签解析分类和轻量元信息。
      parseSearchItems(html, sourceId): Array<object>，解析搜索结果完整行。
      parseSearchSourcePage(html, sourceId): object，解析单个搜索批次。
      extractElementById(html, elementId): string，按平衡标签提取 id 容器。
      extractListById(html, elementId): string，按首页稳定列表 id 提取板块正文。
      extractListAfterHeading(html, headingText, classToken): string，按板块标题和列表 class 提取正文。
      parseHomeCardSection(html, sourceId, sectionKey): Array<object>，解析首页卡片板块。
      parseRanking(html, sourceId, type): Array<object>，解析首页排行榜。
      mergeUniqueItems(groups): Array<object>，按内容身份顺序合并板块。
      parseHomeModule(html, sourceId, moduleKey): Array<object>，把首页区域映射到指定源站板块。
      splitDetailValues(value, splitWhitespace): Array<string>，拆分详情多值字段。
      parseDetailMetadata(detailHtml): object，按可见标签解析详情标准字段。
      createStableOpaqueId(prefix, value): string，把线路名称和特辑语义转换为稳定身份。
      parseExplicitSeasonNumber(value): number|null，从明确文案读取季号。
      parseExplicitEpisodeNumber(value): number|null，从明确文案读取集号。
      parsePlaylistEpisodeTargets(playlistHtml, poster, contentType, seasonNumber): object，解析公共逻辑剧集和私有播放入口。
      parseDetail(html, contentId, sourceId): object，解析详情、逻辑目录输入和私有播放入口。
      extractMediaSources(html): Array<object>，提取公开媒体线路。
      createMediaLineId(identityKey): string，从解析页线路事实生成稳定线路身份。
      createPlayCatalog(mediaSources, episodes): object，投影完整公共线路与逻辑剧集目录。
      resolveRequestedPlaybackTarget(mediaSources, episodeTargets, params): object，精确选择线路和分集媒体。
      createLogicalPage(items, params): object，把首页完整卡片集合转换为连续的平台逻辑页。
      createResponse(request, items, item, pagination): object，包装标准内容响应。
      createFilterResponse(request): object，包装目录筛选响应。
      createChallenge(sourceId, image): object，创建人工验证码挑战。
      buildSearchUrl(keyword, page): string，构造源站搜索表单提交地址。
      parseChallengeSubmitResponse(body): object，校验 MJWO 验证提交响应并返回成功事实。
      createProvider(definition): object，创建独立 MJWO Provider。

  - 模块级类:
      无

  - 对外导出:
      sourceManifest: object，供信任前静态预检。
      createProviderFactory(): Function，返回精确 ProviderFactory。
*/

// 类型: object；作用: 声明 MJWO 页面、解析 host 和六类页面能力。
export const sourceManifest = Object.freeze({
  schemaVersion: '1.0.0',
  providerApiVersion: '2.0.0',
  id: 'source.net.mjwo',
  name: 'MJWO',
  description: '通过 MJWO HTML 页面、人工验证码和浏览器直连媒体提供标准内容数据。',
  authorName: '佚名',
  siteUrl: 'https://www.mjwo.net',
  version: '2.1.4',
  providerKey: 'source.net.mjwo.provider',
  capabilities: {
    home: true,
    movie: true,
    tv: true,
    search: true,
    detail: true,
    play: true
  },
  settingsSchema: [],
  networkHosts: ['www.mjwo.net', 'api.apiimg.com']
});

// 类型: string；作用: MJWO 首页、搜索、详情和播放页信息请求根地址。
const PAGE_BASE_URL = 'https://www.mjwo.net';
// 类型: string；作用: 源站播放器继续使用的解析页地址，不是项目后端代理。
const PARSER_BASE_URL = 'https://api.apiimg.com/outside/super.php';
// 类型: string；作用: 源站解析页当前要求的来源参数，保持公开播放请求语义。
const PARSER_NEXT_URL = '//www.meijuwo.cc';
// 类型: object；作用: Provider 生命周期阶段。
const PROVIDER_PHASE = Object.freeze({
  created: 'created',
  initialized: 'initialized',
  running: 'running',
  stopped: 'stopped',
  disposed: 'disposed'
});
// 类型: object；作用: 集中控制页面、验证码和解析页信息请求边界。
const REQUEST_POLICY = Object.freeze({
  timeoutMs: 15000,
  maxResponseBytes: 2097152,
  maxCaptchaBytes: 262144
});
// 类型: object；作用: 按 MJWO 端点集中冻结不同资源类型的请求语义，调用点只补充当前搜索 URL 作为 referer。
const REQUEST_HEADERS = Object.freeze({
  // 字段类型: Array<object>；作用: 搜索页使用有序浏览器文档协商和语言偏好，初次请求与验证后重试必须一致。
  searchDocument: Object.freeze([
    Object.freeze({ name: 'accept', value: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }),
    Object.freeze({ name: 'accept-language', value: 'zh-CN,zh;q=0.9,en;q=0.8' })
  ]),
  // 字段类型: Array<object>；作用: 验证码图片声明完整图片协商；referer 由当前搜索事务动态提供。
  captchaImage: Object.freeze([
    Object.freeze({ name: 'accept', value: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' })
  ]),
  // 字段类型: Array<object>；作用: 验证提交保持源站 AJAX 协议，referer 由当前搜索事务动态提供。
  challengeSubmit: Object.freeze([
    Object.freeze({ name: 'accept', value: 'application/json, text/javascript, */*; q=0.01' }),
    Object.freeze({ name: 'content-type', value: 'application/x-www-form-urlencoded' }),
    Object.freeze({ name: 'x-requested-with', value: 'XMLHttpRequest' })
  ])
});

// 类型: object；作用: 集中冻结平台首页五个标准区域，fetchData 不散落 moduleKey 魔法字符串。
const HOME_MODULE_KEY = Object.freeze({
  banners: 'banners',
  hotMovies: 'hotMovies',
  hotTv: 'hotTv',
  movieRanking: 'movieRanking',
  tvRanking: 'tvRanking'
});
// 类型: object；作用: 描述 MJWO 首页六个卡片板块的稳定定位方式、内容类型和合并顺序。
const HOME_CARD_SECTION = Object.freeze({
  // 字段作用: 最新连载使用源站固定 tab id，属于电视剧内容。
  latestSerial: Object.freeze({ locator: 'id', value: 'weeks_new', type: 'tv' }),
  // 字段作用: 新剧推荐使用源站固定 tab id，属于电视剧内容。
  recommendedShows: Object.freeze({ locator: 'id', value: 'weeks_hot', type: 'tv' }),
  // 字段作用: 经典老剧使用源站固定 tab id，属于电视剧内容。
  classicShows: Object.freeze({ locator: 'id', value: 'weeks_old', type: 'tv' }),
  // 字段作用: 热门电影使用源站固定 tab id，属于电影内容。
  popularMovies: Object.freeze({ locator: 'id', value: 'weeks_dy', type: 'movie' }),
  // 字段作用: 最新美剧没有独立 id，通过标题后的正式卡片列表定位。
  latestShows: Object.freeze({ locator: 'heading', value: '最新美剧', type: 'tv' }),
  // 字段作用: 最新电影没有独立 id，通过标题后的正式卡片列表定位。
  latestMovies: Object.freeze({ locator: 'heading', value: '最新电影', type: 'movie' })
});
// 类型: object；作用: 集中冻结两类排行榜标题和标准内容类型，避免与卡片板块配置混用。
const HOME_RANKING_SECTION = Object.freeze({
  movieRanking: Object.freeze({ heading: '电影排行榜', type: 'movie' }),
  tvRanking: Object.freeze({ heading: '美剧排行榜', type: 'tv' })
});
// 类型: string；作用: 最新电影和最新美剧板块正式缩略图列表的精确 class token。
const HOME_CARD_LIST_CLASS = 'myui-vodlist';
// 类型: string；作用: 电影和美剧排行榜文本列表的精确 class token。
const HOME_RANKING_LIST_CLASS = 'myui-vodlist__text';
// 类型: number；作用: 平台首页轮播候选上限，与正式首页字段契约的 24 条请求容量一致。
const HOME_BANNER_LIMIT = 24;

// 类型: number；作用: MJWO 电影和美剧主体目录每个非末页固定交付 24 条，供统一逻辑分页直接定位源站批次。
const CATALOG_SOURCE_PAGE_SIZE = 24;
// 类型: string；作用: 默认目录入口顶部滚动推荐的稳定容器 class token。
const CATALOG_FEATURED_CONTAINER_CLASS = 'flickity';
// 类型: string；作用: 电影和美剧目录主体卡片列表的稳定 ul class token。
const CATALOG_LIST_CLASS = 'myui-vodlist';
// 类型: string；作用: 电影和美剧筛选组列表的稳定 ul class token。
const CATALOG_FILTER_LIST_CLASS = 'myui-screen__list';
// 类型: object；作用: 把 MJWO by 路由值转换为平台稳定排序值，页面不保存 time/hits 站点术语。
const CATALOG_SORT_VALUE_BY_ROUTE = Object.freeze({
  time: 'latest',
  hits: 'popular',
  score: 'score'
});
// 类型: object；作用: 把平台排序值还原为 MJWO by 路由片段；latest 是源站默认顺序，构造 URL 时可以省略。
const CATALOG_SORT_ROUTE_BY_VALUE = Object.freeze({
  latest: 'time',
  popular: 'hits',
  score: 'score'
});
// 类型: object；作用: 以受审配置冻结电影和美剧目录差异，统一引擎只解释配置，不复制站点算法。
const CATALOG_DEFINITION = Object.freeze({
  // 字段作用: 电影目录保留类型根分类，并按源站顺序交付五组筛选。
  movie: Object.freeze({
    pageKey: 'movie',
    label: '电影',
    entryPath: '/type/dianying/',
    rootToken: 'dianying',
    contentType: 'movie',
    defaults: Object.freeze({ category: 'all', genre: 'all', area: 'all', year: 'all', sort: 'latest' }),
    filterGroupsByLabel: Object.freeze({
      类型: Object.freeze({ name: 'category', routeSegment: '' }),
      剧情: Object.freeze({ name: 'genre', routeSegment: 'class' }),
      地区: Object.freeze({ name: 'area', routeSegment: 'area' }),
      年份: Object.freeze({ name: 'year', routeSegment: 'year' }),
      排序: Object.freeze({ name: 'sort', routeSegment: 'by' })
    }),
    routeOrder: Object.freeze(['area', 'sort', 'genre', 'page', 'year'])
  }),
  // 字段作用: 美剧目录根分类固定为 meiju，源站没有地区组，状态通过 isend 路由表达。
  tv: Object.freeze({
    pageKey: 'tv',
    label: '美剧',
    entryPath: '/type/meiju/',
    rootToken: 'meiju',
    contentType: 'tv',
    defaults: Object.freeze({ genre: 'all', year: 'all', status: 'all', sort: 'latest' }),
    filterGroupsByLabel: Object.freeze({
      剧情: Object.freeze({ name: 'genre', routeSegment: 'class' }),
      年份: Object.freeze({ name: 'year', routeSegment: 'year' }),
      状态: Object.freeze({ name: 'status', routeSegment: 'isend' }),
      排序: Object.freeze({ name: 'sort', routeSegment: 'by' })
    }),
    routeOrder: Object.freeze(['sort', 'genre', 'status', 'page', 'year'])
  })
});

// 类型: string；作用: 限定搜索解析只读取源站稳定的结果列表，不扫描推荐、导航或分页卡片。
const SEARCH_RESULT_LIST_ID = 'searchList';
// 类型: string；作用: 隔离搜索条目缩略图区，防止详情段落被通用目录元信息解析器误读。
const SEARCH_THUMB_CLASS = 'thumb';
// 类型: string；作用: 限定分类信息只来自每条搜索结果的详情区。
const SEARCH_DETAIL_CLASS = 'detail';
// 类型: Array<string>；作用: 搜索行只采用四类轻量事实，不把详情页主创、状态或播放字段解释规则带入列表请求。
const SEARCH_METADATA_LABELS = Object.freeze(['分类', '地区', '年份', '类型']);
// 类型: Array<object>；作用: 把搜索详情区的源站分类映射为标准类型；顺序让具体电影类别先于包含“剧”字的电视剧语义。
const SEARCH_CLASSIFICATION_TYPE_RULES = Object.freeze([
  Object.freeze({ type: 'movie', pattern: /电影|影片|动作片|喜剧片|爱情片|科幻片|恐怖片|剧情片|战争片|悬疑片|犯罪片|惊悚片|奇幻片|冒险片|动画片|纪录片|灾难片|院线/i }),
  Object.freeze({ type: 'tv', pattern: /美剧|电视剧|连续剧|剧集|国产剧|港剧|台剧|韩剧|日剧|泰剧|海外剧|动漫|综艺|真人秀/i })
]);
// 类型: Array<object>；作用: 显式分类缺失或出现新文案时，根据缩略图右下角的剧集进度或电影质量作辅助判断。
const SEARCH_STATUS_TYPE_RULES = Object.freeze([
  Object.freeze({ type: 'tv', pattern: /更新至\s*(?:第\s*)?\d+\s*集|第\s*\d+\s*集|\d+\s*集全|全\s*\d+\s*集|连载|完结/i }),
  Object.freeze({ type: 'movie', pattern: /HD|BD|WEB-DL|1080P|2160P|4K|TC|TS|蓝光|高清|超清|正片/i })
]);

// 类型: string；作用: 详情字段只从源站主信息容器读取，避免推荐和导航文案污染标准对象。
const DETAIL_CONTAINER_CLASS = 'myui-content__detail';
// 类型: string；作用: 详情清晰度或集数状态只从 p.otherbox 读取，二维码提示和其他无标签段落不得进入 ContentItem。
const DETAIL_STATUS_CLASS = 'otherbox';
// 类型: string；作用: 主海报只从源站详情封面容器读取，避免采用推荐卡片图片。
const DETAIL_THUMB_CLASS = 'myui-content__thumb';
// 类型: string；作用: 电影正片和电视剧分集共同使用的唯一权威播放列表 id。
const DETAIL_PLAYLIST_ID = 'playlist1';
// 类型: Array<string>；作用: 按最长标签优先冻结 MJWO 详情可见字段，字段解析器不把值中的普通文本误作新标签。
const DETAIL_FIELD_LABELS = Object.freeze([
  '豆瓣评分',
  '上映日期',
  '首播日期',
  '最后更新于',
  '更新时间',
  '分类',
  '地区',
  '类型',
  '主演',
  '导演',
  '编剧',
  '又名',
  '首播',
  '上映',
  '语言',
  '片长',
  '状态',
  '年份'
]);
// 类型: Array<object>；作用: 只允许精确 class token 提供详情简介，禁止模糊匹配 myui-content__detail 或封面容器。
const DETAIL_DESCRIPTION_LOCATORS = Object.freeze([
  Object.freeze({ tagName: 'div', classToken: 'myui-content__desc' }),
  Object.freeze({ tagName: 'p', classToken: 'myui-content__desc' }),
  Object.freeze({ tagName: 'div', classToken: 'description' }),
  Object.freeze({ tagName: 'p', classToken: 'description' })
]);
// 类型: object；作用: 冻结公共线路和逻辑剧集身份前缀，禁止 URL、数组位置和媒体地址成为跨层身份。
const PLAY_CATALOG_POLICY = Object.freeze({
  lineIdPrefix: 'mjwo-line',
  featureEpisodeId: 'feature',
  regularEpisodeIdPrefix: 'episode',
  seasonEpisodeIdPrefix: 'season',
  specialEpisodeIdPrefix: 'special'
});
// 类型: object；作用: 消费平台标准 player 请求意图；Provider 只据此决定自己的媒体事实刷新，不改变公共响应结构。
const PLAYER_REQUEST_PURPOSE = Object.freeze({
  playback: 'playback',
  probe: 'probe'
});
// 类型: object；作用: 集中 64 位 FNV-1a 参数，Provider 用它生成稳定但不可逆的公共身份。
const STABLE_ID_HASH_POLICY = Object.freeze({
  offsetBasis: 14695981039346656037n,
  prime: 1099511628211n,
  mask: 18446744073709551615n,
  hexLength: 16
});

/**
 * 把 MJWO 原始响应字节严格解码为 UTF-8 文本。
 * 纯函数: 只读取 ArrayBuffer，不访问网络、DOM、存储或生命周期状态。
 * 成功路径: 返回 HTML 或 JSON 文本，由当前脚本继续按端点解析。
 * 失败路径: 非 ArrayBuffer 或非法 UTF-8 抛 Error，禁止兼容平台预解码文本。
 *
 * @param {*} body SourceNetworkResponse.body 候选。
 * @returns {string} MJWO HTML 或 JSON 文本。
 * @throws {Error} 原始字节类型或 UTF-8 编码无效时抛出。
 */
function decodeUtf8Body(body) {
  // 条件分支: Shell 没有交付 ABI 2.0 ArrayBuffer 时进入。
  // 执行内容: 失败关闭，不接收旧 text 响应旁路。
  if (!(body instanceof ArrayBuffer)) throw new Error('MJWO 响应字节无效');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch (error) {
    throw new Error('MJWO 响应无法解码');
  }
}

/**
 * 清理 MJWO HTML 文本。
 * 纯函数: 删除脚本、样式、标签并解码常见实体，不创建 DOM。
 * 成功路径: 返回可展示单行文本。
 * 失败路径: 非字符串返回空字符串。
 *
 * @param {*} value HTML 片段。
 * @returns {string} 清理文本。
 */
function cleanText(value) {
  // 条件分支: 输入不是字符串时进入。
  // 执行内容: 返回空文本，拒绝对象隐式转换。
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 读取 HTML 属性。
 * 纯函数: 只在当前开始标签上匹配属性。
 * 成功路径: 返回引号或无引号属性值。
 * 失败路径: 缺少属性返回空字符串。
 *
 * @param {string} tag 标签文本。
 * @param {string} name 属性名。
 * @returns {string} 属性值。
 */
function readAttribute(tag, name) {
  // 类型: RegExpMatchArray|null；作用: 保存当前标签属性的受限匹配结果。
  const match = String(tag || '').match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return cleanText(match ? match[1] || match[2] || match[3] || '' : '');
}

/**
 * 读取 MJWO 卡片内联 style 的背景图地址。
 * 纯函数: 只识别 background/background-image 的 url(...) 值，不执行 CSS 或访问 DOM。
 * 成功路径: 返回去除可选引号后的 URL 文本，后续仍由 absoluteUrl 执行 HTTPS 门禁。
 * 失败路径: 非字符串、没有 url(...) 或空值时返回空字符串。
 *
 * @param {*} style 卡片开始标签的 style 属性候选。
 * @returns {string} 背景图 URL 候选或空字符串。
 */
function readStyleBackgroundUrl(style) {
  // 类型: string；作用: 只接受显式 style 文本，避免对象隐式转换成可解析 CSS。
  const source = typeof style === 'string' ? style : '';
  // 类型: RegExpMatchArray|null；作用: 提取第一个 url(...)，兼容单引号、双引号和无引号写法。
  const match = source.match(/\b(?:background|background-image)\s*:[^;]*?url\(\s*(?:"([^"]+)"|'([^']+)'|([^)'"\s]+))\s*\)/i);
  return match ? (match[1] || match[2] || match[3] || '').trim() : '';
}

/**
 * 读取页面指定 name 的 meta content。
 * 纯函数: 只扫描 meta 开始标签，不执行页面脚本或创建 DOM。
 * 成功路径: 返回首个同名 meta 的 content 文本。
 * 失败路径: HTML、name 或 content 缺失时返回空字符串。
 *
 * @param {*} html MJWO 页面 HTML。
 * @param {string} name meta name 字段。
 * @returns {string} meta content 或空字符串。
 */
function readMetaContent(html, name) {
  // 类型: Array<string>；作用: 保存页面全部 meta 开始标签，空页面使用空数组。
  const metaTags = typeof html === 'string' ? html.match(/<meta\b[^>]*>/gi) || [] : [];
  // 类型: string|undefined；作用: 保存首个 name 精确匹配的 meta 标签。
  const target = metaTags.find(tag => readAttribute(tag, 'name').toLowerCase() === name.toLowerCase());
  return target ? readAttribute(target, 'content') : '';
}

/**
 * 规范化 MJWO 页面、解析和 HTTPS 媒体地址。
 * 纯函数: 只解析 URL，不发起请求。
 * 成功路径: 页面允许 www.mjwo.net，解析允许 api.apiimg.com，媒体允许任意无凭据 HTTPS 地址。
 * 失败路径: HTTP、凭据或非法 URL 返回空字符串。
 *
 * @param {*} value URL 候选。
 * @param {boolean} allowMedia 是否允许媒体 host。
 * @returns {string} 安全绝对地址或空字符串。
 */
function absoluteUrl(value, allowMedia = false) {
  // 类型: string；作用: 保存清理后的 URL 文本。
  const text = typeof value === 'string' ? value.trim() : '';
  // 条件分支: URL 文本为空时进入。
  // 执行内容: 返回空地址，不猜测默认路径。
  if (!text) return '';
  try {
    // 类型: URL；作用: 保存绝对 URL 解析结果。
    const parsedUrl = new URL(text, PAGE_BASE_URL);
    // 类型: boolean；作用: 标记页面/解析 host 是否在 manifest 允许集合。
    const allowedHost = parsedUrl.host === 'www.mjwo.net' || parsedUrl.host === 'api.apiimg.com';
    // 条件分支: 协议、凭据或 host 不符合边界时进入。
    // 执行内容: 拒绝跨站信息地址；媒体地址由 allowMedia 明确放行 HTTPS。
    if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password
      || (!allowedHost && !allowMedia)) return '';
    return parsedUrl.href;
  } catch (error) {
    return '';
  }
}

/**
 * 规范化浏览器直连媒体地址。
 * 纯函数: 只读取 HTTPS URL 的路径，不通过代理请求媒体。
 * 成功路径: 返回 MP4/HLS 绝对地址。
 * 失败路径: 其他扩展名返回空字符串。
 *
 * @param {*} value 媒体候选。
 * @returns {string} 直连媒体或空字符串。
 */
function normalizeMediaUrl(value) {
  // 类型: string；作用: 保存允许 host 下的绝对媒体候选。
  const url = absoluteUrl(value, true);
  // 条件分支: 地址未通过 HTTPS/凭据门禁时进入。
  // 执行内容: 返回空值，不把非法地址交给播放器。
  if (!url) return '';
  // 类型: string；作用: 保存媒体 URL 小写路径。
  const path = new URL(url).pathname.toLowerCase();
  return path.endsWith('.mp4') || path.endsWith('.m3u8') ? url : '';
}

/**
 * 从 MJWO 详情/播放地址形成内容身份。
 * 纯函数: 只接受 /vod/数字/ 详情路径。
 *
 * @param {*} value 源站详情地址或数字 id。
 * @returns {string} mjwo:数字 或空字符串。
 */
function parseContentId(value) {
  // 类型: string；作用: 保存当前详情或播放链接文本。
  const text = String(value || '').trim();
  // 类型: RegExpMatchArray|null；作用: 提取 /vod/ 数字或纯数字身份。
  const match = text.match(/\/vod\/(\d+)\/?/i) || text.match(/^(\d+)$/);
  return match ? `mjwo:${match[1]}` : '';
}

/**
 * 还原 MJWO 详情地址。
 * 纯函数: 不发起网络，身份非法返回空字符串。
 *
 * @param {*} contentId MJWO 内容身份。
 * @returns {string} 详情地址。
 */
function createDetailUrl(contentId) {
  // 类型: RegExpMatchArray|null；作用: 解析 mjwo:数字 内容身份。
  const match = typeof contentId === 'string' ? contentId.match(/^mjwo:(\d+)$/) : null;
  return match ? `${PAGE_BASE_URL}/vod/${match[1]}/` : '';
}

/**
 * 从 MJWO 播放页脚本提取源站解析参数。
 * 纯函数: 只扫描公开的 player_aaaa 对象，不执行脚本或推测媒体地址。
 * 成功路径: 返回 url 字段的非空参数文本。
 * 失败路径: 播放页没有标准对象或 url 字段时返回空字符串。
 *
 * @param {*} html 播放页 HTML。
 * @returns {string} 源站解析参数或空字符串。
 */
function extractPlayerParameter(html) {
  // 类型: string；作用: 保存播放页文本，拒绝对象隐式转换为脚本内容。
  const source = typeof html === 'string' ? html : '';
  // 类型: RegExpMatchArray|null；作用: 读取 player_aaaa 对象中带引号或不带引号的 url 字段。
  const match = source.match(/player_aaaa\s*=\s*{[\s\S]*?["']url["']\s*:\s*["']([^"']+)["']/i)
    || source.match(/player_aaaa\s*=\s*{[\s\S]*?\burl\s*:\s*["']([^"']+)["']/i);
  return match ? match[1].trim() : '';
}

/**
 * 构造 MJWO 源站解析页地址。
 * 纯函数: 只编码公开解析参数，不发起网络请求或生成媒体代理地址。
 * 成功路径: 返回固定解析 host、id 和 next 参数组成的 HTTPS 地址。
 * 失败路径: 解析参数为空时返回空字符串，阻止无身份解析请求。
 *
 * @param {*} parameter 播放页提取的解析参数。
 * @returns {string} 源站解析页地址或空字符串。
 */
function buildParserUrl(parameter) {
  // 类型: string；作用: 保存去除首尾空白后的解析参数文本。
  const normalizedParameter = typeof parameter === 'string' ? parameter.trim() : '';
  // 条件分支: 解析参数为空时进入。
  // 执行内容: 返回空地址，让调用方明确报告播放链路不支持。
  if (!normalizedParameter) return '';
  return `${PARSER_BASE_URL}?id=${encodeURIComponent(normalizedParameter)}&next=${PARSER_NEXT_URL}`;
}

/**
 * 读取 HTML 片段内首个同时包含指定 class token 的元素文本。
 * 纯函数: 只扫描指定标签开始/结束边界，不创建 DOM 或执行页面脚本。
 * 成功路径: 返回全部 class 条件都满足的首个元素文本，用于区分 pic-text 的标题和右下角状态。
 * 失败路径: 片段、标签或 class 集合不匹配时返回空字符串。
 *
 * @param {*} fragment 当前卡片或排行榜行 HTML。
 * @param {string} tagName 需要扫描的标签名。
 * @param {Array<string>} classTokens 必须同时完整命中的 class token。
 * @returns {string} 匹配元素文本或空字符串。
 */
function readElementTextByClasses(fragment, tagName, classTokens) {
  // 类型: string；作用: 保存受限 HTML 片段，拒绝对象隐式转换为页面正文。
  const source = typeof fragment === 'string' ? fragment : '';
  // 类型: Array<string>；作用: 清理调用方要求的 class token，空集合不匹配任何元素。
  const requiredClassTokens = Array.isArray(classTokens)
    ? classTokens.map(cleanText).filter(Boolean)
    : [];
  // 条件分支: 调用方没有提供有效 class token 时进入；执行内容: 返回空文本，避免无条件采用第一个标签。
  if (!requiredClassTokens.length) return '';
  // 类型: RegExp；作用: 只扫描调用方指定标签，class 判断仍由 readAttribute 完成精确 token 匹配。
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  // 类型: RegExpMatchArray|null；作用: 保存当前候选元素和内部 HTML。
  let match;
  while ((match = pattern.exec(source)) !== null) {
    // 类型: string；作用: 保存当前候选开始标签，避免在内部子元素 class 上误命中。
    const openingTag = match[0].slice(0, match[0].indexOf('>') + 1);
    // 类型: Array<string>；作用: 按 HTML 空白拆分当前元素自身的 class token。
    const classNames = readAttribute(openingTag, 'class').split(/\s+/).filter(Boolean);
    // 条件分支: 当前元素同时具备全部目标 class token 时进入。
    // 执行内容: 返回其内部可展示文本，保持源站第一个完整匹配元素权威。
    if (requiredClassTokens.every(classToken => classNames.includes(classToken))) return cleanText(match[1]);
  }
  return '';
}

/**
 * 读取 HTML 片段内首个带指定单个 class token 的元素文本。
 * 纯函数: 委托 readElementTextByClasses 执行同一精确 token 规则。
 * 成功路径: 返回匹配元素清理后的文本，供单 class 的元信息和榜单字段使用。
 * 失败路径: class 缺失时返回空字符串。
 *
 * @param {*} fragment 当前卡片或排行榜行 HTML。
 * @param {string} tagName 需要扫描的标签名。
 * @param {string} classToken 必须完整命中的 class token。
 * @returns {string} 匹配元素文本或空字符串。
 */
function readElementTextByClass(fragment, tagName, classToken) {
  return readElementTextByClasses(fragment, tagName, [classToken]);
}

/**
 * 把 MJWO 剧集状态文本转换为标准电视剧进度。
 * 纯函数: 只识别“更新至 N 集”“N 集全”和“全 N 集”，原始状态仍完整保留。
 * 成功路径: 返回 updateStatus 以及可以确定的总集数和最新集数。
 * 失败路径: 没有数字语义时仅保留 updateStatus，不猜测集数。
 *
 * @param {*} status 卡片或排行榜右侧状态文本。
 * @returns {object} 标准 tv 进度字段。
 * @returns {number|null} return.totalEpisodes 已明确完结时的总集数。
 * @returns {number|null} return.latestEpisode 当前已更新集数。
 * @returns {string} return.updateStatus 原始清理状态。
 */
function parseTvProgress(status) {
  // 类型: string；作用: 保存清理后的源站状态，供标准字段和页面原样展示。
  const updateStatus = cleanText(typeof status === 'string' ? status : '');
  // 类型: RegExpMatchArray|null；作用: 识别仍在连载的当前集数。
  const updatingMatch = updateStatus.match(/更新至\s*(?:第\s*)?(\d+)\s*集/i);
  // 类型: RegExpMatchArray|null；作用: 识别已经明确全集的总集数。
  const completedMatch = updateStatus.match(/(?:全\s*(\d+)\s*集|(\d+)\s*集全)/i);
  // 条件分支: 源站明确给出全集数量时进入。
  // 执行内容: 总集数和最新集数采用同一个完成值。
  if (completedMatch) {
    // 类型: number；作用: 保存源站明确声明的正片总集数，并同步作为已更新集数。
    const totalEpisodes = Number(completedMatch[1] || completedMatch[2]);
    return { totalEpisodes, latestEpisode: totalEpisodes, updateStatus, season: '' };
  }
  // 类型: number|null；作用: 连载状态只确定最新集，不推测最终总集数。
  const latestEpisode = updatingMatch ? Number(updatingMatch[1]) : null;
  return { totalEpisodes: null, latestEpisode, updateStatus, season: '' };
}

/**
 * 创建 MJWO 标准轻量 ContentItem。
 * 纯函数: 只组合已经校验的身份、标题、类型、图片、列表元信息、排名和状态，不访问网络或保存状态。
 * 成功路径: 电影把状态写入 quality 并采用可用目录字段，电视剧把状态转换为 tv 进度；两者共享同一来源追踪结构。
 * 失败路径: 调用方必须先过滤空 id 和 title，本函数不生成替代身份或标题。
 *
 * @param {object} options 内容构造输入。
 * @param {string} options.id MJWO 标准内容身份。
 * @param {string} options.sourceId 当前 Provider 身份。
 * @param {string} options.type movie 或 tv。
 * @param {string} options.title 展示标题。
 * @param {string} [options.poster] HTTPS 海报地址。
 * @param {string} [options.year] 源站目录年份。
 * @param {string} [options.area] 源站目录地区。
 * @param {Array<string>} [options.genres] 源站目录剧情标签。
 * @param {number|null} [options.score] 源站评分。
 * @param {Array<string>} [options.displayTags] 源站展示标签。
 * @param {number|null} [options.rank] 源站榜单名次。
 * @param {string} [options.status] 卡片或榜单右侧状态。
 * @returns {object} 标准轻量 ContentItem。
 */
function createContentItem({
  id,
  sourceId,
  type,
  title,
  poster = '',
  year = '',
  area = '',
  genres = [],
  score = null,
  displayTags = [],
  rank = null,
  status = ''
}) {
  // 类型: object；作用: 电视剧采用可确定的集数进度，电影保持空电视剧结构。
  const tv = type === 'tv'
    ? parseTvProgress(status)
    : { totalEpisodes: null, latestEpisode: null, updateStatus: '', season: '' };
  return {
    id,
    sourceId,
    sourceName: sourceManifest.name,
    type,
    title,
    originalTitle: '',
    aliases: [],
    poster,
    cover: poster,
    description: '',
    year: cleanText(year),
    area: cleanText(area),
    language: '',
    genres: Array.isArray(genres) ? genres.map(cleanText).filter(Boolean) : [],
    tags: [],
    displayTags: Array.isArray(displayTags) ? displayTags.map(cleanText).filter(Boolean) : [],
    score: Number.isFinite(score) ? score : null,
    // 字段边界: 电影状态通常是 HD/4K，电视剧状态由 tv.updateStatus 承载。
    quality: type === 'movie' ? cleanText(status) : '',
    rank,
    badge: '',
    detail: null,
    movie: { duration: '' },
    tv,
    playCatalog: null,
    playback: null,
    source: {
      name: sourceManifest.name,
      domain: 'www.mjwo.net',
      rawId: id,
      sourceDetailUrl: createDetailUrl(id),
      rawData: null,
      fetchedAt: ''
    }
  };
}

/**
 * 解析 MJWO 卡片评分和展示标签。
 * 纯函数: 只读取当前卡片内 class=tag 的 span；数字标签归入 score，其他文本保持源站顺序进入 displayTags。
 * 成功路径: 返回首个合法数字评分和去重后的非数字标签。
 * 失败路径: 没有标签时返回 score=null 和空数组，不根据标题或年份猜测。
 *
 * @param {*} fragment 单个卡片 HTML 片段。
 * @returns {object} 卡片评分和展示标签。
 * @returns {number|null} return.score 首个有限数字评分。
 * @returns {Array<string>} return.displayTags 非数字展示标签。
 */
function parseCardTags(fragment) {
  // 类型: string；作用: 只接受卡片片段，非法输入按无标签处理。
  const source = typeof fragment === 'string' ? fragment : '';
  // 类型: Array<string>；作用: 按源站顺序保存非数字展示标签。
  const displayTags = [];
  // 类型: Set<string>；作用: 同一标签文本只采用一次，保持首次位置。
  const seenTags = new Set();
  // 类型: number|null；作用: 只采用源站首个有限数字评分。
  let score = null;
  // 类型: RegExp；作用: 只扫描 span 开始标签，避免外层 pic-tag 嵌套吞掉内部正式 tag。
  const tagPattern = /<span\b[^>]*>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前 span 开始标签候选。
  let tagMatch;
  while ((tagMatch = tagPattern.exec(source)) !== null) {
    // 条件分支: 当前 span 不具备 tag class 时进入；执行内容: 跳过状态和布局 span。
    if (!readAttribute(tagMatch[0], 'class').split(/\s+/).includes('tag')) continue;
    // 类型: RegExpMatchArray|null；作用: 正式 tag 不嵌套 span，读取当前开始标签后的首个结束标签正文。
    const contentMatch = source.slice(tagPattern.lastIndex).match(/^([\s\S]*?)<\/span>/i);
    // 类型: string；作用: 保存当前标签可见文本；闭合缺失时按空标签处理。
    const label = cleanText(contentMatch?.[1] || '');
    // 条件分支: 标签是纯数字评分且尚未采用评分时进入；执行内容: 写入标准 score，不重复展示数字 chip。
    if (score === null && /^\d+(?:\.\d+)?$/.test(label)) {
      // 类型: number；作用: 把纯数字标签转换为可校验的标准评分候选。
      const numericScore = Number(label);
      // 条件分支: 评分候选是有限数字时进入；执行内容: 采用为当前卡片唯一 score。
      if (Number.isFinite(numericScore)) score = numericScore;
      continue;
    }
    // 条件分支: 非空非数字标签首次出现时进入；执行内容: 保留源站展示语义。
    if (label && !seenTags.has(label)) {
      seenTags.add(label);
      displayTags.push(label);
    }
  }
  return { score, displayTags };
}

/**
 * 解析 MJWO 主体卡片的年份、地区和剧情文本。
 * 纯函数: 只读取当前卡片详情区 class=text 的 p，并按源站 `年份/地区/剧情` 顺序拆分。
 * 成功路径: 返回清理后的 year、area 和逗号分隔 genres。
 * 失败路径: 顶部推荐或元信息缺失时返回契约空值，不请求详情页补齐。
 *
 * @param {*} fragment 单个主体卡片 HTML 片段。
 * @returns {object} 轻量目录元信息。
 * @returns {string} return.year 年份或空字符串。
 * @returns {string} return.area 地区或空字符串。
 * @returns {Array<string>} return.genres 剧情标签。
 */
function parseCatalogMetadata(fragment) {
  // 类型: string；作用: 读取目录详情行，例如 2026/美国/喜剧,歌舞。
  const metadataText = readElementTextByClass(fragment, 'p', 'text');
  // 类型: Array<string>；作用: 按源站字段顺序拆分并清理空白。
  const fields = metadataText.split('/').map(cleanText);
  // 类型: string；作用: 第三个及后续斜杠片段重新合并为剧情文本，避免异常文本静默丢失尾部。
  const genreText = fields.slice(2).join('/');
  return {
    year: fields[0] || '',
    area: fields[1] || '',
    genres: genreText.split(/[,，、]/).map(cleanText).filter(Boolean)
  };
}

/**
 * 解析单个 MJWO 正式缩略图卡片。
 * 纯函数: 从当前片段定位首个 myui-vodlist__thumb，组合身份、海报、状态、评分和可选目录元信息。
 * 成功路径: 返回一个不含 raw HTML 的标准 ContentItem。
 * 失败路径: 正式链接、内容身份或标题缺失时返回 null。
 *
 * @param {*} fragment 单个 anchor、li 或卡片容器 HTML。
 * @param {string} sourceId 当前 Provider 身份。
 * @param {string} contentType 当前板块或搜索分类已经确定的 movie/tv 类型。
 * @param {object|null} [metadataOverride] 搜索详情区等独立同级区域已经解析的 year、area 和 genres；null 时读取当前卡片详情行。
 * @returns {object|null} 标准 ContentItem 或 null。
 */
function parseCardFragment(fragment, sourceId, contentType, metadataOverride = null) {
  // 类型: string；作用: 限制扫描范围为调用方交付的单卡片片段。
  const source = typeof fragment === 'string' ? fragment : '';
  // 类型: RegExp；作用: 按片段顺序扫描 anchor，直到找到正式缩略图链接。
  const anchorPattern = /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前 anchor 候选。
  let anchorMatch;
  while ((anchorMatch = anchorPattern.exec(source)) !== null) {
    // 类型: string；作用: 保存当前链接开始标签，属性读取只在自身边界内进行。
    const openingTag = anchorMatch[0].slice(0, anchorMatch[0].indexOf('>') + 1);
    // 条件分支: 当前链接不是正式缩略图时进入；执行内容: 跳过详情标题和工具链接。
    if (!readAttribute(openingTag, 'class').split(/\s+/).includes('myui-vodlist__thumb')) continue;
    // 类型: string；作用: 保存当前卡片详情地址。
    const href = anchorMatch[1] || anchorMatch[2] || '';
    // 类型: string；作用: 把详情地址转换为全站稳定的 MJWO 内容身份。
    const id = parseContentId(href);
    // 类型: string；作用: 保存 anchor 内部 HTML，供图片、状态和标签解析。
    const inner = anchorMatch[3] || '';
    // 类型: string；作用: 保存可选 img 标签；顶部滚动卡片只使用 style 背景图时允许为空。
    const image = inner.match(/<img\b[^>]*>/i)?.[0] || '';
    // 类型: string；作用: title 属性优先，img alt 次之，最后才清理链接内部文本。
    const title = readAttribute(openingTag, 'title') || readAttribute(image, 'alt') || cleanText(inner);
    // 条件分支: 身份或标题缺失时进入；执行内容: 当前卡片失败关闭。
    if (!id || !title) return null;
    // 类型: string；作用: 依次采用 data-original、图片属性和顶部卡片 style 背景图，并执行 HTTPS 门禁。
    const poster = absoluteUrl(
      readAttribute(openingTag, 'data-original')
        || readAttribute(openingTag, 'data-src')
        || readAttribute(image, 'data-original')
        || readAttribute(image, 'data-src')
        || readAttribute(image, 'src')
        || readStyleBackgroundUrl(readAttribute(openingTag, 'style')),
      true
    );
    // 条件分支: 上游板块或搜索分类没有交付标准类型时进入；执行内容: 当前卡片失败关闭，禁止通用缩略图解析器猜测站点业务。
    if (contentType !== 'movie' && contentType !== 'tv') return null;
    // 类型: string；作用: 卡片右下角质量或更新状态，由标准内容构造器按 movie/tv 归位。
    const status = readElementTextByClasses(inner, 'span', ['pic-text', 'text-right']);
    // 类型: object；作用: 解析数字评分和非数字展示标签。
    const tags = parseCardTags(inner);
    // 类型: object；作用: 搜索可以交付已隔离详情区元信息，首页和目录则直接读取完整卡片容器中的同级详情行。
    const metadata = metadataOverride && typeof metadataOverride === 'object'
      ? metadataOverride
      : parseCatalogMetadata(source);
    return createContentItem({
      id,
      sourceId,
      type: contentType,
      title,
      poster,
      year: metadata.year,
      area: metadata.area,
      genres: metadata.genres,
      score: tags.score,
      displayTags: tags.displayTags,
      status
    });
  }
  return null;
}

/**
 * 解析 MJWO 列表卡片。
 * 纯函数: 扫描当前区域全部完整 `myui-vodlist__box`，并由单卡片解析器同时读取缩略图和同级详情元信息。
 * 成功路径: 首页、目录和顶部推荐共用同一容器边界，返回按源站顺序去重且不含 raw HTML 的内容数组。
 * 失败路径: 正式卡片容器、id 或标题缺失时跳过；不回退整页 anchor 扫描，以免静默丢失元信息或混入非卡片链接。
 *
 * @param {*} html 页面 HTML。
 * @param {string} sourceId Provider 身份。
 * @param {string} contentType 当前页面区域已经确定的 movie/tv 类型。
 * @returns {Array<object>} ContentItem 列表。
 */
function parseCards(html, sourceId, contentType) {
  // 类型: string；作用: 保存已经隔离到单个首页或目录板块的列表 HTML。
  const source = typeof html === 'string' ? html : '';
  // 类型: Array<object>；作用: 收集标准内容。
  const items = [];
  // 类型: Set<string>；作用: 内容身份去重集合。
  const seen = new Set();
  // 类型: Array<object>；作用: 每项保留完整 myui-vodlist__box 外壳，使缩略图后的标题和元信息不会被 anchor 扫描提前裁掉。
  const cardContainers = extractElementsByClass(source, 'div', 'myui-vodlist__box');
  for (const cardContainer of cardContainers) {
    // 类型: object|null；作用: 完整卡片容器统一交给同一个解析器，首页、目录和顶部推荐不再维护近似实现。
    const item = parseCardFragment(cardContainer.html, sourceId, contentType);
    // 条件分支: 当前链接无效或区域内身份已经采用时进入；执行内容: 跳过并保持首次位置。
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

/**
 * 按 class token 提取全部平衡 HTML 元素。
 * 纯函数: 逐个扫描同名开始和结束标签并保留完整外壳、开始标签与内部 HTML；不创建 DOM 或执行源站脚本。
 * 成功路径: class 顺序无关地返回当前区域全部目标容器，嵌套同名标签不会截断卡片正文。
 * 失败路径: 标签名、class、HTML 或闭合结构无效时返回空数组；不回退为模糊正则或整页 anchor 扫描。
 *
 * @param {*} html 源站页面或已隔离区域 HTML。
 * @param {string} tagName 目标标签名。
 * @param {string} classToken 目标开始标签必须包含的完整 class token。
 * @returns {Array<object>} 平衡元素集合。
 * @returns {string} return[].html 包含开始和结束标签的完整元素 HTML。
 * @returns {string} return[].openingTag 当前元素开始标签。
 * @returns {string} return[].innerHtml 当前元素内部 HTML。
 */
function extractElementsByClass(html, tagName, classToken) {
  // 类型: string；作用: 只接受显式 HTML 文本，非法输入不能触发隐式字符串解析。
  const source = typeof html === 'string' ? html : '';
  // 条件分支: 标签名不是内部受审的简单 HTML 名称或 class 为空时进入；执行内容: 拒绝构造动态正则。
  if (!/^[a-z][a-z0-9-]*$/i.test(tagName) || !classToken) return [];
  // 类型: Array<object>；作用: 按源站出现顺序保存每个完整目标元素。
  const elements = [];
  // 类型: RegExp；作用: 依次扫描目标同名开始和结束标签，支持目标内部同名元素嵌套。
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  // 类型: number；作用: 目标内部同名标签嵌套深度；0 表示当前没有打开的目标元素。
  let depth = 0;
  // 类型: number；作用: 当前目标完整外壳的开始位置；-1 表示尚未命中。
  let elementStart = -1;
  // 类型: number；作用: 当前目标开始标签之后的正文起点；-1 表示尚未命中。
  let contentStart = -1;
  // 类型: string；作用: 保存当前目标自己的开始标签，调用方可读取其属性而不扫描内部节点。
  let openingTag = '';
  // 类型: RegExpMatchArray|null；作用: 保存当前同名标签扫描结果。
  let tagMatch;
  while ((tagMatch = tagPattern.exec(source)) !== null) {
    // 类型: boolean；作用: true 减少当前目标深度，false 增加深度或尝试建立新目标。
    const isClosingTag = /^<\//.test(tagMatch[0]);
    // 条件分支: 当前不在目标元素内部时进入；执行内容: 只允许带精确 class token 的开始标签建立新目标。
    if (depth === 0) {
      // 条件分支: 尚未命中目标却遇到无归属结束标签时进入；执行内容: 跳过并继续寻找下一个合法开始标签。
      if (isClosingTag) continue;
      // 类型: Array<string>；作用: 只读取当前开始标签自身的 class token，避免内部后代 class 误命中。
      const classNames = readAttribute(tagMatch[0], 'class').split(/\s+/).filter(Boolean);
      // 条件分支: 当前开始标签不含目标 class 时进入；执行内容: 继续扫描后续同名元素。
      if (!classNames.includes(classToken)) continue;
      depth = 1;
      elementStart = tagMatch.index;
      contentStart = tagPattern.lastIndex;
      openingTag = tagMatch[0];
      continue;
    }
    // 状态变化: 目标内部同名开始标签增加深度，结束标签减少深度，保证嵌套 div 不截断外层卡片。
    depth += isClosingTag ? -1 : 1;
    // 条件分支: 当前目标闭合时进入；执行内容: 保存完整外壳和正文后继续扫描后续同类目标。
    if (depth === 0) {
      elements.push({
        html: source.slice(elementStart, tagPattern.lastIndex),
        openingTag,
        innerHtml: source.slice(contentStart, tagMatch.index)
      });
      elementStart = -1;
      contentStart = -1;
      openingTag = '';
    }
  }
  return elements;
}

/**
 * 按 class token 提取首个平衡 HTML 元素正文。
 * 纯函数: 使用同名开始/结束标签计数，不依赖固定结束下标或 DOM；只返回目标元素内部 HTML。
 * 成功路径: class 顺序无关地定位 div/ul 等容器，并正确跨越同名嵌套元素。
 * 失败路径: 标签名、class、HTML 或闭合结构无效时返回空字符串。
 *
 * @param {*} html 源站页面或区域 HTML。
 * @param {string} tagName 目标标签名。
 * @param {string} classToken 目标开始标签必须包含的完整 class token。
 * @returns {string} 目标元素内部 HTML 或空字符串。
 */
function extractElementByClass(html, tagName, classToken) {
  // 类型: object|undefined；作用: 复用统一平衡元素扫描器，并只投影旧调用方需要的首个容器正文。
  const firstElement = extractElementsByClass(html, tagName, classToken)[0];
  return firstElement?.innerHtml || '';
}

/**
 * 解析 MJWO 电影目录主体卡片列表。
 * 纯函数: 先按稳定 ul class 隔离电影或美剧主体列表，再逐个 li 解析卡片和同级元信息。
 * 成功路径: 返回主体列表源站顺序的去重 ContentItem。
 * 失败路径: 主体列表缺失时返回空数组，不回退扫描整页或顶部推荐。
 *
 * @param {*} html 完整电影或美剧目录 HTML。
 * @param {string} sourceId 当前 Provider 身份。
 * @param {string} fallbackType 当前目录默认类型。
 * @returns {Array<object>} 主体目录 ContentItem 列表。
 */
function parseCatalogCards(html, sourceId, fallbackType) {
  // 类型: string；作用: 精确隔离目录主体 ul，不把顶部滚动和筛选链接纳入列表。
  const listHtml = extractElementByClass(html, 'ul', CATALOG_LIST_CLASS);
  // 条件分支: 主体列表不存在时进入；执行内容: 返回空集合让上层判断空页或结构失败。
  if (!listHtml) return [];
  // 跨函数调用: 主体列表与首页、顶部推荐共用完整 myui-vodlist__box 解析，不再维护第二套 li 扫描和字段映射。
  return parseCards(listHtml, sourceId, fallbackType);
}

/**
 * 从 MJWO 筛选链接解析平台标准选项值。
 * 纯函数: 只读取当前组声明、链接路径和展示文本；URL 参数始终经过 URL/encodeURIComponent 边界往返。
 * 成功路径: “全部”统一返回 all，其他组返回 category 路由 token、解码文本值或稳定排序值。
 * 失败路径: 路径不属于当前组、排序 token 未登记或 URL 无效时返回空字符串。
 *
 * @param {object} definition 当前目录筛选和路由配置。
 * @param {string} groupName 平台标准筛选组名。
 * @param {string} href 源站筛选链接。
 * @param {string} label 筛选项可见文本。
 * @returns {string} 平台筛选值或空字符串。
 */
function parseCatalogFilterOptionValue(definition, groupName, href, label) {
  // 条件分支: 源站明确展示“全部”时进入；执行内容: 所有组统一使用 all 表达默认值。
  if (cleanText(label) === '全部') return 'all';
  try {
    // 类型: Array<string>；作用: 把站内筛选路径拆成已解码片段，不读取 query 或 hash。
    const segments = new URL(href, PAGE_BASE_URL).pathname
      .split('/')
      .filter(Boolean)
      .map(segment => decodeURIComponent(segment));
    // 条件分支: category 组时进入；执行内容: 采用 /show/ 后的目录 token，不把可见中文类型当路由。
    if (groupName === 'category') {
      // 类型: number；作用: 定位源站路径中的 show 根片段。
      const showIndex = segments.indexOf('show');
      // 类型: string；作用: 读取 show 后的目录分类 token，缺失时保持空值。
      const category = showIndex >= 0 ? segments[showIndex + 1] || '' : '';
      return category && category !== '2' && category !== 'dianying' ? category : '';
    }
    // 类型: object|undefined；作用: 按平台字段定位对应源站路由片段名。
    const group = Object.values(definition.filterGroupsByLabel).find(candidate => candidate.name === groupName);
    // 条件分支: 当前组未登记路由片段时进入；执行内容: 拒绝未知筛选值。
    if (!group || !group.routeSegment) return '';
    // 类型: number；作用: 定位 class/area/year/by 在源站路径中的位置。
    const segmentIndex = segments.indexOf(group.routeSegment);
    // 类型: string；作用: 保存当前路由片段后的筛选值。
    const routeValue = segmentIndex >= 0 ? segments[segmentIndex + 1] || '' : '';
    // 条件分支: sort 组时进入；执行内容: 把 time/hits/score 转成平台稳定值。
    if (groupName === 'sort') return CATALOG_SORT_VALUE_BY_ROUTE[routeValue] || '';
    return routeValue;
  } catch (error) {
    return '';
  }
}

/**
 * 解析 MJWO 电影或美剧目录筛选元数据。
 * 纯函数: 只扫描 class=myui-screen__list 的 ul，以首项可见 label 识别标准组，再解析组内链接。
 * 成功路径: 按源站当前页面顺序返回配置允许的标准 groups。
 * 失败路径: “已选”等非正式组跳过；组没有有效选项时不返回该组，由上层完整性门禁失败关闭。
 *
 * @param {*} html 默认目录入口 HTML。
 * @param {object} definition 当前目录允许的筛选 label 与标准字段映射。
 * @returns {Array<object>} SourceFilterMetaResponse.groups 候选。
 */
function parseCatalogFilterGroups(html, definition) {
  // 类型: string；作用: 只接受完整源站 HTML，非法输入按无筛选处理。
  const source = typeof html === 'string' ? html : '';
  // 类型: Array<object>；作用: 保持源站筛选组出现顺序。
  const groups = [];
  // 类型: RegExp；作用: 筛选 ul 不嵌套 ul，可以稳定逐组读取正文。
  const listPattern = /<ul\b[^>]*>([\s\S]*?)<\/ul>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前 ul 候选。
  let listMatch;
  while ((listMatch = listPattern.exec(source)) !== null) {
    // 类型: string；作用: 保存当前 ul 开始标签，class 判断不读取内部节点。
    const openingTag = listMatch[0].slice(0, listMatch[0].indexOf('>') + 1);
    // 条件分支: 当前 ul 不是电影筛选列表时进入；执行内容: 跳过导航、卡片和分页列表。
    if (!readAttribute(openingTag, 'class').split(/\s+/).includes(CATALOG_FILTER_LIST_CLASS)) continue;
    // 类型: string；作用: 保存当前筛选 ul 内部 HTML。
    const listHtml = listMatch[1] || '';
    // 类型: RegExpMatchArray|null；作用: 首个 li 的可见文本是源站筛选组 label。
    const firstRow = listHtml.match(/<li\b[^>]*>([\s\S]*?)<\/li>/i);
    // 类型: string；作用: 清理“类型/剧情/地区/年份/排序/已选”等可见标题。
    const label = cleanText(firstRow?.[1] || '');
    // 类型: object|undefined；作用: 只接受项目标准字段已登记的五个源站组。
    const groupDefinition = definition.filterGroupsByLabel[label];
    // 条件分支: 当前筛选 ul 是“已选”或其他未登记组时进入；执行内容: 跳过该组。
    if (!groupDefinition) continue;
    // 类型: Array<object>；作用: 按源站按钮顺序保存当前组合法选项。
    const options = [];
    // 类型: Set<string>；作用: 同一标准值只保留首个源站按钮。
    const seenValues = new Set();
    // 类型: RegExp；作用: 扫描当前组全部带 href 的筛选按钮。
    const optionPattern = /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi;
    // 类型: RegExpMatchArray|null；作用: 保存当前筛选项候选。
    let optionMatch;
    while ((optionMatch = optionPattern.exec(listHtml)) !== null) {
      // 类型: string；作用: 保存当前按钮开始标签，active 只读取自身 btn-warm class。
      const optionTag = optionMatch[0].slice(0, optionMatch[0].indexOf('>') + 1);
      // 类型: string；作用: 保存当前筛选项展示文案。
      const optionLabel = cleanText(optionMatch[3]);
      // 类型: string；作用: 把源站链接转换成平台可回传的标准筛选值。
      const optionValue = parseCatalogFilterOptionValue(
        definition,
        groupDefinition.name,
        optionMatch[1] || optionMatch[2] || '',
        optionLabel
      );
      // 条件分支: 值无效或已经采用时进入；执行内容: 跳过不完整按钮。
      if (!optionLabel || !optionValue || seenValues.has(optionValue)) continue;
      seenValues.add(optionValue);
      options.push({
        label: optionLabel,
        value: optionValue,
        count: 0,
        // 类型: boolean；true 表示源站默认页把该按钮标为 btn-warm，false 表示未标记。
        active: readAttribute(optionTag, 'class').split(/\s+/).includes('btn-warm')
      });
    }
    // 条件分支: 当前标准组至少存在一个有效按钮时进入；执行内容: 采用该组。
    if (options.length) groups.push({ name: groupDefinition.name, label, options });
  }
  return groups;
}

/**
 * 校验并规范化电影或美剧目录筛选选择。
 * 纯函数: 允许值只来自同一默认目录页刚解析的 SourceFilterMetaResponse.groups，不维护第二份站点选项表。
 * 成功路径: 缺失字段采用当前目录配置的默认值，并返回配置字段新对象。
 * 失败路径: 组缺失或页面传入值不属于源站当前声明时抛 Error，阻止任意路径片段进入 URL。
 *
 * @param {*} params SourceDataRequest.params 候选。
 * @param {*} groups 当前源站筛选组。
 * @param {object} definition 当前目录默认值和错误语义配置。
 * @returns {object} 已验证目录筛选选择。
 * @throws {Error} 筛选结构或值不受支持时抛出。
 */
function normalizeCatalogFilterSelection(params, groups, definition) {
  // 类型: object；作用: 非对象页面参数按空参数处理。
  const sourceParams = params && typeof params === 'object' ? params : {};
  // 类型: object；作用: 固定五个标准字段的中性默认值。
  const defaults = definition.defaults;
  // 类型: Map<string, object>；作用: 按标准 name 定位源站当前声明的组。
  const groupByName = new Map((Array.isArray(groups) ? groups : []).map(group => [group.name, group]));
  // 类型: object；作用: 保存隔离后的已验证结果。
  const selection = {};
  // 循环顺序: 按 defaults 字段顺序校验，保证 URL 构造和错误定位稳定。
  for (const [name, defaultValue] of Object.entries(defaults)) {
    // 类型: object|undefined；作用: 当前字段必须在源站筛选元数据中存在。
    const group = groupByName.get(name);
    // 条件分支: 当前标准组缺失或 options 结构无效时进入；执行内容: 失败关闭整套电影筛选。
    if (!group || !Array.isArray(group.options)) throw new Error(`MJWO ${definition.label}筛选缺少 ${name}`);
    // 类型: string；作用: 页面缺失或空字符串时采用当前平台默认值。
    const requestedValue = typeof sourceParams[name] === 'string' && sourceParams[name].trim()
      ? sourceParams[name].trim()
      : defaultValue;
    // 类型: Set<string>；作用: 只允许当前源站页面真实声明的选项值。
    const allowedValues = new Set(group.options.map(option => option.value));
    // 条件分支: 页面请求值不属于源站当前选项时进入；执行内容: 拒绝构造任意源站路径。
    if (!allowedValues.has(requestedValue)) throw new Error(`MJWO ${definition.label}筛选 ${name} 不受支持`);
    selection[name] = requestedValue;
  }
  return selection;
}

/**
 * 构造 MJWO 电影或美剧目录地址。
 * 纯函数: 只消费 normalizeCatalogFilterSelection 返回的已验证字段、目录配置和正整数源站页码。
 * 成功路径: 默认第一页使用配置入口保留顶部推荐；其他请求按当前目录 canonical 片段顺序生成 /show/.../。
 * 失败路径: 非法页码收敛为 1；筛选值安全由上游允许集合门禁保证。
 *
 * @param {object} definition 当前电影或美剧目录配置。
 * @param {object} selection 已验证目录筛选选择。
 * @param {number} upstreamPage 目标源站批次页码。
 * @returns {string} MJWO 电影目录绝对地址。
 */
function buildCatalogUrl(definition, selection, upstreamPage) {
  // 类型: number；作用: 源站页码只接受正整数，非法值回到第一批。
  const page = Number.isSafeInteger(upstreamPage) && upstreamPage > 0 ? upstreamPage : 1;
  // 类型: boolean；作用: true 使用带顶部推荐的默认频道入口，false 使用不含推荐的组合筛选入口。
  const isDefaultSelection = Object.entries(definition.defaults)
    .every(([name, value]) => selection[name] === value);
  // 条件分支: 默认第一批时进入；执行内容: 使用同时含推荐、筛选和主体列表的频道入口。
  if (isDefaultSelection && page === 1) return `${PAGE_BASE_URL}${definition.entryPath}`;
  // 类型: string；作用: 电影根类型可被 category 筛选替换，美剧根类型始终保持 meiju。
  const rootToken = Object.prototype.hasOwnProperty.call(selection, 'category') && selection.category !== 'all'
    ? selection.category
    : definition.rootToken;
  // 类型: Array<string>；作用: 按当前目录配置冻结的 canonical 顺序组合路径，值逐项 URL 编码。
  const segments = ['show', rootToken];
  // 循环顺序: 逐项执行当前目录的源站路由顺序，电影和美剧只通过配置表达差异。
  for (const fieldName of definition.routeOrder) {
    // 条件分支: page 占位且目标超过第一源站批次时进入；执行内容: 追加可直接跳转的 page/{number}。
    if (fieldName === 'page') {
      // 条件分支: 当前目标位于第二源站批次或之后时进入；执行内容: 写入明确 page 路由，第一页保持源站默认表达。
      if (page > 1) segments.push('page', String(page));
      continue;
    }
    // 条件分支: 当前筛选保持默认值时进入；执行内容: 省略源站默认路由片段。
    if (selection[fieldName] === definition.defaults[fieldName]) continue;
    // 类型: object|undefined；作用: 从筛选配置定位当前标准字段对应的源站路由片段。
    const routeDefinition = Object.values(definition.filterGroupsByLabel)
      .find(candidate => candidate.name === fieldName);
    // 条件分支: 配置缺少当前路由字段时进入；执行内容: 失败关闭，阻止生成不完整地址。
    if (!routeDefinition || !routeDefinition.routeSegment) throw new Error(`MJWO ${definition.label}路由配置缺少 ${fieldName}`);
    // 类型: string；作用: sort 使用平台到源站映射，其他字段保持已验证的源站值。
    const routeValue = fieldName === 'sort'
      ? CATALOG_SORT_ROUTE_BY_VALUE[selection[fieldName]]
      : selection[fieldName];
    // 条件分支: 映射值缺失时进入；执行内容: 失败关闭，不把 undefined 编码进路径。
    if (!routeValue) throw new Error(`MJWO ${definition.label}路由值无效 ${fieldName}`);
    segments.push(routeDefinition.routeSegment, encodeURIComponent(routeValue));
  }
  return `${PAGE_BASE_URL}/${segments.join('/')}/`;
}

/**
 * 解析 MJWO 目录或搜索结果底部分页。
 * 纯函数: 只读取 class=myui-page 的分页 ul；采用移动端 `当前页/总页数` 权威文本，不解释页面业务。
 * 成功路径: 返回正整数 page、totalPages 和 hasMore。
 * 失败路径: 分页容器或页数文本缺失时返回 null，由目录或搜索批次解析器结合内容判断空页、单页或结构错误。
 *
 * @param {*} html 完整目录或搜索 HTML。
 * @returns {object|null} 源站分页或 null。
 */
function parseSourcePagination(html) {
  // 类型: string；作用: 提取首个分页 ul，顶部和底部移动端分页表达相同事实。
  const paginationHtml = extractElementByClass(html, 'ul', 'myui-page');
  // 条件分支: 页面没有分页容器时进入；执行内容: 返回 null 交给目录解析器判断单页或空页。
  if (!paginationHtml) return null;
  // 类型: RegExpMatchArray|null；作用: 读取源站移动端明确输出的 当前页/总页数。
  const pageState = cleanText(paginationHtml).match(/(?:^|\s)(\d+)\s*\/\s*(\d+)(?:\s|$)/);
  // 条件分支: 分页容器没有 当前页/总页数 权威文本时进入；执行内容: 返回 null，不根据按钮数量猜测。
  if (!pageState) return null;
  // 类型: number；作用: 源站当前批次页码。
  const page = Number(pageState[1]);
  // 类型: number；作用: 源站当前筛选结果总批次数。
  const totalPages = Number(pageState[2]);
  // 条件分支: 页码不是有效正整数或当前页超出总页数时进入；执行内容: 拒绝错误分页事实。
  if (!Number.isSafeInteger(page) || page <= 0 || !Number.isSafeInteger(totalPages) || totalPages <= 0 || page > totalPages) {
    return null;
  }
  return { page, totalPages, hasMore: page < totalPages };
}

/**
 * 解析一个 MJWO 电影或美剧目录源站批次。
 * 纯函数: 分别隔离顶部 flickity 推荐、主体 myui-vodlist 和底部分页，不扫描整页固定卡片下标。
 * 成功路径: 默认入口可返回 featuredItems，所有正常目录返回 catalogItems 和源站分页。
 * 失败路径: 有主体内容但分页结构非法时按单页收敛；完全空页面返回 0 页空批次。
 *
 * @param {*} html 目录 HTML。
 * @param {string} sourceId 当前 Provider 身份。
 * @param {object} definition 当前目录配置，决定内容类型。
 * @param {boolean} includeFeatured true 解析顶部推荐，false 固定返回空数组。
 * @returns {object} 当前源站批次解析结果。
 */
function parseCatalogSourcePage(html, sourceId, definition, includeFeatured) {
  // 类型: string；作用: 只有默认频道第一页需要隔离顶部滚动容器。
  const featuredHtml = includeFeatured
    ? extractElementByClass(html, 'div', CATALOG_FEATURED_CONTAINER_CLASS)
    : '';
  // 类型: Array<object>；作用: 顶部推荐只解析正式缩略图，保持源站滚动顺序。
  const featuredItems = featuredHtml ? parseCards(featuredHtml, sourceId, definition.contentType) : [];
  // 类型: Array<object>；作用: 主体目录解析 li 同级元信息并保持源站顺序。
  const catalogItems = parseCatalogCards(html, sourceId, definition.contentType);
  // 类型: object|null；作用: 尝试读取源站明确分页。
  const parsedPagination = parseSourcePagination(html);
  // 类型: object；作用: 无分页但有主体内容时表示单页，无主体时表示 0 页空结果。
  const pagination = parsedPagination || {
    page: catalogItems.length ? 1 : 0,
    totalPages: catalogItems.length ? 1 : 0,
    hasMore: false
  };
  return { featuredItems, catalogItems, pagination };
}

/**
 * 识别一个 MJWO 搜索条目的标准内容类型。
 * 纯函数: 先匹配详情区显式分类，只有分类无法映射时才读取缩略图右下角状态；不访问页面、网络或公共状态。
 * 成功路径: 返回 movie 或 tv，且显式分类与状态冲突时始终采用显式分类。
 * 失败路径: 两组源站事实都无法映射时返回空字符串，由完整搜索行解析器失败关闭。
 *
 * @param {*} classification `detail > p:nth-child(4)` 分类字段文本。
 * @param {*} status `thumb > a > span.pic-text.text-right` 质量或剧集状态文本。
 * @returns {string} movie、tv 或空字符串。
 */
function parseSearchContentType(classification, status) {
  // 类型: string；作用: 清理显式分类字段，保留“分类/类型”标签不影响关键词映射。
  const classificationText = cleanText(classification);
  for (const rule of SEARCH_CLASSIFICATION_TYPE_RULES) {
    // 条件分支: 当前显式分类规则命中时进入；执行内容: 立即返回，阻止辅助状态覆盖源站分类事实。
    if (rule.pattern.test(classificationText)) return rule.type;
  }
  // 类型: string；作用: 只有显式分类没有已知映射时才清理并检查辅助状态。
  const statusText = cleanText(status);
  for (const rule of SEARCH_STATUS_TYPE_RULES) {
    // 条件分支: 当前质量或剧集规则命中时进入；执行内容: 返回对应标准类型。
    if (rule.pattern.test(statusText)) return rule.type;
  }
  return '';
}

/**
 * 按搜索结果行自己的标签语义解析轻量元信息。
 * 纯函数: 只读取当前 `div.detail` 的 p 文本和分类、地区、年份、类型四个标签；不调用详情页解析器，也不解释演员、主创、播放或详情状态。
 * 成功路径: 字段顺序变化时仍按标签边界归位，类型集合保持源站顺序并去除空值。
 * 失败路径: detail 缺失或可选标签为空时返回契约空值，内容类型仍由调用方结合缩略图状态独立判断。
 *
 * @param {*} detailHtml 当前搜索结果行的 `div.detail` 内部 HTML。
 * @returns {object} 搜索行可确定的轻量元信息。
 * @returns {string} return.classification 源站显式内容分类或空字符串。
 * @returns {string} return.year 源站年份或空字符串。
 * @returns {string} return.area 源站地区或空字符串。
 * @returns {Array<string>} return.genres 源站类型集合或空数组。
 */
function parseSearchMetadata(detailHtml) {
  // 类型: string；作用: 只接受当前搜索行已经隔离的详情 HTML，拒绝对象隐式字符串进入字段解析。
  const source = typeof detailHtml === 'string' ? detailHtml : '';
  // 类型: Map<string, string>；作用: 每个允许标签只采用源站顺序中的首次非空值，重复布局不覆盖权威事实。
  const fieldValues = new Map();
  // 类型: string；作用: 组合受审搜索标签边界，当前四个标签互不包含且没有动态页面输入。
  const labelPatternSource = SEARCH_METADATA_LABELS.join('|');
  // 类型: RegExp；作用: 以搜索详情区真实 p 行为边界，不依赖分类固定处于第几个子元素。
  const paragraphPattern = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前搜索详情段落。
  let paragraphMatch;
  while ((paragraphMatch = paragraphPattern.exec(source)) !== null) {
    // 类型: string；作用: 当前段落的可见单行文本，标签和值之间保留稳定空白。
    const paragraphText = cleanText(paragraphMatch[1]);
    // 条件分支: 当前段落没有可见文本时进入；执行内容: 跳过布局空节点，不制造空字段覆盖。
    if (!paragraphText) continue;
    // 类型: RegExp；作用: 每个段落使用独立扫描器，值读取到下一个受审搜索标签或当前段落末尾。
    const labelPattern = new RegExp(`(${labelPatternSource})\\s*[：:]`, 'g');
    // 类型: Array<RegExpMatchArray>；作用: 支持分类、地区和年份同处一行，也支持类型独占一行或调整顺序。
    const labels = Array.from(paragraphText.matchAll(labelPattern));
    for (let index = 0; index < labels.length; index += 1) {
      // 类型: RegExpMatchArray；作用: 当前标签决定字段名和值起点。
      const labelMatch = labels[index];
      // 类型: number；作用: 当前字段值从标签结束位置开始。
      const valueStart = labelMatch.index + labelMatch[0].length;
      // 类型: number；作用: 下一个标签或段落末尾关闭当前字段，防止相邻元信息串位。
      const valueEnd = labels[index + 1]?.index ?? paragraphText.length;
      // 类型: string；作用: 保存去除标签和多余空白后的当前源站字段事实。
      const fieldValue = cleanText(paragraphText.slice(valueStart, valueEnd));
      // 条件分支: 当前允许标签首次取得非空值时进入；执行内容: 保存并保持源站首个权威顺序。
      if (fieldValue && !fieldValues.has(labelMatch[1])) fieldValues.set(labelMatch[1], fieldValue);
    }
  }
  // 类型: string；作用: 搜索行的类型文本可以用逗号、顿号、斜杠、竖线或空白分隔。
  const genreText = fieldValues.get('类型') || '';
  // 类型: Array<string>；作用: 保留全部可确定类型，空文本明确形成契约空数组。
  const genres = genreText
    ? genreText.split(/[，,、/|\s]+/).map(cleanText).filter(Boolean)
    : [];
  return {
    classification: fieldValues.get('分类') || '',
    year: fieldValues.get('年份') || '',
    area: fieldValues.get('地区') || '',
    genres
  };
}

/**
 * 解析 MJWO 搜索结果列表的完整条目。
 * 纯函数: 只扫描 `#searchList` 的直接 li 片段，读取搜索详情标签和缩略图状态后复用标准卡片构造器。
 * 成功路径: 按源站顺序返回类型准确且身份去重的 ContentItem。
 * 失败路径: 有效搜索行无法确定 movie/tv 时抛 Error，避免跳项、伪造类型或破坏分页总量。
 *
 * @param {*} html 当前源站搜索 HTML。
 * @param {string} sourceId 当前 Provider 身份。
 * @returns {Array<object>} 当前源站批次的标准搜索条目。
 * @throws {Error} 搜索条目类型无法从显式分类和辅助状态确定时抛出。
 */
function parseSearchItems(html, sourceId) {
  // 类型: string；作用: 隔离唯一搜索结果列表，页面其他 myui-vodlist 不参与搜索总量。
  const listHtml = extractListById(html, SEARCH_RESULT_LIST_ID);
  // 条件分支: 源站没有搜索列表时进入；执行内容: 返回空集合，让上层结合分页判断真实空结果。
  if (!listHtml) return [];
  // 类型: Array<object>；作用: 按源站 li 顺序保存标准搜索条目。
  const items = [];
  // 类型: Set<string>；作用: 同一源站批次只采用首次内容身份，保持分页序列稳定。
  const seen = new Set();
  // 类型: RegExp；作用: 搜索结果列表不嵌套 li，逐项保留 thumb 和 detail 两个同级区域。
  const rowPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前完整搜索行。
  let rowMatch;
  while ((rowMatch = rowPattern.exec(listHtml)) !== null) {
    // 类型: string；作用: 当前搜索行完整 HTML，卡片、分类和状态必须从同一行读取。
    const rowHtml = rowMatch[0];
    // 类型: string；作用: 隔离缩略图区，身份、标题、海报和右下角状态不读取别名、主演或分类详情文本。
    const thumbHtml = extractElementByClass(rowHtml, 'div', SEARCH_THUMB_CLASS);
    // 类型: string；作用: 隔离搜索详情区，供搜索专用轻量元信息解析器使用。
    const detailHtml = extractElementByClass(rowHtml, 'div', SEARCH_DETAIL_CLASS);
    // 类型: object；作用: 只采用当前搜索行明确提供的分类、地区、年份和类型，不复用详情字段模型。
    const searchMetadata = parseSearchMetadata(detailHtml);
    // 类型: string；作用: 缩略图右下角文本只作为分类无法映射时的辅助事实，并继续交给卡片构造器生成质量或剧集状态。
    const status = readElementTextByClasses(thumbHtml, 'span', ['pic-text', 'text-right']);
    // 类型: string；作用: 按显式分类优先级形成唯一标准类型。
    const contentType = parseSearchContentType(searchMetadata.classification, status);
    // 条件分支: 当前完整行无法判断类型时进入；执行内容: 失败关闭，不以固定 movie 默认值污染搜索结果。
    if (!contentType) throw new Error('MJWO 搜索结果类型无法识别');
    // 类型: object|null；作用: 使用已确定类型统一解析身份、标题、海报、标签、评分、质量/剧集状态，并采用搜索详情区元信息。
    const item = parseCardFragment(thumbHtml, sourceId, contentType, {
      year: searchMetadata.year,
      area: searchMetadata.area,
      genres: searchMetadata.genres
    });
    // 条件分支: 行没有正式卡片或身份已采用时进入；执行内容: 跳过并保持首次源站位置。
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

/**
 * 解析一个 MJWO 搜索结果源站批次。
 * 纯函数: 复用搜索完整行和分页解析器，只读取当前搜索 HTML，不访问网络、Cookie、页面或公共状态。
 * 成功路径: 返回当前源站批次的标准内容、当前页和总页数；无结果页面收敛为 0 页空批次。
 * 失败路径: 页面声明分页容器但没有合法 `当前页/总页数` 时抛 Error，防止把损坏多页结果误报成单页。
 *
 * @param {*} html 当前关键词和源站页码对应的搜索 HTML。
 * @param {string} sourceId 当前 Provider 身份。
 * @returns {object} 当前搜索源站批次。
 * @returns {Array<object>} return.items 当前批次按源站顺序清洗的 ContentItem。
 * @returns {object} return.pagination 当前源站页码、总页数和后续页状态。
 * @throws {Error} 分页容器存在但分页状态无效时抛出。
 */
function parseSearchSourcePage(html, sourceId) {
  // 类型: Array<object>；作用: 搜索专用解析器从同一条 li 读取分类和状态，不再为混排结果设置固定电影默认值。
  const items = parseSearchItems(html, sourceId);
  // 类型: string；作用: 区分“没有分页的单页/空结果”和“存在但无法解析的分页结构”。
  const paginationHtml = extractElementByClass(html, 'ul', 'myui-page');
  // 类型: object|null；作用: 读取源站明确输出的当前批次与总批次数。
  const parsedPagination = parseSourcePagination(html);
  // 条件分支: 页面声明分页但没有合法页数事实时进入；执行内容: 失败关闭，不把多页结果降级成单页。
  if (paginationHtml && !parsedPagination) throw new Error('MJWO 搜索分页结构无效');
  // 类型: object；作用: 无分页且有内容表示单页，无内容表示真实 0 页结果。
  const pagination = parsedPagination || {
    page: items.length ? 1 : 0,
    totalPages: items.length ? 1 : 0,
    hasMore: false
  };
  return { items, pagination };
}

/**
 * 按 id 提取首个平衡 HTML 元素正文。
 * 纯函数: 先定位拥有精确 id 的开始标签，再按该标签名计算嵌套深度；不创建 DOM 或执行页面脚本。
 * 成功路径: div、ul 等容器均返回自身开始和结束标签之间的完整 HTML。
 * 失败路径: id、HTML 或闭合结构无效时返回空字符串。
 *
 * @param {*} html 源站页面或局部 HTML。
 * @param {string} elementId 受审内部配置提供的目标 id。
 * @returns {string} 目标元素内部 HTML 或空字符串。
 */
function extractElementById(html, elementId) {
  // 类型: string；作用: 只接受显式 HTML 文本。
  const source = typeof html === 'string' ? html : '';
  // 条件分支: id 不是非空受审文本时进入；执行内容: 返回空结果，不构造动态解析规则。
  if (typeof elementId !== 'string' || !elementId) return '';
  // 类型: RegExp；作用: 扫描普通开始标签，结束标签不会命中当前表达式。
  const openingPattern = /<([a-z][a-z0-9-]*)\b[^>]*>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前开始标签候选。
  let openingMatch;
  while ((openingMatch = openingPattern.exec(source)) !== null) {
    // 条件分支: 当前开始标签 id 不等于目标时进入；执行内容: 继续扫描后续元素。
    if (readAttribute(openingMatch[0], 'id') !== elementId) continue;
    // 类型: string；作用: 目标元素标签名，后续只平衡同名嵌套元素。
    const tagName = openingMatch[1];
    // 类型: RegExp；作用: 从目标正文起点扫描同名开始和结束标签。
    const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
    tagPattern.lastIndex = openingPattern.lastIndex;
    // 类型: number；作用: 目标开始标签已经建立第一层，嵌套同名开始标签增加，结束标签减少。
    let depth = 1;
    // 类型: RegExpMatchArray|null；作用: 保存目标内部当前同名标签。
    let tagMatch;
    while ((tagMatch = tagPattern.exec(source)) !== null) {
      // 类型: boolean；作用: true 表示结束标签并减少深度，false 表示内部同名开始标签并增加深度。
      const isClosingTag = /^<\//.test(tagMatch[0]);
      depth += isClosingTag ? -1 : 1;
      // 条件分支: 深度归零时进入；执行内容: 返回精确目标正文，不包含目标外部同级区域。
      if (depth === 0) return source.slice(openingPattern.lastIndex, tagMatch.index);
    }
    return '';
  }
  return '';
}

/**
 * 按 MJWO 首页稳定列表 id 提取 ul 正文。
 * 纯函数: 复用通用 id 平衡解析器返回目标 ul 的内部 HTML，不解析卡片或依赖列表固定位置。
 * 成功路径: weeks_new、weeks_hot、weeks_old 或 weeks_dy 返回各自独立板块。
 * 失败路径: id 不存在或 HTML 非字符串时返回空字符串。
 *
 * @param {*} html MJWO 首页 HTML。
 * @param {string} elementId 目标 ul id。
 * @returns {string} 目标列表内部 HTML。
 */
function extractListById(html, elementId) {
  return extractElementById(html, elementId);
}

/**
 * 按板块标题和列表 class 提取 MJWO 首页列表正文。
 * 纯函数: 先精确比较 h3 可见标题，再采用标题后的首个目标 class 列表，不依赖列宽或 sibling 下标。
 * 成功路径: 返回“最新电影”“最新美剧”或两类排行榜所属列表正文。
 * 失败路径: 标题或目标列表不存在时返回空字符串。
 *
 * @param {*} html MJWO 首页 HTML。
 * @param {string} headingText 板块可见标题。
 * @param {string} classToken 目标 ul 必须完整包含的 class token。
 * @returns {string} 目标列表内部 HTML。
 */
function extractListAfterHeading(html, headingText, classToken) {
  // 类型: string；作用: 保存首页 HTML，非字符串输入不进入扫描。
  const source = typeof html === 'string' ? html : '';
  // 类型: RegExp；作用: 按源站标题节点顺序扫描，不把“更多”链接或卡片标题视为板块标题。
  const headingPattern = /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前标题节点及其结束位置。
  let headingMatch;
  while ((headingMatch = headingPattern.exec(source)) !== null) {
    // 条件分支: 当前 h3 可见文本不是目标板块时进入。
    // 执行内容: 继续扫描后续标题，不做模糊包含匹配。
    if (cleanText(headingMatch[1]) !== headingText) continue;
    // 类型: string；作用: 只在目标标题之后查找列表，避免误采用页面前部同 class 容器。
    const tail = source.slice(headingPattern.lastIndex);
    // 类型: RegExp；作用: 按出现顺序扫描后续 ul，class token 决定卡片列表或排行榜列表。
    const listPattern = /<ul\b[^>]*>([\s\S]*?)<\/ul>/gi;
    // 类型: RegExpMatchArray|null；作用: 保存当前候选列表。
    let listMatch;
    while ((listMatch = listPattern.exec(tail)) !== null) {
      // 类型: string；作用: 读取当前 ul 自身开始标签，不匹配内部子元素 class。
      const openingTag = listMatch[0].slice(0, listMatch[0].indexOf('>') + 1);
      // 类型: Array<string>；作用: 形成当前 ul 精确 class token 集合。
      const classNames = readAttribute(openingTag, 'class').split(/\s+/).filter(Boolean);
      // 条件分支: 当前 ul 是目标板块声明的列表类型时进入。
      // 执行内容: 返回内部 HTML，后续解析器不再扫描整页。
      if (classNames.includes(classToken)) return listMatch[1];
    }
    return '';
  }
  return '';
}

/**
 * 解析 MJWO 首页指定卡片板块。
 * 纯函数: 读取冻结板块描述，选择 id 或标题定位器，再复用统一卡片解析器。
 * 成功路径: 返回保留源站顺序、类型固定为板块声明的 ContentItem 列表。
 * 失败路径: 未知 sectionKey 或源站板块缺失时返回空数组。
 *
 * @param {*} html MJWO 首页 HTML。
 * @param {string} sourceId 当前 Provider 身份。
 * @param {string} sectionKey HOME_CARD_SECTION 键。
 * @returns {Array<object>} 当前板块标准内容。
 */
function parseHomeCardSection(html, sourceId, sectionKey) {
  // 类型: object|undefined；作用: 定位当前首页卡片板块的冻结描述。
  const section = HOME_CARD_SECTION[sectionKey];
  // 条件分支: 调用方传入未登记板块时进入。
  // 执行内容: 返回空集合，不回退整页解析。
  if (!section) return [];
  // 类型: string；作用: 按源站稳定 id 或标题提取当前板块独立正文。
  const sectionHtml = section.locator === 'id'
    ? extractListById(html, section.value)
    : extractListAfterHeading(html, section.value, HOME_CARD_LIST_CLASS);
  return parseCards(sectionHtml, sourceId, section.type);
}

/**
 * 解析 MJWO 首页排行榜列表。
 * 纯函数: 只读取目标排行榜 ul 内的 li、详情身份、标题、名次和右侧状态。
 * 成功路径: 按源站行顺序返回带 rank 的标准 ContentItem。
 * 失败路径: 身份或标题缺失的行跳过，非法名次保留为 null 交给组件下标兜底。
 *
 * @param {*} listHtml 排行榜 ul 内部 HTML。
 * @param {string} sourceId 当前 Provider 身份。
 * @param {string} type movie 或 tv。
 * @returns {Array<object>} 排行榜标准内容。
 */
function parseRanking(listHtml, sourceId, type) {
  // 类型: string；作用: 保存排行榜内部 HTML，非字符串输入按空榜单处理。
  const source = typeof listHtml === 'string' ? listHtml : '';
  // 类型: Array<object>；作用: 按源站名次顺序收集排行榜内容。
  const items = [];
  // 类型: Set<string>；作用: 防止同一详情身份在一个榜单中重复出现。
  const seen = new Set();
  // 类型: RegExp；作用: 逐行扫描排行榜，不把其他板块普通链接纳入。
  const rowPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前排行榜行。
  let rowMatch;
  while ((rowMatch = rowPattern.exec(source)) !== null) {
    // 类型: string；作用: 保存当前行内部 HTML，供链接、状态和名次分别解析。
    const row = rowMatch[1] || '';
    // 类型: RegExpMatchArray|null；作用: 定位当前行唯一详情链接和内部展示内容。
    const anchorMatch = row.match(/<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/i);
    // 条件分支: 当前行没有可继续定位的详情链接时进入。
    // 执行内容: 跳过该行，不生成伪内容身份。
    if (!anchorMatch) continue;
    // 类型: string；作用: 保存详情链接开始标签，title 只从当前 anchor 自身读取。
    const openingTag = anchorMatch[0].slice(0, anchorMatch[0].indexOf('>') + 1);
    // 类型: string；作用: 将源站详情链接转换为标准内容身份。
    const id = parseContentId(anchorMatch[1] || anchorMatch[2] || '');
    // 类型: string；作用: title 属性是榜单标题权威，缺失时才清理 anchor 全文。
    const title = readAttribute(openingTag, 'title') || cleanText(anchorMatch[3]);
    // 条件分支: 身份、标题无效或已经出现时进入。
    // 执行内容: 跳过当前行并保持首次排名。
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    // 类型: string；作用: 读取榜单右侧电影质量或电视剧更新状态。
    const status = readElementTextByClass(anchorMatch[3], 'span', 'pull-right');
    // 类型: string；作用: 读取源站 badge 中的原始名次文本。
    const rankText = readElementTextByClass(anchorMatch[3], 'span', 'badge');
    // 类型: number；作用: 把源站 badge 文本转换为待校验数值。
    const rankValue = Number(rankText);
    // 类型: number|null；作用: 只采用正整数源站名次，非法值留给公共组件按位置展示。
    const rank = Number.isSafeInteger(rankValue) && rankValue > 0 ? rankValue : null;
    items.push(createContentItem({ id, sourceId, type, title, rank, status }));
  }
  return items;
}

/**
 * 按板块声明顺序合并并去重标准内容。
 * 纯函数: 不修改输入数组或 ContentItem，只保留同一 id 第一次出现的位置。
 * 成功路径: 返回可直接分页的稳定全局序列。
 * 失败路径: 非数组分组和非法条目跳过，不生成兼容占位。
 *
 * @param {*} groups 按业务顺序排列的 ContentItem 数组集合。
 * @returns {Array<object>} 顺序去重后的新数组。
 */
function mergeUniqueItems(groups) {
  // 类型: Array<object>；作用: 保存新的合并结果，不泄漏或修改板块原数组。
  const merged = [];
  // 类型: Set<string>；作用: 记录已经采用的标准内容身份。
  const seen = new Set();
  // 循环意义: 外层数组顺序就是用户冻结的板块优先级，不能排序或并行重排。
  (Array.isArray(groups) ? groups : []).forEach((group) => {
    // 循环意义: 保留每个源站板块内部的原始卡片顺序。
    (Array.isArray(group) ? group : []).forEach((item) => {
      // 条件分支: 条目身份无效或前序板块已经采用时进入。
      // 执行内容: 跳过重复项，第一次出现位置保持权威。
      if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id)) return;
      seen.add(item.id);
      merged.push(item);
    });
  });
  return merged;
}

/**
 * 把 MJWO 首页映射为平台指定 moduleKey 的独立内容集合。
 * 纯函数: 所有源站标题、容器 id、合并顺序和排行榜解析都封装在当前 Provider。
 * 成功路径: 五个标准首页区域分别返回用户冻结的源站板块内容。
 * 失败路径: 未知 moduleKey 抛 Error，禁止回退整页卡片或复用其他区域数据。
 *
 * @param {*} html MJWO 首页 HTML。
 * @param {string} sourceId 当前 Provider 身份。
 * @param {string} moduleKey 平台首页区域键。
 * @returns {Array<object>} 当前首页区域完整有序集合。
 * @throws {Error} moduleKey 未登记时抛出。
 */
function parseHomeModule(html, sourceId, moduleKey) {
  // 条件分支: 当前请求首页轮播时进入。
  // 执行内容: 新剧推荐优先于热门电影，合并去重后执行 24 条契约上限。
  if (moduleKey === HOME_MODULE_KEY.banners) {
    return mergeUniqueItems([
      parseHomeCardSection(html, sourceId, 'recommendedShows'),
      parseHomeCardSection(html, sourceId, 'popularMovies')
    ]).slice(0, HOME_BANNER_LIMIT);
  }
  // 条件分支: 当前请求热门电影时进入。
  // 执行内容: 只返回最新电影，不采用首页热门电影 tab 或其他电影卡片。
  if (moduleKey === HOME_MODULE_KEY.hotMovies) {
    return parseHomeCardSection(html, sourceId, 'latestMovies');
  }
  // 条件分支: 当前请求热门电视剧时进入。
  // 执行内容: 按最新连载、经典老剧、最新美剧顺序合并并保留首次身份。
  if (moduleKey === HOME_MODULE_KEY.hotTv) {
    return mergeUniqueItems([
      parseHomeCardSection(html, sourceId, 'latestSerial'),
      parseHomeCardSection(html, sourceId, 'classicShows'),
      parseHomeCardSection(html, sourceId, 'latestShows')
    ]);
  }
  // 条件分支: 当前请求电影排行榜时进入。
  // 执行内容: 只解析“电影排行榜”文本列表，保持源站名次。
  if (moduleKey === HOME_MODULE_KEY.movieRanking) {
    // 类型: object；作用: 保存电影排行榜的冻结标题和标准内容类型。
    const section = HOME_RANKING_SECTION.movieRanking;
    return parseRanking(
      extractListAfterHeading(html, section.heading, HOME_RANKING_LIST_CLASS),
      sourceId,
      section.type
    );
  }
  // 条件分支: 当前请求电视剧排行榜时进入。
  // 执行内容: 只解析“美剧排行榜”文本列表，保持源站名次和更新状态。
  if (moduleKey === HOME_MODULE_KEY.tvRanking) {
    // 类型: object；作用: 保存电视剧排行榜的冻结标题和标准内容类型。
    const section = HOME_RANKING_SECTION.tvRanking;
    return parseRanking(
      extractListAfterHeading(html, section.heading, HOME_RANKING_LIST_CLASS),
      sourceId,
      section.type
    );
  }
  throw new Error('MJWO 首页 moduleKey 不受支持');
}

/**
 * 拆分 MJWO 详情多值字段。
 * 纯函数: 默认只按逗号、顿号、斜杠和竖线拆分姓名或别名；genres 可以额外按空白拆分。
 * 成功路径: 返回清理、去空并保持源站顺序的文本数组。
 * 失败路径: 非字符串或空文本返回空数组。
 *
 * @param {*} value 主演、导演、编剧、别名或类型文本。
 * @param {boolean} splitWhitespace true 允许空白作为分隔符，false 保留英文姓名内部空格。
 * @returns {Array<string>} 清理后的多值字段。
 */
function splitDetailValues(value, splitWhitespace) {
  // 类型: string；作用: 只接受显式文本，避免对象隐式字符串进入详情字段。
  const text = cleanText(typeof value === 'string' ? value : '');
  // 条件分支: 当前字段为空时进入；执行内容: 返回契约空数组。
  if (!text) return [];
  // 类型: RegExp；作用: genres 允许源站用空格分隔，姓名和别名保留英文全名内部空格。
  const separator = splitWhitespace ? /[，,、/|\s]+/ : /[，,、/|]+/;
  return text.split(separator).map(cleanText).filter(Boolean);
}

/**
 * 按可见标签解析 MJWO 详情信息容器。
 * 纯函数: 状态只读取精确 `p.otherbox`，其他字段按可见标签边界归位；不扫描推荐、二维码提示、播放列表或整页文案。
 * 成功路径: 返回标准详情字段候选，otherbox 首个逗号前文本成为质量或集数状态，显式标签可以同处一行且不会相互吞并。
 * 失败路径: 字段缺失时返回契约空值；分类与状态均无法识别类型时 contentType 为空，由详情解析器失败关闭。
 *
 * @param {*} detailHtml `myui-content__detail` 内部 HTML。
 * @returns {object} 清理后的详情字段候选。
 */
function parseDetailMetadata(detailHtml) {
  // 类型: string；作用: 保存隔离后的详情信息正文。
  const source = typeof detailHtml === 'string' ? detailHtml : '';
  // 类型: Map<string, string>；作用: 每个可见标签只采用首次非空值，保持源站权威顺序。
  const fieldValues = new Map();
  // 类型: string；作用: 精确读取详情 p.otherbox 整行，二维码说明和其他无标签段落不会成为状态候选。
  const statusLine = readElementTextByClass(source, 'p', DETAIL_STATUS_CLASS);
  // 类型: string；作用: 转义并组合最长标签优先的字段边界，值只读取到下一个已知标签。
  const labelPatternSource = DETAIL_FIELD_LABELS
    .map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  // 类型: RegExp；作用: 详情信息以 p 为稳定行边界，标签和值可以位于多个 span 中。
  const paragraphPattern = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前详情行。
  let paragraphMatch;
  while ((paragraphMatch = paragraphPattern.exec(source)) !== null) {
    // 类型: string；作用: 当前行清理文本，标签间由 cleanText 保留单空格边界。
    const paragraphText = cleanText(paragraphMatch[1]);
    // 条件分支: 当前行没有可见文本时进入；执行内容: 跳过空布局节点。
    if (!paragraphText) continue;
    // 类型: RegExp；作用: 每行创建独立全局扫描器，避免跨行 lastIndex 状态泄漏。
    const labelPattern = new RegExp(`(${labelPatternSource})\\s*[：:]`, 'g');
    // 类型: Array<RegExpMatchArray>；作用: 保存同一行全部标签及其开始位置，支持“分类/地区”同处一行。
    const labels = Array.from(paragraphText.matchAll(labelPattern));
    // 条件分支: 当前行没有正式字段标签时进入；执行内容: 忽略二维码提示、扫码说明和布局文案，状态已由 p.otherbox 独立读取。
    if (!labels.length) continue;
    for (let index = 0; index < labels.length; index += 1) {
      // 类型: RegExpMatchArray；作用: 当前标签决定字段名和值起点。
      const labelMatch = labels[index];
      // 类型: number；作用: 当前值在清理文本中的起始位置。
      const valueStart = labelMatch.index + labelMatch[0].length;
      // 类型: number；作用: 下一个标签起点或当前行末尾，阻止字段值吞并后续标签。
      const valueEnd = labels[index + 1]?.index ?? paragraphText.length;
      // 类型: string；作用: 当前字段清理值。
      const fieldValue = cleanText(paragraphText.slice(valueStart, valueEnd));
      // 条件分支: 当前标签尚无权威值且本次值非空时进入；执行内容: 保存首次源站事实。
      if (fieldValue && !fieldValues.has(labelMatch[1])) fieldValues.set(labelMatch[1], fieldValue);
    }
  }
  // 类型: string；作用: 分类表示电影类别或美剧大类，用于标准类型判断和 tags。
  const classification = fieldValues.get('分类') || '';
  // 类型: string；作用: p.otherbox 首个中英文逗号前是电影清晰度或电视剧集数状态，尾部更新时间不进入角标。
  const status = cleanText(statusLine.split(/[，,]/)[0] || '');
  // 类型: RegExpMatchArray|null；作用: 从同一权威 p.otherbox 尾部提取源站最后更新时间。
  const statusUpdateMatch = statusLine.match(/最后更新于\s*([\s\S]+)$/);
  // 类型: string；作用: 显式更新时间优先，状态行尾部作为后备事实。
  const updateTime = fieldValues.get('更新时间') || fieldValues.get('最后更新于') || cleanText(statusUpdateMatch?.[1] || '');
  // 类型: string；作用: 上映日期和首播日期都进入统一 detail.releaseDate。
  const releaseDate = fieldValues.get('上映日期')
    || fieldValues.get('上映')
    || fieldValues.get('首播日期')
    || fieldValues.get('首播')
    || '';
  // 类型: string；作用: 详情内容类型采用与搜索相同的显式分类优先、状态兜底规则。
  const contentType = parseSearchContentType(classification, status);
  // 类型: string；作用: 只有电影质量状态进入 quality，电视剧更新文本由 tv.updateStatus 承载。
  const quality = contentType === 'movie' ? status : '';
  // 类型: RegExpMatchArray|null；作用: 豆瓣评分文本只提取首个有限数字，不保留“分”等单位。
  const scoreMatch = (fieldValues.get('豆瓣评分') || '').match(/\d+(?:\.\d+)?/);
  // 类型: number|null；作用: 无评分或非法评分保持 null，让页面隐藏而不是显示错误数字。
  const score = scoreMatch && Number.isFinite(Number(scoreMatch[0])) ? Number(scoreMatch[0]) : null;
  return {
    classification,
    contentType,
    status,
    quality,
    year: fieldValues.get('年份') || '',
    area: fieldValues.get('地区') || '',
    language: fieldValues.get('语言') || '',
    genres: splitDetailValues(fieldValues.get('类型') || '', true),
    actors: splitDetailValues(fieldValues.get('主演') || '', false),
    directors: splitDetailValues(fieldValues.get('导演') || '', false),
    writers: splitDetailValues(fieldValues.get('编剧') || '', false),
    aliases: splitDetailValues(fieldValues.get('又名') || '', false),
    score,
    releaseDate,
    updateTime,
    duration: fieldValues.get('片长') || ''
  };
}

/**
 * 把 MJWO 私有线路或完整特辑语义转换为稳定不透明身份。
 * 纯函数: 使用冻结 64 位 FNV-1a 参数逐 UTF-16 码元计算，不访问网络、存储或 Web Crypto。
 * 成功路径: 相同前缀和事实得到相同十六进制身份，公共层不能从结果恢复媒体或页面地址。
 * 失败路径: 前缀或事实为空时抛 Error，禁止生成共享空身份。
 *
 * @param {string} prefix 公共身份类型前缀。
 * @param {string} value Provider 内部稳定事实。
 * @returns {string} 稳定不透明身份。
 * @throws {Error} 输入不完整时抛出。
 */
function createStableOpaqueId(prefix, value) {
  // 条件分支: 身份前缀或内部事实为空时进入；执行内容: 失败关闭，不制造碰撞空值。
  if (typeof prefix !== 'string' || !prefix || typeof value !== 'string' || !value) {
    throw new Error('MJWO 稳定身份输入无效');
  }
  // 类型: bigint；作用: 保存当前 64 位 FNV-1a 状态，只承担确定性不透明身份，不作为安全摘要。
  let hash = STABLE_ID_HASH_POLICY.offsetBasis;
  // 循环类型: for；初始值: 内部事实首个 UTF-16 码元；终止条件: 全部码元已参与；作用: 形成跨刷新稳定结果。
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * STABLE_ID_HASH_POLICY.prime & STABLE_ID_HASH_POLICY.mask);
  }
  return `${prefix}-${hash.toString(16).padStart(STABLE_ID_HASH_POLICY.hexLength, '0')}`;
}

/**
 * 从明确季数文案读取季号。
 * 纯函数: 只接受“第 N 季”、Season N 或 SNN 形式，不从列表位置和年份推测。
 * 成功路径: 返回正整数季号。
 * 失败路径: 没有明确季号返回 null。
 *
 * @param {*} value 详情标题、季名或选集标签候选。
 * @returns {number|null} 明确季号或 null。
 */
function parseExplicitSeasonNumber(value) {
  // 类型: string；作用: 规范待识别文案，空文本保持未知季号。
  const text = cleanText(value);
  // 类型: RegExpMatchArray|null；作用: 按中文、英文全称和独立 S 前缀读取明确季号。
  const match = text.match(/第\s*0*(\d+)\s*季/iu)
    || text.match(/\bSeason\s*0*(\d+)\b/iu)
    || text.match(/\bS0*(\d+)(?:\b|E\d+)/iu);
  // 类型: number；作用: 把明确文本转换为待验证正整数。
  const seasonNumber = match ? Number.parseInt(match[1], 10) : Number.NaN;
  return Number.isSafeInteger(seasonNumber) && seasonNumber > 0 ? seasonNumber : null;
}

/**
 * 从明确分集文案读取集号。
 * 纯函数: 只接受“第 N 集”、Episode/EP N 或 SxxExx 形式，不接受数组位置。
 * 成功路径: 返回正整数集号。
 * 失败路径: 电影质量、正片、特辑或未知文本返回 null。
 *
 * @param {*} value 选集标签候选。
 * @returns {number|null} 明确集号或 null。
 */
function parseExplicitEpisodeNumber(value) {
  // 类型: string；作用: 规范待识别选集文案。
  const text = cleanText(value);
  // 类型: RegExpMatchArray|null；作用: 只采用具备明确剧集语义的三组格式。
  const match = text.match(/(?:第\s*)?0*(\d+)\s*集/iu)
    || text.match(/\b(?:Episode|EP)\s*0*(\d+)\b/iu)
    || text.match(/\bS\d+E0*(\d+)\b/iu)
    || text.match(/^0*(\d+)$/u);
  // 类型: number；作用: 把明确文本转换为待验证正整数。
  const episodeNumber = match ? Number.parseInt(match[1], 10) : Number.NaN;
  return Number.isSafeInteger(episodeNumber) && episodeNumber > 0 ? episodeNumber : null;
}

/**
 * 解析 MJWO 权威播放列表中的公共逻辑剧集和 Provider 私有入口。
 * 纯函数: 只扫描 `#playlist1` 内的 `/play/` 链接；URL 只写入 targets，不进入公共 episode。
 * 成功路径: 电影统一生成 feature；电视剧按明确季集号或完整特辑语义生成稳定身份。
 * 失败路径: 空标签电视剧入口被跳过；同一逻辑身份指向不同 URL 时抛 Error，不按列表位置裁决。
 *
 * @param {*} playlistHtml `#playlist1` 内部 HTML；电视剧可以包含直接子 ul。
 * @param {string} poster 当前详情海报地址，作为分集封面后备值。
 * @param {string} contentType 已确认的 movie 或 tv。
 * @param {number|null} contentSeasonNumber 详情标题明确季号或 null。
 * @returns {object} 公共 episodes 与 Provider 私有 targets。
 * @throws {Error} 逻辑剧集身份冲突时抛出。
 */
function parsePlaylistEpisodeTargets(playlistHtml, poster, contentType, contentSeasonNumber) {
  // 类型: string；作用: 只接受已经按 playlist1 隔离的 HTML。
  const source = typeof playlistHtml === 'string' ? playlistHtml : '';
  // 类型: Array<object>；作用: 保存不含播放 URL 的公共逻辑剧集。
  const episodes = [];
  // 类型: Array<object>；作用: 保存 episode.id 与源站 playUrl 的 Provider 内部映射。
  const targets = [];
  // 类型: Set<string>；作用: 相对和绝对同 URL 只保留首次标签。
  const seenPlayUrls = new Set();
  // 类型: Map<string,string>；作用: 检测同一逻辑剧集身份是否错误指向多个源站入口。
  const playUrlByEpisodeId = new Map();
  // 类型: RegExp；作用: 只扫描隔离容器内带 /play/ 的 anchor。
  const linkPattern = /<a\b[^>]*href\s*=\s*(?:"([^"]*\/play\/[^"]*)"|'([^']*\/play\/[^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前播放入口。
  let linkMatch;
  while ((linkMatch = linkPattern.exec(source)) !== null) {
    // 类型: string；作用: 规范源站相对或绝对播放地址，仅供 Provider 后续请求。
    const playUrl = absoluteUrl(linkMatch[1] || linkMatch[2]);
    // 条件分支: URL 无效或已经采用时进入；执行内容: 跳过并保持首个权威入口。
    if (!playUrl || seenPlayUrls.has(playUrl)) continue;
    // 类型: string；作用: 电影空标签可由明确内容类型形成正片；电视剧必须保留源站完整标签。
    const label = cleanText(linkMatch[3]) || (contentType === 'movie' ? '正片' : '');
    // 条件分支: 电视剧入口没有任何身份语义时进入；执行内容: 跳过，不按列表位置补集号。
    if (!label) continue;
    seenPlayUrls.add(playUrl);
    // 类型: number|null；作用: 当前标签季号优先，缺失时采用详情标题明确季号。
    const seasonNumber = parseExplicitSeasonNumber(label) ?? contentSeasonNumber;
    // 类型: number|null；作用: 只从当前标签明确语义读取集号。
    const episodeNumber = contentType === 'tv' ? parseExplicitEpisodeNumber(label) : null;
    // 类型: string；作用: 电影跨线路共享 feature；电视剧正集按季集号，特辑按完整标签哈希。
    const episodeId = contentType === 'movie'
      ? PLAY_CATALOG_POLICY.featureEpisodeId
      : episodeNumber !== null
        ? seasonNumber === null
          ? `${PLAY_CATALOG_POLICY.regularEpisodeIdPrefix}-${episodeNumber}`
          : `${PLAY_CATALOG_POLICY.seasonEpisodeIdPrefix}-${seasonNumber}:${PLAY_CATALOG_POLICY.regularEpisodeIdPrefix}-${episodeNumber}`
        : createStableOpaqueId(PLAY_CATALOG_POLICY.specialEpisodeIdPrefix, label);
    // 类型: string|undefined；作用: 读取同一逻辑身份已经登记的源站入口。
    const existingPlayUrl = playUrlByEpisodeId.get(episodeId);
    // 条件分支: 页面重复同一逻辑身份和同一 URL 时进入；执行内容: 忽略重复节点。
    if (existingPlayUrl === playUrl) continue;
    // 条件分支: 同一逻辑身份指向不同 URL 时进入；执行内容: 失败关闭，不让数组顺序决定入口。
    if (existingPlayUrl) throw new Error('MJWO 逻辑剧集身份冲突');
    playUrlByEpisodeId.set(episodeId, playUrl);
    // 类型: object；作用: 公共目录条目不含源站 URL，线路稍后复用同一逻辑身份集合。
    const episode = {
      id: episodeId,
      kind: contentType === 'movie' ? 'feature' : episodeNumber !== null ? 'episode' : 'special',
      seasonNumber,
      episodeNumber,
      title: contentType === 'tv' && episodeNumber === null ? label : '',
      label,
      duration: '',
      description: '',
      cover: poster,
      playable: true
    };
    episodes.push(episode);
    targets.push({ episode, playUrl });
  }
  return { episodes, targets };
}

/**
 * 解析 MJWO 详情 HTML。
 * 纯函数: 详情字段只来自 myui-content__detail，播放入口只来自 playlist1，简介只采用精确容器或 meta。
 * 成功路径: 返回详情 ContentItem 基础字段，以及只在 Provider 内使用的逻辑剧集播放目标。
 * 失败路径: 详情容器、标题或标准内容类型缺失时抛 Error，不回退整页猜测或伪造类型。
 *
 * @param {*} html 详情 HTML。
 * @param {string} contentId 当前内容身份。
 * @param {string} sourceId Provider 身份。
 * @returns {object} item 与 episodeTargets 组成的 Provider 内部详情结果。
 */
function parseDetail(html, contentId, sourceId) {
  // 类型: string；作用: 保存详情 HTML。
  const source = typeof html === 'string' ? html : '';
  // 类型: string；作用: 精确隔离用户指定的详情信息容器，整页其他文本不参与字段映射。
  const detailHtml = extractElementByClass(source, 'div', DETAIL_CONTAINER_CLASS);
  // 条件分支: 权威详情容器缺失时进入；执行内容: 失败关闭，不恢复旧整页扫描。
  if (!detailHtml) throw new Error('MJWO 详情信息容器无法解析');
  // 类型: string；作用: 标题只从详情容器 h1 读取，不采用导航或推荐标题。
  const rawTitle = cleanText(detailHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  // 条件分支: 详情标题缺失时进入；执行内容: 失败关闭，不生成半完整内容。
  if (!rawTitle) throw new Error('MJWO 详情标题无法解析');
  // 类型: RegExpMatchArray|null；作用: 源站把年份放在标题尾部括号中，拆出后分别交付 title 和 year。
  const titleYearMatch = rawTitle.match(/[（(](\d{4})[）)]\s*$/);
  // 类型: string；作用: 去除尾部年份后的正式内容标题。
  const title = cleanText(titleYearMatch ? rawTitle.slice(0, titleYearMatch.index) : rawTitle);
  // 类型: number|null；作用: 从详情正式标题读取明确季号，后续同一内容全部线路共用该事实。
  const contentSeasonNumber = parseExplicitSeasonNumber(title);
  // 类型: object；作用: 按详情可见标签形成全部标准字段候选。
  const metadata = parseDetailMetadata(detailHtml);
  // 条件分支: 分类和状态都无法确定 movie/tv 时进入；执行内容: 失败关闭，禁止整页“美剧”导航文案改变类型。
  if (!metadata.contentType) throw new Error('MJWO 详情内容类型无法识别');
  // 类型: string；作用: 保存详情主封面容器，避免采用页头 Logo 或推荐卡片图片。
  const thumbBlock = extractElementByClass(source, 'div', DETAIL_THUMB_CLASS);
  // 类型: string；作用: 保存详情主封面图片标签。
  const image = thumbBlock.match(/<img\b[^>]*>/i)?.[0] || '';
  // 类型: string；作用: 保存封面地址。
  const poster = absoluteUrl(readAttribute(image, 'data-original') || readAttribute(image, 'src'), true);
  // 类型: string；作用: 保存首个精确简介容器文本，模糊 content 子串不再参与。
  let description = '';
  for (const locator of DETAIL_DESCRIPTION_LOCATORS) {
    // 类型: string；作用: 当前精确 tag/class 候选的清理文本。
    const candidate = cleanText(extractElementByClass(source, locator.tagName, locator.classToken));
    // 条件分支: 当前候选提供非空简介时进入；执行内容: 采用并停止后续后备定位。
    if (candidate) {
      description = candidate;
      break;
    }
  }
  // 条件分支: 页面没有精确简介容器时进入；执行内容: 采用权威 meta description，不把详情字段拼成简介。
  if (!description) description = cleanText(readMetaContent(source, 'description'));
  // 类型: string；作用: 隔离电影正片或电视剧分集的唯一权威列表。
  const playlistHtml = extractElementById(source, DETAIL_PLAYLIST_ID);
  // 类型: object；作用: 只从 playlist1 生成公共逻辑剧集和 Provider 私有 playUrl，容器外链接被结构性排除。
  const episodeCatalog = parsePlaylistEpisodeTargets(
    playlistHtml,
    poster,
    metadata.contentType,
    contentSeasonNumber
  );
  // 类型: Array<number>；作用: 只收集源站明确正集号，特辑和列表位置不参与最新集数计算。
  const regularEpisodeNumbers = episodeCatalog.episodes
    .map(episode => episode.episodeNumber)
    .filter(episodeNumber => Number.isSafeInteger(episodeNumber));
  // 类型: number|null；作用: 当前权威播放列表能明确证明的最大正集号。
  const latestCatalogEpisode = regularEpisodeNumbers.length ? Math.max(...regularEpisodeNumbers) : null;
  // 类型: object；作用: 电视剧状态先采用源站状态文本，不从页面导航或标题猜测。
  const tv = metadata.contentType === 'tv'
    ? parseTvProgress(metadata.status)
    : { totalEpisodes: null, latestEpisode: null, updateStatus: '', season: '' };
  // 条件分支: 电视剧状态没有数字但权威列表存在时进入；执行内容: 列表长度只补足当前已提供集数，不推测最终总集数。
  if (metadata.contentType === 'tv' && tv.latestEpisode === null && latestCatalogEpisode !== null) {
    tv.latestEpisode = latestCatalogEpisode;
  }
  // 条件分支: 电视剧明确完结但没有总集数字时进入；执行内容: 最大明确正集号作为完成总集数，不采用数组长度。
  if (metadata.contentType === 'tv' && tv.totalEpisodes === null
    && /完结/.test(metadata.status) && latestCatalogEpisode !== null) {
    tv.totalEpisodes = latestCatalogEpisode;
  }
  return {
    item: {
      id: contentId,
      sourceId,
      sourceName: sourceManifest.name,
      type: metadata.contentType,
      title,
      originalTitle: '',
      aliases: metadata.aliases,
      poster,
      cover: poster,
      description,
      year: metadata.year || titleYearMatch?.[1] || '',
      area: metadata.area,
      language: metadata.language,
      genres: metadata.genres,
      tags: metadata.classification ? [metadata.classification] : [],
      displayTags: [],
      score: metadata.score,
      quality: metadata.quality,
      rank: null,
      badge: '',
      detail: {
        fullDescription: description,
        directors: metadata.directors,
        writers: metadata.writers,
        actors: metadata.actors,
        releaseDate: metadata.releaseDate,
        updateTime: metadata.updateTime,
        status: metadata.status,
        screenshots: [],
        trailerUrl: ''
      },
      movie: { duration: metadata.contentType === 'movie' ? metadata.duration : '' },
      tv,
      playCatalog: null,
      playback: null,
      source: {
        name: sourceManifest.name,
        domain: 'www.mjwo.net',
        rawId: contentId,
        sourceDetailUrl: createDetailUrl(contentId),
        rawData: null,
        fetchedAt: ''
      }
    },
    episodeTargets: episodeCatalog.targets
  };
}

/**
 * 提取 MJWO 播放/解析页公开媒体线路。
 * 纯函数: 依次采用结构化 source、解析页 lineList JSON 和公开 HTTPS MP4/HLS 文本，不执行页面脚本。
 * 成功路径: 返回按源站顺序去重的直连媒体数组。
 * 失败路径: 结构非法或没有媒体时返回空数组，不把 iframe 或解析页地址当成媒体。
 *
 * @param {*} html 播放页或解析页 HTML。
 * @returns {Array<object>} Provider 内部媒体线路；每项包含稳定 identityKey/lineId、name、url 和 type。
 */
function extractMediaSources(html) {
  // 类型: string；作用: 保存播放/解析页 HTML。
  const source = typeof html === 'string' ? html : '';
  // 类型: Array<object>；作用: 按源站顺序保存去重后的浏览器直连线路。
  const mediaSources = [];
  // 类型: Set<string>；作用: 同一媒体 URL 只采用一次，保持首个线路名称。
  const seenUrls = new Set();

  /**
   * 采用一个媒体候选。
   * 副作用: 只在当前纯函数局部数组和集合中追加通过 HTTPS/扩展名门禁的候选。
   * 成功路径: 新 URL 追加名称、地址和媒体类型。
   * 失败路径: 非媒体 URL 或重复 URL 保持现有结果。
   *
   * @param {string} identityKey 线路稳定内部事实；named 使用完整名称，单一直连使用 direct。
   * @param {*} name 源站线路名称。
   * @param {*} value 源站媒体 URL 候选。
   * @returns {void} 结果写入局部 mediaSources。
   */
  function adoptMedia(identityKey, name, value) {
    // 类型: string；作用: 保存通过浏览器直连门禁的媒体地址。
    const url = normalizeMediaUrl(value);
    // 类型: string；作用: 保存清理后的线路身份事实；空名称不能按数组位置补线。
    const normalizedIdentityKey = cleanText(identityKey);
    // 类型: string；作用: 保存线路展示名称，公共平台不解释该文案。
    const normalizedName = cleanText(name);
    // 条件分支: 身份、名称、地址无效或 URL 已经采用时进入；执行内容: 跳过当前候选，不制造顺序线路。
    if (!normalizedIdentityKey || !normalizedName || !url || seenUrls.has(url)) return;
    seenUrls.add(url);
    mediaSources.push({
      identityKey: normalizedIdentityKey,
      lineId: createMediaLineId(normalizedIdentityKey),
      name: normalizedName,
      url,
      type: url.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4'
    });
  }

  // 类型: Array<string>；作用: 保存结构化 video source 标签，静态页面可以不经过脚本直接声明媒体。
  const sourceTags = source.match(/<source\b[^>]*>/gi) || [];
  sourceTags.forEach((tag) => {
    // 类型: string；作用: 多 source 必须自己声明稳定名称；单一无名 source 可以采用固定 direct 协议身份。
    const declaredName = readAttribute(tag, 'data-name') || readAttribute(tag, 'label') || readAttribute(tag, 'title');
    // 类型: string；作用: 单一直连使用固定名称，多条无名 source 使用空值并由 adoptMedia 拒绝。
    const lineName = declaredName || (sourceTags.length === 1 ? '直连线路' : '');
    // 类型: string；作用: 具名 source 跨集按完整名称稳定，单一直连使用固定 direct 身份。
    const identityKey = declaredName ? `named:${declaredName}` : sourceTags.length === 1 ? 'direct' : '';
    adoptMedia(identityKey, lineName, readAttribute(tag, 'src'));
  });

  // 类型: RegExpMatchArray|null；作用: 保存解析页 Alpine 配置中的权威 lineList JSON 数组。
  const lineListMatch = source.match(/\blineList\s*:\s*(\[[^\r\n]*\])/i)
    || source.match(/\blineList\s*=\s*(\[[^\r\n]*\])/i);
  // 条件分支: 解析页公开了 lineList JSON 数组时进入。
  // 执行内容: 只解析数据并采用受媒体门禁约束的线路，不执行外围播放器脚本。
  if (lineListMatch) {
    try {
      // 类型: Array<object>；作用: 只解析 JSON 数据，不执行解析页 JavaScript。
      const lineList = JSON.parse(lineListMatch[1]);
      // 条件分支: lineList 是数组时进入。
      // 执行内容: 按源站顺序采用每条 name/url。
      if (Array.isArray(lineList)) lineList.forEach((item) => {
        // 类型: string；作用: 解析页线路必须提供完整名称，空名称不会按数组位置生成身份。
        const lineName = cleanText(item?.name);
        adoptMedia(lineName ? `named:${lineName}` : '', lineName, item?.url);
      });
    } catch (error) {
      // 失败边界: lineList 不是合法 JSON 时忽略该结构，继续使用 source 标签或公开直链，不执行脚本修复数据。
    }
  }

  // 类型: string；作用: 保存页面公开的首个未转义 MP4/HLS 后备地址。
  const directUrl = source.match(/https:\/\/[^\s"'<>]+\.(?:m3u8|mp4)(?:\?[^\s"'<>]+)?/i)?.[0] || '';
  adoptMedia('direct', '直连线路', directUrl);
  return mediaSources;
}

/**
 * 从解析页稳定线路事实生成公共线路身份。
 * 纯函数: 不读取媒体 URL；同一具名线路跨分集使用相同 id。
 * 成功路径: 返回不透明 PlayCatalogLine.id。
 * 失败路径: identityKey 为空时由稳定身份函数抛 Error。
 *
 * @param {string} identityKey named:完整名称或 direct 协议身份。
 * @returns {string} 稳定线路身份。
 */
function createMediaLineId(identityKey) {
  return createStableOpaqueId(PLAY_CATALOG_POLICY.lineIdPrefix, identityKey);
}

/**
 * 把探测到的 MJWO 媒体线路和详情逻辑剧集合成为公共目录。
 * 纯函数: 每条真实线路复用同一内容的逻辑分集值副本，不交付媒体 URL、解析参数或播放页地址。
 * 成功路径: 返回默认线路和全部可用线路。
 * 失败路径: 空线路、空分集或重复线路身份抛 Error，详情不得交付半目录。
 *
 * @param {Array<object>} mediaSources 详情探测得到的 Provider 内部媒体线路。
 * @param {Array<object>} episodes 详情权威 playlist1 的公共逻辑剧集。
 * @returns {object} ContentItem.playCatalog。
 * @throws {Error} 线路或分集集合无效时抛出。
 */
function createPlayCatalog(mediaSources, episodes) {
  // 类型: Array<object>；作用: 隔离媒体线路输入，只读取其稳定身份和名称。
  const sources = Array.isArray(mediaSources) ? mediaSources : [];
  // 类型: Array<object>；作用: 隔离逻辑剧集输入，稍后为每条线路复制值对象。
  const logicalEpisodes = Array.isArray(episodes) ? episodes : [];
  // 条件分支: 没有真实线路或逻辑剧集时进入；执行内容: 失败关闭，不生成空默认 id。
  if (!sources.length || !logicalEpisodes.length) throw new Error('MJWO 播放目录事实不完整');
  // 类型: Set<string>；作用: 验证线路名称事实没有哈希冲突或重复身份。
  const lineIds = new Set(sources.map(source => source.lineId));
  // 条件分支: 线路身份重复时进入；执行内容: 失败关闭，不按解析页位置覆盖。
  if (lineIds.size !== sources.length) throw new Error('MJWO 播放目录线路身份冲突');
  return {
    defaultLineId: sources[0].lineId,
    lines: sources.map(source => ({
      id: source.lineId,
      name: source.name,
      available: true,
      unavailableReason: '',
      episodes: logicalEpisodes.map(episode => ({ ...episode }))
    }))
  };
}

/**
 * 精确解析 MJWO player 请求的线路、逻辑剧集和当前媒体。
 * 纯函数: episode 来自详情 playlist1，media line 来自目标分集自己的解析结果，二者都必须精确命中。
 * 成功路径: 返回 Provider 私有分集目标和已验证媒体线路。
 * 失败路径: 缺字段、未知分集或目标线路在当前分集不存在时抛 Error；不回退默认线、首集或相邻集。
 *
 * @param {Array<object>} mediaSources 当前目标分集解析出的媒体线路。
 * @param {Array<object>} episodeTargets 详情解析的逻辑剧集私有目标。
 * @param {*} params SourceDataRequest.params。
 * @returns {object} 精确 episodeTarget 和 mediaSource。
 * @throws {Error} 请求身份无法精确匹配时抛出。
 */
function resolveRequestedPlaybackTarget(mediaSources, episodeTargets, params) {
  // 类型: string；作用: 保存请求目标线路身份。
  const lineId = typeof params?.playbackSourceId === 'string' ? params.playbackSourceId : '';
  // 类型: string；作用: 保存请求逻辑剧集身份。
  const episodeId = typeof params?.episodeId === 'string' ? params.episodeId : '';
  // 条件分支: 任一身份为空时进入；执行内容: 拒绝 Provider 自行选择默认线或首集。
  if (!lineId || !episodeId) throw new Error('MJWO 播放请求缺少精确线路或分集身份');
  // 类型: object|undefined；作用: 在详情权威播放列表中精确定位逻辑剧集和私有播放页。
  const episodeTarget = episodeTargets.find(target => target.episode.id === episodeId && target.episode.playable);
  // 条件分支: 详情没有请求剧集时进入；执行内容: 失败关闭，不选择相邻项。
  if (!episodeTarget) throw new Error('MJWO 详情没有请求的逻辑剧集');
  // 类型: object|undefined；作用: 在当前目标分集自己的解析结果中精确定位请求线路。
  const mediaSource = mediaSources.find(source => source.lineId === lineId);
  // 条件分支: 当前分集没有请求线路时进入；执行内容: 失败关闭，旧媒体由平台继续保持。
  if (!mediaSource) throw new Error('MJWO 目标分集没有请求的播放线路');
  return { episodeTarget, mediaSource };
}

/**
 * 把首页完整卡片集合转换为平台逻辑页。
 * 纯函数: 保留解析顺序，不修改完整集合或请求参数。
 * 成功路径: 返回当前连续页条目和与 page/pageSize 一致的分页事实。
 * 失败路径: 非数组集合按空集合处理，非法页码回到第一页，非法容量使用当前集合长度或 1。
 *
 * @param {*} items 首页解析出的 ContentItem 集合。
 * @param {*} params SourceDataRequest.params 候选。
 * @returns {object} 当前逻辑页结果。
 * @returns {Array<object>} return.items 当前页条目，数量不超过 pageSize。
 * @returns {object} return.pagination 当前页、容量、总量、总页数和后续页状态。
 */
function createLogicalPage(items, params) {
  // 类型: Array<object>；来源: 当前首页 HTML 的完整有序卡片集合；作用: 非数组输入按空集合失败收敛。
  const sourceItems = Array.isArray(items) ? items : [];
  // 类型: number；来源: SourceDataRequest.params.page；作用: 非法页码统一回到第一页。
  const page = Number.isSafeInteger(params?.page) && params.page > 0 ? params.page : 1;
  // 类型: number；来源: SourceDataRequest.params.pageSize；作用: 定义平台逻辑页容量，不读取源站布局数量。
  const pageSize = Number.isSafeInteger(params?.pageSize) && params.pageSize > 0
    ? params.pageSize
    : Math.max(sourceItems.length, 1);
  // 类型: number；作用: 用平台逻辑页计算连续起点，避免把第 2 页错误映射成另一份首八条。
  const startIndex = (page - 1) * pageSize;
  // 类型: Array<object>；作用: 只交付当前逻辑页，最后一页允许少于 pageSize。
  const pageItems = sourceItems.slice(startIndex, startIndex + pageSize);
  // 类型: number；作用: 当前首页快照的可分页总条数。
  const total = sourceItems.length;
  // 类型: number；作用: 空集合为 0 页，其余按平台 pageSize 向上取整。
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  return {
    items: pageItems,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      // 类型: boolean；true 表示当前逻辑页后仍有首页卡片，false 表示已经到达集合末尾。
      hasMore: page < totalPages
    }
  };
}

/**
 * 包装 MJWO 内容响应。
 * 纯函数: 克隆请求并组合清洗结果。
 * 成功路径: 返回标准 items/item/pagination 外壳。
 * 失败路径: 无；内容过滤在解析函数中完成。
 *
 * @param {object} request SourceDataRequest。
 * @param {Array<object>} items 列表内容。
 * @param {object|null} item 单内容。
 * @param {object|null} pagination 分页。
 * @returns {object} SourceDataResponse。
 */
function createResponse(request, items, item, pagination) {
  return {
    sourceId: request.sourceId,
    pageKey: request.pageKey,
    moduleKey: request.moduleKey,
    request: JSON.parse(JSON.stringify(request)),
    pagination,
    items,
    item,
    meta: { fetchedAt: '', status: items.length || item ? 'ready' : 'empty', message: '' }
  };
}

/**
 * 创建 MJWO 目录筛选响应。
 * 纯函数: 只克隆请求并采用当前 Provider 已解析的筛选组，不请求网络或保存状态。
 * 成功路径: movie 返回源站五组筛选，tv 保持当前稳定排序组。
 * 失败路径: 非数组 groups 使用 tv 当前排序组；movie 完整性由调用方在创建响应前校验。
 *
 * @param {object} request SourceFilterMetaRequest。
 * @param {Array<object>} [groups] 当前目录解析出的标准筛选组。
 * @returns {object} SourceFilterMetaResponse。
 */
function createFilterResponse(request, groups) {
  // 类型: Array<object>；作用: movie 使用源站解析结果，tv 未传入时继续提供现有最新排序能力。
  const responseGroups = Array.isArray(groups)
    ? groups
    : [{
      name: 'sort',
      label: '排序',
      options: [
        { label: '全部', value: 'all', count: 0, active: true },
        { label: '最新', value: 'latest', count: 0, active: false }
      ]
    }];
  return {
    sourceId: request.sourceId,
    pageKey: request.pageKey,
    request: JSON.parse(JSON.stringify(request)),
    groups: responseGroups.map(group => ({
      ...group,
      options: group.options.map(option => ({ ...option }))
    })),
    meta: { status: 'ready', message: '', fetchedAt: '' }
  };
}

/**
 * 创建人工验证码挑战。
 * 纯函数: 只组合已通过网络读取的图片 data URL，不保存用户输入。
 * 成功路径: 返回标准 captcha 字段声明。
 * 失败路径: 无图片时仍返回可人工输入的空图挑战。
 *
 * @param {string} sourceId 当前 Provider 身份。
 * @param {string} image 验证码图片 data URL。
 * @returns {object} SourceChallenge。
 */
function createChallenge(sourceId, image) {
  return {
    challengeId: `${sourceId}:search-verification`,
    sourceId,
    type: 'captcha',
    title: '请输入验证码',
    image,
    fields: [{
      name: 'code',
      type: 'text',
      label: '验证码',
      required: true,
      placeholder: '请输入验证码'
    }],
    expiresAt: '',
    contextKey: 'mjwo-search-verification'
  };
}

/**
 * 构造 MJWO 搜索表单提交地址。
 * 纯函数: 只把标准关键词和页码映射为源站公开搜索 URL，不读取 Provider、Cookie 或页面状态。
 * 成功路径: 第一页与分页路径都保留源站表单的 wd 和空 submit 查询字段，供首请求、Referer 和唯一重试共同使用。
 * 失败路径: 关键词和页码由 fetchData 预先校验；本函数不猜测其他搜索路由或隐藏字段。
 *
 * @param {string} keyword 已清理的非空搜索词。
 * @param {number} page 已校验的正整数页码。
 * @returns {string} MJWO 搜索表单 URL。
 */
function buildSearchUrl(keyword, page) {
  // 类型: string；作用: 第一页使用搜索根路径，后续页使用源站公开的 page 路径语义。
  const pathname = `/search/--/${page > 1 ? `page/${page}/` : ''}`;
  // 类型: URLSearchParams；作用: 按源站表单字段顺序编码关键词，并显式保留空 submit 字段。
  const query = new URLSearchParams({ wd: keyword, submit: '' });
  return `${PAGE_BASE_URL}${pathname}?${query.toString()}`;
}

/**
 * 校验 MJWO 验证提交响应。
 * 纯函数: 只解析 SourceContext.network 返回的文本，不修改 Provider、页面或私有空间状态。
 * 成功路径: 源站返回 JSON 对象且 code 严格为 1 时返回冻结成功摘要。
 * 失败路径: JSON 无法解析、响应结构不是普通对象或 code 不是 1 时抛稳定 Provider 错误，阻止错误重试。
 *
 * @param {*} body 验证提交请求返回的 JSON 文本。
 * @returns {{code: number, message: string}} 源站验证成功的最小事实。
 * @throws {Error} 响应不是合法验证结果或源站明确拒绝验证码时抛出。
 */
function parseChallengeSubmitResponse(body) {
  // 类型: object；作用: 保存 JSON.parse 后的源站验证结果，成功与失败只由 code 字段决定。
  let payload;
  try {
    payload = JSON.parse(body);
  } catch (error) {
    throw new Error('MJWO 验证响应无效', { cause: error });
  }

  // 条件分支: 源站返回数组、null 或其他非普通对象时进入。
  // 执行内容: 拒绝把未知响应当作验证成功，避免错误请求继续重试。
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('MJWO 验证响应无效');
  }

  // 条件分支: 源站 code 不是成功值时进入；1002 等业务失败不得触发搜索重试。
  // 执行内容: 统一转换为 Provider 失败，后续由 Host 收敛为当前请求失败。
  if (payload.code !== 1) {
    throw new Error('MJWO 验证码校验失败');
  }

  return Object.freeze({
    code: 1,
    message: typeof payload.msg === 'string' ? payload.msg : ''
  });
}

/**
 * 创建 MJWO Provider。
 * 副作用: 保存 Context、Cookie、生命周期和请求序号；网络只走 SourceContext。
 * 成功路径: 搜索验证码经全局协调器 resolved 后重试原请求。
 * 失败路径: 用户取消、无交互、网络或解析失败直接抛出，不伪造结果。
 *
 * @param {object} definition SourceDefinition。
 * @returns {object} 精确 SourceProvider。
 */
function createProvider(definition) {
  // 类型: string；作用: 保存 Definition/Context/请求/响应共用 sourceId。
  const sourceId = definition.id;
  // 类型: string；作用: 保存生命周期阶段。
  let phase = PROVIDER_PHASE.created;
  // 类型: object|null；作用: 保存唯一 SourceContext，dispose 时清除。
  let activeContext = null;
  // 类型: number；作用: 生成当前实例内单调 requestId。
  let requestSequence = 0;
  // 类型: Map<string, object>；生命周期: 当前 Provider 运行实例；作用: 保存最近详情解析、公共目录和按剧集媒体线路事实，避免 player 重复请求详情与首集。
  const contentFactsById = new Map();
  // 类型: Map<string, Promise<object>>；生命周期: 当前 Provider 运行实例；作用: 合并同内容并发冷加载或详情刷新。
  const contentFactsLoads = new Map();

  /**
   * 获取运行 Context。
   * 纯函数: 只读取生命周期状态。
   * 成功路径: 返回唯一 Context。
   * 失败路径: 未运行、无 Context 或中止时抛 Error。
   *
   * @param {string} operation 操作名。
   * @returns {object} SourceContext。
   */
  function requireContext(operation) {
    // 条件分支: Provider 未运行、Context 缺失或 Host 已中止时进入。
    // 执行内容: 拒绝停止后继续访问 Shell。
    if (phase !== PROVIDER_PHASE.running || !activeContext || activeContext.signal.aborted) throw new Error(`MJWO Provider 当前不能执行 ${operation}`);
    return activeContext;
  }

  /**
   * 从 response header 读取并保存源站 Cookie。
   * 副作用: 只写入当前 sourceId 的 credentials/session 分区，不写后端或全局浏览器存储。
   * 成功路径: set-cookie 文本转换为 Cookie 请求头值。
   * 失败路径: 没有 header 或值无效时保持已有 Cookie。
   *
   * @param {object} response SourceNetworkResponse。
   * @param {object} context 当前 SourceContext。
   * @returns {Promise<void>} 保存完成。
   */
  async function adoptCookie(response, context) {
    // 类型: Array<object>；作用: 保存 ABI 2.0 有序多值响应头或空数组。
    const headers = response && Array.isArray(response.headers) ? response.headers : [];
    // 类型: Array<string>；作用: 按响应顺序保存每条 Set-Cookie 的 name=value 部分。
    const cookies = headers
      .filter(entry => entry && typeof entry.name === 'string' && entry.name.toLowerCase() === 'set-cookie')
      .map(entry => typeof entry.value === 'string' ? entry.value.split(';')[0].trim() : '')
      .filter(Boolean);
    // 条件分支: 响应没有可采用 Set-Cookie 时进入。
    // 执行内容: 保留当前已有凭据，不写空值覆盖。
    if (!cookies.length) return;
    // 副作用: 把有序 Cookie 请求头值写入当前 sourceId 凭据分区，刷新后由 Repository 恢复。
    await context.storage.credentials.set('cookie', cookies.join('; '));
  }

  /**
   * 获取当前 Cookie 请求头。
   * 副作用: 只读取当前源凭据空间，不返回完整存储对象。
   * 成功路径: 返回字符串 Cookie 或空字符串。
   * 失败路径: 存储读取错误由当前 Shell 门面传播，不创建第二存储。
   *
   * @param {object} context SourceContext。
   * @returns {Promise<string>} Cookie 文本或空字符串。
   */
  async function readCookie(context) {
    // 类型: *；作用: 保存 credentials 分区当前 cookie 值。
    const cookie = await context.storage.credentials.get('cookie');
    return typeof cookie === 'string' ? cookie : '';
  }

  /**
   * 请求 MJWO HTML、JSON 或验证码二进制。
   * 网络副作用: 通过 Shell 访问 www.mjwo.net/api.apiimg.com；Cookie 由当前源凭据空间提供。
   * 成功路径: 吸收 set-cookie；文本请求由 Provider 解码 body，二进制请求保留 ArrayBuffer。
   * 失败路径: host、状态或原始字节不符合调用方要求时抛 Error。
   *
   * @param {string} url 目标信息地址。
   * @param {object} options 请求配置。
   * @param {string} options.method GET|POST。
   * @param {Array<object>} options.headers 当前端点的有序源站请求头；Cookie 仍由 Provider 私有空间统一追加。
   * @param {string|null} options.body 请求体。
   * @param {boolean} options.binary true 保留原始字节，false 在 Provider 内解码 UTF-8 文本。
   * @returns {Promise<object>} Provider 内部网络结果；body 为文本或 ArrayBuffer。
   */
  async function requestNetwork(url, options = {}) {
    // 类型: object；作用: 保存当前 Provider Context。
    const context = requireContext('network');
    // 类型: URL；作用: 保存页面或解析请求的绝对地址。
    const parsedUrl = new URL(url);
    // 条件分支: 目标 host 不在页面/解析允许集合时进入。
    // 执行内容: 拒绝跨 host 信息请求。
    if (!['www.mjwo.net', 'api.apiimg.com'].includes(parsedUrl.host)) throw new Error('MJWO 请求 host 不受支持');
    // 副作用范围: 只递增当前 Provider 请求序号。
    requestSequence += 1;
    // 类型: string；作用: 保存当前源 Cookie 请求头。
    const cookie = await readCookie(context);
    // 类型: boolean；作用: true 表示验证码图片保持 ArrayBuffer，false 表示 Provider 自行解码文本。
    const binary = options.binary === true;
    // 类型: Array<object>；作用: 复制端点有序头并在末尾追加当前会话 Cookie。
    const requestHeaders = Array.isArray(options.headers)
      ? options.headers.map(entry => ({ name: entry.name, value: entry.value }))
      : [{ name: 'accept', value: binary ? 'image/*' : 'text/html' }];
    // 条件分支: 当前源已有会话 Cookie 时进入。
    // 执行内容: 在端点头之后追加 cookie，保持请求头顺序和同名头表达能力。
    if (cookie) requestHeaders.push({ name: 'cookie', value: cookie });
    // 类型: object；作用: 把 Provider 构造的文本表单或空正文映射到 ABI 2.0 运输对象。
    const requestBody = typeof options.body === 'string'
      ? { encoding: 'utf8', data: options.body }
      : { encoding: 'none', data: null };
    // 类型: object；作用: 保存 Shell 返回的隔离响应。
    const response = await context.network.request({
      sourceId,
      requestId: `mjwo-${requestSequence}`,
      url: parsedUrl.href,
      method: options.method || 'GET',
      headers: requestHeaders,
      body: requestBody,
      timeout: REQUEST_POLICY.timeoutMs,
      maxResponseBytes: binary ? REQUEST_POLICY.maxCaptchaBytes : REQUEST_POLICY.maxResponseBytes
    });
    // 副作用: 采用响应 Set-Cookie 到当前源凭据空间。
    await adoptCookie(response, context);
    // 条件分支: 响应缺失或不是 2xx 时进入。
    // 执行内容: 抛出信息请求失败，不把错误体交给解析器。
    if (!response || response.status < 200 || response.status >= 300) throw new Error('MJWO 信息请求失败');
    // 类型: string|ArrayBuffer；作用: 文本由 Provider 自己解码，验证码图片保留原始字节。
    const body = binary ? response.body : decodeUtf8Body(response.body);
    return Object.freeze({ ...response, body });
  }

  /**
   * 把验证码二进制转换为受限图片 data URL。
   * 纯函数: 只读取 ArrayBuffer，不保存原始二进制或用户输入。
   * 成功路径: 返回 image/png data URL。
   * 失败路径: body 不是 ArrayBuffer 或编码失败抛 Error。
   *
   * @param {*} body 验证码响应体。
   * @returns {string} 图片 data URL。
   */
  function toCaptchaDataUrl(body) {
    // 条件分支: body 不是 ArrayBuffer 时进入。
    // 执行内容: 拒绝把未知响应伪装成验证码图片。
    if (!(body instanceof ArrayBuffer)) throw new Error('MJWO 验证码响应不是二进制');
    // 类型: Uint8Array；作用: 保存限制容量内的验证码字节视图。
    const bytes = new Uint8Array(body);
    // 类型: string；作用: 累积二进制到 base64 前的字节字符串。
    let binary = '';
    // 类型: number；作用: 当前字节索引，循环终止于 bytes.length。
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return `data:image/png;base64,${btoa(binary)}`;
  }

  /**
   * 请求搜索页并在验证码时通过全局挑战恢复。
   * 网络副作用: 最多读取一次验证码图、提交一次人工 code，再重试原搜索请求。
   * 成功路径: 返回真实搜索 HTML。
   * 失败路径: unsupported/cancelled 或再次验证失败直接抛 Error。
   *
   * @param {string} keyword 搜索词。
   * @param {number} page 页码。
   * @returns {Promise<string>} 搜索 HTML。
   */
  async function requestSearch(keyword, page) {
    // 类型: string；作用: 保存完整搜索表单 URL，首请求、动态 Referer 和验证码成功后的唯一重试共用同一事实。
    const searchUrl = buildSearchUrl(keyword, page);
    // 类型: object；作用: 保存首个搜索网络响应。
    const response = await requestNetwork(searchUrl, { headers: REQUEST_HEADERS.searchDocument });
    // 类型: string；作用: 保存首个搜索 HTML。
    const html = typeof response.body === 'string' ? response.body : '';
    // 条件分支: 首个响应不是验证码页时进入。
    // 执行内容: 直接返回真实搜索 HTML，不创建挑战。
    if (!/系统安全验证|请输入验证码|verify_check|MAC\.Verify\.Refresh/i.test(html)) return html;
    // 类型: object；作用: 保存通过 Shell 读取的验证码二进制响应。
    const imageResponse = await requestNetwork(`${PAGE_BASE_URL}/index.php/verify/index.html`, {
      binary: true,
      headers: [
        ...REQUEST_HEADERS.captchaImage,
        { name: 'referer', value: searchUrl }
      ]
    });
    // 类型: object；作用: 保存带图片 data URL 的标准挑战。
    const challenge = createChallenge(sourceId, toCaptchaDataUrl(imageResponse.body));
    // 类型: object；作用: 保存全局协调器返回的用户输入/取消结果。
    const challengeResult = await activeContext.challenge.request(challenge);
    // 条件分支: 用户没有完成人工挑战时进入。
    // 执行内容: 失败关闭，不伪造验证成功或搜索结果。
    if (challengeResult.status !== 'resolved') throw new Error('MJWO 验证已取消或不受支持');
    // 类型: string；作用: 保存经过字段声明校验的验证码值。
    const code = challengeResult.values.code;
    // 类型: object；作用: 保存源站验证响应；只有明确成功才允许进入原搜索重试。
    const challengeResponse = await requestNetwork(`${PAGE_BASE_URL}/index.php/ajax/verify_check?type=search&verify=${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: [
        ...REQUEST_HEADERS.challengeSubmit,
        { name: 'referer', value: searchUrl }
      ],
      body: `verify=${encodeURIComponent(code)}`
    });
    // 领域校验: 源站返回 code=1 才代表人工验证成功；失败响应不得被误当成可重试搜索。
    parseChallengeSubmitResponse(challengeResponse.body);
    // 类型: object；作用: 保存验证码提交后的搜索重试响应。
    const retry = await requestNetwork(searchUrl, { headers: REQUEST_HEADERS.searchDocument });
    // 类型: string；作用: 保存重试搜索 HTML。
    const retryHtml = typeof retry.body === 'string' ? retry.body : '';
    // 条件分支: 重试仍返回验证页时进入。
    // 执行内容: 抛出验证失败，不无限重试或轮询。
    if (/系统安全验证|请输入验证码|verify_check|MAC\.Verify\.Refresh/i.test(retryHtml)) throw new Error('MJWO 验证未通过');
    return retryHtml;
  }

  /**
   * 请求并组合 MJWO 搜索结果平台逻辑页。
   * 调用方: fetchData 的 search 分支。
   * 网络副作用: 通过 requestSearch 读取第一批、末批和当前平台区间涉及的源站批次；每批继续独立遵守验证码、Cookie 和单次重试规则。
   * 成功路径: 源站固定批次按全局下标组成不跳项的 params.page/pageSize 逻辑页，并返回精确总量与总页数。
   * 失败路径: 分页当前页、总页数、非末页批次容量或末页容量漂移时抛 Error，不猜测缺失内容。
   *
   * @param {object} request search SourceDataRequest。
   * @returns {Promise<object>} 当前平台搜索逻辑页结果。
   * @returns {Array<object>} return.items 当前最多 pageSize 条连续搜索内容。
   * @returns {object} return.pagination 精确 page/pageSize/total/totalPages/hasMore。
   */
  async function requestSearchCatalog(request) {
    // 类型: object；作用: 保存标准搜索关键词和平台分页参数。
    const params = request.params && typeof request.params === 'object' ? request.params : {};
    // 类型: string；作用: 当前搜索关键词，空值不产生任意源站请求。
    const keyword = typeof params.keyword === 'string' ? params.keyword.trim() : '';
    // 条件分支: 搜索词为空时进入；执行内容: 失败关闭，保持搜索请求身份明确。
    if (!keyword) throw new Error('MJWO 搜索缺少 keyword');
    // 类型: number；作用: 非法平台页码统一回到第一页。
    const page = Number.isSafeInteger(params.page) && params.page > 0 ? params.page : 1;
    // 类型: number；作用: 平台搜索页容量来自标准请求，缺失时采用项目当前 12 条契约。
    const pageSize = Number.isSafeInteger(params.pageSize) && params.pageSize > 0 ? params.pageSize : 12;
    // 类型: Map<number, object>；生命周期: 当前搜索 fetchData 调用；作用: 同一源站页最多请求和解析一次。
    const sourcePageCache = new Map();

    /**
     * 读取一个源站搜索批次并复核页码身份。
     * 副作用: 缓存未命中时通过 requestSearch 执行一次完整受控搜索事务；缓存不跨当前调用保存。
     * 成功路径: 返回当前关键词和源站页码对应的解析结果。
     * 失败路径: 空结果只允许第一页表达 0 页；当前页与请求页不一致时抛 Error。
     *
     * @param {number} upstreamPage 目标源站搜索页码。
     * @returns {Promise<object>} 已解析搜索批次。
     */
    async function loadSourcePage(upstreamPage) {
      // 条件分支: 当前批次已经读取时进入；执行内容: 复用事务内结果，避免首批、末批和目标区间重复请求。
      if (sourcePageCache.has(upstreamPage)) return sourcePageCache.get(upstreamPage);
      // 类型: string；作用: 保存 requestSearch 完成验证恢复后交付的真实搜索 HTML。
      const html = await requestSearch(keyword, upstreamPage);
      // 类型: object；作用: 保存当前批次的标准卡片与源站分页事实。
      const parsedPage = parseSearchSourcePage(html, sourceId);
      // 条件分支: 当前响应表示 0 页时进入；执行内容: 只接受第一页空结果，拒绝后续页伪装空搜索。
      if (parsedPage.pagination.totalPages === 0) {
        // 条件分支: 空分页来自后续批次或同时携带内容时进入；执行内容: 拒绝矛盾响应，不写入事务缓存。
        if (upstreamPage !== 1 || parsedPage.items.length) throw new Error('MJWO 搜索分页结构无效');
        sourcePageCache.set(upstreamPage, parsedPage);
        return parsedPage;
      }
      // 条件分支: 源站响应当前页与请求页不一致时进入；执行内容: 拒绝重定向页或错误结果覆盖目标批次。
      if (parsedPage.pagination.page !== upstreamPage) throw new Error('MJWO 搜索分页当前页不一致');
      sourcePageCache.set(upstreamPage, parsedPage);
      return parsedPage;
    }

    // 类型: object；作用: 第一批决定源站真实非末页容量和总批次数，不使用固定 10 条常量。
    const firstSourcePage = await loadSourcePage(1);
    // 类型: number；作用: 源站搜索总批次数；无结果时为 0。
    const upstreamTotalPages = firstSourcePage.pagination.totalPages;
    // 条件分支: 当前关键词没有结果时进入；执行内容: 返回标准空分页，不继续请求末批或目标批次。
    if (upstreamTotalPages === 0) {
      return {
        items: [],
        pagination: { page, pageSize, total: 0, totalPages: 0, hasMore: false }
      };
    }
    // 类型: number；来源: 第一源站批次真实卡片数；作用: 作为后续非末页稳定批次容量和全局下标换算基准。
    const sourcePageSize = firstSourcePage.items.length;
    // 条件分支: 多页结果的第一非末批为空时进入；执行内容: 拒绝无法建立连续序列的分页结构。
    if (upstreamTotalPages > 1 && sourcePageSize <= 0) throw new Error('MJWO 搜索非末页主体数量无效');
    // 类型: object；作用: 末批真实条目数用于精确计算总量；单页结果直接复用第一批。
    const lastSourcePage = upstreamTotalPages > 1
      ? await loadSourcePage(upstreamTotalPages)
      : firstSourcePage;
    // 条件分支: 首批与末批报告总页数不一致时进入；执行内容: 拒绝在同一搜索快照中组合漂移分页。
    if (lastSourcePage.pagination.totalPages !== upstreamTotalPages) throw new Error('MJWO 搜索分页总页数不一致');
    // 条件分支: 末批超过第一非末批容量时进入；执行内容: 拒绝错误批次边界导致全局下标错位。
    if (upstreamTotalPages > 1 && lastSourcePage.items.length > sourcePageSize) {
      throw new Error('MJWO 搜索末页主体数量无效');
    }
    // 类型: number；作用: 完整非末批加末批实际条目形成精确搜索结果总量。
    const total = upstreamTotalPages > 1
      ? ((upstreamTotalPages - 1) * sourcePageSize) + lastSourcePage.items.length
      : firstSourcePage.items.length;
    // 类型: number；作用: 当前平台逻辑页在搜索全局序列中的零基起点。
    const startIndex = (page - 1) * pageSize;
    // 类型: number；作用: 当前平台逻辑页不超过真实总量的独占终点。
    const endIndex = Math.min(startIndex + pageSize, total);
    // 类型: Array<object>；作用: 按源站批次顺序收集当前平台逻辑区间，空越界页保持空数组。
    const items = [];

    // 条件分支: 当前平台页与真实搜索序列存在交集时进入；执行内容: 只读取覆盖区间的源站批次。
    if (endIndex > startIndex) {
      // 类型: number；作用: 当前全局区间涉及的第一个源站批次。
      const firstRequiredSourcePage = Math.floor(startIndex / sourcePageSize) + 1;
      // 类型: number；作用: 当前全局区间涉及的最后一个源站批次。
      const lastRequiredSourcePage = Math.floor((endIndex - 1) / sourcePageSize) + 1;
      // 循环边界: 仅遍历目标区间覆盖批次，首批和末批命中时由事务 Map 直接复用。
      for (let upstreamPage = firstRequiredSourcePage; upstreamPage <= lastRequiredSourcePage; upstreamPage += 1) {
        // 类型: object；作用: 当前目标源站搜索批次。
        const sourcePage = await loadSourcePage(upstreamPage);
        // 条件分支: 当前批次报告的总页数与第一批不一致时进入；执行内容: 拒绝跨快照拼接。
        if (sourcePage.pagination.totalPages !== upstreamTotalPages) throw new Error('MJWO 搜索分页批次总数漂移');
        // 类型: boolean；作用: true 要求当前非末批保持第一批容量，false 允许末批不足但禁止超过该容量。
        const isNonFinalSourcePage = upstreamPage < upstreamTotalPages;
        // 条件分支: 非末批容量漂移或末批超过固定容量时进入；执行内容: 失败关闭，阻止搜索结果跳项。
        if ((isNonFinalSourcePage && sourcePage.items.length !== sourcePageSize)
          || (!isNonFinalSourcePage && sourcePage.items.length > sourcePageSize)) {
          throw new Error('MJWO 搜索主体批次数量无效');
        }
        // 类型: number；作用: 当前源站批次在搜索全局序列中的起点。
        const sourcePageStart = (upstreamPage - 1) * sourcePageSize;
        // 类型: number；作用: 平台区间在当前批次内的包含起点。
        const sliceStart = Math.max(startIndex - sourcePageStart, 0);
        // 类型: number；作用: 平台区间在当前批次内的独占终点。
        const sliceEnd = Math.min(endIndex - sourcePageStart, sourcePage.items.length);
        items.push(...sourcePage.items.slice(sliceStart, sliceEnd));
      }
    }

    // 类型: number；作用: 空结果为 0 页，其余按平台 pageSize 对精确总量向上取整。
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        // 类型: boolean；true 表示当前平台页后仍有连续搜索内容，false 表示末页或越界页。
        hasMore: page < totalPages
      }
    };
  }

  /**
   * 请求并组合 MJWO 电影或美剧目录平台逻辑页。
   * 调用方: fetchData 的 movie/tv 分支。
   * 网络副作用: 读取默认频道页校验筛选允许集合，随后只读取目标逻辑区间涉及的源站批次和末页统计批次；同一 URL 在本事务内复用。
   * 成功路径: 顶部推荐与主体批次形成连续序列，返回 items 和精确平台 pagination。
   * 失败路径: 当前配置声明的筛选组、组合路径、非末页 24 条批次或分页总数不一致时抛 Error，不猜测缺失条目。
   *
   * @param {object} request movie 或 tv SourceDataRequest。
   * @param {object} definition CATALOG_DEFINITION 中与 pageKey 对应的受审配置。
   * @returns {Promise<object>} 当前平台逻辑页结果。
   * @returns {Array<object>} return.items 当前最多 pageSize 条内容。
   * @returns {object} return.pagination 精确 page/pageSize/total/totalPages/hasMore。
   */
  async function requestCatalog(request, definition) {
    // 类型: object；作用: 保存页面筛选和平台分页参数。
    const params = request.params && typeof request.params === 'object' ? request.params : {};
    // 类型: number；作用: 非法平台页码统一回到第一页。
    const page = Number.isSafeInteger(params.page) && params.page > 0 ? params.page : 1;
    // 类型: number；作用: 平台目录容量必须由请求明确提供，缺失时采用正式目录页 12 条规则。
    const pageSize = Number.isSafeInteger(params.pageSize) && params.pageSize > 0 ? params.pageSize : 12;
    // 类型: object；作用: 默认目录入口响应同时提供当前筛选允许集合和默认第一页数据。
    const entryResponse = await requestNetwork(`${PAGE_BASE_URL}${definition.entryPath}`);
    // 类型: Array<object>；作用: 当前源站真实筛选组，既用于页面元数据，也作为路径值允许集合。
    const filterGroups = parseCatalogFilterGroups(entryResponse.body, definition);
    // 类型: object；作用: 只保留当前目录配置声明并由源站允许的标准筛选值。
    const selection = normalizeCatalogFilterSelection(params, filterGroups, definition);
    // 类型: Map<number, object>；生命周期: 当前目录 fetchData 调用；作用: 同一源站批次最多请求和解析一次。
    const sourcePageCache = new Map();

    /**
     * 读取并校验一个源站目录批次。
     * 副作用: 缓存未命中时通过 requestNetwork 发起一次受控请求；缓存仅存在于当前 requestCatalog 调用。
     * 成功路径: 返回顶部推荐、主体条目和与目标页一致的源站分页。
     * 失败路径: 非末页主体不是 24 条、条目超过 24 条、当前页或总页数漂移时抛 Error。
     *
     * @param {number} upstreamPage 目标源站页码。
     * @returns {Promise<object>} 已校验源站批次。
     */
    async function loadSourcePage(upstreamPage) {
      // 条件分支: 当前批次已经请求时进入；执行内容: 复用事务内解析结果，避免末页与目标页重复请求。
      if (sourcePageCache.has(upstreamPage)) return sourcePageCache.get(upstreamPage);
      // 类型: string；作用: 使用同一筛选选择构造目标批次地址。
      const url = buildCatalogUrl(definition, selection, upstreamPage);
      // 类型: string；作用: 默认第一页直接复用筛选入口响应，其他批次通过 Shell 请求。
      const html = upstreamPage === 1 && url === `${PAGE_BASE_URL}${definition.entryPath}`
        ? entryResponse.body
        : (await requestNetwork(url)).body;
      // 类型: object；作用: 只有默认频道第一页解析顶部推荐，筛选页和后续批次固定为空。
      const parsedPage = parseCatalogSourcePage(
        html,
        sourceId,
        definition,
        upstreamPage === 1 && url === `${PAGE_BASE_URL}${definition.entryPath}`
      );
      // 条件分支: 空目录没有分页时进入；执行内容: 只允许第一页表达 0 页空结果。
      if (parsedPage.pagination.totalPages === 0) {
        // 条件分支: 后续批次或仍含主体条目却报告 0 页时进入；执行内容: 拒绝矛盾分页事实。
        if (upstreamPage !== 1 || parsedPage.catalogItems.length) throw new Error(`MJWO ${definition.label}分页结构无效`);
        sourcePageCache.set(upstreamPage, parsedPage);
        return parsedPage;
      }
      // 条件分支: 源站当前页与请求批次不一致时进入；执行内容: 拒绝重定向或错误页面覆盖目标逻辑页。
      if (parsedPage.pagination.page !== upstreamPage) throw new Error(`MJWO ${definition.label}分页当前页不一致`);
      // 条件分支: 主体解析条目超过源站固定批次时进入；执行内容: 拒绝把其他区域混入主体列表。
      if (parsedPage.catalogItems.length > CATALOG_SOURCE_PAGE_SIZE) throw new Error(`MJWO ${definition.label}主体批次超过 24 条`);
      // 条件分支: 当前不是末页但主体数量偏离固定 24 条时进入；执行内容: 失败关闭，避免平台逻辑页跳项。
      if (upstreamPage < parsedPage.pagination.totalPages
        && parsedPage.catalogItems.length !== CATALOG_SOURCE_PAGE_SIZE) {
        throw new Error(`MJWO ${definition.label}非末页主体数量无效`);
      }
      sourcePageCache.set(upstreamPage, parsedPage);
      return parsedPage;
    }

    // 类型: object；作用: 第一源站批次决定顶部推荐数量、主体固定批次和源站总页数。
    const firstSourcePage = await loadSourcePage(1);
    // 类型: number；作用: 源站主体总批次数；空目录为 0。
    const upstreamTotalPages = firstSourcePage.pagination.totalPages;
    // 类型: object；作用: 末页真实条目数用于计算精确总量；单页或空目录复用第一批。
    const lastSourcePage = upstreamTotalPages > 1
      ? await loadSourcePage(upstreamTotalPages)
      : firstSourcePage;
    // 条件分支: 首批与末批报告的总页数不一致时进入；执行内容: 拒绝在同一请求快照中组合漂移分页。
    if (lastSourcePage.pagination.totalPages !== upstreamTotalPages) {
      throw new Error(`MJWO ${definition.label}分页总页数不一致`);
    }
    // 类型: number；作用: 主体精确总量由完整非末页批次和末页实际条目数组成。
    const catalogTotal = upstreamTotalPages > 0
      ? ((upstreamTotalPages - 1) * CATALOG_SOURCE_PAGE_SIZE) + lastSourcePage.catalogItems.length
      : 0;
    // 类型: Array<object>；作用: 顶部推荐只属于默认频道第一批，顺序位于全部主体内容之前。
    const featuredItems = firstSourcePage.featuredItems;
    // 类型: number；作用: 平台连续序列总量。
    const total = featuredItems.length + catalogTotal;
    // 类型: number；作用: 当前平台页在连续序列中的零基起点。
    const startIndex = (page - 1) * pageSize;
    // 类型: number；作用: 当前平台页不超过总量的独占终点。
    const endIndex = Math.min(startIndex + pageSize, total);
    // 类型: Array<object>；作用: 按“顶部推荐 -> 主体全部批次”顺序收集当前平台页内容。
    const items = [];
    // 条件分支: 当前逻辑区间与顶部推荐重叠时进入；执行内容: 先采用推荐区对应切片。
    if (startIndex < featuredItems.length && endIndex > 0) {
      items.push(...featuredItems.slice(startIndex, Math.min(endIndex, featuredItems.length)));
    }
    // 类型: number；作用: 当前区间在主体全局序列中的零基起点。
    const catalogStartIndex = Math.max(startIndex - featuredItems.length, 0);
    // 类型: number；作用: 当前区间在主体全局序列中的独占终点。
    const catalogEndIndex = Math.max(Math.min(endIndex - featuredItems.length, catalogTotal), 0);
    // 条件分支: 当前平台页需要主体条目时进入；执行内容: 直接定位并读取覆盖区间的源站批次。
    if (catalogEndIndex > catalogStartIndex) {
      // 类型: number；作用: 当前主体区间涉及的第一个源站批次。
      const firstRequiredSourcePage = Math.floor(catalogStartIndex / CATALOG_SOURCE_PAGE_SIZE) + 1;
      // 类型: number；作用: 当前主体区间涉及的最后一个源站批次。
      const lastRequiredSourcePage = Math.floor((catalogEndIndex - 1) / CATALOG_SOURCE_PAGE_SIZE) + 1;
      // 循环边界: 只遍历目标逻辑区间覆盖的批次，不从第一页顺序抓取到目标页。
      for (let upstreamPage = firstRequiredSourcePage; upstreamPage <= lastRequiredSourcePage; upstreamPage += 1) {
        // 类型: object；作用: 当前源站批次，可能来自首批、末批或目标缓存。
        const sourcePage = await loadSourcePage(upstreamPage);
        // 条件分支: 当前批次总页数与首批不一致时进入；执行内容: 拒绝跨快照拼接。
        if (sourcePage.pagination.totalPages !== upstreamTotalPages) {
          throw new Error(`MJWO ${definition.label}分页批次总数漂移`);
        }
        // 类型: number；作用: 当前批次在主体全局序列中的起点。
        const sourcePageStart = (upstreamPage - 1) * CATALOG_SOURCE_PAGE_SIZE;
        // 类型: number；作用: 当前平台区间在本批次内的起始下标。
        const sliceStart = Math.max(catalogStartIndex - sourcePageStart, 0);
        // 类型: number；作用: 当前平台区间在本批次内的独占终点。
        const sliceEnd = Math.min(catalogEndIndex - sourcePageStart, sourcePage.catalogItems.length);
        items.push(...sourcePage.catalogItems.slice(sliceStart, sliceEnd));
      }
    }
    // 类型: number；作用: 空目录为 0 页，其余按平台 pageSize 精确向上取整。
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        // 类型: boolean；true 表示当前平台页后仍有连续内容，false 表示已到达末页或请求越界。
        hasMore: page < totalPages
      }
    };
  }

  /**
   * 请求一个 MJWO 逻辑剧集的真实媒体线路。
   * 网络副作用: 请求目标播放页；页面没有直连媒体时按其公开参数请求源站解析页。
   * 成功路径: 返回带稳定 lineId、线路名称和浏览器直连 URL 的内部媒体集合。
   * 失败路径: 分集目标、解析参数或媒体线路无效时抛 Error，不请求项目媒体代理。
   *
   * @param {object} episodeTarget 详情 playlist1 形成的 Provider 私有剧集目标。
   * @returns {Promise<Array<object>>} 当前逻辑剧集真实媒体线路。
   */
  async function requestEpisodeMediaSources(episodeTarget) {
    // 条件分支: 私有目标缺少合法播放页时进入；执行内容: 失败关闭，不从其他剧集借用 URL。
    if (!episodeTarget || !absoluteUrl(episodeTarget.playUrl)) throw new Error('MJWO 逻辑剧集播放目标无效');
    // 类型: object；作用: 保存当前逻辑剧集自己的播放页响应。
    const playPage = await requestNetwork(episodeTarget.playUrl);
    // 类型: Array<object>；作用: 优先采用播放页直接公开的具名或单一直连媒体。
    let mediaSources = extractMediaSources(playPage.body);
    // 条件分支: 播放页只提供 player_aaaa 解析参数而没有媒体直链时进入。
    // 执行内容: 请求源站解析页，仍只把最终 MP4/HLS 交给浏览器直连。
    if (!mediaSources.length) {
      // 类型: string；作用: 保存播放页公开脚本中的源站解析参数。
      const playerParameter = extractPlayerParameter(playPage.body);
      // 类型: string；作用: 保存编码后的源站解析页请求地址。
      const parserUrl = buildParserUrl(playerParameter);
      // 条件分支: 播放页没有可用解析参数时进入；执行内容: 失败关闭，不请求空地址。
      if (!parserUrl) throw new Error('MJWO 播放页没有解析参数');
      // 类型: object；作用: 保存源站解析页响应，referer 绑定当前逻辑剧集播放页。
      const parserPage = await requestNetwork(parserUrl, {
        headers: [{ name: 'referer', value: episodeTarget.playUrl }]
      });
      mediaSources = extractMediaSources(parserPage.body);
    }
    // 条件分支: 当前逻辑剧集没有任何合法具名或单一直连媒体时进入；执行内容: 失败关闭。
    if (!mediaSources.length) throw new Error('MJWO 播放页没有直连媒体');
    return mediaSources;
  }

  /**
   * 从 MJWO 网络加载详情、权威逻辑剧集和首集线路目录。
   * 网络副作用: 顺序请求详情和权威首个剧集媒体页；解析页仍由 requestEpisodeMediaSources 按源站公开参数决定。
   * 成功路径: 返回基础详情、完整公共目录，以及已经缓存首集线路的 Provider 私有内容事实。
   * 失败路径: contentId、详情、playlist1、首集线路或目录无效时抛 Error，不写会话缓存。
   *
   * @param {string} contentId MJWO 内容身份。
   * @returns {Promise<object>} 当前内容详情、目录和剧集媒体缓存。
   */
  async function loadContentFacts(contentId) {
    // 类型: string；作用: 保存校验后的详情地址。
    const detailUrl = createDetailUrl(contentId);
    // 条件分支: contentId 无法还原详情地址时进入；执行内容: 失败关闭，不猜测源站内容。
    if (!detailUrl) throw new Error('MJWO contentId 无效');
    // 类型: object；作用: 保存详情响应并交给 Provider 自己解析源站 HTML。
    const detailResponse = await requestNetwork(detailUrl);
    // 类型: object；作用: 保存详情基础 ContentItem、公共逻辑剧集和 Provider 私有播放页映射。
    const detailResult = parseDetail(detailResponse.body, contentId, sourceId);
    // 条件分支: 权威 playlist1 没有任何逻辑剧集时进入；执行内容: 详情无法形成播放目录，明确失败。
    if (!detailResult.episodeTargets.length) throw new Error('MJWO 详情没有可播放逻辑剧集');
    // 类型: object；作用: 详情按 playlist1 首个明确入口发现当前资源线路，不替代后续精确 player 身份。
    const probeEpisodeTarget = detailResult.episodeTargets[0];
    // 类型: Array<object>；作用: 保存首集真实线路名称、稳定 id 和直连媒体事实。
    const discoveredMediaSources = await requestEpisodeMediaSources(probeEpisodeTarget);
    // 类型: object；作用: 用首集已发现线路和全部逻辑剧集生成不含私有 URL 的唯一公共目录。
    const playCatalog = createPlayCatalog(
      discoveredMediaSources,
      detailResult.episodeTargets.map(target => target.episode)
    );
    // 类型: Map<string,Array<object>>；作用: 以逻辑 episodeId 保存已成功解析的线路集合，首集立即进入缓存。
    const mediaSourcesByEpisodeId = new Map([
      [probeEpisodeTarget.episode.id, discoveredMediaSources]
    ]);
    return {
      detailResult,
      playCatalog,
      mediaSourcesByEpisodeId,
      // 类型: Map<string,Promise<Array<object>>>；作用: 合并同一剧集并发 player 请求，失败任务在 finally 中删除。
      mediaSourceLoadsByEpisodeId: new Map(),
      // 类型: Set<string>；作用: 记录当前剧集媒体事实已经交给无视觉探测实例消费，下一次正式播放需由 Provider 重新解析。
      probedEpisodeIds: new Set()
    };
  }

  /**
   * 读取当前 Provider 会话中的 MJWO 内容事实。
   * 副作用: 缓存未命中或 refresh=true 时调用 loadContentFacts；成功后替换当前 contentId 内存事实，不写 SourceContext.storage。
   * 成功路径: detail 刷新事实，player 复用最近目录；冷 player 完成一次加载后供同内容后续目标共享。
   * 失败路径: 网络或解析失败不覆盖旧成功事实并向调用方传播；在途索引在任意终态清理。
   *
   * @param {string} contentId MJWO 内容身份。
   * @param {object} options 读取策略。
   * @param {boolean} options.refresh true 强制刷新详情，false 优先复用当前 Provider 会话事实。
   * @returns {Promise<object>} 当前内容详情、目录和剧集媒体缓存。
   */
  async function requestContentFacts(contentId, options = { refresh: false }) {
    // 类型: boolean；作用: 只有详情入口显式刷新，player 不重复请求详情和首集线路。
    const shouldRefresh = options?.refresh === true;
    // 类型: Promise<object>|undefined；作用: 当前内容已有冷加载或刷新时复用同一网络事务。
    const activeLoad = contentFactsLoads.get(contentId);
    // 条件分支: 同内容加载正在执行时进入；执行内容: 返回同一 Promise，避免重复页面请求。
    if (activeLoad) return activeLoad;
    // 条件分支: player 允许复用且当前内容已有成功事实时进入；执行内容: 返回 Provider 私有会话对象。
    if (!shouldRefresh && contentFactsById.has(contentId)) return contentFactsById.get(contentId);

    // 类型: Promise<object>；作用: 唯一内容加载成功后采用缓存，最终清理在途索引。
    const loadOperation = loadContentFacts(contentId).then((contentFacts) => {
      contentFactsById.set(contentId, contentFacts);
      return contentFacts;
    }).finally(() => {
      // 条件分支: Map 仍指向本次任务时进入；执行内容: 迟到旧 finally 不删除后续刷新任务。
      if (contentFactsLoads.get(contentId) === loadOperation) contentFactsLoads.delete(contentId);
    });
    contentFactsLoads.set(contentId, loadOperation);
    return loadOperation;
  }

  /**
   * 读取同一内容中一个逻辑剧集的媒体线路。
   * 副作用: 缓存未命中时调用 requestEpisodeMediaSources；成功后只写当前内容事实的内存 Map。
   * 成功路径: 已解析剧集直接返回，同剧集并发请求共享 Promise，不同线路选择复用同一媒体集合。
   * 失败路径: 请求或解析失败不写成功缓存，并删除在途索引后向调用方传播。
   *
   * @param {object} contentFacts requestContentFacts 返回的 Provider 私有事实。
   * @param {object} episodeTarget Provider 私有逻辑剧集目标。
   * @param {object} options 媒体事实读取策略。
   * @param {boolean} options.refresh true 重新解析当前剧集，false 优先复用成功事实。
   * @returns {Promise<Array<object>>} 当前剧集真实媒体线路。
   */
  async function loadEpisodeMediaSources(contentFacts, episodeTarget, options = { refresh: false }) {
    // 类型: string；作用: 使用公共逻辑剧集身份作为同内容缓存键，不保存私有 URL。
    const episodeId = episodeTarget?.episode?.id || '';
    // 条件分支: 剧集身份缺失时进入；执行内容: 拒绝创建空键或借用首集媒体。
    if (!episodeId) throw new Error('MJWO 逻辑剧集身份无效');
    // 类型: boolean；作用: 正式播放在探测消费后要求 Provider 重新解析当前剧集媒体事实。
    const shouldRefresh = options?.refresh === true;
    // 类型: Promise<Array<object>>|undefined；作用: 合并同一剧集并发 player 请求。
    const activeLoad = contentFacts.mediaSourceLoadsByEpisodeId.get(episodeId);
    // 条件分支: 刷新请求遇到同剧集旧加载时进入；执行内容: 等待旧事实收敛后再创建一次独立刷新，不并发访问源站。
    if (shouldRefresh && activeLoad) await activeLoad;
    // 条件分支: 非刷新请求遇到同剧集加载时进入；执行内容: 返回同一 Promise 合并普通并发请求。
    if (!shouldRefresh && activeLoad) return activeLoad;
    // 条件分支: 非刷新请求且当前剧集已有成功媒体事实时进入；执行内容: 直接复用全部真实线路。
    if (!shouldRefresh && contentFacts.mediaSourcesByEpisodeId.has(episodeId)) {
      return contentFacts.mediaSourcesByEpisodeId.get(episodeId);
    }

    // 类型: Promise<Array<object>>；作用: 唯一剧集加载成功后采用线路缓存，任意终态清理在途索引。
    const loadOperation = requestEpisodeMediaSources(episodeTarget).then((mediaSources) => {
      contentFacts.mediaSourcesByEpisodeId.set(episodeId, mediaSources);
      return mediaSources;
    }).finally(() => {
      // 条件分支: Map 仍指向本次剧集任务时进入；执行内容: 不让旧 finally 删除后续请求。
      if (contentFacts.mediaSourceLoadsByEpisodeId.get(episodeId) === loadOperation) {
        contentFacts.mediaSourceLoadsByEpisodeId.delete(episodeId);
      }
    });
    contentFacts.mediaSourceLoadsByEpisodeId.set(episodeId, loadOperation);
    return loadOperation;
  }

  /**
   * 获取页面内容响应。
   * 网络副作用: detail/player 在详情后用权威首个剧集探测完整线路；player 再解析请求剧集自己的目标线路。
   * 成功路径: 详情交付完整 playCatalog，播放只交付精确 lineId/episodeId 的单一 playback.media。
   * 失败路径: 参数、详情、线路探测、请求身份或媒体解析失败抛 Error，不返回半目录或空媒体。
   *
   * @param {object} request SourceDataRequest。
   * @returns {Promise<object>} SourceDataResponse。
   */
  async function fetchData(request) {
    // 类型: object；作用: 保存页面参数。
    const params = request.params || {};
    // 条件分支: detail/player 请求时进入。
    // 执行内容: detail 刷新详情和首集目录；player 复用当前 Provider 会话事实并只加载请求剧集。
    if (request.pageKey === 'detail' || request.pageKey === 'player') {
      // 类型: object；作用: detail 强制刷新，player 优先复用最近成功内容与首集线路事实。
      const contentFacts = await requestContentFacts(params.contentId, {
        refresh: request.pageKey === 'detail'
      });
      // 类型: object；作用: 保存详情基础对象和 Provider 私有逻辑剧集目标。
      const detailResult = contentFacts.detailResult;
      // 类型: object；作用: 详情与 player 共用同一目录基础对象；playback 仍保持 null 直到精确媒体成功。
      let item = { ...detailResult.item, playCatalog: contentFacts.playCatalog };
      // 条件分支: 当前请求是 player 时进入；执行内容: 只解析请求剧集自己的目标线路媒体。
      if (request.pageKey === 'player') {
        // 类型: string；作用: 先读取请求逻辑剧集身份，缺失时不能借用探测剧集。
        const requestedEpisodeId = typeof params.episodeId === 'string' ? params.episodeId : '';
        // 类型: object|undefined；作用: 在详情权威目标中精确定位请求剧集。
        const requestedEpisodeTarget = detailResult.episodeTargets
          .find(target => target.episode.id === requestedEpisodeId && target.episode.playable);
        // 条件分支: 请求剧集不存在时进入；执行内容: 失败关闭，不访问首集或相邻集。
        if (!requestedEpisodeTarget) throw new Error('MJWO 详情没有请求的逻辑剧集');
        // 类型: boolean；作用: 识别平台标准无视觉探测意图；未知或旧客户端缺失字段时保持普通缓存语义。
        const isProbeRequest = params.requestPurpose === PLAYER_REQUEST_PURPOSE.probe;
        // 类型: boolean；作用: 正式播放只在该剧集媒体事实已交给探测实例消费后重新解析，避免重复刷新普通播放请求。
        const shouldRefreshMedia = params.requestPurpose === PLAYER_REQUEST_PURPOSE.playback
          && contentFacts.probedEpisodeIds.has(requestedEpisodeId);
        // 条件分支: 当前调用是探测时进入；执行内容: 在媒体事实交付前登记消费意图，使并发正式播放也能要求刷新。
        if (isProbeRequest) contentFacts.probedEpisodeIds.add(requestedEpisodeId);
        // 类型: Array<object>；作用: 当前请求剧集自己的真实线路，可能与探测剧集存在缺线差异。
        const requestedMediaSources = await loadEpisodeMediaSources(contentFacts, requestedEpisodeTarget, {
          refresh: shouldRefreshMedia
        });
        // 条件分支: 正式播放已经成功取得刷新或可复用事实时进入；执行内容: 清除探测消费标记，后续普通播放继续复用本次结果。
        if (params.requestPurpose === PLAYER_REQUEST_PURPOSE.playback) {
          contentFacts.probedEpisodeIds.delete(requestedEpisodeId);
        }
        // 类型: object；作用: 同时精确校验请求 episodeId 和 playbackSourceId。
        const selection = resolveRequestedPlaybackTarget(
          requestedMediaSources,
          detailResult.episodeTargets,
          params
        );
        item = {
          ...item,
          playback: {
            lineId: selection.mediaSource.lineId,
            episodeId: selection.episodeTarget.episode.id,
            media: {
              type: selection.mediaSource.type,
              url: selection.mediaSource.url,
              quality: detailResult.item.quality,
              // 边界: 浏览器直接请求媒体 URL，项目代理只处理 Provider 的小体积信息请求。
              deliveryMode: 'direct'
            }
          }
        };
      }
      return createResponse(request, [], item, null);
    }
    // 条件分支: 首页五区域请求时进入。
    // 执行内容: 只请求一次首页原始 HTML，再由 Provider 按 moduleKey 选择指定源站板块并形成连续逻辑页。
    if (request.pageKey === 'home') {
      // 类型: object；作用: 保存 MJWO 首页原始响应，公共层不接触源站 HTML。
      const homeResponse = await requestNetwork(`${PAGE_BASE_URL}/`);
      // 类型: Array<object>；作用: 保存当前 moduleKey 对应的完整有序内容集合。
      const homeItems = parseHomeModule(homeResponse.body, sourceId, request.moduleKey);
      // 类型: object；作用: 按平台 page/pageSize 从当前区域完整集合形成连续逻辑页。
      const logicalPage = createLogicalPage(homeItems, params);
      return createResponse(request, logicalPage.items, null, logicalPage.pagination);
    }
    // 条件分支: 电影或电视剧目录请求时进入。
    // 执行内容: 选择受审目录配置，通过同一筛选、双区域和真实分页引擎形成平台连续逻辑页。
    if (request.pageKey === 'movie' || request.pageKey === 'tv') {
      // 类型: object；作用: 当前 pageKey 对应的站点目录配置，不把电影和美剧差异泄漏到公共页面。
      const definition = CATALOG_DEFINITION[request.pageKey];
      // 类型: object；作用: 保存 Provider 独立完成的目录逻辑页，公共页面不解释 MJWO 路径或批次。
      const catalogPage = await requestCatalog(request, definition);
      return createResponse(request, catalogPage.items, null, catalogPage.pagination);
    }
    // 条件分支: 未登记的列表页面进入；执行内容: 只允许 search 使用剩余分支，不把未知页面回退成搜索。
    if (request.pageKey !== 'search') throw new Error('MJWO 页面不受支持');
    // 类型: object；作用: 保存 Provider 独立完成的搜索连续逻辑页，公共页面不解释源站 URL、批次或验证码。
    const searchPage = await requestSearchCatalog(request);
    return createResponse(request, searchPage.items, null, searchPage.pagination);
  }

  /**
   * 返回 MJWO 目录筛选元数据。
   * 网络副作用: movie/tv 通过 SourceContext.network 请求各自默认目录入口并解析配置声明的真实筛选组。
   * 成功路径: movie 返回类型、剧情、地区、年份和排序；tv 返回剧情、年份、状态和排序。
   * 失败路径: 非目录页抛 Error。
   *
   * @param {object} request SourceFilterMetaRequest。
   * @returns {Promise<object>} SourceFilterMetaResponse。
   */
  async function fetchFilterMeta(request) {
    // 类型: object；作用: 验证当前 Provider 仍运行。
    requireContext('fetchFilterMeta');
    // 条件分支: pageKey 不是 movie/tv 时进入。
    // 执行内容: 拒绝为搜索和详情生成目录筛选。
    if (request.pageKey !== 'movie' && request.pageKey !== 'tv') throw new Error('筛选页不受支持');
    // 类型: object；作用: 当前目录筛选配置，决定入口、组映射和默认允许值。
    const definition = CATALOG_DEFINITION[request.pageKey];
    // 类型: object；作用: 保存同时包含筛选、推荐和主体第一页的源站响应。
    const response = await requestNetwork(`${PAGE_BASE_URL}${definition.entryPath}`);
    // 类型: Array<object>；作用: 保存按源站顺序解析的标准筛选组。
    const groups = parseCatalogFilterGroups(response.body, definition);
    // 验证作用: 复用内容请求同一允许集合门禁，确保缺组时不向页面发布半套筛选。
    normalizeCatalogFilterSelection({}, groups, definition);
    return createFilterResponse(request, groups);
  }

  /**
   * 检查 MJWO 首页代表性内容可用性。
   * 网络副作用: 请求首页 HTML，并复用正式热门电影板块解析链；不自动绕过验证码。
   * 成功路径: 首页能够解析出至少一条标准热门电影卡片时返回 normal。
   * 失败路径: 请求失败、验证页、200 错误页、空壳页或板块结构失效时返回 unavailable。
   *
   * @returns {Promise<object>} SourceHealthCheckResult。
   */
  async function checkHealth() {
    // 类型: string；作用: 保存本次检测最终状态，默认失败关闭为 unavailable。
    let healthStatus = 'unavailable';
    // 类型: string；作用: 保存面向用户的失败原因；成功后必须清空。
    let unavailableReason = 'MJWO 请求失败';
    try {
      // 类型: object；作用: 保存首页网络响应。
      const response = await requestNetwork(`${PAGE_BASE_URL}/`);
      // 类型: string；作用: 保存首页 HTML 文本。
      const html = typeof response.body === 'string' ? response.body : '';
      // 条件分支: 首页返回验证码页时进入。
      // 执行内容: 返回 unavailable，健康检查不自动弹出人工流程。
      if (/系统安全验证|请输入验证码/i.test(html)) {
        unavailableReason = '需要人工验证';
      } else {
        // 类型: Array<object>；作用: 复用正式首页热门电影映射，防止无业务内容的 2xx 页面产生假绿色。
        const representativeItems = parseHomeModule(html, sourceId, HOME_MODULE_KEY.hotMovies);
        // 条件分支: 首页没有形成任何标准热门电影时进入；执行内容: 保持不可用并交付结构失效原因。
        if (!representativeItems.length) {
          unavailableReason = 'MJWO 内容结构不可用';
        } else {
          healthStatus = 'normal';
          unavailableReason = '';
        }
      }
    } catch (error) {
      // 失败边界: 网络、状态、解码或解析错误保持默认 unavailable，不泄漏底层异常。
    }
    return { healthStatus, checkedAt: new Date().toISOString(), unavailableReason };
  }

  /**
   * 识别 MJWO 验证挑战。
   * 纯函数: 只读取响应文本，不发起验证码请求。
   * 成功路径: 验证页返回标准字段声明。
   * 失败路径: 普通页面返回 null。
   *
   * @param {*} response SourceNetworkResponse。
   * @returns {Promise<object|null>} SourceChallenge 或 null。
   */
  async function detectChallenge(response) {
    // 类型: string；作用: 保存 ABI 2.0 原始正文解码后的 HTML；非法候选按非挑战处理。
    const html = response && response.body instanceof ArrayBuffer
      ? decodeUtf8Body(response.body)
      : '';
    // 条件分支: 响应不是验证页时进入。
    // 执行内容: 返回 null，不把普通页面误报为挑战。
    if (!/系统安全验证|请输入验证码|verify_check/i.test(html)) return null;
    return createChallenge(sourceId, '');
  }

  /**
   * 转发全局挑战结果。
   * 副作用: 只验证运行状态，不写第二份会话。
   * 成功路径: 返回 Host 输入。
   * 失败路径: Provider 未运行时抛 Error。
   *
   * @param {*} challengeInput 标准挑战结果。
   * @returns {Promise<*>} 原结果。
   */
  async function continueChallenge(challengeInput) {
    // 类型: object；作用: 验证当前运行阶段并保持结果不落盘。
    requireContext('continueChallenge');
    return challengeInput;
  }

  return Object.freeze({
    id: sourceId,
    /**
     * 初始化 Provider。
     * 副作用: 保存同源 Context 并切换 initialized。
     * 成功路径: 首次同源初始化完成。
     * 失败路径: 重复或跨源抛 Error。
     * @param {object} context SourceContext。
     * @returns {Promise<void>} 初始化结果。
     */
    initialize(context) {
      // 条件分支: 初始化顺序或 sourceId 不一致时进入。
      // 执行内容: 拒绝重复或跨源 Context。
      if (phase !== PROVIDER_PHASE.created || !context || context.sourceId !== sourceId) throw new Error('初始化无效');
      activeContext = context;
      phase = PROVIDER_PHASE.initialized;
      return Promise.resolve();
    },
    /**
     * 启动 Provider。
     * 副作用: 切换 initialized 到 running。
     * 成功路径: 返回完成 Promise。
     * 失败路径: 未初始化抛 Error。
     * @returns {Promise<void>} 启动结果。
     */
    start() {
      // 条件分支: initialize 未完成时进入。
      // 执行内容: 拒绝越过生命周期启动。
      if (phase !== PROVIDER_PHASE.initialized) throw new Error('启动顺序无效');
      phase = PROVIDER_PHASE.running;
      return Promise.resolve();
    },
    fetchData,
    fetchFilterMeta,
    checkHealth,
    detectChallenge,
    continueChallenge,
    /**
     * 停止 Provider。
     * 副作用: 切换 running 到 stopped。
     * 成功路径: stopped 可幂等停止。
     * 失败路径: 未运行抛 Error。
     * @returns {Promise<void>} 停止结果。
     */
    stop() {
      // 条件分支: 已释放时进入。
      // 执行内容: 幂等返回，不恢复 Context。
      if (phase === PROVIDER_PHASE.disposed) return Promise.resolve();
      // 条件分支: 当前阶段不是 running/stopped 时进入。
      // 执行内容: 拒绝错误停止顺序。
      if (phase !== PROVIDER_PHASE.running && phase !== PROVIDER_PHASE.stopped) throw new Error('停止顺序无效');
      phase = PROVIDER_PHASE.stopped;
      return Promise.resolve();
    },
    /**
     * 永久释放 Provider。
     * 副作用: 清除 Provider 私有内容事实、在途索引和 Context，并切换 disposed。
     * 成功路径: 返回完成 Promise。
     * 失败路径: 无，释放幂等。
     * @returns {Promise<void>} 释放结果。
     */
    dispose() {
      // 副作用: 清除会话内容事实、剧集线路缓存和 Context，并永久关闭 Provider。
      contentFactsById.clear();
      contentFactsLoads.clear();
      activeContext = null;
      phase = PROVIDER_PHASE.disposed;
      return Promise.resolve();
    }
  });
}

/**
 * 创建 MJWO ProviderFactory。
 * 纯函数: 只返回精确身份工厂，不访问网络或共享状态。
 * 成功路径: supports 匹配身份，create 返回独立 Provider。
 * 失败路径: 身份不匹配时 supports false 或 create 抛 Error。
 *
 * @returns {object} ProviderFactory。
 */
export function createProviderFactory() {
  return Object.freeze({
    providerKey: sourceManifest.providerKey,
    /**
     * 判断 Definition 身份。
     * 纯函数: 只比较 id 和 providerKey。
     * @param {*} definition SourceDefinition。
     * @returns {boolean} 是否支持。
     */
    supports(definition) {
      return Boolean(definition
        && definition.id === sourceManifest.id
        && definition.providerKey === sourceManifest.providerKey);
    },
    /**
     * 创建 MJWO Provider。
     * 副作用: 创建新的闭包状态，不启动网络。
     * 成功路径: 身份匹配时返回 Provider。
     * 失败路径: 身份不匹配时抛 Error。
     * @param {object} options Host 参数。
     * @returns {object} Provider。
     */
    create({ definition }) {
      // 条件分支: Definition 身份或 providerKey 不匹配时进入。
      // 执行内容: 拒绝当前单文件创建其他源实例。
      if (!definition
        || definition.id !== sourceManifest.id
        || definition.providerKey !== sourceManifest.providerKey) throw new Error('Definition 不受支持');
      return createProvider(definition);
    }
  });
}
