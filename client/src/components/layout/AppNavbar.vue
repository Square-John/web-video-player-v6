<template>
  <!--
    [DEFAULT] ele(div.navbar-wrapper)
    - condition: 应用外壳始终挂载顶部导航。
    - type: 原生 div。
    - description: 固定顶部背景和覆盖层级，内部高度由共享 CSS 变量控制。
    - params: 无。
    - events: 无。
  -->
  <div class="navbar-wrapper">
    <!--
      [DEFAULT] ele(header.app-navbar)
      - condition: 根容器存在时默认渲染。
      - type: 原生 header。
      - description: 使用 Bootstrap Navbar 的品牌、toggler、collapse 结构组织项目导航。
      - params: -- isNavigationOpen 控制窄屏面板。
      - events: 无。
    -->
    <header class="app-navbar">
      <!--
        [DEFAULT] ele(button.app-navbar__brand)
        - condition: 所有视口始终渲染。
        - type: 原生 button。
        - description: 展示用户确认的完整透明 PNG 项目 Logo，并作为首页快捷入口。
        - params: -- projectLogoUrl 指向按 Vite basePath 解析的正式品牌资源。
        - events: @click -> handleNavClick({ name: 'home' })。
      -->
      <button
        type="button"
        class="app-navbar__brand"
        aria-label="返回首页"
        @click="handleNavClick({ name: 'home' })"
      >
        <img class="app-navbar__project-logo" :src="projectLogoUrl" alt="Web Video Player v6" />
      </button>

      <!--
        [DEFAULT] ele(nav.app-navbar__menu--desktop)
        - condition: CSS 仅在 1200px 及以上显示。
        - type: 原生 nav，内部复用 AppNavbarItem。
        - description: 按路由 meta.nav.order 渲染桌面完整导航，不借用移动 CSS order。
        - params: -- desktopNavItems；-- activePage。
        - events: @navigate -> handleNavClick(item)；@close -> handleContextClose(item)。
      -->
      <nav class="app-navbar__menu app-navbar__menu--desktop" aria-label="主导航">
        <AppNavbarItem
          v-for="item in desktopNavItems"
          :key="item.key"
          :item="item"
          :active-page="activePage"
          :scroll-on-overflow="item.key === 'player'"
          @navigate="handleNavClick"
          @close="handleContextClose"
        />
      </nav>

      <!--
        [DEFAULT] ele(SourceNavbarSelector)
        - condition: 所有路由和视口始终渲染。
        - type: 自定义组件，相对位置 ../source/SourceNavbarSelector.vue。
        - description: 在固定首行提供唯一全局数据源菜单，并持续显示当前源和实时健康状态。
        - params: -- menuOpen 由 AppNavbar 控制，保证与主导航面板互斥。
        - events: @toggle-menu -> toggleSourceMenu()；@close-menu -> closeSourceMenu()。
      -->
      <SourceNavbarSelector
        :menu-open="isSourceMenuOpen"
        @toggle-menu="toggleSourceMenu"
        @close-menu="closeSourceMenu"
      />

      <!--
        [DEFAULT] ele(button.app-navbar__toggler)
        - condition: CSS 在 1200px 以下显示，在桌面展开导航视口隐藏。
        - type: 原生 button。
        - description: 使用标准三横线图标控制唯一导航内容面板，不创建第二套路由列表。
        - params: -- isNavigationOpen 同步 aria-expanded 和激活类。
        - events: @click -> toggleNavigation()。
      -->
      <button
        type="button"
        class="app-navbar__toggler"
        :class="{ 'app-navbar__toggler--active': isNavigationOpen }"
        aria-label="切换主导航"
        aria-controls="app-navbar-collapse"
        :aria-expanded="String(isNavigationOpen)"
        @click="toggleNavigation"
      >
        <span class="app-navbar__toggler-icon" aria-hidden="true"></span>
      </button>

      <!--
        [DEFAULT] ele(div.app-navbar__collapse)
        - condition: 1200px 以下渲染移动第二行；isNavigationOpen 为 true 时转为侧边抽屉。
        - type: 原生 div。
        - description: 移动第二行和抽屉共享同一 mobileNavItems 投影，桌面由独立顺序投影渲染。
        - params: -- isNavigationOpen 控制 app-navbar__collapse--open。
        - events: 无。
      -->
      <div
        id="app-navbar-collapse"
        class="app-navbar__collapse"
        :class="{ 'app-navbar__collapse--open': isNavigationOpen }"
      >
        <!--
          [DEFAULT] ele(nav.app-navbar__menu)
          - condition: mobileNavItems 有条目时循环渲染；空数组时保留空导航语义容器。
          - type: 原生 nav。
          - description: 收起时横向显示移动优先入口，展开后在侧边抽屉中纵向显示同一组入口。
          - params: -- mobileNavItems；-- activePage。
          - events: 无。
        -->
        <div v-if="isNavigationOpen" class="app-navbar__drawer-header">
          <span class="app-navbar__drawer-menu-icon" aria-hidden="true">
            <span class="app-navbar__toggler-icon"></span>
          </span>
          <button type="button" class="app-navbar__drawer-close" aria-label="关闭主导航" @click="closeNavigation">
            <i class="el-icon-arrow-left" aria-hidden="true"></i>
          </button>
        </div>

        <nav class="app-navbar__menu app-navbar__menu--mobile" aria-label="主导航">
          <AppNavbarItem
            v-for="item in mobileNavItems"
            :key="item.key"
            :item="item"
            :active-page="activePage"
            :scroll-on-overflow="item.key === 'player'"
            :stacked="isNavigationOpen"
            @navigate="handleNavClick"
            @close="handleContextClose"
          />
        </nav>
      </div>

      <!--
        [IF isNavigationOpen] ele(button.app-navbar__backdrop)
        - condition: 移动端侧边导航打开时渲染；桌面端由 CSS 隐藏。
        - type: 原生 button。
        - description: 关闭抽屉的遮罩层，阻止抽屉外页面误操作。
        - params: 无。
        - events: @click -> closeNavigation()。
      -->
      <button
        v-if="isNavigationOpen"
        type="button"
        class="app-navbar__backdrop"
        aria-label="关闭主导航"
        @click="closeNavigation"
      ></button>

      <!--
        [DEFAULT] ele(form.app-navbar__search)
        - condition: 所有视口始终渲染。
        - type: 原生 form。
        - description: 第一行搜索入口，提交关键词后进入搜索结果上下文。
        - params: -- searchKeyword 通过 v-model.trim 双向绑定。
        - events: @submit.prevent -> handleSearchSubmit()。
      -->
      <form class="app-navbar__search" role="search" @submit.prevent="handleSearchSubmit">
        <input
          v-model.trim="searchKeyword"
          class="app-navbar__search-input"
          type="search"
          placeholder="请输入搜索关键字"
          aria-label="搜索关键字"
        />
        <button type="submit" class="app-navbar__search-button" aria-label="搜索">
          <i class="el-icon-search" aria-hidden="true"></i>
        </button>
      </form>

      <!--
        [DEFAULT] ele(div.app-navbar__user)
        - condition: 所有视口始终渲染。
        - type: 原生 div。
        - description: 第一行登录或游客头像入口。
        - params: -- isGuestAuthenticated；-- isUserMenuOpen。
        - events: @click -> openGuestLogin()/toggleUserMenu()。
      -->
      <div ref="userMenuRoot" class="app-navbar__user">
        <!-- 未登录只展示登录按钮，不在导航上重复标注游客模式。 -->
        <button
          v-if="!isGuestAuthenticated"
          type="button"
          class="app-navbar__user-button"
          aria-label="登录"
          @click="openGuestLogin"
        >
          <span class="app-navbar__user-button-label">登录</span>
        </button>

        <!-- 登录后显示游客身份和可进入个人中心/退出的菜单。 -->
        <div v-else class="app-navbar__user-authenticated">
          <button
            type="button"
            class="app-navbar__user-button app-navbar__user-button--profile"
            :class="{ 'app-navbar__user-button--open': isUserMenuOpen }"
            :aria-expanded="String(isUserMenuOpen)"
            aria-haspopup="menu"
            @click="toggleUserMenu"
          >
            <span class="app-navbar__avatar" aria-hidden="true">
              <i class="el-icon-user"></i>
            </span>
            <span class="app-navbar__user-name">Guest</span>
            <i class="el-icon-arrow-down app-navbar__user-arrow" aria-hidden="true"></i>
          </button>
          <div v-if="isUserMenuOpen" class="app-navbar__user-menu" role="menu">
            <button type="button" role="menuitem" @click="navigateToProfile">个人中心</button>
            <button type="button" role="menuitem" @click="logoutGuestSession">退出</button>
          </div>
        </div>
      </div>

      <!-- 登录弹窗独立于折叠面板，append-to-body 后不受导航面板高度影响。 -->
      <GuestLoginDialog
        :visible="isGuestLoginDialogVisible"
        @close="closeGuestLogin"
        @login-success="handleGuestLoginSuccess"
      />
    </header>
  </div>
</template>

