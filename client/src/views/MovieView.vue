<template>
  <!--
    MovieView 页面渲染树

    {div.theme-page.movie-page} [v-loading="loading"]
    ├─ {header.theme-page-header.page-hero}
    │  ├─ {h1.theme-page-title} 电影页标题
    │  └─ {p.theme-page-desc} 电影页说明
    ├─ [if hasFilters]
    │  └─ {CatalogFilterBar}
    │     - 读取 filters，渲染电影筛选区
    │     - filters 为空时本区域不渲染
    ├─ {CatalogGrid}
    │  ├─ [if movies.length > 0] 渲染电影卡片网格
    │  └─ [else] 渲染主体空状态
    └─ [if shouldShowPagination]
       └─ {CatalogPagination}
          - 读取 pagination，渲染底部分页
          - 没有分页或只有一页时不渲染
  -->
  <!--
    电影页。
    作用：组织电影目录标题、筛选栏、主体卡片网格和分页区域。
  -->
  <div class="theme-page movie-page" v-loading="loading">
    <!--
      页面头部。
      渲染位置：电影页最上方。
      页面作用：说明当前页面是电影目录，并给下方筛选和结果区建立上下文。
    -->
    <header class="theme-page-header page-hero">
      <div>
        <h1 class="theme-page-title">电影</h1>
        <p class="theme-page-desc">按类型、剧情、地区和年份浏览电影内容</p>
      </div>
    </header>

    <!--
      [DEFAULT] ele(SourceSwitchTabs)
      - condition:
          默认渲染。
          电影页标题区下方展示静态页面静态数据源 tab 区域。
      - type:
          自定义组件
          相对位置: ../components/source/SourceSwitchTabs.vue
      - description:
          电影页顶部数据源静态 tab。
          展示当前版本可用数据源，并高亮默认选中的模拟源1数据源。
      - params:
          -- sourceTabs：电影页可展示的数据源 tab 列表。
          -- activeSourceId：电影页默认高亮的数据源 id。
      - events: 无
    -->
    <SourceSwitchTabs
      :sources="sourceTabs"
      :active-source-id="activeSourceId"
      aria-label="电影页数据源"
    />

    <!--
      电影筛选区。
      渲染条件：`hasFilters` 为 true。
      使用数据：`filters`，最多展示类型、剧情、地区、年份、排序五组筛选。
    -->
    <CatalogFilterBar
      v-if="hasFilters"
      title="电影筛选"
      hint="按类型、剧情、地区、年份和排序缩小浏览范围"
      :filters="filters" />

    <!--
      电影主体展示区。
      渲染位置：筛选区下方。
      使用数据：`movies`。
      页面作用：有电影数据时显示卡片网格，没有电影数据时显示主体空状态。
    -->
    <CatalogGrid
      :items="movies"
      empty-title="暂无电影内容"
      empty-text="当前筛选条件下没有可展示的电影。" />

    <!--
      电影分页区。
      渲染条件：`shouldShowPagination` 为 true。
      页面作用：展示当前页、上一页和下一页状态。
    -->
    <CatalogPagination v-if="shouldShowPagination" :pagination="pagination" />
  </div>
</template>

<script>
// 目录筛选栏组件，负责渲染电影页顶部筛选区。
import CatalogFilterBar from '../components/catalog/CatalogFilterBar.vue';

// 目录网格组件，负责渲染电影页主体卡片区域。
import CatalogGrid from '../components/catalog/CatalogGrid.vue';

// 目录分页组件，负责渲染电影页底部分页状态。
import CatalogPagination from '../components/catalog/CatalogPagination.vue';

// 导入来源: ../components/source/SourceSwitchTabs.vue。
// 导入内容: SourceSwitchTabs 自定义组件。
// 文件作用: 用于在电影页标题下方渲染静态页面静态数据源 tab。
import SourceSwitchTabs from '../components/source/SourceSwitchTabs.vue';

