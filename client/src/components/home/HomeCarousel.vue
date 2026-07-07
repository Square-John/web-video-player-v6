<template>
  <!--
    HomeCarousel 组件渲染树

    {section.home-carousel} [@mouseenter="pauseForHover"] [@mouseleave="resumeForHover"]
    ├─ [if hasBanners] 轮播内容分支
    │  └─ {div.carousel-shell} [tabindex="0"]
    │     ├─ {article.carousel-slide} [v-for banner,index in normalizedBanners]
    │     │  ├─ {div.slide-overlay}
    │     │  ├─ {div.slide-badge-row} 当前轮播项左上角推荐标签组
    │     │  └─ {div.slide-content}
    │     │     ├─ {h2.slide-title} 当前轮播项标题
    │     │     ├─ [if getBannerOriginalTitle(banner)] {p.slide-original} 当前轮播项原名或别名
    │     │     ├─ {p.slide-meta} 当前轮播项电影或电视剧元信息
    │     │     └─ [if getBannerDescription(banner)] {p.slide-summary} 当前轮播项简介
    │     │  └─ {div.slide-actions} 左下角播放和详情操作按钮
    │     ├─ {button.nav-arrow.nav-arrow-left} 上一张按钮
    │     ├─ {button.nav-arrow.nav-arrow-right} 下一张按钮
    │     └─ {div.carousel-progress} 底部序号和横条分页
    │
    └─ [else] 轮播分区空状态
       └─ {el-empty}
          - banners 为空时显示
          - 保留轮播分区占位，避免首页模块塌陷
  -->
  <!--
    首页轮播区域。
    作用：展示首页最上方的重点内容区域，视觉上回归 参考版本 的通栏横幅轮播。
  -->
  <section
    class="home-carousel"
    @mouseenter="pauseForHover"
    @mouseleave="resumeForHover">
    <!--
      轮播主体分支。
      渲染条件：`normalizedBanners` 至少有一条数据。
      页面作用：用多张 slide 叠放的方式还原 参考版本 首页横幅视觉。
    -->
    <div v-if="hasBanners" class="carousel-shell" tabindex="0">
      <!--
        单张轮播图。
        渲染数据：`normalizedBanners`。
        激活规则：`index === activeIndex` 的 slide 添加 `is-active` 并显示。
      -->
      <article
        v-for="(banner, index) in normalizedBanners"
        :key="banner.id || index"
        class="carousel-slide"
        :class="{ 'is-active': index === activeIndex }"
        :aria-hidden="index === activeIndex ? 'false' : 'true'"
        :tabindex="index === activeIndex ? 0 : -1"
        :style="slideStyle(banner)"
        @click="openBannerDetail(banner)"
        @keydown.enter="openBannerDetail(banner)"
        @keydown.space.prevent="openBannerDetail(banner)">
        <!-- 背景蒙层，让封面图上的标题和简介始终清晰。 -->
        <div class="slide-overlay"></div>

        <!-- 推荐标签组，固定在轮播左上角，电影和电视剧会按不同字段生成标签。 -->
        <div class="slide-badge-row" aria-label="推荐标签">
          <span
            v-for="badge in getBannerBadges(banner)"
            :key="badge"
            class="slide-badge">
            {{ badge }}
          </span>
        </div>

        <!-- 轮播前景文案区，显示标题、元信息、简介和主操作。 -->
        <div class="slide-content">
          <!-- 当前轮播主标题，只读取统一 ContentItem.title。 -->
          <h2 class="slide-title">{{ getBannerTitle(banner) }}</h2>

          <!-- 原名或别名，有 originalTitle 或 aliases 时展示，缺失时隐藏。 -->
          <p v-if="getBannerOriginalTitle(banner)" class="slide-original">
            {{ getBannerOriginalTitle(banner) }}
          </p>

          <!-- 电影和电视剧按各自类型生成元信息行。 -->
          <p class="slide-meta">{{ getBannerMetaText(banner) }}</p>

          <!-- 简介有值时展示；缺失时隐藏，避免首页 hero 出现“暂无简介”噪音。 -->
          <p v-if="getBannerDescription(banner)" class="slide-summary">
            {{ getBannerDescription(banner) }}
          </p>

        </div>

        <!-- 轮播主操作区，固定在左下角并和右下角轮播进度底部对齐。 -->
        <div class="slide-actions">
          <button
            v-if="canPlayBanner(banner)"
            type="button"
            class="slide-action slide-action-primary"
            @click.stop="openBannerPlayer(banner)">
            <i class="el-icon-video-play"></i>
            <span>立即播放</span>
          </button>

          <button
            v-if="canOpenBanner(banner)"
            type="button"
            class="slide-action slide-action-secondary"
            @click.stop="openBannerDetail(banner)">
            <span>查看详情</span>
          </button>
        </div>
      </article>

      <!-- 左箭头按钮，点击切换到上一张轮播图。 -->
      <button
        class="nav-arrow nav-arrow-left"
        type="button"
        aria-label="上一张"
        @click.stop="prevSlide">
        <i class="el-icon-arrow-left"></i>
      </button>

      <!-- 右箭头按钮，点击切换到下一张轮播图。 -->
      <button
        class="nav-arrow nav-arrow-right"
        type="button"
        aria-label="下一张"
        @click.stop="nextSlide">
        <i class="el-icon-arrow-right"></i>
      </button>

      <!-- 底部分页区，左侧显示当前序号，右侧横条显示轮播进度。 -->
      <div class="carousel-progress" role="tablist" aria-label="轮播图分页">
        <span class="progress-count">{{ activeProgressText }}</span>
        <div class="progress-bars">
          <button
            v-for="(banner, index) in normalizedBanners"
            :key="banner.id || index"
            type="button"
            class="dot"
            :class="{ active: index === activeIndex }"
            :aria-label="'切换到第 ' + (index + 1) + ' 张'"
            @click.stop="setActive(index)"></button>
        </div>
      </div>
    </div>

    <!--
      轮播分区空状态。
      渲染条件：banners 没有有效数据。
      页面作用：保持首页第一个分区的存在感，避免页面顶部直接塌陷。
    -->
    <el-empty
      v-else
      class="carousel-empty"
      description="当前首页轮播模块没有数据" />
  </section>
</template>

<script>
/**
 * 首页轮播组件。
 *
 * 组件定位：
 * - 渲染首页顶部通栏推荐横幅
 * - 只接收父组件传入的统一 ContentItem 列表，不主动请求数据
 * - 负责自动播放、鼠标悬停暂停、箭头切换和分页点切换
 * - 当前激活轮播项点击后进入对应详情页
 */
