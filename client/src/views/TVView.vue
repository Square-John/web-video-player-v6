<template>
  <!--
    TVView 页面渲染树

    [DEFAULT] ele(div.theme-page.tv-page)
    │  - condition: 电视剧目录路由挂载时默认渲染。
    │  - type: 原生标签 div。
    │  - description: 承载标题、数据源切换、筛选、内容网格、分页和加载遮罩。
    │  - params: -- pageRequestState.loading：tv PageBucket 唯一事务加载状态。
    │  - events: 无
    ├─ [DEFAULT] ele(header.theme-page-header.page-hero)
    │  - condition: 默认渲染。
    │  - type: 原生标签 header。
    │  - description: 展示电视剧目录标题和浏览说明。
    │  - params: 无
    │  - events: 无
    ├─ [DEFAULT] ele(SourceSwitchTabs)
    │  - condition: 默认挂载，内部根据候选与错误决定可见性。
    │  - type: 自定义组件 ../components/source/SourceSwitchTabs.vue。
    │  - description: 展示 tv 候选并执行活动源切换。
    │  - params: -- pageKey：tv；-- ariaLabel：电视剧页数据源。
    │  - events: @source-switched -> handleSourceSwitched()。
    ├─ [IF PageRequestStatePanel.isVisible] ele(PageRequestStatePanel)
    │  - condition: tv 请求失败或阻塞加载时渲染。
    │  - type: 自定义组件 ../components/common/PageRequestStatePanel.vue。
    │  - description: 展示统一请求反馈并提交原位重试。
    │  - params: -- state：tv PageBucket 事务投影。
    │  - events: @retry -> retryCatalogPage()。
    ├─ [IF hasFilters] ele(CatalogFilterBar)
    │  - condition: 当前源返回至少一个电视剧筛选组时渲染。
    │  - type: 自定义组件 ../components/catalog/CatalogFilterBar.vue。
    │  - description: 渲染动态筛选组和重置入口。
    │  - params: -- filters：当前源筛选组；-- resetDisabled：是否仍为默认值。
    │  - events: @change-filter -> handleFilterChange；@reset-filters -> handleResetFilters。
    ├─ [IF shouldShowCatalogGrid] ele(CatalogGrid)
    │  - condition: 有可见内容或请求成功空结果时渲染，失败和阻塞加载不误报业务空态。
    │  - type: 自定义组件 ../components/catalog/CatalogGrid.vue。
    │  - description: 渲染当前电视剧页 ContentItem 列表。
    │  - params: -- items：catalogItems；-- emptyTitle/emptyText：电视剧空态说明。
    │  - events: 无
    └─ [IF shouldShowPagination] ele(CatalogPagination)
       - condition: 当前分页存在多页、上一页或下一页能力时渲染。
       - type: 自定义组件 ../components/catalog/CatalogPagination.vue。
       - description: 展示电视剧目录标准分页并提交目标页码。
       - params: -- pagination：tv 数据桶标准分页。
       - events: @change-page -> handlePageChange。
  -->
  <!--
    [DEFAULT] ele(div.theme-page.tv-page)
    - condition: 电视剧目录路由挂载时默认渲染。
    - type: 原生标签 div。
    - description: 组织电视剧目录全部区域并用 PageBucket 唯一事务显示统一请求遮罩。
    - params: -- pageRequestState.loading：首次加载、切源、筛选或分页请求状态。
    - events: 无
  -->
  <div class="theme-page tv-page" v-loading="pageRequestState.loading">
    <!--
      [DEFAULT] ele(header.theme-page-header.page-hero)
      - condition: 默认渲染。
      - type: 原生标签 header。
      - description: 展示电视剧目录标题和浏览说明，为后续筛选与结果建立上下文。
      - params: 无
      - events: 无
    -->
    <header class="theme-page-header page-hero">
      <div>
        <h1 class="theme-page-title">电视剧</h1>
        <p class="theme-page-desc">按类型、剧情、地区和年份浏览电视剧内容</p>
      </div>
    </header>

    <!--
      [DEFAULT] ele(SourceSwitchTabs)
      - condition: 默认挂载，组件无候选且无错误时自行隐藏。
      - type: 自定义组件，相对位置 ../components/source/SourceSwitchTabs.vue。
      - description: 展示 Runtime 电视剧候选并提交唯一活动源切换事务。
      - params: -- pageKey：固定为 tv；-- ariaLabel：电视剧页数据源区域名称。
      - events: @source-switched -> handleSourceSwitched()，恢复默认筛选并重载新源元数据与第一页。
    -->
    <SourceSwitchTabs
      page-key="tv"
      aria-label="电视剧页数据源"
      @source-switched="handleSourceSwitched"
    />

    <!--
      [IF PageRequestStatePanel.isVisible] ele(PageRequestStatePanel)
      - condition: 电视剧 PageBucket 请求失败，或首次加载尚无可见内容时渲染。
      - type: 自定义组件，相对位置 ../components/common/PageRequestStatePanel.vue。
      - description: 展示电视剧目录统一加载、错误和按当前 URL 原位重试入口。
      - params: -- state：tv 桶唯一事务投影；-- loadingText/errorTitle：电视剧目录文案。
      - events: @retry -> retryCatalogPage()，复用当前筛选和页码并补充筛选元数据。
    -->
    <PageRequestStatePanel
      :state="pageRequestState"
      loading-text="正在读取电视剧内容"
      error-title="电视剧内容请求失败"
      @retry="retryCatalogPage"
    />

    <!--
      [IF hasFilters] ele(CatalogFilterBar)
      - condition: 当前活动源的 tv 筛选桶至少包含一个筛选组时渲染。
      - type: 自定义组件 ../components/catalog/CatalogFilterBar.vue。
      - description: 按数据源元数据渲染剧情、地区、年份、状态、排序和重置入口。
      - params: -- filters：映射 selectedFilters 后的动态组；-- resetDisabled：当前是否为默认筛选。
      - events: @change-filter -> handleFilterChange；@reset-filters -> handleResetFilters。
    -->
    <CatalogFilterBar
      v-if="hasFilters"
      title="电视剧筛选"
      hint="按剧情、地区、年份、状态和排序缩小浏览范围"
      :filters="filters"
      :reset-disabled="isResetDisabled"
      @change-filter="handleFilterChange"
      @reset-filters="handleResetFilters" />

    <!--
      [IF shouldShowCatalogGrid] ele(CatalogGrid)
      - condition: 当前有可见电视剧，或最新请求成功返回空结果时渲染。
      - type: 自定义组件 ../components/catalog/CatalogGrid.vue。
      - description: 在筛选区下方渲染统一电视剧 ContentItem 卡片网格。
      - params: -- items：getBucketItems('tv')；-- emptyTitle/emptyText：电视剧目录空态说明。
      - events: 无
    -->
    <CatalogGrid
      v-if="shouldShowCatalogGrid"
      :items="catalogItems"
      empty-title="暂无电视剧内容"
      empty-text="当前筛选条件下没有可展示的电视剧。" />

    <!--
      [IF shouldShowPagination] ele(CatalogPagination)
      - condition: 标准分页对象表明存在多页、上一页或下一页时渲染。
      - type: 自定义组件 ../components/catalog/CatalogPagination.vue。
      - description: 展示当前页并允许请求目标页码。
      - params: -- pagination：getPagePagination('tv') 返回的标准对象。
      - events: @change-page -> handlePageChange。
    -->
    <CatalogPagination
      v-if="shouldShowPagination"
      :pagination="pagination"
      :disabled="pageRequestState.loading"
      @change-page="handlePageChange" />
  </div>
