<template>
  <!--
    HomeView 页面渲染树

    [DEFAULT] ele(div.theme-page.home-page)
    │  - condition:
    │      默认渲染；loading 为 true 时展示首页加载遮罩。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      首页根容器。
    │      承载数据源切换、首页内容分支和整页空状态。
    │  - params:
    │      -- loading：首页数据请求状态。
    │  - events: 无
    │
    ├─ [DEFAULT] ele(SourceSwitchTabs)
    │  - condition:
    │      首页默认渲染数据源切换入口。
    │  - type:
    │      自定义组件
    │      相对位置: ../components/source/SourceSwitchTabs.vue
    │  - description:
    │      首页数据源切换组件。
    │      展示 sourceTabs 并高亮 activeSourceId。
    │  - params:
    │      -- sourceTabs：可用数据源列表。
    │      -- activeSourceId：当前选中数据源 id。
    │  - events: 无
    │
    ├─ [IF hasHomeContent] ele(template.home-content)
    │  - condition:
    │      首页任一内容数据桶存在条目时渲染。
    │  - type:
    │      Vue 内置模板节点
    │      标签名称: template
    │  - description:
    │      首页内容分支。
    │      组合轮播、热门电影和热门电视剧三个业务组件。
    │  - params:
    │      -- banners：首页轮播列表。
    │      -- movies/tvList：首页热门内容列表。
    │      -- movieRanking/tvRanking：首页排行榜列表。
    │  - events:
    │      @refresh-ranking / @open-more-ranking
    │          - description:
    │              用户刷新榜单或打开更多榜单时由首页统一处理。
    │          - methods:
    │              refreshHomeRanking(rankingKey)
    │              handleOpenMoreRanking(rankingKey)
    │
    │  ├─ [DEFAULT] ele(HomeCarousel)
    │  │  - condition:
    │  │      hasHomeContent 成立后默认挂载，组件内部处理 banners 空状态。
    │  │  - type:
    │  │      自定义组件
    │  │      相对位置: ../components/home/HomeCarousel.vue
    │  │  - description:
    │  │      首页轮播组件。
    │  │      展示 banners 推荐内容。
    │  │  - params:
    │  │      -- banners：首页轮播列表。
    │  │  - events: 无
    │  │
    │  ├─ [DEFAULT] ele(HotMovieSection)
    │  │  - condition:
    │  │      hasHomeContent 成立后默认挂载，组件内部处理电影列表和榜单空状态。
    │  │  - type:
    │  │      自定义组件
    │  │      相对位置: ../components/home/HotMovieSection.vue
    │  │  - description:
    │  │      首页热门电影组件。
    │  │      展示 movies 和 movieRanking，并回传榜单操作。
    │  │  - params:
    │  │      -- movies：首页热门电影列表。
    │  │      -- movieRanking：电影排行榜列表。
    │  │  - events:
    │  │      @refresh-ranking / @open-more-ranking
    │  │          - description:
    │  │              用户刷新或打开更多电影榜单时回传首页。
    │  │          - methods:
    │  │              refreshHomeRanking(rankingKey)
    │  │              handleOpenMoreRanking(rankingKey)
    │  │
    │  └─ [DEFAULT] ele(HotTVSection)
    │     - condition:
    │         hasHomeContent 成立后默认挂载，组件内部处理电视剧列表和榜单空状态。
    │     - type:
    │         自定义组件
    │         相对位置: ../components/home/HotTVSection.vue
    │     - description:
    │         首页热门电视剧组件。
    │         展示 tvList 和 tvRanking，并回传榜单操作。
    │     - params:
    │         -- tvList：首页热门电视剧列表。
    │         -- tvRanking：电视剧排行榜列表。
    │     - events:
    │         @refresh-ranking / @open-more-ranking
    │             - description:
    │                 用户刷新或打开更多电视剧榜单时回传首页。
    │             - methods:
    │                 refreshHomeRanking(rankingKey)
    │                 handleOpenMoreRanking(rankingKey)
    │
    └─ [ELSE] ele(el-empty.home-empty)
       - condition:
           hasHomeContent 不成立时渲染。
       - type:
           第三方组件
           组件库: Element UI
           组件名称: el-empty
       - description:
           首页整页空状态。
           当前数据源没有任何首页内容时避免页面显示为空白。
       - params:
           -- description：固定的首页无内容说明。
       - events: 无
  -->
  <!--
    首页页面。
    作用：组织首页轮播、热门电影、热门电视剧和榜单区域，并保持各内容区块的统一视觉结构。
  -->
  <div class="theme-page home-page" v-loading="loading">
    <!--
      [DEFAULT] ele(SourceSwitchTabs)
      - condition:
          默认渲染。
          首页进入后展示静态数据源 tab 区域。
      - type:
          自定义组件
          相对位置: ../components/source/SourceSwitchTabs.vue
      - description:
          首页顶部数据源静态 tab。
          展示当前项目可用数据源，并高亮默认选中的系统数据源1。
      - params:
          -- sourceTabs：首页可展示的数据源 tab 列表。
          -- activeSourceId：首页默认高亮的数据源 id。
      - events: 无
    -->
    <SourceSwitchTabs
      :sources="sourceTabs"
      :active-source-id="activeSourceId"
      aria-label="首页数据源"
    />

    <!--
      首页内容分支。
      渲染条件：`hasHomeContent` 为 true，也就是统一内容 store 中五个首页数据桶至少有一个桶有数据。
      页面作用：进入该分支后，三个首页子模块都会挂载，并直接接收统一 ContentItem 列表。
    -->
    <template v-if="hasHomeContent">
      <!-- 首页通栏轮播区域，组件内部根据 banners 是否为空决定显示轮播或空状态。 -->
      <HomeCarousel :banners="banners" />

      <!-- 热门电影区域，左侧电影卡片区和右侧电影榜单区各自处理自己的空状态。 -->
      <HotMovieSection
        :movies="movies"
        :ranking="movieRanking"
        :ranking-refreshing="isRankingRefreshing('movieRanking')"
        @refresh-ranking="refreshHomeRanking"
        @open-more-ranking="handleOpenMoreRanking" />

      <!-- 热门电视剧区域，左侧电视剧卡片区和右侧电视剧榜单区各自处理自己的空状态。 -->
      <HotTVSection
        :tv-list="tvList"
        :ranking="tvRanking"
        :ranking-refreshing="isRankingRefreshing('tvRanking')"
        @refresh-ranking="refreshHomeRanking"
        @open-more-ranking="handleOpenMoreRanking" />
    </template>

    <!--
      首页整页空状态。
      渲染条件：统一内容 store 中五个首页数据桶全部为空。
      页面作用：说明当前首页没有任何可展示内容，而不是让用户看到一片空白。
    -->
    <el-empty
      v-else
      class="home-empty"
      description="暂无可展示的首页内容" />
  </div>
