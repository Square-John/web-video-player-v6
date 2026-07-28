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
          │  └─ 读取 getBucketItems('search') 渲染搜索结果卡片；results 为空时显示主体空状态
          └─ [if shouldShowPagination] 分页分支
             └─ {CatalogPagination}
                - 当标准 pagination 存在且需要分页时显示底部分页状态
                - 分页保持居中展示，方便结果页从左到右浏览后在底部统一操作
                - change-page 事件会重新请求当前关键词对应页码的搜索结果
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
          搜索页标题区下方展示阶段一静态数据源 tab 区域。
      - type:
          自定义组件
          相对位置: ../components/source/SourceSwitchTabs.vue
      - description:
          搜索页顶部数据源静态 tab。
          展示当前阶段可用数据源，并高亮默认的“模拟数据源 01”。
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
      使用数据：submittedKeyword、getBucketItems('search')、getPagePagination('search')。
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
        change-page 事件由 handlePageChange 接收，按目标页码重新请求搜索页数据桶。
      -->
      <CatalogPagination
        v-if="shouldShowPagination"
        :pagination="pagination"
        @change-page="handlePageChange"
      />
    </section>
  </div>
</template>

<script>
/*
  SearchResultView.vue 模块说明

  - 文件职责:
      组织搜索关键词状态、静态数据源入口、结果网格和分页交互。
      通过共享 Runtime 对应的内容 service 请求搜索数据，并从统一内容 store 派生结果与分页。

  - 导入库及文件汇总(6 条，内置 0 条，第三方 0 条，自定义 6 条):
      CatalogGrid: 自定义组件，渲染搜索页 ContentItem 卡片网格。
      CatalogPagination: 自定义组件，渲染标准 pagination 分页信息。
      SourceSwitchTabs: 自定义组件，渲染搜索页顶部数据源 tab。
      sourceSwitchData: 自定义数据，提供阶段一静态数据源 tab 列表。
      requestSourceData: 自定义服务，按 SourceDataRequest 请求搜索页数据桶。
      getBucketItems/getPagePagination: 自定义 selector，提供搜索页内容列表和分页读取入口。

  - 模块级常量:
      DEFAULT_SEARCH_PAGE_SIZE: number，搜索页默认每页数量。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      SearchResultView: Vue component，搜索结果路由使用的页面组件。
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
// 文件作用: 用于在搜索页标题下方渲染阶段一静态数据源 tab。
import SourceSwitchTabs from '../components/source/SourceSwitchTabs.vue';

// 导入来源: ../data/source-switch.mock。
// 导入内容: sourceSwitchData 顶部数据源静态数据。
// 文件作用: 给搜索页 SourceSwitchTabs 提供数据源列表和默认高亮源。
import { sourceSwitchData } from '../data/source-switch.mock';

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 搜索页通过该函数请求 search 单列表数据桶。
import { requestSourceData } from '../services/sourceDataService.js';

import {
  // 导入来源: ../store/siteContentStore。
  // 导入内容: getBucketItems 列表桶 selector。
  // 文件作用: 搜索页通过 selector 从 search.itemKeys 解析完整 ContentItem 列表。
  getBucketItems,

  // 导入来源: ../store/siteContentStore。
  // 导入内容: getPagePagination 分页 selector。
  // 文件作用: 搜索页通过 selector 从 search 数据桶读取标准 pagination。
  getPagePagination
} from '../store/siteContentStore.js';

// 类型: number。
// 作用: 搜索页默认每页数量，当前统一分页规则每页展示 12 条搜索结果。
const DEFAULT_SEARCH_PAGE_SIZE = 12;

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

  /**
   * 创建搜索结果页组件响应式状态。
   * 纯函数: 只读取静态 sourceSwitchData 并返回新状态对象，不修改路由、store 或外部数据。
   *
   * @returns {object} 搜索结果页初始响应式状态。
   */
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
      // 作用: 保存搜索页统一数据流请求失败时的错误文案，当前阶段展示在状态行中。
      loadError: '',

      // 类型: Array<object>。
      // 初始值: sourceSwitchData.sources。
      // 作用: 驱动搜索页顶部数据源静态 tab；阶段一只展示，不触发真实切换。
      sourceTabs: this.asList(sourceSwitchData.sources),

      // 类型: string。
      // 初始值: sourceSwitchData.activeSourceId。
      // 作用: 控制搜索页顶部数据源 tab 的默认高亮项；省略 sourceId 的请求由共享 Runtime 解析 Repository 默认源。
      activeSourceId: sourceSwitchData.activeSourceId
    };
  },

  computed: {
    /**
     * 当前搜索关键词。
     * 纯函数: 只读取 route.query.keyword 并标准化文本，不修改路由或组件状态。
     *
     * 页面位置：标题区和搜索状态行。
     * 数据来源：读取 route.query.keyword。
     * 规则: 没有 query 时返回空字符串，不再使用旧 mock 默认关键词。
     *
     * @returns {string} 当前搜索页应该展示的关键词。
     */
    submittedKeyword() {
      // 类型: string|Array<string>|undefined。
      // 作用: 读取顶部搜索框提交后的正式路由关键词，供标题、状态行和内容请求共同使用。
      const routeKeyword = this.$route.query.keyword;

      // 类型: string。
      // 作用: 把字符串或数组 query 统一为清理空白后的单一搜索词。
      // 三目条件: routeKeyword 是否为数组。
      // true 分支: 只采用第一个 query 值；false 分支: 直接标准化当前值。
      const normalizedKeyword = Array.isArray(routeKeyword)
        ? this.asText(routeKeyword[0]).trim()
        : this.asText(routeKeyword).trim();

      // 返回值类型: string。
      // 作用: URL 有有效关键词时展示关键词；没有关键词时返回空字符串。
      return normalizedKeyword;
    },

    /**
     * 页面状态行展示的关键词。
     * 纯函数: 只读取 submittedKeyword，不修改组件或路由状态。
     *
     * @returns {string} 已提交关键词；没有关键词时返回占位文案。
     */
    displayKeyword() {
      // 条件分支: submittedKeyword 为空时进入。
      // 执行内容: 返回稳定占位文案，避免状态行展示空白。
      if (!this.submittedKeyword) {
        return '暂无关键词';
      }

      // 有关键词时直接展示，标题区和状态行会保持一致。
      return this.submittedKeyword;
    },

    /**
     * 当前结果数量。
     * 纯函数: 只读取 results 数组长度，不修改结果列表。
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
     * 来源: getBucketItems('search')。
     * 执行内容: 通过 selector 从 search.itemKeys 解析统一 ContentItem 列表，由 CatalogGrid 和 UserVideoCard 读取统一字段。
     * 纯函数: 只读取统一内容 store，不修改页面桶或实体池。
     *
     * @returns {Array<object>} 搜索页 ContentItem 列表。
     */
    results() {
      // 返回值类型: Array<object>。
      // 作用: 通过统一 selector 读取搜索页内容，让页面不再直接感知 itemKeys 到实体池的解析过程。
      return getBucketItems('search');
    },

    /**
     * 搜索页分页数据。
     * 来源: getPagePagination('search')。
     * 执行内容: 通过 selector 返回标准 PageBucket.pagination，不直接读取 store 内部结构。
     * 纯函数: 只读取统一内容 store，不修改分页对象或页面状态。
     *
     * @returns {object|null} 标准分页对象。
     */
    pagination() {
      // 返回值类型: object|null。
      // 作用: 通过统一 selector 读取搜索页分页信息，让页面不再直接感知 PageBucket 结构。
      return getPagePagination('search');
    },

    /**
     * 当前页码状态文案。
     * 纯函数: 只读取 pagination 与 resultCount 并生成展示文案，不修改页面状态。
     *
     * @returns {string} 有分页时返回页码，没有分页时返回结果数量。
     */
    pageStatusText() {
      // 条件分支: pagination 不存在时进入。
      // 执行内容: 只展示当前结果数量，不拼接不存在的页码。
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
     * 纯函数: 只读取 activeSource 并生成展示文案，不修改静态源列表。
     *
     * @returns {string} 搜索源名称或空状态文案。
     */
    sourceName() {
      // 条件分支: activeSource 存在时进入。
      // 执行内容: 返回当前静态 tab 的源名称，名称缺失时使用稳定兜底。
      if (this.activeSource) {
        return this.activeSource.name || '未知搜索源';
      }

      // 返回值类型: string。
      // 作用: 没有选中源对象时展示稳定兜底文案。
      return '暂无搜索源';
    },

    /**
     * 当前搜索源状态说明。
     * 纯函数: 只读取 loading 和 loadError 并生成状态文案，不修改请求状态。
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
     * 纯函数: 只按 activeSourceId 查询 sourceTabs，不修改源对象或数组。
     *
     * @returns {Object|null} 当前选中源对象；没有匹配项时返回 null。
     */
    activeSource() {
      // 条件分支: activeSourceId 为空时进入。
      // 执行内容: 返回 null，让 sourceName 使用“暂无搜索源”兜底。
      if (!this.activeSourceId) {
        return null;
      }

      // 返回值类型: Object|null。
      // 作用: 从 sourceTabs 中找到默认高亮源，用于搜索状态行展示当前源名称。
      return this.sourceTabs.find(source => source.id === this.activeSourceId) || null;
    },

    /**
     * 是否渲染分页栏。
     * 纯函数: 只读取标准 pagination 字段，不修改页面或 store。
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
     * 副作用: 关键词真实变化时调用 loadSearchContent，并由 service 更新搜索内容桶。
     *
     * @param {string} nextKeyword 新搜索关键词。
     * @param {string} previousKeyword 旧搜索关键词。
     * @returns {void} watcher 只触发数据请求，不返回业务数据。
     */
    submittedKeyword: {
      immediate: true,

      /**
       * 处理搜索关键词监听结果。
       * 副作用: 关键词真实变化时调用 loadSearchContent，并由 service 更新搜索内容桶。
       *
       * @param {string} nextKeyword 新搜索关键词。
       * @param {string|undefined} previousKeyword 旧搜索关键词；首次立即执行时为 undefined。
       * @returns {void} 监听器只触发异步加载，不返回业务数据。
       */
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
     * 纯函数: 相同输入返回同一数组引用或新的空数组，不修改输入和外部状态。
     *
     * 调用位置：data 初始化 results。
     * 页面影响：保证 CatalogGrid 永远收到数组，避免模板渲染时报错。
     *
     * @param {*} value 可能来自搜索页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      // 条件分支: value 是数组时进入。
      // 执行内容: 原样返回数组，供静态数据源 tab 或列表渲染使用。
      if (Array.isArray(value)) {
        return value;
      }

      // 非数组统一兜底为空数组，让页面进入主体空状态。
      return [];
    },

    /**
     * 把任意值整理成字符串。
     * 纯函数: 字符串原样返回，其他输入返回空字符串，不修改输入和外部状态。
     *
     * 调用位置：data 初始化 submittedKeyword。
     * 页面影响：保证标题区和状态行拿到稳定文本。
     *
     * @param {*} value 可能来自搜索页数据文件的文本值。
     * @returns {string} 字符串原样返回，其他值统一转为空字符串。
     */
    asText(value) {
      // 条件分支: value 是字符串时进入。
      // 执行内容: 原样返回文本，供关键词清理和页面展示使用。
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
     * @param {number} page 当前搜索页码，来自首次请求或 CatalogPagination 的 change-page 事件。
     * @returns {Promise<void>} 搜索页数据桶请求完成后结束。
     */
    async loadSearchContent(keyword, page = 1) {
      // 类型: boolean。
      // 作用: 进入搜索页数据刷新状态，驱动根容器显示 Element UI 加载遮罩。
      this.loading = true;

      // 类型: string。
      // 作用: 每次重新请求前清空旧错误，避免旧错误影响本次状态判断。
      this.loadError = '';

      try {
        // 类型: number。
        // 作用: 把外部传入页码转换成有效正整数，分页事件异常时回到第一页。
        const targetPage = Number.isFinite(Number(page)) && Number(page) > 0 ? Math.floor(Number(page)) : 1;

        // 异步调用: 请求搜索页单列表数据桶。
        // 成功结果: sourceDataService 会把响应写入 search 数据桶，页面通过 getBucketItems('search') 和 getPagePagination('search') 读取。
        await requestSourceData({
          // 类型: string。
          // 作用: 请求搜索页单列表数据桶。
          pageKey: 'search',

          // 类型: object。
          // 作用: 搜索请求参数，keyword 为空时由可信模拟 Provider 返回当前源默认候选内容。
          params: {
            // 类型: string。
            // 作用: 当前搜索关键词，来自顶部导航提交后的路由 query。
            keyword: this.asText(keyword).trim(),

            // 类型: number。
            // 作用: 搜索结果当前页码，首次搜索为第一页，分页切换时使用目标页码。
            page: targetPage,

            // 类型: number。
            // 作用: 搜索结果每页数量。
            pageSize: DEFAULT_SEARCH_PAGE_SIZE
          }
        });
      } catch (error) {
        // 类型: string。
        // 作用: 记录搜索页数据桶请求失败原因，当前阶段用于状态行展示和调试。
        this.loadError = error && error.message ? error.message : '搜索页内容数据请求失败';
      } finally {
        // 类型: boolean。
        // 作用: 结束搜索页数据刷新状态，让页面展示 store 中已有数据或空状态。
        this.loading = false;
      }
    },

    /**
     * 处理搜索结果分页切换。
     * 触发来源: CatalogPagination 的 change-page 事件。
     * 执行内容: 读取分页组件派发的目标页码，并复用 loadSearchContent 请求当前关键词的对应页。
     * 副作用: 调用 loadSearchContent 更新加载状态，并由 service 采用目标页搜索响应。
     * 成功路径: 当前关键词对应目标页内容请求完成。
     * 失败路径: 非法页码回到第一页；请求失败由 loadSearchContent 收敛到 loadError。
     *
     * @param {Object} payload 分页组件派发的事件参数。
     * @param {number} payload.page 用户希望切换到的目标页码。
     * @returns {Promise<void>} 目标页搜索数据请求完成后结束。
     */
    async handlePageChange(payload) {
      // 类型: number。
      // 作用: 从分页组件事件中读取目标页码，事件对象异常时回到第一页兜底。
      const targetPage = payload && Number.isFinite(Number(payload.page)) ? Number(payload.page) : 1;

      // 异步调用: 使用当前路由关键词请求目标页，保持搜索页分页和关键词入参一致。
      await this.loadSearchContent(this.submittedKeyword, targetPage);
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
