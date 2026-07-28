<template>
  <!--
    AppNavbar 顶部导航组件渲染树

    [DEFAULT] ele(div.navbar-wrapper)
    │  - condition:
    │      默认渲染。
    │      顶部导航需要在所有静态页面上保持常驻展示。
    │  - type:
    │      原生标签
    │      标签名称: div
    │  - description:
    │      导航外层包装容器。
    │      承载整条深色导航背景，让桌面和手机导航按断点切换展示结构。
    │  - params:
    │      无
    │  - events:
    │      无
    │
    └─ [DEFAULT] ele(header.app-navbar)
       │  - condition:
       │      默认渲染。
       │      按左侧菜单、中间搜索、右侧用户操作三段横向布局。
       │  - type:
       │      原生标签
       │      标签名称: header
       │  - description:
       │      顶部主导航栏。
       │      使用原生 flex 布局，让左侧左对齐、中间居中、右侧右对齐。
       │  - params:
       │      无
       │  - events:
       │      无
       │
       ├─ [DEFAULT] ele(div.app-navbar__left)
       │  │  - condition:
       │  │      默认渲染。
       │  │      左侧主导航入口在导航栏左边缘安全区域内展示。
       │  │  - type:
       │  │      原生标签
       │  │      标签名称: div
       │  │  - description:
       │  │      左侧导航列。
       │  │      负责把主要页面入口固定在导航栏左侧。
       │  │  - params:
       │  │      无
       │  │  - events:
       │  │      无
       │  │
       │  ├─ [DEFAULT] ele(nav.app-navbar__menu.app-navbar__menu--desktop)
       │  │  │  - condition:
       │  │  │      默认渲染，由 CSS 在视口宽于 640px 时显示，在手机视口下隐藏。
       │  │  │      navItems 有数据时通过 v-for 展示桌面主导航按钮。
       │  │  │  - type:
       │  │  │      原生标签
       │  │  │      标签名称: nav
       │  │  │  - description:
       │  │  │      桌面主导航菜单。
       │  │  │      展示路由明确声明的七个全局入口；播放页必须从真实内容上下文进入。
       │  │  │  - params:
       │  │  │      -- navItems：顶部主导航按钮列表，每项包含 key、label 和 routeLocation。
       │  │  │      -- activePage：由当前路由 meta.topNavName 或路由名称计算得到，用于让设置子路由继续高亮设置入口。
       │  │  │  - events:
       │  │  │      无
       │  │  │
       │  │  └─ [DEFAULT] ele(button.app-navbar__item)
       │  │     - condition:
       │  │         默认渲染。
       │  │         每个 navItems 条目渲染一个桌面主导航按钮。
       │  │     - type:
       │  │         原生标签
       │  │         标签名称: button
       │  │     - description:
       │  │         桌面主导航按钮。
       │  │         点击后读取当前导航项的 routeLocation，并通过 vue-router 跳转到对应页面。
       │  │     - params:
       │  │         -- item.key：导航项唯一标识，用于 v-for 渲染稳定识别。
       │  │         -- item.label：导航按钮展示文案。
       │  │         -- item.routeLocation：vue-router 跳转位置对象，用于声明目标命名路由。
       │  │     - events:
       │  │         @click
       │  │             - description:
       │  │                 用户点击某个桌面导航入口时触发。
       │  │                 用于把当前导航项的路由位置对象交给 vue-router 跳转。
       │  │             - methods:
       │  │                 handleNavClick(item.routeLocation)
       │  │                     -- item.routeLocation：被点击导航项对应的 vue-router 跳转位置对象。
       │  │
       │  └─ [DEFAULT] ele(el-dropdown.app-navbar__mobile-nav)
       │     │  - condition:
       │     │      默认渲染，由 CSS 在视口不超过 640px 时显示，在更宽视口下隐藏。
       │     │      与桌面导航共用 navItems，不建立第二份页面入口配置。
       │     │  - type:
       │     │      第三方组件
       │     │      组件库: Element UI
       │     │      组件名称: el-dropdown
       │     │  - description:
       │     │      手机主导航下拉组件。
       │     │      使用菜单图标和当前页面名称承载全部页面入口，替代被裁切的横向菜单。
       │     │  - params:
       │     │      -- currentNavLabel：当前命名路由对应的页面名称。
       │     │      -- isMobileNavOpen：下拉菜单展开状态，用于同步 aria-expanded。
       │     │      -- navItems：与桌面导航共用的页面入口数组。
       │     │  - events:
       │     │      @command
       │     │          - description:
       │     │              用户选择某个手机菜单项时触发。
       │     │              把菜单项命名路由位置对象交给现有导航方法。
       │     │          - methods:
       │     │              handleNavClick(item.routeLocation)
       │     │                  -- item.routeLocation：被选中菜单项对应的 vue-router 跳转位置对象。
       │     │      @visible-change
       │     │          - description:
       │     │              手机菜单展开或收起时触发。
       │     │              用于同步触发按钮向辅助技术暴露的展开状态。
       │     │          - methods:
       │     │              handleMobileNavVisibleChange(visible)
       │     │                  -- visible：boolean，手机菜单当前是否可见。
       │     │
       │     ├─ [DEFAULT] ele(button.app-navbar__mobile-trigger)
       │     │  - condition:
       │     │      默认渲染，跟随手机下拉组件的响应式显示状态。
       │     │  - type:
       │     │      原生标签
       │     │      标签名称: button
       │     │  - description:
       │     │      手机导航触发按钮。
       │     │      展示菜单图标、当前页面名称和展开箭头。
       │     │  - params:
       │     │      -- currentNavLabel：当前页面名称。
       │     │      -- isMobileNavOpen：用于生成 aria-expanded 的菜单状态。
       │     │  - events:
       │     │      无
       │     │
       │     └─ [DEFAULT] ele(el-dropdown-menu.app-navbar__mobile-menu)
       │        │  - condition:
       │        │      默认渲染，由 Element UI 在手机导航展开时显示。
       │        │  - type:
       │        │      第三方组件
       │        │      组件库: Element UI
       │        │      组件名称: el-dropdown-menu
       │        │  - description:
       │        │      手机主导航菜单面板。
       │        │      按 navItems 顺序展示完整页面入口。
       │        │  - params:
       │        │      -- navItems：手机菜单项数据来源。
       │        │      -- activePage：用于标记当前页面菜单项。
       │        │  - events:
       │        │      无
       │        │
       │        └─ [DEFAULT] ele(el-dropdown-item.app-navbar__mobile-item)
       │           - condition:
       │               默认渲染，每个 navItems 条目生成一个菜单项。
       │           - type:
       │               第三方组件
       │               组件库: Element UI
       │               组件名称: el-dropdown-item
       │           - description:
       │               手机导航菜单项。
       │               选择后通过 command 把命名路由位置对象交给 el-dropdown。
       │           - params:
       │               -- item.key：导航项唯一标识。
       │               -- item.label：菜单项展示文案。
       │               -- item.routeLocation：目标命名路由位置对象。
       │           - events:
       │               无
       │
       ├─ [DEFAULT] ele(div.app-navbar__center)
       │  │  - condition:
       │  │      默认渲染。
       │  │      搜索区在导航栏中间区域居中展示。
       │  │  - type:
       │  │      原生标签
       │  │      标签名称: div
       │  │  - description:
       │  │      中间搜索列。
       │  │      负责把全局搜索控件稳定放在导航栏水平中心附近。
       │  │  - params:
       │  │      无
       │  │  - events:
       │  │      无
       │  │
       │  └─ [DEFAULT] ele(form.app-navbar__search)
       │     │  - condition:
       │     │      默认渲染。
       │     │      顶部搜索框作为搜索页入口常驻展示。
       │     │  - type:
       │     │      原生标签
       │     │      标签名称: form
       │     │  - description:
       │     │      顶部搜索表单。
       │     │      用户输入关键词后提交，当前阶段跳转到搜索页并携带 keyword 查询参数。
       │     │  - params:
       │     │      -- searchKeyword：用户当前输入的搜索关键词。
       │     │  - events:
       │     │      @submit
       │     │          - description:
       │     │              用户回车或点击搜索按钮提交表单时触发。
       │     │              当前阶段阻止浏览器默认提交并跳转到搜索页。
       │     │          - methods:
       │     │              handleSearchSubmit()
       │     │
       │     ├─ [DEFAULT] ele(input.app-navbar__search-input)
       │     │  - condition:
       │     │      默认渲染。
       │     │      搜索表单展示时同步展示关键词输入框。
       │     │  - type:
       │     │      原生标签
       │     │      标签名称: input
       │     │  - description:
       │     │      搜索关键词输入框。
       │     │      保存用户输入内容，后续接真实搜索时作为搜索请求关键词来源。
       │     │  - params:
       │     │      -- searchKeyword：通过 v-model.trim 双向绑定当前输入值。
       │     │  - events:
       │     │      无
       │     │
       │     └─ [DEFAULT] ele(button.app-navbar__search-button)
       │        - condition:
       │            默认渲染。
       │            搜索输入框右侧展示提交按钮。
       │        - type:
       │            原生标签
       │            标签名称: button
       │        - description:
       │            搜索提交按钮。
       │            使用图标形式减少中间列宽度占用，并保留 aria-label 给辅助技术。
       │        - params:
       │            无
       │        - events:
       │            无
       │
       └─ [DEFAULT] ele(div.app-navbar__right)
          │  - condition:
          │      默认渲染。
          │      用户状态和账号入口在导航栏右边缘安全区域内展示。
          │  - type:
          │      原生标签
          │      标签名称: div
          │  - description:
          │      右侧用户列。
          │      负责把游客状态、登录和注册入口固定在导航栏右侧。
          │  - params:
          │      无
          │  - events:
          │      无
          │
          └─ [DEFAULT] ele(div.app-navbar__user)
             │  - condition:
             │      默认渲染。
             │      当前静态阶段始终展示游客态用户入口。
             │  - type:
             │      原生标签
             │      标签名称: div
             │  - description:
             │      用户状态按钮组。
             │      后续接入登录模块时可在这里切换游客态和登录态。
             │  - params:
             │      无
             │  - events:
             │      无
             │
             ├─ [DEFAULT] ele(span.app-navbar__guest-tag)
             │  - condition:
             │      默认渲染。
             │      当前阶段没有真实登录状态时显示游客模式。
             │  - type:
             │      原生标签
             │      标签名称: span
             │  - description:
             │      游客模式状态标签。
             │      提示用户当前处于未登录占位状态。
             │  - params:
             │      无
             │  - events:
             │      无
             │
             ├─ [DEFAULT] ele(button.app-navbar__user-button.login)
             │  - condition:
             │      默认渲染。
             │      登录入口在游客模式下展示。
             │  - type:
             │      原生标签
             │      标签名称: button
             │  - description:
             │      登录入口按钮。
             │      当前静态阶段点击后先进入个人中心页占位。
             │  - params:
             │      无
             │  - events:
             │      @click
             │          - description:
             │              用户点击登录按钮时触发。
             │              当前阶段先跳转到个人中心页，后续再替换为登录弹窗。
             │          - methods:
             │              handleNavClick({ name: 'profile' })
             │                  -- name：个人中心命名路由标识 profile。
             │
             └─ [DEFAULT] ele(button.app-navbar__user-button.register)
                - condition:
                    默认渲染。
                    注册入口在游客模式下展示。
                - type:
                    原生标签
                    标签名称: button
                - description:
                    注册入口按钮。
                    当前静态阶段点击后先进入个人中心页占位。
                - params:
                    无
                - events:
                    @click
                        - description:
                            用户点击注册按钮时触发。
                            当前阶段先跳转到个人中心页，后续再替换为注册弹窗。
                        - methods:
                            handleNavClick({ name: 'profile' })
                                -- name：个人中心命名路由标识 profile。
  -->
  <!--
    [DEFAULT] ele(div.navbar-wrapper)
    - condition:
        默认渲染。
        AppNavbar 被 App.vue 挂载后始终展示顶部导航外层。
    - type:
        原生标签
        标签名称: div
    - description:
        导航外层包装容器。
        提供整条顶部导航的深色背景和横向安全边界。
    - params:
        无
    - events:
        无
  -->
  <div class="navbar-wrapper">
    <!--
      [DEFAULT] ele(header.app-navbar)
      - condition:
          默认渲染。
          用三段 flex 列组织导航条主体内容。
      - type:
          原生标签
          标签名称: header
      - description:
          全站主导航栏。
          左侧菜单左对齐，中间搜索居中，右侧用户入口右对齐。
      - params:
          无
      - events:
          无
    -->
    <header class="app-navbar">
      <!--
        [DEFAULT] ele(div.app-navbar__left)
        - condition:
            默认渲染。
            主导航入口需要固定在导航栏左侧区域。
        - type:
            原生标签
            标签名称: div
        - description:
            左侧导航列。
            负责承载首页、电影、电视剧、个人中心和设置入口。
        - params:
            无
        - events:
            无
      -->
      <div class="app-navbar__left">
        <!--
          [DEFAULT] ele(nav.app-navbar__menu)
          - condition:
              默认渲染，由 CSS 在视口宽于 640px 时显示，在手机视口下隐藏。
              navItems 有数据时通过 v-for 生成桌面导航按钮。
          - type:
              原生标签
              标签名称: nav
          - description:
              桌面主导航菜单。
              展示路由明确声明的七个全局入口；播放页不生成无内容身份按钮。
          - params:
              -- navItems：主导航入口数组，每项包含 key、label 和 routeLocation。
              -- activePage：由当前路由 meta.topNavName 或路由名称计算得到，用于设置激活态。
          - events:
              无
        -->
        <nav class="app-navbar__menu app-navbar__menu--desktop" aria-label="主导航">
          <!--
            [DEFAULT] ele(button.app-navbar__item)
            - condition:
                默认渲染。
                每个 navItems 条目渲染为一个主导航按钮。
            - type:
                原生标签
                标签名称: button
            - description:
                主导航按钮。
                点击后通过 vue-router 让 App.vue 的 router-view 切换主体页面。
            - params:
                -- item.key：导航项唯一标识。
                -- item.label：导航展示文案。
                -- item.routeLocation：vue-router 跳转位置对象。
            - events:
                @click
                    - description:
                        用户点击导航按钮时触发。
                        用于跳转到对应静态页面路由。
                    - methods:
                        handleNavClick(item.routeLocation)
                            -- item.routeLocation：目标路由位置对象。
          -->
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            class="app-navbar__item"
            :class="{ 'app-navbar__item--active': item.routeLocation.name === activePage }"
            @click="handleNavClick(item.routeLocation)"
          >
            {{ item.label }}
          </button>
        </nav>

        <!--
          [DEFAULT] ele(el-dropdown.app-navbar__mobile-nav)
          - condition:
              默认渲染，由 CSS 在视口不超过 640px 时显示，在更宽视口下隐藏。
              navItems 有数据时通过下拉菜单完整承载全部页面入口。
          - type:
              第三方组件
              组件库: Element UI
              组件名称: el-dropdown
          - description:
              手机主导航下拉组件。
              通过菜单图标和当前页面名称提供稳定入口，不再依赖横向裁切或滚动发现后续页面。
          - params:
              -- currentNavLabel：根据当前命名路由计算出的页面名称。
              -- isMobileNavOpen：Element UI 下拉菜单当前展开状态，用于同步 aria-expanded。
              -- navItems：与桌面导航共用的路由入口数组。
          - events:
              @command
                  - description:
                      用户选择某个下拉菜单项时触发。
                      直接把菜单项携带的命名路由位置对象交给现有导航方法。
                  - methods:
                      handleNavClick(item.routeLocation)
                          -- item.routeLocation：被选中导航项对应的 vue-router 跳转位置对象。
              @visible-change
                  - description:
                      Element UI 下拉菜单展开或收起时触发。
                      用于让菜单按钮的 aria-expanded 与真实可见状态同步。
                  - methods:
                      handleMobileNavVisibleChange(visible)
                          -- visible：boolean，true 表示菜单展开，false 表示菜单收起。
        -->
        <el-dropdown
          ref="mobileNavDropdown"
          class="app-navbar__mobile-nav"
          trigger="click"
          placement="bottom-start"
          @command="handleNavClick"
          @visible-change="handleMobileNavVisibleChange"
        >
          <!--
            [DEFAULT] ele(button.app-navbar__mobile-trigger)
            - condition:
                默认渲染，跟随 app-navbar__mobile-nav 的响应式显示状态。
            - type:
                原生标签
                标签名称: button
            - description:
                手机导航菜单触发按钮。
                展示菜单图标和当前页面名称，并向辅助技术声明菜单展开状态。
            - params:
                -- currentNavLabel：当前命名路由对应的导航名称。
                -- isMobileNavOpen：控制 aria-expanded 的布尔状态。
            - events:
                无
          -->
          <button
            type="button"
            class="app-navbar__mobile-trigger"
            aria-label="打开主导航菜单"
            aria-haspopup="menu"
            :aria-expanded="String(isMobileNavOpen)"
          >
            <!--
              [DEFAULT] ele(i.el-icon-menu.app-navbar__mobile-trigger-icon)
              - condition:
                  手机导航触发按钮渲染时默认显示。
              - type:
                  原生标签
                  标签名称: i
              - description:
                  菜单图标，使用全局 Element UI 图标字体表达完整导航入口。
              - params:
                  无
              - events:
                  无
            -->
            <i class="el-icon-menu app-navbar__mobile-trigger-icon" aria-hidden="true"></i>
            <span class="app-navbar__mobile-trigger-label">{{ currentNavLabel }}</span>
            <!--
              [DEFAULT] ele(i.el-icon-arrow-down.app-navbar__mobile-trigger-arrow)
              - condition:
                  手机导航触发按钮渲染时默认显示。
              - type:
                  原生标签
                  标签名称: i
              - description:
                  下拉箭头图标，提示按钮会展开菜单且不承担独立交互。
              - params:
                  无
              - events:
                  无
            -->
            <i class="el-icon-arrow-down app-navbar__mobile-trigger-arrow" aria-hidden="true"></i>
          </button>

          <!--
            [DEFAULT] ele(el-dropdown-menu.app-navbar__mobile-menu)
            - condition:
                默认渲染，由 Element UI 在触发按钮展开时显示到弹层中。
            - type:
                第三方组件
                组件库: Element UI
                组件名称: el-dropdown-menu
            - description:
                手机主导航菜单面板。
                循环展示与桌面导航相同的 navItems，保证全部页面入口在手机上可发现。
            - params:
                -- navItems：顶部导航入口数组，每项包含 key、label 和 routeLocation。
                -- activePage：当前命名路由，用于标记当前页面菜单项。
            - events:
                无
          -->
          <el-dropdown-menu slot="dropdown" class="app-navbar__mobile-menu">
            <!--
              [DEFAULT] ele(el-dropdown-item.app-navbar__mobile-item)
              - condition:
                  默认渲染，每个 navItems 条目生成一个手机菜单项。
              - type:
                  第三方组件
                  组件库: Element UI
                  组件名称: el-dropdown-item
              - description:
                  手机主导航菜单项。
                  command 携带命名路由位置对象，选择后由 el-dropdown 统一派发给 handleNavClick。
              - params:
                  -- item.key：导航项唯一标识，用于 v-for 稳定渲染。
                  -- item.label：菜单项展示文案。
                  -- item.routeLocation：菜单选择后需要跳转的命名路由位置对象。
              - events:
                  无
            -->
            <el-dropdown-item
              v-for="item in navItems"
              :key="'mobile-' + item.key"
              class="app-navbar__mobile-item"
              :class="{ 'app-navbar__mobile-item--active': item.routeLocation.name === activePage }"
              :command="item.routeLocation"
              :aria-current="item.routeLocation.name === activePage ? 'page' : null"
            >
              {{ item.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </el-dropdown>
      </div>

      <!--
        [DEFAULT] ele(div.app-navbar__center)
        - condition:
            默认渲染。
            搜索区域需要在导航栏水平中间保持居中。
        - type:
            原生标签
            标签名称: div
        - description:
            中间搜索列。
            通过独立 flex 列稳定控制搜索框宽度和居中位置。
        - params:
            无
        - events:
            无
      -->
      <div class="app-navbar__center">
        <!--
          [DEFAULT] ele(form.app-navbar__search)
          - condition:
              默认渲染。
              搜索表单作为搜索页入口常驻展示。
          - type:
              原生标签
              标签名称: form
          - description:
              顶部搜索表单。
              当前静态阶段提交后跳转到搜索页，后续再接入真实搜索关键词。
          - params:
              -- searchKeyword：当前输入的搜索关键词。
          - events:
              @submit
                  - description:
                      用户回车或点击搜索按钮提交时触发。
                      阻止浏览器默认刷新并跳转到搜索页。
                  - methods:
                      handleSearchSubmit()
        -->
        <form class="app-navbar__search" role="search" @submit.prevent="handleSearchSubmit">
          <!--
            [DEFAULT] ele(input.app-navbar__search-input)
            - condition:
                默认渲染。
                搜索表单展示时同步展示输入框。
            - type:
                原生标签
                标签名称: input
            - description:
                搜索关键词输入框。
                保存用户当前输入，后续接真实搜索时作为关键词来源。
            - params:
                -- searchKeyword：通过 v-model.trim 同步用户输入值。
            - events:
                无
          -->
          <input
            v-model.trim="searchKeyword"
            class="app-navbar__search-input"
            type="search"
            placeholder="请输入搜索关键字"
            aria-label="搜索关键字"
          >

          <!--
            [DEFAULT] ele(button.app-navbar__search-button)
            - condition:
                默认渲染。
                搜索输入框右侧展示提交按钮。
            - type:
                原生标签
                标签名称: button
            - description:
                搜索提交按钮。
                使用图标按钮保持顶部搜索视觉紧凑，并减少横向文字占位。
            - params:
                无
            - events:
                无
          -->
          <button type="submit" class="app-navbar__search-button" aria-label="搜索">
          <!--
            [DEFAULT] ele(i.el-icon-search)
            - condition:
                搜索提交按钮渲染时默认显示。
            - type:
                原生标签
                标签名称: i
            - description:
                搜索图标，使用 Element UI 图标字体但不创建第三方组件实例。
            - params:
                无
            - events:
                无
          -->
            <i class="el-icon-search" aria-hidden="true"></i>
          </button>
        </form>
      </div>

      <!--
        [DEFAULT] ele(div.app-navbar__right)
        - condition:
            默认渲染。
            用户状态入口需要固定在导航栏右侧区域。
        - type:
            原生标签
            标签名称: div
        - description:
            右侧用户列。
            承载游客状态、登录和注册入口，并保持右对齐。
        - params:
            无
        - events:
            无
      -->
      <div class="app-navbar__right">
        <!--
          [DEFAULT] ele(div.app-navbar__user)
          - condition:
              默认渲染。
              当前静态阶段始终展示游客态按钮组。
          - type:
              原生标签
              标签名称: div
          - description:
              用户状态按钮组。
              为后续登录态切换预留导航右侧空间。
          - params:
              无
          - events:
              无
        -->
        <div class="app-navbar__user">
          <!--
            [DEFAULT] ele(span.app-navbar__guest-tag)
            - condition:
                默认渲染。
                当前阶段没有真实登录态时展示游客模式。
            - type:
                原生标签
                标签名称: span
            - description:
                游客状态标签。
                用金色提示当前是未登录占位状态。
            - params:
                无
            - events:
                无
          -->
          <span class="app-navbar__guest-tag">游客模式</span>

          <!--
            [DEFAULT] ele(button.app-navbar__user-button.login)
            - condition:
                默认渲染。
                登录入口在游客态按钮组中展示。
            - type:
                原生标签
                标签名称: button
            - description:
                登录入口按钮。
                当前阶段点击后进入个人中心占位页。
            - params:
                无
            - events:
                @click
                    - description:
                        用户点击登录按钮时触发。
                        当前阶段先切换到个人中心页，后续接登录弹窗。
                    - methods:
                        handleNavClick({ name: 'profile' })
                            -- name：个人中心命名路由标识 profile。
          -->
          <button
            type="button"
            class="app-navbar__user-button"
            @click="handleNavClick({ name: 'profile' })"
          >
            登录
          </button>

          <!--
            [DEFAULT] ele(button.app-navbar__user-button.register)
            - condition:
                默认渲染。
                注册入口在游客态按钮组中展示。
            - type:
                原生标签
                标签名称: button
            - description:
                注册入口按钮。
                当前阶段点击后进入个人中心占位页。
            - params:
                无
            - events:
                @click
                    - description:
                        用户点击注册按钮时触发。
                        当前阶段先切换到个人中心页，后续接注册弹窗。
                    - methods:
                        handleNavClick({ name: 'profile' })
                            -- name：个人中心命名路由标识 profile。
          -->
          <button
            type="button"
            class="app-navbar__user-button"
            @click="handleNavClick({ name: 'profile' })"
          >
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
      从 Router 的 meta.nav 派生全站顶部入口，并协调桌面、手机导航和搜索跳转。
      播放页不声明 meta.nav，因此本组件不会构造缺少 sourceId 和 videoId 的播放入口。

  - 导入库及文件汇总(1 条，内置 0 条，第三方 0 条，自定义 1 条):
      routes，自定义路由表，用于从 route.meta.nav 派生顶部导航按钮。

  - 模块级常量:
      MOBILE_NAV_MEDIA_QUERY: string，手机导航结构使用的媒体查询条件。

  - 模块级变量:
      无

  - 模块级辅助函数:
      无

  - 模块级类:
      无

  - 对外导出:
      AppNavbar: Vue component，供 App.vue 渲染全站顶部导航、搜索和用户入口。
*/

// 导入来源: ../../router/routes。
// 导入内容: routes 标准 Vue Router 路由表。
// 文件作用: 读取路由 meta.nav 配置，生成顶部导航需要的 key、label 和 routeLocation。
import { routes } from '../../router/routes';

// 类型: string。
// 作用: 统一声明手机导航的断点监听条件，窗口跨出 640px 时用于关闭已经展开的下拉弹层。
const MOBILE_NAV_MEDIA_QUERY = '(max-width: 640px)';

/**
 * 全站顶部导航组件。
 *
 * 组件职责：
 * - 渲染首页、电影、电视剧、搜索、详情、个人中心和设置七个全局入口。
 * - 使用原生 flex 建立左侧导航、中间搜索、右侧用户操作的顶部布局。
 * - 在手机视口使用 Element UI 下拉菜单承载完整导航，并与桌面导航共享路由配置。
 * - 提供顶部搜索框的静态交互入口，提交后跳转到搜索页。
 * - 保留用户状态区的布局位置，方便后续接入登录状态。
 * - 不直接管理页面内容，只通过 vue-router 把切换意图转换为正式路由。
 */
export default {
  // 组件名称用于在调试工具和报错信息中识别顶部导航组件。
  name: 'AppNavbar',

  /**
   * 创建当前组件实例的局部交互状态。
   * 副作用: 每个 AppNavbar 实例获得独立输入值、菜单状态和媒体查询引用，不读取 Router 或操作 DOM。
   * 成功路径: 返回搜索框、手机菜单和断点监听所需的完整初始状态。
   * 失败路径: 本函数不执行异步操作，也不主动抛错。
   *
   * @returns {object} 当前导航组件实例的初始局部状态。
   */
  data() {
    return {
      // 类型: string。
      // 初始值: 空字符串，表示页面首次渲染时搜索框没有输入内容。
      // 作用: 绑定顶部搜索输入框，后续接真实搜索时作为搜索关键词来源。
      searchKeyword: '',

      // 类型: boolean。
      // 初始值: false，表示手机下拉导航首次渲染时处于收起状态。
      // 作用: 同步 Element UI 下拉菜单真实可见状态，并驱动触发按钮的 aria-expanded。
      // true: 手机导航菜单已经展开，辅助技术应告知用户菜单处于打开状态。
      // false: 手机导航菜单已经收起，辅助技术应告知用户菜单处于关闭状态。
      isMobileNavOpen: false,

      // 类型: MediaQueryList | null。
      // 初始值: null，表示组件挂载前尚未建立浏览器断点监听。
      // 作用: 保存手机导航媒体查询对象，用于注册和清理跨断点状态同步监听器。
      mobileNavMediaQuery: null
    };
  },

  computed: {
    /**
     * 从标准路由表派生当前全局导航入口。
     * 纯函数: 只读取冻结路由配置，过滤无 meta.nav 的详情上下文入口，不修改 Router 或组件状态。
     * 成功路径: 按 order 返回模板需要的 key、label 和命名路由位置。
     * 失败路径: 路由没有可见 nav 时返回空数组，模板保持空导航而不生成猜测入口。
     *
     * @returns {Array<object>} 当前可见全局入口的模板投影。
     */
    navItems() {
      // 类型: Array<object>。
      // 作用: 过滤出显式声明参与顶部导航的路由规则。
      const visibleNavRoutes = routes.filter((route) => {
        // 返回 true 表示当前路由存在 meta.nav 且 visible 为 true，需要展示在顶部导航中。
        return route.meta && route.meta.nav && route.meta.nav.visible;
      });

      // 先按 meta.nav.order 排序，再转换为模板渲染需要的 key、label 和 routeLocation。
      return visibleNavRoutes
        .sort((leftRoute, rightRoute) => {
          // 类型: number；作用: 左侧路由排序值，用于和右侧路由排序值比较。
          const leftOrder = leftRoute.meta.nav.order;

          // 类型: number；作用: 右侧路由排序值，用于控制数字更小的导航项排在更前面。
          const rightOrder = rightRoute.meta.nav.order;

          // 返回排序差值，升序排列顶部导航入口。
          return leftOrder - rightOrder;
        })
        .map((route) => {
          // 返回导航模板需要的数据结构，保持 key + label + routeLocation 三段式配置。
          return {
            key: route.meta.nav.key,
            label: route.meta.nav.label,
            routeLocation: {
              name: route.name
            }
          };
        });
    },

    /**
     * 计算当前路由所属的顶部导航入口。
     * 设置子路由通过 meta.topNavName 归属设置入口，普通页面使用自身命名路由。
     * 未知路由使用 home 兜底，保证导航高亮状态稳定。
     * 纯函数: 只读取当前路由元信息，不跳转路由或修改局部状态。
     *
     * @returns {string} 当前应高亮的顶部导航标识。
     */
    activePage() {
      // 类型: string | undefined。
      // 作用: 设置子路由通过 meta.topNavName 声明归属 settings；普通页面没有该字段时继续使用自身路由名称。
      const topNavName = this.$route.meta && this.$route.meta.topNavName;

      // 当前路由有顶部归属时优先使用；否则使用命名路由，兜底 home 避免未知路由高亮状态为空。
      return topNavName || this.$route.name || 'home';
    },

    /**
     * 计算手机导航触发按钮需要展示的当前页面名称。
     * 数据来源: navItems 和 activePage，确保手机文案与桌面导航、路由 meta.nav 使用同一份配置。
     * 纯函数: 只派生展示文案，不修改路由、组件状态或菜单数据。
     *
     * @returns {string} 当前命名路由对应的导航名称；未匹配时返回“导航”。
     */
    currentNavLabel() {
      // 类型: object | undefined。
      // 作用: 从统一导航入口中查找当前命名路由，避免手机端另建页面名称映射。
      const activeNavItem = this.navItems.find((item) => {
        // 返回 true 表示当前导航项的命名路由与 activePage 一致，应作为手机触发按钮文案来源。
        return item.routeLocation.name === this.activePage;
      });

      // 条件分支: activeNavItem 存在时使用真实导航名称，否则使用稳定兜底文案。
      // 作用: 未知路由或重定向过渡期间也让触发按钮保持可读文本。
      return activeNavItem ? activeNavItem.label : '导航';
    }
  },

  /**
   * Vue mounted 生命周期。
   * 执行时机: 组件已经挂载到真实 DOM，Element UI 下拉组件 ref 和 window.matchMedia 均可使用。
   * 执行内容: 建立 640px 手机导航媒体查询监听，窗口放宽到桌面结构时主动关闭下拉弹层。
   * 放置原因: 断点监听依赖浏览器 window 对象和已经挂载的下拉组件实例。
   * 副作用: 创建一个 MediaQueryList 并注册一条 change 监听，由 beforeDestroy 对称清理。
   *
   * @returns {void} 生命周期钩子只注册浏览器事件监听，不返回业务数据。
   */
  mounted() {
    // 类型: MediaQueryList。
    // 作用: 监听当前视口是否仍处于手机导航范围，避免弹层跨断点残留到桌面结构。
    this.mobileNavMediaQuery = window.matchMedia(MOBILE_NAV_MEDIA_QUERY);

    // 条件分支: 浏览器支持标准 MediaQueryList.addEventListener 时进入。
    // 执行内容: 使用标准 change 事件注册断点监听。
    if (typeof this.mobileNavMediaQuery.addEventListener === 'function') {
      // 副作用: 视口跨过 640px 时调用组件方法同步下拉菜单状态。
      this.mobileNavMediaQuery.addEventListener('change', this.handleMobileNavBreakpointChange);
      return;
    }

    // 条件分支: 旧浏览器不支持 addEventListener 时进入。
    // 执行内容: 使用 MediaQueryList.addListener 保留同等断点监听能力。
    this.mobileNavMediaQuery.addListener(this.handleMobileNavBreakpointChange);
  },

  /**
   * Vue beforeDestroy 生命周期。
   * 执行时机: AppNavbar 即将销毁，浏览器断点监听仍然存在。
   * 执行内容: 移除 mounted 注册的 MediaQueryList 监听，避免组件销毁后继续响应窗口变化。
   * 放置原因: 全局浏览器监听必须和组件生命周期成对清理，防止重复挂载产生监听泄漏。
   * 副作用: 只移除当前实例持有的浏览器监听，不修改 Router 或页面业务状态。
   *
   * @returns {void} 生命周期钩子只清理浏览器事件监听，不返回业务数据。
   */
  beforeDestroy() {
    // 条件分支: mobileNavMediaQuery 仍为空时进入。
    // 执行内容: 直接返回，避免组件未完成 mounted 时访问不存在的监听对象。
    if (!this.mobileNavMediaQuery) {
      return;
    }

    // 条件分支: 浏览器支持标准 MediaQueryList.removeEventListener 时进入。
    // 执行内容: 使用和 mounted 相同的方法引用移除 change 监听。
    if (typeof this.mobileNavMediaQuery.removeEventListener === 'function') {
      // 副作用: 解除标准断点监听，组件销毁后不再接收窗口变化事件。
      this.mobileNavMediaQuery.removeEventListener('change', this.handleMobileNavBreakpointChange);
      return;
    }

    // 条件分支: 旧浏览器使用 removeListener API 时进入。
    // 执行内容: 清理兼容监听，保持不同浏览器下生命周期行为一致。
    this.mobileNavMediaQuery.removeListener(this.handleMobileNavBreakpointChange);
  },

  methods: {
    /**
     * 执行路由跳转并吞掉重复导航错误。
     * 副作用: 只调用当前 Vue Router 实例；不会修改路由表或组件业务数据。
     * 成功路径: 导航完成，或重复导航被识别后安全结束。
     * 失败路径: 非 NavigationDuplicated 错误继续抛出，交给应用错误边界处理。
     *
     * @param {{ name: string, query?: object }} routeLocation vue-router 跳转位置对象。
     * @returns {void} 只触发路由跳转，不返回业务数据。
     */
    pushRoute(routeLocation) {
      // this.$router.push 返回 Promise；重复点击当前页面时 Vue Router 3 会抛出 NavigationDuplicated。
      this.$router.push(routeLocation).catch((error) => {
        // 条件分支: Router 返回的失败不是重复导航时进入。
        // 执行内容: 继续抛出真实路由错误，避免异常被静默吞掉。
        if (error && error.name !== 'NavigationDuplicated') {
          throw error;
        }
      });
    },

    /**
     * 处理导航入口点击。
     * 副作用: 委托 pushRoute 提交一次 Router 导航，不直接修改菜单清单或页面内容。
     * 成功路径: 目标命名路由被 Router 采用。
     * 失败路径: 非重复导航错误由 pushRoute 继续传播。
     *
     * @param {{ name: string }} routeLocation 被点击导航项携带的 vue-router 跳转位置对象。
     * @returns {void} 使用导航项自身携带的路由位置对象执行跳转。
     */
    handleNavClick(routeLocation) {
      // 执行路由跳转，App.vue 内部的 router-view 会根据目标路由切换主体页面。
      this.pushRoute(routeLocation);
    },

    /**
     * 同步手机下拉导航的可见状态。
     * 触发来源: Element UI el-dropdown 的 visible-change 事件。
     * 执行内容: 把菜单展开状态写入 isMobileNavOpen，供触发按钮 aria-expanded 使用。
     * 副作用: 只修改当前组件局部 Boolean，不操作 Router 或 Element UI 私有状态。
     *
     * @param {boolean} visible Element UI 下拉菜单当前是否可见。
     * @returns {void} 只更新组件内可访问性状态，不修改路由或业务数据。
     */
    handleMobileNavVisibleChange(visible) {
      // 副作用: 统一转换为 boolean，避免第三方组件异常值进入 aria-expanded 绑定。
      this.isMobileNavOpen = Boolean(visible);
    },

    /**
     * 处理手机导航断点变化。
     * 触发来源: mounted 注册的 MediaQueryList change 事件。
     * 执行内容: 视口跨出手机范围时关闭 Element UI 下拉弹层并收口可访问性状态。
     * 副作用: 可以调用当前下拉组件公开 hide，并只修改本实例 isMobileNavOpen。
     *
     * @param {MediaQueryListEvent} event 浏览器媒体查询变化事件。
     * @returns {void} 只同步导航展示状态，不修改路由或业务数据。
     */
    handleMobileNavBreakpointChange(event) {
      // 条件分支: event.matches 为 true 时仍处于 640px 及以下手机范围。
      // 执行内容: 保留当前菜单状态，不干预手机视口内的正常展开和选择操作。
      if (event.matches) {
        return;
      }

      // 类型: VueComponent | undefined。
      // 作用: 读取已经挂载的 Element UI 下拉组件实例，用公开 hide 方法关闭弹层。
      const mobileNavDropdown = this.$refs.mobileNavDropdown;

      // 条件分支: 下拉组件存在且提供 hide 方法时进入。
      // 执行内容: 主动关闭传送到 body 的弹层，避免触发按钮隐藏后菜单仍停留在桌面视口。
      if (mobileNavDropdown && typeof mobileNavDropdown.hide === 'function') {
        // 副作用: 关闭 Element UI 下拉菜单，并触发 visible-change 同步组件状态。
        mobileNavDropdown.hide();
      }

      // 副作用: 立即收口 aria-expanded 状态，保证断点切换后辅助技术读取值准确。
      this.isMobileNavOpen = false;
    },

    /**
     * 处理顶部搜索提交。
     * 副作用: 读取并标准化当前输入后提交一次 Router 导航，不直接请求 Provider 或修改内容 store。
     * 成功路径: 进入 search 路由，并仅在有有效关键词时携带 keyword query。
     * 失败路径: Router 非重复导航失败由 pushRoute 继续传播。
     *
     * @returns {void} 跳转到搜索页，并在有关键词时写入 keyword 查询参数。
     */
    handleSearchSubmit() {
      // 类型: string。
      // 作用: 保存去掉首尾空格后的搜索关键词，避免 URL 中出现无意义空白。
      const normalizedKeyword = this.searchKeyword.trim();

      // 类型: object。
      // 作用: 只有存在有效关键词时才写入查询参数，空搜索仍然允许进入搜索页。
      const query = normalizedKeyword
        ? {
            keyword: normalizedKeyword
          }
        : {};

      // 跳转到搜索页；后续接真实搜索时 SearchResultView 可直接读取 this.$route.query.keyword。
      this.pushRoute({
        name: 'search',
        query
      });
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 导航外层包装 `.navbar-wrapper`。
  样式作用:
  承载整条顶部导航的深色背景。
  让桌面和手机导航结构按自身宽度正常参与页面布局。
  不再通过裁切溢出来隐藏不可见的导航入口。
*/
.navbar-wrapper {
  /* 设置导航外层横向铺满视口，保证深色背景覆盖整个顶部区域。 */
  width: 100%;

  /* 设置导航外层深色背景，避免内部三列布局换行时露出页面浅底。 */
  background: #172133;
}

/*
  作用容器: 顶部主导航栏 `.app-navbar`。
  样式作用:
  使用原生 flex 建立左侧菜单、中间搜索、右侧用户入口的三段横向布局。
  让左侧菜单和右侧用户区按内容占宽，中间搜索区自动吃剩余宽度。
  给导航左右保留克制安全边距，减少两侧空白并避免内容贴边。
*/
.app-navbar {
  /* 设置导航主体为 flex 容器，让左中右三列沿 x 轴排列。 */
  display: flex;

  /* 设置三列内容垂直居中，保证菜单、搜索框和用户按钮在同一水平线上。 */
  align-items: center;

  /* 设置三列之间的响应式间距为上一版两倍，让搜索框和左右内容之间更有呼吸感。 */
  gap: clamp(24px, 3.2vw, 48px);

  /* 设置导航主体横向占满外层容器，保持顶部深色栏通栏视觉。 */
  width: 100%;

  /* 设置导航最小高度，保证菜单和搜索控件有稳定点击面积。 */
  min-height: 64px;

  /* 设置左右响应式安全边距为上一版约一半，让导航内容更贴近参考图的横向密度。 */
  padding: 0 clamp(9px, 1.4vw, 22px);

  /* 设置导航主体深色背景，和外层背景一致，避免列间出现色差。 */
  background: #172133;

  /* 设置底部分割线，让顶部导航和浅色页面主体之间有清晰边界。 */
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  /* 把内边距计入总宽度，避免导航因 padding 叠加产生横向溢出。 */
  box-sizing: border-box;
}

/*
  作用容器: 左侧导航列 `.app-navbar__left`。
  样式作用:
  固定承载桌面横向菜单或手机下拉菜单触发器。
  根据当前响应式结构计算宽度，保证导航入口不被搜索区和用户区挤压。
  把剩余宽度交给中间搜索区动态伸缩。
*/
.app-navbar__left {
  /* 设置左侧列按菜单内容占宽，不再和右侧等分剩余空间，避免菜单被中间搜索框挤掉。 */
  flex: 0 1 auto;

  /* 设置左侧列为 flex 容器，让菜单组可以贴左排列。 */
  display: flex;

  /* 设置主导航菜单靠左对齐，符合用户要求的左边左对齐。 */
  justify-content: flex-start;

  /* 设置左侧列垂直居中内部菜单，保证按钮和搜索框基线稳定。 */
  align-items: center;

  /* 允许左侧列在窄屏下缩小，避免 flex 子项默认最小宽度撑爆导航。 */
  min-width: 0;
}

/*
  作用容器: 中间搜索列 `.app-navbar__center`。
  样式作用:
  固定承载顶部搜索表单。
  根据左右两侧内容宽度动态吃掉剩余空间。
  当左右两侧内容变宽时自动缩窄，不遮挡当前阶段导航入口。
*/
.app-navbar__center {
  /* 设置中间列吃掉左右两侧之后的剩余空间，让搜索框宽度成为动态结果。 */
  flex: 1 1 auto;

  /* 设置中间列为 flex 容器，用于把搜索表单居中摆放。 */
  display: flex;

  /* 设置搜索表单水平居中，让搜索框在剩余空间中保持居中。 */
  justify-content: center;

  /* 设置搜索表单垂直居中，让输入框高度和导航按钮对齐。 */
  align-items: center;

  /* 允许中间列被左右内容挤压时继续收缩，避免遮挡左侧导航和右侧用户入口。 */
  min-width: 0;
}

/*
  作用容器: 右侧用户列 `.app-navbar__right`。
  样式作用:
  固定承载游客状态、登录和注册入口。
  按右侧用户按钮组内容计算宽度。
  保证用户入口始终贴右对齐。
*/
.app-navbar__right {
  /* 设置右侧列按用户按钮组内容占宽，避免被中间搜索框压缩断行。 */
  flex: 0 0 auto;

  /* 设置右侧列为 flex 容器，方便用户按钮组靠右排列。 */
  display: flex;

  /* 设置用户按钮组靠右对齐，符合用户要求的右边右对齐。 */
  justify-content: flex-end;

  /* 设置右侧列垂直居中内部按钮组，保证按钮和搜索框在同一水平线上。 */
  align-items: center;

  /* 允许右侧列在窄屏下缩小，避免用户按钮组把页面撑出横向滚动。 */
  min-width: 0;
}

/*
  作用容器: 左侧导航入口组 `.app-navbar__menu`。
  样式作用:
  横向排列桌面端首页、电影、电视剧、个人中心和设置入口。
  维持菜单项不换行，避免顶部栏高度在桌面端抖动。
  当前桌面阶段不裁切菜单项，确保所有页面入口完整显示。
*/
.app-navbar__menu {
  /* 设置主导航菜单为 flex 容器，让所有导航按钮沿 x 轴排列。 */
  display: flex;

  /* 设置导航按钮垂直居中，让文字位于顶部栏视觉中线。 */
  align-items: center;

  /* 不额外设置菜单项间距，交给按钮内边距控制点击面积和视觉距离。 */
  gap: 0;

  /* 设置菜单宽度由全部导航项自然撑开，保证搜索、详情等全局入口可见。 */
  width: max-content;

  /* 设置菜单项不换行，桌面端保持单行导航视觉。 */
  flex-wrap: nowrap;

  /* 允许菜单完整展示全部入口，桌面端不裁切后续导航项。 */
  overflow-x: visible;

  /* 保留菜单默认滚动条策略，当前桌面布局不依赖内部滚动隐藏入口。 */
  scrollbar-width: auto;
}

/*
  作用容器: WebKit 浏览器中的左侧导航入口组滚动条。
  样式作用:
  当前布局不主动隐藏滚动条。
  菜单在桌面端应完整展示，不通过内部滚动藏住页面入口。
*/
.app-navbar__menu::-webkit-scrollbar {
  /* 恢复 WebKit 浏览器默认滚动条表现，避免用隐藏滚动条掩盖布局宽度问题。 */
  display: initial;
}

/*
  作用容器: 手机主导航下拉组件 `.app-navbar__mobile-nav`。
  样式作用:
  默认隐藏手机专用导航结构，保证宽于 640px 的视口继续使用桌面横向菜单。
  限制组件宽度不超过左侧导航列，为手机触发按钮提供稳定边界。
*/
.app-navbar__mobile-nav {
  /* 默认不展示手机下拉导航，避免和桌面横向菜单同时提供重复入口。 */
  display: none;

  /* 限制手机下拉组件不超过左侧导航列，防止内部按钮反向撑宽页面。 */
  max-width: 100%;
}

/*
  作用容器: Element UI 传送到 body 的手机导航菜单 `.app-navbar__mobile-menu`。
  样式作用:
  默认隐藏脱离 AppNavbar DOM 层级的弹层，防止桌面视口残留手机菜单。
  手机媒体查询会恢复弹层布局，菜单收起状态继续由 Element UI 内联 display 控制。
*/
.app-navbar__mobile-menu {
  /* 桌面默认隐藏手机菜单弹层，作为跨断点状态切换期间的视觉边界保护。 */
  display: none;
}

/*
  作用容器: 手机导航菜单触发按钮 `.app-navbar__mobile-trigger`。
  样式作用:
  横向排列菜单图标、当前页面名称和展开箭头。
  提供稳定点击面积和宽度，让当前页面名称变化时导航布局不抖动。
  在深色导航背景中保持清晰边界和键盘可聚焦能力。
*/
.app-navbar__mobile-trigger {
  /* 设置按钮为 flex 布局，让菜单图标、页面名称和展开箭头沿同一行排列。 */
  display: inline-flex;

  /* 设置按钮内部内容垂直居中，保持三个元素的视觉基线稳定。 */
  align-items: center;

  /* 设置按钮内部元素间距，避免图标和页面名称贴得过近。 */
  gap: 10px;

  /* 设置手机导航按钮稳定宽度，避免“首页”和“个人中心”等不同文案引发布局位移。 */
  width: 220px;

  /* 限制按钮不超过手机左侧导航列，极窄视口下允许按父级宽度收缩。 */
  max-width: 100%;

  /* 设置按钮高度与窄屏桌面导航按钮一致，提供稳定的触摸点击面积。 */
  height: 44px;

  /* 设置按钮横向内边距，让图标和文字不贴近按钮边缘。 */
  padding: 0 14px;

  /* 使用半透明浅色边框标记手机导航入口，但不抢过搜索按钮视觉层级。 */
  border: 1px solid rgba(255, 255, 255, 0.16);

  /* 使用轻量深色背景区分可点击按钮和导航栏底色。 */
  background: rgba(255, 255, 255, 0.06);

  /* 设置克制圆角，让手机导航触发器与现有导航控件风格一致。 */
  border-radius: 8px;

  /* 设置按钮文字为浅色，保证深色导航背景上的可读性。 */
  color: #ffffff;

  /* 使用项目继承字体，避免下拉触发按钮与桌面导航出现字体差异。 */
  font-family: inherit;

  /* 设置当前页面名称字号与桌面导航接近，保证手机入口清晰可读。 */
  font-size: 15px;

  /* 设置按钮文字字重，突出当前页面名称但不压过页面标题。 */
  font-weight: 600;

  /* 把边框和内边距计入按钮尺寸，避免固定宽度因盒模型产生偏差。 */
  box-sizing: border-box;

  /* 鼠标设备下显示手型，提示手机导航触发器可以点击。 */
  cursor: pointer;

  /* 设置背景、边框和文字颜色过渡，让悬停与聚焦状态切换自然。 */
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

/*
  作用容器: 手机导航触发按钮的悬停状态 `.app-navbar__mobile-trigger:hover`。
  样式作用:
  提示鼠标用户当前按钮可以展开完整导航菜单。
  保持按钮尺寸不变，避免顶部布局发生位移。
*/
.app-navbar__mobile-trigger:hover {
  /* 增强悬停按钮背景亮度，让当前可操作入口更明确。 */
  background: rgba(255, 255, 255, 0.1);

  /* 提高悬停按钮边框对比度，强化按钮轮廓而不改变尺寸。 */
  border-color: rgba(255, 255, 255, 0.3);
}

/*
  作用容器: 键盘聚焦的手机导航触发按钮 `.app-navbar__mobile-trigger:focus-visible`。
  样式作用:
  给键盘用户提供清晰焦点位置。
  不影响鼠标点击后的普通按钮状态。
*/
.app-navbar__mobile-trigger:focus-visible {
  /* 使用主题强调色绘制键盘焦点轮廓，让焦点在深色背景上清晰可见。 */
  outline: 2px solid var(--accent);

  /* 设置焦点轮廓与按钮边缘之间的距离，避免轮廓贴住按钮内容。 */
  outline-offset: 2px;
}

/*
  作用容器: 手机导航触发器中的菜单图标 `.app-navbar__mobile-trigger-icon`。
  样式作用:
  稳定菜单图标尺寸，帮助用户快速识别完整导航入口。
  防止图标在按钮收缩时被压缩。
*/
.app-navbar__mobile-trigger-icon {
  /* 设置菜单图标字号，让它在 44px 高触发按钮中保持清晰。 */
  font-size: 18px;

  /* 禁止菜单图标参与 flex 收缩，避免极窄宽度下图标变形或消失。 */
  flex: 0 0 auto;
}

/*
  作用容器: 手机导航当前页面名称 `.app-navbar__mobile-trigger-label`。
  样式作用:
  使用剩余空间展示当前页面名称。
  在极窄视口下允许文本省略，但不挤出菜单图标和展开箭头。
*/
.app-navbar__mobile-trigger-label {
  /* 让当前页面名称占据图标之外的剩余空间，保持按钮内部布局稳定。 */
  flex: 1 1 auto;

  /* 允许文本区域收缩到 flex 可用宽度，避免长页面名称撑宽按钮。 */
  min-width: 0;

  /* 禁止当前页面名称换行，保持手机导航触发器固定高度。 */
  white-space: nowrap;

  /* 裁掉极窄视口下超过标签区域的文字，保护按钮边界。 */
  overflow: hidden;

  /* 给被裁切的异常长页面名称显示省略号，保留可读的截断反馈。 */
  text-overflow: ellipsis;

  /* 设置当前页面名称左对齐，和展开后的菜单项阅读起点一致。 */
  text-align: left;
}

/*
  作用容器: 手机导航触发器展开箭头 `.app-navbar__mobile-trigger-arrow`。
  样式作用:
  提示当前按钮会展开附加菜单。
  固定箭头占位，避免页面名称长度改变箭头位置。
*/
.app-navbar__mobile-trigger-arrow {
  /* 设置展开箭头为辅助字号，避免图标抢过当前页面名称。 */
  font-size: 12px;

  /* 禁止展开箭头参与 flex 收缩，保证窄屏下仍能表达下拉语义。 */
  flex: 0 0 auto;
}

/*
  作用容器: 当前页面对应的手机下拉菜单项 `.app-navbar__mobile-item--active`。
  样式作用:
  使用项目导航激活色标记当前页面。
  帮助用户打开菜单后快速判断自己所在的位置。
*/
.app-navbar__mobile-item--active {
  /* 设置当前菜单项为金色文字，与桌面导航激活状态保持一致。 */
  color: #c88b18;

  /* 设置当前菜单项浅色背景，让选中状态不只依赖文字颜色表达。 */
  background: #fff8e8;
}

/*
  作用容器: 单个导航入口 `.app-navbar__item`。
  样式作用:
  建立主导航按钮的稳定点击面积。
  保持按钮文字不换行，避免菜单项在顶部栏中断裂。
  使用深色背景上的浅色文字建立顶部导航层次。
*/
.app-navbar__item {
  /* 清除浏览器默认按钮背景，让按钮融入深色导航栏。 */
  background: transparent;

  /* 清除浏览器默认按钮边框，让导航项呈现菜单入口外观。 */
  border: 0;

  /* 设置导航按钮响应式左右内边距，让宽屏舒展、窄屏紧凑。 */
  padding: 0 clamp(12px, 1.15vw, 22px);

  /* 设置导航按钮高度和顶部栏一致，扩大点击面积并保持文字垂直居中。 */
  height: 64px;

  /* 设置导航文字为浅色，保证深色顶部栏上的可读性。 */
  color: #dbe4ef;

  /* 设置导航文字字号比上一版增大一档，让左侧页面入口更清晰醒目。 */
  font-size: 16px;

  /* 使用项目继承字体，避免导航和页面正文出现字体风格割裂。 */
  font-family: inherit;

  /* 设置导航文字不换行，避免个人中心等入口拆成两行。 */
  white-space: nowrap;

  /* 鼠标移入时显示手型，提示该导航入口可以点击。 */
  cursor: pointer;

  /* 设置颜色和背景过渡，让 hover 和 active 反馈更柔和。 */
  transition: color 0.18s ease, background-color 0.18s ease;
}

/*
  作用容器: 导航入口悬停状态 `.app-navbar__item:hover`。
  样式作用:
  给可点击导航入口提供轻量交互反馈。
  不破坏深色顶部栏的整体克制视觉。
*/
.app-navbar__item:hover {
  /* 设置悬停时的半透明浅色背景，提示当前导航入口可点击。 */
  background: rgba(255, 255, 255, 0.06);

  /* 设置悬停时文字变亮，增强用户对当前指向入口的感知。 */
  color: #ffffff;
}

/*
  作用容器: 当前页面导航入口 `.app-navbar__item--active`。
  样式作用:
  标记当前页面所在的一级入口。
  用金色文字和深色选中背景表达顶部导航激活状态。
*/
.app-navbar__item--active {
  /* 设置当前导航入口为金色文字，让用户快速识别当前页面。 */
  color: #f3c45d;

  /* 设置当前导航入口的深色选中背景，增强激活态但不抢过主体内容。 */
  background: rgba(0, 0, 0, 0.14);
}

/*
  作用容器: 中间搜索表单 `.app-navbar__search`。
  样式作用:
  横向组合搜索输入框和搜索按钮。
  在中间列内占满可用宽度，但不超过中间列安全范围。
  搜索表单跟随中间列动态伸缩，不使用固定宽度遮挡两侧内容。
*/
.app-navbar__search {
  /* 设置搜索表单为 flex 容器，让输入框和按钮横向贴合。 */
  display: flex;

  /* 设置搜索输入框和按钮垂直居中，保持控件上下边缘对齐。 */
  align-items: center;

  /* 设置搜索表单宽度占满中间剩余空间，让输入框随可用宽度动态变化。 */
  width: 100%;

  /* 限制搜索表单最大宽度，避免超宽屏下搜索框拉得过长。 */
  max-width: 720px;

  /* 限制搜索表单最小宽度，保证桌面端搜索框被压缩后仍有基本可用输入空间。 */
  min-width: 220px;

  /* 把搜索表单放在中间列可用空间的水平中心。 */
  margin: 0 auto;
}

/*
  作用容器: 搜索输入框 `.app-navbar__search-input`。
  样式作用:
  承载用户搜索关键词输入。
  在深色导航栏中提供高对比度的浅色输入区域。
  和右侧搜索按钮组成一体化搜索控件。
*/
.app-navbar__search-input {
  /* 设置输入框占据搜索表单剩余宽度，让搜索关键词有足够输入空间。 */
  flex: 1 1 auto;

  /* 允许输入框在父级宽度不足时收缩，避免撑爆中间列。 */
  min-width: 0;

  /* 设置输入框高度和搜索按钮一致，形成完整的顶部搜索控件。 */
  height: 42px;

  /* 设置输入框左右内边距，让 placeholder 和用户输入不贴边。 */
  padding: 0 18px;

  /* 设置输入框浅色背景，在深色顶部栏中形成明确操作入口。 */
  background: rgba(255, 255, 255, 0.97);

  /* 设置透明边框占位，避免 focus 时边框变化造成控件尺寸抖动。 */
  border: 1px solid transparent;

  /* 设置输入框左侧圆角，右侧和搜索按钮贴合。 */
  border-radius: 10px 0 0 10px;

  /* 设置输入文字为深色，保证浅色输入框内的可读性。 */
  color: #172033;

  /* 移除浏览器默认聚焦轮廓，改由自定义边框和阴影表达聚焦状态。 */
  outline: none;

  /* 把输入框内边距和边框计入尺寸，保证高度和宽度计算稳定。 */
  box-sizing: border-box;
}

/*
  作用容器: 搜索输入框聚焦态 `.app-navbar__search-input:focus`。
  样式作用:
  提示用户当前正在顶部搜索框内输入。
  保持搜索控件尺寸不变，避免导航布局晃动。
*/
.app-navbar__search-input:focus {
  /* 设置聚焦边框为主题蓝色，让用户明确当前输入位置。 */
  border-color: var(--accent);

  /* 设置聚焦阴影向外发散，增强输入状态但不改变控件尺寸。 */
  box-shadow: 0 0 0 2px rgba(79, 124, 255, 0.16);
}

/*
  作用容器: 搜索按钮 `.app-navbar__search-button`。
  样式作用:
  作为顶部搜索表单的提交入口。
  使用图标按钮减少文字占位，让中间搜索控件更接近参考图。
  和输入框右侧贴合形成完整控件。
*/
.app-navbar__search-button {
  /* 设置按钮固定宽度，保证搜索图标在导航栏中占位稳定。 */
  width: 62px;

  /* 设置按钮高度和输入框一致，让搜索控件上下边缘齐平。 */
  height: 42px;

  /* 清除按钮默认内边距，让搜索图标真正居中。 */
  padding: 0;

  /* 设置按钮为 flex 容器，保证内部搜索图标水平垂直居中。 */
  display: inline-flex;

  /* 设置搜索图标水平居中。 */
  justify-content: center;

  /* 设置搜索图标垂直居中。 */
  align-items: center;

  /* 设置搜索按钮为主题蓝色，突出顶部搜索动作。 */
  background: var(--accent);

  /* 设置按钮边框和背景同色，保证控件边界完整。 */
  border: 1px solid var(--accent);

  /* 设置按钮右侧圆角，左侧和输入框无缝贴合。 */
  border-radius: 0 10px 10px 0;

  /* 设置搜索图标为白色，保证蓝色按钮上的识别度。 */
  color: #ffffff;

  /* 鼠标移入时显示手型，提示搜索按钮可以点击。 */
  cursor: pointer;

  /* 设置按钮交互过渡，让 hover 反馈更柔和。 */
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

/*
  作用容器: 搜索按钮悬停态 `.app-navbar__search-button:hover`。
  样式作用:
  提供搜索提交按钮的轻量交互反馈。
  保持按钮位置和尺寸稳定。
*/
.app-navbar__search-button:hover {
  /* 设置搜索按钮悬停时略微加深蓝色，提示当前按钮可点击。 */
  background: #416ee8;

  /* 设置悬停边框跟随背景色，避免按钮出现双层边界。 */
  border-color: #416ee8;
}

/*
  作用容器: 搜索按钮图标 `.app-navbar__search-button i`。
  样式作用:
  控制搜索图标在按钮中的视觉大小。
  保证图标比普通正文更适合按钮操作区。
*/
.app-navbar__search-button i {
  /* 设置搜索图标字号，让图标在 62px 宽按钮中清晰可见。 */
  font-size: 17px;
}

/*
  作用容器: 右侧用户状态区 `.app-navbar__user`。
  样式作用:
  横向排列游客状态、登录按钮和注册按钮。
  保证右侧用户入口整体不换行。
  在右侧列内保持右对齐。
*/
.app-navbar__user {
  /* 设置用户状态区为 flex 容器，让标签和按钮沿 x 轴排列。 */
  display: flex;

  /* 设置用户状态内容垂直居中，保持和搜索控件同一水平线。 */
  align-items: center;

  /* 设置用户标签和按钮之间的间距，避免右侧入口贴得太紧。 */
  gap: 12px;

  /* 禁止压缩用户按钮组内部宽度，避免登录和注册文字被挤断。 */
  flex: 0 0 auto;

  /* 设置用户按钮组不换行，避免顶部导航在桌面端变成两行。 */
  white-space: nowrap;
}

/*
  作用容器: 游客模式标签 `.app-navbar__guest-tag`。
  样式作用:
  提示当前处于游客模式。
  用金色文字呼应导航激活色，降低标签外框造成的拥挤感。
*/
.app-navbar__guest-tag {
  /* 设置游客模式字号比上一版缩小一档，降低右侧状态区视觉重量。 */
  font-size: 13px;

  /* 设置游客模式为金色，突出当前特殊状态而不使用额外边框。 */
  color: #f3c45d;

  /* 设置游客模式文字加粗，和右侧按钮形成清晰层级。 */
  font-weight: 700;

  /* 设置游客模式不换行，避免状态文字在窄宽度下断开。 */
  white-space: nowrap;
}

/*
  作用容器: 用户区按钮 `.app-navbar__user-button`。
  样式作用:
  作为登录和注册入口的基础按钮样式。
  保持按钮尺寸稳定，避免文字长度影响导航高度。
  在深色导航背景上提供足够对比。
*/
.app-navbar__user-button {
  /* 设置用户按钮为浅色背景，让注册入口在深色导航中清晰可见。 */
  background: #ffffff;

  /* 设置按钮边框和背景同色，保持按钮轮廓干净。 */
  border: 1px solid #ffffff;

  /* 设置按钮文字为深色，保证浅色按钮上的可读性。 */
  color: #172033;

  /* 设置用户按钮固定高度比上一版缩小约 20%，降低右侧操作区占位。 */
  height: 30px;

  /* 设置用户按钮横向内边距比上一版缩小约 20%，让登录和注册按钮宽度更克制。 */
  padding: 0 14px;

  /* 设置用户按钮圆角，贴近参考图中的胶囊按钮效果。 */
  border-radius: 12px;

  /* 设置用户按钮字号比上一版缩小一档，让登录注册不抢左侧导航层级。 */
  font-size: 13px;

  /* 设置按钮文字字重，让操作入口比普通状态文字更明确。 */
  font-weight: 600;

  /* 鼠标移入时显示手型，提示按钮可以点击。 */
  cursor: pointer;

  /* 设置按钮颜色和阴影过渡，让 hover 反馈自然。 */
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

/*
  作用容器: 登录按钮 `.app-navbar__user-button:first-of-type`。
  样式作用:
  将登录设置为右侧主要操作。
  用主题蓝色和注册按钮形成主次层级。
*/
.app-navbar__user-button:first-of-type {
  /* 设置登录按钮为主题蓝色，突出登录这个主操作。 */
  background: var(--accent);

  /* 设置登录按钮边框跟随主题蓝色，保持按钮轮廓统一。 */
  border-color: var(--accent);

  /* 设置登录按钮文字为白色，保证蓝底上清晰可读。 */
  color: #ffffff;
}

/*
  作用容器: 用户区按钮悬停态 `.app-navbar__user-button:hover`。
  样式作用:
  提供登录和注册按钮的轻量交互反馈。
  保持按钮尺寸稳定，避免导航布局晃动。
*/
.app-navbar__user-button:hover {
  /* 设置按钮悬停时略微降低透明度，让用户感知当前按钮可点击。 */
  filter: brightness(0.96);
}

/*
  作用容器: 中等屏幕下的顶部主导航栏。
  样式作用:
  收紧导航间距和按钮内边距。
  缩小中间搜索列宽度，避免左右内容被过度挤压。
*/
@media (max-width: 1180px) {
  .app-navbar {
    /* 中等屏幕下也把三列间距保持为上一版两倍，避免搜索框贴近左右内容。 */
    gap: 24px;

    /* 中等屏幕继续减少左右安全边距，保证全部导航入口有更多横向空间。 */
    padding: 0 9px;
  }

  .app-navbar__center {
    /* 中等屏幕继续让搜索列吃剩余空间，避免重新变成固定宽度遮挡导航项。 */
    flex-basis: auto;
  }

  .app-navbar__item {
    /* 缩小中等屏幕下导航按钮左右内边距，降低左侧菜单宽度压力。 */
    padding: 0 12px;
  }
}

/*
  作用容器: 中等宽度设备下的顶部主导航栏。
  样式作用:
  在单行导航低于最小安全宽度前提前拆成两行，避免菜单与搜索框碰撞。
  保持左侧菜单、搜索框和用户入口的阅读顺序。
*/
@media (max-width: 1100px) {
  .app-navbar {
    /* 1100px 及以下允许三列换行，在菜单和搜索框发生空间竞争前切换到稳定两行结构。 */
    flex-wrap: wrap;

    /* 两行模式增加上下内边距，让导航行与搜索操作行之间保持清晰层次。 */
    padding: 10px 14px;
  }

  .app-navbar__left {
    /* 两行模式让左侧菜单占满第一行，保留完整七项一级导航入口。 */
    flex: 1 0 100%;
  }

  .app-navbar__center {
    /* 两行模式把搜索列放到第二行左侧，占据用户区之外的主要剩余空间。 */
    flex: 1 1 260px;

    /* 取消搜索列最小宽度限制，让第二行可以和右侧用户按钮稳定分配空间。 */
    min-width: 0;
  }

  .app-navbar__right {
    /* 两行模式让右侧用户区跟随搜索框位于第二行右侧。 */
    flex: 0 0 auto;
  }

  .app-navbar__item {
    /* 两行模式降低导航按钮高度，控制顶部栏增加一行后的纵向占用。 */
    height: 44px;

    /* 两行模式减少按钮内边距，让七项导航在 641px 以上仍能完整留在第一行。 */
    padding: 0 10px;
  }
}

/*
  作用容器: 手机宽度下的顶部主导航栏。
  样式作用:
  使用下拉菜单替代无法完整容纳的桌面横向导航。
  让搜索区和用户区分别占满一行。
  避免登录注册按钮挤压搜索输入框。
*/
@media (max-width: 640px) {
  /*
    作用容器: 手机宽度下的桌面横向导航 `.app-navbar__menu--desktop`。
    样式作用:
    隐藏无法在手机视口完整容纳的横向菜单。
    避免桌面入口和手机下拉入口同时暴露造成重复导航。
  */
  .app-navbar__menu--desktop {
    /* 手机下不渲染桌面横向菜单占位，把第一行空间完整交给下拉触发器。 */
    display: none;
  }

  /*
    作用容器: 手机宽度下的主导航下拉组件 `.app-navbar__mobile-nav`。
    样式作用:
    在 640px 及以下显示完整导航入口。
    使用内联 flex 保持触发按钮尺寸稳定并贴合左侧阅读起点。
  */
  .app-navbar__mobile-nav {
    /* 手机下显示 Element UI 下拉导航，替代被隐藏的桌面横向菜单。 */
    display: inline-flex;
  }

  /*
    作用容器: 手机宽度下的导航菜单弹层 `.app-navbar__mobile-menu`。
    样式作用:
    恢复 Element UI 下拉菜单的块级布局。
    收起时仍由组件写入的内联 display:none 保持隐藏。
  */
  .app-navbar__mobile-menu {
    /* 手机下允许已展开的下拉菜单显示，完整承载八个页面入口。 */
    display: block;
  }

  .app-navbar__center {
    /* 手机下搜索区占满整行，保证输入框仍有可用宽度。 */
    flex: 1 0 100%;
  }

  .app-navbar__right {
    /* 手机下用户区占满整行，避免按钮组压缩搜索区域。 */
    flex: 1 0 100%;

    /* 手机下用户按钮组从左侧开始排列，符合换行后的阅读顺序。 */
    justify-content: flex-start;
  }

  .app-navbar__user {
    /* 手机下用户按钮组占满整行，避免内容被右侧裁切。 */
    width: 100%;

    /* 手机下游客标签和按钮靠左排列，保持和菜单、搜索的起点一致。 */
    justify-content: flex-start;
  }
}
</style>
