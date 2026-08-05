/*
  moovie.js 模块说明

  - 文件职责:
      把 Moovie discover/search/详情/资源播放 HTML 清洗为 v5 ContentItem、筛选和播放对象。
      保留当前站点 HTMX 请求头、referer、多来源隔离和未知总页数语义；所有 HTML 解析均使用文件内纯文本辅助函数。
      详情刷新 Provider 私有内容事实，player 在同一运行实例内复用完整目录并只请求目标媒体，避免后台多目标探测重复发现全站线路。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无；单文件不访问 DOM、全局 fetch、store、Repository、代理 URL 或其他 Provider。

  - 模块级常量:
      sourceManifest: object，Moovie 静态身份和六类页面能力。
      BASE_URL: string，Moovie HTTPS 信息站点根地址。
      CONTENT_TYPE: object，平台电影和电视剧类型枚举。
      DISCOVER_SECTION: object，Moovie 四个发现页分区的路径、平台类型和展示标签。
      HOME_DISCOVER_POLICY: object，首页五个数据桶的分区切片规则。
      TV_CATALOG_POLICY: object，电视剧混合分页和分类元数据规则。
      SEARCH_POLICY: object，Moovie 资源搜索端点、页容量和可逆身份前缀。
      PLAY_CATALOG_POLICY: object，播放目录稳定身份、电影正片身份和不可用文案规则。
      STABLE_ID_HASH_POLICY: object，Provider 私有定位值到不透明公共身份的确定性哈希参数。
      RESOURCE_CONTENT_TYPE_LABEL_PATTERNS: object，Moovie 资源类别的电影和电视剧事实规则。
      RESOURCE_STATUS_TYPE_PATTERNS: object，类别缺失时使用的资源状态补充规则。
      HTML_NAMED_ENTITIES: object，HTML 属性和文本允许解码的命名实体表。
      PROVIDER_PHASE: object，Provider 生命周期枚举。
      REQUEST_POLICY: object，HTML 请求策略。

  - 模块级变量:
      无；Context、序号和生命周期均按 Provider 实例隔离。

  - 模块级辅助函数:
      decodeHtmlEntities(value): string，统一解码 HTML 命名和数字实体。
      cleanText(value): string，清理 HTML 文本。
      decodeUtf8Body(body): string，把 ABI 2.0 原始响应字节解码为 HTML。
      readAttribute(tag, name): string，读取开始标签属性。
      readMetaContent(html, attributeName, attributeValue): string，读取指定 meta content。
      absoluteUrl(value): string，限制同 host HTTPS 地址。
      normalizeMediaUrl(value): string，限制浏览器直连媒体。
      decodeScriptUrl(value): string，解码脚本字符串中的媒体地址。
      normalizePositiveExternalId(value): string，把源站外部 id 收敛为无前导零的正整数字符串。
      parseDatabaseContentId(value): string，校验并读取规范 db- 正整数身份。
      parseMoovieId(value): string，形成 db- 内容身份。
      parseCardCandidates(html): Array<object>，提取不含猜测类型的卡片事实、评分和状态。
      createCardContentItem(candidate, sourceId, section): object，用已确认分区构造标准卡片。
      parseCards(html, sourceId, section): Array<object>，解析已由发现页分区确认类型的卡片。
      collectPolicySectionKeys(policy): Array<string>，提取策略需要请求的唯一分区。
      createPolicyItems(itemsBySection, policy, ranked): Array<object>，按具名切片合并首页内容。
      createMixedTvPage(itemsBySection, params): object，生成三个电视剧分区各六条的逻辑页。
      normalizeAssetUrl(value): string，校验可直接展示的 HTTPS 海报地址。
      createResourceContentId(value): string，把同源 /play/ 地址编码为可逆内容身份。
      resolveCanonicalResourceContentId(resourceCard, fallbackContentId): string，优先采用资源卡片明确的豆瓣 id，统一搜索与发现内容身份。
      resolveResourceContentUrl(contentId): string，从资源身份恢复并校验同源 /play/ 地址。
      createStableOpaqueId(prefix, value): string，把 Provider 私有定位值转换为稳定不透明身份。
      createCanonicalResourceLocator(value): string，删除当前选集参数并规范线路私有定位值。
      createResourceLineId(playUrl): string，从资源地址生成稳定 PlayCatalogLine.id。
      parseExplicitSeasonNumber(value): number|null，从明确文案读取季号。
      parseExplicitEpisodeNumber(value): number|null，从明确文案读取集号。
      parseResourceDeclaredAvailability(openingTag, cardHtml): boolean|null，读取资源卡片明确可达性。
      parseSearchResourceCards(html, sourceId): Array<object>，解析真实搜索资源卡片。
      parseSearchPagination(html, keyword, page): object，读取源站下一页事实。
      extractResourceSearchUrl(html): string，读取详情页声明的 HTMX 资源入口。
      parseResourceCards(html): Array<object>，解析资源卡片的身份、标题、播放地址、来源和状态事实。
      parseDetailIdentityFacts(html, contentId, resourceSearchUrl): object，解析待匹配详情的精确内容事实。
      isExactResourceCardMatch(resourceCard, targetFacts): boolean，裁决单卡是否属于同一内容。
      filterExactResourceCards(resourceCards, targetFacts): Array<object>，排除不同作品和冲突候选。
      resolveResourceCardContentType(resourceCard): string，从单条资源的类别或状态形成类型事实。
      parseResourceContentType(resourceCards): string，从全部资源事实形成唯一电影或电视剧类型。
      parseResourcePageEpisodeLinks(html): Array<object>，读取资源页私有选集定位值和标签。
      createLogicalPlayCatalogEpisode(label, contentType, poster, playable): object，生成公共逻辑剧集。
      createPlayCatalogEpisodes(episodeLinks, contentType, poster): object，生成逻辑分集和私有请求目标。
      parseResourceLinePage(html, resourceCard, contentType, poster): object，解析单条资源线路和选集。
      createUnavailableResourceLine(resourceCard, contentType, poster): object，保留请求失败线路的安全状态。
      createPlayCatalog(resourceLines): object，投影不含私有定位值的唯一播放目录。
      resolveRequestedPlaybackTarget(resourceLines, params): object，精确选择请求线路和逻辑分集。
      resolveResourcePageContentType(episodeLinks, tags, currentEpisodeLabel): string，从资源页事实形成类型。
      parseResourcePage(html, contentId, sourceId, resourceUrl): object，解析资源页详情、线路和选集。
      parseInformationDetailPoster(html): string，读取信息详情页主海报。
      parseDetail(html, resourceCards, contentId, sourceId, contentType): object，解析详情和多来源播放页。
      parseDirectMedia(html): object|null，解析 source/og:video/initPlayer 直链。
      createLogicalPage(items, params): object，把首页完整卡片集合转换为连续的平台逻辑页。
      createResponse(request, items, item, pagination): object，包装内容响应。
      createFilterResponse(request): object，包装筛选元数据响应。
      createProvider(definition): object，创建独立 Provider。

  - 模块级类:
      无

  - 对外导出:
      sourceManifest: object，供信任前静态预检。
      createProviderFactory(): Function，返回精确 ProviderFactory。
*/

// 类型: object；作用: 声明 Moovie 单文件身份、能力和最小信息请求 host。
export const sourceManifest = Object.freeze({
  schemaVersion: '1.0.0',
  providerApiVersion: '2.0.0',
  id: 'source.com.moovie.c2v2',
  name: 'Moovie',
  description: '通过 Moovie HTML/HTMX 页面提供电影、电视剧和浏览器直连播放地址。',
  authorName: '佚名',
  siteUrl: 'https://moovie.c2v2.com',
  version: '2.3.6',
  providerKey: 'source.com.moovie.c2v2.provider',
  capabilities: {
    home: true,
    movie: true,
    tv: true,
    search: true,
    detail: true,
    play: true
  },
  settingsSchema: [],
  networkHosts: ['moovie.c2v2.com']
});

// 类型: string；作用: 拼接 Moovie discover、详情、资源和播放页信息地址。
const BASE_URL = 'https://moovie.c2v2.com';
// 类型: object；作用: 集中平台允许的内容类型，供目录事实、资源状态和标准 ContentItem 共用。
const CONTENT_TYPE = Object.freeze({ movie: 'movie', tv: 'tv' });
// 类型: object；作用: 冻结 Moovie 发现页四个真实分区，站点路径和分类文案不进入公共前端。
const DISCOVER_SECTION = Object.freeze({
  movie: Object.freeze({ key: 'movie', path: '/discover/movie', type: CONTENT_TYPE.movie, label: '热门电影' }),
  tv: Object.freeze({ key: 'tv', path: '/discover/tv', type: CONTENT_TYPE.tv, label: '热门剧集' }),
  show: Object.freeze({ key: 'show', path: '/discover/show', type: CONTENT_TYPE.tv, label: '热门综艺' }),
  cartoon: Object.freeze({ key: 'cartoon', path: '/discover/cartoon', type: CONTENT_TYPE.tv, label: '日本动画' })
});
// 类型: object；作用: 以从零开始的 offset 和明确 count 冻结首页五桶映射，避免切片下标散落在请求分支。
const HOME_DISCOVER_POLICY = Object.freeze({
  banners: Object.freeze([
    Object.freeze({ sectionKey: 'movie', offset: 0, count: 5 }),
    Object.freeze({ sectionKey: 'tv', offset: 0, count: 5 }),
    Object.freeze({ sectionKey: 'show', offset: 0, count: 5 }),
    Object.freeze({ sectionKey: 'cartoon', offset: 0, count: 5 })
  ]),
  hotMovies: Object.freeze([
    Object.freeze({ sectionKey: 'movie', offset: 5, count: 24 })
  ]),
  movieRanking: Object.freeze([
    Object.freeze({ sectionKey: 'movie', offset: 0, count: 14 })
  ]),
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
// 类型: object；作用: 冻结电视剧目录未筛选时每区六条、总页容量十八条及三个真实分类的唯一 Provider 策略。
const TV_CATALOG_POLICY = Object.freeze({
  itemsPerSection: 6,
  pageSize: 18,
  sectionKeys: Object.freeze(['tv', 'show', 'cartoon'])
});
// 类型: object；作用: 冻结真实资源搜索端点、平台页容量和可逆身份前缀，搜索/详情/播放共用同一协议。
const SEARCH_POLICY = Object.freeze({
  endpoint: '/api/htmx/search',
  pageSize: 12,
  resourceIdPrefix: 'resource:'
});
// 类型: object；作用: 冻结公共线路和逻辑分集身份前缀，避免 URL、数组位置和页面文案成为跨层定位值。
const PLAY_CATALOG_POLICY = Object.freeze({
  lineIdPrefix: 'moovie-line',
  featureEpisodeId: 'feature',
  regularEpisodeIdPrefix: 'episode',
  seasonEpisodeIdPrefix: 'season',
  specialEpisodeIdPrefix: 'special',
  unavailableReason: '线路暂不可用',
  fallbackLineName: '线路'
});
// 类型: object；作用: 集中 64 位 FNV-1a 参数，把 Provider 私有资源定位值转换为稳定且不透明的公共身份。
const STABLE_ID_HASH_POLICY = Object.freeze({
  offsetBasis: 14695981039346656037n,
  prime: 1099511628211n,
  mask: 18446744073709551615n,
  hexLength: 16
});
// 类型: object；作用: 把 Moovie 资源卡片明确提供的类别映射为平台类型，不从标题、简介或播放状态猜测。
const RESOURCE_CONTENT_TYPE_LABEL_PATTERNS = Object.freeze({
  // 类型: RegExp；作用: 识别以“片”、电影或短片表达的电影类别；剧情片不会因包含“剧”字被误判为电视剧。
  movie: /(?:片|电影|短片)$/i,
  // 类型: RegExp；作用: 识别剧集、动漫、综艺和番剧等连续内容类别。
  tv: /(?:剧|剧集|连续剧|动漫|综艺|番剧)$/i
});
// 类型: object；作用: 仅在资源卡片没有可识别明确类别时，使用旧资源状态补充内容类型事实。
const RESOURCE_STATUS_TYPE_PATTERNS = Object.freeze({
  // 类型: RegExp；作用: 识别全剧集数、更新集数和单集编号等连续剧资源状态。
  tv: /(?:全\s*\d+\s*集|更新至\s*(?:第\s*)?\d+\s*集|第\s*\d+\s*集|共\s*\d+\s*集|\d+\s*集全)/i,
  // 类型: RegExp；作用: 识别只表达单部正片或清晰度的电影资源状态；未知状态不会被默认为电影。
  movie: /^(?:正片|高清|(?:HD|BD|TC|TS)(?:高清|国语|粤语|中字)?|抢先版|预告片|4K|1080P|720P)$/i
});
// 类型: object；作用: 定义 HTML 属性和文本允许还原的命名实体；未知实体保持原文，避免猜测浏览器 DOM 行为。
const HTML_NAMED_ENTITIES = Object.freeze({
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"'
});
// 类型: object；作用: Provider 生命周期阶段和业务调用门禁。
const PROVIDER_PHASE = Object.freeze({
  created: 'created',
  initialized: 'initialized',
  running: 'running',
  stopped: 'stopped',
  disposed: 'disposed'
});
// 类型: object；作用: 集中 HTML 请求容量和超时边界。
const REQUEST_POLICY = Object.freeze({ timeoutMs: 15000, maxResponseBytes: 2097152 });

/**
 * 解码 HTML 文本和属性中的命名、十进制及十六进制实体。
 * 纯函数: 不创建 DOM；相同字符串始终返回相同结果。
 * 成功路径: 还原受支持命名实体和合法 Unicode 数字实体。
 * 失败路径: 非字符串返回空字符串；未知名称、代理项或越界码点保留原实体，避免静默损坏源站数据。
 *
 * @param {*} value HTML 文本或属性值候选。
 * @returns {string} 已解码实体的文本。
 */
function decodeHtmlEntities(value) {
  // 条件分支: 候选不是字符串时进入。
  // 执行内容: 返回空字符串，不允许对象隐式转换进入 URL 或内容字段。
  if (typeof value !== 'string') return '';
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z][a-z\d]+));/gi, (entity, decimal, hexadecimal, named) => {
    // 条件分支: 当前匹配是命名实体时进入。
    // 执行内容: 只采用冻结白名单；未知名称保留源文本。
    if (named) return HTML_NAMED_ENTITIES[named.toLowerCase()] ?? entity;
    // 类型: number；作用: 把十进制或十六进制实体转换为待验证 Unicode 码点。
    const codePoint = Number.parseInt(decimal || hexadecimal, decimal ? 10 : 16);
    // 条件分支: 码点不是合法 Unicode 标量值时进入。
    // 执行内容: 保留原实体，防止 String.fromCodePoint 抛错或生成代理项。
    if (!Number.isInteger(codePoint)
      || codePoint < 0
      || codePoint > 0x10FFFF
      || codePoint >= 0xD800 && codePoint <= 0xDFFF) return entity;
    return String.fromCodePoint(codePoint);
  });
}

/**
 * 把 Moovie 原始响应字节解码为 UTF-8 HTML。
 * 纯函数: 只读取 ArrayBuffer，不访问 DOM、网络或 Provider 状态。
 * 成功路径: 返回严格 UTF-8 文本供文件内解析器消费。
 * 失败路径: 非 ArrayBuffer 或非法 UTF-8 抛 Error，禁止兼容平台预解码文本。
 *
 * @param {*} body SourceNetworkResponse.body 候选。
 * @returns {string} Moovie HTML 文本。
 * @throws {Error} 原始字节类型或 UTF-8 编码无效时抛出。
 */
function decodeUtf8Body(body) {
  // 条件分支: Shell 没有交付 ABI 2.0 ArrayBuffer 时进入。
  // 执行内容: 失败关闭，不接收旧 text 响应旁路。
  if (!(body instanceof ArrayBuffer)) throw new Error('Moovie HTML 响应字节无效');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch (error) {
    throw new Error('Moovie HTML 响应无法解码');
  }
}

/**
 * 清理 Moovie HTML 文本。
 * 纯函数: 删除脚本、样式和标签，不创建 DOM 或执行源码。
 * 成功路径: 返回解码后的单行文本。
 * 失败路径: 非字符串返回空字符串。
 *
 * @param {*} value HTML 或属性文本。
 * @returns {string} 纯文本。
 */
function cleanText(value) {
  // 条件分支: 输入不是字符串时进入。
  // 执行内容: 返回空文本，拒绝对象隐式转换。
  if (typeof value !== 'string') return '';
  return decodeHtmlEntities(value
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 读取 HTML 开始标签属性。
 * 纯函数: 只匹配给定标签文本，不跨标签搜索。
 * 成功路径: 返回三种引号形式中的属性值。
 * 失败路径: 属性不存在返回空字符串。
 *
 * @param {string} tag 开始标签文本。
 * @param {string} name 属性名称。
 * @returns {string} 属性值。
 */
function readAttribute(tag, name) {
  // 类型: RegExpMatchArray|null；作用: 保存当前标签目标属性的受限匹配结果。
  const match = String(tag || '').match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  // 返回值类型: string；作用: 属性在交给 URL、标题或 meta 解析前统一还原 HTML 实体，避免 `&#43;` 被 URL 当作片段起点。
  return decodeHtmlEntities(match ? match[1] || match[2] || match[3] || '' : '').trim();
}

/**
 * 读取匹配属性的 meta content。
 * 纯函数: 只扫描 meta 开始标签，不运行脚本或访问 DOM。
 * 成功路径: 返回首个 attributeName/attributeValue 匹配标签的 content。
 * 失败路径: HTML、目标属性或 content 缺失时返回空字符串。
 *
 * @param {*} html Moovie 页面 HTML。
 * @param {string} attributeName name 或 property。
 * @param {string} attributeValue 需要精确匹配的属性值。
 * @returns {string} meta content 或空字符串。
 */
function readMetaContent(html, attributeName, attributeValue) {
  // 类型: Array<string>；作用: 保存页面全部 meta 开始标签，非文本页面使用空数组。
  const metaTags = typeof html === 'string' ? html.match(/<meta\b[^>]*>/gi) || [] : [];
  // 类型: string|undefined；作用: 保存首个目标属性值匹配的 meta 标签。
  const target = metaTags.find(tag => readAttribute(tag, attributeName).toLowerCase() === attributeValue.toLowerCase());
  return target ? readAttribute(target, 'content') : '';
}

/**
 * 规范化同 host HTTPS 地址。
 * 纯函数: 只解析 URL，不发起请求。
 * 成功路径: 允许 Moovie 同 host 绝对/相对 URL。
 * 失败路径: HTTP、凭据、跨 host 或非法 URL 返回空字符串。
 *
 * @param {*} value URL 候选。
 * @returns {string} 安全绝对地址或空字符串。
 */
function absoluteUrl(value) {
  // 类型: string；作用: 保存清理后的 URL 候选。
  const text = typeof value === 'string' ? value.trim() : '';
  // 条件分支: URL 文本为空时进入。
  // 执行内容: 返回空字符串，不猜测目标页。
  if (!text) return '';
  try {
    // 类型: URL；作用: 保存基于站点根地址解析的绝对 URL。
    const parsedUrl = new URL(text, BASE_URL);
    // 条件分支: 协议、凭据或 host 不符合 manifest 边界时进入。
    // 执行内容: 拒绝跨站和不安全地址。
    if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password
      || parsedUrl.host !== new URL(BASE_URL).host) return '';
    return parsedUrl.href;
  } catch (error) {
    return '';
  }
}

/**
 * 限制浏览器直连媒体 URL。
 * 纯函数: 只读取绝对 URL 路径，不使用媒体代理。
 * 成功路径: 返回 HTTPS MP4/HLS 地址。
 * 失败路径: 其他扩展名或非法 URL 返回空字符串。
 *
 * @param {*} value 媒体地址候选。
 * @returns {string} 直连媒体或空字符串。
 */
function normalizeMediaUrl(value) {
  // 类型: string；作用: 保存清理后的媒体 URL 候选。
  const text = typeof value === 'string' ? value.trim() : '';
  // 条件分支: 媒体 URL 为空时进入。
  // 执行内容: 返回空字符串，不生成播放候选。
  if (!text) return '';
  try {
    // 类型: URL；作用: 保存媒体绝对 URL 解析结果。
    const parsedUrl = new URL(text, BASE_URL);
    // 类型: string；作用: 保存小写路径，供 MP4/HLS 扩展名判断。
    const path = parsedUrl.pathname.toLowerCase();
    // 条件分支: 媒体协议、凭据或扩展名不符合直连要求时进入。
    // 执行内容: 返回空字符串，不使用后端媒体代理。
    if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password
      || !path.endsWith('.mp4') && !path.endsWith('.m3u8')) return '';
    return parsedUrl.href;
  } catch (error) {
    return '';
  }
}

