<template>
  <!--
    DetailView 页面渲染树

    [DEFAULT] ele(div.theme-page.detail-view)
    │  - condition:
    │      默认渲染；loading 为 true 时由 v-loading 展示加载遮罩。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      详情页根容器。
    │      根据是否取得 video 切换完整详情和整页空状态。
    │  - params:
    │      -- loading：详情请求进行状态。
    │      -- video：当前标准内容详情对象。
    │  - events: 无
    │
    ├─ [IF hasVideo] ele(div.detail-shell)
    │  - condition:
    │      video 存在且可用于展示时渲染。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      详情内容壳层。
    │      依次承载详情头图区和分集选择区。
    │  - params:
    │      -- video：当前内容详情。
    │      -- episodes：当前内容的标准分集列表。
    │  - events: 无
    │
    │  ├─ [DEFAULT] ele(section.detail-hero)
    │  │  - condition:
    │  │      hasVideo 成立时默认渲染。
    │  │  - type:
    │  │      原生标签
    │  │      标签名称: section
    │  │  - description:
    │  │      详情头图区。
    │  │      展示海报、内容字段、播放入口和收藏入口。
    │  │  - params:
    │  │      -- video：详情展示字段来源。
    │  │      -- selectedEpisode：当前选中的播放分集。
    │  │  - events: 无
    │  │
    │  │  ├─ [DEFAULT] ele(div.detail-poster)
    │  │  │  - condition:
    │  │  │      hasVideo 成立时默认渲染；内部按 posterImage 切换封面和文字占位。
    │  │  │  - type:
    │  │  │      原生标签
    │  │  │      标签名称: div
    │  │  │  - description:
    │  │  │      详情海报区。
    │  │  │      同时承载可选的内容状态角标。
    │  │  │  - params:
    │  │  │      -- posterImage：可用封面地址。
    │  │  │      -- posterBadge：质量或更新状态文本。
    │  │  │  - events: 无
    │  │  │
    │  │  └─ [DEFAULT] ele(div.detail-main)
    │  │     - condition:
    │  │         hasVideo 成立时默认渲染。
    │  │     - type:
    │  │         原生标签
    │  │         标签名称: div
    │  │     - description:
    │  │         详情正文区。
    │  │         展示来源、标题、元信息和简介，并提供播放及收藏操作。
    │  │     - params:
    │  │         -- video：详情字段来源。
    │  │         -- selectedEpisode：播放按钮目标分集。
    │  │         -- isFavorite：当前内容收藏状态。
    │  │     - events:
    │  │         @click
    │  │             - description:
    │  │                 用户点击播放或收藏按钮时执行对应操作。
    │  │             - methods:
    │  │                 playSelectedEpisode()
    │  │                 handleToggleFavorite()
    │  │
    │  └─ [DEFAULT] ele(section.detail-episodes)
    │     - condition:
    │         hasVideo 成立时默认渲染；内部按 hasEpisodes 切换列表和空状态。
    │     - type:
    │         原生标签
    │         标签名称: section
    │     - description:
    │         分集选择区。
    │         循环展示 episodes，并把用户选择写入 selectedEpisodeId。
    │     - params:
    │         -- episodes：标准分集列表。
    │         -- selectedEpisodeId：当前选中的分集 id。
    │     - events:
    │         @click
    │             - description:
    │                 用户点击分集按钮时选择该分集。
    │             - methods:
    │                 selectEpisode(episode)
    │                     -- episode：被选择的标准分集对象。
    │
    └─ [ELSE] ele(el-empty.detail-page-empty)
       - condition:
           hasVideo 不成立时渲染。
       - type:
           第三方组件
           组件库: Element UI
           组件名称: el-empty
       - description:
           详情页空状态。
           优先显示 loadError，否则说明当前没有可展示的详情数据。
       - params:
           -- description：loadError 或固定空状态说明。
       - events: 无
  -->
  <!--
    [DEFAULT] ele(div.theme-page.detail-view)
    - condition: 默认渲染；loading 为 true 时展示加载遮罩。
    - type: 原生标签；标签名称: div。
    - description: 详情页根容器；切换详情内容和整页空状态。
    - params: -- loading：请求状态；-- video：当前详情对象。
    - events: 无。
  -->
  <div class="theme-page detail-view" v-loading="loading">
    <!--
      [IF hasVideo] ele(div.detail-shell)
      - condition: 已取得可展示的 video 时渲染。
      - type: 原生标签；标签名称: div。
      - description: 详情内容壳层；承载头图区和分集区。
      - params: -- video：详情对象；-- episodes：标准分集列表。
      - events: 无。
    -->
    <div v-if="hasVideo" class="detail-shell">
      <!--
        [DEFAULT] ele(section.detail-hero)
        - condition: hasVideo 成立时默认渲染。
        - type: 原生标签；标签名称: section。
        - description: 详情头图区；展示海报、核心字段、播放入口和收藏入口。
        - params: -- video：详情字段来源；-- selectedEpisode：播放目标分集。
        - events: 无。
      -->
      <section class="detail-hero theme-surface">
        <!--
          [DEFAULT] ele(div.detail-poster)
          - condition: hasVideo 成立时默认渲染；内部按 posterImage 切换封面和占位。
          - type: 原生标签；标签名称: div。
          - description: 详情海报区；展示封面或标题占位，并承载可选状态角标。
          - params: -- posterImage：封面地址；-- posterBadge：质量或更新状态。
          - events: 无。
        -->
        <div class="detail-poster" :class="{ empty: !posterImage }">
          <!-- 封面图，优先读取统一内容对象的 cover，再回退到 poster。 -->
          <img v-if="posterImage" :src="posterImage" :alt="video.title">

          <!-- 无封面占位，避免详情页左侧区域空白。 -->
          <div v-else class="detail-poster-fallback">{{ posterFallback }}</div>

          <!-- 更新状态角标，通常用于展示“更新至几集”或清晰度信息。 -->
          <span v-if="posterBadge" class="detail-poster-badge">{{ posterBadge }}</span>
        </div>

        <!--
          [DEFAULT] ele(div.detail-main)
          - condition: hasVideo 成立时默认渲染。
          - type: 原生标签；标签名称: div。
          - description: 详情正文区；集中展示标签、标题、元信息、简介和主操作。
          - params: -- video：详情字段；-- selectedEpisode：播放目标；-- isFavorite：收藏状态。
          - events: 内部按钮调用 playSelectedEpisode() 或 handleToggleFavorite()。
        -->
        <div class="detail-main">
          <!--
            顶部标签区。
            使用数据：sourceName、video.year、video.area、displayRating。
            页面作用：使用紧凑标签样式，只保留核心扫读信息。
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

          <!-- 路由目标提示，只在 URL 带 sourceId 或 videoId 时展示，用于确认详情页入参边界。 -->
          <p v-if="hasRouteTarget" class="detail-route-context">{{ routeTargetText }}</p>

          <!--
            核心元信息行。
            使用紧凑形式，把主演作为详情页主信息展示。
          -->
          <div class="detail-meta-line">
            <span class="detail-label">主演</span>
            <span class="detail-value">{{ actorText }}</span>
          </div>

          <!-- 简介区，没有简介时显示统一占位文案。 -->
          <p class="detail-summary">{{ displaySummary }}</p>

          <!--
            操作区。
            当前项目点击播放入口会跳转到带 sourceId/videoId、分集 query 和 autoplay 意图的播放页。
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
        [DEFAULT] ele(section.detail-episodes)
        - condition: hasVideo 成立时默认渲染；内部按 hasEpisodes 切换列表和空状态。
        - type: 原生标签；标签名称: section。
        - description: 分集选择区；展示标题、说明和可选择的标准分集列表。
        - params: -- episodes：分集列表；-- selectedEpisodeId：当前分集 id。
        - events: 内部分集按钮 @click 调用 selectEpisode(episode)。
      -->
      <section class="detail-episodes theme-surface" aria-label="分集列表">
        <!-- 分集区标题和说明。 -->
        <div class="detail-section-head">
          <div>
            <h2 class="detail-section-title">选集播放</h2>
            <p class="detail-section-desc">支持按线路切换并从指定集数进入播放页</p>
          </div>
        </div>

        <!--
          [IF hasEpisodes] ele(div.episode-grid)
          - condition: episodes 至少包含一个分集时渲染。
          - type: 原生标签；标签名称: div。
          - description: 分集按钮列表；按 episodes 顺序循环展示并标识当前选择。
          - params: -- episode：当前分集对象；-- selectedEpisodeId：当前分集 id。
          - events: @click 调用 selectEpisode(episode)。
        -->
        <div v-if="hasEpisodes" class="episode-grid">
          <button
            v-for="episode in episodes"
            :key="episode.id || episode.value"
            type="button"
            class="episode-chip"
            :class="{ active: episode.id === selectedEpisodeId }"
            @click="selectEpisode(episode)"
          >
            <span class="episode-label">{{ episode.label }}</span>
            <span class="episode-title">{{ episode.title || episode.description || episode.duration || '可播放' }}</span>
          </button>
        </div>

        <!--
          [ELSE] ele(el-empty)
          - condition: hasEpisodes 不成立时渲染。
          - type: 第三方组件；组件库: Element UI；组件名称: el-empty。
          - description: 分集局部空状态；没有可展示分集时保留分集区结构。
          - params: -- description：固定的分集无数据说明。
          - events: 无。
        -->
        <el-empty v-else description="当前详情没有可展示的分集" />
      </section>
    </div>

    <!--
      [ELSE] ele(el-empty.detail-page-empty)
      - condition: hasVideo 不成立时渲染。
      - type: 第三方组件；组件库: Element UI；组件名称: el-empty。
      - description: 详情页空状态；优先展示 loadError，否则显示固定无数据说明。
      - params: -- description：loadError 或固定空状态文本。
      - events: 无。
    -->
    <el-empty
      v-else
      class="detail-page-empty theme-surface"
      :description="loadError || '当前没有可展示的视频详情数据'"
    />
  </div>
