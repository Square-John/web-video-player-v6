<template>
  <!--
    App 组件渲染树

    {div.app-container} [class player-layout 由 isPlayerPage 控制]
    ├─ {AppNavbar}
    │  └─ 页面顶部导航栏，显示主导航入口、搜索框和用户状态区；点击入口会切换 currentPage
    ├─ {main.main-content} [class player-main-content 由 isPlayerPage 控制]
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
  <div :class="['app-container', { 'player-layout': isPlayerPage }]">
    <!-- 顶部导航栏，固定放在页面最上方，展示主导航、搜索框和用户状态区。 -->
    <AppNavbar :active-page="currentPage" @change-page="changePage" />

    <!-- 主体内容区，根据 currentPage 渲染当前页面。 -->
    <main :class="['main-content', { 'player-main-content': isPlayerPage }]">
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

  computed: {
    // isPlayerPage 控制播放页是否切换成更适合播放器铺开的外壳布局。
    isPlayerPage() {
      return this.currentPage === 'player';
    }
  },

  methods: {
    /**
     * 切换当前页面。
     *
     * @param {string} pageName 顶部导航传入的页面名称。
     * @returns {void} 只修改 currentPage，不返回业务数据。
     */
    changePage(pageName) {
      // 当前版本已接入首页、电影页、电视剧页、搜索页、详情页、播放页、个人中心页和设置页。
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
  应用最外层容器。
  对应 template 中的 `.app-container`，负责纵向组织顶部导航、主体内容和底部页脚。
*/
.app-container {
  /* 让应用至少占满浏览器一屏，内容较少时页脚也能自然落在底部。 */
  min-height: 100vh;

  /* 使用 flex 管理三段式页面外壳，主体区可以自动吃掉剩余高度。 */
  display: flex;

  /* 主轴改成纵向，让导航、主体、页脚从上到下排列。 */
  flex-direction: column;

  /* 继承 theme.css 中 body 的主题背景，不在根组件里重复写背景色。 */
  background: transparent;
}

/*
  播放页外壳。
  对应 template 中 `player-layout` 条件类，当前页面为播放页时启用。
*/
.app-container.player-layout {
  /* 播放页需要把播放器控制在一屏内，所以外层固定为视口高度。 */
  height: 100vh;

  /* 播放页外层不滚动，后续播放器内部或侧栏自己处理滚动。 */
  overflow: hidden;
}

/*
  主体内容区。
  对应 template 中的 `.main-content`，位于顶部导航和底部页脚之间。
*/
.main-content {
  /* 让主体区域自动占据导航和页脚之外的剩余空间。 */
  flex: 1;

  /* 普通页面使用自然文档流，让各个页面组件自己控制内部布局。 */
  display: block;

  /* 给普通页面提供和主题层匹配的上下留白，页面自身再负责内容宽度。 */
  padding: 20px 24px 28px;
}

/*
  播放页主体内容区。
  对应 template 中 `player-main-content` 条件类，当前页面为播放页时启用。
*/
.main-content.player-main-content {
  /* 播放页主体要铺满剩余空间，方便后续播放器区域占满可用高度。 */
  display: flex;

  /* 播放页不使用普通页面内边距，避免播放器区域被额外挤压。 */
  padding: 0;

  /* 允许内部 flex 子元素正确收缩，避免播放器或侧栏撑出视口。 */
  min-height: 0;

  /* 播放页外层隐藏溢出，内部组件再决定是否滚动。 */
  overflow: hidden;
}

/*
  播放页主体直接子元素。
  对应 PlayerView 这种被 main 直接渲染的页面组件。
*/
.main-content.player-main-content > * {
  /* 播放页组件继续吃满 main 区域，避免播放器容器高度塌陷。 */
  flex: 1 1 auto;

  /* 允许子元素在横向和纵向都正确压缩。 */
  min-width: 0;
  min-height: 0;
}
</style>
