<template>
  <!--
    PlayerView 页面渲染树

    {div.player-view} [v-loading="loading"]
    ├─ [if hasVideo] 播放内容分支
    │  └─ {div.player-shell}
    │     ├─ {section.player-main-column}
    │     │  ├─ {div.player-toolbar}
    │     │  │  ├─ (player-heading)
    │     │  │  │  ├─ (player-kicker)
    │     │  │  │  │  └─ 显示“正在播放”和当前数据源
    │     │  │  │  ├─ {h1.player-title}
    │     │  │  │  │  └─ 显示当前视频标题
    │     │  │  │  └─ {p.player-subtitle}
    │     │  │  │     └─ 显示当前清晰度或播放类型
    │     │  │  └─ (player-line-switcher)
    │     │  │     └─ 显示线路 1 到线路 6 的静态切换按钮
    │     │  │
    │     │  └─ {div.player-surface}
    │     │     └─ 静态播放器舞台，占位展示播放类型和提示文案
    │     │
    │     └─ {aside.player-side}
    │        ├─ {div.player-poster}
    │        │  ├─ [if posterImage] {img}
    │        │  └─ [else] (poster-fallback)
    │        └─ {section.playlist-panel}
    │           ├─ (playlist-head) 选集播放标题和收藏按钮
    │           └─ (playlist-episodes) 分集按钮列表
    │
    └─ [else] 整页空状态分支
       └─ {el-empty.player-page-empty}
  -->
  <!-- 播放页根容器，使用深色背景承载播放器舞台和右侧选集栏。 -->
  <div class="player-view" v-loading="loading">
    <!-- 有视频信息时显示播放页主体。 -->
    <div v-if="hasVideo" class="player-shell">
      <!-- 左侧主播放列，包含顶部播放信息和大播放器舞台。 -->
      <section class="player-main-column" aria-label="播放器主区域">
        <!-- 播放页顶部信息条，左侧显示当前片名，右侧显示播放线路。 -->
        <div class="player-toolbar">
          <!-- 当前播放标题区域。 -->
          <div class="player-heading">
            <!-- 状态标签：对应原页面左上角“正在播放”和数据源名称。 -->
            <div class="player-kicker">
              <span class="player-chip status">正在播放</span>
              <span class="player-chip subtle">{{ sourceName }}</span>
            </div>

            <!-- 当前播放标题。 -->
            <h1 class="player-title">{{ video.title }}</h1>

            <!-- 当前清晰度或播放类型。 -->
            <p class="player-subtitle">{{ playQualityText }}</p>

            <!-- 路由目标提示，只在 URL 带 sourceId 或 videoId 时展示，用于确认播放页入参边界。 -->
            <p v-if="hasRouteTarget" class="player-route-context">{{ routeTargetText }}</p>
          </div>

          <!-- 播放线路切换区，静态阶段先保留原页面线路按钮的外观。 -->
          <div class="player-line-switcher">
            <span class="line-switcher-label">播放线路:</span>
            <div class="line-switcher-list">
              <button
                v-for="line in playbackLines"
                :key="line.id"
                type="button"
                class="line-switcher-chip"
                :class="{ active: line.id === activePlaybackSourceId }"
                @click="selectPlaybackSource(line)"
              >
                {{ line.name }}
              </button>
            </div>
          </div>
        </div>

        <!-- 主播放器舞台，位置和比例按原播放页回归。 -->
        <div class="player-surface">
          <!-- 静态播放占位，后续接入真实播放器时替换成播放器组件。 -->
          <div class="player-state">
            <button type="button" class="player-play-button" aria-label="播放">
              <i class="el-icon-caret-right"></i>
            </button>
            <p class="player-state-label">播放地址已准备</p>
            <h2 class="player-state-title">{{ playTypeText }}</h2>
            <p class="player-state-text">{{ playMessage }}</p>
          </div>
        </div>
      </section>

      <!-- 右侧选集栏，严格回到封面 + 选集播放结构。 -->
      <aside class="player-side">
        <!-- 右侧海报区域。 -->
        <div class="player-poster" :class="{ empty: !posterImage }">
          <!-- 有封面时显示真实海报。 -->
          <img v-if="posterImage" :src="posterImage" :alt="video.title">

          <!-- 没有封面时显示标题占位。 -->
          <div v-else class="poster-fallback">{{ posterFallback }}</div>
        </div>

        <!-- 右侧选集播放面板。 -->
        <section class="playlist-panel" aria-label="选集播放">
          <!-- 选集面板头部，左侧标题，右侧收藏按钮。 -->
          <div class="playlist-head">
            <div>
              <h2 class="playlist-title">选集播放</h2>
              <p class="playlist-meta">{{ sourceLineText }}</p>
            </div>
            <el-button size="small" icon="el-icon-star-off" round>收藏</el-button>
          </div>

          <!-- 有分集数据时显示分集按钮。 -->
          <div v-if="hasEpisodes" class="playlist-episodes">
            <button
              v-for="episode in episodes"
              :key="episode.id || episode.value"
              type="button"
              class="playlist-episode-chip"
              :class="{ active: episode.id === selectedEpisodeId }"
              @click="selectEpisode(episode)"
            >
              {{ episode.label }}
            </button>
          </div>

          <!-- 没有分集时显示局部空状态。 -->
          <el-empty v-else description="当前没有可切换分集" :image-size="68" />
        </section>
      </aside>
    </div>

    <!-- video 为空时显示整页播放空状态。 -->
    <el-empty
      v-else
      class="player-page-empty"
      :description="loadError || '当前没有可展示的播放信息'"
    />
  </div>
</template>

<script>
/*
  PlayerView script 模块说明

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      requestSourceData: 自定义服务，请求播放页 player 数据桶并写入全站内容 store。
      siteContentStore: 自定义 store，提供播放页统一 ContentItem 读取入口。

  - 模块级常量:
      DEFAULT_PLAYER_CONTENT_ID: string，播放页没有路由 videoId 时使用的静态预览内容 id。

  - 模块级辅助函数:
      无
*/

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 播放页进入时请求 player 数据桶，并把响应写入 siteContentStore.pages.player.current。
import { requestSourceData } from '../services/sourceDataService.js';

