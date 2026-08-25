<template>
  <!--
    MediaReachabilityProbeHost 无视觉渲染树

    [ROOT] ele(div.media-reachability-probe-hosts)
    └─ [FOR probeSlot in probeSlots] ele(div.media-reachability-probe-host)
       └─ com(XgplayerMediaPlayer)
          - condition: 当前严格探测目标已经取得并校验直连媒体时渲染。
          - description: 每个槽位独立等待真实 CANPLAY 或稳定失败事件，最多同时渲染集中策略允许的槽位数量。
          - params: -- probeSlot.id；-- probeSlot.media；-- probeSlot.sessionContext；-- shortcutPreferences。
          - events: @session-event -> handleProbeSessionEvent(slotId, session)；@session-finalize 不进入历史或页面状态。
  -->
  <div class="media-reachability-probe-hosts" aria-hidden="true">
    <div
      v-for="probeSlot in probeSlots"
      :key="probeSlot.id"
      class="media-reachability-probe-host"
    >
      <XgplayerMediaPlayer
        ref="probePlayers"
        :slot-id="probeSlot.id"
        :source="probeSlot.media"
        :session-context="probeSlot.sessionContext"
        :active="false"
        :autoplay="false"
        :start-time="0"
        :poster="probeSlot.poster"
        :shortcut-preferences="shortcutPreferences"
        @session-event="handleProbeSessionEvent(probeSlot.id, $event)"
      />
    </div>
  </div>
</template>

