<template>
  <!--
    App 组件渲染树

    [DEFAULT] ele(div.app-container)
    │  - condition:
    │      默认渲染。
    │      根容器根据当前路由是否为播放页追加 player-layout 类。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      应用根容器。
    │      负责承载顶部导航、路由主体内容和底部页脚。
    │  - params:
    │      -- isPlayerPage：当前路由是否为播放页，用于切换播放器专用外壳。
    │  - events: 无
    │
    ├─ [DEFAULT] ele(AppNavbar)
    │  - condition:
    │      默认渲染。
    │      顶部导航由应用外壳统一挂载。
    │  - type:
    │      自定义组件
    │      相对位置: ./components/layout/AppNavbar.vue
    │  - description:
    │      顶部导航组件。
    │      通过 vue-router 完成页面跳转和当前路由高亮。
    │  - params: 无
    │  - events: 无
    │
    ├─ [DEFAULT] ele(main.main-content)
    │  │  - condition:
    │  │      默认渲染。
    │  │      主体区域根据当前路由是否为播放页追加 player-main-content 类。
    │  │  - type:
    │  │      原生标签
    │  │      标签名称: main
    │  │  - description:
    │  │      路由主体容器。
    │  │      负责承载当前 URL 命中的页面组件。
    │  │  - params:
    │  │      -- isPlayerPage：当前路由是否为播放页，用于切换主体区布局。
    │  │  - events: 无
    │  │
    │  └─ [DEFAULT] ele(router-view)
    │     - condition:
    │         默认渲染。
    │         vue-router 根据当前 URL 自动选择页面组件。
    │     - type:
    │         第三方库内置组件
    │         来源: vue-router
    │     - description:
    │         路由出口。
    │         渲染首页、电影、电视剧、搜索、详情、播放、个人中心和设置等页面。
    │     - params: 无
    │     - events: 无
    │
    └─ [DEFAULT] ele(AppFooter)
       - condition:
           默认渲染。
           底部页脚由应用外壳统一挂载。
       - type:
           自定义组件
           相对位置: ./components/layout/AppFooter.vue
       - description:
           页面底部组件。
           展示基础说明和版本信息。
       - params: 无
       - events: 无
  -->
  <!--
    应用根页面。
    作用：把顶部导航、主体内容区和底部页脚组合成完整页面外壳。
  -->
  <div :class="['app-container', { 'player-layout': isPlayerPage }]">
    <!-- 顶部导航栏，固定放在页面最上方，并通过 vue-router 处理导航跳转和激活态。 -->
    <AppNavbar />

    <!-- 主体内容区，根据当前 URL 命中的路由渲染对应页面组件。 -->
    <main :class="['main-content', { 'player-main-content': isPlayerPage }]">
      <!-- 路由出口，具体页面组件统一由 client/src/router/index.js 中的路由表决定。 -->
      <router-view />
    </main>

    <!-- 底部页脚，固定放在页面最下方，展示基础说明信息。 -->
    <AppFooter />
  </div>
</template>

<script>
/*
  App.vue 模块说明

  - 文件职责:
      组合全站顶部导航、路由页面出口和底部页脚。
      根据当前路由派生播放页专用外壳，不保存页面内容状态。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      AppNavbar: 自定义组件，渲染应用顶部导航栏。
      AppFooter: 自定义组件，渲染应用底部页脚。

  - 模块级常量:
      无

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      App: Vue 根组件配置，由 main.js 创建的根实例渲染。
*/

// 导入来源: ./components/layout/AppNavbar.vue。
// 导入内容: AppNavbar 顶部导航组件。
// 文件作用: 在根外壳顶部渲染品牌、路由和搜索入口。
import AppNavbar from './components/layout/AppNavbar.vue';

// 导入来源: ./components/layout/AppFooter.vue。
// 导入内容: AppFooter 底部页脚组件。
// 文件作用: 在普通页面外壳底部渲染项目说明。
import AppFooter from './components/layout/AppFooter.vue';

export default {
  // 组件名称，方便 Vue Devtools 或报错信息中识别当前根组件。
  name: 'App',

  // 注册当前模板中使用的布局组件。
  components: {
    // <AppNavbar /> 对应顶部导航区域。
    AppNavbar,

    // <AppFooter /> 对应底部页脚区域。
    AppFooter
  },

  computed: {
    /**
     * 判断当前路由是否使用播放页专用根外壳。
     * 纯函数: 只读取 vue-router 注入的当前路由名称，不发起导航或修改布局状态。
     *
     * @returns {boolean} true 表示启用播放页铺开布局，false 表示使用普通页面文档流。
     */
    isPlayerPage() {
      // 返回值类型: boolean。
      // 作用: 把 player 路由名称转成根容器的专用布局开关。
      return this.$route.name === 'player';
    }
  }
};
</script>

<style scoped>
/*
  作用容器: `.app-container`。
  样式作用:
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
  作用容器: `.app-container.player-layout`。
  样式作用:
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
  作用容器: `.main-content`。
  样式作用:
  主体内容区。
  对应 template 中的 `.main-content`，位于顶部导航和底部页脚之间。
  普通页面只在这里控制上下节奏，左右内容宽度统一交给 `.theme-page`。
*/
.main-content {
  /* 让主体区域自动占据导航和页脚之外的剩余空间。 */
  flex: 1;

  /* 让主体区域横向铺满视口宽度，避免页面内容容器基于带内边距的父级重复计算留白。 */
  width: 100%;

  /* 普通页面使用自然文档流，让各个页面组件自己控制内部布局。 */
  display: block;

  /* 给普通页面提供上下留白；左右留白交给 `.theme-page`，保证内容区两侧间距对称。 */
  padding: 20px 0 28px;

  /* 把主体区的上下内边距纳入宽度计算，防止后续新增横向边框或内边距时撑出视口。 */
  box-sizing: border-box;
}

/*
  作用容器: `.main-content.player-main-content`。
  样式作用:
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
  作用容器: `.main-content.player-main-content > *`。
  样式作用:
  播放页主体直接子元素。
  对应 PlayerView 这种被 main 直接渲染的页面组件。
*/
.main-content.player-main-content > * {
  /* 播放页组件继续吃满 main 区域，避免播放器容器高度塌陷。 */
  flex: 1 1 auto;

  /* 允许子元素在横向和纵向都正确压缩。 */
  min-width: 0;
  /* 允许播放器页面子组件在 flex 轨道内收缩，避免内部内容撑破一屏外壳。 */
  min-height: 0;
}
</style>
