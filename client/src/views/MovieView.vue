<template>
  <!--
    MovieView 页面渲染树

    {div.theme-page.movie-page} [v-loading="loading"]
    ├─ {header.theme-page-header.page-hero}
    │  ├─ {h1.theme-page-title} 电影页标题
    │  └─ {p.theme-page-desc} 电影页说明
    ├─ [if hasFilters]
    │  └─ {CatalogFilterBar}
    │     - 读取 siteFilterStore.pages.movie.groups，渲染电影筛选区
    │     - 点击筛选项或重置按钮时由 MovieView 更新筛选状态并重新请求列表
    ├─ {CatalogGrid}
    │  ├─ [if movies.length > 0] 渲染电影卡片网格
    │  └─ [else] 渲染主体空状态
    └─ [if shouldShowPagination]
       └─ {CatalogPagination}
          - 读取 getPagePagination('movie')，渲染底部分页
          - 点击上一页或下一页时由 MovieView 重新请求目标页码
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
          电影页标题区下方展示阶段一静态数据源 tab 区域。
      - type:
          自定义组件
          相对位置: ../components/source/SourceSwitchTabs.vue
      - description:
          电影页顶部数据源静态 tab。
          展示当前阶段可用数据源，并高亮默认的“模拟数据源 01”。
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
      使用数据：`filters`，按数据源返回的动态筛选元数据渲染类型、地区、年份和排序。
    -->
    <CatalogFilterBar
      v-if="hasFilters"
      title="电影筛选"
      hint="按类型、剧情、地区、年份和排序缩小浏览范围"
      :filters="filters"
      :reset-disabled="isResetDisabled"
      @change-filter="handleFilterChange"
      @reset-filters="handleResetFilters" />

    <!--
      电影主体展示区。
      渲染位置：筛选区下方。
      使用数据：`getBucketItems('movie')` 返回的统一 ContentItem 列表。
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
    <CatalogPagination
      v-if="shouldShowPagination"
      :pagination="pagination"
      @change-page="handlePageChange" />
  </div>
</template>

<script>
/*
  MovieView.vue 模块说明

  - 文件职责:
      组织电影目录静态数据源入口、动态筛选、内容网格和分页交互。
      通过共享 Runtime 对应的内容与筛选 service 请求数据，并从两个运行态 store 派生页面展示。

  - 导入库及文件汇总(9 条，内置 0 条，第三方 0 条，自定义 9 条):
      CatalogFilterBar: 自定义组件，渲染电影页筛选栏。
      CatalogGrid: 自定义组件，渲染电影页 ContentItem 卡片网格。
      CatalogPagination: 自定义组件，渲染标准 pagination 分页信息。
      SourceSwitchTabs: 自定义组件，渲染电影页顶部数据源 tab。
      sourceSwitchData: 自定义数据，提供阶段一静态数据源 tab 列表。
      requestSourceData: 自定义服务，请求电影页统一内容数据桶。
      requestSourceFilterMeta: 自定义服务，请求电影页动态筛选元数据。
      getBucketItems/getPagePagination: 自定义 selector，读取电影页内容列表和分页。
      siteFilterStore: 自定义 store，读取电影页筛选元数据。

  - 模块级常量:
      DEFAULT_MOVIE_FILTER_SELECTION: object，电影页默认筛选状态。
      MOVIE_PAGE_REQUEST: object，电影页首次进入时的数据桶请求参数。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      MovieView: Vue component，电影目录路由使用的页面组件。
*/

// 导入来源: ../components/catalog/CatalogFilterBar.vue。
// 导入内容: CatalogFilterBar 目录筛选栏组件。
// 文件作用: 用于渲染电影页顶部筛选区。
import CatalogFilterBar from '../components/catalog/CatalogFilterBar.vue';

// 导入来源: ../components/catalog/CatalogGrid.vue。
// 导入内容: CatalogGrid 目录网格组件。
// 文件作用: 用于渲染电影页主体 ContentItem 卡片区域。
import CatalogGrid from '../components/catalog/CatalogGrid.vue';

// 导入来源: ../components/catalog/CatalogPagination.vue。
// 导入内容: CatalogPagination 目录分页组件。
// 文件作用: 用于渲染电影页标准 pagination 分页状态。
import CatalogPagination from '../components/catalog/CatalogPagination.vue';