</template>

<script>
/*
  HomeView.vue 模块说明

  - 文件职责:
      编排首页数据源切换、轮播、热门内容和排行榜。
      通过统一请求服务填充首页数据桶，并通过 selector 读取标准 ContentItem。

  - 导入库及文件汇总(7 条，内置 0 条，第三方 0 条，自定义 7 条):
      HomeCarousel: 自定义组件，渲染首页顶部轮播区域。
      HotMovieSection: 自定义组件，渲染首页热门电影卡片和电影排行榜。
      HotTVSection: 自定义组件，渲染首页热门电视剧卡片和电视剧排行榜。
      SourceSwitchTabs: 自定义组件，渲染首页顶部数据源 tab。
      sourceSwitchData: 自定义数据，提供静态数据源 tab 列表。
      requestSourceData: 自定义服务，按 SourceDataRequest 请求首页各数据桶。
      getBucketItems: 自定义 store selector，根据首页数据桶 itemKeys 从实体池解析完整 ContentItem 列表。

  - 模块级常量:
      HOME_BUCKET_REQUESTS: Array<object>，首页首次进入时需要请求的数据桶清单。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      HomeView: Vue 路由页面组件，供 home 路由展示首页内容。
*/

// 导入来源: ../components/home/HomeCarousel.vue。
// 导入内容: HomeCarousel 首页轮播组件。
// 文件作用: 用于渲染首页顶部重点内容区域。
import HomeCarousel from '../components/home/HomeCarousel.vue';