</template>

<script>
/*
  DetailView.vue 模块说明

  - 文件职责:
      根据路由内容身份请求并渲染详情、收藏状态和分集列表。
      通过统一 service 和 selector 读写内容，不解释具体数据源的原始响应。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      requestSourceData: 自定义服务，请求详情页 detail 数据桶并写入内容共享池。
      getCurrentContentItem/getActiveSourceId: 自定义 selector，读取详情页当前内容和当前数据源。
      getContentUserStatus: 自定义 selector，读取当前内容收藏和播放状态。
      toggleFavorite: 自定义服务，切换当前内容收藏状态。

  - 模块级常量:
      DEFAULT_DETAIL_CONTENT_ID: string，详情页缺少路由 videoId 时使用的预览内容 id。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      DetailView: Vue 路由页面组件，供 detail 路由展示单个内容详情。
*/

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 详情页进入时请求 detail 数据桶，并把响应写入 detail.currentKey，页面通过 getCurrentContentItem('detail') 读取。
import { requestSourceData } from '../services/sourceDataService.js';

import {
  // 导入来源: ../store/siteContentStore。
  // 导入内容: getCurrentContentItem 单内容桶 selector。
  // 文件作用: 详情页通过 selector 从 detail.currentKey 解析完整 ContentItem。
  getCurrentContentItem,

  // 导入来源: ../store/siteContentStore。
  // 导入内容: getActiveSourceId 当前数据源 selector。
  // 文件作用: 详情页通过 selector 获取路由缺失 sourceId 时的数据源兜底值。
  getActiveSourceId
} from '../store/siteContentStore.js';

