<template>
  <!--
    AppNavbar 组件渲染树

    {header.app-navbar}
    ├─ {div.app-navbar__brand}
    │  └─ {span.app-navbar__title}
    │     └─ 应用名称
    └─ {nav.app-navbar__links}
       └─ {button.app-navbar__link} 循环渲染导航入口；点击后向父组件提交 change-page
  -->
  <!--
    顶部导航栏。
    作用：放在应用最上方，承载项目名称和基础导航入口。
  -->
  <header class="app-navbar">
    <!-- 左侧品牌区域，用来让用户快速识别当前应用。 -->
    <div class="app-navbar__brand">
      <!-- 项目名称。后续接入路由后，这里可以扩展为返回首页的入口。 -->
      <span class="app-navbar__title">Web Video Player</span>
    </div>

    <!-- 右侧导航区域，当前通过事件把页面切换意图交给 App.vue 处理。 -->
    <nav class="app-navbar__links" aria-label="主导航">
      <!-- 循环渲染顶部入口，active-page 对应的入口会显示选中态。 -->
      <button
        v-for="item in navItems"
        :key="item.name"
        type="button"
        class="app-navbar__link"
        :class="{ 'app-navbar__link--active': item.name === activePage }"
        @click="handleNavClick(item.name)"
      >
        {{ item.label }}
      </button>
    </nav>
  </header>
</template>

<script>
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
      // navItems 定义顶部导航入口；每个入口点击后会把页面名称交给 App.vue。
      navItems: [
        {
          name: 'home',
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
          name: 'detail',
          label: '详情'
        },
        {
          name: 'player',
          label: '播放'
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
      // 导航组件只负责发出切换意图，不直接决定主体区域渲染哪个页面。
      this.$emit('change-page', pageName);
    }
  }
};
</script>

<style scoped>
/*
  顶部导航栏整体容器。
  对应 template 中的 `.app-navbar`，负责撑起页面最上方的横向操作区。
*/
.app-navbar {
  /* 使用 flex 让左侧品牌和右侧导航在同一行排列。 */
  display: flex;

  /* 让品牌区域靠左、导航区域靠右，形成清晰的顶部布局。 */
  justify-content: space-between;

  /* 垂直方向居中导航内容，避免文字贴近顶部或底部。 */
  align-items: center;

  /* 给导航栏左右留出空间，让内容不贴浏览器边缘。 */
  padding: 18px 32px;

  /* 使用浅色背景，让顶部导航和主体内容有明确分区。 */
  background: #ffffff;

  /* 底部边线用于分隔导航栏和主体内容。 */
  border-bottom: 1px solid #e6eaf0;

  /* 统一字体，保证导航文字和主体区域视觉一致。 */
  font-family: Arial, Helvetica, sans-serif;
}

/*
  品牌区域。
  对应 template 中的 `.app-navbar__brand`，包含项目名称。
*/
.app-navbar__brand {
  /* 使用 flex 为后续品牌区域扩展保留横向布局能力。 */
  display: flex;

  /* 垂直居中项目名称。 */
  align-items: center;
}

/*
  项目名称。
  对应 template 中的 `.app-navbar__title`，是顶部导航的主要识别文字。
*/
.app-navbar__title {
  /* 使用较粗字重突出项目名称。 */
  font-weight: 700;

  /* 设置合适字号，让标题比普通导航入口更醒目。 */
  font-size: 20px;

  /* 使用深色文字，提高顶部标题可读性。 */
  color: #182235;
}

/*
  导航入口列表。
  对应 template 中的 `.app-navbar__links`，放置页面主要入口。
*/
.app-navbar__links {
  /* 使用 flex 让多个导航入口横向排列。 */
  display: flex;

  /* 垂直方向居中所有导航入口。 */
  align-items: center;

  /* 控制各个导航入口之间的距离。 */
  gap: 22px;
}

/*
  单个导航入口。
  对应 template 中的 `.app-navbar__link`，当前先作为静态入口展示。
*/
.app-navbar__link {
  /* 清掉按钮默认背景，让导航入口看起来像普通文本入口。 */
  background: transparent;

  /* 清掉按钮默认边框，避免导航区域出现系统按钮样式。 */
  border: 0;

  /* 清掉按钮默认内边距，由下面的 padding 统一控制点击区域。 */
  padding: 6px 0;

  /* 设置普通导航字号，和品牌标题形成层级差异。 */
  font-size: 15px;

  /* 使用中性色文字，保持导航区域克制。 */
  color: #5d6678;

  /* 使用继承字体，避免按钮文字和导航栏其他文字不一致。 */
  font-family: inherit;

  /* 鼠标移入时显示可点击手势。 */
  cursor: pointer;
}

/*
  当前页面导航入口。
  对应 template 中的 `.app-navbar__link--active`，由 activePage 控制。
*/
.app-navbar__link--active {
  /* 当前入口使用蓝色文字，帮助用户识别当前页面。 */
  color: #315fca;

  /* 当前入口加粗，和普通入口形成视觉区分。 */
  font-weight: 700;
}
</style>
