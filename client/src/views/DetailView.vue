<template>
  <!--
    DetailView 页面渲染树

    {div.theme-page.detail-view} [v-loading="loading"]
    ├─ [if hasVideo] 详情内容分支
    │  └─ {div.detail-shell}
    │     ├─ {section.detail-hero.theme-surface}
    │     │  ├─ {div.detail-poster}
    │     │  │  ├─ [if video.cover] {img}
    │     │  │  │  └─ 显示视频封面图
    │     │  │  └─ [else] (detail-poster-fallback)
    │     │  │     └─ 没有封面时显示标题前两个字作为占位
    │     │  │
    │     │  └─ {div.detail-main}
    │     │     ├─ (detail-kicker)
    │     │     │  └─ 显示来源、年份、地区和评分标签
    │     │     ├─ {h1.detail-title}
    │     │     │  └─ 显示视频标题
    │     │     ├─ [if displayAlias] (detail-alias)
    │     │     │  └─ 显示视频别名
    │     │     ├─ (detail-meta-line)
    │     │     │  └─ 按 v4 结构显示主演等核心信息
    │     │     ├─ (detail-summary)
    │     │     │  └─ 显示简介，没有简介时显示固定占位
    │     │     └─ (detail-actions)
    │     │        ├─ {el-button}
    │     │        │  - 点击调用 playSelectedEpisode
    │     │        │  - 跳转到带 sourceId/videoId、分集 query 和 autoplay 意图的播放页
    │     │        └─ {el-button}
    │     │           - 点击调用 handleToggleFavorite
    │     │           - 通过 userContentService 写入收藏状态
    │     │
    │     └─ {section.detail-play-catalog.theme-surface}
    │        └─ {PlayCatalogSelector}
    │           └─ 复用统一线路下拉、当前浏览线路状态和该线路真实选集
    │
    └─ [else] 整页空状态分支
       └─ {div.detail-page-empty}
          ├─ {el-empty} 展示解析、失败或无身份说明
          └─ [if] {div.detail-empty-actions} 提供重试、搜索和首页动作
  -->
  <!--
    详情页。
    作用：展示单个视频的封面、核心信息、简介和分集入口。
  -->
  <div
    class="theme-page detail-view"
    v-loading="loading"
    element-loading-text="正在解析详情数据">
    <!-- 有视频详情数据时渲染完整详情内容。 -->
    <div v-if="hasVideo" class="detail-shell">
      <!--
        详情头图区。
        渲染位置：详情页顶部。
        使用数据：video、source、selectedEpisode。
        页面作用：按 v4 的结构展示封面、标题、简介和主播放按钮。
      -->
      <section class="detail-hero theme-surface">
        <!--
          海报区域。
          条件逻辑：有 video.cover 显示图片，没有封面时显示标题占位。
        -->
        <div class="detail-poster" :class="{ empty: !posterImage }">
          <!-- 真实封面图，优先读取统一内容对象的 cover，再回退到 poster。 -->
          <img v-if="posterImage" :src="posterImage" :alt="video.title" />

          <!-- 无封面占位，避免详情页左侧区域空白。 -->
          <div v-else class="detail-poster-fallback">{{ posterFallback }}</div>

          <!-- 更新状态角标，通常用于展示“更新至几集”或清晰度信息。 -->
          <span v-if="posterBadge" class="detail-poster-badge">{{ posterBadge }}</span>
        </div>

        <!--
          详情正文区。
          渲染位置：海报右侧。
          页面作用：集中展示标签、标题、核心元信息、简介和播放按钮。
        -->
        <div class="detail-main">
          <!--
            顶部标签区。
            使用数据：sourceName、video.year、video.area、displayRating。
            页面作用：贴近 v4 的详情页标签样式，只保留核心扫读信息。
          -->
          <div class="detail-kicker">
            <el-tag class="detail-tag kind-source" size="small" effect="plain">{{ sourceName }}</el-tag>
            <el-tag v-if="video.year" class="detail-tag" size="small" effect="plain">{{ video.year }}</el-tag>
            <el-tag v-if="video.area" class="detail-tag" size="small" effect="plain">{{ video.area }}</el-tag>
            <el-tag class="detail-tag kind-rating" size="small" effect="plain">
              <i v-if="hasRating" class="el-icon-star-on"></i>
              {{ displayRating }}
            </el-tag>
          </div>

          <!-- 视频标题，作为详情页主标题。 -->
          <h1 class="detail-title">{{ video.title }}</h1>

          <!-- 视频别名，有别名字段时才显示。 -->
          <p v-if="displayAlias" class="detail-alias">{{ displayAlias }}</p>

          <!--
            核心元信息行。
            当前先贴近 v4 的紧凑形式，把主演作为详情页主信息展示。
          -->
          <div class="detail-meta-line">
            <span class="detail-label">主演</span>
            <span class="detail-value">{{ actorText }}</span>
          </div>

          <!-- 简介区，没有简介时显示统一占位文案。 -->
          <p class="detail-summary">{{ displaySummary }}</p>

          <!--
            操作区。
            当前阶段点击播放入口会跳转到带 sourceId/videoId、分集 query 和 autoplay 意图的播放页。
            收藏按钮会写入用户内容状态，并和列表页卡片收藏状态联动。
          -->
          <div class="detail-actions">
            <el-button
              type="primary"
              icon="el-icon-video-play"
              :disabled="!selectedEpisode"
              @click="playSelectedEpisode">
              {{ selectedEpisode ? '播放 ' + selectedEpisode.label : '暂无可播放分集' }}
            </el-button>
            <el-button
              :type="isFavorite ? 'primary' : 'default'"
              :icon="favoriteButtonIcon"
              @click="handleToggleFavorite">
              {{ favoriteButtonText }}
            </el-button>
          </div>
        </div>
      </section>

      <!--
        统一播放目录区。
        渲染位置：详情头图区下方。
        使用数据：video.playCatalog、browsedLineId、selectedEpisodeId。
        页面作用：提前选择真实线路和该线路自己的电影入口或电视剧选集。
      -->
      <section class="detail-play-catalog theme-surface" aria-label="播放目录">
        <!-- 详情页只协调浏览与待播放选择，组件本身不修改路由或历史。 -->
        <PlayCatalogSelector
          :play-catalog="playCatalog"
          :browsed-line-id="browsedLineId"
          :selected-episode-id="selectedEpisodeId"
          :show-reachability-status="true"
          :show-episode-reachability-status="false"
          :line-reachability-statuses="lineReachabilityStatuses"
          @line-change="handleBrowsedLineChange"
          @episode-select="handleEpisodeSelection"
        />
      </section>

      <!-- 无视觉探测宿主只提供真实 Xgplayer/HLS 证据，不采用媒体、路由、历史或内容 Store。 -->
      <MediaReachabilityProbeHost ref="mediaReachabilityProbeHost" />
    </div>

    <!-- video 为空时显示整页空状态。 -->
    <div v-else class="detail-page-empty theme-surface">
      <el-empty :description="emptyStateDescription" />
      <!-- 空详情入口和失败详情都提供页面内恢复动作，不把公开导航变成不可操作的死端。 -->
      <div v-if="showDetailEntryActions || showDetailRetryAction" class="detail-empty-actions">
        <el-button
          v-if="showDetailRetryAction"
          type="primary"
          icon="el-icon-refresh"
          @click="retryDetailContent">
          重新加载
        </el-button>
        <el-button icon="el-icon-search" @click="navigateToSearch">去搜索</el-button>
        <el-button icon="el-icon-s-home" @click="navigateToHome">返回首页</el-button>
      </div>
    </div>
  </div>
</template>

<script>
/*
  DetailView.vue 模块说明

  - 文件职责:
      渲染统一 ContentItem 详情、播放目录选择和播放入口。
      收藏操作通过 userContentService 等待 Repository 提交，页面只读取 selector 投影。

  - 导入库及文件汇总(14 条，内置 0 条，第三方 0 条，自定义 14 条):
      requestSourceData: 自定义服务，请求详情页 detail 数据桶并写入内容共享池。
      getCurrentContentItem: 自定义 selector，读取详情页当前内容。
      getContentUserStatus: 自定义 selector，读取当前内容收藏和播放状态。
      toggleFavorite: 自定义服务，切换当前内容收藏状态。
      createContentPlaybackNavigationTarget: 自定义服务，根据当前 ContentItem 和选中分集创建统一播放器目标。
      createRouteRequestGuard: 自定义路由请求守卫，阻止失活详情页响应其他页面路由变化。
      applyDocumentTitle: 自定义标题服务，仅在当前详情路由采用静态或严格内容标题。
      userContentRecoveryService exports: 自定义恢复门面，读取恢复记录、匹配分集并在播放前提交重绑定。
      PlayCatalogSelector: 自定义组件，复用详情和播放页统一线路与选集 DOM。
      MediaReachabilityProbeHost: 自定义无视觉组件，通过真实 Xgplayer/HLS 路径探测一个标准媒体候选。
      mediaReachabilityService exports: 自定义服务，生成每条线路一个代表目标并协调严格串行与取消。
      playCatalogSelectionService exports: 自定义服务，读取目录并执行默认线路与精确选择决策。

  - 模块级常量:
      DETAIL_DOCUMENT_ROUTE_NAMES: Array<string>，允许详情页写入浏览器标题的两个路由名称。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      DetailView: Vue component，供 detail 路由展示单个内容详情和用户收藏状态。
*/

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 详情页进入时请求 detail 数据桶，并把响应写入 detail.currentKey，页面通过 getCurrentContentItem('detail') 读取。
import { requestSourceData } from '../services/sourceDataService.js';

// 导入来源: ../store/siteContentStore.js。
// 导入内容: getCurrentContentItem 单内容桶 selector。
// 文件作用: 详情页通过 selector 从 detail.currentKey 解析完整 ContentItem。
import { getCurrentContentItem } from '../store/siteContentStore.js';

