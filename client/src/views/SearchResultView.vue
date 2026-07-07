<template>
  <!--
    SearchResultView 页面渲染树

    {div.theme-page.search-result-view} [v-loading="loading"]
    ├─ {div.theme-page-header}
    │  └─ 搜索页标题区
    │     - 固定显示在搜索页顶部
    │     - [if submittedKeyword] 显示当前关键词和结果数量
    │     - [else] 提示用户通过顶部导航搜索框输入关键词
    │
    └─ {section.search-panel.theme-surface}
       └─ 搜索结果面板
          ├─ {div.search-status-line}
          │  └─ 显示当前关键词、页码、搜索源和源状态
          ├─ {CatalogGrid}
          │  └─ 读取 siteContentStore.pages.search.items 渲染搜索结果卡片；results 为空时显示主体空状态
          └─ [if shouldShowPagination] 分页分支
             └─ {CatalogPagination}
                - 当标准 pagination 存在且需要分页时显示底部分页状态
                - 分页保持居中展示，方便结果页从左到右浏览后在底部统一操作
  -->
  <!--
    搜索结果页。
    作用：展示搜索状态、结果列表和分页区域；关键词输入入口由顶部导航统一提供。
  -->
  <div class="theme-page search-result-view" v-loading="loading">
    <!--
      搜索页头部。
      渲染位置：页面最上方。
      数据来源：submittedKeyword 和 results。
      页面作用：让用户确认当前搜索词，以及当前结果列表数量。
    -->
    <div class="theme-page-header">
      <div>
        <h1 class="theme-page-title">搜索结果</h1>
        <p class="theme-page-desc" v-if="submittedKeyword">
          “{{ submittedKeyword }}” 当前返回 {{ resultCount }} 条结果
        </p>
        <p class="theme-page-desc" v-else>
          请在顶部搜索框输入关键词后查看结果
        </p>
      </div>
    </div>

    <!--
      [DEFAULT] ele(SourceSwitchTabs)
      - condition:
          默认渲染。
          搜索页标题区下方展示静态页面静态数据源 tab 区域。
      - type:
          自定义组件
          相对位置: ../components/source/SourceSwitchTabs.vue
      - description:
          搜索页顶部数据源静态 tab。
          展示当前版本可用数据源，并高亮默认选中的模拟源1数据源。
      - params:
          -- sourceTabs：搜索页可展示的数据源 tab 列表。
          -- activeSourceId：搜索页默认高亮的数据源 id。
      - events: 无
    -->
    <SourceSwitchTabs
      :sources="sourceTabs"
      :active-source-id="activeSourceId"
      aria-label="搜索页数据源"
    />

    <!--
        搜索结果面板。
      渲染位置：搜索页标题下方。
      使用数据：submittedKeyword、siteContentStore.pages.search.items、siteContentStore.pages.search.pagination。
      页面作用：集中展示当前搜索状态、主体结果网格和居中分页。
    -->
    <section class="search-panel theme-surface" aria-label="搜索结果内容">
      <!--
        搜索状态行。
        渲染位置：结果面板顶部。
        使用数据：displayKeyword、pageStatusText、sourceName、requestStatusText。
      -->
      <div class="search-status-line">
        <span>当前关键词：{{ displayKeyword }}</span>
        <span>{{ pageStatusText }}</span>
        <span>搜索源：{{ sourceName }}</span>
        <span>{{ requestStatusText }}</span>
      </div>

      <!--
        搜索结果主体区。
        CatalogGrid 内部负责根据 results 是否为空，自动切换卡片网格或主体空状态。
      -->
      <CatalogGrid
        :items="results"
        empty-title="暂无搜索结果"
        empty-text="当前关键词没有匹配内容。"
      />

      <!--
        搜索分页区。
        渲染条件：shouldShowPagination 为 true。
        CatalogPagination 当前保持居中布局，不回到靠右显示。
      -->
      <CatalogPagination v-if="shouldShowPagination" :pagination="pagination" />
    </section>
  </div>
