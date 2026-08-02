/*
  playerNavigationService.js 模块说明

  - 文件职责:
      集中把播放内容身份、分集、线路和自动播放意图转换为 Vue Router 播放页目标。
      供首页轮播、详情页、个人中心历史记录和 PlayerView 共用，避免页面分别拼接播放 query 或保存第二套播放上下文。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      findPlayCatalogLine/findPlayCatalogEpisode/resolveInitialPlayCatalogLineId: 自定义服务函数，精确定位目录线路、逻辑剧集和默认恢复线路。

  - 模块级常量:
      PLAYER_ROUTE_NAME: string，播放页命名路由。
      PLAYER_ENTRY_ROUTE_NAME: string，无内容身份播放一级入口命名路由。
      PLAYER_QUERY_KEYS: object，播放上下文使用的 query 字段名。
      AUTOPLAY_ENABLED_VALUE: string，明确自动播放意图的标准 query 值。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeRouteText(value): 将路由字段整理为无首尾空白的字符串。
      normalizeEpisodeIndex(value): 将分集序号整理为正整数或 null。
      applyTextQueryField(query, context, contextKey, queryKey): 按显式上下文字段写入或删除文本 query。
      applyEpisodeIndexQueryField(query, context): 按显式上下文字段写入或删除分集序号 query。
      applyAutoplayQueryField(query, context): 按显式上下文字段写入或删除自动播放 query。
      resolveContentPlaySelection(contentItem, context): 从唯一 playCatalog 解析可导航线路、逻辑剧集和展示序号。

  - 模块级类:
      无

  - 对外导出:
      createPlayerRouteContext: Function，从真实播放路由创建常驻宿主可持有的只读请求上下文。
      createPlayerNavigationTarget: Function，根据播放上下文和既有 query 创建播放页路由目标。
      createContentPlaybackNavigationTarget: Function，根据 ContentItem 和播放意图创建默认分集/线路目标。
*/

// 导入来源: ./playCatalogSelectionService.js。
// 导入内容: findPlayCatalogLine、findPlayCatalogEpisode 与 resolveInitialPlayCatalogLineId 自定义服务函数。
// 文件作用: 只从统一 playCatalog 精确选择线路和逻辑剧集，不在导航层解释 Provider 数据。
import {
  findPlayCatalogLine,
  findPlayCatalogEpisode,
  resolveInitialPlayCatalogLineId
} from './playCatalogSelectionService.js';

// 类型: string。
// 作用: 所有播放导航统一使用命名路由，避免页面散落播放路径字符串。
const PLAYER_ROUTE_NAME = 'player';

// 类型: string。
// 作用: 标识不携带内容身份的播放一级入口，常驻宿主采用后展示有意空状态。
const PLAYER_ENTRY_ROUTE_NAME = 'player-entry';

// 类型: object。
// 作用: 集中定义可刷新播放上下文的 query 字段，字段名必须与 PlayerView 路由读取契约一致。
const PLAYER_QUERY_KEYS = Object.freeze({
  // 类型: string。
  // 作用: 保存电视剧逻辑剧集 id，刷新后按同一 ContentItem 目录精确定位。
  episodeId: 'episodeId',

  // 类型: string。
  // 作用: 保存电视剧展示序号，只用于历史兼容和页面定位，不代替逻辑剧集 id 匹配。
  episodeIndex: 'episodeIndex',

  // 类型: string。
  // 作用: 保存当前播放线路 id，刷新后恢复用户选择的线路。
  playbackSourceId: 'playbackSourceId',

  // 类型: string。
  // 作用: 保存进入播放页后是否应立即恢复播放状态的显式意图。
  autoplay: 'autoplay'
});

// 类型: string。
// 作用: 使用单一稳定值表达已启用自动播放，PlayerView 同时保留对外部 true 文本的读取兼容。
const AUTOPLAY_ENABLED_VALUE = '1';

/**
 * 将路由字段整理为稳定字符串。
 * 纯函数: 只读取 value，不修改调用方对象或路由。
 * 失败路径: null、undefined 和空白文本返回空字符串，由调用方删除可选 query 或拒绝必填身份。
 *
 * @param {*} value 路由参数、历史字段或页面上下文字段。
 * @returns {string} 去除首尾空白后的文本。
 */
