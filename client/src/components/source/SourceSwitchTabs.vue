<template>
  <!--
    SourceSwitchTabs 数据源导航组件渲染树

    [IF hasVisibleSources || displayError] ele(section.source-switch-tabs)
    │  - condition: 存在 Runtime 候选或需要展示错误时渲染。
    │  - type: 原生 section。
    │  - description: 承载当前页面唯一数据源导航和失败说明。
    │  - params: -- ariaLabel；-- isSwitching。
    │  - events: 无。
    │
    ├─ [IF hasVisibleSources] ele(header.source-switch-tabs__heading)
    │  - condition: DOM 随候选存在，CSS 只在桌面端显示。
    │  - type: 原生 header。
    │  - description: 展示数据源导航行标题和当前可用候选数量。
    │  - params: -- visibleSources.length。
    │  - events: 无。
    │
    ├─ [IF hasVisibleSources] ele(button.source-switch-tabs__trigger)
    │  - condition: DOM 随候选存在，CSS 只在 768px 以下显示。
    │  - type: 原生 button。
    │  - description: 显示当前源并控制同一候选菜单在文档流内展开。
    │  - params: -- currentSource；-- isMenuOpen；-- currentSourceHealthStatus。
    │  - events: @click -> toggleMenu()。
    │
    ├─ [IF hasVisibleSources] ele(div.source-switch-tabs__rail)
    │  │  - condition: 候选存在时渲染；桌面显示滚动控制，手机只保留同一菜单。
    │  │  - type: 原生 div。
    │  │  - description: 把前进按钮、横向 viewport、唯一候选树和后退按钮组成单行轨道。
    │  │  - params: -- canScrollBackward；-- canScrollForward。
    │  │  - events: 无。
    │  ├─ [DEFAULT] ele(button.source-switch-tabs__scroll-button--backward)
    │  │  - condition: 桌面显示；到达左边界时禁用。
    │  │  - type: 原生 button。
    │  │  - description: 按一个 viewport 宽度向前浏览候选。
    │  │  - params: -- canScrollBackward。
    │  │  - events: @click -> scrollDesktopViewport(-1)。
    │  ├─ [DEFAULT] ele(div.source-switch-tabs__viewport)
    │  │  │  - condition: 候选存在时渲染。
    │  │  │  - type: 原生 div。
    │  │  │  - description: 仅在组件内部横向滚动，不改变页面滚动位置。
    │  │  │  - params: -- sourceViewport ref。
    │  │  │  - events: @scroll.passive -> updateScrollControls()。
    │  │  └─ [DEFAULT] ele(div.source-switch-tabs__menu)
    │  │     │  - condition: 桌面始终横向显示；窄屏由 isMenuOpen 控制显示。
    │  │     │  - type: 原生 div，role=tablist。
    │  │     │  - description: 唯一候选按钮树，桌面单行、手机纵排。
    │  │     │  - params: -- visibleSources；-- displaySourceId；-- switchState。
    │  │     │  - events: 无。
    │  │     └─ [DEFAULT] ele(button.source-switch-tabs__item)
    │  │        - condition: 每个 visibleSources 条目只渲染一次。
    │  │        - type: 原生 button，role=tab。
    │  │        - description: 展示短名称和健康点，提交 Runtime 原子切换意图。
    │  │        - params: -- source.id/name/healthStatus；-- displaySourceId；-- switchState。
    │  │        - events: @click -> handleSourceSelect(source)。
    │  └─ [DEFAULT] ele(button.source-switch-tabs__scroll-button--forward)
    │     - condition: 桌面显示；到达右边界时禁用。
    │     - type: 原生 button。
    │     - description: 按一个 viewport 宽度向后浏览候选。
    │     - params: -- canScrollForward。
    │     - events: @click -> scrollDesktopViewport(1)。
    │
    └─ [IF displayError] ele(p.source-switch-tabs__error)
       - condition: 候选加载或最新切换失败时渲染。
       - type: 原生 p，role=alert。
       - description: 展示安全错误，旧活动源和旧页面内容保持不变。
       - params: -- displayError。
       - events: 无。
  -->
  <!--
    [IF hasVisibleSources || displayError] ele(section.source-switch-tabs)
    - condition: 存在候选或错误说明时渲染，完全空闲时不占页面高度。
    - type: 原生 section。
    - description: 首页、电影、电视剧和搜索页共用的唯一数据源导航。
    - params: -- ariaLabel；-- isSwitching。
    - events: 无。
  -->
  <section
    v-if="hasVisibleSources || displayError"
    class="source-switch-tabs"
    :aria-label="ariaLabel"
    :aria-busy="isSwitching ? 'true' : 'false'"
  >
    <!--
      [IF hasVisibleSources] ele(header.source-switch-tabs__heading)
      - condition: 候选存在时渲染，CSS 只在桌面端显示。
      - type: 原生 header。
      - description: 在滚动轨道之前给出“可用数据源”行标题和完整候选数量。
      - params: -- visibleSources.length。
      - events: 无。
    -->
    <header v-if="hasVisibleSources" class="source-switch-tabs__heading">
      <h2 class="source-switch-tabs__title">可用数据源</h2>
      <span class="source-switch-tabs__count" aria-label="可用数据源数量">
        ({{ visibleSources.length }})
      </span>
    </header>

    <!--
      [IF hasVisibleSources] ele(button.source-switch-tabs__trigger)
      - condition: 候选存在时渲染，CSS 在 768px 以下显示。
      - type: 原生 button。
      - description: 以当前源短名称作为手机入口，向下展开同一候选按钮树。
      - params: -- mobileTriggerLabel；-- isMenuOpen；-- currentSourceHealthStatus。
      - events: @click -> toggleMenu()。
    -->
    <button
      v-if="hasVisibleSources"
      type="button"
      class="source-switch-tabs__trigger"
      :aria-label="mobileTriggerAriaLabel"
      aria-controls="source-switch-tabs-menu"
      :aria-expanded="String(isMenuOpen)"
      @click="toggleMenu"
    >
      <i class="el-icon-menu source-switch-tabs__trigger-icon" aria-hidden="true"></i>
      <span class="source-switch-tabs__trigger-name">{{ mobileTriggerLabel }}</span>
      <span
        class="source-switch-tabs__status-dot"
        :class="`source-switch-tabs__status-dot--${currentSourceHealthStatus}`"
        :aria-label="getStatusLabel(currentSourceHealthStatus)"
      ></span>
      <i
        class="el-icon-arrow-down source-switch-tabs__trigger-arrow"
        :class="{ 'source-switch-tabs__trigger-arrow--open': isMenuOpen }"
        aria-hidden="true"
      ></i>
    </button>

    <!--
      [IF hasVisibleSources] ele(div.source-switch-tabs__rail)
      - condition: 候选存在时渲染；桌面显示滚动按钮，手机只改变同一菜单的布局。
      - type: 原生 div。
      - description: 在组件宽度内承载任意数量候选，不允许按钮换行推动页面高度。
      - params: -- canScrollBackward；-- canScrollForward。
      - events: 无。
    -->
    <div v-if="hasVisibleSources" class="source-switch-tabs__rail">
      <!--
        [DEFAULT] ele(button.source-switch-tabs__scroll-button--backward)
        - condition: 桌面显示；viewport 已在最左侧时禁用。
        - type: 原生 button。
        - description: 向前移动一个当前 viewport 宽度，不操作页面滚动条。
        - params: -- canScrollBackward。
        - events: @click -> scrollDesktopViewport(-1)。
      -->
      <button
        type="button"
        class="source-switch-tabs__scroll-button source-switch-tabs__scroll-button--backward"
        aria-label="向前浏览数据源"
        :disabled="!canScrollBackward"
        @click="scrollDesktopViewport(-1)"
      >
        <i class="el-icon-arrow-left" aria-hidden="true"></i>
      </button>

      <!--
        [DEFAULT] ele(div.source-switch-tabs__viewport)
        - condition: 候选存在时渲染。
        - type: 原生 div。
        - description: 桌面内部横向滚动窗口；手机解除滚动裁切并承载折叠菜单。
        - params: -- sourceViewport ref。
        - events: @scroll.passive -> updateScrollControls()。
      -->
      <div
        ref="sourceViewport"
        class="source-switch-tabs__viewport"
        @scroll.passive="updateScrollControls"
      >
        <!--
          [DEFAULT] ele(div.source-switch-tabs__menu)
          - condition: 宽屏常驻，窄屏由 isMenuOpen 控制可见类。
          - type: 原生 div，role=tablist。
          - description: 同一候选集合在不同视口只改变布局，不复制数组、按钮或切换事务。
          - params: -- visibleSources；-- isMenuOpen。
          - events: 无。
        -->
        <div
          id="source-switch-tabs-menu"
          ref="sourceMenu"
          class="source-switch-tabs__menu"
          :class="{ 'source-switch-tabs__menu--open': isMenuOpen }"
          role="tablist"
        >
          <!--
            [DEFAULT] ele(button.source-switch-tabs__item)
            - condition: visibleSources 每个真实 id 条目渲染一次。
            - type: 原生 button，role=tab。
            - description: 只显示导航短名称和健康状态点，当前态、pending 态和普通态彼此区分。
            - params: -- source.id/name/healthStatus；-- displaySourceId；-- switchState。
            - events: @click -> handleSourceSelect(source)。
          -->
          <button
            v-for="source in visibleSources"
            :key="source.id"
            ref="sourceButtons"
            type="button"
            class="source-switch-tabs__item"
            :class="{
              'source-switch-tabs__item--active': source.id === displaySourceId,
              'source-switch-tabs__item--pending': isSourcePending(source)
            }"
            :data-source-id="source.id"
            role="tab"
            :aria-selected="source.id === displaySourceId ? 'true' : 'false'"
            :aria-busy="isSourcePending(source) ? 'true' : 'false'"
            :disabled="isSourceInteractionDisabled(source)"
            @click="handleSourceSelect(source)"
          >
            <span class="source-switch-tabs__name">{{ source.name }}</span>
            <span
              class="source-switch-tabs__status-dot"
              :class="`source-switch-tabs__status-dot--${source.healthStatus || 'unknown'}`"
              :aria-label="getStatusLabel(source.healthStatus)"
            ></span>
          </button>
        </div>
      </div>

      <!--
        [DEFAULT] ele(button.source-switch-tabs__scroll-button--forward)
        - condition: 桌面显示；viewport 已在最右侧时禁用。
        - type: 原生 button。
        - description: 向后移动一个当前 viewport 宽度，不操作页面滚动条。
        - params: -- canScrollForward。
        - events: @click -> scrollDesktopViewport(1)。
      -->
      <button
        type="button"
        class="source-switch-tabs__scroll-button source-switch-tabs__scroll-button--forward"
        aria-label="向后浏览数据源"
        :disabled="!canScrollForward"
        @click="scrollDesktopViewport(1)"
      >
        <i class="el-icon-arrow-right" aria-hidden="true"></i>
      </button>
    </div>

    <!--
      [IF displayError] ele(p.source-switch-tabs__error)
      - condition: 候选加载或最新切换失败时渲染。
      - type: 原生 p，role=alert。
      - description: 展示安全失败说明，不清空旧活动源和旧页面数据。
      - params: -- displayError。
      - events: 无。
    -->
    <p v-if="displayError" class="source-switch-tabs__error" role="alert" aria-live="polite">
      {{ displayError }}
    </p>
  </section>
