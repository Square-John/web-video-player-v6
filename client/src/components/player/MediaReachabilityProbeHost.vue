<template>
  <!--
    MediaReachabilityProbeHost 无视觉渲染树

    [IF probeSlot] ele(div.media-reachability-probe-host)
    └─ com(XgplayerMediaPlayer)
       - condition: 当前严格探测目标已经取得并校验直连媒体时渲染。
       - description: 在不进入视觉和交互树的稳定舞台中等待真实 CANPLAY 或稳定失败事件。
       - params: -- probeSlot.id；-- probeSlot.media；-- probeSlot.sessionContext；-- shortcutPreferences。
       - events: @session-event -> handleProbeSessionEvent；@session-finalize 不进入历史或页面状态。
  -->
  <div v-if="probeSlot" class="media-reachability-probe-host" aria-hidden="true">
    <XgplayerMediaPlayer
      ref="probePlayer"
      :slot-id="probeSlot.id"
      :source="probeSlot.media"
      :session-context="probeSlot.sessionContext"
      :active="false"
      :autoplay="false"
      :start-time="0"
      :poster="probeSlot.poster"
      :shortcut-preferences="shortcutPreferences"
      @session-event="handleProbeSessionEvent"
    />
  </div>
</template>

<script>
/*
  MediaReachabilityProbeHost.vue 模块说明

  - 文件职责:
      提供详情页和其他通用宿主可调用的无视觉真实媒体探测端口。
      通过标准 player 候选请求和 Xgplayer/HLS 会话事件返回 available/unavailable/inconclusive，并在结果兑现前释放唯一实例。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      XgplayerMediaPlayer: 自定义播放器组件，拥有唯一第三方播放器和可等待释放端口。
      requestSourceDataCandidate: 自定义数据服务，不采用 Store 地请求显式 player 候选。
      createPlayerRequestParams、normalizePlaybackCandidate、resolvePlaybackEpisodeIndex: 自定义候选纯函数。
      MEDIA_PLAYBACK_ERROR_CODE、MEDIA_PLAYBACK_PHASE、MEDIA_PLAYBACK_REQUEST_PURPOSE: 自定义媒体配置，分类稳定事件和标准请求意图。
      MEDIA_REACHABILITY_PROBE_RESULT: 自定义可达服务内部三类结果。
      shortcutSettingsStore: 自定义响应式设置 Store，为非活动播放器满足必填快捷键契约。

  - 模块级常量:
      PROBE_AVAILABLE_PHASES: ReadonlyArray<string>，能够证明真实媒体已 CANPLAY 的稳定阶段。
      PROBE_FAILURE_PHASES: ReadonlyArray<string>，结束当前探测但需要继续区分媒体失败与基础设施失败的阶段。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      MediaReachabilityProbeHost: default Vue component options，公开 probe(target, context) 和 cancel(reason) 所有者端口。
*/

// 导入来源: ./XgplayerMediaPlayer.vue。
// 导入内容: XgplayerMediaPlayer 真实播放器适配组件。
// 文件作用: 探测与正式播放使用相同媒体依赖、HLS 插件和稳定事件证据。
import XgplayerMediaPlayer from './XgplayerMediaPlayer.vue';

// 导入来源: ../../services/sourceDataService.js。
// 导入内容: requestSourceDataCandidate 不采用页面 Store 的显式候选请求。
// 文件作用: 探测仍经过 Runtime、Host、Provider 和响应身份门禁，不创建页面事务。
import { requestSourceDataCandidate } from '../../services/sourceDataService.js';

// 导入来源: ../../services/mediaPlaybackCandidateService.js。
// 导入内容: 标准 player 请求参数、逻辑剧集序号和严格候选身份校验纯函数。
// 文件作用: 详情探测与正式播放共享同一内容、线路、剧集和媒体采用边界。
import {
  createPlayerRequestParams,
  normalizePlaybackCandidate,
  resolvePlaybackEpisodeIndex
} from '../../services/mediaPlaybackCandidateService.js';

// 导入来源: ../../config/mediaPlayback.config.js。
// 导入内容: MEDIA_PLAYBACK_ERROR_CODE、MEDIA_PLAYBACK_PHASE 稳定媒体事件契约。
// 文件作用: 只有可归属媒体错误写 unavailable，依赖和初始化失败保持 inconclusive。
import {
  MEDIA_PLAYBACK_ERROR_CODE,
  MEDIA_PLAYBACK_PHASE,
  MEDIA_PLAYBACK_REQUEST_PURPOSE
} from '../../config/mediaPlayback.config.js';