export default {
  // 组件名称用于在调试工具和报错信息中识别首页轮播组件。
  name: 'HomeCarousel',

  // props 接收父组件传入的轮播展示内容。
  props: {
    // banners 是首页轮播模块 ContentItem 列表。
    // 页面影响：组件直接读取 title、description、cover、poster、badge、tags、type 和 sourceId。
    banners: {
      type: Array,
      required: true
    }
  },

  data() {
    return {
      // activeIndex 决定当前显示哪一张轮播图。
      // 渲染位置：`.carousel-slide.is-active` 和 `.dot.active`。
      activeIndex: 0,

      // timer 保存自动轮播定时器 id。
      // 业务作用：防止重复创建定时器，并在组件销毁时清理。
      timer: null
    };
  },

  computed: {
    /**
     * 过滤后的轮播数据。
     *
     * @returns {Array<object>} 可渲染的轮播项数组。
     */
    normalizedBanners() {
      // 过滤空项后，模板不需要再处理 null 或 undefined。
      return Array.isArray(this.banners) ? this.banners.filter(Boolean) : [];
    },

    // hasBanners 表示轮播模块是否拿到了可展示数据，直接控制轮播主体和空状态分支。
    hasBanners() {
      return this.normalizedBanners.length > 0;
    },

    /**
     * 当前轮播进度展示文本。
     *
     * 页面位置：轮播底部进度条左侧。
     *
     * @returns {string} 形如 01 / 03 的当前轮播序号。
     */
    activeProgressText() {
      // 类型: string。
      // 作用: 当前激活项序号，从 0 基下标转成用户可读的 1 基序号。
      const current = String(this.activeIndex + 1).padStart(2, '0');

      // 类型: string。
      // 作用: 轮播总数，用两位数展示，让底部进度区宽度稳定。
      const total = String(this.normalizedBanners.length).padStart(2, '0');

      // 返回值类型: string。
      // 作用: 返回首页 hero 常见的序号进度文案。
      return `${current} / ${total}`;
    }
  },

  watch: {
    normalizedBanners: {
      immediate: true,
      /**
       * 轮播数据变化后校正当前索引和自动播放状态。
       *
       * @param {Array<object>} list 最新轮播数据。
       * @returns {void}
       */
      handler(list) {
        if (!list.length) {
          // 没有轮播数据时回到第一张索引，并停止自动轮播。
          this.activeIndex = 0;
          this.stopAutoplay();
          return;
        }

        if (this.activeIndex >= list.length) {
          // 数据变少时，避免 activeIndex 指向不存在的 slide。
          this.activeIndex = 0;
        }

        // 有可用轮播数据时启动自动播放。
        this.startAutoplay();
      }
    }
  },

  mounted() {
    // 组件挂载后启动自动轮播，静态首页也保持真实首页的浏览节奏。
    this.startAutoplay();
  },

  beforeDestroy() {
    // 组件销毁前清理定时器，避免离开首页后仍在后台运行。
    this.stopAutoplay();
  },

  methods: {
    /**
     * 读取轮播标题文案。
     * 纯函数: 只读取当前 ContentItem.title，不修改组件状态。
     * 使用字段: title。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {string} 轮播标题文案。
     */
    getBannerTitle(banner) {
      // 类型: object。
      // 作用: 当前轮播条目为空时使用空对象兜底，避免读取字段时报错。
      const item = banner || {};

      // 返回值类型: string。
      // 作用: title 缺失时展示稳定兜底文案，避免首页 hero 主标题为空。
      return item.title || '未命名内容';
    },

    /**
     * 读取轮播原名或别名文案。
     * 纯函数: 只读取当前 ContentItem.originalTitle 和 aliases，不修改组件状态。
     * 使用字段: originalTitle、aliases。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {string} 原名或别名文案；缺失时返回空字符串。
     */
    getBannerOriginalTitle(banner) {
      // 类型: object。
      // 作用: 当前轮播条目为空时使用空对象兜底。
      const item = banner || {};

      // 条件分支: originalTitle 存在时进入。
      // 执行内容: 优先展示源数据提供的原名。
      if (item.originalTitle) {
        return item.originalTitle;
      }

      // 条件分支: aliases 是非空数组时进入。
      // 执行内容: 使用第一个别名作为辅助标题。
      if (Array.isArray(item.aliases) && item.aliases.length) {
        return item.aliases[0];
      }

      // 返回值类型: string。
      // 作用: 没有原名或别名时隐藏辅助标题行。
      return '';
    },

    /**
     * 读取轮播类型文案。
     * 纯函数: 只读取当前 ContentItem.type，不修改组件状态。
     * 使用字段: type。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {string} 电影、电视剧或视频。
     */
    getBannerTypeLabel(banner) {
      // 类型: object。
      // 作用: 当前轮播条目为空时使用空对象兜底。
      const item = banner || {};

      // 条件分支: type 为 movie 时进入。
      // 执行内容: 返回电影类型标签，后续电影元信息会读取 movie.duration。
      if (item.type === 'movie') {
        return '电影';
      }

      // 条件分支: type 为 tv 时进入。
      // 执行内容: 返回电视剧类型标签，后续电视剧元信息会读取 tv.updateStatus 等字段。
      if (item.type === 'tv') {
        return '电视剧';
      }

      // 返回值类型: string。
      // 作用: 兜底返回视频，避免未知 type 导致标签为空。
      return '视频';
    },

    /**
     * 读取轮播推荐标签组。
     * 纯函数: 只读取当前 ContentItem 字段，不修改组件状态。
     * 电影使用字段: badge、quality、tags、type。
     * 电视剧使用字段: tv.updateStatus、badge、tags、tv.season、type。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {Array<string>} 最多 3 个推荐标签。
     */
    getBannerBadges(banner) {
      // 类型: object。
      // 作用: 当前轮播条目为空时使用空对象兜底，避免读取字段时报错。
      const item = banner || {};

      // 类型: object。
      // 作用: tv 缺失时使用空对象兜底，只有电视剧会读取其中字段。
      const tv = item.tv || {};

      // 类型: Array<string>。
      // 作用: tags 缺失时使用空数组兜底，轮播最多读取第一项作为推荐语。
      const tags = Array.isArray(item.tags) ? item.tags : [];

      // 条件分支: 当前内容是电视剧时进入。
      // 执行内容: 优先展示更新状态，再展示类型和标签或季信息。
      if (item.type === 'tv') {
        return this.compactUniqueItems([
          tv.updateStatus || item.badge,
          this.getBannerTypeLabel(item),
          tags[0] || tv.season
        ], 3);
      }

      // 返回值类型: Array<string>。
      // 作用: 电影和其他视频优先展示 badge/quality，再展示类型和推荐标签。
      return this.compactUniqueItems([
        item.badge || item.quality,
        this.getBannerTypeLabel(item),
        tags[0]
      ], 3);
    },

    /**
     * 读取轮播元信息数组。
     * 纯函数: 只读取当前 ContentItem 字段，不修改组件状态。
     * 电影使用字段: year、area、genres、movie.duration、score。
     * 电视剧使用字段: year、area、genres、tv.updateStatus、tv.totalEpisodes、score。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {Array<string>} 可展示的元信息片段。
     */
    getBannerMetaItems(banner) {
      // 类型: object。
      // 作用: 当前轮播条目为空时使用空对象兜底。
      const item = banner || {};

      // 类型: string。
      // 作用: 类型信息按 movie/tv 区分后续专属字段读取。
      const type = item.type || '';

      // 类型: string。
      // 作用: 取前两个 genres 作为轮播元信息，避免类型列表过长。
      const genreText = this.getBannerGenreText(item);

      // 类型: string。
      // 作用: score 存在时转成分数字符串，缺失时隐藏评分片段。
      const scoreText = this.getBannerScoreText(item);

      // 条件分支: 当前内容是电影时进入。
      // 执行内容: 电影元信息读取 movie.duration，不读取 tv 字段。
      if (type === 'movie') {
        // 类型: object。
        // 作用: movie 缺失时使用空对象兜底，避免读取 duration 报错。
        const movie = item.movie || {};

        // 返回值类型: Array<string>。
        // 作用: 返回电影轮播元信息片段。
        return this.compactUniqueItems([
          item.year,
          item.area,
          genreText,
          movie.duration,
          scoreText
        ]);
      }

      // 条件分支: 当前内容是电视剧时进入。
      // 执行内容: 电视剧元信息读取 tv.updateStatus/totalEpisodes，不读取 movie.duration。
      if (type === 'tv') {
        // 类型: object。
        // 作用: tv 缺失时使用空对象兜底，避免读取电视剧扩展字段时报错。
        const tv = item.tv || {};

        // 返回值类型: Array<string>。
        // 作用: 返回电视剧轮播元信息片段。
        return this.compactUniqueItems([
          item.year,
          item.area,
          genreText,
          this.getBannerTvProgressText(tv),
          scoreText
        ]);
      }

      // 返回值类型: Array<string>。
      // 作用: 未知类型只展示通用字段，不读取 movie 或 tv 专属字段。
      return this.compactUniqueItems([
        item.year,
        item.area,
        genreText,
        scoreText
      ]);
    },

    /**
     * 读取轮播元信息展示文本。
     * 纯函数: 只调用 getBannerMetaItems，不修改组件状态。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {string} 用圆点分隔的元信息文本。
     */
    getBannerMetaText(banner) {
      // 返回值类型: string。
      // 作用: 统一用圆点连接元信息，形成影视 hero 常见的扫读信息行。
      return this.getBannerMetaItems(banner).join(' · ');
    },

    /**
     * 读取轮播简介文案。
     * 纯函数: 只读取当前 ContentItem 字段，不修改组件状态。
     * 使用字段: description、detail.fullDescription。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {string} 轮播简介文案。
     */
    getBannerDescription(banner) {
      // 类型: object。
      // 作用: 当前轮播条目为空时使用空对象兜底。
      const item = banner || {};

      // 类型: object。
      // 作用: detail 缺失时使用空对象兜底，用于读取完整简介。
      const detail = item.detail || {};

      // 返回值类型: string。
      // 作用: 优先展示列表简介，缺失时展示详情简介；仍缺失时返回空字符串并隐藏简介行。
      return item.description || detail.fullDescription || '';
    },

    /**
     * 读取轮播图片地址。
     * 纯函数: 只读取当前 ContentItem.cover 和 poster，不修改组件状态。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {string} 优先 cover，其次 poster，缺失时返回空字符串。
     */
    getBannerImage(banner) {
      // 类型: object。
      // 作用: 当前轮播条目为空时使用空对象兜底。
      const item = banner || {};

      // 返回值类型: string。
      // 作用: 轮播优先使用横幅 cover，再用 poster 兜底。
      return item.cover || item.poster || '';
    },

    /**
     * 读取轮播类型化渐变背景。
     * 纯函数: 只读取当前 ContentItem.type，不修改组件状态。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {string} CSS background-image 渐变字符串。
     */
    getBannerFallbackBackground(banner) {
      // 类型: object。
      // 作用: 当前轮播条目为空时使用空对象兜底。
      const item = banner || {};

      // 条件分支: 电视剧内容缺少图片时进入。
      // 执行内容: 使用略偏青蓝的深色渐变，和电影 fallback 形成轻微区分。
      if (item.type === 'tv') {
        return 'radial-gradient(circle at 74% 28%, rgba(45, 212, 191, 0.22), transparent 30%), linear-gradient(135deg, #111827 0%, #173047 52%, #0f172a 100%)';
      }

      // 返回值类型: string。
      // 作用: 电影或未知类型使用深蓝暖光渐变，保持影视 hero 氛围。
      return 'radial-gradient(circle at 72% 26%, rgba(245, 158, 11, 0.18), transparent 30%), linear-gradient(135deg, #172133 0%, #23314a 48%, #101724 100%)';
    },

    /**
     * 读取轮播类型文本中的题材片段。
     * 纯函数: 只读取 ContentItem.genres，不修改组件状态。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {string} 前两个题材，用斜杠分隔。
     */
    getBannerGenreText(banner) {
      // 类型: object。
      // 作用: 当前轮播条目为空时使用空对象兜底。
      const item = banner || {};

      // 类型: Array<string>。
      // 作用: genres 缺失时使用空数组兜底，最多读取前两个题材。
      const genres = Array.isArray(item.genres) ? item.genres : [];

      // 返回值类型: string。
      // 作用: 题材之间用斜杠分隔；没有题材时返回空字符串。
      return genres.slice(0, 2).filter(Boolean).join(' / ');
    },

    /**
     * 读取轮播评分文案。
     * 纯函数: 只读取 ContentItem.score，不修改组件状态。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {string} 评分文案，缺失时返回空字符串。
     */
    getBannerScoreText(banner) {
      // 类型: object。
      // 作用: 当前轮播条目为空时使用空对象兜底。
      const item = banner || {};

      // 条件分支: score 为 null 或 undefined 时进入。
      // 执行内容: 返回空字符串，让元信息行隐藏评分片段。
      if (item.score === null || item.score === undefined || item.score === '') {
        return '';
      }

      // 返回值类型: string。
      // 作用: 把数字或字符串评分统一展示为“x分”。
      return `${item.score}分`;
    },

    /**
     * 读取电视剧更新进度文案。
     * 纯函数: 只读取 ContentItem.tv，不修改组件状态。
     *
     * @param {object} tv 当前 ContentItem.tv 对象。
     * @returns {string} 更新状态或全集数文案。
     */
    getBannerTvProgressText(tv) {
      // 类型: object。
      // 作用: tv 缺失时使用空对象兜底。
      const tvInfo = tv || {};

      // 条件分支: updateStatus 存在时进入。
      // 执行内容: 优先使用源数据提供的更新状态，例如“更新至8集”或“全24集”。
      if (tvInfo.updateStatus) {
        return tvInfo.updateStatus;
      }

      // 条件分支: totalEpisodes 存在时进入。
      // 执行内容: 生成全集数文案，补足完结剧展示。
      if (tvInfo.totalEpisodes) {
        return `全${tvInfo.totalEpisodes}集`;
      }

      // 返回值类型: string。
      // 作用: 没有更新状态或总集数时隐藏电视剧进度片段。
      return '';
    },

    /**
     * 过滤空值和重复值。
     * 纯函数: 只根据传入 items 返回新数组，不修改原数组。
     *
     * @param {Array<string>} items 待清理的文本片段。
     * @param {number} limit 最多保留数量。
     * @returns {Array<string>} 去空去重后的文本片段。
     */
    compactUniqueItems(items, limit = Infinity) {
      // 类型: Set<string>。
      // 作用: 记录已经出现过的文本，避免标签或元信息重复展示。
      const seen = new Set();

      // 类型: Array<string>。
      // 作用: 保存清理后的文本片段。
      const result = [];

      // 循环类型: for...of。
      // 初始值: items 的第一个文本片段。
      // 终止条件: items 遍历完成，或 result 达到 limit。
      // 循环作用: 过滤空值、重复值，并保留原始顺序。
      for (const item of items) {
        // 类型: string。
        // 作用: 把任意文本片段转成字符串并去除首尾空白。
        const text = typeof item === 'string' || typeof item === 'number' ? String(item).trim() : '';

        // 条件分支: 文本为空或已经出现过时进入。
        // 执行内容: 跳过当前片段，避免页面出现空标签或重复标签。
        if (!text || seen.has(text)) {
          continue;
        }

        // 副作用: 记录当前文本，供后续去重判断。
        seen.add(text);

        // 副作用: 保存当前文本到返回数组。
        result.push(text);

        // 条件分支: 达到最大保留数量时进入。
        // 执行内容: 停止循环，避免首页 hero 标签或元信息过长。
        if (result.length >= limit) {
          break;
        }
      }

      // 返回值类型: Array<string>。
      // 作用: 返回可直接用于 v-for 或 join 的展示文本数组。
      return result;
    },

    /**
     * 判断轮播项是否可以进入详情页。
     * 纯函数: 只读取 ContentItem.id 和 sourceId，不修改组件状态。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {boolean} id 和 sourceId 都存在时返回 true。
     */
    canOpenBanner(banner) {
      // 返回值类型: boolean。
      // 作用: 只有具备稳定跨页参数时才允许跳转详情页。
      return Boolean(banner && banner.id && banner.sourceId);
    },

    /**
     * 判断轮播项是否可以直接进入播放页。
     * 纯函数: 只读取 ContentItem.id、sourceId 和 playback.sources，不修改组件状态。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {boolean} 存在有效播放线路时返回 true。
     */
    canPlayBanner(banner) {
      // 类型: object。
      // 作用: 当前轮播条目为空时使用空对象兜底。
      const item = banner || {};

      // 类型: object。
      // 作用: playback 缺失时使用空对象兜底，用于读取播放线路。
      const playback = item.playback || {};

      // 类型: Array<object>。
      // 作用: sources 缺失时使用空数组兜底。
      const sources = Array.isArray(playback.sources) ? playback.sources : [];

      // 返回值类型: boolean。
      // 作用: 只有 id/sourceId 和至少一条可用线路都存在时才显示“立即播放”按钮。
      return Boolean(item.id && item.sourceId && sources.some(source => source && source.available !== false && source.url));
    },

    /**
     * 打开当前轮播项详情页。
     *
     * @param {object} banner 当前轮播项。
     * @returns {void} 通过 vue-router 跳转到 detail 命名路由。
     */
    openBannerDetail(banner) {
      // 轮播项必须同时有 id 和 sourceId，才能形成稳定详情页目标。
      if (!this.canOpenBanner(banner)) {
        return;
      }

      // 跳转详情页时携带 sourceId/videoId，后续真实详情请求可直接读取路由参数。
      this.$router.push({
        name: 'detail',
        params: {
          sourceId: banner.sourceId,
          videoId: banner.id
        }
      }).catch((error) => {
        // 重复点击当前轮播目标时忽略重复导航错误。
        if (error && error.name !== 'NavigationDuplicated') {
          throw error;
        }
      });
    },

    /**
     * 打开当前轮播项播放页。
     *
     * @param {object} banner 当前轮播项。
     * @returns {void} 通过 vue-router 跳转到 player 命名路由。
     */
    openBannerPlayer(banner) {
      // 轮播项必须存在可用播放线路，才显示并响应“立即播放”入口。
      if (!this.canPlayBanner(banner)) {
        return;
      }

      // 跳转播放页时携带 sourceId/videoId，播放页会通过统一 player 数据桶读取播放线路。
      this.$router.push({
        name: 'player',
        params: {
          sourceId: banner.sourceId,
          videoId: banner.id
        }
      }).catch((error) => {
        // 重复点击当前播放目标时忽略重复导航错误。
        if (error && error.name !== 'NavigationDuplicated') {
          throw error;
        }
      });
    },

    /**
     * 生成单张轮播图的背景样式。
     *
     * @param {object} banner 当前轮播项。
     * @returns {{ backgroundImage: string }} slide 背景样式对象。
     */
    slideStyle(banner) {
      // 类型: string。
      // 作用: ContentItem 使用 cover 或 poster 保存图片地址，轮播优先使用横幅 cover。
      const imageUrl = this.getBannerImage(banner);

      if (!imageUrl) {
        // 没有封面时使用纯渐变兜底，避免背景图 url 为空造成无意义请求。
        return {
          backgroundImage: this.getBannerFallbackBackground(banner)
        };
      }

      return {
        // 前半段渐变负责压暗图片，后半段 url 负责显示真实封面。
        backgroundImage: `linear-gradient(135deg, rgba(12, 18, 32, 0.2) 0%, rgba(12, 18, 32, 0.62) 100%), url('${imageUrl}')`
      };
    },

    /**
     * 切换到指定轮播下标。
     *
     * @param {number} index 目标下标。
     * @returns {void}
     */
    setActive(index) {
      if (!this.normalizedBanners.length) {
        return;
      }

      // 使用取模让下标越界时自动回到开头或结尾。
      const nextIndex = ((index % this.normalizedBanners.length) + this.normalizedBanners.length) % this.normalizedBanners.length;
      this.activeIndex = nextIndex;
    },

    /**
     * 切换到下一张轮播图。
     *
     * @returns {void}
     */
    nextSlide() {
      this.setActive(this.activeIndex + 1);
    },

    /**
     * 切换到上一张轮播图。
     *
     * @returns {void}
     */
    prevSlide() {
      this.setActive(this.activeIndex - 1);
    },

    /**
     * 启动自动轮播。
     *
     * @returns {void}
     */
    startAutoplay() {
      if (!this.normalizedBanners.length || this.timer) {
        return;
      }

      // 定时切换下一张，保持首页轮播区域的动态感。
      this.timer = window.setInterval(() => {
        this.nextSlide();
      }, 3300);
    },

    /**
     * 停止自动轮播。
     *
     * @returns {void}
     */
    stopAutoplay() {
      if (!this.timer) {
        return;
      }

      // 清理定时器后把 timer 置空，方便下次重新启动。
      window.clearInterval(this.timer);
      this.timer = null;
    },

    /**
     * 鼠标移入轮播区时暂停自动轮播。
     *
     * @returns {void}
     */
    pauseForHover() {
      this.stopAutoplay();
    },

    /**
     * 鼠标移出轮播区时恢复自动轮播。
     *
     * @returns {void}
     */
    resumeForHover() {
      this.startAutoplay();
    }
  }
};
</script>

