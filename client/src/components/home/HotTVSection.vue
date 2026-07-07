<template>
  <!--
    HotTVSection 组件渲染树

    {section.hot-section}
    ├─ {header.hot-section__header}
    │  ├─ {h2.hot-section__title} 热门电视剧标题
    │  └─ {p.hot-section__subtitle} 热门电视剧说明
    └─ {div.hot-section__body}
       ├─ [if hasTVList]
       │  └─ {div.hot-section__grid}
       │     └─ {VideoCard} 循环渲染 tvList 电视剧卡片
       ├─ [else]
       │  └─ {div.hot-section__empty} 电视剧卡片区空状态
       └─ {HotRanking}
          └─ 读取 ranking，渲染电视剧榜单或电视剧榜单空状态
  -->
  <!--
    首页热门电视剧区域。
    作用：展示电视剧卡片网格，并在右侧展示电视剧榜单。
  -->
  <section class="hot-section">
    <!-- 区块头部，显示标题和辅助说明。 -->
    <header class="hot-section__header">
      <div>
        <!-- 区块标题，说明当前区域是热门电视剧。 -->
        <h2 class="hot-section__title">热门电视剧</h2>

        <!-- 区块说明，帮助用户理解这里展示的内容类型。 -->
        <p class="hot-section__subtitle">适合连续观看的剧集内容</p>
      </div>
    </header>

    <!-- 区块主体，左侧卡片网格，右侧榜单。 -->
    <div class="hot-section__body">
      <!-- 电视剧卡片网格，tvList 有内容时渲染真实卡片。 -->
      <div v-if="hasTVList" class="hot-section__grid">
        <!-- 循环渲染电视剧卡片，当前只用于静态布局展示。 -->
        <VideoCard v-for="item in tvList" :key="item.id || item.title" :video="item" />
      </div>

      <!-- 电视剧卡片空状态，tvList 没有内容时保留热门电视剧卡片区占位。 -->
      <div v-else class="hot-section__empty">
        <h3 class="hot-section__empty-title">暂无可展示内容</h3>
        <p class="hot-section__empty-text">当前热门电视剧模块没有数据。</p>
      </div>

      <!-- 电视剧榜单，组件内部会根据 ranking 是否有内容决定显示榜单或空状态。 -->
      <HotRanking title="电视剧榜单" :items="ranking" />
    </div>
  </section>
</template>

<script>
// 通用视频卡片组件，负责渲染电视剧卡片外观。
import VideoCard from '../common/VideoCard.vue';

// 首页榜单组件，负责渲染右侧电视剧榜单。
import HotRanking from './HotRanking.vue';

export default {
  // 组件名称用于在调试工具和报错信息中识别热门电视剧区域。
  name: 'HotTVSection',

  // 注册当前模板中使用的子组件。
  components: {
    // <VideoCard /> 对应左侧电视剧卡片网格。
    VideoCard,

    // <HotRanking /> 对应右侧电视剧榜单。
    HotRanking
  },

  // props 接收父组件传入的电视剧展示列表和榜单列表。
  props: {
    // tvList 用于驱动左侧电视剧卡片网格。
    tvList: {
      type: Array,
      required: true
    },

    // ranking 用于驱动右侧电视剧榜单，数组为空时榜单组件显示空状态。
    ranking: {
      type: Array,
      required: true
    }
  },

  computed: {
    // hasTVList 表示左侧电视剧卡片网格是否有真实卡片可以渲染。
    hasTVList() {
      return this.tvList.length > 0;
    }
  }
};
</script>

<style scoped>
/*
  热门电视剧区域整体容器。
  对应 template 中的 `.hot-section`，负责包裹标题、卡片网格和榜单。
*/
.hot-section {
  /* 给首页底部内容留出自然收尾距离。 */
  margin-bottom: 10px;
}

