/*
  mediaPlaybackTargetTransitionService.js 模块说明

  - 文件职责:
      使用标准媒体四段身份分类一次播放目标转换，统一决定保持当前媒体、可撤销换线、不可逆替换或延迟决策。
      供 PlayerView 在详情、个人中心恢复和播放目录命令汇合后使用，不访问 Router、Provider、Store、播放器或持久化端口。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      PLAYBACK_TARGET_TRANSITION_MODE: Readonly<object>，播放目标转换的稳定分类枚举。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeIdentityText(value)
          - params:
              -- value: any，可能来自路由、目录或候选的身份字段。
          - return:
              string，去除首尾空白后的身份；无效输入返回空字符串。
          - description:
              把四段身份统一为可精确比较的文本，不解释 Provider 私有语义。
      createPlaybackTargetIdentity(value)
          - params:
              -- value: object，当前媒体或目标媒体的标准身份对象。
          - return:
              Readonly<object>，冻结且只含四段身份的隔离对象。
          - description:
              删除页面、路由和展示字段，防止转换决策依赖标题、序号或站点数据。
      classifyPlaybackTargetTransition(currentValue, targetValue)
          - params:
              -- currentValue: object|null，当前已采用媒体身份；null 表示没有活动媒体。
              -- targetValue: object，新播放目标身份。
          - return:
              string，PLAYBACK_TARGET_TRANSITION_MODE 中的稳定分类。
          - description:
              按内容、逻辑剧集和线路顺序完成唯一决策；身份不足时延迟到当前目录解析完成。
      isIrreversiblePlaybackTargetTransition(mode)
          - params:
              -- mode: string，目标转换分类。
          - return:
              boolean，true 表示必须先结束旧媒体，false 表示不执行不可逆替换。
          - description:
              给 PlayerView 提供显式不可回滚门禁，避免 catch 根据 adoptedMedia 猜测恢复策略。

  - 模块级类:
      无

  - 对外导出:
      PLAYBACK_TARGET_TRANSITION_MODE: Readonly<object>，稳定转换模式枚举。
      createPlaybackTargetIdentity: Function，创建隔离四段媒体身份。
      classifyPlaybackTargetTransition: Function，分类播放目标转换。
      isIrreversiblePlaybackTargetTransition: Function，判断转换是否必须释放旧媒体。
*/

// 类型: Readonly<object>。
// 作用: 集中定义常驻播放器接受新目标时允许出现的五种转换结果，页面不得复制字符串或另建分支枚举。
// 字段: initial，string，当前没有活动媒体时建立首次播放候选。
// 字段: sameMedia，string，四段身份完全一致时保持现有媒体实例和实时进度。
// 字段: sameEpisodeLineSwitch，string，同一内容同一逻辑剧集切换线路时允许失败后保持旧媒体。
// 字段: replaceMedia，string，内容或逻辑剧集变化时先结束旧媒体再准备新目标。
// 字段: deferred，string，恢复入口或不完整路由尚未提供足够身份时等待标准目录精确解析。
export const PLAYBACK_TARGET_TRANSITION_MODE = Object.freeze({
  initial: 'initial',
  sameMedia: 'same-media',
  sameEpisodeLineSwitch: 'same-episode-line-switch',
  replaceMedia: 'replace-media',
  deferred: 'deferred'
});

/**
 * 把身份候选整理为可精确比较的文本。
 * 纯函数: 字符串只去除首尾空白，其他输入统一返回空字符串。
 * 维护边界: 不执行大小写、URL、标题或站点规则归一化，四段身份必须保持 Provider 和平台契约原值。
 *
 * @param {*} value 可能来自路由、目录或候选的身份字段。
 * @returns {string} 可比较身份文本；字段未知时为空字符串。
 */
function normalizeIdentityText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 创建隔离的标准播放目标身份。
 * 纯函数: 只读取四段身份并返回冻结新对象，不保留响应式、Router 或 Provider 对象引用。
 * 失败路径: 非对象输入生成四段空身份，分类器据此选择 initial 或 deferred，不抛出页面外壳错误。
 *
 * @param {*} value 当前已采用媒体或新目标身份候选。
 * @returns {Readonly<object>} sourceId、contentId、episodeId 和 playbackSourceId 四段冻结身份。
 */