<style scoped>
/*
  首页轮播整体区域。
  对应 template 中的 `.home-carousel`，位于首页内容最上方。
*/
.home-carousel {
  /* 上下外边距让轮播和首页其它区块分开，避免视觉上挤在一起。 */
  margin: 28px 0 34px;
}

/*
  轮播舞台容器。
  对应 template 中 `.carousel-shell`，所有 slide、箭头和分页点都定位在这里。
*/
.carousel-shell {
  /* 作为 slide、箭头、分页点的定位参照。 */
  position: relative;

  /* 给桌面端一个稳定最低高度，避免图片加载前轮播区域塌陷。 */
  min-height: 400px;

  /* 桌面端保持宽屏电影横幅比例，突出首页推荐区域。 */
  aspect-ratio: 16 / 6;

  /* 当前首页轮播回归 参考版本 通栏直角风格，不额外做圆角。 */
  border-radius: 0;

  /* 隐藏 slide 背景图、蒙层和按钮溢出部分。 */
  overflow: hidden;

  /* 没有封面图时使用深色渐变兜底。 */
  background:
    radial-gradient(circle at top left, rgba(79, 156, 255, 0.18), transparent 42%),
    linear-gradient(145deg, #172133 0%, #23314a 45%, #101724 100%);

  /* 细边框让深色轮播舞台和浅色页面背景分开。 */
  border: 1px solid rgba(148, 163, 184, 0.12);

  /* 大投影让轮播成为首页首屏视觉重点。 */
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);

  /* 去掉 focus 时默认黑边，键盘交互主要由按钮和分页点承担。 */
  outline: none;
}

