<template>
  <!--
    HotMovieSection 组件渲染树

    [DEFAULT] ele(section.section-wrapper)
    │  - condition:
    │      默认渲染。
    │      首页有无电影数据都保留热门电影区块外壳。
    │  - type:
    │      原生标签
    │      标签名称: section
    │  - description:
    │      首页热门电影区块。
    │      左侧展示 Provider 返回的当前页电影卡片，右侧展示电影排行榜。
    │  - params:
    │      -- movies：父组件传入的首页热门电影列表。
    │      -- ranking：父组件传入的电影排行榜列表。
    │      -- pagination：hotMovies 数据桶的标准分页信息。
    │      -- paging：hotMovies 数据桶是否正在请求。
    │      -- rankingRefreshing：电影排行榜刷新状态。
    │  - events:
    │      @refresh-ranking
    │          - description:
    │              用户点击排行榜刷新按钮时触发。
    │              用于通知父组件重新请求电影排行榜数据。
    │          - methods:
    │              handleRefreshRanking(rankingKey)
    │                  -- rankingKey：排行榜区域标识。
    │      @open-more-ranking
    │          - description:
    │              标题“更多”或排行榜“查看更多”被点击时触发。
    │              用于通知 HomeView 进入电影承接页。
    │          - methods:
    │              handleOpenMoreRanking(rankingKey)
    │                  -- rankingKey：固定电影排行榜区域标识。
    │      @change-page
    │          - description: 用户点击标题栏相邻分页按钮时通知 HomeView 请求电影目标页。
    │          - methods: handleChangePage(targetPage)，补充 hotMovies 模块身份后派发。
    │
    └─ [DEFAULT] ele(div.section-body)
       - condition: 区块始终渲染主体 Grid。
       - type: 原生 div。
       - description: 第一行六列放标题、分页和“更多”，第二行前四列放卡片，第二行后两列放排行榜。
       - params: -- movies/pagination/ranking：分别驱动卡片、分页和排行榜。
       - events: 子节点事件由当前组件转发。
       │
       ├─ [DEFAULT] ele(div.section-head)
       │  - condition: 始终渲染。
       │  - type: 原生 div。
       │  - description: 横跨第一行六列；分页对齐卡片区右边界，“更多”保持完整区块最右侧。
       │  - params: -- pagination/paging：当前热门电影分页和请求状态。
       │  - events: @change-page 与更多按钮 click。
       │
       ├─ [IF hasMovies] ele(div.section-grid)
    │  - condition:
    │      displayMovies 至少有一条数据时渲染。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      热门电影卡片网格。
    │      循环渲染 Provider 为当前页返回的全部 UserVideoCard。
    │  - params:
    │      -- displayMovies：首页实际展示的热门电影列表。
    │  - events: 无
    │
       ├─ [ELSE] ele(el-empty.section-empty)
    │  - condition:
    │      hasMovies 不成立时渲染。
    │  - type:
    │      第三方组件
    │      组件库: Element UI
    │      组件名称: el-empty
    │  - description:
    │      热门电影空状态。
    │      当前区块没有电影数据时保留结构占位。
    │  - params: 无
    │  - events: 无
    │
       └─ [DEFAULT] ele(HotRanking)
       - condition:
           默认渲染。
           排行榜组件内部继续处理列表为空和刷新状态。
       - type:
           自定义组件
           相对位置: ./HotRanking.vue
       - description:
           电影排行榜。
           展示电影排名条目，并提供局部刷新入口。
       - params:
           -- ranking：电影排行榜列表。
           -- rankingRefreshing：刷新状态。
       - events:
           @refresh-ranking
               - description:
                   用户点击刷新数据时触发。
               - methods:
                   handleRefreshRanking(rankingKey)
                       -- rankingKey：排行榜区域标识。
  -->
  <section class="section-wrapper">
    <!--
      [DEFAULT] ele(div.section-body)
      - condition: 热门电影区块始终渲染主体 Grid。
      - type: 原生 div。
      - description: 用两行六列统一编排标题栏、左下卡片和右下排行榜。
      - params: -- hasMovies/displayMovies/ranking：分别驱动卡片、空态和排行榜。
      - events: 子节点分页、更多和排行榜事件继续由本组件转发。
    -->
    <div class="section-body">
    <!--
      [DEFAULT] ele(div.section-head)
      - condition: 热门电影区块始终展示标题栏操作组。
      - type: 原生 div，内部以相同六列轨道放置标题、HomeSectionPagination 和更多按钮。
      - description: 分页右边界与第 4 列卡片对齐；更多按钮保持在完整区块最右侧。
      - params: -- pagination/paging：当前热门电影桶分页事实；-- rankingKey：电影路由分派标识。
      - events: @change-page -> handleChangePage；@click -> handleOpenMoreRanking(rankingKey)。
    -->
    <div class="section-head">
      <h2 class="section-title">热门电影</h2>
      <HomeSectionPagination
        class="section-pagination"
        :pagination="pagination"
        :loading="paging"
        aria-label="热门电影分页"
        @change-page="handleChangePage"
      />
      <button
        class="section-more-link"
        type="button"
        @click="handleOpenMoreRanking(rankingKey)"
      >
        更多
      </button>
    </div>

      <!-- 有电影数据时渲染视频卡片网格。 -->
      <div v-if="hasMovies" class="section-grid">
        <div v-for="movie in displayMovies" :key="movie.id || movie.title" class="card-cell">
          <UserVideoCard :video="movie" />
        </div>
      </div>

      <!-- 没有电影数据时，电影卡片分区显示 Element UI 空状态。 -->
      <el-empty
        v-else
        class="section-empty"
        description="当前热门电影模块没有数据" />

      <!-- 右侧电影榜单，榜单组件内部会继续判断 ranking 是否为空。 -->
      <aside class="section-aside">
        <!--
          排行榜内层壳。
          父级 section-aside 继续占 2 个页面格栅，壳层按 5 份取右侧 4 份，也就是 1.6 个格栅。
          壳层右对齐，让排行榜右侧继续贴合页面内容右边界。
        -->
        <div class="ranking-panel-shell">
          <HotRanking
            title="电影排行榜"
            :ranking-key="rankingKey"
            :items="ranking"
            :refreshing="rankingRefreshing"
            @refresh-ranking="handleRefreshRanking"
            @open-more-ranking="handleOpenMoreRanking" />
        </div>
      </aside>
    </div>
  </section>
