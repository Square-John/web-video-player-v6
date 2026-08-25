<template>
  <!--
    [DEFAULT] ele(xgplayerMediaPlayer)
    ├─ [DEFAULT] ele(playerHost)
    │  - condition: 组件存活期间始终渲染。
    │  - type: 原生 div，xgplayer 唯一 DOM 挂载点。
    │  - description: 提供稳定播放器舞台，第三方实例创建和销毁不改变页面布局。
    │  - params: ref=playerHost 供组件生命周期访问；无页面数据字段直接渲染。
    │  - events: 媒体事件转换为 session-event；实例释放前最后快照转换为 session-finalize。
    └─ [IF progressPrompt] ele(progressPrompt)
       - condition: 当前稳定媒体阶段派生出恢复、缓冲、近尾、自动播放或错误提示时渲染。
       - type: 原生 div。
       - description: 在控制区进度条上方按播放比例定位半透明提示，不覆盖播放器顶部内容。
       - params: progressPrompt 提供种类、文案、动作和锚点；终态使用 alert 语义。
       - events: 动作统一交给 handleProgressPromptAction，复用当前实例或页面下一集命令。
  -->
  <!--
    [DEFAULT] ele(xgplayerMediaPlayer)
    - condition: 组件存活期间始终渲染。
    - type: 原生 div。
    - description: 约束播放器挂载点和状态层的尺寸、裁切与定位上下文。
    - params: 无。
    - events: 无。
  -->
  <div class="xgplayer-media-player">
    <!--
      [DEFAULT] ele(playerHost)
      - condition: 组件存活期间始终渲染。
      - type: 原生 div，xgplayer 唯一 DOM 挂载点。
      - description: 承载当前且仅有的一个第三方播放器实例。
      - params: ref=playerHost 供 initializePlayer 和 releasePlayer 使用。
      - events: 内部媒体事件转为 session-event；释放前快照转为 session-finalize。
    -->
    <div ref="playerHost" class="xgplayer-media-player__host" aria-label="视频播放器"></div>
    <!--
      [IF progressPrompt] ele(progressPrompt)
      - condition: 当前稳定媒体会话派生出唯一进度提示时渲染。
      - type: 原生 div。
      - description: 紧贴播放器控制区进度条并跟随当前播放比例，展示恢复、缓冲、近尾或错误状态。
      - params: progressPrompt 为纯模型；progressPromptStyle 只提供集中计算后的 CSS 锚点变量。
      - events: 每个动作调用 handleProgressPromptAction，不直接解释页面目录。
    -->
    <div
      v-if="progressPrompt"
      class="xgplayer-media-player__progress-prompt"
      :class="[
        `is-${progressPrompt.kind}`,
        { 'is-terminal': progressPrompt.isTerminal }
      ]"
      :style="progressPromptStyle"
      :role="progressPrompt.isTerminal ? 'alert' : 'status'">
      <span class="xgplayer-media-player__progress-message">{{ progressPrompt.message }}</span>
      <!-- 提示动作只使用纯模型声明的项目命令，不从文案或 DOM 推断行为。 -->
      <button
        v-for="action in progressPrompt.actions"
        :key="action.id"
        type="button"
        class="xgplayer-media-player__progress-action"
        @click="handleProgressPromptAction(action.id)">
        {{ action.label }}
      </button>
    </div>
  </div>
</template>

<script>
/*
  XgplayerMediaPlayer.vue 模块说明

  - 文件职责:
      动态加载 xgplayer、xgplayer-hls 和样式，为一个媒体槽位创建唯一实例并把第三方事件转换为稳定媒体会话。
      候选槽位使用同一真实播放器等待 CANPLAY，提升为活动槽位时继续复用该实例而不二次创建。
      向 PlayerView 暴露同步 suspendPlayerForHandoff 和可等待 disposePlayer 所有者端口，分别负责不可逆交接停播快照与完整资源释放。
      组件只拥有播放器生命周期和 DOM 资源，不写用户历史、Router、Provider 或 Repository。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      MEDIA_PLAYBACK_ERROR_CODE、MEDIA_PLAYBACK_PHASE、MEDIA_PROGRESS_PROMPT_ACTION、PLAYBACK_SHORTCUT_ACTION、MEDIA_TYPE: 自定义配置，提供稳定状态、提示动作、页面命令和媒体类型。
      createProjectShortcutPlugin: 自定义工厂，结合动态 BasePlugin 创建项目快捷键插件。
      createMediaProgressPrompt: 自定义纯服务，从稳定会话派生唯一进度提示。
      normalizeMediaPlaybackSession、normalizeMediaPlaybackMedia: 自定义校验器，严格采用直连媒体和会话。

  - 模块级常量:
      PLAYER_LANGUAGE: string，xgplayer 中文界面语言。
      PLAYER_FIT_MODE: string，播放器固定容器适配策略。
      MEDIA_REQUEST_KIND_BY_EXTENSION: Readonly<object>，媒体文件扩展名到脱敏请求阶段的映射。

  - 模块级变量:
      xgplayerModulePromise: Promise<object>|null，当前页面会话共享的动态依赖加载任务。

  - 模块级辅助函数:
      loadXgplayerModules(): 动态加载播放器、HLS、BasePlugin、Events 和 CSS。
      normalizeMediaMetric(value): 把第三方媒体秒数转换为非负有限数或 null。
      readBufferedSeconds(player): 读取最后缓冲区末端秒数。

  - 模块级类:
      无

  - 对外导出:
      XgplayerMediaPlayer: Vue component，供 PlayerView 挂载真实 MP4/HLS 播放器并消费稳定媒体事件。
*/

import {
  // 导入来源: ../../config/mediaPlayback.config.js；导入内容: MEDIA_PLAYBACK_ERROR_CODE；文件作用: 转换依赖、初始化和媒体失败。
  MEDIA_PLAYBACK_ERROR_CODE,
  // 导入来源: ../../config/mediaPlayback.config.js；导入内容: MEDIA_PLAYBACK_PHASE；文件作用: 发布稳定会话阶段。
  MEDIA_PLAYBACK_PHASE,
  // 导入来源: ../../config/mediaPlayback.config.js；导入内容: MEDIA_PROGRESS_PROMPT_ACTION；文件作用: 分派从头、下一集和重试动作。
  MEDIA_PROGRESS_PROMPT_ACTION,
  // 导入来源: ../../config/mediaPlayback.config.js；导入内容: PLAYBACK_SHORTCUT_ACTION；文件作用: 把下一集提示转发为既有页面命令。
  PLAYBACK_SHORTCUT_ACTION,
  // 导入来源: ../../config/mediaPlayback.config.js；导入内容: MEDIA_TYPE；文件作用: 决定是否注册官方 HLS 插件。
  MEDIA_TYPE
} from '../../config/mediaPlayback.config.js';

