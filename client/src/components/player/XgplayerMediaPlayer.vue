<template>
  <!--
    [DEFAULT] ele(xgplayerMediaPlayer)
    ├─ [DEFAULT] ele(playerHost)
    │  - condition: 组件存活期间始终渲染。
    │  - type: 原生 div，xgplayer 唯一 DOM 挂载点。
    │  - description: 提供稳定播放器舞台，第三方实例创建和销毁不改变页面布局。
    │  - params: ref=playerHost 供组件生命周期访问；无页面数据字段直接渲染。
    │  - events: 媒体事件转换为 session-event；实例释放前最后快照转换为 session-finalize。
    └─ [IF statusMessage] ele(playerStatus)
       - condition: 自动播放受限或出现稳定媒体失败说明时渲染。
       - type: 原生 div。
       - description: 展示项目安全状态，不暴露第三方异常对象或完整媒体 URL。
       - params: statusMessage 提供文案；hasTerminalError 决定 alert/status 语义和错误样式。
       - events: 无，提示层不接受交互并保留播放器中央操作入口。
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
      [IF statusMessage] ele(playerStatus)
      - condition: 组件存在自动播放提示或终态错误文案时渲染。
      - type: 原生 div。
      - description: 在播放器顶部展示不遮挡主操作的稳定状态。
      - params: statusMessage 为安全文案；hasTerminalError 控制 is-error class 和 ARIA role。
      - events: 无。
    -->
    <div
      v-if="statusMessage"
      class="xgplayer-media-player__status"
      :class="{ 'is-error': hasTerminalError }"
      :role="hasTerminalError ? 'alert' : 'status'">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script>