</template>

<script>
/*
  HotMovieSection.vue 模块说明

  - 文件职责:
      展示首页热门电影卡片、电影排行榜和两个统一的更多入口。
      组件只向 HomeView 转发刷新与路由意图，不请求数据或直接操作 Router。

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      UserVideoCard: 自定义组件，渲染带用户状态的视频卡片。
      HotRanking: 自定义组件，渲染首页右侧排行榜。
      HomeSectionPagination: 自定义组件，渲染标题栏标准分页并派发目标页。

  - 模块级常量:
      MOVIE_RANKING_KEY: string，统一标题“更多”、排行榜“查看更多”和 HomeView 路由分派使用的电影模块标识。
      HOT_MOVIE_MODULE_KEY: string，标识热门电影列表 PageBucket 与分页事件目标。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      HotMovieSection: Vue component，供 HomeView 渲染热门电影概览和转发区块交互。
*/

// 导入来源: ../common/UserVideoCard.vue。
// 导入内容: UserVideoCard 带用户状态的视频卡片容器。
// 文件作用: 用于让热门电影卡片统一接入收藏状态和播放状态。
import UserVideoCard from '../common/UserVideoCard.vue';

// 导入来源: ./HotRanking.vue。
// 导入内容: HotRanking 首页排行榜组件。
// 文件作用: 在热门电影右侧渲染排行榜并转发刷新/查看更多事件。
import HotRanking from './HotRanking.vue';

// 导入来源: ./HomeSectionPagination.vue。
// 导入内容: HomeSectionPagination 首页标题栏分页组件。
// 文件作用: 使用标准 pagination/loading 渲染热门电影相邻页操作。
import HomeSectionPagination from './HomeSectionPagination.vue';

// 类型: string；来源: 首页页面数据桶契约；作用: 让标题入口和排行榜入口共享同一电影路由分派标识。
const MOVIE_RANKING_KEY = 'movieRanking';

// 类型: string；来源: 首页 PageBucket 定位契约；作用: 给分页事件补充热门电影区域身份。
const HOT_MOVIE_MODULE_KEY = 'hotMovies';

/**
 * 首页热门电影区块。
 *
 * 组件定位：
 * - 只负责展示首页电影列表和电影排行榜
 * - 不请求数据，不保存数据，也不决定数据来源
 * - 左侧展示 Provider 返回的当前页卡片，不在组件内截断或保存分页副本
 */