/*
  单张轮播图。
  对应 template 中 `.carousel-slide`，多张 slide 叠放，只有 active 项显示。
*/
.carousel-slide {
  /* 绝对定位让多张 slide 可以叠在同一个舞台里。 */
  position: absolute;

  /* inset: 0 等价于上下左右贴满容器。 */
  inset: 0;

  /* 使用 flex 把文案区放到底部。 */
  display: flex;

  /* 文案区贴近轮播左下，形成标准影视 Hero 的推荐信息区。 */
  align-items: flex-end;

  /* 给文案区、按钮和底部分页留空间，避免信息贴边或被控制区遮挡。 */
  padding: 52px 56px 92px;

  /* 背景图居中显示，避免主体偏移过多。 */
  background-position: center center;

  /* 背景图不重复。 */
  background-repeat: no-repeat;

  /* 背景图裁剪填满舞台，保持横幅视觉完整。 */
  background-size: cover;

  /* 当前激活 slide 可以点击，后续接详情页时会承载跳转。 */
  cursor: pointer;

  /* 默认透明，只有激活项才显示。 */
  opacity: 0;

  /* 非激活项略微放大，切换到激活项时有轻微缩放动效。 */
  transform: scale(1.012);

  /* 非激活项不接收点击，避免点到隐藏 slide。 */
  pointer-events: none;

  /* slide 切换时同时过渡透明度和缩放。 */
  transition: opacity 0.42s ease, transform 0.42s ease;
}

