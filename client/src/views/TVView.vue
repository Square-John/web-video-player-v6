<template>
  <!--
    TVView 页面渲染树

    [DEFAULT] ele(div.theme-page.tv-page)
    │  - condition:
    │      默认渲染；loading 为 true 时展示电视剧目录加载遮罩。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      电视剧目录页根容器。
    │      编排标题、数据源切换、筛选、内容网格和分页。
    │  - params:
    │      -- loading：电视剧目录请求状态。
    │  - events: 无
    │
    ├─ [DEFAULT] ele(header.page-hero)
    │  - condition:
    │      电视剧页默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: header
    │  - description:
    │      电视剧目录标题区。
    │      展示页面名称和筛选维度说明。
    │  - params: 无
    │  - events: 无
    │
    ├─ [DEFAULT] ele(SourceSwitchTabs)
    │  - condition:
    │      电视剧页默认展示数据源切换入口。
    │  - type:
    │      自定义组件
    │      相对位置: ../components/source/SourceSwitchTabs.vue
    │  - description:
    │      电视剧页数据源切换组件。
    │      展示 sourceTabs 并高亮 activeSourceId。
    │  - params:
    │      -- sourceTabs：可用数据源列表。
    │      -- activeSourceId：当前选中数据源 id。
    │  - events: 无
    │
    ├─ [IF hasFilters] ele(CatalogFilterBar)
    │  - condition:
    │      当前数据源返回电视剧筛选元数据时渲染。
    │  - type:
    │      自定义组件
    │      相对位置: ../components/catalog/CatalogFilterBar.vue
    │  - description:
    │      电视剧筛选组件。
    │      展示动态筛选项，并把筛选或重置操作回传页面。
    │  - params:
    │      -- filters：电视剧筛选分组。
    │      -- isResetDisabled：重置按钮禁用状态。
    │  - events:
    │      @change-filter / @reset-filters
    │          - description:
    │              用户改变筛选或重置筛选时刷新电视剧列表。
    │          - methods:
    │              handleFilterChange(payload)
    │              handleResetFilters()
    │
    ├─ [DEFAULT] ele(CatalogGrid)
    │  - condition:
    │      电视剧页默认渲染，组件内部处理列表和空状态。
    │  - type:
    │      自定义组件
    │      相对位置: ../components/catalog/CatalogGrid.vue
    │  - description:
    │      电视剧内容网格。
    │      展示当前页 tvList 标准内容列表。
    │  - params:
    │      -- tvList：当前页电视剧列表。
    │  - events: 无
    │
    └─ [IF shouldShowPagination] ele(CatalogPagination)
       - condition:
           当前分页存在上一页或下一页时渲染。
       - type:
           自定义组件
           相对位置: ../components/catalog/CatalogPagination.vue
       - description:
           电视剧目录分页组件。
           展示当前分页事实并回传目标页码。
       - params:
           -- pagination：电视剧页标准分页对象。
       - events:
           @change-page
               - description:
                   用户切换页码时重新请求目标电视剧页。
               - methods:
                   handlePageChange(payload)
                       -- payload：目标分页参数。
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
          电视剧页标题区下方展示静态数据源 tab 区域。
      - type:
          自定义组件
          相对位置: ../components/source/SourceSwitchTabs.vue
      - description:
          电视剧页顶部数据源静态 tab。
          展示当前项目可用数据源，并高亮默认选中的系统数据源1。
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
      使用数据：`filters`，按数据源返回的动态筛选元数据渲染类型、地区、年份和排序。
    -->
    <CatalogFilterBar
      v-if="hasFilters"
      title="电视剧筛选"
      hint="按类型、剧情、地区、年份和排序缩小浏览范围"
      :filters="filters"
      :reset-disabled="isResetDisabled"
      @change-filter="handleFilterChange"
      @reset-filters="handleResetFilters" />

    <!--
      电视剧主体展示区。
      渲染位置：筛选区下方。
      使用数据：`getBucketItems('tv')` 返回的统一 ContentItem 列表。
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
    <CatalogPagination
      v-if="shouldShowPagination"
      :pagination="pagination"
      @change-page="handlePageChange" />
  </div>