/**
 * 解码 Moovie 内联播放器字符串中的 URL 转义。
 * 纯函数: 只还原斜杠、Unicode ampersand 和 HTML ampersand，不执行脚本文本。
 * 成功路径: 返回可交给 normalizeMediaUrl 校验的 URL 文本。
 * 失败路径: 非字符串返回空字符串。
 *
 * @param {*} value initPlayer 第二参数候选。
 * @returns {string} 解码后的 URL 文本。
 */
function decodeScriptUrl(value) {
  // 条件分支: initPlayer 参数不是字符串时进入。
  // 执行内容: 返回空文本，阻止对象隐式转换后进入媒体地址门禁。
  if (typeof value !== 'string') return '';
  return decodeHtmlEntities(value
    .replace(/\\\//g, '/')
    .replace(/\\u0026/gi, '&'))
    .trim();
}

/**
 * 规范化可由页面直接展示的 HTTPS 资源地址。
 * 纯函数: 只校验协议和凭据，不把外部海报主机加入 Provider 的网络权限。
 * 成功路径: 返回无凭据 HTTPS 绝对地址；相对地址仍按 Moovie 主站解析。
 * 失败路径: 空值、HTTP、带凭据或非法 URL 返回空字符串，Provider 不主动请求该地址。
 *
 * @param {*} value 海报或封面地址候选。
 * @returns {string} 可直接展示的 HTTPS 地址或空字符串。
 */
function normalizeAssetUrl(value) {
  // 类型: string；作用: 保存去除首尾空白的资源地址候选。
  const text = typeof value === 'string' ? value.trim() : '';
  // 条件分支: 候选为空时进入；执行内容: 返回空字符串，不制造占位 URL。
  if (!text) return '';
  try {
    // 类型: URL；作用: 同时支持源站相对海报和搜索卡片提供的外部 HTTPS 海报。
    const parsedUrl = new URL(text, BASE_URL);
    // 条件分支: 地址不使用 HTTPS 或携带凭据时进入；执行内容: 拒绝交给页面直接展示。
    if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) return '';
    return parsedUrl.href;
  } catch (error) {
    return '';
  }
}

/**
 * 把 Moovie 同源资源播放地址编码为刷新后仍可恢复的内容身份。
 * 纯函数: 身份只包含经验证的相对 pathname 和 search，不保存临时 Map、页面缓存或 fragment。
 * 成功路径: 返回 resource: 加 encodeURIComponent 后的相对 /play/ 地址。
 * 失败路径: 非同源 HTTPS、非 /play/ 路径或带 fragment 地址返回空字符串。
 *
 * @param {*} value Moovie 资源页绝对或相对地址。
 * @returns {string} 可逆资源内容身份或空字符串。
 */
function createResourceContentId(value) {
  // 类型: string；作用: 先通过同 host HTTPS 门禁，阻止身份封装跨站地址。
  const url = absoluteUrl(value);
  // 条件分支: 地址没有通过同源门禁时进入；执行内容: 返回空身份。
  if (!url) return '';
  // 类型: URL；作用: 检查资源路径和 fragment，再形成稳定相对地址。
  const parsedUrl = new URL(url);
  // 条件分支: 路径不是资源页或包含不会发往服务器的 fragment 时进入；执行内容: 拒绝不可重放身份。
  if (!parsedUrl.pathname.startsWith('/play/') || parsedUrl.hash) return '';
  return `${SEARCH_POLICY.resourceIdPrefix}${encodeURIComponent(`${parsedUrl.pathname}${parsedUrl.search}`)}`;
}

/**
 * 把源站外部内容 id 收敛为正整数字符串。
 * 纯函数: 只接受十进制数字文本，去除允许的前导零；不读取 URL、标题、存储或网络。
 * 成功路径: 至少包含一个非零数字时返回无前导零文本。
 * 失败路径: 空值、全零占位、符号、小数或非数字返回空字符串，调用方必须保留 resource 身份或失败关闭。
 *
 * @param {*} value douban_id、doubanId 或 /movie/ 路径 id 候选。
 * @returns {string} 大于零的规范十进制 id，非法或占位值返回空字符串。
 */
function normalizePositiveExternalId(value) {
  // 类型: string；作用: 只接受源站显式字符串，不把 null、对象或科学计数数字隐式转换为身份。
  const text = typeof value === 'string' ? value.trim() : '';
  // 类型: RegExpMatchArray|null；作用: 允许前导零但要求至少一个非零数字，并捕获规范正整数部分。
  const match = text.match(/^0*([1-9]\d*)$/u);
  return match?.[1] || '';
}

/**
 * 校验并读取规范 db- 内容身份中的正整数。
 * 纯函数: 只接受 `db-` 加无前导零正整数的完整文本，不解析 URL 或兼容非规范别名。
 * 成功路径: 返回 db- 后的正整数字符串。
 * 失败路径: 零值、前导零、非法前后缀或非字符串返回空字符串，阻止同一内容形成多个公共身份。
 *
 * @param {*} value ContentItem.id 或路由 videoId 候选。
 * @returns {string} 规范 db- 身份中的正整数，非法时为空字符串。
 */
function parseDatabaseContentId(value) {
  // 类型: string；作用: 只接受完整字符串身份，不把数字或对象隐式转换为路由 id。
  const text = typeof value === 'string' ? value : '';
  // 类型: string；作用: 从严格 db-数字外壳读取原始数字，其他前后缀不会进入规范化。
  const rawId = /^db-(\d+)$/u.exec(text)?.[1] || '';
  // 类型: string；作用: 排除零占位并去除候选前导零，用于反查文本是否已经规范。
  const normalizedId = normalizePositiveExternalId(rawId);
  return normalizedId && text === `db-${normalizedId}` ? normalizedId : '';
}

/**
 * 从资源卡片的明确外部 id 形成当前内容的规范身份。
 * 纯函数: 只读取 Provider 已解析的 externalId 和旧资源身份，不解析页面、不访问网络。
 * 成功路径: externalId 是正整数时返回 db- 身份，使搜索、发现、详情和播放共用同一内容键。
 * 失败路径: 外部 id 缺失或不是正整数时保留可逆资源身份，保证无外部 id 的资源仍可独立打开。
 *
 * @param {object} resourceCard Provider 解析出的资源卡片事实。
 * @param {string} resourceCard.externalId 源站明确的外部内容 id。
 * @param {string} fallbackContentId 无外部 id 时使用的可逆资源身份。
 * @returns {string} 规范内容身份或可逆资源身份。
 */
function resolveCanonicalResourceContentId(resourceCard, fallbackContentId) {
  // 类型: string；作用: 只采用资源 URL 明确提供的数字外部 id，不从标题、路径名称或数组位置猜测。
  const externalId = normalizePositiveExternalId(resourceCard?.externalId);
  // 条件分支: 外部 id 是正整数时进入；执行内容: 生成与 discover 卡片相同的 db- 内容身份。
  if (externalId) return `db-${externalId}`;
  // 返回值类型: string；作用: 无法形成规范外部身份时保留可刷新资源入口身份。
  return typeof fallbackContentId === 'string' ? fallbackContentId : '';
}

/**
 * 从可逆内容身份恢复 Moovie 同源资源页地址。
 * 纯函数: 解码后再次执行 HTTPS、host、路径和 fragment 校验，不信任路由或持久化中的旧文本。
 * 成功路径: 返回规范化的同源 /play/ 绝对地址。
 * 失败路径: 前缀、百分号编码、协议、host、路径或 fragment 无效时返回空字符串。
 *
 * @param {*} contentId ContentItem.id 或路由 videoId 候选。
 * @returns {string} 经验证的 Moovie 资源页绝对地址或空字符串。
 */
function resolveResourceContentUrl(contentId) {
  // 类型: string；作用: 只接受当前 Provider 声明的资源身份前缀。
  const text = typeof contentId === 'string' ? contentId : '';
  // 条件分支: 身份没有资源前缀时进入；执行内容: 返回空地址，由 db- 链或调用方继续处理。
  if (!text.startsWith(SEARCH_POLICY.resourceIdPrefix)) return '';
  try {
    // 类型: string；作用: 恢复创建身份时保存的相对 pathname 和 search。
    const relativeUrl = decodeURIComponent(text.slice(SEARCH_POLICY.resourceIdPrefix.length));
    // 类型: string；作用: 使用统一同源门禁生成绝对 URL。
    const url = absoluteUrl(relativeUrl);
    // 条件分支: 解码文本越界或不属于 /play/ 资源路径时进入；执行内容: 拒绝向 Shell 提交请求。
    if (!url) return '';
    // 类型: URL；作用: 对规范化结果执行最后的路径和 fragment 校验。
    const parsedUrl = new URL(url);
    // 条件分支: 规范化地址不再属于 /play/ 或含 fragment 时进入；执行内容: 返回空地址并阻止网络请求。
    if (!parsedUrl.pathname.startsWith('/play/') || parsedUrl.hash) return '';
    return parsedUrl.href;
  } catch (error) {
    return '';
  }
}

/**
 * 把 Provider 私有字符串转换为稳定不透明身份。
 * 纯函数: 使用冻结 64 位 FNV-1a 参数逐 UTF-16 码元计算，不访问 Web Crypto、存储或网络。
 * 成功路径: 相同前缀和输入始终返回相同十六进制身份，公共层无法从结果恢复资源 URL。
 * 失败路径: 前缀或输入为空时抛 Error，禁止生成所有线路共享的空身份。
 *
 * @param {string} prefix 公共身份类型前缀。
 * @param {string} value Provider 私有稳定定位值。
 * @returns {string} 稳定不透明身份。
 * @throws {Error} 身份输入不完整时抛出。
 */
function createStableOpaqueId(prefix, value) {
  // 条件分支: 前缀或私有定位值为空时进入；执行内容: 失败关闭，不制造可碰撞的空身份。
  if (typeof prefix !== 'string' || !prefix || typeof value !== 'string' || !value) {
    throw new Error('Moovie 稳定身份输入无效');
  }
  // 类型: bigint；作用: 保存当前 64 位 FNV-1a 哈希状态，仅用于不透明身份，不承担安全摘要职责。
  let hash = STABLE_ID_HASH_POLICY.offsetBasis;
  // 循环类型: for；初始值: 私有字符串首个 UTF-16 码元；终止条件: 全部码元已参与；作用: 形成跨刷新确定性结果。
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * STABLE_ID_HASH_POLICY.prime & STABLE_ID_HASH_POLICY.mask);
  }
  return `${prefix}-${hash.toString(16).padStart(STABLE_ID_HASH_POLICY.hexLength, '0')}`;
}

/**
 * 规范 Moovie 资源地址中决定线路身份的私有部分。
 * 纯函数: 保留已验证 pathname 和稳定查询字段，删除只表示当前选集的 source/ep 参数并按键值排序。
 * 成功路径: 同一资源线路的不同选集地址返回相同私有规范值。
 * 失败路径: 非同源 /play/ 地址返回空字符串，不进入线路身份生成。
 *
 * @param {*} value 资源卡片或选集地址候选。
 * @returns {string} 只在 Provider 内使用的规范资源定位值。
 */
function createCanonicalResourceLocator(value) {
  // 类型: string；作用: 先复用同源 HTTPS 门禁，拒绝跨站和非法 URL。
  const url = absoluteUrl(value);
  // 条件分支: 地址无效或不是 /play/ 资源页时进入；执行内容: 返回空私有定位值。
  if (!url || !new URL(url).pathname.startsWith('/play/')) return '';
  // 类型: URL；作用: 创建隔离副本，删除只影响当前选集的瞬时查询字段。
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.delete('source');
  parsedUrl.searchParams.delete('ep');
  // 类型: Array<Array<string>>；作用: 稳定查询参数顺序，避免同一资源因 URL 参数排序不同生成不同线路身份。
  const orderedEntries = [...parsedUrl.searchParams.entries()].sort(([leftName, leftValue], [rightName, rightValue]) => {
    return leftName.localeCompare(rightName) || leftValue.localeCompare(rightValue);
  });
  // 类型: URLSearchParams；作用: 重建规范查询集合，不保留原始插入顺序。
  const orderedSearch = new URLSearchParams();
  orderedEntries.forEach(([name, entryValue]) => orderedSearch.append(name, entryValue));
  // 类型: string；作用: 只在 Provider 内组合路径和规范查询，不写入 ContentItem 或路由。
  const search = orderedSearch.toString();
  return `${parsedUrl.pathname}${search ? `?${search}` : ''}`;
}

/**
 * 从 Moovie 资源地址生成公共线路身份。
 * 纯函数: 先规范私有定位值，再只交付不可逆哈希身份。
 * 成功路径: 同一资源线路跨详情和 player 请求保持相同 id。
 * 失败路径: 地址不满足资源门禁时抛 Error，禁止按数组位置生成 source-1 一类身份。
 *
 * @param {*} playUrl 资源线路地址。
 * @returns {string} PlayCatalogLine.id。
 * @throws {Error} 私有定位值无效时抛出。
 */
function createResourceLineId(playUrl) {
  // 类型: string；作用: 保存不含当前选集参数的 Provider 私有线路定位值。
  const locator = createCanonicalResourceLocator(playUrl);
  // 条件分支: 线路定位值为空时进入；执行内容: 失败关闭，不按资源顺序补号。
  if (!locator) throw new Error('Moovie 线路身份无法生成');
  return createStableOpaqueId(PLAY_CATALOG_POLICY.lineIdPrefix, locator);
}

/**
 * 从明确季数文案读取季号。
 * 纯函数: 只接受“第 N 季”、Season N 或 SNN 形式，不从数组位置和年份猜测。
 * 成功路径: 返回正整数季号。
 * 失败路径: 无明确季号返回 null。
 *
 * @param {*} value 标题、标签或详情文本候选。
 * @returns {number|null} 明确季号或 null。
 */
function parseExplicitSeasonNumber(value) {
  // 类型: string；作用: 规范待识别文案，空文本直接形成未知季号。
  const text = cleanText(value);
  // 类型: RegExpMatchArray|null；作用: 依次接受中文、英文全称和独立 S 前缀季号。
  const match = text.match(/第\s*0*(\d+)\s*季/iu)
    || text.match(/\bSeason\s*0*(\d+)\b/iu)
    || text.match(/\bS0*(\d+)(?:\b|E\d+)/iu);
  // 类型: number；作用: 把明确文本转换为待验证正整数。
  const seasonNumber = match ? Number.parseInt(match[1], 10) : Number.NaN;
  return Number.isSafeInteger(seasonNumber) && seasonNumber > 0 ? seasonNumber : null;
}

/**
 * 从明确分集文案读取集号。
 * 纯函数: 只接受“第 N 集”、Episode/EP N 或 SxxExx 形式，不接受列表序号。
 * 成功路径: 返回正整数集号。
 * 失败路径: 电影质量、正片、特辑或未知文本返回 null。
 *
 * @param {*} value 选集标签候选。
 * @returns {number|null} 明确集号或 null。
 */
function parseExplicitEpisodeNumber(value) {
  // 类型: string；作用: 规范待识别选集文案。
  const text = cleanText(value);
  // 类型: RegExpMatchArray|null；作用: 只采用具备显式剧集语义的三组格式。
  const match = text.match(/第\s*0*(\d+)\s*集/iu)
    || text.match(/\b(?:Episode|EP)\s*0*(\d+)\b/iu)
    || text.match(/\bS\d+E0*(\d+)\b/iu);
  // 类型: number；作用: 把明确文本转换为待验证正整数。
  const episodeNumber = match ? Number.parseInt(match[1], 10) : Number.NaN;
  return Number.isSafeInteger(episodeNumber) && episodeNumber > 0 ? episodeNumber : null;
}

/**
 * 读取资源卡片声明的可达性。
 * 纯函数: 只接受 data-available、status-dot/resource-status 的明确在线或离线事实；普通 active 样式不参与。
 * 成功路径: 返回 true 或 false。
 * 失败路径: 页面没有明确状态时返回 null，后续以线路页能否成功解析为最终可用事实。
 *
 * @param {*} openingTag 资源卡片开始标签。
 * @param {*} cardHtml 资源卡片内部 HTML。
 * @returns {boolean|null} 声明可达性或 null。
 */