/*
  当前激活的轮播图。
  对应 template 中 `:class="{ 'is-active': index === activeIndex }"`。
*/
.carousel-slide.is-active {
  /* 激活项完全显示。 */
  opacity: 1;

  /* 激活项回到正常比例。 */
  transform: scale(1);

  /* 激活项允许点击。 */
  pointer-events: auto;

  /* 激活项层级高于其它透明 slide。 */
  z-index: 1;
}

/*
  轮播背景蒙层。
  对应 template 中 `.slide-overlay`，位于背景图上方、文案下方。
*/
.slide-overlay {
  /* 绝对定位铺满当前 slide。 */
  position: absolute;

  /* 四边贴满 slide。 */
  inset: 0;

  /* 横向和纵向渐变共同压暗文字区域，右侧仍保留背景主体空间。 */
  background:
    linear-gradient(90deg, rgba(8, 13, 24, 0.9) 0%, rgba(8, 13, 24, 0.72) 32%, rgba(8, 13, 24, 0.24) 68%, rgba(8, 13, 24, 0.48) 100%),
    linear-gradient(180deg, rgba(10, 15, 25, 0.04) 0%, rgba(10, 15, 25, 0.58) 100%);
}

/*
  轮播文字内容区。
  对应 template 中 `.slide-content`，包含标签、标题、元信息、简介和操作按钮。
*/
.slide-content {
  /* 相对定位配合 z-index，让文字层盖在 overlay 上方。 */
  position: relative;

  /* 层级高于蒙层，保证文字可见。 */
  z-index: 1;

  /* 限制文字宽度，避免横幅标题和简介铺满整屏。 */
  width: min(560px, 48%);

  /* 文字使用白色，适配深色蒙层背景。 */
  color: #fff;
}

/*
  轮播标签组。
  对应 template 中 `.slide-badge-row`，固定在轮播左上角展示电影和电视剧差异化推荐标签。
*/
.slide-badge-row {
  /* 标签组独立定位到轮播左上角，不再跟随标题内容区下沉。 */
  position: absolute;

  /* 标签组左侧和正文内容区保持同一条垂直基准线。 */
  left: 56px;

  /* 标签组靠近轮播顶部，形成用户要求的左上角信息入口。 */
  top: 46px;

  /* 标签层级高于蒙层，保证标签可见且可读。 */
  z-index: 2;

  /* 标签横向排列，让推荐理由在标题前快速扫读。 */
  display: flex;

  /* 标签垂直居中，避免不同字数标签高度不齐。 */
  align-items: center;

  /* 标签数量超过容器宽度时允许换行。 */
  flex-wrap: wrap;

  /* 标签之间保持紧凑间距。 */
  gap: 8px;

  /* 标签组由绝对定位控制位置，不参与标题内容流间距。 */
  margin: 0;
}

/*
  单个轮播标签。
  对应 template 中 `.slide-badge`，来源于 badge、tags、type、quality 或 tv.updateStatus。
*/
.slide-badge {
  /* 标签使用 inline-flex，保证文字在胶囊内垂直居中。 */
  display: inline-flex;

  /* 标签文字垂直居中。 */
  align-items: center;

  /* 标签高度稳定，避免不同内容让 hero 信息区跳动。 */
  min-height: 26px;

  /* 标签左右留白，形成轻量胶囊感。 */
  padding: 0 10px;

  /* 标签使用小圆角，和现有按钮卡片风格保持克制。 */
  border-radius: 4px;

  /* 标签字号小于标题，用作辅助信息。 */
  font-size: 14px;

  /* 标签加粗，在深色背景上更清晰。 */
  font-weight: 700;

  /* 标签使用金色，和 参考版本 首页强调色保持一致。 */
  color: var(--gold);

  /* 标签使用低透明深色底，避免遮挡背景图主体。 */
  background: rgba(15, 23, 42, 0.62);

  /* 标签细边框提升层级，让标签在渐变背景上更稳。 */
  border: 1px solid rgba(243, 196, 93, 0.28);
}

/*
  轮播主标题。
  对应 template 中 `.slide-title`，显示 ContentItem.title。
*/
.slide-title {
  /* 清掉段落默认外边距，只保留和简介之间的下边距。 */
  margin: 0 0 10px;

  /* 首页 Hero 标题使用固定桌面字号，避免随视口过度缩放。 */
  font-size: 42px;

  /* 紧凑行高适合大标题。 */
  line-height: 1.08;

  /* 大标题使用重字重，强化首页推荐感。 */
  font-weight: 800;

  /* 保持 0 字距，避免中文标题出现奇怪间隔。 */
  letter-spacing: 0;

  /* 接近纯白，提高标题对比度。 */
  color: rgba(255, 255, 255, 0.98);

  /* 阴影让标题在亮色封面上仍然清楚。 */
  text-shadow: 0 10px 28px rgba(0, 0, 0, 0.34);
}

/*
  轮播原名或别名。
  对应 template 中 `.slide-original`，来源于 originalTitle 或 aliases[0]。
*/
.slide-original {
  /* 清掉段落默认外边距，只保留和元信息之间的下边距。 */
  margin: -2px 0 0;

  /* 辅助标题字号小于主标题。 */
  font-size: 14px;

  /* 辅助标题行高保持紧凑，避免占用过多 hero 高度。 */
  line-height: 1.4;

  /* 辅助标题使用半透明白色，和主标题形成层级。 */
  color: rgba(226, 232, 240, 0.72);
}