export function createPlaybackTargetIdentity(value) {
  // 类型: object；作用: 非普通对象使用空对象，统一由字段完整性决定转换结果。
  const safeValue = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.freeze({
    // 类型: string；作用: 数据源执行身份；不同 sourceId 必须进入不可逆内容替换。
    sourceId: normalizeIdentityText(safeValue.sourceId),
    // 类型: string；作用: 数据源内内容身份；不同 contentId 必须进入不可逆内容替换。
    contentId: normalizeIdentityText(safeValue.contentId),
    // 类型: string；作用: 同一内容内逻辑剧集身份；不同 episodeId 必须进入不可逆分集替换。
    episodeId: normalizeIdentityText(safeValue.episodeId),
    // 类型: string；作用: 同一逻辑剧集的线路身份；只有该字段单独变化时允许可撤销候选。
    playbackSourceId: normalizeIdentityText(safeValue.playbackSourceId)
  });
}

/**
 * 分类一次播放目标转换。
 * 纯函数: 只比较标准四段身份，不读取标题、分集数组位置、播放地址、页面状态或持久化记录正文。
 * 成功路径: 返回唯一稳定模式，PlayerView 根据该模式选择无操作、可撤销候选或不可逆替换。
 * 延迟路径: 同内容目标缺少当前逻辑剧集或线路身份时返回 deferred，等待恢复服务用最新目录解析后再次分类。
 * 失败关闭: 目标 sourceId/contentId 缺失时同样返回 deferred，调用方原有严格路由校验负责展示地址错误。
 *
 * @param {*} currentValue 当前已采用媒体身份；没有活动媒体时可以为 null。
 * @param {*} targetValue 本次希望播放的标准目标身份。
 * @returns {string} PLAYBACK_TARGET_TRANSITION_MODE 中的转换分类。
 */
export function classifyPlaybackTargetTransition(currentValue, targetValue) {
  // 类型: Readonly<object>；作用: 隔离当前媒体四段事实，空内容身份表示当前没有可交接媒体。
  const current = createPlaybackTargetIdentity(currentValue);
  // 类型: Readonly<object>；作用: 隔离目标四段意图，缺失剧集或线路时保留延迟决策。
  const target = createPlaybackTargetIdentity(targetValue);

  // 条件分支: 当前没有完整内容身份时进入；执行内容: 新目标属于首次采用，不需要释放或恢复旧媒体。
  if (!current.sourceId || !current.contentId) {
    return PLAYBACK_TARGET_TRANSITION_MODE.initial;
  }
  // 条件分支: 目标无法定位数据源和内容时进入；执行内容: 延迟给严格地址校验失败关闭，不错误停止当前媒体。
  if (!target.sourceId || !target.contentId) {
    return PLAYBACK_TARGET_TRANSITION_MODE.deferred;
  }
  // 条件分支: 数据源或内容身份发生变化时进入；执行内容: 直接确定不可逆媒体替换，不等待 Provider 响应。
  if (current.sourceId !== target.sourceId || current.contentId !== target.contentId) {
    return PLAYBACK_TARGET_TRANSITION_MODE.replaceMedia;
  }
  // 条件分支: 同内容目标尚未提供逻辑剧集时进入；执行内容: 等待恢复服务按当前目录解析，禁止猜测旧 episodeId。
  if (!target.episodeId) {
    return PLAYBACK_TARGET_TRANSITION_MODE.deferred;
  }
  // 条件分支: 逻辑剧集已经变化时进入；执行内容: 无论线路是否相同都确定不可逆媒体替换。
  if (current.episodeId !== target.episodeId) {
    return PLAYBACK_TARGET_TRANSITION_MODE.replaceMedia;
  }
  // 条件分支: 同一逻辑剧集尚未提供线路时进入；执行内容: 等待目录精确解析，不能把默认线路当成已选线路。
  if (!target.playbackSourceId) {
    return PLAYBACK_TARGET_TRANSITION_MODE.deferred;
  }
  // 条件分支: 四段身份完全一致时进入；执行内容: 返回无操作模式，保持现有媒体元素和实时进度。
  if (current.playbackSourceId === target.playbackSourceId) {
    return PLAYBACK_TARGET_TRANSITION_MODE.sameMedia;
  }
  // 返回值类型: string；作用: 内容和逻辑剧集相同、只有线路变化，允许候选失败后继续当前媒体。
  return PLAYBACK_TARGET_TRANSITION_MODE.sameEpisodeLineSwitch;
}

/**
 * 判断转换是否必须先结束当前媒体。
 * 纯函数: 只比较集中枚举，不读取播放器、路由或页面状态。
 * 返回约束: 只有 replaceMedia 返回 true；initial、sameMedia、sameEpisodeLineSwitch 和 deferred 均返回 false。
 *
 * @param {*} mode classifyPlaybackTargetTransition 返回的模式候选。
 * @returns {boolean} true 表示旧媒体一旦释放不得在目标失败后恢复；false 表示不进入不可逆替换。
 */
export function isIrreversiblePlaybackTargetTransition(mode) {
  return mode === PLAYBACK_TARGET_TRANSITION_MODE.replaceMedia;
}
