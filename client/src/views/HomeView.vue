<template>
  <!--
    HomeView 页面渲染树

    [DEFAULT] ele(div.theme-page.home-page)
    │  - condition: 首页路由挂载时默认渲染。
    │  - type: 原生标签 div。
    │  - description: 首页根容器，统一承载切换入口、内容区域、空状态和加载遮罩。
    │  - params: -- loading：当前五个首页桶是否正在请求。
    │  - events: 无
    │
    ├─ [DEFAULT] ele(SourceSwitchTabs)
    │  - condition: 默认挂载，组件根据候选和错误决定自身可见性。
    │  - type: 自定义组件 ../components/source/SourceSwitchTabs.vue。
    │  - description: 展示首页 Runtime 候选并提交活动源切换。
    │  - params: -- pageKey：home；-- ariaLabel：首页数据源。
    │  - events: @source-switched -> handleSourceSwitched()。
    │
    ├─ [IF hasHomeContent] ele(template.home-content)
    │  │  - condition: 五个首页数据桶至少一个包含内容时渲染。
    │  │  - type: Vue template 条件分支。
    │  │  - description: 组合轮播、热门电影、热门电视剧和两个排行榜。
    │  │  - params: -- banners/movies/tvList/movieRanking/tvRanking：内容 store selector 结果。
    │  │  - events: 子组件刷新与查看更多事件由本页处理。
    │  ├─ [DEFAULT] ele(HomeCarousel)
    │  ├─ [DEFAULT] ele(HotMovieSection)
    │  └─ [DEFAULT] ele(HotTVSection)
    │
    └─ [ELSE] ele(el-empty.home-empty)
       - condition: 五个首页数据桶全部为空时渲染。
       - type: 第三方组件 Element UI el-empty。
       - description: 说明当前活动源没有可展示首页内容。
       - params: -- description：固定空状态说明。
       - events: 无
  -->
  <!--
    [DEFAULT] ele(div.theme-page.home-page)
    - condition: 首页路由挂载时默认渲染。
    - type: 原生标签 div。
    - description: 组织数据源切换、首页内容和空状态，并由 loading 控制统一遮罩。
    - params: -- loading：由首次加载或切源重载修改。
    - events: 无
  -->
  <div class="theme-page home-page" v-loading="loading">
    <!--
      [DEFAULT] ele(SourceSwitchTabs)
      - condition: 首页进入后默认挂载，组件无候选且无错误时自行隐藏。
      - type: 自定义组件，相对位置 ../components/source/SourceSwitchTabs.vue。
      - description: 展示 Runtime 为首页派生的可执行源，并提交唯一原子切换事务。
      - params: -- pageKey：固定为 home，用于匹配首页 capability；-- ariaLabel：首页切换区域名称。
      - events: @source-switched -> handleSourceSwitched()，目标源真实采用成功后重新请求首页五个桶。
    -->
    <SourceSwitchTabs
      page-key="home"
      aria-label="首页数据源"
      @source-switched="handleSourceSwitched"
    />

    <!--
      [IF hasHomeContent] ele(template.home-content)
      - condition: 统一内容 store 中五个首页桶至少一个包含 ContentItem 时渲染。
      - type: Vue template 条件分支。
      - description: 挂载三个首页业务组件并向其传递标准内容对象。
      - params: -- banners/movies/tvList/movieRanking/tvRanking：由 siteContentStore selector 派生。
      - events: 子组件排行榜刷新和查看更多事件在对应节点处理。
    -->
    <template v-if="hasHomeContent">
      <!--
        [DEFAULT] ele(HomeCarousel)
        - condition: 首页内容分支进入后渲染，空列表由组件内部显示局部空态。
        - type: 自定义组件 ../components/home/HomeCarousel.vue。
        - description: 渲染首页通栏轮播。
        - params: -- banners：home.banners 数据桶的 ContentItem 数组；-- maxItems：已提交首页轮播数量。
        - events: 无
      -->
      <HomeCarousel
        :banners="banners"
        :max-items="carouselItemLimit" />

      <!--
        [DEFAULT] ele(HotMovieSection)
        - condition: 首页内容分支进入后渲染，卡片与榜单自行处理局部空态。
        - type: 自定义组件 ../components/home/HotMovieSection.vue。
        - description: 渲染热门电影卡片和电影排行榜。
        - params: -- movies/ranking：电影内容数组；-- moviePagination/moviePaging：热门电影桶分页事实与请求状态；-- rankingRefreshing：排行榜请求状态。
        - events: @change-page -> changeHomeHotPage；@refresh-ranking -> refreshHomeRanking；@open-more-ranking -> handleOpenMoreRanking。
      -->
      <HotMovieSection
        :movies="movies"
        :pagination="moviePagination"
        :paging="moviePaging"
        :ranking="movieRanking"
        :ranking-refreshing="isRankingRefreshing('movieRanking')"
        @change-page="changeHomeHotPage"
        @refresh-ranking="refreshHomeRanking"
        @open-more-ranking="handleOpenMoreRanking" />

      <!--
        [DEFAULT] ele(HotTVSection)
        - condition: 首页内容分支进入后渲染，卡片与榜单自行处理局部空态。
        - type: 自定义组件 ../components/home/HotTVSection.vue。
        - description: 渲染热门电视剧卡片和电视剧排行榜。
        - params: -- tvList/ranking：电视剧内容数组；-- tvPagination/tvPaging：热门电视剧桶分页事实与请求状态；-- rankingRefreshing：排行榜请求状态。
        - events: @change-page -> changeHomeHotPage；@refresh-ranking -> refreshHomeRanking；@open-more-ranking -> handleOpenMoreRanking。
      -->
      <HotTVSection
        :tv-list="tvList"
        :pagination="tvPagination"
        :paging="tvPaging"
        :ranking="tvRanking"
        :ranking-refreshing="isRankingRefreshing('tvRanking')"
        @change-page="changeHomeHotPage"
        @refresh-ranking="refreshHomeRanking"
        @open-more-ranking="handleOpenMoreRanking" />
    </template>

    <!--
      [ELSE] ele(el-empty.home-empty)
      - condition: hasHomeContent 为 false，即五个首页桶全部为空时渲染。
      - type: 第三方组件 Element UI el-empty。
      - description: 说明当前活动源没有首页内容，避免主区域空白。
      - params: -- description：固定用户提示。
      - events: 无
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
      组织首页真实数据源切换入口、轮播、热门电影、热门电视剧和排行榜展示。
      通过 sourceDataService 请求统一 Runtime 内容，并通过 siteContentStore selector 派生页面数据。

  - 导入库及文件汇总(8 条，内置 0 条，第三方 0 条，自定义 8 条):
      HomeCarousel: 自定义组件，渲染首页顶部轮播区域。
      HotMovieSection: 自定义组件，渲染首页热门电影卡片和电影排行榜。
      HotTVSection: 自定义组件，渲染首页热门电视剧卡片和电视剧排行榜。
      SourceSwitchTabs: 自定义组件，展示 Runtime 首页候选并执行原子活动源切换。
      requestSourceData: 自定义服务，按 SourceDataRequest 请求首页各数据桶。
      getBucketItems: 自定义 store selector，根据首页数据桶 itemKeys 从实体池解析完整 ContentItem 列表。
      getPagePagination: 自定义 store selector，读取热门区域当前分页事实。
      getPageRequestTransaction: 自定义 store selector，读取热门区域最新请求事务隔离快照。
      SITE_CONTENT_REQUEST_STATUS: 自定义枚举，判断热门区域是否正在请求。
      homeDisplaySettingsStore: 自定义 Store，提供已提交首页轮播数量。
      HOME_CAROUSEL_ITEM_LIMIT: 自定义配置，提供首页轮播请求和组件防御上限。

  - 模块级常量:
      HOME_HOT_SECTION_PAGE_SIZE: number，热门电影与电视剧每次远程请求的单页容量。
      HOME_HOT_MODULE_KEYS: Array<string>，允许标题栏分页请求的两个首页模块键。
      HOME_BUCKET_REQUESTS: Array<object>，首页首次进入时需要请求的数据桶清单。

  - 模块级辅助函数:
      无

  - 模块级变量:
      无

  - 模块级类:
      无

  - 对外导出:
      HomeView: Vue component，首页路由使用的页面组件。
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
// 文件作用: 用于在首页顶部展示 Runtime 候选，并在真实切换成功后通知页面重载五个内容桶。
import SourceSwitchTabs from '../components/source/SourceSwitchTabs.vue';