// 导入来源: ../components/source/SourceSwitchTabs.vue。
// 导入内容: SourceSwitchTabs 自定义组件。
// 文件作用: 用于在电影页标题下方渲染阶段一静态数据源 tab。
import SourceSwitchTabs from '../components/source/SourceSwitchTabs.vue';

// 导入来源: ../data/source-switch.mock。
// 导入内容: sourceSwitchData 顶部数据源静态数据。
// 文件作用: 给电影页 SourceSwitchTabs 提供数据源列表和默认高亮源。
import { sourceSwitchData } from '../data/source-switch.mock';

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 电影页通过该函数请求 movie 单列表数据桶。
import { requestSourceData } from '../services/sourceDataService.js';

// 导入来源: ../services/sourceFilterService。
// 导入内容: requestSourceFilterMeta 筛选元数据请求函数。
// 文件作用: 电影页通过该函数请求 movie 动态筛选字段。
import { requestSourceFilterMeta } from '../services/sourceFilterService.js';

import {
  // 导入来源: ../store/siteContentStore。
  // 导入内容: getBucketItems 列表桶 selector。
  // 文件作用: 电影页通过 selector 从 movie.itemKeys 解析完整 ContentItem 列表。
  getBucketItems,

  // 导入来源: ../store/siteContentStore。
  // 导入内容: getPagePagination 分页 selector。
  // 文件作用: 电影页通过 selector 从 movie 数据桶读取标准 pagination。
  getPagePagination
} from '../store/siteContentStore.js';

// 导入来源: ../store/siteFilterStore。
// 导入内容: siteFilterStore 全站筛选元数据运行态 store。
// 文件作用: 电影页从 siteFilterStore.pages.movie 读取动态筛选组数组。
import { siteFilterStore } from '../store/siteFilterStore.js';

// 类型: object。
// 作用: 电影页默认筛选状态，页面首次进入和点击重置筛选时都回到这一组值。
// 字段: genre，string，电影类型筛选值。
// 字段: area，string，地区筛选值。
// 字段: year，string，年份筛选值。
// 字段: sort，string，排序值。
const DEFAULT_MOVIE_FILTER_SELECTION = {
  // 类型: string。
  // 作用: 默认不限制电影类型，筛选栏对应“全部”选项。
  genre: 'all',

  // 类型: string。
  // 作用: 默认不限制电影地区，筛选栏对应“全部”选项。
  area: 'all',

  // 类型: string。
  // 作用: 默认不限制电影年份，筛选栏对应“全部”选项。
  year: 'all',

  // 类型: string。
  // 作用: 默认按最新内容排序，驱动首次请求和重置后的排序参数。
  sort: 'latest'
};