// 导入来源: ../selectors/userContentSelectors。
// 导入内容: getContentUserStatus 用户内容状态 selector。
// 文件作用: 用于让详情页读取当前内容收藏状态，并和列表页卡片保持同步。
import { getContentUserStatus } from '../selectors/userContentSelectors.js';

// 导入来源: ../services/userContentService。
// 导入内容: toggleFavorite 收藏切换服务。
// 文件作用: 用于让详情页收藏按钮写入用户内容运行时状态。
import { toggleFavorite } from '../services/userContentService.js';

// 类型: string。
// 作用: 详情页没有路由 videoId 时使用的 mock 预览内容 id，保证导航栏直接进入详情页也有静态展示。
const DEFAULT_DETAIL_CONTENT_ID = 'movie-001';

export default {
  // 组件名称用于在调试工具和报错信息中识别详情页。
  name: 'DetailView',

  /**
   * 创建详情页加载、错误、分集选择和收藏交互状态。
   * 纯函数: 为每个详情页实例返回独立对象，不修改 store 或路由参数。
   *
   * @returns {object} 详情页响应式状态。
   * @returns {boolean} return.loading true 显示加载遮罩，false 显示详情或错误状态。
   * @returns {string} return.selectedEpisodeId 当前选中分集标识。
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
      // selectedEpisodeId 作用: 表示当前选中的分集按钮，影响按钮 active 状态和播放按钮文案。
      selectedEpisodeId: '',

      // localFavoriteOverride 类型: boolean|null。
      // localFavoriteOverride 作用: 收藏按钮点击后立刻覆盖当前页视觉状态；null 表示继续使用 selector 状态。
      localFavoriteOverride: null
    };
  },

  /**
   * Vue created 生命周期。
   * 副作用: 组件创建后请求当前路由目标，并将标准响应写入 detail 数据桶。
   *
   * @returns {void} 生命周期钩子只启动异步请求，不返回业务数据。
   */
  created() {
    // 生命周期时机: 详情页组件创建后执行。
    // 执行内容: 请求当前路由目标的详情数据，并写入统一 detail 数据桶。
    this.loadDetailContent();
  },

  watch: {
    /**
     * 监听详情页完整路由变化。
     * 执行时机: sourceId 或 videoId 等路由信息变化时触发。
     * 页面影响: 从新路由重新请求 detail.currentKey，保证卡片跳转到不同详情时内容同步刷新。
     *
     * @returns {void} 只触发详情数据请求，不返回业务数据。
     * 副作用: 路由目标变化后重新请求详情内容并更新 detail 数据桶。
     */
    '$route.fullPath'() {
      // 路由变化后重新请求详情数据，避免复用组件实例时继续展示旧内容。
      this.loadDetailContent();
    }
  },

  computed: {
    /**
     * 当前详情页统一内容对象。
     *
     * @returns {Object|null} 当前 ContentItem；尚未加载或未命中时为 null。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    video() {
      // 返回值类型: Object|null。
      // 作用: 通过统一 selector 从 detail.currentKey 读取实体池中的完整 ContentItem。
      return getCurrentContentItem('detail');
    },

    /**
     * 当前视频来源对象。
     *
     * @returns {Object|null} ContentItem.source 对象；缺失时为 null。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    source() {
      // source 是统一 ContentItem 的来源扩展字段，当前用于显示来源名称。
      return this.video && this.video.source ? this.video.source : null;
    },

    /**
     * 当前视频分集列表。
     *
     * @returns {Array} ContentItem.episodes 数组；缺失时返回空数组。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    episodes() {
      // episodes 是统一 ContentItem 的播放入口列表，电影通常只有一个正片分集。
      return this.asList(this.video && this.video.episodes);
    },

    /**
     * 当前请求使用的内容 id。
     *
     * @returns {string} 优先使用路由 videoId，没有时回退到详情页默认预览内容。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    contentIdForRequest() {
      // 导航栏直接进入 `/detail` 时没有 videoId，用默认 mock 内容维持静态阶段可看效果。
      return this.routeVideoId || DEFAULT_DETAIL_CONTENT_ID;
    },

    /**
     * 当前详情页路由中的数据源 id。
     *
     * @returns {string} URL params 中的 sourceId，没有时返回空字符串。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    routeSourceId() {
      // sourceId 来自 `/detail/:sourceId?/:videoId?`，后续详情数据请求会以它选择目标数据源。
      return this.asText(this.$route.params.sourceId).trim();
    },

    /**
     * 当前详情页路由中的视频 id。
     *
     * @returns {string} URL params 中的 videoId，没有时返回空字符串。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    routeVideoId() {
      // videoId 来自 `/detail/:sourceId?/:videoId?`，后续详情数据请求会以它定位目标视频。
      return this.asText(this.$route.params.videoId).trim();
    },

    /**
     * 详情页是否带有路由目标参数。
     *
     * @returns {boolean} sourceId 或 videoId 任一存在时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    hasRouteTarget() {
      return Boolean(this.routeSourceId || this.routeVideoId);
    },

    /**
     * 详情页路由目标展示文案。
     *
     * @returns {string} 面向用户和开发调试的当前入参说明。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    routeTargetText() {
      // 类型: string。
      // 作用: 优先展示 URL 中的 sourceId，缺失时回退 store 当前源或默认文案。
      const sourceText = this.routeSourceId || getActiveSourceId() || '默认来源';

      // 类型: string。
      // 作用: 优先展示 URL 中的 videoId，缺失时使用当前详情请求内容标识。
      const videoText = this.routeVideoId || this.contentIdForRequest;

      // 把两个路由入参合并成一行轻量提示，避免新增复杂状态区。
      return `路由目标：${sourceText} / ${videoText}`;
    },

    /**
     * 播放跳转使用的数据源 id。
     *
     * @returns {string} 优先使用路由 sourceId，没有时回退到详情数据中的 sourceId。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    effectiveSourceId() {
      // 路由参数优先，保证用户从 URL 进入详情页后继续播放时参数不会丢失。
      return this.routeSourceId || (this.video && this.video.sourceId) || getActiveSourceId() || '';
    },

    /**
     * 播放跳转使用的视频 id。
     *
     * @returns {string} 优先使用路由 videoId，没有时回退到详情数据中的 video.id。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    effectiveVideoId() {
      // 路由参数优先，保证详情页到播放页的路径和当前 URL 目标一致。
      return this.routeVideoId || (this.video && this.video.id) || '';
    },

    /**
     * 是否有详情主体数据。
     *
     * @returns {boolean} video 有值时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    hasVideo() {
      return Boolean(this.video);
    },

    /**
     * 是否有可展示分集。
     *
     * @returns {boolean} episodes 至少有一项时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    hasEpisodes() {
      return this.episodes.length > 0;
    },

    /**
     * 视频是否有评分。
     *
     * @returns {boolean} score 有值时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    hasRating() {
      return Boolean(this.video && this.video.score);
    },

    /**
     * 详情页海报图片。
     *
     * 页面位置：海报区封面图。
     *
     * @returns {string} 优先返回 cover，没有时返回 poster。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    posterImage() {
      // cover 更适合详情大图，poster 作为列表海报字段在详情页兜底使用。
      return this.video ? this.video.cover || this.video.poster || '' : '';
    },

    /**
     * 海报角标文案。
     *
     * 页面位置：海报区右上角角标。
     *
     * @returns {string} 角标、清晰度或电视剧更新状态。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    posterBadge() {
      // badge 是页面优先展示的标签，quality 和 tv.updateStatus 用于补足常见视频角标。
      return this.video ? this.video.badge || this.video.quality || (this.video.tv && this.video.tv.updateStatus) || '' : '';
    },

    /**
     * 视频别名展示文本。
     *
     * 页面位置：标题下方别名行。
     *
     * @returns {string} aliases 数组拼接文本。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    displayAlias() {
      // aliases 是统一内容对象的别名数组，过滤空值后用斜杠拼接展示。
      return this.video ? this.joinTextParts(this.video.aliases, ' / ') : '';
    },

    /**
     * 封面缺失时的占位文案。
     *
     * 页面位置：海报区 `.detail-poster-fallback`。
     *
     * @returns {string} 视频标题前两个字。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    posterFallback() {
      // 类型: string。
      // 作用: 读取标题并在缺失时用“视频”兜底，供无封面占位区生成简写。
      const title = this.video && this.video.title ? this.video.title : '视频';

      // 只取前两个字，保证占位文本不会撑破封面区。
      return title.slice(0, 2).toUpperCase();
    },

    /**
     * 页面展示用评分文案。
     *
     * 页面位置：顶部评分标签。
     *
     * @returns {string} 有评分时返回评分，没有评分时返回“暂无评分”。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    displayRating() {
      // 条件分支: 当前详情数据未存在时进入。
      // 执行内容: 返回空文本，让模板隐藏评分内容。
      if (!this.video) {
        return '';
      }

      // 有 score 显示具体分数，没有 score 用稳定占位文案。
      return this.video.score ? `${this.video.score} 分` : '暂无评分';
    },

    /**
     * 视频简介最终展示文本。
     *
     * 页面位置：详情正文区 `.detail-summary`。
     *
     * @returns {string} 简介或兜底文案。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    displaySummary() {
      // 条件分支: 当前详情数据未存在时进入。
      // 执行内容: 返回空文本，避免读取描述字段时发生异常。
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
     *
     * 页面位置：顶部来源标签。
     *
     * @returns {string} 来源名称或兜底文案。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    sourceName() {
      // 条件分支: 统一 ContentItem.source 存在可读 name 时进入。
      // 执行内容: 返回数据源展示名称，供详情顶部标签渲染。
      if (this.source && this.source.name) {
        return this.source.name;
      }

      // 没有来源对象时给出明确占位。
      return '暂无来源';
    },

    /**
     * 演员文本。
     *
     * 页面位置：核心元信息行。
     *
     * @returns {string} 演员拼接文本或兜底文案。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    actorText() {
      // 条件分支: 当前详情数据未存在时进入。
      // 执行内容: 返回演员占位文案，保持详情元信息行稳定。
      if (!this.video) {
        return '暂无演员信息';
      }

      // detail.actors 是统一内容对象中的演员列表。
      return this.joinTextParts(this.video.detail && this.video.detail.actors, ' / ') || '暂无演员信息';
    },

    /**
     * 当前选中的分集。
     *
     * 页面位置：播放按钮文案和分集按钮 active 状态。
     *
     * @returns {Object|null} 当前分集对象。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    selectedEpisode() {
      // 类型: object|undefined。
      // 作用: 按 selectedEpisodeId 查找用户当前选中的分集对象。
      const matchedEpisode = this.episodes.find(episode => episode.id === this.selectedEpisodeId);

      // 找不到时回退到第一集，避免播放按钮没有目标。
      return matchedEpisode || this.episodes[0] || null;
    },

    /**
     * 当前详情内容的用户内容状态。
     * 数据来源: userContentStore，经 getContentUserStatus selector 读取。
     *
     * @returns {Object} 收藏、最近播放和当前播放状态聚合对象。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    contentUserStatus() {
      // 返回值类型: object。
      // 作用: 详情页不直接读取 userContentStore 内部结构，统一走 selector。
      return getContentUserStatus(this.video);
    },

    /**
     * 当前详情内容是否已收藏。
     *
     * @returns {boolean} true 表示已收藏，false 表示未收藏。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    isFavorite() {
      // 条件分支: 当前页面本轮点击过收藏按钮时进入。
      // 执行内容: 使用本地覆盖值，确保按钮点击后立即反馈。
      if (this.localFavoriteOverride !== null) {
        return this.localFavoriteOverride;
      }

      // 返回值类型: boolean。
      // 作用: 使用用户内容 selector 状态驱动详情页收藏按钮。
      return Boolean(this.contentUserStatus.favorite);
    },

    /**
     * 收藏按钮图标。
     *
     * @returns {string} Element UI 图标类名。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    favoriteButtonIcon() {
      // 返回值类型: string。
      // 作用: 已收藏显示实心星标，未收藏显示空心星标。
      return this.isFavorite ? 'el-icon-star-on' : 'el-icon-star-off';
    },

    /**
     * 收藏按钮文案。
     *
     * @returns {string} 收藏按钮当前状态文案。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    favoriteButtonText() {
      // 返回值类型: string。
      // 作用: 文案跟随收藏状态变化，让用户知道再次点击会取消收藏。
      return this.isFavorite ? '已收藏' : '收藏';
    },

    /**
     * 当前选中分集在播放页 query 中使用的序号。
     *
     * @returns {number|null} 分集序号；电影或缺失时返回 null。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
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

      // 类型: number。
      // 作用: 优先读取数据源清洗后的 episodeNumber，其次读取 index 字段。
      const episodeIndex = Number(episode.episodeNumber || episode.index || episode.episodeIndex);

      // 返回值类型: number|null。
      // 作用: 有效集数返回数字，异常时返回 null。
      return Number.isFinite(episodeIndex) && episodeIndex > 0 ? episodeIndex : null;
    }
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     *
     * 调用位置：data 初始化 episodes、computed 整理演员列表。
     * 页面影响：保证分集区和演员文本永远消费数组。
     *
     * @param {*} value 可能来自详情页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    asList(value) {
      // 条件分支: value 是真正数组时进入。
      // 执行内容: 返回原数组，保留已经标准化的列表内容。
      if (Array.isArray(value)) {
        return value;
      }

      // 非数组统一兜底为空数组，让页面进入对应空状态。
      return [];
    },

    /**
     * 把任意值整理成字符串。
     *
     * 调用位置：routeSourceId、routeVideoId。
     * 页面影响：保证路由参数进入页面后始终以字符串形态参与展示和跳转。
     *
     * @param {*} value 可能来自路由 params 的任意值。
     * @returns {string} 字符串原样返回，其他值统一转为空字符串。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    asText(value) {
      // 条件分支: value 是字符串时进入。
      // 执行内容: 返回原文本，保留标准路由参数。
      if (typeof value === 'string') {
        return value;
      }

      // 非字符串统一转为空，避免页面展示 undefined 或 null。
      return '';
    },

    /**
     * 获取默认选中分集 id。
     *
     * 调用位置：data 初始化 selectedEpisodeId。
     * 页面影响：进入详情页时，分集区默认选中 active 分集或第一集。
     *
     * @param {Array} episodes 分集列表。
     * @returns {string} 默认分集 id。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    getDefaultEpisodeId(episodes) {
      // 类型: object|undefined。
      // 作用: 查找数据源标记为 active 的默认分集。
      const activeEpisode = episodes.find(episode => episode && episode.active);

      // 类型: object|undefined。
      // 作用: 优先使用 active 分集，缺失时回退列表第一项。
      const fallbackEpisode = activeEpisode || episodes[0];

      // id 是按钮 active 判断的主字段，没有 id 时用 value 兜底。
      return fallbackEpisode ? fallbackEpisode.id || fallbackEpisode.value || '' : '';
    },

    /**
     * 拼接文本数组。
     *
     * 调用位置：actorText。
     * 页面影响：把演员数组整理成页面可读文本。
     *
     * @param {Array} parts 需要拼接的文本片段。
     * @param {string} separator 片段之间使用的分隔符。
     * @returns {string} 过滤空值后的拼接文本。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    joinTextParts(parts, separator) {
      // 条件分支: parts 不是数组时进入。
      // 执行内容: 返回空文本，避免异常值进入字符串拼接流程。
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
     *
     * @returns {Promise<void>} 请求完成后不返回业务数据。
     * 副作用: 更新详情页加载与错误状态，通过 sourceDataService 写入 detail 数据桶，并同步默认分集。
     * 成功路径: 请求成功后 detail 数据桶可供 selector 读取，并同步默认分集与收藏按钮状态。
     * 失败路径: 请求或解析失败时捕获错误并写入 loadError；finally 始终关闭 loading，不向生命周期调用方继续抛错。
     */
    async loadDetailContent() {
      // 副作用: 打开页面级加载状态，让用户知道详情数据正在刷新。
      this.loading = true;

      // 副作用: 清空旧错误，避免一次失败文案影响后续成功请求。
      this.loadError = '';

      try {
        // 类型: object。
        // 作用: 保存 detail 页面的标准数据响应，response.item 已归一化写入实体池。
        const response = await requestSourceData({
          // 类型: string|undefined。
          // 作用: URL 中携带 sourceId 时使用指定数据源，没有时由 service 回退当前 activeSourceId。
          sourceId: this.routeSourceId || undefined,

          // 类型: string。
          // 作用: 告诉 provider 当前请求详情页单内容数据桶。
          pageKey: 'detail',

          // 类型: object。
          // 作用: 单内容请求参数，contentId 用于在 mock 内容池或外部数据源结果中定位详情目标。
          params: {
            contentId: this.contentIdForRequest
          }
        });

        // 类型: object|null。
        // 作用: 当前响应命中的详情内容，没有命中时使用 null 进入空状态。
        const responseItem = response && response.item ? response.item : null;

        // 类型: Array<object>。
        // 作用: 从响应内容中读取分集列表，用于决定默认选中哪一集。
        const nextEpisodes = this.asList(responseItem && responseItem.episodes);

        // 副作用: 每次新详情数据返回后，重置选中分集到 active 分集或第一集。
        this.selectedEpisodeId = this.getDefaultEpisodeId(nextEpisodes);

        // 副作用: 新详情内容进入后清空收藏本地覆盖状态，让按钮重新跟随 selector。
        this.localFavoriteOverride = null;
      } catch (error) {
        // 副作用: 保存错误文案，交给整页空状态展示。
        this.loadError = error && error.message ? error.message : '详情数据加载失败';
      } finally {
        // 副作用: 请求结束后关闭加载遮罩，无论成功失败都恢复页面交互。
        this.loading = false;
      }
    },

    /**
     * 选择分集。
     *
     * 调用位置：分集按钮点击。
     * 页面影响：更新 selectedEpisodeId，让按钮 active 状态和播放按钮文案同步变化。
     *
     * @param {Object} episode 用户点击的分集对象。
     * @returns {void} 只更新页面状态，不返回业务数据。
     * 副作用: 写入 selectedEpisodeId，更新详情页分集按钮选中状态。
     */
    selectEpisode(episode) {
      // 条件分支: 点击事件没有提供有效分集对象时进入。
      // 执行内容: 不改变 selectedEpisodeId，避免空对象写入异常选中状态。
      if (!episode) {
        return;
      }

      // id 是分集主标识，没有 id 时使用 value 兜底。
      this.selectedEpisodeId = episode.id || episode.value || '';
    },

    /**
     * 切换当前详情内容收藏状态。
     * 触发来源: 详情页收藏按钮点击。
     * 副作用: 调用 userContentService.toggleFavorite 写入用户内容运行时状态。
     *
     * @returns {void} 写入收藏状态并更新当前页面按钮视觉。
     */
    handleToggleFavorite() {
      // 条件分支: 当前详情内容缺失时进入。
      // 执行内容: 不写入收藏状态，避免生成无效收藏记录。
      if (!this.video) {
        return;
      }

      // 类型: object。
      // 作用: 切换收藏状态并读取切换后的结果。
      const result = toggleFavorite(this.video);

      // 副作用: 覆盖当前页面收藏按钮视觉，保证点击后立即反馈。
      this.localFavoriteOverride = Boolean(result.favorite);
    },

    /**
     * 播放当前选中分集。
     *
     * 调用位置：详情头图区主播放按钮。
     * 页面影响：跳转到播放页，并把当前详情目标 sourceId/videoId 传给播放路由。
     *
     * @returns {void} 当前不返回业务数据。
     * 副作用: 通过 Vue Router 导航到携带内容、分集和自动播放意图的播放页。
     */
    playSelectedEpisode() {
      // 条件分支: 当前没有可用分集对象时进入。
      // 执行内容: 直接结束播放入口，不构造缺失分集的路由。
      if (!this.selectedEpisode) {
        return;
      }

      // 条件分支: 有效数据源标识或内容标识缺失时进入。
      // 执行内容: 终止导航，避免生成没有业务目标的播放 URL。
      if (!this.effectiveSourceId || !this.effectiveVideoId) {
        return;
      }

      // 类型: object。
      // 作用: 把详情页播放入口意图和有效分集信息传给播放页，确保进入播放页后能自动写入播放状态。
      const query = {
        // 类型: string。
        // 作用: 标记本次跳转来自详情页播放按钮，播放页据此自动写 currentPlaying 和播放历史。
        autoplay: '1'
      };

      // 类型: string。
      // 作用: 当前分集稳定 id，存在时才写入 URL query，避免出现空 episodeId。
      const episodeId = this.selectedEpisode.id || this.selectedEpisode.value || '';

      // 条件分支: 当前分集存在稳定 id 时进入。
      // 执行内容: 传递 episodeId，让播放页优先恢复详情页选中的分集。
      if (episodeId) {
        query.episodeId = episodeId;
      }

      // 条件分支: 当前分集存在有效序号时进入。
      // 执行内容: 传递 episodeIndex，让播放页在 episodeId 缺失时仍可区分电视剧单集。
      if (this.selectedEpisodeIndex) {
        query.episodeIndex = this.selectedEpisodeIndex;
      }

      // 跳转到播放页；除视频级参数外，还通过 query 携带分集信息。
      this.$router.push({
        name: 'player',
        params: {
          sourceId: this.effectiveSourceId,
          videoId: this.effectiveVideoId
        },
        query
      }).catch((error) => {
        // 条件分支: 导航失败且错误不是 NavigationDuplicated 时进入。
        // 执行内容: 继续抛出真实路由错误，只忽略重复进入当前播放目标。
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
  作用容器: `.detail-view`。
  样式作用:
  详情页最外层容器。
  对应 template 根节点 `.theme-page.detail-view`。
  作用是在通用页面布局基础上，为详情页顶部留出细微距离。
*/
.detail-view {
  /* 顶部留白让详情头图区和全局导航之间不显得太贴。 */
  padding-top: 8px;
}

/*
  作用容器: `.detail-shell`。
  样式作用:
  详情内容主体。
  对应 template 中 `[if hasVideo]` 的 `.detail-shell`。
  内部只保留详情头图区和选集播放区。
*/
.detail-shell {
  /* 使用 grid 让详情头图和选集区按上下顺序排列。 */
  display: grid;

  /* 控制详情头图和选集区之间的纵向距离。 */
  gap: 18px;
}

/*
  作用容器: `.detail-hero`。
  样式作用:
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

  /* 详情头图使用较大留白，避免封面和文字信息过于拥挤。 */
  padding: 28px;

  /* 保证头图区域最少有一定高度，避免内容少时卡片显得太扁。 */
  min-height: 420px;
}

/*
  作用容器: `.detail-poster`。
  样式作用:
  海报容器。
  对应 template 中 `.detail-poster`。
  作用是承载封面图、封面占位和更新状态角标。
*/
.detail-poster {
  /* 让角标可以定位到海报右下角。 */
  position: relative;

  /* 固定 2:3 海报比例，避免不同源封面尺寸导致详情页跳动。 */
  aspect-ratio: 2 / 3;

  /* 限制海报高度，保持详情头图的竖向比例稳定。 */
  max-height: 420px;

  /* 封面图按比例裁切时，超出海报框的部分隐藏。 */
  overflow: hidden;

  /* 图片加载前的浅色底，避免空白区域太突兀。 */
  background: #eef2f7;

  /* 细边框给海报一个清晰边界。 */
  border: 1px solid rgba(148, 163, 184, 0.18);

  /* 圆角很小，保持克制的卡片风格。 */
  border-radius: 6px;
}

/*
  作用容器: `.detail-poster img`。
  样式作用:
  封面图片。
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
  作用容器: `.detail-poster.empty`。
  样式作用:
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
  作用容器: `.detail-poster-fallback`。
  样式作用:
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
  作用容器: `.detail-poster-badge`。
  样式作用:
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
  作用容器: `.detail-main`。
  样式作用:
  详情正文区。
  对应 template 中 `.detail-main`。
  内部从上到下排列标签、标题、主演、简介和播放按钮。
*/
.detail-main {
  /* 允许正文列在 grid 中正确缩小，避免长标题撑破布局。 */
  min-width: 0;

  /* 给正文顶部留出少量空间，避免文字紧贴卡片顶边。 */
  padding-top: 4px;
}

/*
  作用容器: `.detail-kicker`。
  样式作用:
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
  作用容器: `.detail-tag`。
  样式作用:
  Element UI 标签微调。
  对应 template 中多个 `.detail-tag`。
*/
.detail-tag {
  /* 统一成胶囊标签，保持顶部扫读信息形态一致。 */
  border-radius: 999px;
}

/*
  作用容器: `.detail-tag.kind-source`。
  样式作用:
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
  作用容器: `.detail-tag.kind-rating`。
  样式作用:
  评分标签。
  对应 template 中 `.detail-tag.kind-rating`。
*/
.detail-tag.kind-rating {
  /* 评分使用暖色，符合用户对评分信息的直觉识别。 */
  color: #d97706;
}

/*
  作用容器: `.detail-title`。
  样式作用:
  详情主标题。
  对应 template 中 `.detail-title`。
*/
.detail-title {
  /* 去掉 h1 默认 margin，避免和自定义间距叠加。 */
  margin: 0;

  /* 使用大字号突出详情页主标题。 */
  font-size: clamp(34px, 3.4vw, 46px);

  /* 标题行高收紧，避免多行标题显得松散。 */
  line-height: 1.12;

  /* 加粗突出视频标题。 */
  font-weight: 800;

  /* 主标题使用最高层级文字色。 */
  color: var(--text-primary);
}

/*
  作用容器: `.detail-alias`。
  样式作用:
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
  作用容器: `.detail-route-context`。
  样式作用:
  详情页路由目标提示。
  对应 template 中 `[if hasRouteTarget]` 的 `.detail-route-context`。
  出现条件：详情页 URL 中存在 sourceId 或 videoId。
*/
.detail-route-context {
  /* 控制路由提示和别名/标题之间的距离。 */
  margin: 10px 0 0;

  /* 路由目标属于调试和状态说明，字号小于正文。 */
  font-size: 12px;

  /* 使用弱文字色，避免抢占详情页主体信息层级。 */
  color: var(--text-muted);
}

/*
  作用容器: `.detail-meta-line`。
  样式作用:
  核心元信息行。
  对应 template 中 `.detail-meta-line`。
  当前用于展示“主演”等详情页紧凑信息。
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
  作用容器: `.detail-label`。
  样式作用:
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
  作用容器: `.detail-value`。
  样式作用:
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
  作用容器: `.detail-summary`。
  样式作用:
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
  作用容器: `.detail-actions`。
  样式作用:
  详情操作区。
  对应 template 中 `.detail-actions`。
*/
.detail-actions {
  /* 控制播放按钮和简介之间的距离，保持操作区层级清晰。 */
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
  作用容器: `.detail-episodes`。
  样式作用:
  分集区外层卡片。
  对应 template 中 `.detail-episodes.theme-surface`。
*/
.detail-episodes {
  /* 给选集区内部留白，避免按钮贴住卡片边缘。 */
  padding: 28px;

  /* 选集区保留最小高度，避免少量按钮时区块过于扁平。 */
  min-height: 160px;
}

/*
  作用容器: `.detail-section-head`。
  样式作用:
  分集区头部。
  对应 template 中 `.detail-section-head`。
*/
.detail-section-head {
  /* 标题区和下方分集内容之间留出距离。 */
  margin-bottom: 20px;
}

/*
  作用容器: `.detail-section-title`。
  样式作用:
  分集区标题。
  对应 template 中 `.detail-section-title`。
*/
.detail-section-title {
  /* 去掉 h2 默认 margin，让头部间距完全由父级控制。 */
  margin: 0;

  /* 标题字号突出“选集播放”区块。 */
  font-size: 24px;

  /* 使用主文字色，表示这是新的内容区块标题。 */
  color: var(--text-primary);
}

/*
  作用容器: `.detail-section-desc`。
  样式作用:
  分集区说明文字。
  对应 template 中 `.detail-section-desc`。
*/
.detail-section-desc {
  /* 与标题保持小距离，形成标题说明组合。 */
  margin: 8px 0 0;

  /* 弱文字色表示它是辅助说明。 */
  color: var(--text-muted);

  /* 说明字号小于标题和正文。 */
  font-size: 13px;
}

/*
  作用容器: `.episode-grid`。
  样式作用:
  分集按钮网格。
  对应 template 中 `.episode-grid`。
*/
.episode-grid {
  /* 使用 Grid 自动排布分集，适合分集数量不固定的情况。 */
  display: grid;

  /* 每列最小 150px，剩余宽度自动分配。 */
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));

  /* 控制分集按钮之间的横向和纵向间距。 */
  gap: 10px;
}

/*
  作用容器: `.episode-chip`。
  样式作用:
  单个分集按钮。
  对应 template 中 `v-for="episode in episodes"` 的 `.episode-chip`。
*/
.episode-chip {
  /* 清除浏览器默认按钮外观，统一成项目自己的按钮样式。 */
  appearance: none;

  /* 最小高度保证每个分集按钮有足够点击面积。 */
  min-height: 48px;

  /* 左右内边距照顾较长集数名称。 */
  padding: 8px 14px;

  /* 圆角略小于标签，表示它是普通分集按钮。 */
  border-radius: 8px;

  /* 边框给分集按钮明确边界。 */
  border: 1px solid rgba(148, 163, 184, 0.18);

  /* 白色半透明背景让按钮从选集区卡片中浮出来。 */
  background: rgba(255, 255, 255, 0.92);

  /* 按钮内部使用纵向排列，显示分集 label 和标题。 */
  display: flex;

  /* 分集 label 和标题上下排列。 */
  flex-direction: column;

  /* 左对齐更适合扫读长分集标题。 */
  align-items: flex-start;

  /* 控制分集 label 和标题之间的距离。 */
  gap: 4px;

  /* 鼠标手型提示可点击选择。 */
  cursor: pointer;

  /* hover 和 active 状态平滑过渡。 */
  transition: all 0.18s ease;

  /* 按钮文字左对齐，避免长标题居中后难读。 */
  text-align: left;
}

/*
  作用容器: `.episode-chip:hover, .episode-chip.active`。
  样式作用:
  分集按钮 hover 和选中状态。
  hover 由鼠标移入触发，active 来自 `episode.id === selectedEpisodeId`。
*/
.episode-chip:hover,
.episode-chip.active {
  /* 文字使用主题色，提示当前按钮可交互或已选中。 */
  color: var(--accent);

  /* 边框切换为主题色透明版本，强化选中边界。 */
  border-color: rgba(91, 140, 255, 0.28);

  /* 浅主题背景表示当前分集被关注或选中。 */
  background: rgba(91, 140, 255, 0.08);

  /* 内阴影给选中态增加一点层次，但不改变按钮尺寸。 */
  box-shadow: inset 0 0 0 1px rgba(91, 140, 255, 0.06);
}

/*
  作用容器: `.episode-label`。
  样式作用:
  分集主标签。
  对应 template 中 `.episode-label`。
*/
.episode-label {
  /* 加粗分集编号，方便用户快速定位第几集。 */
  font-weight: 700;

  /* 使用主文字色保证可读性。 */
  color: var(--text-primary);
}

/*
  作用容器: `.episode-title`。
  样式作用:
  分集副标题。
  对应 template 中 `.episode-title`。
*/
.episode-title {
  /* 字号小于分集编号，表示它是辅助信息。 */
  font-size: 12px;

  /* 弱文字色让副标题不抢编号层级。 */
  color: var(--text-muted);
}

/*
  作用容器: `.detail-page-empty`。
  样式作用:
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
}

/*
  响应式断点: (max-width: 900px)。
  作用范围: 当前样式块内在该媒体条件下命中的页面或组件元素。
  样式作用:
  平板端详情布局。
  触发条件：视口宽度不超过 900px。
  原因：260px 海报列加正文列在平板宽度下容易挤压正文。
*/
@media (max-width: 900px) {
  /*
    作用容器: `.detail-hero`。
    样式作用:
    在 `(max-width: 900px)` 响应式范围内调整该区域的布局或显示状态。
  */
  .detail-hero {
    /* 改成单列后，海报在上、正文在下，阅读顺序更自然。 */
    grid-template-columns: 1fr;
  }

  /*
    作用容器: `.detail-poster`。
    样式作用:
    在 `(max-width: 900px)` 响应式范围内调整该区域的布局或显示状态。
  */
  .detail-poster {
    /* 单列模式下限制海报最大宽度，避免海报铺满整行。 */
    max-width: 240px;
  }
}

/*
  响应式断点: (max-width: 640px)。
  作用范围: 当前样式块内在该媒体条件下命中的页面或组件元素。
  样式作用:
  手机端详情布局。
  触发条件：视口宽度不超过 640px。
  调整目标：减少边距、压缩标题字号，并让分集按钮更适合窄屏。
*/
@media (max-width: 640px) {
  /*
    作用容器: `.detail-hero, .detail-episodes`。
    样式作用:
    在 `(max-width: 640px)` 响应式范围内调整该区域的布局或显示状态。
  */
  .detail-hero,
  .detail-episodes {
    /* 手机端收紧头图区和选集区内边距，把更多空间留给正文。 */
    padding: 16px;
  }

  /*
    作用容器: `.detail-title`。
    样式作用:
    在 `(max-width: 640px)` 响应式范围内调整该区域的布局或显示状态。
  */
  .detail-title {
    /* 手机端标题字号缩小，避免长片名在窄屏下一行只有很少字。 */
    font-size: 24px;
  }

  /*
    作用容器: `.detail-meta-line`。
    样式作用:
    在 `(max-width: 640px)` 响应式范围内调整该区域的布局或显示状态。
  */
  .detail-meta-line {
    /* 手机端主演信息改成上下排列，避免字段名挤压内容。 */
    flex-direction: column;

    /* 手机端左对齐字段名和值。 */
    align-items: flex-start;

    /* 缩小字段名和值之间的间距。 */
    gap: 4px;
  }

  /*
    作用容器: `.episode-grid`。
    样式作用:
    在 `(max-width: 640px)` 响应式范围内调整该区域的布局或显示状态。
  */
  .episode-grid {
    /* 手机端分集固定为两列，兼顾点击面积和浏览效率。 */
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
