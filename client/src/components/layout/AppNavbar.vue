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
    │      承载整条深色导航背景，并限制内部导航不会横向撑爆页面。
    │  - params: 无
    │  - events: 无
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
       │  - params: 无
       │  - events: 无
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
       │  │  - params: 无
       │  │  - events: 无
       │  │
       │  └─ [DEFAULT] ele(nav.app-navbar__menu)
       │     │  - condition:
       │     │      默认渲染。
       │     │      navItems 有数据时通过 v-for 展示主导航按钮。
       │     │  - type:
       │     │      原生标签
       │     │      标签名称: nav
       │     │  - description:
       │     │      主导航菜单。
       │     │      当前版本保留搜索、详情和播放页入口，方便静态页面预览和调试。
       │     │  - params:
       │     │      -- navItems：顶部主导航按钮列表。
       │     │      -- activePage：当前页面标识，用于高亮对应导航项。
       │     │  - events: 无
       │     │
       │     └─ [DEFAULT] ele(button.app-navbar__item)
       │        - condition:
       │            默认渲染。
       │            每个 navItems 条目渲染一个主导航按钮。
       │        - type:
       │            原生标签
       │            标签名称: button
       │        - description:
       │            主导航按钮。
       │            点击后通知 App.vue 切换当前静态页面。
       │        - params:
       │            -- item.name：页面唯一标识，用于切页和选中态判断。
       │            -- item.label：导航按钮展示文案。
       │        - events:
       │            @click
       │                - description:
       │                    用户点击某个导航入口时触发。
       │                    用于把目标页面名称抛给父组件。
       │                - methods:
       │                    handleNavClick(item.name)
       │                        -- item.name：被点击导航项对应的页面标识。
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
       │  │  - params: 无
       │  │  - events: 无
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
       │     │      用户输入关键词后提交，静态页面阶段先切换到搜索页。
       │     │  - params:
       │     │      -- searchKeyword：用户当前输入的搜索关键词。
       │     │  - events:
       │     │      @submit
       │     │          - description:
       │     │              用户回车或点击搜索按钮提交表单时触发。
       │     │              当前版本阻止浏览器默认提交并切换到搜索页。
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
       │     │      保存用户输入内容，之后接入外部搜索时作为搜索请求关键词来源。
       │     │  - params:
       │     │      -- searchKeyword：通过 v-model.trim 双向绑定当前输入值。
       │     │  - events: 无
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
       │        - params: 无
       │        - events: 无
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
          │  - params: 无
          │  - events: 无
          │
          └─ [DEFAULT] ele(div.app-navbar__user)
             │  - condition:
             │      默认渲染。
             │      静态页面阶段始终展示游客态用户入口。
             │  - type:
             │      原生标签
             │      标签名称: div
             │  - description:
             │      用户状态按钮组。
             │      之后接入登录模块时可在这里切换游客态和登录态。
             │  - params: 无
             │  - events: 无
             │
             ├─ [DEFAULT] ele(span.app-navbar__guest-tag)
             │  - condition:
             │      默认渲染。
             │      当前版本没有真实登录状态时显示游客模式。
             │  - type:
             │      原生标签
             │      标签名称: span
             │  - description:
             │      游客模式状态标签。
             │      提示用户当前处于未登录占位状态。
             │  - params: 无
             │  - events: 无
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
             │      静态页面阶段点击后先进入个人中心页占位。
             │  - params: 无
             │  - events:
             │      @click
             │          - description:
             │              用户点击登录按钮时触发。
             │              当前版本先跳转到个人中心页，之后可替换为登录弹窗。
             │          - methods:
             │              handleNavClick('profile')
             │                  -- profile：个人中心页标识。
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
                    静态页面阶段点击后先进入个人中心页占位。
                - params: 无
                - events:
                    @click
                        - description:
                            用户点击注册按钮时触发。
                            当前版本先跳转到个人中心页，之后可替换为注册弹窗。
                        - methods:
                            handleNavClick('profile')
                                -- profile：个人中心页标识。
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
    - params: 无
    - events: 无
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
      - params: 无
      - events: 无
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
        - params: 无
        - events: 无
      -->
      <div class="app-navbar__left">
        <!--
          [DEFAULT] ele(nav.app-navbar__menu)
          - condition:
              默认渲染。
              navItems 有数据时通过 v-for 生成导航按钮。
          - type:
              原生标签
              标签名称: nav
          - description:
              主导航菜单。
              当前版本保留搜索、详情和播放页入口，在路由能力稳定后可按页面策略控制显示。
          - params:
              -- navItems：主导航入口数组。
              -- activePage：当前页面标识，用于设置激活态。
          - events: 无
        -->
        <nav class="app-navbar__menu" aria-label="主导航">
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
                点击后通过 change-page 事件让 App.vue 切换主体页面。
            - params:
                -- item.name：页面唯一标识。
                -- item.label：导航展示文案。
            - events:
                @click
                    - description:
                        用户点击导航按钮时触发。
                        用于通知父组件切换到对应静态页面。
                    - methods:
                        handleNavClick(item.name)
                            -- item.name：目标页面标识。
          -->
          <button
            v-for="item in navItems"
            :key="item.name"
            type="button"
            class="app-navbar__item"
            :class="{ 'app-navbar__item--active': item.name === activePage }"
            @click="handleNavClick(item.name)"
          >
            {{ item.label }}
          </button>
        </nav>
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
        - params: 无
        - events: 无
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
              静态页面阶段提交后切换到搜索页，之后可接入真实搜索关键词。
          - params:
              -- searchKeyword：当前输入的搜索关键词。
          - events:
              @submit
                  - description:
                      用户回车或点击搜索按钮提交时触发。
                      阻止浏览器默认刷新并切换到搜索页。
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
                保存用户当前输入，之后接入外部搜索时作为关键词来源。
            - params:
                -- searchKeyword：通过 v-model.trim 同步用户输入值。
            - events: 无
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
                使用图标按钮贴近 参考布局 顶部搜索视觉，并减少横向文字占位。
            - params: 无
            - events: 无
          -->
          <button type="submit" class="app-navbar__search-button" aria-label="搜索">
            <!-- 搜索图标来自 Element UI 样式字体；这里只使用图标 class，不使用 Element UI 组件。 -->
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
        - params: 无
        - events: 无
      -->
      <div class="app-navbar__right">
        <!--
          [DEFAULT] ele(div.app-navbar__user)
          - condition:
              默认渲染。
              静态页面阶段始终展示游客态按钮组。
          - type:
              原生标签
              标签名称: div
          - description:
              用户状态按钮组。
              为后续登录态切换预留导航右侧空间。
          - params: 无
          - events: 无
        -->
        <div class="app-navbar__user">
          <!--
            [DEFAULT] ele(span.app-navbar__guest-tag)
            - condition:
                默认渲染。
                当前版本没有真实登录态时展示游客模式。
            - type:
                原生标签
                标签名称: span
            - description:
                游客状态标签。
                用金色提示当前是未登录占位状态。
            - params: 无
            - events: 无
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
                当前版本点击后进入个人中心占位页。
            - params: 无
            - events:
                @click
                    - description:
                        用户点击登录按钮时触发。
                        当前版本先切换到个人中心页，后续接登录弹窗。
                    - methods:
                        handleNavClick('profile')
                            -- profile：个人中心页标识。
          -->
          <button type="button" class="app-navbar__user-button" @click="handleNavClick('profile')">
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
                当前版本点击后进入个人中心占位页。
            - params: 无
            - events:
                @click
                    - description:
                        用户点击注册按钮时触发。
                        当前版本先切换到个人中心页，后续接注册弹窗。
                    - methods:
                        handleNavClick('profile')
                            -- profile：个人中心页标识。
          -->
          <button type="button" class="app-navbar__user-button" @click="handleNavClick('profile')">
            注册
          </button>
        </div>
      </div>
    </header>
  </div>
