<template>
  <!--
    HotTVSection 首页热门电视剧区块渲染树

    {section.section-wrapper}
    ├─ {div.section-head}
    │  ├─ {h2.section-title} 热门电视剧标题
    │  └─ {button.section-more-link} 更多入口占位
    └─ {div.section-body}
       ├─ {div.section-grid}
       │  ├─ [if hasTVList]
       │  │  └─ {VideoCard} 循环渲染 tvList
       │  └─ [else]
       │     └─ {el-empty} 电视剧卡片分区空状态
       └─ {aside.section-aside}
          └─ {HotRanking} 渲染 tvRanking 或榜单空状态
  -->
  <section class="section-wrapper">
    <!-- 热门电视剧标题栏，保留和热门电影区一致的头部结构。 -->
    <div class="section-head">
      <h2 class="section-title">热门电视剧</h2>
      <button class="section-more-link" type="button">更多</button>
    </div>

    <!-- 热门电视剧主体，左侧卡片网格和右侧排行榜并排展示。 -->
    <div class="section-body">
      <!-- 有电视剧数据时渲染视频卡片网格。 -->
      <div v-if="hasTVList" class="section-grid">
        <div v-for="item in tvList" :key="item.id || item.title" class="card-cell">
          <VideoCard :video="item" />
        </div>
      </div>

      <!-- 没有电视剧数据时，电视剧卡片分区显示 Element UI 空状态。 -->
      <el-empty
        v-else
        class="section-empty"
        description="当前热门电视剧模块没有数据" />

      <!-- 右侧电视剧榜单，榜单组件内部会继续判断 ranking 是否为空。 -->
      <aside class="section-aside">
        <HotRanking title="电视剧排行榜" :items="ranking" />
      </aside>
    </div>
  </section>
</template>

<script>
// 通用视频卡片组件，渲染在热门电视剧左侧网格中。
import VideoCard from '../common/VideoCard.vue';

// 首页排行榜组件，渲染在热门电视剧右侧侧栏中。
import HotRanking from './HotRanking.vue';

/**
 * 首页热门电视剧区块。
 *
 * 组件定位：
 * - 只负责展示首页电视剧列表和电视剧排行榜
 * - 不请求数据，不保存数据，也不决定数据来源
 * - 字段结构继续沿用 当前版本 首页字段，视觉布局回归 参考布局 首页区块
 */
export default {
  name: 'HotTVSection',

  components: {
    // VideoCard 负责单张电视剧卡片的封面、标题和元信息。
    VideoCard,

    // HotRanking 负责右侧电视剧排行榜。
    HotRanking
  },

  props: {
    // tvList 驱动左侧热门电视剧卡片网格。
    // 渲染位置：`.section-grid-inner` 内部的 VideoCard 列表。
    tvList: {
      type: Array,
      required: true
    },

    // ranking 驱动右侧电视剧排行榜。
    // 渲染位置：`HotRanking :items="ranking"`。
    ranking: {
      type: Array,
      required: true
    }
  },

  computed: {
    /**
     * 左侧电视剧卡片区是否有数据。
     *
     * @returns {boolean} 有电视剧数据时返回 true。
     */
    hasTVList() {
      return this.tvList.length > 0;
    }
  }
};
</script>

<style scoped>
/*
  电视剧卡片分区空状态。
  对应 template 中 `{el-empty.section-empty}`，只在 tvList 为空时显示。
*/
.section-empty {
  /* 保持和四列卡片区接近的高度，避免只有榜单时左侧塌陷。 */
  min-height: 330px;

  /* 使用通用面板背景，让空状态看起来仍是一个内容分区。 */
  background: var(--surface-soft);

  /* 用虚线边框表达“这里是可填充内容区”。 */
  border: 1px dashed var(--border-color);
}
</style>