function normalizeRouteText(value) {
  // 条件分支: value 为 null 或 undefined 时进入。
  // 执行内容: 返回空文本，让调用方删除可选 query 或拒绝必填身份。
  if (value === null || value === undefined) {
    return '';
  }

  // 返回值类型: string。
  // 作用: 数字等可标识输入转成字符串后清理空白，保证路由比较稳定。
  return String(value).trim();
}

/**
 * 将分集序号整理为正整数。
 * 纯函数: 只读取 value，不修改调用方上下文。
 * 失败路径: 非数字、零和负数返回 null，路由不保存无效分集序号。
 *
 * @param {*} value 历史记录或分集对象提供的分集序号。
 * @returns {number|null} 有效正整数或 null。
 */
function normalizeEpisodeIndex(value) {
  // 类型: number。
  // 作用: 把字符串 query 和数字字段统一转换为可校验数字。
  const episodeIndex = Number(value);

  // 返回值类型: number|null。
  // 作用: 只保留大于零的整数，避免小数和非法文本进入可刷新播放上下文。
  return Number.isInteger(episodeIndex) && episodeIndex > 0 ? episodeIndex : null;
}

/**
 * 从 Vue Router 的真实播放地址创建常驻宿主请求上下文。
 * 纯函数: 只读取路由 name/fullPath/params/query，返回冻结副本，不修改 Router 或媒体状态。
 * 调用方: PlayerView 仅在 createRouteRequestGuard 接受新的播放 fullPath 后采用。
 * 成功路径: player-entry 返回空内容上下文；严格 player 返回内容、分集、线路、自动播放和原 query。
 * 失败路径: 普通路由、非法路由对象或缺少严格 sourceId/videoId 时返回 null。
 *
 * @param {object} route Vue Router 当前路由对象。
 * @returns {Readonly<object>|null} 常驻 PlayerView 的活动播放路由上下文或 null。
 */
export function createPlayerRouteContext(route) {
  // 类型: object；作用: 非对象路由使用空对象，统一进入非播放路由失败路径。
  const safeRoute = route && typeof route === 'object' && !Array.isArray(route) ? route : {};
  // 类型: string；作用: 只允许播放一级入口和严格播放路由生成宿主上下文。
  const routeName = normalizeRouteText(safeRoute.name);
  // 条件分支: 当前地址不属于两个播放路由时进入。
  // 执行内容: 返回 null，普通路由不能改写常驻媒体请求身份。
  if (routeName !== PLAYER_ROUTE_NAME && routeName !== PLAYER_ENTRY_ROUTE_NAME) {
    return null;
  }

  // 类型: object；作用: 过滤非法 params，播放一级入口自然得到空内容身份。
  const params = safeRoute.params && typeof safeRoute.params === 'object' && !Array.isArray(safeRoute.params)
    ? safeRoute.params
    : {};
  // 类型: object；作用: 过滤非法 query，并在返回前复制，避免 Vue Router 后续替换影响已采用上下文。
  const query = safeRoute.query && typeof safeRoute.query === 'object' && !Array.isArray(safeRoute.query)
    ? safeRoute.query
    : {};
  // 类型: string；作用: 严格播放请求所属数据源身份。
  const sourceId = normalizeRouteText(params.sourceId);
  // 类型: string；作用: 严格播放请求的内容身份，路由 videoId 在上下文中恢复通用 contentId 语义。
  const contentId = normalizeRouteText(params.videoId);

  // 条件分支: 严格 player 路由缺少任一必填身份时进入。
  // 执行内容: 返回 null，不让常驻宿主回退默认源或旧内容。
  if (routeName === PLAYER_ROUTE_NAME && (!sourceId || !contentId)) {
    return null;
  }

  // 类型: string；作用: 标准化 autoplay query，兼容现有 1 和 true 两种显式启用值。
  const autoplayValue = normalizeRouteText(query[PLAYER_QUERY_KEYS.autoplay]).toLowerCase();
  // 类型: object；作用: 隔离当前真实播放 query，播放器内部导航只基于这份已采用上下文保留字段。
  const contextQuery = Object.freeze({ ...query });

  return Object.freeze({
    // 类型: string；作用: player-entry 展示空状态，player 进入严格内容请求。
    routeName,
    // 类型: string；作用: 记录本次守卫采用的完整 URL 身份，供调试和契约核对。
    fullPath: normalizeRouteText(safeRoute.fullPath),
    // 类型: string；作用: 严格播放数据源身份；一级入口为空字符串。
    sourceId,
    // 类型: string；作用: 严格播放内容身份；一级入口为空字符串。
    contentId,
    // 类型: string；作用: 已采用播放 URL 的分集 id，普通路由 query 不会覆盖它。
    episodeId: normalizeRouteText(query[PLAYER_QUERY_KEYS.episodeId]),
    // 类型: number|null；作用: 已采用播放 URL 的正整数分集序号。
    episodeIndex: normalizeEpisodeIndex(query[PLAYER_QUERY_KEYS.episodeIndex]),
    // 类型: string；作用: 已采用播放 URL 的线路 id，普通路由 query 不会让它回退默认线路。
    playbackSourceId: normalizeRouteText(query[PLAYER_QUERY_KEYS.playbackSourceId]),
    // 类型: boolean；true 继承明确自动播放意图，false 保持手动播放。
    autoplay: autoplayValue === AUTOPLAY_ENABLED_VALUE || autoplayValue === 'true',
    // 类型: Readonly<object>；作用: 播放器内部切集/切线时保留当前播放地址的其他合法 query。
    query: contextQuery
  });
}

