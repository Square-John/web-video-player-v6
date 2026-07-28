/*
  playerNavigationService.js 模块说明

  - 文件职责:
      集中把播放内容身份、分集、线路和自动播放意图转换为 Vue Router 播放页目标。
      供个人中心历史记录和 PlayerView 共用，避免页面分别拼接播放 query 或保存第二套播放上下文。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      PLAYER_ROUTE_NAME: string，播放页命名路由。
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

  - 模块级类:
      无

  - 对外导出:
      createPlayerNavigationTarget: Function，根据播放上下文和既有 query 创建播放页路由目标。
      createHistoryPlaybackNavigationTarget: Function，根据单条历史记录创建精确恢复播放目标。
*/

// 类型: string。
// 作用: 所有播放导航统一使用命名路由，避免页面散落播放路径字符串。
const PLAYER_ROUTE_NAME = 'player';

// 类型: object。
// 作用: 集中定义可刷新播放上下文的 query 字段，字段名必须与 PlayerView 路由读取契约一致。
const PLAYER_QUERY_KEYS = Object.freeze({
  // 类型: string。
  // 作用: 保存电视剧稳定分集 id，刷新后优先按它定位分集。
  episodeId: 'episodeId',

  // 类型: string。
  // 作用: 保存电视剧分集序号，在稳定分集 id 缺失时提供定位兜底。
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
 * 创建播放页导航目标。
 * 纯函数: 返回新的 params/query，不修改 context 或 baseQuery。
 * 调用方: PlayerView 分集/线路切换和历史记录导航适配。
 * 成功路径: 保留未被本次声明覆盖的 query，并用显式上下文字段写入或删除播放定位字段。
 * 失败路径: sourceId 或 contentId 缺失时返回 null，阻止进入无法请求内容的播放页。
 *
 * @param {object} context 播放上下文。
 * @param {string} context.sourceId 内容所属数据源 id。
 * @param {string} context.contentId 内容 id，对应路由 videoId。
 * @param {string} [context.episodeId] 电视剧分集 id；显式空值会删除旧 query。
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
 * 根据单条播放历史创建精确恢复目标。
 * 纯函数: 只读取当前 historyRecord，不查询内容级最近记录、不修改用户状态或路由。
 * 调用方: ProfileView 历史列表。
 * 成功路径: 使用当前记录的 sourceId、contentId、episodeId、episodeIndex 和 playbackSourceId，并启用自动播放恢复。
 * 失败路径: 历史记录关键内容身份缺失时返回 null，卡片不会导航到错误默认内容。
 *
 * @param {object} historyRecord UserContentState.playHistory.records 中的单条记录。
 * @param {string} historyRecord.sourceId 历史内容所属数据源 id。
 * @param {string} historyRecord.contentId 历史内容 id。
 * @param {string} historyRecord.episodeId 电视剧分集 id；电影可为空。
 * @param {number|null} historyRecord.episodeIndex 电视剧分集序号；电影可为空。
 * @param {string} historyRecord.playbackSourceId 历史播放线路 id；未知时为空。
 * @returns {object|null} 精确历史播放路由目标或 null。
 */
export function createHistoryPlaybackNavigationTarget(historyRecord) {
  // 类型: object。
  // 作用: 异常记录使用空对象兜底，关键身份缺失时由统一构造函数拒绝导航。
  const safeRecord = historyRecord && typeof historyRecord === 'object' && !Array.isArray(historyRecord)
    ? historyRecord
    : {};

  // 返回值类型: object|null。
  // 作用: 历史导航只使用当前记录字段，不读取同内容最新分集，保证多分集记录分别恢复。
  return createPlayerNavigationTarget({
    sourceId: safeRecord.sourceId,
    contentId: safeRecord.contentId,
    episodeId: safeRecord.episodeId,
    episodeIndex: safeRecord.episodeIndex,
    playbackSourceId: safeRecord.playbackSourceId,
    autoplay: true
  });
}