</template>

<script>
/*
  TVView.vue 模块说明

  - 文件职责:
      编排电视剧目录的数据源切换、动态筛选、内容网格和分页。
      使用标准请求对象与 store selector 组织页面状态，不包含数据源专属解析。

  - 导入库及文件汇总(9 条，内置 0 条，第三方 0 条，自定义 9 条):
      CatalogFilterBar: 自定义组件，渲染电视剧页筛选栏。
      CatalogGrid: 自定义组件，渲染电视剧页 ContentItem 卡片网格。
      CatalogPagination: 自定义组件，渲染标准 pagination 分页信息。
      SourceSwitchTabs: 自定义组件，渲染电视剧页顶部数据源 tab。
      sourceSwitchData: 自定义数据，提供静态数据源 tab 列表。
      requestSourceData: 自定义服务，请求电视剧页统一内容数据桶。
      requestSourceFilterMeta: 自定义服务，请求电视剧页动态筛选元数据。
      getBucketItems/getPagePagination/siteFilterStore: 自定义 selector 和 store，读取电视剧页内容列表、分页和筛选元数据。

  - 模块级常量:
      DEFAULT_TV_FILTER_SELECTION: object，电视剧页默认筛选状态。
      TV_PAGE_REQUEST: object，电视剧页首次进入时的数据桶请求参数。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      TVView: Vue 路由页面组件，供 tv 路由浏览和筛选电视剧内容。
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
// 文件作用: 用于在电视剧页标题下方渲染静态数据源 tab。
import SourceSwitchTabs from '../components/source/SourceSwitchTabs.vue';

// 导入来源: ../data/source-switch.mock。
// 导入内容: sourceSwitchData 顶部数据源静态数据。
// 文件作用: 给电视剧页 SourceSwitchTabs 提供数据源列表和默认高亮源。
import { sourceSwitchData } from '../data/source-switch.mock';

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 电视剧页通过该函数请求 tv 单列表数据桶。
import { requestSourceData } from '../services/sourceDataService.js';

// 导入来源: ../services/sourceFilterService。
// 导入内容: requestSourceFilterMeta 筛选元数据请求函数。
// 文件作用: 电视剧页通过该函数请求 tv 动态筛选字段。
import { requestSourceFilterMeta } from '../services/sourceFilterService.js';

import {
  // 导入来源: ../store/siteContentStore。
  // 导入内容: getBucketItems 列表桶 selector。
  // 文件作用: 电视剧页通过 selector 从 tv.itemKeys 解析完整 ContentItem 列表。
  getBucketItems,

  // 导入来源: ../store/siteContentStore。
  // 导入内容: getPagePagination 分页 selector。
  // 文件作用: 电视剧页通过 selector 从 tv 数据桶读取标准 pagination。
  getPagePagination
} from '../store/siteContentStore.js';

// 导入来源: ../store/siteFilterStore。
// 导入内容: siteFilterStore 全站筛选元数据运行态 store。
// 文件作用: 电视剧页从 siteFilterStore.pages.tv 读取动态筛选组数组。
import { siteFilterStore } from '../store/siteFilterStore.js';

// 类型: object。
// 作用: 电视剧页默认筛选状态，页面首次进入和点击重置筛选时都回到这一组值。
// 字段: genre，string，电视剧类型筛选值。
// 字段: area，string，地区筛选值。
// 字段: year，string，年份筛选值。
// 字段: sort，string，排序值。
const DEFAULT_TV_FILTER_SELECTION = {
  // 类型: string。
  // 作用: 设置默认类型筛选为全部内容。
  genre: 'all',

  // 类型: string。
  // 作用: 设置默认地区筛选为全部内容。
  area: 'all',

  // 类型: string。
  // 作用: 设置默认年份筛选为全部内容。
  year: 'all',

  // 类型: string。
  // 作用: 设置电视剧目录默认按最新顺序展示。
  sort: 'latest'
};

// 类型: object。
// 作用: 电视剧页首次进入时的统一数据桶请求参数。
// 字段: pageKey，string，请求目标页面数据桶。
// 字段: params，object，分页参数，控制 mock provider 返回电视剧列表当前页。
const TV_PAGE_REQUEST = {
  // 类型: string。
  // 作用: 请求电视剧页单列表数据桶。
  pageKey: 'tv',

  // 类型: object。
  // 作用: 电视剧页首屏请求第一页，当前统一分页规则每页展示 12 条。
  params: {
    page: 1,
    pageSize: 12
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

  /**
   * 创建电视剧目录的请求、筛选和数据源状态。
   * 纯函数: 返回当前页面实例的独立状态，不修改标准默认筛选对象。
   *
   * @returns {object} 电视剧页响应式状态。
   * @returns {object} return.selectedFilters 当前类型、地区、年份和排序选择。
   */
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
      // 作用: 保存电视剧页统一数据流请求失败时的错误文案，当前仅作为调试状态保留。
      loadError: '',

      // 类型: Array<object>。
      // 初始值: sourceSwitchData.sources。
      // 作用: 驱动电视剧页顶部数据源静态 tab；当前只展示，不触发真实切换。
      sourceTabs: this.asList(sourceSwitchData.sources),

      // 类型: string。
      // 初始值: sourceSwitchData.activeSourceId。
      // 作用: 控制电视剧页顶部数据源 tab 的默认高亮项；当前内容请求仍使用 mock provider 默认数据源。
      activeSourceId: sourceSwitchData.activeSourceId,

      // 类型: object。
      // 初始值: DEFAULT_TV_FILTER_SELECTION。
      // 作用: 保存当前电视剧页筛选状态；筛选变化后会回到第一页重新请求内容列表。
      selectedFilters: {
        ...DEFAULT_TV_FILTER_SELECTION
      },

      // 类型: object。
      // 初始值: siteFilterStore。
      // 作用: 保存全站筛选元数据运行态引用，电视剧页 computed 从 pages.tv 读取动态筛选组。
      filterStore: siteFilterStore
    };
  },

  computed: {
    /**
     * 电视剧页筛选元数据桶。
     * 来源: siteFilterStore.pages.tv。
     * 执行内容: 返回电视剧页动态筛选组所在的数据桶。
     *
     * @returns {object} 电视剧页筛选元数据桶。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    tvFilterBucket() {
      return this.filterStore.pages.tv;
    },

    /**
     * 电视剧页筛选组数组。
     * 来源: siteFilterStore.pages.tv.groups。
     * 执行内容: 把当前选中筛选值映射回每个筛选项的 active 状态。
     *
     * @returns {Array<object>} 可直接供 CatalogFilterBar 渲染的筛选组数组。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    filters() {
      // 类型: Array<object>。
      // 作用: 读取当前电视剧页动态筛选组；缺失时用空数组兜底。
      const groups = this.tvFilterBucket && Array.isArray(this.tvFilterBucket.groups)
        ? this.tvFilterBucket.groups
        : [];

      // 返回值类型: Array<object>。
      // 作用: 根据 selectedFilters 回填 active 状态，让 CatalogFilterBar 只负责展示。
      return groups.map((group) => {
        // 类型: string。
        // 作用: 读取当前筛选组的已选值，用于回填选项 active 状态。
        const selectedValue = this.selectedFilters[group.name];

        return {
          ...group,
          options: Array.isArray(group.options)
            ? group.options.map(option => ({
              ...option,
              active: option.value === (selectedValue === undefined ? 'all' : selectedValue)
            }))
            : []
        };
      });
    },

    /**
     * 电视剧页主体卡片数据。
     * 来源: getBucketItems('tv')。
     * 执行内容: 通过 selector 从 tv.itemKeys 解析统一 ContentItem 列表，由 CatalogGrid 和 UserVideoCard 读取统一字段。
     *
     * @returns {Array<object>} 电视剧页 ContentItem 列表。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    tvList() {
      // 返回值类型: Array<object>。
      // 作用: 通过统一 selector 读取电视剧页内容，让页面不再直接感知 itemKeys 到实体池的解析过程。
      return getBucketItems('tv');
    },

    /**
     * 电视剧页分页数据。
     * 来源: getPagePagination('tv')。
     * 执行内容: 通过 selector 返回标准 PageBucket.pagination，不直接读取 store 内部结构。
     *
     * @returns {object|null} 标准分页对象。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    pagination() {
      // 返回值类型: object|null。
      // 作用: 通过统一 selector 读取电视剧页分页信息，让页面不再直接感知 PageBucket 结构。
      return getPagePagination('tv');
    },

    /**
     * 电视剧页是否需要显示筛选区。
     *
     * @returns {boolean} 有筛选组时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    hasFilters() {
      return this.filters.length > 0;
    },

    /**
     * 当前是否存在非默认筛选条件。
     *
     * @returns {boolean} 任一筛选值偏离默认值时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    hasActiveFilters() {
      return Object.keys(DEFAULT_TV_FILTER_SELECTION).some(filterName => {
        return this.selectedFilters[filterName] !== DEFAULT_TV_FILTER_SELECTION[filterName];
      });
    },

    /**
     * 重置筛选按钮是否禁用。
     *
     * @returns {boolean} 没有非默认筛选条件时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    isResetDisabled() {
      return !this.hasActiveFilters;
    },

    /**
     * 电视剧页是否存在分页对象。
     *
     * @returns {boolean} 存在分页对象时返回 true。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
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
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
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
   * 副作用: 组件创建后依次请求电视剧筛选元数据和电视剧列表数据。
   */
  created() {
    // 执行内容: 首次进入电视剧页时并行请求筛选元数据和第一页内容列表。
    // 影响范围: 请求成功后电视剧筛选数据桶和电视剧内容数据桶会更新，页面通过 filterStore、getBucketItems('tv') 和 getPagePagination('tv') 读取。
    this.loadInitialTVPage();
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     *
     * @param {*} value 可能来自电视剧页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    asList(value) {
      // 返回值类型: Array<object>。
      // 作用: 保证筛选栏和卡片列表始终接收数组，避免 v-for 或 length 读取异常。
      return Array.isArray(value) ? value : [];
    },

    /**
     * 创建电视剧页内容请求参数。
     * 纯函数: 只读取当前筛选状态和传入页码，不直接修改页面状态。
     *
     * @param {number} page 目标页码。
     * @returns {object} 电视剧页标准 SourceDataRequest。
     */
    createTVPageRequest(page) {
      // 类型: number。
      // 作用: 目标页码为空或非法时回到第一页。
      const targetPage = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;

      // 返回值类型: object。
      // 作用: 组装电视剧页内容请求，让 provider 能按当前筛选状态过滤和排序候选内容。
      return {
        pageKey: 'tv',
        params: {
          page: targetPage,
          pageSize: TV_PAGE_REQUEST.params.pageSize,
          genre: this.selectedFilters.genre,
          area: this.selectedFilters.area,
          year: this.selectedFilters.year,
          sort: this.selectedFilters.sort
        }
      };
    },

    /**
     * 请求电视剧页动态筛选元数据。
     * 副作用: 调用 sourceFilterService，并由 service 将 SourceFilterMetaResponse 写入 siteFilterStore。
     *
     * @returns {Promise<void>} 电视剧页筛选元数据请求完成后结束。
     * 成功路径: 筛选元数据请求成功后由 sourceFilterService 写入 siteFilterStore.pages.tv。
     * 失败路径: 筛选服务拒绝时向调用方传播错误，由外层初始化流程决定页面错误状态。
     */
    async loadTVFilterMeta() {
      // 异步调用: 请求电视剧页动态筛选元数据。
      // 成功结果: sourceFilterService 会把响应写入 siteFilterStore.pages.tv。
      await requestSourceFilterMeta({
        pageKey: 'tv'
      });
    },

    /**
     * 首次加载电视剧页。
     * 副作用: 并行请求动态筛选元数据和第一页电视剧内容列表。
     *
     * @returns {Promise<void>} 初始化请求完成后结束。
     * 成功路径: 筛选元数据与第一页内容都完成后展示统一筛选和内容结果，并关闭 loading。
     * 失败路径: 任一初始化请求失败时捕获错误并写入 loadError；finally 关闭 loading，不向生命周期调用方继续抛错。
     */
    async loadInitialTVPage() {
      // 类型: boolean。
      // 作用: 首次进入电视剧页时显示页面级加载遮罩，避免筛选区和列表区先闪空态。
      this.loading = true;

      // 类型: string。
      // 作用: 首次加载前清空旧错误，避免上次失败信息残留。
      this.loadError = '';

      try {
        // 异步调用: 并行请求筛选元数据和第一页电视剧内容。
        // 成功结果: 筛选组写入筛选数据桶，内容列表写入电视剧内容数据桶，页面通过 selector 读取列表和分页。
        await Promise.all([
          this.loadTVFilterMeta(),
          requestSourceData(this.createTVPageRequest(1))
        ]);
      } catch (error) {
        // 类型: string。
        // 作用: 记录电视剧页初始化失败原因，当前用于调试和页面级错误兜底。
        this.loadError = error && error.message ? error.message : '电视剧页初始化请求失败';
      } finally {
        // 类型: boolean。
        // 作用: 结束电视剧页初始化加载态，让页面展示筛选区和已有数据或空状态。
        this.loading = false;
      }
    },

    /**
     * 请求电视剧页统一内容数据桶。
     * 副作用: 调用 sourceDataService，并由 service 将 SourceDataResponse 写入 siteContentStore。
     * 成功路径: 电视剧页数据桶写入完成后关闭加载遮罩。
     * 失败路径: 捕获错误并写入 loadError，同时关闭加载遮罩，让页面进入当前已有数据或空态。
     *
     * @param {number} page 目标页码。
     * @returns {Promise<void>} 电视剧页数据桶请求完成后结束。
     */
    async loadTVContent(page = 1) {
      // 类型: boolean。
      // 作用: 进入电视剧页数据刷新状态，驱动根容器显示 Element UI 加载遮罩。
      this.loading = true;

      // 类型: string。
      // 作用: 每次重新请求前清空旧错误，避免旧错误影响本次状态判断。
      this.loadError = '';

      try {
        // 异步调用: 请求电视剧页单列表数据桶。
        // 成功结果: sourceDataService 会把响应写入 tv 数据桶，页面通过 getBucketItems('tv') 和 getPagePagination('tv') 读取。
        await requestSourceData(this.createTVPageRequest(page));
      } catch (error) {
        // 类型: string。
        // 作用: 记录电视剧页数据桶请求失败原因，当前用于调试，不直接改变视觉布局。
        this.loadError = error && error.message ? error.message : '电视剧页内容数据请求失败';
      } finally {
        // 类型: boolean。
        // 作用: 结束电视剧页数据刷新状态，让页面展示 store 中已有数据或空状态。
        this.loading = false;
      }
    },

    /**
     * 处理电视剧页筛选项变化。
     * 副作用: 更新当前筛选状态，并重新请求第一页内容列表。
     *
     * @param {object} payload 筛选组件派发的事件参数。
     * @param {string} payload.groupName 当前筛选组机器名。
     * @param {*} payload.optionValue 当前筛选项值。
     * @returns {Promise<void>} 目标筛选应用并刷新第一页内容后结束。
     * 成功路径: 有效筛选值写入 selectedFilters 后完成第一页内容刷新。
     * 失败路径: 内容刷新失败时由 loadTVContent 捕获并写入 loadError，本方法等待该流程结束后正常收敛。
     */
    async handleFilterChange(payload) {
      // 类型: object。
      // 作用: payload 不是对象时使用空对象兜底，避免读取字段时报错。
      const safePayload = payload && typeof payload === 'object' ? payload : {};

      // 类型: string。
      // 作用: 当前变更的筛选组名称。
      const groupName = safePayload.groupName || '';

      // 条件分支: 筛选组名缺失时进入。
      // 执行内容: 直接退出，避免写入未知筛选键。
      if (!groupName || !Object.prototype.hasOwnProperty.call(this.selectedFilters, groupName)) {
        return;
      }

      // 副作用: 更新当前筛选状态。
      // 影响范围: filters 计算属性会重新映射 active 状态，内容请求也会带上新筛选值。
      this.selectedFilters = {
        ...this.selectedFilters,
        [groupName]: safePayload.optionValue
      };

      // 执行内容: 筛选变化后重新请求第一页内容，避免保留上一轮分页页码导致结果越界。
      await this.loadTVContent(1);
    },

    /**
     * 重置电视剧页筛选。
     * 副作用: 恢复默认筛选状态，并重新请求第一页内容列表。
     *
     * @returns {Promise<void>} 默认筛选恢复并刷新第一页内容后结束。
     * 成功路径: 非默认筛选恢复为 DEFAULT_TV_FILTER_SELECTION 后完成第一页内容刷新。
     * 失败路径: 内容刷新失败时由 loadTVContent 捕获并写入 loadError；已恢复的筛选状态保持不变。
     */
    async handleResetFilters() {
      // 条件分支: 当前已经处于默认筛选状态时进入。
      // 执行内容: 直接退出，避免重复请求第一页内容。
      if (this.isResetDisabled) {
        return;
      }

      // 副作用: 恢复默认筛选状态。
      // 影响范围: CatalogFilterBar 会回到“全部 / 最新”的默认激活态。
      this.selectedFilters = {
        ...DEFAULT_TV_FILTER_SELECTION
      };

      // 执行内容: 重置筛选后重新请求第一页内容。
      await this.loadTVContent(1);
    },

    /**
     * 处理电视剧页分页变化。
     * 副作用: 根据分页组件派发的目标页码重新请求内容列表。
     *
     * @param {object} payload 分页组件派发的事件参数。
     * @param {number} payload.page 目标页码。
     * @returns {Promise<void>} 目标页内容请求完成后结束。
     * 成功路径: 有效目标页码交给 loadTVContent 刷新，分页 selector 随 store 响应更新。
     * 失败路径: 内容刷新失败时由 loadTVContent 捕获并写入 loadError，store 保留上一次可用列表。
     */
    async handlePageChange(payload) {
      // 类型: number。
      // 作用: 从分页事件中读取目标页码，异常值时回到第一页。
      const targetPage = payload && Number.isFinite(Number(payload.page)) ? Number(payload.page) : 1;

      // 执行内容: 保持当前筛选状态不变，只请求目标页码内容。
      await this.loadTVContent(targetPage);
    }
  }
};
</script>

<style scoped>
/*
  作用容器: `.tv-page`。
  样式作用:
  电视剧页整体容器。
  对应 template 中的 `.tv-page`，负责包裹电视剧页全部区域。
*/
.tv-page {
  /* 目录页不额外缩窄，直接复用全局 theme-page 的宽度规则。 */
  padding-top: 8px;
}

/*
  作用容器: `.page-hero`。
  样式作用:
  电视剧页标题区域。
  对应 template 中 `.page-hero`，渲染在筛选区和结果区之前。
*/
.page-hero {
  /* 目录页标题和筛选区之间保持较大间距，便于区分标题与操作区。 */
  margin-bottom: 24px;
}
</style>
