<template>
  <!--
    App 组件渲染树

    {div.app}
    ├─ {AppNavbar}
    │  └─ 页面顶部导航栏，显示应用名称、版本标识和主导航入口；点击入口会切换 currentPage
    ├─ {main.app__main}
    │  ├─ [if currentPage === 'home']
    │  │  └─ {HomeView} 首页页面
    │  ├─ [else if currentPage === 'movie']
    │  │  └─ {MovieView} 电影页面
    │  ├─ [else if currentPage === 'tv']
    │  │  └─ {TVView} 电视剧页面
    │  ├─ [else if currentPage === 'search']
    │  │  └─ {SearchResultView} 搜索结果页面
    │  ├─ [else if currentPage === 'detail']
    │  │  └─ {DetailView} 详情页面
    │  ├─ [else if currentPage === 'player']
    │  │  └─ {PlayerView} 播放页面
    │  ├─ [else if currentPage === 'profile']
    │  │  └─ {ProfileView} 个人中心页面
    │  └─ [else if currentPage === 'settings']
    │     └─ {SettingsView} 设置页面
    └─ {AppFooter}
       └─ 页面底部页脚，显示基础说明和版本信息
  -->
  <!--
    应用根页面。
    作用：把顶部导航、主体内容区和底部页脚组合成完整页面外壳。
  -->
  <div class="app">
    <!-- 顶部导航栏，固定放在页面最上方，展示项目名称和基础入口。 -->
    <AppNavbar :active-page="currentPage" @change-page="changePage" />

    <!-- 主体内容区，根据 currentPage 渲染当前页面。 -->
    <main class="app__main">
      <!-- 首页页面组件，currentPage 为 home 时显示。 -->
      <HomeView v-if="currentPage === 'home'" />

      <!-- 电影页面组件，currentPage 为 movie 时显示。 -->
      <MovieView v-else-if="currentPage === 'movie'" />

      <!-- 电视剧页面组件，currentPage 为 tv 时显示。 -->
      <TVView v-else-if="currentPage === 'tv'" />

      <!-- 搜索结果页面组件，currentPage 为 search 时显示。 -->
      <SearchResultView v-else-if="currentPage === 'search'" />

      <!-- 详情页面组件，currentPage 为 detail 时显示。 -->
      <DetailView v-else-if="currentPage === 'detail'" />

      <!-- 播放页面组件，currentPage 为 player 时显示。 -->
      <PlayerView v-else-if="currentPage === 'player'" />

      <!-- 个人中心页面组件，currentPage 为 profile 时显示。 -->
      <ProfileView v-else-if="currentPage === 'profile'" />

      <!-- 设置页面组件，currentPage 为 settings 时显示。 -->
      <SettingsView v-else-if="currentPage === 'settings'" />
    </main>

    <!-- 底部页脚，固定放在页面最下方，展示基础说明信息。 -->
    <AppFooter />
  </div>
</template>

<script>
// 顶部导航组件，负责渲染应用最上方的品牌和导航入口。
import AppNavbar from './components/layout/AppNavbar.vue';

// 底部页脚组件，负责渲染应用最下方的辅助信息。
import AppFooter from './components/layout/AppFooter.vue';

// 首页页面组件，负责渲染当前主体区域内容。
import HomeView from './views/HomeView.vue';

// 电影页面组件，负责渲染电影目录静态布局。
import MovieView from './views/MovieView.vue';

// 电视剧页面组件，负责渲染电视剧目录静态布局。
import TVView from './views/TVView.vue';

// 搜索结果页面组件，负责渲染搜索输入、结果列表和分页静态布局。
import SearchResultView from './views/SearchResultView.vue';

// 详情页面组件，负责渲染视频详情、来源状态和分集列表。
import DetailView from './views/DetailView.vue';

// 播放页面组件，负责渲染播放器区域、播放状态和分集切换。
import PlayerView from './views/PlayerView.vue';

// 个人中心页面组件，负责渲染用户状态、播放历史、收藏列表和本地操作。
import ProfileView from './views/ProfileView.vue';

// 设置页面组件，负责渲染基础设置、数据源状态和本地操作。
import SettingsView from './views/SettingsView.vue';

export default {
  // 组件名称，方便 Vue Devtools 或报错信息中识别当前根组件。
  name: 'App',

  // 注册当前模板中使用的布局组件。
  components: {
    // <AppNavbar /> 对应顶部导航区域。
    AppNavbar,

    // <AppFooter /> 对应底部页脚区域。
    AppFooter,

    // <HomeView /> 对应主体内容区中的首页页面。
    HomeView,

    // <MovieView /> 对应主体内容区中的电影页面。
    MovieView,

    // <TVView /> 对应主体内容区中的电视剧页面。
    TVView,

    // <SearchResultView /> 对应主体内容区中的搜索结果页面。
    SearchResultView,

    // <DetailView /> 对应主体内容区中的详情页面。
    DetailView,

    // <PlayerView /> 对应主体内容区中的播放页面。
    PlayerView,

    // <ProfileView /> 对应主体内容区中的个人中心页面。
    ProfileView,

    // <SettingsView /> 对应主体内容区中的设置页面。
    SettingsView
  },

  data() {
    return {
      // currentPage 保存当前展示页面，会影响 main 区域渲染哪个页面组件。
      currentPage: 'home'
    };
  },

  methods: {
    /**
     * 切换当前页面。
     *
     * @param {string} pageName 顶部导航传入的页面名称。
     * @returns {void} 只修改 currentPage，不返回业务数据。
     */
    changePage(pageName) {
      // 页面入口包含首页、电影页、电视剧页、搜索页、详情页、播放页、个人中心页和设置页。
      const supportedPages = [
        'home',
        'movie',
        'tv',
        'search',
        'detail',
        'player',
        'profile',
        'settings'
      ];

      // 不支持的页面名称直接忽略，避免主体区域出现空白。
      if (!supportedPages.includes(pageName)) {
        return;
      }

      // 修改 currentPage 后，Vue 会自动重新渲染 main 区域。
      this.currentPage = pageName;
    }
  }
};
</script>

<style scoped>
/*
  应用根容器。
  对应 template 中的 `.app`，负责组织顶部、主体和底部三块区域。
*/
.app {
  /* 让应用至少占满整个浏览器高度，保证页脚可以自然落在底部。 */
  min-height: 100vh;

  /* 使用纵向 flex，让顶部、主体、底部按从上到下排列。 */
  display: flex;

  /* 指定主轴为垂直方向，形成典型页面外壳结构。 */
  flex-direction: column;

  /* 清掉浏览器默认外边距，让页面外壳贴合视口。 */
  margin: 0;

  /* 使用浅色页面背景，为主体内容提供干净底色。 */
  background: #f3f6fb;

  /* 使用系统常见无衬线字体，保证页面在不同系统中显示稳定。 */
  font-family: Arial, Helvetica, sans-serif;
}

/*
  主体内容区。
  对应 template 中的 `.app__main`，位于顶部导航和底部页脚之间。
*/
.app__main {
  /* 让主体区域自动占据剩余高度，使页脚保持在页面底部。 */
  flex: 1;

  /* 让首页组件从主体区域顶部开始自然排列。 */
  display: block;
}
</style>
