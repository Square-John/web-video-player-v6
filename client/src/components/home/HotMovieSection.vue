<template>
  <!--
    HotMovieSection 首页热门电影区块渲染树

    {section.section-wrapper}
    ├─ {div.section-head}
    │  ├─ {h2.section-title} 热门电影标题
    │  └─ {button.section-more-link} 更多入口占位
    └─ {div.section-body}
       ├─ {div.section-grid}
       │  ├─ [if hasMovies]
       │  │  └─ {VideoCard} 循环渲染 movies
       │  └─ [else]
       │     └─ {el-empty} 电影卡片分区空状态
       └─ {aside.section-aside}
          └─ {HotRanking} 渲染 movieRanking 或榜单空状态
  -->
  <section class="section-wrapper">
    <!--
      热门电影标题栏。
      渲染位置：电影区块顶部。
      页面作用：标识当前区块内容，并保留后续跳转电影页的“更多”入口位置。
    -->
    <div class="section-head">
      <h2 class="section-title">热门电影</h2>
      <button class="section-more-link" type="button">更多</button>
    </div>

    <!--
      热门电影主体。
      左侧卡片网格读取 movies，右侧排行榜读取 ranking。
      两侧都独立处理空状态，保证局部无数据时页面结构不乱。
    -->
    <div class="section-body">
      <!-- 有电影数据时渲染视频卡片网格。 -->
      <div v-if="hasMovies" class="section-grid">
        <div v-for="movie in movies" :key="movie.id || movie.title" class="card-cell">
          <VideoCard :video="movie" />
        </div>
      </div>

      <!-- 没有电影数据时，电影卡片分区显示 Element UI 空状态。 -->
      <el-empty
        v-else
        class="section-empty"
        description="当前热门电影模块没有数据" />

      <!-- 右侧电影榜单，榜单组件内部会继续判断 ranking 是否为空。 -->
      <aside class="section-aside">
        <HotRanking title="电影排行榜" :items="ranking" />
      </aside>
    </div>
  </section>
</template>

<script>
// 通用视频卡片组件，渲染在热门电影左侧网格中。
import VideoCard from '../common/VideoCard.vue';

// 首页排行榜组件，渲染在热门电影右侧侧栏中。
import HotRanking from './HotRanking.vue';

/**
 * 首页热门电影区块。
 *
 * 组件定位：
 * - 只负责展示首页电影列表和电影排行榜
 * - 不请求数据，不保存数据，也不决定数据来源
 * - 字段结构继续沿用 当前版本 首页字段，视觉布局回归 参考布局 首页区块
 */
export default {
  name: 'HotMovieSection',

  components: {
    // VideoCard 负责单张电影卡片的封面、标题和元信息。
    VideoCard,

    // HotRanking 负责右侧电影排行榜。
    HotRanking
  },

  props: {
    // movies 驱动左侧热门电影卡片网格。
    // 渲染位置：`.section-grid-inner` 内部的 VideoCard 列表。
    movies: {
      type: Array,
      required: true
    },

    // ranking 驱动右侧电影排行榜。
    // 渲染位置：`HotRanking :items="ranking"`。
    ranking: {
      type: Array,
      required: true
    }
  },

  computed: {
    /**
     * 左侧电影卡片区是否有数据。
     *
     * @returns {boolean} 有电影数据时返回 true。
     */
    hasMovies() {
      return this.movies.length > 0;
    }
  }
};
</script>

<style scoped>
/*
  电影卡片分区空状态。
  对应 template 中 `{el-empty.section-empty}`，只在 movies 为空时显示。
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
