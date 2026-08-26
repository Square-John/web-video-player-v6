<template>
  <!--
    HomeCarousel 组件渲染树

    {section.home-carousel} [@mouseenter="pauseForHover"] [@mouseleave="resumeForHover"]
    ├─ [if hasBanners] 轮播内容分支
    │  └─ {div.carousel-shell} [tabindex="0"] [@keydown.left/right]
    │     ├─ {article.carousel-slide} [v-for banner,index in normalizedBanners]
    │     │  ├─ [if getBannerImage(banner)] {SourceImage.slide-image} 当前轮播展示图片
    │     │  ├─ {div.slide-overlay}
    │     │  ├─ {div.slide-badge-row} 当前轮播项左上角推荐标签组
    │     │  └─ {div.slide-content} 左下信息组
    │     │     ├─ {h2.slide-title} 当前轮播项标题
    │     │     ├─ [if getBannerOriginalTitle(banner)] {p.slide-original} 当前轮播项原名或别名
    │     │     ├─ {p.slide-meta} 当前轮播项电影或电视剧元信息
    │     │     └─ [if getBannerDescription(banner)] {p.slide-summary} 当前轮播项简介
    │     │     └─ {div.slide-actions} 播放和详情操作按钮
    │     ├─ {button.nav-arrow.nav-arrow-left} 上一张按钮
    │     ├─ {button.nav-arrow.nav-arrow-right} 下一张按钮
    │     └─ [if hasMultipleBanners] {div.carousel-progress} 底部序号和紧凑分页点
    │
    └─ [else] 轮播分区空状态
       └─ {el-empty}
          - banners 为空时显示
          - 保留轮播分区占位，避免首页模块塌陷
  -->
  <!--
    首页轮播区域。
    作用：展示首页最上方的重点内容区域，视觉上回归 v4 的通栏横幅轮播。
  -->
  <section
    class="home-carousel"
    @mouseenter="pauseForHover"
    @mouseleave="resumeForHover">
    <!--
      轮播主体分支。
      渲染条件：`normalizedBanners` 至少有一条数据。
      页面作用：用多张 slide 叠放的方式展示横幅，并提供方向键切换。
    -->
    <div
      v-if="hasBanners"
      class="carousel-shell"
      tabindex="0"
      aria-roledescription="轮播图"
      @keydown.left.prevent="prevSlide"
      @keydown.right.prevent="nextSlide">
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
        :style="slideStyle(banner)">
        <!-- 标准图片直接加载失败时复用唯一受控运输；最终失败继续显示 slide 自身渐变背景。 -->
        <SourceImage
          v-if="getBannerImage(banner)"
          class="slide-image"
          :source-id="banner.sourceId"
          :src="getBannerImage(banner)"
          :alt="getBannerTitle(banner)" />

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

        <!-- 左下信息组以自然内容流显示标题、元信息、简介和主操作。 -->
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

          <!-- 操作按钮属于左下信息组，文案多少只改变组内高度，不再产生第二套绝对定位。 -->
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
        </div>
      </article>

      <!-- 左箭头按钮，点击切换到上一张轮播图。 -->
      <button
        v-if="hasMultipleBanners"
        class="nav-arrow nav-arrow-left"
        type="button"
        aria-label="上一张"
        @click.stop="prevSlide">
        <i class="el-icon-arrow-left"></i>
      </button>

      <!-- 右箭头按钮，点击切换到下一张轮播图。 -->
      <button
        v-if="hasMultipleBanners"
        class="nav-arrow nav-arrow-right"
        type="button"
        aria-label="下一张"
        @click.stop="nextSlide">
        <i class="el-icon-arrow-right"></i>
      </button>

      <!-- 底部分页区，左侧显示当前序号，右侧用紧凑圆点标识轮播位置。 -->
      <div
        v-if="hasMultipleBanners"
        class="carousel-progress"
        role="tablist"
        aria-label="轮播图分页">
        <span class="progress-count">{{ activeProgressText }}</span>
        <div class="progress-bars">
          <button
            v-for="(banner, index) in normalizedBanners"
            :key="banner.id || index"
            type="button"
            class="dot"
            :class="{ active: index === activeIndex }"
            :aria-label="'切换到第 ' + (index + 1) + ' 张'"
            :aria-current="index === activeIndex ? 'true' : 'false'"
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
/*
  HomeCarousel.vue 模块说明

  - 文件职责:
      渲染首页轮播内容、轮播控制、详情入口和统一播放器入口。
      组件只消费 ContentItem 与统一导航 service，不保存内容、用户历史或播放器状态。

  - 导入库及文件汇总(4 条，内置 0 条，第三方 0 条，自定义 4 条):
      createContentPlaybackNavigationTarget: 自定义服务，根据轮播 ContentItem 统一生成默认分集、线路和自动播放目标。
      homeDisplay.config exports: 自定义配置，提供自动切换间隔并把组件输入收敛为 1 至 24 的安全展示数量。
      stageContentRouteShell: 自定义页面壳服务，在详情或播放导航前发布轮播已知内容字段。
      SourceImage: 自定义组件，统一处理轮播图片直接加载、受控兜底和资源释放。

  - 模块级常量:
      无

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 组件状态:
      activeIndex: number，当前显示的轮播下标。
      timer: number|null，当前 window.setInterval 资源 id，由生命周期和悬停事件创建或释放。

  - 对外导出:
      HomeCarousel: Vue component，供首页渲染 ContentItem 轮播和播放/详情入口。
*/

