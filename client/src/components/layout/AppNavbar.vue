<template>
  <!--
    AppNavbar 顶部导航组件渲染树

    {div.navbar-wrapper}
    └─ {header.app-navbar}
       ├─ {nav.app-navbar__menu}
       │  ├─ {button.app-navbar__item} 首页入口
       │  ├─ {button.app-navbar__item} 电影入口
       │  ├─ {button.app-navbar__item} 电视剧入口
       │  ├─ {button.app-navbar__item} 搜索入口
       │  ├─ {button.app-navbar__item} 详情入口
       │  ├─ {button.app-navbar__item} 播放入口
       │  ├─ {button.app-navbar__item} 个人中心入口
       │  └─ {button.app-navbar__item} 设置入口
       ├─ {form.app-navbar__search}
       │  ├─ {input.app-navbar__search-input}
       │  │  └─ 输入搜索关键词，回车提交后切换到搜索页
       │  └─ {button.app-navbar__search-button}
       │     └─ 搜索提交按钮，点击后切换到搜索页
       └─ {div.app-navbar__user}
          ├─ {span.app-navbar__guest-tag}
          │  └─ 显示当前游客状态
          ├─ {button.app-navbar__user-button}
          │  └─ 登录入口占位，点击后进入个人中心页
          └─ {button.app-navbar__user-button}
             └─ 注册入口占位，点击后进入个人中心页
  -->
  <!--
    顶部导航栏。
    作用：提供全站主要页面入口、搜索入口和用户状态入口。
  -->
  <div class="navbar-wrapper">
    <!--
      全站主导航。
      当前使用组件事件切换主体页面，点击按钮后通过 change-page 事件让 App.vue 接收页面切换意图。
    -->
    <header class="app-navbar">
      <!-- 左侧菜单区，承载首页、目录页、搜索页、播放页等主要入口。 -->
      <nav class="app-navbar__menu" aria-label="主导航">
        <!-- 循环渲染导航入口，activePage 对应项会展示高亮状态。 -->
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

      <!-- 中间搜索区，保留顶部全局搜索入口的页面结构。 -->
      <form class="app-navbar__search" role="search" @submit.prevent="handleSearchSubmit">
        <!-- 搜索输入框，searchKeyword 会保存用户当前输入内容。 -->
        <input
          v-model.trim="searchKeyword"
          class="app-navbar__search-input"
          type="search"
          placeholder="请输入搜索关键字"
          aria-label="搜索关键字"
        >

        <!-- 搜索按钮，提交后切换到搜索页，具体搜索逻辑由搜索页统一处理。 -->
        <button type="submit" class="app-navbar__search-button" aria-label="搜索">
          搜索
        </button>
      </form>

      <!-- 右侧用户状态区，用于展示游客态入口和账户操作入口。 -->
      <div class="app-navbar__user">
        <!-- 游客状态标签，用来占住导航右侧状态区的位置。 -->
        <span class="app-navbar__guest-tag">游客模式</span>

        <!-- 登录入口占位，当前点击后进入个人中心页面。 -->
        <button type="button" class="app-navbar__user-button" @click="handleNavClick('profile')">
          登录
        </button>

        <!-- 注册入口占位，当前点击后进入个人中心页面。 -->
        <button type="button" class="app-navbar__user-button" @click="handleNavClick('profile')">
          注册
        </button>
      </div>
    </header>
  </div>
</template>

<script>
/**
 * 全站顶部导航组件。
 *
 * 组件职责：
 * - 渲染首页、电影、电视剧、搜索、详情、播放、个人中心和设置入口。
 * - 提供顶部搜索框的静态交互入口。
 * - 保留用户状态区的布局位置，方便页面展示账户相关入口。
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
      // searchKeyword 绑定顶部搜索输入框，提交搜索时会用来判断是否切到搜索页。
      searchKeyword: '',

      // navItems 定义顶部左侧主导航入口，决定导航按钮的显示顺序。
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
          name: 'search',
          label: '搜索'
        },
        {
          // detail 是详情页入口，在当前静态切页方案中用于直接查看详情页。
          name: 'detail',
          label: '详情'
        },
        {
          name: 'player',
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
     * @returns {void} 当前方法只切换到搜索页，不直接发起搜索请求。
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
  导航外层包装。
  对应 template 中的 `.navbar-wrapper`，作用是让深色导航横向占满页面。
*/
.navbar-wrapper {
  /* 横向铺满视口宽度，避免导航背景只包住内容。 */
  width: 100%;

  /* 深色背景先放在外层，避免内部滚动或换行时露出浅底。 */
  background: #172133;
}

