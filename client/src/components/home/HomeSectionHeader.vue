<template>
  <!--
    HomeSectionHeader 组件渲染树

    [DEFAULT] ele(div.home-section-header)
    │  - condition:
    │      首页热门电影或热门电视剧区块挂载时默认渲染。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      首页热门区块共享标题栏。
    │      桌面端按下方六列主体分成左侧视频区标题/分页和右侧排行榜更多入口；
    │      平板及手机端再收敛为标题、分页、更多三项紧凑排列。
    │  - params:
    │      -- title：当前首页内容区块标题。
    │      -- pagination：当前区块 PageBucket 的标准分页事实。
    │      -- loading：当前区块是否正在请求。
    │      -- ariaLabel：分页导航的辅助技术名称。
    │      -- moreLabel：右侧更多入口文案。
    │  - events:
    │      @change-page
    │          - description:
    │              HomeSectionPagination 派发有效相邻页码时触发。
    │          - methods:
    │              向父级转发 change-page(targetPage)。
    │      @open-more
    │          - description:
    │              用户点击右侧更多入口时触发。
    │          - methods:
    │              向父级转发 open-more。
    │
    ├─ [DEFAULT] ele(h2.home-section-header__title)
    │  - condition: 默认渲染。
    │  - type: 原生标签，标签名称: h2。
    │  - description: 展示当前首页热门区块的正式标题。
    │  - params: -- title：父级传入的区块标题。
    │  - events: 无。
    │
    ├─ [DEFAULT] ele(HomeSectionPagination)
    │  - condition: 默认渲染。
    │  - type: 自定义组件，相对位置: ./HomeSectionPagination.vue。
    │  - description: 展示当前区块的上一页、页码状态和下一页命令。
    │  - params: -- pagination/loading/ariaLabel：转交标准分页事实和请求状态。
    │  - events: @change-page -> 转发目标页码。
    │
    └─ [DEFAULT] ele(button.home-section-header__more)
       - condition: 默认渲染。
       - type: 原生标签，标签名称: button。
       - description: 提供进入当前区块完整内容页的更多入口。
       - params: -- moreLabel：父级传入的入口文案。
       - events: @click -> $emit('open-more')。
  -->
  <div class="home-section-header">
    <!-- 首页热门区块标题，作为标题栏左侧的主信息层级。 -->
    <h2 class="home-section-header__title">{{ title }}</h2>

    <!-- 首页热门区块共享分页，保持电影和电视剧标题栏的结构与几何一致。 -->
    <HomeSectionPagination
      class="home-section-header__pagination"
      :pagination="pagination"
      :loading="loading"
      :aria-label="ariaLabel"
      @change-page="handleChangePage"
    />

    <!-- 首页热门区块更多入口，点击后只向父级派发业务导航意图。 -->
    <button
      class="home-section-header__more"
      type="button"
      @click="handleOpenMore"
    >
      <span>{{ moreLabel }}</span>
      <i class="el-icon-arrow-right" aria-hidden="true"></i>
    </button>
  </div>
</template>

<script>
/*
  HomeSectionHeader.vue 模块说明

  - 文件职责:
      统一首页热门电影和热门电视剧标题栏的展示结构、垂直对齐、分页入口和更多入口。
      组件只消费标准分页事实并向区块父级转发用户意图，不请求网络、不读取 Store、不决定路由。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      HomeSectionPagination: 自定义组件，展示首页热门区块的相邻分页。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      HomeSectionHeader: Vue component，供首页热门电影和热门电视剧区块共享标题栏。
*/

// 导入来源: ./HomeSectionPagination.vue。
// 导入内容: HomeSectionPagination 首页标题栏分页组件。
// 文件作用: 在共享标题栏中渲染分页状态并派发相邻页码意图。
import HomeSectionPagination from './HomeSectionPagination.vue';

