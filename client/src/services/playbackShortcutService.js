/*
  playbackShortcutService.js 模块说明

  - 文件职责:
      校验项目快捷键偏好、检测冲突、匹配 KeyboardEvent，并执行与页面无关的播放器命令。
      项目配置是唯一键位权威；xgplayer 插件只负责生命周期内转发事件和页面级分集命令。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      mediaPlayback.config exports: 自定义配置，提供命令、修饰符、默认绑定和跳转步长。

  - 模块级常量:
      SHORTCUT_PREFERENCES_SCHEMA_VERSION: string，当前快捷键偏好版本。
      EDITABLE_TARGET_SELECTOR: string，禁止触发播放器快捷键的可编辑目标选择器。

  - 模块级变量:
      无

  - 模块级辅助函数:
      normalizeText(value): 清理文本。
      normalizeModifiers(modifiers): 校验、去重和排序修饰符。
      createBindingSignature(binding): 生成冲突检测签名。
      cloneBinding(binding): 创建冻结绑定副本。
      clamp(value, minimum, maximum): 限制媒体数值范围。

  - 模块级类:
      PlaybackShortcutValidationError: 快捷键偏好非法或冲突时的稳定错误。

  - 对外导出:
      PlaybackShortcutValidationError: Class，供设置页、插件和测试识别配置失败。
      createDefaultPlaybackShortcutPreferences: Function，创建默认偏好副本。
      normalizePlaybackShortcutPreferences: Function，严格校验偏好。
      findPlaybackShortcutBinding: Function，按 KeyboardEvent 查找绑定。
      shouldIgnorePlaybackShortcut: Function，排除输入和可编辑区域。
      executePlaybackShortcutAction: Function，执行基础媒体命令或委托页面命令。
*/

import {
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: DEFAULT_PLAYBACK_SHORTCUT_BINDINGS；文件作用: 生成初始用户偏好。
  DEFAULT_PLAYBACK_SHORTCUT_BINDINGS,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: PLAYBACK_SEEK_STEP_SECONDS；文件作用: 执行前进后退命令。
  PLAYBACK_SEEK_STEP_SECONDS,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: PLAYBACK_SHORTCUT_ACTION；文件作用: 限制和分派项目命令。
  PLAYBACK_SHORTCUT_ACTION,
  // 导入来源: ../config/mediaPlayback.config.js；导入内容: PLAYBACK_SHORTCUT_MODIFIER；文件作用: 限制组合键修饰符。
  PLAYBACK_SHORTCUT_MODIFIER
} from '../config/mediaPlayback.config.js';

// 类型: string。
// 作用: 当前快捷键偏好结构版本，后续设置页升级时作为迁移身份。
const SHORTCUT_PREFERENCES_SCHEMA_VERSION = '1.0.0';

// 类型: string。
// 作用: 输入、选择、按钮和可编辑区域保留自身键盘行为，不触发播放器命令。
const EDITABLE_TARGET_SELECTOR = 'input, textarea, select, button, [contenteditable="true"], [role="textbox"]';

/**
 * 快捷键偏好校验错误。
 * 调用方: 快捷键设置 service、项目 xgplayer 插件和媒体领域测试。
 * 状态: 保存稳定 name 和安全 message，不保存 KeyboardEvent 或 DOM 引用。
 */
export class PlaybackShortcutValidationError extends Error {
  /**
   * 创建快捷键校验错误。
   * 副作用: 只创建 Error，不写页面、播放器或浏览器状态。
   *
   * @param {string} message 安全错误说明。
   */
  constructor(message) {
    super(message);
    this.name = 'PlaybackShortcutValidationError';
  }
}

/**
 * 清理文本字段。
 * 纯函数: null/undefined 返回空字符串，其余输入转换后去除首尾空白。
 *
 * @param {*} value 文本候选。
 * @returns {string} 稳定文本。
 */
function normalizeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * 校验并标准化快捷键修饰符。
 * 纯函数: 返回冻结新数组，不修改调用方数组。
 * 失败路径: 非数组或未知修饰符抛 PlaybackShortcutValidationError。
 *
 * @param {*} modifiers 修饰符候选。
 * @returns {Array<string>} 去重并排序的冻结修饰符。
 */
