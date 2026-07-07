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
    │     │     │  └─ 按 参考版本 结构显示主演等核心信息
    │     │     ├─ (detail-summary)
    │     │     │  └─ 显示简介，没有简介时显示固定占位
    │     │     └─ (detail-actions)
    │     │        └─ {el-button}
    │     │           - 点击调用 playSelectedEpisode
    │     │           - 当前版本跳转到带 sourceId/videoId 的播放页
    │     │
    │     └─ {section.detail-episodes.theme-surface}
    │        ├─ (detail-section-head)
    │        │  └─ 显示“选集播放”标题和说明
    │        ├─ [if hasEpisodes] (episode-grid)
    │        │  └─ {button.episode-chip} 循环渲染分集按钮
    │        └─ [else] {el-empty}
    │           └─ 没有分集时显示分集空状态
    │
    └─ [else] 整页空状态分支
       └─ {el-empty.detail-page-empty}
          - video 为空时显示
          - 表示当前没有可展示的详情数据
  -->
  <!--
    详情页。
    作用：展示单个视频的封面、核心信息、简介和分集入口。
  -->
  <div class="theme-page detail-view" v-loading="loading">
    <!-- 有视频详情数据时渲染完整详情内容。 -->
    <div v-if="hasVideo" class="detail-shell">
      <!--
        详情头图区。
        渲染位置：详情页顶部。
        使用数据：video、source、selectedEpisode。
        页面作用：按 参考版本 的结构展示封面、标题、简介和主播放按钮。
      -->
      <section class="detail-hero theme-surface">
        <!--
          海报区域。
          条件逻辑：有 video.cover 显示图片，没有封面时显示标题占位。
        -->
        <div class="detail-poster" :class="{ empty: !posterImage }">
          <!-- 真实封面图，优先读取统一内容对象的 cover，再回退到 poster。 -->
          <img v-if="posterImage" :src="posterImage" :alt="video.title">

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
            页面作用：贴近 参考版本 的详情页标签样式，只保留核心扫读信息。
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
            当前先贴近 参考版本 的紧凑形式，把主演作为详情页主信息展示。
          -->
          <div class="detail-meta-line">
            <span class="detail-label">主演</span>
            <span class="detail-value">{{ actorText }}</span>
          </div>

          <!-- 简介区，没有简介时显示统一占位文案。 -->
          <p class="detail-summary">{{ displaySummary }}</p>

          <!--
            操作区。
            当前版本点击播放入口会跳转到带 sourceId/videoId 的播放页。
          -->
          <div class="detail-actions">
            <el-button
              type="primary"
              icon="el-icon-video-play"
              :disabled="!selectedEpisode"
              @click="playSelectedEpisode">
              {{ selectedEpisode ? '播放 ' + selectedEpisode.label : '暂无可播放分集' }}
            </el-button>
          </div>
        </div>
      </section>

      <!--
        分集区。
        渲染位置：详情头图区下方。
        使用数据：episodes、selectedEpisodeId。
        页面作用：展示可选择的分集入口。
      -->
      <section class="detail-episodes theme-surface" aria-label="分集列表">
        <!-- 分集区标题和说明。 -->
        <div class="detail-section-head">
          <div>
            <h2 class="detail-section-title">选集播放</h2>
            <p class="detail-section-desc">支持按线路切换并从指定集数进入播放页</p>
          </div>
        </div>

        <!-- 有分集时渲染分集按钮网格。 -->
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

        <!-- 没有分集时显示局部空状态，避免分集区塌陷。 -->
        <el-empty v-else description="当前详情没有可展示的分集" />
      </section>
    </div>

    <!-- video 为空时显示整页空状态。 -->
    <el-empty
      v-else
      class="detail-page-empty theme-surface"
      :description="loadError || '当前没有可展示的视频详情数据'"
    />
  </div>
</template>

<script>
// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 详情页进入时请求 detail 数据桶，并把响应写入 siteContentStore.pages.detail.current。
import { requestSourceData } from '../services/sourceDataService.js';