</template>

<script>
/*
  SearchResultView script 模块说明

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      CatalogGrid: 自定义组件，渲染搜索页 ContentItem 卡片网格。
      CatalogPagination: 自定义组件，渲染标准 pagination 分页信息。
      SourceSwitchTabs: 自定义组件，渲染搜索页顶部数据源 tab。
      sourceSwitchData: 自定义数据，提供静态页面静态数据源 tab 列表。
      requestSourceData: 自定义服务，按 SourceDataRequest 请求搜索页数据桶。
      siteContentStore: 自定义 store，保存搜索页数据桶请求结果并提供页面读取入口。

  - 模块级常量:
      DEFAULT_SEARCH_PAGE_SIZE: number，搜索页默认每页数量。

  - 模块级辅助函数:
      无
*/

// 导入来源: ../components/catalog/CatalogGrid.vue。
// 导入内容: CatalogGrid 目录网格组件。
// 文件作用: 用于渲染搜索结果 ContentItem 卡片区域。
import CatalogGrid from '../components/catalog/CatalogGrid.vue';

// 导入来源: ../components/catalog/CatalogPagination.vue。
// 导入内容: CatalogPagination 目录分页组件。
// 文件作用: 用于渲染搜索结果页标准 pagination 分页状态。
import CatalogPagination from '../components/catalog/CatalogPagination.vue';

// 导入来源: ../components/source/SourceSwitchTabs.vue。
// 导入内容: SourceSwitchTabs 自定义组件。
// 文件作用: 用于在搜索页标题下方渲染静态页面静态数据源 tab。
import SourceSwitchTabs from '../components/source/SourceSwitchTabs.vue';

// 导入来源: ../data/source-switch.mock。
// 导入内容: sourceSwitchData 顶部数据源静态数据。
// 文件作用: 给搜索页 SourceSwitchTabs 提供数据源列表和默认高亮源。
import { sourceSwitchData } from '../data/source-switch.mock';

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 搜索页通过该函数请求 search 单列表数据桶。
import { requestSourceData } from '../services/sourceDataService.js';

// 导入来源: ../store/siteContentStore。
// 导入内容: siteContentStore 全站内容运行态 store。
// 文件作用: 搜索页从 siteContentStore.pages.search 读取 ContentItem 列表和标准 pagination。
import { siteContentStore } from '../store/siteContentStore.js';

// 类型: number。
// 作用: 搜索页默认每页数量，影响 SourceDataRequest.params.pageSize 和搜索结果分页。
const DEFAULT_SEARCH_PAGE_SIZE = 20;