/*
  轮播元信息行。
  对应 template 中 `.slide-meta`，电影展示 duration，电视剧展示 updateStatus 或 totalEpisodes。
*/
.slide-meta {
  /* 标题或别名后空出一行，再展示年份、地区和类型等元信息。 */
  margin: 24px 0 14px;

  /* 元信息字号略小，作为标题下方扫读信息。 */
  font-size: 14px;

  /* 元信息行高兼容较长地区和类型字段。 */
  line-height: 1.45;

  /* 元信息使用浅白色，保证可读但不抢主标题。 */
  color: rgba(248, 250, 252, 0.8);

  /* 元信息加轻微阴影，避免亮色背景图影响阅读。 */
  text-shadow: 0 4px 14px rgba(0, 0, 0, 0.24);
}

/*
  轮播简介文本。
  对应 template 中 `.slide-summary`，显示 ContentItem.description 或 detail.fullDescription。
*/
.slide-summary {
  /* 清掉段落默认外边距。 */
  margin: 0 0 24px;

  /* 用字符宽度限制简介行长，避免一行过长难读。 */
  max-width: 44ch;

  /* 简介字号小于标题，形成层级。 */
  font-size: 14px;

  /* 行高略大，保证两行简介也容易阅读。 */
  line-height: 1.65;

  /* 使用浅灰白色，和标题形成主次关系。 */
  color: rgba(226, 232, 240, 0.76);

  /* 给简介加轻微阴影，保证复杂背景下仍可读。 */
  text-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
}

/*
  轮播操作按钮组。
  对应 template 中 `.slide-actions`，包含立即播放和查看详情按钮。
*/
.slide-actions {
  /* 操作按钮独立定位到轮播左下角，不再跟随简介文本上下移动。 */
  position: absolute;

  /* 左侧和标题、标签保持同一条垂直基准线。 */
  left: 56px;

  /* 底部与右下角轮播进度条区域对齐。 */
  bottom: 20px;

  /* 按钮层级高于背景蒙层，保证可见和可点击。 */
  z-index: 2;

  /* 按钮横向排列，符合影视 hero 常见操作区。 */
  display: flex;

  /* 按钮垂直居中。 */
  align-items: center;

  /* 按钮较多或窄屏时允许换行。 */
  flex-wrap: wrap;

  /* 控制主按钮和次按钮之间的距离。 */
  gap: 12px;
}

/*
  轮播操作按钮公共样式。
  对应 template 中 `.slide-action`。
*/
.slide-action {
  /* 使用 inline-flex 保证图标和文字垂直居中。 */
  display: inline-flex;

  /* 按钮内容垂直居中。 */
  align-items: center;

  /* 按钮内容水平居中。 */
  justify-content: center;

  /* 图标和文字之间留出距离。 */
  gap: 7px;

  /* 固定按钮高度，保证主次按钮视觉一致。 */
  min-height: 40px;

  /* 按钮左右留白，让操作入口有明确点击面积。 */
  padding: 0 18px;

  /* 按钮使用小圆角，和现有项目按钮风格保持克制。 */
  border-radius: 4px;

  /* 去掉浏览器默认按钮字体差异，继承项目字体。 */
  font: inherit;

  /* 操作按钮文字加粗，提高可点感。 */
  font-weight: 700;

  /* 按钮使用手型光标，提示可以点击。 */
  cursor: pointer;

  /* 按钮状态变化时平滑过渡。 */
  transition: transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
}

/*
  主操作按钮。
  对应 template 中 `.slide-action-primary`，进入播放页。
*/
.slide-action-primary {
  /* 主按钮无边框，降低视觉噪音。 */
  border: none;

  /* 主按钮使用蓝色，与项目登录按钮和搜索按钮形成统一主色。 */
  background: #4f7cff;

  /* 主按钮文字使用白色，保证对比度。 */
  color: #fff;

  /* 主按钮加投影，强化首屏核心行动点。 */
  box-shadow: 0 14px 30px rgba(79, 124, 255, 0.28);
}

/*
  次操作按钮。
  对应 template 中 `.slide-action-secondary`，进入详情页。
*/
.slide-action-secondary {
  /* 次按钮使用半透明边框，弱于主播放按钮。 */
  border: 1px solid rgba(255, 255, 255, 0.26);

  /* 次按钮使用深色半透明背景，保证在封面图上可读。 */
  background: rgba(15, 23, 42, 0.42);

  /* 次按钮文字使用浅白色。 */
  color: rgba(255, 255, 255, 0.92);
}

/* 用户悬停轮播操作按钮时，按钮轻微上移，提示可交互。 */
.slide-action:hover {
  transform: translateY(-1px);
}

/* 用户悬停主按钮时，主色略加深，提示当前按钮可点击。 */
.slide-action-primary:hover {
  background: #3f6df4;
}

/* 用户悬停次按钮时，边框和背景更明显。 */
.slide-action-secondary:hover {
  border-color: rgba(255, 255, 255, 0.42);
  background: rgba(15, 23, 42, 0.58);
}

/*
  左右切换箭头的公共样式。
  对应 template 中 `.nav-arrow-left` 和 `.nav-arrow-right`。
*/
.nav-arrow {
  /* 绝对定位到轮播舞台内部。 */
  position: absolute;

  /* top 50% 配合 margin-top，让按钮垂直居中。 */
  top: 50%;

  /* 层级高于 slide 和 overlay，保证按钮可以点击。 */
  z-index: 2;

  /* 固定按钮宽度，形成圆形按钮。 */
  width: 54px;

  /* 固定按钮高度，和宽度相同。 */
  height: 54px;

  /* 用负 margin 抵消一半高度，辅助垂直居中。 */
  margin-top: -27px;

  /* inline-flex 让图标在按钮内居中。 */
  display: inline-flex;

  /* 垂直居中箭头图标。 */
  align-items: center;

  /* 水平居中箭头图标。 */
  justify-content: center;

  /* 去掉默认按钮边框，下面自定义半透明边框。 */
  border: none;

  /* 圆形按钮。 */
  border-radius: 50%;

  /* 图标使用白色，适配深色按钮背景。 */
  color: #fff;

  /* 手型光标提示可以点击。 */
  cursor: pointer;

  /* 半透明深色背景保证按钮在封面上可见。 */
  background: rgba(13, 18, 31, 0.52);

  /* 细白边让按钮从深色封面中分离。 */
  border: 1px solid rgba(255, 255, 255, 0.16);

  /* 阴影提升按钮层级。 */
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);

  /* 默认略透明，减少对封面内容的遮挡。 */
  opacity: 0.92;

  /* hover 时按钮会放大、变亮和加深背景。 */
  transition: transform 0.18s ease, opacity 0.18s ease, background-color 0.18s ease;
}

/* 用户悬停箭头按钮时，按钮放大并变深，提示当前箭头可点击。 */
.nav-arrow:hover {
  opacity: 1;
  transform: translateY(-50%) scale(1.05);
  background: rgba(13, 18, 31, 0.7);
}

/* 左箭头位置，点击触发 `prevSlide`。 */
.nav-arrow-left {
  left: 22px;
  transform: translateY(-50%);
}

/* 右箭头位置，点击触发 `nextSlide`。 */
.nav-arrow-right {
  right: 22px;
  transform: translateY(-50%);
}