// 导入来源: ../selectors/userContentSelectors。
// 导入内容: getContentUserStatus 用户内容状态 selector。
// 文件作用: 用于让详情页读取当前内容收藏状态，并和列表页卡片保持同步。
import { getContentUserStatus } from '../selectors/userContentSelectors.js';

// 导入来源: ../services/userContentService。
// 导入内容: toggleFavorite 收藏切换服务。
// 文件作用: 让详情页收藏按钮等待 Repository 提交并采用统一用户内容投影。
import { toggleFavorite } from '../services/userContentService.js';

// 导入来源: ../services/playerNavigationService.js。
// 导入内容: createContentPlaybackNavigationTarget 内容播放目标构造函数。
// 文件作用: 详情页只提交当前内容、选中分集和自动播放意图，不在页面中复制播放器 params/query 规则。
import { createContentPlaybackNavigationTarget } from '../services/playerNavigationService.js';

// 导入来源: ../utils/sourceDisplayName.js。
// 导入内容: formatSourceDisplayName 数据源显示名称适配函数。
// 文件作用: 让详情页来源标签遵守全站十个 Unicode 字符显示边界。
import { formatSourceDisplayName } from '../utils/sourceDisplayName.js';

// 导入来源: ../router/routeRequestState.js。
// 导入内容: createRouteRequestGuard KeepAlive 请求身份守卫。
// 文件作用: 详情页只处理 detail-entry/detail 的新 fullPath，普通离开和返回不重复请求。
import { createRouteRequestGuard } from '../router/routeRequestState.js';

// 导入来源: ../services/documentTitleService.js。
// 导入内容: applyDocumentTitle 统一浏览器标题采用函数。
// 文件作用: 详情页只补充严格匹配的内容标题，静态格式和应用后缀继续由唯一服务维护。
import { applyDocumentTitle } from '../services/documentTitleService.js';

import {
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: getUserContentRecoveryContext；文件作用: 从当前 query 读取原用户记录。
  getUserContentRecoveryContext,
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: findUserContentRecoveryEpisode；文件作用: 详情加载后按历史定位器选择替代分集。
  findUserContentRecoveryEpisode,
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: commitUserContentRecovery；文件作用: 用户点击播放时原子重绑定收藏和历史。
  commitUserContentRecovery
} from '../services/userContentRecoveryService.js';

// 导入来源: ../components/playback/PlayCatalogSelector.vue。
// 导入内容: PlayCatalogSelector 自定义组件。
// 文件作用: 在详情宽容器复用线路下拉、浏览线路状态和该线路选集。
import PlayCatalogSelector from '../components/playback/PlayCatalogSelector.vue';

// 导入来源: ../components/player/MediaReachabilityProbeHost.vue。
// 导入内容: MediaReachabilityProbeHost 无视觉真实媒体探测宿主。
// 文件作用: 详情页只注入标准目标和消费三态，播放器创建、事件分类与释放由通用组件拥有。
import MediaReachabilityProbeHost from '../components/player/MediaReachabilityProbeHost.vue';

import {
  // 导入来源: ../services/mediaReachabilityService.js；导入内容: MEDIA_REACHABILITY_PROBE_RESULT；文件作用: ref 尚未挂载或取消时返回不可判定。
  MEDIA_REACHABILITY_PROBE_RESULT,
  // 导入来源: ../services/mediaReachabilityService.js；导入内容: createDetailLineReachabilityProbePlan；文件作用: 每条线路只选择一个代表分集。
  createDetailLineReachabilityProbePlan,
  // 导入来源: ../services/mediaReachabilityService.js；导入内容: createMediaReachabilityCoordinator；文件作用: 严格串行并等待旧播放器释放。
  createMediaReachabilityCoordinator
} from '../services/mediaReachabilityService.js';

// 导入来源: ../config/mediaPlayback.config.js。
// 导入内容: MEDIA_REACHABILITY_STATUS 详情线路允许的 checking/available/unavailable 三态。
// 文件作用: 状态采用与清理只接受冻结枚举，不从文案或 Provider 结构推测终态。
import { MEDIA_REACHABILITY_STATUS } from '../config/mediaPlayback.config.js';

import {
  // 导入来源: ../services/playCatalogSelectionService.js；导入内容: findPlayCatalogLine；文件作用: 精确读取当前浏览线路。
  findPlayCatalogLine,
  // 导入来源: ../services/playCatalogSelectionService.js；导入内容: findPlayCatalogEpisode；文件作用: 精确读取当前线路逻辑剧集。
  findPlayCatalogEpisode,
  // 导入来源: ../services/playCatalogSelectionService.js；导入内容: resolveInitialPlayCatalogLineId；文件作用: 按历史与 Provider 默认顺序初始化线路。
  resolveInitialPlayCatalogLineId,
  // 导入来源: ../services/playCatalogSelectionService.js；导入内容: decideBrowsedLineChange；文件作用: 处理详情页线路浏览意图。
  decideBrowsedLineChange,
  // 导入来源: ../services/playCatalogSelectionService.js；导入内容: decideManualEpisodeSelection；文件作用: 校验详情页手动选集目标。
  decideManualEpisodeSelection
} from '../services/playCatalogSelectionService.js';

// 类型: Array<string>。
// 作用: 限制 DetailView 只在自己的无身份入口或严格详情路由更新浏览器标题，失活 KeepAlive 实例不得覆盖其他页面。
const DETAIL_DOCUMENT_ROUTE_NAMES = Object.freeze(['detail-entry', 'detail']);