// 导入来源: ../components/home/HotMovieSection.vue。
// 导入内容: HotMovieSection 首页热门电影组件。
// 文件作用: 用于渲染首页热门电影卡片区和电影排行榜。
import HotMovieSection from '../components/home/HotMovieSection.vue';

// 导入来源: ../components/home/HotTVSection.vue。
// 导入内容: HotTVSection 首页热门电视剧组件。
// 文件作用: 用于渲染首页热门电视剧卡片区和电视剧排行榜。
import HotTVSection from '../components/home/HotTVSection.vue';

// 导入来源: ../components/source/SourceSwitchTabs.vue。
// 导入内容: SourceSwitchTabs 自定义组件。
// 文件作用: 用于在首页顶部渲染静态数据源 tab。
import SourceSwitchTabs from '../components/source/SourceSwitchTabs.vue';

// 导入来源: ../data/source-switch.mock。
// 导入内容: sourceSwitchData 顶部数据源静态数据。
// 文件作用: 给首页 SourceSwitchTabs 提供数据源列表和默认高亮源。
import { sourceSwitchData } from '../data/source-switch.mock';

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 首页通过该函数请求 banners、hotMovies、hotTv、movieRanking 和 tvRanking 五个数据桶。
import { requestSourceData } from '../services/sourceDataService.js';

// 导入来源: ../store/siteContentStore。
// 导入内容: getBucketItems 首页数据桶 selector。
// 文件作用: 首页通过 selector 从 itemKeys 解析完整 ContentItem，不再直接读取数据桶内部内容字段。
import { getBucketItems } from '../store/siteContentStore.js';

// 类型: Array<object>。
// 作用: 定义首页首次进入时需要请求的五个数据桶，保证页面数据来源统一经过 sourceDataService。
// 条目字段: moduleKey，string，首页数据桶名称，用于 provider 返回对应区域数据。
// 条目字段: params，object，当前桶请求参数，page/pageSize 控制 mock provider 返回的当前页数量。
const HOME_BUCKET_REQUESTS = [
  {
    // 类型: string。
    // 作用: 请求首页轮播图数据桶。
    moduleKey: 'banners',

    // 类型: object。
    // 作用: 首页轮播最多取 6 条，避免轮播分页点过多。
    params: {
      page: 1,
      pageSize: 6
    }
  },
  {
    // 类型: string。
    // 作用: 请求首页热门电影卡片数据桶。
    moduleKey: 'hotMovies',

    // 类型: object。
    // 作用: 首页热门电影区固定展示 8 条，刚好组成两行四列。
    params: {
      page: 1,
      pageSize: 8
    }
  },
  {
    // 类型: string。
    // 作用: 请求首页热门电视剧卡片数据桶。
    moduleKey: 'hotTv',

    // 类型: object。
    // 作用: 首页热门电视剧区固定展示 8 条，刚好组成两行四列。
    params: {
      page: 1,
      pageSize: 8
    }
  },
  {
    // 类型: string。
    // 作用: 请求首页电影排行榜数据桶。
    moduleKey: 'movieRanking',

    // 类型: object。
    // 作用: 排行榜请求 20 条候选数据，由 HotRanking 根据容器高度截断展示，不出现内部滚动条。
    params: {
      page: 1,
      pageSize: 20
    }
  },
  {
    // 类型: string。
    // 作用: 请求首页电视剧排行榜数据桶。
    moduleKey: 'tvRanking',

    // 类型: object。
    // 作用: 排行榜请求 20 条候选数据，由 HotRanking 根据容器高度截断展示，不出现内部滚动条。
    params: {
      page: 1,
      pageSize: 20
    }
  }
];