// 导入来源: ../../services/mediaProgressPromptService.js。
// 导入内容: createMediaProgressPrompt 纯提示模型工厂。
// 文件作用: 使用稳定媒体会话和集中策略派生唯一进度锚定提示。
import { createMediaProgressPrompt } from '../../services/mediaProgressPromptService.js';

// 导入来源: ../../plugins/projectShortcutPlugin.js。
// 导入内容: createProjectShortcutPlugin；文件作用: 动态 BasePlugin 加载后创建项目快捷键插件类。
import { createProjectShortcutPlugin } from '../../plugins/projectShortcutPlugin.js';

import {
  // 导入来源: ../../utils/mediaPlaybackValidators.js；导入内容: normalizeMediaPlaybackSession；文件作用: 发布前严格校验会话。
  normalizeMediaPlaybackSession,
  // 导入来源: ../../utils/mediaPlaybackValidators.js；导入内容: normalizeMediaPlaybackMedia；文件作用: 创建实例前严格校验已解析直连媒体。
  normalizeMediaPlaybackMedia
} from '../../utils/mediaPlaybackValidators.js';

// 类型: string。
// 作用: xgplayer 控件使用简体中文，不从浏览器环境生成不稳定语言分支。
const PLAYER_LANGUAGE = 'zh-cn';

// 类型: string。
// 作用: 视频保持在组件稳定容器内按 contain 方式展示，不裁切媒体画面。
const PLAYER_FIT_MODE = 'fixed';

// 类型: Readonly<object>。
// 作用: 把失败请求扩展名限制为通用媒体阶段，诊断日志不输出完整地址、路径片段或 Provider 私有参数。
const MEDIA_REQUEST_KIND_BY_EXTENSION = Object.freeze({
  m3u8: 'manifest',
  mpd: 'manifest',
  ts: 'segment',
  m4s: 'segment',
  mp4: 'media',
  key: 'key',
  aac: 'audio',
  vtt: 'subtitle'
});

// 类型: Promise<object>|null。
// 生命周期: 首次播放页实例创建时赋值；加载失败后重置为 null 允许后续显式重试。
// 作用: 同一页面并发创建只加载一次 xgplayer、HLS 和 CSS，非播放页面不会触发该 Promise。
let xgplayerModulePromise = null;

/**
 * 动态加载 xgplayer 运行依赖。
 * 副作用: 首次调用请求三个异步 chunk 并注册播放器 CSS；不创建播放器实例。
 * 成功路径: 返回 Player、BasePlugin、Events 和 HlsPlugin。
 * 失败路径: 重置共享 Promise 并向组件传播原始加载错误，由组件转换为稳定媒体失败。
 *
 * @returns {Promise<object>} 动态播放器模块集合。
 */
function loadXgplayerModules() {
  // 条件分支: 当前页面会话尚未创建共享加载任务时进入；执行内容: 并发加载播放器、HLS 插件和 CSS 并缓存同一 Promise。
  if (!xgplayerModulePromise) {
    xgplayerModulePromise = Promise.all([
      import('xgplayer'),
      import('xgplayer-hls'),
      import('xgplayer/dist/index.min.css')
    ]).then(([xgplayerModule, hlsModule]) => ({
      Player: xgplayerModule.default,
      BasePlugin: xgplayerModule.BasePlugin,
      Events: xgplayerModule.Events,
      HlsPlugin: hlsModule.default
    })).catch((error) => {
      xgplayerModulePromise = null;
      throw error;
    });
  }
  return xgplayerModulePromise;
}

/**
 * 标准化第三方媒体秒数。
 * 纯函数: 不修改播放器。
 *
 * @param {*} value xgplayer 或 HTMLMediaElement 秒数。
 * @returns {number|null} 非负有限数或 null。
 */
function normalizeMediaMetric(value) {
  // 类型: number；作用: 把第三方媒体属性统一转换为数值，再按稳定会话非负有限数边界筛选。
  const metric = Number(value);
  return Number.isFinite(metric) && metric >= 0 ? metric : null;
}

/**
 * 读取播放器最后一个缓冲区末端。
 * 纯函数: 只读取 TimeRanges，不修改播放器或缓冲状态。
 * 失败路径: buffered 不可用、为空或浏览器读取抛错时返回 null。
 *
 * @param {object|null} player 当前 xgplayer 实例。
 * @returns {number|null} 最远缓冲秒数或 null。
 */
function readBufferedSeconds(player) {
  try {
    // 类型: TimeRanges|null；作用: 读取浏览器缓冲区集合，使用最后一段末端作为当前最远缓冲秒数。
    const buffered = player?.buffered;
    // 条件分支: 浏览器没有暴露缓冲集合或集合为空时进入；执行内容: 返回 null 保留未知语义。
    if (!buffered || buffered.length === 0) {
      return null;
    }
    return normalizeMediaMetric(buffered.end(buffered.length - 1));
  } catch {
    return null;
  }
}

