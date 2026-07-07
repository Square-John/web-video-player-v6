<template>
  <!--
    HomeView 页面渲染树

    {div.theme-page.home-page} [v-loading="loading"]
    ├─ [if hasHomeContent] 首页内容分支
    │  └─ 首页主体内容区
    │     - 当前首页至少有一个模块存在数据时进入
    │     - 这里保留 当前版本 已确定的字段结构，只把展示方式回归到 参考布局 首页布局
    │
    │     ├─ {HomeCarousel}
    │     │  └─ 首页通栏轮播模块
    │     │     - 读取 `banners`
    │     │     - 有数据时渲染 参考布局 风格横幅轮播
    │     │     - 没数据时渲染 Element UI 空状态
    │     │
    │     ├─ {HotMovieSection}
    │     │  └─ 首页热门电影模块
    │     │     - 读取 `movies` 和 `movieRanking`
    │     │     - 卡片区和榜单区各自处理空状态
    │     │
    │     └─ {HotTVSection}
    │        └─ 首页热门电视剧模块
    │           - 读取 `tvList` 和 `tvRanking`
    │           - 卡片区和榜单区各自处理空状态
    │
    └─ [else] 整页空状态分支
       └─ {el-empty}
          - 当首页五个模块全部没有数据时显示
          - 用于承接“当前源没有首页内容”的情况，避免页面只剩空白
  -->
  <!--
    首页页面。
    作用：组织首页轮播、热门电影、热门电视剧和榜单区域，并保持 参考布局 的首页视觉结构。
  -->
  <div class="theme-page home-page" v-loading="loading">
    <!--
      首页内容分支。
      渲染条件：`hasHomeContent` 为 true，也就是首页五个模块至少有一个模块有数据。
      页面作用：进入该分支后，三个首页子模块都会挂载，再由子模块自己显示真实内容或分区空状态。
    -->
    <template v-if="hasHomeContent">
      <!-- 首页通栏轮播区域，组件内部根据 banners 是否为空决定显示轮播或空状态。 -->
      <HomeCarousel :banners="banners" />

      <!-- 热门电影区域，左侧电影卡片区和右侧电影榜单区各自处理自己的空状态。 -->
      <HotMovieSection :movies="movies" :ranking="movieRanking" />

      <!-- 热门电视剧区域，左侧电视剧卡片区和右侧电视剧榜单区各自处理自己的空状态。 -->
      <HotTVSection :tv-list="tvList" :ranking="tvRanking" />
    </template>

    <!--
      首页整页空状态。
      渲染条件：五个首页模块全部为空。
      页面作用：说明当前首页没有任何可展示内容，而不是让用户看到一片空白。
    -->
    <el-empty
      v-else
      class="home-empty"
      description="暂无可展示的首页内容" />
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
      // loading 控制首页根容器上的 Element UI 加载遮罩。
      // 当前静态阶段固定为 false；后续接真实源脚本时，请求首页数据期间会改成 true。
      loading: false,

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

  computed: {
    /**
     * 首页是否至少有一个模块存在数据。
     *
     * 页面作用：
     * - true：渲染首页轮播、电影区和电视剧区，再由各分区自己处理局部空状态
     * - false：渲染整页空状态
     *
     * @returns {boolean} 首页是否有任意模块可展示
     */
    hasHomeContent() {
      // 五个数组任意一个非空，就说明首页有内容入口。
      return [
        this.banners,
        this.movies,
        this.tvList,
        this.movieRanking,
        this.tvRanking
      ].some(list => list.length > 0);
    }
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
  对应 template 中的 `.home-page`，负责包裹首页全部内容区域。
*/
.home-page {
  /* 首页已经由全局 `.theme-page` 控制宽度，这里只补顶部细微留白。 */
  padding-top: 4px;
}

/*
  首页整页空状态。
  对应 template 中的 `{el-empty.home-empty}`，只在五个首页模块全部为空时出现。
*/
.home-empty {
  /* 给空状态一个接近首屏的高度，让提示处在页面视觉中心附近。 */
  min-height: 420px;

  /* 使用通用面板样式，把空状态和页面背景区分开。 */
  background: var(--surface-soft);

  /* 给空状态外框增加细边线，保持和首页卡片区统一。 */
  border: 1px solid var(--border-color);

  /* 当前项目卡片风格偏直角，这里保持 0，和 参考布局 视觉一致。 */
  border-radius: 0;
}
</style>
