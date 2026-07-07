<template>
  <!--
    TVView 页面渲染树

    {div.theme-page.tv-page} [v-loading="loading"]
    ├─ {header.theme-page-header.page-hero}
    │  ├─ {h1.theme-page-title} 电视剧页标题
    │  └─ {p.theme-page-desc} 电视剧页说明
    ├─ [if hasFilters]
    │  └─ {CatalogFilterBar}
    │     - 读取 TV_FILTER_GROUPS，渲染电视剧筛选区
    │     - filters 为空时本区域不渲染
    ├─ {CatalogGrid}
    │  ├─ [if tvList.length > 0] 渲染电视剧卡片网格
    │  └─ [else] 渲染主体空状态
    └─ [if shouldShowPagination]
       └─ {CatalogPagination}
          - 读取 siteContentStore.pages.tv.pagination，渲染底部分页
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
      [DEFAULT] ele(SourceSwitchTabs)
      - condition:
          默认渲染。
          电视剧页标题区下方展示静态页面静态数据源 tab 区域。
      - type:
          自定义组件
          相对位置: ../components/source/SourceSwitchTabs.vue
      - description:
          电视剧页顶部数据源静态 tab。
          展示当前版本可用数据源，并高亮默认选中的模拟源1数据源。
      - params:
          -- sourceTabs：电视剧页可展示的数据源 tab 列表。
          -- activeSourceId：电视剧页默认高亮的数据源 id。
      - events: 无
    -->
    <SourceSwitchTabs
      :sources="sourceTabs"
      :active-source-id="activeSourceId"
      aria-label="电视剧页数据源"
    />

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
      使用数据：统一内容 store 中的 `pages.tv.items`。
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
/*
  TVView script 模块说明

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      CatalogFilterBar: 自定义组件，渲染电视剧页筛选栏。
      CatalogGrid: 自定义组件，渲染电视剧页 ContentItem 卡片网格。
      CatalogPagination: 自定义组件，渲染标准 pagination 分页信息。
      SourceSwitchTabs: 自定义组件，渲染电视剧页顶部数据源 tab。
      sourceSwitchData: 自定义数据，提供静态页面静态数据源 tab 列表。
      requestSourceData/siteContentStore: 自定义服务和 store，请求并读取电视剧页统一数据桶。

  - 模块级常量:
      TV_FILTER_GROUPS: Array<object>，电视剧页静态筛选项配置。
      TV_PAGE_REQUEST: object，电视剧页首次进入时的数据桶请求参数。

  - 模块级辅助函数:
      无
*/

// 导入来源: ../components/catalog/CatalogFilterBar.vue。
// 导入内容: CatalogFilterBar 目录筛选栏组件。
// 文件作用: 用于渲染电视剧页顶部筛选区。
import CatalogFilterBar from '../components/catalog/CatalogFilterBar.vue';

// 导入来源: ../components/catalog/CatalogGrid.vue。
// 导入内容: CatalogGrid 目录网格组件。
// 文件作用: 用于渲染电视剧页主体 ContentItem 卡片区域。
import CatalogGrid from '../components/catalog/CatalogGrid.vue';

// 导入来源: ../components/catalog/CatalogPagination.vue。
// 导入内容: CatalogPagination 目录分页组件。
// 文件作用: 用于渲染电视剧页标准 pagination 分页状态。
import CatalogPagination from '../components/catalog/CatalogPagination.vue';

// 导入来源: ../components/source/SourceSwitchTabs.vue。
// 导入内容: SourceSwitchTabs 自定义组件。
// 文件作用: 用于在电视剧页标题下方渲染静态页面静态数据源 tab。
import SourceSwitchTabs from '../components/source/SourceSwitchTabs.vue';

// 导入来源: ../data/source-switch.mock。
// 导入内容: sourceSwitchData 顶部数据源静态数据。
// 文件作用: 给电视剧页 SourceSwitchTabs 提供数据源列表和默认高亮源。
import { sourceSwitchData } from '../data/source-switch.mock';

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 电视剧页通过该函数请求 tv 单列表数据桶。
import { requestSourceData } from '../services/sourceDataService.js';

// 导入来源: ../store/siteContentStore。
// 导入内容: siteContentStore 全站内容运行态 store。
// 文件作用: 电视剧页从 siteContentStore.pages.tv 读取 ContentItem 列表和标准 pagination。
import { siteContentStore } from '../store/siteContentStore.js';

