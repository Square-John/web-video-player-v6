<template>
  <!--
    PlayerView 页面渲染树

    [DEFAULT] ele(div.player-view)
    │  - condition: 默认渲染。
    │  - type: 原生标签，标签名称: div
    │  - description: 播放页根容器，承载加载遮罩、双列播放内容或整页空状态。
    │  - params: -- loading：true 显示加载遮罩，false 展示页面内容。
    │  - events: 无
    │
    ├─ [IF hasVideo] ele(div.player-shell)
    │  │  - condition: 当前 player 数据桶存在可展示 ContentItem 时渲染。
    │  │  - type: 原生标签，标签名称: div
    │  │  - description: 桌面建立左右独立纵向布局，平板和手机切换为播放器优先单列布局。
    │  │  - params: 无
    │  │  - events: 无
    │  ├─ [DEFAULT] ele(div.player-main-column)
    │  │  │  - condition: 有播放内容时默认渲染。
    │  │  │  - type: 原生标签，标签名称: div
    │  │  │  - description: 桌面独立排列内容信息和播放器；移动端把播放器调整到信息之前。
    │  │  │  - params: 无
    │  │  │  - events: 无
    │  │  ├─ [DEFAULT] ele(section.player-meta-panel)
    │  │  │     - condition: 有播放内容时默认渲染。
    │  │  │     - type: 原生标签，标签名称: section
    │  │  │     - description: 展示紧邻的标题与类型、上下文 Chip 和右下角收藏状态。
    │  │  │     - params: -- video.title；-- contentTypeText；-- sourceName；-- activePlaybackSourceName。
    │  │  │     - events: @click -> handleToggleFavorite()
    │  │  └─ [DEFAULT] ele(section.player-surface)
    │  │        - condition: 有播放内容时默认渲染。
    │  │        - type: 原生标签，标签名称: section
    │  │        - description: 播放器舞台，承接开始播放和播放状态说明。
    │  │        - params: -- playTypeText；-- playMessage。
    │  │        - events: @click -> handleStartPlayback()
    │  └─ [DEFAULT] ele(aside.player-side-column)
    │     │  - condition: 有播放内容时默认渲染。
    │     │  - type: 原生标签，标签名称: aside
    │     │  - description: 桌面独立排列线路列表和分集列表，移动端接在主播放列之后。
    │     │  - params: 无
    │     │  - events: 无
    │     ├─ [DEFAULT] ele(section.player-lines-panel)
    │     │     - condition: 有播放内容时默认渲染。
    │     │     - type: 原生标签，标签名称: section
    │     │     - description: 使用共用紧凑选项样式循环展示 playbackLines 并切换当前线路。
    │     │     - params: -- playbackLines；-- activePlaybackSourceId。
    │     │     - events: @click -> selectPlaybackSource(line)
    │     └─ [DEFAULT] ele(section.playlist-panel)
    │           - condition: 有播放内容时默认渲染。
    │           - type: 原生标签，标签名称: section
    │           - description: 使用共用紧凑选项样式展示分集，单集只占一个正常高度单元。
    │           - params: -- episodes；-- selectedEpisodeId。
    │           - events: @click -> selectEpisode(episode)
    └─ [ELSE] ele(el-empty.player-page-empty)
       - condition: 当前没有可展示 ContentItem 时渲染。
       - type: 第三方组件，组件库: Element UI，组件名称: el-empty
       - description: 展示请求错误或无播放信息的整页空状态。
       - params: -- description：loadError 或默认说明。
       - events: 无
  -->
  <!--
    [DEFAULT] ele(div.player-view)
    - condition: 默认渲染。
    - type: 原生标签，标签名称: div
    - description: 在 App.vue 固定播放外壳中管理桌面一屏和移动端内部滚动。
    - params: -- loading：播放页请求状态。
    - events: 无
  -->
  <div class="player-view" v-loading="loading">
    <!--
      [IF hasVideo] ele(div.player-shell)
      - condition: 当前 player 数据桶存在可展示 ContentItem 时渲染。
      - type: 原生标签，标签名称: div
      - description: 使用左右独立列完成桌面参考布局，并在平板和手机重排为播放器优先单列。
      - params: 无
      - events: 无
    -->
    <div v-if="hasVideo" class="player-shell">
      <!--
        [DEFAULT] ele(div.player-main-column)
        - condition: 有播放内容时默认渲染。
        - type: 原生标签，标签名称: div
        - description: 桌面独立管理内容信息和播放器高度；平板和手机在本列内把播放器调整到最前面。
        - params: 无
        - events: 无
      -->
      <div class="player-main-column">
        <!--
          [DEFAULT] ele(section.player-meta-panel)
          - condition: 有播放内容时默认渲染。
          - type: 原生标签，标签名称: section
          - description: 展示紧邻的标题与类型、数据来源 Chip、当前线路 Chip 和右下角收藏状态。
          - params: -- video.title；-- contentTypeText；-- sourceName；-- activePlaybackSourceName；-- isFavorite。
          - events: 无
        -->
        <section class="player-meta-panel" aria-labelledby="player-content-title">
          <!--
            [DEFAULT] ele(div.player-meta-identity)
            - condition: 内容信息面板渲染时默认显示。
            - type: 原生标签，标签名称: div
            - description: 组合视频标题和内容类型，形成当前播放内容的主身份信息。
            - params: -- video.title；-- contentTypeText。
            - events: 无
          -->
          <div class="player-meta-identity">
            <h1 id="player-content-title" class="player-title">{{ video.title }}</h1>
            <span class="player-type-badge">{{ contentTypeText }}</span>
          </div>

          <!--
            [DEFAULT] ele(div.player-meta-context)
            - condition: 内容信息面板渲染时默认显示。
            - type: 原生标签，标签名称: div
            - description: 以两个 Chip 展示数据来源和当前实际激活线路，只读取现有播放上下文。
            - params: -- sourceName；-- activePlaybackSourceName。
            - events: 无
          -->
          <div class="player-meta-context">
            <span class="player-context-chip">数据源：{{ sourceName }}</span>
            <span class="player-context-chip">当前线路：{{ activePlaybackSourceName }}</span>
          </div>

          <!--
            [DEFAULT] ele(el-button.player-favorite-button)
            - condition: 内容信息面板渲染时默认显示。
            - type: 第三方组件，组件库: Element UI，组件名称: el-button
            - description: 切换当前内容收藏状态，固定在信息面板内容之后的右下角。
            - params: -- type：收藏状态按钮类型；-- icon：收藏状态图标。
            - events: @click -> handleToggleFavorite()
          -->
          <el-button
            class="player-favorite-button"
            size="small"
            :type="isFavorite ? 'primary' : 'default'"
            :icon="favoriteButtonIcon"
            round
            @click="handleToggleFavorite">
            {{ favoriteButtonText }}
          </el-button>
        </section>

        <!--
          [DEFAULT] ele(section.player-surface)
          - condition: 有播放内容时默认渲染。
          - type: 原生标签，标签名称: section
          - description: 播放器舞台；平板和手机中通过列内重排成为播放页内容区第一个模块。
          - params: -- playTypeText：播放格式；-- playMessage：播放状态说明。
          - events: 无
        -->
        <section class="player-surface" aria-label="播放器">
          <!--
            [DEFAULT] ele(div.player-state)
            - condition: 播放器舞台渲染时默认显示。
            - type: 原生标签，标签名称: div
            - description: 居中组织播放入口、地址状态、格式和恢复提示。
            - params: -- playTypeText；-- playMessage。
            - events: 无
          -->
          <div class="player-state">
            <!--
              [DEFAULT] ele(button.player-play-button)
              - condition: 播放器舞台渲染时默认显示。
              - type: 原生标签，标签名称: button
              - description: 按当前分集和线路开始播放。
              - params: 无
              - events: @click -> handleStartPlayback()
            -->
            <button type="button" class="player-play-button" aria-label="播放" @click="handleStartPlayback">
              <i class="el-icon-caret-right"></i>
            </button>
            <p class="player-state-label">播放地址已准备</p>
            <h2 class="player-state-title">{{ playTypeText }}</h2>
            <p class="player-state-text">{{ playMessage }}</p>
          </div>
        </section>
      </div>

      <!--
        [DEFAULT] ele(aside.player-side-column)
        - condition: 有播放内容时默认渲染。
        - type: 原生标签，标签名称: aside
        - description: 桌面独立管理线路和分集高度；平板和手机接在主播放列之后自然展开。
        - params: 无
        - events: 无
      -->
      <aside class="player-side-column" aria-label="播放操作">
        <!--
          [DEFAULT] ele(section.player-lines-panel)
          - condition: 有播放内容时默认渲染。
          - type: 原生标签，标签名称: section
          - description: 展示全部可选线路，桌面在独立区域内部滚动，移动端随页面自然展开。
          - params: -- playbackLines：线路数组；-- activePlaybackSourceId：当前线路 id。
          - events: 无
        -->
        <section class="player-lines-panel" aria-labelledby="player-lines-title">
          <h2 id="player-lines-title" class="player-panel-title">线路列表</h2>
          <!--
            [DEFAULT] ele(div.line-switcher-list)
            - condition: 线路面板渲染时默认显示。
            - type: 原生标签，标签名称: div
            - description: 使用线路和分集共用的紧凑网格从左上角排列，避免单线路拉伸。
            - params: -- playbackLines。
            - events: 无
          -->
          <div class="player-option-grid line-switcher-list">
            <!--
              [DEFAULT] ele(button.line-switcher-chip)
              - condition: playbackLines 循环到当前线路时渲染。
              - type: 原生标签，标签名称: button
              - description: 切换当前播放线路并同步内容信息中的当前线路文案。
              - params: -- line.id；-- line.name。
              - events: @click -> selectPlaybackSource(line)
            -->
            <button
              v-for="line in playbackLines"
              :key="line.id"
              type="button"
              class="player-option-chip line-switcher-chip"
              :class="{ active: line.id === activePlaybackSourceId }"
              @click="selectPlaybackSource(line)">
              {{ line.name }}
            </button>
          </div>
        </section>

        <!--
          [DEFAULT] ele(section.playlist-panel)
          - condition: 有播放内容时默认渲染。
          - type: 原生标签，标签名称: section
          - description: 展示单集或多集入口，桌面独立滚动，移动端随页面自然展开。
          - params: -- episodes：分集数组。
          - events: 无
        -->
        <section class="playlist-panel" aria-labelledby="playlist-title">
          <h2 id="playlist-title" class="player-panel-title">分集列表</h2>
          <!--
            [IF hasEpisodes] ele(div.playlist-episodes)
            - condition: episodes 至少包含一项时渲染。
            - type: 原生标签，标签名称: div
            - description: 使用线路和分集共用的紧凑网格从左上角排列，避免单集按钮拉伸。
            - params: -- episodes：分集数组。
            - events: 无
          -->
          <div v-if="hasEpisodes" class="player-option-grid playlist-episodes">
            <button
              v-for="episode in episodes"
              :key="episode.id || episode.value"
              type="button"
              class="player-option-chip playlist-episode-chip"
              :class="{ active: episode.id === selectedEpisodeId }"
              @click="selectEpisode(episode)">
              {{ episode.label }}
            </button>
          </div>
          <!--
            [ELSE] ele(el-empty.playlist-empty)
            - condition: episodes 为空时渲染。
            - type: 第三方组件，组件库: Element UI，组件名称: el-empty
            - description: 分集局部空状态。
            - params: -- description：空分集说明；-- image-size：插图尺寸。
            - events: 无
          -->
          <el-empty v-else class="playlist-empty" description="当前没有可切换分集" :image-size="68" />
        </section>
      </aside>
    </div>

    <!--
      [ELSE] ele(el-empty.player-page-empty)
      - condition: 当前没有可展示 ContentItem 时渲染。
      - type: 第三方组件，组件库: Element UI，组件名称: el-empty
      - description: 播放页整页空状态。
      - params: -- description：loadError 或默认说明。
      - events: 无
    -->
    <el-empty v-else class="player-page-empty" :description="loadError || '当前没有可展示的播放信息'" />
  </div>
</template>