<script>
/*
  AppNavbar.vue 模块说明

  - 文件职责:
      从 Router meta.nav 派生全站一级入口，并用一棵共享 DOM 协调宽屏展开和窄屏向下折叠。
      点击一级入口时读取当前标签页最近 fullPath，详情和播放等参数型页面可以恢复上次上下文。
      提供品牌首页入口、全站搜索和游客账号占位动作，不保存页面内容或数据源状态。

  - 导入库及文件汇总(8 条，内置 0 条，第三方 0 条，自定义 8 条):
      routes: 自定义路由表，用于派生导航名称、顺序和命名路由位置。
      routeSessionHistory: 自定义标签页路由历史门面，用于恢复一级入口最近地址。
      SourceNavbarSelector: 自定义组件，用于渲染全局数据源下拉和当前源实时状态。
      AppNavbarItem: 自定义统一导航项组件，用于渲染一体化关闭图标和条件滚动标题。
      createNavigationDisplayModel: 自定义纯展示模型工厂，用于生成桌面和移动/抽屉两个确定顺序。
      navigationContextService exports: 自定义内存服务，提供动态上下文投影、关闭清理和固定回退。
      GuestLoginDialog: 自定义组件，展示 guest 模拟登录表单和禁用注册标签。
      guestSessionService exports: 自定义内存会话服务，提供登录态读取和退出命令。

  - 模块级常量:
      PROJECT_LOGO_URL: string，按 Vite 部署基础路径生成的透明 PNG 项目 Logo 地址。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      AppNavbar: Vue component，供 App.vue 渲染固定主导航。
*/

// 导入来源: ../../router/routes。
// 导入内容: routes 标准 Vue Router 路由表。
// 文件作用: 从显式 meta.nav 派生唯一一级导航数组，不在组件复制路由配置。
import { routes } from '../../router/routes';

// 导入来源: ../../router/index.js。
// 导入内容: routeSessionHistory 标签页路由历史门面。
// 文件作用: 一级导航点击时把静态入口解析为当前标签页最近完整地址。
import { routeSessionHistory } from '../../router';

// 导入来源: ../source/SourceNavbarSelector.vue。
// 导入内容: SourceNavbarSelector 全局数据源导航组件。
// 文件作用: 在所有路由的固定导航首行渲染唯一数据源菜单和当前源状态。
import SourceNavbarSelector from '../source/SourceNavbarSelector.vue';

// 导入来源: ./AppNavbarItem.vue。
// 导入内容: AppNavbarItem 统一导航项组件。
// 文件作用: 桌面、移动第二行和抽屉复用同一标签、关闭和条件滚动实现。
import AppNavbarItem from './AppNavbarItem.vue';

// 导入来源: ./GuestLoginDialog.vue。
// 导入内容: GuestLoginDialog 模拟登录弹窗。
// 文件作用: 未登录按钮打开独立表单，登录成功后由唯一会话服务驱动导航状态。
import GuestLoginDialog from './GuestLoginDialog.vue';

import {
  // 导入来源: ../../services/guestSessionService.js；导入内容: GUEST_SESSION_STATUS；文件作用: 使用稳定状态枚举判断登录显示。
  GUEST_SESSION_STATUS,
  // 导入来源: ../../services/guestSessionService.js；导入内容: getGuestSessionState；文件作用: 响应式读取唯一内存会话。
  getGuestSessionState,
  // 导入来源: ../../services/guestSessionService.js；导入内容: logoutGuest；文件作用: 退出只恢复未登录展示，不清理用户内容。
  logoutGuest
} from '../../services/guestSessionService.js';

import {
  // 导入来源: ../../services/navigationContextService.js；导入内容: NAVIGATION_CONTEXT_KEY；文件作用: 区分播放关闭和普通上下文关闭命令。
  NAVIGATION_CONTEXT_KEY,
  // 导入来源: ../../services/navigationContextService.js；导入内容: getNavigationContextState；文件作用: 响应式读取页面注册的唯一动态导航投影。
  getNavigationContextState,
  // 导入来源: ../../services/navigationContextService.js；导入内容: rememberFixedNavigation；文件作用: 成功路由变化后记录关闭上下文的稳定回退页面。
  rememberFixedNavigation,
  // 导入来源: ../../services/navigationContextService.js；导入内容: removeNavigationContext；文件作用: 关闭搜索或详情时移除唯一动态上下文。
  removeNavigationContext,
  // 导入来源: ../../services/navigationContextService.js；导入内容: resolveNavigationFallback；文件作用: 关闭当前上下文时按反向链路解析回退地址。
  resolveNavigationFallback
} from '../../services/navigationContextService.js';

// 导入来源: ../../services/navigationDisplayModel.js。
// 导入内容: createNavigationDisplayModel 纯展示模型工厂。
// 文件作用: 从同一固定项和上下文集合生成桌面与移动/抽屉确定顺序。
import { createNavigationDisplayModel } from '../../services/navigationDisplayModel.js';

// 类型: string；来源: Vite import.meta.env.BASE_URL 与 public/brand/wvp-logo.png；作用: 本地开发和子路径部署共用用户确认的透明 PNG Logo。
const PROJECT_LOGO_URL = `${import.meta.env.BASE_URL}brand/wvp-logo.png`;

