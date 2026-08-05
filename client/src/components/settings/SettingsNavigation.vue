<template>
  <!--
    SettingsNavigation 组件渲染树

    [DEFAULT] ele(div.settings-navigation-shell)
    ├─ ele(button.settings-navigation__mobile-trigger) 小屏抽屉入口
    ├─ [IF compactViewport && drawerOpen] ele(button.settings-navigation__backdrop) 抽屉遮罩
    └─ ele(aside.settings-navigation)
       ├─ ele(header.settings-navigation__drawer-header) 小屏抽屉标题和关闭按钮
       └─ ele(nav.settings-navigation__menu)
          ├─ ele(div.settings-navigation__group--primary) 四个日常设置入口
          └─ ele(div.settings-navigation__group--secondary) 两个底部声明入口
  -->
  <!--
    [DEFAULT] ele(div.settings-navigation-shell)
    - condition: 设置外壳默认渲染。
    - type: 原生标签 div。
    - description: 承载桌面持续侧栏和小屏抽屉入口，同一菜单 DOM 在两个布局间切换。
    - params: modules 来自 SettingsView 的可见模块配置。
    - events: 无。
  -->
  <div class="settings-navigation-shell">
    <!--
      [DEFAULT] ele(button.settings-navigation__mobile-trigger)
      - condition: 默认存在，由 CSS 只在小于 992px 时显示。
      - type: 原生按钮。
      - description: 展示菜单图标和当前模块名称，并打开左侧抽屉。
      - params: drawerOpen 控制 aria-expanded，activeModuleTitle 提供当前模块文案。
      - events: click 调用 openDrawer()。
    -->
    <button
      ref="menuTrigger"
      type="button"
      class="settings-navigation__mobile-trigger"
      aria-controls="settings-navigation-drawer"
      :aria-expanded="drawerOpen ? 'true' : 'false'"
      @click="openDrawer">
      <i class="el-icon-menu" aria-hidden="true"></i>
      <span>{{ activeModuleTitle }}</span>
      <i class="el-icon-arrow-right settings-navigation__mobile-trigger-arrow" aria-hidden="true"></i>
    </button>

    <!--
      [IF compactViewport && drawerOpen] ele(button.settings-navigation__backdrop)
      - condition: 小屏抽屉打开时渲染。
      - type: 原生按钮。
      - description: 覆盖工作区并提供点击关闭入口，不遮挡全局固定导航。
      - params: 无。
      - events: click 调用 closeDrawer()。
    -->
    <button
      v-if="compactViewport && drawerOpen"
      type="button"
      class="settings-navigation__backdrop"
      aria-label="关闭设置菜单"
      @click="closeDrawer"></button>

    <!--
      [DEFAULT] ele(aside.settings-navigation)
      - condition: 桌面持续显示；小屏由 drawerOpen 控制进入视口。
      - type: 原生标签 aside。
      - description: 浅色设置侧栏，只渲染一份配置驱动菜单。
      - params: compactViewport 与 drawerOpen 控制小屏 aria-hidden 和样式类。
      - events: 无。
    -->
    <aside
      id="settings-navigation-drawer"
      ref="navigationDrawer"
      class="settings-navigation"
      :class="{ 'settings-navigation--open': drawerOpen }"
      :aria-hidden="compactViewport && !drawerOpen ? 'true' : null"
      aria-label="设置模块导航"
      tabindex="-1">
      <header class="settings-navigation__drawer-header">
        <span>设置菜单</span>
        <button
          type="button"
          class="settings-navigation__close"
          aria-label="关闭设置菜单"
          title="关闭"
          @click="closeDrawer">
          <i class="el-icon-close" aria-hidden="true"></i>
        </button>
      </header>

      <!--
        [DEFAULT] ele(nav.settings-navigation__menu)
        - condition: 默认渲染。
        - type: 原生标签 nav。
        - description: 同一菜单 DOM 按配置分成主区和底部区。
        - params: primaryModules、secondaryModules 和 activeModuleId。
        - events: 每个按钮 click 调用 navigateToModule(routeName)。
      -->
      <nav class="settings-navigation__menu">
        <div class="settings-navigation__group settings-navigation__group--primary">
          <button
            v-for="moduleDefinition in primaryModules"
            :key="moduleDefinition.id"
            type="button"
            class="settings-navigation__item"
            :class="{ 'settings-navigation__item--active': moduleDefinition.id === activeModuleId }"
            :aria-current="moduleDefinition.id === activeModuleId ? 'page' : null"
            @click="navigateToModule(moduleDefinition.routeName)">
            <i :class="moduleDefinition.icon" aria-hidden="true"></i>
            <span>{{ moduleDefinition.title }}</span>
          </button>
        </div>

        <div class="settings-navigation__group settings-navigation__group--secondary">
          <button
            v-for="moduleDefinition in secondaryModules"
            :key="moduleDefinition.id"
            type="button"
            class="settings-navigation__item"
            :class="{ 'settings-navigation__item--active': moduleDefinition.id === activeModuleId }"
            :aria-current="moduleDefinition.id === activeModuleId ? 'page' : null"
            @click="navigateToModule(moduleDefinition.routeName)">
            <i :class="moduleDefinition.icon" aria-hidden="true"></i>
            <span>{{ moduleDefinition.title }}</span>
          </button>
        </div>
      </nav>
    </aside>
  </div>