/*
  轮播底部进度区。
  对应 template 中 `.carousel-progress`，包含当前序号和横条分页。
*/
.carousel-progress {
  /* 绝对定位在轮播底部，形成影视 Hero 常见进度提示。 */
  position: absolute;

  /* 进度区放到右下角，避免和左侧标题、按钮形成拥挤。 */
  right: 56px;

  /* 进度区贴近轮播底部但保留呼吸感。 */
  bottom: 20px;

  /* 层级高于 slide 和 overlay，保证分页按钮可点击。 */
  z-index: 2;

  /* 序号和横条横向排列。 */
  display: flex;

  /* 序号和横条垂直居中。 */
  align-items: center;

  /* 控制序号和横条之间的距离。 */
  gap: 14px;
}

/*
  当前轮播序号。
  对应 template 中 `.progress-count`，展示 01 / 03。
*/
.progress-count {
  /* 序号使用小字号，作为辅助进度信息。 */
  font-size: 12px;

  /* 序号使用中等字重，提高深色背景上的可读性。 */
  font-weight: 700;

  /* 序号使用半透明白色，不抢主内容。 */
  color: rgba(255, 255, 255, 0.74);
}

/*
  横条分页容器。
  对应 template 中 `.progress-bars`。
*/
.progress-bars {
  /* 横条分页横向排列。 */
  display: flex;

  /* 横条之间保留少量距离。 */
  gap: 8px;
}

/*
  单个横条分页按钮。
  对应 template 中 `.dot`，点击后切换到对应 slide。
*/
.dot {
  /* 非激活横条宽度较短，降低视觉干扰。 */
  width: 26px;

  /* 横条高度固定，保证分页区稳定。 */
  height: 4px;

  /* 去掉默认按钮内边距，横条尺寸完全由 width/height 控制。 */
  padding: 0;

  /* 去掉默认按钮边框。 */
  border: none;

  /* 横条两端圆润。 */
  border-radius: 999px;

  /* 非激活横条使用半透明白色。 */
  background: rgba(255, 255, 255, 0.38);

  /* 手型光标提示横条可点击。 */
  cursor: pointer;

  /* 横条激活和 hover 时平滑变化。 */
  transition: width 0.18s ease, transform 0.18s ease, background-color 0.18s ease, opacity 0.18s ease;
}

/*
  当前激活横条分页。
  对应 template 中 `.dot.active`。
*/
.dot.active {
  /* 激活横条加宽，形成明确进度感。 */
  width: 44px;

  /* 激活横条使用金色强调当前轮播位置。 */
  background: var(--gold);

  /* 激活横条不再额外放大，避免底部进度区抖动。 */
  transform: scale(1.2);

  /* 激活横条完全显示。 */
  opacity: 1;
}

/*
  非激活横条分页。
  对应 template 中 `.dot:not(.active)`。
*/
.dot:not(.active) {
  /* 非激活横条弱化显示。 */
  opacity: 0.75;

  /* 非激活横条保持半透明白色。 */
  background: rgba(255, 255, 255, 0.45);
}

/*
  作用容器: 鼠标悬停的轮播分页横条 `.dot:hover`。
  样式作用:
  提示当前分页横条可以点击切换轮播。
  让非激活横条在鼠标悬停时有轻微反馈。
*/
.dot:hover {
  /* 设置分页横条悬停时轻微放大，用于反馈用户当前可点击切换轮播项。 */
  transform: scale(1.15);
}

/*
  作用容器: 首页轮播空状态 `.carousel-empty`。
  样式作用:
  在 banners 为空时保留首页首屏轮播区域的视觉占位。
  让空状态和首页浅色背景区分开，避免页面顶部突然塌陷。
*/
.carousel-empty {
  /* 设置轮播空状态的最小高度，保证没有轮播数据时首页顶部仍保留稳定区域。 */
  min-height: 360px;

  /* 设置轮播空状态的柔和面板背景，让空状态和页面背景形成轻微层级。 */
  background: var(--surface-soft);

  /* 设置轮播空状态的边框，让空状态区域边界清晰。 */
  border: 1px solid var(--border-color);

  /* 设置轮播空状态的柔和阴影，让空状态和视频卡片区视觉层级一致。 */
  box-shadow: var(--shadow-soft);
}

/*
  作用容器: 中等屏幕下的首页轮播组件。
  样式作用:
  收紧轮播舞台高度，避免中等宽度设备首屏被轮播过度占满。
  同步调整标签、正文、按钮和进度区位置，保持各元素对齐关系。
*/
@media (max-width: 1200px) {
  /*
    作用容器: 中等屏幕下的轮播舞台 `.carousel-shell`。
    样式作用:
    降低轮播最小高度。
    保持首页轮播在中等屏幕中仍有主视觉面积但不压迫下方内容。
  */
  .carousel-shell {
    /* 缩小中等屏幕下的轮播最小高度，让热门电影区更容易进入首屏附近。 */
    min-height: 360px;
  }

  /*
    作用容器: 中等屏幕下的单张轮播图 `.carousel-slide`。
    样式作用:
    调整轮播内部安全边距。
    为左上标签、左下按钮和右下进度区保留对齐空间。
  */
  .carousel-slide {
    /* 设置中等屏幕下的 slide 内边距，避免正文和控制区贴边。 */
    padding: 40px 40px 64px;
  }

  /*
    作用容器: 中等屏幕下的轮播文字内容区 `.slide-content`。
    样式作用:
    收窄文字内容区宽度。
    避免标题和简介占用过多横向空间，给右侧背景主体留位置。
  */
  .slide-content {
    /* 设置中等屏幕下正文内容宽度，保证文字区和背景图主体之间保持平衡。 */
    width: min(520px, 58%);
  }

  /*
    作用容器: 中等屏幕下的轮播标签组 `.slide-badge-row`。
    样式作用:
    同步左上角标签组位置。
    让标签组和正文内容保持同一条左边线。
  */
  .slide-badge-row {
    /* 设置中等屏幕下标签组左侧位置，和正文区左边界对齐。 */
    left: 40px;

    /* 设置中等屏幕下标签组顶部位置，避免标签过于贴近轮播顶部。 */
    top: 38px;
  }

  /*
    作用容器: 中等屏幕下的轮播操作按钮组 `.slide-actions`。
    样式作用:
    同步左下角按钮组位置。
    让按钮组和标题、标签保持同一条左边线。
  */
  .slide-actions {
    /* 设置中等屏幕下按钮组左侧位置，使其和正文内容左边界对齐。 */
    left: 40px;
  }

  /*
    作用容器: 中等屏幕下的轮播主标题 `.slide-title`。
    样式作用:
    缩小主标题字号。
    避免长标题在中等屏幕上过度换行或挤压简介区域。
  */
  .slide-title {
    /* 设置中等屏幕下轮播标题字号，保持标题可读同时减少空间占用。 */
    font-size: 36px;
  }

  /*
    作用容器: 中等屏幕下的轮播进度区 `.carousel-progress`。
    样式作用:
    同步右下角进度区位置。
    保持进度区和左下角按钮组底部在同一视觉水平区域。
  */
  .carousel-progress {
    /* 设置中等屏幕下进度区右侧距离，避免进度条贴近轮播边缘。 */
    right: 40px;
  }
}