export default {
  name: 'HotMovieSection',

  components: {
    // UserVideoCard 负责单张电影卡片的内容展示，并注入用户收藏和播放状态。
    UserVideoCard,

    // HotRanking 负责右侧电影排行榜。
    HotRanking,

    // HomeSectionPagination 负责标题栏当前页展示和相邻页事件派发。
    HomeSectionPagination
  },

  props: {
    // movies 驱动左侧热门电影卡片网格。
    // 渲染位置：`.section-grid` 内部的 UserVideoCard 列表。
    movies: {
      type: Array,
      required: true
    },

    // 类型: object。
    // 来源: HomeView 从 pages.home.hotMovies.pagination selector 读取。
    // 作用: 驱动标题栏当前页、总页数和下一页可用性，不在本组件复制分页状态。
    pagination: {
      type: Object,
      required: true
    },

    // 类型: boolean。
    // 来源: HomeView 从 pages.home.hotMovies.transaction.status 派生。
    // true: 热门电影正在请求，分页按钮禁用。
    // false: 分页按钮按 pagination 边界决定可用性。
    paging: {
      type: Boolean,
      default: false
    },

    // ranking 驱动右侧电影排行榜。
    // 渲染位置：`HotRanking :items="ranking"`。
    ranking: {
      type: Array,
      required: true
    },

    // rankingRefreshing 控制右侧电影排行榜刷新按钮状态。
    // true: 当前电影排行榜正在重新请求数据，刷新按钮禁用并显示刷新中。
    // false: 当前电影排行榜可以触发局部刷新。
    rankingRefreshing: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    /**
     * 读取热门电影区块的统一路由分派标识。
     * 纯函数: 返回模块级常量，不读取或修改组件状态。
     * 使用方: 标题“更多”、HotRanking rankingKey 和 open-more-ranking 事件。
     *
     * @returns {string} HomeView 可识别的 movieRanking 模块标识。
     */
    rankingKey() {
      return MOVIE_RANKING_KEY;
    },

    /**
     * 左侧电影卡片区是否有数据。
     * 纯函数: 只读取 displayMovies，不修改组件、Store 或传入数组。
     *
     * @returns {boolean} 有电影数据时返回 true。
     */
    hasMovies() {
      return this.displayMovies.length > 0;
    },

    /**
     * 首页实际展示的电影卡片。
     * 纯函数: 过滤父级数组中的空项，返回当前远程页副本，不修改输入数组。
     *
     * @returns {Array<object>} Provider 当前页返回的有效电影数据。
     */
    displayMovies() {
      // 返回值类型: Array<object>；作用: 保留当前远程页全部有效条目，总量边界由 Provider 分页响应决定。
      return Array.isArray(this.movies) ? this.movies.filter(Boolean) : [];
    }
  },

  methods: {
    /**
     * 向首页页面层转发热门电影分页意图。
     * 触发来源: HomeSectionPagination 的 change-page 事件。
     * 副作用: 只派发带 hotMovies 身份的 change-page，不请求网络或修改 pagination prop。
     * 失败路径: 非正整数目标页不派发，避免页面收到非法请求。
     *
     * @param {number} targetPage 用户点击得到的相邻目标页码。
     * @returns {void} 有效时通知 HomeView 请求热门电影目标页。
     */
    handleChangePage(targetPage) {
      // 条件分支: 目标页不是正整数时进入；执行内容: 阻止非法分页事件继续向页面层传播。
      if (!Number.isInteger(targetPage) || targetPage < 1) {
        return;
      }

      // 事件: change-page；参数: object，包含热门电影模块身份和目标页码。
      this.$emit('change-page', {
        moduleKey: HOT_MOVIE_MODULE_KEY,
        page: targetPage
      });
    },

    /**
     * 向首页页面层转发电影排行榜刷新事件。
     * 触发来源: HotRanking 的 @refresh-ranking 事件。
     * 执行内容: 不在展示组件内请求数据，只把 rankingKey 继续抛给 HomeView。
     * 副作用: 发出 refresh-ranking 组件事件，不修改本地或领域状态。
     *
     * @param {string} rankingKey 需要刷新的首页排行榜数据桶名称。
     * @returns {void} 该方法只触发组件事件，不返回业务数据。
     */
    handleRefreshRanking(rankingKey) {
      // 事件: refresh-ranking。
      // 作用: 通知 HomeView 重新请求 movieRanking 数据桶。
      // 参数: rankingKey，string，当前需要刷新的排行榜数据桶。
      this.$emit('refresh-ranking', rankingKey);
    },

    /**
     * 向首页页面层转发电影更多入口事件。
     * 触发来源: 标题“更多”click 或 HotRanking 的 @open-more-ranking 事件。
     * 执行内容: 不在区块组件内直接操作路由，只把 rankingKey 继续抛给 HomeView。
     * 副作用: 发出 open-more-ranking 组件事件，不修改本地或领域状态。
     *
     * @param {string} rankingKey 需要查看更多内容的首页排行榜数据桶名称。
     * @returns {void} 该方法只触发组件事件，不返回业务数据。
     */
    handleOpenMoreRanking(rankingKey) {
      // 事件: open-more-ranking。
      // 作用: 通知 HomeView 按 movieRanking 跳转到电影承接页面。
      // 参数: rankingKey，string，当前点击查看更多的排行榜数据桶。
      this.$emit('open-more-ranking', rankingKey);
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 热门电影区块外层容器 `.section-wrapper`。
  样式作用:
  控制热门电影区块和下一个首页区块之间的垂直距离。
*/
.section-wrapper {
  /* 设置热门电影区块底部间距，让热门电影和热门电视剧区块不会贴在一起。 */
  margin-bottom: 36px;
}

/*
  作用容器: 热门电影标题栏 `.section-head`。
  样式作用:
  复用主体六列轨道分别放置标题、分页和“更多”。
  分页对齐第 4 列卡片右边界，“更多”保持完整区块最右侧。
*/
.section-head {
  /* 标题栏横跨第一行完整六列，保留“更多”原有的全区块右边界。 */
  grid-column: 1 / -1;

  /* 标题栏固定在主体第一行，排行榜只从第二行开始。 */
  grid-row: 1;

  /* 使用 Grid 让三个入口按页面列线独立定位，避免移动分页时连带移动“更多”。 */
  display: grid;

  /* 复用主体六列结构，使分页和更多分别对齐第 4、6 列右边界。 */
  grid-template-columns: repeat(var(--page-layout-columns), minmax(0, 1fr));

  /* 设置标题和更多入口垂直居中，避免两者基线明显错位。 */
  align-items: center;

  /* 标题栏内部列间距与下方卡片和排行榜共用页面栅格节奏。 */
  gap: var(--page-grid-gap);

  /* Grid 行间距统一控制标题与卡片距离，标题栏自身不再额外叠加外边距。 */
  margin-bottom: 0;
}

/*
  作用容器: 热门电影分页 `.section-pagination`。
  样式作用: 占据标题栏第 3 至 4 列，并把右边界对齐到电影卡片区域末端。
*/
.section-pagination {
  /* 分页占标题栏中间两列，对应下方电影卡片区的后两列。 */
  grid-column: 3 / span 2;

  /* 分页贴向第 4 列右边界，不侵入排行榜上方。 */
  justify-self: end;
}

/*
  作用容器: 热门电影标题 `.section-title`。
  样式作用:
  强化热门电影区块标题层级。
  使用左侧强调线标记首页内容区块起点。
*/
.section-title {
  /* 标题占前两列并保持左对齐，为中间分页预留独立轨道。 */
  grid-column: 1 / span 2;

  /* 标题贴向完整区块左边界，不受分页宽度影响。 */
  justify-self: start;

  /* 设置区块标题字号，让热门电影标题明显高于卡片标题。 */
  font-size: 22px;

  /* 设置区块标题加粗，强化内容区块起点。 */
  font-weight: 700;

  /* 设置区块标题颜色为主文字色，保证浅色页面背景上的可读性。 */
  color: var(--text-primary);

  /* 清除标题默认底部外边距，避免标题栏高度被浏览器默认样式撑开。 */
  margin-bottom: 0;

  /* 设置标题文字左侧留白，让标题和蓝色竖线之间有呼吸空间。 */
  padding-left: 14px;

  /* 设置标题左侧强调线，用于统一首页区块标题视觉。 */
  border-left: 4px solid var(--accent);
}

/*
  作用容器: 热门电影更多入口 `.section-more-link`。
  样式作用:
  作为热门电影区块右侧的更多入口占位。
  保持次级操作视觉，不抢区块标题层级。
*/
.section-more-link {
  /* “更多”继续占标题栏最后两列，保持引入分页前的全区块右侧位置。 */
  grid-column: 5 / span 2;

  /* 按钮贴向第 6 列右边界，不随卡片区分页位置移动。 */
  justify-self: end;

  /* 设置更多入口为 inline-flex，方便文字和伪元素箭头垂直居中。 */
  display: inline-flex;

  /* 设置更多入口内部文字和箭头垂直居中。 */
  align-items: center;

  /* 禁止更多入口被标题挤压变形，保持自身内容宽度。 */
  flex: 0 0 auto;

  /* 设置更多入口字号低于区块标题，表达次级操作层级。 */
  font-size: 14px;

  /* 设置更多入口默认颜色为弱提示色，避免抢热门电影标题层级。 */
  color: var(--text-muted);

  /* 清除按钮默认背景，让更多入口更像轻量文本操作。 */
  background: transparent;

  /* 清除按钮默认边框，避免更多入口像主操作按钮。 */
  border: 0;

  /* 清除按钮默认内边距，让它和文本入口视觉一致。 */
  padding: 0;

  /* 鼠标移入时显示可点击状态，为后续跳转电影页预留交互反馈。 */
  cursor: pointer;

  /* 清除文本下划线，让更多入口贴近站内操作风格。 */
  text-decoration: none;

  /* 设置颜色过渡，让 hover 状态切换更柔和。 */
  transition: color 0.18s ease;
}

/*
  作用容器: 热门电影更多入口箭头 `.section-more-link::after`。
  样式作用:
  在更多入口文字后追加轻量箭头。
  不引入额外图标组件也能表达可进入更多内容。
*/
.section-more-link::after {
  /* 设置伪元素内容为右箭头符号，提示更多入口可继续进入。 */
  content: '>';

  /* 设置箭头和文字之间的距离，避免两个字符贴在一起。 */
  margin-left: 4px;

  /* 设置箭头字号略小于文字，让箭头保持辅助层级。 */
  font-size: 12px;
}

/*
  作用容器: 热门电影更多入口悬停态 `.section-more-link:hover`。
  样式作用:
  提示用户当前更多入口可以点击。
  使用主题强调色和默认弱提示色形成状态差异。
*/
.section-more-link:hover {
  /* 设置更多入口悬停时变为主题蓝色，让用户感知可交互状态。 */
  color: var(--accent);
}

/*
  作用容器: 热门电影主体布局 `.section-body`。
  样式作用:
  建立左侧四列电影卡片和右侧电影排行榜的 6 列布局。
  通过 CSS Grid 的行高拉伸，让右侧排行榜跟随左侧两行电影卡片真实高度。
  让电影排行榜贴合主体栅格最右列，右侧留白统一交给页面容器处理。
*/
.section-body {
  /* 设置热门电影主体为 CSS Grid，用 6 列承载左侧卡片区和右侧排行榜。 */
  display: grid;

  /* 设置热门电影主体使用固定页面结构栅格，避免目录卡片响应式列数改变首页 4 + 2 区域关系。 */
  grid-template-columns: repeat(var(--page-layout-columns), minmax(0, 1fr));

  /* 两列区域使用统一页面栅格间距，标题行与内容行也共享同一节奏。 */
  gap: var(--page-grid-gap);

  /* 把主体布局尺寸按边框盒计算，避免后续新增内边距或边框时撑出横向滚动。 */
  box-sizing: border-box;

  /* 设置 grid 子项按当前行真实高度拉伸，让电影排行榜和左侧两行卡片底部自然对齐。 */
  align-items: stretch;
}

/*
  作用容器: 热门电影卡片网格 `.section-grid`。
  样式作用:
  按首页统一卡片列数变量排列热门电影卡片。
  和右侧排行榜共同构成首页热门电影双栏区块。
*/
.section-grid {
  /* 设置电影卡片区内部为 grid，让当前远程页条目按统一列数自然换行。 */
  display: grid;

  /* 设置电影卡片区占据第二行前 4 列，与标题栏共享左右列线。 */
  grid-column: 1 / span 4;

  /* 电影卡片固定进入第二行，让排行榜顶部与首排卡片对齐。 */
  grid-row: 2;

  /* 读取首页统一卡片列数变量，让电影区和电视剧区共享同一套响应式密度。 */
  grid-template-columns: repeat(var(--home-card-grid-columns), minmax(0, 1fr));

  /* 设置电影卡片之间的横向和纵向距离，保持和页面栅格统一。 */
  gap: var(--page-grid-gap);

  /* 允许电影卡片网格收缩，避免长标题或角标把首页横向撑宽。 */
  min-width: 0;

  /* 设置多行电影卡片从顶部开始堆叠，不因右侧排行榜高度产生拉散。 */
  align-content: start;
}

/*
  作用容器: 热门电影右侧排行榜列 `.section-aside`。
  样式作用:
  承载电影排行榜组件。
  跟随 CSS Grid 行高拉伸到左侧两行电影卡片的真实高度。
  隔离排行榜内容自身高度，避免右侧榜单反过来撑高整行。
  让排行榜内部列表在固定高度内滚动。
*/
.section-aside {
  /* 设置电影排行榜列占据第二行最后 2 列，不侵入标题栏所在第一行。 */
  grid-column: 5 / span 2;

  /* 排行榜固定进入第二行，使顶部与首排电影卡片一致。 */
  grid-row: 2;

  /* 允许电影排行榜列收缩，避免榜单标题或条目撑破右侧列宽。 */
  min-width: 0;

  /* 清除浏览器默认最小高度影响，让内部排行榜能在固定高度内滚动。 */
  min-height: 0;

  /* 让电影排行榜列跟随 grid 当前行高度拉伸，不再用固定或推导高度。 */
  align-self: stretch;

  /* 隔离电影排行榜内容尺寸贡献，让 grid 行高只由左侧两行电影卡片决定。 */
  contain: size;

  /* 裁掉排行榜面板外部溢出，内部列表可见条数由 HotRanking 根据高度计算。 */
  overflow: hidden;

  /* 设置排行榜列为 flex 容器，让内层壳可以在 2 格父容器中右对齐。 */
  display: flex;

  /* 设置内层排行榜壳贴向右侧，让榜单右边界继续对齐页面内容右边界。 */
  justify-content: flex-end;
}

/*
  作用容器: 热门电影排行榜内层壳 `.ranking-panel-shell`。
  样式作用:
  在 2 个格栅宽度的父容器内，把实际排行榜面板收窄到 1.6 个格栅。
  通过右对齐保留页面右侧边界一致性。
  把视觉收窄职责放在壳层，避免 HotRanking 组件知道首页布局细节。
*/
.ranking-panel-shell {
  /* 设置排行榜实际宽度为父容器 80%，即 2 格中的 1.6 格。 */
  width: 80%;

  /* 允许排行榜壳在父容器中收缩，避免长榜单内容撑破右侧区域。 */
  min-width: 0;

  /* 设置壳层高度填满右侧父容器，保证榜单底部仍和两行卡片对齐。 */
  height: 100%;

  /* 设置壳层为 flex，让 HotRanking 根节点自然填满壳层。 */
  display: flex;
}

/*
  作用容器: 热门电影单个卡片单元 `.card-cell`。
  样式作用:
  包裹单张 UserVideoCard。
  兜底限制长标题或角标不把当前栅格列撑宽。
*/
.card-cell {
  /* 允许单个电影卡片单元在栅格内收缩，保护四列布局宽度稳定。 */
  min-width: 0;
}

/*
  电影卡片分区空状态。
  对应 template 中 `{el-empty.section-empty}`，只在 movies 为空时显示。
*/
.section-empty {
  /* 空态占据第二行前四列，与有内容时的电影卡片区域位置一致。 */
  grid-column: 1 / span 4;

  /* 空态保持在标题栏下方，不让排行榜移动到第一行。 */
  grid-row: 2;

  /* 保持和两行四列卡片区接近的高度，避免只有榜单时左侧塌陷。 */
  min-height: 330px;

  /* 使用通用面板背景，让空状态看起来仍是一个内容分区。 */
  background: var(--surface-soft);

  /* 用虚线边框表达“这里是可填充内容区”。 */
  border: 1px dashed var(--border-color);
}

/*
  响应式断点: max-width 1279.98px，用小数上限消除高分屏或缩放环境中的分数像素空档。
  作用范围: 未达到高密度卡片最小可读宽度的桌面、平板和手机热门电影区块。
  样式作用:
  把左侧卡片和右侧排行榜改成上下堆叠。
  让首页卡片获得整行四列宽度，保证卡片时间字段完整可读。
  取消右侧排行榜额外呼吸间隙，避免移动端内容变窄。
*/
@media (max-width: 1279.98px) {
  /*
    作用容器: 平板宽度下的热门电影主体 `.section-body`。
    样式作用:
    将双栏布局改为单列上下布局。
    保证电影卡片区和排行榜都能获得完整行宽。
  */
  .section-body {
    /* 设置热门电影主体为单列布局，让卡片区在上、排行榜在下。 */
    grid-template-columns: 1fr;

    /* 移除右侧呼吸间隙，避免排行榜在单列布局下被额外压窄。 */
    padding-right: 0;
  }

  /*
    作用容器: 平板宽度下的热门电影卡片网格 `.section-grid`。
    样式作用:
    让电影卡片区占满整行。
    卡片列数继续由全局首页卡片变量统一控制。
  */
  .section-grid {
    /* 设置电影卡片区占满单列布局整行。 */
    grid-column: 1 / -1;

    /* 单列堆叠恢复自然行顺序，位于标题栏之后。 */
    grid-row: auto;

  }

  .section-head {
    /* 平板及以下标题栏占满单列主体。 */
    grid-column: 1 / -1;

    /* 由 DOM 顺序决定标题栏、内容和排行榜的垂直位置。 */
    grid-row: auto;

    /* 窄屏按标题、分页、更多三列排布，三个入口仍保持独立职责。 */
    grid-template-columns: minmax(0, 1fr) auto auto;

    /* 窄屏缩小三项间距，避免入口挤出可视区域。 */
    gap: 12px;
  }

  .section-title {
    /* 窄屏标题使用第一列剩余空间。 */
    grid-column: 1;
  }

  .section-pagination {
    /* 窄屏分页使用自然宽度中间列。 */
    grid-column: 2;
  }

  .section-more-link {
    /* 窄屏“更多”继续处于标题栏最右列。 */
    grid-column: 3;
  }

  .section-empty {
    /* 平板及以下空态占满单列主体。 */
    grid-column: 1 / -1;

    /* 空态按 DOM 顺序位于标题栏之后。 */
    grid-row: auto;
  }

  /*
    作用容器: 平板宽度下的热门电影排行榜列 `.section-aside`。
    样式作用:
    让排行榜排到电影卡片区下方并占满整行。
    恢复自动高度，避免移动端固定高度限制排行榜展示。
  */
  .section-aside {
    /* 设置电影排行榜列占满整行，跟随卡片区下方展示。 */
    grid-column: 1 / -1;

    /* 单列堆叠时排行榜回到卡片之后的自然行。 */
    grid-row: auto;

    /* 恢复排行榜列自动高度，让榜单内容在窄屏下自然展开。 */
    height: auto;

    /* 取消宽屏侧栏的尺寸隔离，让完整榜单参与页面正常高度计算。 */
    contain: none;

    /* 取消宽屏侧栏裁切，堆叠模式由页面整体承载完整榜单。 */
    overflow: visible;

    /* 堆叠模式不再拉伸到固定 grid 行高。 */
    align-self: auto;

    /* 恢复普通块级布局，减少窄屏下不必要的 flex 高度约束。 */
    display: block;
  }

  /*
    作用容器: 平板宽度下的热门电影排行榜内层壳 `.ranking-panel-shell`。
    样式作用:
    单列布局下取消 1.5 格收窄。
    让排行榜在卡片区下方占满可用宽度。
  */
  .ranking-panel-shell {
    /* 设置窄屏下排行榜壳占满整行，避免右侧对齐逻辑造成无意义留白。 */
    width: 100%;

    /* 取消宽屏侧栏高度约束，让排行榜按完整内容自然展开。 */
    height: auto;
  }
}

/*
  响应式断点: max-width 640px。
  作用范围: 手机宽度下的热门电影区块。
  样式作用:
  收紧标题栏间距。
  降低更多入口字号。
  电影卡片列数由全局首页卡片变量统一调整为两列。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机宽度下的热门电影标题栏 `.section-head`。
    样式作用:
    缩小标题和更多入口之间的基础间距。
    给窄屏标题保留更多可用宽度。
  */
  .section-head {
    /* 手机端进一步缩小标题、分页和更多之间的间距，保持单行。 */
    gap: 8px;
  }

  /*
    作用容器: 手机宽度下的热门电影更多入口 `.section-more-link`。
    样式作用:
    降低右侧更多入口字号。
    给左侧热门电影标题让出更多空间。
  */
  .section-more-link {
    /* 设置手机端更多入口字号更小，降低标题栏横向压力。 */
    font-size: 13px;
  }

}
</style>