</template>

<script>
/*
  SettingsNavigation.vue 模块说明

  - 文件职责:
      使用一份 SettingsModuleDefinition 菜单渲染桌面侧栏和小屏左侧抽屉。
      组件只维护抽屉开关与媒体查询状态，当前模块始终由 Vue Router meta 派生。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      settings module config exports: 自定义配置，提供模块 id、路由和导航分组枚举。

  - 模块级常量:
      SETTINGS_DRAWER_MEDIA_QUERY: string，与 CSS 992px 响应式边界对应的浏览器媒体查询。
      SETTINGS_NAVIGATION_FALLBACK_TITLE: string，模块配置暂不可用时的小屏按钮文案。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      SettingsNavigation: Vue component，供 SettingsView 渲染响应式设置导航。
*/

import {
  // 导入来源: ../../config/settings-module.config.js。
  // 导入内容: SETTINGS_MODULE_ID 设置模块标识枚举。
  // 文件作用: 路由 meta 缺失时使用数据源管理作为稳定激活入口。
  SETTINGS_MODULE_ID,
  // 导入来源: ../../config/settings-module.config.js。
  // 导入内容: SETTINGS_NAVIGATION_GROUP 导航分组枚举。
  // 文件作用: 把主区和底部区完全交给配置分流。
  SETTINGS_NAVIGATION_GROUP,
  // 导入来源: ../../config/settings-module.config.js。
  // 导入内容: SETTINGS_ROUTE_NAME 设置命名路由枚举。
  // 文件作用: 数据源详情等子路由缺失入口名称时使用稳定兜底。
  SETTINGS_ROUTE_NAME
} from '../../config/settings-module.config.js';

// 类型: string。
// 作用: 让脚本可访问性状态和 CSS 布局在 992px 边界同步；匹配时使用抽屉，未匹配时持续显示侧栏。
const SETTINGS_DRAWER_MEDIA_QUERY = '(max-width: 991px)';

// 类型: string。
// 作用: 模块配置暂不可用时提供中性按钮文案，不伪造某个业务模块已经激活。
const SETTINGS_NAVIGATION_FALLBACK_TITLE = '设置';