</template>

<script>
/*
  AppNavbar script 模块说明

  - 导入库及文件汇总(0 条，内置 0 条，第三方 0 条，自定义 0 条):
      无

  - 模块级常量:
      无

  - 模块级辅助函数:
      无
*/

/**
 * 全站顶部导航组件。
 *
 * 组件职责：
 * - 渲染首页、电影、电视剧、搜索、详情、播放页、个人中心和设置入口。
 * - 使用原生 flex 建立左侧左对齐、中间居中、右侧右对齐的顶部布局。
 * - 提供顶部搜索框的静态交互入口，提交后切换到搜索页。
 * - 保留用户状态区的布局位置，方便之后接入登录状态。
 * - 不直接管理页面内容，只通过事件把切换意图交给 App.vue。
 */
export default {
  // 组件名称用于在调试工具和报错信息中识别顶部导航组件。
  name: 'AppNavbar',

  props: {
    // activePage 由 App.vue 传入，用来高亮当前正在展示的页面入口。
    activePage: {
      type: String,
      required: true
    }
  },

  data() {
    return {
      // 类型: string。
      // 初始值: 空字符串，表示页面首次渲染时搜索框没有输入内容。
      // 作用: 绑定顶部搜索输入框，之后接入外部搜索时作为搜索关键词来源。
      searchKeyword: '',

      // 类型: Array<object>。
      // 作用: 定义顶部左侧一级导航入口，供 `.app-navbar__menu` 循环渲染。
      // 字段: name，string，页面唯一标识，用于向 App.vue 发出切页事件。
      // 字段: label，string，导航按钮展示文案。
      navItems: [
        {
          // name 是传给 App.vue 的页面标识。
          name: 'home',

          // label 是导航按钮展示给用户看的文字。
          label: '首页'
        },
        {
          name: 'movie',
          label: '电影'
        },
        {
          name: 'tv',
          label: '电视剧'
        },
        {
          // name 是搜索页标识，当前版本保留在导航中，方便直达搜索静态页。
          name: 'search',

          // label 是搜索页导航按钮展示给用户看的文字。
          label: '搜索'
        },
        {
          // name 是详情页标识，当前版本保留在导航中，方便直达详情静态页。
          name: 'detail',

          // label 是详情页导航按钮展示给用户看的文字。
          label: '详情'
        },
        {
          // name 是播放页标识，当前版本保留在导航中，方便直达播放静态页。
          name: 'player',

          // label 是播放页导航按钮展示给用户看的文字。
          label: '播放页'
        },
        {
          name: 'profile',
          label: '个人中心'
        },
        {
          name: 'settings',
          label: '设置'
        }
      ]
    };
  },

  methods: {
    /**
     * 处理导航入口点击。
     *
     * @param {string} pageName 被点击的页面名称。
     * @returns {void} 通过 change-page 事件把页面名称交给父组件。
     */
    handleNavClick(pageName) {
      // 导航组件只负责发出切换意图，真正展示哪个页面由 App.vue 决定。
      this.$emit('change-page', pageName);
    },

    /**
     * 处理顶部搜索提交。
     *
     * @returns {void} 当前版本只切换到搜索页，不发起真实搜索请求。
     */
    handleSearchSubmit() {
      // 搜索框为空时也允许进入搜索页，搜索页自己会显示当前静态状态。
      this.handleNavClick('search');
    }
  }
};
</script>