/**
 * 按显式上下文字段更新文本 query。
 * 副作用: 只修改当前函数接收的新 query 副本，不修改 baseQuery 或 context。
 * 维护规则: context 没有声明该字段时保留既有 query；显式传入空值时删除对应字段。
 *
 * @param {object} query 当前正在构造的 query 副本。
 * @param {object} context 本次希望采用的播放上下文。
 * @param {string} contextKey context 中的字段名。
 * @param {string} queryKey Vue Router query 中的字段名。
 * @returns {void} 结果直接写入 query 副本。
 */
function applyTextQueryField(query, context, contextKey, queryKey) {
  // 条件分支: 调用方没有声明该上下文字段时进入。
  // 执行内容: 保留现有 query，支持只切线路而不丢分集。
  if (!Object.prototype.hasOwnProperty.call(context, contextKey)) {
    return;
  }

  // 类型: string。
  // 作用: 标准化本次显式字段，空文本表示调用方要求清除对应上下文。
  const value = normalizeRouteText(context[contextKey]);

  // 条件分支: 字段存在有效文本时进入。
  // 执行内容: 写入新 query；否则删除旧值，避免刷新继续恢复失效上下文。
  if (value) {
    query[queryKey] = value;
  } else {
    delete query[queryKey];
  }
}

/**
 * 按显式上下文字段更新分集序号 query。
 * 副作用: 只修改当前 query 副本。
 * 失败路径: 显式分集序号无效时删除旧 query，防止 id 已切换但旧序号残留。
 *
 * @param {object} query 当前正在构造的 query 副本。
 * @param {object} context 本次希望采用的播放上下文。
 * @returns {void} 结果直接写入 query 副本。
 */
function applyEpisodeIndexQueryField(query, context) {
  // 条件分支: 调用方没有声明 episodeIndex 时进入。
  // 执行内容: 保留既有分集序号，不干扰只切换线路的导航。
  if (!Object.prototype.hasOwnProperty.call(context, 'episodeIndex')) {
    return;
  }

  // 类型: number|null。
  // 作用: 只允许有效正整数进入路由查询参数。
  const episodeIndex = normalizeEpisodeIndex(context.episodeIndex);

  // 条件分支: episodeIndex 是有效正整数时进入。
  // 执行内容: 以字符串写入 Vue Router query；无效时删除旧序号。
  if (episodeIndex) {
    query[PLAYER_QUERY_KEYS.episodeIndex] = String(episodeIndex);
  } else {
    delete query[PLAYER_QUERY_KEYS.episodeIndex];
  }
}

