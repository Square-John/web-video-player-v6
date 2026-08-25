<template>
  <!--
    SearchResultView 页面渲染树

    [DEFAULT] ele(div.theme-page.search-result-view)
    │  - condition: 搜索结果路由挂载时默认渲染。
    │  - type: 原生标签 div。
    │  - description: 承载搜索请求反馈、结果面板和加载遮罩。
    │  - params: -- pageRequestState.isBlockingLoading：首次没有可见搜索结果且请求正在进行。
    │  - events: 无
    ├─ [IF PageRequestStatePanel.isVisible] ele(PageRequestStatePanel)
    │  - condition: 有效搜索请求失败或阻塞加载时渲染。
    │  - type: 自定义组件 ../components/common/PageRequestStatePanel.vue。
    │  - description: 展示统一请求反馈并按当前完整 URL 重试。
    │  - params: -- state：search PageBucket 事务投影。
    │  - events: @retry -> retrySearchContent()。
    └─ [IF shouldShowSearchPanel] ele(section.search-panel)
       │  - condition: 空关键词、成功结果、成功空态或同源刷新仍有可见内容时渲染。
       │  - type: 原生标签 section。
       │  - description: 以无面板页面区组合搜索结果网格和分页；失败与阻塞加载不渲染空壳。
       │  - params: -- results/pagination：搜索桶派生数据。
       │  - events: 分页事件由子节点处理。
       ├─ [IF shouldShowCatalogGrid] ele(CatalogGrid)
       │  - condition: 空关键词引导、成功内容或成功空结果时渲染。
       │  - type: 自定义组件 ../components/catalog/CatalogGrid.vue。
       │  - description: 渲染标准搜索结果卡片。
       │  - params: -- items：results；-- emptyTitle/emptyText：搜索空态说明。
       │  - events: 无
       └─ [IF shouldShowPagination] ele(CatalogPagination)
          - condition: 搜索结果存在有效翻页能力时渲染。
          - type: 自定义组件 ../components/catalog/CatalogPagination.vue。
          - description: 展示标准分页并提交目标页码。
          - params: -- pagination：search 桶分页。
          - events: @change-page -> handlePageChange。
  -->
  <!--
    [DEFAULT] ele(div.theme-page.search-result-view)
    - condition: 搜索结果路由挂载时默认渲染。
    - type: 原生标签 div。
    - description: 展示搜索请求反馈、结果列表和分页；关键词输入仍由顶部导航提供。
    - params: -- pageRequestState.isBlockingLoading：只有首次无结果加载才启用根遮罩。
    - events: 无
  -->
  <div class="theme-page search-result-view" v-loading="pageRequestState.isBlockingLoading">
    <!--
      [IF PageRequestStatePanel.isVisible] ele(PageRequestStatePanel)
      - condition: 有效关键词搜索失败，或首次搜索尚无可见结果时渲染。
      - type: 自定义组件，相对位置 ../components/common/PageRequestStatePanel.vue。
      - description: 展示搜索请求加载、错误和按当前关键词/页码原位重试入口。
      - params: -- state：search PageBucket 唯一事务投影；-- loadingText/errorTitle：搜索用户文案。
      - events: @retry -> retrySearchContent()，复用当前完整搜索 URL。
    -->
    <PageRequestStatePanel
      :state="pageRequestState"
      loading-text="正在读取搜索结果"
      error-title="搜索请求失败"
      @retry="retrySearchContent"
    />

    <!--
      [IF shouldShowSearchPanel] ele(section.search-panel)
      - condition: 空关键词、成功结果、成功空态或同源刷新仍有可见内容时渲染；失败与阻塞加载不渲染空壳。
      - type: 原生标签 section。
      - description: 在页面内容层直接展示主体结果网格和居中分页；不使用整页卡片制造少量结果空白面板。
      - params: -- results/pagination：search 数据桶派生值。
      - events: 子分页 change-page 事件由 handlePageChange 处理。
    -->
    <section v-if="shouldShowSearchPanel" class="search-panel" aria-label="搜索结果内容">
      <!--
        [IF shouldShowCatalogGrid] ele(CatalogGrid)
        - condition: 空关键词引导、成功内容或成功空结果时渲染；失败与阻塞加载由反馈组件承接。
        - type: 自定义组件 ../components/catalog/CatalogGrid.vue。
        - description: 渲染 search 数据桶中的标准 ContentItem 卡片。
        - params: -- items：results；-- emptyTitle/emptyText：搜索空态说明。
        - events: 无
      -->
      <CatalogGrid
        v-if="shouldShowCatalogGrid"
        :items="results"
        :navigation-target-factory="createResultNavigationTarget"
        :empty-title="emptyStateTitle"
        :empty-text="emptyStateText"
      />

      <!--
        [IF shouldShowPagination] ele(CatalogPagination)
        - condition: 标准搜索分页存在多页、上一页或下一页能力时渲染。
        - type: 自定义组件 ../components/catalog/CatalogPagination.vue。
        - description: 居中展示搜索分页，并保持当前关键词请求目标页。
        - params: -- pagination：getPagePagination('search') 返回的标准对象。
        - events: @change-page -> handlePageChange。
      -->
      <CatalogPagination
        v-if="shouldShowPagination"
        :pagination="pagination"
        :disabled="pageRequestState.loading"
        @change-page="handlePageChange"
      />
    </section>
  </div>