<script>
/*
  MediaReachabilityProbeHost.vue 模块说明

  - 文件职责:
      提供详情页和其他通用宿主可调用的无视觉真实媒体探测端口。
      通过标准 player 候选请求和多个独立 Xgplayer/HLS 会话返回 available/unavailable/inconclusive，并在结果兑现前释放对应槽位。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      XgplayerMediaPlayer: 自定义播放器组件，拥有第三方播放器和可等待释放端口。
      requestSourceDataCandidate: 自定义数据服务，不采用 Store 地请求显式 player 候选。
      createPlayerRequestParams、normalizePlaybackCandidate、resolvePlaybackEpisodeIndex: 自定义候选纯函数。
      MEDIA_PLAYBACK_ERROR_CODE、MEDIA_PLAYBACK_PHASE、MEDIA_PLAYBACK_REQUEST_PURPOSE、MEDIA_REACHABILITY_POLICY: 自定义媒体配置，分类稳定事件和统一槽位上限。
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

// 导入来源: ./XgplayerMediaPlayer.vue；导入内容: XgplayerMediaPlayer 真实播放器适配组件；文件作用: 探测和正式播放使用相同媒体依赖、HLS 插件和稳定事件证据。
import XgplayerMediaPlayer from './XgplayerMediaPlayer.vue';
// 导入来源: ../../services/sourceDataService.js；导入内容: requestSourceDataCandidate 不采用页面 Store 的显式候选请求；文件作用: 探测经过 Runtime、Host、Provider 和响应身份门禁。
import { requestSourceDataCandidate } from '../../services/sourceDataService.js';
// 导入来源: ../../services/mediaPlaybackCandidateService.js；导入内容: 标准 player 请求参数、逻辑剧集序号和严格候选身份校验；文件作用: 详情探测与正式播放共享同一采用边界。
import {
  createPlayerRequestParams,
  normalizePlaybackCandidate,
  resolvePlaybackEpisodeIndex
} from '../../services/mediaPlaybackCandidateService.js';
// 导入来源: ../../config/mediaPlayback.config.js；导入内容: 媒体稳定事件、探测请求意图和统一探测槽位上限；文件作用: 组件不重复声明并发值。
import {
  MEDIA_PLAYBACK_ERROR_CODE,
  MEDIA_PLAYBACK_PHASE,
  MEDIA_PLAYBACK_REQUEST_PURPOSE,
  MEDIA_REACHABILITY_POLICY
} from '../../config/mediaPlayback.config.js';
// 导入来源: ../../services/mediaReachabilityService.js；导入内容: MEDIA_REACHABILITY_PROBE_RESULT 内部三类结果；文件作用: 组件只向协调器返回媒体事实。
import { MEDIA_REACHABILITY_PROBE_RESULT } from '../../services/mediaReachabilityService.js';
// 导入来源: ../../store/shortcutSettingsStore.js；导入内容: shortcutSettingsStore 已提交快捷键偏好投影；文件作用: 非活动探测实例满足播放器契约但不消费页面命令。
import { shortcutSettingsStore } from '../../store/shortcutSettingsStore.js';

// 类型: ReadonlyArray<string>；作用: CANPLAY 之后可能出现的稳定阶段都继续证明当前精确媒体可达。
const PROBE_AVAILABLE_PHASES = Object.freeze([
  MEDIA_PLAYBACK_PHASE.ready,
  MEDIA_PLAYBACK_PHASE.playing,
  MEDIA_PLAYBACK_PHASE.paused,
  MEDIA_PLAYBACK_PHASE.buffering,
  MEDIA_PLAYBACK_PHASE.autoplayBlocked,
  MEDIA_PLAYBACK_PHASE.ended
]);
// 类型: ReadonlyArray<string>；作用: unsupported/error 结束当前目标；只有 error + MEDIA_PLAYBACK_FAILED 能形成红色证据。
const PROBE_FAILURE_PHASES = Object.freeze([
  MEDIA_PLAYBACK_PHASE.unsupported,
  MEDIA_PLAYBACK_PHASE.error
]);

export default {
  // 类型: string；作用: 提供稳定组件名，供 Vue Devtools、ref 和测试定位。
  name: 'MediaReachabilityProbeHost',
  // 类型: object；作用: 注册真实播放器适配组件。
  components: { XgplayerMediaPlayer },

  /**
   * 创建探测宿主局部状态。
   * 纯函数: 每个实例返回隔离槽位数组，不请求 Provider、不创建第三方播放器。
   *
   * @returns {object} 当前已校验的 probeSlots。
   */
  data() {
    return {
      // 类型: Array<object>；作用: 保存当前已经取得候选媒体的独立探测槽位；空数组时不渲染播放器。
      probeSlots: []
    };
  },

  // 类型: object；作用: 向每个非活动播放器传入唯一已提交快捷键偏好。
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
   * 副作用: 初始化代次、序号、任务表和释放屏障，不创建媒体资源。
   *
   * @returns {void} 私有运行态已初始化。
   */
  created() {
    // 类型: number；生命周期: 当前组件；作用: cancel 单调递增，拒绝迟到 Provider 和播放器事件。
    this._probeGeneration = 0;
    // 类型: number；生命周期: 当前组件；作用: 为每次挂载生成稳定且不复用的 Xgplayer slotId。
    this._probeSlotSequence = 0;
    // 类型: Map<string, object>；生命周期: 当前组件；作用: 保存等待 Provider 或 CANPLAY 的任务，不保存长期业务状态。
    this._pendingProbeTasks = new Map();
    // 类型: Map<string, Promise<void>>；生命周期: 当前组件；作用: 每个槽位独立复用真实 disposePlayer 屏障。
    this._probeReleaseOperations = new Map();
  },

  /**
   * 组件销毁前取消全部目标并释放播放器。
   * 副作用: 使迟到事件失效并调用子组件 disposePlayer；销毁钩子不等待 Promise。
   *
   * @returns {void} 释放操作在后台完成。
   */
  beforeDestroy() {
    this.cancel('媒体探测宿主已经销毁');
  },

  methods: {
    /**
     * 判断任务是否仍属于当前协调器代次。
     * 纯函数: 只读取任务表、组件代次和调用方上下文。
     *
     * @param {object} task 当前探测任务。
     * @param {object} probeContext 协调器代次端口。
     * @returns {boolean} true 表示允许继续请求或挂载媒体。
     */
    isCurrentTask(task, probeContext) {
      return this._pendingProbeTasks.get(task.slotId) === task
        && task.generation === this._probeGeneration
        && probeContext?.isCurrent?.() === true;
    },

    /**
     * 探测一个精确媒体目标。
     * 副作用: 请求 Provider、按任务挂载一个非活动 Xgplayer/HLS 实例，并在终态后释放对应槽位。
     * 成功路径: 真实 CANPLAY 返回 available；可归属媒体错误返回 unavailable。
     * 失败路径: Provider、契约、取消、依赖和初始化失败返回 inconclusive；不抛出站点或媒体私有错误。
     *
     * @param {object} target 四段身份完整的媒体可达目标。
     * @param {object} probeContext 协调器当前代次检查端口。
     * @returns {Promise<string>} MEDIA_REACHABILITY_PROBE_RESULT 三类之一。
     */
    probe(target, probeContext) {
      // 条件分支: 协调器代次无效或当前探测槽位已达到集中上限时进入；执行内容: 不再创建任务，返回不可判定结果。
      if (probeContext?.isCurrent?.() !== true
        || !Number.isSafeInteger(probeContext.timeoutMs)
        || probeContext.timeoutMs <= 0
        || this._pendingProbeTasks.size >= MEDIA_REACHABILITY_POLICY.maxConcurrentProbes) {
        return Promise.resolve(MEDIA_REACHABILITY_PROBE_RESULT.inconclusive);
      }
      this._probeSlotSequence += 1;
      // 类型: object；作用: 保存当前探测代次、稳定槽位身份和一次性 Promise 完成器。
      const task = {
        generation: this._probeGeneration,
        slotId: 'reachability-probe-' + this._probeSlotSequence,
        timeoutId: null,
        resolve: null,
        settled: false
      };
      // 类型: Promise<string>；作用: 等待当前槽位释放后向协调器兑现探测终态。
      const result = new Promise((resolve) => {
        task.resolve = resolve;
      });
      this._pendingProbeTasks.set(task.slotId, task);
      // 生命周期边界: Provider 或隐藏播放器无响应时主动收敛任务，避免单个 Promise 永久占用并发槽位。
      task.timeoutId = setTimeout(() => {
        // 条件分支: 任务已经被错误、CANPLAY 或取消路径收敛时进入；执行内容: 忽略迟到的超时回调。
        if (!task.settled && this._pendingProbeTasks.get(task.slotId) === task) {
          this.settleProbeTask(task, MEDIA_REACHABILITY_PROBE_RESULT.unavailable);
        }
      }, probeContext.timeoutMs);
      void this.prepareProbeTask(task, target, probeContext);
      return result;
    },

    /**
     * 请求候选并在任务仍有效时挂载媒体。
     * 副作用: 发起标准 player Provider 请求；成功后创建当前任务专属槽位。
     * 成功路径: 候选身份校验通过后进入 mountProbeCandidate，并等待播放器事件。
     * 失败路径: 任意请求、候选或生命周期错误收敛为 inconclusive。
     *
     * @param {object} task 当前任务控制器。
     * @param {object} target 当前精确媒体目标。
     * @param {object} probeContext 协调器代次端口。
     * @returns {Promise<void>} 任务进入等待 CANPLAY 或被收敛后结束。
     */
    async prepareProbeTask(task, target, probeContext) {
      try {
        // 类型: object；作用: 构造标准 player 探测请求，保持 Provider 请求意图统一。
        const params = createPlayerRequestParams({
          contentId: target.contentId,
          autoplay: false,
          episodeId: target.episodeId,
          episodeIndex: target.episodeIndex,
          playbackSourceId: target.lineId,
          requestPurpose: MEDIA_PLAYBACK_REQUEST_PURPOSE.probe,
          probeAttemptNumber: probeContext.attemptNumber
        });
        // 类型: object；作用: 保存 Provider 返回的原始候选响应，随后只交给统一身份校验。
        const response = await requestSourceDataCandidate({
          sourceId: target.sourceId,
          pageKey: 'player',
          params
        });
        // 条件分支: Provider 返回后任务代次已经失效时进入；执行内容: 丢弃迟到响应并结束当前准备链。
        if (!this.isCurrentTask(task, probeContext)) return;
        // 类型: Readonly<object>；作用: 保存通过统一字段和身份校验的媒体候选。
        const candidate = normalizePlaybackCandidate(response, target);
        await this.mountProbeCandidate(task, candidate, probeContext);
      } catch {
        this.settleProbeTask(task, MEDIA_REACHABILITY_PROBE_RESULT.inconclusive);
      }
    },

    /**
     * 挂载一个已校验候选并等待稳定媒体证据。
     * 副作用: 创建当前任务专属 probeSlot；下一次 DOM 更新后 XgplayerMediaPlayer 开始加载媒体。
     * 成功路径: 槽位挂载并保持到稳定播放器事件完成探测。
     * 失败路径: 任务代次失效时不挂载；Vue 挂载失败收敛为 inconclusive 并释放槽位。
     *
     * @param {object} task 当前任务控制器。
     * @param {Readonly<object>} candidate 已校验播放候选。
     * @param {object} probeContext 协调器代次端口。
     * @returns {Promise<void>} 当前候选挂载到响应式树或被取消后结束。
     */
    async mountProbeCandidate(task, candidate, probeContext) {
      // 条件分支: 当前任务已被取消或代次失效时进入；执行内容: 不挂载候选，保持释放由现有任务所有者负责。
      if (!this.isCurrentTask(task, probeContext)) return;
      this.probeSlots.push({
        id: task.slotId,
        media: candidate.media,
        sessionContext: {
          sourceId: candidate.contentItem.sourceId,
          contentId: candidate.contentItem.id,
          episodeId: candidate.episode.id,
          episodeIndex: resolvePlaybackEpisodeIndex(candidate.episode),
          playbackSourceId: candidate.line.id
        },
        poster: candidate.contentItem.cover || candidate.contentItem.poster || ''
      });
      await this.$nextTick();
      // 条件分支: DOM 更新后任务代次失效时进入；执行内容: 立即释放刚挂载的独立播放器槽位。
      if (!this.isCurrentTask(task, probeContext)) {
        await this.releaseProbeSlot(task.slotId);
      }
    },

    /**
     * 处理真实播放器稳定会话事件。
     * 副作用: 只完成与当前 slotId 和任务代次一致的任务，并在结果兑现前释放对应媒体资源。
     *
     * @param {string} slotId 当前播放器槽位身份。
     * @param {object} session XgplayerMediaPlayer 发布的稳定媒体会话。
     * @returns {void} 结果通过当前 probe Promise 返回协调器。
     */
    handleProbeSessionEvent(slotId, session) {
      // 类型: object|undefined；作用: 读取当前槽位对应的未决任务，拒绝不存在或已完成任务的迟到事件。
      const task = this._pendingProbeTasks.get(slotId);
      // 条件分支: 任务不存在或代次已经变化时进入；执行内容: 忽略迟到播放器事件。
      if (!task || task.generation !== this._probeGeneration) return;
      // 条件分支: 会话进入任一稳定可播放阶段时进入；执行内容: 记录可达并释放槽位。
      if (PROBE_AVAILABLE_PHASES.includes(session?.phase)) {
        this.settleProbeTask(task, MEDIA_REACHABILITY_PROBE_RESULT.available);
        return;
      }
      // 条件分支: 会话不是稳定失败阶段时进入；执行内容: 等待后续播放器事件。
      if (!PROBE_FAILURE_PHASES.includes(session?.phase)) return;
      // 类型: string；作用: 把可归属媒体失败与基础设施失败映射为稳定探测结果。
      const result = session?.phase === MEDIA_PLAYBACK_PHASE.error
        && session?.errorCode === MEDIA_PLAYBACK_ERROR_CODE.mediaPlaybackFailed
        ? MEDIA_REACHABILITY_PROBE_RESULT.unavailable
        : MEDIA_REACHABILITY_PROBE_RESULT.inconclusive;
      this.settleProbeTask(task, result);
    },

    /**
     * 完成当前探测任务并释放其媒体槽位。
     * 副作用: 原子移除任务所有权，等待同一槽位 disposePlayer，再兑现调用方 Promise。
     *
     * @param {object} task 当前任务控制器。
     * @param {string} result MEDIA_REACHABILITY_PROBE_RESULT。
     * @returns {void} 释放和 Promise 完成在内部异步链执行。
     */
    settleProbeTask(task, result) {
      // 条件分支: 任务已经完成或不再由当前表拥有时进入；执行内容: 忽略重复终态，避免重复释放和重复兑现。
      if (task.settled || this._pendingProbeTasks.get(task.slotId) !== task) return;
      task.settled = true;
      // 生命周期清理: 任务已有真实终态时取消对应时限，避免释放后的迟到回调再次触碰槽位。
      // 条件分支: 任务仍持有活动超时时限时进入；执行内容: 清除时限并保持后续释放链幂等。
      if (task.timeoutId !== null) {
        clearTimeout(task.timeoutId);
        task.timeoutId = null;
      }
      this._pendingProbeTasks.delete(task.slotId);
      this.releaseProbeSlot(task.slotId).then(
        () => task.resolve(result),
        () => task.resolve(MEDIA_REACHABILITY_PROBE_RESULT.inconclusive)
      );
    },

    /**
     * 取消当前全部探测并等待所有槽位释放。
     * 副作用: 提升组件代次、隔离迟到 Provider 响应、完成未决任务并释放每个 Xgplayer/HLS 资源。
     * 成功路径: 所有当前释放屏障完成后返回；未决任务均兑现 inconclusive。
     * 失败路径: 任一释放异常仍兑现任务不可判定结果，并由 Promise.all 暴露释放失败。
     *
     * @param {string} reason 安全取消原因，仅用于调用语义，不写页面或日志。
     * @returns {Promise<void>} 全部当前槽位释放后兑现。
     */
    async cancel(reason = '媒体探测已经取消') {
      void reason;
      this._probeGeneration += 1;
      // 类型: Array<object>；作用: 固定本次取消时仍未完成的任务快照，避免清表后丢失兑现器。
      const tasks = Array.from(this._pendingProbeTasks.values());
      this._pendingProbeTasks.clear();
      // 类型: Array<Promise<void>>；作用: 收集已有和本次创建的全部槽位释放屏障。
      const releaseOperations = Array.from(this._probeReleaseOperations.values());
      for (const task of tasks) {
        task.settled = true;
        // 生命周期清理: 取消路径不等待自然时限，立即清除任务自己的超时回调。
        // 条件分支: 任务仍持有活动超时时限时进入；执行内容: 清除时限并等待槽位释放。
        if (task.timeoutId !== null) {
          clearTimeout(task.timeoutId);
          task.timeoutId = null;
        }
        // 类型: Promise<void>；作用: 释放当前任务槽位并复用同槽位幂等屏障。
        const releaseOperation = this.releaseProbeSlot(task.slotId);
        releaseOperations.push(releaseOperation);
        releaseOperation.then(
          () => task.resolve(MEDIA_REACHABILITY_PROBE_RESULT.inconclusive),
          () => task.resolve(MEDIA_REACHABILITY_PROBE_RESULT.inconclusive)
        );
      }
      await Promise.all(releaseOperations);
    },

    /**
     * 释放当前探测槽位。
     * 副作用: 调用对应 XgplayerMediaPlayer.disposePlayer，等待第三方播放器、HLS 和监听器销毁后清空 Vue 槽位。
     *
     * @param {string} slotId 要释放的稳定槽位身份。
     * @returns {Promise<void>} 媒体所有者完成释放和 DOM 清理后兑现。
     */
    releaseProbeSlot(slotId) {
      // 条件分支: 当前槽位已经存在释放屏障时进入；执行内容: 复用同一 Promise，保证释放幂等。
      if (this._probeReleaseOperations.has(slotId)) {
        return this._probeReleaseOperations.get(slotId);
      }
      // 类型: number；作用: 定位当前槽位在响应式数组中的位置，以便选择对应播放器实例。
      const slotIndex = this.probeSlots.findIndex(slot => slot.id === slotId);
      // 条件分支: 当前槽位已经被移除时进入；执行内容: 返回已完成的释放结果。
      if (slotIndex < 0) return Promise.resolve();
      // 类型: Promise<void>；作用: 等待播放器销毁、槽位移除和 DOM 更新完成。
      const releaseOperation = Promise.resolve().then(async () => {
        // 类型: Array<object>|object|undefined；作用: 读取 Vue ref 暴露的一个或多个播放器实例。
        const players = this.$refs.probePlayers;
        // 类型: object|undefined；作用: 按槽位索引选择对应播放器，单项 ref 兼容 Vue 的单实例形态。
        const player = Array.isArray(players) ? players[slotIndex] : players;
        // 条件分支: 子播放器提供释放端口时进入；执行内容: 等待第三方播放器和媒体监听器完成销毁。
        if (typeof player?.disposePlayer === 'function') await player.disposePlayer();
        // 类型: number；作用: 重新定位槽位，避免并发释放导致旧索引失效。
        const currentIndex = this.probeSlots.findIndex(slot => slot.id === slotId);
        // 条件分支: 槽位仍存在时进入；执行内容: 从响应式树移除槽位并等待 DOM 完成更新。
        if (currentIndex >= 0) {
          this.probeSlots.splice(currentIndex, 1);
          await this.$nextTick();
        }
      });
      this._probeReleaseOperations.set(slotId, releaseOperation);
      return releaseOperation.finally(() => {
        // 条件分支: 当前槽位仍指向本次释放屏障时进入；执行内容: 删除屏障登记，允许后续同槽位重新建立释放屏障。
        if (this._probeReleaseOperations.get(slotId) === releaseOperation) {
          this._probeReleaseOperations.delete(slotId);
        }
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

/* 单根容器只承担 Vue 2 根节点和无布局占位，不改变每个探测槽位的绝对定位行为。 */
.media-reachability-probe-hosts {
  position: absolute;
  width: 0;
  height: 0;
}

/* 每个隐藏播放器始终填满稳定探测舞台，避免第三方 fluid 初始化获得零尺寸。 */
.media-reachability-probe-host > * {
  width: 100%;
  height: 100%;
}
</style>
