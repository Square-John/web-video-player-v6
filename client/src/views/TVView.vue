<template>
  <!--
    TVView 页面渲染树

    {div.tv-view}
    ├─ {header.tv-view__header}
    │  ├─ {p.tv-view__eyebrow} 页面短标签
    │  ├─ {h1.tv-view__title} 页面标题
    │  └─ {p.tv-view__summary} 页面说明
    ├─ [if hasFilters]
    │  └─ {CatalogFilterBar}
    │     └─ 读取 filters，渲染电视剧筛选区；filters 为空时本区域不渲染
    ├─ {CatalogGrid}
    │  └─ 读取 tvList，渲染电视剧卡片网格；tvList 为空时显示主体空状态
    └─ [if hasPagination]
       └─ {CatalogPagination}
          └─ 读取 pagination，渲染底部分页；pagination 为空时本区域不渲染
  -->
  <!--
    电视剧页。
    作用：组织电视剧目录标题、筛选栏、主体卡片网格和分页区域。
  -->
  <div class="tv-view">
    <!-- 页面头部，告诉用户当前正在浏览电视剧目录。 -->
    <header class="tv-view__header">
      <p class="tv-view__eyebrow">TV Catalog</p>
      <h1 class="tv-view__title">电视剧</h1>
      <p class="tv-view__summary">浏览电视剧内容，后续会接入真实数据源和筛选逻辑。</p>
    </header>

    <!-- 筛选区，filters 有内容时才渲染。 -->
    <CatalogFilterBar v-if="hasFilters" :filters="filters" />

    <!-- 电视剧主体展示区，组件内部负责处理 tvList 为空时的主体空状态。 -->
    <CatalogGrid :items="tvList" />

    <!-- 分页区，pagination 有内容时才渲染。 -->
    <CatalogPagination v-if="hasPagination" :pagination="pagination" />
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
      // filters 驱动电视剧页筛选区；数组为空时筛选区不渲染。
      filters: this.asList(tvPageData.filters),

      // tvList 驱动电视剧主体卡片区；数组为空时主体区显示空状态。
      tvList: this.asList(tvPageData.tvList),

      // pagination 驱动电视剧页底部分页区；为 null 时分页区不渲染。
      pagination: this.asObjectOrNull(tvPageData.pagination)
    };
  },

  computed: {
    // hasFilters 表示电视剧页是否需要显示筛选区。
    hasFilters() {
      return this.filters.length > 0;
    },

    // hasPagination 表示电视剧页是否需要显示分页区。
    hasPagination() {
      return Boolean(this.pagination);
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
  对应 template 中的 `.tv-view`，负责包裹电视剧页全部区域。
*/
.tv-view {
  /* 限制页面最大宽度，保证宽屏下内容不会过度拉伸。 */
  max-width: 1180px;

  /* 让电视剧页在主体区域中水平居中。 */
  width: 100%;

  /* 给页面上下留出空间，避免内容贴近导航栏和页脚。 */
  padding: 36px 32px 48px;

  /* 让 padding 计入宽度，避免横向溢出。 */
  box-sizing: border-box;
}

/*
  电视剧页头部。
  对应 template 中的 `.tv-view__header`，展示页面标题和说明。
*/
.tv-view__header {
  /* 控制头部和筛选栏之间的距离。 */
  margin-bottom: 24px;
}

/*
  页面短标签。
  对应 template 中的 `.tv-view__eyebrow`。
*/
.tv-view__eyebrow {
  /* 清掉段落默认外边距。 */
  margin: 0 0 10px;

  /* 使用较小字号形成辅助层级。 */
  font-size: 13px;

  /* 使用较粗字重让短标签清晰可见。 */
  font-weight: 700;

  /* 使用蓝色和页面主题保持一致。 */
  color: #315fca;
}

/*
  电视剧页标题。
  对应 template 中的 `.tv-view__title`。
*/
.tv-view__title {
  /* 清掉标题默认外边距。 */
  margin: 0;

  /* 使用较大字号，让页面标题成为当前页视觉重点。 */
  font-size: 34px;

  /* 使用紧凑行高，保证标题区域稳定。 */
  line-height: 1.18;

  /* 使用较粗字重突出页面标题。 */
  font-weight: 700;

  /* 使用深色文字提高可读性。 */
  color: #182235;
}

/*
  电视剧页说明。
  对应 template 中的 `.tv-view__summary`。
*/
.tv-view__summary {
  /* 控制说明文字和标题之间的距离。 */
  margin: 12px 0 0;

  /* 限制说明宽度，避免长文本铺满整行。 */
  max-width: 620px;

  /* 使用正文大小，保持说明文字易读。 */
  font-size: 15px;

  /* 设置舒适行高，适合多行说明。 */
  line-height: 1.7;

  /* 使用中性色，让说明文字处于辅助层级。 */
  color: #667085;
}
</style>