// 类型: Array<object>。
// 作用: 电视剧页静态筛选项配置，只描述筛选 UI，不保存电视剧内容数据。
// 条目字段: name，string，筛选维度机器名，后续真实筛选请求会用它生成 params。
// 条目字段: label，string，筛选维度展示名。
// 条目字段: options，Array<object>，当前维度下的可选项。
const TV_FILTER_GROUPS = [
  {
    // 类型: string。
    // 作用: 内容类型筛选维度。
    name: 'category',

    // 类型: string。
    // 作用: 展示在筛选栏左侧的维度名称。
    label: '类型',

    // 类型: Array<object>。
    // 作用: 类型筛选项，当前版本只展示默认选中态。
    options: [
      { label: '全部', value: 'all', active: true },
      { label: '电视剧', value: 'tv', active: false },
      { label: '短剧', value: 'short', active: false },
      { label: '综艺', value: 'variety', active: false }
    ]
  },
  {
    // 类型: string。
    // 作用: 内容剧情类型筛选维度。
    name: 'genre',

    // 类型: string。
    // 作用: 展示在筛选栏左侧的维度名称。
    label: '剧情',

    // 类型: Array<object>。
    // 作用: 剧情筛选项，后续会映射到 SourceDataRequest.params.genre。
    options: [
      { label: '全部', value: 'all', active: true },
      { label: '剧情', value: 'drama', active: false },
      { label: '悬疑', value: 'mystery', active: false },
      { label: '职场', value: 'workplace', active: false }
    ]
  },
  {
    // 类型: string。
    // 作用: 内容地区筛选维度。
    name: 'region',

    // 类型: string。
    // 作用: 展示在筛选栏左侧的维度名称。
    label: '地区',

    // 类型: Array<object>。
    // 作用: 地区筛选项，后续会映射到 SourceDataRequest.params.region。
    options: [
      { label: '全部', value: 'all', active: true },
      { label: '大陆', value: 'cn', active: false },
      { label: '欧美', value: 'west', active: false },
      { label: '日韩', value: 'asia', active: false }
    ]
  },
  {
    // 类型: string。
    // 作用: 内容年份筛选维度。
    name: 'year',

    // 类型: string。
    // 作用: 展示在筛选栏左侧的维度名称。
    label: '年份',

    // 类型: Array<object>。
    // 作用: 年份筛选项，后续会映射到 SourceDataRequest.params.year。
    options: [
      { label: '全部', value: 'all', active: true },
      { label: '2026', value: '2026', active: false },
      { label: '2025', value: '2025', active: false },
      { label: '2024', value: '2024', active: false }
    ]
  },
  {
    // 类型: string。
    // 作用: 目录排序筛选维度。
    name: 'sort',

    // 类型: string。
    // 作用: 展示在筛选栏左侧的维度名称。
    label: '排序',

    // 类型: Array<object>。
    // 作用: 排序筛选项，后续会映射到 SourceDataRequest.params.sort。
    options: [
      { label: '最新', value: 'latest', active: true },
      { label: '最热', value: 'hot', active: false },
      { label: '评分', value: 'score', active: false }
    ]
  }
];