export default {
  // 组件名称用于在调试工具和报错信息中识别搜索结果页。
  name: 'SearchResultView',

  // 注册搜索结果页当前使用的目录类组件。
  components: {
    // <CatalogGrid /> 对应搜索结果主体卡片区。
    CatalogGrid,

    // <CatalogPagination /> 对应搜索结果页底部分页区。
    CatalogPagination,

    // <SourceSwitchTabs /> 对应搜索页标题和搜索结果面板之间的数据源静态 tab 区域。
    SourceSwitchTabs
  },

  data() {
    return {
      // 类型: boolean。
      // 初始值: true，页面首次进入时显示加载遮罩，避免搜索数据桶尚未回填时闪过空态。
      // 作用: 控制搜索页根容器上的 Element UI 加载遮罩。
      // true: 搜索页正在请求统一内容数据桶。
      // false: 搜索页请求结束，展示结果、分页或空状态。
      loading: true,

      // 类型: string。
      // 初始值: 空字符串，表示搜索页尚未发生请求错误。
      // 作用: 保存搜索页统一数据流请求失败时的错误文案，当前版本展示在状态行中。
      loadError: '',

      // 类型: Array<object>。
      // 初始值: sourceSwitchData.sources。
      // 作用: 驱动搜索页顶部数据源静态 tab；静态页面只展示，不触发真实切换。
      sourceTabs: this.asList(sourceSwitchData.sources),

      // 类型: string。
      // 初始值: sourceSwitchData.activeSourceId。
      // 作用: 控制搜索页顶部数据源 tab 的默认高亮项；当前内容请求仍使用 mock provider 默认数据源。
      activeSourceId: sourceSwitchData.activeSourceId,

      // 类型: object。
      // 初始值: siteContentStore。
      // 作用: 保存全站内容运行态引用，搜索页 computed 从 pages.search 读取 items 和 pagination。
      contentStore: siteContentStore
    };
  },

  computed: {
    /**
     * 当前搜索关键词。
     *
     * 页面位置：标题区和搜索状态行。
     * 数据来源：读取 route.query.keyword。
     * 规则: 没有 query 时返回空字符串，不再使用旧 mock 默认关键词。
     *
     * @returns {string} 当前搜索页应该展示的关键词。
     */
    submittedKeyword() {
      // keyword query 是顶部搜索框提交后的正式路由入参来源。
      const routeKeyword = this.$route.query.keyword;

      // query 可能被浏览器或调用方构造成数组，这里只取第一个值作为当前搜索词。
      const normalizedKeyword = Array.isArray(routeKeyword)
        ? this.asText(routeKeyword[0]).trim()
        : this.asText(routeKeyword).trim();

      // 返回值类型: string。
      // 作用: URL 有有效关键词时展示关键词；没有关键词时返回空字符串。
      return normalizedKeyword;
    },

    /**
     * 页面状态行展示的关键词。
     *
     * @returns {string} 已提交关键词；没有关键词时返回占位文案。
     */
    displayKeyword() {
      // submittedKeyword 为空说明当前没有有效搜索词。
      if (!this.submittedKeyword) {
        return '暂无关键词';
      }

      // 有关键词时直接展示，标题区和状态行会保持一致。
      return this.submittedKeyword;
    },

    /**
     * 当前结果数量。
     *
     * @returns {number} 搜索结果数组长度。
     */
    resultCount() {
      // 返回值类型: number。
      // 作用: 结果数量直接来自统一搜索数据桶中的 ContentItem 数组长度。
      return this.results.length;
    },

    /**
     * 搜索结果主体卡片数据。
     * 来源: siteContentStore.pages.search.items。
     * 执行内容: 直接返回统一 ContentItem 列表，由 CatalogGrid 和 VideoCard 读取统一字段。
     *
     * @returns {Array<object>} 搜索页 ContentItem 列表。
     */
    results() {
      // 类型: object。
      // 作用: 读取统一内容 store 中搜索页单列表数据桶。
      const searchBucket = this.contentStore.pages.search;

      // 返回值类型: Array<object>。
      // 作用: 返回搜索页 ContentItem 列表，缺失时用空数组兜底。
      return searchBucket && Array.isArray(searchBucket.items) ? searchBucket.items : [];
    },

    /**
     * 搜索页分页数据。
     * 来源: siteContentStore.pages.search.pagination。
     * 执行内容: 返回标准 PageBucket.pagination，不再读取旧分页字段。
     *
     * @returns {object|null} 标准分页对象。
     */
    pagination() {
      // 类型: object。
      // 作用: 读取统一内容 store 中搜索页单列表数据桶。
      const searchBucket = this.contentStore.pages.search;

      // 返回值类型: object|null。
      // 作用: 返回标准 pagination；缺失时返回 null 让分页组件不渲染。
      return searchBucket && searchBucket.pagination ? searchBucket.pagination : null;
    },

    /**
     * 当前页码状态文案。
     *
     * @returns {string} 有分页时返回页码，没有分页时返回结果数量。
     */
    pageStatusText() {
      // pagination 不存在时，页面只展示当前结果数量。
      if (!this.pagination) {
        return `当前 ${this.resultCount} 条结果`;
      }

      // 类型: number。
      // 作用: 标准 pagination.page，展示搜索结果当前页码。
      const standardPage = Number(this.pagination.page || 1);

      // pagination 存在时，展示当前页和总页数，方便用户理解列表位置。
      return `第 ${standardPage} 页 / 共 ${this.pagination.totalPages} 页`;
    },

    /**
     * 当前搜索源名称。
     *
     * @returns {string} 搜索源名称或空状态文案。
     */
    sourceName() {
      // activeSource 存在时优先展示顶部静态 tab 的当前选中源名称。
      if (this.activeSource) {
        return this.activeSource.name || '未知搜索源';
      }

      // 返回值类型: string。
      // 作用: 没有选中源对象时展示稳定兜底文案。
      return '暂无搜索源';
    },

    /**
     * 当前搜索源状态说明。
     *
     * @returns {string} 搜索源状态说明文案。
     */
    requestStatusText() {
      // 条件分支: 当前正在请求搜索数据时进入。
      // 执行内容: 展示加载状态说明。
      if (this.loading) {
        return '正在读取搜索数据';
      }

      // 条件分支: 当前搜索请求发生错误时进入。
      // 执行内容: 展示错误说明，便于静态阶段排查。
      if (this.loadError) {
        return this.loadError;
      }

      // 返回值类型: string。
      // 作用: 搜索请求完成且无错误时展示稳定状态说明。
      return '搜索数据已更新';
    },

    /**
     * 当前顶部数据源 tab 默认选中的源对象。
     *
     * @returns {Object|null} 当前选中源对象；没有匹配项时返回 null。
     */
    activeSource() {
      // activeSourceId 为空时不做匹配，直接返回 null 让状态行走搜索源名称兜底。
      if (!this.activeSourceId) {
        return null;
      }

      // 返回值类型: Object|null。
      // 作用: 从 sourceTabs 中找到默认高亮源，用于搜索状态行展示当前源名称。
      return this.sourceTabs.find(source => source.id === this.activeSourceId) || null;
    },

    /**
     * 是否渲染分页栏。
     *
     * @returns {boolean} 标准 pagination 需要展示时返回 true。
     */
    shouldShowPagination() {
      // 条件分支: 没有标准 pagination 对象时进入。
      // 执行内容: 不渲染分页区。
      if (!this.pagination) {
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

  watch: {
    /**
     * 监听搜索关键词变化。
     * 执行时机: 组件首次创建后立即执行一次，后续同页面路由 query.keyword 改变时再次执行。
     * 执行内容: 按新关键词请求 search 数据桶。
     *
     * @param {string} nextKeyword 新搜索关键词。
     * @param {string} previousKeyword 旧搜索关键词。
     * @returns {void} watcher 只触发数据请求，不返回业务数据。
     */
    submittedKeyword: {
      immediate: true,
      handler(nextKeyword, previousKeyword) {
        // 条件分支: 非首次执行且关键词没有变化时进入。
        // 执行内容: 跳过重复请求，避免同一个关键词反复刷新搜索桶。
        if (previousKeyword !== undefined && nextKeyword === previousKeyword) {
          return;
        }

        // 执行内容: 根据当前关键词请求搜索页数据桶。
        this.loadSearchContent(nextKeyword);
      }
    }
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     *
     * 调用位置：data 初始化 results。
     * 页面影响：保证 CatalogGrid 永远收到数组，避免模板渲染时报错。
     *
     * @param {*} value 可能来自搜索页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      // 只有真正的数组才能作为结果列表使用。
      if (Array.isArray(value)) {
        return value;
      }

      // 非数组统一兜底为空数组，让页面进入主体空状态。
      return [];
    },

    /**
     * 把任意值整理成字符串。
     *
     * 调用位置：data 初始化 submittedKeyword。
     * 页面影响：保证标题区和状态行拿到稳定文本。
     *
     * @param {*} value 可能来自搜索页数据文件的文本值。
     * @returns {string} 字符串原样返回，其他值统一转为空字符串。
     */
    asText(value) {
      // 搜索词只能稳定展示字符串，所以这里先做类型保护。
      if (typeof value === 'string') {
        return value;
      }

      // 非字符串统一转为空，避免页面出现 undefined 或 null 文案。
      return '';
    },

    /**
     * 请求搜索页统一内容数据桶。
     * 副作用: 调用 sourceDataService，并由 service 将 SourceDataResponse 写入 siteContentStore。
     * 成功路径: 搜索页数据桶写入完成后关闭加载遮罩。
     * 失败路径: 捕获错误并写入 loadError，同时关闭加载遮罩，让页面进入当前已有数据或空态。
     *
     * @param {string} keyword 当前搜索关键词，来自 route.query.keyword。
     * @returns {Promise<void>} 搜索页数据桶请求完成后结束。
     */
    async loadSearchContent(keyword) {
      // 类型: boolean。
      // 作用: 进入搜索页数据刷新状态，驱动根容器显示 Element UI 加载遮罩。
      this.loading = true;

      // 类型: string。
      // 作用: 每次重新请求前清空旧错误，避免旧错误影响本次状态判断。
      this.loadError = '';

      try {
        // 异步调用: 请求搜索页单列表数据桶。
        // 成功结果: sourceDataService 会把响应写入 siteContentStore.pages.search。
        await requestSourceData({
          // 类型: string。
          // 作用: 请求搜索页单列表数据桶。
          pageKey: 'search',

          // 类型: object。
          // 作用: 搜索请求参数，keyword 为空时由 mock provider 返回默认候选内容。
          params: {
            // 类型: string。
            // 作用: 当前搜索关键词，来自顶部导航提交后的路由 query。
            keyword: this.asText(keyword).trim(),

            // 类型: number。
            // 作用: 搜索结果当前页码，当前版本固定请求第一页。
            page: 1,

            // 类型: number。
            // 作用: 搜索结果每页数量。
            pageSize: DEFAULT_SEARCH_PAGE_SIZE
          }
        });
      } catch (error) {
        // 类型: string。
        // 作用: 记录搜索页数据桶请求失败原因，当前版本用于状态行展示和调试。
        this.loadError = error && error.message ? error.message : '搜索页内容数据请求失败';
      } finally {
        // 类型: boolean。
        // 作用: 结束搜索页数据刷新状态，让页面展示 store 中已有数据或空状态。
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
/*
  搜索结果页最外层容器。
  对应 template 根节点 `.theme-page.search-result-view`。
  作用是在通用页面布局基础上，为搜索页顶部留出细微距离。
*/
.search-result-view {
  /* 顶部留白让页面标题和全局导航之间不显得太贴。 */
  padding-top: 8px;
}

/*
  搜索结果面板。
  对应 template 中 `.search-panel.theme-surface`。
  内部依次包含状态行、结果主体区和分页区。
*/
.search-panel {
  /*
    上左右内边距给状态行和结果网格留出空间。
    底部稍小，是因为分页组件自身还有上下间距。
  */
  padding: 18px 20px 8px;
}

/*
  搜索状态行。
  对应 template 中 `.search-status-line`。
  数据来源：displayKeyword、pageStatusText、sourceName、requestStatusText。
*/
.search-status-line {
  /* 使用 flex 横向排列多个状态片段。 */
  display: flex;

  /* 文字较长或屏幕较窄时允许换行，避免状态行溢出面板。 */
  flex-wrap: wrap;

  /* 控制多个状态片段之间的横向和换行间距。 */
  gap: 14px;

  /* 状态行和下方结果主体区之间拉开距离。 */
  margin-bottom: 10px;

  /* 状态文字属于辅助信息，字号小于卡片标题。 */
  font-size: 12px;

  /* 使用弱文字色，降低状态行相对结果卡片的视觉权重。 */
  color: var(--text-muted);
}

/*
  手机端搜索结果面板。
  触发条件：视口宽度不超过 640px。
  原因：手机宽度较窄，需要把更多空间留给结果卡片。
*/
@media (max-width: 640px) {
  .search-panel {
    /* 手机端收紧结果面板内边距，给卡片网格更多宽度。 */
    padding: 16px 14px 6px;
  }
}
</style>