export default {
  name: 'XgplayerMediaPlayer',

  props: {
    // 类型: string。
    // 来源: PlayerView 当前页面会话单调媒体槽位身份。
    // 作用: 让父级通过 v-for ref 精确定位资源所有者并等待释放，不使用 DOM 顺序或媒体业务身份猜测实例。
    slotId: {
      type: String,
      required: true
    },

    // 类型: object。
    // 来源: PlayerView 已成功采用的 ContentItem.playback.media。
    // 作用: 提供经过严格校验的直连媒体；变化时销毁旧实例并创建新会话，线路身份由 sessionContext 独立提供。
    source: {
      type: Object,
      required: true
    },

    // 类型: object。
    // 来源: PlayerView 从路由和 ContentItem 派生的当前身份。
    // 作用: 为稳定媒体会话补充数据源、内容、分集和线路身份，不包含媒体 URL。
    sessionContext: {
      type: Object,
      required: true
    },

    // 类型: boolean。
    // 来源: PlayerView 媒体槽位协调状态。
    // true: 当前组件是唯一正式播放器，允许转发快捷键并按 autoplay 意图开始播放。
    // false: 当前组件只在不可见候选槽位准备真实媒体，不自动播放、不转发页面命令。
    active: {
      type: Boolean,
      default: false
    },

    // 类型: boolean。
    // 来源: player 路由 autoplay query。
    // true: xgplayer 初始化后尝试自动播放，可能被浏览器策略拒绝。
    // false: 只准备媒体并等待用户操作。
    autoplay: {
      type: Boolean,
      default: false
    },

    // 类型: number。
    // 来源: PlayerView 恢复策略。
    // 作用: xgplayer 初始 seek 秒数；非法或负数在配置阶段归零。
    startTime: {
      type: Number,
      default: 0
    },

    // 类型: string。
    // 来源: ContentItem.cover/poster。
    // 作用: 媒体首帧准备前展示封面，不作为播放身份。
    poster: {
      type: String,
      default: ''
    },

    // 类型: object。
    // 来源: PlayerView 从 shortcutSettingsStore 读取的 Repository 已提交偏好。
    // 作用: 只决定项目命令键位，不让 xgplayer 保存设置或创建第二套默认值。
    shortcutPreferences: {
      type: Object,
      required: true
    },

    // 类型: boolean。
    // 来源: PlayerView 当前实际播放线路和分集位置。
    // 作用: 控制近尾提示是否提供下一集动作；组件不读取或解释目录。
    hasNextEpisode: {
      type: Boolean,
      default: false
    }
  },

  /**
   * 创建组件局部展示状态。
   * 副作用: 每个组件实例创建独立响应式状态，但不创建播放器、DOM 监听或持久化写入。
   *
   * @returns {object} 当前稳定媒体阶段、唯一进度提示和恢复提示事件状态。
   */
  data() {
    return {
      // 类型: Readonly<object>|null。
      // 作用: 保存纯服务根据最后稳定会话派生的唯一进度提示；无需提示时为 null。
      progressPrompt: null,

      // 类型: boolean。
      // true: 当前资源已经开始播放或用户选择从头，恢复提示不再重复出现。
      // false: 当前资源仍可在 CANPLAY/自动播放受限时说明历史定位位置。
      resumePromptAcknowledged: false,

      // 类型: string。
      // 作用: 保存最近发布阶段，TIME_UPDATE 继续沿用当前阶段而不伪造 playing。
      currentPhase: MEDIA_PLAYBACK_PHASE.idle
    };
  },

  computed: {
    /**
     * 当前媒体资源身份。
     * 纯函数: 只读取直连媒体字段；URL、类型或交付方式变化时触发实例替换。
     *
     * @returns {string} 用于 watcher 比较的资源身份。
     */
    sourceIdentity() {
      return [this.source?.type || '', this.source?.url || '', this.source?.deliveryMode || ''].join('::');
    },

    /**
     * 把纯模型锚点转换为 CSS 自定义属性。
     * 纯函数: 只读取已由集中策略夹取的百分比，不重新解释播放进度。
     *
     * @returns {object} Vue style 绑定对象。
     */
    progressPromptStyle() {
      return this.progressPrompt
        ? { '--media-progress-prompt-position': `${this.progressPrompt.positionPercent}%` }
        : {};
    }
  },

  watch: {
    /**
     * 线路资源变化后重建播放器。
     * 副作用: 销毁旧 xgplayer、加载依赖并创建新实例。
     *
     * @returns {void} 异步失败由 initializePlayer 转换为稳定会话。
     */
    sourceIdentity() {
      this.initializePlayer();
    },

    /**
     * 监听候选槽位被提升为正式播放器。
     * 副作用: 复用当前已经 CANPLAY 的同一 xgplayer 实例发布活动快照，并按 autoplay 意图尝试播放。
     * 成功路径: 不销毁、不重建、不重新请求媒体；浏览器允许时继续进入 playing。
     * 失败路径: 自动播放拒绝交给既有 AUTOPLAY_PREVENTED 事件；同步或 Promise reject 不把可用媒体误报为线路失败。
     *
     * @param {boolean} isActive 新活动状态。
     * @returns {void} 播放 Promise 由方法内部收敛。
     */
    active(isActive) {
      // 条件分支: 候选尚未提升或播放器实例尚未完成创建时进入；执行内容: 保持候选准备状态，不触发播放。
      if (!isActive || !this._mediaPlayerInstance) return;
      // 状态交接: 先以同一实例的最后阶段发布正式活动快照，让父页建立正确身份后再接收后续进度。
      this.publishSession(this.currentPhase, this._mediaPlayerInstance);
      // 条件分支: 当前路由没有自动播放意图或实例不提供 play 时进入；执行内容: 保持 ready，等待用户手动播放。
      if (!this.autoplay || typeof this._mediaPlayerInstance.play !== 'function') return;
      try {
        // 类型: Promise<*>|*；作用: 只对已提升的正式实例发起一次播放；候选准备期从不自动播放或产生隐藏音频。
        const playOperation = this._mediaPlayerInstance.play();
        // 条件分支: 第三方 play 返回 Promise 时进入；执行内容: 吸收浏览器策略 reject，正式提示仍由 AUTOPLAY_PREVENTED 事件发布。
        if (playOperation && typeof playOperation.catch === 'function') playOperation.catch(() => {});
      } catch {
        // 失败边界: 同步自动播放拒绝不改变媒体已经 CANPLAY 的事实，用户仍可在正式播放器中手动开始。
      }
    }
  },

  /**
   * 组件实例创建时初始化非响应式媒体资源引用。
   * 副作用: 为当前组件建立播放器实例、会话代次和最后稳定快照的唯一所有权，不创建 DOM 或播放器。
   * 维护边界: 最后稳定快照只用于 releasePlayer 生命周期交接，不进入页面状态或持久化。
   *
   * @returns {void} 私有引用初始化完成。
   */
  created() {
    // 类型: object|null；生命周期: 当前组件实例；作用: 持有当前唯一 xgplayer 实例，releasePlayer 后恢复 null。
    this._mediaPlayerInstance = null;
    // 类型: number；生命周期: 当前组件实例；作用: 隔离异步初始化和旧播放器事件，切换或销毁时单调递增。
    this._mediaSessionGeneration = 0;
    // 类型: Readonly<object>|null；生命周期: 当前媒体资源；作用: 在实例尚未创建或最终指标读取失败时提供最后严格会话。
    this._lastPublishedMediaSession = null;
  },

  /**
   * 组件挂载后创建首个播放器会话。
   * 副作用: 在 playerHost 可用后动态加载依赖并创建当前唯一播放器实例。
   *
   * @returns {void} 初始化失败由 initializePlayer 发布稳定会话。
   */
  mounted() {
    // 生命周期副作用: 首次挂载后才能取得 playerHost DOM，因此在此创建播放器实例。
    this.initializePlayer();
  },

  /**
   * 组件销毁前使当前代次失效并释放媒体资源。
   * 副作用: 停止旧会话事件采用，销毁 xgplayer、HLS 和项目快捷键监听。
   *
   * @returns {void} 资源清理 Promise 由 disposePlayer 自身收敛。
   */
  beforeDestroy() {
    // 生命周期副作用: 复用公开所有者释放端口；父级已等待释放时该调用幂等清理空实例。
    this.disposePlayer();
  },

  methods: {
    /**
     * 初始化当前直连媒体播放器。
     * 副作用: 校验媒体、动态加载依赖、创建 xgplayer、绑定事件并更新状态覆盖层。
     * 成功路径: 每次只保留一个当前代次实例，MP4 使用原生路径，HLS 注册官方插件。
     * 失败路径: 不可用/不支持线路不创建实例；加载和初始化失败发布稳定 error 会话。
     *
     * @returns {Promise<void>} 初始化收敛后结束。
     */
    async initializePlayer() {
      // 类型: number；作用: 为本次异步初始化分配单调递增代次，阻止旧加载结果覆盖新线路。
      const generation = Number(this._mediaSessionGeneration || 0) + 1;
      this._mediaSessionGeneration = generation;
      await this.releasePlayer();

      // 条件分支: 等待旧实例释放期间已经开始更新的媒体会话时进入；执行内容: 停止旧代次继续校验、加载或发布状态。
      if (generation !== this._mediaSessionGeneration || !this.$refs.playerHost) {
        return;
      }

      // 类型: object|undefined；作用: 保存严格校验后的隔离直连媒体，校验失败时不创建播放器。
      let normalizedSource;
      try {
        normalizedSource = normalizeMediaPlaybackMedia(this.source);
      } catch (error) {
        // 条件分支: 校验失败仍属于当前代次时进入；执行内容: 发布稳定 unsupported，旧代次失败不覆盖新线路。
        if (generation === this._mediaSessionGeneration) {
          this.publishFailure(
            MEDIA_PLAYBACK_PHASE.unsupported,
            error?.code || MEDIA_PLAYBACK_ERROR_CODE.invalidSource,
            error?.message || '当前播放媒体不受支持'
          );
        }
        return;
      }

      // 状态重建: 新媒体资源重新允许显示一次历史定位提示，并清空旧资源提示模型。
      this.resumePromptAcknowledged = false;
      this.progressPrompt = null;
      this.publishSession(MEDIA_PLAYBACK_PHASE.loading);

      // 类型: object|undefined；作用: 保存动态加载的 Player、BasePlugin、Events 和 HLS 插件导出。
      let modules;
      try {
        modules = await loadXgplayerModules();
      } catch {
        // 条件分支: 动态加载失败仍属于当前代次时进入；执行内容: 发布稳定依赖错误，旧请求失败只被丢弃。
        if (generation === this._mediaSessionGeneration) {
          this.publishFailure(
            MEDIA_PLAYBACK_PHASE.error,
            MEDIA_PLAYBACK_ERROR_CODE.dependencyLoadFailed,
            '播放器资源加载失败，请刷新后重试'
          );
        }
        return;
      }

      // 条件分支: 等待依赖期间线路已切换或组件已卸载时进入；执行内容: 丢弃旧初始化结果，不创建孤立实例。
      if (generation !== this._mediaSessionGeneration || !this.$refs.playerHost) {
        return;
      }

      try {
        // 类型: Function；作用: 使用本次动态 BasePlugin 创建项目快捷键类，避免静态导入 xgplayer。
        const ProjectShortcutPlugin = createProjectShortcutPlugin(modules.BasePlugin);
        // 类型: Array<Function>；作用: HLS 线路注册官方 HLS 插件，MP4 只注册项目快捷键插件。
        const plugins = normalizedSource.type === MEDIA_TYPE.hls
          ? [modules.HlsPlugin, ProjectShortcutPlugin]
          : [ProjectShortcutPlugin];
        // 类型: object；作用: 创建本代次唯一 xgplayer 实例，实例只持有直连 URL 和项目插件配置。
        const player = new modules.Player({
          el: this.$refs.playerHost,
          url: normalizedSource.url,
          poster: this.poster,
          autoplay: this.active && this.autoplay,
          startTime: Number.isFinite(this.startTime) && this.startTime > 0 ? this.startTime : 0,
          lang: PLAYER_LANGUAGE,
          fluid: true,
          fitVideoSize: PLAYER_FIT_MODE,
          videoFillMode: 'contain',
          playsinline: true,
          keyShortcut: false,
          plugins,
          projectShortcut: {
            preferences: this.shortcutPreferences,
            onPageCommand: this.handlePageShortcutCommand
          }
        });
        this._mediaPlayerInstance = player;
        this.bindPlayerEvents(player, modules.Events, generation);
      } catch {
        // 条件分支: 初始化失败仍属于当前代次时进入；执行内容: 发布稳定初始化错误，避免旧实例异常污染新媒体状态。
        if (generation === this._mediaSessionGeneration) {
          this.publishFailure(
            MEDIA_PLAYBACK_PHASE.error,
            MEDIA_PLAYBACK_ERROR_CODE.playerInitializationFailed,
            '播放器初始化失败，请切换线路或稍后重试'
          );
        }
      }
    },

    /**
     * 绑定第三方事件到稳定媒体会话。
     * 副作用: 在当前 player 注册事件监听；player.destroy 统一释放。
     * 成功路径: 仅当前 generation 事件允许发布。
     * 失败路径: 旧实例事件被 generation 门禁丢弃，媒体异常转换为安全错误。
     *
     * @param {object} player 当前 xgplayer 实例。
     * @param {object} events xgplayer Events 枚举。
     * @param {number} generation 当前媒体会话代次。
     * @returns {void} 监听由 player 生命周期持有。
     */
    bindPlayerEvents(player, events, generation) {
      // 类型: VueComponent；作用: 为嵌套的普通事件函数保留当前组件引用，同时避免依赖动态 this 绑定。
      const component = this;

      /**
       * 为无参数 xgplayer 事件创建稳定阶段发布器。
       * 副作用: 创建闭包回调；回调仅在代次仍有效时向父页发布会话。
       *
       * @param {string} phase 目标稳定媒体阶段。
       * @returns {Function} xgplayer 无参数事件回调。
       */
      function createPhasePublisher(phase) {
        /**
         * 发布当前闭包阶段。
         * 副作用: 当前代次内读取播放器指标并向 PlayerView 发布稳定会话。
         *
         * @returns {void} 旧代次事件直接丢弃。
         */
        function publishPhase() {
          // 条件分支: 事件仍属于当前媒体会话代次时进入；执行内容: 采用当前播放器指标并发布稳定阶段。
          if (generation === component._mediaSessionGeneration) {
            component.publishSession(phase, player);
          }
        }
        return publishPhase;
      }
      player.on(events.LOAD_START, createPhasePublisher(MEDIA_PLAYBACK_PHASE.loading));
      // 事件边界: xgplayer READY 只证明播放器实例初始化完成，不能作为媒体可播事实；真实采用必须等待 HTMLMediaElement CANPLAY。
      player.on(events.CANPLAY, createPhasePublisher(MEDIA_PLAYBACK_PHASE.ready));
      player.on(events.PLAYING, createPhasePublisher(MEDIA_PLAYBACK_PHASE.playing));
      player.on(events.PAUSE, createPhasePublisher(MEDIA_PLAYBACK_PHASE.paused));
      player.on(events.WAITING, createPhasePublisher(MEDIA_PLAYBACK_PHASE.buffering));
      player.on(events.ENDED, createPhasePublisher(MEDIA_PLAYBACK_PHASE.ended));
      /**
       * 处理 xgplayer 播放进度事件。
       * 副作用: 当前代次内发布最新秒数，但沿用已有阶段，不在组件写入历史。
       *
       * @returns {void} 旧代次事件直接丢弃。
       */
      player.on(events.TIME_UPDATE, () => {
        // 条件分支: 进度事件仍属于当前代次时进入；执行内容: 更新稳定会话指标而不伪造 playing 阶段。
        if (generation === this._mediaSessionGeneration) {
          this.publishSession(this.currentPhase, player);
        }
      });
      /**
       * 处理浏览器自动播放策略拒绝事件。
       * 副作用: 显示可恢复提示并发布 autoplayBlocked，保留同一播放器供用户点击。
       *
       * @returns {void} 旧代次事件直接丢弃。
       */
      player.on(events.AUTOPLAY_PREVENTED, () => {
        // 条件分支: 自动播放拒绝仍属于当前代次时进入；执行内容: 发布非终态受限状态并保留实例。
        if (generation === this._mediaSessionGeneration) {
          this.publishSession(MEDIA_PLAYBACK_PHASE.autoplayBlocked, player);
        }
      });
      /**
       * 统一处理 xgplayer 媒体和线路错误。
       * 副作用: 当前代次内发布安全错误说明，不泄漏原始事件或媒体 URL。
       *
       * @param {object} error xgplayer 归一化错误，只读取错误分类、状态和失败请求脱敏字段。
       * @returns {void} 旧代次错误直接丢弃。
       */
      function publishMediaError(error) {
        // 类型: URL|null；作用: 只解析第三方错误携带的失败请求地址，后续日志仅保留主机和通用请求阶段。
        let failedRequestUrl = null;
        try {
          failedRequestUrl = typeof error?.url === 'string' && error.url
            ? new URL(error.url)
            : null;
        } catch {
          // 失败补偿: 第三方没有提供合法绝对地址时保持 null，诊断链不因此覆盖原媒体错误。
        }
        // 类型: string；作用: 只提取最后一个点后的扩展名供固定映射查找，不把该原值写入日志。
        const requestExtension = failedRequestUrl?.pathname.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase() || '';
        // 类型: object；作用: 只保留第三方错误分类、错误码和媒体元素状态，诊断日志不记录完整媒体 URL 或 Provider 私有信息。
        const diagnostics = {
          errorType: typeof error?.errorType === 'string' ? error.errorType : '',
          errorCode: Number.isFinite(Number(error?.errorCode)) ? Number(error.errorCode) : null,
          message: typeof error?.message === 'string' ? error.message : '',
          readyState: Number.isInteger(error?.readyState) ? error.readyState : null,
          networkState: Number.isInteger(error?.networkState) ? error.networkState : null,
          requestHost: failedRequestUrl?.host || '',
          requestKind: MEDIA_REQUEST_KIND_BY_EXTENSION[requestExtension] || 'other',
          httpStatus: Number.isInteger(error?.httpCode) ? error.httpCode : null
        };
        // 诊断副作用: 浏览器控制台保留不含媒体地址的结构化失败证据，供通用播放器定位网络、解复用、解码或 MSE 阶段。
        console.error('[media-playback-failure]', JSON.stringify(diagnostics));
        // 条件分支: 错误仍属于当前媒体会话代次时进入；执行内容: 发布媒体加载/解码失败及最后有效秒数。
        if (generation === component._mediaSessionGeneration) {
          component.publishFailure(
            MEDIA_PLAYBACK_PHASE.error,
            MEDIA_PLAYBACK_ERROR_CODE.mediaPlaybackFailed,
            '媒体加载或解码失败，请切换线路后重试',
            player
          );
        }
      }
      player.on(events.ERROR, publishMediaError);
      player.on(events.SOURCE_ERROR, publishMediaError);
    },

    /**
     * 发布标准媒体会话。
     * 副作用: 更新组件 currentPhase/提示和最后稳定快照，并向 PlayerView emit session-event。
     * 失败路径: 会话校验失败时转为终态初始化错误，不向父级泄漏半完整对象。
     *
     * @param {string} phase MEDIA_PLAYBACK_PHASE 阶段。
     * @param {object|null} [player] 当前 xgplayer 实例。
     * @param {string} [errorCode] 稳定错误码。
     * @param {string} [errorMessage] 安全错误说明。
     * @returns {void} 会话通过 Vue 事件发布。
     */
    publishSession(phase, player = null, errorCode = '', errorMessage = '') {
      try {
        // 类型: object；作用: 将第三方实例指标和页面身份转换为严格冻结的 MediaPlaybackSessionState。
        const session = this.createMediaPlaybackSession(phase, player, errorCode, errorMessage);
        this.currentPhase = session.phase;
        // 条件分支: 当前实例已经真正进入 playing 时进入；执行内容: 事件驱动关闭本资源恢复提示，不使用固定等待。
        if (session.phase === MEDIA_PLAYBACK_PHASE.playing) {
          this.resumePromptAcknowledged = true;
        }
        // 状态投影: 纯服务按稳定会话、恢复位置和下一集能力生成唯一进度锚定提示；普通 ready 返回 null。
        this.progressPrompt = createMediaProgressPrompt({
          phase: session.phase,
          errorMessage: session.errorMessage,
          startSeconds: this.startTime,
          playedSeconds: session.playedSeconds,
          durationSeconds: session.durationSeconds,
          hasNextEpisode: this.hasNextEpisode,
          resumeAcknowledged: this.resumePromptAcknowledged
        });
        // 状态所有权: 保存已通过严格校验的最后快照，确保加载中切换或第三方最终指标读取失败时仍能完成生命周期交接。
        this._lastPublishedMediaSession = session;
        this.$emit('session-event', session);
      } catch {
        this.currentPhase = MEDIA_PLAYBACK_PHASE.error;
        this.progressPrompt = createMediaProgressPrompt({
          phase: MEDIA_PLAYBACK_PHASE.error,
          errorMessage: '播放器状态无效，请刷新后重试',
          startSeconds: this.startTime,
          playedSeconds: 0,
          durationSeconds: null,
          hasNextEpisode: this.hasNextEpisode,
          resumeAcknowledged: true
        });
      }
    },

    /**
     * 创建严格媒体会话快照。
     * 纯函数: 只读取当前 props 和播放器指标并返回冻结新对象，不发布 Vue 事件或写用户状态。
     * 失败路径: 身份、阶段、秒数或错误组合无效时由校验器抛出，调用方决定展示或忽略最终快照。
     *
     * @param {string} phase MEDIA_PLAYBACK_PHASE 阶段。
     * @param {object|null} [player] 当前 xgplayer 实例。
     * @param {string} [errorCode] 稳定错误码。
     * @param {string} [errorMessage] 安全错误说明。
     * @returns {Readonly<object>} 严格 MediaPlaybackSessionState。
     */
    createMediaPlaybackSession(phase, player = null, errorCode = '', errorMessage = '') {
      return normalizeMediaPlaybackSession({
        phase,
        sourceId: this.sessionContext?.sourceId || '',
        contentId: this.sessionContext?.contentId || '',
        episodeId: this.sessionContext?.episodeId || '',
        episodeIndex: this.sessionContext?.episodeIndex ?? null,
        playbackSourceId: this.sessionContext?.playbackSourceId || '',
        playedSeconds: normalizeMediaMetric(player?.currentTime) || 0,
        durationSeconds: normalizeMediaMetric(player?.duration),
        bufferedSeconds: readBufferedSeconds(player),
        errorCode,
        errorMessage
      });
    },

    /**
     * 发布稳定媒体失败。
     * 副作用: 更新终态覆盖层并向父级发布 error/unsupported 会话。
     *
     * @param {string} phase error 或 unsupported。
     * @param {string} errorCode 稳定错误码。
     * @param {string} errorMessage 安全用户说明。
     * @param {object|null} [player] 当前播放器，用于保留失败前最后秒数。
     * @returns {void} 失败通过组件状态和 session-event 表达。
     */
    publishFailure(phase, errorCode, errorMessage, player = null) {
      // 单一写入口: publishSession 校验错误组合后同时更新文案、终态语义和父级会话，避免失败状态双写。
      this.publishSession(phase, player, errorCode, errorMessage);
    },

    /**
     * 转发页面级快捷键命令。
     * 副作用: 向 PlayerView emit shortcut-command；不直接读取分集数组或修改 Router。
     *
     * @param {string} action previousEpisode 或 nextEpisode 项目命令。
     * @returns {void} 命令由父页决定是否可执行。
     */
    handlePageShortcutCommand(action) {
      // 条件分支: 当前组件仍是不可见候选槽位时进入；执行内容: 不把候选播放器命令发送给页面目录。
      if (!this.active) return;
      this.$emit('shortcut-command', action);
    },

    /**
     * 处理进度提示中的正式动作。
     * 副作用: 从头动作只控制当前 xgplayer 实例；下一集转发既有页面命令；重试复用唯一初始化生命周期。
     * 失败路径: 未知动作或候选槽位忽略，不扩张页面能力。
     *
     * @param {string} actionId MEDIA_PROGRESS_PROMPT_ACTION。
     * @returns {void} 同步动作完成或播放 Promise 已安全收敛。
     */
    handleProgressPromptAction(actionId) {
      // 条件分支: 当前槽位不是正式播放器时进入；执行内容: 候选提示不能控制媒体或页面选集。
      if (!this.active) return;
      // 条件分支: 用户选择从头播放时进入；执行内容: 复用当前实例零秒播放入口并结束命令分派。
      if (actionId === MEDIA_PROGRESS_PROMPT_ACTION.restart) {
        this.restartCurrentMedia();
        return;
      }
      // 条件分支: 用户选择播放下一集时进入；执行内容: 只转发既有页面命令，不在组件解释目录。
      if (actionId === MEDIA_PROGRESS_PROMPT_ACTION.nextEpisode) {
        // 条件分支: 页面仍证明当前实际线路存在下一集时进入；执行内容: 发出集中 nextEpisode 命令。
        if (this.hasNextEpisode) {
          this.$emit('shortcut-command', PLAYBACK_SHORTCUT_ACTION.nextEpisode);
        }
        return;
      }
      // 条件分支: 用户选择重试当前线路时进入；执行内容: 复用唯一播放器初始化生命周期。
      if (actionId === MEDIA_PROGRESS_PROMPT_ACTION.retry) {
        this.retryCurrentSource();
      }
    },

    /**
     * 使用当前播放器从零开始播放。
     * 副作用: 把当前实例 currentTime 设为 0、关闭恢复提示并调用公开 play；不创建新实例或修改历史身份。
     * 失败路径: 实例缺失或浏览器拒绝播放时保持当前资源，后续稳定事件继续更新提示。
     *
     * @returns {void} 播放 Promise 由本方法吸收策略拒绝。
     */
    restartCurrentMedia() {
      // 类型: object|null；作用: 捕获当前唯一 xgplayer 实例，动作期间不重新查找 DOM 或创建资源。
      const player = this._mediaPlayerInstance;
      // 条件分支: 当前实例已经释放或尚未创建时进入；执行内容: 忽略迟到动作并保持页面状态。
      if (!player) return;
      try {
        player.currentTime = 0;
        this.resumePromptAcknowledged = true;
        this.progressPrompt = null;
        // 条件分支: 当前第三方实例提供公开 play 端口时进入；执行内容: 零秒 seek 后继续播放。
        if (typeof player.play === 'function') {
          // 类型: Promise<*>|*；作用: 保存第三方播放返回值，以便吸收浏览器策略迟到拒绝。
          const playOperation = player.play();
          // 条件分支: play 返回 Promise-like 对象时进入；执行内容: 吸收拒绝并等待正式播放器事件表达状态。
          if (playOperation && typeof playOperation.catch === 'function') {
            playOperation.catch(() => {});
          }
        }
      } catch {
        // 第三方 seek/play 同步失败由后续播放器错误事件收敛，不构造第二错误状态。
      }
    },

    /**
     * 重试当前媒体线路。
     * 副作用: 复用 initializePlayer 的代次、释放、校验、依赖加载和事件绑定完整生命周期。
     * 成功路径: 当前唯一线路重新进入 loading 并创建一个新的 xgplayer 实例。
     * 失败路径: 校验、依赖或媒体失败继续由同一稳定会话和终态提示表达，不建立自动重试。
     *
     * @returns {void} 异步生命周期由 initializePlayer 自身收敛并发布状态。
     */
    retryCurrentSource() {
      this.initializePlayer();
    },

    /**
     * 为不可逆媒体交接同步暂停活动播放器并冻结最终会话快照。
     * 副作用: 立即使当前媒体事件代次失效，调用公开 pause 停止声音和画面推进，并更新最后稳定快照；不销毁实例或写历史。
     * 成功路径: 优先返回暂停时刻真实指标生成的严格快照；实例不存在或指标无效时返回最后已发布严格会话。
     * 失败路径: 第三方 pause 或指标读取异常被吸收，所有者仍可使用兜底快照并继续 disposePlayer 资源屏障。
     * 调用边界: 只允许 PlayerView 的 replace-media 路径在任何异步等待前调用；同集换线不得调用。
     *
     * @returns {Readonly<object>|null} 暂停时刻的严格 MediaPlaybackSessionState 或 null。
     */
    suspendPlayerForHandoff() {
      // 类型: object|null；作用: 捕获同步交接开始时的活动实例，后续 disposePlayer 仍拥有并负责完整销毁该资源。
      const player = this._mediaPlayerInstance || null;
      // 生命周期副作用: 先使当前代次失效，pause 及其后的旧事件不能向父页发布普通会话或改写冻结结果。
      this._mediaSessionGeneration = Number(this._mediaSessionGeneration || 0) + 1;

      // 条件分支: 活动实例公开暂停端口时进入；执行内容: 在任何 Promise 屏障前同步停止媒体推进。
      if (player && typeof player.pause === 'function') {
        try {
          // 类型: Promise<*>|*；作用: xgplayer 的 pause 同步暂停底层媒体；若第三方返回 Promise，只吸收其迟到拒绝。
          const pauseOperation = player.pause();
          // 条件分支: 第三方暂停端口返回 Promise 时进入；执行内容: 吸收迟到拒绝，实际资源停止仍由 disposePlayer 收敛。
          if (pauseOperation && typeof pauseOperation.catch === 'function') pauseOperation.catch(() => {});
        } catch {
          // 失败补偿: pause 异常不阻断随后并行的播放器销毁；资源释放仍会停止底层媒体。
        }
      }

      // 类型: Readonly<object>|null；作用: 没有实例或最新指标失效时，保留交接前最后一条严格媒体会话。
      let frozenSession = this._lastPublishedMediaSession || null;
      // 条件分支: 当前存在活动实例时进入；执行内容: 在 pause 返回后立即读取同一实例的最终秒数和时长。
      if (player) {
        try {
          frozenSession = this.createMediaPlaybackSession(
            this.currentPhase,
            player,
            frozenSession?.errorCode || '',
            frozenSession?.errorMessage || ''
          );
        } catch {
          // 失败补偿: 严格校验拒绝第三方异常指标时继续使用最后已发布快照，不构造半完整会话。
        }
      }
      // 状态所有权: releasePlayer 的最终事件以同一冻结快照为兜底；PlayerView 会在交接门禁中忽略重复 finalization。
      this._lastPublishedMediaSession = frozenSession;
      return frozenSession;
    },

    /**
     * 由组件所有者显式停止当前代次并等待播放器资源释放。
     * 副作用: 使旧异步初始化和媒体事件失效，再释放 xgplayer、HLS、插件、监听及挂载 DOM。
     * 成功路径: PlayerView 可以在 Promise 完成后安全移除槽位或创建下一后台候选。
     * 失败路径: 第三方 destroy 异常继续由 releasePlayer 吸收，所有者仍得到已收敛 Promise。
     *
     * @returns {Promise<void>} 当前组件媒体资源完成释放后兑现。
     */
    async disposePlayer() {
      // 生命周期副作用: 先提升代次，释放期间到达的旧播放器事件不能重新发布会话。
      this._mediaSessionGeneration = Number(this._mediaSessionGeneration || 0) + 1;
      await this.releasePlayer();
    },

    /**
     * 释放当前 xgplayer 实例。
     * 副作用: 发布当前资源最后严格快照，调用 player.destroy，释放媒体元素、HLS、快捷键插件和全部监听，并清空 host DOM。
     * 成功路径: 优先采用播放器最新指标；实例尚未创建时仍交接最后已发布会话；没有任何稳定会话时幂等清理。
     * 失败路径: 最终指标无效时回退最后稳定快照；destroy 异常被吸收但仍清空引用和 DOM。
     *
     * @returns {Promise<void>} 资源释放收敛后结束。
     */
    async releasePlayer() {
      // 类型: object|null；作用: 捕获待销毁实例后立即切断组件权威引用，避免并发初始化重复使用旧播放器。
      const player = this._mediaPlayerInstance || null;
      this._mediaPlayerInstance = null;
      // 类型: Readonly<object>|null；作用: 默认使用最后已发布严格会话，覆盖依赖加载中、初始化失败和无实例释放路径。
      let finalSession = this._lastPublishedMediaSession || null;
      // 条件分支: 当前存在待释放播放器时进入；执行内容: 在 destroy 前尝试用最新真实指标更新最终快照。
      if (player) {
        try {
          // 状态采用: 错误阶段沿用最后稳定错误字段，正常阶段字段为空；避免最终快照因错误组合失去严格契约。
          finalSession = this.createMediaPlaybackSession(
            this.currentPhase,
            player,
            finalSession?.errorCode || '',
            finalSession?.errorMessage || ''
          );
        } catch {
          // 失败补偿: 保留最后已发布严格快照，不发布由无效第三方指标拼成的半完整对象。
        }
      }
      // 条件分支: 当前资源曾发布至少一条严格会话时进入；执行内容: 无论播放器是否完整创建都向页面完成一次最终交接。
      if (finalSession) {
        this.$emit('session-finalize', finalSession);
      }
      // 资源清理: 最终交接后释放快照引用，下一媒体资源不能复用旧身份或错误状态。
      this._lastPublishedMediaSession = null;
      // 条件分支: 旧实例提供公开 destroy 方法时进入；执行内容: 等待其释放媒体、插件和事件资源。
      if (player && typeof player.destroy === 'function') {
        try {
          await Promise.resolve(player.destroy());
        } catch {
          // 失败补偿: 第三方销毁异常不能阻止引用和 DOM 清理。
        }
      }
      // 类型: HTMLElement|undefined；作用: 定位稳定挂载点并清除第三方销毁异常可能遗留的 DOM。
      const host = this.$refs.playerHost;
      // 条件分支: 组件挂载点仍存在时进入；执行内容: 清除旧实例节点，为下一代次提供空容器。
      if (host) {
        host.replaceChildren();
      }
    }
  }
};
</script>