/**
 * 按显式上下文字段更新自动播放 query。
 * 副作用: 只修改当前 query 副本。
 * 维护规则: context 未声明 autoplay 时原样保留；true、1 或 true 文本统一写入标准值，其余显式值删除。
 *
 * @param {object} query 当前正在构造的 query 副本。
 * @param {object} context 本次希望采用的播放上下文。
 * @returns {void} 结果直接写入 query 副本。
 */
function applyAutoplayQueryField(query, context) {
  // 条件分支: 调用方没有声明 autoplay 时进入。
  // 执行内容: 保留入口已有意图，不擅自开始或停止播放。
  if (!Object.prototype.hasOwnProperty.call(context, 'autoplay')) {
    return;
  }

  // 类型: string。
  // 作用: 将布尔值和 query 文本统一成可比较的小写字符串。
  const autoplayValue = normalizeRouteText(context.autoplay).toLowerCase();

  // 类型: boolean。
  // 作用: 只有明确 true、1 或 true 文本表示启用，其他显式值都表示移除自动播放意图。
  const shouldAutoPlay = context.autoplay === true
    || autoplayValue === AUTOPLAY_ENABLED_VALUE
    || autoplayValue === 'true';

  // 条件分支: 上下文明确启用自动播放时进入。
  // 执行内容: 写入标准值；禁用时删除旧字段，避免刷新后继续自动播放。
  if (shouldAutoPlay) {
    query[PLAYER_QUERY_KEYS.autoplay] = AUTOPLAY_ENABLED_VALUE;
  } else {
    delete query[PLAYER_QUERY_KEYS.autoplay];
  }
}

/**
 * 从 ContentItem.playCatalog 解析本次播放导航目标。
 * 纯函数: 只读取目录和调用方上下文，不修改数组、内容对象或路由。
 * 成功路径: 先确定明确或默认线路，再按逻辑 episodeId 或首个可播放条目生成同一线路目标。
 * 失败路径: 目录、线路、逻辑剧集或可播放状态不完整时返回 null，不回退相邻集、末集或其他线路。
 *
 * @param {object} contentItem 统一 ContentItem。
 * @param {object} context 播放入口显式上下文。
 * @returns {object|null} 线路、逻辑剧集和一基展示序号选择；无法播放时返回 null。
 */
function resolveContentPlaySelection(contentItem, context) {
  // 类型: object|null；作用: 只接受标准 playCatalog 对象，导航不读取其他分集或线路权威。
  const playCatalog = contentItem && contentItem.playCatalog
    && typeof contentItem.playCatalog === 'object'
    && !Array.isArray(contentItem.playCatalog)
    ? contentItem.playCatalog
    : null;
  // 条件分支: 当前内容没有统一播放目录时进入；执行内容: 拒绝播放目标，不恢复旧字段兼容。
  if (!playCatalog) return null;

  // 类型: boolean；作用: 区分调用方明确线路和需要执行历史/Provider 默认选择的入口。
  const hasExplicitLineId = Object.prototype.hasOwnProperty.call(context, 'playbackSourceId');
  // 类型: string；作用: 显式线路必须属于当前目录，空值表示调用方要求按默认规则选择。
  const explicitLineId = normalizeRouteText(context.playbackSourceId);
  // 类型: string；作用: 目标逻辑剧集只按完全相同 id 查找，不使用 episodeIndex 反推身份。
  const requestedEpisodeId = normalizeRouteText(context.episodeId);
  // 类型: string；作用: 显式非空线路原样校验；其他入口按历史线路、同内容线路和 Provider 默认顺序决定。
  const lineId = hasExplicitLineId && explicitLineId
    ? explicitLineId
    : resolveInitialPlayCatalogLineId(playCatalog, {
        episodeId: requestedEpisodeId,
        historyLineId: context.historyLineId,
        recentLineId: context.recentLineId
      });
  // 类型: object|null；作用: 精确定位目录线路，孤立 query 身份不得进入播放路由。
  const line = findPlayCatalogLine(playCatalog, lineId);
  // 条件分支: 线路缺失或显式不可用时进入；执行内容: 拒绝导航，不静默切换其他线路。
  if (!line || line.available === false) return null;

  // 类型: Array<object>；作用: 保留当前线路 Provider 顺序，只排除无对象条目。
  const lineEpisodes = Array.isArray(line.episodes)
    ? line.episodes.filter(episode => episode && typeof episode === 'object' && !Array.isArray(episode))
    : [];
  // 类型: object|null；作用: 显式逻辑身份只做精确匹配；无显式目标时选择当前线路首个可播放条目。
  const episode = requestedEpisodeId
    ? findPlayCatalogEpisode(line, requestedEpisodeId)
    : lineEpisodes.find(item => item.playable !== false) || null;
  // 条件分支: 目标线路缺集或条目不可播放时进入；执行内容: 返回 null，禁止相邻集和末集回退。
  if (!episode || episode.playable === false) return null;

  // 类型: number；作用: 当前逻辑剧集在该线路中的零基显示位置，只用于派生一基 episodeIndex。
  const episodePosition = lineEpisodes.indexOf(episode);
  // 类型: number|null；作用: 显式序号优先用于历史兼容，其次使用 Provider 集号，最后使用当前线路展示顺序。
  const episodeIndex = normalizeEpisodeIndex(context.episodeIndex)
    || normalizeEpisodeIndex(episode.episodeNumber)
    || (episodePosition >= 0 ? episodePosition + 1 : null);

  // 返回值类型: object；作用: 把同一目录线路和逻辑剧集作为不可拆分的播放导航选择。
  return {
    line,
    episode,
    episodeIndex
  };
}