// 导出类型: default Vue component options；调用方: SettingsView；使用场景: 设置模块路由导航。
export default {
  // 类型: string；作用: 供 Vue Devtools 和错误堆栈识别设置导航。
  name: 'SettingsNavigation',

  props: {
    // 类型: Array<object>；来源: SettingsView 可见模块计算结果；作用: 生成唯一菜单和分组。
    modules: {
      type: Array,
      /**
       * 创建独立空模块数组。
       * 纯函数: 每个组件实例获得新数组，不共享可变默认值。
       *
       * @returns {Array<object>} 默认空设置模块列表。
       */
      default() {
        return [];
      }
    }
  },

  /**
   * 创建抽屉局部交互状态。
   * 纯函数: 不读取或修改 Store；媒体查询真实值在 mounted 阶段写入。
   *
   * @returns {object} 抽屉开关与小屏匹配状态。
   * @returns {boolean} return.drawerOpen true 表示小屏抽屉打开，false 表示关闭。
   * @returns {boolean} return.compactViewport true 表示当前小于 992px，false 表示桌面侧栏布局。
   */
  data() {
    return {
      drawerOpen: false,
      compactViewport: false
    };
  },

  computed: {
    /**
     * 读取当前设置模块 id。
     * 数据来源: 当前设置子路由 meta.settingsModuleId。
     * 纯函数: 不执行路由跳转或状态写入。
     *
     * @returns {string} 当前模块 id，缺失时返回数据源管理 id。
     */
    activeModuleId() {
      return this.$route.meta?.settingsModuleId || SETTINGS_MODULE_ID.sources;
    },

    /**
     * 读取当前模块用户名称。
     * 纯函数: 只查找父组件传入配置；未命中时使用中性设置文案。
     *
     * @returns {string} 小屏菜单按钮展示的当前模块名称。
     */
    activeModuleTitle() {
      // 类型: object|undefined；作用: 按路由派生 id 查找当前模块定义，不维护第二份选中状态。
      const activeModule = this.modules.find(moduleDefinition => moduleDefinition.id === this.activeModuleId);
      return activeModule?.title || SETTINGS_NAVIGATION_FALLBACK_TITLE;
    },

    /**
     * 读取主区设置模块。
     * 纯函数: 只按冻结 navigationGroup 过滤，不改变父数组顺序。
     *
     * @returns {Array<object>} 日常配置入口。
     */
    primaryModules() {
      return this.modules.filter(moduleDefinition => (
        moduleDefinition.navigationGroup === SETTINGS_NAVIGATION_GROUP.primary
      ));
    },

    /**
     * 读取底部声明模块。
     * 纯函数: 只按冻结 navigationGroup 过滤，不改变父数组顺序。
     *
     * @returns {Array<object>} 致谢和自定义源声明入口。
     */
    secondaryModules() {
      return this.modules.filter(moduleDefinition => (
        moduleDefinition.navigationGroup === SETTINGS_NAVIGATION_GROUP.secondary
      ));
    }
  },

  watch: {
    /**
     * 监听命名路由变化并收敛小屏抽屉。
     * 副作用: 路由真正变化后把 drawerOpen 设为 false，不修改当前模块身份。
     *
     * @param {string} nextRouteName 新命名路由。
     * @param {string} previousRouteName 旧命名路由。
     * @returns {void} 状态通过 Vue 响应式更新。
     */
    '$route.name'(nextRouteName, previousRouteName) {
      // 条件分支: 命名路由没有变化时进入。
      // 执行内容: 保持当前抽屉状态，避免无关 query 更新关闭菜单。
      if (nextRouteName === previousRouteName) return;

      this.drawerOpen = false;
    }
  },

  /**
   * 建立媒体查询和 Escape 监听。
   * 副作用: 创建 matchMedia 对象并注册 change、window keydown 监听；beforeDestroy 对称清理。
   *
   * @returns {void} 生命周期钩子不返回业务值。
   */
  mounted() {
    // 类型: MediaQueryList；作用: 追踪 992px 布局边界，供 aria-hidden 与遮罩条件使用。
    this.settingsViewportMediaQuery = window.matchMedia(SETTINGS_DRAWER_MEDIA_QUERY);
    this.compactViewport = this.settingsViewportMediaQuery.matches;
    // 副作用: 监听视口跨越断点；影响范围只限当前组件抽屉可访问性状态。
    this.settingsViewportMediaQuery.addEventListener('change', this.handleViewportChange);
    // 副作用: 监听窗口 Escape；影响范围只在当前设置导航实例存活期间。
    window.addEventListener('keydown', this.handleWindowKeydown);
  },

  /**
   * 清理媒体查询和键盘监听。
   * 副作用: 移除 mounted 注册的浏览器事件，避免设置页销毁后继续响应。
   *
   * @returns {void} 生命周期钩子不返回业务值。
   */
  beforeDestroy() {
    // 条件分支: 媒体查询对象已经创建时进入。
    // 执行内容: 对称移除 change 监听，避免访问已销毁组件。
    if (this.settingsViewportMediaQuery) {
      this.settingsViewportMediaQuery.removeEventListener('change', this.handleViewportChange);
    }
    window.removeEventListener('keydown', this.handleWindowKeydown);
  },

  methods: {
    /**
     * 打开小屏设置抽屉。
     * 副作用: 写入 drawerOpen，并在 Vue 完成渲染后把键盘焦点移入侧栏。
     *
     * @returns {void} 状态和焦点通过 Vue 与 DOM 更新。
     */
    openDrawer() {
      this.drawerOpen = true;
      this.$nextTick(this.focusDrawer);
    },

    /**
     * 关闭小屏设置抽屉。
     * 副作用: 写入 drawerOpen，并把键盘焦点返回菜单触发按钮。
     *
     * @returns {void} 状态和焦点通过 Vue 与 DOM 更新。
     */
    closeDrawer() {
      this.drawerOpen = false;
      this.$nextTick(this.focusMenuTrigger);
    },

    /**
     * 把焦点移入抽屉根节点。
     * 副作用: 调用 HTMLElement.focus；抽屉 ref 不存在时不执行操作。
     *
     * @returns {void} 只更新浏览器焦点。
     */
    focusDrawer() {
      this.$refs.navigationDrawer?.focus();
    },

    /**
     * 把焦点返回小屏菜单按钮。
     * 副作用: 调用 HTMLElement.focus；按钮 ref 不存在时不执行操作。
     *
     * @returns {void} 只更新浏览器焦点。
     */
    focusMenuTrigger() {
      this.$refs.menuTrigger?.focus();
    },

    /**
     * 处理视口跨越设置导航断点。
     * 副作用: 更新 compactViewport；进入桌面时关闭遗留抽屉状态。
     *
     * @param {MediaQueryListEvent} event 浏览器媒体查询变化事件。
     * @returns {void} 状态通过 Vue 响应式更新。
     */
    handleViewportChange(event) {
      this.compactViewport = event.matches;
      // 条件分支: 视口进入桌面侧栏模式时进入。
      // 执行内容: 清除小屏抽屉开关，避免再次缩小时自动打开旧菜单。
      if (!event.matches) this.drawerOpen = false;
    },

    /**
     * 处理窗口键盘事件。
     * 副作用: 小屏抽屉打开且按下 Escape 时关闭抽屉并恢复焦点。
     *
     * @param {KeyboardEvent} event 浏览器键盘事件。
     * @returns {void} 非 Escape 或抽屉关闭时不执行操作。
     */
    handleWindowKeydown(event) {
      // 条件分支: 抽屉打开且用户按下 Escape 时进入。
      // 执行内容: 通过统一关闭方法收敛状态和键盘焦点。
      if (this.drawerOpen && event.key === 'Escape') this.closeDrawer();
    },

    /**
     * 跳转到指定设置模块。
     * 副作用: 小屏先关闭抽屉，再调用 Vue Router 执行命名路由导航。
     * 成功路径: 路由 meta 驱动激活态和工作区同步更新。
     * 失败路径: 重复导航被忽略，其他错误继续抛出。
     *
     * @param {string} routeName 目标设置模块命名路由。
     * @returns {void} 导航结果由 Vue Router Promise 收敛。
     */
    navigateToModule(routeName) {
      this.drawerOpen = false;
      // 条件分支: 目标为空或已经是当前命名路由时进入。
      // 执行内容: 不提交重复导航，当前页面保持不变。
      if (!routeName || routeName === this.$route.name) return;

      this.$router.push({ name: routeName }).catch(this.rethrowNavigationError);
    },

    /**
     * 过滤 Vue Router 重复导航并传播真实失败。
     * 纯函数: 不修改组件和路由状态；真实错误直接重新抛出。
     *
     * @param {*} error Vue Router 导航拒绝原因。
     * @returns {void} 重复导航被消费。
     * @throws {*} 非 NavigationDuplicated 错误保持原异常传播。
     */
    rethrowNavigationError(error) {
      // 条件分支: 错误不是 Vue Router 重复导航时进入。
      // 执行内容: 继续抛出真实加载或路由配置失败，禁止静默隐藏。
      if (error?.name !== 'NavigationDuplicated') throw error;
    }
  }
};
</script>