function normalizeModifiers(modifiers) {
  // 条件分支: 修饰符候选不是数组时进入；执行内容: 拒绝无法按契约去重和排序的配置。
  if (!Array.isArray(modifiers)) {
    throw new PlaybackShortcutValidationError('快捷键 modifiers 必须是数组');
  }
  // 类型: Array<string>；作用: 提供项目允许的修饰符全集，阻止第三方或任意名称进入签名。
  const allowedModifiers = Object.values(PLAYBACK_SHORTCUT_MODIFIER);
  // 类型: Array<string>；作用: 生成去重、排序后的稳定修饰符集合，使组合键签名与输入顺序无关。
  const normalizedModifiers = [...new Set(modifiers.map(normalizeText))].sort();
  // 条件分支: 标准化结果包含未知修饰符时进入；执行内容: 以配置错误失败关闭，避免绑定永远无法命中。
  if (normalizedModifiers.some(modifier => !allowedModifiers.includes(modifier))) {
    throw new PlaybackShortcutValidationError('快捷键包含未知修饰符');
  }
  return Object.freeze(normalizedModifiers);
}

/**
 * 为快捷键绑定生成冲突签名。
 * 纯函数: 只读取已标准化绑定。
 *
 * @param {object} binding 标准快捷键绑定。
 * @returns {string} 修饰符和 KeyboardEvent.code 组合签名。
 */
function createBindingSignature(binding) {
  return `${binding.modifiers.join('+')}::${binding.key}`;
}

/**
 * 创建冻结快捷键绑定副本。
 * 纯函数: 不保留调用方数组引用。
 *
 * @param {object} binding 标准绑定。
 * @returns {object} 冻结副本。
 */
function cloneBinding(binding) {
  return Object.freeze({
    action: binding.action,
    key: binding.key,
    modifiers: Object.freeze([...binding.modifiers]),
    enabled: binding.enabled
  });
}

/**
 * 把数值限制在给定闭区间。
 * 纯函数: 不修改播放器。
 *
 * @param {number} value 候选值。
 * @param {number} minimum 最小值。
 * @param {number} maximum 最大值。
 * @returns {number} 区间内数值。
 */
function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * 创建默认快捷键偏好。
 * 纯函数: 每次返回新的冻结绑定数组，不暴露配置常量内部引用。
 *
 * @returns {object} 默认 ShortcutPreferences。
 */
export function createDefaultPlaybackShortcutPreferences() {
  return Object.freeze({
    schemaVersion: SHORTCUT_PREFERENCES_SCHEMA_VERSION,
    bindings: Object.freeze(DEFAULT_PLAYBACK_SHORTCUT_BINDINGS.map(cloneBinding))
  });
}

/**
 * 严格校验快捷键偏好。
 * 纯函数: 返回隔离冻结对象，不修改输入。
 * 成功路径: action、key、modifiers、enabled 和签名唯一性全部有效。
 * 失败路径: 结构、版本、命令、键位、Boolean 或冲突无效时抛稳定错误。
 *
 * @param {*} preferences 快捷键偏好候选；null/undefined 使用默认配置。
 * @returns {object} 标准 ShortcutPreferences。
 * @throws {PlaybackShortcutValidationError} 配置无效时抛出。
 */