// 导入来源: ../../services/playerNavigationService.js。
// 导入内容: createContentPlaybackNavigationTarget 内容播放目标构造函数。
// 文件作用: 首页“立即播放”只提交 ContentItem 和自动播放意图，不在组件中拼接播放器路由字段。
import { createContentPlaybackNavigationTarget } from '../../services/playerNavigationService.js';

// 导入来源: ../../services/contentRouteShellService.js。
// 导入内容: stageContentRouteShell 页面壳发布函数。
// 文件作用: 轮播详情和立即播放入口共享同一实体壳，目标页不等待 Provider 后才显示已知标题和封面。
import { stageContentRouteShell } from '../../services/contentRouteShellService.js';

// 导入来源: ../common/SourceImage.vue。
// 导入内容: SourceImage 通用展示图片组件。
// 文件作用: 轮播不再把第三方 URL 写入 CSS 背景而失去 error 事件和受控兜底能力。
import SourceImage from '../common/SourceImage.vue';

import {
  // 导入来源: ../../config/homeDisplay.config.js；导入内容: HOME_CAROUSEL_AUTOPLAY_INTERVAL_MILLISECONDS；文件作用: 使用项目统一轮播节奏创建定时器。
  HOME_CAROUSEL_AUTOPLAY_INTERVAL_MILLISECONDS,
  // 导入来源: ../../config/homeDisplay.config.js；导入内容: resolveHomeCarouselItemLimit；文件作用: 组件自身再次执行轮播数量硬边界。
  resolveHomeCarouselItemLimit
} from '../../config/homeDisplay.config.js';

