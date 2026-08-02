<template>
  <!--
    AppNavbar 顶部导航组件渲染树

    [DEFAULT] ele(div.navbar-wrapper)
    │  - condition: 应用挂载后始终渲染。
    │  - type: 原生 div。
    │  - description: 固定在视口顶部的全宽导航背景和层级容器。
    │  - params: 无。
    │  - events: 无。
    │
    └─ [DEFAULT] ele(header.app-navbar)
       │  - condition: 根导航存在时默认渲染。
       │  - type: 原生 header。
       │  - description: 组合品牌、全局数据源选择、折叠按钮和唯一共享导航内容。
       │  - params: -- isSourceMenuOpen 控制数据源菜单；-- isNavigationOpen 控制窄屏折叠面板。
       │  - events: 无。
       │
       ├─ [DEFAULT] ele(button.app-navbar__brand)
       │  - condition: 所有视口始终渲染。
       │  - type: 原生 button。
       │  - description: 紧凑 WVP 品牌按钮，点击进入首页。
       │  - params: 无。
       │  - events: @click -> handleNavClick({ name: 'home' })。
       │
       ├─ [DEFAULT] ele(SourceNavbarSelector)
       │  - condition: 所有路由和视口始终渲染。
       │  - type: 自定义组件，相对位置 ../source/SourceNavbarSelector.vue。
       │  - description: 展示全局数据源下拉、当前活动源和实时健康状态。
       │  - params: -- menuOpen 由 AppNavbar 统一控制。
       │  - events: @toggle-menu -> toggleSourceMenu()；@close-menu -> closeSourceMenu()。
       │
       ├─ [DEFAULT] ele(button.app-navbar__toggler)
       │  - condition: DOM 始终存在，CSS 仅在 1200px 以下显示。
       │  - type: 原生 button，内部使用 CSS 三横线装饰图标。
       │  - description: 控制同一导航内容区域向下展开或收起。
       │  - params: -- isNavigationOpen 同步 aria-expanded 和选中样式。
       │  - events: @click -> toggleNavigation()。
       │
       └─ [DEFAULT] ele(div.app-navbar__collapse)
          │  - condition: DOM 始终存在；宽屏展开，窄屏由 isNavigationOpen 控制可见性。
          │  - type: 原生 div。
          │  - description: 唯一导航内容容器，不复制桌面和手机入口树。
          │  - params: -- isNavigationOpen 控制 app-navbar__collapse--open。
          │  - events: 无。
          │
          ├─ [DEFAULT] ele(nav.app-navbar__menu)
          │  │  - condition: navItems 循环渲染全部一级入口。
          │  │  - type: 原生 nav。
          │  │  - description: 展示路由 meta.nav 声明的八个一级页面入口。
          │  │  - params: -- navItems；-- activePage。
          │  │  - events: 无。
          │  └─ [DEFAULT] ele(button.app-navbar__item)
          │     - condition: 每个 navItems 条目渲染一次。
          │     - type: 原生 button。
          │     - description: 提交命名路由导航并表达当前页面状态。
          │     - params: -- item.key/label/navRouteName/routeLocation；-- activePage。
          │     - events: @click -> handleNavClick(item)，按标签页最近 fullPath 导航。
          │
          ├─ [DEFAULT] ele(form.app-navbar__search)
          │  │  - condition: 导航内容显示时始终渲染。
          │  │  - type: 原生 form。
          │  │  - description: 提交全站搜索关键词并进入搜索页。
          │  │  - params: -- searchKeyword。
          │  │  - events: @submit -> handleSearchSubmit()。
          │  ├─ [DEFAULT] ele(input.app-navbar__search-input)
          │  │  - condition: 搜索表单存在时渲染。
          │  │  - type: 原生 search input。
          │  │  - description: 收集用户关键词。
          │  │  - params: -- searchKeyword 通过 v-model.trim 绑定。
          │  │  - events: 无。
          │  └─ [DEFAULT] ele(button.app-navbar__search-button)
          │     - condition: 搜索表单存在时渲染。
          │     - type: 原生 submit button。
          │     - description: 使用搜索图标提交当前表单。
          │     - params: 无。
          │     - events: 原生 submit 由父表单处理。
          │
          └─ [DEFAULT] ele(div.app-navbar__user)
             │  - condition: 当前游客阶段始终渲染。
             │  - type: 原生 div。
             │  - description: 展示游客状态以及登录、注册占位入口。
             │  - params: 无。
             │  - events: 无。
             ├─ [DEFAULT] ele(span.app-navbar__guest-tag)
             │  - condition: 当前没有登录系统时渲染。
             │  - type: 原生 span。
             │  - description: 标识当前游客模式。
             │  - params: 无。
             │  - events: 无。
             └─ [DEFAULT] ele(button.app-navbar__user-button)
                - condition: 登录和注册命令各渲染一个按钮。
                - type: 原生 button。
                - description: 当前阶段进入个人中心占位页。
                - params: 无。
                - events: @click -> handleNavClick({ name: 'profile' })。
  -->
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
        - description: 作为第一视线品牌和首页快捷入口。
        - params: 无。
        - events: @click -> handleNavClick({ name: 'home' })。
      -->
      <button
        type="button"
        class="app-navbar__brand"
        aria-label="返回首页"
        @click="handleNavClick({ name: 'home' })"
      >
        WVP
      </button>

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
        - condition: 宽屏由 CSS 常驻展开；窄屏由 isNavigationOpen 控制。
        - type: 原生 div。
        - description: 承载唯一菜单、搜索和用户区，窄屏向下展开且限制在视口内滚动。
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
          - condition: navItems 有条目时循环渲染；空数组时保留空导航语义容器。
          - type: 原生 nav。
          - description: 桌面横排、窄屏纵排的同一组一级路由入口。
          - params: -- navItems；-- activePage。
          - events: 无。
        -->
        <nav class="app-navbar__menu" aria-label="主导航">
          <!--
            [DEFAULT] ele(button.app-navbar__item)
            - condition: 每个 navItems 条目渲染一次，顺序来自 meta.nav.order。
            - type: 原生 button。
            - description: 跳转目标命名路由，参数型页面通过会话历史恢复最近完整地址。
            - params: -- item.key/label/navRouteName/routeLocation；-- activePage。
            - events: @click -> handleNavClick(item)。
          -->
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            class="app-navbar__item"
            :class="{ 'app-navbar__item--active': item.navRouteName === activePage }"
            :aria-current="item.navRouteName === activePage ? 'page' : null"
            @click="handleNavClick(item)"
          >
            {{ item.label }}
          </button>
        </nav>

        <!--
          [DEFAULT] ele(form.app-navbar__search)
          - condition: 导航内容存在时始终渲染。
          - type: 原生 form。
          - description: 组合关键词输入和图标提交按钮。
          - params: -- searchKeyword。
          - events: @submit.prevent -> handleSearchSubmit()。
        -->
        <form class="app-navbar__search" role="search" @submit.prevent="handleSearchSubmit">
          <!--
            [DEFAULT] ele(input.app-navbar__search-input)
            - condition: 搜索表单存在时渲染。
            - type: 原生 search input。
            - description: 保存当前搜索关键词并支持回车提交。
            - params: -- searchKeyword 通过 v-model.trim 双向绑定。
            - events: 无。
          -->
          <input
            v-model.trim="searchKeyword"
            class="app-navbar__search-input"
            type="search"
            placeholder="请输入搜索关键字"
            aria-label="搜索关键字"
          />
          <!--
            [DEFAULT] ele(button.app-navbar__search-button)
            - condition: 搜索表单存在时渲染。
            - type: 原生 submit button。
            - description: 提交关键词，内部图标只承担视觉提示。
            - params: 无。
            - events: 原生 submit 由父表单统一处理。
          -->
          <button type="submit" class="app-navbar__search-button" aria-label="搜索">
            <i class="el-icon-search" aria-hidden="true"></i>
          </button>
        </form>

        <!--
          [DEFAULT] ele(div.app-navbar__user)
          - condition: 当前游客阶段始终渲染。
          - type: 原生 div。
          - description: 集中放置游客状态和两个账号占位动作。
          - params: 无。
          - events: 无。
        -->
        <div class="app-navbar__user">
          <!--
            [DEFAULT] ele(span.app-navbar__guest-tag)
            - condition: 当前没有登录系统时渲染。
            - type: 原生 span。
            - description: 显示当前身份模式，不承担操作。
            - params: 无。
            - events: 无。
          -->
          <span class="app-navbar__guest-tag">游客模式</span>
          <!--
            [DEFAULT] ele(button.app-navbar__user-button)
            - condition: 登录和注册各渲染一次。
            - type: 原生 button。
            - description: 当前阶段统一进入个人中心占位页。
            - params: 无。
            - events: @click -> handleNavClick({ name: 'profile' })。
          -->
          <button type="button" class="app-navbar__user-button" @click="handleNavClick({ name: 'profile' })">
            登录
          </button>
          <button type="button" class="app-navbar__user-button" @click="handleNavClick({ name: 'profile' })">
            注册
          </button>
        </div>
      </div>
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

  - 导入库及文件汇总(3 条，内置 0 条，第三方 0 条，自定义 3 条):
      routes: 自定义路由表，用于派生导航名称、顺序和命名路由位置。
      routeSessionHistory: 自定义标签页路由历史门面，用于恢复一级入口最近地址。
      SourceNavbarSelector: 自定义组件，用于渲染全局数据源下拉和当前源实时状态。

  - 模块级常量:
      无

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

