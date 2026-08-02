/*
  playCatalogSelectionService.js 模块说明

  - 文件职责:
      提供播放目录的结构化读取、初始线路选择、跨线路逻辑剧集定位和用户选择决策。
      供详情页、播放页和 PlayCatalogSelector 复用相同身份规则，不访问 Provider、Router、Store 或播放器实例。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      PLAY_CATALOG_SELECTION_KIND: Readonly<object>，目录选择结果类型枚举。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeText(value): string，清理不透明身份和展示文本。
      isRecord(value): boolean，判断普通对象输入。
      hasPlayableEpisode(line, episodeId): boolean，判断线路是否包含可播放逻辑剧集。
      createSelectionDecision(kind, line, episode): Readonly<object>，创建统一选择结果。

  - 模块级类:
      无

  - 对外导出:
      PLAY_CATALOG_SELECTION_KIND: Readonly<object>，页面协调器消费的稳定决策类型。
      getPlayCatalogLines: Function，读取合法目录线路。
      findPlayCatalogLine: Function，按稳定线路 id 精确定位线路。
      findPlayCatalogEpisode: Function，按逻辑剧集 id 精确定位线路内条目。
      resolveInitialPlayCatalogLineId: Function，按历史、默认和可用性顺序选择初始线路。
      decideBrowsedLineChange: Function，判断浏览线路后是否可以自动解析当前同集媒体。
      decideManualEpisodeSelection: Function，判断手动选集是否可以进入候选媒体解析。
*/

// 类型: Readonly<object>。
// 作用: 冻结播放目录选择结果类型，页面根据结果协调浏览状态、候选请求或安全提示。
export const PLAY_CATALOG_SELECTION_KIND = Object.freeze({
  // 类型: string；作用: 目标线路和当前逻辑剧集都可播放，可以解析候选媒体。
  resolvable: 'resolvable',
  // 类型: string；作用: 只改变目录浏览线路，不自动请求媒体。
  browseOnly: 'browse-only',
  // 类型: string；作用: 目标线路不存在当前逻辑剧集，必须等待用户手动选集。
  missingEpisode: 'missing-episode',
  // 类型: string；作用: 线路存在但不可用，禁止发起媒体请求。
  unavailableLine: 'unavailable-line',
  // 类型: string；作用: 目标剧集存在但不可播放，禁止发起媒体请求。
  unplayableEpisode: 'unplayable-episode',
  // 类型: string；作用: 线路或剧集身份无效，调用方应保持现有状态。
  invalidTarget: 'invalid-target'
});

/**
 * 清理目录身份或展示文本。
 * 纯函数: 相同输入始终返回相同字符串，不修改来源对象。
 *
 * @param {*} value 待清理值。
 * @returns {string} 去除首尾空白后的字符串；非字符串返回空字符串。
 */