</template>

<script>
/*
  TVView.vue 模块说明

  - 文件职责:
      渲染电视剧目录页面的标题、数据源切换、筛选、卡片和分页结构。
      通过通用目录控制器消费 tv PageBucket 和动态筛选元数据，不保存第二份请求或路由状态。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      CatalogFilterBar: 自定义组件，渲染电视剧筛选组。
      CatalogGrid: 自定义组件，渲染统一电视剧卡片网格。
      CatalogPagination: 自定义组件，渲染标准分页。
      SourceSwitchTabs: 自定义组件，切换当前活动数据源。
      PageRequestStatePanel: 自定义组件，渲染加载、失败与重试反馈。
      createCatalogPageController: 自定义控制器工厂，提供目录 URL、筛选、分页、请求和 KeepAlive 协调。

  - 模块级常量:
      DEFAULT_TV_FILTER_SELECTION: Readonly<object>，电视剧目录默认筛选。
      TV_CATALOG_CONTROLLER: object，绑定 tv 页面键和路由的通用目录控制器。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      TVView: Vue component，电视剧目录路由页面。
*/

// 导入来源: ../components/catalog/CatalogFilterBar.vue；导入内容: CatalogFilterBar 自定义组件；文件作用: 渲染 Provider 提供的电视剧筛选组。
import CatalogFilterBar from '../components/catalog/CatalogFilterBar.vue';
// 导入来源: ../components/catalog/CatalogGrid.vue；导入内容: CatalogGrid 自定义组件；文件作用: 渲染当前 tv 数据桶卡片。
import CatalogGrid from '../components/catalog/CatalogGrid.vue';
// 导入来源: ../components/catalog/CatalogPagination.vue；导入内容: CatalogPagination 自定义组件；文件作用: 渲染 tv 标准分页。
import CatalogPagination from '../components/catalog/CatalogPagination.vue';
// 导入来源: ../components/source/SourceSwitchTabs.vue；导入内容: SourceSwitchTabs 自定义组件；文件作用: 切换活动源并通知控制器重载目录。
import SourceSwitchTabs from '../components/source/SourceSwitchTabs.vue';
// 导入来源: ../components/common/PageRequestStatePanel.vue；导入内容: PageRequestStatePanel 自定义组件；文件作用: 展示当前目录通用请求状态。
import PageRequestStatePanel from '../components/common/PageRequestStatePanel.vue';
// 导入来源: ../controllers/catalogPageController.js；导入内容: createCatalogPageController 自定义工厂；文件作用: 创建电影和电视剧共用的目录请求控制层。
import { createCatalogPageController } from '../controllers/catalogPageController.js';