export default {
  // 组件名称用于在调试工具和报错信息中识别详情页。
  name: 'DetailView',

  // 类型: object；作用: 注册共享播放目录和无视觉探测资源宿主，详情页不保留第二套线路、选集或播放器实现。
  components: {
    PlayCatalogSelector,
    MediaReachabilityProbeHost
  },

  /**
   * 创建详情页局部运行状态。
   * 纯函数: 每个组件实例返回独立加载、错误、浏览线路和待播放剧集状态，不读取外部 store。
   *
   * @returns {object} 详情页局部状态。
   */
  data() {
    return {
      // loading 类型: boolean。
      // loading 作用: 控制根容器 v-loading，请求详情数据时显示页面级加载遮罩。
      loading: false,

      // loadError 类型: string。
      // loadError 作用: 记录详情数据请求失败文案，失败时交给整页空状态展示。
      loadError: '',

      // selectedEpisodeId 类型: string。
      // selectedEpisodeId 作用: 表示当前浏览线路内待播放的逻辑剧集，影响组件高亮和播放按钮文案。
      selectedEpisodeId: '',

      // browsedLineId 类型: string。
      // browsedLineId 作用: 表示详情页当前查看和准备播放的目录线路，只属于当前页面会话。
      browsedLineId: '',

      // 类型: object；作用: 按 lineId 保存当前详情内容会话的 checking/available/unavailable；不进入 Store 或持久化。
      lineReachabilityStatuses: {}
    };
  },

  /**
   * 启动详情页首次内容请求。
   * 生命周期时机: 组件创建后、首次渲染前执行。
   * 副作用: 调用 loadDetailContent 写入加载状态并请求 detail 数据桶。
   *
   * @returns {void} 异步请求由方法自身收敛。
   */
  created() {
    // 类型: Readonly<object>；作用: 当前 DetailView 实例独享的无身份入口和严格详情请求守卫。
    this._routeRequestGuard = createRouteRequestGuard({
      routeNames: ['detail-entry']
    });
    // 副作用: 把首次 URL 标记为已处理，返回同一 KeepAlive 详情地址时不重复请求。
    this._routeRequestGuard.markHandled(this.$route);

    // 类型: number；生命周期: 当前详情组件；作用: 每次详情请求单调递增，阻止迟到响应改写新内容选择或重启旧探测。
    this._detailLoadGeneration = 0;

    // 类型: Readonly<object>；作用: 当前 DetailView 独享的单任务协调器，真实探测由 ref 宿主完成。
    this._mediaReachabilityCoordinator = createMediaReachabilityCoordinator({
      /**
       * 请求并真实准备一个精确媒体目标。
       * 副作用: 调用当前无视觉探测宿主；未挂载时返回不可判定。
       *
       * @param {object} target 精确媒体目标。
       * @param {object} probeContext 协调器代次端口。
       * @returns {Promise<string>} 内部三类探测结果。
       */
      probeTarget: (target, probeContext) => this.$refs.mediaReachabilityProbeHost?.probe(target, probeContext)
        || Promise.resolve(MEDIA_REACHABILITY_PROBE_RESULT.inconclusive),
      /**
       * 采用当前详情线路状态。
       * 副作用: 通过页面方法更新响应式线路投影。
       *
       * @param {object} target 精确媒体目标。
       * @param {string} status 合法三态。
       * @returns {void} 状态由页面方法采用。
       */
      onStatusChange: (target, status) => this.applyDetailLineReachabilityStatus(target, status),
      /**
       * 清理不可判定目标。
       * 副作用: 只撤销当前目标仍为 checking 的投影。
       *
       * @param {object} target 精确媒体目标。
       * @returns {void} 清理完成后结束。
       */
      onInconclusive: target => this.clearDetailLineReachabilityChecking([target]),
      /**
       * 取消详情探测资源。
       * 副作用: 撤销 checking 并等待当前 Xgplayer/HLS 完整释放。
       *
       * @param {Array<object>} targets 未完成目标。
       * @returns {Promise<void>} 资源释放后兑现。
       */
      onCancel: targets => this.handleDetailLineReachabilityCancellation(targets)
    });

    // 生命周期时机: 详情页组件创建后执行。
    // 执行内容: 请求当前路由目标的详情数据，并写入统一 detail 数据桶。
    this.loadDetailContent();
  },

  /**
   * KeepAlive 详情页重新可见时恢复尚未完成的线路代表探测。
   * 副作用: 当前严格详情已有内容时重新生成计划；已完成红绿线路不会重复请求。
   * 失败路径: 无内容或当前路由不是严格详情时保持协调器空闲。
   *
   * @returns {void} 探测在后台运行。
   */
  activated() {
    // 条件分支: 当前严格详情内容仍与路由身份一致时进入；执行内容: 恢复未知线路探测。
    if (this.hasVideo) this.startDetailLineReachabilityPlan(this.video);
  },

  /**
   * KeepAlive 详情页失活时取消媒体探测。
   * 副作用: 撤销仍为 checking 的线路并等待无视觉播放器释放；已完成红绿保持到本详情会话结束。
   *
   * @returns {void} 资源释放 Promise 由协调器收敛。
   */
  deactivated() {
    // 生命周期副作用: 使仍在途的详情响应失去本地采用权；Store 事务继续由 sourceDataService 自己收敛。
    this._detailLoadGeneration = Number(this._detailLoadGeneration || 0) + 1;
    this._mediaReachabilityCoordinator?.cancel();
  },

  /**
   * 详情组件销毁前永久释放协调器和探测宿主。
   * 副作用: 使所有迟到结果失效并开始等待当前 Xgplayer/HLS 释放。
   *
   * @returns {void} 销毁钩子不等待释放 Promise。
   */
  beforeDestroy() {
    // 生命周期副作用: 销毁后拒绝任何详情响应继续初始化线路、选集或探测状态。
    this._detailLoadGeneration = Number(this._detailLoadGeneration || 0) + 1;
    this._mediaReachabilityCoordinator?.dispose();
  },

  watch: {
    /**
     * 监听当前可见详情路由及其严格内容标题。
     * 执行时机: 首次创建、返回 KeepAlive 详情地址、详情 URL 变化或匹配内容标题采用时触发。
     * 副作用: 通过统一标题服务写入 document.title；失活详情实例返回 null 时不覆盖 Router 已采用的其他页面标题。
     *
     * @param {object|null} context 当前详情标题上下文，null 表示 DetailView 不是当前路由。
     * @returns {void} 标题采用完成后结束。
     */
    documentTitleContext: {
      // 类型: boolean；true 在组件首次创建时立即采用当前详情静态或内容标题，false 会遗漏已缓存内容首屏标题。
      immediate: true,
      /**
       * 采用当前详情标题上下文。
       * 副作用: 只在 context 非空时调用统一标题服务写入 document.title。
       * 失败路径: 详情实例失活时保持 Router 当前标题，不写入旧内容名称。
       *
       * @param {object|null} context 当前详情标题上下文。
       * @returns {void} 标题采用或失活跳过后结束。
       */
      handler(context) {
        // 条件分支: KeepAlive 详情实例当前处于其他路由后台时进入；执行内容: 保留 Router 已写入的当前页面标题。
        if (!context) {
          return;
        }
        // 副作用: 当前详情路由采用统一格式标题；服务负责浏览器缺失时安全降级。
        applyDocumentTitle(context.route, context.contentTitle);
      }
    },

    /**
     * 监听详情页完整路由变化。
     * 执行时机: sourceId 或 videoId 等路由信息变化时触发。
     * 页面影响: 从新路由重新请求 detail.currentKey，保证卡片跳转到不同详情时内容同步刷新。
     * 副作用: 发起新的详情数据请求并更新页面加载状态。
     *
     * @returns {void} 只触发详情数据请求，不返回业务数据。
     */
    '$route.fullPath'() {
      // 条件分支: 当前路由属于其他缓存页面或详情地址已经处理过时进入。
      // 执行内容: 保留详情页现状，不在后台请求其他页面身份。
      if (!this._routeRequestGuard || !this._routeRequestGuard.shouldHandle(this.$route)) {
        return;
      }

      // 异步调用: 只有详情入口/严格详情的新 fullPath 才重新请求或采用无身份空状态。
      this.loadDetailContent();
    }
  },

  computed: {
    /**
     * 当前详情页跨源恢复上下文。
     * 纯函数: 只读取 route.query 和用户内容 selector；普通详情或记录已删除时返回 null。
     *
     * @returns {object|null} 收藏或历史恢复上下文。
     */
    recoveryContext() {
      return getUserContentRecoveryContext(this.$route.query);
    },

    /**
     * 当前详情页统一内容对象。
     * 纯函数: 只读取 detail 数据桶 selector，不修改实体池或页面状态。
     *
     * @returns {Object|null} 当前 ContentItem；尚未加载或未命中时为 null。
     */
    video() {
      // 返回值类型: Object|null。
      // 作用: 通过统一 selector 从 detail.currentKey 读取实体池中的完整 ContentItem。
      return getCurrentContentItem('detail');
    },

    /**
     * 当前视频来源对象。
     * 纯函数: 只读取当前 ContentItem.source，不修改内容对象。
     *
     * @returns {Object|null} ContentItem.source 对象；缺失时为 null。
     */
    source() {
      // source 是统一 ContentItem 的来源扩展字段，当前用于显示来源名称。
      return this.video && this.video.source ? this.video.source : null;
    },

    /**
     * 当前详情内容的统一播放目录。
     * 纯函数: 只接受 ContentItem.playCatalog 普通对象，不从旧分集或播放字段构造目录。
     *
     * @returns {object|null} 当前 PlayCatalog；缺失或形状无效时返回 null。
     */
    playCatalog() {
      // 类型: object|null；作用: 让详情页、共享组件和导航只读取同一目录权威。
      const catalog = this.video && this.video.playCatalog;
      // 返回值类型: object|null；作用: 数组和原始值进入统一空目录状态，不建立兼容投影。
      return catalog && typeof catalog === 'object' && !Array.isArray(catalog) ? catalog : null;
    },

    /**
     * 当前详情页正在浏览的播放线路。
     * 纯函数: 只按 browsedLineId 精确读取，不回退 Provider 默认线路或数组位置。
     *
     * @returns {object|null} 当前 PlayCatalogLine；身份未命中时返回 null。
     */
    browsedLine() {
      // 返回值类型: object|null；作用: 统一驱动当前线路选集、选择校验和播放导航。
      return findPlayCatalogLine(this.playCatalog, this.browsedLineId);
    },

    /**
     * 当前浏览线路自己的播放条目。
     * 纯函数: 返回新的数组外壳，不跨线路补集或修改 Provider 排序。
     *
     * @returns {Array<object>} 当前线路 PlayCatalogEpisode 列表；无有效线路时返回空数组。
     */
    episodes() {
      // 类型: Array<object>|null；作用: 只读取当前浏览线路的标准 episodes 数组。
      const lineEpisodes = this.browsedLine && this.browsedLine.episodes;
      // 返回值类型: Array<object>；作用: 隔离数组外壳，避免页面排序或查找意外修改目录。
      return Array.isArray(lineEpisodes) ? [...lineEpisodes] : [];
    },

    /**
     * 当前详情页路由中的数据源 id。
     * 纯函数: 只读取 Vue Router params 并标准化文本。
     *
     * @returns {string} URL params 中的 sourceId，没有时返回空字符串。
     */
    routeSourceId() {
      // sourceId 来自 `/detail/:sourceId/:videoId` 必填路径，真实详情请求必须以它选择目标数据源。
      return this.asText(this.$route.params.sourceId).trim();
    },

    /**
     * 当前详情页路由中的视频 id。
     * 纯函数: 只读取 Vue Router params 并标准化文本。
     *
     * @returns {string} URL params 中的 videoId，没有时返回空字符串。
     */
    routeVideoId() {
      // videoId 来自 `/detail/:sourceId/:videoId` 必填路径，真实详情请求必须以它定位目标视频。
      return this.asText(this.$route.params.videoId).trim();
    },

    /**
     * 详情页是否具备完整请求身份。
     * 纯函数: 只读取 routeSourceId 和 routeVideoId。
     *
     * @returns {boolean} sourceId 与 videoId 都存在时返回 true，否则返回 false。
     */
    hasCompleteRouteIdentity() {
      return Boolean(this.routeSourceId && this.routeVideoId);
    },

    /**
     * 详情页空状态文案。
     * 纯函数: 只读取当前请求阶段和安全错误，不修改页面或内容 Store。
     * 成功路径: 解析中、失败和无身份入口分别显示对应用户状态。
     * 失败路径: 没有错误和请求时返回稳定的无内容说明。
     *
     * @returns {string} 当前详情页应显示的状态说明。
     */
    emptyStateDescription() {
      // 条件分支: 当前详情请求正在执行时进入；执行内容: 明确说明页面正在解析详情地址。
      if (this.loading) {
        return '正在解析详情数据';
      }

      return this.loadError || '当前没有可展示的视频详情数据';
    },

    /**
     * 详情无身份入口是否应展示恢复导航。
     * 纯函数: 只读取完整路由身份和加载状态，不发起导航。
     *
     * @returns {boolean} 无身份且不在请求中的详情入口返回 true。
     */
    showDetailEntryActions() {
      return !this.hasCompleteRouteIdentity && !this.loading;
    },

    /**
     * 详情请求失败是否应展示重试动作。
     * 纯函数: 只读取严格详情身份和错误文案，不修改请求状态。
     *
     * @returns {boolean} 严格详情请求失败时返回 true。
     */
    showDetailRetryAction() {
      return this.hasCompleteRouteIdentity && Boolean(this.loadError) && !this.loading;
    },

    /**
     * 播放跳转使用的数据源 id。
     * 纯函数: 只读取当前已采用详情实体，不回退路由或活动源。
     *
     * @returns {string} 当前详情实体所属数据源 id；实体缺失时返回空字符串。
     */
    effectiveSourceId() {
      return this.video && this.video.sourceId ? this.video.sourceId : '';
    },

    /**
     * 播放跳转使用的视频 id。
     * 纯函数: 只读取当前已采用详情实体，不回退路由 Mock 或旧页面状态。
     *
     * @returns {string} 当前详情实体 id；实体缺失时返回空字符串。
     */
    effectiveVideoId() {
      return this.video && this.video.id ? this.video.id : '';
    },

    /**
     * 是否有详情主体数据。
     * 纯函数: 只验证当前实体与完整路由身份一致，不修改内容或路由。
     *
     * @returns {boolean} 当前实体 sourceId/id 与路由目标一致时返回 true。
     */
    hasVideo() {
      return Boolean(
        this.hasCompleteRouteIdentity
        && this.video
        && this.video.sourceId === this.routeSourceId
        && this.video.id === this.routeVideoId
      );
    },

    /**
     * 当前详情页允许采用的浏览器标题上下文。
     * 纯函数: 只读取当前路由和严格 hasVideo 投影，不修改 Router、内容 Store 或 document。
     * 成功路径: 无身份入口返回静态标题上下文；严格详情只在实体身份匹配 URL 时携带视频标题。
     * 失败路径: 当前路由不属于详情页时返回 null，阻止后台 KeepAlive 实例覆盖其他页面标题。
     *
     * @returns {Readonly<object>|null} 当前路由与可选内容标题，或失活状态 null。
     */
    documentTitleContext() {
      // 类型: string；作用: 标准化当前路由名称，作为详情标题写权限门禁。
      const routeName = this.asText(this.$route && this.$route.name).trim();
      // 条件分支: 当前可见路由不属于详情入口或严格详情时进入；执行内容: 关闭标题写入权限。
      if (!DETAIL_DOCUMENT_ROUTE_NAMES.includes(routeName)) {
        return null;
      }

      return Object.freeze({
        // 类型: object；作用: 保留当前真实 Route，统一服务从中读取 meta.title。
        route: this.$route,
        // 类型: string；作用: 仅严格详情且实体身份匹配时补充内容标题，入口/加载/失败状态保持空字符串。
        contentTitle: routeName === 'detail' && this.hasVideo
          ? this.asText(this.video && this.video.title).trim()
          : ''
      });
    },

    /**
     * 视频是否有评分。
     * 纯函数: 只读取当前内容 score。
     *
     * @returns {boolean} score 有值时返回 true。
     */
    hasRating() {
      return Boolean(this.video && this.video.score);
    },

    /**
     * 详情页海报图片。
     * 纯函数: 只按 cover/poster 优先级返回图片地址。
     *
     * 页面位置：海报区真实封面图。
     *
     * @returns {string} 优先返回 cover，没有时返回 poster。
     */
    posterImage() {
      // cover 更适合详情大图，poster 作为列表海报字段在详情页兜底使用。
      return this.video ? this.video.cover || this.video.poster || '' : '';
    },

    /**
     * 海报角标文案。
     * 纯函数: 只按 badge/quality/updateStatus 优先级返回文本。
     *
     * 页面位置：海报区右上角角标。
     *
     * @returns {string} 角标、清晰度或电视剧更新状态。
     */
    posterBadge() {
      // badge 是页面优先展示的标签，quality 和 tv.updateStatus 用于补足常见视频角标。
      return this.video ? this.video.badge || this.video.quality || (this.video.tv && this.video.tv.updateStatus) || '' : '';
    },

    /**
     * 视频别名展示文本。
     * 纯函数: 只读取 aliases 并返回新文本。
     *
     * 页面位置：标题下方别名行。
     *
     * @returns {string} aliases 数组拼接文本。
     */
    displayAlias() {
      // aliases 是统一内容对象的别名数组，过滤空值后用斜杠拼接展示。
      return this.video ? this.joinTextParts(this.video.aliases, ' / ') : '';
    },

    /**
     * 封面缺失时的占位文案。
     * 纯函数: 只读取标题并截取文本，不修改内容对象。
     *
     * 页面位置：海报区 `.detail-poster-fallback`。
     *
     * @returns {string} 视频标题前两个字。
     */
    posterFallback() {
      // 类型: string；作用: 没有标题时使用“视频”，避免封面占位空白。
      const title = this.video && this.video.title ? this.video.title : '视频';

      // 只取前两个字，保证占位文本不会撑破封面区。
      return title.slice(0, 2).toUpperCase();
    },

    /**
     * 页面展示用评分文案。
     * 纯函数: 只读取当前内容评分并返回展示文本。
     *
     * 页面位置：顶部评分标签。
     *
     * @returns {string} 有评分时返回评分，没有评分时返回“暂无评分”。
     */
    displayRating() {
      // 条件分支: 当前 video 不存在时进入。
      // 执行内容: 返回空文本，不访问评分字段。
      if (!this.video) {
        return '';
      }

      // 有 score 显示具体分数，没有 score 用稳定占位文案。
      return this.video.score ? `${this.video.score} 分` : '暂无评分';
    },

    /**
     * 视频简介最终展示文本。
     * 纯函数: 只读取详情描述字段并返回展示文本。
     *
     * 页面位置：详情正文区 `.detail-summary`。
     *
     * @returns {string} 简介或兜底文案。
     */
    displaySummary() {
      // 条件分支: 当前 video 不存在时进入。
      // 执行内容: 返回空文本，避免访问描述字段。
      if (!this.video) {
        return '';
      }

      // description 是列表和详情共用简介，detail.fullDescription 是详情页更长文案。
      return this.video.detail && this.video.detail.fullDescription
        ? this.video.detail.fullDescription
        : this.video.description || '暂无剧情简介。';
    },

    /**
     * 当前来源名称。
      * 纯函数: 读取完整 source.name 并通过共享适配器返回用户可读短名称。
     *
     * 页面位置：顶部来源标签。
     *
     * @returns {string} 来源名称或兜底文案。
     */
    sourceName() {
      // 条件分支: 当前来源存在非空 name 时进入。
      // 执行内容: 返回统一 ContentItem 的十字符以内来源名称。
      if (this.source && this.source.name) {
        return formatSourceDisplayName(this.source.name);
      }

      // 没有来源对象时给出明确占位。
      return '暂无来源';
    },

    /**
     * 演员文本。
     * 纯函数: 只读取演员数组并返回拼接文本。
     *
     * 页面位置：核心元信息行。
     *
     * @returns {string} 演员拼接文本或兜底文案。
     */
    actorText() {
      // 条件分支: 当前 video 不存在时进入。
      // 执行内容: 返回演员占位文案，保证模板稳定。
      if (!this.video) {
        return '暂无演员信息';
      }

      // detail.actors 是统一内容对象中的演员列表。
      return this.joinTextParts(this.video.detail && this.video.detail.actors, ' / ') || '暂无演员信息';
    },

    /**
     * 当前选中的分集。
     * 纯函数: 只读取分集数组和 selectedEpisodeId，不修改选择状态。
     *
     * 页面位置：播放按钮文案和分集按钮 active 状态。
     *
     * @returns {Object|null} 当前分集对象。
     */
    selectedEpisode() {
      // 返回值类型: object|null；作用: 只接受当前线路内完全相同的逻辑剧集身份，不自动回退其他条目。
      return findPlayCatalogEpisode(this.browsedLine, this.selectedEpisodeId);
    },

    /**
     * 当前详情内容的用户内容状态。
     * 数据来源: userContentStore，经 getContentUserStatus selector 读取。
     * 纯函数: 不修改用户内容投影。
     *
     * @returns {Object} 收藏、最近播放和当前播放状态聚合对象。
     */
    contentUserStatus() {
      // 返回值类型: object。
      // 作用: 详情页不直接读取 userContentStore 内部结构，统一走 selector。
      return getContentUserStatus(this.video);
    },

    /**
     * 当前详情内容是否已收藏。
     * 纯函数: 只读取 contentUserStatus.favorite。
     *
     * @returns {boolean} true 表示已收藏，false 表示未收藏。
     */
    isFavorite() {
      // 返回值类型: boolean。
      // 作用: 只使用 Repository 提交成功后 selector 发布的收藏状态，不维护页面影子值。
      return Boolean(this.contentUserStatus.favorite);
    },

    /**
     * 收藏按钮图标。
     * 纯函数: 只读取 isFavorite 并返回图标类名。
     *
     * @returns {string} Element UI 图标类名。
     */
    favoriteButtonIcon() {
      // 返回值类型: string。
      // 作用: 已收藏显示实心星标，未收藏显示空心星标。
      return this.isFavorite ? 'el-icon-star-on' : 'el-icon-star-off';
    },

    /**
     * 收藏按钮文案。
     * 纯函数: 只读取 isFavorite 并返回按钮文本。
     *
     * @returns {string} 收藏按钮当前状态文案。
     */
    favoriteButtonText() {
      // 返回值类型: string。
      // 作用: 文案跟随收藏状态变化，让用户知道再次点击会取消收藏。
      return this.isFavorite ? '已收藏' : '收藏';
    },

    /**
     * 当前选中分集在播放页 query 中使用的序号。
     * 纯函数: 只读取 selectedEpisode 并派生正整数或 null。
     *
     * @returns {number|null} 分集序号；电影或缺失时返回 null。
     */
    selectedEpisodeIndex() {
      // 类型: object|null。
      // 作用: 当前选中的分集对象，电视剧跳转播放页时用于生成历史记录 key。
      const episode = this.selectedEpisode;

      // 条件分支: 没有分集时进入。
      // 执行内容: 返回 null，让播放页按电影或默认分集处理。
      if (!episode) {
        return null;
      }

      // 类型: number；作用: Provider 明确 episodeNumber 是历史兼容展示序号的第一选择。
      const episodeNumber = Number(episode.episodeNumber);
      // 条件分支: Provider 提供正整数集号时进入；执行内容: 保留结构化集号供播放请求和历史定位。
      if (Number.isInteger(episodeNumber) && episodeNumber > 0) return episodeNumber;

      // 类型: number；作用: 当前线路中的零基显示位置只作为同线路页面序号，不参与跨线路逻辑匹配。
      const episodePosition = this.episodes.indexOf(episode);
      // 返回值类型: number|null；作用: 条目属于当前线路时返回一基序号，否则保持未知。
      return episodePosition >= 0 ? episodePosition + 1 : null;
    }
  },

  methods: {
    /**
     * 把任意值整理成字符串。
     * 纯函数: 不执行隐式字符串转换，非字符串返回空文本。
     *
     * 调用位置：routeSourceId、routeVideoId。
     * 页面影响：保证路由参数进入页面后始终以字符串形态参与展示和跳转。
     *
     * @param {*} value 可能来自路由 params 的任意值。
     * @returns {string} 字符串原样返回，其他值统一转为空字符串。
     */
    asText(value) {
      // 条件分支: 路由参数已经是字符串时进入。
      // 执行内容: 原样返回标准路径文本。
      if (typeof value === 'string') {
        return value;
      }

      // 非字符串统一转为空，避免页面展示 undefined 或 null。
      return '';
    },

    /**
     * 把全部线路中的逻辑剧集整理为恢复匹配候选。
     * 纯函数: 保留目录顺序并按逻辑 id 去重，不修改 playCatalog 或线路数组。
     * 失败路径: 目录无效时返回空数组；无 id 条目不进入跨线路恢复匹配。
     *
     * @param {*} playCatalog ContentItem.playCatalog 候选值。
     * @returns {Array<object>} 去重后的 PlayCatalogEpisode 候选列表。
     */
    collectPlayCatalogEpisodes(playCatalog) {
      // 类型: Array<object>；作用: 只接受目录的真实线路数组，不从旧字段补目录。
      const lines = playCatalog && Array.isArray(playCatalog.lines) ? playCatalog.lines : [];
      // 类型: Set<string>；作用: 同一逻辑剧集跨线路只参与一次恢复匹配，避免线路顺序制造重复候选。
      const seenEpisodeIds = new Set();

      // 循环类型: Array.prototype.reduce；初始值: 空候选数组；终止条件: 所有目录线路处理完成；作用: 按 Provider 顺序扁平化有效逻辑剧集。
      return lines.reduce((episodes, line) => {
        // 类型: Array<object>；作用: 非标准线路使用空集合，不推断或修补数据形状。
        const lineEpisodes = line && Array.isArray(line.episodes) ? line.episodes : [];
        // 循环类型: for...of；初始值: 当前线路首条剧集；终止条件: 当前线路处理完成；作用: 采用首次出现的稳定逻辑身份。
        for (const episode of lineEpisodes) {
          // 类型: string；作用: 只接受契约字符串 id，非字符串身份不得隐式转换。
          const episodeId = episode && typeof episode.id === 'string' ? episode.id.trim() : '';
          // 条件分支: 身份为空或已由前序线路收录时进入；执行内容: 跳过无效或重复候选。
          if (!episodeId || seenEpisodeIds.has(episodeId)) continue;
          // 副作用边界: Set 只属于本次纯函数调用，用于记录已采用逻辑身份。
          seenEpisodeIds.add(episodeId);
          // 副作用边界: 只向本地结果数组追加原目录条目，不修改来源数组。
          episodes.push(episode);
        }
        return episodes;
      }, []);
    },

    /**
     * 判断媒体状态是否为详情页可展示终态。
     * 纯函数: 只接受 available/unavailable；checking 和未知值返回 false。
     *
     * @param {*} status 状态候选。
     * @returns {boolean} true 表示该线路已有完成证据。
     */
    isTerminalDetailLineReachabilityStatus(status) {
      return status === MEDIA_REACHABILITY_STATUS.available
        || status === MEDIA_REACHABILITY_STATUS.unavailable;
    },

    /**
     * 采用一条仍属于当前详情内容的线路状态。
     * 副作用: 以新对象替换 lineReachabilityStatuses，触发共享目录响应式更新。
     * 成功路径: 四段目标内容与当前实体一致且状态合法时写入 lineId。
     * 失败路径: 迟到内容、空线路或非法状态直接忽略。
     *
     * @param {object} target 精确媒体探测目标。
     * @param {string} status checking/available/unavailable。
     * @returns {void} 状态通过页面会话对象发布。
     */
    applyDetailLineReachabilityStatus(target, status) {
      // 类型: boolean；作用: 只有冻结三态可以进入响应式状态表。
      const isSupportedStatus = Object.values(MEDIA_REACHABILITY_STATUS).includes(status);
      // 条件分支: 状态非法、当前无内容或目标不属于当前详情实体时进入；执行内容: 拒绝迟到或跨内容状态。
      if (!isSupportedStatus || !target?.lineId || !this.video
        || target.sourceId !== this.video.sourceId || target.contentId !== this.video.id) return;
      // 状态采用: 创建新对象外壳，Vue 2 可以观察动态 lineId 键变化。
      this.lineReachabilityStatuses = {
        ...this.lineReachabilityStatuses,
        [target.lineId]: status
      };
    },

    /**
     * 撤销目标集合中仍为 checking 的详情线路状态。
     * 副作用: 只删除没有形成终态证据的动态键，已完成红绿保持。
     *
     * @param {Array<object>} targets 被取消或不可判定的精确目标。
     * @returns {void} 状态表无变化时保持原对象引用。
     */
    clearDetailLineReachabilityChecking(targets) {
      // 类型: object；作用: 隔离可能删除动态键的新状态表，不直接修改 Vue 当前对象。
      const nextStatuses = { ...this.lineReachabilityStatuses };
      // 类型: boolean；作用: 记录是否实际撤销 checking，避免无变化响应式写入。
      let changed = false;
      // 循环类型: Array.prototype.forEach；初始值: 第一条目标；终止条件: 全部目标处理完成；作用: 精确清理线路键。
      (Array.isArray(targets) ? targets : []).forEach((target) => {
        // 条件分支: 当前目标线路仍是 checking 时进入；执行内容: 删除该动态键并恢复未知状态。
        if (target?.lineId && nextStatuses[target.lineId] === MEDIA_REACHABILITY_STATUS.checking) {
          delete nextStatuses[target.lineId];
          changed = true;
        }
      });
      // 条件分支: 至少一个 checking 被撤销时进入；执行内容: 一次替换响应式对象。
      if (changed) this.lineReachabilityStatuses = nextStatuses;
    },

    /**
     * 处理详情线路队列取消。
     * 副作用: 先撤销 checking，再等待无视觉探测宿主释放当前播放器。
     * 成功路径: ref 未挂载时幂等完成；已挂载时等待 cancel 所有者端口。
     * 失败路径: 释放错误向协调器传播，下一轮不会越过资源屏障。
     *
     * @param {Array<object>} cancelledTargets 当前未完成目标。
     * @returns {Promise<void>} 媒体资源释放后兑现。
     */
    async handleDetailLineReachabilityCancellation(cancelledTargets) {
      this.clearDetailLineReachabilityChecking(cancelledTargets);
      // 类型: object|null；作用: 获取当前唯一无视觉媒体资源所有者；未挂载时无需释放。
      const probeHost = this.$refs.mediaReachabilityProbeHost || null;
      // 条件分支: 探测宿主公开取消端口时进入；执行内容: 等待 Xgplayer/HLS 完整释放。
      if (typeof probeHost?.cancel === 'function') await probeHost.cancel('详情线路探测已经取消');
    },

    /**
     * 启动当前详情内容的每线路代表探测计划。
     * 副作用: 已有队列先取消；未知线路进入 checking 并由协调器严格串行探测。
     * 成功路径: 每条可请求线路最多一个目标，已完成红绿线路不会重复请求。
     * 失败路径: 内容身份或目录无效时启动空计划完成旧队列清理。
     *
     * @param {object|null} contentItem 当前详情 ContentItem。
     * @returns {void} 协调器 Promise 在后台运行并收敛异常。
     */
    startDetailLineReachabilityPlan(contentItem) {
      // 类型: Array<Readonly<object>>；作用: 纯服务按 Provider 线路顺序生成每线路一个代表目标。
      const plan = createDetailLineReachabilityProbePlan(contentItem?.playCatalog, {
        sourceId: contentItem?.sourceId || '',
        contentId: contentItem?.id || ''
      });
      // 类型: Array<Readonly<object>>；作用: KeepAlive 返回时只继续未知线路，不重复请求已有真实终态。
      const unfinishedPlan = plan.filter(target => !this.isTerminalDetailLineReachabilityStatus(
        this.lineReachabilityStatuses[target.lineId]
      ));
      // 类型: Promise<string>；作用: 后台执行严格单任务计划，不阻塞详情内容和用户目录浏览。
      const operation = this._mediaReachabilityCoordinator.start(unfinishedPlan);
      operation.catch((error) => {
        // 诊断副作用: 只有协调器自身意外失败进入；不展示 Provider 或媒体私有错误。
        console.error('详情线路媒体可达队列异常结束', error);
      });
    },

    /**
     * 根据详情响应、用户历史和跨源恢复上下文初始化目录选择。
     * 副作用: 只更新详情页会话级 browsedLineId 与 selectedEpisodeId，不修改 Router、Store 或历史。
     * 成功路径: 先确定逻辑剧集，再按历史线路、最近线路、Provider 默认和可用线路顺序选择。
     * 失败路径: 历史目标无法在目录精确定位时保留空选择，等待用户手动选集。
     *
     * @param {*} responseItem 本次详情响应 ContentItem。
     * @returns {void} 选择结果写入页面局部状态。
     */
    initializePlayCatalogSelection(responseItem) {
      // 类型: object|null；作用: 详情响应只接受唯一 playCatalog，不从实体旧字段或页面状态拼装目录。
      const playCatalog = responseItem && responseItem.playCatalog
        && typeof responseItem.playCatalog === 'object'
        && !Array.isArray(responseItem.playCatalog)
        ? responseItem.playCatalog
        : null;
      // 类型: Array<object>；作用: 跨源历史定位可以在全部真实线路中寻找同一逻辑剧集。
      const catalogEpisodes = this.collectPlayCatalogEpisodes(playCatalog);
      // 类型: object|null；作用: 跨源恢复只使用冻结 EpisodeLocator 精确匹配，不按列表位置猜测。
      const recoveryEpisode = findUserContentRecoveryEpisode(catalogEpisodes, this.recoveryContext);
      // 类型: object|null；作用: 普通详情读取同一内容最近历史，提供上次逻辑剧集与成功线路偏好。
      const latestPlaybackRecord = this.contentUserStatus.latestPlaybackRecord || null;
      // 类型: string；作用: 跨源恢复匹配优先，其次恢复当前内容最近逻辑剧集；无历史时为空。
      const targetEpisodeId = recoveryEpisode?.id || latestPlaybackRecord?.episodeId || '';
      // 类型: string；作用: 当前恢复记录线路优先；跨源线路不属于新目录时会由选择服务安全跳过。
      const historyLineId = this.recoveryContext?.historyRecord?.playbackSourceId
        || latestPlaybackRecord?.playbackSourceId
        || '';
      // 类型: string；作用: 同一内容最近成功线路作为次级偏好，不覆盖更精确恢复记录。
      const recentLineId = latestPlaybackRecord?.playbackSourceId || '';
      // 类型: string；作用: 由统一服务按冻结优先级选择可浏览线路，空目录返回空身份。
      const initialLineId = resolveInitialPlayCatalogLineId(playCatalog, {
        episodeId: targetEpisodeId,
        historyLineId,
        recentLineId
      });
      // 类型: object|null；作用: 精确读取初始线路，防止目录失效时从数组位置构造状态。
      const initialLine = findPlayCatalogLine(playCatalog, initialLineId);
      // 类型: object|null；作用: 有历史目标时只接受同一逻辑 id；无历史时选择线路首个可播放入口。
      const initialEpisode = targetEpisodeId
        ? findPlayCatalogEpisode(initialLine, targetEpisodeId)
        : initialLine?.episodes?.find(episode => episode && episode.playable !== false) || null;

      // 副作用: 初始化当前详情会话浏览线路；空目录明确清空旧页面选择。
      this.browsedLineId = initialLine?.id || '';
      // 副作用: 只有真实属于初始线路的逻辑剧集进入待播放选择，不回退相邻或末集。
      this.selectedEpisodeId = initialEpisode?.id || '';
    },

    /**
     * 拼接文本数组。
     * 纯函数: 返回新字符串，不修改 parts 数组。
     *
     * 调用位置：actorText。
     * 页面影响：把演员数组整理成页面可读文本。
     *
     * @param {Array} parts 需要拼接的文本片段。
     * @param {string} separator 片段之间使用的分隔符。
     * @returns {string} 过滤空值后的拼接文本。
     */
    joinTextParts(parts, separator) {
      // 条件分支: parts 不是数组时进入。
      // 执行内容: 返回空文本，避免异常值参与拼接。
      if (!Array.isArray(parts)) {
        return '';
      }

      // 过滤空字符串和空值，避免页面出现多余分隔符。
      return parts.filter(Boolean).join(separator);
    },

    /**
     * 请求详情页数据。
     *
     * 调用位置：created 生命周期、详情路由变化监听。
     * 页面影响：通过 sourceDataService 请求 detail 数据桶，成功后模板从 getCurrentContentItem('detail') 渲染。
     * 副作用: 更新 loading/loadError/browsedLineId/selectedEpisodeId，并通过 service 提交详情响应。
     * 成功路径: 按统一目录、历史和恢复上下文初始化线路与逻辑剧集并清空旧错误。
     * 失败路径: 保留安全错误文案；finally 关闭加载状态。
     *
     * @returns {Promise<void>} 请求完成后不返回业务数据。
     */
    async loadDetailContent() {
      // 类型: number；作用: 捕获本次详情请求代次，后续路由、失活或销毁会让它失效。
      const generation = Number(this._detailLoadGeneration || 0) + 1;
      this._detailLoadGeneration = generation;
      // 副作用: 新详情请求优先取消旧内容探测并清空全部线路终态，迟到结果不能覆盖新内容。
      await this._mediaReachabilityCoordinator?.cancel();
      // 条件分支: 等待旧媒体释放期间已经开始新请求或页面失活时进入；执行内容: 不清理新页面状态。
      if (generation !== this._detailLoadGeneration) return;
      this.lineReachabilityStatuses = {};
      // 条件分支: 路由缺少 sourceId 或 videoId 时进入；执行内容: 不调用 Provider，并清空页面目录选择。
      if (!this.hasCompleteRouteIdentity) {
        this.loading = false;
        this.browsedLineId = '';
        this.selectedEpisodeId = '';
        this.loadError = '详情页缺少完整的数据源或内容身份，请从内容列表重新进入。';
        return;
      }

      // 副作用: 打开页面级加载状态，让用户知道详情数据正在刷新。
      this.loading = true;

      // 副作用: 清空旧错误，避免一次失败文案影响后续成功请求。
      this.loadError = '';

      try {
        // 异步请求: 让统一数据服务按 detail 页面和 contentId 请求当前内容。
        // 成功结果: response.item 会被归一化写入实体池，detail.currentKey 保存对应引用。
        // 类型: object；作用: 保存统一数据服务返回的 detail 标准响应。
        const response = await requestSourceData({
          // 类型: string。
          // 作用: 使用详情路由的必填数据源身份，不允许 service 回退活动源。
          sourceId: this.routeSourceId,

          // 类型: string。
          // 作用: 告诉 provider 当前请求详情页单内容数据桶。
          pageKey: 'detail',

          // 类型: object。
          // 作用: 单内容请求参数，contentId 由必填路由身份提供给目标 Provider。
          params: {
            contentId: this.routeVideoId
          }
        });

        // 条件分支: 网络返回前请求代次或严格路由身份已经变化时进入；执行内容: 丢弃迟到响应，不初始化选择或探测。
        if (generation !== this._detailLoadGeneration
          || this.routeSourceId !== response?.item?.sourceId
          || this.routeVideoId !== response?.item?.id) return;

        // 类型: object|null。
        // 作用: 当前响应命中的详情内容，没有命中时使用 null 进入空状态。
        const responseItem = response && response.item ? response.item : null;

        // 副作用: 使用响应自己的统一目录初始化页面会话选择；不从旧平铺字段或缓存别名读取。
        this.initializePlayCatalogSelection(responseItem);

        // 生命周期边界: 等待共享目录和无视觉宿主完成挂载后，再启动不阻塞详情展示的线路代表探测。
        await this.$nextTick();
        // 条件分支: 当前组件仍是可见严格详情且响应实体与路由一致时进入；执行内容: 启动本内容代表探测。
        if (this.hasVideo) this.startDetailLineReachabilityPlan(responseItem);

      } catch (error) {
        // 条件分支: 失败仍属于当前详情请求时进入；执行内容: 保存安全错误文案，迟到失败不覆盖新页面。
        if (generation === this._detailLoadGeneration) {
          this.loadError = error && error.message ? error.message : '详情数据加载失败';
        }
      } finally {
        // 条件分支: 当前请求仍是最新代次时进入；执行内容: 关闭自己的加载遮罩，不提前结束后续请求。
        if (generation === this._detailLoadGeneration) this.loading = false;
      }
    },

    /**
     * 重试当前详情请求。
     * 副作用: 复用当前完整详情路由，再次进入同一 Provider 请求入口；不清理内容缓存或改写路由。
     * 失败路径: 缺少详情身份时保持当前空入口，不构造备用请求。
     *
     * @returns {Promise<void>} 当前详情请求完成后结束。
     */
    retryDetailContent() {
      // 条件分支: 当前没有完整详情身份时进入；执行内容: 保持空入口动作，不发起无目标请求。
      if (!this.hasCompleteRouteIdentity) {
        return Promise.resolve();
      }
      return this.loadDetailContent();
    },

    /**
     * 从详情空状态进入搜索页。
     * 副作用: 只调用 Vue Router，不访问 Provider、Store 或用户内容。
     * 失败路径: 重复导航被忽略，其他 Router 错误继续交给全局处理。
     *
     * @returns {Promise<void>} 导航完成后结束。
     */
    navigateToSearch() {
      return this.navigateFromEmptyState({ name: 'search' });
    },

    /**
     * 从详情空状态返回首页。
     * 副作用: 只调用 Vue Router，不重置详情内容或用户状态。
     *
     * @returns {Promise<void>} 导航完成后结束。
     */
    navigateToHome() {
      return this.navigateFromEmptyState({ name: 'home' });
    },

    /**
     * 执行详情空状态导航。
     * 副作用: 调用 Vue Router push；重复导航保持当前页面，其他错误继续抛出。
     *
     * @param {object} target Vue Router 命名导航目标。
     * @returns {Promise<void>} 导航完成后结束。
     */
    navigateFromEmptyState(target) {
      return this.$router.push(target).catch((error) => {
        // 条件分支: Router 报告目标与当前地址重复时进入；执行内容: 把正常重复点击收敛为已完成。
        if (error && error.name === 'NavigationDuplicated') {
          return undefined;
        }
        throw error;
      });
    },

    /**
     * 采用共享组件发出的线路浏览意图。
     * 副作用: 只更新详情页会话级浏览线路和待播放剧集，不请求媒体、不写路由或历史。
     * 成功路径: 新线路含当前逻辑剧集时保持同集选择；缺集或不可用时清空选择等待手动选集。
     * 失败路径: 线路身份不属于当前目录时保留全部现状。
     *
     * @param {string} lineId 用户选择的 PlayCatalogLine.id。
     * @returns {void} 选择结果写入页面局部状态。
     */
    handleBrowsedLineChange(lineId) {
      // 类型: Readonly<object>；作用: 统一判断线路有效性、可用性和当前逻辑剧集是否存在。
      const decision = decideBrowsedLineChange(this.playCatalog, {
        lineId,
        playingEpisodeId: this.selectedEpisodeId
      });
      // 条件分支: 服务没有定位合法线路时进入；执行内容: 保留现有浏览和选择状态。
      if (!decision.line) return;

      // 副作用: 合法线路始终允许用户查看真实目录，包括不可用和缺集状态。
      this.browsedLineId = decision.line.id;
      // 副作用: 只有目标线路精确包含当前逻辑剧集时保持选中；其他情况等待用户明确选择。
      this.selectedEpisodeId = decision.episode?.id || '';
    },

    /**
     * 采用共享组件发出的手动选集意图。
     * 副作用: 只更新详情页待播放逻辑剧集，不提前导航、请求媒体或创建历史。
     * 成功路径: 当前线路和剧集都可播放时采用完全相同的逻辑身份。
     * 失败路径: 线路不可用、剧集缺失或不可播放时保持原选择。
     *
     * @param {object} target PlayCatalogSelector 发出的结构化选集目标。
     * @returns {void} 合法选择写入页面局部状态。
     */
    handleEpisodeSelection(target) {
      // 类型: Readonly<object>；作用: 统一校验线路、逻辑剧集和可播放状态，不信任组件事件正文对象。
      const decision = decideManualEpisodeSelection(this.playCatalog, {
        lineId: target?.lineId,
        episodeId: target?.episodeId
      });
      // 条件分支: 目标不能解析为合法待播放条目时进入；执行内容: 保留当前选择。
      if (!decision.shouldResolveMedia || !decision.line || !decision.episode) return;

      // 副作用: 采用事件对应线路，保证高亮逻辑剧集始终属于当前浏览目录。
      this.browsedLineId = decision.line.id;
      // 副作用: 保存用户明确选择的逻辑身份，实际媒体和历史仍由播放页成功采用后处理。
      this.selectedEpisodeId = decision.episode.id;
    },

    /**
     * 切换当前详情内容收藏状态。
     * 触发来源: 详情页收藏按钮点击。
     * 副作用: 等待 userContentService 完成 Repository 事务和统一 store 采用。
     * 成功路径: selector 响应式更新后按钮自动显示新状态。
     * 失败路径: 展示安全提示并保持旧按钮状态，不创建页面本地覆盖。
     *
     * @returns {Promise<void>} 收藏事务完成或失败提示展示后结束。
     */
    async handleToggleFavorite() {
      // 条件分支: 当前详情内容缺失时进入。
      // 执行内容: 不写入收藏状态，避免生成无效收藏记录。
      if (!this.video) {
        return;
      }

      try {
        // 异步调用: Repository 提交成功后 service 才采用 store；返回结果无需另存页面状态。
        await toggleFavorite(this.video);
      } catch {
        // 失败处理: 页面继续读取旧 selector 投影，只展示不含保存对象的稳定文案。
        this.$message.error('收藏状态保存失败，请稍后重试');
      }
    },

    /**
     * 播放当前选中分集。
     *
     * 调用位置：详情头图区主播放按钮。
     * 页面影响：跳转到播放页，并携带当前内容、逻辑剧集、明确线路和自动播放意图。
     * 副作用: 先等待详情探测播放器释放，再提交可选用户内容双仓事务，最后构造目标并调用 Vue Router push。
     * 成功路径: 详情探测和正式播放不会重叠占用媒体资源；重绑定后播放页按新身份恢复原进度。
     * 失败路径: 分集、内容身份、探测释放或重绑定失败时保持详情页；非重复 Router 错误继续抛出。
     *
     * @returns {Promise<void>} 重绑定和路由导航完成后结束。
     */
    async playSelectedEpisode() {
      // 条件分支: 当前没有可播放分集时进入。
      // 执行内容: 保持详情页，不构造播放路由。
      if (!this.selectedEpisode) {
        return;
      }

      // 条件分支: 数据源或内容 id 任一缺失时进入。
      // 执行内容: 保持详情页，避免生成无业务目标播放地址。
      if (!this.effectiveSourceId || !this.effectiveVideoId) {
        return;
      }

      try {
        // 资源交接: 用户播放意图优先，必须等待当前无视觉 Xgplayer/HLS 完整释放后再进入播放路由。
        await this._mediaReachabilityCoordinator?.cancel();
      } catch {
        // 失败处理: 详情探测资源没有确认释放时保持当前页，不让正式播放器与旧探测实例重叠。
        this.$message.error('线路检测资源释放失败，请稍后重试');
        return;
      }

      try {
        // 类型: object|null；作用: 冻结本次点击开始时的恢复上下文，避免事务采用后 computed key 消失影响失败判断。
        const recoveryContext = this.recoveryContext;
        // 类型: object|null；作用: 普通详情返回 null，恢复详情只在双仓事务提交后返回新内容与分集身份。
        const recoveryResult = await commitUserContentRecovery(
          recoveryContext,
          this.video,
          this.selectedEpisode
        );
        // 条件分支: 当前存在恢复上下文但记录已失效或无法形成新分集身份时进入。
        // 执行内容: 保持详情页和原用户记录，不进入无法读取原进度的播放器。
        if (recoveryContext && !recoveryResult) {
          this.$message.error('历史记录无法迁移，请重新选择匹配内容');
          return;
        }
      } catch {
        // 失败处理: 原收藏和历史保持不变，不进入播放器以免丢失原进度恢复身份。
        this.$message.error('历史记录迁移失败，请稍后重试');
        return;
      }

      // 类型: object|null。
      // 作用: 使用同一 playCatalog 中的当前线路与逻辑剧集生成完整 player 目标，导航层再次执行精确校验。
      const target = createContentPlaybackNavigationTarget({
        ...this.video,
        sourceId: this.effectiveSourceId,
        id: this.effectiveVideoId
      }, {
        episodeId: this.selectedEpisode.id,
        episodeIndex: this.selectedEpisodeIndex,
        playbackSourceId: this.browsedLineId,
        autoplay: true
      });

      // 条件分支: 统一 service 因内容身份无效拒绝目标时进入。
      // 执行内容: 保持详情页，不回退默认内容或保留页面私有路由算法。
      if (!target) {
        return;
      }

      // 副作用: 执行统一播放器目标；播放页从 params/query 恢复同一内容、分集和线路。
      this.$router.push(target).catch((error) => {
        // 条件分支: 路由失败不是 Vue Router 3 重复导航时进入。
        // 执行内容: 重新抛出真实导航错误；重复导航保持当前页面。
        if (error && error.name !== 'NavigationDuplicated') {
          throw error;
        }
      });
    }
  }
};
</script>