// 导入来源: ../services/sourceDataService。
// 导入内容: requestSourceData 统一内容数据请求函数。
// 文件作用: 首页通过该函数请求 banners、hotMovies、hotTv、movieRanking 和 tvRanking 五个数据桶。
import { requestSourceData } from '../services/sourceDataService.js';

import {
  // 导入来源: ../store/siteContentStore.js；导入内容: getBucketItems；文件作用: 从首页桶引用解析标准 ContentItem 列表。
  getBucketItems,
  // 导入来源: ../store/siteContentStore.js；导入内容: getPagePagination；文件作用: 读取两个热门区域的当前页和翻页边界。
  getPagePagination,
  // 导入来源: ../store/siteContentStore.js；导入内容: getPageRequestTransaction；文件作用: 从唯一桶事务派生请求中状态。
  getPageRequestTransaction,
  // 导入来源: ../store/siteContentStore.js；导入内容: SITE_CONTENT_REQUEST_STATUS；文件作用: 使用正式枚举比较 loading 状态。
  SITE_CONTENT_REQUEST_STATUS
} from '../store/siteContentStore.js';

// 导入来源: ../store/homeDisplaySettingsStore.js；导入内容: homeDisplaySettingsStore；文件作用: 读取 Repository 已提交的首页轮播数量。
import { homeDisplaySettingsStore } from '../store/homeDisplaySettingsStore.js';

