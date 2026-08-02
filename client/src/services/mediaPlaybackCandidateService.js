/*
  mediaPlaybackCandidateService.js 模块说明

  - 文件职责:
      定义正式播放采用与媒体可达探测共用的纯候选边界。
      统一构造 player 请求参数，并严格复查 Provider 响应中的内容、线路、逻辑剧集和直连媒体身份。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      findPlayCatalogLine、findPlayCatalogEpisode: 自定义服务函数，按稳定身份读取标准播放目录。
      normalizeMediaPlaybackMedia: 自定义校验器，验证浏览器直连媒体对象。
      MEDIA_PLAYBACK_REQUEST_PURPOSE: 自定义配置，限制标准 player 请求意图。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      createPlayerRequestParams(context): 生成不含 undefined 的标准 player 请求参数。
      resolvePlaybackEpisodeIndex(episode): 读取标准逻辑剧集正整数序号。
      normalizePlaybackCandidate(response, target): 严格采用内容、目录、线路、剧集和直连媒体候选。
*/

// 导入来源: ./playCatalogSelectionService.js。
// 导入内容: findPlayCatalogLine、findPlayCatalogEpisode 标准目录精确定位函数。
// 文件作用: 候选只能采用同一响应目录中与请求身份完全一致的线路和逻辑剧集。
import {
  findPlayCatalogLine,
  findPlayCatalogEpisode
} from './playCatalogSelectionService.js';

// 导入来源: ../utils/mediaPlaybackValidators.js。
// 导入内容: normalizeMediaPlaybackMedia 直连媒体严格校验器。
// 文件作用: Provider 候选只有返回浏览器可直接消费的标准媒体对象才允许继续。
import { normalizeMediaPlaybackMedia } from '../utils/mediaPlaybackValidators.js';

// 导入来源: ../config/mediaPlayback.config.js。
// 导入内容: MEDIA_PLAYBACK_REQUEST_PURPOSE 标准 player 请求意图枚举。
// 文件作用: 只有 playback/probe 可以交给 Provider，未知字符串保持字段缺席。
import { MEDIA_PLAYBACK_REQUEST_PURPOSE } from '../config/mediaPlayback.config.js';

/**
 * 从播放上下文构造 Provider 请求参数。
 * 纯函数: 每次返回新普通对象，不读取 Vue、Router、Store 或 Provider，也不修改输入。
 * 成功路径: 始终保留 contentId/autoplay，只在可选身份有效时创建对应键。
 * 失败路径: contentId 缺失由调用方在请求前失败关闭；非法可选值直接省略，不使用 undefined 占位。
 *
 * @param {object} context 标准播放目标上下文。
 * @param {string} context.contentId 必填真实内容 id。
 * @param {boolean} context.autoplay 自动播放意图。
 * @param {string} [context.episodeId] 可选逻辑剧集 id。
 * @param {number|null} [context.episodeIndex] 可选正整数剧集序号。
 * @param {string} [context.playbackSourceId] 可选线路 id。
 * @param {string} [context.requestPurpose] playback 或 probe；缺失时保持旧 Provider 调用兼容。
 * @returns {object} 严格 JSON 且不含 undefined 的 SourceDataRequest.params。
 */
export function createPlayerRequestParams(context = {}) {
  // 类型: object；作用: 建立 Provider 必须接收的内容身份与明确自动播放意图。
  const requestParams = {
    contentId: context.contentId,
    autoplay: context.autoplay === true
  };

  // 条件分支: 调用方提供非空逻辑剧集身份时进入；执行内容: 加入精确剧集键。
  if (typeof context.episodeId === 'string' && context.episodeId.trim()) {
    requestParams.episodeId = context.episodeId.trim();
  }
  // 条件分支: 调用方提供正整数剧集序号时进入；执行内容: 加入辅助定位序号。
  if (Number.isInteger(context.episodeIndex) && context.episodeIndex > 0) {
    requestParams.episodeIndex = context.episodeIndex;
  }
  // 条件分支: 调用方提供非空线路身份时进入；执行内容: 加入用户明确选择的线路。
  if (typeof context.playbackSourceId === 'string' && context.playbackSourceId.trim()) {
    requestParams.playbackSourceId = context.playbackSourceId.trim();
  }
  // 条件分支: 调用方提供冻结枚举中的正式播放或探测意图时进入；执行内容: 交给 Provider 决定自己的媒体刷新策略。
  if (Object.values(MEDIA_PLAYBACK_REQUEST_PURPOSE).includes(context.requestPurpose)) {
    requestParams.requestPurpose = context.requestPurpose;
  }

  return requestParams;
}

