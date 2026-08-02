<template>
  <!--
    SourceNavbarSelector 全局数据源导航组件渲染树

    [DEFAULT] ele(div.source-navbar-selector)
    │  - condition: AppNavbar 挂载后始终渲染。
    │  - type: 原生 div。
    │  - description: 在固定导航首行组合数据源下拉触发器、当前源状态和唯一候选菜单。
    │  - params: -- menuOpen；-- currentSource；-- visibleSources。
    │  - events: 无。
    │
    ├─ [DEFAULT] ele(button.source-navbar-selector__trigger)
    │  - condition: 所有视口始终渲染。
    │  - type: 原生 button。
    │  - description: 切换数据源候选菜单，并提供 Bootstrap dropdown 风格的箭头和辅助属性。
    │  - params: -- menuOpen；-- sourceListLoading。
    │  - events: @click -> requestMenuToggle()；@keydown -> handleTriggerKeydown(event)。
    │
    ├─ [DEFAULT] ele(div.source-navbar-selector__current)
    │  - condition: 所有视口始终渲染。
    │  - type: 原生 div，role=status。
    │  - description: 独立显示 Manager 当前活动源短名称和实时健康状态点。
    │  - params: -- currentSourceName；-- currentSourceHealthStatus。
    │  - events: 无。
    │
    └─ [IF menuOpen] ele(div.source-navbar-selector__menu)
       │  - condition: 父导航控制 menuOpen 为 true 时渲染。
       │  - type: 原生 div，role=listbox。
       │  - description: 唯一候选下拉菜单；加载、失败、空状态和候选列表互斥展示。
       │  - params: -- sourceListLoading；-- displayError；-- visibleSources。
       │  - events: 无。
       ├─ [IF sourceListLoading && !hasVisibleSources] ele(div.source-navbar-selector__message--loading)
       ├─ [ELSE-IF displayError && !hasVisibleSources] ele(div.source-navbar-selector__message--error)
       ├─ [ELSE-IF !hasVisibleSources] ele(div.source-navbar-selector__message--empty)
       └─ [ELSE] ele(button.source-navbar-selector__option)
          - condition: 每个 visibleSources 候选渲染一次。
          - type: 原生 button，role=option。
          - description: 展示名称、实时健康点、当前选中和 pending 状态，并提交原子切换。
          - params: -- source.id/name/healthStatus；-- displaySourceId；-- switchState。
          - events: @click -> handleSourceSelect(source)；@keydown -> handleOptionKeydown(event, index)。
  -->
  <div ref="selectorRoot" class="source-navbar-selector">
    <!--
      [DEFAULT] ele(button.source-navbar-selector__trigger)
      - condition: 所有视口始终渲染。
      - type: 原生 button。
      - description: 打开或关闭唯一候选菜单，主导航是否折叠不影响本入口可见性。
      - params: -- menuOpen；-- sourceListLoading。
      - events: @click -> requestMenuToggle()；@keydown -> handleTriggerKeydown(event)。
    -->
    <button
      ref="menuTrigger"
      type="button"
      class="source-navbar-selector__trigger"
      aria-haspopup="listbox"
      aria-controls="source-navbar-selector-menu"
      :aria-expanded="String(menuOpen)"
      :aria-busy="sourceListLoading ? 'true' : 'false'"
      @click="requestMenuToggle"
      @keydown="handleTriggerKeydown"
    >
      <span class="source-navbar-selector__trigger-label source-navbar-selector__trigger-label--full">
        数据源列表
      </span>
      <span class="source-navbar-selector__trigger-label source-navbar-selector__trigger-label--compact">
        数据源
      </span>
      <i
        class="el-icon-arrow-down source-navbar-selector__arrow"
        :class="{ 'source-navbar-selector__arrow--open': menuOpen }"
        aria-hidden="true"
      ></i>
    </button>

    <!--
      [DEFAULT] ele(div.source-navbar-selector__current)
      - condition: 所有视口始终渲染；当前身份缺失时显示“未选择”。
      - type: 原生 div，role=status。
      - description: 在下拉按钮旁持续展示当前源，不要求用户打开菜单确认选择。
      - params: -- currentSourceName；-- currentSourceHealthStatus。
      - events: 无。
    -->
    <div
      class="source-navbar-selector__current"
      role="status"
      :aria-label="currentSourceStatusLabel"
      :title="currentSourceStatusLabel"
    >
      <span
        class="source-navbar-selector__status-dot"
        :class="`source-navbar-selector__status-dot--${currentSourceHealthStatus}`"
        aria-hidden="true"
      ></span>
      <span class="source-navbar-selector__current-label">当前源</span>
      <strong class="source-navbar-selector__current-name">{{ currentSourceName }}</strong>
    </div>

    <!--
      [IF menuOpen] ele(div.source-navbar-selector__menu)
      - condition: 父导航把 menuOpen 设为 true 时渲染。
      - type: 原生 div，role=listbox。
      - description: 固定导航下方的浮动候选菜单，内部滚动承载任意数量数据源。
      - params: -- sourceListLoading；-- displayError；-- visibleSources。
      - events: 无。
    -->
    <div
      v-if="menuOpen"
      id="source-navbar-selector-menu"
      class="source-navbar-selector__menu"
      role="listbox"
      aria-label="可切换数据源"
    >
      <!--
        [IF sourceListLoading && !hasVisibleSources] ele(div.source-navbar-selector__message--loading)
        - condition: 首轮候选尚未返回且没有可展示旧候选时渲染。
        - type: 原生 div。
        - description: 显示候选准备状态，不伪造数据源。
        - params: 无。
        - events: 无。
      -->
      <div
        v-if="sourceListLoading && !hasVisibleSources"
        class="source-navbar-selector__message"
      >
        正在读取数据源
      </div>

      <!--
        [ELSE-IF displayError && !hasVisibleSources] ele(div.source-navbar-selector__message--error)
        - condition: 候选查询或切换失败且没有可展示候选时渲染。
        - type: 原生 div，role=alert。
        - description: 显示安全错误说明。
        - params: -- displayError。
        - events: 无。
      -->
      <div
        v-else-if="displayError && !hasVisibleSources"
        class="source-navbar-selector__message source-navbar-selector__message--error"
        role="alert"
      >
        {{ displayError }}
      </div>

      <!--
        [ELSE-IF !hasVisibleSources] ele(div.source-navbar-selector__message--empty)
        - condition: 查询完成、没有错误且 Runtime 没有全局可切换候选时渲染。
        - type: 原生 div。
        - description: 明确说明当前没有候选。
        - params: 无。
        - events: 无。
      -->
      <div v-else-if="!hasVisibleSources" class="source-navbar-selector__message">
        暂无可切换数据源
      </div>

      <!--
        [ELSE] ele(button.source-navbar-selector__option)
        - condition: visibleSources 每个候选渲染一次。
        - type: 原生 button，role=option。
        - description: 使用同一行展示选中图标、短名称和健康点，点击提交 Runtime 原子切换。
        - params: -- source；-- index；-- displaySourceId；-- switchState。
        - events: @click -> handleSourceSelect(source)；@keydown -> handleOptionKeydown(event, index)。
      -->
      <button
        v-for="(source, index) in visibleSources"
        v-else
        :key="source.id"
        ref="sourceOptions"
        type="button"
        class="source-navbar-selector__option"
        :class="{
          'source-navbar-selector__option--active': source.id === displaySourceId,
          'source-navbar-selector__option--pending': isSourcePending(source),
          'source-navbar-selector__option--disabled': isSourceInteractionDisabled(source)
        }"
        role="option"
        :aria-selected="source.id === displaySourceId ? 'true' : 'false'"
        :aria-busy="isSourcePending(source) ? 'true' : 'false'"
        :aria-disabled="isSourceInteractionDisabled(source) ? 'true' : 'false'"
        @click="handleSourceSelect(source)"
        @keydown="handleOptionKeydown($event, index)"
      >
        <i
          class="source-navbar-selector__check"
          :class="source.id === displaySourceId ? 'el-icon-check' : 'el-icon-minus'"
          aria-hidden="true"
        ></i>
        <span class="source-navbar-selector__option-name">{{ source.name }}</span>
        <span
          class="source-navbar-selector__status-dot"
          :class="`source-navbar-selector__status-dot--${source.healthStatus || 'unknown'}`"
          :aria-label="getStatusLabel(source.healthStatus)"
          :title="getStatusLabel(source.healthStatus)"
        ></span>
      </button>

      <!--
        [IF displayError && hasVisibleSources] ele(div.source-navbar-selector__inline-error)
        - condition: 仍有候选可用但最近查询或切换失败时渲染。
        - type: 原生 div，role=alert。
        - description: 在列表末尾显示错误而不清空旧候选。
        - params: -- displayError。
        - events: 无。
      -->
      <div
        v-if="displayError && hasVisibleSources"
        class="source-navbar-selector__inline-error"
        role="alert"
      >
        {{ displayError }}
      </div>
    </div>
  </div>