/*
  顶部主导航栏。
  对应 template 中的 `.app-navbar`，负责把左侧入口、中间搜索和右侧用户区排成一行。
*/
.app-navbar {
  /* 使用 flex 横向管理三块区域：菜单、搜索、用户状态。 */
  display: flex;

  /* 垂直居中所有导航内容，让按钮、输入框和标签在同一水平线上。 */
  align-items: center;

  /* 中间留出固定间距，避免三块内容贴在一起。 */
  gap: 18px;

  /* 导航内容横向占满页面，保证深色顶部菜单覆盖整条视口宽度。 */
  width: 100%;

  /* 固定最小高度，让导航栏高度稳定。 */
  min-height: 58px;

  /* 左右留白让菜单不贴浏览器边缘。 */
  padding: 0 20px;

  /* 深色背景作为导航主视觉。 */
  background: #172133;

  /* 底部细线让导航和主体内容之间有明确边界。 */
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  /* 让 padding 计入宽度，避免横向溢出。 */
  box-sizing: border-box;
}

/*
  左侧导航入口组。
  对应 template 中的 `.app-navbar__menu`，承载主要页面入口。
*/
.app-navbar__menu {
  /* 使用 flex 横向排列导航按钮。 */
  display: flex;

  /* 垂直居中每个按钮。 */
  align-items: center;

  /* 入口之间不额外留 gap，由按钮 padding 控制点击面积。 */
  gap: 0;

  /* 不压缩菜单区，避免主要页面入口被搜索框挤变形。 */
  flex: 0 0 auto;

  /* 允许小屏时换行，保证导航不横向撑爆页面。 */
  flex-wrap: wrap;
}

/*
  单个导航入口。
  对应 template 中循环渲染的 `.app-navbar__item`。
*/
.app-navbar__item {
  /* 清掉浏览器默认按钮背景，使用导航栏自己的深色背景。 */
  background: transparent;

  /* 清掉按钮默认边框，让它看起来像导航菜单项。 */
  border: 0;

  /* 保持顶部菜单入口的稳定高度和点击区域。 */
  padding: 0 16px;

  /* 和导航栏高度一致，让文字垂直居中。 */
  height: 58px;

  /* 文字使用浅色，适合深色导航背景。 */
  color: #dbe4ef;

  /* 导航文字保持中等字号，保证信息密度。 */
  font-size: 14px;

  /* 使用继承字体，和全站基础字体保持一致。 */
  font-family: inherit;

  /* 鼠标移入时显示可点击状态。 */
  cursor: pointer;

  /* 颜色和背景变化加过渡，让 hover 不突兀。 */
  transition: color 0.18s ease, background-color 0.18s ease;
}

/*
  导航入口悬停状态。
  触发条件：鼠标移入某个 `.app-navbar__item`。
*/
.app-navbar__item:hover {
  /* hover 时给一层浅色透明背景，提示该入口可点击。 */
  background: rgba(255, 255, 255, 0.06);

  /* hover 文字略微变亮，增强反馈。 */
  color: #ffffff;
}

/*
  当前页面入口。
  对应 template 中 `item.name === activePage` 时添加的 `.app-navbar__item--active`。
*/
.app-navbar__item--active {
  /* 当前页使用金色文字，让激活入口在深色菜单中更醒目。 */
  color: #f3c45d;

  /* 当前项加一层深色选中背景，帮助用户识别所在页面。 */
  background: rgba(0, 0, 0, 0.14);
}

/*
  中间搜索区。
  对应 template 中的 `.app-navbar__search`，负责承载搜索输入框和搜索按钮。
*/
.app-navbar__search {
  /* 使用 flex 让输入框和按钮横向排列。 */
  display: flex;

  /* 垂直居中搜索框和按钮。 */
  align-items: center;

  /* 搜索区占据中间剩余空间。 */
  flex: 1 1 320px;

  /* 限制最大宽度，避免大屏下搜索框过长。 */
  max-width: 420px;

  /* 最小宽度为 0，允许窄屏时被压缩。 */
  min-width: 0;
}

/*
  搜索输入框。
  对应 template 中的 `.app-navbar__search-input`。
*/
.app-navbar__search-input {
  /* 输入框占据搜索区剩余宽度。 */
  flex: 1 1 auto;

  /* 宽度允许被父级 flex 压缩。 */
  min-width: 0;

  /* 控制输入框高度，和右侧搜索按钮对齐。 */
  height: 32px;

  /* 给输入文字留出左右空间。 */
  padding: 0 12px;

  /* 深色导航中使用浅色输入框，形成明确操作入口。 */
  background: #ffffff;

  /* 使用透明边框占位，focus 时只改变边框色不改变尺寸。 */
  border: 1px solid transparent;

  /* 左侧圆角，右侧和搜索按钮贴合。 */
  border-radius: 4px 0 0 4px;

  /* 输入文字使用深色，保证白底上可读。 */
  color: #172033;

  /* 输入框轮廓交给 focus 状态处理。 */
  outline: none;

  /* 让 padding 和 border 计入高度宽度。 */
  box-sizing: border-box;
}