<style scoped>
/* 作用容器: 设置导航布局占位；桌面保持侧栏高度，小屏只承载菜单按钮。 */
.settings-navigation-shell {
  min-width: 0;
}

/* 作用容器: 桌面设置侧栏；固定浅色面板并在视口内持续可见。 */
.settings-navigation {
  position: sticky;
  top: calc(var(--app-navbar-height) + 20px);
  display: flex;
  flex-direction: column;
  width: 100%;
  height: calc(100vh - var(--app-navbar-height) - 40px);
  min-height: 420px;
  padding: 12px;
  border: 1px solid var(--border-color);
  background: var(--surface);
  box-sizing: border-box;
  overflow: hidden;
}

/* 作用容器: 小屏菜单按钮；桌面持续侧栏存在时隐藏。 */
.settings-navigation__mobile-trigger {
  display: none;
}

/* 作用容器: 小屏抽屉标题栏；桌面不需要重复标题或关闭按钮。 */
.settings-navigation__drawer-header {
  display: none;
}

/* 作用容器: 唯一菜单 DOM；纵向填满侧栏，为底部声明入口提供稳定定位。 */
.settings-navigation__menu {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

/* 作用容器: 设置导航分组；使用紧凑纵向网格排列入口。 */
.settings-navigation__group {
  display: grid;
  gap: 4px;
}

/* 作用容器: 底部声明分组；自动占用剩余空间并用分隔线区别日常设置。 */
.settings-navigation__group--secondary {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

/* 作用容器: 单个设置入口；稳定图标列和文字列，不随激活状态改变尺寸。 */
.settings-navigation__item {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: color var(--motion-fast), background var(--motion-fast);
}

/* 作用容器: 设置入口图标；固定宽度并居中，保证各行文字对齐。 */
.settings-navigation__item > i {
  width: 20px;
  font-size: 17px;
  text-align: center;
}

/* 作用容器: 当前设置入口；蓝底白字提供明确、稳定的页面归属。 */
.settings-navigation__item--active {
  background: var(--accent);
  color: var(--surface);
}

/* 作用容器: 未激活入口悬停；使用浅强调底提示可点击，不覆盖当前项蓝底。 */
.settings-navigation__item:not(.settings-navigation__item--active):hover {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

/* 作用容器: 键盘聚焦入口；提供可辨轮廓且不改变布局尺寸。 */
.settings-navigation__item:focus-visible,
.settings-navigation__mobile-trigger:focus-visible,
.settings-navigation__close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* 作用容器: 小屏遮罩；桌面不创建视觉输出。 */
.settings-navigation__backdrop {
  display: none;
}

/* 响应式断点: 小于 992px；持续侧栏转为同一菜单 DOM 的左侧抽屉。 */
@media (max-width: 991px) {
  /* 作用容器: 小屏导航占位；使用文档流按钮，不保留桌面侧栏宽度。 */
  .settings-navigation-shell {
    width: 100%;
  }

  /* 作用容器: 小屏菜单按钮；展示菜单图标、当前模块和方向图标。 */
  .settings-navigation__mobile-trigger {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) 16px;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 10px 14px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--surface);
    color: var(--text-primary);
    font: inherit;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }

  /* 作用容器: 小屏菜单按钮右侧箭头；贴近右缘提示可展开。 */
  .settings-navigation__mobile-trigger-arrow {
    color: var(--text-muted);
    text-align: right;
  }

  /* 作用容器: 小屏工作区遮罩；从全局导航下方覆盖其余页面。 */
  .settings-navigation__backdrop {
    position: fixed;
    z-index: calc(var(--app-navbar-z-index) - 2);
    top: var(--app-navbar-height);
    right: 0;
    bottom: 0;
    left: 0;
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: rgba(23, 32, 51, 0.38);
    cursor: default;
  }

  /* 作用容器: 小屏设置抽屉；关闭时移出视口并阻止交互。 */
  .settings-navigation {
    position: fixed;
    z-index: calc(var(--app-navbar-z-index) - 1);
    top: var(--app-navbar-height);
    bottom: 0;
    left: 0;
    width: min(304px, calc(100vw - 48px));
    height: auto;
    min-height: 0;
    padding: 0 12px 16px;
    border-width: 0 1px 0 0;
    box-shadow: var(--shadow-card);
    overflow-y: auto;
    visibility: hidden;
    transform: translateX(-100%);
    pointer-events: none;
    transition: transform var(--motion-fast), visibility var(--motion-fast);
  }

  /* 作用容器: 打开状态抽屉；进入视口并恢复指针交互。 */
  .settings-navigation--open {
    visibility: visible;
    transform: translateX(0);
    pointer-events: auto;
  }

  /* 作用容器: 小屏抽屉标题栏；固定标题和图标关闭按钮。 */
  .settings-navigation__drawer-header {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
    font-weight: 700;
  }

  /* 作用容器: 抽屉关闭按钮；使用熟悉的关闭图标和稳定点击区域。 */
  .settings-navigation__close {
    display: inline-grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 18px;
    cursor: pointer;
  }

  /* 作用容器: 小屏底部声明分组；保持在菜单内容末尾并与主区分隔。 */
  .settings-navigation__group--secondary {
    margin-top: 16px;
  }
}
</style>