</template>

<script>
/*
  SourceNavbarSelector.vue 模块说明

  - 文件职责:
      在 AppNavbar 固定首行展示全局数据源下拉和 Manager 当前活动源实时状态。
      委托 sourcePageService 查询全局候选、投影名称健康状态并提交原子切换，不拥有候选门禁或页面刷新。

  - 导入库及文件汇总(2 条，内置 0 条，第三方 0 条，自定义 2 条):
      HEALTH_STATUS/SOURCE_SWITCH_STATUS: 自定义稳定枚举，用于状态说明和切换事务判断。
      sourcePageService: 自定义导航适配服务，提供 Manager 投影、活动源、候选、实时展示和切换入口。

  - 模块级常量:
      无

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SourceNavbarSelector: Vue component，供 AppNavbar 渲染全局数据源入口。
*/

import {
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: HEALTH_STATUS 三态健康枚举。
  // 文件作用: 把 Manager 健康状态转换为稳定状态点类和辅助说明。
  HEALTH_STATUS,
  // 导入来源: ../../config/source-manager.config.js。
  // 导入内容: SOURCE_SWITCH_STATUS 原子切换状态枚举。
  // 文件作用: 判断 pending、成功采用和重复交互门禁。
  SOURCE_SWITCH_STATUS
} from '../../config/source-manager.config.js';