// 导入来源: ../store/siteContentStore。
// 导入内容: siteContentStore 全站内容运行态对象。
// 文件作用: 播放页从 player.current 读取统一 ContentItem，不再直接读取页面级 mock 文件。
import { siteContentStore } from '../store/siteContentStore.js';

// 类型: string。
// 作用: 播放页没有路由 videoId 时使用的 mock 预览内容 id，保证导航栏直接进入播放页也有静态展示。
const DEFAULT_PLAYER_CONTENT_ID = 'movie-001';

export default {
  // 组件名称用于在调试工具和报错信息中识别播放页。
  name: 'PlayerView',

  data() {
    return {
      // loading 类型: boolean。
      // loading 作用: 控制根容器 v-loading，请求播放页数据时显示页面级加载遮罩。
      loading: false,

      // loadError 类型: string。
      // loadError 作用: 记录播放页数据请求失败文案，失败时交给整页空状态展示。
      loadError: '',

      // contentStore 类型: object。
      // contentStore 作用: 持有全站内容运行态引用，模板和 computed 通过它读取 player.current。
      contentStore: siteContentStore,

      // selectedEpisodeId 类型: string。
      // selectedEpisodeId 作用: 表示当前选中的分集按钮，影响右侧按钮 active 状态和播放线路筛选。
      selectedEpisodeId: '',

      // activePlaybackSourceId 类型: string。
      // activePlaybackSourceId 作用: 表示当前选中的播放线路，影响顶部线路按钮 active 状态和播放器舞台文案。
      activePlaybackSourceId: ''
    };
  },

  created() {
    // 生命周期时机: 播放页组件创建后执行。
    // 执行内容: 请求当前路由目标的播放数据，并写入统一 player 数据桶。
    this.loadPlayerContent();
  },

  watch: {
    /**
     * 监听播放页完整路由变化。
     * 执行时机: sourceId 或 videoId 等路由信息变化时触发。
     * 页面影响: 从新路由重新请求 player.current，保证详情页跳转到不同视频时播放页同步刷新。
     *
     * @returns {void} 只触发播放页数据请求，不返回业务数据。
     */
    '$route.fullPath'() {
      // 路由变化后重新请求播放数据，避免复用组件实例时继续展示旧播放信息。
      this.loadPlayerContent();
    }
  },

  computed: {
    /**
     * 播放页统一数据桶。
     *
     * @returns {object} siteContentStore.pages.player 数据桶。
     */
    playerBucket() {
      // player 数据桶由 sourceDataService 写入，页面只读取不直接修改 current。
      return this.contentStore.pages.player;
    },

    /**
     * 当前播放页统一内容对象。
     *
     * @returns {Object|null} 当前 ContentItem；尚未加载或未命中时为 null。
     */
    video() {
      // current 是播放页唯一内容落点，页面不再读取独立页面 mock。
      return this.playerBucket.current;
    },

    /**
     * 当前视频来源对象。
     *
     * @returns {Object|null} ContentItem.source 对象；缺失时为 null。
     */
    source() {
      // source 是统一 ContentItem 的来源扩展字段，当前用于显示来源名称。
      return this.video && this.video.source ? this.video.source : null;
    },

    /**
     * 当前视频分集列表。
     *
     * @returns {Array} ContentItem.episodes 数组；缺失时返回空数组。
     */
    episodes() {
      // episodes 是统一 ContentItem 的播放入口列表，电影通常只有一个正片分集。
      return this.asList(this.video && this.video.episodes);
    },

    /**
     * 当前内容的播放信息对象。
     *
     * @returns {Object|null} ContentItem.playback 对象；缺失时为 null。
     */
    playback() {
      // playback 保存线路、请求头和源站原始播放页地址，是播放页派生线路文案的核心数据。
      return this.video && this.video.playback ? this.video.playback : null;
    },

    /**
     * 当前请求使用的内容 id。
     *
     * @returns {string} 优先使用路由 videoId，没有时回退到播放页默认预览内容。
     */
    contentIdForRequest() {
      // 导航栏直接进入 `/player` 时没有 videoId，用默认 mock 内容维持静态阶段可看效果。
      return this.routeVideoId || DEFAULT_PLAYER_CONTENT_ID;
    },

    /**
     * 当前播放页路由中的数据源 id。
     *
     * @returns {string} URL params 中的 sourceId，没有时返回空字符串。
     */
    routeSourceId() {
      // sourceId 来自 `/player/:sourceId?/:videoId?`，后续真实播放请求会以它选择目标数据源。
      return this.asText(this.$route.params.sourceId).trim();
    },

    /**
     * 当前播放页路由中的视频 id。
     *
     * @returns {string} URL params 中的 videoId，没有时返回空字符串。
     */
    routeVideoId() {
      // videoId 来自 `/player/:sourceId?/:videoId?`，后续真实播放请求会以它定位目标视频。
      return this.asText(this.$route.params.videoId).trim();
    },

    /**
     * 播放页是否带有路由目标参数。
     *
     * @returns {boolean} sourceId 或 videoId 任一存在时返回 true。
     */
    hasRouteTarget() {
      return Boolean(this.routeSourceId || this.routeVideoId);
    },

    /**
     * 播放页路由目标展示文案。
     *
     * @returns {string} 面向用户和开发调试的当前入参说明。
     */
    routeTargetText() {
      // sourceId 没有出现在 URL 中时，说明当前使用 store 中的默认数据源。
      const sourceText = this.routeSourceId || this.contentStore.activeSourceId || '默认来源';

      // videoId 没有出现在 URL 中时，说明当前使用播放页默认预览内容。
      const videoText = this.routeVideoId || this.contentIdForRequest;

      // 把两个路由入参合并成一行轻量提示，确认播放页当前承接的 URL 目标。
      return `路由目标：${sourceText} / ${videoText}`;
    },

    /**
     * 是否有播放页主体视频信息。
     *
     * @returns {boolean} video 有值时返回 true。
     */
    hasVideo() {
      return Boolean(this.video);
    },

    /**
     * 是否有分集按钮可以渲染。
     *
     * @returns {boolean} episodes 至少有一项时返回 true。
     */
    hasEpisodes() {
      return this.episodes.length > 0;
    },

    /**
     * 当前选中的分集。
     *
     * 页面位置：顶部副标题、右侧分集按钮 active 状态和播放线路匹配。
     *
     * @returns {Object|null} 当前分集对象。
     */
    selectedEpisode() {
      // 优先用 selectedEpisodeId 在统一分集列表中查找用户选中的分集。
      const matchedEpisode = this.episodes.find(episode => episode.id === this.selectedEpisodeId);

      // 找不到时回退到第一集，保证播放页首屏有稳定分集上下文。
      return matchedEpisode || this.episodes[0] || null;
    },

    /**
     * 当前内容的全部播放线路。
     *
     * 页面位置：顶部线路切换区。
     *
     * @returns {Array<object>} ContentItem.playback.sources 数组。
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
     */
    activePlaybackSource() {
      // 优先使用用户点击选择的线路 id 匹配播放源。
      const selectedSource = this.playbackSources.find(source => source.id === this.activePlaybackSourceId);

      // 如果用户选中的线路不存在，尝试使用 playback.defaultSourceId 指定的默认线路。
      const defaultSource = this.playbackSources.find(source => this.playback && source.id === this.playback.defaultSourceId);

      // 如果没有默认线路，继续使用当前分集能匹配到的第一条线路。
      const episodeSource = this.playbackSources.find(source => this.selectedEpisode && source.episodeId === this.selectedEpisode.id);

      // 返回值类型: object|null。
      // 作用: 依次回退到选中线路、默认线路、分集线路和第一条线路。
      return selectedSource || defaultSource || episodeSource || this.playbackSources[0] || null;
    },

    /**
     * 播放地址是否已经准备好。
     *
     * 页面位置：播放器舞台准备完成分支。
     *
     * @returns {boolean} 当前播放线路未被明确禁用且存在 url 时返回 true。
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
     */
    isPlayUnsupported() {
      return Boolean(this.activePlaybackSource && this.activePlaybackSource.available === false);
    },

    /**
     * 右侧海报图片。
     *
     * 页面位置：右侧海报区真实封面图。
     *
     * @returns {string} 优先返回 cover，没有时返回 poster。
     */
    posterImage() {
      // cover 更适合播放页右侧大图，poster 作为列表海报字段在播放页兜底使用。
      return this.video ? this.video.cover || this.video.poster || '' : '';
    },

    /**
     * 封面缺失时的占位文案。
     *
     * 页面位置：右侧封面区 `.poster-fallback`。
     *
     * @returns {string} 视频标题前两个字。
     */
    posterFallback() {
      // 没有 video 或 title 时，用“视频”兜底。
      const title = this.video && this.video.title ? this.video.title : '视频';

      // 只取前两个字，避免占位文本撑破封面区。
      return title.slice(0, 2).toUpperCase();
    },

    /**
     * 播放类型展示文本。
     *
     * 页面位置：播放器舞台标题、顶部副标题。
     *
     * @returns {string} 播放类型文案。
     */
    playTypeText() {
      // 没有播放线路时显示未知类型。
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
     */
    playMessage() {
      // 加载失败时优先显示请求错误，避免用户只看到泛化占位。
      if (this.loadError) {
        return this.loadError;
      }

      // 当前线路可播放时给出静态阶段说明，后续真实播放器组件会消费同一个 url。
      if (this.isPlayReady) {
        return '当前播放地址来自统一 ContentItem.playback.sources。';
      }

      // 有线路但不可用时说明当前线路暂不可播放。
      if (this.isPlayUnsupported) {
        return '当前线路暂不可用，请切换其他线路。';
      }

      // 没有线路时说明数据源没有返回播放地址。
      return '暂无可用播放地址。';
    },

    /**
     * 播放页当前清晰度文案。
     *
     * 页面位置：标题下方 `.player-subtitle`。
     *
     * @returns {string} 当前清晰度、分集时长或播放格式。
     */
    playQualityText() {
      // 播放线路质量优先展示，贴近播放页“HD高清”位置。
      if (this.activePlaybackSource && this.activePlaybackSource.quality) {
        return this.activePlaybackSource.quality;
      }

      // 没有线路质量时用当前分集时长补充播放信息。
      if (this.selectedEpisode && this.selectedEpisode.duration) {
        return this.selectedEpisode.duration;
      }

      // 没有质量和时长时用播放类型兜底。
      return this.playTypeText;
    },

    /**
     * 当前来源名称。
     *
     * 页面位置：顶部来源标签。
     *
     * @returns {string} 来源名称或占位文案。
     */
    sourceName() {
      // name 是统一 ContentItem.source 中的用户可读来源名称。
      if (this.source && this.source.name) {
        return this.source.name;
      }

      // 没有来源对象时给出明确占位。
      return '暂无来源';
    },

    /**
     * 右侧选集统计文案。
     *
     * 页面位置：右侧“选集播放”标题下方。
     *
     * @returns {string} 线路和集数统计。
     */
    sourceLineText() {
      // 使用统一 playback.sources 和 episodes 统计，展示当前内容的线路数和分集数。
      return `${this.playbackSources.length} 条线路 / ${this.episodes.length} 集`;
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
     */
    asList(value) {
      // 只有真正的数组才能作为列表使用。
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
     */
    asText(value) {
      // 路由参数正常情况下是字符串，这里先保护标准路径。
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
     */
    getDefaultEpisodeId(episodes) {
      // 优先选择 playable 不为 false 的第一集，避免默认选中明确不可播放分集。
      const playableEpisode = episodes.find(episode => episode && episode.playable !== false);

      // 没有可播放标记时回退到第一集。
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
     */
    getDefaultPlaybackSourceId(playback, sources, episodeId) {
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
      const fallbackSource = configuredSource || episodeSource || availableSource || sources[0];

      // 返回值类型: string。
      // 作用: 返回默认线路 id；没有线路时返回空字符串。
      return fallbackSource ? fallbackSource.id || '' : '';
    },

    /**
     * 请求播放页数据。
     *
     * 调用位置：created 生命周期、播放路由变化监听。
     * 页面影响：通过 sourceDataService 请求 player 数据桶，成功后模板从 siteContentStore.pages.player.current 渲染。
     *
     * @returns {Promise<void>} 请求完成后不返回业务数据。
     */
    async loadPlayerContent() {
      // 副作用: 打开页面级加载状态，让用户知道播放数据正在刷新。
      this.loading = true;

      // 副作用: 清空旧错误，避免一次失败文案影响后续成功请求。
      this.loadError = '';

      try {
        // 异步请求: 让统一数据服务按 player 页面和 contentId 请求当前内容。
        // 成功结果: response.item 会被服务写入 siteContentStore.pages.player.current。
        const response = await requestSourceData({
          // 类型: string|undefined。
          // 作用: URL 中携带 sourceId 时使用指定数据源，没有时由 service 回退当前 activeSourceId。
          sourceId: this.routeSourceId || undefined,

          // 类型: string。
          // 作用: 告诉 provider 当前请求播放页单内容数据桶。
          pageKey: 'player',

          // 类型: object。
          // 作用: 单内容请求参数，contentId 用于在 mock 内容池或外部数据源结果中定位播放目标。
          params: {
            contentId: this.contentIdForRequest
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
     */
    selectPlaybackSource(line) {
      // 防御无效点击，避免空对象导致线路状态异常。
      if (!line || !line.id) {
        return;
      }

      // 副作用: 更新当前线路 id，驱动 active 样式和播放信息派生计算。
      this.activePlaybackSourceId = line.id;
    },

    /**
     * 选择播放分集。
     *
     * 调用位置：右侧分集按钮点击。
     * 页面影响：更新 selectedEpisodeId，并尽量切换到该分集对应的播放线路。
     *
     * @param {Object} episode 用户点击的分集对象。
     * @returns {void} 只更新页面状态，不返回业务数据。
     */
    selectEpisode(episode) {
      // 防御无效点击，避免空对象导致状态异常。
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
    }
  }
};
</script>

<style scoped>
/*
  播放页最外层容器。
  对应 template 根节点 `.player-view`。
  播放页由 App.vue 的 `player-main-content` 提供全屏主体区域。
*/
.player-view {
  /* 播放页占满 main 区域高度，方便播放器舞台铺开。 */
  min-height: 100%;

  /* 播放页横向占满主体区域。 */
  width: 100%;

  /* 深色背景让播放页和普通列表页区分开。 */
  background:
    radial-gradient(circle at top left, rgba(91, 140, 255, 0.18), transparent 28%),
    linear-gradient(135deg, #0f172a 0%, #172033 54%, #111827 100%);

  /* 播放页内部自己负责留白。 */
  padding: 22px;

  /* 让 padding 计入宽高，避免全屏布局出现滚动条误差。 */
  box-sizing: border-box;

  /* 深色页面默认使用浅色文字。 */
  color: #f8fafc;
}

/*
  播放页主体壳。
  对应 template 中 `[if hasVideo]` 的 `.player-shell`。
  桌面端布局：左侧主播放器，右侧信息栏。
*/
.player-shell {
  /* 使用 grid 拆成主播放列和右侧栏。 */
  display: grid;

  /*
    左侧 minmax(0, 1fr) 吃掉剩余空间。
    右侧固定 330px，保证封面和播放列表宽度稳定。
  */
  grid-template-columns: minmax(0, 1fr) 330px;

  /* 控制主播放列和右侧栏之间的距离。 */
  gap: 18px;

  /* 播放页主体撑满容器高度。 */
  min-height: 100%;
}

/*
  主播放列。
  对应 template 中 `.player-main-column`。
  内部包含顶部工具栏和播放器舞台。
*/
.player-main-column {
  /* 使用 flex 让工具栏在上，播放器舞台吃掉剩余高度。 */
  display: flex;

  /* 主轴改为纵向。 */
  flex-direction: column;

  /* 允许主列在 grid 中正确收缩。 */
  min-width: 0;

  /* 允许播放器舞台根据剩余高度收缩。 */
  min-height: 0;
}

/*
  播放工具栏。
  对应 template 中 `.player-toolbar`。
*/
.player-toolbar {
  /* 工具栏使用横向布局，左侧标题，右侧操作按钮。 */
  display: flex;

  /* 标题区和按钮区垂直方向顶部对齐。 */
  align-items: flex-start;

  /* 标题区靠左，按钮区靠右。 */
  justify-content: space-between;

  /* 控制标题区和按钮区之间的距离。 */
  gap: 18px;

  /* 工具栏和播放器舞台之间拉开距离。 */
  margin-bottom: 16px;
}

/*
  播放标题区。
  对应 template 中 `.player-heading`。
*/
.player-heading {
  /* 标题区允许在工具栏里收缩，避免长标题撑破布局。 */
  min-width: 0;
}

/*
  播放状态标签区。
  对应 template 中 `.player-kicker`。
*/
.player-kicker {
  /* 标签横向排列。 */
  display: flex;

  /* 标签在高度方向居中。 */
  align-items: center;

  /* 标签较多或屏幕较窄时允许换行。 */
  flex-wrap: wrap;

  /* 控制标签之间的距离。 */
  gap: 8px;

  /* 标签区和标题之间留出距离。 */
  margin-bottom: 8px;
}

/*
  Element UI 播放标签微调。
  对应 template 中多个 `.player-chip`。
*/
.player-chip {
  /* 播放页标签使用直角，贴近播放器界面的硬朗风格。 */
  border-radius: 0;
}

/*
  播放状态标签。
  对应 template 中 `.player-chip.kind-status`。
*/
.player-chip.kind-status {
  /* 暖色文字强调当前播放状态。 */
  color: #f3c45d;

  /* 暖色浅边框让播放状态比普通标签更醒目。 */
  border-color: rgba(243, 196, 93, 0.3);

  /* 深色背景里使用低透明暖色底。 */
  background: rgba(243, 196, 93, 0.12);
}

/*
  来源标签。
  对应 template 中 `.player-chip.kind-source`。
*/
.player-chip.kind-source {
  /* 来源标签使用浅蓝色，和播放状态的暖色区分。 */
  color: #93c5fd;

  /* 浅蓝边框提示这是来源信息。 */
  border-color: rgba(147, 197, 253, 0.3);

  /* 深色背景里的浅蓝底。 */
  background: rgba(91, 140, 255, 0.12);
}

/*
  直连状态标签。
  对应 template 中 `.player-chip.kind-direct`。
*/
.player-chip.kind-direct {
  /* 直连状态使用绿色，表达可播放链路正常。 */
  color: #86efac;

  /* 绿色边框和文字形成统一状态。 */
  border-color: rgba(134, 239, 172, 0.28);

  /* 低透明绿色背景避免过亮。 */
  background: rgba(34, 197, 94, 0.12);
}

/*
  播放页标题。
  对应 template 中 `.player-title`。
*/
.player-title {
  /* 去掉 h1 默认 margin，避免和自定义间距叠加。 */
  margin: 0;

  /* 播放页标题字号适中，避免挤占播放器高度。 */
  font-size: clamp(20px, 2vw, 28px);

  /* 标题行高收紧，长标题换行也保持稳定。 */
  line-height: 1.16;

  /* 加粗突出当前播放对象。 */
  font-weight: 700;

  /* 深色背景使用浅色标题。 */
  color: #f8fafc;
}

/*
  播放页副标题。
  对应 template 中 `.player-subtitle`。
*/
.player-subtitle {
  /* 控制副标题和标题之间的距离。 */
  margin: 8px 0 0;

  /* 副标题字号小于主标题。 */
  font-size: 13px;

  /* 行高略放宽，兼容较长分集标题。 */
  line-height: 1.45;

  /* 使用浅色透明文字，形成辅助层级。 */
  color: rgba(226, 232, 240, 0.78);
}

/*
  主播放器舞台。
  对应 template 中 `.player-surface`。
*/
.player-surface {
  /* 播放器舞台吃掉工具栏下方剩余高度。 */
  flex: 1 1 auto;

  /* 最小高度保证播放器区域不会过矮。 */
  min-height: 420px;

  /* 允许内容在父级高度不足时正确收缩。 */
  min-width: 0;

  /* 使用 flex 居中播放状态内容。 */
  display: flex;

  /* 垂直居中。 */
  align-items: center;

  /* 水平居中。 */
  justify-content: center;

  /* 给播放器内部状态文字留出安全空间。 */
  padding: 32px;

  /* 让 padding 计入尺寸。 */
  box-sizing: border-box;

  /* 深色半透明背景突出播放器区域。 */
  background: rgba(9, 15, 26, 0.86);

  /* 细边框让舞台和背景有清晰边界。 */
  border: 1px solid rgba(148, 163, 184, 0.14);

  /* 阴影让主播放器成为页面视觉中心。 */
  box-shadow: 0 24px 60px rgba(2, 6, 23, 0.32);
}

/*
  播放器状态内容。
  对应 template 中 `.player-state`。
*/
.player-state {
  /* 播放状态文字居中显示。 */
  text-align: center;

  /* 限制状态文案宽度，避免长文本铺满播放器。 */
  max-width: 620px;
}

/*
  播放器状态短标签。
  对应 template 中 `.player-state-label`。
*/
.player-state-label {
  /* 清掉段落默认外边距。 */
  margin: 0 0 10px;

  /* 使用较小字号形成辅助层级。 */
  font-size: 13px;

  /* 使用较粗字重让状态标签清晰可见。 */
  font-weight: 700;

  /* 使用浅蓝色，让标签在深色背景上可读。 */
  color: #93c5fd;
}

/*
  播放器状态标题。
  对应 template 中 `.player-state-title`。
*/
.player-state-title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用较大字号，让播放状态成为播放器区域视觉重点。 */
  font-size: clamp(28px, 4vw, 46px);

  /* 使用紧凑行高，保证多行标题稳定。 */
  line-height: 1.15;

  /* 使用白色文字，提高深色背景上的可读性。 */
  color: #fff;
}

/*
  播放器状态说明。
  对应 template 中 `.player-state-text`。
*/
.player-state-text {
  /* 控制说明和标题之间的距离。 */
  margin: 14px 0 0;

  /* 使用正文大小，保证提示易读。 */
  font-size: 15px;

  /* 设置舒适行高，适合多行说明。 */
  line-height: 1.7;

  /* 使用浅灰色文字，保持辅助层级。 */
  color: #d1d5db;
}

/*
  播放地址显示。
  对应 template 中 `.player-state-url`。
*/
.player-state-url {
  /* 播放地址和说明之间留出距离。 */
  margin: 16px auto 0;

  /* 限制地址最大宽度，避免长地址撑出播放器。 */
  max-width: 560px;

  /* 地址内部留白，形成代码块感觉。 */
  padding: 9px 12px;

  /* 深色背景里再加一层浅色透明底，便于区分地址。 */
  background: rgba(255, 255, 255, 0.07);

  /* 细边框标出地址区域。 */
  border: 1px solid rgba(255, 255, 255, 0.08);

  /* 播放地址使用小字号，避免占据太多空间。 */
  font-size: 12px;

  /* 使用等宽字体更适合展示 URL。 */
  font-family: Consolas, Monaco, monospace;

  /* 长地址允许断行。 */
  word-break: break-all;

  /* 浅色文字保证可读。 */
  color: rgba(226, 232, 240, 0.86);
}

/*
  播放页右侧栏。
  对应 template 中 `.player-side`。
*/
.player-side {
  /* 使用 flex 让封面、信息面板和分集面板纵向排列。 */
  display: flex;

  /* 主轴改为纵向。 */
  flex-direction: column;

  /* 控制右侧各区块之间的距离。 */
  gap: 12px;

  /* 允许右侧栏在页面高度不足时收缩。 */
  min-height: 0;
}

/*
  右侧封面容器。
  对应 template 中 `.player-poster`。
*/
.player-poster {
  /* 固定 2:3 海报比例。 */
  aspect-ratio: 2 / 3;

  /* 限制封面最大高度，避免右侧栏被封面占满。 */
  max-height: 278px;

  /* 超出封面框的图片部分隐藏。 */
  overflow: hidden;

  /* 播放页保持直角卡片风格。 */
  border-radius: 0;

  /* 图片加载前或无封面时的深色底。 */
  background: rgba(255, 255, 255, 0.06);

  /* 细边框标出封面边界。 */
  border: 1px solid rgba(148, 163, 184, 0.16);
}

/*
  右侧真实封面图片。
  对应 template 中 `[if posterImage]` 的 `.player-poster img`。
*/
.player-poster img {
  /* 图片宽度铺满封面容器。 */
  width: 100%;

  /* 图片高度铺满封面容器。 */
  height: 100%;

  /* 保持比例并裁切填满，不拉伸变形。 */
  object-fit: cover;

  /* 块级显示，去掉行内图片底部空隙。 */
  display: block;
}

/*
  无封面状态。
  对应 template 中 `:class="{ empty: !posterImage }"`。
*/
.player-poster.empty {
  /* 使用 flex 居中占位文字。 */
  display: flex;

  /* 垂直居中。 */
  align-items: center;

  /* 水平居中。 */
  justify-content: center;
}

/*
  封面占位文字。
  对应 template 中 `.poster-fallback`。
*/
.poster-fallback {
  /* 字号较大，用来填补封面缺失时的视觉空白。 */
  font-size: 40px;

  /* 加粗保证深色背景上可识别。 */
  font-weight: 800;

  /* 浅色半透明文字避免过亮。 */
  color: rgba(248, 250, 252, 0.86);

  /* 保持默认字距，避免中文占位被拉开。 */
  letter-spacing: 0;
}

/*
  播放列表面板。
  对应 template 中 `.playlist-panel`。
*/
.playlist-panel {
  /* 面板内部按列排列。 */
  display: flex;

  /* 标题和分集按钮上下排列。 */
  flex-direction: column;

  /* 控制标题和分集区域之间的距离。 */
  gap: 10px;

  /* 给面板内部留白。 */
  padding: 12px;

  /* 占据右侧栏剩余高度。 */
  flex: 1 1 auto;

  /* 允许内部滚动区域收缩。 */
  min-height: 0;

  /* 深色半透明背景融入播放页。 */
  background: rgba(12, 18, 30, 0.76);

  /* 细边框区分面板边界。 */
  border: 1px solid rgba(148, 163, 184, 0.12);
}

/*
  播放列表头部。
  对应 template 中 `.playlist-head`。
*/
.playlist-head {
  /* 标题区和未来操作区横向排列。 */
  display: flex;

  /* 顶部对齐，避免按钮拉低标题。 */
  align-items: flex-start;

  /* 两端对齐，为以后右侧操作预留位置。 */
  justify-content: space-between;

  /* 左右两块之间保留间距。 */
  gap: 12px;
}

/*
  播放列表标题。
  对应 template 中 `.playlist-title`。
*/
.playlist-title {
  /* 去掉 h2 默认 margin。 */
  margin: 0;

  /* 标题字号略小于主标题。 */
  font-size: 14px;

  /* 加粗表示当前区域标题。 */
  font-weight: 700;

  /* 深色背景使用浅色标题。 */
  color: #f8fafc;
}

/*
  播放列表统计信息。
  对应 template 中 `.playlist-meta`。
*/
.playlist-meta {
  /* 与标题保持小距离。 */
  margin: 4px 0 0;

  /* 统计信息字号更小，属于辅助说明。 */
  font-size: 12px;

  /* 弱色表示它不是主要操作。 */
  color: rgba(148, 163, 184, 0.82);
}

/*
  右侧分集按钮网格。
  对应 template 中 `.playlist-episodes`。
*/
.playlist-episodes {
  /* 使用 Grid 自动排布分集按钮。 */
  display: grid;

  /* 每列最小 120px，右栏宽度变化时自动调整列数。 */
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));

  /* 控制分集按钮之间的横向和纵向间距。 */
  gap: 10px;

  /* 分集过多时只让分集区域纵向滚动。 */
  overflow-y: auto;

  /* 右侧留一点空间，避免滚动条贴住按钮。 */
  padding-right: 2px;
}

/*
  单个分集按钮。
  对应 template 中 `v-for="episode in episodes"` 的 `.playlist-episode-chip`。
*/
.playlist-episode-chip {
  /* 清除浏览器默认按钮外观。 */
  appearance: none;

  /* 保证每个分集按钮有足够点击高度。 */
  min-height: 46px;

  /* 左右内边距适配较长分集标题。 */
  padding: 8px 10px;

  /* 分集按钮使用轻微圆角。 */
  border-radius: 10px;

  /* 默认边框给按钮边界。 */
  border: 1px solid rgba(148, 163, 184, 0.16);

  /* 深色页面中的轻量按钮背景。 */
  background: rgba(255, 255, 255, 0.06);

  /* 按钮内部上下排列 label 和 title。 */
  display: flex;

  /* 分集 label 和标题上下排列。 */
  flex-direction: column;

  /* 左对齐便于扫读。 */
  align-items: flex-start;

  /* 控制 label 和 title 之间的距离。 */
  gap: 3px;

  /* 鼠标手型提示可切换分集。 */
  cursor: pointer;

  /* hover 和 active 平滑过渡。 */
  transition: all 0.18s ease;

  /* 按钮文字左对齐，避免长标题居中后难读。 */
  text-align: left;
}

/*
  分集按钮 hover 和选中状态。
  hover 由鼠标移入触发，active 来自 `episode.id === selectedEpisodeId`。
*/
.playlist-episode-chip:hover,
.playlist-episode-chip.active {
  /* 选中或悬停时文字变亮。 */
  color: #f8fafc;

  /* 分集选中态使用蓝色边框。 */
  border-color: rgba(91, 140, 255, 0.28);

  /* 浅蓝背景表示当前分集被选中。 */
  background: rgba(91, 140, 255, 0.18);

  /* 内阴影增强选中态，但不改变按钮尺寸。 */
  box-shadow: inset 0 0 0 1px rgba(91, 140, 255, 0.08);
}

/*
  分集主标签。
  对应 template 中 `.playlist-episode-label`。
*/
.playlist-episode-label {
  /* 加粗分集编号，方便用户快速定位。 */
  font-weight: 700;

  /* 使用浅色文字保证可读。 */
  color: #f8fafc;

  /* 分集编号字号。 */
  font-size: 13px;
}

/*
  分集副标题。
  对应 template 中 `.playlist-episode-title`。
*/
.playlist-episode-title {
  /* 字号小于分集编号，表示它是辅助信息。 */
  font-size: 12px;

  /* 弱文字色让副标题不抢编号层级。 */
  color: rgba(148, 163, 184, 0.9);
}

/*
  整页空状态。
  对应 template 中 `[else]` 的 `.player-page-empty`。
*/
.player-page-empty {
  /* 提高整页空状态高度，避免页面显得塌陷。 */
  min-height: 420px;

  /* 深色背景下的空状态面板。 */
  background: rgba(12, 18, 30, 0.76);

  /* 细边框标出空状态区域。 */
  border: 1px solid rgba(148, 163, 184, 0.12);
}

/*
  平板端播放页布局。
  触发条件：视口宽度不超过 960px。
  原因：左右双栏在较窄宽度下会挤压播放器舞台。
*/
@media (max-width: 960px) {
  .player-shell {
    /* 播放页改成上下布局，主播放器在上，信息栏在下。 */
    grid-template-columns: 1fr;
  }

  .player-side {
    /* 平板端右侧栏改成两列，封面和信息面板并排。 */
    display: grid;

    /* 封面固定宽度，右侧内容占剩余空间。 */
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .playlist-panel {
    /* 分集面板横跨两列，放在封面和信息面板下方。 */
    grid-column: 1 / -1;
  }
}

/*
  手机端播放页布局。
  触发条件：视口宽度不超过 640px。
  调整目标：收紧边距，让播放器、封面和分集按钮按单列自然滚动。
*/
@media (max-width: 640px) {
  .player-view {
    /* 手机端减少页面内边距，给播放器更多宽度。 */
    padding: 16px;
  }

  .player-toolbar {
    /* 手机端工具栏改成上下排列，避免按钮挤压标题。 */
    flex-direction: column;

    /* 标题和按钮都从左侧开始。 */
    align-items: stretch;
  }

  .player-surface {
    /* 手机端降低播放器最小高度，避免首屏被播放器完全占满。 */
    min-height: 280px;

    /* 手机端减少播放器内部留白。 */
    padding: 20px;
  }

  .player-side {
    /* 手机端右侧栏改为单列。 */
    grid-template-columns: 1fr;
  }

  .player-poster {
    /* 手机端封面限制宽度，避免海报占据过多纵向空间。 */
    max-width: 220px;
  }

  .playlist-panel {
    /* 单列模式下取消跨列设置。 */
    grid-column: auto;
  }

  .playlist-episodes {
    /* 手机端分集固定为两列，兼顾按钮大小和浏览效率。 */
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/*
  播放页最终回归样式。
  放在文件末尾是为了覆盖静态阶段留下的播放页旧布局。
*/
.player-view {
  /* 回到原播放页深色背景。 */
  background: linear-gradient(180deg, #111c2e 0%, #101827 100%);

  /* 播放页主体和导航栏之间保持紧凑距离。 */
  padding: 24px 28px;
}

/*
  播放页主体布局。
  对应 template 中 `.player-shell`。
*/
.player-shell {
  /* 左侧大播放器自适应，右侧信息栏固定宽度。 */
  grid-template-columns: minmax(0, 1fr) 380px;

  /* 左右两栏间距贴近原页面。 */
  gap: 24px;

  /* 不强制撑满高度，页面自然滚动。 */
  min-height: auto;
}

/*
  播放器顶部区域。
  对应 `.player-toolbar`。
*/
.player-toolbar {
  /* 左侧标题，右侧线路切换。 */
  justify-content: space-between;

  /* 和播放器舞台拉开距离。 */
  margin-bottom: 18px;
}

/*
  播放页状态标签。
  对应 `.player-chip`。
*/
.player-chip {
  /* span 标签按标签控件显示。 */
  display: inline-flex;

  /* 标签文字垂直居中。 */
  align-items: center;

  /* 标签高度贴近原页面。 */
  min-height: 30px;

  /* 标签左右留白。 */
  padding: 0 12px;

  /* 原播放页标签为直角。 */
  border-radius: 0;

  /* 标签字号。 */
  font-size: 14px;

  /* 标签文字加粗。 */
  font-weight: 600;
}

/*
  正在播放标签。
  对应 `.player-chip.status`。
*/
.player-chip.status {
  /* 暖色半透明背景强调播放状态。 */
  background: rgba(245, 188, 59, .18);

  /* 暖色边框。 */
  border: 1px solid rgba(245, 188, 59, .35);

  /* 暖色文字。 */
  color: #f5c04d;
}

/*
  来源标签。
  对应 `.player-chip.subtle`。
*/
.player-chip.subtle {
  /* 深色辅助底。 */
  background: rgba(148, 163, 184, .14);

  /* 辅助边框。 */
  border: 1px solid rgba(148, 163, 184, .18);

  /* 浅灰文字。 */
  color: #cbd5e1;
}

/*
  播放标题。
  对应 `.player-title`。
*/
.player-title {
  /* 回到原页面较大的标题视觉。 */
  font-size: 30px;

  /* 清理标题默认外边距。 */
  margin: 0;
}

/*
  播放清晰度文字。
  对应 `.player-subtitle`。
*/
.player-subtitle {
  /* 和标题保持短距离。 */
  margin-top: 8px;

  /* 使用浅蓝灰文字。 */
  color: #b7c4d8;
}

/*
  播放页路由目标提示。
  对应 template 中 `[if hasRouteTarget]` 的 `.player-route-context`。
  出现条件：播放页 URL 中存在 sourceId 或 videoId。
*/
.player-route-context {
  /* 和清晰度文字保持短距离，形成同一组播放上下文信息。 */
  margin: 6px 0 0;

  /* 路由目标属于辅助说明，字号小于播放标题。 */
  font-size: 12px;

  /* 使用浅蓝灰文字，和播放器深色背景保持可读但不过分突出。 */
  color: #94a3b8;
}

/*
  播放线路切换区。
  对应 `.player-line-switcher`。
*/
.player-line-switcher {
  /* 线路文字和按钮横向排列。 */
  display: flex;

  /* 垂直居中。 */
  align-items: center;

  /* 文字和按钮组之间留距离。 */
  gap: 12px;

  /* 不让线路区被标题压缩。 */
  flex: 0 0 auto;

  /* 顶部略微下移，和标签区视觉对齐。 */
  padding-top: 4px;
}

/*
  线路区文字。
  对应 `.line-switcher-label`。
*/
.line-switcher-label {
  /* 使用弱化文字色。 */
  color: #94a3b8;

  /* 字号和按钮协调。 */
  font-size: 14px;
}

/*
  线路按钮列表。
  对应 `.line-switcher-list`。
*/
.line-switcher-list {
  /* 多个线路按钮横向排列。 */
  display: flex;

  /* 按钮之间留距离。 */
  gap: 10px;
}

/*
  线路按钮。
  对应 `.line-switcher-chip`。
*/
.line-switcher-chip {
  /* 清掉默认按钮底色。 */
  background: rgba(30, 41, 59, .7);

  /* 深色页中的浅边框。 */
  border: 1px solid rgba(148, 163, 184, .18);

  /* 浅色文字。 */
  color: #cbd5e1;

  /* 胶囊圆角。 */
  border-radius: 999px;

  /* 按钮高度贴近原页面。 */
  min-height: 34px;

  /* 按钮左右留白。 */
  padding: 0 16px;

  /* 提示可点击。 */
  cursor: pointer;
}

/*
  当前线路按钮。
  对应 `.line-switcher-chip.active`。
*/
.line-switcher-chip.active {
  /* 激活线路使用暖色底。 */
  background: rgba(245, 188, 59, .2);

  /* 暖色边框。 */
  border-color: rgba(245, 188, 59, .35);

  /* 暖色文字。 */
  color: #f8e3a0;
}

/*
  主播放器舞台。
  对应 `.player-surface`。
*/
.player-surface {
  /* 原播放页主播放器是大横屏区域。 */
  min-height: 620px;

  /* 回到黑色播放器底。 */
  background: #05070b;

  /* 弱边框。 */
  border: 1px solid rgba(148, 163, 184, .12);

  /* 原页面播放器没有大阴影。 */
  box-shadow: none;

  /* 播放状态自己居中，不需要额外 padding。 */
  padding: 0;
}

/*
  播放状态内容。
  对应 `.player-state`。
*/
.player-state {
  /* 占满播放器宽度。 */
  width: 100%;

  /* 内容居中。 */
  text-align: center;
}

/*
  静态播放按钮。
  对应 `.player-play-button`。
*/
.player-play-button {
  /* 按钮尺寸贴近真实播放器中心按钮。 */
  width: 90px;

  /* 固定高度。 */
  height: 58px;

  /* 深色半透明底。 */
  background: rgba(15, 23, 42, .72);

  /* 浅色边框。 */
  border: 2px solid rgba(226, 232, 240, .82);

  /* 小圆角。 */
  border-radius: 8px;

  /* 白色图标。 */
  color: #ffffff;

  /* 播放图标大小。 */
  font-size: 28px;

  /* 和下方文字拉开距离，让布局更接近播放器画面。 */
  margin-bottom: 140px;
}

/*
  右侧海报区域。
  对应 `.player-poster`。
*/
.player-poster {
  /* 回到原页面右侧横向海报比例。 */
  aspect-ratio: 16 / 9;

  /* 取消旧样式里的最大高度限制。 */
  max-height: none;

  /* 深蓝灰底。 */
  background: #273244;

  /* 直角边框。 */
  border-radius: 0;
}

/*
  海报占位文字。
  对应 `.poster-fallback`。
*/
.poster-fallback {
  /* 大字占位，贴近原页面右栏占位效果。 */
  font-size: 54px;
}

/*
  右侧选集面板。
  对应 `.playlist-panel`。
*/
.playlist-panel {
  /* 深色面板底。 */
  background: rgba(9, 15, 26, .82);

  /* 弱边框。 */
  border: 1px solid rgba(148, 163, 184, .14);

  /* 直角面板。 */
  border-radius: 0;

  /* 内部留白。 */
  padding: 16px;

  /* 选集面板填满右侧剩余高度。 */
  flex: 1 1 auto;
}

/*
  选集面板头部。
  对应 `.playlist-head`。
*/
.playlist-head {
  /* 左标题右收藏按钮。 */
  display: flex;

  /* 两端分布。 */
  justify-content: space-between;

  /* 顶部对齐。 */
  align-items: flex-start;

  /* 和分集按钮拉开距离。 */
  margin-bottom: 14px;
}

/*
  选集标题。
  对应 `.playlist-title`。
*/
.playlist-title {
  /* 清理默认边距。 */
  margin: 0;

  /* 标题字号接近原页面。 */
  font-size: 18px;
}

/*
  选集统计信息。
  对应 `.playlist-meta`。
*/
.playlist-meta {
  /* 和标题拉开小距离。 */
  margin: 8px 0 0;

  /* 弱化文字。 */
  color: #94a3b8;
}

/*
  分集按钮列表。
  对应 `.playlist-episodes`。
*/
.playlist-episodes {
  /* 原页面右侧分集按钮单列排列。 */
  display: grid;

  /* 单列。 */
  grid-template-columns: 1fr;

  /* 按钮之间留距离。 */
  gap: 10px;

  /* 不需要额外右内边距。 */
  padding-right: 0;
}

/*
  分集按钮。
  对应 `.playlist-episode-chip`。
*/
.playlist-episode-chip {
  /* 占满右侧栏。 */
  width: 100%;

  /* 固定最小高度。 */
  min-height: 48px;

  /* 按钮内容居中。 */
  align-items: center;

  /* 当前模板只显示一行分集名。 */
  justify-content: center;

  /* 深蓝按钮底。 */
  background: rgba(30, 58, 112, .55);

  /* 蓝色弱边框。 */
  border: 1px solid rgba(91, 140, 255, .26);

  /* 圆角贴近原页面。 */
  border-radius: 10px;

  /* 浅色文字。 */
  color: #e5edff;

  /* 分集文字加粗。 */
  font-weight: 700;
}

/*
  当前分集按钮。
  对应 `.playlist-episode-chip.active`。
*/
.playlist-episode-chip.active {
  /* 当前集用更亮蓝色。 */
  background: rgba(59, 99, 180, .72);

  /* 当前集边框更明显。 */
  border-color: rgba(91, 140, 255, .52);
}
</style>