/*
  搜索输入框聚焦态。
  触发条件：用户点击或键盘聚焦输入框。
*/
.app-navbar__search-input:focus {
  /* 聚焦时使用强调色边框，提示当前输入位置。 */
  border-color: var(--accent);
}

/*
  搜索按钮。
  对应 template 中的 `.app-navbar__search-button`。
*/
.app-navbar__search-button {
  /* 固定按钮高度，和输入框保持一致。 */
  height: 32px;

  /* 给按钮文字留出左右点击空间。 */
  padding: 0 13px;

  /* 使用主题蓝色作为主要操作入口。 */
  background: var(--accent);

  /* 边框同背景色，按钮边界更完整。 */
  border: 1px solid var(--accent);

  /* 右侧圆角，左侧和输入框贴合。 */
  border-radius: 0 4px 4px 0;

  /* 白色文字在蓝底上有足够对比。 */
  color: #ffffff;

  /* 让按钮文字比普通文本更稳。 */
  font-weight: 600;

  /* 鼠标移入显示可点击状态。 */
  cursor: pointer;
}

/*
  右侧用户状态区。
  对应 template 中的 `.app-navbar__user`，保留导航右侧用户入口位置。
*/
.app-navbar__user {
  /* 使用 flex 横向排列游客标签和按钮。 */
  display: flex;

  /* 垂直居中右侧状态内容。 */
  align-items: center;

  /* 控制标签和按钮之间的距离。 */
  gap: 10px;

  /* 不压缩用户区，避免按钮文字被挤断。 */
  flex: 0 0 auto;
}

/*
  游客模式标签。
  对应 template 中的 `.app-navbar__guest-tag`。
*/
.app-navbar__guest-tag {
  /* 使用较小字号，表示这是状态提示而不是主要操作。 */
  font-size: 13px;

  /* 浅色文字适合深色导航背景。 */
  color: #dbe4ef;

  /* 加一层浅色边框，形成标签外观。 */
  border: 1px solid rgba(219, 228, 239, 0.26);

  /* 标签内部留白。 */
  padding: 4px 8px;

  /* 轻微圆角，和顶部菜单整体风格一致。 */
  border-radius: 4px;
}

/*
  用户区按钮。
  对应 template 中的 `.app-navbar__user-button`。
*/
.app-navbar__user-button {
  /* 使用浅色按钮，让登录和注册入口在深色导航中更容易发现。 */
  background: #ffffff;

  /* 按钮边框跟随白色背景。 */
  border: 1px solid #ffffff;

  /* 按钮文字使用深色。 */
  color: #172033;

  /* 控制按钮高度和横向点击面积。 */
  padding: 6px 12px;

  /* 小圆角让顶部按钮保持克制清晰的视觉风格。 */
  border-radius: 4px;

  /* 字号比导航菜单略小，表示它是右侧状态操作。 */
  font-size: 13px;

  /* 鼠标移入显示可点击状态。 */
  cursor: pointer;
}

/*
  窄屏导航布局。
  触发条件：视口宽度不超过 960px。
*/
@media (max-width: 960px) {
  .app-navbar {
    /* 小屏下允许三块区域换行，避免横向挤爆。 */
    flex-wrap: wrap;

    /* 换行后增加上下内边距，让两行内容不贴得太近。 */
    padding: 8px 14px;
  }

  .app-navbar__menu {
    /* 小屏时菜单占满一行，搜索和用户区自然排到下一行。 */
    width: 100%;
  }

  .app-navbar__item {
    /* 小屏下略微降低菜单高度，减少顶部区域占用。 */
    height: 42px;

    /* 小屏下减少左右 padding，容纳更多入口。 */
    padding: 0 10px;
  }

  .app-navbar__search {
    /* 搜索区在小屏下占满剩余行宽。 */
    max-width: none;
  }
}

/*
  手机导航布局。
  触发条件：视口宽度不超过 640px。
*/
@media (max-width: 640px) {
  .app-navbar__user {
    /* 手机下用户区占满一行，避免按钮挤压搜索框。 */
    width: 100%;

    /* 让游客标签和按钮从左侧开始排列，符合移动端阅读顺序。 */
    justify-content: flex-start;
  }
}
</style>
