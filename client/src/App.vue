<template>
  <!--
    App 组件渲染树

    [DEFAULT] ele(div.app-container)
    │  - condition:
    │      默认渲染。
    │      根容器根据当前路由元信息是否声明播放器布局追加 player-layout 类。
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
    ├─ [IF backend checking/unavailable] ele(BackendAvailabilityBanner)
    │  - condition:
    │      后端基础设施状态为 checking 或 unavailable 时由组件内部显示。
    │      idle 和 available 不渲染可见状态栏。
    │  - type:
    │      自定义组件
    │      相对位置: ./components/common/BackendAvailabilityBanner.vue
    │  - description:
    │      全站唯一后端基础设施状态栏。
    │      位于导航下方和路由主体上方，不复用 Provider 状态。
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
    │  ├─ [DEFAULT] com(PlayerView)
    │  │  - condition:
    │  │      应用生命周期内始终挂载；播放路由显示，普通路由只隐藏根元素。
    │  │  - type:
    │  │      自定义页面组件
    │  │      相对位置: ./views/PlayerView.vue
    │  │  - description:
    │  │      常驻播放宿主；普通路由切换不移除媒体 DOM、不暂停或重建播放器。
    │  │  - params: v-show=isPlayerPage，只控制可见性，不控制实例生命周期。
    │  │  - events: 无
    │  └─ [IF !isPlayerPage] com(keep-alive > router-view)
    │     - condition:
    │         当前路由不是播放入口或严格播放地址时渲染。
    │         vue-router 根据当前 URL 自动选择普通页面组件。
    │     - type:
    │         第三方库内置组件
    │         来源: vue-router
    │     - description:
    │         普通路由缓存出口；浏览器刷新时由页面生命周期按当前 URL 重新请求。
    │     - params: routeCacheKey，当前一级导航归属身份。
    │     - events: 无
    │
    ├─ [DEFAULT] ele(SourceChallengeDialog)
    │  - condition: 根组件始终挂载，组件内部根据全局活动挑战控制弹窗显示。
    │  - type: 自定义组件，相对位置 ./components/source/SourceChallengeDialog.vue。
    │  - description: 统一承载 Provider 人工输入，不随路由切换销毁。
    │  - params: 无。
    │  - events: 无。
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
    <AppNavbar @close-player-context="handleClosePlayerContext" />

    <!-- 全站唯一后端基础设施状态栏，组件内部只在 checking/unavailable 时显示。 -->
    <BackendAvailabilityBanner />

    <!-- 主体内容区，根据当前 URL 命中的路由渲染对应页面组件。 -->
    <main :class="['main-content', { 'player-main-content': isPlayerPage }]">
      <!--
        [DEFAULT] com(PlayerView)
        - condition: 应用生命周期内始终挂载；isPlayerPage 只切换根元素可见性。
        - type: 自定义页面组件，相对位置 ./views/PlayerView.vue。
        - description: 保持唯一 xgplayer 媒体 DOM 和实时 currentTime，不让普通路由切换触发播放器停用。
        - params: v-show=isPlayerPage；true 展示完整播放页，false 隐藏但继续媒体会话。
        - events: 无。
      -->
      <PlayerView
        ref="playerView"
        v-show="isPlayerPage" />

      <!--
        [IF !isPlayerPage] com(keep-alive > router-view)
        - condition: 非播放路由时渲染普通页面出口；播放路由由常驻 PlayerView 独占主体区。
        - type: Vue Router 内置 router-view，外层使用 Vue keep-alive。
        - description: 缓存普通一级页面实例，播放路由不会在此创建第二个 PlayerView。
        - params: routeCacheKey 只按普通一级导航归属区分缓存。
        - events: 无。
      -->
      <keep-alive>
        <router-view v-if="!isPlayerPage" :key="routeCacheKey" />
      </keep-alive>
    </main>

    <!--
      [DEFAULT] ele(SourceChallengeDialog)
      - condition: 应用根组件始终挂载；内部订阅决定是否显示。
      - type: 自定义组件，相对位置 ./components/source/SourceChallengeDialog.vue。
      - description: 让任意路由上的 Provider 挑战使用同一交互队列。
      - params: 无。
      - events: 无。
    -->
    <SourceChallengeDialog />

    <!-- 底部页脚，固定放在页面最下方，展示基础说明信息。 -->
    <AppFooter />
  </div>
</template>

