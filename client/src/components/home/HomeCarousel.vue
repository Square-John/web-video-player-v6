<template>
  <!--
    HomeCarousel 组件渲染树

    {section.home-carousel}
    ├─ [if hasBanners]
    │  ├─ {div.home-carousel__hero}
    │  │  ├─ {p.home-carousel__eyebrow} 当前轮播项标签
    │  │  ├─ {h1.home-carousel__title} 当前轮播项标题
    │  │  └─ {p.home-carousel__summary} 当前轮播项简介
    │  └─ {div.home-carousel__side}
    │     └─ {article.home-carousel__item} 循环展示全部轮播入口
    └─ [else]
       └─ {div.home-carousel__empty}
          ├─ {h2.home-carousel__empty-title} 轮播空状态标题
          └─ {p.home-carousel__empty-text} 轮播空状态说明
  -->
  <!--
    首页轮播区域。
    作用：展示首页最上方的重点内容区域。
  -->
  <section class="home-carousel">
    <!-- 左侧主视觉区域，banners 有内容时展示第一条重点内容。 -->
    <div v-if="hasBanners" class="home-carousel__hero">
      <!-- 轮播区短标签，说明该区域承载重点推荐内容。 -->
      <p class="home-carousel__eyebrow">{{ activeBanner.label }}</p>

      <!-- 轮播区主标题，对应当前重点内容名称。 -->
      <h1 class="home-carousel__title">{{ activeBanner.title }}</h1>

      <!-- 轮播区说明文字，补充当前内容的看点。 -->
      <p class="home-carousel__summary">{{ activeBanner.summary }}</p>
    </div>

    <!-- 轮播空状态，banners 没有内容时保留轮播区域占位。 -->
    <div v-else class="home-carousel__empty">
      <h2 class="home-carousel__empty-title">暂无可展示内容</h2>
      <p class="home-carousel__empty-text">当前首页轮播模块没有数据。</p>
    </div>

    <!-- 右侧缩略列表，banners 有内容时展示其他重点内容入口。 -->
    <div v-if="hasBanners" class="home-carousel__side">
      <!-- 循环展示轮播项，当前只用于静态视觉列表。 -->
      <article v-for="banner in banners" :key="banner.id" class="home-carousel__item">
        <!-- 缩略块，用来模拟小封面。 -->
        <span class="home-carousel__thumb"></span>

        <!-- 缩略列表标题。 -->
        <span class="home-carousel__item-title">{{ banner.title }}</span>
      </article>
    </div>
  </section>
</template>

<script>
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

  computed: {
    // hasBanners 表示轮播模块是否拿到了可展示数据。
    hasBanners() {
      return this.banners.length > 0;
    },

    // activeBanner 表示当前主视觉内容，模板左侧大区域会读取它。
    activeBanner() {
      return this.banners[0] || {};
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
  /* 使用网格把主视觉和缩略列表分成左右两列。 */
  display: grid;

  /* 左侧主视觉占更多空间，右侧缩略列表保持辅助宽度。 */
  grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.8fr);

  /* 控制左右两列之间的距离。 */
  gap: 24px;

  /* 给轮播区域自身留出底部距离，和后续内容区分开。 */
  margin-bottom: 34px;
}

/*
  轮播空状态。
  对应 template 中的 `.home-carousel__empty`，在 banners 为空时显示。
*/
.home-carousel__empty {
  /* 让空状态横跨左右两列，保持轮播模块的完整占位宽度。 */
  grid-column: 1 / -1;

  /* 使用白色背景，让空状态和页面背景区分开。 */
  background: #ffffff;

  /* 使用边框明确轮播模块的占位边界。 */
  border: 1px solid #e6eaf0;

  /* 保持和主视觉区域一致的圆角。 */
  border-radius: 8px;

  /* 给空状态留出接近轮播主视觉的高度，避免页面结构突然变矮。 */
  min-height: 220px;

  /* 使用 flex 居中空状态内容。 */
  display: flex;

  /* 让标题和说明上下排列。 */
  flex-direction: column;

  /* 水平方向居中空状态文字。 */
  align-items: center;

  /* 垂直方向居中空状态文字。 */
  justify-content: center;

  /* 给空状态内部留出安全空间。 */
  padding: 32px;

  /* 空状态文字居中显示。 */
  text-align: center;
}

/*
  轮播空状态标题。
  对应 template 中的 `.home-carousel__empty-title`，说明当前模块没有数据。
*/
.home-carousel__empty-title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用二级标题大小，让空状态主信息清晰。 */
  font-size: 22px;

  /* 使用较粗字重突出空状态标题。 */
  font-weight: 700;

  /* 使用深色文字保证可读性。 */
  color: #182235;
}