<script>
/*
  PlayerView.vue 模块说明

  - 文件职责:
      根据路由内容和分集身份请求播放页数据，渲染播放区、线路与分集。
      统一处理收藏、播放历史、当前播放状态和恢复播放策略。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      requestSourceData: 自定义服务，请求播放页 player 数据桶并写入全站内容 store。
      getCurrentContentItem、getActiveSourceId: 自定义 selector，提供播放页当前内容和默认数据源上下文。
      getContentUserStatus、getHistoryRecord: 自定义 selector，提供收藏状态和当前分集历史记录。
      toggleFavorite、upsertPlayHistory、updateCurrentPlaying、getPlaybackResumeDecision: 自定义服务，写入收藏、播放历史、当前播放并计算恢复策略。

  - 模块级常量:
      DEFAULT_PLAYER_CONTENT_ID: string，播放页没有路由 videoId 时使用的静态预览内容 id。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      PlayerView: Vue 路由页面组件，供 player 路由展示播放上下文。
*/

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 播放页进入时请求 player 数据桶，并把响应写入 player.currentKey，页面通过 getCurrentContentItem('player') 读取。
import { requestSourceData } from '../services/sourceDataService.js';

import {
  // 导入来源: ../store/siteContentStore。
  // 导入内容: getCurrentContentItem 单内容桶 selector。
  // 文件作用: 播放页通过 selector 从 player.currentKey 解析完整 ContentItem。
  getCurrentContentItem,

  // 导入来源: ../store/siteContentStore。
  // 导入内容: getActiveSourceId 当前数据源 selector。
  // 文件作用: 播放页通过 selector 获取路由缺失 sourceId 时的数据源兜底值。
  getActiveSourceId
} from '../store/siteContentStore.js';

import {
  // 导入来源: ../selectors/userContentSelectors。
  // 导入内容: getContentUserStatus 用户内容状态 selector。
  // 文件作用: 播放页读取当前内容是否收藏、是否正在播放和最近播放历史。
  getContentUserStatus,

  // 导入来源: ../selectors/userContentSelectors。
  // 导入内容: getHistoryRecord 当前电影或电视剧单集历史 selector。
  // 文件作用: 播放页按当前分集读取恢复播放策略需要的历史记录。
  getHistoryRecord
} from '../selectors/userContentSelectors.js';

import {
  // 导入来源: ../services/userContentService。
  // 导入内容: toggleFavorite 收藏切换服务。
  // 文件作用: 播放页收藏按钮写入用户内容运行时状态。
  toggleFavorite,

  // 导入来源: ../services/userContentService。
  // 导入内容: upsertPlayHistory 播放历史写入服务。
  // 文件作用: 播放页点击播放、切集或切线路时写入播放历史记录。
  upsertPlayHistory,

  // 导入来源: ../services/userContentService。
  // 导入内容: updateCurrentPlaying 当前播放状态写入服务。
  // 文件作用: 播放页维护全站当前正在播放内容，让其它卡片可以显示正在播放。
  updateCurrentPlaying,

  // 导入来源: ../services/userContentService。
  // 导入内容: getPlaybackResumeDecision 恢复播放策略函数。
  // 文件作用: 播放页根据历史记录判断从头播放、恢复播放或提示重播。
  getPlaybackResumeDecision
} from '../services/userContentService.js';

// 类型: string。
// 作用: 播放页没有路由 videoId 时使用的 mock 预览内容 id，保证导航栏直接进入播放页也有静态展示。
const DEFAULT_PLAYER_CONTENT_ID = 'movie-001';