// 导入来源: ../../services/mediaReachabilityService.js。
// 导入内容: MEDIA_REACHABILITY_PROBE_RESULT 内部三类结果。
// 文件作用: 组件只向协调器返回可达、不可达或不可判定，不直接修改页面状态。
import { MEDIA_REACHABILITY_PROBE_RESULT } from '../../services/mediaReachabilityService.js';

// 导入来源: ../../store/shortcutSettingsStore.js。
// 导入内容: shortcutSettingsStore 已提交快捷键偏好投影。
// 文件作用: XgplayerMediaPlayer 的必填契约保持统一；active=false 确保探测实例不注册或消费页面命令。
import { shortcutSettingsStore } from '../../store/shortcutSettingsStore.js';

// 类型: ReadonlyArray<string>。
// 作用: CANPLAY 之后可能出现的稳定阶段都继续证明当前精确媒体可达。
const PROBE_AVAILABLE_PHASES = Object.freeze([
  MEDIA_PLAYBACK_PHASE.ready,
  MEDIA_PLAYBACK_PHASE.playing,
  MEDIA_PLAYBACK_PHASE.paused,
  MEDIA_PLAYBACK_PHASE.buffering,
  MEDIA_PLAYBACK_PHASE.autoplayBlocked,
  MEDIA_PLAYBACK_PHASE.ended
]);

// 类型: ReadonlyArray<string>。
// 作用: unsupported/error 结束当前目标；只有 error + MEDIA_PLAYBACK_FAILED 能形成红色证据。
const PROBE_FAILURE_PHASES = Object.freeze([
  MEDIA_PLAYBACK_PHASE.unsupported,
  MEDIA_PLAYBACK_PHASE.error
]);