<style scoped>
/*
  scoped 边界说明:
  当前样式只约束 XgplayerMediaPlayer 自有根节点、挂载点和状态层。
  xgplayer 第三方内部样式由动态加载的官方 CSS 负责，本组件不使用深度选择器提高覆盖层级。
*/
/*
  作用容器: XgplayerMediaPlayer 根节点。
  样式作用: 填满 PlayerView 稳定舞台，并作为状态覆盖层定位上下文。
*/
.xgplayer-media-player {
  /* 类型: length；作用: 让提示贴近 xgplayer 控制栏进度条上方，不散落绝对偏移。 */
  --media-progress-prompt-control-offset: 54px;
  /* 类型: length；作用: 限制提示与播放器两侧的最小安全距离。 */
  --media-progress-prompt-horizontal-gap: 12px;
  /* 类型: length；作用: 统一提示内容与动作的紧凑间距。 */
  --media-progress-prompt-content-gap: 8px;
  /* 建立状态提示的定位参照，不脱离 PlayerView 分配的播放器舞台。 */
  position: relative;
  /* 填满父级播放器舞台的可用横向空间。 */
  width: 100%;
  /* 填满父级播放器舞台的可用纵向空间。 */
  height: 100%;
  /* 允许组件在 Grid/Flex 容器内收缩，避免第三方内容撑宽页面。 */
  min-width: 0;
  /* 允许组件在受限桌面舞台内收缩，不制造页面纵向滚动。 */
  min-height: 0;
  /* 裁切第三方播放器超出稳定舞台的内容和控制层。 */
  overflow: hidden;
  /* 媒体首帧和海报未就绪时保持深色播放器背景。 */
  background: #05070b;
}