export default {
  name: 'HomeSectionHeader',

  components: {
    // 组件: HomeSectionPagination 首页热门区块分页。
    // 作用: 统一电影和电视剧标题栏的分页 DOM、边界和按钮行为。
    HomeSectionPagination
  },

  props: {
    // 类型: string。
    // 来源: HotMovieSection 或 HotTVSection 的固定产品标题。
    // 作用: 展示当前首页热门区块的正式名称。
    title: {
      type: String,
      required: true
    },

    // 类型: object。
    // 来源: 首页页面层的 PageBucket pagination selector。
    // 作用: 驱动共享分页显示当前页、总页数和边界状态。
    pagination: {
      type: Object,
      required: true
    },

    // 类型: boolean。
    // 来源: 首页页面层的 PageBucket transaction.status。
    // true: 禁用共享分页，阻止同一数据桶的重复请求。
    // false: 共享分页按 pagination 边界决定按钮是否可用。
    loading: {
      type: Boolean,
      default: false
    },

    // 类型: string。
    // 来源: HotMovieSection 或 HotTVSection 的无障碍区域名称。
    // 作用: 标识当前共享分页服务的内容区块。
    ariaLabel: {
      type: String,
      default: '首页内容分页'
    },

    // 类型: string。
    // 来源: 父级区块的正式展示文案。
    // 作用: 展示进入当前完整内容页的轻量入口文字。
    moreLabel: {
      type: String,
      default: '更多'
    }
  },

  methods: {
    /**
     * 向首页区块父级转发相邻页码。
     * 触发来源: HomeSectionPagination 的 change-page 事件。
     * 执行内容: 不修改分页事实，只把目标页码继续交给业务区块。
     * 副作用: 仅派发 change-page 事件，不请求网络、不写入 Store 或路由。
     *
     * @param {number} targetPage 分页组件根据当前边界计算出的相邻目标页码。
     * @returns {void} 该方法只派发 change-page 事件。
     */
    handleChangePage(targetPage) {
      // 事件: change-page；参数: number，父级按自身页面模块补充请求身份。
      this.$emit('change-page', targetPage);
    },

    /**
     * 向首页区块父级转发更多入口意图。
     * 触发来源: 共享标题栏右侧按钮 click。
     * 执行内容: 不直接操作 Router，只派发 open-more 事件。
     * 副作用: 仅派发 open-more 事件，不执行路由跳转或修改页面数据。
     *
     * @returns {void} 该方法只派发 open-more 事件。
     */
    handleOpenMore() {
      // 事件: open-more；作用: 通知父级按当前区块身份进入完整内容页。
      this.$emit('open-more');
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 首页热门区块标题栏 `.home-section-header`。
  样式作用:
  桌面复用下方六列主体，把标题和分页固定在左侧视频区域，把更多固定在右侧排行榜区域。
  平板及手机主体变为单列后，再使用紧凑三列排列，避免把移动端间距规则错误带到桌面。
  通过同一组件承载电影和电视剧标题栏，避免两份响应式规则逐渐分叉。
*/
.home-section-header {
  /* 作为热门区块主体 Grid 的共享标题行，跨越卡片与榜单的全部列。 */
  grid-column: 1 / -1;

  /* 固定在主体首行，避免被内容网格压缩到单个卡片列。 */
  grid-row: 1;

  /* 使用与主体相同的六列 Grid，让左侧视频区和右侧排行榜的边界保持一致。 */
  display: grid;

  /* 手机标题栏的操作间距契约，桌面只使用页面栅格间距，避免散落移动像素值。 */
  --home-section-header-mobile-gap: 10px;

  /* 桌面复用主体六列，左侧视频区为前四列，右侧排行榜为后两列。 */
  grid-template-columns: repeat(var(--page-layout-columns), minmax(0, 1fr));

  /* 标题、分页和更多在同一交叉轴中心对齐。 */
  align-items: center;

  /* 统一标题栏内部的最小垂直节奏。 */
  min-height: 34px;

  /* 允许父级区块在窄屏下安全收缩。 */
  min-width: 0;

  /* 保持首页区块和内容栅格相同的横向占用。 */
  width: 100%;

  /* 复用主体栅格间距，保证标题、分页和更多分别对齐下方区域边界。 */
  column-gap: var(--page-grid-gap);
}

/*
  作用容器: 首页热门区块标题 `.home-section-header__title`。
  样式作用:
  把标题文字和左侧主题强调线放进明确的居中 Flex 盒。
  避免浏览器标题默认行盒与分页按钮内部行盒产生视觉基线错位。
*/
.home-section-header__title {
  /* 标题占左侧视频区域前两列并保持左对齐。 */
  grid-column: 1 / span 2;

  /* 标题贴合左侧视频区域起点。 */
  justify-self: start;

  /* 使用 Flex 让标题字形在标题栏高度内垂直居中。 */
  display: inline-flex;
  align-items: center;

  /* 允许长标题在左列收缩，不把分页和更多推出容器。 */
  min-width: 0;

  /* 清除浏览器 h2 默认外边距，避免标题栏行高被默认样式改变。 */
  margin: 0;

  /* 保留现有首页标题层级和主题色。 */
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;

  /* 保留标题与左侧强调线之间的阅读留白。 */
  padding-left: 14px;

  /* 使用现有强调色标记内容区块起点。 */
  border-left: 4px solid var(--accent);
}

/*
  作用容器: 首页热门区块共享分页 `.home-section-header__pagination`。
  样式作用:
  将共享分页固定在左侧视频区域的右边界，不让右侧“更多”入口改变它的归属。
*/
.home-section-header__pagination {
  /* 分页占左侧视频区域后两列，并贴合卡片区域右边界。 */
  grid-column: 3 / span 2;
  justify-self: end;

  /* 分页作为完整控件组不参与左右列的压缩。 */
  min-width: max-content;
}

/*
  作用容器: 首页热门区块更多入口 `.home-section-header__more`。
  样式作用:
  在右侧排行榜区域保持清晰的次级操作层级，同时和标题、分页共享垂直中心。
*/
.home-section-header__more {
  /* 更多入口占右侧排行榜两列并贴向整个区块右边界。 */
  grid-column: 5 / span 2;
  justify-self: end;

  /* 让文案和箭头在同一命中盒内精确垂直居中。 */
  display: inline-flex;
  align-items: center;

  /* 保持按钮命中盒与标题栏同步。 */
  min-height: 30px;
  gap: 4px;
  padding: 0;

  /* 桌面字号比原来的辅助字号提高两像素，保持可读性但不超过区块标题。 */
  color: var(--text-muted);
  font-size: 16px;
  font-weight: 500;
  line-height: 1;

  /* 保持更多入口为轻量文本按钮，不增加独立容器背景。 */
  background: transparent;
  border: 0;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.18s ease;
}

/*
  作用容器: 更多入口悬停和键盘焦点状态 `.home-section-header__more`。
  样式作用:
  提供不改变尺寸的交互反馈，保持标题栏整体几何稳定。
*/
.home-section-header__more:hover,
.home-section-header__more:focus-visible {
  /* 使用主题色强调可执行的更多命令。 */
  color: var(--accent);
}

.home-section-header__more:focus-visible {
  /* 为键盘用户提供清晰焦点轮廓，不引入布局变化。 */
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/*
  响应式断点: max-width 1279.98px。
  作用范围: 主体已从六列双栏收敛为单列的平板及手机首页热门区块标题栏。
  样式作用:
  把标题、分页和更多排列为左侧标题加右侧两个紧凑操作，避免移动规则影响桌面两区域语义。
*/
@media (max-width: 1279.98px) {
  .home-section-header {
    /* 单列主体下只给分页和更多保留紧凑操作间距。 */
    grid-template-columns: minmax(0, 1fr) auto auto;
    column-gap: var(--home-section-header-mobile-gap);
    min-height: 32px;
  }

  .home-section-header__title {
    /* 单列主体下标题占第一列，保留左侧内容定位。 */
    grid-column: 1;
  }

  .home-section-header__pagination {
    /* 单列主体下分页占第二列，紧邻更多入口。 */
    grid-column: 2;
  }

  .home-section-header__more {
    /* 单列主体下更多占第三列，保持右侧对齐。 */
    grid-column: 3;
  }
}

/*
  响应式断点: max-width 640px。
  作用范围: 手机首页热门区块标题栏。
  样式作用:
  只收紧标题字号、命中盒和行高，不改变标题、分页、更多的三列关系。
*/
@media (max-width: 640px) {
  .home-section-header {
    /* 手机沿用命名的紧凑操作间距，不把分页和更多拉到远离彼此的位置。 */
    column-gap: var(--home-section-header-mobile-gap);
  }

  .home-section-header__title {
    /* 手机维持现有标题层级，避免标题挤压中间分页。 */
    font-size: 20px;
    line-height: 1.2;
  }

  .home-section-header__more {
    /* 手机更多入口同样比原先提高两像素，保持可读和与标题栏中心对齐。 */
    min-height: 28px;
    font-size: 15px;
  }
}
</style>