// 类型: Readonly<object>。
// 作用: 定义电视剧目录全部筛选键的中性初值，URL 解析、切源和重置共用同一事实。
const DEFAULT_TV_FILTER_SELECTION = Object.freeze({
  // 类型: string；作用: all 表示不限制 ContentItem.genres 对应的电视剧类型。
  genre: 'all',
  // 类型: string；作用: all 表示不限制电视剧地区。
  area: 'all',
  // 类型: string；作用: all 表示不限制电视剧年份。
  year: 'all',
  // 类型: string；作用: all 表示不限制 Provider 声明的连载状态。
  status: 'all',
  // 类型: string；作用: latest 表示电视剧目录默认按最新内容排序。
  sort: 'latest'
});

// 类型: object。
// 作用: 把 tv 页面键、路由、默认筛选和失败文案注入通用控制器，页面不复制请求流程或分页容量。
const TV_CATALOG_CONTROLLER = createCatalogPageController({
  // 类型: string；作用: 指向 siteContentStore.pages.tv 和 siteFilterStore.pages.tv。
  pageKey: 'tv',
  // 类型: string；作用: 约束 KeepAlive 路由守卫和筛选/分页导航只处理 tv 路由。
  routeName: 'tv',
  // 类型: Readonly<object>；作用: 提供 URL 默认值、切源复位和重置筛选的唯一来源。
  defaultFilters: DEFAULT_TV_FILTER_SELECTION,
  // 类型: string；作用: 请求事务没有安全说明时展示可执行的通用电视剧失败提示。
  fallbackErrorMessage: '电视剧内容请求失败，请检查网络或数据源后重试。'
});

// 导出类型: default Vue component。
// 导出内容: TVView 电视剧目录页面。
// 外部调用方: router/routes.js 的 tv 动态路由加载器。
// 使用场景: 渲染电视剧目录，并由共用控制器驱动请求与 URL 状态。
export default {
  // 类型: string；作用: 供 Vue Devtools、KeepAlive 和错误堆栈识别电视剧页。
  name: 'TVView',

  // 类型: Array<object>；作用: 混入唯一目录控制器，获得通用 computed、watch、生命周期和 methods。
  mixins: [TV_CATALOG_CONTROLLER],

  // 类型: object；作用: 注册电视剧页模板使用的五个展示组件，业务状态仍由控制器和 Store 持有。
  components: {
    // 组件: CatalogFilterBar；作用: 渲染动态电视剧筛选组。
    CatalogFilterBar,
    // 组件: CatalogGrid；作用: 渲染 catalogItems 统一卡片列表。
    CatalogGrid,
    // 组件: CatalogPagination；作用: 渲染标准 pagination。
    CatalogPagination,
    // 组件: SourceSwitchTabs；作用: 派发活动源切换完成事件。
    SourceSwitchTabs,
    // 组件: PageRequestStatePanel；作用: 渲染 pageRequestState 及 retryCatalogPage 命令。
    PageRequestStatePanel
  }
};
</script>

<style scoped>
/*
  电视剧页整体容器。
  对应 template 中的 `.tv-page`，负责包裹电视剧页全部区域。
*/
.tv-page {
  /* 目录页不额外缩窄，直接复用全局 theme-page 的宽度规则。 */
  padding-top: 8px;
}

/*
  电视剧页标题区域。
  对应 template 中 `.page-hero`，渲染在筛选区和结果区之前。
*/
.page-hero {
  /* 目录页标题和筛选区之间保持 v4 一样的较大间距。 */
  margin-bottom: 24px;
}
</style>
