<template>
  <!--
    HotRanking 组件渲染树

    [DEFAULT] ele(div.ranking-wrapper)
    │  - condition:
    │      默认渲染。
    │      父组件把电影排行榜或电视剧排行榜数据传入后，本组件负责渲染右侧简约榜单面板。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      排行榜根容器。
    │      承载榜单标题、刷新入口、排行列表、空状态和底部查看更多入口。
    │  - params:
    │      -- title：父组件传入的榜单标题，用于区分电影排行榜和电视剧排行榜。
    │      -- items：父组件传入的统一 ContentItem 数组，用于渲染榜单行。
    │      -- refreshing：父组件传入的刷新状态，用于控制刷新按钮文案和禁用态。
    │  - events: 无
    │
    ├─ [DEFAULT] ele(div.ranking-head)
    │  │  - condition:
    │  │      默认渲染。
    │  │      榜单头部始终显示标题，并根据 refreshable 控制刷新按钮。
    │  │  - type:
    │  │      原生标签
    │  │      标签名称: div
    │  │  - description:
    │  │      排行榜头部。
    │  │      左侧展示榜单标题，右侧展示刷新数据入口。
    │  │  - params:
    │  │      -- title：榜单标题。
    │  │      -- refreshable：是否允许显示刷新按钮。
    │  │  - events: 无
    │  │
    │  ├─ [DEFAULT] ele(h3.ranking-title)
    │  │  │  - condition:
    │  │  │      默认渲染。
    │  │  │      只要排行榜组件挂载就展示当前榜单标题。
    │  │  │  - type:
    │  │  │      原生标签
    │  │  │      标签名称: h3
    │  │  │  - description:
    │  │  │      榜单标题。
    │  │  │      显示电影排行榜或电视剧排行榜的模块名称。
    │  │  │  - params:
    │  │  │      -- title：父组件传入的标题文本。
    │  │  │  - events: 无
    │  │
    │  └─ [IF refreshable] ele(button.ranking-refresh)
    │     │  - condition:
    │     │      refreshable 为 true 时渲染。
    │     │      用于让用户单独刷新当前排行榜数据桶。
    │     │  - type:
    │     │      原生标签
    │     │      标签名称: button
    │     │  - description:
    │     │      刷新数据按钮。
    │     │      点击后向父组件抛出 refresh-ranking 事件，由页面层重新请求对应数据桶。
    │     │  - params:
    │     │      -- refreshing：当前榜单是否正在刷新，用于控制按钮禁用态和文案。
    │     │  - events:
    │     │      @click
    │     │          - description:
    │     │              用户点击刷新数据按钮时触发。
    │     │              refreshing 为 true 时按钮禁用，不会重复触发刷新。
    │     │          - methods:
    │     │              handleRefreshRanking()
    │     │                  -- 无参数：方法内部使用 rankingKey 作为刷新目标。
    │
    ├─ [IF hasItems] ele(ul.ranking-list)
    │  │  - condition:
    │  │      hasItems 为 true 时渲染。
    │  │      当前榜单存在至少一条可展示 ContentItem。
    │  │  - type:
    │  │      原生标签
    │  │      标签名称: ul
    │  │  - description:
    │  │      排行榜列表。
    │  │      按 displayItems 循环渲染容器高度能放下的排行内容。
    │  │  - params:
    │  │      -- displayItems：经过空值过滤和容器高度截断后的榜单数组。
    │  │  - events: 无
    │  │
    │  └─ [DEFAULT] ele(li.ranking-item)
    │     │  - condition:
    │     │      默认循环渲染。
    │     │      displayItems 中每一条数据都会生成一个可点击排行行。
    │     │  - type:
    │     │      原生标签
    │     │      标签名称: li
    │     │  - description:
    │     │      排行榜条目。
    │     │      第一行展示序号、标题和右对齐状态标签。
    │     │      第二行左侧展示年份、地区和类型，右侧展示清晰度或电视剧集数字段。
    │     │  - params:
    │     │      -- item：当前排行条目的统一 ContentItem。
    │     │      -- index：当前排行条目下标，用于补齐序号和前三名序号强调样式。
    │     │  - events:
    │     │      @click
    │     │          - description:
    │     │              用户点击榜单行时触发。
    │     │              用于进入当前条目的详情页。
    │     │          - methods:
    │     │              openDetailPage(item)
    │     │                  -- item：当前排行条目的统一 ContentItem。
    │     │      @keydown.enter
    │     │          - description:
    │     │              键盘焦点停在榜单行且按下 Enter 时触发。
    │     │              用于提供和鼠标点击一致的详情页入口。
    │     │          - methods:
    │     │              openDetailPage(item)
    │     │                  -- item：当前排行条目的统一 ContentItem。
    │     │      @keydown.space
    │     │          - description:
    │     │              键盘焦点停在榜单行且按下 Space 时触发。
    │     │              prevent 修饰符会阻止页面滚动，并进入详情页。
    │     │          - methods:
    │     │              openDetailPage(item)
    │     │                  -- item：当前排行条目的统一 ContentItem。
    │
    ├─ [ELSE] ele(el-empty.ranking-empty)
    │  │  - condition:
    │  │      hasItems 为 false 时渲染。
    │  │      当前榜单数据桶没有可展示内容。
    │  │  - type:
    │  │      第三方组件
    │  │      组件库: Element UI
    │  │      组件名称: el-empty
    │  │  - description:
    │  │      榜单空状态。
    │  │      提示当前排行榜暂无内容，同时保持右侧面板结构稳定。
    │  │  - params:
    │  │      -- description：空状态提示文案。
    │  │  - events: 无
    │
    └─ [DEFAULT] ele(button.ranking-more)
       │  - condition:
       │      默认渲染。
       │      作为榜单底部的查看更多入口。
       │  - type:
       │      原生标签
       │      标签名称: button
       │  - description:
       │      查看更多按钮。
       │      点击后把当前榜单 key 抛给父组件，由页面层决定跳转电影页或电视剧页。
       │  - params:
       │      -- moreText：查看更多按钮显示文本。
       │  - events:
       │      @click
       │          - description:
       │              用户点击榜单底部查看更多时触发。
       │              用于跳转到承接更多内容的列表页面。
       │          - methods:
       │              handleOpenMore()
       │                  -- 无参数：方法内部使用 rankingKey 作为跳转目标。
  -->
  <div ref="rankingWrapper" class="ranking-wrapper">
    <!--
      [DEFAULT] ele(div.ranking-head)
      - condition:
          默认渲染。
          榜单头部始终展示，刷新按钮由 refreshable 继续控制。
      - type:
          原生标签
          标签名称: div
      - description:
          排行榜头部。
          左侧展示榜单名称，右侧展示刷新当前榜单数据桶的入口。
      - params:
          -- title：当前榜单标题。
          -- refreshable：是否显示刷新按钮。
      - events: 无
    -->
    <div class="ranking-head">
      <!--
        [DEFAULT] ele(h3.ranking-title)
        - condition:
            默认渲染。
            当前排行榜组件挂载后显示父组件传入标题。
        - type:
            原生标签
            标签名称: h3
        - description:
            榜单标题。
            用于区分当前面板是电影排行榜还是电视剧排行榜。
        - params:
            -- title：父组件传入的标题文本。
        - events: 无
      -->
      <h3 class="ranking-title">{{ title }}</h3>

      <!--
        [IF refreshable] ele(button.ranking-refresh)
        - condition:
            refreshable 为 true 时渲染。
            当前榜单允许用户手动刷新时展示。
        - type:
            原生标签
            标签名称: button
        - description:
            刷新数据按钮。
            只抛出刷新事件，不直接请求数据，保持展示组件和数据层解耦。
        - params:
            -- refreshing：当前榜单刷新中时禁用按钮并切换文案。
        - events:
            @click
                - description:
                    用户点击刷新数据按钮时触发。
                    用于请求父组件重新拉取当前排行榜数据桶。
                - methods:
                    handleRefreshRanking()
                        -- 无参数：内部使用 rankingKey 标识目标榜单。
      -->
      <button
        v-if="refreshable"
        class="ranking-refresh"
        :class="{ 'is-refreshing': refreshing }"
        type="button"
        :disabled="refreshing"
        @click="handleRefreshRanking">
        <i class="el-icon-refresh" aria-hidden="true"></i>
        <span>{{ refreshing ? '刷新中' : '刷新数据' }}</span>
      </button>
    </div>

    <!--
      [IF hasItems] ele(ul.ranking-list)
      - condition:
          hasItems 为 true 时渲染。
          当前榜单存在可展示条目。
      - type:
          原生标签
          标签名称: ul
      - description:
          排行榜列表。
          使用一行式简约布局展示序号、标题、年份地区类型和状态标签。
      - params:
          -- displayItems：当前组件根据可用高度实际展示的榜单条目数组。
      - events: 无
    -->
    <ul v-if="hasItems" ref="rankingList" class="ranking-list">
      <!--
        [DEFAULT] ele(li.ranking-item)
        - condition:
            默认循环渲染。
            displayItems 中每条 ContentItem 都生成一个榜单行。
        - type:
            原生标签
            标签名称: li
        - description:
            榜单行。
            第一行左侧展示序号和标题，右侧展示新、热、高分标签。
            第二行左侧展示年份、地区和类型，右侧展示电影清晰度或电视剧集数字段。
        - params:
            -- item：当前榜单条目。
            -- index：当前榜单下标，用于补齐序号和前三名序号强调样式。
        - events:
            @click
                - description:
                    用户点击当前榜单行时触发。
                    用于打开当前视频详情页。
                - methods:
                    openDetailPage(item)
                        -- item：当前榜单条目。
            @keydown.enter
                - description:
                    键盘用户按下 Enter 时触发。
                    用于提供无鼠标场景下的详情页入口。
                - methods:
                    openDetailPage(item)
                        -- item：当前榜单条目。
            @keydown.space
                - description:
                    键盘用户按下 Space 时触发。
                    prevent 修饰符避免页面滚动，并打开详情页。
                - methods:
                    openDetailPage(item)
                        -- item：当前榜单条目。
      -->
      <li
        v-for="(item, index) in displayItems"
        :key="item.id || item.title || index"
        class="ranking-item"
        role="button"
        tabindex="0"
        @click="openDetailPage(item)"
        @keydown.enter="openDetailPage(item)"
        @keydown.space.prevent="openDetailPage(item)">
        <!--
          [DEFAULT] ele(div.ranking-main-row)
          - condition:
              默认渲染。
              每条榜单都先展示主信息行。
          - type:
              原生标签
              标签名称: div
          - description:
              排行榜主信息行。
              左侧显示排行序号和标题，右侧显示新、热、高分状态标签。
          - params:
              -- item：当前榜单条目，用于读取标题和状态标签。
              -- index：当前榜单下标，用于生成序号和前三名序号强调样式。
          - events: 无
        -->
        <div class="ranking-main-row">
          <span class="ranking-index" :class="getRankingIndexClass(index)">
            {{ getRankText(item, index) }}
          </span>
          <span class="ranking-name">{{ item.title || '未命名内容' }}</span>
          <span class="ranking-badges">
            <span
              v-for="badge in getBadgeList(item)"
              :key="badge"
              class="ranking-badge">
              {{ badge }}
            </span>
          </span>
        </div>
        <!--
          [DEFAULT] ele(div.ranking-meta-row)
          - condition:
              默认渲染。
              每条榜单都在第二行展示辅助字段。
          - type:
              原生标签
              标签名称: div
          - description:
              排行榜辅助信息行。
              在标题起点下方展示年份、地区和类型，右侧展示清晰度或集数字段。
              这些辅助字段放在第二行，避免挤压标题和标签。
          - params:
              -- item：当前榜单条目，用于读取年份、地区、类型、清晰度和电视剧集数字段。
          - events: 无
        -->
        <div class="ranking-meta-row">
          <span class="ranking-meta-text">{{ getSideText(item) }}</span>
          <span
            v-if="getStatusText(item)"
            class="ranking-status-text"
            :title="getStatusText(item)">
            {{ getStatusText(item) }}
          </span>
        </div>
      </li>
    </ul>

    <!--
      [ELSE] ele(el-empty.ranking-empty)
      - condition:
          hasItems 为 false 时渲染。
          当前排行榜没有任何可展示数据。
      - type:
          第三方组件
          组件库: Element UI
          组件名称: el-empty
      - description:
          排行榜空状态。
          保持右侧面板有明确提示，不让排行榜区域变成空白。
      - params:
          -- description：空状态提示文字。
      - events: 无
    -->
    <el-empty
      v-else
      class="ranking-empty"
      description="暂无榜单数据" />

    <!--
      [DEFAULT] ele(button.ranking-more)
      - condition:
          默认渲染。
          作为排行榜底部固定入口。
      - type:
          原生标签
          标签名称: button
      - description:
          查看更多入口。
          把当前榜单 key 抛给父组件，由父组件跳转到电影页或电视剧页。
      - params:
          -- moreText：按钮展示文案。
      - events:
          @click
              - description:
                  用户点击查看更多按钮时触发。
                  用于进入承接更多内容的列表页面。
              - methods:
                  handleOpenMore()
                      -- 无参数：内部读取 rankingKey。
    -->
    <button class="ranking-more" type="button" @click="handleOpenMore">
      <span>{{ moreText }}</span>
      <i class="el-icon-arrow-right" aria-hidden="true"></i>
    </button>
  </div>