export default {
  // 组件名称用于在调试工具和报错信息中识别播放页。
  name: 'PlayerView',

  /**
   * 创建播放页请求、分集、线路、收藏和恢复播放状态。
   * 纯函数: 为每个播放页实例返回独立对象，不修改 store、路由或用户内容记录。
   *
   * @returns {object} 播放页响应式状态。
   * @returns {string} return.selectedEpisodeId 当前选中分集标识。
   * @returns {string} return.activePlaybackSourceId 当前选中播放线路标识。
   * @returns {string} return.resumeTipText 恢复播放策略展示文本。
   */
  data() {
    return {
      // loading 类型: boolean。
      // loading 作用: 控制根容器 v-loading，请求播放页数据时显示页面级加载遮罩。
      loading: false,

      // loadError 类型: string。
      // loadError 作用: 记录播放页数据请求失败文案，失败时交给整页空状态展示。
      loadError: '',

      // selectedEpisodeId 类型: string。
      // selectedEpisodeId 作用: 表示当前选中的分集按钮，影响右侧按钮 active 状态和播放线路筛选。
      selectedEpisodeId: '',

      // activePlaybackSourceId 类型: string。
      // activePlaybackSourceId 作用: 表示当前选中的播放线路，影响顶部线路按钮 active 状态和播放器舞台文案。
      activePlaybackSourceId: '',

      // localFavoriteOverride 类型: boolean|null。
      // localFavoriteOverride 作用: 收藏按钮点击后立刻覆盖当前页视觉状态；null 表示继续使用 selector 状态。
      localFavoriteOverride: null,

      // hasStartedPlayback 类型: boolean。
      // hasStartedPlayback 作用: 标记当前播放页是否已经写入播放状态；true 时切集、切线路和离开页面都会同步处理用户内容状态。
      hasStartedPlayback: false,

      // resumeTipText 类型: string。
      // resumeTipText 作用: 用轻提示承接接近结尾等恢复播放策略，不使用复杂弹窗。
      resumeTipText: ''
    };
  },

  /**
   * Vue created 生命周期。
   * 副作用: 组件创建后请求当前播放路由内容，并将标准响应写入 player 数据桶。
   *
   * @returns {void} 生命周期钩子只启动异步请求，不返回业务数据。
   */
  created() {
    // 生命周期时机: 播放页组件创建后执行。
    // 执行内容: 请求当前路由目标的播放数据，并写入统一 player 数据桶。
    this.loadPlayerContent();
  },

  watch: {
    /**
     * 监听播放页完整路由变化。
     * 执行时机: sourceId 或 videoId 等路由信息变化时触发。
     * 页面影响: 从新路由重新请求 player.currentKey，保证详情页跳转到不同视频时播放页同步刷新。
     *
     * @returns {void} 只触发播放页数据请求，不返回业务数据。
     * 副作用: 播放路由目标变化后重新请求 player 数据桶并同步播放上下文。
     */
    '$route.fullPath'() {
      // 副作用: 路由切换到新播放目标前，清理旧目标的当前播放占位。
      this.clearCurrentPlayingIfNeeded();

      // 路由变化后重新请求播放数据，避免复用组件实例时继续展示旧播放信息。
      this.loadPlayerContent();
    }
  },

  /**
   * Vue beforeDestroy 生命周期。
   * 执行时机: 播放页组件销毁前。
   * 执行内容: 如果当前页面已经标记播放中，则清理全站 currentPlaying，避免其它卡片继续显示正在播放。
   *
   * @returns {void} 生命周期钩子不返回业务数据。
   * 副作用: 组件销毁前清理与当前页面匹配的 currentPlaying 状态。
   */
  beforeDestroy() {
    // 副作用: 离开播放页时清理当前播放状态。
    this.clearCurrentPlayingIfNeeded();
  },

  computed: {
    /**
     * 当前播放页统一内容对象。
     *
     * @returns {Object|null} 当前 ContentItem；尚未加载或未命中时为 null。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    video() {
      // 返回值类型: Object|null。
      // 作用: 通过统一 selector 从 player.currentKey 读取实体池中的完整 ContentItem。
      return getCurrentContentItem('player');
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
     * 当前内容的播放信息对象。
     *
     * @returns {Object|null} ContentItem.playback 对象；缺失时为 null。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    playback() {
      // playback 保存线路、请求头和源站原始播放页地址，是播放页派生线路文案的核心数据。
      return this.video && this.video.playback ? this.video.playback : null;
    },

    /**
     * 当前请求使用的内容 id。
     *
     * @returns {string} 优先使用路由 videoId，没有时回退到播放页默认预览内容。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    contentIdForRequest() {
      // 导航栏直接进入 `/player` 时没有 videoId，用默认 mock 内容维持静态阶段可看效果。
      return this.routeVideoId || DEFAULT_PLAYER_CONTENT_ID;
    },

    /**
     * 当前播放页路由中的数据源 id。
     *
     * @returns {string} URL params 中的 sourceId，没有时返回空字符串。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    routeSourceId() {
      // sourceId 来自 `/player/:sourceId?/:videoId?`，后续真实播放请求会以它选择目标数据源。
      return this.asText(this.$route.params.sourceId).trim();
    },

    /**
     * 当前播放页路由中的视频 id。
     *
     * @returns {string} URL params 中的 videoId，没有时返回空字符串。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    routeVideoId() {
      // videoId 来自 `/player/:sourceId?/:videoId?`，后续真实播放请求会以它定位目标视频。
      return this.asText(this.$route.params.videoId).trim();
    },

    /**
     * 路由 query 中指定的分集 id。
     *
     * @returns {string} episodeId query 文本。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    routeEpisodeId() {
      // 返回值类型: string。
      // 作用: 详情页跳转播放页时用 query 传入目标分集，播放页优先选中它。
      return this.asText(this.$route.query.episodeId).trim();
    },

    /**
     * 路由 query 中指定的分集序号。
     *
     * @returns {number|null} episodeIndex query 数字。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    routeEpisodeIndex() {
      // 类型: number。
      // 作用: query 中的 episodeIndex 用于 episodeId 缺失时兜底定位电视剧历史记录。
      const episodeIndex = Number(this.$route.query.episodeIndex);

      // 返回值类型: number|null。
      // 作用: 有效集数返回数字，异常时返回 null。
      return Number.isFinite(episodeIndex) && episodeIndex > 0 ? episodeIndex : null;
    },

    /**
     * 路由 query 中指定的播放线路 id。
     *
     * @returns {string} playbackSourceId query 文本。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    routePlaybackSourceId() {
      // 返回值类型: string。
      // 作用: 详情页或其它入口后续可指定播放线路，缺失时播放页自行选择默认线路。
      return this.asText(this.$route.query.playbackSourceId).trim();
    },

    /**
     * 当前路由是否要求进入播放页后自动开始播放。
     *
     * @returns {boolean} true 表示由详情页播放入口带入，应自动写入 currentPlaying 和播放历史。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    routeShouldAutoPlay() {
      // 类型: string。
      // 作用: autoplay query 由详情页播放按钮写入，用于区分“播放入口跳转”和“导航栏直接打开播放页”。
      const autoplay = this.asText(this.$route.query.autoplay).trim();

      // 返回值类型: boolean。
      // 作用: 支持 '1' 和 'true' 两种显式值，避免空 query 或普通浏览误写播放历史。
      return autoplay === '1' || autoplay === 'true';
    },

    /**
     * 是否有播放页主体视频信息。
     *
     * @returns {boolean} video 有值时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    hasVideo() {
      return Boolean(this.video);
    },

    /**
     * 当前播放内容的中文类型。
     * 数据来源: ContentItem.type，字段契约当前固定为 movie 或 tv。
     * 页面位置: 内容信息面板中的 .player-type-badge。
     * 维护边界: 只派生展示文案，不修改 ContentItem。
     *
     * @returns {string} movie 返回“电影”，tv 返回“电视剧”，其它值返回原文本或“视频”。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    contentTypeText() {
      // 类型: string。
      // 作用: 规范 ContentItem.type，供类型映射分支比较。
      const contentType = this.asText(this.video && this.video.type).trim().toLowerCase();

      // 条件分支: 当前内容为电影时进入。
      // 执行内容: 返回统一电影文案，供播放页标题区扫读。
      if (contentType === 'movie') {
        // 返回用户可读的电影类型。
        return '电影';
      }

      // 条件分支: 当前内容为电视剧时进入。
      // 执行内容: 返回统一电视剧文案，供播放页标题区扫读。
      if (contentType === 'tv') {
        // 返回用户可读的电视剧类型。
        return '电视剧';
      }

      // 非标准类型保留原文本，缺失时使用“视频”兜底。
      return contentType || '视频';
    },

    /**
     * 是否有分集按钮可以渲染。
     *
     * @returns {boolean} episodes 至少有一项时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    hasEpisodes() {
      return this.episodes.length > 0;
    },

    /**
     * 当前选中的分集。
     * 选择优先级: 用户当前选择的 selectedEpisodeId 优先；未命中时再按路由 episodeId、路由 episodeIndex 和第一集依次兜底。
     * 维护边界: 路由参数只负责首次进入时定位分集，不能覆盖用户进入页面后的主动切集结果。
     *
     * 页面位置：分集按钮 active 状态和播放线路匹配。
     *
     * @returns {Object|null} 当前分集对象。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    selectedEpisode() {
      // 类型: object|null。
      // 作用: 第一优先级按 selectedEpisodeId 查找用户当前主动选择的分集，保证按钮激活状态和播放上下文使用同一条记录。
      const selectedEpisode = this.selectedEpisodeId
        ? this.episodes.find(episode => {
          // 条件分支: 分集对象缺失时进入。
          // 执行内容: 返回 false，避免读取空对象字段。
          if (!episode) {
            return false;
          }

          // 类型: string。
          // 作用: 统一读取当前分集稳定 id，用于和 selectedEpisodeId 精确比较。
          const episodeId = episode.id || episode.value || '';

          // 返回值类型: boolean。
          // 作用: 只判断用户当前选择，不在同一轮查找中混入路由兜底条件。
          return episodeId === this.selectedEpisodeId;
        })
        : null;

      // 条件分支: 用户当前选择命中有效分集时进入。
      // 执行内容: 立即返回该分集，阻止旧路由参数覆盖用户切集结果。
      if (selectedEpisode) {
        return selectedEpisode;
      }

      // 类型: object|null。
      // 作用: 第二优先级按 routeEpisodeId 恢复详情页或外部链接指定的初始分集。
      const routeIdEpisode = this.routeEpisodeId
        ? this.episodes.find(episode => {
          // 条件分支: 分集对象缺失时进入。
          // 执行内容: 返回 false，避免读取空对象字段。
          if (!episode) {
            return false;
          }

          // 类型: string。
          // 作用: 统一读取当前分集稳定 id，用于和路由 episodeId 精确比较。
          const episodeId = episode.id || episode.value || '';

          // 返回值类型: boolean。
          // 作用: routeEpisodeId 命中时返回路由指定分集，供首次进入页面定位。
          return episodeId === this.routeEpisodeId;
        })
        : null;

      // 条件分支: 路由 episodeId 命中有效分集时进入。
      // 执行内容: 返回路由指定分集；只有用户选择未命中时才会进入该兜底层。
      if (routeIdEpisode) {
        return routeIdEpisode;
      }

      // 类型: object|null。
      // 作用: 第三优先级按 routeEpisodeIndex 兼容没有稳定 episodeId、只有集数序号的数据源。
      const routeIndexEpisode = this.routeEpisodeIndex
        ? this.episodes.find(episode => {
          // 条件分支: 分集对象缺失时进入。
          // 执行内容: 返回 false，避免读取空对象字段。
          if (!episode) {
            return false;
          }

          // 类型: number。
          // 作用: 统一读取当前分集序号，用于和路由 episodeIndex 精确比较。
          const episodeIndex = Number(episode.episodeNumber || episode.index || episode.episodeIndex);

          // 返回值类型: boolean。
          // 作用: routeEpisodeIndex 命中时返回序号对应分集，供缺少 episodeId 的路由兜底定位。
          return episodeIndex === this.routeEpisodeIndex;
        })
        : null;

      // 条件分支: 路由 episodeIndex 命中有效分集时进入。
      // 执行内容: 返回集数序号对应分集，保持不完整数据源的路由兼容能力。
      if (routeIndexEpisode) {
        return routeIndexEpisode;
      }

      // 返回值类型: object|null。
      // 作用: 所有定位信息都无效时回退到第一集；分集列表为空时返回 null。
      return this.episodes[0] || null;
    },

    /**
     * 当前选中分集序号。
     *
     * @returns {number|null} 电视剧分集序号；电影或缺失时返回 null。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    selectedEpisodeIndex() {
      // 类型: object|null。
      // 作用: 当前分集对象，优先从里面读取 episodeNumber。
      const episode = this.selectedEpisode;

      // 类型: number。
      // 作用: 分集序号优先来自数据对象，其次来自路由 query。
      const episodeIndex = Number(
        (episode && (episode.episodeNumber || episode.index || episode.episodeIndex))
        || this.routeEpisodeIndex
      );

      // 返回值类型: number|null。
      // 作用: 有效集数返回数字，异常时返回 null。
      return Number.isFinite(episodeIndex) && episodeIndex > 0 ? episodeIndex : null;
    },

    /**
     * 当前内容的全部播放线路。
     *
     * 页面位置：顶部线路切换区。
     *
     * @returns {Array<object>} ContentItem.playback.sources 数组。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    playbackSources() {
      // sources 保存数据源清洗后的线路列表，缺失时返回空数组触发不可播放文案。
      return this.asList(this.playback && this.playback.sources);
    },

    /**
     * 播放线路按钮列表。
     *
     * 页面位置：播放器顶部右侧线路切换区。
     *
     * @returns {Array<object>} 可点击线路按钮数组。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    playbackLines() {
      // 循环类型: Array.prototype.map。
      // 初始值: playbackSources 中的第一条线路。
      // 终止条件: playbackSources 中所有线路都处理完成。
      // 循环作用: 为模板提供稳定的 id/name 字段，避免直接渲染源数据时字段缺失。
      return this.playbackSources.map((source, index) => {
        // 类型: number。
        // 作用: 当前线路的自然序号，用于没有 name 时生成可读线路文案。
        const lineNumber = index + 1;

        // 返回值类型: object。
        // 作用: 返回线路按钮可直接消费的数据对象。
        return {
          // 类型: string。
          // 作用: 线路唯一标识，用于 v-for key、active 判断和点击选择。
          id: source.id || `line-${lineNumber}`,

          // 类型: string。
          // 作用: 线路展示名称，用于顶部线路按钮文本。
          name: source.name || `线路${lineNumber}`,

          // 类型: object。
          // 作用: 保留原始播放线路对象，选择线路时写回 activePlaybackSourceId。
          raw: source
        };
      });
    },

    /**
     * 当前激活的播放线路对象。
     *
     * 页面位置：播放器舞台状态、播放类型和播放地址文案。
     *
     * @returns {Object|null} 当前播放线路对象。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    activePlaybackSource() {
      // 类型: object|undefined。
      // 作用: 按用户当前选中线路 id 匹配播放源。
      const selectedSource = this.playbackSources.find(source => source.id === this.activePlaybackSourceId);

      // 类型: object|undefined。
      // 作用: 按 playback.defaultSourceId 匹配数据源建议的默认线路。
      const defaultSource = this.playbackSources.find(source => this.playback && source.id === this.playback.defaultSourceId);

      // 类型: object|undefined。
      // 作用: 匹配当前分集对应的线路，作为选中与默认线路后的回退项。
      const episodeSource = this.playbackSources.find(source => this.selectedEpisode && source.episodeId === this.selectedEpisode.id);

      // 返回值类型: object|null。
      // 作用: 依次回退到选中线路、默认线路、分集线路和第一条线路。
      return selectedSource || defaultSource || episodeSource || this.playbackSources[0] || null;
    },

    /**
     * 当前激活线路的用户可读名称。
     * 数据来源: activePlaybackSource 与 playbackLines，二者都由现有播放源数组派生。
     * 页面位置: 内容信息面板中的“当前线路”字段。
     * 维护边界: 只派生展示文本，不保存第二份线路状态，也不修改线路选择逻辑。
     *
     * @returns {string} 当前线路名称；没有可用线路时返回明确占位文案。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    activePlaybackSourceName() {
      // 类型: object|null。
      // 作用: 读取现有激活线路对象，作为展示名称匹配依据。
      const activeSource = this.activePlaybackSource;

      // 条件分支: 当前没有任何可用或已选择线路时进入。
      // 执行内容: 返回稳定占位，避免信息面板渲染空白字段。
      if (!activeSource) {
        // 返回值类型: string。
        // 作用: 明确提示当前播放内容没有可用线路。
        return '暂无可用线路';
      }

      // 类型: object|undefined。
      // 作用: 从模板正在使用的规范化线路列表中查找当前线路，复用同一名称兜底规则。
      const activeLine = this.playbackLines.find(line => {
        // 返回值类型: boolean。
        // 作用: 优先按原始对象引用命中；对象被重建时继续按稳定 id 命中。
        return line.raw === activeSource || line.id === activeSource.id;
      });

      // 返回值类型: string。
      // 作用: 命中时展示线路按钮同名文案，异常未命中时给出明确占位。
      return activeLine ? activeLine.name : '暂无可用线路';
    },

    /**
     * 播放地址是否已经准备好。
     *
     * 页面位置：播放器舞台准备完成分支。
     *
     * @returns {boolean} 当前播放线路未被明确禁用且存在 url 时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    isPlayReady() {
      return Boolean(this.activePlaybackSource && this.activePlaybackSource.available !== false && this.activePlaybackSource.url);
    },

    /**
     * 播放状态是否为错误。
     *
     * 页面位置：播放器舞台错误分支。
     *
     * @returns {boolean} 数据已加载但没有可用播放线路时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    isPlayError() {
      return Boolean(this.hasVideo && this.playbackSources.length === 0);
    },

    /**
     * 播放地址是否不支持当前直连模式。
     *
     * 页面位置：播放器舞台不支持分支。
     *
     * @returns {boolean} 有线路但线路被明确标记为不可用时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    isPlayUnsupported() {
      return Boolean(this.activePlaybackSource && this.activePlaybackSource.available === false);
    },

    /**
     * 播放类型展示文本。
     *
     * 页面位置：播放器舞台格式标题。
     *
     * @returns {string} 播放类型文案。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    playTypeText() {
      // 条件分支: 当前没有可用播放线路时进入。
      // 执行内容: 返回“未知类型”，避免模板显示 undefined。
      if (!this.activePlaybackSource) {
        return '未知类型';
      }

      // type 通常是 mp4、m3u8 等浏览器播放格式。
      return this.activePlaybackSource.type || '未知类型';
    },

    /**
     * 播放提示文案。
     *
     * 页面位置：播放器舞台状态说明。
     *
     * @returns {string} 播放说明或兜底文案。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    playMessage() {
      // 条件分支: 播放页内容请求存在错误文本时进入。
      // 执行内容: 优先返回请求错误，避免真实失败原因被泛化文案覆盖。
      if (this.loadError) {
        return this.loadError;
      }

      // 条件分支: 已根据历史位置生成恢复播放提示时进入。
      // 执行内容: 返回恢复提示，让用户知道本次播放的起始位置。
      if (this.resumeTipText) {
        return this.resumeTipText;
      }

      // 条件分支: 当前线路已准备且存在可展示恢复策略时进入。
      // 执行内容: 在用户点击播放前展示恢复位置或接近结尾提示，避免恢复策略只在内部静默生效。
      if (this.isPlayReady && this.resumeGuideText) {
        return this.resumeGuideText;
      }

      // 条件分支: 当前线路已具备可用播放地址时进入。
      // 执行内容: 返回播放地址来源说明，表明线路已通过统一 ContentItem 提供。
      if (this.isPlayReady) {
        return '当前播放地址来自统一 ContentItem.playback.sources。';
      }

      // 条件分支: 已选择线路但线路被标记为不支持时进入。
      // 执行内容: 返回切换线路提示，避免用户对不可用地址反复操作。
      if (this.isPlayUnsupported) {
        return '当前线路暂不可用，请切换其他线路。';
      }

      // 没有线路时说明数据源没有返回播放地址。
      return '暂无可用播放地址。';
    },

    /**
     * 当前来源名称。
     *
     * 页面位置：内容信息面板的数据源文字。
     *
     * @returns {string} 来源名称或占位文案。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    sourceName() {
      // 条件分支: 统一 ContentItem.source 存在可读 name 时进入。
      // 执行内容: 返回数据源展示名称，供播放页信息区渲染。
      if (this.source && this.source.name) {
        return this.source.name;
      }

      // 没有来源对象时给出明确占位。
      return '暂无来源';
    },

    /**
     * 当前播放内容的用户状态聚合。
     *
     * @returns {object} 收藏、最近播放和当前播放状态。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    contentUserStatus() {
      // 返回值类型: object。
      // 作用: 播放页不直接读取 userContentStore 内部结构，统一通过 selector 获取用户状态。
      return getContentUserStatus(this.video);
    },

    /**
     * 播放页收藏按钮状态。
     *
     * @returns {boolean} true 表示当前内容已收藏。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    isFavorite() {
      // 条件分支: 当前页面本轮点击过收藏按钮时进入。
      // 执行内容: 使用本地覆盖值，保证按钮点击后立即反馈。
      if (this.localFavoriteOverride !== null) {
        return this.localFavoriteOverride;
      }

      // 返回值类型: boolean。
      // 作用: 使用用户内容 selector 状态驱动播放页收藏按钮。
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
      // 作用: 文案跟随收藏状态变化，让用户知道当前收藏状态。
      return this.isFavorite ? '已收藏' : '收藏';
    },

    /**
     * 当前分集播放历史记录。
     *
     * @returns {object|null} 当前电影或电视剧单集历史记录。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    currentHistoryRecord() {
      // 条件分支: 当前内容缺失时进入。
      // 执行内容: 返回 null，让恢复播放策略按无历史处理。
      if (!this.video) {
        return null;
      }

      // 返回值类型: object|null。
      // 作用: 按电影整部或电视剧单集读取历史记录。
      return getHistoryRecord({
        sourceId: this.video.sourceId,
        contentId: this.video.id,
        type: this.video.type,
        episodeId: this.selectedEpisode ? this.selectedEpisode.id || this.selectedEpisode.value || this.routeEpisodeId : this.routeEpisodeId,
        episodeIndex: this.selectedEpisodeIndex
      });
    },

    /**
     * 当前播放恢复策略。
     *
     * @returns {object} restart、resume 或 prompt-replay 策略对象。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    resumeDecision() {
      // 返回值类型: object。
      // 作用: 统一使用 service 中的恢复播放规则，避免播放页自己散落判断阈值。
      return getPlaybackResumeDecision(this.currentHistoryRecord);
    },

    /**
     * 播放前恢复策略提示。
     * 只在存在有效历史进度时展示，让用户在点击播放前知道本次会从哪里开始。
     * 接近开头和无历史记录不展示恢复提示，保持“从 0 开始，不提示”的阶段约定。
     *
     * @returns {string} 播放舞台展示的恢复策略提示文案；无需提示时返回空字符串。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    resumeGuideText() {
      // 类型: object。
      // 作用: 读取当前分集或电影的恢复判断结果，来源是 userContentService.getPlaybackResumeDecision。
      const decision = this.resumeDecision || {};

      // 类型: number。
      // 作用: 保存恢复策略建议起播秒数，用于普通恢复和接近结尾提示。
      const startSeconds = Number(decision.startSeconds) > 0 ? Number(decision.startSeconds) : 0;

      // 条件分支: 普通历史恢复时进入。
      // 执行内容: 明确提示用户点击播放后会从历史进度继续。
      if (decision.mode === 'resume' && startSeconds > 0) {
        return `检测到上次播放至 ${this.formatPlaybackSeconds(startSeconds)}，点击播放将从该位置继续。`;
      }

      // 条件分支: 历史记录已经接近结尾时进入。
      // 执行内容: 显示重播提示语义，但当前实现仍先从最后位置继续。
      if (decision.mode === 'prompt-replay' && startSeconds > 0) {
        return `上次播放已接近结尾，点击播放将从 ${this.formatPlaybackSeconds(startSeconds)} 继续。`;
      }

      // 返回值类型: string。
      // 作用: 无历史或接近开头时不提示恢复策略，保持从 0 开始的简洁体验。
      return '';
    }
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     *
     * 调用位置：computed 整理 episodes、playbackSources。
     * 页面影响：保证分集切换区和线路切换区永远消费数组。
     *
     * @param {*} value 可能来自统一 ContentItem 的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    asList(value) {
      // 条件分支: value 是真正数组时进入。
      // 执行内容: 返回原数组，保留已经标准化的分集或线路列表。
      if (Array.isArray(value)) {
        return value;
      }

      // 非数组统一兜底为空数组，让分集区或线路区进入空状态。
      return [];
    },

    /**
     * 把任意值整理成字符串。
     *
     * 调用位置：routeSourceId、routeVideoId。
     * 页面影响：保证路由参数进入页面后始终以字符串形态参与展示。
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
     * 调用位置：loadPlayerContent 请求成功后。
     * 页面影响：进入播放页时，右侧分集列表默认选中可播放分集或第一集。
     *
     * @param {Array} episodes 分集列表。
     * @returns {string} 默认分集 id。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    getDefaultEpisodeId(episodes) {
      // 条件分支: 路由 query 带 episodeId 时进入。
      // 执行内容: 优先选中详情页传来的目标分集。
      if (this.routeEpisodeId) {
        // 类型: object|null。
        // 作用: 在当前分集列表中查找路由指定分集。
        const routeMatchedEpisode = episodes.find(episode => episode && (episode.id === this.routeEpisodeId || episode.value === this.routeEpisodeId));

        // 条件分支: 找到路由指定分集时进入。
        // 执行内容: 返回该分集 id，让播放页和详情页选集保持一致。
        if (routeMatchedEpisode) {
          return routeMatchedEpisode.id || routeMatchedEpisode.value || '';
        }
      }

      // 条件分支: 路由 query 只带 episodeIndex 时进入。
      // 执行内容: 按集数兜底匹配分集。
      if (this.routeEpisodeIndex) {
        // 类型: object|null。
        // 作用: 查找 episodeNumber 或 index 与 query 相同的分集。
        const indexMatchedEpisode = episodes.find((episode) => {
          // 条件分支: 分集对象缺失时进入。
          // 执行内容: 返回 false，避免读取空字段。
          if (!episode) {
            return false;
          }

          // 类型: number。
          // 作用: 当前分集序号，用于和 query episodeIndex 比较。
          const episodeIndex = Number(episode.episodeNumber || episode.index || episode.episodeIndex);

          // 返回值类型: boolean。
          // 作用: 序号一致时认为命中详情页传来的分集。
          return episodeIndex === this.routeEpisodeIndex;
        });

        // 条件分支: 找到序号匹配分集时进入。
        // 执行内容: 返回该分集 id。
        if (indexMatchedEpisode) {
          return indexMatchedEpisode.id || indexMatchedEpisode.value || '';
        }
      }

      // 类型: object|undefined。
      // 作用: 查找第一个未被标记为不可播放的分集，作为默认候选。
      const playableEpisode = episodes.find(episode => episode && episode.playable !== false);

      // 类型: object|undefined。
      // 作用: 优先使用可播放分集，缺失时回退列表第一项。
      const fallbackEpisode = playableEpisode || episodes[0];

      // id 是 active 判断主字段，没有 id 时用 value 兜底。
      return fallbackEpisode ? fallbackEpisode.id || fallbackEpisode.value || '' : '';
    },

    /**
     * 获取默认播放线路 id。
     *
     * 调用位置：loadPlayerContent 请求成功后。
     * 页面影响：进入播放页时，顶部线路按钮默认选中可用线路。
     *
     * @param {object|null} playback 统一 ContentItem.playback 对象。
     * @param {Array<object>} sources 播放线路列表。
     * @param {string} episodeId 当前默认分集 id。
     * @returns {string} 默认播放线路 id。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    getDefaultPlaybackSourceId(playback, sources, episodeId) {
      // 类型: object|null。
      // 作用: 路由 query 指定播放线路时优先使用，query 缺失时不参与默认线路匹配。
      const routeSource = this.routePlaybackSourceId
        ? sources.find(source => source.id === this.routePlaybackSourceId)
        : null;

      // 类型: object|null。
      // 作用: 优先使用 playback.defaultSourceId 指向的线路，保证数据源可以指定首选线路。
      const configuredSource = sources.find(source => playback && source.id === playback.defaultSourceId);

      // 类型: object|null。
      // 作用: 如果存在当前分集对应线路，则作为第二优先级。
      const episodeSource = sources.find(source => source.episodeId === episodeId);

      // 类型: object|null。
      // 作用: 如果没有配置线路和分集线路，选择第一条 available 不为 false 的线路。
      const availableSource = sources.find(source => source.available !== false);

      // 类型: object|null。
      // 作用: 最终兜底到第一条线路，保证不可用线路也能被用户看到状态。
      const fallbackSource = routeSource || configuredSource || episodeSource || availableSource || sources[0];

      // 返回值类型: string。
      // 作用: 返回默认线路 id；没有线路时返回空字符串。
      return fallbackSource ? fallbackSource.id || '' : '';
    },

    /**
     * 请求播放页数据。
     *
     * 调用位置：created 生命周期、播放路由变化监听。
     * 页面影响：通过 sourceDataService 请求 player 数据桶，成功后模板从 getCurrentContentItem('player') 渲染。
     *
     * @returns {Promise<void>} 请求完成后不返回业务数据。
     * 副作用: 更新播放页加载与错误状态，通过 sourceDataService 写入 player 数据桶，并同步分集与线路。
     * 成功路径: 请求成功后 player 数据桶可供 selector 读取，并同步默认分集、线路、恢复提示和自动播放意图。
     * 失败路径: 请求或解析失败时捕获错误并写入 loadError；finally 始终关闭 loading，不向生命周期调用方继续抛错。
     */
    async loadPlayerContent() {
      // 副作用: 打开页面级加载状态，让用户知道播放数据正在刷新。
      this.loading = true;

      // 副作用: 清空旧错误，避免一次失败文案影响后续成功请求。
      this.loadError = '';

      try {
        // 类型: object。
        // 作用: 保存 player 页面的标准数据响应，response.item 已归一化写入实体池。
        const response = await requestSourceData({
          // 类型: string|undefined。
          // 作用: URL 中携带 sourceId 时使用指定数据源，没有时由 service 回退当前 activeSourceId。
          sourceId: this.routeSourceId || undefined,

          // 类型: string。
          // 作用: 告诉 provider 当前请求播放页单内容数据桶。
          pageKey: 'player',

          // 类型: object。
          // 作用: 单内容请求参数，contentId 定位播放目标，episodeId/episodeIndex 给外部数据源保留按集请求能力。
          params: {
            contentId: this.contentIdForRequest,
            episodeId: this.routeEpisodeId || undefined,
            episodeIndex: this.routeEpisodeIndex || undefined
          }
        });

        // 类型: object|null。
        // 作用: 当前响应命中的播放内容，没有命中时使用 null 进入空状态。
        const responseItem = response && response.item ? response.item : null;

        // 类型: Array<object>。
        // 作用: 从响应内容中读取分集列表，用于决定默认选中哪一集。
        const nextEpisodes = this.asList(responseItem && responseItem.episodes);

        // 类型: string。
        // 作用: 当前播放页默认分集 id，后续用于匹配播放线路。
        const nextEpisodeId = this.getDefaultEpisodeId(nextEpisodes);

        // 类型: object|null。
        // 作用: 从响应内容读取播放信息对象，用于挑选默认线路。
        const nextPlayback = responseItem && responseItem.playback ? responseItem.playback : null;

        // 类型: Array<object>。
        // 作用: 从响应内容读取播放线路数组，用于挑选默认线路。
        const nextSources = this.asList(nextPlayback && nextPlayback.sources);

        // 副作用: 每次新播放数据返回后，重置选中分集到可播放分集或第一集。
        this.selectedEpisodeId = nextEpisodeId;

        // 副作用: 每次新播放数据返回后，重置选中线路到默认线路或第一条可用线路。
        this.activePlaybackSourceId = this.getDefaultPlaybackSourceId(nextPlayback, nextSources, nextEpisodeId);

        // 副作用: 新播放内容进入后重置页面级用户状态覆盖和播放提示。
        this.localFavoriteOverride = null;

        // 副作用: 新播放内容进入后默认视为尚未写入播放状态，等待 autoplay 或播放按钮触发。
        this.hasStartedPlayback = false;

        // 副作用: 清空上一条恢复策略提示，等待 autoplay 或用户点击播放后再生成。
        this.resumeTipText = '';

        // 副作用: 详情页播放按钮带 autoplay 进入时，立即写 currentPlaying 和播放历史。
        this.handleRouteAutoPlayback();
      } catch (error) {
        // 副作用: 保存错误文案，交给整页空状态和播放器舞台展示。
        this.loadError = error && error.message ? error.message : '播放数据加载失败';
      } finally {
        // 副作用: 请求结束后关闭加载遮罩，无论成功失败都恢复页面交互。
        this.loading = false;
      }
    },

    /**
     * 选择播放线路。
     *
     * 调用位置：顶部播放线路按钮点击。
     * 页面影响：更新 activePlaybackSourceId，让线路按钮和播放器舞台文案同步切换。
     *
     * @param {object} line 用户点击的线路按钮对象。
     * @param {string} line.id 线路唯一标识。
     * @returns {void} 只更新页面状态，不返回业务数据。
     * 副作用: 写入 activePlaybackSourceId，切换当前线路及其派生播放信息。
     */
    selectPlaybackSource(line) {
      // 条件分支: 点击事件没有提供线路或线路 id 时进入。
      // 执行内容: 不改变 activePlaybackSourceId，避免写入无效线路状态。
      if (!line || !line.id) {
        return;
      }

      // 副作用: 更新当前线路 id，驱动 active 样式和播放信息派生计算。
      this.activePlaybackSourceId = line.id;

      // 条件分支: 当前页面已经写入播放状态时进入。
      // 执行内容: 切换线路后同步当前播放状态和历史记录中的播放线路。
      if (this.hasStartedPlayback) {
        this.syncPlaybackState('playing', this.getPlaybackStartSeconds());
      }
    },

    /**
     * 选择播放分集。
     *
     * 调用位置：右侧分集按钮点击。
     * 页面影响：更新 selectedEpisodeId，并尽量切换到该分集对应的播放线路。
     *
     * @param {Object} episode 用户点击的分集对象。
     * @returns {void} 只更新页面状态，不返回业务数据。
     * 副作用: 写入 selectedEpisodeId，并按分集匹配结果同步 activePlaybackSourceId。
     */
    selectEpisode(episode) {
      // 条件分支: 点击事件没有提供有效分集对象时进入。
      // 执行内容: 不改变分集和线路状态，避免空对象进入播放上下文。
      if (!episode) {
        return;
      }

      // 类型: string。
      // 作用: 当前点击分集的稳定 id，用于按钮 active 判断和线路匹配。
      const nextEpisodeId = episode.id || episode.value || '';

      // 副作用: 更新右侧分集按钮 active 状态。
      this.selectedEpisodeId = nextEpisodeId;

      // 类型: object|null。
      // 作用: 查找当前分集对应的播放线路，存在时自动切换线路。
      const matchedSource = this.playbackSources.find(source => source.episodeId === nextEpisodeId);

      // 条件分支: 当前分集存在对应线路时进入。
      // 执行内容: 自动选中该线路，保证播放舞台和分集选择保持一致。
      if (matchedSource) {
        this.activePlaybackSourceId = matchedSource.id || '';
      }

      // 条件分支: 当前页面已经写入播放状态时进入。
      // 执行内容: 切换分集后按目标分集历史计算起播秒数，再写入新的分集历史和当前播放状态。
      if (this.hasStartedPlayback) {
        // 类型: number。
        // 作用: selectedEpisodeId 已经更新，当前计算会读取目标分集的播放历史，避免固定从 0 覆盖已有进度。
        const startSeconds = this.getPlaybackStartSeconds();

        // 副作用: 使用目标分集恢复策略写入当前播放和播放历史。
        this.syncPlaybackState('playing', startSeconds);
      }
    },

    /**
     * 切换当前播放内容收藏状态。
     * 触发来源: 播放页右侧收藏按钮点击。
     * 副作用: 调用 userContentService.toggleFavorite 写入用户内容运行时状态。
     *
     * @returns {void} 写入收藏状态并更新当前页面按钮视觉。
     */
    handleToggleFavorite() {
      // 条件分支: 当前播放内容缺失时进入。
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
     * 点击播放按钮后同步播放状态。
     * 当前实现尚未接入真实 video 元素，因此只写入恢复策略决定的起始秒数。
     *
     * @returns {void} 写入当前播放和播放历史状态。
     * 副作用: 根据恢复策略写入当前播放状态和播放历史。
     */
    handleStartPlayback() {
      // 条件分支: 当前播放内容缺失时进入。
      // 执行内容: 不写入播放状态，避免生成无效历史记录。
      if (!this.video) {
        return;
      }

      // 副作用: 手动点击播放按钮时，按恢复策略写入当前播放和播放历史。
      this.startPlaybackFromCurrentContext();
    },

    /**
     * 处理路由自动播放意图。
     * 触发来源: loadPlayerContent 请求成功后。
     * 执行内容: 当详情页播放按钮带 autoplay 进入播放页时，自动写入 currentPlaying 和播放历史。
     *
     * @returns {object|null} 写入后的播放历史记录；不满足自动播放条件时返回 null。
     * 副作用: 消费路由 autoplay 意图，并在满足条件时启动当前播放上下文。
     */
    handleRouteAutoPlayback() {
      // 条件分支: 当前路由没有 autoplay 意图时进入。
      // 执行内容: 不写播放状态，避免导航栏直接打开播放页污染历史记录。
      if (!this.routeShouldAutoPlay) {
        return null;
      }

      // 返回值类型: object|null。
      // 作用: 由详情页播放入口自动进入播放状态，让卡片和后续个人中心立刻看到联动数据。
      return this.startPlaybackFromCurrentContext();
    },

    /**
     * 从当前播放上下文写入播放状态。
     * 当前上下文包括当前 ContentItem、当前分集、当前线路和恢复播放策略。
     *
     * @returns {object|null} 写入后的播放历史记录。
     * 副作用: 写入 currentPlaying、播放历史和页面恢复提示，建立当前播放会话。
     */
    startPlaybackFromCurrentContext() {
      // 条件分支: 当前播放内容缺失时进入。
      // 执行内容: 返回 null，避免生成没有内容引用的播放历史。
      if (!this.video) {
        return null;
      }

      // 类型: number。
      // 作用: 根据历史记录恢复策略计算本次播放起点，自动播放和手动播放都复用同一规则。
      const startSeconds = this.getPlaybackStartSeconds();

      // 副作用: 标记当前页面已经写入播放状态，后续切集和切线路会继续同步状态。
      this.hasStartedPlayback = true;

      // 副作用: 写入当前播放和播放历史，驱动其它页面 UserVideoCard 联动显示。
      return this.syncPlaybackState('playing', startSeconds);
    },

    /**
     * 获取本次播放起始秒数。
     * 读取 getPlaybackResumeDecision 的结果，当前实现只显示轻提示，不弹确认框。
     *
     * @returns {number} 本次播放起始秒数。
     * 副作用: 根据历史恢复决策写入 resumeTipText，并返回本次播放起始秒数。
     */
    getPlaybackStartSeconds() {
      // 类型: object。
      // 作用: 恢复播放策略由 userContentService 统一计算。
      const decision = this.resumeDecision || {};

      // 类型: number。
      // 作用: 统一整理恢复策略建议起播秒数，供提示文案和返回值共用。
      const startSeconds = Number(decision.startSeconds) > 0 ? Number(decision.startSeconds) : 0;

      // 条件分支: 历史记录接近结尾时进入。
      // 执行内容: 当前实现先提示可重播，但不直接从头播放。
      if (decision.mode === 'prompt-replay') {
        // 副作用: 写入轻量提示文案，播放舞台说明会展示给用户。
        this.resumeTipText = `上次播放已接近结尾，当前从 ${this.formatPlaybackSeconds(startSeconds)} 继续。`;
      } else /*
        条件分支: 恢复策略为 resume 且历史起始秒数大于 0 时进入。
        执行内容: 生成普通历史恢复提示，说明本次播放的起始位置。
      */ if (decision.mode === 'resume' && startSeconds > 0) {
        // 副作用: 普通历史恢复也写入提示，让用户知道本次确实从历史进度继续。
        this.resumeTipText = `已从上次播放位置 ${this.formatPlaybackSeconds(startSeconds)} 继续。`;
      } else {
        // 副作用: 无历史或接近开头时清空提示，保持从 0 开始不提示。
        this.resumeTipText = '';
      }

      // 返回值类型: number。
      // 作用: 使用恢复策略给出的起始秒数，异常时从 0 开始。
      return startSeconds;
    },

    /**
     * 格式化播放秒数。
     * 纯函数: 只根据 seconds 返回 mm:ss 或 HH:mm:ss 文案，不读取也不修改组件状态。
     * 使用场景: 播放恢复提示需要把 playedSeconds 转成用户可读时间。
     *
     * @param {number} seconds 播放进度秒数。
     * @returns {string} 用户可读播放时间，例如 08:12 或 01:46:50。
     */
    formatPlaybackSeconds(seconds) {
      // 类型: number。
      // 作用: 把异常输入兜底为 0，避免提示文案出现 NaN。
      const safeSeconds = Number(seconds) > 0 ? Math.floor(Number(seconds)) : 0;

      // 类型: number。
      // 作用: 计算小时数，超过一小时的内容使用 HH:mm:ss 展示。
      const hours = Math.floor(safeSeconds / 3600);

      // 类型: number。
      // 作用: 计算剩余分钟数，用于组合可读时间。
      const minutes = Math.floor((safeSeconds % 3600) / 60);

      // 类型: number。
      // 作用: 计算剩余秒数，用于组合可读时间。
      const remainSeconds = safeSeconds % 60;

      // 类型: string。
      // 作用: 两位分钟文本，保证 8 分钟显示为 08。
      const minuteText = String(minutes).padStart(2, '0');

      // 类型: string。
      // 作用: 两位秒钟文本，保证 5 秒显示为 05。
      const secondText = String(remainSeconds).padStart(2, '0');

      // 条件分支: 播放进度超过一小时后进入。
      // 执行内容: 返回带小时的时间文本，避免 90 分钟显示成 90:00。
      if (hours > 0) {
        // 类型: string。
        // 作用: 两位小时文本，保持和分钟秒钟格式一致。
        const hourText = String(hours).padStart(2, '0');

        // 返回值类型: string。
        // 作用: 返回 HH:mm:ss 格式给恢复提示使用。
        return `${hourText}:${minuteText}:${secondText}`;
      }

      // 返回值类型: string。
      // 作用: 返回 mm:ss 格式给恢复提示使用。
      return `${minuteText}:${secondText}`;
    },

    /**
     * 同步当前播放状态和播放历史记录。
     * 副作用: 写入 userContentStore.currentPlaying 和 userContentStore.playHistory.records。
     *
     * @param {string} playStatus 播放状态，当前实现主要使用 playing。
     * @param {number} playedSeconds 当前播放秒数。
     * @returns {object|null} 写入后的播放历史记录。
     */
    syncPlaybackState(playStatus, playedSeconds) {
      // 条件分支: 当前播放内容缺失时进入。
      // 执行内容: 返回 null，避免写入无内容历史。
      if (!this.video) {
        return null;
      }

      // 类型: object|null。
      // 作用: 当前分集对象，电影通常只有一个正片分集。
      const episode = this.selectedEpisode;

      // 类型: number|null。
      // 作用: 当前分集或电影总时长秒数，用于播放进度展示。
      const durationSeconds = this.getCurrentDurationSeconds();

      // 类型: object。
      // 作用: 当前播放状态对象，供全站卡片判断“正在播放”。
      const currentPlaying = {
        sourceId: this.video.sourceId,
        contentId: this.video.id,
        type: this.video.type,
        episodeId: episode ? episode.id || episode.value || this.routeEpisodeId : this.routeEpisodeId,
        episodeIndex: this.selectedEpisodeIndex,
        playbackSourceId: this.activePlaybackSourceId,
        playStatus,
        playedSeconds,
        durationSeconds,
        updatedAt: new Date().toISOString()
      };

      // 副作用: 写入当前播放状态，让列表卡片可以显示“正在播放”。
      updateCurrentPlaying(currentPlaying);

      // 返回值类型: object|null。
      // 作用: 写入播放历史，失败时返回 null。
      return upsertPlayHistory({
        contentItem: this.video,
        sourceId: this.video.sourceId,
        contentId: this.video.id,
        type: this.video.type,
        episode,
        episodeId: currentPlaying.episodeId,
        episodeIndex: currentPlaying.episodeIndex,
        playedSeconds,
        durationSeconds,
        playStatus,
        playbackSourceId: this.activePlaybackSourceId
      });
    },

    /**
     * 读取当前播放目标总时长秒数。
     * 优先使用分集时长，缺失时读取电影或内容级 duration。
     *
     * @returns {number|null} 当前播放目标总时长秒数。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    getCurrentDurationSeconds() {
      // 类型: object|null。
      // 作用: 当前分集对象，电视剧优先从分集读取时长。
      const episode = this.selectedEpisode;

      // 类型: object。
      // 作用: 电影扩展字段对象，用于读取电影片长。
      const movie = this.video && this.video.movie ? this.video.movie : {};

      // 类型: Array<*>。
      // 作用: 按优先级列出可能的时长字段。
      const durationCandidates = [
        episode && episode.durationSeconds,
        episode && episode.duration,
        movie.durationSeconds,
        movie.duration,
        this.video && this.video.durationSeconds,
        this.video && this.video.duration
      ];

      // 循环类型: for...of。
      // 初始值: durationCandidates 中第一项。
      // 终止条件: 找到第一个有效秒数或候选项全部检查完。
      // 循环作用: 从多个可能字段中找出可写入播放历史的总时长秒数。
      for (const candidate of durationCandidates) {
        // 类型: number|null。
        // 作用: 尝试把当前候选时长转换为秒数。
        const seconds = this.parseDurationToSeconds(candidate);

        // 条件分支: 当前候选成功转换成正秒数时进入。
        // 执行内容: 返回该秒数作为总时长。
        if (seconds) {
          return seconds;
        }
      }

      // 返回值类型: null。
      // 作用: 没有可识别总时长时让播放历史只保存已播放时间。
      return null;
    },

    /**
     * 把时长字段转换为秒数。
     * 支持秒数、分钟文案、mm:ss 和 HH:mm:ss。
     *
     * @param {string|number|null} value 原始时长字段。
     * @returns {number|null} 可写入历史记录的秒数。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    parseDurationToSeconds(value) {
      // 条件分支: 时长字段为空时进入。
      // 执行内容: 返回 null，继续尝试其它候选字段。
      if (value === null || value === undefined || value === '') {
        return null;
      }

      // 条件分支: 时长本身就是正数字时进入。
      // 执行内容: 直接按秒数返回。
      if (typeof value === 'number') {
        return value > 0 ? value : null;
      }

      // 类型: string。
      // 作用: 统一转成字符串，方便匹配分钟文案和冒号时间。
      const rawValue = String(value).trim();

      // 条件分支: 纯数字字符串时进入。
      // 执行内容: 按秒数返回。
      if (/^\d+$/.test(rawValue)) {
        return Number(rawValue);
      }

      // 类型: RegExpMatchArray|null。
      // 作用: 匹配“46分钟”这类时长文案。
      const minuteMatch = rawValue.match(/^(\d+)\s*分钟$/);

      // 条件分支: 命中分钟文案时进入。
      // 执行内容: 转成秒数返回。
      if (minuteMatch) {
        return Number(minuteMatch[1]) * 60;
      }

      // 条件分支: 命中 mm:ss 或 HH:mm:ss 时进入。
      // 执行内容: 按冒号分段转换为秒数。
      if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(rawValue)) {
        // 类型: Array<number>。
        // 作用: 把时间片段转换成数字。
        const parts = rawValue.split(':').map(part => Number(part));

        // 条件分支: 三段时间时进入。
        // 执行内容: 按 HH:mm:ss 转换。
        if (parts.length === 3) {
          return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        // 返回值类型: number。
        // 作用: 两段时间按 mm:ss 转换。
        return parts[0] * 60 + parts[1];
      }

      // 返回值类型: null。
      // 作用: 无法识别的时长不写入历史总时长。
      return null;
    },

    /**
     * 离开或切换播放目标时清理当前播放状态。
     *
     * @returns {void} 只在当前页面曾主动播放时清理 currentPlaying。
     * 副作用: 在当前播放记录属于本页内容时调用服务清空 currentPlaying。
     */
    clearCurrentPlayingIfNeeded() {
      // 条件分支: 当前页面没有主动播放过时进入。
      // 执行内容: 不清理 currentPlaying，避免误清其它来源写入的播放状态。
      if (!this.hasStartedPlayback) {
        return;
      }

      // 副作用: 清空当前播放状态，让其它页面卡片不再显示正在播放。
      updateCurrentPlaying(null);

      // 副作用: 重置当前页面播放标记，避免重复清理。
      this.hasStartedPlayback = false;
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 播放页根容器 .player-view。
  样式作用:
  桌面占满 App.vue 播放主体并关闭页面级滚动。
  移动端由媒体查询恢复内部纵向滚动。
*/
.player-view {
  /* 占满播放主体宽度。 */
  width: 100%;
  /* 占满导航和页脚之间的高度。 */
  height: 100%;
  /* 允许左右两列在紧凑桌面横向收缩。 */
  min-width: 0;
  /* 允许两个独立纵向布局在固定播放外壳中收缩。 */
  min-height: 0;
  /* 把内边距纳入尺寸计算。 */
  box-sizing: border-box;
  /* 桌面只允许右侧线路和分集列表内部滚动。 */
  overflow: hidden;
  /* 使用播放页深色背景。 */
  background: linear-gradient(180deg, #111c2e 0%, #101827 100%);
  /* 提供紧凑桌面安全距离。 */
  padding: 18px 24px;
  /* 深色页面使用浅色文字。 */
  color: #f8fafc;
}

/*
  作用容器: 播放页双列外壳 .player-shell。
  样式作用:
  桌面只负责划分左侧主播放列和右侧操作列。
  让两列分别管理自己的纵向行高，避免顶部区域互相绑定。
*/
.player-shell {
  /* 使用 Grid 建立两个职责独立的桌面列。 */
  display: grid;
  /* 左列消费剩余空间，右列按视口在 320px 到 520px 之间响应式变化。 */
  grid-template-columns: minmax(0, 1fr) clamp(320px, 30vw, 520px);
  /* 设置左右列间距，保持播放器和操作面板边界清晰。 */
  gap: 24px;
  /* 占满播放页可用高度。 */
  height: 100%;
  /* 允许左右列收缩。 */
  min-width: 0;
  /* 允许两列内部的剩余高度轨道收缩。 */
  min-height: 0;
}

/*
  作用容器: 左侧主播放列 .player-main-column。
  样式作用:
  桌面独立排列内容信息和播放器。
  让播放器消费信息面板之外的全部剩余高度，不受右侧线路区域高度影响。
*/
.player-main-column {
  /* 使用独立 Grid 管理左列两块内容。 */
  display: grid;
  /* 内容信息按自身高度生成，播放器消费剩余高度。 */
  grid-template-rows: max-content minmax(0, 1fr);
  /* 明确桌面左列顺序，供移动端在同一容器内安全重排。 */
  grid-template-areas: "meta" "player";
  /* 保持信息面板和播放器之间的纵向分隔。 */
  gap: 16px;
  /* 允许左列随父级轨道横向收缩。 */
  min-width: 0;
  /* 允许播放器轨道在固定视口高度中收缩。 */
  min-height: 0;
}

/*
  作用容器: 右侧播放操作列 .player-side-column。
  样式作用:
  桌面独立排列线路列表和分集列表。
  使用相对高度分配保持两个操作区同时可见，并让各自列表独立滚动。
*/
.player-side-column {
  /* 使用独立 Grid 管理右列两块操作面板。 */
  display: grid;
  /* 线路区域约占三分之一，分集区域消费其余高度；两个轨道都允许内容收缩。 */
  grid-template-rows: minmax(150px, .36fr) minmax(0, .64fr);
  /* 明确桌面右列顺序，移动端继续沿用同一 DOM 顺序。 */
  grid-template-areas: "lines" "playlist";
  /* 保持线路和分集面板之间的纵向分隔。 */
  gap: 12px;
  /* 允许右列随响应式宽度轨道收缩。 */
  min-width: 0;
  /* 允许两个列表在固定视口高度中建立内部滚动。 */
  min-height: 0;
}

/*
  作用容器: 播放器舞台 .player-surface。
  样式作用:
  桌面填满左下区域，移动端移动到页面最上方。
*/
.player-surface {
  /* 放入左侧主播放列的 player 区域。 */
  grid-area: player;
  /* 填满所在区域宽度。 */
  width: 100%;
  /* 桌面填满第二行高度。 */
  height: 100%;
  /* 允许随剩余高度收缩。 */
  min-height: 0;
  /* 允许横向收缩。 */
  min-width: 0;
  /* 使用 flex 居中播放状态。 */
  display: flex;
  /* 垂直居中。 */
  align-items: center;
  /* 水平居中。 */
  justify-content: center;
  /* 使用播放器黑色背景。 */
  background: #05070b;
  /* 使用弱边框区分舞台。 */
  border: 1px solid rgba(148, 163, 184, .14);
  /* 裁切未来播放器画面溢出。 */
  overflow: hidden;
}

/*
  作用容器: 播放器状态 .player-state。
  样式作用:
  纵向居中组织播放按钮和状态文本，不使用人工大留白。
*/
.player-state {
  /* 使用 flex 组织状态。 */
  display: flex;
  /* 纵向排列状态元素。 */
  flex-direction: column;
  /* 水平居中状态元素。 */
  align-items: center;
  /* 使用统一元素间距。 */
  gap: 12px;
  /* 限制状态文案行长。 */
  max-width: 620px;
  /* 提供内部安全距离。 */
  padding: 24px;
  /* 居中显示状态文字。 */
  text-align: center;
}

/*
  作用容器: 播放按钮 .player-play-button。
  样式作用:
  提供稳定、高对比的开始播放入口。
*/
.player-play-button {
  /* 设置桌面按钮宽度。 */
  width: 82px;
  /* 保证清晰点击高度。 */
  height: 54px;
  /* 清除默认内边距。 */
  padding: 0;
  /* 使用深色半透明背景。 */
  background: rgba(15, 23, 42, .76);
  /* 使用浅色边框强化入口。 */
  border: 2px solid rgba(226, 232, 240, .82);
  /* 使用轻微圆角。 */
  border-radius: 8px;
  /* 使用白色图标。 */
  color: #fff;
  /* 设置播放图标大小。 */
  font-size: 26px;
  /* 提示按钮可点击。 */
  cursor: pointer;
}

/*
  作用容器: 播放地址状态标签 .player-state-label。
  样式作用:
  作为播放器内部第一级辅助状态，提示播放地址已经准备完成。
*/
.player-state-label {
  /* 清除默认边距。 */
  margin: 0;
  /* 使用辅助字号。 */
  font-size: 13px;
  /* 使用较粗字重。 */
  font-weight: 700;
  /* 使用已准备状态蓝色。 */
  color: #93c5fd;
}

/*
  作用容器: 播放格式标题 .player-state-title。
  样式作用:
  作为播放器内部主视觉文字，展示 mp4、m3u8 等当前线路格式。
*/
.player-state-title {
  /* 清除默认边距。 */
  margin: 0;
  /* 使用响应式格式字号。 */
  font-size: clamp(30px, 4vw, 48px);
  /* 使用紧凑行高。 */
  line-height: 1.1;
  /* 使用白色主文字。 */
  color: #fff;
}

/*
  作用容器: 播放状态说明 .player-state-text。
  样式作用:
  展示恢复位置、不可用原因或播放来源说明，并允许长文本安全换行。
*/
.player-state-text {
  /* 清除默认边距。 */
  margin: 0;
  /* 使用正文提示字号。 */
  font-size: 15px;
  /* 使用舒适行高。 */
  line-height: 1.6;
  /* 使用浅灰辅助文字。 */
  color: #d1d5db;
  /* 允许长文本安全断行。 */
  overflow-wrap: anywhere;
}

/*
  作用容器: 内容信息面板 .player-meta-panel。
  样式作用:
  在左列顶部组织内容身份、播放上下文和收藏操作。
  通过命名区域保证长标题和来源文本不会挤出收藏按钮。
*/
.player-meta-panel {
  /* 放入左侧主播放列的 meta 区域。 */
  grid-area: meta;
  /* 使用 Grid 让身份与上下文位于左侧、收藏操作稳定停靠右侧。 */
  display: grid;
  /* 左列允许文本收缩，右列只占收藏按钮实际宽度。 */
  grid-template-columns: minmax(0, 1fr) auto;
  /* 身份区域占满首行，上下文位于左下，收藏操作固定在右下。 */
  grid-template-areas: "identity identity" "context favorite";
  /* 让第二行上下文 Chip 和收藏按钮沿信息框底部对齐。 */
  align-items: end;
  /* 设置身份、上下文和收藏之间的行列间距。 */
  gap: 12px 20px;
  /* 提供面板内边距。 */
  padding: 16px 18px;
  /* 使用统一深色面板底。 */
  background: rgba(9, 15, 26, .82);
  /* 使用弱边框。 */
  border: 1px solid rgba(148, 163, 184, .16);
  /* 允许左侧文本轨道随主播放列收缩。 */
  min-width: 0;
}

/*
  作用容器: 内容身份区域 .player-meta-identity。
  样式作用:
  横向排列视频标题和内容类型。
  空间不足时允许类型标签换到标题下一行，不反向撑宽主播放列。
*/
.player-meta-identity {
  /* 放入内容信息面板的身份区域。 */
  grid-area: identity;
  /* 使用 flex 横向组织标题和类型标签。 */
  display: flex;
  /* 按文本基线对齐两种字号。 */
  align-items: baseline;
  /* 允许标题过长时把类型标签换到下一行。 */
  flex-wrap: wrap;
  /* 保持标题和类型之间的横向与纵向间距。 */
  gap: 8px 12px;
  /* 允许内容身份区域横向收缩。 */
  min-width: 0;
}

/*
  作用容器: 视频标题 .player-title。
  样式作用:
  强化当前播放内容名称，并允许长标题在身份区域安全断行。
*/
.player-title {
  /* 清除标题默认边距。 */
  margin: 0;
  /* 使用响应式标题字号。 */
  font-size: clamp(22px, 2vw, 30px);
  /* 控制长标题行高。 */
  line-height: 1.18;
  /* 加粗内容名称。 */
  font-weight: 750;
  /* 使用浅色标题。 */
  color: #f8fafc;
  /* 只按标题真实内容和可用宽度伸缩，让类型标签紧接标题而不是停靠右侧。 */
  flex: 0 1 auto;
  /* 清除最小内容宽度。 */
  min-width: 0;
  /* 允许长标题安全断行。 */
  overflow-wrap: anywhere;
}

/*
  作用容器: 内容类型标签 .player-type-badge。
  样式作用:
  用稳定标签区分电影和电视剧，不参与标题宽度压缩。
*/
.player-type-badge {
  /* 使用内联 flex 居中文字。 */
  display: inline-flex;
  /* 垂直居中类型文字。 */
  align-items: center;
  /* 保持类型标签高度。 */
  min-height: 28px;
  /* 提供标签横向留白。 */
  padding: 0 10px;
  /* 使用主题蓝背景。 */
  background: rgba(91, 140, 255, .16);
  /* 使用主题蓝边框。 */
  border: 1px solid rgba(91, 140, 255, .3);
  /* 使用轻微圆角。 */
  border-radius: 6px;
  /* 使用浅蓝文字。 */
  color: #c9d8ff;
  /* 使用辅助字号。 */
  font-size: 13px;
  /* 保持类型自身宽度。 */
  flex: 0 0 auto;
  /* 禁止类型换行。 */
  white-space: nowrap;
}

/*
  作用容器: 播放上下文区域 .player-meta-context。
  样式作用:
  展示当前数据源和实际激活线路名称。
  允许长来源或线路名称安全换行，不建立第二份播放状态。
*/
.player-meta-context {
  /* 放入内容信息面板的上下文区域。 */
  grid-area: context;
  /* 使用 flex 横向排列数据源和当前线路。 */
  display: flex;
  /* 让不同长度的上下文字段按首行垂直居中。 */
  align-items: center;
  /* 空间不足时允许字段换到下一行。 */
  flex-wrap: wrap;
  /* 保持数据源和当前线路之间的间距。 */
  gap: 8px 18px;
  /* 允许上下文区域随主播放列收缩。 */
  min-width: 0;
}

/*
  作用容器: 播放上下文 Chip .player-context-chip。
  样式作用:
  把数据源和当前线路显示为可扫描的胶囊标签。
  长文本在 Chip 边界内省略，避免反向撑宽内容信息面板。
*/
.player-context-chip {
  /* 使用内联 flex 垂直居中 Chip 文本。 */
  display: inline-flex;
  /* 垂直居中数据源或当前线路文案。 */
  align-items: center;
  /* 允许 Chip 在信息面板宽度不足时收缩。 */
  flex: 0 1 auto;
  /* 清除文本默认最小内容宽度，允许 Chip 安全收缩。 */
  min-width: 0;
  /* 限制 Chip 不超过上下文区域宽度。 */
  max-width: 100%;
  /* 保持紧凑 Chip 高度，避免信息框重新变得臃肿。 */
  min-height: 26px;
  /* 提供胶囊标签所需的横向安全留白。 */
  padding: 0 9px;
  /* 使用低饱和蓝色背景区分普通说明文本。 */
  background: rgba(91, 140, 255, .12);
  /* 使用弱蓝色边框强化 Chip 边界。 */
  border: 1px solid rgba(91, 140, 255, .24);
  /* 使用胶囊圆角形成上下文字段标签。 */
  border-radius: 999px;
  /* 使用浅蓝灰颜色降低上下文相对标题的视觉层级。 */
  color: #b9c8de;
  /* 使用紧凑辅助字号保持信息框密度。 */
  font-size: 13px;
  /* 隐藏超过 Chip 最大宽度的长上下文文案。 */
  overflow: hidden;
  /* 使用省略号提示数据源或线路名称被截断。 */
  text-overflow: ellipsis;
  /* 保持单个 Chip 文案单行，稳定上下文行高度。 */
  white-space: nowrap;
  /* 把内边距与边框纳入 Chip 高度和宽度计算。 */
  box-sizing: border-box;
}

/*
  作用容器: 收藏操作 .player-favorite-button。
  样式作用:
  桌面固定在内容信息面板右侧并跨越两行信息。
  保持按钮完整触控宽度，不被标题或来源文本压缩。
*/
.player-favorite-button {
  /* 放入内容信息面板的收藏区域。 */
  grid-area: favorite;
  /* 保持按钮自身宽度，不拉伸填满右侧轨道。 */
  justify-self: end;
  /* 沿信息面板第二行底部对齐，形成右下角收藏操作。 */
  align-self: end;
}

/*
  作用容器: 播放线路面板 .player-lines-panel。
  样式作用:
  桌面位于右侧操作列顶部并独立管理线路列表滚动。
  固定标题与线路网格职责，避免线路数量改变播放器布局。
*/
.player-lines-panel {
  /* 放入右侧操作列的 lines 区域。 */
  grid-area: lines;
  /* 使用 flex 纵向组织区域标题和线路网格。 */
  display: flex;
  /* 让标题和线路列表从上到下排列。 */
  flex-direction: column;
  /* 保持区域标题和线路网格之间的距离。 */
  gap: 14px;
  /* 提供面板内边距。 */
  padding: 16px;
  /* 把内边距纳入右侧操作列的轨道高度。 */
  box-sizing: border-box;
  /* 使用统一深色面板底。 */
  background: rgba(9, 15, 26, .82);
  /* 使用弱边框。 */
  border: 1px solid rgba(148, 163, 184, .16);
  /* 允许横向收缩。 */
  min-width: 0;
  /* 允许线路网格在固定右侧轨道中建立内部滚动。 */
  min-height: 0;
}

/*
  作用容器: 线路和分集共用网格 .player-option-grid。
  样式作用:
  桌面使用固定紧凑轨道，从左上角排列线路或分集按钮。
  列表超出面板高度时各自在所属面板内部滚动，单项不拉伸。
*/
.player-option-grid {
  /* 使用 Grid 为线路和分集建立同一排列体系。 */
  display: grid;
  /* 自动填充 76px 固定轨道，使桌面按钮宽度约缩小三分之一。 */
  grid-template-columns: repeat(auto-fill, 76px);
  /* 桌面固定 32px 行高，使按钮高度从 48px 缩小三分之一。 */
  grid-auto-rows: 32px;
  /* 从面板左上角开始排列选项行。 */
  align-content: start;
  /* 让固定宽度轨道从左侧开始，不均摊面板剩余宽度。 */
  justify-content: start;
  /* 使用统一紧凑间距组织线路和分集按钮。 */
  gap: 8px;
  /* 消费标题之外的可用高度。 */
  flex: 1 1 auto;
  /* 允许共用网格随右侧操作列横向收缩。 */
  min-width: 0;
  /* 允许共用网格在固定面板轨道中纵向收缩。 */
  min-height: 0;
  /* 选项过多时只滚动当前所属列表，不推动相邻面板。 */
  overflow-y: auto;
  /* 给内部滚动条预留轻微距离，避免贴住按钮。 */
  padding-right: 2px;
}

/*
  作用容器: 线路和分集共用按钮 .player-option-chip。
  样式作用:
  统一两类按钮的默认背景、边框、字号、圆角和文本处理。
  长线路或分集名称在按钮边界内省略，不反向撑宽操作面板。
*/
.player-option-chip {
  /* 清除平台默认外观。 */
  appearance: none;
  /* 填满共用固定网格单元宽度。 */
  width: 100%;
  /* 填满当前设备模式的固定选项行高度。 */
  height: 100%;
  /* 清除按钮默认最小内容宽度。 */
  min-width: 0;
  /* 清除反向最小高度，严格服从共用网格行。 */
  min-height: 0;
  /* 提供紧凑横向留白，让正常线路和分集名称在 76px 桌面轨道中完整显示。 */
  padding: 0 3px;
  /* 使用分集按钮的蓝色默认背景作为两类选项共同视觉。 */
  background: rgba(30, 58, 112, .55);
  /* 使用主题蓝弱边框统一两类选项轮廓。 */
  border: 1px solid rgba(91, 140, 255, .26);
  /* 使用缩小后的轻量圆角匹配 32px 桌面按钮高度。 */
  border-radius: 6px;
  /* 使用浅色文字保证深蓝背景上的可读性。 */
  color: #e5edff;
  /* 桌面统一使用比原按钮小一号的 12px 字体。 */
  font-size: 12px;
  /* 使用较粗字重强化紧凑按钮的可识别性。 */
  font-weight: 700;
  /* 使用 flex 同时居中线路和分集文字。 */
  display: flex;
  /* 水平居中选项文字。 */
  justify-content: center;
  /* 垂直居中选项文字。 */
  align-items: center;
  /* 隐藏超出按钮宽度的选项名称。 */
  overflow: hidden;
  /* 使用省略号提示线路或分集名称被截断。 */
  text-overflow: ellipsis;
  /* 保持选项名称单行，稳定共用按钮行高。 */
  white-space: nowrap;
  /* 提示按钮可点击。 */
  cursor: pointer;
  /* 把内边距和边框纳入固定网格尺寸。 */
  box-sizing: border-box;
}

/*
  作用容器: 当前激活选项按钮 .player-option-chip.active。
  样式作用:
  使用同一主题蓝强调当前线路或当前分集。
  消除线路暖色和分集蓝色两套激活视觉之间的差异。
*/
.player-option-chip.active {
  /* 使用亮蓝色激活背景统一线路和分集选中态。 */
  background: rgba(59, 99, 180, .76);
  /* 增强激活边框，清晰区分当前选项和普通选项。 */
  border-color: rgba(91, 140, 255, .56);
  /* 使用浅色激活文字保证选中状态可读性。 */
  color: #f8fafc;
  /* 使用轻量内阴影强化激活按钮边界。 */
  box-shadow: inset 0 0 0 1px rgba(91, 140, 255, .1);
}

/*
  作用容器: 分集面板 .playlist-panel。
  样式作用:
  桌面填满右侧操作列下方轨道并独立管理分集滚动。
  移动端随页面内容自然展开，避免嵌套滚动影响触控操作。
*/
.playlist-panel {
  /* 放入右侧操作列的 playlist 区域。 */
  grid-area: playlist;
  /* 纵向组织标题和列表。 */
  display: flex;
  /* 设置内容纵向排列。 */
  flex-direction: column;
  /* 保持标题与列表间距。 */
  gap: 14px;
  /* 填满右侧操作列下方轨道。 */
  height: 100%;
  /* 允许随右侧下方轨道收缩。 */
  min-height: 0;
  /* 允许右列收缩。 */
  min-width: 0;
  /* 提供面板内边距。 */
  padding: 16px;
  /* 把内边距纳入尺寸。 */
  box-sizing: border-box;
  /* 使用统一面板背景。 */
  background: rgba(9, 15, 26, .82);
  /* 使用弱边框。 */
  border: 1px solid rgba(148, 163, 184, .16);
}

/*
  作用容器: 线路和分集区域标题 .player-panel-title。
  样式作用:
  统一右侧两个操作面板的标题层级和视觉基线。
  保持标题自身高度稳定，不参与列表内部滚动。
*/
.player-panel-title {
  /* 清除标题元素浏览器默认外边距。 */
  margin: 0;
  /* 使用统一操作区域标题字号。 */
  font-size: 19px;
  /* 使用较粗字重强化线路和分集区域边界。 */
  font-weight: 720;
  /* 使用浅色标题保证深色面板可读性。 */
  color: #f8fafc;
}

/*
  作用容器: 分集局部空状态 .playlist-empty。
  样式作用:
  在没有分集数据时消费面板剩余高度，并允许固定桌面轨道安全收缩。
*/
.playlist-empty {
  /* 消费标题之外的剩余高度。 */
  flex: 1 1 auto;
  /* 允许空状态收缩。 */
  min-height: 0;
}

/*
  作用容器: 播放页整页空状态 .player-page-empty。
  样式作用:
  在请求失败或没有播放内容时填满播放主体，并保持深色页面视觉。
*/
.player-page-empty {
  /* 占满播放页高度。 */
  height: 100%;
  /* 避免固定高度撑出外壳。 */
  min-height: 0;
  /* 使用深色空状态背景。 */
  background: rgba(9, 15, 26, .82);
  /* 使用弱边框。 */
  border: 1px solid rgba(148, 163, 184, .14);
}

/*
  响应式断点: 961px 至 1280px。
  断点来源: 播放页右侧操作列的最小可读按钮宽度。
  作用范围: 紧凑桌面和小尺寸桌面窗口。
  样式作用:
  保持桌面左右双列结构并收窄操作列。
  线路和分集继续使用共用固定紧凑轨道自动填充，不在断点内维护第二套列数。
*/
@media (min-width: 961px) and (max-width: 1280px) {
  /*
    作用容器: 紧凑桌面播放页外壳 .player-shell。
    样式作用:
    限制右侧操作列最大宽度，为左侧播放器保留可用画面宽度。
  */
  .player-shell {
    /* 让右侧操作列在 320px 到 360px 之间响应式变化。 */
    grid-template-columns: minmax(0, 1fr) clamp(320px, 32vw, 360px);
    /* 收紧紧凑桌面的左右列间距，避免播放器被间距过度挤压。 */
    gap: 18px;
  }

}

/*
  响应式断点: (min-width: 961px) and (max-height: 720px)。
  作用范围: 当前样式块内在该媒体条件下命中的页面或组件元素。
  样式作用:
  响应式条件: 桌面宽度且视口高度不超过 720px。
  断点来源: 低高度笔记本和桌面分屏窗口的一屏可用空间。
  作用范围: 仍保持双列结构的低高度桌面。
  样式作用:
  统一收紧页面、面板和模块间距，不改变模块职责、顺序或滚动边界。
*/
@media (min-width: 961px) and (max-height: 720px) {
  /*
    作用容器: 低高度桌面播放页 .player-view。
    样式作用:
    减少页面安全边距，把更多视口高度留给播放器和操作列表。
  */
  .player-view {
    /* 使用低高度桌面的紧凑内边距。 */
    padding: 12px 18px;
  }

  /*
    作用容器: 低高度桌面播放页外壳 .player-shell。
    样式作用:
    收紧左右列间距，提升可用画面面积。
  */
  .player-shell {
    /* 减少低高度桌面的左右列分隔距离。 */
    gap: 18px;
  }

  /*
    作用容器: 低高度桌面的左右独立纵向列。
    样式作用:
    收紧列内面板距离，不改变各列独立行高职责。
  */
  .player-main-column,
  .player-side-column {
    /* 减少低高度桌面的列内纵向间距。 */
    gap: 10px;
  }

  /*
    作用容器: 低高度桌面内容信息面板 .player-meta-panel。
    样式作用:
    收紧信息面板留白和字段距离，为播放器释放高度。
  */
  .player-meta-panel {
    /* 使用更紧凑的低高度桌面内边距。 */
    padding: 10px 14px;
    /* 减少身份、上下文与收藏操作之间的距离。 */
    gap: 8px 16px;
  }

  /*
    作用容器: 低高度桌面的线路和分集面板。
    样式作用:
    收紧操作面板留白，保留更多列表可见行。
  */
  .player-lines-panel,
  .playlist-panel {
    /* 使用低高度桌面的紧凑面板内边距。 */
    padding: 12px;
    /* 减少区域标题和按钮网格之间的距离。 */
    gap: 10px;
  }
}

/*
  响应式断点: max-width 960px。
  断点来源: 播放页专用结构断点。
  作用范围: 平板、窄屏窗口和手机。
  样式作用:
  改为播放器、信息、线路、分集顺序，并恢复页面内部单一纵向滚动。
*/
@media (max-width: 960px) {
  /*
    作用容器: 平板和手机播放页 .player-view。
    样式作用:
    允许访问播放器下方的信息与操作区域，并提供平板安全边距。
  */
  .player-view {
    /* 恢复播放页内部纵向滚动，承载单列自然内容高度。 */
    overflow-y: auto;
    /* 使用平板安全边距，避免内容贴近视口边缘。 */
    padding: 18px 20px;
  }

  /*
    作用容器: 平板和手机播放页外壳 .player-shell。
    样式作用:
    把桌面双列切换为单列，主播放列和右侧操作列按 DOM 顺序纵向排列。
  */
  .player-shell {
    /* 平板和手机只使用一列可收缩轨道。 */
    grid-template-columns: minmax(0, 1fr);
    /* 设置主播放列和操作列之间的纵向距离。 */
    gap: 16px;
    /* 高度由播放器、信息、线路和分集内容自然决定。 */
    height: auto;
    /* 内容较少时仍覆盖播放主体可用高度。 */
    min-height: 100%;
  }

  /*
    作用容器: 平板和手机左侧主播放列 .player-main-column。
    样式作用:
    在同一组真实节点内把播放器调整到内容信息之前。
  */
  .player-main-column {
    /* 播放器和信息面板都按自身内容高度生成。 */
    grid-template-rows: auto auto;
    /* 明确播放器优先顺序，满足进入播放页先看到播放器的要求。 */
    grid-template-areas: "player" "meta";
    /* 设置播放器和信息面板之间的纵向距离。 */
    gap: 16px;
  }

  /*
    作用容器: 平板和手机右侧操作列 .player-side-column。
    样式作用:
    取消桌面固定比例轨道，让线路和分集面板随内容自然展开。
  */
  .player-side-column {
    /* 线路和分集都按自身内容高度生成。 */
    grid-template-rows: auto auto;
    /* 设置线路与分集面板之间的纵向距离。 */
    gap: 16px;
  }

  /*
    作用容器: 平板和手机播放器舞台 .player-surface。
    样式作用:
    取消桌面剩余高度职责，使用稳定视频比例展示播放器。
  */
  .player-surface {
    /* 由宽高比决定播放器自然高度。 */
    height: auto;
    /* 使用标准 16:9 视频比例。 */
    aspect-ratio: 16 / 9;
  }

  /*
    作用容器: 平板和手机的线路与分集面板。
    样式作用:
    取消桌面固定轨道高度，让面板加入页面单一纵向滚动链。
  */
  .player-lines-panel,
  .playlist-panel {
    /* 面板高度由标题和按钮网格自然决定。 */
    height: auto;
    /* 取消桌面轨道对面板最小高度的约束。 */
    min-height: 0;
  }

  /*
    作用容器: 平板和手机的共用选项网格 .player-option-grid。
    样式作用:
    使用 174px 最小轨道形成三至四列，按钮高度调整为 36px，并取消列表自身滚动。
  */
  .player-option-grid {
    /* 根据可用宽度自动形成三至四列，641px 仍可容纳三列。 */
    grid-template-columns: repeat(auto-fill, minmax(174px, 1fr));
    /* 平板按钮使用 36px 行高，在紧凑视觉和触控可用性之间平衡。 */
    grid-auto-rows: 36px;
    /* 按按钮内容自然展开，不消费虚构剩余高度。 */
    flex: 0 0 auto;
    /* 取消桌面内部滚动，统一由播放页承担纵向滚动。 */
    overflow-y: visible;
    /* 取消桌面滚动条预留距离。 */
    padding-right: 0;
  }
}

/*
  响应式断点: max-width 640px。
  断点来源: 统一手机视口边界。
  作用范围: 手机和更窄视口。
  样式作用:
  保持播放器优先，收紧密度并固定线路和分集为两列。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机播放页 .player-view。
    样式作用:
    使用紧凑安全边距，为播放器和两列按钮保留宽度。
  */
  .player-view {
    /* 使用手机紧凑内边距。 */
    padding: 14px;
  }

  /*
    作用容器: 手机播放页的外壳与两个内部列。
    样式作用:
    统一缩小模块间距，保持整页纵向节奏一致。
  */
  .player-shell,
  .player-main-column,
  .player-side-column {
    /* 使用手机统一模块间距。 */
    gap: 14px;
  }

  /*
    作用容器: 手机播放器状态 .player-state。
    样式作用:
    收紧播放器内部留白，让小屏仍能完整看到播放入口和恢复提示。
  */
  .player-state {
    /* 减少状态元素之间的纵向距离。 */
    gap: 8px;
    /* 收紧播放器状态区域内边距。 */
    padding: 14px;
  }

  /*
    作用容器: 手机播放按钮 .player-play-button。
    样式作用:
    缩小视觉尺寸，同时保持清晰触控高度。
  */
  .player-play-button {
    /* 缩小手机播放按钮宽度。 */
    width: 68px;
    /* 保持不低于常用触控尺寸的按钮高度。 */
    height: 46px;
    /* 同步缩小播放图标，维持按钮内部比例。 */
    font-size: 23px;
  }

  /*
    作用容器: 手机播放器格式标题 .player-state-title。
    样式作用:
    使用适合手机播放器舞台的格式字号。
  */
  .player-state-title {
    /* 缩小格式标题，避免 mp4 或 m3u8 占用过多垂直空间。 */
    font-size: 30px;
  }

  /*
    作用容器: 手机播放器状态说明 .player-state-text。
    样式作用:
    在保持可读性的同时降低长恢复提示占用高度。
  */
  .player-state-text {
    /* 使用手机提示字号。 */
    font-size: 13px;
    /* 使用紧凑行高控制多行恢复提示高度。 */
    line-height: 1.45;
  }

  /*
    作用容器: 手机内容信息面板 .player-meta-panel。
    样式作用:
    把身份、上下文和收藏拆成三行，避免横向挤压并让收藏停靠右下角。
  */
  .player-meta-panel {
    /* 手机信息面板只使用一个可收缩内容列。 */
    grid-template-columns: minmax(0, 1fr);
    /* 身份、上下文和收藏依次纵向排列。 */
    grid-template-areas: "identity" "context" "favorite";
    /* 让每一行按自身区域控制左右对齐。 */
    align-items: start;
    /* 收紧手机信息面板内部距离。 */
    gap: 12px;
    /* 使用手机面板内边距。 */
    padding: 14px;
  }

  /*
    作用容器: 手机视频标题 .player-title。
    样式作用:
    使用手机可读字号；标题继续按真实内容宽度伸缩，让类型紧接标题。
  */
  .player-title {
    /* 使用手机标题字号。 */
    font-size: 24px;
  }

  /*
    作用容器: 手机播放上下文 .player-meta-context。
    样式作用:
    数据源和当前线路纵向排列，避免长字段互相挤压。
  */
  .player-meta-context {
    /* 把数据源和当前线路改为纵向排列。 */
    flex-direction: column;
    /* 让两个 Chip 从左侧对齐并保持自身内容宽度。 */
    align-items: flex-start;
    /* 收紧两个上下文字段之间的距离。 */
    gap: 6px;
  }

  /*
    作用容器: 手机收藏按钮 .player-favorite-button。
    样式作用:
    在独立行保持自身宽度并停靠信息面板右下角，不横向拉伸。
  */
  .player-favorite-button {
    /* 将收藏按钮对齐到信息面板右侧，形成移动端右下角操作。 */
    justify-self: end;
  }

  /*
    作用容器: 手机线路和分集面板。
    样式作用:
    收紧面板留白，为两列按钮提供足够宽度。
  */
  .player-lines-panel,
  .playlist-panel {
    /* 使用手机操作面板内边距。 */
    padding: 14px;
  }

  /*
    作用容器: 手机共用选项网格 .player-option-grid。
    样式作用:
    固定为两列可收缩轨道，并把触控高度设置为 40px。
  */
  .player-option-grid {
    /* 手机固定两列，320px 视口仍保留稳定按钮宽度。 */
    grid-template-columns: repeat(2, minmax(0, 1fr));
    /* 手机使用 40px 行高，保持统一视觉同时避免 32px 触控区域过小。 */
    grid-auto-rows: 40px;
  }
}
</style>