/*
  作用容器: 移动端首页轮播组件。
  样式作用:
  把轮播调整为更适合窄屏浏览的比例。
  缩小文字、按钮、箭头和分页尺寸，避免移动端内容互相遮挡。
*/
@media (max-width: 768px) {
  /*
    作用容器: 移动端首页轮播整体区域 `.home-carousel`。
    样式作用:
    缩小轮播和上下模块之间的距离。
    让移动端首页首屏能显示更多后续内容。
  */
  .home-carousel {
    /* 设置移动端轮播上下外边距，避免轮播和源切换区、热门区贴得过近。 */
    margin: 18px 0 24px;
  }

  /*
    作用容器: 移动端轮播舞台 `.carousel-shell`。
    样式作用:
    降低轮播最小高度。
    使用更适合移动端的宽屏比例。
  */
  .carousel-shell {
    /* 设置移动端轮播最小高度，保证按钮和标题仍有可用空间。 */
    min-height: 300px;

    /* 设置移动端轮播比例为 16:9，减少窄屏下的纵向占用。 */
    aspect-ratio: 16 / 9;
  }

  /*
    作用容器: 移动端单张轮播图 `.carousel-slide`。
    样式作用:
    缩小 slide 内部边距。
    为移动端标题、按钮和分页保留必要安全距离。
  */
  .carousel-slide {
    /* 设置移动端 slide 内边距，避免内容贴边并给底部按钮留空间。 */
    padding: 24px 20px 52px;
  }

  /*
    作用容器: 移动端轮播文字内容区 `.slide-content`。
    样式作用:
    让文字内容区占满可用宽度。
    避免窄屏下标题和简介被过度压缩。
  */
  .slide-content {
    /* 设置移动端文字内容区宽度为满宽，提升标题和简介可读性。 */
    width: 100%;
  }

  /*
    作用容器: 移动端轮播标签组 `.slide-badge-row`。
    样式作用:
    调整左上角标签组位置。
    减少移动端标签组对正文区域的挤压。
  */
  .slide-badge-row {
    /* 设置移动端标签组左侧位置，和移动端正文内容左边界对齐。 */
    left: 20px;

    /* 设置移动端标签组顶部位置，保证标签不会贴住轮播上边缘。 */
    top: 22px;
  }

  /*
    作用容器: 移动端轮播操作按钮组 `.slide-actions`。
    样式作用:
    调整左下角按钮组位置。
    让按钮组和右下角分页区保持底部对齐。
  */
  .slide-actions {
    /* 设置移动端按钮组左侧位置，和正文内容左边界对齐。 */
    left: 20px;

    /* 设置移动端按钮组底部位置，和右下角分页指示保持同一底部基准。 */
    bottom: 12px;
  }

  /*
    作用容器: 移动端轮播主标题 `.slide-title`。
    样式作用:
    缩小主标题字号。
    控制标题和别名之间的距离，避免标题占满移动端首屏。
  */
  .slide-title {
    /* 设置移动端主标题字号，保证中文标题在窄屏下仍能完整换行展示。 */
    font-size: 28px;

    /* 缩小移动端标题底部间距，让别名和元信息更紧凑。 */
    margin-bottom: 8px;
  }

  /*
    作用容器: 移动端轮播别名和元信息 `.slide-original, .slide-meta`。
    样式作用:
    缩小辅助信息字号。
    保持移动端标题下方信息可读但不抢主标题层级。
  */
  .slide-original,
  .slide-meta {
    /* 设置移动端辅助信息字号，避免元信息行过长时占用过多空间。 */
    font-size: 13px;
  }

  /*
    作用容器: 移动端轮播简介 `.slide-summary`。
    样式作用:
    缩小简介字号和行高。
    调整简介与底部按钮之间的距离，避免互相遮挡。
  */
  .slide-summary {
    /* 设置移动端简介字号，使其低于标题和元信息层级。 */
    font-size: 13px;

    /* 设置移动端简介行高，保证多行简介仍易读。 */
    line-height: 1.55;

    /* 设置移动端简介底部间距，避免简介压到左下角操作按钮。 */
    margin-bottom: 18px;
  }

  /*
    作用容器: 移动端轮播操作按钮 `.slide-action`。
    样式作用:
    缩小按钮高度、左右留白和字号。
    让两个操作按钮在窄屏下仍能并排或自然换行展示。
  */
  .slide-action {
    /* 设置移动端按钮最小高度，保留可点击面积同时减少底部占用。 */
    min-height: 36px;

    /* 设置移动端按钮左右留白，避免按钮文字过长导致溢出。 */
    padding: 0 14px;

    /* 设置移动端按钮字号，让按钮和移动端标题层级匹配。 */
    font-size: 13px;
  }

  /*
    作用容器: 移动端轮播左右箭头 `.nav-arrow`。
    样式作用:
    缩小箭头按钮尺寸。
    减少移动端箭头对轮播主体内容的遮挡。
  */
  .nav-arrow {
    /* 设置移动端箭头按钮宽度，减少对封面和文字的遮挡。 */
    width: 44px;

    /* 设置移动端箭头按钮高度，保持圆形按钮。 */
    height: 44px;

    /* 设置移动端箭头按钮垂直居中偏移，匹配按钮高度的一半。 */
    margin-top: -22px;
  }

  /*
    作用容器: 移动端左侧轮播箭头 `.nav-arrow-left`。
    样式作用:
    调整左箭头距离轮播左边缘的位置。
    避免左箭头贴边或遮挡左侧正文。
  */
  .nav-arrow-left {
    /* 设置移动端左箭头左侧距离，保留可点击空间。 */
    left: 12px;
  }

  /*
    作用容器: 移动端右侧轮播箭头 `.nav-arrow-right`。
    样式作用:
    调整右箭头距离轮播右边缘的位置。
    避免右箭头和右下角分页区视觉冲突。
  */
  .nav-arrow-right {
    /* 设置移动端右箭头右侧距离，保留可点击空间。 */
    right: 12px;
  }

  /*
    作用容器: 移动端轮播进度区 `.carousel-progress`。
    样式作用:
    把进度区固定在右下角。
    让进度区和左下角按钮组底部对齐。
  */
  .carousel-progress {
    /* 设置移动端进度区右侧距离，避免横条贴边。 */
    right: 20px;

    /* 设置移动端进度区底部距离，和左下角按钮组保持一致。 */
    bottom: 12px;
  }

  /*
    作用容器: 移动端轮播序号 `.progress-count`。
    样式作用:
    隐藏移动端序号文本。
    给窄屏横条分页保留更多空间。
  */
  .progress-count {
    /* 移动端隐藏 01 / 03 文案，避免右下角进度区过宽。 */
    display: none;
  }

  /*
    作用容器: 移动端非激活分页横条 `.dot`。
    样式作用:
    缩短分页横条宽度。
    让多张轮播的分页条在窄屏下不占用过多横向空间。
  */
  .dot {
    /* 设置移动端非激活横条宽度，保持轻量分页提示。 */
    width: 22px;
  }

  /*
    作用容器: 移动端激活分页横条 `.dot.active`。
    样式作用:
    缩短激活横条宽度。
    保持激活状态清晰同时适配窄屏宽度。
  */
  .dot.active {
    /* 设置移动端激活横条宽度，让当前轮播位置仍然比普通横条更醒目。 */
    width: 36px;
  }
}
</style>