</template>

<script>
/*
  HotRanking script 模块说明

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      TOP_RANK_HIGHLIGHT_LIMIT: number，控制前几名序号使用强调色。
      DEFAULT_VISIBLE_RANKING_LIMIT: number，测量前默认渲染条数。
      MIN_VISIBLE_RANKING_LIMIT: number，容器过矮时至少保留的展示条数。

  - 模块级辅助函数:
      无
*/

// 类型: number。
// 作用: 控制榜单前几名序号使用强调色；该常量只影响排名视觉，不参与 displayTags 数据生成。
const TOP_RANK_HIGHLIGHT_LIMIT = 3;

// 类型: number。
// 作用: 排行榜首次测量前默认渲染的条数，用于提供可测量的列表行高度。
const DEFAULT_VISIBLE_RANKING_LIMIT = 20;

// 类型: number。
// 作用: 排行榜容器较矮时至少展示的条数，避免右侧面板只剩标题和查看更多。
const MIN_VISIBLE_RANKING_LIMIT = 1;

export default {
  // 组件名称用于 Vue Devtools 和报错堆栈识别首页排行榜组件。
  name: 'HotRanking',

  props: {
    // 类型: string。
    // 来源: 父组件 HotMovieSection 或 HotTVSection。
    // 作用: 显示在排行榜头部，用于区分电影排行榜或电视剧排行榜。
    title: {
      type: String,
      required: true
    },

    // 类型: string。
    // 来源: 父组件按首页数据桶传入。
    // 作用: 刷新和查看更多事件的目标标识，例如 movieRanking 或 tvRanking。
    rankingKey: {
      type: String,
      default: ''
    },

    // 类型: Array<object>。
    // 来源: HomeView 通过 getBucketItems('home', moduleKey) selector 读取首页排行榜数据桶后传入。
    // 作用: 驱动排行榜列表渲染。
    // 字段: id，string，内容唯一标识，用于详情页跳转。
    // 字段: sourceId，string，内容所属数据源，用于详情页请求保持来源一致。
    // 字段: title，string，内容标题，用于榜单主标题。
    // 字段: rank，number|string，榜单序号，缺失时使用列表下标补齐。
    // 字段: year，string|number，内容年份，用于右侧辅助信息。
    // 字段: area，string，内容地区，用于右侧辅助信息。
    // 字段: genres，Array<string>，影视类型，用于右侧辅助信息。
    // 字段: displayTags，Array<string>，数据源提供的展示标签，用于榜单第一行右侧小标签。
    // 字段: type，string，内容类型，字段缺失时用于电影/电视剧基础兜底文案。
    items: {
      type: Array,
      required: true
    },

    // 类型: boolean。
    // 来源: 父组件传入。
    // 作用: 控制是否显示刷新按钮。
    // true: 展示刷新入口，允许用户重新请求当前榜单数据桶。
    // false: 隐藏刷新入口，当前榜单只展示静态内容。
    refreshable: {
      type: Boolean,
      default: true
    },

    // 类型: boolean。
    // 来源: HomeView 当前正在刷新的数据桶状态。
    // 作用: 控制刷新按钮禁用态和文案。
    // true: 当前榜单正在重新请求，按钮禁用并显示“刷新中”。
    // false: 当前榜单可点击刷新。
    refreshing: {
      type: Boolean,
      default: false
    },

    // 类型: string。
    // 来源: 父组件可选传入。
    // 作用: 控制榜单底部查看更多入口文案。
    moreText: {
      type: String,
      default: '查看更多'
    }
  },

  data() {
    return {
      // 类型: number。
      // 初始值: DEFAULT_VISIBLE_RANKING_LIMIT，首次渲染时先展示完整候选列表，方便 mounted 后测量单行高度。
      // 作用: 控制首页实际渲染的榜单条数，让列表只显示当前容器高度能容纳的数量。
      visibleItemLimit: DEFAULT_VISIBLE_RANKING_LIMIT,

      // 类型: ResizeObserver|null。
      // 初始值: null，表示当前尚未注册容器尺寸监听器。
      // 作用: 浏览器支持 ResizeObserver 时监听排行榜容器高度变化，动态刷新可见条数。
      rankingResizeObserver: null
    };
  },

  computed: {
    /**
     * 是否有榜单数据。
     * 来源: displayItems。
     * 执行内容: 判断过滤后的榜单数组是否存在可展示条目。
     *
     * @returns {boolean} 有榜单条目时返回 true。
     */
    hasItems() {
      // 返回值类型: boolean。
      // 作用: 驱动 template 在排行榜列表和空状态之间切换。
      return this.displayItems.length > 0;
    },

    /**
     * 首页实际展示的榜单条目。
     * 来源: props.items。
     * 执行内容: 过滤空条目，并按当前容器可容纳数量截断。
     *
     * @returns {Array<object>} 当前容器高度可展示的榜单数据。
     */
    displayItems() {
      // 类型: Array<object>。
      // 作用: items 是数组时过滤空值，不是数组时返回空数组触发 el-empty 空状态。
      const safeItems = Array.isArray(this.items) ? this.items.filter(Boolean) : [];

      // 类型: number。
      // 作用: 可见条数至少为 1，避免测量异常时把已有榜单全部隐藏。
      const safeLimit = Math.max(Number(this.visibleItemLimit) || MIN_VISIBLE_RANKING_LIMIT, MIN_VISIBLE_RANKING_LIMIT);

      // 返回值类型: Array<object>。
      // 作用: 只返回首页右侧排行榜容器当前能放下的条目，避免出现内部滚动条。
      return safeItems.slice(0, safeLimit);
    }
  },

  watch: {
    /**
     * 监听榜单输入数据变化。
     * 执行时机: HomeView 首次请求或刷新排行榜数据桶后触发。
     * 执行内容: 下一轮 DOM 更新后重新测量可见条数，保证新数据仍然不产生内部滚动条。
     *
     * @returns {void} watcher 只触发布局测量，不返回业务数据。
     */
    items() {
      // 异步队列: 等新榜单行渲染后再测量高度，避免读取旧 DOM。
      this.$nextTick(() => {
        // 执行内容: 根据当前容器和单条榜单行高度刷新可见条数。
        this.updateVisibleItemLimit();
      });
    }
  },

  /**
   * Vue mounted 生命周期。
   * 执行时机: 排行榜组件挂载到真实 DOM 后。
   * 执行内容: 测量当前容器可见条数，并注册窗口和容器尺寸变化监听。
   *
   * @returns {void} 生命周期钩子不返回业务数据。
   */
  mounted() {
    // 异步队列: 等初始榜单 DOM 渲染完成后再读取元素尺寸。
    this.$nextTick(() => {
      // 执行内容: 根据首次渲染的榜单行高度计算当前可见条数。
      this.updateVisibleItemLimit();
    });

    // 副作用: 注册 window resize 事件。
    // 影响范围: 当前排行榜组件生命周期内，窗口尺寸变化会重新计算可见条数。
    window.addEventListener('resize', this.updateVisibleItemLimit);

    // 条件分支: 当前浏览器支持 ResizeObserver 时进入。
    // 执行内容: 监听排行榜根容器尺寸变化，比单纯 window resize 更能覆盖父布局变化。
    if (typeof ResizeObserver !== 'undefined') {
      // 类型: ResizeObserver。
      // 作用: 保存容器尺寸观察器，组件销毁时需要断开监听。
      this.rankingResizeObserver = new ResizeObserver(() => {
        // 执行内容: 容器尺寸变化时重新计算可见条数。
        this.updateVisibleItemLimit();
      });

      // 条件分支: 根容器 ref 存在时进入。
      // 执行内容: 开始观察排行榜根容器尺寸。
      if (this.$refs.rankingWrapper) {
        this.rankingResizeObserver.observe(this.$refs.rankingWrapper);
      }
    }
  },

  /**
   * Vue beforeDestroy 生命周期。
   * 执行时机: 排行榜组件销毁前。
   * 执行内容: 清理窗口 resize 监听和 ResizeObserver，避免页面切换后继续触发布局计算。
   *
   * @returns {void} 生命周期钩子不返回业务数据。
   */
  beforeDestroy() {
    // 副作用清理: 移除 mounted 中注册的 window resize 监听。
    window.removeEventListener('resize', this.updateVisibleItemLimit);

    // 条件分支: 已创建 ResizeObserver 时进入。
    // 执行内容: 断开容器尺寸监听，避免组件销毁后持有 DOM 引用。
    if (this.rankingResizeObserver) {
      this.rankingResizeObserver.disconnect();
      this.rankingResizeObserver = null;
    }
  },

  methods: {
    /**
     * 更新排行榜可见条数。
     * 调用来源: mounted、items watcher、window resize 和 ResizeObserver。
     * 执行内容: 根据列表可用高度和单条榜单行高度计算当前能展示多少条。
     *
     * @returns {void} 该方法只更新 visibleItemLimit，不返回业务数据。
     */
    updateVisibleItemLimit() {
      // 类型: HTMLElement|undefined。
      // 作用: 读取排行榜列表 DOM，用于获取列表可用高度和第一条榜单行高度。
      const listElement = this.$refs.rankingList;

      // 条件分支: 列表 DOM 不存在时进入。
      // 执行内容: 直接退出，空状态或组件未挂载时不做测量。
      if (!listElement) {
        return;
      }

      // 类型: HTMLElement|null。
      // 作用: 获取第一条榜单行，用于估算所有榜单行的单条高度。
      const firstItemElement = listElement.querySelector('.ranking-item');

      // 条件分支: 当前没有榜单行时进入。
      // 执行内容: 直接退出，避免空列表测量得到 0 后隐藏未来数据。
      if (!firstItemElement) {
        return;
      }

      // 类型: number。
      // 作用: 列表区域当前可用高度，由 flex 布局在头部和查看更多按钮之外分配。
      const availableHeight = listElement.clientHeight;

      // 类型: number。
      // 作用: 单条榜单行实际占用高度，包含内边距和两行文本高度。
      const itemHeight = firstItemElement.offsetHeight;

      // 条件分支: 任一高度无效时进入。
      // 执行内容: 保持当前可见条数，不用异常测量结果覆盖布局。
      if (!availableHeight || !itemHeight) {
        return;
      }

      // 类型: number。
      // 作用: 根据可用高度计算最多能完整显示几条榜单行。
      const measuredLimit = Math.floor(availableHeight / itemHeight);

      // 类型: number。
      // 作用: 把测量结果限制在 1 到 items 总量之间，避免空白过多或越界。
      const nextLimit = Math.min(
        Math.max(measuredLimit, MIN_VISIBLE_RANKING_LIMIT),
        Array.isArray(this.items) ? this.items.filter(Boolean).length : MIN_VISIBLE_RANKING_LIMIT
      );

      // 条件分支: 新旧可见条数一致时进入。
      // 执行内容: 不触发响应式更新，避免 ResizeObserver 反复计算。
      if (nextLimit === this.visibleItemLimit) {
        return;
      }

      // 类型: number。
      // 作用: 写入新的可见条数，驱动 displayItems 截断列表。
      this.visibleItemLimit = nextLimit;
    },

    /**
     * 触发当前排行榜刷新。
     * 触发来源: 刷新数据按钮的 @click 事件。
     * 执行内容: 把 rankingKey 抛给父组件，由 HomeView 重新请求对应首页数据桶。
     *
     * @returns {void} 该方法只抛出组件事件，不直接请求数据。
     */
    handleRefreshRanking() {
      // 条件分支: 当前榜单正在刷新时进入。
      // 执行内容: 直接退出，避免用户连续点击造成重复请求。
      if (this.refreshing) {
        return;
      }

      // 事件: refresh-ranking。
      // 参数: rankingKey，string，表示需要重新请求的首页排行榜数据桶。
      this.$emit('refresh-ranking', this.rankingKey);
    },

    /**
     * 触发排行榜查看更多。
     * 触发来源: 查看更多按钮的 @click 事件。
     * 执行内容: 把 rankingKey 抛给父组件，由 HomeView 决定跳转电影页或电视剧页。
     *
     * @returns {void} 该方法只抛出组件事件，不直接操作路由。
     */
    handleOpenMore() {
      // 事件: open-more-ranking。
      // 参数: rankingKey，string，表示需要承接更多内容的排行榜类型。
      this.$emit('open-more-ranking', this.rankingKey);
    },

    /**
     * 打开当前榜单条目详情页。
     * 触发来源: 榜单行 click、Enter 和 Space 事件。
     * 执行内容: 使用统一 ContentItem 的 sourceId 和 id 进入 detail 命名路由。
     *
     * @param {object} item 当前榜单条目。
     * @returns {void} 通过 vue-router 跳转到 detail 命名路由。
     */
    openDetailPage(item) {
      // 条件分支: item、id 或 sourceId 缺失时进入。
      // 执行内容: 直接退出，避免构造不完整的详情页路由。
      if (!item || !item.id || !item.sourceId) {
        return;
      }

      // 执行内容: 使用 detail 命名路由跳转，保持和 VideoCard、HomeCarousel 一致的详情入口。
      this.$router.push({
        // 类型: string。
        // 作用: 指向详情页命名路由。
        name: 'detail',

        // 类型: object。
        // 作用: 传递详情页需要的数据源 id 和视频 id。
        params: {
          // 类型: string。
          // 作用: 当前内容所属数据源，用于详情页继续读取同一来源内容。
          sourceId: item.sourceId,

          // 类型: string。
          // 作用: 当前内容唯一标识，用于详情页定位具体视频。
          videoId: item.id
        }
      }).catch((error) => {
        // 条件分支: 重复进入当前详情页时进入。
        // 执行内容: 忽略 vue-router 的重复导航错误，避免控制台噪声。
        if (error && error.name !== 'NavigationDuplicated') {
          // 执行内容: 非重复导航错误继续抛出，避免真正路由问题被吞掉。
          throw error;
        }
      });
    },

    /**
     * 获取排行序号展示文案。
     * 来源: ContentItem.rank 和循环 index。
     * 执行内容: 优先使用数据源提供的 rank，缺失时用 index + 1 兜底。
     *
     * @param {object} item 当前榜单条目。
     * @param {number} index 当前榜单下标。
     * @returns {string|number} 当前榜单行展示序号。
     */
    getRankText(item, index) {
      // 类型: object。
      // 作用: item 缺失时用空对象兜底，避免读取 rank 时报错。
      const contentItem = item || {};

      // 条件分支: 数据源提供 rank 时进入。
      // 执行内容: 直接展示数据源排名，保持外部榜单顺序语义。
      if (contentItem.rank) {
        return contentItem.rank;
      }

      // 返回值类型: number。
      // 作用: 数据源未提供 rank 时，使用列表下标生成从 1 开始的序号。
      return index + 1;
    },

    /**
     * 获取右侧年份、地区和类型文案。
     * 来源: ContentItem.year、area、genres 和 type。
     * 执行内容: 按“年份/地区/类型”顺序尽力渲染，缺失字段自动跳过。
     *
     * @param {object} item 当前榜单条目。
     * @returns {string} 当前榜单行右侧辅助文案。
     */
    getSideText(item) {
      // 类型: object。
      // 作用: item 缺失时用空对象兜底，保证字段读取安全。
      const contentItem = item || {};

      // 类型: string。
      // 作用: 读取年份字段，缺失时不参与右侧辅助文案。
      const yearText = contentItem.year ? String(contentItem.year) : '';

      // 类型: string。
      // 作用: 读取地区字段，缺失时不参与右侧辅助文案。
      const areaText = contentItem.area ? String(contentItem.area) : '';

      // 类型: string。
      // 作用: 读取第一个影视类型，避免窄榜单列展示过多类型造成拥挤。
      const genreText = Array.isArray(contentItem.genres) && contentItem.genres.length ? contentItem.genres[0] : '';

      // 类型: string。
      // 作用: 当年份、地区和类型都缺失时，使用内容类型作为基础兜底。
      const fallbackTypeText = contentItem.type === 'tv' ? '电视剧' : '电影';

      // 类型: Array<string>。
      // 作用: 按用户要求的“年份/地区/类型”顺序收集可展示字段。
      const metaParts = [yearText, areaText, genreText].filter(Boolean);

      // 条件分支: 至少存在一个辅助字段时进入。
      // 执行内容: 使用斜杠拼接，形成紧凑右侧信息。
      if (metaParts.length) {
        return metaParts.join('/');
      }

      // 返回值类型: string。
      // 作用: 没有辅助字段时仍显示电影/电视剧基础类型，避免右侧完全空白。
      return fallbackTypeText;
    },

    /**
     * 判断榜单条目是否为电视剧内容。
     * 来源: ContentItem.type。
     * 执行内容: 兼容 tv 和 series 两种电视剧类型标识。
     *
     * @param {object} item 当前榜单条目。
     * @returns {boolean} 当前条目是电视剧时返回 true。
     */
    isTvContent(item) {
      // 类型: object。
      // 作用: item 缺失时用空对象兜底，避免读取 type 时报错。
      const contentItem = item || {};

      // 类型: string。
      // 作用: 统一转成小写，兼容外部数据源可能返回的大小写差异。
      const contentType = String(contentItem.type || '').toLowerCase();

      // 返回值类型: boolean。
      // 作用: tv 和 series 都按电视剧处理，用于决定第二行右侧字段读取方式。
      return contentType === 'tv' || contentType === 'series';
    },

    /**
     * 获取电视剧总集数展示文本。
     * 来源: ContentItem.tv.totalEpisodes。
     * 执行内容: totalEpisodes 存在时生成“全 xx 集”文案。
     *
     * @param {object} item 当前榜单条目。
     * @returns {string} 电视剧总集数文案或空字符串。
     */
    getTotalEpisodeText(item) {
      // 类型: object。
      // 作用: item 缺失时用空对象兜底，避免读取 tv 字段时报错。
      const contentItem = item || {};

      // 类型: object。
      // 作用: 保存电视剧扩展字段对象，用于读取总集数。
      const tvInfo = contentItem.tv || {};

      // 条件分支: totalEpisodes 有值时进入。
      // 执行内容: 生成用户可读的全集数字段。
      if (tvInfo.totalEpisodes) {
        return `全${tvInfo.totalEpisodes}集`;
      }

      // 返回值类型: string。
      // 作用: 没有总集数字段时不展示第二行右侧集数兜底文案。
      return '';
    },

    /**
     * 获取榜单第二行右侧状态字段。
     * 电影使用字段: quality、badge。
     * 电视剧使用字段: tv.updateStatus、tv.totalEpisodes、badge、quality。
     *
     * @param {object} item 当前榜单条目。
     * @returns {string} 清晰度、更新状态、全集数字段或空字符串。
     */
    getStatusText(item) {
      // 类型: object。
      // 作用: item 缺失时用空对象兜底，保证清晰度和电视剧字段读取安全。
      const contentItem = item || {};

      // 类型: object。
      // 作用: 保存电视剧扩展字段对象，用于读取 updateStatus 和 totalEpisodes。
      const tvInfo = contentItem.tv || {};

      // 条件分支: 当前条目是电视剧时进入。
      // 执行内容: 优先展示更新状态，其次展示全集数，再用通用 badge 或 quality 兜底。
      if (this.isTvContent(contentItem)) {
        return tvInfo.updateStatus || this.getTotalEpisodeText(contentItem) || contentItem.badge || contentItem.quality || '';
      }

      // 返回值类型: string。
      // 作用: 电影优先展示清晰度，缺失时用通用 badge 兜底。
      return contentItem.quality || contentItem.badge || '';
    },

    /**
     * 获取当前榜单行状态标签。
     * 来源: ContentItem.displayTags。
     * 执行内容: 只读取数据源提供的展示标签，不在组件内根据年份、评分或排名推导。
     *
     * @param {object} item 当前榜单条目。
     * @returns {Array<string>} 当前榜单行需要展示的状态标签。
     */
    getBadgeList(item) {
      // 类型: object。
      // 作用: item 缺失时用空对象兜底，保证读取 displayTags 时不会报错。
      const contentItem = item || {};

      // 类型: Array<string>。
      // 作用: 读取统一 ContentItem 的 displayTags 字段，作为排行榜第一行右侧展示标签来源。
      const badgeList = Array.isArray(contentItem.displayTags) ? contentItem.displayTags : [];

      // 返回值类型: Array<string>。
      // 作用: 过滤空标签并返回给 template 渲染；不做任何前端推导，确保标签来自数据源。
      return badgeList.filter(Boolean);
    },

    /**
     * 获取排行序号样式类。
     * 来源: 当前循环 index。
     * 执行内容: 前三名使用强调色，其余序号使用普通样式。
     *
     * @param {number} index 当前榜单下标。
     * @returns {string} 排名序号样式类。
     */
    getRankingIndexClass(index) {
      // 条件分支: 当前条目是前三名时进入。
      // 执行内容: 返回 rank-top 样式，强调高排名条目。
      if (index < TOP_RANK_HIGHLIGHT_LIMIT) {
        return 'rank-top';
      }

      // 返回值类型: string。
      // 作用: 第四名及以后使用普通序号样式。
      return 'rank-normal';
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 排行榜根容器 `.ranking-wrapper`。
  样式作用:
  承载榜单头部、列表、空状态和底部查看更多入口。
  填满首页右侧排行榜壳层高度，让底部与左侧两行卡片对齐。
  使用轻量白底和细边框，形成比旧版更简约的排行榜视觉。
*/
.ranking-wrapper {
  /* 设置排行榜面板背景为白色，让榜单文字在浅色页面背景上保持清晰。 */
  background: #ffffff;

  /* 设置排行榜面板细边框，轻量区分榜单区域和页面背景。 */
  border: 1px solid var(--border-color);

  /* 保持当前项目偏直角的模块风格，避免排行榜显得像浮动卡片。 */
  border-radius: 0;

  /* 设置排行榜内部留白，让标题、列表和底部入口不贴边。 */
  padding: 14px 12px;

  /* 让排行榜填满右侧布局壳层的宽度。 */
  width: 100%;

  /* 让排行榜填满右侧布局壳层的高度。 */
  height: 100%;

  /* 清除 flex/grid 默认最小高度影响，保证列表可以在面板中正确收缩。 */
  min-height: 0;

  /* 使用纵向 flex，把头部、列表和底部入口按从上到下排列。 */
  display: flex;

  /* 设置主轴方向为纵向，保证查看更多入口固定在底部。 */
  flex-direction: column;

  /* 把排行榜尺寸计算纳入边框盒，避免内边距撑破右侧格栅。 */
  box-sizing: border-box;
}

/*
  作用容器: 排行榜头部 `.ranking-head`。
  样式作用:
  左侧展示榜单标题。
  右侧展示刷新数据入口。
  和列表之间保留清晰分隔。
*/
.ranking-head {
  /* 设置头部为横向 flex，让标题和刷新入口同行显示。 */
  display: flex;

  /* 设置标题和刷新入口垂直居中。 */
  align-items: center;

  /* 设置标题靠左、刷新入口靠右，形成“电影排行榜    刷新数据”布局。 */
  justify-content: space-between;

  /* 设置标题和刷新入口之间的最小间距，避免窄宽度下互相贴住。 */
  gap: 10px;

  /* 设置头部下方留白，让列表第一行不贴近标题。 */
  margin-bottom: 10px;

  /* 设置头部底部细线，轻量分隔标题区域和排行列表。 */
  border-bottom: 1px solid #eef2f7;

  /* 设置分隔线和头部内容之间的距离。 */
  padding-bottom: 8px;

  /* 固定头部高度贡献，不参与中间列表滚动压缩。 */
  flex-shrink: 0;
}

/*
  作用容器: 排行榜标题 `.ranking-title`。
  样式作用:
  强化当前榜单类型。
  在窄排行榜中保持简洁可读。
*/
.ranking-title {
  /* 设置榜单标题字号，保证在右侧窄栏中可读但不显得笨重。 */
  font-size: 17px;

  /* 设置标题字重，强化榜单模块层级。 */
  font-weight: 700;

  /* 设置标题颜色为主文字色，保证可读性。 */
  color: var(--text-primary);

  /* 清除标题默认外边距，避免头部高度被浏览器默认样式撑开。 */
  margin: 0;

  /* 标题允许在剩余空间内收缩，避免挤压刷新按钮。 */
  min-width: 0;

  /* 标题过长时单行省略，保护右侧刷新入口显示。 */
  overflow: hidden;

  /* 标题过长时显示省略号。 */
  text-overflow: ellipsis;

  /* 标题保持单行，和刷新入口保持同一行布局。 */
  white-space: nowrap;
}

/*
  作用容器: 刷新数据按钮 `.ranking-refresh`。
  样式作用:
  作为排行榜局部刷新入口。
  使用轻量文字按钮形态，避免抢占排行榜标题层级。
*/
.ranking-refresh {
  /* 设置刷新按钮为横向 flex，方便图标和文字同行居中。 */
  display: inline-flex;

  /* 设置刷新按钮内部图标和文字垂直居中。 */
  align-items: center;

  /* 设置图标和文字之间的距离。 */
  gap: 4px;

  /* 禁止刷新按钮被标题挤压变形，保证按钮文案稳定可读。 */
  flex: 0 0 auto;

  /* 清除按钮默认背景，让刷新入口保持简约。 */
  background: transparent;

  /* 清除按钮默认边框，让刷新入口贴近文字操作样式。 */
  border: 0;

  /* 清除按钮默认内边距，仅保留紧凑点击区域。 */
  padding: 0;

  /* 设置刷新入口字号小于标题，表达次级操作层级。 */
  font-size: 12px;

  /* 设置刷新入口颜色为弱提示色，避免压过榜单标题。 */
  color: var(--text-muted);

  /* 鼠标移入时显示可点击状态。 */
  cursor: pointer;

  /* 设置状态变化过渡，让 hover 和 disabled 更自然。 */
  transition: color 0.18s ease, opacity 0.18s ease;
}

/*
  作用容器: 刷新数据按钮悬停态 `.ranking-refresh:hover`。
  样式作用:
  提示用户刷新入口可点击。
  和默认弱提示色形成明确状态差异。
*/
.ranking-refresh:hover {
  /* 设置悬停时刷新入口变为主题色，提供交互反馈。 */
  color: var(--accent);
}

/*
  作用容器: 刷新数据按钮禁用态 `.ranking-refresh:disabled`。
  样式作用:
  表示当前排行榜正在重新请求数据。
  阻止用户连续点击造成重复请求。
*/
.ranking-refresh:disabled {
  /* 设置禁用态透明度，让用户感知按钮暂不可用。 */
  opacity: 0.55;

  /* 设置禁用态鼠标指针，表达当前按钮不可点击。 */
  cursor: not-allowed;
}

/*
  作用容器: 刷新中图标 `.ranking-refresh.is-refreshing .el-icon-refresh`。
  样式作用:
  在局部刷新请求进行时让刷新图标旋转。
  提供当前榜单正在更新的轻量反馈。
*/
.ranking-refresh.is-refreshing .el-icon-refresh {
  /* 设置刷新图标循环旋转，提示当前请求还未结束。 */
  animation: ranking-refresh-spin 0.9s linear infinite;
}

/*
  作用容器: 排行榜列表 `.ranking-list`。
  样式作用:
  承载当前容器高度能完整显示的排行内容。
  在固定高度侧栏中占用中间剩余空间并隐藏溢出内容。
*/
.ranking-list {
  /* 清除 ul 默认项目符号，使用自定义排名序号。 */
  list-style: none;

  /* 清除 ul 默认外边距，避免影响面板内部对齐。 */
  margin: 0;

  /* 清除 ul 默认内边距，让排行行和面板留白由父容器统一控制。 */
  padding: 0;

  /* 列表占用头部和底部入口之外的剩余高度。 */
  flex: 1;

  /* 清除最小高度限制，让列表可以在面板中正确收缩。 */
  min-height: 0;

  /* 隐藏超出可用高度的内容，排行榜任何时候都不显示内部滚动条。 */
  overflow: hidden;
}

/*
  作用容器: 单条排行榜行 `.ranking-item`。
  样式作用:
  用两行展示排行榜条目。
  第一行展示序号、标题和右对齐状态标签。
  第二行展示年份、地区和类型，避免辅助字段挤压标题。
  提供点击进入详情页的交互反馈。
*/
.ranking-item {
  /* 设置排行榜行为纵向 flex，让主信息行和辅助信息行上下排列。 */
  display: flex;

  /* 设置排行行主轴为纵向，保证第二行辅助信息不会和标签抢同一行宽度。 */
  flex-direction: column;

  /* 设置排行行两行之间的距离，让年份地区类型和标题保持清楚分层。 */
  gap: 4px;

  /* 设置排行行上下留白，提升两行结构的可读性。 */
  padding: 7px 2px 8px;

  /* 设置可点击鼠标指针，提示榜单行可以进入详情页。 */
  cursor: pointer;

  /* 设置状态过渡，让 hover 反馈更柔和。 */
  transition: background 0.16s ease, color 0.16s ease;
}

/*
  作用容器: 单条排行榜行悬停态 `.ranking-item:hover`。
  样式作用:
  提示用户当前排行行可以点击。
  使用极浅背景，不破坏简约榜单视觉。
*/
.ranking-item:hover {
  /* 设置排行行悬停背景为浅灰蓝，形成轻量交互反馈。 */
  background: #f7f9fc;
}

/*
  作用容器: 排行榜主信息行 `.ranking-main-row`。
  样式作用:
  横向排列序号、标题和状态标签。
  标题占用中间剩余空间，标签组固定靠右显示。
*/
.ranking-main-row {
  /* 设置主信息行为 flex 横向布局。 */
  display: flex;

  /* 设置序号、标题和标签组垂直居中。 */
  align-items: center;

  /* 设置主信息行占满整条榜单宽度。 */
  width: 100%;

  /* 设置主信息行内部间距，避免序号、标题和标签贴在一起。 */
  gap: 8px;

  /* 允许主信息行内部元素正确收缩，避免长标题撑破排行榜宽度。 */
  min-width: 0;
}

/*
  作用容器: 排名序号 `.ranking-index`。
  样式作用:
  展示排行序号。
  前三名由额外 class 强化颜色，其余名次保持普通橙色文字。
*/
.ranking-index {
  /* 设置序号固定占位，保证标题和第二行辅助信息起点稳定。 */
  flex: 0 0 22px;

  /* 设置序号左对齐，贴近微博热搜式简约序号风格。 */
  text-align: left;

  /* 设置序号字号，让双位数序号仍然可读。 */
  font-size: 15px;

  /* 设置序号加粗，提升扫描效率。 */
  font-weight: 700;

  /* 设置普通序号颜色为橙色，形成排行榜语义。 */
  color: #ff7a00;

  /* 设置序号行高，避免序号影响整行高度。 */
  line-height: 1;
}

/*
  作用容器: 前三名排名序号 `.ranking-index.rank-top`。
  样式作用:
  强化榜单前三名。
  让用户快速识别榜单最热内容。
*/
.ranking-index.rank-top {
  /* 设置前三名序号为偏红色，比普通名次更醒目。 */
  color: #ef5b50;
}

/*
  作用容器: 榜单标题文本 `.ranking-name`。
  样式作用:
  展示视频标题。
  在右侧窄栏空间不足时单行省略。
*/
.ranking-name {
  /* 允许标题列在主信息行中收缩，避免挤出右侧状态标签。 */
  min-width: 0;

  /* 设置标题占用主信息行剩余空间，短标题后面的空白由它和标签之间自然吸收。 */
  flex: 1 1 auto;

  /* 设置标题字号，保证右侧榜单中一行可读。 */
  font-size: 13px;

  /* 设置标题颜色为主文字色，维持主要信息层级。 */
  color: var(--text-primary);

  /* 设置标题保持单行，避免单条排行行变高。 */
  white-space: nowrap;

  /* 隐藏超出标题列的内容。 */
  overflow: hidden;

  /* 标题过长时用省略号提示仍有后续内容。 */
  text-overflow: ellipsis;
}

/*
  作用容器: 榜单状态标签组 `.ranking-badges`。
  样式作用:
  承载新、热、高分等状态标签。
  固定在主信息行右侧，避免标签挤入标题文字内部。
*/
.ranking-badges {
  /* 设置标签组为横向 flex，方便多个状态标签同行展示。 */
  display: inline-flex;

  /* 设置标签组垂直居中。 */
  align-items: center;

  /* 设置标签组靠右对齐，符合主信息行右侧标签布局。 */
  justify-content: flex-end;

  /* 设置多个状态标签之间的间距。 */
  gap: 4px;

  /* 禁止标签组被标题挤压变形，保证标签仍能完整显示。 */
  flex: 0 0 auto;
}

/*
  作用容器: 榜单辅助信息行 `.ranking-meta-row`。
  样式作用:
  左侧展示年份、地区和类型。
  右侧展示电影清晰度或电视剧集数字段。
  缩进到标题起点下方，和序号形成清楚层级。
*/
.ranking-meta-row {
  /* 设置辅助信息行为横向 flex，让左侧元信息和右侧状态字段同行展示。 */
  display: flex;

  /* 设置辅助信息行垂直居中，避免右侧字段和左侧文字基线错位。 */
  align-items: center;

  /* 设置左右辅助字段之间的间距，避免窄栏下文字贴住。 */
  gap: 8px;

  /* 设置辅助信息行占满整条榜单宽度。 */
  width: 100%;

  /* 设置辅助信息行左侧缩进，和第一行标题起点对齐。 */
  padding-left: 30px;

  /* 把内边距纳入宽度计算，避免缩进把行内容撑出面板。 */
  box-sizing: border-box;

  /* 允许辅助信息行在窄榜单中收缩。 */
  min-width: 0;
}

/*
  作用容器: 榜单辅助信息文本 `.ranking-meta-text`。
  样式作用:
  按“年份/地区/类型”展示 ContentItem 辅助字段。
  作为第二行左侧字段，优先占用剩余空间。
  空间不足时单行省略，避免拉高单条榜单行。
*/
.ranking-meta-text {
  /* 设置元信息文本吃掉右侧状态字段之外的剩余空间。 */
  flex: 1 1 auto;

  /* 允许元信息文本在 flex 行内正确收缩。 */
  min-width: 0;

  /* 设置辅助文案字号小于标题，表达次级信息。 */
  font-size: 11px;

  /* 设置辅助文案颜色为弱提示色，避免和标题抢层级。 */
  color: #8a93a3;

  /* 设置辅助文案保持单行。 */
  white-space: nowrap;

  /* 隐藏超出排行榜宽度的辅助文案。 */
  overflow: hidden;

  /* 辅助文案过长时显示省略号。 */
  text-overflow: ellipsis;

  /* 设置辅助信息为块级元素，让省略号基于整行宽度计算。 */
  display: block;
}

/*
  作用容器: 榜单第二行右侧状态字段 `.ranking-status-text`。
  样式作用:
  电影展示清晰度字段。
  电视剧展示更新状态或全集数字段。
  靠右对齐，和第一行右侧标签组形成稳定右边界。
*/
.ranking-status-text {
  /* 设置状态字段不被左侧元信息挤压变形。 */
  flex: 0 0 auto;

  /* 限制右侧状态字段最大宽度，避免长集数文案把左侧元信息压没。 */
  max-width: 42%;

  /* 设置状态字段字号和第二行元信息一致，保持辅助字段层级统一。 */
  font-size: 11px;

  /* 设置状态字段颜色略深于左侧元信息，便于扫读清晰度或集数。 */
  color: var(--text-secondary);

  /* 设置状态字段字重略强调，但不使用 chip 背景，保持排行榜简约。 */
  font-weight: 600;

  /* 设置状态字段靠右对齐。 */
  text-align: right;

  /* 设置状态字段单行显示。 */
  white-space: nowrap;

  /* 隐藏超出状态字段宽度的内容。 */
  overflow: hidden;

  /* 状态字段过长时显示省略号，避免撑破排行榜面板。 */
  text-overflow: ellipsis;
}

/*
  作用容器: 榜单状态标签 `.ranking-badge`。
  样式作用:
  展示新、热、高分等轻量状态。
  使用小面积色块提示，不让标签压过标题。
*/
.ranking-badge {
  /* 设置状态标签为行内 flex，保证文字垂直水平居中。 */
  display: inline-flex;

  /* 设置标签文字垂直居中。 */
  align-items: center;

  /* 设置标签文字水平居中。 */
  justify-content: center;

  /* 禁止标签被右侧空间挤压变形。 */
  flex: 0 0 auto;

  /* 设置标签最小宽度，让单字标签仍有可点击视觉面积。 */
  min-width: 17px;

  /* 设置标签高度，控制榜单行整体紧凑度。 */
  height: 15px;

  /* 设置标签横向内边距，让双字标签有呼吸空间。 */
  padding: 0 4px;

  /* 设置标签圆角，形成轻量 pill 视觉。 */
  border-radius: 4px;

  /* 设置标签背景为粉红强调色，贴近热搜榜的小标签风格。 */
  background: #ff5d7a;

  /* 设置标签文字为白色，保证和强调背景形成对比。 */
  color: #ffffff;

  /* 设置标签字号，避免状态标签抢标题空间。 */
  font-size: 10px;

  /* 设置标签字重，让小字号仍然清晰。 */
  font-weight: 700;

  /* 设置标签行高，避免字体撑高标签。 */
  line-height: 1;
}

/*
  作用容器: 排行榜空状态 `.ranking-empty`。
  样式作用:
  在没有榜单数据时占据列表区域。
  让右侧面板结构保持稳定。
*/
.ranking-empty {
  /* 空状态占用列表区域剩余高度，保持底部查看更多入口位置稳定。 */
  flex: 1;

  /* 设置空状态最小高度，避免空面板过薄。 */
  min-height: 160px;
}

/*
  作用容器: 查看更多按钮 `.ranking-more`。
  样式作用:
  固定在排行榜底部。
  提供进入完整榜单或对应列表页的轻量入口。
*/
.ranking-more {
  /* 设置查看更多为横向 flex，方便文字和箭头同行居中。 */
  display: inline-flex;

  /* 设置按钮内容垂直居中。 */
  align-items: center;

  /* 设置按钮内容水平居中。 */
  justify-content: center;

  /* 设置文字和箭头之间的距离。 */
  gap: 6px;

  /* 设置按钮宽度填满排行榜面板。 */
  width: 100%;

  /* 设置按钮顶部外边距，把查看更多和列表末尾分开。 */
  margin-top: 10px;

  /* 设置按钮高度，形成明确但不笨重的底部入口。 */
  min-height: 34px;

  /* 设置按钮背景为浅灰，贴近参考图底部查看更多区域。 */
  background: #f7f7f8;

  /* 清除按钮边框，保持底部入口简约。 */
  border: 0;

  /* 设置按钮圆角略小，跟项目卡片直角风格保持克制。 */
  border-radius: 4px;

  /* 设置按钮文字颜色为弱提示色，表达次级入口。 */
  color: var(--text-muted);

  /* 设置按钮字号，保证底部入口可读。 */
  font-size: 13px;

  /* 设置可点击鼠标指针。 */
  cursor: pointer;

  /* 固定底部入口高度贡献，不参与列表滚动压缩。 */
  flex-shrink: 0;

  /* 设置交互过渡，让 hover 反馈更柔和。 */
  transition: background 0.16s ease, color 0.16s ease;
}

/*
  作用容器: 查看更多按钮悬停态 `.ranking-more:hover`。
  样式作用:
  提示用户可以进入更多内容。
  使用主题色强化当前可点击状态。
*/
.ranking-more:hover {
  /* 设置悬停背景略深，让底部入口有反馈但不突兀。 */
  background: #eef3ff;

  /* 设置悬停文字为主题色，强化可点击状态。 */
  color: var(--accent);
}

/*
  作用容器: 刷新图标旋转动画 `ranking-refresh-spin`。
  样式作用:
  给刷新中按钮提供局部加载反馈。
  只影响刷新图标，不影响榜单列表布局。
*/
@keyframes ranking-refresh-spin {
  /* 动画起点保持图标原始角度。 */
  from {
    /* 设置旋转起点为 0 度。 */
    transform: rotate(0deg);
  }

  /* 动画终点让图标旋转一整圈。 */
  to {
    /* 设置旋转终点为 360 度，循环时形成连续刷新感。 */
    transform: rotate(360deg);
  }
}

/*
  作用容器: 窄屏下的排行榜根容器 `.ranking-wrapper`。
  样式作用:
  移动端取消固定高度依赖。
  让排行榜内容在卡片区下方自然展开。
*/
@media (max-width: 768px) {
  .ranking-wrapper {
    /* 移动端让排行榜跟随内容高度，避免右侧面板高度限制影响展示。 */
    height: auto;
  }

  .ranking-list {
    /* 移动端同样不显示内部滚动条，内容跟随页面整体高度自然展开或按测量结果截断。 */
    overflow: visible;
  }
}
</style>