function parseResourceDeclaredAvailability(openingTag, cardHtml) {
  // 类型: string；作用: 优先读取机器可判定的 data-available 值。
  const dataAvailable = readAttribute(openingTag, 'data-available').toLowerCase();
  // 条件分支: 卡片明确声明可用时进入；执行内容: 返回可用事实，不再检查展示样式。
  if (dataAvailable === 'true') return true;
  // 条件分支: 卡片明确声明不可用时进入；执行内容: 返回不可用事实，线路仍会保留。
  if (dataAvailable === 'false') return false;
  // 类型: string；作用: 只截取带 status-dot 或 resource-status 的状态元素，避免整卡片“active”样式误判。
  const statusElement = String(cardHtml || '').match(/<[^>]*class\s*=\s*["'][^"']*(?:status-dot|resource-status)[^"']*["'][^>]*>[\s\S]*?<\//i)?.[0]
    || String(cardHtml || '').match(/<[^>]*class\s*=\s*["'][^"']*status-dot[^"']*["'][^>]*>/i)?.[0]
    || '';
  // 类型: string；作用: 合并状态元素 class 和文本，只在明确词集合中裁决。
  const statusFacts = `${readAttribute(statusElement, 'class')} ${cleanText(statusElement)}`.toLowerCase();
  // 条件分支: 状态元素明确表达离线、错误或不可用时进入；执行内容: 返回不可用事实。
  if (/(?:offline|unavailable|unreachable|failed|error|不可用|失效|离线)/iu.test(statusFacts)) return false;
  // 条件分支: 状态元素明确表达在线、成功或可用时进入；执行内容: 返回可用事实。
  if (/(?:online|available|reachable|success|可用|在线)/iu.test(statusFacts)) return true;
  return null;
}

/**
 * 从 Moovie 详情链接形成 db- 内容身份。
 * 纯函数: 只接受 /movie/数字或 doubanId 查询参数。
 * 成功路径: 返回 db-数字。
 * 失败路径: 没有可信数字 id 返回空字符串。
 *
 * @param {*} value 详情链接。
 * @returns {string} db- 内容身份或空字符串。
 */
function parseMoovieId(value) {
  // 类型: string；作用: 保存通过同 host HTTPS 门禁的详情 URL。
  const url = absoluteUrl(value);
  // 条件分支: 详情 URL 无效时进入。
  // 执行内容: 返回空身份。
  if (!url) return '';
  // 类型: URL；作用: 保存详情地址的查询和路径字段。
  const parsedUrl = new URL(url);
  // 类型: string|null；作用: 保存查询参数中的豆瓣 id。
  const queryId = parsedUrl.searchParams.get('doubanId');
  // 类型: string；作用: 保存 /movie/ 路径中的数字 id。
  const pathId = parsedUrl.pathname.match(/^\/movie\/(\d+)/i)?.[1] || '';
  // 类型: string；作用: 查询参数只有正整数时优先；零占位或非法值不会遮蔽路径中的有效正整数。
  const id = normalizePositiveExternalId(queryId) || normalizePositiveExternalId(pathId);
  return id ? `db-${id}` : '';
}

/**
 * 从 discover/search HTML 提取不含类型猜测的卡片事实。
 * 纯函数: 只扫描 href、图片和文本，不创建 ContentItem 或解释页面分类。
 * 成功路径: 按 db- 身份去重后返回标题、海报、评分、状态和内容身份。
 * 失败路径: 无可信豆瓣 id 或标题时跳过卡片；空正文返回空数组。
 *
 * @param {*} html 页面 HTML/HTMX 片段。
 * @returns {Array<object>} 卡片事实列表。
 */
function parseCardCandidates(html) {
  // 类型: string；作用: 保存列表 HTML/HTMX 片段。
  const source = typeof html === 'string' ? html : '';
  // 类型: Array<object>；作用: 收集尚未绑定 movie/tv 的卡片事实，搜索分支必须先取得外部类型事实。
  const candidates = [];
  // 类型: Set<string>；作用: 按 db- 身份去重并保持首次顺序。
  const seen = new Set();
  // 类型: RegExp；作用: 扫描卡片详情链接和内部展示内容。
  const pattern = /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前扫描匹配。
  let match;
  while ((match = pattern.exec(source)) !== null) {
    // 类型: string；作用: 保存当前卡片链接。
    const href = match[1] || match[2] || '';
    // 类型: string；作用: 把链接转换为 db- 内容身份。
    const id = parseMoovieId(href);
    // 条件分支: 身份无效或已经处理时进入。
    // 执行内容: 跳过当前链接并继续扫描。
    if (!id || seen.has(id)) continue;
    // 类型: string；作用: 保存卡片内部 HTML。
    const inner = match[3] || '';
    // 类型: string；作用: 保存卡片图片标签。
    const image = inner.match(/<img\b[^>]*>/i)?.[0] || '';
    // 类型: string；作用: 按图片 alt、链接 title、纯文本优先级形成标题。
    const title = readAttribute(image, 'alt') || readAttribute(match[0], 'title') || cleanText(inner);
    // 条件分支: 标题为空时进入。
    // 执行内容: 跳过不可渲染卡片。
    if (!title) continue;
    seen.add(id);
    // 类型: string；作用: 保存同 host HTTPS 封面地址。
    const poster = absoluteUrl(readAttribute(image, 'data-src') || readAttribute(image, 'src'));
    // 类型: string；作用: 保存卡片明确评分文本，缺失时保持空字符串。
    const scoreText = cleanText(inner.match(/<[^>]*class\s*=\s*["'][^"']*movie-rating[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] || '');
    // 类型: number|null；作用: 只采用 0..10 的有限评分，避免异常文本进入标准 score。
    const numericScore = Number.parseFloat(scoreText);
    // 类型: string；作用: 保存发现页卡片明确状态，例如集数；电影分区没有状态时为空。
    const badge = cleanText(inner.match(/<[^>]*class\s*=\s*["'][^"']*card-badge[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] || '');
    candidates.push({
      id,
      title,
      poster,
      score: Number.isFinite(numericScore) && numericScore >= 0 && numericScore <= 10 ? numericScore : null,
      badge
    });
  }
  return candidates;
}

/**
 * 使用已经确认的内容类型构造标准 Moovie 卡片。
 * 纯函数: 只读取隔离卡片事实、sourceId 和类型，不访问 HTML、网络或 Provider 状态。
 * 成功路径: 返回具备四个必填字段及完整空值边界的 ContentItem。
 * 失败路径: 候选缺少身份/标题或类型不是 movie/tv 时抛 Error，禁止未知类型进入页面。
 *
 * @param {object} candidate 卡片事实。
 * @param {string} candidate.id db- 内容身份。
 * @param {string} candidate.title 卡片标题。
 * @param {string} candidate.poster 同 host 海报地址或空字符串。
 * @param {string} sourceId 当前 Provider 身份。
 * @param {object} section DISCOVER_SECTION 中已确认的发现页分区。
 * @returns {object} 标准 ContentItem。
 * @throws {Error} 卡片事实或类型不满足必填契约时抛出。
 */
function createCardContentItem(candidate, sourceId, section) {
  // 类型: string；作用: 从冻结分区取得平台 movie/tv 类型，卡片标题和状态不得覆盖分区事实。
  const type = section?.type;
  // 条件分支: 卡片事实或平台类型不完整时进入。
  // 执行内容: 失败关闭，不用电影默认值填补未知搜索类型。
  if (!candidate || typeof candidate.id !== 'string' || !candidate.id
    || typeof candidate.title !== 'string' || !candidate.title
    || !Object.values(CONTENT_TYPE).includes(type)) throw new Error('Moovie 卡片事实无法构造');
  return {
    id: candidate.id,
    sourceId,
    sourceName: sourceManifest.name,
    type,
    title: candidate.title,
    originalTitle: '',
    aliases: [],
    poster: candidate.poster,
    cover: candidate.poster,
    description: '',
    year: '',
    area: '',
    language: '',
    // 类型: Array<string>；作用: 电视剧把 Provider 已确认的源站导航名称交付为卡片元信息，电影不把推荐分区误作影片题材。
    genres: type === CONTENT_TYPE.tv && section?.label ? [section.label] : [],
    tags: section?.label ? [section.label] : [],
    displayTags: [],
    score: candidate.score,
    quality: '',
    rank: null,
    badge: candidate.badge,
    detail: null,
    movie: { duration: '' },
    tv: {
      totalEpisodes: null,
      latestEpisode: null,
      updateStatus: type === CONTENT_TYPE.tv ? candidate.badge : '',
      season: ''
    },
    playCatalog: null,
    playback: null,
    source: {
      name: sourceManifest.name,
      domain: 'moovie.c2v2.com',
      rawId: candidate.id,
      sourceDetailUrl: `${BASE_URL}/movie/${candidate.id.slice(3)}`,
      rawData: null,
      fetchedAt: ''
    }
  };
}

/**
 * 解析已经由页面目录明确分类的 discover 卡片。
 * 纯函数: 目录 pageKey 是 movie/tv 权威事实；本函数不读取卡片文案推断类型。
 * 成功路径: 返回去重后的标准 ContentItem 列表。
 * 失败路径: 非 movie/tv 页面类型由 createCardContentItem 失败关闭。
 *
 * @param {*} html discover 页面 HTML。
 * @param {string} sourceId 当前 Provider 身份。
 * @param {object} section DISCOVER_SECTION 中当前源站分区。
 * @returns {Array<object>} 标准内容列表。
 */
function parseCards(html, sourceId, section) {
  return parseCardCandidates(html).map(candidate => createCardContentItem(candidate, sourceId, section));
}

/**
 * 提取首页策略需要请求的唯一发现页分区。
 * 纯函数: 保留策略首次出现顺序，不修改冻结切片。
 * 成功路径: 返回 DISCOVER_SECTION 中存在的去重键。
 * 失败路径: 非数组或未知分区抛 Error，阻止半完成首页映射。
 *
 * @param {*} policy HOME_DISCOVER_POLICY 中一个模块的切片数组。
 * @returns {Array<string>} 唯一分区键。
 */
function collectPolicySectionKeys(policy) {
  // 条件分支: 策略不是非空数组时进入；执行内容: 拒绝没有任何来源的首页模块。
  if (!Array.isArray(policy) || policy.length === 0) throw new Error('Moovie 首页映射策略无效');
  // 类型: Array<string>；作用: 按映射首次出现顺序保存唯一分区。
  const sectionKeys = [...new Set(policy.map(slice => slice?.sectionKey))];
  // 条件分支: 任一键不属于冻结分区时进入；执行内容: 拒绝请求未知站点路径。
  if (sectionKeys.some(sectionKey => !DISCOVER_SECTION[sectionKey])) throw new Error('Moovie 首页映射分区无效');
  return sectionKeys;
}

/**
 * 按具名切片合并首页数据桶。
 * 纯函数: 只读取分区列表和冻结策略，返回新的条目数组。
 * 成功路径: 按策略顺序连接各分区指定范围；排行榜重新生成连续 rank。
 * 失败路径: 分区缺失或切片边界无效时抛 Error，避免静默缩成其他模块。
 *
 * @param {object} itemsBySection 已解析分区条目映射。
 * @param {Array<object>} policy 首页模块切片策略。
 * @param {boolean} ranked 是否生成从一开始的排行榜名次。
 * @returns {Array<object>} 当前首页模块完整候选集合。
 */
function createPolicyItems(itemsBySection, policy, ranked = false) {
  // 类型: Array<object>；作用: 按策略顺序连接每个具名切片，保持各分区源站顺序。
  const items = policy.flatMap((slice) => {
    // 类型: Array<object>|undefined；作用: 读取当前具名分区的完整发现页集合。
    const sectionItems = itemsBySection?.[slice.sectionKey];
    // 条件分支: 分区结果或切片边界无效时进入；执行内容: 拒绝生成不完整模块。
    if (!Array.isArray(sectionItems)
      || !Number.isSafeInteger(slice.offset) || slice.offset < 0
      || !Number.isSafeInteger(slice.count) || slice.count < 1) {
      throw new Error('Moovie 首页映射切片无效');
    }
    return sectionItems.slice(slice.offset, slice.offset + slice.count);
  });
  return ranked
    ? items.map((item, index) => ({ ...item, rank: index + 1 }))
    : items;
}

/**
 * 生成电视剧三个分区各六条的混合逻辑页。
 * 纯函数: 每页对三个分区使用相同连续窗口，保持分区顺序和分区内源站顺序。
 * 成功路径: 返回最多十八条内容、150 条当前快照总量和按最长分区计算的总页数。
 * 失败路径: pageSize 不是正式十八条或任一分区缺失时抛 Error。
 *
 * @param {object} itemsBySection 三个电视剧分区的解析集合。
 * @param {*} params SourceDataRequest.params。
 * @returns {object} 当前混合页 items 和 pagination。
 */
function createMixedTvPage(itemsBySection, params) {
  // 类型: number；作用: 非法页码收敛到第一页，和其他 Provider 逻辑页语义一致。
  const page = Number.isSafeInteger(params?.page) && params.page > 0 ? params.page : 1;
  // 类型: number；作用: 读取平台电视剧目录正式容量，防止返回条数超过请求 pageSize。
  const pageSize = Number.isSafeInteger(params?.pageSize) && params.pageSize > 0
    ? params.pageSize
    : TV_CATALOG_POLICY.pageSize;
  // 条件分支: 平台容量偏离三个分区各六条的冻结映射时进入；执行内容: 明确拒绝而不是按比例猜测。
  if (pageSize !== TV_CATALOG_POLICY.pageSize) throw new Error('Moovie 电视剧混合页容量无效');
  // 类型: number；作用: 计算三个分区共用的连续起点。
  const sectionStartIndex = (page - 1) * TV_CATALOG_POLICY.itemsPerSection;
  // 类型: Array<object>；作用: 按热门剧集、热门综艺、日本动画顺序连接当前页窗口。
  const items = TV_CATALOG_POLICY.sectionKeys.flatMap((sectionKey) => {
    // 类型: Array<object>|undefined；作用: 读取当前电视剧分区的完整解析集合。
    const sectionItems = itemsBySection?.[sectionKey];
    // 条件分支: 当前电视剧分区缺失时进入；执行内容: 拒绝交付不完整混合页。
    if (!Array.isArray(sectionItems)) throw new Error('Moovie 电视剧混合页分区缺失');
    return sectionItems.slice(sectionStartIndex, sectionStartIndex + TV_CATALOG_POLICY.itemsPerSection);
  });
  // 类型: Array<number>；作用: 保存各分区长度，计算混合页数和当前快照总量。
  const sectionLengths = TV_CATALOG_POLICY.sectionKeys.map(sectionKey => itemsBySection[sectionKey].length);
  // 类型: number；作用: 最长分区决定是否还有下一组同位置窗口。
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
 * 读取首个包含目标 class 的 HTML 元素正文文本。
 * 纯函数: 只处理同名开始/结束标签，不创建 DOM 或执行页面脚本。
 * 成功路径: 返回首个目标元素清洗后的文本。
 * 失败路径: 输入、class 或元素缺失时返回空字符串。
 *
 * @param {*} html HTML 片段候选。
 * @param {string} className 需要匹配的单个 class 名称。
 * @returns {string} 目标元素纯文本或空字符串。
 */
function readClassText(html, className) {
  // 条件分支: HTML 或 class 名称无效时进入；执行内容: 返回空文本，不构造动态正则。
  if (typeof html !== 'string' || typeof className !== 'string' || !className) return '';
  // 类型: RegExp；作用: 只扫描开始标签，让嵌套外层元素不会吞掉内部目标 class。
  const pattern = /<([a-z][\w-]*)\b[^>]*>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前开始标签匹配。
  let match;
  while ((match = pattern.exec(html)) !== null) {
    // 类型: Array<string>；作用: 读取开始标签 class 并按空白拆分，避免子串误命中。
    const classNames = readAttribute(match[0], 'class').split(/\s+/).filter(Boolean);
    // 条件分支: 当前元素不包含目标 class 时进入；执行内容: 继续扫描内部或后续开始标签。
    if (!classNames.includes(className)) continue;
    // 类型: number；作用: 定位当前目标标签的首个同名结束标签；目标字段自身不允许嵌套同名标签。
    const closingIndex = html.toLowerCase().indexOf(`</${match[1].toLowerCase()}>`, pattern.lastIndex);
    // 条件分支: 目标开始标签没有结束标签时进入；执行内容: 返回空文本，不跨越文档边界。
    if (closingIndex < 0) return '';
    return cleanText(html.slice(pattern.lastIndex, closingIndex));
  }
  return '';
}

/**
 * 读取全部包含目标 class 的 HTML 元素文本。
 * 纯函数: 保持源站顺序，不去重、不创建 DOM 或执行脚本。
 * 成功路径: 返回全部非空清洗文本。
 * 失败路径: 输入或 class 无效时返回空数组。
 *
 * @param {*} html HTML 片段候选。
 * @param {string} className 需要匹配的单个 class 名称。
 * @returns {Array<string>} 按文档顺序排列的元素文本。
 */
function readClassTexts(html, className) {
  // 条件分支: HTML 或 class 名称无效时进入；执行内容: 返回独立空数组。
  if (typeof html !== 'string' || typeof className !== 'string' || !className) return [];
  // 类型: Array<string>；作用: 保存源站顺序中的全部非空目标文本。
  const values = [];
  // 类型: RegExp；作用: 只扫描开始标签，外层嵌套不会阻断内部目标字段。
  const pattern = /<([a-z][\w-]*)\b[^>]*>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前开始标签匹配。
  let match;
  while ((match = pattern.exec(html)) !== null) {
    // 类型: Array<string>；作用: 保存当前开始标签的独立 class token。
    const classNames = readAttribute(match[0], 'class').split(/\s+/).filter(Boolean);
    // 条件分支: 当前元素不包含目标 class 时进入；执行内容: 继续扫描后续元素。
    if (!classNames.includes(className)) continue;
    // 类型: number；作用: 定位目标字段的同名结束标签；当前字段自身不允许嵌套同名标签。
    const closingIndex = html.toLowerCase().indexOf(`</${match[1].toLowerCase()}>`, pattern.lastIndex);
    // 条件分支: 目标字段没有结束标签时进入；执行内容: 忽略当前残缺字段并继续扫描。
    if (closingIndex < 0) continue;
    // 类型: string；作用: 保存当前元素清洗后的可展示文本。
    const value = cleanText(html.slice(pattern.lastIndex, closingIndex));
    // 条件分支: 文本非空时进入；执行内容: 按源站顺序追加，不去重。
    if (value) values.push(value);
  }
  return values;
}

/**
 * 拆分 Moovie 导演和主演文本。
 * 纯函数: 只按源站使用的斜杠、中文/英文逗号分隔并清理空项。
 * 成功路径: 返回保持原顺序的人名数组。
 * 失败路径: 空文本返回空数组。
 *
 * @param {*} value 人员字段文本。
 * @returns {Array<string>} 人名列表。
 */
function splitPeople(value) {
  return cleanText(value)
    .replace(/^(?:导演|主演)\s*[:：]\s*/u, '')
    .split(/\s*[/,，]\s*/u)
    .map(item => item.trim())
    .filter(Boolean);
}

/**
 * 构造 Moovie 真实资源搜索地址。
 * 纯函数: 使用 URLSearchParams 固定 kw、空 year 和正整数 page，不手写查询字符串转义。
 * 成功路径: 返回同源 /api/htmx/search 绝对地址。
 * 失败路径: 空关键词或非法页码抛 Error，阻止无效搜索进入 Shell。
 *
 * @param {string} keyword 已清理关键词。
 * @param {number} page 正整数源站页码。
 * @returns {string} 真实搜索 HTMX 地址。
 * @throws {Error} 搜索参数无效时抛出。
 */
function createSearchUrl(keyword, page) {
  // 条件分支: 关键词为空或页码无效时进入；执行内容: 拒绝构造部分查询。
  if (typeof keyword !== 'string' || !keyword || !Number.isSafeInteger(page) || page < 1) {
    throw new Error('Moovie 搜索参数无效');
  }
  // 类型: URL；作用: 保存固定搜索端点并通过标准 API 编码查询字段。
  const url = new URL(SEARCH_POLICY.endpoint, BASE_URL);
  url.searchParams.set('kw', keyword);
  url.searchParams.set('year', '');
  url.searchParams.set('page', String(page));
  return url.href;
}

/**
 * 解析 Moovie 真实搜索页中的独立资源卡片。
 * 纯函数: 每个 .search-result-card 独立形成 ContentItem，不按标题或豆瓣 id 合并。
 * 成功路径: 返回具备可逆 resource 身份、标题、海报、年份、地区、类别、演员和状态的标准列表。
 * 失败路径: 地址、身份、标题或类型事实不完整的单卡被跳过；其他合法卡片继续交付。
 *
 * @param {*} html /api/htmx/search 返回的 HTML。
 * @param {string} sourceId 当前 Provider 身份。
 * @returns {Array<object>} 独立资源 ContentItem 列表。
 */
function parseSearchResourceCards(html, sourceId) {
  // 类型: string；作用: 保存搜索 HTMX 文本，非字符串输入按空结果处理。
  const source = typeof html === 'string' ? html : '';
  // 类型: Array<object>；作用: 按源站卡片顺序保存标准搜索内容，不做跨资源去重。
  const items = [];
  // 类型: RegExp；作用: 搜索卡片自身是完整 anchor，内部不包含其他 anchor，可安全隔离每张资源卡片。
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前搜索卡片匹配。
  let match;
  while ((match = pattern.exec(source)) !== null) {
    // 类型: string；作用: 重建当前 anchor 开始标签，供属性读取器使用。
    const openingTag = `<a${match[1]}>`;
    // 类型: Array<string>；作用: 保存当前 anchor 的独立 class token。
    const classNames = readAttribute(openingTag, 'class').split(/\s+/).filter(Boolean);
    // 条件分支: 当前链接不是搜索资源卡片时进入；执行内容: 跳过分页、导航和广告链接。
    if (!classNames.includes('search-result-card')) continue;
    // 类型: string；作用: 保存通过同源 /play/ 门禁的资源地址。
    const playUrl = absoluteUrl(readAttribute(openingTag, 'href'));
    // 类型: string；作用: 保存资源地址编码后的后备身份；有明确外部 id 时稍后升级为规范 db- 身份。
    const resourceContentId = createResourceContentId(playUrl);
    // 类型: string；作用: 保存当前卡片正文，后续字段只在该卡片范围内读取。
    const inner = match[2] || '';
    // 类型: string；作用: 优先采用明确 card-title，图片 alt 只作为同卡后备。
    const image = inner.match(/<img\b[^>]*>/i)?.[0] || '';
    // 类型: string；作用: 保存搜索资源标题。
    const title = readClassText(inner, 'card-title') || readAttribute(image, 'alt');
    // 类型: string；作用: 保存源站明确内容类别，后续只由类别和状态形成平台类型。
    const contentTypeLabel = readClassText(inner, 'card-type');
    // 类型: string；作用: 保存源站资源状态或质量，例如全 16 集、完结、HD。
    const badge = readClassText(inner, 'card-badge') || readClassText(inner, 'card-remarks');
    // 类型: string；作用: 保存当前资源内部提供方名称，只进入 Provider 追踪字段和详情标签。
    const resourceSourceName = readClassText(inner, 'source-item');
    // 类型: string；作用: 优先读取资源地址明确携带的外部内容 id，供搜索卡片与发现卡片共用内容身份。
    const parsedPlayUrl = playUrl ? new URL(playUrl) : null;
    // 类型: string；作用: 从已验证资源 URL 读取明确数字外部 id，缺失时保留空值供资源身份后备。
    const externalId = parsedPlayUrl?.searchParams.get('douban_id')
      || parsedPlayUrl?.searchParams.get('doubanId')
      || '';
    // 类型: string；作用: 让同一内容的搜索结果不再因资源页地址不同而生成第二条用户内容身份。
    const id = resolveCanonicalResourceContentId({ externalId }, resourceContentId);
    // 类型: string；作用: 根据明确类别或状态形成 movie/tv；空值表示事实不足。
    const type = resolveResourceCardContentType({ contentTypeLabel, badge });
    // 条件分支: 身份、标题或类型不完整时进入；执行内容: 跳过不可满足 ContentItem 最小契约的单卡。
    if (!id || !title || !type) continue;
    // 类型: string；作用: 保存可由页面直接展示的外部 HTTPS 海报，不扩大 Provider 网络 host。
    const poster = normalizeAssetUrl(readAttribute(image, 'data-src') || readAttribute(image, 'src'));
    // 类型: string；作用: 保存源站卡片明确年份。
    const year = readClassText(inner, 'card-year');
    // 类型: string；作用: 保存源站卡片明确地区。
    const area = readClassText(inner, 'card-region');
    // 类型: Array<string>；作用: 保存卡片主演事实，详情页重新请求资源时可获得更新后的完整字段。
    const actors = splitPeople(readClassText(inner, 'card-director'));
    items.push({
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
      year,
      area,
      language: '',
      genres: contentTypeLabel ? [contentTypeLabel] : [],
      tags: [],
      displayTags: [],
      score: null,
      quality: type === CONTENT_TYPE.movie ? badge : '',
      rank: null,
      badge,
      detail: {
        fullDescription: '',
        directors: [],
        writers: [],
        actors,
        releaseDate: '',
        updateTime: '',
        status: badge,
        screenshots: [],
        trailerUrl: ''
      },
      movie: { duration: '' },
      tv: {
        totalEpisodes: null,
        latestEpisode: null,
        updateStatus: type === CONTENT_TYPE.tv ? badge : '',
        season: ''
      },
      playCatalog: null,
      playback: null,
      source: {
        name: sourceManifest.name,
        domain: 'moovie.c2v2.com',
        rawId: id,
        sourceDetailUrl: '',
        rawData: resourceSourceName ? { resourceSourceName } : null,
        fetchedAt: ''
      }
    });
  }
  return items;
}

/**
 * 读取 Moovie 搜索 HTMX 中真实“下一页”按钮。
 * 纯函数: 只采用 pagination-btn 声明的同源搜索地址，并校验 keyword 与下一连续页。
 * 成功路径: 返回 hasMore 和经验证 nextUrl；没有下一页时两者分别为 false 和空字符串。
 * 失败路径: 伪造、跨页、跨关键词或跨端点按钮被忽略，不猜测总页数。
 *
 * @param {*} html 当前搜索 HTMX HTML。
 * @param {string} keyword 当前规范关键词。
 * @param {number} page 当前源站页码。
 * @returns {object} 下一页事实。
 */
function parseSearchPagination(html, keyword, page) {
  // 类型: string；作用: 保存搜索 HTMX 文本，非文本输入视为没有下一页。
  const source = typeof html === 'string' ? html : '';
  // 类型: RegExp；作用: 同时扫描 button 和 anchor 分页控件，避免依赖固定标签类型。
  const pattern = /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前分页控件匹配。
  let match;
  while ((match = pattern.exec(source)) !== null) {
    // 类型: string；作用: 重建当前分页控件开始标签。
    const openingTag = `<${match[1]}${match[2]}>`;
    // 类型: Array<string>；作用: 保存当前控件 class token，排除普通按钮。
    const classNames = readAttribute(openingTag, 'class').split(/\s+/).filter(Boolean);
    // 条件分支: 当前控件不是分页按钮或文案不是下一页时进入；执行内容: 继续扫描。
    if (!classNames.includes('pagination-btn') || !cleanText(match[3]).includes('下一页')) continue;
    // 类型: string；作用: 保存通过同源 HTTPS 门禁的 hx-get 地址。
    const nextUrl = absoluteUrl(readAttribute(openingTag, 'hx-get'));
    // 条件分支: 地址越界时进入；执行内容: 忽略当前控件。
    if (!nextUrl) continue;
    // 类型: URL；作用: 校验端点、关键词和连续页码，year 保持源站声明的空值。
    const parsedUrl = new URL(nextUrl);
    // 条件分支: 下一页没有精确复用当前搜索事务时进入；执行内容: 忽略而不猜测。
    if (parsedUrl.pathname !== SEARCH_POLICY.endpoint
      || parsedUrl.searchParams.get('kw') !== keyword
      || parsedUrl.searchParams.get('year') !== ''
      || parsedUrl.searchParams.get('page') !== String(page + 1)) continue;
    return { hasMore: true, nextUrl: parsedUrl.href };
  }
  return { hasMore: false, nextUrl: '' };
}

/**
 * 读取详情页声明的 HTMX 资源搜索入口。
 * 纯函数: 只扫描 hx-get 属性并通过同 host HTTPS 门禁，不自行重建站点查询协议。
 * 成功路径: 返回 pathname 为 /api/htmx/search 的首个绝对地址。
 * 失败路径: 详情页没有声明资源入口或地址越界时返回空字符串。
 *
 * @param {*} html Moovie 详情页 HTML。
 * @returns {string} 资源搜索绝对地址或空字符串。
 */
function extractResourceSearchUrl(html) {
  // 类型: Array<string>；作用: 保存带 hx-get 的开始标签，非文本页面使用空数组。
  const tags = typeof html === 'string' ? html.match(/<[^>]+\bhx-get\s*=\s*(?:"[^"]+"|'[^']+')[^>]*>/gi) || [] : [];
  for (const tag of tags) {
    // 类型: string；作用: 保存通过同 host 门禁的当前 HTMX 地址。
    const url = absoluteUrl(readAttribute(tag, 'hx-get'));
    // 条件分支: 当前地址是详情页声明的资源搜索接口时进入。
    // 执行内容: 立即采用页面权威 URL，保留 kw/year 等站点查询字段。
    if (url && new URL(url).pathname === '/api/htmx/search') return url;
  }
  return '';
}

/**
 * 解析 HTMX 资源结果中的播放卡片事实。
 * 纯函数: 只采用 class=search-result-card 且路径为 /play/ 的同 host HTTPS 链接，不构造页面对象。
 * 成功路径: 按源站排序返回去重后的播放地址、外部 id、完整标题、年份、来源、类别、资源状态和可达性。
 * 失败路径: 没有可信播放入口时返回空数组。
 *
 * @param {*} html /api/htmx/search 返回的资源 HTML。
 * @returns {Array<object>} 隔离资源卡片事实。
 */
function parseResourceCards(html) {
  // 类型: string；作用: 保存资源片段 HTML，非文本输入按空结果处理。
  const source = typeof html === 'string' ? html : '';
  // 类型: Array<object>；作用: 按源站响应顺序保存尚未投影为 ContentItem 的资源事实。
  const resourceCards = [];
  // 类型: Set<string>；作用: 同一播放地址只采用一次。
  const seenUrls = new Set();
  // 类型: RegExp；作用: 扫描资源结果中的链接和卡片正文。
  const pattern = /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前资源链接匹配。
  let match;
  while ((match = pattern.exec(source)) !== null) {
    // 类型: string；作用: 保存当前链接开始标签以读取 class 边界。
    const openingTag = match[0].slice(0, match[0].indexOf('>') + 1);
    // 条件分支: 当前链接不是资源结果卡片时进入。
    // 执行内容: 跳过导航和详情链接，避免把页面播放器入口误作资源。
    if (!readAttribute(openingTag, 'class').split(/\s+/).includes('search-result-card')) continue;
    // 类型: string；作用: 保存同 host /play/ 绝对地址。
    const playUrl = absoluteUrl(match[1] || match[2]);
    // 条件分支: 地址越界、不是 /play/ 资源或已经采用时进入。
    // 执行内容: 跳过当前链接并继续扫描其他真实资源。
    if (!playUrl || !new URL(playUrl).pathname.startsWith('/play/') || seenUrls.has(playUrl)) continue;
    seenUrls.add(playUrl);
    // 类型: URL；作用: 保存当前资源地址，后续身份、外部 id 和来源路径均从同一解析结果读取。
    const parsedPlayUrl = new URL(playUrl);
    // 类型: Array<string>；作用: 保存 URL 中 source key 和内容 id 路径片段。
    const pathSegments = parsedPlayUrl.pathname.split('/').filter(Boolean);
    // 类型: string；作用: 保存源站资源名称；解码失败时保留原路径文本。
    let sourceName = pathSegments[1] || '';
    try {
      sourceName = decodeURIComponent(sourceName);
    } catch (error) {
      // 失败边界: 非法百分号编码不阻断其他资源，名称保留原始安全路径片段。
    }
    // 类型: string；作用: 优先读取资源卡片自己的来源名称，路径片段只作为同卡安全后备。
    sourceName = readClassText(match[3], 'source-item') || sourceName;
    // 类型: string；作用: 保存资源卡片完整标题；图片 alt 只作为同一卡片后备，不采用整卡文本。
    const image = match[3].match(/<img\b[^>]*>/i)?.[0] || '';
    // 类型: string；作用: 保存精确内容匹配使用的完整标题，不做裁剪或模糊规范化。
    const title = readClassText(match[3], 'card-title') || readAttribute(image, 'alt');
    // 类型: string；作用: 保存资源卡片明确年份，缺失时保持空字符串供兼容性裁决。
    const year = readClassText(match[3], 'card-year');
    // 类型: string；作用: 保存资源地址明确携带的外部内容 id，供内容身份和精确匹配共同使用。
    const externalId = parsedPlayUrl.searchParams.get('douban_id')
      || parsedPlayUrl.searchParams.get('doubanId')
      || '';
    // 类型: number|null；作用: 从完整标题的明确季数文案读取季号，不从资源顺序推测。
    const seasonNumber = parseExplicitSeasonNumber(title);
    // 类型: string；作用: 保存源站明确 `card-type` 类别，供内容类型判定优先采用。
    const contentTypeLabel = cleanText(match[3].match(/<[^>]*class\s*=\s*["'][^"']*card-type[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] || '');
    // 类型: string；作用: 保存卡片 badge，补充正片、集数、更新状态或清晰度说明。
    const badge = cleanText(match[3].match(/<[^>]*class\s*=\s*["'][^"']*card-badge[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] || '');
    // 类型: boolean|null；作用: 保存资源卡片明确状态；未知时由线路页请求和解析结果最终裁决。
    const declaredAvailable = parseResourceDeclaredAvailability(openingTag, match[3]);
    // 类型: object；作用: 保存未投影的资源事实；私有地址只供 Provider 后续请求，不进入 playCatalog。
    resourceCards.push({
      playUrl,
      externalId,
      title,
      year,
      seasonNumber,
      sourceName,
      contentTypeLabel,
      badge,
      declaredAvailable
    });
  }
  return resourceCards;
}

/**
 * 解析 Moovie 详情页等待资源匹配的内容事实。
 * 纯函数: 详情主标题先排除其嵌套年份节点，再与页面声明的资源查询关键词互相校验；外部 id 来自已验证 db- 身份。
 * 成功路径: 两个独立页面事实一致时返回规范标题、外部 id、年份、季号和可选类型事实。
 * 失败路径: 标题、查询关键词或 db- 身份无效或冲突时抛 Error，禁止用资源结果首项反向定义目标内容。
 *
 * @param {*} html Moovie 信息详情 HTML。
 * @param {string} contentId 已验证 db- 内容身份。
 * @param {string} resourceSearchUrl 详情声明的资源搜索地址。
 * @returns {object} 严格匹配目标事实。
 * @throws {Error} 详情身份事实不完整时抛出。
 */
function parseDetailIdentityFacts(html, contentId, resourceSearchUrl) {
  // 类型: string；作用: 保存信息详情 HTML，非文本输入按身份事实缺失处理。
  const source = typeof html === 'string' ? html : '';
  // 类型: string；作用: 读取当前详情主标题正文，真实页面会在同一 H1 内嵌套独立年份 span。
  const movieNameHtml = source.match(/<h1\b[^>]*class\s*=\s*["'][^"']*movie-name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '';
  // 类型: string；作用: 只移除详情标题内部具名年份节点，不按尾部括号或四位数字裁剪作品名。
  const titleWithoutYearNode = movieNameHtml.replace(/<span\b[^>]*class\s*=\s*["'][^"']*movie-year-text[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '');
  // 类型: string；作用: 优先采用去除具名年份后的主标题；旧结构缺少 movie-name 时回退普通 H1。
  const displayedTitle = cleanText(titleWithoutYearNode
    || source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  // 类型: URL|null；作用: 保存详情自己声明且已通过同源端点门禁的资源查询事务。
  const resourceSearch = resourceSearchUrl ? new URL(resourceSearchUrl) : null;
  // 类型: string；作用: `kw` 是资源服务实际使用的完整标题，必须与详情可见主标题一致。
  const resourceKeyword = cleanText(resourceSearch?.searchParams.get('kw') || '');
  // 类型: string；作用: 从 Provider 内容身份恢复明确外部 id，不解析公共平台之外的含义。
  const externalId = parseDatabaseContentId(contentId);
  // 条件分支: 页面标题、资源关键词或外部身份缺失时进入；执行内容: 拒绝继续请求或采用资源候选。
  if (!displayedTitle || !resourceKeyword || !externalId) throw new Error('Moovie 详情匹配事实无效');
  // 条件分支: 页面展示标题和资源查询标题冲突时进入；执行内容: 防止错误 HTMX 容器把其他内容线路挂到当前详情。
  if (displayedTitle !== resourceKeyword) throw new Error('Moovie 详情标题与资源查询不一致');
  // 类型: string；作用: 优先采用详情页写入 HTMX 查询的年份，缺失时读取具名年份元素。
  const searchYear = resourceSearch?.searchParams.get('year') || '';
  // 类型: string；作用: 保存详情正文能够明确提供的年份文本，供查询字段缺失时采用。
  const displayedYear = readClassText(source, 'movie-year')
    || readClassText(source, 'detail-year')
    || readClassText(source, 'card-year');
  // 类型: string；作用: 查询参数只有四位年份时优先，否则采用详情展示年份。
  const yearCandidate = /^\d{4}$/u.test(searchYear) ? searchYear : displayedYear;
  // 类型: string；作用: 只保留四位年份事实，其他文本不参与同内容冲突判断。
  const year = /^\d{4}$/u.test(yearCandidate) ? yearCandidate : '';
  // 类型: string；作用: 读取详情明确类别文案；无法唯一识别时保持空值，最终类型由全部精确资源一致裁决。
  const contentTypeLabel = readClassText(source, 'movie-type') || readClassText(source, 'detail-type');
  // 类型: string；作用: 只把已识别类别提升为目标类型事实，未知文案保持空字符串。
  const contentType = resolveResourceCardContentType({ contentTypeLabel, badge: '' });
  return {
    externalId,
    title: displayedTitle,
    year,
    seasonNumber: parseExplicitSeasonNumber(displayedTitle),
    contentType
  };
}

/**
 * 判断一张资源卡片是否与目标详情属于同一内容。
 * 纯函数: 标题必须完整精确相等；外部 id、类型、年份或季号任一双方明确冲突都会排除。
 * 成功路径: 返回 true 只表示当前候选具有足够且无冲突的同内容证据。
 * 失败路径: 缺标题、缺类型、近似标题、包含标题或事实冲突均返回 false。
 *
 * @param {*} resourceCard 单张资源卡片事实。
 * @param {object} targetFacts 详情页目标事实。
 * @returns {boolean} 是否可以作为当前内容的一条资源线路。
 */
function isExactResourceCardMatch(resourceCard, targetFacts) {
  // 类型: string；作用: 资源类别必须自己形成唯一 movie/tv 事实，未知类别不能借用其他候选。
  const candidateType = resolveResourceCardContentType(resourceCard);
  // 条件分支: 标题不是完整精确值或候选类型未知时进入；执行内容: 排除当前近似结果。
  if (!resourceCard?.title || resourceCard.title !== targetFacts.title || !candidateType) return false;
  // 条件分支: 双方外部 id 明确且冲突时进入；执行内容: 即使同名也排除其他作品。
  if (resourceCard.externalId && targetFacts.externalId && resourceCard.externalId !== targetFacts.externalId) return false;
  // 条件分支: 双方类型明确且冲突时进入；执行内容: 排除同名电影/剧集混淆。
  if (targetFacts.contentType && candidateType !== targetFacts.contentType) return false;
  // 条件分支: 双方年份明确且冲突时进入；执行内容: 排除同名翻拍或不同年份版本。
  if (resourceCard.year && targetFacts.year && resourceCard.year !== targetFacts.year) return false;
  // 条件分支: 双方季号明确且冲突时进入；执行内容: 排除同系列其他季。
  if (resourceCard.seasonNumber && targetFacts.seasonNumber
    && resourceCard.seasonNumber !== targetFacts.seasonNumber) return false;
  return true;
}

/**
 * 从资源搜索结果中保留当前详情的精确线路候选。
 * 纯函数: 保持源站排序，不修剪标题、不计算相似度，也不回退首条结果。
 * 成功路径: 返回至少一张同内容资源卡片。
 * 失败路径: 没有精确结果时抛 Error，详情不得混入近似作品。
 *
 * @param {Array<object>} resourceCards 全部资源搜索卡片事实。
 * @param {object} targetFacts 当前详情目标事实。
 * @returns {Array<object>} 精确同内容资源卡片。
 * @throws {Error} 没有精确候选时抛出。
 */
function filterExactResourceCards(resourceCards, targetFacts) {
  // 类型: Array<object>；作用: 只保留完整标题相等且所有明确事实无冲突的候选。
  const matchedCards = (Array.isArray(resourceCards) ? resourceCards : [])
    .filter(resourceCard => isExactResourceCardMatch(resourceCard, targetFacts));
  // 条件分支: 没有任何精确资源时进入；执行内容: 失败关闭，不把相似标题或首项伪装成线路。
  if (!matchedCards.length) throw new Error('Moovie 没有匹配当前内容的精确资源');
  return matchedCards;
}

/**
 * 从单条 Moovie 资源卡片形成内容类型事实。
 * 纯函数: 优先读取源站明确类别；类别缺失或无法识别时才读取资源状态，不访问页面、网络或外部站点。
 * 成功路径: 返回明确的 movie/tv；没有充分事实时返回空字符串。
 * 失败路径: 单条资源不会抛错，跨资源一致性由 parseResourceContentType 统一裁决。
 *
 * @param {*} resourceCard parseResourceCards 交付的单条隔离资源事实。
 * @returns {string} CONTENT_TYPE 中已确认类型或空字符串。
 */
function resolveResourceCardContentType(resourceCard) {
  // 类型: string；作用: 规范源站明确类别后再进入互斥映射规则。
  const contentTypeLabel = cleanText(resourceCard?.contentTypeLabel);
  // 条件分支: 类别明确表达电影时进入；执行内容: 采用源站类别，不再让质量或更新状态覆盖它。
  if (RESOURCE_CONTENT_TYPE_LABEL_PATTERNS.movie.test(contentTypeLabel)) return CONTENT_TYPE.movie;
  // 条件分支: 类别明确表达连续内容时进入；执行内容: 采用源站类别，不再要求 badge 必须包含集数。
  if (RESOURCE_CONTENT_TYPE_LABEL_PATTERNS.tv.test(contentTypeLabel)) return CONTENT_TYPE.tv;
  // 类型: string；作用: 只有明确类别不可用时才读取旧资源状态，保持历史响应可解析但不把状态提升为首要事实。
  const badge = cleanText(resourceCard?.badge);
  // 条件分支: 状态明确包含剧集数量或集号时进入；执行内容: 返回电视剧补充事实。
  if (RESOURCE_STATUS_TYPE_PATTERNS.tv.test(badge)) return CONTENT_TYPE.tv;
  // 条件分支: 状态只表达单部正片或清晰度时进入；执行内容: 返回电影补充事实。
  if (RESOURCE_STATUS_TYPE_PATTERNS.movie.test(badge)) return CONTENT_TYPE.movie;
  return '';
}

/**
 * 从全部 Moovie 在线资源事实形成唯一内容类型。
 * 纯函数: 只读取 parseResourceCards 交付的类别和状态，不读取标题、简介、片长、JSON-LD 或外部站点。
 * 成功路径: 全部可识别资源只形成一种类型时返回对应平台类型。
 * 失败路径: 没有可识别状态或两类状态同时出现时抛 Error，阻止默认 movie 和歧义内容进入页面。
 *
 * @param {Array<object>} resourceCards 隔离资源卡片事实。
 * @returns {string} CONTENT_TYPE 中唯一确认的 movie 或 tv。
 * @throws {Error} 当资源状态不足或互相冲突时抛出。
 */
function parseResourceContentType(resourceCards) {
  // 类型: Set<string>；作用: 收集全部资源卡片能够明确证明的内容类型，未知类别和状态不产生默认类型。
  const confirmedTypes = new Set();
  for (const resourceCard of Array.isArray(resourceCards) ? resourceCards : []) {
    // 类型: string；作用: 保存当前卡片按“明确类别优先、状态补充”规则形成的独立类型事实。
    const contentType = resolveResourceCardContentType(resourceCard);
    // 条件分支: 当前卡片形成可识别事实时进入；执行内容: 登记到全资源一致性集合。
    if (contentType) confirmedTypes.add(contentType);
  }
  // 条件分支: 资源没有事实或同时声称两种类型时进入。
  // 执行内容: 明确失败，不按请求顺序、标题词或首条资源猜测。
  if (confirmedTypes.size !== 1) throw new Error('Moovie 内容类型无法从资源状态唯一确认');
  return [...confirmedTypes][0];
}

/**
 * 解析 Moovie 资源页“选集播放”中的 Provider 私有入口。
 * 纯函数: 只采用 class=ep-btn 且同 host /play/ 的链接；外部下载按钮和 source-btn 不进入目录。
 * 成功路径: 按页面顺序返回去重后的私有 playUrl 和完整标签。
 * 失败路径: 地址、标签或 class 无效的单项被跳过；没有合法入口时返回空数组。
 *
 * @param {*} html Moovie 资源播放页 HTML。
 * @returns {Array<object>} Provider 私有选集入口，不得直接写入 ContentItem。
 */
function parseResourcePageEpisodeLinks(html) {
  // 类型: string；作用: 保存资源页 HTML，非字符串输入按空页面处理。
  const source = typeof html === 'string' ? html : '';
  // 类型: Array<object>；作用: 按源站顺序保存合法私有选集入口。
  const episodeLinks = [];
  // 类型: Set<string>；作用: 页面可能重复当前集链接，同一完整 URL 只采用一次。
  const seenUrls = new Set();
  // 类型: RegExp；作用: 扫描页面全部 anchor，class 和同源边界在循环内精确判断。
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前 anchor 匹配。
  let match;
  while ((match = pattern.exec(source)) !== null) {
    // 类型: string；作用: 重建当前 anchor 开始标签。
    const openingTag = `<a${match[1]}>`;
    // 类型: Array<string>；作用: 保存 class token，避免把 source-btn 或下载容器误作选集。
    const classNames = readAttribute(openingTag, 'class').split(/\s+/).filter(Boolean);
    // 条件分支: 当前链接不是 ep-btn 时进入；执行内容: 跳过导航、来源和操作按钮。
    if (!classNames.includes('ep-btn')) continue;
    // 类型: string；作用: 保存通过同源 HTTPS 门禁的选集地址，仅供 Provider 后续请求。
    const playUrl = absoluteUrl(readAttribute(openingTag, 'href'));
    // 类型: string；作用: 保存当前选集按钮完整文案，后续从明确语义生成逻辑身份。
    const label = cleanText(match[2]);
    // 条件分支: 地址不是同源 /play/、标签为空或地址已经采用时进入；执行内容: 跳过无效入口。
    if (!playUrl || !new URL(playUrl).pathname.startsWith('/play/') || !label || seenUrls.has(playUrl)) continue;
    seenUrls.add(playUrl);
    episodeLinks.push({ playUrl, label });
  }
  return episodeLinks;
}

/**
 * 从一条明确选集标签生成逻辑剧集对象。
 * 纯函数: 电影统一使用 feature；电视剧只从明确季集号或完整特辑语义形成身份。
 * 成功路径: 返回不含资源 URL 的 PlayCatalogEpisode。
 * 失败路径: 类型或标签无效时抛 Error，不按数组位置补集号。
 *
 * @param {string} label 当前线路完整按钮文案。
 * @param {string} contentType 已确认 movie 或 tv。
 * @param {string} poster 当前内容封面。
 * @param {boolean} playable 当前线路是否允许请求该条目。
 * @returns {object} 标准 PlayCatalogEpisode。
 * @throws {Error} 逻辑剧集事实不足时抛出。
 */
function createLogicalPlayCatalogEpisode(label, contentType, poster, playable) {
  // 类型: string；作用: 清理后的完整标签既用于展示，也用于特辑精确语义身份。
  const normalizedLabel = cleanText(label);
  // 条件分支: 内容类型或标签无效时进入；执行内容: 拒绝制造空目录条目。
  if (!Object.values(CONTENT_TYPE).includes(contentType) || !normalizedLabel) {
    throw new Error('Moovie 逻辑剧集事实无效');
  }
  // 条件分支: 当前内容是电影时进入；执行内容: 所有线路共享唯一 feature，清晰度只保留在 label。
  if (contentType === CONTENT_TYPE.movie) {
    return {
      id: PLAY_CATALOG_POLICY.featureEpisodeId,
      kind: 'feature',
      seasonNumber: null,
      episodeNumber: null,
      title: '',
      label: normalizedLabel,
      duration: '',
      description: '',
      cover: poster,
      playable
    };
  }
  // 类型: number|null；作用: 从当前标签读取明确季号，未知时保持 null。
  const seasonNumber = parseExplicitSeasonNumber(normalizedLabel);
  // 类型: number|null；作用: 从当前标签读取明确集号，未知时按完整特辑语义处理。
  const episodeNumber = parseExplicitEpisodeNumber(normalizedLabel);
  // 条件分支: 当前标签包含明确正集编号时进入；执行内容: 跨线路共享季集号身份。
  if (episodeNumber !== null) {
    // 类型: string；作用: 有季号时组合季集身份，无季号时采用 Provider 明确集号身份。
    const id = seasonNumber === null
      ? `${PLAY_CATALOG_POLICY.regularEpisodeIdPrefix}-${episodeNumber}`
      : `${PLAY_CATALOG_POLICY.seasonEpisodeIdPrefix}-${seasonNumber}:${PLAY_CATALOG_POLICY.regularEpisodeIdPrefix}-${episodeNumber}`;
    return {
      id,
      kind: 'episode',
      seasonNumber,
      episodeNumber,
      title: '',
      label: normalizedLabel,
      duration: '',
      description: '',
      cover: poster,
      playable
    };
  }
  // 类型: string；作用: 特辑只能由完整标签精确哈希形成身份，不裁剪“特辑/番外”等前后缀。
  const specialId = createStableOpaqueId(PLAY_CATALOG_POLICY.specialEpisodeIdPrefix, normalizedLabel);
  return {
    id: specialId,
    kind: 'special',
    seasonNumber,
    episodeNumber: null,
    title: normalizedLabel,
    label: normalizedLabel,
    duration: '',
    description: '',
    cover: poster,
    playable
  };
}

/**
 * 把一条线路的私有选集入口转换为公共逻辑目录和内部请求目标。
 * 纯函数: 公共 episode 不含 URL；同一线路重复逻辑身份只有指向同一 URL 时才去重。
 * 成功路径: 返回 episodes 与一一对应的 targets。
 * 失败路径: 同一逻辑身份指向多个不同资源时抛 Error，禁止随机采用首项。
 *
 * @param {Array<object>} episodeLinks Provider 私有选集入口。
 * @param {string} contentType 已确认内容类型。
 * @param {string} poster 当前内容封面。
 * @param {boolean} playable 当前线路可播放状态。
 * @returns {object} 公共分集和 Provider 私有请求目标。
 * @throws {Error} 同线路逻辑身份冲突时抛出。
 */
function createPlayCatalogEpisodes(episodeLinks, contentType, poster, playable) {
  // 类型: Array<object>；作用: 保存不含资源 URL 的公共目录条目。
  const episodes = [];
  // 类型: Array<object>；作用: 保存与公共身份绑定的 Provider 私有播放请求目标。
  const targets = [];
  // 类型: Map<string,string>；作用: 检测同一逻辑身份是否错误指向多个不同 URL。
  const targetUrlByEpisodeId = new Map();
  for (const episodeLink of Array.isArray(episodeLinks) ? episodeLinks : []) {
    // 类型: object；作用: 从明确标签生成跨线路可比较的公共逻辑剧集。
    const episode = createLogicalPlayCatalogEpisode(episodeLink.label, contentType, poster, playable);
    // 类型: string|undefined；作用: 读取同逻辑身份已经登记的私有地址。
    const existingUrl = targetUrlByEpisodeId.get(episode.id);
    // 条件分支: 同一身份重复且 URL 相同时进入；执行内容: 忽略页面重复链接，不复制目录项。
    if (existingUrl === episodeLink.playUrl) continue;
    // 条件分支: 同一身份已经指向其他 URL 时进入；执行内容: 失败关闭，不让数组顺序决定媒体。
    if (existingUrl) throw new Error('Moovie 线路逻辑剧集身份冲突');
    targetUrlByEpisodeId.set(episode.id, episodeLink.playUrl);
    episodes.push(episode);
    targets.push({ episode, playUrl: episodeLink.playUrl });
  }
  return { episodes, targets };
}

/**
 * 解析一张资源卡片对应的完整播放线路。
 * 纯函数: 页面 HTML、资源卡片和内容类型由调用方提供；资源 URL 只保存在内部 targets/pageUrl。
 * 成功路径: 返回稳定线路、公共分集、私有请求目标和可复用页面 HTML。
 * 失败路径: 页面没有任何明确选集事实时抛 Error，由调用方保留不可用线路。
 *
 * @param {string} html 资源线路页面 HTML。
 * @param {object} resourceCard 精确同内容资源卡片。
 * @param {string} contentType 已确认内容类型。
 * @param {string} poster 当前内容封面。
 * @returns {object} Provider 内部资源线路。
 * @throws {Error} 线路没有可定位选集时抛出。
 */
function parseResourceLinePage(html, resourceCard, contentType, poster) {
  // 类型: Array<object>；作用: 读取页面全部明确选集私有入口。
  const episodeLinks = parseResourcePageEpisodeLinks(html);
  // 类型: string；作用: 页面未列出按钮时，当前选集标签可以证明资源 URL 自身就是一个明确入口。
  const currentEpisodeLabel = readClassText(html, 'current-ep');
  // 条件分支: 页面没有选集按钮但存在当前标签时进入；执行内容: 采用当前资源页自身，不猜测相邻集。
  if (!episodeLinks.length && currentEpisodeLabel) {
    episodeLinks.push({ playUrl: resourceCard.playUrl, label: currentEpisodeLabel });
  }
  // 条件分支: 页面既没有列表也没有当前选集事实时进入；执行内容: 交由调用方形成不可用线路。
  if (!episodeLinks.length) throw new Error('Moovie 线路没有可定位选集');
  // 类型: boolean；作用: 卡片明确不可用时保持 false；其余线路以成功页面解析作为可用事实。
  const available = resourceCard.declaredAvailable !== false;
  // 类型: object；作用: 同时生成公共分集和 Provider 私有请求目标。
  const catalogEntries = createPlayCatalogEpisodes(episodeLinks, contentType, poster, available);
  return {
    id: createResourceLineId(resourceCard.playUrl),
    name: resourceCard.sourceName || PLAY_CATALOG_POLICY.fallbackLineName,
    available,
    unavailableReason: available ? '' : PLAY_CATALOG_POLICY.unavailableReason,
    episodes: catalogEntries.episodes,
    targets: catalogEntries.targets,
    pageUrl: resourceCard.playUrl,
    pageHtml: html
  };
}

/**
 * 为请求或解析失败的资源卡片保留不可用线路。
 * 纯函数: 电影可以用卡片质量形成不可播放 feature；电视剧不伪造未知分集。
 * 成功路径: 返回稳定 id、来源名称和红色状态所需安全原因。
 * 失败路径: 资源地址无效时由线路身份生成函数抛 Error。
 *
 * @param {object} resourceCard 精确同内容资源卡片。
 * @param {string} contentType 已确认内容类型。
 * @param {string} poster 当前内容封面。
 * @returns {object} Provider 内部不可用线路。
 */
function createUnavailableResourceLine(resourceCard, contentType, poster) {
  // 类型: Array<object>；作用: 电影保留一条不可播放正片入口，电视剧缺集时保持真实空数组。
  const episodes = contentType === CONTENT_TYPE.movie
    ? [createLogicalPlayCatalogEpisode(resourceCard.badge || '正片', contentType, poster, false)]
    : [];
  return {
    id: createResourceLineId(resourceCard.playUrl),
    name: resourceCard.sourceName || PLAY_CATALOG_POLICY.fallbackLineName,
    available: false,
    unavailableReason: PLAY_CATALOG_POLICY.unavailableReason,
    episodes,
    targets: [],
    pageUrl: resourceCard.playUrl,
    pageHtml: ''
  };
}

/**
 * 把 Provider 内部线路投影为唯一公共播放目录。
 * 纯函数: 只复制契约字段，不交付 targets、pageUrl、pageHtml 或资源卡片。
 * 成功路径: 默认线路优先选择首条可用且有可播放分集的线路，否则保留首条已发现线路。
 * 失败路径: 空线路或重复线路身份抛 Error，禁止生成空目录和覆盖冲突。
 *
 * @param {Array<object>} resourceLines Provider 内部资源线路。
 * @returns {object} ContentItem.playCatalog。
 * @throws {Error} 线路集合无效时抛出。
 */
function createPlayCatalog(resourceLines) {
  // 类型: Array<object>；作用: 隔离调用方数组，后续只投影公共字段。
  const lines = Array.isArray(resourceLines) ? resourceLines : [];
  // 条件分支: 没有任何精确线路时进入；执行内容: 拒绝详情伪装成可播放内容。
  if (!lines.length) throw new Error('Moovie 播放目录没有线路');
  // 类型: Set<string>；作用: 验证哈希身份和输入集合没有重复线路。
  const lineIds = new Set(lines.map(line => line.id));
  // 条件分支: 线路身份重复时进入；执行内容: 失败关闭，不按源站顺序覆盖。
  if (lineIds.size !== lines.length) throw new Error('Moovie 播放目录线路身份冲突');
  // 类型: object|undefined；作用: 默认采用首条真正可请求且包含可播放分集的线路。
  const defaultLine = lines.find(line => line.available && line.episodes.some(episode => episode.playable)) || lines[0];
  return {
    defaultLineId: defaultLine.id,
    lines: lines.map(line => ({
      id: line.id,
      name: line.name,
      available: line.available,
      unavailableReason: line.unavailableReason,
      episodes: line.episodes.map(episode => ({ ...episode }))
    }))
  };
}

/**
 * 精确解析 player 请求的 Provider 私有媒体目标。
 * 纯函数: lineId 和 episodeId 都必须非空且在同一可用线路中精确存在。
 * 成功路径: 返回绑定公共身份的私有 playUrl 和线路页面上下文。
 * 失败路径: 缺字段、未知线路、不可用线路、缺集或不可播放均抛 Error；绝不回退首项或相邻集。
 *
 * @param {Array<object>} resourceLines Provider 内部资源线路。
 * @param {*} params SourceDataRequest.params。
 * @returns {object} 精确媒体请求目标。
 * @throws {Error} 请求身份无法精确解析时抛出。
 */
function resolveRequestedPlaybackTarget(resourceLines, params) {
  // 类型: string；作用: 读取路由经过标准请求交付的目标线路身份。
  const lineId = typeof params?.playbackSourceId === 'string' ? params.playbackSourceId : '';
  // 类型: string；作用: 读取目标逻辑剧集身份。
  const episodeId = typeof params?.episodeId === 'string' ? params.episodeId : '';
  // 条件分支: 任一身份为空时进入；执行内容: 拒绝 Provider 自行选择首条线路或分集。
  if (!lineId || !episodeId) throw new Error('Moovie 播放请求缺少精确线路或分集身份');
  // 类型: object|undefined；作用: 在本次重新发现的完整目录中精确定位目标线路。
  const line = resourceLines.find(candidate => candidate.id === lineId);
  // 条件分支: 线路不存在或当前不可用时进入；执行内容: 失败关闭，平台继续保留旧媒体。
  if (!line || !line.available) throw new Error('Moovie 播放线路不可用');
  // 类型: object|undefined；作用: 只在目标线路内部精确定位同一逻辑剧集和私有 URL。
  const target = line.targets.find(candidate => candidate.episode.id === episodeId && candidate.episode.playable);
  // 条件分支: 目标线路没有该集时进入；执行内容: 触发平台缺集/失败流程，不回退目标线路其他集。
  if (!target) throw new Error('Moovie 目标线路没有请求的逻辑剧集');
  return { line, target };
}

/**
 * 从 Moovie 资源页选集和标签形成唯一内容类型。
 * 纯函数: 多集或明确“第 N 集”属于电视剧；单项电影质量/正片文案属于电影；标签类别只作同页补充事实。
 * 成功路径: 返回明确 movie 或 tv。
 * 失败路径: 页面事实不足或互相冲突时抛 Error，不默认采用电影。
 *
 * @param {Array<object>} episodeLinks 资源页私有选集入口。
 * @param {Array<string>} tags 详情标签。
 * @param {string} currentEpisodeLabel 当前播放标签。
 * @returns {string} CONTENT_TYPE 中唯一确认的类型。
 * @throws {Error} 类型事实不足或冲突时抛出。
 */
function resolveResourcePageContentType(episodeLinks, tags, currentEpisodeLabel) {
  // 类型: Set<string>；作用: 汇总选集、当前标签和详情标签提供的互斥类型事实。
  const confirmedTypes = new Set();
  // 条件分支: 页面提供多个可播放选集时进入；执行内容: 登记连续内容事实。
  if (Array.isArray(episodeLinks) && episodeLinks.length > 1) confirmedTypes.add(CONTENT_TYPE.tv);
  // 类型: Array<string>；作用: 组合当前选集和详情标签，使用与资源卡片相同的明确类别/状态规则。
  const labels = [currentEpisodeLabel, ...(Array.isArray(episodeLinks) ? episodeLinks.map(episode => episode.label) : []), ...(Array.isArray(tags) ? tags : [])];
  for (const label of labels) {
    // 类型: string；作用: 把当前页面文案作为类别与状态双重候选，只有已有规则命中时登记事实。
    const contentType = resolveResourceCardContentType({ contentTypeLabel: label, badge: label });
    // 条件分支: 当前文案形成明确事实时进入；执行内容: 登记到一致性集合。
    if (contentType) confirmedTypes.add(contentType);
  }
  // 条件分支: 页面没有唯一类型事实时进入；执行内容: 失败关闭，避免详情刷新后类型漂移。
  if (confirmedTypes.size !== 1) throw new Error('Moovie 资源页内容类型无法唯一确认');
  return [...confirmedTypes][0];
}

/**
 * 解析 Moovie 独立资源播放页为详情 ContentItem。
 * 纯函数: 读取标题、海报、地区、年份、导演、主演、更新时间、选集和追踪地址，不执行源站脚本。
 * 成功路径: 返回与搜索 resource 身份一致、可继续请求具体分集播放的增强内容对象。
 * 失败路径: 标题、资源地址、类型或选集事实不足时抛 Error，不依赖搜索页临时缓存补齐。
 *
 * @param {*} html Moovie 资源播放页 HTML。
 * @param {string} contentId 可逆 resource 内容身份。
 * @param {string} sourceId 当前 Provider 身份。
 * @param {string} resourceUrl 经 resolveResourceContentUrl 校验的资源页地址。
 * @returns {object} 增强 ContentItem。
 * @throws {Error} 页面不能独立恢复详情时抛出。
 */
function parseResourcePage(html, contentId, sourceId, resourceUrl) {
  // 类型: string；作用: 保存资源页 HTML，非文本输入按字段缺失处理。
  const source = typeof html === 'string' ? html : '';
  // 类型: string；作用: 保存当前播放标签，用于从 H1 中移除集数并辅助类型判断。
  const currentEpisodeLabel = readClassText(source, 'current-ep');
  // 类型: string；作用: 保存 detail-title 的完整清洗文本。
  const titleWithEpisode = readClassText(source, 'detail-title');
  // 类型: string；作用: 移除 H1 尾部当前集标签，得到内容标题。
  const title = currentEpisodeLabel && titleWithEpisode.endsWith(currentEpisodeLabel)
    ? titleWithEpisode.slice(0, -currentEpisodeLabel.length).trim()
    : titleWithEpisode;
  // 条件分支: 资源页没有可信标题时进入；执行内容: 拒绝生成未命名详情。
  if (!title) throw new Error('Moovie 资源页标题无法解析');
  // 类型: string；作用: 保存详情海报容器内首个图片标签，避免采用导航 Logo、广告或下载图片。
  const posterImage = source.match(/<div\b[^>]*class\s*=\s*["'][^"']*detail-poster[^"']*["'][^>]*>[\s\S]*?<img\b[^>]*>/i)?.[0].match(/<img\b[^>]*>/i)?.[0] || '';
  // 类型: string；作用: 允许资源页提供外部 HTTPS 海报，Provider 不主动请求该 host。
  const poster = normalizeAssetUrl(
    readAttribute(posterImage, 'data-src')
      || readAttribute(posterImage, 'src')
      || readMetaContent(source, 'property', 'og:image')
  );
  // 类型: Array<string>；作用: 保存详情标签原顺序，例如地区范围、国家和年份。
  const detailTags = readClassTexts(source, 'tag-item');
  // 类型: string；作用: 从四位数字标签读取年份，不从标题猜测。
  const year = detailTags.find(tag => /^\d{4}$/u.test(tag)) || '';
  // 类型: Array<string>；作用: 保存除年份外的地区与类别标签。
  const nonYearTags = detailTags.filter(tag => tag !== year);
  // 类型: string；作用: 采用最具体的最后一个非年份标签作为地区，完整标签仍保存在 genres。
  const area = nonYearTags.at(-1) || '';
  // 类型: Map<string,string>；作用: 按详情 meta-label 保存导演、主演、统计和更新文本。
  const metaValues = new Map();
  // 类型: RegExp；作用: meta-row 内只含 span，可按独立行安全提取标签和值。
  const metaPattern = /<div\b[^>]*class\s*=\s*["'][^"']*meta-row[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  // 类型: RegExpMatchArray|null；作用: 保存当前详情元信息行。
  let metaMatch;
  while ((metaMatch = metaPattern.exec(source)) !== null) {
    // 类型: string；作用: 去除末尾冒号后形成稳定字段名称。
    const label = readClassText(metaMatch[1], 'meta-label').replace(/[:：]\s*$/u, '');
    // 类型: string；作用: 保存当前元信息值。
    const value = readClassText(metaMatch[1], 'meta-value');
    // 条件分支: 标签和值均存在时进入；执行内容: 登记当前资源页事实。
    if (label && value) metaValues.set(label, value);
  }
  // 类型: string；作用: 优先读取详情正文类名，缺失时采用页面 meta description。
  const description = readClassText(source, 'detail-description')
    || readClassText(source, 'detail-summary')
    || readMetaContent(source, 'name', 'description');
  // 类型: Array<object>；作用: 读取 Provider 私有选集入口，只用于类型识别和后续线路构造。
  const episodeLinks = parseResourcePageEpisodeLinks(source);
  // 条件分支: 页面没有列表但有明确当前选集时进入；执行内容: 把资源 URL 自身作为唯一明确入口，不回退其他页面。
  if (!episodeLinks.length && currentEpisodeLabel) episodeLinks.push({ playUrl: resourceUrl, label: currentEpisodeLabel });
  // 条件分支: 页面没有任何同源可播放事实时进入；执行内容: 资源身份无法继续播放，明确失败。
  if (!episodeLinks.length) throw new Error('Moovie 资源页没有可播放选集');
  // 类型: string；作用: 只从当前资源页可重建事实形成 movie/tv，刷新不依赖搜索缓存。
  const contentType = resolveResourcePageContentType(episodeLinks, detailTags, currentEpisodeLabel);
  // 类型: URL；作用: 从已验证资源 URL 读取内部来源名称和原始相对身份。
  const parsedResourceUrl = new URL(resourceUrl);
  // 类型: Array<string>；作用: 保存 /play/<来源>/<资源> 路径片段。
  const pathSegments = parsedResourceUrl.pathname.split('/').filter(Boolean);
  // 类型: string；作用: 保存内部资源提供方名称；非法编码时保留安全路径文本。
  let resourceSourceName = pathSegments[1] || '';
  try {
    resourceSourceName = decodeURIComponent(resourceSourceName);
  } catch (error) {
    // 失败边界: 路径已经通过 URL 与同源门禁，非法百分号只影响展示名称，不改变资源地址。
  }
  // 类型: object；作用: 把当前可逆资源身份恢复为一条内部资源卡片事实，线路 id 仍由私有地址哈希生成。
  const resourceCard = {
    playUrl: resourceUrl,
    externalId: parsedResourceUrl.searchParams.get('douban_id')
      || parsedResourceUrl.searchParams.get('doubanId')
      || '',
    title,
    year,
    seasonNumber: parseExplicitSeasonNumber(title),
    sourceName: resourceSourceName,
    contentTypeLabel: contentType === CONTENT_TYPE.movie ? '电影' : '剧集',
    badge: currentEpisodeLabel,
    declaredAvailable: null
  };
  // 类型: object；作用: 生成当前资源唯一线路、跨线路逻辑剧集和私有请求目标。
  const resourceLine = parseResourceLinePage(source, resourceCard, contentType, poster);
  // 类型: object；作用: 只向 ContentItem 交付公共线路与逻辑分集，不包含 playUrl 或页面 HTML。
  const playCatalog = createPlayCatalog([resourceLine]);
  // 类型: string；作用: 资源页可能由旧 resource 身份进入，返回规范 db- 身份让后续用户内容采用统一键。
  const canonicalContentId = resolveCanonicalResourceContentId(resourceCard, contentId);
  // 类型: Array<number>；作用: 收集当前线路明确正集编号，未知和特辑不参与最大集数事实。
  const regularEpisodeNumbers = resourceLine.episodes
    .map(episode => episode.episodeNumber)
    .filter(episodeNumber => Number.isSafeInteger(episodeNumber));
  // 类型: number|null；作用: 当前资源页能明确证明的最新正集号，不把条目数量当作集号。
  const latestEpisode = regularEpisodeNumbers.length ? Math.max(...regularEpisodeNumbers) : null;
  // 类型: string；作用: 保存资源页明确更新时间。
  const updateTime = metaValues.get('更新') || '';
  // 类型: string；作用: 电影使用当前正片/质量标签，电视剧状态由选集总量表达。
  const quality = contentType === CONTENT_TYPE.movie ? currentEpisodeLabel : '';
  return {
    item: {
      id: canonicalContentId,
      sourceId,
      sourceName: sourceManifest.name,
      type: contentType,
      title,
      originalTitle: '',
      aliases: [],
      poster,
      cover: poster,
      description,
      year,
      area,
      language: '',
      genres: area ? nonYearTags.slice(0, -1) : nonYearTags,
      tags: [],
      displayTags: [],
      score: null,
      quality,
      rank: null,
      badge: currentEpisodeLabel,
      detail: {
        fullDescription: description,
        directors: splitPeople(metaValues.get('导演') || ''),
        writers: [],
        actors: splitPeople(metaValues.get('主演') || ''),
        releaseDate: '',
        updateTime,
        status: currentEpisodeLabel,
        screenshots: [],
        trailerUrl: ''
      },
      movie: { duration: '' },
      tv: {
        totalEpisodes: null,
        latestEpisode: contentType === CONTENT_TYPE.tv ? latestEpisode : null,
        updateStatus: contentType === CONTENT_TYPE.tv ? currentEpisodeLabel : '',
        season: ''
      },
      playCatalog,
      playback: null,
      source: {
        name: sourceManifest.name,
        domain: 'moovie.c2v2.com',
        rawId: canonicalContentId,
        sourceDetailUrl: '',
        rawData: null,
        fetchedAt: ''
      }
    },
    resourceLines: [resourceLine]
  };
}

/**
 * 读取 Moovie 信息详情页主海报。
 * 纯函数: 只采用 movie-poster-img 或 og:image，并执行同源 HTTPS 门禁。
 * 成功路径: 返回可由页面展示的海报地址。
 * 失败路径: 页面没有可信海报时返回空字符串。
 *
 * @param {*} html Moovie 信息详情 HTML。
 * @returns {string} 详情海报地址或空字符串。
 */
function parseInformationDetailPoster(html) {
  // 类型: string；作用: 保存详情主海报标签，避免采用导航 Logo 或推荐内容图片。
  const source = typeof html === 'string' ? html : '';
  // 类型: string；作用: 保存 movie-poster-img 开始标签，其他页面图片不会进入详情海报解析。
  const image = source.match(/<img\b[^>]*class\s*=\s*["'][^"']*movie-poster-img[^"']*["'][^>]*>/i)?.[0] || '';
  return absoluteUrl(
    readAttribute(image, 'data-src')
      || readAttribute(image, 'src')
      || readMetaContent(source, 'property', 'og:image')
  );
}

/**
 * 解析 Moovie 详情页和资源播放页入口。
 * 纯函数: 从详情页提取标题、图片、简介，并采用已验证内部线路投影唯一 playCatalog。
 * 成功路径: 返回不含资源私有 URL 的增强 ContentItem。
 * 失败路径: 标题或内容身份缺失时抛 Error。
 *
 * @param {*} html 详情 HTML。
 * @param {Array<object>} resourceLines 已请求并解析的 Provider 内部资源线路。
 * @param {string} contentId db- 内容身份。
 * @param {string} sourceId Provider 身份。
 * @param {string} contentType 当前资源状态唯一确认的 movie/tv 类型。
 * @param {object} identityFacts 当前详情已由可见主标题和资源查询事务共同确认的标题、年份和季号事实。
 * @returns {object} 增强 ContentItem。
 */
function parseDetail(html, resourceLines, contentId, sourceId, contentType, identityFacts) {
  // 类型: string；作用: 保存详情 HTML，非文本输入按标题缺失处理。
  const source = typeof html === 'string' ? html : '';
  // 类型: string；作用: 复用详情与资源查询已经共同确认的规范标题，避免再次把嵌套年份并入作品名。
  const title = cleanText(identityFacts?.title);
  // 条件分支: 页面没有可信标题时进入。
  // 执行内容: 抛错阻止空标题详情进入统一响应。
  if (!title) throw new Error('Moovie 详情标题无法解析');
  // 类型: string；作用: 保存通过详情海报专用解析器取得的同源 HTTPS 地址。
  const poster = parseInformationDetailPoster(source);
  // 类型: string；作用: 保存简介区块纯文本。
  const description = cleanText(
    source.match(/<(?:div|p)\b[^>]*class\s*=\s*["'][^"']*(?:summary|overview|description)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p)>/i)?.[1]
      || readMetaContent(source, 'name', 'description')
  );
  // 条件分支: 调用方没有交付已验证平台类型时进入。
  // 执行内容: 失败关闭，不从详情标题、简介、JSON-LD 或推荐区文案猜测类型。
  if (!Object.values(CONTENT_TYPE).includes(contentType)) throw new Error('Moovie 详情类型无效');
  // 类型: object；作用: 只把已验证内部线路投影成公共目录，不交付资源地址和页面 HTML。
  const playCatalog = createPlayCatalog(resourceLines);
  // 类型: Array<number>；作用: 汇总全部线路明确正集号，线路数量和数组位置不参与集数计算。
  const regularEpisodeNumbers = resourceLines
    .flatMap(line => line.episodes)
    .map(episode => episode.episodeNumber)
    .filter(episodeNumber => Number.isSafeInteger(episodeNumber));
  // 类型: number|null；作用: 保存各线路能够共同证明的最新正集号，未知时不猜测总集数。
  const latestEpisode = regularEpisodeNumbers.length ? Math.max(...regularEpisodeNumbers) : null;
  return {
    id: contentId,
    sourceId,
    sourceName: sourceManifest.name,
    type: contentType,
    title,
    originalTitle: '',
    aliases: [],
    poster,
    cover: poster,
    description,
    year: identityFacts?.year || '',
    area: '',
    language: '',
    genres: [],
    tags: [],
    displayTags: [],
    score: null,
    quality: '',
    rank: null,
    badge: '',
    detail: {
      fullDescription: description,
      directors: [],
      writers: [],
      actors: [],
      releaseDate: '',
      updateTime: '',
      status: '',
      screenshots: [],
      trailerUrl: ''
    },
    movie: { duration: '' },
    tv: {
      totalEpisodes: null,
      latestEpisode: contentType === CONTENT_TYPE.tv ? latestEpisode : null,
      updateStatus: '',
      season: identityFacts?.seasonNumber ? `第${identityFacts.seasonNumber}季` : ''
    },
    playCatalog,
    playback: null,
    source: {
      name: sourceManifest.name,
      domain: 'moovie.c2v2.com',
      rawId: contentId,
      sourceDetailUrl: `${BASE_URL}/movie/${contentId.slice(3)}`,
      rawData: null,
      fetchedAt: ''
    }
  };
}

/**
 * 解析播放页直连媒体。
 * 纯函数: 依次读取 source、og:video 和 initPlayer 第二参数，只解析脚本字符串而不运行页面脚本。
 * 成功路径: 返回 HTTPS MP4/HLS 和媒体类型。
 * 失败路径: 没有直连媒体返回 null。
 *
 * @param {*} html 播放页 HTML。
 * @returns {object|null} 媒体结果。
 */
function parseDirectMedia(html) {
  // 类型: string；作用: 保存播放页文本。
  const source = typeof html === 'string' ? html : '';
  // 类型: string；作用: 保存优先级最高的 video source 标签。
  const sourceTag = source.match(/<source\b[^>]*>/i)?.[0] || '';
  // 类型: string；作用: 保存 og:video 后备标签。
  const metaTag = source.match(/<meta\b[^>]*property\s*=\s*["']og:video["'][^>]*>/i)?.[0] || '';
  // 类型: string；作用: 保存站点当前 initPlayer(container, mediaUrl, options) 中的媒体参数。
  const scriptUrl = decodeScriptUrl(
    source.match(/\binitPlayer\s*\(\s*["'][^"']+["']\s*,\s*["']([^"']+)["']/i)?.[1] || ''
  );
  // 类型: string；作用: 保存经 HTTPS MP4/HLS 门禁的媒体 URL。
  const url = normalizeMediaUrl(readAttribute(sourceTag, 'src') || readAttribute(metaTag, 'content') || scriptUrl);
  // 条件分支: 播放页没有受支持的媒体 URL 时进入。
  // 执行内容: 返回 null，不把播放页本身误当媒体。
  if (!url) return null;
  return { url, type: url.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4' };
}

/**
 * 把首页完整卡片集合转换为平台逻辑页。
 * 纯函数: 保留 discover 解析顺序，不修改输入集合或参数。
 * 成功路径: 返回不超过请求容量的连续页条目和完整分页事实。
 * 失败路径: 非数组集合按空集合处理，非法页码和容量收敛到安全值。
 *
 * @param {*} items 首页 discover ContentItem 集合。
 * @param {*} params SourceDataRequest.params 候选。
 * @returns {object} 当前逻辑页 items 和 pagination。
 */
function createLogicalPage(items, params) {
  // 类型: Array<object>；来源: discover 首页解析结果；作用: 保留源站卡片顺序并隔离非法输入。
  const sourceItems = Array.isArray(items) ? items : [];
  // 类型: number；来源: SourceDataRequest.params.page；作用: 非法值按第一页处理。
  const page = Number.isSafeInteger(params?.page) && params.page > 0 ? params.page : 1;
  // 类型: number；来源: SourceDataRequest.params.pageSize；作用: 定义平台逻辑页容量。
  const pageSize = Number.isSafeInteger(params?.pageSize) && params.pageSize > 0
    ? params.pageSize
    : Math.max(sourceItems.length, 1);
  // 类型: number；作用: 计算当前逻辑页在完整首页集合中的连续起点。
  const startIndex = (page - 1) * pageSize;
  // 类型: Array<object>；作用: 只返回当前逻辑页，避免页面再次解释 Provider 数据。
  const pageItems = sourceItems.slice(startIndex, startIndex + pageSize);
  // 类型: number；作用: 当前 discover 快照可分页条目总数。
  const total = sourceItems.length;
  // 类型: number；作用: 按逻辑容量计算总页数，空集合保持 0。
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  return {
    items: pageItems,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      // 类型: boolean；true 允许继续请求下一逻辑页，false 表示当前快照已经耗尽。
      hasMore: page < totalPages
    }
  };
}

/**
 * 创建标准内容响应。
 * 纯函数: 只克隆 request 并组合清洗结果。
 * 成功路径: 列表和单内容返回符合 v5 精确外壳。
 * 失败路径: 无；输入清洗由上游函数完成。
 *
 * @param {object} request SourceDataRequest。
 * @param {Array<object>} items 列表内容。
 * @param {object|null} item 单内容。
 * @param {object|null} pagination 分页对象。
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
 * 创建 Moovie 目录筛选响应。
 * 纯函数: 不请求网络；unknown total 不被伪造为固定总页数。
 * 成功路径: movie 不伪造筛选组，tv 只返回三个真实分区和全部中性项。
 * 失败路径: 非 movie/tv 页面抛 Error。
 *
 * @param {object} request SourceFilterMetaRequest。
 * @returns {object} SourceFilterMetaResponse。
 */
function createFilterResponse(request) {
  // 类型: Array<object>；作用: 电影源站没有当前可用筛选维度时保持空组，电视剧只发布真实 category。
  const groups = request.pageKey === 'tv'
    ? [{
      name: 'category',
      label: '分类',
      options: [
        { label: '全部', value: 'all', count: 0, active: true },
        ...TV_CATALOG_POLICY.sectionKeys.map(sectionKey => ({
          label: DISCOVER_SECTION[sectionKey].label,
          value: sectionKey,
          count: 0,
          active: false
        }))
      ]
    }]
    : [];
  return {
    sourceId: request.sourceId,
    pageKey: request.pageKey,
    request: JSON.parse(JSON.stringify(request)),
    groups,
    meta: { status: 'ready', message: '', fetchedAt: '' }
  };
}

/**
 * 创建 Moovie Provider。
 * 副作用: 保存 Context、请求序号和生命周期；HTML/HTMX 请求只使用 Shell。
 * 成功路径: 页面、详情和多来源播放均返回 v5 对象。
 * 失败路径: 网络、解析或全部播放来源失败直接抛出，不返回假成功。
 *
 * @param {object} definition SourceDefinition。
 * @returns {object} 精确 SourceProvider。
 */
function createProvider(definition) {
  // 类型: string；作用: 保存 Definition、Context、请求和响应共用 sourceId。
  const sourceId = definition.id;
  // 类型: string；作用: 保存生命周期阶段。
  let phase = PROVIDER_PHASE.created;
  // 类型: object|null；作用: 保存唯一 SourceContext，dispose 时清除。
  let activeContext = null;
  // 类型: number；作用: 生成实例内单调 requestId。
  let requestSequence = 0;
  // 类型: Map<string, object>；生命周期: 当前 Provider 运行实例；作用: 复用最近由详情或冷 player 完整解析的内容与线路事实，避免每个媒体目标重复发现全目录。
  const contentFactsById = new Map();
  // 类型: Map<string, Promise<object>>；生命周期: 当前 Provider 运行实例；作用: 合并同内容并发冷加载，防止重复详情、资源搜索和线路请求。
  const contentFactsLoads = new Map();

  /**
   * 取得运行 Context。
   * 纯函数: 只读取阶段和 Context。
   * 成功路径: 返回当前唯一 Context。
   * 失败路径: 生命周期或 signal 无效时抛 Error。
   *
   * @param {string} operation 当前操作。
   * @returns {object} SourceContext。
   */
  function requireContext(operation) {
    // 条件分支: Provider 不运行、Context 缺失或 Host 已中止时进入。
    // 执行内容: 拒绝停止后的网络和业务调用。
    if (phase !== PROVIDER_PHASE.running || !activeContext || activeContext.signal.aborted) throw new Error(`Moovie Provider 当前不能执行 ${operation}`);
    return activeContext;
  }

  /**
   * 通过当前 SourceContext 提交一条受控 Moovie Provider 信息请求。
   * 网络副作用: 递增实例 requestId 并调用 Shell；不解析 HTML、JSON 或站点业务字段。
   * 成功路径: 目标属于 manifest 精确 host 且返回 2xx 时交付完整 SourceNetworkResponse。
   * 失败路径: URL 越界、网络失败或非 2xx 状态时抛 Error，不返回半响应。
   *
   * @param {string} url 绝对 HTTPS 信息地址。
   * @param {object} options 当前端点请求选项。
   * @param {Array<object>} options.headers Provider 构造的有序请求头。
   * @param {string} options.operation 稳定操作名称，用于生命周期和错误说明。
   * @returns {Promise<object>} SourceNetworkResponse。
   */
  async function requestNetwork(url, options) {
    // 类型: object；作用: 保存当前唯一 Context，Provider 停止后不能继续提交请求。
    const context = requireContext(options.operation);
    // 类型: URL；作用: 保存经过标准 URL 解析的请求目标。
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new Error(`Moovie ${options.operation} 地址无效`);
    }
    // 条件分支: 协议、凭据或 host 越出 manifest 声明时进入。
    // 执行内容: 在 Shell 前失败关闭，Provider 自己不扩大网络权限。
    if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password
      || !sourceManifest.networkHosts.includes(parsedUrl.host)) {
      throw new Error(`Moovie ${options.operation} host 不受支持`);
    }
    // 副作用范围: 只递增当前 Provider 实例请求序号，不写 Repository、store 或私有空间。
    requestSequence += 1;
    // 类型: object；作用: 保存 Shell 返回的隔离原始响应，业务解析由具体端点函数继续处理。
    const response = await context.network.request({
      sourceId,
      requestId: `moovie-${requestSequence}`,
      url: parsedUrl.href,
      method: 'GET',
      headers: options.headers,
      body: { encoding: 'none', data: null },
      timeout: REQUEST_POLICY.timeoutMs,
      maxResponseBytes: REQUEST_POLICY.maxResponseBytes
    });
    // 条件分支: 响应缺失或最终状态不是 2xx 时进入。
    // 执行内容: 抛稳定端点错误，调用方不得把错误正文当成正常内容。
    if (!response || response.status < 200 || response.status >= 300) {
      throw new Error(`Moovie ${options.operation} 请求失败`);
    }
    return response;
  }

  /**
   * 请求 Moovie 信息 HTML/HTMX。
   * 网络副作用: 使用 GET、hx-request 和 referer；不请求媒体内容。
   * 成功路径: 返回 2xx 文本 body。
   * 失败路径: host、状态或 body 不合法时抛 Error。
   *
   * @param {string} url 信息页地址。
   * @param {string} referer 站内 referer。
   * @returns {Promise<string>} HTML/HTMX 文本。
   */
  async function requestHtml(url, referer = `${BASE_URL}/`) {
    // 类型: URL；作用: 保存待请求的绝对信息页地址。
    const parsedUrl = new URL(url);
    // 条件分支: HTML 请求目标不是 Moovie 主站时进入。
    // 执行内容: 拒绝把其他声明 host 当成 Moovie 页面解析。
    if (parsedUrl.host !== new URL(BASE_URL).host) throw new Error('Moovie 请求 host 不受支持');
    // 类型: object；作用: 保存 Shell 返回的隔离 HTML 响应。
    const response = await requestNetwork(parsedUrl.href, {
      operation: 'HTML',
      headers: [
        { name: 'accept', value: 'text/html' },
        { name: 'hx-request', value: 'true' },
        { name: 'referer', value: referer }
      ]
    });
    return decodeUtf8Body(response.body);
  }

  /**
   * 请求并解析一个 Moovie 发现页分区。
   * 网络副作用: 只通过当前 SourceContext 请求冻结分区路径，Referer 固定为 discover 页面。
   * 成功路径: 返回按源站顺序解析的标准电影或电视剧卡片。
   * 失败路径: 分区键未知、请求失败或 HTML 无法解码时抛 Error。
   *
   * @param {string} sectionKey DISCOVER_SECTION 中的分区键。
   * @returns {Promise<Array<object>>} 当前分区完整卡片集合。
   */
  async function requestDiscoverSection(sectionKey) {
    // 类型: object|undefined；作用: 从冻结站点策略取得路径、类型和展示标签。
    const section = DISCOVER_SECTION[sectionKey];
    // 条件分支: 调用方交付未知分区时进入；执行内容: 阻止拼接任意 discover 路径。
    if (!section) throw new Error('Moovie discover 分区不受支持');
    // 类型: string；作用: 保存当前分区 HTMX 原始 HTML。
    const html = await requestHtml(`${BASE_URL}${section.path}`, `${BASE_URL}/discover`);
    return parseCards(html, sourceId, section);
  }

  /**
   * 并发请求一组唯一发现页分区。
   * 网络副作用: 每个分区只调用一次 requestDiscoverSection，全部请求继续受同一 Provider 生命周期约束。
   * 成功路径: 返回以 sectionKey 为键的完整解析集合。
   * 失败路径: 任一分区失败时整体拒绝，首页和混合目录不会交付半套数据。
   *
   * @param {Array<string>} sectionKeys 需要读取的唯一分区键。
   * @returns {Promise<object>} 分区键到标准 ContentItem 数组的映射。
   */
  async function requestDiscoverSections(sectionKeys) {
    // 条件分支: 分区列表为空或包含重复项时进入；执行内容: 拒绝不确定请求计划。
    if (!Array.isArray(sectionKeys) || sectionKeys.length === 0 || new Set(sectionKeys).size !== sectionKeys.length) {
      throw new Error('Moovie discover 请求计划无效');
    }
    // 类型: Array<Array<object>>；作用: 并发取得全部分区，并保持输入键顺序。
    const sectionItems = await Promise.all(sectionKeys.map(sectionKey => requestDiscoverSection(sectionKey)));
    return Object.fromEntries(sectionKeys.map((sectionKey, index) => [sectionKey, sectionItems[index]]));
  }

  /**
   * 从 Moovie 网络加载一个内容身份的详情、精确资源目录和完整线路事实。
   * 网络副作用: 先请求同源详情和其声明的 HTMX 目录，再按资源顺序逐条请求精确同内容线路页。
   * 成功路径: 排除近似作品后返回详情 HTML、目标事实、唯一类型和包含可用/不可用状态的内部线路。
   * 失败路径: contentId、详情地址、资源入口、精确匹配或类型事实无效时抛 Error；单条线路失败只保留为不可用。
   *
   * @param {string} contentId db- 内容身份。
   * @returns {Promise<object>} 当前内容的同源详情与资源事实。
   * @returns {string} return.detailUrl 通过 db- 身份形成的 Moovie 详情地址。
   * @returns {string} return.detailHtml Moovie 详情原始 HTML。
   * @returns {object} return.identityFacts 当前详情精确内容事实。
   * @returns {Array<object>} return.resourceCards 已过滤的精确资源卡片事实。
   * @returns {Array<object>} return.resourceLines 已解析的 Provider 内部资源线路。
   * @returns {string} return.contentType 唯一确认的 movie 或 tv。
   */
  async function loadContentFacts(contentId) {
    // 类型: string；作用: 从已校验平台身份提取数字 id，拼接唯一同源详情地址。
    const numericId = parseDatabaseContentId(contentId);
    // 条件分支: 调用方交付的身份不是 db-数字时进入。
    // 执行内容: 拒绝构造无效详情地址。
    if (!numericId) throw new Error('Moovie 内容事实 contentId 无效');
    // 类型: string；作用: 保存当前内容唯一同源详情地址。
    const detailUrl = `${BASE_URL}/movie/${numericId}`;
    // 类型: string；作用: 保存详情原始 HTML，后续从页面声明读取资源入口而不重建查询参数。
    const detailHtml = await requestHtml(detailUrl);
    // 类型: string；作用: 保存详情页声明的同 host HTMX 资源接口。
    const resourceSearchUrl = extractResourceSearchUrl(detailHtml);
    // 条件分支: 详情没有声明可信资源入口时进入。
    // 执行内容: 无法获得类型和播放事实，搜索、详情与播放共同失败关闭。
    if (!resourceSearchUrl) throw new Error('Moovie 详情未声明资源入口');
    // 类型: string；作用: 保存资源接口原始 HTML，referer 与详情身份保持一致。
    const resourceHtml = await requestHtml(resourceSearchUrl, detailUrl);
    // 类型: object；作用: 保存资源搜索之前已经确定的标题、外部 id、年份和季号目标事实。
    const identityFacts = parseDetailIdentityFacts(detailHtml, contentId, resourceSearchUrl);
    // 类型: Array<object>；作用: 先解析全部资源卡片，再按目标事实排除近似标题和冲突作品。
    const resourceCards = filterExactResourceCards(parseResourceCards(resourceHtml), identityFacts);
    // 类型: string；作用: 只从精确同内容资源集合形成唯一平台类型。
    const contentType = parseResourceContentType(resourceCards);
    // 类型: string；作用: 详情海报只用于公共分集 cover，不影响线路或剧集身份。
    const poster = parseInformationDetailPoster(detailHtml);
    // 类型: Array<object>；作用: 按源站资源顺序累计成功线路和请求失败占位，不并发轰炸同一站点。
    const resourceLines = [];
    // 循环类型: for...of + await；初始值: 第一张精确资源卡片；终止条件: 全部线路完成一次受控请求；作用: 避免短时并发触发源站防御。
    for (const resourceCard of resourceCards) {
      try {
        // 类型: string；作用: 保存当前线路资源页 HTML，Referer 绑定信息详情。
        const lineHtml = await requestHtml(resourceCard.playUrl, detailUrl);
        resourceLines.push(parseResourceLinePage(lineHtml, resourceCard, contentType, poster));
      } catch {
        // 失败边界: 单条线路请求或解析失败只保留同一稳定身份的不可用目录项，其他线路继续按顺序加载。
        resourceLines.push(createUnavailableResourceLine(resourceCard, contentType, poster));
      }
    }
    // 执行内容: 在返回详情前验证线路身份唯一性和默认线路可确定，防止 player 才暴露冲突。
    createPlayCatalog(resourceLines);
    return { detailUrl, detailHtml, identityFacts, resourceCards, resourceLines, contentType };
  }

  /**
   * 读取当前 Provider 会话中的 Moovie 内容事实。
   * 副作用: 缓存未命中或 refresh=true 时调用 loadContentFacts；成功后替换当前 contentId 的内存事实，不写 SourceContext.storage。
   * 成功路径: player 复用最近详情事实；冷 player 完成一次加载后供同内容后续线路和分集请求复用；并发调用共享同一 Promise。
   * 失败路径: 网络或解析失败不写缓存并向调用方传播；旧成功缓存保持，后续显式 detail 可以重新刷新。
   *
   * @param {string} contentId db- 内容身份。
   * @param {object} options 读取策略。
   * @param {boolean} options.refresh true 强制从源站刷新，false 优先复用当前 Provider 会话事实。
   * @returns {Promise<object>} 当前内容的同源详情与资源事实。
   */
  async function requestContentFacts(contentId, options = { refresh: false }) {
    // 类型: boolean；作用: 只有详情入口显式传入 true 时刷新，player 不自行重复发现完整目录。
    const shouldRefresh = options?.refresh === true;
    // 类型: Promise<object>|undefined；作用: 同内容已有冷加载或刷新在途时所有调用共享一个网络事务。
    const activeLoad = contentFactsLoads.get(contentId);
    // 条件分支: 当前内容已有在途加载时进入；执行内容: 返回同一 Promise，不创建重复详情和线路请求。
    if (activeLoad) return activeLoad;
    // 条件分支: 调用方不要求刷新且存在最近成功事实时进入；执行内容: 直接复用 Provider 私有内存对象。
    if (!shouldRefresh && contentFactsById.has(contentId)) return contentFactsById.get(contentId);

    // 类型: Promise<object>；作用: 唯一加载任务在成功后采用缓存，并在任意终态清理在途索引。
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
   * 为已经构造完整目录的 ContentItem 解析一个精确浏览器直连媒体。
   * 网络副作用: 只在目标选集不是已请求线路页时再次请求该选集的私有 playUrl。
   * 成功路径: 返回新 ContentItem，并只写入请求 lineId/episodeId 对应的 playback.media。
   * 失败路径: 身份缺失、线路不可用、目标缺集或直连媒体无效时抛 Error；输入 item 和旧播放会话不被修改。
   *
   * @param {object} item 已包含完整 playCatalog 的内容对象。
   * @param {Array<object>} resourceLines 与目录同源的 Provider 内部线路。
   * @param {*} params SourceDataRequest.params。
   * @returns {Promise<object>} 带精确 playback 的新 ContentItem。
   */
  async function resolvePlaybackItem(item, resourceLines, params) {
    // 类型: object；作用: 严格解析请求线路和逻辑剧集，不允许默认首项或相邻集回退。
    const selection = resolveRequestedPlaybackTarget(resourceLines, params);
    // 类型: string；作用: 目标恰好是已经请求的线路页时复用正文，否则请求该分集的私有资源页。
    const playbackHtml = selection.target.playUrl === selection.line.pageUrl
      ? selection.line.pageHtml
      : await requestHtml(selection.target.playUrl, selection.line.pageUrl);
    // 类型: object|null；作用: 只解析源页公开的 HTTPS MP4/HLS 直连地址。
    const media = parseDirectMedia(playbackHtml);
    // 条件分支: 目标页面没有合法直连媒体时进入；执行内容: 请求失败关闭，平台继续保留旧媒体。
    if (!media) throw new Error('Moovie 资源播放地址不可用');
    // 类型: string；作用: 电影优先采用详情质量，缺失时用当前线路 feature 标签；电视剧未知质量保持空字符串。
    const quality = item.quality
      || (selection.target.episode.kind === 'feature' ? selection.target.episode.label : '');
    return {
      ...item,
      playback: {
        lineId: selection.line.id,
        episodeId: selection.target.episode.id,
        media: {
          type: media.type,
          url: media.url,
          quality,
          deliveryMode: 'direct'
        }
      }
    };
  }

  /**
   * 获取内容、详情或播放响应。
   * 网络副作用: 详情请求读取全部精确线路；播放请求在同一目录上再解析一个精确媒体目标。
   * 成功路径: detail 返回完整 playCatalog，player 返回同目录和唯一 playback.media。
   * 失败路径: 参数、精确匹配、线路、分集或媒体失败时抛稳定 Error，不交付部分播放结果。
   *
   * @param {object} request SourceDataRequest。
   * @returns {Promise<object>} SourceDataResponse。
   */
  async function fetchData(request) {
    // 类型: object；作用: 保存页面请求参数。
    const params = request.params || {};
    // 类型: number；作用: 保存搜索/目录回填页码。
    const page = Number.isSafeInteger(params.page) && params.page > 0 ? params.page : 1;
    // 条件分支: detail/player 请求时进入。
    // 执行内容: 读取完整播放目录；只有 player 再按精确线路和逻辑分集解析单一媒体。
    if (request.pageKey === 'detail' || request.pageKey === 'player') {
      // 类型: string；作用: 保存页面传入的 Provider 内容身份，允许 discover 的 db- 或搜索的 resource: 两种正式形式。
      const contentId = typeof params.contentId === 'string' ? params.contentId : '';
      // 类型: string；作用: 尝试从可逆搜索身份恢复同源资源页；空值表示继续使用 discover 的 db- 链。
      const resourceUrl = resolveResourceContentUrl(contentId);
      // 条件分支: 身份声明 resource: 前缀却无法恢复合法地址时进入；执行内容: 失败关闭，不回退 db- 或临时缓存。
      if (contentId.startsWith(SEARCH_POLICY.resourceIdPrefix) && !resourceUrl) throw new Error('Moovie 资源 contentId 无效');
      // 条件分支: 当前是搜索资源身份时进入；执行内容: 直接读取资源页恢复详情、选集和目标分集媒体。
      if (resourceUrl) {
        // 类型: string；作用: 保存资源页完整 HTML，详情和默认播放共享该次响应。
        const resourceHtml = await requestHtml(resourceUrl, `${BASE_URL}/discover`);
        // 类型: object；作用: 从资源身份自身恢复增强内容和同源内部线路，不依赖搜索结果缓存或临时映射。
        const resourcePage = parseResourcePage(resourceHtml, contentId, sourceId, resourceUrl);
        // 类型: object；作用: detail 直接采用目录对象，player 通过严格选择生成带单一媒体的新对象。
        const item = request.pageKey === 'player'
          ? await resolvePlaybackItem(resourcePage.item, resourcePage.resourceLines, params)
          : resourcePage.item;
        return createResponse(request, [], item, null);
      }
      // 条件分支: 非资源身份也不符合 db-数字时进入；执行内容: 失败关闭，不猜测豆瓣 id。
      if (!parseDatabaseContentId(contentId)) {
        throw new Error('Moovie contentId 无效');
      }
      // 类型: object；作用: 通过搜索、详情和播放共用链取得同源详情、资源和唯一类型事实。
      const contentFacts = await requestContentFacts(contentId, {
        refresh: request.pageKey === 'detail'
      });
      // 类型: object；作用: 保存详情字段与资源入口共同清洗后的内容对象。
      const detail = parseDetail(
        contentFacts.detailHtml,
        contentFacts.resourceLines,
        contentId,
        sourceId,
        contentFacts.contentType,
        contentFacts.identityFacts
      );
      // 类型: object；作用: detail 采用完整目录，player 只为请求身份解析一个直连媒体。
      const item = request.pageKey === 'player'
        ? await resolvePlaybackItem(detail, contentFacts.resourceLines, params)
        : detail;
      return createResponse(request, [], item, null);
    }

    // 条件分支: 首页请求时进入；执行内容: 按 moduleKey 选择具名分区与切片，再执行平台逻辑分页。
    if (request.pageKey === 'home') {
      // 类型: Array<object>|undefined；作用: 读取当前首页数据桶冻结映射。
      const policy = HOME_DISCOVER_POLICY[request.moduleKey];
      // 条件分支: moduleKey 没有正式映射时进入；执行内容: 拒绝把首页请求默认为任意电影列表。
      if (!policy) throw new Error('Moovie 首页 moduleKey 不受支持');
      // 类型: Array<string>；作用: 提取当前模块真正依赖的唯一分区，避免重复请求。
      const sectionKeys = collectPolicySectionKeys(policy);
      // 类型: object；作用: 保存当前模块所需的完整分区解析集合。
      const itemsBySection = await requestDiscoverSections(sectionKeys);
      // 类型: boolean；作用: 两个排行榜模块需要在切片合并后生成连续 rank。
      const ranked = request.moduleKey === 'movieRanking' || request.moduleKey === 'tvRanking';
      // 类型: Array<object>；作用: 按冻结策略生成当前模块全部候选，不在页面切片。
      const moduleItems = createPolicyItems(itemsBySection, policy, ranked);
      // 类型: object；作用: 把模块候选按标准请求页码和 pageSize 转换为连续逻辑页。
      const logicalPage = createLogicalPage(moduleItems, params);
      return createResponse(request, logicalPage.items, null, logicalPage.pagination);
    }

    // 条件分支: 电影目录请求时进入；执行内容: 请求热门电影完整分区并按十二条连续分页。
    if (request.pageKey === 'movie') {
      // 类型: Array<object>；作用: 保存当前热门电影分区全部源站卡片。
      const movieItems = await requestDiscoverSection('movie');
      // 类型: object；作用: 生成请求页对应的连续逻辑页和已知总量。
      const logicalPage = createLogicalPage(movieItems, params);
      return createResponse(request, logicalPage.items, null, logicalPage.pagination);
    }

    // 条件分支: 电视剧目录请求时进入；执行内容: category=all 生成三分区混合页，具体分类只请求目标分区。
    if (request.pageKey === 'tv') {
      // 类型: string；作用: all 表示三个分区混合，其他值必须是冻结分区键。
      const category = typeof params.category === 'string' && params.category.trim()
        ? params.category.trim()
        : 'all';
      // 条件分支: 当前为未筛选混合目录时进入；执行内容: 并发读取三个分区并各取当前页六条。
      if (category === 'all') {
        // 类型: object；作用: 保存热门剧集、热门综艺和日本动画三个完整解析集合。
        const itemsBySection = await requestDiscoverSections([...TV_CATALOG_POLICY.sectionKeys]);
        // 类型: object；作用: 按同一连续窗口生成三分区各六条的当前逻辑页。
        const mixedPage = createMixedTvPage(itemsBySection, params);
        return createResponse(request, mixedPage.items, null, mixedPage.pagination);
      }
      // 条件分支: 分类不是电视剧三个真实分区时进入；执行内容: 拒绝拼接未知路径。
      if (!TV_CATALOG_POLICY.sectionKeys.includes(category)) throw new Error('Moovie 电视剧 category 不受支持');
      // 类型: Array<object>；作用: 保存用户选择分区的完整卡片集合。
      const categoryItems = await requestDiscoverSection(category);
      // 类型: object；作用: 对单分区按请求的十八条容量连续分页。
      const logicalPage = createLogicalPage(categoryItems, params);
      return createResponse(request, logicalPage.items, null, logicalPage.pagination);
    }

    // 条件分支: 搜索页请求时进入；执行内容: 请求真实资源搜索端点并保留源站分页事实。
    if (request.pageKey === 'search') {
      // 类型: string；作用: 保存清理后的搜索关键词。
      const keyword = typeof params.keyword === 'string' ? params.keyword.trim() : '';
      // 条件分支: 关键词为空时进入。
      // 执行内容: 拒绝无关键词 HTMX 请求。
      if (!keyword) throw new Error('Moovie 搜索缺少 keyword');
      // 类型: number；作用: 搜索平台容量必须与源站每页上限一致，避免跨源站页切片造成遗漏。
      const pageSize = Number.isSafeInteger(params.pageSize) && params.pageSize > 0
        ? params.pageSize
        : SEARCH_POLICY.pageSize;
      // 条件分支: 平台请求容量偏离冻结十二条时进入；执行内容: 明确失败，不按页内二次切片猜测全局位置。
      if (pageSize !== SEARCH_POLICY.pageSize) throw new Error('Moovie 搜索 pageSize 无效');
      // 类型: string；作用: 使用标准 URL API 构造 kw、空 year 和当前 page 的真实资源搜索地址。
      const url = createSearchUrl(keyword, page);
      // 类型: string；作用: 保存搜索 HTMX 原始 HTML，referer 绑定公开 discover 页面。
      const cardsHtml = await requestHtml(url, `${BASE_URL}/discover`);
      // 类型: Array<object>；作用: 当前源站页的每张资源卡片独立形成 ContentItem，不按标题或豆瓣 id 合并。
      const items = parseSearchResourceCards(cardsHtml, sourceId).slice(0, pageSize);
      // 类型: object；作用: 只读取源站下一页按钮，不猜测 total 或 totalPages。
      const paginationFacts = parseSearchPagination(cardsHtml, keyword, page);
      return createResponse(request, items, null, {
        page,
        pageSize,
        total: null,
        totalPages: null,
        hasMore: paginationFacts.hasMore
      });
    }
    throw new Error('Moovie 页面请求不受支持');
  }

  /**
   * 获取 Moovie 目录筛选元数据。
   * 副作用: 只验证运行阶段，不请求网络或写缓存。
    * 成功路径: movie 返回空组，tv 返回 category 真实分区组。
   * 失败路径: 其他页面抛不支持错误。
   *
   * @param {object} request SourceFilterMetaRequest。
   * @returns {Promise<object>} SourceFilterMetaResponse。
   */
  async function fetchFilterMeta(request) {
    // 类型: object；作用: 校验运行阶段，不保存第二份 Context。
    requireContext('fetchFilterMeta');
    // 条件分支: pageKey 不是 movie/tv 时进入。
    // 执行内容: 拒绝为搜索或详情生成目录筛选。
    if (request.pageKey !== 'movie' && request.pageKey !== 'tv') throw new Error('筛选页不受支持');
    return createFilterResponse(request);
  }

  /**
   * 检查 Moovie 代表性内容入口。
   * 网络副作用: 请求热门电影发现页，并复用正式目录请求和卡片解析链。
   * 成功路径: 2xx 响应能够解析出至少一条标准电影卡片时返回 normal。
   * 失败路径: 网络失败、200 错误页、空壳页或卡片结构失效时返回 unavailable。
   *
   * @returns {Promise<object>} SourceHealthCheckResult。
   */
  async function checkHealth() {
    // 类型: string；作用: 保存本次检测最终状态，只有代表性目录形成标准内容后才改为 normal。
    let healthStatus = 'unavailable';
    // 类型: string；作用: 保存面向用户的失败原因；成功结果必须清空。
    let unavailableReason = 'Moovie 请求失败';
    try {
      // 类型: Array<object>；作用: 复用正式热门电影目录请求与解析，防止任意 2xx 文本产生假绿色。
      const representativeItems = await requestDiscoverSection(DISCOVER_SECTION.movie.key);
      // 条件分支: 代表性入口没有形成任何标准内容时进入；执行内容: 保持不可用并交付结构失效原因。
      if (!representativeItems.length) {
        unavailableReason = 'Moovie 内容结构不可用';
      } else {
        healthStatus = 'normal';
        unavailableReason = '';
      }
    } catch (error) {
      // 失败边界: 网络、状态、解码或解析错误保持默认 unavailable，不泄漏底层异常。
    }
    return { healthStatus, checkedAt: new Date().toISOString(), unavailableReason };
  }

  /**
   * Moovie 当前没有已审人工挑战格式。
   * 纯函数: 不读 Context 或页面。
   * 成功路径: 返回 null。
   * 失败路径: 无。
   *
   * @returns {Promise<null>} 固定 null。
   */
  async function detectChallenge() {
    return null;
  }

  /**
   * 转发统一挑战结果。
   * 副作用: 只校验运行阶段，不保存用户输入。
   * 成功路径: 返回 Host 输入。
   * 失败路径: Provider 不运行时抛 Error。
   *
   * @param {*} challengeInput 统一挑战结果。
   * @returns {Promise<*>} 原挑战结果。
   */
  async function continueChallenge(challengeInput) {
    // 类型: object；作用: 校验 Provider 仍运行，不落盘挑战输入。
    requireContext('continueChallenge');
    return challengeInput;
  }

  return Object.freeze({
    id: sourceId,
    /**
     * 初始化 Provider。
     * 副作用: 保存同源 Context 并切换到 initialized。
     * 成功路径: 首次同源初始化完成。
     * 失败路径: 重复或跨源初始化抛 Error。
     * @param {object} context SourceContext。
     * @returns {Promise<void>} 初始化结果。
     */
    initialize(context) {
      // 条件分支: 初始化顺序、Context 或 sourceId 不符合时进入。
      // 执行内容: 拒绝重复或跨源采用 Context。
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
      // 条件分支: initialize 未成功时进入。
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
      // 条件分支: Provider 已释放时进入。
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
      contentFactsById.clear();
      contentFactsLoads.clear();
      activeContext = null;
      phase = PROVIDER_PHASE.disposed;
      return Promise.resolve();
    }
  });
}

/**
 * 创建 Moovie ProviderFactory。
 * 纯函数: 只返回身份匹配工厂，不请求网络或共享 Provider 状态。
 * 成功路径: supports 匹配身份，create 返回独立实例。
 * 失败路径: 身份不匹配时 supports false 或 create 抛 Error。
 *
 * @returns {object} ProviderFactory。
 */
export function createProviderFactory() {
  return Object.freeze({
    providerKey: sourceManifest.providerKey,
    /**
     * 判断 Definition 是否由当前单文件实现。
     * 纯函数: 只比较身份字段。
     * @param {*} definition SourceDefinition。
     * @returns {boolean} 是否支持。
     */
    supports(definition) {
      return Boolean(definition
        && definition.id === sourceManifest.id
        && definition.providerKey === sourceManifest.providerKey);
    },
    /**
     * 创建 Moovie Provider。
     * 副作用: 创建新的闭包状态，不启动或请求网络。
     * 成功路径: 身份匹配时返回 Provider。
     * 失败路径: 身份不匹配时抛 Error。
     * @param {object} options Host 创建参数。
     * @returns {object} Provider 实例。
     */
    create({ definition }) {
      // 条件分支: Definition 身份或 providerKey 不匹配时进入。
      // 执行内容: 拒绝当前单文件创建其他数据源。
      if (!definition
        || definition.id !== sourceManifest.id
        || definition.providerKey !== sourceManifest.providerKey) throw new Error('Definition 不受支持');
      return createProvider(definition);
    }
  });
}