// 电影页静态数据，记录筛选区、主体卡片区和分页区的当前数据结构。
import { moviePageData } from '../data/page-movie.mock';

// 导入来源: ../data/source-switch.mock。
// 导入内容: sourceSwitchData 顶部数据源静态数据。
// 文件作用: 给电影页 SourceSwitchTabs 提供数据源列表和默认高亮源。
import { sourceSwitchData } from '../data/source-switch.mock';

export default {
  // 组件名称用于在调试工具和报错信息中识别电影页。
  name: 'MovieView',

  // 注册电影页当前使用的目录组件。
  components: {
    // <CatalogFilterBar /> 对应电影页筛选区。
    CatalogFilterBar,

    // <CatalogGrid /> 对应电影页主体卡片区。
    CatalogGrid,

    // <CatalogPagination /> 对应电影页底部分页区。
    CatalogPagination,

    // <SourceSwitchTabs /> 对应电影页标题和筛选栏之间的数据源静态 tab 区域。
    SourceSwitchTabs
  },

  data() {
    return {
      // loading 控制电影页根容器上的 Element UI 加载遮罩。
      // 当前版本使用本地数据，所以默认 false；接入请求后由加载流程维护。
      loading: false,

      // sourceTabs 驱动电影页顶部数据源静态 tab；静态页面只展示，不触发真实切换。
      sourceTabs: this.asList(sourceSwitchData.sources),

      // activeSourceId 控制电影页顶部数据源 tab 的默认高亮项。
      activeSourceId: sourceSwitchData.activeSourceId,

      // filters 驱动电影页筛选区；数组为空时筛选区不渲染。
      filters: this.asList(moviePageData.filters),

      // movies 驱动电影主体卡片区；数组为空时主体区显示空状态。
      movies: this.asList(moviePageData.movies),

      // pagination 驱动电影页底部分页区；为 null 时分页区不渲染。
      pagination: this.asObjectOrNull(moviePageData.pagination)
    };
  },

  computed: {
    /**
     * 电影页是否需要显示筛选区。
     *
     * @returns {boolean} 有筛选组时返回 true。
     */
    hasFilters() {
      return this.filters.length > 0;
    },

    /**
     * 电影页是否存在分页对象。
     *
     * @returns {boolean} 存在分页对象时返回 true。
     */
    hasPagination() {
      return Boolean(this.pagination);
    },

    /**
     * 是否显示底部分页区。
     *
     * 页面规则：
     * - 没有分页对象时不显示
     * - 总页数只有 1 页，并且没有上一页和下一页时不显示
     *
     * @returns {boolean} 是否渲染 CatalogPagination。
     */
    shouldShowPagination() {
      if (!this.hasPagination) {
        return false;
      }

      const totalPages = Number(this.pagination.totalPages || 0);
      return totalPages > 1 || this.pagination.hasPrev || this.pagination.hasNext;
    }
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     *
     * @param {*} value 可能来自电影页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      return Array.isArray(value) ? value : [];
    },

    /**
     * 把分页数据整理成对象或 null。
     *
     * @param {*} value 可能来自电影页数据文件的分页值。
     * @returns {Object|null} 有效对象原样返回，其他值统一转成 null。
     */
    asObjectOrNull(value) {
      // 数组不能作为分页对象使用，所以这里需要额外排除数组。
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }

      return value;
    }
  }
};
</script>

<style scoped>
/*
  电影页整体容器。
  对应 template 中的 `.movie-page`，负责包裹电影页全部区域。
*/
.movie-page {
  /* 目录页不额外缩窄，直接复用全局 theme-page 的宽度规则。 */
  padding-top: 8px;
}

/*
  电影页标题区域。
  对应 template 中 `.page-hero`，渲染在筛选区和结果区之前。
*/
.page-hero {
  /* 目录页标题和筛选区之间保持 参考布局 一样的较大间距。 */
  margin-bottom: 24px;
}
</style>
