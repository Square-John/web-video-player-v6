<template>
  <!--
    SourceSwitchTabs 组件渲染树

    [IF hasVisibleSources || displayError] ele(section.source-switch-tabs)
    │  - condition: 当前页面存在至少一个 Runtime 可用源，或候选/切换失败需要向用户说明时渲染。
    │  - type: 原生标签，标签名称: section
    │  - description: 页面顶部真实数据源切换区域，承载候选按钮和错误提示。
    │  - params: -- ariaLabel：当前页面数据源区域名称；-- isSwitching：Manager 是否正在切换。
    │  - events: 无
    │
    ├─ [IF hasVisibleSources] ele(div.source-switch-tabs__scroller)
    │  │  - condition: Runtime 为当前 pageKey 返回至少一个可执行候选时渲染。
    │  │  - type: 原生标签，标签名称: div
    │  │  - description: 横向排列可用源按钮，窄屏或候选增加时允许横向滚动。
    │  │  - params: -- visibleSources：Runtime 候选轻量展示对象数组。
    │  │  - events: 无
    │  └─ [DEFAULT] ele(button.source-switch-tabs__item)
    │     - condition: visibleSources 循环到当前数据源时渲染。
    │     - type: 原生标签，标签名称: button
    │     - description: 展示名称、版本和健康状态，并提交该 sourceId 的原子切换意图。
    │     - params: -- source：当前候选；-- activeSourceId：Manager 当前活动源；-- switchState：当前切换状态。
    │     - events: @click -> handleSourceSelect(source)
    │
    └─ [IF displayError] ele(p.source-switch-tabs__error)
       - condition: 候选加载或最新切换存在用户可读错误时渲染。
       - type: 原生标签，标签名称: p
       - description: 使用 aria-live 向用户说明当前失败，旧页面数据保持不变。
       - params: -- displayError：候选或切换失败文案。
       - events: 无
  -->
  <!--
    [IF hasVisibleSources || displayError] ele(section.source-switch-tabs)
    - condition: 存在可执行候选或需要展示错误时渲染。
    - type: 原生标签，标签名称: section
    - description: 顶部数据源切换根容器，不保存 Manager 之外的活动源或 pending 状态。
    - params: -- ariaLabel；-- isSwitching。
    - events: 无
  -->
  <section
    v-if="hasVisibleSources || displayError"
    class="source-switch-tabs"
    :aria-label="ariaLabel"
    :aria-busy="isSwitching ? 'true' : 'false'"
  >
    <!--
      [IF hasVisibleSources] ele(div.source-switch-tabs__scroller)
      - condition: 当前页面存在 Runtime 可执行候选时渲染。
      - type: 原生标签，标签名称: div
      - description: 横向排列候选按钮并允许窄屏滚动。
      - params: -- visibleSources。
      - events: 无
    -->
    <div v-if="hasVisibleSources" class="source-switch-tabs__scroller" role="tablist">
      <!--
        [DEFAULT] ele(button.source-switch-tabs__item)
        - condition: visibleSources 循环到当前候选时渲染。
        - type: 原生标签，标签名称: button
        - description: 读取 Manager 选中与切换状态，点击后只提交 Runtime 原子切换意图。
        - params: -- source.id/name/version/healthStatus；-- activeSourceId；-- switchState。
        - events: @click -> handleSourceSelect(source)。
      -->
      <button
        v-for="source in visibleSources"
        :key="source.id"
        type="button"
        class="source-switch-tabs__item"
        :class="{
          'source-switch-tabs__item--active': source.id === activeSourceId,
          'source-switch-tabs__item--pending': isSourcePending(source)
        }"
        role="tab"
        :aria-selected="source.id === activeSourceId ? 'true' : 'false'"
        :aria-busy="isSourcePending(source) ? 'true' : 'false'"
        :disabled="isSourceInteractionDisabled(source)"
        @click="handleSourceSelect(source)"
      >
        <span class="source-switch-tabs__text">
          <span class="source-switch-tabs__name">{{ source.name }}</span>
          <span v-if="source.version" class="source-switch-tabs__version">· {{ source.version }}</span>
        </span>
        <span
          class="source-switch-tabs__status-dot"
          :class="`source-switch-tabs__status-dot--${source.healthStatus || 'unknown'}`"
          :aria-label="getStatusLabel(source.healthStatus)"
        ></span>
      </button>
    </div>

    <!--
      [IF displayError] ele(p.source-switch-tabs__error)
      - condition: 候选加载或最新切换失败时渲染。
      - type: 原生标签，标签名称: p
      - description: 告知用户失败原因；失败不会清空原活动源和原页面数据。
      - params: -- displayError。
      - events: 无
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
      展示当前页面由 Runtime 派生的可执行数据源，并提交统一原子切换意图。
      选中态和 pending 状态只读取 Manager 响应式投影；目标真实采用成功后向父页面发出一次重载事件。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      HEALTH_STATUS、SOURCE_SWITCH_STATUS: 自定义配置，提供健康状态和切换状态稳定枚举。
      getPageSourceManagerState/listPageSources/switchPageSource: 自定义服务，提供唯一投影、候选和切换入口。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SourceSwitchTabs: Vue component，供首页、电影、电视剧和搜索页复用的真实数据源切换组件。