/*
  作用容器: xgplayer 唯一挂载节点。
  样式作用: 为第三方播放器提供稳定满尺寸边界，实例变化不改变页面布局。
*/
.xgplayer-media-player__host {
  /* 让 xgplayer 根节点使用完整播放器舞台宽度。 */
  width: 100%;
  /* 让 xgplayer 根节点使用完整播放器舞台高度。 */
  height: 100%;
  /* 允许第三方挂载点在父级布局中横向收缩。 */
  min-width: 0;
  /* 允许第三方挂载点在父级布局中纵向收缩。 */
  min-height: 0;
}

/*
  作用容器: 播放器进度锚定提示。
  样式作用: 在控制栏进度条上方按纯模型百分比定位半透明提示，不占页面布局高度。
*/
.xgplayer-media-player__progress-prompt {
  /* 相对播放器舞台绝对定位，提示出现和消失不改变画面或控制栏尺寸。 */
  position: absolute;
  /* 使用纯模型已夹取的播放百分比作为水平锚点。 */
  left: var(--media-progress-prompt-position);
  /* 使用根节点集中令牌贴近控制区进度条上方。 */
  bottom: var(--media-progress-prompt-control-offset);
  /* 以提示自身中心对齐进度锚点，安全夹取保证两侧仍可读。 */
  transform: translateX(-50%);
  /* 位于视频画面和第三方控制区之上，但不扩张到全局模态层。 */
  z-index: 4;
  /* 内容短时保持自然宽度，长错误在播放器安全范围内换行。 */
  width: max-content;
  /* 两侧始终保留统一安全间距，窄播放器不会溢出。 */
  max-width: calc(100% - (var(--media-progress-prompt-horizontal-gap) * 2));
  /* 文案和多个动作按内容自然排列，窄屏允许换行。 */
  display: flex;
  /* 不同文案高度下保持同行垂直居中。 */
  align-items: center;
  /* 近尾双动作在受限宽度内可以换到下一行。 */
  flex-wrap: wrap;
  /* 使用集中内容间距避免文案和动作粘连。 */
  gap: var(--media-progress-prompt-content-gap);
  /* 提供紧凑可读留白，不遮挡过多画面。 */
  padding: 8px 10px;
  /* 轻边界在复杂画面上勾勒提示轮廓。 */
  border: 1px solid rgba(148, 163, 184, .42);
  /* 与项目现有组件一致使用小圆角。 */
  border-radius: 6px;
  /* 半透明深色让画面仍可感知，同时保证浅色文字对比。 */
  background: rgba(15, 23, 42, .82);
  /* 普通提示使用中性浅色，不把加载或恢复误报为错误。 */
  color: #f8fafc;
  /* 使用播放器辅助信息字号，保持提示紧凑。 */
  font-size: 13px;
  /* 多行错误保持稳定阅读节奏。 */
  line-height: 1.45;
  /* 提示外壳不截获画面点击，只有内部动作按钮恢复交互。 */
  pointer-events: none;
  /* 轻阴影把提示从动态画面中分离，不引入装饰性发光。 */
  box-shadow: 0 4px 14px rgba(0, 0, 0, .26);
}