</template>

<script>
/*
  SourceSwitchTabs.vue 模块说明

  - 文件职责:
      展示当前页面由 Runtime 派生的可执行数据源，并提交唯一原子切换意图。
      桌面标题、数量、横向滚动轨道与窄屏折叠入口共用一棵候选按钮树、一个活动源投影和一个切换方法。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      HEALTH_STATUS/SOURCE_SWITCH_STATUS: 自定义稳定枚举，用于健康说明和切换状态判断。
      sourcePageService: 自定义页面适配服务，提供活动源、Manager 投影、候选和切换入口。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SourceSwitchTabs: Vue component，供四个内容页面复用的唯一数据源导航。
*/

import {
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 三态健康枚举。
  // 文件作用: 把候选健康字段转换为稳定辅助说明和状态样式。
  HEALTH_STATUS,
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_SWITCH_STATUS 原子切换状态枚举。
  // 文件作用: 判断 switching 和 success，不解析自由文案决定交互。
  SOURCE_SWITCH_STATUS
} from '../../config/source-manager.config.js';

import {
  // 导入来源: ../../services/sourcePageService.js。
  // 导入内容: getActivePageSourceId 页面有效活动源读取函数。
  // 文件作用: 当前态展示复用 activeSourceId 优先、defaultSourceId 兜底语义。
  getActivePageSourceId,
  // 导入来源: ../../services/sourcePageService.js。
  // 导入内容: getPageSourceManagerState 当前完整 Manager 投影读取函数。
  // 文件作用: computed 直接观察唯一 switchState，不建立 pending 影子状态。
  getPageSourceManagerState,
  // 导入来源: ../../services/sourcePageService.js。
  // 导入内容: listPageSources 当前页面 Runtime 候选查询函数。
  // 文件作用: created 时加载已通过唯一候选门禁的轻量展示对象。
  listPageSources,
  // 导入来源: ../../services/sourcePageService.js。
  // 导入内容: switchPageSource 原子切换适配函数。
  // 文件作用: 用户选择后委托 Runtime，不直接修改 Manager、会话存储或页面 store。
  switchPageSource
} from '../../services/sourcePageService.js';