/*
  区块头部。
  对应 template 中的 `.hot-section__header`，承载标题和说明。
*/
.hot-section__header {
  /* 使用 flex 便于后续扩展右侧操作入口。 */
  display: flex;

  /* 让标题区域和可能出现的操作入口左右分布。 */
  justify-content: space-between;

  /* 垂直方向对齐头部内容。 */
  align-items: flex-end;

  /* 控制头部和主体之间的距离。 */
  margin-bottom: 18px;
}

/*
  区块标题。
  对应 template 中的 `.hot-section__title`，展示当前区块名称。
*/
.hot-section__title {
  /* 清掉默认外边距，避免标题区域间距失控。 */
  margin: 0;

  /* 使用较大字号，形成页面二级标题。 */
  font-size: 24px;

  /* 使用较粗字重突出区块标题。 */
  font-weight: 700;

  /* 使用深色文字提高标题可读性。 */
  color: #182235;
}

/*
  区块说明。
  对应 template 中的 `.hot-section__subtitle`，展示区块补充说明。
*/
.hot-section__subtitle {
  /* 控制说明文字和标题之间的距离。 */
  margin: 8px 0 0;

  /* 使用正文偏小字号，保持辅助层级。 */
  font-size: 14px;

  /* 使用中性色弱化说明文字。 */
  color: #667085;
}

/*
  区块主体布局。
  对应 template 中的 `.hot-section__body`，分为左侧卡片网格和右侧榜单。
*/
.hot-section__body {
  /* 使用网格布局，把卡片区和榜单区放在同一行。 */
  display: grid;

  /* 左侧卡片区占主要空间，右侧榜单保持固定辅助宽度。 */
  grid-template-columns: minmax(0, 1fr) 300px;

  /* 控制卡片区和榜单之间的距离。 */
  gap: 24px;
}

/*
  视频卡片网格。
  对应 template 中的 `.hot-section__grid`，内部循环渲染多个 VideoCard。
*/
.hot-section__grid {
  /* 使用 CSS Grid 管理卡片列表。 */
  display: grid;

  /* 四列网格让首页内容区在桌面端保持较高信息密度。 */
  grid-template-columns: repeat(4, minmax(0, 1fr));

  /* 控制卡片之间的横向和纵向距离。 */
  gap: 18px;
}

/*
  热门电视剧卡片区空状态。
  对应 template 中的 `.hot-section__empty`，在 tvList 为空时显示。
*/
.hot-section__empty {
  /* 使用白色背景，让空状态和页面背景形成清晰区分。 */
  background: #ffffff;

  /* 使用边框保留卡片区模块边界。 */
  border: 1px dashed #d6deea;

  /* 保持和首页卡片一致的圆角。 */
  border-radius: 8px;

  /* 给空状态设置最小高度，让它接近卡片网格的视觉占位。 */
  min-height: 260px;

  /* 使用 flex 居中空状态内容。 */
  display: flex;

  /* 让标题和说明上下排列。 */
  flex-direction: column;

  /* 水平方向居中空状态文字。 */
  align-items: center;

  /* 垂直方向居中空状态文字。 */
  justify-content: center;

  /* 给空状态内部留出安全空间。 */
  padding: 24px;

  /* 空状态文字居中显示。 */
  text-align: center;
}

/*
  热门电视剧卡片区空状态标题。
  对应 template 中的 `.hot-section__empty-title`。
*/
.hot-section__empty-title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用中等标题大小，和榜单标题保持接近。 */
  font-size: 18px;

  /* 使用较粗字重突出空状态主信息。 */
  font-weight: 700;

  /* 使用深色文字保证可读性。 */
  color: #182235;
}

/*
  热门电视剧卡片区空状态说明。
  对应 template 中的 `.hot-section__empty-text`。
*/
.hot-section__empty-text {
  /* 控制说明文字和标题之间的距离。 */
  margin: 10px 0 0;

  /* 使用正文偏小字号，保持辅助层级。 */
  font-size: 14px;

  /* 使用中性色弱化说明文字。 */
  color: #667085;
}
</style>