export default {
  // 组件名称用于在调试工具和报错信息中识别首页页面组件。
  name: 'HomeView',

  // 注册当前模板中使用的首页子组件。
  components: {
    // <HomeCarousel /> 对应首页顶部轮播区域。
    HomeCarousel,

    // <HotMovieSection /> 对应首页热门电影区域。
    HotMovieSection,

    // <HotTVSection /> 对应首页热门电视剧区域。
    HotTVSection,

    // <SourceSwitchTabs /> 对应首页轮播图上方的数据源静态 tab 区域。
    SourceSwitchTabs
  },

  /**
   * 创建首页请求和数据源选择状态。
   * 纯函数: 为每个 HomeView 实例返回独立状态对象，不修改 store 或演示数据。
   *
   * @returns {object} 首页响应式状态。
   * @returns {boolean} return.loading true 显示首页加载遮罩，false 显示已解析内容或空状态。
   * @returns {string} return.activeSourceId 当前首页请求使用的数据源标识。
   */
  data() {
    return {
      // 类型: boolean。
      // 初始值: true，页面首次进入时立即显示加载遮罩，避免数据桶尚未回填时短暂显示整页空态。
      // 作用: 控制首页根容器上的 Element UI 加载遮罩。
      // true: 首页正在请求统一内容数据桶。
      // false: 首页请求结束，页面展示数据、局部空态或整页空态。
      loading: true,

      // 类型: string。
      // 初始值: 空字符串，表示首页尚未发生请求错误。
      // 作用: 保存首页统一数据流请求失败时的错误文案，当前仅作为调试状态保留。
      loadError: '',

      // 类型: Array<object>。
      // 初始值: sourceSwitchData.sources。
      // 作用: 驱动首页顶部数据源静态 tab；当前只展示，不触发真实切换。
      sourceTabs: this.asList(sourceSwitchData.sources),

      // 类型: string。
      // 初始值: sourceSwitchData.activeSourceId。
      // 作用: 控制首页顶部数据源 tab 的默认高亮项；当前内容请求仍使用 mock provider 默认数据源。
      activeSourceId: sourceSwitchData.activeSourceId,

      // 类型: string。
      // 初始值: 空字符串，表示当前没有正在局部刷新的排行榜数据桶。
      // 作用: 保存正在重新请求的首页排行榜 moduleKey，用于控制对应 HotRanking 的刷新按钮状态。
      refreshingRankingModuleKey: ''
    };
  },

  computed: {
    /**
     * 首页轮播展示数据。
     * 来源: getBucketItems('home', 'banners')。
     * 执行内容: 通过 selector 从首页 banners.itemKeys 解析统一 ContentItem 列表，由 HomeCarousel 自己读取所需展示字段。
     *
     * @returns {Array<object>} 首页轮播展示列表。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    banners() {
      // 返回值类型: Array<object>。
      // 作用: 返回首页轮播 ContentItem 列表，字段解释和展示兜底交给 HomeCarousel 组件负责。
      return this.getHomeBucketItems('banners');
    },

    /**
     * 首页热门电影展示数据。
     * 来源: getBucketItems('home', 'hotMovies')。
     * 执行内容: 通过 selector 从首页 hotMovies.itemKeys 解析统一 ContentItem 列表，由 UserVideoCard 注入用户状态后交给 VideoCard 展示。
     *
     * @returns {Array<object>} 首页热门电影列表。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    movies() {
      // 返回值类型: Array<object>。
      // 作用: 返回热门电影 ContentItem 列表，供 HotMovieSection 传给 UserVideoCard 渲染。
      return this.getHomeBucketItems('hotMovies');
    },

    /**
     * 首页热门电视剧展示数据。
     * 来源: getBucketItems('home', 'hotTv')。
     * 执行内容: 通过 selector 从首页 hotTv.itemKeys 解析统一 ContentItem 列表，由 UserVideoCard 注入用户状态后交给 VideoCard 展示。
     *
     * @returns {Array<object>} 首页热门电视剧列表。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    tvList() {
      // 返回值类型: Array<object>。
      // 作用: 返回热门电视剧 ContentItem 列表，供 HotTVSection 传给 UserVideoCard 渲染。
      return this.getHomeBucketItems('hotTv');
    },

    /**
     * 首页电影排行榜展示数据。
     * 来源: getBucketItems('home', 'movieRanking')。
     * 执行内容: 通过 selector 从首页 movieRanking.itemKeys 解析统一 ContentItem 列表，由 HotRanking 自己读取 rank、genres、score 和 year。
     *
     * @returns {Array<object>} 首页电影排行榜列表。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    movieRanking() {
      // 返回值类型: Array<object>。
      // 作用: 返回电影排行榜 ContentItem 列表，供 HotMovieSection 传给 HotRanking。
      return this.getHomeBucketItems('movieRanking');
    },

    /**
     * 首页电视剧排行榜展示数据。
     * 来源: getBucketItems('home', 'tvRanking')。
     * 执行内容: 通过 selector 从首页 tvRanking.itemKeys 解析统一 ContentItem 列表，由 HotRanking 自己读取 rank、genres、score 和 year。
     *
     * @returns {Array<object>} 首页电视剧排行榜列表。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    tvRanking() {
      // 返回值类型: Array<object>。
      // 作用: 返回电视剧排行榜 ContentItem 列表，供 HotTVSection 传给 HotRanking。
      return this.getHomeBucketItems('tvRanking');
    },

    /**
     * 首页是否至少有一个模块存在数据。
     *
     * 页面作用：
     * - true：渲染首页轮播、电影区和电视剧区，再由各分区自己处理局部空状态
     * - false：渲染整页空状态
     *
     * @returns {boolean} 首页是否有任意模块可展示
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    hasHomeContent() {
      // 五个数组任意一个非空，就说明首页有内容入口。
      return [
        this.banners,
        this.movies,
        this.tvList,
        this.movieRanking,
        this.tvRanking
      ].some(list => list.length > 0);
    }
  },

  /**
   * Vue created 生命周期。
   * 执行时机: 组件实例创建完成，data、computed 和 methods 已可用，但真实 DOM 尚未挂载。
   * 执行内容: 请求首页五个统一内容数据桶。
   * 放置原因: 首页数据请求不依赖 DOM，放在 created 可以让首屏数据尽早进入 store。
   *
   * @returns {void} 生命周期钩子不返回业务数据。
   * 副作用: 组件创建后请求首页全部数据桶，并更新页面加载与错误状态。
   */
  created() {
    // 执行内容: 发起首页五个数据桶请求。
    // 影响范围: 请求成功后首页五个数据桶会写入最新 itemKeys，页面通过 getBucketItems('home', moduleKey) 解析为 ContentItem。
    this.loadHomeContent();
  },

  methods: {
    /**
     * 把模块数据整理成数组。
     *
     * @param {*} value 可能来自首页数据文件的任意模块值。
     * @returns {Array} 有效数组原样返回，其他值统一转为空数组。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    asList(value) {
      // 返回值类型: Array<object>。
      // 作用: 保证 template 和 computed 始终处理数组，避免 v-for 或 length 读取异常。
      return Array.isArray(value) ? value : [];
    },

    /**
     * 请求首页五个统一内容数据桶。
     * 副作用: 调用 sourceDataService，并由 service 将 SourceDataResponse 写入 siteContentStore。
     * 成功路径: 五个首页数据桶写入完成后关闭加载遮罩。
     * 失败路径: 捕获错误并写入 loadError，同时关闭加载遮罩，让页面进入当前已有数据或空态。
     *
     * @returns {Promise<void>} 首页数据桶请求完成后结束。
     */
    async loadHomeContent() {
      // 类型: boolean。
      // 作用: 进入首页数据刷新状态，驱动根容器显示 Element UI 加载遮罩。
      this.loading = true;

      // 类型: string。
      // 作用: 每次重新请求前清空旧错误，避免旧错误影响本次状态判断。
      this.loadError = '';

      try {
        // 异步并发请求: 首页五个数据桶互不依赖，可以并行向 mock provider 请求。
        // 成功结果: sourceDataService 会把每个响应写入首页对应数据桶，页面通过 getBucketItems('home', moduleKey) 读取。
        await Promise.all(HOME_BUCKET_REQUESTS.map((bucketRequest) => {
          // 返回值类型: Promise<object>。
          // 作用: 请求单个首页数据桶，并交给 service 自动写入 store。
          return requestSourceData({
            // 类型: string。
            // 作用: 标记当前请求属于首页。
            pageKey: 'home',

            // 类型: string。
            // 作用: 标记当前请求的首页数据桶名称。
            moduleKey: bucketRequest.moduleKey,

            // 类型: object。
            // 作用: 传递当前桶分页参数，控制 provider 返回多少条内容。
            params: bucketRequest.params
          });
        }));
      } catch (error) {
        // 类型: string。
        // 作用: 记录首页数据桶请求失败原因，当前用于调试，不直接改变视觉布局。
        this.loadError = error && error.message ? error.message : '首页内容数据请求失败';
      } finally {
        // 类型: boolean。
        // 作用: 结束首页数据刷新状态，让页面展示 store 中已有数据或空状态。
        this.loading = false;
      }
    },

    /**
     * 读取首页指定数据桶的完整内容列表。
     * 来源: getBucketItems('home', moduleKey)。
     * 兜底策略: selector 会在数据桶不存在、itemKeys 为空或实体缺失时返回空数组。
     *
     * @param {string} moduleKey 首页数据桶名称。
     * @returns {Array<object>} 当前首页数据桶内容列表。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    getHomeBucketItems(moduleKey) {
      // 返回值类型: Array<object>。
      // 作用: 通过统一 selector 读取首页指定数据桶内容，让页面不再直接感知 itemKeys 到实体池的解析过程。
      return getBucketItems('home', moduleKey);
    },

    /**
     * 判断指定排行榜数据桶是否正在刷新。
     * 来源: data.refreshingRankingModuleKey。
     * 执行内容: 当前 moduleKey 和正在刷新 moduleKey 一致时返回 true。
     *
     * @param {string} moduleKey 首页排行榜数据桶名称。
     * @returns {boolean} 当前排行榜是否正在局部刷新。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    isRankingRefreshing(moduleKey) {
      // 返回值类型: boolean。
      // 作用: 给 HotRanking 的 refreshing prop 提供按钮禁用态和文案切换依据。
      return this.refreshingRankingModuleKey === moduleKey;
    },

    /**
     * 读取首页数据桶请求配置。
     * 来源: HOME_BUCKET_REQUESTS。
     * 执行内容: 根据 moduleKey 找到对应分页请求参数。
     *
     * @param {string} moduleKey 首页数据桶名称。
     * @returns {object|undefined} 匹配的数据桶请求配置。
     * 纯函数: 只读取参数和当前组件状态并返回派生结果，不修改响应式状态或外部存储。
     */
    getHomeBucketRequest(moduleKey) {
      // 返回值类型: object|undefined。
      // 作用: 找到当前首页数据桶请求配置，供局部刷新复用首次加载的 page/pageSize。
      return HOME_BUCKET_REQUESTS.find(bucketRequest => bucketRequest.moduleKey === moduleKey);
    },

    /**
     * 局部刷新首页排行榜数据桶。
     * 触发来源: HotMovieSection 或 HotTVSection 转发的 @refresh-ranking 事件。
     * 执行内容: 通过 sourceDataService 重新请求指定排行榜桶，并由 service 写回 siteContentStore。
     *
     * @param {string} moduleKey 需要刷新的首页排行榜数据桶名称。
     * @returns {Promise<void>} 当前排行榜数据桶刷新完成后结束。
     * 副作用: 更新排行榜刷新状态并重新请求指定首页排行榜数据桶。
     * 成功路径: 目标排行榜桶请求成功后由 sourceDataService 写回 store，并在 finally 中解除刷新按钮禁用状态。
     * 失败路径: 请求失败时捕获错误并写入 loadError；finally 清空 refreshingRankingModuleKey，不向点击事件调用方继续抛错。
     */
    async refreshHomeRanking(moduleKey) {
      // 类型: object|undefined。
      // 作用: 根据 moduleKey 找到当前排行榜对应的请求参数。
      const bucketRequest = this.getHomeBucketRequest(moduleKey);

      // 条件分支: moduleKey 未命中首页请求清单时进入。
      // 执行内容: 直接退出，避免错误事件请求不存在的数据桶。
      if (!bucketRequest) {
        return;
      }

      // 条件分支: 当前排行榜已经在刷新时进入。
      // 执行内容: 直接退出，避免重复点击刷新按钮造成并发请求。
      if (this.refreshingRankingModuleKey === moduleKey) {
        return;
      }

      // 类型: string。
      // 作用: 标记当前正在刷新的排行榜数据桶，驱动对应 HotRanking 刷新按钮进入禁用态。
      this.refreshingRankingModuleKey = moduleKey;

      // 类型: string。
      // 作用: 发起局部刷新前清空旧错误，避免旧错误影响当前刷新状态判断。
      this.loadError = '';

      try {
        // 执行内容: 请求当前排行榜数据桶。
        // 数据流向: provider 返回 SourceDataResponse 后，sourceDataService 自动写入首页对应数据桶，页面通过 getBucketItems('home', moduleKey) 读取。
        await requestSourceData({
          // 类型: string。
          // 作用: 标记当前请求属于首页数据。
          pageKey: 'home',

          // 类型: string。
          // 作用: 标记当前需要刷新的首页排行榜数据桶。
          moduleKey,

          // 类型: object。
          // 作用: 沿用首次加载时的分页参数，保证刷新前后榜单条数一致。
          params: bucketRequest.params
        });
      } catch (error) {
        // 类型: string。
        // 作用: 记录当前排行榜局部刷新失败原因，当前用于调试和后续错误提示扩展。
        this.loadError = error && error.message ? error.message : '首页排行榜刷新失败';
      } finally {
        // 类型: string。
        // 作用: 清空局部刷新标记，让刷新按钮恢复可点击状态。
        this.refreshingRankingModuleKey = '';
      }
    },

    /**
     * 处理排行榜查看更多入口。
     * 触发来源: HotMovieSection 或 HotTVSection 转发的 @open-more-ranking 事件。
     * 执行内容: 根据排行榜数据桶跳转到电影页或电视剧页。
     *
     * @param {string} moduleKey 点击查看更多的首页排行榜数据桶名称。
     * @returns {void} 该方法只触发路由跳转，不返回业务数据。
     * 副作用: 通过 Vue Router 导航到排行榜对应的电影或电视剧目录页。
     */
    handleOpenMoreRanking(moduleKey) {
      // 类型: object。
      // 作用: 把首页排行榜数据桶映射到承接更多内容的列表页命名路由。
      const routeNameMap = {
        // 字段: movieRanking，string，电影排行榜查看更多进入电影页。
        movieRanking: 'movie',

        // 字段: tvRanking，string，电视剧排行榜查看更多进入电视剧页。
        tvRanking: 'tv'
      };

      // 类型: string|undefined。
      // 作用: 根据当前排行榜数据桶读取目标路由名称。
      const routeName = routeNameMap[moduleKey];

      // 条件分支: 当前 moduleKey 没有对应列表页时进入。
      // 执行内容: 直接退出，避免意外事件触发错误跳转。
      if (!routeName) {
        return;
      }

      // 执行内容: 跳转到对应列表页，承接排行榜更多内容。
      this.$router.push({ name: routeName }).catch((error) => {
        // 条件分支: 用户已经停留在目标页时进入。
        // 执行内容: 忽略重复导航错误，避免控制台出现无意义报错。
        if (error && error.name !== 'NavigationDuplicated') {
          // 执行内容: 非重复导航错误继续抛出，避免真正路由问题被吞掉。
          throw error;
        }
      });
    }
  }
};
</script>

<style scoped>
/*
  作用容器: `.home-page`。
  样式作用:
  首页整体容器。
  对应 template 中的 `.home-page`，负责包裹首页全部内容区域。
*/
.home-page {
  /* 首页已经由全局 `.theme-page` 控制宽度，这里只补顶部细微留白。 */
  padding-top: 4px;
}

/*
  作用容器: `.home-empty`。
  样式作用:
  首页整页空状态。
  对应 template 中的 `{el-empty.home-empty}`，只在五个首页模块全部为空时出现。
*/
.home-empty {
  /* 给空状态一个接近首屏的高度，让提示处在页面视觉中心附近。 */
  min-height: 420px;

  /* 使用通用面板样式，把空状态和页面背景区分开。 */
  background: var(--surface-soft);

  /* 给空状态外框增加细边线，保持和首页卡片区统一。 */
  border: 1px solid var(--border-color);

  /* 当前项目卡片风格偏直角，这里保持 0，与全站视觉一致。 */
  border-radius: 0;
}
</style>
