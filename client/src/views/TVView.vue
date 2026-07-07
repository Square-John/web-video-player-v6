<template>
  <!--
    TVView 页面渲染树

    {div.theme-page.tv-page} [v-loading="loading"]
    ├─ {header.theme-page-header.page-hero}
    │  ├─ {h1.theme-page-title} 电视剧页标题
    │  └─ {p.theme-page-desc} 电视剧页说明
    ├─ [if hasFilters]
    │  └─ {CatalogFilterBar}
    │     - 读取 filters，渲染电视剧筛选区
    │     - filters 为空时本区域不渲染
    ├─ {CatalogGrid}
    │  ├─ [if tvList.length > 0] 渲染电视剧卡片网格
    │  └─ [else] 渲染主体空状态
    └─ [if shouldShowPagination]
       └─ {CatalogPagination}
          - 读取 pagination，渲染底部分页
          - 没有分页或只有一页时不渲染
  -->
  <!--
    电视剧页。
    作用：组织电视剧目录标题、筛选栏、主体卡片网格和分页区域。
  -->
  <div class="theme-page tv-page" v-loading="loading">
    <!--
      页面头部。
      渲染位置：电视剧页最上方。
      页面作用：说明当前页面是电视剧目录，并给下方筛选和结果区建立上下文。
    -->
    <header class="theme-page-header page-hero">
      <div>
        <h1 class="theme-page-title">电视剧</h1>
        <p class="theme-page-desc">按类型、剧情、地区和年份浏览电视剧内容</p>
      </div>
    </header>

    <!--
      电视剧筛选区。
      渲染条件：`hasFilters` 为 true。
      使用数据：`filters`，最多展示类型、剧情、地区、年份、排序五组筛选。
    -->
    <CatalogFilterBar
      v-if="hasFilters"
      title="电视剧筛选"
      hint="按类型、剧情、地区、年份和排序缩小浏览范围"
      :filters="filters" />

    <!--
      电视剧主体展示区。
      渲染位置：筛选区下方。
      使用数据：`tvList`。
      页面作用：有电视剧数据时显示卡片网格，没有电视剧数据时显示主体空状态。
    -->
    <CatalogGrid
      :items="tvList"
      empty-title="暂无电视剧内容"
      empty-text="当前筛选条件下没有可展示的电视剧。" />

    <!--
      电视剧分页区。
      渲染条件：`shouldShowPagination` 为 true。
      页面作用：展示当前页、上一页和下一页状态。
    -->
    <CatalogPagination v-if="shouldShowPagination" :pagination="pagination" />
  </div>
</template>

<script>
// 目录筛选栏组件，负责渲染电视剧页顶部筛选区。
import CatalogFilterBar from '../components/catalog/CatalogFilterBar.vue';

// 目录网格组件，负责渲染电视剧页主体卡片区域。
import CatalogGrid from '../components/catalog/CatalogGrid.vue';

// 目录分页组件，负责渲染电视剧页底部分页状态。
import CatalogPagination from '../components/catalog/CatalogPagination.vue';

// 电视剧页静态数据，记录筛选区、主体卡片区和分页区的当前数据结构。
import { tvPageData } from '../data/page-tv.mock';

export default {
  // 组件名称用于在调试工具和报错信息中识别电视剧页。
  name: 'TVView',

  // 注册电视剧页当前使用的目录组件。
  components: {
    // <CatalogFilterBar /> 对应电视剧页筛选区。
    CatalogFilterBar,

    // <CatalogGrid /> 对应电视剧页主体卡片区。
    CatalogGrid,

    // <CatalogPagination /> 对应电视剧页底部分页区。
    CatalogPagination
  },

  data() {
    return {
      // loading 控制电视剧页根容器上的 Element UI 加载遮罩。
      // 当前版本使用本地数据，所以默认 false；接入请求后由加载流程维护。
      loading: false,

      // filters 驱动电视剧页筛选区；数组为空时筛选区不渲染。
      filters: this.asList(tvPageData.filters),

      // tvList 驱动电视剧主体卡片区；数组为空时主体区显示空状态。
      tvList: this.asList(tvPageData.tvList),

      // pagination 驱动电视剧页底部分页区；为 null 时分页区不渲染。
      pagination: this.asObjectOrNull(tvPageData.pagination)
    };
  },

  computed: {
    /**
     * 电视剧页是否需要显示筛选区。
     *
     * @returns {boolean} 有筛选组时返回 true。
     */
    hasFilters() {
      return this.filters.length > 0;
    },

    /**
     * 电视剧页是否存在分页对象。
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
     * @param {*} value 可能来自电视剧页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      return Array.isArray(value) ? value : [];
    },

    /**
     * 把分页数据整理成对象或 null。
     *
     * @param {*} value 可能来自电视剧页数据文件的分页值。
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
  /* 目录页标题和筛选区之间保持 参考布局 一样的较大间距。 */
  margin-bottom: 24px;
}
</style>