export function normalizePlaybackShortcutPreferences(preferences) {
  // 条件分支: 调用方尚未保存快捷键偏好时进入；执行内容: 返回项目集中默认配置的新冻结副本。
  if (preferences === null || preferences === undefined) {
    return createDefaultPlaybackShortcutPreferences();
  }
  // 条件分支: 偏好不是普通对象时进入；执行内容: 拒绝数组和原始值继续参与字段读取。
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    throw new PlaybackShortcutValidationError('快捷键偏好必须是对象');
  }
  // 条件分支: 顶层字段与契约不完全一致时进入；执行内容: 拒绝缺失字段和未定义扩展。
  if (Object.keys(preferences).sort().join(',') !== 'bindings,schemaVersion') {
    throw new PlaybackShortcutValidationError('快捷键偏好字段不符合契约');
  }
  // 条件分支: 版本不匹配或绑定集合不是数组时进入；执行内容: 阻止未迁移配置进入播放器插件。
  if (preferences.schemaVersion !== SHORTCUT_PREFERENCES_SCHEMA_VERSION || !Array.isArray(preferences.bindings)) {
    throw new PlaybackShortcutValidationError('快捷键偏好版本或 bindings 无效');
  }

  // 类型: Array<string>；作用: 提供播放器项目命令全集，第三方插件不能反向扩张命令。
  const allowedActions = Object.values(PLAYBACK_SHORTCUT_ACTION);
  // 类型: Set<string>；作用: 记录已启用组合键签名，用于拒绝一个按键触发多个命令。
  const signatures = new Set();
  // 类型: Set<string>；作用: 记录已出现命令，保证每个项目动作只有一条配置。
  const actions = new Set();
  // 类型: Array<object>；作用: 按用户配置顺序生成隔离冻结绑定，并在映射期间完成逐条校验。
  const bindings = preferences.bindings.map((binding) => {
    // 条件分支: 单条绑定不是精确契约对象时进入；执行内容: 拒绝缺失、额外字段或非对象条目。
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)
      || Object.keys(binding).sort().join(',') !== 'action,enabled,key,modifiers') {
      throw new PlaybackShortcutValidationError('快捷键绑定字段不符合契约');
    }
    // 类型: object；作用: 统一命令、键位、修饰符和启用状态，供身份与冲突校验共用。
    const normalizedBinding = {
      action: normalizeText(binding.action),
      key: normalizeText(binding.key),
      modifiers: normalizeModifiers(binding.modifiers),
      enabled: binding.enabled
    };
    // 条件分支: 命令、键位或启用状态无效时进入；执行内容: 阻止不可执行配置进入插件。
    if (!allowedActions.includes(normalizedBinding.action) || !normalizedBinding.key || typeof normalizedBinding.enabled !== 'boolean') {
      throw new PlaybackShortcutValidationError('快捷键命令、键位或启用状态无效');
    }
    // 条件分支: 同一项目命令已配置过时进入；执行内容: 拒绝多个权威绑定。
    if (actions.has(normalizedBinding.action)) {
      throw new PlaybackShortcutValidationError(`快捷键命令重复: ${normalizedBinding.action}`);
    }
    actions.add(normalizedBinding.action);
    // 条件分支: 当前绑定处于启用状态时进入；执行内容: 才参与按键冲突检测，关闭项保留配置但不占用键位。
    if (normalizedBinding.enabled) {
      // 类型: string；作用: 表示修饰符与 KeyboardEvent.code 的稳定组合，用于查重。
      const signature = createBindingSignature(normalizedBinding);
      // 条件分支: 已有启用绑定占用同一签名时进入；执行内容: 拒绝含糊的命令分派。
      if (signatures.has(signature)) {
        throw new PlaybackShortcutValidationError(`快捷键冲突: ${signature}`);
      }
      signatures.add(signature);
    }
    return cloneBinding(normalizedBinding);
  });

  return Object.freeze({
    schemaVersion: SHORTCUT_PREFERENCES_SCHEMA_VERSION,
    bindings: Object.freeze(bindings)
  });
}

/**
 * 判断 KeyboardEvent 是否应交给页面控件处理。
 * 纯函数: 只读取事件 target 和组合状态，不调用 preventDefault。
 * 成功路径: 输入、选择、按钮、可编辑区域或输入法组合期间返回 true。
 * 失败路径: 非 Element target 按普通播放器按键处理并返回 false。
 *
 * @param {KeyboardEvent} event 浏览器键盘事件。
 * @returns {boolean} true 表示插件必须忽略。
 */
export function shouldIgnorePlaybackShortcut(event) {
  // 条件分支: 事件缺失或输入法仍在组合字符时进入；执行内容: 保留输入行为，不执行播放器命令。
  if (!event || event.isComposing) {
    return true;
  }
  // 类型: EventTarget|null；作用: 定位按键来源并判断是否处于表单或可编辑区域。
  const target = event.target;
  return Boolean(target && typeof target.closest === 'function' && target.closest(EDITABLE_TARGET_SELECTOR));
}

/**
 * 按 KeyboardEvent 查找启用绑定。
 * 纯函数: 只读取已校验偏好和事件，不修改浏览器状态。
 *
 * @param {object} preferences 标准 ShortcutPreferences。
 * @param {KeyboardEvent} event 浏览器键盘事件。
 * @returns {object|null} 命中的冻结绑定或 null。
 */