export default {
  // 组件名称: SourceSwitchTabs；用途: Vue Devtools 和四个内容页面组件注册识别。
  name: 'SourceSwitchTabs',

  props: {
    // 类型: string；来源: 父页面固定传入 home、movie、tv 或 search；作用: 选择对应 capability 候选。
    pageKey: {
      type: String,
      required: true
    },
    // 类型: string；来源: 父页面页面语义；作用: 给导航区域提供辅助技术名称。
    ariaLabel: {
      type: String,
      default: '数据源切换'
    }
  },

  /**
   * 创建数据源导航局部展示状态。
   * 纯函数: 每个实例返回独立候选、错误和折叠状态，不读取 Runtime 或修改父页面。
   * 成功路径: 候选为空、错误为空、查询空闲、窄屏菜单收起且桌面滚动控制停在边界状态。
   * 失败路径: 本函数无异步操作和预期异常。
   *
   * @returns {object} 当前组件局部展示状态。
   */
  data() {
    return {
      // 类型: Array<object>；来源: listPageSources；作用: 保存当前组件轻量候选投影，空数组表示尚未加载或无候选。
      sourceTabs: [],
      // 类型: boolean；true 表示候选查询中，false 表示已收敛；由 loadAvailableSources 修改并影响交互门禁。
      sourceListLoading: false,
      // 类型: string；作用: 候选查询失败说明，成功加载后清空。
      sourceListError: '',
      // 类型: string；作用: 当前组件最近一次切换调用失败说明，新切换或成功后清空。
      interactionError: '',
      // 类型: boolean；true 展开窄屏同一候选菜单，false 收起；只属于展示状态，不保存活动源。
      isMenuOpen: false,
      // 类型: boolean；true 允许桌面向前浏览，false 表示 viewport 已在左边界；由 updateScrollControls 修改。
      canScrollBackward: false,
      // 类型: boolean；true 允许桌面向后浏览，false 表示 viewport 已在右边界或无需滚动；由 updateScrollControls 修改。
      canScrollForward: false,
      // 类型: ResizeObserver|null；生命周期由 setup/teardownSourceViewportObservation 管理，只观察组件 viewport 和菜单尺寸。
      sourceViewportResizeObserver: null
    };
  },

  computed: {
    /**
     * 读取当前响应式 SourceManagerState。
     * 纯函数: 返回 settingsStore 已采用的完整投影，不复制或修改字段。
     *
     * @returns {object} 当前 Manager 页面投影。
     */
    sourceManagerState() {
      return getPageSourceManagerState();
    },

    /**
     * 读取当前页面有效数据源身份。
     * 纯函数: 复用页面 service 统一语义，不读取内容 store、首项候选或组件本地身份。
     *
     * @returns {string} activeSourceId，尚未建立时为 defaultSourceId，再缺失时为空字符串。
     */
    displaySourceId() {
      return getActivePageSourceId();
    },

    /**
     * 过滤可渲染候选。
     * 纯函数: 只排除映射异常的空 id，不复制 enabled、授权、工厂或 capability 门禁。
     *
     * @returns {Array<object>} 具有真实 id 的 Runtime 候选展示对象。
     */
    visibleSources() {
      return this.sourceTabs.filter(source => source && source.id);
    },

    /**
     * 判断当前是否存在候选。
     * 纯函数: 只读取 visibleSources 长度。
     *
     * @returns {boolean} true 渲染触发器和菜单，false 隐藏候选结构。
     */
    hasVisibleSources() {
      return this.visibleSources.length > 0;
    },

    /**
     * 查找当前活动源对应候选。
     * 纯函数: 只在同一 visibleSources 中按 displaySourceId 查找，不猜测首项。
     * 失败路径: 身份尚未建立或候选变化时返回 null。
     *
     * @returns {object|null} 当前活动候选或 null。
     */
    currentSource() {
      return this.visibleSources.find(source => source.id === this.displaySourceId) || null;
    },

    /**
     * 读取当前活动源切换事务。
     * 纯函数: 只读取 Manager switchState，不另存 pending、requestId 或回滚字段。
     *
     * @returns {object} 当前切换状态对象。
     */
    switchState() {
      return this.sourceManagerState.switchState;
    },

    /**
     * 判断 Manager 是否正在准备活动源。
     * 纯函数: 只比较稳定状态枚举。
     *
     * @returns {boolean} true 表示 switching，false 表示其他稳定状态。
     */
    isSwitching() {
      return this.switchState.status === SOURCE_SWITCH_STATUS.switching;
    },

    /**
     * 派生窄屏触发器名称。
     * 纯函数: 有真实当前源时显示其短名称，否则显示不猜测身份的选择提示。
     *
     * @returns {string} 当前源短名称或“选择数据源”。
     */
    mobileTriggerLabel() {
      return this.currentSource ? this.currentSource.name : '选择数据源';
    },

    /**
     * 派生窄屏触发器健康状态。
     * 纯函数: 只读取当前候选健康字段，缺失时使用 unknown 视觉键。
     *
     * @returns {string} 当前健康枚举或 unknown。
     */
    currentSourceHealthStatus() {
      return this.currentSource ? this.currentSource.healthStatus || 'unknown' : 'unknown';
    },

    /**
     * 派生窄屏触发器辅助说明。
     * 纯函数: 只组合当前短名称和菜单动作，不修改折叠或领域状态。
     *
     * @returns {string} 打开数据源导航的辅助技术说明。
     */
    mobileTriggerAriaLabel() {
      return this.currentSource
        ? `当前数据源 ${this.currentSource.name}，打开选择菜单`
        : '打开数据源选择菜单';
    },

    /**
     * 派生当前错误说明。
     * 纯函数: 按交互、Manager 和候选加载顺序选择，不修改任一来源。
     *
     * @returns {string} 用户可读错误；无错误时为空字符串。
     */
    displayError() {
      return this.interactionError || this.switchState.errorMessage || this.sourceListError || '';
    }
  },

  watch: {
    /**
     * 观察活动源身份变化并确保当前按钮留在组件 viewport 内。
     * 来源: SourceManagerState.activeSourceId 或 defaultSourceId 的响应式投影变化。
     * 副作用: 等待当前 DOM 更新后，只调整 sourceViewport.scrollLeft，不移动页面滚动位置。
     * 成功路径: 当前按钮位于可见区时保持位置，超出时滚到最近边界。
     * 失败路径: 当前身份或 DOM 不存在时安全结束。
     *
     * @returns {void} watcher 只安排下一轮 DOM 内部定位。
     */
    displaySourceId() {
      // 异步边界: 等待 active class 和按钮引用完成更新，再执行组件内部可见性校正。
      this.$nextTick(() => {
        this.revealActiveSource();
      });
    }
  },

  /**
   * Vue created 生命周期。
   * 执行时机: props、data、computed 和 methods 可用，DOM 尚未挂载。
   * 副作用: 查询当前 pageKey 的 Runtime 候选并整体采用轻量数组；不启动 Provider 或切换活动源。
   * 成功路径: 页面首次渲染获得统一候选。
   * 失败路径: loadAvailableSources 保存安全错误并保持空候选。
   *
   * @returns {void} 生命周期只触发异步候选加载。
   */
  created() {
    this.loadAvailableSources();
  },

  /**
   * Vue beforeDestroy 生命周期。
   * 执行时机: 组件即将离开页面、DOM 引用仍可访问时。
   * 副作用: 断开 ResizeObserver，释放 viewport 和菜单 DOM 引用。
   * 成功路径: 已创建观察器被幂等释放；未创建时直接结束。
   * 失败路径: teardownSourceViewportObservation 不抛出预期异常。
   *
   * @returns {void} 资源释放完成后结束。
   */
  beforeDestroy() {
    this.teardownSourceViewportObservation();
  },

  methods: {
    /**
     * 读取桌面候选滚动 viewport。
     * 纯函数: 只读取 Vue ref，不修改 DOM、组件状态或页面滚动位置。
     * 失败路径: 候选尚未渲染或组件销毁时返回 null。
     *
     * @returns {HTMLElement|null} 当前 sourceViewport DOM 节点或 null。
     */
    getSourceViewport() {
      return this.$refs.sourceViewport || null;
    },

    /**
     * 根据组件 viewport 的真实滚动范围更新前后按钮状态。
     * 触发来源: viewport scroll、候选加载和 ResizeObserver 尺寸变化。
     * 副作用: 更新 canScrollBackward/canScrollForward；不写领域状态或页面滚动位置。
     * 成功路径: 使用滚动像素的 floor/ceil 收敛亚像素边界，避免额外容差魔法值。
     * 失败路径: viewport 不存在时关闭两个滚动方向。
     *
     * @returns {void} 按钮状态与当前 DOM 尺寸同步后结束。
     */
    updateScrollControls() {
      // 类型: HTMLElement|null；来源: 当前组件 sourceViewport ref；作用: 提供内部滚动边界事实。
      const viewport = this.getSourceViewport();

      // 条件分支: 候选尚未渲染或组件正在销毁时进入。
      // 执行内容: 关闭两个方向，避免保留上一轮可滚动状态。
      if (!viewport) {
        this.canScrollBackward = false;
        this.canScrollForward = false;
        return;
      }

      // 类型: number；来源: DOM scrollLeft；作用: 向下取整后判断是否真实离开左边界。
      const normalizedScrollStart = Math.floor(viewport.scrollLeft);
      // 类型: number；来源: scrollLeft + clientWidth；作用: 向上取整后判断可见区是否已覆盖右边界。
      const normalizedScrollEnd = Math.ceil(viewport.scrollLeft + viewport.clientWidth);

      // 副作用: 只投影 DOM 边界状态；true/false 分别控制前进按钮可用和禁用。
      this.canScrollBackward = normalizedScrollStart > 0;
      // 副作用: scrollWidth 超出可见终点时允许向后浏览，否则禁用右侧按钮。
      this.canScrollForward = normalizedScrollEnd < viewport.scrollWidth;
    },

    /**
     * 按当前 viewport 宽度向前或向后浏览一页候选。
     * 触发来源: 桌面左右箭头 click。
     * 副作用: 只调用 sourceViewport.scrollBy；滚动按钮状态由 passive scroll 事件统一更新。
     * 成功路径: direction 为 -1 或 1 且 viewport 可见时移动一个完整可视宽度。
     * 失败路径: 非法方向、缺失 viewport 或零宽布局时安全结束。
     *
     * @param {number} direction -1 表示向前，1 表示向后。
     * @returns {void} 滚动请求提交后结束。
     */
    scrollDesktopViewport(direction) {
      // 条件分支: 只接受模板固定传入的两个方向，阻止任意数值形成不可预测滚动距离。
      // 执行内容: 非法方向直接结束，不触发任何 DOM 滚动副作用。
      if (direction !== -1 && direction !== 1) {
        return;
      }

      // 类型: HTMLElement|null；来源: 当前组件 ref；作用: 限定滚动副作用只发生在导航内部。
      const viewport = this.getSourceViewport();

      // 条件分支: viewport 缺失或当前布局没有可视宽度时进入。
      // 执行内容: 不修改页面或按钮状态，等待下一次尺寸观察。
      if (!viewport || viewport.clientWidth <= 0) {
        return;
      }

      // DOM 副作用: 按一个真实 viewport 宽度翻页；CSS scroll-behavior 决定普通和减少动效模式。
      viewport.scrollBy({
        left: direction * viewport.clientWidth,
        top: 0
      });
    },

    /**
     * 让当前活动源按钮保持在组件 viewport 的最近可见边界内。
     * 触发来源: 候选加载完成和 displaySourceId watcher。
     * 副作用: 仅在当前按钮位于 viewport 外时写入 sourceViewport.scrollLeft。
     * 成功路径: 左侧越界对齐左边界，右侧越界对齐右边界，已可见时保持用户位置。
     * 失败路径: 缺失活动身份、按钮引用或零宽 viewport 时安全结束。
     *
     * @returns {void} 当前源可见性校正完成后同步滚动按钮状态。
     */
    revealActiveSource() {
      // 类型: HTMLElement|null；来源: 当前组件 ref；作用: 提供可见区起止位置。
      const viewport = this.getSourceViewport();
      // 类型: Array<HTMLElement>；来源: v-for sourceButtons ref；作用: 在唯一候选树中定位当前活动按钮。
      const sourceButtons = Array.isArray(this.$refs.sourceButtons)
        ? this.$refs.sourceButtons
        : [];

      // 条件分支: DOM 未就绪、活动身份为空或 viewport 不可见时进入。
      // 执行内容: 保持当前滚动位置并关闭本轮定位。
      if (!viewport || !this.displaySourceId || viewport.clientWidth <= 0) {
        this.updateScrollControls();
        return;
      }

      // 类型: HTMLElement|undefined；来源: 唯一候选按钮树；作用: 用稳定 sourceId 找到当前活动按钮。
      const activeButton = sourceButtons.find(button => button.dataset.sourceId === this.displaySourceId);

      // 条件分支: 当前身份暂不在候选集合中时进入。
      // 执行内容: 不猜测首项或改变活动源，只同步现有滚动边界。
      if (!activeButton) {
        this.updateScrollControls();
        return;
      }

      // 类型: number；来源: viewport DOM；作用: 当前可见区域左边界。
      const viewportStart = viewport.scrollLeft;
      // 类型: number；来源: viewportStart + clientWidth；作用: 当前可见区域右边界。
      const viewportEnd = viewportStart + viewport.clientWidth;
      // 类型: number；来源: activeButton.offsetLeft；作用: 当前按钮相对菜单滚动内容的左边界。
      const buttonStart = activeButton.offsetLeft;
      // 类型: number；来源: offsetLeft + offsetWidth；作用: 当前按钮右边界。
      const buttonEnd = buttonStart + activeButton.offsetWidth;

      // 条件分支: 当前按钮位于可见区域左侧时进入。
      // 执行内容: 只把组件 viewport 对齐到按钮左边界并同步箭头状态。
      if (buttonStart < viewportStart) {
        viewport.scrollLeft = buttonStart;
        this.updateScrollControls();
        return;
      }

      // 条件分支: 当前按钮位于可见区域右侧时进入。
      // 执行内容: 用真实按钮右边界减 viewport 宽度完成最近边界对齐。
      if (buttonEnd > viewportEnd) {
        viewport.scrollLeft = buttonEnd - viewport.clientWidth;
      }

      this.updateScrollControls();
    },

    /**
     * 建立组件滚动 viewport 和候选菜单的尺寸观察。
     * 触发来源: 候选 DOM 完成渲染后。
     * 副作用: 先释放旧观察器，再创建 ResizeObserver 并观察两个当前 DOM 节点。
     * 成功路径: viewport 宽度或菜单内容宽度变化时重新计算箭头边界。
     * 失败路径: 浏览器不支持 ResizeObserver 或 DOM 未就绪时保留基础滚动能力并执行一次边界计算。
     *
     * @returns {void} 观察器建立或降级计算完成后结束。
     */
    setupSourceViewportObservation() {
      // 资源边界: 重建前先断开旧观察器，避免候选重载后继续持有旧 DOM。
      this.teardownSourceViewportObservation();

      // 类型: HTMLElement|null；来源: 当前组件 sourceViewport ref；作用: 观察可见宽度变化。
      const viewport = this.getSourceViewport();
      // 类型: HTMLElement|null；来源: 当前组件 sourceMenu ref；作用: 观察候选总宽度变化。
      const menu = this.$refs.sourceMenu || null;

      // 条件分支: DOM 尚未生成或当前环境没有 ResizeObserver 时进入。
      // 执行内容: 不创建轮询、window 监听或固定等待，只做一次真实边界计算。
      if (!viewport || !menu || typeof ResizeObserver !== 'function') {
        this.updateScrollControls();
        return;
      }

      // 资源创建: 回调只读取当前 DOM 尺寸并更新局部箭头状态，由 beforeDestroy 或重载入口断开。
      this.sourceViewportResizeObserver = new ResizeObserver(() => {
        this.updateScrollControls();
      });
      // DOM 观察副作用: viewport 尺寸变化会更新可见边界。
      this.sourceViewportResizeObserver.observe(viewport);
      // DOM 观察副作用: 候选增减或字体布局变化会更新总滚动宽度。
      this.sourceViewportResizeObserver.observe(menu);
      this.updateScrollControls();
    },

    /**
     * 释放当前组件的尺寸观察器。
     * 触发来源: 重建观察、候选清空和 beforeDestroy。
     * 副作用: disconnect 后清空实例引用，允许 DOM 和组件被回收。
     * 成功路径: 存在观察器时完整断开；不存在时幂等结束。
     * 失败路径: ResizeObserver.disconnect 不产生业务失败。
     *
     * @returns {void} 资源释放完成后结束。
     */
    teardownSourceViewportObservation() {
      // 条件分支: 当前没有活动观察器时进入。
      // 执行内容: 幂等结束，不访问已释放资源。
      if (!this.sourceViewportResizeObserver) {
        return;
      }

      // 资源清理: 停止所有 viewport/menu 尺寸通知，避免组件销毁后继续回调。
      this.sourceViewportResizeObserver.disconnect();
      // 副作用: 清空资源所有权引用，后续候选加载可建立新观察器。
      this.sourceViewportResizeObserver = null;
    },

    /**
     * 切换窄屏数据源菜单。
     * 触发来源: 手机触发按钮 click。
     * 副作用: 只反转 isMenuOpen，CSS 决定同一候选树是否在文档流显示。
     * 成功路径: 收起变展开或展开变收起。
     * 失败路径: 本方法不执行异步操作和预期异常。
     *
     * @returns {void} 局部折叠状态更新后结束。
     */
    toggleMenu() {
      // 副作用: 反转唯一展示状态，不读取视口宽度或复制候选数组。
      this.isMenuOpen = !this.isMenuOpen;
    },

    /**
     * 加载当前页面可执行数据源候选。
     * 副作用: 修改 loading、候选数组和查询错误；Runtime 只读唯一 Manager 与工厂门禁。
     * 成功路径: 按 Manager 顺序整体采用轻量候选并清空旧错误。
     * 失败路径: 清空无法确认的旧候选并保存安全错误说明。
     *
     * @returns {Promise<void>} 候选查询收敛后完成。
     */
    async loadAvailableSources() {
      // 副作用: 标记查询开始并清除上一轮加载错误。
      this.sourceListLoading = true;
      this.sourceListError = '';

      try {
        // 类型: Array<object>；作用: 保存 Runtime 唯一门禁返回的当前页面候选展示对象。
        const availableSources = await listPageSources(this.pageKey);
        // 副作用: 整体替换候选展示副本，不在组件二次判断资格。
        this.sourceTabs = availableSources;
      } catch (error) {
        // 副作用: 查询失败后清空不可确认的旧候选，避免保留失效按钮。
        this.sourceTabs = [];
        // 副作用: 保存 Runtime 用户说明或稳定页面兜底。
        this.sourceListError = error && error.message ? error.message : '当前页面数据源加载失败';
      } finally {
        // 副作用: 无论成功失败都结束查询状态，让错误或候选恢复可见。
        this.sourceListLoading = false;
        // 异步边界: 等待候选、标题和 viewport 依据本轮数组完成同一轮 DOM 更新。
        await this.$nextTick();
        // 资源边界: 以本轮真实 DOM 重建唯一尺寸观察器；空候选会释放旧观察器。
        this.setupSourceViewportObservation();
        // DOM 副作用: 首次加载后只在组件内部确保当前源按钮可见。
        this.revealActiveSource();
      }
    },

    /**
     * 判断候选是否为 Manager 当前 pending 目标。
     * 纯函数: 只读取候选 id、isSwitching 和 pendingSourceId。
     *
     * @param {object} source 当前 Runtime 候选展示对象。
     * @returns {boolean} true 表示当前候选正在准备。
     */
    isSourcePending(source) {
      return Boolean(source && this.isSwitching && source.id === this.switchState.pendingSourceId);
    },

    /**
     * 判断候选是否应阻止点击。
     * 纯函数: 不修改组件或 Manager；只阻止无效、加载中、重复 pending 和稳定活动源重复切换。
     * 并发边界: switching 期间其他候选保持可点，由 Runtime 最新请求规则处理覆盖。
     *
     * @param {object} source 当前 Runtime 候选展示对象。
     * @returns {boolean} true 禁用当前按钮，false 允许提交。
     */
    isSourceInteractionDisabled(source) {
      // 条件分支: 候选无真实 id 或候选查询尚未完成时进入。
      // 执行内容: 阻止无法定位的切换意图进入 Runtime。
      if (!source || !source.id || this.sourceListLoading) {
        return true;
      }

      // 条件分支: 当前候选已经是最新 pending 目标时进入。
      // 执行内容: 阻止同目标重复提交，但保留切换到其他目标的能力。
      if (this.isSourcePending(source)) {
        return true;
      }

      return !this.isSwitching && source.id === this.displaySourceId;
    },

    /**
     * 提交数据源选择并在真实采用后通知父页面重载。
     * 触发来源: 唯一候选按钮树的 click 事件。
     * 副作用: 调用 Runtime 原子切换；成功后收起窄屏菜单并发出 source-switched，失败只更新交互错误。
     * 成功路径: 返回状态同时满足目标 activeSourceId、success 和同一 pendingSourceId 才发出事件。
     * 失败路径: 当前最新失败展示安全说明；过期调用不发出旧目标事件。
     *
     * @param {object} source 用户选择的 Runtime 候选展示对象。
     * @returns {Promise<void>} 当前切换调用收敛并处理事件后完成。
     */
    async handleSourceSelect(source) {
      // 条件分支: 当前候选按统一交互规则不可点击时进入。
      // 执行内容: 直接结束，避免无效或重复意图进入 Runtime。
      if (this.isSourceInteractionDisabled(source)) {
        return;
      }

      // 副作用: 新切换开始前清空组件上一轮交互错误。
      this.interactionError = '';

      try {
        // 类型: object；作用: 保存 Runtime 对当前调用返回的最新完整 SourceManagerState。
        const sourceManagerState = await switchPageSource(source.id);
        // 类型: boolean；作用: 只有当前目标真实成为本次 success 活动源时允许重载页面。
        const adoptedCurrentTarget = sourceManagerState.activeSourceId === source.id
          && sourceManagerState.switchState.status === SOURCE_SWITCH_STATUS.success
          && sourceManagerState.switchState.pendingSourceId === source.id;

        // 条件分支: 当前调用已过期或目标没有被真实采用时进入。
        // 执行内容: 不发出旧目标事件，等待最新用户意图自行收敛。
        if (!adoptedCurrentTarget) {
          return;
        }

        // 副作用: 成功后收起窄屏菜单；宽屏布局不读取该状态。
        this.isMenuOpen = false;
        // 副作用: 通知当前父页面按新活动源重载自身数据。
        this.$emit('source-switched', { sourceId: source.id });
      } catch (error) {
        // 副作用: 优先展示 Manager 最新用户说明，再使用 Runtime message 或稳定兜底。
        this.interactionError = this.switchState.errorMessage
          || (error && error.message)
          || '数据源切换失败，已保留原页面数据';
      }
    },

    /**
     * 把健康状态转换为辅助技术说明。
     * 纯函数: 只比较稳定健康枚举，不改变候选健康状态或交互资格。
     *
     * @param {string} healthStatus SourceRecord.runtime.healthStatus。
     * @returns {string} 当前健康状态的中文说明。
     */
    getStatusLabel(healthStatus) {
      // 条件分支: 最近健康状态正常时进入。
      // 执行内容: 返回正常说明；候选资格仍由 Runtime 决定。
      if (healthStatus === HEALTH_STATUS.normal) {
        return '数据源状态正常';
      }

      // 条件分支: 健康检测正在执行时进入。
      // 执行内容: 返回检测中说明，不禁用 Runtime 已确认候选。
      if (healthStatus === HEALTH_STATUS.checking) {
        return '数据源检测中';
      }

      // 条件分支: 最近健康状态不可用时进入。
      // 执行内容: 返回不可用说明，真实切换仍由 Runtime/Host 最终门禁。
      if (healthStatus === HEALTH_STATUS.unavailable) {
        return '数据源最近检测不可用';
      }

      return '数据源状态未知';
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 数据源导航根区域 `.source-switch-tabs`。
  样式作用:
  纵向组织触发器、唯一候选菜单和错误说明。
  组件占满父页面内容宽度，窄屏展开菜单会自然推开后续内容。
*/
.source-switch-tabs {
  /* 使用 Grid 纵向组织响应式结构。 */
  display: grid;
  /* 为触发器、菜单和错误提供稳定间距。 */
  gap: 8px;
  /* 占满父级内容宽度。 */
  width: 100%;
  /* 把内部尺寸纳入组件宽度。 */
  box-sizing: border-box;
}

/*
  作用容器: 桌面数据源导航标题 `.source-switch-tabs__heading`。
  样式作用:
  在滚动轨道之前横向组合行标题和实时可用数量。
  手机由断点隐藏，避免与折叠触发器重复表达。
*/
.source-switch-tabs__heading {
  /* 使用 Flex 让标题和数量共享同一基线。 */
  display: flex;
  /* 垂直居中不同字号内容。 */
  align-items: center;
  /* 保留标题与数量之间的紧凑间距。 */
  gap: 6px;
  /* 清除 header 的潜在外部布局影响。 */
  min-width: 0;
}

/*
  作用容器: 桌面行标题 `.source-switch-tabs__title`。
  样式作用:
  使用内容区小标题层级标记后续控件含义，不与页面主标题竞争。
*/
.source-switch-tabs__title {
  /* 清除 h2 默认外边距，由根 Grid gap 统一控制节奏。 */
  margin: 0;
  /* 使用紧凑面板标题字号。 */
  font-size: 15px;
  /* 使用较高字重保证导航分组可扫描。 */
  font-weight: 700;
  /* 使用页面主文字色。 */
  color: #1f2937;
  /* 使用稳定行高避免标题改变轨道位置。 */
  line-height: 1.4;
}

/*
  作用容器: 桌面可用数量 `.source-switch-tabs__count`。
  样式作用:
  显示 Runtime 当前完整候选数量，帮助用户判断横向轨道是否还有内容。
*/
.source-switch-tabs__count {
  /* 使用辅助字号弱化数量相对标题的层级。 */
  font-size: 13px;
  /* 使用辅助文字色表达统计信息。 */
  color: #64748b;
  /* 禁止括号和数字断行。 */
  white-space: nowrap;
}

/*
  作用容器: 窄屏当前源触发器 `.source-switch-tabs__trigger`。
  样式作用:
  默认隐藏，768px 以下媒体查询显示；桌面不产生重复操作入口。
*/
.source-switch-tabs__trigger {
  /* 宽屏隐藏窄屏触发器。 */
  display: none;
}

/*
  作用容器: 桌面数据源滚动轨道 `.source-switch-tabs__rail`。
  样式作用:
  使用“前进按钮 / 可收缩 viewport / 后退按钮”三列承载任意数量候选。
  轨道宽度始终受父页面约束，不产生页面级横向溢出。
*/
.source-switch-tabs__rail {
  /* 使用 Grid 固定两侧图标按钮并让中间 viewport 吸收剩余宽度。 */
  display: grid;
  /* 两侧按内容宽度，中间允许收缩到零以启用内部滚动。 */
  grid-template-columns: auto minmax(0, 1fr) auto;
  /* 垂直居中按钮和候选菜单。 */
  align-items: center;
  /* 使用紧凑列间距分开箭头与候选。 */
  gap: 8px;
  /* 允许轨道在父级内正确收缩。 */
  min-width: 0;
  /* 把内部尺寸纳入可用宽度。 */
  width: 100%;
  /* 防止按钮和内边距扩大父页面宽度。 */
  box-sizing: border-box;
}

/*
  作用容器: 桌面候选 viewport `.source-switch-tabs__viewport`。
  样式作用:
  只在组件内部提供横向滚动，隐藏原生滚动条但保留触控板、滚轮和键盘浏览能力。
*/
.source-switch-tabs__viewport {
  /* 允许 Grid 中间列收缩并形成真实滚动窗口。 */
  min-width: 0;
  /* 超出宽度的唯一候选菜单只在当前容器横向滚动。 */
  overflow-x: auto;
  /* 禁止内部横向内容制造纵向滚动条。 */
  overflow-y: hidden;
  /* 程序翻页遵循平滑滚动，减少动效媒体查询会关闭。 */
  scroll-behavior: smooth;
  /* Firefox 隐藏滚动条视觉但保留滚动能力。 */
  scrollbar-width: none;
  /* 限制触摸横向滚动不把手势传递为页面横向位移。 */
  overscroll-behavior-inline: contain;
}

/*
  作用容器: WebKit 浏览器的数据源 viewport 滚动条。
  样式作用:
  隐藏原生滚动条轨道，交互仍由左右按钮、触控板和滚轮保留。
*/
.source-switch-tabs__viewport::-webkit-scrollbar {
  /* 将滚动条尺寸收敛为零，不改变候选轨道高度。 */
  width: 0;
  /* 将横向滚动条高度收敛为零。 */
  height: 0;
}

/*
  作用容器: 桌面前后滚动按钮 `.source-switch-tabs__scroll-button`。
  样式作用:
  使用稳定正方形图标按钮控制一个 viewport 宽度的候选浏览，不承载文本标签。
*/
.source-switch-tabs__scroll-button {
  /* 使用 Flex 居中 Element UI 箭头图标。 */
  display: inline-flex;
  /* 水平居中图标。 */
  justify-content: center;
  /* 垂直居中图标。 */
  align-items: center;
  /* 固定按钮宽度，禁用态不会引起轨道位移。 */
  width: 34px;
  /* 固定按钮高度，与候选最小高度一致。 */
  height: 34px;
  /* 移除文字按钮默认内边距。 */
  padding: 0;
  /* 使用页面表面色。 */
  background: #ffffff;
  /* 使用中性边界区分控件。 */
  border: 1px solid #d8dee8;
  /* 使用项目克制圆角。 */
  border-radius: 6px;
  /* 使用主文字色显示箭头。 */
  color: #334155;
  /* 使用清晰图标字号。 */
  font-size: 14px;
  /* 鼠标设备显示可点击反馈。 */
  cursor: pointer;
  /* 只过渡颜色，不改变稳定尺寸。 */
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

/*
  作用容器: 可用滚动按钮悬停状态。
  样式作用:
  使用主题边界和浅背景提示当前方向可以继续浏览。
*/
.source-switch-tabs__scroll-button:hover:not(:disabled) {
  /* 使用主题色提高控件边界。 */
  border-color: var(--accent);
  /* 使用主题深色显示箭头。 */
  color: var(--accent-strong);
  /* 使用浅蓝表面提供悬停反馈。 */
  background: #f4f7ff;
}

/*
  作用容器: 到达滚动边界的禁用按钮。
  样式作用:
  保留稳定占位并降低对比，明确当前方向没有更多候选。
*/
.source-switch-tabs__scroll-button:disabled {
  /* 使用浅背景表达不可用。 */
  background: #f8fafc;
  /* 使用浅边界降低视觉权重。 */
  border-color: #e5eaf1;
  /* 使用低对比图标色。 */
  color: #b8c1ce;
  /* 使用默认光标避免误导。 */
  cursor: default;
}

/*
  作用容器: 桌面滚动按钮键盘焦点。
  样式作用:
  为键盘用户提供不依赖颜色的明确焦点轮廓。
*/
.source-switch-tabs__scroll-button:focus-visible {
  /* 使用主题色绘制可见焦点。 */
  outline: 2px solid var(--accent);
  /* 让焦点轮廓与按钮边界分离。 */
  outline-offset: 2px;
}

/*
  作用容器: 唯一候选菜单 `.source-switch-tabs__menu`。
  样式作用:
  768px 及以上单行排列所有 Runtime 候选，不换行、不隐藏条目，也不显示版本或类别后缀。
*/
.source-switch-tabs__menu {
  /* 使用 Flex 横向排列唯一候选按钮树。 */
  display: flex;
  /* 保持候选垂直居中。 */
  align-items: center;
  /* 桌面保持严格单行，超出部分交给外层 viewport。 */
  flex-wrap: nowrap;
  /* 使用紧凑按钮间距。 */
  gap: 8px;
  /* 内容不足时铺满 viewport，超出时按候选自然总宽度扩展。 */
  width: max-content;
  /* 保证少量候选时菜单至少覆盖整个 viewport。 */
  min-width: 100%;
  /* 把内部尺寸纳入菜单宽度计算。 */
  box-sizing: border-box;
}

/*
  作用容器: 单个候选按钮 `.source-switch-tabs__item`。
  样式作用:
  横向组合短名称和健康点，提供普通、当前与 pending 三种稳定状态。
*/
.source-switch-tabs__item {
  /* 横向排列短名称和状态点。 */
  display: inline-flex;
  /* 每个候选保持自然宽度，不被 viewport 压缩或拉伸。 */
  flex: 0 0 auto;
  /* 垂直居中按钮内容。 */
  align-items: center;
  /* 在文字和状态点之间保留紧凑间距。 */
  gap: 7px;
  /* 使用稳定最小高度保证点击面积。 */
  min-height: 34px;
  /* 提供紧凑横向内边距。 */
  padding: 6px 12px;
  /* 普通按钮使用页面表面色。 */
  background: #ffffff;
  /* 使用中性边界区分相邻候选。 */
  border: 1px solid #d8dee8;
  /* 使用项目克制圆角。 */
  border-radius: 6px;
  /* 普通状态使用深色文字。 */
  color: #334155;
  /* 使用紧凑导航字号。 */
  font-size: 13px;
  /* 使用中等字重保证短名称清晰。 */
  font-weight: 600;
  /* 继承项目字体。 */
  font-family: inherit;
  /* 鼠标设备显示可点击反馈。 */
  cursor: pointer;
  /* 只过渡颜色和阴影，不改变布局尺寸。 */
  transition: color 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

/*
  作用容器: 普通候选悬停状态。
  样式作用:
  提高边界和文字对比，提示当前可切换目标。
*/
.source-switch-tabs__item:hover:not(:disabled) {
  /* 使用主题色提高边界识别。 */
  border-color: var(--accent);
  /* 使用主题深色显示可操作文字。 */
  color: var(--accent-strong);
}

/*
  作用容器: 当前活动候选 `.source-switch-tabs__item--active`。
  样式作用:
  使用实色背景、边框和白色文字持续高亮当前页面数据来源。
*/
.source-switch-tabs__item--active {
  /* 使用主题强调深色作为当前态背景。 */
  background: var(--accent-strong);
  /* 边框跟随当前态背景形成完整轮廓。 */
  border-color: var(--accent-strong);
  /* 使用白色文字保证实色背景对比。 */
  color: #ffffff;
  /* 添加轻量阴影强化当前态，不改变按钮尺寸。 */
  box-shadow: 0 2px 8px rgba(47, 94, 208, 0.22);
}

/*
  作用容器: 当前活动候选悬停状态。
  样式作用:
  保持持续高亮，不被普通 hover 规则降级。
*/
.source-switch-tabs__item--active:hover:not(:disabled) {
  /* 保持当前态实色背景。 */
  background: var(--accent-strong);
  /* 保持当前态实色边框。 */
  border-color: var(--accent-strong);
  /* 保持当前态白色文字。 */
  color: #ffffff;
}

/*
  作用容器: 正在准备的候选 `.source-switch-tabs__item--pending`。
  样式作用:
  使用虚线和浅蓝表面表达处理中目标，与当前活动源保持区分。
*/
.source-switch-tabs__item--pending {
  /* 使用浅蓝背景表达处理中状态。 */
  background: #eef4ff;
  /* 使用主题色虚线边界表达尚未采用。 */
  border-color: var(--accent);
  /* 虚线区别于稳定当前态。 */
  border-style: dashed;
  /* 使用主题深色文字。 */
  color: var(--accent-strong);
}

/*
  作用容器: 禁用候选按钮。
  样式作用:
  保留当前或 pending 视觉，只关闭重复点击并用光标说明不可提交。
*/
.source-switch-tabs__item:disabled {
  /* 保留状态颜色但略降透明度表达当前不可重复提交。 */
  opacity: 0.84;
  /* 使用默认光标避免误导为可点击。 */
  cursor: default;
}

/*
  作用容器: 候选按钮键盘焦点。
  样式作用:
  为键盘用户提供不依赖当前状态颜色的轮廓。
*/
.source-switch-tabs__item:focus-visible {
  /* 使用主题色绘制可见焦点。 */
  outline: 2px solid var(--accent);
  /* 让焦点轮廓与按钮边界分离。 */
  outline-offset: 2px;
}

/*
  作用容器: 候选短名称 `.source-switch-tabs__name`。
  样式作用:
  保持名称单行并防止状态点被挤压。
*/
.source-switch-tabs__name {
  /* 保持短名称单行展示。 */
  white-space: nowrap;
}

/*
  作用容器: 健康状态点 `.source-switch-tabs__status-dot`。
  样式作用:
  使用固定圆点辅助表达健康状态，不改变按钮尺寸。
*/
.source-switch-tabs__status-dot {
  /* 固定状态点宽度。 */
  width: 7px;
  /* 固定状态点高度。 */
  height: 7px;
  /* 禁止状态点在 Flex 中收缩。 */
  flex: 0 0 auto;
  /* 使用圆形表达状态指示。 */
  border-radius: 50%;
  /* 未知状态使用中性灰。 */
  background: #94a3b8;
}

/*
  作用容器: 正常健康状态点。
  样式作用: 使用绿色表达最近检测正常。
*/
.source-switch-tabs__status-dot--normal {
  /* 正常状态使用绿色。 */
  background: #22a06b;
}

/*
  作用容器: 检测中健康状态点。
  样式作用: 使用琥珀色表达暂未收敛。
*/
.source-switch-tabs__status-dot--checking {
  /* 检测中状态使用琥珀色。 */
  background: #d99a21;
}

/*
  作用容器: 不可用健康状态点。
  样式作用: 使用红色表达最近检测失败。
*/
.source-switch-tabs__status-dot--unavailable {
  /* 不可用状态使用红色。 */
  background: #d14343;
}

/*
  作用容器: 数据源导航错误 `.source-switch-tabs__error`。
  样式作用:
  在导航下方展示失败说明，不覆盖候选或后续页面内容。
*/
.source-switch-tabs__error {
  /* 清除段落默认外边距，只保留与 Grid 的统一间距。 */
  margin: 0;
  /* 使用错误语义颜色。 */
  color: #b42318;
  /* 使用辅助说明字号。 */
  font-size: 13px;
  /* 使用适合多行错误的行高。 */
  line-height: 1.5;
}

/*
  断点: 小于 768px，对应 Bootstrap md 以下折叠语义。
  影响范围: 当前源触发器和唯一候选菜单。
  布局变化: 使用 767.98px 上限覆盖小数 CSS 像素；显示触发器，候选菜单默认收起，打开时在文档流内纵向展示全部条目。
*/
@media (max-width: 767.98px) {
  /*
    作用容器: 手机桌面标题行。
    样式作用: 隐藏桌面专用标题和数量，避免与当前源折叠入口重复占用首屏。
  */
  .source-switch-tabs__heading {
    /* 手机只保留折叠触发器作为数据源导航入口。 */
    display: none;
  }

  /*
    作用容器: 手机数据源轨道。
    样式作用: 取消桌面三列结构，让唯一菜单在触发器下方参与普通文档流。
  */
  .source-switch-tabs__rail {
    /* 使用块布局承载折叠菜单，左右按钮由独立规则隐藏。 */
    display: block;
    /* 保持菜单与父页面同宽。 */
    width: 100%;
  }

  /*
    作用容器: 手机桌面滚动按钮。
    样式作用: 隐藏只服务桌面横向 viewport 的前后控制。
  */
  .source-switch-tabs__scroll-button {
    /* 手机通过折叠列表浏览完整候选，不保留无效横向箭头。 */
    display: none;
  }

  /*
    作用容器: 手机候选 viewport。
    样式作用: 解除桌面横向裁切，使展开后的唯一菜单在文档流内完整增高。
  */
  .source-switch-tabs__viewport {
    /* 手机不建立横向滚动窗口。 */
    overflow: visible;
    /* 手机折叠布局不需要程序平滑横向滚动。 */
    scroll-behavior: auto;
  }

  /*
    作用容器: 手机当前源触发器。
    样式作用: 横向展示菜单图标、当前短名称、健康点和展开箭头。
  */
  .source-switch-tabs__trigger {
    /* 手机显示唯一折叠触发器。 */
    display: flex;
    /* 垂直居中内部内容。 */
    align-items: center;
    /* 元素之间使用紧凑间距。 */
    gap: 9px;
    /* 占满父页面内容宽度。 */
    width: 100%;
    /* 使用稳定触摸高度。 */
    min-height: 42px;
    /* 提供左右内容留白。 */
    padding: 8px 12px;
    /* 使用白色表面与页面背景区分。 */
    background: #ffffff;
    /* 使用中性边界表达折叠入口。 */
    border: 1px solid #d8dee8;
    /* 使用项目克制圆角。 */
    border-radius: 6px;
    /* 使用深色文字。 */
    color: #334155;
    /* 继承项目字体。 */
    font-family: inherit;
    /* 使用紧凑导航字号。 */
    font-size: 14px;
    /* 使用中等字重突出当前源。 */
    font-weight: 600;
    /* 鼠标设备显示可点击反馈。 */
    cursor: pointer;
    /* 把内边距与边框纳入全宽。 */
    box-sizing: border-box;
  }

  /*
    作用容器: 手机触发器键盘焦点。
    样式作用: 为键盘展开菜单提供清晰轮廓。
  */
  .source-switch-tabs__trigger:focus-visible {
    /* 使用主题色绘制焦点。 */
    outline: 2px solid var(--accent);
    /* 让轮廓与按钮边界分离。 */
    outline-offset: 2px;
  }

  /*
    作用容器: 手机触发器菜单图标。
    样式作用: 固定图标尺寸并防止收缩。
  */
  .source-switch-tabs__trigger-icon {
    /* 使用清晰菜单图标字号。 */
    font-size: 17px;
    /* 禁止图标随名称收缩。 */
    flex: 0 0 auto;
  }

  /*
    作用容器: 手机当前源短名称。
    样式作用: 占据触发器剩余空间，异常长文本用省略号保护控件。
  */
  .source-switch-tabs__trigger-name {
    /* 吃掉图标和状态之外的剩余空间。 */
    flex: 1 1 auto;
    /* 允许文本区域正确收缩。 */
    min-width: 0;
    /* 保持按钮单行高度。 */
    white-space: nowrap;
    /* 裁掉异常长名称的溢出。 */
    overflow: hidden;
    /* 用省略号表达被裁切文本。 */
    text-overflow: ellipsis;
    /* 与展开条目保持相同阅读起点。 */
    text-align: left;
  }

  /*
    作用容器: 手机触发器展开箭头。
    样式作用: 表达向下折叠关系，并在展开时旋转提示当前状态。
  */
  .source-switch-tabs__trigger-arrow {
    /* 使用辅助图标字号。 */
    font-size: 12px;
    /* 禁止箭头随名称收缩。 */
    flex: 0 0 auto;
    /* 只旋转图标，不触发布局重排。 */
    transition: transform 0.18s ease;
  }

  /*
    作用容器: 已展开触发器箭头。
    样式作用: 旋转为向上语义，提示再次点击会收起。
  */
  .source-switch-tabs__trigger-arrow--open {
    /* 旋转半周表达收起方向。 */
    transform: rotate(180deg);
  }

  /*
    作用容器: 手机唯一候选菜单。
    样式作用: 默认隐藏同一按钮树，不保留第二份候选或弹层。
  */
  .source-switch-tabs__menu {
    /* 收起时不参与布局。 */
    display: none;
    /* 手机菜单跟随父级宽度，不保留桌面内容总宽度。 */
    width: 100%;
    /* 允许菜单在窄屏正确收缩。 */
    min-width: 0;
  }

  /*
    作用容器: 手机已展开候选菜单。
    样式作用: 在文档流内纵向展示完整候选，后续轮播和内容自然下移。
  */
  .source-switch-tabs__menu--open {
    /* 使用 Grid 纵向排列同一候选按钮树。 */
    display: grid;
    /* 每个候选占据稳定整行。 */
    grid-template-columns: minmax(0, 1fr);
    /* 使用紧凑纵向间距。 */
    gap: 6px;
  }

  /*
    作用容器: 手机候选按钮。
    样式作用: 占满菜单宽度并按左侧阅读起点排列短名称。
  */
  .source-switch-tabs__item {
    /* 占满手机菜单宽度。 */
    width: 100%;
    /* 让短名称从左侧开始，状态点停在右侧。 */
    justify-content: space-between;
    /* 使用手机整行内边距。 */
    padding: 8px 12px;
    /* 把边框和内边距纳入全宽。 */
    box-sizing: border-box;
  }
}

/*
  断点: 用户启用减少动效偏好。
  影响范围: 手机数据源展开箭头。
  布局变化: 保留状态旋转结果，但取消过渡动画。
*/
@media (prefers-reduced-motion: reduce) {
  /*
    作用容器: 桌面候选 viewport。
    样式作用: 取消程序翻页的平滑过渡，滚动终点和边界状态保持不变。
  */
  .source-switch-tabs__viewport {
    /* 尊重系统减少动效偏好，立即到达目标滚动位置。 */
    scroll-behavior: auto;
  }

  .source-switch-tabs__trigger-arrow {
    /* 取消旋转过渡，减少非必要动效。 */
    transition: none;
  }
}
</style>
