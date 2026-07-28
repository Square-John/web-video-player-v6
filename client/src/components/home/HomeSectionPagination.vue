<template>
  <!--
    HomeSectionPagination 组件渲染树

    [DEFAULT] ele(nav.home-section-pagination)
    │  - condition: 父级热门内容区块挂载时默认渲染。
    │  - type: 原生标签 nav。
    │  - description: 在首页区块标题栏提供紧凑的上一页、页码状态和下一页操作。
    │  - params: -- pagination：标准 PageBucket 分页对象；-- loading：目标桶是否正在请求。
    │  - events: change-page(targetPage)，由父级区块补充 moduleKey 后交给 HomeView 请求。
    │
    ├─ [DEFAULT] ele(button.pagination-button.kind-prev)
    │  - condition: 始终渲染；第一页或请求中通过 disabled 禁用。
    │  - type: 原生标签 button。
    │  - description: 请求当前页的相邻上一页。
    │  - params: -- canGoPrevious：是否允许向前翻页。
    │  - events: @click -> requestPage(displayPage - 1)。
    │
    ├─ [DEFAULT] ele(span.pagination-status)
    │  - condition: 始终渲染；总页数未知时只显示当前页。
    │  - type: 原生标签 span。
    │  - description: 展示当前页以及 Provider 可提供时的总页数。
    │  - params: -- pageStatusText：当前分页状态文案。
    │  - events: 无。
    │
    └─ [DEFAULT] ele(button.pagination-button.kind-next)
       - condition: 始终渲染；无下一页或请求中通过 disabled 禁用。
       - type: 原生标签 button。
       - description: 请求当前页的相邻下一页。
       - params: -- canGoNext：是否允许向后翻页。
       - events: @click -> requestPage(displayPage + 1)。
  -->
  <!--
    [DEFAULT] ele(nav.home-section-pagination)
    - condition: 父级热门内容区块挂载时默认渲染。
    - type: 原生标签 nav。
    - description: 以标题栏密度承载相邻页切换，不提供目录页使用的任意页输入。
    - params: -- pagination：目标 PageBucket 的标准分页对象；-- loading：目标桶事务是否为 loading。
    - events: change-page(targetPage)，仅派发有效相邻页码。
  -->
  <nav class="home-section-pagination" :aria-label="ariaLabel">
    <!--
      [DEFAULT] ele(button.pagination-button.kind-prev)
      - condition: 始终渲染；canGoPrevious 为 false 时禁用。
      - type: 原生标签 button。
      - description: 标题栏上一页操作，文字在窄屏隐藏但保留图标、title 和 aria-label。
      - params: -- disabled：第一页或请求中禁止重复请求。
      - events: @click -> requestPage(displayPage - 1)。
    -->
    <button
      class="pagination-button kind-prev"
      type="button"
      :disabled="!canGoPrevious"
      :title="previousButtonTitle"
      :aria-label="previousButtonTitle"
      @click="requestPage(displayPage - 1)"
    >
      <i class="el-icon-arrow-left" aria-hidden="true"></i>
      <span class="pagination-button-text">上一页</span>
    </button>

    <!--
      [DEFAULT] ele(span.pagination-status)
      - condition: 始终渲染；已知总页数时显示“当前/总页数”，未知时只显示当前页。
      - type: 原生标签 span。
      - description: 展示 Provider 已提交的分页事实，不根据列表长度猜测总页数。
      - params: -- pageStatusText：由 pagination.page/totalPages 派生。
      - events: 无。
    -->
    <span class="pagination-status" aria-live="polite">
      {{ pageStatusText }}
    </span>

    <!--
      [DEFAULT] ele(button.pagination-button.kind-next)
      - condition: 始终渲染；canGoNext 为 false 时禁用。
      - type: 原生标签 button。
      - description: 标题栏下一页操作；总页数未知时由 pagination.hasMore 决定可用性。
      - params: -- disabled：最后一页、hasMore=false 或请求中禁止继续请求。
      - events: @click -> requestPage(displayPage + 1)。
    -->
    <button
      class="pagination-button kind-next"
      type="button"
      :disabled="!canGoNext"
      :title="nextButtonTitle"
      :aria-label="nextButtonTitle"
      @click="requestPage(displayPage + 1)"
    >
      <span class="pagination-button-text">下一页</span>
      <i class="el-icon-arrow-right" aria-hidden="true"></i>
    </button>
  </nav>
</template>

<script>
/*
  HomeSectionPagination.vue 模块说明

  - 文件职责:
      把标准 PageBucket.pagination 转换为首页标题栏相邻分页的展示与禁用状态。
      组件只派发目标页码，不读取 Store、不调用 Service，也不解释电影、电视剧或 Provider 业务。

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      FIRST_PAGE: number，标准分页允许的最小页码。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      HomeSectionPagination: Vue component，供首页热门内容区块共享紧凑分页交互。
*/

// 类型: number；来源: PageBucket 分页契约；作用: 统一页码下限并避免组件方法散落数字字面量。
const FIRST_PAGE = 1;