// 类型: object。
// 作用: 电影页首次进入时的统一数据桶请求参数。
// 字段: pageKey，string，请求目标页面数据桶。
// 字段: params，object，分页参数，控制可信模拟 Provider 返回电影列表当前页。
const MOVIE_PAGE_REQUEST = {
  // 类型: string。
  // 作用: 请求电影页单列表数据桶。
  pageKey: 'movie',

  // 类型: object。
  // 作用: 电影页首屏请求第一页，当前统一分页规则每页展示 12 条。
  params: {
    page: 1,
    pageSize: 12
  }
};

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

  /**
   * 创建电影页组件响应式状态。
   * 纯函数: 只读取静态 sourceSwitchData、默认筛选常量和筛选 store 引用并返回新状态对象，不修改外部状态。
   *
   * @returns {object} 电影页组件初始响应式状态。
   */
  data() {
    return {
      // 类型: boolean。
      // 初始值: true，页面首次进入时显示加载遮罩，避免数据桶尚未回填时闪过空态。
      // 作用: 控制电影页根容器上的 Element UI 加载遮罩。
      // true: 电影页正在请求统一内容数据桶。
      // false: 电影页请求结束，展示列表、分页或空状态。
      loading: true,

      // 类型: string。
      // 初始值: 空字符串，表示电影页尚未发生请求错误。
      // 作用: 保存电影页统一数据流请求失败时的错误文案，当前阶段仅作为调试状态保留。
      loadError: '',

      // 类型: Array<object>。
      // 初始值: sourceSwitchData.sources。
      // 作用: 驱动电影页顶部数据源静态 tab；阶段一只展示，不触发真实切换。
      sourceTabs: this.asList(sourceSwitchData.sources),

      // 类型: string。
      // 初始值: sourceSwitchData.activeSourceId。
      // 作用: 控制电影页顶部数据源 tab 的默认高亮项；省略 sourceId 的请求由共享 Runtime 解析 Repository 默认源。
      activeSourceId: sourceSwitchData.activeSourceId,

      // 类型: object。
      // 初始值: DEFAULT_MOVIE_FILTER_SELECTION。
      // 作用: 保存当前电影页筛选状态；筛选变化后会回到第一页重新请求内容列表。
      selectedFilters: {
        ...DEFAULT_MOVIE_FILTER_SELECTION
      },

      // 类型: object。
      // 初始值: siteFilterStore。
      // 作用: 保存全站筛选元数据运行态引用，电影页 computed 从 pages.movie 读取动态筛选组。
      filterStore: siteFilterStore
    };
  },

  computed: {
    /**
     * 电影页筛选元数据桶。
     * 来源: siteFilterStore.pages.movie。
     * 执行内容: 返回电影页动态筛选组所在的数据桶。
     * 纯函数: 只读取响应式筛选 store，不修改页面或筛选桶。
     *
     * @returns {object} 电影页筛选元数据桶。
     */
    movieFilterBucket() {
      return this.filterStore.pages.movie;
    },

    /**
     * 电影页筛选组数组。
     * 来源: siteFilterStore.pages.movie.groups。
     * 执行内容: 把当前选中筛选值映射回每个筛选项的 active 状态。
     * 纯函数: 只根据筛选 store 和 selectedFilters 创建新展示数组，不修改源筛选组。
     *
     * @returns {Array<object>} 可直接供 CatalogFilterBar 渲染的筛选组数组。
     */
    filters() {
      // 类型: Array<object>。
      // 作用: 读取当前电影页动态筛选组；缺失时用空数组兜底。
      const groups = this.movieFilterBucket && Array.isArray(this.movieFilterBucket.groups)
        ? this.movieFilterBucket.groups
        : [];

      // 返回值类型: Array<object>。
      // 作用: 根据 selectedFilters 回填 active 状态，让 CatalogFilterBar 只负责展示。
      return groups.map((group) => {
        // 类型: string|number|undefined。
        // 作用: 读取当前筛选组已选值，缺失时由选项映射逻辑回退到 all。
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
     * 电影页主体卡片数据。
     * 来源: getBucketItems('movie')。
     * 执行内容: 通过 selector 从 movie.itemKeys 解析统一 ContentItem 列表，由 CatalogGrid 和 UserVideoCard 读取统一字段。
     * 纯函数: 只读取统一内容 store，不修改页面桶或实体池。
     *
     * @returns {Array<object>} 电影页 ContentItem 列表。
     */
    movies() {
      // 返回值类型: Array<object>。
      // 作用: 通过统一 selector 读取电影页内容，让页面不再直接感知 itemKeys 到实体池的解析过程。
      return getBucketItems('movie');
    },

    /**
     * 电影页分页数据。
     * 来源: getPagePagination('movie')。
     * 执行内容: 通过 selector 返回标准 PageBucket.pagination，不直接读取 store 内部结构。
     * 纯函数: 只读取统一内容 store，不修改分页对象或页面状态。
     *
     * @returns {object|null} 标准分页对象。
     */
    pagination() {
      // 返回值类型: object|null。
      // 作用: 通过统一 selector 读取电影页分页信息，让页面不再直接感知 PageBucket 结构。
      return getPagePagination('movie');
    },

    /**
     * 电影页是否需要显示筛选区。
     * 纯函数: 只读取 filters 长度，不修改页面或筛选状态。
     *
     * @returns {boolean} 有筛选组时返回 true。
     */
    hasFilters() {
      return this.filters.length > 0;
    },

    /**
     * 当前是否存在非默认筛选条件。
     * 纯函数: 只比较 selectedFilters 与默认常量，不修改任一对象。
     *
     * @returns {boolean} 任一筛选值偏离默认值时返回 true。
     */
    hasActiveFilters() {
      return Object.keys(DEFAULT_MOVIE_FILTER_SELECTION).some(filterName => {
        return this.selectedFilters[filterName] !== DEFAULT_MOVIE_FILTER_SELECTION[filterName];
      });
    },

    /**
     * 重置筛选按钮是否禁用。
     * 纯函数: 只读取 hasActiveFilters，不修改页面状态。
     *
     * @returns {boolean} 没有非默认筛选条件时返回 true。
     */
    isResetDisabled() {
      return !this.hasActiveFilters;
    },

    /**
     * 电影页是否存在分页对象。
     * 纯函数: 只读取 pagination 并转换为 Boolean，不修改分页状态。
     *
     * @returns {boolean} 存在分页对象时返回 true。
     */
    hasPagination() {
      return Boolean(this.pagination);
    },

    /**
     * 是否显示底部分页区。
     * 纯函数: 只读取标准 pagination 字段，不修改页面或 store。
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
   * 执行内容: 请求电影页统一内容数据桶。
   * 放置原因: 电影页数据请求不依赖 DOM，放在 created 可以让首屏数据尽早进入 store。
   * 副作用: 调用 loadInitialMoviePage 发起筛选与内容请求，并更新加载状态和两个运行态 store。
   *
   * @returns {void} 生命周期钩子不返回业务数据。
   */
  created() {
    // 执行内容: 首次进入电影页时并行请求筛选元数据和第一页内容列表。
    // 影响范围: 请求成功后电影筛选数据桶和电影内容数据桶会更新，页面通过 filterStore、getBucketItems('movie') 和 getPagePagination('movie') 读取。
    this.loadInitialMoviePage();
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     * 纯函数: 相同输入返回同一数组引用或新的空数组，不修改输入和外部状态。
     *
     * @param {*} value 可能来自电影页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      // 返回值类型: Array<object>。
      // 作用: 保证筛选栏和卡片列表始终接收数组，避免 v-for 或 length 读取异常。
      return Array.isArray(value) ? value : [];
    },

    /**
     * 创建电影页内容请求参数。
     * 纯函数: 只读取当前筛选状态和传入页码，不直接修改页面状态。
     *
     * @param {number} page 目标页码。
     * @returns {object} 电影页标准 SourceDataRequest。
     */
    createMoviePageRequest(page) {
      // 类型: number。
      // 作用: 目标页码为空或非法时回到第一页。
      const targetPage = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;

      // 返回值类型: object。
      // 作用: 组装电影页内容请求，让 provider 能按当前筛选状态过滤和排序候选内容。
      return {
        pageKey: 'movie',
        params: {
          page: targetPage,
          pageSize: MOVIE_PAGE_REQUEST.params.pageSize,
          genre: this.selectedFilters.genre,
          area: this.selectedFilters.area,
          year: this.selectedFilters.year,
          sort: this.selectedFilters.sort
        }
      };
    },

    /**
     * 请求电影页动态筛选元数据。
     * 副作用: 调用 sourceFilterService，并由 service 将 SourceFilterMetaResponse 写入 siteFilterStore。
     * 成功路径: movie 筛选桶采用标准 groups 后 Promise 完成。
     * 失败路径: service 或 Runtime 错误原样向调用方抛出，由上层初始化流程处理。
     *
     * @returns {Promise<void>} 电影页筛选元数据请求完成后结束。
     */
    async loadMovieFilterMeta() {
      // 异步调用: 请求电影页动态筛选元数据。
      // 成功结果: sourceFilterService 会把响应写入 siteFilterStore.pages.movie。
      await requestSourceFilterMeta({
        pageKey: 'movie'
      });
    },

    /**
     * 首次加载电影页。
     * 副作用: 并行请求动态筛选元数据和第一页电影内容列表。
     * 成功路径: 两个 store 都采用响应后关闭加载状态。
     * 失败路径: 保存统一错误文案并在 finally 关闭加载状态。
     *
     * @returns {Promise<void>} 初始化请求完成后结束。
     */
    async loadInitialMoviePage() {
      // 类型: boolean。
      // 作用: 首次进入电影页时显示页面级加载遮罩，避免筛选区和列表区先闪空态。
      this.loading = true;

      // 类型: string。
      // 作用: 首次加载前清空旧错误，避免上次失败信息残留。
      this.loadError = '';

      try {
        // 异步调用: 并行请求筛选元数据和第一页电影内容。
        // 成功结果: 筛选组写入筛选数据桶，内容列表写入电影内容数据桶，页面通过 selector 读取列表和分页。
        await Promise.all([
          this.loadMovieFilterMeta(),
          requestSourceData(this.createMoviePageRequest(1))
        ]);
      } catch (error) {
        // 类型: string。
        // 作用: 记录电影页初始化失败原因，当前阶段用于调试和页面级错误兜底。
        this.loadError = error && error.message ? error.message : '电影页初始化请求失败';
      } finally {
        // 类型: boolean。
        // 作用: 结束电影页初始化加载态，让页面展示筛选区和已有数据或空状态。
        this.loading = false;
      }
    },

    /**
     * 请求电影页统一内容数据桶。
     * 副作用: 调用 sourceDataService，并由 service 将 SourceDataResponse 写入 siteContentStore。
     * 成功路径: 电影页数据桶写入完成后关闭加载遮罩。
     * 失败路径: 捕获错误并写入 loadError，同时关闭加载遮罩，让页面进入当前已有数据或空态。
     *
     * @param {number} page 目标页码。
     * @returns {Promise<void>} 电影页数据桶请求完成后结束。
     */
    async loadMovieContent(page = 1) {
      // 类型: boolean。
      // 作用: 进入电影页数据刷新状态，驱动根容器显示 Element UI 加载遮罩。
      this.loading = true;

      // 类型: string。
      // 作用: 每次重新请求前清空旧错误，避免旧错误影响本次状态判断。
      this.loadError = '';

      try {
        // 异步调用: 请求电影页单列表数据桶。
        // 成功结果: sourceDataService 会把响应写入 movie 数据桶，页面通过 getBucketItems('movie') 和 getPagePagination('movie') 读取。
        await requestSourceData(this.createMoviePageRequest(page));
      } catch (error) {
        // 类型: string。
        // 作用: 记录电影页数据桶请求失败原因，当前阶段用于调试，不直接改变视觉布局。
        this.loadError = error && error.message ? error.message : '电影页内容数据请求失败';
      } finally {
        // 类型: boolean。
        // 作用: 结束电影页数据刷新状态，让页面展示 store 中已有数据或空状态。
        this.loading = false;
      }
    },

    /**
     * 处理电影页筛选项变化。
     * 副作用: 更新当前筛选状态，并重新请求第一页内容列表。
     * 成功路径: 合法筛选值采用后第一页内容请求完成。
     * 失败路径: 非法筛选组直接返回；内容请求失败由 loadMovieContent 收敛到 loadError。
     *
     * @param {object} payload 筛选组件派发的事件参数。
     * @param {string} payload.groupName 当前筛选组机器名。
     * @param {*} payload.optionValue 当前筛选项值。
     * @returns {Promise<void>} 目标筛选应用并刷新第一页内容后结束。
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
      await this.loadMovieContent(1);
    },

    /**
     * 重置电影页筛选。
     * 副作用: 恢复默认筛选状态，并重新请求第一页内容列表。
     * 成功路径: 非默认筛选恢复并完成第一页内容请求。
     * 失败路径: 已是默认状态时直接返回；内容请求失败由 loadMovieContent 收敛到 loadError。
     *
     * @returns {Promise<void>} 默认筛选恢复并刷新第一页内容后结束。
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
        ...DEFAULT_MOVIE_FILTER_SELECTION
      };

      // 执行内容: 重置筛选后重新请求第一页内容。
      await this.loadMovieContent(1);
    },

    /**
     * 处理电影页分页变化。
     * 副作用: 根据分页组件派发的目标页码重新请求内容列表。
     * 成功路径: 目标页内容请求完成。
     * 失败路径: 非法页码回到第一页；请求失败由 loadMovieContent 收敛到 loadError。
     *
     * @param {object} payload 分页组件派发的事件参数。
     * @param {number} payload.page 目标页码。
     * @returns {Promise<void>} 目标页内容请求完成后结束。
     */
    async handlePageChange(payload) {
      // 类型: number。
      // 作用: 从分页事件中读取目标页码，异常值时回到第一页。
      const targetPage = payload && Number.isFinite(Number(payload.page)) ? Number(payload.page) : 1;

      // 执行内容: 保持当前筛选状态不变，只请求目标页码内容。
      await this.loadMovieContent(targetPage);
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
  /* 目录页标题和筛选区之间保持 v4 一样的较大间距。 */
  margin-bottom: 24px;
}
</style>