<script>
/*
  App.vue 模块说明

  - 文件职责:
      组合应用导航、路由出口、全局挑战交互和页脚。
      只负责根级布局与播放页外壳派生，不保存内容或数据源状态。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      AppNavbar: 自定义组件，渲染应用顶部导航栏。
      BackendAvailabilityBanner: 自定义组件，渲染全站唯一后端基础设施状态。
      AppFooter: 自定义组件，渲染应用底部页脚。
      SourceChallengeDialog: 自定义组件，渲染应用唯一人工挑战交互。
      PlayerView: 自定义页面组件，作为应用生命周期内唯一常驻播放宿主。
      navigationContextService exports: 自定义内存服务，提供关闭播放后的详情或固定页面回退地址。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      App: Vue 根组件配置，由 main.js 创建的唯一根实例渲染。
*/

// 导入来源: ./components/layout/AppNavbar.vue。
// 导入内容: AppNavbar 顶部导航组件。
// 文件作用: 渲染应用品牌、路由入口和当前路由高亮。
import AppNavbar from './components/layout/AppNavbar.vue';

// 导入来源: ./components/common/BackendAvailabilityBanner.vue。
// 导入内容: BackendAvailabilityBanner 后端基础设施状态组件。
// 文件作用: 在导航下方和路由主体上方渲染全站唯一 checking/unavailable 状态。
import BackendAvailabilityBanner from './components/common/BackendAvailabilityBanner.vue';

// 导入来源: ./components/layout/AppFooter.vue。
// 导入内容: AppFooter 底部页脚组件。
// 文件作用: 渲染应用基础说明和版本信息。
import AppFooter from './components/layout/AppFooter.vue';

// 导入来源: ./components/source/SourceChallengeDialog.vue。
// 导入内容: SourceChallengeDialog 根级挑战组件。
// 文件作用: 跨路由持续订阅唯一协调器并显示人工输入弹窗。
import SourceChallengeDialog from './components/source/SourceChallengeDialog.vue';

// 导入来源: ./views/PlayerView.vue。
// 导入内容: PlayerView 常驻播放页面。
// 文件作用: 在普通 router-view 外持有唯一 xgplayer 实例，普通路由切换只隐藏界面而不停止媒体。
import PlayerView from './views/PlayerView.vue';

import {
  // 导入来源: ./services/navigationContextService.js；导入内容: NAVIGATION_CONTEXT_KEY；文件作用: 确认 App 收到的是正在播放上下文关闭命令。
  NAVIGATION_CONTEXT_KEY,
  // 导入来源: ./services/navigationContextService.js；导入内容: resolveNavigationFallback；文件作用: 在播放器释放成功后解析详情或固定页面回退。
  resolveNavigationFallback
} from './services/navigationContextService.js';