// 导出类型: Vue component。
// 调用方: HotMovieSection 与 HotTVSection。
// 使用场景: 在两个区块标题同行展示独立分页状态并派发相邻目标页。
export default {
  name: 'HomeSectionPagination',

  props: {
    // 类型: object。
    // 来源: 父级从 siteContentStore.getPagePagination('home', moduleKey) 取得的标准分页对象。
    // 作用: 驱动当前页、总页数以及上一页/下一页可用性。
    // 字段: page，number，Provider 本次返回的当前页。
    // 字段: totalPages，number|null，Provider 可确定时的总页数。
    // 字段: hasMore，boolean，总页数未知时是否允许请求下一页。
    pagination: {
      type: Object,
      required: true
    },

    // 类型: boolean。
    // 来源: 父级根据目标 PageBucket.transaction.status 派生。
    // true: 当前目标桶正在请求，两个方向均禁用以阻止重复命令。
    // false: 按 pagination 边界决定每个方向是否可用。
    loading: {
      type: Boolean,
      default: false
    },

    // 类型: string。
    // 来源: 父级热门内容区块传入面向辅助技术的区域名称。
    // 作用: 区分电影与电视剧分页导航；空值时使用通用名称。
    ariaLabel: {
      type: String,
      default: '首页内容分页'
    }
  },

  computed: {
    /**
     * 读取可展示的当前页码。
     * 纯函数: 只规范化 pagination.page，不修改 prop 或外部状态。
     * 失败路径: 缺失、非有限数字或小于第一页时回到第一页用于安全展示。
     *
     * @returns {number} 大于等于 FIRST_PAGE 的整数页码。
     */
    displayPage() {
      // 类型: number；作用: 统一处理 Provider 可能返回的数值或数字字符串。
      const page = Number(this.pagination.page);

      // 条件分支: page 不满足正整数页码契约时进入；执行内容: 只在展示层回到第一页。
      if (!Number.isFinite(page) || page < FIRST_PAGE) {
        return FIRST_PAGE;
      }

      // 返回值类型: number；作用: 分页操作只使用整数目标页。
      return Math.floor(page);
    },

    /**
     * 读取有效总页数。
     * 纯函数: 只规范化 pagination.totalPages；未知或非法时返回 null。
     *
     * @returns {number|null} 有效正整数总页数，Provider 未提供时为 null。
     */
    totalPages() {
      // 类型: number；作用: 将 Provider 返回值转换为可比较数字。
      const totalPages = Number(this.pagination.totalPages);

      // 条件分支: 总页数不是有效正数时进入；执行内容: 保持“总页数未知”语义。
      if (!Number.isFinite(totalPages) || totalPages < FIRST_PAGE) {
        return null;
      }

      return Math.floor(totalPages);
    },

    /**
     * 生成标题栏页码状态。
     * 纯函数: 只读取 displayPage 和 totalPages，不写页面状态。
     *
     * @returns {string} 已知总页数时为“当前/总页数”，未知时只显示当前页。
     */
    pageStatusText() {
      return this.totalPages === null
        ? `${this.displayPage}`
        : `${this.displayPage}/${this.totalPages}`;
    },

    /**
     * 判断是否允许请求上一页。
     * 纯函数: 只读取当前页和 loading。
     *
     * @returns {boolean} 非请求中且当前页大于第一页时为 true。
     */
    canGoPrevious() {
      return !this.loading && this.displayPage > FIRST_PAGE;
    },

    /**
     * 判断是否允许请求下一页。
     * 纯函数: 已知总页数时按最后一页判断，未知时读取 Provider 返回的 hasMore。
     *
     * @returns {boolean} 非请求中且分页契约允许继续时为 true。
     */
    canGoNext() {
      // 条件分支: 当前目标桶正在请求时进入；执行内容: 禁止并发重复分页命令。
      if (this.loading) {
        return false;
      }

      // 条件分支: Provider 提供有效总页数时进入；执行内容: 由最后一页决定下一页边界。
      if (this.totalPages !== null) {
        return this.displayPage < this.totalPages;
      }

      // 返回值类型: boolean；作用: 总页数未知时只信任 Provider 明确提交的 hasMore。
      return this.pagination.hasMore === true;
    },

    /**
     * 生成上一页按钮提示。
     * 纯函数: 根据 loading 和上一页边界提供可理解的 tooltip/aria 文案。
     *
     * @returns {string} 当前上一页操作状态说明。
     */
    previousButtonTitle() {
      // 条件分支: 目标桶正在请求时进入；执行内容: 提示用户等待本次分页事务完成。
      if (this.loading) {
        return '内容请求中';
      }

      return this.canGoPrevious ? '上一页' : '已经是第一页';
    },

    /**
     * 生成下一页按钮提示。
     * 纯函数: 根据 loading 和下一页边界提供可理解的 tooltip/aria 文案。
     *
     * @returns {string} 当前下一页操作状态说明。
     */
    nextButtonTitle() {
      // 条件分支: 目标桶正在请求时进入；执行内容: 提示用户等待本次分页事务完成。
      if (this.loading) {
        return '内容请求中';
      }

      return this.canGoNext ? '下一页' : '没有下一页';
    }
  },

  methods: {
    /**
     * 派发相邻目标页码。
     * 触发来源: 标题栏上一页或下一页按钮 click。
     * 副作用: 只派发 change-page 事件，不修改 pagination、不请求网络、不写 Store。
     * 失败路径: 请求中、非相邻页或方向不满足分页边界时直接返回。
     *
     * @param {number} targetPage 当前按钮计算出的相邻目标页码。
     * @returns {void} 有效时向父级派发目标页码。
     */
    requestPage(targetPage) {
      // 类型: number；作用: 防止模板计算值被非数值输入污染。
      const normalizedTargetPage = Number(targetPage);

      // 条件分支: 目标页不是当前页的相邻正整数时进入；执行内容: 阻止越级和非法页命令。
      if (!Number.isInteger(normalizedTargetPage)
        || Math.abs(normalizedTargetPage - this.displayPage) !== 1) {
        return;
      }

      // 条件分支: 请求上一页但当前边界不允许时进入；执行内容: 不向父级发出越界事件。
      if (normalizedTargetPage < this.displayPage && !this.canGoPrevious) {
        return;
      }

      // 条件分支: 请求下一页但当前边界不允许时进入；执行内容: 不向父级发出越界事件。
      if (normalizedTargetPage > this.displayPage && !this.canGoNext) {
        return;
      }

      // 事件: change-page；参数: number，相邻目标页码，由父级补充首页 moduleKey 后请求。
      this.$emit('change-page', normalizedTargetPage);
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 标题栏分页导航 `.home-section-pagination`。
  样式目标: 以稳定高度横向排列两个按钮和页码状态，不因页码或 loading 改变标题栏尺寸。
*/
.home-section-pagination {
  /* 使用横向布局，让上一页、状态和下一页保持一行。 */
  display: inline-flex;

  /* 垂直居中图标、文字和页码。 */
  align-items: center;

  /* 统一三个控件的水平间距。 */
  gap: 6px;

  /* 禁止分页导航在标题栏中被压缩到控件重叠。 */
  flex: 0 0 auto;
}

/*
  作用容器: 上一页和下一页按钮 `.pagination-button`。
  样式目标: 使用紧凑次级按钮视觉，保持稳定高度和清晰可点击区域。
*/
.pagination-button {
  /* 图标和文字横向排列并保持垂直居中。 */
  display: inline-flex;
  align-items: center;
  justify-content: center;

  /* 图标与文字之间使用固定组件内间距。 */
  gap: 4px;

  /* 固定按钮高度，避免文字、图标或禁用态改变标题栏高度。 */
  min-height: 30px;

  /* 为文字按钮保留紧凑横向点击区域。 */
  padding: 0 10px;

  /* 使用全站表面与边框变量，保持和首页次级操作一致。 */
  color: var(--text-secondary);
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;

  /* 标题栏按钮使用紧凑字号，不抢区块标题层级。 */
  font-size: 13px;
  line-height: 1;

  /* 可用状态显示明确指针反馈。 */
  cursor: pointer;

  /* 颜色和边框状态平滑切换，不改变几何尺寸。 */
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

/* 鼠标悬停可用按钮时使用主题强调色，不影响禁用按钮。 */
.pagination-button:not(:disabled):hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}

/* 键盘聚焦时提供可见轮廓，避免仅靠颜色表达焦点。 */
.pagination-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* 禁用状态降低对比并阻止误导性的点击指针。 */
.pagination-button:disabled {
  color: var(--text-muted);
  background: var(--surface-soft);
  cursor: not-allowed;
  opacity: 0.62;
}

/*
  作用容器: 当前页状态 `.pagination-status`。
  样式目标: 为单页和“当前/总页”两种文本保留稳定宽度，避免按钮横向跳动。
*/
.pagination-status {
  /* 保留双位当前页与总页数的基本空间，页数增加时允许自然扩展。 */
  min-width: 44px;

  /* 页码在预留空间中居中显示。 */
  text-align: center;

  /* 使用等宽数字让页码变化时视觉更稳定。 */
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  line-height: 30px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/*
  响应式范围: 宽度不超过 575px 的手机标题栏。
  调整目标: 隐藏重复文字并保留熟悉的箭头、tooltip 和辅助技术标签，为区块标题和“更多”留出空间。
*/
@media (max-width: 575px) {
  .home-section-pagination {
    /* 手机端进一步压缩三个控件之间的空隙。 */
    gap: 4px;
  }

  .pagination-button {
    /* 手机端按钮使用稳定方形图标尺寸，避免标题栏换行。 */
    width: 30px;
    min-height: 30px;
    padding: 0;
  }

  .pagination-button-text {
    /* 视觉上隐藏重复方向文字，图标、title 和 aria-label 继续表达操作。 */
    display: none;
  }

  .pagination-status {
    /* 手机端缩短页码最小宽度，同时继续允许长页数自然扩展。 */
    min-width: 36px;
  }
}
</style>