// 导出类型: default Vue component options。
// 导出内容: 无视觉媒体探测资源宿主。
// 外部调用方: DetailView 通过 ref 把 probe/cancel 注入通用媒体可达协调器。
// 使用场景: 页面需要验证标准 Provider 媒体但不能采用路由、Store、历史或活动播放器时。
export default {
  // 类型: string；作用: 提供稳定组件名，供 Vue Devtools、ref 和测试定位。
  name: 'MediaReachabilityProbeHost',

  // 类型: object；作用: 注册唯一真实播放器适配组件。
  components: { XgplayerMediaPlayer },

  /**
   * 创建探测宿主局部状态。
   * 纯函数: 每个实例返回隔离槽位，不请求 Provider、不创建第三方播放器。
   *
   * @returns {object} 当前唯一 probeSlot。
   */
  data() {
    return {
      // 类型: object|null；作用: 保存当前唯一已校验探测媒体和稳定会话身份；null 时不渲染播放器。
      probeSlot: null
    };
  },

  // 类型: object；作用: 向子播放器传入唯一已提交快捷键偏好；探测实例 active=false 不消费命令。
  computed: {
    /**
     * 读取已提交快捷键偏好。
     * 纯函数: 只返回共享 Store 响应式引用，不建立组件默认副本。
     *
     * @returns {object} ShortcutPreferences。
     */
    shortcutPreferences() {
      return shortcutSettingsStore.preferences;
    }
  },

  /**
   * 组件创建时建立非响应式任务所有权。
   * 副作用: 初始化代次、序号、当前 Promise 控制器和释放屏障，不创建媒体资源。
   *
   * @returns {void} 私有运行态已初始化。
   */
  created() {
    // 类型: number；生命周期: 当前组件；作用: probe/cancel 单调递增，拒绝迟到 Provider 和播放器事件。
    this._probeGeneration = 0;
    // 类型: number；生命周期: 当前组件；作用: 为每次挂载生成稳定且不复用的 Xgplayer slotId。
    this._probeSlotSequence = 0;
    // 类型: object|null；生命周期: 当前目标；作用: 保存 Promise resolve 和 slotId，媒体事件只能完成同一任务。
    this._pendingProbeTask = null;
    // 类型: Promise<void>|null；生命周期: 当前槽位；作用: 多个取消调用复用同一真实 disposePlayer 屏障。
    this._probeReleaseOperation = null;
  },

  /**
   * 组件销毁前取消当前目标并释放播放器。
   * 副作用: 使迟到事件失效并调用唯一子组件 disposePlayer；销毁钩子不等待 Promise。
   *
   * @returns {void} 释放操作在后台完成。
   */
  beforeDestroy() {
    this.cancel('媒体探测宿主已经销毁');
  },

  // 类型: object；作用: 提供严格候选请求、播放器事件采用和可等待释放端口。
  methods: {
    /**
     * 探测一个精确媒体目标。
     * 副作用: 请求 Provider、挂载一个非活动 Xgplayer/HLS 实例，并在终态后等待完整释放。
     * 成功路径: 真实 CANPLAY 返回 available；可归属媒体错误返回 unavailable。
     * 失败路径: Provider、契约、取消、依赖和初始化失败返回 inconclusive；不抛出站点或媒体私有错误。
     *
     * @param {object} target 四段身份完整的媒体可达目标。
     * @param {object} probeContext 协调器当前代次检查端口。
     * @param {Function} probeContext.isCurrent 判断队列是否仍允许创建和采用资源。
     * @returns {Promise<string>} MEDIA_REACHABILITY_PROBE_RESULT 三类之一。
     */
    async probe(target, probeContext) {
      // 资源边界: 新目标先等待旧实例释放，单个宿主在任何时刻最多拥有一个播放器。
      await this.cancel('新的媒体探测目标已经开始');
      // 类型: number；作用: 捕获本次组件内部代次，取消或后续目标会让它失效。
      const generation = Number(this._probeGeneration || 0) + 1;
      this._probeGeneration = generation;
      // 条件分支: 协调器已经取消本轮时进入；执行内容: 不发起 Provider 请求。
      if (!probeContext?.isCurrent?.()) return MEDIA_REACHABILITY_PROBE_RESULT.inconclusive;

      try {
        // 类型: object；作用: 复用正式播放请求字段，探测不增加 Provider 专属协议。
        const params = createPlayerRequestParams({
          contentId: target.contentId,
          autoplay: false,
          episodeId: target.episodeId,
          episodeIndex: target.episodeIndex,
          playbackSourceId: target.lineId,
          requestPurpose: MEDIA_PLAYBACK_REQUEST_PURPOSE.probe
        });
        // 类型: object；作用: 保存共享 Runtime 返回且不采用页面 Store 的显式 player 候选响应。
        // 异步调用: 通过共享 Runtime、Host 和 Provider 请求当前精确目标。
        const response = await requestSourceDataCandidate({
          sourceId: target.sourceId,
          pageKey: 'player',
          params
        });
        // 条件分支: Provider 返回期间组件或协调器代次已经失效时进入；执行内容: 丢弃响应且不挂载播放器。
        if (generation !== this._probeGeneration || !probeContext.isCurrent()) {
          return MEDIA_REACHABILITY_PROBE_RESULT.inconclusive;
        }
        // 类型: Readonly<object>；作用: 与正式播放使用同一严格内容、目录、线路、剧集和媒体校验。
        const candidate = normalizePlaybackCandidate(response, target);
        return await this.mountProbeCandidate(candidate, generation, probeContext);
      } catch {
        // 失败边界: Provider、Runtime 和候选契约失败不能证明媒体不可达，只返回不可判定。
        return MEDIA_REACHABILITY_PROBE_RESULT.inconclusive;
      }
    },

    /**
     * 挂载一个已校验候选并等待稳定媒体证据。
     * 副作用: 创建唯一 probeSlot，下一次 DOM 更新后 XgplayerMediaPlayer 开始加载媒体。
     * 成功路径: 任务由 handleProbeSessionEvent 完成，结果兑现前已等待 disposePlayer。
     * 失败路径: 代次失效时不挂载；Vue 挂载失败收敛为 inconclusive 并释放可能存在的槽位。
     *
     * @param {Readonly<object>} candidate 已校验播放候选。
     * @param {number} generation 当前组件内部代次。
     * @param {object} probeContext 协调器代次检查端口。
     * @returns {Promise<string>} 当前真实媒体探测结果。
     */
    async mountProbeCandidate(candidate, generation, probeContext) {
      // 条件分支: 当前目标在挂载前已经取消时进入；执行内容: 保持无资源状态。
      if (generation !== this._probeGeneration || !probeContext?.isCurrent?.()) {
        return MEDIA_REACHABILITY_PROBE_RESULT.inconclusive;
      }
      // 类型: number；作用: 单调生成不复用的 Vue key 和播放器资源身份。
      this._probeSlotSequence = Number(this._probeSlotSequence || 0) + 1;
      // 类型: string；作用: 当前任务和 XgplayerMediaPlayer 共享稳定槽位身份。
      const slotId = `reachability-probe-${this._probeSlotSequence}`;
      // 状态采用: 只保存标准媒体和四段会话身份，不保存 Provider 响应或媒体请求细节。
      this.probeSlot = {
        id: slotId,
        media: candidate.media,
        sessionContext: {
          sourceId: candidate.contentItem.sourceId,
          contentId: candidate.contentItem.id,
          episodeId: candidate.episode.id,
          episodeIndex: resolvePlaybackEpisodeIndex(candidate.episode),
          playbackSourceId: candidate.line.id
        },
        poster: candidate.contentItem.cover || candidate.contentItem.poster || ''
      };

      // 返回值类型: Promise<string>；作用: 由稳定播放器事件、取消或销毁唯一完成当前目标。
      return new Promise((resolve) => {
        this._pendingProbeTask = { generation, slotId, resolve };
      });
    },

    /**
     * 处理真实播放器稳定会话事件。
     * 副作用: 只完成与当前 slotId 和代次一致的任务，并在结果兑现前释放媒体资源。
     * 成功路径: CANPLAY 后阶段返回 available；可归属媒体错误返回 unavailable。
     * 失败路径: unsupported、依赖或初始化错误返回 inconclusive；中间 loading/idle 不结束任务。
     *
     * @param {object} session XgplayerMediaPlayer 发布的稳定 MediaPlaybackSessionState。
     * @returns {void} 结果通过当前 probe Promise 返回协调器。
     */
    handleProbeSessionEvent(session) {
      // 类型: object|null；作用: 捕获当前唯一任务；没有任务时拒绝迟到播放器事件。
      const task = this._pendingProbeTask;
      // 条件分支: 没有任务、组件代次失效或事件不属于当前槽位时进入；执行内容: 拒绝迟到事件。
      if (!task || task.generation !== this._probeGeneration || task.slotId !== this.probeSlot?.id) return;
      // 条件分支: 真实 CANPLAY 后的稳定阶段进入；执行内容: 以 available 完成任务。
      if (PROBE_AVAILABLE_PHASES.includes(session?.phase)) {
        this.settleProbeTask(task, MEDIA_REACHABILITY_PROBE_RESULT.available);
        return;
      }
      // 条件分支: 当前阶段仍是加载或其他非终态时进入；执行内容: 继续等待真实证据。
      if (!PROBE_FAILURE_PHASES.includes(session?.phase)) return;
      // 类型: string；作用: 只有播放器明确报告当前精确媒体加载失败时形成 unavailable，其他终态保持不可判定。
      const result = session?.phase === MEDIA_PLAYBACK_PHASE.error
        && session?.errorCode === MEDIA_PLAYBACK_ERROR_CODE.mediaPlaybackFailed
        ? MEDIA_REACHABILITY_PROBE_RESULT.unavailable
        : MEDIA_REACHABILITY_PROBE_RESULT.inconclusive;
      this.settleProbeTask(task, result);
    },

    /**
     * 完成当前探测任务。
     * 副作用: 原子移除任务所有权，等待同一槽位 disposePlayer，再兑现调用方 Promise。
     * 失败路径: 任务已经被取消或替换时幂等返回，迟到事件不能完成新目标。
     *
     * @param {object} task 当前任务控制器。
     * @param {string} result MEDIA_REACHABILITY_PROBE_RESULT。
     * @returns {void} 释放与 Promise 完成在内部异步链执行。
     */
    settleProbeTask(task, result) {
      // 条件分支: 当前任务已经被取消或替换时进入；执行内容: 不触碰新任务或新槽位。
      if (this._pendingProbeTask !== task) return;
      this._pendingProbeTask = null;
      // 资源顺序: 协调器只有在真实播放器释放完成后才能收到结果并开始下一目标。
      this.releaseProbeSlot(task.slotId).then(
        () => task.resolve(result),
        () => task.resolve(MEDIA_REACHABILITY_PROBE_RESULT.inconclusive)
      );
    },

    /**
     * 取消当前探测并等待唯一媒体资源释放。
     * 副作用: 提升组件代次、让 Provider 迟到响应失效、以 inconclusive 完成当前任务并释放槽位。
     * 成功路径: 无槽位时立即完成；重复调用复用同一释放 Promise。
     * 失败路径: 子播放器释放失败时向协调器传播，下一目标不会越过未确认的资源释放边界。
     *
     * @param {string} reason 安全取消原因，仅用于调用语义，不写页面或日志。
     * @returns {Promise<void>} 当前子播放器完成释放后兑现。
     */
    async cancel(reason = '媒体探测已经取消') {
      // 语义使用: 保留命名参数表达调用原因；取消不向用户、Provider 或日志暴露该文本。
      void reason;
      this._probeGeneration = Number(this._probeGeneration || 0) + 1;
      // 类型: object|null；作用: 隔离旧任务控制器，后续媒体事件不能再次完成它。
      const task = this._pendingProbeTask;
      this._pendingProbeTask = null;
      // 类型: string；作用: 捕获释放目标，响应式槽位可能在等待期间被清空。
      const slotId = this.probeSlot?.id || task?.slotId || '';
      await this.releaseProbeSlot(slotId);
      // 条件分支: 取消前存在等待任务时进入；执行内容: 以不可判定完成，协调器只撤销 checking。
      if (task) task.resolve(MEDIA_REACHABILITY_PROBE_RESULT.inconclusive);
    },

    /**
     * 释放当前探测槽位。
     * 副作用: 调用 XgplayerMediaPlayer.disposePlayer，等待第三方播放器、HLS 和监听器释放后清空 DOM。
     * 成功路径: 重复调用复用同一 Promise；没有匹配槽位时幂等完成。
     * 失败路径: 子组件端口抛错时仍清空本槽位并向调用方传播，让结果降级为 inconclusive。
     *
     * @param {string} slotId 要释放的稳定槽位身份。
     * @returns {Promise<void>} 媒体所有者完成释放和 DOM 清理后兑现。
     */
    releaseProbeSlot(slotId) {
      // 条件分支: 已有释放操作时进入；执行内容: 复用屏障，禁止同一实例并发 dispose。
      if (this._probeReleaseOperation) return this._probeReleaseOperation;
      // 条件分支: 没有槽位或身份不匹配时进入；执行内容: 保持当前可能属于新任务的槽位。
      if (!slotId || this.probeSlot?.id !== slotId) return Promise.resolve();

      // 类型: Promise<void>；作用: 把子组件释放、响应式清理和 DOM 更新串成一个资源屏障。
      const releaseOperation = Promise.resolve().then(async () => {
        // 类型: object|null；作用: ref 只在当前槽位完成挂载后存在；未挂载时无需调用释放端口。
        const player = this.$refs.probePlayer || null;
        // 条件分支: 子组件已经挂载并公开可等待释放端口时进入；执行内容: 等待播放器和 HLS 资源销毁。
        if (typeof player?.disposePlayer === 'function') await player.disposePlayer();
        // 条件分支: 等待释放期间槽位仍是同一目标时进入；执行内容: 清空组件并等待 Vue 移除媒体 DOM。
        if (this.probeSlot?.id === slotId) {
          this.probeSlot = null;
          await this.$nextTick();
        }
      });
      this._probeReleaseOperation = releaseOperation;
      return releaseOperation.finally(() => {
        // 条件分支: 当前登记仍属于本次释放时进入；执行内容: 恢复空屏障供下一目标使用。
        if (this._probeReleaseOperation === releaseOperation) this._probeReleaseOperation = null;
      });
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 无视觉媒体探测宿主。
  样式作用:
  保留稳定的播放器布局尺寸和真实媒体生命周期，同时完全退出视觉、指针和可访问交互。
*/
.media-reachability-probe-host {
  position: absolute;
  width: 320px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

/* 唯一子播放器始终填满稳定探测舞台，避免第三方 fluid 初始化获得零尺寸。 */
.media-reachability-probe-host > * {
  width: 100%;
  height: 100%;
}
</style>