export default {
  // 组件名称: AppNavbar；用途: Vue Devtools 和 App.vue 组件注册识别。
  name: 'AppNavbar',

  /*
    components 注册当前模板中使用的自定义组件。
    注册名必须与模板标签和顶部渲染树保持一致。
  */
  components: {
    // 组件: SourceNavbarSelector 全局数据源选择组件。
    // 作用: 承载候选加载、实时状态投影和 Runtime 原子切换交互。
    SourceNavbarSelector
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
      // 类型: string；来源: 用户输入；作用: 顶部搜索表单提交的关键词，初始为空。
      searchKeyword: '',
      // 类型: boolean；true 展开窄屏共享导航面板，false 收起；由 toggler 和路由变化修改。
      isNavigationOpen: false,
      // 类型: boolean；true 展示全局数据源候选菜单，false 隐藏；由选择器事件、主菜单和路由变化修改。
      isSourceMenuOpen: false
    };
  },

  computed: {
    /**
     * 从标准路由表派生可见一级导航入口。
     * 纯函数: 只读取 routes 配置并返回新数组，不修改路由顺序或组件状态。
     * 成功路径: 按 meta.nav.order 返回 key、label、一级命名路由和静态入口位置。
     * 失败路径: 没有声明 meta.nav 的路由时返回空数组，模板不猜测入口。
     *
     * @returns {Array<object>} 唯一一级导航展示数组。
     */
    navItems() {
      // 类型: Array<object>；作用: 保存显式声明 meta.nav 的一级路由，meta.nav 存在即必须显示。
      const navRoutes = routes.filter((route) => {
        // 返回值类型: boolean；true 表示路由拥有正式一级入口，false 表示它只是上下文或重定向路由。
        return Boolean(route.meta && route.meta.nav);
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
            routeLocation: { name: route.name }
          };
        });
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
    }
  },

  methods: {
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
      // 执行内容: 先关闭数据源菜单，保证固定导航同一时刻只有一个展开区域。
      if (nextNavigationOpen) {
        this.isSourceMenuOpen = false;
      }
      // 副作用: 写入唯一主导航折叠状态，不操作 DOM 高度或读取视口宽度。
      this.isNavigationOpen = nextNavigationOpen;
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
      // 执行内容: 关闭主导航折叠面板，避免两个可展开区域同时占用视口。
      if (nextSourceMenuOpen) {
        this.isNavigationOpen = false;
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
  /* 建立固定首行三列和折叠内容第二行的唯一 Grid 布局。 */
  display: grid;
  /* 品牌和 toggler 按内容占宽，数据源区使用中间可收缩空间。 */
  grid-template-columns: auto minmax(0, 1fr) auto;
  /* 首行放品牌、数据源区和 toggler，折叠内容独占第二行。 */
  grid-template-areas:
    'brand source toggler'
    'collapse collapse collapse';
  /* 让首行三个入口在共享导航高度内垂直居中。 */
  align-items: center;
  /* 使用紧凑列间距分隔首行入口。 */
  column-gap: 10px;
  /* 保持固定栏横向铺满。 */
  width: 100%;
  /* 使用根外壳定义的导航高度建立稳定首行。 */
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
  /* 移除额外内边距，让品牌宽度由文本自然决定。 */
  padding: 0;
  /* 使用浅色品牌文字保证深色背景可读性。 */
  color: #ffffff;
  /* 使用明确字号形成品牌层级。 */
  font-size: 20px;
  /* 加粗品牌缩写，避免与导航项混淆。 */
  font-weight: 800;
  /* 字母间距保持默认零值，符合项目排版约束。 */
  letter-spacing: 0;
  /* 继承项目字体。 */
  font-family: inherit;
  /* 防止品牌文字换行。 */
  white-space: nowrap;
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
  /* 让折叠内容在窄屏占满首行下方网格区域。 */
  grid-area: collapse;
  /* 占满第二行可用宽度。 */
  width: 100%;
  /* 使用 Grid 纵向组织三个功能区。 */
  display: grid;
  /* 收起时不保留行间距。 */
  gap: 0;
  /* 收起时高度为零，不遮挡页面交互。 */
  max-height: 0;
  /* 收起时隐藏内容溢出。 */
  overflow: hidden;
  /* 收起时从辅助视觉树隐藏，但 DOM 仍为同一棵导航。 */
  visibility: hidden;
  /* 收起时关闭指针交互。 */
  pointer-events: none;
  /* 收起时透明，展开变化更平顺。 */
  opacity: 0;
  /* 对高度、透明度和可见性进行短时过渡。 */
  transition: max-height 0.22s ease, opacity 0.18s ease, visibility 0.18s ease;
}

/*
  作用容器: 已展开共享导航 `.app-navbar__collapse--open`。
  样式作用:
  在首行下方展示唯一功能树，并把最大高度限制在剩余视口。
  内容过长时内部滚动，固定导航不会把底部命令推出可达范围。
*/
.app-navbar__collapse--open {
  /* 为菜单、搜索和用户区建立一致纵向节奏。 */
  gap: 12px;
  /* 限制展开面板不超过导航首行之外的剩余视口。 */
  max-height: calc(100vh - var(--app-navbar-height));
  /* 允许窄屏纵向滚动访问全部入口。 */
  overflow-y: auto;
  /* 展开后恢复可见性。 */
  visibility: visible;
  /* 展开后恢复指针交互。 */
  pointer-events: auto;
  /* 展开后恢复不透明。 */
  opacity: 1;
  /* 提供面板上下留白，避免内容贴近固定栏边界。 */
  padding: 12px 0 16px;
}

/*
  作用容器: 一级导航列表 `.app-navbar__menu`。
  样式作用:
  窄屏纵向展示同一组路由按钮，宽屏断点切换为横向排列。
*/
.app-navbar__menu {
  /* 使用 Flex 组织唯一导航按钮树。 */
  display: flex;
  /* 窄屏从上到下排列入口。 */
  flex-direction: column;
  /* 入口之间使用轻量间距。 */
  gap: 4px;
  /* 允许菜单在父级宽度内收缩。 */
  min-width: 0;
}

/*
  作用容器: 单个一级导航按钮 `.app-navbar__item`。
  样式作用:
  提供完整行触摸面积和稳定当前态，宽屏再转为紧凑横向按钮。
*/
.app-navbar__item {
  /* 清除原生按钮背景。 */
  background: transparent;
  /* 清除原生按钮边框。 */
  border: 0;
  /* 提供窄屏完整行的纵横点击空间。 */
  padding: 10px 12px;
  /* 使用浅色文字保证深色面板可读性。 */
  color: #dbe4ef;
  /* 使用适合导航的紧凑字号。 */
  font-size: 15px;
  /* 使用中等字重保证扫描效率。 */
  font-weight: 600;
  /* 继承项目字体。 */
  font-family: inherit;
  /* 保持按钮文案单行。 */
  white-space: nowrap;
  /* 窄屏按阅读起点左对齐。 */
  text-align: left;
  /* 使用克制圆角表达交互范围。 */
  border-radius: 5px;
  /* 鼠标设备显示可点击反馈。 */
  cursor: pointer;
  /* 只过渡颜色属性，避免布局移动。 */
  transition: color 0.18s ease, background-color 0.18s ease;
}

/*
  作用容器: 一级导航悬停状态。
  样式作用:
  提示鼠标用户当前可点击入口，不改变按钮尺寸。
*/
.app-navbar__item:hover {
  /* 提高悬停文字亮度。 */
  color: #ffffff;
  /* 使用半透明背景标记指针位置。 */
  background: rgba(255, 255, 255, 0.08);
}

/*
  作用容器: 当前一级导航 `.app-navbar__item--active`。
  样式作用:
  同时使用文字和背景表达当前页面，避免只依赖单一颜色。
*/
.app-navbar__item--active {
  /* 使用暖色强调当前入口。 */
  color: #f3c45d;
  /* 使用深浅差异强化当前状态。 */
  background: rgba(0, 0, 0, 0.22);
}

/*
  作用容器: 一级导航键盘焦点。
  样式作用:
  为键盘浏览完整菜单提供稳定焦点标识。
*/
.app-navbar__item:focus-visible {
  /* 使用主题色绘制焦点轮廓。 */
  outline: 2px solid var(--accent);
  /* 把焦点收在按钮附近但不遮挡文字。 */
  outline-offset: 1px;
}

/*
  作用容器: 顶部搜索表单 `.app-navbar__search`。
  样式作用:
  横向组合输入框和提交图标，窄屏占满导航面板宽度。
*/
.app-navbar__search {
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
  /* 横向排列游客状态和按钮。 */
  display: flex;
  /* 保持内容垂直居中。 */
  align-items: center;
  /* 允许极窄屏自然换行，不裁切操作。 */
  flex-wrap: wrap;
  /* 使用稳定控件间距。 */
  gap: 10px;
}

/*
  作用容器: 游客状态 `.app-navbar__guest-tag`。
  样式作用:
  用文字状态说明当前身份，不增加额外卡片边界。
*/
.app-navbar__guest-tag {
  /* 使用辅助字号降低视觉重量。 */
  font-size: 13px;
  /* 使用暖色与当前导航状态呼应。 */
  color: #f3c45d;
  /* 提高状态文字可读性。 */
  font-weight: 700;
  /* 保持状态文字单行。 */
  white-space: nowrap;
}

/*
  作用容器: 登录和注册按钮 `.app-navbar__user-button`。
  样式作用:
  提供紧凑账号占位动作，尺寸不随文案变化。
*/
.app-navbar__user-button {
  /* 使用浅色按钮表面。 */
  background: #ffffff;
  /* 边框跟随按钮表面。 */
  border: 1px solid #ffffff;
  /* 使用深色文字保证对比。 */
  color: #172033;
  /* 使用紧凑但可点击的高度。 */
  height: 32px;
  /* 提供稳定左右点击空间。 */
  padding: 0 14px;
  /* 使用项目克制圆角。 */
  border-radius: 6px;
  /* 使用辅助操作字号。 */
  font-size: 13px;
  /* 使用中等字重。 */
  font-weight: 600;
  /* 继承项目字体。 */
  font-family: inherit;
  /* 鼠标设备显示可点击反馈。 */
  cursor: pointer;
}

/*
  作用容器: 首个用户按钮。
  样式作用:
  把登录表达为当前游客区的主要动作，与注册形成主次层级。
*/
.app-navbar__user-button:first-of-type {
  /* 使用主题色突出登录。 */
  background: var(--accent);
  /* 边框跟随主题色。 */
  border-color: var(--accent);
  /* 使用白色文字保证对比。 */
  color: #ffffff;
}

/*
  作用容器: 用户按钮悬停状态。
  样式作用:
  提供轻量交互反馈且不改变布局。
*/
.app-navbar__user-button:hover {
  /* 轻微降低亮度表达可点击状态。 */
  filter: brightness(0.95);
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
    作用容器: 宽屏共享导航内容。
    样式作用: 把同一 DOM 切换为常驻横向 Flex，不读取 JavaScript 视口状态。
  */
  .app-navbar__collapse {
    /* 让唯一 collapse 的三个真实子节点直接参加父级桌面网格，不复制节点。 */
    display: contents;
    /* 取消窄屏收起高度限制。 */
    max-height: none;
    /* 宽屏不使用内部滚动。 */
    overflow: visible;
    /* 宽屏始终可见。 */
    visibility: visible;
    /* 宽屏始终可交互。 */
    pointer-events: auto;
    /* 宽屏始终不透明。 */
    opacity: 1;
    /* 移除窄屏面板内边距。 */
    padding: 0;
    /* 宽屏没有折叠动画。 */
    transition: none;
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
  .app-navbar__menu {
    /* 放入桌面网格的路由菜单区域。 */
    grid-area: menu;
    /* 宽屏沿主轴横向排列。 */
    flex-direction: row;
    /* 宽屏按钮间距交给按钮内边距，保持导航紧凑。 */
    gap: 0;
    /* 禁止一级入口换行。 */
    flex-wrap: nowrap;
    /* 菜单按内容自然占宽并允许父网格决定剩余空间。 */
    min-width: 0;
  }

  /*
    作用容器: 宽屏一级导航按钮。
    样式作用: 使用共享导航高度形成整行点击区域并居中文字。
  */
  .app-navbar__item {
    /* 使用稳定横向内边距控制导航密度。 */
    padding: 0 clamp(6px, 0.65vw, 10px);
    /* 与固定导航首行保持相同高度。 */
    height: var(--app-navbar-height);
    /* 宽屏文字水平居中。 */
    text-align: center;
    /* 宽屏整高按钮不使用局部圆角。 */
    border-radius: 0;
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
  }

  /*
    作用容器: 手机品牌文字。
    样式作用: 降低字号以匹配更短导航高度。
  */
  .app-navbar__brand {
    /* 使用紧凑品牌字号。 */
    font-size: 18px;
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
</style>