/**
 * 读取逻辑剧集的结构化序号。
 * 纯函数: 只接受契约中的 episodeNumber，不使用数组位置、旧 index 别名或标题猜测。
 * 失败路径: 电影正片和缺少正整数序号的条目返回 null。
 *
 * @param {object|null} episode PlayCatalogEpisode。
 * @returns {number|null} 正整数剧集序号或 null。
 */
export function resolvePlaybackEpisodeIndex(episode) {
  // 类型: number；作用: 只把标准 episodeNumber 转换为数字候选。
  const episodeIndex = Number(episode?.episodeNumber);
  // 返回值类型: number|null；作用: 非正整数保持未知语义，不用显示位置补齐身份。
  return Number.isInteger(episodeIndex) && episodeIndex > 0 ? episodeIndex : null;
}

/**
 * 严格采用 Provider 返回的播放候选。
 * 纯函数: 只读取标准响应并返回冻结结果，不写 Store、Router、历史或播放器状态。
 * 成功路径: 内容、线路和逻辑剧集身份与请求完全一致，且 playback.media 通过直连媒体校验。
 * 失败路径: 任一身份缺失、错位、缺集、不可播放或媒体无效时抛出安全错误，禁止采用近似结果。
 *
 * @param {object} response SourceDataResponse 候选。
 * @param {object} target 本次播放请求的精确目标。
 * @param {string} target.sourceId 数据源 id。
 * @param {string} target.contentId 内容 id。
 * @param {string} target.lineId 线路 id。
 * @param {string} target.episodeId 逻辑剧集 id。
 * @returns {Readonly<object>} 已验证内容、目录、线路、剧集和直连媒体。
 * @throws {Error} 候选不满足身份或媒体契约时抛出。
 */
export function normalizePlaybackCandidate(response, target = {}) {
  // 类型: object|null；作用: 只接受标准响应 item，空值进入统一候选失败路径。
  const contentItem = response?.item && typeof response.item === 'object' && !Array.isArray(response.item)
    ? response.item
    : null;
  // 条件分支: 响应内容身份与请求不完全一致时进入；执行内容: 拒绝跨源或相邻内容冒充目标。
  if (!contentItem || contentItem.sourceId !== target.sourceId || contentItem.id !== target.contentId) {
    throw new Error('播放候选内容身份不匹配');
  }

  // 类型: object|null；作用: 从同一内容读取 Provider 最终解析的线路、逻辑剧集和媒体。
  const playback = contentItem.playback && typeof contentItem.playback === 'object'
    && !Array.isArray(contentItem.playback)
    ? contentItem.playback
    : null;
  // 条件分支: 已解析播放身份与请求目标不完全一致时进入；执行内容: 禁止 Provider 默认线路覆盖用户选择。
  if (!playback || playback.lineId !== target.lineId || playback.episodeId !== target.episodeId) {
    throw new Error('播放候选线路或剧集身份不匹配');
  }

  // 类型: object|null；作用: 从同一响应目录精确定位目标线路，禁止使用旧页面目录或数组位置补偿。
  const line = findPlayCatalogLine(contentItem.playCatalog, target.lineId);
  // 类型: object|null；作用: 从目标线路精确定位同一逻辑剧集。
  const episode = findPlayCatalogEpisode(line, target.episodeId);
  // 条件分支: 目录缺少目标、线路不可用或剧集不可播放时进入；执行内容: 拒绝直连媒体脱离目录单独采用。
  if (!line || !episode || line.available === false || episode.playable === false) {
    throw new Error('播放候选不属于可用目录条目');
  }

  // 类型: Readonly<object>；作用: 严格采用唯一 playback.media，额外线路字段不会进入播放器适配层。
  const media = normalizeMediaPlaybackMedia(playback.media);
  // 返回值类型: Readonly<object>；作用: 把正式采用与探测共用的候选事实冻结在同一结果中。
  return Object.freeze({ contentItem, line, episode, media });
}
