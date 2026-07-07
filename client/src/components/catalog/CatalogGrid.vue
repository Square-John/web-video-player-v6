<template>
  <!--
    CatalogGrid 组件渲染树

    {section.catalog-grid-wrap}
    ├─ [if hasItems]
    │  └─ {div.catalog-grid}
    │     └─ {VideoCard} 循环渲染 items 视频卡片
    └─ [else]
       └─ {div.catalog-grid-empty}
          ├─ {h2.catalog-grid-empty__title} 读取 emptyTitle 渲染空状态标题
          └─ {p.catalog-grid-empty__text} 读取 emptyText 渲染空状态说明
  -->
  <!--
    目录主体展示区。
    作用：展示目录页或搜索页的卡片列表，没数据时显示主体空状态。
  -->
  <section class="catalog-grid-wrap">
    <!-- items 有内容时渲染卡片网格。 -->
    <div v-if="hasItems" class="catalog-grid">
      <!-- 循环渲染视频卡片，复用通用 VideoCard 组件。 -->
      <VideoCard v-for="item in items" :key="item.id || item.title" :video="item" />
    </div>

    <!-- items 为空时，展示主体区域空状态。 -->
    <div v-else class="catalog-grid-empty">
      <h2 class="catalog-grid-empty__title">{{ emptyTitle }}</h2>
      <p class="catalog-grid-empty__text">{{ emptyText }}</p>
    </div>
  </section>
</template>

<script>
// 通用视频卡片组件，负责渲染目录中的单个视频条目。
import VideoCard from '../common/VideoCard.vue';

export default {
  // 组件名称用于在调试工具和报错信息中识别目录主体展示区。
  name: 'CatalogGrid',

  // 注册当前模板中使用的视频卡片组件。
  components: {
    // <VideoCard /> 对应主体区域中的单个视频卡片。
    VideoCard
  },

  props: {
    // items 是主体卡片列表，会直接决定网格区渲染卡片还是空状态。
    items: {
      type: Array,
      required: true
    },

    // emptyTitle 是主体区空状态标题，方便不同页面复用同一个网格组件。
    emptyTitle: {
      type: String,
      default: '暂无可展示内容'
    },

    // emptyText 是主体区空状态说明，父组件可以根据页面语义传入不同文案。
    emptyText: {
      type: String,
      default: '当前列表没有数据。'
    }
  },

  computed: {
    // hasItems 表示主体区是否有真实卡片可以渲染。
    hasItems() {
      return this.items.length > 0;
    }
  }
};
</script>

<style scoped>
/*
  目录主体展示区外层容器。
  对应 template 中的 `.catalog-grid-wrap`，位于筛选栏和分页之间。
*/
.catalog-grid-wrap {
  /* 控制主体区和分页之间的距离。 */
  margin-bottom: 26px;
}

/*
  视频卡片网格。
  对应 template 中的 `.catalog-grid`，内部循环渲染多个 VideoCard。
*/
.catalog-grid {
  /* 使用 CSS Grid 管理视频卡片列表。 */
  display: grid;

  /* 每列最小 170px，宽屏自动增加列数，窄屏自动减少列数。 */
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));

  /* 控制卡片之间的横向和纵向间距。 */
  gap: 20px;
}

/*
  主体区空状态。
  对应 template 中的 `.catalog-grid-empty`，在 items 为空时显示。
*/
.catalog-grid-empty {
  /* 使用白色背景，让主体空状态和页面背景区分开。 */
  background: #ffffff;

  /* 使用虚线边框提示这里是主体内容占位。 */
  border: 1px dashed #d6deea;

  /* 保持和其他内容区一致的圆角。 */
  border-radius: 8px;

  /* 主体区空状态需要比普通卡片更高，避免页面中间区域塌陷。 */
  min-height: 360px;

  /* 使用 flex 居中空状态内容。 */
  display: flex;

  /* 让标题和说明上下排列。 */
  flex-direction: column;

  /* 水平方向居中。 */
  align-items: center;

  /* 垂直方向居中。 */
  justify-content: center;

  /* 给空状态内部留出安全空间。 */
  padding: 32px;

  /* 空状态文字居中显示。 */
  text-align: center;
}

/*
  主体空状态标题。
  对应 template 中的 `.catalog-grid-empty__title`。
*/
.catalog-grid-empty__title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用较大字号，让主体空状态明确可见。 */
  font-size: 24px;

  /* 使用较粗字重突出主提示。 */
  font-weight: 700;

  /* 使用深色文字保证可读性。 */
  color: #182235;
}

/*
  主体空状态说明。
  对应 template 中的 `.catalog-grid-empty__text`。
*/
.catalog-grid-empty__text {
  /* 控制说明和标题之间的距离。 */
  margin: 12px 0 0;

  /* 使用正文大小，保持说明文字易读。 */
  font-size: 15px;

  /* 使用中性色，让说明处在辅助层级。 */
  color: #667085;
}
</style>