/**
 * 创建播放页导航目标。
 * 纯函数: 返回新的 params/query，不修改 context 或 baseQuery。
 * 调用方: PlayerView 分集/线路切换和历史记录导航适配。
 * 成功路径: 保留未被本次声明覆盖的 query，并用显式上下文字段写入或删除播放定位字段。
 * 失败路径: sourceId 或 contentId 缺失时返回 null，阻止进入无法请求内容的播放页。
 *
 * @param {object} context 播放上下文。
 * @param {string} context.sourceId 内容所属数据源 id。
 * @param {string} context.contentId 内容 id，对应路由 videoId。
 * @param {string} [context.episodeId] 电视剧逻辑剧集 id；显式空值会删除旧 query。
 * @param {number|null} [context.episodeIndex] 电视剧分集序号；显式无效值会删除旧 query。
 * @param {string} [context.playbackSourceId] 播放线路 id；显式空值会删除旧 query。
 * @param {boolean|string|number} [context.autoplay] 自动播放意图；未声明时保留 baseQuery。
 * @param {object} [baseQuery={}] 当前路由 query；未覆盖字段会保留。
 * @returns {object|null} Vue Router 播放页目标；关键身份缺失时返回 null。
 */
export function createPlayerNavigationTarget(context, baseQuery = {}) {
  // 类型: object。
  // 作用: 异常上下文使用空对象兜底，让关键身份校验统一收敛为 null。
  const safeContext = context && typeof context === 'object' && !Array.isArray(context)
    ? context
    : {};

  // 类型: string。
  // 作用: 数据源身份决定 Runtime 使用哪个 Provider，必须来自当前内容或历史记录。
  const sourceId = normalizeRouteText(safeContext.sourceId);

  // 类型: string。
  // 作用: 内容身份在 Vue Router 中映射为 videoId，在请求层再转换为 params.contentId。
  const contentId = normalizeRouteText(safeContext.contentId);

  // 条件分支: sourceId 或 contentId 任一关键身份缺失时进入。
  // 执行内容: 拒绝构造路由，避免页面 fallback 到无关默认内容。
  if (!sourceId || !contentId) {
    return null;
  }

  // 类型: object。
  // 作用: 复制既有 query，保留与本次播放字段无关的合法路由上下文。
  const query = baseQuery && typeof baseQuery === 'object' && !Array.isArray(baseQuery)
    ? { ...baseQuery }
    : {};

  // 副作用边界: 以下辅助函数只修改新 query 副本；context 未声明的字段继续保留 baseQuery 原值。
  applyTextQueryField(query, safeContext, 'episodeId', PLAYER_QUERY_KEYS.episodeId);
  applyEpisodeIndexQueryField(query, safeContext);
  applyTextQueryField(query, safeContext, 'playbackSourceId', PLAYER_QUERY_KEYS.playbackSourceId);
  applyAutoplayQueryField(query, safeContext);

  // 返回值类型: object。
  // 作用: 返回 Vue Router 可直接 push/replace 的命名路由目标，播放身份与可刷新 query 同时收敛。
  return {
    name: PLAYER_ROUTE_NAME,
    params: {
      sourceId,
      videoId: contentId
    },
    query
  };
}