<style scoped>
/*
  详情页最外层容器。
  对应 template 根节点 `.theme-page.detail-view`。
  作用是在通用页面布局基础上，为详情页顶部留出细微距离。
*/
.detail-view {
  /* 顶部留白让详情头图区和全局导航之间不显得太贴。 */
  padding-top: 8px;
}

/*
  详情内容主体。
  对应 template 中 `[if hasVideo]` 的 `.detail-shell`。
  内部只保留 v4 结构里的详情头图区和选集播放区。
*/
.detail-shell {
  /* 使用 grid 让详情头图和选集区按上下顺序排列。 */
  display: grid;

  /* 控制详情头图和选集区之间的纵向距离。 */
  gap: 18px;
}

/*
  详情头图区。
  对应 template 中 `.detail-hero.theme-surface`。
  桌面端布局：左侧固定海报，右侧详情正文。
*/
.detail-hero {
  /* 使用 grid 明确拆成海报列和正文列。 */
  display: grid;

  /* 第一列固定 260px 给海报，第二列吃掉剩余空间。 */
  grid-template-columns: 260px minmax(0, 1fr);

  /* 控制海报和正文之间的横向距离。 */
  gap: 28px;

  /* v4 详情头图留白较大，这里保持接近的呼吸感。 */
  padding: 28px;

  /* 保证头图区域最少有一定高度，避免内容少时卡片显得太扁。 */
  min-height: 420px;
}

