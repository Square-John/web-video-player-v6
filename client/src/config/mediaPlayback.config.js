/*
  mediaPlayback.config.js 模块说明

  - 文件职责:
      集中定义真实媒体类型、交付方式、会话阶段、稳定错误、快捷键命令和播放器数值策略。
      供媒体校验、快捷键 service、xgplayer 适配组件和 PlayerView 共同使用，避免散落魔法值。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      MEDIA_TYPE: object，受支持媒体类型枚举。
      MEDIA_DELIVERY_MODE: object，媒体交付方式枚举。
      MEDIA_PLAYBACK_PHASE: object，媒体会话阶段枚举。
      MEDIA_REACHABILITY_STATUS: object，播放页会话级媒体可达状态枚举。
      MEDIA_PLAYBACK_REQUEST_PURPOSE: object，标准 player 请求的正式播放与媒体探测意图枚举。
      MEDIA_PLAYBACK_ERROR_CODE: object，播放器稳定错误码枚举。
      MEDIA_PLAY_STATUS: object，媒体阶段写入用户内容时使用的播放状态枚举。
      MEDIA_RESUME_SELECTION: object，近尾恢复提示的用户选择枚举。
      PLAYBACK_SHORTCUT_ACTION: object，项目播放器命令枚举。
      PLAYBACK_SHORTCUT_MODIFIER: object，快捷键修饰符枚举。
      PLAYBACK_SHORTCUT_PREFERENCES_SCHEMA_VERSION: string，快捷键偏好保存结构版本。
      DEFAULT_PLAYBACK_SHORTCUT_BINDINGS: Array<object>，默认快捷键绑定。
      PLAYBACK_SEEK_STEP_SECONDS: number，快捷键单次跳转秒数。
      PLAYBACK_PROGRESS_CHECKPOINT_SECONDS: number，后续进度提交检查点间隔。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      全部上述常量，供播放领域模块按同一枚举和数值策略运行。
*/

// 类型: object。
// 作用: 只允许适配层已实现的 MP4 与 HLS；unknown 用于明确失败关闭，不触发扩展名猜测。
export const MEDIA_TYPE = Object.freeze({
  mp4: 'mp4',
  hls: 'hls',
  unknown: 'unknown'
});

// 类型: object。
// 作用: 当前媒体只能由浏览器直连，禁止通过项目后端代理视频流。
export const MEDIA_DELIVERY_MODE = Object.freeze({
  direct: 'direct'
});

// 类型: object。
// 作用: 定义播放器适配层可以向页面发布的全部稳定生命周期阶段。
export const MEDIA_PLAYBACK_PHASE = Object.freeze({
  idle: 'idle',
  loading: 'loading',
  ready: 'ready',
  playing: 'playing',
  paused: 'paused',
  buffering: 'buffering',
  ended: 'ended',
  autoplayBlocked: 'autoplayBlocked',
  unsupported: 'unsupported',
  error: 'error'
});

// 类型: object。
// 作用: 限定播放页真实媒体探测只使用检测中、可用和不可用三态；字段只属于当前 PlayerView 会话，不进入持久化对象。
export const MEDIA_REACHABILITY_STATUS = Object.freeze({
  checking: 'checking',
  available: 'available',
  unavailable: 'unavailable'
});

// 类型: object。
// 作用: 让标准 player 请求区分正式播放和无视觉探测；Provider 只消费通用意图并独占自己的媒体刷新策略。
export const MEDIA_PLAYBACK_REQUEST_PURPOSE = Object.freeze({
  playback: 'playback',
  probe: 'probe'
});

// 类型: object。
// 作用: 把契约、动态加载、第三方初始化和浏览器媒体失败转换为页面可依赖的稳定错误身份。
export const MEDIA_PLAYBACK_ERROR_CODE = Object.freeze({
  invalidSource: 'MEDIA_SOURCE_INVALID',
  unavailableSource: 'MEDIA_SOURCE_UNAVAILABLE',
  unsupportedMedia: 'MEDIA_TYPE_UNSUPPORTED',
  dependencyLoadFailed: 'MEDIA_DEPENDENCY_LOAD_FAILED',
  playerInitializationFailed: 'MEDIA_PLAYER_INITIALIZATION_FAILED',
  mediaPlaybackFailed: 'MEDIA_PLAYBACK_FAILED'
});

// 类型: object。
// 作用: 统一真实媒体会话写入 currentPlaying 和播放历史时使用的状态，避免页面与 service 拼写分叉。
export const MEDIA_PLAY_STATUS = Object.freeze({
  playing: 'playing',
  paused: 'paused',
  finished: 'finished'
});