// 导入来源: ../config/homeDisplay.config.js；导入内容: HOME_CAROUSEL_ITEM_LIMIT；文件作用: 请求 Provider 时使用项目轮播最大候选数。
import { HOME_CAROUSEL_ITEM_LIMIT } from '../config/homeDisplay.config.js';

// 类型: number；来源: 首页热门区域产品布局；作用: 只定义单次远程页容量，不限制可翻页的内容总量。
const HOME_HOT_SECTION_PAGE_SIZE = 8;

// 类型: Array<string>；来源: 首页 PageBucket 契约；作用: 限制标题栏分页只能请求两个热门列表桶，排行榜保持独立。
const HOME_HOT_MODULE_KEYS = Object.freeze(['hotMovies', 'hotTv']);

// 类型: Array<object>。
// 作用: 定义首页首次进入时需要请求的五个数据桶，保证页面数据来源统一经过 sourceDataService。
// 条目字段: moduleKey，string，首页数据桶名称，用于 provider 返回对应区域数据。
// 条目字段: params，object，当前桶请求参数，page/pageSize 控制可信模拟 Provider 返回的当前页数量。
const HOME_BUCKET_REQUESTS = [
  {
    // 类型: string。
    // 作用: 请求首页轮播图数据桶。
    moduleKey: 'banners',

    // 类型: object。
    // 作用: 首页轮播最多请求正式上限数量，实际显示数量由已提交用户偏好和组件共同收敛。
    params: {
      page: 1,
      pageSize: HOME_CAROUSEL_ITEM_LIMIT.maximum
    }
  },
  {
    // 类型: string。
    // 作用: 请求首页热门电影卡片数据桶。
    moduleKey: 'hotMovies',

    // 类型: object。
    // 作用: 首页热门电影单页请求统一容量；更多内容通过 hotMovies 远程分页继续获取。
    params: {
      page: 1,
      pageSize: HOME_HOT_SECTION_PAGE_SIZE
    }
  },
  {
    // 类型: string。
    // 作用: 请求首页热门电视剧卡片数据桶。
    moduleKey: 'hotTv',

    // 类型: object。
    // 作用: 首页热门电视剧单页请求统一容量；更多内容通过 hotTv 远程分页继续获取。
    params: {
      page: 1,
      pageSize: HOME_HOT_SECTION_PAGE_SIZE
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

    // <SourceSwitchTabs /> 对应首页轮播图上方的 Runtime 数据源切换区域。
    SourceSwitchTabs
  },

  /**
   * 创建首页组件响应式状态。
   * 纯函数: 只返回首页实例自己的加载、错误和排行榜刷新状态，不读取或修改 Manager、store、路由或外部数据。
   * 使用场景: Vue 创建 HomeView 实例时初始化内容加载和排行榜刷新状态。
   *
   * @returns {object} 首页组件初始响应式状态。
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
      // 作用: 保存首页统一数据流请求失败时的错误文案，当前阶段仅作为调试状态保留。
      loadError: '',

      // 类型: string。
      // 初始值: 空字符串，表示当前没有正在局部刷新的排行榜数据桶。
      // 作用: 保存正在重新请求的首页排行榜 moduleKey，用于控制对应 HotRanking 的刷新按钮状态。
      refreshingRankingModuleKey: ''
    };
  },

  computed: {
    /**
     * 读取首页轮播已提交展示数量。
     * 来源: homeDisplaySettingsStore.preferences.carouselItemLimit，由启动链在挂载前从 IndexedDB 采用。
     * 纯函数: 只读取响应式投影，不修改设置或内容数据。
     *
     * @returns {number} 交给 HomeCarousel 再次校验的展示数量。
     */
    carouselItemLimit() {
      return homeDisplaySettingsStore.preferences.carouselItemLimit;
    },

    /**
     * 首页轮播展示数据。
     * 来源: getBucketItems('home', 'banners')。
     * 执行内容: 通过 selector 从首页 banners.itemKeys 解析统一 ContentItem 列表，由 HomeCarousel 自己读取所需展示字段。
     * 纯函数: 只读取统一内容 store，不修改组件、store 或实体对象。
     *
     * @returns {Array<object>} 首页轮播展示列表。
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
     * 纯函数: 只读取统一内容 store，不修改组件、store 或实体对象。
     *
     * @returns {Array<object>} 首页热门电影列表。
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
     * 纯函数: 只读取统一内容 store，不修改组件、store 或实体对象。
     *
     * @returns {Array<object>} 首页热门电视剧列表。
     */
    tvList() {
      // 返回值类型: Array<object>。
      // 作用: 返回热门电视剧 ContentItem 列表，供 HotTVSection 传给 UserVideoCard 渲染。
      return this.getHomeBucketItems('hotTv');
    },

    /**
     * 读取热门电影当前分页事实。
     * 来源: pages.home.hotMovies.pagination，由最新可采用 Provider 响应提交。
     * 纯函数: 只通过 Store selector 读取，不创建页面分页副本。
     *
     * @returns {object} 热门电影标准 pagination 对象。
     */
    moviePagination() {
      return getPagePagination('home', 'hotMovies');
    },

    /**
     * 判断热门电影是否正在请求目标页。
     * 来源: pages.home.hotMovies.transaction.status。
     * 纯函数: 只读取唯一请求事务；true 禁用两个分页方向，false 按 pagination 判断边界。
     *
     * @returns {boolean} 当前热门电影桶处于 loading 时为 true。
     */
    moviePaging() {
      return this.isHomeBucketLoading('hotMovies');
    },

    /**
     * 读取热门电视剧当前分页事实。
     * 来源: pages.home.hotTv.pagination，由最新可采用 Provider 响应提交。
     * 纯函数: 只通过 Store selector 读取，不创建页面分页副本。
     *
     * @returns {object} 热门电视剧标准 pagination 对象。
     */
    tvPagination() {
      return getPagePagination('home', 'hotTv');
    },

    /**
     * 判断热门电视剧是否正在请求目标页。
     * 来源: pages.home.hotTv.transaction.status。
     * 纯函数: 只读取唯一请求事务；true 禁用两个分页方向，false 按 pagination 判断边界。
     *
     * @returns {boolean} 当前热门电视剧桶处于 loading 时为 true。
     */
    tvPaging() {
      return this.isHomeBucketLoading('hotTv');
    },

    /**
     * 首页电影排行榜展示数据。
     * 来源: getBucketItems('home', 'movieRanking')。
     * 执行内容: 通过 selector 从首页 movieRanking.itemKeys 解析统一 ContentItem 列表，由 HotRanking 自己读取 rank、genres、score 和 year。
     * 纯函数: 只读取统一内容 store，不修改组件、store 或实体对象。
     *
     * @returns {Array<object>} 首页电影排行榜列表。
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
     * 纯函数: 只读取统一内容 store，不修改组件、store 或实体对象。
     *
     * @returns {Array<object>} 首页电视剧排行榜列表。
     */
    tvRanking() {
      // 返回值类型: Array<object>。
      // 作用: 返回电视剧排行榜 ContentItem 列表，供 HotTVSection 传给 HotRanking。
      return this.getHomeBucketItems('tvRanking');
    },

    /**
     * 首页是否至少有一个模块存在数据。
     * 纯函数: 只读取五个 computed 列表的长度，不修改组件或 store。
     *
     * 页面作用：
     * - true：渲染首页轮播、电影区和电视剧区，再由各分区自己处理局部空状态
     * - false：渲染整页空状态
     *
     * @returns {boolean} 首页是否有任意模块可展示
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
   * 副作用: 调用 loadHomeContent 发起异步内容请求，并更新首页加载状态与统一内容 store。
   *
   * @returns {void} 生命周期钩子不返回业务数据。
   */
  created() {
    // 执行内容: 发起首页五个数据桶请求。
    // 影响范围: 请求成功后首页五个数据桶会写入最新 itemKeys，页面通过 getBucketItems('home', moduleKey) 解析为 ContentItem。
    this.loadHomeContent();
  },

  methods: {
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
        // 异步并发请求: 首页五个数据桶互不依赖，可以通过共享 Runtime 并行调用可信模拟 Provider。
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
        // 作用: 记录首页数据桶请求失败原因，当前阶段用于调试，不直接改变视觉布局。
        this.loadError = error && error.message ? error.message : '首页内容数据请求失败';
      } finally {
        // 类型: boolean。
        // 作用: 结束首页数据刷新状态，让页面展示 store 中已有数据或空状态。
        this.loading = false;
      }
    },

    /**
     * 在活动源真实切换成功后重载首页全部内容区域。
     * 触发来源: SourceSwitchTabs 的 source-switched 事件；失败或过期切换不会触发。
     * 副作用: 复用 loadHomeContent 并行请求五个首页桶，内容 service 按新的 Manager activeSourceId 提交响应。
     * 成功路径: 新源五个桶收敛后关闭首页加载状态。
     * 失败路径: loadHomeContent 保留已采用内容并记录错误，不向 SourceSwitchTabs 反向修改切换状态。
     *
     * @returns {Promise<void>} 首页新源内容请求全部收敛后结束。
     */
    async handleSourceSwitched() {
      // 异步调用: 只在组件确认新活动源 success 后执行一次；reject 已由 loadHomeContent 内部收敛为页面错误状态。
      await this.loadHomeContent();
    },

    /**
     * 读取首页指定数据桶的完整内容列表。
     * 来源: getBucketItems('home', moduleKey)。
     * 兜底策略: selector 会在数据桶不存在、itemKeys 为空或实体缺失时返回空数组。
     * 纯函数: 只通过 selector 读取统一内容 store，不修改页面桶或实体池。
     *
     * @param {string} moduleKey 首页数据桶名称。
     * @returns {Array<object>} 当前首页数据桶内容列表。
     */
    getHomeBucketItems(moduleKey) {
      // 返回值类型: Array<object>。
      // 作用: 通过统一 selector 读取首页指定数据桶内容，让页面不再直接感知 itemKeys 到实体池的解析过程。
      return getBucketItems('home', moduleKey);
    },

    /**
     * 判断首页指定列表桶是否正在执行最新请求。
     * 来源: getPageRequestTransaction('home', moduleKey) 返回的隔离事务快照。
     * 纯函数: 只比较正式请求状态枚举，不修改 Store 或组件状态。
     * 失败路径: 事务缺失时返回 false，页面不会伪造 loading。
     *
     * @param {string} moduleKey 首页列表数据桶名称。
     * @returns {boolean} 目标桶最新事务为 loading 时返回 true。
     */
    isHomeBucketLoading(moduleKey) {
      // 类型: object|null；作用: 读取目标桶唯一请求事务的隔离快照。
      const transaction = getPageRequestTransaction('home', moduleKey);

      // 返回值类型: boolean；作用: 只有正式 loading 枚举驱动分页禁用态。
      return Boolean(transaction
        && transaction.status === SITE_CONTENT_REQUEST_STATUS.loading);
    },

    /**
     * 请求首页热门电影或热门电视剧的相邻目标页。
     * 触发来源: HotMovieSection 或 HotTVSection 的 change-page 事件。
     * 副作用: 通过 requestSourceData 更新目标 PageBucket；不修改另一热门桶、排行榜或页面分页副本。
     * 成功路径: Provider 目标页响应通过身份门禁后一次提交 pagination、items 和 success 事务。
     * 失败路径: 非法模块、非相邻页、越界或 loading 时拒绝；请求失败由同一 PageBucket.transaction 记录。
     *
     * @param {object} command 热门区域分页命令。
     * @param {string} command.moduleKey hotMovies 或 hotTv。
     * @param {number} command.page 用户请求的相邻目标页。
     * @returns {Promise<void>} 请求完成或失败收敛后结束。
     */
    async changeHomeHotPage(command) {
      // 条件分支: 命令缺失或模块不属于两个热门列表桶时进入；执行内容: 阻止排行榜和未知桶借用分页入口。
      if (!command || !HOME_HOT_MODULE_KEYS.includes(command.moduleKey)) {
        return;
      }

      // 类型: number；作用: 把事件目标页统一规范为数字，后续只接受正整数相邻页。
      const targetPage = Number(command.page);
      // 类型: object；作用: 读取目标桶当前分页事实，校验方向和 Provider 边界。
      const pagination = getPagePagination('home', command.moduleKey);
      // 类型: object|null；作用: 读取目标桶唯一事务，阻止 loading 期间重复提交。
      const transaction = getPageRequestTransaction('home', command.moduleKey);
      // 类型: number；作用: 缺失或非法当前页按第一页失败收敛，避免基于无效页码继续计算。
      const currentPage = Number(pagination && pagination.page);

      // 条件分支: 当前分页无效、目标页无效或目标页不是相邻页时进入；执行内容: 不发起远程请求。
      if (!pagination
        || !Number.isInteger(currentPage)
        || currentPage < 1
        || !Number.isInteger(targetPage)
        || Math.abs(targetPage - currentPage) !== 1) {
        return;
      }

      // 条件分支: 目标桶已有最新请求正在执行时进入；执行内容: 阻止重复点击制造同桶并发分页命令。
      if (transaction && transaction.status === SITE_CONTENT_REQUEST_STATUS.loading) {
        return;
      }

      // 条件分支: 用户请求上一页但当前已经是第一页时进入；执行内容: 阻止越过第一页。
      if (targetPage < currentPage && currentPage <= 1) {
        return;
      }

      // 类型: number；作用: 读取 Provider 可选总页数，非法或未知值继续使用 hasMore 规则。
      const totalPages = Number(pagination.totalPages);
      // 类型: boolean；作用: 标记 Provider 是否提供了可用于最后一页判断的正整数总页数。
      const hasKnownTotalPages = Number.isInteger(totalPages) && totalPages >= 1;

      // 条件分支: 请求下一页且已知总页数时进入；执行内容: 目标超过最后一页则拒绝。
      if (targetPage > currentPage && hasKnownTotalPages && targetPage > totalPages) {
        return;
      }

      // 条件分支: 请求下一页但总页数未知且 Provider 没有声明 hasMore 时进入；执行内容: 保持失败关闭。
      if (targetPage > currentPage && !hasKnownTotalPages && pagination.hasMore !== true) {
        return;
      }

      try {
        // 异步调用: 只请求当前热门模块的目标远程页；成功响应由统一 service 提交到同一 PageBucket。
        await requestSourceData({
          pageKey: 'home',
          moduleKey: command.moduleKey,
          params: {
            page: targetPage,
            pageSize: HOME_HOT_SECTION_PAGE_SIZE
          }
        });
      } catch (error) {
        // 失败收敛: sourceDataService 已把稳定错误写入目标桶 transaction；页面不再复制错误或请求身份。
        return;
      }
    },

    /**
     * 判断指定排行榜数据桶是否正在刷新。
     * 来源: data.refreshingRankingModuleKey。
     * 执行内容: 当前 moduleKey 和正在刷新 moduleKey 一致时返回 true。
     * 纯函数: 只比较组件状态与参数，不修改组件或外部状态。
     *
     * @param {string} moduleKey 首页排行榜数据桶名称。
     * @returns {boolean} 当前排行榜是否正在局部刷新。
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
     * 纯函数: 只读取冻结用途的模块常量，不修改请求清单或外部状态。
     *
     * @param {string} moduleKey 首页数据桶名称。
     * @returns {object|undefined} 匹配的数据桶请求配置。
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
     * 副作用: 修改 refreshingRankingModuleKey 和 loadError，并通过 service 更新目标排行榜桶。
     * 成功路径: 目标桶采用新响应后清空刷新标记。
     * 失败路径: 保存错误文案并在 finally 清空刷新标记；未知桶或重复刷新直接返回。
     *
     * @param {string} moduleKey 需要刷新的首页排行榜数据桶名称。
     * @returns {Promise<void>} 当前排行榜数据桶刷新完成后结束。
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
        // 作用: 记录当前排行榜局部刷新失败原因，当前阶段用于调试和后续错误提示扩展。
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
     * 副作用: 命中有效映射时调用 Vue Router 修改当前页面路由；未知桶不产生副作用。
     *
     * @param {string} moduleKey 点击查看更多的首页排行榜数据桶名称。
     * @returns {void} 该方法只触发路由跳转，不返回业务数据。
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
  首页整体容器。
  对应 template 中的 `.home-page`，负责包裹首页全部内容区域。
*/
.home-page {
  /* 首页已经由全局 `.theme-page` 控制宽度，这里只补顶部细微留白。 */
  padding-top: 4px;
}

/*
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

/* 当前项目卡片采用直角边界，页面容器不额外增加圆角。 */
  border-radius: 0;
}
</style>