/*
  轮播空状态说明。
  对应 template 中的 `.home-carousel__empty-text`，补充说明空状态来源。
*/
.home-carousel__empty-text {
  /* 控制说明文字和标题之间的距离。 */
  margin: 10px 0 0;

  /* 使用正文大小，保持说明文字易读。 */
  font-size: 14px;

  /* 使用中性色，让说明文字处于辅助层级。 */
  color: #667085;
}

/*
  主视觉区域。
  对应 template 中的 `.home-carousel__hero`，展示当前重点内容。
*/
.home-carousel__hero {
  /* 设置最小高度，让轮播区在页面第一屏中有足够存在感。 */
  min-height: 340px;

  /* 使用 flex 让文字内容贴近底部，更接近视频首页视觉习惯。 */
  display: flex;

  /* 让主视觉文字从上到下排列。 */
  flex-direction: column;

  /* 把文字推到底部，形成海报式信息区。 */
  justify-content: flex-end;

  /* 给主视觉内部留出宽松空间。 */
  padding: 42px;

  /* 使用深浅叠加背景，模拟真实影视封面氛围。 */
  background:
    linear-gradient(135deg, rgba(24, 34, 53, 0.9), rgba(49, 95, 202, 0.42)),
    linear-gradient(180deg, #53657f 0%, #253044 100%);

  /* 白色文字需要搭配深色背景，保证主视觉信息可读。 */
  color: #ffffff;

  /* 使用圆角统一首页内容区的视觉形状。 */
  border-radius: 8px;
}

/*
  主视觉短标签。
  对应 template 中的 `.home-carousel__eyebrow`，展示重点内容的分类提示。
*/
.home-carousel__eyebrow {
  /* 清掉默认段落外边距，方便控制和标题之间的距离。 */
  margin: 0 0 12px;

  /* 缩小字号，形成辅助信息层级。 */
  font-size: 14px;

  /* 使用较粗字重，保证深色背景上仍然清晰。 */
  font-weight: 700;
}

/*
  主视觉标题。
  对应 template 中的 `.home-carousel__title`，展示当前重点内容名称。
*/
.home-carousel__title {
  /* 清掉默认标题外边距，避免间距不可控。 */
  margin: 0;

  /* 使用较大字号，让轮播区主标题成为首页视觉重点。 */
  font-size: 40px;

  /* 设置较紧凑行高，让多行标题仍然稳定。 */
  line-height: 1.15;
}

/*
  主视觉说明。
  对应 template 中的 `.home-carousel__summary`，补充当前重点内容看点。
*/
.home-carousel__summary {
  /* 控制说明文字和主标题之间的距离。 */
  margin: 18px 0 0;

  /* 限制说明宽度，避免长文本铺满整块主视觉。 */
  max-width: 560px;

  /* 设置正文行高，提升多行阅读舒适度。 */
  line-height: 1.7;

  /* 使用轻微透明，弱化说明文字层级。 */
  opacity: 0.88;
}

/*
  右侧缩略列表。
  对应 template 中的 `.home-carousel__side`，展示多个重点内容入口。
*/
.home-carousel__side {
  /* 使用纵向 flex 排列多个缩略项。 */
  display: flex;

  /* 让缩略项从上到下排列。 */
  flex-direction: column;

  /* 控制缩略项之间的距离。 */
  gap: 14px;
}

/*
  单个缩略项。
  对应 template 中的 `.home-carousel__item`，展示一条重点内容入口。
*/
.home-carousel__item {
  /* 使用 flex 让缩略图和标题横向排列。 */
  display: flex;

  /* 垂直居中缩略图和标题。 */
  align-items: center;

  /* 控制缩略图和标题之间的距离。 */
  gap: 14px;

  /* 给缩略项留出内部空间，形成可点击入口的视觉尺寸。 */
  padding: 14px;

  /* 使用白色背景，让缩略项和页面背景分开。 */
  background: #ffffff;

  /* 使用边框强化列表项边界。 */
  border: 1px solid #e6eaf0;

  /* 与其他卡片保持统一圆角。 */
  border-radius: 8px;
}

/*
  缩略图色块。
  对应 template 中的 `.home-carousel__thumb`，模拟内容小封面。
*/
.home-carousel__thumb {
  /* 固定宽度，保证缩略列表排版稳定。 */
  width: 68px;

  /* 固定高度，让缩略图比例统一。 */
  height: 46px;

  /* 防止缩略图在窄空间下被压缩。 */
  flex: 0 0 auto;

  /* 使用渐变模拟封面色块。 */
  background: linear-gradient(135deg, #dbe5f6, #aab8d4);

  /* 使用小圆角让缩略图更贴近卡片风格。 */
  border-radius: 6px;
}

/*
  缩略项标题。
  对应 template 中的 `.home-carousel__item-title`，显示入口名称。
*/
.home-carousel__item-title {
  /* 使用较粗字重，让列表标题更容易扫读。 */
  font-weight: 700;

  /* 设置正文级字号，保持列表紧凑。 */
  font-size: 15px;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}
</style>