// 类型: object。
// 作用: 表达近尾恢复提示的两个明确用户决定；该选择只影响当前播放器创建，不写入路由或历史。
export const MEDIA_RESUME_SELECTION = Object.freeze({
  restart: 'restart',
  continue: 'continue'
});

// 类型: object。
// 作用: 限定播放器进度提示的稳定种类，组件样式和纯模型不使用自由字符串分支。
export const MEDIA_PROGRESS_PROMPT_KIND = Object.freeze({
  loading: 'loading',
  resume: 'resume',
  buffering: 'buffering',
  nearEnd: 'nearEnd',
  autoplayBlocked: 'autoplayBlocked',
  error: 'error'
});

// 类型: object。
// 作用: 限定进度提示可以发出的项目动作，第三方播放器文案不能扩张页面命令。
export const MEDIA_PROGRESS_PROMPT_ACTION = Object.freeze({
  restart: 'restart',
  nextEpisode: 'nextEpisode',
  retry: 'retry'
});

// 类型: Readonly<object>。
// 作用: 集中维护近尾判断和横向锚点安全边界，提示模型、组件和测试共用同一数值策略。
export const MEDIA_PROGRESS_PROMPT_POLICY = Object.freeze({
  nearEndThresholdSeconds: 30,
  nearEndMinimumProgressRatio: 0.8,
  minimumAnchorPercent: 8,
  maximumAnchorPercent: 92,
  defaultAnchorPercent: 8
});

// 类型: object。
// 作用: 项目拥有的播放器命令集合；第三方插件只能消费这些命令，不能反向定义设置字段。
export const PLAYBACK_SHORTCUT_ACTION = Object.freeze({
  togglePlay: 'togglePlay',
  seekBackward: 'seekBackward',
  seekForward: 'seekForward',
  toggleMute: 'toggleMute',
  toggleFullscreen: 'toggleFullscreen',
  previousEpisode: 'previousEpisode',
  nextEpisode: 'nextEpisode'
});

// 类型: object。
// 作用: 限定快捷键组合可以使用的修饰键名称，保证签名和冲突检查稳定。
export const PLAYBACK_SHORTCUT_MODIFIER = Object.freeze({
  alt: 'alt',
  control: 'control',
  meta: 'meta',
  shift: 'shift'
});

// 类型: string。
// 作用: 作为快捷键偏好保存、迁移和运行时校验的共同结构版本，避免 Repository 反向依赖设置页 service。
export const PLAYBACK_SHORTCUT_PREFERENCES_SCHEMA_VERSION = '1.0.0';

// 类型: Array<object>。
// 作用: 提供项目默认播放器快捷键；设置页未来只覆盖此结构，不直接修改 xgplayer 配置。
// 顺序: 作为设置页展示顺序，不影响事件匹配优先级；冲突会在注册前失败关闭。
export const DEFAULT_PLAYBACK_SHORTCUT_BINDINGS = Object.freeze([
  Object.freeze({ action: PLAYBACK_SHORTCUT_ACTION.togglePlay, key: 'Space', modifiers: Object.freeze([]), enabled: true }),
  Object.freeze({ action: PLAYBACK_SHORTCUT_ACTION.seekBackward, key: 'ArrowLeft', modifiers: Object.freeze([]), enabled: true }),
  Object.freeze({ action: PLAYBACK_SHORTCUT_ACTION.seekForward, key: 'ArrowRight', modifiers: Object.freeze([]), enabled: true }),
  Object.freeze({ action: PLAYBACK_SHORTCUT_ACTION.toggleMute, key: 'KeyM', modifiers: Object.freeze([]), enabled: true }),
  Object.freeze({ action: PLAYBACK_SHORTCUT_ACTION.toggleFullscreen, key: 'KeyF', modifiers: Object.freeze([]), enabled: true }),
  Object.freeze({ action: PLAYBACK_SHORTCUT_ACTION.previousEpisode, key: 'BracketLeft', modifiers: Object.freeze([]), enabled: true }),
  Object.freeze({ action: PLAYBACK_SHORTCUT_ACTION.nextEpisode, key: 'BracketRight', modifiers: Object.freeze([]), enabled: true })
]);

// 类型: number。
// 作用: 左右方向键每次前进或后退的秒数，快捷键 service 和测试共用该策略。
export const PLAYBACK_SEEK_STEP_SECONDS = 10;

// 类型: number。
// 作用: 真实播放阶段每隔该秒数最多提交一次长期进度；pause/ended/切换/销毁仍执行最终提交。
export const PLAYBACK_PROGRESS_CHECKPOINT_SECONDS = 10;