export function findPlaybackShortcutBinding(preferences, event) {
  // 类型: object；作用: 每次匹配前采用严格校验后的冻结偏好，避免插件消费已变异设置。
  const normalizedPreferences = normalizePlaybackShortcutPreferences(preferences);
  // 条件分支: 事件或 KeyboardEvent.code 缺失时进入；执行内容: 不依赖易受键盘布局影响的 key 字段猜测绑定。
  if (!event || !normalizeText(event.code)) {
    return null;
  }
  // 类型: Array<string>；作用: 从当前事件提取、排序已按下修饰符，生成与配置顺序无关的签名。
  const activeModifiers = [
    event.altKey ? PLAYBACK_SHORTCUT_MODIFIER.alt : '',
    event.ctrlKey ? PLAYBACK_SHORTCUT_MODIFIER.control : '',
    event.metaKey ? PLAYBACK_SHORTCUT_MODIFIER.meta : '',
    event.shiftKey ? PLAYBACK_SHORTCUT_MODIFIER.shift : ''
  ].filter(Boolean).sort();
  // 类型: string；作用: 表示本次事件修饰符与 code 的稳定组合，用于查找唯一启用绑定。
  const signature = `${activeModifiers.join('+')}::${event.code}`;
  return normalizedPreferences.bindings.find(binding => binding.enabled && createBindingSignature(binding) === signature) || null;
}

/**
 * 执行播放器快捷键命令。
 * 副作用: 可以调用 xgplayer play/pause/fullscreen，修改 currentTime/muted，或委托页面分集命令。
 * 成功路径: 已支持命令执行后返回 true；页面命令交给 onPageCommand。
 * 失败路径: player 缺失、未知命令或页面回调缺失时返回 false；play/fullscreen Promise 由调用方负责收敛。
 *
 * @param {object} player xgplayer 实例最小命令接口。
 * @param {string} action PLAYBACK_SHORTCUT_ACTION 命令。
 * @param {Function|null} onPageCommand 页面级 previousEpisode/nextEpisode 回调。
 * @returns {boolean} 命令已被接受时为 true。
 */
export function executePlaybackShortcutAction(player, action, onPageCommand = null) {
  // 条件分支: 当前播放器实例缺失时进入；执行内容: 拒绝命令并保留浏览器默认行为。
  if (!player) {
    return false;
  }
  // 条件分支: 命令要求切换播放状态时进入；执行内容: 根据播放器暂停状态执行 play 或 pause。
  if (action === PLAYBACK_SHORTCUT_ACTION.togglePlay) {
    // 条件分支: 播放器当前暂停时进入；执行内容: 发起播放并在此收敛浏览器拒绝 Promise，状态事件仍由适配层报告。
    if (player.paused) {
      Promise.resolve(player.play()).catch(() => {});
    } else {
      player.pause();
    }
    return true;
  }
  // 条件分支: 命令要求前进或后退时进入；执行内容: 使用集中步长并限制在 0 与媒体时长之间。
  if (action === PLAYBACK_SHORTCUT_ACTION.seekBackward || action === PLAYBACK_SHORTCUT_ACTION.seekForward) {
    // 类型: number；作用: 把前进映射为 1、后退映射为 -1，统一计算目标秒数。
    const direction = action === PLAYBACK_SHORTCUT_ACTION.seekForward ? 1 : -1;
    // 类型: number；作用: 有限时长作为上界；直播或未知时长使用安全数值上界而不阻止跳转。
    const duration = Number.isFinite(Number(player.duration)) ? Number(player.duration) : Number.MAX_SAFE_INTEGER;
    player.currentTime = clamp(Number(player.currentTime || 0) + direction * PLAYBACK_SEEK_STEP_SECONDS, 0, duration);
    return true;
  }
  // 条件分支: 命令要求切换静音时进入；执行内容: 反转当前媒体元素静音状态。
  if (action === PLAYBACK_SHORTCUT_ACTION.toggleMute) {
    player.muted = !player.muted;
    return true;
  }
  // 条件分支: 命令要求切换全屏时进入；执行内容: 根据当前状态调用 xgplayer 对应公开方法。
  if (action === PLAYBACK_SHORTCUT_ACTION.toggleFullscreen) {
    // 类型: Promise|*；作用: 保存进入或退出全屏操作结果，统一吸收浏览器拒绝并由播放器 UI 保持原状态。
    const operation = player.fullscreen ? player.exitFullscreen?.() : player.getFullscreen?.();
    Promise.resolve(operation).catch(() => {});
    return true;
  }
  // 条件分支: 命令属于分集导航且页面提供回调时进入；执行内容: 把路由职责交还 PlayerView，不在插件读取分集。
  if ([PLAYBACK_SHORTCUT_ACTION.previousEpisode, PLAYBACK_SHORTCUT_ACTION.nextEpisode].includes(action)
    && typeof onPageCommand === 'function') {
    onPageCommand(action);
    return true;
  }
  return false;
}