/*
  海报容器。
  对应 template 中 `.detail-poster`。
  作用是承载封面图、封面占位和更新状态角标。
*/
.detail-poster {
  /* 让角标可以定位到海报右下角。 */
  position: relative;

  /* 固定 2:3 海报比例，避免不同源封面尺寸导致详情页跳动。 */
  aspect-ratio: 2 / 3;

  /* 限制海报高度，让它接近 v4 截图中的竖向比例。 */
  max-height: 420px;

  /* 封面图按比例裁切时，超出海报框的部分隐藏。 */
  overflow: hidden;

  /* 图片加载前的浅色底，避免空白区域太突兀。 */
  background: #eef2f7;

  /* 细边框给海报一个清晰边界。 */
  border: 1px solid rgba(148, 163, 184, 0.18);

  /* 圆角很小，贴近 v4 的克制卡片风格。 */
  border-radius: 6px;
}

/*
  真实封面图片。
  对应 template 中 `[if video.cover]` 的 `.detail-poster img`。
*/
.detail-poster img {
  /* 宽度铺满海报容器。 */
  width: 100%;

  /* 高度铺满海报容器。 */
  height: 100%;

  /* 图片按块级显示，避免行内图片底部基线空隙。 */
  display: block;

  /* 保持图片比例并裁切填满容器，避免封面被拉伸变形。 */
  object-fit: cover;
}