export default {
  // 组件名称，方便 Vue Devtools 或报错信息中识别当前根组件。
  name: 'App',

  // 注册当前模板中使用的布局组件。
  components: {
    // <AppNavbar /> 对应顶部导航区域。
    AppNavbar,

    // <BackendAvailabilityBanner /> 对应导航下方的全局后端基础设施状态。
    BackendAvailabilityBanner,

    // <AppFooter /> 对应底部页脚区域。
    AppFooter,

    // <SourceChallengeDialog /> 对应应用级人工验证弹窗。
    SourceChallengeDialog,

    // <PlayerView /> 对应应用级常驻播放宿主，不由普通 router-view 重复创建。
    PlayerView
  },

  computed: {
    /**
     * 判断当前路由是否需要播放器专用根外壳。
     * 纯函数: 只读取 vue-router 注入的当前路由元信息，不导航或修改布局状态。
     * 成功路径: meta.playerLayout 为 true 时返回 true，普通路由返回 false。
     *
     * @returns {boolean} true 启用一屏播放器外壳，false 使用普通页面文档流。
     */
    isPlayerPage() {
      // 返回值类型: boolean；true 启用播放器一屏外壳，false 保留普通页面自然文档流。
      return Boolean(this.$route.meta && this.$route.meta.playerLayout);
    },

    /**
     * 派生根路由 KeepAlive 的缓存身份。
     * 纯函数: 只读取当前路由 meta/name，不修改 Router 或页面实例。
     * 成功路径: 严格详情、播放和设置上下文路由使用 topNavName 归并到对应一级入口。
     * 失败路径: 未命名路由回退 home，保证缓存 key 始终是稳定字符串。
     *
     * @returns {string} 根路由组件缓存身份。
     */
    routeCacheKey() {
      // 类型: string；作用: 让严格内容路由和对应一级页面共享一个稳定缓存槽位。
      const topNavName = this.$route.meta && this.$route.meta.topNavName;
      return topNavName || this.$route.name || 'home';
    }
  },

  methods: {
    /**
     * 处理导航栏发出的正在播放关闭命令。
     * 副作用: 先等待常驻 PlayerView 完成进度封存和媒体释放，再在关闭当前播放页时导航到详情或最近固定页面。
     * 成功路径: 非当前播放页只关闭后台播放器；当前播放页在资源释放成功后回退。
     * 失败路径: 播放器引用或关闭事务失败时显示安全错误并保持播放上下文，不伪报关闭成功。
     *
     * @param {object} contextItem AppNavbar 当前播放上下文导航项。
     * @returns {Promise<void>} 关闭和可选路由回退收敛后结束。
     */
    async handleClosePlayerContext(contextItem) {
      // 条件分支: 事件不是正式 player 上下文时进入。
      // 执行内容: 忽略未知导航事件，不调用播放器或 Router。
      if (contextItem?.key !== NAVIGATION_CONTEXT_KEY.player) {
        return;
      }

      // 类型: object|null；作用: 读取 App 生命周期内唯一常驻 PlayerView，不创建第二媒体宿主。
      const playerView = this.$refs.playerView || null;
      // 条件分支: 常驻宿主缺失或没有公开关闭端口时进入。
      // 执行内容: 报告稳定错误并保持上下文，避免直接导航后旧媒体继续播放。
      if (!playerView || typeof playerView.closePlaybackContext !== 'function') {
        this.$message.error('播放器关闭入口不可用，请稍后重试');
        return;
      }

      // 类型: boolean；作用: 关闭命令开始时记录用户是否正在查看播放页，后台关闭不能改变当前普通路由。
      const shouldNavigateAfterClose = this.isPlayerPage;
      // 类型: string；作用: 在播放上下文移除前解析对应详情或最近固定页面回退地址。
      const fallbackFullPath = resolveNavigationFallback(NAVIGATION_CONTEXT_KEY.player);

      try {
        // 资源屏障: PlayerView 完成进度、播放器、候选、探测和 currentPlaying 清理后才能离开当前播放页。
        await playerView.closePlaybackContext();
        // 条件分支: 用户关闭时正在查看播放页时进入。
        // 执行内容: 跳转到反向详情或最近固定页面；后台关闭保持当前普通路由。
        if (shouldNavigateAfterClose) {
          await this.$router.push(fallbackFullPath).catch((error) => {
            // 条件分支: 目标已经是当前路由时进入。
            // 执行内容: 把 Vue Router 重复导航视为幂等关闭完成。
            if (error && error.name === 'NavigationDuplicated') return undefined;
            throw error;
          });
        }
      } catch {
        // 失败处理: 不清理导航上下文或强行跳转，让用户可以重试并保留真实资源状态。
        this.$message.error('关闭当前播放失败，请稍后重试');
      }
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
  /* 类型: length；作用: 宽屏固定导航第一行高度，数据源下拉以此定位。 */
  --app-navbar-primary-row-height: 64px;

  /* 类型: length；作用: 宽屏没有第二行，保持为零。 */
  --app-navbar-secondary-row-height: 0px;

  /* 类型: length；作用: 固定导航总高度，导航组件、设置抽屉与页面顶部占位共用。 */
  --app-navbar-height: calc(var(--app-navbar-primary-row-height) + var(--app-navbar-secondary-row-height));

  /* 类型: integer；作用: 固定导航高于普通页面和播放器内容，但低于需要置顶的全局模态层。 */
  --app-navbar-z-index: 1000;

  /* 让应用至少占满浏览器一屏，内容较少时页脚也能自然落在底部。 */
  min-height: 100vh;

  /* 使用 flex 管理三段式页面外壳，主体区可以自动吃掉剩余高度。 */
  display: flex;

  /* 主轴改成纵向，让导航、主体、页脚从上到下排列。 */
  flex-direction: column;

  /* 为固定导航统一预留总高度，所有路由内容都从导航下方开始。 */
  padding-top: var(--app-navbar-height);

  /* 把固定导航占位纳入视口高度，播放器一屏布局不会额外增加总高度。 */
  box-sizing: border-box;

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
  断点: 小于 1200px，对应平板和移动端的主导航折叠结构。
  影响范围: 应用根外壳共享导航高度令牌。
  布局变化: 使用 1199.98px 上限覆盖小数 CSS 像素，启用两行导航总高度；标准桌面继续使用单行导航。
*/
@media (max-width: 1199.98px) {
  .app-container {
    /* 类型: length；作用: 移动和平板第一行品牌、数据源、搜索与用户入口高度。 */
    --app-navbar-primary-row-height: 56px;

    /* 类型: length；作用: 移动和平板第二行菜单按钮与优先导航条高度。 */
    --app-navbar-secondary-row-height: 48px;
  }
}

/*
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