import {
  // 导入来源: ../../services/sourcePageService.js。
  // 导入内容: getActivePageSourceId 当前有效活动源读取函数。
  // 文件作用: 当前源展示遵循 activeSourceId 优先、defaultSourceId 兜底语义。
  getActivePageSourceId,
  // 导入来源: ../../services/sourcePageService.js。
  // 导入内容: getPageSourceManagerState 响应式 Manager 完整投影读取函数。
  // 文件作用: 实时观察 records、健康状态、活动源和切换事务。
  getPageSourceManagerState,
  // 导入来源: ../../services/sourcePageService.js。
  // 导入内容: listNavigationSources 全局可切换候选查询函数。
  // 文件作用: 复用 Runtime 唯一执行门禁，不在组件过滤设置记录。
  listNavigationSources,
  // 导入来源: ../../services/sourcePageService.js。
  // 导入内容: projectNavigationSources 导航实时展示投影函数。
  // 文件作用: 按候选身份连接 Manager 最新名称和健康状态。
  projectNavigationSources,
  // 导入来源: ../../services/sourcePageService.js。
  // 导入内容: switchNavigationSource 全局原子切换函数。
  // 文件作用: 用户选择候选后委托 Runtime，不直接写 Manager 或页面 store。
  switchNavigationSource
} from '../../services/sourcePageService.js';

