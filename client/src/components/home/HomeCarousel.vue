<template>
  <!--
    HomeCarousel 组件渲染树

    {section.home-carousel} [@mouseenter="pauseForHover"] [@mouseleave="resumeForHover"]
    ├─ [if hasBanners] 轮播内容分支
    │  └─ {div.carousel-shell} [tabindex="0"]
    │     ├─ {article.carousel-slide} [v-for banner,index in normalizedBanners]
    │     │  ├─ {div.slide-overlay}
    │     │  └─ {div.slide-content}
    │     │     ├─ {p.slide-label} 当前轮播项标签
    │     │     ├─ {p.slide-video-id} 当前轮播项标题
    │     │     └─ {p.slide-summary} 当前轮播项简介
    │     ├─ {button.nav-arrow.nav-arrow-left} 上一张按钮
    │     ├─ {button.nav-arrow.nav-arrow-right} 下一张按钮
    │     └─ {div.dot-list} 分页点列表
    │
    └─ [else] 轮播分区空状态
       └─ {el-empty}
          - banners 为空时显示
          - 保留轮播分区占位，避免首页模块塌陷
  -->
  <!--
    首页轮播区域。
    作用：展示首页最上方的重点内容区域，视觉上回归 参考布局 的通栏横幅轮播。
  -->
  <section
    class="home-carousel"
    @mouseenter="pauseForHover"
    @mouseleave="resumeForHover">
    <!--
      轮播主体分支。
      渲染条件：`normalizedBanners` 至少有一条数据。
      页面作用：用多张 slide 叠放的方式还原 参考布局 首页横幅视觉。
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
        :style="slideStyle(banner)">
        <!-- 背景蒙层，让封面图上的标题和简介始终清晰。 -->
        <div class="slide-overlay"></div>

        <!-- 轮播前景文案区，显示标签、标题和简介。 -->
        <div class="slide-content">
          <p class="slide-label">{{ banner.label || '首页推荐' }}</p>
          <p class="slide-video-id">{{ banner.title || '未命名内容' }}</p>
          <p class="slide-summary">{{ banner.summary || '暂无简介' }}</p>
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

      <!-- 底部分页点，数量和轮播数据条数一致。 -->
      <div class="dot-list" role="tablist" aria-label="轮播图分页">
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
 * - 只接收父组件传入的 banners，不主动请求数据
 * - 负责自动播放、鼠标悬停暂停、箭头切换和分页点切换
 */