/*
  无封面海报状态。
  对应 template 中 `:class="{ empty: !video.cover }"`。
  出现条件：详情数据没有封面图。
*/
.detail-poster.empty {
  /* 使用 flex 居中占位文字。 */
  display: flex;

  /* 占位文字垂直居中。 */
  align-items: center;

  /* 占位文字水平居中。 */
  justify-content: center;

  /* 深色渐变让无封面状态更像正式占位。 */
  background: linear-gradient(135deg, #172133 0%, #24334d 100%);
}

/*
  无封面占位文字。
  对应 template 中 `.detail-poster-fallback`。
*/
.detail-poster-fallback {
  /* 字号较大，填补海报区域的视觉空白。 */
  font-size: 44px;

  /* 加粗让占位文字在深色背景上更稳定。 */
  font-weight: 800;

  /* 白色半透明文字避免过亮刺眼。 */
  color: rgba(255, 255, 255, 0.92);
}

/*
  海报角标。
  对应 template 中 `.detail-poster-badge`。
  出现条件：posterBadge 有值。
*/
.detail-poster-badge {
  /* 固定到海报右下角。 */
  position: absolute;

  /* 控制角标距离右侧的位置。 */
  right: 12px;

  /* 控制角标距离底部的位置。 */
  bottom: 12px;

  /* 给角标文字留出内部空间。 */
  padding: 5px 10px;

  /* 深色半透明背景保证角标在海报上可读。 */
  background: rgba(24, 34, 53, 0.82);

  /* 白色文字提高对比度。 */
  color: #fff;

  /* 缩小字号，让角标保持辅助层级。 */
  font-size: 12px;

  /* 胶囊圆角适合短状态标签。 */
  border-radius: 999px;
}

/*
  详情正文区。
  对应 template 中 `.detail-main`。
  内部从上到下排列标签、标题、主演、简介和播放按钮。
*/
.detail-main {
  /* 允许正文列在 grid 中正确缩小，避免长标题撑破布局。 */
  min-width: 0;

  /* 给正文顶部留一点空间，接近 v4 中文字不是紧贴卡片顶边的效果。 */
  padding-top: 4px;
}

/*
  顶部标签区。
  对应 template 中 `.detail-kicker`。
  内部显示来源、年份、地区和评分标签。
*/
.detail-kicker {
  /* 标签横向排列。 */
  display: flex;

  /* 标签在高度方向居中，避免图标和文字错位。 */
  align-items: center;

  /* 控制多个标签之间的距离。 */
  gap: 8px;

  /* 标签较多或屏幕较窄时允许换行。 */
  flex-wrap: wrap;

  /* 标签区和标题之间留出距离。 */
  margin-bottom: 18px;
}

/*
  Element UI 标签微调。
  对应 template 中多个 `.detail-tag`。
*/
.detail-tag {
  /* 统一成胶囊标签，贴近 v4 详情页顶部标签形态。 */
  border-radius: 999px;
}

/*
  来源标签。
  对应 template 中 `.detail-tag.kind-source`。
*/
.detail-tag.kind-source {
  /* 来源标签使用项目主题色，和普通年份、地区标签区分。 */
  color: var(--accent);

  /* 主题色浅边框让来源标签更醒目。 */
  border-color: rgba(91, 140, 255, 0.28);

  /* 浅主题背景表示它是当前页面关键状态。 */
  background: rgba(91, 140, 255, 0.08);
}

/*
  评分标签。
  对应 template 中 `.detail-tag.kind-rating`。
*/
.detail-tag.kind-rating {
  /* 评分使用暖色，符合用户对评分信息的直觉识别。 */
  color: #d97706;
}

/*
  详情主标题。
  对应 template 中 `.detail-title`。
*/
.detail-title {
  /* 去掉 h1 默认 margin，避免和自定义间距叠加。 */
  margin: 0;

  /* 字号贴近 v4 详情页大标题。 */
  font-size: clamp(34px, 3.4vw, 46px);

  /* 标题行高收紧，避免多行标题显得松散。 */
  line-height: 1.12;

  /* 加粗突出视频标题。 */
  font-weight: 800;

  /* 主标题使用最高层级文字色。 */
  color: var(--text-primary);
}

/*
  视频别名。
  对应 template 中 `[if displayAlias]` 的 `.detail-alias`。
*/
.detail-alias {
  /* 控制别名和主标题之间的距离。 */
  margin: 8px 0 0;

  /* 弱文字色表示它不是主标题。 */
  color: var(--text-muted);

  /* 别名字号小于主标题。 */
  font-size: 15px;
}

/*
  核心元信息行。
  对应 template 中 `.detail-meta-line`。
  当前用于展示“主演”这种 v4 详情页中的紧凑信息。
*/
.detail-meta-line {
  /* 使用 flex 横向排列字段名和值。 */
  display: flex;

  /* 垂直方向对齐字段名和值。 */
  align-items: center;

  /* 控制字段名和值之间的距离。 */
  gap: 22px;

  /* 控制元信息和标题之间的距离。 */
  margin-top: 24px;
}

/*
  元信息字段名。
  对应 template 中 `.detail-label`。
*/
.detail-label {
  /* 字段名使用弱文字色，避免和具体内容抢层级。 */
  color: var(--text-muted);

  /* 字段名字号略小，符合辅助标签定位。 */
  font-size: 14px;
}

/*
  元信息具体内容。
  对应 template 中 `.detail-value`。
*/
.detail-value {
  /* 内容使用次级正文色，比字段名更明显。 */
  color: var(--text-secondary);

  /* 元信息内容字号保持正文辅助层级。 */
  font-size: 14px;

  /* 行高放宽，长演员列表换行时更容易阅读。 */
  line-height: 1.8;
}

/*
  视频简介。
  对应 template 中 `.detail-summary`。
*/
.detail-summary {
  /* 控制简介和主演信息之间的距离。 */
  margin: 24px 0 0;

  /* 简介使用次级正文色，不抢标题层级。 */
  color: var(--text-secondary);

  /* 简介字号保持正文阅读大小。 */
  font-size: 15px;

  /* 行高放宽，长简介多行阅读更舒服。 */
  line-height: 1.9;

  /* 限制简介宽度，避免文字铺满整行不好读。 */
  max-width: 980px;
}

/*
  详情操作区。
  对应 template 中 `.detail-actions`。
*/
.detail-actions {
  /* 控制播放按钮和简介之间的距离，贴近 v4 中按钮位置。 */
  margin-top: 26px;

  /* 按钮默认横向排列。 */
  display: flex;

  /* 多个按钮在高度方向居中。 */
  align-items: center;

  /* 控制操作按钮之间的距离。 */
  gap: 12px;

  /* 手机或按钮文字较长时允许换行。 */
  flex-wrap: wrap;
}

/*
  作用容器: 详情页统一播放目录宿主 `.detail-play-catalog`。
  样式作用:
  给共享 PlayCatalogSelector 提供宽内容区内边距。
  保证子组件容器查询读取真实可用宽度且不会被长线路名称撑破。
*/
.detail-play-catalog {
  /* 给统一目录组件保留详情页表面内边距，组件自身负责内部响应式布局。 */
  padding: 28px;

  /* 允许共享组件在 Grid 宿主中收缩，防止长线路或剧集标签撑宽页面。 */
  min-width: 0;
}

/*
  整页空状态。
  对应 template 中 `[else]` 的 `.detail-page-empty.theme-surface`。
*/
.detail-page-empty {
  /* 提高整页空状态高度，避免页面显得塌陷。 */
  min-height: 420px;

  /* 使用 flex 让 Element UI 空状态内容居中。 */
  display: flex;

  /* 水平方向居中。 */
  align-items: center;

  /* 垂直方向居中。 */
  justify-content: center;

  /* 让状态说明和恢复按钮形成稳定的纵向操作区。 */
  flex-direction: column;

  /* 为不同状态下的操作按钮保留一致间距。 */
  gap: 8px;
}

/*
  详情空状态操作区。
  对应 template 中 `.detail-empty-actions`。
  作用：把重试、搜索和首页动作保持在同一可扫描行内，不改变详情主体布局。
*/
.detail-empty-actions {
  /* 多按钮在窄屏下允许换行，避免动作文字互相挤压。 */
  display: flex;

  /* 保留按钮之间的稳定水平间距。 */
  gap: 8px;

  /* 移动端宽度不足时让每个动作自然换到下一行。 */
  flex-wrap: wrap;

  /* 操作区在空状态中保持整体居中。 */
  justify-content: center;
}

/*
  平板端详情布局。
  触发条件：视口宽度不超过 900px。
  原因：260px 海报列加正文列在平板宽度下容易挤压正文。
*/
@media (max-width: 900px) {
  .detail-hero {
    /* 改成单列后，海报在上、正文在下，阅读顺序更自然。 */
    grid-template-columns: 1fr;
  }

  .detail-poster {
    /* 单列模式下限制海报最大宽度，避免海报铺满整行。 */
    max-width: 240px;
  }

}

/*
  手机端详情布局。
  触发条件：视口宽度不超过 640px。
  调整目标：减少边距、压缩标题字号，并让分集按钮更适合窄屏。
*/
@media (max-width: 640px) {
  .detail-hero,
  .detail-play-catalog {
    /* 手机端收紧头图区和选集区内边距，把更多空间留给正文。 */
    padding: 16px;
  }

  .detail-title {
    /* 手机端标题字号缩小，避免长片名在窄屏下一行只有很少字。 */
    font-size: 24px;
  }

  .detail-meta-line {
    /* 手机端主演信息改成上下排列，避免字段名挤压内容。 */
    flex-direction: column;

    /* 手机端左对齐字段名和值。 */
    align-items: flex-start;

    /* 缩小字段名和值之间的间距。 */
    gap: 4px;
  }

}
</style>
