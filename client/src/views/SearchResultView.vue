<template>
  <!--
    SearchResultView 页面渲染树

    {div.search-result-view}
    ├─ {header.search-result-view__header}
    │  ├─ {p.search-result-view__eyebrow} 页面短标签
    │  ├─ {h1.search-result-view__title} 页面标题
    │  └─ {p.search-result-view__summary} 页面说明
    ├─ {section.search-result-view__search-panel}
    │  ├─ {label.search-result-view__label} 搜索框标签
    │  ├─ {div.search-result-view__search-row}
    │  │  ├─ {input.search-result-view__input} 输入 keyword
    │  │  └─ {button.search-result-view__button} 点击后调用 submitSearch
    │  └─ {p.search-result-view__hint} 搜索说明
    ├─ {section.search-result-view__status-panel}
    │  ├─ {div.search-result-view__status-card} 当前关键词
    │  ├─ {div.search-result-view__status-card} 当前结果数量
    │  └─ {div.search-result-view__status-card} 当前搜索源状态
    ├─ {CatalogGrid}
    │  └─ 读取 results，渲染搜索结果卡片网格；results 为空时显示主体空状态
    └─ [if hasPagination]
       └─ {CatalogPagination}
          └─ 读取 pagination，渲染底部分页；pagination 为空时本区域不渲染
  -->
  <!--
    搜索结果页。
    作用：组织搜索输入、搜索状态、结果列表和分页区域。
  -->
  <div class="search-result-view">
    <!-- 页面头部，告诉用户当前正在浏览搜索结果页面。 -->
    <header class="search-result-view__header">
      <p class="search-result-view__eyebrow">Search</p>
      <h1 class="search-result-view__title">搜索</h1>
      <p class="search-result-view__summary">
        输入关键词后查看匹配内容，后续会接入真实数据源搜索流程。
      </p>
    </header>

    <!-- 搜索输入区，当前先保留页面交互形态。 -->
    <section class="search-result-view__search-panel" aria-label="搜索输入区">
      <!-- 搜索框标签，说明输入框用途。 -->
      <label class="search-result-view__label" for="search-keyword">关键词</label>

      <!-- 搜索输入和提交按钮保持在同一行，方便用户快速操作。 -->
      <div class="search-result-view__search-row">
        <!-- keyword 驱动搜索框内容，也会在状态区显示当前关键词。 -->
        <input
          id="search-keyword"
          v-model.trim="keyword"
          class="search-result-view__input"
          type="search"
          placeholder="请输入片名、演员或关键词"
          @keyup.enter="submitSearch"
        >

        <!-- 点击按钮后记录当前关键词，让页面展示当前搜索条件。 -->
        <button type="button" class="search-result-view__button" @click="submitSearch">
          搜索
        </button>
      </div>

      <!-- 搜索说明文字，告诉用户当前页面仍然展示本地静态结果。 -->
      <p class="search-result-view__hint">
        当前页面先展示搜索布局，真实搜索逻辑会在后续数据源阶段接入。
      </p>
    </section>

    <!-- 搜索状态区，集中展示当前关键词、结果数量和数据源状态。 -->
    <section class="search-result-view__status-panel" aria-label="搜索状态">
      <!-- 当前关键词卡片，帮助用户确认本次搜索条件。 -->
      <div class="search-result-view__status-card">
        <span class="search-result-view__status-label">当前关键词</span>
        <strong class="search-result-view__status-value">{{ displayKeyword }}</strong>
      </div>

      <!-- 结果数量卡片，展示当前列表有多少条可展示结果。 -->
      <div class="search-result-view__status-card">
        <span class="search-result-view__status-label">结果数量</span>
        <strong class="search-result-view__status-value">{{ resultCountText }}</strong>
      </div>

      <!-- 搜索源状态卡片，后续可以承接真实源可用性提示。 -->
      <div class="search-result-view__status-card">
        <span class="search-result-view__status-label">搜索源状态</span>
        <strong class="search-result-view__status-value">{{ sourceStatusText }}</strong>
      </div>
    </section>

    <!-- 搜索结果主体区，组件内部负责处理 results 为空时的主体空状态。 -->
    <CatalogGrid
      :items="results"
      empty-title="暂无搜索结果"
      empty-text="当前关键词没有匹配内容。"
    />

    <!-- 分页区，pagination 有内容时才渲染。 -->
    <CatalogPagination v-if="hasPagination" :pagination="pagination" />
  </div>