/*
  XgplayerMediaPlayer.vue 模块说明

  - 文件职责:
      动态加载 xgplayer、xgplayer-hls 和样式，创建一个媒体实例并把第三方事件转换为稳定媒体会话。
      组件只拥有播放器生命周期和 DOM 资源，不写用户历史、Router、Provider 或 Repository。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      MEDIA_PLAYBACK_ERROR_CODE、MEDIA_PLAYBACK_PHASE、MEDIA_TYPE: 自定义配置，提供稳定状态和媒体类型。
      createDefaultPlaybackShortcutPreferences: 自定义 service，提供项目默认快捷键偏好。
      createProjectShortcutPlugin: 自定义工厂，结合动态 BasePlugin 创建项目快捷键插件。
      normalizeMediaPlaybackSession、normalizeMediaPlaybackSource: 自定义校验器，严格采用线路和会话。

  - 模块级常量:
      PLAYER_LANGUAGE: string，xgplayer 中文界面语言。
      PLAYER_FIT_MODE: string，播放器固定容器适配策略。

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
  // 导入来源: ../../config/mediaPlayback.config.js；导入内容: MEDIA_TYPE；文件作用: 决定是否注册官方 HLS 插件。
  MEDIA_TYPE
} from '../../config/mediaPlayback.config.js';

// 导入来源: ../../services/playbackShortcutService.js。
// 导入内容: createDefaultPlaybackShortcutPreferences；文件作用: 父级未提供设置时采用项目默认键位。
import { createDefaultPlaybackShortcutPreferences } from '../../services/playbackShortcutService.js';

// 导入来源: ../../plugins/projectShortcutPlugin.js。
// 导入内容: createProjectShortcutPlugin；文件作用: 动态 BasePlugin 加载后创建项目快捷键插件类。
import { createProjectShortcutPlugin } from '../../plugins/projectShortcutPlugin.js';

import {
  // 导入来源: ../../utils/mediaPlaybackValidators.js；导入内容: normalizeMediaPlaybackSession；文件作用: 发布前严格校验会话。
  normalizeMediaPlaybackSession,
  // 导入来源: ../../utils/mediaPlaybackValidators.js；导入内容: normalizeMediaPlaybackSource；文件作用: 创建实例前严格校验直连线路。
  normalizeMediaPlaybackSource
} from '../../utils/mediaPlaybackValidators.js';

// 类型: string。
// 作用: xgplayer 控件使用简体中文，不从浏览器环境生成不稳定语言分支。
const PLAYER_LANGUAGE = 'zh-cn';

// 类型: string。
// 作用: 视频保持在组件稳定容器内按 contain 方式展示，不裁切媒体画面。
const PLAYER_FIT_MODE = 'fixed';

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
    // 类型: object。
    // 来源: PlayerView.activePlaybackSource。
    // 作用: 提供经过 Provider 清洗的直连媒体线路；变化时销毁旧实例并创建新会话。
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

    // 类型: object|null。
    // 来源: 项目快捷键设置 service；当前 null 使用集中默认偏好。
    // 作用: 只决定项目命令键位，不让 xgplayer 保存设置。
    shortcutPreferences: {
      type: Object,
      default: null
    }
  },

  /**
   * 创建组件局部展示状态。
   * 副作用: 每个组件实例创建独立响应式状态，但不创建播放器、DOM 监听或持久化写入。
   *
   * @returns {object} 状态文案、终态标识和当前稳定媒体阶段。
   */
  data() {
    return {
      // 类型: string。
      // 作用: 显示自动播放受限或终态错误；普通播放阶段为空。
      statusMessage: '',

      // 类型: boolean。
      // true: 状态覆盖层使用 alert 语义并阻止把错误当普通提示。
      // false: 状态覆盖层使用 status 语义或隐藏。
      hasTerminalError: false,

      // 类型: string。
      // 作用: 保存最近发布阶段，TIME_UPDATE 继续沿用当前阶段而不伪造 playing。
      currentPhase: MEDIA_PLAYBACK_PHASE.idle
    };
  },

  computed: {
    /**
     * 当前媒体资源身份。
     * 纯函数: 只读取线路字段；URL 或线路 id 变化时触发实例替换。
     *
     * @returns {string} 用于 watcher 比较的资源身份。
     */
    sourceIdentity() {
      return `${this.source?.id || ''}::${this.source?.url || ''}`;
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
   * @returns {void} 资源清理 Promise 由 releasePlayer 自身收敛。
   */
  beforeDestroy() {
    // 生命周期副作用: 先使会话代次失效，再释放播放器和插件监听，旧异步结果不能重新采用。
    this._mediaSessionGeneration = Number(this._mediaSessionGeneration || 0) + 1;
    this.releasePlayer();
  },

  methods: {
    /**
     * 初始化当前线路播放器。
     * 副作用: 校验线路、动态加载依赖、创建 xgplayer、绑定事件并更新状态覆盖层。
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

      // 类型: object|undefined；作用: 保存严格校验后的隔离直连线路，校验失败时不创建播放器。
      let normalizedSource;
      try {
        normalizedSource = normalizeMediaPlaybackSource(this.source);
      } catch (error) {
        // 条件分支: 校验失败仍属于当前代次时进入；执行内容: 发布稳定 unsupported，旧代次失败不覆盖新线路。
        if (generation === this._mediaSessionGeneration) {
          this.publishFailure(
            MEDIA_PLAYBACK_PHASE.unsupported,
            error?.code || MEDIA_PLAYBACK_ERROR_CODE.invalidSource,
            error?.message || '当前播放线路不受支持'
          );
        }
        return;
      }

      // 条件分支: Provider 明确标记当前线路不可用时进入；执行内容: 发布 unsupported 会话且不加载第三方实例。
      if (!normalizedSource.available) {
        this.publishFailure(
          MEDIA_PLAYBACK_PHASE.unsupported,
          MEDIA_PLAYBACK_ERROR_CODE.unavailableSource,
          normalizedSource.unavailableReason
        );
        return;
      }

      this.statusMessage = '';
      this.hasTerminalError = false;
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
          autoplay: this.autoplay,
          startTime: Number.isFinite(this.startTime) && this.startTime > 0 ? this.startTime : 0,
          lang: PLAYER_LANGUAGE,
          fluid: true,
          fitVideoSize: PLAYER_FIT_MODE,
          videoFillMode: 'contain',
          playsinline: true,
          keyShortcut: false,
          plugins,
          projectShortcut: {
            preferences: this.shortcutPreferences || createDefaultPlaybackShortcutPreferences(),
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
      player.on(events.READY, createPhasePublisher(MEDIA_PLAYBACK_PHASE.ready));
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
          this.statusMessage = '浏览器已阻止自动播放，请点击播放器开始';
          this.hasTerminalError = false;
          this.publishSession(MEDIA_PLAYBACK_PHASE.autoplayBlocked, player);
        }
      });
      /**
       * 统一处理 xgplayer 媒体和线路错误。
       * 副作用: 当前代次内发布安全错误说明，不泄漏原始事件或媒体 URL。
       *
       * @returns {void} 旧代次错误直接丢弃。
       */
      function publishMediaError() {
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
        // 条件分支: 当前阶段不是需要保留提示的受限或失败状态时进入；执行内容: 清空旧提示，避免成功状态继续显示历史错误。
        if (![MEDIA_PLAYBACK_PHASE.autoplayBlocked, MEDIA_PLAYBACK_PHASE.error, MEDIA_PLAYBACK_PHASE.unsupported].includes(session.phase)) {
          this.statusMessage = '';
          this.hasTerminalError = false;
        }
        // 状态所有权: 保存已通过严格校验的最后快照，确保加载中切换或第三方最终指标读取失败时仍能完成生命周期交接。
        this._lastPublishedMediaSession = session;
        this.$emit('session-event', session);
      } catch {
        this.currentPhase = MEDIA_PLAYBACK_PHASE.error;
        this.statusMessage = '播放器状态无效，请刷新后重试';
        this.hasTerminalError = true;
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
        playbackSourceId: this.source?.id || '',
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
      this.statusMessage = errorMessage;
      this.hasTerminalError = true;
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
      this.$emit('shortcut-command', action);
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
  作用容器: 自动播放受限与稳定错误说明。
  样式作用: 在播放器底部显示简短状态，不遮挡中央播放操作和控制栏。
*/
.xgplayer-media-player__status {
  /* 相对组件根节点覆盖显示，不占用播放器布局高度。 */
  position: absolute;
  /* 与播放器左边缘保留统一安全距离。 */
  left: 16px;
  /* 与播放器右边缘保留统一安全距离并允许长文本换行。 */
  right: 16px;
  /* 避开中央播放按钮，在舞台顶部显示状态。 */
  top: 16px;
  /* 位于视频画面上方但低于第三方全屏系统层，只覆盖当前组件。 */
  z-index: 4;
  /* 为状态文字提供稳定点击无关的可读留白。 */
  padding: 10px 12px;
  /* 使用蓝色边界表达可恢复提示，与终态错误形成差异。 */
  border: 1px solid rgba(96, 165, 250, .45);
  /* 使用高不透明深色背景保证视频画面变化时文字仍可读。 */
  background: rgba(15, 23, 42, .92);
  /* 使用浅蓝文字对应普通状态提示语义。 */
  color: #dbeafe;
  /* 使用紧凑辅助字号，避免状态层遮挡媒体主体。 */
  font-size: 13px;
  /* 保留多行错误和自动播放说明的阅读间距。 */
  line-height: 1.5;
  /* 让鼠标和触控继续作用于下方播放器控件。 */
  pointer-events: none;
}

/*
  作用容器: 终态错误覆盖层。
  样式作用: 使用红色边界区分不可恢复失败，不改变播放器舞台尺寸。
*/
.xgplayer-media-player__status.is-error {
  /* 使用红色边界把不可恢复失败和自动播放提示区分开。 */
  border-color: rgba(248, 113, 113, .55);
  /* 使用深红背景增强错误识别并保持正文对比度。 */
  background: rgba(69, 10, 10, .92);
  /* 使用浅红文字表达终态错误且满足深色背景可读性。 */
  color: #fee2e2;
}
</style>