*/

import {
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 三态健康枚举。
  // 文件作用: 把候选健康字段转换成稳定辅助说明，不使用自由状态字符串。
  HEALTH_STATUS,

  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_SWITCH_STATUS 原子切换状态枚举。
  // 文件作用: 判断 switching、success 和 failed，不解析用户文案决定分支。
  SOURCE_SWITCH_STATUS
} from '../../config/source-manager.config.js';

import {
  // 导入来源: ../../services/sourcePageService.js。
  // 导入内容: getPageSourceManagerState 当前响应式 Manager 投影读取函数。
  // 文件作用: computed 直接观察唯一 activeSourceId 和 switchState，不维护组件影子状态。
  getPageSourceManagerState,

  // 导入来源: ../../services/sourcePageService.js。
  // 导入内容: listPageSources 当前页面候选查询函数。
  // 文件作用: created 时加载经过 Runtime 唯一门禁的轻量候选。
  listPageSources,

  // 导入来源: ../../services/sourcePageService.js。
  // 导入内容: switchPageSource 原子切换适配函数。
  // 文件作用: 用户点击候选后委托 Runtime，不直接修改 Manager 或页面 store。
  switchPageSource
} from '../../services/sourcePageService.js';

export default {
  // 组件名称用于 Vue Devtools 和父页面 components 注册识别真实数据源切换入口。
  name: 'SourceSwitchTabs',

  props: {
    // 类型: string。
    // 来源: 父页面按自身领域固定传入 home、movie、tv 或 search。
    // 作用: 交给 Runtime 选择当前页面 capability 对应的唯一候选集合。
    pageKey: {
      type: String,
      required: true
    },

    // 类型: string。
    // 来源: 父页面按当前页面语义传入。
    // 作用: 给切换区域提供可访问性名称，便于辅助技术识别。
    ariaLabel: {
      type: String,
      default: '数据源切换'
    }
  },

  /**
   * 创建组件局部展示状态。
   * 纯函数: 每个实例返回独立候选数组和错误文本，不读取或修改 Manager、Runtime 或父页面。
   * 维护边界: sourceTabs 只是 Runtime 候选的当前组件展示副本，不保存候选资格或活动源事实。
   *
   * @returns {object} 数据源候选加载和错误展示状态。
   */
  data() {
    return {
      // 类型: Array<object>；初始为空；由 loadAvailableSources 整体替换；顺序保持 Manager 候选顺序。
      sourceTabs: [],
      // 类型: boolean；true 表示候选查询进行中，false 表示查询已收敛；由 loadAvailableSources 修改。
      sourceListLoading: false,
      // 类型: string；候选查询失败时保存用户可读说明，成功查询后清空。
      sourceListError: '',
      // 类型: string；当前组件最近一次切换调用失败说明，新切换开始或成功后清空。
      interactionError: ''
    };
  },

  computed: {
    /**
     * 当前响应式 SourceManagerState。
     * 纯函数: 只返回 settingsStore 已采用的唯一完整投影，不复制或修改内部字段。
     *
     * @returns {object} 当前 Manager 页面投影。
     */
    sourceManagerState() {
      return getPageSourceManagerState();
    },

    /**
     * 当前内容活动源身份。
     * 纯函数: 只读取 Manager activeSourceId；默认源不伪装成已经切换成功的活动源。
     *
     * @returns {string} 当前活动 sourceId；尚未建立时为空字符串。
     */
    activeSourceId() {
      return this.sourceManagerState.activeSourceId || '';
    },

    /**
     * 当前活动源切换事务投影。
     * 纯函数: 只读取 Manager switchState，不在组件另存 pending、requestId 或回滚状态。
     *
     * @returns {object} 当前切换状态对象。
     */
    switchState() {
      return this.sourceManagerState.switchState;
    },

    /**
     * Manager 是否正在准备新的活动源。
     * 纯函数: 只比较稳定切换枚举，不修改按钮或 Manager 状态。
     *
     * @returns {boolean} true 表示 switching，false 表示 idle、success 或 failed。
     */
    isSwitching() {
      return this.switchState.status === SOURCE_SWITCH_STATUS.switching;
    },

    /**
     * 当前可渲染候选源。
     * 纯函数: 只过滤映射异常产生的空 id；不复制 enabled、授权、工厂或 capability 门禁。
     *
     * @returns {Array<object>} 具有真实 id 的 Runtime 候选展示对象。
     */
    visibleSources() {
      return this.sourceTabs.filter(source => source && source.id);
    },

    /**
     * 当前是否存在候选按钮。
     * 纯函数: 只读取 visibleSources 长度，不修改组件状态。
     *
     * @returns {boolean} true 渲染 tablist，false 隐藏空列表。
     */
    hasVisibleSources() {
      return this.visibleSources.length > 0;
    },

    /**
     * 当前应展示的错误说明。
     * 纯函数: 按本次交互错误、Manager 最新失败、候选加载失败顺序返回，不修改任一来源。
     *
     * @returns {string} 用户可读错误；没有错误时为空字符串。
     */
    displayError() {
      return this.interactionError
        || this.switchState.errorMessage
        || this.sourceListError
        || '';
    }
  },

  /**
   * Vue created 生命周期。
   * 执行时机: props、data、computed 和 methods 已可用，DOM 尚未挂载。
   * 副作用: 查询当前 pageKey 的 Runtime 候选并更新组件展示数组；不启动 Provider或切换活动源。
   *
   * @returns {void} 生命周期只触发异步候选加载。
   */
  created() {
    this.loadAvailableSources();
  },

  methods: {
    /**
     * 加载当前页面可执行数据源候选。
     * 副作用: 修改 sourceListLoading/sourceListError/sourceTabs；Runtime 只读取 Manager 和可信工厂门禁。
     * 成功路径: 按 Manager 顺序整体采用轻量候选数组并清空旧错误。
     * 失败路径: 保留空候选并保存用户可读错误，错误提示区域继续可见。
     *
     * @returns {Promise<void>} 候选查询收敛后结束。
     */
    async loadAvailableSources() {
      // 副作用: 进入候选加载状态并清空上一轮查询错误。
      this.sourceListLoading = true;
      this.sourceListError = '';

      try {
        // 类型: Array<object>。
        // 作用: 保存 Runtime 唯一门禁返回的当前页面候选展示对象。
        const availableSources = await listPageSources(this.pageKey);

        // 副作用: 整体替换候选展示副本，不在组件内二次判断 enabled 或 capability。
        this.sourceTabs = availableSources;
      } catch (error) {
        // 副作用: 候选查询失败时清空不可确认的旧列表，避免展示已经失效的可点击入口。
        this.sourceTabs = [];
        // 副作用: 保存稳定用户说明；Runtime 错误没有 message 时使用页面级兜底。
        this.sourceListError = error?.message || '当前页面数据源加载失败';
      } finally {
        // 副作用: 无论成功失败都结束加载状态，恢复错误提示或候选交互。
        this.sourceListLoading = false;
      }
    },

    /**
     * 判断候选是否是 Manager 当前正在准备的目标。
     * 纯函数: 只读取 source.id、isSwitching 和 switchState.pendingSourceId。
     *
     * @param {object} source 当前 Runtime 候选展示对象。
     * @returns {boolean} true 表示当前候选处于 switching 目标状态。
     */
    isSourcePending(source) {
      return Boolean(
        source
        && this.isSwitching
        && source.id === this.switchState.pendingSourceId
      );
    },

    /**
     * 判断候选按钮是否应阻止本次点击。
     * 纯函数: 不修改组件或 Manager；只阻止候选加载中、重复 pending 和稳定活动源重复切换。
     * 并发边界: switching 期间其他候选保持可点击，允许 Runtime 最新请求规则处理快速切换。
     *
     * @param {object} source 当前 Runtime 候选展示对象。
     * @returns {boolean} true 禁用当前按钮，false 允许提交切换意图。
     */
    isSourceInteractionDisabled(source) {
      // 条件分支: 候选对象无效或候选查询仍在进行时进入。
      // 执行内容: 禁止提交无法定位的 sourceId。
      if (!source || !source.id || this.sourceListLoading) {
        return true;
      }

      // 条件分支: 当前候选已经是最新 pending 目标时进入。
      // 执行内容: 禁止同一按钮重复提交，但不阻止用户选择其他候选覆盖目标。
      if (this.isSourcePending(source)) {
        return true;
      }

      // 返回值类型: boolean。
      // 作用: 稳定状态下当前活动源无需重复切换；切换期间允许用户切回旧活动源覆盖 pending 目标。
      return !this.isSwitching && source.id === this.activeSourceId;
    },

    /**
     * 提交用户选择的数据源并在真实采用成功后通知父页面重载。
     * 触发来源: 数据源按钮 click 事件。
     * 副作用: 调用 Runtime 原子切换；成功时发出 source-switched，失败时只更新 interactionError。
     * 成功路径: 返回状态必须同时满足目标 activeSourceId、success 和同一 pendingSourceId 才发出一次事件。
     * 失败路径: 当前最新失败展示用户说明；过期调用返回更新状态但不报错、不发出旧目标事件。
     *
     * @param {object} source 用户点击的 Runtime 候选展示对象。
     * @returns {Promise<void>} 当前切换调用收敛并处理事件后结束。
     */
    async handleSourceSelect(source) {
      // 条件分支: 当前候选按统一交互规则不可点击时进入。
      // 执行内容: 直接结束，避免无效或重复意图进入 Runtime。
      if (this.isSourceInteractionDisabled(source)) {
        return;
      }

      // 副作用: 新切换开始前清空组件上一轮交互错误；Manager 最新失败仍由 switchState 独立表达。
      this.interactionError = '';

      try {
        // 类型: object。
        // 作用: 保存 Runtime 对当前调用返回的最新 SourceManagerState，可能属于更新用户意图。
        const sourceManagerState = await switchPageSource(source.id);

        // 类型: boolean。
        // 作用: 只有当前目标真实成为 success 活动源时，当前调用才有权通知父页面重载。
        const adoptedCurrentTarget = sourceManagerState.activeSourceId === source.id
          && sourceManagerState.switchState.status === SOURCE_SWITCH_STATUS.success
          && sourceManagerState.switchState.pendingSourceId === source.id;

        // 条件分支: 当前调用已被更新目标取代或没有采用 success 时进入。
        // 执行内容: 不发出旧目标事件，页面继续等待最新调用收敛。
        if (!adoptedCurrentTarget) {
          return;
        }

        // 副作用: 清空旧交互错误并通知当前父页面按新活动源重载自身数据。
        this.interactionError = '';
        this.$emit('source-switched', { sourceId: source.id });
      } catch (error) {
        // 副作用: 优先展示 Manager 已发布的用户错误；缺失时使用 Runtime message 或稳定兜底。
        this.interactionError = this.switchState.errorMessage
          || error?.message
          || '数据源切换失败，已保留原页面数据';
      }
    },

    /**
     * 把健康状态转换成辅助技术可理解的说明。
     * 纯函数: 只比较稳定健康枚举，不改变候选健康状态或页面交互。
     *
     * @param {string} healthStatus SourceRecord.runtime.healthStatus。
     * @returns {string} 当前健康状态的中文说明。
     */
    getStatusLabel(healthStatus) {
      // 条件分支: 数据源最近状态正常时进入。
      // 执行内容: 返回可用说明；健康状态不决定 Runtime 候选资格。
      if (healthStatus === HEALTH_STATUS.normal) {
        return '数据源状态正常';
      }

      // 条件分支: 数据源健康检测进行中时进入。
      // 执行内容: 返回检测中说明，按钮仍可按 Runtime 候选结果使用。
      if (healthStatus === HEALTH_STATUS.checking) {
        return '数据源检测中';
      }

      // 条件分支: 最近健康状态不可用时进入。
      // 执行内容: 返回不可用说明；切换是否成功仍由 Runtime/Host 实时结果决定。
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
  作用容器: 数据源切换根容器 `.source-switch-tabs`。
  样式作用:
  在页面标题或首页轮播之前建立真实切换区域。
  候选按钮和错误提示共享同一纵向节奏，不改变父页面内容布局。
*/
.source-switch-tabs {
  /* 与下方轮播、筛选或搜索面板保持稳定区块间距。 */
  margin: 0 0 24px;
}

/*
  作用容器: 候选横向滚动容器 `.source-switch-tabs__scroller`。
  样式作用:
  横向排列 Runtime 候选，源数量或视口宽度不足时允许单轴滚动。
  隐藏视觉滚动条但保留触摸和键盘可访问的原生滚动能力。
*/
.source-switch-tabs__scroller {
  /* 使用横向 flex 保持每个候选按 Manager 顺序排列。 */
  display: flex;
  /* 垂直居中按钮内文字和状态点。 */
  align-items: center;
  /* 保持候选按钮之间清晰但紧凑的横向距离。 */
  gap: 9px;
  /* 候选超出内容宽度时只在当前区域横向滚动。 */
  overflow-x: auto;
  /* 底部留出焦点轮廓空间，避免滚动容器裁切。 */
  padding: 0 0 3px;
  /* 保留移动端惯性滚动体验。 */
  -webkit-overflow-scrolling: touch;
  /* 隐藏 Firefox 视觉滚动条，不取消滚动能力。 */
  scrollbar-width: none;
}

/*
  作用容器: WebKit 数据源滚动条伪元素。
  样式作用:
  隐藏候选区域视觉滚动条，滚动能力仍由父容器 overflow-x 提供。
*/
.source-switch-tabs__scroller::-webkit-scrollbar {
  /* 不绘制 WebKit 滚动条，避免占据按钮下方空间。 */
  display: none;
}

/*
  作用容器: 单个候选按钮 `.source-switch-tabs__item`。
  样式作用:
  展示数据源名称、版本和健康状态。
  原生 button 保留键盘激活能力，外观与既有胶囊入口保持一致。
*/
.source-switch-tabs__item {
  /* 清除系统按钮主题，以组件自己的边框、背景和字体为准。 */
  appearance: none;
  /* 横向排列文本和状态点。 */
  display: inline-flex;
  /* 垂直居中文本和状态点。 */
  align-items: center;
  /* 保持文本与状态点之间的可读距离。 */
  gap: 8px;
  /* 禁止 flex 压缩按钮，长列表通过父容器滚动访问。 */
  flex: 0 0 auto;
  /* 提供稳定桌面点击高度。 */
  min-height: 36px;
  /* 给名称、版本和状态点留出胶囊内部空间。 */
  padding: 0 15px;
  /* 使用浅色背景与页面内容区分。 */
  background: rgba(255, 255, 255, 0.78);
  /* 使用弱边框明确按钮边界。 */
  border: 1px solid rgba(214, 222, 234, 0.86);
  /* 使用胶囊圆角表达同级切换选项。 */
  border-radius: 999px;
  /* 使用轻阴影与浅色页面背景分层。 */
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  /* 普通候选使用次级文字色，突出活动源。 */
  color: var(--text-secondary);
  /* 继承项目字体，避免原生按钮使用平台默认字体。 */
  font: inherit;
  /* 使用紧凑辅助字号。 */
  font-size: 13px;
  /* 可用候选显示指针，提示能够提交切换意图。 */
  cursor: pointer;
  /* 禁止拖选按钮文字，保持控件交互感。 */
  user-select: none;
  /* 背景、边框和阴影平滑响应选中与 pending 状态。 */
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

/*
  作用容器: 键盘聚焦的候选按钮 `.source-switch-tabs__item:focus-visible`。
  样式作用:
  为键盘用户提供不依赖颜色填充的清晰焦点轮廓。
*/
.source-switch-tabs__item:focus-visible {
  /* 使用主题色轮廓标记当前键盘焦点。 */
  outline: 2px solid var(--accent);
  /* 让轮廓与按钮边框分离，避免被浅色背景吞没。 */
  outline-offset: 2px;
}

/*
  作用容器: Manager 当前活动源按钮 `.source-switch-tabs__item--active`。
  样式作用:
  使用主题浅色表达已经成功采用的活动源，不把 pending 目标提前显示成成功。
*/
.source-switch-tabs__item--active {
  /* 使用浅主题背景突出已采用活动源。 */
  background: rgba(91, 140, 255, 0.12);
  /* 使用主题边框强化活动源边界。 */
  border-color: rgba(91, 140, 255, 0.34);
  /* 使用强调文字色提升活动源识别度。 */
  color: var(--accent-strong);
  /* 使用主题阴影与普通候选形成轻量层级差。 */
  box-shadow: 0 12px 28px rgba(79, 127, 255, 0.14);
}

/*
  作用容器: Manager 当前准备目标 `.source-switch-tabs__item--pending`。
  样式作用:
  用边框和内阴影表达正在切换，保留旧活动源的成功视觉直到事务完成。
*/
.source-switch-tabs__item--pending {
  /* 使用较强主题边框标识当前准备目标。 */
  border-color: rgba(91, 140, 255, 0.58);
  /* 使用内外组合阴影表达处理中，而不改变按钮尺寸。 */
  box-shadow: inset 0 0 0 1px rgba(91, 140, 255, 0.16), 0 10px 24px rgba(79, 127, 255, 0.12);
}

/*
  作用容器: 禁用候选按钮 `.source-switch-tabs__item:disabled`。
  样式作用:
  稳定活动源或重复 pending 目标不可重复提交，同时保留其状态颜色和可读性。
*/
.source-switch-tabs__item:disabled {
  /* 禁用时使用默认指针，避免继续暗示可点击。 */
  cursor: default;
  /* 轻微降低非交互控件强度，但不隐藏活动源和 pending 状态。 */
  opacity: 0.88;
}

/*
  作用容器: 候选文字容器 `.source-switch-tabs__text`。
  样式作用:
  横向排列名称与版本，并限制长文本占用宽度。
*/
.source-switch-tabs__text {
  /* 名称和版本保持同一行。 */
  display: inline-flex;
  /* 垂直居中两段文字。 */
  align-items: center;
  /* 限制单个候选文本宽度，避免一个长名称占满滚动区域。 */
  max-width: min(210px, 58vw);
  /* 隐藏超出最大宽度的内容，为版本省略提供边界。 */
  overflow: hidden;
}

/*
  作用容器: 数据源名称 `.source-switch-tabs__name`。
  样式作用:
  作为候选主文本保持较高字重和单行可读性。
*/
.source-switch-tabs__name {
  /* 使用中等加粗突出用户可读数据源名称。 */
  font-weight: 600;
  /* 名称保持单行，按钮高度不受文本长度影响。 */
  white-space: nowrap;
}

/*
  作用容器: 数据源版本 `.source-switch-tabs__version`。
  样式作用:
  作为 SourceDefinition 的次级识别信息，超长时在按钮范围内省略。
*/
.source-switch-tabs__version {
  /* 与名称留出细微距离，避免分隔点贴住主文本。 */
  margin-left: 2px;
  /* 版本保持单行，维持胶囊高度。 */
  white-space: nowrap;
  /* 超出候选最大宽度时显示省略号。 */
  text-overflow: ellipsis;
  /* 隐藏版本溢出部分，为省略号生效提供条件。 */
  overflow: hidden;
  /* 降低版本视觉权重，保持名称为主信息。 */
  opacity: 0.78;
}

/*
  作用容器: 数据源健康状态点 `.source-switch-tabs__status-dot`。
  样式作用:
  使用 SourceRecord.runtime.healthStatus 提供辅助反馈；状态不参与候选门禁或切换决定。
*/
.source-switch-tabs__status-dot {
  /* 固定圆点宽度，避免状态文本变化影响按钮布局。 */
  width: 8px;
  /* 固定圆点高度，与宽度形成正圆。 */
  height: 8px;
  /* 禁止圆点在窄屏被 flex 压缩。 */
  flex: 0 0 auto;
  /* 使用圆形表达健康状态。 */
  border-radius: 50%;
  /* 未知状态使用弱边框色，避免误导为可用或不可用。 */
  background: var(--border-strong);
}

/*
  作用容器: normal 健康状态点。
  样式作用:
  使用成功色表示最近健康状态正常。
*/
.source-switch-tabs__status-dot--normal {
  /* 正常状态使用项目成功色。 */
  background: var(--success);
  /* 使用柔和外光提升小圆点可见性。 */
  box-shadow: 0 0 0 3px rgba(56, 180, 139, 0.12);
}

/*
  作用容器: checking 健康状态点。
  样式作用:
  使用主题色表示健康检测进行中，不加入持续动画或轮询。
*/
.source-switch-tabs__status-dot--checking {
  /* 检测中使用主题蓝，与成功和不可用状态区分。 */
  background: var(--accent);
}

/*
  作用容器: unavailable 健康状态点。
  样式作用:
  使用危险色表达最近检测不可用；按钮能否切换仍由 Runtime 实时门禁决定。
*/
.source-switch-tabs__status-dot--unavailable {
  /* 不可用状态使用项目危险色。 */
  background: var(--danger);
}

/*
  作用容器: 数据源切换错误 `.source-switch-tabs__error`。
  样式作用:
  在候选下方展示用户可读失败说明，并明确旧页面内容仍被保留。
*/
.source-switch-tabs__error {
  /* 与候选按钮保持小间距，形成同一区域反馈。 */
  margin: 8px 0 0;
  /* 使用辅助字号，避免错误提示压过页面主标题。 */
  font-size: 12px;
  /* 使用项目危险色提高失败识别度。 */
  color: var(--danger);
}

/*
  响应式断点: 视口宽度不超过 640px。
  作用范围: 手机端数据源切换区域。
  样式作用:
  收紧纵向和横向占用，同时保留原生按钮可访问高度与横向滚动。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机端切换根容器。
    样式作用: 缩小与下方主内容间距，降低首屏占用。
  */
  .source-switch-tabs {
    /* 手机端使用更紧凑的区块底部间距。 */
    margin-bottom: 18px;
  }

  /*
    作用容器: 手机端候选滚动容器。
    样式作用: 缩小候选之间距离，让首屏露出更多入口。
  */
  .source-switch-tabs__scroller {
    /* 手机端使用更紧凑的横向间距。 */
    gap: 8px;
  }

  /*
    作用容器: 手机端候选按钮。
    样式作用: 收紧左右内边距并保持稳定触控高度。
  */
  .source-switch-tabs__item {
    /* 缩小左右内边距，为名称和版本保留宽度。 */
    padding: 0 12px;
    /* 保持不低于现有手机胶囊入口的点击高度。 */
    min-height: 34px;
  }
}
</style>