// 类型: object。
// 作用: 电视剧页首次进入时的统一数据桶请求参数。
// 字段: pageKey，string，请求目标页面数据桶。
// 字段: params，object，分页参数，控制 mock provider 返回电视剧列表当前页。
const TV_PAGE_REQUEST = {
  // 类型: string。
  // 作用: 请求电视剧页单列表数据桶。
  pageKey: 'tv',

  // 类型: object。
  // 作用: 电视剧页首屏请求第一页，当前静态阶段每页展示 20 条。
  params: {
    page: 1,
    pageSize: 20
  }
};

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
    CatalogPagination,

    // <SourceSwitchTabs /> 对应电视剧页标题和筛选栏之间的数据源静态 tab 区域。
    SourceSwitchTabs
  },

  data() {
    return {
      // 类型: boolean。
      // 初始值: true，页面首次进入时显示加载遮罩，避免数据桶尚未回填时闪过空态。
      // 作用: 控制电视剧页根容器上的 Element UI 加载遮罩。
      // true: 电视剧页正在请求统一内容数据桶。
      // false: 电视剧页请求结束，展示列表、分页或空状态。
      loading: true,

      // 类型: string。
      // 初始值: 空字符串，表示电视剧页尚未发生请求错误。
      // 作用: 保存电视剧页统一数据流请求失败时的错误文案，当前版本仅作为调试状态保留。
      loadError: '',

      // 类型: Array<object>。
      // 初始值: sourceSwitchData.sources。
      // 作用: 驱动电视剧页顶部数据源静态 tab；静态页面只展示，不触发真实切换。
      sourceTabs: this.asList(sourceSwitchData.sources),

      // 类型: string。
      // 初始值: sourceSwitchData.activeSourceId。
      // 作用: 控制电视剧页顶部数据源 tab 的默认高亮项；当前内容请求仍使用 mock provider 默认数据源。
      activeSourceId: sourceSwitchData.activeSourceId,

      // 类型: Array<object>。
      // 初始值: TV_FILTER_GROUPS。
      // 作用: 驱动电视剧页筛选区；这是页面 UI 配置，不是电视剧内容 mock 数据。
      filters: this.asList(TV_FILTER_GROUPS),

      // 类型: object。
      // 初始值: siteContentStore。
      // 作用: 保存全站内容运行态引用，电视剧页 computed 从 pages.tv 读取 items 和 pagination。
      contentStore: siteContentStore
    };
  },

  computed: {
    /**
     * 电视剧页主体卡片数据。
     * 来源: siteContentStore.pages.tv.items。
     * 执行内容: 直接返回统一 ContentItem 列表，由 CatalogGrid 和 VideoCard 读取统一字段。
     *
     * @returns {Array<object>} 电视剧页 ContentItem 列表。
     */
    tvList() {
      // 类型: object。
      // 作用: 读取统一内容 store 中电视剧页单列表数据桶。
      const tvBucket = this.contentStore.pages.tv;

      // 返回值类型: Array<object>。
      // 作用: 返回电视剧页 ContentItem 列表，缺失时用空数组兜底。
      return tvBucket && Array.isArray(tvBucket.items) ? tvBucket.items : [];
    },

    /**
     * 电视剧页分页数据。
     * 来源: siteContentStore.pages.tv.pagination。
     * 执行内容: 返回标准 PageBucket.pagination，不再读取旧分页字段。
     *
     * @returns {object|null} 标准分页对象。
     */
    pagination() {
      // 类型: object。
      // 作用: 读取统一内容 store 中电视剧页单列表数据桶。
      const tvBucket = this.contentStore.pages.tv;

      // 返回值类型: object|null。
      // 作用: 返回标准 pagination；缺失时返回 null 让分页组件不渲染。
      return tvBucket && tvBucket.pagination ? tvBucket.pagination : null;
    },

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
      // 条件分支: 没有标准 pagination 对象时进入。
      // 执行内容: 不渲染分页区。
      if (!this.hasPagination) {
        return false;
      }

      // 类型: number。
      // 作用: 标准 pagination.totalPages，用于判断是否需要展示分页。
      const totalPages = Number(this.pagination.totalPages || 0);

      // 类型: number。
      // 作用: 标准 pagination.page，用于判断当前是否已经进入第二页或更后页面。
      const standardPage = Number(this.pagination.page || 1);

      // 返回值类型: boolean。
      // 作用: 多页、有上一页或还有下一页时展示分页区。
      return totalPages > 1 || standardPage > 1 || Boolean(this.pagination.hasMore);
    }
  },

  /**
   * Vue created 生命周期。
   * 执行时机: 组件实例创建完成，data、computed 和 methods 已可用，但真实 DOM 尚未挂载。
   * 执行内容: 请求电视剧页统一内容数据桶。
   * 放置原因: 电视剧页数据请求不依赖 DOM，放在 created 可以让首屏数据尽早进入 store。
   *
   * @returns {void} 生命周期钩子不返回业务数据。
   */
  created() {
    // 执行内容: 发起电视剧页单列表数据桶请求。
    // 影响范围: 请求成功后 siteContentStore.pages.tv.items 和 pagination 会更新。
    this.loadTVContent();
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     *
     * @param {*} value 可能来自电视剧页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      // 返回值类型: Array<object>。
      // 作用: 保证筛选栏和卡片列表始终接收数组，避免 v-for 或 length 读取异常。
      return Array.isArray(value) ? value : [];
    },

    /**
     * 请求电视剧页统一内容数据桶。
     * 副作用: 调用 sourceDataService，并由 service 将 SourceDataResponse 写入 siteContentStore。
     * 成功路径: 电视剧页数据桶写入完成后关闭加载遮罩。
     * 失败路径: 捕获错误并写入 loadError，同时关闭加载遮罩，让页面进入当前已有数据或空态。
     *
     * @returns {Promise<void>} 电视剧页数据桶请求完成后结束。
     */
    async loadTVContent() {
      // 类型: boolean。
      // 作用: 进入电视剧页数据刷新状态，驱动根容器显示 Element UI 加载遮罩。
      this.loading = true;

      // 类型: string。
      // 作用: 每次重新请求前清空旧错误，避免旧错误影响本次状态判断。
      this.loadError = '';

      try {
        // 异步调用: 请求电视剧页单列表数据桶。
        // 成功结果: sourceDataService 会把响应写入 siteContentStore.pages.tv。
        await requestSourceData(TV_PAGE_REQUEST);
      } catch (error) {
        // 类型: string。
        // 作用: 记录电视剧页数据桶请求失败原因，当前版本用于调试，不直接改变视觉布局。
        this.loadError = error && error.message ? error.message : '电视剧页内容数据请求失败';
      } finally {
        // 类型: boolean。
        // 作用: 结束电视剧页数据刷新状态，让页面展示 store 中已有数据或空状态。
        this.loading = false;
      }
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
  /* 目录页标题和筛选区之间保持 参考版本 一样的较大间距。 */
  margin-bottom: 24px;
}
</style>