export default {
  // 组件名称用于在调试工具和报错信息中识别首页轮播组件。
  name: 'HomeCarousel',

  // 类型: object；作用: 注册通用图片组件，轮播只负责布局和内容操作。
  components: {
    SourceImage
  },

  // props 接收父组件传入的轮播展示内容。
  props: {
    // banners 是首页轮播模块 ContentItem 列表。
    // 页面影响：组件直接读取 title、description、cover、poster、badge、tags、type 和 sourceId。
    banners: {
      type: Array,
      required: true
    },

    // maxItems 来源于 HomeView 读取的已提交 HomeDisplayPreferences。
    // 页面影响: 合法值控制 slide、分页、序号和自动切换集合；非法值回到项目默认上限。
    maxItems: {
      type: Number,
      required: true
    }
  },

  /**
   * 创建首页轮播组件局部状态。
   * 纯函数: 每个组件实例返回独立下标和定时器引用，不读取或修改外部 store。
   * 资源边界: timer 初始为空，由 startAutoplay 创建并由 stopAutoplay/beforeDestroy 释放。
   *
   * @returns {object} 当前轮播下标和定时器引用。
   */
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
     * 收敛组件实际采用的轮播数量。
     * 纯函数: 只读取 maxItems prop；非法输入回到项目默认值，不能绕过二十四条正式上限。
     *
     * @returns {number} 一至二十四之间的整数展示数量。
     */
    resolvedMaxItems() {
      return resolveHomeCarouselItemLimit(this.maxItems);
    },

    /**
     * 过滤后的轮播数据。
     * 纯函数: 只读取父组件 banners prop 并返回新数组，不修改输入。
     *
     * @returns {Array<object>} 可渲染的轮播项数组。
     */
    normalizedBanners() {
      // 处理顺序: 先过滤空项，再按组件已校验数量截断；Provider 返回更多也不能进入 slide、分页或定时器集合。
      return Array.isArray(this.banners)
        ? this.banners.filter(Boolean).slice(0, this.resolvedMaxItems)
        : [];
    },

    /**
     * 判断轮播模块是否存在可展示内容。
     * 纯函数: 只读取 normalizedBanners，不修改组件状态。
     * 页面影响: true 渲染轮播主体，false 渲染空状态。
     *
     * @returns {boolean} 至少存在一个有效轮播项时为 true。
     */
    hasBanners() {
      return this.normalizedBanners.length > 0;
    },

    /**
     * 判断是否需要轮播控制和自动切换。
     * 纯函数: 只读取组件已截断列表长度。
     * 页面影响: true 显示箭头、分页并允许定时器；false 保持单张静态横幅。
     *
     * @returns {boolean} 至少存在两条轮播内容时为 true。
     */
    hasMultipleBanners() {
      return this.normalizedBanners.length > 1;
    },

    /**
     * 当前轮播进度展示文本。
     * 纯函数: 只读取 activeIndex 和轮播数量，不修改组件状态。
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
       * 副作用: 更新 activeIndex，并根据列表状态创建或释放自动轮播定时器。
       * 成功路径: 多条列表保持有效下标并确保自动轮播运行。
       * 失败路径: 零或一条列表重置或保持下标，并释放不需要的定时器。
       *
       * @param {Array<object>} list 最新轮播数据。
       * @returns {void}
       */
      handler(list) {
        // 条件分支: 最新轮播列表为空时进入。
        // 执行内容: 重置下标并释放自动轮播定时器，避免空列表后台继续运行。
        if (!list.length) {
          // 没有轮播数据时回到第一张索引，并停止自动轮播。
          this.activeIndex = 0;
          this.stopAutoplay();
          return;
        }

        // 条件分支: 当前下标超出最新列表范围时进入。
        // 执行内容: 回到第一张，避免模板读取不存在条目。
        if (this.activeIndex >= list.length) {
          // 数据变少时，避免 activeIndex 指向不存在的 slide。
          this.activeIndex = 0;
        }

        // 条件分支: 最新列表只有一条时进入；执行内容: 保持静态横幅并释放旧多条列表的定时器。
        if (list.length === 1) {
          this.stopAutoplay();
          return;
        }

        // 多条可用轮播数据启动自动播放。
        this.startAutoplay();
      }
    }
  },

  /**
   * 在组件挂载后启动自动轮播。
   * 副作用: 可能创建 window.setInterval；空列表或已有定时器时不重复创建。
   *
   * @returns {void} 定时器状态由 startAutoplay 管理。
   */
  mounted() {
    // 组件挂载后启动自动轮播，静态首页也保持真实首页的浏览节奏。
    this.startAutoplay();
  },

  /**
   * 在组件销毁前释放自动轮播资源。
   * 副作用: 清除 window.setInterval 并把 timer 恢复为空，防止离开首页后后台运行。
   *
   * @returns {void} 资源由 stopAutoplay 幂等清理。
   */
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
     * 纯函数: 委托统一导航服务读取 ContentItem.playCatalog，不修改组件状态或解释线路字段。
     * 成功路径: 标准内容、可用线路和可播放逻辑剧集能够形成完整播放目标时返回 true。
     * 失败路径: 内容身份、目录、线路或剧集无效时返回 false，不显示立即播放入口。
     *
     * @param {object} banner 当前轮播 ContentItem。
     * @returns {boolean} 统一导航服务能够生成播放目标时返回 true。
     */
    canPlayBanner(banner) {
      // 返回值类型: boolean。
      // 作用: 页面只消费统一导航决策，不复制默认线路、逻辑剧集或可播放状态规则。
      return Boolean(createContentPlaybackNavigationTarget(banner, { autoplay: true }));
    },

    /**
     * 打开当前轮播项详情页。
     * 副作用: 调用 Vue Router push；不修改轮播内容或用户状态。
     * 成功路径: 内容身份完整时进入同源详情页。
     * 失败路径: 身份缺失时不导航；非重复 Router 错误继续抛出。
     *
     * @param {object} banner 当前轮播项。
     * @returns {void} 通过 vue-router 跳转到 detail 命名路由。
     */
    openBannerDetail(banner) {
      // 条件分支: 轮播项缺少 id 或 sourceId 时进入。
      // 执行内容: 保持首页，不构造无法请求内容的详情目标。
      if (!this.canOpenBanner(banner)) {
        return;
      }

      // 副作用: 先以 list 投影发布当前轮播内容，详情路由采用后可以立即渲染已知字段。
      stageContentRouteShell(banner);

      // 跳转详情页时携带 sourceId/videoId，后续真实详情请求可直接读取路由参数。
      this.$router.push({
        name: 'detail',
        params: {
          sourceId: banner.sourceId,
          videoId: banner.id
        }
      }).catch((error) => {
        // 条件分支: 路由失败不是 Vue Router 3 重复导航时进入。
        // 执行内容: 重新抛出真实导航错误；重复点击保持当前页面。
        if (error && error.name !== 'NavigationDuplicated') {
          throw error;
        }
      });
    },

    /**
     * 打开当前轮播项播放页。
     *
     * @param {object} banner 当前轮播项。
     * 成功路径: 统一导航 service 从 ContentItem 推导默认分集和线路，并携带自动播放意图进入 player 路由。
     * 失败路径: 内容身份或可用线路缺失时保持首页；非重复 Router 错误继续抛出。
     * 副作用: 调用 Vue Router push，不修改轮播 ContentItem 或用户播放状态。
     *
     * @returns {void} 跳转完成或被前置条件阻止后结束。
     */
    openBannerPlayer(banner) {
      // 条件分支: 轮播项缺少可用直连播放线路时进入。
      // 执行内容: 保持首页，不构造无法播放的目标。
      if (!this.canPlayBanner(banner)) {
        return;
      }

      // 副作用: 立即播放同样先发布当前内容壳，媒体解析失败也不会让播放页退回整页空状态。
      stageContentRouteShell(banner);

      // 类型: object|null。
      // 作用: service 统一采用内容默认分集、Provider 默认线路和 autoplay=1，首页不再维护播放器 query 规则。
      const target = createContentPlaybackNavigationTarget(banner, { autoplay: true });

      // 条件分支: 内容身份无法形成播放目标时进入。
      // 执行内容: 保持首页，不回退默认内容或手工拼接不完整路由。
      if (!target) {
        return;
      }

      // 副作用: 执行统一播放器目标；播放页按 query 请求同一分集和线路。
      this.$router.push(target).catch((error) => {
        // 条件分支: 路由失败不是 Vue Router 3 重复导航时进入。
        // 执行内容: 重新抛出真实导航错误；重复点击保持当前页面。
        if (error && error.name !== 'NavigationDuplicated') {
          throw error;
        }
      });
    },

    /**
     * 生成单张轮播图的背景样式。
     * 纯函数: 只读取 ContentItem 图片字段并返回新样式对象，不修改组件状态。
     * 失败路径: 没有真实图片时返回确定性背景，不发起空 URL 请求。
     *
     * @param {object} banner 当前轮播项。
     * @returns {{ backgroundImage: string }} slide 的确定性渐变背景样式对象。
     */
    slideStyle(banner) {
      return {
        // 图片由 SourceImage 负责；slide 始终保留类型渐变，加载中和最终失败都不会出现空白。
        backgroundImage: this.getBannerFallbackBackground(banner)
      };
    },

    /**
     * 切换到指定轮播下标。
     * 副作用: 更新组件 activeIndex，驱动当前 slide、分页点和进度文本同步变化。
     * 失败路径: 空列表不修改下标；任意整数通过取模收敛到有效范围。
     *
     * @param {number} index 目标下标。
     * @returns {void}
     */
    setActive(index) {
      // 条件分支: 当前没有有效轮播项时进入。
      // 执行内容: 保持现有下标，避免以零作为除数计算取模。
      if (!this.normalizedBanners.length) {
        return;
      }

      // 类型: number。
      // 作用: 使用双重取模把正向或负向越界下标收敛到有效列表范围。
      const nextIndex = ((index % this.normalizedBanners.length) + this.normalizedBanners.length) % this.normalizedBanners.length;
      // 副作用: 采用新下标，模板响应式切换当前轮播项和进度。
      this.activeIndex = nextIndex;
    },

    /**
     * 切换到下一张轮播图。
     * 副作用: 委托 setActive 更新 activeIndex，不直接创建定时器。
     *
     * @returns {void}
     */
    nextSlide() {
      this.setActive(this.activeIndex + 1);
    },

    /**
     * 切换到上一张轮播图。
     * 副作用: 委托 setActive 更新 activeIndex，不直接创建定时器。
     *
     * @returns {void}
     */
    prevSlide() {
      this.setActive(this.activeIndex - 1);
    },

    /**
     * 启动自动轮播。
     * 副作用: 创建一个 window.setInterval 并保存资源 id；重复调用不会创建第二个定时器。
     * 失败路径: 少于两条或定时器已经存在时保持原状态。
     *
     * @returns {void}
     */
    startAutoplay() {
      // 条件分支: 少于两条轮播内容或定时器已经存在时进入。
      // 执行内容: 直接返回，单条保持静态且不创建重复 interval。
      if (!this.hasMultipleBanners || this.timer) {
        return;
      }

      // 副作用: 创建浏览器 interval，回调只委托 nextSlide 更新局部下标。
      this.timer = window.setInterval(() => {
        this.nextSlide();
      }, HOME_CAROUSEL_AUTOPLAY_INTERVAL_MILLISECONDS);
    },

    /**
     * 停止自动轮播。
     * 副作用: 清除 window.setInterval 并把 timer 恢复为 null，方法可重复调用。
     * 失败路径: 当前没有定时器时保持空状态。
     *
     * @returns {void}
     */
    stopAutoplay() {
      // 条件分支: 当前没有活动定时器时进入。
      // 执行内容: 直接返回，避免无意义的 clearInterval。
      if (!this.timer) {
        return;
      }

      // 清理定时器后把 timer 置空，方便下次重新启动。
      window.clearInterval(this.timer);
      this.timer = null;
    },

    /**
     * 鼠标移入轮播区时暂停自动轮播。
     * 副作用: 委托 stopAutoplay 释放定时器，不修改当前轮播下标。
     *
     * @returns {void}
     */
    pauseForHover() {
      this.stopAutoplay();
    },

    /**
     * 鼠标移出轮播区时恢复自动轮播。
     * 副作用: 委托 startAutoplay 按当前列表按需创建定时器。
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
  作用容器: 轮播真实展示图片 `.slide-image`。
  样式作用: 在 slide 渐变背景上填满舞台，加载失败时节点移除并自然露出背景。
*/
.slide-image {
  /* 绝对铺满当前 slide，不参与标题和按钮的内容流。 */
  position: absolute;
  /* 四边贴合轮播舞台，保持与旧 CSS 背景相同覆盖范围。 */
  inset: 0;
  /* 图片填满轮播横向空间。 */
  width: 100%;
  /* 图片填满轮播纵向空间。 */
  height: 100%;
  /* 按比例裁切图片，保持旧 background-size: cover 的视觉语义。 */
  object-fit: cover;
  /* 块级图片消除行内基线空隙。 */
  display: block;
}