</template>

<script>
/*
  SearchResultView.vue 模块说明

  - 文件职责:
      组织搜索关键词状态、全局活动源变化消费、结果网格和分页交互。
      通过共享 Runtime 对应的内容 service 请求搜索数据，并从统一内容 store 派生结果与分页。

  - 导入库及文件汇总(9 条，内置 0 条，第三方 0 条，自定义 9 条):
      CatalogGrid: 自定义组件，渲染搜索页 ContentItem 卡片网格。
      CatalogPagination: 自定义组件，渲染标准 pagination 分页信息。
      createPageSourceSwitchConsumerMixin: 自定义生命周期工厂，只在搜索页活动时消费全局切源。
      PageRequestStatePanel: 自定义组件，展示搜索加载、失败和原位重试。
      requestSourceData: 自定义服务，按 SourceDataRequest 请求搜索页数据桶。
      getBucketItems/getPagePagination/getPageRequestTransaction: 自定义 selector，提供搜索结果、分页和唯一事务读取入口。
      routeRequestState: 自定义路由请求适配器，把关键词、页码和 KeepAlive 请求身份统一绑定到 URL。
      userContentRecoveryService exports: 自定义恢复门面，读取记录键并为搜索结果生成详情目标。
      pageRequestStateSelectors exports: 自定义 selector，把 search 事务投影为统一页面状态。

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

// 导入来源: ../mixins/createPageSourceSwitchConsumerMixin.js。
// 导入内容: createPageSourceSwitchConsumerMixin 活动源变化消费工厂。
// 文件作用: 只在搜索页可见时调用既有关键词重载入口，隐藏 KeepAlive 页面返回后再补刷新。
import { createPageSourceSwitchConsumerMixin } from '../mixins/createPageSourceSwitchConsumerMixin.js';

// 导入来源: ../components/common/PageRequestStatePanel.vue。
// 导入内容: PageRequestStatePanel 统一页面请求反馈组件。
// 文件作用: 用于展示有效搜索的加载、失败和按当前完整 URL 原位重试。
import PageRequestStatePanel from '../components/common/PageRequestStatePanel.vue';

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
  getPagePagination,

  // 导入来源: ../store/siteContentStore。
  // 导入内容: getPageRequestTransaction 请求事务 selector。
  // 文件作用: 搜索页从唯一 search 事务派生加载、失败和当前请求源。
  getPageRequestTransaction
} from '../store/siteContentStore.js';

import {
  // 导入来源: ../router/routeRequestState.js。
  // 导入内容: createRouteRequestGuard KeepAlive 请求身份守卫。
  // 文件作用: 阻止搜索页失活实例响应其他页面路由变化。
  createRouteRequestGuard,
  // 导入来源: ../router/routeRequestState.js。
  // 导入内容: createSearchRouteQuery 搜索 query 构造函数。
  // 文件作用: 把关键词和页码写入 Router，作为刷新后请求事实。
  createSearchRouteQuery,
  // 导入来源: ../router/routeRequestState.js。
  // 导入内容: createSearchRouteState 搜索 query 解析函数。
  // 文件作用: 从当前 URL 恢复搜索关键词和页码。
  createSearchRouteState
} from '../router/routeRequestState.js';

import {
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: getUserContentRecoveryContext；文件作用: 从当前 query 读取仍存在的用户恢复记录。
  getUserContentRecoveryContext,
  // 导入来源: ../services/userContentRecoveryService.js；导入内容: createUserContentRecoveryDetailTarget；文件作用: 搜索结果进入详情时保留恢复键。
  createUserContentRecoveryDetailTarget
} from '../services/userContentRecoveryService.js';

import {
  // 导入来源: ../selectors/pageRequestStateSelectors.js；导入内容: createPageRequestViewState；文件作用: 把 search 事务和可见结果数量转换为统一展示状态。
  createPageRequestViewState,
  // 导入来源: ../selectors/pageRequestStateSelectors.js；导入内容: PAGE_REQUEST_VIEW_STATUS；文件作用: 使用正式状态枚举控制搜索空态与状态文案。
  PAGE_REQUEST_VIEW_STATUS
} from '../selectors/pageRequestStateSelectors.js';

// 类型: number。
// 作用: 搜索页默认每页数量，当前统一分页规则每页展示 12 条搜索结果。
const DEFAULT_SEARCH_PAGE_SIZE = 12;

export default {
  // 组件名称用于在调试工具和报错信息中识别搜索结果页。
  name: 'SearchResultView',

  // 类型: Array<object>；作用: 接入搜索页专属 KeepAlive 切源消费生命周期，不建立第二活动源状态。
  mixins: [createPageSourceSwitchConsumerMixin('search')],

  // 注册搜索结果页当前使用的目录类组件。
  components: {
    // <CatalogGrid /> 对应搜索结果主体卡片区。
    CatalogGrid,

    // <CatalogPagination /> 对应搜索结果页底部分页区。
    CatalogPagination,

    // <PageRequestStatePanel /> 对应搜索标题下方的请求反馈区域。
    PageRequestStatePanel
  },

  computed: {
    /**
     * 当前搜索页跨源恢复上下文。
     * 纯函数: 只读取 route.query 和 userContentStore selector；无效或记录已删除时返回 null。
     *
     * @returns {object|null} 收藏或历史恢复上下文。
     */
    recoveryContext() {
      return getUserContentRecoveryContext(this.$route.query);
    },

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
     * 当前搜索页 URL 请求页码。
     * 纯函数: 只解析 route.query，不修改 Router、组件状态或内容 Store。
     *
     * @returns {number} 当前搜索请求页码。
     */
    requestedPage() {
      // 类型: number；作用: 刷新和浏览器前进/后退时恢复同一搜索结果页码。
      return createSearchRouteState(this.$route.query).page;
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
      // 条件分支: 当前路由没有规范化后的非空关键词时进入。
      // 执行内容: 隐藏仍保存在会话桶中的旧结果，让返回原搜索 URL 时可以恢复但不污染空搜索页。
      if (!this.submittedKeyword) {
        return [];
      }

      // 返回值类型: Array<object>。
      // 作用: 通过统一 selector 读取搜索页内容，让页面不再直接感知 itemKeys 到实体池的解析过程。
      return getBucketItems('search');
    },

    /**
     * 读取搜索页唯一请求事务。
     * 来源: getPageRequestTransaction('search') 返回的隔离快照。
     * 纯函数: 只读取 Store，不修改事务或建立页面请求代次副本。
     *
     * @returns {object|null} search PageBucket 最新请求事务。
     */
    requestTransaction() {
      return getPageRequestTransaction('search');
    },

    /**
     * 创建搜索页统一请求展示状态。
     * 来源: 当前 URL 是否具有非空关键词、requestTransaction 和 results 可见数量。
     * 纯函数: 只调用公共状态选择器；空关键词显式投影为 idle 并屏蔽旧搜索桶状态。
     *
     * @returns {Readonly<object>} 搜索页 idle、loading、ready、empty 或 error 投影。
     */
    pageRequestState() {
      return createPageRequestViewState({
        requestEntries: [{ key: 'search', transaction: this.requestTransaction }],
        visibleItemCount: this.results.length,
        hasRequestIntent: Boolean(this.submittedKeyword),
        fallbackErrorMessage: '搜索请求失败，请检查网络或数据源后重试。'
      });
    },

    /**
     * 判断搜索结果面板是否应挂载。
     * 纯函数: 只读取关键词和统一请求状态，不修改结果、分页或页面事务。
     * 显示规则: 空关键词、成功内容和成功空结果正常展示；同源刷新有旧内容时保留网格；失败和阻塞加载由反馈组件独占。
     *
     * @returns {boolean} true 渲染结果面板，false 隐藏空壳和重复反馈。
     */
    shouldShowSearchPanel() {
      // 条件分支: 当前 URL 没有有效关键词时进入；执行内容: 保留等待搜索的引导面板。
      if (!this.submittedKeyword) return true;
      // 条件分支: 当前搜索已成功返回内容或业务空结果时进入；执行内容: 渲染结果或正式空态面板。
      if (this.pageRequestState.status === PAGE_REQUEST_VIEW_STATUS.ready
        || this.pageRequestState.status === PAGE_REQUEST_VIEW_STATUS.empty) return true;
      // 类型: boolean；作用: 只有刷新加载或同源失败仍有最后成功结果时继续挂载面板，其它未知状态失败关闭。
      const canRetainVisibleContent = this.pageRequestState.status === PAGE_REQUEST_VIEW_STATUS.loading
        || this.pageRequestState.status === PAGE_REQUEST_VIEW_STATUS.error;
      // 返回值类型: boolean；作用: loading/error 与可见内容必须同时成立，阻止阻塞请求或未来状态渲染空壳。
      return canRetainVisibleContent && this.pageRequestState.hasVisibleContent;
    },

    /**
     * 判断搜索结果网格是否应渲染。
     * 纯函数: 只读取关键词和统一请求状态，不修改页面或 Store。
     * 显示规则: 空关键词显示输入引导；成功内容或成功空结果显示网格；阻塞加载和失败由反馈组件承接。
     *
     * @returns {boolean} true 渲染搜索网格，false 隐藏会误报的业务空态。
     */
    shouldShowCatalogGrid() {
      return !this.submittedKeyword
        || this.pageRequestState.hasVisibleContent
        || this.pageRequestState.status === PAGE_REQUEST_VIEW_STATUS.empty;
    },

    /**
     * 搜索结果网格空态标题。
     * 纯函数: 只根据当前关键词生成用户文案，不修改路由或结果。
     *
     * @returns {string} 空关键词引导标题或成功搜索空结果标题。
     */
    emptyStateTitle() {
      return this.submittedKeyword ? '暂无搜索结果' : '等待搜索';
    },

    /**
     * 搜索结果网格空态说明。
     * 纯函数: 只根据当前关键词生成用户文案，不修改路由或结果。
     *
     * @returns {string} 空关键词操作引导或成功搜索空结果说明。
     */
    emptyStateText() {
      return this.submittedKeyword
        ? '当前关键词没有匹配内容。'
        : '请在顶部搜索框输入关键词。';
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
      // 条件分支: 当前路由没有有效关键词时进入。
      // 执行内容: 隐藏旧搜索桶分页，避免空搜索页出现与当前 URL 无关的页码和翻页入口。
      if (!this.submittedKeyword) {
        return null;
      }

      // 条件分支: 当前事务把最后成功桶标记为 stale 时进入。
      // 执行内容: 隐藏旧分页，避免加载新源或失败时仍显示无关页码和可操作入口。
      if (this.requestTransaction?.stale === true) {
        return null;
      }

      // 返回值类型: object|null。
      // 作用: 通过统一 selector 读取搜索页分页信息，让页面不再直接感知 PageBucket 结构。
      return getPagePagination('search');
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
      if (!this.pagination || !this.pageRequestState.hasVisibleContent) {
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
   * 副作用: 创建当前搜索页请求守卫，并仅在首次 URL 含有效关键词时请求对应页码。
   * 成功路径: 页面首次创建或浏览器刷新时重放有效搜索 URL；空 URL 保持本地引导空态。
   * 失败路径: 请求错误由 search PageBucket.transaction 收敛，守卫仍保留当前地址身份。
   *
   * @returns {void} 生命周期只触发异步加载，不返回业务数据。
   */
  created() {
    // 类型: Readonly<object>；作用: 当前 SearchResultView 实例独享的路由请求身份守卫。
    this._routeRequestGuard = createRouteRequestGuard({ routeNames: ['search'] });
    // 副作用: 把首次 URL 标记为已处理，返回同一 KeepAlive 地址时不重复请求。
    this._routeRequestGuard.markHandled(this.$route);
    // 异步调用: 按当前 URL 关键词和页码重放搜索请求。
    this.loadSearchContent(this.submittedKeyword, this.requestedPage);
  },

  watch: {
    /**
     * 监听搜索页完整请求 URL。
     * 触发来源: 顶部搜索提交、分页、浏览器前进/后退或其他代码修改 search query。
     * 副作用: 只有当前 SearchResultView 负责的新 fullPath 才请求；失活 KeepAlive 实例直接跳过。
     * 失败路径: 非本页路由或已处理地址不产生请求。
     *
     * @returns {void} 守卫判断完成后结束。
     */
    '$route.fullPath'() {
      // 条件分支: 当前 fullPath 不属于本页面或已经处理过时进入。
      // 执行内容: 阻止缓存搜索页响应其他页面路由变化。
      if (!this._routeRequestGuard || !this._routeRequestGuard.shouldHandle(this.$route)) {
        return;
      }

      // 异步调用: 按新 URL 的关键词和页码请求搜索内容。
      this.loadSearchContent(this.submittedKeyword, this.requestedPage);
    }
  },

  methods: {
    /**
     * 为搜索结果生成可选详情导航目标。
     * 纯函数: 普通搜索返回 null；恢复搜索只携带替代内容身份和稳定恢复键。
     *
     * @param {object} contentItem 当前搜索结果标准 ContentItem。
     * @returns {object|null} Vue Router 详情目标或 null。
     */
    createResultNavigationTarget(contentItem) {
      return createUserContentRecoveryDetailTarget(contentItem, this.recoveryContext);
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
     * 副作用: 非空关键词时调用 sourceDataService，并由 service 将 SourceDataResponse 写入 siteContentStore。
     * 成功路径: 有效搜索响应和 success 事务一次采用；空关键词不发请求并由状态 selector 投影为引导 idle。
     * 失败路径: sourceDataService 把 search 事务收敛为 error/stale；页面不保存请求代次或错误副本。
     *
     * @param {string} keyword 当前搜索关键词，来自 route.query.keyword。
     * @param {number} page 当前搜索页码，来自首次请求或 CatalogPagination 的 change-page 事件。
     * @returns {Promise<void>} 搜索页数据桶请求完成后结束。
     */
    async loadSearchContent(keyword, page = 1) {
      // 类型: string。
      // 作用: 在页面请求边界统一清理关键词；只有非空结果才允许进入 Provider 请求链。
      const normalizedKeyword = this.asText(keyword).trim();
      // 条件分支: 路由关键词为空或只包含空白时进入。
      // 执行内容: 停止请求并保留 Store 搜索桶；当前页面由 hasRequestIntent=false 屏蔽旧事务和内容。
      if (!normalizedKeyword) {
        return;
      }

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
          // 作用: 搜索请求参数；页面门禁已保证 keyword 是非空规范文本。
          params: {
            // 类型: string。
            // 作用: 当前搜索关键词，来自顶部导航提交后的路由 query。
            keyword: normalizedKeyword,

            // 类型: number。
            // 作用: 搜索结果当前页码，首次搜索为第一页，分页切换时使用目标页码。
            page: targetPage,

            // 类型: number。
            // 作用: 搜索结果每页数量。
            pageSize: DEFAULT_SEARCH_PAGE_SIZE
          }
        });
      } catch (error) {
        // 失败收敛: sourceDataService 已按最新 requestId 写入 search PageBucket.error/stale；页面不复制错误。
        return;
      }
    },

    /**
     * 按当前搜索 URL 原位重试关键词和页码。
     * 触发来源: PageRequestStatePanel 的 retry 事件。
     * 副作用: 复用 submittedKeyword、requestedPage 和统一 requestSourceData，不修改 URL 或活动源。
     * 成功路径: 当前 search PageBucket 采用最新结果并转为 ready 或 empty。
     * 失败路径: 同一事务继续显示安全错误和重试入口。
     *
     * @returns {Promise<void>} 当前搜索重试收敛后结束。
     */
    async retrySearchContent() {
      await this.loadSearchContent(this.submittedKeyword, this.requestedPage);
    },

    /**
     * 在活动源真实切换成功后按当前关键词重载搜索第一页。
     * 触发来源: 全局 Manager 活动源变化由搜索页 KeepAlive 切源响应 mixin 消费；隐藏时不会触发。
     * 副作用: 调用 loadSearchContent，由内容 service 按新 Manager activeSourceId 提交搜索桶唯一事务。
     * 成功路径: 保留 route.query.keyword，只把分页恢复为第一页并采用新源结果。
     * 失败路径: search PageBucket 保存安全错误且隐藏 stale 旧结果，不改写 Manager 切换状态。
     *
     * @returns {Promise<void>} 当前关键词的新源第一页搜索请求收敛后结束。
     */
    async handleSourceSwitched() {
      // 类型: object；作用: 切换数据源后生成当前关键词第一页的目标 URL，清除旧页码残留。
      const targetLocation = {
        name: 'search',
        query: createSearchRouteQuery({
          baseQuery: this.$route.query,
          keyword: this.submittedKeyword,
          page: 1
        })
      };
      // 类型: string；作用: 比较目标 URL 与当前请求事实，决定是否由 watcher 触发内容刷新。
      const targetFullPath = this.$router.resolve(targetLocation).route.fullPath;

      // 条件分支: 当前页码需要重置时进入；执行内容: 由路由守卫按新 URL 请求第一页。
      if (targetFullPath !== this.$route.fullPath) {
        await this.$router.replace(targetLocation);
        return;
      }

      // 异步调用: 当前 URL 未变化时直接按当前关键词请求第一页，避免等待不会触发的 watcher。
      await this.loadSearchContent(this.submittedKeyword, 1);
    },

    /**
     * 处理搜索结果分页切换。
     * 触发来源: CatalogPagination 的 change-page 事件。
     * 执行内容: 读取分页组件派发的目标页码，并复用 loadSearchContent 请求当前关键词的对应页。
     * 副作用: 更新搜索 URL，由 watcher 和 service 采用目标页搜索响应与唯一事务。
     * 成功路径: 当前关键词对应目标页内容请求完成。
     * 失败路径: 非法页码回到第一页；请求失败由 search PageBucket.transaction 收敛。
     *
     * @param {Object} payload 分页组件派发的事件参数。
     * @param {number} payload.page 用户希望切换到的目标页码。
     * @returns {Promise<void>} 目标页搜索数据请求完成后结束。
     */
    async handlePageChange(payload) {
      // 类型: number。
      // 作用: 从分页组件事件中读取目标页码，事件对象异常时回到第一页兜底。
      const targetPage = payload && Number.isFinite(Number(payload.page)) ? Number(payload.page) : 1;

      // 异步导航: 只改写搜索页 URL 页码，watcher 负责请求目标页并保持关键词一致。
      await this.$router.push({
        name: 'search',
        query: createSearchRouteQuery({
          baseQuery: this.$route.query,
          keyword: this.submittedKeyword,
          page: targetPage
        })
      });
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

</style>
