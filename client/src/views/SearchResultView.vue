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
          │  └─ 读取 results 渲染搜索结果卡片；results 为空时显示主体空状态
          └─ [if hasPagination] 分页分支
             └─ {CatalogPagination}
                - 当 pagination 存在时显示底部分页状态
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
      搜索结果面板。
      渲染位置：搜索页标题下方。
      使用数据：sourceStatus、submittedKeyword、results、pagination。
      页面作用：集中展示当前搜索状态、主体结果网格和居中分页。
    -->
    <section class="search-panel theme-surface" aria-label="搜索结果内容">
      <!--
        搜索状态行。
        渲染位置：结果面板顶部。
        使用数据：displayKeyword、currentPageStatusText、sourceName、sourceStatusText。
      -->
      <div class="search-status-line">
        <span>当前关键词：{{ displayKeyword }}</span>
        <span>{{ currentPageStatusText }}</span>
        <span>搜索源：{{ sourceName }}</span>
        <span>{{ sourceStatusText }}</span>
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
        渲染条件：pagination 存在。
        CatalogPagination 当前保持居中布局，不回到靠右显示。
      -->
      <CatalogPagination v-if="hasPagination" :pagination="pagination" />
    </section>
  </div>
</template>

<script>
// 目录网格组件，负责渲染搜索结果主体卡片区域。
import CatalogGrid from '../components/catalog/CatalogGrid.vue';

// 目录分页组件，负责渲染搜索结果页底部分页状态。
import CatalogPagination from '../components/catalog/CatalogPagination.vue';

// 搜索页页面数据，提供搜索词、搜索源状态、结果列表和分页字段。
import { searchPageData } from '../data/page-search.mock';

export default {
  // 组件名称用于在调试工具和报错信息中识别搜索结果页。
  name: 'SearchResultView',

  // 注册搜索结果页当前使用的目录类组件。
  components: {
    // <CatalogGrid /> 对应搜索结果主体卡片区。
    CatalogGrid,

    // <CatalogPagination /> 对应搜索结果页底部分页区。
    CatalogPagination
  },

  data() {
    return {
      // loading 控制根容器 v-loading，用于统一承接搜索页加载遮罩。
      loading: false,

      // submittedKeyword 表示当前搜索词，标题区和状态行都会读取它。
      submittedKeyword: this.asText(searchPageData.keyword),

      // sourceStatus 保存当前搜索源状态，渲染到结果面板顶部状态行。
      sourceStatus: this.asObjectOrNull(searchPageData.sourceStatus),

      // results 驱动搜索结果主体网格；数组为空时 CatalogGrid 显示主体空状态。
      results: this.asList(searchPageData.results),

      // pagination 驱动底部分页栏；为 null 时分页区域不渲染。
      pagination: this.asObjectOrNull(searchPageData.pagination)
    };
  },

  computed: {
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
      return this.results.length;
    },

    /**
     * 当前页码状态文案。
     *
     * @returns {string} 有分页时返回页码，没有分页时返回结果数量。
     */
    currentPageStatusText() {
      // pagination 不存在时，页面只展示当前结果数量。
      if (!this.pagination) {
        return `当前 ${this.resultCount} 条结果`;
      }

      // pagination 存在时，展示当前页和总页数，方便用户理解列表位置。
      return `第 ${this.pagination.currentPage} 页 / 共 ${this.pagination.totalPages} 页`;
    },

    /**
     * 当前搜索源名称。
     *
     * @returns {string} 搜索源名称或空状态文案。
     */
    sourceName() {
      // 没有源状态时，说明当前页面还没有可展示的搜索源。
      if (!this.sourceStatus) {
        return '暂无搜索源';
      }

      // 优先展示 sourceName，因为它是用户最容易理解的源名称。
      return this.sourceStatus.sourceName || '未知搜索源';
    },

    /**
     * 当前搜索源状态说明。
     *
     * @returns {string} 搜索源状态说明文案。
     */
    sourceStatusText() {
      // 没有 sourceStatus 时，不显示具体请求状态。
      if (!this.sourceStatus) {
        return '未读取源状态';
      }

      // message 是给用户看的状态说明，比 status 这种机器字段更适合直接展示。
      return this.sourceStatus.message || this.sourceStatus.status || '搜索源状态未知';
    },

    /**
     * 是否渲染分页栏。
     *
     * @returns {boolean} pagination 有值时返回 true。
     */
    hasPagination() {
      return Boolean(this.pagination);
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
     * 把对象数据整理成对象或 null。
     *
     * 调用位置：data 初始化 sourceStatus 和 pagination。
     * 页面影响：保证状态行和分页区只消费结构正确的对象。
     *
     * @param {*} value 可能来自搜索页数据文件的对象值。
     * @returns {Object|null} 有效对象原样返回，其他值统一转成 null。
     */
    asObjectOrNull(value) {
      // 空值、非对象和数组都不能作为普通配置对象使用。
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }

      // 结构有效时原样返回，保留数据文件中定义的字段。
      return value;
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
  数据来源：displayKeyword、currentPageStatusText、sourceName、sourceStatusText。
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
