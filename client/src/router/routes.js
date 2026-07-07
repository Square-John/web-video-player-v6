/*
  router/routes.js 模块说明

  - 导入库及文件汇总(8 条，内置 0 条，第三方 0 条，自定义 8 条):
      HomeView，自定义页面组件，作为首页路由渲染内容。
      MovieView，自定义页面组件，作为电影页路由渲染内容。
      TVView，自定义页面组件，作为电视剧页路由渲染内容。
      SearchResultView，自定义页面组件，作为搜索结果页路由渲染内容。
      DetailView，自定义页面组件，作为详情页路由渲染内容。
      PlayerView，自定义页面组件，作为播放页路由渲染内容。
      ProfileView，自定义页面组件，作为个人中心页路由渲染内容。
      SettingsView，自定义页面组件，作为设置页路由渲染内容。

  - 模块级常量:
      routes: Array<object>，Vue Router 原生路由表，同时通过 meta.nav 承载顶部导航展示规则。

  - 模块级辅助函数:
      无
*/

// 导入来源: 首页页面组件。
// 导入内容: HomeView。
// 文件作用: 绑定到 home 命名路由，作为根路径 `/` 的主体页面。
import HomeView from '../views/HomeView.vue';

// 导入来源: 电影页面组件。
// 导入内容: MovieView。
// 文件作用: 绑定到 movie 命名路由，作为 `/movie` 的主体页面。
import MovieView from '../views/MovieView.vue';

// 导入来源: 电视剧页面组件。
// 导入内容: TVView。
// 文件作用: 绑定到 tv 命名路由，作为 `/tv` 的主体页面。
import TVView from '../views/TVView.vue';

// 导入来源: 搜索结果页面组件。
// 导入内容: SearchResultView。
// 文件作用: 绑定到 search 命名路由，作为 `/search` 的主体页面。
import SearchResultView from '../views/SearchResultView.vue';

// 导入来源: 详情页面组件。
// 导入内容: DetailView。
// 文件作用: 绑定到 detail 命名路由，作为 `/detail/:sourceId?/:videoId?` 的主体页面。
import DetailView from '../views/DetailView.vue';

// 导入来源: 播放页面组件。
// 导入内容: PlayerView。
// 文件作用: 绑定到 player 命名路由，作为 `/player/:sourceId?/:videoId?` 的主体页面。
import PlayerView from '../views/PlayerView.vue';

// 导入来源: 个人中心页面组件。
// 导入内容: ProfileView。
// 文件作用: 绑定到 profile 命名路由，作为 `/profile` 的主体页面。
import ProfileView from '../views/ProfileView.vue';

// 导入来源: 设置页面组件。
// 导入内容: SettingsView。
// 文件作用: 绑定到 settings 命名路由，作为 `/settings` 的主体页面。
import SettingsView from '../views/SettingsView.vue';

// 类型: Array<object>。
// 作用: 集中声明当前项目 静态页面的正式路由表，并通过 meta.nav 提供顶部导航派生数据。
// 字段: path，string，浏览器地址栏中展示的路径。
// 字段: name，string，命名路由标识，供导航栏和代码跳转使用。
// 字段: component，Vue component，当前路由命中后由 <router-view /> 渲染的页面组件。
// 字段: meta.title，string，页面标题，用于后续浏览器标题、面包屑或页面标题展示。
// 字段: meta.nav，object，顶部导航配置；不存在时表示该路由不参与顶部导航。
// 字段: meta.nav.key，string，导航项唯一标识，用于 v-for 渲染稳定识别。
// 字段: meta.nav.label，string，导航按钮展示文案；当前保留与 title 的重复，确保导航语义独立。
// 字段: meta.nav.visible，boolean，是否显示在顶部导航中。
// 字段: meta.nav.order，number，顶部导航排序值，数字越小越靠前。
export const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: {
      title: '首页',
      nav: {
        key: 'home',
        label: '首页',
        visible: true,
        order: 10
      }
    }
  },
  {
    path: '/movie',
    name: 'movie',
    component: MovieView,
    meta: {
      title: '电影',
      nav: {
        key: 'movie',
        label: '电影',
        visible: true,
        order: 20
      }
    }
  },
  {
    path: '/tv',
    name: 'tv',
    component: TVView,
    meta: {
      title: '电视剧',
      nav: {
        key: 'tv',
        label: '电视剧',
        visible: true,
        order: 30
      }
    }
  },
  {
    path: '/search',
    name: 'search',
    component: SearchResultView,
    meta: {
      title: '搜索',
      nav: {
        key: 'search',
        label: '搜索',
        visible: true,
        order: 40
      }
    }
  },
  {
    path: '/detail/:sourceId?/:videoId?',
    name: 'detail',
    component: DetailView,
    meta: {
      title: '详情',
      nav: {
        key: 'detail',
        label: '详情',
        visible: true,
        order: 50
      }
    }
  },
  {
    path: '/player/:sourceId?/:videoId?',
    name: 'player',
    component: PlayerView,
    meta: {
      title: '播放页',
      nav: {
        key: 'player',
        label: '播放页',
        visible: true,
        order: 60
      }
    }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: {
      title: '个人中心',
      nav: {
        key: 'profile',
        label: '个人中心',
        visible: true,
        order: 70
      }
    }
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
    meta: {
      title: '设置',
      nav: {
        key: 'settings',
        label: '设置',
        visible: true,
        order: 80
      }
    }
  },
  {
    path: '*',
    redirect: {
      name: 'home'
    },
    meta: {
      title: '未知页面'
    }
  }
];