<style scoped>
/*
  作用容器: 导航外层包装 `.navbar-wrapper`。
  样式作用:
  承载整条顶部导航的深色背景。
  限制导航内部内容不会因为宽度计算误差造成页面横向滚动。
*/
.navbar-wrapper {
  /* 设置导航外层横向铺满视口，保证深色背景覆盖整个顶部区域。 */
  width: 100%;

  /* 设置导航外层深色背景，避免内部三列布局换行时露出页面浅底。 */
  background: #172133;

  /* 隐藏导航外层偶发横向溢出，避免窄屏时出现页面级横向滚动条。 */
  overflow-x: hidden;
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

  /* 设置导航最小高度接近 参考布局 顶部栏，保证菜单和搜索控件有稳定点击面积。 */
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
  固定承载主导航菜单。
  按菜单内容计算宽度，确保当前版本所有页面入口都能显示出来。
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
  当左右两侧内容变宽时自动缩窄，不遮挡当前版本导航入口。
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
  横向排列首页、电影、电视剧、个人中心和设置入口。
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

  /* 设置菜单宽度由全部导航项自然撑开，保证搜索、详情和播放页等入口可见。 */
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
  作用容器: 单个导航入口 `.app-navbar__item`。
  样式作用:
  建立主导航按钮的稳定点击面积。
  保持按钮文字不换行，避免菜单项在顶部栏中断裂。
  使用深色背景上的浅色文字承接 参考布局 顶部导航风格。
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
  用金色文字和深色选中背景延续 参考布局 顶部导航激活状态。
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
  作用容器: 窄屏设备下的顶部主导航栏。
  样式作用:
  允许导航内容拆成两行，避免左右内容和搜索框互相挤压。
  保持左侧菜单、搜索框和用户入口的阅读顺序。
*/
@media (max-width: 860px) {
  .app-navbar {
    /* 窄屏下允许三列换行，避免顶部栏在小宽度下横向撑爆页面。 */
    flex-wrap: wrap;

    /* 窄屏下增加上下内边距，让换行后的两行内容有足够呼吸空间。 */
    padding: 10px 14px;
  }

  .app-navbar__left {
    /* 窄屏下让左侧菜单占满第一行，保留完整一级导航入口。 */
    flex: 1 0 100%;
  }

  .app-navbar__center {
    /* 窄屏下搜索列放到第二行左侧，占据主要剩余空间。 */
    flex: 1 1 260px;

    /* 窄屏下取消中间列最小宽度限制，避免挤压右侧用户按钮。 */
    min-width: 0;
  }

  .app-navbar__right {
    /* 窄屏下右侧用户区跟随搜索框位于第二行右侧。 */
    flex: 0 0 auto;
  }

  .app-navbar__item {
    /* 窄屏下降低导航按钮高度，减少顶部栏换行后的纵向占用。 */
    height: 44px;

    /* 窄屏下减少按钮内边距，让更多导航入口可见。 */
    padding: 0 10px;
  }
}

/*
  作用容器: 手机宽度下的顶部主导航栏。
  样式作用:
  让搜索区和用户区分别占满一行。
  避免登录注册按钮挤压搜索输入框。
*/
@media (max-width: 640px) {
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