/* 使用小三角把提示与当前进度位置建立明确视觉连接。 */
.xgplayer-media-player__progress-prompt::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 10px;
  height: 10px;
  background: inherit;
  border-right: 1px solid rgba(148, 163, 184, .42);
  border-bottom: 1px solid rgba(148, 163, 184, .42);
  transform: translateX(-50%) rotate(45deg);
}

/* 终态错误使用克制红色边界与背景，仍保留同一进度锚定布局。 */
.xgplayer-media-player__progress-prompt.is-terminal {
  border-color: rgba(248, 113, 113, .58);
  background: rgba(69, 10, 10, .84);
  color: #fee2e2;
}

/* 终态锚点沿用错误边界颜色，保持提示和进度位置连续。 */
.xgplayer-media-player__progress-prompt.is-terminal::after {
  border-color: rgba(248, 113, 113, .58);
}

/* 文案允许在播放器安全宽度内自然换行，不挤压动作到不可点击尺寸。 */
.xgplayer-media-player__progress-message {
  min-width: 0;
  overflow-wrap: anywhere;
}

/*
  作用容器: 进度提示动作。
  样式作用: 为从头、下一集和重试提供统一紧凑命令样式。
*/
.xgplayer-media-player__progress-action {
  /* 只让明确动作恢复鼠标和触控输入。 */
  pointer-events: auto;
  /* 保持与播放器控制按钮接近的紧凑高度。 */
  padding: 4px 7px;
  /* 使用当前文字色的半透明边界，普通与错误提示都能继承。 */
  border: 1px solid currentColor;
  /* 与提示外壳保持一致的小圆角体系。 */
  border-radius: 4px;
  /* 轻透明背景表达次级动作，不覆盖提示主体。 */
  background: rgba(255, 255, 255, .08);
  /* 继承提示语义颜色。 */
  color: inherit;
  /* 继承提示字体，避免按钮默认字体破坏视觉一致性。 */
  font: inherit;
  /* 稳定行高让多个动作高度一致。 */
  line-height: 1.2;
  /* 明确当前元素可点击。 */
  cursor: pointer;
}

/* Hover 只增强背景，不改变边框和尺寸，避免提示跳动。 */
.xgplayer-media-player__progress-action:hover {
  background: rgba(255, 255, 255, .16);
}
</style>