// 导入来源: ../store/siteContentStore。
// 导入内容: siteContentStore 全站内容运行态对象。
// 文件作用: 详情页从 detail.current 读取统一 ContentItem，不再直接读取页面级 mock 文件。
import { siteContentStore } from '../store/siteContentStore.js';

// 类型: string。
// 作用: 详情页没有路由 videoId 时使用的 mock 预览内容 id，保证导航栏直接进入详情页也有静态展示。
const DEFAULT_DETAIL_CONTENT_ID = 'movie-001';

export default {
  // 组件名称用于在调试工具和报错信息中识别详情页。
  name: 'DetailView',

  data() {
    return {
      // loading 类型: boolean。
      // loading 作用: 控制根容器 v-loading，请求详情数据时显示页面级加载遮罩。
      loading: false,

      // loadError 类型: string。
      // loadError 作用: 记录详情数据请求失败文案，失败时交给整页空状态展示。
      loadError: '',

      // contentStore 类型: object。
      // contentStore 作用: 持有全站内容运行态引用，模板和 computed 通过它读取 detail.current。
      contentStore: siteContentStore,

      // selectedEpisodeId 类型: string。
      // selectedEpisodeId 作用: 表示当前选中的分集按钮，影响按钮 active 状态和播放按钮文案。
      selectedEpisodeId: ''
    };
  },

  created() {
    // 生命周期时机: 详情页组件创建后执行。
    // 执行内容: 请求当前路由目标的详情数据，并写入统一 detail 数据桶。
    this.loadDetailContent();
  },

  watch: {
    /**
     * 监听详情页完整路由变化。
     * 执行时机: sourceId 或 videoId 等路由信息变化时触发。
     * 页面影响: 从新路由重新请求 detail.current，保证卡片跳转到不同详情时内容同步刷新。
     *
     * @returns {void} 只触发详情数据请求，不返回业务数据。
     */
    '$route.fullPath'() {
      // 路由变化后重新请求详情数据，避免复用组件实例时继续展示旧内容。
      this.loadDetailContent();
    }
  },

  computed: {
    /**
     * 详情页统一数据桶。
     *
     * @returns {object} siteContentStore.pages.detail 数据桶。
     */
    detailBucket() {
      // detail 数据桶由 sourceDataService 写入，页面只读取不直接修改 current。
      return this.contentStore.pages.detail;
    },

    /**
     * 当前详情页统一内容对象。
     *
     * @returns {Object|null} 当前 ContentItem；尚未加载或未命中时为 null。
     */
    video() {
      // current 是详情页唯一内容落点，页面和下游组件不再读取独立页面 mock。
      return this.detailBucket.current;
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
     * 当前请求使用的内容 id。
     *
     * @returns {string} 优先使用路由 videoId，没有时回退到详情页默认预览内容。
     */
    contentIdForRequest() {
      // 导航栏直接进入 `/detail` 时没有 videoId，用默认 mock 内容维持静态阶段可看效果。
      return this.routeVideoId || DEFAULT_DETAIL_CONTENT_ID;
    },

    /**
     * 当前详情页路由中的数据源 id。
     *
     * @returns {string} URL params 中的 sourceId，没有时返回空字符串。
     */
    routeSourceId() {
      // sourceId 来自 `/detail/:sourceId?/:videoId?`，后续真实详情请求会以它选择目标数据源。
      return this.asText(this.$route.params.sourceId).trim();
    },

    /**
     * 当前详情页路由中的视频 id。
     *
     * @returns {string} URL params 中的 videoId，没有时返回空字符串。
     */
    routeVideoId() {
      // videoId 来自 `/detail/:sourceId?/:videoId?`，后续真实详情请求会以它定位目标视频。
      return this.asText(this.$route.params.videoId).trim();
    },

    /**
     * 详情页是否带有路由目标参数。
     *
     * @returns {boolean} sourceId 或 videoId 任一存在时返回 true。
     */
    hasRouteTarget() {
      return Boolean(this.routeSourceId || this.routeVideoId);
    },

    /**
     * 详情页路由目标展示文案。
     *
     * @returns {string} 面向用户和开发调试的当前入参说明。
     */
    routeTargetText() {
      // sourceId 没有出现在 URL 中时，说明当前使用 store 中的默认数据源。
      const sourceText = this.routeSourceId || this.contentStore.activeSourceId || '默认来源';

      // videoId 没有出现在 URL 中时，说明当前使用详情页默认预览内容。
      const videoText = this.routeVideoId || this.contentIdForRequest;

      // 把两个路由入参合并成一行轻量提示，避免新增复杂状态区。
      return `路由目标：${sourceText} / ${videoText}`;
    },

    /**
     * 播放跳转使用的数据源 id。
     *
     * @returns {string} 优先使用路由 sourceId，没有时回退到详情数据中的 sourceId。
     */
    effectiveSourceId() {
      // 路由参数优先，保证用户从 URL 进入详情页后继续播放时参数不会丢失。
      return this.routeSourceId || (this.video && this.video.sourceId) || this.contentStore.activeSourceId || '';
    },

    /**
     * 播放跳转使用的视频 id。
     *
     * @returns {string} 优先使用路由 videoId，没有时回退到详情数据中的 video.id。
     */
    effectiveVideoId() {
      // 路由参数优先，保证详情页到播放页的路径和当前 URL 目标一致。
      return this.routeVideoId || (this.video && this.video.id) || '';
    },

    /**
     * 是否有详情主体数据。
     *
     * @returns {boolean} video 有值时返回 true。
     */
    hasVideo() {
      return Boolean(this.video);
    },

    /**
     * 是否有可展示分集。
     *
     * @returns {boolean} episodes 至少有一项时返回 true。
     */
    hasEpisodes() {
      return this.episodes.length > 0;
    },

    /**
     * 视频是否有评分。
     *
     * @returns {boolean} score 有值时返回 true。
     */
    hasRating() {
      return Boolean(this.video && this.video.score);
    },

    /**
     * 详情页海报图片。
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
     *
     * 页面位置：海报区 `.detail-poster-fallback`。
     *
     * @returns {string} 视频标题前两个字。
     */
    posterFallback() {
      // 没有 video 或 title 时，用“视频”兜底，避免占位区空白。
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
     */
    displayRating() {
      // video 不存在时不展示评分内容。
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
     */
    displaySummary() {
      // video 为空时返回空字符串，避免访问描述字段时报错。
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
     * 演员文本。
     *
     * 页面位置：核心元信息行。
     *
     * @returns {string} 演员拼接文本或兜底文案。
     */
    actorText() {
      // video 为空时直接返回占位，保证模板显示稳定。
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
     */
    selectedEpisode() {
      // 优先用 selectedEpisodeId 在列表中查找用户选中的分集。
      const matchedEpisode = this.episodes.find(episode => episode.id === this.selectedEpisodeId);

      // 找不到时回退到第一集，避免播放按钮没有目标。
      return matchedEpisode || this.episodes[0] || null;
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
     */
    asList(value) {
      // 只有真正的数组才能作为列表使用。
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
     * 调用位置：data 初始化 selectedEpisodeId。
     * 页面影响：进入详情页时，分集区默认选中 active 分集或第一集。
     *
     * @param {Array} episodes 分集列表。
     * @returns {string} 默认分集 id。
     */
    getDefaultEpisodeId(episodes) {
      // 如果某一集带 active 标记，优先选中它。
      const activeEpisode = episodes.find(episode => episode && episode.active);

      // 没有 active 标记时，回退到第一集。
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
     */
    joinTextParts(parts, separator) {
      // 只允许数组进入拼接流程，避免异常值影响页面渲染。
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
     * 页面影响：通过 sourceDataService 请求 detail 数据桶，成功后模板从 siteContentStore.pages.detail.current 渲染。
     *
     * @returns {Promise<void>} 请求完成后不返回业务数据。
     */
    async loadDetailContent() {
      // 副作用: 打开页面级加载状态，让用户知道详情数据正在刷新。
      this.loading = true;

      // 副作用: 清空旧错误，避免一次失败文案影响后续成功请求。
      this.loadError = '';

      try {
        // 异步请求: 让统一数据服务按 detail 页面和 contentId 请求当前内容。
        // 成功结果: response.item 会被服务写入 siteContentStore.pages.detail.current。
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
     */
    selectEpisode(episode) {
      // 防御无效点击，避免空对象导致 selectedEpisodeId 被写成异常值。
      if (!episode) {
        return;
      }

      // id 是分集主标识，没有 id 时使用 value 兜底。
      this.selectedEpisodeId = episode.id || episode.value || '';
    },

    /**
     * 播放当前选中分集。
     *
     * 调用位置：详情头图区主播放按钮。
     * 页面影响：跳转到播放页，并把当前详情目标 sourceId/videoId 传给播放路由。
     *
     * @returns {void} 当前不返回业务数据。
     */
    playSelectedEpisode() {
      // 没有可播放分集时按钮已经禁用，这里再做一次保护。
      if (!this.selectedEpisode) {
        return;
      }

      // 没有目标 sourceId 或 videoId 时不跳转，避免生成没有业务目标的播放地址。
      if (!this.effectiveSourceId || !this.effectiveVideoId) {
        return;
      }

      // 跳转到播放页；当前版本只传视频级参数，真实 episode 播放参数后续在播放链路阶段接入。
      this.$router.push({
        name: 'player',
        params: {
          sourceId: this.effectiveSourceId,
          videoId: this.effectiveVideoId
        }
      }).catch((error) => {
        // 重复点击当前播放目标时 Vue Router 3 会抛出重复导航错误，这种情况不需要打断页面。
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
  内部只保留 参考版本 结构里的详情头图区和选集播放区。
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

  /* 参考版本 详情头图留白较大，这里保持接近的呼吸感。 */
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

  /* 限制海报高度，让它接近 参考版本 截图中的竖向比例。 */
  max-height: 420px;

  /* 封面图按比例裁切时，超出海报框的部分隐藏。 */
  overflow: hidden;

  /* 图片加载前的浅色底，避免空白区域太突兀。 */
  background: #eef2f7;

  /* 细边框给海报一个清晰边界。 */
  border: 1px solid rgba(148, 163, 184, 0.18);

  /* 圆角很小，贴近 参考版本 的克制卡片风格。 */
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

  /* 给正文顶部留一点空间，接近 参考版本 中文字不是紧贴卡片顶边的效果。 */
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
  /* 统一成胶囊标签，贴近 参考版本 详情页顶部标签形态。 */
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

  /* 字号贴近 参考版本 详情页大标题。 */
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
  核心元信息行。
  对应 template 中 `.detail-meta-line`。
  当前用于展示“主演”这种 参考版本 详情页中的紧凑信息。
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
  /* 控制播放按钮和简介之间的距离，贴近 参考版本 中按钮位置。 */
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
  分集区外层卡片。
  对应 template 中 `.detail-episodes.theme-surface`。
*/
.detail-episodes {
  /* 给选集区内部留白，避免按钮贴住卡片边缘。 */
  padding: 28px;

  /* 选集区最小高度接近 参考版本 的第二块白色区域。 */
  min-height: 160px;
}

/*
  分集区头部。
  对应 template 中 `.detail-section-head`。
*/
.detail-section-head {
  /* 标题区和下方分集内容之间留出距离。 */
  margin-bottom: 20px;
}

/*
  分集区标题。
  对应 template 中 `.detail-section-title`。
*/
.detail-section-title {
  /* 去掉 h2 默认 margin，让头部间距完全由父级控制。 */
  margin: 0;

  /* 标题字号贴近 参考版本 的“选集播放”。 */
  font-size: 24px;

  /* 使用主文字色，表示这是新的内容区块标题。 */
  color: var(--text-primary);
}

/*
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
  .detail-episodes {
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

  .episode-grid {
    /* 手机端分集固定为两列，兼顾点击面积和浏览效率。 */
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