/*
  首页轮播整体区域。
  对应 template 中的 `.home-carousel`，位于首页内容最上方。
*/
.home-carousel {
  /* 桌面端左下信息和右下分页共享水平安全边距，避免两侧内容贴边。 */
  --carousel-inline-inset: 32px;

  /* 类型标签使用独立横向近边缘距离，不再被正文的较大安全边距推离左上角。 */
  --carousel-badge-inline-inset: 14px;

  /* 类型标签使用独立纵向近边缘距离，让标签在桌面横幅上保持贴角但不压边。 */
  --carousel-badge-block-inset: 14px;

  /* 左下信息组和右下分页共享底部安全边距，形成稳定底部基线。 */
  --carousel-bottom-inset: 24px;

  /* 桌面正文宽度给右侧背景主体与分页控制保留独立区域。 */
  --carousel-content-width: min(600px, 56%);

  /* 桌面箭头保持在横幅垂直中线，和左右背景区域形成稳定切换入口。 */
  --carousel-arrow-block-position: 50%;

  /* 桌面箭头尺寸作为内容安全区计算的唯一事实，避免按钮尺寸和正文避让各自维护。 */
  --carousel-arrow-size: 54px;

  /* 桌面箭头距离舞台边缘的统一距离，同时驱动左右按钮定位。 */
  --carousel-arrow-edge-inset: 22px;

  /* 正文与箭头之间保留稳定空隙，窄屏安全区通过该值和按钮尺寸共同推导。 */
  --carousel-content-control-gap: 12px;

  /* 宽屏正文沿用常规页面安全边距；窄屏会切换为避让左右箭头的计算值。 */
  --carousel-content-safe-inset: var(--carousel-inline-inset);

  /* 桌面标题使用定稿字号，和艺术字体共同形成克制的横幅标题层级。 */
  --carousel-title-font-size: 36px;

  /* 桌面操作按钮使用统一可点击高度，保证播放与详情操作视觉一致。 */
  --carousel-action-min-height: 44px;

  /* 桌面操作按钮增加横向留白，使详情入口比上一版更醒目。 */
  --carousel-action-inline-padding: 22px;

  /* 桌面操作文字提升一级，增强详情入口的可识别性。 */
  --carousel-action-font-size: 16px;

  /* 上下外边距让轮播和首页其它区块分开，避免视觉上挤在一起。 */
  margin: 28px 0 34px;

  /* 允许轮播分区在页面栅格中收缩，避免内部内容反向撑宽页面。 */
  min-width: 0;
}