export default {
  // 组件名称: SourceNavbarSelector；用途: Vue Devtools 和 AppNavbar 注册识别。
  name: 'SourceNavbarSelector',

  props: {
    // 类型: boolean；来源: AppNavbar；true 展开候选菜单，false 关闭；父级统一协调主导航面板互斥。
    menuOpen: {
      type: Boolean,
      default: false
    }
  },

  /**
   * 创建全局数据源导航局部交互状态。
   * 纯函数: 每个实例返回独立候选身份、加载错误和请求代次，不读取 DOM 或修改 Manager。
   *
   * @returns {object} 当前导航选择器局部状态。
   */
  data() {
    return {
      // 类型: Array<object>；来源: listNavigationSources；作用: 只保存 Runtime 候选身份，不保存名称或健康快照。
      sourceCandidates: [],
      // 类型: boolean；true 表示全局候选查询中，false 表示最近查询已收敛。
      sourceListLoading: false,
      // 类型: string；作用: 保存最近候选查询安全错误，成功查询后清空。
      sourceListError: '',
      // 类型: string；作用: 保存最近导航切换安全错误，新切换或成功后清空。
      interactionError: '',
      // 类型: number；初始值: 0；作用: 只允许最后一次候选查询采用成功、失败和 loading 结果。
      sourceListRequestSequence: 0
    };
  },

  computed: {
    /**
     * 读取 settingsStore 当前响应式 SourceManagerState。
     * 纯函数: 返回页面服务提供的唯一完整投影，不复制或修改字段。
     *
     * @returns {object} Manager 当前完整页面投影。
     */
    sourceManagerState() {
      return getPageSourceManagerState();
    },

    /**
     * 读取全局当前活动源身份。
     * 纯函数: 复用页面服务统一 active/default 顺序，不读取候选首项。
     *
     * @returns {string} 当前活动源或默认源身份；均缺失时为空字符串。
     */
    displaySourceId() {
      return getActivePageSourceId();
    },

    /**
     * 投影导航下拉当前展示候选。
     * 纯函数: 按 Runtime 候选身份连接 Manager 最新 records，不复制执行门禁。
     *
     * @returns {Array<object>} 按 Runtime 顺序排列的 id、name 和 healthStatus 展示对象。
     */
    visibleSources() {
      return projectNavigationSources(this.sourceCandidates, this.sourceManagerState);
    },

    /**
     * 判断是否存在可渲染候选。
     * 纯函数: 只读取 visibleSources 长度。
     *
     * @returns {boolean} true 表示显示候选项，false 表示显示加载、错误或空状态。
     */
    hasVisibleSources() {
      return this.visibleSources.length > 0;
    },

    /**
     * 从 Manager 当前记录投影活动源展示对象。
     * 纯函数: 不要求当前源仍在上一轮候选数组中，候选重载期间也能保持名称和实时健康状态。
     *
     * @returns {object|null} 当前源展示对象；身份或记录缺失时返回 null。
     */
    currentSource() {
      // 条件分支: 当前没有活动或默认身份时进入。
      // 执行内容: 返回 null，让模板显示明确未选择状态。
      if (!this.displaySourceId) {
        return null;
      }

      // 类型: Array<object>。
      // 作用: 使用单身份候选连接 Manager 当前记录，不复用可能过期的全局候选成员。
      const projectedCurrentSource = projectNavigationSources(
        [{ id: this.displaySourceId }],
        this.sourceManagerState
      );
      return projectedCurrentSource[0] || null;
    },

    /**
     * 派生当前源短名称。
     * 纯函数: 有当前记录时显示正式名称，否则显示不猜测身份的“未选择”。
     *
     * @returns {string} 当前源名称或未选择说明。
     */
    currentSourceName() {
      return this.currentSource ? this.currentSource.name : '未选择';
    },

    /**
     * 派生当前源健康状态视觉键。
     * 纯函数: 只读取当前 Manager 记录；缺失时返回 unknown。
     *
     * @returns {string} normal、checking、unavailable 或 unknown。
     */
    currentSourceHealthStatus() {
      return this.currentSource?.healthStatus || 'unknown';
    },

    /**
     * 读取 Manager 当前活动源切换事务。
     * 纯函数: 不另存 pending、requestId、成功或失败状态。
     *
     * @returns {object} 当前 switchState 完整投影。
     */
    switchState() {
      return this.sourceManagerState.switchState;
    },

    /**
     * 判断 Manager 是否正在准备新活动源。
     * 纯函数: 只比较冻结状态枚举。
     *
     * @returns {boolean} true 表示 switching，false 表示其他状态。
     */
    isSwitching() {
      return this.switchState.status === SOURCE_SWITCH_STATUS.switching;
    },

    /**
     * 派生当前源完整辅助说明。
     * 纯函数: 组合名称和健康说明，不改变菜单或 Manager。
     *
     * @returns {string} 供 role=status、title 和辅助技术读取的当前源说明。
     */
    currentSourceStatusLabel() {
      return `当前数据源 ${this.currentSourceName}，${this.getStatusLabel(this.currentSourceHealthStatus)}`;
    },

    /**
     * 派生当前应展示的错误说明。
     * 纯函数: 切换错误优先于候选查询错误，无错误时返回空字符串。
     *
     * @returns {string} 用户可读错误说明或空字符串。
     */
    displayError() {
      return this.interactionError || this.switchState.errorMessage || this.sourceListError || '';
    }
  },

  watch: {
    /**
     * 观察 Manager 记录数组整体替换。
     * 来源: 初始化、启停、授权、删除、恢复、导入、检测和切换事务发布的完整投影。
     * 副作用: 每次重新委托 Runtime 生成全局候选；最新请求代次拒绝旧结果。
     * 成功路径: 候选成员与当前 Manager 执行资格收敛。
     * 失败路径: 保留安全错误并清空无法确认的候选。
     *
     * @returns {void} 只触发异步候选重载。
     */
    'sourceManagerState.records'() {
      this.loadNavigationSources();
    },

    /**
     * 观察父导航控制的下拉开关。
     * 来源: AppNavbar 主导航和数据源菜单互斥状态。
     * 副作用: 打开后等待 DOM 并聚焦当前选项或首项；关闭时不改变候选和当前源。
     *
     * @param {boolean} menuOpen true 表示菜单刚打开，false 表示刚关闭。
     * @returns {void} 只安排下一轮焦点定位。
     */
    menuOpen(menuOpen) {
      // 条件分支: 菜单关闭时进入。
      // 执行内容: 不访问已经卸载的候选按钮。
      if (!menuOpen) {
        return;
      }

      // 异步边界: 等待 v-if 菜单和候选按钮完成挂载后再移动键盘焦点。
      this.$nextTick(() => {
        this.focusCurrentOrFirstOption();
      });
    }
  },

  /**
   * Vue created 生命周期。
   * 执行时机: data、computed 和 methods 已可用，真实 DOM 尚未挂载。
   * 副作用: 查询首轮全局候选身份，不启动 Provider 或切换活动源。
   * 成功路径: 下拉获得 Runtime 当前全局候选。
   * 失败路径: loadNavigationSources 保存安全错误并保持空候选。
   *
   * @returns {void} 生命周期只触发异步候选查询。
   */
  created() {
    this.loadNavigationSources();
  },

  /**
   * Vue mounted 生命周期。
   * 执行时机: 根 DOM 已挂载。
   * 副作用: 注册 document pointerdown 和 keydown，用于点击外部及 Escape 关闭菜单。
   * 成功路径: 全局监听只属于本组件实例。
   * 失败路径: 浏览器缺少 document 时不适用；正式客户端环境固定提供。
   *
   * @returns {void} 监听注册完成后结束。
   */
  mounted() {
    document.addEventListener('pointerdown', this.handleDocumentPointerDown);
    document.addEventListener('keydown', this.handleDocumentKeydown);
  },

  /**
   * Vue beforeDestroy 生命周期。
   * 执行时机: 根 DOM 尚可访问但组件即将销毁。
   * 副作用: 使在途候选查询过期并移除两个 document 监听器。
   * 成功路径: 旧异步结果不会写回销毁实例，监听器完整释放。
   * 失败路径: removeEventListener 幂等，不产生业务异常。
   *
   * @returns {void} 资源释放后结束。
   */
  beforeDestroy() {
    this.sourceListRequestSequence += 1;
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown);
    document.removeEventListener('keydown', this.handleDocumentKeydown);
  },

  methods: {
    /**
     * 请求父导航切换数据源菜单。
     * 副作用: 只发出 toggle-menu，AppNavbar 负责与主导航面板互斥。
     *
     * @returns {void} 事件发出后结束。
     */
    requestMenuToggle() {
      this.$emit('toggle-menu');
    },

    /**
     * 请求父导航关闭数据源菜单。
     * 副作用: 只发出 close-menu，不修改候选或 Manager。
     *
     * @returns {void} 事件发出后结束。
     */
    requestMenuClose() {
      this.$emit('close-menu');
    },

    /**
     * 处理 document 指针按下。
     * 触发来源: 浏览器任意区域 pointerdown。
     * 副作用: 菜单打开且目标位于组件外时请求父导航关闭。
     *
     * @param {PointerEvent} event 浏览器指针事件。
     * @returns {void} 条件处理后结束。
     */
    handleDocumentPointerDown(event) {
      // 类型: HTMLElement|null。
      // 作用: 读取当前组件根节点，限定点击外部判断边界。
      const selectorRoot = this.$refs.selectorRoot || null;

      // 条件分支: 菜单关闭、根节点缺失或点击发生在组件内部时进入。
      // 执行内容: 保持当前菜单状态。
      if (!this.menuOpen || !selectorRoot || selectorRoot.contains(event.target)) {
        return;
      }

      this.requestMenuClose();
    },

    /**
     * 处理 document 键盘事件。
     * 触发来源: 浏览器任意区域 keydown。
     * 副作用: 菜单打开且按下 Escape 时关闭并把焦点还给触发按钮。
     *
     * @param {KeyboardEvent} event 浏览器键盘事件。
     * @returns {void} 条件处理后结束。
     */
    handleDocumentKeydown(event) {
      // 条件分支: 菜单未打开或按键不是 Escape 时进入。
      // 执行内容: 不拦截页面其他键盘命令。
      if (!this.menuOpen || event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      this.requestMenuClose();
      this.$nextTick(() => {
        this.$refs.menuTrigger?.focus();
      });
    },

    /**
     * 处理下拉触发按钮键盘操作。
     * 触发来源: 触发按钮 keydown。
     * 副作用: ArrowDown/ArrowUp 打开菜单并在渲染后聚焦当前或边界候选。
     *
     * @param {KeyboardEvent} event 触发按钮键盘事件。
     * @returns {void} 不属于菜单导航的按键保持原生行为。
     */
    handleTriggerKeydown(event) {
      // 条件分支: 按键不是上下方向键时进入。
      // 执行内容: 保留 Enter 和 Space 的原生 button click。
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }

      event.preventDefault();

      // 条件分支: 菜单尚未打开时进入。
      // 执行内容: 请求父级打开，watch 负责聚焦当前或首项。
      if (!this.menuOpen) {
        this.requestMenuToggle();
        return;
      }

      // 异步边界: 菜单已打开时按方向选择首项或末项。
      this.$nextTick(() => {
        // 类型: number。
        // 作用: 把向上键映射到候选末项、向下键映射到候选首项，供统一焦点方法消费。
        const targetIndex = event.key === 'ArrowUp' ? this.visibleSources.length - 1 : 0;
        this.focusSourceOption(targetIndex);
      });
    },

    /**
     * 处理候选按钮键盘导航。
     * 触发来源: 任一候选 option keydown。
     * 副作用: Arrow/Home/End 在候选按钮间移动焦点，Escape 关闭菜单。
     *
     * @param {KeyboardEvent} event 候选按钮键盘事件。
     * @param {number} index 当前候选索引。
     * @returns {void} 处理完成后结束。
     */
    handleOptionKeydown(event, index) {
      // 类型: object。
      // 作用: 固定需要由菜单接管的键盘按键到目标索引计算，其他按键保留原生 button 行为。
      const navigationKeys = {
        ArrowDown: index + 1,
        ArrowUp: index - 1,
        Home: 0,
        End: this.visibleSources.length - 1
      };

      // 条件分支: 当前按键是 Escape 时进入。
      // 执行内容: 复用全局关闭与焦点归还逻辑。
      if (event.key === 'Escape') {
        this.handleDocumentKeydown(event);
        return;
      }

      // 条件分支: 当前按键不属于候选焦点导航时进入。
      // 执行内容: 保留 Enter 和 Space 的原生 click。
      if (!Object.hasOwn(navigationKeys, event.key)) {
        return;
      }

      event.preventDefault();
      // 类型: number。
      // 作用: 使用候选长度环绕上下方向，Home/End 已直接映射边界。
      const targetIndex = navigationKeys[event.key] < 0
        ? this.visibleSources.length - 1
        : navigationKeys[event.key] % this.visibleSources.length;
      this.focusSourceOption(targetIndex);
    },

    /**
     * 聚焦指定候选按钮。
     * 副作用: 只调用目标 DOM focus，不修改候选、菜单或 Manager。
     * 成功路径: 索引存在时焦点移动到对应 option。
     * 失败路径: ref 尚未建立或索引越界时安全结束。
     *
     * @param {number} index 目标候选索引。
     * @returns {void} 焦点处理后结束。
     */
    focusSourceOption(index) {
      // 类型: Array<HTMLElement>。
      // 作用: Vue v-for ref 在多候选时返回数组；无候选时使用空数组。
      const sourceOptions = Array.isArray(this.$refs.sourceOptions)
        ? this.$refs.sourceOptions
        : [];
      // 类型: HTMLElement | undefined。
      // 作用: 保存目标索引对应的候选按钮；索引越界时保持 undefined 并由后续失败分支安全结束。
      const targetOption = sourceOptions[index];

      // 条件分支: 目标 option 不存在或不支持 focus 时进入。
      // 执行内容: 安全结束，不猜测相邻 DOM。
      if (!targetOption || typeof targetOption.focus !== 'function') {
        return;
      }

      targetOption.focus();
    },

    /**
     * 聚焦当前活动候选或首个候选。
     * 副作用: 只移动候选按钮焦点。
     * 成功路径: 当前源仍在列表时聚焦当前项，否则聚焦首项。
     * 失败路径: 候选为空时 focusSourceOption 安全结束。
     *
     * @returns {void} 焦点处理后结束。
     */
    focusCurrentOrFirstOption() {
      // 类型: number。
      // 作用: 查找当前活动源在 Runtime 候选顺序中的位置。
      const activeIndex = this.visibleSources.findIndex(
        source => source.id === this.displaySourceId
      );
      this.focusSourceOption(activeIndex >= 0 ? activeIndex : 0);
    },

    /**
     * 加载全局可切换候选身份。
     * 副作用: 修改 loading、候选和查询错误；Runtime 只读唯一 Manager 与工厂门禁。
     * 成功路径: 只采用最新请求返回的候选身份数组并清空旧错误。
     * 失败路径: 只有最新请求可以清空候选并保存安全错误，旧结果全部忽略。
     *
     * @returns {Promise<void>} 最新候选查询收敛后完成。
     */
    async loadNavigationSources() {
      // 类型: number。
      // 作用: 为本轮查询分配组件内单调序号，使此前在途调用立即过期。
      const requestSequence = this.sourceListRequestSequence + 1;
      this.sourceListRequestSequence = requestSequence;
      this.sourceListLoading = true;
      this.sourceListError = '';

      try {
        // 类型: Array<object>。
        // 作用: 保存 Runtime 全局门禁返回的候选身份，不携带首次加载健康快照。
        const sourceCandidates = await listNavigationSources();

        // 条件分支: 等待期间已有更新查询开始时进入。
        // 执行内容: 旧成功不覆盖当前候选。
        if (requestSequence !== this.sourceListRequestSequence) {
          return;
        }

        this.sourceCandidates = sourceCandidates;
      } catch (error) {
        // 条件分支: 等待期间已有更新查询开始时进入。
        // 执行内容: 旧失败不清空当前候选或覆盖当前错误。
        if (requestSequence !== this.sourceListRequestSequence) {
          return;
        }

        this.sourceCandidates = [];
        this.sourceListError = error?.message || '数据源列表加载失败';
      } finally {
        // 条件分支: 本轮仍是最新查询时进入。
        // 执行内容: 只有最新调用可以结束 loading。
        if (requestSequence === this.sourceListRequestSequence) {
          this.sourceListLoading = false;
        }
      }
    },

    /**
     * 判断候选是否为 Manager 当前 pending 目标。
     * 纯函数: 只读取候选 id、isSwitching 和 switchState.pendingSourceId。
     *
     * @param {object} source 当前导航候选展示对象。
     * @returns {boolean} true 表示候选正在准备，false 表示其他状态。
     */
    isSourcePending(source) {
      return Boolean(source && this.isSwitching && source.id === this.switchState.pendingSourceId);
    },

    /**
     * 判断候选是否阻止重复交互。
     * 纯函数: 查询中、同一 pending 或稳定当前源禁用；切换期间其他候选保持可提交给 Runtime 最新请求规则。
     *
     * @param {object} source 当前导航候选展示对象。
     * @returns {boolean} true 禁用，false 允许选择。
     */
    isSourceInteractionDisabled(source) {
      // 条件分支: 候选缺失身份、列表仍在加载或该候选已经是当前切换目标时进入。
      // 执行内容: 禁止提交不完整、加载期或重复 pending 的切换请求。
      if (!source || !source.id || this.sourceListLoading || this.isSourcePending(source)) {
        return true;
      }

      return !this.isSwitching && source.id === this.displaySourceId;
    },

    /**
     * 提交候选并在真实采用后关闭菜单。
     * 副作用: 委托 Runtime 原子切换；不直接刷新页面，四个内容页通过 Manager 活动源响应器消费。
     * 成功路径: 目标成为同一 success 活动源后清空错误并请求父导航关闭菜单。
     * 失败路径: 当前最新失败显示安全说明；过期调用不关闭新菜单或伪造成功。
     *
     * @param {object} source 用户选择的导航候选展示对象。
     * @returns {Promise<void>} 当前切换调用收敛后完成。
     */
    async handleSourceSelect(source) {
      // 条件分支: 当前候选按统一规则不可交互时进入。
      // 执行内容: 不提交无效或重复切换。
      if (this.isSourceInteractionDisabled(source)) {
        return;
      }

      this.interactionError = '';

      try {
        // 类型: object。
        // 作用: 保存 Runtime 对当前调用返回的最新完整 Manager 状态。
        const sourceManagerState = await switchNavigationSource(source.id);
        // 类型: boolean。
        // 作用: 只有目标、success 和 pendingSourceId 同时匹配才表示本调用被真实采用。
        const adoptedCurrentTarget = sourceManagerState.activeSourceId === source.id
          && sourceManagerState.switchState.status === SOURCE_SWITCH_STATUS.success
          && sourceManagerState.switchState.pendingSourceId === source.id;

        // 条件分支: 当前调用已经过期或目标未被真实采用时进入。
        // 执行内容: 保持菜单和最新请求状态，不发旧完成事件。
        if (!adoptedCurrentTarget) {
          return;
        }

        this.requestMenuClose();
      } catch (error) {
        this.interactionError = this.switchState.errorMessage
          || error?.message
          || '数据源切换失败，已保留原活动源';
      }
    },

    /**
     * 把健康状态转换为辅助技术说明。
     * 纯函数: 只比较稳定健康枚举，不改变候选资格或交互。
     *
     * @param {string} healthStatus SourceRecord.runtime.healthStatus。
     * @returns {string} 当前数据源三态中文说明。
     */
    getStatusLabel(healthStatus) {
      // 条件分支: 最近健康检测结果为 normal 时进入。
      // 执行内容: 返回可用说明；该状态仍只代表 Provider 最近一次标准健康检查成功。
      if (healthStatus === HEALTH_STATUS.normal) {
        return '数据源可用';
      }
      // 条件分支: Manager 正在执行健康检测时进入。
      // 执行内容: 返回检查中说明，让用户区分暂态与最终不可用状态。
      if (healthStatus === HEALTH_STATUS.checking) {
        return '正在检测数据源';
      }
      // 条件分支: 最近健康检测结果为 unavailable 时进入。
      // 执行内容: 返回最近检测不可用说明，不擅自改变 Runtime 候选资格。
      if (healthStatus === HEALTH_STATUS.unavailable) {
        return '数据源不可用';
      }
      return '数据源状态未知';
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 全局数据源选择根区域。
  样式作用: 在固定导航首行横向组合下拉触发器与当前源状态，并作为浮动菜单定位上下文。
*/
.source-navbar-selector {
  /* 定义触发器与候选菜单之间的稳定区隔，桌面和窄屏共用。 */
  --source-navbar-menu-gap: 8px;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: #f8fafc;
}

/*
  作用容器: 数据源列表触发按钮。
  样式作用: 使用 Bootstrap dropdown 风格的紧凑文字、边界和箭头，不引入 Bootstrap 运行依赖。
*/
.source-navbar-selector__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 11px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 5px;
  color: #f8fafc;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.source-navbar-selector__trigger:hover,
.source-navbar-selector__trigger[aria-expanded='true'] {
  background: rgba(255, 255, 255, 0.13);
  border-color: rgba(255, 255, 255, 0.46);
}

.source-navbar-selector__trigger:focus-visible {
  outline: 2px solid #8fb2ff;
  outline-offset: 2px;
}

.source-navbar-selector__trigger-label--compact {
  display: none;
}

.source-navbar-selector__arrow {
  flex: 0 0 auto;
  font-size: 11px;
  transition: transform 0.18s ease;
}

.source-navbar-selector__arrow--open {
  transform: rotate(180deg);
}

/*
  作用容器: 当前活动源状态。
  样式作用: 与触发按钮相邻持续显示实时身份和健康点，不承担第二切换入口。
*/
.source-navbar-selector__current {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 36px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  box-sizing: border-box;
}

.source-navbar-selector__current-label {
  color: #aeb9cc;
  font-size: 12px;
  white-space: nowrap;
}

.source-navbar-selector__current-name {
  max-width: 104px;
  overflow: hidden;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
  作用容器: 数据源下拉菜单。
  样式作用: 从固定首行向下浮动，限制宽高并为任意数量候选提供内部滚动。
*/
.source-navbar-selector__menu {
  position: absolute;
  top: calc(100% + var(--source-navbar-menu-gap));
  left: 0;
  z-index: 20;
  width: min(320px, calc(100vw - 20px));
  max-height: min(420px, calc(100vh - var(--app-navbar-height) - 24px));
  padding: 6px;
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid #d9e0ea;
  border-radius: 6px;
  box-shadow: 0 12px 28px rgba(12, 24, 43, 0.22);
  box-sizing: border-box;
}

.source-navbar-selector__option {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 8px;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 38px;
  padding: 7px 9px;
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: #253047;
  font-family: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}

.source-navbar-selector__option:not(.source-navbar-selector__option--disabled):hover,
.source-navbar-selector__option:focus-visible {
  background: #eef3fb;
  outline: none;
}

.source-navbar-selector__option--active {
  background: #e7efff;
  color: #244fa8;
  font-weight: 700;
}

.source-navbar-selector__option--pending {
  background: #fff7df;
  color: #7a5410;
}

.source-navbar-selector__option--disabled {
  cursor: default;
  opacity: 0.82;
}

.source-navbar-selector__check {
  color: #4f7cff;
  font-size: 14px;
  text-align: center;
}

.source-navbar-selector__option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
  作用容器: 健康状态点。
  样式作用: 使用稳定固定圆点表达 Manager 最近健康检测，不参与候选资格判断。
*/
.source-navbar-selector__status-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #94a3b8;
}

.source-navbar-selector__status-dot--normal {
  background: #22a06b;
}

.source-navbar-selector__status-dot--checking {
  background: #3b82f6;
}

.source-navbar-selector__status-dot--unavailable {
  background: #d14343;
}

.source-navbar-selector__message,
.source-navbar-selector__inline-error {
  padding: 10px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.source-navbar-selector__message--error,
.source-navbar-selector__inline-error {
  color: #b42318;
}

/*
  断点: 小于 1200px，与 AppNavbar 平板和移动端折叠边界一致。
  影响范围: 固定首行的数据源下拉菜单。
  布局变化: 菜单脱离局部触发器定位，固定在导航首行下方并复用导航水平安全边距，避免汉堡预留列把菜单推离视口。
*/
@media (max-width: 1199.98px) {
  .source-navbar-selector__menu {
    /* 相对视口固定，使菜单边界不再受中间网格列和汉堡预留宽度影响。 */
    position: fixed;
    /* 从固定导航首行下方开始，并保留共享菜单区隔。 */
    top: calc(var(--app-navbar-height) + var(--source-navbar-menu-gap));
    /* 右边界与 AppNavbar 当前视口安全边距一致。 */
    right: var(--app-navbar-inline-padding);
    /* 取消桌面按触发器左边缘定位。 */
    left: auto;
    /* 在常规窄屏保持紧凑菜单，极窄视口则同时扣除两侧共享安全边距。 */
    width: min(
      320px,
      calc(100vw - var(--app-navbar-inline-padding) - var(--app-navbar-inline-padding))
    );
    /* 只使用导航下方的可见高度，候选过多时继续由菜单内部滚动。 */
    max-height: calc(
      100vh - var(--app-navbar-height) - var(--source-navbar-menu-gap) - var(--app-navbar-inline-padding)
    );
  }
}

/*
  断点: 小于 576px。
  影响范围: 固定首行数据源触发器和当前源状态。
  布局变化: 使用更短标签并隐藏“当前源”说明，保留真实名称和状态点。
*/
@media (max-width: 575.98px) {
  .source-navbar-selector {
    gap: 5px;
  }

  .source-navbar-selector__trigger {
    height: 34px;
    padding: 0 8px;
    font-size: 13px;
  }

  .source-navbar-selector__trigger-label--full {
    display: none;
  }

  .source-navbar-selector__trigger-label--compact {
    display: inline;
  }

  .source-navbar-selector__current {
    height: 34px;
    padding: 0 8px;
  }

  .source-navbar-selector__current-label {
    display: none;
  }

  .source-navbar-selector__current-name {
    max-width: 72px;
    font-size: 13px;
  }
}

/*
  断点: 用户启用减少动效偏好。
  影响范围: 下拉箭头。
  布局变化: 保留打开状态旋转结果但取消过渡。
*/
@media (prefers-reduced-motion: reduce) {
  .source-navbar-selector__arrow {
    transition: none;
  }
}
</style>