export default {
  // 组件名称用于在调试工具和报错信息中识别首页轮播组件。
  name: 'HomeCarousel',

  // props 接收父组件传入的轮播展示内容。
  props: {
    // banners 是首页轮播模块数据，当前组件取第一项作为主视觉内容。
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
     * 生成单张轮播图的背景样式。
     *
     * @param {object} banner 当前轮播项。
     * @returns {{ backgroundImage: string }} slide 背景样式对象。
     */
    slideStyle(banner) {
      // 当前版本 首页字段使用 cover，之后数据源 Provider如果提供 image/poster 也可以兼容显示。
      const imageUrl = banner.cover || banner.image || banner.poster || '';

      if (!imageUrl) {
        // 没有封面时使用纯渐变兜底，避免背景图 url 为空造成无意义请求。
        return {
          backgroundImage: 'linear-gradient(135deg, #172133 0%, #23314a 48%, #101724 100%)'
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
  min-height: 420px;

  /* 桌面端保持宽屏电影横幅比例，突出首页推荐区域。 */
  aspect-ratio: 16 / 6.3;

  /* 当前首页轮播回归 参考布局 通栏直角风格，不额外做圆角。 */
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

  /* 文案区贴近轮播底部，符合影视横幅常见布局。 */
  align-items: flex-end;

  /* 给文案区和左右按钮留空间，避免文字贴边。 */
  padding: 42px 42px 64px;

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

  /* 横向和纵向渐变共同压暗文字区域，保证标题和简介可读。 */
  background:
    linear-gradient(90deg, rgba(9, 14, 24, 0.82) 0%, rgba(9, 14, 24, 0.52) 36%, rgba(9, 14, 24, 0.18) 72%, rgba(9, 14, 24, 0.55) 100%),
    linear-gradient(180deg, rgba(10, 15, 25, 0.06) 0%, rgba(10, 15, 25, 0.48) 100%);
}

/*
  轮播文字内容区。
  对应 template 中 `.slide-content`，包含标签、标题和简介。
*/
.slide-content {
  /* 相对定位配合 z-index，让文字层盖在 overlay 上方。 */
  position: relative;

  /* 层级高于蒙层，保证文字可见。 */
  z-index: 1;

  /* 限制文字宽度，避免横幅标题和简介铺满整屏。 */
  max-width: min(620px, 72%);

  /* 文字使用白色，适配深色蒙层背景。 */
  color: #fff;
}

/*
  轮播标签。
  对应 template 中 `.slide-label`，显示 `banner.label`。
*/
.slide-label {
  /* 和标题之间保留距离。 */
  margin: 0 0 12px;

  /* 标签字号小于标题，用作辅助信息。 */
  font-size: 14px;

  /* 标签加粗，在深色背景上更清晰。 */
  font-weight: 700;

  /* 标签使用金色，和 参考布局 首页强调色保持一致。 */
  color: var(--gold);
}

/*
  轮播主标题。
  对应 template 中 `.slide-video-id`，显示 `banner.title`。
*/
.slide-video-id {
  /* 清掉段落默认外边距，只保留和简介之间的下边距。 */
  margin: 0 0 10px;

  /* clamp 让标题在桌面宽屏变大，在窄屏保持可控。 */
  font-size: clamp(28px, 3.2vw, 42px);

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
  轮播简介文本。
  对应 template 中 `.slide-summary`，显示 `banner.summary`。
*/
.slide-summary {
  /* 清掉段落默认外边距。 */
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

/* 底部分页点列表，显示当前轮播位置并提供直接切换入口。 */
.dot-list {
  position: absolute;
  left: 50%;
  bottom: 20px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  transform: translateX(-50%);
}

/* 单个分页点，点击后切换到对应 slide。 */
.dot {
  width: 18px;
  height: 4px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.38);
  cursor: pointer;
  transition: transform 0.18s ease, background-color 0.18s ease, opacity 0.18s ease;
}

/* 当前激活分页点，用金色强调当前轮播位置。 */
.dot.active {
  background: var(--gold);
  transform: scale(1.2);
  opacity: 1;
}

/* 非激活分页点保持弱提示状态。 */
.dot:not(.active) {
  opacity: 0.75;
  background: rgba(255, 255, 255, 0.45);
}

/* 分页点 hover 时略微放大，提示可以点击切换。 */
.dot:hover {
  transform: scale(1.15);
}

/* 轮播分区空状态，banners 为空时显示在首页顶部。 */
.carousel-empty {
  min-height: 360px;
  background: var(--surface-soft);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-soft);
}

/* 中等屏幕下收紧轮播高度和内边距。 */
@media (max-width: 1200px) {
  .carousel-shell {
    min-height: 360px;
  }

  .carousel-slide {
    padding: 34px 34px 56px;
  }
}

/* 移动端把轮播改成更适合窄屏的 16:9 比例。 */
@media (max-width: 768px) {
  .home-carousel {
    margin: 18px 0 24px;
  }

  .carousel-shell {
    min-height: 300px;
    aspect-ratio: 16 / 9;
  }

  .carousel-slide {
    padding: 24px 20px 52px;
  }

  .slide-content {
    max-width: 100%;
  }

  .slide-video-id {
    font-size: 24px;
    margin-bottom: 8px;
  }

  .slide-summary {
    font-size: 13px;
    line-height: 1.55;
  }

  .nav-arrow {
    width: 44px;
    height: 44px;
    margin-top: -22px;
  }

  .nav-arrow-left {
    left: 12px;
  }

  .nav-arrow-right {
    right: 12px;
  }

  .dot-list {
    bottom: 12px;
  }
}
</style>
