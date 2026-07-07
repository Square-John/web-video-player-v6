<template>
  <!--
    HomeView 页面渲染树

    {div.home-view}
    ├─ {HomeCarousel}
    │  └─ 首页轮播模块，读取 banners；有数据时显示轮播，没有数据时显示轮播空状态
    ├─ {HotMovieSection}
    │  ├─ 读取 movies，渲染热门电影卡片区或电影卡片空状态
    │  └─ 读取 movieRanking，渲染电影榜单或电影榜单空状态
    └─ {HotTVSection}
       ├─ 读取 tvList，渲染热门电视剧卡片区或电视剧卡片空状态
       └─ 读取 tvRanking，渲染电视剧榜单或电视剧榜单空状态
  -->
  <!--
    首页页面。
    作用：组织首页轮播、热门电影、热门电视剧和榜单区域。
  -->
  <div class="home-view">
    <!-- 首页轮播区域，组件内部会根据 banners 是否有内容决定显示轮播或空状态。 -->
    <HomeCarousel :banners="banners" />

    <!-- 热门电影区域，电影卡片区和电影榜单区各自处理自己的空状态。 -->
    <HotMovieSection :movies="movies" :ranking="movieRanking" />

    <!-- 热门电视剧区域，电视剧卡片区和电视剧榜单区各自处理自己的空状态。 -->
    <HotTVSection :tv-list="tvList" :ranking="tvRanking" />
  </div>
</template>

<script>
// 首页轮播组件，负责渲染顶部重点内容区域。
import HomeCarousel from '../components/home/HomeCarousel.vue';

// 首页热门电影组件，负责渲染电影卡片区和电影榜单。
import HotMovieSection from '../components/home/HotMovieSection.vue';

// 首页热门电视剧组件，负责渲染电视剧卡片区和电视剧榜单。
import HotTVSection from '../components/home/HotTVSection.vue';

// 首页静态数据，记录首页五个可选模块的当前数据结构。
import { homePageData } from '../data/page-home.mock';

export default {
  // 组件名称用于在调试工具和报错信息中识别首页页面组件。
  name: 'HomeView',

  // 注册当前模板中使用的首页子组件。
  components: {
    // <HomeCarousel /> 对应首页顶部轮播区域。
    HomeCarousel,

    // <HotMovieSection /> 对应首页热门电影区域。
    HotMovieSection,

    // <HotTVSection /> 对应首页热门电视剧区域。
    HotTVSection
  },

  data() {
    return {
      // banners 驱动首页轮播模块。
      banners: this.asList(homePageData.banners),

      // movies 驱动首页热门电影卡片模块。
      movies: this.asList(homePageData.movies),

      // tvList 驱动首页热门电视剧卡片模块。
      tvList: this.asList(homePageData.tvList),

      // movieRanking 驱动首页电影榜单模块。
      movieRanking: this.asList(homePageData.movieRanking),

      // tvRanking 驱动首页电视剧榜单模块。
      tvRanking: this.asList(homePageData.tvRanking)
    };
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     *
     * @param {*} value 可能来自首页数据文件的任意模块值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      return Array.isArray(value) ? value : [];
    }
  }
};
</script>

<style scoped>
/*
  首页整体容器。
  对应 template 中的 `.home-view`，负责包裹首页全部内容区域。
*/
.home-view {
  /* 限制首页最大宽度，保证宽屏下内容不会过度拉伸。 */
  max-width: 1180px;

  /* 让首页内容在主体区域中水平居中。 */
  width: 100%;

  /* 给首页上下留出空间，避免内容贴近导航栏和页脚。 */
  padding: 36px 32px 48px;

  /* 让 padding 计入宽度，避免宽度计算导致横向溢出。 */
  box-sizing: border-box;
}
</style>
