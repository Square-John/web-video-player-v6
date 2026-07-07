<template>
  <!--
    CatalogGrid 组件渲染树

    {section.catalog-grid-wrap}
    ├─ [if hasItems]
    │  └─ {div.catalog-grid}
    │     └─ {div.catalog-card-cell} 循环渲染 items 视频卡片坑位
    │        └─ {VideoCard} 渲染单张视频卡片
    └─ [else]
       └─ {el-empty.catalog-grid-empty}
          - 读取 emptyTitle / emptyText 渲染主体空状态
          - 保持目录页主体区域高度，避免列表为空时页面塌陷
  -->
  <!--
    目录主体展示区。
    作用：展示目录页或搜索页的卡片列表，没数据时显示 Element UI 主体空状态。
  -->
  <section class="catalog-grid-wrap">
    <!-- items 有内容时渲染卡片网格。 -->
    <div v-if="hasItems" class="catalog-grid">
      <!--
        循环渲染视频卡片。
        外层 catalog-card-cell 负责把电影、电视剧、搜索页的卡片坑位固定到首页卡片同款宽度。
      -->
      <div
        v-for="item in items"
        :key="item.id || item.title"
        class="catalog-card-cell"
      >
        <!--
          VideoCard 负责卡片内容。
          卡片宽度由 catalog-grid 的 7 列栅格决定，组件自身只负责填满所在列。
        -->
        <VideoCard
          :video="item"
        />
      </div>
    </div>

    <!-- items 为空时，展示主体区域空状态。 -->
    <el-empty
      v-else
      class="catalog-grid-empty"
      :description="emptyDescription" />
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
    /**
     * 主体区是否有真实卡片可以渲染。
     *
     * @returns {boolean} 有卡片数据时返回 true。
     */
    hasItems() {
      return this.items.length > 0;
    },

    /**
     * Element UI 空状态说明文案。
     *
     * @returns {string} 合并后的空状态标题和说明。
     */
    emptyDescription() {
      // el-empty 只有 description 一个主文案入口，这里把标题和说明合成一句。
      return `${this.emptyTitle}，${this.emptyText}`;
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

  /*
    桌面端固定 7 列。
    首页左侧视频区也是同一套 7 列栅格里的 5 列，所以这里的单列宽度会和首页卡片一致。
  */
  grid-template-columns: repeat(var(--page-grid-columns), minmax(0, 1fr));

  /* 控制卡片之间的横向和纵向间距，使用全站页面栅格统一间距。 */
  gap: var(--page-grid-gap);

  /* 卡片顶部对齐，避免内容高度不同导致同一行错位。 */
  align-items: start;
}

/*
  目录页单张卡片外层单元格。
  对应 template 中 `.catalog-card-cell`，内部包着一个 VideoCard。
  作用是让电影、电视剧、搜索页的每个卡片都安放在 7 列栅格中的一个列位里。
*/
.catalog-card-cell {
  /* 允许内部标题、角标等长内容被省略，而不是撑开当前栅格列。 */
  min-width: 0;
}

/*
  主体区空状态。
  对应 template 中的 `.catalog-grid-empty`，在 items 为空时显示。
*/
.catalog-grid-empty {
  /* 主体区空状态需要比普通卡片更高，避免页面中间区域塌陷。 */
  min-height: 360px;

  /* 使用虚线边框提示这里是主体内容占位。 */
  border: 1px dashed var(--border-strong);

  /* 当前项目卡片风格偏直角，目录空状态也保持直角。 */
  border-radius: 0;

  /* 使用半透明白色背景，和 theme-surface 风格保持一致。 */
  background: rgba(255, 255, 255, 0.58);
}

/*
  平板宽度下卡片网格稍微降低最小列宽。
  触发条件：屏幕宽度不超过 900px。
*/
@media (max-width: 900px) {
  .catalog-grid {
    /* 平板端从 7 列收为 3 列，避免卡片被压得太窄。 */
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

/*
  手机宽度下固定两列。
  触发条件：屏幕宽度不超过 640px。
*/
@media (max-width: 640px) {
  .catalog-grid {
    /* 手机上两列卡片更稳定，也更适合手指点击。 */
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