/*
  轮播舞台容器。
  对应 template 中 `.carousel-shell`，所有 slide、箭头和分页点都定位在这里。
*/
.carousel-shell {
  /* 作为 slide、箭头、分页点的定位参照。 */
  position: relative;

  /* 轮播始终占满父容器，但不会超过首页统一内容宽度。 */
  width: 100%;

  /* 限制轮播最大宽度不超过首页父容器，保证左右边界始终对齐。 */
  max-width: 100%;

  /* 允许轮播在 grid/flex 父级中收缩，避免内容固有宽度撑破页面。 */
  min-width: 0;

  /* 宽高、边框统一按边框盒计算，保证右边界稳定落在父容器内。 */
  box-sizing: border-box;

  /* 桌面端采用定稿的 14:5 电影横幅比例，兼顾画面展示和首屏垂直占用。 */
  aspect-ratio: 14 / 5;

  /* 当前首页轮播回归 v4 通栏直角风格，不额外做圆角。 */
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
  作用容器: 键盘聚焦的轮播舞台 `.carousel-shell:focus-visible`。
  样式作用:
  让方向键操作的焦点在深色背景上保持可见，不改变轮播尺寸。
*/
.carousel-shell:focus-visible {
  /* 使用主题强调色表达键盘焦点，不依赖背景颜色差异。 */
  outline: 2px solid var(--accent);
  /* 让焦点轮廓与舞台边界保持可识别间距。 */
  outline-offset: 4px;
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

  /* slide 只承载背景和定位上下文，内部锚点由统一安全边距变量控制。 */
  display: block;

  /* 背景图居中显示，避免主体偏移过多。 */
  background-position: center center;

  /* 背景图不重复。 */
  background-repeat: no-repeat;

  /* 背景图裁剪填满舞台，保持横幅视觉完整。 */
  background-size: cover;

  /* slide 本身只承载展示，详情和播放由独立按钮提供，避免嵌套点击语义。 */
  cursor: default;

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
  轮播左下信息组。
  对应 template 中 `.slide-content`，包含标题、元信息、简介和操作按钮。
*/
.slide-content {
  /* 整个信息组锚定到左下角，组内内容继续使用自然文档流。 */
  position: absolute;

  /* 正文使用内容安全边距，和独立贴角的类型标签保持不同视觉层级。 */
  left: var(--carousel-content-safe-inset);

  /* 和右下分页共享底部安全边距，保证首屏控制区基线稳定。 */
  bottom: var(--carousel-bottom-inset);

  /* 层级高于蒙层，保证文字可见。 */
  z-index: 1;

  /* 限制文字宽度，给右侧背景主体、箭头和分页保留独立空间。 */
  width: var(--carousel-content-width);

  /* 标题、辅助信息和按钮形成同一个纵向内容流。 */
  display: flex;

  /* 组内元素按标题到操作的阅读顺序纵向排列。 */
  flex-direction: column;

  /* 子元素保持左对齐，不因按钮宽度改变正文宽度。 */
  align-items: flex-start;

  /* 统一组内垂直节奏，替代各元素互相叠加的外边距。 */
  gap: 8px;

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

  /* 标签组使用独立近边缘距离，不受左下正文安全边距影响。 */
  left: var(--carousel-badge-inline-inset);

  /* 标签组使用独立顶部距离，稳定贴近轮播左上角。 */
  top: var(--carousel-badge-block-inset);

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

  /* 标签使用金色，和 v4 首页强调色保持一致。 */
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
  /* 清掉标题默认外边距，垂直间距统一由信息组 gap 管理。 */
  margin: 0;

  /* 首页 Hero 标题读取当前响应式区间的固定字号，避免随视口连续缩放。 */
  font-size: var(--carousel-title-font-size);

  /* 中文标题优先使用本机楷体或仿宋展示字体，并以项目字体作为稳定回退。 */
  font-family: "STKaiti", "KaiTi", "FangSong", "Microsoft YaHei", sans-serif;

  /* 紧凑行高适合大标题。 */
  line-height: 1.08;

  /* 艺术字体使用稳健粗度，避免过重笔画破坏中文标题字形。 */
  font-weight: 700;

  /* 保持 0 字距，避免中文标题出现奇怪间隔。 */
  letter-spacing: 0;

  /* 标题不超过当前内容安全区，避免固有宽度反向撑入左右控制区。 */
  max-width: 100%;

  /* 长中文和无空格拉丁标题允许在安全区内换行，不与箭头或容器边界重叠。 */
  overflow-wrap: anywhere;

  /* 保持自然单词边界；只有连续长串由 overflow-wrap 负责断行。 */
  word-break: normal;

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
  /* 清掉段落默认外边距，垂直间距统一由信息组 gap 管理。 */
  margin: 0;

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
  /* 清掉段落默认外边距，避免可选原名出现时改变信息组锚点。 */
  margin: 0;

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
  /* 清掉段落默认外边距，简介和操作区由统一内容流控制间距。 */
  margin: 0;

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
  /* 操作区留在左下信息组自然内容流中，不再维护第二套绝对坐标。 */
  position: static;

  /* 按钮横向排列，符合影视 Hero 常见操作区。 */
  display: flex;

  /* 按钮垂直居中。 */
  align-items: center;

  /* 按钮较多或窄屏时允许换行。 */
  flex-wrap: wrap;

  /* 控制主按钮和次按钮之间的距离。 */
  gap: 12px;

  /* 操作区和简介之间增加一级节奏，仍由信息组整体底部锚定。 */
  margin-top: 8px;
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

  /* 读取当前响应式区间的统一按钮高度，保证主次操作视觉一致。 */
  min-height: var(--carousel-action-min-height);

  /* 读取当前响应式区间的横向留白，让操作入口具备稳定点击面积。 */
  padding: 0 var(--carousel-action-inline-padding);

  /* 按钮使用小圆角，和现有项目按钮风格保持克制。 */
  border-radius: 4px;

  /* 去掉浏览器默认按钮字体差异，继承项目字体。 */
  font: inherit;

  /* 操作文字读取统一尺寸，使播放和详情按钮保持同一视觉层级。 */
  font-size: var(--carousel-action-font-size);

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

  /* 箭头纵向位置由响应式区间统一提供，避免窄屏箭头压住标题。 */
  top: var(--carousel-arrow-block-position);

  /* 层级高于 slide 和 overlay，保证按钮可以点击。 */
  z-index: 2;

  /* 固定按钮宽度，形成圆形按钮。 */
  width: var(--carousel-arrow-size);

  /* 固定按钮高度，和宽度相同。 */
  height: var(--carousel-arrow-size);

  /* 按自身高度向上偏移一半，保持箭头垂直居中且不重复计算偏移。 */
  transform: translateY(-50%);

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
  left: var(--carousel-arrow-edge-inset);
}

/* 右箭头位置，点击触发 `nextSlide`。 */
.nav-arrow-right {
  right: var(--carousel-arrow-edge-inset);
}

/*
  轮播底部进度区。
  对应 template 中 `.carousel-progress`，包含当前序号和紧凑分页点。
*/
.carousel-progress {
  /* 绝对定位在轮播底部，形成影视 Hero 常见进度提示。 */
  position: absolute;

  /* 进度区放到右下角，避免和左侧标题、按钮形成拥挤。 */
  right: var(--carousel-inline-inset);

  /* 进度区贴近轮播底部但保留呼吸感。 */
  bottom: var(--carousel-bottom-inset);

  /* 层级高于 slide 和 overlay，保证分页按钮可点击。 */
  z-index: 2;

  /* 序号和分页点横向排列。 */
  display: flex;

  /* 序号和分页点垂直居中。 */
  align-items: center;

  /* 控制序号和分页点之间的距离。 */
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
  紧凑分页点容器。
  对应 template 中 `.progress-bars`。
*/
.progress-bars {
  /* 分页点横向排列，不允许换行形成第二行控制区。 */
  display: flex;

  /* 分页点之间使用稳定紧凑间距。 */
  gap: 6px;

  /* 由组件数量边界保证最多十项，这里继续禁止控制区横向撑大舞台。 */
  max-width: 220px;

  /* 控制区不因按钮内容自动换行。 */
  flex-wrap: nowrap;
}

/*
  单个分页按钮。
  对应 template 中 `.dot`，点击后切换到对应 slide。
*/
.dot {
  /* 非激活分页使用小圆点，二十四条内容也保持紧凑可读。 */
  width: 8px;

  /* 分页点保持正方形，避免横向拉伸成虚线。 */
  height: 8px;

  /* 去掉默认按钮内边距，分页点尺寸完全由 width/height 控制。 */
  padding: 0;

  /* 去掉默认按钮边框。 */
  border: none;

  /* 分页点使用圆形，形成清晰的数量导航。 */
  border-radius: 999px;

  /* 非激活分页点使用半透明白色。 */
  background: rgba(255, 255, 255, 0.38);

  /* 手型光标提示分页点可点击。 */
  cursor: pointer;

  /* 激活、悬停和焦点状态只改变尺寸与颜色，不触发父布局重排。 */
  transition: width 0.18s ease, transform 0.18s ease, background-color 0.18s ease, opacity 0.18s ease;
}

/*
  当前激活分页点。
  对应 template 中 `.dot.active`。
*/
.dot.active {
  /* 激活分页变为短胶囊，形成明确位置但不占满底部。 */
  width: 24px;

  /* 激活分页短胶囊使用金色强调当前轮播位置。 */
  background: var(--gold);

  /* 激活分页不额外缩放，避免宽度变化之外再次挤压控制区。 */
  transform: none;

  /* 激活分页完全显示。 */
  opacity: 1;
}

/*
  非激活分页点。
  对应 template 中 `.dot:not(.active)`。
*/
.dot:not(.active) {
  /* 非激活分页点弱化显示。 */
  opacity: 0.75;

  /* 非激活分页点保持半透明白色。 */
  background: rgba(255, 255, 255, 0.45);
}

/*
  作用容器: 鼠标悬停的轮播分页点 `.dot:hover`。
  样式作用:
  提示当前分页点可以点击切换轮播。
  让非激活分页点在鼠标悬停时有轻微反馈。
*/
.dot:hover {
  /* 设置分页点悬停时轻微放大，用于反馈当前可点击切换轮播项。 */
  transform: scale(1.2);
}

/*
  作用容器: 键盘聚焦的单个分页按钮 `.dot:focus-visible`。
  样式作用:
  给不依赖鼠标的轮播用户提供可见焦点。
*/
.dot:focus-visible {
  /* 使用白色外轮廓保证焦点在封面图上可见。 */
  outline: 2px solid rgba(255, 255, 255, 0.96);
  /* 焦点轮廓与分页按钮之间保留稳定间距。 */
  outline-offset: 3px;
}

/*
  作用容器: 首页轮播空状态 `.carousel-empty`。
  样式作用:
  在 banners 为空时保留首页首屏轮播区域的视觉占位。
  让空状态和首页浅色背景区分开，避免页面顶部突然塌陷。
*/
.carousel-empty {
  /* 空状态使用和宽屏轮播相同的 14:5 比例，避免数据分支切换时版面跳动。 */
  aspect-ratio: 14 / 5;

  /* 空状态始终受首页内容容器约束，不会反向撑宽页面。 */
  width: 100%;
  max-width: 100%;
  min-width: 0;

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
@media (max-width: 1180px) {
  .home-carousel {
    /* 中屏收紧正文和分页的水平安全边距，继续保持底部内容对齐。 */
    --carousel-inline-inset: 28px;

    /* 中屏信息组与分页使用更紧凑的底部安全边距。 */
    --carousel-bottom-inset: 20px;

    /* 中屏正文允许略宽，长标题仍不会侵入右下分页区域。 */
    --carousel-content-width: min(520px, 60%);

    /* 中屏标题降低一级，避免 14:5 横幅中的长标题挤压辅助信息。 */
    --carousel-title-font-size: 32px;
  }

  .carousel-shell,
  .carousel-empty {
    /* 中屏继续采用定稿的 14:5 比例，不再维护另一套横幅画幅。 */
    aspect-ratio: 14 / 5;
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
    /* 移动端左上、左下和分页共享窄屏安全边距。 */
    --carousel-inline-inset: 20px;

    /* 移动端类型标签使用更紧凑的独立横向距离，继续保持贴近左上角。 */
    --carousel-badge-inline-inset: 12px;

    /* 移动端类型标签使用更紧凑的独立纵向距离，避免小画幅出现大块留白。 */
    --carousel-badge-block-inset: 12px;

    /* 平板宽度下信息组和分页继续共用底部基线。 */
    --carousel-bottom-inset: 18px;

    /* 平板正文限制在画面左侧，给右下分页保留独立控制区。 */
    --carousel-content-width: min(520px, 65%);

    /* 移动端箭头进入类型标签与左下信息组之间的背景空白带。 */
    --carousel-arrow-block-position: 36%;

    /* 移动端箭头使用紧凑尺寸，正文安全区会直接引用该事实。 */
    --carousel-arrow-size: 44px;

    /* 移动端箭头靠近舞台边缘但保留完整点击边界。 */
    --carousel-arrow-edge-inset: 12px;

    /* 移动端标题同步降低一级，在窄屏下保留完整字形和换行空间。 */
    --carousel-title-font-size: 26px;

    /* 移动端按钮同步放大但保留窄屏布局空间。 */
    --carousel-action-min-height: 40px;

    /* 移动端按钮横向留白在可读性和双按钮并排之间取得平衡。 */
    --carousel-action-inline-padding: 16px;

    /* 移动端按钮文字提升一级，保证详情入口清晰可见。 */
    --carousel-action-font-size: 14px;

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
    /* 高度随可用宽度连续变化，并在手机与平板之间保持可读上下限。 */
    height: clamp(260px, 42vw, 320px);
    aspect-ratio: auto;
  }

  .carousel-empty {
    /* 移动端空状态与轮播主体使用同一响应式高度模型。 */
    height: clamp(260px, 42vw, 320px);
    aspect-ratio: auto;
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

    /* 平板简介最多展示两行，避免内容高度侵入左上类型标签。 */
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  /*
    作用容器: 移动端轮播进度区 `.carousel-progress`。
    样式作用:
    把进度区固定在右下角。
    让进度区和左下角按钮组底部对齐。
  */
  .carousel-progress {
    /* 分页继续使用组件统一安全边距，不维护独立坐标。 */
    right: var(--carousel-inline-inset);
    bottom: var(--carousel-bottom-inset);
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
    /* 设置移动端非激活分页点宽度，二十四条也不挤压控制区。 */
    width: 7px;

    /* 设置移动端分页点高度，保持圆点比例。 */
    height: 7px;
  }

  /*
    作用容器: 移动端激活分页横条 `.dot.active`。
    样式作用:
    缩短激活横条宽度。
    保持激活状态清晰同时适配窄屏宽度。
  */
  .dot.active {
    /* 设置移动端激活分页短胶囊，让当前轮播位置仍然清晰。 */
    width: 20px;
  }
}

/*
  作用容器: 窄手机下的轮播底部控制区。
  样式作用:
  把操作按钮和分页横条分到上下两条独立通道。
  避免按钮数量、标题长度或分页数量变化时互相覆盖。
*/
@media (max-width: 640px) {
  .home-carousel {
    /* 窄手机为分页保留独立底部通道，信息组整体向上让出空间。 */
    --carousel-bottom-inset: 52px;

    /* 窄手机信息组由左右安全边距共同决定宽度。 */
    --carousel-content-width: auto;

    /* 窄手机正文同时避让箭头边距、按钮直径和控制间隙，标题无法进入任一箭头的水平区域。 */
    --carousel-content-safe-inset: calc(var(--carousel-arrow-edge-inset) + var(--carousel-arrow-size) + var(--carousel-content-control-gap));

    /* 窄手机略收紧按钮横向留白，保证两个统一尺寸操作不会横向溢出。 */
    --carousel-action-inline-padding: 14px;
  }

  .slide-content {
    /* 左下信息组同时约束左右边界，长标题和按钮都不能越出横幅。 */
    right: var(--carousel-content-safe-inset);
    width: var(--carousel-content-width);
    gap: 6px;
  }

  .slide-actions {
    /* 手机操作区保持单行，按钮属于信息流且不会与底部分页重叠。 */
    flex-wrap: nowrap;
    margin-top: 6px;
  }

  .slide-action {
    /* 两个操作按钮允许等比收缩，横向留白由窄手机尺寸变量统一控制。 */
    min-width: 0;
  }

  .carousel-progress {
    /* 分页单独占据最底部通道并在轮播中水平居中。 */
    left: var(--carousel-inline-inset);
    right: var(--carousel-inline-inset);
    bottom: 16px;
    justify-content: center;
  }

  .slide-original,
  .slide-summary {
    /* 窄手机隐藏原名和简介，保留类型、标题、元信息、操作与分页核心信息。 */
    display: none;
  }

  .slide-meta {
    /* 元信息保持单行并在空间不足时截断，避免挤压操作按钮。 */
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