export default {
  // 组件名称: AppNavbar；用途: Vue Devtools 和 App.vue 组件注册识别。
  name: 'AppNavbar',

  /*
    components 注册当前模板中使用的自定义组件。
    注册名必须与模板标签和顶部渲染树保持一致。
  */
  components: {
    // 组件: AppNavbarItem 统一导航标签。
    // 作用: 处理一体化关闭图标、当前态和真实溢出滚动。
    AppNavbarItem,
    // 组件: SourceNavbarSelector 全局数据源选择组件。
    // 作用: 承载候选加载、实时状态投影和 Runtime 原子切换交互。
    SourceNavbarSelector,
    // 组件: GuestLoginDialog 模拟登录弹窗。
    // 作用: 收集 guest 用户名和空密码，不接入真实后端认证。
    GuestLoginDialog
  },

  /**
   * 创建顶部导航局部交互状态。
   * 纯函数: 每个组件实例返回独立搜索输入和折叠状态，不访问 Router、DOM 或浏览器宽度。
   * 成功路径: 初始搜索为空，窄屏导航默认收起。
   * 失败路径: 本函数无异步操作和预期异常。
   *
   * @returns {object} 当前导航实例的局部状态。
   */
  data() {
    return {
      // 类型: string；来源: PROJECT_LOGO_URL；作用: 导航只渲染用户确认的完整项目 Logo，不与 favicon 或用户头像复用。
      projectLogoUrl: PROJECT_LOGO_URL,
      // 类型: string；来源: 用户输入；作用: 顶部搜索表单提交的关键词，初始为空。
      searchKeyword: '',
      // 类型: boolean；true 展开窄屏共享导航面板，false 收起；由 toggler 和路由变化修改。
      isNavigationOpen: false,
      // 类型: boolean；true 展示全局数据源候选菜单，false 隐藏；由选择器事件、主菜单和路由变化修改。
      isSourceMenuOpen: false,
      // 类型: boolean；true 显示 guest 登录弹窗，false 隐藏；不进入任何浏览器存储。
      isGuestLoginDialogVisible: false,
      // 类型: boolean；true 展示登录后用户菜单，false 收起；路由变化和退出会重置。
      isUserMenuOpen: false
    };
  },

  computed: {
    /**
     * 读取唯一 guest 模拟会话状态。
     * 纯函数: 只读取 Vue 内存投影，不访问用户内容身份或 Repository。
     *
     * @returns {object} 当前 anonymous/authenticated 会话。
     */
    guestSessionState() {
      return getGuestSessionState();
    },

    /**
     * 判断导航是否显示登录后用户入口。
     * 纯函数: 只比较正式会话状态枚举。
     *
     * @returns {boolean} true 显示游客用户菜单，false 显示登录按钮。
     */
    isGuestAuthenticated() {
      return this.guestSessionState.status === GUEST_SESSION_STATUS.authenticated;
    },

    /**
     * 从标准路由表派生可见一级导航入口。
     * 纯函数: 只读取 routes 配置并返回新数组，不修改路由顺序或组件状态。
     * 成功路径: 按 meta.nav.order 返回 key、label、一级命名路由和静态入口位置。
     * 失败路径: 没有声明 meta.nav 的路由时返回空数组，模板不猜测入口。
     *
     * @returns {Array<object>} 唯一一级导航展示数组。
     */
    fixedNavItems() {
      // 类型: Array<object>；作用: 保存显式声明 meta.nav 且不属于动态上下文的固定一级路由。
      const navRoutes = routes.filter((route) => {
        // 类型: string；作用: 读取路由导航 key，后续排除由页面上下文拥有的三个动态入口。
        const navKey = route?.meta?.nav?.key || '';
        // 返回值类型: boolean；true 表示正式固定入口，false 表示上下文或非导航路由。
        return Boolean(route.meta && route.meta.nav)
          && !Object.values(NAVIGATION_CONTEXT_KEY).includes(navKey);
      });

      // 返回值类型: Array<object>；作用: 排序后转换为模板唯一消费结构。
      return navRoutes
        .sort((leftRoute, rightRoute) => {
          // 返回值类型: number；作用: 数字更小的路由排在更前面，顺序完全由路由元信息负责。
          return leftRoute.meta.nav.order - rightRoute.meta.nav.order;
        })
        .map((route) => {
          return {
            // 类型: string；作用: v-for 稳定键，来自路由导航定义。
            key: route.meta.nav.key,
            // 类型: string；作用: 当前一级导航的命名路由，作为会话历史的稳定槽位身份。
            navRouteName: route.name,
            // 类型: string；作用: 用户看到的一级导航名称。
            label: route.meta.nav.label,
            // 类型: object；作用: 交给 Vue Router 的命名路由位置，不拼接路径字符串。
            routeLocation: { name: route.name },
            // 类型: number；作用: 桌面固定顺序继续由路由元信息维护。
            order: route.meta.nav.order,
            // 类型: boolean；false 表示固定导航不显示关闭按钮。
            isContext: false
          };
        });
    },

    /**
     * 读取当前动态导航上下文投影。
     * 纯函数: 只读取 Vue observable 服务状态，不修改页面注册对象。
     *
     * @returns {object} 当前内存导航上下文状态。
     */
    navigationContextState() {
      return getNavigationContextState();
    },

    /**
     * 把动态上下文连接到路由导航顺序。
     * 纯函数: 只读取标准上下文和 route.meta.nav，不读取页面业务对象。
     *
     * @returns {Array<object>} 可以直接渲染的动态导航项。
     */
    contextNavItems() {
      return this.navigationContextState.contexts.map((context) => {
        // 类型: object|undefined；作用: 按上下文一级路由名读取正式桌面顺序，避免组件保存重复数字。
        const routeDefinition = routes.find(route => route.name === context.navRouteName);
        return {
          ...context,
          order: routeDefinition?.meta?.nav?.order,
          routeLocation: context.fullPath,
          isContext: true
        };
      });
    },

    /**
     * 生成桌面与移动/抽屉两个导航顺序投影。
     * 纯函数: 委托正式展示模型复制和排序，不修改固定项或上下文项。
     *
     * @returns {Readonly<object>} 包含 desktopItems 和 mobileItems 的冻结展示模型。
     */
    navigationDisplayModel() {
      return createNavigationDisplayModel(this.fixedNavItems, this.contextNavItems);
    },

    /**
     * 读取桌面正式导航顺序。
     * 纯函数: 只返回当前展示模型冻结数组，不重新排序或修改条目。
     *
     * @returns {ReadonlyArray<object>} 路由 meta.nav.order 顺序的完整可见入口。
     */
    desktopNavItems() {
      return this.navigationDisplayModel.desktopItems;
    },

    /**
     * 读取移动第二行和抽屉共同导航顺序。
     * 纯函数: 只返回当前展示模型冻结数组，两个移动表面不得分别排序。
     *
     * @returns {ReadonlyArray<object>} 播放、详情、搜索优先的完整可见入口。
     */
    mobileNavItems() {
      return this.navigationDisplayModel.mobileItems;
    },

    /**
     * 计算当前路由归属的一级导航入口。
     * 纯函数: 只读取当前路由 meta.topNavName 和 name，不提交导航或修改折叠状态。
     * 成功路径: 上下文子路由使用 topNavName，一级路由使用自身名称。
     * 失败路径: 未命名路由返回 home，保持稳定高亮。
     *
     * @returns {string} 当前应高亮的一级命名路由。
     */
    activePage() {
      // 类型: string|undefined；作用: 让严格播放路由和设置子路由归属对应一级入口。
      const topNavName = this.$route.meta && this.$route.meta.topNavName;
      return topNavName || this.$route.name || 'home';
    }
  },

  watch: {
    /**
     * 在路由成功变化后收起窄屏导航。
     * 触发来源: Vue Router 更新当前 fullPath。
     * 副作用: 把组件局部主菜单和数据源菜单开关都设为 false；不修改路由或导航数组。
     * 成功路径: 新页面从两个菜单均收起的固定首行开始，不继续遮住内容。
     * 失败路径: 同路径重复导航不会触发 watcher，由 Router 重复导航规则处理。
     *
     * @returns {void} 局部展示状态同步后结束。
     */
    '$route.fullPath'() {
      // 副作用: 路由已经采用新页面后关闭窄屏折叠面板，宽屏 CSS 展开状态不受影响。
      this.isNavigationOpen = false;
      // 副作用: 路由变化后关闭全局数据源菜单，避免浮层跨页面保留。
      this.isSourceMenuOpen = false;
      // 副作用: 路由成功变化后收起用户菜单，避免浮层跨页面保留。
      this.isUserMenuOpen = false;
      // 副作用: 只有当前一级归属属于固定导航时更新关闭回退，不让动态上下文覆盖最近固定页面。
      // 条件分支: 当前活动页是固定导航时进入。
      // 执行内容: 记录该固定页作为动态上下文关闭后的最近稳定回退。
      if (this.fixedNavItems.some(item => item.navRouteName === this.activePage)) {
        rememberFixedNavigation(this.activePage);
      }
    }
  },

  /**
   * Vue created 生命周期。
   * 副作用: 冷启动当前路由属于固定导航时记录初始回退位置。
   *
   * @returns {void} 初始固定导航同步后结束。
   */
  created() {
    // 条件分支: 冷启动路由归属固定导航时进入。
    // 执行内容: 记录当前固定页，避免首次关闭动态项没有回退目标。
    if (this.fixedNavItems.some(item => item.navRouteName === this.activePage)) {
      rememberFixedNavigation(this.activePage);
    }
  },

  /**
   * Vue mounted 生命周期。
   * 副作用: 注册 document 指针和 Escape 监听，用于关闭登录后用户菜单或移动端导航抽屉。
   *
   * @returns {void} 全局监听注册完成后结束。
   */
  mounted() {
    document.addEventListener('pointerdown', this.handleUserMenuPointerDown);
    document.addEventListener('keydown', this.handleNavigationKeydown);
  },

  /**
   * Vue beforeDestroy 生命周期。
   * 副作用: 移除当前导航实例注册的 document 监听，避免销毁后继续采用局部状态。
   *
   * @returns {void} 全局监听释放后结束。
   */
  beforeDestroy() {
    document.removeEventListener('pointerdown', this.handleUserMenuPointerDown);
    document.removeEventListener('keydown', this.handleNavigationKeydown);
  },

  methods: {
    /**
     * 打开 guest 登录弹窗。
     * 副作用: 收起其它导航浮层并显示独立登录表单。
     *
     * @returns {void} 局部显示状态更新后结束。
     */
    openGuestLogin() {
      this.isNavigationOpen = false;
      this.isSourceMenuOpen = false;
      this.isUserMenuOpen = false;
      this.isGuestLoginDialogVisible = true;
    },

    /**
     * 关闭 guest 登录弹窗。
     * 副作用: 只隐藏表单，不改变当前会话或用户内容。
     *
     * @returns {void} 弹窗关闭后结束。
     */
    closeGuestLogin() {
      this.isGuestLoginDialogVisible = false;
    },

    /**
     * 处理模拟登录成功。
     * 副作用: 会话已经由弹窗采用，本方法只关闭弹窗和用户菜单。
     *
     * @returns {void} 导航局部浮层收敛后结束。
     */
    handleGuestLoginSuccess() {
      this.isGuestLoginDialogVisible = false;
      this.isUserMenuOpen = false;
    },

    /**
     * 切换登录后用户菜单。
     * 副作用: 打开前关闭数据源和主导航面板，保持浮层互斥。
     *
     * @returns {void} 菜单状态更新后结束。
     */
    toggleUserMenu() {
      // 类型: boolean；作用: 保存本次操作后的用户菜单目标状态。
      const nextOpen = !this.isUserMenuOpen;
      // 条件分支: 本次将打开用户菜单时进入。
      // 执行内容: 收起其它导航浮层，避免多个菜单重叠。
      if (nextOpen) {
        this.isNavigationOpen = false;
        this.isSourceMenuOpen = false;
      }
      this.isUserMenuOpen = nextOpen;
    },

    /**
     * 处理用户菜单外部指针事件。
     * 副作用: 菜单打开且点击发生在根节点之外时收起菜单。
     *
     * @param {PointerEvent} event 浏览器指针事件。
     * @returns {void} 外部点击处理后结束。
     */
    handleUserMenuPointerDown(event) {
      // 类型: HTMLElement|null；作用: 读取用户菜单唯一根节点，限定外部点击边界。
      const root = this.$refs.userMenuRoot || null;
      // 条件分支: 菜单关闭、根节点缺失或点击发生在内部时进入。
      // 执行内容: 保持当前菜单状态。
      if (!this.isUserMenuOpen || !root || root.contains(event.target)) return;
      this.isUserMenuOpen = false;
    },

    /**
     * 处理导航浮层 Escape 键。
     * 副作用: 按下 Escape 时优先收起用户菜单，其次收起移动端导航抽屉，不拦截其它页面快捷键。
     *
     * @param {KeyboardEvent} event 浏览器键盘事件。
     * @returns {void} 键盘处理后结束。
     */
    handleNavigationKeydown(event) {
      // 条件分支: 当前按键不是 Escape 时进入。
      // 执行内容: 保留其它导航和播放器快捷键。
      if (event.key !== 'Escape') return;
      // 条件分支: 用户菜单打开时进入；执行内容: 只收起最高层用户菜单。
      if (this.isUserMenuOpen) {
        this.isUserMenuOpen = false;
        return;
      }
      // 条件分支: 移动端主导航抽屉打开时进入；执行内容: 幂等关闭抽屉。
      if (this.isNavigationOpen) {
        this.closeNavigation();
      }
    },

    /**
     * 从用户菜单进入个人中心。
     * 副作用: 收起菜单并复用正式固定导航入口。
     *
     * @returns {Promise<void>} 路由采用后完成。
     */
    navigateToProfile() {
      this.isUserMenuOpen = false;
      return this.handleNavClick({ name: 'profile' });
    },

    /**
     * 退出 guest 模拟会话。
     * 副作用: 只更新内存登录展示并收起菜单，不清理历史、收藏、设置或播放。
     *
     * @returns {void} 会话与菜单状态更新后结束。
     */
    logoutGuestSession() {
      logoutGuest();
      this.isUserMenuOpen = false;
    },

    /**
     * 切换窄屏共享导航面板。
     * 触发来源: 汉堡 toggler 的 click 事件。
     * 副作用: 反转 isNavigationOpen；打开前关闭数据源菜单，模板和 aria-expanded 同步更新。
     * 成功路径: 收起变展开或展开变收起。
     * 失败路径: 本方法不执行异步操作和预期异常。
     *
     * @returns {void} 局部折叠状态更新后结束。
     */
    toggleNavigation() {
      // 类型: boolean；作用: 保存本次操作后的主导航目标状态，供互斥规则和开关写入共同使用。
      const nextNavigationOpen = !this.isNavigationOpen;
      // 条件分支: 本次操作将打开主导航面板时进入。
      // 执行内容: 先关闭数据源和用户菜单，保证固定导航同一时刻只有一个展开区域。
      if (nextNavigationOpen) {
        this.isSourceMenuOpen = false;
        this.isUserMenuOpen = false;
      }
      // 副作用: 写入唯一主导航折叠状态，不操作 DOM 高度或读取视口宽度。
      this.isNavigationOpen = nextNavigationOpen;
    },

    /**
     * 关闭移动端主导航抽屉。
     * 副作用: 只把 isNavigationOpen 设为 false，不修改路由、上下文或数据源状态。
     * 成功路径: 抽屉、遮罩和 aria-expanded 同步收起；已关闭时保持幂等。
     *
     * @returns {void} 局部导航状态收敛后结束。
     */
    closeNavigation() {
      this.isNavigationOpen = false;
    },

    /**
     * 切换全局数据源候选菜单。
     * 触发来源: SourceNavbarSelector 发出的 toggle-menu 事件。
     * 副作用: 打开数据源菜单前关闭窄屏主导航面板，保证两类入口互斥。
     * 成功路径: 关闭状态变为打开，或打开状态变为关闭。
     * 失败路径: 本方法不执行异步操作和预期异常。
     *
     * @returns {void} 局部菜单状态更新后结束。
     */
    toggleSourceMenu() {
      // 类型: boolean；作用: 保存本次操作后的数据源菜单目标状态。
      const nextSourceMenuOpen = !this.isSourceMenuOpen;
      // 条件分支: 本次操作将打开数据源菜单时进入。
      // 执行内容: 关闭主导航和用户菜单，避免两个可展开区域同时占用视口。
      if (nextSourceMenuOpen) {
        this.isNavigationOpen = false;
        this.isUserMenuOpen = false;
      }
      // 副作用: 写入受控数据源菜单状态，子组件只通过 prop 消费结果。
      this.isSourceMenuOpen = nextSourceMenuOpen;
    },

    /**
     * 关闭全局数据源候选菜单。
     * 触发来源: SourceNavbarSelector 的外部点击、Escape 或切换成功事件。
     * 副作用: 只把 isSourceMenuOpen 设为 false，不修改主导航或 Manager。
     * 成功路径: 打开菜单收起；已关闭菜单保持幂等。
     * 失败路径: 本方法不执行异步操作和预期异常。
     *
     * @returns {void} 局部菜单状态同步后结束。
     */
    closeSourceMenu() {
      // 副作用: 幂等关闭受控数据源菜单，候选和当前源状态仍由子组件保留。
      this.isSourceMenuOpen = false;
    },

    /**
     * 提交一次命名路由导航并隔离重复导航错误。
     * 副作用: 调用当前 Vue Router 实例；不修改路由表、菜单数组或页面数据。
     * 成功路径: Router 采用目标；NavigationDuplicated 作为幂等操作结束。
     * 失败路径: 其他路由错误继续抛出，交给应用错误边界。
     *
     * @param {{name: string, query?: object}} routeLocation 由路由表或搜索表单构造的位置对象。
     * @returns {Promise<void>} 导航收敛后完成。
     */
    async pushRoute(routeLocation) {
      try {
        // 异步调用: 交给 Vue Router 采用命名位置，成功后路由 watcher 负责收起窄屏面板。
        await this.$router.push(routeLocation);
      } catch (error) {
        // 条件分支: 当前失败是 Vue Router 3 重复导航时进入。
        // 执行内容: 按幂等导航结束，不掩盖其他路由异常。
        if (error && error.name === 'NavigationDuplicated') {
          return;
        }
        throw error;
      }
    },

    /**
     * 处理品牌、一级入口和账号占位按钮导航。
     * 触发来源: 对应 button 的 click 事件。
     * 副作用: 委托 pushRoute 提交 Router 导航，不直接修改折叠状态或页面内容。
     * 成功路径: 目标路由采用后 watcher 统一收起面板。
     * 失败路径: 非重复导航错误由 pushRoute 继续传播。
     *
     * @param {object} navItem navItems 派生项，或品牌/账号按钮传入的静态命名路由位置。
     * @param {string} [navItem.navRouteName] 一级入口命名路由，会话历史白名单中的稳定身份。
     * @param {{name: string}} [navItem.routeLocation] 路由表声明的静态入口位置。
     * @param {string} [navItem.name] 品牌或账号按钮直接传入的静态命名路由。
     * @returns {Promise<void>} 导航事务收敛后完成。
     */
    handleNavClick(navItem) {
      // 条件分支: 当前项来自有效动态上下文时进入。
      // 执行内容: 直接采用服务保存的完整地址，不读取 sessionStorage 中可能过期的旧参数页历史。
      if (navItem?.isContext) {
        return this.pushRoute(navItem.fullPath);
      }

      // 类型: object；作用: 导航列表使用 routeLocation，品牌和账号按钮直接使用自身命名位置。
      const fallbackLocation = navItem && navItem.routeLocation ? navItem.routeLocation : navItem;
      // 类型: string；作用: 优先读取导航项显式一级身份，静态按钮回退命名路由自身。
      const navRouteName = navItem && navItem.navRouteName
        ? navItem.navRouteName
        : fallbackLocation && fallbackLocation.name;
      // 类型: string|object；作用: 参数型入口优先采用当前标签页最近 fullPath，无历史时保留静态命名位置。
      const routeLocation = routeSessionHistory.resolveNavigationLocation(
        navRouteName,
        fallbackLocation
      );
      return this.pushRoute(routeLocation);
    },

    /**
     * 关闭动态导航上下文。
     * 副作用: 非播放上下文由当前组件移除并在关闭当前项时回退；播放上下文交给 App 唯一媒体宿主处理。
     *
     * @param {object} navItem 当前动态导航项。
     * @returns {Promise<void>|void} 当前项关闭和可选路由回退完成后结束。
     */
    handleContextClose(navItem) {
      // 条件分支: 输入不是正式动态上下文时进入。
      // 执行内容: 不修改服务或 Router。
      if (!navItem?.isContext || !navItem.key) {
        return;
      }

      // 条件分支: 当前关闭正在播放上下文时进入。
      // 执行内容: 交给 App/PlayerView 完成进度、媒体和 currentPlaying 生命周期，导航层不自行停止播放器。
      if (navItem.key === NAVIGATION_CONTEXT_KEY.player) {
        this.$emit('close-player-context', navItem);
        return;
      }

      // 类型: boolean；作用: 关闭非当前上下文时只移除标签，不改变用户正在查看的路由。
      const isCurrentContext = navItem.navRouteName === this.activePage;
      // 类型: string；作用: 在移除反向上下文前解析当前项关闭后的确定回退地址。
      const fallbackFullPath = resolveNavigationFallback(navItem.key);
      removeNavigationContext(navItem.key);
      // 条件分支: 用户关闭的是当前上下文时进入。
      // 执行内容: 导航到反向上下文或最近固定页面；非当前关闭保持当前路由。
      if (isCurrentContext) {
        return this.pushRoute(fallbackFullPath);
      }
    },

    /**
     * 提交顶部搜索表单。
     * 触发来源: 表单 submit，浏览器默认刷新已由模板阻止。
     * 副作用: 标准化当前输入后导航到 search，非空关键词写入 query。
     * 成功路径: 搜索页取得 keyword；空输入仍进入搜索页但不产生空 query 字段。
     * 失败路径: 非重复 Router 错误由 pushRoute 传播。
     *
     * @returns {Promise<void>} 搜索路由导航收敛后完成。
     */
    handleSearchSubmit() {
      // 类型: string；作用: 去掉输入首尾空格，避免 URL 携带无意义空白。
      const normalizedKeyword = this.searchKeyword.trim();
      // 类型: object；作用: 只有存在真实关键词时才生成 keyword query。
      const query = normalizedKeyword ? { keyword: normalizedKeyword } : {};
      return this.pushRoute({ name: 'search', query });
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 固定导航外层 `.navbar-wrapper`。
  样式作用:
  固定覆盖视口顶部并继承 App.vue 定义的导航高度和层级令牌。
  展开面板继续属于同一固定导航，不推动根页面重复增加占位。
*/
.navbar-wrapper {
  /* 相对视口固定导航，让页面滚动时一级入口保持可访问。 */
  position: fixed;
  /* 固定到视口上边缘。 */
  top: 0;
  /* 固定到视口左边缘。 */
  left: 0;
  /* 让固定导航横向覆盖整个视口。 */
  width: 100%;
  /* 使用根外壳语义层级令牌，确保导航位于普通页面之上。 */
  z-index: var(--app-navbar-z-index);
  /* 使用克制深色背景区分全站导航和内容区域。 */
  background: #172133;
  /* 用底边界稳定分隔固定栏和页面内容。 */
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  /* 把边框计入全宽，避免固定层产生横向滚动。 */
  box-sizing: border-box;
}

/*
  作用容器: 导航主体 `.app-navbar`。
  样式作用:
  使用移动优先的两行 Grid 组织品牌、数据源选择、toggler 和 collapse。
  首行高度始终使用共享导航高度，窄屏展开内容位于其下方。
*/
.app-navbar {
  /* 定义导航内容水平安全边距，供首行布局和窄屏浮层共享同一边界。 */
  --app-navbar-inline-padding: clamp(12px, 2vw, 28px);
  /* 定义项目 PNG Logo 在普通移动和平板首行的完整显示高度。 */
  --app-navbar-project-logo-height: 44px;
  /* 定义平板与普通窄屏抽屉宽度上限，具体手机档由响应式令牌覆盖。 */
  --app-navbar-drawer-width: min(320px, 72vw);
  /* 定义播放动态标签稳定宽度，标题变化不能推动相邻入口。 */
  --app-navbar-player-item-width: 190px;
  /* 定义动态关闭图标的实际方形命中尺寸。 */
  --app-navbar-context-close-size: 24px;
  /* 定义动态标签为内部关闭图标预留的右侧空间。 */
  --app-navbar-context-close-space: 38px;
  /* 定义真实溢出播放标题的往返动画时长。 */
  --app-navbar-title-scroll-duration: 8s;
  /* 建立第一行四个功能区和第二行菜单条的唯一 Grid 布局。 */
  display: grid;
  /* 品牌和用户按内容占宽，数据源与搜索共同使用可收缩空间。 */
  grid-template-columns: auto minmax(76px, 0.8fr) minmax(100px, 1.4fr) auto;
  /* 第一行放品牌、数据源、搜索和用户；第二行放菜单按钮与导航条。 */
  grid-template-areas:
    'brand source search user'
    'toggler collapse collapse collapse';
  /* 用共享行高令牌稳定两行导航和页面顶部占位。 */
  grid-template-rows: var(--app-navbar-primary-row-height) var(--app-navbar-secondary-row-height);
  /* 让两行功能区都在各自行内垂直居中。 */
  align-items: center;
  /* 使用紧凑列间距分隔首行入口。 */
  column-gap: 10px;
  /* 保持固定栏横向铺满。 */
  width: 100%;
  /* 使用根外壳定义的导航总高度建立稳定两行导航。 */
  min-height: var(--app-navbar-height);
  /* 提供响应式左右安全边距，不使用页面级补偿。 */
  padding: 0 var(--app-navbar-inline-padding);
  /* 把内边距纳入总宽度。 */
  box-sizing: border-box;
}

/*
  作用容器: 品牌首页按钮 `.app-navbar__brand`。
  样式作用:
  作为紧凑第一视觉信号并提供首页快捷入口。
  清晰度高于普通导航文字，但不占用过多横向空间。
*/
.app-navbar__brand {
  /* 放入移动优先网格的品牌区域。 */
  grid-area: brand;
  /* 清除原生按钮背景。 */
  background: transparent;
  /* 清除原生按钮边框。 */
  border: 0;
  /* 移除额外内边距，让品牌宽度由完整 PNG 自然决定。 */
  padding: 0;
  /* 建立项目 Logo 居中容器。 */
  display: inline-flex;
  /* 保持完整项目 Logo 垂直居中。 */
  align-items: center;
  /* 保持项目 Logo 水平居中。 */
  justify-content: center;
  /* 鼠标设备显示可点击反馈。 */
  cursor: pointer;
}

/*
  作用容器: AppNavbar 直属的全局数据源选择根节点。
  样式作用:
  在窄屏首行使用可收缩中间列并贴近右侧控件，子组件仍拥有自己的下拉定位上下文。
*/
.app-navbar > .source-navbar-selector {
  /* 放入移动优先网格的数据源区域。 */
  grid-area: source;
  /* 把紧凑数据源控件靠近折叠按钮，避免品牌与操作混成一组。 */
  justify-self: end;
  /* 允许状态名称在极窄首行内按子组件规则截断。 */
  min-width: 0;
}

/*
  作用容器: 品牌键盘焦点 `.app-navbar__brand:focus-visible`。
  样式作用:
  为键盘用户提供不依赖颜色的清晰位置反馈。
*/
.app-navbar__brand:focus-visible {
  /* 使用主题强调色绘制可见焦点。 */
  outline: 2px solid var(--accent);
  /* 让焦点轮廓不贴住品牌文字。 */
  outline-offset: 4px;
}

/*
  作用容器: 窄屏折叠按钮 `.app-navbar__toggler`。
  样式作用:
  模仿 Bootstrap Navbar 的右侧方形汉堡按钮，控制同一 collapse。
  宽屏断点会隐藏该按钮。
*/
.app-navbar__toggler {
  /* 放入移动优先网格的折叠按钮区域。 */
  grid-area: toggler;
  /* 建立图标水平垂直居中的按钮容器。 */
  display: inline-flex;
  /* 水平居中菜单图标。 */
  justify-content: center;
  /* 垂直居中菜单图标。 */
  align-items: center;
  /* 使用稳定正方形点击宽度。 */
  width: 42px;
  /* 使用稳定正方形点击高度。 */
  height: 42px;
  /* 清除内部额外间距。 */
  padding: 0;
  /* 使用半透明边界表达按钮范围。 */
  border: 1px solid rgba(255, 255, 255, 0.22);
  /* 使用导航背景上的轻量表面色。 */
  background: rgba(255, 255, 255, 0.05);
  /* 使用项目克制圆角。 */
  border-radius: 6px;
  /* 图标使用浅色。 */
  color: #ffffff;
  /* 鼠标设备显示可点击反馈。 */
  cursor: pointer;
  /* 只过渡颜色属性，避免按钮尺寸变化。 */
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

/*
  作用容器: 展开或悬停的折叠按钮。
  样式作用:
  提高按钮表面对比度，让用户识别当前面板状态。
*/
.app-navbar__toggler:hover,
.app-navbar__toggler--active {
  /* 增强可操作或已展开状态背景。 */
  background: rgba(255, 255, 255, 0.12);
  /* 提高按钮边界对比度。 */
  border-color: rgba(255, 255, 255, 0.42);
}

/*
  作用容器: 折叠按钮键盘焦点 `.app-navbar__toggler:focus-visible`。
  样式作用:
  为键盘展开导航提供清晰焦点轮廓。
*/
.app-navbar__toggler:focus-visible {
  /* 使用主题强调色绘制可见焦点。 */
  outline: 2px solid var(--accent);
  /* 让焦点轮廓与边框分离。 */
  outline-offset: 2px;
}

/*
  作用容器: 折叠按钮三横线图标 `.app-navbar__toggler-icon`。
  样式作用:
  使用按钮当前文字色绘制标准汉堡轮廓，避免图标字体把菜单误显示成四宫格。
*/
.app-navbar__toggler-icon {
  /* 为上、中、下三条横线建立稳定定位区域。 */
  position: relative;
  /* 固定图标宽度，让三条横线保持一致。 */
  width: 18px;
  /* 固定图标高度，控制上下横线之间的视觉距离。 */
  height: 14px;
  /* 使用块级盒承载边框和中间伪元素。 */
  display: block;
  /* 使用当前按钮文字色绘制上横线。 */
  border-top: 2px solid currentColor;
  /* 使用当前按钮文字色绘制下横线。 */
  border-bottom: 2px solid currentColor;
  /* 把两条边框计入固定图标高度。 */
  box-sizing: border-box;
}

/*
  作用容器: 折叠按钮三横线图标中线。
  样式作用:
  在上下边框之间绘制第三条横线，形成浏览器和 Bootstrap 导航通用的菜单符号。
*/
.app-navbar__toggler-icon::before {
  /* 创建只承担视觉作用的中间横线。 */
  content: '';
  /* 相对图标盒定位中间横线。 */
  position: absolute;
  /* 从图标左边缘开始绘制。 */
  left: 0;
  /* 把横线中心放在图标垂直中点。 */
  top: 50%;
  /* 中线与上下横线保持相同宽度。 */
  width: 100%;
  /* 中线厚度与上下边框一致。 */
  height: 2px;
  /* 继承按钮当前文字色，保证悬停和激活状态同步。 */
  background: currentColor;
  /* 按自身一半高度向上校正，实现准确垂直居中。 */
  transform: translateY(-50%);
}

/*
  作用容器: 共享导航内容 `.app-navbar__collapse`。
  样式作用:
  窄屏默认收起唯一菜单、搜索和用户区。
  不使用 display 双树切换，展开后在固定栏内限制高度并允许纵向滚动。
*/
.app-navbar__collapse {
  /* 让共享导航条占满第二行剩余网格区域。 */
  grid-area: collapse;
  /* 占满第二行可用宽度。 */
  width: 100%;
  /* 第二行始终显示优先导航，不再把它误当成顶部功能区折叠内容。 */
  display: block;
  /* 横向导航条由内部列表管理滚动。 */
  max-height: none;
  overflow: hidden;
  /* 第二行默认可见并可交互。 */
  visibility: visible;
  /* 第二行横向导航条保持可交互；打开状态会切换为抽屉。 */
  pointer-events: auto;
  /* 不额外改变两行导航的高度。 */
  padding: 0;
}

/*
  作用容器: 已展开共享导航 `.app-navbar__collapse--open`。
  样式作用:
  在首行下方展示唯一功能树，并把最大高度限制在剩余视口。
  内容过长时内部滚动，固定导航不会把底部命令推出可达范围。
*/
.app-navbar__collapse--open {
  /* 移动端打开后切换成固定侧边抽屉。 */
  position: fixed;
  top: var(--app-navbar-primary-row-height);
  left: 0;
  bottom: 0;
  width: var(--app-navbar-drawer-width);
  /* 把抽屉内边距计入响应式宽度令牌，最小手机的 60vw 表达完整可见抽屉。 */
  box-sizing: border-box;
  max-height: none;
  overflow-y: auto;
  visibility: visible;
  pointer-events: auto;
  padding: 14px;
  background: #172133;
  box-shadow: 14px 0 34px rgba(8, 16, 31, 0.34);
  z-index: calc(var(--app-navbar-z-index) + 2);
}

/*
  作用容器: 移动端抽屉头部 `.app-navbar__drawer-header`。
  样式作用: 只在侧边抽屉打开时用菜单图标确认区域身份，并提供向左收回命令。
*/
.app-navbar__drawer-header {
  /* 默认隐藏，横向第二行只展示导航项。 */
  display: none;
}

.app-navbar__collapse--open .app-navbar__drawer-header {
  /* 抽屉打开时横向排列标题和关闭命令。 */
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  margin-bottom: 10px;
  color: #ffffff;
}

.app-navbar__drawer-menu-icon {
  /* 使用与外部 toggler 一致的稳定图标命中尺寸。 */
  width: 32px;
  /* 保持抽屉头部两端视觉高度一致。 */
  height: 32px;
  /* 使用 Flex 居中复用的汉堡图形。 */
  display: inline-flex;
  /* 水平居中三横线图标。 */
  justify-content: center;
  /* 垂直居中三横线图标。 */
  align-items: center;
  /* 菜单图标使用辅助浅色，不抢导航项层级。 */
  color: #cbd5e3;
}

.app-navbar__drawer-close {
  /* 建立向左收回的图标命令，不使用文本符号或关闭叉号。 */
  width: 32px;
  height: 32px;
  /* 使用 Flex 精确居中 Element UI 左箭头。 */
  display: inline-flex;
  /* 水平居中收回箭头。 */
  justify-content: center;
  /* 垂直居中收回箭头。 */
  align-items: center;
  /* 清除原生按钮和旧方框边界。 */
  border: 0;
  /* 使用项目克制圆角，仅在 hover 时显示轻量表面。 */
  border-radius: 4px;
  /* 默认融入抽屉头部，不增加独立容器背景。 */
  background: transparent;
  color: #ffffff;
  cursor: pointer;
}

/*
  作用容器: 抽屉收回按钮悬停状态。
  样式作用: 使用轻量背景提示可点击，不改变图标、边界或按钮尺寸。
*/
.app-navbar__drawer-close:hover {
  /* 增强当前收回命令但保持扁平结构。 */
  background: rgba(255, 255, 255, 0.1);
}

.app-navbar__drawer-close:focus-visible {
  /* 用主题轮廓表达键盘焦点。 */
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/*
  作用容器: 移动端抽屉遮罩 `.app-navbar__backdrop`。
  样式作用: 抽屉打开时遮住页面其它区域，点击后只关闭抽屉。
*/
.app-navbar__backdrop {
  /* 固定在第一行导航以下，避免遮住仍可见的品牌和数据源入口。 */
  position: fixed;
  top: var(--app-navbar-primary-row-height);
  right: 0;
  bottom: 0;
  left: 0;
  border: 0;
  background: rgba(5, 12, 24, 0.5);
  cursor: pointer;
  z-index: calc(var(--app-navbar-z-index) + 1);
}

/*
  作用容器: 一级导航列表 `.app-navbar__menu`。
  样式作用:
  窄屏纵向展示同一组路由按钮，宽屏断点切换为横向排列。
*/
.app-navbar__menu {
  /* 使用 Flex 组织唯一导航按钮树。 */
  display: flex;
  /* 窄屏第二行横向展示优先入口。 */
  flex-direction: row;
  /* 入口之间使用轻量间距。 */
  gap: 2px;
  /* 允许动态上下文优先于固定入口。 */
  overflow-x: auto;
  scrollbar-width: none;
  /* 允许菜单在父级宽度内收缩。 */
  min-width: 0;
}

/*
  作用容器: 桌面导航列表。
  样式作用: 移动优先阶段不渲染到视觉树，宽屏断点再显示正式桌面投影。
*/
.app-navbar__menu--desktop {
  /* 窄屏只展示移动第二行和抽屉共用列表。 */
  display: none;
}

/*
  作用容器: 移动导航列表。
  样式作用: 使用纯展示模型已经生成的播放、详情、搜索优先顺序，不再通过 CSS order 改写。
*/
.app-navbar__menu--mobile {
  /* 移动第二行横向显示完整优先导航。 */
  display: flex;
}

.app-navbar__menu--mobile::-webkit-scrollbar {
  /* 隐藏第二行横向滚动条，保留触摸和滚轮滚动能力。 */
  display: none;
}

/*
  作用容器: 抽屉内移动导航列表。
  样式作用: 保持与移动第二行完全相同的 DOM 顺序，只改变排列方向。
*/
.app-navbar__collapse--open .app-navbar__menu--mobile {
  /* 抽屉打开后恢复全量纵向导航。 */
  flex-direction: column;
  /* 抽屉不需要横向滚动。 */
  overflow: visible;
  /* 使用稳定纵向间距。 */
  gap: 4px;
}

/*
  作用容器: 抽屉内统一导航项根节点。
  样式作用: 所有入口占满抽屉宽度，顺序继续来自 mobileNavItems。
*/
.app-navbar__collapse--open .app-navbar-item {
  /* 抽屉入口使用完整可用宽度。 */
  width: 100%;
  /* 禁止 Flex 压缩导航命令。 */
  flex: 0 0 auto;
}

/*
  作用容器: 项目透明 PNG Logo。
  样式作用: 完整等比显示用户确认资源，不追加前置图标或第二份文字。
*/
.app-navbar__project-logo {
  /* 使用命名高度令牌适配桌面和移动第一行。 */
  height: var(--app-navbar-project-logo-height);
  /* 按原始宽高比自动计算宽度。 */
  width: auto;
  /* 防止图片基线在按钮底部产生空隙。 */
  display: block;
  /* 完整显示透明资源，不裁切。 */
  object-fit: contain;
}

/*
  作用容器: 顶部搜索表单 `.app-navbar__search`。
  样式作用:
  横向组合输入框和提交图标，窄屏占满导航面板宽度。
*/
.app-navbar__search {
  /* 放入移动端第一行的搜索区域。 */
  grid-area: search;
  /* 横向排列输入框和按钮。 */
  display: flex;
  /* 保持控件垂直对齐。 */
  align-items: center;
  /* 窄屏使用全部可用宽度。 */
  width: 100%;
  /* 允许表单随父级收缩。 */
  min-width: 0;
}

/*
  作用容器: 搜索输入框 `.app-navbar__search-input`。
  样式作用:
  在深色导航中提供清晰输入表面，并把剩余宽度交给关键词。
*/
.app-navbar__search-input {
  /* 占据提交按钮之外的剩余宽度。 */
  flex: 1 1 auto;
  /* 允许输入框在窄视口正确收缩。 */
  min-width: 0;
  /* 使用稳定控件高度。 */
  height: 38px;
  /* 提供关键词左右阅读留白。 */
  padding: 0 14px;
  /* 使用高对比浅色输入背景。 */
  background: #ffffff;
  /* 预留透明边框，聚焦时不改变尺寸。 */
  border: 1px solid transparent;
  /* 左侧使用克制圆角并与按钮衔接。 */
  border-radius: 6px 0 0 6px;
  /* 使用深色输入文字。 */
  color: #172033;
  /* 移除原生轮廓，由下方焦点规则表达。 */
  outline: none;
  /* 把边框和内边距纳入固定高度。 */
  box-sizing: border-box;
}

/*
  作用容器: 搜索输入框焦点状态。
  样式作用:
  使用边框和外圈表达当前输入位置，不改变控件尺寸。
*/
.app-navbar__search-input:focus {
  /* 使用主题色标记输入焦点。 */
  border-color: var(--accent);
  /* 添加轻量外圈增强深色背景上的可见性。 */
  box-shadow: 0 0 0 2px rgba(79, 124, 255, 0.18);
}

/*
  作用容器: 搜索提交按钮 `.app-navbar__search-button`。
  样式作用:
  使用图标表达明确提交命令，并与输入框组成一个控件。
*/
.app-navbar__search-button {
  /* 使用稳定图标按钮宽度。 */
  width: 46px;
  /* 与输入框保持相同高度。 */
  height: 38px;
  /* 建立图标居中布局。 */
  display: inline-flex;
  /* 水平居中搜索图标。 */
  justify-content: center;
  /* 垂直居中搜索图标。 */
  align-items: center;
  /* 清除额外内边距。 */
  padding: 0;
  /* 使用主题色背景突出提交动作。 */
  background: var(--accent);
  /* 边框跟随主题色形成完整轮廓。 */
  border: 1px solid var(--accent);
  /* 右侧使用与输入框对应的圆角。 */
  border-radius: 0 6px 6px 0;
  /* 图标使用白色保证对比。 */
  color: #ffffff;
  /* 鼠标设备显示可点击反馈。 */
  cursor: pointer;
}

/*
  作用容器: 搜索提交按钮悬停状态。
  样式作用:
  轻微降低亮度表达鼠标交互，不改变尺寸和位置。
*/
.app-navbar__search-button:hover {
  /* 使用滤镜保持主题色体系并提供悬停反馈。 */
  filter: brightness(0.94);
}

/*
  作用容器: 搜索提交按钮键盘焦点。
  样式作用:
  让键盘用户明确当前提交命令位置。
*/
.app-navbar__search-button:focus-visible {
  /* 使用浅色焦点轮廓与蓝色按钮区分。 */
  outline: 2px solid #ffffff;
  /* 让轮廓与按钮边缘分离。 */
  outline-offset: 2px;
}

/*
  作用容器: 游客用户操作区 `.app-navbar__user`。
  样式作用:
  横向排列状态与账号动作，窄屏保持左对齐和可换行能力。
*/
.app-navbar__user {
  /* 放入移动端第一行的登录或头像区域。 */
  grid-area: user;
  /* 横向排列游客状态和按钮。 */
  display: flex;
  /* 保持内容垂直居中。 */
  align-items: center;
  /* 账号入口始终占满当前导航行高，与相邻导航保持同一垂直节奏。 */
  align-self: stretch;
  /* 未登录和登录后都保持单行，不制造额外容器高度。 */
  flex-wrap: nowrap;
}

/*
  作用容器: 登录后的用户入口 `.app-navbar__user-authenticated`。
  样式作用:
  为头像按钮和下拉菜单建立同一定位上下文。
*/
.app-navbar__user-authenticated {
  /* 让用户菜单相对头像按钮定位。 */
  position: relative;
  /* 允许内容按按钮自然宽度展示。 */
  min-width: 0;
  /* 登录后身份入口与当前导航行同高。 */
  height: 100%;
}

/*
  作用容器: 登录后用户按钮。
  样式作用:
  横向排列头像、用户名和箭头，保持深色导航中的紧凑身份入口。
*/
.app-navbar__user-button--profile {
  /* 建立头像、名称和箭头的横向布局。 */
  display: inline-flex;
  /* 保持三个元素垂直居中。 */
  align-items: center;
  /* 使用紧凑内部间距。 */
  gap: 7px;
  /* 登录后默认保持透明，只有 hover 或展开状态提供轻量背景。 */
  background: transparent;
}

/*
  作用容器: 已展开用户菜单的身份入口。
  样式作用: 使用轻量表面反馈菜单状态，不变成蓝色胶囊。
*/
.app-navbar__user-button--open {
  /* 展开状态比普通 hover 略深，表达菜单仍由当前按钮拥有。 */
  background: rgba(255, 255, 255, 0.12);
}

/*
  作用容器: 游客用户头像 `.app-navbar__avatar`。
  样式作用:
  使用共享圆形品牌图表达已登录状态，不新增第二套用户图片资源。
*/
.app-navbar__avatar {
  /* 建立稳定圆形头像宽度。 */
  width: 24px;
  /* 建立稳定圆形头像高度。 */
  height: 24px;
  /* 建立用户图标水平垂直居中的独立身份容器。 */
  display: inline-flex;
  /* 水平居中 Element UI 用户图标。 */
  justify-content: center;
  /* 垂直居中 Element UI 用户图标。 */
  align-items: center;
  /* 使用完整圆角形成中性用户头像。 */
  border-radius: 50%;
  /* 使用轻量半透明表面区分头像和项目 Logo。 */
  background: rgba(255, 255, 255, 0.12);
  /* 用户图标继承浅色身份入口颜色。 */
  color: #ffffff;
  /* 防止头像在紧凑用户按钮中被压缩。 */
  flex: 0 0 24px;
}

/*
  作用容器: 登录后用户名。
  样式作用:
  保持单行并允许窄屏按 CSS 断点隐藏文字，只保留头像入口。
*/
.app-navbar__user-name {
  /* 防止用户名换行改变导航高度。 */
  white-space: nowrap;
}

/*
  作用容器: 登录后用户菜单 `.app-navbar__user-menu`。
  样式作用:
  在头像按钮下方展示个人中心和退出两个明确命令。
*/
.app-navbar__user-menu {
  /* 相对用户入口向下浮动。 */
  position: absolute;
  /* 从按钮下边缘开始并留出轻量间距。 */
  top: calc(100% + 8px);
  /* 与用户按钮右边缘对齐。 */
  right: 0;
  /* 让菜单宽度足够容纳两个命令。 */
  min-width: 132px;
  /* 使用浅色菜单表面。 */
  background: #ffffff;
  /* 使用中性边界区分导航背景。 */
  border: 1px solid #d9e0ea;
  /* 使用项目克制圆角。 */
  border-radius: 6px;
  /* 使用轻量投影建立浮层层级。 */
  box-shadow: 0 12px 28px rgba(12, 24, 43, 0.22);
  /* 为菜单按钮保留外边距。 */
  padding: 6px;
  /* 保证菜单覆盖普通导航内容。 */
  z-index: 24;
}

/*
  作用容器: 用户菜单命令。
  样式作用:
  提供完整行点击面积和清晰文字层级。
*/
.app-navbar__user-menu button {
  /* 让每个命令占满菜单宽度。 */
  width: 100%;
  /* 清除原生按钮边框。 */
  border: 0;
  /* 默认使用透明表面。 */
  background: transparent;
  /* 使用深色菜单文字。 */
  color: #253047;
  /* 提供稳定点击面积。 */
  padding: 9px 10px;
  /* 使用紧凑圆角表达当前命令范围。 */
  border-radius: 4px;
  /* 文案按阅读起点对齐。 */
  text-align: left;
  /* 继承项目字体。 */
  font-family: inherit;
  /* 使用导航辅助字号。 */
  font-size: 14px;
  /* 鼠标设备显示可点击反馈。 */
  cursor: pointer;
}

/*
  作用容器: 用户菜单命令悬停和键盘焦点。
  样式作用:
  用背景强调当前可执行命令，不改变尺寸。
*/
.app-navbar__user-menu button:hover,
.app-navbar__user-menu button:focus-visible {
  /* 使用浅蓝背景标记当前命令。 */
  background: #eef3fb;
  /* 清除原生焦点轮廓，背景承担反馈。 */
  outline: none;
}

/*
  作用容器: 登录和 Guest 用户入口 `.app-navbar__user-button`。
  样式作用:
  使用透明、同行高的导航命令表达账号状态，不增加蓝色胶囊或独立边框。
*/
.app-navbar__user-button {
  /* 横向排列 Guest 头像、文字和箭头；未登录只有文字。 */
  display: inline-flex;
  /* 保持账号内容垂直居中。 */
  align-items: center;
  /* 保持账号内容水平居中。 */
  justify-content: center;
  /* 登录后内部元素使用稳定间距。 */
  gap: 6px;
  /* 默认完全透明，导航背景承担统一表面。 */
  background: transparent;
  /* 清除独立按钮边框。 */
  border: 0;
  /* 使用浅色导航文字。 */
  color: #ffffff;
  /* 点击区域与当前导航行同高。 */
  height: 100%;
  /* 提供稳定左右点击空间。 */
  padding: 0 12px;
  /* 导航入口不生成胶囊圆角。 */
  border-radius: 0;
  /* 使用导航辅助字号。 */
  font-size: 14px;
  /* 使用中等字重保证扫描效率。 */
  font-weight: 600;
  /* 继承项目字体。 */
  font-family: inherit;
  /* 鼠标设备显示可点击反馈。 */
  cursor: pointer;
}

/*
  作用容器: 用户按钮悬停状态。
  样式作用:
  提供轻量交互反馈且不改变布局。
*/
.app-navbar__user-button:hover {
  /* 使用轻量背景表达可点击，不改变文字、尺寸或边框。 */
  background: rgba(255, 255, 255, 0.08);
}

/*
  作用容器: 用户按钮键盘焦点。
  样式作用:
  为键盘用户显示清晰操作位置。
*/
.app-navbar__user-button:focus-visible {
  /* 使用主题焦点色绘制轮廓。 */
  outline: 2px solid var(--accent);
  /* 让轮廓与按钮边界分离。 */
  outline-offset: 2px;
}

/*
  断点: 1200px 及以上，展开完整桌面全局导航。
  影响范围: 主导航品牌、数据源选择、共享 collapse、路由菜单、搜索和用户区。
  布局变化: 汉堡按钮隐藏；唯一 collapse 子节点进入父网格单行排列，并使用紧凑宽度预算容纳全部一级路由。
*/
@media (min-width: 1200px) {
  /*
    作用容器: 宽屏导航主体。
    样式作用: 禁止换行并保持所有功能在共享导航高度内。
  */
  .app-navbar {
    /* 宽屏导航使用完整项目 Logo 的正式显示高度。 */
    --app-navbar-project-logo-height: 52px;
    /* 按品牌、路由、数据源、搜索和用户区建立固定职责顺序。 */
    grid-template-columns: auto auto auto minmax(150px, 1fr) auto;
    /* 同一组件树在桌面落入单行语义区域。 */
    grid-template-areas: 'brand menu source search user';
    /* 建立桌面功能区之间的横向节奏。 */
    column-gap: clamp(8px, 0.8vw, 16px);
  }

  /*
    作用容器: 宽屏折叠按钮。
    样式作用: 隐藏不需要的汉堡入口，路由树仍只存在一份。
  */
  .app-navbar__toggler {
    /* 宽屏隐藏折叠命令。 */
    display: none;
  }

  /*
    作用容器: 宽屏移动导航内容。
    样式作用: 桌面使用独立桌面顺序投影，移动第二行和抽屉容器不进入视觉树。
  */
  .app-navbar__collapse {
    /* 宽屏完全隐藏移动列表和抽屉，不复制移动顺序到桌面语义树。 */
    display: none;
  }

  .app-navbar__backdrop {
    /* 桌面完整导航不显示移动抽屉遮罩。 */
    display: none;
  }

  /*
    作用容器: 桌面全局数据源选择。
    样式作用: 在路由菜单之后按阅读顺序左对齐，不沿用窄屏靠近 toggler 的右对齐方式。
  */
  .app-navbar > .source-navbar-selector {
    /* 桌面网格中从自身区域起点展开。 */
    justify-self: start;
  }

  /*
    作用容器: 宽屏一级菜单。
    样式作用: 将同一按钮树横向排列并保持单行。
  */
  .app-navbar__menu--desktop {
    /* 放入桌面网格的路由菜单区域。 */
    grid-area: menu;
    /* 宽屏显示路由 meta.nav.order 生成的正式桌面投影。 */
    display: flex;
    /* 宽屏沿主轴横向排列。 */
    flex-direction: row;
    /* 宽屏按钮间距交给按钮内边距，保持导航紧凑。 */
    gap: 0;
    /* 禁止一级入口换行。 */
    flex-wrap: nowrap;
    /* 菜单按内容自然占宽并允许父网格决定剩余空间。 */
    min-width: 0;
    /* 桌面菜单不需要第二行横向滚动。 */
    overflow: visible;
  }

  /*
    作用容器: 宽屏统一导航项根节点。
    样式作用: 使用共享导航高度形成整行点击区域，内部按钮继续由统一组件负责。
  */
  .app-navbar__menu--desktop .app-navbar-item {
    /* 与固定导航首行保持相同高度。 */
    height: var(--app-navbar-height);
  }

  /*
    作用容器: 宽屏搜索表单。
    样式作用: 吃掉菜单和用户区之间的剩余空间，同时限制过长输入框。
  */
  .app-navbar__search {
    /* 放入桌面网格的搜索区域。 */
    grid-area: search;
    /* 限制超宽屏输入框长度，提高扫描效率。 */
    max-width: 620px;
  }

  /*
    作用容器: 宽屏用户区。
    样式作用: 保持账号动作单行并贴近导航右侧。
  */
  .app-navbar__user {
    /* 放入桌面网格的用户区域。 */
    grid-area: user;
    /* 宽屏不换行，避免固定栏高度抖动。 */
    flex-wrap: nowrap;
    /* 用户区按内容自然占宽。 */
    width: max-content;
    /* 宽屏账号入口使用完整单行导航高度。 */
    height: var(--app-navbar-height);
  }
}

/*
  断点: 1400px 及以上，对应 Bootstrap xxl 宽桌面档。
  影响范围: 项目品牌 Logo。
  布局变化: 宽桌面利用额外横向预算提高透明 PNG 的可见尺寸；1200px 档继续使用 52px，避免挤压完整导航。
*/
@media (min-width: 1400px) {
  .app-navbar {
    /* 宽桌面提高 Logo 画布高度，使透明边距内的真实图形更接近 64px 导航行视觉高度。 */
    --app-navbar-project-logo-height: 62px;
  }
}

/*
  断点: 小于 576px，采用 Bootstrap sm 以下的紧凑控件密度。
  影响范围: 固定导航首行、品牌、toggler 和展开面板。
  布局变化: 使用 575.98px 上限覆盖小数 CSS 像素，只缩小安全边距和控件尺寸，不改变路由树、折叠行为或功能顺序。
*/
@media (max-width: 575.98px) {
  /*
    作用容器: 手机导航主体。
    样式作用: 使用更紧凑水平安全边距，为内容留出宽度。
  */
  .app-navbar {
    /* 缩小手机共享水平安全边距，首行与数据源浮层继续使用同一边界。 */
    --app-navbar-inline-padding: 10px;
    /* 普通手机放大完整项目 Logo，同时给搜索和数据源保留可收缩空间。 */
    --app-navbar-project-logo-height: 36px;
    /* 普通手机抽屉约占四分之三视口并限制绝对宽度，保留可见页面上下文。 */
    --app-navbar-drawer-width: min(300px, 78vw);
    /* 契约截断后的数据源名称按内容自然占宽，搜索框使用剩余空间。 */
    grid-template-columns: auto max-content minmax(0, 1fr) auto;
    /* 缩小首行控件间距，避免 320px 视口产生横向溢出。 */
    column-gap: 6px;
  }

  .app-navbar__search-input {
    /* 手机使用紧凑输入高度。 */
    height: 34px;
    /* 收紧关键词左右留白。 */
    padding: 0 8px;
    /* 使用紧凑字号并允许占位文本自然裁切。 */
    font-size: 12px;
  }

  .app-navbar__search-button {
    /* 手机搜索图标按钮使用稳定紧凑宽度。 */
    width: 34px;
    /* 与手机搜索输入保持相同高度。 */
    height: 34px;
  }

  .app-navbar__user-button {
    /* 手机未登录继续显示“登录”文字，并保持稳定最小点击宽度。 */
    min-width: 40px;
    /* 手机首行使用紧凑左右留白。 */
    padding: 0 8px;
  }

  .app-navbar__user-button--profile {
    /* 手机登录后只保留中性用户头像入口。 */
    min-width: 34px;
    /* 头像入口不需要文字留白。 */
    padding: 0;
  }

  .app-navbar__user-name,
  .app-navbar__user-arrow {
    /* 手机登录后使用头像状态，完整 Guest 身份和命令仍在点击后的菜单中。 */
    display: none;
  }

  /*
    作用容器: 手机折叠按钮。
    样式作用: 适配更短首行，同时保持可操作面积。
  */
  .app-navbar__toggler {
    /* 缩小按钮宽度以匹配手机密度。 */
    width: 38px;
    /* 缩小按钮高度以匹配手机密度。 */
    height: 38px;
  }

  /*
    作用容器: 手机已展开导航面板。
    样式作用: 收紧上下留白但保留全部入口。
  */
  .app-navbar__collapse--open {
    /* 使用更紧凑面板上边距。 */
    padding-top: 8px;
    /* 使用更紧凑面板下边距。 */
    padding-bottom: 12px;
  }
}

/*
  断点: 小于 360px，对应项目验收中的最小手机档。
  影响范围: 移动主导航抽屉。
  布局变化: 抽屉使用约五分之三视口宽度，让 320px 屏仍保留清晰页面上下文和遮罩点击区。
*/
@media (max-width: 359.98px) {
  .app-navbar {
    /* 最小手机档按用户确认比例固定为视口五分之三，不沿用普通手机宽抽屉。 */
    --app-navbar-drawer-width: 60vw;
  }
}
</style>