function normalizeText(value) {
  // 返回值类型: string；作用: 只接受契约字符串，避免隐式把对象或数字改造成 Provider 身份。
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 判断输入是否为非数组对象。
 * 纯函数: 只读取输入类型，不修改外部状态。
 *
 * @param {*} value 待判断输入。
 * @returns {boolean} true 表示可读取字段，false 表示 null、数组或原始值。
 */
function isRecord(value) {
  // 返回值类型: boolean；作用: 排除数组，确保目录、线路和剧集使用对象契约。
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/**
 * 读取播放目录中的合法线路。
 * 纯函数: 返回新的数组外壳，保留 Provider 线路对象引用且不修改顺序。
 * 失败路径: playCatalog 或 lines 形状无效时返回空数组。
 *
 * @param {*} playCatalog ContentItem.playCatalog 候选值。
 * @returns {Array<object>} 具有非空稳定 id 的线路列表。
 */
export function getPlayCatalogLines(playCatalog) {
  // 条件分支: 目录或线路数组无效时进入；执行内容: 返回空集合供页面展示空态。
  if (!isRecord(playCatalog) || !Array.isArray(playCatalog.lines)) return [];

  // 返回值类型: Array<object>；作用: 过滤无身份条目，但不按可用性删除需要展示红点的线路。
  return playCatalog.lines.filter(line => isRecord(line) && Boolean(normalizeText(line.id)));
}

/**
 * 按稳定线路 id 精确定位目录线路。
 * 纯函数: 不修改目录或线路对象。
 * 失败路径: 身份为空或未命中时返回 null，不使用默认线路或数组位置补偿。
 *
 * @param {*} playCatalog ContentItem.playCatalog 候选值。
 * @param {*} lineId Provider 线路身份。
 * @returns {object|null} 精确命中的线路或 null。
 */
export function findPlayCatalogLine(playCatalog, lineId) {
  // 类型: string；作用: 形成唯一精确比较值，空字符串不得命中任何线路。
  const normalizedLineId = normalizeText(lineId);
  // 条件分支: 目标身份为空时进入；执行内容: 停止查找并拒绝位置回退。
  if (!normalizedLineId) return null;

  // 返回值类型: object|null；作用: 只按 Provider 稳定 id 命中，保持可插拔目录语义。
  return getPlayCatalogLines(playCatalog).find(line => normalizeText(line.id) === normalizedLineId) || null;
}

/**
 * 按逻辑剧集 id 精确定位某条线路中的剧集。
 * 纯函数: 不修改线路或 episodes 顺序。
 * 失败路径: 线路、剧集数组或身份无效时返回 null，不执行标题、序号或相邻集猜测。
 *
 * @param {*} line PlayCatalogLine 候选值。
 * @param {*} episodeId 同一 ContentItem 内跨线路共享的逻辑剧集 id。
 * @returns {object|null} 精确命中的 PlayCatalogEpisode 或 null。
 */
export function findPlayCatalogEpisode(line, episodeId) {
  // 类型: string；作用: 形成逻辑身份精确比较值。
  const normalizedEpisodeId = normalizeText(episodeId);
  // 条件分支: 线路、数组或逻辑身份无效时进入；执行内容: 返回 null 让调用方进入缺集流程。
  if (!isRecord(line) || !Array.isArray(line.episodes) || !normalizedEpisodeId) return null;

  // 返回值类型: object|null；作用: 仅接受完全相同的逻辑 id，禁止公共前端解释标题和集数。
  return line.episodes.find(episode => isRecord(episode)
    && normalizeText(episode.id) === normalizedEpisodeId) || null;
}

/**
 * 判断线路是否包含可播放的指定逻辑剧集。
 * 纯函数: 只读取线路可用性和剧集 playable 字段。
 *
 * @param {*} line PlayCatalogLine 候选值。
 * @param {*} episodeId 目标逻辑剧集 id。
 * @returns {boolean} true 表示线路和剧集都允许请求，false 表示缺集或任一层不可用。
 */
function hasPlayableEpisode(line, episodeId) {
  // 类型: object|null；作用: 保存精确逻辑身份命中的剧集，不允许使用数组位置。
  const episode = findPlayCatalogEpisode(line, episodeId);
  // 返回值类型: boolean；作用: available/playable 只有显式 false 才阻止，兼容标准对象省略可选状态的列表展示。
  return Boolean(episode && line.available !== false && episode.playable !== false);
}

/**
 * 按冻结优先级选择页面初始浏览线路。
 * 纯函数: 不写页面状态，不修改候选顺序。
 * 成功路径: 依次采用该集历史线路、同内容最近线路、Provider 默认线路和首条包含目标集的可用线路。
 * 失败路径: 没有可用候选时返回首条目录线路供用户查看状态；空目录返回空字符串。
 *
 * @param {*} playCatalog ContentItem.playCatalog 候选值。
 * @param {object} preferences 初始线路偏好。
 * @param {string} preferences.episodeId 目标逻辑剧集 id；为空时只要求线路可用。
 * @param {string} preferences.historyLineId 该逻辑剧集最近成功线路。
 * @param {string} preferences.recentLineId 同一内容最近成功线路。
 * @returns {string} 选中的稳定线路 id；空目录返回空字符串。
 */
export function resolveInitialPlayCatalogLineId(playCatalog, preferences = {}) {
  // 类型: Array<object>；作用: 保留 Provider 目录顺序作为最终确定性选择顺序。
  const lines = getPlayCatalogLines(playCatalog);
  // 条件分支: 目录没有合法线路时进入；执行内容: 返回空身份让页面展示空态。
  if (!lines.length) return '';

  // 类型: string；作用: 当前恢复目标逻辑剧集，空值表示电影入口或没有历史目标。
  const episodeId = normalizeText(preferences.episodeId);
  // 类型: Array<string>；作用: 按冻结优先级排列显式和 Provider 默认线路，重复值只评估一次。
  const preferredIds = [
    preferences.historyLineId,
    preferences.recentLineId,
    isRecord(playCatalog) ? playCatalog.defaultLineId : ''
  ].map(normalizeText).filter((lineId, index, values) => lineId && values.indexOf(lineId) === index);

  // 循环类型: for...of；初始值: 该集历史线路；终止条件: 首个满足目标集和可用性条件的线路；作用: 严格执行恢复顺序。
  for (const preferredId of preferredIds) {
    // 类型: object|null；作用: 只按稳定 id 查找当前偏好线路。
    const line = findPlayCatalogLine(playCatalog, preferredId);
    // 条件分支: 偏好线路可用且满足目标剧集时进入；执行内容: 立即采用，不继续回退。
    if (line && line.available !== false && (!episodeId || hasPlayableEpisode(line, episodeId))) return line.id;
  }

  // 类型: object|undefined；作用: 查找 Provider 顺序中的首条可用且真实包含目标剧集的线路。
  const availableLine = lines.find(line => line.available !== false
    && (!episodeId || hasPlayableEpisode(line, episodeId)));
  // 返回值类型: string；作用: 有可播放候选时返回其身份，否则保留首条线路供用户查看不可用状态和手动决策。
  return availableLine?.id || lines[0].id;
}

/**
 * 创建不可变目录选择结果。
 * 纯函数: 只组合调用方已经定位的线路和剧集。
 *
 * @param {string} kind PLAY_CATALOG_SELECTION_KIND 中的结果类型。
 * @param {object|null} line 目标线路。
 * @param {object|null} episode 目标逻辑剧集。
 * @returns {Readonly<object>} 页面协调器消费的统一结果。
 */
function createSelectionDecision(kind, line = null, episode = null) {
  // 返回值类型: Readonly<object>；作用: 冻结结果外壳，避免页面误改目录对象或决策类型。
  return Object.freeze({
    // 类型: string；作用: 当前选择结果类型。
    kind,
    // 类型: object|null；作用: 已定位线路，invalid-target 时为 null。
    line,
    // 类型: object|null；作用: 已定位逻辑剧集，缺集或只浏览时为 null。
    episode,
    // 类型: boolean；作用: true 表示页面可以创建候选 player 请求，false 表示必须保持旧媒体。
    shouldResolveMedia: kind === PLAY_CATALOG_SELECTION_KIND.resolvable,
    // 类型: boolean；作用: true 表示线路已切换浏览但缺少当前集，需要持续提示手动选择。
    manualSelectionRequired: kind === PLAY_CATALOG_SELECTION_KIND.missingEpisode
  });
}

/**
 * 判断用户切换浏览线路后的通用行为。
 * 纯函数: 不修改 browsedLineId、Router、媒体实例或历史。
 * 成功路径: 目标线路存在可播放当前逻辑剧集时返回 resolvable。
 * 失败路径: 缺集、线路不可用或身份无效时返回对应结果，调用方必须保持旧媒体。
 *
 * @param {*} playCatalog ContentItem.playCatalog 候选值。
 * @param {object} target 线路切换目标。
 * @param {string} target.lineId 用户选择的线路 id。
 * @param {string} target.playingEpisodeId 当前实际播放逻辑剧集 id；为空表示详情页或无活动媒体。
 * @returns {Readonly<object>} 统一线路浏览决策。
 */
export function decideBrowsedLineChange(playCatalog, target = {}) {
  // 类型: object|null；作用: 精确定位用户选择线路，禁止默认线路掩盖无效输入。
  const line = findPlayCatalogLine(playCatalog, target.lineId);
  // 条件分支: 目标线路不存在时进入；执行内容: 返回无效结果并保持调用方现有状态。
  if (!line) return createSelectionDecision(PLAY_CATALOG_SELECTION_KIND.invalidTarget);
  // 条件分支: 目标线路显式不可用时进入；执行内容: 允许页面浏览状态但禁止媒体请求。
  if (line.available === false) return createSelectionDecision(PLAY_CATALOG_SELECTION_KIND.unavailableLine, line);

  // 类型: string；作用: 当前实际播放逻辑身份；空值表示本次只需浏览目录。
  const playingEpisodeId = normalizeText(target.playingEpisodeId);
  // 条件分支: 没有活动逻辑剧集时进入；执行内容: 返回只浏览结果，不伪造自动播放目标。
  if (!playingEpisodeId) return createSelectionDecision(PLAY_CATALOG_SELECTION_KIND.browseOnly, line);

  // 类型: object|null；作用: 按完全相同逻辑 id 查找目标线路同集。
  const episode = findPlayCatalogEpisode(line, playingEpisodeId);
  // 条件分支: 目标线路缺少当前集时进入；执行内容: 要求手动选集且保持旧媒体。
  if (!episode) return createSelectionDecision(PLAY_CATALOG_SELECTION_KIND.missingEpisode, line);
  // 条件分支: 目标集存在但显式不可播放时进入；执行内容: 禁止候选请求。
  if (episode.playable === false) return createSelectionDecision(PLAY_CATALOG_SELECTION_KIND.unplayableEpisode, line, episode);

  // 返回值类型: Readonly<object>；作用: 允许页面在旧媒体继续播放时解析目标同集候选媒体。
  return createSelectionDecision(PLAY_CATALOG_SELECTION_KIND.resolvable, line, episode);
}

/**
 * 判断用户手动选择某条线路剧集后的通用行为。
 * 纯函数: 不修改目录、路由、播放器或历史。
 * 成功路径: 线路和逻辑剧集都可用时返回 resolvable。
 * 失败路径: 缺少身份、线路不可用、剧集不存在或不可播放时返回稳定结果。
 *
 * @param {*} playCatalog ContentItem.playCatalog 候选值。
 * @param {object} target 手动选择目标。
 * @param {string} target.lineId 当前浏览线路 id。
 * @param {string} target.episodeId 用户明确选择的逻辑剧集 id。
 * @returns {Readonly<object>} 统一手动选集决策。
 */
export function decideManualEpisodeSelection(playCatalog, target = {}) {
  // 类型: object|null；作用: 精确定位当前浏览线路。
  const line = findPlayCatalogLine(playCatalog, target.lineId);
  // 条件分支: 线路身份无效时进入；执行内容: 拒绝请求并保持旧媒体。
  if (!line) return createSelectionDecision(PLAY_CATALOG_SELECTION_KIND.invalidTarget);
  // 条件分支: 线路不可用时进入；执行内容: 返回线路级失败。
  if (line.available === false) return createSelectionDecision(PLAY_CATALOG_SELECTION_KIND.unavailableLine, line);

  // 类型: object|null；作用: 只按用户明确逻辑 id 定位当前线路剧集。
  const episode = findPlayCatalogEpisode(line, target.episodeId);
  // 条件分支: 剧集不存在时进入；执行内容: 返回无效目标，不选择相邻或末集。
  if (!episode) return createSelectionDecision(PLAY_CATALOG_SELECTION_KIND.invalidTarget, line);
  // 条件分支: 剧集显式不可播放时进入；执行内容: 返回条目级失败。
  if (episode.playable === false) return createSelectionDecision(PLAY_CATALOG_SELECTION_KIND.unplayableEpisode, line, episode);

  // 返回值类型: Readonly<object>；作用: 允许页面按两阶段流程解析并采用用户明确目标。
  return createSelectionDecision(PLAY_CATALOG_SELECTION_KIND.resolvable, line, episode);
}