/**
 * 根据统一 ContentItem 创建默认播放导航目标。
 * 纯函数: 只读取 ContentItem 和入口选项，返回隔离的 Router 目标，不修改内容对象或用户状态。
 * 调用方: 首页轮播“立即播放”和详情页“播放”按钮；播放器内部切换使用 createPlayerNavigationTarget 保留当前 query。
 * 成功路径: 从唯一 playCatalog 统一派生可用线路、逻辑剧集和自动播放意图，再交给基础目标构造函数。
 * 失败路径: ContentItem 身份、目录、线路或逻辑剧集不可用时返回 null，不构造半完整播放地址。
 *
 * @param {object} contentItem 统一 ContentItem。
 * @param {object} [options={}] 显式播放选项。
 * @param {string} [options.episodeId] 指定逻辑剧集 id；未提供时按目录默认条目推导。
 * @param {number|null} [options.episodeIndex] 指定分集序号；未提供时按内容默认分集推导。
 * @param {string} [options.playbackSourceId] 指定播放线路；未提供时按 Provider 默认线路推导。
 * @param {string} [options.historyLineId] 当前逻辑剧集最近成功线路；只在没有显式线路时参与恢复。
 * @param {string} [options.recentLineId] 同一内容最近成功线路；只在更高偏好不可用时参与恢复。
 * @param {boolean|string|number} [options.autoplay] 自动播放意图。
 * @param {object} [baseQuery={}] 需要保留的既有 query。
 * @returns {object|null} Vue Router 播放目标或 null。
 */
export function createContentPlaybackNavigationTarget(contentItem, options = {}, baseQuery = {}) {
  // 类型: object。
  // 作用: 非法内容统一进入基础构造器的身份失败路径，不从页面字段或默认 mock 猜测内容身份。
  const safeContentItem = contentItem && typeof contentItem === 'object' && !Array.isArray(contentItem)
    ? contentItem
    : {};
  // 类型: object。
  // 作用: 非法入口选项统一为空对象，避免导航 service 读取数组或原始值的属性。
  const safeOptions = options && typeof options === 'object' && !Array.isArray(options)
    ? options
    : {};

  // 类型: object|null。
  // 作用: 一次解析目录线路、逻辑剧集和展示序号，避免分集与线路来自不同字段权威。
  const selection = resolveContentPlaySelection(safeContentItem, safeOptions);
  // 条件分支: 内容目录无法形成完整可播放选择时进入；执行内容: 拒绝半完整路由。
  if (!selection) return null;

  // 类型: object。
  // 作用: 只把已经通过统一目录校验的线路、逻辑剧集和展示序号交给基础构造器。
  const context = {
    sourceId: safeContentItem.sourceId,
    contentId: safeContentItem.id
  };
  // 状态组合: 逻辑剧集、展示序号和线路来自同一 selection，不能被不同默认算法拆开。
  context.episodeId = selection.episode.id;
  context.episodeIndex = selection.episodeIndex;
  context.playbackSourceId = selection.line.id;
  // 条件分支: 调用方明确声明 autoplay 时进入。
  // 执行内容: 交给基础构造器统一转换为标准 query 值或删除意图。
  if (Object.prototype.hasOwnProperty.call(safeOptions, 'autoplay')) {
    context.autoplay = safeOptions.autoplay;
  }

  // 返回值类型: object|null。
  // 作用: 由基础构造器统一执行 query 清理、Router 字段映射和身份失败关闭。
  return createPlayerNavigationTarget(context, baseQuery);
}