</template>

<script>
// 目录网格组件，负责渲染搜索页主体结果卡片区域。
import CatalogGrid from '../components/catalog/CatalogGrid.vue';

// 目录分页组件，负责渲染搜索页底部分页状态。
import CatalogPagination from '../components/catalog/CatalogPagination.vue';

// 搜索页静态数据，记录关键词、搜索源状态、结果列表和分页区的当前数据结构。
import { searchPageData } from '../data/page-search.mock';

export default {
  // 组件名称用于在调试工具和报错信息中识别搜索结果页。
  name: 'SearchResultView',

  // 注册搜索结果页当前使用的目录组件。
  components: {
    // <CatalogGrid /> 对应搜索结果主体卡片区。
    CatalogGrid,

    // <CatalogPagination /> 对应搜索结果页底部分页区。
    CatalogPagination
  },

  data() {
    // 初始关键词来自搜索页数据文件，输入框和状态区都需要使用它。
    const initialKeyword = this.asText(searchPageData.keyword);

    return {
      // keyword 绑定搜索输入框，也会影响状态区中的当前关键词显示。
      keyword: initialKeyword,

      // submittedKeyword 表示已经提交过的关键词，用于状态区稳定展示。
      submittedKeyword: initialKeyword,

      // sourceStatus 驱动搜索源状态卡片，后续可接入真实搜索源状态。
      sourceStatus: this.asObjectOrNull(searchPageData.sourceStatus),

      // results 驱动搜索结果主体区；数组为空时主体区显示空状态。
      results: this.asList(searchPageData.results),

      // pagination 驱动搜索页底部分页区；为 null 时分页区不渲染。
      pagination: this.asObjectOrNull(searchPageData.pagination)
    };
  },

  computed: {
    // displayKeyword 表示状态区展示的关键词，没有提交内容时显示占位文本。
    displayKeyword() {
      return this.submittedKeyword || '暂无关键词';
    },

    // resultCountText 表示状态区展示的结果数量，会跟随 results 数组变化。
    resultCountText() {
      return `${this.results.length} 条`;
    },

    // sourceStatusText 表示状态区展示的搜索源说明，优先使用 sourceStatus.sourceName。
    sourceStatusText() {
      if (!this.sourceStatus) {
        return '暂无搜索源';
      }

      return this.sourceStatus.sourceName || this.sourceStatus.message || '搜索源状态未知';
    },

    // hasPagination 表示搜索页是否需要显示分页区。
    hasPagination() {
      return Boolean(this.pagination);
    }
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     *
     * @param {*} value 可能来自搜索页数据文件的任意列表值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     */
    asList(value) {
      return Array.isArray(value) ? value : [];
    },

    /**
     * 把对象数据整理成对象或 null。
     *
     * @param {*} value 可能来自搜索页数据文件的对象值。
     * @returns {Object|null} 有效对象原样返回，其他值统一转成 null。
     */
    asObjectOrNull(value) {
      // 数组不能作为普通对象使用，所以这里需要额外排除数组。
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }

      return value;
    },

    /**
     * 把任意值整理成字符串。
     *
     * @param {*} value 可能来自搜索页数据文件的文本值。
     * @returns {string} 字符串原样返回，其他值统一转为空字符串。
     */
    asText(value) {
      return typeof value === 'string' ? value : '';
    },

    /**
     * 提交搜索关键词。
     *
     * @returns {void} 只更新 submittedKeyword，不返回业务数据。
     */
    submitSearch() {
      // 去掉输入框两端空格，避免状态区显示无意义空白。
      const nextKeyword = this.keyword.trim();

      // 没有输入内容时保留空关键词，让状态区显示占位文本。
      this.submittedKeyword = nextKeyword;
    }
  }
};
</script>

<style scoped>
/*
  搜索结果页整体容器。
  对应 template 中的 `.search-result-view`，负责包裹搜索页全部区域。
*/
.search-result-view {
  /* 限制页面最大宽度，保证宽屏下内容不会过度拉伸。 */
  max-width: 1180px;

  /* 让搜索页在主体区域中水平居中。 */
  width: 100%;

  /* 给页面上下留出空间，避免内容贴近导航栏和页脚。 */
  padding: 36px 32px 48px;

  /* 让 padding 计入宽度，避免横向溢出。 */
  box-sizing: border-box;
}

/*
  搜索页头部。
  对应 template 中的 `.search-result-view__header`，展示页面标题和说明。
*/
.search-result-view__header {
  /* 控制头部和搜索输入区之间的距离。 */
  margin-bottom: 24px;
}

/*
  页面短标签。
  对应 template 中的 `.search-result-view__eyebrow`。
*/
.search-result-view__eyebrow {
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
  搜索页标题。
  对应 template 中的 `.search-result-view__title`。
*/
.search-result-view__title {
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
  搜索页说明。
  对应 template 中的 `.search-result-view__summary`。
*/
.search-result-view__summary {
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

/*
  搜索输入面板。
  对应 template 中的 `.search-result-view__search-panel`，位于页面头部下方。
*/
.search-result-view__search-panel {
  /* 白色背景让搜索操作区从页面背景中分离出来。 */
  background: #ffffff;

  /* 使用浅色边框明确面板边界。 */
  border: 1px solid #e6eaf0;

  /* 使用小圆角，和目录卡片风格保持一致。 */
  border-radius: 8px;

  /* 给面板内部留出操作空间。 */
  padding: 20px;

  /* 控制搜索面板和下方状态区之间的距离。 */
  margin-bottom: 18px;
}

/*
  搜索输入标签。
  对应 template 中的 `.search-result-view__label`。
*/
.search-result-view__label {
  /* 让 label 独占一行，避免和输入框挤在一起。 */
  display: block;

  /* 控制标签和输入行之间的距离。 */
  margin-bottom: 10px;

  /* 使用较粗字重，让用户先看到输入含义。 */
  font-weight: 700;

  /* 使用深色文字保证可读性。 */
  color: #182235;
}

/*
  搜索输入行。
  对应 template 中的 `.search-result-view__search-row`，包含输入框和搜索按钮。
*/
.search-result-view__search-row {
  /* 使用 flex 让输入框和按钮横向排列。 */
  display: flex;

  /* 控制输入框和按钮之间的距离。 */
  gap: 12px;
}

/*
  搜索输入框。
  对应 template 中的 `.search-result-view__input`。
*/
.search-result-view__input {
  /* 让输入框占据按钮之外的剩余宽度。 */
  flex: 1;

  /* 给输入框留出稳定输入区域。 */
  padding: 12px 14px;

  /* 使用浅色边框，保持输入框边界清晰。 */
  border: 1px solid #d6deea;

  /* 使用小圆角，和按钮风格保持一致。 */
  border-radius: 8px;

  /* 设置输入文字字号，保证输入内容易读。 */
  font-size: 15px;

  /* 使用继承字体，避免输入框字体和页面其他区域不一致。 */
  font-family: inherit;

  /* 让 padding 计入宽度，避免输入框在窄屏下溢出。 */
  box-sizing: border-box;
}

/*
  搜索按钮。
  对应 template 中的 `.search-result-view__button`。
*/
.search-result-view__button {
  /* 使用蓝色背景，让主操作按钮清晰可见。 */
  background: #315fca;

  /* 去掉默认按钮边框，统一使用背景色表达按钮形态。 */
  border: 0;

  /* 给按钮留出稳定点击区域。 */
  padding: 0 22px;

  /* 使用小圆角，和输入框保持同一视觉语言。 */
  border-radius: 8px;

  /* 按钮文字使用白色，提高对比度。 */
  color: #ffffff;

  /* 设置按钮文字字号。 */
  font-size: 15px;

  /* 使用较粗字重突出主操作。 */
  font-weight: 700;

  /* 使用继承字体，保持按钮文字风格统一。 */
  font-family: inherit;

  /* 鼠标移入时显示可点击手势。 */
  cursor: pointer;
}

/*
  搜索提示文字。
  对应 template 中的 `.search-result-view__hint`。
*/
.search-result-view__hint {
  /* 控制提示文字和输入行之间的距离。 */
  margin: 10px 0 0;

  /* 使用较小字号，让提示处在辅助层级。 */
  font-size: 13px;

  /* 使用中性色，不抢搜索框和按钮的视觉重点。 */
  color: #667085;
}

/*
  搜索状态面板。
  对应 template 中的 `.search-result-view__status-panel`，展示关键词、数量和源状态。
*/
.search-result-view__status-panel {
  /* 使用三列网格展示状态卡片。 */
  display: grid;

  /* 三列等宽，保证状态信息排列整齐。 */
  grid-template-columns: repeat(3, 1fr);

  /* 控制状态卡片之间的距离。 */
  gap: 14px;

  /* 控制状态区和结果网格之间的距离。 */
  margin-bottom: 22px;
}

/*
  单个状态卡片。
  对应 template 中的 `.search-result-view__status-card`。
*/
.search-result-view__status-card {
  /* 使用白色背景，让状态卡片从页面背景中分离出来。 */
  background: #ffffff;

  /* 使用浅色边框明确卡片边界。 */
  border: 1px solid #e6eaf0;

  /* 保持和搜索面板一致的圆角。 */
  border-radius: 8px;

  /* 给卡片内部文字留出空间。 */
  padding: 14px 16px;
}

/*
  状态卡片标签。
  对应 template 中的 `.search-result-view__status-label`。
*/
.search-result-view__status-label {
  /* 独占一行，和下方状态值形成上下结构。 */
  display: block;

  /* 控制标签和状态值之间的距离。 */
  margin-bottom: 6px;

  /* 使用较小字号，形成辅助说明层级。 */
  font-size: 13px;

  /* 使用中性色，避免标签比状态值更抢眼。 */
  color: #667085;
}

/*
  状态卡片数值。
  对应 template 中的 `.search-result-view__status-value`。
*/
.search-result-view__status-value {
  /* 独占一行，保证状态值不会和标签混排。 */
  display: block;

  /* 设置状态值字号，比标签更醒目。 */
  font-size: 18px;

  /* 使用较粗字重突出当前状态。 */
  font-weight: 700;

  /* 使用深色文字保证可读性。 */
  color: #182235;
}

/*
  窄屏搜索页布局。
  触发条件：屏幕宽度不超过 720px。
  原因：手机宽度不足以稳定横向展示搜索输入行和三列状态卡片。
*/
@media (max-width: 720px) {
  .search-result-view {
    /* 缩小页面左右内边距，给手机内容留出更多空间。 */
    padding: 28px 18px 40px;
  }

  .search-result-view__search-row {
    /* 输入框和按钮改成上下排列，避免按钮挤压输入框。 */
    flex-direction: column;
  }

  .search-result-view__button {
    /* 移动端按钮增加高度，保证触控面积充足。 */
    min-height: 44px;
  }

  .search-result-view__status-panel {
    /* 状态卡片改成单列，避免三列在手机上过窄。 */
    grid-template-columns: 1fr;
  }
}
</style>
